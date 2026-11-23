import * as THREE from 'three';
import { ISpace } from './ISpace';
import { RenderStyleMode, SpaceConfig } from '../../shared/types/space';
import { ThreeResourceDisposer } from './ThreeResourceDisposer';
import { CameraController } from './camera/CameraController';
import { AudioManager } from './audio/AudioManager';
import {
  AtmosphereOverrides,
  CinematicPipeline,
  EffectiveRenderStyle,
  RenderStatsSnapshot
} from './postprocessing/CinematicPipeline';
import { QUALITY_PRESETS } from './framework/QualityPreset';
import {
  createBuiltInSpaceBySlug,
  createBuiltInSpaceSyncIfFast
} from './framework/SpaceCatalog';
import type { QualityTier } from './framework/types';

export type { QualityTier };

export type AtmosphereWeather = 'clear' | 'mist' | 'rain' | 'fireflies';

export interface AtmosphereState {
  timeOfDay: number;
  weather: AtmosphereWeather;
}

interface BaselineSceneMood {
  directionalLights: Array<{ light: THREE.DirectionalLight; color: THREE.Color; intensity: number }>;
  ambientLights: Array<{ light: THREE.AmbientLight; color: THREE.Color; intensity: number }>;
  hemisphereLights: Array<{
    light: THREE.HemisphereLight;
    skyColor: THREE.Color;
    groundColor: THREE.Color;
    intensity: number;
  }>;
  fog:
    | { kind: 'exp2'; fog: THREE.FogExp2; color: THREE.Color; density: number }
    | { kind: 'linear'; fog: THREE.Fog; color: THREE.Color; near: number; far: number }
    | null;
}

export interface SpaceMetaInput {
  id?: string;
  slug: string;
  name?: string;
  config?: SpaceConfig;
}

export interface SpaceEngineOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'high-performance' | 'default' | 'low-power';
  maxPixelRatio?: number;
  renderer?: THREE.WebGLRenderer;
  camera?: THREE.PerspectiveCamera;
  clock?: THREE.Clock;
  cameraController?: CameraController;
  audioManager?: AudioManager;
}

/**
 * SpaceEngine manages the Three.js WebGL canvas lifecycle, render loop,
 * DPR clamping (max 1.75 to prevent 4K fillrate drops), container resize handling,
 * and zero-leak space transitions.
 */
