import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { createGrassSwayMaterial } from '../shaders/grassSwayShader';
import {
  PbrTextureSet,
  createStoneMasonryPbrTextures,
  createTerracottaRoofPbrTextures,
  createOakBarkPbrTextures,
  createTimberBeamPbrTextures,
  createPlasterWallPbrTextures,
  createGraniteCliffPbrTextures,
  createBotanicalLeafAtlasTexture,
  applyWorldSpaceWeathering,
  disposePbrTextureSet
} from '../textures/pbrTextures';
import {
  VIETNAM_WATER_LEVEL,
  getVietnamHeritageHeight,
  getVietnamHeritageNormal,
  getGoldenBridgeCurveAtX,
  createDongSonBronzeTextures,
  createGoldenBridgeMetalPbrTextures,
  createBatWingSailTexture,
  createVietnamSkyMaterial,
  createVietnamTerrainMaterial,
  createVietnamBayWaterMaterial,
  createEgretMaterial,
  createVietnamGoldenMotesMaterial
} from '../shaders/vietnamHeritageShader';

import {
  VietnamBuilderContext,
  VietnamSharedMaterials,
  VietnamSharedShaders,
  VietnamCachedTextures,
  JunkBoatMotion,
  ExclusionCircle,
  IncenseSmokeHandle,
  clamp01,
  mulberry32,
  noise2D,
  mergeNormalized,
  createArchedWallGeometry,
  createPointedArchedWallGeometry,
  createNotchedLotusPadGeometry,
  createSculptedRockGeometry,
  createVietnameseCurvedRoofGeometry,
  createHaLongKarstGeometry,
  createJadeTileMaterial,
  createWhiteMarbleMaterial,
  createOchreSandMaterial,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createLanternCapGeometry,
  createWarmLightPoolMaterial,
  createWavingSilkFlagMaterial,
  createIncenseSmokeSystem,
  createLotusFinialParts,
  createBronzeIncenseTripodParts,
  createForegroundLotusFlowerParts,
  createVietnamSharedShaders
} from './vietnamGeometryHelpers';
import {
  SignageAtlas,
  createSignagePlaqueMesh,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createCarvedTurtleSteleParts,
  createSculptedDeityParts,
  createTimberBracketSetParts,
  createBronzeBellParts,
  createGuardianBeastParts
} from './vietnamMotifHelpers';
import {
  createVolumetricCloudDome,
  VolumetricCloudDomeHandle
} from '../shaders/volumetricCloudShader';
import {
  createWeatherParticlesSystem,
  WeatherParticlesHandle,
  WeatherMode
} from '../shaders/livingNatureSystem';
import { buildVietnamNorthLandmarks } from './vietnamNorthBuilder';
import { buildVietnamCentralLandmarks } from './vietnamCentralBuilder';
import { buildVietnamSouthLandmarks } from './vietnamSouthBuilder';
import {
  buildVietnamReferenceShowUpgrades,
  VietnamReferenceShowController
} from './vietnamReferenceShowBuilder';
import { AnimationBus } from '../vietnam/core/AnimationBus';
import { VIETNAM_LANDMARK_REGISTRY } from '../vietnam/core/LandmarkRegistry';
import { LightBudgetManager } from '../vietnam/core/LightBudgetManager';
import {
  MaterialLibrary,
  consolidateSolidMaterialsToVertexColors,
  dedupeSceneMaterials
} from '../vietnam/core/MaterialLibrary';
import { detectDefaultQualityTier, QUALITY_PRESETS } from '../vietnam/core/QualityPreset';
import { ResourceScope } from '../vietnam/core/ResourceScope';
import { VisibilityAndShadowController } from '../vietnam/core/VisibilityAndShadowController';
import { ZoneStreamer } from '../vietnam/core/ZoneStreamer';
import { PartsBuilder } from '../vietnam/geometry/PartsBuilder';
import type {
  VietnamPerfMetrics,
  VietnamQualitySettings,
  VietnamQualityTier,
  VietnamRegionKey,
  VietnamStreamingMode,
  ZoneBuildContext,
  ZoneDescriptor,
  ZoneHandle
} from '../vietnam/core/types';
import {
  VIETNAM_PLAZA_EXCLUSION_HALOS,
  VIETNAM_WANDER_WAYPOINTS
} from '../vietnam/data/landmarks';

export {
  VIETNAM_WATER_LEVEL,
  getVietnamHeritageHeight,
  getVietnamHeritageNormal,
  getGoldenBridgeCurveAtX
};
export type { VietnamPerfMetrics, VietnamQualityTier, VietnamStreamingMode };

export interface VietnamHeritageSceneOptions {
  streamingMode?: VietnamStreamingMode;
  qualityTier?: VietnamQualityTier;
}

interface EgretOrbit {
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  altitude: number;
  angularSpeed: number;
  phase: number;
  scale: number;
}

/**
 * VietnamHeritageScene ("Việt Nam Kỳ Vĩ — Danh Thắng Di Sản")
 *
 * True 1:1 human-scale golden-hour 3-region Vietnamese heritage panorama (4800m × 4800m, wanderRadius: 1450m):
 * - Khuê Văn Các (Văn Miếu — Hà Nội) with 4 open corner pillars, 8 curved roofs, 4 sunburst windows & Trống Đồng plaza
 * - Chùa Một Cột (One Pillar Pagoda) & formal 34m × 34m Hồ Linh Chiểu Lotus Pond
 * - Tháp Rùa (Hoàn Kiếm Turtle Tower) on Gò Rùa mossy rock islet
 * - Cầu Vàng (Golden Bridge — Bà Nà Hills, 150m span) cradled by TWO 26m sculpted stone Giant Hands
 * - Vịnh Hạ Long (42 towering 48–85m limestone karsts + Hòn Trống Mái + 3 sailing 22m *cánh dơi* junk boats)
 * - Ruộng Bậc Thang Mù Cang Chải (sweeping emerald/golden terraced rice slopes)
 * - Living Bamboo Groves, Flame/Banyan Trees, Swaying Grass, Golden Motes & White Egrets
 * - 14 Outer Grand Cultural Sanctuaries reconstructing all 15 Vietnam Reference Cultural Zones at 1:1 macro scale
 */
export class VietnamHeritageScene implements ISpace {
  readonly id = 'space-vietnam-heritage';
  readonly name = 'Việt Nam Kỳ Vĩ — Danh Thắng Di Sản';
  readonly slug = 'vietnam-heritage';

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;
  private hasUserMutation = false;
  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  private pipeline: CinematicPipeline | null = null;
  private lastDeltaTime = 0.016;
  private lastElapsedTime = 0.0;
  private sceneElapsedTime = 0.0;

  private boundRenderer: THREE.WebGLRenderer | null = null;
  private boundCamera: THREE.PerspectiveCamera | null = null;
  private prevCameraFar = 1000;
  private prevShadowEnabled = false;
  private prevShadowAutoUpdate = true;
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  private qualitySettings: VietnamQualitySettings = QUALITY_PRESETS[detectDefaultQualityTier()];
  private readonly streamingMode: VietnamStreamingMode;
  private readonly animationBus = new AnimationBus();
  private readonly lightBudgetManager = new LightBudgetManager();
  private readonly visibilityShadowController = new VisibilityAndShadowController();
  private readonly sunDirection = new THREE.Vector3(62, 34, -85).normalize();
  private lastDedupeSaved = 0;
  private lastPerfPublishTime = -1;

  private materialLib: MaterialLibrary<VietnamSharedMaterials> | null = null;
  private signageAtlas: SignageAtlas | null = null;
  private sharedShaders: VietnamSharedShaders | null = null;
  private cachedTextures: VietnamCachedTextures | null = null;
  private zoneStreamer: ZoneStreamer<
    VietnamRegionKey,
    VietnamSharedMaterials,
    JunkBoatMotion
  > | null = null;
  private zoneProtectedMaterials = new Set<THREE.Material>();
  private dedupeProtectedMaterials = new Set<THREE.Material>();
  private canonicalMaterialSeeds: THREE.Material[] = [];
  private corePostProcessReady = false;
  private zoneMeta = new Map<string, { lightIds: string[]; movers?: JunkBoatMotion[] }>();
  private readonly lastZoneStreamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastZoneStreamTime = -1;
  private scalableFoliage: Array<{ mesh: THREE.InstancedMesh; baseCount: number }> = [];

  private ambientLight: THREE.AmbientLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;

  private skyMaterial: THREE.ShaderMaterial | null = null;
  private terrainMaterial: THREE.ShaderMaterial | null = null;
  private waterMaterial: THREE.ShaderMaterial | null = null;
  private grassMaterial: THREE.ShaderMaterial | null = null;
  private egretMaterial: THREE.ShaderMaterial | null = null;
  private motesMaterial: THREE.ShaderMaterial | null = null;
  private lanternSilkMaterial: THREE.MeshStandardMaterial | null = null;
  private lanternCoreMaterial: THREE.MeshStandardMaterial | null = null;
  private cloudDome: VolumetricCloudDomeHandle | null = null;
  private weatherParticles: WeatherParticlesHandle | null = null;
  private incenseSmoke: IncenseSmokeHandle | null = null;
  private sharedMaterials: VietnamSharedMaterials | null = null;
  private referenceShowController: VietnamReferenceShowController | null = null;
  private lanternAnimUniform = { uTime: { value: 0.0 } };
  private baseLanternIntensity = 1.95;

  private pbrSets: PbrTextureSet[] = [];
  private extraTextures: THREE.Texture[] = [];
  private extraMaterials: THREE.Material[] = [];
  private foliageWindUniforms: Array<{ uTime: { value: number }; uWindSpeed: { value: number } }> = [];
  private extraAnimatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [];
  private incenseSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  private junkBoats: JunkBoatMotion[] = [];
  private boatBaseYaws = new Map<THREE.Group, number>();
  private egretsMesh: THREE.InstancedMesh | null = null;
  private egretOrbits: EgretOrbit[] = [];
  private exclusionCircles: ExclusionCircle[] = [];

  private readonly tmpMat = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(options?: VietnamHeritageSceneOptions) {
    this.streamingMode = options?.streamingMode ?? 'all';
    if (options?.qualityTier && QUALITY_PRESETS[options.qualityTier]) {
      this.qualitySettings = QUALITY_PRESETS[options.qualityTier];
    }
    this.scene = new THREE.Scene();
  }

  public getStreamingMode(): VietnamStreamingMode {
    return this.streamingMode;
  }

  public getLoadedMacroZoneIds(): string[] {
    return this.zoneStreamer?.getLoadedZoneIds() ?? [];
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getPipeline(): CinematicPipeline | null {
    return this.pipeline;
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
    this.sceneElapsedTime = 0.0;
    this.pbrSets = [];
    this.extraTextures = [];
    this.extraMaterials = [];
    this.foliageWindUniforms = [];
    this.extraAnimatedUniforms = [];
    this.incenseSources = [];
    this.lanternAnimUniform = { uTime: { value: 0.0 } };
    this.baseLanternIntensity = 1.95;
    this.junkBoats = [];
    this.boatBaseYaws.clear();
    this.egretOrbits = [];
    this.exclusionCircles = [];
    this.scalableFoliage = [];
    this.zoneMeta.clear();
    this.zoneProtectedMaterials.clear();
    this.dedupeProtectedMaterials.clear();
    this.canonicalMaterialSeeds = [];
    this.corePostProcessReady = false;
    this.lastZoneStreamPos.set(Infinity, Infinity, Infinity);
    this.lastZoneStreamTime = -1;

    this.boundRenderer = renderer;
    this.boundCamera = camera;
    if (camera) {
      this.prevCameraFar = camera.far;
      camera.far = 8500;
      if (typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix();
      }
    }
    if (renderer && (renderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.prevShadowEnabled = Boolean(renderer.shadowMap.enabled);
      this.prevShadowAutoUpdate = Boolean(renderer.shadowMap.autoUpdate);
      this.prevShadowType = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#eab780',
        density: config?.fog?.density ?? 0.000085
      },
      sky: {
        type: config?.sky?.type ?? 'vietnam_heritage',
        topColor: config?.sky?.topColor ?? '#134294',
        bottomColor: config?.sky?.bottomColor ?? '#d98a4b',
        horizonColor: config?.sky?.horizonColor ?? '#f2be7e',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0.0,
        starDensity: config?.sky?.starDensity ?? 0,
        cloudCoverage: config?.sky?.cloudCoverage ?? 0.62,
        cloudSpeed: config?.sky?.cloudSpeed ?? 0.55
      },
      wind: {
        speed: config?.wind?.speed ?? 2.0,
        direction: config?.wind?.direction ?? [0.85, 0.0, 0.45],
        gustiness: config?.wind?.gustiness ?? 0.52,
        swayIntensity: config?.wind?.swayIntensity ?? 0.85
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#ffe9cf',
          intensity: config?.lighting?.ambient?.intensity ?? 0.48
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#ffdfb0',
          intensity: config?.lighting?.directional?.intensity ?? 2.45,
          position: config?.lighting?.directional?.position ?? [62, 34, -85],
          castShadow: config?.lighting?.directional?.castShadow ?? true
        },
        pointLights: config?.lighting?.pointLights ?? []
      },
      shaders: config?.shaders ?? {
        grassSway: { stiffness: 0.5, windInfluence: 0.85, noiseScale: 0.24 },
        flowerFlutter: { frequency: 2.2, amplitude: 0.3 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'vietnam-heritage-ambient',
        name: config?.audio?.name ?? 'Việt Nam',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/vietnam-1.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.72,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 2.4, wet: 0.28 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 2.2, 58],
        lookAt: config?.camera?.lookAt ?? [0, 5.2, -12],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 12.0,
        wanderSpeed: config?.camera?.wanderSpeed ?? 3.2,
        wanderRadius: config?.camera?.wanderRadius ?? 1450,
        wanderWaypoints:
          config?.camera?.wanderWaypoints ?? VIETNAM_WANDER_WAYPOINTS.map((wp) => [...wp]),
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    // 1. Golden-hour Mist Fog
    this.scene.fog = new THREE.FogExp2(
      this.currentConfig.fog.color,
      this.currentConfig.fog.density
    );

    // 2. Golden-Hour Directional Sun + Hemisphere + Ambient Lighting
    this.ambientLight = new THREE.AmbientLight(
      this.currentConfig.lighting.ambient.color,
      this.currentConfig.lighting.ambient.intensity
    );
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#ffe0b5', '#39522e', 0.78);
    this.scene.add(this.hemiLight);

    const dirPos = this.currentConfig.lighting.directional.position;
    this.directionalLight = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.directionalLight.castShadow = this.currentConfig.lighting.directional.castShadow ?? true;
    this.directionalLight.shadow.mapSize.set(
      this.qualitySettings.shadowMapSize,
      this.qualitySettings.shadowMapSize
    );
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 520;
    const hs = this.qualitySettings.shadowFrustumHalfSize;
    this.directionalLight.shadow.camera.left = -hs;
    this.directionalLight.shadow.camera.right = hs;
    this.directionalLight.shadow.camera.top = hs;
    this.directionalLight.shadow.camera.bottom = -hs;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.02;
    this.scene.add(this.directionalLight);

    const sunDir = new THREE.Vector3(dirPos[0], dirPos[1], dirPos[2]).normalize();
    this.sunDirection.copy(sunDir);
    const windArr = this.currentConfig.wind.direction;
    const windDir2D = new THREE.Vector2(windArr[0], windArr[2] ?? windArr[1] ?? 0.45).normalize();

    // 3. PBR Assets + Golden-Hour Sky & PMREM IBL
    const pbrSize =
      this.qualitySettings.tier === 'low' || this.qualitySettings.tier === 'medium' ? 256 : 512;
    const pbr = this.createPbrAssets(renderer, pbrSize);
    const materials = this.createSharedMaterials(pbr);
    this.sharedMaterials = materials;
    const materialLib = new MaterialLibrary(materials);
    this.materialLib = materialLib;
    this.signageAtlas = new SignageAtlas();
    this.sharedShaders = createVietnamSharedShaders();
    const sharedDongSon = createDongSonBronzeTextures(512, renderer);
    this.extraTextures.push(sharedDongSon.map, sharedDongSon.normalMap, sharedDongSon.roughnessMap);
    this.cachedTextures = { dongSon: sharedDongSon };
    for (const mat of Object.values(materials)) {
      if (mat) this.zoneProtectedMaterials.add(mat);
    }
    for (const mat of this.sharedShaders.allMaterials) {
      this.zoneProtectedMaterials.add(mat);
    }
    this.buildSkyAndIBL(renderer, sunDir);

    // 4. Terrain & Fresnel Bay/Lake Water
    this.buildTerrain(sunDir, windDir2D);
    this.buildBayAndLakeWater(sunDir);

    // 5. Iconic Hero Landmarks of Vietnam
    this.buildKhueVanCacAndPlaza(pbr, renderer);
    this.buildOnePillarPagodaAndLotusPond(pbr);
    this.buildTurtleTowerIslet(pbr);
    this.buildGoldenBridgeAndGiantHands(pbr, renderer);
    this.buildHaLongBayAndJunkBoats(pbr, renderer);

    // 5b. 3-Region Grand Vietnam Panorama Landmarks (North, Central & Highlands, South & Islands)
    const builderCtx: VietnamBuilderContext = {
      scene: this.scene,
      renderer,
      pbr,
      materials,
      materialLib,
      signageAtlas: this.signageAtlas,
      sharedShaders: this.sharedShaders,
      cachedTextures: this.cachedTextures,
      exclusionCircles: this.exclusionCircles,
      junkBoats: this.junkBoats,
      extraTextures: this.extraTextures,
      extraMaterials: this.extraMaterials,
      foliageWindUniforms: this.foliageWindUniforms,
      animatedUniforms: this.extraAnimatedUniforms,
      getHeight: getVietnamHeritageHeight,
      getNormal: getVietnamHeritageNormal
    };

    const northResult = buildVietnamNorthLandmarks(builderCtx);
    this.extraAnimatedUniforms.push(...northResult.flagUniforms);

    const centralResult = buildVietnamCentralLandmarks(builderCtx);
    this.extraAnimatedUniforms.push(...centralResult.animatedUniforms);

    const southResult = buildVietnamSouthLandmarks(builderCtx);
    for (const sb of southResult.southernBoats) {
      this.boatBaseYaws.set(sb.group, sb.group.rotation.y);
      this.junkBoats.push(sb);
    }

    this.referenceShowController = buildVietnamReferenceShowUpgrades(builderCtx, {
      deferMacrosToZones: true
    });
    for (const zone of this.referenceShowController.macroZones ?? []) {
      if (zone.exclusions && zone.exclusions.length > 0) {
        this.exclusionCircles.push(...zone.exclusions);
      }
    }

    // Enlarge plaza/waterfront exclusion halos so grass/rice stalks never clip plazas, beaches, or docks
    this.exclusionCircles.push(...VIETNAM_PLAZA_EXCLUSION_HALOS.map((e) => ({ ...e })));

    // 6. Sapa Terraced Rice Fields (after regional exclusionCircles), Bamboo Groves, Trees, Grass, Motes, Incense & Egrets
    this.buildSapaRiceTerraces(pbr);
    this.buildBambooGroves(pbr, windDir2D);
    this.buildFlameAndBanyanTrees(pbr);
    this.buildMeadowGrass(sunDir, windDir2D);
    this.buildGoldenMotes();
    this.buildIncenseSmoke(windDir2D);
    this.buildWhiteEgrets(sunDir);

    this.weatherParticles = createWeatherParticlesSystem({ count: 900, radius: 64 });
    this.scene.add(this.weatherParticles.mesh);

    // 7. CinematicPipeline ('natural' AgXToneMapping, exposure 1.05)
    this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
      defaultStyle: 'natural',
      bloomStrength: 0.28,
      bloomRadius: 0.42,
      bloomThreshold: 0.88,
      kuwaharaEnabled: false
    });
    this.pipeline.setQualityTier(this.qualitySettings.tier);

    // 8. Optimization & Runtime Resource Budgets:
    //    AnimationBus + ZoneStreamer + Material Deduplication + Pooled PointLights + Frustum/Distance Culling + Camera-Following Shadows
    this.animationBus.clear();
    this.animationBus.registerMany(this.sharedShaders.allUniforms);
    this.animationBus.registerMany(this.foliageWindUniforms);
    this.animationBus.registerMany(this.extraAnimatedUniforms);

    this.dedupeProtectedMaterials = new Set<THREE.Material>([
      materials.lanternSilk,
      ...this.sharedShaders.allMaterials
    ]);
    if (materials.lanternCore) this.dedupeProtectedMaterials.add(materials.lanternCore);
    if (this.skyMaterial) this.dedupeProtectedMaterials.add(this.skyMaterial);
    if (this.terrainMaterial) this.dedupeProtectedMaterials.add(this.terrainMaterial);
    if (this.waterMaterial) this.dedupeProtectedMaterials.add(this.waterMaterial);
    if (this.grassMaterial) this.dedupeProtectedMaterials.add(this.grassMaterial);
    if (this.egretMaterial) this.dedupeProtectedMaterials.add(this.egretMaterial);
    if (this.motesMaterial) this.dedupeProtectedMaterials.add(this.motesMaterial);

    this.canonicalMaterialSeeds = [
      materials.stone,
      materials.whitePlaster,
      materials.yellowOchrePlaster,
      materials.crimsonLacquer,
      materials.darkWood,
      materials.terracottaRoof,
      materials.darkRoof,
      materials.chamBrick,
      materials.granite,
      materials.gold,
      materials.bronze,
      materials.darkVoid,
      materials.bark
    ];
    if (materials.jadeRoof) this.canonicalMaterialSeeds.push(materials.jadeRoof);
    if (materials.whiteMarble) this.canonicalMaterialSeeds.push(materials.whiteMarble);
    if (materials.ochreSand) this.canonicalMaterialSeeds.push(materials.ochreSand);

    this.corePostProcessReady = false;
    this.zoneStreamer = new ZoneStreamer({
      mode: this.streamingMode,
      loadRadius: 460,
      unloadRadius: 550,
      maxBuildMsPerFrame: 6,
      onZoneLoaded: (handle) => this.handleZoneLoaded(handle),
      onZoneUnloaded: (handle) => this.handleZoneUnloaded(handle)
    });
    this.zoneStreamer.registerAll(this.referenceShowController.macroZones ?? []);

    if (this.streamingMode === 'all') {
      this.zoneStreamer.loadAllSync((d) => this.makeZoneBuildContext(d));
    }

    for (const jb of this.junkBoats) {
      if (!this.boatBaseYaws.has(jb.group)) {
        this.boatBaseYaws.set(jb.group, jb.group.rotation.y);
      }
    }
    this.updateJunkBoats(0);

    const dedupeRes = dedupeSceneMaterials(
      this.scene,
      this.dedupeProtectedMaterials,
      this.extraMaterials,
      this.canonicalMaterialSeeds
    );
    const solidRes = consolidateSolidMaterialsToVertexColors(
      this.scene,
      this.dedupeProtectedMaterials,
      materialLib,
      this.extraMaterials
    );
    const signageReused = this.signageAtlas.getStats().reusedMaterials;
    const shaderReused = this.sharedShaders.getReusedCount();
    this.lastDedupeSaved =
      dedupeRes.savedCount + solidRes.savedCount + signageReused + shaderReused;

    this.lightBudgetManager.harvestFromScene(
      this.scene,
      this.qualitySettings.maxActivePointLights
    );
    this.visibilityShadowController.initialize(
      this.scene,
      this.directionalLight,
      renderer,
      this.qualitySettings,
      this.sunDirection
    );
    this.corePostProcessReady = true;

    const initialFocus =
      camera && camera.position.lengthSq() >= 1e-6
        ? camera.position
        : this.getSpawnPoint().position;
    if (this.streamingMode === 'proximity') {
      this.zoneStreamer.update(initialFocus, (d) => this.makeZoneBuildContext(d));
      this.lastZoneStreamPos.copy(initialFocus);
      this.lastZoneStreamTime = 0;
    }
    this.lightBudgetManager.update(initialFocus, true);
    this.visibilityShadowController.update(camera, 0, true);
    this.lastPerfPublishTime = -1;

    this.isInitialized = true;
  }

  private makeZoneBuildContext(_desc: ZoneDescriptor): ZoneBuildContext {
    return {
      scene: this.scene,
      renderer: this.boundRenderer ?? undefined,
      scope: new ResourceScope({ protectedMaterials: this.zoneProtectedMaterials }),
      parts: { create: () => new PartsBuilder() },
      materials: this.materialLib!,
      anim: this.animationBus,
      terrain: {
        height: getVietnamHeritageHeight,
        normal: getVietnamHeritageNormal
      },
      rng: mulberry32
    };
  }

  private handleZoneLoaded(handle: ZoneHandle): void {
    const movers = handle.output.movers;
    if (movers && movers.length > 0) {
      for (const jb of movers) {
        if (!this.boatBaseYaws.has(jb.group)) {
          this.boatBaseYaws.set(jb.group, jb.group.rotation.y);
        }
        this.junkBoats.push(jb);
      }
      this.updateJunkBoats(this.sceneElapsedTime);
    }

    let lightIds: string[] = [];
    if (this.corePostProcessReady) {
      const zDedupe = dedupeSceneMaterials(
        handle.output.group,
        this.dedupeProtectedMaterials,
        undefined,
        this.canonicalMaterialSeeds
      );
      const zSolid = this.materialLib
        ? consolidateSolidMaterialsToVertexColors(
          handle.output.group,
          this.dedupeProtectedMaterials,
          this.materialLib
        )
        : { savedCount: 0 };
      this.lastDedupeSaved += zDedupe.savedCount + zSolid.savedCount;
      lightIds = this.lightBudgetManager.harvestFromGroup(handle.output.group);
      this.visibilityShadowController.registerGroup(handle.output.group);
    }
    this.zoneMeta.set(handle.descriptor.id, { lightIds, movers });
  }

  private handleZoneUnloaded(handle: ZoneHandle): void {
    const meta = this.zoneMeta.get(handle.descriptor.id);
    this.zoneMeta.delete(handle.descriptor.id);
    const movers = meta?.movers ?? handle.output.movers;
    if (movers && movers.length > 0) {
      const moverGroups = new Set(movers.map((m) => m.group));
      this.junkBoats = this.junkBoats.filter((jb) => !moverGroups.has(jb.group));
      for (const g of moverGroups) {
        this.boatBaseYaws.delete(g);
      }
    }
    if (this.corePostProcessReady) {
      if (meta && meta.lightIds.length > 0) {
        this.lightBudgetManager.removeByIds(meta.lightIds);
      }
      this.visibilityShadowController.unregisterGroup(handle.output.group);
    }
  }

  private createPbrAssets(renderer?: THREE.WebGLRenderer, texSize = 512) {
    const stone = createStoneMasonryPbrTextures({ size: texSize, seed: 3101, renderer, repeatX: 2, repeatY: 2 });
    const terracotta = createTerracottaRoofPbrTextures({ size: texSize, seed: 4207, variant: 'terracotta', renderer });
    const darkRoof = createTerracottaRoofPbrTextures({ size: texSize, seed: 5311, variant: 'teal', renderer });
    const timber = createTimberBeamPbrTextures({ size: texSize, seed: 6421, renderer });
    const plaster = createPlasterWallPbrTextures({ size: texSize, seed: 7537, renderer, repeatX: 2, repeatY: 2 });
    const granite = createGraniteCliffPbrTextures({ size: texSize, seed: 8641, renderer, repeatX: 3, repeatY: 3 });
    const bark = createOakBarkPbrTextures({ size: texSize, seed: 9743, renderer, repeatX: 4, repeatY: 6 });
    const leafAtlas = createBotanicalLeafAtlasTexture(renderer, texSize);

    this.pbrSets.push(stone, terracotta, darkRoof, timber, plaster, granite, bark);
    this.extraTextures.push(leafAtlas);

    return { stone, terracotta, darkRoof, timber, plaster, granite, bark, leafAtlas };
  }

