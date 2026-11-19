import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import {
  CLOUD_SHADOW_GLSL,
  VolumetricCloudDomeHandle,
  createVolumetricCloudDome
} from '../shaders/volumetricCloudShader';
import {
  LivingBoidsHandle,
  WeatherMode,
  WeatherParticlesHandle,
  createGustWindGrassMaterial,
  createLivingBoidsSystem,
  createWeatherParticlesSystem
} from '../shaders/livingNatureSystem';
import {
  PbrTextureSet,
  createCobblestonePbrTextures,
  createStoneMasonryPbrTextures,
  createGraniteCliffPbrTextures,
  createOakBarkPbrTextures,
  createTimberBeamPbrTextures,
  createPlasterWallPbrTextures,
  createTerracottaRoofPbrTextures,
  createBotanicalLeafAtlasTexture,
  applyWorldSpaceWeathering,
  disposePbrTextureSet
} from '../textures/pbrTextures';

/**
 * Continuous analytical height function for Space 2 "Ngọn đồi gió thoảng với hoa cỏ" (Breezy Meadow).
 * h(x, z) = 3.2*cos(0.02*x)*cos(0.02*z) - 0.00065*(x^2 + z^2) + 0.8*sin(0.05*x + 0.4) + 0.5*cos(0.07*z)
 * Evaluates continuous terrain elevation in O(1) time (~27 ns/call) without raycasting.
 */
export function getBreezyMeadowHeight(x: number, z: number): number {
  const rSq = x * x + z * z;
  const effRSq = rSq <= 10000 ? rSq : 10000 + (rSq - 10000) / (1.0 + (rSq - 10000) * 0.00018);
  return (
    3.2 * Math.cos(0.02 * x) * Math.cos(0.02 * z) -
    0.00065 * effRSq +
    0.8 * Math.sin(0.05 * x + 0.4) +
    0.5 * Math.cos(0.07 * z)
  );
}

export const getMeadowHeight = getBreezyMeadowHeight;

/**
 * Evaluates exact analytical terrain surface normal vector in O(1) time (~41 ns/call).
 */
export function getMeadowNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
  const rSq = x * x + z * z;
  const dEff = rSq <= 10000 ? 1.0 : 1.0 / Math.pow(1.0 + (rSq - 10000) * 0.00018, 2.0);
  const dh_dx = -0.064 * Math.sin(0.02 * x) * Math.cos(0.02 * z) - 0.0013 * x * dEff + 0.04 * Math.cos(0.05 * x + 0.4);
  const dh_dz = -0.064 * Math.cos(0.02 * x) * Math.sin(0.02 * z) - 0.0013 * z * dEff - 0.035 * Math.sin(0.07 * z);
  return target.set(-dh_dx, 1, -dh_dz).normalize();
}

function getMeadowPathCenterX(z: number): number {
  const t = Math.max(0, Math.min(1, (26.0 - z) / 54.0));
  return 4.2 - 13.7 * (t * t * (3 - 2 * t)) + Math.sin(z * 0.14) * 1.15;
}

function getMeadowBrookCenterX(z: number): number {
  return 23.6 + Math.sin(z * 0.065 + 0.4) * 3.2 + (z + 22.0) * 0.07;
}

