import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SkyConfig, SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { createGrassSwayMaterial, createWildflowerMaterial } from '../shaders/grassSwayShader';
import {
  createVolumetricCloudDome,
  VolumetricCloudDomeHandle
} from '../shaders/volumetricCloudShader';
import {
  createLivingBoidsSystem,
  createWeatherParticlesSystem,
  LivingBoidsHandle,
  WeatherMode,
  WeatherParticlesHandle
} from '../shaders/livingNatureSystem';
import {
  PbrTextureSet,
  applyWorldSpaceWeathering,
  createGraniteCliffPbrTextures,
  createOakBarkPbrTextures,
  disposePbrTextureSet
} from '../textures/pbrTextures';
import {
  applyLimestoneCanyonStrata,
  createBlossomPetalsMaterial,
  createCarraraMarblePbrTextures,
  createCelestialMedallionMaterial,
  createCelestialTurfPbrTextures,
  createCloudBillowMaterial,
  createCloudSeaMaterial,
  createCrystalWaterMaterial,
  createFloatingWaterPetalsMaterial,
  createGoldenLightMotesMaterial,
  createHangingVineMaterial,
  createHeavenlyGodRayMaterial,
  createParadiseGroundPbrMaterial,
  createParadiseSkyMaterial,
  createParadiseWaterfallMaterial,
  createRainbowAuroraMaterial,
  createSakuraBarkMaterial,
  createSakuraBlossomAtlasTexture,
  createSakuraFoliageCardMaterial,
  createWaterfallMistPoolMaterial,
  createWaterfallSprayMaterial
} from '../shaders/paradiseShader';

interface LanternTransform {
  x: number;
  y: number;
  z: number;
  phase: number;
}

interface IsletConfig {
  x: number;
  y: number;
  z: number;
  r: number;
  h: number;
}

function smoothstepJS(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function pseudoRand(seed: number): number {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function distToSegment2D(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const pax = px - ax;
  const paz = pz - az;
  const bax = bx - ax;
  const baz = bz - az;
  const denom = bax * bax + baz * baz;
  const h = denom > 1e-6 ? Math.max(0, Math.min(1, (pax * bax + paz * baz) / denom)) : 0;
  return Math.hypot(pax - bax * h, paz - baz * h);
}

/**
 * Analytical walkable floating sanctuary elevation h(x, z) in O(1) time.
 * Forms a grand marble courtyard, level elevated temple dais at (0, -14),
 * shallow crystal reflecting pool at (0, 2), gently curved celestial garden terraces across [-42, 42],
 * arched golden-marble footbridges at (|x| in [34, 41], z ~ -10), and walkable outer garden terraces at (±48, -10).
 */
export function getParadiseHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const dTemple = Math.hypot(x, z + 14.0);
  const dPool = Math.hypot(x, z - 2.0);

  const daisRise = 1.0 - smoothstepJS(6.4, 10.8, dTemple);
  const dais = 1.15 * daisRise;

  const poolCarve = 1.0 - smoothstepJS(4.4, 5.5, dPool);
  const poolBasin = -0.18 * poolCarve;

  const cos2Theta = r > 1e-4 ? (x * x - z * z) / (r * r) : 0.0;
  const flatFactor = 1.0 - daisRise;
  const terrace = 0.72 * smoothstepJS(12.0, 22.0, r) * (0.55 + 0.45 * cos2Theta) * flatFactor;
  const undulation =
    0.22 *
    Math.sin(0.11 * x + 0.4) *
    Math.cos(0.11 * z - 0.2) *
    smoothstepJS(11.0, 19.0, r) *
    flatFactor;

  const cliffTaper = -0.55 * smoothstepJS(37.5, 42.5, r);
  const mainH = dais + poolBasin + terrace + undulation + cliffTaper;

  // Walkable East & West Outer Celestial Terraces centered at (±48, -10), radius 11.4m
  const dEastOuter = Math.hypot(x - 48.0, z + 10.0);
  const dWestOuter = Math.hypot(x + 48.0, z + 10.0);
  const dOuter = Math.min(dEastOuter, dWestOuter);
  const outerMask = 1.0 - smoothstepJS(9.8, 12.0, dOuter);
  const outerPavDais = 0.42 * (1.0 - smoothstepJS(3.6, 5.6, dOuter));
  const outerH = 0.85 + outerPavDais - 0.25 * smoothstepJS(9.0, 11.4, dOuter);

  // Arched Golden-Marble Footbridges linking main island (|x|=34) to outer terraces (|x|=39.5) along z = -10
  const absX = Math.abs(x);
  const bridgeSpanMask =
    smoothstepJS(33.2, 34.4, absX) *
    (1.0 - smoothstepJS(39.2, 40.4, absX)) *
    (1.0 - smoothstepJS(1.8, 2.8, Math.abs(z + 10.0)));
  const bridgeU = Math.max(0.0, Math.min(1.0, (absX - 33.8) / 5.8));
  const bridgeArchH = 0.75 + 1.05 * Math.sin(bridgeU * Math.PI);

  // Blended main island + East/West inner terraces + 4 outer sanctuary islands & arched sky-walkways
  const blendedInner = mainH * (1.0 - outerMask) + outerH * outerMask;
  let result = blendedInner * (1.0 - bridgeSpanMask) + bridgeArchH * bridgeSpanMask;

  // Far East & Far West Cherry-Blossom Sanctuaries at (±84, -10), radius 16.5m
  const dFarEW = Math.min(Math.hypot(x - 84.0, z + 10.0), Math.hypot(x + 84.0, z + 10.0));
  const farEWMask = 1.0 - smoothstepJS(14.8, 17.2, dFarEW);
  const farEWDais = 0.48 * (1.0 - smoothstepJS(5.0, 7.2, dFarEW));
  const farEWH = 1.65 + farEWDais - 0.30 * smoothstepJS(13.8, 16.5, dFarEW);
  result = result * (1.0 - farEWMask) + farEWH * farEWMask;

  // Outer East & West Arched Carrara Marble Sky-Walkways (|x| in [57.2..69.2], z = -10)
  const outerEWBridgeMask =
    smoothstepJS(56.6, 57.8, absX) *
    (1.0 - smoothstepJS(68.6, 69.8, absX)) *
    (1.0 - smoothstepJS(1.8, 2.8, Math.abs(z + 10.0)));
  const outerEWU = Math.max(0.0, Math.min(1.0, (absX - 57.2) / 12.0));
  const outerEWArchH = 0.85 + 0.80 * outerEWU + 1.15 * Math.sin(outerEWU * Math.PI);
  result = result * (1.0 - outerEWBridgeMask) + outerEWArchH * outerEWBridgeMask;

  // South Grand Sky-Harbor & Lotus Sanctuary at (0, 74), radius 17.5m
  const dSouth = Math.hypot(x, z - 74.0);
  const southMask = 1.0 - smoothstepJS(15.6, 18.2, dSouth);
  const southPoolCarve = -0.22 * (1.0 - smoothstepJS(4.8, 6.0, dSouth));
  const southH = 0.95 + southPoolCarve - 0.28 * smoothstepJS(14.8, 17.5, dSouth);
  result = result * (1.0 - southMask) + southH * southMask;

  // South Grand Viaduct Bridge (x = 0, z in [38.0..58.6])
  const southBridgeMask =
    smoothstepJS(37.4, 38.6, z) *
    (1.0 - smoothstepJS(58.0, 59.2, z)) *
    (1.0 - smoothstepJS(1.9, 2.9, absX));
  const southU = Math.max(0.0, Math.min(1.0, (z - 38.0) / 20.6));
  const southArchH = 0.15 + 0.80 * southU + 1.45 * Math.sin(southU * Math.PI);
  result = result * (1.0 - southBridgeMask) + southArchH * southBridgeMask;

  // North Celestial Lotus Sanctuary at (0, -76), radius 16.5m
  const dNorth = Math.hypot(x, z + 76.0);
  const northMask = 1.0 - smoothstepJS(14.8, 17.2, dNorth);
  const northPoolCarve = -0.22 * (1.0 - smoothstepJS(4.4, 5.6, dNorth));
  const northH = 1.55 + northPoolCarve - 0.28 * smoothstepJS(13.8, 16.5, dNorth);
  result = result * (1.0 - northMask) + northH * northMask;

  // North Celestial Sky-Bridge (x = 0, z in [-61.8..-38.4])
  const northBridgeMask =
    smoothstepJS(-62.4, -61.2, z) *
    (1.0 - smoothstepJS(-39.0, -37.8, z)) *
    (1.0 - smoothstepJS(1.8, 2.8, absX));
  const northU = Math.max(0.0, Math.min(1.0, (-38.4 - z) / 23.4));
  const northArchH = 0.20 + 1.35 * northU + 1.50 * Math.sin(northU * Math.PI);
  return result * (1.0 - northBridgeMask) + northArchH * northBridgeMask;
}

/**
 * Evaluates smooth surface normal of the floating sanctuary terrain in O(1) time.
 */
export function getParadiseNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
  const eps = 0.08;
  const hL = getParadiseHeight(x - eps, z);
  const hR = getParadiseHeight(x + eps, z);
  const hD = getParadiseHeight(x, z - eps);
  const hU = getParadiseHeight(x, z + eps);
  return target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
}

function applyBoxPlanarUVs(geo: THREE.BufferGeometry, tileScale = 0.36): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return geo;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = px * tileScale;
      uvs[i * 2 + 1] = pz * tileScale;
    } else if (nx >= nz) {
      uvs[i * 2] = pz * tileScale;
      uvs[i * 2 + 1] = py * tileScale;
    } else {
      uvs[i * 2] = px * tileScale;
      uvs[i * 2 + 1] = py * tileScale;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function scaleUVs(geo: THREE.BufferGeometry, uScale: number, vScale: number): THREE.BufferGeometry {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
  }
  return geo;
}

function normalizeForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!nonIndexed.attributes.normal) {
    nonIndexed.computeVertexNormals();
  }
  const posAttr = nonIndexed.attributes.position;
  if (!nonIndexed.attributes.uv && posAttr) {
    const uvArray = new Float32Array(posAttr.count * 2);
    nonIndexed.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
  }
  for (const attrName of Object.keys(nonIndexed.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      nonIndexed.deleteAttribute(attrName);
    }
  }
  geo.dispose();
  return nonIndexed;
}

function mergeNormalizedParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    return new THREE.BufferGeometry();
  }
  return merged;
}

/**
 * Generates a smoothly tapered cylindrical branch geometry along a CatmullRomCurve3
 * with organic bark UV wrapping for silver-cherry trunks and forked boughs.
 */
