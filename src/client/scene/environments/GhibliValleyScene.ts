import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { createWildflowerMaterial } from '../shaders/grassSwayShader';
import { createVolumetricCloudDome, VolumetricCloudDomeHandle } from '../shaders/volumetricCloudShader';
import {
  createGustWindGrassMaterial,
  createLivingBoidsSystem,
  LivingBoidsHandle,
  createWeatherParticlesSystem,
  WeatherParticlesHandle,
  WeatherMode
} from '../shaders/livingNatureSystem';
import {
  PbrTextureSet,
  createCobblestonePbrTextures,
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
  GHIBLI_SEA_LEVEL,
  getCoastlineZ,
  getGhibliRoadCenterX,
  getGhibliRillCenterX,
  getGhibliValleyHeight,
  getGhibliValleyNormal,
  getGhibliOceanWaveState,
  createGhibliSkyMaterial,
  createGhibliOceanWaterMaterial,
  createGhibliHillsideBrookMaterial,
  createGhibliValleyTerrainMaterial,
  createGhibliDistantHillMaterial,
  createGhibliClothMaterial,
  createGhibliChimneySmokeMaterial
} from '../shaders/ghibliValleyShader';

export { getGhibliValleyHeight, getGhibliValleyNormal, getCoastlineZ, getGhibliRoadCenterX, getGhibliRillCenterX };

interface PbrSceneAssets {
  cobblestone: PbrTextureSet;
  stoneMasonry: PbrTextureSet;
  terracottaRoof: PbrTextureSet;
  tealRoof: PbrTextureSet;
  oakBark: PbrTextureSet;
  timberWood: PbrTextureSet;
  creamPlaster: PbrTextureSet;
  graniteCliff: PbrTextureSet;
  leafAtlas: THREE.Texture;
}

interface CottageSpec {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotY: number;
  roofStyle: 'terracotta' | 'teal';
  roofType: 'gable' | 'hip';
  chimney: boolean;
  dormer?: boolean;
  balcony?: boolean;
  flowerBox?: boolean;
  stories?: 1 | 2;
}

