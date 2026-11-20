import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { WorldRuntime } from '../framework/WorldRuntime';
import type { QualityTier, WorldPerfMetrics } from '../framework/types';
import { createGrassSwayMaterial } from '../shaders/grassSwayShader';
import {
  PbrTextureSet,
  createOakBarkPbrTextures,
  createTimberBeamPbrTextures,
  createStoneMasonryPbrTextures,
  createGraniteCliffPbrTextures,
  applyWorldSpaceWeathering,
  disposePbrTextureSet
} from '../textures/pbrTextures';
import {
  ConiferBoughMaterialHandle,
  FernMaterialHandle,
  PineTrunkWindUniforms,
  ValleyTerrainMaterialHandle,
  applyPineTrunkWindShader,
  applyWaterfallCliffStrataShader,
  createAlpineRidgeMaterial,
  createBirdFlockMaterial,
  createConiferBoughAtlasTexture,
  createConiferBoughMaterial,
  createFernFrondAtlasTexture,
  createFernMaterial,
  createForestFloorDetailTexture,
  createForestMotesMaterial,
  createForestWaterMaterial,
  createPineBarkPbrTextures,
  createRiverGranitePbrTextures,
  createStreamFogRibbonMaterial,
  createSunbeamMaterial,
  createTroutMaterial,
  createTroutRippleMaterial,
  createValleyMistMaterial,
  createValleyTerrainMaterial,
  createWaterfallMaterial,
  createWaterfallMistParticlesMaterial,
  createWaterfallPlungeFoamMaterial,
  createWildflowerMaterial,
  getMistyTrailCenterX
} from '../shaders/mistyForestShader';

interface BirdOrbit {
  centerX: number;
  centerZ: number;
  radius: number;
  altitude: number;
  angularSpeed: number;
  phase: number;
  scale: number;
  bobAmp: number;
}

interface TroutJumpSpec {
  x: number;
  z: number;
  waterY: number;
  period: number;
  phase: number;
  arcHeight: number;
  arcSpan: number;
  yaw: number;
  scale: number;
}

export interface MistyAtmosphereState {
  timeOfDay?: number;
  weather?: string;
  sunElevation?: number;
  sunAzimuth?: number;
  fogDensity?: number;
  mistDensity?: number;
  fogColor?: string;
  skyTopColor?: string;
  skyBottomColor?: string;
  skyHorizonColor?: string;
  windSpeed?: number;
  windIntensity?: number;
  godRayIntensity?: number;
}

const RIVER_ISLAND_Z = -26.0;

function getStreamCenterX(z: number): number {
  return Math.sin(z * 0.055) * 8.0;
}

function getRiverIslandCenter(): { x: number; z: number; rx: number; rz: number } {
  return {
    x: getStreamCenterX(RIVER_ISLAND_Z),
    z: RIVER_ISLAND_Z,
    rx: 2.55,
    rz: 5.2
  };
}

/**
 * Analytical mountain valley elevation function h(x, z).
 * Forms a gentle mossy stream valley rising smoothly across 420m into surrounding forested foothills in O(1) time.
 */
export function getMistyForestHeight(x: number, z: number): number {
  const streamCenterX = Math.sin(z * 0.055) * 8.0;
  const distToStream = Math.abs(x - streamCenterX);
  // Widen river basin smoothly around the Rocky Island at z = -26
  const dzIsland = z - RIVER_ISLAND_Z;
  const islandReach = Math.exp(-(dzIsland * dzIsland) / 96.0);
  const streamHalfSigma = 22.0 + islandReach * 34.0;
  const streamCarve = -0.95 * Math.exp(-(distToStream * distToStream) / streamHalfSigma);

  // Rocky island mound emerging cleanly above the widened river surface
  const islX = getStreamCenterX(RIVER_ISLAND_Z);
  const islNorm = ((x - islX) / 2.65) ** 2 + (dzIsland / 5.4) ** 2;
  const islandLift = 1.65 * Math.exp(-islNorm * 1.45);

  const rSq = x * x + z * z;
  const valleySlope = (0.0032 * rSq) / (1.0 + rSq * 0.00014);
  const rollingHills =
    1.1 * Math.sin(0.05 * x + 0.4) * Math.cos(0.05 * z) +
    0.55 * Math.cos(0.08 * z - 0.3);

  return Math.min(22.0, valleySlope + rollingHills + streamCarve + islandLift);
}