function createTaperedBranchGeometry(
  curve: THREE.CatmullRomCurve3,
  rStart: number,
  rEnd: number,
  tubularSegs: number,
  radialSegs: number,
  uvScaleU = 1.5,
  uvScaleV = 2.0
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const center = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const radius = rStart + (rEnd - rStart) * Math.pow(Math.max(0, Math.min(1, t)), 0.82);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const nx = cosT * N.x + sinT * B.x;
      const ny = cosT * N.y + sinT * B.y;
      const nz = cosT * N.z + sinT * B.z;

      positions.push(center.x + nx * radius, center.y + ny * radius, center.z + nz * radius);
      normals.push(nx, ny, nz);
      uvs.push(u * uvScaleU, t * uvScaleV);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * (radialSegs + 1) + j;
      const b = (i + 1) * (radialSegs + 1) + j;
      const c = (i + 1) * (radialSegs + 1) + (j + 1);
      const d = i * (radialSegs + 1) + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function isGardenTurfZone(x: number, z: number): boolean {
  const dEastOuter = Math.hypot(x - 48.0, z + 10.0);
  const dWestOuter = Math.hypot(x + 48.0, z + 10.0);
  if (dEastOuter < 10.2 || dWestOuter < 10.2) {
    const dOuter = Math.min(dEastOuter, dWestOuter);
    if (dOuter < 5.4) return false;
    if (distToSegment2D(Math.abs(x), z, 36.0, -10.0, 58.0, -10.0) < 2.5) return false;
    return true;
  }

  // Far East & Far West Cherry-Blossom Sanctuaries at (±84, -10)
  const dFarOuter = Math.min(Math.hypot(x - 84.0, z + 10.0), Math.hypot(x + 84.0, z + 10.0));
  if (dFarOuter < 15.2) {
    if (dFarOuter < 6.4) return false;
    if (distToSegment2D(Math.abs(x), z, 67.0, -10.0, 84.0, -10.0) < 2.6) return false;
    return true;
  }

  // South Grand Sky-Harbor & Lotus Sanctuary at (0, 74)
  const dSouth = Math.hypot(x, z - 74.0);
  if (dSouth < 16.0) {
    if (dSouth < 7.4) return false;
    if (distToSegment2D(x, z, 0, 56.0, 0, 74.0) < 2.8) return false;
    return true;
  }

  // North Celestial Lotus Sanctuary at (0, -76)
  const dNorth = Math.hypot(x, z + 76.0);
  if (dNorth < 15.2) {
    if (dNorth < 7.0) return false;
    if (distToSegment2D(x, z, 0, -58.0, 0, -76.0) < 2.8) return false;
    return true;
  }

  const r = Math.hypot(x, z);
  if (r > 36.2) return false;
  const dTemple = Math.hypot(x, z + 14.0);
  if (dTemple < 9.1) return false;
  const dPool = Math.hypot(x, z - 2.0);
  if (dPool < 12.2) return false;

  if (distToSegment2D(x, z, 0, 32, 0, -14) < 2.8) return false;
  if (distToSegment2D(x, z, 6, 1.5, 31.5, -14.5) < 2.2) return false;
  if (distToSegment2D(x, z, -5.5, 2, -23, 6) < 2.2) return false;
  if (distToSegment2D(x, z, -3, 12, -14.5, 24.5) < 2.2) return false;
  if (distToSegment2D(x, z, 8.0, -14.0, 35.0, -10.0) < 2.9) return false;
  if (distToSegment2D(x, z, -8.0, -14.0, -35.0, -10.0) < 2.9) return false;

  if (r > 32.5) {
    const wfAngles = [-0.44, -2.65, 0.85];
    for (const a of wfAngles) {
      if (distToSegment2D(x, z, Math.cos(a) * 33.0, Math.sin(a) * 33.0, Math.cos(a) * 42.0, Math.sin(a) * 42.0) < 3.4) {
        return false;
      }
    }
  }

  if (Math.hypot(x - 31.5, z + 14.5) < 2.6) return false;
  if (Math.hypot(x + 22.0, z - 6.0) < 2.4) return false;
  if (Math.hypot(x + 14.0, z - 24.0) < 2.4) return false;

  return true;
}

/**
 * ParadiseScene implements ISpace for Space 5:
 * "Thiên đường" (Luminous Celestial Floating Sanctuary).
 */
export class ParadiseScene implements ISpace {
  readonly id = 'space-paradise-sanctuary';
  readonly name = 'Thiên đường';
  readonly slug = 'paradise-sanctuary';

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

  // Renderer Shadow State & IBL Target
  private boundRenderer: THREE.WebGLRenderer | null = null;
  private prevShadowEnabled = false;
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Materials
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private rainbowMaterials: THREE.ShaderMaterial[] = [];
  private godRayMaterial: THREE.ShaderMaterial | null = null;
  private cloudSeaMaterial: THREE.ShaderMaterial | null = null;
  private cloudBillowMaterial: THREE.ShaderMaterial | null = null;
  private groundMaterial: THREE.MeshStandardMaterial | null = null;
  private groundUniforms: { uTime: { value: number } } | null = null;
  private graniteCliffMaterial: THREE.MeshStandardMaterial | null = null;
  private isletTurfCapMaterial: THREE.MeshStandardMaterial | null = null;
  private carraraMarbleMaterial: THREE.MeshStandardMaterial | null = null;
  private polishedGoldMaterial: THREE.MeshStandardMaterial | null = null;
  private gildedBronzeMaterial: THREE.MeshStandardMaterial | null = null;
  private medallionMaterial: THREE.ShaderMaterial | null = null;
  private lanternOrbMaterial: THREE.ShaderMaterial | null = null;
  private waterMaterial: THREE.ShaderMaterial | null = null;
  private waterfallMaterial: THREE.ShaderMaterial | null = null;
  private sprayMaterial: THREE.ShaderMaterial | null = null;
  private mistPoolMaterial: THREE.ShaderMaterial | null = null;
  private hangingVineMaterial: THREE.ShaderMaterial | null = null;
  private floatingWaterPetalsMaterial: THREE.ShaderMaterial | null = null;
  private sakuraBarkMaterial: THREE.MeshStandardMaterial | null = null;
  private sakuraBarkUniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uWindStrength: { value: number };
  } | null = null;
  private sakuraFoliageMaterial: THREE.MeshStandardMaterial | null = null;
  private sakuraFoliageUniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uWindStrength: { value: number };
    uSunDirection: { value: THREE.Vector3 };
  } | null = null;
  private grassMaterial: THREE.ShaderMaterial | null = null;
  private cloverMaterial: THREE.ShaderMaterial | null = null;
  private flowerMaterial: THREE.ShaderMaterial | null = null;
  private petalsMaterial: THREE.ShaderMaterial | null = null;
  private motesMaterial: THREE.ShaderMaterial | null = null;

  private pbrSets: PbrTextureSet[] = [];
  private createdTextures: THREE.Texture[] = [];
  private extraMaterials: THREE.Material[] = [];

  // Shared Volumetric & Living Nature Systems
  private volumetricCloudDome: VolumetricCloudDomeHandle | null = null;
  private dovesSystem: LivingBoidsHandle | null = null;
  private swirlingPetalsSystem: LivingBoidsHandle | null = null;
  private weatherSystem: WeatherParticlesHandle | null = null;
  private atmosphereState: { timeOfDay: number; weather: WeatherMode } = {
    timeOfDay: 16.5,
    weather: 'clear'
  };
  private readonly doveFocusCenter = new THREE.Vector3(0, 15.5, -8);
  private readonly petalFocusCenter = new THREE.Vector3(0, 3.0, 0);
  private readonly weatherFocusCenter = new THREE.Vector3(0, 2.0, 0);
  private readonly tmpSunColor = new THREE.Color();
  private readonly tmpSkyTop = new THREE.Color();
  private readonly tmpSkyBot = new THREE.Color();
  private readonly tmpSkyHor = new THREE.Color();
  private readonly tmpFogColor = new THREE.Color();
  private readonly tmpCloudTop = new THREE.Color();
  private readonly tmpCloudShadow = new THREE.Color();

  // Animated Instanced / Dynamic Objects
  private lanternOrbsMesh: THREE.InstancedMesh | null = null;
  private lanternTransforms: LanternTransform[] = [];
  private isletConfigs: IsletConfig[] = [];

  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Lights
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private sanctuaryPointLight: THREE.PointLight | null = null;

  constructor() {
    this.scene = new THREE.Scene();
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
    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#e6d8cc',
        density: config?.fog?.density ?? 0.0021
      },
      sky: {
        type: config?.sky?.type ?? ('paradise_sky' as unknown as SkyConfig['type']),
        topColor: config?.sky?.topColor ?? '#1e64c8',
        bottomColor: config?.sky?.bottomColor ?? '#d495b8',
        horizonColor: config?.sky?.horizonColor ?? '#f6d4a6',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0.5,
        starDensity: config?.sky?.starDensity ?? 0,
        cloudCoverage: config?.sky?.cloudCoverage ?? 0.65,
        cloudSpeed: config?.sky?.cloudSpeed ?? 0.45,
        moonGlow: config?.sky?.moonGlow ?? 0.85
      },
      wind: {
        speed: config?.wind?.speed ?? 1.6,
        direction: config?.wind?.direction ?? [0.85, 0.0, 0.45],
        gustiness: config?.wind?.gustiness ?? 0.38,
        swayIntensity: config?.wind?.swayIntensity ?? 0.55
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#e2d8cc',
          intensity: config?.lighting?.ambient?.intensity ?? 0.30
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#ffe8c0',
          intensity: config?.lighting?.directional?.intensity ?? 1.42,
          position: config?.lighting?.directional?.position ?? [38, 44, -90],
          castShadow: config?.lighting?.directional?.castShadow ?? true
        },
        pointLights: config?.lighting?.pointLights ?? [
          { color: '#ffd470', intensity: 2.2, distance: 18, position: [0, 4.8, -14] }
        ]
      },
      shaders: config?.shaders ?? {
        grassSway: { stiffness: 0.5, windInfluence: 0.72 },
        flowerFlutter: { frequency: 2.2, amplitude: 0.35 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'paradise-sanctuary-ambient',
        name: config?.audio?.name ?? 'Heaven Horizon',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/heaven-horizon.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.7,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 3.4, wet: 0.38 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 1.7, 21],
        lookAt: config?.camera?.lookAt ?? [0, 5.5, -14],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 4.0,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.1,
        wanderRadius: Math.max(config?.camera?.wanderRadius ?? 120, 120),
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 2.5, 21],
          [0, 3.2, -8],
          [48, 3.4, -10],
          [84, 3.8, -10],
          [-48, 3.4, -10],
          [-84, 3.8, -10],
          [0, 3.2, 74],
          [0, 3.8, -76]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    // Configure PCFSoftShadowMap on renderer cleanly (restored on dispose)
    this.boundRenderer = renderer;
    if (renderer && (renderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.prevShadowEnabled = Boolean(renderer.shadowMap.enabled);
      this.prevShadowType = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // 1. Atmospheric Golden-Rose Heaven Fog
    this.scene.fog = new THREE.FogExp2(this.currentConfig.fog.color, this.currentConfig.fog.density);

    // 2. Celestial PBR Lighting & 2048x2048 Soft Shadows
    this.ambientLight = new THREE.AmbientLight(
      this.currentConfig.lighting.ambient.color,
      this.currentConfig.lighting.ambient.intensity
    );
    this.ambientLight.name = 'ParadiseAmbientLight';
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#a8cfff', '#d8b896', 0.44);
    this.hemiLight.name = 'ParadiseHemiLight';
    this.scene.add(this.hemiLight);

    const dirPos = this.currentConfig.lighting.directional.position;
    this.directionalLight = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    this.directionalLight.name = 'ParadiseSunLight';
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 260;
    this.directionalLight.shadow.camera.left = -98;
    this.directionalLight.shadow.camera.right = 98;
    this.directionalLight.shadow.camera.top = 98;
    this.directionalLight.shadow.camera.bottom = -98;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.02;
    this.scene.add(this.directionalLight);

    this.sanctuaryPointLight = new THREE.PointLight('#ffd47a', 2.2, 18, 1.4);
    this.sanctuaryPointLight.name = 'SanctuaryLanternLight';
    this.sanctuaryPointLight.position.set(0, 4.8, -14);
    this.sanctuaryPointLight.castShadow = false;
    this.scene.add(this.sanctuaryPointLight);

    // 3. Procedural 512x512 Carrara Marble, Non-Voronoi Stratified Granite/Limestone Cliff (repeat 28x12), Turf, Silver-Cherry Bark & Sakura Atlas
    const carraraPbr = createCarraraMarblePbrTextures(renderer, { size: 512, seed: 7721 });
    const graniteCliffPbr = createGraniteCliffPbrTextures({
      size: 512,
      seed: 707,
      renderer,
      repeatX: 28,
      repeatY: 12,
      normalStrength: 3.8
    });
    graniteCliffPbr.map.repeat.set(28, 12);
    graniteCliffPbr.normalMap.repeat.set(28, 12);
    graniteCliffPbr.roughnessMap.repeat.set(28, 12);
    graniteCliffPbr.aoMap.repeat.set(28, 12);

    const turfPbr = createCelestialTurfPbrTextures(renderer, { size: 512, seed: 3319 });
    const sakuraBarkPbr = createOakBarkPbrTextures({ size: 512, seed: 5507, renderer, repeatX: 2, repeatY: 3 });
    const sakuraAtlas = createSakuraBlossomAtlasTexture(renderer, 512);

    this.pbrSets = [carraraPbr, graniteCliffPbr, turfPbr, sakuraBarkPbr];
    this.createdTextures = [sakuraAtlas];

    const applyMicroRoughnessFinish = (
      mat: THREE.MeshStandardMaterial,
      keySuffix: string,
      freq: number,
      amp: number,
      minRough: number,
      maxRough: number
    ): THREE.MeshStandardMaterial => {
      const prevCompile = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')
        ? mat.onBeforeCompile.bind(mat)
        : null;
      const prevKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey')
        ? mat.customProgramCacheKey.bind(mat)
        : null;

      mat.customProgramCacheKey = () =>
        prevKey ? `${prevKey()}|${keySuffix}` : keySuffix;

      mat.onBeforeCompile = (shader, r) => {
        if (prevCompile) prevCompile(shader, r);
        if (!shader.vertexShader.includes('vMicroPos')) {
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              `#include <common>\nvarying vec3 vMicroPos;`
            )
            .replace(
              '#include <project_vertex>',
              `#include <project_vertex>\nvMicroPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );
        }
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>\nvarying vec3 vMicroPos;`
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            float mGrain = sin(vMicroPos.x * ${freq.toFixed(1)} + cos(vMicroPos.z * ${(freq * 0.87).toFixed(1)}) * 2.1)
                         * cos(vMicroPos.y * ${(freq * 1.13).toFixed(1)} + sin(vMicroPos.x * ${(freq * 0.72).toFixed(1)}) * 1.8);
            roughnessFactor = clamp(roughnessFactor + mGrain * ${amp.toFixed(3)}, ${minRough.toFixed(3)}, ${maxRough.toFixed(3)});`
          );
      };
      mat.needsUpdate = true;
      return mat;
    };

    this.carraraMarbleMaterial = applyMicroRoughnessFinish(
      applyWorldSpaceWeathering(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#dad3c8'),
          map: carraraPbr.map,
          normalMap: carraraPbr.normalMap,
          normalScale: new THREE.Vector2(1.1, 1.1),
          roughnessMap: carraraPbr.roughnessMap,
          roughness: 0.92,
          aoMap: carraraPbr.aoMap,
          aoMapIntensity: 0.84,
          metalness: 0.03,
          envMapIntensity: 0.52
        }),
        {
          macroScale: 0.16,
          mossHeight: 0.42,
          mossColor: '#567c46',
          dampRoughness: 0.44,
          dirtTint: '#8a7e6e'
        }
      ),
      'carrara-micro-v2',
      14.0,
      0.065,
      0.44,
      0.90
    );

    this.graniteCliffMaterial = applyLimestoneCanyonStrata(
      applyWorldSpaceWeathering(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color('#e0d3be'),
          map: graniteCliffPbr.map,
          normalMap: graniteCliffPbr.normalMap,
          normalScale: new THREE.Vector2(1.75, 1.75),
          roughnessMap: graniteCliffPbr.roughnessMap,
          roughness: 0.92,
          aoMap: graniteCliffPbr.aoMap,
          aoMapIntensity: 0.85,
          metalness: 0.03,
          envMapIntensity: 0.82,
          side: THREE.DoubleSide
        }),
        {
          macroScale: 0.22,
          mossHeight: -28.0,
          mossColor: '#4c7844',
          dampRoughness: 0.56,
          dirtTint: '#786852'
        }
      )
    );

    this.isletTurfCapMaterial = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffffff'),
        map: turfPbr.map,
        normalMap: turfPbr.normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughnessMap: turfPbr.roughnessMap,
        roughness: 0.92,
        aoMap: turfPbr.aoMap,
        aoMapIntensity: 0.75,
        metalness: 0.02,
        envMapIntensity: 0.65
      }),
      {
        macroScale: 0.22,
        mossHeight: 4.5,
        mossColor: '#488846',
        dampRoughness: 0.55,
        dirtTint: '#5c523e'
      }
    );

    this.polishedGoldMaterial = applyMicroRoughnessFinish(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f7cc60'),
        metalness: 0.95,
        roughness: 0.16,
        envMapIntensity: 1.75
      }),
      'gold-micro-v1',
      22.0,
      0.045,
      0.10,
      0.32
    );

    this.gildedBronzeMaterial = applyMicroRoughnessFinish(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d49a44'),
        metalness: 0.90,
        roughness: 0.23,
        envMapIntensity: 1.55
      }),
      'bronze-micro-v1',
      26.0,
      0.055,
      0.16,
      0.40
    );

    // 4. Sky Dome, PMREMGenerator Celestial Sky IBL, Aurora Rainbow Arches & Volumetric God-Rays
    this.buildSkyDomeAndIBL(renderer);
    this.buildRainbowAuroraArches();
    this.buildHeavenlyGodRays();

    // 5. Infinite 360° Sea of Sunlit Clouds & Seamless Horizon Cloud Billows
    this.buildCloudSea();

    // 6. Floating Sanctuary Walkable PBR Terrain, Cliff Underside & Lush Satellite Islets
    this.buildFloatingSanctuaryTerrain(carraraPbr, turfPbr);
    this.buildCliffUndersideAndIslets();

    // 7. Classical Carrara Marble Rotunda Temple, Balustrades, Garden Arches, Crystal Pool & Waterfalls
    this.buildMarbleSanctuaryTemple();
    this.buildMarbleBalustradesAndArches();
    this.buildCrystalReflectingPool();
    this.buildHeavenlyWaterfalls();

    // 8. Photorealistic Sakura Blossom Trees (Alpha-Tested Cluster Cards + Silver-Cherry Bark),
    //    Dense 4-Blade Grass Tufts, Wildflowers, Drifting Petals, Motes & White Doves
    this.buildSacredBlossomTrees(sakuraBarkPbr, sakuraAtlas);
    this.buildGardenGrass();
    this.buildGardenFlowers();
    this.buildBlossomPetalsAndMotes();
    this.buildSoaringWhiteDoves();

    // 8b. Seamless Single-Draw-Call Weather Particle System (for clear / mist / rain / fireflies)
    this.weatherSystem = createWeatherParticlesSystem({ count: 800, radius: 64 });
    this.weatherSystem.mesh.name = 'ParadiseWeatherParticles';
    this.scene.add(this.weatherSystem.mesh);

    // 9. Cinematic HDR Natural AgX Post-Processing Pipeline (Natural mode, Kuwahara disabled)
    this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
      defaultStyle: 'natural',
      kuwaharaEnabled: false,
      bloomStrength: 0.22,
      bloomRadius: 0.34,
      bloomThreshold: 0.95,
      impastoRelief: 0.0,
      canvasGrain: 0.0
    });

    this.isInitialized = true;
  }

  private buildSkyDomeAndIBL(renderer?: THREE.WebGLRenderer): void {
    const geo = new THREE.SphereGeometry(480, 64, 32);
    this.skyMaterial = createParadiseSkyMaterial({
      topColor: this.currentConfig!.sky.topColor,
      bottomColor: this.currentConfig!.sky.bottomColor,
      horizonColor: this.currentConfig!.sky.horizonColor,
      sunDirection: this.currentConfig!.lighting.directional.position,
      sunGlow: this.currentConfig!.sky.moonGlow ?? 0.85,
      cloudSpeed: this.currentConfig!.sky.cloudSpeed ?? 0.45,
      swirlSpeed: this.currentConfig!.sky.swirlSpeed ?? 0.5
    });
    const skyMesh = new THREE.Mesh(geo, this.skyMaterial);
    skyMesh.name = 'SkyDome';
    skyMesh.renderOrder = -10;
    this.scene.add(skyMesh);

    // Raymarched Perlin-Worley Volumetric Cloud Dome framing the golden rainbow horizon
    const sunDir = new THREE.Vector3(...this.currentConfig!.lighting.directional.position).normalize();
    const cloudCoverage = Math.max(0.62, this.currentConfig!.sky.cloudCoverage ?? 0.65);
    this.volumetricCloudDome = createVolumetricCloudDome({
      radius: 340,
      baseY: 32,
      topY: 112,
      coverage: cloudCoverage,
      tint: '#fff1e0',
      sunDirection: sunDir,
      ghibliToon: true,
      speed: this.currentConfig!.sky.cloudSpeed ?? 0.45
    });
    this.volumetricCloudDome.uniforms.uShadowColor.value.set('#7882ad');
    const initFogColor = new THREE.Color(this.currentConfig!.fog.color);
    this.volumetricCloudDome.uniforms.uFogColor.value.copy(initFogColor);
    this.volumetricCloudDome.mesh.renderOrder = -5;
    this.volumetricCloudDome.update(0, sunDir, initFogColor, cloudCoverage);
    this.scene.add(this.volumetricCloudDome.mesh);

    // Bake golden-hour celestial SkyDome into PMREMGenerator IBL for vivid metallic gold & honed Carrara reflections
    if (renderer && typeof renderer.getContext === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();

        const envScene = new THREE.Scene();
        const envGeo = new THREE.SphereGeometry(80, 32, 16);
        const envMat = createParadiseSkyMaterial({
          topColor: this.currentConfig!.sky.topColor,
          bottomColor: this.currentConfig!.sky.bottomColor,
          horizonColor: this.currentConfig!.sky.horizonColor,
          sunDirection: this.currentConfig!.lighting.directional.position,
          sunGlow: (this.currentConfig!.sky.moonGlow ?? 0.85) * 0.85,
          cloudSpeed: 0.0,
          swirlSpeed: 0.0
        });
        const envSkyMesh = new THREE.Mesh(envGeo, envMat);
        envScene.add(envSkyMesh);

        // Warm sunlit cloud-sea bounce dome underneath so gold underside catches warm pearl reflections
        const bounceGeo = new THREE.SphereGeometry(40, 24, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48);
        const bounceMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#edd2b6'),
          side: THREE.BackSide
        });
        const bounceMesh = new THREE.Mesh(bounceGeo, bounceMat);
        envScene.add(bounceMesh);

        // Calibrated HDR celestial sun disc proxy so polished gold glints without blowing out marble pavement
        const sunProxyGeo = new THREE.SphereGeometry(6.5, 16, 12);
        const sunProxyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.95, 1.45, 0.85) });
        const sunProxy = new THREE.Mesh(sunProxyGeo, sunProxyMat);
        const sunPos = this.currentConfig!.lighting.directional.position;
        sunProxy.position.set(sunPos[0], sunPos[1], sunPos[2]).normalize().multiplyScalar(62);
        envScene.add(sunProxy);

        this.envRenderTarget = pmrem.fromScene(envScene, 0.036);
        this.scene.environment = this.envRenderTarget.texture;
        this.scene.environmentIntensity = 0.58;

        envGeo.dispose();
        envMat.dispose();
        bounceGeo.dispose();
        bounceMat.dispose();
        sunProxyGeo.dispose();
        sunProxyMat.dispose();
        pmrem.dispose();
      } catch {
        // Safe fallback in headless mock renderers
      }
    }
  }

  private buildRainbowAuroraArches(): void {
    this.rainbowMaterials = [];
    const radiance = this.currentConfig!.sky.moonGlow ?? 0.85;
    const swirlSpeed = this.currentConfig!.sky.swirlSpeed ?? 0.5;

    const createArchRibbon = (
      radius: number,
      width: number,
      arcSpan: number,
      tiltX: number,
      rotY: number,
      centerOffset: THREE.Vector3,
      name: string,
      radScale: number
    ) => {
      const segsU = 96;
      const segsV = 12;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= segsU; i++) {
        const u = i / segsU;
        const theta = (u - 0.5) * arcSpan;
        for (let j = 0; j <= segsV; j++) {
          const v = j / segsV;
          const rOffset = (v - 0.5) * width;
          const x = Math.sin(theta) * (radius + rOffset);
          const y = Math.cos(theta) * (radius + rOffset);
          const z = Math.sin(u * Math.PI * 2.0) * 4.5 + (v - 0.5) * 1.4;
          positions.push(x, y, z);
          uvs.push(u, v);
        }
      }

      for (let i = 0; i < segsU; i++) {
        for (let j = 0; j < segsV; j++) {
          const a = i * (segsV + 1) + j;
          const b = (i + 1) * (segsV + 1) + j;
          const c = (i + 1) * (segsV + 1) + (j + 1);
          const d = i * (segsV + 1) + (j + 1);
          indices.push(a, b, d, b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mat = createRainbowAuroraMaterial({
        radiance: radiance * radScale,
        swirlSpeed
      });
      this.rainbowMaterials.push(mat);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      mesh.renderOrder = -2;
      mesh.position.copy(centerOffset);
      mesh.rotation.set(tiltX, rotY, 0);
      this.scene.add(mesh);
    };

    createArchRibbon(156, 28.0, Math.PI * 1.06, -0.22, 0.06, new THREE.Vector3(0, -34, -158), 'CelestialRainbowArch', 1.0);
    createArchRibbon(158, 25.0, Math.PI * 0.98, 0.22, Math.PI - 0.1, new THREE.Vector3(0, -32, 158), 'CelestialAuroraHalo', 0.72);
  }

  private buildHeavenlyGodRays(): void {
    const sunDir = new THREE.Vector3(...this.currentConfig!.lighting.directional.position).normalize();
    const rayParts: THREE.BufferGeometry[] = [];

    const shafts = [
      { target: new THREE.Vector3(14, 12, -24), length: 82, topW: 2.2, botW: 6.2, rot: 0.2 },
      { target: new THREE.Vector3(-18, 10, -18), length: 80, topW: 2.0, botW: 5.8, rot: 1.1 },
      { target: new THREE.Vector3(24, 9, -22), length: 78, topW: 2.2, botW: 6.0, rot: 2.0 },
      { target: new THREE.Vector3(28, 7, -6), length: 80, topW: 2.4, botW: 6.5, rot: 0.7 },
      { target: new THREE.Vector3(-26, 9, 4), length: 82, topW: 2.2, botW: 6.2, rot: 1.7 }
    ];

    const upVec = new THREE.Vector3(0, 1, 0);
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(upVec, sunDir);
    const spinQuat = new THREE.Quaternion();
    const finalQuat = new THREE.Quaternion();
    const mat4 = new THREE.Matrix4();

    for (const s of shafts) {
      for (let k = 0; k < 2; k++) {
        const cyl = new THREE.CylinderGeometry(s.topW, s.botW, s.length, 10, 1, true);
        spinQuat.setFromAxisAngle(upVec, s.rot + k * Math.PI * 0.5);
        finalQuat.multiplyQuaternions(alignQuat, spinQuat);

        const center = s.target.clone().addScaledVector(sunDir, s.length * 0.44);
        mat4.compose(center, finalQuat, new THREE.Vector3(1, 1, 1));
        cyl.applyMatrix4(mat4);
        rayParts.push(normalizeForMerge(cyl));
      }
    }

    const merged = mergeNormalizedParts(rayParts);
    this.godRayMaterial = createHeavenlyGodRayMaterial({
      radiance: this.currentConfig!.sky.moonGlow ?? 0.85
    });
    const raysMesh = new THREE.Mesh(merged, this.godRayMaterial);
    raysMesh.name = 'HeavenlyGodRays';
    this.scene.add(raysMesh);
  }

  private buildCloudSea(): void {
    // 1. Continuous 360° Undulating Sea of Sunlit Multi-Octave FBM Clouds beneath the floating sanctuary
    const radialSegs = 84;
    const angularSegs = 128;
    const maxR = 460;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let ir = 0; ir <= radialSegs; ir++) {
      const t = ir / radialSegs;
      const r = Math.pow(t, 1.35) * maxR;
      for (let ia = 0; ia <= angularSegs; ia++) {
        const a = (ia / angularSegs) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        positions.push(x, -11.5, z);
        uvs.push(ia / angularSegs, t);
      }
    }

    for (let ir = 0; ir < radialSegs; ir++) {
      for (let ia = 0; ia < angularSegs; ia++) {
        const a = ir * (angularSegs + 1) + ia;
        const b = (ir + 1) * (angularSegs + 1) + ia;
        const c = (ir + 1) * (angularSegs + 1) + (ia + 1);
        const d = ir * (angularSegs + 1) + (ia + 1);
        indices.push(a, d, b, b, d, c);
      }
    }

    const seaGeo = new THREE.BufferGeometry();
    seaGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    seaGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    seaGeo.setIndex(indices);
    seaGeo.computeVertexNormals();

    this.cloudSeaMaterial = createCloudSeaMaterial({
      sunDirection: this.currentConfig!.lighting.directional.position,
      cloudSpeed: this.currentConfig!.sky.cloudSpeed ?? 0.45,
      horizonColor: this.currentConfig!.sky.horizonColor
    });
    const seaMesh = new THREE.Mesh(seaGeo, this.cloudSeaMaterial);
    seaMesh.name = 'CloudSea';
    this.scene.add(seaMesh);

    // Secondary deep cloud stratum below CloudSea for multi-layered horizon depth
    const deepSeaGeo = seaGeo.clone();
    deepSeaGeo.translate(0, -8.0, 0);
    const deepSeaMesh = new THREE.Mesh(deepSeaGeo, this.cloudSeaMaterial);
    deepSeaMesh.name = 'CloudSeaDeep';
    this.scene.add(deepSeaMesh);

    // 2. FBM/Worley-Dissolved Volumetric Cloud Billow Mounds encircling the floating islands (ZERO hard sphere edges!)
    const puffParts: THREE.BufferGeometry[] = [];
    const lobes = [
      { x: 0, y: 0.1, z: 0, r: 1.0 },
      { x: -0.78, y: -0.18, z: 0.25, r: 0.72 },
      { x: 0.82, y: -0.15, z: -0.22, r: 0.75 },
      { x: 0.18, y: 0.55, z: 0.15, r: 0.62 },
      { x: -0.24, y: -0.20, z: -0.68, r: 0.64 }
    ];
    for (const lobe of lobes) {
      const s = new THREE.SphereGeometry(lobe.r, 14, 10);
      s.scale(1.38, 0.72, 1.28);
      s.translate(lobe.x, lobe.y, lobe.z);
      puffParts.push(normalizeForMerge(s));
    }
    const puffGeo = mergeNormalizedParts(puffParts);

    this.cloudBillowMaterial = createCloudBillowMaterial({
      sunDirection: this.currentConfig!.lighting.directional.position,
      cloudSpeed: this.currentConfig!.sky.cloudSpeed ?? 0.45,
      horizonColor: this.currentConfig!.sky.horizonColor
    });

    const billowCount = 136;
    const billows = new THREE.InstancedMesh(puffGeo, this.cloudBillowMaterial, billowCount);
    billows.name = 'CloudSeaBillows';
    const col = new THREE.Color();

    for (let i = 0; i < billowCount; i++) {
      const r1 = pseudoRand(i * 3.1 + 1.0);
      const r2 = pseudoRand(i * 5.7 + 2.0);
      const angle = (i / billowCount) * Math.PI * 2.0 + (r1 - 0.5) * 0.22;
      const dist = 48.0 + r2 * 184.0;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const py = -11.6 + r1 * 6.4 + (dist > 145 ? 2.6 : 0);

      const scaleXZ = 11.2 + r2 * 17.5;
      const scaleY = 4.8 + r1 * 5.6;
      this.tmpPos.set(px, py, pz);
      this.tmpEuler.set(0, r1 * Math.PI * 2, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.set(scaleXZ, scaleY, scaleXZ * (0.8 + r1 * 0.35));
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      billows.setMatrixAt(i, this.tmpMatrix);

      col.setRGB(0.95 + r1 * 0.05, 0.92 + r2 * 0.06, 0.92 + (1 - r1) * 0.06);
      billows.setColorAt(i, col);
    }
    billows.instanceMatrix.needsUpdate = true;
    if (billows.instanceColor) billows.instanceColor.needsUpdate = true;
    this.scene.add(billows);
  }

  private buildFloatingSanctuaryTerrain(marbleSet: PbrTextureSet, turfSet: PbrTextureSet): void {
    const terrainParts: THREE.BufferGeometry[] = [];
    const tmpN = new THREE.Vector3();

    const buildDisc = (cx: number, cz: number, maxR: number, radialSegs: number, angularSegs: number) => {
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let ir = 0; ir <= radialSegs; ir++) {
        const t = ir / radialSegs;
        const r = t * maxR;
        for (let ia = 0; ia <= angularSegs; ia++) {
          const a = (ia / angularSegs) * Math.PI * 2;
          const x = cx + Math.cos(a) * r;
          const z = cz + Math.sin(a) * r;

          let y = getParadiseHeight(x, z);
          if (r > maxR - 0.85) {
            const lip = (r - (maxR - 0.85)) / 0.85;
            y -= lip * lip * 0.14;
          }
          positions.push(x, y, z);

          getParadiseNormal(x, z, tmpN);
          normals.push(tmpN.x, tmpN.y, tmpN.z);
          uvs.push(x * 0.05 + 0.5, z * 0.05 + 0.5);
        }
      }

      for (let ir = 0; ir < radialSegs; ir++) {
        for (let ia = 0; ia < angularSegs; ia++) {
          const a = ir * (angularSegs + 1) + ia;
          const b = (ir + 1) * (angularSegs + 1) + ia;
          const c = (ir + 1) * (angularSegs + 1) + (ia + 1);
          const d = ir * (angularSegs + 1) + (ia + 1);
          indices.push(a, d, b, b, d, c);
        }
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      g.computeVertexNormals();
      terrainParts.push(normalizeForMerge(g));
    };

    // Main floating sanctuary island disc + East & West Walkable Outer Celestial Terraces
    // + Far East/West Cherry-Blossom Sanctuaries & South/North Lotus Sanctuaries
    buildDisc(0, 0, 42.1, 64, 128);
    buildDisc(48.0, -10.0, 11.4, 24, 56);
    buildDisc(-48.0, -10.0, 11.4, 24, 56);
    buildDisc(84.0, -10.0, 16.5, 32, 72);
    buildDisc(-84.0, -10.0, 16.5, 32, 72);
    buildDisc(0.0, 74.0, 17.5, 34, 72);
    buildDisc(0.0, -76.0, 16.5, 32, 72);

    const terrainGeo = mergeNormalizedParts(terrainParts);
    const { material, uniforms } = createParadiseGroundPbrMaterial(marbleSet, turfSet);
    this.groundMaterial = material;
    this.groundUniforms = uniforms;

    const mesh = new THREE.Mesh(terrainGeo, this.groundMaterial);
    mesh.name = 'FloatingSanctuaryTerrain';
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private createCraggyRockGeometry(
    rx: number,
    ry: number,
    rz: number,
    detail: number,
    seed: number,
    flatTopFactor = 0.0
  ): THREE.BufferGeometry {
    const segsU = Math.max(24, detail * 7);
    const segsV = Math.max(18, detail * 5);
    const geo = new THREE.SphereGeometry(1.0, segsU, segsV);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);

      const ang = Math.atan2(vz, vx);
      // Fractured horizontal sedimentary limestone shelves + angular vertical cleavage facets (smooth-indexed normals!)
      const strataStep = Math.sin(vy * 8.5 + seed * 0.7) * 0.085 + Math.cos(vy * 17.0 - seed * 1.1) * 0.04;
      const shelfLedge = Math.sin(vy * 12.0 + Math.cos(ang * 2.0 + seed) * 0.4) * 0.065;
      const cleavageA = 1.0 - Math.abs(Math.sin(ang * 3.0 + vy * 1.1 + seed));
      const cleavageB = 1.0 - Math.abs(Math.cos(ang * 5.0 - vy * 1.7 + seed * 1.6));
      const ridge1 = Math.pow(cleavageA, 1.3);
      const ridge2 = cleavageB * 2.0 - 1.0;
      const crag = 0.80 + 0.19 * ridge1 + 0.075 * ridge2 + strataStep + shelfLedge;

      vx *= rx * crag;
      vz *= rz * crag;
      if (flatTopFactor > 0.0 && vy > 0.12) {
        vy = (0.12 + (vy - 0.12) * (1.0 - flatTopFactor)) * ry;
      } else {
        vy *= ry * (0.93 + 0.07 * Math.sin(vy * 7.5 + seed));
      }
      pos.setXYZ(i, vx, vy, vz);
    }
    geo.computeVertexNormals();
    applyBoxPlanarUVs(geo, 0.014);
    return geo;
  }

  private buildCliffUndersideAndIslets(): void {
    const cliffMat = this.graniteCliffMaterial!;
    const turfCapMat = this.isletTurfCapMaterial!;
    const marbleMat = this.carraraMarbleMaterial!;
    const goldMat = this.polishedGoldMaterial!;
    const spillwayAngles = [-0.44, -2.65, 0.85];

    // 1. Main Floating Island Sculpted Tiered Limestone Canyon Cliff Underside (with recessed spillway weir notches!)
    const buildCanyonSkirt = (
      cx: number,
      cz: number,
      topRadius: number,
      dropDepth: number,
      radialSegs: number,
      heightSegs: number,
      uScale: number,
      vScale: number,
      carveSpillways = false
    ): THREE.BufferGeometry => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let ih = 0; ih <= heightSegs; ih++) {
        const v = ih / heightSegs;
        const tierPhase = v * 6.5;
        const tierSaw = Math.sin(tierPhase * Math.PI * 2.0) * 0.45 + Math.sin(tierPhase * Math.PI * 4.0) * 0.16;
        const strataRipple = Math.sin(v * Math.PI * 14.0) * 0.36;

        for (let ia = 0; ia <= radialSegs; ia++) {
          const u = ia / radialSegs;
          const a = u * Math.PI * 2;
          const buttressRib = Math.pow(0.5 + 0.5 * Math.sin(a * 11.0 + tierPhase * 0.45), 1.4) * 1.85 * (topRadius / 42.2);
          const crag =
            (Math.sin(a * 13.0 + v * 4.5) * 1.15 +
              Math.cos(a * 23.0 - v * 7.0) * 0.65 +
              Math.sin(a * 37.0 + v * 12.0) * 0.32 +
              tierSaw * 1.25 +
              strataRipple +
              buttressRib) *
            (topRadius / 42.2);

          // Recessed stone weir notch carving at the 3 waterfall spillway channels
          let notchMask = 0.0;
          if (carveSpillways) {
            for (const sa of spillwayAngles) {
              let diff = Math.abs(a - sa);
              while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
              if (diff < 0.14) {
                const nt = 1.0 - diff / 0.14;
                notchMask = Math.max(notchMask, nt * nt * (3.0 - 2.0 * nt));
              }
            }
          }
          const notchDepthEnv = Math.exp(-v * 4.5);

          // At ih=0 (v=0), lock strictly to terrain rim radius + 0.15m cornice overhang
          const corniceBulge = Math.sin(Math.min(1.0, v / 0.10) * Math.PI) * 0.65 * (topRadius / 42.2);
          const baseR = topRadius * Math.pow(Math.max(1.0 - v * 0.94, 0.03), 0.66) + corniceBulge - notchMask * notchDepthEnv * 1.55;
          const cragEnv = Math.sin(Math.min(1.0, v * 1.05) * Math.PI) * 0.92;
          const r = Math.max(0.9, baseR + crag * cragEnv);
          const x = cx + Math.cos(a) * r;
          const z = cz + Math.sin(a) * r;
          const rimX = cx + Math.cos(a) * (topRadius - 0.15);
          const rimZ = cz + Math.sin(a) * (topRadius - 0.15);
          const rimY = getParadiseHeight(rimX, rimZ) + 0.04 - notchMask * notchDepthEnv * 0.42;
          const y =
            rimY -
            Math.pow(Math.max(0, v), 1.06) * dropDepth +
            Math.sin(a * 7.0 + v * 5.0) * 0.48 * v +
            tierSaw * 0.45 * v;

          positions.push(x, y, z);
          uvs.push(u * uScale, v * vScale);
        }
      }

      for (let ih = 0; ih < heightSegs; ih++) {
        for (let ia = 0; ia < radialSegs; ia++) {
          const a = ih * (radialSegs + 1) + ia;
          const b = (ih + 1) * (radialSegs + 1) + ia;
          const c = (ih + 1) * (radialSegs + 1) + (ia + 1);
          const d = ih * (radialSegs + 1) + (ia + 1);
          indices.push(a, b, d, b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const skirtParts: THREE.BufferGeometry[] = [
      normalizeForMerge(buildCanyonSkirt(0, 0, 42.15, 17.6, 192, 36, 1.8, 0.35, true)),
      normalizeForMerge(buildCanyonSkirt(48.0, -10.0, 11.45, 11.8, 64, 20, 0.55, 0.28, false)),
      normalizeForMerge(buildCanyonSkirt(-48.0, -10.0, 11.45, 11.8, 64, 20, 0.55, 0.28, false)),
      normalizeForMerge(buildCanyonSkirt(84.0, -10.0, 16.55, 14.8, 84, 24, 0.78, 0.30, false)),
      normalizeForMerge(buildCanyonSkirt(-84.0, -10.0, 16.55, 14.8, 84, 24, 0.78, 0.30, false)),
      normalizeForMerge(buildCanyonSkirt(0.0, 74.0, 17.55, 14.6, 88, 24, 0.82, 0.30, false)),
      normalizeForMerge(buildCanyonSkirt(0.0, -76.0, 16.55, 15.2, 84, 24, 0.78, 0.30, false))
    ];

    const skirtMesh = new THREE.Mesh(mergeNormalizedParts(skirtParts), cliffMat);
    skirtMesh.name = 'IslandCliffBody';
    skirtMesh.castShadow = true;
    skirtMesh.receiveShadow = true;
    this.scene.add(skirtMesh);

    // 1b. Sculpted Fractured Limestone Waterfall Lip Boulders, Recessed Stone Weir Channels & Canyon Rim Buttresses
    const spillwayParts: THREE.BufferGeometry[] = [];
    for (let wi = 0; wi < spillwayAngles.length; wi++) {
      const a = spillwayAngles[wi];
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const tangX = -sinA;
      const tangZ = cosA;
      const rimY = getParadiseHeight(cosA * 40.5, sinA * 40.5);

      // Recessed stone weir channel cheek-boulders flanking the waterfall throat from r=35.8 out to r=42.2
      for (const side of [-1, 1]) {
        for (let ci = 0; ci < 3; ci++) {
          const chR = 36.4 + ci * 2.15;
          const chLat = side * (2.65 + ci * 0.22);
          const chX = cosA * chR + tangX * chLat;
          const chZ = sinA * chR + tangZ * chLat;
          const chY = getParadiseHeight(chX, chZ) - 0.15 - ci * 0.24;
          const cheekBoulder = this.createCraggyRockGeometry(
            1.45 + (ci % 2) * 0.35,
            1.15 + ci * 0.25,
            1.55 + ci * 0.22,
            3,
            wi * 17.3 + side * 5.7 + ci * 2.9,
            0.35
          );
          cheekBoulder.rotateY(-a + side * 0.28);
          cheekBoulder.translate(chX, chY, chZ);
          spillwayParts.push(normalizeForMerge(cheekBoulder));
        }

        // Stepped cliffside spillway framing buttresses descending underneath
        for (let tier = 0; tier < 3; tier++) {
          const rockR = 39.2 + tier * 1.15;
          const lateral = side * (3.1 + tier * 0.55);
          const rx = cosA * rockR + tangX * lateral;
          const rz = sinA * rockR + tangZ * lateral;
          const ry = rimY - 1.35 - tier * 3.4;

          const cliffBlock = this.createCraggyRockGeometry(
            2.45 + tier * 0.45,
            2.7 + tier * 0.85,
            2.35 + tier * 0.4,
            3,
            wi * 7.3 + side * 3.1 + tier * 1.9,
            0.35
          );
          cliffBlock.rotateY(-a + side * 0.35);
          cliffBlock.translate(rx, ry, rz);
          spillwayParts.push(normalizeForMerge(cliffBlock));
        }
      }

      // Sculpted fractured limestone lip boulders seated directly under & splitting the waterfall crest
      for (let li = -1; li <= 1; li++) {
        const lipR = 40.3 + Math.abs(li) * 0.65;
        const lipLat = li * 1.55;
        const lx = cosA * lipR + tangX * lipLat;
        const lz = sinA * lipR + tangZ * lipLat;
        const ly = rimY - 0.85 - Math.abs(li) * 0.28;
        const lipRock = this.createCraggyRockGeometry(
          1.35 + (li === 0 ? 0.25 : 0.1),
          0.95,
          1.25,
          3,
          wi * 23.1 + li * 4.3,
          0.42
        );
        lipRock.rotateY(-a + li * 0.45);
        lipRock.translate(lx, ly, lz);
        spillwayParts.push(normalizeForMerge(lipRock));
      }

      // Stepped cascade rock ledges beneath the plunge
      for (let step = 0; step < 3; step++) {
        const sR = 40.2 + step * 0.75;
        const sx = cosA * sR + tangX * ((step - 1) * 0.65);
        const sz = sinA * sR + tangZ * ((step - 1) * 0.65);
        const sy = rimY - 2.3 - step * 3.8;
        const ledge = this.createCraggyRockGeometry(2.6, 1.85, 1.85, 3, wi * 11.1 + step * 4.7, 0.45);
        ledge.rotateY(-a + Math.PI * 0.5 + step * 0.22);
        ledge.translate(sx, sy, sz);
        spillwayParts.push(normalizeForMerge(ledge));
      }
    }

    // Continuous overlapping perimeter of 54 fractured limestone rim-lip boulders & 30 lower canyon buttresses
    for (let bi = 0; bi < 54; bi++) {
      const a = (bi / 54) * Math.PI * 2 + 0.06;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const rimY = getParadiseHeight(cosA * 41.4, sinA * 41.4);

      // Skip directly inside the central throat of the 3 waterfall spillways so water plunges cleanly over the lip boulders
      let inWeirThroat = false;
      for (const sa of spillwayAngles) {
        let diff = Math.abs(a - sa);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff < 0.075) inWeirThroat = true;
      }

      if (!inWeirThroat) {
        const lipR = 40.6 + ((bi * 7) % 5) * 0.35;
        const lipOverhang = this.createCraggyRockGeometry(
          2.8 + (bi % 3) * 0.45,
          1.75 + (bi % 4) * 0.35,
          2.55 + ((bi + 1) % 3) * 0.35,
          3,
          bi * 3.7 + 0.9,
          0.42
        );
        lipOverhang.rotateY(-a + (bi % 2 === 0 ? 0.18 : -0.22));
        lipOverhang.translate(cosA * lipR, rimY - 0.65 - (bi % 3) * 0.45, sinA * lipR);
        spillwayParts.push(normalizeForMerge(lipOverhang));
      }

      if (bi % 2 === 0) {
        const lowerR = 32.8 + ((bi * 3) % 5) * 0.95;
        const lowerButtress = this.createCraggyRockGeometry(
          3.4 + (bi % 3) * 0.4,
          4.2 + (bi % 2) * 0.9,
          3.0,
          3,
          bi * 6.7 + 2.9,
          0.46
        );
        lowerButtress.rotateY(-a + 0.25);
        lowerButtress.translate(cosA * lowerR, rimY - 6.2 - (bi % 3) * 1.15, sinA * lowerR);
        spillwayParts.push(normalizeForMerge(lowerButtress));
      }
    }

    // Sculpted fractured limestone rim-lip boulders encircling the East & West Outer Celestial Terraces
    for (const outerCenter of [
      { cx: 48.0, cz: -10.0, r: 11.15, segs: 18, skipAngles: [Math.PI, 0.0] },
      { cx: -48.0, cz: -10.0, r: 11.15, segs: 18, skipAngles: [0.0, Math.PI] },
      { cx: 84.0, cz: -10.0, r: 16.25, segs: 26, skipAngles: [Math.PI, 0.35] },
      { cx: -84.0, cz: -10.0, r: 16.25, segs: 26, skipAngles: [0.0, Math.PI - 0.35] },
      { cx: 0.0, cz: 74.0, r: 17.25, segs: 28, skipAngles: [-Math.PI * 0.5, 0.55] },
      { cx: 0.0, cz: -76.0, r: 16.25, segs: 26, skipAngles: [Math.PI * 0.5, -Math.PI * 0.5] }
    ]) {
      for (let oi = 0; oi < outerCenter.segs; oi++) {
        const oa = (oi / outerCenter.segs) * Math.PI * 2 + 0.12;
        const ocos = Math.cos(oa);
        const osin = Math.sin(oa);
        const ox = outerCenter.cx + ocos * outerCenter.r;
        const oz = outerCenter.cz + osin * outerCenter.r;
        // Keep arched bridge landings & outer waterfall spillways clear
        let skip = false;
        for (const sa of outerCenter.skipAngles) {
          let diff = Math.abs(oa - sa);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
          if (diff < 0.24) skip = true;
        }
        if (skip) continue;
        const oy = getParadiseHeight(ox, oz);
        const outerLipRock = this.createCraggyRockGeometry(
          2.05 + (oi % 3) * 0.38,
          1.40 + (oi % 2) * 0.45,
          1.95,
          3,
          oi * 5.3 + outerCenter.cx * 0.1 + outerCenter.cz * 0.07,
          0.44
        );
        outerLipRock.rotateY(-oa + 0.2);
        outerLipRock.translate(ox, oy - 0.65 - (oi % 2) * 0.35, oz);
        spillwayParts.push(normalizeForMerge(outerLipRock));
      }
    }

    const spillwayMesh = new THREE.Mesh(mergeNormalizedParts(spillwayParts), cliffMat);
    spillwayMesh.name = 'WaterfallSpillwayCliffs';
    spillwayMesh.castShadow = true;
    spillwayMesh.receiveShadow = true;
    this.scene.add(spillwayMesh);

    // 2. Twelve Sculpted Floating Sanctuary Islets with Layered Limestone Undersides, Mossy Turf Caps & Miniature Temples
    this.isletConfigs = [
      { x: 64, y: 3.2, z: -36, r: 8.8, h: 9.4 },
      { x: -64, y: 4.2, z: -34, r: 9.2, h: 10.4 },
      { x: 52, y: 1.8, z: 44, r: 7.6, h: 8.4 },
      { x: -54, y: 3.2, z: 38, r: 8.2, h: 9.0 },
      { x: -46, y: 3.8, z: -74, r: 9.4, h: 10.8 },
      { x: 48, y: 4.4, z: -70, r: 8.6, h: 9.8 },
      { x: 0, y: 6.2, z: -118, r: 11.4, h: 12.8 },
      { x: 0, y: 3.4, z: 114, r: 9.2, h: 9.8 },
      { x: 126, y: 5.4, z: 24, r: 10.6, h: 11.8 },
      { x: -128, y: 5.8, z: 22, r: 10.4, h: 11.6 },
      { x: 114, y: 6.6, z: -78, r: 10.8, h: 12.2 },
      { x: -116, y: 6.4, z: -76, r: 10.2, h: 11.6 }
    ];

    const isletRockParts: THREE.BufferGeometry[] = [];
    const isletCapParts: THREE.BufferGeometry[] = [];
    const isletTempleMarbleParts: THREE.BufferGeometry[] = [];
    const isletTempleGoldParts: THREE.BufferGeometry[] = [];

    for (let ii = 0; ii < this.isletConfigs.length; ii++) {
      const cfg = this.isletConfigs[ii];

      const keel = this.createCraggyRockGeometry(cfg.r * 0.96, cfg.h * 0.62, cfg.r * 0.92, 3, ii * 5.3 + 1.1, 0.45);
      const kPos = keel.attributes.position;
      for (let i = 0; i < kPos.count; i++) {
        const vx = kPos.getX(i);
        const vy = kPos.getY(i);
        const vz = kPos.getZ(i);
        if (vy < 0) {
          const depthT = Math.min(1, Math.abs(vy) / (cfg.h * 0.62));
          const pinch = Math.max(0.24, 1.0 - Math.pow(depthT, 1.25) * 0.72);
          const ang = Math.atan2(vz, vx);
          const spireOffset = Math.sin(ang * 3.0 + ii * 2.1) * depthT * 1.4;
          kPos.setXYZ(i, vx * pinch + spireOffset, vy - depthT * cfg.h * 0.32, vz * pinch);
        }
      }
      keel.computeVertexNormals();
      applyBoxPlanarUVs(keel, 0.014);
      keel.translate(cfg.x, cfg.y - cfg.h * 0.14, cfg.z);
      isletRockParts.push(normalizeForMerge(keel));

      for (let sp = 0; sp < 2; sp++) {
        const spAng = ii * 1.9 + sp * 2.7;
        const spDist = cfg.r * 0.56;
        const spire = this.createCraggyRockGeometry(
          cfg.r * 0.42,
          cfg.h * (0.48 + sp * 0.12),
          cfg.r * 0.38,
          3,
          ii * 9.7 + sp * 4.3,
          0.2
        );
        spire.rotateZ((sp === 0 ? 1 : -1) * 0.14);
        spire.translate(
          cfg.x + Math.cos(spAng) * spDist,
          cfg.y - cfg.h * (0.34 + sp * 0.08),
          cfg.z + Math.sin(spAng) * spDist
        );
        isletRockParts.push(normalizeForMerge(spire));
      }

      for (let sh = 0; sh < 2; sh++) {
        const shAng = ii * 2.4 + sh * 3.1 + 0.8;
        const shard = this.createCraggyRockGeometry(1.1 + sh * 0.4, 1.5 + sh * 0.5, 0.95, 2, ii * 13 + sh * 5, 0.0);
        shard.translate(
          cfg.x + Math.cos(shAng) * (cfg.r * 0.78),
          cfg.y - cfg.h * 0.88 - sh * 1.6,
          cfg.z + Math.sin(shAng) * (cfg.r * 0.78)
        );
        isletRockParts.push(normalizeForMerge(shard));
      }

      // Sculpted craggy underside cliff root fangs plunging deep beneath each floating island
      for (let rt = 0; rt < 3; rt++) {
        const rtAng = ii * 1.7 + rt * 2.15 + 0.4;
        const rtDist = rt === 0 ? cfg.r * 0.14 : cfg.r * (0.38 + rt * 0.08);
        const rootLen = cfg.h * (0.85 - rt * 0.14);
        const rootFang = this.createCraggyRockGeometry(
          cfg.r * (0.24 - rt * 0.03),
          rootLen * 0.55,
          cfg.r * (0.22 - rt * 0.03),
          3,
          ii * 19.3 + rt * 7.1,
          0.0
        );
        const rPos = rootFang.attributes.position;
        for (let vi = 0; vi < rPos.count; vi++) {
          const rx = rPos.getX(vi);
          const ry = rPos.getY(vi);
          const rz = rPos.getZ(vi);
          const tDown = Math.max(0, Math.min(1, (rootLen * 0.55 - ry) / (rootLen * 1.1)));
          const taper = Math.max(0.10, 1.0 - Math.pow(tDown, 0.85) * 0.88);
          const twist = tDown * 1.15;
          const crx = rx * Math.cos(twist) - rz * Math.sin(twist);
          const crz = rx * Math.sin(twist) + rz * Math.cos(twist);
          rPos.setXYZ(vi, crx * taper, ry - tDown * rootLen * 0.35, crz * taper);
        }
        rootFang.computeVertexNormals();
        applyBoxPlanarUVs(rootFang, 0.016);
        rootFang.translate(
          cfg.x + Math.cos(rtAng) * rtDist,
          cfg.y - cfg.h * 0.62 - rt * 0.8,
          cfg.z + Math.sin(rtAng) * rtDist
        );
        isletRockParts.push(normalizeForMerge(rootFang));
      }

      const cap = new THREE.SphereGeometry(cfg.r * 1.03, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.50);
      const capPos = cap.attributes.position;
      for (let i = 0; i < capPos.count; i++) {
        const vx = capPos.getX(i);
        const vy = capPos.getY(i);
        const vz = capPos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const rimCrag = 1.0 + 0.14 * Math.sin(ang * 5.0 + ii * 1.7) + 0.07 * Math.cos(ang * 9.0 + ii * 0.9);
        capPos.setXYZ(i, vx * rimCrag, vy * (0.94 + 0.12 * Math.sin(vx * 0.45 + vz * 0.4)), vz * rimCrag);
      }
      cap.scale(1.0, 0.24, 1.0);
      cap.computeVertexNormals();
      applyBoxPlanarUVs(cap, 0.35);
      cap.translate(cfg.x, cfg.y - 0.12, cfg.z);
      isletCapParts.push(normalizeForMerge(cap));

      // Miniature Classical Tholos Temple / Celestial Shrine crowning each floating islet
      const topY = cfg.y + cfg.r * 1.03 * 0.22;
      const tholosR = Math.min(2.6, cfg.r * 0.28);
      const colH = tholosR * 1.35;

      const plinth = scaleUVs(new THREE.CylinderGeometry(tholosR * 1.12, tholosR * 1.22, 0.34, 20), 2.5, 0.4);
      plinth.translate(cfg.x, topY + 0.12, cfg.z);
      isletTempleMarbleParts.push(normalizeForMerge(plinth));

      for (let ci = 0; ci < 6; ci++) {
        const ca = (ci / 6) * Math.PI * 2;
        const colX = cfg.x + Math.cos(ca) * tholosR * 0.92;
        const colZ = cfg.z + Math.sin(ca) * tholosR * 0.92;
        const col = scaleUVs(new THREE.CylinderGeometry(0.14, 0.17, colH, 10), 0.8, 1.4);
        col.translate(colX, topY + 0.28 + colH * 0.5, colZ);
        isletTempleMarbleParts.push(normalizeForMerge(col));

        const capGold = new THREE.CylinderGeometry(0.22, 0.15, 0.18, 10);
        capGold.translate(colX, topY + 0.28 + colH + 0.08, colZ);
        isletTempleGoldParts.push(normalizeForMerge(capGold));
      }

      const ringY = topY + 0.28 + colH + 0.22;
      const entab = scaleUVs(new THREE.TorusGeometry(tholosR * 0.94, 0.16, 8, 24), 4.0, 0.6);
      entab.rotateX(Math.PI / 2);
      entab.translate(cfg.x, ringY, cfg.z);
      isletTempleMarbleParts.push(normalizeForMerge(entab));

      const dome = new THREE.SphereGeometry(tholosR * 0.92, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.46);
      dome.translate(cfg.x, ringY + 0.06, cfg.z);
      isletTempleGoldParts.push(normalizeForMerge(dome));

      const spire = new THREE.ConeGeometry(0.10, 0.95, 8);
      spire.translate(cfg.x, ringY + tholosR * 0.92 + 0.42, cfg.z);
      isletTempleGoldParts.push(normalizeForMerge(spire));
    }

    // Monumental craggy underside cliff roots descending under the main sanctuary island
    for (let mr = 0; mr < 8; mr++) {
      const mAng = (mr / 8) * Math.PI * 2 + 0.28;
      const mDist = 14.0 + (mr % 3) * 6.5;
      const rootFang = this.createCraggyRockGeometry(3.6, 7.2, 3.3, 3, mr * 11.7 + 3.3, 0.0);
      const rPos = rootFang.attributes.position;
      for (let vi = 0; vi < rPos.count; vi++) {
        const rx = rPos.getX(vi);
        const ry = rPos.getY(vi);
        const rz = rPos.getZ(vi);
        const tDown = Math.max(0, Math.min(1, (7.2 - ry) / 14.4));
        const taper = Math.max(0.12, 1.0 - Math.pow(tDown, 0.9) * 0.86);
        rPos.setXYZ(vi, rx * taper, ry - tDown * 3.2, rz * taper);
      }
      rootFang.computeVertexNormals();
      applyBoxPlanarUVs(rootFang, 0.014);
      rootFang.translate(Math.cos(mAng) * mDist, -10.5 - (mr % 2) * 1.6, Math.sin(mAng) * mDist);
      isletRockParts.push(normalizeForMerge(rootFang));
    }

    const isletsMesh = new THREE.Mesh(mergeNormalizedParts(isletRockParts), cliffMat);
    isletsMesh.name = 'FloatingSatelliteIslets';
    isletsMesh.castShadow = true;
    isletsMesh.receiveShadow = true;
    this.scene.add(isletsMesh);

    const isletCapsMesh = new THREE.Mesh(mergeNormalizedParts(isletCapParts), turfCapMat);
    isletCapsMesh.name = 'FloatingIsletTurfCaps';
    isletCapsMesh.receiveShadow = true;
    this.scene.add(isletCapsMesh);

    // Hanging trailing vines & blossom tendrils draping from all distant floating islands & main rim overhangs
    const vineParts: THREE.BufferGeometry[] = [];
    for (let st = 0; st < 3; st++) {
      const ox = (st - 1) * 0.16;
      const oz = (st % 2 === 0 ? 1 : -1) * 0.10;
      const len = 0.82 + (st % 2) * 0.18;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ox, 0.0, oz),
        new THREE.Vector3(ox * 1.2 + 0.04, -len * 0.35, oz - 0.03),
        new THREE.Vector3(ox * 0.8 - 0.04, -len * 0.72, oz + 0.04),
        new THREE.Vector3(ox * 0.5, -len, oz)
      ]);
      const stem = createTaperedBranchGeometry(curve, 0.026, 0.008, 7, 4, 0.2, 1.0);
      const sUv = stem.attributes.uv;
      if (sUv) {
        for (let k = 0; k < sUv.count; k++) sUv.setX(k, 0.18);
      }
      vineParts.push(normalizeForMerge(stem));

      for (let lf = 1; lf <= 6; lf++) {
        const tf = lf / 7;
        const pt = curve.getPointAt(tf);
        const leaf = new THREE.PlaneGeometry(0.15, 0.22);
        leaf.rotateX(0.32);
        leaf.rotateY(lf * 1.65 + st * 1.1);
        leaf.translate(pt.x, pt.y, pt.z);
        const lUv = leaf.attributes.uv;
        if (lUv) {
          const isBud = lf >= 5 ? 0.88 : 0.28;
          for (let k = 0; k < lUv.count; k++) lUv.setX(k, isBud);
        }
        vineParts.push(normalizeForMerge(leaf));
      }
    }
    const vineGeo = mergeNormalizedParts(vineParts);
    this.hangingVineMaterial = createHangingVineMaterial(
      this.currentConfig!.wind.speed,
      this.currentConfig!.wind.swayIntensity,
      this.currentConfig!.lighting.directional.position
    );

    const vinePlacements: Array<{ x: number; y: number; z: number; yaw: number; sx: number; sy: number }> = [];
    for (let ii = 0; ii < this.isletConfigs.length; ii++) {
      const cfg = this.isletConfigs[ii];
      const perIsletVines = 12;
      for (let vi = 0; vi < perIsletVines; vi++) {
        const ang = (vi / perIsletVines) * Math.PI * 2 + pseudoRand(ii * 29 + vi) * 0.35;
        const rimR = cfg.r * (0.86 + pseudoRand(ii * 37 + vi) * 0.14);
        vinePlacements.push({
          x: cfg.x + Math.cos(ang) * rimR,
          y: cfg.y - 0.15,
          z: cfg.z + Math.sin(ang) * rimR,
          yaw: ang + Math.PI * 0.5,
          sx: 1.0 + pseudoRand(vi * 7.1 + ii) * 0.55,
          sy: 3.4 + pseudoRand(vi * 3.9 + ii) * 3.8
        });
      }
    }
    for (let mi = 0; mi < 68; mi++) {
      const ang = (mi / 68) * Math.PI * 2 + 0.04;
      let skip = false;
      for (const sa of spillwayAngles) {
        let diff = Math.abs(ang - sa);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff < 0.16) skip = true;
      }
      if (skip) continue;
      const vx = Math.cos(ang) * 41.3;
      const vz = Math.sin(ang) * 41.3;
      vinePlacements.push({
        x: vx,
        y: getParadiseHeight(vx, vz) - 0.25,
        z: vz,
        yaw: ang,
        sx: 1.1 + pseudoRand(mi * 4.7) * 0.6,
        sy: 3.2 + pseudoRand(mi * 8.3) * 4.2
      });
    }

    const vinesMesh = new THREE.InstancedMesh(vineGeo, this.hangingVineMaterial, vinePlacements.length);
    vinesMesh.name = 'HangingIslandVines';
    const vCol = new THREE.Color();
    for (let i = 0; i < vinePlacements.length; i++) {
      const vp = vinePlacements[i];
      this.tmpPos.set(vp.x, vp.y, vp.z);
      this.tmpEuler.set(0, vp.yaw, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.set(vp.sx, vp.sy, vp.sx);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      vinesMesh.setMatrixAt(i, this.tmpMatrix);
      const shade = 0.85 + pseudoRand(i * 5.3) * 0.30;
      vCol.setRGB(shade, shade * 1.02, shade * 0.96);
      vinesMesh.setColorAt(i, vCol);
    }
    vinesMesh.instanceMatrix.needsUpdate = true;
    if (vinesMesh.instanceColor) vinesMesh.instanceColor.needsUpdate = true;
    this.scene.add(vinesMesh);

    if (isletTempleMarbleParts.length > 0) {
      const isletMarbleMesh = new THREE.Mesh(mergeNormalizedParts(isletTempleMarbleParts), marbleMat);
      isletMarbleMesh.name = 'FloatingIsletTemples';
      isletMarbleMesh.castShadow = true;
      isletMarbleMesh.receiveShadow = true;
      this.scene.add(isletMarbleMesh);
    }
    if (isletTempleGoldParts.length > 0) {
      const isletGoldMesh = new THREE.Mesh(mergeNormalizedParts(isletTempleGoldParts), goldMat);
      isletGoldMesh.name = 'FloatingIsletGoldenDomes';
      isletGoldMesh.castShadow = true;
      isletGoldMesh.receiveShadow = true;
      this.scene.add(isletGoldMesh);
    }
  }

  private buildMarbleSanctuaryTemple(): void {
    const marbleMat = this.carraraMarbleMaterial!;
    const goldMat = this.polishedGoldMaterial!;
    const bronzeMat = this.gildedBronzeMaterial!;

    const cx = 0.0;
    const cz = -14.0;
    const floorY = getParadiseHeight(cx, cz);

    const marbleParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const bronzeParts: THREE.BufferGeometry[] = [];

    // 1. Sculpted Stepped Stylobate Base Plinth Molding skirting the outer dais edge
    const stylobateProfile = [
      new THREE.Vector2(6.10, -0.18),
      new THREE.Vector2(6.95, -0.18),
      new THREE.Vector2(6.95, -0.04),
      new THREE.Vector2(6.72, 0.00),
      new THREE.Vector2(6.68, 0.12),
      new THREE.Vector2(6.46, 0.16),
      new THREE.Vector2(6.42, 0.25),
      new THREE.Vector2(6.10, 0.25),
      new THREE.Vector2(6.10, -0.18)
    ];
    const plinthRing = scaleUVs(new THREE.LatheGeometry(stylobateProfile, 64), 16, 0.8);
    plinthRing.translate(cx, floorY + 0.02, cz);
    marbleParts.push(normalizeForMerge(plinthRing));

    // Gilded bronze filigree bands inlaid on stylobate step & sanctuary floor rim
    const bronzeStylobateBand = new THREE.TorusGeometry(6.69, 0.036, 8, 72);
    bronzeStylobateBand.rotateX(Math.PI / 2);
    bronzeStylobateBand.translate(cx, floorY + 0.14, cz);
    bronzeParts.push(normalizeForMerge(bronzeStylobateBand));

    const goldFloorTrim = new THREE.TorusGeometry(5.6, 0.055, 8, 64);
    goldFloorTrim.rotateX(Math.PI / 2);
    goldFloorTrim.translate(cx, floorY + 0.09, cz);
    goldParts.push(normalizeForMerge(goldFloorTrim));

    const bronzeInnerFiligree = new THREE.TorusGeometry(4.42, 0.042, 8, 64);
    bronzeInnerFiligree.rotateX(Math.PI / 2);
    bronzeInnerFiligree.translate(cx, floorY + 0.06, cz);
    bronzeParts.push(normalizeForMerge(bronzeInnerFiligree));

    // 2. 8 Fluted Classical Carrara Marble Columns with Sculpted Attic Base Moldings & Gilded Capitals
    const colRadiusRing = 5.55;
    const shaftHeight = 5.4;
    const shaftRadius = 0.32;

    const atticProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.47, 0.0),
      new THREE.Vector2(0.48, 0.07),
      new THREE.Vector2(0.42, 0.11),
      new THREE.Vector2(0.39, 0.16),
      new THREE.Vector2(0.42, 0.21),
      new THREE.Vector2(0.35, 0.26),
      new THREE.Vector2(0.0, 0.26)
    ];

    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) * Math.PI) / 4.0;
      const colX = cx + Math.cos(angle) * colRadiusRing;
      const colZ = cz + Math.sin(angle) * colRadiusRing;

      // Stepped square plinth + beveled upper cap
      const basePlinth = applyBoxPlanarUVs(new THREE.BoxGeometry(1.06, 0.18, 1.06), 0.55);
      basePlinth.rotateY(-angle);
      basePlinth.translate(colX, floorY + 0.11, colZ);
      marbleParts.push(normalizeForMerge(basePlinth));

      const baseSubPlinth = applyBoxPlanarUVs(new THREE.BoxGeometry(0.94, 0.10, 0.94), 0.55);
      baseSubPlinth.rotateY(-angle);
      baseSubPlinth.translate(colX, floorY + 0.25, colZ);
      marbleParts.push(normalizeForMerge(baseSubPlinth));

      // Molded Attic torus-scotia-torus base
      const atticBase = scaleUVs(new THREE.LatheGeometry(atticProfile, 24), 1.6, 0.7);
      atticBase.translate(colX, floorY + 0.30, colZ);
      marbleParts.push(normalizeForMerge(atticBase));

      // Gilded bronze filigree collar on Attic base + mid-shaft astragal band
      const bronzeBaseBand = new THREE.TorusGeometry(0.405, 0.028, 8, 24);
      bronzeBaseBand.rotateX(Math.PI / 2);
      bronzeBaseBand.translate(colX, floorY + 0.44, colZ);
      bronzeParts.push(normalizeForMerge(bronzeBaseBand));

      const goldCollar = new THREE.TorusGeometry(0.34, 0.04, 8, 20);
      goldCollar.rotateX(Math.PI / 2);
      goldCollar.translate(colX, floorY + 0.56, colZ);
      goldParts.push(normalizeForMerge(goldCollar));

      // Fluted shaft with 12 classical flutes
      const shaft = scaleUVs(new THREE.CylinderGeometry(shaftRadius * 0.88, shaftRadius, shaftHeight - 0.14, 24, 2, false), 1.2, 2.2);
      const sPos = shaft.attributes.position;
      for (let vi = 0; vi < sPos.count; vi++) {
        const vx = sPos.getX(vi);
        const vz = sPos.getZ(vi);
        const rad = Math.hypot(vx, vz);
        if (rad > 0.05) {
          const theta = Math.atan2(vz, vx);
          const flute = 1.0 - 0.055 * (0.5 + 0.5 * Math.cos(theta * 12.0));
          sPos.setX(vi, vx * flute);
          sPos.setZ(vi, vz * flute);
        }
      }
      shaft.computeVertexNormals();
      shaft.translate(colX, floorY + 0.56 + (shaftHeight - 0.14) * 0.5, colZ);
      marbleParts.push(normalizeForMerge(shaft));

      const bronzeMidBand = new THREE.TorusGeometry(0.312, 0.024, 8, 22);
      bronzeMidBand.rotateX(Math.PI / 2);
      bronzeMidBand.translate(colX, floorY + 0.56 + shaftHeight * 0.18, colZ);
      bronzeParts.push(normalizeForMerge(bronzeMidBand));

      const neckGold = new THREE.TorusGeometry(0.31, 0.045, 8, 20);
      neckGold.rotateX(Math.PI / 2);
      neckGold.translate(colX, floorY + 0.42 + shaftHeight, colZ);
      goldParts.push(normalizeForMerge(neckGold));

      const capBell = new THREE.CylinderGeometry(0.46, 0.29, 0.44, 18);
      capBell.translate(colX, floorY + 0.42 + shaftHeight + 0.24, colZ);
      goldParts.push(normalizeForMerge(capBell));

      const bronzeCapScroll = new THREE.TorusGeometry(0.42, 0.035, 8, 20);
      bronzeCapScroll.rotateX(Math.PI / 2);
      bronzeCapScroll.translate(colX, floorY + 0.42 + shaftHeight + 0.42, colZ);
      bronzeParts.push(normalizeForMerge(bronzeCapScroll));

      const abacus = applyBoxPlanarUVs(new THREE.BoxGeometry(1.04, 0.18, 1.04), 0.55);
      abacus.rotateY(-angle);
      abacus.translate(colX, floorY + 0.42 + shaftHeight + 0.54, colZ);
      marbleParts.push(normalizeForMerge(abacus));
    }

    // 3. Solid Classical Molded Entablature / Architrave Crown Ring + Gilded Bronze Frieze Rosettes
    const entablatureY = floorY + 6.52;
    const archProfile = [
      new THREE.Vector2(5.16, -0.32),
      new THREE.Vector2(5.98, -0.32),
      new THREE.Vector2(6.08, -0.20),
      new THREE.Vector2(5.96, -0.02),
      new THREE.Vector2(6.12, 0.18),
      new THREE.Vector2(6.02, 0.34),
      new THREE.Vector2(5.16, 0.34),
      new THREE.Vector2(5.16, -0.32)
    ];
    const architrave = scaleUVs(new THREE.LatheGeometry(archProfile, 56), 16, 1.2);
    architrave.translate(cx, entablatureY, cz);
    marbleParts.push(normalizeForMerge(architrave));

    const friezeGoldTop = new THREE.TorusGeometry(6.00, 0.065, 8, 64);
    friezeGoldTop.rotateX(Math.PI / 2);
    friezeGoldTop.translate(cx, entablatureY + 0.34, cz);
    goldParts.push(normalizeForMerge(friezeGoldTop));

    const friezeBronzeMid = new THREE.TorusGeometry(6.01, 0.042, 8, 64);
    friezeBronzeMid.rotateX(Math.PI / 2);
    friezeBronzeMid.translate(cx, entablatureY + 0.02, cz);
    bronzeParts.push(normalizeForMerge(friezeBronzeMid));

    const friezeGoldBot = new THREE.TorusGeometry(5.96, 0.055, 8, 64);
    friezeGoldBot.rotateX(Math.PI / 2);
    friezeGoldBot.translate(cx, entablatureY - 0.30, cz);
    goldParts.push(normalizeForMerge(friezeGoldBot));

    // 16 gilded bronze rosette filigree medallions around the entablature frieze
    for (let ri = 0; ri < 16; ri++) {
      const a = (ri / 16) * Math.PI * 2;
      const rx = cx + Math.cos(a) * 6.02;
      const rz = cz + Math.sin(a) * 6.02;
      const rosette = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10);
      rosette.rotateZ(Math.PI / 2);
      rosette.rotateY(-a);
      rosette.translate(rx, entablatureY + 0.02, rz);
      bronzeParts.push(normalizeForMerge(rosette));
    }

    // 4. Open Arched Celestial Rotunda Dome (8 curved marble ribs + golden trim + sunlit oculus + finial spire)
    const domeBaseY = entablatureY + 0.38;
    const domeRadius = 5.55;
    const oculusY = domeBaseY + domeRadius * 0.88;

    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) * Math.PI) / 4.0;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        const phi = t * Math.PI * 0.42;
        const rr = Math.cos(phi) * domeRadius;
        const yy = domeBaseY + Math.sin(phi) * domeRadius * 0.92;
        pts.push(new THREE.Vector3(cx + cosA * rr, yy, cz + sinA * rr));
      }

      const curve = new THREE.CatmullRomCurve3(pts);
      const ribGeo = scaleUVs(new THREE.TubeGeometry(curve, 16, 0.20, 8, false), 3.0, 0.8);
      marbleParts.push(normalizeForMerge(ribGeo));

      const goldRibTrim = new THREE.TubeGeometry(curve, 16, 0.08, 6, false);
      goldRibTrim.translate(0, 0.14, 0);
      goldParts.push(normalizeForMerge(goldRibTrim));
    }

    const midDomeRing = scaleUVs(new THREE.TorusGeometry(domeRadius * 0.72, 0.14, 8, 48), 10, 0.6);
    midDomeRing.rotateX(Math.PI / 2);
    midDomeRing.translate(cx, domeBaseY + domeRadius * 0.56, cz);
    marbleParts.push(normalizeForMerge(midDomeRing));

    const oculusMarble = scaleUVs(new THREE.TorusGeometry(1.42, 0.22, 10, 36), 4, 0.8);
    oculusMarble.rotateX(Math.PI / 2);
    oculusMarble.translate(cx, oculusY, cz);
    marbleParts.push(normalizeForMerge(oculusMarble));

    const oculusGold = new THREE.TorusGeometry(1.42, 0.12, 8, 36);
    oculusGold.rotateX(Math.PI / 2);
    oculusGold.translate(cx, oculusY + 0.18, cz);
    goldParts.push(normalizeForMerge(oculusGold));

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const pts = [
        new THREE.Vector3(cx + Math.cos(a) * 1.42, oculusY + 0.15, cz + Math.sin(a) * 1.42),
        new THREE.Vector3(cx + Math.cos(a) * 0.82, oculusY + 1.25, cz + Math.sin(a) * 0.82),
        new THREE.Vector3(cx, oculusY + 1.95, cz)
      ];
      const crownCurve = new THREE.CatmullRomCurve3(pts);
      goldParts.push(normalizeForMerge(new THREE.TubeGeometry(crownCurve, 10, 0.06, 6, false)));
    }

    const finialOrb = new THREE.SphereGeometry(0.28, 14, 10);
    finialOrb.translate(cx, oculusY + 2.05, cz);
    goldParts.push(normalizeForMerge(finialOrb));

    const finialSpire = new THREE.ConeGeometry(0.11, 1.35, 10);
    finialSpire.translate(cx, oculusY + 2.85, cz);
    goldParts.push(normalizeForMerge(finialSpire));

    // 5. Suspended Golden Lantern Frames + Chains at 4 arches
    this.lanternTransforms = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const lx = cx + Math.cos(a) * 4.25;
      const lz = cz + Math.sin(a) * 4.25;
      const ly = floorY + 3.85;
      this.lanternTransforms.push({ x: lx, y: ly, z: lz, phase: i * 1.4 });

      const chain = new THREE.CylinderGeometry(0.025, 0.025, 2.35, 6);
      chain.translate(lx, ly + 1.25, lz);
      goldParts.push(normalizeForMerge(chain));

      const capRing = new THREE.ConeGeometry(0.30, 0.24, 8);
      capRing.translate(lx, ly + 0.26, lz);
      goldParts.push(normalizeForMerge(capRing));

      const botRing = new THREE.ConeGeometry(0.22, 0.20, 8);
      botRing.rotateX(Math.PI);
      botRing.translate(lx, ly - 0.26, lz);
      goldParts.push(normalizeForMerge(botRing));
    }

    const marbleMesh = new THREE.Mesh(mergeNormalizedParts(marbleParts), marbleMat);
    marbleMesh.name = 'MarbleSanctuaryTemple';
    marbleMesh.castShadow = true;
    marbleMesh.receiveShadow = true;
    this.scene.add(marbleMesh);

    const goldMesh = new THREE.Mesh(mergeNormalizedParts(goldParts), goldMat);
    goldMesh.name = 'TempleGoldenFiligree';
    goldMesh.castShadow = true;
    goldMesh.receiveShadow = true;
    this.scene.add(goldMesh);

    if (bronzeParts.length > 0) {
      const bronzeMesh = new THREE.Mesh(mergeNormalizedParts(bronzeParts), bronzeMat);
      bronzeMesh.name = 'TempleGildedBronzeFiligree';
      bronzeMesh.castShadow = true;
      bronzeMesh.receiveShadow = true;
      this.scene.add(bronzeMesh);
    }

    // 6. Glowing Celestial Floor Medallion at center of Rotunda
    this.medallionMaterial = createCelestialMedallionMaterial();
    const medGeo = new THREE.CircleGeometry(4.2, 64);
    medGeo.rotateX(-Math.PI / 2);
    const medMesh = new THREE.Mesh(medGeo, this.medallionMaterial);
    medMesh.name = 'CelestialFloorMedallion';
    medMesh.position.set(cx, floorY + 0.03, cz);
    this.scene.add(medMesh);

    // 7. Instanced Glowing Sanctuary Lantern Orbs (temple lanterns + pool corner lanterns)
    const orbGeo = new THREE.SphereGeometry(0.18, 12, 10);
    this.lanternOrbMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0.0 },
          uRadiance: { value: 1.0 }
        }
      ]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        void main() {
          #ifdef USE_INSTANCING
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          #else
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          #endif
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform float uRadiance;
        void main() {
          float pulse = 0.88 + 0.12 * sin(uTime * 2.4);
          vec3 glowCol = vec3(1.0, 0.84, 0.42) * (1.28 * pulse * uRadiance);
          gl_FragColor = vec4(glowCol, 1.0);
          #include <fog_fragment>
        }
      `,
      fog: true
    });

    const poolCenterZ = 2.0;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const px = Math.cos(a) * 6.0;
      const pz = poolCenterZ + Math.sin(a) * 6.0;
      const py = getParadiseHeight(px, pz) + 1.35;
      this.lanternTransforms.push({ x: px, y: py, z: pz, phase: 4.0 + i * 1.1 });
    }

    this.lanternOrbsMesh = new THREE.InstancedMesh(orbGeo, this.lanternOrbMaterial, this.lanternTransforms.length);
    this.lanternOrbsMesh.name = 'SanctuaryLanterns';
    for (let i = 0; i < this.lanternTransforms.length; i++) {
      const lt = this.lanternTransforms[i];
      this.tmpPos.set(lt.x, lt.y, lt.z);
      this.tmpQuat.identity();
      this.tmpScale.set(1, 1, 1);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.lanternOrbsMesh.setMatrixAt(i, this.tmpMatrix);
    }
    this.lanternOrbsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.lanternOrbsMesh);
  }

  private buildMarbleBalustradesAndArches(): void {
    const marbleMat = this.carraraMarbleMaterial!;
    const goldMat = this.polishedGoldMaterial!;
    const bronzeMat = this.gildedBronzeMaterial!;

    const marbleParts: THREE.BufferGeometry[] = [];
    const goldParts: THREE.BufferGeometry[] = [];
    const bronzeParts: THREE.BufferGeometry[] = [];

    const rimRadius = 35.8;
    const waterfallAngles = [-0.44, -2.65, 0.85, Math.PI * 0.5, -Math.PI * 0.5, -0.28, -Math.PI + 0.28];
    const isNearGap = (angle: number) => {
      for (const ga of waterfallAngles) {
        let diff = Math.abs(angle - ga);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff < 0.16) return true;
      }
      return false;
    };

    const segCount = 60;
    let prevPos: THREE.Vector3 | null = null;
    for (let i = 0; i <= segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2 - Math.PI;
      if (isNearGap(angle)) {
        prevPos = null;
        continue;
      }
      const x = Math.cos(angle) * rimRadius;
      const z = Math.sin(angle) * rimRadius;
      const y = getParadiseHeight(x, z);
      const curPos = new THREE.Vector3(x, y, z);

      const isPier = i % 4 === 0;
      if (isPier) {
        const pier = applyBoxPlanarUVs(new THREE.BoxGeometry(0.54, 1.12, 0.54), 0.55);
        pier.rotateY(-angle);
        pier.translate(x, y + 0.56, z);
        marbleParts.push(normalizeForMerge(pier));

        const capSphere = new THREE.SphereGeometry(0.20, 10, 8);
        capSphere.translate(x, y + 1.24, z);
        goldParts.push(normalizeForMerge(capSphere));
      } else {
        const baluster = scaleUVs(new THREE.CylinderGeometry(0.08, 0.11, 0.86, 8), 0.6, 0.8);
        baluster.translate(x, y + 0.45, z);
        marbleParts.push(normalizeForMerge(baluster));
      }

      if (prevPos) {
        const mid = prevPos.clone().add(curPos).multiplyScalar(0.5);
        const span = prevPos.distanceTo(curPos) + 0.18;
        const yaw = Math.atan2(curPos.x - prevPos.x, curPos.z - prevPos.z);

        const topRail = applyBoxPlanarUVs(new THREE.BoxGeometry(0.28, 0.13, span), 0.42);
        topRail.rotateY(yaw);
        topRail.translate(mid.x, mid.y + 0.94, mid.z);
        marbleParts.push(normalizeForMerge(topRail));

        const botPlinth = applyBoxPlanarUVs(new THREE.BoxGeometry(0.32, 0.14, span), 0.42);
        botPlinth.rotateY(yaw);
        botPlinth.translate(mid.x, mid.y + 0.07, mid.z);
        marbleParts.push(normalizeForMerge(botPlinth));
      }
      prevPos = curPos;
    }

    // 2. Sculpted Carrara Marble Stepped Coping Rim & 4 Molded Corner Pedestals around Crystal Reflecting Pool (0, 2.0)
    const poolZ = 2.0;
    const copingProfile = [
      new THREE.Vector2(4.92, -0.18),
      new THREE.Vector2(5.68, -0.18),
      new THREE.Vector2(5.68, 0.04),
      new THREE.Vector2(5.52, 0.12),
      new THREE.Vector2(5.50, 0.28),
      new THREE.Vector2(5.12, 0.34),
      new THREE.Vector2(4.94, 0.24),
      new THREE.Vector2(4.92, -0.18)
    ];
    const poolRim = scaleUVs(new THREE.LatheGeometry(copingProfile, 64), 16, 1.0);
    poolRim.translate(0, 0.06, poolZ);
    marbleParts.push(normalizeForMerge(poolRim));

    const poolGoldTrim = new THREE.TorusGeometry(5.26, 0.045, 8, 56);
    poolGoldTrim.rotateX(Math.PI / 2);
    poolGoldTrim.translate(0, 0.38, poolZ);
    goldParts.push(normalizeForMerge(poolGoldTrim));

    const poolBronzeBand = new THREE.TorusGeometry(5.54, 0.032, 8, 56);
    poolBronzeBand.rotateX(Math.PI / 2);
    poolBronzeBand.translate(0, 0.14, poolZ);
    bronzeParts.push(normalizeForMerge(poolBronzeBand));

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const px = Math.cos(a) * 6.0;
      const pz = poolZ + Math.sin(a) * 6.0;
      const py = getParadiseHeight(px, pz);

      const pedPlinth = applyBoxPlanarUVs(new THREE.BoxGeometry(0.84, 0.18, 0.84), 0.55);
      pedPlinth.rotateY(-a);
      pedPlinth.translate(px, py + 0.09, pz);
      marbleParts.push(normalizeForMerge(pedPlinth));

      const pedestal = scaleUVs(new THREE.CylinderGeometry(0.28, 0.36, 0.94, 16), 1.0, 0.8);
      pedestal.translate(px, py + 0.62, pz);
      marbleParts.push(normalizeForMerge(pedestal));

      const pedBand = new THREE.TorusGeometry(0.35, 0.03, 8, 18);
      pedBand.rotateX(Math.PI / 2);
      pedBand.translate(px, py + 0.22, pz);
      bronzeParts.push(normalizeForMerge(pedBand));

      const cup = new THREE.CylinderGeometry(0.34, 0.18, 0.22, 14);
      cup.translate(px, py + 1.16, pz);
      goldParts.push(normalizeForMerge(cup));
    }

    // 3. Classical South Gateway Arch & West Garden Arch with Sculpted Base Plinth Moldings & Gilded Bronze Filigree
    const archAtticProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.42, 0.0),
      new THREE.Vector2(0.43, 0.07),
      new THREE.Vector2(0.36, 0.12),
      new THREE.Vector2(0.39, 0.17),
      new THREE.Vector2(0.31, 0.22),
      new THREE.Vector2(0.0, 0.22)
    ];

    const buildGardenArch = (ax: number, az: number, yaw: number) => {
      const ay = getParadiseHeight(ax, az);
      const halfSpan = 2.35;
      const archH = 4.2;

      for (const side of [-1, 1]) {
        const px = ax + Math.cos(yaw) * side * halfSpan;
        const pz = az - Math.sin(yaw) * side * halfSpan;

        // Stepped classical pedestal plinth + Attic base molding
        const baseStep = applyBoxPlanarUVs(new THREE.BoxGeometry(1.04, 0.20, 1.04), 0.55);
        baseStep.rotateY(yaw);
        baseStep.translate(px, ay + 0.10, pz);
        marbleParts.push(normalizeForMerge(baseStep));

        const base = applyBoxPlanarUVs(new THREE.BoxGeometry(0.86, 0.22, 0.86), 0.55);
        base.rotateY(yaw);
        base.translate(px, ay + 0.30, pz);
        marbleParts.push(normalizeForMerge(base));

        const atticMolding = scaleUVs(new THREE.LatheGeometry(archAtticProfile, 20), 1.4, 0.6);
        atticMolding.translate(px, ay + 0.41, pz);
        marbleParts.push(normalizeForMerge(atticMolding));

        const bronzeBaseCollar = new THREE.TorusGeometry(0.35, 0.032, 8, 20);
        bronzeBaseCollar.rotateX(Math.PI / 2);
        bronzeBaseCollar.translate(px, ay + 0.56, pz);
        bronzeParts.push(normalizeForMerge(bronzeBaseCollar));

        const col = scaleUVs(new THREE.CylinderGeometry(0.26, 0.30, archH - 0.18, 18), 1.0, 1.8);
        col.translate(px, ay + 0.62 + (archH - 0.18) * 0.5, pz);
        marbleParts.push(normalizeForMerge(col));

        const midBronzeBand = new THREE.TorusGeometry(0.285, 0.025, 8, 18);
        midBronzeBand.rotateX(Math.PI / 2);
        midBronzeBand.translate(px, ay + 0.62 + (archH - 0.18) * 0.35, pz);
        bronzeParts.push(normalizeForMerge(midBronzeBand));

        const collar = new THREE.TorusGeometry(0.28, 0.055, 8, 18);
        collar.rotateX(Math.PI / 2);
        collar.translate(px, ay + 0.46 + archH, pz);
        goldParts.push(normalizeForMerge(collar));

        // Molded impost block at arch spring-line
        const cap = applyBoxPlanarUVs(new THREE.BoxGeometry(0.84, 0.22, 0.84), 0.55);
        cap.rotateY(yaw);
        cap.translate(px, ay + 0.46 + archH + 0.12, pz);
        marbleParts.push(normalizeForMerge(cap));

        const impostCrown = applyBoxPlanarUVs(new THREE.BoxGeometry(0.96, 0.10, 0.96), 0.55);
        impostCrown.rotateY(yaw);
        impostCrown.translate(px, ay + 0.46 + archH + 0.27, pz);
        marbleParts.push(normalizeForMerge(impostCrown));
      }

      const archPts: THREE.Vector3[] = [];
      const outerFiligreePts: THREE.Vector3[] = [];
      const innerFiligreePts: THREE.Vector3[] = [];
      for (let s = 0; s <= 18; s++) {
        const theta = (s / 18) * Math.PI;
        const cosT = -Math.cos(theta);
        const sinT = Math.sin(theta);
        const baseY = ay + 0.46 + archH + 0.28;
        archPts.push(new THREE.Vector3(ax + Math.cos(yaw) * cosT * halfSpan, baseY + sinT * halfSpan, az - Math.sin(yaw) * cosT * halfSpan));
        outerFiligreePts.push(new THREE.Vector3(ax + Math.cos(yaw) * cosT * (halfSpan + 0.22), baseY + sinT * (halfSpan + 0.22), az - Math.sin(yaw) * cosT * (halfSpan + 0.22)));
        innerFiligreePts.push(new THREE.Vector3(ax + Math.cos(yaw) * cosT * (halfSpan - 0.22), baseY + sinT * (halfSpan - 0.22), az - Math.sin(yaw) * cosT * (halfSpan - 0.22)));
      }
      const archCurve = new THREE.CatmullRomCurve3(archPts);
      const archTube = scaleUVs(new THREE.TubeGeometry(archCurve, 24, 0.26, 12, false), 3.4, 0.8);
      marbleParts.push(normalizeForMerge(archTube));

      const outerArchFiligree = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outerFiligreePts), 24, 0.042, 8, false);
      bronzeParts.push(normalizeForMerge(outerArchFiligree));
      const innerArchFiligree = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(innerFiligreePts), 24, 0.036, 8, false);
      goldParts.push(normalizeForMerge(innerArchFiligree));

      // Carved marble keystone at arch apex
      const keystone = applyBoxPlanarUVs(new THREE.BoxGeometry(0.46, 0.62, 0.64), 0.55);
      keystone.rotateY(yaw);
      keystone.translate(ax, ay + 0.46 + archH + 0.28 + halfSpan, az);
      marbleParts.push(normalizeForMerge(keystone));

      const crownOrb = new THREE.SphereGeometry(0.26, 12, 10);
      crownOrb.translate(ax, ay + 0.46 + archH + 0.28 + halfSpan + 0.46, az);
      goldParts.push(normalizeForMerge(crownOrb));
    };

    buildGardenArch(0, 29.0, 0);
    buildGardenArch(-15.5, 4.0, Math.PI * 0.38);

    // 4. Two Curved Marble Colonnade Wings flanking the Sanctuary Plaza (East & West Wings)
    for (const side of [-1, 1]) {
      const colPts: THREE.Vector3[] = [];
      const colCount = 6;
      const colH = 4.6;
      for (let ci = 0; ci < colCount; ci++) {
        const t = ci / (colCount - 1);
        const wx = side * (9.2 + t * 16.8);
        const wz = -14.2 + Math.sin(t * Math.PI) * 3.2 + t * 4.0;
        const wy = getParadiseHeight(wx, wz);
        colPts.push(new THREE.Vector3(wx, wy, wz));

        const plinth = applyBoxPlanarUVs(new THREE.BoxGeometry(0.92, 0.22, 0.92), 0.55);
        plinth.translate(wx, wy + 0.11, wz);
        marbleParts.push(normalizeForMerge(plinth));

        const attic = scaleUVs(new THREE.LatheGeometry(archAtticProfile, 18), 1.4, 0.6);
        attic.translate(wx, wy + 0.22, wz);
        marbleParts.push(normalizeForMerge(attic));

        const shaft = scaleUVs(new THREE.CylinderGeometry(0.24, 0.28, colH, 16), 1.0, 1.8);
        shaft.translate(wx, wy + 0.44 + colH * 0.5, wz);
        marbleParts.push(normalizeForMerge(shaft));

        const collar = new THREE.TorusGeometry(0.26, 0.04, 8, 16);
        collar.rotateX(Math.PI / 2);
        collar.translate(wx, wy + 0.44 + colH, wz);
        goldParts.push(normalizeForMerge(collar));

        const capBell = new THREE.CylinderGeometry(0.38, 0.25, 0.34, 14);
        capBell.translate(wx, wy + 0.44 + colH + 0.18, wz);
        goldParts.push(normalizeForMerge(capBell));

        const abacus = applyBoxPlanarUVs(new THREE.BoxGeometry(0.86, 0.16, 0.86), 0.55);
        abacus.translate(wx, wy + 0.44 + colH + 0.42, wz);
        marbleParts.push(normalizeForMerge(abacus));
      }

      const entabPts = colPts.map((p) => new THREE.Vector3(p.x, p.y + 0.44 + colH + 0.62, p.z));
      const entabCurve = new THREE.CatmullRomCurve3(entabPts);
      const entabBeam = scaleUVs(new THREE.TubeGeometry(entabCurve, 28, 0.28, 10, false), 5.0, 0.8);
      marbleParts.push(normalizeForMerge(entabBeam));

      const goldFriezePts = colPts.map((p) => new THREE.Vector3(p.x, p.y + 0.44 + colH + 0.92, p.z));
      const goldFrieze = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(goldFriezePts), 28, 0.065, 8, false);
      goldParts.push(normalizeForMerge(goldFrieze));

      const styloPts = colPts.map((p) => new THREE.Vector3(p.x, p.y + 0.06, p.z));
      const styloBeam = scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(styloPts), 24, 0.48, 8, false), 4.5, 0.8);
      marbleParts.push(normalizeForMerge(styloBeam));
    }

    // 5. Two Arched Golden-Marble Footbridges linking to Walkable Outer Celestial Terraces & Outer Pavilions
    for (const side of [-1, 1]) {
      const xStart = side * 33.4;
      const xEnd = side * 39.8;
      const bz = -10.0;
      const deckW = 2.8;

      const archCurvePts: THREE.Vector3[] = [];
      const railNorthPts: THREE.Vector3[] = [];
      const railSouthPts: THREE.Vector3[] = [];
      const steps = 16;

      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const bx = xStart + (xEnd - xStart) * u;
        const by = getParadiseHeight(bx, bz);
        archCurvePts.push(new THREE.Vector3(bx, by - 0.14, bz));
        railNorthPts.push(new THREE.Vector3(bx, by + 0.92, bz - deckW * 0.48));
        railSouthPts.push(new THREE.Vector3(bx, by + 0.92, bz + deckW * 0.48));

        if (s < steps) {
          const nextU = (s + 1) / steps;
          const nextX = xStart + (xEnd - xStart) * nextU;
          const nextY = getParadiseHeight(nextX, bz);
          const midX = (bx + nextX) * 0.5;
          const midY = (by + nextY) * 0.5;
          const segLen = Math.hypot(nextX - bx, nextY - by) + 0.08;
          const pitch = Math.atan2(nextY - by, Math.abs(nextX - bx)) * side;

          const deckSlab = applyBoxPlanarUVs(new THREE.BoxGeometry(segLen, 0.22, deckW), 0.45);
          deckSlab.rotateZ(pitch);
          deckSlab.translate(midX, midY - 0.06, bz);
          marbleParts.push(normalizeForMerge(deckSlab));
        }

        for (const zSide of [-1, 1]) {
          const rz = bz + zSide * deckW * 0.48;
          if (s === 0 || s === steps || s === 8) {
            const pier = applyBoxPlanarUVs(new THREE.BoxGeometry(0.52, 1.16, 0.52), 0.55);
            pier.translate(bx, by + 0.54, rz);
            marbleParts.push(normalizeForMerge(pier));

            const finial = new THREE.SphereGeometry(0.20, 10, 8);
            finial.translate(bx, by + 1.24, rz);
            goldParts.push(normalizeForMerge(finial));
          } else if (s % 2 === 0) {
            const bal = scaleUVs(new THREE.CylinderGeometry(0.075, 0.10, 0.88, 8), 0.6, 0.8);
            bal.translate(bx, by + 0.44, rz);
            marbleParts.push(normalizeForMerge(bal));
          }
        }
      }

      for (const zSide of [-1, 1]) {
        const ribPts = archCurvePts.map(
          (p, idx) =>
            new THREE.Vector3(
              p.x,
              p.y - 0.45 + Math.sin((idx / steps) * Math.PI) * 0.35,
              bz + zSide * (deckW * 0.48)
            )
        );
        const ribTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 20, 0.12, 8, false);
        goldParts.push(normalizeForMerge(ribTube));
      }

      const railN = scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railNorthPts), 20, 0.11, 8, false), 3.0, 0.6);
      const railS = scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railSouthPts), 20, 0.11, 8, false), 3.0, 0.6);
      marbleParts.push(normalizeForMerge(railN), normalizeForMerge(railS));

      // Outer Celestial Belvedere Pavilion Rotunda at (side * 48.0, -10.0)
      const px = side * 48.0;
      const pz = -10.0;
      const py = getParadiseHeight(px, pz);
      const pavR = 3.6;
      const pavColH = 3.9;

      const pavStylobate = scaleUVs(new THREE.CylinderGeometry(pavR + 0.45, pavR + 0.72, 0.32, 32), 6.0, 0.5);
      pavStylobate.translate(px, py + 0.12, pz);
      marbleParts.push(normalizeForMerge(pavStylobate));

      const pavGoldTrim = new THREE.TorusGeometry(pavR + 0.46, 0.045, 8, 36);
      pavGoldTrim.rotateX(Math.PI / 2);
      pavGoldTrim.translate(px, py + 0.28, pz);
      goldParts.push(normalizeForMerge(pavGoldTrim));

      for (let ci = 0; ci < 6; ci++) {
        const ca = (ci / 6) * Math.PI * 2 + Math.PI / 6;
        const cx = px + Math.cos(ca) * pavR;
        const cz = pz + Math.sin(ca) * pavR;

        const cBase = applyBoxPlanarUVs(new THREE.BoxGeometry(0.76, 0.22, 0.76), 0.55);
        cBase.rotateY(-ca);
        cBase.translate(cx, py + 0.36, cz);
        marbleParts.push(normalizeForMerge(cBase));

        const cShaft = scaleUVs(new THREE.CylinderGeometry(0.21, 0.25, pavColH, 16), 1.0, 1.6);
        cShaft.translate(cx, py + 0.46 + pavColH * 0.5, cz);
        marbleParts.push(normalizeForMerge(cShaft));

        const cCap = new THREE.CylinderGeometry(0.34, 0.22, 0.30, 14);
        cCap.translate(cx, py + 0.46 + pavColH + 0.15, cz);
        goldParts.push(normalizeForMerge(cCap));

        const ribCurvePts: THREE.Vector3[] = [];
        const domeBaseY = py + 0.46 + pavColH + 0.52;
        for (let ds = 0; ds <= 10; ds++) {
          const dt = ds / 10;
          const phi = dt * Math.PI * 0.45;
          const dr = Math.cos(phi) * pavR;
          const dy = domeBaseY + Math.sin(phi) * pavR * 0.88;
          ribCurvePts.push(new THREE.Vector3(px + Math.cos(ca) * dr, dy, pz + Math.sin(ca) * dr));
        }
        const ribGeo = scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribCurvePts), 12, 0.14, 8, false), 2.5, 0.6);
        marbleParts.push(normalizeForMerge(ribGeo));

        const goldRib = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribCurvePts), 12, 0.055, 6, false);
        goldRib.translate(0, 0.10, 0);
        goldParts.push(normalizeForMerge(goldRib));
      }

      const pavEntabY = py + 0.46 + pavColH + 0.36;
      const pavEntab = scaleUVs(new THREE.TorusGeometry(pavR, 0.24, 10, 36), 8.0, 0.8);
      pavEntab.rotateX(Math.PI / 2);
      pavEntab.translate(px, pavEntabY, pz);
      marbleParts.push(normalizeForMerge(pavEntab));

      const pavFriezeGold = new THREE.TorusGeometry(pavR + 0.18, 0.05, 8, 36);
      pavFriezeGold.rotateX(Math.PI / 2);
      pavFriezeGold.translate(px, pavEntabY + 0.18, pz);
      goldParts.push(normalizeForMerge(pavFriezeGold));

      const pavApexY = pavEntabY + 0.16 + pavR * 0.88;
      const pavOculus = new THREE.TorusGeometry(0.65, 0.12, 8, 24);
      pavOculus.rotateX(Math.PI / 2);
      pavOculus.translate(px, pavApexY, pz);
      goldParts.push(normalizeForMerge(pavOculus));

      const pavFinial = new THREE.ConeGeometry(0.10, 1.15, 8);
      pavFinial.translate(px, pavApexY + 0.65, pz);
      goldParts.push(normalizeForMerge(pavFinial));
    }

    // 6. Four Outer Arched Carrara Marble Sky-Walkways (East/West Outer Bridges + South/North Grand Viaducts)
    const outerBridgeSpecs: Array<{
      x0: number;
      z0: number;
      x1: number;
      z1: number;
      deckW: number;
      steps: number;
    }> = [
      { x0: 57.0, z0: -10.0, x1: 69.4, z1: -10.0, deckW: 3.0, steps: 18 },
      { x0: -57.0, z0: -10.0, x1: -69.4, z1: -10.0, deckW: 3.0, steps: 18 },
      { x0: 0.0, z0: 37.8, x1: 0.0, z1: 58.8, deckW: 3.4, steps: 24 },
      { x0: 0.0, z0: -38.2, x1: 0.0, z1: -61.8, deckW: 3.2, steps: 26 }
    ];

    for (const bSpec of outerBridgeSpecs) {
      const dx = bSpec.x1 - bSpec.x0;
      const dz = bSpec.z1 - bSpec.z0;
      const bLen = Math.hypot(dx, dz) || 1;
      const dirX = dx / bLen;
      const dirZ = dz / bLen;
      const perpX = -dirZ;
      const perpZ = dirX;
      const yaw = Math.atan2(dx, dz);

      const archPts: THREE.Vector3[] = [];
      const railLPts: THREE.Vector3[] = [];
      const railRPts: THREE.Vector3[] = [];

      for (let s = 0; s <= bSpec.steps; s++) {
        const u = s / bSpec.steps;
        const bx = bSpec.x0 + dx * u;
        const bz = bSpec.z0 + dz * u;
        const by = getParadiseHeight(bx, bz);
        archPts.push(new THREE.Vector3(bx, by - 0.16, bz));
        railLPts.push(new THREE.Vector3(bx + perpX * bSpec.deckW * 0.48, by + 0.94, bz + perpZ * bSpec.deckW * 0.48));
        railRPts.push(new THREE.Vector3(bx - perpX * bSpec.deckW * 0.48, by + 0.94, bz - perpZ * bSpec.deckW * 0.48));

        if (s < bSpec.steps) {
          const nu = (s + 1) / bSpec.steps;
          const nx = bSpec.x0 + dx * nu;
          const nz = bSpec.z0 + dz * nu;
          const ny = getParadiseHeight(nx, nz);
          const mx = (bx + nx) * 0.5;
          const mz = (bz + nz) * 0.5;
          const my = (by + ny) * 0.5;
          const horizStep = Math.hypot(nx - bx, nz - bz);
          const segLen = Math.hypot(horizStep, ny - by) + 0.08;
          const pitch = Math.atan2(ny - by, horizStep);

          const slab = applyBoxPlanarUVs(new THREE.BoxGeometry(bSpec.deckW, 0.24, segLen), 0.45);
          slab.rotateX(-pitch);
          slab.rotateY(yaw);
          slab.translate(mx, my - 0.08, mz);
          marbleParts.push(normalizeForMerge(slab));
        }

        for (const side of [-1, 1]) {
          const rx = bx + perpX * side * bSpec.deckW * 0.48;
          const rz = bz + perpZ * side * bSpec.deckW * 0.48;
          if (s === 0 || s === bSpec.steps || s === Math.floor(bSpec.steps * 0.5)) {
            const pier = applyBoxPlanarUVs(new THREE.BoxGeometry(0.56, 1.22, 0.56), 0.55);
            pier.rotateY(yaw);
            pier.translate(rx, by + 0.56, rz);
            marbleParts.push(normalizeForMerge(pier));

            const finial = new THREE.SphereGeometry(0.22, 10, 8);
            finial.translate(rx, by + 1.28, rz);
            goldParts.push(normalizeForMerge(finial));
          } else if (s % 2 === 0) {
            const bal = scaleUVs(new THREE.CylinderGeometry(0.08, 0.11, 0.90, 8), 0.6, 0.8);
            bal.translate(rx, by + 0.45, rz);
            marbleParts.push(normalizeForMerge(bal));
          }
        }
      }

      for (const side of [-1, 1]) {
        const ribPts = archPts.map(
          (p, idx) =>
            new THREE.Vector3(
              p.x + perpX * side * (bSpec.deckW * 0.48),
              p.y - 0.52 + Math.sin((idx / bSpec.steps) * Math.PI) * 0.42,
              p.z + perpZ * side * (bSpec.deckW * 0.48)
            )
        );
        goldParts.push(normalizeForMerge(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 24, 0.13, 8, false)));
      }

      const railL = scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railLPts), 24, 0.12, 8, false), 4.0, 0.6);
      const railR = scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railRPts), 24, 0.12, 8, false), 4.0, 0.6);
      marbleParts.push(normalizeForMerge(railL), normalizeForMerge(railR));
    }

    // 7. Far East & Far West Cherry-Blossom Belvedere Plazas & Classical Rotundas at (±84, -10)
    const outerLanternPositions: Array<{ x: number; y: number; z: number }> = [];
    for (const side of [-1, 1]) {
      const px = side * 84.0;
      const pz = -10.0;
      const py = getParadiseHeight(px, pz);
      const plazaR = 5.6;
      const plazaDeck = scaleUVs(new THREE.CylinderGeometry(plazaR, plazaR + 0.45, 0.28, 36), 8.0, 0.5);
      plazaDeck.translate(px, py - 0.04, pz);
      marbleParts.push(normalizeForMerge(plazaDeck));

      const pavR = 3.8;
      const pavColH = 4.2;
      const pavGoldTrim = new THREE.TorusGeometry(pavR + 0.6, 0.05, 8, 36);
      pavGoldTrim.rotateX(Math.PI / 2);
      pavGoldTrim.translate(px, py + 0.12, pz);
      goldParts.push(normalizeForMerge(pavGoldTrim));

      for (let ci = 0; ci < 6; ci++) {
        const ca = (ci / 6) * Math.PI * 2 + Math.PI / 6;
        const cx = px + Math.cos(ca) * pavR;
        const cz = pz + Math.sin(ca) * pavR;

        const cBase = applyBoxPlanarUVs(new THREE.BoxGeometry(0.80, 0.22, 0.80), 0.55);
        cBase.rotateY(-ca);
        cBase.translate(cx, py + 0.20, cz);
        marbleParts.push(normalizeForMerge(cBase));

        const cShaft = scaleUVs(new THREE.CylinderGeometry(0.22, 0.26, pavColH, 14), 1.0, 1.6);
        cShaft.translate(cx, py + 0.30 + pavColH * 0.5, cz);
        marbleParts.push(normalizeForMerge(cShaft));

        const cCap = new THREE.CylinderGeometry(0.36, 0.23, 0.32, 14);
        cCap.translate(cx, py + 0.30 + pavColH + 0.16, cz);
        goldParts.push(normalizeForMerge(cCap));

        const ribCurvePts: THREE.Vector3[] = [];
        const domeBaseY = py + 0.30 + pavColH + 0.54;
        for (let ds = 0; ds <= 10; ds++) {
          const dt = ds / 10;
          const phi = dt * Math.PI * 0.45;
          const dr = Math.cos(phi) * pavR;
          const dy = domeBaseY + Math.sin(phi) * pavR * 0.88;
          ribCurvePts.push(new THREE.Vector3(px + Math.cos(ca) * dr, dy, pz + Math.sin(ca) * dr));
        }
        marbleParts.push(normalizeForMerge(scaleUVs(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribCurvePts), 12, 0.15, 8, false), 2.5, 0.6)));
        const gRib = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribCurvePts), 12, 0.06, 6, false);
        gRib.translate(0, 0.10, 0);
        goldParts.push(normalizeForMerge(gRib));
      }

      const pavEntabY = py + 0.30 + pavColH + 0.38;
      const pavEntab = scaleUVs(new THREE.TorusGeometry(pavR, 0.25, 10, 36), 8.0, 0.8);
      pavEntab.rotateX(Math.PI / 2);
      pavEntab.translate(px, pavEntabY, pz);
      marbleParts.push(normalizeForMerge(pavEntab));

      const pavApexY = pavEntabY + 0.16 + pavR * 0.88;
      const pavOculus = new THREE.TorusGeometry(0.68, 0.12, 8, 24);
      pavOculus.rotateX(Math.PI / 2);
      pavOculus.translate(px, pavApexY, pz);
      goldParts.push(normalizeForMerge(pavOculus));

      const pavFinial = new THREE.ConeGeometry(0.11, 1.25, 8);
      pavFinial.translate(px, pavApexY + 0.68, pz);
      goldParts.push(normalizeForMerge(pavFinial));

      outerLanternPositions.push({ x: px, y: py + 3.4, z: pz });
    }

    // 8. South Sky-Harbor (0, 74) & North Celestial (0, -76) Lotus Sanctuary Pools & Marble Coping Rims
    const lotusSanctuaries: Array<{ cx: number; cz: number; poolR: number; baseH: number }> = [
      { cx: 0.0, cz: 74.0, poolR: 5.2, baseH: 0.95 },
      { cx: 0.0, cz: -76.0, poolR: 4.8, baseH: 1.55 }
    ];
    for (const ls of lotusSanctuaries) {
      const copingProfile = [
        new THREE.Vector2(ls.poolR - 0.18, -0.22),
        new THREE.Vector2(ls.poolR + 0.64, -0.22),
        new THREE.Vector2(ls.poolR + 0.64, 0.06),
        new THREE.Vector2(ls.poolR + 0.45, 0.16),
        new THREE.Vector2(ls.poolR + 0.42, 0.32),
        new THREE.Vector2(ls.poolR + 0.06, 0.38),
        new THREE.Vector2(ls.poolR - 0.14, 0.24),
        new THREE.Vector2(ls.poolR - 0.18, -0.22)
      ];
      const poolRim = scaleUVs(new THREE.LatheGeometry(copingProfile, 56), 14, 1.0);
      poolRim.translate(ls.cx, ls.baseH, ls.cz);
      marbleParts.push(normalizeForMerge(poolRim));

      const goldRim = new THREE.TorusGeometry(ls.poolR + 0.22, 0.045, 8, 48);
      goldRim.rotateX(Math.PI / 2);
      goldRim.translate(ls.cx, ls.baseH + 0.36, ls.cz);
      goldParts.push(normalizeForMerge(goldRim));

      const bronzeRim = new THREE.TorusGeometry(ls.poolR + 0.48, 0.032, 8, 48);
      bronzeRim.rotateX(Math.PI / 2);
      bronzeRim.translate(ls.cx, ls.baseH + 0.14, ls.cz);
      bronzeParts.push(normalizeForMerge(bronzeRim));

      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const px = ls.cx + Math.cos(a) * (ls.poolR + 1.05);
        const pz = ls.cz + Math.sin(a) * (ls.poolR + 1.05);
        const py = getParadiseHeight(px, pz);

        const ped = scaleUVs(new THREE.CylinderGeometry(0.28, 0.36, 0.96, 14), 1.0, 0.8);
        ped.translate(px, py + 0.48, pz);
        marbleParts.push(normalizeForMerge(ped));

        const cup = new THREE.CylinderGeometry(0.34, 0.18, 0.22, 12);
        cup.translate(px, py + 1.02, pz);
        goldParts.push(normalizeForMerge(cup));

        outerLanternPositions.push({ x: px, y: py + 1.24, z: pz });
      }
    }

    if (this.lanternOrbMaterial && outerLanternPositions.length > 0) {
      const orbGeo = new THREE.SphereGeometry(0.20, 12, 10);
      const outerLanterns = new THREE.InstancedMesh(orbGeo, this.lanternOrbMaterial, outerLanternPositions.length);
      outerLanterns.name = 'OuterSanctuaryLanterns';
      for (let i = 0; i < outerLanternPositions.length; i++) {
        this.tmpMatrix.makeTranslation(
          outerLanternPositions[i].x,
          outerLanternPositions[i].y,
          outerLanternPositions[i].z
        );
        outerLanterns.setMatrixAt(i, this.tmpMatrix);
      }
      outerLanterns.instanceMatrix.needsUpdate = true;
      this.scene.add(outerLanterns);
    }

    const balMesh = new THREE.Mesh(mergeNormalizedParts(marbleParts), marbleMat);
    balMesh.name = 'MarbleBalustrades';
    balMesh.castShadow = true;
    balMesh.receiveShadow = true;
    this.scene.add(balMesh);

    const balGoldMesh = new THREE.Mesh(mergeNormalizedParts(goldParts), goldMat);
    balGoldMesh.name = 'BalustradeGoldenFinials';
    balGoldMesh.castShadow = true;
    balGoldMesh.receiveShadow = true;
    this.scene.add(balGoldMesh);

    if (bronzeParts.length > 0) {
      const balBronzeMesh = new THREE.Mesh(mergeNormalizedParts(bronzeParts), bronzeMat);
      balBronzeMesh.name = 'BalustradeBronzeFiligree';
      balBronzeMesh.castShadow = true;
      balBronzeMesh.receiveShadow = true;
      this.scene.add(balBronzeMesh);
    }
  }

  private buildCrystalReflectingPool(): void {
    const geo = new THREE.CircleGeometry(5.15, 64);
    geo.rotateX(-Math.PI / 2);

    this.waterMaterial = createCrystalWaterMaterial({
      sunDirection: this.currentConfig!.lighting.directional.position,
      skyTopColor: this.currentConfig!.sky.topColor,
      horizonColor: this.currentConfig!.sky.horizonColor
    });

    const poolMesh = new THREE.Mesh(geo, this.waterMaterial);
    poolMesh.name = 'CrystalReflectingPool';
    poolMesh.position.set(0, 0.04, 2.0);
    this.scene.add(poolMesh);

    // Outer Lotus Sanctuary Reflecting Pools + Floating Emerald Lotus Pads & Pink-Ivory Lotus Blossoms
    const padParts: THREE.BufferGeometry[] = [];
    const petalParts: THREE.BufferGeometry[] = [];
    const lotusPools = [
      { cx: 0.0, cz: 74.0, waterY: 0.90, r: 5.08 },
      { cx: 0.0, cz: -76.0, waterY: 1.50, r: 4.68 }
    ];
    for (let li = 0; li < lotusPools.length; li++) {
      const lp = lotusPools[li];
      const lpGeo = new THREE.CircleGeometry(lp.r, 56);
      lpGeo.rotateX(-Math.PI / 2);
      const lpMesh = new THREE.Mesh(lpGeo, this.waterMaterial);
      lpMesh.name = li === 0 ? 'SouthLotusReflectingPool' : 'NorthLotusReflectingPool';
      lpMesh.position.set(lp.cx, lp.waterY, lp.cz);
      this.scene.add(lpMesh);

      for (let pi = 0; pi < 18; pi++) {
        const ang = pi * 2.399963 + li * 0.9;
        const rad = 0.75 + Math.sqrt((pi + 0.5) / 18) * (lp.r - 1.35);
        const px = lp.cx + Math.cos(ang) * rad;
        const pz = lp.cz + Math.sin(ang) * rad;
        const padR = 0.28 + (pi % 3) * 0.09;

        const pad = new THREE.CircleGeometry(padR, 14, 0.18, Math.PI * 1.82);
        pad.rotateX(-Math.PI / 2);
        pad.rotateY(ang + pi);
        pad.translate(px, lp.waterY + 0.018, pz);
        padParts.push(normalizeForMerge(pad));

        if (pi % 2 === 0) {
          for (let pk = 0; pk < 6; pk++) {
            const pa = (pk / 6) * Math.PI * 2;
            const pet = new THREE.SphereGeometry(0.085, 6, 5);
            pet.scale(0.55, 0.35, 1.35);
            pet.rotateX(-0.42);
            pet.translate(0, 0.06, 0.08);
            pet.rotateY(pa + pi);
            pet.translate(px, lp.waterY + 0.025, pz);
            petalParts.push(normalizeForMerge(pet));
          }
        }
      }
    }

    if (padParts.length > 0) {
      const padMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2d6b45'),
        roughness: 0.65,
        metalness: 0.04,
        side: THREE.DoubleSide
      });
      const padsMesh = new THREE.Mesh(mergeNormalizedParts(padParts), padMat);
      padsMesh.name = 'OuterLotusPads';
      this.scene.add(padsMesh);
    }
    if (petalParts.length > 0) {
      const lotusPetalMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffd6e4'),
        emissive: new THREE.Color('#ff8cb6'),
        emissiveIntensity: 0.14,
        roughness: 0.42
      });
      const lotusMesh = new THREE.Mesh(mergeNormalizedParts(petalParts), lotusPetalMat);
      lotusMesh.name = 'OuterLotusBlossoms';
      this.scene.add(lotusMesh);
    }

    // Floating Sakura Petals Resting & Drifting Gently on Fountain & Lotus Pool Water
    const waterPetalGeo = new THREE.PlaneGeometry(0.14, 0.19, 2, 2);
    const wpPos = waterPetalGeo.attributes.position;
    for (let i = 0; i < wpPos.count; i++) {
      const wx = wpPos.getX(i);
      const wy = wpPos.getY(i);
      const taper = 0.65 + 0.35 * ((wy + 0.095) / 0.19);
      const cup = (wx * wx * 2.2 + wy * wy * 0.6) * 0.5;
      wpPos.setXYZ(i, wx * taper, wy, cup);
    }
    waterPetalGeo.rotateX(-Math.PI * 0.5);
    waterPetalGeo.computeVertexNormals();

    const waterPetalPools: Array<{ cx: number; cz: number; y: number; maxR: number; count: number }> = [
      { cx: 0.0, cz: 2.0, y: 0.056, maxR: 4.55, count: 130 },
      { cx: 0.0, cz: 74.0, y: 0.916, maxR: 4.45, count: 45 },
      { cx: 0.0, cz: -76.0, y: 1.516, maxR: 4.05, count: 45 }
    ];
    const totalWaterPetals = waterPetalPools.reduce((acc, p) => acc + p.count, 0);
    const wpPhases = new Float32Array(totalWaterPetals);
    this.floatingWaterPetalsMaterial = createFloatingWaterPetalsMaterial();
    const waterPetalsMesh = new THREE.InstancedMesh(
      waterPetalGeo,
      this.floatingWaterPetalsMaterial,
      totalWaterPetals
    );
    waterPetalsMesh.name = 'FloatingFountainPetals';

    const wpPalette = [
      new THREE.Color('#ffd0e1'),
      new THREE.Color('#fff2f6'),
      new THREE.Color('#ffb8d2'),
      new THREE.Color('#ffe5ef')
    ];
    let wpIdx = 0;
    for (let pi = 0; pi < waterPetalPools.length; pi++) {
      const pool = waterPetalPools[pi];
      for (let k = 0; k < pool.count; k++) {
        const r1 = pseudoRand(wpIdx * 3.17 + 1.1);
        const r2 = pseudoRand(wpIdx * 6.83 + 2.7);
        const rad = 0.45 + Math.sqrt(r1) * (pool.maxR - 0.65);
        const ang = r2 * Math.PI * 2;
        this.tmpPos.set(pool.cx + Math.cos(ang) * rad, pool.y, pool.cz + Math.sin(ang) * rad);
        this.tmpEuler.set((r1 - 0.5) * 0.10, r2 * Math.PI * 2, (r2 - 0.5) * 0.10);
        this.tmpQuat.setFromEuler(this.tmpEuler);
        const sc = 0.78 + r1 * 0.52;
        this.tmpScale.set(sc, sc, sc);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        waterPetalsMesh.setMatrixAt(wpIdx, this.tmpMatrix);
        waterPetalsMesh.setColorAt(wpIdx, wpPalette[wpIdx % wpPalette.length]);
        wpPhases[wpIdx] = pseudoRand(wpIdx * 9.41 + 0.5);
        wpIdx++;
      }
    }
    waterPetalGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(wpPhases, 1));
    waterPetalsMesh.instanceMatrix.needsUpdate = true;
    if (waterPetalsMesh.instanceColor) waterPetalsMesh.instanceColor.needsUpdate = true;
    this.scene.add(waterPetalsMesh);
  }

  private buildHeavenlyWaterfalls(): void {
    const waterfallAngles = [-0.44, -2.65, 0.85];
    const wfParts: THREE.BufferGeometry[] = [];
    const weirMarbleParts: THREE.BufferGeometry[] = [];
    const sprayPositions: number[] = [];
    const sprayPhases: number[] = [];
    const spraySizes: number[] = [];

    for (let wi = 0; wi < waterfallAngles.length; wi++) {
      const a = waterfallAngles[wi];
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const tangX = -sinA;
      const tangZ = cosA;
      const rimR = 41.2;
      const topX = cosA * rimR;
      const topZ = sinA * rimR;
      const topY = getParadiseHeight(topX, topZ);

      // Low garden-side stone threshold piers flanking the recessed natural limestone weir channel
      for (const side of [-1, 1]) {
        const pierX = cosA * 34.8 + tangX * side * 2.55;
        const pierZ = sinA * 34.8 + tangZ * side * 2.55;
        const pierY = getParadiseHeight(pierX, pierZ);
        const pier = applyBoxPlanarUVs(new THREE.BoxGeometry(0.62, 0.95, 0.62), 0.50);
        pier.rotateY(-a);
        pier.translate(pierX, pierY + 0.24, pierZ);
        weirMarbleParts.push(normalizeForMerge(pier));

        const pierCap = applyBoxPlanarUVs(new THREE.BoxGeometry(0.76, 0.12, 0.76), 0.50);
        pierCap.rotateY(-a);
        pierCap.translate(pierX, pierY + 0.76, pierZ);
        weirMarbleParts.push(normalizeForMerge(pierCap));
      }

      // Recessed natural spring head sheet descending gently through the limestone weir channel
      const upperSheet = new THREE.PlaneGeometry(4.2, 6.2, 10, 14);
      const uPos = upperSheet.attributes.position;
      const uUv = upperSheet.attributes.uv;
      for (let i = 0; i < uPos.count; i++) {
        const lx = uPos.getX(i);
        const ly = uPos.getY(i);
        const t = Math.max(0, Math.min(1, (ly + 3.1) / 6.2));
        const rHere = 35.1 + (1.0 - t) * 5.5;
        const gx = cosA * rHere + tangX * lx;
        const gz = sinA * rHere + tangZ * lx;
        const recess = (1.0 - t) * 0.24;
        const yHere = getParadiseHeight(gx, gz) + 0.03 - recess;
        uPos.setXYZ(i, gx, yHere, gz);
        if (uUv) uUv.setY(i, 0.72 + t * 0.28);
      }
      upperSheet.computeVertexNormals();
      wfParts.push(normalizeForMerge(upperSheet));

      // Split natural rock-tumbling cascade curtains plunging past the sculpted limestone lip boulders
      for (const cascadeLayer of [
        { width: 4.5, latOff: 0.0, rStart: 40.4, outMax: 2.3, drop: 14.8, yOff: -0.22 },
        { width: 2.6, latOff: 0.85, rStart: 40.7, outMax: 2.9, drop: 14.4, yOff: -0.45 }
      ]) {
        const ribbon = new THREE.PlaneGeometry(cascadeLayer.width, 15.4, 12, 24);
        const pos = ribbon.attributes.position;
        const rUv = ribbon.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const lx = pos.getX(i) + cascadeLayer.latOff;
          const ly = pos.getY(i);
          const vNorm = Math.max(0, Math.min(1, (ly + 7.7) / 15.4));
          const dropFrac = Math.max(0, Math.min(1, 1.0 - vNorm));
          const rockBump = Math.sin(dropFrac * Math.PI * 3.0 + lx * 0.9 + wi) * 0.24 * Math.sin(dropFrac * Math.PI);
          const outward = Math.pow(dropFrac, 1.22) * cascadeLayer.outMax + rockBump;
          const worldY = topY + cascadeLayer.yOff - dropFrac * cascadeLayer.drop;
          const rHere = cascadeLayer.rStart + outward;

          const wx = cosA * rHere + tangX * lx;
          const wz = sinA * rHere + tangZ * lx;
          pos.setXYZ(i, wx, worldY, wz);
          if (rUv) rUv.setY(i, vNorm * 0.72);
        }
        ribbon.computeVertexNormals();
        wfParts.push(normalizeForMerge(ribbon));
      }

      const plungeR = rimR + 2.0;
      const px = cosA * plungeR;
      const pz = sinA * plungeR;
      for (let s = 0; s < 34; s++) {
        const j1 = pseudoRand(wi * 100 + s * 3.1) - 0.5;
        const j2 = pseudoRand(wi * 100 + s * 7.3) - 0.5;
        sprayPositions.push(px + j1 * 4.8, -12.4 + j2 * 1.3, pz + j2 * 4.8);
        sprayPhases.push(pseudoRand(wi * 50 + s * 11.7));
        spraySizes.push(2.6 + pseudoRand(s * 5.9) * 3.2);
      }
      // Foamy mist spray billowing over the stepped limestone weir lip boulders & mid-cliff ledges
      for (let s = 0; s < 24; s++) {
        const j1 = pseudoRand(wi * 200 + s * 4.3) - 0.5;
        const j2 = pseudoRand(wi * 200 + s * 9.1) - 0.5;
        const ledgeDrop = s < 14 ? -0.9 + j2 * 0.6 : -4.2 + j2 * 1.4;
        const outShift = s < 14 ? 0.3 : 1.1;
        sprayPositions.push(
          topX + cosA * outShift + tangX * j1 * 4.0,
          topY + ledgeDrop,
          topZ + sinA * outShift + tangZ * j1 * 4.0
        );
        sprayPhases.push(pseudoRand(wi * 77 + s * 6.3));
        spraySizes.push(2.0 + pseudoRand(s * 4.1) * 2.2);
      }
    }

    // Cascading silver-aqua waterfalls plunging from the Floating Sanctuary Islets into the Cloud Sea
    for (let ii = 0; ii < this.isletConfigs.length; ii++) {
      const cfg = this.isletConfigs[ii];
      const toCenterAng = Math.atan2(-cfg.z, -cfg.x);
      const cosA = Math.cos(toCenterAng);
      const sinA = Math.sin(toCenterAng);
      const tangX = -sinA;
      const tangZ = cosA;
      const rimX = cfg.x + cosA * (cfg.r * 0.88);
      const rimZ = cfg.z + sinA * (cfg.r * 0.88);
      const topY = cfg.y - 0.05;
      const dropH = topY + 13.0;

      const iRibbon = new THREE.PlaneGeometry(2.4, dropH, 8, 16);
      const iPos = iRibbon.attributes.position;
      const iUv = iRibbon.attributes.uv;
      for (let k = 0; k < iPos.count; k++) {
        const lx = iPos.getX(k);
        const ly = iPos.getY(k);
        const vNorm = Math.max(0, Math.min(1, (ly + dropH * 0.5) / dropH));
        const dropFrac = 1.0 - vNorm;
        const out = Math.pow(dropFrac, 1.2) * 1.8;
        const wx = rimX + cosA * out + tangX * lx;
        const wz = rimZ + sinA * out + tangZ * lx;
        const wy = topY - dropFrac * dropH;
        iPos.setXYZ(k, wx, wy, wz);
        if (iUv) iUv.setY(k, vNorm * 0.72);
      }
      iRibbon.computeVertexNormals();
      wfParts.push(normalizeForMerge(iRibbon));

      for (let s = 0; s < 10; s++) {
        const j1 = pseudoRand(ii * 300 + s * 5.1) - 0.5;
        const j2 = pseudoRand(ii * 300 + s * 8.7) - 0.5;
        sprayPositions.push(rimX + cosA * 1.5 + j1 * 2.8, -12.2 + j2 * 1.0, rimZ + sinA * 1.5 + j2 * 2.8);
        sprayPhases.push(pseudoRand(ii * 91 + s * 7.3));
        spraySizes.push(2.0 + pseudoRand(s * 3.7) * 2.2);
      }
    }

    if (this.carraraMarbleMaterial && weirMarbleParts.length > 0) {
      const weirsMesh = new THREE.Mesh(mergeNormalizedParts(weirMarbleParts), this.carraraMarbleMaterial);
      weirsMesh.name = 'WaterfallMarbleWeirs';
      weirsMesh.castShadow = true;
      weirsMesh.receiveShadow = true;
      this.scene.add(weirsMesh);
    } else {
      for (const wp of weirMarbleParts) wp.dispose();
    }

    this.waterfallMaterial = createParadiseWaterfallMaterial({
      sunDirection: this.currentConfig!.lighting.directional.position
    });
    const wfMesh = new THREE.Mesh(mergeNormalizedParts(wfParts), this.waterfallMaterial);
    wfMesh.name = 'HeavenlyWaterfalls';
    this.scene.add(wfMesh);

    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.Float32BufferAttribute(sprayPositions, 3));
    sprayGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(sprayPhases, 1));
    sprayGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(spraySizes, 1));

    this.sprayMaterial = createWaterfallSprayMaterial();
    const sprayPoints = new THREE.Points(sprayGeo, this.sprayMaterial);
    sprayPoints.name = 'WaterfallSprayMist';
    this.scene.add(sprayPoints);

    // Swirling Frothy Plunge Mist Pools where waterfalls meet the cloud sea & weir lips
    const mistPoolParts: THREE.BufferGeometry[] = [];
    for (let wi = 0; wi < waterfallAngles.length; wi++) {
      const a = waterfallAngles[wi];
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const plungeR = 43.2;
      const poolDisc = new THREE.CircleGeometry(6.4, 28);
      poolDisc.rotateX(-Math.PI / 2);
      poolDisc.translate(cosA * plungeR, -11.2, sinA * plungeR);
      mistPoolParts.push(normalizeForMerge(poolDisc));

      const crestMist = new THREE.CircleGeometry(3.2, 20);
      crestMist.rotateX(-Math.PI / 2);
      const lipY = getParadiseHeight(cosA * 41.0, sinA * 41.0);
      crestMist.translate(cosA * 41.2, lipY - 0.65, sinA * 41.2);
      mistPoolParts.push(normalizeForMerge(crestMist));
    }
    for (let ii = 0; ii < this.isletConfigs.length; ii++) {
      const cfg = this.isletConfigs[ii];
      const toCenterAng = Math.atan2(-cfg.z, -cfg.x);
      const cosA = Math.cos(toCenterAng);
      const sinA = Math.sin(toCenterAng);
      const rimX = cfg.x + cosA * (cfg.r * 0.88 + 1.6);
      const rimZ = cfg.z + sinA * (cfg.r * 0.88 + 1.6);
      const iPool = new THREE.CircleGeometry(3.8, 20);
      iPool.rotateX(-Math.PI / 2);
      iPool.translate(rimX, -11.3, rimZ);
      mistPoolParts.push(normalizeForMerge(iPool));
    }
    if (mistPoolParts.length > 0) {
      this.mistPoolMaterial = createWaterfallMistPoolMaterial();
      const mistPoolsMesh = new THREE.Mesh(mergeNormalizedParts(mistPoolParts), this.mistPoolMaterial);
      mistPoolsMesh.name = 'WaterfallMistPools';
      this.scene.add(mistPoolsMesh);
    }
  }

  private createCrossedBlossomCardGeometry(size = 1.15): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const rotations = [0, Math.PI / 3, (2 * Math.PI) / 3];
    for (let k = 0; k < rotations.length; k++) {
      const plane = new THREE.PlaneGeometry(size, size, 2, 2);
      // Slight botanical cup curvature so blossom sprays catch sunlight from all angles
      const pos = plane.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const bow = (px * px + py * py) * 0.14;
        pos.setZ(i, -bow + (k === 1 ? 0.04 : 0));
      }
      plane.computeVertexNormals();
      plane.rotateX((k - 1) * 0.24);
      plane.rotateY(rotations[k]);
      parts.push(normalizeForMerge(plane));
    }
    return mergeNormalizedParts(parts);
  }

  private buildSacredBlossomTrees(sakuraBarkPbr: PbrTextureSet, sakuraAtlas: THREE.Texture): void {
    // 1. Sculpted Silver-Cherry Trunk + Flared Buttresses + Multi-Tier Forked Branching Limbs
    const trunkParts: THREE.BufferGeometry[] = [];
    const mainTrunkPts = [
      new THREE.Vector3(0, -0.15, 0),
      new THREE.Vector3(0.14, 1.35, 0.08),
      new THREE.Vector3(-0.08, 2.85, -0.06),
      new THREE.Vector3(0.06, 4.15, 0.10)
    ];
    const trunkCurve = new THREE.CatmullRomCurve3(mainTrunkPts);
    trunkParts.push(normalizeForMerge(createTaperedBranchGeometry(trunkCurve, 0.30, 0.14, 12, 10, 1.6, 2.2)));

    // 4 gnarled root buttresses anchoring into the mossy turf
    for (let r = 0; r < 4; r++) {
      const ang = (r / 4) * Math.PI * 2 + 0.45;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ca * 0.14, 0.72, sa * 0.14),
        new THREE.Vector3(ca * 0.36, 0.22, sa * 0.36),
        new THREE.Vector3(ca * 0.58, -0.08, sa * 0.58)
      ]);
      trunkParts.push(normalizeForMerge(createTaperedBranchGeometry(rootCurve, 0.12, 0.04, 5, 6, 1.0, 1.0)));
    }

    // Primary spreading limbs anchored cleanly inside trunk centerline + forked secondary boughs + blossom anchor points
    const trunkAnchor = (t: number) => trunkCurve.getPointAt(t);
    const primaryDefs: Array<{ pts: THREE.Vector3[]; r0: number; r1: number }> = [
      {
        pts: [trunkAnchor(0.62), new THREE.Vector3(1.15, 3.85, 0.55), new THREE.Vector3(1.95, 4.72, 0.98)],
        r0: 0.11,
        r1: 0.052
      },
      {
        pts: [trunkAnchor(0.68), new THREE.Vector3(-1.25, 3.95, 0.35), new THREE.Vector3(-2.08, 4.76, 0.65)],
        r0: 0.11,
        r1: 0.052
      },
      {
        pts: [trunkAnchor(0.75), new THREE.Vector3(0.35, 4.25, -1.25), new THREE.Vector3(0.68, 4.95, -2.02)],
        r0: 0.105,
        r1: 0.048
      },
      {
        pts: [trunkAnchor(0.84), new THREE.Vector3(-0.45, 4.75, -0.95), new THREE.Vector3(-0.88, 5.52, -1.42)],
        r0: 0.10,
        r1: 0.044
      },
      {
        pts: [trunkAnchor(0.82), new THREE.Vector3(0.28, 4.45, 1.08), new THREE.Vector3(0.42, 5.05, 1.72)],
        r0: 0.10,
        r1: 0.044
      },
      {
        pts: [trunkAnchor(0.94), new THREE.Vector3(0.02, 5.10, 0.04), new THREE.Vector3(0.08, 5.85, -0.10)],
        r0: 0.095,
        r1: 0.04
      }
    ];

    const boughAnchors: Array<{ x: number; y: number; z: number; radius: number }> = [];

    for (let bi = 0; bi < primaryDefs.length; bi++) {
      const def = primaryDefs[bi];
      const pCurve = new THREE.CatmullRomCurve3(def.pts);
      trunkParts.push(normalizeForMerge(createTaperedBranchGeometry(pCurve, def.r0, def.r1, 8, 7, 1.2, 1.5)));

      const mid = def.pts[1];
      const tip = def.pts[2];
      boughAnchors.push({ x: tip.x, y: tip.y + 0.18, z: tip.z, radius: 1.28 });
      boughAnchors.push({ x: mid.x, y: mid.y + 0.25, z: mid.z, radius: 1.05 });

      // 2 secondary forked limbs + fine tertiary inner cherry twigs per primary limb
      for (let f = 0; f < 2; f++) {
        const ang = bi * 1.45 + (f === 0 ? -0.75 : 0.85);
        const startPt = f === 0 ? mid.clone().lerp(tip, 0.45) : tip.clone();
        const subTip = new THREE.Vector3(
          startPt.x + Math.cos(ang) * 0.96,
          startPt.y + 0.50 + f * 0.22,
          startPt.z + Math.sin(ang) * 0.96
        );
        const subMid = startPt.clone().lerp(subTip, 0.5).add(new THREE.Vector3(0, 0.14, 0));
        const subCurve = new THREE.CatmullRomCurve3([startPt, subMid, subTip]);
        trunkParts.push(normalizeForMerge(createTaperedBranchGeometry(subCurve, def.r1 * 0.84, 0.022, 5, 5, 0.8, 1.0)));
        boughAnchors.push({ x: subTip.x, y: subTip.y + 0.10, z: subTip.z, radius: 1.02 });

        // Fine tertiary cherry twigs fanning inside the blossom spray
        for (let tw = 0; tw < 2; tw++) {
          const twAng = ang + (tw === 0 ? -0.68 : 0.72);
          const twOrigin = subMid.clone().lerp(subTip, 0.5 + tw * 0.35);
          const twEnd = new THREE.Vector3(
            twOrigin.x + Math.cos(twAng) * 0.62,
            twOrigin.y + 0.26 + tw * 0.12,
            twOrigin.z + Math.sin(twAng) * 0.62
          );
          const twMid = twOrigin.clone().lerp(twEnd, 0.5).add(new THREE.Vector3(0, 0.08, 0));
          const twCurve = new THREE.CatmullRomCurve3([twOrigin, twMid, twEnd]);
          trunkParts.push(normalizeForMerge(createTaperedBranchGeometry(twCurve, 0.024, 0.009, 4, 4, 0.6, 0.8)));
          boughAnchors.push({ x: twEnd.x, y: twEnd.y + 0.05, z: twEnd.z, radius: 0.78 });
        }
      }
    }

    const trunkGeo = mergeNormalizedParts(trunkParts);

    const windSpeed = this.currentConfig!.wind.speed;
    const windStrength = this.currentConfig!.wind.swayIntensity;
    const sunDir = new THREE.Vector3(...this.currentConfig!.lighting.directional.position).normalize();

    const barkRes = createSakuraBarkMaterial(sakuraBarkPbr, windSpeed, windStrength);
    this.sakuraBarkMaterial = barkRes.material;
    this.sakuraBarkUniforms = barkRes.uniforms;

    const foliageRes = createSakuraFoliageCardMaterial(sakuraAtlas, sunDir, windSpeed, windStrength);
    this.sakuraFoliageMaterial = foliageRes.material;
    this.sakuraFoliageUniforms = foliageRes.uniforms;
    this.extraMaterials.push(foliageRes.depthMaterial);

    const treePlacements: Array<[number, number, number]> = [
      [-15.5, -14.0, 1.15],
      [-23.5, -8.5, 1.02],
      [-28.0, 1.0, 1.18],
      [-26.5, 13.5, 1.08],
      [-18.0, 14.5, 0.95],
      [-21.5, 21.5, 1.12],
      [-9.5, 29.5, 1.0],
      [15.5, -14.5, 1.14],
      [21.0, -23.0, 1.05],
      [25.0, -5.0, 1.08],
      [28.5, 5.5, 1.16],
      [22.5, 15.5, 1.02],
      [14.5, 22.5, 0.96],
      [9.5, 29.5, 1.04],
      [-11.0, -28.0, 1.12],
      [11.5, -28.5, 1.10],
      [-27.5, -20.5, 1.06],
      [29.5, -24.5, 1.02],
      [-31.5, 7.5, 0.98],
      [18.0, 27.5, 1.08],
      // Walkable East & West Outer Celestial Terrace Sakura Trees
      [53.5, -4.5, 1.05],
      [52.8, -16.2, 1.02],
      [-53.5, -4.5, 1.06],
      [-52.8, -16.2, 1.02],
      // Far East & Far West Cherry-Blossom Sanctuaries (±84, -10)
      [78.0, -2.5, 1.18],
      [89.5, -3.0, 1.12],
      [91.0, -17.5, 1.16],
      [78.5, -18.5, 1.08],
      [-78.0, -2.5, 1.18],
      [-89.5, -3.0, 1.12],
      [-91.0, -17.5, 1.16],
      [-78.5, -18.5, 1.08],
      // South Sky-Harbor & North Celestial Lotus Sanctuaries
      [-9.8, 71.5, 1.12],
      [10.2, 72.0, 1.14],
      [-7.5, 84.5, 1.06],
      [8.0, 84.0, 1.08],
      [-9.2, -73.0, 1.12],
      [9.4, -73.5, 1.10],
      [0.0, -86.5, 1.16]
    ];

    const trunksMesh = new THREE.InstancedMesh(trunkGeo, this.sakuraBarkMaterial, treePlacements.length);
    trunksMesh.name = 'SacredBlossomTrunks';
    trunksMesh.castShadow = true;
    trunksMesh.receiveShadow = true;

    const cardsPerTree = 210;
    const totalCards = treePlacements.length * cardsPerTree;
    const cardGeo = this.createCrossedBlossomCardGeometry(0.90);
    const cardsMesh = new THREE.InstancedMesh(cardGeo, this.sakuraFoliageMaterial, totalCards);
    cardsMesh.name = 'SacredBlossomCanopyCards';
    cardsMesh.castShadow = true;
    cardsMesh.receiveShadow = true;
    cardsMesh.customDepthMaterial = foliageRes.depthMaterial;

    const sunlitBlossomTints = [
      new THREE.Color('#fff5f8'),
      new THREE.Color('#ffe8f0'),
      new THREE.Color('#ffead6'),
      new THREE.Color('#ffdce8')
    ];
    const blushBlossomTints = [
      new THREE.Color('#ffb8d2'),
      new THREE.Color('#f49cbe'),
      new THREE.Color('#f8c2da'),
      new THREE.Color('#e888ae')
    ];

    const localVec = new THREE.Vector3();
    const treeQuat = new THREE.Quaternion();
    const cardQuat = new THREE.Quaternion();
    const cardCol = new THREE.Color();
    const blushTmp = new THREE.Color();
    let cardIdx = 0;

    for (let i = 0; i < treePlacements.length; i++) {
      const [tx, tz, scale] = treePlacements[i];
      const ty = getParadiseHeight(tx, tz) - 0.12;
      const yaw = pseudoRand(i * 7.3) * Math.PI * 2;

      this.tmpPos.set(tx, ty, tz);
      this.tmpEuler.set(0, yaw, 0);
      treeQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.set(scale, scale, scale);
      this.tmpMatrix.compose(this.tmpPos, treeQuat, this.tmpScale);
      trunksMesh.setMatrixAt(i, this.tmpMatrix);

      for (let c = 0; c < cardsPerTree; c++) {
        const anchor = boughAnchors[c % boughAnchors.length];
        const r1 = pseudoRand(i * 317 + c * 3.1 + 1.0);
        const r2 = pseudoRand(i * 317 + c * 7.7 + 2.0);
        const r3 = pseudoRand(i * 317 + c * 11.3 + 3.0);

        const phi = r1 * Math.PI * 2;
        const cosTheta = r2 * 2.0 - 1.0;
        const sinTheta = Math.sqrt(Math.max(0, 1.0 - cosTheta * cosTheta));
        // Flattened horizontal bough pads with clear vertical sky gaps exposing interior cherry limbs
        const rad = Math.pow(r3, 0.65) * anchor.radius * 0.88;
        const tierStep = ((c % 3) - 1) * 0.24;

        const lx = anchor.x + Math.cos(phi) * sinTheta * rad * 1.12;
        const ly = anchor.y + tierStep + cosTheta * rad * 0.28;
        const lz = anchor.z + Math.sin(phi) * sinTheta * rad * 1.12;

        localVec.set(lx, ly, lz);
        localVec.multiplyScalar(scale).applyQuaternion(treeQuat).add(this.tmpPos);

        this.tmpEuler.set((r1 - 0.5) * 0.58, r2 * Math.PI * 2, (r3 - 0.5) * 0.58);
        cardQuat.setFromEuler(this.tmpEuler);
        const cs = (0.62 + r1 * 0.48) * scale;
        this.tmpScale.set(cs, cs, cs);
        this.tmpMatrix.compose(localVec, cardQuat, this.tmpScale);
        cardsMesh.setMatrixAt(cardIdx, this.tmpMatrix);

        // Multi-toned sunlit crown (warm ivory-cream/peach) vs shaded inner blush-rose blossoms
        const crownHeightT = Math.max(0, Math.min(1, (ly - 3.6) / 2.6));
        const outerRadT = Math.max(0, Math.min(1, r3));
        const sunMix = Math.max(0, Math.min(1, crownHeightT * 0.65 + outerRadT * 0.35));

        const sunlitCol = sunlitBlossomTints[(i + c) % sunlitBlossomTints.length];
        const blushCol = blushBlossomTints[(i * 3 + c) % blushBlossomTints.length];
        blushTmp.copy(blushCol);
        cardCol.copy(blushTmp).lerp(sunlitCol, sunMix);
        const shade = 0.84 + sunMix * 0.20 + r2 * 0.08;
        cardCol.multiplyScalar(shade);
        cardsMesh.setColorAt(cardIdx, cardCol);
        cardIdx++;
      }
    }

    trunksMesh.instanceMatrix.needsUpdate = true;
    cardsMesh.instanceMatrix.needsUpdate = true;
    if (cardsMesh.instanceColor) cardsMesh.instanceColor.needsUpdate = true;

    this.scene.add(trunksMesh);
    this.scene.add(cardsMesh);
  }

  private buildGardenGrass(): void {
    // Dense 4-blade radiating grass tufts across main island + outer sky sanctuaries + satellite islets
    const mainCount = 24000;
    const outerIslandGrassCount = 13500;
    const isletGrassCount = 2200;
    const totalCount = mainCount + outerIslandGrassCount + isletGrassCount;

    const tPos: number[] = [];
    const tNorm: number[] = [];
    const tUv: number[] = [];
    const tIdx: number[] = [];

    const bladesPerTuft = 4;
    for (let b = 0; b < bladesPerTuft; b++) {
      const ang = (b / bladesPerTuft) * Math.PI * 2 + (b % 2) * 0.32;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const radOff = 0.024 + (b % 2) * 0.014;
      const H = 0.34 + ((b * 0.37) % 1.0) * 0.28;
      const lean = 0.08 + ((b * 0.53) % 1.0) * 0.08;
      const W0 = 0.036;
      const W1 = 0.024;
      const W2 = 0.010;

      const baseV = b * 7;
      const pushV = (lx: number, ly: number, lz: number, u: number, v: number) => {
        const wx = lx * ca - (lz + radOff) * sa + ca * 0.01;
        const wz = lx * sa + (lz + radOff) * ca + sa * 0.01;
        tPos.push(wx, ly, wz);
        const ny = 0.32 + v * 0.48;
        const nLen = Math.hypot(sa, ny, ca) || 1;
        tNorm.push(-sa / nLen, ny / nLen, ca / nLen);
        tUv.push(u, v);
      };

      pushV(-W0 * 0.5, 0.0, 0.0, 0.0, 0.0);
      pushV(W0 * 0.5, 0.0, 0.0, 1.0, 0.0);
      pushV(-W1 * 0.5, 0.36 * H, lean * 0.24, 0.08, 0.36);
      pushV(W1 * 0.5, 0.36 * H, lean * 0.24, 0.92, 0.36);
      pushV(-W2 * 0.5, 0.72 * H, lean * 0.64, 0.20, 0.72);
      pushV(W2 * 0.5, 0.72 * H, lean * 0.64, 0.80, 0.72);
      pushV(0.0, H, lean, 0.50, 1.0);

      tIdx.push(
        baseV, baseV + 1, baseV + 3,
        baseV, baseV + 3, baseV + 2,
        baseV + 2, baseV + 3, baseV + 5,
        baseV + 2, baseV + 5, baseV + 4,
        baseV + 4, baseV + 5, baseV + 6
      );
    }

    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    bladeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(tNorm, 3));
    bladeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
    bladeGeo.setIndex(tIdx);

    this.grassMaterial = createGrassSwayMaterial({
      windSpeed: this.currentConfig!.wind.speed,
      windDirection: [this.currentConfig!.wind.direction[0], this.currentConfig!.wind.direction[2]],
      windStrength: this.currentConfig!.wind.swayIntensity,
      gustiness: this.currentConfig!.wind.gustiness,
      baseColor: '#256144',
      tipColor: '#98e296',
      sunDirection: this.currentConfig!.lighting.directional.position
    });

    const grassMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, totalCount);
    grassMesh.name = 'ParadiseGardenGrass';

    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3();
    const alignQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();
    const col = new THREE.Color();
    const goldenAngle = 2.399963229728653;

    let placed = 0;
    for (let i = 0; placed < mainCount && i < mainCount * 3.5; i++) {
      const j1 = pseudoRand(i * 1.13 + 0.7);
      const j2 = pseudoRand(i * 2.71 + 1.9);
      const r = 10.6 + Math.pow(pseudoRand(i * 4.37 + 0.3), 0.68) * 32.6;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.4;
      const x = r * Math.cos(theta) + (j1 - 0.5) * 0.7;
      const z = r * Math.sin(theta) + (j2 - 0.5) * 0.7;

      if (!isGardenTurfZone(x, z)) continue;

      const y = getParadiseHeight(x, z);
      this.tmpPos.set(x, y, z);
      getParadiseNormal(x, z, normal);
      alignQuat.setFromUnitVectors(up, normal);
      yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
      this.tmpQuat.multiplyQuaternions(yawQuat, alignQuat);

      const sy = 0.74 + j2 * 0.58;
      const sx = 0.85 + j1 * 0.28;
      this.tmpScale.set(sx, sy, sx);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      grassMesh.setMatrixAt(placed, this.tmpMatrix);

      if (placed % 5 === 0) {
        col.set('#d5e898');
      } else if (placed % 2 === 0) {
        col.set('#8fd8a2');
      } else {
        col.set('#6cb98a');
      }
      grassMesh.setColorAt(placed, col);
      placed++;
    }

    // Lush turf carpets across the 6 walkable outer sanctuary islands
    const outerTurfDiscs: Array<{ cx: number; cz: number; r: number; share: number }> = [
      { cx: 48, cz: -10, r: 10.4, share: 1300 },
      { cx: -48, cz: -10, r: 10.4, share: 1300 },
      { cx: 84, cz: -10, r: 15.4, share: 2700 },
      { cx: -84, cz: -10, r: 15.4, share: 2700 },
      { cx: 0, cz: 74, r: 16.4, share: 2900 },
      { cx: 0, cz: -76, r: 15.4, share: 2600 }
    ];
    for (let di = 0; di < outerTurfDiscs.length; di++) {
      const disc = outerTurfDiscs[di];
      let dPlaced = 0;
      for (let k = 0; dPlaced < disc.share && placed < totalCount && k < disc.share * 4; k++) {
        const j1 = pseudoRand((di * 4000 + k) * 1.41 + 0.3);
        const j2 = pseudoRand((di * 4000 + k) * 2.93 + 1.7);
        const rad = 4.8 + Math.sqrt(j1) * (disc.r - 4.8);
        const ang = k * goldenAngle + (j2 - 0.5) * 0.45;
        const x = disc.cx + Math.cos(ang) * rad;
        const z = disc.cz + Math.sin(ang) * rad;
        if (!isGardenTurfZone(x, z)) continue;
        const y = getParadiseHeight(x, z);
        this.tmpPos.set(x, y, z);
        getParadiseNormal(x, z, normal);
        alignQuat.setFromUnitVectors(up, normal);
        yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
        this.tmpQuat.multiplyQuaternions(yawQuat, alignQuat);
        const sy = 0.74 + j2 * 0.56;
        const sx = 0.85 + j1 * 0.28;
        this.tmpScale.set(sx, sy, sx);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        grassMesh.setMatrixAt(placed, this.tmpMatrix);
        col.set(placed % 5 === 0 ? '#d5e898' : placed % 2 === 0 ? '#8fd8a2' : '#6cb98a');
        grassMesh.setColorAt(placed, col);
        placed++;
        dPlaced++;
      }
    }

    // Lush grass tufts crowning the 5 floating satellite islets
    if (this.isletConfigs.length > 0) {
      const perIslet = Math.floor(isletGrassCount / this.isletConfigs.length);
      for (let ii = 0; ii < this.isletConfigs.length; ii++) {
        const cfg = this.isletConfigs[ii];
        const capRx = cfg.r * 0.92;
        const capH = cfg.r * 1.03 * 0.24;
        for (let k = 0; k < perIslet && placed < totalCount; k++) {
          const j1 = pseudoRand((ii * 500 + k) * 1.73 + 0.4);
          const j2 = pseudoRand((ii * 500 + k) * 3.19 + 1.1);
          const rad = Math.sqrt(j1) * capRx;
          const ang = k * goldenAngle + j2 * 0.5;
          const lx = Math.cos(ang) * rad;
          const lz = Math.sin(ang) * rad;
          const normR = Math.min(0.95, rad / (cfg.r * 1.03));
          const capY = cfg.y - 0.12 + capH * Math.sqrt(Math.max(0, 1.0 - normR * normR));

          this.tmpPos.set(cfg.x + lx, capY - 0.04, cfg.z + lz);
          this.tmpEuler.set(0, j1 * Math.PI * 2, 0);
          this.tmpQuat.setFromEuler(this.tmpEuler);
          const sy = 0.8 + j2 * 0.55;
          this.tmpScale.set(1.0, sy, 1.0);
          this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
          grassMesh.setMatrixAt(placed, this.tmpMatrix);
          col.set(k % 2 === 0 ? '#8fd8a2' : '#b8e496');
          grassMesh.setColorAt(placed, col);
          placed++;
        }
      }
    }

    grassMesh.count = placed;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    this.scene.add(grassMesh);

    // Stratum 2: Dense low-hugging Clover Micro-Turf (3-leaf clover rosettes & short micro-blades)
    const cloverCount = 20000;
    const innerCloverTarget = 13000;
    const cPos: number[] = [];
    const cNorm: number[] = [];
    const cUv: number[] = [];
    const cIdx: number[] = [];
    for (let leaf = 0; leaf < 3; leaf++) {
      const ang = (leaf / 3) * Math.PI * 2 + 0.25;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const tilt = 0.085;
      const hLeaf = 0.14 + (leaf % 2) * 0.04;
      const wBase = 0.042;
      const wMid = 0.068;
      const baseV = leaf * 5;
      const pushC = (lx: number, ly: number, lz: number, u: number, v: number) => {
        cPos.push(lx * ca - (lz + 0.015) * sa, ly, lx * sa + (lz + 0.015) * ca);
        const ny = 0.65 + v * 0.35;
        const nl = Math.hypot(sa * 0.4, ny, ca * 0.4) || 1;
        cNorm.push((-sa * 0.4) / nl, ny / nl, (ca * 0.4) / nl);
        cUv.push(u, v);
      };
      pushC(-wBase * 0.5, 0.0, 0.0, 0.2, 0.0);
      pushC(wBase * 0.5, 0.0, 0.0, 0.8, 0.0);
      pushC(-wMid * 0.5, hLeaf * 0.65, tilt * 0.5, 0.0, 0.65);
      pushC(wMid * 0.5, hLeaf * 0.65, tilt * 0.5, 1.0, 0.65);
      pushC(0.0, hLeaf, tilt, 0.5, 1.0);
      cIdx.push(baseV, baseV + 1, baseV + 3, baseV, baseV + 3, baseV + 2, baseV + 2, baseV + 3, baseV + 4);
    }
    const cloverGeo = new THREE.BufferGeometry();
    cloverGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
    cloverGeo.setAttribute('normal', new THREE.Float32BufferAttribute(cNorm, 3));
    cloverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cUv, 2));
    cloverGeo.setIndex(cIdx);

    this.cloverMaterial = createGrassSwayMaterial({
      windSpeed: this.currentConfig!.wind.speed,
      windDirection: [this.currentConfig!.wind.direction[0], this.currentConfig!.wind.direction[2]],
      windStrength: this.currentConfig!.wind.swayIntensity * 0.55,
      gustiness: this.currentConfig!.wind.gustiness,
      baseColor: '#1f5438',
      tipColor: '#76cc82',
      sunDirection: this.currentConfig!.lighting.directional.position
    });

    const cloverMesh = new THREE.InstancedMesh(cloverGeo, this.cloverMaterial, cloverCount);
    cloverMesh.name = 'ParadiseCloverMicroTurf';

    let cloverPlaced = 0;
    for (let i = 0; cloverPlaced < innerCloverTarget && i < innerCloverTarget * 3.5; i++) {
      const j1 = pseudoRand(i * 1.97 + 11.3);
      const j2 = pseudoRand(i * 3.61 + 4.7);
      const r = 10.0 + Math.pow(pseudoRand(i * 5.19 + 1.1), 0.68) * 33.0;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.55;
      const x = r * Math.cos(theta) + (j1 - 0.5) * 0.9;
      const z = r * Math.sin(theta) + (j2 - 0.5) * 0.9;

      if (!isGardenTurfZone(x, z)) continue;

      const y = getParadiseHeight(x, z);
      this.tmpPos.set(x, y, z);
      getParadiseNormal(x, z, normal);
      alignQuat.setFromUnitVectors(up, normal);
      yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
      this.tmpQuat.multiplyQuaternions(yawQuat, alignQuat);

      const s = 0.78 + j2 * 0.62;
      this.tmpScale.set(s * 1.15, s, s * 1.15);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      cloverMesh.setMatrixAt(cloverPlaced, this.tmpMatrix);

      if (cloverPlaced % 7 === 0) {
        col.set('#cce8a2');
      } else if (cloverPlaced % 3 === 0) {
        col.set('#7cd290');
      } else {
        col.set('#5eb478');
      }
      cloverMesh.setColorAt(cloverPlaced, col);
      cloverPlaced++;
    }

    for (let di = 0; di < outerTurfDiscs.length; di++) {
      const disc = outerTurfDiscs[di];
      const target = Math.floor(disc.share * 0.5);
      let dPlaced = 0;
      for (let k = 0; dPlaced < target && cloverPlaced < cloverCount && k < target * 4; k++) {
        const j1 = pseudoRand((di * 7000 + k) * 2.13 + 3.1);
        const j2 = pseudoRand((di * 7000 + k) * 4.17 + 0.9);
        const rad = 4.6 + Math.sqrt(j1) * (disc.r - 4.6);
        const ang = k * goldenAngle + (j2 - 0.5) * 0.5;
        const x = disc.cx + Math.cos(ang) * rad;
        const z = disc.cz + Math.sin(ang) * rad;
        if (!isGardenTurfZone(x, z)) continue;
        const y = getParadiseHeight(x, z);
        this.tmpPos.set(x, y, z);
        getParadiseNormal(x, z, normal);
        alignQuat.setFromUnitVectors(up, normal);
        yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
        this.tmpQuat.multiplyQuaternions(yawQuat, alignQuat);
        const s = 0.78 + j2 * 0.62;
        this.tmpScale.set(s * 1.15, s, s * 1.15);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        cloverMesh.setMatrixAt(cloverPlaced, this.tmpMatrix);
        col.set(cloverPlaced % 7 === 0 ? '#cce8a2' : cloverPlaced % 3 === 0 ? '#7cd290' : '#5eb478');
        cloverMesh.setColorAt(cloverPlaced, col);
        cloverPlaced++;
        dPlaced++;
      }
    }
    cloverMesh.count = cloverPlaced;
    cloverMesh.instanceMatrix.needsUpdate = true;
    if (cloverMesh.instanceColor) cloverMesh.instanceColor.needsUpdate = true;
    this.scene.add(cloverMesh);
  }

  private buildGardenFlowers(): void {
    const stem = new THREE.CylinderGeometry(0.015, 0.02, 0.36, 5);
    stem.translate(0, 0.18, 0);

    const posAttr = stem.attributes.position;
    const stemColors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      stemColors[i * 3] = 0.25;
      stemColors[i * 3 + 1] = 0.62;
      stemColors[i * 3 + 2] = 0.34;
    }
    stem.setAttribute('color', new THREE.BufferAttribute(stemColors, 3));

    const parts: THREE.BufferGeometry[] = [stem.toNonIndexed()];
    stem.dispose();

    const eye = new THREE.SphereGeometry(0.055, 8, 6);
    eye.scale(1, 0.55, 1);
    eye.translate(0, 0.37, 0);
    const eyeNI = eye.toNonIndexed();
    eye.dispose();
    const eyePos = eyeNI.attributes.position;
    const eyeCols = new Float32Array(eyePos.count * 3);
    const eyeUv = eyeNI.attributes.uv;
    for (let i = 0; i < eyePos.count; i++) {
      eyeCols[i * 3] = 1.0;
      eyeCols[i * 3 + 1] = 0.82;
      eyeCols[i * 3 + 2] = 0.28;
      if (eyeUv) eyeUv.setY(i, 0.96);
    }
    eyeNI.setAttribute('color', new THREE.BufferAttribute(eyeCols, 3));
    parts.push(eyeNI);

    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      const petal = new THREE.SphereGeometry(0.068, 6, 5);
      petal.scale(0.65, 0.24, 1.35);
      petal.translate(0, 0, 0.095);
      petal.rotateY(a);
      petal.translate(0, 0.37, 0);

      const pNI = petal.toNonIndexed();
      petal.dispose();
      const pPos = pNI.attributes.position;
      const pCols = new Float32Array(pPos.count * 3);
      const pUv = pNI.attributes.uv;
      for (let i = 0; i < pPos.count; i++) {
        pCols[i * 3] = 1.0;
        pCols[i * 3 + 1] = 1.0;
        pCols[i * 3 + 2] = 1.0;
        if (pUv) pUv.setY(i, 0.999);
      }
      pNI.setAttribute('color', new THREE.BufferAttribute(pCols, 3));
      parts.push(pNI);
    }

    const flowerGeo = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
    for (const part of parts) part.dispose();

    this.flowerMaterial = createWildflowerMaterial({
      windSpeed: this.currentConfig!.wind.speed,
      windDirection: [this.currentConfig!.wind.direction[0], this.currentConfig!.wind.direction[2]],
      windStrength: this.currentConfig!.wind.swayIntensity,
      gustiness: this.currentConfig!.wind.gustiness,
      sunDirection: this.currentConfig!.lighting.directional.position
    });

    const maxFlowers = 2400;
    const innerFlowers = 1400;
    const flowerMesh = new THREE.InstancedMesh(flowerGeo, this.flowerMaterial, maxFlowers);
    flowerMesh.name = 'ParadiseGardenFlowers';

    const palette = [
      new THREE.Color('#ffbfd6'),
      new THREE.Color('#fff5f0'),
      new THREE.Color('#ffe08a'),
      new THREE.Color('#cde6ff'),
      new THREE.Color('#e2c8ff')
    ];
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3();
    const alignQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();
    const goldenAngle = 2.399963229728653;

    let placed = 0;
    for (let i = 0; placed < innerFlowers && i < innerFlowers * 4; i++) {
      const j1 = pseudoRand(i * 3.37 + 5.1);
      const j2 = pseudoRand(i * 6.19 + 2.3);
      const r = 12.0 + Math.pow((i + j1) / (innerFlowers * 2.5), 0.72) * 24.2;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.5;
      const x = r * Math.cos(theta) + (j1 - 0.5) * 1.1;
      const z = r * Math.sin(theta) + (j2 - 0.5) * 1.1;

      if (!isGardenTurfZone(x, z)) continue;

      const y = getParadiseHeight(x, z);
      this.tmpPos.set(x, y, z);
      getParadiseNormal(x, z, normal);
      alignQuat.setFromUnitVectors(up, normal);
      yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
      this.tmpQuat.multiplyQuaternions(yawQuat, alignQuat);

      const s = 0.85 + j2 * 0.55;
      this.tmpScale.set(s, s, s);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      flowerMesh.setMatrixAt(placed, this.tmpMatrix);
      flowerMesh.setColorAt(placed, palette[placed % palette.length]);
      placed++;
    }

    const outerFlowerDiscs: Array<{ cx: number; cz: number; r: number; count: number }> = [
      { cx: 48, cz: -10, r: 9.8, count: 120 },
      { cx: -48, cz: -10, r: 9.8, count: 120 },
      { cx: 84, cz: -10, r: 15.0, count: 190 },
      { cx: -84, cz: -10, r: 15.0, count: 190 },
      { cx: 0, cz: 74, r: 15.8, count: 190 },
      { cx: 0, cz: -76, r: 15.0, count: 190 }
    ];
    for (let di = 0; di < outerFlowerDiscs.length; di++) {
      const fd = outerFlowerDiscs[di];
      let dPlaced = 0;
      for (let k = 0; dPlaced < fd.count && placed < maxFlowers && k < fd.count * 5; k++) {
        const j1 = pseudoRand((di * 1000 + k) * 3.11 + 1.3);
        const j2 = pseudoRand((di * 1000 + k) * 5.77 + 2.9);
        const rad = 5.0 + Math.sqrt(j1) * (fd.r - 5.0);
        const ang = k * goldenAngle + (j2 - 0.5) * 0.5;
        const x = fd.cx + Math.cos(ang) * rad;
        const z = fd.cz + Math.sin(ang) * rad;
        if (!isGardenTurfZone(x, z)) continue;
        const y = getParadiseHeight(x, z);
        this.tmpPos.set(x, y, z);
        getParadiseNormal(x, z, normal);
        alignQuat.setFromUnitVectors(up, normal);
        yawQuat.setFromAxisAngle(normal, j1 * Math.PI * 2);
        this.tmpQuat.multiplyQuaternions(yawQuat, alignQuat);
        const s = 0.85 + j2 * 0.55;
        this.tmpScale.set(s, s, s);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        flowerMesh.setMatrixAt(placed, this.tmpMatrix);
        flowerMesh.setColorAt(placed, palette[placed % palette.length]);
        placed++;
        dPlaced++;
      }
    }

    flowerMesh.count = placed;
    flowerMesh.instanceMatrix.needsUpdate = true;
    if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    this.scene.add(flowerMesh);
  }

  private buildBlossomPetalsAndMotes(): void {
    const petalCount = 1100;
    const pPos = new Float32Array(petalCount * 3);
    const pPhase = new Float32Array(petalCount);
    const pSize = new Float32Array(petalCount);
    const pCol = new Float32Array(petalCount * 3);

    const petalPalette = [
      new THREE.Color('#f9a8d4'),
      new THREE.Color('#fbcfe8'),
      new THREE.Color('#ffd6e5')
    ];

    for (let i = 0; i < petalCount; i++) {
      const r1 = pseudoRand(i * 4.13 + 1.0);
      const r2 = pseudoRand(i * 7.91 + 2.0);
      const r = 3.0 + Math.sqrt(r1) * 94.0;
      const theta = r2 * Math.PI * 2;
      pPos[i * 3] = Math.cos(theta) * r;
      pPos[i * 3 + 1] = 2.0;
      pPos[i * 3 + 2] = Math.sin(theta) * r;
      pPhase[i] = pseudoRand(i * 9.31) * 24.0;
      pSize[i] = 1.4 + pseudoRand(i * 3.77) * 1.4;

      const c = petalPalette[i % petalPalette.length];
      pCol[i * 3] = c.r;
      pCol[i * 3 + 1] = c.g;
      pCol[i * 3 + 2] = c.b;
    }

    const petalGeo = new THREE.BufferGeometry();
    petalGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    petalGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
    petalGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
    petalGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));

    this.petalsMaterial = createBlossomPetalsMaterial();
    this.petalsMaterial.uniforms.uWindSpeed.value = this.currentConfig!.wind.speed;
    const petalPoints = new THREE.Points(petalGeo, this.petalsMaterial);
    petalPoints.name = 'BlossomPetals';
    this.scene.add(petalPoints);

    // 3D Cupped Swirling Sakura Cherry Blossom Petals (InstancedMesh, delicate 0.10-0.16m soft pink petals)
    this.swirlingPetalsSystem = createLivingBoidsSystem({
      count: 420,
      boundsRadius: 42,
      minY: 1.2,
      maxY: 11.5,
      kind: 'petal',
      colorA: 0xf48fb1,
      colorB: 0xffd1e1
    });
    this.swirlingPetalsSystem.mesh.geometry.computeBoundingBox();
    const petalBox = this.swirlingPetalsSystem.mesh.geometry.boundingBox;
    if (petalBox) {
      const petalSize = new THREE.Vector3();
      petalBox.getSize(petalSize);
      const maxDim = Math.max(petalSize.x, petalSize.y, petalSize.z);
      if (maxDim > 0.001) {
        const targetScale = 0.125 / maxDim;
        this.swirlingPetalsSystem.mesh.geometry.scale(targetScale, targetScale, targetScale);
      }
    }
    this.swirlingPetalsSystem.mesh.name = 'SwirlingSakuraPetals';
    this.scene.add(this.swirlingPetalsSystem.mesh);

    const moteCount = 720;
    const mPos = new Float32Array(moteCount * 3);
    const mPhase = new Float32Array(moteCount);
    const mSize = new Float32Array(moteCount);

    for (let i = 0; i < moteCount; i++) {
      const r1 = pseudoRand(i * 5.27 + 8.0);
      const r2 = pseudoRand(i * 8.43 + 4.0);
      const r3 = pseudoRand(i * 2.91 + 3.0);
      const r = 2.5 + Math.sqrt(r1) * 92.0;
      const theta = r2 * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      mPos[i * 3] = x;
      mPos[i * 3 + 1] = getParadiseHeight(x, z) + 0.6 + r3 * 8.5;
      mPos[i * 3 + 2] = z;
      mPhase[i] = r3 * 16.0;
      mSize[i] = 1.1 + r1 * 1.5;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(mPhase, 1));
    moteGeo.setAttribute('aSize', new THREE.BufferAttribute(mSize, 1));

    this.motesMaterial = createGoldenLightMotesMaterial();
    const motePoints = new THREE.Points(moteGeo, this.motesMaterial);
    motePoints.name = 'GoldenLightMotes';
    this.scene.add(motePoints);
  }

  private buildSoaringWhiteDoves(): void {
    this.dovesSystem = createLivingBoidsSystem({
      count: 36,
      boundsRadius: 62,
      minY: 10.0,
      maxY: 25.0,
      kind: 'bird',
      colorA: 0xfbfcff,
      colorB: 0xdce4f2
    });
    this.dovesSystem.mesh.name = 'SoaringWhiteDoves';
    this.dovesSystem.update(0.016, 0.0, this.doveFocusCenter);
    this.scene.add(this.dovesSystem.mesh);
  }

  private updateLanterns(elapsedTime: number): void {
    if (!this.lanternOrbsMesh || this.lanternTransforms.length === 0) return;
    const swayAmt = (this.currentConfig?.wind?.swayIntensity ?? 0.55) * 0.12;

    for (let i = 0; i < this.lanternTransforms.length; i++) {
      const lt = this.lanternTransforms[i];
      const isSuspended = i < 4;
      const dx = isSuspended ? Math.sin(elapsedTime * 1.4 + lt.phase) * swayAmt : 0;
      const dz = isSuspended ? Math.cos(elapsedTime * 1.1 + lt.phase) * swayAmt * 0.7 : 0;
      this.tmpPos.set(lt.x + dx, lt.y, lt.z + dz);
      this.tmpQuat.identity();
      this.tmpScale.set(1, 1, 1);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.lanternOrbsMesh.setMatrixAt(i, this.tmpMatrix);
    }
    this.lanternOrbsMesh.instanceMatrix.needsUpdate = true;
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = deltaTime;
    this.lastElapsedTime = elapsedTime;

    if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = elapsedTime;
    for (const mat of this.rainbowMaterials) mat.uniforms.uTime.value = elapsedTime;
    if (this.godRayMaterial) this.godRayMaterial.uniforms.uTime.value = elapsedTime;
    if (this.cloudSeaMaterial) this.cloudSeaMaterial.uniforms.uTime.value = elapsedTime;
    if (this.cloudBillowMaterial) this.cloudBillowMaterial.uniforms.uTime.value = elapsedTime;
    if (this.groundUniforms) this.groundUniforms.uTime.value = elapsedTime;
    if (this.medallionMaterial) this.medallionMaterial.uniforms.uTime.value = elapsedTime;
    if (this.lanternOrbMaterial) this.lanternOrbMaterial.uniforms.uTime.value = elapsedTime;
    if (this.waterMaterial) this.waterMaterial.uniforms.uTime.value = elapsedTime;
    if (this.waterfallMaterial) this.waterfallMaterial.uniforms.uTime.value = elapsedTime;
    if (this.sprayMaterial) this.sprayMaterial.uniforms.uTime.value = elapsedTime;
    if (this.mistPoolMaterial) this.mistPoolMaterial.uniforms.uTime.value = elapsedTime;
    if (this.hangingVineMaterial) this.hangingVineMaterial.uniforms.uTime.value = elapsedTime;
    if (this.floatingWaterPetalsMaterial) this.floatingWaterPetalsMaterial.uniforms.uTime.value = elapsedTime;
    if (this.sakuraBarkUniforms) this.sakuraBarkUniforms.uTime.value = elapsedTime;
    if (this.sakuraFoliageUniforms) this.sakuraFoliageUniforms.uTime.value = elapsedTime;
    if (this.grassMaterial) this.grassMaterial.uniforms.uTime.value = elapsedTime;
    if (this.cloverMaterial) this.cloverMaterial.uniforms.uTime.value = elapsedTime;
    if (this.flowerMaterial) this.flowerMaterial.uniforms.uTime.value = elapsedTime;
    if (this.petalsMaterial) this.petalsMaterial.uniforms.uTime.value = elapsedTime;
    if (this.motesMaterial) this.motesMaterial.uniforms.uTime.value = elapsedTime;

    if (this.volumetricCloudDome) {
      const sunDir = this.directionalLight
        ? this.tmpPos.copy(this.directionalLight.position).normalize()
        : undefined;
      const fogCol =
        this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.color : undefined;
      this.volumetricCloudDome.update(elapsedTime, sunDir, fogCol);
    }
    this.dovesSystem?.update(deltaTime, elapsedTime, this.doveFocusCenter);
    this.swirlingPetalsSystem?.update(deltaTime, elapsedTime, this.petalFocusCenter);
    this.weatherSystem?.update(deltaTime, elapsedTime, this.weatherFocusCenter);

    this.updateLanterns(elapsedTime);
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

  public setAudioEnergy(bass: number, _mid: number, treble: number): void {
    if (!this.isInitialized) return;
    if (this.skyMaterial?.uniforms?.uBassEnergy) {
      this.skyMaterial.uniforms.uBassEnergy.value = bass;
    }
    if (this.medallionMaterial?.uniforms?.uRadiance) {
      this.medallionMaterial.uniforms.uRadiance.value = 1.0 + bass * 0.35;
    }
    if (this.motesMaterial?.uniforms?.uRadiance) {
      this.motesMaterial.uniforms.uRadiance.value = 1.0 + treble * 0.45;
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
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
      }
      if (typeof newConfig.fog.density === 'number' && Number.isFinite(newConfig.fog.density) && newConfig.fog.density >= 0) {
        this.scene.fog.density = newConfig.fog.density;
        if (this.currentConfig?.fog) this.currentConfig.fog.density = newConfig.fog.density;
      }
    }

    if (newConfig.sky) {
      if (newConfig.sky.topColor && typeof newConfig.sky.topColor === 'string') {
        this.skyMaterial?.uniforms.uTopColor.value.set(newConfig.sky.topColor);
        this.waterMaterial?.uniforms.uSkyTopColor.value.set(newConfig.sky.topColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
      }
      if (newConfig.sky.bottomColor && typeof newConfig.sky.bottomColor === 'string') {
        this.skyMaterial?.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
      }
      if (newConfig.sky.horizonColor && typeof newConfig.sky.horizonColor === 'string') {
        this.skyMaterial?.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        this.cloudSeaMaterial?.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        this.cloudBillowMaterial?.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        this.waterMaterial?.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
      }
      if (typeof newConfig.sky.swirlSpeed === 'number' && Number.isFinite(newConfig.sky.swirlSpeed)) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uSwirlSpeed.value = newConfig.sky.swirlSpeed;
        for (const mat of this.rainbowMaterials) mat.uniforms.uSwirlSpeed.value = newConfig.sky.swirlSpeed;
        if (this.currentConfig?.sky) this.currentConfig.sky.swirlSpeed = newConfig.sky.swirlSpeed;
      }
      if (typeof newConfig.sky.cloudSpeed === 'number' && Number.isFinite(newConfig.sky.cloudSpeed)) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        if (this.cloudSeaMaterial) this.cloudSeaMaterial.uniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        if (this.cloudBillowMaterial) this.cloudBillowMaterial.uniforms.uCloudSpeed.value = newConfig.sky.cloudSpeed;
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudSpeed = newConfig.sky.cloudSpeed;
      }
      if (typeof newConfig.sky.moonGlow === 'number' && Number.isFinite(newConfig.sky.moonGlow)) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uSunGlow.value = newConfig.sky.moonGlow;
        if (this.godRayMaterial) this.godRayMaterial.uniforms.uRadiance.value = newConfig.sky.moonGlow;
        if (this.lanternOrbMaterial) this.lanternOrbMaterial.uniforms.uRadiance.value = newConfig.sky.moonGlow;
        for (const mat of this.rainbowMaterials) mat.uniforms.uRadiance.value = newConfig.sky.moonGlow;
        if (this.currentConfig?.sky) this.currentConfig.sky.moonGlow = newConfig.sky.moonGlow;
      }
    }

    if (newConfig.wind) {
      if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.cloverMaterial) this.cloverMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.flowerMaterial) this.flowerMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.sakuraBarkUniforms) this.sakuraBarkUniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.sakuraFoliageUniforms) this.sakuraFoliageUniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.hangingVineMaterial) this.hangingVineMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.petalsMaterial) this.petalsMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.currentConfig?.wind) this.currentConfig.wind.speed = newConfig.wind.speed;
      }
      if (typeof newConfig.wind.swayIntensity === 'number' && Number.isFinite(newConfig.wind.swayIntensity)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.cloverMaterial) this.cloverMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity * 0.55;
        if (this.flowerMaterial) this.flowerMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.sakuraBarkUniforms) this.sakuraBarkUniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.sakuraFoliageUniforms) this.sakuraFoliageUniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.hangingVineMaterial) this.hangingVineMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.currentConfig?.wind) this.currentConfig.wind.swayIntensity = newConfig.wind.swayIntensity;
      }
      if (typeof newConfig.wind.gustiness === 'number' && Number.isFinite(newConfig.wind.gustiness)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uGustiness.value = newConfig.wind.gustiness;
        if (this.cloverMaterial) this.cloverMaterial.uniforms.uGustiness.value = newConfig.wind.gustiness;
        if (this.flowerMaterial) this.flowerMaterial.uniforms.uGustiness.value = newConfig.wind.gustiness;
        if (this.currentConfig?.wind) this.currentConfig.wind.gustiness = newConfig.wind.gustiness;
      }
      if (newConfig.wind.direction && Array.isArray(newConfig.wind.direction)) {
        const dx = newConfig.wind.direction[0];
        const dz = newConfig.wind.direction[2] ?? newConfig.wind.direction[1] ?? 0.45;
        this.grassMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
        this.cloverMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
        this.flowerMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
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
        if (Array.isArray(newConfig.lighting.directional.position)) {
          const [sx, sy, sz] = newConfig.lighting.directional.position;
          this.directionalLight.position.set(sx, sy, sz);
          const sunDir = new THREE.Vector3(sx, sy, sz).normalize();
          if (this.sakuraFoliageUniforms) {
            this.sakuraFoliageUniforms.uSunDirection.value.copy(sunDir);
          }
          const mats = [
            this.skyMaterial,
            this.cloudSeaMaterial,
            this.cloudBillowMaterial,
            this.waterMaterial,
            this.waterfallMaterial,
            this.grassMaterial,
            this.cloverMaterial,
            this.flowerMaterial,
            this.hangingVineMaterial
          ];
          for (const mat of mats) {
            if (mat?.uniforms?.uSunDirection) {
              mat.uniforms.uSunDirection.value.copy(sunDir);
            }
          }
          if (this.volumetricCloudDome) {
            this.volumetricCloudDome.update(this.lastElapsedTime, sunDir);
          }
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

  public setAtmosphereState(state: Partial<{ timeOfDay: number; weather: WeatherMode }>): void {
    if (!this.isInitialized || !state) return;

    const hour =
      typeof state.timeOfDay === 'number' && Number.isFinite(state.timeOfDay)
        ? ((state.timeOfDay % 24) + 24) % 24
        : this.atmosphereState.timeOfDay;
    const weather: WeatherMode = state.weather ?? this.atmosphereState.weather;
    this.atmosphereState = { timeOfDay: hour, weather };

    this.weatherSystem?.setMode(weather);

    // Map 24h cycle smoothly: 6=dawn, 12=celestial noon, 17=golden hour, 22=starlit sanctuary night
    const sunRad = ((hour - 6) / 12) * Math.PI;
    const elevSin = Math.sin(sunRad);
    const dayFactor = Math.max(0, Math.min(1, (elevSin + 0.15) / 0.85));
    const goldenFactor = Math.exp(-Math.pow((Math.abs(elevSin) - 0.25) * 3.2, 2.0)) * (elevSin > -0.25 ? 1 : 0);
    const nightFactor = 1.0 - dayFactor;

    const sunAzimuth = -Math.PI * 0.42 + ((hour - 12) / 12) * 0.9;
    const sunElev = Math.max(0.14, Math.abs(elevSin) * 0.72 + 0.18);
    const sunDist = 105;
    const sx = Math.cos(sunAzimuth) * Math.cos(sunElev) * sunDist;
    const sy = Math.sin(sunElev) * sunDist;
    const sz = -Math.abs(Math.sin(sunAzimuth)) * Math.cos(sunElev) * sunDist - 24;

    if (this.directionalLight) {
      this.directionalLight.position.set(sx, sy, sz);
      this.tmpSunColor
        .set('#fff1d4')
        .lerp(this.tmpCloudTop.set('#ffc580'), goldenFactor * 0.75)
        .lerp(this.tmpCloudShadow.set('#8db4ff'), nightFactor * 0.85);
      this.directionalLight.color.copy(this.tmpSunColor);
      this.directionalLight.intensity = 0.78 + dayFactor * 0.64 - goldenFactor * 0.08;
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.22 + dayFactor * 0.09;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = 0.28 + dayFactor * 0.18;
    }

    this.tmpSkyTop
      .set('#1e64c8')
      .lerp(this.tmpCloudShadow.set('#2c4b96'), goldenFactor * 0.45)
      .lerp(this.tmpCloudTop.set('#0c1b44'), nightFactor * 0.92);
    this.tmpSkyBot
      .set('#d495b8')
      .lerp(this.tmpCloudShadow.set('#df8fa0'), goldenFactor * 0.55)
      .lerp(this.tmpCloudTop.set('#272b58'), nightFactor * 0.88);
    this.tmpSkyHor
      .set('#f6d4a6')
      .lerp(this.tmpCloudShadow.set('#f4ad72'), goldenFactor * 0.65)
      .lerp(this.tmpCloudTop.set('#5a6a9c'), nightFactor * 0.85);
    this.tmpFogColor
      .set('#e6d8cc')
      .lerp(this.tmpCloudShadow.set('#e8c3aa'), goldenFactor * 0.55)
      .lerp(this.tmpCloudTop.set('#283456'), nightFactor * 0.88);

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.tmpFogColor);
      const weatherDensityBoost = weather === 'mist' ? 0.0014 : weather === 'rain' ? 0.0009 : 0;
      this.scene.fog.density = 0.0021 + weatherDensityBoost;
    }

    const sunDir = this.tmpPos.set(sx, sy, sz).normalize();
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uTopColor.value.copy(this.tmpSkyTop);
      this.skyMaterial.uniforms.uBottomColor.value.copy(this.tmpSkyBot);
      this.skyMaterial.uniforms.uHorizonColor.value.copy(this.tmpSkyHor);
      this.skyMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.skyMaterial.uniforms.uSunGlow.value = 0.38 + dayFactor * 0.47;
    }

    if (this.cloudSeaMaterial) {
      this.cloudSeaMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.cloudSeaMaterial.uniforms.uHorizonColor.value.copy(this.tmpSkyHor);
      this.cloudSeaMaterial.uniforms.uCloudTopColor.value
        .set('#fffaf0')
        .lerp(this.tmpCloudTop.set('#ffe2b8'), goldenFactor * 0.6)
        .lerp(this.tmpCloudShadow.set('#6e82b4'), nightFactor * 0.85);
      this.cloudSeaMaterial.uniforms.uCloudShadowColor.value
        .set('#9eb2da')
        .lerp(this.tmpCloudShadow.set('#28345c'), nightFactor * 0.85);
    }

    if (this.cloudBillowMaterial) {
      this.cloudBillowMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.cloudBillowMaterial.uniforms.uHorizonColor.value.copy(this.tmpSkyHor);
    }

    if (this.volumetricCloudDome) {
      const cov = weather === 'rain' ? 0.78 : weather === 'mist' ? 0.68 : 0.62;
      this.volumetricCloudDome.update(this.lastElapsedTime, sunDir, this.tmpFogColor, cov);
      (this.volumetricCloudDome.uniforms.uTint.value as THREE.Color)
        .set('#fff1e0')
        .lerp(this.tmpCloudTop.set('#ffe0b5'), goldenFactor * 0.55)
        .lerp(this.tmpCloudShadow.set('#6d80b4'), nightFactor * 0.85);
      (this.volumetricCloudDome.uniforms.uShadowColor.value as THREE.Color)
        .set('#7882ad')
        .lerp(this.tmpCloudShadow.set('#28345c'), nightFactor * 0.85);
    }

    if (this.waterMaterial) {
      this.waterMaterial.uniforms.uSunDirection.value.copy(sunDir);
      this.waterMaterial.uniforms.uSkyTopColor.value.copy(this.tmpSkyTop);
      this.waterMaterial.uniforms.uHorizonColor.value.copy(this.tmpSkyHor);
    }
    if (this.waterfallMaterial) this.waterfallMaterial.uniforms.uSunDirection.value.copy(sunDir);
    if (this.sakuraFoliageUniforms) this.sakuraFoliageUniforms.uSunDirection.value.copy(sunDir);
    if (this.grassMaterial?.uniforms?.uSunDirection) this.grassMaterial.uniforms.uSunDirection.value.copy(sunDir);
    if (this.cloverMaterial?.uniforms?.uSunDirection) this.cloverMaterial.uniforms.uSunDirection.value.copy(sunDir);
    if (this.flowerMaterial?.uniforms?.uSunDirection) this.flowerMaterial.uniforms.uSunDirection.value.copy(sunDir);
    if (this.hangingVineMaterial?.uniforms?.uSunDirection) this.hangingVineMaterial.uniforms.uSunDirection.value.copy(sunDir);
    if (this.medallionMaterial) this.medallionMaterial.uniforms.uRadiance.value = 1.0 + nightFactor * 0.55;
    if (this.lanternOrbMaterial) this.lanternOrbMaterial.uniforms.uRadiance.value = 1.0 + nightFactor * 0.65;
  }

  public getGroundHeight(x: number, z: number): number {
    return getParadiseHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 0;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 21;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;
    const lookAt = this.currentConfig?.camera?.lookAt ?? [0, 5.5, -14];

    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2])
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = Math.max(this.currentConfig?.camera?.wanderRadius ?? 120, 120);
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
        name: 'Marble Sanctuary',
        position: new THREE.Vector3(0.0, this.getGroundHeight(0.0, -8.5) + 2.1, -8.5),
        dwellTime: 10.0
      },
      {
        name: 'Cloud Sea Cliff',
        position: new THREE.Vector3(31.5, this.getGroundHeight(31.5, -14.5) + 2.3, -14.5),
        dwellTime: 10.0
      },
      {
        name: 'Blossom Garden',
        position: new THREE.Vector3(-22.0, this.getGroundHeight(-22.0, 6.0) + 2.1, 6.0),
        dwellTime: 9.0
      },
      {
        name: 'Rainbow Vista',
        position: new THREE.Vector3(-14.0, this.getGroundHeight(-14.0, 24.0) + 2.4, 24.0),
        dwellTime: 11.0
      },
      {
        name: 'East Colonnade Pavilion',
        position: new THREE.Vector3(44.0, this.getGroundHeight(44.0, -10.0) + 2.4, -10.0),
        dwellTime: 10.0
      },
      {
        name: 'West Celestial Bridge',
        position: new THREE.Vector3(-37.0, this.getGroundHeight(-37.0, -10.0) + 2.5, -10.0),
        dwellTime: 10.0
      },
      {
        name: 'Far East Sakura Sanctuary',
        position: new THREE.Vector3(78.0, this.getGroundHeight(78.0, -10.0) + 2.4, -10.0),
        dwellTime: 10.0
      },
      {
        name: 'Far West Blossom Pavilion',
        position: new THREE.Vector3(-78.0, this.getGroundHeight(-78.0, -10.0) + 2.4, -10.0),
        dwellTime: 10.0
      },
      {
        name: 'South Sky-Harbor Lotus Pool',
        position: new THREE.Vector3(0.0, this.getGroundHeight(0.0, 66.0) + 2.4, 66.0),
        dwellTime: 10.0
      },
      {
        name: 'North Celestial Lotus Sanctuary',
        position: new THREE.Vector3(0.0, this.getGroundHeight(0.0, -68.5) + 2.4, -68.5),
        dwellTime: 10.0
      }
    ];
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getPipeline(): CinematicPipeline | null {
    return this.pipeline;
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

    this.volumetricCloudDome?.dispose();
    this.volumetricCloudDome = null;
    this.dovesSystem?.dispose();
    this.dovesSystem = null;
    this.swirlingPetalsSystem?.dispose();
    this.swirlingPetalsSystem = null;
    this.weatherSystem?.dispose();
    this.weatherSystem = null;

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    for (const set of this.pbrSets) {
      disposePbrTextureSet(set);
    }
    this.pbrSets = [];

    for (const tex of this.createdTextures) {
      tex.dispose();
    }
    this.createdTextures = [];

    for (const mat of this.extraMaterials) {
      mat.dispose();
    }
    this.extraMaterials = [];

    this.skyMaterial = null;
    this.rainbowMaterials = [];
    this.godRayMaterial = null;
    this.cloudSeaMaterial = null;
    this.cloudBillowMaterial = null;
    this.groundMaterial = null;
    this.groundUniforms = null;
    this.graniteCliffMaterial = null;
    this.isletTurfCapMaterial = null;
    this.carraraMarbleMaterial = null;
    this.polishedGoldMaterial = null;
    this.gildedBronzeMaterial = null;
    this.medallionMaterial = null;
    this.lanternOrbMaterial = null;
    this.waterMaterial = null;
    this.waterfallMaterial = null;
    this.sprayMaterial = null;
    this.mistPoolMaterial = null;
    this.hangingVineMaterial = null;
    this.floatingWaterPetalsMaterial = null;
    this.sakuraBarkMaterial = null;
    this.sakuraBarkUniforms = null;
    this.sakuraFoliageMaterial = null;
    this.sakuraFoliageUniforms = null;
    this.grassMaterial = null;
    this.cloverMaterial = null;
    this.flowerMaterial = null;
    this.petalsMaterial = null;
    this.motesMaterial = null;

    this.lanternOrbsMesh = null;
    this.lanternTransforms = [];
    this.isletConfigs = [];
    this.ambientLight = null;
    this.directionalLight = null;
    this.hemiLight = null;
    this.sanctuaryPointLight = null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;

    this.isInitialized = false;
  }
}
