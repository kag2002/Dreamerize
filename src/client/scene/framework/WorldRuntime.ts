import * as THREE from 'three';
import type { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { AnimationBus } from './AnimationBus';
import { LightBudgetManager } from './LightBudgetManager';
import {
  MaterialLibrary,
  consolidateSolidMaterialsToVertexColors,
  dedupeSceneMaterials
} from './MaterialLibrary';
import { QUALITY_PRESETS, detectDefaultQualityTier } from './QualityPreset';
import {
  VisibilityAndShadowController,
  type VisibilityControllerOptions
} from './VisibilityAndShadowController';
import type { QualitySettings, QualityTier, WorldPerfMetrics } from './types';

const DEFAULT_FOLIAGE_PATTERN =
  /Grass|Flower|Clover|Fern|Wheat|Lavender|Rice|Lotus|Bamboo|Turf|Weed|Reed|Petal|Foliage|Canopy|Leaves|Twig|Blossom/i;
const DEFAULT_FOLIAGE_EXCLUDE_PATTERN =
  /Stone|Rock|Trunk|Pillar|Post|Spire|Basalt|Outcrop|Boid|Bird|Seagull|Butterfly|Dove|Egret|Trout|Smoke|Mote|Particle|Weather|Cloud|Star|Halo/i;

export interface WorldRuntimeOptions extends VisibilityControllerOptions {
  qualityTier?: QualityTier;
  enableMaterialDedupe?: boolean;
  consolidateSolids?: boolean;
  reserveLightPoolWhenEmpty?: boolean;
  autoScaleFoliage?: boolean;
  minFoliageInstanceCount?: number;
  foliageNamePattern?: RegExp;
  foliageExcludePattern?: RegExp;
}

export interface WorldRuntimeAttachParams {
  scene: THREE.Scene;
  renderer?: THREE.WebGLRenderer | null;
  camera?: THREE.PerspectiveCamera | null;
  directionalLight?: THREE.DirectionalLight | null;
  pipeline?: CinematicPipeline | null;
  sunDirection?: THREE.Vector3;
  fallbackFocusPos?: THREE.Vector3;
  protectedMaterials?: Iterable<THREE.Material | null | undefined>;
  extraMaterials?: THREE.Material[];
  canonicalMaterialSeeds?: Iterable<THREE.Material | null | undefined>;
  additionalDedupeSaved?: number;
}

/**
 * Universal runtime optimization and telemetry controller for any Dreamerize 3D world.
 * Plugs into existing and future maps to provide:
 * - QualityTier presets ('low' | 'medium' | 'high' | 'ultra') + dynamic InstancedMesh foliage density scaling
 * - Static material deduplication + optional solid-to-vertex-color consolidation
 * - Fixed-pool PointLight budget management (eliminates per-frame shader recompilations)
 * - Frustum culling restoration + distance group culling + camera-following dynamic shadow casters & cadence
 * - Standardized `getPerfMetrics()` across every world
 */
export class WorldRuntime {
  public readonly animationBus = new AnimationBus();
  public readonly lightBudgetManager = new LightBudgetManager();
  public readonly visibilityShadowController: VisibilityAndShadowController;
  public readonly materialLib = new MaterialLibrary();

  private qualitySettings: QualitySettings;
  private readonly options: WorldRuntimeOptions;
  private scene: THREE.Scene | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private pipeline: CinematicPipeline | null = null;
  private readonly sunDirection = new THREE.Vector3(62, 34, -85).normalize();
  private readonly fallbackFocusPos = new THREE.Vector3(0, 2, 16);

  private scalableFoliage: Array<{ mesh: THREE.InstancedMesh; baseCount: number }> = [];
  private lastDedupeSaved = 0;
  private loadedZonesProvider?: () => number;

  constructor(options: WorldRuntimeOptions = {}) {
    this.options = options;
    const initialTier =
      options.qualityTier && QUALITY_PRESETS[options.qualityTier]
        ? options.qualityTier
        : detectDefaultQualityTier();
    this.qualitySettings = QUALITY_PRESETS[initialTier];
    if (options.fallbackFocusPos) {
      this.fallbackFocusPos.copy(options.fallbackFocusPos);
    }
    this.visibilityShadowController = new VisibilityAndShadowController(options);
  }

  public getQualityTier(): QualityTier {
    return this.qualitySettings.tier;
  }

  public getQualitySettings(): QualitySettings {
    return this.qualitySettings;
  }

  public setLoadedZonesProvider(fn: () => number): void {
    this.loadedZonesProvider = fn;
  }

  public registerScalableFoliage(mesh: THREE.InstancedMesh, baseCount = mesh.count): void {
    if (!mesh || !mesh.isInstancedMesh || baseCount <= 0) return;
    const existing = this.scalableFoliage.find((e) => e.mesh === mesh);
    if (existing) {
      existing.baseCount = baseCount;
    } else {
      this.scalableFoliage.push({ mesh, baseCount });
    }
  }

  public addDedupeSaved(count: number): void {
    if (count > 0) {
      this.lastDedupeSaved += count;
    }
  }

  private applyFoliageQualityScaling(): void {
    const scale = this.qualitySettings.foliageDensityScale;
    for (const entry of this.scalableFoliage) {
      entry.mesh.count = Math.max(1, Math.round(entry.baseCount * scale));
    }
  }

  private resolvePrimaryDirectionalLight(
    scene: THREE.Scene,
    explicit?: THREE.DirectionalLight | null
  ): THREE.DirectionalLight | null {
    if (explicit && explicit.castShadow) return explicit;
    let bestShadow: THREE.DirectionalLight | null = null;
    let bestAny: THREE.DirectionalLight | null = explicit ?? null;
    scene.traverse((obj) => {
      const dl = obj as THREE.DirectionalLight;
      if (!dl.isDirectionalLight) return;
      if (dl.castShadow && (!bestShadow || dl.intensity > bestShadow.intensity)) {
        bestShadow = dl;
      }
      if (!bestAny || dl.intensity > bestAny.intensity) {
        bestAny = dl;
      }
    });
    return bestShadow ?? bestAny;
  }

  public attach(params: WorldRuntimeAttachParams): void {
    this.scene = params.scene;
    this.renderer = params.renderer ?? null;
    this.camera = params.camera ?? null;
    this.pipeline = params.pipeline ?? null;

    if (params.fallbackFocusPos) {
      this.fallbackFocusPos.copy(params.fallbackFocusPos);
      this.visibilityShadowController.configure({ fallbackFocusPos: this.fallbackFocusPos });
    }

    this.directionalLight = this.resolvePrimaryDirectionalLight(
      params.scene,
      params.directionalLight
    );

    if (params.sunDirection && params.sunDirection.lengthSq() > 1e-6) {
      this.sunDirection.copy(params.sunDirection).normalize();
    } else if (this.directionalLight && this.directionalLight.position.lengthSq() > 1e-6) {
      this.sunDirection.copy(this.directionalLight.position).normalize();
    }

    // 1. Auto-discover scalable foliage InstancedMeshes if enabled
    if (this.options.autoScaleFoliage !== false) {
      const minCount = this.options.minFoliageInstanceCount ?? 400;
      const includePat = this.options.foliageNamePattern ?? DEFAULT_FOLIAGE_PATTERN;
      const excludePat = this.options.foliageExcludePattern ?? DEFAULT_FOLIAGE_EXCLUDE_PATTERN;
      params.scene.traverse((obj) => {
        const inst = obj as THREE.InstancedMesh;
        if (!inst.isInstancedMesh || inst.count < minCount) return;
        const label = `${inst.name || ''} ${inst.parent?.name || ''}`;
        if (includePat.test(label) && !excludePat.test(label)) {
          this.registerScalableFoliage(inst, inst.count);
        }
      });
    }
    this.applyFoliageQualityScaling();

    // 2. Material deduplication & optional solid vertex-color consolidation
    const protectedSet = new Set<THREE.Material>();
    if (params.protectedMaterials) {
      for (const m of params.protectedMaterials) {
        if (m) protectedSet.add(m);
      }
    }
    params.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        if (m && (m as THREE.ShaderMaterial).isShaderMaterial) {
          protectedSet.add(m);
        }
      }
    });

    const seeds: THREE.Material[] = [];
    if (params.canonicalMaterialSeeds) {
      for (const s of params.canonicalMaterialSeeds) {
        if (s) seeds.push(s);
      }
    }

    let saved = params.additionalDedupeSaved ?? 0;
    if (this.options.enableMaterialDedupe !== false) {
      const dedupeRes = dedupeSceneMaterials(
        params.scene,
        protectedSet,
        params.extraMaterials,
        seeds
      );
      saved += dedupeRes.savedCount;

      if (this.options.consolidateSolids) {
        const solidRes = consolidateSolidMaterialsToVertexColors(
          params.scene,
          protectedSet,
          this.materialLib,
          params.extraMaterials
        );
        saved += solidRes.savedCount;
      }
    }
    this.lastDedupeSaved = saved;

    // 3. Pooled PointLight budget
    const reserveEmpty = this.options.reserveLightPoolWhenEmpty ?? false;
    this.lightBudgetManager.harvestFromScene(
      params.scene,
      this.qualitySettings.maxActivePointLights,
      reserveEmpty
    );

    // 4. Frustum culling restoration + distance culling + dynamic shadow caster controller
    this.visibilityShadowController.initialize(
      params.scene,
      this.directionalLight,
      this.renderer ?? undefined,
      this.qualitySettings,
      this.sunDirection
    );

    // 5. Pipeline & initial focus update
    this.pipeline?.setQualityTier(this.qualitySettings.tier);
    const initialFocus =
      this.camera && this.camera.position.lengthSq() >= 1e-6
        ? this.camera.position
        : this.fallbackFocusPos;
    this.lightBudgetManager.update(initialFocus, true);
    this.visibilityShadowController.update(this.camera, 0, true);
  }

  public setQualityTier(tier: QualityTier): void {
    const preset = QUALITY_PRESETS[tier];
    if (!preset) return;
    this.qualitySettings = preset;
    if (!this.scene) return;

    this.applyFoliageQualityScaling();
    this.pipeline?.setQualityTier(tier);
    this.visibilityShadowController.applyQuality(preset);
    this.lightBudgetManager.setPoolSize(preset.maxActivePointLights, this.scene);

    const rAny = this.renderer as unknown as {
      setPixelRatio?: (v: number) => void;
    } | null;
    if (rAny && typeof rAny.setPixelRatio === 'function' && typeof window !== 'undefined') {
      rAny.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.dprCap));
    }

    const camPos =
      this.camera && this.camera.position.lengthSq() >= 1e-6
        ? this.camera.position
        : this.fallbackFocusPos;
    this.visibilityShadowController.update(this.camera, 0, true);
    this.lightBudgetManager.update(camPos, true);
  }

  public update(camera: THREE.PerspectiveCamera | null | undefined, elapsedTime: number): void {
    if (!this.scene) return;
    if (camera) {
      this.camera = camera;
    }
    this.animationBus.update(elapsedTime);
    const camPos =
      this.camera && this.camera.position.lengthSq() >= 1e-6
        ? this.camera.position
        : this.fallbackFocusPos;
    this.visibilityShadowController.update(this.camera, elapsedTime);
    this.lightBudgetManager.update(camPos);
  }

  public getPerfMetrics(): WorldPerfMetrics {
    let totalMeshes = 0;
    let instancedMeshes = 0;
    let totalInstances = 0;
    let totalTriangles = 0;
    let visibleTriangles = 0;
    let frustumCulledOffCount = 0;
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();

    if (this.scene) {
      this.scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        totalMeshes++;
        if (!m.frustumCulled) frustumCulledOffCount++;

        const g = m.geometry;
        if (g) geos.add(g);
        const idx = g?.index;
        const pos = g?.attributes?.position;
        const baseTris = idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
        const inst = (m as THREE.InstancedMesh).isInstancedMesh
          ? (m as THREE.InstancedMesh).count
          : 1;
        if ((m as THREE.InstancedMesh).isInstancedMesh) {
          instancedMeshes++;
          totalInstances += inst;
        }
        const meshTris = baseTris * inst;
        totalTriangles += meshTris;

        let chainVis = true;
        let cur: THREE.Object3D | null = m;
        while (cur) {
          if (!cur.visible) {
            chainVis = false;
            break;
          }
          cur = cur.parent;
        }
        if (chainVis) visibleTriangles += meshTris;

        const matList = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of matList) {
          if (!mat || mats.has(mat)) continue;
          mats.add(mat);
          for (const v of Object.values(mat)) {
            if (v && (v as THREE.Texture).isTexture) {
              texs.add(v as THREE.Texture);
            }
          }
          const uniforms = (mat as THREE.ShaderMaterial).uniforms;
          if (uniforms) {
            for (const u of Object.values(uniforms)) {
              if (u?.value && (u.value as THREE.Texture).isTexture) {
                texs.add(u.value as THREE.Texture);
              }
            }
          }
        }
      });
    }

    const lightStats = this.lightBudgetManager.getStats();
    const visStats = this.visibilityShadowController.getStats();
    return {
      qualityTier: this.qualitySettings.tier,
      totalMeshes,
      instancedMeshes,
      totalInstances,
      totalTriangles: Math.round(totalTriangles),
      visibleTriangles: Math.round(visibleTriangles),
      uniqueGeometries: geos.size,
      uniqueMaterials: mats.size,
      uniqueTextures: texs.size,
      frustumCulledOffCount,
      managedPointLightsTotal: lightStats.managedTotal,
      pooledPointLightsCount: lightStats.poolSize,
      activePointLightsCount: lightStats.activeCount,
      activeShadowCasters: visStats.activeShadowCasters,
      activeShadowCasterTriangles: visStats.activeShadowCasterTriangles,
      totalLandmarkGroups: visStats.totalLandmarkGroups,
      visibleLandmarkGroups: visStats.visibleLandmarkGroups,
      deduplicatedMaterialsSaved: this.lastDedupeSaved,
      loadedZonesCount: this.loadedZonesProvider ? this.loadedZonesProvider() : undefined
    };
  }

  public dispose(): void {
    this.lightBudgetManager.dispose();
    this.visibilityShadowController.dispose();
    this.materialLib.dispose();
    this.animationBus.clear();
    this.scalableFoliage = [];
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.directionalLight = null;
    this.pipeline = null;
    this.lastDedupeSaved = 0;
  }
}
