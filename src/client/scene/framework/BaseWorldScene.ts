import * as THREE from 'three';
import type { SpaceConfig } from '../../../shared/types/space';
import type { IPointOfInterest, ISpace, ISpawnPoint, IWanderBounds } from '../ISpace';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import {
  CinematicPipeline,
  type CinematicPipelineOptions
} from '../postprocessing/CinematicPipeline';
import { mulberry32 } from './math';
import { PartsBuilder } from './PartsBuilder';
import { ResourceScope } from './ResourceScope';
import { WorldRuntime, type WorldRuntimeOptions } from './WorldRuntime';
import { ZoneStreamer } from './ZoneStreamer';
import type {
  QualityTier,
  StreamingMode,
  WorldPerfMetrics,
  ZoneBuildContext,
  ZoneDescriptor,
  ZoneHandle
} from './types';

export interface BaseWorldSceneOptions extends WorldRuntimeOptions {
  streamingMode?: StreamingMode;
  zoneLoadRadius?: number;
  zoneUnloadRadius?: number;
  maxZoneBuildMsPerFrame?: number;
  cameraFar?: number;
  pipelineOptions?: CinematicPipelineOptions;
}

/**
 * Reusable base class for building new 3D worlds in Dreamerize.
 * Pre-integrates:
 * - `WorldRuntime` (QualityTier presets, InstancedMesh foliage scaling, Material deduplication & solid vertex-color consolidation,
 *   pooled PointLight budget, frustum/distance culling, dynamic camera-following shadows, and `getPerfMetrics()`)
 * - Optional `ZoneStreamer` ('all' or 'proximity' mode) with deterministic `ResourceScope` cleanup
 * - `CinematicPipeline` and zero-leak `ThreeResourceDisposer` teardown
 */
export abstract class BaseWorldScene implements ISpace {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly slug: string;

  protected scene: THREE.Scene = new THREE.Scene();
  protected currentConfig: SpaceConfig | null = null;
  protected isInitialized = false;
  protected boundRenderer: THREE.WebGLRenderer | null = null;
  protected boundCamera: THREE.PerspectiveCamera | null = null;
  protected pipeline: CinematicPipeline | null = null;
  protected directionalLight: THREE.DirectionalLight | null = null;
  protected readonly worldRuntime: WorldRuntime;
  protected zoneStreamer: ZoneStreamer | null = null;

  protected readonly streamingMode: StreamingMode;
  protected readonly options: BaseWorldSceneOptions;
  protected readonly zoneProtectedMaterials = new Set<THREE.Material>();
  protected readonly extraMaterials: THREE.Material[] = [];
  protected readonly extraTextures: THREE.Texture[] = [];

  private prevCameraFar = 1000;
  private lastDeltaTime = 0.016;
  private lastElapsedTime = 0;
  private corePostProcessReady = false;
  private readonly zoneLightIds = new Map<string, string[]>();
  private readonly lastZoneStreamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastZoneStreamTime = -1;