  private createSharedMaterials(
    pbr: ReturnType<typeof this.createPbrAssets>
  ): VietnamSharedMaterials {
    const stone = new THREE.MeshStandardMaterial({
      color: '#dfd6c5',
      map: pbr.stone.map,
      normalMap: pbr.stone.normalMap,
      roughnessMap: pbr.stone.roughnessMap,
      aoMap: pbr.stone.aoMap,
      roughness: 0.72,
      metalness: 0.05
    });
    const whitePlaster = new THREE.MeshStandardMaterial({
      color: '#f2eadc',
      map: pbr.plaster.map,
      normalMap: pbr.plaster.normalMap,
      roughnessMap: pbr.plaster.roughnessMap,
      roughness: 0.82
    });
    const yellowOchrePlaster = new THREE.MeshStandardMaterial({
      color: '#e0b14b',
      map: pbr.plaster.map,
      normalMap: pbr.plaster.normalMap,
      roughnessMap: pbr.plaster.roughnessMap,
      roughness: 0.78
    });
    const crimsonLacquer = new THREE.MeshStandardMaterial({
      color: '#8e1b14',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.42,
      metalness: 0.08
    });
    const darkWood = new THREE.MeshStandardMaterial({
      color: '#573822',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.72,
      metalness: 0.04
    });
    const terracottaRoof = new THREE.MeshStandardMaterial({
      color: '#b24c32',
      map: pbr.terracotta.map,
      normalMap: pbr.terracotta.normalMap,
      roughnessMap: pbr.terracotta.roughnessMap,
      roughness: 0.66,
      side: THREE.DoubleSide
    });
    const darkRoof = new THREE.MeshStandardMaterial({
      color: '#384546',
      map: pbr.darkRoof.map,
      normalMap: pbr.darkRoof.normalMap,
      roughnessMap: pbr.darkRoof.roughnessMap,
      roughness: 0.66,
      side: THREE.DoubleSide
    });
    const chamBrick = new THREE.MeshStandardMaterial({
      color: '#a4462c',
      map: pbr.terracotta.map,
      normalMap: pbr.terracotta.normalMap,
      roughnessMap: pbr.terracotta.roughnessMap,
      roughness: 0.76,
      metalness: 0.04
    });
    const granite = new THREE.MeshStandardMaterial({
      color: '#8e8982',
      map: pbr.granite.map,
      normalMap: pbr.granite.normalMap,
      roughnessMap: pbr.granite.roughnessMap,
      roughness: 0.82,
      metalness: 0.05
    });
    const gold = new THREE.MeshStandardMaterial({
      color: '#e8b642',
      roughness: 0.26,
      metalness: 0.88
    });
    const bronze = new THREE.MeshStandardMaterial({
      color: '#6e5638',
      roughness: 0.44,
      metalness: 0.68
    });
    const darkVoid = new THREE.MeshStandardMaterial({
      color: '#1b110f',
      roughness: 0.92
    });
    const lanternSilk = new THREE.MeshStandardMaterial({
      color: '#e6301f',
      emissive: '#ff5218',
      emissiveIntensity: 1.95,
      roughness: 0.36
    });
    lanternSilk.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.lanternAnimUniform.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           varying vec3 vLanternWorld;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vLanternWorld = position;
           float sway = sin(uTime * 1.55 + position.x * 0.42 + position.z * 0.31) * 0.032;
           transformed.x += sway;
           transformed.z += cos(uTime * 1.2 + position.z * 0.38) * 0.022;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vLanternWorld;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float ribShade = 0.78 + 0.26 * abs(sin(vLanternWorld.y * 19.0));
           float coreWarm = 0.92 + 0.28 * sin(vLanternWorld.y * 6.0);
           totalEmissiveRadiance *= ribShade * coreWarm;`
        );
    };
    const lanternCore = new THREE.MeshStandardMaterial({
      color: '#fff6cc',
      emissive: '#ffd56b',
      emissiveIntensity: 2.55,
      roughness: 0.25
    });
    lanternSilk.userData.noDedupe = true;
    lanternCore.userData.noDedupe = true;
    this.lanternSilkMaterial = lanternSilk;
    this.lanternCoreMaterial = lanternCore;
    const bark = new THREE.MeshStandardMaterial({
      color: '#5f4938',
      map: pbr.bark.map,
      normalMap: pbr.bark.normalMap,
      roughnessMap: pbr.bark.roughnessMap,
      roughness: 0.90
    });
    const jadeRoof = createJadeTileMaterial(darkRoof);
    const whiteMarble = createWhiteMarbleMaterial();
    const ochreSand = createOchreSandMaterial();

    const materials: VietnamSharedMaterials = {
      stone,
      whitePlaster,
      yellowOchrePlaster,
      crimsonLacquer,
      darkWood,
      terracottaRoof,
      darkRoof,
      chamBrick,
      granite,
      gold,
      bronze,
      darkVoid,
      lanternSilk,
      lanternCore,
      bark,
      jadeRoof,
      whiteMarble,
      ochreSand
    };

    this.extraMaterials.push(
      stone,
      whitePlaster,
      yellowOchrePlaster,
      crimsonLacquer,
      darkWood,
      terracottaRoof,
      darkRoof,
      chamBrick,
      granite,
      gold,
      bronze,
      darkVoid,
      lanternSilk,
      lanternCore,
      bark,
      jadeRoof,
      whiteMarble,
      ochreSand
    );

    for (const mat of Object.values(materials)) {
      if (mat) (mat as THREE.Material).userData.sharedProtected = true;
    }

    return materials;
  }

  private isInsideExclusionCircle(x: number, z: number, extraPadding = 0): boolean {
    for (const ec of this.exclusionCircles) {
      const dx = x - ec.x;
      const dz = z - ec.z;
      const lim = ec.r + extraPadding;
      if (dx * dx + dz * dz < lim * lim) {
        return true;
      }
    }
    return false;
  }

  private isExcluded(x: number, z: number, extraPadding = 0): boolean {
    // Hanoi Central Causeway & Khuê Văn Các -> Hoàng Thành promenade
    if (Math.abs(x) < 15.0 + extraPadding && z > -98 - extraPadding && z < 72 + extraPadding) {
      return true;
    }
    // Mù Cang Chải rice terraces zone
    if (x < -105 + extraPadding && x > -345 - extraPadding && z > -128 - extraPadding && z < 18 + extraPadding) {
      return true;
    }
    // Saigon Grand Heritage Park front lawn & Mũi Cà Mau south highway
    if (Math.abs(x) < 52 + extraPadding && z > 155 && z < 285) {
      return true;
    }
    if (Math.abs(x) < 16 + extraPadding && z > 320 && z < 508) {
      return true;
    }
    return this.isInsideExclusionCircle(x, z, extraPadding);
  }

  private buildSkyAndIBL(renderer: THREE.WebGLRenderer | undefined, sunDir: THREE.Vector3): void {
    const skyGeo = new THREE.SphereGeometry(4200, 64, 32);
    this.skyMaterial = createVietnamSkyMaterial({
      topColor: this.currentConfig?.sky?.topColor,
      bottomColor: this.currentConfig?.sky?.bottomColor,
      horizonColor: this.currentConfig?.sky?.horizonColor,
      sunDirection: sunDir,
      cloudSpeed: this.currentConfig?.sky?.cloudSpeed,
      cloudCoverage: this.currentConfig?.sky?.cloudCoverage
    });
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    skyMesh.name = 'SkyDome';
    this.scene.add(skyMesh);

    this.cloudDome = createVolumetricCloudDome({
      radius: 2200,
      baseY: 130,
      topY: 310,
      coverage: this.currentConfig?.sky?.cloudCoverage ?? 0.62,
      tint: '#ffd7ad',
      sunDirection: sunDir,
      speed: this.currentConfig?.sky?.cloudSpeed ?? 0.55,
      ghibliToon: false
    });
    (this.cloudDome.uniforms.uShadowColor.value as THREE.Color).set('#6b5a78');
    (this.cloudDome.uniforms.uFogColor.value as THREE.Color).set(
      this.currentConfig?.fog?.color ?? '#eab780'
    );
    this.scene.add(this.cloudDome.mesh);

    if (renderer && typeof renderer.getContext === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        const envSky = new Sky();
        envSky.scale.setScalar(10000);
        const u = envSky.material.uniforms;
        u['turbidity'].value = 4.2;
        u['rayleigh'].value = 2.1;
        u['mieCoefficient'].value = 0.008;
        u['mieDirectionalG'].value = 0.86;
        u['sunPosition'].value.copy(sunDir).normalize();
        envScene.add(envSky);

        this.envRenderTarget = pmrem.fromScene(envScene, 0.04);
        this.scene.environment = this.envRenderTarget.texture;
        this.scene.environmentIntensity = 0.78;

        envSky.geometry.dispose();
        envSky.material.dispose();
        pmrem.dispose();
      } catch {
        // Ignore in headless mock test renderers
      }
    }
  }

  private buildTerrain(sunDir: THREE.Vector3, windDir2D: THREE.Vector2): void {
    // Expanded 4800m x 4800m domain centered at (0, 0, 0) covering Inner Core + 14 Outer Macro Cultural Sanctuaries
    const width = 4800;
    const depth = 4800;
    const segs = 384;
    const geo = new THREE.PlaneGeometry(width, depth, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getVietnamHeritageHeight(x, z));
    }
    geo.computeVertexNormals();

    this.terrainMaterial = createVietnamTerrainMaterial(sunDir);
    this.terrainMaterial.uniforms.uWindDirection.value.copy(windDir2D);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.terrainMaterial.uniforms.fogColor.value.copy(this.scene.fog.color);
      this.terrainMaterial.uniforms.fogDensity.value = this.scene.fog.density;
    }

    const mesh = new THREE.Mesh(geo, this.terrainMaterial);
    mesh.name = 'VietnamHeritageTerrain';
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private buildBayAndLakeWater(sunDir: THREE.Vector3): void {
    const geo = new THREE.PlaneGeometry(4800, 4800, 220, 220);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, VIETNAM_WATER_LEVEL, 0);

    this.waterMaterial = createVietnamBayWaterMaterial(sunDir);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.waterMaterial.uniforms.fogColor.value.copy(this.scene.fog.color);
      this.waterMaterial.uniforms.fogDensity.value = this.scene.fog.density;
    }

    const waterMesh = new THREE.Mesh(geo, this.waterMaterial);
    waterMesh.name = 'HaLongAndLotusWater';
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);
  }

  /**
   * Builds Khuê Văn Các (Văn Miếu — Hà Nội) at (0, 0) at true 1:1 proportions (~9.5m tall):
   * 6.8m × 6.8m plinth, 4 OPEN corner square whitewashed brick pillars (1.0m × 1.0m × 3.4m),
   * 8 curved roofs (*lầu vuông 8 mái*), 4 circular golden sunburst windows (1.8m dia),
   * Trống Đồng Đông Sơn plaza medallion (r = 6.5m) at (0, 16), and balustrades to (0, 58).
   */
  private buildKhueVanCacAndPlaza(
    pbr: ReturnType<typeof this.createPbrAssets>,
    renderer?: THREE.WebGLRenderer
  ): void {
    const group = new THREE.Group();
    group.name = 'KhueVanCacComplex';

    const courtY = getVietnamHeritageHeight(0, 0); // 1.45m
    this.exclusionCircles.push({ x: 0, z: 0, r: 18.0 });
    this.exclusionCircles.push({ x: 0, z: 16, r: 12.0 });
    this.exclusionCircles.push({ x: 0, z: 36, r: 11.0 });
    this.exclusionCircles.push({ x: 0, z: 54, r: 14.0 });

    // Materials
    const shared = this.sharedMaterials!;
    const stoneMat = shared.stone;
    const whitePlasterMat = shared.whitePlaster;
    const crimsonLacquerMat = shared.crimsonLacquer;
    const darkRoofMat = shared.darkRoof;
    const goldMat = shared.gold;
    const darkVoidMat = shared.darkVoid;
    const bronzeMat = shared.bronze;
    const carvedLimestoneMat = new THREE.MeshStandardMaterial({
      color: '#eee4d0',
      roughness: 0.54,
      metalness: 0.04
    });

    this.extraMaterials.push(carvedLimestoneMat);

    // 1. Trống Đồng Đông Sơn Plaza Medallion (r = 6.5m) flat on central promenade at (0, 16)
    const dongSon =
      this.cachedTextures?.dongSon ??
      (() => {
        const t = createDongSonBronzeTextures(512, renderer);
        this.extraTextures.push(t.map, t.normalMap, t.roughnessMap);
        return t;
      })();
    const drumPlazaMat = new THREE.MeshStandardMaterial({
      map: dongSon.map,
      normalMap: dongSon.normalMap,
      normalScale: new THREE.Vector2(1.6, 1.6),
      roughnessMap: dongSon.roughnessMap,
      roughness: 0.55,
      metalness: 0.42
    });
    this.extraMaterials.push(drumPlazaMat);

    const drumGeo = new THREE.CylinderGeometry(6.5, 6.7, 0.10, 64);
    const drumMesh = new THREE.Mesh(drumGeo, drumPlazaMat);
    drumMesh.position.set(0, getVietnamHeritageHeight(0, 16) + 0.04, 16);
    drumMesh.receiveShadow = true;
    drumMesh.name = 'DongSonPlazaMedallion';
    group.add(drumMesh);

    // 2. Khuê Văn Các 6.8m × 6.8m Stone Plinth (1.0m high with perimeter steps) at (0, 0)
    const stoneParts: THREE.BufferGeometry[] = [];
    const limestoneParts: THREE.BufferGeometry[] = [];
    const plinthBase = new THREE.BoxGeometry(8.6, 0.50, 8.6);
    plinthBase.translate(0, courtY + 0.05, 0); // bottom -0.20m skirted, top +0.30m
    const plinthMid = new THREE.BoxGeometry(7.7, 0.35, 7.7);
    plinthMid.translate(0, courtY + 0.475, 0); // top +0.65m
    const plinthCap = new THREE.BoxGeometry(6.8, 0.35, 6.8);
    plinthCap.translate(0, courtY + 0.825, 0); // top +1.00m
    stoneParts.push(plinthBase, plinthMid, plinthCap);

    // Ceremonial steps on all 4 sides of the 6.8m × 6.8m plinth
    for (let s = 0; s < 3; s++) {
      const stepW = 3.8;
      const stepY = courtY + 0.16 + s * 0.32;
      const offset = 4.65 - s * 0.55;
      for (const dir of [
        [0, offset, 0],
        [0, -offset, 0],
        [offset, 0, Math.PI * 0.5],
        [-offset, 0, Math.PI * 0.5]
      ]) {
        const st = new THREE.BoxGeometry(stepW, 0.32, 0.65);
        if (dir[2] !== 0) st.rotateY(dir[2]);
        st.translate(dir[0], stepY, dir[1]);
        stoneParts.push(st);
      }
    }

    // Stepped Đông Sơn Stone Promenade Tiers (z = 48, 36, 24.5) & Carved Cream-Limestone Curb Borders
    for (const tz of [48.0, 36.0, 24.5]) {
      const ty = getVietnamHeritageHeight(0, tz);
      const tierW = tz === 48.0 ? 9.6 : 16.6;
      const tierStep = new THREE.BoxGeometry(tierW, 0.24, 1.35);
      tierStep.translate(0, ty + 0.06, tz);
      stoneParts.push(tierStep);

      const curbTrim = new THREE.BoxGeometry(tierW + 0.2, 0.14, 0.28);
      curbTrim.translate(0, ty + 0.18, tz + 0.56);
      limestoneParts.push(curbTrim);
    }

    // Ceremonial Limestone Walkway Borders & Transverse Paver Bands framing the Spawn Terrace (z = 48.5..56.5)
    for (const side of [-1, 1]) {
      const curbRun = new THREE.BoxGeometry(0.38, 0.12, 8.2);
      const midY = getVietnamHeritageHeight(side * 4.5, 52.4);
      curbRun.translate(side * 4.5, midY + 0.04, 52.4);
      limestoneParts.push(curbRun);
    }
    for (const pz of [50.4, 52.8, 55.2]) {
      const py = getVietnamHeritageHeight(0, pz);
      const paverBand = new THREE.BoxGeometry(8.6, 0.055, 0.68);
      paverBand.translate(0, py + 0.025, pz);
      limestoneParts.push(paverBand);
    }

    // Carved Cream-Limestone Step Balustrades with Lotus Finials flanking Khuê Văn Các & foreground steps
    const addCarvedLotusBalustrade = (
      dx: number,
      zFront: number,
      zBack: number,
      finialScale: number
    ) => {
      const yF = getVietnamHeritageHeight(dx, zFront);
      const yB = getVietnamHeritageHeight(dx, zBack);
      const plinth = new THREE.BoxGeometry(0.72, 0.52, Math.abs(zFront - zBack) + 0.55);
      plinth.translate(dx, (yF + yB) * 0.5 + 0.20, (zFront + zBack) * 0.5);
      stoneParts.push(plinth);

      // Smooth carved cream-limestone wave balustrade scroll
      const railCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(dx, yF + 0.54, zFront),
        new THREE.Vector3(dx, yF + 0.88, zFront - (zFront - zBack) * 0.18),
        new THREE.Vector3(dx, (yF + yB) * 0.5 + 0.72, (zFront + zBack) * 0.5),
        new THREE.Vector3(dx, yB + 0.90, zBack + (zFront - zBack) * 0.18),
        new THREE.Vector3(dx, yB + 0.56, zBack)
      ]);
      const railBody = new THREE.TubeGeometry(railCurve, 18, 0.16, 12, false);
      limestoneParts.push(railBody);

      // Front & rear carved cream-limestone newel pedestals topped with sculpted lotus-bud finials
      const frontNewel = new THREE.BoxGeometry(0.62, 0.44, 0.62);
      frontNewel.translate(dx, yF + 0.64, zFront + 0.06);
      limestoneParts.push(frontNewel);
      limestoneParts.push(...createLotusFinialParts(dx, yF + 0.86, zFront + 0.06, finialScale));

      const rearNewel = new THREE.BoxGeometry(0.58, 0.46, 0.58);
      rearNewel.translate(dx, yB + 0.64, zBack - 0.04);
      limestoneParts.push(rearNewel);
      limestoneParts.push(
        ...createLotusFinialParts(dx, yB + 0.87, zBack - 0.04, finialScale * 0.92)
      );
    };
    for (const side of [-1, 1]) {
      addCarvedLotusBalustrade(side * 2.35, 7.6, 4.7, 0.86);
      addCarvedLotusBalustrade(side * 4.5, 50.8, 47.2, 1.08);
    }

    // Four Monumental *Trụ biểu* Ceremonial Stone Pillars with Lotus-Flame Finials
    const truBieuGold: THREE.BufferGeometry[] = [];
    for (const tz of [41.0, 28.0]) {
      for (const side of [-1, 1]) {
        const px = side * 8.5;
        const py = getVietnamHeritageHeight(px, tz);
        const shaft = new THREE.BoxGeometry(0.68, 3.6, 0.68);
        shaft.translate(px, py + 1.8, tz);
        stoneParts.push(shaft);

        const capBox = new THREE.BoxGeometry(0.92, 0.34, 0.92);
        capBox.translate(px, py + 3.72, tz);
        limestoneParts.push(capBox);

        const lotusBase = new THREE.CylinderGeometry(0.28, 0.38, 0.32, 8);
        lotusBase.translate(px, py + 4.02, tz);
        truBieuGold.push(lotusBase);

        const flameBud = new THREE.ConeGeometry(0.22, 0.56, 8);
        flameBud.translate(px, py + 4.44, tz);
        truBieuGold.push(flameBud);
      }
    }

    // Four Monumental Bronze Incense Tripods (*Đỉnh đồng ba chân*) on Carved Limestone Pedestals
    const bronzeParts: THREE.BufferGeometry[] = [];
    const tripodGold: THREE.BufferGeometry[] = [];
    for (const [ux, uz, uScale] of [
      [-5.8, 22.5, 1.05],
      [5.8, 22.5, 1.05],
      [-3.35, 51.4, 0.92],
      [3.35, 51.4, 0.92]
    ] as const) {
      const uy = getVietnamHeritageHeight(ux, uz);
      const tripod = createBronzeIncenseTripodParts(ux, uy, uz, uScale);
      limestoneParts.push(...tripod.limestoneParts);
      bronzeParts.push(...tripod.bronzeParts);
      tripodGold.push(...tripod.goldParts);
      this.incenseSources.push({ x: ux, y: tripod.smokeY, z: uz, scale: uScale * 0.95 });
    }

    // Twin Foreground Ceremonial Lotus Ponds shifted inward (±9.4, z = 43.0..54.0) & lush with blooming pink lotuses
    const basinWaterMat = new THREE.MeshStandardMaterial({
      color: '#0e3c34',
      roughness: 0.14,
      metalness: 0.28
    });
    const fgPadMat = new THREE.MeshStandardMaterial({
      color: '#2e7d3b',
      roughness: 0.54,
      side: THREE.DoubleSide
    });
    const fgStemMat = new THREE.MeshStandardMaterial({
      color: '#2c6831',
      roughness: 0.62
    });
    const fgLotusMat = new THREE.MeshStandardMaterial({
      color: '#f78fb5',
      emissive: '#591630',
      emissiveIntensity: 0.38,
      roughness: 0.40
    });
    const fgLotusCoreMat = new THREE.MeshStandardMaterial({
      color: '#f5c542',
      emissive: '#6e490a',
      emissiveIntensity: 0.25,
      roughness: 0.45
    });
    this.extraMaterials.push(basinWaterMat, fgPadMat, fgStemMat, fgLotusMat, fgLotusCoreMat);

    const fgWaterParts: THREE.BufferGeometry[] = [];
    const fgPadParts: THREE.BufferGeometry[] = [];
    const fgStemParts: THREE.BufferGeometry[] = [];
    const fgLotusParts: THREE.BufferGeometry[] = [];
    const fgLotusCoreParts: THREE.BufferGeometry[] = [];
    const fgRand = mulberry32(771122);
    const lanternPositions: THREE.Vector3[] = [];

    for (const side of [-1, 1]) {
      const bx = side * 9.4;
      const bz = 48.5;
      const by = getVietnamHeritageHeight(bx, bz);
      const waterY = by + 0.28;
      this.exclusionCircles.push({ x: bx, z: bz, r: 6.2 });

      // Low sculpted cream-limestone coping rim (7.6m × 11.0m) over masonry skirt so water & lotuses stay clearly visible
      for (const sz of [-5.3, 5.3]) {
        const baseZ = new THREE.BoxGeometry(7.8, 0.26, 0.44);
        baseZ.translate(bx, by + 0.03, bz + sz);
        stoneParts.push(baseZ);

        const capZ = new THREE.BoxGeometry(7.9, 0.16, 0.52);
        capZ.translate(bx, by + 0.24, bz + sz);
        limestoneParts.push(capZ);
      }
      for (const sx of [-3.65, 3.65]) {
        const baseX = new THREE.BoxGeometry(0.44, 0.26, 11.0);
        baseX.translate(bx + sx, by + 0.03, bz);
        stoneParts.push(baseX);

        const capX = new THREE.BoxGeometry(0.52, 0.16, 11.1);
        capX.translate(bx + sx, by + 0.24, bz);
        limestoneParts.push(capX);
      }

      // Corner lotus bollards & inner-rear corner lanterns framing the ponds
      for (const sz of [-5.3, 5.3]) {
        for (const sx of [-3.65, 3.65]) {
          const cx = bx + sx;
          const cz = bz + sz;
          const cornerPost = new THREE.BoxGeometry(0.58, 0.54, 0.58);
          cornerPost.translate(cx, by + 0.27, cz);
          limestoneParts.push(cornerPost);
          const isInnerRearCorner = sz === -5.3 && sx * side < 0;
          if (isInnerRearCorner) {
            lanternPositions.push(new THREE.Vector3(cx, by + 0.54, cz));
          } else {
            limestoneParts.push(...createLotusFinialParts(cx, by + 0.54, cz, 0.72));
          }
        }
      }

      const waterSurf = new THREE.PlaneGeometry(7.0, 10.4);
      waterSurf.rotateX(-Math.PI * 0.5);
      waterSurf.translate(bx, waterY, bz);
      fgWaterParts.push(waterSurf);

      // Lush lotus pads (floating + elevated cupped stems)
      for (let k = 0; k < 56; k++) {
        const px = bx + (fgRand() - 0.5) * 5.8;
        const pz = bz + (fgRand() - 0.5) * 9.0;
        const padR = 0.26 + fgRand() * 0.22;
        const pad = new THREE.CircleGeometry(padR, 12, 0.2, Math.PI * 1.82);
        pad.rotateX(-Math.PI * 0.5);
        pad.rotateY(fgRand() * Math.PI * 2);
        const elevated = k % 3 === 0 ? 0.09 + fgRand() * 0.13 : 0.015 + fgRand() * 0.012;
        if (elevated > 0.05) {
          pad.rotateZ((fgRand() - 0.5) * 0.18);
          const leafStem = new THREE.CylinderGeometry(0.011, 0.015, elevated + 0.10, 5);
          leafStem.translate(px, waterY + (elevated - 0.10) * 0.5, pz);
          fgStemParts.push(leafStem);
        }
        pad.translate(px, waterY + elevated, pz);
        fgPadParts.push(pad);
      }

      // 30 sculpted multi-petal blooming pink lotus flowers per pond (60 total!)
      for (let f = 0; f < 30; f++) {
        const fx = bx + (fgRand() - 0.5) * 5.4;
        const fz = bz + (fgRand() - 0.5) * 8.6;
        const stemH = 0.14 + fgRand() * 0.28;
        const scale = 0.95 + fgRand() * 0.42;
        const openness = 0.35 + fgRand() * 0.65;
        const flower = createForegroundLotusFlowerParts(
          fx,
          waterY,
          fz,
          stemH,
          scale,
          openness,
          fgRand() * Math.PI * 2
        );
        fgStemParts.push(...flower.stemParts);
        fgLotusParts.push(...flower.petalParts);
        fgLotusCoreParts.push(...flower.coreParts);
      }
    }

    // Ceremonial Stone Balustrades extending along causeway (ending cleanly at z = 40 behind the lotus ponds)
    const addBalustradeRun = (zStart: number, zEnd: number, stepZ: number) => {
      for (let z = zStart; z <= zEnd + 0.01; z += stepZ) {
        for (const side of [-1, 1]) {
          const px = side * 8.5;
          const py = getVietnamHeritageHeight(px, z);
          const post = new THREE.BoxGeometry(0.46, 1.25, 0.46);
          post.translate(px, py + 0.60, z);
          stoneParts.push(post);

          const cap = new THREE.BoxGeometry(0.60, 0.16, 0.60);
          cap.translate(px, py + 1.28, z);
          limestoneParts.push(cap);

          if (z + stepZ <= zEnd + 0.01) {
            const nextZ = z + stepZ;
            const nextY = getVietnamHeritageHeight(px, nextZ);
            const len = Math.hypot(stepZ, nextY - py);
            const rail = new THREE.BoxGeometry(0.20, 0.18, len);
            rail.rotateX(Math.atan2(py - nextY, stepZ));
            rail.translate(px, (py + nextY) * 0.5 + 0.92, (z + nextZ) * 0.5);
            stoneParts.push(rail);
          }

          lanternPositions.push(new THREE.Vector3(px, py + 1.36, z));
        }
      }
    };
    addBalustradeRun(-10, 14, 6.0);
    addBalustradeRun(28, 40, 6.0);

    const signageCtx = {
      extraTextures: this.extraTextures,
      extraMaterials: this.extraMaterials,
      signageAtlas: this.signageAtlas ?? undefined
    };

    // 3. 4 OPEN Corner Square Whitewashed Brick Pillars (1.0m × 1.0m × 3.4m tall) — true open walk-through!
    const plinthTop = courtY + 1.0;
    const plasterParts: THREE.BufferGeometry[] = [];
    const pierOffsets = [
      [-2.45, -2.45],
      [2.45, -2.45],
      [-2.45, 2.45],
      [2.45, 2.45]
    ];
    for (const [ox, oz] of pierOffsets) {
      const pier = new THREE.BoxGeometry(1.0, 3.4, 1.0);
      pier.translate(ox, plinthTop + 1.7, oz);
      plasterParts.push(pier);

      // Stepped carved stone pier base & ornamental recessed frame trim
      const base = new THREE.BoxGeometry(1.24, 0.30, 1.24);
      base.translate(ox, plinthTop + 0.15, oz);
      limestoneParts.push(base);

      const midBand = new THREE.BoxGeometry(1.08, 0.12, 1.08);
      midBand.translate(ox, plinthTop + 1.70, oz);
      plasterParts.push(midBand);

      const cap = new THREE.BoxGeometry(1.18, 0.22, 1.18);
      cap.translate(ox, plinthTop + 3.29, oz);
      plasterParts.push(cap);
    }

    // Open perimeter ring lintel beams tying the 4 pillars together (hollow underneath so sky/walk-through is 100% open)
    const beamY = plinthTop + 3.46;
    for (const side of [-1, 1]) {
      const beamZ = new THREE.BoxGeometry(5.9, 0.26, 0.88);
      beamZ.translate(0, beamY, side * 2.45);
      plasterParts.push(beamZ);

      const beamX = new THREE.BoxGeometry(0.88, 0.26, 5.9);
      beamX.translate(side * 2.45, beamY, 0);
      plasterParts.push(beamX);
    }

    // 4. Lower 4 Curved Eaves (4 lower roofs of *lầu vuông 8 mái*)
    const roof1Y = plinthTop + 3.50;
    const roof1Geo = createVietnameseCurvedRoofGeometry(8.8, 8.8, 5.4, 5.4, 1.15, 0.42);
    roof1Geo.translate(0, roof1Y, 0);

    // 5. Upper Tier (Gác Khuê Văn — Crimson Lacquered Pavilion + 4 Circular Sunburst Windows 1.8m dia!)
    const upperFloorY = plinthTop + 3.55;
    const crimsonParts: THREE.BufferGeometry[] = [];
    const voidParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const extraRoofParts: THREE.BufferGeometry[] = [roof1Geo];

    // Upper floor wooden deck (sits above the open ceiling beams)
    const upperDeck = new THREE.BoxGeometry(5.8, 0.22, 5.8);
    upperDeck.translate(0, upperFloorY + 0.11, 0);
    crimsonParts.push(upperDeck);

    // 12 crimson wooden columns supporting upper pavilion & balcony
    for (const [cx, cz] of [
      [-2.35, -2.35],
      [2.35, -2.35],
      [-2.35, 2.35],
      [2.35, 2.35],
      [-0.95, 2.35],
      [0.95, 2.35],
      [-0.95, -2.35],
      [0.95, -2.35],
      [2.35, -0.95],
      [2.35, 0.95],
      [-2.35, -0.95],
      [-2.35, 0.95]
    ]) {
      const col = new THREE.CylinderGeometry(0.11, 0.13, 2.65, 12);
      col.translate(cx, upperFloorY + 1.42, cz);
      crimsonParts.push(col);
    }

    // Connected wooden *con tiện* spindle balustrades on all 4 sides of upper floor balcony
    const balY = upperFloorY + 0.22;
    crimsonParts.push(
      ...createPiercedBalustradeParts(-2.78, 2.78, 2.78, 2.78, balY, 0.78, 'con_tien'),
      ...createPiercedBalustradeParts(-2.78, -2.78, 2.78, -2.78, balY, 0.78, 'con_tien'),
      ...createPiercedBalustradeParts(-2.78, -2.78, -2.78, 2.78, balY, 0.78, 'con_tien'),
      ...createPiercedBalustradeParts(2.78, -2.78, 2.78, 2.78, balY, 0.78, 'con_tien')
    );

    // Upper chamber crimson corner walls & pierced circular sunburst window frames (open so interior is visible!)
    const wallHalf = 2.15;
    const wallH = 2.55;
    const wallThick = 0.24;
    for (const [cxw, czw, ryw] of [
      [0, wallHalf - wallThick * 0.5, 0],
      [0, -(wallHalf - wallThick * 0.5), Math.PI],
      [wallHalf - wallThick * 0.5, 0, Math.PI * 0.5],
      [-(wallHalf - wallThick * 0.5), 0, -Math.PI * 0.5]
    ]) {
      // Corner pilasters & top/bottom spandrels framing the 1.8m circular aperture
      for (const sx of [-1.42, 1.42]) {
        const pil = new THREE.BoxGeometry(1.15, wallH, wallThick);
        pil.rotateY(ryw);
        pil.translate(cxw, upperFloorY + 1.40, czw);
        const off = new THREE.Vector3(sx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ryw);
        pil.translate(off.x, 0, off.z);
        crimsonParts.push(pil);

        // Recessed shadow backing panel inside upper corner wall reveal
        const recess = new THREE.BoxGeometry(0.42, 1.55, 0.06);
        recess.rotateY(ryw);
        recess.translate(cxw + off.x, upperFloorY + 1.40, czw + off.z);
        voidParts.push(recess);
      }
      for (const sy of [-1.05, 1.05]) {
        const spandrel = new THREE.BoxGeometry(1.85, 0.42, wallThick);
        spandrel.rotateY(ryw);
        spandrel.translate(cxw, upperFloorY + 1.40 + sy, czw);
        crimsonParts.push(spandrel);
      }
    }

    const winCenterY = upperFloorY + 1.42;

    // Upper Pavilion Interior (visible through the 4 open circular sunburst windows):
    // Coffered tie-beams, crimson-and-gold ceremonial altar table, sculpted Bronze Bell & warm altar lamp
    const altarBase = new THREE.BoxGeometry(1.45, 0.88, 0.82);
    altarBase.translate(0, upperFloorY + 0.66, 0);
    crimsonParts.push(altarBase);
    const altarTrim = new THREE.BoxGeometry(1.52, 0.08, 0.88);
    altarTrim.translate(0, upperFloorY + 1.12, 0);
    goldParts.push(altarTrim);

    // Interior coffered crimson ceiling cross-beams
    for (const off of [-1.05, 0, 1.05]) {
      const bX = new THREE.BoxGeometry(3.8, 0.14, 0.14);
      bX.translate(0, upperFloorY + 2.50, off);
      const bZ = new THREE.BoxGeometry(0.14, 0.14, 3.8);
      bZ.translate(off, upperFloorY + 2.50, 0);
      crimsonParts.push(bX, bZ);
    }

    // Suspended sculpted bronze temple bell (*Chuông đồng Khuê Văn Các*) & warm glowing altar lamp
    bronzeParts.push(...createBronzeBellParts(0, upperFloorY + 1.66, 0, 0.56));
    const innerLampMat = new THREE.MeshStandardMaterial({
      color: '#ffb347',
      emissive: new THREE.Color('#ff9e2c'),
      emissiveIntensity: 2.2,
      roughness: 0.3
    });
    this.extraMaterials.push(innerLampMat);
    const innerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), innerLampMat);
    innerLamp.position.set(0, upperFloorY + 1.28, 0);
    group.add(innerLamp);

    // Readable "KHUÊ VĂN CÁC" gold/crimson royal plaques (South & North) + flanking vertical câu đối boards
    const khueVanPlaqueS = createSignagePlaqueMesh(
      {
        text: 'KHUÊ VĂN CÁC',
        subText: '奎 文 閣',
        width: 2.15,
        height: 0.62,
        depth: 0.10,
        style: 'royal',
        motifSeed: 108
      },
      signageCtx
    );
    khueVanPlaqueS.position.set(0, upperFloorY + 2.48, 2.38);
    group.add(khueVanPlaqueS);

    const khueVanPlaqueN = createSignagePlaqueMesh(
      {
        text: 'KHUÊ VĂN CÁC',
        subText: 'VĂN MIẾU HÀ NỘI',
        width: 2.05,
        height: 0.58,
        depth: 0.10,
        style: 'royal',
        motifSeed: 109
      },
      signageCtx
    );
    khueVanPlaqueN.position.set(0, upperFloorY + 2.48, -2.38);
    khueVanPlaqueN.rotation.y = Math.PI;
    group.add(khueVanPlaqueN);

    for (const [side, line1, line2, seed] of [
      [-1, 'HIỀN TÀI', 'NGUYÊN KHÍ', 111],
      [1, 'VĂN HIẾN', 'QUỐC GIA', 112]
    ] as const) {
      const cauDoiBoard = createSignagePlaqueMesh(
        {
          text: line1,
          subText: line2,
          width: 0.42,
          height: 1.72,
          depth: 0.08,
          style: 'royal',
          motifSeed: seed
        },
        signageCtx
      );
      cauDoiBoard.position.set(side * 1.65, upperFloorY + 1.44, 2.42);
      group.add(cauDoiBoard);
    }

    // 4 Circular Golden Sunburst Windows (*Cửa sổ Mặt Trời*, 1.8m dia)
    const windowFaces = [
      { x: 0, z: 2.18, ry: 0 },
      { x: 0, z: -2.18, ry: Math.PI },
      { x: 2.18, z: 0, ry: Math.PI * 0.5 },
      { x: -2.18, z: 0, ry: -Math.PI * 0.5 }
    ];
    for (const wf of windowFaces) {
      const outX = Math.sin(wf.ry) * 0.055;
      const outZ = Math.cos(wf.ry) * 0.055;

      const outerRing = new THREE.TorusGeometry(0.90, 0.085, 12, 32);
      outerRing.rotateY(wf.ry);
      outerRing.translate(wf.x + outX, winCenterY, wf.z + outZ);
      goldParts.push(outerRing);

      const innerRing = new THREE.TorusGeometry(0.30, 0.06, 10, 24);
      innerRing.rotateY(wf.ry);
      innerRing.translate(wf.x + outX, winCenterY, wf.z + outZ);
      goldParts.push(innerRing);

      for (let r = 0; r < 8; r++) {
        const spokeAngle = (r / 8) * Math.PI * 2;
        const spoke = new THREE.CylinderGeometry(0.038, 0.050, 0.60, 8);
        spoke.translate(0, 0.60, 0);
        spoke.rotateZ(spokeAngle);
        spoke.rotateY(wf.ry);
        spoke.translate(wf.x + outX, winCenterY, wf.z + outZ);
        goldParts.push(spoke);
      }
    }

    // Upper 4 Curved Hipped Roofs (4 upper roofs of *lầu vuông 8 mái*) + Sculpted Ridge Finials (~9.5m total)
    const roof2Y = upperFloorY + 2.65;
    const roof2Geo = createVietnameseCurvedRoofGeometry(7.6, 7.6, 1.2, 1.2, 1.75, 0.48);
    roof2Geo.translate(0, roof2Y, 0);
    const ridgeGeo = new THREE.BoxGeometry(1.5, 0.20, 0.26);
    ridgeGeo.translate(0, roof2Y + 1.78, 0);
    extraRoofParts.push(roof2Geo, ridgeGeo);

    const kvcFinials = createRoofFinialSetParts(0, roof2Y + 1.84, 0, 1.9, 0, 0.68, true);
    crimsonParts.push(...kvcFinials.mainParts);
    goldParts.push(...kvcFinials.goldParts, ...truBieuGold, ...tripodGold);

    // 6. GIẾNG THIÊN QUANG (Well of Heavenly Clarity — 22m × 22m square pond right behind Khuê Văn Các at (0, -24))
    const wellCx = 0.0;
    const wellCz = -24.0;
    const wellY = getVietnamHeritageHeight(wellCx, wellCz);
    const wellHalf = 11.0;
    this.exclusionCircles.push({ x: wellCx, z: wellCz, r: 15.0 });

    // Paved stone perimeter promenade surrounding Giếng Thiên Quang
    const wellDeck = new THREE.BoxGeometry(27.2, 0.45, 27.2);
    wellDeck.translate(wellCx, wellY - 0.08, wellCz);
    stoneParts.push(wellDeck);

    // Raised coping rim walls (22m × 22m) framing dark emerald mirror water
    const rimThick = 0.62;
    for (const sz of [-1, 1]) {
      const copingZ = new THREE.BoxGeometry(wellHalf * 2 + rimThick, 0.56, rimThick);
      copingZ.translate(wellCx, wellY + 0.16, wellCz + sz * wellHalf);
      limestoneParts.push(copingZ);
    }
    for (const sx of [-1, 1]) {
      const copingX = new THREE.BoxGeometry(rimThick, 0.56, wellHalf * 2 + rimThick);
      copingX.translate(wellCx + sx * wellHalf, wellY + 0.16, wellCz);
      limestoneParts.push(copingX);
    }

    // Pierced brick/stone *chữ Vạn* balustrade enclosing all 4 sides of Giếng Thiên Quang
    const wellBalY = wellY + 0.44;
    stoneParts.push(
      ...createPiercedBalustradeParts(wellCx - wellHalf, wellCz + wellHalf, wellCx + wellHalf, wellCz + wellHalf, wellBalY, 0.84, 'chu_van'),
      ...createPiercedBalustradeParts(wellCx - wellHalf, wellCz - wellHalf, wellCx + wellHalf, wellCz - wellHalf, wellBalY, 0.84, 'chu_van'),
      ...createPiercedBalustradeParts(wellCx - wellHalf, wellCz - wellHalf, wellCx - wellHalf, wellCz + wellHalf, wellBalY, 0.84, 'chu_van'),
      ...createPiercedBalustradeParts(wellCx + wellHalf, wellCz - wellHalf, wellCx + wellHalf, wellCz + wellHalf, wellBalY, 0.84, 'chu_van')
    );

    // Dark emerald mirror water plane inside Giếng Thiên Quang
    const wellWater = new THREE.PlaneGeometry(wellHalf * 2 - 0.55, wellHalf * 2 - 0.55);
    wellWater.rotateX(-Math.PI * 0.5);
    wellWater.translate(wellCx, wellY + 0.34, wellCz);
    fgWaterParts.push(wellWater);

    // 4 Corner Carved Stone Bonsai Pots around Giếng Thiên Quang
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const bx = wellCx + sx * (wellHalf + 1.45);
        const bz = wellCz + sz * (wellHalf + 1.45);
        const potPed = new THREE.BoxGeometry(1.15, 0.42, 1.15);
        potPed.translate(bx, wellY + 0.35, bz);
        limestoneParts.push(potPed);

        const potBowl = new THREE.CylinderGeometry(0.68, 0.48, 0.46, 8);
        potBowl.translate(bx, wellY + 0.78, bz);
        crimsonParts.push(potBowl);

        // Sculpted bonsai trunk & tiered foliage clouds
        const bonsaiTrunk = new THREE.CylinderGeometry(0.08, 0.14, 0.88, 7);
        bonsaiTrunk.rotateZ(sx * 0.22);
        bonsaiTrunk.translate(bx, wellY + 1.32, bz);
        bronzeParts.push(bonsaiTrunk);

        for (let tier = 0; tier < 3; tier++) {
          const pad = createSculptedRockGeometry(
            610 + tier * 13 + (sx > 0 ? 1 : 0) + (sz > 0 ? 2 : 0),
            0.55 - tier * 0.10,
            0.22,
            0.52 - tier * 0.08,
            1
          );
          pad.translate(
            bx + sx * (0.18 - tier * 0.14),
            wellY + 1.56 + tier * 0.28,
            bz + sz * (tier % 2 === 0 ? 0.12 : -0.10)
          );
          fgPadParts.push(pad);
        }
      }
    }

    // 7. EXPANDED HAI NHÀ BIA TIẾN SĨ (22m deep × 2 pavilions = 32 Carved Turtle Stelae flanking Giếng Thiên Quang)
    for (const side of [-1, 1]) {
      const sx = side * 21.5;
      const sz = -24.0;
      const sy = getVietnamHeritageHeight(sx, sz);
      this.exclusionCircles.push(
        { x: sx, z: sz - 5.5, r: 8.5 },
        { x: sx, z: sz + 5.5, r: 8.5 }
      );

      // Grounded 22m-deep stone platform plinth (-0.8m skirt)
      const stPlinth = new THREE.BoxGeometry(6.0, 1.16, 22.0);
      stPlinth.translate(sx, sy - 0.22, sz);
      stoneParts.push(stPlinth);
      const stCurb = new THREE.BoxGeometry(6.3, 0.16, 22.3);
      stCurb.translate(sx, sy + 0.40, sz);
      limestoneParts.push(stCurb);

      // 12 Crimson lacquered pavilion columns (2 × 6) + eaves tie beams
      for (const ox of [-2.35, 2.35]) {
        for (let rz = 0; rz < 6; rz++) {
          const czCol = sz - 9.6 + rz * 3.84;
          const col = new THREE.CylinderGeometry(0.14, 0.16, 3.45, 10);
          col.translate(sx + ox, sy + 2.15, czCol);
          crimsonParts.push(col);
          const colBase = new THREE.CylinderGeometry(0.22, 0.28, 0.26, 10);
          colBase.translate(sx + ox, sy + 0.56, czCol);
          limestoneParts.push(colBase);
        }
        const sideBeam = new THREE.BoxGeometry(0.20, 0.22, 19.6);
        sideBeam.translate(sx + ox, sy + 3.82, sz);
        crimsonParts.push(sideBeam);
      }

      // Traditional curved tiled roof over expanded 22m Nhà Bia + ridge finials
      const biaRoof = createVietnameseCurvedRoofGeometry(7.2, 23.6, 2.0, 18.2, 2.05, 0.42);
      biaRoof.translate(sx, sy + 3.82, sz);
      extraRoofParts.push(biaRoof);

      const biaFinials = createRoofFinialSetParts(
        sx,
        sy + 5.88,
        sz,
        16.8,
        Math.PI * 0.5,
        0.65,
        false
      );
      crimsonParts.push(...biaFinials.mainParts);
      goldParts.push(...biaFinials.goldParts);

      // 16 Carved Stone Turtles carrying Doctors' Stelae per pavilion (32 total!), facing Giếng Thiên Quang
      const turtleRotY = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
      for (let t = 0; t < 16; t++) {
        const colIdx = t % 2;
        const rowIdx = Math.floor(t / 2);
        const tx = sx + (colIdx === 0 ? -1.12 : 1.12);
        const tz = sz - 8.75 + rowIdx * 2.50;
        const tBaseY = sy + 0.48;
        stoneParts.push(...createCarvedTurtleSteleParts(tx, tBaseY, tz, turtleRotY, 0.90));
      }
    }

    // 8. ĐẠI THÀNH MÔN (3-Bay Crimson Ceremonial Gate at (0, -40) north of Giếng Thiên Quang)
    const dtmZ = -40.0;
    const dtmY = getVietnamHeritageHeight(0, dtmZ);
    this.exclusionCircles.push({ x: 0, z: dtmZ, r: 10.5 });

    const dtmPlinth = new THREE.BoxGeometry(14.8, 1.0, 5.4);
    dtmPlinth.translate(0, dtmY - 0.14, dtmZ);
    stoneParts.push(dtmPlinth);
    const dtmCurb = new THREE.BoxGeometry(15.2, 0.14, 5.7);
    dtmCurb.translate(0, dtmY + 0.38, dtmZ);
    limestoneParts.push(dtmCurb);

    // 3 open bays: 8 crimson columns (4 along X × 2 along Z) + lintels + outer lattice screens
    for (const cxCol of [-6.0, -2.15, 2.15, 6.0]) {
      for (const oz of [-1.75, 1.75]) {
        const col = new THREE.CylinderGeometry(0.17, 0.20, 3.65, 10);
        col.translate(cxCol, dtmY + 2.25, dtmZ + oz);
        crimsonParts.push(col);

        const drumBase = new THREE.CylinderGeometry(0.28, 0.34, 0.26, 10);
        drumBase.translate(cxCol, dtmY + 0.54, dtmZ + oz);
        limestoneParts.push(drumBase);
      }
      const tie = new THREE.BoxGeometry(0.20, 0.24, 3.9);
      tie.translate(cxCol, dtmY + 3.96, dtmZ);
      crimsonParts.push(tie);
    }
    for (const oz of [-1.75, 1.75]) {
      const lintel = new THREE.BoxGeometry(12.6, 0.28, 0.26);
      lintel.translate(0, dtmY + 3.98, dtmZ + oz);
      crimsonParts.push(lintel);
    }
    // Flanking whitewashed brick end walls + swung-open crimson timber gate doors on side bays
    for (const side of [-1, 1]) {
      const endWall = new THREE.BoxGeometry(0.42, 3.55, 3.8);
      endWall.translate(side * 6.35, dtmY + 2.22, dtmZ);
      plasterParts.push(endWall);

      const gateLeaf = new THREE.BoxGeometry(1.15, 2.55, 0.12);
      gateLeaf.rotateY(side * 0.55);
      gateLeaf.translate(side * 3.15, dtmY + 1.72, dtmZ + 0.72);
      crimsonParts.push(gateLeaf);

      // Guardian stone Nghê flanking the South approach to Đại Thành Môn
      stoneParts.push(...createGuardianBeastParts(side * 3.85, dtmY, dtmZ + 3.55, 0, 0.96, 'nghe'));
    }

    const dtmRoof = createVietnameseCurvedRoofGeometry(16.4, 7.6, 9.6, 1.5, 2.15, 0.46);
    dtmRoof.translate(0, dtmY + 4.02, dtmZ);
    extraRoofParts.push(dtmRoof);

    const dtmFinials = createRoofFinialSetParts(0, dtmY + 6.18, dtmZ, 8.8, 0, 0.82, true);
    crimsonParts.push(...dtmFinials.mainParts);
    goldParts.push(...dtmFinials.goldParts);

    const dtmPlaque = createSignagePlaqueMesh(
      {
        text: 'ĐẠI THÀNH MÔN',
        subText: '大 成 門',
        width: 2.85,
        height: 0.78,
        depth: 0.12,
        style: 'royal',
        motifSeed: 121
      },
      signageCtx
    );
    dtmPlaque.position.set(0, dtmY + 3.72, dtmZ + 1.92);
    group.add(dtmPlaque);

    // 9. VĂN MIẾU MÔN CEREMONIAL GATE PILLARS (*Tứ Trụ*) at (0, 62) — keeping spawn (0, 58) 100% unobstructed!
    const vmmZ = 62.5;
    const vmmY = getVietnamHeritageHeight(0, vmmZ);
    this.exclusionCircles.push({ x: 0, z: vmmZ, r: 10.5 });

    for (const side of [-1, 1]) {
      // Inner monumental ceremonial pillar (*Trụ biểu chính*, 6.6m tall) leaving wide 8.6m clear central portal
      const inX = side * 4.6;
      const inBase = new THREE.BoxGeometry(1.55, 0.72, 1.55);
      inBase.translate(inX, vmmY + 0.24, vmmZ);
      stoneParts.push(inBase);

      const inShaft = new THREE.BoxGeometry(1.06, 5.4, 1.06);
      inShaft.translate(inX, vmmY + 3.25, vmmZ);
      plasterParts.push(inShaft);

      const inCap = new THREE.BoxGeometry(1.38, 0.36, 1.38);
      inCap.translate(inX, vmmY + 6.08, vmmZ);
      limestoneParts.push(inCap);

      // Sculpted stone Nghê crowning inner Văn Miếu Môn pillars
      stoneParts.push(...createGuardianBeastParts(inX, vmmY + 6.26, vmmZ, side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0.72, 'nghe'));

      // Outer secondary ceremonial pillar (*Trụ phụ*, 5.0m tall)
      const outX = side * 9.2;
      const outBase = new THREE.BoxGeometry(1.32, 0.62, 1.32);
      outBase.translate(outX, vmmY + 0.20, vmmZ);
      stoneParts.push(outBase);

      const outShaft = new THREE.BoxGeometry(0.88, 4.1, 0.88);
      outShaft.translate(outX, vmmY + 2.50, vmmZ);
      plasterParts.push(outShaft);

      const outCap = new THREE.BoxGeometry(1.18, 0.30, 1.18);
      outCap.translate(outX, vmmY + 4.66, vmmZ);
      limestoneParts.push(outCap);
      limestoneParts.push(...createLotusFinialParts(outX, vmmY + 4.82, vmmZ, 1.05));

      // Flanking pierced brick screen wall + tiled coping connecting inner & outer pillars
      const wallMidX = side * 6.9;
      const screenWall = new THREE.BoxGeometry(3.8, 2.35, 0.44);
      screenWall.translate(wallMidX, vmmY + 1.18, vmmZ);
      plasterParts.push(screenWall);

      stoneParts.push(
        ...createPiercedBalustradeParts(
          side < 0 ? outX + 0.48 : inX + 0.56,
          vmmZ,
          side < 0 ? inX - 0.56 : outX - 0.48,
          vmmZ,
          vmmY + 2.36,
          0.68,
          'chu_van'
        )
      );

      const wingRoof = createVietnameseCurvedRoofGeometry(4.4, 1.45, 3.2, 0.25, 0.75, 0.22);
      wingRoof.translate(wallMidX, vmmY + 3.04, vmmZ);
      extraRoofParts.push(wingRoof);

      // Vertical gold-on-crimson ceremonial pillar calligraphy plaques facing spawn
      const pillarPlaque = createSignagePlaqueMesh(
        {
          text: side < 0 ? 'VĂN MIẾU' : 'QUỐC TỬ',
          subText: side < 0 ? 'MÔN' : 'GIÁM',
          width: 0.52,
          height: 2.35,
          depth: 0.09,
          style: 'royal',
          motifSeed: 130 + (side > 0 ? 1 : 0)
        },
        signageCtx
      );
      pillarPlaque.position.set(inX, vmmY + 3.35, vmmZ - 0.58);
      pillarPlaque.rotation.y = Math.PI;
      group.add(pillarPlaque);
    }

    // Courtyard Ribbed Silk Lanterns, Golden Candle Cores & Warm Ground Light Pools
    const lanternSilkParts: THREE.BufferGeometry[] = [];
    const lanternCoreParts: THREE.BufferGeometry[] = [];
    const lanternPoolParts: THREE.BufferGeometry[] = [];
    for (const lp of lanternPositions) {
      const pole = new THREE.CylinderGeometry(0.045, 0.055, 1.72, 8);
      pole.translate(lp.x, lp.y + 0.85, lp.z);
      crimsonParts.push(pole);

      const armDir = lp.x < 0 ? 1 : -1;
      const arm = new THREE.BoxGeometry(0.68, 0.06, 0.06);
      arm.translate(lp.x + armDir * 0.28, lp.y + 1.68, lp.z);
      crimsonParts.push(arm);

      const lx = lp.x + armDir * 0.58;
      const ly = lp.y + 1.32;
      const silk = createRibbedLanternShellGeometry(0.24, 0.58, 12, 8);
      silk.translate(lx, ly, lp.z);
      lanternSilkParts.push(silk);

      const cap = createLanternCapGeometry(0.24, 0.58);
      cap.translate(lx, ly, lp.z);
      goldParts.push(cap);

      const core = createLanternCoreGeometry(0.24, 0.58);
      core.translate(lx, ly, lp.z);
      lanternCoreParts.push(core);

      const groundY = getVietnamHeritageHeight(lx, lp.z);
      const pool = new THREE.CircleGeometry(2.15, 14);
      pool.rotateX(-Math.PI * 0.5);
      pool.translate(lx, groundY + 0.04, lp.z);
      lanternPoolParts.push(pool);
    }

    // Waving Silk Ceremonial Festival Banners flanking the Hero Promenade
    const plazaFlagHandle = this.sharedShaders
      ? this.sharedShaders.getWavingFlag({
        waveScale: 0.72,
        color: '#d41b1e',
        showStar: true
      })
      : createWavingSilkFlagMaterial({
        waveScale: 0.72,
        color: '#d41b1e',
        showStar: true
      });
    const plazaBannerMat = plazaFlagHandle.material;
    if (!this.sharedShaders) {
      this.extraMaterials.push(plazaBannerMat);
      this.extraAnimatedUniforms.push(plazaFlagHandle.uniforms);
    }

    for (const [bannerX, bz] of [
      [10.6, 41.6],
      [9.5, 34.0],
      [9.5, 22.0]
    ] as const) {
      for (const side of [-1, 1]) {
        const bx = side * bannerX;
        const by = getVietnamHeritageHeight(bx, bz);
        const pole = new THREE.CylinderGeometry(0.05, 0.065, 4.6, 8);
        pole.translate(bx, by + 2.3, bz);
        crimsonParts.push(pole);

        const spear = new THREE.ConeGeometry(0.10, 0.34, 6);
        spear.translate(bx, by + 4.74, bz);
        goldParts.push(spear);

        const bannerGeo = new THREE.PlaneGeometry(1.65, 1.08, 16, 10);
        bannerGeo.translate(0.88, 0, 0);
        const bannerMesh = new THREE.Mesh(bannerGeo, plazaBannerMat);
        bannerMesh.position.set(bx, by + 3.95, bz);
        bannerMesh.rotation.y = side < 0 ? 0.15 : Math.PI - 0.15;
        group.add(bannerMesh);
      }
    }

    // Merge all batched geometry groups cleanly after all sub-structures are built
    if (stoneParts.length > 0) {
      const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), stoneMat);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      group.add(stoneMesh);
    }
    if (limestoneParts.length > 0) {
      const limestoneMesh = new THREE.Mesh(mergeNormalized(limestoneParts), carvedLimestoneMat);
      limestoneMesh.castShadow = true;
      limestoneMesh.receiveShadow = true;
      group.add(limestoneMesh);
    }
    if (plasterParts.length > 0) {
      const plasterMesh = new THREE.Mesh(mergeNormalized(plasterParts), whitePlasterMat);
      plasterMesh.castShadow = true;
      plasterMesh.receiveShadow = true;
      group.add(plasterMesh);
    }
    if (bronzeParts.length > 0) {
      const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), bronzeMat);
      bronzeMesh.castShadow = true;
      group.add(bronzeMesh);
    }
    if (extraRoofParts.length > 0) {
      const roofMesh = new THREE.Mesh(mergeNormalized(extraRoofParts), darkRoofMat);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      group.add(roofMesh);
    }
    if (fgWaterParts.length > 0) {
      const fgWaterMesh = new THREE.Mesh(mergeNormalized(fgWaterParts), basinWaterMat);
      fgWaterMesh.receiveShadow = true;
      group.add(fgWaterMesh);
    }
    if (fgPadParts.length > 0) {
      const fgPadMesh = new THREE.Mesh(mergeNormalized(fgPadParts), fgPadMat);
      group.add(fgPadMesh);
    }
    if (fgStemParts.length > 0) {
      const fgStemMesh = new THREE.Mesh(mergeNormalized(fgStemParts), fgStemMat);
      group.add(fgStemMesh);
    }
    if (fgLotusParts.length > 0) {
      const fgLotusMesh = new THREE.Mesh(mergeNormalized(fgLotusParts), fgLotusMat);
      group.add(fgLotusMesh);
    }
    if (fgLotusCoreParts.length > 0) {
      const fgLotusCoreMesh = new THREE.Mesh(mergeNormalized(fgLotusCoreParts), fgLotusCoreMat);
      group.add(fgLotusCoreMesh);
    }
    if (crimsonParts.length > 0) {
      const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), crimsonLacquerMat);
      crimsonMesh.castShadow = true;
      crimsonMesh.receiveShadow = true;
      group.add(crimsonMesh);
    }
    if (voidParts.length > 0) {
      const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), darkVoidMat);
      group.add(voidMesh);
    }
    if (goldParts.length > 0) {
      const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMat);
      goldMesh.castShadow = true;
      group.add(goldMesh);
    }
    if (lanternSilkParts.length > 0) {
      const lanternSilkMesh = new THREE.Mesh(
        mergeNormalized(lanternSilkParts),
        this.lanternSilkMaterial!
      );
      lanternSilkMesh.name = 'VietnameseSilkLanterns';
      group.add(lanternSilkMesh);
    }
    if (lanternCoreParts.length > 0) {
      const lanternCoreMesh = new THREE.Mesh(
        mergeNormalized(lanternCoreParts),
        this.lanternCoreMaterial!
      );
      lanternCoreMesh.name = 'VietnameseLanternCores';
      group.add(lanternCoreMesh);
    }
    if (lanternPoolParts.length > 0) {
      const plazaPoolHandle = this.sharedShaders
        ? this.sharedShaders.warmLightPool
        : createWarmLightPoolMaterial();
      if (!this.sharedShaders) {
        this.extraMaterials.push(plazaPoolHandle.material);
        this.extraAnimatedUniforms.push(plazaPoolHandle.uniforms);
      }
      const lanternPoolMesh = new THREE.Mesh(
        mergeNormalized(lanternPoolParts),
        plazaPoolHandle.material
      );
      lanternPoolMesh.name = 'KhueVanLanternLightPools';
      group.add(lanternPoolMesh);
    }

    for (const [lx, ly, lz] of [
      [0, 3.6, 48],
      [0, 3.8, 30],
      [0, 4.4, 10]
    ]) {
      const warmLight = new THREE.PointLight('#ff9e44', 18.0, 26.0, 1.6);
      warmLight.position.set(lx, ly, lz);
      group.add(warmLight);
    }

    this.scene.add(group);
  }

  /**
   * Builds Chùa Một Cột (One Pillar Pagoda) at (-48, 22) in the formal square 34m × 34m
   * granite-rimmed Hồ Linh Chiểu Lotus Basin, 4.0m × 1.2m single stone pillar, authentic straight
   * 13-step brick stairway with stepped cheek walls, sculpted lotus brackets, Quan Âm sanctum,
   * bronze incense tripod (Bug B7 fix), historic Cây Bồ Đề (-63, 8), Tam Quan Chùa Diên Hựu (-48, 42),
   * and 360 notched lotus pads & 140 pink lotus flowers.
   */
  private buildOnePillarPagodaAndLotusPond(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'OnePillarPagodaComplex';

    const cx = -48.0;
    const cz = 22.0;
    this.exclusionCircles.push(
      { x: cx, z: cz, r: 22.0 },
      { x: -63.0, z: 8.0, r: 6.5 },
      { x: -48.0, z: 42.0, r: 9.5 }
    );

    const signageCtx = {
      extraTextures: this.extraTextures,
      extraMaterials: this.extraMaterials,
      signageAtlas: this.signageAtlas ?? undefined
    };

    const shared = this.sharedMaterials!;
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#cbc2b0',
      map: pbr.stone.map,
      normalMap: pbr.stone.normalMap,
      roughnessMap: pbr.stone.roughnessMap,
      roughness: 0.78
    });
    const brickMat = new THREE.MeshStandardMaterial({
      color: '#a4462c',
      map: pbr.terracotta.map,
      normalMap: pbr.terracotta.normalMap,
      roughnessMap: pbr.terracotta.roughnessMap,
      roughness: 0.78
    });
    const crimsonTimberMat = new THREE.MeshStandardMaterial({
      color: '#8e2119',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.48
    });
    const terracottaMat = shared.terracottaRoof;
    const goldMat = shared.gold;
    const bronzeMat = shared.bronze;
    const plasterMat = shared.whitePlaster;
    const bodhiBarkMat = shared.bark;
    const bodhiLeafMat = new THREE.MeshStandardMaterial({
      color: '#2d6e2c',
      map: pbr.leafAtlas,
      alphaTest: 0.40,
      roughness: 0.74,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(
      stoneMat,
      brickMat,
      crimsonTimberMat,
      bodhiLeafMat
    );

    const stoneParts: THREE.BufferGeometry[] = [];
    const brickParts: THREE.BufferGeometry[] = [];
    const timberParts: THREE.BufferGeometry[] = [];
    const roofParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const bronzeParts: THREE.BufferGeometry[] = [];
    const plasterParts: THREE.BufferGeometry[] = [];

    // 1. Formal Square 34m × 34m Granite-Rimmed Hồ Linh Chiểu Lotus Basin + connected *chữ Vạn* balustrades
    const halfBasin = 17.0;
    const rimW = 0.75;
    const rimH = 1.95; // from y = -1.40 to +0.55
    const rimY = -1.40 + rimH * 0.5;
    // North & South basin coping walls
    for (const sideZ of [-1, 1]) {
      const wallZ = new THREE.BoxGeometry(halfBasin * 2 + rimW, rimH, rimW);
      wallZ.translate(cx, rimY, cz + sideZ * halfBasin);
      stoneParts.push(wallZ);
    }
    // West coping wall
    const westWall = new THREE.BoxGeometry(rimW, rimH, halfBasin * 2 + rimW);
    westWall.translate(cx - halfBasin, rimY, cz);
    stoneParts.push(westWall);

    // East coping wall split cleanly for East stairway entrance (z = cz ± 2.2)
    const eastGapHalf = 2.2;
    const eastSegLen = halfBasin - eastGapHalf + rimW * 0.5;
    for (const sideZ of [-1, 1]) {
      const eastSeg = new THREE.BoxGeometry(rimW, rimH, eastSegLen);
      eastSeg.translate(cx + halfBasin, rimY, cz + sideZ * (eastGapHalf + eastSegLen * 0.5));
      stoneParts.push(eastSeg);
    }

    // Connected *chữ Vạn* pierced perimeter balustrades uniting all basin rim posts
    brickParts.push(
      ...createPiercedBalustradeParts(cx - halfBasin, cz - halfBasin, cx + halfBasin, cz - halfBasin, 0.55, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(cx - halfBasin, cz + halfBasin, cx + halfBasin, cz + halfBasin, 0.55, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(cx - halfBasin, cz - halfBasin, cx - halfBasin, cz + halfBasin, 0.55, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(cx + halfBasin, cz - halfBasin, cx + halfBasin, cz - eastGapHalf, 0.55, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(cx + halfBasin, cz + eastGapHalf, cx + halfBasin, cz + halfBasin, 0.55, 0.78, 'chu_van')
    );

    // Corner & entrance stone rim bollards with lotus finials
    for (const [bx, bz] of [
      [cx - halfBasin, cz - halfBasin],
      [cx + halfBasin, cz - halfBasin],
      [cx - halfBasin, cz + halfBasin],
      [cx + halfBasin, cz + halfBasin],
      [cx + halfBasin, cz - eastGapHalf],
      [cx + halfBasin, cz + eastGapHalf]
    ]) {
      const cornerPost = new THREE.BoxGeometry(0.56, 0.92, 0.56);
      cornerPost.translate(bx, 0.96, bz);
      stoneParts.push(cornerPost);
      stoneParts.push(...createLotusFinialParts(bx, 1.42, bz, 0.68));
    }

    // 2. Real 4.0m tall × 1.2m diameter Two-Block Single Cylindrical Stone Pillar
    const pillarBase = new THREE.CylinderGeometry(1.12, 1.38, 1.45, 24);
    pillarBase.translate(cx, -0.68, cz);
    stoneParts.push(pillarBase);

    const singlePillar = new THREE.CylinderGeometry(0.60, 0.60, 4.0, 28);
    singlePillar.translate(cx, 2.0, cz);
    stoneParts.push(singlePillar);

    // Subtle stone block horizontal mortar seam ring at mid-pillar (authentic stacked 2-block construction)
    const pillarSeam = new THREE.TorusGeometry(0.61, 0.032, 6, 24);
    pillarSeam.rotateX(Math.PI * 0.5);
    pillarSeam.translate(cx, 2.05, cz);
    stoneParts.push(pillarSeam);

    const pillarCap = new THREE.CylinderGeometry(0.86, 0.62, 0.28, 24);
    pillarCap.translate(cx, 3.92, cz);
    stoneParts.push(pillarCap);

    // 3. FIX Bug B7: Bronze Incense Tripod (*Đỉnh đồng*) on East Entrance Forecourt directly beneath (-30.5, 1.85, 22.0)
    const forecourtPad = new THREE.BoxGeometry(4.2, 2.25, 5.2);
    forecourtPad.translate(-30.6, -0.275, cz); // top flush at y = 0.85
    stoneParts.push(forecourtPad);

    const opcTripod = createBronzeIncenseTripodParts(-30.5, 0.85, 22.0, 0.95);
    stoneParts.push(...opcTripod.limestoneParts);
    bronzeParts.push(...opcTripod.bronzeParts);
    goldParts.push(...opcTripod.goldParts);
    this.incenseSources.push({ x: -30.5, y: opcTripod.smokeY, z: 22.0, scale: 0.92 });

    // 4. Authentic Straight Brick Causeway + 13-Step Straight Brick Stairway with Stepped Cheek Walls to Liên Hoa Đài
    // Flat straight brick-paved causeway from East gate (x = -32.2) to stair foot (x = -38.6) at y = 0.88m
    const causewayLen = 6.6;
    const causewayX = -35.4;
    const causewayDeck = new THREE.BoxGeometry(causewayLen, 0.26, 2.45);
    causewayDeck.translate(causewayX, 0.82, cz);
    stoneParts.push(causewayDeck);

    const causewayBase = new THREE.BoxGeometry(causewayLen, 2.15, 2.65);
    causewayBase.translate(causewayX, -0.32, cz);
    brickParts.push(causewayBase);

    for (const side of [-1, 1]) {
      const causewayParapet = new THREE.BoxGeometry(causewayLen, 0.58, 0.28);
      causewayParapet.translate(causewayX, 1.24, cz + side * 1.22);
      brickParts.push(causewayParapet);

      const causewayCap = new THREE.BoxGeometry(causewayLen + 0.08, 0.09, 0.36);
      causewayCap.translate(causewayX, 1.56, cz + side * 1.22);
      stoneParts.push(causewayCap);
    }

    // Authentic Straight 13-Step Brick Stairway climbing from x = -38.7 (y = 1.02) straight up to Liên Hoa Đài (-45.65, y = 4.10)
    const stairCount = 13;
    for (let s = 0; s < stairCount; s++) {
      const t = s / (stairCount - 1);
      const sx = THREE.MathUtils.lerp(-38.70, -45.65, t);
      const sy = THREE.MathUtils.lerp(1.02, 4.10, t);
      const treadW = 0.62;

      const tread = new THREE.BoxGeometry(treadW, 0.24, 2.18);
      tread.translate(sx, sy, cz);
      stoneParts.push(tread);

      const riserSub = new THREE.BoxGeometry(treadW, sy + 1.45, 2.52);
      riserSub.translate(sx, (sy - 1.45) * 0.5, cz);
      brickParts.push(riserSub);

      // Authentic stepped brick cheek walls flanking both sides of the 13 steps
      for (const side of [-1, 1]) {
        const cheekH = 0.68;
        const cheek = new THREE.BoxGeometry(treadW + 0.04, cheekH, 0.28);
        cheek.translate(sx, sy + cheekH * 0.5 + 0.04, cz + side * 1.20);
        brickParts.push(cheek);

        const cheekCap = new THREE.BoxGeometry(treadW + 0.08, 0.08, 0.34);
        cheekCap.translate(sx, sy + cheekH + 0.08, cz + side * 1.20);
        stoneParts.push(cheekCap);
      }
    }
    // Lotus newel bollards framing foot of the 13-step brick stairway
    for (const side of [-1, 1]) {
      const footNewel = new THREE.BoxGeometry(0.46, 0.85, 0.46);
      footNewel.translate(-38.35, 1.28, cz + side * 1.22);
      brickParts.push(footNewel);
      stoneParts.push(...createLotusFinialParts(-38.35, 1.72, cz + side * 1.22, 0.58));
    }

    // 5. Sculpted Lotus Timber Brackets (*Hệ đấu củng / bệ sen*) + 3.0m × 3.0m Crimson Shrine Chamber
    timberParts.push(...createTimberBracketSetParts(cx, 3.22, cz, 2.25, 12));

    const deck = new THREE.BoxGeometry(4.5, 0.24, 4.5);
    deck.translate(cx, 4.15, cz);
    timberParts.push(deck);

    // Full connected *con tiện* wooden balcony spindles (N, S, W + East flanking returns)
    const deckTopY = 4.27;
    timberParts.push(
      ...createPiercedBalustradeParts(cx - 2.16, cz - 2.16, cx + 2.16, cz - 2.16, deckTopY, 0.72, 'con_tien'),
      ...createPiercedBalustradeParts(cx - 2.16, cz + 2.16, cx + 2.16, cz + 2.16, deckTopY, 0.72, 'con_tien'),
      ...createPiercedBalustradeParts(cx - 2.16, cz - 2.16, cx - 2.16, cz + 2.16, deckTopY, 0.72, 'con_tien'),
      ...createPiercedBalustradeParts(cx + 2.16, cz - 2.16, cx + 2.16, cz - 1.15, deckTopY, 0.72, 'con_tien'),
      ...createPiercedBalustradeParts(cx + 2.16, cz + 1.15, cx + 2.16, cz + 2.16, deckTopY, 0.72, 'con_tien')
    );

    // 3.0m × 3.0m open crimson shrine chamber (N, S, W walls + open East doorway revealing Quan Âm Sanctum)
    const wallN = new THREE.BoxGeometry(3.0, 2.25, 0.16);
    wallN.translate(cx, 5.38, cz - 1.44);
    const wallS = new THREE.BoxGeometry(3.0, 2.25, 0.16);
    wallS.translate(cx, 5.38, cz + 1.44);
    const wallW = new THREE.BoxGeometry(0.16, 2.25, 3.0);
    wallW.translate(cx - 1.44, 5.38, cz);
    const lintelE = new THREE.BoxGeometry(0.18, 0.48, 3.0);
    lintelE.translate(cx + 1.44, 6.26, cz);
    timberParts.push(wallN, wallS, wallW, lintelE);

    // Open double carved shrine doors (*Cửa bức bàn*) swung open on East entrance
    for (const s of [-1, 1]) {
      const door = new THREE.BoxGeometry(0.62, 1.75, 0.08);
      door.rotateY(s * 0.35);
      door.translate(cx + 1.65, 5.15, cz + s * 0.96);
      timberParts.push(door);
    }

    // Interior crimson *Khám thờ* altar table against West inner wall
    const shrineAltar = new THREE.BoxGeometry(0.68, 0.72, 1.45);
    shrineAltar.translate(cx - 0.88, 4.62, cz);
    timberParts.push(shrineAltar);

    for (const [ox, oz] of [
      [-1.55, -1.55],
      [1.55, -1.55],
      [-1.55, 1.55],
      [1.55, 1.55]
    ]) {
      const col = new THREE.CylinderGeometry(0.11, 0.12, 2.30, 12);
      col.translate(cx + ox, 5.40, cz + oz);
      timberParts.push(col);
    }

    // Readable "CHÙA MỘT CỘT" royal plaque mounted above East shrine doorway
    const opcPlaque = createSignagePlaqueMesh(
      {
        text: 'CHÙA MỘT CỘT',
        subText: '延 祐 寺',
        width: 1.55,
        height: 0.44,
        depth: 0.08,
        style: 'royal',
        motifSeed: 201
      },
      signageCtx
    );
    opcPlaque.position.set(cx + 1.58, 6.28, cz);
    opcPlaque.rotation.y = Math.PI * 0.5;
    group.add(opcPlaque);

    // 6. Curved 4-Corner Upturned Terracotta Roof + Sculpted *Lưỡng long chầu nguyệt* Roof Ridge Finials
    const roofGeo = createVietnameseCurvedRoofGeometry(6.4, 6.4, 1.15, 1.15, 1.75, 0.45);
    roofGeo.translate(cx, 6.50, cz);
    roofParts.push(roofGeo);

    const ridgeBeam = new THREE.BoxGeometry(0.22, 0.18, 1.42);
    ridgeBeam.translate(cx, 8.28, cz);
    timberParts.push(ridgeBeam);

    const opcFinials = createRoofFinialSetParts(cx, 8.34, cz, 1.65, Math.PI * 0.5, 0.64, true);
    timberParts.push(...opcFinials.mainParts);
    goldParts.push(...opcFinials.goldParts);

    // 7. Interior Sanctum: Sculpted Gilded Quan Âm Bồ Tát Statue + Lotus Lamps + Câu Đối
    const quanAm = createSculptedDeityParts(cx - 0.88, 4.98, cz, Math.PI * 0.5, 0.46, 'quanam');
    goldParts.push(...quanAm.bodyParts, ...quanAm.accentParts);

    for (const s of [-1, 1]) {
      const cauDoi = new THREE.BoxGeometry(0.06, 1.45, 0.16);
      cauDoi.translate(cx + 1.48, 5.45, cz + s * 1.15);
      goldParts.push(cauDoi);
    }
    const miniUrn = new THREE.CylinderGeometry(0.10, 0.08, 0.16, 10);
    miniUrn.translate(cx - 0.48, 5.06, cz);
    bronzeParts.push(miniUrn);

    // 2 Warm glowing lotus altar lamps flanking Quan Âm inside the sanctum
    const sanctumLampMat = new THREE.MeshStandardMaterial({
      color: '#ffd080',
      emissive: new THREE.Color('#ff9a2a'),
      emissiveIntensity: 2.4,
      roughness: 0.3
    });
    this.extraMaterials.push(sanctumLampMat);
    const sLampParts: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const lOrb = new THREE.SphereGeometry(0.09, 8, 6);
      lOrb.translate(cx - 0.65, 5.22, cz + s * 0.46);
      sLampParts.push(lOrb);
    }
    group.add(new THREE.Mesh(mergeNormalized(sLampParts), sanctumLampMat));

    // 8. HISTORIC CÂY BỒ ĐỀ (Sacred Bodhi Tree gifted in 1958) beside NW bank at (-63, 8)
    const bodhiX = -63.0;
    const bodhiZ = 8.0;
    const bodhiY = getVietnamHeritageHeight(bodhiX, bodhiZ);
    const bodhiBarkParts: THREE.BufferGeometry[] = [];
    const bodhiLeafParts: THREE.BufferGeometry[] = [];

    // Octagonal carved stone tree planter curb around Bodhi trunk
    const planterRim = new THREE.CylinderGeometry(2.65, 2.85, 0.58, 8);
    planterRim.translate(bodhiX, bodhiY + 0.22, bodhiZ);
    stoneParts.push(planterRim);

    // Gnarled main trunk + 5 spreading primary limbs + hanging aerial prop roots
    const bTrunk = new THREE.CylinderGeometry(0.55, 0.88, 4.4, 10);
    bTrunk.translate(bodhiX, bodhiY + 2.45, bodhiZ);
    bodhiBarkParts.push(bTrunk);

    const bRand = mulberry32(195802);
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2 + 0.3;
      const limbLen = 3.8 + bRand() * 1.4;
      const limb = new THREE.CylinderGeometry(0.18, 0.36, limbLen, 7);
      limb.translate(0, limbLen * 0.5, 0);
      limb.rotateZ(0.72 + bRand() * 0.25);
      limb.rotateY(ang);
      limb.translate(bodhiX, bodhiY + 3.9, bodhiZ);
      bodhiBarkParts.push(limb);

      // Aerial root hanging down toward stone planter
      const rootR = 1.45 + bRand() * 0.7;
      const root = new THREE.CylinderGeometry(0.055, 0.08, 3.6, 5);
      root.translate(bodhiX + Math.cos(ang) * rootR, bodhiY + 2.1, bodhiZ + Math.sin(ang) * rootR);
      bodhiBarkParts.push(root);

      // Wide heart-shaped emerald canopy clusters
      for (let k = 0; k < 3; k++) {
        const cCard = new THREE.PlaneGeometry(3.8, 3.1);
        cCard.rotateY((k / 3) * Math.PI + ang);
        cCard.rotateX((k % 2 === 0 ? 1 : -1) * 0.28);
        cCard.translate(
          bodhiX + Math.cos(ang) * (2.4 + bRand() * 1.3),
          bodhiY + 5.8 + bRand() * 1.8,
          bodhiZ + Math.sin(ang) * (2.4 + bRand() * 1.3)
        );
        bodhiLeafParts.push(cCard);
      }
    }
    for (let k = 0; k < 4; k++) {
      const topCard = new THREE.PlaneGeometry(4.8, 3.6);
      topCard.rotateY((k / 4) * Math.PI);
      topCard.rotateX((k % 2 === 0 ? 1 : -1) * 0.22);
      topCard.translate(bodhiX, bodhiY + 7.4, bodhiZ);
      bodhiLeafParts.push(topCard);
    }
    const bodhiPlaque = createSignagePlaqueMesh(
      {
        text: 'CÂY BỒ ĐỀ',
        subText: '1958 — DIÊN HỰU',
        width: 1.4,
        height: 0.52,
        depth: 0.08,
        style: 'stone',
        motifSeed: 205
      },
      signageCtx
    );
    bodhiPlaque.position.set(bodhiX + 2.85, bodhiY + 0.72, bodhiZ + 1.2);
    bodhiPlaque.rotation.y = Math.PI * 0.38;
    group.add(bodhiPlaque);

    if (bodhiBarkParts.length > 0) {
      const bodhiBarkMesh = new THREE.Mesh(mergeNormalized(bodhiBarkParts), bodhiBarkMat);
      bodhiBarkMesh.castShadow = true;
      bodhiBarkMesh.receiveShadow = true;
      group.add(bodhiBarkMesh);
    }
    if (bodhiLeafParts.length > 0) {
      const bodhiLeafMesh = new THREE.Mesh(mergeNormalized(bodhiLeafParts), bodhiLeafMat);
      bodhiLeafMesh.castShadow = true;
      group.add(bodhiLeafMesh);
    }

    // 9. TAM QUAN CHÙA DIÊN HỰU (3-Bay Traditional Temple Gate behind the pond at (-48, 42))
    const tqX = -48.0;
    const tqZ = 42.0;
    const tqY = getVietnamHeritageHeight(tqX, tqZ);

    const tqPlinth = new THREE.BoxGeometry(12.8, 1.05, 4.4);
    tqPlinth.translate(tqX, tqY - 0.18, tqZ);
    stoneParts.push(tqPlinth);

    // 4 Whitewashed masonry gate piers dividing 3 bays (central 3.6m bay + 2 side 2.5m bays)
    for (const ox of [-5.2, -1.9, 1.9, 5.2]) {
      const pier = new THREE.BoxGeometry(0.95, 3.55, 1.35);
      pier.translate(tqX + ox, tqY + 2.12, tqZ);
      plasterParts.push(pier);

      const pierCap = new THREE.BoxGeometry(1.14, 0.24, 1.52);
      pierCap.translate(tqX + ox, tqY + 3.96, tqZ);
      stoneParts.push(pierCap);
    }
    // Central upper gable drum & lintel beams
    const tqUpperBox = new THREE.BoxGeometry(4.4, 1.35, 1.85);
    tqUpperBox.translate(tqX, tqY + 4.65, tqZ);
    plasterParts.push(tqUpperBox);

    const tqLintel = new THREE.BoxGeometry(11.4, 0.34, 1.22);
    tqLintel.translate(tqX, tqY + 3.85, tqZ);
    timberParts.push(tqLintel);

    // Two-tier curved terracotta roofs (lower wing roof + upper central pavilion roof)
    const tqWingRoof = createVietnameseCurvedRoofGeometry(14.2, 5.2, 9.2, 1.4, 1.55, 0.38);
    tqWingRoof.translate(tqX, tqY + 4.02, tqZ);
    roofParts.push(tqWingRoof);

    const tqTopRoof = createVietnameseCurvedRoofGeometry(6.6, 4.4, 2.2, 0.85, 1.45, 0.36);
    tqTopRoof.translate(tqX, tqY + 5.28, tqZ);
    roofParts.push(tqTopRoof);

    const tqFinials = createRoofFinialSetParts(tqX, tqY + 6.76, tqZ, 2.4, 0, 0.65, true);
    timberParts.push(...tqFinials.mainParts);
    goldParts.push(...tqFinials.goldParts);

    // Guardian Nghê flanking the North face of Tam Quan Chùa Diên Hựu
    for (const side of [-1, 1]) {
      stoneParts.push(...createGuardianBeastParts(tqX + side * 3.2, tqY + 0.34, tqZ - 2.6, Math.PI, 0.82, 'nghe'));
    }

    const tqPlaque = createSignagePlaqueMesh(
      {
        text: 'CHÙA DIÊN HỰU',
        subText: '延 祐 古 寺',
        width: 2.55,
        height: 0.68,
        depth: 0.12,
        style: 'royal',
        motifSeed: 208
      },
      signageCtx
    );
    tqPlaque.position.set(tqX, tqY + 4.65, tqZ - 0.98);
    tqPlaque.rotation.y = Math.PI;
    group.add(tqPlaque);

    // Merge all batched architectural parts cleanly
    if (stoneParts.length > 0) {
      const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), stoneMat);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      group.add(stoneMesh);
    }
    if (brickParts.length > 0) {
      const brickMesh = new THREE.Mesh(mergeNormalized(brickParts), brickMat);
      brickMesh.castShadow = true;
      brickMesh.receiveShadow = true;
      group.add(brickMesh);
    }
    if (plasterParts.length > 0) {
      const plasterMesh = new THREE.Mesh(mergeNormalized(plasterParts), plasterMat);
      plasterMesh.castShadow = true;
      plasterMesh.receiveShadow = true;
      group.add(plasterMesh);
    }
    if (timberParts.length > 0) {
      const timberMesh = new THREE.Mesh(mergeNormalized(timberParts), crimsonTimberMat);
      timberMesh.castShadow = true;
      timberMesh.receiveShadow = true;
      group.add(timberMesh);
    }
    if (roofParts.length > 0) {
      const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), terracottaMat);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      group.add(roofMesh);
    }
    if (bronzeParts.length > 0) {
      const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), bronzeMat);
      bronzeMesh.castShadow = true;
      group.add(bronzeMesh);
    }
    if (goldParts.length > 0) {
      const finialMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMat);
      finialMesh.castShadow = true;
      group.add(finialMesh);
    }

    // 10. Đầm Sen (360 Notched Lotus Pads & 140 Blooming Pink Lotus Flowers inside 34m × 34m basin)
    const leafCount = 360;
    const leafGeo = createNotchedLotusPadGeometry(0.48, 12);
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#2c7838',
      roughness: 0.56,
      metalness: 0.04,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(leafMat);

    const lotusLeaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    lotusLeaves.name = 'InstancedLotusLeaves';
    lotusLeaves.receiveShadow = true;

    const flowerCount = 140;
    const petalParts: THREE.BufferGeometry[] = [];
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      const petal = new THREE.SphereGeometry(0.13, 5, 4);
      petal.scale(0.55, 1.45, 0.25);
      petal.rotateX(0.45);
      petal.translate(0, 0.14, 0.10);
      petal.rotateY(a);
      petalParts.push(petal);
    }
    const centerBud = new THREE.CylinderGeometry(0.07, 0.05, 0.11, 6);
    centerBud.translate(0, 0.14, 0);
    petalParts.push(centerBud);
    const flowerGeo = mergeNormalized(petalParts);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: '#f58bb2',
      emissive: '#3a101d',
      emissiveIntensity: 0.25,
      roughness: 0.48
    });
    this.extraMaterials.push(flowerMat);

    const lotusFlowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    lotusFlowers.name = 'InstancedLotusFlowers';

    const rand = mulberry32(202501);
    const dummy = this.tmpMat;
    const pos = this.tmpPos;
    const quat = this.tmpQuat;
    const scale = this.tmpScale;
    const euler = this.tmpEuler;
    const upAxis = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();

    const isInsideBasinWater = (px: number, pz: number): boolean => {
      if (Math.hypot(px - cx, pz - cz) < 1.8) return false; // keep clear of pillar
      if (px > cx - 0.5 && px < cx + 17.5 && Math.abs(pz - cz) < 2.2) return false; // keep clear of stairway & causeway
      return getVietnamHeritageHeight(px, pz) < -0.25;
    };

    let placedLeaves = 0;
    for (let i = 0; i < leafCount * 6 && placedLeaves < leafCount; i++) {
      const lx = cx + (rand() - 0.5) * 31.6;
      const lz = cz + (rand() - 0.5) * 31.6;
      if (!isInsideBasinWater(lx, lz)) continue;
      const sc = 0.78 + rand() * 0.72;
      pos.set(lx, VIETNAM_WATER_LEVEL + 0.025 + rand() * 0.02, lz);
      euler.set((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06);
      quat.setFromEuler(euler);
      scale.set(sc, 1, sc);
      dummy.compose(pos, quat, scale);
      lotusLeaves.setMatrixAt(placedLeaves, dummy);
      col.setHSL(0.32 + (rand() - 0.5) * 0.05, 0.52, 0.26 + rand() * 0.12);
      lotusLeaves.setColorAt(placedLeaves, col);
      placedLeaves++;
    }
    this.scalableFoliage.push({ mesh: lotusLeaves, baseCount: placedLeaves });
    lotusLeaves.count = Math.max(
      1,
      Math.round(placedLeaves * this.qualitySettings.foliageDensityScale)
    );
    lotusLeaves.instanceMatrix.needsUpdate = true;
    if (lotusLeaves.instanceColor) lotusLeaves.instanceColor.needsUpdate = true;
    group.add(lotusLeaves);

    let placedFlowers = 0;
    for (let i = 0; i < flowerCount * 6 && placedFlowers < flowerCount; i++) {
      const fx = cx + (rand() - 0.5) * 30.8;
      const fz = cz + (rand() - 0.5) * 30.8;
      if (!isInsideBasinWater(fx, fz)) continue;
      const sc = 0.88 + rand() * 0.58;
      pos.set(fx, VIETNAM_WATER_LEVEL + 0.05 + rand() * 0.10, fz);
      quat.setFromAxisAngle(upAxis, rand() * Math.PI * 2);
      scale.set(sc, sc, sc);
      dummy.compose(pos, quat, scale);
      lotusFlowers.setMatrixAt(placedFlowers, dummy);
      col.set(rand() > 0.25 ? '#f598ba' : '#fdeaf0');
      lotusFlowers.setColorAt(placedFlowers, col);
      placedFlowers++;
    }
    this.scalableFoliage.push({ mesh: lotusFlowers, baseCount: placedFlowers });
    lotusFlowers.count = Math.max(
      1,
      Math.round(placedFlowers * this.qualitySettings.foliageDensityScale)
    );
    lotusFlowers.instanceMatrix.needsUpdate = true;
    if (lotusFlowers.instanceColor) lotusFlowers.instanceColor.needsUpdate = true;
    group.add(lotusFlowers);

    this.scene.add(group);
  }

  /**
   * Builds Tháp Rùa (Turtle Tower) at (52, 22) on Gò Rùa islet in Hoàn Kiếm Lake with pointed Gothic arches
   * (open Tiers 1 & 2 for light pass-through — Bug B18 fix), Tier 3 solid walls + 1 East pointed arch &
   * "QUY SƠN THÁP" medallion, 4-sided crenellations, 5-pointed star finial, PLUS Cầu Thê Húc arched vermilion
   * bridge (22m, 11 bays) connecting East shore to Đảo Ngọc (78, 3) with Đắc Nguyệt Lâu & Đền Ngọc Sơn,
   * Tháp Bút & Đài Nghiên (102, 14), and weeping willows along the lakeshore.
   */
  private buildTurtleTowerIslet(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'TurtleTowerIslet';

    const cx = 52.0;
    const cz = 22.0;
    const isletY = getVietnamHeritageHeight(cx, cz); // ~0.95m
    this.exclusionCircles.push(
      { x: cx, z: cz, r: 12.0 },
      { x: 78.0, z: 3.0, r: 13.0 },
      { x: 91.0, z: 3.0, r: 10.0 },
      { x: 102.0, z: 14.0, r: 7.5 }
    );

    const signageCtx = {
      extraTextures: this.extraTextures,
      extraMaterials: this.extraMaterials,
      signageAtlas: this.signageAtlas ?? undefined
    };

    const shared = this.sharedMaterials!;
    const mossyStuccoMat = new THREE.MeshStandardMaterial({
      color: '#9e9278',
      map: pbr.plaster.map,
      normalMap: pbr.plaster.normalMap,
      roughnessMap: pbr.plaster.roughnessMap,
      roughness: 0.86
    });
    applyWorldSpaceWeathering(mossyStuccoMat, {
      macroScale: 0.35,
      mossHeight: 4.5,
      mossColor: '#50603e',
      dampRoughness: 0.78
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#7d725b',
      map: pbr.stone.map,
      normalMap: pbr.stone.normalMap,
      roughnessMap: pbr.stone.roughnessMap,
      roughness: 0.82
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#6e7264',
      map: pbr.granite.map,
      normalMap: pbr.granite.normalMap,
      roughnessMap: pbr.granite.roughnessMap,
      roughness: 0.90
    });
    const goldMat = shared.gold;
    const vermilionBridgeMat = new THREE.MeshStandardMaterial({
      color: '#c9231a',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.42,
      metalness: 0.06
    });
    const bridgeDeckMat = new THREE.MeshStandardMaterial({
      color: '#7a3020',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.68
    });
    const templeRoofMat = shared.terracottaRoof;
    const templeBronzeMat = shared.bronze;
    const stringLightMat = new THREE.MeshStandardMaterial({
      color: '#fff2be',
      emissive: '#ffae38',
      emissiveIntensity: 2.6,
      roughness: 0.25
    });
    const willowBarkMat = shared.bark;
    const willowFrondMat = new THREE.MeshStandardMaterial({
      color: '#4c8c38',
      map: pbr.leafAtlas,
      alphaTest: 0.38,
      roughness: 0.72,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(
      mossyStuccoMat,
      trimMat,
      rockMat,
      vermilionBridgeMat,
      bridgeDeckMat,
      stringLightMat,
      willowFrondMat
    );

    const rockParts: THREE.BufferGeometry[] = [];
    const stuccoParts: THREE.BufferGeometry[] = [];
    const trimParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const vermilionParts: THREE.BufferGeometry[] = [];
    const deckParts: THREE.BufferGeometry[] = [];
    const roofParts: THREE.BufferGeometry[] = [];
    const bronzeParts: THREE.BufferGeometry[] = [];
    const bulbParts: THREE.BufferGeometry[] = [];

    // 1. Sculpted mossy shoreline rock ring around Gò Rùa islet (r = 7.4..10.2m)
    for (let r = 0; r < 22; r++) {
      const a = (r / 22) * Math.PI * 2;
      const dist = 8.4 + Math.sin(r * 2.3) * 1.1;
      const rx = cx + Math.cos(a) * dist;
      const rz = cz + Math.sin(a) * dist;
      const boulder = createSculptedRockGeometry(300 + r * 17, 1.35, 0.72, 1.15, 2);
      boulder.rotateY(a);
      boulder.translate(rx, 0.04, rz);
      rockParts.push(boulder);
    }

    // 2. 3-Tiered Historic Tháp Rùa Tower (8.80m total height above isletY) — Bug B18 Fixed!
    const plinth = new THREE.BoxGeometry(6.68, 0.85, 4.94);
    plinth.translate(cx, isletY - 0.125, cz); // bottom at isletY - 0.55, top at isletY + 0.30
    trimParts.push(plinth);

    const buildPointedOpenTier = (
      yBase: number,
      w: number,
      d: number,
      h: number,
      corniceH: number,
      longBays: number,
      shortBays: number
    ) => {
      const bayW = w / longBays;
      const bayD = d / shortBays;
      for (const side of [-1, 1]) {
        for (let b = 0; b < longBays; b++) {
          const bx = -w * 0.5 + bayW * (b + 0.5);
          const wall = createPointedArchedWallGeometry(bayW + 0.02, h, 0.34, bayW * 0.62, h * 0.78);
          wall.translate(cx + bx, yBase, cz + side * (d * 0.5 - 0.17));
          stuccoParts.push(wall);
        }
        for (let b = 0; b < shortBays; b++) {
          const bz = -d * 0.5 + bayD * (b + 0.5);
          const wall = createPointedArchedWallGeometry(bayD + 0.02, h, 0.34, bayD * 0.60, h * 0.78);
          wall.rotateY(Math.PI * 0.5);
          wall.translate(cx + side * (w * 0.5 - 0.17), yBase, cz + bz);
          stuccoParts.push(wall);
        }
      }
      // Clean thin ceiling/floor slab only (NO dark solid inner box — light passes freely through pointed arches!)
      const cornice = new THREE.BoxGeometry(w + 0.34, corniceH, d + 0.34);
      cornice.translate(cx, yBase + h + corniceH * 0.5, cz);
      trimParts.push(cornice);
    };

    const t1Y = isletY + 0.30;
    buildPointedOpenTier(t1Y, 6.28, 4.54, 3.10, 0.20, 3, 2);

    const t2Y = t1Y + 3.30;
    buildPointedOpenTier(t2Y, 4.80, 3.64, 2.35, 0.18, 3, 2);

    // Warm golden uplight inside Tier 1 illuminating the open pointed Gothic arches cleanly
    const towerGlowLight = new THREE.PointLight('#ffae4a', 14.0, 20.0, 1.5);
    towerGlowLight.position.set(cx, t1Y + 1.55, cz);
    group.add(towerGlowLight);

    // Tier 3 (2.97m × 1.90m × 1.62m): authentic solid walls on N, S, W + 1 pointed Gothic archway on East (+X)
    const t3Y = t2Y + 2.53;
    const t3W = 2.97;
    const t3D = 1.90;
    const t3H = 1.62;
    const t3WallT = 0.28;
    for (const side of [-1, 1]) {
      const solidNS = new THREE.BoxGeometry(t3W, t3H, t3WallT);
      solidNS.translate(cx, t3Y + t3H * 0.5, cz + side * (t3D * 0.5 - t3WallT * 0.5));
      stuccoParts.push(solidNS);
    }
    const solidW = new THREE.BoxGeometry(t3WallT, t3H, t3D);
    solidW.translate(cx - (t3W * 0.5 - t3WallT * 0.5), t3Y + t3H * 0.5, cz);
    stuccoParts.push(solidW);

    const eastPointedWall = createPointedArchedWallGeometry(t3D, t3H, t3WallT, 0.88, 1.18);
    eastPointedWall.rotateY(Math.PI * 0.5);
    eastPointedWall.translate(cx + (t3W * 0.5 - t3WallT * 0.5), t3Y, cz);
    stuccoParts.push(eastPointedWall);

    const t3Cornice = new THREE.BoxGeometry(t3W + 0.34, 0.22, t3D + 0.34);
    t3Cornice.translate(cx, t3Y + t3H + 0.11, cz);
    trimParts.push(t3Cornice);

    // Oval medallion frame + readable "QUY SƠN THÁP" plaque on Tier 3 East pediment
    const ovalFrame = new THREE.TorusGeometry(0.32, 0.048, 8, 24);
    ovalFrame.scale(1.18, 0.72, 1.0);
    ovalFrame.rotateY(Math.PI * 0.5);
    ovalFrame.translate(cx + t3W * 0.5 + 0.03, t3Y + 1.38, cz);
    trimParts.push(ovalFrame);

    const quySonPlaque = createSignagePlaqueMesh(
      {
        text: 'QUY SƠN THÁP',
        subText: '龜 山 塔',
        width: 0.74,
        height: 0.36,
        depth: 0.06,
        style: 'stone',
        motifSeed: 301
      },
      signageCtx
    );
    quySonPlaque.position.set(cx + t3W * 0.5 + 0.04, t3Y + 1.38, cz);
    quySonPlaque.rotation.y = Math.PI * 0.5;
    group.add(quySonPlaque);

    // Top crenellation merlons on ALL 4 sides (N, S, E, W) + curved gazebo roof + 5-pointed star finial
    const topDeckY = t3Y + 1.84;
    for (let c = -3; c <= 3; c++) {
      for (const side of [-1, 1]) {
        const merlonNS = new THREE.BoxGeometry(0.22, 0.26, 0.16);
        merlonNS.translate(cx + c * 0.42, topDeckY + 0.13, cz + side * 0.90);
        stuccoParts.push(merlonNS);
      }
    }
    for (let c = -2; c <= 2; c++) {
      for (const side of [-1, 1]) {
        const merlonEW = new THREE.BoxGeometry(0.16, 0.26, 0.22);
        merlonEW.translate(cx + side * 1.44, topDeckY + 0.13, cz + c * 0.40);
        stuccoParts.push(merlonEW);
      }
    }

    const gazeboBase = new THREE.BoxGeometry(2.0, 0.22, 2.0);
    gazeboBase.translate(cx, topDeckY + 0.11, cz);
    trimParts.push(gazeboBase);

    const gazeboRoof = createVietnameseCurvedRoofGeometry(2.25, 2.25, 0.45, 0.45, 0.60, 0.16);
    gazeboRoof.translate(cx, topDeckY + 0.18, cz);
    trimParts.push(gazeboRoof);

    // Proper 5-pointed star finial atop Tháp Rùa
    const spirePost = new THREE.CylinderGeometry(0.038, 0.065, 0.24, 8);
    spirePost.translate(cx, topDeckY + 0.82, cz);
    goldParts.push(spirePost);

    const starShape = new THREE.Shape();
    const starOuter = 0.22;
    const starInner = 0.088;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.5 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? starOuter : starInner;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(sx, sy);
      else starShape.lineTo(sx, sy);
    }
    starShape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 1
    });
    starGeo.translate(cx, topDeckY + 1.06, cz - 0.025);
    goldParts.push(starGeo);

    // 3. CẦU THÊ HÚC (Iconic 22m, 11-Bay Arched Vermilion Wooden Bridge connecting East shore (98..102, 3) to Đảo Ngọc (78, 3))
    const bridgeZ = 3.0;
    const bridgeX0 = 80.0; // Đảo Ngọc arrival
    const bridgeX1 = 102.0; // East shore departure (22m span)
    const bridgeBays = 11;
    const bridgeArchY = (t: number) => 0.96 + 1.72 * Math.sin(t * Math.PI);

    // Grounded stone approach abutments at both ends of Cầu Thê Húc
    for (const ax of [bridgeX0 - 0.6, bridgeX1 + 0.6]) {
      const abut = new THREE.BoxGeometry(1.9, 2.55, 3.4);
      abut.translate(ax, -0.32, bridgeZ);
      trimParts.push(abut);
    }

    const bridgeLightPools: THREE.BufferGeometry[] = [];
    for (let i = 0; i <= bridgeBays; i++) {
      const t = i / bridgeBays;
      const px = THREE.MathUtils.lerp(bridgeX0, bridgeX1, t);
      const py = bridgeArchY(t);

      // Paired vermilion cylindrical piers grounded into lakebed (-1.6m)
      const pierH = py + 1.6;
      for (const side of [-1, 1]) {
        const pier = new THREE.CylinderGeometry(0.11, 0.13, pierH, 8);
        pier.translate(px, -1.6 + pierH * 0.5, bridgeZ + side * 1.24);
        vermilionParts.push(pier);
      }
      // Crossbeam girder uniting each pier pair beneath the plank deck
      const crossBeam = new THREE.BoxGeometry(0.20, 0.22, 3.05);
      crossBeam.translate(px, py - 0.14, bridgeZ);
      vermilionParts.push(crossBeam);

      if (i < bridgeBays) {
        const tNext = (i + 1) / bridgeBays;
        const xNext = THREE.MathUtils.lerp(bridgeX0, bridgeX1, tNext);
        const yNext = bridgeArchY(tNext);
        const xm = (px + xNext) * 0.5;
        const ym = (py + yNext) * 0.5;
        const segLen = Math.hypot(xNext - px, yNext - py) + 0.05;
        const pitch = Math.atan2(yNext - py, xNext - px);

        // Longitudinal deck stringers + slatted wooden deck planks
        for (const side of [-1, 1]) {
          const stringer = new THREE.BoxGeometry(segLen, 0.18, 0.18);
          stringer.rotateZ(pitch);
          stringer.translate(xm, ym - 0.05, bridgeZ + side * 1.32);
          vermilionParts.push(stringer);
        }
        for (let pIdx = 0; pIdx < 4; pIdx++) {
          const pt = (pIdx + 0.5) / 4;
          const plankX = THREE.MathUtils.lerp(px, xNext, pt);
          const plankY = THREE.MathUtils.lerp(py, yNext, pt);
          const plank = new THREE.BoxGeometry(0.42, 0.09, 2.75);
          plank.rotateZ(pitch);
          plank.translate(plankX, plankY + 0.04, bridgeZ);
          deckParts.push(plank);
        }

        // Connected vermilion *con tiện* railings along both bridge sides
        for (const side of [-1, 1]) {
          const rz = bridgeZ + side * 1.40;
          const topRail = new THREE.BoxGeometry(segLen, 0.11, 0.12);
          topRail.rotateZ(pitch);
          topRail.translate(xm, ym + 0.94, rz);
          const botRail = new THREE.BoxGeometry(segLen, 0.09, 0.12);
          botRail.rotateZ(pitch);
          botRail.translate(xm, ym + 0.18, rz);
          vermilionParts.push(topRail, botRail);

          const post = new THREE.BoxGeometry(0.13, 1.06, 0.13);
          post.translate(px, py + 0.54, rz);
          vermilionParts.push(post);

          for (let sp = 1; sp <= 4; sp++) {
            const st = sp / 5;
            const spx = THREE.MathUtils.lerp(px, xNext, st);
            const spy = THREE.MathUtils.lerp(py, yNext, st);
            const spindle = new THREE.CylinderGeometry(0.028, 0.032, 0.72, 6);
            spindle.translate(spx, spy + 0.56, rz);
            vermilionParts.push(spindle);
          }

          // Warm glowing night string lights lining Cầu Thê Húc railings
          const bulb = new THREE.SphereGeometry(0.075, 7, 6);
          bulb.translate(xm, ym + 0.98, rz + side * 0.06);
          bulbParts.push(bulb);
        }

        if (i % 2 === 1) {
          const pool = new THREE.CircleGeometry(2.3, 12);
          pool.rotateX(-Math.PI * 0.5);
          pool.translate(xm, VIETNAM_WATER_LEVEL + 0.03, bridgeZ);
          bridgeLightPools.push(pool);
        }
      }
    }

    // 4. ĐẢO NGỌC (78, 3) — ĐẮC NGUYỆT LÂU (Moon-Gazing Gate) & ĐỀN NGỌC SƠN (2-Tier Curved-Roof Temple)
    const ngocX = 78.0;
    const ngocZ = 3.0;
    const ngocY = getVietnamHeritageHeight(ngocX, ngocZ); // ~1.05m

    // Mossy shoreline rock ring wrapping Đảo Ngọc (leaving East bridge entrance clear)
    for (let r = 0; r < 18; r++) {
      const a = (r / 18) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.34) continue; // open East bridge landing
      const dist = 8.8 + Math.sin(r * 2.1) * 0.8;
      const b = createSculptedRockGeometry(380 + r * 13, 1.45, 0.75, 1.25, 2);
      b.rotateY(a);
      b.translate(ngocX + Math.cos(a) * dist, 0.06, ngocZ + Math.sin(a) * dist);
      rockParts.push(b);
    }

    // Đắc Nguyệt Lâu (Moon-Gazing Pavilion Gate at bridge arrival x = 82.0, z = 3.0)
    const dnlX = 82.0;
    const dnlPlinth = new THREE.BoxGeometry(3.4, 0.85, 4.0);
    dnlPlinth.translate(dnlX, ngocY - 0.15, ngocZ);
    trimParts.push(dnlPlinth);

    for (const oz of [-1.45, 1.45]) {
      const gatePier = new THREE.BoxGeometry(2.4, 2.85, 0.72);
      gatePier.translate(dnlX, ngocY + 1.65, ngocZ + oz);
      stuccoParts.push(gatePier);
    }
    const dnlArchLintel = new THREE.BoxGeometry(2.5, 0.55, 3.6);
    dnlArchLintel.translate(dnlX, ngocY + 3.10, ngocZ);
    stuccoParts.push(dnlArchLintel);

    // Upper Moon-Gazing pavilion story + *con tiện* balcony + curved roof
    const dnlUpperY = ngocY + 3.38;
    const dnlFloor = new THREE.BoxGeometry(3.2, 0.18, 3.6);
    dnlFloor.translate(dnlX, dnlUpperY, ngocZ);
    vermilionParts.push(dnlFloor);
    vermilionParts.push(
      ...createPiercedBalustradeParts(dnlX - 1.5, ngocZ - 1.7, dnlX + 1.5, ngocZ - 1.7, dnlUpperY + 0.09, 0.65, 'con_tien'),
      ...createPiercedBalustradeParts(dnlX - 1.5, ngocZ + 1.7, dnlX + 1.5, ngocZ + 1.7, dnlUpperY + 0.09, 0.65, 'con_tien')
    );
    for (const ox of [-1.25, 1.25]) {
      for (const oz of [-1.35, 1.35]) {
        const col = new THREE.CylinderGeometry(0.10, 0.11, 1.85, 8);
        col.translate(dnlX + ox, dnlUpperY + 1.0, ngocZ + oz);
        vermilionParts.push(col);
      }
    }
    const dnlRoof = createVietnameseCurvedRoofGeometry(4.6, 5.0, 1.2, 1.4, 1.25, 0.34);
    dnlRoof.translate(dnlX, dnlUpperY + 1.92, ngocZ);
    roofParts.push(dnlRoof);

    const dnlPlaque = createSignagePlaqueMesh(
      {
        text: 'ĐẮC NGUYỆT LÂU',
        subText: '得 月 樓',
        width: 2.15,
        height: 0.56,
        depth: 0.10,
        style: 'royal',
        motifSeed: 311
      },
      signageCtx
    );
    dnlPlaque.position.set(dnlX + 1.32, ngocY + 3.12, ngocZ);
    dnlPlaque.rotation.y = Math.PI * 0.5;
    group.add(dnlPlaque);

    // Đền Ngọc Sơn (2-Tier Curved-Roof Temple centered at (75.5, 3.0) on Đảo Ngọc)
    const dnsX = 75.5;
    const dnsPlinth = new THREE.BoxGeometry(8.6, 1.15, 9.2);
    dnsPlinth.translate(dnsX, ngocY - 0.12, ngocZ);
    trimParts.push(dnsPlinth);

    // Sanctuary stucco side walls & open vermilion pillared front veranda
    for (const sz of [-3.6, 3.6]) {
      const sWall = new THREE.BoxGeometry(6.8, 3.1, 0.34);
      sWall.translate(dnsX - 0.4, ngocY + 2.0, ngocZ + sz);
      stuccoParts.push(sWall);
    }
    const backWall = new THREE.BoxGeometry(0.36, 3.1, 7.5);
    backWall.translate(dnsX - 3.65, ngocY + 2.0, ngocZ);
    stuccoParts.push(backWall);

    for (const ox of [-3.4, -0.8, 1.8, 3.4]) {
      for (const oz of [-3.2, -1.1, 1.1, 3.2]) {
        if (Math.abs(ox) < 3.0 && Math.abs(oz) < 2.8) continue;
        const col = new THREE.CylinderGeometry(0.13, 0.15, 3.25, 10);
        col.translate(dnsX + ox, ngocY + 2.08, ngocZ + oz);
        vermilionParts.push(col);
      }
    }
    const dnsLintel = new THREE.BoxGeometry(0.26, 0.36, 6.8);
    dnsLintel.translate(dnsX + 3.4, ngocY + 3.62, ngocZ);
    vermilionParts.push(dnsLintel);

    // 2-tier upturned curved terracotta hipped roofs + sculpted ridge finials
    const dnsRoof1 = createVietnameseCurvedRoofGeometry(10.4, 11.2, 6.2, 6.8, 1.65, 0.42);
    dnsRoof1.translate(dnsX, ngocY + 3.68, ngocZ);
    const dnsUpperClerestory = new THREE.BoxGeometry(5.2, 1.15, 5.8);
    dnsUpperClerestory.translate(dnsX, ngocY + 5.15, ngocZ);
    vermilionParts.push(dnsUpperClerestory);
    const dnsRoof2 = createVietnameseCurvedRoofGeometry(7.2, 7.8, 1.4, 3.8, 1.55, 0.40);
    dnsRoof2.translate(dnsX, ngocY + 5.65, ngocZ);
    roofParts.push(dnsRoof1, dnsRoof2);

    const dnsFinials = createRoofFinialSetParts(dnsX, ngocY + 7.22, ngocZ, 4.2, Math.PI * 0.5, 0.72, true);
    vermilionParts.push(...dnsFinials.mainParts);
    goldParts.push(...dnsFinials.goldParts);

    const dnsPlaque = createSignagePlaqueMesh(
      {
        text: 'ĐỀN NGỌC SƠN',
        subText: '玉 山 祠',
        width: 2.35,
        height: 0.62,
        depth: 0.10,
        style: 'royal',
        motifSeed: 312
      },
      signageCtx
    );
    dnsPlaque.position.set(dnsX + 3.58, ngocY + 3.55, ngocZ);
    dnsPlaque.rotation.y = Math.PI * 0.5;
    group.add(dnsPlaque);

    // Bronze incense tripod in Đền Ngọc Sơn courtyard
    const dnsTripod = createBronzeIncenseTripodParts(79.6, ngocY + 0.36, ngocZ, 0.68);
    trimParts.push(...dnsTripod.limestoneParts);
    bronzeParts.push(...dnsTripod.bronzeParts);
    goldParts.push(...dnsTripod.goldParts);

    // 5. THÁP BÚT & ĐÀI NGHIÊN (9m Stone Brush Tower on Sculpted Rock Base at East Bank (102, 14))
    const butX = 102.0;
    const butZ = 14.0;
    const butY = getVietnamHeritageHeight(butX, butZ);

    // Núi Độc Tôn sculpted stone boulder mound supporting Tháp Bút
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rOff = k === 0 ? 0 : 1.75;
      const moundRock = createSculptedRockGeometry(410 + k * 19, k === 0 ? 2.6 : 1.55, k === 0 ? 1.85 : 1.25, k === 0 ? 2.5 : 1.45, 2);
      moundRock.translate(butX + Math.cos(a) * rOff, butY + (k === 0 ? 1.05 : 0.55), butZ + Math.sin(a) * rOff);
      rockParts.push(moundRock);
    }

    // 5 diminishing square stone tiers (total height 9.0m from mound base) + calligraphy brush-nib spire
    let tierY = butY + 2.15;
    const tierSpecs = [
      { w: 1.55, h: 1.35 },
      { w: 1.34, h: 1.25 },
      { w: 1.14, h: 1.15 },
      { w: 0.96, h: 1.05 },
      { w: 0.78, h: 0.95 }
    ];
    for (const ts of tierSpecs) {
      const body = new THREE.BoxGeometry(ts.w, ts.h, ts.w);
      body.translate(butX, tierY + ts.h * 0.5, butZ);
      stuccoParts.push(body);

      const cap = new THREE.BoxGeometry(ts.w + 0.18, 0.14, ts.w + 0.18);
      cap.translate(butX, tierY + ts.h + 0.07, butZ);
      trimParts.push(cap);
      tierY += ts.h + 0.14;
    }

    // Tapered carved stone calligraphy brush nib (*Ngọn bút*) via LatheGeometry (strictly positive radii!)
    const nibProfile = [
      new THREE.Vector2(0.32, 0.0),
      new THREE.Vector2(0.42, 0.42),
      new THREE.Vector2(0.38, 0.85),
      new THREE.Vector2(0.24, 1.35),
      new THREE.Vector2(0.10, 1.72),
      new THREE.Vector2(0.025, 1.95)
    ];
    const brushNib = new THREE.LatheGeometry(nibProfile, 14);
    brushNib.translate(butX, tierY, butZ);
    trimParts.push(brushNib);

    const taThanhThienPlaque = createSignagePlaqueMesh(
      {
        text: 'TẢ THANH THIÊN',
        subText: '寫 青 天',
        width: 0.68,
        height: 2.15,
        depth: 0.08,
        style: 'stone',
        motifSeed: 318
      },
      signageCtx
    );
    taThanhThienPlaque.position.set(butX - 0.72, butY + 4.4, butZ);
    taThanhThienPlaque.rotation.y = -Math.PI * 0.5;
    group.add(taThanhThienPlaque);

    // Đài Nghiên (Ink Slab Gate) at (101.2, 7.8) between Tháp Bút & Cầu Thê Húc entrance
    const dnX = 101.2;
    const dnZ = 7.8;
    const dnY = getVietnamHeritageHeight(dnX, dnZ);
    for (const sx of [-1.25, 1.25]) {
      const dnPier = new THREE.BoxGeometry(0.68, 3.1, 0.68);
      dnPier.translate(dnX + sx, dnY + 1.55, dnZ);
      stuccoParts.push(dnPier);
    }
    const dnLintel = new THREE.BoxGeometry(3.3, 0.42, 0.82);
    dnLintel.translate(dnX, dnY + 3.25, dnZ);
    trimParts.push(dnLintel);
    // Carved peach-shaped stone inkstone borne by 3 stone toads atop Đài Nghiên
    const inkSlab = new THREE.SphereGeometry(0.68, 12, 8);
    inkSlab.scale(1.25, 0.46, 0.92);
    inkSlab.translate(dnX, dnY + 3.74, dnZ);
    trimParts.push(inkSlab);

    // 6. Weeping Willow (*Liễu rủ*) Clusters gracefully framing Hoàn Kiếm Lakeshore
    const willowBarkParts: THREE.BufferGeometry[] = [];
    const willowFrondParts: THREE.BufferGeometry[] = [];
    const wRand = mulberry32(449911);
    const willowSpots: Array<[number, number, number]> = [
      [31.0, 42.0, 1.05],
      [33.5, 4.0, 0.98],
      [96.5, 34.0, 1.12],
      [88.0, 52.0, 1.08],
      [66.0, -10.5, 1.02]
    ];
    for (const [wx, wz, ws] of willowSpots) {
      const wy = getVietnamHeritageHeight(wx, wz);
      if (wy < 0.05) continue;
      const trunk = new THREE.CylinderGeometry(0.18 * ws, 0.34 * ws, 3.6 * ws, 8);
      trunk.rotateZ(0.16 * (wx > 62 ? 1 : -1));
      trunk.translate(wx, wy + 1.7 * ws, wz);
      willowBarkParts.push(trunk);

      for (let b = 0; b < 5; b++) {
        const a = (b / 5) * Math.PI * 2 + wRand() * 0.5;
        const reach = (1.6 + wRand() * 0.9) * ws;
        const br = new THREE.CylinderGeometry(0.06 * ws, 0.12 * ws, reach, 6);
        br.rotateZ(0.85);
        br.rotateY(a);
        br.translate(wx + Math.cos(a) * reach * 0.45, wy + 3.3 * ws, wz + Math.sin(a) * reach * 0.45);
        willowBarkParts.push(br);

        // Drooping vertical weeping-willow foliage curtains
        for (let f = 0; f < 3; f++) {
          const fa = a + (f - 1) * 0.35;
          const fx = wx + Math.cos(fa) * (1.2 + f * 0.55) * ws;
          const fz = wz + Math.sin(fa) * (1.2 + f * 0.55) * ws;
          const frond = new THREE.PlaneGeometry(1.35 * ws, 3.1 * ws);
          frond.rotateY(fa + f * 0.7);
          frond.translate(fx, wy + 2.55 * ws, fz);
          willowFrondParts.push(frond);
        }
      }
    }

    // Merge all Hoàn Kiếm / Tháp Rùa / Cầu Thê Húc / Đền Ngọc Sơn / Tháp Bút geometry batches
    if (rockParts.length > 0) {
      const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), rockMat);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      group.add(rockMesh);
    }
    if (stuccoParts.length > 0) {
      const stuccoMesh = new THREE.Mesh(mergeNormalized(stuccoParts), mossyStuccoMat);
      stuccoMesh.castShadow = true;
      stuccoMesh.receiveShadow = true;
      group.add(stuccoMesh);
    }
    if (trimParts.length > 0) {
      const trimMesh = new THREE.Mesh(mergeNormalized(trimParts), trimMat);
      trimMesh.castShadow = true;
      trimMesh.receiveShadow = true;
      group.add(trimMesh);
    }
    if (vermilionParts.length > 0) {
      const vermilionMesh = new THREE.Mesh(mergeNormalized(vermilionParts), vermilionBridgeMat);
      vermilionMesh.castShadow = true;
      vermilionMesh.receiveShadow = true;
      group.add(vermilionMesh);
    }
    if (deckParts.length > 0) {
      const deckMesh = new THREE.Mesh(mergeNormalized(deckParts), bridgeDeckMat);
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;
      group.add(deckMesh);
    }
    if (roofParts.length > 0) {
      const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), templeRoofMat);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      group.add(roofMesh);
    }
    if (bronzeParts.length > 0) {
      const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), templeBronzeMat);
      bronzeMesh.castShadow = true;
      group.add(bronzeMesh);
    }
    if (goldParts.length > 0) {
      const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMat);
      goldMesh.castShadow = true;
      group.add(goldMesh);
    }
    if (bulbParts.length > 0) {
      group.add(new THREE.Mesh(mergeNormalized(bulbParts), stringLightMat));
    }
    if (bridgeLightPools.length > 0) {
      const bridgePoolHandle = this.sharedShaders
        ? this.sharedShaders.warmLightPool
        : createWarmLightPoolMaterial();
      if (!this.sharedShaders) {
        this.extraMaterials.push(bridgePoolHandle.material);
        this.extraAnimatedUniforms.push(bridgePoolHandle.uniforms);
      }
      group.add(new THREE.Mesh(mergeNormalized(bridgeLightPools), bridgePoolHandle.material));
    }
    if (willowBarkParts.length > 0) {
      const wbMesh = new THREE.Mesh(mergeNormalized(willowBarkParts), willowBarkMat);
      wbMesh.castShadow = true;
      group.add(wbMesh);
    }
    if (willowFrondParts.length > 0) {
      const wfMesh = new THREE.Mesh(mergeNormalized(willowFrondParts), willowFrondMat);
      wfMesh.castShadow = true;
      group.add(wfMesh);
    }

    this.scene.add(group);
  }

  /**
   * Builds Cầu Vàng (Golden Bridge — Bà Nà Hills) at true 1:1 scale: 150m curved span (x ∈ [-75, +75]),
   * 5.4m wide deck with continuous purple Lobelia flowerbed troughs, authentic gold pipe/cable railings,
   * 8 slender gold support columns, Bug B4 granite abutment piers, anatomically sculpted 26m Giant Hands
   * (knuckles, fingertips with stone fingernails, palm creases, wrist cuffs, weathered fissures),
   * West bluff Marseille Cable Car Station (-82, -145) & East bluff Le Jardin d'Amour archway (+82, -145).
   */
  private buildGoldenBridgeAndGiantHands(
    pbr: ReturnType<typeof this.createPbrAssets>,
    renderer?: THREE.WebGLRenderer
  ): void {
    const group = new THREE.Group();
    group.name = 'GoldenBridgeComplex';

    this.exclusionCircles.push(
      { x: -78, z: -145, r: 16.0 },
      { x: -84, z: -145, r: 15.0 },
      { x: 78, z: -145, r: 16.0 },
      { x: 84, z: -145, r: 15.0 },
      { x: -32, z: -143, r: 14.0 },
      { x: 32, z: -143, r: 14.0 }
    );

    const signageCtx = {
      extraTextures: this.extraTextures,
      extraMaterials: this.extraMaterials,
      signageAtlas: this.signageAtlas ?? undefined
    };

    const goldPbr = createGoldenBridgeMetalPbrTextures(256, renderer);
    this.extraTextures.push(goldPbr.map, goldPbr.normalMap, goldPbr.roughnessMap);

    const goldMetalMat = new THREE.MeshStandardMaterial({
      color: '#f2c14e',
      map: goldPbr.map,
      normalMap: goldPbr.normalMap,
      roughnessMap: goldPbr.roughnessMap,
      metalness: 0.86,
      roughness: 0.25
    });
    const teakDeckMat = new THREE.MeshStandardMaterial({
      color: '#8f5d38',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.68
    });
    const lobeliaMat = new THREE.MeshStandardMaterial({
      color: '#7a3ec4',
      emissive: '#2c1052',
      emissiveIntensity: 0.32,
      roughness: 0.72
    });
    const planterFoliageMat = new THREE.MeshStandardMaterial({
      color: '#2e6832',
      roughness: 0.78
    });
    const chateauStoneMat = new THREE.MeshStandardMaterial({
      color: '#d9d1c2',
      map: pbr.stone.map,
      normalMap: pbr.stone.normalMap,
      roughnessMap: pbr.stone.roughnessMap,
      roughness: 0.76
    });
    const slateRoofMat = new THREE.MeshStandardMaterial({
      color: '#2e4663',
      map: pbr.darkRoof.map,
      normalMap: pbr.darkRoof.normalMap,
      roughnessMap: pbr.darkRoof.roughnessMap,
      roughness: 0.56,
      metalness: 0.14
    });
    const roseBlossomMat = new THREE.MeshStandardMaterial({
      color: '#e85a8a',
      emissive: '#4d142a',
      emissiveIntensity: 0.28,
      roughness: 0.64
    });
    const stoneHandMat = new THREE.MeshStandardMaterial({
      color: '#959184',
      map: pbr.granite.map,
      normalMap: pbr.granite.normalMap,
      roughnessMap: pbr.granite.roughnessMap,
      roughness: 0.90
    });
    applyWorldSpaceWeathering(stoneHandMat, {
      macroScale: 0.22,
      mossHeight: 20.0,
      mossColor: '#486634',
      dampRoughness: 0.72
    });

    this.extraMaterials.push(
      goldMetalMat,
      teakDeckMat,
      lobeliaMat,
      planterFoliageMat,
      chateauStoneMat,
      slateRoofMat,
      roseBlossomMat,
      stoneHandMat
    );

    // 1. Curved 150m Golden Bridge Deck (5.4m wide), Purple Lobelia Flowerbeds & Authentic Gold Pipe/Cable Railings
    const deckParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const lobeliaParts: THREE.BufferGeometry[] = [];
    const planterLeafParts: THREE.BufferGeometry[] = [];
    const abutmentRockParts: THREE.BufferGeometry[] = [];
    const chateauParts: THREE.BufferGeometry[] = [];
    const slateParts: THREE.BufferGeometry[] = [];
    const roseParts: THREE.BufferGeometry[] = [];

    const segs = 48;
    const deckHalfW = 2.7; // 5.4m total width
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = THREE.MathUtils.lerp(-75, 75, t0);
      const x1 = THREE.MathUtils.lerp(-75, 75, t1);
      const c0 = getGoldenBridgeCurveAtX(x0);
      const c1 = getGoldenBridgeCurveAtX(x1);

      const xm = (x0 + x1) * 0.5;
      const ym = (c0.y + c1.y) * 0.5;
      const zm = (c0.z + c1.z) * 0.5;
      const dx = x1 - x0;
      const dy = c1.y - c0.y;
      const dz = c1.z - c0.z;
      const segLen = Math.hypot(dx, dy, dz) + 0.06;
      const yaw = -Math.atan2(dz, dx);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));

      const orient = (g: THREE.BufferGeometry) => {
        g.rotateZ(pitch);
        g.rotateY(yaw);
        g.translate(xm, ym, zm);
        return g;
      };

      // Teak timber central walkway deck (4.0m clear walk path flanked by twin Lobelia flowerbed troughs)
      const deckSeg = new THREE.BoxGeometry(segLen, 0.24, deckHalfW * 2 - 1.38);
      deckParts.push(orient(deckSeg));

      // Gleaming gold undercarriage box & structural ribs
      const underBeam = new THREE.BoxGeometry(segLen, 0.62, deckHalfW * 1.72);
      underBeam.translate(0, -0.40, 0);
      goldParts.push(orient(underBeam));

      for (const side of [-1, 1]) {
        // Sculpted golden outer fascia skirt + perforated vertical trim ribs
        const fascia = new THREE.BoxGeometry(segLen, 0.86, 0.34);
        fascia.translate(0, -0.18, side * deckHalfW);
        goldParts.push(orient(fascia));

        // Continuous planter trough lining both edges of the teak walkway
        const troughZ = side * (deckHalfW - 0.42);
        const troughWall = new THREE.BoxGeometry(segLen, 0.28, 0.54);
        troughWall.translate(0, 0.14, troughZ);
        goldParts.push(orient(troughWall));

        const greenBed = new THREE.BoxGeometry(segLen * 0.98, 0.16, 0.46);
        greenBed.translate(0, 0.29, troughZ);
        planterLeafParts.push(orient(greenBed));

        // Purple Lobelia Chrysanthemum flower clusters overflowing both planter troughs
        for (const fOff of [-0.28, 0.28]) {
          const bloom = new THREE.SphereGeometry(0.24, 7, 5);
          bloom.scale(1.65, 0.65, 0.92);
          bloom.translate(fOff * segLen, 0.40, troughZ);
          lobeliaParts.push(orient(bloom));
        }

        // Authentic slender gold pipe/cable railings (replacing glass panels!)
        const railZ = side * (deckHalfW - 0.06);
        const topPipe = new THREE.CylinderGeometry(0.044, 0.044, segLen, 8);
        topPipe.rotateZ(Math.PI * 0.5);
        topPipe.translate(0, 1.24, railZ);
        goldParts.push(orient(topPipe));

        for (const fracY of [0.36, 0.62, 0.88, 1.08]) {
          const cable = new THREE.CylinderGeometry(0.016, 0.016, segLen, 6);
          cable.rotateZ(Math.PI * 0.5);
          cable.translate(0, fracY, railZ);
          goldParts.push(orient(cable));
        }

        for (const pOff of [-0.25, 0.25]) {
          const post = new THREE.CylinderGeometry(0.034, 0.038, 1.18, 6);
          post.translate(pOff * segLen, 0.66, railZ);
          goldParts.push(orient(post));
        }
      }
    }

    // 8 Slender Gold Steel Support Columns along the curved span (avoiding Giant Hands at ±32)
    for (const colX of [-62, -48, -18, -6, 6, 18, 48, 62]) {
      const cc = getGoldenBridgeCurveAtX(colX);
      const groundY = getVietnamHeritageHeight(colX, cc.z);
      const colTop = cc.y - 0.58;
      const colBot = groundY - 1.5;
      const colH = Math.max(2.0, colTop - colBot);

      const shaft = new THREE.CylinderGeometry(0.32, 0.44, colH, 10);
      shaft.translate(colX, colBot + colH * 0.5, cc.z);
      goldParts.push(shaft);

      const capital = new THREE.CylinderGeometry(0.92, 0.36, 0.85, 10);
      capital.translate(colX, colTop - 0.35, cc.z);
      goldParts.push(capital);

      const footing = new THREE.CylinderGeometry(0.95, 1.25, 2.2, 8);
      footing.translate(colX, groundY + 0.1, cc.z);
      abutmentRockParts.push(footing);
    }

    // FIX Bug B4: Move 6.2 × pierH × 6.2m end abutment piers into stone (abutmentRockParts), NOT teak deckParts!
    for (const ax of [-75, 75]) {
      const sign = ax < 0 ? -1 : 1;
      const ac = getGoldenBridgeCurveAtX(ax);
      const pierBottom = 1.0;
      const pierH = ac.y - pierBottom;
      const pier = new THREE.BoxGeometry(6.2, pierH, 6.2);
      pier.translate(ax + sign * 2.5, pierBottom + pierH * 0.5, ac.z);
      abutmentRockParts.push(pier);

      const pierCap = new THREE.BoxGeometry(6.8, 0.48, 6.8);
      pierCap.translate(ax + sign * 2.5, ac.y - 0.12, ac.z);
      chateauParts.push(pierCap);

      // Gold pipe railings guarding both bluff arrival terraces
      for (const sz of [-2.85, 2.85]) {
        goldParts.push(
          ...createPiercedBalustradeParts(
            ax + sign * 0.2,
            ac.z + sz,
            ax + sign * 5.2,
            ac.z + sz,
            ac.y + 0.10,
            1.12,
            'gold_pipe'
          )
        );
      }

      // Sculpted mossy granite cliff buttresses wrapping (±78, -145)
      const rockButtress = createSculptedRockGeometry(ax < 0 ? 501 : 601, 7.2, 13.5, 6.8, 3);
      rockButtress.translate(ax + sign * 4.0, ac.y - 11.5, ac.z);
      abutmentRockParts.push(rockButtress);
    }

    // 2. WEST BLUFF — MARSEILLE CABLE CAR STATION (-82, -145): French-Chateau Stone Facade & Blue Slate Roof
    const marX = -83.5;
    const marZ = -145.0;
    const marY = getGoldenBridgeCurveAtX(-75).y; // 22.8m

    // Grounded stone station foundation skirt
    const marBase = new THREE.BoxGeometry(11.6, 8.2, 13.2);
    marBase.translate(marX, marY - 3.9, marZ);
    abutmentRockParts.push(marBase);

    // French-chateau stone facade walls with arched portal facing East onto the Golden Bridge
    const marFrontArch = createArchedWallGeometry(12.2, 6.4, 0.72, 4.4, 4.8);
    marFrontArch.rotateY(Math.PI * 0.5);
    marFrontArch.translate(marX + 5.2, marY, marZ);
    chateauParts.push(marFrontArch);

    const marBackWall = new THREE.BoxGeometry(0.72, 6.4, 12.2);
    marBackWall.translate(marX - 5.2, marY + 3.2, marZ);
    chateauParts.push(marBackWall);

    for (const side of [-1, 1]) {
      const sideArchWall = createArchedWallGeometry(10.8, 6.4, 0.68, 3.2, 3.8);
      sideArchWall.translate(marX, marY, marZ + side * 5.85);
      chateauParts.push(sideArchWall);

      // Twin French chateau cylindrical stone corner turrets + conical blue slate spires
      const turret = new THREE.CylinderGeometry(1.55, 1.65, 8.2, 12);
      turret.translate(marX + 4.8, marY + 4.1, marZ + side * 5.85);
      chateauParts.push(turret);

      const turretSpire = new THREE.ConeGeometry(1.88, 3.9, 12);
      turretSpire.translate(marX + 4.8, marY + 10.1, marZ + side * 5.85);
      slateParts.push(turretSpire);

      const finial = new THREE.CylinderGeometry(0.05, 0.08, 0.85, 6);
      finial.translate(marX + 4.8, marY + 12.3, marZ + side * 5.85);
      goldParts.push(finial);
    }

    // Mansard blue slate pitched roof over Marseille Station
    const mansardLower = new THREE.CylinderGeometry(4.6, 6.8, 3.2, 4);
    mansardLower.rotateY(Math.PI * 0.25);
    mansardLower.scale(1.15, 1.0, 1.32);
    mansardLower.translate(marX, marY + 7.9, marZ);
    slateParts.push(mansardLower);

    const marPlaque = createSignagePlaqueMesh(
      {
        text: 'GA MARSEILLE',
        subText: 'BÀ NÀ HILLS CABLE CAR',
        width: 3.4,
        height: 0.76,
        depth: 0.12,
        style: 'bronze',
        motifSeed: 401
      },
      signageCtx
    );
    marPlaque.position.set(marX + 5.65, marY + 5.55, marZ);
    marPlaque.rotation.y = Math.PI * 0.5;
    group.add(marPlaque);

    // Suspended cable-car line & 2 panoramic gold/slate cable cabins gliding westward from Marseille Station
    for (const [cxOff, cyOff] of [
      [-10.5, 1.2],
      [-19.5, -1.8]
    ]) {
      const cabX = marX + cxOff;
      const cabY = marY + cyOff;
      const hanger = new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6);
      hanger.translate(cabX, cabY + 1.55, marZ);
      goldParts.push(hanger);

      const cabBody = new THREE.BoxGeometry(2.3, 1.85, 1.65);
      cabBody.translate(cabX, cabY, marZ);
      slateParts.push(cabBody);

      const cabTrim = new THREE.BoxGeometry(2.42, 0.24, 1.76);
      cabTrim.translate(cabX, cabY + 0.88, marZ);
      goldParts.push(cabTrim);
    }
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(marX - 4.8, marY + 4.4, marZ),
      new THREE.Vector3(marX - 15.0, marY + 1.6, marZ),
      new THREE.Vector3(marX - 28.0, marY - 3.2, marZ)
    ]);
    goldParts.push(new THREE.TubeGeometry(cableCurve, 12, 0.055, 6, false));

    // 3. EAST BLUFF — LE JARDIN D'AMOUR FLORAL ARCHWAY & GARDEN STAIRS (+82, -145)
    const jarX = 82.0;
    const jarZ = -145.0;
    const jarY = getGoldenBridgeCurveAtX(75).y; // 22.8m

    // Classical stone arrival terrace + stepped garden stairs descending East
    const jarTerrace = new THREE.BoxGeometry(7.2, 5.2, 8.6);
    jarTerrace.translate(jarX, jarY - 2.55, jarZ);
    abutmentRockParts.push(jarTerrace);

    for (let s = 0; s < 6; s++) {
      const step = new THREE.BoxGeometry(0.72, 0.28, 6.0);
      step.translate(jarX + 3.8 + s * 0.68, jarY - 0.12 - s * 0.22, jarZ);
      chateauParts.push(step);
    }

    // Ornate classical white-stone & gold floral triumphal archway spanning bridge exit
    const archWall = createArchedWallGeometry(7.2, 5.8, 0.95, 4.4, 4.6);
    archWall.rotateY(Math.PI * 0.5);
    archWall.translate(jarX, jarY, jarZ);
    chateauParts.push(archWall);

    const archCornice = new THREE.BoxGeometry(1.45, 0.45, 7.8);
    archCornice.translate(jarX, jarY + 5.95, jarZ);
    chateauParts.push(archCornice);

    // Cascading purple Lobelia & pink rose floral garlands draped across Le Jardin d'Amour archway
    for (let k = 0; k < 11; k++) {
      const frac = k / 10;
      const a = Math.PI * frac;
      const fz = jarZ + Math.cos(a) * 2.45;
      const fy = jarY + 2.45 + Math.sin(a) * 2.45;
      const garland = new THREE.SphereGeometry(0.36, 7, 5);
      garland.scale(1.1, 0.85, 1.0);
      garland.translate(jarX - 0.52, fy, fz);
      (k % 2 === 0 ? roseParts : lobeliaParts).push(garland);
    }
    for (const side of [-1, 1]) {
      const urnPed = new THREE.BoxGeometry(1.1, 1.0, 1.1);
      urnPed.translate(jarX - 1.6, jarY + 0.5, jarZ + side * 3.4);
      chateauParts.push(urnPed);
      const urnFlowers = new THREE.SphereGeometry(0.62, 8, 6);
      urnFlowers.scale(1.0, 0.72, 1.0);
      urnFlowers.translate(jarX - 1.6, jarY + 1.25, jarZ + side * 3.4);
      roseParts.push(urnFlowers);
    }

    const jarPlaque = createSignagePlaqueMesh(
      {
        text: "LE JARDIN D'AMOUR",
        subText: 'VƯỜN HOA TÌNH YÊU',
        width: 3.6,
        height: 0.72,
        depth: 0.12,
        style: 'royal',
        motifSeed: 405
      },
      signageCtx
    );
    jarPlaque.position.set(jarX - 0.58, jarY + 5.25, jarZ);
    jarPlaque.rotation.y = -Math.PI * 0.5;
    group.add(jarPlaque);

    if (abutmentRockParts.length > 0) {
      const abutmentRocksMesh = new THREE.Mesh(mergeNormalized(abutmentRockParts), stoneHandMat);
      abutmentRocksMesh.castShadow = true;
      abutmentRocksMesh.receiveShadow = true;
      group.add(abutmentRocksMesh);
    }
    if (deckParts.length > 0) {
      const deckMesh = new THREE.Mesh(mergeNormalized(deckParts), teakDeckMat);
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;
      group.add(deckMesh);
    }
    if (goldParts.length > 0) {
      const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMetalMat);
      goldMesh.castShadow = true;
      goldMesh.receiveShadow = true;
      group.add(goldMesh);
    }
    if (planterLeafParts.length > 0) {
      group.add(new THREE.Mesh(mergeNormalized(planterLeafParts), planterFoliageMat));
    }
    if (lobeliaParts.length > 0) {
      group.add(new THREE.Mesh(mergeNormalized(lobeliaParts), lobeliaMat));
    }
    if (chateauParts.length > 0) {
      const chateauMesh = new THREE.Mesh(mergeNormalized(chateauParts), chateauStoneMat);
      chateauMesh.castShadow = true;
      chateauMesh.receiveShadow = true;
      group.add(chateauMesh);
    }
    if (slateParts.length > 0) {
      const slateMesh = new THREE.Mesh(mergeNormalized(slateParts), slateRoofMat);
      slateMesh.castShadow = true;
      group.add(slateMesh);
    }
    if (roseParts.length > 0) {
      group.add(new THREE.Mesh(mergeNormalized(roseParts), roseBlossomMat));
    }

    // 4. TWO Monumental 26m-tall Anatomically Sculpted Mossy Stone Giant Hands rising from (±32, -143)
    const handParts: THREE.BufferGeometry[] = [];

    const buildGiantHand = (handX: number, mirrorX: number, seedBase: number) => {
      const bc = getGoldenBridgeCurveAtX(handX);
      const palmY = bc.y - 1.15;
      const palmZ = bc.z;

      // Grounded cliff shoulder rock around the (±32, -143) pedestal
      const shoulder = createSculptedRockGeometry(seedBase + 7, 6.2, 6.5, 5.8, 3);
      shoulder.translate(handX - mirrorX * 1.5, 6.2, -143.0);
      handParts.push(shoulder);

      // Massive 26m weathered stone forearm with deep weathered rock fissures
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(handX - mirrorX * 2.5, 2.0, -143.0),
        new THREE.Vector3(handX - mirrorX * 1.6, 9.5, -147.2),
        new THREE.Vector3(handX - mirrorX * 0.6, 16.5, -152.2),
        new THREE.Vector3(handX, palmY - 0.5, palmZ)
      ]);
      const armGeo = new THREE.TubeGeometry(armCurve, 26, 3.25, 16, false);
      const armPos = armGeo.attributes.position;
      for (let i = 0; i < armPos.count; i++) {
        const vx = armPos.getX(i);
        const vy = armPos.getY(i);
        const vz = armPos.getZ(i);
        const crag = noise2D(vx * 0.42 + vy * 0.28, vz * 0.42 - vy * 0.22, seedBase);
        const fissure = Math.abs(noise2D(vx * 0.95, vy * 0.55 + vz * 0.65, seedBase + 13)) < 0.14 ? -0.34 : 0.0;
        armPos.setXYZ(i, vx + (crag * 0.42 + fissure), vy, vz + (crag * 0.42 + fissure));
      }
      armGeo.computeVertexNormals();
      handParts.push(armGeo);

      // Sculpted stone wrist cuff bands & weathered stone fracture collars
      const wristPt = armCurve.getPoint(0.76);
      for (let w = 0; w < 2; w++) {
        const cuff = new THREE.TorusGeometry(3.38 - w * 0.14, 0.36, 8, 16);
        cuff.rotateX(Math.PI * 0.38);
        cuff.translate(wristPt.x, wristPt.y + w * 0.95, wristPt.z - w * 0.35);
        handParts.push(cuff);
      }

      // Sculpted stone palm cradling the underside of the Golden Bridge + palm crease bands
      const palmGeo = createSculptedRockGeometry(seedBase + 19, 5.5, 2.05, 4.7, 3);
      palmGeo.translate(handX, palmY - 0.85, palmZ);
      handParts.push(palmGeo);

      for (let crease = -1; crease <= 1; crease++) {
        const band = new THREE.BoxGeometry(6.8, 0.32, 0.42);
        band.rotateY(mirrorX * 0.16);
        band.translate(handX, palmY - 0.12, palmZ + crease * 1.15);
        handParts.push(band);
      }

      // 4 Articulated Giant Fingers curving cleanly up along the front (+Z) golden fascia
      // with distinct sculpted knuckle joints (MCP/PIP/DIP), tapered fingertips & stone fingernails
      const fingerSpecs = [
        { dx: -3.30 * mirrorX, len: 5.0, rBase: 0.84, rTip: 0.54 },
        { dx: -1.12 * mirrorX, len: 5.7, rBase: 0.92, rTip: 0.58 },
        { dx: 1.15 * mirrorX, len: 5.3, rBase: 0.86, rTip: 0.54 },
        { dx: 3.35 * mirrorX, len: 4.4, rBase: 0.74, rTip: 0.46 }
      ];
      fingerSpecs.forEach((f, idx) => {
        const fx = handX + f.dx;
        const fc = getGoldenBridgeCurveAtX(fx);
        const fz = (palmZ + fc.z) * 0.5;
        const fy = fc.y - 1.15;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(fx, fy - 0.5, fz + 2.75),
          new THREE.Vector3(fx, fy + 0.55, fz + 4.10),
          new THREE.Vector3(fx, fy + 2.0 + f.len * 0.35, fz + 3.90),
          new THREE.Vector3(fx, fy + 2.8 + f.len * 0.55, fz + 3.05)
        ]);
        const fGeo = new THREE.TubeGeometry(curve, 18, f.rBase, 12, false);
        const fPos = fGeo.attributes.position;
        for (let i = 0; i < fPos.count; i++) {
          const vx = fPos.getX(i);
          const vy = fPos.getY(i);
          const vz = fPos.getZ(i);
          const rock = noise2D(vx * 1.1 + vy, vz * 1.1, seedBase + 40 + idx * 7);
          const hFrac = clamp01((vy - (palmY - 0.6)) / 5.4);
          const taper = 1.0 - hFrac * 0.32 + Math.sin(hFrac * Math.PI * 3.0) * 0.11;
          fPos.setXYZ(
            i,
            fx + (vx - fx) * taper + rock * 0.12,
            vy,
            vz + rock * 0.12
          );
        }
        fGeo.computeVertexNormals();
        handParts.push(fGeo);

        // Distinct sculpted knuckle joints (MCP, PIP, DIP) along finger phalanges
        for (const [kt, kr] of [
          [0.24, f.rBase * 1.08],
          [0.56, f.rBase * 0.94],
          [0.82, f.rBase * 0.78]
        ] as const) {
          const kp = curve.getPoint(kt);
          const knuckle = createSculptedRockGeometry(seedBase + 60 + idx * 5 + Math.round(kt * 10), kr, kr * 0.82, kr * 1.05, 1);
          knuckle.translate(kp.x, kp.y, kp.z + 0.12);
          handParts.push(knuckle);
        }

        // Tapered fingertip cap + carved stone fingernail plate on dorsal face
        const tipPt = curve.getPoint(1.0);
        const tipCap = createSculptedRockGeometry(seedBase + 90 + idx, f.rTip, f.rTip * 1.15, f.rTip * 0.92, 2);
        tipCap.translate(tipPt.x, tipPt.y, tipPt.z);
        handParts.push(tipCap);

        const nailPlate = new THREE.BoxGeometry(f.rTip * 1.18, f.rTip * 1.28, 0.14);
        nailPlate.rotateX(-0.22);
        nailPlate.translate(tipPt.x, tipPt.y + f.rTip * 0.15, tipPt.z + f.rTip * 0.86);
        handParts.push(nailPlate);
      });

      // Articulated Thumb arching from the northern/inner side of the palm with knuckle joints & stone thumbnail
      const thumbX = handX - mirrorX * 4.0;
      const thumbCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(handX - mirrorX * 2.3, palmY - 0.8, palmZ - 2.0),
        new THREE.Vector3(thumbX, palmY + 0.2, palmZ - 3.60),
        new THREE.Vector3(thumbX - mirrorX * 0.3, palmY + 2.0, palmZ - 3.45),
        new THREE.Vector3(thumbX, palmY + 3.1, palmZ - 2.55)
      ]);
      const thumbGeo = new THREE.TubeGeometry(thumbCurve, 14, 0.90, 12, false);
      handParts.push(thumbGeo);
      for (const kt of [0.35, 0.72]) {
        const kp = thumbCurve.getPoint(kt);
        const tKnuckle = createSculptedRockGeometry(seedBase + 120 + Math.round(kt * 10), 0.94, 0.78, 0.94, 1);
        tKnuckle.translate(kp.x, kp.y, kp.z);
        handParts.push(tKnuckle);
      }
      const thumbTip = thumbCurve.getPoint(1.0);
      const thumbCap = createSculptedRockGeometry(seedBase + 131, 0.72, 0.78, 0.72, 2);
      thumbCap.translate(thumbTip.x, thumbTip.y, thumbTip.z);
      handParts.push(thumbCap);

      const thumbNail = new THREE.BoxGeometry(0.84, 0.92, 0.14);
      thumbNail.rotateX(0.24);
      thumbNail.translate(thumbTip.x, thumbTip.y + 0.12, thumbTip.z - 0.66);
      handParts.push(thumbNail);
    };

    buildGiantHand(-32.0, 1.0, 701);
    buildGiantHand(32.0, -1.0, 809);

    const handsMesh = new THREE.Mesh(mergeNormalized(handParts), stoneHandMat);
    handsMesh.name = 'GoldenBridgeGiantHands';
    handsMesh.castShadow = true;
    handsMesh.receiveShadow = true;
    group.add(handsMesh);

    this.scene.add(group);
  }

  /**
   * Builds Vịnh Hạ Long (42 towering 48–85m stratified limestone karsts + Hòn Trống Mái)
   * across z = -310..-860, x = -640..+640 with tropical jungle crown foliage & 3 sailing 22m
   * Wooden Junk Boats (*Thuyền Buồm Cánh Dơi*) orbiting cleanly in open bay z in [-360..-580].
   */
  private buildHaLongBayAndJunkBoats(
    pbr: ReturnType<typeof this.createPbrAssets>,
    renderer?: THREE.WebGLRenderer
  ): void {
    const group = new THREE.Group();
    group.name = 'HaLongBayComplex';

    const karstMat = new THREE.MeshStandardMaterial({
      color: '#7f7d72',
      map: pbr.granite.map,
      normalMap: pbr.granite.normalMap,
      roughnessMap: pbr.granite.roughnessMap,
      roughness: 0.90
    });
    applyWorldSpaceWeathering(karstMat, {
      macroScale: 0.12,
      mossHeight: 6.5,
      mossColor: '#36582a',
      dampRoughness: 0.42
    });
    this.extraMaterials.push(karstMat);

    const karstParts: THREE.BufferGeometry[] = [];
    const foliageAnchors: Array<{ x: number; y: number; z: number; scale: number }> = [];

    // 1. Iconic Hòn Trống Mái (Kissing Rocks) centered at (-28, -410)
    const roosterKarst = createHaLongKarstGeometry(41, 8.8, 40.0, 5.2, 0.8);
    roosterKarst.translate(-35.5, -2.5, -410.0);
    karstParts.push(roosterKarst);
    foliageAnchors.push({ x: -31.0, y: 34.5, z: -409.2, scale: 4.8 });

    const henKarst = createHaLongKarstGeometry(47, 8.2, 36.0, -5.0, -0.6);
    henKarst.translate(-20.5, -2.5, -410.0);
    karstParts.push(henKarst);
    foliageAnchors.push({ x: -24.5, y: 31.0, z: -410.5, scale: 4.4 });

    // 1.2 Iconic Hòn Đỉnh Hương (Incense Burner Islet - 200,000 VND Banknote Icon) at (36, -435)
    // Twin weathered limestone pillar legs rising through water with clear sea-notch wave gap
    const leg1 = createHaLongKarstGeometry(55, 2.2, 9.8, -1.8, 0.2);
    leg1.translate(33.2, -2.5, -435.0);
    const leg2 = createHaLongKarstGeometry(56, 2.1, 9.8, 1.8, -0.2);
    leg2.translate(38.8, -2.5, -435.0);
    // Broad 16m-wide trapezoidal flat-topped incense burner block expanding above high-tide (y = 6.8 to 19.5m)
    const burnerUpper = createHaLongKarstGeometry(57, 8.8, 13.8, 0.2, 0.3);
    burnerUpper.scale(1.42, 0.95, 0.84);
    burnerUpper.translate(36.0, 6.8, -435.0);
    karstParts.push(leg1, leg2, burnerUpper);
    foliageAnchors.push(
      { x: 31.5, y: 19.5, z: -434.5, scale: 4.2 },
      { x: 40.5, y: 19.2, z: -435.5, scale: 3.8 },
      { x: 36.0, y: 20.0, z: -435.0, scale: 4.5 }
    );

    const boatConfigs = [
      { cx: -68, cz: -385, rx: 38, rz: 20, speed: 0.055, phase: 0.2, scale: 2.52 },
      { cx: 74, cz: -445, rx: 44, rz: 24, speed: 0.048, phase: 2.3, scale: 2.48 },
      { cx: 145, cz: -515, rx: 52, rz: 26, speed: 0.042, phase: 4.1, scale: 2.60 }
    ];

    // 2. 42 Towering 48–85m-tall Stratified Limestone Karsts scattered across Hạ Long Bay
    const rand = mulberry32(99104);
    let karstCount = 0;
    for (let i = 0; i < 140 && karstCount < 42; i++) {
      const band = karstCount / 42;
      const kx = (rand() - 0.5) * 1240; // x in [-620, +620]
      const kz = -315 - band * 525 - rand() * 35; // z in [-315, -860]

      // Keep central foreground vista channel open & clear of Hòn Trống Mái, Hòn Đỉnh Hương, added bay icons, Fansipan/Lũng Cú & outer macro sanctuaries
      if (Math.abs(kx) < 52 && kz > -395) continue;
      if (Math.hypot(kx + 28, kz + 410) < 34) continue;
      if (Math.hypot(kx - 36, kz + 435) < 32) continue;
      if (Math.hypot(kx + 92, kz + 348) < 28) continue;
      if (Math.hypot(kx - 108, kz + 362) < 32) continue;
      if (Math.hypot(kx - 134, kz + 418) < 28) continue;
      if (Math.hypot(kx + 380, kz + 340) < 62) continue;
      if (Math.hypot(kx - 400, kz + 330) < 76) continue;
      if (Math.hypot(kx, kz + 560) < 126) continue;
      if (Math.hypot(kx, kz + 320) < 148) continue;
      if (Math.hypot(kx + 560, kz + 640) < 215) continue;
      if (Math.hypot(kx + 240, kz + 760) < 235) continue;
      if (kx > 450 && kz > -455) continue;
      if (boatConfigs.some((bc) => Math.hypot((kx - bc.cx) / (bc.rx + 22), (kz - bc.cz) / (bc.rz + 22)) < 1.0)) {
        continue;
      }

      const rad = 11.0 + rand() * 14.0;
      const h = 48.0 + rand() * 37.0; // 48–85m tall!
      const kGeo = createHaLongKarstGeometry(
        100 + i * 29,
        rad,
        h,
        (rand() - 0.5) * 5.2,
        (rand() - 0.5) * 5.2
      );
      kGeo.translate(kx, -2.5, kz);
      karstParts.push(kGeo);

      const crownCount = 6 + Math.floor(rand() * 5);
      for (let c = 0; c < crownCount; c++) {
        const ang = rand() * Math.PI * 2;
        const rOff = rand() * rad * 0.45;
        foliageAnchors.push({
          x: kx + Math.cos(ang) * rOff,
          y: h * (0.72 + rand() * 0.24) - 2.5,
          z: kz + Math.sin(ang) * rOff,
          scale: 5.5 + rand() * 5.0
        });
      }
      karstCount++;
    }

    // 2b. Hang Luồn Sea Arch Grotto (-92, -348) & Đảo Ti Tốp Island Peak (134, -418)
    const hangL = createHaLongKarstGeometry(601, 7.2, 26.0, 1.5, 0.2);
    hangL.translate(-101.0, -2.5, -348.0);
    const hangR = createHaLongKarstGeometry(602, 7.2, 26.0, -1.5, -0.2);
    hangR.translate(-83.0, -2.5, -348.0);
    const hangArch = createSculptedRockGeometry(603, 13.5, 5.2, 7.2, 2);
    hangArch.translate(-92.0, 14.5, -348.0);
    const tiTopKarst = createHaLongKarstGeometry(604, 15.0, 24.0, 0.4, -0.3);
    tiTopKarst.translate(134.0, -2.5, -418.0);
    karstParts.push(hangL, hangR, hangArch, tiTopKarst);
    foliageAnchors.push(
      { x: -100.0, y: 22.0, z: -348.0, scale: 4.5 },
      { x: -84.0, y: 22.0, z: -348.0, scale: 4.5 },
      { x: 132.0, y: 20.5, z: -417.0, scale: 4.8 }
    );

    const karstMesh = new THREE.Mesh(mergeNormalized(karstParts), karstMat);
    karstMesh.castShadow = true;
    karstMesh.receiveShadow = true;
    group.add(karstMesh);

    // 2c. Hang Luồn Kayaks, Cửa Vạn Floating Fishing Village (108, -362), and Đảo Ti Tốp Beach + Lookout Pavilion (134, -418)
    const bayVillageWoodParts: THREE.BufferGeometry[] = [];
    const bayVillageColoredParts: THREE.BufferGeometry[] = [];
    const bayRoofColors = ['#2e6f9e', '#a8382b', '#3b7a57'];
    const addColoredBayBox = (
      w: number,
      h: number,
      d: number,
      px: number,
      py: number,
      pz: number,
      hex: string,
      ry = 0
    ): void => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (ry) g.rotateY(ry);
      g.translate(px, py, pz);
      const count = g.attributes.position.count;
      const c = new THREE.Color(hex);
      const cols = new Float32Array(count * 3);
      for (let ci = 0; ci < count; ci++) {
        cols[ci * 3] = c.r;
        cols[ci * 3 + 1] = c.g;
        cols[ci * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      bayVillageColoredParts.push(g);
    };

    // Hang Luồn 2 colorful kayaks passing under the sea arch
    for (const [kx, kz, colHex, kyaw] of [
      [-92.5, -346.0, '#e67e22', 0.15] as const,
      [-90.0, -351.5, '#f1c40f', -0.22] as const
    ]) {
      const kayak = new THREE.CylinderGeometry(0.32, 0.32, 3.8, 8);
      kayak.scale(1.0, 1.0, 0.48);
      kayak.rotateX(Math.PI * 0.5);
      kayak.rotateY(kyaw);
      kayak.translate(kx, 0.12, kz);
      const count = kayak.attributes.position.count;
      const c = new THREE.Color(colHex);
      const cols = new Float32Array(count * 3);
      for (let ci = 0; ci < count; ci++) {
        cols[ci * 3] = c.r;
        cols[ci * 3 + 1] = c.g;
        cols[ci * 3 + 2] = c.b;
      }
      kayak.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      bayVillageColoredParts.push(kayak);
    }

    // Làng Chài Nổi Cửa Vạn: 6 floating timber rafts on pontoon drums + colored pitched-roof stilt houses
    const cuaVanOffsets: Array<[number, number, number]> = [
      [-12, -8, 0.12],
      [0, -10, -0.08],
      [12, -7, 0.2],
      [-10, 6, -0.15],
      [2, 8, 0.05],
      [14, 5, -0.18]
    ];
    cuaVanOffsets.forEach(([ox, oz, ry], vIdx) => {
      const fx = 108 + ox;
      const fz = -362 + oz;
      const raft = new THREE.BoxGeometry(6.6, 0.24, 5.2);
      raft.rotateY(ry);
      raft.translate(fx, 0.28, fz);
      bayVillageWoodParts.push(raft);
      // Pontoon drums beneath deck
      for (const sx of [-2.4, 2.4]) {
        const barrel = new THREE.CylinderGeometry(0.28, 0.28, 4.4, 7);
        barrel.rotateX(Math.PI * 0.5);
        barrel.translate(sx, 0.05, 0);
        barrel.rotateY(ry);
        barrel.translate(fx, 0, fz);
        bayVillageWoodParts.push(barrel);
      }
      const house = new THREE.BoxGeometry(4.2, 2.4, 3.6);
      house.rotateY(ry);
      house.translate(fx, 1.5, fz);
      bayVillageWoodParts.push(house);
      const rCol = bayRoofColors[vIdx % bayRoofColors.length];
      addColoredBayBox(4.8, 0.35, 4.2, fx, 2.85, fz, rCol, ry);
      addColoredBayBox(4.2, 0.75, 2.4, fx, 3.25, fz, rCol, ry);
    });

    // Đảo Ti Tốp: crescent sandy beach + stone approach steps + hexagonal hilltop gazebo
    const sandBar = new THREE.CylinderGeometry(8.5, 9.6, 0.85, 16);
    sandBar.scale(1.12, 1.0, 0.52);
    sandBar.translate(134, 0.15, -404);
    addColoredBayBox(16.0, 0.42, 7.2, 134, 0.35, -404, '#e6d39c');
    const sandCols = new Float32Array(sandBar.attributes.position.count * 3);
    const scCol = new THREE.Color('#e6d39c');
    for (let si = 0; si < sandBar.attributes.position.count; si++) {
      sandCols[si * 3] = scCol.r;
      sandCols[si * 3 + 1] = scCol.g;
      sandCols[si * 3 + 2] = scCol.b;
    }
    sandBar.setAttribute('color', new THREE.BufferAttribute(sandCols, 3));
    bayVillageColoredParts.push(sandBar);

    for (let st = 0; st < 10; st++) {
      addColoredBayBox(2.4, 0.5, 1.1, 134, 0.6 + st * 1.75, -408 - st * 0.9, '#9e9788');
    }
    // Ti Tốp Hexagonal Hilltop Pavilion at y = 18.5m
    addColoredBayBox(5.2, 0.45, 5.2, 134, 18.5, -418, '#a69d8e');
    for (let hp = 0; hp < 6; hp++) {
      const ha = (hp / 6) * Math.PI * 2;
      const post = new THREE.CylinderGeometry(0.14, 0.16, 3.1, 6);
      post.translate(134 + Math.cos(ha) * 2.1, 20.25, -418 + Math.sin(ha) * 2.1);
      bayVillageWoodParts.push(post);
    }
    const tiTopRoof = new THREE.ConeGeometry(3.4, 1.85, 6);
    tiTopRoof.translate(134, 22.65, -418);
    const trCols = new Float32Array(tiTopRoof.attributes.position.count * 3);
    const rc = new THREE.Color('#b03a2e');
    for (let ri = 0; ri < tiTopRoof.attributes.position.count; ri++) {
      trCols[ri * 3] = rc.r;
      trCols[ri * 3 + 1] = rc.g;
      trCols[ri * 3 + 2] = rc.b;
    }
    tiTopRoof.setAttribute('color', new THREE.BufferAttribute(trCols, 3));
    bayVillageColoredParts.push(tiTopRoof);

    const bayColMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
    const bayWoodMat = new THREE.MeshStandardMaterial({
      color: '#6e4a2b',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughness: 0.80
    });
    this.extraMaterials.push(bayColMat, bayWoodMat);
    group.add(
      new THREE.Mesh(mergeNormalized(bayVillageWoodParts), bayWoodMat),
      new THREE.Mesh(mergeNormalized(bayVillageColoredParts), bayColMat)
    );

    // 3. Instanced Tropical Jungle Foliage Crowns on Karsts
    const cardParts: THREE.BufferGeometry[] = [];
    for (let c = 0; c < 4; c++) {
      const p = new THREE.PlaneGeometry(1.8, 1.8);
      p.rotateY((c / 4) * Math.PI);
      p.rotateX((c % 2 === 0 ? 1 : -1) * 0.28);
      cardParts.push(p);
    }
    const foliageGeo = mergeNormalized(cardParts);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: '#2b5e27',
      map: pbr.leafAtlas,
      alphaTest: 0.42,
      roughness: 0.78,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(foliageMat);

    const karstFoliage = new THREE.InstancedMesh(foliageGeo, foliageMat, foliageAnchors.length);
    karstFoliage.name = 'HaLongKarstFoliage';
    const dummy = new THREE.Matrix4();
    const col = new THREE.Color();
    foliageAnchors.forEach((fa, i) => {
      dummy.compose(
        new THREE.Vector3(fa.x, fa.y, fa.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
        new THREE.Vector3(fa.scale, fa.scale * 0.85, fa.scale)
      );
      karstFoliage.setMatrixAt(i, dummy);
      col.setHSL(0.30 + (rand() - 0.5) * 0.06, 0.45, 0.28 + rand() * 0.14);
      karstFoliage.setColorAt(i, col);
    });
    karstFoliage.instanceMatrix.needsUpdate = true;
    if (karstFoliage.instanceColor) karstFoliage.instanceColor.needsUpdate = true;
    group.add(karstFoliage);

    // 4. 3 Sailing Traditional Vietnamese 22m Wooden Junk Boats (*Thuyền Buồm Cánh Dơi*)
    const sailTex = createBatWingSailTexture(256, renderer);
    this.extraTextures.push(sailTex);

    const hullWoodMat = new THREE.MeshStandardMaterial({
      color: '#5a3620',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.72
    });
    const sailMat = new THREE.MeshStandardMaterial({
      map: sailTex,
      roughness: 0.80,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(hullWoodMat, sailMat);

    const createBatWingSailGeo = (w: number, h: number): THREE.BufferGeometry => {
      const geo = new THREE.PlaneGeometry(w, h, 8, 8);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const yn = (y / h) + 0.5;
        const xn = (x / w) + 0.5;
        const fanWidth = 0.72 + 0.42 * Math.sin(yn * Math.PI * 0.82);
        const topRoach = yn > 0.78 ? (yn - 0.78) * 1.4 * xn : 0;
        const billow = Math.sin(xn * Math.PI) * Math.sin(yn * Math.PI) * 0.45;
        pos.setXYZ(i, x * fanWidth, y + topRoach, billow);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const wakeMat = new THREE.MeshBasicMaterial({
      color: '#e6f4f8',
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    });
    this.extraMaterials.push(wakeMat);

    boatConfigs.forEach((bc, idx) => {
      const boat = new THREE.Group();
      boat.name = `HaLongJunkBoat_${idx + 1}`;

      const hullParts: THREE.BufferGeometry[] = [];
      const hullShape = new THREE.Shape();
      hullShape.moveTo(-4.2, 0.2);
      hullShape.quadraticCurveTo(-2.5, -0.8, 0, -0.95);
      hullShape.quadraticCurveTo(2.8, -0.8, 4.5, 0.4);
      hullShape.lineTo(3.8, 0.85);
      hullShape.quadraticCurveTo(0, 0.45, -3.7, 0.75);
      hullShape.closePath();

      const hull = new THREE.ExtrudeGeometry(hullShape, {
        depth: 2.1,
        bevelEnabled: true,
        bevelThickness: 0.16,
        bevelSize: 0.14,
        bevelSegments: 2
      });
      hull.translate(0, 0.3, -1.05);
      hullParts.push(hull);

      const cabin = new THREE.BoxGeometry(2.6, 1.05, 1.55);
      cabin.translate(-1.1, 1.05, 0);
      hullParts.push(cabin);

      // Cabin window recesses & side deck rails
      for (const sz of [-0.79, 0.79]) {
        for (const wx of [-1.75, -0.45]) {
          const winFrame = new THREE.BoxGeometry(0.55, 0.42, 0.08);
          winFrame.translate(wx, 1.15, sz);
          hullParts.push(winFrame);
        }
        const deckRail = new THREE.BoxGeometry(6.8, 0.08, 0.08);
        deckRail.translate(0.4, 0.95, sz * 1.32);
        hullParts.push(deckRail);
      }
      // Stern rudder blade
      const rudder = new THREE.BoxGeometry(0.85, 1.15, 0.12);
      rudder.translate(-4.15, 0.25, 0);
      hullParts.push(rudder);

      const mainMast = new THREE.CylinderGeometry(0.08, 0.11, 6.4, 10);
      mainMast.translate(0.5, 3.6, 0);
      hullParts.push(mainMast);

      const foreMast = new THREE.CylinderGeometry(0.06, 0.09, 4.8, 10);
      foreMast.translate(2.5, 2.8, 0);
      hullParts.push(foreMast);

      // Horizontal 3D bamboo battens spanning the fore-and-aft sails
      for (let bt = 0; bt < 6; bt++) {
        const batten = new THREE.CylinderGeometry(0.032, 0.038, 3.3, 6);
        batten.rotateZ(Math.PI * 0.5);
        batten.rotateY(0.16);
        batten.translate(0.5, 2.1 + bt * 0.82, 0.06);
        hullParts.push(batten);
      }
      for (let bt = 0; bt < 5; bt++) {
        const batten = new THREE.CylinderGeometry(0.026, 0.032, 2.3, 6);
        batten.rotateZ(Math.PI * 0.5);
        batten.rotateY(0.16);
        batten.translate(2.5, 1.9 + bt * 0.70, 0.06);
        hullParts.push(batten);
      }

      // Carved dragon head figurehead on prow (*Đầu Rồng*)
      const dragonHead = new THREE.ConeGeometry(0.22, 0.65, 6);
      dragonHead.rotateZ(-Math.PI * 0.45);
      dragonHead.translate(4.35, 0.72, 0);
      hullParts.push(dragonHead);
      const dragonSnout = new THREE.BoxGeometry(0.38, 0.16, 0.22);
      dragonSnout.translate(4.62, 0.82, 0);
      hullParts.push(dragonSnout);

      const hullMesh = new THREE.Mesh(mergeNormalized(hullParts), hullWoodMat);
      hullMesh.castShadow = true;
      boat.add(hullMesh);

      // Warm glowing bow silk lantern on junk boat
      const bLantern = createRibbedLanternShellGeometry(0.20, 0.44, 10, 8);
      bLantern.translate(4.55, 1.15, 0);
      const bLanternMesh = new THREE.Mesh(bLantern, this.lanternSilkMaterial!);
      boat.add(bLanternMesh);
      const bLanternCoreGeo = createLanternCoreGeometry(0.20, 0.44);
      bLanternCoreGeo.translate(4.55, 1.15, 0);
      const bLanternCore = new THREE.Mesh(
        bLanternCoreGeo,
        this.lanternCoreMaterial ?? this.lanternSilkMaterial!
      );
      boat.add(bLanternCore);

      // Fore-and-aft *cánh dơi* junk sails aligned along the X-axis hull
      const mainSail = new THREE.Mesh(createBatWingSailGeo(3.6, 4.8), sailMat);
      mainSail.position.set(0.5, 4.1, 0.06);
      mainSail.rotation.y = 0.16;
      mainSail.castShadow = true;
      boat.add(mainSail);

      const foreSail = new THREE.Mesh(createBatWingSailGeo(2.5, 3.5), sailMat);
      foreSail.position.set(2.5, 3.3, 0.06);
      foreSail.rotation.y = 0.16;
      foreSail.castShadow = true;
      boat.add(foreSail);

      // White bow foam wake collar at waterline
      const wakeRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.65, 16).rotateX(-Math.PI * 0.5), wakeMat);
      wakeRing.scale.set(2.9, 1.0, 0.95);
      wakeRing.position.set(0.2, 0.05, 0);
      boat.add(wakeRing);

      boat.scale.setScalar(bc.scale);
      group.add(boat);
      this.junkBoats.push({
        group: boat,
        centerX: bc.cx,
        centerZ: bc.cz,
        radiusX: bc.rx,
        radiusZ: bc.rz,
        speed: bc.speed,
        phase: bc.phase
      });
    });

    this.updateJunkBoats(0);
    this.scene.add(group);
  }

  /**
   * Builds 9,000 Instanced emerald & golden-ripening Mù Cang Chải rice stalk clusters on the western terraces
   * (x in [-310, -112], z in [-112, 8]) plus 2 rustic timber rice-field watch huts (*chòi gác ruộng*).
   */
  private buildSapaRiceTerraces(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'SapaTerracedRiceFields';

    const riceCount = 9000;
    const stalkParts: THREE.BufferGeometry[] = [];
    for (let s = 0; s < 4; s++) {
      const blade = new THREE.PlaneGeometry(0.095, 0.72, 1, 2);
      const bPos = blade.attributes.position;
      for (let v = 0; v < bPos.count; v++) {
        const yv = bPos.getY(v) + 0.36;
        const t = clamp01(yv / 0.72);
        const taper = 1.0 - t * 0.85;
        bPos.setX(v, bPos.getX(v) * taper);
        bPos.setY(v, yv);
        bPos.setZ(v, t * t * 0.18);
      }
      blade.computeVertexNormals();
      blade.rotateY((s / 4) * Math.PI * 2 + 0.3);
      blade.rotateX(0.18);
      stalkParts.push(blade);
    }
    const riceGeo = mergeNormalized(stalkParts);
    const riceWindU = { uTime: { value: 0.0 }, uWindSpeed: { value: 2.0 } };
    this.foliageWindUniforms.push(riceWindU);
    const riceMat = new THREE.MeshStandardMaterial({
      color: '#6ca82d',
      roughness: 0.74,
      side: THREE.DoubleSide
    });
    riceMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = riceWindU.uTime;
      shader.uniforms.uWindSpeed = riceWindU.uWindSpeed;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uWindSpeed;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float hTip = clamp(position.y / 0.72, 0.0, 1.0);
           vec3 instP = vec3(0.0);
           #ifdef USE_INSTANCING
           instP = vec3(instanceMatrix[3].xyz);
           #endif
           float wave = sin(instP.x * 0.18 + instP.z * 0.15 - uTime * (1.2 + uWindSpeed * 0.45));
           transformed.x += wave * 0.14 * hTip * hTip;
           transformed.z += cos(instP.z * 0.22 - uTime * 1.4) * 0.09 * hTip * hTip;`
        );
    };
    this.extraMaterials.push(riceMat);

    const riceMesh = new THREE.InstancedMesh(riceGeo, riceMat, riceCount);
    riceMesh.name = 'InstancedSapaRiceStalks';

    const rand = mulberry32(445566);
    const dummy = this.tmpMat;
    const pos = this.tmpPos;
    const quat = this.tmpQuat;
    const scale = this.tmpScale;
    const upAxis = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    let placed = 0;

    for (let i = 0; i < riceCount * 5 && placed < riceCount; i++) {
      const rx = -112.0 - rand() * 198.0; // [-310, -112]
      const rz = -112.0 + rand() * 120.0; // [-112, +8]
      if (this.isInsideExclusionCircle(rx, rz, 2.0)) continue;
      const contour = 8.0 * Math.sin(rz * 0.024 + 0.4) + 4.5 * Math.cos(rz * 0.013 - 0.8);
      const distUp = Math.max(0.0, (-116.0 - rx) + contour * 0.65);
      const stepIdx = Math.floor(distUp / 9.0);
      const frac = distUp / 9.0 - stepIdx;
      const isMirrorWaterStep = ((stepIdx * 0.37) % 1.0) >= 0.54;
      if (isMirrorWaterStep || frac > 0.70) continue;

      const ry = getVietnamHeritageHeight(rx, rz);
      if (ry < 1.8 || ry > 44.0) continue;
      const sc = 0.85 + rand() * 0.65;
      pos.set(rx, ry - 0.06, rz);
      quat.setFromAxisAngle(upAxis, rand() * Math.PI * 2);
      scale.set(sc, sc, sc);
      dummy.compose(pos, quat, scale);
      riceMesh.setMatrixAt(placed, dummy);

      const isGolden = ((stepIdx * 0.61 + 0.2) % 1.0) >= 0.55;
      if (isGolden) {
        col.setHSL(0.12 + rand() * 0.03, 0.76, 0.44 + rand() * 0.12);
      } else {
        col.setHSL(0.26 + rand() * 0.05, 0.64, 0.30 + rand() * 0.12);
      }
      riceMesh.setColorAt(placed, col);
      placed++;
    }
    this.scalableFoliage.push({ mesh: riceMesh, baseCount: placed });
    riceMesh.count = Math.max(
      1,
      Math.round(placed * this.qualitySettings.foliageDensityScale)
    );
    riceMesh.instanceMatrix.needsUpdate = true;
    if (riceMesh.instanceColor) riceMesh.instanceColor.needsUpdate = true;
    group.add(riceMesh);

    // 2. Two Traditional Mountain Stilt Rice-Field Watch Huts (*Chòi gác ruộng*) deeply grounded on slope
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#6b492c',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.84
    });
    const thatchMat = new THREE.MeshStandardMaterial({
      color: '#9c7e47',
      roughness: 0.92,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(woodMat, thatchMat);

    const woodParts: THREE.BufferGeometry[] = [];
    const roofParts: THREE.BufferGeometry[] = [];
    for (const [hx, hz] of [
      [-162, -46],
      [-226, -24]
    ]) {
      const hy = getVietnamHeritageHeight(hx, hz);
      this.exclusionCircles.push({ x: hx, z: hz, r: 5.0 });
      for (const [ox, oz] of [
        [-1.3, -1.3],
        [1.3, -1.3],
        [-1.3, 1.3],
        [1.3, 1.3]
      ]) {
        const cornerGround = getVietnamHeritageHeight(hx + ox, hz + oz);
        const postBottom = cornerGround - 1.2;
        const postTop = hy + 2.9;
        const postH = postTop - postBottom;
        const post = new THREE.CylinderGeometry(0.10, 0.12, postH, 8);
        post.translate(hx + ox, postBottom + postH * 0.5, hz + oz);
        woodParts.push(post);
      }
      const floor = new THREE.BoxGeometry(3.1, 0.18, 3.1);
      floor.translate(hx, hy + 1.15, hz);
      woodParts.push(floor);

      const roof = new THREE.ConeGeometry(2.65, 1.65, 4);
      roof.rotateY(Math.PI * 0.25);
      roof.translate(hx, hy + 3.6, hz);
      roofParts.push(roof);

      // Woven bamboo half-walls (3 sides), roof finial & 6-rung bamboo access ladder
      for (const [wxOff, wzOff, wLen, dLen] of [
        [-1.35, 0, 0.12, 2.7],
        [0, -1.35, 2.7, 0.12],
        [0, 1.35, 2.7, 0.12]
      ]) {
        const hw = new THREE.BoxGeometry(wLen, 0.92, dLen);
        hw.translate(hx + wxOff, hy + 1.65, hz + wzOff);
        woodParts.push(hw);
      }
      const finial = new THREE.CylinderGeometry(0.06, 0.09, 0.55, 6);
      finial.translate(hx, hy + 4.55, hz);
      woodParts.push(finial);
      for (const lz of [-0.32, 0.32]) {
        const rail = new THREE.CylinderGeometry(0.04, 0.05, 1.85, 6);
        rail.rotateZ(-0.48);
        rail.translate(hx + 1.75, hy + 0.65, hz + lz);
        woodParts.push(rail);
      }
      for (let rg = 0; rg < 6; rg++) {
        const tR = rg / 5;
        const rung = new THREE.CylinderGeometry(0.025, 0.025, 0.68, 5);
        rung.rotateX(Math.PI * 0.5);
        rung.translate(hx + 2.05 - tR * 0.62, hy + 0.1 + tR * 1.05, hz);
        woodParts.push(rung);
      }
    }

    // 3. Bamboo Waterwheel (*Cọn nước Tây Bắc*) + Aqueduct Trough at (-138, -34)
    const wheelX = -138;
    const wheelZ = -34;
    const wheelY = getVietnamHeritageHeight(wheelX, wheelZ);
    this.exclusionCircles.push({ x: wheelX, z: wheelZ, r: 6.0 });
    for (const wzOff of [-0.65, 0.65]) {
      const aLeg1 = new THREE.CylinderGeometry(0.08, 0.10, 4.2, 6);
      aLeg1.rotateZ(0.28);
      aLeg1.translate(wheelX - 0.55, wheelY + 1.8, wheelZ + wzOff);
      const aLeg2 = new THREE.CylinderGeometry(0.08, 0.10, 4.2, 6);
      aLeg2.rotateZ(-0.28);
      aLeg2.translate(wheelX + 0.55, wheelY + 1.8, wheelZ + wzOff);
      woodParts.push(aLeg1, aLeg2);
    }
    const rim = new THREE.TorusGeometry(3.2, 0.065, 6, 20);
    rim.translate(wheelX, wheelY + 3.4, wheelZ);
    woodParts.push(rim);
    for (let sp = 0; sp < 12; sp++) {
      const sa = (sp / 12) * Math.PI * 2;
      const spoke = new THREE.CylinderGeometry(0.035, 0.04, 6.4, 5);
      spoke.rotateZ(sa);
      spoke.translate(wheelX, wheelY + 3.4, wheelZ);
      const tubeCup = new THREE.CylinderGeometry(0.075, 0.075, 0.62, 6);
      tubeCup.rotateX(Math.PI * 0.5);
      tubeCup.translate(wheelX + Math.cos(sa) * 3.15, wheelY + 3.4 + Math.sin(sa) * 3.15, wheelZ);
      woodParts.push(spoke, tubeCup);
    }
    const trough = new THREE.BoxGeometry(9.5, 0.18, 0.34);
    trough.translate(wheelX - 4.5, wheelY + 5.6, wheelZ + 0.6);
    woodParts.push(trough);

    // 4. Three Sculpted Highland Water Buffalo Silhouettes grazing on lower terraces
    const buffaloParts: THREE.BufferGeometry[] = [];
    for (const [bx, bz, byaw] of [
      [-144, -52, 0.45],
      [-178, -38, -0.82],
      [-205, -28, 1.15]
    ]) {
      const by = getVietnamHeritageHeight(bx, bz);
      const body = new THREE.SphereGeometry(0.68, 8, 6);
      body.scale(0.85, 0.92, 1.65);
      body.translate(0, 1.05, 0);
      const neck = new THREE.BoxGeometry(0.45, 0.48, 0.68);
      neck.translate(0, 1.18, 0.95);
      const horn = new THREE.TorusGeometry(0.44, 0.055, 5, 10, Math.PI);
      horn.rotateX(Math.PI * 0.45);
      horn.translate(0, 1.38, 1.18);
      const bParts: THREE.BufferGeometry[] = [body, neck, horn];
      for (const sx of [-0.28, 0.28]) {
        for (const sz of [-0.55, 0.55]) {
          const leg = new THREE.CylinderGeometry(0.09, 0.08, 0.95, 6);
          leg.translate(sx, 0.46, sz);
          bParts.push(leg);
        }
      }
      for (const gp of bParts) {
        gp.rotateY(byaw);
        gp.translate(bx, by, bz);
        buffaloParts.push(gp);
      }
    }
    const buffaloMat = new THREE.MeshStandardMaterial({ color: '#38383d', roughness: 0.85 });
    this.extraMaterials.push(buffaloMat);
    const buffaloMesh = new THREE.Mesh(mergeNormalized(buffaloParts), buffaloMat);
    buffaloMesh.castShadow = true;
    group.add(buffaloMesh);

    const hutsWood = new THREE.Mesh(mergeNormalized(woodParts), woodMat);
    hutsWood.castShadow = true;
    group.add(hutsWood);

    const hutsRoof = new THREE.Mesh(mergeNormalized(roofParts), thatchMat);
    hutsRoof.castShadow = true;
    group.add(hutsRoof);

    this.scene.add(group);
  }

  /**
   * Builds swaying Instanced Bamboo Groves (*Lũy tre làng*) scattered across the 2200m map.
   */
  private buildBambooGroves(
    pbr: ReturnType<typeof this.createPbrAssets>,
    windDir2D: THREE.Vector2
  ): void {
    const group = new THREE.Group();
    group.name = 'VietnameseBambooGroves';

    const groveCenters: Array<[number, number, number]> = [
      [98, -16, 24],
      [106, 22, 26],
      [94, 56, 24],
      [135, 10, 26],
      [-78, 52, 22],
      [-86, 86, 24],
      [48, 84, 24],
      [-105, -72, 22],
      [112, -62, 22],
      [-115, -110, 20],
      [148, -98, 22],
      [-245, 36, 22],
      [235, 42, 22],
      [-168, 140, 22],
      [172, 145, 22],
      [-185, 295, 20],
      [165, 310, 20],
      [-295, 225, 20],
      [310, 205, 20],
      [-132, 392, 18],
      [115, 388, 18],
      [258, -120, 20],
      [-265, -185, 20],
      [265, -175, 20],
      [-480, -85, 22],
      [-495, 240, 22],
      [-460, 380, 20],
      [485, -180, 22],
      [490, 120, 22],
      [510, 320, 20],
      [560, -25, 22],
      [-515, -305, 20],
      [480, 390, 20],
      [880, 220, 22]
    ];

    const culmPoints: THREE.Vector2[] = [new THREE.Vector2(0.095, 0.0)];
    for (let s = 0; s < 5; s++) {
      const y0 = s * 1.85;
      const rUpper = Math.max(0.022, 0.084 - s * 0.01);
      culmPoints.push(new THREE.Vector2(rUpper, y0 + 1.72));
      culmPoints.push(new THREE.Vector2(rUpper + 0.014, y0 + 1.81));
    }
    culmPoints.push(new THREE.Vector2(0.022, 9.28));
    const culmGeo = new THREE.LatheGeometry(culmPoints, 6);

    const leafClusterParts: THREE.BufferGeometry[] = [];
    for (let c = 0; c < 4; c++) {
      const card = new THREE.PlaneGeometry(2.1, 1.85);
      card.translate(0, 7.4 + (c % 2) * 1.1, 0);
      card.rotateY((c / 4) * Math.PI);
      leafClusterParts.push(card);
    }
    const leafGeo = mergeNormalized(leafClusterParts);

    const windUniforms = {
      uTime: { value: 0.0 },
      uWindSpeed: { value: this.currentConfig?.wind?.speed ?? 2.0 },
      uWindDir: { value: windDir2D.clone() }
    };
    this.foliageWindUniforms.push(windUniforms);

    const attachBambooSway = (mat: THREE.MeshStandardMaterial) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = windUniforms.uTime;
        shader.uniforms.uWindSpeed = windUniforms.uWindSpeed;
        shader.uniforms.uWindDir = windUniforms.uWindDir;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uTime;
             uniform float uWindSpeed;
             uniform vec2 uWindDir;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             float swayH = clamp(position.y / 9.2, 0.0, 1.0);
             vec3 instOrigin = vec3(0.0);
             #ifdef USE_INSTANCING
             instOrigin = vec3(instanceMatrix[3].xyz);
             #endif
             float ph = dot(instOrigin.xz, vec2(0.18, 0.23)) - uTime * (uWindSpeed * 0.85);
             float bend = sin(ph) * 0.34 * swayH * swayH;
             transformed.xz += uWindDir * bend;`
          );
      };
    };

    const bambooCulmMat = new THREE.MeshStandardMaterial({
      color: '#5b8f38',
      roughness: 0.44
    });
    attachBambooSway(bambooCulmMat);

    const bambooLeafMat = new THREE.MeshStandardMaterial({
      color: '#467a29',
      map: pbr.leafAtlas,
      alphaTest: 0.42,
      roughness: 0.70,
      side: THREE.DoubleSide
    });
    attachBambooSway(bambooLeafMat);
    this.extraMaterials.push(bambooCulmMat, bambooLeafMat);

    const totalCulms = groveCenters.reduce((acc, g) => acc + g[2], 0);
    const culmMesh = new THREE.InstancedMesh(culmGeo, bambooCulmMat, totalCulms);
    culmMesh.name = 'InstancedBambooCulms';
    culmMesh.castShadow = true;

    const leafMesh = new THREE.InstancedMesh(leafGeo, bambooLeafMat, totalCulms);
    leafMesh.name = 'InstancedBambooLeaves';
    leafMesh.castShadow = true;

    const rand = mulberry32(778899);
    const dummy = this.tmpMat;
    const pos = this.tmpPos;
    const quat = this.tmpQuat;
    const euler = this.tmpEuler;
    const scale = this.tmpScale;
    const col = new THREE.Color();
    let idx = 0;

    for (const [gx, gz, count] of groveCenters) {
      for (let i = 0; i < count; i++) {
        const ang = rand() * Math.PI * 2;
        const r = rand() * 8.5;
        const bx = gx + Math.cos(ang) * r;
        const bz = gz + Math.sin(ang) * r;
        if (this.isExcluded(bx, bz, 1.5)) continue;
        const by = getVietnamHeritageHeight(bx, bz);
        if (by < 0.72 || by > 28.0) continue;

        const sc = 0.88 + rand() * 0.52;
        const tiltX = (rand() - 0.5) * 0.14;
        const tiltZ = (rand() - 0.5) * 0.14;
        pos.set(bx, by - 0.15, bz);
        euler.set(tiltX, rand() * Math.PI * 2, tiltZ);
        quat.setFromEuler(euler);
        scale.set(sc, sc * (0.9 + rand() * 0.35), sc);
        dummy.compose(pos, quat, scale);
        culmMesh.setMatrixAt(idx, dummy);
        leafMesh.setMatrixAt(idx, dummy);

        col.setHSL(0.26 + (rand() - 0.5) * 0.04, 0.52, 0.36 + rand() * 0.12);
        culmMesh.setColorAt(idx, col);
        leafMesh.setColorAt(idx, col);
        idx++;
      }
    }
    this.scalableFoliage.push({ mesh: culmMesh, baseCount: idx }, { mesh: leafMesh, baseCount: idx });
    const bambooCount = Math.max(1, Math.round(idx * this.qualitySettings.foliageDensityScale));
    culmMesh.count = bambooCount;
    leafMesh.count = bambooCount;
    culmMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (culmMesh.instanceColor) culmMesh.instanceColor.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;

    group.add(culmMesh, leafMesh);
    this.scene.add(group);
  }

  /**
   * Builds true 1:1 Banyan & Royal Poinciana (*Cây phượng vĩ*) trees across the 2200m map.
   */
  private buildFlameAndBanyanTrees(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'VietnameseFlameAndBanyanTrees';

    const barkMat = this.sharedMaterials!.bark;
    const canopyMat = new THREE.MeshStandardMaterial({
      color: '#346b28',
      map: pbr.leafAtlas,
      alphaTest: 0.42,
      roughness: 0.78,
      side: THREE.DoubleSide
    });
    const blossomMat = new THREE.MeshStandardMaterial({
      color: '#d93822',
      map: pbr.leafAtlas,
      alphaTest: 0.45,
      roughness: 0.72,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(canopyMat, blossomMat);

    const treeCoords: Array<{ x: number; z: number; scale: number; isFlame: boolean }> = [
      { x: -18.5, z: 44, scale: 1.55, isFlame: true },
      { x: 18.5, z: 44, scale: 1.60, isFlame: true },
      { x: -24, z: 46, scale: 1.75, isFlame: true },
      { x: 24, z: 46, scale: 1.85, isFlame: true },
      { x: -28, z: -26, scale: 1.9, isFlame: false },
      { x: 28, z: -26, scale: 1.95, isFlame: false },
      { x: -64, z: -56, scale: 2.0, isFlame: true },
      { x: 64, z: -56, scale: 1.95, isFlame: false },
      { x: 96, z: 22, scale: 1.85, isFlame: true },
      { x: -26, z: 86, scale: 1.8, isFlame: false },
      { x: 28, z: 88, scale: 1.9, isFlame: true },
      { x: 112, z: -8, scale: 2.0, isFlame: false },
      { x: -82, z: -88, scale: 1.85, isFlame: false },
      { x: 92, z: -92, scale: 1.95, isFlame: false },
      { x: -112, z: 68, scale: 1.9, isFlame: true },
      { x: -242, z: 42, scale: 1.85, isFlame: false },
      { x: 235, z: 45, scale: 1.9, isFlame: true },
      { x: 215, z: -72, scale: 1.85, isFlame: false },
      { x: -255, z: 115, scale: 1.95, isFlame: false },
      { x: 285, z: 68, scale: 1.85, isFlame: true },
      { x: -58, z: 122, scale: 1.8, isFlame: true },
      { x: 58, z: 122, scale: 1.85, isFlame: true },
      { x: -175, z: 190, scale: 1.95, isFlame: false },
      { x: 175, z: 190, scale: 1.9, isFlame: true },
      { x: -175, z: 265, scale: 1.85, isFlame: false },
      { x: 175, z: 265, scale: 1.9, isFlame: true },
      { x: -72, z: 292, scale: 1.85, isFlame: false },
      { x: 72, z: 292, scale: 1.9, isFlame: true },
      { x: -120, z: 330, scale: 1.8, isFlame: false },
      { x: 92, z: 345, scale: 1.85, isFlame: true },
      { x: -280, z: 185, scale: 1.9, isFlame: false },
      { x: 310, z: 165, scale: 1.85, isFlame: true },
      { x: -145, z: -135, scale: 1.9, isFlame: false },
      { x: 145, z: -135, scale: 1.9, isFlame: false },
      { x: -275, z: -195, scale: 2.0, isFlame: false },
      { x: 255, z: -185, scale: 1.9, isFlame: false },
      { x: -65, z: -215, scale: 1.95, isFlame: true },
      { x: 65, z: -215, scale: 1.95, isFlame: false },
      { x: 24, z: 365, scale: 1.8, isFlame: true },
      { x: -32, z: 410, scale: 1.85, isFlame: false },
      { x: 38, z: 415, scale: 1.8, isFlame: true },
      { x: -490, z: -20, scale: 1.9, isFlame: false },
      { x: -505, z: 180, scale: 1.95, isFlame: true },
      { x: -520, z: 310, scale: 1.9, isFlame: false },
      { x: 505, z: -85, scale: 1.9, isFlame: false },
      { x: 525, z: 210, scale: 1.9, isFlame: true },
      { x: 565, z: 360, scale: 1.85, isFlame: false },
      { x: -420, z: 295, scale: 1.9, isFlame: true },
      { x: 430, z: 295, scale: 1.9, isFlame: false },
      { x: 920, z: 140, scale: 1.95, isFlame: true },
      { x: -910, z: 280, scale: 1.9, isFlame: false },
      { x: 895, z: -235, scale: 1.95, isFlame: false }
    ];

    const trunkParts: THREE.BufferGeometry[] = [];
    const leafAnchors: Array<{ x: number; y: number; z: number; s: number; flame: boolean }> = [];
    const rand = mulberry32(314159);

    for (const tc of treeCoords) {
      if (this.isExcluded(tc.x, tc.z, 2.5)) continue;
      const gy = getVietnamHeritageHeight(tc.x, tc.z);
      if (gy < 0.72 || gy > 24.0) continue;
      this.exclusionCircles.push({ x: tc.x, z: tc.z, r: 3.0 });

      const trunkH = 3.8 * tc.scale;
      const trunk = new THREE.CylinderGeometry(0.28 * tc.scale, 0.46 * tc.scale, trunkH, 10);
      trunk.translate(tc.x, gy + trunkH * 0.5 - 0.15, tc.z);
      trunkParts.push(trunk);

      for (let b = 0; b < 4; b++) {
        const ang = (b / 4) * Math.PI * 2 + rand() * 0.5;
        const br = new THREE.CylinderGeometry(0.11 * tc.scale, 0.20 * tc.scale, 2.6 * tc.scale, 8);
        br.translate(0, 1.3 * tc.scale, 0);
        br.rotateZ(0.65);
        br.rotateY(ang);
        br.translate(tc.x, gy + trunkH * 0.78, tc.z);
        trunkParts.push(br);

        leafAnchors.push({
          x: tc.x + Math.cos(ang) * 1.65 * tc.scale,
          y: gy + trunkH + 1.1 * tc.scale,
          z: tc.z + Math.sin(ang) * 1.65 * tc.scale,
          s: (2.2 + rand() * 0.8) * tc.scale,
          flame: tc.isFlame
        });
      }
      leafAnchors.push({
        x: tc.x,
        y: gy + trunkH + 1.8 * tc.scale,
        z: tc.z,
        s: 2.6 * tc.scale,
        flame: tc.isFlame
      });
    }

    const trunkMesh = new THREE.Mesh(mergeNormalized(trunkParts), barkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    group.add(trunkMesh);

    const clusterParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.PlaneGeometry(1.5, 1.3);
      p.rotateY((i / 4) * Math.PI);
      p.rotateX((i % 2 === 0 ? 1 : -1) * 0.35);
      clusterParts.push(p);
    }
    const clusterGeo = mergeNormalized(clusterParts);

    const greenAnchors = leafAnchors.filter((a) => !a.flame);
    const flameAnchors = leafAnchors.filter((a) => a.flame);

    const populateLeaves = (
      anchors: typeof leafAnchors,
      mat: THREE.MeshStandardMaterial,
      name: string
    ) => {
      if (anchors.length === 0) return;
      const im = new THREE.InstancedMesh(clusterGeo, mat, anchors.length);
      im.name = name;
      im.castShadow = true;
      const dummy = this.tmpMat;
      const pos = this.tmpPos;
      const quat = this.tmpQuat;
      const scale = this.tmpScale;
      const upAxis = new THREE.Vector3(0, 1, 0);
      anchors.forEach((a, i) => {
        pos.set(a.x, a.y, a.z);
        quat.setFromAxisAngle(upAxis, rand() * Math.PI * 2);
        scale.set(a.s, a.s * 0.8, a.s);
        dummy.compose(pos, quat, scale);
        im.setMatrixAt(i, dummy);
      });
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    };

    populateLeaves(greenAnchors, canopyMat, 'BanyanTreeCanopies');
    populateLeaves(flameAnchors, blossomMat, 'RoyalPoincianaFlameCanopies');
    this.scene.add(group);
  }

  /**
   * Builds 42,000 swaying Instanced grass tufts across the expanded 4800m 3-Region Vietnam parklands & islets,
   * strictly excluding all landmark footprints, stone promenades, rice terraces, wetlands, and water basins.
   */
  private buildMeadowGrass(sunDir: THREE.Vector3, windDir2D: THREE.Vector2): void {
    const count = 42000;
    const bladeGeo = new THREE.PlaneGeometry(0.11, 0.65, 1, 2);
    const bPos = bladeGeo.attributes.position;
    for (let v = 0; v < bPos.count; v++) {
      const yv = bPos.getY(v) + 0.325;
      const t = clamp01(yv / 0.65);
      bPos.setX(v, bPos.getX(v) * (1.0 - t * 0.88));
      bPos.setY(v, yv);
      bPos.setZ(v, t * t * 0.12);
    }
    bladeGeo.computeVertexNormals();

    this.grassMaterial = createGrassSwayMaterial({
      windSpeed: this.currentConfig?.wind?.speed ?? 2.0,
      windStrength: this.currentConfig?.wind?.swayIntensity ?? 0.85,
      gustiness: this.currentConfig?.wind?.gustiness ?? 0.52,
      windDirection: windDir2D,
      sunDirection: sunDir,
      baseColor: '#1f4f1c',
      tipColor: '#699935'
    });
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.grassMaterial.uniforms.fogColor.value.copy(this.scene.fog.color);
      this.grassMaterial.uniforms.fogDensity.value = this.scene.fog.density;
    }

    const grassMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, count);
    grassMesh.name = 'InstancedGrass';

    const rand = mulberry32(552211);
    const dummy = this.tmpMat;
    const pos = this.tmpPos;
    const quat = this.tmpQuat;
    const scale = this.tmpScale;
    const upAxis = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    let placed = 0;

    for (let i = 0; i < count * 10 && placed < count; i++) {
      const gx = (rand() - 0.5) * 2040;
      const gz = -660 + rand() * 1420;
      if (this.isExcluded(gx, gz)) continue;

      const gy = getVietnamHeritageHeight(gx, gz);
      if (gy <= 0.72 || gy >= 28.0) continue;
      if (
        getVietnamHeritageHeight(gx + 4.5, gz) <= 0.25 ||
        getVietnamHeritageHeight(gx - 4.5, gz) <= 0.25 ||
        getVietnamHeritageHeight(gx, gz + 4.5) <= 0.25 ||
        getVietnamHeritageHeight(gx, gz - 4.5) <= 0.25
      ) {
        continue;
      }

      const sc = 0.75 + rand() * 0.75;
      pos.set(gx, gy - 0.08, gz);
      quat.setFromAxisAngle(upAxis, rand() * Math.PI * 2);
      scale.set(sc, sc, sc);
      dummy.compose(pos, quat, scale);
      grassMesh.setMatrixAt(placed, dummy);
      col.setHSL(0.26 + (rand() - 0.5) * 0.05, 0.55, 0.34 + rand() * 0.14);
      grassMesh.setColorAt(placed, col);
      placed++;
    }

    this.scalableFoliage.push({ mesh: grassMesh, baseCount: placed });
    grassMesh.count = Math.max(
      1,
      Math.round(placed * this.qualitySettings.foliageDensityScale)
    );
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    this.scene.add(grassMesh);
  }

  private buildGoldenMotes(): void {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const rand = mulberry32(119933);

    for (let i = 0; i < count; i++) {
      const mx = (rand() - 0.5) * 260;
      const mz = -160 + rand() * 240;
      const my = Math.max(1.0, getVietnamHeritageHeight(mx, mz)) + 1.5 + rand() * 14.0;
      positions[i * 3] = mx;
      positions[i * 3 + 1] = my;
      positions[i * 3 + 2] = mz;
      phases[i] = rand();
      sizes[i] = 1.8 + rand() * 2.4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.motesMaterial = createVietnamGoldenMotesMaterial();
    const motes = new THREE.Points(geo, this.motesMaterial);
    motes.name = 'GoldenHeritageMotes';
    this.scene.add(motes);
  }

  private buildIncenseSmoke(windDir2D: THREE.Vector2): void {
    const sources: Array<{ x: number; y: number; z: number; scale?: number }> = [
      ...this.incenseSources,
      // Chùa Một Cột approach censer
      { x: -30.5, y: 1.85, z: 22.0, scale: 0.9 },
      // Hoàng Thành Thăng Long ceremonial censer
      { x: 0.0, y: 3.1, z: -54.0, scale: 1.05 },
      // Đền Hùng Nghĩa Lĩnh temple censer
      { x: -189.0, y: 27.9, z: -206.0, scale: 1.1 },
      // Động Hương Tích cave censer
      { x: 226.0, y: 18.2, z: -201.0, scale: 1.0 },
      // Cố đô Huế Ngọ Môn courtyard censer
      { x: -158.0, y: 2.9, z: 42.0, scale: 1.05 },
      // Thánh địa Mỹ Sơn sanctuary censer
      { x: -314.0, y: 3.4, z: -135.0, scale: 1.0 }
    ];

    this.incenseSmoke = createIncenseSmokeSystem(sources, this.sharedShaders?.incenseSmoke);
    this.incenseSmoke.uniforms.uWindDir.value.copy(windDir2D);
    this.incenseSmoke.uniforms.uWindSpeed.value = this.currentConfig?.wind?.speed ?? 2.0;
    this.scene.add(this.incenseSmoke.mesh);
  }

  private buildWhiteEgrets(sunDir: THREE.Vector3): void {
    const count = 24;
    const positions = new Float32Array([
      // Left inner wing
      0.0, 0.0, 0.18, -0.45, 0.06, 0.06, -0.45, 0.04, -0.14,
      0.0, 0.0, 0.18, -0.45, 0.04, -0.14, 0.0, 0.0, -0.24,
      // Left outer wing
      -0.45, 0.06, 0.06, -0.96, 0.02, -0.12, -0.45, 0.04, -0.14,
      // Right inner wing
      0.0, 0.0, 0.18, 0.45, 0.04, -0.14, 0.45, 0.06, 0.06,
      0.0, 0.0, 0.18, 0.0, 0.0, -0.24, 0.45, 0.04, -0.14,
      // Right outer wing
      0.45, 0.06, 0.06, 0.45, 0.04, -0.14, 0.96, 0.02, -0.12
    ]);
    const uvs = new Float32Array([
      0.5, 0.8, 0.25, 0.6, 0.25, 0.2,
      0.5, 0.8, 0.25, 0.2, 0.5, 0.1,
      0.25, 0.6, 0.0, 0.3, 0.25, 0.2,
      0.5, 0.8, 0.75, 0.2, 0.75, 0.6,
      0.5, 0.8, 0.5, 0.1, 0.75, 0.2,
      0.75, 0.6, 0.75, 0.2, 1.0, 0.3
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    this.egretMaterial = createEgretMaterial(sunDir);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.egretMaterial.uniforms.fogColor.value.copy(this.scene.fog.color);
      this.egretMaterial.uniforms.fogDensity.value = this.scene.fog.density;
    }

    this.egretsMesh = new THREE.InstancedMesh(geo, this.egretMaterial, count);
    this.egretsMesh.name = 'SoaringWhiteEgrets';

    const rand = mulberry32(808080);
    for (let i = 0; i < count; i++) {
      this.egretOrbits.push({
        centerX: (rand() - 0.5) * 440,
        centerZ: -120 + (rand() - 0.5) * 460,
        radiusX: 42 + rand() * 88,
        radiusZ: 38 + rand() * 78,
        altitude: 24 + rand() * 30,
        angularSpeed: (0.06 + rand() * 0.08) * (i % 2 === 0 ? 1 : -1),
        phase: rand() * Math.PI * 2,
        scale: 1.15 + rand() * 0.55
      });
    }

    this.updateEgrets(0);
    this.scene.add(this.egretsMesh);
  }

  private updateEgrets(elapsedTime: number): void {
    if (!this.egretsMesh || this.egretOrbits.length === 0) return;

    for (let i = 0; i < this.egretOrbits.length; i++) {
      const orb = this.egretOrbits[i];
      const ang = orb.phase + elapsedTime * orb.angularSpeed;
      const x = orb.centerX + Math.cos(ang) * orb.radiusX;
      const z = orb.centerZ + Math.sin(ang) * orb.radiusZ;
      const y = orb.altitude + Math.sin(elapsedTime * 0.65 + orb.phase) * 1.1;

      const vx = -Math.sin(ang) * orb.radiusX * orb.angularSpeed;
      const vz = Math.cos(ang) * orb.radiusZ * orb.angularSpeed;
      const heading = Math.atan2(vx, vz);

      this.tmpPos.set(x, y, z);
      this.tmpEuler.set(0, heading, (orb.angularSpeed > 0 ? -1 : 1) * 0.14, 'YXZ');
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.setScalar(orb.scale);
      this.tmpMat.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.egretsMesh.setMatrixAt(i, this.tmpMat);
    }
    this.egretsMesh.instanceMatrix.needsUpdate = true;
  }

  private updateJunkBoats(elapsedTime: number): void {
    for (const jb of this.junkBoats) {
      const ang = jb.phase + elapsedTime * jb.speed;
      const bob = Math.sin(elapsedTime * 1.45 + jb.phase) * 0.085;
      const roll = Math.sin(elapsedTime * 1.15 + jb.phase * 2.0) * 0.038;
      const pitch = Math.cos(elapsedTime * 0.95 + jb.phase * 1.3) * 0.026;

      if (jb.radiusX > 3.0) {
        // Hạ Long Bay sailing junk boats with graceful orbital tacking & ocean swell pitch/roll
        const x = jb.centerX + Math.cos(ang) * jb.radiusX;
        const z = jb.centerZ + Math.sin(ang) * jb.radiusZ;
        const vx = -Math.sin(ang) * jb.radiusX * jb.speed;
        const vz = Math.cos(ang) * jb.radiusZ * jb.speed;
        const heading = Math.atan2(-vz, vx);

        jb.group.position.set(x, VIETNAM_WATER_LEVEL + bob, z);
        jb.group.rotation.set(roll, heading, pitch);
      } else {
        // Cái Răng floating market boats & Trà Sư sampans: gentle oar-stroke drift + wave rock
        const oarSurge = Math.sin(elapsedTime * 1.1 + jb.phase) * 0.35;
        const x = jb.centerX + Math.sin(ang) * jb.radiusX * 0.45 + oarSurge * 0.25;
        const z = jb.centerZ + Math.cos(ang * 0.85) * jb.radiusZ * 0.45;
        const baseYaw = this.boatBaseYaws.get(jb.group) ?? 0;
        const yawSway = Math.sin(elapsedTime * 0.65 + jb.phase) * 0.055;

        jb.group.position.set(x, VIETNAM_WATER_LEVEL + bob * 0.78, z);
        jb.group.rotation.set(roll * 0.85, baseYaw + yawSway, pitch * 0.9);
      }
    }
  }

  public setAudioEnergy(bass: number, mid: number, treble: number): void {
    if (!this.isInitialized) return;
    const safeBass = Number.isFinite(bass) ? bass : 0;
    const safeMid = Number.isFinite(mid) ? mid : 0;
    const safeTreble = Number.isFinite(treble) ? treble : 0;
    if (this.skyMaterial?.uniforms?.uBassEnergy) {
      this.skyMaterial.uniforms.uBassEnergy.value = safeBass;
    }
    if (this.terrainMaterial?.uniforms?.uBassEnergy) {
      this.terrainMaterial.uniforms.uBassEnergy.value = safeBass;
    }
    if (this.waterMaterial?.uniforms?.uBassEnergy) {
      this.waterMaterial.uniforms.uBassEnergy.value = safeBass;
    }
    if (this.waterMaterial?.uniforms?.uTrebleEnergy) {
      this.waterMaterial.uniforms.uTrebleEnergy.value = safeTreble;
    }
    if (this.motesMaterial?.uniforms?.uRadiance) {
      this.motesMaterial.uniforms.uRadiance.value = 1.0 + safeTreble * 0.48;
    }
    if (this.lanternSilkMaterial) {
      this.lanternSilkMaterial.emissiveIntensity =
        this.baseLanternIntensity + safeBass * 0.45 + safeMid * 0.25;
    }
    if (this.lanternCoreMaterial) {
      this.lanternCoreMaterial.emissiveIntensity = 2.4 + safeBass * 0.55 + safeTreble * 0.3;
    }
  }

  public setAtmosphereState(state: { timeOfDay: number; weather: WeatherMode }): void {
    if (!this.isInitialized) return;
    const rawHour = Number.isFinite(state?.timeOfDay) ? state.timeOfDay : 17.0;
    const hour = ((rawHour % 24) + 24) % 24;
    const weather: WeatherMode = state?.weather ?? 'clear';

    // Map timeOfDay (0..24) to physical sun elevation & color mood
    const solarAngle = ((hour - 6.0) / 12.0) * Math.PI;
    const sunY = Math.sin(solarAngle);
    const dayAmount = clamp01((sunY + 0.14) / 0.62);
    const duskAmount = clamp01(1.0 - Math.abs(sunY - 0.12) / 0.34);
    const nightAmount = clamp01(1.0 - dayAmount);

    const sunAz = (hour - 12.0) * 0.24;
    const elevY = Math.max(0.12, sunY * 0.85 + 0.18);
    const sunDir = new THREE.Vector3(Math.sin(sunAz), elevY, -Math.cos(sunAz) * 0.85).normalize();
    if (nightAmount > 0.7) {
      sunDir.set(0.35, 0.58, -0.72).normalize();
    }

    // Colors across night -> golden sunset -> sunlit noon
    const darkNight = clamp01((nightAmount - 0.60) / 0.40);
    const zenithDay = new THREE.Color('#1a5bb8');
    const zenithDusk = new THREE.Color('#134294');
    const zenithNight = new THREE.Color('#09132e');
    const topCol = zenithDay.clone().lerp(zenithDusk, duskAmount).lerp(zenithNight, darkNight);

    const horizDay = new THREE.Color('#d8ecff');
    const horizDusk = new THREE.Color('#f2be7e');
    const horizNight = new THREE.Color('#1e2742');
    const horizCol = horizDay.clone().lerp(horizDusk, duskAmount).lerp(horizNight, darkNight);

    const midCol = topCol.clone().lerp(horizCol, 0.55);
    const fogCol = horizCol.clone().lerp(new THREE.Color('#eab780'), duskAmount * 0.65);

    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.skyMaterial.uniforms.uTopColor.value.copy(topCol);
      this.skyMaterial.uniforms.uBottomColor.value.copy(midCol);
      this.skyMaterial.uniforms.uHorizonColor.value.copy(horizCol);
      this.skyMaterial.uniforms.uNightFactor.value = darkNight;
      this.skyMaterial.uniforms.uDuskFactor.value = duskAmount;
    }

    if (this.cloudDome) {
      const cloudTint = new THREE.Color('#ffffff')
        .lerp(new THREE.Color('#ffd7ad'), duskAmount)
        .lerp(new THREE.Color('#445175'), darkNight);
      if (weather === 'rain') {
        cloudTint.lerp(new THREE.Color('#5e7599'), 0.72);
      }
      (this.cloudDome.uniforms.uTint.value as THREE.Color).copy(cloudTint);
      const shadowTint = new THREE.Color('#6b7b99')
        .lerp(new THREE.Color('#6b5a78'), duskAmount)
        .lerp(new THREE.Color('#1a2238'), darkNight);
      if (weather === 'rain') {
        shadowTint.lerp(new THREE.Color('#182742'), 0.78);
      }
      (this.cloudDome.uniforms.uShadowColor.value as THREE.Color).copy(shadowTint);
      this.cloudDome.update(
        this.sceneElapsedTime,
        sunDir,
        fogCol,
        weather === 'rain' ? 0.84 : undefined
      );
    }

    if (this.directionalLight) {
      this.sunDirection.copy(sunDir);
      this.visibilityShadowController.setSunDirection(this.sunDirection);
      const focus =
        this.boundCamera && this.boundCamera.position.lengthSq() >= 1e-6
          ? this.boundCamera.position
          : this.getSpawnPoint().position;
      this.directionalLight.position.copy(focus).addScaledVector(sunDir, 150);
      const sunCol = new THREE.Color('#fff5e0')
        .lerp(new THREE.Color('#ffd299'), duskAmount)
        .lerp(new THREE.Color('#7fa3e8'), nightAmount);
      this.directionalLight.color.copy(sunCol);
      this.directionalLight.intensity = 2.65 * dayAmount + 0.65 * nightAmount;
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.48 * dayAmount + 0.24 * nightAmount;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = 0.78 * dayAmount + 0.34 * nightAmount;
    }

    const baseMist = weather === 'mist' ? 0.78 : weather === 'rain' ? 0.58 : 0.42;
    const fogDens = weather === 'mist' ? 0.00022 : weather === 'rain' ? 0.00018 : 0.000085;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogCol);
      this.scene.fog.density = fogDens;
    }

    if (this.terrainMaterial) {
      this.terrainMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.terrainMaterial.uniforms.uSunColor.value.setRGB(
        1.18 * dayAmount + 0.35 * nightAmount,
        0.90 * dayAmount + 0.42 * nightAmount,
        0.60 * dayAmount + 0.62 * nightAmount
      );
      this.terrainMaterial.uniforms.uAmbientScale.value = 1.0 * dayAmount + 0.55 * nightAmount;
      this.terrainMaterial.uniforms.uMistIntensity.value = baseMist;
      this.terrainMaterial.uniforms.uMistColor.value.copy(fogCol);
      this.terrainMaterial.uniforms.fogColor.value.copy(fogCol);
      this.terrainMaterial.uniforms.fogDensity.value = fogDens;
    }

    if (this.waterMaterial) {
      this.waterMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.waterMaterial.uniforms.uHorizonColor.value.copy(horizCol);
      this.waterMaterial.uniforms.uSkyTopColor.value.copy(topCol);
      this.waterMaterial.uniforms.uMistIntensity.value = baseMist * 0.8;
      this.waterMaterial.uniforms.uMistColor.value.copy(fogCol);
      this.waterMaterial.uniforms.fogColor.value.copy(fogCol);
      this.waterMaterial.uniforms.fogDensity.value = fogDens;
    }

    if (this.grassMaterial) {
      this.grassMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.grassMaterial.uniforms.fogColor.value.copy(fogCol);
      this.grassMaterial.uniforms.fogDensity.value = fogDens;
    }

    if (this.egretMaterial) {
      this.egretMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.egretMaterial.uniforms.fogColor.value.copy(fogCol);
      this.egretMaterial.uniforms.fogDensity.value = fogDens;
    }

    // Boost glowing silk lanterns & inner candle cores at dusk and night
    this.baseLanternIntensity = 1.90 + duskAmount * 0.25 + nightAmount * 0.95;
    if (this.lanternSilkMaterial) {
      this.lanternSilkMaterial.emissiveIntensity = this.baseLanternIntensity;
    }
    if (this.lanternCoreMaterial) {
      this.lanternCoreMaterial.emissiveIntensity = 2.45 + nightAmount * 0.85;
    }

    if (this.sharedMaterials) {
      const wetScale = weather === 'rain' ? 0.52 : 1.0;
      this.sharedMaterials.stone.roughness = 0.72 * wetScale;
      this.sharedMaterials.terracottaRoof.roughness = 0.66 * wetScale;
      this.sharedMaterials.darkRoof.roughness = 0.66 * wetScale;
      this.sharedMaterials.whitePlaster.roughness = 0.82 * wetScale;
    }

    if (this.weatherParticles) {
      this.weatherParticles.setMode(weather);
    }
    this.referenceShowController?.setAtmosphere({
      timeOfDay: hour,
      weather,
      nightAmount,
      duskAmount
    });
  }

  public getQualityTier(): VietnamQualityTier {
    return this.qualitySettings.tier;
  }

  private applyFoliageQualityScaling(): void {
    const scale = this.qualitySettings.foliageDensityScale;
    for (const entry of this.scalableFoliage) {
      entry.mesh.count = Math.max(1, Math.round(entry.baseCount * scale));
    }
  }

  public setQualityTier(tier: VietnamQualityTier): void {
    const preset = QUALITY_PRESETS[tier];
    if (!preset) return;
    this.qualitySettings = preset;
    if (!this.isInitialized) return;

    this.applyFoliageQualityScaling();
    this.pipeline?.setQualityTier(tier);
    this.visibilityShadowController.applyQuality(preset);
    this.lightBudgetManager.setPoolSize(preset.maxActivePointLights, this.scene);

    const rAny = this.boundRenderer as unknown as {
      setPixelRatio?: (v: number) => void;
    } | null;
    if (rAny && typeof rAny.setPixelRatio === 'function' && typeof window !== 'undefined') {
      rAny.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.dprCap));
    }

    const camPos =
      this.boundCamera && this.boundCamera.position.lengthSq() >= 1e-6
        ? this.boundCamera.position
        : this.getSpawnPoint().position;
    this.visibilityShadowController.update(this.boundCamera, this.sceneElapsedTime, true);
    this.lightBudgetManager.update(camPos, true);
  }

  public getPerfMetrics(): VietnamPerfMetrics {
    let totalMeshes = 0;
    let instancedMeshes = 0;
    let totalInstances = 0;
    let totalTriangles = 0;
    let visibleTriangles = 0;
    let frustumCulledOffCount = 0;
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();

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
      deduplicatedMaterialsSaved: this.lastDedupeSaved
    };
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = deltaTime;
    this.lastElapsedTime = elapsedTime;
    this.sceneElapsedTime = elapsedTime;

    if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = elapsedTime;
    if (this.terrainMaterial) this.terrainMaterial.uniforms.uTime.value = elapsedTime;
    if (this.waterMaterial) this.waterMaterial.uniforms.uTime.value = elapsedTime;
    if (this.grassMaterial) this.grassMaterial.uniforms.uTime.value = elapsedTime;
    if (this.egretMaterial) this.egretMaterial.uniforms.uTime.value = elapsedTime;
    if (this.motesMaterial) this.motesMaterial.uniforms.uTime.value = elapsedTime;
    this.lanternAnimUniform.uTime.value = elapsedTime;

    if (this.cloudDome) {
      this.cloudDome.update(elapsedTime);
    }
    if (this.incenseSmoke) {
      this.incenseSmoke.uniforms.uTime.value = elapsedTime;
    }
    if (this.weatherParticles) {
      const focus = this.boundCamera ? this.boundCamera.position : undefined;
      this.weatherParticles.update(deltaTime, elapsedTime, focus);
    }

    this.animationBus.update(this.sceneElapsedTime);

    this.updateEgrets(elapsedTime);
    this.updateJunkBoats(elapsedTime);
    this.referenceShowController?.update(elapsedTime, this.boundCamera?.position);

    const camPos =
      this.boundCamera && this.boundCamera.position.lengthSq() >= 1e-6
        ? this.boundCamera.position
        : this.getSpawnPoint().position;
    if (this.streamingMode === 'proximity' && this.zoneStreamer) {
      if (
        this.lastZoneStreamPos.distanceToSquared(camPos) >= 16.0 ||
        elapsedTime - this.lastZoneStreamTime >= 0.25
      ) {
        this.lastZoneStreamPos.copy(camPos);
        this.lastZoneStreamTime = elapsedTime;
        this.zoneStreamer.update(camPos, (d) => this.makeZoneBuildContext(d));
      }
    }
    this.visibilityShadowController.update(this.boundCamera, elapsedTime);
    this.lightBudgetManager.update(camPos);

    if (
      typeof window !== 'undefined' &&
      (this.lastPerfPublishTime < 0 || elapsedTime - this.lastPerfPublishTime >= 1.0)
    ) {
      this.lastPerfPublishTime = elapsedTime;
      const rInfo = (this.boundRenderer as unknown as { info?: THREE.WebGLInfo } | null)?.info;
      (window as unknown as { __vietnamPerfStats?: Record<string, unknown> }).__vietnamPerfStats = {
        qualityTier: this.qualitySettings.tier,
        lights: this.lightBudgetManager.getStats(),
        visibility: this.visibilityShadowController.getStats(),
        deduplicatedMaterialsSaved: this.lastDedupeSaved,
        renderCalls: rInfo?.render?.calls ?? 0,
        renderTriangles: rInfo?.render?.triangles ?? 0
      };
    }
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

  public updateConfig(newConfig: Partial<SpaceConfig>, isInitialHydration = false): void {
    if (!this.isInitialized || !newConfig || typeof newConfig !== 'object') return;
    if (isInitialHydration && this.hasUserMutation) return;
    if (!isInitialHydration) {
      this.hasUserMutation = true;
    }

    if (newConfig.fog && this.scene.fog instanceof THREE.FogExp2) {
      if (newConfig.fog.color && typeof newConfig.fog.color === 'string') {
        this.scene.fog.color.set(newConfig.fog.color);
        this.terrainMaterial?.uniforms.fogColor?.value?.set(newConfig.fog.color);
        this.waterMaterial?.uniforms.fogColor?.value?.set(newConfig.fog.color);
        this.grassMaterial?.uniforms.fogColor?.value?.set(newConfig.fog.color);
        this.egretMaterial?.uniforms.fogColor?.value?.set(newConfig.fog.color);
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
      }
      if (
        typeof newConfig.fog.density === 'number' &&
        Number.isFinite(newConfig.fog.density) &&
        newConfig.fog.density >= 0
      ) {
        this.scene.fog.density = newConfig.fog.density;
        if (this.terrainMaterial?.uniforms.fogDensity) {
          this.terrainMaterial.uniforms.fogDensity.value = newConfig.fog.density;
        }
        if (this.waterMaterial?.uniforms.fogDensity) {
          this.waterMaterial.uniforms.fogDensity.value = newConfig.fog.density;
        }
        if (this.grassMaterial?.uniforms.fogDensity) {
          this.grassMaterial.uniforms.fogDensity.value = newConfig.fog.density;
        }
        if (this.egretMaterial?.uniforms.fogDensity) {
          this.egretMaterial.uniforms.fogDensity.value = newConfig.fog.density;
        }
        if (this.currentConfig?.fog) this.currentConfig.fog.density = newConfig.fog.density;
      }
    }

    if (newConfig.sky) {
      if (newConfig.sky.topColor) {
        this.skyMaterial?.uniforms.uTopColor.value.set(newConfig.sky.topColor);
        this.waterMaterial?.uniforms.uSkyTopColor.value.set(newConfig.sky.topColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
      }
      if (newConfig.sky.bottomColor) {
        this.skyMaterial?.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
      }
      if (newConfig.sky.horizonColor) {
        this.skyMaterial?.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        this.waterMaterial?.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
      }
      if (typeof newConfig.sky.cloudSpeed === 'number' && Number.isFinite(newConfig.sky.cloudSpeed)) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudSpeed = newConfig.sky.cloudSpeed;
      }
      if (typeof newConfig.sky.cloudCoverage === 'number' && Number.isFinite(newConfig.sky.cloudCoverage)) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uCloudCoverage.value = newConfig.sky.cloudCoverage;
        if (this.terrainMaterial?.uniforms.uCloudCoverage) {
          this.terrainMaterial.uniforms.uCloudCoverage.value = newConfig.sky.cloudCoverage;
        }
        if (this.cloudDome) {
          this.cloudDome.update(this.sceneElapsedTime, undefined, undefined, newConfig.sky.cloudCoverage);
        }
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudCoverage = newConfig.sky.cloudCoverage;
      }
    }

    if (newConfig.wind) {
      if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.terrainMaterial) this.terrainMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.incenseSmoke) this.incenseSmoke.uniforms.uWindSpeed.value = newConfig.wind.speed;
        this.animationBus.setWindSpeed(newConfig.wind.speed);
        for (const fw of this.foliageWindUniforms) fw.uWindSpeed.value = newConfig.wind.speed;
        for (const au of this.extraAnimatedUniforms) {
          if (au.uWindSpeed) au.uWindSpeed.value = newConfig.wind.speed;
        }
        if (this.currentConfig?.wind) this.currentConfig.wind.speed = newConfig.wind.speed;
      }
      if (typeof newConfig.wind.swayIntensity === 'number' && Number.isFinite(newConfig.wind.swayIntensity)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.currentConfig?.wind) this.currentConfig.wind.swayIntensity = newConfig.wind.swayIntensity;
      }
      if (typeof newConfig.wind.gustiness === 'number' && Number.isFinite(newConfig.wind.gustiness)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uGustiness.value = newConfig.wind.gustiness;
        if (this.currentConfig?.wind) this.currentConfig.wind.gustiness = newConfig.wind.gustiness;
      }
      if (newConfig.wind.direction && Array.isArray(newConfig.wind.direction)) {
        const dx = newConfig.wind.direction[0];
        const dz = newConfig.wind.direction[2] ?? newConfig.wind.direction[1] ?? 0.45;
        this.grassMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
        this.terrainMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
        this.incenseSmoke?.uniforms.uWindDir.value.set(dx, dz).normalize();
        if (this.currentConfig?.wind) {
          this.currentConfig.wind.direction = newConfig.wind.direction as [number, number, number];
        }
      }
    }

    if (newConfig.lighting) {
      if (newConfig.lighting.ambient && this.ambientLight) {
        if (newConfig.lighting.ambient.color) this.ambientLight.color.set(newConfig.lighting.ambient.color);
        if (typeof newConfig.lighting.ambient.intensity === 'number' && Number.isFinite(newConfig.lighting.ambient.intensity)) {
          this.ambientLight.intensity = newConfig.lighting.ambient.intensity;
        }
      }
      if (newConfig.lighting.directional && this.directionalLight) {
        if (newConfig.lighting.directional.color) this.directionalLight.color.set(newConfig.lighting.directional.color);
        if (typeof newConfig.lighting.directional.intensity === 'number' && Number.isFinite(newConfig.lighting.directional.intensity)) {
          this.directionalLight.intensity = newConfig.lighting.directional.intensity;
        }
        if (Array.isArray(newConfig.lighting.directional.position) && newConfig.lighting.directional.position.length >= 3) {
          const [lx, ly, lz] = newConfig.lighting.directional.position;
          const sunDir = new THREE.Vector3(lx, ly, lz).normalize();
          this.sunDirection.copy(sunDir);
          this.visibilityShadowController.setSunDirection(this.sunDirection);
          this.directionalLight.position.set(lx, ly, lz);
          this.skyMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.terrainMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.waterMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.grassMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.egretMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.cloudDome?.update(this.sceneElapsedTime, sunDir);
        }
      }
    }

    if (newConfig.audio && this.currentConfig?.audio) {
      if (typeof newConfig.audio.defaultVolume === 'number' && Number.isFinite(newConfig.audio.defaultVolume)) {
        this.currentConfig.audio.defaultVolume = newConfig.audio.defaultVolume;
      }
      if (newConfig.audio.trackId) {
        this.currentConfig.audio.trackId = newConfig.audio.trackId;
      }
    }

    if (this.currentConfig && this.onConfigUpdate) {
      this.onConfigUpdate(this.currentConfig);
    }

    if (
      !isInitialHydration &&
      this.currentConfig &&
      typeof window !== 'undefined' &&
      (window as any).__currentUserRole === 'creator' &&
      typeof fetch === 'function'
    ) {
      fetch(`/api/spaces/${this.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: this.currentConfig })
      }).catch(() => { });
    }
  }

  public getGroundHeight(x: number, z: number): number {
    return getVietnamHeritageHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 0;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 58;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;

    const lookAt = this.currentConfig?.camera?.lookAt ?? [0, 5.2, -12];
    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2])
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = this.currentConfig?.camera?.wanderRadius ?? 1450;
    return {
      radius,
      center: new THREE.Vector3(0, 0, 0),
      minX: -radius,
      maxX: radius,
      minZ: -radius,
      maxZ: radius
    };
  }

  public getPointsOfInterest(): IPointOfInterest[] {
    return VIETNAM_LANDMARK_REGISTRY.buildPointsOfInterest(
      (x, z) => this.getGroundHeight(x, z),
      VIETNAM_WATER_LEVEL
    );
  }

  public dispose(): void {
    if (!this.isInitialized) return;

    this.pipeline?.dispose();
    this.pipeline = null;

    this.zoneStreamer?.disposeAll();
    this.zoneStreamer = null;

    this.lightBudgetManager.dispose();
    this.visibilityShadowController.dispose();
    this.animationBus.clear();

    if (this.directionalLight?.shadow) {
      const shadow = this.directionalLight.shadow as THREE.DirectionalLightShadow & {
        mapPass?: THREE.WebGLRenderTarget | null;
      };
      if (shadow.map) {
        shadow.map.dispose();
        shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
      if (shadow.mapPass) {
        shadow.mapPass.dispose();
        shadow.mapPass = null;
      }
      if (typeof shadow.dispose === 'function') {
        shadow.dispose();
      }
    }

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    this.signageAtlas?.dispose();
    this.signageAtlas = null;
    this.sharedShaders?.dispose();
    this.sharedShaders = null;
    this.materialLib?.dispose();
    this.materialLib = null;
    this.cachedTextures = null;

    for (const set of this.pbrSets) {
      disposePbrTextureSet(set);
    }
    this.pbrSets = [];

    for (const tex of this.extraTextures) {
      tex.dispose();
    }
    this.extraTextures = [];

    for (const mat of this.extraMaterials) {
      mat.dispose();
    }
    this.extraMaterials = [];

    if (this.boundRenderer && (this.boundRenderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.boundRenderer.shadowMap.enabled = this.prevShadowEnabled;
      this.boundRenderer.shadowMap.autoUpdate = this.prevShadowAutoUpdate;
      this.boundRenderer.shadowMap.type = this.prevShadowType;
    }
    this.boundRenderer = null;

    if (this.boundCamera) {
      this.boundCamera.far = this.prevCameraFar;
      if (typeof this.boundCamera.updateProjectionMatrix === 'function') {
        this.boundCamera.updateProjectionMatrix();
      }
      this.boundCamera = null;
    }

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
    if (this.scene) {
      this.scene.environment = null;
    }

    this.cloudDome?.dispose();
    this.cloudDome = null;
    this.weatherParticles?.dispose();
    this.weatherParticles = null;
    this.incenseSmoke?.dispose();
    this.incenseSmoke = null;
    this.sharedMaterials = null;
    this.referenceShowController = null;

    this.skyMaterial = null;
    this.terrainMaterial = null;
    this.waterMaterial = null;
    this.grassMaterial = null;
    this.egretMaterial = null;
    this.motesMaterial = null;
    this.lanternSilkMaterial = null;
    this.lanternCoreMaterial = null;
    this.foliageWindUniforms = [];
    this.extraAnimatedUniforms = [];
    this.incenseSources = [];

    this.junkBoats = [];
    this.boatBaseYaws.clear();
    this.egretsMesh = null;
    this.egretOrbits = [];
    this.exclusionCircles = [];
    this.scalableFoliage = [];
    this.zoneMeta.clear();
    this.zoneProtectedMaterials.clear();
    this.dedupeProtectedMaterials.clear();
    this.canonicalMaterialSeeds = [];
    this.corePostProcessReady = false;
    this.lastZoneStreamPos.set(Infinity, Infinity, Infinity);
    this.lastZoneStreamTime = -1;

    this.ambientLight = null;
    this.hemiLight = null;
    this.directionalLight = null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;
    this.sceneElapsedTime = 0.0;
    this.lastDedupeSaved = 0;
    this.lastPerfPublishTime = -1;

    this.isInitialized = false;
  }
}
