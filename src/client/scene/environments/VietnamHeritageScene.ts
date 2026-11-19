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
  JunkBoatMotion,
  ExclusionCircle,
  IncenseSmokeHandle,
  clamp01,
  mulberry32,
  noise2D,
  mergeNormalized,
  createArchedWallGeometry,
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
  createForegroundLotusFlowerParts
} from './vietnamGeometryHelpers';
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

export {
  VIETNAM_WATER_LEVEL,
  getVietnamHeritageHeight,
  getVietnamHeritageNormal,
  getGoldenBridgeCurveAtX
};

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
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

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

  constructor() {
    this.scene = new THREE.Scene();
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
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 3.8, 58],
          [0, 6.0, 22],
          [-32, 6.0, 22],
          [35, 6.0, 22],
          [0, 12.0, -40],
          [0, 26.0, -96],
          [-158, 22.0, -172],
          [-355, 52.0, -310],
          [380, 82.0, -308],
          [178, 12.0, -138],
          [-132, 12.0, 42],
          [175, 10.0, 86],
          [335, 18.0, 28],
          [-108, 12.0, 132],
          [0, 14.0, 178],
          [108, 16.0, 130],
          [-72, 10.0, 330],
          [18, 12.0, 445],
          [305, 16.0, 462],
          [680, 12.0, -175],
          [640, 8.0, 206],
          [705, 8.0, 318],
          [-646, 8.0, 80],
          [0, 10.0, -494],
          [-640, 10.0, -108],
          [820, 14.0, 42],
          [-680, 12.0, 488],
          [-840, 20.0, 198],
          [-560, 28.0, -562],
          [0, 10.0, -274],
          [740, 16.0, -432],
          [-820, 38.0, -422],
          [-240, 14.0, -618]
        ],
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
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 480;
    this.directionalLight.shadow.camera.left = -140;
    this.directionalLight.shadow.camera.right = 140;
    this.directionalLight.shadow.camera.top = 140;
    this.directionalLight.shadow.camera.bottom = -140;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.02;
    this.scene.add(this.directionalLight);

    const sunDir = new THREE.Vector3(dirPos[0], dirPos[1], dirPos[2]).normalize();
    const windArr = this.currentConfig.wind.direction;
    const windDir2D = new THREE.Vector2(windArr[0], windArr[2] ?? windArr[1] ?? 0.45).normalize();

    // 3. PBR Assets + Golden-Hour Sky & PMREM IBL
    const pbr = this.createPbrAssets(renderer);
    const materials = this.createSharedMaterials(pbr);
    this.sharedMaterials = materials;
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

    this.referenceShowController = buildVietnamReferenceShowUpgrades(builderCtx);
    for (const jb of this.junkBoats) {
      if (!this.boatBaseYaws.has(jb.group)) {
        this.boatBaseYaws.set(jb.group, jb.group.rotation.y);
      }
    }
    this.updateJunkBoats(0);

    // Enlarge plaza/waterfront exclusion halos so grass/rice stalks never clip plazas, beaches, or docks
    this.exclusionCircles.push(
      { x: -185, z: 42, r: 40.0 },
      { x: -136, z: 42, r: 18.0 },
      { x: 175, z: 45, r: 38.0 },
      { x: -108, z: 190, r: 48.0 },
      { x: 0, z: 250, r: 56.0 },
      { x: 0, z: 195, r: 26.0 },
      { x: 108, z: 190, r: 48.0 },
      { x: 108, z: 146, r: 14.0 },
      { x: -72, z: 336, r: 18.0 },
      { x: 0, z: 475, r: 24.0 },
      { x: -335, z: 515, r: 42.0 },
      { x: 335, z: 510, r: 42.0 }
    );

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

    this.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });

    this.isInitialized = true;
  }

  private createPbrAssets(renderer?: THREE.WebGLRenderer) {
    const stone = createStoneMasonryPbrTextures({ size: 512, seed: 3101, renderer, repeatX: 2, repeatY: 2 });
    const terracotta = createTerracottaRoofPbrTextures({ size: 512, seed: 4207, variant: 'terracotta', renderer });
    const darkRoof = createTerracottaRoofPbrTextures({ size: 512, seed: 5311, variant: 'teal', renderer });
    const timber = createTimberBeamPbrTextures({ size: 512, seed: 6421, renderer });
    const plaster = createPlasterWallPbrTextures({ size: 512, seed: 7537, renderer, repeatX: 2, repeatY: 2 });
    const granite = createGraniteCliffPbrTextures({ size: 512, seed: 8641, renderer, repeatX: 3, repeatY: 3 });
    const bark = createOakBarkPbrTextures({ size: 512, seed: 9743, renderer, repeatX: 4, repeatY: 6 });
    const leafAtlas = createBotanicalLeafAtlasTexture(renderer, 512);

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

    return materials;
  }

  private isInsideExclusionCircle(x: number, z: number, extraPadding = 0): boolean {
    for (const ec of this.exclusionCircles) {
      if (Math.hypot(x - ec.x, z - ec.z) < ec.r + extraPadding) {
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
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#dfd6c5',
      map: pbr.stone.map,
      normalMap: pbr.stone.normalMap,
      roughnessMap: pbr.stone.roughnessMap,
      aoMap: pbr.stone.aoMap,
      roughness: 0.72,
      metalness: 0.05
    });
    const whitePlasterMat = new THREE.MeshStandardMaterial({
      color: '#f2eadc',
      map: pbr.plaster.map,
      normalMap: pbr.plaster.normalMap,
      roughnessMap: pbr.plaster.roughnessMap,
      roughness: 0.82
    });
    const crimsonLacquerMat = new THREE.MeshStandardMaterial({
      color: '#8e1b14',
      map: pbr.timber.map,
      normalMap: pbr.timber.normalMap,
      roughnessMap: pbr.timber.roughnessMap,
      roughness: 0.42,
      metalness: 0.08
    });
    const darkRoofMat = new THREE.MeshStandardMaterial({
      color: '#5a403a',
      map: pbr.terracotta.map,
      normalMap: pbr.terracotta.normalMap,
      roughnessMap: pbr.terracotta.roughnessMap,
      roughness: 0.68,
      side: THREE.DoubleSide
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#e8b642',
      roughness: 0.26,
      metalness: 0.88
    });
    const darkVoidMat = new THREE.MeshStandardMaterial({
      color: '#1b110f',
      roughness: 0.92
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#7a5d38',
      roughness: 0.42,
      metalness: 0.72
    });
    const carvedLimestoneMat = new THREE.MeshStandardMaterial({
      color: '#eee4d0',
      roughness: 0.54,
      metalness: 0.04
    });

    this.extraMaterials.push(
      stoneMat,
      whitePlasterMat,
      crimsonLacquerMat,
      darkRoofMat,
      goldMat,
      darkVoidMat,
      bronzeMat,
      carvedLimestoneMat
    );

    // 1. Trống Đồng Đông Sơn Plaza Medallion (r = 6.5m) flat on central promenade at (0, 16)
    const dongSon = createDongSonBronzeTextures(512, renderer);
    this.extraTextures.push(dongSon.map, dongSon.normalMap, dongSon.roughnessMap);
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

    const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), stoneMat);
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    group.add(stoneMesh);

    const limestoneMesh = new THREE.Mesh(mergeNormalized(limestoneParts), carvedLimestoneMat);
    limestoneMesh.castShadow = true;
    limestoneMesh.receiveShadow = true;
    group.add(limestoneMesh);

    const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), bronzeMat);
    bronzeMesh.castShadow = true;
    group.add(bronzeMesh);

    const fgWaterMesh = new THREE.Mesh(mergeNormalized(fgWaterParts), basinWaterMat);
    fgWaterMesh.receiveShadow = true;
    group.add(fgWaterMesh);

    const fgPadMesh = new THREE.Mesh(mergeNormalized(fgPadParts), fgPadMat);
    group.add(fgPadMesh);

    const fgStemMesh = new THREE.Mesh(mergeNormalized(fgStemParts), fgStemMat);
    group.add(fgStemMesh);

    const fgLotusMesh = new THREE.Mesh(mergeNormalized(fgLotusParts), fgLotusMat);
    group.add(fgLotusMesh);

    const fgLotusCoreMesh = new THREE.Mesh(mergeNormalized(fgLotusCoreParts), fgLotusCoreMat);
    group.add(fgLotusCoreMesh);

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

      const base = new THREE.BoxGeometry(1.20, 0.28, 1.20);
      base.translate(ox, plinthTop + 0.14, oz);
      plasterParts.push(base);

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

    const plasterMesh = new THREE.Mesh(mergeNormalized(plasterParts), whitePlasterMat);
    plasterMesh.castShadow = true;
    plasterMesh.receiveShadow = true;
    group.add(plasterMesh);

    // 4. Lower 4 Curved Eaves (4 lower roofs of *lầu vuông 8 mái*)
    const roof1Y = plinthTop + 3.50;
    const roof1Geo = createVietnameseCurvedRoofGeometry(8.8, 8.8, 5.4, 5.4, 1.15, 0.42);
    roof1Geo.translate(0, roof1Y, 0);

    // 5. Upper Tier (Gác Khuê Văn — Crimson Lacquered Pavilion + 4 Circular Sunburst Windows 1.8m dia!)
    const upperFloorY = plinthTop + 3.55;
    const crimsonParts: THREE.BufferGeometry[] = [];
    const voidParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];

    // Upper floor wooden deck (sits above the open ceiling beams) & balcony railing
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

    // Balcony handrails on all 4 sides
    for (const side of [-1, 1]) {
      const railZ = new THREE.BoxGeometry(5.6, 0.12, 0.14);
      railZ.translate(0, upperFloorY + 0.86, side * 2.78);
      crimsonParts.push(railZ);

      const railX = new THREE.BoxGeometry(0.14, 0.12, 5.6);
      railX.translate(side * 2.78, upperFloorY + 0.86, 0);
      crimsonParts.push(railX);
    }

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
    // Coffered tie-beams, crimson-and-gold ceremonial altar table, gilded Hoành Phi plaque & bronze bell/lamp
    const altarBase = new THREE.BoxGeometry(1.45, 0.88, 0.82);
    altarBase.translate(0, upperFloorY + 0.66, 0);
    crimsonParts.push(altarBase);
    const altarTrim = new THREE.BoxGeometry(1.52, 0.08, 0.88);
    altarTrim.translate(0, upperFloorY + 1.12, 0);
    goldParts.push(altarTrim);

    // Interior coffered crimson ceiling cross-beams & gilded Hoành Phi ("Khuê Văn Các") plaque
    for (const off of [-1.05, 0, 1.05]) {
      const bX = new THREE.BoxGeometry(3.8, 0.14, 0.14);
      bX.translate(0, upperFloorY + 2.50, off);
      const bZ = new THREE.BoxGeometry(0.14, 0.14, 3.8);
      bZ.translate(off, upperFloorY + 2.50, 0);
      crimsonParts.push(bX, bZ);
    }
    const hoanhPhi = new THREE.BoxGeometry(1.65, 0.48, 0.08);
    hoanhPhi.translate(0, upperFloorY + 2.28, 1.38);
    goldParts.push(hoanhPhi);

    // Suspended interior bronze bell & warm glowing altar lamp
    const bellTop = new THREE.CylinderGeometry(0.12, 0.24, 0.48, 12);
    bellTop.translate(0, upperFloorY + 1.92, 0);
    goldParts.push(bellTop);
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

    // Exterior Courtyard — Hai Nhà Bia Tiến Sĩ & 16 Rùa Đá Đội Bia (x = ±21.5, z = -12)
    const stelaeRoofParts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const sx = side * 21.5;
      const sz = -12.0;
      const sy = getVietnamHeritageHeight(sx, sz);
      this.exclusionCircles.push({ x: sx, z: sz, r: 9.0 });

      // Grounded stone platform plinth (-0.5m skirt)
      const stPlinth = new THREE.BoxGeometry(5.2, 0.85, 13.6);
      stPlinth.translate(sx, sy - 0.12, sz);
      stoneParts.push(stPlinth);
      const stCurb = new THREE.BoxGeometry(5.5, 0.16, 13.9);
      stCurb.translate(sx, sy + 0.34, sz);
      limestoneParts.push(stCurb);

      // 8 Crimson lacquered pavilion columns (2 × 4)
      for (const ox of [-1.95, 1.95]) {
        for (let rz = 0; rz < 4; rz++) {
          const czCol = sz - 5.2 + rz * 3.45;
          const col = new THREE.CylinderGeometry(0.14, 0.16, 3.3, 10);
          col.translate(sx + ox, sy + 2.0, czCol);
          crimsonParts.push(col);
          const colBase = new THREE.CylinderGeometry(0.22, 0.28, 0.24, 10);
          colBase.translate(sx + ox, sy + 0.48, czCol);
          limestoneParts.push(colBase);
        }
      }

      // Traditional curved tiled roof over Nhà Bia
      const biaRoof = createVietnameseCurvedRoofGeometry(6.4, 15.2, 1.8, 10.6, 1.9, 0.40);
      biaRoof.translate(sx, sy + 3.60, sz);
      stelaeRoofParts.push(biaRoof);

      // 8 Stone Turtles (*Rùa đá*) carrying 8 upright carved Doctors' Stelae (*Bia Tiến Sĩ*)
      for (let t = 0; t < 8; t++) {
        const colIdx = t % 2;
        const rowIdx = Math.floor(t / 2);
        const tx = sx + (colIdx === 0 ? -0.95 : 0.95);
        const tz = sz - 4.2 + rowIdx * 2.8;
        const tBaseY = sy + 0.42;

        // Turtle pedestal & domed carapace
        const turtleBody = new THREE.SphereGeometry(0.46, 10, 8);
        turtleBody.scale(0.85, 0.52, 1.25);
        turtleBody.translate(tx, tBaseY + 0.20, tz);
        stoneParts.push(turtleBody);
        const turtleHead = new THREE.SphereGeometry(0.16, 8, 6);
        turtleHead.scale(0.8, 0.75, 1.2);
        turtleHead.translate(tx, tBaseY + 0.26, tz + 0.62);
        stoneParts.push(turtleHead);

        // Upright stone stele slab + curved Trán Bia top
        const steleSlab = new THREE.BoxGeometry(0.68, 1.22, 0.18);
        steleSlab.translate(tx, tBaseY + 0.98, tz);
        limestoneParts.push(steleSlab);
        const steleCap = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 12, 1, false, 0, Math.PI);
        steleCap.rotateX(Math.PI * 0.5);
        steleCap.rotateY(Math.PI * 0.5);
        steleCap.translate(tx, tBaseY + 1.59, tz);
        limestoneParts.push(steleCap);
      }
    }
    const windowFaces = [
      { x: 0, z: 2.18, ry: 0 },
      { x: 0, z: -2.18, ry: Math.PI },
      { x: 2.18, z: 0, ry: Math.PI * 0.5 },
      { x: -2.18, z: 0, ry: -Math.PI * 0.5 }
    ];

    for (const wf of windowFaces) {
      const outX = Math.sin(wf.ry) * 0.055;
      const outZ = Math.cos(wf.ry) * 0.055;

      // Outer gilded ring frame (1.8m diameter -> radius 0.90m)
      const outerRing = new THREE.TorusGeometry(0.90, 0.085, 12, 32);
      outerRing.rotateY(wf.ry);
      outerRing.translate(wf.x + outX, winCenterY, wf.z + outZ);
      goldParts.push(outerRing);

      const innerRing = new THREE.TorusGeometry(0.30, 0.06, 10, 24);
      innerRing.rotateY(wf.ry);
      innerRing.translate(wf.x + outX, winCenterY, wf.z + outZ);
      goldParts.push(innerRing);

      // 8 radial sunburst spokes (*tia sáng mặt trời*)
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

    // Upper 4 Curved Hipped Roofs (4 upper roofs of *lầu vuông 8 mái*) + Ridge & Gilded Lotus Finial (~9.5m total)
    const roof2Y = upperFloorY + 2.65;
    const roof2Geo = createVietnameseCurvedRoofGeometry(7.6, 7.6, 1.2, 1.2, 1.75, 0.48);
    roof2Geo.translate(0, roof2Y, 0);

    const ridgeGeo = new THREE.BoxGeometry(1.5, 0.20, 0.26);
    ridgeGeo.translate(0, roof2Y + 1.78, 0);
    const roofMerged = mergeNormalized([roof1Geo, roof2Geo, ridgeGeo, ...stelaeRoofParts]);
    const roofMesh = new THREE.Mesh(roofMerged, darkRoofMat);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    group.add(roofMesh);

    const finialBase = new THREE.CylinderGeometry(0.13, 0.24, 0.34, 16);
    finialBase.translate(0, roof2Y + 1.98, 0);
    const finialOrb = new THREE.SphereGeometry(0.18, 16, 12);
    finialOrb.translate(0, roof2Y + 2.24, 0);
    const finialSpire = new THREE.ConeGeometry(0.10, 0.36, 12);
    finialSpire.translate(0, roof2Y + 2.50, 0);
    goldParts.push(finialBase, finialOrb, finialSpire, ...truBieuGold, ...tripodGold);

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
    const { material: plazaBannerMat, uniforms: plazaBannerU } = createWavingSilkFlagMaterial({
      waveScale: 0.72,
      color: '#d41b1e',
      showStar: true
    });
    this.extraMaterials.push(plazaBannerMat);
    this.extraAnimatedUniforms.push(plazaBannerU);

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

    const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), crimsonLacquerMat);
    crimsonMesh.castShadow = true;
    crimsonMesh.receiveShadow = true;
    group.add(crimsonMesh);

    const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), darkVoidMat);
    group.add(voidMesh);

    const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMat);
    goldMesh.castShadow = true;
    group.add(goldMesh);

    const lanternSilkMesh = new THREE.Mesh(
      mergeNormalized(lanternSilkParts),
      this.lanternSilkMaterial!
    );
    lanternSilkMesh.name = 'VietnameseSilkLanterns';
    group.add(lanternSilkMesh);

    const lanternCoreMesh = new THREE.Mesh(
      mergeNormalized(lanternCoreParts),
      this.lanternCoreMaterial!
    );
    lanternCoreMesh.name = 'VietnameseLanternCores';
    group.add(lanternCoreMesh);

    const { material: plazaPoolMat, uniforms: plazaPoolU } = createWarmLightPoolMaterial();
    this.extraMaterials.push(plazaPoolMat);
    this.extraAnimatedUniforms.push(plazaPoolU);
    const lanternPoolMesh = new THREE.Mesh(mergeNormalized(lanternPoolParts), plazaPoolMat);
    lanternPoolMesh.name = 'KhueVanLanternLightPools';
    group.add(lanternPoolMesh);

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
   * granite-rimmed Hồ Linh Chiểu Lotus Basin, 4.0m × 1.2m single stone pillar, stepped brick-and-stone
   * East bridge (x = -41..-31), Lưỡng long chầu nguyệt finial, and 320+ lotus pads & pink flowers.
   */
  private buildOnePillarPagodaAndLotusPond(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'OnePillarPagodaComplex';

    const cx = -48.0;
    const cz = 22.0;
    this.exclusionCircles.push({ x: cx, z: cz, r: 22.0 });

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
    const terracottaMat = new THREE.MeshStandardMaterial({
      color: '#9b3d2c',
      map: pbr.terracotta.map,
      normalMap: pbr.terracotta.normalMap,
      roughnessMap: pbr.terracotta.roughnessMap,
      roughness: 0.65,
      side: THREE.DoubleSide
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#e6b848',
      roughness: 0.28,
      metalness: 0.85
    });
    this.extraMaterials.push(stoneMat, brickMat, crimsonTimberMat, terracottaMat, goldMat);

    const stoneParts: THREE.BufferGeometry[] = [];
    const brickParts: THREE.BufferGeometry[] = [];

    // 1. Formal Square 34m × 34m Granite-Rimmed Hồ Linh Chiểu Lotus Basin
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

    // East coping wall split cleanly for bridge entry (z = cz ± 1.65)
    const eastSegLen = halfBasin - 1.65 + rimW * 0.5;
    for (const sideZ of [-1, 1]) {
      const eastSeg = new THREE.BoxGeometry(rimW, rimH, eastSegLen);
      eastSeg.translate(cx + halfBasin, rimY, cz + sideZ * (1.65 + eastSegLen * 0.5));
      stoneParts.push(eastSeg);
    }

    // Basin perimeter stone balustrade posts
    for (let k = -4; k <= 4; k++) {
      const off = (k / 4) * halfBasin;
      for (const sideZ of [-1, 1]) {
        const p = new THREE.BoxGeometry(0.45, 0.58, 0.45);
        p.translate(cx + off, 0.84, cz + sideZ * halfBasin);
        stoneParts.push(p);
      }
      if (k !== 0) {
        for (const sideX of [-1, 1]) {
          const p = new THREE.BoxGeometry(0.45, 0.58, 0.45);
          p.translate(cx + sideX * halfBasin, 0.84, cz + off);
          stoneParts.push(p);
        }
      } else {
        const pw = new THREE.BoxGeometry(0.45, 0.58, 0.45);
        pw.translate(cx - halfBasin, 0.84, cz);
        stoneParts.push(pw);
      }
    }

    // 2. Real 4.0m tall × 1.2m diameter Single Cylindrical Stone Pillar
    const pillarBase = new THREE.CylinderGeometry(1.10, 1.35, 1.45, 24);
    pillarBase.translate(cx, -0.68, cz);
    stoneParts.push(pillarBase);

    const singlePillar = new THREE.CylinderGeometry(0.60, 0.60, 4.0, 28);
    singlePillar.translate(cx, 2.0, cz);
    stoneParts.push(singlePillar);

    const pillarCap = new THREE.CylinderGeometry(0.84, 0.62, 0.28, 24);
    pillarCap.translate(cx, 3.92, cz);
    stoneParts.push(pillarCap);

    // 3. Stepped Brick-and-Stone Approach Bridge on East side (x = -41..-31) + Staircase to Deck (-45.7..-41)
    // Grounded East bank landing abutment at x = -31..-29.5
    const eastAbut = new THREE.BoxGeometry(2.2, 2.3, 3.1);
    eastAbut.translate(-30.5, -0.15, cz);
    stoneParts.push(eastAbut);
    for (let s = 0; s < 3; s++) {
      const st = new THREE.BoxGeometry(0.50, 0.24, 2.8);
      st.translate(-29.5 - s * 0.45, 0.58 + s * 0.14, cz);
      stoneParts.push(st);
    }

    // Gentle arched bridge span across East pond (x = -31 to -41)
    const bridgeSegs = 14;
    const bridgeY = (t: number) => 0.88 + 0.62 * Math.sin(t * Math.PI) + t * 0.92;
    for (let i = 0; i < bridgeSegs; i++) {
      const t0 = i / bridgeSegs;
      const t1 = (i + 1) / bridgeSegs;
      const x0 = THREE.MathUtils.lerp(-31.0, -41.0, t0);
      const x1 = THREE.MathUtils.lerp(-31.0, -41.0, t1);
      const xm = (x0 + x1) * 0.5;
      const y0 = bridgeY(t0);
      const y1 = bridgeY(t1);
      const ym = (y0 + y1) * 0.5;
      const segLen = Math.hypot(x1 - x0, y1 - y0) + 0.08;
      const pitch = Math.atan2(y1 - y0, x1 - x0);

      const deckSeg = new THREE.BoxGeometry(segLen, 0.28, 2.5);
      deckSeg.rotateZ(pitch);
      deckSeg.translate(xm, ym, cz);
      stoneParts.push(deckSeg);

      for (const side of [-1, 1]) {
        const brickWall = new THREE.BoxGeometry(segLen, 0.55, 0.24);
        brickWall.rotateZ(pitch);
        brickWall.translate(xm, ym + 0.34, cz + side * 1.15);
        brickParts.push(brickWall);
      }
    }

    // Bridge support piers grounded from lakebed (-1.4m) up to arch underside
    for (const bx of [-34.2, -37.8]) {
      const tPier = (-31.0 - bx) / 10.0;
      const topY = bridgeY(tPier) - 0.02;
      const pierH = topY + 1.4;
      const pier = new THREE.CylinderGeometry(0.32, 0.42, pierH, 12);
      pier.translate(bx, -1.4 + pierH * 0.5, cz);
      stoneParts.push(pier);

      const cap = new THREE.BoxGeometry(0.9, 0.22, 2.55);
      cap.translate(bx, topY - 0.08, cz);
      stoneParts.push(cap);
    }

    // Stepped brick-and-stone staircase climbing from x = -41.0 (y = 1.80) to shrine deck x = -45.75 (y = 4.15)
    const stairCount = 10;
    for (let s = 0; s < stairCount; s++) {
      const t = s / (stairCount - 1);
      const sx = THREE.MathUtils.lerp(-41.0, -45.65, t);
      const sy = THREE.MathUtils.lerp(1.80, 4.10, t);
      const tread = new THREE.BoxGeometry(0.55, 0.26, 2.2);
      tread.translate(sx, sy, cz);
      stoneParts.push(tread);

      const riserSupport = new THREE.BoxGeometry(0.55, sy + 1.4, 2.45);
      riserSupport.translate(sx, (sy - 1.4) * 0.5, cz);
      brickParts.push(riserSupport);

      for (const side of [-1, 1]) {
        const cheek = new THREE.BoxGeometry(0.58, 0.65, 0.24);
        cheek.translate(sx, sy + 0.38, cz + side * 1.15);
        brickParts.push(cheek);
      }
    }

    const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), stoneMat);
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    group.add(stoneMesh);

    const brickMesh = new THREE.Mesh(mergeNormalized(brickParts), brickMat);
    brickMesh.castShadow = true;
    brickMesh.receiveShadow = true;
    group.add(brickMesh);

    // 4. Radial Carved Wooden Petal Brackets (*Bệ sen*) + 3.0m × 3.0m Crimson Shrine Chamber
    const timberParts: THREE.BufferGeometry[] = [];
    for (let b = 0; b < 12; b++) {
      const ang = (b / 12) * Math.PI * 2;
      const strut = new THREE.BoxGeometry(0.20, 0.24, 2.25);
      strut.rotateX(-0.50);
      strut.rotateY(ang);
      strut.translate(cx + Math.sin(ang) * 0.95, 3.55, cz + Math.cos(ang) * 0.95);
      timberParts.push(strut);
    }

    const deck = new THREE.BoxGeometry(4.5, 0.24, 4.5);
    deck.translate(cx, 4.15, cz);
    timberParts.push(deck);

    // Balcony railings (N, S, W sides; East open for stair arrival)
    for (const side of [-1, 1]) {
      const railZ = new THREE.BoxGeometry(4.4, 0.12, 0.12);
      railZ.translate(cx, 4.88, cz + side * 2.16);
      timberParts.push(railZ);
    }
    const westRail = new THREE.BoxGeometry(0.12, 0.12, 4.4);
    westRail.translate(cx - 2.16, 4.88, cz);
    timberParts.push(westRail);

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

    const timberMesh = new THREE.Mesh(mergeNormalized(timberParts), crimsonTimberMat);
    timberMesh.castShadow = true;
    timberMesh.receiveShadow = true;
    group.add(timberMesh);

    // 5. Curved 4-Corner Upturned Terracotta Roof + *Lưỡng long chầu nguyệt* Crescent Twin-Dragon Finial
    const roofGeo = createVietnameseCurvedRoofGeometry(6.4, 6.4, 1.15, 1.15, 1.75, 0.45);
    roofGeo.translate(cx, 6.50, cz);
    const roofMesh = new THREE.Mesh(roofGeo, terracottaMat);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    group.add(roofMesh);

    const goldParts: THREE.BufferGeometry[] = [];
    // Interior Sanctum: Gilded Quan Âm Bồ Tát statue on lotus dais, aureole halo, câu đối banners & miniature incense urn
    const lotusDais = new THREE.CylinderGeometry(0.38, 0.28, 0.24, 14);
    lotusDais.translate(cx - 0.88, 5.08, cz);
    const statueTorso = new THREE.CylinderGeometry(0.14, 0.24, 0.56, 12);
    statueTorso.translate(cx - 0.88, 5.48, cz);
    const statueHead = new THREE.SphereGeometry(0.12, 10, 8);
    statueHead.translate(cx - 0.88, 5.86, cz);
    const statueHalo = new THREE.TorusGeometry(0.32, 0.03, 8, 24);
    statueHalo.rotateY(Math.PI * 0.5);
    statueHalo.translate(cx - 0.98, 5.64, cz);
    goldParts.push(lotusDais, statueTorso, statueHead, statueHalo);
    // Multi-armed halo arms of Quan Âm
    for (const s of [-1, 1]) {
      for (let a = 0; a < 3; a++) {
        const arm = new THREE.CylinderGeometry(0.025, 0.03, 0.34, 6);
        arm.rotateX(s * (0.55 + a * 0.42));
        arm.translate(cx - 0.84, 5.52 + a * 0.12, cz + s * 0.24);
        goldParts.push(arm);
      }
      // Vertical golden *câu đối* banners flanking the shrine doorway
      const cauDoi = new THREE.BoxGeometry(0.06, 1.45, 0.16);
      cauDoi.translate(cx + 1.48, 5.45, cz + s * 1.15);
      goldParts.push(cauDoi);
    }
    const miniUrn = new THREE.CylinderGeometry(0.10, 0.08, 0.16, 10);
    miniUrn.translate(cx - 0.48, 5.06, cz);
    goldParts.push(miniUrn);

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

    const ridgeBeam = new THREE.BoxGeometry(0.20, 0.18, 1.35);
    ridgeBeam.translate(cx, 8.28, cz);
    goldParts.push(ridgeBeam);

    // Central golden solar/lunar pearl & crescent ring (*Mặt nguyệt*)
    const moonOrb = new THREE.SphereGeometry(0.16, 12, 10);
    moonOrb.translate(cx, 8.62, cz);
    goldParts.push(moonOrb);

    const crescent = new THREE.TorusGeometry(0.25, 0.04, 8, 20, Math.PI * 1.15);
    crescent.rotateY(Math.PI * 0.5);
    crescent.rotateX(Math.PI * 0.92);
    crescent.translate(cx, 8.58, cz);
    goldParts.push(crescent);

    // Flanking twin golden dragons (*Lưỡng long chầu nguyệt*) along ridge
    for (const side of [-1, 1]) {
      const dragonCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx, 8.38, cz + side * 0.72),
        new THREE.Vector3(cx, 8.56, cz + side * 0.52),
        new THREE.Vector3(cx, 8.46, cz + side * 0.34),
        new THREE.Vector3(cx, 8.64, cz + side * 0.22)
      ]);
      const body = new THREE.TubeGeometry(dragonCurve, 12, 0.055, 8, false);
      goldParts.push(body);

      const crest = new THREE.ConeGeometry(0.06, 0.18, 6);
      crest.rotateX(side * -0.45);
      crest.translate(cx, 8.74, cz + side * 0.24);
      goldParts.push(crest);
    }

    const finialMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMat);
    finialMesh.castShadow = true;
    group.add(finialMesh);

    // 6. Đầm Sen (320+ Instanced Lotus Leaves & Blooming Pink Lotus Flowers inside 34m × 34m basin)
    const leafCount = 360;
    const leafGeo = new THREE.CircleGeometry(0.48, 16, 0.15, Math.PI * 1.85);
    leafGeo.rotateX(-Math.PI / 2);
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
      const petal = new THREE.SphereGeometry(0.13, 8, 6);
      petal.scale(0.55, 1.45, 0.25);
      petal.rotateX(0.45);
      petal.translate(0, 0.14, 0.10);
      petal.rotateY(a);
      petalParts.push(petal);
    }
    const centerBud = new THREE.CylinderGeometry(0.07, 0.05, 0.11, 10);
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
    const dummy = new THREE.Matrix4();
    const col = new THREE.Color();

    const isInsideBasinWater = (px: number, pz: number): boolean => {
      if (Math.hypot(px - cx, pz - cz) < 1.8) return false; // keep clear of pillar
      if (px > cx - 0.5 && px < cx + 17.0 && Math.abs(pz - cz) < 1.95) return false; // keep clear of bridge
      return getVietnamHeritageHeight(px, pz) < -0.25;
    };

    let placedLeaves = 0;
    for (let i = 0; i < leafCount * 3 && placedLeaves < leafCount; i++) {
      const lx = cx + (rand() - 0.5) * 31.6;
      const lz = cz + (rand() - 0.5) * 31.6;
      if (!isInsideBasinWater(lx, lz)) continue;
      const sc = 0.78 + rand() * 0.72;
      dummy.compose(
        new THREE.Vector3(lx, VIETNAM_WATER_LEVEL + 0.025 + rand() * 0.02, lz),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06)
        ),
        new THREE.Vector3(sc, 1, sc)
      );
      lotusLeaves.setMatrixAt(placedLeaves, dummy);
      col.setHSL(0.32 + (rand() - 0.5) * 0.05, 0.52, 0.26 + rand() * 0.12);
      lotusLeaves.setColorAt(placedLeaves, col);
      placedLeaves++;
    }
    lotusLeaves.count = placedLeaves;
    lotusLeaves.instanceMatrix.needsUpdate = true;
    if (lotusLeaves.instanceColor) lotusLeaves.instanceColor.needsUpdate = true;
    group.add(lotusLeaves);

    let placedFlowers = 0;
    for (let i = 0; i < flowerCount * 3 && placedFlowers < flowerCount; i++) {
      const fx = cx + (rand() - 0.5) * 30.8;
      const fz = cz + (rand() - 0.5) * 30.8;
      if (!isInsideBasinWater(fx, fz)) continue;
      const sc = 0.88 + rand() * 0.58;
      dummy.compose(
        new THREE.Vector3(fx, VIETNAM_WATER_LEVEL + 0.05 + rand() * 0.10, fz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
        new THREE.Vector3(sc, sc, sc)
      );
      lotusFlowers.setMatrixAt(placedFlowers, dummy);
      col.set(rand() > 0.25 ? '#f598ba' : '#fdeaf0');
      lotusFlowers.setColorAt(placedFlowers, col);
      placedFlowers++;
    }
    lotusFlowers.count = placedFlowers;
    lotusFlowers.instanceMatrix.needsUpdate = true;
    if (lotusFlowers.instanceColor) lotusFlowers.instanceColor.needsUpdate = true;
    group.add(lotusFlowers);

    this.scene.add(group);
  }

  /**
   * Builds Tháp Rùa (Turtle Tower) at (52, 22) on Gò Rùa islet in Hoàn Kiếm Lake:
   * true 1:1 8.8m total height (6.28m × 4.54m tier 1, 4.8m × 3.64m tier 2, 2.97m × 1.9m tier 3
   * with eastern oval medallion, 2.0m × 2.0m curved gazebo roof top) in weathered mossy stucco #9e9278.
   */
  private buildTurtleTowerIslet(pbr: ReturnType<typeof this.createPbrAssets>): void {
    const group = new THREE.Group();
    group.name = 'TurtleTowerIslet';

    const cx = 52.0;
    const cz = 22.0;
    const isletY = getVietnamHeritageHeight(cx, cz); // ~0.95m
    this.exclusionCircles.push({ x: cx, z: cz, r: 12.0 });

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
    const darkVoidMat = new THREE.MeshStandardMaterial({
      color: '#181410',
      roughness: 0.95
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#e8b642',
      roughness: 0.30,
      metalness: 0.85
    });
    this.extraMaterials.push(mossyStuccoMat, trimMat, rockMat, darkVoidMat, goldMat);

    // 1. Sculpted mossy shoreline rock ring around Gò Rùa islet (r = 7.4..10.2m)
    const rockParts: THREE.BufferGeometry[] = [];
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
    const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), rockMat);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    group.add(rockMesh);

    // 2. 3-Tiered Historic Tháp Rùa Tower (8.80m total height above isletY)
    const stuccoParts: THREE.BufferGeometry[] = [];
    const trimParts: THREE.BufferGeometry[] = [];

    const plinth = new THREE.BoxGeometry(6.68, 0.85, 4.94);
    plinth.translate(cx, isletY - 0.125, cz); // bottom at isletY - 0.55, top at isletY + 0.30
    trimParts.push(plinth);

    const buildTierFacade = (
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
          const wall = createArchedWallGeometry(bayW + 0.02, h, 0.34, bayW * 0.58, h * 0.72);
          wall.translate(cx + bx, yBase, cz + side * (d * 0.5 - 0.17));
          stuccoParts.push(wall);
        }
        for (let b = 0; b < shortBays; b++) {
          const bz = -d * 0.5 + bayD * (b + 0.5);
          const wall = createArchedWallGeometry(bayD + 0.02, h, 0.34, bayD * 0.56, h * 0.72);
          wall.rotateY(Math.PI * 0.5);
          wall.translate(cx + side * (w * 0.5 - 0.17), yBase, cz + bz);
          stuccoParts.push(wall);
        }
      }
      const inner = new THREE.BoxGeometry(w - 0.70, h - 0.10, d - 0.70);
      inner.translate(cx, yBase + h * 0.5, cz);
      const cornice = new THREE.BoxGeometry(w + 0.34, corniceH, d + 0.34);
      cornice.translate(cx, yBase + h + corniceH * 0.5, cz);
      trimParts.push(cornice);
      return inner;
    };

    const t1Y = isletY + 0.30;
    const inner1 = buildTierFacade(t1Y, 6.28, 4.54, 3.10, 0.20, 3, 2);

    const t2Y = t1Y + 3.30;
    const inner2 = buildTierFacade(t2Y, 4.80, 3.64, 2.35, 0.18, 3, 2);

    const t3Y = t2Y + 2.53;
    const inner3 = buildTierFacade(t3Y, 2.97, 1.90, 1.62, 0.22, 3, 2);

    // Eastern & Western Oval Medallions on Tier 3 (signature Tháp Rùa circular/oval relief)
    const voidParts: THREE.BufferGeometry[] = [inner1, inner2, inner3];
    for (const side of [-1, 1]) {
      const ovalFrame = new THREE.TorusGeometry(0.32, 0.055, 8, 24);
      ovalFrame.scale(0.75, 1.15, 1.0);
      ovalFrame.rotateY(Math.PI * 0.5);
      ovalFrame.translate(cx + side * 1.50, t3Y + 0.85, cz);
      trimParts.push(ovalFrame);

      const ovalRecess = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20);
      ovalRecess.rotateZ(Math.PI * 0.5);
      ovalRecess.scale(1.0, 1.15, 0.75);
      ovalRecess.translate(cx + side * 1.48, t3Y + 0.85, cz);
      voidParts.push(ovalRecess);
    }

    // Top crenellated parapet + 2.0m × 2.0m curved gazebo roof top + five-pointed star finial (8.80m total)
    const topDeckY = t3Y + 1.84;
    for (let c = -3; c <= 3; c++) {
      for (const side of [-1, 1]) {
        const merlon = new THREE.BoxGeometry(0.22, 0.26, 0.16);
        merlon.translate(cx + c * 0.42, topDeckY + 0.13, cz + side * 0.90);
        stuccoParts.push(merlon);
      }
    }

    const gazeboBase = new THREE.BoxGeometry(2.0, 0.22, 2.0);
    gazeboBase.translate(cx, topDeckY + 0.11, cz);
    trimParts.push(gazeboBase);

    const gazeboRoof = createVietnameseCurvedRoofGeometry(2.25, 2.25, 0.45, 0.45, 0.60, 0.16);
    gazeboRoof.translate(cx, topDeckY + 0.18, cz);
    trimParts.push(gazeboRoof);

    const spirePost = new THREE.CylinderGeometry(0.04, 0.07, 0.22, 8);
    spirePost.translate(cx, topDeckY + 0.82, cz);
    const starDisc = new THREE.OctahedronGeometry(0.14, 0);
    starDisc.scale(1, 1, 0.35);
    starDisc.translate(cx, topDeckY + 0.96, cz);

    const stuccoMesh = new THREE.Mesh(mergeNormalized(stuccoParts), mossyStuccoMat);
    stuccoMesh.castShadow = true;
    stuccoMesh.receiveShadow = true;
    group.add(stuccoMesh);

    const trimMesh = new THREE.Mesh(mergeNormalized(trimParts), trimMat);
    trimMesh.castShadow = true;
    trimMesh.receiveShadow = true;
    group.add(trimMesh);

    const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), darkVoidMat);
    group.add(voidMesh);

    const goldMesh = new THREE.Mesh(mergeNormalized([spirePost, starDisc]), goldMat);
    group.add(goldMesh);

    this.scene.add(group);
  }

  /**
   * Builds Cầu Vàng (Golden Bridge — Bà Nà Hills) at true 1:1 scale: 150m curved span (x ∈ [-75, +75]),
   * 4.8m wide deck at y ~ 22.8..24.6m, cradled by TWO monumental 26m-tall sculpted mossy stone
   * Giant Hands rising from (±32, -143) cliffs and grounded granite cliff abutments at (±78, -145).
   */
  private buildGoldenBridgeAndGiantHands(
    pbr: ReturnType<typeof this.createPbrAssets>,
    renderer?: THREE.WebGLRenderer
  ): void {
    const group = new THREE.Group();
    group.name = 'GoldenBridgeComplex';

    this.exclusionCircles.push(
      { x: -78, z: -145, r: 16.0 },
      { x: 78, z: -145, r: 16.0 },
      { x: -32, z: -143, r: 14.0 },
      { x: 32, z: -143, r: 14.0 }
    );

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
    const glassRailMat = new THREE.MeshStandardMaterial({
      color: '#d8f0f6',
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.25,
      side: THREE.DoubleSide
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

    this.extraMaterials.push(goldMetalMat, teakDeckMat, glassRailMat, stoneHandMat);

    // 1. Curved 150m Golden Bridge Deck (4.8m wide), Side Gold Girders, Railings & Tempered Glass Panels
    const deckParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const glassParts: THREE.BufferGeometry[] = [];

    const segs = 48;
    const deckHalfW = 2.4;
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

      // Teak timber walkway deck (4.65m clear inside rails)
      const deckSeg = new THREE.BoxGeometry(segLen, 0.24, deckHalfW * 2 - 0.16);
      deckParts.push(orient(deckSeg));

      // Gleaming gold undercarriage box & structural ribs
      const underBeam = new THREE.BoxGeometry(segLen, 0.58, deckHalfW * 1.65);
      underBeam.translate(0, -0.38, 0);
      goldParts.push(orient(underBeam));

      for (const side of [-1, 1]) {
        const fascia = new THREE.BoxGeometry(segLen, 0.80, 0.36);
        fascia.translate(0, -0.16, side * deckHalfW);
        goldParts.push(orient(fascia));

        const topRail = new THREE.BoxGeometry(segLen, 0.10, 0.12);
        topRail.translate(0, 1.22, side * (deckHalfW - 0.05));
        goldParts.push(orient(topRail));

        const post = new THREE.BoxGeometry(0.10, 1.18, 0.10);
        post.translate(segLen * 0.45, 0.64, side * (deckHalfW - 0.05));
        goldParts.push(orient(post));

        const glass = new THREE.BoxGeometry(segLen * 0.94, 0.98, 0.04);
        glass.translate(0, 0.66, side * (deckHalfW - 0.05));
        glassParts.push(orient(glass));
      }
    }

    // Grounded granite cliff abutments & piers at (±78, -145)
    const abutmentRockParts: THREE.BufferGeometry[] = [];
    for (const ax of [-75, 75]) {
      const sign = ax < 0 ? -1 : 1;
      const ac = getGoldenBridgeCurveAtX(ax);
      const pierBottom = 1.0;
      const pierH = ac.y - pierBottom;
      const pier = new THREE.BoxGeometry(6.2, pierH, 6.2);
      pier.translate(ax + sign * 2.5, pierBottom + pierH * 0.5, ac.z);
      deckParts.push(pier);

      // Sculpted mossy granite cliff buttresses wrapping (±78, -145)
      const rockButtress = createSculptedRockGeometry(ax < 0 ? 501 : 601, 7.2, 13.5, 6.8, 3);
      rockButtress.translate(ax + sign * 4.0, ac.y - 11.5, ac.z);
      abutmentRockParts.push(rockButtress);
    }
    const abutmentRocksMesh = new THREE.Mesh(mergeNormalized(abutmentRockParts), stoneHandMat);
    abutmentRocksMesh.castShadow = true;
    abutmentRocksMesh.receiveShadow = true;
    group.add(abutmentRocksMesh);

    const deckMesh = new THREE.Mesh(mergeNormalized(deckParts), teakDeckMat);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    group.add(deckMesh);

    const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), goldMetalMat);
    goldMesh.castShadow = true;
    goldMesh.receiveShadow = true;
    group.add(goldMesh);

    const glassMesh = new THREE.Mesh(mergeNormalized(glassParts), glassRailMat);
    group.add(glassMesh);

    // 2. TWO Monumental 26m-tall Sculpted Mossy Stone Giant Hands rising from (±32, -143)
    const handParts: THREE.BufferGeometry[] = [];

    const buildGiantHand = (handX: number, mirrorX: number, seedBase: number) => {
      const bc = getGoldenBridgeCurveAtX(handX);
      const palmY = bc.y - 1.15;
      const palmZ = bc.z;

      // Grounded cliff shoulder rock around the (±32, -143) pedestal
      const shoulder = createSculptedRockGeometry(seedBase + 7, 6.2, 6.5, 5.8, 3);
      shoulder.translate(handX - mirrorX * 1.5, 6.2, -143.0);
      handParts.push(shoulder);

      // Massive 26m weathered stone forearm rising from (±32, -143) cliff pedestal up to palm at bc.z
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(handX - mirrorX * 2.5, 2.0, -143.0),
        new THREE.Vector3(handX - mirrorX * 1.6, 9.5, -147.2),
        new THREE.Vector3(handX - mirrorX * 0.6, 16.5, -152.2),
        new THREE.Vector3(handX, palmY - 0.5, palmZ)
      ]);
      const armGeo = new THREE.TubeGeometry(armCurve, 22, 3.25, 16, false);
      const armPos = armGeo.attributes.position;
      for (let i = 0; i < armPos.count; i++) {
        const vx = armPos.getX(i);
        const vy = armPos.getY(i);
        const vz = armPos.getZ(i);
        const crag = noise2D(vx * 0.42 + vy * 0.28, vz * 0.42 - vy * 0.22, seedBase);
        armPos.setXYZ(i, vx + crag * 0.42, vy, vz + crag * 0.42);
      }
      armGeo.computeVertexNormals();
      handParts.push(armGeo);

      // Sculpted stone palm cradling the underside of the Golden Bridge
      const palmGeo = createSculptedRockGeometry(seedBase + 19, 5.4, 2.0, 4.5, 3);
      palmGeo.translate(handX, palmY - 0.85, palmZ);
      handParts.push(palmGeo);

      // 4 Articulated Giant Fingers curving cleanly up along the front (+Z) golden fascia
      const fingerSpecs = [
        { dx: -3.25 * mirrorX, len: 5.0, rBase: 0.84, rTip: 0.56 },
        { dx: -1.10 * mirrorX, len: 5.7, rBase: 0.92, rTip: 0.60 },
        { dx: 1.15 * mirrorX, len: 5.3, rBase: 0.86, rTip: 0.56 },
        { dx: 3.30 * mirrorX, len: 4.4, rBase: 0.74, rTip: 0.48 }
      ];
      fingerSpecs.forEach((f, idx) => {
        const fx = handX + f.dx;
        const fc = getGoldenBridgeCurveAtX(fx);
        const fz = (palmZ + fc.z) * 0.5;
        const fy = fc.y - 1.15;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(fx, fy - 0.5, fz + 2.55),
          new THREE.Vector3(fx, fy + 0.55, fz + 3.85),
          new THREE.Vector3(fx, fy + 2.0 + f.len * 0.35, fz + 3.65),
          new THREE.Vector3(fx, fy + 2.8 + f.len * 0.55, fz + 2.85)
        ]);
        const fGeo = new THREE.TubeGeometry(curve, 16, f.rBase, 12, false);
        const fPos = fGeo.attributes.position;
        for (let i = 0; i < fPos.count; i++) {
          const vx = fPos.getX(i);
          const vy = fPos.getY(i);
          const vz = fPos.getZ(i);
          const rock = noise2D(vx * 1.1 + vy, vz * 1.1, seedBase + 40 + idx * 7);
          const hFrac = clamp01((vy - (palmY - 0.6)) / 5.2);
          const taper = 1.0 - hFrac * 0.25 + Math.sin(hFrac * Math.PI * 3.0) * 0.08;
          fPos.setXYZ(
            i,
            fx + (vx - fx) * taper + rock * 0.12,
            vy,
            vz + rock * 0.12
          );
        }
        fGeo.computeVertexNormals();
        handParts.push(fGeo);

        const tipCap = createSculptedRockGeometry(seedBase + 90 + idx, f.rTip, f.rTip * 1.1, f.rTip, 2);
        tipCap.translate(fx, fy + 2.8 + f.len * 0.55, fz + 2.85);
        handParts.push(tipCap);
      });

      // Articulated Thumb arching from the northern/inner side of the palm
      const thumbX = handX - mirrorX * 3.9;
      const thumbCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(handX - mirrorX * 2.3, palmY - 0.8, palmZ - 1.8),
        new THREE.Vector3(thumbX, palmY + 0.2, palmZ - 3.35),
        new THREE.Vector3(thumbX - mirrorX * 0.3, palmY + 2.0, palmZ - 3.20),
        new THREE.Vector3(thumbX, palmY + 3.1, palmZ - 2.35)
      ]);
      const thumbGeo = new THREE.TubeGeometry(thumbCurve, 14, 0.90, 12, false);
      handParts.push(thumbGeo);
      const thumbCap = createSculptedRockGeometry(seedBase + 131, 0.72, 0.78, 0.72, 2);
      thumbCap.translate(thumbX, palmY + 3.1, palmZ - 2.35);
      handParts.push(thumbCap);
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

      // Keep central foreground vista channel open & clear of Hòn Trống Mái, Fansipan/Lũng Cú & outer macro sanctuaries
      if (Math.abs(kx) < 52 && kz > -395) continue;
      if (Math.hypot(kx + 28, kz + 410) < 34) continue;
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

    const karstMesh = new THREE.Mesh(mergeNormalized(karstParts), karstMat);
    karstMesh.castShadow = true;
    karstMesh.receiveShadow = true;
    group.add(karstMesh);

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

      const mainMast = new THREE.CylinderGeometry(0.08, 0.11, 6.4, 10);
      mainMast.translate(0.5, 3.6, 0);
      hullParts.push(mainMast);

      const foreMast = new THREE.CylinderGeometry(0.06, 0.09, 4.8, 10);
      foreMast.translate(2.5, 2.8, 0);
      hullParts.push(foreMast);

      const hullMesh = new THREE.Mesh(mergeNormalized(hullParts), hullWoodMat);
      hullMesh.castShadow = true;
      boat.add(hullMesh);

      const mainSail = new THREE.Mesh(createBatWingSailGeo(3.6, 4.8), sailMat);
      mainSail.position.set(0.3, 4.1, 0.12);
      mainSail.rotation.y = Math.PI * 0.5;
      mainSail.castShadow = true;
      boat.add(mainSail);

      const foreSail = new THREE.Mesh(createBatWingSailGeo(2.5, 3.5), sailMat);
      foreSail.position.set(2.35, 3.3, 0.12);
      foreSail.rotation.y = Math.PI * 0.5;
      foreSail.castShadow = true;
      boat.add(foreSail);

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
    for (let s = 0; s < 5; s++) {
      const blade = new THREE.PlaneGeometry(0.085, 0.72, 1, 3);
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
      blade.rotateY((s / 5) * Math.PI * 2 + 0.3);
      blade.rotateX(0.18);
      stalkParts.push(blade);
    }
    const riceGeo = mergeNormalized(stalkParts);
    const riceMat = new THREE.MeshStandardMaterial({
      color: '#6ca82d',
      roughness: 0.74,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(riceMat);

    const riceMesh = new THREE.InstancedMesh(riceGeo, riceMat, riceCount);
    riceMesh.name = 'InstancedSapaRiceStalks';

    const rand = mulberry32(445566);
    const dummy = new THREE.Matrix4();
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
      dummy.compose(
        new THREE.Vector3(rx, ry - 0.06, rz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
        new THREE.Vector3(sc, sc, sc)
      );
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
    riceMesh.count = placed;
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
    }

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

    const culmParts: THREE.BufferGeometry[] = [];
    for (let s = 0; s < 5; s++) {
      const seg = new THREE.CylinderGeometry(0.085 - s * 0.010, 0.095 - s * 0.010, 1.85, 8);
      seg.translate(0, 0.92 + s * 1.85, 0);
      culmParts.push(seg);
      const node = new THREE.TorusGeometry(0.095 - s * 0.010, 0.015, 6, 10);
      node.rotateX(Math.PI * 0.5);
      node.translate(0, 1.85 + s * 1.85, 0);
      culmParts.push(node);
    }
    const culmGeo = mergeNormalized(culmParts);

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
    const dummy = new THREE.Matrix4();
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
        dummy.compose(
          new THREE.Vector3(bx, by - 0.15, bz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, rand() * Math.PI * 2, tiltZ)),
          new THREE.Vector3(sc, sc * (0.9 + rand() * 0.35), sc)
        );
        culmMesh.setMatrixAt(idx, dummy);
        leafMesh.setMatrixAt(idx, dummy);

        col.setHSL(0.26 + (rand() - 0.5) * 0.04, 0.52, 0.36 + rand() * 0.12);
        culmMesh.setColorAt(idx, col);
        leafMesh.setColorAt(idx, col);
        idx++;
      }
    }
    culmMesh.count = idx;
    leafMesh.count = idx;
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

    const barkMat = new THREE.MeshStandardMaterial({
      color: '#5f4938',
      map: pbr.bark.map,
      normalMap: pbr.bark.normalMap,
      roughnessMap: pbr.bark.roughnessMap,
      roughness: 0.90
    });
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
    this.extraMaterials.push(barkMat, canopyMat, blossomMat);

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
      const dummy = new THREE.Matrix4();
      anchors.forEach((a, i) => {
        dummy.compose(
          new THREE.Vector3(a.x, a.y, a.z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
          new THREE.Vector3(a.s, a.s * 0.8, a.s)
        );
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
    const bladeGeo = new THREE.PlaneGeometry(0.11, 0.65, 1, 3);
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
    const dummy = new THREE.Matrix4();
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
      dummy.compose(
        new THREE.Vector3(gx, gy - 0.08, gz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
        new THREE.Vector3(sc, sc, sc)
      );
      grassMesh.setMatrixAt(placed, dummy);
      col.setHSL(0.26 + (rand() - 0.5) * 0.05, 0.55, 0.34 + rand() * 0.14);
      grassMesh.setColorAt(placed, col);
      placed++;
    }

    grassMesh.count = placed;
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

    this.incenseSmoke = createIncenseSmokeSystem(sources);
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
      this.directionalLight.position.copy(sunDir).multiplyScalar(110);
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

    for (const fw of this.foliageWindUniforms) {
      fw.uTime.value = this.sceneElapsedTime;
    }
    for (const au of this.extraAnimatedUniforms) {
      au.uTime.value = this.sceneElapsedTime;
    }

    this.updateEgrets(elapsedTime);
    this.updateJunkBoats(elapsedTime);
    this.referenceShowController?.update(elapsedTime, this.boundCamera?.position);
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
          this.directionalLight.position.set(lx, ly, lz);
          const sunDir = this.directionalLight.position.clone().normalize();
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
    const elevatedAt = (x: number, z: number, offset: number): number =>
      Math.max(VIETNAM_WATER_LEVEL, this.getGroundHeight(x, z)) + offset;

    const pois: Array<IPointOfInterest & { lookAt?: THREE.Vector3; region?: string }> = [
      // I. Miền Bắc (15)
      {
        name: 'Khue Van Cac Courtyard',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(0.0, elevatedAt(0.0, 14.0, 2.4), 14.0),
        lookAt: new THREE.Vector3(0.0, 5.8, 0.0),
        dwellTime: 9.0
      },
      {
        name: 'One Pillar Pagoda & Lotus Lake',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-32.0, elevatedAt(-32.0, 22.0, 3.2), 22.0),
        lookAt: new THREE.Vector3(-48.0, 4.2, 22.0),
        dwellTime: 10.0
      },
      {
        name: 'Turtle Tower Islet',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(35.0, elevatedAt(35.0, 22.0, 3.2), 22.0),
        lookAt: new THREE.Vector3(52.0, 4.8, 22.0),
        dwellTime: 9.0
      },
      {
        name: 'Ha Long Bay & Rice Terraces Overlook',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(0.0, elevatedAt(0.0, -255.0, 22.0), -255.0),
        lookAt: new THREE.Vector3(0.0, 18.0, -450.0),
        dwellTime: 10.0
      },
      {
        name: 'Ruộng bậc thang Mù Cang Chải',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-118.0, elevatedAt(-118.0, -32.0, 14.0), -32.0),
        lookAt: new THREE.Vector3(-225.0, 20.0, -48.0),
        dwellTime: 9.0
      },
      {
        name: 'Hoàng Thành Thăng Long',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(0.0, elevatedAt(0.0, -40.0, 4.5), -40.0),
        lookAt: new THREE.Vector3(0.0, 7.5, -68.0),
        dwellTime: 9.0
      },
      {
        name: 'Cột cờ Lũng Cú — Hà Giang',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-355.0, elevatedAt(-355.0, -310.0, 38.0), -310.0),
        lookAt: new THREE.Vector3(-380.0, 62.0, -340.0),
        dwellTime: 9.5
      },
      {
        name: 'Đỉnh Fansipan — Nóc nhà Đông Dương',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(380.0, elevatedAt(380.0, -308.0, 12.0), -308.0),
        lookAt: new THREE.Vector3(400.0, 79.0, -330.0),
        dwellTime: 10.0
      },
      {
        name: 'Chùa Hương & Suối Yến',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(178.0, elevatedAt(178.0, -138.0, 7.5), -138.0),
        lookAt: new THREE.Vector3(208.0, 9.0, -185.0),
        dwellTime: 9.0
      },
      {
        name: 'Đền Hùng — Núi Nghĩa Lĩnh',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-158.0, elevatedAt(-158.0, -172.0, 14.0), -172.0),
        lookAt: new THREE.Vector3(-195.0, 28.0, -210.0),
        dwellTime: 9.0
      },
      {
        name: 'Thung Lũng Lúa Vàng Tràng An',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(120.0, elevatedAt(120.0, -62.0, 3.2), -62.0),
        lookAt: new THREE.Vector3(120.0, 28.0, -165.0),
        dwellTime: 9.0
      },
      {
        name: 'Tam Cốc — Bích Động Hoàng Hôn',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(680.0, elevatedAt(680.0, -175.0, 4.5), -175.0),
        lookAt: new THREE.Vector3(680.0, 32.0, -410.0),
        dwellTime: 10.0
      },
      {
        name: 'Làng Cổ Đường Lâm — Cây Đa Nghìn Năm',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-640.0, elevatedAt(-640.0, -108.0, 2.5), -108.0),
        lookAt: new THREE.Vector3(-640.0, 8.5, -196.0),
        dwellTime: 9.5
      },
      {
        name: 'Cứ Điểm Điện Biên Phủ — Đồi A1',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-820.0, elevatedAt(-820.0, -422.0, 3.8), -422.0),
        lookAt: new THREE.Vector3(-820.0, 44.0, -545.0),
        dwellTime: 9.5
      },
      {
        name: 'Đại Thuỷ Chiến Sông Bạch Đằng',
        region: 'I. Miền Bắc',
        position: new THREE.Vector3(-240.0, elevatedAt(-240.0, -618.0, 5.2), -618.0),
        lookAt: new THREE.Vector3(-240.0, 15.0, -780.0),
        dwellTime: 10.0
      },

      // II. Miền Trung & Tây Nguyên (15)
      {
        name: 'Golden Bridge & Giant Hands Vista',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(0.0, Math.max(this.getGroundHeight(0.0, -96.0) + 20.0, 22.0), -96.0),
        lookAt: new THREE.Vector3(0.0, 22.0, -155.0),
        dwellTime: 11.0
      },
      {
        name: 'Cố đô Huế — Ngọ Môn',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(-108.0, elevatedAt(-108.0, 42.0, 12.0), 42.0),
        lookAt: new THREE.Vector3(-178.0, 13.5, 42.0),
        dwellTime: 9.5
      },
      {
        name: 'Phố cổ Hội An & Chùa Cầu',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(175.0, elevatedAt(175.0, 88.0, 6.5), 88.0),
        lookAt: new THREE.Vector3(175.0, 4.5, 45.0),
        dwellTime: 9.5
      },
      {
        name: 'Cầu Rồng — Đà Nẵng',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(450.0, elevatedAt(450.0, 12.0, 14.5), 12.0),
        lookAt: new THREE.Vector3(385.0, 15.5, -35.0),
        dwellTime: 9.0
      },
      {
        name: 'Hang Sơn Đoòng — Quảng Bình',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(338.0, elevatedAt(338.0, -205.0, 5.5), -205.0),
        lookAt: new THREE.Vector3(372.0, 16.0, -205.0),
        dwellTime: 10.0
      },
      {
        name: 'Động Phong Nha — Kẻ Bàng',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(275.0, elevatedAt(275.0, -210.0, 6.5), -210.0),
        lookAt: new THREE.Vector3(275.0, 9.0, -255.0),
        dwellTime: 9.0
      },
      {
        name: 'Thánh địa Mỹ Sơn — Quảng Nam',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(-292.0, elevatedAt(-292.0, -110.0, 11.5), -110.0),
        lookAt: new THREE.Vector3(-322.0, 11.5, -135.0),
        dwellTime: 9.0
      },
      {
        name: 'Tháp Chàm Poshanư — Phan Thiết',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(458.0, elevatedAt(458.0, 95.0, 7.5), 95.0),
        lookAt: new THREE.Vector3(435.0, 26.5, 95.0),
        dwellTime: 8.5
      },
      {
        name: 'Thung lũng Tình Yêu & Langbiang — Đà Lạt',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(-348.0, elevatedAt(-348.0, 165.0, 6.5), 165.0),
        lookAt: new THREE.Vector3(-375.0, 39.0, 165.0),
        dwellTime: 9.0
      },
      {
        name: 'Biển hồ T\'Nưng — Pleiku',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(-382.0, elevatedAt(-382.0, 76.0, 28.0), 76.0),
        lookAt: new THREE.Vector3(-432.0, 12.0, 42.0),
        dwellTime: 9.0
      },
      {
        name: 'Đại Nội Huế — Điện Thái Hòa',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(-646.0, elevatedAt(-646.0, 80.0, 2.2), 80.0),
        lookAt: new THREE.Vector3(-692.0, 4.2, 80.0),
        dwellTime: 10.0
      },
      {
        name: 'Quảng Trường Hội Quán & Đèn Lồng Hội An',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(640.0, elevatedAt(640.0, 206.0, 2.5), 206.0),
        lookAt: new THREE.Vector3(640.0, 5.8, 128.0),
        dwellTime: 9.5
      },
      {
        name: 'Bến Sông Hoài Đêm Hoa Đăng',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(705.0, elevatedAt(705.0, 318.0, 3.0), 318.0),
        lookAt: new THREE.Vector3(775.0, 3.2, 248.0),
        dwellTime: 9.5
      },
      {
        name: 'Thung Lũng Sơn Mài Long Vân — Rồng Đại Việt',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(820.0, elevatedAt(820.0, 42.0, 4.5), 42.0),
        lookAt: new THREE.Vector3(820.0, 18.0, -96.0),
        dwellTime: 10.0
      },
      {
        name: 'Không Gian Thổ Cẩm Tây Nguyên & Vòm Nón Lá',
        region: 'II. Miền Trung & Tây Nguyên',
        position: new THREE.Vector3(-840.0, elevatedAt(-840.0, 198.0, 2.8), 198.0),
        lookAt: new THREE.Vector3(-840.0, 26.0, 106.0),
        dwellTime: 9.5
      },

      // III. Miền Nam & Hải Đảo (15)
      {
        name: 'Chợ Bến Thành — TP. Hồ Chí Minh',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-108.0, elevatedAt(-108.0, 120.0, 8.5), 120.0),
        lookAt: new THREE.Vector3(-108.0, 14.0, 190.0),
        dwellTime: 9.0
      },
      {
        name: 'Dinh Độc Lập — TP. Hồ Chí Minh',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(0.0, elevatedAt(0.0, 145.0, 9.0), 145.0),
        lookAt: new THREE.Vector3(0.0, 12.5, 225.0),
        dwellTime: 9.5
      },
      {
        name: 'Nhà thờ Đức Bà — Sài Gòn',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(116.0, elevatedAt(116.0, 84.0, 12.0), 84.0),
        lookAt: new THREE.Vector3(108.0, 26.0, 178.0),
        dwellTime: 9.5
      },
      {
        name: 'Địa đạo Củ Chi',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-262.0, elevatedAt(-262.0, 240.0, 8.5), 240.0),
        lookAt: new THREE.Vector3(-254.0, 8.5, 270.0),
        dwellTime: 8.5
      },
      {
        name: 'Tháp Bà Ponagar — Nha Trang',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(232.0, elevatedAt(232.0, 232.0, 22.0), 232.0),
        lookAt: new THREE.Vector3(265.0, 24.0, 275.0),
        dwellTime: 9.5
      },
      {
        name: 'Chợ nổi Cái Răng — Cần Thơ',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-72.0, elevatedAt(-72.0, 330.0, 7.5), 330.0),
        lookAt: new THREE.Vector3(-72.0, 2.5, 365.0),
        dwellTime: 9.5
      },
      {
        name: 'Rừng tràm Trà Sư — An Giang',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-198.0, elevatedAt(-198.0, 398.5, 5.5), 398.5),
        lookAt: new THREE.Vector3(-245.0, 3.8, 395.0),
        dwellTime: 9.0
      },
      {
        name: 'Mũi Cà Mau — Cực Nam Tổ Quốc',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(24.0, elevatedAt(24.0, 439.0, 9.5), 439.0),
        lookAt: new THREE.Vector3(0.0, 9.0, 482.0),
        dwellTime: 9.5
      },
      {
        name: 'Đảo Ngọc Phú Quốc',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-292.0, elevatedAt(-292.0, 412.0, 14.0), 412.0),
        lookAt: new THREE.Vector3(-335.0, 5.5, 476.0),
        dwellTime: 9.5
      },
      {
        name: 'Côn Đảo — Vịnh Côn Sơn',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(278.0, elevatedAt(278.0, 432.0, 13.0), 432.0),
        lookAt: new THREE.Vector3(325.0, 9.0, 480.0),
        dwellTime: 9.5
      },
      {
        name: 'Liên Hoa Bạch Ngọc Đài — Sen Hồng',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(0.0, elevatedAt(0.0, -494.0, 2.8), -494.0),
        lookAt: new THREE.Vector3(0.0, 5.2, -562.0),
        dwellTime: 10.0
      },
      {
        name: 'Quảng Trường Trống Đồng & Vườn Chuối Lạc Việt',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-680.0, elevatedAt(-680.0, 488.0, 2.8), 488.0),
        lookAt: new THREE.Vector3(-680.0, 8.5, 385.0),
        dwellTime: 9.5
      },
      {
        name: 'Đại Tượng Đài Đất Nước — Trường Sơn',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(-560.0, elevatedAt(-560.0, -562.0, 4.2), -562.0),
        lookAt: new THREE.Vector3(-560.0, 29.0, -680.0),
        dwellTime: 10.0
      },
      {
        name: 'Quảng Trường Ký Ức Lịch Sử 35mm',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(0.0, elevatedAt(0.0, -274.0, 2.6), -274.0),
        lookAt: new THREE.Vector3(0.0, 6.2, -338.0),
        dwellTime: 9.5
      },
      {
        name: 'Hẻm Núi Trường Sơn Mùa Mưa Bão',
        region: 'III. Miền Nam & Hải Đảo',
        position: new THREE.Vector3(740.0, elevatedAt(740.0, -432.0, 5.8), -432.0),
        lookAt: new THREE.Vector3(740.0, 22.0, -595.0),
        dwellTime: 9.5
      }
    ];

    return pois;
  }

  public dispose(): void {
    if (!this.isInitialized) return;

    this.pipeline?.dispose();
    this.pipeline = null;

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

    this.ambientLight = null;
    this.hemiLight = null;
    this.directionalLight = null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;
    this.sceneElapsedTime = 0.0;

    this.isInitialized = false;
  }
}