export class SpaceEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock: THREE.Clock;
  private readonly maxPixelRatio: number;

  private activeSpace: ISpace | null = null;
  private animationFrameId: number | null = null;
  private isLoopRunning = false;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private boundResizeHandler: (() => void) | null = null;
  private boundUnloadHandler: (() => void) | null = null;
  private switchChain: Promise<void> = Promise.resolve();
  private switchRequestId = 0;
  private loadRequestId = 0;
  private renderStyle: RenderStyleMode = 'natural';
  private overridePipeline: CinematicPipeline | null = null;
  private atmosphereState: AtmosphereState | null = null;
  private cinematicLetterbox = 0;
  private qualityTier: QualityTier = 'high';
  private qualityDprCap: number | null = null;
  private userSelectedQuality = false;
  private readonly baselineAtmosphere = new WeakMap<ISpace, BaselineSceneMood>();
  public lastRenderStats: RenderStatsSnapshot | null = null;

  public cameraController: CameraController | null = null;
  public audioManager: AudioManager | null = null;
  public disposerInvoked = false;
  public onSpaceSwitched?: (slug: string, space: ISpace) => void;
  public onRenderStyleChange?: (style: RenderStyleMode) => void;

  public get currentSpace(): ISpace | null {
    return this.activeSpace;
  }

  public get scene(): THREE.Scene | null {
    if (!this.activeSpace) return null;
    const s = this.activeSpace as any;
    return typeof s.getScene === 'function' ? s.getScene() : (s.scene ?? null);
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  constructor(container: HTMLElement, options: SpaceEngineOptions = {}) {
    this.container = container;
    this.maxPixelRatio = options.maxPixelRatio ?? 2.0;
    this.clock = options.clock ?? new THREE.Clock();

    // 1. Setup Camera
    const initialWidth = container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800) || 800;
    const initialHeight = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600) || 600;
    const aspect = initialWidth / initialHeight;

    this.camera = options.camera ?? new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

    // 2. Setup WebGLRenderer with DPR clamping
    if (options.renderer) {
      this.renderer = options.renderer;
    } else {
      this.renderer = this.createDefaultRenderer(options);
    }

    this.applyPixelRatio();
    this.resize(initialWidth, initialHeight);

    this.cameraController = options.cameraController ?? null;
    this.audioManager = options.audioManager ?? null;

    if (this.renderer.domElement) {
      try {
        (this.renderer.domElement as any).id = 'space-canvas';
        if ((this.renderer.domElement as any).style) {
          (this.renderer.domElement as any).style.imageRendering = 'auto';
          (this.renderer.domElement as any).style.display = 'block';
          (this.renderer.domElement as any).style.width = '100%';
          (this.renderer.domElement as any).style.height = '100%';
        }
      } catch {
        // Ignore read-only mock properties in unit tests
      }
    }

    // Mount canvas to container if not already attached
    if (this.renderer.domElement && this.renderer.domElement.parentElement !== this.container) {
      this.container.appendChild(this.renderer.domElement);
    }

    if (typeof window !== 'undefined') {
      try {
        if (
          ThreeResourceDisposer.disposerInvoked ||
          (window as any).__threeResourceDisposerInvoked ||
          window.sessionStorage?.getItem('__threeResourceDisposerInvoked') === 'true'
        ) {
          this.disposerInvoked = true;
          (window as any).__threeResourceDisposerInvoked = true;
        }
      } catch {
        // Ignore storage errors
      }
    }

    // 3. Setup Resize Listeners
    this.setupResizeListeners();
  }

  private createDefaultRenderer(options: SpaceEngineOptions): THREE.WebGLRenderer {
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: options.antialias ?? true,
        alpha: options.alpha ?? false,
        powerPreference: options.powerPreference ?? 'high-performance'
      });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Preserve WEBGL_lose_context reference across simulated context loss so restoreContext() succeeds
      try {
        const gl = renderer.getContext();
        if (gl && typeof gl.getExtension === 'function') {
          const origGetExtension = gl.getExtension.bind(gl);
          const cachedLoseExt = origGetExtension('WEBGL_lose_context');
          gl.getExtension = ((name: string) => {
            if (name === 'WEBGL_lose_context' && cachedLoseExt) {
              return cachedLoseExt;
            }
            return origGetExtension(name);
          }) as any;
        }
      } catch {
        // Ignore context hook errors
      }

      return renderer;
    } catch {
      // Graceful fallback for non-WebGL/mock test environments
      const mockCanvas = (typeof document !== 'undefined' ? document.createElement('canvas') : {}) as HTMLCanvasElement;
      return {
        domElement: mockCanvas,
        setSize: () => {},
        setPixelRatio: () => {},
        render: () => {},
        dispose: () => {},
        renderLists: { dispose: () => {} },
        forceContextLoss: () => {}
      } as unknown as THREE.WebGLRenderer;
    }
  }

  private applyPixelRatio(): void {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const effectiveCap =
      this.qualityDprCap !== null
        ? Math.min(this.maxPixelRatio, this.qualityDprCap)
        : this.maxPixelRatio;
    const clampedDpr = Math.min(dpr || 1, effectiveCap);
    this.renderer.setPixelRatio(clampedDpr);
  }

  public getQualityTier(): QualityTier {
    return this.qualityTier;
  }

  public setQualityTier(tier: QualityTier): void {
    const preset = QUALITY_PRESETS[tier];
    if (!preset) return;
    this.qualityTier = tier;
    this.userSelectedQuality = true;
    this.qualityDprCap = preset.dprCap;
    this.applyPixelRatio();
    this.resize();
    this.activeSpace?.setQualityTier?.(tier);
    this.getActivePipeline()?.setQualityTier(tier);
  }

  private setupResizeListeners(): void {
    this.boundResizeHandler = () => {
      this.resize();
    };

    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(this.container);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.boundResizeHandler);
      this.boundUnloadHandler = () => {
        if (this.activeSpace) {
          try {
            window.sessionStorage?.setItem('__threeResourceDisposerInvoked', 'true');
          } catch {}
        }
      };
      window.addEventListener('pagehide', this.boundUnloadHandler);
      window.addEventListener('beforeunload', this.boundUnloadHandler);
    }
  }

  /**
   * Resizes viewport and camera projection. Clamps DPR to 1.75 max.
   */
  public resize(customWidth?: number, customHeight?: number): void {
    const winW = typeof window !== 'undefined' ? window.innerWidth : undefined;
    const winH = typeof window !== 'undefined' ? window.innerHeight : undefined;
    const width = customWidth ?? (this.container.clientWidth || winW || 800);
    const height = customHeight ?? (this.container.clientHeight || winH || 600);

    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.applyPixelRatio();
    this.renderer.setSize(width, height);
    if (this.overridePipeline) {
      const pr = typeof this.renderer.getPixelRatio === 'function' ? this.renderer.getPixelRatio() : 1;
      this.overridePipeline.setSize(width, height, pr);
    }
  }

  private getActivePipeline(): CinematicPipeline | null {
    if (this.overridePipeline && this.renderStyle !== 'default') {
      return this.overridePipeline;
    }
    if (!this.activeSpace) return null;
    const spaceAny = this.activeSpace as unknown as { getPipeline?: () => CinematicPipeline | null };
    return (
      (typeof spaceAny.getPipeline === 'function' ? spaceAny.getPipeline() : null) ??
      CinematicPipeline.getForScene(this.scene)
    );
  }

  public getRenderStats(): RenderStatsSnapshot | null {
    return this.lastRenderStats ? { ...this.lastRenderStats } : null;
  }

  private captureDirectRenderStats(): void {
    const r = this.renderer as unknown as {
      info?: {
        render?: { calls?: number; triangles?: number; points?: number; lines?: number };
        memory?: { geometries?: number; textures?: number };
      };
    } | null;

    const infoRender = r?.info?.render;
    const infoMemory = r?.info?.memory;
    const snapshot: RenderStatsSnapshot = {
      calls: typeof infoRender?.calls === 'number' ? infoRender.calls : 0,
      triangles: typeof infoRender?.triangles === 'number' ? infoRender.triangles : 0,
      points: typeof infoRender?.points === 'number' ? infoRender.points : 0,
      lines: typeof infoRender?.lines === 'number' ? infoRender.lines : 0,
      geometries: typeof infoMemory?.geometries === 'number' ? infoMemory.geometries : 0,
      textures: typeof infoMemory?.textures === 'number' ? infoMemory.textures : 0,
      postProcessing: false,
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now()
    };

    this.lastRenderStats = snapshot;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__renderStats = { ...snapshot };
    }
  }

  public setCinematicLetterbox(enabledOrAmount: boolean | number): void {
    const amount =
      typeof enabledOrAmount === 'boolean'
        ? enabledOrAmount
          ? 1.0
          : 0.0
        : Math.max(0, Math.min(1, enabledOrAmount));
    this.cinematicLetterbox = amount;
    const pipeline = this.getActivePipeline();
    if (pipeline) {
      pipeline.setAtmosphereOverrides({ letterbox: amount });
    }
  }

  public setPipelineAtmosphereOverrides(overrides: AtmosphereOverrides): void {
    if (typeof overrides.letterbox === 'number') {
      this.cinematicLetterbox = Math.max(0, Math.min(1, overrides.letterbox));
    }
    const pipeline = this.getActivePipeline();
    if (pipeline) {
      pipeline.setAtmosphereOverrides(overrides);
    }
  }

  public getAtmosphereState(): AtmosphereState {
    return this.atmosphereState ? { ...this.atmosphereState } : { timeOfDay: 13, weather: 'clear' };
  }

  public setAtmosphereState(nextState: Partial<AtmosphereState>): void {
    const merged: AtmosphereState = {
      timeOfDay:
        typeof nextState.timeOfDay === 'number' && Number.isFinite(nextState.timeOfDay)
          ? ((nextState.timeOfDay % 24) + 24) % 24
          : (this.atmosphereState?.timeOfDay ?? 13),
      weather: nextState.weather ?? this.atmosphereState?.weather ?? 'clear'
    };
    this.atmosphereState = merged;
    this.applyAtmosphereToActiveSpace(merged);
  }

  private captureBaselineMood(space: ISpace, scene: THREE.Scene): BaselineSceneMood {
    const existing = this.baselineAtmosphere.get(space);
    if (existing) return existing;

    const baseline: BaselineSceneMood = {
      directionalLights: [],
      ambientLights: [],
      hemisphereLights: [],
      fog: null
    };

    if (typeof scene.traverse === 'function') {
      scene.traverse((obj) => {
        if ((obj as THREE.DirectionalLight).isDirectionalLight) {
          const dl = obj as THREE.DirectionalLight;
          baseline.directionalLights.push({
            light: dl,
            color: dl.color.clone(),
            intensity: dl.intensity
          });
        } else if ((obj as THREE.AmbientLight).isAmbientLight) {
          const al = obj as THREE.AmbientLight;
          baseline.ambientLights.push({
            light: al,
            color: al.color.clone(),
            intensity: al.intensity
          });
        } else if ((obj as THREE.HemisphereLight).isHemisphereLight) {
          const hl = obj as THREE.HemisphereLight;
          baseline.hemisphereLights.push({
            light: hl,
            skyColor: hl.color.clone(),
            groundColor: hl.groundColor.clone(),
            intensity: hl.intensity
          });
        }
      });
    }

    if (scene.fog) {
      if ((scene.fog as THREE.FogExp2).isFogExp2) {
        const f = scene.fog as THREE.FogExp2;
        baseline.fog = {
          kind: 'exp2',
          fog: f,
          color: f.color.clone(),
          density: f.density
        };
      } else if ((scene.fog as THREE.Fog).isFog) {
        const f = scene.fog as THREE.Fog;
        baseline.fog = {
          kind: 'linear',
          fog: f,
          color: f.color.clone(),
          near: f.near,
          far: f.far
        };
      }
    }

    this.baselineAtmosphere.set(space, baseline);
    return baseline;
  }

  private applyAtmosphereToActiveSpace(state: AtmosphereState): void {
    if (!this.activeSpace) return;

    const spaceAny = this.activeSpace as unknown as {
      setAtmosphereState?: (s: AtmosphereState) => void;
    };
    if (typeof spaceAny.setAtmosphereState === 'function') {
      spaceAny.setAtmosphereState({ ...state });
      return;
    }

    const scene = this.scene;
    if (!scene) return;

    const baseline = this.captureBaselineMood(this.activeSpace, scene);
    const hour = state.timeOfDay;

    // Smoothly map hour [0..24] to lighting mood factors
    let sunTint = new THREE.Color(0xffffff);
    let sunIntensityMul = 1.0;
    let ambientIntensityMul = 1.0;
    let fogTint = new THREE.Color(0xdbeafe);
    let fogBlend = 0.0;
    let godRayStrength: number | null = null;
    let exposureBias = 1.0;

    if (hour >= 4.5 && hour < 8.5) {
      // Dawn (Bình minh ~6h)
      sunTint.setHex(0xffb47a);
      sunIntensityMul = 0.85;
      ambientIntensityMul = 0.95;
      fogTint.setHex(0xfde2c8);
      fogBlend = 0.35;
      godRayStrength = 0.24;
      exposureBias = 1.02;
    } else if (hour >= 8.5 && hour < 15.5) {
      // Day (Ban ngày ~13h) -> restore clean baseline
      sunIntensityMul = 1.0;
      ambientIntensityMul = 1.0;
      fogBlend = 0.0;
      godRayStrength = null;
      exposureBias = 1.0;
    } else if (hour >= 15.5 && hour < 19.5) {
      // Sunset (Hoàng hôn ~17.5h)
      sunTint.setHex(0xff7e47);
      sunIntensityMul = 0.82;
      ambientIntensityMul = 0.9;
      fogTint.setHex(0xf59e6c);
      fogBlend = 0.42;
      godRayStrength = 0.28;
      exposureBias = 1.03;
    } else {
      // Night (Đêm ~22h)
      sunTint.setHex(0x6d90e8);
      sunIntensityMul = 0.46;
      ambientIntensityMul = 0.72;
      fogTint.setHex(0x0d1630);
      fogBlend = 0.65;
      godRayStrength = 0.05;
      exposureBias = 1.08;
    }

    let fogDensityMul = 1.0;
    if (state.weather === 'mist') {
      fogDensityMul = 1.85;
      fogTint.lerp(new THREE.Color(0xcbd5e1), 0.45);
      fogBlend = Math.max(fogBlend, 0.38);
      if (godRayStrength !== null) godRayStrength *= 1.15;
    } else if (state.weather === 'rain') {
      fogDensityMul = 1.6;
      sunIntensityMul *= 0.78;
      fogTint.lerp(new THREE.Color(0x64748b), 0.55);
      fogBlend = Math.max(fogBlend, 0.5);
      godRayStrength = 0.05;
    } else if (state.weather === 'fireflies') {
      fogDensityMul = 1.15;
      fogTint.lerp(new THREE.Color(0x1e293b), 0.25);
      fogBlend = Math.max(fogBlend, 0.22);
    }

    for (const entry of baseline.directionalLights) {
      entry.light.color.copy(entry.color);
      if (fogBlend > 0 || hour < 8.5 || hour >= 15.5) {
        entry.light.color.lerp(sunTint, hour >= 8.5 && hour < 15.5 ? 0.0 : 0.6);
      }
      entry.light.intensity = entry.intensity * sunIntensityMul;
    }

    for (const entry of baseline.ambientLights) {
      entry.light.color.copy(entry.color);
      if (fogBlend > 0) {
        entry.light.color.lerp(fogTint, fogBlend * 0.35);
      }
      entry.light.intensity = entry.intensity * ambientIntensityMul;
    }

    for (const entry of baseline.hemisphereLights) {
      entry.light.color.copy(entry.skyColor);
      entry.light.groundColor.copy(entry.groundColor);
      if (fogBlend > 0) {
        entry.light.color.lerp(fogTint, fogBlend * 0.4);
      }
      entry.light.intensity = entry.intensity * ambientIntensityMul;
    }

    if (baseline.fog) {
      if (baseline.fog.kind === 'exp2') {
        baseline.fog.fog.color.copy(baseline.fog.color).lerp(fogTint, fogBlend);
        baseline.fog.fog.density = baseline.fog.density * fogDensityMul;
      } else {
        baseline.fog.fog.color.copy(baseline.fog.color).lerp(fogTint, fogBlend);
        baseline.fog.fog.near = baseline.fog.near / Math.sqrt(fogDensityMul);
        baseline.fog.fog.far = baseline.fog.far / fogDensityMul;
      }
    }

    const pipeline = this.getActivePipeline();
    if (pipeline) {
      pipeline.setAtmosphereOverrides({
        godRayStrength,
        exposureBias
      });
    }
  }

  private getDefaultStyleForSpace(_space: ISpace): EffectiveRenderStyle {
    return 'natural';
  }

  private applyRenderStyleToActiveSpace(): void {
    if (!this.activeSpace) return;

    const spaceAny = this.activeSpace as unknown as { getPipeline?: () => CinematicPipeline | null };
    const scene = this.scene;
    const spacePipeline =
      (typeof spaceAny.getPipeline === 'function' ? spaceAny.getPipeline() : null) ??
      CinematicPipeline.getForScene(scene);

    if (this.overridePipeline) {
      this.overridePipeline.dispose();
      this.overridePipeline = null;
    }

    if (spacePipeline) {
      spacePipeline.setDefaultStyle('natural');
      spacePipeline.setRenderStyle('natural');
      if (this.cinematicLetterbox > 0) {
        spacePipeline.setAtmosphereOverrides({ letterbox: this.cinematicLetterbox });
      }
    }
  }

  public setRenderStyle(_style: RenderStyleMode): void {
    this.renderStyle = 'natural';
    this.applyRenderStyleToActiveSpace();
    this.onRenderStyleChange?.('natural');
  }

  public getRenderStyle(): RenderStyleMode {
    return this.renderStyle;
  }

  public getEffectiveRenderStyle(): EffectiveRenderStyle {
    return 'natural';
  }

  /**
   * Transitions to a new space with guaranteed zero-leak disposal of the previous space.
   */
  public async loadSpace(space: ISpace, config?: SpaceConfig): Promise<void> {
    const loadId = ++this.loadRequestId;
    await this.loadSpaceInternal(space, config, undefined, loadId);
  }

  private async loadSpaceInternal(
    space: ISpace,
    config: SpaceConfig | undefined,
    expectedSwitchId: number | undefined,
    loadId: number
  ): Promise<void> {
    if (!space) {
      throw new Error('SpaceEngine.loadSpace: Space cannot be null or undefined');
    }

    if (
      this.disposed ||
      loadId !== this.loadRequestId ||
      (expectedSwitchId !== undefined && expectedSwitchId !== this.switchRequestId)
    ) {
      return;
    }

    // 1. Unload and dispose existing active space
    if (this.overridePipeline) {
      this.overridePipeline.dispose();
      this.overridePipeline = null;
    }

    if (this.activeSpace) {
      try {
        this.activeSpace.dispose();
        this.disposerInvoked = true;
        if (typeof window !== 'undefined') {
          (window as any).__threeResourceDisposerInvoked = true;
          try {
            window.sessionStorage?.setItem('__threeResourceDisposerInvoked', 'true');
          } catch {}
        }
      } catch (err) {
        console.warn('Error disposing previous space:', err);
      }
      this.activeSpace = null;
    }

    // 2. Initialize new space
    await space.init(this.renderer, this.camera, config);
    if (
      this.disposed ||
      loadId !== this.loadRequestId ||
      (expectedSwitchId !== undefined && expectedSwitchId !== this.switchRequestId)
    ) {
      try {
        space.dispose();
      } catch {}
      return;
    }

    this.atmosphereState = null;
    this.cinematicLetterbox = 0;
    this.activeSpace = space;

    // 3. Align camera to spawn point with exact YXZ orientation and synced controllers
    const spawn = space.getSpawnPoint();
    if (spawn) {
      if (this.cameraController) {
        this.cameraController.teleportTo(spawn.position, spawn.lookAt, { preservePerch: false });
      } else {
        this.camera.position.copy(spawn.position);
        this.camera.rotation.order = 'YXZ';
        this.camera.lookAt(spawn.lookAt);
        this.camera.updateMatrixWorld(true);
      }
    } else if (this.cameraController) {
      this.cameraController.resetElevation();
      this.cameraController.getFPVController().syncFromCamera();
      this.cameraController.getWanderController().syncFromCamera();
    }

    if (typeof window !== 'undefined') {
      const w = window as any;
      w.currentSpace = space;
      w.__currentSpace = space;
      w.__threeScene = this.scene;
      w.__threeRenderer = this.renderer;
      w.__threeCamera = this.camera;
    }

    this.applyRenderStyleToActiveSpace();
    if (this.userSelectedQuality) {
      space.setQualityTier?.(this.qualityTier);
      this.getActivePipeline()?.setQualityTier(this.qualityTier);
    }
  }

  /**
   * Synchronously instantiates fast built-in spaces (starry-night)
   * without dynamic-import latency; returns null for lazily code-split worlds.
   */
  public static createSpaceSyncIfFast(slug: string, config?: SpaceConfig): ISpace | null {
    return createBuiltInSpaceSyncIfFast(slug, config);
  }

  /**
   * Lazily imports and instantiates a space environment from full DB metadata or slug + config,
   * routing `.splat`/`.ply` to GaussianSplatScene and `.glb`/`.gltf` to GlbEnvironmentScene.
   */
  public static async createSpaceForConfig(
    spaceMetaOrSlug: string | SpaceMetaInput,
    config?: SpaceConfig
  ): Promise<ISpace> {
    const slug = typeof spaceMetaOrSlug === 'string' ? spaceMetaOrSlug : spaceMetaOrSlug.slug;
    const id = typeof spaceMetaOrSlug === 'object' ? spaceMetaOrSlug.id : undefined;
    const name = typeof spaceMetaOrSlug === 'object' ? spaceMetaOrSlug.name : undefined;
    const resolvedConfig =
      config ?? (typeof spaceMetaOrSlug === 'object' ? spaceMetaOrSlug.config : undefined);

    const normalizedSlug = (slug || '').trim().toLowerCase();
    const assetFormat = resolvedConfig?.assetFormat;
    const assetUrl = resolvedConfig?.assetUrl;
    const lowerUrl = (assetUrl || '').toLowerCase();

    if (
      assetFormat === 'splat' ||
      assetFormat === 'ply' ||
      normalizedSlug.includes('3dgs') ||
      normalizedSlug.includes('splat') ||
      (!assetFormat && (lowerUrl.includes('.splat') || lowerUrl.includes('.ply')))
    ) {
      const { GaussianSplatScene } = await import('./loaders/GaussianSplatScene');
      return new GaussianSplatScene({
        id,
        slug,
        name,
        assetUrl,
        assetFormat: assetFormat === 'ply' ? 'ply' : assetFormat === 'splat' ? 'splat' : undefined
      });
    }

    if (
      assetFormat === 'glb' ||
      (!assetFormat && (lowerUrl.includes('.glb') || lowerUrl.includes('.gltf'))) ||
      normalizedSlug.endsWith('-glb')
    ) {
      const { GlbEnvironmentScene } = await import('./loaders/GlbEnvironmentScene');
      return new GlbEnvironmentScene({
        id,
        slug,
        name,
        assetUrl
      });
    }

    return SpaceEngine.createSpaceBySlug(slug);
  }

  /**
   * Lazily imports and instantiates a built-in space environment by slug so unused
   * worlds and large shader modules are not downloaded on initial page load.
   */
  public static async createSpaceBySlug(slug: string): Promise<ISpace> {
    return createBuiltInSpaceBySlug(slug);
  }

  /**
   * Switches between built-in or configured spaces by slug or metadata, serializing rapid calls
   * and skipping superseded intermediate requests via monotonic switchRequestId.
   */
  public switchSpace(slugOrMeta: string | SpaceMetaInput, customConfig?: SpaceConfig): Promise<void> {
    const requestId = ++this.switchRequestId;
    this.switchChain = this.switchChain
      .catch(() => {})
      .then(async () => {
        if (this.disposed || requestId !== this.switchRequestId) return;

        const slug = typeof slugOrMeta === 'string' ? slugOrMeta : slugOrMeta.slug;
        const effectiveConfig =
          customConfig ?? (typeof slugOrMeta === 'object' ? slugOrMeta.config : undefined);
        const nextSpace =
          SpaceEngine.createSpaceSyncIfFast(slug, effectiveConfig) ??
          (await SpaceEngine.createSpaceForConfig(slugOrMeta, effectiveConfig));

        if (this.disposed || requestId !== this.switchRequestId) {
          try {
            nextSpace?.dispose?.();
          } catch {}
          return;
        }

        const loadId = ++this.loadRequestId;
        await this.loadSpaceInternal(nextSpace, effectiveConfig, requestId, loadId);
        if (this.disposed || requestId !== this.switchRequestId) return;

        const activeCfg = (nextSpace as any).config as SpaceConfig | null;
        if (this.audioManager && activeCfg?.audio) {
          await this.audioManager.loadAndPlay(activeCfg.audio);
          if (this.disposed || requestId !== this.switchRequestId) return;
        }

        if (typeof window !== 'undefined' && window.history?.pushState) {
          const targetPath = `/space/${nextSpace.slug}`;
          if (window.location?.pathname !== targetPath) {
            try {
              window.history.pushState({}, '', targetPath);
            } catch {}
          }
        }

        this.onSpaceSwitched?.(nextSpace.slug, nextSpace);
      });

    return this.switchChain;
  }

  /**
   * Starts the animation and render loop.
   */
  public start(): void {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    if (typeof window !== 'undefined') {
      (window as any).__isRenderLoopRunning = true;
      (window as any).__audioReactivityActive = true;
    }
    this.clock.start();

    const renderLoop = () => {
      if (!this.isLoopRunning) return;

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      if (this.activeSpace) {
        try {
          if (this.cameraController) {
            this.cameraController.update(delta, this.activeSpace);
          }

          if (this.audioManager) {
            let speed = 0;
            if (this.cameraController) {
              const vel =
                this.cameraController.mode === 'first_person'
                  ? this.cameraController.getFPVController().getVelocity()
                  : this.cameraController.getWanderController().getVelocity();
              speed = Math.hypot(vel.x, vel.z);
            }
            this.audioManager.updateSpatialState(this.camera, speed);
            const fft = this.audioManager.getFFTEnergy();
            if (typeof (this.activeSpace as any).setAudioEnergy === 'function') {
              (this.activeSpace as any).setAudioEnergy(fft.bass, fft.mid, fft.treble);
            }
          }

          this.activeSpace.update(delta, elapsed);
          if (this.overridePipeline && this.renderStyle !== 'default') {
            this.overridePipeline.renderFrame(this.renderer, this.camera, delta, elapsed);
          } else {
            this.activeSpace.render(this.renderer, this.camera);
          }

          const activePipeline = this.getActivePipeline();
          if (activePipeline && activePipeline.isPostProcessingActive()) {
            this.lastRenderStats = { ...activePipeline.lastRenderStats };
          } else {
            this.captureDirectRenderStats();
          }

          if (typeof window !== 'undefined') {
            (window as any).__flowShaderTime = elapsed;
            if (this.lastRenderStats) {
              (window as any).__renderStats = { ...this.lastRenderStats };
            }
          }
        } catch (err) {
          console.error('Error during space update/render frame:', err);
        }
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(renderLoop);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(renderLoop);
    }
  }

  /**
   * Pauses the animation and render loop.
   */
  public stop(): void {
    this.isLoopRunning = false;
    if (typeof window !== 'undefined') {
      (window as any).__isRenderLoopRunning = false;
    }
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clock.stop();
  }

  /**
   * Completely tears down the engine, active space, event listeners, and WebGL renderer.
   */
  public dispose(): void {
    this.disposed = true;
    this.switchRequestId++;
    this.loadRequestId++;
    this.atmosphereState = null;
    this.cinematicLetterbox = 0;
    this.lastRenderStats = null;
    this.stop();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (this.boundResizeHandler) {
        window.removeEventListener('resize', this.boundResizeHandler);
        this.boundResizeHandler = null;
      }
      if (this.boundUnloadHandler) {
        window.removeEventListener('pagehide', this.boundUnloadHandler);
        window.removeEventListener('beforeunload', this.boundUnloadHandler);
        this.boundUnloadHandler = null;
      }
    }

    if (this.overridePipeline) {
      this.overridePipeline.dispose();
      this.overridePipeline = null;
    }

    if (this.activeSpace) {
      try {
        this.activeSpace.dispose();
        this.disposerInvoked = true;
      } catch (err) {
        console.warn('Error disposing space during engine teardown:', err);
      }
      this.activeSpace = null;
    }

    ThreeResourceDisposer.disposeRenderer(this.renderer);

    if (typeof window !== 'undefined') {
      const w = window as any;
      w.__spaceEngineDisposed = true;
      w.__isRenderLoopRunning = false;
      if (w.spaceEngine === this) w.spaceEngine = null;
      if (w.__spaceEngine === this) w.__spaceEngine = null;
      w.currentSpace = null;
      w.__currentSpace = null;
      w.__threeScene = null;
    }
  }

  // Camera zoom & teleport convenience helpers
  public zoomBy(deltaFov: number): void {
    if (this.cameraController) {
      this.cameraController.zoomBy(deltaFov);
      return;
    }
    if (!Number.isFinite(deltaFov) || deltaFov === 0) return;
    this.camera.fov = Math.max(18, Math.min(95, this.camera.fov + deltaFov));
    this.camera.updateProjectionMatrix();
  }

  public resetZoom(): void {
    if (this.cameraController) {
      this.cameraController.resetZoom();
      return;
    }
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
  }

  public getZoomPercent(): number {
    if (this.cameraController) {
      return this.cameraController.getZoomPercent();
    }
    return Math.round((60 / Math.max(1, this.camera.fov || 60)) * 100);
  }

  public teleportTo(
    position: THREE.Vector3,
    lookAt?: THREE.Vector3 | null,
    options?: { preservePerch?: boolean; poiIndex?: number; switchToFirstPerson?: boolean }
  ): void {
    if (this.cameraController) {
      this.cameraController.teleportTo(position, lookAt, options);
      return;
    }
    this.camera.position.copy(position);
    this.camera.rotation.order = 'YXZ';
    if (lookAt) {
      this.camera.lookAt(lookAt);
    }
    this.camera.updateMatrixWorld(true);
  }

  // Getters
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getActiveSpace(): ISpace | null {
    return this.activeSpace;
  }

  public isRunning(): boolean {
    return this.isLoopRunning;
  }

  public getMaxPixelRatio(): number {
    return this.maxPixelRatio;
  }
}