  constructor(options: BaseWorldSceneOptions = {}) {
    this.options = options;
    this.streamingMode = options.streamingMode ?? 'all';
    this.worldRuntime = new WorldRuntime({
      consolidateSolids: true,
      ...options
    });
    this.worldRuntime.setLoadedZonesProvider(
      () => this.zoneStreamer?.getLoadedZoneIds().length ?? 0
    );
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getPipeline(): CinematicPipeline | null {
    return this.pipeline;
  }

  public getStreamingMode(): StreamingMode {
    return this.streamingMode;
  }

  public getLoadedZoneIds(): string[] {
    return this.zoneStreamer?.getLoadedZoneIds() ?? [];
  }

  public getQualityTier(): QualityTier {
    return this.worldRuntime.getQualityTier();
  }

  public setQualityTier(tier: QualityTier): void {
    this.worldRuntime.setQualityTier(tier);
  }

  public getPerfMetrics(): WorldPerfMetrics {
    return this.worldRuntime.getPerfMetrics();
  }

  protected abstract buildWorld(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> | void;

  protected createZones(): ZoneDescriptor[] {
    return [];
  }

  protected onUpdate(_deltaTime: number, _elapsedTime: number): void {}

  protected onConfigUpdate(_newConfig: Partial<SpaceConfig>): void {}

  protected onDispose(): void {}

  public getGroundNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
    const eps = 0.35;
    const hL = this.getGroundHeight(x - eps, z);
    const hR = this.getGroundHeight(x + eps, z);
    const hD = this.getGroundHeight(x, z - eps);
    const hU = this.getGroundHeight(x, z + eps);
    return target.set(hL - hR, 2 * eps, hD - hU).normalize();
  }

  private makeZoneBuildContext(_desc: ZoneDescriptor): ZoneBuildContext {
    return {
      scene: this.scene,
      renderer: this.boundRenderer ?? undefined,
      scope: new ResourceScope({ protectedMaterials: this.zoneProtectedMaterials }),
      parts: { create: () => new PartsBuilder() },
      materials: this.worldRuntime.materialLib,
      anim: this.worldRuntime.animationBus,
      terrain: {
        height: (x, z) => this.getGroundHeight(x, z),
        normal: (x, z, target) => this.getGroundNormal(x, z, target)
      },
      rng: mulberry32
    };
  }

  private handleZoneLoaded(handle: ZoneHandle): void {
    if (!this.corePostProcessReady) return;
    const lightIds = this.worldRuntime.lightBudgetManager.harvestFromGroup(handle.output.group);
    this.worldRuntime.visibilityShadowController.registerGroup(handle.output.group);
    this.zoneLightIds.set(handle.descriptor.id, lightIds);
  }

  private handleZoneUnloaded(handle: ZoneHandle): void {
    const lightIds = this.zoneLightIds.get(handle.descriptor.id);
    this.zoneLightIds.delete(handle.descriptor.id);
    if (!this.corePostProcessReady) return;
    if (lightIds && lightIds.length > 0) {
      this.worldRuntime.lightBudgetManager.removeByIds(lightIds);
    }
    this.worldRuntime.visibilityShadowController.unregisterGroup(handle.output.group);
  }

  public async init(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> {
    if (this.isInitialized) {
      this.dispose();
    }

    this.scene = new THREE.Scene();
    this.boundRenderer = renderer;
    this.boundCamera = camera;
    this.currentConfig = config ?? null;
    this.extraMaterials.length = 0;
    this.extraTextures.length = 0;
    this.zoneProtectedMaterials.clear();
    this.zoneLightIds.clear();
    this.corePostProcessReady = false;
    this.lastZoneStreamPos.set(Infinity, Infinity, Infinity);
    this.lastZoneStreamTime = -1;

    if (camera && this.options.cameraFar) {
      this.prevCameraFar = camera.far;
      camera.far = this.options.cameraFar;
      if (typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix();
      }
    }

    await this.buildWorld(renderer, camera, config);

    const zones = this.createZones();
    if (zones.length > 0) {
      this.zoneStreamer = new ZoneStreamer({
        mode: this.streamingMode,
        loadRadius: this.options.zoneLoadRadius ?? 460,
        unloadRadius: this.options.zoneUnloadRadius ?? 550,
        maxBuildMsPerFrame: this.options.maxZoneBuildMsPerFrame ?? 6,
        onZoneLoaded: (h) => this.handleZoneLoaded(h),
        onZoneUnloaded: (h) => this.handleZoneUnloaded(h)
      });
      this.zoneStreamer.registerAll(zones);
      if (this.streamingMode === 'all') {
        this.zoneStreamer.loadAllSync((d) => this.makeZoneBuildContext(d));
      }
    }

    if (!this.pipeline) {
      this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
        defaultStyle: 'natural',
        bloomStrength: 0.28,
        bloomRadius: 0.42,
        bloomThreshold: 0.88,
        kuwaharaEnabled: false,
        ...this.options.pipelineOptions
      });
    }

    const spawnPos = this.getSpawnPoint().position;
    this.worldRuntime.attach({
      scene: this.scene,
      renderer,
      camera,
      directionalLight: this.directionalLight,
      pipeline: this.pipeline,
      fallbackFocusPos: spawnPos,
      protectedMaterials: this.zoneProtectedMaterials,
      extraMaterials: this.extraMaterials
    });
    this.corePostProcessReady = true;

    if (this.zoneStreamer && this.streamingMode === 'proximity') {
      const initialFocus =
        camera && camera.position.lengthSq() >= 1e-6 ? camera.position : spawnPos;
      this.zoneStreamer.update(initialFocus, (d) => this.makeZoneBuildContext(d));
      this.lastZoneStreamPos.copy(initialFocus);
      this.lastZoneStreamTime = 0;
    }

    this.isInitialized = true;
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = deltaTime;
    this.lastElapsedTime = elapsedTime;

    this.onUpdate(deltaTime, elapsedTime);

    const camPos =
      this.boundCamera && this.boundCamera.position.lengthSq() >= 1e-6
        ? this.boundCamera.position
        : this.getSpawnPoint().position;
    if (this.zoneStreamer && this.streamingMode === 'proximity') {
      if (
        this.lastZoneStreamPos.distanceToSquared(camPos) >= 16.0 ||
        elapsedTime - this.lastZoneStreamTime >= 0.25
      ) {
        this.lastZoneStreamPos.copy(camPos);
        this.lastZoneStreamTime = elapsedTime;
        this.zoneStreamer.update(camPos, (d) => this.makeZoneBuildContext(d));
      }
    }

    this.worldRuntime.update(this.boundCamera, elapsedTime);
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    if (this.pipeline) {
      this.pipeline.renderFrame(renderer, camera, this.lastDeltaTime, this.lastElapsedTime);
      return;
    }
    const r = renderer as unknown as { render?: (s: THREE.Scene, c: THREE.Camera) => void };
    if (r && typeof r.render === 'function') {
      r.render(this.scene, camera);
    }
  }

  public updateConfig(newConfig: Partial<SpaceConfig>): void {
    if (!this.isInitialized || !newConfig) return;
    this.onConfigUpdate(newConfig);
  }

  public dispose(): void {
    if (!this.isInitialized) return;

    this.onDispose();

    this.pipeline?.dispose();
    this.pipeline = null;

    this.zoneStreamer?.disposeAll();
    this.zoneStreamer = null;

    this.worldRuntime.dispose();

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    for (const tex of this.extraTextures) {
      tex.dispose();
    }
    this.extraTextures.length = 0;

    for (const mat of this.extraMaterials) {
      mat.dispose();
    }
    this.extraMaterials.length = 0;

    if (this.boundCamera && this.options.cameraFar) {
      this.boundCamera.far = this.prevCameraFar;
      if (typeof this.boundCamera.updateProjectionMatrix === 'function') {
        this.boundCamera.updateProjectionMatrix();
      }
    }

    this.boundRenderer = null;
    this.boundCamera = null;
    this.directionalLight = null;
    this.zoneProtectedMaterials.clear();
    this.zoneLightIds.clear();
    this.corePostProcessReady = false;
    this.isInitialized = false;
  }

  public abstract getGroundHeight(x: number, z: number): number;
  public abstract getSpawnPoint(): ISpawnPoint;
  public abstract getWanderBounds(): IWanderBounds;
  public abstract getPointsOfInterest(): IPointOfInterest[];
}