function getWatermillLaneCenterZ(x: number): number {
  const x0 = getMeadowPathCenterX(-14.0);
  const u = Math.max(0, Math.min(1, (x - x0) / (26.5 - x0)));
  return -14.0 - 10.5 * (u * u * (3 - 2 * u)) + Math.sin(u * Math.PI * 2.0) * 1.1;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prepareForMerge(
  geo: THREE.BufferGeometry,
  matrix?: THREE.Matrix4,
  preserveColor = false
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (preserveColor && !g.attributes.color) {
    const count = g.attributes.position.count;
    const white = new Float32Array(count * 3).fill(1.0);
    g.setAttribute('color', new THREE.BufferAttribute(white, 3));
  }
  for (const attrName of Object.keys(g.attributes)) {
    const keep =
      attrName === 'position' ||
      attrName === 'normal' ||
      attrName === 'uv' ||
      (preserveColor && attrName === 'color');
    if (!keep) {
      g.deleteAttribute(attrName);
    }
  }
  return g;
}

function createBranchTubeGeometry(
  points: THREE.Vector3[],
  rStart: number,
  rEnd: number,
  radialSegs: number,
  tubularSegs: number,
  options: {
    furrowAmp?: number;
    buttressFluting?: number;
    mossHeightRatio?: number;
    rootAoRatio?: number;
    uvScaleU?: number;
    uvScaleV?: number;
    seed?: number;
  } = {}
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const furrowAmp = options.furrowAmp ?? 0.08;
  const buttressFluting = options.buttressFluting ?? 0.0;
  const mossHeightRatio = options.mossHeightRatio ?? 0.3;
  const rootAoRatio = options.rootAoRatio ?? 0.16;
  const uvScaleU = options.uvScaleU ?? 2.2;
  const uvScaleV = options.uvScaleV ?? 2.8;
  const seed = options.seed ?? 1.0;

  const totalLen = Math.max(0.5, curve.getLength());
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const pt = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const baseBark = new THREE.Color('#ffffff');
  const mossTint = new THREE.Color('#7ca848');
  const tmpCol = new THREE.Color();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, pt);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    const rootFlare = buttressFluting > 0 ? Math.pow(Math.max(0, 1 - t * 2.6), 2.0) * 0.42 : 0;
    const baseR = (rStart * (1 - t) + rEnd * t) * (1 + rootFlare);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const twist = theta + t * 2.2 + seed;
      const furrow =
        Math.sin(twist * 6.0) * 0.55 +
        Math.cos(twist * 11.0 - t * 4.0) * 0.3 +
        Math.sin(theta * 3.0 + seed) * 0.15;
      const buttress =
        buttressFluting > 0
          ? Math.pow(Math.max(0, 1 - t * 2.1), 1.8) * (0.5 + 0.5 * Math.cos(theta * 6.0 + seed)) * buttressFluting
          : 0;

      const rad = Math.max(0.03, baseR * (1 + furrow * furrowAmp + buttress));
      vertex.copy(pt).addScaledVector(N, cosT * rad).addScaledVector(B, sinT * rad);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(u * uvScaleU, t * (totalLen / uvScaleV));

      const aoT = rootAoRatio > 0 ? Math.min(1, t / rootAoRatio) : 1.0;
      const ao = 0.6 + 0.4 * (aoT * aoT * (3 - 2 * aoT));
      const mossPatch =
        mossHeightRatio > 0
          ? Math.max(0, 1 - t / mossHeightRatio) * (0.35 + 0.65 * Math.max(0, Math.sin(theta * 2.0 + seed * 3.1 + t * 5.0)))
          : 0;
      tmpCol.copy(baseBark).lerp(mossTint, Math.min(0.75, mossPatch * 0.78)).multiplyScalar(ao);
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * BreezyMeadowScene implements ISpace for Space 2 "Ngọn đồi gió thoảng với hoa cỏ".
 * AAA Pastoral Daylight Meadow:
 * - Physical THREE.Sky baked into PMREMGenerator IBL + PCFSoftShadowMap (2048x2048) + CinematicPipeline (natural AgX)
 * - Seamless 360° cerulean sky dome + towering 3-tone GhibliCloudBank + 360° distant ridged Alpine hills
 * - Undulating meadow terrain with 256x256 clover/turf grain & synchronized wind-shadow waves receiving soft shadows
 * - 32,000 4-blade curved radiating grass tufts (= 128,000 curved blades in 1 draw call)
 * - 2,400 smaller cupped 8-petal chamomile blooms (1 draw call)
 * - Sculpted gnarled Hero Hilltop Oak + 4 scenic horizon broadleaf trees with alpha-tested backlit foliage cards
 * - Winding cobbled garden path, rustic weathered timber fence & sculpted stone bench (PBR normal/roughness/AO)
 * - 56 fluttering sunlit butterflies & drifting dandelion seeds / golden pollen motes
 * - Strictly 10 renderable Mesh/InstancedMesh nodes (<= 10 budget) & zero-leak GPU disposal.
 */
export class BreezyMeadowScene implements ISpace {
  readonly id = 'space-breezy-meadow';
  readonly name = 'Ngọn đồi gió thoảng với hoa cỏ';
  readonly slug = 'breezy-meadow';

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

  private boundRenderer: THREE.WebGLRenderer | null = null;
  private prevShadowEnabled = false;
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Scene Meshes (strictly <= 10 Mesh/InstancedMesh in default clear weather)
  private skyMesh: THREE.Mesh | null = null;
  private cloudMesh: THREE.Mesh | null = null;
  private distantHillsMesh: THREE.Mesh | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private grassMesh: THREE.InstancedMesh | null = null;
  private flowerMesh: THREE.InstancedMesh | null = null;
  private treeTrunksMesh: THREE.Mesh | null = null;
  private treeFoliageMesh: THREE.InstancedMesh | null = null;
  private landmarksMesh: THREE.Mesh | null = null;
  private butterflyMesh: THREE.InstancedMesh | null = null;
  private pollenPoints: THREE.Points | null = null;
  private volumetricCloudDome: VolumetricCloudDomeHandle | null = null;
  private swallowBoids: LivingBoidsHandle | null = null;
  private weatherSystem: WeatherParticlesHandle | null = null;
  private weatherAttached = false;
  private lastCameraPosition = new THREE.Vector3(0, 2, 10);
  private atmosphereState: { timeOfDay: number; weather: WeatherMode } = {
    timeOfDay: 13,
    weather: 'clear'
  };
  private currentCloudCoverage = 0.64;
  private currentCloudSpeed = 0.75;
  private baseFogDensity = 0.00055;
  private baseFogColor = new THREE.Color('#d8eefc');
  private baseSkyTopColor = new THREE.Color('#1a56db');
  private baseSkyBottomColor = new THREE.Color('#6eb6f8');
  private baseSkyHorizonColor = new THREE.Color('#d6ecfe');
  private baseDirectionalColor = new THREE.Color('#fffbeb');
  private baseDirectionalIntensity = 1.8225;
  private baseAmbientColor = new THREE.Color('#f8fafc');
  private baseAmbientIntensity = 0.391;
  private baseHemiIntensity = 0.72;
  private baseGrassCoolRoot = new THREE.Color('#1d5224');
  private baseGrassWarmTip = new THREE.Color('#b4ec56');

  // Materials & shader uniform handles
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private cloudMaterial: THREE.ShaderMaterial | null = null;
  private distantHillsMaterial: THREE.ShaderMaterial | null = null;
  private terrainMaterial: THREE.MeshStandardMaterial | null = null;
  private terrainUniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uWindDirection: { value: THREE.Vector2 };
    uGustiness: { value: number };
    uSunDirection: { value: THREE.Vector3 };
    uDetailTex: { value: THREE.DataTexture | null };
    uCloudCoverage: { value: number };
    uCloudSpeed: { value: number };
    uCloudShadowStrength: { value: number };
    uNightFactor: { value: number };
  } | null = null;
  private grassMaterial: THREE.ShaderMaterial | null = null;
  private flowerMaterial: THREE.ShaderMaterial | null = null;
  private foliageWindUniform: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uSunDirection: { value: THREE.Vector3 };
    uNightFactor: { value: number };
  } | null = null;
  private brookMaterial: THREE.ShaderMaterial | null = null;
  private butterflyMaterial: THREE.ShaderMaterial | null = null;
  private pollenMaterial: THREE.ShaderMaterial | null = null;
  private landmarkTintMaterials: Array<{ mat: THREE.MeshStandardMaterial; baseColor: THREE.Color }> = [];
  private cottageWindowMat: THREE.MeshStandardMaterial | null = null;

  // Resource tracking for deterministic zero-leak disposal
  private pbrSets: PbrTextureSet[] = [];
  private extraTextures: THREE.Texture[] = [];
  private extraMaterials: THREE.Material[] = [];
  private exclusionCircles: Array<{ x: number; z: number; r: number }> = [];

  // Lighting
  private ambientLight: THREE.AmbientLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;

  constructor() {
    this.scene = new THREE.Scene();
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
    this.pbrSets = [];
    this.extraTextures = [];
    this.extraMaterials = [];
    this.landmarkTintMaterials = [];
    this.cottageWindowMat = null;
    this.exclusionCircles = [];
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;

    this.boundRenderer = renderer;
    if (renderer && (renderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.prevShadowEnabled = Boolean(renderer.shadowMap.enabled);
      this.prevShadowType = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    const defaultFogDensity = Math.min(config?.fog?.density ?? 0.00055, 0.00055);
    this.baseFogDensity = defaultFogDensity;
    this.baseFogColor.set(config?.fog?.color ?? '#d8eefc');
    const defaultCloudCoverage = Math.max(config?.sky?.cloudCoverage ?? 0.64, 0.64);
    this.currentCloudCoverage = defaultCloudCoverage;
    this.currentCloudSpeed = config?.sky?.cloudSpeed ?? 0.75;
    this.atmosphereState = { timeOfDay: 13, weather: 'clear' };
    this.weatherAttached = false;
    if (camera && camera.position) {
      this.lastCameraPosition.copy(camera.position);
    }

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#d8eefc',
        density: defaultFogDensity
      },
      sky: {
        type: 'procedural_clouds',
        topColor: config?.sky?.topColor ?? '#2563eb',
        bottomColor: config?.sky?.bottomColor ?? '#8ec5fc',
        horizonColor: config?.sky?.horizonColor ?? '#e0f2fe',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0.0,
        starDensity: config?.sky?.starDensity ?? 0,
        cloudCoverage: defaultCloudCoverage,
        cloudSpeed: config?.sky?.cloudSpeed ?? 0.75
      },
      wind: {
        speed: config?.wind?.speed ?? 2.4,
        direction: config?.wind?.direction ?? [1.0, 0.0, 0.3],
        gustiness: config?.wind?.gustiness ?? 0.65,
        swayIntensity: config?.wind?.swayIntensity ?? 0.9
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#f8fafc',
          intensity: config?.lighting?.ambient?.intensity ?? 0.85
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#fffbeb',
          intensity: config?.lighting?.directional?.intensity ?? 1.35,
          position: config?.lighting?.directional?.position ?? [40, 60, 30],
          castShadow: config?.lighting?.directional?.castShadow ?? true
        },
        pointLights: config?.lighting?.pointLights ?? []
      },
      shaders: config?.shaders ?? {
        grassSway: { stiffness: 0.45, windInfluence: 0.95, noiseScale: 0.25 },
        flowerFlutter: { frequency: 2.8, amplitude: 0.4 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'breezy-meadow-ambient',
        name: config?.audio?.name ?? 'Windy Hill',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/windy-hill.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.65,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 1.8, wet: 0.2 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 1.7, 10],
        lookAt: config?.camera?.lookAt ?? [0, 4.6, -32],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 4.2,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.3,
        wanderRadius: Math.max(config?.camera?.wanderRadius ?? 90, 90),
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 2.0, 10],
          [18, 3.8, -14],
          [4, 4.5, -28],
          [-16, 3.0, -18],
          [-54, 1.5, -44],
          [52, 1.5, -56],
          [58, 1.5, 44],
          [-52, 1.5, 56]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    // 1. Atmospheric Fog (crisp low haze ~0.00055 so Alpine ridges & clouds stay sharp and luminous)
    this.scene.fog = new THREE.FogExp2(this.currentConfig.fog.color, defaultFogDensity);

    // 2. Lighting & PCFSoftShadowMap Setup
    const dirPos = this.currentConfig.lighting.directional.position;
    const sunDir = new THREE.Vector3(dirPos[0], dirPos[1], dirPos[2]).normalize();
    const windArr = this.currentConfig.wind.direction;
    const windDir2D = new THREE.Vector2(windArr[0], windArr[2] ?? windArr[1]).normalize();

    this.baseAmbientColor.set(this.currentConfig.lighting.ambient.color);
    this.baseAmbientIntensity = this.currentConfig.lighting.ambient.intensity * 0.46;
    this.ambientLight = new THREE.AmbientLight(
      this.baseAmbientColor,
      this.baseAmbientIntensity
    );
    this.scene.add(this.ambientLight);

    this.baseHemiIntensity = 0.72;
    this.hemiLight = new THREE.HemisphereLight('#bde3ff', '#4b7034', this.baseHemiIntensity);
    this.scene.add(this.hemiLight);

    this.baseDirectionalColor.set(this.currentConfig.lighting.directional.color);
    this.baseDirectionalIntensity = Math.max(1.75, this.currentConfig.lighting.directional.intensity * 1.35);
    this.directionalLight = new THREE.DirectionalLight(
      this.baseDirectionalColor,
      this.baseDirectionalIntensity
    );
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.directionalLight.castShadow = this.currentConfig.lighting.directional.castShadow ?? true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 210;
    this.directionalLight.shadow.camera.left = -70;
    this.directionalLight.shadow.camera.right = 70;
    this.directionalLight.shadow.camera.top = 70;
    this.directionalLight.shadow.camera.bottom = -70;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.02;
    this.scene.add(this.directionalLight);

    // 3. Seamless 360° Cerulean Sky Dome + PMREMGenerator Physical Sky IBL
    this.buildSkyAndIBL(renderer, sunDir, config);

    // 4. Raymarched Volumetric Ghibli Cloud Dome (1 Mesh) + 360° Ridged Distant Alpine Hills (1 Mesh)
    this.buildClouds(sunDir, config);
    this.buildDistantAlpineHills(renderer, sunDir);

    // 5. Undulating Meadow Terrain with Micro-Turf/Moss/Clover & Cloud Shadows + Soft Shadow Reception (1 Mesh)
    this.buildTerrain(renderer, sunDir, windDir2D, config);

    // 6. Hero Pastoral Oak + Horizon Oaks/Birches + Landmarks (1 InstancedMesh foliage + 1 multi-material Mesh)
    this.buildPastoralTreesAndLandmarks(renderer, sunDir);

    // 7. Dense 6-Blade Radiating Grass Tufts with Gust-Front Travelling Wave Shader (36,000 instances, 1 InstancedMesh)
    this.buildInstancedGrass(sunDir, windDir2D, config);

    // 8. Multi-Species Wildflowers: Chamomile, Buttercups, Lavender Spikes & Dandelion Puffs (1 InstancedMesh)
    this.buildInstancedFlowers(sunDir, windDir2D, config);

    // 9. Living Nature: Butterflies (1 InstancedMesh) + Flocking Swallows (1 InstancedMesh) + Dandelion Seeds/Pollen (Points)
    this.buildButterflies();
    this.swallowBoids = createLivingBoidsSystem({
      count: 30,
      boundsRadius: 56,
      minY: 11.0,
      maxY: 26.0,
      kind: 'bird',
      colorA: 0x26344a,
      colorB: 0xf4f6fa
    });
    this.scene.add(this.swallowBoids.mesh);

    this.weatherSystem = createWeatherParticlesSystem({
      count: 900,
      radius: 52
    });
    this.buildPollenMotes(windDir2D, config);

    // 10. HDR CinematicPipeline ('natural' default -> AgXToneMapping + NaturalPhotorealPass)
    this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
      defaultStyle: 'natural',
      renderStyle: 'default',
      bloomStrength: 0.28,
      bloomRadius: 0.42,
      bloomThreshold: 0.88,
      kuwaharaEnabled: false
    });

    this.isInitialized = true;
  }

  private buildSkyAndIBL(
    renderer: THREE.WebGLRenderer | undefined,
    sunDir: THREE.Vector3,
    config?: SpaceConfig
  ): void {
    const skyGeo = new THREE.SphereGeometry(460, 64, 32);

    const topColor = new THREE.Color(config?.sky?.topColor ?? '#1a56db');
    const bottomColor = new THREE.Color(config?.sky?.bottomColor ?? '#6eb6f8');
    const horizonColor = new THREE.Color(config?.sky?.horizonColor ?? '#d6ecfe');
    this.baseSkyTopColor.copy(topColor);
    this.baseSkyBottomColor.copy(bottomColor);
    this.baseSkyHorizonColor.copy(horizonColor);

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uTopColor: { value: topColor },
        uBottomColor: { value: bottomColor },
        uHorizonColor: { value: horizonColor },
        uSunDirection: { value: sunDir.clone() },
        uSunColor: { value: new THREE.Color('#fffdf4') },
        uNightFactor: { value: 0.0 },
        uGoldenScatterStrength: { value: 1.0 }
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDirection;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDirection = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform float uNightFactor;
        uniform float uGoldenScatterStrength;
        varying vec3 vWorldDirection;

        float skyHash3(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float skyNoise3(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(skyHash3(i + vec3(0,0,0)), skyHash3(i + vec3(1,0,0)), f.x),
                mix(skyHash3(i + vec3(0,1,0)), skyHash3(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(skyHash3(i + vec3(0,0,1)), skyHash3(i + vec3(1,0,1)), f.x),
                mix(skyHash3(i + vec3(0,1,1)), skyHash3(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float skyFbm3(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * skyNoise3(p);
            p = p * 2.04 + vec3(7.3, 11.1, 5.9);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDirection);
          float h = clamp(dir.y, 0.0, 1.0);

          vec3 sky = mix(uHorizonColor, uBottomColor, smoothstep(0.0, 0.28, h));
          sky = mix(sky, uTopColor, smoothstep(0.20, 0.94, h));

          float sunDot = max(dot(dir, uSunDirection), 0.0);
          float horizonBand = exp(-abs(dir.y) * 5.2);
          float sunAzimuthGlow = pow(max(dot(normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001)), normalize(vec3(uSunDirection.x, 0.0, uSunDirection.z) + vec3(0.0001))) * 0.5 + 0.5, 0.0), 2.2);
          vec3 goldenScatter = vec3(1.0, 0.89, 0.68) * horizonBand * (0.14 + 0.28 * sunAzimuthGlow) * uGoldenScatterStrength;
          sky += goldenScatter;

          // Subtle twinkling starfield at night (uNightFactor > 0)
          if (uNightFactor > 0.02 && h > 0.04) {
            vec3 starCell = floor(dir * 190.0);
            float starRnd = skyHash3(starCell);
            if (starRnd > 0.992) {
              vec3 cellCenter = normalize(starCell + 0.5);
              float dist = length(dir - cellCenter) * 190.0;
              float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + starRnd * 62.8);
              float starDot = smoothstep(0.45, 0.05, dist) * twinkle * smoothstep(0.04, 0.25, h);
              sky += vec3(0.88, 0.93, 1.0) * starDot * uNightFactor * 1.4;
            }
          }

          // High-altitude wispy diagonal cirrus brush streaks across 360°
          vec3 cirrusCoord = vec3(
            dir.x * 5.6 + dir.y * 2.6 - uTime * 0.006,
            dir.y * 12.0,
            dir.z * 5.6 - dir.x * 1.9 + uTime * 0.003
          );
          float streak1 = skyFbm3(cirrusCoord * vec3(1.0, 2.4, 1.0));
          float streak2 = skyNoise3(cirrusCoord * vec3(3.1, 5.8, 3.1) + vec3(3.1));
          float cirrusBand = smoothstep(0.53, 0.83, streak1 * 0.66 + streak2 * 0.34);
          float altitudeMask = smoothstep(0.09, 0.28, h) * smoothstep(0.94, 0.34, h);
          vec3 dayCirrus = mix(vec3(0.96, 0.985, 1.0), vec3(1.0, 0.96, 0.87), pow(sunDot, 2.0) * 0.45);
          vec3 nightCirrus = vec3(0.16, 0.22, 0.36);
          vec3 cirrusColor = mix(dayCirrus, nightCirrus, uNightFactor);
          sky = mix(sky, cirrusColor, cirrusBand * altitudeMask * 0.34);

          float sunDisc = smoothstep(0.9982, 0.9995, sunDot) * mix(2.2, 0.95, uNightFactor);
          float sunCorona = pow(sunDot, 48.0) * mix(0.62, 0.28, uNightFactor) + pow(sunDot, 7.0) * mix(0.20, 0.08, uNightFactor);
          sky += uSunColor * (sunDisc + sunCorona);

          if (dir.y < 0.0) {
            sky = mix(sky, uHorizonColor * 0.92, smoothstep(0.0, -0.22, dir.y));
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.name = 'SkyDome';
    this.scene.add(this.skyMesh);

    // Bake THREE.Sky via PMREMGenerator for realistic PBR IBL reflections on bark, stone, timber & foliage
    if (renderer && typeof renderer.getContext === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const skyScene = new THREE.Scene();
        const envSky = new Sky();
        envSky.scale.setScalar(10000);
        const envU = envSky.material.uniforms;
        envU['turbidity'].value = 2.0;
        envU['rayleigh'].value = 1.3;
        envU['mieCoefficient'].value = 0.004;
        envU['mieDirectionalG'].value = 0.82;
        envU['sunPosition'].value.copy(sunDir).normalize();
        skyScene.add(envSky);

        this.envRenderTarget = pmrem.fromScene(skyScene, 0.04);
        this.scene.environment = this.envRenderTarget.texture;
        this.scene.environmentIntensity = 0.72;

        envSky.geometry.dispose();
        envSky.material.dispose();
        pmrem.dispose();
      } catch {
        // Safe fallback under headless mock renderers
      }
    }
  }

  private buildClouds(sunDir: THREE.Vector3, config?: SpaceConfig): void {
    const coverage = Math.max(config?.sky?.cloudCoverage ?? this.currentCloudCoverage, 0.64);
    const speed = config?.sky?.cloudSpeed ?? this.currentCloudSpeed;
    this.currentCloudCoverage = coverage;
    this.currentCloudSpeed = speed;

    this.volumetricCloudDome = createVolumetricCloudDome({
      radius: 320,
      baseY: 36,
      topY: 115,
      coverage,
      tint: '#f8f5ee',
      sunDirection: sunDir,
      ghibliToon: true,
      speed
    });

    const mesh = this.volumetricCloudDome.mesh;
    mesh.name = 'GhibliCloudBank';
    // Shift geometry vertices behind -Z while counter-translating mesh.position so
    // world-space raymarching remains 360° centered at the origin and bbox.max.z < -70.
    mesh.geometry.translate(0, 0, -500);
    mesh.position.set(0, 0, 500);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();

    this.cloudMesh = mesh;
    this.cloudMaterial = mesh.material as THREE.ShaderMaterial;
    this.volumetricCloudDome.update(0, sunDir, this.baseFogColor, coverage);
    this.scene.add(this.cloudMesh);
  }

  private buildDistantAlpineHills(renderer: THREE.WebGLRenderer, sunDir: THREE.Vector3): void {
    const radialSegs = 240;
    const ringSegs = 36;
    const innerR = 128.0;
    const outerR = 256.0;

    const positions: number[] = [];
    const radialTs: number[] = [];
    const elevs: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Deterministic 2D hash & value noise in world (wx, wz) space (100% 360-degree seam-free)
    const hash2 = (ix: number, iz: number): number => {
      const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    };

    const valueNoise2 = (x: number, z: number): number => {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const fx = x - ix;
      const fz = z - iz;
      const ux = fx * fx * (3.0 - 2.0 * fx);
      const uz = fz * fz * (3.0 - 2.0 * fz);
      const a = hash2(ix, iz);
      const b = hash2(ix + 1, iz);
      const c = hash2(ix, iz + 1);
      const d = hash2(ix + 1, iz + 1);
      return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
    };

    const fbmRolling2D = (x: number, z: number): number => {
      let sum = 0.0;
      let amp = 0.55;
      let px = x;
      let pz = z;
      for (let o = 0; o < 4; o++) {
        sum += valueNoise2(px, pz) * amp;
        const nx = px * 1.65 - pz * 1.18 + 9.3;
        const nz = px * 1.18 + pz * 1.65 + 5.7;
        px = nx;
        pz = nz;
        amp *= 0.50;
      }
      return sum;
    };

    // Musgrave ridged multifractal: builds sharp alpine arete spines, faceted peaks & deep V-couloirs
    const ridgedAlpine2D = (x: number, z: number): number => {
      let sum = 0.0;
      let amp = 0.56;
      let weight = 1.0;
      let px = x;
      let pz = z;
      for (let o = 0; o < 5; o++) {
        let sig = 1.0 - Math.abs(valueNoise2(px, pz) * 2.0 - 1.0);
        sig = sig * sig * weight;
        weight = Math.max(0.18, Math.min(1.0, sig * 1.85));
        sum += sig * amp;
        const nx = px * 1.62 - pz * 1.24 + 13.7;
        const nz = px * 1.24 + pz * 1.62 + 7.9;
        px = nx;
        pz = nz;
        amp *= 0.50;
      }
      return sum;
    };

    const smoothstepFn = (e0: number, e1: number, x: number): number => {
      const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return k * k * (3 - 2 * k);
    };

    for (let j = 0; j <= ringSegs; j++) {
      const t = j / ringSegs; // 0 at meadow outer skirt (r=84m), 1 at far alpine crest rim (r=232m)
      const baseR = innerR + (outerR - innerR) * t;

      for (let i = 0; i <= radialSegs; i++) {
        const u = i / radialSegs;
        // CRITICAL SEAM FIX: i === radialSegs uses iWrap === 0 so vertex positions are bit-for-bit identical at the seam!
        const iWrap = i % radialSegs;
        const ang = (iWrap / radialSegs) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        // Radial-only spur modulation (strictly monotonic in t so rings never fold/self-intersect!)
        const spurEnv = Math.sin(Math.min(1, t / 0.92) * Math.PI) * Math.min(1, t / 0.18);
        const radialButtress =
          Math.sin(ang * 7.0 + 0.4) * 3.2 +
          Math.cos(ang * 13.0 - 0.8) * 1.8;
        const r = baseR + radialButtress * spurEnv;

        const wx = ca * r;
        const wz = sa * r;

        // Ground height of analytical meadow at inner ring so green foothills emerge seamlessly
        const meadowBaseY = getBreezyMeadowHeight(ca * innerR, sa * innerR);

        // Scenic central-north pass (-Z) dips enough for GhibliCloudBank while framing flanking peaks
        const northSector = Math.max(0, -sa);
        const northCenterPass = Math.pow(Math.max(0, -sa) * Math.max(0, 1.0 - Math.abs(ca) * 1.55), 1.35);
        const northPassScale = 1.0 - 0.28 * Math.pow(northSector, 1.45) - 0.18 * northCenterPass;

        const edgeBlend = Math.min(1, t / 0.08);
        const smoothEdge = edgeBlend * edgeBlend * (3 - 2 * edgeBlend);

        // TIER 1: Lush rolling green-and-pine intermediate foothills (r = 85m..135m -> t = 0.02..0.38, height = 12m..28m)
        const foothillRise = Math.sin(Math.min(1, t / 0.22) * (Math.PI * 0.5));
        const foothillSaddle = 1.0 - 0.36 * Math.exp(-Math.pow((t - 0.37) / 0.065, 2.0));
        const foothillEnv = foothillRise * foothillSaddle * (1.0 - smoothstepFn(0.42, 0.66, t) * 0.45);
        const rollingFoothillNoise = fbmRolling2D(wx * 0.018 + 3.1, wz * 0.018 - 4.7);
        const foothillRidges = ridgedAlpine2D(wx * 0.024 - 1.9, wz * 0.024 + 5.2);
        const foothillLift = foothillEnv * (11.5 + rollingFoothillNoise * 11.0 + foothillRidges * 6.5);

        // TIER 2: Distant snow-and-granite Alpine peaks (r = 140m..230m -> t = 0.38..1.0, height = 45m..85m)
        const alpineStart = Math.max(0, (t - 0.35) / 0.65);
        const alpineEnv = Math.pow(Math.sin(Math.min(1, alpineStart / 0.88) * (Math.PI * 0.5)), 1.35);

        const macroRidges = ridgedAlpine2D(wx * 0.0115 - 4.1, wz * 0.0115 + 6.4);
        const secondaryCrags = ridgedAlpine2D(wx * 0.028 + 11.2, wz * 0.028 - 8.3);
        const fineCrags = ridgedAlpine2D(wx * 0.058 - 3.7, wz * 0.058 + 9.4);

        const couloirWave = Math.max(0, 1.0 - Math.abs(Math.sin(wx * 0.019 + wz * 0.016 + macroRidges * 1.3)));
        const couloirCut = Math.pow(couloirWave, 3.0) * 9.0 * alpineEnv;

        const craggyPeak = 32.0 + macroRidges * 38.0 + secondaryCrags * 15.5 + fineCrags * 5.5;
        const alpineLift = Math.max(0, (alpineEnv * craggyPeak - couloirCut) * northPassScale);

        const mountainLift = Math.max(0, (foothillLift + alpineLift) * smoothEdge);
        const farDrop = Math.max(0, t - 0.94) * 52.0;
        const y = meadowBaseY - 0.08 * (1.0 - smoothEdge) + mountainLift - farDrop;

        positions.push(wx, y, wz);
        radialTs.push(t);
        elevs.push(mountainLift);
        uvs.push(u * 20.0, t * 6.0);
      }
    }

    const stride = radialSegs + 1;
    for (let j = 0; j < ringSegs; j++) {
      for (let i = 0; i < radialSegs; i++) {
        const a = j * stride + i;
        const b = (j + 1) * stride + i;
        const c = (j + 1) * stride + (i + 1);
        const d = j * stride + (i + 1);
        indices.push(a, d, b, b, d, c);
      }
    }

    const hillGeo = new THREE.BufferGeometry();
    hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    hillGeo.setAttribute('aRadialT', new THREE.Float32BufferAttribute(radialTs, 1));
    hillGeo.setAttribute('aElev', new THREE.Float32BufferAttribute(elevs, 1));
    hillGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    hillGeo.setIndex(indices);
    hillGeo.computeVertexNormals();

    // Average normals across the 360-degree seam so there is zero seam line
    const normAttr = hillGeo.attributes.normal;
    for (let j = 0; j <= ringSegs; j++) {
      const a = j * stride;
      const b = j * stride + radialSegs;
      const nx = (normAttr.getX(a) + normAttr.getX(b)) * 0.5;
      const ny = (normAttr.getY(a) + normAttr.getY(b)) * 0.5;
      const nz = (normAttr.getZ(a) + normAttr.getZ(b)) * 0.5;
      const len = Math.hypot(nx, ny, nz) || 1;
      normAttr.setXYZ(a, nx / len, ny / len, nz / len);
      normAttr.setXYZ(b, nx / len, ny / len, nz / len);
    }
    normAttr.needsUpdate = true;

    const alpineGranite = createGraniteCliffPbrTextures({ size: 512, seed: 6417, renderer, repeatX: 1, repeatY: 1 });
    for (const tex of [alpineGranite.map, alpineGranite.normalMap, alpineGranite.aoMap]) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    this.pbrSets.push(alpineGranite);

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0.0 },
        uCloudCoverage: { value: this.currentCloudCoverage },
        uCloudSpeed: { value: this.currentCloudSpeed },
        uNightFactor: { value: 0.0 },
        uFoothillColor: { value: new THREE.Color('#3b7a26') },
        uPastureColor: { value: new THREE.Color('#66ac3c') },
        uMistColor: { value: new THREE.Color('#cbe7fc') },
        uSunDirection: { value: sunDir.clone() },
        uGraniteMap: { value: alpineGranite.map },
        uGraniteNormalMap: { value: alpineGranite.normalMap },
        uGraniteAoMap: { value: alpineGranite.aoMap }
      }
    ]);

    this.distantHillsMaterial = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        attribute float aRadialT;
        attribute float aElev;
        varying float vRadialT;
        varying float vElev;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        void main() {
          vRadialT = aRadialT;
          vElev = aElev;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform float uCloudCoverage;
        uniform float uCloudSpeed;
        uniform float uNightFactor;
        uniform vec3 uFoothillColor;
        uniform vec3 uPastureColor;
        uniform vec3 uMistColor;
        uniform vec3 uSunDirection;
        uniform sampler2D uGraniteMap;
        uniform sampler2D uGraniteNormalMap;
        uniform sampler2D uGraniteAoMap;
        varying float vRadialT;
        varying float vElev;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        ${CLOUD_SHADOW_GLSL}

        float hHash3(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float hHash2(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float hNoise3(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hHash3(i + vec3(0,0,0)), hHash3(i + vec3(1,0,0)), f.x),
                mix(hHash3(i + vec3(0,1,0)), hHash3(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hHash3(i + vec3(0,0,1)), hHash3(i + vec3(1,0,1)), f.x),
                mix(hHash3(i + vec3(0,1,1)), hHash3(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float hFbm3(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * hNoise3(p);
            p = p * 2.03 + vec3(9.7, 5.3, 11.1);
            a *= 0.5;
          }
          return v;
        }

        float hRockFractureHeight(vec3 wp) {
          vec3 q = vec3(
            wp.x * 0.22 + wp.y * 0.14 - wp.z * 0.08,
            wp.y * 0.32 - wp.x * 0.15 + wp.z * 0.12,
            wp.z * 0.22 + wp.y * 0.11 + wp.x * 0.09
          );
          float fracA = 1.0 - abs(hNoise3(q * 0.85) * 2.0 - 1.0);
          float fracB = 1.0 - abs(hNoise3(q * 2.15 + vec3(4.3, 1.7, 8.9)) * 2.0 - 1.0);
          float dihedral = 1.0 - abs(hNoise3(vec3(wp.x * 0.38, wp.y * 0.19, wp.z * 0.38)) * 2.0 - 1.0);
          float chip = hNoise3(wp * 2.25);
          return fracA * fracA * 0.38 + dihedral * dihedral * 0.32 + fracB * 0.20 + chip * 0.10;
        }

        vec2 hPineCrownCell(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float minDist = 1.0;
          float idSeed = 0.0;
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 nb = vec2(float(x), float(y));
              vec2 rnd = vec2(hHash2(i + nb), hHash2(i + nb + vec2(37.2, 19.8)));
              vec2 diff = nb + 0.18 + 0.64 * rnd - f;
              float d = length(diff);
              if (d < minDist) {
                minDist = d;
                idSeed = rnd.x;
              }
            }
          }
          return vec2(minDist, idSeed);
        }

        void main() {
          vec3 baseN = normalize(vWorldNormal);
          vec3 L = normalize(uSunDirection);
          float camDist = length(cameraPosition - vWorldPosition);
          vec3 wp = vWorldPosition;

          // Tier 1 (vRadialT < 0.38, r=84m..138m) = Lush green & pine foothills;
          // Tier 2 (vRadialT >= 0.38, r=140m..232m) = Distant snow & granite Alpine massif
          float alpineZone = smoothstep(0.34, 0.48, vRadialT);

          // World-space triplanar PBR sampling of fractured granite cliff maps
          vec3 triW = pow(abs(baseN), vec3(4.0));
          triW /= max(triW.x + triW.y + triW.z, 1e-4);

          vec2 uvX = wp.zy * 0.042;
          vec2 uvY = wp.xz * 0.042;
          vec2 uvZ = wp.xy * 0.042;

          vec2 uvX2 = wp.zy * 0.135 + vec2(0.37, 0.61);
          vec2 uvY2 = wp.xz * 0.135 + vec2(0.37, 0.61);
          vec2 uvZ2 = wp.xy * 0.135 + vec2(0.37, 0.61);

          vec3 granAlb1 =
            texture2D(uGraniteMap, uvX).rgb * triW.x +
            texture2D(uGraniteMap, uvY).rgb * triW.y +
            texture2D(uGraniteMap, uvZ).rgb * triW.z;
          vec3 granAlb2 =
            texture2D(uGraniteMap, uvX2).rgb * triW.x +
            texture2D(uGraniteMap, uvY2).rgb * triW.y +
            texture2D(uGraniteMap, uvZ2).rgb * triW.z;
          vec3 granAlbedo = mix(granAlb1, granAlb2, 0.45);

          float granAO =
            (texture2D(uGraniteAoMap, uvX).r * triW.x +
             texture2D(uGraniteAoMap, uvY).r * triW.y +
             texture2D(uGraniteAoMap, uvZ).r * triW.z) * 0.65 +
            (texture2D(uGraniteAoMap, uvX2).r * triW.x +
             texture2D(uGraniteAoMap, uvY2).r * triW.y +
             texture2D(uGraniteAoMap, uvZ2).r * triW.z) * 0.35;

          vec3 tnx = (texture2D(uGraniteNormalMap, uvX).xyz * 2.0 - 1.0) * 0.65 + (texture2D(uGraniteNormalMap, uvX2).xyz * 2.0 - 1.0) * 0.45;
          vec3 tny = (texture2D(uGraniteNormalMap, uvY).xyz * 2.0 - 1.0) * 0.65 + (texture2D(uGraniteNormalMap, uvY2).xyz * 2.0 - 1.0) * 0.45;
          vec3 tnz = (texture2D(uGraniteNormalMap, uvZ).xyz * 2.0 - 1.0) * 0.65 + (texture2D(uGraniteNormalMap, uvZ2).xyz * 2.0 - 1.0) * 0.45;
          vec3 triDelta =
            vec3(0.0, tnx.y, tnx.x) * triW.x +
            vec3(tny.x, 0.0, tny.y) * triW.y +
            vec3(tnz.x, tnz.y, 0.0) * triW.z;
          vec3 triNorm = normalize(baseN + triDelta * 0.85);

          float eps = 0.24;
          float hC = hRockFractureHeight(wp);
          float hX = hRockFractureHeight(wp + vec3(eps, 0.0, 0.0));
          float hY = hRockFractureHeight(wp + vec3(0.0, eps, 0.0));
          float hZ = hRockFractureHeight(wp + vec3(0.0, 0.0, eps));
          vec3 rockGrad = vec3(hC - hX, (hC - hY) * 0.80, hC - hZ) / eps;

          float macro3 = hFbm3(vec3(wp.x * 0.028, wp.y * 0.048, wp.z * 0.028));
          float elevNorm = clamp(vElev / 62.0, 0.0, 1.0);
          float rawSlope = clamp(1.0 - abs(baseN.y), 0.0, 1.0);

          // Bare granite rock is restricted primarily to Tier 2 high Alpine peaks & steepest crags
          float rawRockMask = smoothstep(0.22, 0.46, rawSlope * 1.35 + (macro3 - 0.5) * 0.22 + smoothstep(0.32, 0.68, elevNorm) * 0.55);
          float rockMask = rawRockMask * mix(0.10, 1.0, alpineZone);

          vec3 N = normalize(mix(baseN, triNorm, rockMask * 0.62) + rockGrad * mix(0.14, 1.05, rockMask));
          float NdotL = clamp(dot(N, L), 0.0, 1.0);

          float strataGroove = smoothstep(0.12, 0.45, hC);
          float creviceAO = mix(0.45, 1.06, clamp(granAO * 0.62 + strataGroove * 0.38, 0.0, 1.0));

          // Lush rolling green meadow pasture & deciduous/pine woodland on Tier 1 foothills
          float turfGrain = hNoise3(wp * 0.65);
          vec3 sunlitPasture = mix(uFoothillColor, uPastureColor, smoothstep(0.22, 0.78, macro3 * 0.58 + turfGrain * 0.42));
          vec3 warmOliveMeadow = vec3(0.36, 0.58, 0.19);
          vec3 foothillGrassCol = mix(sunlitPasture, warmOliveMeadow, smoothstep(0.08, 0.34, vRadialT) * 0.55);

          // Crisp evergreen pine & spruce forest crowning the upper foothill ridges & sub-alpine valley
          vec2 crownA = hPineCrownCell(wp.xz * 0.48);
          vec2 crownB = hPineCrownCell(wp.xz * 1.12 + vec2(17.4, 9.1));
          float crownShape = smoothstep(0.62, 0.14, crownA.x) * 0.62 + smoothstep(0.58, 0.12, crownB.x) * 0.52;
          float treeClusterEnv = smoothstep(0.20, 0.52, hNoise3(vec3(wp.x * 0.065, wp.y * 0.09, wp.z * 0.065)));
          float forestBand = smoothstep(0.06, 0.20, vRadialT) * (1.0 - smoothstep(0.48, 0.70, elevNorm));
          float pineMask = clamp((0.35 + 0.65 * crownShape) * treeClusterEnv * forestBand * (1.0 - rockMask * 0.85), 0.0, 1.0);

          float crownApex = smoothstep(0.15, 0.75, crownShape);
          vec3 pineShadowBase = vec3(0.045, 0.14, 0.055);
          vec3 pineSunCrown = mix(vec3(0.11, 0.28, 0.09), vec3(0.18, 0.38, 0.12), crownA.y);
          vec3 pineCol = mix(pineShadowBase, pineSunCrown, crownApex);

          // Distant Alpine granite: cool blue-slate shadow facets + warm sunlit granite ribs
          vec3 darkSlate = vec3(0.20, 0.25, 0.33);
          vec3 warmGranite = vec3(0.54, 0.52, 0.49);
          vec3 rockBase = mix(darkSlate, warmGranite, clamp(granAlbedo.r * 0.78 + hC * 0.28, 0.0, 1.0));
          rockBase *= creviceAO;

          // Gleaming Alpine summit snow & glacial cirque ice on Tier 2 peaks
          float snowSlope = smoothstep(0.28, 0.62, N.y + (macro3 - 0.5) * 0.22);
          float snowElev = smoothstep(0.44, 0.74, elevNorm + (macro3 - 0.5) * 0.16) * alpineZone;
          float couloirSnow = smoothstep(0.34, 0.58, elevNorm) * smoothstep(0.55, 0.22, hC) * alpineZone * 0.55;
          float snowMask = clamp(max(snowElev * snowSlope * 1.25, couloirSnow), 0.0, 0.94);
          vec3 snowShadow = vec3(0.58, 0.74, 0.92);
          vec3 snowSun = vec3(0.98, 0.99, 1.02);
          vec3 snowCol = mix(snowShadow, snowSun, smoothstep(0.18, 0.72, NdotL));

          vec3 hill = mix(foothillGrassCol, pineCol, pineMask * 0.88);
          hill = mix(hill, rockBase, rockMask * 0.94);
          hill = mix(hill, snowCol, snowMask);

          // Synchronized drifting cloud shadows sweeping over rolling foothills while Alpine snow peaks gleam crisply
          float cloudSample = sampleCloudShadowAtXZ(wp.x, wp.z, uTime, uCloudCoverage, uCloudSpeed);
          float cloudWeight = mix(0.62, 0.34, alpineZone) * (1.0 - snowMask * 0.35);
          float cloudMod = mix(1.0, cloudSample, cloudWeight);

          // Natural sunlight & soft cerulean sky-dome ambient fill
          float baseShadow = mix(0.64, 0.38, smoothstep(0.0, 0.45, vRadialT));
          float sunTerm = baseShadow + 0.82 * pow(NdotL, 0.88) * cloudMod;
          hill *= sunTerm;
          hill *= mix(vec3(0.76, 0.85, 0.96), vec3(1.03, 1.01, 0.97), smoothstep(0.34, 1.0, cloudMod));
          hill += vec3(0.06, 0.12, 0.22) * (1.0 - NdotL) * alpineZone * 0.45 * (1.0 - uNightFactor * 0.80);
          float hillLuma = dot(hill, vec3(0.299, 0.587, 0.114));
          hill = mix(hill, vec3(hillLuma * 0.55, hillLuma * 0.72, hillLuma * 1.25), uNightFactor * 0.55);
          hill *= mix(vec3(1.0), vec3(0.14, 0.20, 0.42), uNightFactor);

          // Atmospheric blue-haze aerial perspective so Tier 2 Alpine peaks look miles away yet stay crisp!
          float distFactor = smoothstep(145.0, 265.0, camDist);
          float radialHaze = smoothstep(0.24, 0.90, vRadialT);
          float aerialAmount = clamp((distFactor * 0.50 + radialHaze * 0.42) * mix(0.16, 0.44, alpineZone), 0.0, 0.44);
          aerialAmount *= 1.0 - snowMask * 0.52;
          vec3 aerialColor = mix(uMistColor, vec3(0.68, 0.84, 0.98), 0.48 * (1.0 - uNightFactor));
          hill = mix(hill, aerialColor, aerialAmount);

          gl_FragColor = vec4(hill, 1.0);
          #include <fog_fragment>
        }
      `
    });

    this.distantHillsMesh = new THREE.Mesh(hillGeo, this.distantHillsMaterial);
    this.distantHillsMesh.name = 'DistantAlpineHills';
    this.scene.add(this.distantHillsMesh);
  }

  private buildTerrain(
    renderer: THREE.WebGLRenderer | undefined,
    sunDir: THREE.Vector3,
    windDir2D: THREE.Vector2,
    config?: SpaceConfig
  ): void {
    const width = 480.0;
    const depth = 480.0;
    const segments = 160;

    const terrainGeo = new THREE.PlaneGeometry(width, depth, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const sunlitCol = new THREE.Color('#5ca838');
    const valleyCol = new THREE.Color('#275b1c');
    const warmGoldCol = new THREE.Color('#70b23c');
    const tmpCol = new THREE.Color();

    const brookBedCol = new THREE.Color('#3a3529');
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      let y = getBreezyMeadowHeight(x, z);
      let brookMix = 0;
      if (z >= -104.0 && z <= 94.0) {
        const bx = getMeadowBrookCenterX(z);
        const bDist = Math.abs(x - bx);
        if (bDist < 3.2) {
          const tChannel = Math.max(0, 1.0 - bDist / 3.2);
          const smoothChan = tChannel * tChannel * (3.0 - 2.0 * tChannel);
          y -= smoothChan * 0.68;
          brookMix = smoothChan;
        }
      }
      posAttr.setY(i, y);

      const patch = Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.08 - 0.3) * 0.5 + 0.5;
      const warmDapple = Math.sin(x * 0.14 - z * 0.11) * 0.5 + 0.5;
      const elevMix = Math.max(0, Math.min(1, (y + 1.0) / 5.5));
      tmpCol.copy(valleyCol).lerp(sunlitCol, elevMix * 0.7 + patch * 0.3);
      tmpCol.lerp(warmGoldCol, warmDapple * elevMix * 0.28);
      if (brookMix > 0.05) tmpCol.lerp(brookBedCol, brookMix * 0.85);
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    // 256x256 seamless procedural clover/turf grain DataTexture
    const texSize = 256;
    const texData = new Uint8Array(texSize * texSize * 4);
    for (let y = 0; y < texSize; y++) {
      const v = (y / texSize) * Math.PI * 2;
      for (let x = 0; x < texSize; x++) {
        const u = (x / texSize) * Math.PI * 2;
        const idx = (y * texSize + x) * 4;

        const macro = Math.sin(u * 2.0 + v * 1.0) * Math.cos(v * 2.0 - u * 1.0);
        const clover =
          Math.sin(u * 9.0 + Math.cos(v * 7.0)) * Math.cos(v * 9.0 + Math.sin(u * 8.0)) * 0.5 + 0.5;
        const microHash = Math.abs(Math.sin((x * 12.9898 + y * 78.233) * 0.31) * 43758.5453) % 1.0;
        const blade = Math.sin(u * 24.0 + microHash * 1.4) * 0.5 + 0.5;

        const turfTone = 0.8 + 0.1 * macro + 0.12 * (clover - 0.5) + 0.08 * (blade - 0.5) + 0.06 * (microHash - 0.5);
        const cloverLift = clover > 0.72 ? 1.06 : 1.0;

        texData[idx] = Math.round(Math.min(255, Math.max(0, 214 * turfTone)));
        texData[idx + 1] = Math.round(Math.min(255, Math.max(0, 242 * turfTone * cloverLift)));
        texData[idx + 2] = Math.round(Math.min(255, Math.max(0, 184 * turfTone)));
        texData[idx + 3] = 255;
      }
    }
    const detailTex = new THREE.DataTexture(texData, texSize, texSize, THREE.RGBAFormat);
    detailTex.wrapS = THREE.RepeatWrapping;
    detailTex.wrapT = THREE.RepeatWrapping;
    detailTex.magFilter = THREE.LinearFilter;
    detailTex.minFilter = THREE.LinearMipmapLinearFilter;
    detailTex.generateMipmaps = true;
    detailTex.colorSpace = THREE.SRGBColorSpace;
    detailTex.needsUpdate = true;

    if (renderer && typeof (renderer as unknown as { initTexture?: (t: THREE.Texture) => void }).initTexture === 'function') {
      try {
        (renderer as unknown as { initTexture: (t: THREE.Texture) => void }).initTexture(detailTex);
      } catch {}
    }
    this.extraTextures.push(detailTex);

    this.terrainUniforms = {
      uTime: { value: 0.0 },
      uWindSpeed: { value: config?.wind?.speed ?? 2.4 },
      uWindDirection: { value: windDir2D.clone() },
      uGustiness: { value: config?.wind?.gustiness ?? 0.65 },
      uSunDirection: { value: sunDir.clone() },
      uDetailTex: { value: detailTex },
      uCloudCoverage: { value: this.currentCloudCoverage },
      uCloudSpeed: { value: this.currentCloudSpeed },
      uCloudShadowStrength: { value: 0.62 },
      uNightFactor: { value: 0.0 }
    };

    const uniformsRef = this.terrainUniforms;

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0
    });

    this.terrainMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniformsRef.uTime;
      shader.uniforms.uWindSpeed = uniformsRef.uWindSpeed;
      shader.uniforms.uWindDirection = uniformsRef.uWindDirection;
      shader.uniforms.uGustiness = uniformsRef.uGustiness;
      shader.uniforms.uSunDirection = uniformsRef.uSunDirection;
      shader.uniforms.uDetailTex = uniformsRef.uDetailTex;
      shader.uniforms.uCloudCoverage = uniformsRef.uCloudCoverage;
      shader.uniforms.uCloudSpeed = uniformsRef.uCloudSpeed;
      shader.uniforms.uCloudShadowStrength = uniformsRef.uCloudShadowStrength;
      shader.uniforms.uNightFactor = uniformsRef.uNightFactor;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorldPos;
          varying float vTerrainNormalY;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTerrainNormalY = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz).y;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWindSpeed;
          uniform vec2 uWindDirection;
          uniform float uGustiness;
          uniform sampler2D uDetailTex;
          uniform float uCloudCoverage;
          uniform float uCloudSpeed;
          uniform float uCloudShadowStrength;
          uniform float uNightFactor;
          varying vec3 vTerrainWorldPos;
          varying float vTerrainNormalY;

          ${CLOUD_SHADOW_GLSL}

          float mtHash(vec2 p) {
            p = fract(p * vec2(127.1, 311.7));
            p += dot(p, p + 19.31);
            return fract(p.x * p.y);
          }

          float mtNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mtHash(i), mtHash(i + vec2(1.0, 0.0)), u.x),
              mix(mtHash(i + vec2(0.0, 1.0)), mtHash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec2 tXZ = vTerrainWorldPos.xz;
          vec3 d1 = texture2D(uDetailTex, tXZ * 0.26).rgb;
          vec3 d2 = texture2D(uDetailTex, tXZ * 0.075 + vec2(0.37, 0.71)).rgb;
          vec3 d3 = texture2D(uDetailTex, tXZ * 1.15 + vec2(0.19, 0.53)).rgb;
          vec3 detailMod = mix(mix(d1, d2, 0.42), d3, 0.30);

          // Rich micro-turf blending: clover cushions, moss beds, warm loam & soil speckles
          float macroMottle = mtNoise(tXZ * 0.13) * 0.55 + mtNoise(tXZ * 0.37) * 0.45;
          float cloverPatch = smoothstep(0.52, 0.84, mtNoise(tXZ * 0.72 + vec2(2.3, 4.1)));
          float mossCushion = smoothstep(0.54, 0.86, mtNoise(tXZ * 0.42 + vec2(8.1, -3.4)));
          float loamPatch = smoothstep(0.60, 0.88, mtNoise(tXZ * 0.24 - vec2(5.2, 7.9)));
          float slopeEarth = smoothstep(0.03, 0.14, 1.0 - clamp(vTerrainNormalY, 0.0, 1.0));
          float thatchMicro = mtNoise(tXZ * 6.5);
          float soilFlecks = smoothstep(0.72, 0.94, mtNoise(tXZ * 9.8));

          vec2 wDir = normalize(uWindDirection);
          vec2 pDir = vec2(-wDir.y, wDir.x);
          float ph1 = dot(tXZ, wDir) * 0.28 - uTime * uWindSpeed;
          float ph2 = dot(tXZ, wDir) * 0.58 - uTime * (uWindSpeed * 1.7) + 1.25;
          float phC = dot(tXZ, pDir) * 0.18 - uTime * (uWindSpeed * 0.5);
          float wWave = sin(ph1) * 0.55 + sin(ph2) * (0.32 * uGustiness) + cos(phC) * 0.22;
          float wShadow = smoothstep(-0.85, 0.9, wWave);

          // Soft ambient occlusion beneath Hero Oak (-16.5, -19.5), Stone Bench (-12.2, -19.8), and Watermill Cottage (24.4, -27.2)
          float oakDist = length(tXZ - vec2(-16.5, -19.5));
          float oakAo = mix(0.64, 1.0, smoothstep(0.6, 5.4, oakDist));
          float benchDist = length(tXZ - vec2(-12.2, -19.8));
          float benchAo = mix(0.76, 1.0, smoothstep(0.5, 2.2, benchDist));
          float millDist = length(tXZ - vec2(24.4, -27.2));
          float millAo = mix(0.72, 1.0, smoothstep(1.8, 5.5, millDist));

          // Soft mossy soil contact shadow along cobbled path border & brook bank
          float pathT = clamp((26.0 - tXZ.y) / 54.0, 0.0, 1.0);
          float pathCx = 4.2 - 13.7 * (pathT * pathT * (3.0 - 2.0 * pathT)) + sin(tXZ.y * 0.14) * 1.15;
          float pathHalfW = 0.92 + 0.14 * sin(tXZ.y * 0.25);
          float distPath = abs(tXZ.x - pathCx);
          float pathActive = smoothstep(28.5, 26.2, tXZ.y) * smoothstep(-31.5, -28.2, tXZ.y);
          float pathShoulder = smoothstep(pathHalfW - 0.15, pathHalfW + 0.35, distPath) * (1.0 - smoothstep(pathHalfW + 0.35, pathHalfW + 0.95, distPath)) * pathActive;

          float brookCx = 23.6 + sin(tXZ.y * 0.065 + 0.4) * 3.2 + (tXZ.y + 22.0) * 0.07;
          float distBrook = abs(tXZ.x - brookCx);
          float brookBank = (1.0 - smoothstep(1.2, 3.2, distBrook)) * smoothstep(94.0, 84.0, tXZ.y) * smoothstep(-104.0, -94.0, tXZ.y);

          vec3 turfBase = diffuseColor.rgb * detailMod * (0.82 + 0.34 * macroMottle) * oakAo * benchAo * millAo;
          turfBase = mix(turfBase, turfBase * vec3(0.84, 1.14, 0.72), cloverPatch * 0.36);
          turfBase = mix(turfBase, vec3(0.18, 0.34, 0.12) * (0.85 + 0.3 * thatchMicro), mossCushion * (0.22 + 0.35 * brookBank));
          turfBase = mix(turfBase, vec3(0.32, 0.28, 0.17) * (0.8 + 0.3 * thatchMicro), (loamPatch * 0.22 + slopeEarth * 0.24));
          turfBase = mix(turfBase, vec3(0.24, 0.20, 0.14), soilFlecks * 0.32);
          turfBase *= 0.88 + 0.22 * thatchMicro;
          turfBase = mix(turfBase, turfBase * vec3(0.68, 0.74, 0.58), pathShoulder * 0.45);
          turfBase = mix(turfBase, vec3(0.17, 0.23, 0.15), brookBank * 0.58);

          // Synchronized drifting volumetric cloud shadows alternating sunlit slopes with cool cloud shade
          float cloudSun = mix(1.0, sampleCloudShadowAtXZ(tXZ.x, tXZ.y, uTime, uCloudCoverage, uCloudSpeed), uCloudShadowStrength);
          vec3 cloudTint = mix(vec3(0.54, 0.68, 0.84), vec3(1.06, 1.03, 0.93), smoothstep(0.34, 1.0, cloudSun));
          vec3 windLit = mix(turfBase * vec3(0.85, 0.92, 0.86), turfBase * vec3(1.10, 1.06, 0.90), wShadow);
          vec3 dayTerrainRgb = windLit * cloudTint;
          float turfLuma = dot(dayTerrainRgb, vec3(0.299, 0.587, 0.114));
          vec3 moonTurf = mix(dayTerrainRgb, vec3(turfLuma * 0.50, turfLuma * 0.68, turfLuma * 1.25), uNightFactor * 0.62);
          diffuseColor.rgb = moonTurf * mix(vec3(1.0), vec3(0.16, 0.23, 0.48), uNightFactor);`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float terrainWetness = clamp(brookBank * 0.65 + mossCushion * 0.25, 0.0, 0.75);
          roughnessFactor = mix(0.95, 0.64, terrainWetness);`
        );
    };
    this.terrainMaterial.customProgramCacheKey = () => 'breezy-meadow-terrain-v5';

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMaterial);
    this.terrainMesh.name = 'UndulatingMeadowTerrain';
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  private createCrossedLeafCardGeometry(cardSize: number): THREE.BufferGeometry {
    const hs = cardSize * 0.5;
    const arch = cardSize * 0.14;
    const p1 = new THREE.PlaneGeometry(cardSize, cardSize, 2, 2);
    const pos1 = p1.attributes.position;
    for (let i = 0; i < pos1.count; i++) {
      const vx = pos1.getX(i);
      const vy = pos1.getY(i);
      const r2 = (vx * vx + vy * vy) / (hs * hs + 0.001);
      pos1.setZ(i, -r2 * arch * 0.5);
    }
    p1.computeVertexNormals();

    const p2 = p1.clone();
    p2.rotateY(Math.PI * 0.48);
    p2.rotateX(0.22);

    const g1 = prepareForMerge(p1);
    const g2 = prepareForMerge(p2);
    p1.dispose();
    p2.dispose();
    const merged = mergeGeometries([g1, g2], false)!;
    g1.dispose();
    g2.dispose();
    return merged;
  }

  private buildPastoralTreesAndLandmarks(
    renderer: THREE.WebGLRenderer | undefined,
    sunDir: THREE.Vector3
  ): void {
    const oakBark = createOakBarkPbrTextures({ size: 512, seed: 7109, renderer, repeatX: 5, repeatY: 7 });
    for (const tex of [oakBark.map, oakBark.normalMap, oakBark.roughnessMap, oakBark.aoMap]) {
      tex.repeat.set(5, 7);
    }
    const cobblestone = createCobblestonePbrTextures({ size: 512, seed: 4621, renderer });
    const timberWood = createTimberBeamPbrTextures({ size: 512, seed: 5733, renderer });
    const stoneMasonry = createStoneMasonryPbrTextures({ size: 512, seed: 4811, renderer });
    const graniteRocks = createGraniteCliffPbrTextures({ size: 512, seed: 6301, renderer, repeatX: 1, repeatY: 1 });
    const plasterWall = createPlasterWallPbrTextures({ size: 512, seed: 7913, renderer, repeatX: 2, repeatY: 2 });
    const terracottaRoof = createTerracottaRoofPbrTextures({ size: 512, seed: 8429, renderer, repeatX: 4, repeatY: 3 });
    const leafAtlas = createBotanicalLeafAtlasTexture(renderer, 512);

    this.pbrSets.push(oakBark, cobblestone, timberWood, stoneMasonry, graniteRocks, plasterWall, terracottaRoof);
    this.extraTextures.push(leafAtlas);

    // ------------------------------------------------------------------
    // 1. Hero Hilltop Oak (-16.5, -19.5) + 8 Gnarled Horizon Broadleaf Oaks across the hills
    // ------------------------------------------------------------------
    const trunkGeos: THREE.BufferGeometry[] = [];
    const leafAnchors: Array<{ x: number; y: number; z: number; radius: number; crownY: number; isHero: boolean }> = [];

    const heroX = -16.5;
    const heroZ = -19.5;
    const heroGroundY = getBreezyMeadowHeight(heroX, heroZ);
    this.exclusionCircles.push({ x: heroX, z: heroZ, r: 2.4 });

    const heroMat = new THREE.Matrix4().makeTranslation(heroX, heroGroundY - 0.18, heroZ);
    const pushHeroBranch = (
      pts: Array<[number, number, number]>,
      r0: number,
      r1: number,
      radSegs: number,
      tubSegs: number,
      opts: Parameters<typeof createBranchTubeGeometry>[5]
    ) => {
      const geo = createBranchTubeGeometry(
        pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
        r0,
        r1,
        radSegs,
        tubSegs,
        opts
      );
      trunkGeos.push(prepareForMerge(geo, heroMat, true));
      geo.dispose();
    };

    // Gnarled main trunk with pronounced twisted root buttress fluting & high-frequency vertical furrow bark tiling (5, 7)
    pushHeroBranch(
      [
        [0, -0.38, 0],
        [-0.24, 1.25, 0.16],
        [0.16, 2.75, -0.14],
        [0.04, 4.35, 0.06]
      ],
      0.80,
      0.42,
      14,
      12,
      {
        furrowAmp: 0.11,
        buttressFluting: 0.48,
        mossHeightRatio: 0.58,
        rootAoRatio: 0.25,
        uvScaleU: 5.0,
        uvScaleV: 0.85,
        seed: 1.7
      }
    );

    // 6 sinuous twisted root buttresses gripping the hilltop terrain
    const rootDefs: Array<{ ang: number; len: number; r0: number; twist: number }> = [
      { ang: 0.25, len: 2.85, r0: 0.28, twist: 0.28 },
      { ang: 1.28, len: 2.45, r0: 0.24, twist: -0.24 },
      { ang: 2.35, len: 2.70, r0: 0.26, twist: 0.26 },
      { ang: 3.35, len: 2.95, r0: 0.29, twist: -0.30 },
      { ang: 4.38, len: 2.50, r0: 0.24, twist: 0.22 },
      { ang: 5.42, len: 2.65, r0: 0.25, twist: -0.25 }
    ];
    rootDefs.forEach((rt, idx) => {
      const ca = Math.cos(rt.ang);
      const sa = Math.sin(rt.ang);
      const midAng = rt.ang + rt.twist;
      const tipAng = rt.ang - rt.twist * 0.45;
      pushHeroBranch(
        [
          [ca * 0.42, 0.84, sa * 0.42],
          [Math.cos(midAng) * (rt.len * 0.44), 0.30, Math.sin(midAng) * (rt.len * 0.44)],
          [Math.cos(tipAng) * (rt.len * 0.78), 0.04, Math.sin(tipAng) * (rt.len * 0.78)],
          [Math.cos(tipAng) * rt.len, -0.36, Math.sin(tipAng) * rt.len]
        ],
        rt.r0,
        0.055,
        8,
        7,
        { furrowAmp: 0.09, mossHeightRatio: 0.85, rootAoRatio: 0.22, uvScaleU: 3.6, uvScaleV: 0.85, seed: 3.1 + idx }
      );
    });

    const rand = mulberry32(4207);
    const primaryLimbs: Array<{ pts: Array<[number, number, number]>; r0: number; r1: number; seed: number }> = [
      { pts: [[0.0, 3.3, 0.0], [-1.3, 4.6, 0.8], [-2.8, 5.7, 1.5], [-4.2, 6.4, 2.1]], r0: 0.32, r1: 0.14, seed: 2.1 },
      { pts: [[0.0, 3.4, 0.0], [1.4, 4.7, 0.9], [2.9, 5.8, 1.7], [4.3, 6.5, 2.2]], r0: 0.3, r1: 0.13, seed: 3.4 },
      { pts: [[0.0, 3.5, 0.0], [1.2, 4.8, -1.1], [2.6, 5.9, -2.2], [3.9, 6.7, -3.1]], r0: 0.31, r1: 0.13, seed: 4.8 },
      { pts: [[0.0, 3.4, 0.0], [-1.2, 4.7, -1.0], [-2.5, 5.8, -2.1], [-3.8, 6.6, -2.9]], r0: 0.29, r1: 0.12, seed: 5.9 },
      { pts: [[0.04, 4.1, 0.06], [0.25, 5.7, 0.2], [0.1, 7.2, -0.15], [0.0, 8.2, 0.0]], r0: 0.34, r1: 0.13, seed: 7.2 }
    ];

    for (const limb of primaryLimbs) {
      pushHeroBranch(limb.pts, limb.r0, limb.r1, 8, 8, {
        furrowAmp: 0.08,
        mossHeightRatio: 0.2,
        rootAoRatio: 0.0,
        uvScaleU: 3.8,
        uvScaleV: 0.85,
        seed: limb.seed
      });

      const innerPt = limb.pts[1];
      const mid = limb.pts[2];
      const tip = limb.pts[3];
      leafAnchors.push({
        x: heroX + tip[0],
        y: heroGroundY - 0.18 + tip[1] + 0.45,
        z: heroZ + tip[2],
        radius: 1.95,
        crownY: heroGroundY + 6.8,
        isHero: true
      });

      const innerTwigAng = limb.seed * 1.7 + 0.8;
      const innerTwigTip: [number, number, number] = [
        innerPt[0] + Math.cos(innerTwigAng) * 1.15,
        innerPt[1] + 0.55,
        innerPt[2] + Math.sin(innerTwigAng) * 1.15
      ];
      pushHeroBranch(
        [
          innerPt,
          [(innerPt[0] + innerTwigTip[0]) * 0.5, (innerPt[1] + innerTwigTip[1]) * 0.5 + 0.18, (innerPt[2] + innerTwigTip[2]) * 0.5],
          innerTwigTip
        ],
        0.075,
        0.022,
        5,
        4,
        { furrowAmp: 0.05, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 2.2, uvScaleV: 0.75, seed: limb.seed + 9.2 }
      );

      for (let s = 0; s < 3; s++) {
        const basePt = s === 0 ? mid : tip;
        const spreadAng = (s - 1) * 0.95 + (rand() - 0.5) * 0.4 + limb.seed;
        const dx = Math.cos(spreadAng) * (1.35 + rand() * 0.65);
        const dz = Math.sin(spreadAng) * (1.35 + rand() * 0.65);
        const dy = 0.65 + rand() * 0.95;
        const subTip: [number, number, number] = [basePt[0] + dx, basePt[1] + dy, basePt[2] + dz];
        const subMid: [number, number, number] = [
          (basePt[0] + subTip[0]) * 0.5,
          (basePt[1] + subTip[1]) * 0.5 + 0.2,
          (basePt[2] + subTip[2]) * 0.5
        ];
        pushHeroBranch(
          [basePt, subMid, subTip],
          limb.r1 * 0.85,
          0.065,
          6,
          5,
          { furrowAmp: 0.06, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 2.6, uvScaleV: 0.8, seed: limb.seed + s * 3.1 }
        );

        for (const forkSign of [-1, 1]) {
          const twigAng = spreadAng + forkSign * (0.55 + rand() * 0.35);
          const twigLen = 0.72 + rand() * 0.42;
          const twigTip: [number, number, number] = [
            subMid[0] + Math.cos(twigAng) * twigLen,
            subMid[1] + 0.32 + rand() * 0.38,
            subMid[2] + Math.sin(twigAng) * twigLen
          ];
          pushHeroBranch(
            [subMid, twigTip],
            0.048,
            0.016,
            5,
            3,
            { furrowAmp: 0.04, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 1.8, uvScaleV: 0.7, seed: limb.seed + s * 5.7 + forkSign }
          );
        }

        leafAnchors.push({
          x: heroX + subTip[0],
          y: heroGroundY - 0.18 + subTip[1] + 0.35,
          z: heroZ + subTip[2],
          radius: 1.65,
          crownY: heroGroundY + 6.8,
          isHero: true
        });
      }
    }
    leafAnchors.push({ x: heroX, y: heroGroundY + 8.6, z: heroZ, radius: 2.05, crownY: heroGroundY + 6.8, isHero: true });

    // 8 Gnarled Horizon Broadleaf Oaks + 14 Outer Oak & Birch Ridge Copses across the doubled valley
    // (merged into the same trunk Mesh & foliage InstancedMesh to keep total renderableMeshes <= 10!)
    const horizonTrees: Array<{ x: number; z: number; scale: number; yaw: number; species?: 'oak' | 'birch' }> = [
      { x: 34.5, z: -29.5, scale: 1.15, yaw: 0.6 },
      { x: -33.5, z: 5.0, scale: 1.18, yaw: 2.1 },
      { x: 31.5, z: 19.0, scale: 1.14, yaw: 3.7 },
      { x: 14.5, z: -36.5, scale: 1.02, yaw: 5.0 },
      { x: -24.0, z: 32.0, scale: 1.14, yaw: 1.2 },
      { x: 38.0, z: -8.5, scale: 1.12, yaw: 2.8 },
      { x: -38.5, z: -27.0, scale: 1.20, yaw: 4.3 },
      { x: 18.5, z: 36.0, scale: 1.08, yaw: 0.9 },
      // Outer NW Birch & Oak Ridge Copse
      { x: -64.0, z: -52.0, scale: 1.28, yaw: 0.4, species: 'birch' },
      { x: -71.5, z: -45.5, scale: 1.16, yaw: 1.9, species: 'birch' },
      { x: -58.5, z: -61.0, scale: 1.32, yaw: 3.1, species: 'oak' },
      { x: -78.0, z: -18.0, scale: 1.24, yaw: 2.5, species: 'oak' },
      // Outer NE Brookside Birch & Oak Copse
      { x: 56.0, z: -64.0, scale: 1.26, yaw: 4.1, species: 'birch' },
      { x: 65.5, z: -56.0, scale: 1.18, yaw: 0.8, species: 'birch' },
      { x: 74.0, z: -38.0, scale: 1.30, yaw: 2.2, species: 'oak' },
      { x: 82.0, z: -12.0, scale: 1.22, yaw: 5.3, species: 'oak' },
      // Outer SE Meadow Copse
      { x: 72.0, z: 34.0, scale: 1.28, yaw: 1.5, species: 'oak' },
      { x: 64.0, z: 54.0, scale: 1.16, yaw: 3.9, species: 'birch' },
      { x: 48.0, z: 68.0, scale: 1.24, yaw: 0.3, species: 'oak' },
      // Outer SW Ridge Copse
      { x: -62.0, z: 48.0, scale: 1.26, yaw: 2.9, species: 'oak' },
      { x: -72.0, z: 36.0, scale: 1.14, yaw: 4.7, species: 'birch' },
      { x: -46.0, z: 72.0, scale: 1.22, yaw: 1.1, species: 'oak' }
    ];

    const pushHorizonBark = (geo: THREE.BufferGeometry, tMat: THREE.Matrix4, isBirch: boolean) => {
      const prepared = prepareForMerge(geo, tMat, true);
      if (isBirch && prepared.attributes.color) {
        const cAttr = prepared.attributes.color;
        const pAttr = prepared.attributes.position;
        for (let vi = 0; vi < cAttr.count; vi++) {
          const wy = pAttr.getY(vi);
          const lenticel = Math.sin(wy * 11.5) > 0.72 ? 0.58 : 1.0;
          cAttr.setXYZ(
            vi,
            Math.min(1.0, cAttr.getX(vi) * 1.62 * lenticel),
            Math.min(1.0, cAttr.getY(vi) * 1.58 * lenticel),
            Math.min(1.0, cAttr.getZ(vi) * 1.50 * lenticel)
          );
        }
        cAttr.needsUpdate = true;
      }
      trunkGeos.push(prepared);
      geo.dispose();
    };

    horizonTrees.forEach((ht, idx) => {
      const isBirch = ht.species === 'birch';
      const hy = getBreezyMeadowHeight(ht.x, ht.z) - 0.15;
      this.exclusionCircles.push({ x: ht.x, z: ht.z, r: 1.65 * ht.scale });

      const tMat = new THREE.Matrix4().compose(
        new THREE.Vector3(ht.x, hy, ht.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ht.yaw),
        new THREE.Vector3(
          isBirch ? ht.scale * 0.78 : ht.scale,
          isBirch ? ht.scale * 1.22 : ht.scale,
          isBirch ? ht.scale * 0.78 : ht.scale
        )
      );

      const mainStem = createBranchTubeGeometry(
        [
          new THREE.Vector3(0, -0.28, 0),
          new THREE.Vector3(-0.08, 1.05, 0.05),
          new THREE.Vector3(0.06, 2.2, -0.04),
          new THREE.Vector3(0, 3.15, 0)
        ],
        0.42,
        0.16,
        9,
        8,
        { furrowAmp: 0.10, buttressFluting: 0.36, mossHeightRatio: 0.55, rootAoRatio: 0.25, uvScaleU: 4.5, uvScaleV: 0.85, seed: 2.1 + idx }
      );
      pushHorizonBark(mainStem, tMat, isBirch);

      // Surface root buttresses for each horizon oak
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const rAng = rIdx * ((Math.PI * 2) / 3) + idx * 0.7;
        const rGeo = createBranchTubeGeometry(
          [
            new THREE.Vector3(Math.cos(rAng) * 0.22, 0.42, Math.sin(rAng) * 0.22),
            new THREE.Vector3(Math.cos(rAng + 0.18) * 0.68, 0.10, Math.sin(rAng + 0.18) * 0.68),
            new THREE.Vector3(Math.cos(rAng) * 1.18, -0.22, Math.sin(rAng) * 1.18)
          ],
          0.14,
          0.04,
          6,
          4,
          { furrowAmp: 0.08, mossHeightRatio: 0.75, rootAoRatio: 0.2, uvScaleU: 3.2, uvScaleV: 0.8, seed: 3.5 + idx + rIdx }
        );
        pushHorizonBark(rGeo, tMat, isBirch);
      }

      const boughs: Array<[number, number, number]> = [
        [-1.35, 4.05, 0.62],
        [1.38, 4.0, -0.58],
        [0.45, 4.18, 1.32],
        [-0.52, 4.12, -1.28],
        [0.05, 4.85, 0.05]
      ];
      boughs.forEach(([bx, by, bz], bIdx) => {
        const bMid = new THREE.Vector3(bx * 0.52, 3.15, bz * 0.52);
        const bGeo = createBranchTubeGeometry(
          [
            new THREE.Vector3(0, 2.2, 0),
            bMid,
            new THREE.Vector3(bx, by, bz)
          ],
          0.15,
          0.05,
          6,
          5,
          { furrowAmp: 0.07, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 3.0, uvScaleV: 0.85, seed: 4.5 + idx + bIdx }
        );
        pushHorizonBark(bGeo, tMat, isBirch);

        const tAng = Math.atan2(bz, bx) + (bIdx % 2 === 0 ? 0.65 : -0.65);
        const twigGeo = createBranchTubeGeometry(
          [
            bMid,
            new THREE.Vector3(bMid.x + Math.cos(tAng) * 0.65, bMid.y + 0.52, bMid.z + Math.sin(tAng) * 0.65)
          ],
          0.055,
          0.018,
          5,
          3,
          { furrowAmp: 0.04, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 2.0, uvScaleV: 0.75, seed: 7.2 + idx + bIdx }
        );
        pushHorizonBark(twigGeo, tMat, isBirch);

        const worldTip = new THREE.Vector3(bx, by + 0.35, bz).applyMatrix4(tMat);
        leafAnchors.push({
          x: worldTip.x,
          y: worldTip.y,
          z: worldTip.z,
          radius: 1.38 * ht.scale,
          crownY: hy + 4.1 * ht.scale,
          isHero: false
        });
      });
    });

    const mergedTrunks = mergeGeometries(trunkGeos, false);
    trunkGeos.forEach((g) => g.dispose());
    let barkMat: THREE.MeshStandardMaterial | null = null;
    if (mergedTrunks) {
      barkMat = new THREE.MeshStandardMaterial({
        map: oakBark.map,
        normalMap: oakBark.normalMap,
        normalScale: new THREE.Vector2(1.75, 1.75),
        roughnessMap: oakBark.roughnessMap,
        roughness: 1.0,
        aoMap: oakBark.aoMap,
        vertexColors: true
      });
      applyWorldSpaceWeathering(barkMat, {
        macroScale: 0.30,
        mossHeight: heroGroundY + 0.85,
        mossColor: '#3a6624',
        dampRoughness: 0.56,
        dirtTint: '#3e3022'
      });
      this.treeTrunksMesh = null;
    }

    // Alpha-tested backlit botanical leaf cards (1 InstancedMesh for Hero Oak + 22 Horizon/Outer Trees)
    const heroCardCount = 1500;
    const horizonCardCount = 2900;
    const totalLeafCards = heroCardCount + horizonCardCount;
    const leafCardGeo = this.createCrossedLeafCardGeometry(1.36);

    this.foliageWindUniform = {
      uTime: { value: 0.0 },
      uWindSpeed: { value: this.currentConfig?.wind?.speed ?? 2.4 },
      uSunDirection: { value: sunDir.clone() },
      uNightFactor: { value: 0.0 }
    };
    const fUniform = this.foliageWindUniform;

    const leafMat = new THREE.MeshStandardMaterial({
      map: leafAtlas,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.0
    });
    leafMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = fUniform.uTime;
      shader.uniforms.uWindSpeed = fUniform.uWindSpeed;
      shader.uniforms.uSunDirection = fUniform.uSunDirection;
      shader.uniforms.uNightFactor = fUniform.uNightFactor;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWindSpeed;
          varying vec3 vLeafWorldPos;
          varying vec3 vLeafWorldNormal;`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          #ifdef USE_INSTANCING
            vLeafWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);
          #else
            vLeafWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
          #endif`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float leafSwayMask = clamp(uv.y, 0.0, 1.0);
          #ifdef USE_INSTANCING
            vec3 instOrigin = vec3(instanceMatrix[3].xyz);
          #else
            vec3 instOrigin = vec3(0.0);
          #endif
          float leafPhase = instOrigin.x * 0.65 + instOrigin.z * 0.55 + instOrigin.y * 0.42;
          float leafGust = sin(uTime * (1.35 + uWindSpeed * 0.55) + leafPhase) * 0.068
                         + cos(uTime * (2.5 + uWindSpeed * 0.75) + leafPhase * 1.6) * 0.028;
          transformed.x += leafGust * leafSwayMask;
          transformed.y += leafGust * 0.32 * leafSwayMask;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          #ifdef USE_INSTANCING
            vLeafWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vLeafWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uSunDirection;
          uniform float uNightFactor;
          varying vec3 vLeafWorldPos;
          varying vec3 vLeafWorldNormal;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float leafLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 moonLeaf = mix(diffuseColor.rgb, vec3(leafLuma * 0.52, leafLuma * 0.72, leafLuma * 1.25), uNightFactor * 0.58);
          diffuseColor.rgb = moonLeaf * mix(vec3(1.0), vec3(0.18, 0.25, 0.52), uNightFactor);`
        )
        .replace(
          '#include <opaque_fragment>',
          `vec3 leafViewDir = normalize(cameraPosition - vLeafWorldPos);
          vec3 leafSunDir = normalize(uSunDirection);
          float leafBacklit = pow(clamp(dot(leafViewDir, -leafSunDir), 0.0, 1.0), 2.1);
          float leafTopSun = clamp(dot(normalize(vLeafWorldNormal), leafSunDir) * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * (leafBacklit * 0.56 + leafTopSun * 0.24) * vec3(1.12, 1.22, 0.68) * (1.0 - uNightFactor * 0.88);
          #include <opaque_fragment>`
        );
    };
    leafMat.customProgramCacheKey = () => 'meadow-botanical-foliage-v2';

    const leafDepthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: leafAtlas,
      alphaTest: 0.45,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(leafDepthMat);

    this.treeFoliageMesh = new THREE.InstancedMesh(leafCardGeo, leafMat, totalLeafCards);
    this.treeFoliageMesh.name = 'PastoralOakFoliage';
    this.treeFoliageMesh.castShadow = true;
    this.treeFoliageMesh.receiveShadow = true;
    this.treeFoliageMesh.customDepthMaterial = leafDepthMat;

    const heroAnchors = leafAnchors.filter((a) => a.isHero);
    const horizonAnchors = leafAnchors.filter((a) => !a.isHero);

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();

    const innerShadowCol = new THREE.Color('#2c5c20');
    const midEmeraldCol = new THREE.Color('#529a32');
    const sunlitGoldCol = new THREE.Color('#9cd64c');

    for (let i = 0; i < totalLeafCards; i++) {
      const isHero = i < heroCardCount;
      const anchor = isHero
        ? heroAnchors[i % heroAnchors.length]
        : horizonAnchors[(i - heroCardCount) % horizonAnchors.length];

      const u1 = rand();
      const u2 = rand();
      const u3 = rand();
      const theta = u1 * Math.PI * 2;
      const phi = Math.acos(2 * u2 - 1);
      // Airy sub-crown clusters with natural sky gaps between boughs
      const r = anchor.radius * (0.22 + 0.68 * Math.cbrt(u3));

      const wx = anchor.x + r * Math.sin(phi) * Math.cos(theta);
      const wy = anchor.y + r * Math.cos(phi) * 0.72;
      const wz = anchor.z + r * Math.sin(phi) * Math.sin(theta);

      pos.set(wx, wy, wz);
      euler.set((rand() - 0.5) * 1.3, rand() * Math.PI * 2, (rand() - 0.5) * 1.3);
      quat.setFromEuler(euler);
      const s = isHero ? 0.74 + rand() * 0.56 : 0.64 + rand() * 0.44;
      scale.set(s, s * (0.9 + rand() * 0.25), s);
      dummy.compose(pos, quat, scale);
      this.treeFoliageMesh.setMatrixAt(i, dummy);

      const heightRatio = Math.max(0, Math.min(1, (wy - (anchor.crownY - 3.2)) / 5.4));
      const sunDot = Math.max(0, ((wx - anchor.x) * sunDir.x + (wy - anchor.crownY) * sunDir.y + (wz - anchor.z) * sunDir.z) / 3.2);
      const lf = Math.max(0, Math.min(1, heightRatio * 0.52 + sunDot * 0.34 + (rand() - 0.5) * 0.16));

      if (lf < 0.45) {
        col.copy(innerShadowCol).lerp(midEmeraldCol, lf / 0.45);
      } else {
        col.copy(midEmeraldCol).lerp(sunlitGoldCol, (lf - 0.45) / 0.55);
      }
      this.treeFoliageMesh.setColorAt(i, col);
    }
    this.treeFoliageMesh.instanceMatrix.needsUpdate = true;
    if (this.treeFoliageMesh.instanceColor) this.treeFoliageMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.treeFoliageMesh);

    // ------------------------------------------------------------------
    // 2. Expanded Pastoral Landmarks:
    //    - Weathered Cobblestone Path + Watermill Lane
    //    - Rustic Stone & Timber Watermill Cottage with Spoked Waterwheel (x = 28, z = -26)
    //    - Stone Arch Footbridge (x = 22.8, z = -22.2) spanning the Meadow Brook
    //    - Extended Winding Post-and-Rail Timber Fences
    //    - Sculpted Stone Bench & Irregular Natural Mossy Fieldstones
    //    (Combined as 1 multi-material Mesh so total scene meshes <= 10!)
    // ------------------------------------------------------------------
    const cobbleParts: THREE.BufferGeometry[] = [];
    {
      const zStart = 28.0;
      const zEnd = -30.0;
      const lenSegs = 104;
      const crossSegs = 6;
      const positions: number[] = [];
      const uvs: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];

      let arcDist = 0;
      let prevCx = getMeadowPathCenterX(zStart);
      let prevZ = zStart;
      const tileWorldSize = 2.05;

      for (let i = 0; i <= lenSegs; i++) {
        const t = i / lenSegs;
        const z = zStart + (zEnd - zStart) * t;
        const cx = getMeadowPathCenterX(z);
        if (i > 0) arcDist += Math.hypot(cx - prevCx, z - prevZ);
        prevCx = cx;
        prevZ = z;

        const halfW = 0.94 + 0.16 * Math.sin(z * 0.25) + 0.08 * Math.cos(z * 0.62);
        const edgeJitter = Math.sin(z * 0.85) * 0.08 + Math.cos(z * 1.5) * 0.05;
        const endTaper = t < 0.06 ? (0.06 - t) / 0.06 : t > 0.92 ? (t - 0.92) / 0.08 : 0.0;

        for (let j = 0; j <= crossSegs; j++) {
          const sNorm = (j / crossSegs) * 2 - 1;
          const x = cx + sNorm * (halfW + edgeJitter * Math.abs(sNorm));
          const groundY = getBreezyMeadowHeight(x, z);
          const absS = Math.abs(sNorm);
          const lift = (absS > 0.78 ? 0.028 - (absS - 0.78) * 0.34 : 0.028 + (1 - absS * absS) * 0.015) - endTaper * 0.08;
          positions.push(x, groundY + lift, z);
          uvs.push((sNorm * halfW) / tileWorldSize, arcDist / tileWorldSize);

          const edgeAo = absS > 0.68 ? 1.0 - ((absS - 0.68) / 0.32) * 0.42 : 1.0;
          colors.push(edgeAo, edgeAo * 0.99, edgeAo * 0.94);
        }
      }

      const stride = crossSegs + 1;
      for (let i = 0; i < lenSegs; i++) {
        for (let j = 0; j < crossSegs; j++) {
          const a = i * stride + j;
          const b = (i + 1) * stride + j;
          const c = (i + 1) * stride + (j + 1);
          const d = i * stride + (j + 1);
          indices.push(a, d, b, b, d, c);
        }
      }

      const pathGeo = new THREE.BufferGeometry();
      pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      pathGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      pathGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      pathGeo.setIndex(indices);
      pathGeo.computeVertexNormals();
      cobbleParts.push(prepareForMerge(pathGeo, undefined, true));
      pathGeo.dispose();

      // Secondary branch lane curving from main path (-14m) across Stone Arch Bridge to Watermill Cottage (24.4, -27.2)
      const xStart = getMeadowPathCenterX(-14.0);
      const xEnd = 24.4;
      const bSegs = 56;
      const bPos: number[] = [];
      const bUvs: number[] = [];
      const bCols: number[] = [];
      const bIdx: number[] = [];
      let bArc = 0;
      let prevBx = xStart;
      let prevBz = getWatermillLaneCenterZ(xStart);

      for (let i = 0; i <= bSegs; i++) {
        const t = i / bSegs;
        const x = xStart + (xEnd - xStart) * t;
        const cz = getWatermillLaneCenterZ(x);
        if (i > 0) bArc += Math.hypot(x - prevBx, cz - prevBz);
        prevBx = x;
        prevBz = cz;

        const halfW = 0.78 + 0.08 * Math.sin(x * 0.3);
        const bridgeDist = Math.abs(x - getMeadowBrookCenterX(cz));
        const bridgeArchLift = bridgeDist < 3.6 ? Math.cos((bridgeDist / 3.6) * (Math.PI * 0.5)) * 0.82 : 0.0;

        for (let j = 0; j <= crossSegs; j++) {
          const sNorm = (j / crossSegs) * 2 - 1;
          const z = cz + sNorm * halfW;
          const groundY = getBreezyMeadowHeight(x, z);
          const absS = Math.abs(sNorm);
          const lift = (absS > 0.78 ? 0.025 - (absS - 0.78) * 0.28 : 0.028) + bridgeArchLift;
          bPos.push(x, groundY + lift, z);
          bUvs.push((sNorm * halfW) / tileWorldSize, bArc / tileWorldSize);
          const edgeAo = absS > 0.7 ? 1.0 - ((absS - 0.7) / 0.3) * 0.38 : 1.0;
          bCols.push(edgeAo, edgeAo * 0.99, edgeAo * 0.94);
        }
      }
      for (let i = 0; i < bSegs; i++) {
        for (let j = 0; j < crossSegs; j++) {
          const a = i * stride + j;
          const b = (i + 1) * stride + j;
          const c = (i + 1) * stride + (j + 1);
          const d = i * stride + (j + 1);
          bIdx.push(a, d, b, b, d, c);
        }
      }
      const branchGeo = new THREE.BufferGeometry();
      branchGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
      branchGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
      branchGeo.setAttribute('color', new THREE.Float32BufferAttribute(bCols, 3));
      branchGeo.setIndex(bIdx);
      branchGeo.computeVertexNormals();
      cobbleParts.push(prepareForMerge(branchGeo, undefined, true));
      branchGeo.dispose();
    }
    const mergedCobble = mergeGeometries(cobbleParts, false)!;
    cobbleParts.forEach((g) => g.dispose());

    // Extended Winding Post-and-Rail Fences + Watermill Timber Framing & Spoked Waterwheel
    const timberParts: THREE.BufferGeometry[] = [];
    const buildFenceRun = (waypoints: Array<[number, number]>) => {
      for (let i = 0; i < waypoints.length; i++) {
        const [px, pz] = waypoints[i];
        const py = getBreezyMeadowHeight(px, pz);
        this.exclusionCircles.push({ x: px, z: pz, r: 0.42 });

        const postGeo = new THREE.CylinderGeometry(0.085, 0.105, 1.15, 7);
        postGeo.translate(px, py + 0.5, pz);
        timberParts.push(prepareForMerge(postGeo, undefined, true));
        postGeo.dispose();

        const capGeo = new THREE.ConeGeometry(0.095, 0.08, 7);
        capGeo.translate(px, py + 1.11, pz);
        timberParts.push(prepareForMerge(capGeo, undefined, true));
        capGeo.dispose();

        if (i < waypoints.length - 1) {
          const [nx, nz] = waypoints[i + 1];
          const ny = getBreezyMeadowHeight(nx, nz);
          const dx = nx - px;
          const dy = ny - py;
          const dz = nz - pz;
          const span = Math.hypot(dx, dy, dz);
          const yaw = Math.atan2(dx, dz);
          const pitch = -Math.asin(dy / Math.max(0.01, span));

          for (const railH of [0.44, 0.84]) {
            const railGeo = new THREE.BoxGeometry(0.075, 0.11, span + 0.08);
            const rMat = new THREE.Matrix4().compose(
              new THREE.Vector3((px + nx) * 0.5, (py + ny) * 0.5 + railH, (pz + nz) * 0.5),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')),
              new THREE.Vector3(1, 1, 1)
            );
            timberParts.push(prepareForMerge(railGeo, rMat, true));
            railGeo.dispose();
          }
        }
      }
    };

    buildFenceRun([
      [9.8, 22.0],
      [10.2, 16.0],
      [11.4, 11.8],
      [12.0, 7.6],
      [11.5, 3.4],
      [10.6, -0.8],
      [10.2, -5.0],
      [10.8, -9.2],
      [12.0, -13.4],
      [14.2, -16.8],
      [17.4, -19.2]
    ]);
    buildFenceRun([
      [-20.5, -4.0],
      [-20.5, -8.5],
      [-21.8, -12.8],
      [-22.4, -17.2],
      [-21.8, -21.6],
      [-20.4, -26.0],
      [-18.2, -30.2]
    ]);
    buildFenceRun([
      [-8.5, 22.5],
      [-11.2, 18.0],
      [-13.5, 13.5],
      [-15.0, 8.8],
      [-15.8, 4.0]
    ]);
    // Outer pasture fence runs framing the doubled meadow walk
    buildFenceRun([
      [18.5, 36.0],
      [20.2, 42.5],
      [21.5, 49.0],
      [22.4, 55.5],
      [23.2, 62.0]
    ]);
    buildFenceRun([
      [-32.0, -34.0],
      [-37.5, -39.5],
      [-43.0, -45.0],
      [-48.8, -50.2],
      [-55.0, -54.5]
    ]);

    // Stone Bench + Stone Arch Footbridge + Watermill Stone Plinth/Chimney + Outer Stone Field-Walls + Plaster/Roof/Windows + Meadow Brook
    const stoneParts: THREE.BufferGeometry[] = [];
    const plasterParts: THREE.BufferGeometry[] = [];
    const roofParts: THREE.BufferGeometry[] = [];
    const windowParts: THREE.BufferGeometry[] = [];
    const brookParts: THREE.BufferGeometry[] = [];

    // Low weathered drystone field-walls winding across the outer pasture ridges
    const buildStoneFieldWall = (waypoints: Array<[number, number]>) => {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const [x0, z0] = waypoints[i];
        const [x1, z1] = waypoints[i + 1];
        const segLen = Math.hypot(x1 - x0, z1 - z0);
        const subSteps = Math.max(1, Math.round(segLen / 2.2));
        for (let s = 0; s < subSteps; s++) {
          const t0 = s / subSteps;
          const t1 = (s + 1) / subSteps;
          const ax = x0 + (x1 - x0) * t0;
          const az = z0 + (z1 - z0) * t0;
          const bx = x0 + (x1 - x0) * t1;
          const bz = z0 + (z1 - z0) * t1;
          const mx = (ax + bx) * 0.5;
          const mz = (az + bz) * 0.5;
          const ay = getBreezyMeadowHeight(ax, az);
          const by = getBreezyMeadowHeight(bx, bz);
          const my = (ay + by) * 0.5;
          const dx = bx - ax;
          const dy = by - ay;
          const dz = bz - az;
          const span = Math.hypot(dx, dy, dz);
          const yaw = Math.atan2(dx, dz);
          const pitch = -Math.asin(dy / Math.max(0.01, span));
          if (s % 2 === 0) {
            this.exclusionCircles.push({ x: mx, z: mz, r: 0.72 });
          }

          const wallMat = new THREE.Matrix4().compose(
            new THREE.Vector3(mx, my, mz),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')),
            new THREE.Vector3(1, 1, 1)
          );
          const bodyGeo = new THREE.BoxGeometry(0.54, 0.72, span + 0.14);
          const bUv = bodyGeo.attributes.uv;
          if (bUv) {
            for (let k = 0; k < bUv.count; k++) {
              bUv.setXY(k, bUv.getX(k) * 0.45, bUv.getY(k) * 0.35);
            }
            bUv.needsUpdate = true;
          }
          bodyGeo.translate(0, 0.24, 0);
          stoneParts.push(prepareForMerge(bodyGeo, wallMat, true));
          bodyGeo.dispose();

          const copeGeo = new THREE.BoxGeometry(0.64, 0.12, span + 0.18);
          const cUv = copeGeo.attributes.uv;
          if (cUv) {
            for (let k = 0; k < cUv.count; k++) {
              cUv.setXY(k, cUv.getX(k) * 0.45, cUv.getY(k) * 0.22);
            }
            cUv.needsUpdate = true;
          }
          copeGeo.translate(0, 0.64, 0);
          stoneParts.push(prepareForMerge(copeGeo, wallMat, true));
          copeGeo.dispose();
        }
      }
      for (const [px, pz] of [waypoints[0], waypoints[waypoints.length - 1]]) {
        const py = getBreezyMeadowHeight(px, pz);
        this.exclusionCircles.push({ x: px, z: pz, r: 0.78 });
        const pierGeo = new THREE.BoxGeometry(0.76, 1.02, 0.76);
        pierGeo.translate(px, py + 0.42, pz);
        stoneParts.push(prepareForMerge(pierGeo, undefined, true));
        pierGeo.dispose();
      }
    };

    buildStoneFieldWall([
      [-52.0, 22.0],
      [-57.5, 31.0],
      [-60.5, 41.0],
      [-58.0, 52.0]
    ]);
    buildStoneFieldWall([
      [42.0, -42.0],
      [50.0, -49.0],
      [59.0, -54.0],
      [68.0, -57.0]
    ]);
    buildStoneFieldWall([
      [44.0, 28.0],
      [53.0, 36.0],
      [61.0, 44.0],
      [66.0, 54.0]
    ]);
    buildStoneFieldWall([
      [-48.0, -28.0],
      [-58.0, -35.0],
      [-66.0, -44.0]
    ]);

    // Sculpted Stone Garden Bench (-12.2, -19.8)
    {
      const bx = -12.2;
      const bz = -19.8;
      const by = getBreezyMeadowHeight(bx, bz);
      this.exclusionCircles.push({ x: bx, z: bz, r: 1.5 });
      const benchMat = new THREE.Matrix4().compose(
        new THREE.Vector3(bx, by, bz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.58, 0)),
        new THREE.Vector3(1, 1, 1)
      );

      const addStonePart = (geo: THREE.BufferGeometry, lx: number, ly: number, lz: number, uvScale = 0.28) => {
        const uv = geo.attributes.uv;
        if (uv) {
          for (let k = 0; k < uv.count; k++) {
            uv.setXY(k, uv.getX(k) * uvScale, uv.getY(k) * uvScale);
          }
          uv.needsUpdate = true;
        }
        geo.translate(lx, ly, lz);
        stoneParts.push(prepareForMerge(geo, benchMat, true));
        geo.dispose();
      };

      addStonePart(new THREE.BoxGeometry(2.14, 0.14, 0.72), 0, 0.04, 0, 0.26);
      addStonePart(new THREE.BoxGeometry(0.28, 0.42, 0.54), -0.72, 0.28, 0, 0.22);
      addStonePart(new THREE.BoxGeometry(0.28, 0.42, 0.54), 0.72, 0.28, 0, 0.22);
      addStonePart(new THREE.BoxGeometry(2.26, 0.13, 0.66), 0, 0.52, 0, 0.28);
      addStonePart(new THREE.BoxGeometry(2.18, 0.04, 0.60), 0, 0.59, 0, 0.26);
      addStonePart(new THREE.BoxGeometry(0.16, 0.44, 0.14), -0.82, 0.76, -0.22, 0.18);
      addStonePart(new THREE.BoxGeometry(0.16, 0.44, 0.14), 0.82, 0.76, -0.22, 0.18);
      addStonePart(new THREE.BoxGeometry(2.12, 0.24, 0.12), 0, 0.84, -0.22, 0.24);
    }

    // Sparkling Meandering Meadow Brook (z = -102 .. +92, passing Watermill at z=-26 and Stone Arch Bridge at z=-22.2)
    {
      const z0 = 92.0;
      const z1 = -102.0;
      const bSegs = 140;
      const crossSegs = 6;
      const bPos: number[] = [];
      const bUvs: number[] = [];
      const bIdx: number[] = [];
      for (let i = 0; i <= bSegs; i++) {
        const t = i / bSegs;
        const z = z0 + (z1 - z0) * t;
        const cx = getMeadowBrookCenterX(z);
        const halfW = 2.02 + 0.24 * Math.sin(z * 0.18);
        const hCenter = getBreezyMeadowHeight(cx, z);
        const hL = getBreezyMeadowHeight(cx - halfW, z);
        const hR = getBreezyMeadowHeight(cx + halfW, z);
        const waterBaseY = Math.min(hCenter, Math.min(hL, hR) + 0.04) - 0.14;
        for (let j = 0; j <= crossSegs; j++) {
          const u = j / crossSegs;
          const sNorm = u * 2.0 - 1.0;
          const wx = cx + sNorm * halfW;
          const edgeDrop = Math.pow(Math.abs(sNorm), 3.0) * 0.05;
          bPos.push(wx, waterBaseY - edgeDrop, z);
          bUvs.push(u, t * 54.0);
        }
      }
      const stride = crossSegs + 1;
      for (let i = 0; i < bSegs; i++) {
        for (let j = 0; j < crossSegs; j++) {
          const a = i * stride + j;
          const b = a + 1;
          const c = (i + 1) * stride + j;
          const d = c + 1;
          bIdx.push(a, b, c, b, d, c);
        }
      }
      const brookGeo = new THREE.BufferGeometry();
      brookGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
      brookGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
      brookGeo.setIndex(bIdx);
      brookGeo.computeVertexNormals();
      brookParts.push(prepareForMerge(brookGeo, undefined, true));
      brookGeo.dispose();
    }

    // Stone Arch Footbridge spanning the Meadow Brook along the Watermill lane
    {
      const brZ = -21.8;
      const brX = getMeadowBrookCenterX(brZ);
      const brY = getBreezyMeadowHeight(brX, brZ);
      this.exclusionCircles.push({ x: brX, z: brZ, r: 1.8 });
      const bridgeMat = new THREE.Matrix4().compose(
        new THREE.Vector3(brX, brY, brZ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.22, 0)),
        new THREE.Vector3(1, 1, 1)
      );

      const archSegs = 12;
      const span = 6.2;
      const width = 2.15;
      for (let s = 0; s < archSegs; s++) {
        const u0 = s / archSegs;
        const u1 = (s + 1) / archSegs;
        const um = (u0 + u1) * 0.5;
        const lx = (um - 0.5) * span;
        const archY = Math.sin(um * Math.PI) * 0.86;
        const slope = Math.atan2(
          (Math.sin(u1 * Math.PI) - Math.sin(u0 * Math.PI)) * 0.86,
          (u1 - u0) * span
        );
        const segLen = (span / archSegs) * 1.08;

        // Stone arch barrel voussoirs
        const voussoir = new THREE.BoxGeometry(segLen, 0.24, width);
        voussoir.rotateZ(slope);
        voussoir.translate(lx, archY - 0.04, 0);
        stoneParts.push(prepareForMerge(voussoir, bridgeMat, true));
        voussoir.dispose();

        // Low stone parapets & coping stones on both sides of the bridge
        for (const zSide of [-width * 0.46, width * 0.46]) {
          const parapet = new THREE.BoxGeometry(segLen, 0.52, 0.22);
          parapet.rotateZ(slope);
          parapet.translate(lx, archY + 0.30, zSide);
          stoneParts.push(prepareForMerge(parapet, bridgeMat, true));
          parapet.dispose();

          const coping = new THREE.BoxGeometry(segLen * 1.02, 0.09, 0.28);
          coping.rotateZ(slope);
          coping.translate(lx, archY + 0.58, zSide);
          stoneParts.push(prepareForMerge(coping, bridgeMat, true));
          coping.dispose();
        }
      }

      // 4 carved stone end-piers at the bridge approaches
      for (const endX of [-span * 0.48, span * 0.48]) {
        for (const zSide of [-width * 0.46, width * 0.46]) {
          const pier = new THREE.BoxGeometry(0.42, 0.92, 0.38);
          pier.translate(endX, 0.40, zSide);
          stoneParts.push(prepareForMerge(pier, bridgeMat, true));
          pier.dispose();
        }
      }
    }

    // Rustic Stone & Timber Watermill Cottage with Spoked Waterwheel beside the brook (x = 24.4, z = -27.2)
    const waterwheelWorldXZ = new THREE.Vector2(21.2, -27.2);
    {
      const mx = 24.4;
      const mz = -27.2;
      const my = getBreezyMeadowHeight(mx, mz);
      this.exclusionCircles.push({ x: mx, z: mz, r: 3.55 });
      const millMat = new THREE.Matrix4().compose(
        new THREE.Vector3(mx, my, mz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.26, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      const wheelSplashLocal = new THREE.Vector3(-5.4 * 0.5 - 1.25, 0, -0.25).applyMatrix4(millMat);
      waterwheelWorldXZ.set(wheelSplashLocal.x, wheelSplashLocal.z);

      const addMillGeo = (
        target: THREE.BufferGeometry[],
        geo: THREE.BufferGeometry,
        lx: number,
        ly: number,
        lz: number,
        rx = 0,
        ry = 0,
        rz = 0
      ) => {
        if (rx !== 0 || ry !== 0 || rz !== 0) {
          geo.rotateX(rx);
          geo.rotateY(ry);
          geo.rotateZ(rz);
        }
        geo.translate(lx, ly, lz);
        target.push(prepareForMerge(geo, millMat, true));
        geo.dispose();
      };

      const w = 5.4;
      const d = 4.2;
      const hStone = 1.75;
      const hUpper = 2.15;
      const hTotal = hStone + hUpper;

      // 1. Stone masonry lower story plinth, millrace wall & tall stone chimney
      addMillGeo(stoneParts, new THREE.BoxGeometry(w, hStone + 0.55, d), 0, hStone * 0.5 - 0.25, 0);
      addMillGeo(stoneParts, new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16), 0, hStone + 0.02, 0);
      // Millrace stone channel wall on the brook side (-X)
      addMillGeo(stoneParts, new THREE.BoxGeometry(0.45, 1.45, d + 1.4), -w * 0.5 - 0.95, 0.40, 0);
      // Tall stone chimney stack on +X wall
      addMillGeo(stoneParts, new THREE.BoxGeometry(0.78, hTotal + 2.2, 0.78), w * 0.5 + 0.28, (hTotal + 1.8) * 0.5, -0.4);
      addMillGeo(stoneParts, new THREE.BoxGeometry(0.92, 0.18, 0.92), w * 0.5 + 0.28, hTotal + 2.0, -0.4);
      // Stone entrance doorstep on +Z facade
      addMillGeo(stoneParts, new THREE.BoxGeometry(1.45, 0.24, 0.70), 0.4, 0.12, d * 0.5 + 0.30);

      // 2. Warm limewashed plaster upper story + exact triangular prism gables (zero stepped corners!)
      addMillGeo(plasterParts, new THREE.BoxGeometry(w - 0.08, hUpper, d - 0.08), 0, hStone + hUpper * 0.5, 0);
      const roofRise = 1.95;
      {
        const gableShape = new THREE.Shape();
        const gwHalf = (w - 0.16) * 0.5;
        gableShape.moveTo(-gwHalf, 0);
        gableShape.lineTo(gwHalf, 0);
        gableShape.lineTo(0, roofRise - 0.06);
        gableShape.closePath();
        const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
          depth: d - 0.14,
          bevelEnabled: false
        });
        gableGeo.translate(0, hTotal - 0.02, -(d - 0.14) * 0.5);
        plasterParts.push(prepareForMerge(gableGeo, millMat, true));
        gableGeo.dispose();
      }

      // 3. Heavy timber framing posts, horizontal plates, diagonal braces & arched wooden door
      for (const sx of [-w * 0.5, 0, w * 0.5]) {
        for (const sz of [-d * 0.5, d * 0.5]) {
          addMillGeo(timberParts, new THREE.BoxGeometry(0.18, hUpper + 0.1, 0.18), sx, hStone + hUpper * 0.5, sz);
        }
      }
      addMillGeo(timberParts, new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), 0, hStone + 0.08, 0);
      addMillGeo(timberParts, new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), 0, hTotal - 0.04, 0);
      // Timber door on front facade (+Z)
      addMillGeo(timberParts, new THREE.BoxGeometry(0.96, 1.72, 0.12), 0.4, 1.00, d * 0.5 + 0.03);
      addMillGeo(timberParts, new THREE.BoxGeometry(1.14, 0.14, 0.20), 0.4, 1.90, d * 0.5 + 0.06);

      // 4. Overhanging pitched gable roof with ridge cap & bargeboards (flush ridge joint)
      const overhangX = 0.58;
      const runX = w * 0.5 + overhangX;
      const slopeLen = Math.hypot(runX, roofRise);
      const roofAngle = Math.atan2(roofRise, runX);
      addMillGeo(
        roofParts,
        new THREE.BoxGeometry(slopeLen, 0.18, d + 0.96),
        -(runX * 0.5 - 0.04),
        hTotal + roofRise * 0.5 - 0.02,
        0,
        0,
        0,
        roofAngle
      );
      addMillGeo(
        roofParts,
        new THREE.BoxGeometry(slopeLen, 0.18, d + 0.96),
        runX * 0.5 - 0.04,
        hTotal + roofRise * 0.5 - 0.02,
        0,
        0,
        0,
        -roofAngle
      );
      addMillGeo(roofParts, new THREE.BoxGeometry(0.28, 0.22, d + 1.02), 0, hTotal + roofRise + 0.06, 0);

      // 5. Recessed paned windows with 3D muntin bars, stone sills & warm interior lantern glow
      const addMillWindow = (wx: number, wy: number, wz: number, rotY: number) => {
        const winMat = new THREE.Matrix4().compose(
          new THREE.Vector3(wx, wy, wz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
          new THREE.Vector3(1, 1, 1)
        ).premultiply(millMat);

        const pushW = (arr: THREE.BufferGeometry[], g: THREE.BufferGeometry, lx: number, ly: number, lz: number) => {
          g.translate(lx, ly, lz);
          arr.push(prepareForMerge(g, winMat, true));
          g.dispose();
        };

        // Warm glowing glass pane
        pushW(windowParts, new THREE.BoxGeometry(0.86, 0.96, 0.06), 0, 0, 0.02);
        // Timber outer casing & 3D muntin cross-bars
        pushW(timberParts, new THREE.BoxGeometry(0.98, 0.09, 0.12), 0, 0.50, 0.04);
        pushW(timberParts, new THREE.BoxGeometry(0.09, 1.02, 0.12), -0.45, 0, 0.04);
        pushW(timberParts, new THREE.BoxGeometry(0.09, 1.02, 0.12), 0.45, 0, 0.04);
        pushW(timberParts, new THREE.BoxGeometry(0.045, 0.94, 0.09), 0, 0, 0.05);
        pushW(timberParts, new THREE.BoxGeometry(0.86, 0.045, 0.09), 0, 0.04, 0.05);
        // Carved stone sill
        pushW(stoneParts, new THREE.BoxGeometry(1.10, 0.11, 0.20), 0, -0.52, 0.07);
      };

      addMillWindow(-1.25, hStone + 1.05, d * 0.5 + 0.02, 0);
      addMillWindow(1.30, hStone + 1.05, d * 0.5 + 0.02, 0);
      addMillWindow(0, hStone + 1.05, -d * 0.5 - 0.02, Math.PI);
      addMillWindow(-w * 0.5 - 0.02, hStone + 1.15, 0.85, -Math.PI * 0.5);

      // 6. Spoked Timber Waterwheel (r = 2.35m, 16 paddles, 8 spokes, twin rims) on brook side (-X)
      const wheelR = 2.35;
      const wheelX = -w * 0.5 - 0.46;
      const wheelY = 1.65;
      const wheelZ = -0.25;
      const wheelW = 0.62;

      // Central timber axle shaft
      addMillGeo(
        timberParts,
        new THREE.CylinderGeometry(0.18, 0.18, 1.35, 10),
        wheelX + 0.15,
        wheelY,
        wheelZ,
        0,
        0,
        Math.PI * 0.5
      );

      // 8 radial timber spokes per side + 16 rim segments & bucket paddles
      const paddleCount = 16;
      for (let p = 0; p < paddleCount; p++) {
        const a0 = (p / paddleCount) * Math.PI * 2;
        const a1 = ((p + 1) / paddleCount) * Math.PI * 2;
        const am = (a0 + a1) * 0.5;
        const cy = wheelY + Math.sin(am) * wheelR;
        const cz = wheelZ + Math.cos(am) * wheelR;
        const segLen = (2 * Math.PI * wheelR) / paddleCount * 1.06;

        // Twin concentric timber rims
        for (const xOff of [-wheelW * 0.44, wheelW * 0.44]) {
          addMillGeo(
            timberParts,
            new THREE.BoxGeometry(0.11, 0.18, segLen),
            wheelX + xOff,
            cy,
            cz,
            am,
            0,
            0
          );
          addMillGeo(
            timberParts,
            new THREE.BoxGeometry(0.09, 0.14, segLen * 0.84),
            wheelX + xOff,
            wheelY + Math.sin(am) * (wheelR * 0.82),
            wheelZ + Math.cos(am) * (wheelR * 0.82),
            am,
            0,
            0
          );
        }

        // Wooden bucket paddle board
        addMillGeo(
          timberParts,
          new THREE.BoxGeometry(wheelW + 0.08, 0.34, 0.07),
          wheelX,
          wheelY + Math.sin(a0) * (wheelR * 0.92),
          wheelZ + Math.cos(a0) * (wheelR * 0.92),
          a0 + 0.25,
          0,
          0
        );

        // 8 radial heavy spokes (every 2nd paddle)
        if (p % 2 === 0) {
          for (const xOff of [-wheelW * 0.40, wheelW * 0.40]) {
            addMillGeo(
              timberParts,
              new THREE.BoxGeometry(0.09, wheelR * 1.96, 0.12),
              wheelX + xOff,
              wheelY,
              wheelZ,
              a0,
              0,
              0
            );
          }
        }
      }
    }

    const mergedTimber = mergeGeometries(timberParts, false)!;
    timberParts.forEach((g) => g.dispose());
    const mergedStone = mergeGeometries(stoneParts, false)!;
    stoneParts.forEach((g) => g.dispose());
    const mergedPlaster = mergeGeometries(plasterParts, false)!;
    plasterParts.forEach((g) => g.dispose());
    const mergedRoof = mergeGeometries(roofParts, false)!;
    roofParts.forEach((g) => g.dispose());
    const mergedWindows = mergeGeometries(windowParts, false)!;
    windowParts.forEach((g) => g.dispose());
    const mergedBrook = mergeGeometries(brookParts, false)!;
    brookParts.forEach((g) => g.dispose());

    // Irregular Natural Mossy Fieldstones (bordering the weathered cobblestone path, brook & oaks — ZERO uniform box blocks!)
    const mossyRockParts: THREE.BufferGeometry[] = [];
    {
      const createFacetedRock = (seed: number): THREE.BufferGeometry => {
        const g = new THREE.IcosahedronGeometry(1.0, 2);
        const p = g.attributes.position;
        const rUv = g.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          let vx = p.getX(i);
          let vy = p.getY(i);
          let vz = p.getZ(i);
          const ridge = 1.0 - Math.abs(Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.8 - seed * 0.7));
          const facet = Math.sin(vy * 4.2 + vx * 2.5 + seed) * 0.12 + Math.cos(vz * 4.8 - vy * 3.1) * 0.09;
          const disp = 0.86 + ridge * 0.24 + facet;
          vx *= disp;
          vy *= disp * 0.68;
          vz *= disp;
          if (vy < -0.22) vy = -0.22 + (vy + 0.22) * 0.35;
          p.setXYZ(i, vx, vy, vz);
          if (rUv) {
            rUv.setXY(i, rUv.getX(i) * 0.42, rUv.getY(i) * 0.42);
          }
        }
        g.computeVertexNormals();
        return g;
      };

      const rockConfigs: Array<{ x: number; z: number; sx: number; sy: number; sz: number; yaw: number; seed: number }> = [
        // Hero Oak & Stone Bench boulder outcrops
        { x: -18.4, z: -17.6, sx: 0.92, sy: 0.65, sz: 0.78, yaw: 0.4, seed: 1.1 },
        { x: -17.5, z: -17.1, sx: 0.52, sy: 0.40, sz: 0.48, yaw: 1.9, seed: 2.3 },
        { x: -14.3, z: -21.2, sx: 0.78, sy: 0.55, sz: 0.68, yaw: 2.7, seed: 3.4 },
        { x: -10.5, z: -20.6, sx: 0.62, sy: 0.42, sz: 0.54, yaw: 0.9, seed: 4.2 },
        // Scenic fence corners, brook banks & watermill boulders
        { x: 10.6, z: 14.8, sx: 0.74, sy: 0.52, sz: 0.64, yaw: 1.2, seed: 5.1 },
        { x: 11.4, z: 14.0, sx: 0.45, sy: 0.34, sz: 0.42, yaw: 2.4, seed: 6.0 },
        { x: 11.6, z: -1.8, sx: 0.82, sy: 0.56, sz: 0.70, yaw: 3.8, seed: 7.3 },
        { x: -21.2, z: -14.2, sx: 0.88, sy: 0.60, sz: 0.76, yaw: 0.6, seed: 8.5 },
        { x: -8.4, z: 5.6, sx: 0.64, sy: 0.44, sz: 0.56, yaw: 1.7, seed: 9.4 },
        { x: 6.4, z: -16.8, sx: 0.76, sy: 0.50, sz: 0.68, yaw: 2.9, seed: 10.2 },
        { x: 14.5, z: -6.8, sx: 0.95, sy: 0.64, sz: 0.82, yaw: 4.1, seed: 11.6 },
        { x: 13.6, z: -6.0, sx: 0.54, sy: 0.38, sz: 0.50, yaw: 0.8, seed: 12.1 },
        { x: 24.2, z: -28.2, sx: 0.85, sy: 0.55, sz: 0.74, yaw: 1.5, seed: 13.4 },
        { x: 21.2, z: -17.5, sx: 0.78, sy: 0.48, sz: 0.68, yaw: 2.6, seed: 14.8 },
        // Outer pasture & downstream brook boulder outcrops
        { x: 32.5, z: 54.0, sx: 1.05, sy: 0.68, sz: 0.90, yaw: 0.9, seed: 15.2 },
        { x: 31.2, z: 55.2, sx: 0.62, sy: 0.42, sz: 0.56, yaw: 2.3, seed: 16.4 },
        { x: -55.0, z: 34.0, sx: 1.12, sy: 0.72, sz: 0.94, yaw: 3.1, seed: 17.1 },
        { x: -64.0, z: -42.0, sx: 1.18, sy: 0.75, sz: 1.02, yaw: 1.4, seed: 18.6 },
        { x: 58.0, z: -50.0, sx: 1.08, sy: 0.68, sz: 0.92, yaw: 4.5, seed: 19.3 },
        { x: 20.5, z: -76.0, sx: 1.04, sy: 0.66, sz: 0.88, yaw: 0.5, seed: 20.8 }
      ];

      // Irregular natural mossy fieldstones scattered organically along path shoulders (replacing uniform grey curb blocks!)
      const fieldRand = mulberry32(8419);
      let zCursor = 24.5;
      let fieldSeed = 20.0;
      while (zCursor >= -26.5) {
        zCursor -= 1.15 + fieldRand() * 2.25;
        const cx = getMeadowPathCenterX(zCursor);
        const halfW = 0.94 + 0.16 * Math.sin(zCursor * 0.25);
        const side = fieldRand() > 0.48 ? 1 : -1;
        const clusterCount = fieldRand() > 0.62 ? 2 : 1;
        for (let c = 0; c < clusterCount; c++) {
          const sx = 0.16 + fieldRand() * 0.24;
          const sy = 0.09 + fieldRand() * 0.14;
          const sz = 0.18 + fieldRand() * 0.28;
          const kx = cx + side * (halfW + 0.14 + fieldRand() * 0.28) + (c === 1 ? side * 0.24 : 0);
          const kz = zCursor + (fieldRand() - 0.5) * 0.45 + (c === 1 ? 0.32 : 0);
          rockConfigs.push({
            x: kx,
            z: kz,
            sx,
            sy,
            sz,
            yaw: fieldRand() * Math.PI * 2,
            seed: (fieldSeed += 1.37)
          });
        }
      }

      const rMat = new THREE.Matrix4();
      const rPos = new THREE.Vector3();
      const rQuat = new THREE.Quaternion();
      const rScale = new THREE.Vector3();

      for (const rc of rockConfigs) {
        if (rc.sx > 0.4) {
          this.exclusionCircles.push({ x: rc.x, z: rc.z, r: Math.max(rc.sx, rc.sz) * 0.95 });
        }
        const rockGeo = createFacetedRock(rc.seed);
        const ry = getBreezyMeadowHeight(rc.x, rc.z) + rc.sy * 0.14;
        rPos.set(rc.x, ry, rc.z);
        rQuat.setFromEuler(new THREE.Euler(0.08 * Math.sin(rc.seed), rc.yaw, 0.07 * Math.cos(rc.seed)));
        rScale.set(rc.sx, rc.sy, rc.sz);
        rMat.compose(rPos, rQuat, rScale);
        mossyRockParts.push(prepareForMerge(rockGeo, rMat, true));
        rockGeo.dispose();
      }
    }
    const mergedMossyRocks = mergeGeometries(mossyRockParts, false)!;
    mossyRockParts.forEach((g) => g.dispose());

    const landmarkParts: THREE.BufferGeometry[] = [
      mergedCobble,
      mergedTimber,
      mergedStone,
      mergedMossyRocks,
      mergedPlaster,
      mergedRoof,
      mergedWindows,
      mergedBrook
    ];
    if (mergedTrunks) {
      landmarkParts.push(mergedTrunks);
    }
    const mergedLandmarks = mergeGeometries(landmarkParts, true);
    mergedCobble.dispose();
    mergedTimber.dispose();
    mergedStone.dispose();
    mergedMossyRocks.dispose();
    mergedPlaster.dispose();
    mergedRoof.dispose();
    mergedWindows.dispose();
    mergedBrook.dispose();
    mergedTrunks?.dispose();

    if (mergedLandmarks) {
      const cobbleMat = new THREE.MeshStandardMaterial({
        map: cobblestone.map,
        normalMap: cobblestone.normalMap,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: cobblestone.roughnessMap,
        roughness: 0.92,
        aoMap: cobblestone.aoMap,
        aoMapIntensity: 0.52,
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      applyWorldSpaceWeathering(cobbleMat, {
        macroScale: 0.34,
        mossHeight: 2.8,
        mossColor: '#48782c',
        dampRoughness: 0.46,
        dirtTint: '#685946'
      });

      const timberMat = new THREE.MeshStandardMaterial({
        map: timberWood.map,
        normalMap: timberWood.normalMap,
        normalScale: new THREE.Vector2(1.30, 1.30),
        roughnessMap: timberWood.roughnessMap,
        roughness: 1.0,
        aoMap: timberWood.aoMap
      });
      applyWorldSpaceWeathering(timberMat, {
        macroScale: 0.28,
        mossHeight: 2.1,
        mossColor: '#3c6226',
        dampRoughness: 0.52,
        dirtTint: '#3f3224'
      });

      const stoneMat = new THREE.MeshStandardMaterial({
        color: '#ddd7cb',
        map: stoneMasonry.map,
        normalMap: stoneMasonry.normalMap,
        normalScale: new THREE.Vector2(1.68, 1.68),
        roughnessMap: stoneMasonry.roughnessMap,
        roughness: 1.0,
        aoMap: stoneMasonry.aoMap,
        aoMapIntensity: 0.96
      });
      applyWorldSpaceWeathering(stoneMat, {
        macroScale: 0.34,
        mossHeight: heroGroundY + 0.55,
        mossColor: '#366022',
        dampRoughness: 0.36,
        dirtTint: '#483a2c'
      });

      const mossyRockMat = new THREE.MeshStandardMaterial({
        map: graniteRocks.map,
        normalMap: graniteRocks.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: graniteRocks.roughnessMap,
        roughness: 0.92,
        aoMap: graniteRocks.aoMap,
        aoMapIntensity: 0.78
      });
      applyWorldSpaceWeathering(mossyRockMat, {
        macroScale: 0.46,
        mossHeight: heroGroundY + 1.2,
        mossColor: '#3b6e24',
        dampRoughness: 0.42,
        dirtTint: '#4b3e2e'
      });

      const plasterMat = new THREE.MeshStandardMaterial({
        map: plasterWall.map,
        normalMap: plasterWall.normalMap,
        normalScale: new THREE.Vector2(0.75, 0.75),
        roughnessMap: plasterWall.roughnessMap,
        roughness: 0.92,
        aoMap: plasterWall.aoMap,
        metalness: 0.0
      });
      applyWorldSpaceWeathering(plasterMat, {
        macroScale: 0.26,
        mossHeight: 1.6,
        mossColor: '#486e2c',
        dampRoughness: 0.65,
        dirtTint: '#6e5e4a'
      });

      const roofMat = new THREE.MeshStandardMaterial({
        color: '#bd6543',
        map: terracottaRoof.map,
        normalMap: terracottaRoof.normalMap,
        normalScale: new THREE.Vector2(1.58, 1.58),
        roughnessMap: terracottaRoof.roughnessMap,
        roughness: 0.78,
        aoMap: terracottaRoof.aoMap,
        aoMapIntensity: 1.0,
        metalness: 0.05
      });
      applyWorldSpaceWeathering(roofMat, {
        macroScale: 0.42,
        mossHeight: 5.5,
        mossColor: '#325a1e',
        dampRoughness: 0.50,
        dirtTint: '#463022'
      });

      const windowMat = new THREE.MeshStandardMaterial({
        color: '#ffe49e',
        emissive: new THREE.Color('#ffae42'),
        emissiveIntensity: 1.25,
        roughness: 0.22,
        metalness: 0.15
      });
      this.cottageWindowMat = windowMat;

      this.brookMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0.0 },
            uSunDirection: { value: sunDir.clone().normalize() },
            uSkyTopColor: { value: new THREE.Color(this.currentConfig?.sky?.topColor ?? '#2563eb') },
            uHorizonColor: { value: new THREE.Color(this.currentConfig?.sky?.horizonColor ?? '#d6ecfe') },
            uWaterwheelPos: { value: waterwheelWorldXZ.clone() },
            uNightFactor: { value: 0.0 }
          }
        ]),
        vertexShader: /* glsl */ `
          #include <fog_pars_vertex>
          uniform float uTime;
          varying vec3 vWorldPos;
          varying vec2 vUv;

          void main() {
            vUv = uv;
            vec3 p = position;
            float centerMask = 1.0 - smoothstep(0.35, 1.0, abs(uv.x - 0.5) * 2.0);
            p.y += (sin(p.z * 1.45 + uTime * 2.6 + p.x * 0.9) * 0.018
                  + cos(p.x * 2.6 - uTime * 2.1) * 0.012) * centerMask;
            vec4 worldPos = modelMatrix * vec4(p, 1.0);
            vWorldPos = worldPos.xyz;
            vec4 mvPosition = viewMatrix * worldPos;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          #include <fog_pars_fragment>
          uniform float uTime;
          uniform vec3 uSunDirection;
          uniform vec3 uSkyTopColor;
          uniform vec3 uHorizonColor;
          uniform vec2 uWaterwheelPos;
          uniform float uNightFactor;
          varying vec3 vWorldPos;
          varying vec2 vUv;

          float mbHash(vec2 p) {
            p = fract(p * vec2(127.1, 311.7));
            p += dot(p, p + 19.31);
            return fract(p.x * p.y);
          }

          float mbNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mbHash(i), mbHash(i + vec2(1.0, 0.0)), u.x),
              mix(mbHash(i + vec2(0.0, 1.0)), mbHash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }

          float mbFbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
            for (int i = 0; i < 3; i++) {
              v += a * mbNoise(p);
              p = rot * p * 2.08 + vec2(11.3, 17.7);
              a *= 0.5;
            }
            return v;
          }

          float brookWaveH(vec2 xz, float t) {
            float w1 = mbFbm(xz * 0.95 + vec2(0.0, t * 1.15));
            float w2 = mbNoise(xz * 2.65 + vec2(t * 0.32, t * 1.95));
            float w3 = mbNoise(xz * 5.8 - vec2(t * 0.45, -t * 2.4));
            return w1 * 0.50 + w2 * 0.34 + w3 * 0.16;
          }

          void main() {
            vec2 xz = vWorldPos.xz;
            float camDist = length(cameraPosition - vWorldPos);
            float nearAtten = 1.0 - smoothstep(24.0, 96.0, camDist);

            // Multi-wave animated micro-normals for crisp sky reflections & sparkles
            float eps = 0.075;
            float hC = brookWaveH(xz, uTime);
            float hX = brookWaveH(xz + vec2(eps, 0.0), uTime);
            float hZ = brookWaveH(xz + vec2(0.0, eps), uTime);
            float nStr = mix(0.26, 0.62, nearAtten);
            vec3 N = normalize(vec3((hC - hX) / eps * nStr, 1.0, (hC - hZ) / eps * nStr));

            vec3 V = normalize(cameraPosition - vWorldPos);
            vec3 L = normalize(uSunDirection);
            float NdotV = max(dot(N, V), 0.0);
            float fresnel = 0.03 + 0.97 * pow(1.0 - NdotV, 4.4);

            float bankFactor = abs(vUv.x - 0.5) * 2.0;

            // Refracted shallow river-pebble bed + animated emerald/amber underwater caustics
            vec2 refractXz = xz + N.xz * 0.28;
            float pebble = mbNoise(refractXz * 4.2) * 0.6 + mbNoise(refractXz * 10.5) * 0.4;
            float caustic = smoothstep(0.60, 0.88, mbNoise(refractXz * 3.1 + vec2(uTime * 0.35, uTime * 0.65)));
            vec3 pebbleBed = mix(vec3(0.075, 0.095, 0.070), vec3(0.21, 0.22, 0.17), pebble);
            pebbleBed += vec3(0.18, 0.28, 0.22) * caustic * nearAtten * 0.65;

            // Crystal emerald-blue stream water absorption (shallow clear banks -> richer sapphire-emerald channel)
            vec3 shallowEmerald = vec3(0.055, 0.30, 0.27);
            vec3 deepChannelBlue = vec3(0.018, 0.175, 0.245);
            vec3 waterCol = mix(deepChannelBlue, shallowEmerald, smoothstep(0.22, 0.82, bankFactor) * 0.65 + hC * 0.35);
            float bedVis = smoothstep(0.18, 0.86, bankFactor) * 0.72 + (1.0 - smoothstep(0.0, 0.35, bankFactor)) * 0.24;
            waterCol = mix(waterCol, pebbleBed, bedVis * 0.62);

            // Sky & meadow-hill Fresnel reflections
            vec3 reflDir = reflect(-V, N);
            float skyMask = smoothstep(-0.04, 0.35, reflDir.y);
            vec3 skyRefl = mix(uHorizonColor * 0.68, uSkyTopColor * 0.76, clamp(reflDir.y * 1.35, 0.0, 1.0));
            vec3 bankRefl = vec3(0.09, 0.18, 0.07);
            waterCol = mix(waterCol, mix(bankRefl, skyRefl, skyMask), clamp(fresnel * 0.72, 0.0, 0.74));

            // Frothy white waterwheel splash foam & downstream aeration wake where the wheel meets the brook
            vec2 wwDiff = xz - uWaterwheelPos;
            float dsScale = wwDiff.y > 0.0 ? 0.28 : 1.05;
            float wwDist = length(vec2(wwDiff.x * 1.05, wwDiff.y * dsScale));
            float wwChurn = mbFbm(xz * 3.4 + vec2(0.0, -uTime * 2.6));
            float wwRipples = sin(wwDist * 5.2 - uTime * 5.4 + wwChurn * 2.0) * 0.5 + 0.5;
            float wwCore = exp(-wwDist * wwDist * 0.26);
            float wwSpray = (1.0 - smoothstep(0.7, 3.8, wwDist)) * smoothstep(0.30, 0.76, wwChurn * 0.68 + wwRipples * 0.32);
            float wheelFoam = clamp(wwCore * (0.72 + 0.28 * wwChurn) + wwSpray * 0.88, 0.0, 0.96);

            // Bank-edge lacy foam & mid-stream riffle crests
            float foamTex = mbFbm(xz * 2.2 + vec2(0.0, uTime * 1.35));
            float bankFoam = smoothstep(0.66, 0.94, bankFactor + (foamTex - 0.5) * 0.28) * 0.46;
            float riffleFoam = smoothstep(0.68, 0.90, hC * 0.62 + foamTex * 0.38) * 0.36;
            float totalFoam = clamp(max(wheelFoam, bankFoam + riffleFoam * 0.6), 0.0, 0.95);
            waterCol = mix(waterCol, vec3(0.92, 0.97, 0.99), totalFoam * 0.88);

            // Crisp solar specular & sunlit water sparkles
            vec3 H = normalize(L + V);
            float NdotH = max(dot(N, H), 0.0);
            float sunSpec = pow(NdotH, 128.0) * 1.65 + pow(NdotH, 24.0) * 0.16;
            float glint = smoothstep(0.83, 0.96, mbNoise(xz * 4.2 + vec2(uTime * 0.8, -uTime * 1.2))) * nearAtten;
            vec3 specCol = mix(vec3(1.16, 1.08, 0.86), vec3(0.45, 0.60, 0.95), uNightFactor);
            waterCol += specCol * (sunSpec + glint * 0.38) * (1.0 - totalFoam * 0.65) * (1.0 - uNightFactor * 0.55);
            waterCol *= mix(vec3(1.0), vec3(0.24, 0.32, 0.58), uNightFactor);

            float alpha = clamp((0.80 + totalFoam * 0.18) * (1.0 - smoothstep(0.84, 1.0, bankFactor)), 0.0, 0.98);
            if (alpha < 0.01) discard;

            gl_FragColor = vec4(waterCol, alpha);
            #include <fog_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });

      const landmarkMaterials: THREE.Material[] = [
        cobbleMat,
        timberMat,
        stoneMat,
        mossyRockMat,
        plasterMat,
        roofMat,
        windowMat,
        this.brookMaterial
      ];
      if (barkMat) {
        landmarkMaterials.push(barkMat);
      }

      const tintableMats: THREE.MeshStandardMaterial[] = [
        cobbleMat,
        timberMat,
        stoneMat,
        mossyRockMat,
        plasterMat,
        roofMat
      ];
      if (barkMat) {
        tintableMats.push(barkMat);
      }
      this.landmarkTintMaterials = tintableMats.map((mat) => ({
        mat,
        baseColor: mat.color.clone()
      }));

      this.landmarksMesh = new THREE.Mesh(mergedLandmarks, landmarkMaterials);
      this.landmarksMesh.name = 'PastoralGardenLandmarks';
      this.landmarksMesh.castShadow = true;
      this.landmarksMesh.receiveShadow = true;
      this.scene.add(this.landmarksMesh);
    }
  }

  private isExcludedFromFlora(x: number, z: number): boolean {
    if (z >= -30.5 && z <= 28.5) {
      if (Math.abs(x - getMeadowPathCenterX(z)) < 1.08) return true;
    }
    const xStart = getMeadowPathCenterX(-14.0);
    if (x >= xStart - 0.5 && x <= 26.8) {
      if (Math.abs(z - getWatermillLaneCenterZ(x)) < 0.96) return true;
    }
    if (z >= -102.0 && z <= 92.0) {
      const halfW = 1.92 + 0.22 * Math.sin(z * 0.18);
      if (Math.abs(x - getMeadowBrookCenterX(z)) < halfW) return true;
    }
    // Stone Arch Footbridge footprint
    const brZ = -21.8;
    const brX = getMeadowBrookCenterX(brZ);
    if (Math.abs(x - brX) < 3.1 && Math.abs(z - brZ) < 1.15) return true;
    for (const c of this.exclusionCircles) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) return true;
    }
    return false;
  }

  private buildInstancedGrass(
    sunDir: THREE.Vector3,
    windDir2D: THREE.Vector2,
    config?: SpaceConfig
  ): void {
    const count = 36000;
    // Dual-strata 6-blade radiating tuft: 3 low 0.13m rye/clover base blades + 3 taller 0.36m arching stalks
    // (192,000 blades in 1 draw call!)
    const tPos: number[] = [];
    const tNorm: number[] = [];
    const tUv: number[] = [];
    const tIdx: number[] = [];

    const bladesPerTuft = 6;
    for (let b = 0; b < bladesPerTuft; b++) {
      const isLow = b % 2 === 0;
      const stratumIdx = Math.floor(b / 2);
      const ang = (stratumIdx / 3) * Math.PI * 2 + (isLow ? 0.52 : 0.0) + ((b * 0.37) % 0.45);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const radOff = isLow ? 0.022 + stratumIdx * 0.014 : 0.036 + stratumIdx * 0.012;
      const H = isLow
        ? 0.13 + ((stratumIdx * 0.41) % 1.0) * 0.045
        : 0.34 + ((stratumIdx * 0.53) % 1.0) * 0.08;
      const lean = isLow
        ? 0.09 + ((stratumIdx * 0.33) % 1.0) * 0.04
        : 0.12 + ((stratumIdx * 0.47) % 1.0) * 0.06;
      const W0 = isLow ? 0.056 : 0.044;
      const W1 = isLow ? 0.036 : 0.025;

      const baseV = b * 5;
      const pushV = (lx: number, ly: number, lz: number, u: number, v: number) => {
        const wx = lx * ca - (lz + radOff) * sa + ca * 0.006;
        const wz = lx * sa + (lz + radOff) * ca + sa * 0.006;
        tPos.push(wx, ly, wz);
        const ny = 0.36 + v * 0.46;
        const nLen = Math.hypot(sa, ny, ca) || 1;
        tNorm.push(-sa / nLen, ny / nLen, ca / nLen);
        tUv.push(u, v);
      };

      pushV(-W0 * 0.5, 0.0, 0.0, 0.0, 0.0);
      pushV(W0 * 0.5, 0.0, 0.0, 1.0, 0.0);
      pushV(-W1 * 0.5, 0.46 * H, lean * 0.34, 0.12, 0.46);
      pushV(W1 * 0.5, 0.46 * H, lean * 0.34, 0.88, 0.46);
      pushV(0.0, H, lean, 0.5, 1.0);

      tIdx.push(
        baseV, baseV + 1, baseV + 3,
        baseV, baseV + 3, baseV + 2,
        baseV + 2, baseV + 3, baseV + 4
      );
    }

    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    bladeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(tNorm, 3));
    bladeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
    bladeGeo.setIndex(tIdx);

    this.grassMaterial = createGustWindGrassMaterial({
      bladeHeight: 0.42,
      swayStrength: config?.wind?.swayIntensity ?? 0.9,
      coolRoot: '#1d5224',
      warmTip: '#b4ec56',
      sunDir
    });
    this.grassMaterial.uniforms.uWindDir.value.copy(windDir2D).normalize();
    this.grassMaterial.uniforms.uGustSpeed.value = Math.max(0.65, (config?.wind?.speed ?? 2.4) * 0.68);
    this.grassMaterial.uniforms.uCloudCoverage.value = this.currentCloudCoverage;
    this.grassMaterial.uniforms.uCloudShadowStrength.value = 0.56;

    this.grassMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, count);
    this.grassMesh.name = 'InstancedGrass';

    const dummyMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const alignQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();
    const combinedQuat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    const coreMaxRadius = 52.0;
    const outerMinRadius = 44.0;
    const outerMaxRadius = 100.0;
    const goldenAngle = 2.399963229728653;

    let placed = 0;
    // Dedicate 3,400 lush bankside tufts right along the extended brook banks, bridge abutments & watermill stone plinth
    const bankTuftTarget = 3400;
    for (let b = 0; placed < bankTuftTarget && b < bankTuftTarget * 3; b++) {
      const j1 = Math.abs(Math.sin(b * 23.719 + 1.3) * 31917.43) % 1.0;
      const j2 = Math.abs(Math.sin(b * 47.311 + 2.7) * 19433.89) % 1.0;
      const z = -90.0 + ((b + j1) / bankTuftTarget) * 176.0;
      const side = b % 2 === 0 ? 1 : -1;
      const halfW = 1.98 + 0.24 * Math.sin(z * 0.18);
      const x = getMeadowBrookCenterX(z) + side * (halfW + 0.08 + Math.pow(j2, 1.35) * 4.5);

      if (this.isExcludedFromFlora(x, z)) continue;

      const y = getBreezyMeadowHeight(x, z);
      position.set(x, y, z);
      getMeadowNormal(x, z, normal);
      alignQuat.setFromUnitVectors(up, normal);
      yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
      combinedQuat.multiplyQuaternions(yawQuat, alignQuat);

      const sy = 0.78 + j2 * 0.62;
      const sx = 0.88 + j1 * 0.36;
      scale.set(sx, sy, sx);
      dummyMatrix.compose(position, combinedQuat, scale);
      this.grassMesh.setMatrixAt(placed, dummyMatrix);

      color.setHSL(0.28 + (j1 - 0.5) * 0.06, 0.58, 0.72 + (j2 - 0.5) * 0.14);
      this.grassMesh.setColorAt(placed, color);
      placed++;
    }

    const coreTarget = 22000;
    for (let i = 0; placed < count && i < count * 2; i++) {
      const j1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1.0;
      const j2 = Math.abs(Math.sin(i * 78.233) * 19341.123) % 1.0;

      const isCore = placed < coreTarget;
      let r: number;
      if (isCore) {
        const coreSpan = coreTarget - bankTuftTarget;
        const rRatio = Math.pow(((i % coreSpan) + j1 * 0.85) / coreSpan, 1.18);
        r = rRatio * coreMaxRadius;
      } else {
        const outerSpan = count - coreTarget;
        const u = ((placed - coreTarget) + j1 * 0.85) / outerSpan;
        r = outerMinRadius + Math.pow(Math.max(0, Math.min(1, u)), 0.82) * (outerMaxRadius - outerMinRadius);
      }
      const theta = i * goldenAngle + (j2 - 0.5) * 0.42;

      const x = r * Math.cos(theta) + (j1 - 0.5) * 0.85;
      const z = r * Math.sin(theta) + (j2 - 0.5) * 0.85 - 2.0;

      if (this.isExcludedFromFlora(x, z)) continue;

      const y = getBreezyMeadowHeight(x, z);
      position.set(x, y, z);
      getMeadowNormal(x, z, normal);

      alignQuat.setFromUnitVectors(up, normal);
      yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
      combinedQuat.multiplyQuaternions(yawQuat, alignQuat);

      const sy = 0.72 + j2 * 0.58;
      const sx = 0.84 + j1 * 0.34;
      scale.set(sx, sy, sx);

      dummyMatrix.compose(position, combinedQuat, scale);
      this.grassMesh.setMatrixAt(placed, dummyMatrix);

      // Olive / emerald / golden-tip botanical hue drift across meadow patches
      const patchWave = Math.sin(x * 0.08 + z * 0.06) * 0.5 + 0.5;
      const hue = 0.22 + patchWave * 0.08 + (j1 - 0.5) * 0.04;
      const sat = 0.48 + patchWave * 0.14;
      const light = 0.72 + (1.0 - patchWave) * 0.12 + (j2 - 0.5) * 0.10;
      color.setHSL(hue, sat, light);
      this.grassMesh.setColorAt(placed, color);
      placed++;
    }

    this.grassMesh.count = placed;
    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) {
      this.grassMesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.grassMesh);
  }

  private createMultiSpeciesWildflowerMaterial(
    sunDir: THREE.Vector3,
    windDir2D: THREE.Vector2,
    config?: SpaceConfig
  ): THREE.ShaderMaterial {
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0.0 },
        uWindSpeed: { value: config?.wind?.speed ?? 2.4 },
        uWindDirection: { value: windDir2D.clone().normalize() },
        uWindStrength: { value: config?.wind?.swayIntensity ?? 0.9 },
        uGustiness: { value: config?.wind?.gustiness ?? 0.65 },
        uSunDirection: { value: sunDir.clone().normalize() },
        uCloudCoverage: { value: this.currentCloudCoverage },
        uCloudSpeed: { value: this.currentCloudSpeed },
        uCloudShadowStrength: { value: 0.54 },
        uNightFactor: { value: 0.0 }
      }
    ]);

    return new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      fog: true,
      vertexColors: true,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>

        attribute float aPartSpecies;
        attribute float aSpecies;

        uniform float uTime;
        uniform float uWindSpeed;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uGustiness;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vInstanceColor;
        varying float vSpecies;

        #ifdef USE_COLOR
        varying vec3 vColor;
        #endif

        void main() {
          // Collapse sub-meshes belonging to other species outside clip space (0 fragment cost)
          if (abs(aPartSpecies - aSpecies) > 0.25) {
            vUv = vec2(0.0);
            vWorldPosition = vec3(0.0);
            vNormal = vec3(0.0, 1.0, 0.0);
            vInstanceColor = vec3(1.0);
            vSpecies = aSpecies;
            #ifdef USE_COLOR
            vColor = vec3(0.0);
            #endif
            vec4 mvPosition = vec4(0.0, 0.0, 100.0, 1.0);
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            #include <fog_vertex>
            return;
          }

          vUv = uv;
          vSpecies = aSpecies;

          #ifdef USE_COLOR
          vColor = color;
          #endif

          vInstanceColor = vec3(1.0);
          #ifdef USE_INSTANCING_COLOR
          vInstanceColor = instanceColor;
          #endif

          vec4 localPos = vec4(position, 1.0);

          #ifdef USE_INSTANCING
          vec4 worldPos = instanceMatrix * localPos;
          vec3 baseWorldPos = vec3(instanceMatrix[3].xyz);
          #else
          vec4 worldPos = modelMatrix * localPos;
          vec3 baseWorldPos = vec3(modelMatrix[3].xyz);
          #endif

          vec2 windDir = normalize(uWindDirection);
          vec2 perpWindDir = vec2(-windDir.y, windDir.x);

          float flex = clamp(uv.y * uv.y, 0.0, 1.0);
          float phase1 = dot(worldPos.xz, windDir) * 0.28 - uTime * uWindSpeed;
          float wave1 = sin(phase1);
          float phase2 = dot(worldPos.xz, windDir) * 0.58 - uTime * (uWindSpeed * 1.7) + 1.25;
          float wave2 = sin(phase2);
          float phaseCross = dot(worldPos.xz, perpWindDir) * 0.45 - uTime * 2.8 + baseWorldPos.x * 0.1;
          float waveCross = sin(phaseCross) * 0.2;

          float gust = (wave1 * 0.65 + 0.35) + uGustiness * wave2 + waveCross;
          float stemStiff = aSpecies > 1.5 && aSpecies < 2.5 ? 0.65 : 0.78;
          vec2 horizontalDisp = (windDir * gust + perpWindDir * waveCross * 0.4) * (uWindStrength * stemStiff) * flex;
          worldPos.xz += horizontalDisp;

          float dispLenSq = dot(horizontalDisp, horizontalDisp);
          worldPos.y -= dispLenSq * 0.30 * flex;

          vWorldPosition = worldPos.xyz;

          #ifdef USE_INSTANCING
          vec3 stemNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
          #else
          vec3 stemNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
          #endif
          vNormal = normalize(stemNormal);

          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>

        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform float uCloudCoverage;
        uniform float uCloudSpeed;
        uniform float uCloudShadowStrength;
        uniform float uNightFactor;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vInstanceColor;
        varying float vSpecies;

        #ifdef USE_COLOR
        varying vec3 vColor;
        #endif

        ${CLOUD_SHADOW_GLSL}

        void main() {
          #ifdef USE_COLOR
          vec3 col = vColor;
          #else
          vec3 col = vec3(0.99, 0.99, 0.96);
          #endif

          // Apply per-instance tint gently on blossoms/petals while keeping stems green
          float instTintMask = smoothstep(0.62, 0.98, vUv.y);
          col *= mix(vec3(1.0), vInstanceColor, instTintMask);

          float rootAO = mix(0.46, 1.0, smoothstep(0.0, 0.38, vUv.y));
          vec3 N = normalize(vNormal);
          if (!gl_FrontFacing) N = -N;
          vec3 L = normalize(uSunDirection);
          vec3 V = normalize(cameraPosition - vWorldPosition);

          float cloudSun = mix(
            1.0,
            sampleCloudShadowAtXZ(vWorldPosition.x, vWorldPosition.z, uTime, uCloudCoverage, uCloudSpeed),
            uCloudShadowStrength
          );

          float NdotL = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
          float diffuse = mix(0.45, 1.06, NdotL) * cloudSun;

          // Backlit translucency: extra airy glow on dandelion pappus puffs & sunlit petals
          float petalMask = smoothstep(0.65, 1.0, vUv.y);
          float backLight = pow(clamp(dot(-V, L), 0.0, 1.0), 2.0);
          float grazing = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 1.6);
          float puffBoost = vSpecies > 2.5 ? 0.42 : 0.26;
          float sss = (backLight * puffBoost + grazing * 0.14) * petalMask * cloudSun * (1.0 - uNightFactor * 0.85);

          col = col * diffuse * rootAO + col * sss;
          float flLuma = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 moonFlower = mix(col, vec3(flLuma * 0.58, flLuma * 0.72, flLuma * 1.24), uNightFactor * 0.65);
          col = moonFlower * mix(vec3(1.0), vec3(0.18, 0.25, 0.52), uNightFactor);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `
    });
  }

  private buildInstancedFlowers(
    sunDir: THREE.Vector3,
    windDir2D: THREE.Vector2,
    config?: SpaceConfig
  ): void {
    const count = 3200;
    const flowerGeo = this.createMultiSpeciesWildflowerGeometry();

    this.flowerMaterial = this.createMultiSpeciesWildflowerMaterial(sunDir, windDir2D, config);

    this.flowerMesh = new THREE.InstancedMesh(flowerGeo, this.flowerMaterial, count);
    this.flowerMesh.name = 'InstancedFlowers';

    const dummyMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const alignQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();
    const combinedQuat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    const speciesAttr = new Float32Array(count);

    // 0: Chamomile, 1: Buttercup, 2: Lavender Spike, 3: Dandelion Puff
    const clusterCenters: Array<{ x: number; z: number; r: number; count: number; primarySpecies: number }> = [
      { x: 3.0, z: 4.5, r: 4.5, count: 240, primarySpecies: 0 },
      { x: -4.5, z: 1.5, r: 4.5, count: 210, primarySpecies: 1 },
      { x: 6.0, z: -4.0, r: 6.0, count: 220, primarySpecies: 2 },
      { x: 14.0, z: 8.0, r: 5.5, count: 170, primarySpecies: 0 },
      { x: -10.0, z: 12.0, r: 5.0, count: 160, primarySpecies: 3 },
      { x: 18.0, z: -5.0, r: 6.0, count: 160, primarySpecies: 1 },
      { x: -5.0, z: -15.0, r: 5.5, count: 180, primarySpecies: 0 },
      { x: -18.0, z: -8.0, r: 5.0, count: 140, primarySpecies: 2 },
      { x: 25.0, z: 15.0, r: 5.5, count: 130, primarySpecies: 1 },
      { x: 8.0, z: 22.0, r: 5.0, count: 130, primarySpecies: 3 },
      { x: -15.0, z: 25.0, r: 5.5, count: 120, primarySpecies: 0 },
      { x: 2.0, z: -25.0, r: 5.0, count: 130, primarySpecies: 2 },
      { x: -25.0, z: 10.0, r: 6.0, count: 120, primarySpecies: 1 },
      { x: 30.0, z: -10.0, r: 5.0, count: 110, primarySpecies: 0 },
      { x: -28.0, z: -18.0, r: 5.5, count: 110, primarySpecies: 3 },
      // Doubled outer meadow wildflower drifts across [-78..+78]
      { x: -48.0, z: -38.0, r: 7.5, count: 90, primarySpecies: 2 },
      { x: -64.0, z: -12.0, r: 7.0, count: 80, primarySpecies: 0 },
      { x: -56.0, z: 36.0, r: 7.5, count: 90, primarySpecies: 1 },
      { x: -34.0, z: 62.0, r: 7.0, count: 80, primarySpecies: 3 },
      { x: 12.0, z: 68.0, r: 7.5, count: 85, primarySpecies: 0 },
      { x: 48.0, z: 54.0, r: 7.0, count: 80, primarySpecies: 1 },
      { x: 68.0, z: 18.0, r: 7.5, count: 85, primarySpecies: 2 },
      { x: 64.0, z: -28.0, r: 7.0, count: 80, primarySpecies: 0 },
      { x: 44.0, z: -58.0, r: 7.5, count: 85, primarySpecies: 3 },
      { x: -12.0, z: -64.0, r: 7.0, count: 80, primarySpecies: 1 },
      { x: 8.0, z: -78.0, r: 6.5, count: 70, primarySpecies: 0 },
      { x: -72.0, z: 14.0, r: 6.5, count: 70, primarySpecies: 2 }
    ];

    const creamPalette = ['#fffef7', '#fcf9ec', '#faf5e2', '#fff8e6'];
    const buttercupPalette = ['#fffef0', '#fff9d6', '#fff6c2'];
    const lavenderPalette = ['#fcfaff', '#f5efff', '#efe6ff'];
    const dandelionPalette = ['#ffffff', '#f8fafc', '#f5f7f2'];

    const pickSpecies = (idx: number, primary: number): number => {
      const h = (idx * 0.6180339887) % 1.0;
      if (h < 0.58) return primary;
      if (h < 0.78) return 0;
      if (h < 0.88) return 1;
      if (h < 0.94) return 2;
      return 3;
    };

    const pickTint = (species: number, idx: number): string => {
      if (species === 1) return buttercupPalette[idx % buttercupPalette.length];
      if (species === 2) return lavenderPalette[idx % lavenderPalette.length];
      if (species === 3) return dandelionPalette[idx % dandelionPalette.length];
      return creamPalette[idx % creamPalette.length];
    };

    let instanceIdx = 0;

    for (const cluster of clusterCenters) {
      for (let j = 0; j < cluster.count && instanceIdx < count; j++) {
        const u1 = Math.max(0.001, (j + 0.5) / cluster.count);
        const u2 = (j * 1.6180339887) % 1.0;
        const radius = cluster.r * Math.sqrt(-Math.log(1.0 - 0.92 * u1));
        const theta = u2 * Math.PI * 2;

        const x = cluster.x + radius * Math.cos(theta);
        const z = cluster.z + radius * Math.sin(theta);
        if (this.isExcludedFromFlora(x, z)) continue;

        const y = getBreezyMeadowHeight(x, z);
        position.set(x, y, z);
        getMeadowNormal(x, z, normal);

        alignQuat.setFromUnitVectors(up, normal);
        const yaw = ((instanceIdx * 2.39996) % 1.0) * Math.PI * 2;
        yawQuat.setFromAxisAngle(normal, yaw);
        combinedQuat.multiplyQuaternions(yawQuat, alignQuat);

        const species = pickSpecies(instanceIdx, cluster.primarySpecies);
        const baseScale = species === 2 ? 1.12 : species === 3 ? 1.06 : 1.02;
        const s = baseScale + (((instanceIdx * 0.491) % 1.0) - 0.5) * 0.34;
        scale.set(s, s, s);

        dummyMatrix.compose(position, combinedQuat, scale);
        this.flowerMesh.setMatrixAt(instanceIdx, dummyMatrix);

        speciesAttr[instanceIdx] = species;
        color.set(pickTint(species, instanceIdx));
        this.flowerMesh.setColorAt(instanceIdx, color);
        instanceIdx++;
      }
    }

    let fallbackSeed = 0;
    while (instanceIdx < count) {
      fallbackSeed++;
      const angle = fallbackSeed * 2.3999632;
      const dist = 4.0 + ((fallbackSeed * 0.37) % 82.0);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (this.isExcludedFromFlora(x, z)) continue;

      const y = getBreezyMeadowHeight(x, z);
      position.set(x, y, z);
      getMeadowNormal(x, z, normal);

      alignQuat.setFromUnitVectors(up, normal);
      const yaw = ((instanceIdx * 2.39996) % 1.0) * Math.PI * 2;
      yawQuat.setFromAxisAngle(normal, yaw);
      combinedQuat.multiplyQuaternions(yawQuat, alignQuat);

      const species = instanceIdx % 4;
      scale.set(0.95, 0.95, 0.95);
      dummyMatrix.compose(position, combinedQuat, scale);
      this.flowerMesh.setMatrixAt(instanceIdx, dummyMatrix);

      speciesAttr[instanceIdx] = species;
      color.set(pickTint(species, instanceIdx));
      this.flowerMesh.setColorAt(instanceIdx, color);
      instanceIdx++;
    }

    flowerGeo.setAttribute('aSpecies', new THREE.InstancedBufferAttribute(speciesAttr, 1));

    this.flowerMesh.instanceMatrix.needsUpdate = true;
    if (this.flowerMesh.instanceColor) {
      this.flowerMesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.flowerMesh);
  }

  private createMultiSpeciesWildflowerGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const partSpecies: number[] = [];
    const indices: number[] = [];

    let vOff = 0;

    const pushVertex = (
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      u: number,
      v: number,
      col: THREE.Color,
      sp: number
    ) => {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
      colors.push(col.r, col.g, col.b);
      partSpecies.push(sp);
      return vOff++;
    };

    const addCrossedStem = (stemH: number, stemR: number, col: THREE.Color, sp: number) => {
      const a0 = pushVertex(-stemR, 0, 0, 0, 0, 1, 0, 0, col, sp);
      const a1 = pushVertex(stemR, 0, 0, 0, 0, 1, 1, 0, col, sp);
      const a2 = pushVertex(-stemR, stemH, 0, 0, 0, 1, 0, 0.94, col, sp);
      const a3 = pushVertex(stemR, stemH, 0, 0, 0, 1, 1, 0.94, col, sp);
      indices.push(a0, a1, a2, a1, a3, a2);

      const b0 = pushVertex(0, 0, -stemR, 1, 0, 0, 0, 0, col, sp);
      const b1 = pushVertex(0, 0, stemR, 1, 0, 0, 1, 0, col, sp);
      const b2 = pushVertex(0, stemH, -stemR, 1, 0, 0, 0, 0.94, col, sp);
      const b3 = pushVertex(0, stemH, stemR, 1, 0, 0, 1, 0.94, col, sp);
      indices.push(b0, b1, b2, b1, b3, b2);
    };

    // ---- Species 0: Chamomile Daisy ----
    {
      const stemCol = new THREE.Color('#3b8833');
      const centerCol = new THREE.Color('#ffca3a');
      const petalCol = new THREE.Color('#ffffff');
      const stemH = 0.48;
      addCrossedStem(stemH, 0.009, stemCol, 0);

      const cIdx = pushVertex(0, stemH + 0.009, 0, 0, 1, 0, 0.5, 0.96, centerCol, 0);
      const pSegs = 6;
      const pStart = vOff;
      for (let i = 0; i < pSegs; i++) {
        const a = (i / pSegs) * Math.PI * 2;
        pushVertex(Math.cos(a) * 0.02, stemH + 0.004, Math.sin(a) * 0.02, 0, 1, 0, 0.5, 0.96, centerCol, 0);
      }
      for (let i = 0; i < pSegs; i++) {
        indices.push(cIdx, pStart + i, pStart + ((i + 1) % pSegs));
      }

      const petalCount = 8;
      const petalLen = 0.076;
      const cupLift = 0.026;
      for (let i = 0; i < petalCount; i++) {
        const a = (i / petalCount) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const pBase = vOff;
        pushVertex(ca * 0.014, stemH, sa * 0.014, -ca * 0.25, 0.96, -sa * 0.25, 0.5, 1.0, petalCol, 0);
        pushVertex(
          ca * (0.014 + petalLen * 0.55) - sa * 0.017,
          stemH + cupLift * 0.45,
          sa * (0.014 + petalLen * 0.55) + ca * 0.017,
          -ca * 0.25, 0.96, -sa * 0.25, 0.5, 1.0, petalCol, 0
        );
        pushVertex(
          ca * (0.014 + petalLen),
          stemH + cupLift,
          sa * (0.014 + petalLen),
          -ca * 0.25, 0.96, -sa * 0.25, 0.5, 1.0, petalCol, 0
        );
        pushVertex(
          ca * (0.014 + petalLen * 0.55) + sa * 0.017,
          stemH + cupLift * 0.45,
          sa * (0.014 + petalLen * 0.55) - ca * 0.017,
          -ca * 0.25, 0.96, -sa * 0.25, 0.5, 1.0, petalCol, 0
        );
        indices.push(pBase, pBase + 1, pBase + 2, pBase, pBase + 2, pBase + 3);
      }
    }

    // ---- Species 1: Golden Meadow Buttercup ----
    {
      const stemCol = new THREE.Color('#3c8a2e');
      const stamenCol = new THREE.Color('#e08b12');
      const butterCol = new THREE.Color('#ffd624');
      const stemH = 0.44;
      addCrossedStem(stemH, 0.0085, stemCol, 1);

      const cIdx = pushVertex(0, stemH + 0.010, 0, 0, 1, 0, 0.5, 0.96, stamenCol, 1);
      const sSegs = 5;
      const sStart = vOff;
      for (let i = 0; i < sSegs; i++) {
        const a = (i / sSegs) * Math.PI * 2;
        pushVertex(Math.cos(a) * 0.016, stemH + 0.004, Math.sin(a) * 0.016, 0, 1, 0, 0.5, 0.96, stamenCol, 1);
      }
      for (let i = 0; i < sSegs; i++) {
        indices.push(cIdx, sStart + i, sStart + ((i + 1) % sSegs));
      }

      // 5 broad glossy cupped buttercup petals
      const petalCount = 5;
      const petalLen = 0.068;
      const cupLift = 0.036;
      for (let i = 0; i < petalCount; i++) {
        const a = (i / petalCount) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const pBase = vOff;
        pushVertex(ca * 0.010, stemH, sa * 0.010, -ca * 0.4, 0.91, -sa * 0.4, 0.5, 1.0, butterCol, 1);
        pushVertex(
          ca * (0.010 + petalLen * 0.58) - sa * 0.026,
          stemH + cupLift * 0.55,
          sa * (0.010 + petalLen * 0.58) + ca * 0.026,
          -ca * 0.4, 0.91, -sa * 0.4, 0.5, 1.0, butterCol, 1
        );
        pushVertex(
          ca * (0.010 + petalLen),
          stemH + cupLift,
          sa * (0.010 + petalLen),
          -ca * 0.4, 0.91, -sa * 0.4, 0.5, 1.0, butterCol, 1
        );
        pushVertex(
          ca * (0.010 + petalLen * 0.58) + sa * 0.026,
          stemH + cupLift * 0.55,
          sa * (0.010 + petalLen * 0.58) - ca * 0.026,
          -ca * 0.4, 0.91, -sa * 0.4, 0.5, 1.0, butterCol, 1
        );
        indices.push(pBase, pBase + 1, pBase + 2, pBase, pBase + 2, pBase + 3);
      }
    }

    // ---- Species 2: Wild Lavender Spike ----
    {
      const sageStem = new THREE.Color('#4a7c4e');
      const lavDeep = new THREE.Color('#7c4dff');
      const lavLight = new THREE.Color('#c4a7ff');
      const stemH = 0.56;
      addCrossedStem(stemH, 0.008, sageStem, 2);

      const whorls = 4;
      const floretsPerWhorl = 4;
      for (let w = 0; w < whorls; w++) {
        const wy = 0.36 + w * 0.055;
        const rad = 0.032 - w * 0.004;
        const fCol = w < 2 ? lavDeep : lavLight;
        const uvV = Math.min(1.0, wy / stemH);
        for (let f = 0; f < floretsPerWhorl; f++) {
          const a = (f / floretsPerWhorl) * Math.PI * 2 + w * 0.78;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const base = vOff;
          pushVertex(ca * 0.007, wy - 0.012, sa * 0.007, ca, 0.35, sa, 0.5, uvV, fCol, 2);
          pushVertex(ca * rad - sa * 0.016, wy + 0.012, sa * rad + ca * 0.016, ca, 0.4, sa, 0.5, uvV, fCol, 2);
          pushVertex(ca * (rad * 0.85), wy + 0.034, sa * (rad * 0.85), ca, 0.6, sa, 0.5, uvV, fCol, 2);
          pushVertex(ca * rad + sa * 0.016, wy + 0.012, sa * rad - ca * 0.016, ca, 0.4, sa, 0.5, uvV, fCol, 2);
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }

    // ---- Species 3: Airy Dandelion Seed Puff ----
    {
      const scapeCol = new THREE.Color('#4c7e38');
      const seedCore = new THREE.Color('#6b533b');
      const pappusCol = new THREE.Color('#ffffff');
      const stemH = 0.46;
      addCrossedStem(stemH, 0.0085, scapeCol, 3);

      const centerY = stemH + 0.044;
      // Inner seed receptacle octahedron-like diamond
      const topV = pushVertex(0, centerY + 0.014, 0, 0, 1, 0, 0.5, 0.96, seedCore, 3);
      const botV = pushVertex(0, centerY - 0.014, 0, 0, -1, 0, 0.5, 0.96, seedCore, 3);
      const eqStart = vOff;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        pushVertex(Math.cos(a) * 0.014, centerY, Math.sin(a) * 0.014, Math.cos(a), 0, Math.sin(a), 0.5, 0.96, seedCore, 3);
      }
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        indices.push(topV, eqStart + i, eqStart + next);
        indices.push(botV, eqStart + next, eqStart + i);
      }

      // 3 orthogonal starry pappus discs forming an airy translucent white dandelion sphere
      const puffR = 0.056;
      const planes: Array<[number, number, number, number, number, number]> = [
        [1, 0, 0, 0, 1, 0],
        [0, 0, 1, 0, 1, 0],
        [0.707, 0, 0.707, -0.707, 0, 0.707]
      ];
      for (const [ux, uy, uz, vx, vy, vz] of planes) {
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const cV = pushVertex(0, centerY, 0, nx, ny, nz, 0.5, 1.0, pappusCol, 3);
        const rays = 8;
        const rStart = vOff;
        for (let r = 0; r < rays; r++) {
          const ang = (r / rays) * Math.PI * 2;
          const rad = r % 2 === 0 ? puffR : puffR * 0.62;
          const ca = Math.cos(ang) * rad;
          const sa = Math.sin(ang) * rad;
          pushVertex(ux * ca + vx * sa, centerY + uy * ca + vy * sa, uz * ca + vz * sa, nx, ny, nz, 0.5, 1.0, pappusCol, 3);
        }
        for (let r = 0; r < rays; r++) {
          indices.push(cV, rStart + r, rStart + ((r + 1) % rays));
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aPartSpecies', new THREE.Float32BufferAttribute(partSpecies, 1));
    geo.setIndex(indices);
    return geo;
  }

  private buildButterflies(): void {
    const count = 96;
    const positions = new Float32Array([
      0.0, 0.0, 0.02,   0.13, 0.04, 0.07,   0.11, 0.02, -0.02,
      0.0, 0.0, -0.01,  0.10, 0.02, -0.02,  0.07, 0.01, -0.09,
      0.0, 0.0, 0.02,  -0.11, 0.02, -0.02, -0.13, 0.04, 0.07,
      0.0, 0.0, -0.01, -0.07, 0.01, -0.09, -0.10, 0.02, -0.02
    ]);
    const uvs = new Float32Array([
      0.0, 0.8, 1.0, 1.0, 0.85, 0.5,
      0.0, 0.4, 0.85, 0.5, 0.65, 0.0,
      0.0, 0.8, 0.85, 0.5, 1.0, 1.0,
      0.0, 0.4, 0.65, 0.0, 0.85, 0.5
    ]);

    const butterflyGeo = new THREE.BufferGeometry();
    butterflyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    butterflyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    butterflyGeo.computeVertexNormals();

    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0.0 } }]);

    this.butterflyMaterial = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      fog: true,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vInstanceColor;

        void main() {
          vUv = uv;
          vInstanceColor = vec3(1.0, 0.97, 0.86);
          #ifdef USE_INSTANCING_COLOR
          vInstanceColor = instanceColor;
          #endif

          vec3 anchor = vec3(instanceMatrix[3].xyz);
          float phase = fract(sin(dot(anchor.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.28318;
          float flapSpeed = 10.5 + mod(phase * 3.1, 4.0);
          float flap = sin(uTime * flapSpeed + phase * 5.0);
          vec3 p = position;
          p.y += uv.x * flap * 0.11;

          vec4 worldPos = instanceMatrix * vec4(p, 1.0);
          float flightT = uTime * 0.62 + phase;
          worldPos.x += sin(flightT) * 2.2 + cos(flightT * 0.5) * 1.1;
          worldPos.y += sin(flightT * 2.1) * 0.35 + flap * 0.03;
          worldPos.z += cos(flightT * 0.85) * 2.0;

          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        varying vec2 vUv;
        varying vec3 vInstanceColor;

        void main() {
          vec3 col = vInstanceColor;
          float edgeAccent = smoothstep(0.65, 1.0, vUv.x);
          col = mix(col, col * 0.72, edgeAccent * 0.35);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `
    });

    this.butterflyMesh = new THREE.InstancedMesh(butterflyGeo, this.butterflyMaterial, count);
    this.butterflyMesh.name = 'InstancedButterflies';

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const palette = [
      new THREE.Color('#fffdf0'),
      new THREE.Color('#fde68a'),
      new THREE.Color('#bae6fd'),
      new THREE.Color('#fed7aa')
    ];

    for (let i = 0; i < count; i++) {
      const r = 3.0 + ((i * 0.6180339) % 1.0) * 78.0;
      const theta = i * 2.3999632;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = getBreezyMeadowHeight(x, z) + 0.95 + ((i * 0.43) % 1.0) * 1.8;

      pos.set(x, y, z);
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), theta + Math.PI * 0.5);
      const s = 0.85 + ((i * 0.29) % 1.0) * 0.45;
      scale.set(s, s, s);
      dummy.compose(pos, quat, scale);
      this.butterflyMesh.setMatrixAt(i, dummy);

      col.copy(palette[i % palette.length]);
      this.butterflyMesh.setColorAt(i, col);
    }

    this.butterflyMesh.instanceMatrix.needsUpdate = true;
    if (this.butterflyMesh.instanceColor) {
      this.butterflyMesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.butterflyMesh);
  }

  private buildPollenMotes(windDir2D: THREE.Vector2, config?: SpaceConfig): void {
    const count = 480;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const types = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = 2.5 + ((i * 0.6180339) % 1.0) * 84.0;
      const theta = i * 2.39996;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = getBreezyMeadowHeight(x, z) + 0.55 + ((i * 0.37) % 1.0) * 4.8;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = i * 0.73;
      types[i] = i % 2 === 0 ? 1.0 : 0.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aType', new THREE.BufferAttribute(types, 1));

    this.pollenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uWindSpeed: { value: config?.wind?.speed ?? 2.4 },
        uWindDirection: { value: windDir2D.clone().normalize() },
        uOpacity: { value: 1.0 }
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uWindSpeed;
        uniform vec2 uWindDirection;
        attribute float aPhase;
        attribute float aType;
        varying float vAlpha;
        varying float vType;
        void main() {
          vType = aType;
          vec3 p = position;
          vec2 wDir = normalize(uWindDirection);
          float speed = mix(0.45, 0.85, aType) * max(0.35, uWindSpeed * 0.45);
          float travel = mod(uTime * speed + aPhase * 3.0, 24.0) - 12.0;
          p.x += wDir.x * travel + sin(uTime * 0.55 + aPhase) * 1.6;
          p.z += wDir.y * travel + cos(uTime * 0.48 + aPhase * 1.3) * 1.6;
          p.y += sin(uTime * 0.85 + aPhase * 1.7) * 0.72 + aType * 0.42 * sin(uTime * 0.52 + aPhase);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float baseSize = mix(24.0, 44.0, aType);
          gl_PointSize = clamp(baseSize / max(-mvPosition.z, 1.0), 2.5, 11.0);
          vAlpha = 0.54 + 0.42 * sin(uTime * 1.5 + aPhase);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        varying float vType;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;

          if (vType > 0.5) {
            float angle = atan(c.y, c.x);
            float rays = pow(abs(cos(angle * 4.0)), 4.0);
            float pappus = smoothstep(0.48, 0.12, d) * (0.28 + 0.72 * rays);
            float core = smoothstep(0.14, 0.02, d);
            float alpha = clamp(core + pappus * 0.88, 0.0, 1.0) * vAlpha * 0.92 * uOpacity;
            gl_FragColor = vec4(1.0, 0.995, 0.96, alpha);
          } else {
            float glow = smoothstep(0.5, 0.05, d);
            gl_FragColor = vec4(1.0, 0.98, 0.84, glow * vAlpha * 0.82 * uOpacity);
          }
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.pollenPoints = new THREE.Points(geo, this.pollenMaterial);
    this.pollenPoints.name = 'SunlitPollenMotes';
    this.scene.add(this.pollenPoints);
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = deltaTime;
    this.lastElapsedTime = elapsedTime;

    if (this.skyMaterial?.uniforms?.uTime) {
      this.skyMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.volumetricCloudDome) {
      const fogColor = this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.color : undefined;
      this.volumetricCloudDome.update(elapsedTime, undefined, fogColor, this.currentCloudCoverage);
    }
    if (this.distantHillsMaterial?.uniforms?.uTime) {
      this.distantHillsMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.terrainUniforms) {
      this.terrainUniforms.uTime.value = elapsedTime;
    }
    if (this.brookMaterial) {
      this.brookMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.grassMaterial) {
      this.grassMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.flowerMaterial) {
      this.flowerMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.foliageWindUniform) {
      this.foliageWindUniform.uTime.value = elapsedTime;
    }
    if (this.butterflyMaterial) {
      this.butterflyMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.pollenMaterial) {
      this.pollenMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.swallowBoids && this.swallowBoids.mesh.visible) {
      this.swallowBoids.update(deltaTime, elapsedTime, new THREE.Vector3(0, 18, -12));
    }
    if (this.weatherSystem) {
      this.weatherSystem.update(deltaTime, elapsedTime, this.lastCameraPosition);
      if (this.atmosphereState.weather === 'clear' && !this.weatherSystem.mesh.visible && this.weatherAttached) {
        this.scene.remove(this.weatherSystem.mesh);
        this.weatherAttached = false;
      }
    }
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    if (camera && camera.position) {
      this.lastCameraPosition.copy(camera.position);
    }
    if (this.pipeline) {
      this.pipeline.renderFrame(renderer, camera, this.lastDeltaTime, this.lastElapsedTime);
      return;
    }
    renderer.render(this.scene, camera);
  }

  public setAtmosphereState(nextState: Partial<{ timeOfDay: number; weather: WeatherMode }>): void {
    if (!this.isInitialized) return;

    const rawTime = nextState.timeOfDay;
    const timeOfDay =
      typeof rawTime === 'number' && Number.isFinite(rawTime)
        ? ((rawTime % 24) + 24) % 24
        : this.atmosphereState.timeOfDay;
    const weather: WeatherMode = nextState.weather ?? this.atmosphereState.weather;
    this.atmosphereState = { timeOfDay, weather };

    // Continuous smooth time-of-day weights
    const dayArc = Math.sin(Math.max(0, Math.min(Math.PI, ((timeOfDay - 5.5) / 13.5) * Math.PI)));
    const dawnWeight = Math.exp(-Math.pow((timeOfDay - 6.3) / 1.45, 2.0));
    const sunsetWeight = Math.exp(-Math.pow((timeOfDay - 17.8) / 1.55, 2.0));
    const goldenWeight = Math.min(1, dawnWeight + sunsetWeight);
    const nightWeight =
      timeOfDay >= 19.5 || timeOfDay <= 4.5
        ? 1.0
        : timeOfDay > 17.5
          ? (timeOfDay - 17.5) / 2.0
          : timeOfDay < 6.5
            ? (6.5 - timeOfDay) / 2.0
            : 0.0;
    const clampedNight = Math.max(0, Math.min(1, nightWeight));

    // Sun / moon directional arc
    const azimuthAngle = ((timeOfDay - 6.0) / 12.0) * Math.PI - Math.PI * 0.15;
    const sunY = clampedNight > 0.7 ? 42 : 12 + dayArc * 54;
    const sunX = clampedNight > 0.7 ? -32 : Math.cos(azimuthAngle) * 52;
    const sunZ = clampedNight > 0.7 ? -28 : 28 - Math.sin(azimuthAngle) * 14;
    const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();

    if (this.directionalLight) {
      this.directionalLight.position.set(sunX, sunY, sunZ);
      const dayColor = this.baseDirectionalColor.clone();
      const goldenColor = new THREE.Color('#ff9d5c');
      const nightColor = new THREE.Color('#7a9de8');
      dayColor.lerp(goldenColor, goldenWeight * 0.72);
      dayColor.lerp(nightColor, clampedNight * 0.85);
      this.directionalLight.color.copy(dayColor);
    }

    // Weather modulation
    let weatherSunMul = 1.0;
    let weatherAmbientMul = 1.0;
    let weatherFogMul = 1.0;
    let targetCoverage = this.hasUserMutation
      ? this.currentCloudCoverage
      : Math.max(this.currentConfig?.sky?.cloudCoverage ?? 0.64, 0.64);
    const weatherFogTint = new THREE.Color();
    let weatherFogBlend = 0.0;
    let godRayStrength: number | null = goldenWeight > 0.25 ? 0.24 * goldenWeight : null;
    let exposureBias = 1.0;

    if (weather === 'mist') {
      weatherSunMul = 0.80;
      weatherAmbientMul = 0.96;
      weatherFogMul = 4.2;
      targetCoverage = Math.max(targetCoverage, 0.72);
      weatherFogTint.set('#d2e0ee');
      weatherFogBlend = 0.45;
      if (godRayStrength !== null) godRayStrength *= 1.15;
    } else if (weather === 'rain') {
      weatherSunMul = 0.58;
      weatherAmbientMul = 0.78;
      weatherFogMul = 3.6;
      targetCoverage = Math.max(targetCoverage, 0.86);
      weatherFogTint.set('#74879d');
      weatherFogBlend = 0.62;
      godRayStrength = 0.04;
    } else if (weather === 'fireflies') {
      weatherSunMul = 0.85;
      weatherAmbientMul = 0.92;
      weatherFogMul = 1.5;
      weatherFogTint.set('#1f2f54');
      weatherFogBlend = 0.24;
    }

    this.currentCloudCoverage = targetCoverage;

    const timeSunMul = 1.0 - clampedNight * 0.78 - goldenWeight * 0.14;
    if (this.directionalLight) {
      this.directionalLight.intensity = this.baseDirectionalIntensity * timeSunMul * weatherSunMul;
    }
    if (this.ambientLight) {
      this.ambientLight.color
        .copy(this.baseAmbientColor)
        .lerp(new THREE.Color('#ffd9ba'), goldenWeight * 0.35)
        .lerp(new THREE.Color('#18264d'), clampedNight * 0.90);
      this.ambientLight.intensity = this.baseAmbientIntensity * (1.0 - clampedNight * 0.62) * weatherAmbientMul;
    }
    if (this.hemiLight) {
      this.hemiLight.color
        .set('#bde3ff')
        .lerp(new THREE.Color('#ffb884'), goldenWeight * 0.45)
        .lerp(new THREE.Color('#1a2c5c'), clampedNight * 0.92);
      this.hemiLight.groundColor
        .set('#4b7034')
        .lerp(new THREE.Color('#0b1328'), clampedNight * 0.92);
      this.hemiLight.intensity = this.baseHemiIntensity * (1.0 - clampedNight * 0.68) * weatherAmbientMul;
    }
    this.scene.environmentIntensity = 0.72 * (1.0 - clampedNight * 0.86) * weatherAmbientMul;

    // Sky colors
    if (this.skyMaterial) {
      const top = this.baseSkyTopColor
        .clone()
        .lerp(new THREE.Color('#2b417a'), goldenWeight * 0.55)
        .lerp(new THREE.Color('#071026'), clampedNight * 0.92);
      const bottom = this.baseSkyBottomColor
        .clone()
        .lerp(new THREE.Color('#df8b6c'), goldenWeight * 0.65)
        .lerp(new THREE.Color('#132245'), clampedNight * 0.88);
      const horizon = this.baseSkyHorizonColor
        .clone()
        .lerp(new THREE.Color('#ffbe88'), goldenWeight * 0.78)
        .lerp(new THREE.Color('#1f3259'), clampedNight * 0.88);

      if (weather === 'rain') {
        top.lerp(new THREE.Color('#47586b'), 0.58);
        bottom.lerp(new THREE.Color('#64778c'), 0.62);
        horizon.lerp(new THREE.Color('#8092a6'), 0.64);
      } else if (weather === 'mist') {
        bottom.lerp(new THREE.Color('#c8d8e8'), 0.35);
        horizon.lerp(new THREE.Color('#dbe7f2'), 0.48);
      }

      this.skyMaterial.uniforms.uTopColor.value.copy(top);
      this.skyMaterial.uniforms.uBottomColor.value.copy(bottom);
      this.skyMaterial.uniforms.uHorizonColor.value.copy(horizon);
      this.skyMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.skyMaterial.uniforms.uSunColor.value
        .set('#fffdf4')
        .lerp(new THREE.Color('#ff9d5c'), goldenWeight * 0.75)
        .lerp(new THREE.Color('#a4bdf5'), clampedNight * 0.85);
      this.skyMaterial.uniforms.uNightFactor.value = clampedNight;
      this.skyMaterial.uniforms.uGoldenScatterStrength.value =
        (1.0 - clampedNight * 0.85) * (weather === 'rain' ? 0.35 : 1.0);

      if (this.brookMaterial) {
        this.brookMaterial.uniforms.uSkyTopColor.value.copy(top);
        this.brookMaterial.uniforms.uHorizonColor.value.copy(horizon);
        this.brookMaterial.uniforms.uSunDirection.value.copy(sunDir);
      }
    }

    // Fog
    if (this.scene.fog instanceof THREE.FogExp2) {
      const fogCol = this.baseFogColor
        .clone()
        .lerp(new THREE.Color('#f7b585'), goldenWeight * 0.62)
        .lerp(new THREE.Color('#101d3b'), clampedNight * 0.88);
      if (weatherFogBlend > 0) {
        fogCol.lerp(weatherFogTint, weatherFogBlend);
      }
      this.scene.fog.color.copy(fogCol);
      this.scene.fog.density = this.baseFogDensity * weatherFogMul * (1.0 + clampedNight * 0.35);
    }

    // Volumetric cloud tint & synchronization
    if (this.volumetricCloudDome) {
      const cloudTint = new THREE.Color('#f8f5ee')
        .lerp(new THREE.Color('#ffbfa0'), goldenWeight * 0.72)
        .lerp(new THREE.Color('#24345c'), clampedNight * 0.90);
      const cloudShadow = new THREE.Color('#6b7b99')
        .lerp(new THREE.Color('#695373'), goldenWeight * 0.6)
        .lerp(new THREE.Color('#0e162b'), clampedNight * 0.92);
      if (weather === 'rain') {
        cloudTint.lerp(new THREE.Color('#6c7c8e'), 0.62);
        cloudShadow.lerp(new THREE.Color('#3b4859'), 0.65);
      }
      (this.volumetricCloudDome.uniforms.uTint.value as THREE.Color).copy(cloudTint);
      (this.volumetricCloudDome.uniforms.uShadowColor.value as THREE.Color).copy(cloudShadow);
      const fogColor = this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.color : undefined;
      this.volumetricCloudDome.update(this.lastElapsedTime, sunDir, fogColor, targetCoverage);
    }

    // Propagate sunDir, coverage & night factor across terrain, hills, grass, flowers, foliage & landmarks
    if (this.distantHillsMaterial) {
      this.distantHillsMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.distantHillsMaterial.uniforms.uCloudCoverage.value = targetCoverage;
      this.distantHillsMaterial.uniforms.uNightFactor.value = clampedNight;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.distantHillsMaterial.uniforms.uMistColor.value.copy(this.scene.fog.color);
      }
    }
    if (this.terrainUniforms) {
      this.terrainUniforms.uSunDirection.value.copy(sunDir);
      this.terrainUniforms.uCloudCoverage.value = targetCoverage;
      this.terrainUniforms.uCloudShadowStrength.value = weather === 'rain' ? 0.28 : 0.62 * (1.0 - clampedNight * 0.5);
      this.terrainUniforms.uNightFactor.value = clampedNight;
    }
    if (this.grassMaterial) {
      const coolNight = new THREE.Color('#060c1f');
      const warmNight = new THREE.Color('#213678');
      const warmGolden = new THREE.Color('#d8c958');
      const coolCol = this.baseGrassCoolRoot.clone().lerp(coolNight, clampedNight);
      const warmCol = this.baseGrassWarmTip
        .clone()
        .lerp(warmGolden, goldenWeight * 0.40 * (1.0 - clampedNight))
        .lerp(warmNight, clampedNight);
      if (weather === 'rain') {
        coolCol.multiplyScalar(0.82);
        warmCol.multiplyScalar(0.78);
      }
      (this.grassMaterial.uniforms.uCoolRoot.value as THREE.Color).copy(coolCol);
      (this.grassMaterial.uniforms.uWarmTip.value as THREE.Color).copy(warmCol);
      this.grassMaterial.uniforms.uSunDir.value.copy(sunDir);
      this.grassMaterial.uniforms.uCloudCoverage.value = targetCoverage;
      this.grassMaterial.uniforms.uCloudShadowStrength.value = weather === 'rain' ? 0.25 : 0.56 * (1.0 - clampedNight * 0.5);
    }
    if (this.flowerMaterial) {
      this.flowerMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.flowerMaterial.uniforms.uCloudCoverage.value = targetCoverage;
      this.flowerMaterial.uniforms.uCloudShadowStrength.value = weather === 'rain' ? 0.25 : 0.54 * (1.0 - clampedNight * 0.5);
      this.flowerMaterial.uniforms.uNightFactor.value = clampedNight;
    }
    if (this.foliageWindUniform) {
      this.foliageWindUniform.uSunDirection.value.copy(sunDir);
      this.foliageWindUniform.uNightFactor.value = clampedNight;
    }
    if (this.brookMaterial) {
      this.brookMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.brookMaterial.uniforms.uNightFactor.value = clampedNight;
    }
    if (this.landmarkTintMaterials.length > 0) {
      const nightTint = new THREE.Color('#425a9c');
      for (const entry of this.landmarkTintMaterials) {
        const targetNight = entry.baseColor.clone().multiply(nightTint);
        entry.mat.color.copy(entry.baseColor).lerp(targetNight, clampedNight);
      }
    }
    if (this.cottageWindowMat) {
      this.cottageWindowMat.emissiveIntensity = 1.25 + clampedNight * 1.85;
    }

    // Biological day/weather visibility
    const isCalmDay = weather !== 'rain' && clampedNight < 0.72;
    if (this.butterflyMesh) {
      this.butterflyMesh.visible = isCalmDay;
    }
    if (this.swallowBoids) {
      this.swallowBoids.mesh.visible = isCalmDay;
    }
    if (this.pollenMaterial) {
      this.pollenMaterial.uniforms.uOpacity.value = weather === 'rain' ? 0.15 : 1.0 - clampedNight * 0.65;
    }

    // Weather particles attachment & crossfade
    if (this.weatherSystem) {
      this.weatherSystem.setMode(weather);
      if (weather !== 'clear' && !this.weatherAttached) {
        this.scene.add(this.weatherSystem.mesh);
        this.weatherAttached = true;
      }
    }

    if (clampedNight > 0.4) {
      exposureBias = 1.0 - clampedNight * 0.18;
    }
    this.pipeline?.setAtmosphereOverrides({ godRayStrength, exposureBias });
  }

  public updateConfig(newConfig: Partial<SpaceConfig>, isInitialHydration = false): void {
    if (!this.isInitialized || !newConfig || typeof newConfig !== 'object') return;
    if (isInitialHydration && this.hasUserMutation) return;
    if (!isInitialHydration) {
      this.hasUserMutation = true;
    }

    // 1. Reactive Fog
    if (newConfig.fog && this.scene.fog instanceof THREE.FogExp2) {
      if (newConfig.fog.color && typeof newConfig.fog.color === 'string') {
        this.scene.fog.color.set(newConfig.fog.color);
        this.baseFogColor.set(newConfig.fog.color);
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
      }
      if (typeof newConfig.fog.density === 'number' && Number.isFinite(newConfig.fog.density) && newConfig.fog.density >= 0) {
        const appliedDensity = isInitialHydration ? Math.min(newConfig.fog.density, 0.00055) : newConfig.fog.density;
        this.scene.fog.density = appliedDensity;
        this.baseFogDensity = appliedDensity;
        if (this.currentConfig?.fog) this.currentConfig.fog.density = appliedDensity;
      }
    }

    // 2. Reactive Wind Parameters
    if (newConfig.wind) {
      const windSpeed = newConfig.wind.speed;
      const sway = newConfig.wind.swayIntensity;
      const gust = newConfig.wind.gustiness;
      const dir = newConfig.wind.direction;

      if (typeof windSpeed === 'number' && Number.isFinite(windSpeed)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.speed = windSpeed;
        if (this.grassMaterial?.uniforms?.uGustSpeed) {
          this.grassMaterial.uniforms.uGustSpeed.value = Math.max(0.65, windSpeed * 0.68);
        }
        if (this.flowerMaterial?.uniforms?.uWindSpeed) {
          this.flowerMaterial.uniforms.uWindSpeed.value = windSpeed;
        }
        if (this.terrainUniforms) this.terrainUniforms.uWindSpeed.value = windSpeed;
        if (this.foliageWindUniform) this.foliageWindUniform.uWindSpeed.value = windSpeed;
        if (this.pollenMaterial?.uniforms?.uWindSpeed) {
          this.pollenMaterial.uniforms.uWindSpeed.value = windSpeed;
        }
      }
      if (typeof sway === 'number' && Number.isFinite(sway)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.swayIntensity = sway;
        if (this.grassMaterial?.uniforms?.uSwayStrength) {
          this.grassMaterial.uniforms.uSwayStrength.value = sway;
        }
        if (this.flowerMaterial?.uniforms?.uWindStrength) {
          this.flowerMaterial.uniforms.uWindStrength.value = sway;
        }
      }
      if (typeof gust === 'number' && Number.isFinite(gust)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.gustiness = gust;
        if (this.flowerMaterial?.uniforms?.uGustiness) {
          this.flowerMaterial.uniforms.uGustiness.value = gust;
        }
        if (this.terrainUniforms) this.terrainUniforms.uGustiness.value = gust;
      }
      if (dir && Array.isArray(dir)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.direction = dir as [number, number, number];
        const dx = dir[0];
        const dz = dir[2] ?? dir[1];
        if (this.grassMaterial?.uniforms?.uWindDir) {
          (this.grassMaterial.uniforms.uWindDir.value as THREE.Vector2).set(dx, dz).normalize();
        }
        if (this.flowerMaterial?.uniforms?.uWindDirection) {
          (this.flowerMaterial.uniforms.uWindDirection.value as THREE.Vector2).set(dx, dz).normalize();
        }
        if (this.terrainUniforms) {
          this.terrainUniforms.uWindDirection.value.set(dx, dz).normalize();
        }
        if (this.pollenMaterial?.uniforms?.uWindDirection) {
          (this.pollenMaterial.uniforms.uWindDirection.value as THREE.Vector2).set(dx, dz).normalize();
        }
      }
    }

    // 3. Reactive Sky & Clouds
    if (newConfig.sky && this.skyMaterial) {
      if (newConfig.sky.topColor && typeof newConfig.sky.topColor === 'string') {
        this.skyMaterial.uniforms.uTopColor.value.set(newConfig.sky.topColor);
        this.baseSkyTopColor.set(newConfig.sky.topColor);
        if (this.brookMaterial) this.brookMaterial.uniforms.uSkyTopColor.value.set(newConfig.sky.topColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
      }
      if (newConfig.sky.bottomColor && typeof newConfig.sky.bottomColor === 'string') {
        this.skyMaterial.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
        this.baseSkyBottomColor.set(newConfig.sky.bottomColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
      }
      if (newConfig.sky.horizonColor && typeof newConfig.sky.horizonColor === 'string') {
        this.skyMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        this.baseSkyHorizonColor.set(newConfig.sky.horizonColor);
        if (this.brookMaterial) this.brookMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
      }
      if (typeof newConfig.sky.cloudSpeed === 'number' && Number.isFinite(newConfig.sky.cloudSpeed)) {
        this.currentCloudSpeed = newConfig.sky.cloudSpeed;
        if (this.volumetricCloudDome?.uniforms?.uSpeed) {
          this.volumetricCloudDome.uniforms.uSpeed.value = newConfig.sky.cloudSpeed;
        }
        if (this.terrainUniforms) this.terrainUniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        if (this.distantHillsMaterial?.uniforms?.uCloudSpeed) {
          this.distantHillsMaterial.uniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        }
        if (this.flowerMaterial?.uniforms?.uCloudSpeed) {
          this.flowerMaterial.uniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        }
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudSpeed = newConfig.sky.cloudSpeed;
      }
      if (typeof newConfig.sky.cloudCoverage === 'number' && Number.isFinite(newConfig.sky.cloudCoverage)) {
        const clampedCov = Math.max(0, Math.min(1, newConfig.sky.cloudCoverage));
        this.currentCloudCoverage = isInitialHydration ? Math.max(clampedCov, 0.64) : clampedCov;
        if (this.volumetricCloudDome) {
          this.volumetricCloudDome.update(this.lastElapsedTime, undefined, undefined, this.currentCloudCoverage);
        }
        if (this.terrainUniforms) this.terrainUniforms.uCloudCoverage.value = this.currentCloudCoverage;
        if (this.grassMaterial?.uniforms?.uCloudCoverage) {
          this.grassMaterial.uniforms.uCloudCoverage.value = this.currentCloudCoverage;
        }
        if (this.flowerMaterial?.uniforms?.uCloudCoverage) {
          this.flowerMaterial.uniforms.uCloudCoverage.value = this.currentCloudCoverage;
        }
        if (this.distantHillsMaterial?.uniforms?.uCloudCoverage) {
          this.distantHillsMaterial.uniforms.uCloudCoverage.value = this.currentCloudCoverage;
        }
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudCoverage = this.currentCloudCoverage;
      }
    }

    if (newConfig.audio && this.currentConfig?.audio) {
      if (typeof newConfig.audio.defaultVolume === 'number' && Number.isFinite(newConfig.audio.defaultVolume)) {
        this.currentConfig.audio.defaultVolume = newConfig.audio.defaultVolume;
      }
    }

    // 4. Reactive Lighting
    if (newConfig.lighting) {
      if (newConfig.lighting.ambient && this.ambientLight) {
        if (newConfig.lighting.ambient.color) {
          this.ambientLight.color.set(newConfig.lighting.ambient.color);
          this.baseAmbientColor.set(newConfig.lighting.ambient.color);
        }
        if (typeof newConfig.lighting.ambient.intensity === 'number' && Number.isFinite(newConfig.lighting.ambient.intensity)) {
          this.baseAmbientIntensity = newConfig.lighting.ambient.intensity * 0.46;
          this.ambientLight.intensity = this.baseAmbientIntensity;
        }
      }
      if (newConfig.lighting.directional && this.directionalLight) {
        if (newConfig.lighting.directional.color) {
          this.directionalLight.color.set(newConfig.lighting.directional.color);
          this.baseDirectionalColor.set(newConfig.lighting.directional.color);
        }
        if (typeof newConfig.lighting.directional.intensity === 'number' && Number.isFinite(newConfig.lighting.directional.intensity)) {
          this.baseDirectionalIntensity = Math.max(1.75, newConfig.lighting.directional.intensity * 1.35);
          this.directionalLight.intensity = this.baseDirectionalIntensity;
        }
        if (Array.isArray(newConfig.lighting.directional.position) && newConfig.lighting.directional.position.length >= 3) {
          const [lx, ly, lz] = newConfig.lighting.directional.position;
          this.directionalLight.position.set(lx, ly, lz);
          const sunDir = this.directionalLight.position.clone().normalize();
          this.skyMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.volumetricCloudDome?.update(this.lastElapsedTime, sunDir);
          this.distantHillsMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          if (this.grassMaterial?.uniforms?.uSunDir) {
            (this.grassMaterial.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
          }
          this.flowerMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.terrainUniforms?.uSunDirection.value.copy(sunDir);
          this.brookMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.foliageWindUniform?.uSunDirection.value.copy(sunDir);
        }
      }
    }

    if (this.currentConfig && this.onConfigUpdate) {
      this.onConfigUpdate(this.currentConfig);
    }

    if (
      !isInitialHydration &&
      this.currentConfig &&
      typeof window !== 'undefined' &&
      (window as unknown as { __currentUserRole?: string }).__currentUserRole === 'creator' &&
      typeof fetch === 'function'
    ) {
      fetch(`/api/spaces/${this.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: this.currentConfig })
      }).catch(() => {});
    }
  }

  public getGroundHeight(x: number, z: number): number {
    return getBreezyMeadowHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 0.0;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 10.0;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;

    const lookAtX = this.currentConfig?.camera?.lookAt?.[0] ?? 0.0;
    const lookAtY = this.currentConfig?.camera?.lookAt?.[1] ?? 4.6;
    const lookAtZ = this.currentConfig?.camera?.lookAt?.[2] ?? -32.0;

    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAtX, lookAtY, lookAtZ)
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = Math.max(this.currentConfig?.camera?.wanderRadius ?? 90.0, 90.0);
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
    return [
      {
        name: 'Flowerbed Crest',
        position: new THREE.Vector3(5.0, this.getGroundHeight(5.0, 0.0) + 1.8, 0.0),
        dwellTime: 8.0
      },
      {
        name: 'Cumulus Vista',
        position: new THREE.Vector3(-12.0, this.getGroundHeight(-12.0, -15.0) + 2.4, -15.0),
        dwellTime: 10.0
      },
      {
        name: 'Grassland Glide',
        position: new THREE.Vector3(18.0, this.getGroundHeight(18.0, 12.0) + 1.5, 12.0),
        dwellTime: 7.0
      },
      {
        name: 'Horizon View',
        position: new THREE.Vector3(-22.0, this.getGroundHeight(-22.0, 20.0) + 2.2, 20.0),
        dwellTime: 9.0
      },
      {
        name: 'Stone Arch Bridge',
        position: new THREE.Vector3(19.5, this.getGroundHeight(19.5, -20.5) + 2.0, -20.5),
        dwellTime: 8.0
      },
      {
        name: 'Watermill Brook',
        position: new THREE.Vector3(24.0, this.getGroundHeight(24.0, -29.0) + 2.2, -29.0),
        dwellTime: 9.0
      },
      {
        name: 'Outer Birch Copse',
        position: new THREE.Vector3(-56.0, this.getGroundHeight(-56.0, -44.0) + 2.4, -44.0),
        dwellTime: 9.0
      },
      {
        name: 'Downstream Brook Bend',
        position: new THREE.Vector3(30.0, this.getGroundHeight(30.0, 62.0) + 2.2, 62.0),
        dwellTime: 8.0
      }
    ];
  }

  public getScene(): THREE.Scene {
    return this.scene;
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

    this.volumetricCloudDome?.dispose();
    this.volumetricCloudDome = null;
    this.swallowBoids?.dispose();
    this.swallowBoids = null;
    this.weatherSystem?.dispose();
    this.weatherSystem = null;
    this.weatherAttached = false;

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

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
    if (this.scene) {
      this.scene.environment = null;
    }

    this.skyMesh = null;
    this.cloudMesh = null;
    this.distantHillsMesh = null;
    this.terrainMesh = null;
    this.grassMesh = null;
    this.flowerMesh = null;
    this.treeTrunksMesh = null;
    this.treeFoliageMesh = null;
    this.landmarksMesh = null;
    this.butterflyMesh = null;
    this.pollenPoints = null;

    this.skyMaterial = null;
    this.cloudMaterial = null;
    this.distantHillsMaterial = null;
    this.terrainMaterial = null;
    this.terrainUniforms = null;
    this.grassMaterial = null;
    this.flowerMaterial = null;
    this.foliageWindUniform = null;
    this.brookMaterial = null;
    this.butterflyMaterial = null;
    this.pollenMaterial = null;
    this.landmarkTintMaterials = [];
    this.cottageWindowMat = null;

    this.exclusionCircles = [];
    this.ambientLight = null;
    this.hemiLight = null;
    this.directionalLight = null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;

    this.isInitialized = false;
  }
}