function pseudoRand(seed: number): number {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function prepareForMerge(
  geo: THREE.BufferGeometry,
  matrix?: THREE.Matrix4,
  preserveColor = false,
  preserveLimbFlex = false
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
  if (preserveLimbFlex && !g.attributes.aLimbFlex) {
    const count = g.attributes.position.count;
    g.setAttribute('aLimbFlex', new THREE.BufferAttribute(new Float32Array(count), 1));
  }
  for (const attrName of Object.keys(g.attributes)) {
    const keep =
      attrName === 'position' ||
      attrName === 'normal' ||
      attrName === 'uv' ||
      (preserveColor && attrName === 'color') ||
      (preserveLimbFlex && attrName === 'aLimbFlex');
    if (!keep) {
      g.deleteAttribute(attrName);
    }
  }
  return g;
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

/**
 * Generates a tapered organic tube along a 3D spline for pine trunks & limbs.
 */
function createPineTubeGeometry(
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
  const furrowAmp = options.furrowAmp ?? 0.06;
  const buttressFluting = options.buttressFluting ?? 0.0;
  const mossHeightRatio = options.mossHeightRatio ?? 0.25;
  const rootAoRatio = options.rootAoRatio ?? 0.16;
  const uvScaleU = options.uvScaleU ?? 2.0;
  const uvScaleV = options.uvScaleV ?? 2.2;
  const seed = options.seed ?? 1.0;

  const totalLen = Math.max(0.5, curve.getLength());
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const pt = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const baseBark = new THREE.Color('#ffffff');
  const mossTint = new THREE.Color('#6f9642');
  const tmpCol = new THREE.Color();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, pt);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    const rootFlare = buttressFluting > 0 ? Math.pow(Math.max(0, 1 - t * 3.0), 2.0) * 0.48 : 0;
    const baseR = (rStart * (1 - t) + rEnd * t) * (1 + rootFlare);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const twist = theta + t * 1.8 + seed;
      const furrow =
        Math.sin(twist * 6.0) * 0.55 +
        Math.cos(twist * 11.0 - t * 3.0) * 0.30 +
        Math.sin(theta * 3.0 + seed) * 0.15;
      const buttress =
        buttressFluting > 0
          ? Math.pow(Math.max(0, 1 - t * 2.4), 1.9) * (0.5 + 0.5 * Math.cos(theta * 5.0 + seed)) * buttressFluting
          : 0;

      const rad = Math.max(0.025, baseR * (1 + furrow * furrowAmp + buttress));
      vertex.copy(pt).addScaledVector(N, cosT * rad).addScaledVector(B, sinT * rad);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(u * uvScaleU, t * (totalLen / uvScaleV));

      const aoT = rootAoRatio > 0 ? Math.min(1, t / rootAoRatio) : 1.0;
      const ao = 0.56 + 0.44 * (aoT * aoT * (3 - 2 * aoT));
      const mossPatch =
        mossHeightRatio > 0
          ? Math.max(0, 1 - t / mossHeightRatio) * (0.35 + 0.65 * Math.max(0, Math.sin(theta * 5.0 + seed * 3.1 + t * 9.0)))
          : 0;
      tmpCol.copy(baseBark).lerp(mossTint, Math.min(0.45, mossPatch * 0.38)).multiplyScalar(ao);
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
 * MistyForestScene implements ISpace for Space 4:
 * "Không gian Núi rừng" (Misty Pine & Mountain Valley Sanctuary) — AAA Photorealistic Upgrade.
 */
export class MistyForestScene implements ISpace {
  readonly id = 'space-misty-forest';
  readonly name = 'Không gian Núi rừng';
  readonly slug = 'misty-forest';

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;
  private hasUserMutation = false;
  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  private pipeline: CinematicPipeline | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private lastDeltaTime = 0.016;
  private lastElapsedTime = 0.0;

  private boundRenderer: THREE.WebGLRenderer | null = null;
  private boundCamera: THREE.PerspectiveCamera | null = null;
  private readonly worldRuntime = new WorldRuntime({ consolidateSolids: true });
  private prevShadowEnabled = false;
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;

  private pbrSets: PbrTextureSet[] = [];
  private extraTextures: THREE.Texture[] = [];
  private extraMaterials: THREE.Material[] = [];

  private skyMaterial: THREE.ShaderMaterial | null = null;
  private terrainHandle: ValleyTerrainMaterialHandle | null = null;
  private waterMaterial: THREE.ShaderMaterial | null = null;
  private coniferBoughHandle: ConiferBoughMaterialHandle | null = null;
  private pineTrunkWindUniforms: PineTrunkWindUniforms | null = null;
  private fernHandle: FernMaterialHandle | null = null;
  private grassMaterial: THREE.ShaderMaterial | null = null;
  private wildflowerMaterial: THREE.ShaderMaterial | null = null;
  private alpineMaterials: THREE.ShaderMaterial[] = [];
  private waterfallMaterial: THREE.ShaderMaterial | null = null;
  private waterfallSprayMaterial: THREE.ShaderMaterial | null = null;
  private waterfallPlungeFoamMaterial: THREE.ShaderMaterial | null = null;
  private waterfallMistMaterial: THREE.ShaderMaterial | null = null;
  private waterfallMistParticlesMaterial: THREE.ShaderMaterial | null = null;
  private sunbeamMaterial: THREE.ShaderMaterial | null = null;
  private birdMaterial: THREE.ShaderMaterial | null = null;
  private mistMaterial: THREE.ShaderMaterial | null = null;
  private streamFogMaterial: THREE.ShaderMaterial | null = null;
  private firefliesMaterial: THREE.ShaderMaterial | null = null;
  private troutMaterial: THREE.ShaderMaterial | null = null;
  private troutRippleMaterial: THREE.ShaderMaterial | null = null;

  private birdsMesh: THREE.InstancedMesh | null = null;
  private birdOrbits: BirdOrbit[] = [];
  private troutMesh: THREE.InstancedMesh | null = null;
  private troutRippleMesh: THREE.InstancedMesh | null = null;
  private troutRippleAgeAttr: THREE.InstancedBufferAttribute | null = null;
  private troutJumpSpecs: TroutJumpSpec[] = [];
  private lanternPointLights: THREE.PointLight[] = [];

  private godRayBaseIntensity = 1.0;
  private mistBaseIntensity = 1.0;
  private audioBass = 0.0;
  private audioMid = 0.0;
  private audioTreble = 0.0;

  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  private ambientLight: THREE.AmbientLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;

  constructor() {
    this.scene = new THREE.Scene();
  }

  public getPipeline(): CinematicPipeline | null {
    return this.pipeline;
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

  public async init(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> {
    if (this.isInitialized) {
      this.dispose();
    }

    this.scene = new THREE.Scene();
    this.boundCamera = camera ?? null;
    this.pbrSets = [];
    this.extraTextures = [];
    this.extraMaterials = [];
    this.alpineMaterials = [];
    this.lanternPointLights = [];
    this.troutJumpSpecs = [];
    this.godRayBaseIntensity = 1.0;
    this.mistBaseIntensity = 1.0;
    this.audioBass = 0.0;
    this.audioMid = 0.0;
    this.audioTreble = 0.0;

    this.boundRenderer = renderer;
    if (renderer && (renderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.prevShadowEnabled = Boolean(renderer.shadowMap.enabled);
      this.prevShadowType = renderer.shadowMap.type;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Golden-hour dawn/morning sun position unless explicitly customized
    const rawPos = config?.lighting?.directional?.position;
    const isLegacySun =
      !rawPos ||
      (rawPos.length >= 3 && rawPos[0] === 45 && rawPos[1] === 55 && rawPos[2] === -60);
    const sunPosition: [number, number, number] = isLegacySun
      ? [52, 28, -38]
      : [rawPos[0], rawPos[1], rawPos[2]];

    const rawFogColor = config?.fog?.color;
    const isLegacyFog = !rawFogColor || rawFogColor.toLowerCase() === '#cce5df';
    const rawTop = config?.sky?.topColor;
    const rawBottom = config?.sky?.bottomColor;
    const rawHorizon = config?.sky?.horizonColor;
    const isLegacySky =
      !rawHorizon ||
      (rawHorizon.toLowerCase() === '#e6f2ec' && rawTop?.toLowerCase() === '#3b82b6');

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: isLegacyFog ? '#dfd0b8' : rawFogColor,
        density: 0.0019
      },
      sky: {
        type: config?.sky?.type ?? 'misty_mountain',
        topColor: isLegacySky ? '#2c68a3' : (rawTop ?? '#2c68a3'),
        bottomColor: isLegacySky ? '#d9a876' : (rawBottom ?? '#d9a876'),
        horizonColor: isLegacySky ? '#ffe0ab' : rawHorizon,
        swirlSpeed: config?.sky?.swirlSpeed ?? 0.4,
        starDensity: config?.sky?.starDensity ?? 0
      },
      wind: {
        speed: config?.wind?.speed ?? 1.8,
        direction: config?.wind?.direction ?? [0.8, 0.0, 0.5],
        gustiness: config?.wind?.gustiness ?? 0.45,
        swayIntensity: config?.wind?.swayIntensity ?? 0.55
      },
      lighting: {
        ambient: {
          color: isLegacyFog ? '#edd8ba' : (config?.lighting?.ambient?.color ?? '#edd8ba'),
          intensity: 0.22
        },
        directional: {
          color: '#ffd696',
          intensity: 3.35,
          position: sunPosition,
          castShadow: true
        },
        pointLights: config?.lighting?.pointLights ?? []
      },
      shaders: config?.shaders ?? {
        grassSway: { stiffness: 0.5, windInfluence: 0.75 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'misty-forest-ambient',
        name: config?.audio?.name ?? 'Forest',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/forest-1.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.7,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 2.6, wet: 0.3 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [-4, 1.7, 14],
        lookAt: config?.camera?.lookAt ?? [2, 6, -45],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 4.0,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.15,
        wanderRadius: Math.max(config?.camera?.wanderRadius ?? 124, 124),
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [-4, 2.5, 14],
          [10, 4.0, -5],
          [-22, 4.5, -12],
          [24, 5.5, -18],
          [4, 5.5, 5],
          [-4, 6.8, 54],
          [-46, 9.2, 52],
          [44, 9.0, 48],
          [42, 9.5, -66],
          [-44, 10.0, -72]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    this.scene.fog = new THREE.FogExp2(this.currentConfig.fog.color, this.currentConfig.fog.density);

    // 1. Golden Morning Directional Sun + Sky/Forest Hemisphere + Soft Shadows (2048x2048 PCFSoftShadowMap)
    this.ambientLight = new THREE.AmbientLight(
      this.currentConfig.lighting.ambient.color,
      this.currentConfig.lighting.ambient.intensity
    );
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#ffdcb0', '#243a1f', 0.48);
    this.scene.add(this.hemiLight);

    this.directionalLight = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    this.directionalLight.position.set(sunPosition[0], sunPosition[1], sunPosition[2]);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 235;
    this.directionalLight.shadow.camera.left = -88;
    this.directionalLight.shadow.camera.right = 88;
    this.directionalLight.shadow.camera.top = 88;
    this.directionalLight.shadow.camera.bottom = -88;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.02;
    this.directionalLight.target.position.set(-1, 1, -4);
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);

    const sunDir = new THREE.Vector3(sunPosition[0], sunPosition[1], sunPosition[2]).normalize();

    // 2. Physical Sky IBL (PMREMGenerator + THREE.Sky) & Golden-Hour Alpine Sky Dome
    this.buildPhysicalSkyAndIBL(renderer, sunDir);

    // 3. 512x512 Procedural PBR Texture Sets (Furrowed Pine Bark, Oak Bark, Timber Beam, Stone Masonry, River Granite, Granite Cliff)
    const pineBark = createPineBarkPbrTextures({ size: 512, seed: 6421, renderer, repeatX: 3, repeatY: 5 });
    const oakBark = createOakBarkPbrTextures({ size: 512, seed: 7411, renderer, repeatX: 4, repeatY: 6 });
    for (const tex of [oakBark.map, oakBark.normalMap, oakBark.roughnessMap, oakBark.aoMap]) {
      tex.repeat.set(4, 6);
    }
    const timberBeam = createTimberBeamPbrTextures({ size: 512, seed: 5821, renderer });
    const stoneMasonry = createStoneMasonryPbrTextures({
      size: 512,
      seed: 4931,
      renderer,
      repeatX: 2,
      repeatY: 2
    });
    const riverGranite = createRiverGranitePbrTextures({
      size: 512,
      seed: 8123,
      renderer,
      repeatX: 4,
      repeatY: 4
    });
    const graniteCliff = createGraniteCliffPbrTextures({
      size: 512,
      seed: 7319,
      renderer,
      repeatX: 2,
      repeatY: 2,
      normalStrength: 3.6
    });
    this.pbrSets.push(pineBark, oakBark, timberBeam, stoneMasonry, riverGranite, graniteCliff);

    // 4. Towering Layered Misty Alpine Mountain Peaks (360° sculpted ridges)
    this.buildMountainRanges(sunDir);

    // 5. PBR Forest Floor Terrain (660x660) + Granite Boulders, Wet Pebbles, Rocky Island & Multi-Tiered Waterfall
    this.buildTerrain(renderer, sunDir);
    const streamBoulders = this.buildRiverBoulders(graniteCliff);
    this.buildRiverbedStones(riverGranite);
    this.buildMountainStream(sunDir, streamBoulders);
    this.buildWaterfall(graniteCliff, sunDir);
    const islandFloraTargets = this.buildRiverIsland(graniteCliff, oakBark);

    // 6. Procedural Multi-Tier Pine Forest, Nurse Logs, Ferns, Varied Grass Tufts & Wild Forest Blossoms
    const treeRoots = this.buildPineForest(renderer, pineBark, sunDir, islandFloraTargets);
    const nurseLogs = this.buildFallenNurseLogs(oakBark);
    this.buildForestFerns(renderer, treeRoots, nurseLogs, sunDir, islandFloraTargets);
    this.buildForestGrass(sunDir);
    this.buildForestBlossoms(sunDir, treeRoots, nurseLogs);

    // 7. PBR Rustic Footbridge, Downstream Stone Viewing Bridge, Stepping-Stone & Lantern Trail, Forest Shrine & Watchtower
    this.buildFootbridge(timberBeam, stoneMasonry);
    this.buildDownstreamViewingBridge(stoneMasonry, timberBeam);
    this.buildTrailSteppingStones(riverGranite, graniteCliff, timberBeam);
    this.buildForestShrine(stoneMasonry, graniteCliff, timberBeam);
    this.buildRangerWatchtower(timberBeam, stoneMasonry, graniteCliff);

    // 8. Volumetric God Rays, Gliding Woodland Birds, Jumping Stream Trout & Ripples, Drifting Stream Fog & Fireflies/Pollen Motes
    this.buildSunbeams(sunDir);
    this.buildSoaringBirds(sunDir);
    this.buildStreamTroutAndRipples(sunDir);
    this.buildValleyMist(sunDir);
    this.buildForestMotes();

    // 9. HDR CinematicPipeline (defaultStyle: 'natural' -> AgX + NaturalPhotorealPass DepthTexture)
    this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
      defaultStyle: 'natural',
      kuwaharaEnabled: false,
      bloomStrength: 0.30,
      bloomRadius: 0.40,
      bloomThreshold: 0.90
    });

    this.worldRuntime.attach({
      scene: this.scene,
      renderer,
      camera,
      directionalLight: this.directionalLight,
      pipeline: this.pipeline,
      fallbackFocusPos: this.getSpawnPoint().position,
      extraMaterials: this.extraMaterials
    });

    this.isInitialized = true;
  }

  /**
   * Injects world-scaled moss accumulation on upward-facing surfaces, dampness darkening,
   * and glossy wet stone roughness (0.22) near the meandering stream or waterfall splash zone
   * onto a MeshStandardMaterial via chained onBeforeCompile.
   */
  private applyWorldMossAndDampness(
    mat: THREE.MeshStandardMaterial,
    options: {
      mossAmount: number;
      dampYScale?: number;
      wetStreamFactor?: number;
      wetSplashZone?: { x: number; z: number; radius: number };
      cacheKey: string;
    }
  ): void {
    const mossAmt = options.mossAmount;
    const dampYScale = options.dampYScale ?? 0.35;
    const wetStreamFactor = options.wetStreamFactor ?? 0.0;
    const splashX = options.wetSplashZone?.x ?? 9999;
    const splashZ = options.wetSplashZone?.z ?? 9999;
    const splashR = options.wetSplashZone?.radius ?? 0.001;

    const prevCompile = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')
      ? mat.onBeforeCompile.bind(mat)
      : null;
    const prevCacheKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey')
      ? mat.customProgramCacheKey.bind(mat)
      : null;

    mat.customProgramCacheKey = () =>
      prevCacheKey ? `${prevCacheKey()}|${options.cacheKey}` : options.cacheKey;

    mat.onBeforeCompile = (shader, renderer) => {
      if (prevCompile) {
        prevCompile(shader, renderer);
      }

      shader.uniforms.uMossAmount = { value: mossAmt };
      shader.uniforms.uDampYScale = { value: dampYScale };
      shader.uniforms.uWetStreamFactor = { value: wetStreamFactor };
      shader.uniforms.uWetSplashZone = { value: new THREE.Vector3(splashX, splashZ, splashR) };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vPbrWorldPos;
          varying vec3 vPbrWorldNormal;
          varying float vPbrLocalY;`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          #ifdef USE_INSTANCING
            vPbrWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);
          #else
            vPbrWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
          #endif`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vPbrLocalY = position.y;
          #ifdef USE_INSTANCING
            vPbrWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vPbrWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uMossAmount;
          uniform float uDampYScale;
          uniform float uWetStreamFactor;
          uniform vec3 uWetSplashZone;
          varying vec3 vPbrWorldPos;
          varying vec3 vPbrWorldNormal;
          varying float vPbrLocalY;

          float pmHash(vec2 p) {
            p = fract(p * vec2(127.1, 311.7));
            p += dot(p, p + 19.19);
            return fract(p.x * p.y);
          }

          float pmNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(pmHash(i), pmHash(i + vec2(1.0, 0.0)), u.x),
              mix(pmHash(i + vec2(0.0, 1.0)), pmHash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float nMossA = pmNoise(vPbrWorldPos.xz * 4.2 + vPbrWorldPos.y * 2.4);
          float nMossB = pmNoise(vPbrWorldPos.xz * 12.5 - vPbrWorldPos.y * 3.4);
          float upFacing = smoothstep(0.22, 0.72, vPbrWorldNormal.y + (nMossA - 0.5) * 0.36);
          float baseProximity = 1.0 - smoothstep(0.0, 2.4, max(vPbrLocalY, 0.0) * uDampYScale);
          float mossMask = clamp((upFacing * 0.82 + baseProximity * 0.34) * smoothstep(0.28, 0.74, nMossA * 0.58 + nMossB * 0.42), 0.0, 1.0) * uMossAmount;
          vec3 mossAlbedo = mix(vec3(0.036, 0.145, 0.034), vec3(0.115, 0.285, 0.056), nMossB);
          diffuseColor.rgb = mix(diffuseColor.rgb, mossAlbedo, mossMask);

          float streamCx = sin(vPbrWorldPos.z * 0.055) * 8.0;
          float dStream = abs(vPbrWorldPos.x - streamCx);
          float streamDamp = (1.0 - smoothstep(2.4, 5.2, dStream)) * (1.0 - smoothstep(-0.25, 0.52, vPbrLocalY)) * uWetStreamFactor;
          float splashDist = length(vPbrWorldPos.xz - uWetSplashZone.xy);
          float splashDamp = (1.0 - smoothstep(uWetSplashZone.z * 0.45, uWetSplashZone.z, splashDist)) * smoothstep(42.0, 16.0, vPbrWorldPos.y);
          float dampMask = clamp(max(streamDamp, splashDamp), 0.0, 1.0);
          diffuseColor.rgb *= mix(1.0, 0.54, dampMask);`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float rMossA = pmNoise(vPbrWorldPos.xz * 4.2 + vPbrWorldPos.y * 2.4);
          float rMossB = pmNoise(vPbrWorldPos.xz * 12.5 - vPbrWorldPos.y * 3.4);
          float rUpFacing = smoothstep(0.22, 0.72, vPbrWorldNormal.y + (rMossA - 0.5) * 0.36);
          float rMossMask = clamp(rUpFacing * 0.82 * smoothstep(0.28, 0.74, rMossA * 0.58 + rMossB * 0.42) * uMossAmount, 0.0, 1.0);
          float rStreamCx = sin(vPbrWorldPos.z * 0.055) * 8.0;
          float rDStream = abs(vPbrWorldPos.x - rStreamCx);
          float rStreamDamp = (1.0 - smoothstep(2.4, 5.2, rDStream)) * (1.0 - smoothstep(-0.25, 0.52, vPbrLocalY)) * uWetStreamFactor;
          float rSplashDist = length(vPbrWorldPos.xz - uWetSplashZone.xy);
          float rSplashDamp = (1.0 - smoothstep(uWetSplashZone.z * 0.45, uWetSplashZone.z, rSplashDist)) * smoothstep(42.0, 16.0, vPbrWorldPos.y);
          float rDamp = clamp(max(rStreamDamp, rSplashDamp), 0.0, 1.0);
          roughnessFactor = mix(roughnessFactor, 0.94, rMossMask * 0.72);
          roughnessFactor = mix(roughnessFactor, 0.15, rDamp);`
        );
    };
  }

  private buildPhysicalSkyAndIBL(renderer: THREE.WebGLRenderer | undefined, sunDir: THREE.Vector3): void {
    const geo = new THREE.SphereGeometry(460, 48, 28);

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSwirlSpeed: { value: this.currentConfig!.sky.swirlSpeed ?? 0.4 },
        uBassEnergy: { value: 0.0 },
        uTopColor: { value: new THREE.Color(this.currentConfig!.sky.topColor) },
        uBottomColor: { value: new THREE.Color(this.currentConfig!.sky.bottomColor) },
        uHorizonColor: { value: new THREE.Color(this.currentConfig!.sky.horizonColor) },
        uSunDirection: { value: sunDir.clone() }
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSwirlSpeed;
        uniform float uBassEnergy;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDirection;
        varying vec3 vDir;

        float skyHash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.12);
          return fract(p.x * p.y);
        }

        float skyNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
            mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float skyFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * skyNoise(p);
            p = p * 2.03 + vec2(7.3, 13.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 sunDir = normalize(uSunDirection);
          float sunDot = max(dot(dir, sunDir), 0.0);

          // Warm golden-hour misty alpine sky gradient (amber horizon -> apricot mid -> clear alpine cobalt)
          vec3 col = mix(uHorizonColor * 0.94, uBottomColor * 0.88, smoothstep(0.0, 0.22, h));
          col = mix(col, uTopColor * 0.78, smoothstep(0.20, 0.85, h));

          // Golden-hour Mie atmospheric horizon warmth aligned toward sun azimuth
          float horizonBand = exp(-abs(dir.y) * 4.4);
          vec2 dirXZ = normalize(dir.xz + vec2(1e-4));
          vec2 sunXZ = normalize(sunDir.xz + vec2(1e-4));
          float sunAzimuth = pow(max(dot(dirXZ, sunXZ) * 0.5 + 0.5, 0.0), 2.2);
          col += vec3(1.12, 0.72, 0.34) * horizonBand * (0.14 + 0.42 * sunAzimuth);

          // Sunlit golden alpine cirrus & altocumulus wisps
          if (dir.y > 0.03) {
            vec2 skyUv = dir.xz / (dir.y + 0.26);
            float drift = uTime * 0.015 * max(uSwirlSpeed, 0.1);
            float wisp1 = skyFbm(skyUv * 1.15 + vec2(drift, -drift * 0.5));
            float wisp2 = skyFbm(skyUv * 2.35 - vec2(drift * 0.7, drift * 0.2));
            float cirrus = smoothstep(0.46, 0.80, wisp1 * 0.65 + wisp2 * 0.35);
            float altMask = smoothstep(0.03, 0.24, dir.y) * (1.0 - smoothstep(0.68, 0.98, dir.y));
            vec3 cloudCol = mix(vec3(0.84, 0.78, 0.76), vec3(1.28, 0.92, 0.56), pow(sunDot, 1.8));
            col = mix(col, cloudCol, cirrus * altMask * 0.44);
          }

          float sunDisc = smoothstep(0.9972, 0.9993, sunDot) * (2.6 + uBassEnergy * 0.4);
          float sunGlow = pow(sunDot, 20.0) * 0.72 + pow(sunDot, 4.0) * 0.28;
          col += vec3(1.24, 0.90, 0.50) * (sunDisc + sunGlow);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, this.skyMaterial);
    mesh.name = 'SkyDome';
    this.scene.add(mesh);

    // Bake atmospheric golden-hour THREE.Sky into scene.environment via PMREMGenerator
    if (renderer && typeof renderer.getContext === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const skyScene = new THREE.Scene();
        const envSky = new Sky();
        envSky.scale.setScalar(10000);
        const envU = envSky.material.uniforms;
        envU['turbidity'].value = 4.2;
        envU['rayleigh'].value = 2.05;
        envU['mieCoefficient'].value = 0.007;
        envU['mieDirectionalG'].value = 0.88;
        envU['sunPosition'].value.copy(sunDir).normalize();
        skyScene.add(envSky);

        this.envRenderTarget = pmrem.fromScene(skyScene, 0.04);
        this.scene.environment = this.envRenderTarget.texture;
        this.scene.environmentIntensity = 0.56;

        envSky.geometry.dispose();
        envSky.material.dispose();
        pmrem.dispose();
      } catch {
        // Fallback cleanly in headless/mock renderers
      }
    }
  }

  private buildMountainRanges(sunDir: THREE.Vector3): void {
    const rings = [
      {
        rFoot: 148,
        rCrest: 196,
        yFoot: 10,
        basePeak: 58,
        peakAmp: 28,
        snowLine: 45,
        treeLine: 28,
        radialSegs: 192,
        heightSegs: 22,
        seed: 1.2
      },
      {
        rFoot: 190,
        rCrest: 252,
        yFoot: 16,
        basePeak: 82,
        peakAmp: 34,
        snowLine: 52,
        treeLine: 30,
        radialSegs: 192,
        heightSegs: 24,
        seed: 3.7
      },
      {
        rFoot: 244,
        rCrest: 312,
        yFoot: 24,
        basePeak: 106,
        peakAmp: 38,
        snowLine: 58,
        treeLine: 33,
        radialSegs: 160,
        heightSegs: 18,
        seed: 6.4
      }
    ];

    const waterfallAngle = Math.atan2(-138.0, getStreamCenterX(-137.5));

    rings.forEach((ring, idx) => {
      const cols = ring.radialSegs + 1;
      const rows = ring.heightSegs + 1;
      const vertCount = cols * rows;
      const positions = new Float32Array(vertCount * 3);
      const uvs = new Float32Array(vertCount * 2);
      const indices: number[] = [];

      for (let i = 0; i < cols; i++) {
        const iWrap = i % ring.radialSegs;
        const angle = (iWrap / ring.radialSegs) * Math.PI * 2;
        const u = i / ring.radialSegs;

        const ridge1 = Math.pow(Math.max(0, 1.0 - Math.abs(Math.sin(angle * 4.0 + ring.seed))), 1.55);
        const ridge2 = Math.pow(Math.max(0, 1.0 - Math.abs(Math.cos(angle * 7.0 - ring.seed * 1.8))), 1.45);
        const ridge3 = Math.sin(angle * 13.0 + ring.seed * 2.5) * 0.5 + 0.5;
        const ridge4 = Math.cos(angle * 23.0 - ring.seed * 0.7) * 0.5 + 0.5;

        let peakH =
          ring.basePeak +
          (ridge1 * 0.48 + ridge2 * 0.30 + ridge3 * 0.14 + ridge4 * 0.08) * ring.peakAmp -
          ring.peakAmp * 0.30;

        if (idx === 0) {
          const dAng = Math.atan2(Math.sin(angle - waterfallAngle), Math.cos(angle - waterfallAngle));
          const wfInfluence = Math.exp(-(dAng * dAng) / 0.032);
          peakH = peakH * (1.0 - wfInfluence) + 46.0 * wfInfluence;
        }

        for (let j = 0; j < rows; j++) {
          const v = j / ring.heightSegs;
          const idxVert = i * rows + j;

          const spurEnv = Math.sin(v * Math.PI * 0.88);
          const spurNoise =
            Math.sin(angle * 17.0 + ring.seed + v * 2.4) * 0.55 +
            Math.cos(angle * 29.0 - ring.seed * 1.3 - v * 3.1) * 0.45;
          const radius =
            ring.rFoot +
            (ring.rCrest - ring.rFoot) * Math.pow(Math.max(0, v), 0.86) +
            spurNoise * 7.5 * spurEnv;

          const cragMod =
            (Math.sin(angle * 19.0 + v * 6.0 + ring.seed) * 1.8 +
              Math.cos(angle * 31.0 - v * 4.5) * 1.1) *
            Math.sin(v * Math.PI);

          const y = ring.yFoot + (peakH - ring.yFoot) * Math.pow(Math.max(0, v), 1.06) + cragMod;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;

          positions[idxVert * 3] = x;
          positions[idxVert * 3 + 1] = y;
          positions[idxVert * 3 + 2] = z;

          uvs[idxVert * 2] = u;
          uvs[idxVert * 2 + 1] = v;
        }
      }

      for (let i = 0; i < ring.radialSegs; i++) {
        for (let j = 0; j < ring.heightSegs; j++) {
          const v00 = i * rows + j;
          const v10 = (i + 1) * rows + j;
          const v01 = i * rows + (j + 1);
          const v11 = (i + 1) * rows + (j + 1);
          indices.push(v00, v10, v01);
          indices.push(v10, v11, v01);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const normAttr = geo.attributes.normal;
      for (let j = 0; j < rows; j++) {
        const a = j;
        const b = ring.radialSegs * rows + j;
        const nx = (normAttr.getX(a) + normAttr.getX(b)) * 0.5;
        const ny = (normAttr.getY(a) + normAttr.getY(b)) * 0.5;
        const nz = (normAttr.getZ(a) + normAttr.getZ(b)) * 0.5;
        const len = Math.hypot(nx, ny, nz) || 1;
        normAttr.setXYZ(a, nx / len, ny / len, nz / len);
        normAttr.setXYZ(b, nx / len, ny / len, nz / len);
      }
      normAttr.needsUpdate = true;

      const mat = createAlpineRidgeMaterial({
        sunDirection: sunDir,
        mistColor: this.currentConfig!.fog.color,
        horizonColor: this.currentConfig!.sky.horizonColor,
        snowLine: ring.snowLine,
        treeLine: ring.treeLine
      });
      this.alpineMaterials.push(mat);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `MountainRange_${idx + 1}`;
      this.scene.add(mesh);
    });
  }

  private buildTerrain(renderer: THREE.WebGLRenderer | undefined, sunDir: THREE.Vector3): void {
    const geo = new THREE.PlaneGeometry(660, 660, 240, 240);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getMistyForestHeight(x, z));
    }
    geo.computeVertexNormals();

    const detailTex = createForestFloorDetailTexture(renderer, 256);
    this.extraTextures.push(detailTex);

    this.terrainHandle = createValleyTerrainMaterial({
      windSpeed: this.currentConfig?.wind?.speed ?? 1.8,
      sunDirection: sunDir,
      detailTex
    });

    const mesh = new THREE.Mesh(geo, this.terrainHandle.material);
    mesh.name = 'ForestValleyTerrain';
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private getStreamWaterY(z: number): number {
    const streamCenterX = getStreamCenterX(z);
    const rSq = streamCenterX * streamCenterX + z * z;
    const valleyBase =
      (0.0032 * rSq) / (1.0 + rSq * 0.00014) +
      1.1 * Math.sin(0.05 * streamCenterX + 0.4) * Math.cos(0.05 * z) +
      0.55 * Math.cos(0.08 * z - 0.3);
    return Math.min(22.0, valleyBase - 0.42);
  }

  private buildMountainStream(sunDir: THREE.Vector3, streamBoulders: THREE.Vector4[]): void {
    const waterGeo = new THREE.PlaneGeometry(14.8, 340, 30, 220);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.translate(0, 0, 16);

    const isl = getRiverIslandCenter();
    const pos = waterGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const streamCenterX = getStreamCenterX(lz);
      const dzIsl = lz - isl.z;
      const widen = 1.0 + 0.42 * Math.exp(-(dzIsl * dzIsl) / 96.0);
      const wx = streamCenterX + lx * widen;
      pos.setX(i, wx);
      pos.setY(i, this.getStreamWaterY(lz));
    }
    waterGeo.computeVertexNormals();

    this.waterMaterial = createForestWaterMaterial({
      sunDirection: sunDir,
      horizonColor: this.currentConfig?.sky?.horizonColor ?? '#ffe0ab',
      skyTopColor: this.currentConfig?.sky?.topColor ?? '#2c68a3',
      streamBoulders,
      riverIsland: new THREE.Vector4(isl.x, isl.z, isl.rx, isl.rz)
    });
    this.waterMaterial.fragmentShader = this.waterMaterial.fragmentShader
      .replace('smoothstep(-74.0, -94.0, vWorldPos.z)', 'smoothstep(-116.0, -136.0, vWorldPos.z)')
      .replace('sin(-95.0 * 0.055) * 8.0, -95.0', 'sin(-137.5 * 0.055) * 8.0, -137.5');
    this.waterMaterial.needsUpdate = true;
    const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    waterMesh.name = 'MountainStream';
    this.scene.add(waterMesh);
  }

  private buildWaterfall(graniteCliff: PbrTextureSet, sunDir: THREE.Vector3): void {
    const group = new THREE.Group();
    group.name = 'DistantWaterfall';

    const wfX = getStreamCenterX(-137.5);
    const wfZ = -138.5;

    const cliffParts: THREE.BufferGeometry[] = [];

    // 1. High-subdivision sculpted granite canyon amphitheater wall with horizontal/tilted slate strata ledges & jagged skyline
    const cliffGeo = new THREE.PlaneGeometry(78, 48, 128, 72);
    const cPos = cliffGeo.attributes.position;
    const cUv = cliffGeo.attributes.uv;
    for (let i = 0; i < cPos.count; i++) {
      const vx = cPos.getX(i);
      const vy = cPos.getY(i);
      const uNorm = vx / 39.0;
      const vNorm = Math.max(0, Math.min(1, (vy + 24.0) / 48.0));

      // Taper outer wings smoothly down into valley hills + carve jagged mountain peak skyline
      const wingDrop = Math.pow(Math.abs(uNorm), 1.75) * 16.5;
      const notch = Math.exp(-(vx * vx) / 30.0) * 3.2;
      const upperNotch = Math.exp(-Math.pow((vx + 6.8) / 3.8, 2.0)) * 2.4;
      const peakSkyline =
        (1.0 - Math.abs(Math.sin(vx * 0.14 + 0.4))) * 7.2 +
        (1.0 - Math.abs(Math.cos(vx * 0.31 - 0.8))) * 3.8 +
        Math.sin(vx * 0.58) * 1.4;
      const finalY = vy + (peakSkyline - wingDrop - notch - upperNotch) * Math.pow(vNorm, 1.35);

      // Deeply carved main waterfall gorge chute + integral stepped rock cascade ledges + side walls
      const inChute = Math.exp(-(vx * vx) / 15.5);
      const channelIndent = inChute * 4.2;
      const canyonWalls = Math.exp(-Math.pow((Math.abs(vx) - 11.2) / 6.8, 2.0)) * 4.8 * (1.0 - vNorm * 0.42);
      const canyonWrap = Math.pow(Math.abs(uNorm), 1.55) * 13.5;

      // 3 stepped horizontal/tilted granite cascade shelves jutting outward inside the chute
      const ledge1 = Math.exp(-Math.pow((vy - 9.0) * 0.40, 2.0)) * inChute * 1.95;
      const ledge2 = Math.exp(-Math.pow((vy - 2.6) * 0.38, 2.0)) * inChute * 2.25;
      const ledge3 = Math.exp(-Math.pow((vy + 4.2) * 0.36, 2.0)) * inChute * 2.55;

      // Projecting mid-chute rock spurs that physically part the main water curtain
      const midSplit1 = Math.exp(-Math.pow((vx + 1.15) * 0.78, 2.0)) * Math.exp(-Math.pow((vy - 4.2) * 0.48, 2.0)) * 1.9;
      const midSplit2 = Math.exp(-Math.pow((vx - 1.35) * 0.75, 2.0)) * Math.exp(-Math.pow((vy + 1.8) * 0.48, 2.0)) * 2.0;

      // Angular stepped granite strata & vertical cleavage fractures
      const strataStep = Math.floor((vy + vx * 0.08 + Math.sin(vx * 0.16) * 1.2) / 3.0) * 0.58;
      const fracture =
        (1.0 - Math.abs(Math.sin(vx * 0.42 + vy * 0.22))) * 1.65 +
        Math.cos(vx * 0.92 - vy * 0.38) * 0.72;
      const cragZ =
        strataStep +
        fracture -
        channelIndent +
        canyonWalls +
        canyonWrap +
        ledge1 +
        ledge2 +
        ledge3 +
        midSplit1 +
        midSplit2;
      const upperLedge = vy > 10.5 ? -2.4 : 0.0;
      cPos.setXYZ(i, vx, finalY, cragZ + upperLedge);
      cUv.setXY(i, vx / 5.5, finalY / 5.5);
    }
    cliffGeo.computeVertexNormals();
    cliffParts.push(prepareForMerge(cliffGeo));
    cliffGeo.dispose();

    // 2. Grounded angular granite strata outcrops & upper cascade terrace flanking the plunge pool
    const shelfSpecs: Array<{ x: number; y: number; z: number; rx: number; ry: number; rz: number; seed: number }> = [
      { x: -8.8, y: -8.2, z: 3.2, rx: 6.2, ry: 3.6, rz: 4.5, seed: 7.3 },
      { x: 9.2, y: -8.0, z: 3.4, rx: 6.4, ry: 3.8, rz: 4.6, seed: 8.9 },
      { x: -16.0, y: -7.5, z: 5.6, rx: 6.8, ry: 4.2, rz: 4.8, seed: 10.4 },
      { x: 16.4, y: -7.2, z: 5.8, rx: 7.0, ry: 4.4, rz: 5.0, seed: 11.8 },
      // Secondary upper cascade granite buttress on upper west shelf
      { x: -7.2, y: 12.8, z: -2.4, rx: 5.5, ry: 4.8, rz: 4.2, seed: 14.2 },
      // Eastern spring-cleft granite shelf capping the side cascade
      { x: 7.4, y: 2.8, z: -0.4, rx: 4.5, ry: 3.6, rz: 3.6, seed: 18.7 },
      // Mid-chute mossy rock divider shelf
      { x: -0.9, y: 1.5, z: 1.8, rx: 1.5, ry: 1.1, rz: 1.3, seed: 16.5 }
    ];

    const sMat = new THREE.Matrix4();
    const sPos = new THREE.Vector3();
    const sQuat = new THREE.Quaternion();
    const sScale = new THREE.Vector3();

    for (const sh of shelfSpecs) {
      const outcrop = new THREE.IcosahedronGeometry(1.0, 2);
      const oPos = outcrop.attributes.position;
      const oUv = outcrop.attributes.uv;
      for (let k = 0; k < oPos.count; k++) {
        let px = oPos.getX(k);
        let py = oPos.getY(k);
        let pz = oPos.getZ(k);
        const ridge = 1.0 - Math.abs(Math.sin(px * 3.4 + sh.seed) * Math.cos(pz * 3.1 - sh.seed));
        const stepY = Math.round(py * 3.0) / 3.0;
        const disp = 0.85 + ridge * 0.25 + Math.sin(py * 4.5 + px * 2.2) * 0.10;
        px *= disp;
        py = py * 0.72 + stepY * 0.28;
        pz *= disp;
        oPos.setXYZ(k, px, py, pz);
        oUv.setXY(k, (px * sh.rx) / 5.5, (py * sh.ry) / 5.5);
      }
      outcrop.computeVertexNormals();
      sPos.set(sh.x, sh.y, sh.z);
      sQuat.setFromEuler(new THREE.Euler(0.08 * Math.sin(sh.seed), sh.seed * 0.4, 0.06 * Math.cos(sh.seed)));
      sScale.set(sh.rx, sh.ry, sh.rz);
      sMat.compose(sPos, sQuat, sScale);
      cliffParts.push(prepareForMerge(outcrop, sMat));
      outcrop.dispose();
    }

    const mergedCliff = mergeGeometries(cliffParts, false)!;
    cliffParts.forEach((g) => g.dispose());

    const cliffMat = new THREE.MeshStandardMaterial({
      map: graniteCliff.map,
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(1.85, 1.85),
      roughnessMap: graniteCliff.roughnessMap,
      roughness: 1.0,
      aoMap: graniteCliff.aoMap,
      aoMapIntensity: 0.92
    });
    applyWaterfallCliffStrataShader(cliffMat, {
      waterfallCenterX: wfX,
      waterfallZ: wfZ,
      cascadeHalfWidth: 4.2,
      cacheKey: 'misty-waterfall-strata-cliff-v2'
    });
    applyWorldSpaceWeathering(cliffMat, {
      macroScale: 0.14,
      mossHeight: 22.0,
      mossColor: '#2c5922',
      dampRoughness: 0.22,
      dirtTint: '#322b24'
    });

    const cliffMesh = new THREE.Mesh(mergedCliff, cliffMat);
    cliffMesh.name = 'WaterfallCliff';
    cliffMesh.position.set(wfX, 32.0, wfZ - 1.4);
    cliffMesh.receiveShadow = true;
    group.add(cliffMesh);

    // 3. Main Multi-Tiered Rocky Cascade Sheet arcing over the 3 granite shelves
    const buildCascadeSheet = (w: number, h: number, arcOut: number): THREE.BufferGeometry => {
      const geo = new THREE.PlaneGeometry(w, h, 28, 48);
      const wPos = geo.attributes.position;
      for (let i = 0; i < wPos.count; i++) {
        const vx = wPos.getX(i);
        const vy = wPos.getY(i);
        const t = Math.max(0, Math.min(1, (vy + h * 0.5) / h));
        const baseArc = Math.sin((1.0 - t) * Math.PI * 0.52) * arcOut - t * t * 0.65;
        const ledgeBounce =
          Math.exp(-Math.pow((t - 0.76) * 9.0, 2.0)) * (arcOut * 0.24) +
          Math.exp(-Math.pow((t - 0.50) * 8.5, 2.0)) * (arcOut * 0.28) +
          Math.exp(-Math.pow((t - 0.25) * 8.0, 2.0)) * (arcOut * 0.30);
        const curtainWave = Math.sin(vx * 1.45 + t * 3.2) * 0.28;
        wPos.setZ(i, baseArc + ledgeBounce + curtainWave);
      }
      geo.computeVertexNormals();
      return geo;
    };

    this.waterfallMaterial = createWaterfallMaterial({
      sunDirection: sunDir,
      layerMode: 0.0
    });
    this.waterfallSprayMaterial = createWaterfallMaterial({
      sunDirection: sunDir,
      layerMode: 1.0
    });

    const cascadeMesh = new THREE.Mesh(buildCascadeSheet(8.4, 26.0, 3.2), this.waterfallMaterial);
    cascadeMesh.name = 'WaterfallCascade';
    cascadeMesh.position.set(wfX, 34.7, wfZ - 0.1);
    group.add(cascadeMesh);

    // Outer frothy spray veil layer for multi-layer UV-scrolled depth parallax
    const cascadeVeilMesh = new THREE.Mesh(buildCascadeSheet(9.0, 26.2, 3.55), this.waterfallSprayMaterial);
    cascadeVeilMesh.name = 'WaterfallCascadeSprayVeil';
    cascadeVeilMesh.position.set(wfX, 34.6, wfZ + 0.42);
    group.add(cascadeVeilMesh);

    // 3b. Secondary Upper Cascade pouring down from the upper granite gorge into the headwall basin
    const upperCascadeMesh = new THREE.Mesh(buildCascadeSheet(4.8, 13.5, 2.1), this.waterfallMaterial);
    upperCascadeMesh.name = 'UpperWaterfallCascade';
    upperCascadeMesh.position.set(wfX - 5.4, 47.7, wfZ - 3.6);
    upperCascadeMesh.rotation.y = 0.22;
    group.add(upperCascadeMesh);

    const upperVeilMesh = new THREE.Mesh(buildCascadeSheet(5.1, 13.6, 2.3), this.waterfallSprayMaterial);
    upperVeilMesh.name = 'UpperWaterfallSprayVeil';
    upperVeilMesh.position.set(wfX - 5.3, 47.6, wfZ - 3.2);
    upperVeilMesh.rotation.y = 0.22;
    group.add(upperVeilMesh);

    // 3c. Eastern Spring Side Cascade spilling from the eastern mossy rock cleft
    const sideCascadeMesh = new THREE.Mesh(buildCascadeSheet(2.9, 12.2, 2.0), this.waterfallMaterial);
    sideCascadeMesh.name = 'SideSpringCascade';
    sideCascadeMesh.position.set(wfX + 7.4, 28.9, wfZ - 0.1);
    sideCascadeMesh.rotation.y = -0.18;
    group.add(sideCascadeMesh);

    // 4. Turbulent plunge-pool foam rings, multi-layered mist spray curtains & rising mist particles
    this.waterfallPlungeFoamMaterial = createWaterfallPlungeFoamMaterial({
      mistColor: '#f6eedb'
    });
    const plungeFoamGeo = new THREE.PlaneGeometry(19.5, 15.5);
    plungeFoamGeo.rotateX(-Math.PI / 2);
    const plungeFoamMesh = new THREE.Mesh(plungeFoamGeo, this.waterfallPlungeFoamMaterial);
    plungeFoamMesh.name = 'WaterfallPlungeFoam';
    plungeFoamMesh.position.set(wfX, 24.15, wfZ + 2.8);
    group.add(plungeFoamMesh);

    const streamBasinY = getMistyForestHeight(wfX, wfZ + 4.8) + 0.18;
    const basinFoamGeo = new THREE.PlaneGeometry(16.0, 14.0);
    basinFoamGeo.rotateX(-Math.PI / 2);
    const basinFoamMesh = new THREE.Mesh(basinFoamGeo, this.waterfallPlungeFoamMaterial);
    basinFoamMesh.name = 'WaterfallStreamBasinFoam';
    basinFoamMesh.position.set(wfX, Math.max(16.8, streamBasinY), wfZ + 5.2);
    group.add(basinFoamMesh);

    this.waterfallMistMaterial = createValleyMistMaterial({
      mistColor: '#f5ead6'
    });
    const spraySpecs = [
      { x: 0.0, y: 25.5, z: 2.9, w: 20, h: 10.5, ry: 0.0 },
      { x: -3.5, y: 26.1, z: 3.6, w: 15, h: 9.0, ry: 0.28 },
      { x: 3.8, y: 25.9, z: 3.5, w: 15, h: 9.0, ry: -0.26 },
      { x: 0.0, y: 21.0, z: 5.8, w: 18, h: 8.5, ry: 0.05 },
      { x: -4.8, y: 42.0, z: -2.2, w: 11, h: 6.5, ry: 0.18 }
    ];
    spraySpecs.forEach((sp, idx) => {
      const sprayGeo = new THREE.PlaneGeometry(sp.w, sp.h);
      const sprayMesh = new THREE.Mesh(sprayGeo, this.waterfallMistMaterial!);
      sprayMesh.name = idx === 0 ? 'WaterfallSpray' : `WaterfallSpray_${idx + 1}`;
      sprayMesh.position.set(wfX + sp.x, sp.y, wfZ + sp.z);
      sprayMesh.rotation.y = sp.ry;
      group.add(sprayMesh);
    });

    // 4b. Rising Waterfall Mist & Spray Particles (THREE.Points)
    const mistPtCount = 240;
    const mistPos = new Float32Array(mistPtCount * 3);
    const mistData = new Float32Array(mistPtCount * 4);
    for (let i = 0; i < mistPtCount; i++) {
      const isUpper = i >= 190;
      const isBasin = i >= 110 && i < 190;
      const baseX = wfX + (isUpper ? -5.0 : 0.0) + (pseudoRand(i * 1.73) - 0.5) * (isUpper ? 5.0 : 12.0);
      const baseY = isUpper ? 40.5 : isBasin ? Math.max(16.8, streamBasinY) : 24.1;
      const baseZ = wfZ + (isUpper ? -2.2 : isBasin ? 5.6 : 2.8) + (pseudoRand(i * 2.91) - 0.5) * 4.5;
      mistPos[i * 3] = baseX;
      mistPos[i * 3 + 1] = baseY;
      mistPos[i * 3 + 2] = baseZ;
      mistData[i * 4] = pseudoRand(i * 4.17);
      mistData[i * 4 + 1] = 0.14 + pseudoRand(i * 5.33) * 0.14;
      mistData[i * 4 + 2] = (pseudoRand(i * 6.49) - 0.5) * 4.2;
      mistData[i * 4 + 3] = 1.0 + pseudoRand(i * 7.81) * 3.8;
    }
    const mistPtGeo = new THREE.BufferGeometry();
    mistPtGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    mistPtGeo.setAttribute('aParticleData', new THREE.BufferAttribute(mistData, 4));
    this.waterfallMistParticlesMaterial = createWaterfallMistParticlesMaterial({
      mistColor: '#f6eedb'
    });
    const mistPts = new THREE.Points(mistPtGeo, this.waterfallMistParticlesMaterial);
    mistPts.name = 'WaterfallMistParticles';
    group.add(mistPts);

    this.scene.add(group);
  }

  /**
   * Builds a sculpted mossy granite Rocky Island in the widened mountain stream (z = -26),
   * complete with stratified granite shelf outcrops & flora anchor points for island pines/ferns.
   */
  private buildRiverIsland(
    graniteCliff: PbrTextureSet,
    _oakBark: PbrTextureSet
  ): Array<{ x: number; y: number; z: number }> {
    const isl = getRiverIslandCenter();
    const parts: THREE.BufferGeometry[] = [];

    const shelfConfigs = [
      { dx: 0.0, dz: 0.0, rx: 2.55, ry: 1.05, rz: 4.8, yaw: 0.12, seed: 3.1 },
      { dx: -1.1, dz: 1.8, rx: 1.65, ry: 0.72, rz: 2.4, yaw: 0.65, seed: 5.4 },
      { dx: 1.25, dz: -1.6, rx: 1.55, ry: 0.68, rz: 2.2, yaw: -0.48, seed: 7.9 },
      { dx: 0.2, dz: -3.8, rx: 1.45, ry: 0.58, rz: 1.9, yaw: 0.24, seed: 9.6 }
    ];

    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    for (const sc of shelfConfigs) {
      const geo = new THREE.IcosahedronGeometry(1.0, 2);
      const p = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        let vx = p.getX(i);
        let vy = p.getY(i);
        let vz = p.getZ(i);
        const ridge = 1.0 - Math.abs(Math.sin(vx * 3.2 + sc.seed) * Math.cos(vz * 2.9 - sc.seed));
        const strataY = Math.round(vy * 3.0) / 3.0;
        const disp = 0.86 + ridge * 0.24 + Math.sin(vy * 4.4 + vx * 2.2) * 0.10;
        vx *= disp;
        vy = vy * 0.68 + strataY * 0.24;
        vz *= disp;
        if (vy < -0.2) vy = -0.2 + (vy + 0.2) * 0.35;
        p.setXYZ(i, vx, vy, vz);
        uv.setXY(i, (vx * sc.rx) / 3.2, (vy * sc.ry) / 3.2);
      }
      geo.computeVertexNormals();

      const wx = isl.x + sc.dx;
      const wz = isl.z + sc.dz;
      const wy = getMistyForestHeight(wx, wz) - 0.12;
      pos.set(wx, wy, wz);
      quat.setFromEuler(new THREE.Euler(0.05 * Math.sin(sc.seed), sc.yaw, 0.04 * Math.cos(sc.seed)));
      scl.set(sc.rx, sc.ry, sc.rz);
      mat4.compose(pos, quat, scl);
      parts.push(prepareForMerge(geo, mat4));
      geo.dispose();
    }

    const merged = mergeGeometries(parts, false)!;
    parts.forEach((g) => g.dispose());

    const islandMat = new THREE.MeshStandardMaterial({
      map: graniteCliff.map,
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(1.75, 1.75),
      roughnessMap: graniteCliff.roughnessMap,
      roughness: 0.92,
      aoMap: graniteCliff.aoMap,
      aoMapIntensity: 0.90
    });
    this.applyWorldMossAndDampness(islandMat, {
      mossAmount: 0.72,
      dampYScale: 1.15,
      wetStreamFactor: 0.95,
      cacheKey: 'misty-river-island-granite-v1'
    });
    applyWorldSpaceWeathering(islandMat, {
      macroScale: 0.32,
      mossHeight: getMistyForestHeight(isl.x, isl.z) + 0.35,
      mossColor: '#2e6022',
      dampRoughness: 0.20,
      dirtTint: '#362e24'
    });

    const islandMesh = new THREE.Mesh(merged, islandMat);
    islandMesh.name = 'RiverRockyIsland';
    islandMesh.castShadow = true;
    islandMesh.receiveShadow = true;
    this.scene.add(islandMesh);

    return [
      { x: isl.x - 0.35, y: getMistyForestHeight(isl.x - 0.35, isl.z - 0.6), z: isl.z - 0.6 },
      { x: isl.x + 0.55, y: getMistyForestHeight(isl.x + 0.55, isl.z + 1.4), z: isl.z + 1.4 }
    ];
  }

  /**
   * Builds sculpted furrowed pine trunks with flared mossy buttress roots, radial whorled bough limbs
   * curving outward and gently drooping at tips, and `aLimbFlex` weights for synchronized Tier-2 bounce.
   */
  private createSculptedPineTrunkAndLimbsGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    const mainTrunk = createPineTubeGeometry(
      [
        new THREE.Vector3(0, -0.35, 0),
        new THREE.Vector3(0.05, 2.4, -0.04),
        new THREE.Vector3(-0.04, 5.2, 0.05),
        new THREE.Vector3(0.03, 7.9, -0.02),
        new THREE.Vector3(0.0, 10.2, 0.0)
      ],
      0.31,
      0.042,
      9,
      12,
      { furrowAmp: 0.095, buttressFluting: 0.44, mossHeightRatio: 0.24, rootAoRatio: 0.18, uvScaleU: 2.8, uvScaleV: 0.55, seed: 2.3 }
    );
    parts.push(prepareForMerge(mainTrunk, undefined, true, true));
    mainTrunk.dispose();

    // 5 radial whorled conifer limb tiers + 2 lower dead bark snags
    const limbSpecs: Array<{ y: number; ang: number; len: number; arch: number; droop: number; r0: number }> = [
      // Lower weathered bark snags
      { y: 1.45, ang: 0.9, len: 0.52, arch: -0.04, droop: -0.18, r0: 0.052 },
      { y: 1.85, ang: 3.9, len: 0.58, arch: -0.04, droop: -0.20, r0: 0.055 },
      // Tier 1 (y ~ 2.55, 5 radial whorled limbs)
      { y: 2.50, ang: 0.00, len: 1.82, arch: 0.06, droop: -0.34, r0: 0.092 },
      { y: 2.58, ang: 1.26, len: 1.78, arch: 0.05, droop: -0.32, r0: 0.090 },
      { y: 2.54, ang: 2.51, len: 1.80, arch: 0.06, droop: -0.33, r0: 0.092 },
      { y: 2.62, ang: 3.77, len: 1.74, arch: 0.05, droop: -0.30, r0: 0.088 },
      { y: 2.56, ang: 5.03, len: 1.76, arch: 0.06, droop: -0.32, r0: 0.090 },
      // Tier 2 (y ~ 4.05, 5 offset whorled limbs)
      { y: 4.02, ang: 0.63, len: 1.50, arch: 0.07, droop: -0.22, r0: 0.080 },
      { y: 4.10, ang: 1.88, len: 1.46, arch: 0.06, droop: -0.20, r0: 0.078 },
      { y: 4.06, ang: 3.14, len: 1.48, arch: 0.07, droop: -0.22, r0: 0.080 },
      { y: 4.14, ang: 4.40, len: 1.42, arch: 0.06, droop: -0.19, r0: 0.076 },
      { y: 4.08, ang: 5.65, len: 1.44, arch: 0.07, droop: -0.20, r0: 0.078 },
      // Tier 3 (y ~ 5.55, 4 whorled limbs)
      { y: 5.52, ang: 0.30, len: 1.18, arch: 0.08, droop: -0.12, r0: 0.068 },
      { y: 5.60, ang: 1.87, len: 1.15, arch: 0.08, droop: -0.10, r0: 0.066 },
      { y: 5.56, ang: 3.44, len: 1.16, arch: 0.08, droop: -0.11, r0: 0.068 },
      { y: 5.64, ang: 5.01, len: 1.12, arch: 0.08, droop: -0.09, r0: 0.065 },
      // Tier 4 (y ~ 7.05, 4 upper limbs curving slightly up at tips)
      { y: 7.02, ang: 0.95, len: 0.84, arch: 0.09, droop: 0.04, r0: 0.056 },
      { y: 7.10, ang: 2.52, len: 0.82, arch: 0.09, droop: 0.05, r0: 0.055 },
      { y: 7.06, ang: 4.09, len: 0.83, arch: 0.09, droop: 0.04, r0: 0.055 },
      { y: 7.14, ang: 5.66, len: 0.80, arch: 0.09, droop: 0.06, r0: 0.054 },
      // Tier 5 (y ~ 8.40, 3 sub-apex limbs)
      { y: 8.38, ang: 0.50, len: 0.52, arch: 0.10, droop: 0.14, r0: 0.044 },
      { y: 8.44, ang: 2.60, len: 0.50, arch: 0.10, droop: 0.15, r0: 0.044 },
      { y: 8.42, ang: 4.70, len: 0.51, arch: 0.10, droop: 0.14, r0: 0.044 }
    ];

    limbSpecs.forEach((l, idx) => {
      const ca = Math.cos(l.ang);
      const sa = Math.sin(l.ang);
      const limb = createPineTubeGeometry(
        [
          new THREE.Vector3(0, l.y, 0),
          new THREE.Vector3(ca * l.len * 0.52, l.y + l.arch, sa * l.len * 0.52),
          new THREE.Vector3(ca * l.len, l.y + l.droop, sa * l.len)
        ],
        l.r0,
        0.018,
        5,
        4,
        { furrowAmp: 0.05, buttressFluting: 0, mossHeightRatio: 0.0, rootAoRatio: 0.0, uvScaleU: 1.6, uvScaleV: 0.72, seed: 5.1 + idx }
      );
      const limbPos = limb.attributes.position;
      const limbFlex = new Float32Array(limbPos.count);
      for (let v = 0; v < limbPos.count; v++) {
        const reach = Math.hypot(limbPos.getX(v), limbPos.getZ(v));
        limbFlex[v] = Math.min(1.0, reach / Math.max(0.1, l.len));
      }
      limb.setAttribute('aLimbFlex', new THREE.BufferAttribute(limbFlex, 1));
      parts.push(prepareForMerge(limb, undefined, true, true));
      limb.dispose();
    });

    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    return merged ?? new THREE.CylinderGeometry(0.08, 0.32, 10.2, 8);
  }

  /**
   * Builds a layered 3D arched & drooping conifer bough fan card geometry anchored at (0, 0, 0)
   * extending outward along +Z (uv.y = 0 at trunk collar -> uv.y = 1 at outer needle tips)
   * with cross-tilted needle fan layers for crisp 360° volumetric depth.
   */
  private createConiferBoughCardGeometry(cardWidth: number, cardLength: number): THREE.BufferGeometry {
    const hw = cardWidth * 0.5;

    const makeFanPlane = (rollZ: number, pitchX: number, yOffset: number) => {
      const p = new THREE.PlaneGeometry(cardWidth, cardLength, 2, 3);
      p.translate(0, cardLength * 0.5, 0);
      p.rotateX(Math.PI * 0.5);
      const pos = p.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const t = Math.max(0, Math.min(1, vz / cardLength));
        const xNorm = Math.abs(vx) / (hw + 0.001);
        // Curve gently upward near collar then droop gracefully toward outer needle tip
        const archDroop = Math.sin(t * Math.PI * 0.65) * (cardLength * 0.09) - t * t * (cardLength * 0.21);
        const cupLift = xNorm * xNorm * (cardLength * 0.05) * (0.4 + 0.6 * t);
        pos.setY(i, archDroop + cupLift);
      }
      if (rollZ !== 0) p.rotateZ(rollZ);
      if (pitchX !== 0) p.rotateX(pitchX);
      if (yOffset !== 0) p.translate(0, yOffset, 0);
      p.computeVertexNormals();
      return p;
    };

    const pMain = makeFanPlane(0.0, 0.0, 0.0);
    const pTiltA = makeFanPlane(0.40, -0.06, 0.02);
    const pTiltB = makeFanPlane(-0.40, -0.06, 0.02);

    const g1 = prepareForMerge(pMain);
    const g2 = prepareForMerge(pTiltA);
    const g3 = prepareForMerge(pTiltB);
    pMain.dispose();
    pTiltA.dispose();
    pTiltB.dispose();

    const merged = mergeGeometries([g1, g2, g3], false)!;
    g1.dispose();
    g2.dispose();
    g3.dispose();
    return merged;
  }

  private buildPineForest(
    renderer: THREE.WebGLRenderer | undefined,
    pineBark: PbrTextureSet,
    sunDir: THREE.Vector3,
    islandFloraTargets: Array<{ x: number; y: number; z: number }> = []
  ): Array<{ x: number; y: number; z: number }> {
    const treeCount = 680;
    const boughsPerTree = 22;

    const trunkGeo = this.createSculptedPineTrunkAndLimbsGeometry();
    const trunkMat = new THREE.MeshStandardMaterial({
      map: pineBark.map,
      normalMap: pineBark.normalMap,
      normalScale: new THREE.Vector2(1.95, 1.95),
      roughnessMap: pineBark.roughnessMap,
      roughness: 1.0,
      aoMap: pineBark.aoMap,
      aoMapIntensity: 0.94,
      vertexColors: true
    });
    this.pineTrunkWindUniforms = {
      uTime: { value: 0.0 },
      uWindSpeed: { value: this.currentConfig?.wind?.speed ?? 1.8 },
      uWindStrength: { value: this.currentConfig?.wind?.swayIntensity ?? 0.55 },
      uAudioBass: { value: 0.0 }
    };
    applyPineTrunkWindShader(trunkMat, this.pineTrunkWindUniforms, 'misty-pine-trunk-wind-v2');
    this.applyWorldMossAndDampness(trunkMat, {
      mossAmount: 0.54,
      dampYScale: 1.05,
      wetStreamFactor: 0.30,
      cacheKey: 'misty-pine-trunk-pbr-v4'
    });
    applyWorldSpaceWeathering(trunkMat, {
      macroScale: 0.24,
      mossHeight: 1.25,
      mossColor: '#2d5c22',
      dampRoughness: 0.52,
      dirtTint: '#352a1e'
    });

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunkMesh.name = 'InstancedPineTrunks';
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    const coniferAtlas = createConiferBoughAtlasTexture(renderer, 512);
    this.extraTextures.push(coniferAtlas);

    this.coniferBoughHandle = createConiferBoughMaterial(coniferAtlas, {
      windSpeed: this.currentConfig?.wind?.speed ?? 1.8,
      windStrength: this.currentConfig?.wind?.swayIntensity ?? 0.55,
      sunDirection: sunDir
    });
    this.coniferBoughHandle.material.alphaTest = 0.42;
    this.coniferBoughHandle.depthMaterial.alphaTest = 0.42;
    this.extraMaterials.push(this.coniferBoughHandle.depthMaterial);

    const boughGeo = this.createConiferBoughCardGeometry(1.58, 1.88);
    const boughMesh = new THREE.InstancedMesh(
      boughGeo,
      this.coniferBoughHandle.material,
      treeCount * boughsPerTree
    );
    boughMesh.name = 'InstancedPineCanopy';
    boughMesh.castShadow = true;
    boughMesh.receiveShadow = true;
    boughMesh.customDepthMaterial = this.coniferBoughHandle.depthMaterial;

    // 5 radial whorled bough tiers + spire crown with crisp vertical sky gaps between tiers
    const boughAnchors: Array<{
      y: number;
      rOff: number;
      angOff: number;
      scaleW: number;
      scaleL: number;
      pitch: number;
      tier: number;
      reachNorm: number;
      light: number;
    }> = [
      // Tier 1 (lower sweeping skirt: 5 radial whorled boughs)
      { y: 2.52, rOff: 0.14, angOff: 0.00, scaleW: 1.32, scaleL: 1.36, pitch: 0.18, tier: 1, reachNorm: 1.00, light: 0.26 },
      { y: 2.60, rOff: 0.14, angOff: 1.26, scaleW: 1.28, scaleL: 1.32, pitch: 0.16, tier: 1, reachNorm: 0.96, light: 0.28 },
      { y: 2.56, rOff: 0.14, angOff: 2.51, scaleW: 1.30, scaleL: 1.34, pitch: 0.17, tier: 1, reachNorm: 0.98, light: 0.24 },
      { y: 2.64, rOff: 0.14, angOff: 3.77, scaleW: 1.26, scaleL: 1.30, pitch: 0.15, tier: 1, reachNorm: 0.94, light: 0.30 },
      { y: 2.58, rOff: 0.14, angOff: 5.03, scaleW: 1.28, scaleL: 1.32, pitch: 0.16, tier: 1, reachNorm: 0.96, light: 0.27 },
      // Tier 2 (lower-mid whorl: 5 staggered boughs)
      { y: 4.04, rOff: 0.12, angOff: 0.63, scaleW: 1.14, scaleL: 1.16, pitch: 0.11, tier: 2, reachNorm: 0.84, light: 0.45 },
      { y: 4.12, rOff: 0.12, angOff: 1.88, scaleW: 1.10, scaleL: 1.12, pitch: 0.10, tier: 2, reachNorm: 0.80, light: 0.48 },
      { y: 4.08, rOff: 0.12, angOff: 3.14, scaleW: 1.12, scaleL: 1.14, pitch: 0.11, tier: 2, reachNorm: 0.82, light: 0.44 },
      { y: 4.16, rOff: 0.12, angOff: 4.40, scaleW: 1.08, scaleL: 1.10, pitch: 0.09, tier: 2, reachNorm: 0.78, light: 0.50 },
      { y: 4.10, rOff: 0.12, angOff: 5.65, scaleW: 1.10, scaleL: 1.12, pitch: 0.10, tier: 2, reachNorm: 0.80, light: 0.47 },
      // Tier 3 (mid-crown whorl: 4 boughs)
      { y: 5.54, rOff: 0.10, angOff: 0.30, scaleW: 0.94, scaleL: 0.96, pitch: 0.04, tier: 3, reachNorm: 0.66, light: 0.64 },
      { y: 5.62, rOff: 0.10, angOff: 1.87, scaleW: 0.90, scaleL: 0.92, pitch: 0.03, tier: 3, reachNorm: 0.64, light: 0.67 },
      { y: 5.58, rOff: 0.10, angOff: 3.44, scaleW: 0.92, scaleL: 0.94, pitch: 0.04, tier: 3, reachNorm: 0.65, light: 0.62 },
      { y: 5.66, rOff: 0.10, angOff: 5.01, scaleW: 0.88, scaleL: 0.90, pitch: 0.02, tier: 3, reachNorm: 0.62, light: 0.69 },
      // Tier 4 (upper-crown whorl: 4 ascending boughs)
      { y: 7.04, rOff: 0.08, angOff: 0.95, scaleW: 0.72, scaleL: 0.74, pitch: -0.06, tier: 4, reachNorm: 0.48, light: 0.80 },
      { y: 7.12, rOff: 0.08, angOff: 2.52, scaleW: 0.70, scaleL: 0.72, pitch: -0.07, tier: 4, reachNorm: 0.46, light: 0.83 },
      { y: 7.08, rOff: 0.08, angOff: 4.09, scaleW: 0.71, scaleL: 0.73, pitch: -0.06, tier: 4, reachNorm: 0.47, light: 0.79 },
      { y: 7.16, rOff: 0.08, angOff: 5.66, scaleW: 0.68, scaleL: 0.70, pitch: -0.08, tier: 4, reachNorm: 0.44, light: 0.85 },
      // Tier 5 (sub-apex whorl: 3 ascending boughs + 1 spire leader)
      { y: 8.40, rOff: 0.05, angOff: 0.50, scaleW: 0.52, scaleL: 0.54, pitch: -0.18, tier: 5, reachNorm: 0.32, light: 0.92 },
      { y: 8.46, rOff: 0.05, angOff: 2.60, scaleW: 0.50, scaleL: 0.52, pitch: -0.20, tier: 5, reachNorm: 0.30, light: 0.94 },
      { y: 8.44, rOff: 0.05, angOff: 4.70, scaleW: 0.51, scaleL: 0.53, pitch: -0.19, tier: 5, reachNorm: 0.31, light: 0.93 },
      { y: 9.35, rOff: 0.01, angOff: 1.55, scaleW: 0.42, scaleL: 0.58, pitch: -0.78, tier: 6, reachNorm: 0.22, light: 1.00 }
    ];

    const trunkTreeData = new Float32Array(treeCount * 4);
    const boughTreeData = new Float32Array(treeCount * boughsPerTree * 4);
    const boughMetaData = new Float32Array(treeCount * boughsPerTree * 4);

    const treeMat = new THREE.Matrix4();
    const boughLocalMat = new THREE.Matrix4();
    const combinedMat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const treeEuler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const bPos = new THREE.Vector3();
    const bQuat = new THREE.Quaternion();
    const bEuler = new THREE.Euler();
    const bScale = new THREE.Vector3();

    const col = new THREE.Color();
    const deepShadowPine = new THREE.Color('#284c2c');
    const midSpruceCol = new THREE.Color('#447438');
    const sunlitPineTip = new THREE.Color('#86b446');
    const goldenAngle = 2.399963229728653;
    const treeRoots: Array<{ x: number; y: number; z: number }> = [];

    let placed = 0;
    let boughIdx = 0;

    const placeSinglePine = (
      x: number,
      z: number,
      seedIdx: number,
      hScale: number,
      wScale: number,
      leanAmp = 0.085
    ) => {
      const y = getMistyForestHeight(x, z);
      const treeYaw = (seedIdx * 1.618) % (Math.PI * 2);
      const leanX = (pseudoRand(seedIdx * 2.13) - 0.5) * leanAmp;
      const leanZ = (pseudoRand(seedIdx * 4.71) - 0.5) * leanAmp;
      const treePhase = x * 0.14 + z * 0.11 + pseudoRand(seedIdx * 1.9) * 3.1;

      pos.set(x, y - 0.14, z);
      treeEuler.set(leanX, treeYaw, leanZ, 'YXZ');
      quat.setFromEuler(treeEuler);
      scale.set(wScale, hScale, wScale);
      treeMat.compose(pos, quat, scale);
      trunkMesh.setMatrixAt(placed, treeMat);

      trunkTreeData[placed * 4] = x;
      trunkTreeData[placed * 4 + 1] = z;
      trunkTreeData[placed * 4 + 2] = hScale;
      trunkTreeData[placed * 4 + 3] = treePhase;

      const speciesShift = pseudoRand(seedIdx * 7.9);
      const treeToneMul = 0.88 + pseudoRand(seedIdx * 11.3) * 0.26;

      for (let b = 0; b < boughsPerTree; b++) {
        const anchor = boughAnchors[b];
        const jA = (pseudoRand(seedIdx * 17.3 + b * 3.7) - 0.5) * 0.34;
        const jY = (pseudoRand(seedIdx * 29.7 + b * 7.3) - 0.5) * 0.22;
        const ang = anchor.angOff + jA;

        bPos.set(Math.cos(ang) * anchor.rOff, anchor.y + jY, Math.sin(ang) * anchor.rOff);
        bEuler.set(
          anchor.pitch + (pseudoRand(seedIdx * 19.1 + b) - 0.5) * 0.10,
          Math.PI * 0.5 - ang,
          (pseudoRand(seedIdx * 13.7 + b) - 0.5) * 0.24,
          'YXZ'
        );
        bQuat.setFromEuler(bEuler);
        const sRand = 0.88 + pseudoRand(seedIdx * 31.3 + b) * 0.26;
        bScale.set(anchor.scaleW * sRand, anchor.scaleW * sRand, anchor.scaleL * sRand);
        boughLocalMat.compose(bPos, bQuat, bScale);
        combinedMat.multiplyMatrices(treeMat, boughLocalMat);

        boughMesh.setMatrixAt(boughIdx, combinedMat);

        boughTreeData[boughIdx * 4] = x;
        boughTreeData[boughIdx * 4 + 1] = z;
        boughTreeData[boughIdx * 4 + 2] = hScale;
        boughTreeData[boughIdx * 4 + 3] = treePhase;

        boughMetaData[boughIdx * 4] = Math.min(1.0, (anchor.y + jY) / 10.5);
        boughMetaData[boughIdx * 4 + 1] = anchor.reachNorm;
        boughMetaData[boughIdx * 4 + 2] = anchor.tier;
        boughMetaData[boughIdx * 4 + 3] = treePhase + ang * 0.8 + b * 0.43;

        const lightT = Math.max(0, Math.min(1, anchor.light + (pseudoRand(seedIdx * 37.9 + b) - 0.5) * 0.14));
        if (lightT < 0.5) {
          col.copy(deepShadowPine).lerp(midSpruceCol, lightT / 0.5);
        } else {
          col.copy(midSpruceCol).lerp(sunlitPineTip, (lightT - 0.5) / 0.5);
        }
        col.multiplyScalar(treeToneMul);
        if (speciesShift > 0.65) {
          col.offsetHSL(-0.025, 0.05, 0.02);
        } else if (speciesShift < 0.3) {
          col.offsetHSL(0.030, -0.04, -0.02);
        }
        boughMesh.setColorAt(boughIdx, col);
        boughIdx++;
      }

      treeRoots.push({ x, y, z });
      placed++;
    };

    // Place 2 gnarled wind-bent pines atop the Rocky Island
    islandFloraTargets.forEach((islPt, idx) => {
      if (placed < treeCount) {
        placeSinglePine(islPt.x, islPt.z, 900 + idx * 17, 0.72 + idx * 0.14, 0.82, 0.14);
      }
    });

    for (let i = 0; placed < treeCount && i < treeCount * 3; i++) {
      const rRatio = Math.pow((i + 14) / (treeCount * 2.1), 0.60);
      const r = 10.2 + rRatio * 134.0;
      const theta = i * goldenAngle + (pseudoRand(i * 1.3) - 0.5) * 0.16;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);

      // Keep stream channel, spawn clearing, stepping-stone trail, bridges, waterfall, shrine, watchtower & fern glades clear
      const streamCenterX = getStreamCenterX(z);
      if (Math.abs(x - streamCenterX) < 6.0) continue;
      if (Math.hypot(x + 4, z - 14) < 6.8) continue;
      if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 3.4) continue;
      if (z > -10.5 && z < -1.5 && x > -11.0 && x < 5.0) continue;
      if (z > 49.0 && z < 59.0 && Math.abs(x - getStreamCenterX(54.0)) < 11.5) continue;
      if (Math.hypot(x - getStreamCenterX(-137.5), z + 136.0) < 16.0) continue;
      if (Math.hypot(x + 26.0, z + 12.0) < 10.5) continue;
      if (Math.hypot(x - 28.0, z + 18.0) < 10.5) continue;
      if (Math.hypot(x + 46.0, z - 52.0) < 9.5) continue;
      if (Math.hypot(x - 44.0, z - 48.0) < 9.5) continue;
      if (Math.hypot(x + 42.0, z + 56.0) < 9.0) continue;
      const distToSeg = (ax: number, az: number, bx: number, bz: number): number => {
        const vx = bx - ax;
        const vz = bz - az;
        const lenSq = vx * vx + vz * vz;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / lenSq)) : 0;
        return Math.hypot(x - (ax + t * vx), z - (az + t * vz));
      };
      if (distToSeg(-11.0, -3.0, -26.0, -12.0) < 5.0) continue;
      if (distToSeg(11.0, -8.0, 28.0, -18.0) < 5.0) continue;

      const hScale = 0.80 + pseudoRand(i * 3.1) * 1.10;
      const wScale = 0.86 + pseudoRand(i * 5.7) * 0.42;
      placeSinglePine(x, z, i, hScale, wScale, 0.085);
    }

    trunkGeo.setAttribute('aTreeData', new THREE.InstancedBufferAttribute(trunkTreeData, 4));
    boughGeo.setAttribute('aTreeData', new THREE.InstancedBufferAttribute(boughTreeData, 4));
    boughGeo.setAttribute('aBoughData', new THREE.InstancedBufferAttribute(boughMetaData, 4));

    trunkMesh.count = placed;
    boughMesh.count = boughIdx;
    trunkMesh.instanceMatrix.needsUpdate = true;
    boughMesh.instanceMatrix.needsUpdate = true;
    if (boughMesh.instanceColor) boughMesh.instanceColor.needsUpdate = true;

    this.scene.add(trunkMesh);
    this.scene.add(boughMesh);
    return treeRoots;
  }

  private createSculptedFernGeometry(): THREE.BufferGeometry {
    const frondCount = 8;
    const segs = 5;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount) * Math.PI * 2 + (pseudoRand(f * 3.1) - 0.5) * 0.42;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const perpX = -sinA;
      const perpZ = cosA;

      // Vary inner upright shoots vs outer gracefully arching fronds
      const isInnerFrond = f % 3 === 0;
      const frondLen = (isInnerFrond ? 0.58 : 0.78) + pseudoRand(f * 7.7) * 0.34;
      const archHeight = (isInnerFrond ? 0.52 : 0.34) + pseudoRand(f * 5.3) * 0.18;
      const droopFactor = isInnerFrond ? 0.08 : 0.24;
      const maxWidth = 0.29 + pseudoRand(f * 2.9) * 0.06;
      const baseVertex = positions.length / 3;

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const reach = t * frondLen;
        const archY = Math.sin(t * Math.PI * 0.74) * archHeight + t * 0.09 - t * t * droopFactor;
        const cx = cosA * reach;
        const cz = sinA * reach;
        const halfW = maxWidth;

        positions.push(
          cx - perpX * halfW, archY + 0.03, cz - perpZ * halfW,
          cx, archY, cz,
          cx + perpX * halfW, archY + 0.03, cz + perpZ * halfW
        );
        normals.push(
          -perpX * 0.25, 0.96, -perpZ * 0.25,
          0, 1, 0,
          perpX * 0.25, 0.96, perpZ * 0.25
        );
        uvs.push(
          0.0, t,
          0.5, t,
          1.0, t
        );
      }

      for (let s = 0; s < segs; s++) {
        const r0 = baseVertex + s * 3;
        const r1 = baseVertex + (s + 1) * 3;
        indices.push(r0, r0 + 1, r1 + 1, r0, r1 + 1, r1);
        indices.push(r0 + 1, r0 + 2, r1 + 2, r0 + 1, r1 + 2, r1 + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Builds sculpted fallen mossy nurse logs with exposed broken roots & branch stubs
   * resting naturally along stream banks & forest clearings.
   */
  private buildFallenNurseLogs(oakBark: PbrTextureSet): Array<{ x: number; y: number; z: number }> {
    const logSpecs = [
      { x: -6.8, z: 4.5, len: 5.4, r0: 0.38, r1: 0.22, yaw: 0.48 },
      { x: -11.8, z: -14.5, len: 6.2, r0: 0.42, r1: 0.24, yaw: 1.92 },
      { x: 6.2, z: -12.8, len: 5.0, r0: 0.34, r1: 0.20, yaw: -0.75 },
      { x: 7.4, z: -26.5, len: 6.6, r0: 0.44, r1: 0.25, yaw: 2.45 },
      { x: -13.2, z: 18.2, len: 5.6, r0: 0.39, r1: 0.21, yaw: 0.92 },
      // Outer glade mossy nurse logs across the doubled territory
      { x: -42.0, z: 48.0, len: 6.4, r0: 0.43, r1: 0.24, yaw: 0.64 },
      { x: 40.5, z: 44.0, len: 5.8, r0: 0.40, r1: 0.22, yaw: 2.18 },
      { x: -38.5, z: -52.0, len: 6.2, r0: 0.41, r1: 0.23, yaw: -0.88 },
      { x: 38.0, z: -58.0, len: 5.6, r0: 0.38, r1: 0.21, yaw: 1.45 },
      { x: -14.0, z: 68.0, len: 6.0, r0: 0.42, r1: 0.23, yaw: 0.32 }
    ];

    const logParts: THREE.BufferGeometry[] = [];
    const logAnchors: Array<{ x: number; y: number; z: number }> = [];

    logSpecs.forEach((spec, idx) => {
      const cosY = Math.cos(spec.yaw);
      const sinY = Math.sin(spec.yaw);
      const halfL = spec.len * 0.5;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 4; s++) {
        const t = s / 4;
        const along = (t - 0.5) * spec.len;
        const wx = spec.x + cosY * along;
        const wz = spec.z + sinY * along;
        const wy = getMistyForestHeight(wx, wz) + spec.r0 * (0.52 - t * 0.14);
        pts.push(new THREE.Vector3(wx, wy, wz));
      }

      const logTube = createPineTubeGeometry(pts, spec.r0, spec.r1, 10, 10, {
        furrowAmp: 0.10,
        buttressFluting: 0.35,
        mossHeightRatio: 0.65,
        rootAoRatio: 0.15,
        uvScaleU: 3.0,
        uvScaleV: 0.65,
        seed: 12.4 + idx * 2.1
      });
      logParts.push(prepareForMerge(logTube, undefined, true));
      logTube.dispose();

      // Broken stubby branch & upturned root flare
      const midPt = pts[2];
      const stubYaw = spec.yaw + (idx % 2 === 0 ? 0.85 : -0.85);
      const stubTube = createPineTubeGeometry(
        [
          midPt.clone(),
          new THREE.Vector3(midPt.x + Math.cos(stubYaw) * 0.65, midPt.y + 0.58, midPt.z + Math.sin(stubYaw) * 0.65)
        ],
        0.13,
        0.05,
        6,
        3,
        { furrowAmp: 0.06, mossHeightRatio: 0.3, rootAoRatio: 0.0, uvScaleU: 1.6, uvScaleV: 0.8, seed: 18.2 + idx }
      );
      logParts.push(prepareForMerge(stubTube, undefined, true));
      stubTube.dispose();

      const rootPt = pts[0];
      for (let r = 0; r < 2; r++) {
        const rAng = spec.yaw + Math.PI + (r === 0 ? 0.55 : -0.55);
        const rootGeo = createPineTubeGeometry(
          [
            rootPt.clone(),
            new THREE.Vector3(rootPt.x + Math.cos(rAng) * 0.72, rootPt.y + 0.25 - r * 0.12, rootPt.z + Math.sin(rAng) * 0.72)
          ],
          0.16,
          0.04,
          6,
          3,
          { furrowAmp: 0.08, mossHeightRatio: 0.5, rootAoRatio: 0.0, uvScaleU: 1.8, uvScaleV: 0.8, seed: 22.1 + idx + r }
        );
        logParts.push(prepareForMerge(rootGeo, undefined, true));
        rootGeo.dispose();
      }

      logAnchors.push({ x: spec.x, y: getMistyForestHeight(spec.x, spec.z), z: spec.z });
      logAnchors.push({ x: spec.x + cosY * halfL * 0.6, y: getMistyForestHeight(spec.x, spec.z), z: spec.z + sinY * halfL * 0.6 });
    });

    const mergedLogs = mergeGeometries(logParts, false)!;
    logParts.forEach((g) => g.dispose());

    const logMat = new THREE.MeshStandardMaterial({
      map: oakBark.map,
      normalMap: oakBark.normalMap,
      normalScale: new THREE.Vector2(1.85, 1.85),
      roughnessMap: oakBark.roughnessMap,
      roughness: 1.0,
      aoMap: oakBark.aoMap,
      aoMapIntensity: 0.92,
      vertexColors: true
    });
    this.applyWorldMossAndDampness(logMat, {
      mossAmount: 0.86,
      dampYScale: 1.35,
      wetStreamFactor: 0.60,
      cacheKey: 'misty-nurse-logs-pbr-v1'
    });
    applyWorldSpaceWeathering(logMat, {
      macroScale: 0.35,
      mossHeight: 0.85,
      mossColor: '#2f6422',
      dampRoughness: 0.32,
      dirtTint: '#362a1d'
    });

    const logMesh = new THREE.Mesh(mergedLogs, logMat);
    logMesh.name = 'FallenMossyNurseLogs';
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    this.scene.add(logMesh);

    return logAnchors;
  }

  private buildForestFerns(
    renderer: THREE.WebGLRenderer | undefined,
    treeRoots: Array<{ x: number; y: number; z: number }>,
    nurseLogs: Array<{ x: number; y: number; z: number }>,
    sunDir: THREE.Vector3,
    islandFloraTargets: Array<{ x: number; y: number; z: number }> = []
  ): void {
    const count = 6400;
    const fernGeo = this.createSculptedFernGeometry();
    const fernAtlas = createFernFrondAtlasTexture(renderer, 512);
    this.extraTextures.push(fernAtlas);

    this.fernHandle = createFernMaterial({
      windSpeed: this.currentConfig?.wind?.speed ?? 1.8,
      windStrength: this.currentConfig?.wind?.swayIntensity ?? 0.55,
      sunDirection: sunDir,
      fernAtlas
    });

    const fernMesh = new THREE.InstancedMesh(fernGeo, this.fernHandle.material, count);
    fernMesh.name = 'InstancedForestFerns';
    fernMesh.receiveShadow = true;

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const fEuler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();

    let placed = 0;

    const placeFern = (x: number, z: number, seedIdx: number, sMin = 0.66, sRange = 0.78) => {
      const y = getMistyForestHeight(x, z);
      pos.set(x, y - 0.03, z);
      fEuler.set(
        (pseudoRand(seedIdx * 1.97) - 0.5) * 0.22,
        pseudoRand(seedIdx * 2.71) * Math.PI * 2,
        (pseudoRand(seedIdx * 3.43) - 0.5) * 0.22
      );
      quat.setFromEuler(fEuler);
      const s = sMin + pseudoRand(seedIdx * 6.13) * sRange;
      scale.set(
        s * (0.85 + pseudoRand(seedIdx * 4.9) * 0.34),
        s * (0.76 + pseudoRand(seedIdx * 8.4) * 0.56),
        s * (0.85 + pseudoRand(seedIdx * 7.1) * 0.34)
      );
      dummy.compose(pos, quat, scale);
      fernMesh.setMatrixAt(placed, dummy);

      const shade = 0.72 + pseudoRand(seedIdx * 9.7) * 0.48;
      const goldTip = pseudoRand(seedIdx * 11.3);
      col.setRGB(
        shade * (0.86 + goldTip * 0.26),
        shade * (1.02 + goldTip * 0.14),
        shade * (0.72 - goldTip * 0.14)
      );
      fernMesh.setColorAt(placed, col);
      placed++;
    };

    // 0. Lush ferns nestled on the Rocky Island & around the Forest Shrine steps
    const isl = getRiverIslandCenter();
    for (let i = 0; i < 24 && placed < count && islandFloraTargets.length > 0; i++) {
      const ang = (i / 24) * Math.PI * 2 + pseudoRand(i * 3.1) * 0.4;
      const rad = 0.55 + pseudoRand(i * 5.7) * 1.25;
      placeFern(isl.x + Math.cos(ang) * rad * 0.85, isl.z + Math.sin(ang) * rad * 1.75, 5000 + i, 0.55, 0.55);
    }

    // 1. ~1,850 lush ferns nestled along the extended mossy stream banks (z = -132..+154)
    const bankTarget = 1850;
    for (let i = 0; placed < bankTarget && i < bankTarget * 4; i++) {
      const z = -132.0 + pseudoRand(i * 1.91) * 286.0;
      const side = i % 2 === 0 ? -1 : 1;
      const offset = 3.85 + Math.pow(pseudoRand(i * 4.37), 0.75) * 6.2;
      const x = getStreamCenterX(z) + side * offset;

      if (z > -8.5 && z < -3.5 && Math.abs(x - getStreamCenterX(-6)) < 6.0) continue;
      if (z > 50.0 && z < 58.0 && Math.abs(x - getStreamCenterX(54.0)) < 7.8) continue;
      if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 1.35) continue;
      if (this.isExcludedFromShrine(x, z)) continue;
      if (Math.hypot(x - 28.0, z + 18.0) < 4.8) continue;

      placeFern(x, z, i);
    }

    // 2. ~700 lush ferns clustered right around the fallen mossy nurse logs
    const nurseTarget = bankTarget + 700;
    for (let i = 0; placed < nurseTarget && i < 2400 && nurseLogs.length > 0; i++) {
      const nl = nurseLogs[i % nurseLogs.length];
      const ang = pseudoRand(i * 4.13 + 7.0) * Math.PI * 2;
      const dist = 0.65 + pseudoRand(i * 6.89) * 1.85;
      const x = nl.x + Math.cos(ang) * dist;
      const z = nl.z + Math.sin(ang) * dist;

      if (Math.abs(x - getStreamCenterX(z)) < 3.6) continue;
      if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 1.35) continue;
      if (this.isExcludedFromShrine(x, z)) continue;

      placeFern(x, z, 2000 + i, 0.72, 0.72);
    }

    // 2b. ~900 lush ferns carpeting the 3 sunlit outer fern glades
    const gladeCenters = [
      { x: -46.0, z: 52.0, r: 9.0 },
      { x: 44.0, z: 48.0, r: 9.0 },
      { x: -42.0, z: -56.0, r: 8.5 }
    ];
    const gladeTarget = nurseTarget + 900;
    for (let i = 0; placed < gladeTarget && i < 2200; i++) {
      const gc = gladeCenters[i % gladeCenters.length];
      const ang = pseudoRand(i * 5.11 + 3.0) * Math.PI * 2;
      const dist = Math.sqrt(pseudoRand(i * 7.73)) * gc.r;
      const x = gc.x + Math.cos(ang) * dist;
      const z = gc.z + Math.sin(ang) * dist;
      if (this.isExcludedFromShrine(x, z)) continue;
      placeFern(x, z, 6500 + i, 0.74, 0.85);
    }

    // 3. Remaining ferns clustered around pine tree roots & shaded forest hollows across the doubled valley
    for (let i = 0; placed < count && i < count * 3; i++) {
      let x = 0;
      let z = 0;
      if (treeRoots.length > 0 && i < count * 2) {
        const root = treeRoots[i % treeRoots.length];
        const ang = pseudoRand(i * 3.19 + 11.0) * Math.PI * 2;
        const dist = 0.95 + pseudoRand(i * 5.41) * 2.6;
        x = root.x + Math.cos(ang) * dist;
        z = root.z + Math.sin(ang) * dist;
      } else {
        const r = 8.0 + pseudoRand(i * 2.13) * 124.0;
        const ang = i * 2.39996;
        x = Math.cos(ang) * r;
        z = Math.sin(ang) * r;
      }

      if (Math.abs(x - getStreamCenterX(z)) < 3.8) continue;
      if (z > -8.5 && z < -3.5 && Math.abs(x - getStreamCenterX(-6)) < 6.0) continue;
      if (z > 50.0 && z < 58.0 && Math.abs(x - getStreamCenterX(54.0)) < 7.8) continue;
      if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 1.35) continue;
      if (this.isExcludedFromShrine(x, z)) continue;
      if (Math.hypot(x - 28.0, z + 18.0) < 4.8) continue;

      placeFern(x, z, 4000 + i, 0.64, 0.78);
    }

    fernMesh.count = placed;
    fernMesh.instanceMatrix.needsUpdate = true;
    if (fernMesh.instanceColor) fernMesh.instanceColor.needsUpdate = true;
    this.scene.add(fernMesh);
  }

  /**
   * Checks whether a world (x, z) point falls inside the Stone Forest Shrine platform or its 7-step staircase
   * (rotated by 1.15 rad around (-26, -12)) so grass blades and ferns never poke through stonework.
   */
  private isExcludedFromShrine(x: number, z: number): boolean {
    const dx = x + 26.0;
    const dz = z + 12.0;
    // rotation.y = +1.15 maps local (lx, lz) -> (lx*cos + lz*sin, -lx*sin + lz*cos),
    // so the inverse world -> local rotation uses +1.15 with (dx*cos - dz*sin, dx*sin + dz*cos).
    const cosR = Math.cos(1.15);
    const sinR = Math.sin(1.15);
    const lx = dx * cosR - dz * sinR;
    const lz = dx * sinR + dz * cosR;
    if (Math.abs(lx) < 4.15 && lz > -4.65 && lz < 3.05) return true;
    if (Math.abs(lx) < 2.55 && lz >= 2.30 && lz < 8.10) return true;
    return false;
  }

  private buildForestGrass(sunDir: THREE.Vector3): void {
    // 44,000 varied 6-blade radiating curved grass tufts across the doubled 124m misty valley
    const count = 44000;
    const tPos: number[] = [];
    const tNorm: number[] = [];
    const tUv: number[] = [];
    const tIdx: number[] = [];

    const bladesPerTuft = 6;
    for (let b = 0; b < bladesPerTuft; b++) {
      const ang = (b / bladesPerTuft) * Math.PI * 2 + (pseudoRand(b * 3.17) - 0.5) * 0.45;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const radOff = 0.02 + (b % 3) * 0.018;
      const bx = ca * radOff;
      const bz = sa * radOff;
      const px = -sa;
      const pz = ca;
      const h = 0.34 + pseudoRand(b * 7.31) * 0.46;
      const w0 = 0.028 + (b % 2) * 0.008;
      const w1 = w0 * 0.52;
      const midLean = 0.05 + pseudoRand(b * 5.13) * 0.07;
      const tipLean = midLean * (2.1 + pseudoRand(b * 9.7) * 1.1);
      const baseV = tPos.length / 3;

      tPos.push(
        bx - px * w0, 0.0, bz - pz * w0,
        bx + px * w0, 0.0, bz + pz * w0,
        bx + ca * midLean - px * w1, 0.52 * h, bz + sa * midLean - pz * w1,
        bx + ca * midLean + px * w1, 0.52 * h, bz + sa * midLean + pz * w1,
        bx + ca * tipLean, h, bz + sa * tipLean
      );
      tNorm.push(
        ca * 0.25, 0.94, sa * 0.25,
        ca * 0.25, 0.94, sa * 0.25,
        ca * 0.42, 0.86, sa * 0.42,
        ca * 0.42, 0.86, sa * 0.42,
        ca * 0.62, 0.76, sa * 0.62
      );
      tUv.push(0.0, 0.0, 1.0, 0.0, 0.1, 0.52, 0.9, 0.52, 0.5, 1.0);
      tIdx.push(
        baseV + 0, baseV + 1, baseV + 3,
        baseV + 0, baseV + 3, baseV + 2,
        baseV + 2, baseV + 3, baseV + 4
      );
    }

    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    bladeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(tNorm, 3));
    bladeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
    bladeGeo.setIndex(tIdx);

    this.grassMaterial = createGrassSwayMaterial({
      windSpeed: this.currentConfig?.wind?.speed ?? 1.8,
      windDirection: [0.8, 0.5],
      windStrength: this.currentConfig?.wind?.swayIntensity ?? 0.55,
      gustiness: 0.45,
      baseColor: '#1f4418',
      tipColor: '#8ebc42',
      sunDirection: sunDir
    });

    const grassMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, count);
    grassMesh.name = 'InstancedForestGrass';

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const goldenAngle = 2.399963229728653;

    let placed = 0;
    for (let i = 0; placed < count && i < count * 2; i++) {
      const j1 = pseudoRand(i * 1.13 + 0.5);
      const j2 = pseudoRand(i * 2.79 + 3.1);
      const j3 = pseudoRand(i * 4.41 + 7.7);

      // 55% concentrated densely inside r <= 42m (clearing, stream banks & glade) + 45% across doubled outer forest (r = 32..130m)
      const isInner = placed < count * 0.55;
      const r = isInner
        ? 1.5 + Math.sqrt(pseudoRand(i * 6.17 + 1.9)) * 40.5
        : 32.0 + Math.sqrt(pseudoRand(i * 6.17 + 1.9)) * 98.0;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.52;
      const x = (isInner ? -2.0 : 0.0) + r * Math.cos(theta) + (j1 - 0.5) * 0.85;
      const z = (isInner ? 6.0 : 0.0) + r * Math.sin(theta) + (j3 - 0.5) * 0.85;

      const streamCenterX = getStreamCenterX(z);
      if (Math.abs(x - streamCenterX) < 3.8) continue;
      if (z > -8.8 && z < -3.2 && Math.abs(x - getStreamCenterX(-6)) < 9.2) continue;
      if (z > 49.5 && z < 58.5 && Math.abs(x - getStreamCenterX(54.0)) < 10.5) continue;
      if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 1.2) continue;
      if (this.isExcludedFromShrine(x, z)) continue;
      if (Math.hypot(x - 28.0, z + 18.0) < 5.2) continue;

      const y = getMistyForestHeight(x, z);
      pos.set(x, y, z);
      euler.set((j2 - 0.5) * 0.16, j1 * Math.PI * 2, (j3 - 0.5) * 0.16);
      quat.setFromEuler(euler);
      const sy = 0.56 + j2 * 0.92;
      scale.set(0.80 + j3 * 0.42, sy, 0.80 + j1 * 0.42);
      dummy.compose(pos, quat, scale);
      grassMesh.setMatrixAt(placed, dummy);

      // Vary from deep shaded emerald to warm sunlit golden-green tips
      col.setHSL(0.24 + (j1 - 0.5) * 0.075, 0.38 + j2 * 0.20, 0.64 + j3 * 0.26);
      grassMesh.setColorAt(placed, col);
      placed++;
    }

    grassMesh.count = placed;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    this.scene.add(grassMesh);
  }

  /**
   * Builds 2,600 sculpted multi-petal wild forest blossoms (woodland anemones, golden buttercups,
   * alpine harebells & blush clover) varied in height, stem curvature, and golden-hour colors.
   */
  private buildForestBlossoms(
    sunDir: THREE.Vector3,
    treeRoots: Array<{ x: number; y: number; z: number }>,
    nurseLogs: Array<{ x: number; y: number; z: number }>
  ): void {
    const count = 2600;
    const pos: number[] = [];
    const norm: number[] = [];
    const cols: number[] = [];
    const petalMask: number[] = [];
    const indices: number[] = [];

    // Curved slender green stem (3 segments)
    const stemCurve = [
      { x: 0.0, y: 0.0, z: 0.0, r: 0.011 },
      { x: 0.018, y: 0.14, z: 0.012, r: 0.008 },
      { x: 0.048, y: 0.29, z: 0.025, r: 0.006 },
      { x: 0.075, y: 0.39, z: 0.036, r: 0.005 }
    ];
    const stemSides = 4;
    for (let s = 0; s < stemCurve.length; s++) {
      const pt = stemCurve[s];
      for (let j = 0; j < stemSides; j++) {
        const ang = (j / stemSides) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        pos.push(pt.x + ca * pt.r, pt.y, pt.z + sa * pt.r);
        norm.push(ca, 0.25, sa);
        const shade = 0.65 + (s / 3) * 0.35;
        cols.push(0.18 * shade, 0.44 * shade, 0.14 * shade);
        petalMask.push(0.0);
      }
    }
    for (let s = 0; s < stemCurve.length - 1; s++) {
      const r0 = s * stemSides;
      const r1 = (s + 1) * stemSides;
      for (let j = 0; j < stemSides; j++) {
        const jn = (j + 1) % stemSides;
        indices.push(r0 + j, r0 + jn, r1 + jn, r0 + j, r1 + jn, r1 + j);
      }
    }

    // Blossom head at stem tip (0.075, 0.39, 0.036)
    const headX = 0.075;
    const headY = 0.39;
    const headZ = 0.036;
    const centerIdx = pos.length / 3;
    pos.push(headX, headY + 0.012, headZ);
    norm.push(0, 1, 0);
    cols.push(0.95, 0.78, 0.16);
    petalMask.push(0.2);

    const petals = 5;
    for (let p = 0; p < petals; p++) {
      const a0 = (p / petals) * Math.PI * 2;
      const aL = a0 - 0.32;
      const aR = a0 + 0.32;
      const pLen = 0.078;
      const pLift = 0.022;
      const baseV = pos.length / 3;

      pos.push(
        headX + Math.cos(aL) * pLen * 0.58, headY + pLift * 0.65, headZ + Math.sin(aL) * pLen * 0.58,
        headX + Math.cos(a0) * pLen, headY + pLift, headZ + Math.sin(a0) * pLen,
        headX + Math.cos(aR) * pLen * 0.58, headY + pLift * 0.65, headZ + Math.sin(aR) * pLen * 0.58
      );
      norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      cols.push(1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
      petalMask.push(1.0, 1.0, 1.0);
      indices.push(centerIdx, baseV, baseV + 1, centerIdx, baseV + 1, baseV + 2);
    }

    const blossomGeo = new THREE.BufferGeometry();
    blossomGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blossomGeo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    blossomGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    blossomGeo.setAttribute('aPetalMask', new THREE.Float32BufferAttribute(petalMask, 1));
    blossomGeo.setIndex(indices);
    blossomGeo.computeVertexNormals();

    this.wildflowerMaterial = createWildflowerMaterial({
      windSpeed: this.currentConfig?.wind?.speed ?? 1.8,
      windStrength: this.currentConfig?.wind?.swayIntensity ?? 0.55,
      sunDirection: sunDir
    });

    const mesh = new THREE.InstancedMesh(blossomGeo, this.wildflowerMaterial, count);
    mesh.name = 'InstancedForestBlossoms';

    const dummy = new THREE.Matrix4();
    const mPos = new THREE.Vector3();
    const mQuat = new THREE.Quaternion();
    const mEuler = new THREE.Euler();
    const mScale = new THREE.Vector3();
    const palette = [
      new THREE.Color('#f7f3e4'), // Woodland white anemone
      new THREE.Color('#f6ca45'), // Golden buttercup / marsh marigold
      new THREE.Color('#8fb2eb'), // Alpine harebell blue
      new THREE.Color('#f2c8d2')  // Pale wild rose blush
    ];
    const tmpCol = new THREE.Color();

    let placed = 0;
    for (let i = 0; placed < count && i < count * 3; i++) {
      let x = 0;
      let z = 0;
      if (i < 950) {
        // Along sunny stream banks & clearing near spawn/footbridge
        z = -90.0 + pseudoRand(i * 1.73) * 185.0;
        const side = i % 2 === 0 ? -1 : 1;
        x = getStreamCenterX(z) + side * (3.9 + pseudoRand(i * 3.19) * 5.8);
      } else if (i < 1450 && nurseLogs.length > 0) {
        const nl = nurseLogs[i % nurseLogs.length];
        const ang = pseudoRand(i * 4.31) * Math.PI * 2;
        const dist = 0.8 + pseudoRand(i * 6.07) * 3.2;
        x = nl.x + Math.cos(ang) * dist;
        z = nl.z + Math.sin(ang) * dist;
      } else if (i < 1950 && treeRoots.length > 0) {
        const rt = treeRoots[i % treeRoots.length];
        const ang = pseudoRand(i * 5.23) * Math.PI * 2;
        const dist = 1.4 + pseudoRand(i * 7.89) * 3.6;
        x = rt.x + Math.cos(ang) * dist;
        z = rt.z + Math.sin(ang) * dist;
      } else {
        const r = 4.0 + Math.sqrt(pseudoRand(i * 2.41)) * 74.0;
        const ang = i * 2.39996 + pseudoRand(i * 3.77) * 0.3;
        x = Math.cos(ang) * r;
        z = Math.sin(ang) * r;
      }

      const streamCenterX = getStreamCenterX(z);
      if (Math.abs(x - streamCenterX) < 3.7) continue;
      if (z > -8.8 && z < -3.2 && Math.abs(x - getStreamCenterX(-6)) < 9.2) continue;
      if (z > 49.5 && z < 58.5 && Math.abs(x - getStreamCenterX(54.0)) < 10.5) continue;
      if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 1.25) continue;
      if (this.isExcludedFromShrine(x, z)) continue;
      if (Math.hypot(x - 28.0, z + 18.0) < 5.2) continue;

      const y = getMistyForestHeight(x, z);
      mPos.set(x, y - 0.01, z);
      mEuler.set(
        (pseudoRand(i * 8.13) - 0.5) * 0.26,
        pseudoRand(i * 9.41) * Math.PI * 2,
        (pseudoRand(i * 10.7) - 0.5) * 0.26
      );
      mQuat.setFromEuler(mEuler);
      const hS = 0.62 + pseudoRand(i * 11.3) * 0.85;
      const wS = 0.78 + pseudoRand(i * 12.7) * 0.52;
      mScale.set(wS, hS, wS);
      dummy.compose(mPos, mQuat, mScale);
      mesh.setMatrixAt(placed, dummy);

      const baseC = palette[Math.floor(pseudoRand(i * 13.9) * palette.length) % palette.length];
      tmpCol.copy(baseC).multiplyScalar(0.84 + pseudoRand(i * 14.3) * 0.28);
      mesh.setColorAt(placed, tmpCol);
      placed++;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
  }

  private createSculptedBoulderGeometry(): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(1.0, 18, 14);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);

      const n1 = Math.sin(vx * 2.9 + vy * 2.2) * Math.cos(vz * 2.7 - vx * 1.4);
      const n2 = Math.cos(vy * 4.3 + vz * 3.5) * 0.14 + Math.sin(vx * 5.1 - vz * 4.2) * 0.08;
      const disp = 1.0 + n1 * 0.22 + n2;

      vx *= disp;
      vy *= disp * 0.70;
      vz *= disp;

      if (vy < -0.22) {
        vy = -0.22 + (vy + 0.22) * 0.35;
      }

      pos.setXYZ(i, vx, vy, vz);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private buildRiverBoulders(graniteCliff: PbrTextureSet): THREE.Vector4[] {
    const count = 440;
    const boulderGeo = this.createSculptedBoulderGeometry();
    const boulderMat = new THREE.MeshStandardMaterial({
      map: graniteCliff.map,
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(1.55, 1.55),
      roughnessMap: graniteCliff.roughnessMap,
      roughness: 1.0,
      aoMap: graniteCliff.aoMap,
      aoMapIntensity: 0.92
    });
    this.applyWorldMossAndDampness(boulderMat, {
      mossAmount: 0.90,
      dampYScale: 1.25,
      wetStreamFactor: 0.95,
      cacheKey: 'misty-river-boulder-pbr-v5'
    });
    applyWorldSpaceWeathering(boulderMat, {
      macroScale: 0.28,
      mossHeight: 0.65,
      mossColor: '#2e5c22',
      dampRoughness: 0.22,
      dirtTint: '#3a3228'
    });

    const boulderMesh = new THREE.InstancedMesh(boulderGeo, boulderMat, count);
    boulderMesh.name = 'InstancedRiverBoulders';
    boulderMesh.castShadow = true;
    boulderMesh.receiveShadow = true;

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const streamBoulders: THREE.Vector4[] = [];
    const isl = getRiverIslandCenter();

    let placed = 0;
    for (let i = 0; placed < count && i < count * 3; i++) {
      let x = 0;
      let z = 0;
      let baseScale = 0.65;
      let isInStream = false;

      if (i < 240) {
        z = -132.0 + pseudoRand(i * 1.73) * 286.0;
        const streamX = getStreamCenterX(z);
        isInStream = i % 9 === 0 && (z < -10.5 || z > -1.5) && (z < 49.0 || z > 59.0) && Math.abs(z - isl.z) > 6.5;
        if (isInStream) {
          x = streamX + (pseudoRand(i * 3.91) - 0.5) * 3.0;
          baseScale = 0.48 + pseudoRand(i * 5.17) * 0.55;
        } else {
          const side = i % 2 === 0 ? -1 : 1;
          const dzIsl = z - isl.z;
          const islWiden = Math.exp(-(dzIsl * dzIsl) / 96.0) * 2.1;
          const dist = 3.2 + islWiden + pseudoRand(i * 4.63) * 2.5;
          x = streamX + side * dist;
          baseScale = 0.55 + pseudoRand(i * 6.41) * 1.15;
        }
        if (z > -9.5 && z < -2.5 && Math.abs(x - getStreamCenterX(-6)) < 7.2) continue;
        if (z > 49.5 && z < 58.5 && Math.abs(x - getStreamCenterX(54.0)) < 8.5) continue;
        if (Math.hypot(x + 2.0, z - 11.5) < 6.2) continue;
      } else if (i < 270) {
        // Large craggy cliff boulders framing the waterfall plunge pool (strictly outside cascade width)
        const wfX = getStreamCenterX(-137.5);
        const side = i % 2 === 0 ? -1 : 1;
        const tIdx = i - 240;
        x = wfX + side * (5.8 + (tIdx % 6) * 2.2 + pseudoRand(i * 2.3) * 1.5);
        z = -136.0 + (tIdx % 5) * 2.2 + pseudoRand(i * 3.7) * 1.4;
        baseScale = 1.55 + pseudoRand(i * 5.9) * 1.65;
      } else {
        // Mossy granite ridge boulders across the doubled pine forest & outer ridge territory
        const ang = i * 2.39996;
        const r = 16.0 + pseudoRand(i * 2.93) * 110.0;
        x = Math.cos(ang) * r;
        z = Math.sin(ang) * r;
        if (Math.abs(x - getStreamCenterX(z)) < 5.5) continue;
        if (Math.hypot(x + 4, z - 14) < 7.0) continue;
        if (z > -22.0 && z < 48.0 && Math.abs(x - getMistyTrailCenterX(z)) < 2.2) continue;
        if (this.isExcludedFromShrine(x, z)) continue;
        if (Math.hypot(x + 26.0, z + 12.0) < 9.2) continue;
        if (Math.hypot(x - 28.0, z + 18.0) < 8.8) continue;
        baseScale = 1.05 + pseudoRand(i * 7.11) * 1.75;
      }

      const y = getMistyForestHeight(x, z);
      pos.set(x, y + baseScale * 0.14, z);
      euler.set(
        (pseudoRand(i * 8.1) - 0.5) * 0.25,
        pseudoRand(i * 9.3) * Math.PI * 2,
        (pseudoRand(i * 10.7) - 0.5) * 0.25
      );
      quat.setFromEuler(euler);
      const sx = baseScale * (0.85 + pseudoRand(i * 11.9) * 0.45);
      const sy = baseScale * (0.65 + pseudoRand(i * 12.7) * 0.45);
      const sz = baseScale * (0.85 + pseudoRand(i * 13.3) * 0.45);
      scale.set(sx, sy, sz);
      dummy.compose(pos, quat, scale);
      boulderMesh.setMatrixAt(placed, dummy);

      const v = 0.78 + pseudoRand(i * 14.1) * 0.34;
      col.setRGB(v, v * 0.99, v * 0.96);
      boulderMesh.setColorAt(placed, col);

      if (isInStream && streamBoulders.length < 16 && z > -120 && z < 130) {
        streamBoulders.push(new THREE.Vector4(x, z, Math.max(sx, sz) * 0.95, 1.0));
      }

      placed++;
    }

    boulderMesh.count = placed;
    boulderMesh.instanceMatrix.needsUpdate = true;
    if (boulderMesh.instanceColor) boulderMesh.instanceColor.needsUpdate = true;
    this.scene.add(boulderMesh);

    return streamBoulders;
  }

  /**
   * Scatters 760 glossy wet rounded river pebbles & submerged stream-margin stones
   * along the shallow riverbed, damp mossy banks, and Rocky Island shoreline (roughness: 0.14 beside water).
   */
  private buildRiverbedStones(riverGranite: PbrTextureSet): void {
    const count = 1300;
    const stoneGeo = this.createSculptedBoulderGeometry();
    const wetStoneMat = new THREE.MeshStandardMaterial({
      map: riverGranite.map,
      normalMap: riverGranite.normalMap,
      normalScale: new THREE.Vector2(1.55, 1.55),
      roughnessMap: riverGranite.roughnessMap,
      roughness: 0.72,
      aoMap: riverGranite.aoMap,
      aoMapIntensity: 0.9
    });
    this.applyWorldMossAndDampness(wetStoneMat, {
      mossAmount: 0.30,
      dampYScale: 1.6,
      wetStreamFactor: 1.0,
      cacheKey: 'misty-riverbed-wet-stones-v3'
    });
    applyWorldSpaceWeathering(wetStoneMat, {
      macroScale: 0.36,
      mossHeight: 0.25,
      mossColor: '#2a5620',
      dampRoughness: 0.14,
      dirtTint: '#2b2722'
    });

    const mesh = new THREE.InstancedMesh(stoneGeo, wetStoneMat, count);
    mesh.name = 'InstancedRiverbedStones';
    mesh.receiveShadow = true;

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const isl = getRiverIslandCenter();

    let placed = 0;
    for (let i = 0; placed < count && i < count * 3; i++) {
      let x = 0;
      let z = 0;
      if (i < 90) {
        // Wet river pebbles hugging the Rocky Island shoreline
        const ang = (i / 90) * Math.PI * 2 + pseudoRand(i * 2.1) * 0.2;
        const radScale = 0.85 + pseudoRand(i * 4.9) * 0.45;
        x = isl.x + Math.cos(ang) * isl.rx * radScale;
        z = isl.z + Math.sin(ang) * isl.rz * radScale;
      } else {
        z = -130.0 + pseudoRand(i * 1.37 + 5.0) * 284.0;
        const streamX = getStreamCenterX(z);
        const dzIsl = z - isl.z;
        const islWiden = Math.exp(-(dzIsl * dzIsl) / 96.0) * 2.2;
        const isBankEdge = i % 3 !== 0;
        const lat = isBankEdge
          ? (i % 2 === 0 ? -1 : 1) * (2.2 + islWiden + pseudoRand(i * 3.11) * 2.1)
          : (pseudoRand(i * 2.71) - 0.5) * (3.6 + islWiden);
        x = streamX + lat;
        if (z > -8.5 && z < -3.5 && Math.abs(x - getStreamCenterX(-6)) < 5.5) continue;
        if (z > 50.5 && z < 57.5 && Math.abs(x - getStreamCenterX(54.0)) < 6.5) continue;
      }

      const y = getMistyForestHeight(x, z);
      const sx = 0.16 + pseudoRand(i * 4.7) * 0.30;
      const sy = 0.08 + pseudoRand(i * 5.9) * 0.14;
      const sz = 0.16 + pseudoRand(i * 7.1) * 0.30;

      pos.set(x, y + sy * 0.18, z);
      euler.set(
        (pseudoRand(i * 8.3) - 0.5) * 0.28,
        pseudoRand(i * 9.7) * Math.PI * 2,
        (pseudoRand(i * 10.9) - 0.5) * 0.28
      );
      quat.setFromEuler(euler);
      scale.set(sx, sy, sz);
      dummy.compose(pos, quat, scale);
      mesh.setMatrixAt(placed, dummy);

      const tone = 0.60 + pseudoRand(i * 11.7) * 0.42;
      col.setRGB(tone, tone * 0.99, tone * 0.96);
      mesh.setColorAt(placed, col);
      placed++;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
  }

  private colorizeGeometry(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }

  private buildFootbridge(timberBeam: PbrTextureSet, stoneMasonry: PbrTextureSet): void {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'RusticFootbridge';

    const bridgeZ = -6.0;
    const bridgeX = getStreamCenterX(bridgeZ);
    const dxDz = 8.0 * 0.055 * Math.cos(bridgeZ * 0.055);
    const bridgeYaw = Math.atan2(dxDz, 1.0);

    const cosY = Math.cos(bridgeYaw);
    const sinY = Math.sin(bridgeYaw);
    const spanHalf = 5.3;
    const deckWidth = 2.25;
    const archRise = 1.18;

    const leftWX = bridgeX - spanHalf * cosY;
    const leftWZ = bridgeZ + spanHalf * sinY;
    const rightWX = bridgeX + spanHalf * cosY;
    const rightWZ = bridgeZ - spanHalf * sinY;

    const yLeft = getMistyForestHeight(leftWX, leftWZ);
    const yRight = getMistyForestHeight(rightWX, rightWZ);

    const getArchY = (u: number): number => {
      const base = yLeft + (yRight - yLeft) * u;
      return base + Math.sin(u * Math.PI) * archRise + 0.22;
    };

    const timberParts: THREE.BufferGeometry[] = [];
    const stoneParts: THREE.BufferGeometry[] = [];
    const lanternParts: THREE.BufferGeometry[] = [];

    const cedarWarm = new THREE.Color('#c8a88c');
    const cedarDark = new THREE.Color('#a4866c');
    const cedarAged = new THREE.Color('#b6977c');
    const postWood = new THREE.Color('#92755b');
    const stoneCol = new THREE.Color('#b8beb8');
    const stoneDark = new THREE.Color('#98a29c');

    // 1. Stone abutment piers & detailed multi-tier stone approach steps with flanking cheek curbs
    for (const endIdx of [0, 1]) {
      const endX = endIdx === 0 ? -spanHalf : spanHalf;
      const dirSign = endIdx === 0 ? -1 : 1;
      const bankY = endIdx === 0 ? yLeft : yRight;

      const pier = new THREE.BoxGeometry(1.22, 1.65, deckWidth + 0.62);
      scaleGeometryUvs(pier, 0.35, 0.35);
      pier.translate(endX, bankY - 0.50, 0);
      this.colorizeGeometry(pier, stoneCol);
      stoneParts.push(prepareForMerge(pier, undefined, true));
      pier.dispose();

      // Coping cap slab atop abutment
      const capSlab = new THREE.BoxGeometry(1.30, 0.14, deckWidth + 0.74);
      scaleGeometryUvs(capSlab, 0.35, 0.35);
      capSlab.translate(endX, bankY + 0.24, 0);
      this.colorizeGeometry(capSlab, stoneCol);
      stoneParts.push(prepareForMerge(capSlab, undefined, true));
      capSlab.dispose();

      // 5 detailed chiseled granite steps descending onto the woodland trail + flanking stone cheek curbs
      for (let s = 1; s <= 5; s++) {
        const stepDepth = 0.56;
        const stepWidth = deckWidth * (0.94 - s * 0.03);
        const stepX = endX + dirSign * (0.55 + s * 0.54);
        const stepWX = bridgeX + stepX * cosY;
        const stepWZ = bridgeZ - stepX * sinY;
        const terrainY = getMistyForestHeight(stepWX, stepWZ);
        const deckApproachY = bankY + 0.22 - s * 0.10;
        const stepTopY = Math.max(terrainY + 0.08, deckApproachY);

        // Main riser block (split into 2 chiseled granite slabs for authentic joints)
        for (const zHalf of [-0.25, 0.25]) {
          const slabW = stepWidth * 0.49;
          const slab = new THREE.BoxGeometry(stepDepth, 0.24, slabW);
          scaleGeometryUvs(slab, 0.24, 0.24);
          slab.translate(stepX, stepTopY - 0.09, zHalf * stepWidth);
          this.colorizeGeometry(slab, (s + (zHalf > 0 ? 1 : 0)) % 2 === 0 ? stoneCol : stoneDark);
          stoneParts.push(prepareForMerge(slab, undefined, true));
          slab.dispose();
        }

        // Flanking low stone cheek-wall curb stones
        if (s <= 4) {
          for (const zSide of [-1, 1]) {
            const curb = new THREE.BoxGeometry(0.62, 0.32, 0.24);
            scaleGeometryUvs(curb, 0.20, 0.18);
            curb.translate(stepX, stepTopY - 0.01, zSide * (stepWidth * 0.5 + 0.12));
            this.colorizeGeometry(curb, stoneDark);
            stoneParts.push(prepareForMerge(curb, undefined, true));
            curb.dispose();
          }
        }
      }
    }

    // 2. Two arched timber stringer beams spanning under the deck
    const beamSegs = 14;
    for (const zOff of [-deckWidth * 0.36, deckWidth * 0.36]) {
      for (let s = 0; s < beamSegs; s++) {
        const u0 = s / beamSegs;
        const u1 = (s + 1) / beamSegs;
        const x0 = -spanHalf + u0 * spanHalf * 2;
        const x1 = -spanHalf + u1 * spanHalf * 2;
        const y0 = getArchY(u0) - 0.14;
        const y1 = getArchY(u1) - 0.14;

        const segLen = Math.hypot(x1 - x0, y1 - y0) + 0.06;
        const segSlope = Math.atan2(y1 - y0, x1 - x0);
        const beam = new THREE.BoxGeometry(segLen, 0.22, 0.18);
        scaleGeometryUvs(beam, 0.6, 0.8);
        beam.rotateZ(segSlope);
        beam.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5, zOff);
        this.colorizeGeometry(beam, postWood);
        timberParts.push(prepareForMerge(beam, undefined, true));
        beam.dispose();
      }
    }

    // 3. Individual weathered deck planks along the arch
    const plankCount = 24;
    for (let p = 0; p < plankCount; p++) {
      const u = (p + 0.5) / plankCount;
      const px = -spanHalf + u * spanHalf * 2;
      const py = getArchY(u);
      const uNext = Math.min(1, u + 0.02);
      const uPrev = Math.max(0, u - 0.02);
      const slope = Math.atan2(getArchY(uNext) - getArchY(uPrev), (uNext - uPrev) * spanHalf * 2);

      const plank = new THREE.BoxGeometry(0.36, 0.09, deckWidth);
      scaleGeometryUvs(plank, 0.4, 1.4);
      plank.rotateZ(slope);
      plank.translate(px, py, 0);
      const plankCol = p % 3 === 0 ? cedarDark : p % 2 === 0 ? cedarWarm : cedarAged;
      this.colorizeGeometry(plank, plankCol);
      timberParts.push(prepareForMerge(plank, undefined, true));
      plank.dispose();
    }

    // 4. Vertical handrail posts, arched handrails & mid-rails
    const postU = [0.05, 0.27, 0.5, 0.73, 0.95];
    const railZ = deckWidth * 0.48;
    const railHeight = 0.92;

    for (const zSide of [-railZ, railZ]) {
      for (let i = 0; i < postU.length; i++) {
        const u = postU[i];
        const px = -spanHalf + u * spanHalf * 2;
        const py = getArchY(u);
        const isEndPost = i === 0 || i === postU.length - 1;
        const h = isEndPost ? railHeight + 0.28 : railHeight;
        const post = new THREE.BoxGeometry(0.14, h, 0.14);
        scaleGeometryUvs(post, 0.35, 1.1);
        post.translate(px, py + h * 0.5 - 0.12, zSide);
        this.colorizeGeometry(post, postWood);
        timberParts.push(prepareForMerge(post, undefined, true));
        post.dispose();
      }

      for (let i = 0; i < postU.length - 1; i++) {
        const u0 = postU[i];
        const u1 = postU[i + 1];
        const x0 = -spanHalf + u0 * spanHalf * 2;
        const x1 = -spanHalf + u1 * spanHalf * 2;
        const y0 = getArchY(u0);
        const y1 = getArchY(u1);

        const segLen = Math.hypot(x1 - x0, y1 - y0) + 0.08;
        const segSlope = Math.atan2(y1 - y0, x1 - x0);

        const topRail = new THREE.BoxGeometry(segLen, 0.10, 0.12);
        scaleGeometryUvs(topRail, 1.4, 0.3);
        topRail.rotateZ(segSlope);
        topRail.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5 + railHeight - 0.12, zSide);
        this.colorizeGeometry(topRail, cedarWarm);
        timberParts.push(prepareForMerge(topRail, undefined, true));
        topRail.dispose();

        const midRail = new THREE.BoxGeometry(segLen, 0.065, 0.08);
        scaleGeometryUvs(midRail, 1.4, 0.25);
        midRail.rotateZ(segSlope);
        midRail.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5 + railHeight * 0.45, zSide);
        this.colorizeGeometry(midRail, cedarAged);
        timberParts.push(prepareForMerge(midRail, undefined, true));
        midRail.dispose();
      }
    }

    // 5. Rustic amber lanterns atop entrance posts
    for (const u of [postU[0], postU[postU.length - 1]]) {
      const px = -spanHalf + u * spanHalf * 2;
      const py = getArchY(u) + railHeight + 0.26;
      const glass = new THREE.BoxGeometry(0.16, 0.22, 0.16);
      glass.translate(px, py, -railZ);
      lanternParts.push(prepareForMerge(glass));
      glass.dispose();

      const cap = new THREE.ConeGeometry(0.16, 0.12, 4);
      cap.rotateY(Math.PI / 4);
      cap.translate(px, py + 0.16, -railZ);
      this.colorizeGeometry(cap, postWood);
      timberParts.push(prepareForMerge(cap, undefined, true));
      cap.dispose();

      const lanternLight = new THREE.PointLight('#ffb864', 1.15, 7.5, 2.0);
      lanternLight.position.set(px, py, -railZ);
      bridgeGroup.add(lanternLight);
    }

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneMasonry.map,
      normalMap: stoneMasonry.normalMap,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: stoneMasonry.roughnessMap,
      roughness: 1.0,
      aoMap: stoneMasonry.aoMap,
      aoMapIntensity: 0.9,
      vertexColors: true
    });
    this.applyWorldMossAndDampness(stoneMat, {
      mossAmount: 0.82,
      dampYScale: 0.9,
      wetStreamFactor: 0.88,
      cacheKey: 'misty-bridge-stone-pbr-v3'
    });
    applyWorldSpaceWeathering(stoneMat, {
      macroScale: 0.30,
      mossHeight: 0.6,
      mossColor: '#2d5c22',
      dampRoughness: 0.22,
      dirtTint: '#3a3228'
    });

    const stoneGeo = mergeGeometries(stoneParts, false)!;
    stoneParts.forEach((g) => g.dispose());
    const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
    stoneMesh.name = 'BridgeStoneAbutments';
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    bridgeGroup.add(stoneMesh);

    const timberMat = new THREE.MeshStandardMaterial({
      map: timberBeam.map,
      normalMap: timberBeam.normalMap,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: timberBeam.roughnessMap,
      roughness: 1.0,
      aoMap: timberBeam.aoMap,
      aoMapIntensity: 0.88,
      vertexColors: true
    });
    this.applyWorldMossAndDampness(timberMat, {
      mossAmount: 0.74,
      dampYScale: 0.08,
      wetStreamFactor: 0.28,
      cacheKey: 'misty-bridge-timber-pbr-v3'
    });
    applyWorldSpaceWeathering(timberMat, {
      macroScale: 0.32,
      mossHeight: 1.6,
      mossColor: '#316a24',
      dampRoughness: 0.38,
      dirtTint: '#382c20'
    });

    const timberGeo = mergeGeometries(timberParts, false)!;
    timberParts.forEach((g) => g.dispose());
    const timberMesh = new THREE.Mesh(timberGeo, timberMat);
    timberMesh.name = 'BridgeTimber';
    timberMesh.castShadow = true;
    timberMesh.receiveShadow = true;
    bridgeGroup.add(timberMesh);

    const lanternGeo = mergeGeometries(lanternParts, false)!;
    lanternParts.forEach((g) => g.dispose());
    const lanternMesh = new THREE.Mesh(
      lanternGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffd28a,
        emissive: 0xffa73b,
        emissiveIntensity: 1.75,
        roughness: 0.35
      })
    );
    lanternMesh.name = 'BridgeLanterns';
    bridgeGroup.add(lanternMesh);

    bridgeGroup.position.set(bridgeX, 0, bridgeZ);
    bridgeGroup.rotation.y = bridgeYaw;
    this.scene.add(bridgeGroup);
  }

  /**
   * Builds a Downstream Rustic Mossy Stone Viewing Bridge spanning the widened stream at z = +54,
   * featuring arched stone voussoir deck slabs, carved stone parapet walls, stepped viewing alcove piers,
   * chiseled granite approach steps, and twin mossy stone tōrō lanterns.
   */
  private buildDownstreamViewingBridge(stoneMasonry: PbrTextureSet, timberBeam: PbrTextureSet): void {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'DownstreamMossyStoneBridge';

    const bridgeZ = 54.0;
    const bridgeX = getStreamCenterX(bridgeZ);
    const dxDz = 8.0 * 0.055 * Math.cos(bridgeZ * 0.055);
    const bridgeYaw = Math.atan2(dxDz, 1.0);

    const cosY = Math.cos(bridgeYaw);
    const sinY = Math.sin(bridgeYaw);
    const spanHalf = 6.1;
    const deckWidth = 2.65;
    const archRise = 1.28;

    const leftWX = bridgeX - spanHalf * cosY;
    const leftWZ = bridgeZ + spanHalf * sinY;
    const rightWX = bridgeX + spanHalf * cosY;
    const rightWZ = bridgeZ - spanHalf * sinY;
    const yLeft = getMistyForestHeight(leftWX, leftWZ);
    const yRight = getMistyForestHeight(rightWX, rightWZ);

    const getArchY = (u: number): number => {
      const base = yLeft + (yRight - yLeft) * u;
      return base + Math.sin(u * Math.PI) * archRise + 0.26;
    };

    const stoneParts: THREE.BufferGeometry[] = [];
    const cedarParts: THREE.BufferGeometry[] = [];
    const lanternParts: THREE.BufferGeometry[] = [];

    const stoneLight = new THREE.Color('#c0c6bf');
    const stoneDark = new THREE.Color('#97a19a');
    const cedarDark = new THREE.Color('#6a482f');

    // 1. Heavy stone abutment piers & 5-step chiseled granite approaches
    for (const endIdx of [0, 1]) {
      const endX = endIdx === 0 ? -spanHalf : spanHalf;
      const dirSign = endIdx === 0 ? -1 : 1;
      const bankY = endIdx === 0 ? yLeft : yRight;

      const pier = new THREE.BoxGeometry(1.45, 1.85, deckWidth + 0.72);
      scaleGeometryUvs(pier, 0.35, 0.35);
      pier.translate(endX, bankY - 0.55, 0);
      this.colorizeGeometry(pier, stoneLight);
      stoneParts.push(prepareForMerge(pier, undefined, true));
      pier.dispose();

      const capSlab = new THREE.BoxGeometry(1.56, 0.16, deckWidth + 0.86);
      scaleGeometryUvs(capSlab, 0.35, 0.35);
      capSlab.translate(endX, bankY + 0.28, 0);
      this.colorizeGeometry(capSlab, stoneLight);
      stoneParts.push(prepareForMerge(capSlab, undefined, true));
      capSlab.dispose();

      for (let s = 1; s <= 5; s++) {
        const stepX = endX + dirSign * (0.62 + s * 0.58);
        const stepWX = bridgeX + stepX * cosY;
        const stepWZ = bridgeZ - stepX * sinY;
        const terrainY = getMistyForestHeight(stepWX, stepWZ);
        const stepTopY = Math.max(terrainY + 0.08, bankY + 0.24 - s * 0.11);
        const stepW = deckWidth * (0.96 - s * 0.03);
        const stepGeo = new THREE.BoxGeometry(0.60, 0.26, stepW);
        scaleGeometryUvs(stepGeo, 0.26, 0.26);
        stepGeo.translate(stepX, stepTopY - 0.08, 0);
        this.colorizeGeometry(stepGeo, s % 2 === 0 ? stoneLight : stoneDark);
        stoneParts.push(prepareForMerge(stepGeo, undefined, true));
        stepGeo.dispose();
      }
    }

    // 2. Arched stone masonry barrel deck & chiseled stone parapet walls + coping
    const segs = 18;
    for (let s = 0; s < segs; s++) {
      const u0 = s / segs;
      const u1 = (s + 1) / segs;
      const um = (u0 + u1) * 0.5;
      const x0 = -spanHalf + u0 * spanHalf * 2;
      const x1 = -spanHalf + u1 * spanHalf * 2;
      const y0 = getArchY(u0);
      const y1 = getArchY(u1);
      const xm = (x0 + x1) * 0.5;
      const ym = (y0 + y1) * 0.5;
      const segLen = Math.hypot(x1 - x0, y1 - y0) + 0.08;
      const slope = Math.atan2(y1 - y0, x1 - x0);

      const archSlab = new THREE.BoxGeometry(segLen, 0.34, deckWidth);
      scaleGeometryUvs(archSlab, 0.36, 0.36);
      archSlab.rotateZ(slope);
      archSlab.translate(xm, ym - 0.14, 0);
      this.colorizeGeometry(archSlab, s % 2 === 0 ? stoneLight : stoneDark);
      stoneParts.push(prepareForMerge(archSlab, undefined, true));
      archSlab.dispose();

      // Low carved mossy stone parapet walls with coping stones on both flanks
      for (const zSide of [-deckWidth * 0.45, deckWidth * 0.45]) {
        const para = new THREE.BoxGeometry(segLen, 0.68, 0.26);
        scaleGeometryUvs(para, 0.30, 0.24);
        para.rotateZ(slope);
        para.translate(xm, ym + 0.34, zSide);
        this.colorizeGeometry(para, stoneDark);
        stoneParts.push(prepareForMerge(para, undefined, true));
        para.dispose();

        const cope = new THREE.BoxGeometry(segLen * 1.03, 0.11, 0.34);
        scaleGeometryUvs(cope, 0.32, 0.18);
        cope.rotateZ(slope);
        cope.translate(xm, ym + 0.72, zSide);
        this.colorizeGeometry(cope, stoneLight);
        stoneParts.push(prepareForMerge(cope, undefined, true));
        cope.dispose();
      }

      // Mid-span viewing bench alcove & stone baluster piers
      if (Math.abs(um - 0.5) < 0.04) {
        const bench = new THREE.BoxGeometry(1.35, 0.12, 0.46);
        scaleGeometryUvs(bench, 0.32, 0.20);
        bench.translate(xm, ym + 0.44, -deckWidth * 0.28);
        this.colorizeGeometry(bench, stoneLight);
        stoneParts.push(prepareForMerge(bench, undefined, true));
        bench.dispose();
      }
    }

    // 3. Twin Mossy Stone Tōrō Bridge-Head Lanterns at approaches
    for (const u of [0.06, 0.94]) {
      const px = -spanHalf + u * spanHalf * 2;
      const py = getArchY(u) + 0.76;
      const pz = deckWidth * 0.45;

      const ped = new THREE.CylinderGeometry(0.24, 0.30, 0.36, 6);
      scaleGeometryUvs(ped, 0.25, 0.25);
      ped.translate(px, py + 0.14, pz);
      this.colorizeGeometry(ped, stoneDark);
      stoneParts.push(prepareForMerge(ped, undefined, true));
      ped.dispose();

      const box = new THREE.BoxGeometry(0.20, 0.24, 0.20);
      box.translate(px, py + 0.42, pz);
      lanternParts.push(prepareForMerge(box));
      box.dispose();

      const kasa = new THREE.ConeGeometry(0.42, 0.24, 6);
      scaleGeometryUvs(kasa, 0.28, 0.28);
      kasa.translate(px, py + 0.64, pz);
      this.colorizeGeometry(kasa, cedarDark);
      cedarParts.push(prepareForMerge(kasa, undefined, true));
      kasa.dispose();

      const lanternLight = new THREE.PointLight('#ffb864', 1.15, 8.5, 2.0);
      lanternLight.position.set(px, py + 0.42, pz);
      bridgeGroup.add(lanternLight);
    }

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneMasonry.map,
      normalMap: stoneMasonry.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: stoneMasonry.roughnessMap,
      roughness: 1.0,
      aoMap: stoneMasonry.aoMap,
      aoMapIntensity: 0.92,
      vertexColors: true
    });
    this.applyWorldMossAndDampness(stoneMat, {
      mossAmount: 0.76,
      dampYScale: 0.95,
      wetStreamFactor: 0.9,
      cacheKey: 'misty-stone-viewing-bridge-pbr-v1'
    });
    applyWorldSpaceWeathering(stoneMat, {
      macroScale: 0.30,
      mossHeight: 0.75,
      mossColor: '#2d5e22',
      dampRoughness: 0.24,
      dirtTint: '#3a3228'
    });

    const stoneMesh = new THREE.Mesh(mergeGeometries(stoneParts, false)!, stoneMat);
    stoneMesh.name = 'DownstreamBridgeStonework';
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    stoneParts.forEach((g) => g.dispose());
    bridgeGroup.add(stoneMesh);

    const cedarMat = new THREE.MeshStandardMaterial({
      map: timberBeam.map,
      normalMap: timberBeam.normalMap,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: timberBeam.roughnessMap,
      roughness: 0.9,
      aoMap: timberBeam.aoMap,
      vertexColors: true
    });
    const cedarMesh = new THREE.Mesh(mergeGeometries(cedarParts, false)!, cedarMat);
    cedarMesh.name = 'DownstreamBridgeLanternCaps';
    cedarMesh.castShadow = true;
    cedarParts.forEach((g) => g.dispose());
    bridgeGroup.add(cedarMesh);

    const lanternMesh = new THREE.Mesh(
      mergeGeometries(lanternParts, false)!,
      new THREE.MeshStandardMaterial({
        color: 0xffd28a,
        emissive: 0xffa73b,
        emissiveIntensity: 1.8,
        roughness: 0.35
      })
    );
    lanternMesh.name = 'DownstreamBridgeLanterns';
    lanternParts.forEach((g) => g.dispose());
    bridgeGroup.add(lanternMesh);

    bridgeGroup.position.set(bridgeX, 0, bridgeZ);
    bridgeGroup.rotation.y = bridgeYaw;
    this.scene.add(bridgeGroup);
  }

  /**
   * Places sculpted weathered PBR flagstones along the winding woodland approach trail
   * and outer stone tōrō trail lanterns guiding hikers across the doubled forest territory.
   */
  private buildTrailSteppingStones(
    stoneMasonry: PbrTextureSet,
    graniteCliff: PbrTextureSet,
    timberBeam: PbrTextureSet
  ): void {
    const stoneGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.14, 9, 1);
    const posAttr = stoneGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const ang = Math.atan2(vz, vx);
      const wobble = 1.0 + Math.sin(ang * 3.0) * 0.12 + Math.cos(ang * 5.0) * 0.08;
      posAttr.setXYZ(i, vx * wobble, vy, vz * wobble);
    }
    stoneGeo.computeVertexNormals();

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneMasonry.map,
      normalMap: stoneMasonry.normalMap,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: stoneMasonry.roughnessMap,
      roughness: 1.0,
      aoMap: stoneMasonry.aoMap
    });
    this.applyWorldMossAndDampness(stoneMat, {
      mossAmount: 0.48,
      dampYScale: 1.4,
      wetStreamFactor: 0.45,
      cacheKey: 'misty-trail-stones-pbr-v2'
    });
    applyWorldSpaceWeathering(stoneMat, {
      macroScale: 0.32,
      mossHeight: 0.4,
      mossColor: '#2f5e24',
      dampRoughness: 0.28,
      dirtTint: '#3a3024'
    });

    const stones: Array<{ x: number; z: number; sx: number; sz: number; rot: number }> = [];
    // West trail: from z=13.5 approaching bridge west abutment at z=-3.2
    for (let s = 0; s < 22; s++) {
      const z = 13.2 - s * 0.76;
      const cx = getMistyTrailCenterX(z);
      const lat = (s % 2 === 0 ? -1 : 1) * (0.14 + pseudoRand(s * 3.7) * 0.24);
      const x = cx + lat;
      if (Math.abs(x - getStreamCenterX(z)) < 5.6) continue;
      stones.push({
        x,
        z,
        sx: 0.85 + pseudoRand(s * 5.1) * 0.45,
        sz: 0.75 + pseudoRand(s * 7.3) * 0.40,
        rot: pseudoRand(s * 9.7) * Math.PI * 2
      });
    }
    // East trail: leaving bridge east abutment at z=-9.2 into sunbeam glade
    for (let s = 0; s < 14; s++) {
      const z = -9.6 - s * 0.85;
      const cx = getMistyTrailCenterX(z);
      const lat = (s % 2 === 0 ? 1 : -1) * (0.14 + pseudoRand(s * 4.3 + 20) * 0.22);
      const x = cx + lat;
      if (Math.abs(x - getStreamCenterX(z)) < 5.6) continue;
      stones.push({
        x,
        z,
        sx: 0.85 + pseudoRand(s * 6.1 + 20) * 0.42,
        sz: 0.75 + pseudoRand(s * 8.3 + 20) * 0.38,
        rot: pseudoRand(s * 10.7 + 20) * Math.PI * 2
      });
    }
    // Extended downstream trail: leading south from spawn (z=14) to Downstream Stone Viewing Bridge (z=54) and outer fern glade
    for (let s = 0; s < 38; s++) {
      const z = 15.0 + s * 0.88;
      const cx = getMistyTrailCenterX(z);
      const lat = (s % 2 === 0 ? -1 : 1) * (0.14 + pseudoRand(s * 3.1 + 50) * 0.24);
      const x = cx + lat;
      if (Math.abs(x - getStreamCenterX(z)) < 5.6) continue;
      stones.push({
        x,
        z,
        sx: 0.86 + pseudoRand(s * 5.3 + 50) * 0.44,
        sz: 0.76 + pseudoRand(s * 7.7 + 50) * 0.38,
        rot: pseudoRand(s * 9.1 + 50) * Math.PI * 2
      });
    }
    for (let s = 0; s < 22; s++) {
      const z = 61.5 + s * 0.92;
      const cx = getStreamCenterX(z) + 7.2 + Math.sin(z * 0.08) * 1.4;
      const lat = (s % 2 === 0 ? 1 : -1) * 0.20;
      const x = cx + lat;
      if (Math.abs(x - getStreamCenterX(z)) < 5.6) continue;
      stones.push({
        x,
        z,
        sx: 0.86 + pseudoRand(s * 6.7 + 90) * 0.40,
        sz: 0.75 + pseudoRand(s * 8.9 + 90) * 0.36,
        rot: pseudoRand(s * 11.3 + 90) * Math.PI * 2
      });
    }

    const mesh = new THREE.InstancedMesh(stoneGeo, stoneMat, stones.length);
    mesh.name = 'InstancedTrailSteppingStones';
    mesh.receiveShadow = true;

    const dummy = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();

    stones.forEach((st, idx) => {
      const y = getMistyForestHeight(st.x, st.z);
      p.set(st.x, y - 0.015, st.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.rot);
      sc.set(st.sx, 1.0, st.sz);
      dummy.compose(p, q, sc);
      mesh.setMatrixAt(idx, dummy);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);

    // Outer Stone Tōrō Trail Lanterns along the deeper woodland trails & glade approaches
    const toroSpots: Array<[number, number]> = [
      [-6.5, 28.0],
      [-5.2, 43.0],
      [11.5, 65.0],
      [16.0, 82.0],
      [-36.5, 45.0],
      [34.5, 42.0],
      [-33.0, -48.0],
      [31.5, -52.0]
    ];
    const toroGraniteParts: THREE.BufferGeometry[] = [];
    const toroCedarParts: THREE.BufferGeometry[] = [];
    const toroRoofParts: THREE.BufferGeometry[] = [];
    const toroGlowParts: THREE.BufferGeometry[] = [];
    const toroGroup = new THREE.Group();
    toroGroup.name = 'OuterTrailToroLanterns';

    for (const [tx, tz] of toroSpots) {
      if (this.isExcludedFromShrine(tx, tz)) continue;
      const ty = getMistyForestHeight(tx, tz) - 0.05;
      const tMat = new THREE.Matrix4().makeTranslation(tx, ty, tz);

      const addT = (arr: THREE.BufferGeometry[], g: THREE.BufferGeometry, lx: number, ly: number, lz: number) => {
        scaleGeometryUvs(g, 0.28, 0.28);
        g.translate(lx, ly, lz);
        arr.push(prepareForMerge(g, tMat, true));
        g.dispose();
      };

      addT(toroGraniteParts, new THREE.CylinderGeometry(0.32, 0.40, 0.22, 6), 0, 0.11, 0);
      addT(toroGraniteParts, new THREE.CylinderGeometry(0.13, 0.16, 0.86, 8), 0, 0.65, 0);
      addT(toroGraniteParts, new THREE.CylinderGeometry(0.28, 0.18, 0.16, 6), 0, 1.16, 0);
      for (let c = 0; c < 4; c++) {
        const ang = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
        addT(toroCedarParts, new THREE.BoxGeometry(0.055, 0.32, 0.055), Math.cos(ang) * 0.16, 1.40, Math.sin(ang) * 0.16);
      }
      addT(toroGlowParts, new THREE.BoxGeometry(0.22, 0.26, 0.22), 0, 1.40, 0);
      addT(toroRoofParts, new THREE.ConeGeometry(0.46, 0.26, 6), 0, 1.69, 0);
      addT(toroRoofParts, new THREE.SphereGeometry(0.08, 8, 6), 0, 1.86, 0);

      const pt = new THREE.PointLight('#ffb15a', 1.15, 9.5, 2.0);
      pt.position.set(tx, ty + 1.45, tz);
      toroGroup.add(pt);
    }

    const toroGraniteMat = new THREE.MeshStandardMaterial({
      color: '#cfd2ce',
      map: graniteCliff.map,
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: graniteCliff.roughnessMap,
      roughness: 0.92,
      aoMap: graniteCliff.aoMap,
      aoMapIntensity: 0.9
    });
    this.applyWorldMossAndDampness(toroGraniteMat, {
      mossAmount: 0.72,
      dampYScale: 0.55,
      wetStreamFactor: 0.20,
      cacheKey: 'misty-outer-toro-granite-v1'
    });
    const toroCedarMat = new THREE.MeshStandardMaterial({
      color: '#5c3c27',
      map: timberBeam.map,
      normalMap: timberBeam.normalMap,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: timberBeam.roughnessMap,
      roughness: 0.88,
      aoMap: timberBeam.aoMap
    });
    const toroRoofMat = new THREE.MeshStandardMaterial({
      color: '#2c3934',
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.44,
      metalness: 0.48
    });
    const toroGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffe8b2',
      emissive: new THREE.Color('#ff9d36'),
      emissiveIntensity: 1.95,
      roughness: 0.32
    });

    if (toroGraniteParts.length > 0) {
      const mG = new THREE.Mesh(mergeGeometries(toroGraniteParts, false)!, toroGraniteMat);
      mG.name = 'OuterToroGranitePosts';
      mG.castShadow = true;
      mG.receiveShadow = true;
      toroGroup.add(mG);

      const mC = new THREE.Mesh(mergeGeometries(toroCedarParts, false)!, toroCedarMat);
      mC.name = 'OuterToroCedarFrames';
      toroGroup.add(mC);

      const mR = new THREE.Mesh(mergeGeometries(toroRoofParts, false)!, toroRoofMat);
      mR.name = 'OuterToroBronzeCaps';
      mR.castShadow = true;
      toroGroup.add(mR);

      const mL = new THREE.Mesh(mergeGeometries(toroGlowParts, false)!, toroGlowMat);
      mL.name = 'OuterToroLanternCores';
      toroGroup.add(mL);
    }
    toroGraniteParts.forEach((g) => g.dispose());
    toroCedarParts.forEach((g) => g.dispose());
    toroRoofParts.forEach((g) => g.dispose());
    toroGlowParts.forEach((g) => g.dispose());
    this.scene.add(toroGroup);
  }

  /**
   * Builds an Ancient Multi-Material Forest Shrine on the western knoll (-26, -12):
   * - 7 chiseled stone steps with flanking cheek curbs ascending the mossy stone terrace
   * - Mossy carved granite Torii plinths (kamebara) & tapered pillars (hashira)
   * - Dark cedar / weathered cypress wood upper Torii lintels (nuki, shimaki, curved kasagi, gakuzuka) & shoji mullions
   * - Patinated dark bronze / slate Hokora shrine roof, kasagi weather-cap & tōrō lantern caps
   * - Pair of carved Stone Tōrō Lanterns & Hokora alcove with warm glowing shoji paper lantern cores + PointLight
   */
  private buildForestShrine(
    stoneMasonry: PbrTextureSet,
    graniteCliff: PbrTextureSet,
    timberBeam: PbrTextureSet
  ): void {
    const sx = -26.0;
    const sz = -12.0;
    const sy = getMistyForestHeight(sx, sz);

    const shrineGroup = new THREE.Group();
    shrineGroup.name = 'AncientForestShrine';
    shrineGroup.position.set(sx, sy, sz);
    shrineGroup.rotation.y = 1.15; // Facing east-southeast toward the trail & footbridge

    const stoneParts: THREE.BufferGeometry[] = [];
    const graniteParts: THREE.BufferGeometry[] = [];
    const cedarParts: THREE.BufferGeometry[] = [];
    const bronzeRoofParts: THREE.BufferGeometry[] = [];
    const lanternGlowParts: THREE.BufferGeometry[] = [];

    const addPart = (
      arr: THREE.BufferGeometry[],
      geo: THREE.BufferGeometry,
      lx: number,
      ly: number,
      lz: number,
      rx = 0,
      ry = 0,
      rz = 0,
      uvScale = 0.35
    ) => {
      scaleGeometryUvs(geo, uvScale, uvScale);
      if (rx !== 0 || ry !== 0 || rz !== 0) {
        geo.rotateX(rx);
        geo.rotateY(ry);
        geo.rotateZ(rz);
      }
      geo.translate(lx, ly, lz);
      arr.push(prepareForMerge(geo, undefined, true));
      geo.dispose();
    };

    // 1. Stone Terrace Platform & 7 Ascending Chiseled Stone Steps (+Z approach)
    addPart(stoneParts, new THREE.BoxGeometry(6.8, 0.72, 6.2), 0, -0.08, -0.8, 0, 0, 0, 0.45);
    addPart(stoneParts, new THREE.BoxGeometry(7.05, 0.14, 6.45), 0, 0.28, -0.8, 0, 0, 0, 0.45);

    for (let s = 0; s < 7; s++) {
      const stepZ = 2.65 + s * 0.68;
      const stepY = 0.16 - s * 0.16;
      const stepW = 2.85 + s * 0.08;
      addPart(stoneParts, new THREE.BoxGeometry(stepW, 0.28, 0.72), 0, stepY, stepZ, 0, 0, 0, 0.3);
      for (const side of [-1, 1]) {
        addPart(stoneParts, new THREE.BoxGeometry(0.28, 0.36, 0.76), side * (stepW * 0.5 + 0.12), stepY + 0.08, stepZ, 0, 0, 0, 0.24);
      }
    }

    // 2. Multi-Material Forest Torii Gate (Mossy Granite Plinths/Pillars + Dark Cedar Lintels + Patinated Bronze Cap)
    const toriiZ = 1.45;
    const pillarSpan = 1.85;
    const pillarH = 4.35;
    for (const side of [-1, 1]) {
      const px = side * pillarSpan;
      // Mossy carved granite octagonal plinth base (kamebara) & collar
      addPart(graniteParts, new THREE.CylinderGeometry(0.42, 0.52, 0.46, 8), px, 0.50, toriiZ, 0, 0, 0, 0.32);
      addPart(graniteParts, new THREE.CylinderGeometry(0.30, 0.38, 0.24, 8), px, 0.80, toriiZ, 0, 0, 0, 0.32);
      // Tapered inward-battered granite column (hashira)
      addPart(graniteParts, new THREE.CylinderGeometry(0.22, 0.28, pillarH - 0.30, 12), px * 0.96, 0.64 + (pillarH - 0.30) * 0.5, toriiZ, 0, 0, side * 0.035, 0.42);
      // Patinated dark bronze weather collar ring where pillar meets lower tie-beam
      addPart(bronzeRoofParts, new THREE.CylinderGeometry(0.245, 0.255, 0.14, 12), px * 0.95, 3.82, toriiZ, 0, 0, side * 0.035, 0.28);
    }

    // Dark cedar / weathered cypress lower tie-beam (nuki) with timber wedges (kusabi)
    addPart(cedarParts, new THREE.BoxGeometry(4.85, 0.24, 0.28), 0, 3.82, toriiZ, 0, 0, 0, 0.36);
    for (const side of [-1, 1]) {
      addPart(cedarParts, new THREE.BoxGeometry(0.16, 0.36, 0.34), side * pillarSpan * 0.95, 3.82, toriiZ, 0, 0, 0, 0.25);
    }
    // Dark cedar upper sub-lintel (shimaki) + central cedar tablet (gakuzuka) with bronze plaque frame
    addPart(cedarParts, new THREE.BoxGeometry(5.35, 0.26, 0.38), 0, 4.74, toriiZ, 0, 0, 0, 0.38);
    addPart(cedarParts, new THREE.BoxGeometry(0.48, 0.78, 0.26), 0, 4.26, toriiZ, 0, 0, 0, 0.28);
    addPart(bronzeRoofParts, new THREE.BoxGeometry(0.32, 0.56, 0.30), 0, 4.26, toriiZ, 0, 0, 0, 0.28);
    // Segmented curved upturned cedar top lintel (kasagi) + patinated dark bronze weather roof cap
    for (let k = -2; k <= 2; k++) {
      const kx = k * 1.12;
      const ky = 5.02 + Math.abs(k) * Math.abs(k) * 0.045;
      const kTilt = k * 0.055;
      addPart(cedarParts, new THREE.BoxGeometry(1.18, 0.20, 0.46), kx, ky, toriiZ, 0, 0, kTilt, 0.34);
      addPart(bronzeRoofParts, new THREE.BoxGeometry(1.22, 0.08, 0.54), kx, ky + 0.13, toriiZ, 0, 0, kTilt, 0.34);
    }

    // 3. Pair of Carved Stone Tōrō Lanterns flanking the shrine terrace (bronze caps + glowing shoji paper cores)
    for (const side of [-1, 1]) {
      const lx = side * 2.45;
      const lz = 0.05;
      addPart(graniteParts, new THREE.CylinderGeometry(0.34, 0.42, 0.24, 6), lx, 0.44, lz, 0, 0, 0, 0.28);
      addPart(graniteParts, new THREE.CylinderGeometry(0.14, 0.17, 0.92, 8), lx, 1.02, lz, 0, 0, 0, 0.30);
      addPart(graniteParts, new THREE.CylinderGeometry(0.30, 0.20, 0.18, 6), lx, 1.56, lz, 0, 0, 0, 0.28);
      // Corner mullions & delicate shoji lattice around firebox (hibukuro)
      for (let c = 0; c < 4; c++) {
        const ang = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
        addPart(cedarParts, new THREE.BoxGeometry(0.06, 0.34, 0.06), lx + Math.cos(ang) * 0.17, 1.82, lz + Math.sin(ang) * 0.17, 0, 0, 0, 0.2);
      }
      // Glowing warm shoji paper lantern core
      addPart(lanternGlowParts, new THREE.BoxGeometry(0.24, 0.28, 0.24), lx, 1.82, lz, 0, 0, 0, 1.0);
      // Patinated dark bronze lantern pagoda roof (kasa) & finial (hōju)
      addPart(bronzeRoofParts, new THREE.ConeGeometry(0.48, 0.28, 6), lx, 2.12, lz, 0, 0, 0, 0.32);
      addPart(bronzeRoofParts, new THREE.SphereGeometry(0.09, 8, 6), lx, 2.30, lz, 0, 0, 0, 0.2);
    }

    const shrineLight = new THREE.PointLight('#ffb15a', 2.1, 14.0, 2.0);
    shrineLight.position.set(0, 2.1, -0.3);
    shrineGroup.add(shrineLight);

    // 4. Mossy Carved Granite & Stone Hokora Shrine Sanctuary at rear of terrace (z = -2.25)
    //    with dark cedar framing, patinated dark bronze/slate pitched roof & glowing shoji core
    const hz = -2.25;
    addPart(graniteParts, new THREE.BoxGeometry(1.85, 0.38, 1.65), 0, 0.52, hz, 0, 0, 0, 0.35);
    addPart(stoneParts, new THREE.BoxGeometry(1.28, 1.15, 1.12), 0, 1.28, hz, 0, 0, 0, 0.38);
    // Dark cedar alcove frame & shoji grid mullions over glowing shoji paper core
    addPart(cedarParts, new THREE.BoxGeometry(0.56, 0.64, 0.10), 0, 1.24, hz + 0.54, 0, 0, 0, 0.25);
    addPart(lanternGlowParts, new THREE.BoxGeometry(0.42, 0.52, 0.12), 0, 1.24, hz + 0.55, 0, 0, 0, 1.0);
    addPart(cedarParts, new THREE.BoxGeometry(0.032, 0.52, 0.04), 0, 1.24, hz + 0.61, 0, 0, 0, 0.2);
    addPart(cedarParts, new THREE.BoxGeometry(0.42, 0.032, 0.04), 0, 1.24, hz + 0.61, 0, 0, 0, 0.2);
    addPart(cedarParts, new THREE.BoxGeometry(0.42, 0.028, 0.04), 0, 1.38, hz + 0.61, 0, 0, 0, 0.2);
    // Patinated dark bronze / slate pitched shrine roof + ridge beam & ornamental katsuogi logs
    addPart(bronzeRoofParts, new THREE.BoxGeometry(1.04, 0.22, 1.66), -0.48, 2.08, hz, 0, 0, 0.52, 0.36);
    addPart(bronzeRoofParts, new THREE.BoxGeometry(1.04, 0.22, 1.66), 0.48, 2.08, hz, 0, 0, -0.52, 0.36);
    addPart(bronzeRoofParts, new THREE.BoxGeometry(0.24, 0.18, 1.76), 0, 2.36, hz, 0, 0, 0, 0.30);
    for (const kz of [-0.42, 0.0, 0.42]) {
      addPart(bronzeRoofParts, new THREE.CylinderGeometry(0.065, 0.065, 0.44, 8), 0, 2.48, hz + kz, 0, 0, Math.PI * 0.5, 0.25);
    }

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneMasonry.map,
      normalMap: stoneMasonry.normalMap,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: stoneMasonry.roughnessMap,
      roughness: 1.0,
      aoMap: stoneMasonry.aoMap,
      aoMapIntensity: 0.9
    });
    this.applyWorldMossAndDampness(stoneMat, {
      mossAmount: 0.72,
      dampYScale: 0.45,
      wetStreamFactor: 0.15,
      cacheKey: 'misty-shrine-stone-v1'
    });
    applyWorldSpaceWeathering(stoneMat, {
      macroScale: 0.32,
      mossHeight: sy + 1.2,
      mossColor: '#2c6022',
      dampRoughness: 0.38,
      dirtTint: '#363026'
    });

    const graniteMat = new THREE.MeshStandardMaterial({
      color: '#cfd2ce',
      map: graniteCliff.map,
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(1.58, 1.58),
      roughnessMap: graniteCliff.roughnessMap,
      roughness: 0.92,
      aoMap: graniteCliff.aoMap,
      aoMapIntensity: 0.92
    });
    this.applyWorldMossAndDampness(graniteMat, {
      mossAmount: 0.68,
      dampYScale: 0.42,
      wetStreamFactor: 0.12,
      cacheKey: 'misty-shrine-granite-v2'
    });
    applyWorldSpaceWeathering(graniteMat, {
      macroScale: 0.28,
      mossHeight: sy + 1.8,
      mossColor: '#2b5e20',
      dampRoughness: 0.42,
      dirtTint: '#363026'
    });

    const cedarMat = new THREE.MeshStandardMaterial({
      color: '#5c3c27',
      map: timberBeam.map,
      normalMap: timberBeam.normalMap,
      normalScale: new THREE.Vector2(1.42, 1.42),
      roughnessMap: timberBeam.roughnessMap,
      roughness: 0.88,
      aoMap: timberBeam.aoMap,
      aoMapIntensity: 0.92
    });
    this.applyWorldMossAndDampness(cedarMat, {
      mossAmount: 0.28,
      dampYScale: 0.25,
      wetStreamFactor: 0.0,
      cacheKey: 'misty-shrine-cedar-v1'
    });
    applyWorldSpaceWeathering(cedarMat, {
      macroScale: 0.34,
      mossHeight: sy + 1.4,
      mossColor: '#2e5822',
      dampRoughness: 0.48,
      dirtTint: '#2c1e14'
    });

    const bronzeRoofMat = new THREE.MeshStandardMaterial({
      color: '#2c3934',
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.44,
      metalness: 0.48,
      aoMap: graniteCliff.aoMap,
      aoMapIntensity: 0.85
    });
    this.applyWorldMossAndDampness(bronzeRoofMat, {
      mossAmount: 0.34,
      dampYScale: 0.25,
      wetStreamFactor: 0.0,
      cacheKey: 'misty-shrine-bronze-v1'
    });
    applyWorldSpaceWeathering(bronzeRoofMat, {
      macroScale: 0.38,
      mossHeight: sy + 2.5,
      mossColor: '#36643a',
      dampRoughness: 0.36,
      dirtTint: '#1f2824'
    });

    const stoneMesh = new THREE.Mesh(mergeGeometries(stoneParts, false)!, stoneMat);
    stoneMesh.name = 'ForestShrineTerrace';
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    stoneParts.forEach((g) => g.dispose());
    shrineGroup.add(stoneMesh);

    const graniteMesh = new THREE.Mesh(mergeGeometries(graniteParts, false)!, graniteMat);
    graniteMesh.name = 'ForestShrineGraniteBase';
    graniteMesh.castShadow = true;
    graniteMesh.receiveShadow = true;
    graniteParts.forEach((g) => g.dispose());
    shrineGroup.add(graniteMesh);

    const cedarMesh = new THREE.Mesh(mergeGeometries(cedarParts, false)!, cedarMat);
    cedarMesh.name = 'ForestShrineToriiCedar';
    cedarMesh.castShadow = true;
    cedarMesh.receiveShadow = true;
    cedarParts.forEach((g) => g.dispose());
    shrineGroup.add(cedarMesh);

    const bronzeRoofMesh = new THREE.Mesh(mergeGeometries(bronzeRoofParts, false)!, bronzeRoofMat);
    bronzeRoofMesh.name = 'ForestShrineBronzeRoof';
    bronzeRoofMesh.castShadow = true;
    bronzeRoofMesh.receiveShadow = true;
    bronzeRoofParts.forEach((g) => g.dispose());
    shrineGroup.add(bronzeRoofMesh);

    const glowMesh = new THREE.Mesh(
      mergeGeometries(lanternGlowParts, false)!,
      new THREE.MeshStandardMaterial({
        color: '#ffe8b2',
        emissive: new THREE.Color('#ff9d36'),
        emissiveIntensity: 2.05,
        roughness: 0.32
      })
    );
    glowMesh.name = 'ForestShrineLanterns';
    lanternGlowParts.forEach((g) => g.dispose());
    shrineGroup.add(glowMesh);

    this.scene.add(shrineGroup);
  }

  /**
   * Builds a Timber Watchtower / Ranger Cabin with warm recessed paned windows on the eastern ridge (28, -18):
   * - Stone masonry foundation piers anchored into the ridge slope
   * - Heavy timber-framed ranger cabin + elevated observation lookout deck with wooden steps & railings
   * - Steep pitched timber-shingle gable roof, stone chimney & warm glowing windows with 3D muntin bars
   */
  private buildRangerWatchtower(
    timberBeam: PbrTextureSet,
    stoneMasonry: PbrTextureSet,
    graniteCliff: PbrTextureSet
  ): void {
    const wx = 28.0;
    const wz = -18.0;
    const wy = getMistyForestHeight(wx, wz);

    const towerGroup = new THREE.Group();
    towerGroup.name = 'EasternRangerWatchtower';
    towerGroup.position.set(wx, wy, wz);
    towerGroup.rotation.y = -0.78; // Oriented toward the stream, footbridge & western shrine

    const stoneParts: THREE.BufferGeometry[] = [];
    const timberParts: THREE.BufferGeometry[] = [];
    const roofParts: THREE.BufferGeometry[] = [];
    const windowParts: THREE.BufferGeometry[] = [];

    const addPart = (
      arr: THREE.BufferGeometry[],
      geo: THREE.BufferGeometry,
      lx: number,
      ly: number,
      lz: number,
      rx = 0,
      ry = 0,
      rz = 0,
      uvScaleU = 0.5,
      uvScaleV = 0.5
    ) => {
      scaleGeometryUvs(geo, uvScaleU, uvScaleV);
      if (rx !== 0 || ry !== 0 || rz !== 0) {
        geo.rotateX(rx);
        geo.rotateY(ry);
        geo.rotateZ(rz);
      }
      geo.translate(lx, ly, lz);
      arr.push(prepareForMerge(geo, undefined, true));
      geo.dispose();
    };

    // 1. Stone Masonry Foundation Piers & Exterior Stone Chimney
    const deckW = 5.4;
    const deckD = 5.0;
    for (const px of [-deckW * 0.44, 0, deckW * 0.44]) {
      for (const pz of [-deckD * 0.44, deckD * 0.44]) {
        addPart(stoneParts, new THREE.BoxGeometry(0.68, 1.65, 0.68), px, 0.25, pz, 0, 0, 0, 0.35, 0.35);
      }
    }
    // Tall stone chimney stack on +X side
    addPart(stoneParts, new THREE.BoxGeometry(0.88, 7.6, 0.88), 2.15, 3.6, -0.6, 0, 0, 0, 0.4, 1.2);
    addPart(stoneParts, new THREE.BoxGeometry(1.04, 0.20, 1.04), 2.15, 7.45, -0.6, 0, 0, 0, 0.35, 0.35);

    // 2. Elevated Timber Porch Deck (y = 1.05m) & Exterior Wooden Steps (+Z)
    const deckY = 1.05;
    addPart(timberParts, new THREE.BoxGeometry(deckW, 0.22, deckD), 0, deckY, 0, 0, 0, 0, 1.4, 1.4);
    for (let s = 0; s < 5; s++) {
      addPart(timberParts, new THREE.BoxGeometry(1.65, 0.16, 0.42), 0, deckY - 0.16 - s * 0.20, deckD * 0.5 + 0.24 + s * 0.38, 0, 0, 0, 0.8, 0.4);
    }

    // Porch & Upper Lookout Deck Railings
    const addRailingRun = (x0: number, z0: number, x1: number, z1: number, baseY: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      const midX = (x0 + x1) * 0.5;
      const midZ = (z0 + z1) * 0.5;
      addPart(timberParts, new THREE.BoxGeometry(0.09, 0.08, len), midX, baseY + 0.88, midZ, 0, yaw, 0, 1.2, 0.2);
      addPart(timberParts, new THREE.BoxGeometry(0.07, 0.06, len), midX, baseY + 0.46, midZ, 0, yaw, 0, 1.2, 0.2);
    };

    // Lower porch posts & railings (leaving center stairs open)
    for (const px of [-deckW * 0.46, -0.85, 0.85, deckW * 0.46]) {
      addPart(timberParts, new THREE.BoxGeometry(0.14, 0.96, 0.14), px, deckY + 0.52, deckD * 0.46, 0, 0, 0, 0.4, 0.9);
    }
    addRailingRun(-deckW * 0.46, deckD * 0.46, -0.85, deckD * 0.46, deckY);
    addRailingRun(0.85, deckD * 0.46, deckW * 0.46, deckD * 0.46, deckY);
    addRailingRun(-deckW * 0.46, -deckD * 0.46, -deckW * 0.46, deckD * 0.46, deckY);
    addRailingRun(deckW * 0.46, -deckD * 0.46, deckW * 0.46, deckD * 0.46, deckY);

    // 3. Main Ranger Cabin Body (3.8m x 3.6m, height 2.55m) + Upper Watchtower Observation Deck (y = 3.7m)
    const cabW = 3.8;
    const cabD = 3.6;
    const cabH = 2.55;
    const cabZ = -0.35;
    addPart(timberParts, new THREE.BoxGeometry(cabW, cabH, cabD), 0, deckY + cabH * 0.5 + 0.08, cabZ, 0, 0, 0, 1.8, 1.4);

    // Upper Watchtower Observation Platform + 4 Corner Watchtower Posts
    const upperY = deckY + cabH + 0.18;
    const upperW = 4.5;
    const upperD = 4.3;
    addPart(timberParts, new THREE.BoxGeometry(upperW, 0.20, upperD), 0, upperY, cabZ, 0, 0, 0, 1.4, 1.4);

    for (const px of [-upperW * 0.45, upperW * 0.45]) {
      for (const pz of [cabZ - upperD * 0.45, cabZ + upperD * 0.45]) {
        addPart(timberParts, new THREE.BoxGeometry(0.16, 2.15, 0.16), px, upperY + 1.05, pz, 0, 0, 0, 0.4, 1.4);
      }
    }
    addRailingRun(-upperW * 0.45, cabZ + upperD * 0.45, upperW * 0.45, cabZ + upperD * 0.45, upperY);
    addRailingRun(-upperW * 0.45, cabZ - upperD * 0.45, upperW * 0.45, cabZ - upperD * 0.45, upperY);
    addRailingRun(-upperW * 0.45, cabZ - upperD * 0.45, -upperW * 0.45, cabZ + upperD * 0.45, upperY);
    addRailingRun(upperW * 0.45, cabZ - upperD * 0.45, upperW * 0.45, cabZ + upperD * 0.45, upperY);

    // Upper lookout glass-walled watchroom core (2.6m x 2.5m) with warm beacon glow
    addPart(timberParts, new THREE.BoxGeometry(2.6, 1.55, 2.5), 0, upperY + 0.85, cabZ, 0, 0, 0, 1.2, 1.0);

    // 4. Steep Pitched Watchtower Gable Roof
    const roofBaseY = upperY + 1.85;
    const roofRise = 1.45;
    const slopeLen = Math.hypot(upperW * 0.56, roofRise);
    const roofAngle = Math.atan2(roofRise, upperW * 0.56);
    addPart(roofParts, new THREE.BoxGeometry(slopeLen, 0.16, upperD + 0.85), -upperW * 0.27, roofBaseY + roofRise * 0.45, cabZ, 0, 0, roofAngle, 1.8, 1.8);
    addPart(roofParts, new THREE.BoxGeometry(slopeLen, 0.16, upperD + 0.85), upperW * 0.27, roofBaseY + roofRise * 0.45, cabZ, 0, 0, -roofAngle, 1.8, 1.8);
    addPart(timberParts, new THREE.BoxGeometry(0.20, 0.22, upperD + 0.95), 0, roofBaseY + roofRise - 0.04, cabZ, 0, 0, 0, 0.4, 1.4);

    // 5. Recessed Warm Glowing Windows with 3D Timber Muntin Bars & Sills
    const addCabinWindow = (lx: number, ly: number, lz: number, rotY: number, winW = 0.88, winH = 0.84) => {
      const winMat = new THREE.Matrix4().compose(
        new THREE.Vector3(lx, ly, lz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      const pushW = (arr: THREE.BufferGeometry[], g: THREE.BufferGeometry, tx: number, ty: number, tz: number) => {
        g.translate(tx, ty, tz);
        arr.push(prepareForMerge(g, winMat, true));
        g.dispose();
      };
      pushW(windowParts, new THREE.BoxGeometry(winW, winH, 0.06), 0, 0, 0.02);
      pushW(timberParts, new THREE.BoxGeometry(winW + 0.14, 0.09, 0.12), 0, winH * 0.52, 0.05);
      pushW(timberParts, new THREE.BoxGeometry(0.09, winH + 0.08, 0.12), -winW * 0.52, 0, 0.05);
      pushW(timberParts, new THREE.BoxGeometry(0.09, winH + 0.08, 0.12), winW * 0.52, 0, 0.05);
      pushW(timberParts, new THREE.BoxGeometry(0.045, winH, 0.09), 0, 0, 0.06);
      pushW(timberParts, new THREE.BoxGeometry(winW, 0.045, 0.09), 0, 0.02, 0.06);
      pushW(stoneParts, new THREE.BoxGeometry(winW + 0.22, 0.10, 0.18), 0, -winH * 0.54, 0.07);
    };

    // Lower cabin windows
    addCabinWindow(-1.05, deckY + 1.48, cabZ + cabD * 0.5 + 0.02, 0);
    addCabinWindow(1.05, deckY + 1.48, cabZ + cabD * 0.5 + 0.02, 0);
    addCabinWindow(-cabW * 0.5 - 0.02, deckY + 1.48, cabZ, -Math.PI * 0.5);
    addCabinWindow(0, deckY + 1.48, cabZ - cabD * 0.5 - 0.02, Math.PI);
    // Upper lookout observation windows on all 4 faces
    addCabinWindow(0, upperY + 0.96, cabZ + 1.27, 0, 1.35, 0.72);
    addCabinWindow(-1.32, upperY + 0.96, cabZ, -Math.PI * 0.5, 1.35, 0.72);
    addCabinWindow(1.32, upperY + 0.96, cabZ, Math.PI * 0.5, 1.35, 0.72);
    addCabinWindow(0, upperY + 0.96, cabZ - 1.27, Math.PI, 1.35, 0.72);

    const cabinLight = new THREE.PointLight('#ffad4d', 2.4, 16.0, 1.8);
    cabinLight.position.set(0, deckY + 1.65, cabZ + cabD * 0.5 + 0.8);
    towerGroup.add(cabinLight);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneMasonry.map,
      normalMap: stoneMasonry.normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: stoneMasonry.roughnessMap,
      roughness: 1.0,
      aoMap: stoneMasonry.aoMap
    });
    applyWorldSpaceWeathering(stoneMat, {
      macroScale: 0.30,
      mossHeight: wy + 0.9,
      mossColor: '#2d5c22',
      dampRoughness: 0.38,
      dirtTint: '#3a3228'
    });

    const timberMat = new THREE.MeshStandardMaterial({
      map: timberBeam.map,
      normalMap: timberBeam.normalMap,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: timberBeam.roughnessMap,
      roughness: 1.0,
      aoMap: timberBeam.aoMap
    });
    applyWorldSpaceWeathering(timberMat, {
      macroScale: 0.28,
      mossHeight: wy + 1.2,
      mossColor: '#315e24',
      dampRoughness: 0.45,
      dirtTint: '#382c20'
    });

    const roofMat = new THREE.MeshStandardMaterial({
      map: graniteCliff.map,
      normalMap: graniteCliff.normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: graniteCliff.roughnessMap,
      color: '#5a5048',
      roughness: 0.88
    });
    applyWorldSpaceWeathering(roofMat, {
      macroScale: 0.35,
      mossHeight: wy + 6.5,
      mossColor: '#345e24',
      dampRoughness: 0.52,
      dirtTint: '#362e26'
    });

    const windowMat = new THREE.MeshStandardMaterial({
      color: '#ffe39c',
      emissive: new THREE.Color('#ffaa38'),
      emissiveIntensity: 1.85,
      roughness: 0.22,
      metalness: 0.15
    });

    const stoneMesh = new THREE.Mesh(mergeGeometries(stoneParts, false)!, stoneMat);
    stoneMesh.name = 'WatchtowerStoneBase';
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    stoneParts.forEach((g) => g.dispose());
    towerGroup.add(stoneMesh);

    const timberMesh = new THREE.Mesh(mergeGeometries(timberParts, false)!, timberMat);
    timberMesh.name = 'WatchtowerTimber';
    timberMesh.castShadow = true;
    timberMesh.receiveShadow = true;
    timberParts.forEach((g) => g.dispose());
    towerGroup.add(timberMesh);

    const roofMesh = new THREE.Mesh(mergeGeometries(roofParts, false)!, roofMat);
    roofMesh.name = 'WatchtowerRoof';
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofParts.forEach((g) => g.dispose());
    towerGroup.add(roofMesh);

    const winMesh = new THREE.Mesh(mergeGeometries(windowParts, false)!, windowMat);
    winMesh.name = 'WatchtowerGlowWindows';
    windowParts.forEach((g) => g.dispose());
    towerGroup.add(winMesh);

    this.scene.add(towerGroup);
  }

  private buildSunbeams(sunDir: THREE.Vector3): void {
    const up = new THREE.Vector3(0, 1, 0);
    const beamQuat = new THREE.Quaternion().setFromUnitVectors(up, sunDir);

    this.sunbeamMaterial = createSunbeamMaterial();
    const group = new THREE.Group();
    group.name = 'MorningSunbeams';

    const beamSpecs = [
      { x: -1.5, z: -2.0, rTop: 1.0, rBot: 3.1, len: 34 },
      { x: 2.2, z: -10.0, rTop: 1.2, rBot: 3.5, len: 36 },
      { x: -7.5, z: -18.0, rTop: 1.1, rBot: 3.3, len: 35 },
      { x: 5.5, z: -28.0, rTop: 1.4, rBot: 3.9, len: 38 },
      { x: -4.0, z: -40.0, rTop: 1.6, rBot: 4.3, len: 40 },
      { x: -1.5, z: -56.0, rTop: 1.9, rBot: 4.8, len: 42 },
      { x: -10.0, z: 6.0, rTop: 1.1, rBot: 3.2, len: 34 },
      { x: 8.5, z: 4.0, rTop: 1.2, rBot: 3.4, len: 35 },
      { x: -20.0, z: -9.5, rTop: 1.3, rBot: 3.6, len: 36 },
      { x: 18.0, z: -15.0, rTop: 1.3, rBot: 3.7, len: 36 },
      // Outer sunlit glade & downstream bridge shafts
      { x: -46.0, z: 52.0, rTop: 1.7, rBot: 4.4, len: 40 },
      { x: 44.0, z: 48.0, rTop: 1.7, rBot: 4.4, len: 40 },
      { x: -42.0, z: -56.0, rTop: 1.8, rBot: 4.6, len: 42 },
      { x: 2.0, z: 54.0, rTop: 1.5, rBot: 4.0, len: 38 }
    ];

    beamSpecs.forEach((spec, idx) => {
      // Nested outer soft glow shaft + inner bright crepuscular core shaft
      const outerGeo = new THREE.CylinderGeometry(spec.rTop, spec.rBot, spec.len, 18, 1, true);
      const outerMesh = new THREE.Mesh(outerGeo, this.sunbeamMaterial!);
      outerMesh.name = `MorningSunbeam_${idx + 1}`;
      const groundY = getMistyForestHeight(spec.x, spec.z);
      outerMesh.quaternion.copy(beamQuat);
      outerMesh.position
        .set(spec.x, groundY + 0.6, spec.z)
        .addScaledVector(sunDir, spec.len * 0.44);
      group.add(outerMesh);

      const innerGeo = new THREE.CylinderGeometry(spec.rTop * 0.48, spec.rBot * 0.48, spec.len * 0.96, 14, 1, true);
      const innerMesh = new THREE.Mesh(innerGeo, this.sunbeamMaterial!);
      innerMesh.name = `MorningSunbeamCore_${idx + 1}`;
      innerMesh.quaternion.copy(beamQuat);
      innerMesh.position.copy(outerMesh.position);
      group.add(innerMesh);
    });

    this.scene.add(group);
  }

  private createSoaringBirdGeometry(): THREE.BufferGeometry {
    const positions = new Float32Array([
       0.0,  0.02,  0.36,
      -0.06, 0.0,   0.04,
       0.06, 0.0,   0.04,
       0.0,  0.0,  -0.38,
      -0.11, 0.01, -0.44,
       0.11, 0.01, -0.44,

      -0.05, 0.01,  0.10,
      -0.46, 0.05,  0.02,
      -0.44, 0.03, -0.12,
      -0.05, 0.0,  -0.08,

      -0.46, 0.05,  0.02,
      -0.94, 0.09, -0.16,
      -0.82, 0.05, -0.25,
      -0.44, 0.03, -0.12,

       0.05, 0.01,  0.10,
       0.46, 0.05,  0.02,
       0.44, 0.03, -0.12,
       0.05, 0.0,  -0.08,

       0.46, 0.05,  0.02,
       0.94, 0.09, -0.16,
       0.82, 0.05, -0.25,
       0.44, 0.03, -0.12
    ]);

    const indices = [
      0, 1, 2, 1, 3, 2,
      1, 4, 3, 2, 3, 5,
      6, 7, 8, 6, 8, 9,
      10, 11, 12, 10, 12, 13,
      14, 16, 15, 14, 17, 16,
      18, 20, 19, 18, 21, 20
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildSoaringBirds(sunDir: THREE.Vector3): void {
    const count = 42;
    const birdGeo = this.createSoaringBirdGeometry();
    this.birdMaterial = createBirdFlockMaterial({ sunDirection: sunDir });

    this.birdsMesh = new THREE.InstancedMesh(birdGeo, this.birdMaterial, count);
    this.birdsMesh.name = 'InstancedSoaringBirds';
    this.birdOrbits = [];

    for (let i = 0; i < count; i++) {
      const isStreamGlider = i < 12;
      const clusterAngle = (i / count) * Math.PI * 2;
      const dist = isStreamGlider ? 6.0 + pseudoRand(i * 2.17) * 18.0 : 16.0 + pseudoRand(i * 2.17) * 68.0;
      this.birdOrbits.push({
        centerX: isStreamGlider ? getStreamCenterX(-18 + i * 5) : Math.cos(clusterAngle) * dist,
        centerZ: isStreamGlider ? -28.0 + (i % 6) * 12.0 : Math.sin(clusterAngle) * dist - 14.0,
        radius: isStreamGlider ? 9.0 + pseudoRand(i * 4.31) * 10.0 : 16.0 + pseudoRand(i * 4.31) * 24.0,
        altitude: isStreamGlider ? 8.5 + pseudoRand(i * 6.59) * 6.5 : 22.0 + pseudoRand(i * 6.59) * 15.0,
        angularSpeed: (isStreamGlider ? 0.14 : 0.068 + pseudoRand(i * 8.13) * 0.055) * (i % 2 === 0 ? 1 : -1),
        phase: pseudoRand(i * 9.77) * Math.PI * 2,
        scale: isStreamGlider ? 0.62 + pseudoRand(i * 11.4) * 0.34 : 0.95 + pseudoRand(i * 11.4) * 0.65,
        bobAmp: isStreamGlider ? 0.45 + pseudoRand(i * 13.2) * 0.5 : 0.7 + pseudoRand(i * 13.2) * 0.9
      });
    }

    this.updateBirdPositions(0);
    this.scene.add(this.birdsMesh);
  }

  private updateBirdPositions(elapsedTime: number): void {
    if (!this.birdsMesh || this.birdOrbits.length === 0) return;

    for (let i = 0; i < this.birdOrbits.length; i++) {
      const b = this.birdOrbits[i];
      const angle = b.phase + elapsedTime * b.angularSpeed;
      const x = b.centerX + Math.cos(angle) * b.radius;
      const z = b.centerZ + Math.sin(angle) * b.radius;
      const y = b.altitude + Math.sin(elapsedTime * 0.45 + b.phase) * b.bobAmp;

      const dirSign = b.angularSpeed >= 0 ? 1 : -1;
      const tx = -Math.sin(angle) * dirSign;
      const tz = Math.cos(angle) * dirSign;
      const yaw = Math.atan2(tx, tz);
      const bank = -0.18 * dirSign;

      this.tmpPos.set(x, y, z);
      this.tmpEuler.set(0.03 * Math.cos(elapsedTime * 0.45 + b.phase), yaw, bank);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.setScalar(b.scale);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.birdsMesh.setMatrixAt(i, this.tmpMatrix);
    }

    this.birdsMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Builds sculpted leaping brook trout (`InstancedStreamTrout`) and synchronized expanding
   * concentric water ripple rings (`InstancedStreamTroutRipples`) along the mountain stream.
   */
  private buildStreamTroutAndRipples(sunDir: THREE.Vector3): void {
    // Sculpted fusiform brook trout geometry oriented along +Z (nose at +Z, forked tail at -Z)
    const fishSections: Array<{ z: number; rx: number; ry: number; color: [number, number, number] }> = [
      { z: 0.24, rx: 0.008, ry: 0.012, color: [0.36, 0.44, 0.40] },
      { z: 0.16, rx: 0.038, ry: 0.052, color: [0.42, 0.54, 0.48] },
      { z: 0.04, rx: 0.056, ry: 0.074, color: [0.58, 0.68, 0.64] },
      { z: -0.08, rx: 0.044, ry: 0.060, color: [0.64, 0.62, 0.56] },
      { z: -0.20, rx: 0.018, ry: 0.030, color: [0.44, 0.48, 0.46] },
      { z: -0.30, rx: 0.006, ry: 0.068, color: [0.32, 0.36, 0.34] }
    ];
    const radialSegs = 8;
    const fPos: number[] = [];
    const fCol: number[] = [];
    const fIdx: number[] = [];

    for (let s = 0; s < fishSections.length; s++) {
      const sec = fishSections[s];
      for (let j = 0; j < radialSegs; j++) {
        const ang = (j / radialSegs) * Math.PI * 2;
        const x = Math.cos(ang) * sec.rx;
        const y = Math.sin(ang) * sec.ry;
        fPos.push(x, y, sec.z);
        // Silver-salmon belly below, olive-iridescent back above
        const bellyT = y < 0 ? 1.0 : 0.0;
        fCol.push(
          sec.color[0] * (1.0 - bellyT * 0.15) + bellyT * 0.25,
          sec.color[1] * (1.0 - bellyT * 0.1) + bellyT * 0.22,
          sec.color[2] + bellyT * 0.20
        );
      }
    }
    for (let s = 0; s < fishSections.length - 1; s++) {
      const r0 = s * radialSegs;
      const r1 = (s + 1) * radialSegs;
      for (let j = 0; j < radialSegs; j++) {
        const jn = (j + 1) % radialSegs;
        fIdx.push(r0 + j, r1 + j, r1 + jn, r0 + j, r1 + jn, r0 + jn);
      }
    }
    const troutGeo = new THREE.BufferGeometry();
    troutGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
    troutGeo.setAttribute('color', new THREE.Float32BufferAttribute(fCol, 3));
    troutGeo.setIndex(fIdx);
    troutGeo.computeVertexNormals();

    this.troutMaterial = createTroutMaterial({ sunDirection: sunDir });

    const spots = [
      { z: 2.0, xOff: -0.8, period: 4.4, phase: 0.06, arcH: 0.72, arcS: 1.45, yaw: 0.45, scale: 1.15 },
      { z: -13.5, xOff: 0.9, period: 4.8, phase: 0.14, arcH: 0.78, arcS: 1.55, yaw: -0.60, scale: 1.20 },
      { z: -20.5, xOff: -1.1, period: 5.2, phase: 0.42, arcH: 0.68, arcS: 1.35, yaw: 0.85, scale: 1.05 },
      { z: -32.5, xOff: 1.2, period: 4.6, phase: 0.68, arcH: 0.74, arcS: 1.40, yaw: -0.35, scale: 1.10 },
      { z: -44.0, xOff: -0.6, period: 5.6, phase: 0.25, arcH: 0.80, arcS: 1.50, yaw: 0.30, scale: 1.25 },
      { z: 12.0, xOff: 0.7, period: 5.0, phase: 0.55, arcH: 0.66, arcS: 1.30, yaw: -0.95, scale: 1.05 },
      { z: 28.0, xOff: -0.9, period: 4.9, phase: 0.82, arcH: 0.70, arcS: 1.40, yaw: 0.70, scale: 1.12 },
      { z: 43.0, xOff: 0.5, period: 5.4, phase: 0.33, arcH: 0.75, arcS: 1.48, yaw: -0.50, scale: 1.18 }
    ];

    this.troutJumpSpecs = spots.map((sp) => ({
      x: getStreamCenterX(sp.z) + sp.xOff,
      z: sp.z,
      waterY: this.getStreamWaterY(sp.z),
      period: sp.period,
      phase: sp.phase,
      arcHeight: sp.arcH,
      arcSpan: sp.arcS,
      yaw: sp.yaw,
      scale: sp.scale
    }));

    this.troutMesh = new THREE.InstancedMesh(troutGeo, this.troutMaterial, this.troutJumpSpecs.length);
    this.troutMesh.name = 'InstancedStreamTrout';
    this.troutMesh.castShadow = true;

    const rippleGeo = new THREE.PlaneGeometry(2.6, 2.6);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleCount = this.troutJumpSpecs.length * 2;
    const rippleAges = new Float32Array(rippleCount);
    this.troutRippleAgeAttr = new THREE.InstancedBufferAttribute(rippleAges, 1);
    rippleGeo.setAttribute('aRippleAge', this.troutRippleAgeAttr);

    this.troutRippleMaterial = createTroutRippleMaterial();
    this.troutRippleMesh = new THREE.InstancedMesh(rippleGeo, this.troutRippleMaterial, rippleCount);
    this.troutRippleMesh.name = 'InstancedStreamTroutRipples';

    this.updateStreamTrout(0);
    this.scene.add(this.troutMesh);
    this.scene.add(this.troutRippleMesh);
  }

  private updateStreamTrout(elapsedTime: number): void {
    if (!this.troutMesh || !this.troutRippleMesh || !this.troutRippleAgeAttr || this.troutJumpSpecs.length === 0) {
      return;
    }

    const leapFrac = 0.24;
    for (let i = 0; i < this.troutJumpSpecs.length; i++) {
      const sp = this.troutJumpSpecs[i];
      const rawCycle = (elapsedTime / sp.period + sp.phase) % 1.0;
      const cycle = rawCycle < 0 ? rawCycle + 1.0 : rawCycle;

      const sinY = Math.sin(sp.yaw);
      const cosY = Math.cos(sp.yaw);

      if (cycle <= leapFrac) {
        const u = cycle / leapFrac;
        const arcY = 4.0 * u * (1.0 - u) * sp.arcHeight;
        const fwd = (u - 0.5) * sp.arcSpan;
        const dyDt = (4.0 * (1.0 - 2.0 * u) * sp.arcHeight) / sp.arcSpan;
        const pitch = -Math.atan(dyDt);

        this.tmpPos.set(sp.x + sinY * fwd, sp.waterY + arcY - 0.04, sp.z + cosY * fwd);
        this.tmpEuler.set(pitch, sp.yaw, 0.0, 'YXZ');
        this.tmpQuat.setFromEuler(this.tmpEuler);
        this.tmpScale.setScalar(sp.scale);
      } else {
        this.tmpPos.set(sp.x, sp.waterY - 0.85, sp.z);
        this.tmpQuat.identity();
        this.tmpScale.setScalar(0.0001);
      }
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.troutMesh.setMatrixAt(i, this.tmpMatrix);

      // Exit ripple (starts at cycle = 0) & Splashdown ripple (starts at cycle = leapFrac)
      const exitAge = cycle / 0.42;
      const splashCycle = cycle >= leapFrac ? cycle - leapFrac : cycle + 1.0 - leapFrac;
      const splashAge = splashCycle / 0.48;

      const rIdx0 = i * 2;
      const rIdx1 = i * 2 + 1;
      this.tmpQuat.identity();
      this.tmpScale.setScalar(1.0);

      this.tmpPos.set(sp.x - sinY * sp.arcSpan * 0.5, sp.waterY + 0.035, sp.z - cosY * sp.arcSpan * 0.5);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.troutRippleMesh.setMatrixAt(rIdx0, this.tmpMatrix);
      this.troutRippleAgeAttr.setX(rIdx0, exitAge <= 1.0 ? exitAge : 0.0);

      this.tmpPos.set(sp.x + sinY * sp.arcSpan * 0.5, sp.waterY + 0.035, sp.z + cosY * sp.arcSpan * 0.5);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.troutRippleMesh.setMatrixAt(rIdx1, this.tmpMatrix);
      this.troutRippleAgeAttr.setX(rIdx1, splashAge <= 1.0 ? splashAge : 0.0);
    }

    this.troutMesh.instanceMatrix.needsUpdate = true;
    this.troutRippleMesh.instanceMatrix.needsUpdate = true;
    this.troutRippleAgeAttr.needsUpdate = true;
  }

  private buildValleyMist(sunDir: THREE.Vector3): void {
    this.mistMaterial = createValleyMistMaterial({
      mistColor: this.currentConfig?.fog?.color ?? '#efe3cb'
    });
    const mistConfigs = [
      { x: -20, y: 5.8, z: -32, w: 68, h: 13, ry: 0.18 },
      { x: 22, y: 7.2, z: -48, w: 78, h: 15, ry: -0.24 },
      { x: 2, y: 10.5, z: -72, w: 96, h: 18, ry: 0.05 },
      { x: 42, y: 8.5, z: 6, w: 72, h: 14, ry: -Math.PI * 0.45 },
      { x: -40, y: 8.0, z: 12, w: 70, h: 14, ry: Math.PI * 0.42 },
      { x: 4, y: 8.8, z: 54, w: 86, h: 15, ry: Math.PI },
      // Deeper valley mist banks across the doubled 124m forest
      { x: 6, y: 14.2, z: -112, w: 120, h: 20, ry: 0.04 },
      { x: -78, y: 11.5, z: -38, w: 95, h: 16, ry: Math.PI * 0.38 },
      { x: 80, y: 11.8, z: -32, w: 95, h: 16, ry: -Math.PI * 0.38 },
      { x: -6, y: 11.2, z: 102, w: 115, h: 18, ry: Math.PI }
    ];

    mistConfigs.forEach((cfg, idx) => {
      const geo = new THREE.PlaneGeometry(cfg.w, cfg.h);
      const mesh = new THREE.Mesh(geo, this.mistMaterial!);
      mesh.name = `ValleyMist_${idx + 1}`;
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.y = cfg.ry;
      this.scene.add(mesh);
    });

    // Drifting animated low-lying stream fog ribbons hugging the mountain brook
    this.streamFogMaterial = createStreamFogRibbonMaterial({
      mistColor: '#f4ead6',
      sunDirection: sunDir
    });
    const buildStreamRibbon = (width: number, yOffset: number, zMin: number, zMax: number): THREE.BufferGeometry => {
      const zSegs = 96;
      const xSegs = 4;
      const cols = xSegs + 1;
      const rows = zSegs + 1;
      const positions = new Float32Array(cols * rows * 3);
      const uvs = new Float32Array(cols * rows * 2);
      const indices: number[] = [];

      for (let j = 0; j < rows; j++) {
        const v = j / zSegs;
        const z = zMin + v * (zMax - zMin);
        const cx = getStreamCenterX(z);
        const wy = this.getStreamWaterY(z) + yOffset;
        for (let i = 0; i < cols; i++) {
          const u = i / xSegs;
          const idx = j * cols + i;
          positions[idx * 3] = cx + (u - 0.5) * width;
          positions[idx * 3 + 1] = wy;
          positions[idx * 3 + 2] = z;
          uvs[idx * 2] = u;
          uvs[idx * 2 + 1] = v;
        }
      }
      for (let j = 0; j < zSegs; j++) {
        for (let i = 0; i < xSegs; i++) {
          const a = j * cols + i;
          const b = a + 1;
          const c = (j + 1) * cols + i;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const ribbonLow = new THREE.Mesh(buildStreamRibbon(13.5, 0.42, -126, 98), this.streamFogMaterial);
    ribbonLow.name = 'StreamFogRibbon_Low';
    this.scene.add(ribbonLow);

    const ribbonHigh = new THREE.Mesh(buildStreamRibbon(18.5, 1.18, -126, 98), this.streamFogMaterial);
    ribbonHigh.name = 'StreamFogRibbon_High';
    this.scene.add(ribbonHigh);

    // Ground-hugging clearing mist wisps
    const clearingWisps = [
      { x: -16.0, z: -6.0, w: 24, d: 22, yOff: 0.72 },
      { x: 16.0, z: -12.0, w: 24, d: 22, yOff: 0.75 },
      { x: -38.0, z: 48.0, w: 28, d: 26, yOff: 0.85 },
      { x: 38.0, z: 44.0, w: 28, d: 26, yOff: 0.85 }
    ];
    clearingWisps.forEach((cw, idx) => {
      const geo = new THREE.PlaneGeometry(cw.w, cw.d, 10, 10);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const wx = cw.x + p.getX(k);
        const wz = cw.z + p.getZ(k);
        p.setY(k, getMistyForestHeight(wx, wz) + cw.yOff);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.streamFogMaterial!);
      mesh.name = `ClearingMistRibbon_${idx + 1}`;
      mesh.position.set(cw.x, 0, cw.z);
      this.scene.add(mesh);
    });
  }

  private buildForestMotes(): void {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const kinds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      if (i < 420) {
        // Concentrated softly along the stream corridor, footbridge, shrine & clearings
        z = -82.0 + pseudoRand(i * 1.43) * 145.0;
        x = getStreamCenterX(z) + (pseudoRand(i * 2.87) - 0.5) * 26.0;
      } else {
        const r = 4.0 + Math.sqrt(pseudoRand(i * 3.19)) * 108.0;
        const theta = i * 2.39996;
        x = r * Math.cos(theta);
        z = r * Math.sin(theta);
      }
      const y = getMistyForestHeight(x, z) + 0.55 + pseudoRand(i * 5.13) * 5.2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = i * 0.67;
      kinds[i] = i % 2 === 0 ? 0.0 : 1.0; // 50% golden pollen motes, 50% chartreuse-amber fireflies
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));

    this.firefliesMaterial = createForestMotesMaterial();

    const pts = new THREE.Points(geo, this.firefliesMaterial);
    pts.name = 'ForestSunMotes';
    this.scene.add(pts);
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    const dt = Number.isFinite(deltaTime) ? deltaTime : 0.016;
    const et = Number.isFinite(elapsedTime) ? elapsedTime : 0.0;
    this.lastDeltaTime = dt;
    this.lastElapsedTime = et;

    if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = et;
    if (this.terrainHandle) this.terrainHandle.uniforms.uTime.value = et;
    if (this.waterMaterial) this.waterMaterial.uniforms.uTime.value = et;
    if (this.coniferBoughHandle) this.coniferBoughHandle.uniforms.uTime.value = et;
    if (this.pineTrunkWindUniforms) this.pineTrunkWindUniforms.uTime.value = et;
    if (this.fernHandle) this.fernHandle.uniforms.uTime.value = et;
    if (this.grassMaterial) this.grassMaterial.uniforms.uTime.value = et;
    if (this.wildflowerMaterial) this.wildflowerMaterial.uniforms.uTime.value = et;
    if (this.waterfallMaterial) this.waterfallMaterial.uniforms.uTime.value = et;
    if (this.waterfallSprayMaterial) this.waterfallSprayMaterial.uniforms.uTime.value = et;
    if (this.waterfallPlungeFoamMaterial) this.waterfallPlungeFoamMaterial.uniforms.uTime.value = et;
    if (this.waterfallMistMaterial) this.waterfallMistMaterial.uniforms.uTime.value = et;
    if (this.waterfallMistParticlesMaterial) this.waterfallMistParticlesMaterial.uniforms.uTime.value = et;
    if (this.sunbeamMaterial) this.sunbeamMaterial.uniforms.uTime.value = et;
    if (this.birdMaterial) this.birdMaterial.uniforms.uTime.value = et;
    if (this.mistMaterial) this.mistMaterial.uniforms.uTime.value = et;
    if (this.streamFogMaterial) this.streamFogMaterial.uniforms.uTime.value = et;
    if (this.firefliesMaterial) this.firefliesMaterial.uniforms.uTime.value = et;
    if (this.troutMaterial) this.troutMaterial.uniforms.uTime.value = et;
    if (this.troutRippleMaterial) this.troutRippleMaterial.uniforms.uTime.value = et;

    this.updateBirdPositions(et);
    this.updateStreamTrout(et);
    this.worldRuntime.update(this.boundCamera, et);
  }

  public setAudioEnergy(bass: number, mid: number, treble: number): void {
    if (!this.isInitialized) return;
    const b = Number.isFinite(bass) ? Math.max(0, Math.min(2, bass)) : 0;
    const m = Number.isFinite(mid) ? Math.max(0, Math.min(2, mid)) : 0;
    const t = Number.isFinite(treble) ? Math.max(0, Math.min(2, treble)) : 0;
    this.audioBass = b;
    this.audioMid = m;
    this.audioTreble = t;

    if (this.skyMaterial?.uniforms?.uBassEnergy) {
      this.skyMaterial.uniforms.uBassEnergy.value = b;
    }
    if (this.sunbeamMaterial?.uniforms?.uBassEnergy) {
      this.sunbeamMaterial.uniforms.uBassEnergy.value = b;
    }
    if (this.pineTrunkWindUniforms) {
      this.pineTrunkWindUniforms.uAudioBass.value = b;
    }
    if (this.coniferBoughHandle) {
      this.coniferBoughHandle.uniforms.uAudioBass.value = b;
      this.coniferBoughHandle.uniforms.uAudioTreble.value = t;
    }
    if (this.waterfallMaterial?.uniforms?.uBassEnergy) {
      this.waterfallMaterial.uniforms.uBassEnergy.value = b;
    }
    if (this.waterfallSprayMaterial?.uniforms?.uBassEnergy) {
      this.waterfallSprayMaterial.uniforms.uBassEnergy.value = b;
    }
    if (this.waterfallPlungeFoamMaterial?.uniforms?.uBassEnergy) {
      this.waterfallPlungeFoamMaterial.uniforms.uBassEnergy.value = b;
    }
    if (this.waterfallMistParticlesMaterial?.uniforms?.uBassEnergy) {
      this.waterfallMistParticlesMaterial.uniforms.uBassEnergy.value = b;
    }
    if (this.firefliesMaterial?.uniforms?.uBassEnergy) {
      this.firefliesMaterial.uniforms.uBassEnergy.value = b;
      this.firefliesMaterial.uniforms.uTrebleEnergy.value = t;
    }
    if (this.streamFogMaterial?.uniforms?.uIntensity) {
      this.streamFogMaterial.uniforms.uIntensity.value = this.mistBaseIntensity * (1.0 + m * 0.22);
    }
  }

  public setAtmosphereState(state: MistyAtmosphereState): void {
    if (!this.isInitialized || !state || typeof state !== 'object') return;

    if (typeof state.weather === 'string') {
      const w = state.weather.toLowerCase();
      if (w === 'mist' || w === 'fog') {
        this.mistBaseIntensity = 1.45;
        if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = 0.0026;
      } else if (w === 'clear') {
        this.mistBaseIntensity = 0.75;
        if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = 0.0015;
      } else if (w === 'rain' || w === 'storm') {
        this.mistBaseIntensity = 1.65;
        if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = 0.0031;
      }
      if (this.mistMaterial?.uniforms?.uIntensity) {
        this.mistMaterial.uniforms.uIntensity.value = this.mistBaseIntensity;
      }
      if (this.streamFogMaterial?.uniforms?.uIntensity) {
        this.streamFogMaterial.uniforms.uIntensity.value = this.mistBaseIntensity * (1.0 + this.audioMid * 0.22);
      }
    }

    const fogDensityVal =
      typeof state.fogDensity === 'number' && Number.isFinite(state.fogDensity)
        ? Math.max(0, Math.min(0.02, state.fogDensity))
        : undefined;
    if (fogDensityVal !== undefined && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = fogDensityVal;
      if (this.currentConfig?.fog) this.currentConfig.fog.density = fogDensityVal;
    }

    if (typeof state.mistDensity === 'number' && Number.isFinite(state.mistDensity)) {
      this.mistBaseIntensity = Math.max(0, Math.min(2.5, state.mistDensity));
      if (this.mistMaterial?.uniforms?.uIntensity) {
        this.mistMaterial.uniforms.uIntensity.value = this.mistBaseIntensity;
      }
      if (this.streamFogMaterial?.uniforms?.uIntensity) {
        this.streamFogMaterial.uniforms.uIntensity.value = this.mistBaseIntensity * (1.0 + this.audioMid * 0.22);
      }
    }

    if (typeof state.godRayIntensity === 'number' && Number.isFinite(state.godRayIntensity)) {
      this.godRayBaseIntensity = Math.max(0, Math.min(3.0, state.godRayIntensity));
      if (this.sunbeamMaterial?.uniforms?.uIntensity) {
        this.sunbeamMaterial.uniforms.uIntensity.value = this.godRayBaseIntensity;
      }
    }

    if (state.fogColor && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(state.fogColor);
      if (this.currentConfig?.fog) this.currentConfig.fog.color = state.fogColor;
      this.mistMaterial?.uniforms?.uMistColor?.value.set(state.fogColor);
      this.streamFogMaterial?.uniforms?.uMistColor?.value.set(state.fogColor);
      for (const mat of this.alpineMaterials) {
        mat.uniforms.uMistColor.value.set(state.fogColor);
      }
    }

    if (this.skyMaterial) {
      if (state.skyTopColor) {
        this.skyMaterial.uniforms.uTopColor.value.set(state.skyTopColor);
        this.waterMaterial?.uniforms?.uSkyTopColor?.value.set(state.skyTopColor);
      }
      if (state.skyBottomColor) {
        this.skyMaterial.uniforms.uBottomColor.value.set(state.skyBottomColor);
      }
      if (state.skyHorizonColor) {
        this.skyMaterial.uniforms.uHorizonColor.value.set(state.skyHorizonColor);
        this.waterMaterial?.uniforms?.uHorizonColor?.value.set(state.skyHorizonColor);
        for (const mat of this.alpineMaterials) {
          mat.uniforms.uHorizonColor.value.set(state.skyHorizonColor);
        }
      }
    }

    if (typeof state.windSpeed === 'number' && Number.isFinite(state.windSpeed)) {
      const ws = Math.max(0, Math.min(12, state.windSpeed));
      if (this.grassMaterial) this.grassMaterial.uniforms.uWindSpeed.value = ws;
      if (this.coniferBoughHandle) this.coniferBoughHandle.uniforms.uWindSpeed.value = ws;
      if (this.pineTrunkWindUniforms) this.pineTrunkWindUniforms.uWindSpeed.value = ws;
      if (this.fernHandle) this.fernHandle.uniforms.uWindSpeed.value = ws;
      if (this.terrainHandle) this.terrainHandle.uniforms.uWindSpeed.value = ws;
      if (this.wildflowerMaterial) this.wildflowerMaterial.uniforms.uWindSpeed.value = ws;
    }

    if (typeof state.windIntensity === 'number' && Number.isFinite(state.windIntensity)) {
      const wi = Math.max(0, Math.min(3, state.windIntensity));
      if (this.grassMaterial) this.grassMaterial.uniforms.uWindStrength.value = wi;
      if (this.coniferBoughHandle) this.coniferBoughHandle.uniforms.uWindStrength.value = wi;
      if (this.pineTrunkWindUniforms) this.pineTrunkWindUniforms.uWindStrength.value = wi;
      if (this.fernHandle) this.fernHandle.uniforms.uWindStrength.value = wi;
      if (this.wildflowerMaterial) this.wildflowerMaterial.uniforms.uWindStrength.value = wi;
    }

    const hasSunElev = typeof state.sunElevation === 'number' && Number.isFinite(state.sunElevation);
    const hasSunAz = typeof state.sunAzimuth === 'number' && Number.isFinite(state.sunAzimuth);
    const hasTod = typeof state.timeOfDay === 'number' && Number.isFinite(state.timeOfDay);
    if ((hasSunElev || hasSunAz || hasTod) && this.directionalLight) {
      const elev = hasSunElev
        ? Math.max(0.05, Math.min(1.45, state.sunElevation!))
        : hasTod
          ? Math.max(0.08, Math.sin(Math.max(0.05, Math.min(0.95, state.timeOfDay!)) * Math.PI) * 1.15)
          : 0.42;
      const az = hasSunAz ? state.sunAzimuth! : -0.63;
      const r = 70.0;
      const lx = Math.cos(elev) * Math.cos(az) * r;
      const ly = Math.sin(elev) * r;
      const lz = Math.cos(elev) * Math.sin(az) * r;
      this.directionalLight.position.set(lx, ly, lz);
      this.applySunDirectionUniforms(this.directionalLight.position.clone().normalize());
    }
  }

  private applySunDirectionUniforms(sunDir: THREE.Vector3): void {
    this.skyMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.waterMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.terrainHandle?.uniforms.uSunDirection.value.copy(sunDir);
    this.coniferBoughHandle?.uniforms.uSunDirection.value.copy(sunDir);
    this.fernHandle?.uniforms.uSunDirection.value.copy(sunDir);
    this.grassMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.wildflowerMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.waterfallMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.waterfallSprayMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.streamFogMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.birdMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    this.troutMaterial?.uniforms.uSunDirection.value.copy(sunDir);
    for (const mat of this.alpineMaterials) {
      mat.uniforms.uSunDirection.value.copy(sunDir);
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
    if (!isInitialHydration) this.hasUserMutation = true;

    if (newConfig.fog && this.scene.fog instanceof THREE.FogExp2) {
      const isLegacySeedFog =
        isInitialHydration && newConfig.fog.color?.toLowerCase() === '#cce5df';
      if (newConfig.fog.color && !isLegacySeedFog) {
        this.scene.fog.color.set(newConfig.fog.color);
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
        if (this.mistMaterial) this.mistMaterial.uniforms.uMistColor.value.set(newConfig.fog.color);
        if (this.streamFogMaterial) this.streamFogMaterial.uniforms.uMistColor.value.set(newConfig.fog.color);
        for (const mat of this.alpineMaterials) {
          mat.uniforms.uMistColor.value.set(newConfig.fog.color);
        }
      }
      if (typeof newConfig.fog.density === 'number' && Number.isFinite(newConfig.fog.density)) {
        const applied = isInitialHydration ? Math.min(newConfig.fog.density, 0.0021) : newConfig.fog.density;
        this.scene.fog.density = applied;
        if (this.currentConfig?.fog) this.currentConfig.fog.density = applied;
      }
    }

    if (newConfig.wind) {
      if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.coniferBoughHandle) this.coniferBoughHandle.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.pineTrunkWindUniforms) this.pineTrunkWindUniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.fernHandle) this.fernHandle.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.terrainHandle) this.terrainHandle.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.wildflowerMaterial) this.wildflowerMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        if (this.currentConfig?.wind) this.currentConfig.wind.speed = newConfig.wind.speed;
      }
      if (typeof newConfig.wind.swayIntensity === 'number' && Number.isFinite(newConfig.wind.swayIntensity)) {
        if (this.grassMaterial) this.grassMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.coniferBoughHandle) this.coniferBoughHandle.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.pineTrunkWindUniforms) this.pineTrunkWindUniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.fernHandle) this.fernHandle.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.wildflowerMaterial) this.wildflowerMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
        if (this.currentConfig?.wind) this.currentConfig.wind.swayIntensity = newConfig.wind.swayIntensity;
      }
    }

    if (newConfig.sky) {
      const isLegacySeedSky =
        isInitialHydration &&
        newConfig.sky.horizonColor?.toLowerCase() === '#e6f2ec' &&
        newConfig.sky.topColor?.toLowerCase() === '#3b82b6';
      if (this.skyMaterial && !isLegacySeedSky) {
        if (newConfig.sky.topColor) {
          this.skyMaterial.uniforms.uTopColor.value.set(newConfig.sky.topColor);
          if (this.waterMaterial) this.waterMaterial.uniforms.uSkyTopColor.value.set(newConfig.sky.topColor);
          if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
        }
        if (newConfig.sky.bottomColor) {
          this.skyMaterial.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
          if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
        }
        if (newConfig.sky.horizonColor) {
          this.skyMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
          if (this.waterMaterial) this.waterMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
          for (const mat of this.alpineMaterials) {
            mat.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
          }
          if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
        }
      }
      if (this.skyMaterial && typeof newConfig.sky.swirlSpeed === 'number' && Number.isFinite(newConfig.sky.swirlSpeed)) {
        this.skyMaterial.uniforms.uSwirlSpeed.value = newConfig.sky.swirlSpeed;
        if (this.currentConfig?.sky) this.currentConfig.sky.swirlSpeed = newConfig.sky.swirlSpeed;
      }
    }

    if (newConfig.lighting && !isInitialHydration) {
      if (newConfig.lighting.directional && this.directionalLight) {
        if (newConfig.lighting.directional.color) {
          this.directionalLight.color.set(newConfig.lighting.directional.color);
        }
        if (typeof newConfig.lighting.directional.intensity === 'number' && Number.isFinite(newConfig.lighting.directional.intensity)) {
          this.directionalLight.intensity = newConfig.lighting.directional.intensity;
        }
        if (Array.isArray(newConfig.lighting.directional.position) && newConfig.lighting.directional.position.length >= 3) {
          const [lx, ly, lz] = newConfig.lighting.directional.position;
          if (Number.isFinite(lx) && Number.isFinite(ly) && Number.isFinite(lz)) {
            this.directionalLight.position.set(lx, ly, lz);
            this.applySunDirectionUniforms(this.directionalLight.position.clone().normalize());
          }
        }
      }
    }

    if (newConfig.audio && this.currentConfig?.audio) {
      if (typeof newConfig.audio.defaultVolume === 'number' && Number.isFinite(newConfig.audio.defaultVolume)) {
        this.currentConfig.audio.defaultVolume = newConfig.audio.defaultVolume;
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
    return getMistyForestHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? -4;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 14;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;
    const lookAt = this.currentConfig?.camera?.lookAt ?? [2, 6, -45];
    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2])
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = Math.max(this.currentConfig?.camera?.wanderRadius ?? 124, 124);
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
    const isl = getRiverIslandCenter();
    return [
      {
        name: 'Rustic Footbridge',
        position: new THREE.Vector3(getStreamCenterX(-6), this.getGroundHeight(getStreamCenterX(-6), -6) + 2.6, -6),
        dwellTime: 10.0
      },
      {
        name: 'Whispering Stream',
        position: new THREE.Vector3(isl.x + 5.2, this.getGroundHeight(isl.x + 5.2, isl.z + 4.0) + 2.4, isl.z + 4.0),
        dwellTime: 10.0
      },
      {
        name: 'Forest Shrine',
        position: new THREE.Vector3(-21.5, this.getGroundHeight(-21.5, -9.5) + 2.5, -9.5),
        dwellTime: 10.0
      },
      {
        name: 'Ranger Lookout',
        position: new THREE.Vector3(21.5, this.getGroundHeight(21.5, -14.5) + 3.2, -14.5),
        dwellTime: 10.0
      },
      {
        name: 'Waterfall Overlook',
        position: new THREE.Vector3(getStreamCenterX(-104) + 6, this.getGroundHeight(getStreamCenterX(-104) + 6, -104) + 4.5, -104),
        dwellTime: 11.0
      },
      {
        name: 'Misty Ridge Overlook',
        position: new THREE.Vector3(-4, this.getGroundHeight(-4, 24) + 2.8, 24),
        dwellTime: 10.0
      },
      {
        name: 'Downstream Stone Viewing Bridge',
        position: new THREE.Vector3(getStreamCenterX(54), this.getGroundHeight(getStreamCenterX(54), 54) + 2.8, 54),
        dwellTime: 10.0
      },
      {
        name: 'Outer Fern Glade',
        position: new THREE.Vector3(-44, this.getGroundHeight(-44, 52) + 2.4, 52),
        dwellTime: 9.0
      },
      {
        name: 'Mossy Ridge Lantern Trail',
        position: new THREE.Vector3(32, this.getGroundHeight(32, 42) + 2.5, 42),
        dwellTime: 9.0
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
    this.boundCamera = null;

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
    if (this.scene) {
      this.scene.environment = null;
    }

    this.skyMaterial = null;
    this.terrainHandle = null;
    this.waterMaterial = null;
    this.coniferBoughHandle = null;
    this.pineTrunkWindUniforms = null;
    this.fernHandle = null;
    this.grassMaterial = null;
    this.wildflowerMaterial = null;
    this.alpineMaterials = [];
    this.waterfallMaterial = null;
    this.waterfallSprayMaterial = null;
    this.waterfallPlungeFoamMaterial = null;
    this.waterfallMistMaterial = null;
    this.waterfallMistParticlesMaterial = null;
    this.sunbeamMaterial = null;
    this.birdMaterial = null;
    this.mistMaterial = null;
    this.streamFogMaterial = null;
    this.firefliesMaterial = null;
    this.troutMaterial = null;
    this.troutRippleMaterial = null;
    this.birdsMesh = null;
    this.birdOrbits = [];
    this.troutMesh = null;
    this.troutRippleMesh = null;
    this.troutRippleAgeAttr = null;
    this.troutJumpSpecs = [];
    this.lanternPointLights = [];
    this.ambientLight = null;
    this.hemiLight = null;
    this.directionalLight = null;
    this.godRayBaseIntensity = 1.0;
    this.mistBaseIntensity = 1.0;
    this.audioBass = 0.0;
    this.audioMid = 0.0;
    this.audioTreble = 0.0;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;

    this.isInitialized = false;
  }
}
