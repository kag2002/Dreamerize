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
  createChamRubbedBrickPbrTextures,
  createMarseilleBrickPbrTextures,
  createImperialBrickPbrTextures,
  createLateriteHoneycombPbrTextures,
  createAgedVietnamesePlasterPbrTextures,
  createBatTrangFloorPbrTextures,
  createThatchFiberPbrTextures,
  createBambooWeavePbrTextures,
  createBronzeVerdigrisPbrTextures
} from '../textures/vietnamBrickPbrTextures';
import {
  createHueImperialMaterialPack,
  isHeadlessRenderer,
  HueImperialMaterialPack
} from '../textures/hueImperialPbrTextures';
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
  buildOnePillarPagodaComplex,
  buildHoanKiemComplex
} from './hanoiIconsBuilder';
import {
  buildGoldenBridgeComplex,
  buildHaLongBayComplex
} from './cauVangHaLongBuilder';

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
  applyWorldBoxUV,
  createArchedWallGeometry,
  createPointedArchedWallGeometry,
  createSculptedRockGeometry,
  createGableRoofGeometry,
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
  createOrthogonalOnePillarTrussParts,
  createBronzeBellParts,
  createBronzeCraneOnTortoiseParts,
  createGuardianBeastParts,
  createSmoothTaperedTubeGeometry,
  createMotifBandParts,
  createShouCharacterParts,
  createLotusPetalRingParts,
  createPhoenixFinialParts,
  createCuaVongParts,
  createSunWindowParts,
  createBasReliefPanelParts,
  createAncientStoneLanternParts,
  tagMotifIds
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
import { buildVanMieuQuocTuGiamComplex } from './vanMieuQuocTuGiamBuilder';
import { buildVietnamCentralLandmarks } from './vietnamCentralBuilder';
import { buildVietnamSouthLandmarks } from './vietnamSouthBuilder';
import {
  buildVietnamReferenceShowUpgrades,
  VietnamReferenceShowController
} from './vietnamReferenceShowBuilder';
import { VIETNAM_LANDMARK_REGISTRY } from '../vietnam/core/LandmarkRegistry';
import { MaterialLibrary } from '../framework/MaterialLibrary';
import { ResourceScope } from '../framework/ResourceScope';
import { ZoneStreamer } from '../framework/ZoneStreamer';
import { SpatialHashGrid2D } from '../framework/SpatialHashGrid';
import { PartsBuilder } from '../framework/PartsBuilder';
import { WorldRuntime } from '../framework/WorldRuntime';
import {
  buildChunkedTerrainGroup,
  buildWarpedWaterMesh
} from '../framework/TerrainChunkBuilder';
import type {
  VietnamPerfMetrics,
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
  private hueMoatUniforms?: { uTime: { value: number }; uNightAmount: { value: number }; uDuskAmount: { value: number } };
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

  private readonly streamingMode: VietnamStreamingMode;
  private readonly worldRuntime: WorldRuntime;
  private readonly sunDirection = new THREE.Vector3(62, 34, -85).normalize();
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
  private readonly exclusionGrid = new SpatialHashGrid2D<ExclusionCircle>(80);
  private exclusionGridIndexedCount = 0;

  private readonly tmpMat = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(options?: VietnamHeritageSceneOptions) {
    this.streamingMode = options?.streamingMode ?? 'all';
    this.worldRuntime = new WorldRuntime({
      qualityTier: options?.qualityTier,
      consolidateSolids: true,
      autoScaleFoliage: false,
      reserveLightPoolWhenEmpty: true
    });
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
    this.exclusionGrid.clear();
    this.exclusionGridIndexedCount = 0;
    this.worldRuntime.clearScalableFoliage();
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
        moveSpeed: config?.camera?.moveSpeed ?? 24.0,
        wanderSpeed: config?.camera?.wanderSpeed ?? 6.4,
        wanderRadius: Math.max(1450, config?.camera?.wanderRadius ?? 1450),
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

    const qualitySettings = this.worldRuntime.getQualitySettings();
    const dirPos = this.currentConfig.lighting.directional.position;
    this.directionalLight = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.directionalLight.castShadow = this.currentConfig.lighting.directional.castShadow ?? true;
    this.directionalLight.shadow.mapSize.set(
      qualitySettings.shadowMapSize,
      qualitySettings.shadowMapSize
    );
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 520;
    const hs = qualitySettings.shadowFrustumHalfSize;
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
    const headless = isHeadlessRenderer(renderer);
    const pbrSize = headless
      ? 256
      : qualitySettings.tier === 'low'
        ? 256
        : qualitySettings.tier === 'ultra'
          ? 1024
          : 512;
    const pbr = this.createPbrAssets(renderer, pbrSize);
    const materials = this.createSharedMaterials(pbr);
    this.sharedMaterials = materials;
    const materialLib = new MaterialLibrary(materials);
    this.materialLib = materialLib;
    this.signageAtlas = new SignageAtlas();
    this.sharedShaders = createVietnamSharedShaders();
    const sharedDongSon = createDongSonBronzeTextures(headless ? 256 : pbrSize, renderer);
    this.extraTextures.push(sharedDongSon.map, sharedDongSon.normalMap, sharedDongSon.roughnessMap);
    this.cachedTextures = { dongSon: sharedDongSon };
    const huePack: HueImperialMaterialPack = createHueImperialMaterialPack(renderer, pbr.bronzePatina, headless ? 128 : pbrSize);
    this.extraTextures.push(...huePack.allTextures);
    this.extraMaterials.push(...huePack.allMaterials);
    this.extraAnimatedUniforms.push(huePack.moatWaterUniforms);
    this.hueMoatUniforms = huePack.moatWaterUniforms;
    for (const mat of Object.values(materials)) {
      if (mat) this.zoneProtectedMaterials.add(mat);
    }
    for (const mat of this.sharedShaders.allMaterials) {
      this.zoneProtectedMaterials.add(mat);
    }
    for (const mat of huePack.allMaterials) {
      this.zoneProtectedMaterials.add(mat);
    }
    this.buildSkyAndIBL(renderer, sunDir);

    // 4. Terrain & Fresnel Bay/Lake Water
    this.buildTerrain(sunDir, windDir2D);
    this.buildBayAndLakeWater(sunDir);

    // 5. Iconic Hero Landmarks of Vietnam
    const builderCtx: VietnamBuilderContext = {
      scene: this.scene,
      renderer,
      pbr,
      materials,
      materialLib,
      signageAtlas: this.signageAtlas,
      sharedShaders: this.sharedShaders,
      cachedTextures: this.cachedTextures,
      huePack,
      exclusionCircles: this.exclusionCircles,
      junkBoats: this.junkBoats,
      extraTextures: this.extraTextures,
      extraMaterials: this.extraMaterials,
      foliageWindUniforms: this.foliageWindUniforms,
      animatedUniforms: this.extraAnimatedUniforms,
      getHeight: getVietnamHeritageHeight,
      getNormal: getVietnamHeritageNormal
    };

    this.buildKhueVanCacAndPlaza(pbr, renderer);
    buildOnePillarPagodaComplex(
      builderCtx,
      (mesh, count) => this.worldRuntime.registerScalableFoliage(mesh, count),
      this.worldRuntime.getQualitySettings().foliageDensityScale
    );
    buildHoanKiemComplex(builderCtx);
    buildGoldenBridgeComplex(builderCtx);
    buildHaLongBayComplex(builderCtx, () => this.updateJunkBoats(0));

    // 5b. 3-Region Grand Vietnam Panorama Landmarks (North, Central & Highlands, South & Islands)

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

    // 8. Optimization & Runtime Resource Budgets via WorldRuntime:
    //    AnimationBus + ZoneStreamer + Material Deduplication + Pooled PointLights + Frustum/Distance Culling + Camera-Following Shadows
    this.worldRuntime.animationBus.clear();
    this.worldRuntime.animationBus.registerMany(this.sharedShaders.allUniforms);
    this.worldRuntime.animationBus.registerMany(this.foliageWindUniforms);
    this.worldRuntime.animationBus.registerMany(this.extraAnimatedUniforms);

    this.dedupeProtectedMaterials = new Set<THREE.Material>([
      materials.lanternSilk,
      ...this.sharedShaders.allMaterials,
      ...huePack.allMaterials
    ]);
    if (materials.lanternCore) this.dedupeProtectedMaterials.add(materials.lanternCore);
    if (this.skyMaterial) this.dedupeProtectedMaterials.add(this.skyMaterial);
    if (this.terrainMaterial) this.dedupeProtectedMaterials.add(this.terrainMaterial);
    if (this.waterMaterial) this.dedupeProtectedMaterials.add(this.waterMaterial);
    if (this.grassMaterial) this.dedupeProtectedMaterials.add(this.grassMaterial);
    if (this.egretMaterial) this.dedupeProtectedMaterials.add(this.egretMaterial);
    if (this.motesMaterial) this.dedupeProtectedMaterials.add(this.motesMaterial);

    this.canonicalMaterialSeeds = Object.values(materials).filter(
      (m): m is THREE.Material => Boolean(m)
    );
    this.canonicalMaterialSeeds.push(...huePack.allMaterials);

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

    const signageReused = this.signageAtlas.getStats().reusedMaterials;
    const shaderReused = this.sharedShaders.getReusedCount();
    const spawnPos = this.getSpawnPoint().position;
    this.worldRuntime.attach({
      scene: this.scene,
      renderer,
      camera,
      directionalLight: this.directionalLight,
      pipeline: this.pipeline,
      zoneStreamer: this.zoneStreamer,
      materialLib,
      sunDirection: this.sunDirection,
      fallbackFocusPos: spawnPos,
      protectedMaterials: this.dedupeProtectedMaterials,
      extraMaterials: this.extraMaterials,
      canonicalMaterialSeeds: this.canonicalMaterialSeeds,
      additionalDedupeSaved: signageReused + shaderReused
    });
    this.corePostProcessReady = true;

    const initialFocus =
      camera && camera.position.lengthSq() >= 1e-6 ? camera.position : spawnPos;
    if (this.streamingMode === 'proximity') {
      this.zoneStreamer.update(initialFocus, (d) => this.makeZoneBuildContext(d));
      this.lastZoneStreamPos.copy(initialFocus);
      this.lastZoneStreamTime = 0;
    }
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
      anim: this.worldRuntime.animationBus,
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

    const lightIds = this.corePostProcessReady
      ? this.worldRuntime.handleZoneLoaded(handle.output.group)
      : [];
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
      this.worldRuntime.handleZoneUnloaded(handle.output.group, meta?.lightIds);
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

    // 9 dedicated Vietnamese heritage architectural PBR texture sets (scales to 1024px on ultra, 512px high, 256px headless)
    const archSize = isHeadlessRenderer(renderer) ? 256 : texSize;
    const chamBrick = createChamRubbedBrickPbrTextures({ size: archSize, seed: 1103, renderer, repeatX: 2, repeatY: 2 });
    const marseilleBrick = createMarseilleBrickPbrTextures({ size: archSize, seed: 1207, renderer, repeatX: 2, repeatY: 2 });
    const imperialBrick = createImperialBrickPbrTextures({ size: archSize, seed: 1319, renderer, repeatX: 2, repeatY: 2 });
    const laterite = createLateriteHoneycombPbrTextures({ size: archSize, seed: 1429, renderer, repeatX: 2, repeatY: 2 });
    const agedPlaster = createAgedVietnamesePlasterPbrTextures({ size: archSize, seed: 1543, renderer, repeatX: 2, repeatY: 2 });
    const batTrangFloor = createBatTrangFloorPbrTextures({ size: archSize, seed: 1657, renderer, repeatX: 3, repeatY: 3 });
    const thatch = createThatchFiberPbrTextures({ size: archSize, seed: 1777, renderer, repeatX: 3, repeatY: 3 });
    const bambooWeave = createBambooWeavePbrTextures({ size: archSize, seed: 1889, renderer, repeatX: 3, repeatY: 3 });
    const bronzePatina = createBronzeVerdigrisPbrTextures({ size: archSize, seed: 1997, renderer, repeatX: 2, repeatY: 2 });

    this.pbrSets.push(
      stone,
      terracotta,
      darkRoof,
      timber,
      plaster,
      granite,
      bark,
      chamBrick,
      marseilleBrick,
      imperialBrick,
      laterite,
      agedPlaster,
      batTrangFloor,
      thatch,
      bambooWeave,
      bronzePatina
    );
    this.extraTextures.push(leafAtlas);

    return {
      stone,
      terracotta,
      darkRoof,
      timber,
      plaster,
      granite,
      bark,
      leafAtlas,
      chamBrick,
      marseilleBrick,
      imperialBrick,
      laterite,
      agedPlaster,
      batTrangFloor,
      thatch,
      bambooWeave,
      bronzePatina
    };
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
      map: pbr.agedPlaster.map,
      normalMap: pbr.agedPlaster.normalMap,
      roughnessMap: pbr.agedPlaster.roughnessMap,
      roughness: 0.80
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
    const darkIronwood = new THREE.MeshStandardMaterial({
      color: '#34271f',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.78,
      metalness: 0.03
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
    // Fixes S1: authentic mortarless rubbed Chăm brick instead of barrel roof tiles!
    const chamBrick = new THREE.MeshStandardMaterial({
      color: '#e6c8ba',
      map: pbr.chamBrick.map,
      normalMap: pbr.chamBrick.normalMap,
      roughnessMap: pbr.chamBrick.roughnessMap,
      aoMap: pbr.chamBrick.aoMap,
      roughness: 0.82,
      metalness: 0.03
    });
    const marseilleBrick = new THREE.MeshStandardMaterial({
      color: '#f2ded4',
      map: pbr.marseilleBrick.map,
      normalMap: pbr.marseilleBrick.normalMap,
      roughnessMap: pbr.marseilleBrick.roughnessMap,
      aoMap: pbr.marseilleBrick.aoMap,
      roughness: 0.78,
      metalness: 0.03
    });
    // FIX CCHN-04: Warm weathered terracotta-brick tone (#d4a88e) for Hanoi Flag Tower, Đoan Môn & Khuê Văn Các (not cold grey!)
    const weatheredImperialBrick = new THREE.MeshStandardMaterial({
      color: '#d4a88e',
      map: pbr.imperialBrick.map,
      normalMap: pbr.imperialBrick.normalMap,
      roughnessMap: pbr.imperialBrick.roughnessMap,
      aoMap: pbr.imperialBrick.aoMap,
      roughness: 0.86,
      metalness: 0.03
    });
    // FIX DL-05: Authentic rich rust-red honeycomb laterite (*đá ong đỏ nâu rỉ sắt*, #b87354) for Đường Lâm & Đền Hùng!
    const lateriteHoneycomb = new THREE.MeshStandardMaterial({
      color: '#b87354',
      map: pbr.laterite.map,
      normalMap: pbr.laterite.normalMap,
      roughnessMap: pbr.laterite.roughnessMap,
      aoMap: pbr.laterite.aoMap,
      roughness: 0.90,
      metalness: 0.02
    });
    const agedPlaster = new THREE.MeshStandardMaterial({
      color: '#dad7ce',
      map: pbr.agedPlaster.map,
      normalMap: pbr.agedPlaster.normalMap,
      roughnessMap: pbr.agedPlaster.roughnessMap,
      roughness: 0.88
    });
    const agedYellowPlaster = new THREE.MeshStandardMaterial({
      color: '#efe0b4',
      map: pbr.agedPlaster.map,
      normalMap: pbr.agedPlaster.normalMap,
      roughnessMap: pbr.agedPlaster.roughnessMap,
      roughness: 0.84
    });
    const mossyPlaster = new THREE.MeshStandardMaterial({
      color: '#c2c0b6',
      map: pbr.agedPlaster.map,
      normalMap: pbr.agedPlaster.normalMap,
      roughnessMap: pbr.agedPlaster.roughnessMap,
      roughness: 0.92
    });
    const batTrangFloor = new THREE.MeshStandardMaterial({
      color: '#ebd8cf',
      map: pbr.batTrangFloor.map,
      normalMap: pbr.batTrangFloor.normalMap,
      roughnessMap: pbr.batTrangFloor.roughnessMap,
      aoMap: pbr.batTrangFloor.aoMap,
      roughness: 0.80,
      metalness: 0.02
    });
    const thatchFiber = new THREE.MeshStandardMaterial({
      color: '#e8d9be',
      map: pbr.thatch.map,
      normalMap: pbr.thatch.normalMap,
      roughnessMap: pbr.thatch.roughnessMap,
      roughness: 0.94,
      side: THREE.DoubleSide
    });
    const bambooWeave = new THREE.MeshStandardMaterial({
      color: '#ebd9be',
      map: pbr.bambooWeave.map,
      normalMap: pbr.bambooWeave.normalMap,
      roughnessMap: pbr.bambooWeave.roughnessMap,
      roughness: 0.82,
      side: THREE.DoubleSide
    });
    const bronzePatina = new THREE.MeshStandardMaterial({
      color: '#d6dfd4',
      map: pbr.bronzePatina.map,
      normalMap: pbr.bronzePatina.normalMap,
      roughnessMap: pbr.bronzePatina.roughnessMap,
      roughness: 0.54,
      metalness: 0.62
    });
    const stainedGlass = new THREE.MeshStandardMaterial({
      color: '#f2cf8d',
      emissive: '#d89a42',
      emissiveIntensity: 0.95,
      roughness: 0.24,
      metalness: 0.12
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
      normalMap: pbr.bronzePatina.normalMap,
      roughnessMap: pbr.bronzePatina.roughnessMap,
      roughness: 0.28,
      metalness: 0.86
    });
    const bronze = new THREE.MeshStandardMaterial({
      color: '#6e5638',
      normalMap: pbr.bronzePatina.normalMap,
      roughnessMap: pbr.bronzePatina.roughnessMap,
      roughness: 0.46,
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
           float ribShade = 0.78 + 0.26 * abs(sin(atan(vLanternWorld.z, vLanternWorld.x) * 8.0));
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
    const whiteMarble = createWhiteMarbleMaterial(pbr.plaster);
    const ochreSand = createOchreSandMaterial(pbr.stone);

    const materials: VietnamSharedMaterials = {
      stone,
      whitePlaster,
      yellowOchrePlaster,
      crimsonLacquer,
      darkWood,
      darkIronwood,
      terracottaRoof,
      darkRoof,
      chamBrick,
      marseilleBrick,
      weatheredImperialBrick,
      lateriteHoneycomb,
      agedPlaster,
      agedYellowPlaster,
      mossyPlaster,
      batTrangFloor,
      thatchFiber,
      bambooWeave,
      bronzePatina,
      stainedGlass,
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
      darkIronwood,
      terracottaRoof,
      darkRoof,
      chamBrick,
      marseilleBrick,
      weatheredImperialBrick,
      lateriteHoneycomb,
      agedPlaster,
      agedYellowPlaster,
      mossyPlaster,
      batTrangFloor,
      thatchFiber,
      bambooWeave,
      bronzePatina,
      stainedGlass,
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

  private syncExclusionGrid(): void {
    const len = this.exclusionCircles.length;
    if (this.exclusionGridIndexedCount > len) {
      this.exclusionGrid.clear();
      this.exclusionGridIndexedCount = 0;
    }
    for (let i = this.exclusionGridIndexedCount; i < len; i++) {
      const ec = this.exclusionCircles[i];
      this.exclusionGrid.insert(ec, ec.x, ec.z, ec.r);
    }
    this.exclusionGridIndexedCount = len;
  }

  private isInsideExclusionCircle(x: number, z: number, extraPadding = 0): boolean {
    if (this.exclusionCircles.length === 0) return false;
    this.syncExclusionGrid();
    return this.exclusionGrid.containsPoint(x, z, extraPadding);
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
      baseY: 165,
      topY: 222,
      coverage: this.currentConfig?.sky?.cloudCoverage ?? 0.56,
      tint: '#ffffff',
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
    this.terrainMaterial = createVietnamTerrainMaterial(sunDir);
    this.terrainMaterial.uniforms.uWindDirection.value.copy(windDir2D);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.terrainMaterial.uniforms.fogColor.value.copy(this.scene.fog.color);
      this.terrainMaterial.uniforms.fogDensity.value = this.scene.fog.density;
    }

    const terrainGroup = buildChunkedTerrainGroup({
      groupName: 'VietnamHeritageTerrain',
      halfSpan: 2400,
      chunksPerAxis: 4,
      chunkSegs: 50,
      material: this.terrainMaterial,
      getHeight: getVietnamHeritageHeight,
      warp: true
    });
    this.scene.add(terrainGroup);
  }

  private buildBayAndLakeWater(sunDir: THREE.Vector3): void {
    this.waterMaterial = createVietnamBayWaterMaterial(sunDir);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.waterMaterial.uniforms.fogColor.value.copy(this.scene.fog.color);
      this.waterMaterial.uniforms.fogDensity.value = this.scene.fog.density;
    }

    const waterMesh = buildWarpedWaterMesh({
      name: 'HaLongAndLotusWater',
      halfSpan: 2400,
      segments: 108,
      waterLevel: VIETNAM_WATER_LEVEL,
      material: this.waterMaterial,
      warp: true
    });
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
    buildVanMieuQuocTuGiamComplex({
      scene: this.scene,
      renderer,
      sharedMaterials: this.sharedMaterials!,
      leafAtlas: pbr.leafAtlas,
      cachedDongSon: this.cachedTextures?.dongSon,
      lanternSilkMaterial: this.lanternSilkMaterial!,
      lanternCoreMaterial: this.lanternCoreMaterial!,
      sharedShaders: this.sharedShaders,
      signageAtlas: this.signageAtlas,
      exclusionCircles: this.exclusionCircles,
      incenseSources: this.incenseSources,
      extraMaterials: this.extraMaterials,
      extraTextures: this.extraTextures,
      extraAnimatedUniforms: this.extraAnimatedUniforms
    });
  }

  /**
   * Builds 9,000 Instanced emerald & golden-ripening Mù Cang Chải rice stalk clusters on the western terraces
   * (x in [-310, -112], z in [-112, 8]) plus 2 rustic timber rice-field watch huts (*chòi gác ruộng*).
   */
  private buildSapaRiceTerraces(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'SapaTerracedRiceFields';

    const riceCount = 8200;
    const stalkParts: THREE.BufferGeometry[] = [];
    const paintRiceColor = (g: THREE.BufferGeometry, r: number, gr: number, b: number) => {
      const cnt = g.attributes.position.count;
      const cols = new Float32Array(cnt * 3);
      for (let ci = 0; ci < cnt; ci++) {
        cols[ci * 3] = r;
        cols[ci * 3 + 1] = gr;
        cols[ci * 3 + 2] = b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      return g;
    };

    // 3 broader arched rice leaf blades + 2 golden drooping grain-head panicles (*bông lúa trĩu hạt*) per tuft
    for (let s = 0; s < 3; s++) {
      const blade = new THREE.PlaneGeometry(0.14, 0.80, 1, 2);
      const bPos = blade.attributes.position;
      for (let v = 0; v < bPos.count; v++) {
        const yv = bPos.getY(v) + 0.40;
        const t = clamp01(yv / 0.80);
        const taper = 1.0 - t * 0.82;
        bPos.setX(v, bPos.getX(v) * taper);
        bPos.setY(v, yv);
        bPos.setZ(v, t * t * 0.22);
      }
      blade.computeVertexNormals();
      blade.rotateY((s / 3) * Math.PI * 2 + 0.3);
      blade.rotateX(0.20);
      stalkParts.push(paintRiceColor(blade, 0.86, 0.96, 0.82));
    }
    for (const pYaw of [0.55, 2.65]) {
      const panicle = new THREE.PlaneGeometry(0.10, 0.42, 1, 2);
      const pPos = panicle.attributes.position;
      for (let v = 0; v < pPos.count; v++) {
        const yv = pPos.getY(v) + 0.21;
        const t = clamp01(yv / 0.42);
        const archY = 0.68 + Math.sin(t * Math.PI * 0.85) * 0.18 - t * t * 0.16;
        const archZ = 0.05 + t * 0.31;
        const widthMod = 0.55 + 0.70 * Math.sin(t * Math.PI);
        pPos.setXYZ(v, pPos.getX(v) * widthMod, archY, archZ);
      }
      panicle.computeVertexNormals();
      panicle.rotateY(pYaw);
      stalkParts.push(paintRiceColor(panicle, 1.0, 0.92, 0.52));
    }

    const riceGeo = mergeNormalized(stalkParts);
    const riceWindU = { uTime: { value: 0.0 }, uWindSpeed: { value: 2.0 } };
    this.foliageWindUniforms.push(riceWindU);
    const riceMat = new THREE.MeshStandardMaterial({
      color: '#7ab336',
      vertexColors: true,
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
      const rz = -112.0 + rand() * 98.0; // [-112, -14]
      if (this.isInsideExclusionCircle(rx, rz, 2.0)) continue;
      const contour = 8.0 * Math.sin(rz * 0.024 + 0.4) + 4.5 * Math.cos(rz * 0.013 - 0.8);
      const distUp = Math.max(0.0, (-116.0 - rx) + contour * 0.65);
      const stepIdx = Math.floor(distUp / 9.0);
      const frac = distUp / 9.0 - stepIdx;
      // FIX MCC-01: Limit dark flooded mirror-water bands to <= 15% so lush golden-emerald rice dominates like ref 05 & 76!
      const isMirrorWaterStep = ((stepIdx * 0.37) % 1.0) >= 0.85;
      if (isMirrorWaterStep || frac > 0.78) continue;

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
    this.worldRuntime.registerScalableFoliage(riceMesh, placed);
    riceMesh.count = Math.max(
      1,
      Math.round(placed * this.worldRuntime.getQualitySettings().foliageDensityScale)
    );
    riceMesh.instanceMatrix.needsUpdate = true;
    if (riceMesh.instanceColor) riceMesh.instanceColor.needsUpdate = true;
    group.add(riceMesh);

    // 2. FIX MCC-02: Two Authentic Rectangular Stilt Rice-Field Watch Huts (3.4m × 2.2m on 6 slender stilts, 0.75m open veranda, tightly closed weathered silver-grey plank walls & shaggy overhanging thatch roof — ref 76!)
    const shared = this.sharedMaterials!;
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#7b6b58',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughness: 0.88
    });
    this.extraMaterials.push(woodMat);
    const thatchMat = shared.thatchFiber ?? shared.ochreSand ?? shared.stone;
    const streamRockMat = shared.granite;

    const woodParts: THREE.BufferGeometry[] = [];
    const roofParts: THREE.BufferGeometry[] = [];
    const streamRockParts: THREE.BufferGeometry[] = [];
    for (const [hx, hz] of [
      [-162, -46],
      [-226, -24]
    ]) {
      const hy = getVietnamHeritageHeight(hx, hz);
      this.exclusionCircles.push({ x: hx, z: hz, r: 5.0 });
      // 6 Slender wooden stilts (3 along X × 2 along Z) with under-floor tie beams
      for (const ox of [-1.55, 0.0, 1.55]) {
        for (const oz of [-1.02, 1.02]) {
          const cornerGround = getVietnamHeritageHeight(hx + ox, hz + oz);
          const postBottom = cornerGround - 1.2;
          const postTop = hy + 3.05;
          const postH = postTop - postBottom;
          const post = new THREE.CylinderGeometry(0.072, 0.088, postH, 7);
          post.translate(hx + ox, postBottom + postH * 0.5, hz + oz);
          woodParts.push(post);
        }
        const xBeam = new THREE.BoxGeometry(0.11, 0.13, 2.25);
        xBeam.translate(hx + ox, hy + 1.48, hz);
        woodParts.push(xBeam);
      }
      // Elevated rectangular floor (3.4m × 2.2m) with 0.75m open front veranda at +X
      const floor = new THREE.BoxGeometry(3.45, 0.14, 2.25);
      floor.translate(hx, hy + 1.60, hz);
      woodParts.push(floor);

      // Overhanging shaggy 2-slope thatch gable roof (0.65m eave overhang + ridge bamboo clamp)
      const gableRoof = createGableRoofGeometry(4.65, 3.55, 1.48, 0.28, 'x');
      gableRoof.translate(hx, hy + 2.96, hz);
      roofParts.push(gableRoof);
      const ridgeClamp = new THREE.CylinderGeometry(0.055, 0.055, 4.7, 6);
      ridgeClamp.rotateZ(Math.PI * 0.5);
      ridgeClamp.translate(hx, hy + 4.46, hz);
      woodParts.push(ridgeClamp);

      // Tightly closed 4-sided vertical weathered plank walls (room x in [-1.55 .. +0.85], open 0.75m veranda at +X, single 0.75×1.45m entry door!)
      const roomBack = new THREE.BoxGeometry(0.10, 1.48, 2.12);
      roomBack.translate(hx - 1.55, hy + 2.34, hz);
      const roomNorth = new THREE.BoxGeometry(2.42, 1.48, 0.10);
      roomNorth.translate(hx - 0.35, hy + 2.34, hz - 1.02);
      const roomSouth = new THREE.BoxGeometry(2.42, 1.48, 0.10);
      roomSouth.translate(hx - 0.35, hy + 2.34, hz + 1.02);
      // Front wall flanking the 0.75m doorway opening
      const frontL = new THREE.BoxGeometry(0.10, 1.48, 0.68);
      frontL.translate(hx + 0.85, hy + 2.34, hz - 0.72);
      const frontR = new THREE.BoxGeometry(0.10, 1.48, 0.68);
      frontR.translate(hx + 0.85, hy + 2.34, hz + 0.72);
      woodParts.push(roomBack, roomNorth, roomSouth, frontL, frontR);

      // Triangular plank gable infill closing West & East eaves under the gable roof
      const gableInfillShape = new THREE.Shape();
      gableInfillShape.moveTo(-1.12, 0);
      gableInfillShape.lineTo(1.12, 0);
      gableInfillShape.lineTo(0, 1.18);
      gableInfillShape.closePath();
      for (const sx of [-1.55, 0.85]) {
        const gWall = new THREE.ExtrudeGeometry(gableInfillShape, { depth: 0.10, bevelEnabled: false });
        gWall.rotateY(Math.PI * 0.5);
        gWall.translate(hx + sx - 0.05, hy + 3.04, hz);
        woodParts.push(gWall);
      }

      // FIXED Bamboo Access Ladder: rails rotated +0.52 rad so they align cleanly with all 6 rungs (NO X-bug!)
      for (const lz of [-0.32, 0.32]) {
        const rail = new THREE.CylinderGeometry(0.04, 0.05, 1.88, 6);
        rail.rotateZ(0.52);
        rail.translate(hx + 1.74, hy + 0.62, hz + lz);
        woodParts.push(rail);
      }
      for (let rg = 0; rg < 6; rg++) {
        const tR = rg / 5;
        const rung = new THREE.CylinderGeometry(0.025, 0.025, 0.68, 5);
        rung.rotateX(Math.PI * 0.5);
        rung.translate(hx + 2.05 - tR * 0.62, hy + 0.10 + tR * 1.05, hz);
        woodParts.push(rung);
      }
    }

    // Bamboo irrigation spill-pipes (*Ống tre dẫn nước giữa các bậc ruộng*) & terrace stone bund markers
    for (let step = 1; step <= 8; step++) {
      const sx = -125.0 - step * 18.0;
      const sz = -75.0 + (step % 3) * 24.0;
      const sy = getVietnamHeritageHeight(sx, sz);
      const pipe = new THREE.CylinderGeometry(0.065, 0.075, 2.2, 6);
      pipe.rotateZ(1.22);
      pipe.translate(sx + 0.6, sy + 0.35, sz);
      const stake = new THREE.CylinderGeometry(0.05, 0.06, 1.1, 5);
      stake.translate(sx + 0.2, sy + 0.2, sz);
      woodParts.push(pipe, stake);
    }

    // 3. Bamboo Waterwheel (*Cọn nước Tây Bắc*) + Trestle-Supported 9.5m Aqueduct Trough + Mountain Stream Bed at (-138, -34)
    const wheelX = -138;
    const wheelZ = -34;
    const wheelY = getVietnamHeritageHeight(wheelX, wheelZ);
    this.exclusionCircles.push({ x: wheelX, z: wheelZ, r: 6.5 });
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
    // Elevated 9.5m bamboo aqueduct trough + 4 Grounded Bamboo A-Frame Support Trestles (ZERO floating!)
    const troughY = wheelY + 5.6;
    const troughZ = wheelZ + 0.6;
    const trough = new THREE.BoxGeometry(9.5, 0.18, 0.34);
    trough.translate(wheelX - 4.5, troughY, troughZ);
    woodParts.push(trough);

    for (const xOff of [-1.2, -3.6, -6.2, -8.8]) {
      const tx = wheelX + xOff;
      const tGround = getVietnamHeritageHeight(tx, troughZ);
      const tBot = tGround - 0.55;
      const tTop = troughY - 0.08;
      const tH = Math.max(1.2, tTop - tBot);
      const splayRad = 0.20;
      const legLen = tH / Math.cos(splayRad);
      const zSpread = tH * Math.tan(splayRad) * 0.5;
      for (const side of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.055, 0.072, legLen, 6);
        leg.rotateX(-side * splayRad);
        leg.translate(tx, (tTop + tBot) * 0.5, troughZ + side * zSpread);
        woodParts.push(leg);
      }
      // Horizontal cradle peg & mid cross-brace tying each A-frame trestle
      const cradle = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 5);
      cradle.rotateX(Math.PI * 0.5);
      cradle.translate(tx, tTop - 0.06, troughZ);
      const midBrace = new THREE.CylinderGeometry(0.038, 0.038, zSpread * 2.2, 5);
      midBrace.rotateX(Math.PI * 0.5);
      midBrace.translate(tx, (tTop + tBot) * 0.5, troughZ);
      woodParts.push(cradle, midBrace);
    }

    // Small mountain stream bed & mossy river boulders flowing beneath the bamboo waterwheel
    const streamGeo = new THREE.PlaneGeometry(3.2, 11.5, 4, 14);
    streamGeo.rotateX(-Math.PI * 0.5);
    const sPos = streamGeo.attributes.position;
    for (let vi = 0; vi < sPos.count; vi++) {
      const sx = wheelX + sPos.getX(vi) + Math.sin(sPos.getZ(vi) * 0.35) * 0.65;
      const sz = wheelZ + sPos.getZ(vi);
      sPos.setXYZ(vi, sx, getVietnamHeritageHeight(sx, sz) + 0.12, sz);
    }
    streamGeo.computeVertexNormals();
    const streamMat = new THREE.MeshStandardMaterial({
      color: '#2a6f75',
      roughness: 0.16,
      metalness: 0.30
    });
    this.extraMaterials.push(streamMat);
    const streamMesh = new THREE.Mesh(streamGeo, streamMat);
    streamMesh.receiveShadow = true;
    group.add(streamMesh);

    for (let rb = 0; rb < 10; rb++) {
      const side = rb % 2 === 0 ? -1 : 1;
      const rz = wheelZ - 4.8 + rb * 1.05;
      const rx = wheelX + Math.sin((rz - wheelZ) * 0.35) * 0.65 + side * (1.55 + (rb % 3) * 0.22);
      const rock = createSculptedRockGeometry(920 + rb * 13, 0.52, 0.30, 0.44, 1);
      rock.translate(rx, getVietnamHeritageHeight(rx, rz) + 0.08, rz);
      streamRockParts.push(rock);
    }
    if (streamRockParts.length > 0) {
      const srMesh = new THREE.Mesh(mergeNormalized(streamRockParts), streamRockMat);
      srMesh.receiveShadow = true;
      group.add(srMesh);
    }

    // FIX MCC-05: 18 Highland Ridge Pines (*Thông Tây Bắc*) + 6 H'Mông Terrace Farmers in indigo/red attire for human scale (ref 05 & 76!)
    const mccTrunkGeo = new THREE.CylinderGeometry(0.10, 0.18, 7.2, 5, 1, true);
    mccTrunkGeo.translate(0, 3.6, 0);
    const mccCrown1 = new THREE.ConeGeometry(1.85, 3.4, 5);
    mccCrown1.translate(0, 5.2, 0);
    const mccCrown2 = new THREE.ConeGeometry(1.35, 2.8, 5);
    mccCrown2.translate(0, 7.1, 0);
    const mccPineTrunks = new THREE.InstancedMesh(mccTrunkGeo, shared.darkWood, 18);
    const mccPineMat = new THREE.MeshStandardMaterial({ color: '#254723', roughness: 0.75 });
    this.extraMaterials.push(mccPineMat);
    const mccPineCrowns = new THREE.InstancedMesh(mergeNormalized([mccCrown1, mccCrown2]), mccPineMat, 18);
    const pineObj = new THREE.Object3D();
    for (let p = 0; p < 18; p++) {
      const px = -298 + (p % 6) * 32 + ((p * 17) % 9);
      const pz = -104 + Math.floor(p / 6) * 44 + ((p * 11) % 13);
      const py = getVietnamHeritageHeight(px, pz);
      const psc = 0.85 + (p % 4) * 0.16;
      pineObj.position.set(px, py - 0.15, pz);
      pineObj.rotation.set(0, p * 1.1, 0);
      pineObj.scale.set(psc, psc, psc);
      pineObj.updateMatrix();
      mccPineTrunks.setMatrixAt(p, pineObj.matrix);
      mccPineCrowns.setMatrixAt(p, pineObj.matrix);
    }
    mccPineTrunks.instanceMatrix.needsUpdate = true;
    mccPineCrowns.instanceMatrix.needsUpdate = true;
    group.add(mccPineTrunks, mccPineCrowns);

    const farmerParts: THREE.BufferGeometry[] = [];
    const paintFarmer = (g: THREE.BufferGeometry, hex: string) => {
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let vi = 0; vi < n; vi++) { arr[vi * 3] = c.r; arr[vi * 3 + 1] = c.g; arr[vi * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      farmerParts.push(g);
    };
    for (const [fx, fz] of [[-148, -32], [-172, -52], [-194, -22], [-216, -46], [-242, -35], [-164, -18]]) {
      const fy = getVietnamHeritageHeight(fx, fz);
      paintFarmer(new THREE.CylinderGeometry(0.14, 0.20, 1.15, 5).translate(fx, fy + 0.58, fz), '#243554');
      paintFarmer(new THREE.SphereGeometry(0.14, 5, 4).translate(fx, fy + 1.28, fz), '#c42828');
      paintFarmer(new THREE.ConeGeometry(0.32, 0.16, 7).translate(fx, fy + 1.44, fz), '#e6d39c');
    }
    const farmerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    this.extraMaterials.push(farmerMat);
    group.add(new THREE.Mesh(mergeNormalized(farmerParts), farmerMat));

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
    this.worldRuntime.registerScalableFoliage(culmMesh, idx);
    this.worldRuntime.registerScalableFoliage(leafMesh, idx);
    const bambooCount = Math.max(
      1,
      Math.round(idx * this.worldRuntime.getQualitySettings().foliageDensityScale)
    );
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
      { x: -18.5, z: 44, scale: 1.55, isFlame: false },
      { x: 18.5, z: 44, scale: 1.60, isFlame: false },
      { x: -24, z: 46, scale: 1.75, isFlame: false },
      { x: 24, z: 46, scale: 1.85, isFlame: false },
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

      if (!tc.isFlame) {
        // Realistic Ancient Banyan (*Cây Đa Cổ Thụ*): gnarled fluted buttress trunk + sinuous curved spreading boughs + curved aerial prop roots!
        const tCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(tc.x, gy - 0.35, tc.z),
          new THREE.Vector3(tc.x + (rand() - 0.5) * 0.32 * tc.scale, gy + trunkH * 0.45, tc.z + (rand() - 0.5) * 0.32 * tc.scale),
          new THREE.Vector3(tc.x + (rand() - 0.5) * 0.24 * tc.scale, gy + trunkH, tc.z + (rand() - 0.5) * 0.24 * tc.scale)
        ]);
        const fPhase = rand() * Math.PI * 2;
        trunkParts.push(
          createSmoothTaperedTubeGeometry(
            tCurve,
            6,
            8,
            (t) => (0.34 + Math.pow(1.0 - t, 2.5) * 0.48) * tc.scale,
            (t, th) => 1.0 + (1.0 - t * 0.65) * 0.24 * Math.sin((th + t * 0.7 + fPhase) * 5.0)
          )
        );
        const topOrigin = tCurve.getPoint(0.92);
        for (let b = 0; b < 4; b++) {
          const ang = (b / 4) * Math.PI * 2 + rand() * 0.42;
          const reach = (2.6 + rand() * 1.1) * tc.scale;
          const bMid = new THREE.Vector3(
            tc.x + Math.cos(ang + 0.14) * reach * 0.55,
            topOrigin.y + (0.65 + rand() * 0.45) * tc.scale,
            tc.z + Math.sin(ang + 0.14) * reach * 0.55
          );
          const bTip = new THREE.Vector3(
            tc.x + Math.cos(ang) * reach,
            topOrigin.y + (1.15 + rand() * 0.65) * tc.scale,
            tc.z + Math.sin(ang) * reach
          );
          const bCurve = new THREE.CatmullRomCurve3([topOrigin.clone(), bMid, bTip]);
          trunkParts.push(
            createSmoothTaperedTubeGeometry(bCurve, 5, 4, (t) => (0.22 * (1.0 - t * 0.72)) * tc.scale)
          );
          // Curved hanging aerial prop root curving organically down from limb to earth
          const rStart = bCurve.getPoint(0.55 + rand() * 0.25);
          const rEnd = new THREE.Vector3(
            rStart.x + (rand() - 0.5) * 0.45 * tc.scale,
            gy - 0.2,
            rStart.z + (rand() - 0.5) * 0.45 * tc.scale
          );
          const rMid = rStart.clone().lerp(rEnd, 0.5).add(
            new THREE.Vector3((rand() - 0.5) * 0.35 * tc.scale, 0, (rand() - 0.5) * 0.35 * tc.scale)
          );
          trunkParts.push(
            createSmoothTaperedTubeGeometry(
              new THREE.CatmullRomCurve3([rStart, rMid, rEnd]),
              4,
              4,
              (t) => (0.055 * (1.0 + Math.pow(t, 2.5) * 0.65)) * tc.scale
            )
          );
          leafAnchors.push({
            x: bTip.x,
            y: bTip.y + 0.45 * tc.scale,
            z: bTip.z,
            s: (2.55 + rand() * 0.85) * tc.scale,
            flame: false
          });
        }
        leafAnchors.push({
          x: tc.x,
          y: gy + trunkH + 1.85 * tc.scale,
          z: tc.z,
          s: 2.95 * tc.scale,
          flame: false
        });
      } else {
        // Royal Poinciana (*Phượng Vĩ*) spreading curved scarlet flame tree
        const trunk = new THREE.CylinderGeometry(0.28 * tc.scale, 0.50 * tc.scale, trunkH, 9);
        trunk.translate(tc.x, gy + trunkH * 0.5 - 0.15, tc.z);
        trunkParts.push(trunk);

        for (let b = 0; b < 4; b++) {
          const ang = (b / 4) * Math.PI * 2 + rand() * 0.5;
          const br = new THREE.CylinderGeometry(0.11 * tc.scale, 0.22 * tc.scale, 2.8 * tc.scale, 7);
          br.translate(0, 1.4 * tc.scale, 0);
          br.rotateZ(0.68);
          br.rotateY(ang);
          br.translate(tc.x, gy + trunkH * 0.78, tc.z);
          trunkParts.push(br);

          leafAnchors.push({
            x: tc.x + Math.cos(ang) * 1.65 * tc.scale,
            y: gy + trunkH + 1.1 * tc.scale,
            z: tc.z + Math.sin(ang) * 1.65 * tc.scale,
            s: (2.35 + rand() * 0.8) * tc.scale,
            flame: true
          });
        }
        leafAnchors.push({
          x: tc.x,
          y: gy + trunkH + 1.8 * tc.scale,
          z: tc.z,
          s: 2.6 * tc.scale,
          flame: true
        });
      }
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
    const count = 30000;
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
        gy < 3.5 &&
        (getVietnamHeritageHeight(gx + 4.5, gz) <= 0.25 ||
          getVietnamHeritageHeight(gx - 4.5, gz) <= 0.25 ||
          getVietnamHeritageHeight(gx, gz + 4.5) <= 0.25 ||
          getVietnamHeritageHeight(gx, gz - 4.5) <= 0.25)
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

    this.worldRuntime.registerScalableFoliage(grassMesh, placed);
    grassMesh.count = Math.max(
      1,
      Math.round(placed * this.worldRuntime.getQualitySettings().foliageDensityScale)
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
      // Chùa Một Cột approach censer (flanking East entrance path)
      { x: -30.5, y: 1.85, z: 24.8, scale: 0.9 },
      // Hoàng Thành Thăng Long ceremonial censer
      { x: 0.0, y: 3.1, z: -54.0, scale: 1.05 },
      // Đền Hùng Nghĩa Lĩnh temple censer
      { x: -189.0, y: 27.9, z: -206.0, scale: 1.1 },
      // Động Hương Tích cave censer
      { x: 226.0, y: 18.2, z: -201.0, scale: 1.0 },
      // Thánh địa Mỹ Sơn sanctuary censer
      { x: -344.0, y: 3.4, z: -155.0, scale: 1.0 }
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

  private updateJunkBoats(elapsedTime: number, cameraPos?: THREE.Vector3): void {
    const maxDistSq = 750 * 750;
    for (const jb of this.junkBoats) {
      if (elapsedTime > 0) {
        if (!jb.group.visible || (jb.group.parent && !jb.group.parent.visible)) {
          continue;
        }
        if (cameraPos) {
          const dx = jb.centerX - cameraPos.x;
          const dz = jb.centerZ - cameraPos.z;
          if (dx * dx + dz * dz > maxDistSq) {
            continue;
          }
        }
      }
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

    // Colors across night -> golden sunset -> sunlit noon (vibrant tropical Huế cobalt azure!)
    const darkNight = clamp01((nightAmount - 0.60) / 0.40);
    const zenithDay = new THREE.Color('#124db8');
    const zenithDusk = new THREE.Color('#134294');
    const zenithNight = new THREE.Color('#09132e');
    const topCol = zenithDay.clone().lerp(zenithDusk, duskAmount).lerp(zenithNight, darkNight);

    const horizDay = new THREE.Color('#8ac4f6');
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
    if (this.hueMoatUniforms) {
      this.hueMoatUniforms.uNightAmount.value = darkNight;
      this.hueMoatUniforms.uDuskAmount.value = duskAmount;
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
      this.worldRuntime.visibilityShadowController.setSunDirection(this.sunDirection);
      const focus =
        this.boundCamera && this.boundCamera.position.lengthSq() >= 1e-6
          ? this.boundCamera.position
          : this.getSpawnPoint().position;
      this.directionalLight.position.copy(focus).addScaledVector(sunDir, 150);
      const sunCol = new THREE.Color('#fff5e0')
        .lerp(new THREE.Color('#ffd299'), duskAmount)
        .lerp(new THREE.Color('#7fa3e8'), nightAmount);
      this.directionalLight.color.copy(sunCol);
      this.directionalLight.intensity = 3.05 * dayAmount + 0.65 * nightAmount;
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.34 * dayAmount + 0.22 * nightAmount;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = 0.56 * dayAmount + 0.30 * nightAmount;
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
    return this.worldRuntime.getQualityTier();
  }

  public setQualityTier(tier: VietnamQualityTier): void {
    this.worldRuntime.setQualityTier(tier);
  }

  public getPerfMetrics(): VietnamPerfMetrics {
    return this.worldRuntime.getPerfMetrics();
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

    const camPos =
      this.boundCamera && this.boundCamera.position.lengthSq() >= 1e-6
        ? this.boundCamera.position
        : this.getSpawnPoint().position;

    // Physical indoor palace roof occlusion: smoothly dim bright outdoor cool-sky hemi/ambient fill
    // when camera enters inside Điện Thái Hòa (Macro or Core) OR Điện Đại Thành (Văn Miếu) so warm golden museum spotlights & deep ruby lacquer dominate!
    const inMacroPalace =
      camPos.x >= -699 && camPos.x <= -663 && camPos.z >= 56 && camPos.z <= 104 && camPos.y < 14.5;
    const inCorePalace =
      camPos.x >= -252 && camPos.x <= -222 && camPos.z >= 32 && camPos.z <= 72 && camPos.y < 14.5;
    const inDaiThanhHall =
      Math.abs(camPos.x) <= 9.2 && camPos.z >= -50.2 && camPos.z <= -41.2 && camPos.y < 8.5;
    const inPalace = inMacroPalace || inCorePalace || inDaiThanhHall;
    if (this.ambientLight && this.hemiLight && this.directionalLight) {
      if (inPalace) {
        this.ambientLight.color.set('#ffdfb0');
        this.ambientLight.intensity = 0.14;
        this.hemiLight.color.set('#ffdca0');
        this.hemiLight.groundColor.set('#381408');
        this.hemiLight.intensity = 0.14;
        this.directionalLight.intensity = 0.45;
      } else if (this.ambientLight.intensity <= 0.15 && this.hemiLight.intensity <= 0.15) {
        const dayAmount = THREE.MathUtils.clamp((this.sunDirection.y + 0.08) / 0.55, 0, 1);
        const nightAmount = 1.0 - dayAmount;
        this.ambientLight.color.set('#ffe9cf');
        this.ambientLight.intensity = 0.34 * dayAmount + 0.22 * nightAmount;
        this.hemiLight.color.set('#ffe0b5');
        this.hemiLight.groundColor.set('#39522e');
        this.hemiLight.intensity = 0.56 * dayAmount + 0.30 * nightAmount;
        this.directionalLight.intensity = 3.05 * dayAmount + 0.65 * nightAmount;
      }
    }

    this.updateEgrets(elapsedTime);
    this.updateJunkBoats(elapsedTime, camPos);
    this.referenceShowController?.update(elapsedTime, this.boundCamera?.position);

    if (this.streamingMode === 'proximity' && this.zoneStreamer) {
      if (
        this.lastZoneStreamPos.distanceToSquared(camPos) >= 16.0 ||
        elapsedTime - this.lastZoneStreamTime >= 0.25
      ) {
        const streamDt =
          this.lastZoneStreamTime < 0 ? deltaTime : Math.max(0.016, elapsedTime - this.lastZoneStreamTime);
        this.lastZoneStreamPos.copy(camPos);
        this.lastZoneStreamTime = elapsedTime;
        this.zoneStreamer.update(camPos, (d) => this.makeZoneBuildContext(d), streamDt);
      }
    }
    this.worldRuntime.update(this.boundCamera, elapsedTime);

    if (
      typeof window !== 'undefined' &&
      (this.lastPerfPublishTime < 0 || elapsedTime - this.lastPerfPublishTime >= 1.0)
    ) {
      this.lastPerfPublishTime = elapsedTime;
      const rInfo = (this.boundRenderer as unknown as { info?: THREE.WebGLInfo } | null)?.info;
      const metrics = this.worldRuntime.getPerfMetrics();
      (window as unknown as { __vietnamPerfStats?: Record<string, unknown> }).__vietnamPerfStats = {
        qualityTier: metrics.qualityTier,
        lights: this.worldRuntime.lightBudgetManager.getStats(),
        visibility: this.worldRuntime.visibilityShadowController.getStats(),
        deduplicatedMaterialsSaved: metrics.deduplicatedMaterialsSaved,
        loadedZonesCount: this.zoneStreamer?.getLoadedZoneIds().length ?? 0,
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
        this.worldRuntime.animationBus.setWindSpeed(newConfig.wind.speed);
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
          this.worldRuntime.visibilityShadowController.setSunDirection(this.sunDirection);
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
    const radius = Math.max(1450, this.currentConfig?.camera?.wanderRadius ?? 1450);
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

    this.worldRuntime.dispose();

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
    this.exclusionGrid.clear();
    this.exclusionGridIndexedCount = 0;
    this.worldRuntime.clearScalableFoliage();
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
    this.lastPerfPublishTime = -1;

    this.isInitialized = false;
  }
}