interface ContactAoSpot {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rotY: number;
  strength: number;
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

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function cragNoise2d(x: number, z: number, seed: number): number {
  const s1 = Math.sin(x * 1.37 + z * 0.91 + seed) * Math.cos(z * 1.19 - x * 0.73 + seed * 1.7);
  const s2 = Math.sin(x * 2.83 - z * 2.11 + seed * 2.3) * 0.5;
  const s3 = Math.cos(x * 5.41 + z * 4.77 - seed * 0.9) * 0.25;
  return (s1 + s2 + s3) / 1.75;
}

/**
 * Generates a fractured, angular granite boulder/sea-stack geometry with planar cleavage facets
 * and multi-frequency FBM crag displacement (never smooth spheres).
 */
function createSculptedGraniteBoulderGeometry(
  seed: number,
  rx: number,
  ry: number,
  rz: number,
  detail = 3
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const planes: Array<{ nx: number; ny: number; nz: number; d: number }> = [
    { nx: Math.sin(seed * 1.7), ny: 0.65, nz: Math.cos(seed * 2.3), d: 0.74 },
    { nx: Math.cos(seed * 3.1), ny: 0.35, nz: Math.sin(seed * 4.1), d: 0.78 },
    { nx: -Math.sin(seed * 2.9), ny: -0.25, nz: Math.cos(seed * 1.3), d: 0.80 }
  ];

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const n1 = cragNoise2d(vx * 2.2 + vy * 1.4, vz * 2.2 - vy * 1.1, seed);
    const n2 = cragNoise2d(vx * 5.1 - vz * 3.3, vy * 4.7 + vx * 2.1, seed + 13.7);
    const ridged = 1.0 - Math.abs(n1);
    let rad = 0.82 + ridged * 0.24 + n2 * 0.11;

    // Flatten slightly along bottom for grounded contact + shear planar rock cleavage faces
    if (vy < -0.35) {
      vy = -0.35 + (vy + 0.35) * 0.35;
    }
    for (const pl of planes) {
      const len = Math.hypot(pl.nx, pl.ny, pl.nz) || 1;
      const dot = (vx * pl.nx + vy * pl.ny + vz * pl.nz) / len;
      if (dot > pl.d) {
        const push = (dot - pl.d) * 0.62;
        vx -= (pl.nx / len) * push;
        vy -= (pl.ny / len) * push;
        vz -= (pl.nz / len) * push;
      }
    }

    vx *= rx * rad;
    vy *= ry * rad;
    vz *= rz * rad;
    pos.setXYZ(i, vx, vy, vz);

    if (uv) {
      // Tri-planar style cylindrical-top UV mapping to avoid pole pinching
      uv.setXY(i, (vx * 0.45 + vz * 0.35) / Math.max(0.4, rx), (vy * 0.65 + vz * 0.25) / Math.max(0.4, ry));
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a delicate 3D forked woody twig spray for instancing inside tree crowns.
 */
function createWoodyTwigSprayGeometry(seed = 1.0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const mainTwig = createBranchTubeGeometry(
    [
      new THREE.Vector3(0, -0.35, 0),
      new THREE.Vector3(0.06, 0.05, 0.04),
      new THREE.Vector3(-0.04, 0.48, -0.03),
      new THREE.Vector3(0.05, 0.88, 0.04)
    ],
    0.042,
    0.011,
    5,
    5,
    { furrowAmp: 0.05, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 1.0, uvScaleV: 1.2, seed }
  );
  parts.push(prepareForMerge(mainTwig, undefined, true));
  mainTwig.dispose();

  const forkTips: Array<[number, number, number, number]> = [
    [0.02, -0.38, 0.56, 0.28],
    [0.14, 0.40, 0.62, -0.22],
    [0.24, -0.26, 0.78, -0.30],
    [0.32, 0.28, 0.84, 0.26]
  ];
  forkTips.forEach(([y0, x1, y1, z1], idx) => {
    const sub = createBranchTubeGeometry(
      [
        new THREE.Vector3(0, y0, 0),
        new THREE.Vector3(x1 * 0.55, (y0 + y1) * 0.52, z1 * 0.55),
        new THREE.Vector3(x1, y1, z1)
      ],
      0.022,
      0.007,
      4,
      3,
      { furrowAmp: 0.04, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 1.0, uvScaleV: 1.0, seed: seed + idx * 2.1 }
    );
    parts.push(prepareForMerge(sub, undefined, true));
    sub.dispose();
  });

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

function scaleGeometryUvs(geo: THREE.BufferGeometry, uScale: number, vScale: number): THREE.BufferGeometry {
  const uv = geo.attributes.uv;
  if (uv) {
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
    }
    uv.needsUpdate = true;
  }
  return geo;
}

function applyVerticalAoColor(
  geo: THREE.BufferGeometry,
  minY: number,
  maxY: number,
  bottomShade = 0.66,
  topShade = 0.98
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const span = Math.max(0.001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const t = Math.max(0, Math.min(1, (vy - minY) / span));
    const baseRise = bottomShade + (topShade - bottomShade) * (t * t * (3 - 2 * t));
    const streak = 0.5 + 0.5 * Math.sin(vx * 6.4 + vz * 5.8) * Math.cos(vx * 13.2 - vz * 11.7);
    const eaveShadow = t > 0.78 ? ((t - 0.78) / 0.22) * (0.14 + 0.08 * streak) : 0.0;
    const s = Math.max(0.55, baseRise - eaveShadow);
    colors[i * 3] = s;
    colors[i * 3 + 1] = s * 0.99;
    colors[i * 3 + 2] = s * 0.96;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
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

/**
 * Generates a gnarled, tapered organic branch/trunk geometry along a 3D CatmullRom spline
 * with optional root-buttress fluting, bark furrow relief, and baked moss + root contact AO vertex colors.
 */
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
  const mossHeightRatio = options.mossHeightRatio ?? 0.32;
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
  const mossTint = new THREE.Color('#8cb850');
  const tmpCol = new THREE.Color();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, pt);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    // Smooth organic taper with slight root swell near t=0
    const rootFlare = buttressFluting > 0 ? Math.pow(Math.max(0, 1 - t * 2.6), 2.0) * 0.42 : 0;
    const baseR = (rStart * (1 - t) + rEnd * t) * (1 + rootFlare);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Twisted bark ridge displacement + buttress root flutes
      const twist = theta + t * 2.2 + seed;
      const furrow =
        Math.sin(twist * 6.0) * 0.55 +
        Math.cos(twist * 11.0 - t * 4.0) * 0.30 +
        Math.sin(theta * 3.0 + seed) * 0.15;
      const buttress =
        buttressFluting > 0
          ? Math.pow(Math.max(0, 1 - t * 2.1), 1.8) * (0.5 + 0.5 * Math.cos(theta * 6.0 + seed)) * buttressFluting
          : 0;

      const rad = Math.max(0.03, baseR * (1 + furrow * furrowAmp + buttress));
      vertex.copy(pt).addScaledVector(N, cosT * rad).addScaledVector(B, sinT * rad);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(u * uvScaleU, t * (totalLen / uvScaleV));

      // Bake root contact AO + lower-trunk moss tinting into vertex color
      const aoT = rootAoRatio > 0 ? Math.min(1, t / rootAoRatio) : 1.0;
      const ao = 0.60 + 0.40 * (aoT * aoT * (3 - 2 * aoT));
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

function createGableRoofGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const slopeLen = Math.hypot(hw, h);
  const uRepZ = d / 2.2;
  const vRepSlope = slopeLen / 2.0;
  const uRepX = w / 2.2;
  const vRepGable = h / 2.0;

  const positions = new Float32Array([
    // Left slope
    -hw, 0,  hd,   0, h,  hd,   0, h, -hd,
    -hw, 0,  hd,   0, h, -hd,  -hw, 0, -hd,
    // Right slope
     hw, 0, -hd,   0, h, -hd,   0, h,  hd,
     hw, 0, -hd,   0, h,  hd,   hw, 0,  hd,
    // Front gable triangle
    -hw, 0,  hd,   hw, 0,  hd,   0, h,  hd,
    // Back gable triangle
     hw, 0, -hd,  -hw, 0, -hd,   0, h, -hd
  ]);
  // U runs horizontally along eaves/ridge; V runs up the slope so barrel tiles drain downward
  const uvs = new Float32Array([
    0, 0,  0, vRepSlope,  uRepZ, vRepSlope,   0, 0,  uRepZ, vRepSlope,  uRepZ, 0,
    0, 0,  0, vRepSlope,  uRepZ, vRepSlope,   0, 0,  uRepZ, vRepSlope,  uRepZ, 0,
    0, 0,  uRepX, 0,  uRepX * 0.5, vRepGable,
    0, 0,  uRepX, 0,  uRepX * 0.5, vRepGable
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function createHipRoofGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const ridgeHalf = Math.max(0.2, (w - d * 0.55) * 0.5);
  const slopeF = Math.hypot(hd, h) / 2.0;
  const slopeS = Math.hypot(hw - ridgeHalf, h) / 2.0;
  const uW = w / 2.2;
  const uR = (ridgeHalf * 2) / 2.2;
  const uMargin = (uW - uR) * 0.5;
  const uD = d / 2.2;

  const positions = new Float32Array([
    // Front slope
    -hw, 0,  hd,   hw, 0,  hd,   ridgeHalf, h, 0,
    -hw, 0,  hd,   ridgeHalf, h, 0,  -ridgeHalf, h, 0,
    // Back slope
     hw, 0, -hd,  -hw, 0, -hd,  -ridgeHalf, h, 0,
     hw, 0, -hd,  -ridgeHalf, h, 0,   ridgeHalf, h, 0,
    // Left hip
    -hw, 0, -hd,  -hw, 0,  hd,  -ridgeHalf, h, 0,
    // Right hip
     hw, 0,  hd,   hw, 0, -hd,   ridgeHalf, h, 0
  ]);
  const uvs = new Float32Array([
    0, 0,  uW, 0,  uW - uMargin, slopeF,   0, 0,  uW - uMargin, slopeF,  uMargin, slopeF,
    0, 0,  uW, 0,  uW - uMargin, slopeF,   0, 0,  uW - uMargin, slopeF,  uMargin, slopeF,
    0, 0,  uD, 0,  uD * 0.5, slopeS,
    0, 0,  uD, 0,  uD * 0.5, slopeS
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * GhibliValleyScene implements ISpace for Space 6 "Thế giới Ghibli".
 * A sunlit Miyazaki-inspired coastal hillside town overlooking a sparkling turquoise bay:
 * - Analytical coastal hillside & winding cobblestone road (`getGhibliValleyHeight`)
 * - Towering 360° Ghibli cumulus clouds & clear cerulean sky dome
 * - Sparkling turquoise bay with animated coastal sea-foam & sun-glitter diamonds
 * - Charming Ghibli Windmill Bakery (animated spinning sails), town & countryside cottages,
 *   fluttering laundry clotheslines, stone seawall & coastal stone viaduct
 * - Animated *Spirited Away*-inspired crimson-and-cream Coastal Sea Train gliding over the bay
 * - Giant Ancient Spirit Camphor Tree, mossy stone lantern, 18,000 swaying grass blades,
 *   wildflowers, fluttering butterflies & 360° soaring white seagulls
 * - Integrated `CinematicPipeline` HDR bloom + post-processing with zero-leak lifecycle
 */
export class GhibliValleyScene implements ISpace {
  readonly id = 'space-ghibli-valley';
  readonly name = 'Thế giới Ghibli';
  readonly slug = 'ghibli-valley';

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

  // Materials & animated handles
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private volumetricCloudDome: VolumetricCloudDomeHandle | null = null;
  private oceanMaterial: THREE.ShaderMaterial | null = null;
  private brookMaterial: THREE.ShaderMaterial | null = null;
  private terrainMaterial: THREE.ShaderMaterial | null = null;
  private grassMaterial: THREE.ShaderMaterial | null = null;
  private cloverMaterial: THREE.ShaderMaterial | null = null;
  private flowerMaterial: THREE.ShaderMaterial | null = null;
  private clothMaterial: THREE.ShaderMaterial | null = null;
  private smokeMaterial: THREE.ShaderMaterial | null = null;
  private hillMaterials: THREE.ShaderMaterial[] = [];
  private foliageWindUniforms: Array<{ uTime: { value: number }; uWindSpeed: { value: number } }> = [];

  private pbrSets: PbrTextureSet[] = [];
  private extraTextures: THREE.Texture[] = [];
  private extraMaterials: THREE.Material[] = [];

  private windmillSails: THREE.Group | null = null;
  private windmillAngularVel = 0.85;
  private seaTrainCurve: THREE.CatmullRomCurve3 | null = null;
  private seaTrainCars: THREE.Group[] = [];
  private trainWindowGlowMat: THREE.MeshStandardMaterial | null = null;
  private trainSmokeMesh: THREE.InstancedMesh | null = null;
  private trainSmokeMaterial: THREE.MeshStandardMaterial | null = null;
  private trainSmokePuffs: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    maxAge: number;
    scale: number;
  }> = [];
  private trainSmokeSpawnAccum = 0;
  private trainSmokeHead = 0;
  private readonly trainChimneyLocalPos = new THREE.Vector3(0, 3.85, 1.55);

  private seagullBoids: LivingBoidsHandle | null = null;
  private butterflyBoids: LivingBoidsHandle | null = null;
  private weatherParticles: WeatherParticlesHandle | null = null;
  private readonly seagullFocusCenter = new THREE.Vector3(0, 22, -38);
  private readonly butterflyFocusCenter = new THREE.Vector3(0, 3.8, 12);
  private readonly weatherFocusCenter = new THREE.Vector3(0, 4.5, 8);

  private coastalKites: Array<{
    group: THREE.Group;
    tailSegments: THREE.Mesh[];
    stringLine: THREE.Line;
    anchorX: number;
    anchorY: number;
    anchorZ: number;
    flyRadius: number;
    flyHeight: number;
    phase: number;
  }> = [];
  private paperPlanes: Array<{
    mesh: THREE.Mesh;
    centerX: number;
    centerY: number;
    centerZ: number;
    radiusX: number;
    radiusZ: number;
    speed: number;
    phase: number;
    bobAmp: number;
  }> = [];

  private sailboats: Array<{
    group: THREE.Group;
    wakeRing: THREE.Mesh | null;
    baseX: number;
    baseZ: number;
    baseRotY: number;
    phase: number;
    speed: number;
    radius: number;
  }> = [];

  private atmosphereState: { timeOfDay: number; weather: WeatherMode } = {
    timeOfDay: 13,
    weather: 'clear'
  };
  private audioBass = 0;
  private audioMid = 0;
  private audioTreble = 0;
  private readonly baseSunDir = new THREE.Vector3(48, 66, 36).normalize();
  private readonly currentSunDir = new THREE.Vector3(48, 66, 36).normalize();
  private readonly baseSunColor = new THREE.Color('#fff4dc');
  private readonly baseAmbientColor = new THREE.Color('#f4f6ee');
  private readonly baseHemiSkyColor = new THREE.Color('#bfe4ff');
  private readonly baseHemiGroundColor = new THREE.Color('#4b6b36');
  private readonly baseFogColor = new THREE.Color('#c8e6ff');
  private baseFogDensity = 0.00055;

  // Reusable scratch math for per-frame updates (zero GC allocations)
  private readonly tmpTrainPos = new THREE.Vector3();
  private readonly tmpTrainTan = new THREE.Vector3();
  private readonly tmpChimneyWorld = new THREE.Vector3();
  private readonly tmpMat = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  private boundRenderer: THREE.WebGLRenderer | null = null;
  private prevShadowEnabled = false;
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;

  // Footprints excluded from grass/wildflower placement & Contact AO spots
  private exclusionCircles: Array<{ x: number; z: number; r: number }> = [];
  private contactAoSpots: ContactAoSpot[] = [];

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
    this.sceneElapsedTime = 0.0;
    this.windmillAngularVel = 0.85;
    this.exclusionCircles = [];
    this.contactAoSpots = [];
    this.seaTrainCars = [];
    this.trainSmokePuffs = [];
    this.trainSmokeSpawnAccum = 0;
    this.trainSmokeHead = 0;
    this.sailboats = [];
    this.coastalKites = [];
    this.paperPlanes = [];
    this.hillMaterials = [];
    this.foliageWindUniforms = [];
    this.pbrSets = [];
    this.extraTextures = [];
    this.extraMaterials = [];
    this.atmosphereState = { timeOfDay: 13, weather: 'clear' };
    this.audioBass = 0;
    this.audioMid = 0;
    this.audioTreble = 0;

    this.boundRenderer = renderer;
    if (renderer && (renderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.prevShadowEnabled = Boolean(renderer.shadowMap.enabled);
      this.prevShadowType = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#c8e6ff',
        density: config?.fog?.density ?? 0.00055
      },
      sky: {
        type: config?.sky?.type ?? 'ghibli_coastal',
        topColor: config?.sky?.topColor ?? '#1559c4',
        bottomColor: config?.sky?.bottomColor ?? '#4da3f0',
        horizonColor: config?.sky?.horizonColor ?? '#c2e6fa',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0.0,
        starDensity: config?.sky?.starDensity ?? 0,
        cloudCoverage: config?.sky?.cloudCoverage ?? 0.65,
        cloudSpeed: config?.sky?.cloudSpeed ?? 0.65
      },
      wind: {
        speed: config?.wind?.speed ?? 2.2,
        direction: config?.wind?.direction ?? [0.85, 0.0, 0.45],
        gustiness: config?.wind?.gustiness ?? 0.55,
        swayIntensity: config?.wind?.swayIntensity ?? 0.85
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#f4f6ee',
          intensity: config?.lighting?.ambient?.intensity ?? 0.46
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#fff4dc',
          intensity: config?.lighting?.directional?.intensity ?? 2.05,
          position: config?.lighting?.directional?.position ?? [48, 66, 36],
          castShadow: config?.lighting?.directional?.castShadow ?? true
        },
        pointLights: config?.lighting?.pointLights ?? []
      },
      shaders: config?.shaders ?? {
        grassSway: { stiffness: 0.48, windInfluence: 0.88, noiseScale: 0.25 },
        flowerFlutter: { frequency: 2.6, amplitude: 0.35 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'ghibli-valley-ambient',
        name: config?.audio?.name ?? 'Ghibli Hill',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/ghibli-hill.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.65,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 2.1, wet: 0.25 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [1.5, 1.7, 15.0],
        lookAt: config?.camera?.lookAt ?? [-1.5, 4.4, -24.0],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 4.2,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.2,
        wanderRadius: Math.max(config?.camera?.wanderRadius ?? 128, 128),
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [1.5, 7.6, 15.0],
          [5.0, 5.2, -8.0],
          [-2.0, 3.6, -24.5],
          [-52.0, 6.0, -21.0],
          [64.0, 4.8, -22.0],
          [-84.0, 5.2, -16.0],
          [8.0, 8.2, 58.0],
          [-42.0, 8.5, 62.0],
          [48.0, 7.8, 52.0]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    // 1. Coastal Mist Fog
    this.scene.fog = new THREE.FogExp2(
      this.currentConfig.fog.color,
      this.currentConfig.fog.density
    );
    this.baseFogColor.copy(this.scene.fog.color);
    this.baseFogDensity = this.scene.fog.density;

    // 2. Crisp Photorealistic Sunlight & Sky/Grass Bounce Lighting + Soft Shadows
    this.ambientLight = new THREE.AmbientLight(
      this.currentConfig.lighting.ambient.color,
      this.currentConfig.lighting.ambient.intensity
    );
    this.baseAmbientColor.copy(this.ambientLight.color);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#bfe4ff', '#4b6b36', 0.82);
    this.baseHemiSkyColor.copy(this.hemiLight.color);
    this.baseHemiGroundColor.copy(this.hemiLight.groundColor);
    this.scene.add(this.hemiLight);

    const dirPos = this.currentConfig.lighting.directional.position;
    this.directionalLight = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.baseSunColor.copy(this.directionalLight.color);
    this.directionalLight.castShadow = this.currentConfig.lighting.directional.castShadow ?? true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 250;
    this.directionalLight.shadow.camera.left = -96;
    this.directionalLight.shadow.camera.right = 96;
    this.directionalLight.shadow.camera.top = 96;
    this.directionalLight.shadow.camera.bottom = -96;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.02;
    this.scene.add(this.directionalLight);

    const sunDir = new THREE.Vector3(dirPos[0], dirPos[1], dirPos[2]).normalize();
    this.baseSunDir.copy(sunDir);
    this.currentSunDir.copy(sunDir);
    const windArr = this.currentConfig.wind.direction;
    const windDir2D = new THREE.Vector2(windArr[0], windArr[2] ?? windArr[1]).normalize();

    // 3. 512x512 Procedural PBR Texture Sets + Physical Sky & Volumetric Cumulonimbus Dome + IBL + Craggy Bay Islands / Hills
    const pbr = this.createPbrAssets(renderer);
    this.buildPhysicalSkyAndIBL(renderer, sunDir);
    this.buildVolumetricClouds(sunDir);
    this.buildDistantHorizons(sunDir, pbr);

    // 4. Sparkling Turquoise Bay Water & Expanded 440x440 Coastal Hillside Terrain
    this.buildOceanWater(sunDir);
    this.buildTerrain(renderer, sunDir, windDir2D);

    // 5. Sculpted Weathered Cobblestone Walkway, Stone Edging Curbs & Mossy Shoreline Granite Boulders
    this.buildCobblestoneWalkway(pbr);
    this.buildCoastalShorelineBoulders(pbr);

    // 6. Stone Seawall, Coastal Viaduct, Western Headland Lighthouse, Stone Arch Footbridge, Telegraph Poles, Sea Train & Sailboats
    this.buildSeawallAndViaduct(pbr);
    this.buildHeadlandLighthouseAndOverlook(pbr);
    this.buildHillsideRillAndStoneBridge(pbr, sunDir);
    this.buildTelegraphPolesAndWires(pbr);
    this.buildCoastalSeaTrain(pbr);
    this.buildCoastalSailboats(pbr);

    // 7. Ghibli Windmill Bakery, Expanded Hillside Cottages, Terrace Cafe/Carts/Barrels, Laundry Clotheslines & Smoke
    const chimneyPositions = this.buildVillageAndBakery(pbr, windDir2D);
    this.buildChimneySmoke(chimneyPositions, windDir2D);

    // 8. Gnarled Mossy Ancient Spirit Camphor Tree & Hillside Broadleaf Trees (Airy Sub-Crowns & Forked Branches)
    this.buildSpiritCamphorTree(pbr, sunDir, windDir2D);
    this.buildHillsideTrees(pbr, sunDir, windDir2D);

    // 9. Soft Contact AO Grounding Skirts under Buildings, Trees, Lantern & Walls
    this.buildContactAoSkirts();

    // 10. Living Gust-Wind Hillside Grass, Clovers, Wildflowers, Boids Seagulls & Butterflies, Kites & Paper Planes, Weather Particles
    this.buildGrassAndWildflowers(sunDir, windDir2D);
    this.buildButterflies();
    this.buildSeagulls(sunDir);
    this.buildKitesAndPaperPlanes(windDir2D);
    this.buildWeatherSystem();

    // 11. HDR CinematicPipeline: pure 'natural' AgX photorealistic default
    this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
      defaultStyle: 'natural',
      bloomStrength: 0.27,
      bloomRadius: 0.48,
      bloomThreshold: 0.86,
      kuwaharaEnabled: false
    });

    // Ensure all scene meshes upload deterministically on frame 1 so GPU geometry count is invariant to camera angle
    this.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });

    this.isInitialized = true;
  }

  private initTex(renderer: THREE.WebGLRenderer | undefined, tex: THREE.Texture): void {
    if (renderer && typeof (renderer as any).initTexture === 'function') {
      try {
        (renderer as any).initTexture(tex);
      } catch {
        // Ignore in headless mock test renderers
      }
    }
  }

  private createPbrAssets(renderer?: THREE.WebGLRenderer): PbrSceneAssets {
    const cobblestone = createCobblestonePbrTextures({ size: 512, seed: 4621, renderer });
    const stoneMasonry = createStoneMasonryPbrTextures({ size: 512, seed: 4811, renderer, repeatX: 2, repeatY: 2 });
    const terracottaRoof = createTerracottaRoofPbrTextures({ size: 512, seed: 2411, variant: 'terracotta', renderer });
    const tealRoof = createTerracottaRoofPbrTextures({ size: 512, seed: 3517, variant: 'teal', renderer });
    const oakBark = createOakBarkPbrTextures({ size: 512, seed: 7109, repeatX: 5, repeatY: 7, renderer });
    oakBark.map.repeat.set(5, 7);
    oakBark.normalMap.repeat.set(5, 7);
    oakBark.roughnessMap.repeat.set(5, 7);
    oakBark.aoMap.repeat.set(5, 7);
    const timberWood = createTimberBeamPbrTextures({ size: 512, seed: 5733, renderer });
    const creamPlaster = createPlasterWallPbrTextures({ size: 512, seed: 1207, renderer, repeatX: 2, repeatY: 2 });
    const graniteCliff = createGraniteCliffPbrTextures({ size: 512, seed: 6203, repeatX: 2, repeatY: 2, renderer });
    const leafAtlas = createBotanicalLeafAtlasTexture(renderer, 512);

    this.pbrSets.push(
      cobblestone,
      stoneMasonry,
      terracottaRoof,
      tealRoof,
      oakBark,
      timberWood,
      creamPlaster,
      graniteCliff
    );
    this.extraTextures.push(leafAtlas);

    return {
      cobblestone,
      stoneMasonry,
      terracottaRoof,
      tealRoof,
      oakBark,
      timberWood,
      creamPlaster,
      graniteCliff,
      leafAtlas
    };
  }

  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private physicalSky: Sky | null = null;

  private buildPhysicalSkyAndIBL(renderer: THREE.WebGLRenderer | undefined, sunDir: THREE.Vector3): void {
    // Rich azure SkyDome with volumetric FBM shader clouds (0 3D sphere cloud geometry, fog-exempt)
    const skyGeo = new THREE.SphereGeometry(460, 64, 32);
    this.skyMaterial = createGhibliSkyMaterial({
      topColor: this.currentConfig?.sky?.topColor,
      bottomColor: this.currentConfig?.sky?.bottomColor,
      horizonColor: this.currentConfig?.sky?.horizonColor,
      sunDirection: sunDir
    });
    this.skyMaterial.fog = false;
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    skyMesh.name = 'SkyDome';
    skyMesh.renderOrder = -2;
    this.scene.add(skyMesh);
    this.physicalSky = null;

    // Bake physical Rayleigh sky into PMREM IBL environment map for PBR stone/metal/wood reflections
    if (renderer && typeof renderer.getContext === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const skyScene = new THREE.Scene();
        const envSky = new Sky();
        envSky.scale.setScalar(10000);
        const envU = envSky.material.uniforms;
        envU['turbidity'].value = 2.2;
        envU['rayleigh'].value = 1.35;
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
        // Fallback cleanly in headless/mock renderers
      }
    }
  }

  private buildVolumetricClouds(sunDir: THREE.Vector3): void {
    const coverage = Math.max(this.currentConfig?.sky?.cloudCoverage ?? 0.65, 0.65);
    const speed = this.currentConfig?.sky?.cloudSpeed ?? 0.65;
    this.volumetricCloudDome = createVolumetricCloudDome({
      radius: 340,
      baseY: 38,
      topY: 120,
      coverage,
      tint: '#fffaf0',
      sunDirection: sunDir,
      ghibliToon: true,
      speed
    });
    // Cool cerulean-slate underbellies contrasted with sunlit Ghibli cream rims
    (this.volumetricCloudDome.uniforms.uShadowColor.value as THREE.Color).set('#5b7ab4');
    const fogColor = this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.color : undefined;
    if (fogColor) {
      (this.volumetricCloudDome.uniforms.uFogColor.value as THREE.Color).copy(fogColor);
    }
    this.volumetricCloudDome.mesh.name = 'GhibliVolumetricCloudDome';
    this.volumetricCloudDome.mesh.renderOrder = -1;
    this.volumetricCloudDome.update(0, sunDir, fogColor, coverage);
    this.scene.add(this.volumetricCloudDome.mesh);
  }

  private buildDistantHorizons(sunDir: THREE.Vector3, pbr: PbrSceneAssets): void {
    // 1. Sculpted Multi-Ridge Fractured Sea-Cliff Islands & Granite Sea Stacks across the turquoise bay
    const islandMat = createGhibliDistantHillMaterial('#336850', '#639458', '#bce2f7', sunDir, 1.3, true);
    this.hillMaterials.push(islandMat);
    const islandSpecs = [
      { x: -165, z: -225, rx: 68, h: 30, rz: 32, seed: 0.5 },
      { x: -24, z: -260, rx: 62, h: 25, rz: 28, seed: 2.1 },
      { x: 158, z: -232, rx: 74, h: 32, rz: 34, seed: 3.7 }
    ];

    islandSpecs.forEach((isl, idx) => {
      const geo = new THREE.CylinderGeometry(isl.rx * 0.12, isl.rx, isl.h, 128, 28, true);
      const pos = geo.attributes.position;
      const yRatios = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const ratio = Math.max(0, Math.min(1, (vy + isl.h * 0.5) / isl.h));
        yRatios[i] = ratio;

        const ang = Math.atan2(vz, vx);
        // Ridged-multifractal headland spurs + sharp sea-cliff buttresses + terraced rock ledges
        const spurRidge = Math.pow(1.0 - Math.abs(Math.sin(ang * 3.0 + isl.seed)), 1.45) * 0.34;
        const headlands =
          0.92 +
          spurRidge +
          0.18 * Math.cos(ang * 5.0 - isl.seed * 0.7) +
          (1.0 - Math.abs(Math.sin(ang * 11.0 + ratio * 1.4))) * 0.11;
        const cliffTerrace = Math.sin(ratio * Math.PI * 5.0 + ang * 2.0 + isl.seed) * 0.065 * (1.0 - ratio * 0.4);
        const cragNoise = cragNoise2d(vx * 0.12, vz * 0.12, isl.seed * 7.1 + ratio * 3.1);
        const ridgedCrag = 1.0 - Math.abs(cragNoise);

        const xNorm = vx * headlands * (1.0 + cliffTerrace) + cragNoise * 2.8 * (0.3 + ratio * 0.7);
        const zNorm = vz * (isl.rz / isl.rx) * headlands * (1.0 + cliffTerrace) + cragNoise * 1.6;

        // Sharp twin/triple coastal crag peaks
        const peakAxis = Math.cos(ang + isl.seed * 0.5);
        const twinRidge = Math.pow(Math.abs(peakAxis), 1.35) * 6.4 + Math.abs(Math.sin(ang * 3.0 + isl.seed * 1.9)) * 3.2;
        const cragLift = Math.pow(ridgedCrag, 1.3) * 4.1;
        const ySculpt = vy + (twinRidge + cragLift) * Math.pow(ratio, 0.74);

        pos.setXYZ(i, xNorm, ySculpt, zNorm);
      }
      geo.setAttribute('aYRatio', new THREE.BufferAttribute(yRatios, 1));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, islandMat);
      mesh.name = `GhibliBayIsland_${idx + 1}`;
      mesh.position.set(isl.x, GHIBLI_SEA_LEVEL + isl.h * 0.42, isl.z);
      this.scene.add(mesh);
    });

    // Rocky Granite Sea Stacks flanking the distant bay islands
    const seaStackGeo = createSculptedGraniteBoulderGeometry(91.3, 4.2, 6.8, 3.6, 3);
    const seaStackMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.graniteCliff.map,
        normalMap: pbr.graniteCliff.normalMap,
        normalScale: new THREE.Vector2(1.8, 1.8),
        roughnessMap: pbr.graniteCliff.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.graniteCliff.aoMap,
        aoMapIntensity: 0.90
      }),
      {
        macroScale: 0.14,
        mossHeight: GHIBLI_SEA_LEVEL + 2.4,
        mossColor: '#37592c',
        dampRoughness: 0.22,
        dirtTint: '#2c2f33'
      }
    );
    const seaStackSpecs: Array<[number, number, number, number, number]> = [
      [-212, -206, 1.85, 2.05, 0.4],
      [-192, -198, 1.25, 1.45, 1.8],
      [-92, -214, 1.60, 1.70, 2.7],
      [-76, -242, 1.45, 1.85, 0.9],
      [26, -238, 1.65, 1.80, 3.4],
      [68, -214, 1.85, 2.10, 1.1],
      [88, -206, 1.25, 1.40, 4.2],
      [204, -210, 1.75, 1.95, 2.2],
      [220, -218, 1.35, 1.55, 5.1]
    ];
    const seaStacks = new THREE.InstancedMesh(seaStackGeo, seaStackMat, seaStackSpecs.length);
    seaStacks.name = 'GhibliBaySeaStacks';
    const stackDummy = new THREE.Matrix4();
    const stackQuat = new THREE.Quaternion();
    seaStackSpecs.forEach(([sx, sz, sXZ, sY, yaw], i) => {
      stackQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      stackDummy.compose(
        new THREE.Vector3(sx, GHIBLI_SEA_LEVEL + 1.8 * sY, sz),
        stackQuat,
        new THREE.Vector3(sXZ, sY, sXZ * 0.85)
      );
      seaStacks.setMatrixAt(i, stackDummy);
    });
    seaStacks.instanceMatrix.needsUpdate = true;
    this.scene.add(seaStacks);

    // 2. Dramatic ridged Alpine mountain ridge ring sealing the inland horizon (tapered smoothly into sea at both flanks)
    const rearHillMat = createGhibliDistantHillMaterial('#335e28', '#68a834', '#c8e6ff', sunDir, 4.4, false);
    this.hillMaterials.push(rearHillMat);
    const arcHalfSpan = Math.PI * 0.62;
    const arcGeo = new THREE.CylinderGeometry(290, 345, 84, 240, 30, true, -arcHalfSpan, arcHalfSpan * 2.0);
    const pos = arcGeo.attributes.position;
    const yRatios = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const ratio = Math.max(0, Math.min(1, (vy + 42) / 84));

      // Signed angle around +Z (0 = south ridge, ±0.62*PI = coastal flanks dropping into the bay)
      const theta = Math.atan2(vx, vz);
      const edgeDist = Math.max(0, 1.0 - Math.abs(theta) / arcHalfSpan);
      const tEdge = Math.min(1.0, edgeDist / 0.24);
      const endTaper = tEdge * tEdge * (3.0 - 2.0 * tEdge);

      yRatios[i] = ratio * endTaper;

      // Sharp ridged-multifractal Alpine peaks + V-shaped couloirs & radial granite spurs
      const peakA = Math.pow(1.0 - Math.abs(Math.sin(theta * 5.0 + 0.6)), 1.35) * 18.5;
      const peakB = Math.pow(1.0 - Math.abs(Math.cos(theta * 11.0 - 0.5)), 1.45) * 8.8;
      const ridgeC = Math.pow(1.0 - Math.abs(Math.sin(theta * 21.0 + 1.1)), 1.5) * 4.8;
      const crag = cragNoise2d(vx * 0.032, vz * 0.032, 9.2 + ratio * 2.1) * 3.2;
      const crest = peakA + peakB + ridgeC + crag;

      const spurInward = (Math.sin(theta * 17.0 + ratio * 2.2) * 5.2 + (1.0 - Math.abs(Math.sin(theta * 27.0))) * 3.2) * Math.sin(ratio * Math.PI) * endTaper;
      const radialLen = Math.hypot(vx, vz) || 1;
      pos.setX(i, vx + (vx / radialLen) * spurInward);
      pos.setZ(i, vz + (vz / radialLen) * spurInward);

      // Taper both coastal ends smoothly down to world y = -4.0 (below GHIBLI_SEA_LEVEL) -> zero 90° cliff cutoff
      const yLocal = -28.0 + (vy + 28.0) * endTaper + crest * Math.pow(ratio, 0.85) * endTaper;
      pos.setY(i, yLocal);
    }
    arcGeo.setAttribute('aYRatio', new THREE.BufferAttribute(yRatios, 1));
    arcGeo.computeVertexNormals();
    const rearMesh = new THREE.Mesh(arcGeo, rearHillMat);
    rearMesh.name = 'DistantGhibliHills';
    rearMesh.position.set(0, 24.0, 0);
    this.scene.add(rearMesh);
  }

  private buildOceanWater(sunDir: THREE.Vector3): void {
    const geo = new THREE.PlaneGeometry(1100, 760, 200, 140);
    geo.rotateX(-Math.PI / 2);
    this.oceanMaterial = createGhibliOceanWaterMaterial({
      sunDirection: sunDir,
      cloudCoverage: this.currentConfig?.sky?.cloudCoverage ?? 0.64
    });
    const mesh = new THREE.Mesh(geo, this.oceanMaterial);
    mesh.name = 'GhibliOceanWater';
    mesh.position.set(0, GHIBLI_SEA_LEVEL, -240);
    this.scene.add(mesh);
  }

  private buildTerrain(
    renderer: THREE.WebGLRenderer | undefined,
    sunDir: THREE.Vector3,
    windDir2D: THREE.Vector2
  ): void {
    const geo = new THREE.PlaneGeometry(760, 760, 260, 260);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const sunlitGreen = new THREE.Color('#5ea030');
    const hollowGreen = new THREE.Color('#2d5e1e');
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = getGhibliValleyHeight(x, z);
      posAttr.setY(i, y);

      const patch = Math.sin(x * 0.08 + 0.4) * Math.cos(z * 0.08 - 0.3) * 0.5 + 0.5;
      const elev = Math.max(0, Math.min(1, (y - 0.5) / 6.2));
      tmpCol.copy(hollowGreen).lerp(sunlitGreen, elev * 0.7 + patch * 0.3);
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Procedural 256x256 directional turf blade-stroke & clover micro-variation DataTexture
    const texSize = 256;
    const texData = new Uint8Array(texSize * texSize * 4);
    for (let y = 0; y < texSize; y++) {
      for (let x = 0; x < texSize; x++) {
        const idx = (y * texSize + x) * 4;
        const macro = Math.sin(x * 0.075 + y * 0.045) * Math.cos(y * 0.082 - x * 0.052);
        const bladeStroke = Math.sin(x * 0.62 + Math.sin(y * 0.14) * 2.2) * Math.cos(y * 0.24 - x * 0.11);
        const speckle = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1.0;
        const clover = Math.sin(x * 0.18 + 1.2) * Math.sin(y * 0.19 - 0.7);
        const grain = 0.86 + 0.10 * macro + 0.08 * bladeStroke + 0.06 * (speckle - 0.5);
        const warmShift = clover > 0.35 ? 1.06 : 0.96;
        texData[idx] = clampByte(208 * grain * warmShift);
        texData[idx + 1] = clampByte(238 * grain);
        texData[idx + 2] = clampByte(174 * grain * (clover > 0.35 ? 0.90 : 1.0));
        texData[idx + 3] = 255;
      }
    }
    const detailTex = new THREE.DataTexture(texData, texSize, texSize, THREE.RGBAFormat);
    detailTex.wrapS = THREE.RepeatWrapping;
    detailTex.wrapT = THREE.RepeatWrapping;
    detailTex.magFilter = THREE.LinearFilter;
    detailTex.minFilter = THREE.LinearFilter;
    detailTex.needsUpdate = true;
    this.initTex(renderer, detailTex);
    this.extraTextures.push(detailTex);

    this.terrainMaterial = createGhibliValleyTerrainMaterial(
      sunDir,
      windDir2D,
      this.currentConfig?.wind?.speed ?? 2.2,
      this.currentConfig?.wind?.gustiness ?? 0.55,
      detailTex
    );
    this.terrainMaterial.uniforms.uCloudCoverage.value =
      this.currentConfig?.sky?.cloudCoverage ?? 0.64;

    const mesh = new THREE.Mesh(geo, this.terrainMaterial);
    mesh.name = 'GhibliCoastalTerrain';
    this.scene.add(mesh);
  }

  /**
   * Builds a sculpted, terrain-hugging 3D PBR cobblestone pathway, bakery terrace plaza,
   * and seaside stone promenade with soft gravel/loam shoulder blending so edges never cut sharply.
   */
  private buildCobblestoneWalkway(pbr: PbrSceneAssets): void {
    const cobbleMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.cobblestone.map,
        normalMap: pbr.cobblestone.normalMap,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughnessMap: pbr.cobblestone.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.cobblestone.aoMap,
        aoMapIntensity: 0.78,
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      }),
      {
        macroScale: 0.22,
        mossHeight: 2.35,
        mossColor: '#3f632a',
        dampRoughness: 0.38,
        dirtTint: '#544634'
      }
    );

    const parts: THREE.BufferGeometry[] = [];
    const tileWorldSize = 2.05;

    // 1. Winding cobblestone road from upper hillside (+Z) down to seaside promenade (-Z)
    {
      const zStart = 96.0;
      const zEnd = -29.8;
      const lenSegs = 220;
      const crossSegs = 14;
      const positions: number[] = [];
      const uvs: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];

      let arcDist = 0;
      let prevCx = getGhibliRoadCenterX(zStart);
      let prevZ = zStart;

      for (let i = 0; i <= lenSegs; i++) {
        const t = i / lenSegs;
        const z = zStart + (zEnd - zStart) * t;
        const cx = getGhibliRoadCenterX(z);
        if (i > 0) {
          arcDist += Math.hypot(cx - prevCx, z - prevZ);
        }
        prevCx = cx;
        prevZ = z;

        const fgWiden = 1.88 + 0.44 * Math.max(0, Math.min(1, (z + 8) / 28));
        const edgeJitter =
          Math.sin(z * 0.85 + 0.4) * 0.14 +
          Math.cos(z * 1.95 - 0.7) * 0.08 +
          Math.sin(z * 3.7) * 0.04;

        for (let j = 0; j <= crossSegs; j++) {
          const sNorm = (j / crossSegs) * 2 - 1; // -1..+1
          const x = cx + sNorm * (fgWiden + edgeJitter * Math.abs(sNorm));
          const groundY = getGhibliValleyHeight(x, z);
          const absS = Math.abs(sNorm);

          // Gentle crown in center; outer shoulder feathers smoothly into the terrain verge
          const shoulderT = Math.max(0, (absS - 0.62) / 0.38);
          const smoothShoulder = shoulderT * shoulderT * (3 - 2 * shoulderT);
          const lift = (1 - smoothShoulder) * (0.026 + (1 - absS * absS) * 0.014) - smoothShoulder * 0.012;
          positions.push(x, groundY + lift, z);
          uvs.push((sNorm * fgWiden) / tileWorldSize, arcDist / tileWorldSize);

          // Blend outer shoulder vertex color into warm earthy loam/moss verge so there is zero cutout seam
          const rCol = 1.0 - smoothShoulder * 0.56;
          const gCol = 0.99 - smoothShoulder * 0.50;
          const bCol = 0.96 - smoothShoulder * 0.66;
          colors.push(rCol, gCol, bCol);
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

      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      roadGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      roadGeo.setIndex(indices);
      roadGeo.computeVertexNormals();
      parts.push(prepareForMerge(roadGeo, undefined, true));
      roadGeo.dispose();
    }

    // Helper for terrain-hugging rectangular cobblestone plaza/promenade aprons
    const buildGridApron = (
      xMin: number,
      xMax: number,
      zMin: number,
      zMax: number,
      segX: number,
      segZ: number,
      followCoast = false
    ) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];

      for (let iz = 0; iz <= segZ; iz++) {
        const vz = iz / segZ;
        for (let ix = 0; ix <= segX; ix++) {
          const ux = ix / segX;
          const x = xMin + (xMax - xMin) * ux;
          const z = followCoast
            ? getCoastlineZ(x) + 1.05 + vz * (zMax - zMin)
            : zMin + (zMax - zMin) * vz;
          const edgeX = Math.min(ux, 1 - ux) * 2;
          const edgeZ = Math.min(vz, 1 - vz) * 2;
          const border = Math.min(edgeX, edgeZ);
          const lift = border < 0.16 ? -0.015 + (border / 0.16) * 0.042 : 0.027;
          const y = getGhibliValleyHeight(x, z) + lift;

          positions.push(x, y, z);
          uvs.push(x / tileWorldSize, z / tileWorldSize);
          const edgeT = border < 0.22 ? 1.0 - border / 0.22 : 0.0;
          colors.push(1.0 - edgeT * 0.48, 0.99 - edgeT * 0.44, 0.96 - edgeT * 0.56);
        }
      }

      const stride = segX + 1;
      for (let iz = 0; iz < segZ; iz++) {
        for (let ix = 0; ix < segX; ix++) {
          const a = iz * stride + ix;
          const b = a + 1;
          const c = (iz + 1) * stride + ix;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      parts.push(prepareForMerge(g, undefined, true));
      g.dispose();
    };

    // 2. Bakery Terrace Plaza & Expanded Seaside Stone Promenade (2x bayfront run)
    buildGridApron(-4.5, 9.4, -18.5, -8.2, 22, 18, false);
    buildGridApron(-108.0, 104.0, 0, 3.4, 128, 6, true);

    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (merged) {
      const roadMesh = new THREE.Mesh(merged, cobbleMat);
      roadMesh.name = 'CobblestonePbrWalkway';
      roadMesh.receiveShadow = true;
      this.scene.add(roadMesh);
    }

    // 3. Sculpted 3D Stone Edging Curb Boulders along the winding cobblestone road shoulder
    const curbGeo = createSculptedGraniteBoulderGeometry(42.7, 0.28, 0.16, 0.22, 2);
    const curbMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.graniteCliff.map,
        normalMap: pbr.graniteCliff.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: pbr.graniteCliff.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.graniteCliff.aoMap,
        aoMapIntensity: 0.85
      }),
      {
        macroScale: 0.28,
        mossHeight: 2.55,
        mossColor: '#44682c',
        dampRoughness: 0.40,
        dirtTint: '#4f4333'
      }
    );
    const randCurb = mulberry32(5519);
    const curbTransforms: THREE.Matrix4[] = [];
    const curbColors: THREE.Color[] = [];
    const curbDummy = new THREE.Matrix4();
    const curbQuat = new THREE.Quaternion();
    const curbEuler = new THREE.Euler();
    const curbPos = new THREE.Vector3();
    const curbScale = new THREE.Vector3();

    for (let z = -27.2; z <= 94.0; z += 0.65) {
      const cx = getGhibliRoadCenterX(z);
      const fgWiden = 1.88 + 0.44 * Math.max(0, Math.min(1, (z + 8) / 28));
      for (const side of [-1, 1]) {
        // Leave clean apron opening where the road meets the Bakery terrace plaza or footbridge spur
        if (side === 1 && ((z >= -18.8 && z <= -8.0) || (z >= -3.2 && z <= 0.4))) continue;
        const jitterX = (randCurb() - 0.5) * 0.22;
        const jitterZ = (randCurb() - 0.5) * 0.22;
        const sx = cx + side * (fgWiden - 0.08) + jitterX;
        const sz = z + jitterZ;
        const sy = getGhibliValleyHeight(sx, sz) - 0.025;

        curbPos.set(sx, sy, sz);
        curbEuler.set((randCurb() - 0.5) * 0.22, randCurb() * Math.PI * 2, (randCurb() - 0.5) * 0.22);
        curbQuat.setFromEuler(curbEuler);
        curbScale.set(0.72 + randCurb() * 0.58, 0.68 + randCurb() * 0.44, 0.78 + randCurb() * 0.58);
        curbDummy.compose(curbPos, curbQuat, curbScale);
        curbTransforms.push(curbDummy.clone());

        const tone = 0.84 + randCurb() * 0.22;
        curbColors.push(new THREE.Color(tone, tone * 0.99, tone * 0.94));
      }
    }

    if (curbTransforms.length > 0) {
      const curbMesh = new THREE.InstancedMesh(curbGeo, curbMat, curbTransforms.length);
      curbMesh.name = 'CobbleRoadCurbStones';
      curbMesh.castShadow = true;
      curbMesh.receiveShadow = true;
      curbTransforms.forEach((m, i) => {
        curbMesh.setMatrixAt(i, m);
        curbMesh.setColorAt(i, curbColors[i]);
      });
      curbMesh.instanceMatrix.needsUpdate = true;
      if (curbMesh.instanceColor) curbMesh.instanceColor.needsUpdate = true;
      this.scene.add(curbMesh);
    }

    // 4. Fine Road-Verge Pebble Scatter & Fallen Oak Leaves along Cobblestone Curbs
    const pebbleGeo = createSculptedGraniteBoulderGeometry(71.3, 0.075, 0.032, 0.065, 1);
    const pebbleCount = 460;
    const pebbleMesh = new THREE.InstancedMesh(pebbleGeo, curbMat, pebbleCount);
    pebbleMesh.name = 'CobbleVergePebbleScatter';
    pebbleMesh.receiveShadow = true;

    let pIdx = 0;
    for (let i = 0; i < pebbleCount; i++) {
      const pz = -26.5 + (i / pebbleCount) * 118.0 + (randCurb() - 0.5) * 0.4;
      const side = i % 2 === 0 ? 1 : -1;
      if (side === 1 && ((pz >= -18.8 && pz <= -8.0) || (pz >= -3.2 && pz <= 0.4))) continue;
      const cx = getGhibliRoadCenterX(pz);
      const fgWiden = 1.88 + 0.44 * Math.max(0, Math.min(1, (pz + 8) / 28));
      const px = cx + side * (fgWiden - 0.14 + (randCurb() - 0.3) * 0.52);
      const py = getGhibliValleyHeight(px, pz) + 0.008;

      curbPos.set(px, py, pz);
      curbEuler.set((randCurb() - 0.5) * 0.3, randCurb() * Math.PI * 2, (randCurb() - 0.5) * 0.3);
      curbQuat.setFromEuler(curbEuler);
      const ps = 0.55 + randCurb() * 0.95;
      curbScale.set(ps, ps * (0.65 + randCurb() * 0.5), ps * (0.8 + randCurb() * 0.4));
      curbDummy.compose(curbPos, curbQuat, curbScale);
      pebbleMesh.setMatrixAt(pIdx, curbDummy);

      const tone = 0.72 + randCurb() * 0.32;
      pebbleMesh.setColorAt(pIdx, new THREE.Color(tone * 1.02, tone * 0.99, tone * 0.92));
      pIdx++;
    }
    pebbleMesh.count = pIdx;
    pebbleMesh.instanceMatrix.needsUpdate = true;
    if (pebbleMesh.instanceColor) pebbleMesh.instanceColor.needsUpdate = true;
    this.scene.add(pebbleMesh);

    const leafGeo = new THREE.PlaneGeometry(0.11, 0.068, 2, 1);
    leafGeo.rotateX(-Math.PI * 0.5);
    const lPos = leafGeo.attributes.position;
    for (let vi = 0; vi < lPos.count; vi++) {
      const lx = lPos.getX(vi);
      lPos.setY(vi, Math.abs(lx) * 0.22);
    }
    leafGeo.computeVertexNormals();
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.72,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    const leafCount = 540;
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    leafMesh.name = 'CobbleVergeFallenOakLeaves';
    leafMesh.receiveShadow = true;

    const leafPalette = ['#8f5524', '#a86a2b', '#75461e', '#b57b32', '#644a24'];
    let lIdx = 0;
    for (let i = 0; i < leafCount; i++) {
      let lx = 0;
      let lz = 0;
      if (i < 420) {
        lz = -25.0 + (i / 420) * 115.0 + (randCurb() - 0.5) * 0.45;
        const side = i % 2 === 0 ? 1 : -1;
        const cx = getGhibliRoadCenterX(lz);
        const fgWiden = 1.88 + 0.44 * Math.max(0, Math.min(1, (lz + 8) / 28));
        lx = cx + side * (fgWiden - 0.22 + randCurb() * 0.75);
      } else {
        // Scattered fallen oak leaves beneath the Spirit Camphor Tree (-16.5, -10.5)
        const ang = randCurb() * Math.PI * 2;
        const rad = 1.6 + randCurb() * 5.2;
        lx = -16.5 + Math.cos(ang) * rad;
        lz = -10.5 + Math.sin(ang) * rad;
      }
      const ly = getGhibliValleyHeight(lx, lz) + 0.022;
      curbPos.set(lx, ly, lz);
      curbEuler.set((randCurb() - 0.5) * 0.25, randCurb() * Math.PI * 2, (randCurb() - 0.5) * 0.25);
      curbQuat.setFromEuler(curbEuler);
      const ls = 0.75 + randCurb() * 0.75;
      curbScale.set(ls, 1.0, ls * (0.8 + randCurb() * 0.4));
      curbDummy.compose(curbPos, curbQuat, curbScale);
      leafMesh.setMatrixAt(lIdx, curbDummy);
      leafMesh.setColorAt(lIdx, new THREE.Color(leafPalette[i % leafPalette.length]));
      lIdx++;
    }
    leafMesh.count = lIdx;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    this.scene.add(leafMesh);
  }

  /**
   * Places sculpted mossy coastal granite boulders along the rocky drop-off
   * below the seawall, around the coastal viaduct piers, and framing the Western Headland Cape.
   */
  private buildCoastalShorelineBoulders(pbr: PbrSceneAssets): void {
    const boulderMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.graniteCliff.map,
        normalMap: pbr.graniteCliff.normalMap,
        normalScale: new THREE.Vector2(1.75, 1.75),
        roughnessMap: pbr.graniteCliff.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.graniteCliff.aoMap,
        aoMapIntensity: 0.90
      }),
      {
        macroScale: 0.28,
        mossHeight: GHIBLI_SEA_LEVEL + 1.25,
        mossColor: '#3a5e28',
        dampRoughness: 0.22,
        dirtTint: '#363228'
      }
    );

    const boulderGeos = [
      createSculptedGraniteBoulderGeometry(14.3, 1.35, 0.92, 1.15, 3),
      createSculptedGraniteBoulderGeometry(31.7, 1.65, 0.72, 1.35, 3),
      createSculptedGraniteBoulderGeometry(57.9, 1.05, 1.25, 0.95, 3)
    ];

    const rand = mulberry32(6841);
    const placementsByVariant: Array<Array<{ mat: THREE.Matrix4; col: THREE.Color }>> = [[], [], []];
    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();

    // Dense rocky granite shelf below the seawall, around viaduct piers & western/eastern coastal headlands
    for (let i = 0; i < 260; i++) {
      const x = -142 + (i / 259) * 284 + (rand() - 0.5) * 1.4;
      const coastZ = getCoastlineZ(x);
      const band = rand();
      const isHeadland = (x < -46 || x > 34) && band > 0.45;
      const zOff = isHeadland ? 1.5 - rand() * 5.2 : band < 0.68 ? -0.5 - rand() * 3.1 : -5.4 - rand() * 3.2;
      const z = coastZ + zOff;
      const terrainY = getGhibliValleyHeight(x, z);
      const y = isHeadland
        ? terrainY - 0.15 + rand() * 0.45
        : Math.max(GHIBLI_SEA_LEVEL - 0.45, terrainY - 0.12) + (band < 0.68 ? rand() * 0.42 : -0.05);

      pos.set(x, y, z);
      euler.set((rand() - 0.5) * 0.45, rand() * Math.PI * 2, (rand() - 0.5) * 0.45);
      quat.setFromEuler(euler);
      const s = isHeadland ? 1.15 + rand() * 1.55 : 0.72 + rand() * 1.20;
      scale.set(s * (0.85 + rand() * 0.35), s * (0.76 + rand() * 0.48), s * (0.85 + rand() * 0.35));
      dummy.compose(pos, quat, scale);

      const tone = 0.82 + rand() * 0.26;
      placementsByVariant[i % boulderGeos.length].push({
        mat: dummy.clone(),
        col: new THREE.Color(tone, tone * 0.99, tone * 0.96)
      });
    }

    boulderGeos.forEach((geo, vIdx) => {
      const list = placementsByVariant[vIdx];
      if (list.length === 0) {
        geo.dispose();
        return;
      }
      const mesh = new THREE.InstancedMesh(geo, boulderMat, list.length);
      mesh.name = `CoastalGraniteBoulders_${vIdx + 1}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      list.forEach((item, i) => {
        mesh.setMatrixAt(i, item.mat);
        mesh.setColorAt(i, item.col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
    });
  }

  private buildSeawallAndViaduct(pbr: PbrSceneAssets): void {
    const stoneMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.stoneMasonry.map,
        normalMap: pbr.stoneMasonry.normalMap,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughnessMap: pbr.stoneMasonry.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.stoneMasonry.aoMap,
        aoMapIntensity: 0.88
      }),
      {
        macroScale: 0.20,
        mossHeight: GHIBLI_SEA_LEVEL + 1.35,
        mossColor: '#365826',
        dampRoughness: 0.24,
        dirtTint: '#3d362c'
      }
    );
    const timberMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.timberWood.map,
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: pbr.timberWood.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.timberWood.aoMap
      }),
      {
        macroScale: 0.30,
        mossHeight: GHIBLI_SEA_LEVEL + 0.5,
        mossColor: '#3d5828',
        dampRoughness: 0.44,
        dirtTint: '#3b2b1d'
      }
    );
    const lanternGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe499') });
    const railIronMat = new THREE.MeshStandardMaterial({ color: '#3b4856', roughness: 0.48, metalness: 0.38 });

    const stoneParts: THREE.BufferGeometry[] = [];
    const woodParts: THREE.BufferGeometry[] = [];
    const ironParts: THREE.BufferGeometry[] = [];
    const glowParts: THREE.BufferGeometry[] = [];

    const addBox = (
      list: THREE.BufferGeometry[],
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      rotY = 0,
      rotZ = 0
    ) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (list === stoneParts) {
        scaleGeometryUvs(g, Math.max(0.25, Math.max(w, d) * 0.36), Math.max(0.15, h * 0.36));
      }
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, rotZ, 'YXZ'));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      list.push(prepareForMerge(g, m));
      g.dispose();
    };

    // 1. Stone Seawall + Coping + Smooth Slope-Aligned Seaside Railing hugging getCoastlineZ(x)
    const wallSegs = 72;
    const xStart = -112;
    const xEnd = 112;
    const stepX = (xEnd - xStart) / wallSegs;
    for (let i = 0; i < wallSegs; i++) {
      const x1 = xStart + i * stepX;
      const x2 = x1 + stepX;
      const xm = (x1 + x2) * 0.5;
      const z1 = getCoastlineZ(x1) + 0.8;
      const z2 = getCoastlineZ(x2) + 0.8;
      const zm = (z1 + z2) * 0.5;
      const horizLen = Math.hypot(x2 - x1, z2 - z1);
      const yaw = -Math.atan2(z2 - z1, x2 - x1);
      const topY1 = getGhibliValleyHeight(x1, z1 + 1.0) + 0.52;
      const topY2 = getGhibliValleyHeight(x2, z2 + 1.0) + 0.52;
      const topY = (topY1 + topY2) * 0.5;
      const slopeLen = Math.hypot(horizLen, topY2 - topY1) + 0.14;
      const slopePitch = Math.atan2(topY2 - topY1, horizLen);
      const baseBottom = GHIBLI_SEA_LEVEL - 1.6;
      const wallH = Math.max(0.6, topY - baseBottom);

      addBox(stoneParts, horizLen + 0.16, wallH, 1.1, xm, baseBottom + wallH * 0.5, zm, yaw);
      addBox(stoneParts, slopeLen, 0.24, 1.34, xm, topY + 0.12, zm, yaw, slopePitch);

      if (Math.abs(xm) <= 92) {
        addBox(ironParts, 0.11, 0.92, 0.11, xm, topY + 0.68, zm, yaw);
        addBox(woodParts, slopeLen, 0.09, 0.14, xm, topY + 1.12, zm, yaw, slopePitch);
        addBox(ironParts, slopeLen, 0.05, 0.05, xm, topY + 0.72, zm, yaw, slopePitch);
      }

      if (i % 6 === 3 && Math.abs(xm) <= 88) {
        addBox(stoneParts, 0.52, 1.1, 0.52, xm, topY + 0.65, zm + 0.15, yaw);
        addBox(glowParts, 0.28, 0.34, 0.28, xm, topY + 1.35, zm + 0.15, yaw);
        addBox(ironParts, 0.38, 0.10, 0.38, xm, topY + 1.56, zm + 0.15, yaw);
      }
    }

    // Cozy seaside wooden benches along the extended seawall promenade
    for (const bx of [-42.0, -7.5, 8.5, 42.0]) {
      const bz = getCoastlineZ(bx) + 2.3;
      const by = getGhibliValleyHeight(bx, bz);
      addBox(woodParts, 1.9, 0.10, 0.52, bx, by + 0.45, bz, 0.05);
      addBox(woodParts, 1.9, 0.42, 0.08, bx, by + 0.72, bz + 0.22, 0.05);
      addBox(ironParts, 0.08, 0.45, 0.46, bx - 0.78, by + 0.22, bz, 0.05);
      addBox(ironParts, 0.08, 0.45, 0.46, bx + 0.78, by + 0.22, bz, 0.05);
      this.contactAoSpots.push({ x: bx, z: bz, rx: 1.25, rz: 0.55, rotY: 0.05, strength: 0.42 });
    }

    // 2. Arched Coastal Stone Viaduct out over the sparkling bay (2x run length, z = getCoastlineZ(x) - 7.2)
    const viaductY = 0.55;
    const vSegs = 112;
    const vxStart = -248;
    const vxEnd = 248;
    const vStep = (vxEnd - vxStart) / vSegs;

    for (let i = 0; i < vSegs; i++) {
      const x1 = vxStart + i * vStep;
      const x2 = x1 + vStep;
      const xm = (x1 + x2) * 0.5;
      const z1 = getCoastlineZ(x1) - 7.2;
      const z2 = getCoastlineZ(x2) - 7.2;
      const zm = (z1 + z2) * 0.5;
      const len = Math.hypot(x2 - x1, z2 - z1) + 0.15;
      const yaw = -Math.atan2(z2 - z1, x2 - x1);

      addBox(stoneParts, len, 0.65, 3.2, xm, viaductY - 0.32, zm, yaw);
      addBox(stoneParts, len, 0.42, 0.28, xm, viaductY + 0.20, zm - 1.48, yaw);
      addBox(stoneParts, len, 0.42, 0.28, xm, viaductY + 0.20, zm + 1.48, yaw);
      addBox(ironParts, len, 0.10, 0.10, xm, viaductY + 0.14, zm - 0.62, yaw);
      addBox(ironParts, len, 0.10, 0.10, xm, viaductY + 0.14, zm + 0.62, yaw);

      for (let s = -0.3; s <= 0.31; s += 0.6) {
        const sx = xm + Math.cos(-yaw) * (s * vStep);
        const sz = zm + Math.sin(-yaw) * (s * vStep);
        addBox(woodParts, 0.24, 0.09, 1.75, sx, viaductY + 0.05, sz, yaw);
      }

      if (i % 2 === 0) {
        const pierBottom = GHIBLI_SEA_LEVEL - 2.0;
        const pierH = viaductY - 0.5 - pierBottom;
        addBox(stoneParts, 1.15, pierH, 2.75, xm, pierBottom + pierH * 0.5, zm, yaw);
      }
    }

    const group = new THREE.Group();
    group.name = 'SeawallAndCoastalViaduct';

    const attachMerged = (list: THREE.BufferGeometry[], mat: THREE.Material, name: string, shadow = true) => {
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        const m = new THREE.Mesh(merged, mat);
        m.name = name;
        m.castShadow = shadow;
        m.receiveShadow = shadow;
        group.add(m);
      }
    };

    attachMerged(stoneParts, stoneMat, 'SeawallViaductMasonry');
    attachMerged(woodParts, timberMat, 'SeawallWoodRails');
    attachMerged(ironParts, railIronMat, 'SeawallAndTrackIron');
    attachMerged(glowParts, lanternGlowMat, 'SeawallBollardLights', false);

    this.scene.add(group);
  }

  /**
   * Builds the Western Headland Lighthouse & Cliff Overlook at (x = -62, z = -26)
   * with stone bastion terrace, tapered masonry tower, iron gallery rail, glazed lantern room,
   * crimson cupola dome, and warm rotating-style Fresnel beacon light.
   */
  private buildHeadlandLighthouseAndOverlook(pbr: PbrSceneAssets): void {
    const lx = -62.0;
    const lz = -26.0;
    const baseY = getGhibliValleyHeight(lx, lz) - 0.12;
    this.exclusionCircles.push({ x: lx, z: lz, r: 7.5 });
    this.contactAoSpots.push({ x: lx, z: lz, rx: 6.2, rz: 6.2, rotY: 0, strength: 0.58 });

    const stoneMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.stoneMasonry.map,
        normalMap: pbr.stoneMasonry.normalMap,
        normalScale: new THREE.Vector2(1.6, 1.6),
        roughnessMap: pbr.stoneMasonry.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.stoneMasonry.aoMap,
        aoMapIntensity: 0.90
      }),
      {
        macroScale: 0.22,
        mossHeight: baseY + 1.4,
        mossColor: '#3b5e2b',
        dampRoughness: 0.32,
        dirtTint: '#463d30'
      }
    );
    const cupolaRedMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.creamPlaster.map,
        normalMap: pbr.creamPlaster.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        color: '#a62c28',
        roughness: 0.38,
        metalness: 0.24
      }),
      {
        macroScale: 0.35,
        mossHeight: -10.0,
        dampRoughness: 0.30,
        dirtTint: '#421a18'
      }
    );
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#252c34',
      roughness: 0.42,
      metalness: 0.68
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#dfb04a',
      roughness: 0.24,
      metalness: 0.82
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#132635',
      roughness: 0.12,
      metalness: 0.85,
      envMapIntensity: 1.75,
      transparent: true,
      opacity: 0.62
    });
    const doorWoodMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.timberWood.map,
        color: '#6b3e24',
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughness: 0.64
      }),
      {
        macroScale: 0.4,
        mossHeight: -10.0,
        dampRoughness: 0.48,
        dirtTint: '#362012'
      }
    );
    const beaconGlowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffec9e')
    });

    const stoneGeos: THREE.BufferGeometry[] = [];
    const redGeos: THREE.BufferGeometry[] = [];
    const ironGeos: THREE.BufferGeometry[] = [];
    const brassGeos: THREE.BufferGeometry[] = [];
    const woodGeos: THREE.BufferGeometry[] = [];
    const glassGeos: THREE.BufferGeometry[] = [];
    const glowGeos: THREE.BufferGeometry[] = [];

    const pushG = (
      list: THREE.BufferGeometry[],
      geo: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      if (rx !== 0) geo.rotateX(rx);
      if (ry !== 0) geo.rotateY(ry);
      if (rz !== 0) geo.rotateZ(rz);
      geo.translate(lx + x, baseY + y, lz + z);
      list.push(prepareForMerge(geo));
      geo.dispose();
    };

    // 1. Circular Cliff Overlook Bastion Foundation & Parapet Wall
    pushG(stoneGeos, scaleGeometryUvs(new THREE.CylinderGeometry(5.2, 5.8, 3.2, 24), 4.5, 1.2), 0, -1.25, 0);
    pushG(stoneGeos, scaleGeometryUvs(new THREE.CylinderGeometry(5.38, 5.38, 0.24, 24), 4.5, 0.3), 0, 0.42, 0);

    // Low stone parapet segments + wrought-iron cliff overlook railing around the western/northern arc
    const railCount = 18;
    for (let i = 0; i < railCount; i++) {
      const ang = -Math.PI * 0.15 + (i / (railCount - 1)) * Math.PI * 1.35;
      const rx = Math.cos(ang) * 4.95;
      const rz = -Math.sin(ang) * 4.95;
      pushG(ironGeos, new THREE.CylinderGeometry(0.045, 0.055, 1.05, 6), rx, 0.98, rz);
      if (i % 3 === 0) {
        pushG(stoneGeos, new THREE.BoxGeometry(0.48, 0.95, 0.48), rx, 0.92, rz, 0, ang, 0);
        pushG(stoneGeos, new THREE.BoxGeometry(0.56, 0.12, 0.56), rx, 1.44, rz, 0, ang, 0);
      }
      if (i < railCount - 1) {
        const nextAng = -Math.PI * 0.15 + ((i + 1) / (railCount - 1)) * Math.PI * 1.35;
        const nx = Math.cos(nextAng) * 4.95;
        const nz = -Math.sin(nextAng) * 4.95;
        const mx = (rx + nx) * 0.5;
        const mz = (rz + nz) * 0.5;
        const segLen = Math.hypot(nx - rx, nz - rz) + 0.04;
        const segYaw = -Math.atan2(nz - rz, nx - rx);
        pushG(ironGeos, new THREE.BoxGeometry(segLen, 0.055, 0.065), mx, 1.42, mz, 0, segYaw, 0);
        pushG(ironGeos, new THREE.BoxGeometry(segLen, 0.04, 0.045), mx, 1.04, mz, 0, segYaw, 0);
      }
    }

    // Brass maritime binocular stand on the sea-facing overlook edge
    pushG(ironGeos, new THREE.CylinderGeometry(0.06, 0.16, 1.18, 8), 0.0, 1.05, -4.25);
    pushG(brassGeos, new THREE.CylinderGeometry(0.09, 0.07, 0.46, 10), 0.0, 1.68, -4.32, Math.PI * 0.44, 0, 0);

    // Stepped stone trail descending from the lighthouse bastion toward the coastal promenade (+X/+Z)
    for (let st = 0; st < 8; st++) {
      const t = st / 7;
      const sx = 4.8 + st * 1.15;
      const sz = 1.4 + st * 0.45;
      const sy = getGhibliValleyHeight(lx + sx, lz + sz) - baseY + (1 - t) * 0.35;
      pushG(stoneGeos, new THREE.BoxGeometry(1.18, 0.28, 1.65), sx, sy, sz, 0, -0.35, 0);
    }

    // 2. Tapered Stone Masonry Lighthouse Tower
    pushG(stoneGeos, scaleGeometryUvs(new THREE.CylinderGeometry(2.35, 2.55, 1.45, 20), 2.8, 0.8), 0, 1.10, 0);
    pushG(stoneGeos, scaleGeometryUvs(new THREE.CylinderGeometry(1.42, 2.22, 9.8, 20, 4), 2.6, 2.6), 0, 6.65, 0);
    // Projecting stone stringcourses (belt moldings)
    pushG(stoneGeos, new THREE.CylinderGeometry(2.05, 2.08, 0.22, 20), 0, 4.65, 0);
    pushG(stoneGeos, new THREE.CylinderGeometry(1.76, 1.79, 0.22, 20), 0, 8.15, 0);

    // Keeper's entrance stone arch, paneled timber door, brass handle & recessed transom glass over warm glow
    pushG(stoneGeos, new THREE.BoxGeometry(0.46, 2.25, 1.38), 2.22, 1.56, 0.0);
    pushG(stoneGeos, new THREE.BoxGeometry(0.54, 0.22, 1.52), 2.26, 2.68, 0.0);
    pushG(woodGeos, new THREE.BoxGeometry(0.18, 1.98, 1.02), 2.38, 1.48, 0.0);
    pushG(brassGeos, new THREE.SphereGeometry(0.055, 8, 6), 2.49, 1.38, 0.34);
    pushG(glowGeos, new THREE.BoxGeometry(0.08, 0.42, 0.56), 2.40, 1.96, 0.0);
    pushG(glassGeos, new THREE.BoxGeometry(0.06, 0.44, 0.58), 2.46, 1.96, 0.0);
    pushG(woodGeos, new THREE.BoxGeometry(0.08, 0.46, 0.045), 2.48, 1.96, 0.0);
    pushG(woodGeos, new THREE.BoxGeometry(0.08, 0.045, 0.60), 2.48, 1.96, 0.0);

    // 3 Recessed keeper windows spiraling up the shaft (stone sill/lintel + dark glass + warm interior curtain glow)
    const winSpecs: Array<[number, number, number]> = [
      [0.0, 3.45, 1.98],
      [-1.78, 6.35, 0.0],
      [0.0, 9.35, -1.52]
    ];
    for (const [wx, wy, wz] of winSpecs) {
      const wYaw = Math.atan2(wx, wz);
      const rDist = Math.hypot(wx, wz);
      const nx = Math.sin(wYaw);
      const nz = Math.cos(wYaw);
      pushG(stoneGeos, new THREE.BoxGeometry(0.76, 0.14, 0.26), nx * (rDist + 0.04), wy + 0.52, nz * (rDist + 0.04), 0, wYaw, 0);
      pushG(stoneGeos, new THREE.BoxGeometry(0.82, 0.14, 0.30), nx * (rDist + 0.06), wy - 0.52, nz * (rDist + 0.06), 0, wYaw, 0);
      pushG(glowGeos, new THREE.BoxGeometry(0.46, 0.80, 0.05), nx * (rDist - 0.04), wy, nz * (rDist - 0.04), 0, wYaw, 0);
      pushG(glassGeos, new THREE.BoxGeometry(0.54, 0.88, 0.06), nx * (rDist + 0.01), wy, nz * (rDist + 0.01), 0, wYaw, 0);
      pushG(ironGeos, new THREE.BoxGeometry(0.04, 0.88, 0.11), nx * (rDist + 0.03), wy, nz * (rDist + 0.03), 0, wYaw, 0);
      pushG(ironGeos, new THREE.BoxGeometry(0.54, 0.04, 0.11), nx * (rDist + 0.03), wy, nz * (rDist + 0.03), 0, wYaw, 0);
    }

    // 3. Corbelled Stone Gallery Deck & Wrought-Iron Gallery Balustrade
    const galY = 11.65;
    for (let cb = 0; cb < 16; cb++) {
      const cAng = (cb / 16) * Math.PI * 2;
      pushG(
        stoneGeos,
        new THREE.BoxGeometry(0.22, 0.36, 0.34),
        Math.cos(cAng) * 1.48,
        galY - 0.24,
        Math.sin(cAng) * 1.48,
        0,
        -cAng,
        0
      );
    }
    pushG(stoneGeos, new THREE.CylinderGeometry(2.05, 1.82, 0.32, 24), 0, galY, 0);

    // Circular gallery rail stanchions & twin handrail rings
    const gRailPosts = 16;
    for (let p = 0; p < gRailPosts; p++) {
      const pAng = (p / gRailPosts) * Math.PI * 2;
      const px = Math.cos(pAng) * 1.94;
      const pz = Math.sin(pAng) * 1.94;
      pushG(ironGeos, new THREE.CylinderGeometry(0.035, 0.04, 0.96, 6), px, galY + 0.58, pz);
      const nextAng = ((p + 1) / gRailPosts) * Math.PI * 2;
      const nx = Math.cos(nextAng) * 1.94;
      const nz = Math.sin(nextAng) * 1.94;
      const rLen = Math.hypot(nx - px, nz - pz) + 0.03;
      const rYaw = -Math.atan2(nz - pz, nx - px);
      pushG(ironGeos, new THREE.BoxGeometry(rLen, 0.045, 0.045), (px + nx) * 0.5, galY + 1.04, (pz + nz) * 0.5, 0, rYaw, 0);
      pushG(ironGeos, new THREE.BoxGeometry(rLen, 0.032, 0.032), (px + nx) * 0.5, galY + 0.68, (pz + nz) * 0.5, 0, rYaw, 0);
    }

    // 4. Glazed Lantern Room, Fresnel Warm Beacon Light & Crimson Cupola Dome
    pushG(ironGeos, new THREE.CylinderGeometry(1.36, 1.38, 0.52, 16), 0, galY + 0.38, 0);
    pushG(glassGeos, new THREE.CylinderGeometry(1.28, 1.28, 1.75, 16), 0, galY + 1.48, 0);
    for (let m = 0; m < 8; m++) {
      const mAng = (m / 8) * Math.PI * 2;
      pushG(brassGeos, new THREE.BoxGeometry(0.06, 1.78, 0.08), Math.cos(mAng) * 1.30, galY + 1.48, Math.sin(mAng) * 1.30, 0, -mAng, 0);
    }
    // Glowing warm Fresnel beacon core + brass lens rings
    pushG(glowGeos, new THREE.CylinderGeometry(0.68, 0.68, 1.18, 14), 0, galY + 1.48, 0);
    pushG(brassGeos, new THREE.CylinderGeometry(0.76, 0.76, 0.10, 14), 0, galY + 1.15, 0);
    pushG(brassGeos, new THREE.CylinderGeometry(0.76, 0.76, 0.10, 14), 0, galY + 1.82, 0);

    // Red cupola dome roof + cornice + ventilator ball & brass weathervane
    pushG(redGeos, new THREE.CylinderGeometry(1.48, 1.38, 0.22, 20), 0, galY + 2.42, 0);
    pushG(
      redGeos,
      new THREE.SphereGeometry(1.42, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      0,
      galY + 2.48,
      0
    );
    pushG(brassGeos, new THREE.SphereGeometry(0.24, 12, 10), 0, galY + 3.98, 0);
    pushG(brassGeos, new THREE.CylinderGeometry(0.025, 0.035, 0.95, 6), 0, galY + 4.45, 0);
    pushG(brassGeos, new THREE.BoxGeometry(0.68, 0.12, 0.03), 0.12, galY + 4.68, 0, 0, 0.35, 0);

    const lhGroup = new THREE.Group();
    lhGroup.name = 'HeadlandLighthouseOverlook';

    const attach = (list: THREE.BufferGeometry[], mat: THREE.Material, name: string, shadow = true) => {
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        const m = new THREE.Mesh(merged, mat);
        m.name = name;
        m.castShadow = shadow;
        m.receiveShadow = shadow;
        lhGroup.add(m);
      }
    };

    attach(stoneGeos, stoneMat, 'LighthouseTowerStone');
    attach(redGeos, cupolaRedMat, 'LighthouseRedCupola');
    attach(ironGeos, ironMat, 'LighthouseGalleryIron');
    attach(brassGeos, brassMat, 'LighthouseBrassTrim');
    attach(woodGeos, doorWoodMat, 'LighthouseKeeperDoor');
    attach(glowGeos, beaconGlowMat, 'LighthouseWarmBeacon', false);
    attach(glassGeos, glassMat, 'LighthouseLanternGlass', false);

    const beaconLight = new THREE.PointLight('#ffe494', 2.4, 28.0);
    beaconLight.position.set(lx, baseY + galY + 1.5, lz);
    lhGroup.add(beaconLight);

    this.scene.add(lhGroup);
  }

  /**
   * Builds a terraced hillside brook (rill) with stepped stone weirs and a weathered
   * Stone Arch Footbridge (voussoirs, keystone, cobblestone deck & parapet walls) at z = 2.5.
   */
  private buildHillsideRillAndStoneBridge(pbr: PbrSceneAssets, sunDir: THREE.Vector3): void {
    const getRillX = getGhibliRillCenterX;

    const stoneMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.stoneMasonry.map,
        normalMap: pbr.stoneMasonry.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: pbr.stoneMasonry.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.stoneMasonry.aoMap,
        aoMapIntensity: 0.90
      }),
      {
        macroScale: 0.25,
        mossHeight: 4.8,
        mossColor: '#3c6228',
        dampRoughness: 0.28,
        dirtTint: '#483e30'
      }
    );
    const cobbleMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.cobblestone.map,
        normalMap: pbr.cobblestone.normalMap,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: pbr.cobblestone.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.cobblestone.aoMap
      }),
      {
        macroScale: 0.26,
        mossHeight: 4.5,
        mossColor: '#3f632a',
        dampRoughness: 0.34,
        dirtTint: '#524432'
      }
    );
    const lanternGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe296') });

    const group = new THREE.Group();
    group.name = 'HillsideRillAndStoneArchBridge';

    // 1. Shimmering Terraced Hillside Brook Ribbon sitting inside the sculpted channel (z = 26.0 down to z = -22.0)
    {
      const zStart = 26.0;
      const zEnd = -22.0;
      const segs = 72;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const z = zStart + (zEnd - zStart) * t;
        const cx = getRillX(z);
        const halfW = 1.06 + Math.sin(z * 0.45) * 0.09;
        const centerY = getGhibliValleyHeight(cx, z) + 0.27;
        for (const side of [-1, 1]) {
          const wx = cx + side * halfW;
          positions.push(wx, centerY, z);
          uvs.push(side * 0.5 + 0.5, t * 14.0);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
      const streamGeo = new THREE.BufferGeometry();
      streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      streamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      streamGeo.setIndex(indices);
      streamGeo.computeVertexNormals();
      this.brookMaterial = createGhibliHillsideBrookMaterial(sunDir);
      const streamMesh = new THREE.Mesh(streamGeo, this.brookMaterial);
      streamMesh.name = 'HillsideTerracedRillWater';
      group.add(streamMesh);
    }

    const stoneParts: THREE.BufferGeometry[] = [];
    const cobbleParts: THREE.BufferGeometry[] = [];
    const glowParts: THREE.BufferGeometry[] = [];

    // Mossy brook-bank boulders hugging the recessed rill channel
    const rand = mulberry32(4177);
    for (let z = -21.0; z <= 25.0; z += 1.05) {
      if (Math.abs(z - 2.5) < 1.9) continue;
      const cx = getRillX(z);
      for (const side of [-1, 1]) {
        const bx = cx + side * (1.06 + rand() * 0.24);
        const bz = z + (rand() - 0.5) * 0.32;
        const by = getGhibliValleyHeight(bx, bz) + 0.06;
        const g = createSculptedGraniteBoulderGeometry(19.1 + side * 3, 0.36 + rand() * 0.16, 0.24 + rand() * 0.12, 0.34 + rand() * 0.16, 2);
        g.rotateY(rand() * Math.PI * 2);
        g.translate(bx, by, bz);
        stoneParts.push(prepareForMerge(g));
        g.dispose();
      }
    }

    // 2. Weathered Stone Arch Footbridge spanning the rill at z = 2.5
    const bz = 2.5;
    const bx = getRillX(bz);
    const by = getGhibliValleyHeight(bx, bz) + 0.24;
    const bridgeRot = 0.22;
    this.exclusionCircles.push({ x: bx, z: bz, r: 3.6 });
    this.contactAoSpots.push({ x: bx, z: bz, rx: 3.4, rz: 2.2, rotY: bridgeRot, strength: 0.50 });

    const bMat = new THREE.Matrix4().compose(
      new THREE.Vector3(bx, by, bz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, bridgeRot, 0)),
      new THREE.Vector3(1, 1, 1)
    );

    const addBridgePart = (
      list: THREE.BufferGeometry[],
      geo: THREE.BufferGeometry,
      lx: number,
      ly: number,
      lz: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(lx, ly, lz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
        new THREE.Vector3(1, 1, 1)
      );
      const worldM = new THREE.Matrix4().multiplyMatrices(bMat, m);
      list.push(prepareForMerge(geo, worldM));
      geo.dispose();
    };

    const spanW = 4.6;
    const deckD = 2.2;
    const archR = 1.45;

    // Abutment piers tucked cleanly beneath the cobblestone entrance ramps (top at +0.34 < ramp 0.36)
    addBridgePart(stoneParts, scaleGeometryUvs(new THREE.BoxGeometry(1.15, 1.15, deckD + 0.24), 1.2, 1.2), -spanW * 0.40, -0.22, 0);
    addBridgePart(stoneParts, scaleGeometryUvs(new THREE.BoxGeometry(1.15, 1.15, deckD + 0.24), 1.2, 1.2), spanW * 0.40, -0.22, 0);
    // Open stone approach steps leading onto both ends of the footbridge deck
    for (const endSign of [-1, 1]) {
      for (let st = 0; st < 3; st++) {
        addBridgePart(
          cobbleParts,
          scaleGeometryUvs(new THREE.BoxGeometry(0.42, 0.16, deckD - 0.30), 0.5, 1.0),
          endSign * (spanW * 0.5 + 0.18 + st * 0.34),
          0.26 - st * 0.11,
          0
        );
      }
    }

    // Radiating stone arch voussoirs & central keystone + arch barrel soffit
    const voussoirs = 13;
    for (let v = 0; v < voussoirs; v++) {
      const ang = -Math.PI * 0.44 + (v / (voussoirs - 1)) * Math.PI * 0.88;
      const vx = Math.sin(ang) * archR;
      const vy = Math.cos(ang) * archR * 0.68 + 0.05;
      const isKeystone = v === Math.floor(voussoirs / 2);
      const vh = isKeystone ? 0.40 : 0.30;
      const vw = isKeystone ? 0.30 : 0.26;
      addBridgePart(stoneParts, new THREE.BoxGeometry(vw, vh, deckD + (isKeystone ? 0.18 : 0.08)), vx, vy, 0, 0, 0, -ang);
    }

    // Humped cobblestone deck & approach ramps + low stone parapet walls with coping & end bollards
    const deckSegs = 12;
    for (let s = 0; s < deckSegs; s++) {
      const t0 = s / deckSegs - 0.5;
      const t1 = (s + 1) / deckSegs - 0.5;
      const tm = (t0 + t1) * 0.5;
      const segX = tm * spanW;
      const hump0 = Math.cos(t0 * Math.PI) * 0.62;
      const hump1 = Math.cos(t1 * Math.PI) * 0.62;
      const segY = (hump0 + hump1) * 0.5 + 0.36;
      const slopeZ = Math.atan2(hump1 - hump0, spanW / deckSegs);
      const segLen = Math.hypot(spanW / deckSegs, hump1 - hump0) + 0.04;

      addBridgePart(cobbleParts, scaleGeometryUvs(new THREE.BoxGeometry(segLen, 0.18, deckD - 0.28), 0.6, 1.2), segX, segY, 0, 0, 0, slopeZ);
      for (const sideZ of [-deckD * 0.5 + 0.14, deckD * 0.5 - 0.14]) {
        addBridgePart(stoneParts, scaleGeometryUvs(new THREE.BoxGeometry(segLen, 0.62, 0.26), 0.6, 0.6), segX, segY + 0.32, sideZ, 0, 0, slopeZ);
        addBridgePart(stoneParts, new THREE.BoxGeometry(segLen + 0.03, 0.10, 0.34), segX, segY + 0.66, sideZ, 0, 0, slopeZ);
      }
    }

    // 4 Corner stone piers with warm lantern caps
    for (const endX of [-spanW * 0.5, spanW * 0.5]) {
      for (const sideZ of [-deckD * 0.5 + 0.14, deckD * 0.5 - 0.14]) {
        addBridgePart(stoneParts, new THREE.BoxGeometry(0.44, 0.96, 0.44), endX, 0.48, sideZ);
        addBridgePart(stoneParts, new THREE.BoxGeometry(0.54, 0.12, 0.54), endX, 0.98, sideZ);
        addBridgePart(glowParts, new THREE.BoxGeometry(0.22, 0.24, 0.22), endX, 1.14, sideZ);
        addBridgePart(stoneParts, new THREE.ConeGeometry(0.28, 0.20, 4), endX, 1.34, sideZ, 0, Math.PI * 0.25, 0);
      }
    }

    const attachMerged = (list: THREE.BufferGeometry[], mat: THREE.Material, name: string, shadow = true) => {
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        const m = new THREE.Mesh(merged, mat);
        m.name = name;
        m.castShadow = shadow;
        m.receiveShadow = shadow;
        group.add(m);
      }
    };

    attachMerged(stoneParts, stoneMat, 'StoneArchBridgeMasonry');
    attachMerged(cobbleParts, cobbleMat, 'StoneArchBridgeCobbleDeck');
    attachMerged(glowParts, lanternGlowMat, 'StoneArchBridgeLanterns', false);

    this.scene.add(group);
  }

  /**
   * Builds weathered wooden telegraph poles with double cross-arms, ceramic insulators,
   * gooseneck streetlamps, and sagging catenary overhead wires along the cobblestone hillside road.
   */
  private buildTelegraphPolesAndWires(pbr: PbrSceneAssets): void {
    const woodMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.timberWood.map,
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: pbr.timberWood.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.timberWood.aoMap
      }),
      {
        macroScale: 0.30,
        mossHeight: 2.2,
        mossColor: '#3d5b28',
        dampRoughness: 0.42,
        dirtTint: '#3b2b1d'
      }
    );
    const wireIronMat = new THREE.MeshStandardMaterial({
      color: '#232830',
      roughness: 0.48,
      metalness: 0.58
    });
    const insulatorMat = new THREE.MeshStandardMaterial({
      color: '#dceef2',
      roughness: 0.22,
      metalness: 0.10
    });
    const lampGlowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffe599')
    });

    const woodParts: THREE.BufferGeometry[] = [];
    const ironParts: THREE.BufferGeometry[] = [];
    const insulatorParts: THREE.BufferGeometry[] = [];
    const glowParts: THREE.BufferGeometry[] = [];

    const poleZs = [-25.0, -15.0, -5.0, 5.0, 18.5, 28.5, 38.5, 50.0, 62.0, 74.0, 86.0];
    const poleTops: Array<{ x: number; y: number; z: number; yaw: number }> = [];

    for (let i = 0; i < poleZs.length; i++) {
      const pz = poleZs[i];
      const roadX = getGhibliRoadCenterX(pz);
      const nextRoadX = getGhibliRoadCenterX(pz + 1.0);
      const roadYaw = Math.atan2(nextRoadX - roadX, 1.0);
      // Relocate the front-most & uphill poles (pz >= 5) onto the right (+X) cobblestone shoulder
      // so the central bay vista stays completely unobscured while wires trail cleanly into the village (-X).
      const shoulderSide = pz >= 5.0 ? 1 : -1;
      const px = roadX + shoulderSide * 2.85;
      const py = getGhibliValleyHeight(px, pz) - 0.15;
      const poleH = 5.4;

      this.contactAoSpots.push({ x: px, z: pz, rx: 0.48, rz: 0.48, rotY: 0, strength: 0.42 });
      poleTops.push({ x: px, y: py + poleH, z: pz, yaw: roadYaw });

      const pMat = new THREE.Matrix4().compose(
        new THREE.Vector3(px, py, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, roadYaw, 0)),
        new THREE.Vector3(1, 1, 1)
      );

      const addP = (
        list: THREE.BufferGeometry[],
        geo: THREE.BufferGeometry,
        lx: number,
        ly: number,
        lz: number,
        rx = 0,
        ry = 0,
        rz = 0
      ) => {
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, ly, lz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
          new THREE.Vector3(1, 1, 1)
        );
        const wM = new THREE.Matrix4().multiplyMatrices(pMat, m);
        list.push(prepareForMerge(geo, wM));
        geo.dispose();
      };

      // Tapered timber mast + galvanized iron base collar
      addP(woodParts, new THREE.CylinderGeometry(0.085, 0.135, poleH, 8), 0, poleH * 0.5, 0);
      addP(ironParts, new THREE.CylinderGeometry(0.142, 0.148, 0.45, 8), 0, 0.28, 0);

      // Upper & lower wooden cross-arms + diagonal iron braces + porcelain insulators
      for (const armY of [poleH - 0.35, poleH - 0.92]) {
        const armW = armY > poleH - 0.5 ? 1.48 : 1.18;
        addP(woodParts, new THREE.BoxGeometry(armW, 0.09, 0.09), 0, armY, 0);
        addP(ironParts, new THREE.BoxGeometry(0.46, 0.03, 0.03), -0.22, armY - 0.18, 0.05, 0, 0, 0.68);
        addP(ironParts, new THREE.BoxGeometry(0.46, 0.03, 0.03), 0.22, armY - 0.18, 0.05, 0, 0, -0.68);

        for (const ix of [-armW * 0.42, 0, armW * 0.42]) {
          if (ix === 0 && armY < poleH - 0.5) continue;
          addP(insulatorParts, new THREE.CylinderGeometry(0.038, 0.048, 0.11, 8), ix, armY + 0.09, 0);
        }
      }

      // Vintage gooseneck road lamp on alternating poles overhanging the cobblestone path
      if (i % 2 === 0) {
        const lampDir = shoulderSide > 0 ? -1 : 1;
        addP(ironParts, new THREE.BoxGeometry(0.68, 0.035, 0.035), lampDir * 0.34, poleH - 1.55, 0, 0, 0, lampDir * 0.18);
        addP(ironParts, new THREE.CylinderGeometry(0.18, 0.06, 0.10, 8), lampDir * 0.66, poleH - 1.52, 0);
        addP(glowParts, new THREE.SphereGeometry(0.085, 8, 6), lampDir * 0.66, poleH - 1.60, 0);
      }
    }

    // Sagging catenary overhead wires spanning pole-to-pole
    const wireOffsets: Array<[number, number]> = [
      [-0.60, -0.26],
      [0.60, -0.26],
      [-0.48, -0.83]
    ];
    for (let i = 0; i < poleTops.length - 1; i++) {
      const pA = poleTops[i];
      const pB = poleTops[i + 1];
      for (const [ox, oy] of wireOffsets) {
        const start = new THREE.Vector3(
          pA.x + Math.cos(pA.yaw) * ox,
          pA.y + oy,
          pA.z - Math.sin(pA.yaw) * ox
        );
        const end = new THREE.Vector3(
          pB.x + Math.cos(pB.yaw) * ox,
          pB.y + oy,
          pB.z - Math.sin(pB.yaw) * ox
        );
        const mid = start.clone().lerp(end, 0.5);
        mid.y -= 0.44;
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const wireGeo = new THREE.TubeGeometry(curve, 12, 0.015, 4, false);
        ironParts.push(prepareForMerge(wireGeo));
        wireGeo.dispose();
      }
    }

    const group = new THREE.Group();
    group.name = 'GhibliTelegraphPolesAndWires';

    const attach = (list: THREE.BufferGeometry[], mat: THREE.Material, name: string, shadow = true) => {
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        const m = new THREE.Mesh(merged, mat);
        m.name = name;
        m.castShadow = shadow;
        m.receiveShadow = shadow;
        group.add(m);
      }
    };

    attach(woodParts, woodMat, 'TelegraphPoleTimber');
    attach(ironParts, wireIronMat, 'TelegraphCatenaryWires');
    attach(insulatorParts, insulatorMat, 'TelegraphCeramicInsulators', false);
    attach(glowParts, lampGlowMat, 'TelegraphStreetlampBulbs', false);

    this.scene.add(group);
  }

  /**
   * Builds a photorealistic 3-car vintage Ghibli Coastal Sea Train with:
   * - Rounded clerestory monitor roof, slatted ventilation louvers, ventilator cowls & diamond pantograph
   * - Deeply recessed dark reflective glass windows (metalness: 0.85, roughness: 0.12)
   * - Warm interior passenger compartment glow, draped amber curtains & 3D wooden/brass mullions
   * - Riveted steel underframe, detailed 2-axle suspension bogies, flanged wheels & brass headlamps
   * - Weathered painted crimson-and-ivory livery (applyWorldSpaceWeathering)
   */
  private buildCoastalSeaTrain(pbr: PbrSceneAssets): void {
    const pts: THREE.Vector3[] = [];
    for (let x = -110; x <= 220; x += 10) {
      pts.push(new THREE.Vector3(x, 0.72, getCoastlineZ(x) - 7.2));
    }
    this.seaTrainCurve = new THREE.CatmullRomCurve3(pts);

    const crimsonMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.creamPlaster.map,
        color: '#9e2b27',
        normalMap: pbr.creamPlaster.normalMap,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughnessMap: pbr.creamPlaster.roughnessMap,
        roughness: 0.42,
        metalness: 0.18
      }),
      {
        macroScale: 0.36,
        mossHeight: -10.0,
        dampRoughness: 0.28,
        dirtTint: '#3a1816'
      }
    );
    const creamMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.creamPlaster.map,
        color: '#efe5d0',
        normalMap: pbr.creamPlaster.normalMap,
        normalScale: new THREE.Vector2(0.48, 0.48),
        roughnessMap: pbr.creamPlaster.roughnessMap,
        roughness: 0.52,
        metalness: 0.06
      }),
      {
        macroScale: 0.36,
        mossHeight: -10.0,
        dampRoughness: 0.36,
        dirtTint: '#5e5040'
      }
    );
    const roofMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: '#5a656d',
        normalMap: pbr.creamPlaster.normalMap,
        normalScale: new THREE.Vector2(0.32, 0.32),
        roughnessMap: pbr.creamPlaster.roughnessMap,
        roughness: 0.58,
        metalness: 0.34
      }),
      {
        macroScale: 0.34,
        mossHeight: -10.0,
        dampRoughness: 0.42,
        dirtTint: '#2b3136'
      }
    );
    const darkTrimMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: '#222830',
        normalMap: pbr.creamPlaster.normalMap,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.44,
        metalness: 0.64
      }),
      {
        macroScale: 0.40,
        mossHeight: -10.0,
        dampRoughness: 0.30,
        dirtTint: '#181c22'
      }
    );
    const woodTrimMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.timberWood.map,
        color: '#6e4226',
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.48,
        metalness: 0.08
      }),
      {
        macroScale: 0.38,
        mossHeight: -10.0,
        dampRoughness: 0.38,
        dirtTint: '#362012'
      }
    );
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#dfb04a',
      roughness: 0.24,
      metalness: 0.80
    });
    // Recessed dark reflective glass windows (crisp sky/bay reflections over warm glowing passenger cabin)
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#0b1824',
      roughness: 0.08,
      metalness: 0.86,
      envMapIntensity: 2.15,
      transparent: true,
      opacity: 0.54
    });
    // Dark interior passenger compartment backdrop + warm amber curtain/lamp glow
    const interiorDarkMat = new THREE.MeshStandardMaterial({
      color: '#1e1510',
      roughness: 0.90
    });
    const interiorGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffe0a3',
      emissive: new THREE.Color('#ff9d2e'),
      emissiveIntensity: 1.45,
      roughness: 0.40
    });
    this.trainWindowGlowMat = interiorGlowMat;
    const headlampLensMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff4c2')
    });

    const trainRoot = new THREE.Group();
    trainRoot.name = 'GhibliCoastalTrain';

    const buildMergedCarParts = (
      parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; key: string }>,
      carGroup: THREE.Group,
      prefix: string
    ) => {
      const byKey = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
      for (const p of parts) {
        let entry = byKey.get(p.key);
        if (!entry) {
          entry = { mat: p.mat, geos: [] };
          byKey.set(p.key, entry);
        }
        entry.geos.push(prepareForMerge(p.geo));
        p.geo.dispose();
      }
      for (const [k, entry] of byKey.entries()) {
        const merged = mergeGeometries(entry.geos, false);
        entry.geos.forEach((g) => g.dispose());
        if (merged) {
          const mesh = new THREE.Mesh(merged, entry.mat);
          mesh.name = `${prefix}_${k}`;
          mesh.castShadow = k !== 'glow' && k !== 'lens';
          mesh.receiveShadow = k !== 'glow' && k !== 'lens';
          mesh.frustumCulled = false;
          carGroup.add(mesh);
        }
      }
    };

    const carCount = 4;
    for (let c = 0; c < carCount; c++) {
      const car = new THREE.Group();
      car.name = `SeaTrainCoach_${c + 1}`;
      const len = c === 0 ? 6.1 : 5.7;
      const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; key: string }> = [];

      const addP = (
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        key: string,
        x: number,
        y: number,
        z: number,
        rx = 0,
        ry = 0,
        rz = 0
      ) => {
        if (rx !== 0) geo.rotateX(rx);
        if (ry !== 0) geo.rotateY(ry);
        if (rz !== 0) geo.rotateZ(rz);
        geo.translate(x, y, z);
        parts.push({ geo, mat, key });
      };

      // 1. Riveted Steel Underframe, Buffer Beams, Battery/Brake Cylinders & Detailed 2-Axle Wheel Bogies
      addP(new THREE.BoxGeometry(1.86, 0.24, len), darkTrimMat, 'dark', 0, 0.42, 0);
      addP(new THREE.BoxGeometry(1.94, 0.08, len + 0.04), darkTrimMat, 'dark', 0, 0.54, 0);
      // End buffer beams & couplers
      for (const endSign of [-1, 1]) {
        const ez = endSign * (len * 0.5 + 0.03);
        addP(new THREE.BoxGeometry(1.92, 0.26, 0.10), darkTrimMat, 'dark', 0, 0.42, ez);
        for (const bx of [-0.64, 0.64]) {
          addP(new THREE.CylinderGeometry(0.08, 0.10, 0.16, 8), darkTrimMat, 'dark', bx, 0.42, ez + endSign * 0.08, Math.PI / 2);
          addP(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10), brassMat, 'brass', bx, 0.42, ez + endSign * 0.16, Math.PI / 2);
        }
      }
      // Under-slung air-brake reservoir tank & battery box
      addP(new THREE.CylinderGeometry(0.16, 0.16, 1.05, 10), darkTrimMat, 'dark', -0.42, 0.26, -0.35, Math.PI / 2);
      addP(new THREE.BoxGeometry(0.58, 0.24, 0.88), darkTrimMat, 'dark', 0.38, 0.27, 0.35);

      // 2 Detailed 2-Axle Railway Bogies per coach
      for (const bogieZ of [-len * 0.30, len * 0.30]) {
        addP(new THREE.BoxGeometry(1.62, 0.14, 1.38), darkTrimMat, 'dark', 0, 0.30, bogieZ);
        for (const side of [-1, 1]) {
          const sx = side * 0.78;
          // Bogie side equalizer frame + central bolster coil springs
          addP(new THREE.BoxGeometry(0.08, 0.16, 1.46), darkTrimMat, 'dark', sx, 0.28, bogieZ);
          addP(new THREE.CylinderGeometry(0.065, 0.065, 0.20, 8), brassMat, 'brass', sx * 0.96, 0.28, bogieZ - 0.10);
          addP(new THREE.CylinderGeometry(0.065, 0.065, 0.20, 8), brassMat, 'brass', sx * 0.96, 0.28, bogieZ + 0.10);
          for (const axleOff of [-0.48, 0.48]) {
            const wz = bogieZ + axleOff;
            // Flanged steel wheel + inner flange + outer axle journal box
            addP(new THREE.CylinderGeometry(0.28, 0.28, 0.11, 14), darkTrimMat, 'dark', side * 0.68, 0.24, wz, 0, 0, Math.PI / 2);
            addP(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 14), darkTrimMat, 'dark', side * 0.62, 0.24, wz, 0, 0, Math.PI / 2);
            addP(new THREE.BoxGeometry(0.12, 0.18, 0.18), darkTrimMat, 'dark', side * 0.84, 0.25, wz);
          }
        }
      }

      // 2. Lower Crimson Waist Paneling with Vertical Rib Pilasters, Belt Rail & Brass Waist Stripe
      const bodyLen = len - 0.14;
      addP(new THREE.BoxGeometry(1.90, 0.78, bodyLen), crimsonMat, 'crimson', 0, 0.94, 0);
      addP(new THREE.BoxGeometry(1.95, 0.09, bodyLen + 0.04), crimsonMat, 'crimson', 0, 1.34, 0);
      addP(new THREE.BoxGeometry(1.96, 0.04, bodyLen + 0.05), brassMat, 'brass', 0, 1.28, 0);

      // Vertical riveted paneling pilasters along the crimson lower hull
      const winCount = 5;
      const winBaySpan = (bodyLen - 0.96) / winCount;
      for (let p = 0; p <= winCount; p++) {
        const pz = -winCount * 0.5 * winBaySpan + p * winBaySpan;
        addP(new THREE.BoxGeometry(1.93, 0.76, 0.06), crimsonMat, 'crimson', 0, 0.94, pz);
      }

      // 3. Upper Cream Window Tier with True Recessed Dark Reflective Glass, 3D Mullions & Warm Interior Glow
      // Continuous upper letterboard frieze above windows
      addP(new THREE.BoxGeometry(1.90, 0.20, bodyLen), creamMat, 'cream', 0, 2.02, 0);
      addP(new THREE.BoxGeometry(1.94, 0.05, bodyLen + 0.04), woodTrimMat, 'wood', 0, 1.92, 0);

      // End vestibule corner bulkheads & recessed vestibule doors with boarding steps
      for (const endSign of [-1, 1]) {
        const cornerZ = endSign * (bodyLen * 0.5 - 0.24);
        addP(new THREE.BoxGeometry(1.90, 0.58, 0.48), creamMat, 'cream', 0, 1.63, cornerZ);
        // Vestibule door recessed in corner bay + upper door glass + brass grab rails + steel step
        addP(new THREE.BoxGeometry(1.82, 1.24, 0.34), woodTrimMat, 'wood', 0, 1.22, cornerZ);
        addP(new THREE.BoxGeometry(1.85, 0.46, 0.22), glassMat, 'glass', 0, 1.62, cornerZ);
        addP(new THREE.BoxGeometry(1.98, 0.05, 0.36), darkTrimMat, 'dark', 0, 0.34, cornerZ);
      }

      // Recessed dark reflective glass sheet (x = ±0.86, recessed 4cm inside outer cream pillars at x = ±0.95)
      addP(new THREE.BoxGeometry(1.72, 0.56, bodyLen - 0.92), glassMat, 'glass', 0, 1.63, 0);
      // Dark interior compartment depth core + warm ceiling lamp strip behind the glass
      addP(new THREE.BoxGeometry(1.44, 0.48, bodyLen - 1.02), interiorDarkMat, 'interiorDark', 0, 1.62, 0);
      addP(new THREE.BoxGeometry(0.45, 0.12, bodyLen - 1.15), interiorGlowMat, 'glow', 0, 1.82, 0);

      // Outer cream window pillars, 3D mahogany casement frames, arched transom bar, center mullion & draped interior curtains
      for (let w = 0; w <= winCount; w++) {
        const pillarZ = -winCount * 0.5 * winBaySpan + w * winBaySpan;
        addP(new THREE.BoxGeometry(1.90, 0.58, 0.15), creamMat, 'cream', 0, 1.63, pillarZ);
        if (w < winCount) {
          const wz = pillarZ + winBaySpan * 0.5;
          const winOpenW = winBaySpan - 0.15;
          // Projecting mahogany window sill & top transom bar
          addP(new THREE.BoxGeometry(1.95, 0.05, winOpenW + 0.06), woodTrimMat, 'wood', 0, 1.37, wz);
          addP(new THREE.BoxGeometry(1.80, 0.035, winOpenW), woodTrimMat, 'wood', 0, 1.76, wz);
          // Center vertical mullion bar + brass sash latch
          addP(new THREE.BoxGeometry(1.78, 0.54, 0.035), woodTrimMat, 'wood', 0, 1.63, wz);
          // Warm interior draped side curtains & passenger seat back silhouettes just inside the glass (x = ±0.81)
          addP(new THREE.BoxGeometry(1.62, 0.50, 0.11), interiorGlowMat, 'glow', 0, 1.63, wz - winOpenW * 0.34);
          addP(new THREE.BoxGeometry(1.62, 0.50, 0.11), interiorGlowMat, 'glow', 0, 1.63, wz + winOpenW * 0.34);
          addP(new THREE.BoxGeometry(1.58, 0.24, 0.10), woodTrimMat, 'wood', 0, 1.46, wz);
        }
      }

      // 4. Rounded Clerestory Roof with Ventilation Louvers, Cowls & Diamond Rooftop Pantograph
      // Cambered lower roof deck with rain-gutter eaves
      addP(
        new THREE.CylinderGeometry(0.98, 0.98, bodyLen + 0.12, 16, 1, false, 0, Math.PI),
        roofMat,
        'roof',
        0,
        2.08,
        0,
        Math.PI / 2,
        0,
        Math.PI / 2
      );
      addP(new THREE.BoxGeometry(2.00, 0.06, bodyLen + 0.14), darkTrimMat, 'dark', 0, 2.11, 0);

      // Raised Clerestory Monitor Roof Deck + Clerestory Transom Glass + Slatted Brass/Steel Ventilation Louvers
      const clereLen = bodyLen * 0.78;
      addP(new THREE.BoxGeometry(1.04, 0.24, clereLen), darkTrimMat, 'dark', 0, 2.96, 0);
      addP(new THREE.BoxGeometry(0.98, 0.16, clereLen - 0.16), glassMat, 'glass', 0, 2.97, 0);
      addP(new THREE.BoxGeometry(0.84, 0.12, clereLen - 0.24), interiorGlowMat, 'glow', 0, 2.96, 0);
      addP(
        new THREE.CylinderGeometry(0.55, 0.55, clereLen + 0.14, 12, 1, false, 0, Math.PI),
        roofMat,
        'roof',
        0,
        3.04,
        0,
        Math.PI / 2,
        0,
        Math.PI / 2
      );
      for (let lz = -clereLen * 0.42; lz <= clereLen * 0.42 + 0.01; lz += 0.52) {
        addP(new THREE.BoxGeometry(1.08, 0.18, 0.06), brassMat, 'brass', 0, 2.97, lz);
        addP(new THREE.BoxGeometry(1.07, 0.03, 0.36), darkTrimMat, 'dark', 0, 3.01, lz);
        addP(new THREE.BoxGeometry(1.07, 0.03, 0.36), darkTrimMat, 'dark', 0, 2.94, lz);
      }
      // Rooftop torpedo ventilator cowls
      for (const vz of [-clereLen * 0.32, 0, clereLen * 0.32]) {
        addP(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8), darkTrimMat, 'dark', 0, 3.62, vz);
        addP(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 8), darkTrimMat, 'dark', 0, 3.70, vz);
      }

      // Accordion gangway bellows connecting coaches
      if (c < carCount - 1) {
        addP(new THREE.BoxGeometry(1.24, 1.56, 0.26), darkTrimMat, 'dark', 0, 1.32, -len * 0.5 - 0.08);
      }

      // 5. Front & Rear Driver Cab Windshields, Cowcatcher Pilot, Brass Headlamps & Diamond Pantograph
      if (c === 0 || c === carCount - 1) {
        const dirSign = c === 0 ? 1 : -1;
        const fz = dirSign * (bodyLen * 0.5 + 0.01);
        // 3-Pane Recessed Driver Cab Windshield + Brass Frame & Wipers + Warm Cab Glow
        addP(new THREE.BoxGeometry(1.52, 0.54, 0.08), woodTrimMat, 'wood', 0, 1.64, fz - dirSign * 0.02);
        addP(new THREE.BoxGeometry(1.42, 0.46, 0.06), glassMat, 'glass', 0, 1.64, fz);
        addP(new THREE.BoxGeometry(1.28, 0.40, 0.06), interiorGlowMat, 'glow', 0, 1.64, fz - dirSign * 0.04);
        addP(new THREE.BoxGeometry(0.05, 0.50, 0.09), brassMat, 'brass', -0.44, 1.64, fz + dirSign * 0.01);
        addP(new THREE.BoxGeometry(0.05, 0.50, 0.09), brassMat, 'brass', 0.44, 1.64, fz + dirSign * 0.01);

        // Central Brass Headlamp with Flared Bezel & Glowing Emissive Lens + Twin Brass Marker Lamps
        addP(new THREE.CylinderGeometry(0.20, 0.24, 0.24, 14), brassMat, 'brass', 0, 1.02, fz + dirSign * 0.10, Math.PI / 2);
        addP(new THREE.SphereGeometry(0.16, 12, 10), headlampLensMat, 'lens', 0, 1.02, fz + dirSign * 0.18);
        for (const mx of [-0.66, 0.66]) {
          addP(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 10), brassMat, 'brass', mx, 0.78, fz + dirSign * 0.06, Math.PI / 2);
          addP(new THREE.SphereGeometry(0.065, 8, 8), headlampLensMat, 'lens', mx, 0.78, fz + dirSign * 0.11);
        }

        // Illuminated Destination Roll-Sign Box above the cab windshield
        addP(new THREE.BoxGeometry(0.92, 0.18, 0.12), darkTrimMat, 'dark', 0, 2.02, fz + dirSign * 0.03);
        addP(new THREE.BoxGeometry(0.82, 0.12, 0.14), headlampLensMat, 'lens', 0, 2.02, fz + dirSign * 0.03);

        // Slatted steel cowcatcher / pilot grille beneath the front buffer beam
        addP(new THREE.BoxGeometry(1.68, 0.22, 0.18), darkTrimMat, 'dark', 0, 0.22, fz + dirSign * 0.10, dirSign * 0.35, 0, 0);

        // Detailed Diamond-Frame Rooftop Pantograph
        const pantoZ = -dirSign * 0.65;
        addP(new THREE.BoxGeometry(1.12, 0.07, 0.92), darkTrimMat, 'dark', 0, 3.60, pantoZ);
        for (const ix of [-0.46, 0.46]) {
          for (const iz of [-0.36, 0.36]) {
            addP(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 8), creamMat, 'cream', ix, 3.68, pantoZ + iz);
          }
          // Lower & upper diamond scissor arms
          addP(new THREE.BoxGeometry(0.04, 0.56, 0.04), darkTrimMat, 'dark', ix, 3.92, pantoZ - 0.18, 0.52, 0, 0);
          addP(new THREE.BoxGeometry(0.04, 0.56, 0.04), darkTrimMat, 'dark', ix, 3.92, pantoZ + 0.18, -0.52, 0, 0);
          addP(new THREE.BoxGeometry(0.035, 0.54, 0.035), darkTrimMat, 'dark', ix, 4.34, pantoZ - 0.18, -0.52, 0, 0);
          addP(new THREE.BoxGeometry(0.035, 0.54, 0.035), darkTrimMat, 'dark', ix, 4.34, pantoZ + 0.18, 0.52, 0, 0);
        }
        // Pantograph knee crossbar & top brass contact collector bow
        addP(new THREE.BoxGeometry(0.98, 0.04, 0.04), darkTrimMat, 'dark', 0, 4.14, pantoZ - 0.36);
        addP(new THREE.BoxGeometry(0.98, 0.04, 0.04), darkTrimMat, 'dark', 0, 4.14, pantoZ + 0.36);
        addP(new THREE.BoxGeometry(1.36, 0.05, 0.14), brassMat, 'brass', 0, 4.58, pantoZ);

        // Lead Vintage Locomotive Brass-Trimmed Smokestack Chimney & Steam Dome (emits steam puffs)
        if (c === 0) {
          addP(new THREE.CylinderGeometry(0.16, 0.13, 0.66, 12), darkTrimMat, 'dark', 0, 3.48, 1.55);
          addP(new THREE.CylinderGeometry(0.22, 0.17, 0.12, 12), brassMat, 'brass', 0, 3.82, 1.55);
          addP(new THREE.SphereGeometry(0.26, 12, 8), brassMat, 'brass', 0, 3.24, 0.62);
          addP(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), brassMat, 'brass', 0.24, 3.45, 0.62);
        }
      }

      buildMergedCarParts(parts, car, `SeaTrainCar_${c + 1}`);
      this.seaTrainCars.push(car);
      trainRoot.add(car);
    }

    // Animated Chimney Steam Puffs (InstancedMesh ring buffer trailing in the coastal breeze)
    const puffCount = 42;
    const puffGeo = new THREE.IcosahedronGeometry(0.32, 1);
    this.trainSmokeMaterial = new THREE.MeshStandardMaterial({
      color: '#fbf9f4',
      emissive: new THREE.Color('#e6edf5'),
      emissiveIntensity: 0.22,
      roughness: 0.94,
      metalness: 0.0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    this.trainSmokeMesh = new THREE.InstancedMesh(puffGeo, this.trainSmokeMaterial, puffCount);
    this.trainSmokeMesh.name = 'GhibliTrainSteamPuffs';
    this.trainSmokeMesh.frustumCulled = false;
    this.trainSmokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.trainSmokePuffs = [];
    for (let i = 0; i < puffCount; i++) {
      this.trainSmokePuffs.push({
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 99,
        maxAge: 3.8,
        scale: 0.001
      });
    }
    trainRoot.add(this.trainSmokeMesh);

    this.scene.add(trainRoot);
    this.updateSeaTrain(0, 0);
  }

  private updateSeaTrain(elapsedTime: number, deltaTime = 0): void {
    if (!this.seaTrainCurve || this.seaTrainCars.length === 0) return;

    const speed = 0.016;
    const headU = 0.05 + ((elapsedTime * speed + 0.285) % 0.90);
    const carSpacingU = 0.0195;

    for (let i = 0; i < this.seaTrainCars.length; i++) {
      const car = this.seaTrainCars[i];
      const u = Math.max(0.004, Math.min(0.996, headU - i * carSpacingU));
      this.seaTrainCurve.getPointAt(u, this.tmpTrainPos);
      this.seaTrainCurve.getTangentAt(u, this.tmpTrainTan);
      car.position.copy(this.tmpTrainPos);
      car.lookAt(
        this.tmpTrainPos.x + this.tmpTrainTan.x,
        this.tmpTrainPos.y + this.tmpTrainTan.y,
        this.tmpTrainPos.z + this.tmpTrainTan.z
      );
    }

    // Update chimney steam puffs trailing behind locomotive car 0
    if (this.trainSmokeMesh && this.trainSmokePuffs.length > 0 && this.seaTrainCars[0]) {
      const leadCar = this.seaTrainCars[0];
      leadCar.updateMatrixWorld(true);
      this.tmpChimneyWorld.copy(this.trainChimneyLocalPos).applyMatrix4(leadCar.matrixWorld);

      const windArr = this.currentConfig?.wind?.direction ?? [0.85, 0.0, 0.45];
      const windSpeed = this.currentConfig?.wind?.speed ?? 2.2;
      const wLen = Math.hypot(windArr[0], windArr[2] ?? windArr[1]) || 1;
      const wx = (windArr[0] / wLen) * (0.48 + windSpeed * 0.36);
      const wz = ((windArr[2] ?? windArr[1]) / wLen) * (0.48 + windSpeed * 0.36);

      const puffCount = this.trainSmokePuffs.length;
      if (deltaTime <= 0) {
        // Pre-seed initial steam plume behind the chimney on frame 0
        for (let i = 0; i < 16; i++) {
          const p = this.trainSmokePuffs[i];
          const age = i * 0.19;
          p.age = age;
          p.maxAge = 3.6;
          p.vx = wx - this.tmpTrainTan.x * 1.4;
          p.vy = 1.45;
          p.vz = wz - this.tmpTrainTan.z * 1.4;
          p.x = this.tmpChimneyWorld.x + p.vx * age;
          p.y = this.tmpChimneyWorld.y + p.vy * age;
          p.z = this.tmpChimneyWorld.z + p.vz * age;
          p.scale = 0.55 + age * 0.65;
        }
      } else {
        const dt = Math.min(Math.max(deltaTime, 0.001), 0.1);
        this.trainSmokeSpawnAccum += dt;
        const spawnInterval = 0.11;
        while (this.trainSmokeSpawnAccum >= spawnInterval) {
          this.trainSmokeSpawnAccum -= spawnInterval;
          const p = this.trainSmokePuffs[this.trainSmokeHead];
          this.trainSmokeHead = (this.trainSmokeHead + 1) % puffCount;
          const jitter = Math.sin(elapsedTime * 11.7 + this.trainSmokeHead * 1.9);
          const jitter2 = Math.cos(elapsedTime * 9.3 + this.trainSmokeHead * 2.7);
          p.x = this.tmpChimneyWorld.x + jitter * 0.08;
          p.y = this.tmpChimneyWorld.y + 0.05;
          p.z = this.tmpChimneyWorld.z + jitter2 * 0.08;
          p.vx = wx - this.tmpTrainTan.x * 0.9 + jitter * 0.25;
          p.vy = 1.55 + Math.abs(jitter2) * 0.35;
          p.vz = wz - this.tmpTrainTan.z * 0.9 + jitter2 * 0.25;
          p.age = 0;
          p.maxAge = 3.4 + Math.abs(jitter) * 0.8;
          p.scale = 0.52;
        }

        for (let i = 0; i < puffCount; i++) {
          const p = this.trainSmokePuffs[i];
          if (p.age < p.maxAge) {
            p.age += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vx += (wx - p.vx) * dt * 0.65;
            p.vz += (wz - p.vz) * dt * 0.65;
            p.vy = Math.max(0.45, p.vy - dt * 0.18);
          }
        }
      }

      for (let i = 0; i < puffCount; i++) {
        const p = this.trainSmokePuffs[i];
        const t = p.age / Math.max(0.01, p.maxAge);
        if (t >= 1.0 || !Number.isFinite(p.x)) {
          this.tmpPos.set(0, -100, 0);
          this.tmpScale.setScalar(0.0001);
        } else {
          const grow = 0.52 + t * 2.15;
          const fadeOut = t > 0.62 ? Math.max(0.001, 1.0 - (t - 0.62) / 0.38) : 1.0;
          const s = grow * fadeOut;
          this.tmpPos.set(p.x, p.y, p.z);
          this.tmpScale.set(s * 1.15, s * 0.92, s * 1.15);
        }
        this.tmpEuler.set(i * 0.4, elapsedTime * 0.25 + i, i * 0.2);
        this.tmpQuat.setFromEuler(this.tmpEuler);
        this.tmpMat.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        this.trainSmokeMesh.setMatrixAt(i, this.tmpMat);
      }
      this.trainSmokeMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Builds 3 white-sailed wooden coastal boats gently bobbing and drifting across the turquoise bay.
   */
  private buildCoastalSailboats(pbr: PbrSceneAssets): void {
    const hullWoodMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.timberWood.map,
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: pbr.timberWood.roughnessMap,
        roughness: 0.68
      }),
      {
        macroScale: 0.35,
        mossHeight: GHIBLI_SEA_LEVEL + 0.15,
        mossColor: '#315226',
        dampRoughness: 0.26,
        dirtTint: '#362618'
      }
    );
    const trimCreamMat = new THREE.MeshStandardMaterial({
      map: pbr.creamPlaster.map,
      color: '#f2ead8',
      roughness: 0.56
    });
    const sailMat = new THREE.MeshStandardMaterial({
      map: pbr.creamPlaster.map,
      color: '#fbf7ee',
      normalMap: pbr.creamPlaster.normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.78,
      side: THREE.DoubleSide
    });
    const pennantMat = new THREE.MeshStandardMaterial({
      color: '#b83830',
      roughness: 0.65,
      side: THREE.DoubleSide
    });

    const boatSpecs = [
      { x: -34.0, z: -60.0, rotY: 0.48, scale: 1.22, phase: 0.4, speed: 0.22, radius: 3.4 },
      { x: 6.0, z: -72.0, rotY: -0.32, scale: 1.32, phase: 2.1, speed: 0.18, radius: 4.2 },
      { x: 42.0, z: -58.0, rotY: -0.68, scale: 1.18, phase: 4.0, speed: 0.25, radius: 3.1 }
    ];

    const fleetGroup = new THREE.Group();
    fleetGroup.name = 'CoastalSailboatFleet';

    boatSpecs.forEach((spec, idx) => {
      const boat = new THREE.Group();
      boat.name = `CoastalSailboat_${idx + 1}`;
      boat.scale.setScalar(spec.scale);

      const woodGeos: THREE.BufferGeometry[] = [];
      const creamGeos: THREE.BufferGeometry[] = [];
      const sailGeos: THREE.BufferGeometry[] = [];

      // Sculpted double-ended wooden boat hull
      const hullGeo = new THREE.CylinderGeometry(0.95, 0.58, 4.6, 12, 4);
      hullGeo.rotateX(Math.PI / 2);
      hullGeo.scale(1.0, 0.52, 1.0);
      const hPos = hullGeo.attributes.position;
      for (let i = 0; i < hPos.count; i++) {
        const vx = hPos.getX(i);
        const vy = hPos.getY(i);
        const vz = hPos.getZ(i);
        const zNorm = vz / 2.3;
        const taper = Math.max(0.12, 1.0 - Math.pow(Math.abs(zNorm), 1.65) * 0.85);
        const sheer = Math.pow(zNorm, 2.0) * 0.18;
        hPos.setXYZ(i, vx * taper, (vy > 0 ? 0.22 : vy) + sheer, vz);
      }
      hullGeo.computeVertexNormals();
      hullGeo.translate(0, 0.12, 0);
      woodGeos.push(prepareForMerge(hullGeo));
      hullGeo.dispose();

      // Painted cream gunwale trim & cozy cabin trunk
      const gunwale = new THREE.BoxGeometry(1.56, 0.12, 3.6);
      gunwale.translate(0, 0.34, -0.1);
      creamGeos.push(prepareForMerge(gunwale));
      gunwale.dispose();

      const cabin = new THREE.BoxGeometry(1.08, 0.42, 1.45);
      cabin.translate(0, 0.52, 0.15);
      creamGeos.push(prepareForMerge(cabin));
      cabin.dispose();

      const cabinRoof = new THREE.BoxGeometry(1.16, 0.08, 1.56);
      cabinRoof.translate(0, 0.75, 0.15);
      woodGeos.push(prepareForMerge(cabinRoof));
      cabinRoof.dispose();

      // Tapered wooden mast, main boom, gaff spar & bowsprit
      const mast = new THREE.CylinderGeometry(0.04, 0.075, 6.2, 8);
      mast.translate(0, 3.2, 0.65);
      woodGeos.push(prepareForMerge(mast));
      mast.dispose();

      const boom = new THREE.CylinderGeometry(0.035, 0.045, 2.95, 6);
      boom.rotateX(Math.PI / 2);
      boom.rotateY(0.18);
      boom.translate(-0.26, 1.15, -0.78);
      woodGeos.push(prepareForMerge(boom));
      boom.dispose();

      const bowsprit = new THREE.CylinderGeometry(0.03, 0.05, 1.45, 6);
      bowsprit.rotateX(Math.PI * 0.42);
      bowsprit.translate(0, 0.52, 2.45);
      woodGeos.push(prepareForMerge(bowsprit));
      bowsprit.dispose();

      // Billowing curved white mainsail + triangular foresail jib
      const mainSail = new THREE.PlaneGeometry(2.55, 4.35, 8, 10);
      const msPos = mainSail.attributes.position;
      for (let i = 0; i < msPos.count; i++) {
        const sx = msPos.getX(i);
        const sy = msPos.getY(i);
        const u = (sx + 1.275) / 2.55;
        const v = (sy + 2.175) / 4.35;
        // Taper top of sail and curve belly outward in the sea breeze
        const widthTaper = 1.0 - v * 0.36;
        const belly = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.38;
        msPos.setXYZ(i, belly, sy, (u * widthTaper - 0.5) * 2.55);
      }
      mainSail.computeVertexNormals();
      mainSail.rotateY(0.18);
      mainSail.translate(-0.22, 3.38, -0.62);
      sailGeos.push(prepareForMerge(mainSail));
      mainSail.dispose();

      const jibSail = new THREE.PlaneGeometry(1.55, 3.6, 6, 8);
      const jbPos = jibSail.attributes.position;
      for (let i = 0; i < jbPos.count; i++) {
        const sx = jbPos.getX(i);
        const sy = jbPos.getY(i);
        const u = (sx + 0.775) / 1.55;
        const v = (sy + 1.8) / 3.6;
        const triSpan = Math.max(0.04, 1.0 - v);
        const belly = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.24;
        jbPos.setXYZ(i, belly, sy, (u * triSpan) * 1.55 - v * 0.65);
      }
      jibSail.computeVertexNormals();
      jibSail.rotateY(0.14);
      jibSail.translate(-0.08, 2.75, 1.38);
      sailGeos.push(prepareForMerge(jibSail));
      jibSail.dispose();

      const attachB = (list: THREE.BufferGeometry[], mat: THREE.Material, name: string) => {
        const merged = mergeGeometries(list, false);
        list.forEach((g) => g.dispose());
        if (merged) {
          const m = new THREE.Mesh(merged, mat);
          m.name = name;
          m.castShadow = true;
          m.receiveShadow = true;
          boat.add(m);
        }
      };
      attachB(woodGeos, hullWoodMat, `SailboatHull_${idx + 1}`);
      attachB(creamGeos, trimCreamMat, `SailboatTrim_${idx + 1}`);
      attachB(sailGeos, sailMat, `SailboatSails_${idx + 1}`);

      const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.68, 4), pennantMat);
      pennant.rotation.z = Math.PI / 2;
      pennant.position.set(-0.34, 6.26, 0.65);
      boat.add(pennant);

      const wakeMat = new THREE.MeshBasicMaterial({
        color: '#eef9ff',
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const wakeRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.85, 24), wakeMat);
      wakeRing.rotation.x = -Math.PI / 2;
      wakeRing.scale.set(0.75, 1.65, 1.0);
      wakeRing.position.set(0, 0.06, -0.35);
      boat.add(wakeRing);

      fleetGroup.add(boat);
      this.sailboats.push({
        group: boat,
        wakeRing,
        baseX: spec.x,
        baseZ: spec.z,
        baseRotY: spec.rotY,
        phase: spec.phase,
        speed: spec.speed,
        radius: spec.radius
      });
    });

    this.scene.add(fleetGroup);
    this.updateSailboats(0);
  }

  private updateSailboats(elapsedTime: number): void {
    for (let i = 0; i < this.sailboats.length; i++) {
      const b = this.sailboats[i];
      const t = elapsedTime * b.speed + b.phase;
      const dx = Math.cos(t) * b.radius;
      const dz = Math.sin(t * 2.0) * (b.radius * 0.45);
      const bx = b.baseX + dx;
      const bz = b.baseZ + dz;

      const wave = getGhibliOceanWaveState(bx, bz, elapsedTime);
      const waveY = Number.isFinite(wave.y) ? wave.y : 0;
      const pitchX = (Number.isFinite(wave.slopeZ) ? wave.slopeZ * 0.35 : 0) + Math.cos(elapsedTime * 1.55 + b.phase * 0.8) * 0.032;
      const rollZ = (Number.isFinite(wave.slopeX) ? -wave.slopeX * 0.38 : 0) + Math.sin(elapsedTime * 1.35 + b.phase) * 0.055;
      const yawDrift = Math.sin(t) * 0.18;

      b.group.position.set(bx, GHIBLI_SEA_LEVEL + 0.04 + waveY, bz);
      b.group.rotation.set(pitchX, b.baseRotY + yawDrift, rollZ);

      if (b.wakeRing) {
        const pulse = 0.92 + 0.14 * Math.sin(elapsedTime * 2.2 + b.phase);
        b.wakeRing.scale.set(0.72 * pulse, 1.65 * pulse, 1.0);
        const wMat = b.wakeRing.material as THREE.MeshBasicMaterial;
        wMat.opacity = 0.24 + 0.14 * (0.5 + 0.5 * Math.sin(elapsedTime * 2.4 + b.phase));
      }
    }
  }

  private buildVillageAndBakery(
    pbr: PbrSceneAssets,
    _windDir2D: THREE.Vector2
  ): Array<{ x: number; y: number; z: number }> {
    const wallMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.creamPlaster.map,
        normalMap: pbr.creamPlaster.normalMap,
        normalScale: new THREE.Vector2(0.96, 0.96),
        roughnessMap: pbr.creamPlaster.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.creamPlaster.aoMap,
        aoMapIntensity: 0.72,
        vertexColors: true
      }),
      {
        macroScale: 0.26,
        mossHeight: 1.55,
        mossColor: '#526b36',
        dampRoughness: 0.52,
        dirtTint: '#6b5a45'
      }
    );
    const terracottaMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.terracottaRoof.map,
        normalMap: pbr.terracottaRoof.normalMap,
        normalScale: new THREE.Vector2(1.85, 1.85),
        roughnessMap: pbr.terracottaRoof.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.terracottaRoof.aoMap,
        aoMapIntensity: 0.92
      }),
      {
        macroScale: 0.30,
        mossHeight: -4.0,
        mossColor: '#4c682e',
        dampRoughness: 0.48,
        dirtTint: '#594230'
      }
    );
    const tealRoofMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.tealRoof.map,
        normalMap: pbr.tealRoof.normalMap,
        normalScale: new THREE.Vector2(1.75, 1.75),
        roughnessMap: pbr.tealRoof.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.tealRoof.aoMap,
        aoMapIntensity: 0.90
      }),
      {
        macroScale: 0.30,
        mossHeight: -4.0,
        mossColor: '#466634',
        dampRoughness: 0.48,
        dirtTint: '#484a3e'
      }
    );
    const stoneMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.stoneMasonry.map,
        normalMap: pbr.stoneMasonry.normalMap,
        normalScale: new THREE.Vector2(1.58, 1.58),
        roughnessMap: pbr.stoneMasonry.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.stoneMasonry.aoMap,
        aoMapIntensity: 0.90
      }),
      {
        macroScale: 0.24,
        mossHeight: 2.65,
        mossColor: '#42642c',
        dampRoughness: 0.38,
        dirtTint: '#4d4132'
      }
    );
    const woodMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.timberWood.map,
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(1.22, 1.22),
        roughnessMap: pbr.timberWood.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.timberWood.aoMap
      }),
      {
        macroScale: 0.32,
        mossHeight: -4.0,
        mossColor: '#3f5a28',
        dampRoughness: 0.45,
        dirtTint: '#3d2c1e'
      }
    );
    // Recessed dark reflective glass panes (crisp architectural glazing over deep interior)
    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: '#0a1824',
      roughness: 0.06,
      metalness: 0.90,
      envMapIntensity: 2.35,
      transparent: true,
      opacity: 0.72
    });
    // Warm interior lit curtains & cozy hearth glow behind the recessed glass
    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffd996',
      emissive: new THREE.Color('#ffa238'),
      emissiveIntensity: 0.64,
      roughness: 0.52
    });
    const interiorRoomMat = new THREE.MeshStandardMaterial({
      color: '#1e140e',
      roughness: 0.90
    });
    const ironHingeMat = new THREE.MeshStandardMaterial({
      color: '#232830',
      roughness: 0.42,
      metalness: 0.68
    });
    const shutterMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: '#346972',
        normalMap: pbr.timberWood.normalMap,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughness: 0.70
      }),
      {
        macroScale: 0.35,
        mossHeight: -4.0,
        mossColor: '#3a5b32',
        dampRoughness: 0.52,
        dirtTint: '#2b4046'
      }
    );
    const sailCanvasMat = new THREE.MeshStandardMaterial({
      color: '#d8ceb6',
      normalMap: pbr.creamPlaster.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.90,
      side: THREE.DoubleSide
    });
    const flowerClusterMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.72
    });

    const buckets: Record<string, THREE.BufferGeometry[]> = {
      wall: [],
      terracotta: [],
      teal: [],
      stone: [],
      wood: [],
      glass: [],
      glow: [],
      interior: [],
      shutter: [],
      iron: [],
      canvas: [],
      flowers: []
    };

    const addPart = (
      bucket: keyof typeof buckets,
      geo: THREE.BufferGeometry,
      localPos: [number, number, number],
      parentMat: THREE.Matrix4,
      localRot?: [number, number, number],
      vertexHexColor?: string
    ) => {
      const m = new THREE.Matrix4();
      if (localRot) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(localRot[0], localRot[1], localRot[2]));
        m.compose(new THREE.Vector3(localPos[0], localPos[1], localPos[2]), q, new THREE.Vector3(1, 1, 1));
      } else {
        m.makeTranslation(localPos[0], localPos[1], localPos[2]);
      }
      if (bucket === 'stone' && geo.type === 'BoxGeometry') {
        const params = (geo as THREE.BoxGeometry).parameters;
        scaleGeometryUvs(
          geo,
          Math.max(0.28, Math.max(params.width, params.depth) * 0.36),
          Math.max(0.18, params.height * 0.36)
        );
      }
      const worldMat = new THREE.Matrix4().multiplyMatrices(parentMat, m);
      const prepared = prepareForMerge(geo, worldMat, bucket === 'wall' || bucket === 'flowers');
      if (bucket === 'flowers' && vertexHexColor) {
        const cAttr = prepared.attributes.color;
        const col = new THREE.Color(vertexHexColor);
        for (let vi = 0; vi < cAttr.count; vi++) {
          cAttr.setXYZ(vi, col.r, col.g, col.b);
        }
        cAttr.needsUpdate = true;
      }
      buckets[bucket].push(prepared);
      geo.dispose();
    };

    /**
     * Photorealistic architectural casement window with:
     * - Chiseled stone lintel & projecting stone sill with corbel brackets
     * - Deep timber casement reveal
     * - Recessed dark reflective glass pane (metalness: 0.8, roughness: 0.15)
     * - Warm interior lit draped curtains & valance peeking behind the glass
     * - 3D wooden muntin bars & central mullion
     * - Open louvered shutters with angled slats & black wrought-iron strap hinges
     */
    const addFramedWindow = (
      localPos: [number, number, number],
      winW: number,
      winH: number,
      face: 'front' | 'back' | 'left' | 'right',
      parentMat: THREE.Matrix4,
      withShutters = false
    ) => {
      const rotY =
        face === 'front' ? 0 :
        face === 'back' ? Math.PI :
        face === 'left' ? Math.PI * 0.5 : -Math.PI * 0.5;
      const wMat = new THREE.Matrix4().multiplyMatrices(
        parentMat,
        new THREE.Matrix4().compose(
          new THREE.Vector3(localPos[0], localPos[1], localPos[2]),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
          new THREE.Vector3(1, 1, 1)
        )
      );

      const ft = 0.085;
      const revealD = 0.16;

      // 1. Chiseled stone lintel block above window + projecting stone sill & corbel brackets below
      addPart('stone', new THREE.BoxGeometry(winW + ft * 3.0, 0.15, 0.19), [0, winH * 0.5 + ft * 1.15, -0.04], wMat);
      addPart('stone', new THREE.BoxGeometry(winW + ft * 3.4, 0.12, 0.24), [0, -winH * 0.5 - ft * 0.55, -0.065], wMat);
      addPart('stone', new THREE.BoxGeometry(0.10, 0.13, 0.16), [-winW * 0.36, -winH * 0.5 - ft * 1.55, -0.045], wMat);
      addPart('stone', new THREE.BoxGeometry(0.10, 0.13, 0.16), [winW * 0.36, -winH * 0.5 - ft * 1.55, -0.045], wMat);

      // 2. Deep timber casement frame reveal
      addPart('wood', new THREE.BoxGeometry(winW + ft * 2.2, ft, revealD), [0, winH * 0.5 + ft * 0.35, -0.025], wMat);
      addPart('wood', new THREE.BoxGeometry(ft, winH + ft * 0.5, revealD), [-winW * 0.5 - ft * 0.35, 0, -0.025], wMat);
      addPart('wood', new THREE.BoxGeometry(ft, winH + ft * 0.5, revealD), [winW * 0.5 + ft * 0.35, 0, -0.025], wMat);

      // 3. Deep dark interior room backing + warm draped side curtains BEHIND crisp reflective glass (-Z is outward)
      addPart('interior', new THREE.BoxGeometry(winW * 0.92, winH * 0.92, 0.02), [0, 0, 0.052], wMat);
      const curtW = winW * 0.21;
      addPart('glow', new THREE.BoxGeometry(curtW, winH * 0.84, 0.02), [-winW * 0.34, 0, 0.032], wMat);
      addPart('glow', new THREE.BoxGeometry(curtW, winH * 0.84, 0.02), [winW * 0.34, 0, 0.032], wMat);
      addPart('glow', new THREE.BoxGeometry(winW * 0.86, winH * 0.12, 0.02), [0, winH * 0.37, 0.032], wMat);
      addPart('glow', new THREE.BoxGeometry(winW * 0.24, winH * 0.18, 0.02), [0, -winH * 0.27, 0.032], wMat);
      addPart('glass', new THREE.BoxGeometry(winW * 0.94, winH * 0.94, 0.018), [0, 0, 0.005], wMat);

      // 4. Projecting 3D wooden muntin bars & central casement mullion in front of the glass
      addPart('wood', new THREE.BoxGeometry(0.048, winH, 0.085), [0, 0, -0.012], wMat);
      addPart('wood', new THREE.BoxGeometry(winW, 0.042, 0.08), [0, winH * 0.14, -0.010], wMat);
      addPart('wood', new THREE.BoxGeometry(winW, 0.038, 0.075), [0, -winH * 0.20, -0.010], wMat);
      if (winW > 1.05) {
        addPart('wood', new THREE.BoxGeometry(0.038, winH, 0.075), [-winW * 0.26, 0, -0.010], wMat);
        addPart('wood', new THREE.BoxGeometry(0.038, winH, 0.075), [winW * 0.26, 0, -0.010], wMat);
      }

      // 5. Open louvered shutters with angled 3D louver slats & black wrought-iron strap hinges
      if (withShutters) {
        const shW = winW * 0.40;
        for (const side of [-1, 1]) {
          const sx = side * (winW * 0.5 + ft + shW * 0.5);
          // Outer shutter frame panel
          addPart('shutter', new THREE.BoxGeometry(shW, winH + 0.04, 0.048), [sx, 0, -0.032], wMat);
          // 5 angled horizontal louver slats
          for (let sl = -2; sl <= 2; sl++) {
            addPart(
              'shutter',
              new THREE.BoxGeometry(shW * 0.84, 0.042, 0.068),
              [sx, sl * (winH * 0.17), -0.038],
              wMat,
              [0.38, 0, 0]
            );
          }
          // Wrought-iron strap hinges & S-hook shutter dog
          const hingeX = side * (winW * 0.5 + ft + shW * 0.24);
          addPart('iron', new THREE.BoxGeometry(shW * 0.56, 0.038, 0.068), [hingeX, winH * 0.34, -0.038], wMat);
          addPart('iron', new THREE.BoxGeometry(shW * 0.56, 0.038, 0.068), [hingeX, -winH * 0.34, -0.038], wMat);
          addPart('iron', new THREE.BoxGeometry(0.04, 0.09, 0.072), [sx + side * shW * 0.35, -winH * 0.42, -0.038], wMat);
        }
      }
    };

    const addRoofBargeboardsAndRafters = (
      rw: number,
      rh: number,
      rd: number,
      roofY: number,
      roofType: 'gable' | 'hip',
      parentMat: THREE.Matrix4,
      isDormer = false
    ) => {
      if (roofType === 'gable') {
        const slopeAng = Math.atan2(rh, rw * 0.5);
        const slopeLen = Math.hypot(rw * 0.5, rh) + 0.14;
        const boardH = isDormer ? 0.10 : 0.15;
        const boardD = isDormer ? 0.08 : 0.11;
        // Front & back gable bargeboards + ridge beam & finial
        for (const gz of [-rd * 0.5 + 0.03, rd * 0.5 - 0.03]) {
          addPart('wood', new THREE.BoxGeometry(slopeLen, boardH, boardD), [-rw * 0.25, roofY + rh * 0.5 - 0.03, gz], parentMat, [0, 0, slopeAng]);
          addPart('wood', new THREE.BoxGeometry(slopeLen, boardH, boardD), [rw * 0.25, roofY + rh * 0.5 - 0.03, gz], parentMat, [0, 0, -slopeAng]);
        }
        addPart('wood', new THREE.BoxGeometry(0.14, 0.16, rd + 0.18), [0, roofY + rh + 0.02, 0], parentMat);
        if (!isDormer) {
          addPart('wood', new THREE.BoxGeometry(0.10, 0.38, 0.10), [0, roofY + rh + 0.18, -rd * 0.5 + 0.04], parentMat);
          // Exposed rafter tails protruding beneath both eaves
          for (let rz = -rd * 0.44; rz <= rd * 0.44 + 0.01; rz += 0.68) {
            addPart('wood', new THREE.BoxGeometry(0.42, 0.09, 0.08), [-rw * 0.5 + 0.14, roofY - 0.02, rz], parentMat, [0, 0, slopeAng]);
            addPart('wood', new THREE.BoxGeometry(0.42, 0.09, 0.08), [rw * 0.5 - 0.14, roofY - 0.02, rz], parentMat, [0, 0, -slopeAng]);
          }
        }
      } else {
        // Hip roof timber fascia & exposed rafter tails on all 4 eaves
        for (let rz = -rd * 0.42; rz <= rd * 0.42 + 0.01; rz += 0.68) {
          addPart('wood', new THREE.BoxGeometry(0.38, 0.09, 0.08), [-rw * 0.5 + 0.12, roofY - 0.02, rz], parentMat, [0, 0, 0.52]);
          addPart('wood', new THREE.BoxGeometry(0.38, 0.09, 0.08), [rw * 0.5 - 0.12, roofY - 0.02, rz], parentMat, [0, 0, -0.52]);
        }
        for (let rx = -rw * 0.42; rx <= rw * 0.42 + 0.01; rx += 0.68) {
          addPart('wood', new THREE.BoxGeometry(0.08, 0.09, 0.38), [rx, roofY - 0.02, -rd * 0.5 + 0.12], parentMat, [-0.52, 0, 0]);
          addPart('wood', new THREE.BoxGeometry(0.08, 0.09, 0.38), [rx, roofY - 0.02, rd * 0.5 - 0.12], parentMat, [0.52, 0, 0]);
        }
      }
    };

    const addChimneyPot = (cx: number, topY: number, cz: number, parentMat: THREE.Matrix4) => {
      addPart('terracotta', new THREE.CylinderGeometry(0.13, 0.16, 0.44, 10), [cx, topY + 0.22, cz], parentMat);
      addPart('terracotta', new THREE.CylinderGeometry(0.17, 0.15, 0.08, 10), [cx, topY + 0.42, cz], parentMat);
    };

    const chimneyPositions: Array<{ x: number; y: number; z: number }> = [];

    // -------------------------------------------------------------------------
    // 1. Hero Ghibli Windmill Bakery at (12.5, -10.5)
    // -------------------------------------------------------------------------
    {
      const bx = 12.5;
      const bz = -10.5;
      const by = getGhibliValleyHeight(bx, bz) - 0.15;
      const bakeryRot = 2.24;
      const bakeryMat = new THREE.Matrix4().compose(
        new THREE.Vector3(bx, by, bz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, bakeryRot, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      this.exclusionCircles.push({ x: bx, z: bz, r: 6.4 });
      this.exclusionCircles.push({ x: bx - 4.1, z: bz - 1.8, r: 2.8 });

      const w = 5.6;
      const h = 4.6;
      const d = 4.6;
      this.contactAoSpots.push({ x: bx, z: bz, rx: 4.3, rz: 3.8, rotY: bakeryRot, strength: 0.52 });

      // Carved stone plinth + beveled water-table cap molding + corner quoin blocks
      addPart('stone', new THREE.BoxGeometry(6.2, 1.5, 5.2), [0, -0.35, 0], bakeryMat);
      addPart('stone', new THREE.BoxGeometry(6.38, 0.16, 5.38), [0, 0.41, 0], bakeryMat);
      for (const qx of [-w * 0.5, w * 0.5]) {
        for (const qz of [-d * 0.5, d * 0.5]) {
          for (let qy = 0.72; qy <= 2.32; qy += 0.52) {
            addPart('stone', new THREE.BoxGeometry(0.32, 0.24, 0.32), [qx, qy, qz], bakeryMat);
          }
        }
      }

      // Main 2-story bakery cream stucco body with baked bottom/eave Contact AO
      const bodyGeo = applyVerticalAoColor(new THREE.BoxGeometry(w, h, d, 1, 4, 1), -h * 0.5, h * 0.5, 0.72, 1.0);
      addPart('wall', bodyGeo, [0, h * 0.5 + 0.4, 0], bakeryMat);

      // Half-timber framing beams + diagonal gable braces matching reference
      for (const cx of [-w * 0.5, 0, w * 0.5]) {
        for (const cz of [-d * 0.5, d * 0.5]) {
          addPart('wood', new THREE.BoxGeometry(0.22, h, 0.22), [cx, h * 0.5 + 0.4, cz], bakeryMat);
        }
      }
      addPart('wood', new THREE.BoxGeometry(w + 0.2, 0.22, d + 0.2), [0, 2.7, 0], bakeryMat);
      addPart('wood', new THREE.BoxGeometry(0.20, 0.20, d + 0.2), [-w * 0.5, 4.95, 0], bakeryMat);
      addPart('wood', new THREE.BoxGeometry(0.20, 0.20, d + 0.2), [w * 0.5, 4.95, 0], bakeryMat);

      // Steep terracotta barrel-tile gable roof with overhang, bargeboards & exposed rafter tails
      addPart('terracotta', createGableRoofGeometry(w + 0.9, 2.5, d + 0.9), [0, h + 0.36, 0], bakeryMat);
      addRoofBargeboardsAndRafters(w + 0.9, 2.5, d + 0.9, h + 0.36, 'gable', bakeryMat, false);

      // Cozy dormer window facing front (-Z local)
      const dormerWall = applyVerticalAoColor(new THREE.BoxGeometry(1.3, 1.05, 1.1), -0.52, 0.52, 0.78, 1.0);
      addPart('wall', dormerWall, [-1.1, h + 1.1, -1.2], bakeryMat);
      addPart('terracotta', createGableRoofGeometry(1.55, 0.65, 1.3), [-1.1, h + 1.62, -1.2], bakeryMat);
      addRoofBargeboardsAndRafters(1.55, 0.65, 1.3, h + 1.62, 'gable', new THREE.Matrix4().multiplyMatrices(bakeryMat, new THREE.Matrix4().makeTranslation(-1.1, 0, -1.2)), true);
      addFramedWindow([-1.1, h + 1.08, -1.76], 0.64, 0.54, 'front', bakeryMat);

      // Shopfront timber awning + framed wooden door + 4-step stone garden stairs + framed multi-pane windows
      addPart('wood', new THREE.BoxGeometry(3.5, 0.14, 1.35), [0.3, 2.45, -d * 0.5 - 0.65], bakeryMat, [0.22, 0, 0]);
      addPart('wood', new THREE.BoxGeometry(0.14, 2.1, 0.14), [-1.25, 1.4, -d * 0.5 - 1.15], bakeryMat);
      addPart('wood', new THREE.BoxGeometry(0.14, 2.1, 0.14), [1.85, 1.4, -d * 0.5 - 1.15], bakeryMat);
      addPart('wood', new THREE.BoxGeometry(1.02, 1.95, 0.12), [-0.85, 1.38, -d * 0.5 - 0.04], bakeryMat);
      for (let st = 0; st < 4; st++) {
        addPart('stone', new THREE.BoxGeometry(1.65 - st * 0.06, 0.16, 0.34), [-0.85, 0.40 - st * 0.13, -d * 0.5 - 0.25 - st * 0.30], bakeryMat);
      }
      addPart('stone', new THREE.BoxGeometry(0.22, 0.58, 1.15), [-1.72, 0.26, -d * 0.5 - 0.68], bakeryMat);
      addPart('stone', new THREE.BoxGeometry(0.22, 0.58, 1.15), [0.02, 0.26, -d * 0.5 - 0.68], bakeryMat);
      addPart('glow', new THREE.BoxGeometry(0.40, 0.46, 0.03), [-0.85, 1.75, -d * 0.5 - 0.075], bakeryMat);
      addPart('glass', new THREE.BoxGeometry(0.46, 0.52, 0.025), [-0.85, 1.75, -d * 0.5 - 0.10], bakeryMat);
      addPart('wood', new THREE.BoxGeometry(0.035, 0.52, 0.04), [-0.85, 1.75, -d * 0.5 - 0.11], bakeryMat);
      addPart('wood', new THREE.BoxGeometry(0.46, 0.035, 0.04), [-0.85, 1.75, -d * 0.5 - 0.11], bakeryMat);

      addFramedWindow([1.05, 1.58, -d * 0.5 - 0.04], 1.35, 1.05, 'front', bakeryMat, false);
      addFramedWindow([-1.15, 3.68, -d * 0.5 - 0.04], 0.92, 0.82, 'front', bakeryMat, true);
      addFramedWindow([1.15, 3.68, -d * 0.5 - 0.04], 0.92, 0.82, 'front', bakeryMat, true);
      addFramedWindow([-w * 0.5 - 0.04, 1.65, 0.0], 1.1, 0.92, 'left', bakeryMat, true);
      addFramedWindow([-w * 0.5 - 0.04, 3.65, 0.0], 0.92, 0.82, 'left', bakeryMat, true);
      addFramedWindow([0.0, 1.65, d * 0.5 + 0.04], 1.05, 0.86, 'back', bakeryMat, true);
      addFramedWindow([0.0, 3.65, d * 0.5 + 0.04], 0.92, 0.80, 'back', bakeryMat, false);

      // Lush botanical flower boxes under bakery windows (irregular leafy tufts + small wildflower clusters)
      const floralPalette = ['#d85a7f', '#f4c852', '#f7f1e3', '#e07254', '#c95c8c'];
      for (const fbx of [-1.15, 1.15]) {
        addPart('wood', new THREE.BoxGeometry(1.25, 0.22, 0.32), [fbx, 3.06, -d * 0.5 - 0.18], bakeryMat);
        for (let b = -4; b <= 4; b++) {
          const bx = fbx + b * 0.12;
          const bzOff = (b % 2) * 0.04;
          addPart('flowers', new THREE.DodecahedronGeometry(0.08, 0), [bx, 3.19, -d * 0.5 - 0.18 + bzOff], bakeryMat, [b * 0.5, b * 0.7, 0], '#3b6e28');
          addPart('flowers', new THREE.DodecahedronGeometry(0.055, 0), [bx + (b % 2) * 0.03, 3.25 + (b % 2) * 0.03, -d * 0.5 - 0.19 - bzOff], bakeryMat, [b * 0.4, b * 0.9, 0], floralPalette[Math.abs(b) % floralPalette.length]);
        }
      }

      // Stone bakery chimney + twin terracotta chimney pots
      addPart('stone', new THREE.BoxGeometry(0.85, 3.4, 0.85), [1.9, h + 1.8, 1.3], bakeryMat);
      addPart('stone', new THREE.BoxGeometry(1.05, 0.22, 1.05), [1.9, h + 3.55, 1.3], bakeryMat);
      addChimneyPot(1.74, h + 3.66, 1.3, bakeryMat);
      addChimneyPot(2.06, h + 3.66, 1.3, bakeryMat);
      const chimLocal = new THREE.Vector3(1.9, h + 4.05, 1.3).applyMatrix4(bakeryMat);
      chimneyPositions.push({ x: chimLocal.x, y: chimLocal.y, z: chimLocal.z });

      // Full Tapered Weathered Stone Masonry Windmill Tower + Corbel Ring + Conical Terracotta Barrel-Tile Roof
      const towerLocalX = 3.95;
      const towerLocalZ = -2.1;
      const towerWorld = new THREE.Vector3(towerLocalX, 0, towerLocalZ).applyMatrix4(bakeryMat);
      this.contactAoSpots.push({ x: towerWorld.x, z: towerWorld.z, rx: 2.8, rz: 2.8, rotY: 0, strength: 0.58 });

      const towerCyl = scaleGeometryUvs(new THREE.CylinderGeometry(1.26, 1.92, 9.6, 18, 4), 2.4, 2.2);
      addPart('stone', towerCyl, [towerLocalX, 4.3, towerLocalZ], bakeryMat);
      addPart('stone', new THREE.CylinderGeometry(2.05, 2.15, 0.65, 18), [towerLocalX, 0.10, towerLocalZ], bakeryMat);
      for (let cb = 0; cb < 12; cb++) {
        const cAng = (cb / 12) * Math.PI * 2;
        addPart('stone', new THREE.BoxGeometry(0.18, 0.28, 0.24), [towerLocalX + Math.cos(cAng) * 1.30, 8.74, towerLocalZ + Math.sin(cAng) * 1.30], bakeryMat, [0, -cAng, 0]);
      }
      addFramedWindow([towerLocalX, 5.2, towerLocalZ - 1.56], 0.50, 0.68, 'front', bakeryMat, false);
      addPart('wood', new THREE.CylinderGeometry(1.36, 1.36, 0.28, 16), [towerLocalX, 8.95, towerLocalZ], bakeryMat);
      const coneGeo = scaleGeometryUvs(new THREE.ConeGeometry(1.68, 2.45, 18), 4.2, 1.5);
      addPart('terracotta', coneGeo, [towerLocalX, 10.25, towerLocalZ], bakeryMat);

      // Rotating 4-Sail Windmill Hub mounted to tower facing forward (-Z local)
      const hubWorld = new THREE.Vector3(towerLocalX, 8.45, towerLocalZ - 1.48).applyMatrix4(bakeryMat);
      this.windmillSails = new THREE.Group();
      this.windmillSails.name = 'WindmillSails';
      this.windmillSails.position.copy(hubWorld);
      this.windmillSails.rotation.y = bakeryRot;

      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.6, 10), woodMat);
      hubCap.rotation.x = Math.PI / 2;
      hubCap.castShadow = true;
      this.windmillSails.add(hubCap);

      const sailTimberGeos: THREE.BufferGeometry[] = [];
      const sailClothGeos: THREE.BufferGeometry[] = [];
      for (let arm = 0; arm < 4; arm++) {
        const armAngle = (arm * Math.PI) / 2 + 0.35;
        const armMat = new THREE.Matrix4().makeRotationZ(armAngle);

        const spar = new THREE.BoxGeometry(0.16, 4.4, 0.14);
        spar.translate(0, 2.2, 0);
        sailTimberGeos.push(prepareForMerge(spar, armMat));
        spar.dispose();

        const outerRail = new THREE.BoxGeometry(0.08, 3.3, 0.08);
        outerRail.translate(0.95, 2.65, 0.05);
        sailTimberGeos.push(prepareForMerge(outerRail, armMat));
        outerRail.dispose();

        for (let r = 1.1; r <= 4.25; r += 0.78) {
          const rung = new THREE.BoxGeometry(1.02, 0.07, 0.07);
          rung.translate(0.48, r, 0.04);
          sailTimberGeos.push(prepareForMerge(rung, armMat));
          rung.dispose();
        }

        const cloth = new THREE.PlaneGeometry(0.92, 3.25);
        cloth.rotateY(0.18);
        cloth.translate(0.52, 2.65, -0.02);
        sailClothGeos.push(prepareForMerge(cloth, armMat));
        cloth.dispose();
      }
      const mergedTimber = mergeGeometries(sailTimberGeos, false);
      sailTimberGeos.forEach((g) => g.dispose());
      if (mergedTimber) {
        const m = new THREE.Mesh(mergedTimber, woodMat);
        m.castShadow = true;
        this.windmillSails.add(m);
      }

      const mergedCloth = mergeGeometries(sailClothGeos, false);
      sailClothGeos.forEach((g) => g.dispose());
      if (mergedCloth) {
        const m = new THREE.Mesh(mergedCloth, sailCanvasMat);
        m.castShadow = true;
        m.receiveShadow = true;
        this.windmillSails.add(m);
      }

      this.scene.add(this.windmillSails);
    }

    // -------------------------------------------------------------------------
    // 1B. Bakery Terrace Cafe Tables with Parasols, Flower Cart & Wooden Barrels
    // -------------------------------------------------------------------------
    {
      const cafeSpots: Array<[number, number, number]> = [
        [3.2, -11.4, 0.25],
        [5.8, -14.2, -0.35],
        [-0.8, -13.6, 0.55]
      ];
      for (const [tx, tz, rot] of cafeSpots) {
        const ty = getGhibliValleyHeight(tx, tz) + 0.03;
        const tMat = new THREE.Matrix4().compose(
          new THREE.Vector3(tx, ty, tz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)),
          new THREE.Vector3(1, 1, 1)
        );
        this.contactAoSpots.push({ x: tx, z: tz, rx: 1.25, rz: 1.25, rotY: rot, strength: 0.42 });

        // Cast-iron pedestal & round wooden tabletop
        addPart('iron', new THREE.CylinderGeometry(0.28, 0.34, 0.06, 10), [0, 0.03, 0], tMat);
        addPart('iron', new THREE.CylinderGeometry(0.05, 0.07, 0.72, 8), [0, 0.38, 0], tMat);
        addPart('wood', new THREE.CylinderGeometry(0.62, 0.62, 0.06, 14), [0, 0.75, 0], tMat);
        // Teacup & warm brioche plate on table
        addPart('wall', new THREE.CylinderGeometry(0.11, 0.08, 0.04, 8), [-0.18, 0.80, 0.12], tMat);
        addPart('terracotta', new THREE.SphereGeometry(0.075, 8, 6), [-0.18, 0.84, 0.12], tMat);

        // Two timber-and-iron bistro chairs flanking each table
        for (const cSide of [-1, 1]) {
          const cx = cSide * 0.78;
          addPart('wood', new THREE.BoxGeometry(0.42, 0.05, 0.42), [cx, 0.46, 0], tMat);
          addPart('wood', new THREE.BoxGeometry(0.05, 0.46, 0.42), [cx + cSide * 0.19, 0.70, 0], tMat);
          for (const lx of [-0.17, 0.17]) {
            for (const lz of [-0.17, 0.17]) {
              addPart('iron', new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6), [cx + lx, 0.23, lz], tMat);
            }
          }
        }

        // Octagonal canvas parasol with wooden mast & terracotta valance trim
        addPart('wood', new THREE.CylinderGeometry(0.035, 0.042, 2.25, 8), [0, 1.12, 0], tMat);
        addPart('canvas', new THREE.ConeGeometry(1.22, 0.48, 8), [0, 2.15, 0], tMat);
        addPart('terracotta', new THREE.CylinderGeometry(1.23, 1.25, 0.11, 8, 1, true), [0, 1.88, 0], tMat);
        addPart('wood', new THREE.SphereGeometry(0.06, 8, 6), [0, 2.42, 0], tMat);
      }

      // Vintage Two-Wheeled Wooden Flower Cart on the open cobblestone plaza at (5.3, -10.2)
      {
        const fx = 5.3;
        const fz = -10.2;
        const fy = getGhibliValleyHeight(fx, fz) + 0.04;
        const fMat = new THREE.Matrix4().compose(
          new THREE.Vector3(fx, fy, fz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.58, 0)),
          new THREE.Vector3(1, 1, 1)
        );
        this.contactAoSpots.push({ x: fx, z: fz, rx: 1.35, rz: 0.95, rotY: 0.58, strength: 0.46 });

        // Cart bed, side rails, handles & front prop legs (raised cleanly so wheels sit on top of cobbles)
        addPart('wood', new THREE.BoxGeometry(1.48, 0.10, 0.92), [0, 0.58, 0], fMat);
        addPart('wood', new THREE.BoxGeometry(1.52, 0.22, 0.05), [0, 0.72, -0.44], fMat);
        addPart('wood', new THREE.BoxGeometry(1.52, 0.22, 0.05), [0, 0.72, 0.44], fMat);
        addPart('wood', new THREE.BoxGeometry(0.65, 0.06, 0.06), [-0.98, 0.62, -0.34], fMat, [0, 0, 0.12]);
        addPart('wood', new THREE.BoxGeometry(0.65, 0.06, 0.06), [-0.98, 0.62, 0.34], fMat, [0, 0, 0.12]);
        addPart('wood', new THREE.BoxGeometry(0.06, 0.56, 0.06), [-0.54, 0.28, -0.36], fMat);
        addPart('wood', new THREE.BoxGeometry(0.06, 0.56, 0.06), [-0.54, 0.28, 0.36], fMat);

        // Two true spoked wooden carriage wheels (iron tire hoop + wooden felloe rim + hub + 8 radial spokes)
        for (const wz of [-0.52, 0.52]) {
          addPart('iron', new THREE.TorusGeometry(0.37, 0.022, 8, 22), [0.22, 0.38, wz], fMat);
          addPart('wood', new THREE.TorusGeometry(0.34, 0.026, 8, 22), [0.22, 0.38, wz], fMat);
          addPart('wood', new THREE.CylinderGeometry(0.072, 0.072, 0.13, 10), [0.22, 0.38, wz], fMat, [Math.PI / 2, 0, 0]);
          addPart('iron', new THREE.CylinderGeometry(0.042, 0.042, 0.16, 8), [0.22, 0.38, wz], fMat, [Math.PI / 2, 0, 0]);
          for (let sp = 0; sp < 4; sp++) {
            addPart('wood', new THREE.CylinderGeometry(0.017, 0.017, 0.66, 6), [0.22, 0.38, wz], fMat, [0, 0, (sp * Math.PI) / 4]);
          }
        }

        // Tiered wooden crates with leafy green foliage tufts and small organic wildflower bouquets
        const cartPalette = ['#d85a7f', '#f4c852', '#f7f1e3', '#e07254', '#94b8f0', '#c95c8c'];
        addPart('wood', new THREE.BoxGeometry(1.26, 0.22, 0.34), [0.10, 0.72, -0.18], fMat);
        addPart('wood', new THREE.BoxGeometry(1.26, 0.28, 0.34), [0.10, 0.80, 0.18], fMat);
        for (let i = 0; i < 11; i++) {
          const cx = -0.42 + i * 0.105;
          const jz = Math.sin(i * 2.3) * 0.06;
          addPart('flowers', new THREE.DodecahedronGeometry(0.082, 0), [cx, 0.85, -0.18 + jz], fMat, [i * 0.5, i * 0.8, 0], '#3b6e28');
          addPart('flowers', new THREE.DodecahedronGeometry(0.055, 0), [cx + 0.02, 0.92 + (i % 3) * 0.025, -0.19 - jz], fMat, [i * 0.4, i * 1.1, 0], cartPalette[i % cartPalette.length]);
          addPart('flowers', new THREE.DodecahedronGeometry(0.085, 0), [cx, 0.96, 0.18 - jz], fMat, [i * 0.7, i * 0.3, 0], '#356624');
          addPart('flowers', new THREE.DodecahedronGeometry(0.058, 0), [cx - 0.02, 1.04 + ((i + 1) % 3) * 0.025, 0.17 + jz], fMat, [i * 0.9, i * 0.6, 0], cartPalette[(i + 2) % cartPalette.length]);
        }
        addPart('terracotta', new THREE.CylinderGeometry(0.16, 0.12, 0.24, 8), [-0.46, 0.74, 0.0], fMat);
        addPart('flowers', new THREE.DodecahedronGeometry(0.09, 0), [-0.46, 0.87, 0.0], fMat, [0.4, 0.8, 0], '#3b6e28');
        addPart('flowers', new THREE.DodecahedronGeometry(0.065, 0), [-0.46, 0.94, 0.02], fMat, [0.8, 0.3, 0], '#f4c852');
      }

      // Weathered Wooden Stave Barrels & Provisions Crates beside the Bakery & Windmill
      const barrelSpots: Array<[number, number, number]> = [
        [8.2, -12.4, 1.0],
        [8.7, -11.8, 0.88],
        [7.6, -12.8, 0.82]
      ];
      for (const [brx, brz, s] of barrelSpots) {
        const bry = getGhibliValleyHeight(brx, brz) + 0.02;
        const brMat = new THREE.Matrix4().compose(
          new THREE.Vector3(brx, bry, brz),
          new THREE.Quaternion(),
          new THREE.Vector3(s, s, s)
        );
        addPart('wood', new THREE.CylinderGeometry(0.30, 0.30, 0.78, 12), [0, 0.39, 0], brMat);
        addPart('iron', new THREE.CylinderGeometry(0.312, 0.312, 0.045, 12), [0, 0.22, 0], brMat);
        addPart('iron', new THREE.CylinderGeometry(0.312, 0.312, 0.045, 12), [0, 0.56, 0], brMat);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Town Hillside Cottages & Expanded Upper/Eastern Slope Cottages (10 Cottages!)
    // -------------------------------------------------------------------------
    const cottages: CottageSpec[] = [
      { x: -10.5, z: -16.5, w: 4.4, h: 3.4, d: 3.8, rotY: -2.36, roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, flowerBox: true, stories: 2 },
      { x: -14.2, z: -22.5, w: 4.2, h: 2.9, d: 3.5, rotY: -2.55, roofStyle: 'teal', roofType: 'hip', chimney: true, balcony: true, flowerBox: true },
      { x: 18.2, z: -21.2, w: 4.6, h: 3.2, d: 3.8, rotY: 2.52, roofStyle: 'teal', roofType: 'gable', chimney: true, dormer: true, flowerBox: true },
      { x: 24.5, z: -2.2, w: 4.0, h: 2.8, d: 3.4, rotY: 2.35, roofStyle: 'terracotta', roofType: 'hip', chimney: false, flowerBox: true },
      { x: -12.5, z: 27.0, w: 4.8, h: 3.1, d: 3.9, rotY: -0.45, roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, flowerBox: true },
      { x: 18.5, z: 28.5, w: 4.1, h: 2.7, d: 3.4, rotY: 0.52, roofStyle: 'teal', roofType: 'hip', chimney: false, flowerBox: true },
      // 4 Expanded Hillside Cottages along the Eastern & Upper Slopes
      { x: 31.5, z: -12.5, w: 4.6, h: 3.4, d: 3.8, rotY: 2.38, roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, balcony: true, flowerBox: true, stories: 2 },
      { x: 34.0, z: 8.5, w: 4.3, h: 3.0, d: 3.6, rotY: 2.12, roofStyle: 'teal', roofType: 'hip', chimney: true, flowerBox: true },
      { x: 26.5, z: 36.0, w: 4.7, h: 3.4, d: 3.9, rotY: 0.62, roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, flowerBox: true, stories: 2 },
      { x: -24.5, z: 38.0, w: 4.4, h: 3.1, d: 3.7, rotY: -0.56, roofStyle: 'teal', roofType: 'gable', chimney: true, balcony: true, flowerBox: true },
      // Extended Upper Road Cottages (z = 54..84)
      { x: 16.5, z: 58.0, w: 4.6, h: 3.2, d: 3.8, rotY: 0.72, roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, flowerBox: true },
      { x: -18.5, z: 72.0, w: 4.8, h: 3.4, d: 4.0, rotY: -0.68, roofStyle: 'teal', roofType: 'hip', chimney: true, balcony: true, flowerBox: true, stories: 2 },
      // 2 Scenic Distant Coastal Hillside Cottages along the Extended Bay Curve (East & West Bay Clusters)
      { x: 76.0, z: -15.5, w: 4.8, h: 3.4, d: 4.0, rotY: 2.58, roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, balcony: true, flowerBox: true, stories: 2 },
      { x: -91.0, z: -13.5, w: 4.6, h: 3.2, d: 3.8, rotY: -2.52, roofStyle: 'teal', roofType: 'gable', chimney: true, dormer: true, flowerBox: true, stories: 2 }
    ];

    for (const c of cottages) {
      const cy = getGhibliValleyHeight(c.x, c.z) - 0.15;
      const cMat = new THREE.Matrix4().compose(
        new THREE.Vector3(c.x, cy, c.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      this.exclusionCircles.push({ x: c.x, z: c.z, r: Math.max(c.w, c.d) * 0.72 + 1.2 });
      this.contactAoSpots.push({
        x: c.x,
        z: c.z,
        rx: c.w * 0.72 + 0.85,
        rz: c.d * 0.72 + 0.85,
        rotY: c.rotY,
        strength: 0.50
      });

      // Carved stone plinth + beveled stone water-table cap
      addPart('stone', new THREE.BoxGeometry(c.w + 0.36, 1.45, c.d + 0.36), [0, -0.32, 0], cMat);
      addPart('stone', new THREE.BoxGeometry(c.w + 0.50, 0.14, c.d + 0.50), [0, 0.36, 0], cMat);

      const wallGeo = applyVerticalAoColor(new THREE.BoxGeometry(c.w, c.h, c.d, 1, 4, 1), -c.h * 0.5, c.h * 0.5, 0.74, 1.0);
      addPart('wall', wallGeo, [0, c.h * 0.5 + 0.35, 0], cMat);

      for (const sx of [-c.w * 0.5, c.w * 0.5]) {
        for (const sz of [-c.d * 0.5, c.d * 0.5]) {
          addPart('wood', new THREE.BoxGeometry(0.18, c.h, 0.18), [sx, c.h * 0.5 + 0.35, sz], cMat);
        }
      }
      // Horizontal timber belt & top wall plate
      addPart('wood', new THREE.BoxGeometry(c.w + 0.16, 0.16, c.d + 0.16), [0, 2.25, 0], cMat);

      const roofBucket = c.roofStyle === 'terracotta' ? 'terracotta' : 'teal';
      const roofH = c.roofType === 'gable' ? 1.85 : 1.75;
      const roofGeo =
        c.roofType === 'gable'
          ? createGableRoofGeometry(c.w + 0.75, roofH, c.d + 0.75)
          : createHipRoofGeometry(c.w + 0.75, roofH, c.d + 0.75);
      addPart(roofBucket, roofGeo, [0, c.h + 0.32, 0], cMat);
      addRoofBargeboardsAndRafters(c.w + 0.75, roofH, c.d + 0.75, c.h + 0.32, c.roofType, cMat, false);

      addPart('wood', new THREE.BoxGeometry(0.86, 1.65, 0.10), [-0.75, 1.18, -c.d * 0.5 - 0.03], cMat);
      addPart('wood', new THREE.BoxGeometry(1.04, 0.14, 0.16), [-0.75, 2.04, -c.d * 0.5 - 0.04], cMat);
      // 3-step stone entrance garden stairs
      for (let st = 0; st < 3; st++) {
        addPart('stone', new THREE.BoxGeometry(1.22, 0.15, 0.32), [-0.75, 0.32 - st * 0.13, -c.d * 0.5 - 0.24 - st * 0.28], cMat);
      }
      addPart('glow', new THREE.BoxGeometry(0.32, 0.38, 0.03), [-0.75, 1.52, -c.d * 0.5 - 0.065], cMat);
      addPart('glass', new THREE.BoxGeometry(0.38, 0.42, 0.025), [-0.75, 1.52, -c.d * 0.5 - 0.088], cMat);
      addPart('wood', new THREE.BoxGeometry(0.032, 0.42, 0.035), [-0.75, 1.52, -c.d * 0.5 - 0.095], cMat);
      addPart('wood', new THREE.BoxGeometry(0.38, 0.032, 0.035), [-0.75, 1.52, -c.d * 0.5 - 0.095], cMat);
      addFramedWindow([0.85, 1.55, -c.d * 0.5 - 0.03], 0.90, 0.80, 'front', cMat, true);
      addFramedWindow([0.85, 1.55, c.d * 0.5 + 0.03], 0.88, 0.78, 'back', cMat, true);
      addFramedWindow([-c.w * 0.5 - 0.03, 1.55, 0], 0.82, 0.78, 'left', cMat, true);
      addFramedWindow([c.w * 0.5 + 0.03, 1.55, 0], 0.82, 0.78, 'right', cMat, true);

      if (c.stories === 2) {
        addFramedWindow([-0.85, 2.95, -c.d * 0.5 - 0.03], 0.80, 0.72, 'front', cMat, true);
        addFramedWindow([0.85, 2.95, -c.d * 0.5 - 0.03], 0.80, 0.72, 'front', cMat, true);
        addFramedWindow([0.0, 2.95, c.d * 0.5 + 0.03], 0.80, 0.72, 'back', cMat, false);
      }

      if (c.dormer) {
        const dWall = applyVerticalAoColor(new THREE.BoxGeometry(1.05, 0.85, 0.9), -0.42, 0.42, 0.80, 1.0);
        addPart('wall', dWall, [0, c.h + 0.85, -0.75], cMat);
        addPart(roofBucket, createGableRoofGeometry(1.28, 0.55, 1.08), [0, c.h + 1.28, -0.75], cMat);
        addRoofBargeboardsAndRafters(1.28, 0.55, 1.08, c.h + 1.28, 'gable', new THREE.Matrix4().multiplyMatrices(cMat, new THREE.Matrix4().makeTranslation(0, 0, -0.75)), true);
        addFramedWindow([0, c.h + 0.82, -1.21], 0.52, 0.46, 'front', cMat, false);
      }

      if (c.balcony) {
        addPart('wood', new THREE.BoxGeometry(2.4, 0.14, 1.05), [0, 1.95, -c.d * 0.5 - 0.52], cMat);
        addPart('wood', new THREE.BoxGeometry(2.4, 0.10, 0.10), [0, 2.55, -c.d * 0.5 - 1.0], cMat);
        for (let bxOff = -1.05; bxOff <= 1.06; bxOff += 0.42) {
          addPart('wood', new THREE.BoxGeometry(0.08, 0.62, 0.08), [bxOff, 2.26, -c.d * 0.5 - 1.0], cMat);
        }
      }

      if (c.flowerBox) {
        const cottageFlorals = ['#d85a7f', '#f4c852', '#f7f1e3', '#e07254', '#c95c8c'];
        addPart('wood', new THREE.BoxGeometry(1.05, 0.20, 0.28), [0.85, 0.96, -c.d * 0.5 - 0.16], cMat);
        for (let fb = -3; fb <= 3; fb++) {
          const fx = 0.85 + fb * 0.125;
          addPart('flowers', new THREE.DodecahedronGeometry(0.072, 0), [fx, 1.07, -c.d * 0.5 - 0.16], cMat, [fb * 0.4, fb * 0.8, 0], '#3b6e28');
          addPart('flowers', new THREE.DodecahedronGeometry(0.052, 0), [fx, 1.13 + (fb % 2) * 0.025, -c.d * 0.5 - 0.17], cMat, [fb * 0.7, fb * 0.3, 0], cottageFlorals[Math.abs(fb) % cottageFlorals.length]);
        }
      }

      if (c.chimney) {
        addPart('stone', new THREE.BoxGeometry(0.68, 2.3, 0.68), [-c.w * 0.28, c.h + 1.25, c.d * 0.22], cMat);
        addPart('stone', new THREE.BoxGeometry(0.84, 0.18, 0.84), [-c.w * 0.28, c.h + 2.42, c.d * 0.22], cMat);
        addChimneyPot(-c.w * 0.28, c.h + 2.51, c.d * 0.22, cMat);
        const chimPos = new THREE.Vector3(-c.w * 0.28, c.h + 2.95, c.d * 0.22).applyMatrix4(cMat);
        chimneyPositions.push({ x: chimPos.x, y: chimPos.y, z: chimPos.z });
      }
    }

    // -------------------------------------------------------------------------
    // 2b. Two Scenic Distant Coastal Bell-Tower Clusters along the Extended Bay Curve
    // -------------------------------------------------------------------------
    const bellTowers: Array<{ x: number; z: number; rotY: number; roofStyle: 'terracotta' | 'teal' }> = [
      { x: 82.5, z: -17.5, rotY: 2.65, roofStyle: 'terracotta' },
      { x: -97.5, z: -15.5, rotY: -2.62, roofStyle: 'teal' }
    ];
    for (const bt of bellTowers) {
      const bty = getGhibliValleyHeight(bt.x, bt.z) - 0.15;
      const btMat = new THREE.Matrix4().compose(
        new THREE.Vector3(bt.x, bty, bt.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, bt.rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      this.exclusionCircles.push({ x: bt.x, z: bt.z, r: 4.2 });
      this.contactAoSpots.push({ x: bt.x, z: bt.z, rx: 3.2, rz: 3.2, rotY: bt.rotY, strength: 0.52 });

      // Stone masonry base terrace & battered lower tower plinth
      addPart('stone', new THREE.BoxGeometry(3.8, 1.5, 3.8), [0, 0.25, 0], btMat);
      addPart('stone', new THREE.BoxGeometry(3.2, 2.2, 3.2), [0, 1.85, 0], btMat);
      addPart('stone', new THREE.BoxGeometry(3.45, 0.18, 3.45), [0, 2.98, 0], btMat);

      // Plaster middle tower shaft with timber corner pilasters & narrow arched windows
      const shaftGeo = applyVerticalAoColor(new THREE.BoxGeometry(2.75, 4.2, 2.75, 1, 4, 1), -2.1, 2.1, 0.78, 1.0);
      addPart('wall', shaftGeo, [0, 5.15, 0], btMat);
      for (const sx of [-1.36, 1.36]) {
        for (const sz of [-1.36, 1.36]) {
          addPart('wood', new THREE.BoxGeometry(0.18, 4.25, 0.18), [sx, 5.15, sz], btMat);
        }
      }
      addFramedWindow([0, 5.2, -1.40], 0.62, 0.96, 'front', btMat, false);
      addFramedWindow([0, 5.2, 1.40], 0.62, 0.96, 'back', btMat, false);

      // Open belfry gallery deck (y = 7.25..9.35) with 4 stone corner piers, warm belfry glow & hanging bell
      addPart('stone', new THREE.BoxGeometry(3.05, 0.22, 3.05), [0, 7.35, 0], btMat);
      for (const px of [-1.15, 1.15]) {
        for (const pz of [-1.15, 1.15]) {
          addPart('stone', new THREE.BoxGeometry(0.36, 2.0, 0.36), [px, 8.45, pz], btMat);
        }
      }
      addPart('wood', new THREE.BoxGeometry(2.6, 0.16, 0.18), [0, 8.95, 0], btMat);
      addPart('iron', new THREE.CylinderGeometry(0.24, 0.42, 0.62, 12), [0, 8.42, 0], btMat);
      addPart('glow', new THREE.SphereGeometry(0.22, 8, 8), [0, 8.15, 0], btMat);

      // Steep pyramidal coastal bell-tower roof with eaves & wrought-iron weathervane finial
      const roofBucket = bt.roofStyle === 'terracotta' ? 'terracotta' : 'teal';
      addPart(roofBucket, new THREE.ConeGeometry(2.45, 2.55, 4), [0, 10.68, 0], btMat, [0, Math.PI * 0.25, 0]);
      addPart('wood', new THREE.BoxGeometry(3.25, 0.14, 3.25), [0, 9.46, 0], btMat);
      addPart('iron', new THREE.CylinderGeometry(0.035, 0.045, 0.95, 6), [0, 12.25, 0], btMat);
      addPart('iron', new THREE.BoxGeometry(0.55, 0.05, 0.04), [0, 12.48, 0], btMat);
    }

    // -------------------------------------------------------------------------
    // 3. Low Stone Garden Walls & Terraced Garden Stone Stairs
    // -------------------------------------------------------------------------
    const wallRuns = [
      { x1: -6.8, z1: -11.5, x2: -10.2, z2: -12.6 },
      { x1: 8.5, z1: -14.8, x2: 14.5, z2: -18.5 },
      { x1: -9.5, z1: 23.0, x2: -4.0, z2: 24.5 },
      { x1: 23.5, z1: -5.5, x2: 29.0, z2: -9.5 },
      { x1: 72.0, z1: -20.5, x2: 86.0, z2: -22.0 },
      { x1: -86.0, z1: -18.5, x2: -101.0, z2: -20.0 }
    ];
    for (const wr of wallRuns) {
      const xm = (wr.x1 + wr.x2) * 0.5;
      const zm = (wr.z1 + wr.z2) * 0.5;
      const len = Math.hypot(wr.x2 - wr.x1, wr.z2 - wr.z1);
      const yaw = -Math.atan2(wr.z2 - wr.z1, wr.x2 - wr.x1);
      const ym = getGhibliValleyHeight(xm, zm);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(xm, ym, zm),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      addPart('stone', new THREE.BoxGeometry(len, 0.78, 0.42), [0, 0.14, 0], m);
      addPart('stone', new THREE.BoxGeometry(len + 0.1, 0.12, 0.54), [0, 0.56, 0], m);
      // Stone corner gate piers
      addPart('stone', new THREE.BoxGeometry(0.56, 1.05, 0.56), [-len * 0.5, 0.28, 0], m);
      addPart('stone', new THREE.BoxGeometry(0.56, 1.05, 0.56), [len * 0.5, 0.28, 0], m);
      this.contactAoSpots.push({ x: xm, z: zm, rx: len * 0.56, rz: 0.65, rotY: yaw, strength: 0.42 });
    }

    // Sloped stone garden stair path linking the village walkway toward the Spirit Camphor hillock
    for (let st = 0; st < 7; st++) {
      const sx = -5.6 - st * 0.78;
      const sz = -10.8 + st * 0.14;
      const sy = getGhibliValleyHeight(sx, sz) - 0.08;
      const sMat = new THREE.Matrix4().compose(
        new THREE.Vector3(sx, sy, sz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.18, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      addPart('stone', new THREE.BoxGeometry(0.76, 0.34, 1.28), [0, 0, 0], sMat);
    }

    const villageGroup = new THREE.Group();
    villageGroup.name = 'GhibliHillsideVillage';

    const finishBucket = (key: keyof typeof buckets, mat: THREE.Material, name: string, shadow = true) => {
      const list = buckets[key];
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat);
        mesh.name = name;
        mesh.castShadow = shadow;
        mesh.receiveShadow = shadow;
        villageGroup.add(mesh);
      }
    };

    finishBucket('wall', wallMat, 'VillageCreamWalls');
    finishBucket('terracotta', terracottaMat, 'VillageTerracottaRoofs');
    finishBucket('teal', tealRoofMat, 'VillageTealRoofs');
    finishBucket('stone', stoneMat, 'VillageStonePlinths');
    finishBucket('wood', woodMat, 'VillageTimberTrim');
    finishBucket('interior', interiorRoomMat, 'VillageWindowInteriorRooms', false);
    finishBucket('glow', windowGlowMat, 'VillageWarmWindows', false);
    finishBucket('glass', windowGlassMat, 'VillageReflectiveWindowGlass', false);
    finishBucket('shutter', shutterMat, 'VillageWindowShutters');
    finishBucket('iron', ironHingeMat, 'VillageWroughtIronHardware');
    finishBucket('canvas', sailCanvasMat, 'VillageCafeParasols');
    finishBucket('flowers', flowerClusterMat, 'VillageFlowerBoxes');

    // -------------------------------------------------------------------------
    // 4. Fluttering Colorful Laundry Clotheslines
    // -------------------------------------------------------------------------
    this.clothMaterial = createGhibliClothMaterial();
    this.buildClothesline(villageGroup, woodMat, [-12.2, -18.8], [-16.2, -20.8]);
    this.buildClothesline(villageGroup, woodMat, [10.8, 25.0], [16.2, 24.0]);

    this.scene.add(villageGroup);
    return chimneyPositions;
  }

  private buildClothesline(
    parent: THREE.Group,
    woodMat: THREE.Material,
    p1: [number, number],
    p2: [number, number]
  ): void {
    const y1 = getGhibliValleyHeight(p1[0], p1[1]);
    const y2 = getGhibliValleyHeight(p2[0], p2[1]);
    const postH = 2.45;

    const postGeos: THREE.BufferGeometry[] = [];
    for (const [px, py, pz] of [
      [p1[0], y1, p1[1]],
      [p2[0], y2, p2[1]]
    ]) {
      const pole = new THREE.CylinderGeometry(0.06, 0.08, postH + 0.5, 6);
      pole.translate(px, py + postH * 0.5 - 0.25, pz);
      postGeos.push(prepareForMerge(pole));
      pole.dispose();
    }

    const start = new THREE.Vector3(p1[0], y1 + postH - 0.15, p1[1]);
    const end = new THREE.Vector3(p2[0], y2 + postH - 0.15, p2[1]);
    const mid = start.clone().lerp(end, 0.5);
    mid.y -= 0.32;
    const ropeCurve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const ropeGeo = new THREE.TubeGeometry(ropeCurve, 16, 0.02, 4, false);
    postGeos.push(prepareForMerge(ropeGeo));
    ropeGeo.dispose();

    const mergedPosts = mergeGeometries(postGeos, false);
    postGeos.forEach((g) => g.dispose());
    if (mergedPosts) {
      const postMesh = new THREE.Mesh(mergedPosts, woodMat);
      postMesh.name = 'ClotheslinePostsAndRope';
      postMesh.castShadow = true;
      postMesh.frustumCulled = false;
      parent.add(postMesh);
    }

    const clothColors = ['#fef7e4', '#86c5f4', '#f79892', '#f7df79', '#a6d99a', '#e8b6dc'];
    const clothGeos: THREE.BufferGeometry[] = [];
    const tangent = new THREE.Vector3();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < 6; i++) {
      const t = 0.14 + (i / 5) * 0.72;
      const pt = ropeCurve.getPointAt(t);
      ropeCurve.getTangentAt(t, tangent);
      const yaw = Math.atan2(tangent.x, tangent.z) - Math.PI * 0.5;

      const w = i % 2 === 0 ? 0.56 : 0.72;
      const h = i % 3 === 0 ? 0.92 : 0.68;
      const g = new THREE.PlaneGeometry(w, h, 4, 6);
      g.translate(0, -h * 0.5, 0);
      g.rotateY(yaw);
      g.translate(pt.x, pt.y, pt.z);

      const nonIdx = g.index ? g.toNonIndexed() : g.clone();
      g.dispose();
      tmpColor.set(clothColors[i % clothColors.length]);
      const count = nonIdx.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let v = 0; v < count; v++) {
        colors[v * 3] = tmpColor.r;
        colors[v * 3 + 1] = tmpColor.g;
        colors[v * 3 + 2] = tmpColor.b;
      }
      nonIdx.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      clothGeos.push(nonIdx);
    }

    const mergedClothes = mergeGeometries(clothGeos, false);
    clothGeos.forEach((g) => g.dispose());
    if (mergedClothes && this.clothMaterial) {
      const clothesMesh = new THREE.Mesh(mergedClothes, this.clothMaterial);
      clothesMesh.name = 'FlutteringLaundryClothes';
      clothesMesh.frustumCulled = false;
      parent.add(clothesMesh);
    }
  }

  private buildChimneySmoke(
    chimneyPositions: Array<{ x: number; y: number; z: number }>,
    windDir2D: THREE.Vector2
  ): void {
    if (chimneyPositions.length === 0) return;

    const count = 210;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const origin = chimneyPositions[i % chimneyPositions.length];
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      phases[i] = Math.floor(i / chimneyPositions.length) / (count / chimneyPositions.length);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.smokeMaterial = createGhibliChimneySmokeMaterial(windDir2D);
    const points = new THREE.Points(geo, this.smokeMaterial);
    points.name = 'BakeryChimneySmoke';
    this.scene.add(points);
  }

  private createCrossedLeafCardGeometry(cardSize: number): THREE.BufferGeometry {
    const hs = cardSize * 0.5;
    const arch = cardSize * 0.14;
    // Two gently arched intersecting botanical cards so foliage clusters stay voluminous from every 360° angle
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

  private createFoliageCardMaterial(
    leafAtlas: THREE.Texture,
    sunDir: THREE.Vector3,
    windSpeed: number
  ): { material: THREE.MeshStandardMaterial; depthMaterial: THREE.MeshDepthMaterial } {
    const windUniform = {
      uTime: { value: 0.0 },
      uWindSpeed: { value: windSpeed }
    };
    this.foliageWindUniforms.push(windUniform);

    const material = new THREE.MeshStandardMaterial({
      map: leafAtlas,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.0
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniform.uTime;
      shader.uniforms.uWindSpeed = windUniform.uWindSpeed;
      shader.uniforms.uSunDirection = { value: sunDir.clone().normalize() };

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
          varying vec3 vLeafWorldPos;
          varying vec3 vLeafWorldNormal;`
        )
        .replace(
          '#include <opaque_fragment>',
          `vec3 leafViewDir = normalize(cameraPosition - vLeafWorldPos);
          vec3 leafSunDir = normalize(uSunDirection);
          float leafBacklit = pow(clamp(dot(leafViewDir, -leafSunDir), 0.0, 1.0), 2.1);
          float leafTopSun = clamp(dot(normalize(vLeafWorldNormal), leafSunDir) * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * (leafBacklit * 0.56 + leafTopSun * 0.24) * vec3(1.12, 1.22, 0.68);
          #include <opaque_fragment>`
        );
    };
    material.customProgramCacheKey = () => 'ghibli-botanical-foliage-v1';

    const depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: leafAtlas,
      alphaTest: 0.45,
      side: THREE.DoubleSide
    });
    this.extraMaterials.push(depthMaterial);

    return { material, depthMaterial };
  }

  private buildSpiritCamphorTree(
    pbr: PbrSceneAssets,
    sunDir: THREE.Vector3,
    _windDir2D: THREE.Vector2
  ): void {
    const tx = -16.5;
    const tz = -10.5;
    const ty = getGhibliValleyHeight(tx, tz) - 0.35;
    this.exclusionCircles.push({ x: tx, z: tz, r: 4.5 });
    this.contactAoSpots.push({ x: tx, z: tz, rx: 4.2, rz: 4.2, rotY: 0, strength: 0.68 });

    const treeGroup = new THREE.Group();
    treeGroup.name = 'SpiritCamphorTree';

    const barkMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.oakBark.map,
        normalMap: pbr.oakBark.normalMap,
        normalScale: new THREE.Vector2(1.9, 1.9),
        roughnessMap: pbr.oakBark.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.oakBark.aoMap,
        aoMapIntensity: 0.92,
        vertexColors: true
      }),
      {
        macroScale: 0.38,
        mossHeight: ty + 1.85,
        mossColor: '#3a5926',
        dampRoughness: 0.48,
        dirtTint: '#3e2d1e'
      }
    );

    // 1. Gnarled Crooked Trunk, Mossy Buttress Roots & Multi-Tier Spreading Oak/Camphor Limbs
    const trunkGeos: THREE.BufferGeometry[] = [];
    const pushBranch = (
      pts: Array<[number, number, number]>,
      rStart: number,
      rEnd: number,
      rSegs: number,
      tSegs: number,
      opts: Parameters<typeof createBranchTubeGeometry>[5]
    ) => {
      const vecPts = pts.map(([x, y, z]) => new THREE.Vector3(tx + x, ty + y, tz + z));
      const g = createBranchTubeGeometry(vecPts, rStart, rEnd, rSegs, tSegs, opts);
      trunkGeos.push(prepareForMerge(g, undefined, true));
      g.dispose();
    };

    // Core ancient crooked trunk (uvScale tuned for oakBark repeat 5x7)
    pushBranch(
      [
        [0, -0.5, 0],
        [-0.18, 1.4, 0.12],
        [0.14, 3.2, -0.10],
        [0.05, 5.2, 0.06],
        [-0.12, 6.9, 0.0]
      ],
      1.95,
      0.92,
      14,
      14,
      { furrowAmp: 0.11, buttressFluting: 0.36, mossHeightRatio: 0.52, rootAoRatio: 0.22, uvScaleU: 0.85, uvScaleV: 7.2, seed: 1.7 }
    );

    // 9 twisted sinuous buttress root extensions & forked tendrils gripping the hillside knoll
    for (let r = 0; r < 9; r++) {
      const ang = (r / 9) * Math.PI * 2 + 0.24;
      const twistAng1 = ang + ((r % 2 === 0 ? 1 : -1) * 0.14);
      const twistAng2 = ang + ((r % 2 === 0 ? -1 : 1) * 0.18);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const reach = 4.2 + (r % 3) * 0.45;
      const midX = tx + Math.cos(twistAng1) * (reach * 0.55);
      const midZ = tz + Math.sin(twistAng1) * (reach * 0.55);
      const endX = tx + Math.cos(twistAng2) * reach;
      const endZ = tz + Math.sin(twistAng2) * reach;
      const groundAtMid = getGhibliValleyHeight(midX, midZ) - ty + 0.06;
      const groundAtTip = getGhibliValleyHeight(endX, endZ) - ty - 0.28;
      pushBranch(
        [
          [ca * 0.72, 2.15, sa * 0.72],
          [Math.cos(twistAng1) * 1.65, 0.96, Math.sin(twistAng1) * 1.65],
          [midX - tx, groundAtMid, midZ - tz],
          [endX - tx, groundAtTip, endZ - tz]
        ],
        0.78,
        0.16,
        8,
        10,
        { furrowAmp: 0.10, mossHeightRatio: 0.88, rootAoRatio: 0.12, uvScaleU: 0.75, uvScaleV: 3.4, seed: r * 2.3 }
      );

      // Secondary root tendril branching laterally across the mossy turf
      const forkAng = twistAng2 + (r % 2 === 0 ? 0.48 : -0.48);
      const forkReach = reach * 0.95;
      const fx = tx + Math.cos(forkAng) * forkReach;
      const fz = tz + Math.sin(forkAng) * forkReach;
      const groundAtFork = getGhibliValleyHeight(fx, fz) - ty - 0.25;
      pushBranch(
        [
          [midX - tx, groundAtMid + 0.05, midZ - tz],
          [(midX - tx + fx - tx) * 0.5, (groundAtMid + groundAtFork) * 0.5 + 0.08, (midZ - tz + fz - tz) * 0.5],
          [fx - tx, groundAtFork, fz - tz]
        ],
        0.28,
        0.08,
        6,
        6,
        { furrowAmp: 0.08, mossHeightRatio: 0.92, rootAoRatio: 0.10, uvScaleU: 0.6, uvScaleV: 2.8, seed: r * 4.1 + 1.2 }
      );
    }

    // Crooked primary limbs + wide-spreading forked boughs creating airy sub-crowns with visible sky gaps
    const primaryLimbs: Array<{ pts: Array<[number, number, number]>; r0: number; r1: number; seed: number }> = [
      { pts: [[0.0, 4.8, 0.0], [-1.5, 6.2, 0.4], [-3.4, 7.8, 0.9], [-5.2, 9.2, 1.3]], r0: 0.86, r1: 0.30, seed: 3.1 },
      { pts: [[0.0, 5.0, 0.0], [1.6, 6.3, -0.4], [3.5, 7.9, -0.9], [5.3, 9.3, -1.2]], r0: 0.84, r1: 0.28, seed: 5.4 },
      { pts: [[0.0, 5.2, 0.0], [0.4, 6.6, 1.5], [1.0, 8.2, 3.2], [1.4, 9.6, 4.8]], r0: 0.80, r1: 0.26, seed: 7.2 },
      { pts: [[0.0, 5.0, 0.0], [-0.4, 6.4, -1.6], [-1.0, 8.0, -3.3], [-1.5, 9.5, -4.9]], r0: 0.80, r1: 0.26, seed: 9.8 },
      { pts: [[-0.1, 6.1, 0.0], [-1.3, 8.0, -1.4], [-2.7, 10.1, -2.4], [-3.8, 11.9, -3.1]], r0: 0.68, r1: 0.22, seed: 11.4 },
      { pts: [[0.1, 6.2, 0.0], [1.2, 8.2, 1.4], [2.6, 10.2, 2.3], [3.7, 12.1, 2.9]], r0: 0.68, r1: 0.22, seed: 13.9 },
      { pts: [[-0.08, 6.5, 0.05], [0.22, 8.8, -0.18], [-0.18, 11.2, 0.14], [0.06, 13.4, -0.08]], r0: 0.72, r1: 0.20, seed: 15.2 }
    ];

    const boughLeafAnchors: Array<{ x: number; y: number; z: number; radius: number }> = [];
    const rand = mulberry32(8421);

    for (const limb of primaryLimbs) {
      pushBranch(limb.pts, limb.r0, limb.r1, 9, 10, {
        furrowAmp: 0.08,
        mossHeightRatio: 0.22,
        rootAoRatio: 0.0,
        uvScaleU: 0.68,
        uvScaleV: 4.2,
        seed: limb.seed
      });

      // Secondary & tertiary forked sub-boughs radiating outward so interior branches and sky gaps remain visible
      const mid = limb.pts[2];
      const tip = limb.pts[3];
      boughLeafAnchors.push({ x: tip[0], y: tip[1] + 0.55, z: tip[2], radius: 1.82 });

      for (let s = 0; s < 3; s++) {
        const basePt = s === 0 ? mid : tip;
        const spreadAng = (s - 1) * 1.12 + (rand() - 0.5) * 0.42 + limb.seed;
        const dx = Math.cos(spreadAng) * (1.75 + rand() * 0.85);
        const dz = Math.sin(spreadAng) * (1.75 + rand() * 0.85);
        const dy = 0.75 + rand() * 1.15;
        const subTip: [number, number, number] = [basePt[0] + dx, basePt[1] + dy, basePt[2] + dz];
        pushBranch(
          [basePt, [(basePt[0] + subTip[0]) * 0.5, (basePt[1] + subTip[1]) * 0.5 + 0.28, (basePt[2] + subTip[2]) * 0.5], subTip],
          limb.r1 * 0.85,
          0.085,
          6,
          6,
          { furrowAmp: 0.06, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 0.58, uvScaleV: 3.4, seed: limb.seed + s * 3.1 }
        );
        boughLeafAnchors.push({ x: subTip[0], y: subTip[1] + 0.35, z: subTip[2], radius: 1.48 });
      }
    }

    // Distinct upper crown sub-canopies
    boughLeafAnchors.push({ x: 0.0, y: 13.8, z: 0.0, radius: 1.95 });
    boughLeafAnchors.push({ x: -2.1, y: 12.9, z: 1.8, radius: 1.65 });
    boughLeafAnchors.push({ x: 2.2, y: 12.8, z: -1.7, radius: 1.65 });

    const mergedTrunk = mergeGeometries(trunkGeos, false);
    trunkGeos.forEach((g) => g.dispose());
    if (mergedTrunk) {
      const trunkMesh = new THREE.Mesh(mergedTrunk, barkMat);
      trunkMesh.name = 'SpiritCamphorTrunk';
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;
      treeGroup.add(trunkMesh);
    }

    // Fine interior woody twigs (InstancedMesh) peeking inside the Spirit Camphor crown gaps
    const camphorTwigCount = 340;
    const camphorTwigGeo = createWoodyTwigSprayGeometry(2.7);
    const camphorTwigs = new THREE.InstancedMesh(camphorTwigGeo, barkMat, camphorTwigCount);
    camphorTwigs.name = 'SpiritCamphorTwigs';
    camphorTwigs.castShadow = true;
    camphorTwigs.receiveShadow = true;
    const twigDummy = new THREE.Matrix4();
    const twigPos = new THREE.Vector3();
    const twigQuat = new THREE.Quaternion();
    const twigEuler = new THREE.Euler();
    const twigScale = new THREE.Vector3();
    for (let t = 0; t < camphorTwigCount; t++) {
      const anchor = boughLeafAnchors[t % boughLeafAnchors.length];
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const rad = anchor.radius * (0.20 + 0.65 * Math.cbrt(rand()));
      const lx = anchor.x + rad * Math.sin(phi) * Math.cos(theta);
      const ly = anchor.y + rad * Math.cos(phi) * 0.72;
      const lz = anchor.z + rad * Math.sin(phi) * Math.sin(theta);
      twigPos.set(tx + lx, ty + ly, tz + lz);
      twigEuler.set((rand() - 0.5) * 1.4, rand() * Math.PI * 2, (rand() - 0.5) * 1.4);
      twigQuat.setFromEuler(twigEuler);
      const ts = 0.85 + rand() * 0.65;
      twigScale.set(ts, ts, ts);
      twigDummy.compose(twigPos, twigQuat, twigScale);
      camphorTwigs.setMatrixAt(t, twigDummy);
    }
    camphorTwigs.instanceMatrix.needsUpdate = true;
    treeGroup.add(camphorTwigs);

    // 2. Thousands of Airy Alpha-Tested Botanical Leaf-Card Sub-Crowns (deep core AO -> sunlit top shell)
    const leafCount = 2200;
    const leafCardGeo = this.createCrossedLeafCardGeometry(1.18);
    const { material: leafMat, depthMaterial: leafDepthMat } = this.createFoliageCardMaterial(
      pbr.leafAtlas,
      sunDir,
      this.currentConfig?.wind?.speed ?? 2.2
    );

    const foliageMesh = new THREE.InstancedMesh(leafCardGeo, leafMat, leafCount);
    foliageMesh.name = 'SpiritCamphorFoliage';
    foliageMesh.castShadow = true;
    foliageMesh.receiveShadow = true;
    foliageMesh.customDepthMaterial = leafDepthMat;

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();

    const innerShadowCol = new THREE.Color('#1a3d14');
    const midEmeraldCol = new THREE.Color('#4a922d');
    const sunlitGoldCol = new THREE.Color('#a8de54');

    const crownCenterY = 10.6;
    for (let i = 0; i < leafCount; i++) {
      const anchor = boughLeafAnchors[i % boughLeafAnchors.length];
      // Outer bough-shell clustering leaves open sky gaps and visible forked limbs in the interior
      const u1 = rand();
      const u2 = rand();
      const u3 = rand();
      const theta = u1 * Math.PI * 2;
      const phi = Math.acos(2 * u2 - 1);
      const r = anchor.radius * (0.42 + 0.58 * Math.cbrt(u3));

      const lx = anchor.x + r * Math.sin(phi) * Math.cos(theta);
      const ly = anchor.y + r * Math.cos(phi) * 0.72;
      const lz = anchor.z + r * Math.sin(phi) * Math.sin(theta);

      pos.set(tx + lx, ty + ly, tz + lz);
      euler.set((rand() - 0.5) * 1.3, rand() * Math.PI * 2, (rand() - 0.5) * 1.3);
      quat.setFromEuler(euler);
      const s = 0.72 + rand() * 0.52;
      scale.set(s, s * (0.9 + rand() * 0.25), s);
      dummy.compose(pos, quat, scale);
      foliageMesh.setMatrixAt(i, dummy);

      // Deep interior crown core AO + sunlit top-shell highlight
      const distFromCore = Math.hypot(lx, (ly - crownCenterY) * 1.15, lz) / 6.8;
      const subShellRatio = r / Math.max(0.1, anchor.radius);
      const heightRatio = Math.max(0, Math.min(1, (ly - 7.4) / 7.4));
      const sunDot = Math.max(0, (lx * sunDir.x + (ly - crownCenterY) * sunDir.y + lz * sunDir.z) / 5.5);
      const lightFactor = Math.max(0, Math.min(1, distFromCore * 0.34 + subShellRatio * 0.24 + heightRatio * 0.38 + sunDot * 0.24 + (rand() - 0.5) * 0.12));

      if (lightFactor < 0.44) {
        col.copy(innerShadowCol).lerp(midEmeraldCol, lightFactor / 0.44);
      } else {
        col.copy(midEmeraldCol).lerp(sunlitGoldCol, (lightFactor - 0.44) / 0.56);
      }
      foliageMesh.setColorAt(i, col);
    }
    foliageMesh.instanceMatrix.needsUpdate = true;
    if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
    treeGroup.add(foliageMesh);

    // 3. Mossy Stone Shrine Lantern & Wooden Shrine Gate beside the Camphor Tree
    const stoneMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.stoneMasonry.map,
        normalMap: pbr.stoneMasonry.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: pbr.stoneMasonry.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.stoneMasonry.aoMap
      }),
      {
        macroScale: 0.45,
        mossHeight: getGhibliValleyHeight(-12.5, -10.0) + 0.65,
        mossColor: '#3f6428',
        dampRoughness: 0.42,
        dirtTint: '#483f30'
      }
    );
    const gateWoodMat = new THREE.MeshStandardMaterial({
      map: pbr.timberWood.map,
      normalMap: pbr.timberWood.normalMap,
      color: '#a8503a',
      roughness: 0.74
    });
    const lanternCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffdf8a') });

    const lx = -12.5;
    const lz = -10.0;
    const ly = getGhibliValleyHeight(lx, lz);
    this.contactAoSpots.push({ x: lx, z: lz, rx: 0.78, rz: 0.78, rotY: 0, strength: 0.52 });
    const lanternGeos: THREE.BufferGeometry[] = [];
    const addLanternPart = (g: THREE.BufferGeometry, yOff: number) => {
      g.translate(lx, ly + yOff, lz);
      lanternGeos.push(prepareForMerge(g));
      g.dispose();
    };
    addLanternPart(new THREE.BoxGeometry(0.7, 0.25, 0.7), 0.12);
    addLanternPart(new THREE.CylinderGeometry(0.18, 0.22, 0.95, 6), 0.72);
    addLanternPart(new THREE.BoxGeometry(0.55, 0.12, 0.55), 1.24);
    addLanternPart(new THREE.ConeGeometry(0.56, 0.36, 4), 1.88);

    const mergedLantern = mergeGeometries(lanternGeos, false);
    lanternGeos.forEach((g) => g.dispose());
    if (mergedLantern) {
      const lanternMesh = new THREE.Mesh(mergedLantern, stoneMat);
      lanternMesh.name = 'MossyStoneLantern';
      lanternMesh.castShadow = true;
      lanternMesh.receiveShadow = true;
      treeGroup.add(lanternMesh);
    }
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), lanternCoreMat);
    core.position.set(lx, ly + 1.48, lz);
    treeGroup.add(core);

    const gx = -13.0;
    const gz = -7.2;
    const gy = getGhibliValleyHeight(gx, gz);
    this.contactAoSpots.push({ x: gx, z: gz, rx: 1.75, rz: 0.65, rotY: 0.52, strength: 0.45 });
    const gateGeos: THREE.BufferGeometry[] = [];
    const gateMat4 = new THREE.Matrix4().compose(
      new THREE.Vector3(gx, gy, gz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.52, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    const addGate = (g: THREE.BufferGeometry, px: number, py: number, pz: number) => {
      g.translate(px, py, pz);
      gateGeos.push(prepareForMerge(g, gateMat4));
      g.dispose();
    };
    addGate(new THREE.CylinderGeometry(0.14, 0.18, 2.9, 8), -1.05, 1.35, 0);
    addGate(new THREE.CylinderGeometry(0.14, 0.18, 2.9, 8), 1.05, 1.35, 0);
    addGate(new THREE.BoxGeometry(2.95, 0.22, 0.28), 0, 2.75, 0);
    addGate(new THREE.BoxGeometry(2.55, 0.16, 0.18), 0, 2.25, 0);
    const mergedGate = mergeGeometries(gateGeos, false);
    gateGeos.forEach((g) => g.dispose());
    if (mergedGate) {
      const gateMesh = new THREE.Mesh(mergedGate, gateWoodMat);
      gateMesh.name = 'SpiritShrineGate';
      gateMesh.castShadow = true;
      gateMesh.receiveShadow = true;
      treeGroup.add(gateMesh);
    }

    this.scene.add(treeGroup);
  }

  private buildHillsideTrees(
    pbr: PbrSceneAssets,
    sunDir: THREE.Vector3,
    _windDir2D: THREE.Vector2
  ): void {
    const spots: Array<[number, number, number]> = [
      [-26, -18, 1.15],
      [-28, -4, 1.05],
      [-25, 10, 1.2],
      [-28, 24, 1.1],
      [-22, 34, 1.0],
      [-6, 36, 0.95],
      [22, 32, 1.15],
      [27, 16, 1.2],
      [25, -4, 1.05],
      [26, -16, 1.15],
      [31, -24, 0.95],
      [-24, -25, 0.95],
      [34, 4, 1.25],
      [-34, 2, 1.2],
      [36, -12, 1.1],
      [-36, 18, 1.15],
      [20, 18, 0.95],
      [-18, 18, 1.0],
      [8, 42, 1.25],
      [-16, 44, 1.15],
      [24, 52, 1.3],
      [-28, 54, 1.25],
      [2, 58, 1.35],
      [-10, 62, 1.2],
      [36, 46, 1.2],
      // Additional grove framing the Western Headland Lighthouse & Eastern/Upper Village
      [-48, -14, 1.15],
      [-52, 6, 1.22],
      [-44, 26, 1.15],
      [44, -20, 1.18],
      [46, 14, 1.25],
      [42, 32, 1.20],
      // Extended Doubled Hillside & Coastal Bay Trees (R = 55..122m)
      [-74, -8, 1.20],
      [-80, 14, 1.26],
      [-72, 38, 1.22],
      [-58, 58, 1.30],
      [-34, 76, 1.24],
      [-8, 86, 1.28],
      [22, 82, 1.25],
      [48, 68, 1.32],
      [66, 44, 1.24],
      [76, 18, 1.20],
      [66, -10, 1.18],
      [94, -4, 1.22],
      [98, 22, 1.28],
      [88, 48, 1.25],
      [64, 76, 1.32],
      [34, 96, 1.30],
      [0, 104, 1.35],
      [-36, 98, 1.26],
      [-68, 82, 1.28],
      [-92, 54, 1.24],
      [-104, 26, 1.22],
      [-108, -2, 1.16],
      [112, 10, 1.20],
      [106, 40, 1.26],
      [-114, 40, 1.20]
    ];

    // Sculpted gnarled multi-limb skeletal trunk with root buttresses & interior forked branches (shared geometry)
    const trunkParts: THREE.BufferGeometry[] = [];
    const mainTrunk = createBranchTubeGeometry(
      [
        new THREE.Vector3(0, -0.25, 0),
        new THREE.Vector3(-0.08, 0.95, 0.05),
        new THREE.Vector3(0.06, 2.05, -0.04),
        new THREE.Vector3(0.0, 2.95, 0.0)
      ],
      0.38,
      0.16,
      8,
      7,
      { furrowAmp: 0.09, buttressFluting: 0.28, mossHeightRatio: 0.55, rootAoRatio: 0.25, uvScaleU: 0.45, uvScaleV: 5.5, seed: 2.1 }
    );
    trunkParts.push(prepareForMerge(mainTrunk, undefined, true));
    mainTrunk.dispose();

    // 4 flared root buttresses gripping the hillside
    for (let r = 0; r < 4; r++) {
      const rAng = (r / 4) * Math.PI * 2 + 0.4;
      const rca = Math.cos(rAng);
      const rsa = Math.sin(rAng);
      const rootGeo = createBranchTubeGeometry(
        [
          new THREE.Vector3(rca * 0.16, 0.55, rsa * 0.16),
          new THREE.Vector3(rca * 0.48, 0.14, rsa * 0.48),
          new THREE.Vector3(rca * 0.85, -0.22, rsa * 0.85)
        ],
        0.16,
        0.05,
        6,
        4,
        { furrowAmp: 0.07, mossHeightRatio: 0.85, rootAoRatio: 0.12, uvScaleU: 0.42, uvScaleV: 3.8, seed: 7.5 + r }
      );
      trunkParts.push(prepareForMerge(rootGeo, undefined, true));
      rootGeo.dispose();
    }

    const boughTips: Array<[number, number, number]> = [
      [-1.32, 3.92, 0.52],
      [1.36, 3.88, -0.48],
      [0.38, 4.05, 1.32],
      [-0.44, 3.98, -1.28],
      [0.06, 4.78, 0.06]
    ];
    boughTips.forEach(([bx, by, bz], idx) => {
      const branch = createBranchTubeGeometry(
        [
          new THREE.Vector3(0, 2.1, 0),
          new THREE.Vector3(bx * 0.52, 3.05, bz * 0.52),
          new THREE.Vector3(bx, by, bz)
        ],
        0.15,
        0.05,
        6,
        5,
        { furrowAmp: 0.07, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 0.48, uvScaleV: 4.0, seed: 4.5 + idx }
      );
      trunkParts.push(prepareForMerge(branch, undefined, true));
      branch.dispose();

      // Secondary interior forked branchlet off each bough tip
      const forkX = bx * 1.24 + (idx % 2 === 0 ? 0.36 : -0.36);
      const forkZ = bz * 1.24 + (idx % 2 === 0 ? -0.32 : 0.32);
      const forkY = by + 0.42;
      const fork = createBranchTubeGeometry(
        [
          new THREE.Vector3(bx * 0.72, (by + 2.9) * 0.52, bz * 0.72),
          new THREE.Vector3(forkX, forkY, forkZ)
        ],
        0.075,
        0.025,
        5,
        3,
        { furrowAmp: 0.05, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 0.45, uvScaleV: 3.5, seed: 9.1 + idx }
      );
      trunkParts.push(prepareForMerge(fork, undefined, true));
      fork.dispose();
    });

    const trunkGeo = mergeGeometries(trunkParts, false)!;
    trunkParts.forEach((g) => g.dispose());

    const trunkMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        map: pbr.oakBark.map,
        normalMap: pbr.oakBark.normalMap,
        normalScale: new THREE.Vector2(1.5, 1.5),
        roughnessMap: pbr.oakBark.roughnessMap,
        roughness: 1.0,
        aoMap: pbr.oakBark.aoMap,
        vertexColors: true
      }),
      {
        macroScale: 0.38,
        mossHeight: 1.5,
        mossColor: '#3a5926',
        dampRoughness: 0.48,
        dirtTint: '#3e2d1e'
      }
    );

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    trunks.name = 'HillsideTreeTrunks';
    trunks.castShadow = true;
    trunks.receiveShadow = true;

    // Fine interior woody twigs (InstancedMesh) peeking inside the airy broadleaf sub-crowns
    const twigsPerTree = 16;
    const twigGeo = createWoodyTwigSprayGeometry(5.1);
    const twigs = new THREE.InstancedMesh(twigGeo, trunkMat, spots.length * twigsPerTree);
    twigs.name = 'HillsideTreeTwigs';
    twigs.castShadow = true;
    twigs.receiveShadow = true;

    // Airy alpha-tested leaf-card sub-crowns (135 cards * 31 trees = 4,185)
    const cardsPerTree = 135;
    const totalLeafCards = spots.length * cardsPerTree;
    const leafGeo = this.createCrossedLeafCardGeometry(0.98);
    const { material: leafMat, depthMaterial: leafDepthMat } = this.createFoliageCardMaterial(
      pbr.leafAtlas,
      sunDir,
      this.currentConfig?.wind?.speed ?? 2.2
    );

    const foliage = new THREE.InstancedMesh(leafGeo, leafMat, totalLeafCards);
    foliage.name = 'HillsideTreeFoliage';
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    foliage.customDepthMaterial = leafDepthMat;

    const treeMat = new THREE.Matrix4();
    const cardMat = new THREE.Matrix4();
    const combinedMat = new THREE.Matrix4();
    const cardPos = new THREE.Vector3();
    const cardQuat = new THREE.Quaternion();
    const cardEuler = new THREE.Euler();
    const cardScale = new THREE.Vector3();
    const col = new THREE.Color();

    const innerCol = new THREE.Color('#1d4414');
    const midCol = new THREE.Color('#4a922d');
    const tipCol = new THREE.Color('#a4da4e');
    const rand = mulberry32(3197);

    let cardIdx = 0;
    let twigIdx = 0;
    spots.forEach(([x, z, s], i) => {
      const y = getGhibliValleyHeight(x, z) - 0.15;
      const yaw = i * 1.3;
      this.exclusionCircles.push({ x, z, r: 1.65 * s });
      this.contactAoSpots.push({ x, z, rx: 1.55 * s, rz: 1.55 * s, rotY: 0, strength: 0.52 });

      treeMat.compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(s, s, s)
      );
      trunks.setMatrixAt(i, treeMat);

      for (let t = 0; t < twigsPerTree; t++) {
        const anchor = boughTips[t % boughTips.length];
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        const rad = (0.20 + 0.65 * Math.cbrt(rand())) * 0.95;
        cardPos.set(
          anchor[0] + rad * Math.sin(phi) * Math.cos(theta),
          anchor[1] + rad * Math.cos(phi) * 0.72,
          anchor[2] + rad * Math.sin(phi) * Math.sin(theta)
        );
        cardEuler.set((rand() - 0.5) * 1.2, rand() * Math.PI * 2, (rand() - 0.5) * 1.2);
        cardQuat.setFromEuler(cardEuler);
        const ts = 0.58 + rand() * 0.42;
        cardScale.set(ts, ts, ts);
        cardMat.compose(cardPos, cardQuat, cardScale);
        combinedMat.multiplyMatrices(treeMat, cardMat);
        twigs.setMatrixAt(twigIdx++, combinedMat);
      }

      const treeHueJitter = (rand() - 0.5) * 0.08;
      for (let k = 0; k < cardsPerTree; k++) {
        const anchor = boughTips[k % boughTips.length];
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        // Tight bough sub-crown shell preserves airy sky gaps between the 5 distinct bough lobes
        const subShell = 0.40 + 0.60 * Math.cbrt(rand());
        const rad = subShell * 0.98;

        const lx = anchor[0] + rad * Math.sin(phi) * Math.cos(theta);
        const ly = anchor[1] + rad * Math.cos(phi) * 0.74;
        const lz = anchor[2] + rad * Math.sin(phi) * Math.sin(theta);

        cardPos.set(lx, ly, lz);
        cardEuler.set((rand() - 0.5) * 1.2, rand() * Math.PI * 2, (rand() - 0.5) * 1.2);
        cardQuat.setFromEuler(cardEuler);
        const cs = 0.70 + rand() * 0.48;
        cardScale.set(cs, cs, cs);
        cardMat.compose(cardPos, cardQuat, cardScale);
        combinedMat.multiplyMatrices(treeMat, cardMat);
        foliage.setMatrixAt(cardIdx, combinedMat);

        const distCore = Math.hypot(lx, ly - 3.9, lz) / 2.45;
        const hRatio = Math.max(0, Math.min(1, (ly - 2.8) / 2.9));
        const lf = Math.max(0, Math.min(1, distCore * 0.38 + subShell * 0.22 + hRatio * 0.40 + treeHueJitter + (rand() - 0.5) * 0.12));
        if (lf < 0.44) {
          col.copy(innerCol).lerp(midCol, lf / 0.44);
        } else {
          col.copy(midCol).lerp(tipCol, (lf - 0.44) / 0.56);
        }
        foliage.setColorAt(cardIdx, col);
        cardIdx++;
      }
    });

    trunks.instanceMatrix.needsUpdate = true;
    twigs.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;

    this.scene.add(trunks);
    this.scene.add(twigs);
    this.scene.add(foliage);
  }

  /**
   * Builds soft ground-hugging Contact AO grounding discs/skirts beneath every cottage,
   * windmill tower, tree base, garden wall, and shrine fixture so nothing ever floats.
   */
  private buildContactAoSkirts(): void {
    if (this.contactAoSpots.length === 0) return;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const ringSegs = 16;
    let vOff = 0;

    for (const spot of this.contactAoSpots) {
      const cosR = Math.cos(spot.rotY);
      const sinR = Math.sin(spot.rotY);
      const centerIdx = vOff;

      const cy = getGhibliValleyHeight(spot.x, spot.z) + 0.025;
      positions.push(spot.x, cy, spot.z);
      colors.push(0.05, 0.08, 0.03, spot.strength);
      vOff++;

      // Inner dark ring (45% radius) + outer feathered fade ring (100% radius, alpha=0)
      for (const [ringFrac, alphaFrac] of [
        [0.48, spot.strength * 0.72],
        [1.0, 0.0]
      ]) {
        for (let s = 0; s < ringSegs; s++) {
          const ang = (s / ringSegs) * Math.PI * 2;
          const lx = Math.cos(ang) * spot.rx * ringFrac;
          const lz = Math.sin(ang) * spot.rz * ringFrac;
          const wx = spot.x + lx * cosR + lz * sinR;
          const wz = spot.z - lx * sinR + lz * cosR;
          const wy = getGhibliValleyHeight(wx, wz) + 0.025;
          positions.push(wx, wy, wz);
          colors.push(0.05, 0.08, 0.03, alphaFrac);
          vOff++;
        }
      }

      const innerStart = centerIdx + 1;
      const outerStart = centerIdx + 1 + ringSegs;
      for (let s = 0; s < ringSegs; s++) {
        const sNext = (s + 1) % ringSegs;
        indices.push(centerIdx, innerStart + sNext, innerStart + s);
        indices.push(innerStart + s, innerStart + sNext, outerStart + sNext);
        indices.push(innerStart + s, outerStart + sNext, outerStart + s);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geo.setIndex(indices);

    const aoMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    const mesh = new THREE.Mesh(geo, aoMat);
    mesh.name = 'ContactAoGrounding';
    mesh.renderOrder = 1;
    this.scene.add(mesh);
  }

  private isExcludedFromFlora(x: number, z: number): boolean {
    const coastZ = getCoastlineZ(x);
    if (z < coastZ + 1.8) return true;
    const roadHalf = 1.60 + 0.36 * Math.max(0, Math.min(1, (z + 8) / 28));
    if (Math.abs(x - getGhibliRoadCenterX(z)) < roadHalf && z < 96.5) return true;
    if (x >= -4.8 && x <= 9.6 && z >= -19.0 && z <= -7.8) return true;
    if (z <= coastZ + 4.6 && Math.abs(x) < 108.5) return true;
    // Exclude terraced hillside rill water ribbon
    const rillCenterX = getGhibliRillCenterX(z);
    if (z >= -23.0 && z <= 27.0 && Math.abs(x - rillCenterX) < 1.35) return true;
    for (const c of this.exclusionCircles) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) return true;
    }
    return false;
  }

  private buildGrassAndWildflowers(sunDir: THREE.Vector3, windDir2D: THREE.Vector2): void {
    // 1. 96,000 Fuller 12-Blade Lush Coastal Grass Tufts via createGustWindGrassMaterial
    const grassCount = 96000;
    const tPos: number[] = [];
    const tNorm: number[] = [];
    const tUv: number[] = [];
    const tIdx: number[] = [];
    let vOffset = 0;

    // Stratum A: 6 broad, lush 0.18m..0.28m splayed turf blades (2 segs each)
    const lowCount = 6;
    for (let b = 0; b < lowCount; b++) {
      const ang = (b / lowCount) * Math.PI * 2 + 0.18;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const radOff = 0.045 + (b % 2) * 0.022;
      const H = 0.18 + ((b * 0.31) % 1.0) * 0.10;
      const lean = 0.11 + ((b * 0.47) % 1.0) * 0.06;
      const W0 = 0.052;
      const W1 = 0.032;

      const pushV = (lx: number, ly: number, lz: number, u: number, v: number) => {
        const wx = lx * ca - (lz + radOff) * sa + ca * 0.014;
        const wz = lx * sa + (lz + radOff) * ca + sa * 0.014;
        tPos.push(wx, ly, wz);
        const ny = 0.45 + v * 0.45;
        const nLen = Math.hypot(sa, ny, ca) || 1;
        tNorm.push(-sa / nLen, ny / nLen, ca / nLen);
        tUv.push(u, v * 0.65);
      };

      const baseV = vOffset;
      pushV(-W0 * 0.5, 0.0, 0.0, 0.0, 0.0);
      pushV(W0 * 0.5, 0.0, 0.0, 1.0, 0.0);
      pushV(-W1 * 0.5, 0.52 * H, lean * 0.42, 0.12, 0.52);
      pushV(W1 * 0.5, 0.52 * H, lean * 0.42, 0.88, 0.52);
      pushV(0.0, H, lean, 0.5, 1.0);
      vOffset += 5;

      tIdx.push(
        baseV, baseV + 1, baseV + 3,
        baseV, baseV + 3, baseV + 2,
        baseV + 2, baseV + 3, baseV + 4
      );
    }

    // Stratum B: 6 graceful curving 0.42m..0.64m meadow blades (3 segs each)
    const tallCount = 6;
    for (let b = 0; b < tallCount; b++) {
      const ang = (b / tallCount) * Math.PI * 2 + 0.52;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const radOff = 0.028 + (b % 2) * 0.018;
      const H = 0.42 + ((b * 0.39) % 1.0) * 0.22;
      const lean = 0.13 + ((b * 0.53) % 1.0) * 0.08;
      const W0 = 0.042;
      const W1 = 0.028;
      const W2 = 0.011;

      const pushV = (lx: number, ly: number, lz: number, u: number, v: number) => {
        const wx = lx * ca - (lz + radOff) * sa + ca * 0.01;
        const wz = lx * sa + (lz + radOff) * ca + sa * 0.01;
        tPos.push(wx, ly, wz);
        const ny = 0.35 + v * 0.45;
        const nLen = Math.hypot(sa, ny, ca) || 1;
        tNorm.push(-sa / nLen, ny / nLen, ca / nLen);
        tUv.push(u, v);
      };

      const baseV = vOffset;
      pushV(-W0 * 0.5, 0.0, 0.0, 0.0, 0.0);
      pushV(W0 * 0.5, 0.0, 0.0, 1.0, 0.0);
      pushV(-W1 * 0.5, 0.36 * H, lean * 0.22, 0.08, 0.36);
      pushV(W1 * 0.5, 0.36 * H, lean * 0.22, 0.92, 0.36);
      pushV(-W2 * 0.5, 0.72 * H, lean * 0.62, 0.2, 0.72);
      pushV(W2 * 0.5, 0.72 * H, lean * 0.62, 0.8, 0.72);
      pushV(0.0, H, lean, 0.5, 1.0);
      vOffset += 7;

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

    const windSpeed = this.currentConfig?.wind?.speed ?? 2.2;
    this.grassMaterial = createGustWindGrassMaterial({
      bladeHeight: 0.64,
      swayStrength: this.currentConfig?.wind?.swayIntensity ?? 0.92,
      warmTip: '#b4e856',
      coolRoot: '#1b4d24',
      sunDir
    });
    this.grassMaterial.uniforms.uWindDir.value.copy(windDir2D).normalize();
    this.grassMaterial.uniforms.uGustSpeed.value = Math.max(0.4, windSpeed * 0.7);
    this.grassMaterial.uniforms.uCloudCoverage.value = this.currentConfig?.sky?.cloudCoverage ?? 0.64;
    this.grassMaterial.uniforms.uCloudShadowStrength.value = 0.42;

    const grassMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, grassCount);
    grassMesh.name = 'InstancedGhibliGrass';

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const norm = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const alignQ = new THREE.Quaternion();
    const yawQ = new THREE.Quaternion();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const goldenAngle = 2.399963229728653;

    let placed = 0;
    // 4,500 lush low road-verge tufts hugging cobblestone curbs & promenade edges
    const vergeTuftTarget = 4500;
    for (let v = 0; placed < vergeTuftTarget && v < vergeTuftTarget * 3; v++) {
      const j1 = Math.abs(Math.sin(v * 31.713 + 2.1) * 28411.31) % 1.0;
      const j2 = Math.abs(Math.sin(v * 57.193 + 0.7) * 17913.67) % 1.0;
      const z = -26.0 + ((v + j1) / vergeTuftTarget) * 118.0;
      const side = v % 2 === 0 ? 1 : -1;
      const roadX = getGhibliRoadCenterX(z);
      const roadEdge = 1.66 + 0.40 * Math.max(0, Math.min(1, (z + 8) / 28));
      const x = roadX + side * (roadEdge + j2 * 1.45);

      if (this.isExcludedFromFlora(x, z)) continue;
      const y = getGhibliValleyHeight(x, z);
      if (y < 0.2) continue;

      pos.set(x, y, z);
      getGhibliValleyNormal(x, z, norm);
      alignQ.setFromUnitVectors(up, norm);
      yawQ.setFromAxisAngle(norm, j1 * Math.PI * 2);
      quat.multiplyQuaternions(yawQ, alignQ);
      scale.set(0.95 + j1 * 0.35, 0.56 + j2 * 0.42, 0.95 + j1 * 0.35);
      dummy.compose(pos, quat, scale);
      grassMesh.setMatrixAt(placed, dummy);
      col.set(v % 3 === 0 ? '#74ba3c' : v % 3 === 1 ? '#8ed048' : '#5ba032');
      grassMesh.setColorAt(placed, col);
      placed++;
    }

    // 62,000 ultra-dense foreground & village-hill tufts + 29,500 broad rolling outer hillside tufts
    const coreGrassTarget = 66500;
    for (let i = 0; placed < grassCount && i < grassCount * 3.5; i++) {
      const j1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1.0;
      const j2 = Math.abs(Math.sin(i * 78.233) * 19341.123) % 1.0;
      const isCore = placed < coreGrassTarget;
      const r = isCore
        ? 0.6 + Math.pow((i % (coreGrassTarget * 1.35)) / (coreGrassTarget * 1.35), 0.58) * 58.0
        : 44.0 + Math.pow(j1, 0.78) * 88.0;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.45;
      const x = r * Math.cos(theta) + (j1 - 0.5) * 0.9;
      const z = (isCore ? 6.0 : 18.0) + r * Math.sin(theta) + (j2 - 0.5) * 0.9;

      if (this.isExcludedFromFlora(x, z)) continue;

      const y = getGhibliValleyHeight(x, z);
      if (y < 0.2) continue;

      pos.set(x, y, z);
      getGhibliValleyNormal(x, z, norm);
      alignQ.setFromUnitVectors(up, norm);
      yawQ.setFromAxisAngle(norm, j1 * Math.PI * 2);
      quat.multiplyQuaternions(yawQ, alignQ);
      const wScale = isCore ? 1.02 + j1 * 0.42 : 1.24 + j1 * 0.48;
      const hScale = isCore ? 0.88 + j2 * 0.58 : 0.96 + j2 * 0.62;
      scale.set(wScale, hScale, wScale);
      dummy.compose(pos, quat, scale);
      grassMesh.setMatrixAt(placed, dummy);

      const mod = placed % 7;
      if (mod === 0 || mod === 3) {
        col.set('#9ed64c');
      } else if (mod === 1) {
        col.set('#78b83c');
      } else if (mod === 2) {
        col.set('#5ea034');
      } else if (mod === 4) {
        col.set('#b4e258');
      } else if (mod === 5) {
        col.set('#ced052');
      } else {
        col.set('#8bc444');
      }
      grassMesh.setColorAt(placed, col);
      placed++;
    }
    grassMesh.count = placed;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    this.scene.add(grassMesh);

    // 1B. 16,000 Lush Trifoliate Coastal Clover Clusters blanketing foreground & rolling hills
    const cloverCount = 16000;
    const cPos: number[] = [];
    const cNorm: number[] = [];
    const cUv: number[] = [];
    const cIdx: number[] = [];
    let cVOff = 0;
    for (let leaf = 0; leaf < 6; leaf++) {
      const ang = (leaf / 6) * Math.PI * 2 + (leaf % 2) * 0.25;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const dist = 0.045 + (leaf % 2) * 0.035;
      const h = 0.09 + (leaf % 3) * 0.035;
      const r = 0.068;
      const bx = ca * dist;
      const bz = sa * dist;
      const baseV = cVOff;
      cPos.push(bx, 0.01, bz);
      cPos.push(bx + ca * r - sa * r * 0.72, h, bz + sa * r + ca * r * 0.72);
      cPos.push(bx + ca * r * 1.25, h * 1.06, bz + sa * r * 1.25);
      cPos.push(bx + ca * r + sa * r * 0.72, h, bz + sa * r - ca * r * 0.72);
      for (let k = 0; k < 4; k++) {
        cNorm.push(0, 1, 0);
        cUv.push(k === 0 ? 0.5 : 0.8, k === 0 ? 0.15 : 0.85);
      }
      cIdx.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
      cVOff += 4;
    }
    const cloverGeo = new THREE.BufferGeometry();
    cloverGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
    cloverGeo.setAttribute('normal', new THREE.Float32BufferAttribute(cNorm, 3));
    cloverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cUv, 2));
    cloverGeo.setIndex(cIdx);

    this.cloverMaterial = createGustWindGrassMaterial({
      bladeHeight: 0.22,
      swayStrength: (this.currentConfig?.wind?.swayIntensity ?? 0.92) * 0.45,
      warmTip: '#7cd84e',
      coolRoot: '#184422',
      sunDir
    });
    this.cloverMaterial.uniforms.uWindDir.value.copy(windDir2D).normalize();
    this.cloverMaterial.uniforms.uGustSpeed.value = Math.max(0.4, windSpeed * 0.7);
    this.cloverMaterial.uniforms.uCloudCoverage.value = this.currentConfig?.sky?.cloudCoverage ?? 0.64;
    this.cloverMaterial.uniforms.uCloudShadowStrength.value = 0.42;

    const cloverMesh = new THREE.InstancedMesh(cloverGeo, this.cloverMaterial, cloverCount);
    cloverMesh.name = 'InstancedGhibliClovers';
    let cPlaced = 0;
    for (let i = 0; cPlaced < cloverCount && i < cloverCount * 3.5; i++) {
      const j1 = Math.abs(Math.sin(i * 23.141 + 0.9) * 37191.23) % 1.0;
      const j2 = Math.abs(Math.sin(i * 53.719 + 1.7) * 21319.87) % 1.0;
      const r = 1.0 + Math.pow((i % (cloverCount * 1.2)) / (cloverCount * 1.2), 0.62) * 74.0;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.55;
      const x = r * Math.cos(theta);
      const z = 8.0 + r * Math.sin(theta);

      if (this.isExcludedFromFlora(x, z)) continue;
      const y = getGhibliValleyHeight(x, z);
      if (y < 0.2) continue;

      pos.set(x, y, z);
      getGhibliValleyNormal(x, z, norm);
      alignQ.setFromUnitVectors(up, norm);
      yawQ.setFromAxisAngle(norm, j1 * Math.PI * 2);
      quat.multiplyQuaternions(yawQ, alignQ);
      const cs = 1.05 + j2 * 0.65;
      scale.set(cs, 0.85 + j1 * 0.45, cs);
      dummy.compose(pos, quat, scale);
      cloverMesh.setMatrixAt(cPlaced, dummy);
      col.set(cPlaced % 3 === 0 ? '#6ac244' : cPlaced % 3 === 1 ? '#52aa38' : '#84d450');
      cloverMesh.setColorAt(cPlaced, col);
      cPlaced++;
    }
    cloverMesh.count = cPlaced;
    cloverMesh.instanceMatrix.needsUpdate = true;
    if (cloverMesh.instanceColor) cloverMesh.instanceColor.needsUpdate = true;
    this.scene.add(cloverMesh);

    // 2. 6,200 Meadow Wildflowers & Clover Blossoms across the coastal hills
    const flowerCount = 6200;
    const flowerGeo = this.createWildflowerGeometry();
    this.flowerMaterial = createWildflowerMaterial({
      windSpeed: this.currentConfig?.wind?.speed ?? 2.2,
      windDirection: windDir2D,
      windStrength: this.currentConfig?.wind?.swayIntensity ?? 0.85,
      gustiness: this.currentConfig?.wind?.gustiness ?? 0.55,
      sunDirection: sunDir
    });

    const flowerMesh = new THREE.InstancedMesh(flowerGeo, this.flowerMaterial, flowerCount);
    flowerMesh.name = 'InstancedGhibliWildflowers';

    const flowerPalette = ['#fffef5', '#f7b8cc', '#ffe169', '#ff7b89', '#7ec8ff', '#ffd6a5', '#f2f5d2'];
    let fPlaced = 0;
    for (let i = 0; fPlaced < flowerCount && i < flowerCount * 4.5; i++) {
      const j1 = Math.abs(Math.sin(i * 19.313 + 0.5) * 32411.17) % 1.0;
      const j2 = Math.abs(Math.sin(i * 61.717 + 1.2) * 21893.41) % 1.0;
      const isCore = fPlaced < 3600;
      const r = isCore
        ? 1.2 + Math.pow((i % 4600) / 4600, 0.72) * 56.0
        : 44.0 + Math.pow(j1, 0.80) * 86.0;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.6;
      const x = r * Math.cos(theta);
      const z = (isCore ? 6.0 : 16.0) + r * Math.sin(theta);

      if (this.isExcludedFromFlora(x, z)) continue;
      const y = getGhibliValleyHeight(x, z);
      if (y < 0.25) continue;

      pos.set(x, y, z);
      getGhibliValleyNormal(x, z, norm);
      alignQ.setFromUnitVectors(up, norm);
      yawQ.setFromAxisAngle(norm, j1 * Math.PI * 2);
      quat.multiplyQuaternions(yawQ, alignQ);
      const palIdx = fPlaced % flowerPalette.length;
      const isClover = palIdx === 1 || palIdx === 6;
      const fs = isClover ? 0.65 + j2 * 0.36 : 0.85 + j2 * 0.58;
      scale.set(fs, fs, fs);
      dummy.compose(pos, quat, scale);
      flowerMesh.setMatrixAt(fPlaced, dummy);
      col.set(flowerPalette[palIdx]);
      flowerMesh.setColorAt(fPlaced, col);
      fPlaced++;
    }
    flowerMesh.count = fPlaced;
    flowerMesh.instanceMatrix.needsUpdate = true;
    if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    this.scene.add(flowerMesh);
  }

  private createWildflowerGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const stemCol = new THREE.Color('#3d8b35');
    const centerCol = new THREE.Color('#ffca3a');
    const petalCol = new THREE.Color('#ffffff');
    const stemH = 0.42;
    const stemR = 0.008;
    let vOff = 0;

    // Crossed stems
    positions.push(-stemR, 0, 0, stemR, 0, 0, -stemR, stemH, 0, stemR, stemH, 0);
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
    uvs.push(0, 0, 1, 0, 0, 0.96, 1, 0.96);
    for (let i = 0; i < 4; i++) colors.push(stemCol.r, stemCol.g, stemCol.b);
    indices.push(vOff, vOff + 1, vOff + 2, vOff + 1, vOff + 3, vOff + 2);
    vOff += 4;

    positions.push(0, 0, -stemR, 0, 0, stemR, 0, stemH, -stemR, 0, stemH, stemR);
    normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
    uvs.push(0, 0, 1, 0, 0, 0.96, 1, 0.96);
    for (let i = 0; i < 4; i++) colors.push(stemCol.r, stemCol.g, stemCol.b);
    indices.push(vOff, vOff + 1, vOff + 2, vOff + 1, vOff + 3, vOff + 2);
    vOff += 4;

    // Delicate golden pistil
    const cIdx = vOff;
    positions.push(0, stemH + 0.008, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.98);
    colors.push(centerCol.r, centerCol.g, centerCol.b);
    vOff += 1;

    const pSegs = 6;
    const pStart = vOff;
    for (let i = 0; i < pSegs; i++) {
      const a = (i / pSegs) * Math.PI * 2;
      positions.push(Math.cos(a) * 0.018, stemH + 0.004, Math.sin(a) * 0.018);
      normals.push(0, 1, 0);
      uvs.push(0.5, 0.98);
      colors.push(centerCol.r, centerCol.g, centerCol.b);
      vOff += 1;
    }
    for (let i = 0; i < pSegs; i++) {
      indices.push(cIdx, pStart + i, pStart + ((i + 1) % pSegs));
    }

    // 8 delicate cupped petals (petalLen = 0.058, cupLift = 0.022)
    const petalCount = 8;
    const petalLen = 0.058;
    const cupLift = 0.022;
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const pBase = vOff;
      positions.push(ca * 0.012, stemH, sa * 0.012);
      positions.push(ca * (0.012 + petalLen * 0.55) - sa * 0.016, stemH + cupLift * 0.45, sa * (0.012 + petalLen * 0.55) + ca * 0.016);
      positions.push(ca * (0.012 + petalLen), stemH + cupLift, sa * (0.012 + petalLen));
      positions.push(ca * (0.012 + petalLen * 0.55) + sa * 0.016, stemH + cupLift * 0.45, sa * (0.012 + petalLen * 0.55) - ca * 0.016);
      for (let k = 0; k < 4; k++) {
        normals.push(-ca * 0.25, 0.96, -sa * 0.25);
        uvs.push(0.5, 1.0);
        colors.push(petalCol.r, petalCol.g, petalCol.b);
      }
      vOff += 4;
      indices.push(pBase, pBase + 1, pBase + 2, pBase, pBase + 2, pBase + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  private buildButterflies(): void {
    this.butterflyBoids = createLivingBoidsSystem({
      count: 84,
      boundsRadius: 68,
      minY: 1.8,
      maxY: 6.8,
      kind: 'butterfly',
      colorA: 0xffe478,
      colorB: 0x7dd8ff
    });
    this.butterflyBoids.mesh.name = 'InstancedGhibliButterflies';
    this.scene.add(this.butterflyBoids.mesh);
    this.butterflyBoids.update(0.016, 0, this.butterflyFocusCenter);
  }

  private buildSeagulls(_sunDir: THREE.Vector3): void {
    this.seagullBoids = createLivingBoidsSystem({
      count: 38,
      boundsRadius: 94,
      minY: 14.0,
      maxY: 36.0,
      kind: 'bird',
      colorA: 0xf9f7f0,
      colorB: 0x52647d
    });
    this.seagullBoids.mesh.name = 'SoaringGhibliSeagulls';
    this.scene.add(this.seagullBoids.mesh);
    this.seagullBoids.update(0.016, 0, this.seagullFocusCenter);
  }

  private buildKitesAndPaperPlanes(_windDir2D: THREE.Vector2): void {
    // 1. Three Colorful Ghibli Diamond Kites soaring above the coastal hillside & seawall overlook
    const kiteSpecs = [
      { ax: -11.5, az: 6.5, height: 12.5, radius: 3.2, color: '#eb5e4f', tailColor: '#ffe066', phase: 0.2 },
      { ax: 16.0, az: 16.0, height: 14.2, radius: 3.6, color: '#f2b838', tailColor: '#ffffff', phase: 2.1 },
      { ax: -26.0, az: -12.0, height: 13.4, radius: 3.4, color: '#45a8e6', tailColor: '#ff96a8', phase: 4.0 }
    ];

    const kiteRoot = new THREE.Group();
    kiteRoot.name = 'GhibliCoastalKites';

    const sparMat = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.78 });
    const stringMat = new THREE.LineBasicMaterial({ color: '#eef4fa', transparent: true, opacity: 0.45 });
    this.extraMaterials.push(sparMat, stringMat);

    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0, 0.75, 0.0,
          0.52, 0.12, 0.06,
          0, -0.82, 0.0,
          -0.52, 0.12, 0.06
        ],
        3
      )
    );
    sailGeo.setIndex([0, 1, 2, 0, 2, 3]);
    sailGeo.computeVertexNormals();

    kiteSpecs.forEach((spec, idx) => {
      const anchorY = getGhibliValleyHeight(spec.ax, spec.az) + 0.3;
      const kiteGroup = new THREE.Group();
      kiteGroup.name = `CoastalKite_${idx + 1}`;

      const sailMat = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: 0.62,
        side: THREE.DoubleSide
      });
      this.extraMaterials.push(sailMat);
      const sailMesh = new THREE.Mesh(sailGeo.clone(), sailMat);
      kiteGroup.add(sailMesh);

      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.56, 6), sparMat);
      kiteGroup.add(spine);
      const crossSpar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.04, 6), sparMat);
      crossSpar.rotation.z = Math.PI / 2;
      crossSpar.position.y = 0.12;
      kiteGroup.add(crossSpar);

      const tailMat = new THREE.MeshStandardMaterial({
        color: spec.tailColor,
        roughness: 0.7,
        side: THREE.DoubleSide
      });
      this.extraMaterials.push(tailMat);

      const tailSegments: THREE.Mesh[] = [];
      for (let s = 0; s < 6; s++) {
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.14 - s * 0.014, 0.34), tailMat);
        seg.position.set(0, -0.96 - s * 0.32, 0);
        kiteGroup.add(seg);
        tailSegments.push(seg);
      }

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(spec.ax, anchorY, spec.az),
        new THREE.Vector3(spec.ax, anchorY + spec.height, spec.az)
      ]);
      const stringLine = new THREE.Line(lineGeo, stringMat);
      kiteRoot.add(stringLine);
      kiteRoot.add(kiteGroup);

      this.coastalKites.push({
        group: kiteGroup,
        tailSegments,
        stringLine,
        anchorX: spec.ax,
        anchorY,
        anchorZ: spec.az,
        flyRadius: spec.radius,
        flyHeight: spec.height,
        phase: spec.phase
      });
    });

    sailGeo.dispose();
    this.scene.add(kiteRoot);

    // 2. 10 Folded Paper Airplanes gliding gracefully on sea-breeze thermals
    const planeGeo = new THREE.BufferGeometry();
    planeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          // Left wing
          0, 0.02, 0.36, -0.26, 0.04, -0.24, -0.02, 0.02, -0.22,
          // Right wing
          0, 0.02, 0.36, 0.02, 0.02, -0.22, 0.26, 0.04, -0.24,
          // Center fuselage keel
          0, 0.02, 0.36, 0, -0.10, -0.22, -0.02, 0.02, -0.22,
          0, 0.02, 0.36, 0.02, 0.02, -0.22, 0, -0.10, -0.22
        ],
        3
      )
    );
    planeGeo.computeVertexNormals();

    const planeColors = ['#f3ebd8', '#efe4cc', '#f6efe0', '#ebe0c8', '#f2e8d2'];
    const planeGroup = new THREE.Group();
    planeGroup.name = 'GhibliPaperAirplanes';

    const planeSpecs = [
      { cx: -4, cy: 10.5, cz: -6, rx: 14, rz: 10, spd: 0.38, ph: 0.0 },
      { cx: 6, cy: 12.2, cz: -12, rx: 18, rz: 12, spd: 0.32, ph: 1.1 },
      { cx: -14, cy: 11.4, cz: 4, rx: 12, rz: 14, spd: 0.42, ph: 2.3 },
      { cx: 12, cy: 9.8, cz: 6, rx: 15, rz: 11, spd: 0.36, ph: 3.4 },
      { cx: -2, cy: 13.8, cz: -22, rx: 22, rz: 13, spd: 0.28, ph: 4.5 },
      { cx: 18, cy: 11.6, cz: -18, rx: 16, rz: 12, spd: 0.35, ph: 5.2 },
      { cx: -22, cy: 12.8, cz: -16, rx: 18, rz: 14, spd: 0.31, ph: 0.8 },
      { cx: 2, cy: 8.6, cz: 14, rx: 11, rz: 9, spd: 0.44, ph: 1.9 },
      { cx: -8, cy: 14.5, cz: -28, rx: 20, rz: 14, spd: 0.29, ph: 3.1 },
      { cx: 24, cy: 10.8, cz: -6, rx: 14, rz: 11, spd: 0.39, ph: 4.8 }
    ];

    planeSpecs.forEach((ps, idx) => {
      const mat = new THREE.MeshStandardMaterial({
        color: planeColors[idx % planeColors.length],
        roughness: 0.78,
        side: THREE.DoubleSide
      });
      this.extraMaterials.push(mat);
      const mesh = new THREE.Mesh(idx === 0 ? planeGeo : planeGeo.clone(), mat);
      mesh.scale.setScalar(0.40);
      mesh.castShadow = true;
      planeGroup.add(mesh);
      this.paperPlanes.push({
        mesh,
        centerX: ps.cx,
        centerY: ps.cy,
        centerZ: ps.cz,
        radiusX: ps.rx,
        radiusZ: ps.rz,
        speed: ps.spd,
        phase: ps.ph,
        bobAmp: 0.75 + (idx % 3) * 0.35
      });
    });

    this.scene.add(planeGroup);
    this.updateKitesAndPaperPlanes(0, this.currentConfig?.wind?.speed ?? 2.2, 0.5);
  }

  private buildWeatherSystem(): void {
    this.weatherParticles = createWeatherParticlesSystem({
      count: 900,
      radius: 58
    });
    this.weatherParticles.mesh.name = 'GhibliWeatherParticles';
    this.scene.add(this.weatherParticles.mesh);
  }

  private evalSceneGustFactor(x: number, z: number, elapsedTime: number): number {
    const windSpeed = this.currentConfig?.wind?.speed ?? 2.2;
    const windArr = this.currentConfig?.wind?.direction ?? [0.85, 0.0, 0.45];
    const len = Math.hypot(windArr[0], windArr[2] ?? windArr[1]) || 1;
    const wx = windArr[0] / len;
    const wz = (windArr[2] ?? windArr[1]) / len;
    const gustSpeed = Math.max(0.4, windSpeed * 0.7);
    const frontNoise = 0.5 + 0.5 * Math.sin(x * 0.045 - wx * elapsedTime * gustSpeed * 0.18 + z * 0.032);
    const phase = (x * wx + z * wz) * 0.075 - elapsedTime * gustSpeed + frontNoise * 2.4;
    const raw = Math.sin(phase) * 0.5 + 0.5;
    const t = Math.max(0, Math.min(1, (raw - 0.12) / 0.76));
    return t * t * (3 - 2 * t);
  }

  private updateKitesAndPaperPlanes(elapsedTime: number, windSpeed: number, gustFactor: number): void {
    const windArr = this.currentConfig?.wind?.direction ?? [0.85, 0.0, 0.45];
    const wLen = Math.hypot(windArr[0], windArr[2] ?? windArr[1]) || 1;
    const wx = windArr[0] / wLen;
    const wz = (windArr[2] ?? windArr[1]) / wLen;

    for (let i = 0; i < this.coastalKites.length; i++) {
      const k = this.coastalKites[i];
      const t = elapsedTime * (0.42 + windSpeed * 0.12) + k.phase;
      const swayX = Math.sin(t) * k.flyRadius;
      const swayZ = Math.sin(t * 2.0) * (k.flyRadius * 0.42);
      const lift = gustFactor * 1.45 + Math.cos(t * 1.5) * 0.55;

      const kx = k.anchorX + wx * 4.8 + swayX;
      const ky = k.anchorY + k.flyHeight + lift;
      const kz = k.anchorZ + wz * 4.8 + swayZ;

      k.group.position.set(kx, ky, kz);
      const windYaw = Math.atan2(wx, wz);
      k.group.rotation.set(
        -0.46 + gustFactor * 0.14 + Math.sin(t * 2.2) * 0.06,
        windYaw + Math.sin(t) * 0.18,
        Math.cos(t) * 0.18
      );

      for (let s = 0; s < k.tailSegments.length; s++) {
        const seg = k.tailSegments[s];
        const wave = Math.sin(elapsedTime * (4.5 + windSpeed) - s * 0.7 + k.phase);
        seg.position.x = wave * (0.04 + s * 0.025);
        seg.rotation.z = wave * 0.22;
        seg.rotation.x = 0.25 + gustFactor * 0.25;
      }

      const linePos = k.stringLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (linePos) {
        linePos.setXYZ(0, k.anchorX, k.anchorY, k.anchorZ);
        linePos.setXYZ(1, kx, ky, kz);
        linePos.needsUpdate = true;
      }
    }

    for (let i = 0; i < this.paperPlanes.length; i++) {
      const p = this.paperPlanes[i];
      const t = elapsedTime * (p.speed + windSpeed * 0.04) + p.phase;
      const px = p.centerX + Math.cos(t) * p.radiusX;
      const pz = p.centerZ + Math.sin(t * 1.0) * p.radiusZ;
      const py = p.centerY + Math.sin(t * 2.0 + p.phase) * p.bobAmp;

      const vx = -Math.sin(t) * p.radiusX * p.speed;
      const vz = Math.cos(t) * p.radiusZ * p.speed;
      const vy = Math.cos(t * 2.0 + p.phase) * p.bobAmp * 2.0 * p.speed;
      const yaw = Math.atan2(vx, vz);
      const pitch = -Math.atan2(vy, Math.hypot(vx, vz) || 1) * 0.7;
      const bank = -0.32 + Math.sin(t * 2.0) * 0.08;

      p.mesh.position.set(px, py, pz);
      p.mesh.rotation.set(pitch, yaw, bank);
    }
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    const safeDelta = Number.isFinite(deltaTime) ? Math.min(Math.max(deltaTime, 0.0001), 0.1) : 0.016;
    const safeElapsed = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    this.lastDeltaTime = safeDelta;
    this.lastElapsedTime = safeElapsed;
    this.sceneElapsedTime += safeDelta;

    if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = safeElapsed;
    if (this.volumetricCloudDome) {
      const fogCol = this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.color : undefined;
      this.volumetricCloudDome.update(safeElapsed, this.currentSunDir, fogCol);
    }
    if (this.oceanMaterial) this.oceanMaterial.uniforms.uTime.value = safeElapsed;
    if (this.brookMaterial) this.brookMaterial.uniforms.uTime.value = safeElapsed;
    if (this.terrainMaterial) this.terrainMaterial.uniforms.uTime.value = safeElapsed;
    if (this.grassMaterial) this.grassMaterial.uniforms.uTime.value = safeElapsed;
    if (this.cloverMaterial) this.cloverMaterial.uniforms.uTime.value = safeElapsed;
    if (this.flowerMaterial) this.flowerMaterial.uniforms.uTime.value = safeElapsed;
    if (this.clothMaterial) this.clothMaterial.uniforms.uTime.value = safeElapsed;
    if (this.smokeMaterial) this.smokeMaterial.uniforms.uTime.value = safeElapsed;
    for (const hMat of this.hillMaterials) {
      hMat.uniforms.uTime.value = safeElapsed;
    }
    for (const u of this.foliageWindUniforms) {
      u.uTime.value = safeElapsed;
    }

    const windSpeed = this.currentConfig?.wind?.speed ?? 2.2;
    const gustiness = this.currentConfig?.wind?.gustiness ?? 0.55;
    const windmillGust = this.evalSceneGustFactor(12.5, -10.5, safeElapsed);

    if (this.windmillSails) {
      const targetVel =
        (0.42 + windSpeed * 0.22) * (0.64 + windmillGust * (0.48 + gustiness * 0.65)) +
        this.audioMid * 0.25;
      this.windmillAngularVel += (targetVel - this.windmillAngularVel) * Math.min(1, safeDelta * 3.5);
      this.windmillSails.rotation.z -= safeDelta * this.windmillAngularVel;
    }

    this.updateSeaTrain(this.sceneElapsedTime, safeDelta);
    this.updateSailboats(this.sceneElapsedTime);
    this.updateKitesAndPaperPlanes(this.sceneElapsedTime, windSpeed, windmillGust);
    this.seagullBoids?.update(safeDelta, safeElapsed, this.seagullFocusCenter);
    this.butterflyBoids?.update(safeDelta, safeElapsed, this.butterflyFocusCenter);
    this.weatherParticles?.update(safeDelta, safeElapsed, this.weatherFocusCenter);
  }

  public setAtmosphereState(state: { timeOfDay?: number; weather?: WeatherMode }): void {
    if (!this.isInitialized || !state || typeof state !== 'object') return;
    const nextHour =
      typeof state.timeOfDay === 'number' && Number.isFinite(state.timeOfDay)
        ? ((state.timeOfDay % 24) + 24) % 24
        : this.atmosphereState.timeOfDay;
    const nextWeather: WeatherMode =
      state.weather === 'clear' ||
      state.weather === 'mist' ||
      state.weather === 'rain' ||
      state.weather === 'fireflies'
        ? state.weather
        : this.atmosphereState.weather;

    this.atmosphereState = { timeOfDay: nextHour, weather: nextWeather };

    // Smoothly map timeOfDay to sun direction, sky palette, fog & window glow
    let topHex = '#1559c4';
    let bottomHex = '#4da3f0';
    let horizonHex = '#c2e6fa';
    let sunTint = new THREE.Color('#ffffff');
    let sunIntensity = this.currentConfig?.lighting?.directional?.intensity ?? 2.05;
    let ambientIntensity = this.currentConfig?.lighting?.ambient?.intensity ?? 0.46;
    let hemiIntensity = 0.82;
    let fogTint = this.baseFogColor.clone();
    let fogDensity = this.baseFogDensity;
    let cloudTint = new THREE.Color('#fffaf0');
    let cloudShadow = new THREE.Color('#5b7ab4');
    let cloudCoverage = this.currentConfig?.sky?.cloudCoverage ?? 0.65;
    let windowGlow = 1.45;
    let godRayStrength: number | null = null;

    if (nextHour >= 4.5 && nextHour < 8.5) {
      // Dawn
      this.currentSunDir.set(68, 22, 30).normalize();
      topHex = '#2a569e';
      bottomHex = '#82a7d9';
      horizonHex = '#f7cba4';
      sunTint.set('#ffbe8a');
      sunIntensity *= 0.84;
      fogTint.set('#f4d8c0');
      cloudTint.set('#ffead6');
      cloudShadow.set('#6d7ba8');
      windowGlow = 1.8;
      godRayStrength = 0.24;
    } else if (nextHour >= 8.5 && nextHour < 15.5) {
      // Bright sunlit Ghibli summer day
      this.currentSunDir.copy(this.baseSunDir);
      topHex = this.currentConfig?.sky?.topColor ?? '#1559c4';
      bottomHex = this.currentConfig?.sky?.bottomColor ?? '#4da3f0';
      horizonHex = this.currentConfig?.sky?.horizonColor ?? '#c2e6fa';
      sunTint.copy(this.baseSunColor);
      windowGlow = 1.45;
    } else if (nextHour >= 15.5 && nextHour < 19.5) {
      // Golden Sunset
      this.currentSunDir.set(-64, 18, 24).normalize();
      topHex = '#1f3b78';
      bottomHex = '#a86b82';
      horizonHex = '#ffab6e';
      sunTint.set('#ff884d');
      sunIntensity *= 0.82;
      ambientIntensity *= 0.92;
      fogTint.set('#eba075');
      cloudTint.set('#ffd0a6');
      cloudShadow.set('#6b5a82');
      windowGlow = 2.3;
      godRayStrength = 0.28;
    } else {
      // Starlit Coastal Night
      this.currentSunDir.set(-28, 52, -32).normalize();
      topHex = '#071026';
      bottomHex = '#13254a';
      horizonHex = '#28406b';
      sunTint.set('#82a8ff');
      sunIntensity *= 0.42;
      ambientIntensity *= 0.70;
      hemiIntensity = 0.48;
      fogTint.set('#14203b');
      cloudTint.set('#96afd9');
      cloudShadow.set('#283654');
      windowGlow = 2.8;
      godRayStrength = 0.04;
    }

    if (nextWeather === 'mist') {
      fogDensity *= 1.9;
      fogTint.lerp(new THREE.Color('#cfe0ed'), 0.45);
      cloudCoverage = Math.min(0.88, cloudCoverage + 0.14);
    } else if (nextWeather === 'rain') {
      fogDensity *= 1.65;
      sunIntensity *= 0.72;
      fogTint.lerp(new THREE.Color('#70849c'), 0.55);
      cloudCoverage = Math.min(0.92, cloudCoverage + 0.22);
      cloudTint.lerp(new THREE.Color('#b0bfd1'), 0.45);
      cloudShadow.lerp(new THREE.Color('#3f5169'), 0.45);
      godRayStrength = 0.04;
    } else if (nextWeather === 'fireflies') {
      fogDensity *= 1.15;
    }

    this.weatherParticles?.setMode(nextWeather);

    if (this.directionalLight) {
      this.directionalLight.position.copy(this.currentSunDir).multiplyScalar(88);
      this.directionalLight.color.copy(sunTint);
      this.directionalLight.intensity = sunIntensity;
    }
    if (this.ambientLight) {
      this.ambientLight.color.copy(this.baseAmbientColor).lerp(fogTint, 0.28);
      this.ambientLight.intensity = ambientIntensity;
    }
    if (this.hemiLight) {
      this.hemiLight.color.copy(this.baseHemiSkyColor).lerp(fogTint, 0.35);
      this.hemiLight.groundColor.copy(this.baseHemiGroundColor).lerp(fogTint, 0.25);
      this.hemiLight.intensity = hemiIntensity;
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogTint);
      this.scene.fog.density = fogDensity;
    }
    if (this.trainWindowGlowMat) {
      this.trainWindowGlowMat.emissiveIntensity = windowGlow;
    }

    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uTopColor.value.set(topHex);
      this.skyMaterial.uniforms.uBottomColor.value.set(bottomHex);
      this.skyMaterial.uniforms.uHorizonColor.value.set(horizonHex);
      this.skyMaterial.uniforms.uSunDirection.value.copy(this.currentSunDir);
    }
    if (this.volumetricCloudDome) {
      (this.volumetricCloudDome.uniforms.uTint.value as THREE.Color).copy(cloudTint);
      (this.volumetricCloudDome.uniforms.uShadowColor.value as THREE.Color).copy(cloudShadow);
      this.volumetricCloudDome.update(this.sceneElapsedTime, this.currentSunDir, fogTint, cloudCoverage);
    }
    if (this.oceanMaterial) {
      this.oceanMaterial.uniforms.uSunDirection.value.copy(this.currentSunDir);
      this.oceanMaterial.uniforms.uCloudCoverage.value = cloudCoverage;
    }
    if (this.terrainMaterial) {
      this.terrainMaterial.uniforms.uSunDirection.value.copy(this.currentSunDir);
      this.terrainMaterial.uniforms.uCloudCoverage.value = cloudCoverage;
    }
    if (this.grassMaterial) {
      this.grassMaterial.uniforms.uSunDir.value.copy(this.currentSunDir);
      this.grassMaterial.uniforms.uCloudCoverage.value = cloudCoverage;
    }
    if (this.cloverMaterial) {
      this.cloverMaterial.uniforms.uSunDir.value.copy(this.currentSunDir);
      this.cloverMaterial.uniforms.uCloudCoverage.value = cloudCoverage;
    }
    if (this.flowerMaterial) this.flowerMaterial.uniforms.uSunDirection.value.copy(this.currentSunDir);
    if (this.clothMaterial) this.clothMaterial.uniforms.uSunDirection.value.copy(this.currentSunDir);
    for (const hMat of this.hillMaterials) {
      hMat.uniforms.uSunDirection.value.copy(this.currentSunDir);
    }

    this.pipeline?.setAtmosphereOverrides({ godRayStrength });
  }

  public setAudioEnergy(bass: number, mid: number, treble: number): void {
    if (!this.isInitialized) return;
    const safeBass = Number.isFinite(bass) ? Math.max(0, Math.min(1.5, bass)) : 0;
    const safeMid = Number.isFinite(mid) ? Math.max(0, Math.min(1.5, mid)) : 0;
    const safeTreble = Number.isFinite(treble) ? Math.max(0, Math.min(1.5, treble)) : 0;

    this.audioBass += (safeBass - this.audioBass) * 0.22;
    this.audioMid += (safeMid - this.audioMid) * 0.22;
    this.audioTreble += (safeTreble - this.audioTreble) * 0.22;

    if (this.oceanMaterial?.uniforms.uAudioTreble) {
      this.oceanMaterial.uniforms.uAudioTreble.value = this.audioTreble;
    }
    if (this.grassMaterial?.uniforms.uSwayStrength) {
      const baseSway = this.currentConfig?.wind?.swayIntensity ?? 0.92;
      this.grassMaterial.uniforms.uSwayStrength.value = baseSway * (1.0 + this.audioBass * 0.14);
    }
    if (this.trainWindowGlowMat) {
      const baseGlow =
        this.atmosphereState.timeOfDay >= 15.5 || this.atmosphereState.timeOfDay < 8.5 ? 2.2 : 1.45;
      this.trainWindowGlowMat.emissiveIntensity = baseGlow + this.audioMid * 0.35;
    }
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    if (this.pipeline) {
      this.pipeline.renderFrame(renderer, camera, this.lastDeltaTime, this.lastElapsedTime);
      return;
    }
    renderer.render(this.scene, camera);
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
        this.baseFogColor.copy(this.scene.fog.color);
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
        if (this.volumetricCloudDome) {
          (this.volumetricCloudDome.uniforms.uFogColor.value as THREE.Color).copy(this.scene.fog.color);
        }
      }
      if (typeof newConfig.fog.density === 'number' && Number.isFinite(newConfig.fog.density) && newConfig.fog.density >= 0) {
        const appliedDensity = isInitialHydration ? Math.min(newConfig.fog.density, 0.00065) : newConfig.fog.density;
        this.scene.fog.density = appliedDensity;
        this.baseFogDensity = appliedDensity;
        if (this.currentConfig?.fog) this.currentConfig.fog.density = appliedDensity;
      }
    }

    if (newConfig.sky) {
      if (this.skyMaterial) {
        if (newConfig.sky.topColor) {
          this.skyMaterial.uniforms.uTopColor.value.set(newConfig.sky.topColor);
          if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
        }
        if (newConfig.sky.bottomColor) {
          this.skyMaterial.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
          if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
        }
        if (newConfig.sky.horizonColor) {
          this.skyMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
          if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
        }
      }
      if (typeof newConfig.sky.cloudSpeed === 'number' && Number.isFinite(newConfig.sky.cloudSpeed)) {
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudSpeed = newConfig.sky.cloudSpeed;
        if (this.volumetricCloudDome) {
          this.volumetricCloudDome.uniforms.uSpeed.value = newConfig.sky.cloudSpeed;
        }
      }
      if (typeof newConfig.sky.cloudCoverage === 'number' && Number.isFinite(newConfig.sky.cloudCoverage)) {
        const cov = Math.max(0, Math.min(1, newConfig.sky.cloudCoverage));
        if (this.currentConfig?.sky) this.currentConfig.sky.cloudCoverage = cov;
        if (this.volumetricCloudDome) this.volumetricCloudDome.uniforms.uCoverage.value = cov;
        if (this.grassMaterial) this.grassMaterial.uniforms.uCloudCoverage.value = cov;
        if (this.cloverMaterial) this.cloverMaterial.uniforms.uCloudCoverage.value = cov;
        if (this.terrainMaterial) this.terrainMaterial.uniforms.uCloudCoverage.value = cov;
        if (this.oceanMaterial) this.oceanMaterial.uniforms.uCloudCoverage.value = cov;
      }
    }

    if (newConfig.wind) {
      const ws = newConfig.wind.speed;
      const sway = newConfig.wind.swayIntensity;
      const gust = newConfig.wind.gustiness;
      const dir = newConfig.wind.direction;

      if (typeof ws === 'number' && Number.isFinite(ws)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.speed = ws;
        const gustSpeed = Math.max(0.4, ws * 0.7);
        if (this.grassMaterial) this.grassMaterial.uniforms.uGustSpeed.value = gustSpeed;
        if (this.cloverMaterial) this.cloverMaterial.uniforms.uGustSpeed.value = gustSpeed;
        if (this.flowerMaterial) this.flowerMaterial.uniforms.uWindSpeed.value = ws;
        if (this.terrainMaterial) this.terrainMaterial.uniforms.uWindSpeed.value = ws;
        if (this.clothMaterial) this.clothMaterial.uniforms.uWindSpeed.value = ws;
        for (const u of this.foliageWindUniforms) {
          u.uWindSpeed.value = ws;
        }
      }
      if (typeof sway === 'number' && Number.isFinite(sway)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.swayIntensity = sway;
        if (this.grassMaterial) this.grassMaterial.uniforms.uSwayStrength.value = sway;
        if (this.cloverMaterial) this.cloverMaterial.uniforms.uSwayStrength.value = sway * 0.45;
        if (this.flowerMaterial) this.flowerMaterial.uniforms.uWindStrength.value = sway;
      }
      if (typeof gust === 'number' && Number.isFinite(gust)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.gustiness = gust;
        if (this.flowerMaterial) this.flowerMaterial.uniforms.uGustiness.value = gust;
        if (this.terrainMaterial) this.terrainMaterial.uniforms.uGustiness.value = gust;
      }
      if (dir && Array.isArray(dir)) {
        if (this.currentConfig?.wind) this.currentConfig.wind.direction = dir as [number, number, number];
        const dx = dir[0];
        const dz = dir[2] ?? dir[1];
        this.grassMaterial?.uniforms.uWindDir.value.set(dx, dz).normalize();
        this.cloverMaterial?.uniforms.uWindDir.value.set(dx, dz).normalize();
        this.flowerMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
        this.terrainMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
        this.smokeMaterial?.uniforms.uWindDirection.value.set(dx, dz).normalize();
      }
    }

    if (newConfig.lighting) {
      if (newConfig.lighting.ambient && this.ambientLight) {
        if (newConfig.lighting.ambient.color) {
          this.ambientLight.color.set(newConfig.lighting.ambient.color);
          this.baseAmbientColor.copy(this.ambientLight.color);
        }
        if (typeof newConfig.lighting.ambient.intensity === 'number' && Number.isFinite(newConfig.lighting.ambient.intensity)) {
          this.ambientLight.intensity = newConfig.lighting.ambient.intensity;
        }
      }
      if (newConfig.lighting.directional && this.directionalLight) {
        if (newConfig.lighting.directional.color) {
          this.directionalLight.color.set(newConfig.lighting.directional.color);
          this.baseSunColor.copy(this.directionalLight.color);
        }
        if (typeof newConfig.lighting.directional.intensity === 'number' && Number.isFinite(newConfig.lighting.directional.intensity)) {
          this.directionalLight.intensity = newConfig.lighting.directional.intensity;
        }
        if (Array.isArray(newConfig.lighting.directional.position) && newConfig.lighting.directional.position.length >= 3) {
          const [lx, ly, lz] = newConfig.lighting.directional.position;
          this.directionalLight.position.set(lx, ly, lz);
          const sunDir = this.directionalLight.position.clone().normalize();
          this.baseSunDir.copy(sunDir);
          this.currentSunDir.copy(sunDir);
          this.skyMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.volumetricCloudDome?.update(this.sceneElapsedTime, sunDir);
          this.oceanMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.terrainMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.grassMaterial?.uniforms.uSunDir.value.copy(sunDir);
          this.cloverMaterial?.uniforms.uSunDir.value.copy(sunDir);
          this.flowerMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          this.clothMaterial?.uniforms.uSunDirection.value.copy(sunDir);
          for (const hMat of this.hillMaterials) {
            hMat.uniforms.uSunDirection.value.copy(sunDir);
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
      (window as any).__currentUserRole === 'creator' &&
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
    return getGhibliValleyHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 1.5;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 15.0;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;

    const lookAtX = this.currentConfig?.camera?.lookAt?.[0] ?? -1.5;
    const lookAtY = this.currentConfig?.camera?.lookAt?.[1] ?? 4.4;
    const lookAtZ = this.currentConfig?.camera?.lookAt?.[2] ?? -24.0;

    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAtX, lookAtY, lookAtZ)
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = Math.max(this.currentConfig?.camera?.wanderRadius ?? 128.0, 128.0);
    return {
      radius,
      center: new THREE.Vector3(0, 0, 16),
      minX: -Math.max(130, radius),
      maxX: Math.max(130, radius),
      minZ: -32,
      maxZ: 120
    };
  }

  public getPointsOfInterest(): IPointOfInterest[] {
    return [
      {
        name: 'Windmill Terrace',
        position: new THREE.Vector3(5.0, this.getGroundHeight(5.0, -8.0) + 2.2, -8.0),
        dwellTime: 9.0
      },
      {
        name: 'Coastal Sea Train',
        position: new THREE.Vector3(-2.0, this.getGroundHeight(-2.0, -25.0) + 2.3, -25.0),
        dwellTime: 10.0
      },
      {
        name: 'Spirit Camphor Hill',
        position: new THREE.Vector3(-10.5, this.getGroundHeight(-10.5, -9.5) + 2.3, -9.5),
        dwellTime: 9.0
      },
      {
        name: 'Headland Lighthouse Overlook',
        position: new THREE.Vector3(-52.0, this.getGroundHeight(-52.0, -22.0) + 2.4, -22.0),
        dwellTime: 9.0
      },
      {
        name: 'Stone Arch Footbridge',
        position: new THREE.Vector3(11.5, this.getGroundHeight(11.5, 5.5) + 2.2, 5.5),
        dwellTime: 8.0
      },
      {
        name: 'Turquoise Bay Overlook',
        position: new THREE.Vector3(2.0, this.getGroundHeight(2.0, 12.0) + 2.5, 12.0),
        dwellTime: 8.0
      },
      {
        name: 'East Bay Bell-Tower',
        position: new THREE.Vector3(70.0, this.getGroundHeight(70.0, -16.0) + 2.6, -16.0),
        dwellTime: 9.0
      },
      {
        name: 'West Cliff Bell-Tower',
        position: new THREE.Vector3(-84.0, this.getGroundHeight(-84.0, -14.0) + 2.6, -14.0),
        dwellTime: 9.0
      },
      {
        name: 'Upper Hillside Road',
        position: new THREE.Vector3(6.0, this.getGroundHeight(6.0, 72.0) + 2.5, 72.0),
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
    this.seagullBoids?.dispose();
    this.seagullBoids = null;
    this.butterflyBoids?.dispose();
    this.butterflyBoids = null;
    this.weatherParticles?.dispose();
    this.weatherParticles = null;

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
    this.physicalSky = null;

    this.skyMaterial = null;
    this.oceanMaterial = null;
    this.brookMaterial = null;
    this.terrainMaterial = null;
    this.grassMaterial = null;
    this.cloverMaterial = null;
    this.flowerMaterial = null;
    this.clothMaterial = null;
    this.smokeMaterial = null;
    this.trainWindowGlowMat = null;
    this.trainSmokeMesh = null;
    this.trainSmokeMaterial = null;
    this.trainSmokePuffs = [];
    this.hillMaterials = [];
    this.foliageWindUniforms = [];

    this.windmillSails = null;
    this.seaTrainCurve = null;
    this.seaTrainCars = [];
    this.sailboats = [];
    this.coastalKites = [];
    this.paperPlanes = [];
    this.exclusionCircles = [];
    this.contactAoSpots = [];

    this.ambientLight = null;
    this.directionalLight = null;
    this.hemiLight = null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;
    this.sceneElapsedTime = 0.0;

    this.isInitialized = false;
  }
}
