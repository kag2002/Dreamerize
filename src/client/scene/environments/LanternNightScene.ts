import * as THREE from 'three';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { WorldRuntime } from '../framework/WorldRuntime';
import type { QualityTier, WorldPerfMetrics } from '../framework/types';
import {
  createLanternInkSkyMaterial,
  createLanternMirrorWaterMaterial,
  createSkyLanternMaterial,
  createBrassLanternMaterial,
  createHoaDangMaterial,
  createHoaDangRippleMaterial,
  createLanternEmberMaterial
} from '../shaders/lanternNightShader';

/**
 * Analytical floor height for "Đêm Hoa Đăng & Đèn Trời" (LanternNightScene).
 * - Wooden lantern-release pier (x in [-4.5, 4.5], z in [14, 30]): y = 0.52m
 * - Open mirror water surface elsewhere: y = 0.22m (gliding smoothly right above water y = 0)
 */
export function getLanternNightHeight(x: number, z: number): number {
  if (Math.abs(x) <= 4.5 && z >= 14.0 && z <= 30.0) {
    return 0.52;
  }
  return 0.22;
}

/** Deterministic PRNG for reproducible lantern layout & tests */
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

/**
 * Builds an authentic tapered paper/brass-rimmed sky lantern geometry ("Đèn Trời / Đèn Lồng Bay").
 * Local Y spans [-0.55 .. +0.55].
 */
function createSkyLanternGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.24, -0.55), // open bottom brass rim
    new THREE.Vector2(0.32, -0.44),
    new THREE.Vector2(0.42, -0.18),
    new THREE.Vector2(0.46, 0.14),  // widest upper belly
    new THREE.Vector2(0.42, 0.38),
    new THREE.Vector2(0.28, 0.51),
    new THREE.Vector2(0.01, 0.55)   // closed dome crown
  ];
  const geo = new THREE.LatheGeometry(pts, 10);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an ornate hexagonal brass-framed palace sky lantern with top/bottom crown caps
 * and a hanging silk tassel underneath (y spans [-0.88 .. +0.58]).
 */
function createBrassLanternGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.015, -0.88), // tassel tip
    new THREE.Vector2(0.045, -0.68), // tassel bell
    new THREE.Vector2(0.02, -0.48),  // tassel cord
    new THREE.Vector2(0.24, -0.45),  // lower brass crown rim
    new THREE.Vector2(0.28, -0.37),
    new THREE.Vector2(0.38, -0.18),  // lower lantern belly
    new THREE.Vector2(0.41, 0.08),   // mid lantern belly
    new THREE.Vector2(0.36, 0.34),
    new THREE.Vector2(0.26, 0.44),   // upper brass crown rim
    new THREE.Vector2(0.18, 0.52),   // finial cap
    new THREE.Vector2(0.01, 0.58)
  ];
  const geo = new THREE.LatheGeometry(pts, 6);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sculpted 3D floating lotus water lantern ("Đèn Hoa Đăng") merged into one clean BufferGeometry:
 * - Octagonal floating leaf base (y = 0..0.03)
 * - Outer & inner curved lotus petals
 * - Central wax candle + bright flame teardrop
 */
function createHoaDangGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const pushTri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number
  ) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  };

  // 1. Octagonal floating leaf pad (y = 0.01)
  const baseR = 0.42;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    pushTri(
      0, 0.015, 0,
      Math.cos(a0) * baseR, 0.01, Math.sin(a0) * baseR,
      Math.cos(a1) * baseR, 0.01, Math.sin(a1) * baseR
    );
  }

  // 2. Outer lotus petal ring (8 broad cupped petals)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const aL = a - 0.28;
    const aR = a + 0.28;
    const r0 = 0.14;
    const rMid = 0.34;
    const rTip = 0.44;
    const y0 = 0.025;
    const yMid = 0.15;
    const yTip = 0.22;

    // Lower petal quad
    pushTri(
      Math.cos(aL) * r0, y0, Math.sin(aL) * r0,
      Math.cos(aR) * r0, y0, Math.sin(aR) * r0,
      Math.cos(aR) * rMid, yMid, Math.sin(aR) * rMid
    );
    pushTri(
      Math.cos(aL) * r0, y0, Math.sin(aL) * r0,
      Math.cos(aR) * rMid, yMid, Math.sin(aR) * rMid,
      Math.cos(aL) * rMid, yMid, Math.sin(aL) * rMid
    );
    // Pointed petal tip
    pushTri(
      Math.cos(aL) * rMid, yMid, Math.sin(aL) * rMid,
      Math.cos(aR) * rMid, yMid, Math.sin(aR) * rMid,
      Math.cos(a) * rTip, yTip, Math.sin(a) * rTip
    );
  }

  // 3. Inner upright lotus petal ring (8 steeper petals, offset by half step)
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const aL = a - 0.24;
    const aR = a + 0.24;
    const r0 = 0.10;
    const rMid = 0.22;
    const rTip = 0.26;
    const y0 = 0.035;
    const yMid = 0.21;
    const yTip = 0.31;

    pushTri(
      Math.cos(aL) * r0, y0, Math.sin(aL) * r0,
      Math.cos(aR) * r0, y0, Math.sin(aR) * r0,
      Math.cos(aR) * rMid, yMid, Math.sin(aR) * rMid
    );
    pushTri(
      Math.cos(aL) * r0, y0, Math.sin(aL) * r0,
      Math.cos(aR) * rMid, yMid, Math.sin(aR) * rMid,
      Math.cos(aL) * rMid, yMid, Math.sin(aL) * rMid
    );
    pushTri(
      Math.cos(aL) * rMid, yMid, Math.sin(aL) * rMid,
      Math.cos(aR) * rMid, yMid, Math.sin(aR) * rMid,
      Math.cos(a) * rTip, yTip, Math.sin(a) * rTip
    );
  }

  // 4. Central candle flame octahedron (r = 0.055, y = 0.14..0.32)
  const fr = 0.052;
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2;
    const a1 = ((i + 1) / 4) * Math.PI * 2;
    // Upper flame cone
    pushTri(
      Math.cos(a0) * fr, 0.19, Math.sin(a0) * fr,
      Math.cos(a1) * fr, 0.19, Math.sin(a1) * fr,
      0, 0.32, 0
    );
    // Lower candle base
    pushTri(
      Math.cos(a1) * fr, 0.19, Math.sin(a1) * fr,
      Math.cos(a0) * fr, 0.19, Math.sin(a0) * fr,
      0, 0.11, 0
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

/**
 * LanternNightScene ("Đêm Hoa Đăng & Đèn Trời")
 * Pitch-black ink night sky, colorless mirror-black water seamlessly blending into the void,
 * 420 rising golden sky lanterns + 420 rippled water reflections,
 * 180 floating lotus hoa đăng + 180 expanding concentric ripple rings + 180 underwater reflections,
 * drifting warm embers, a dark wooden lantern-release pier, and quiet silhouetted sampan boats.
 */
export class LanternNightScene implements ISpace {
  readonly id = 'space-lantern-night';
  readonly name = 'Đêm Hoa Đăng & Đèn Trời';
  readonly slug = 'lantern-night';

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;
  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  private pipeline: CinematicPipeline | null = null;
  private boundCamera: THREE.PerspectiveCamera | null = null;
  private readonly worldRuntime = new WorldRuntime({
    enableDistanceCulling: false,
    enableShadowTracking: false
  });
  private lastDeltaTime = 0.016;
  private lastElapsedTime = 0;

  // Shader materials updated every frame
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private waterMaterial: THREE.ShaderMaterial | null = null;
  private skyLanternMaterial: THREE.ShaderMaterial | null = null;
  private skyLanternReflMaterial: THREE.ShaderMaterial | null = null;
  private brassLanternMaterial: THREE.ShaderMaterial | null = null;
  private brassLanternReflMaterial: THREE.ShaderMaterial | null = null;
  private hoaDangMaterial: THREE.ShaderMaterial | null = null;
  private hoaDangReflMaterial: THREE.ShaderMaterial | null = null;
  private rippleMaterial: THREE.ShaderMaterial | null = null;
  private emberMaterial: THREE.ShaderMaterial | null = null;

  // Gentle drifting boats & pier lanterns
  private boatGroups: Array<{ group: THREE.Group; baseX: number; baseZ: number; phase: number }> = [];
  private warmLights: THREE.PointLight[] = [];

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

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public async init(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> {
    if (this.isInitialized) {
      this.dispose();
      this.scene = new THREE.Scene();
    }
    this.boundCamera = camera ?? null;

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#010103',
        density: config?.fog?.density ?? 0.0046
      },
      sky: {
        type: 'lantern_ink_night',
        topColor: config?.sky?.topColor ?? '#000002',
        bottomColor: config?.sky?.bottomColor ?? '#010103',
        horizonColor: config?.sky?.horizonColor ?? '#0d0602',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0.6,
        starDensity: config?.sky?.starDensity ?? 0
      },
      wind: {
        speed: config?.wind?.speed ?? 0.8,
        direction: config?.wind?.direction ?? [0.6, 0.2, -0.4],
        gustiness: config?.wind?.gustiness ?? 0.2,
        swayIntensity: config?.wind?.swayIntensity ?? 0.65
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#1a0e06',
          intensity: config?.lighting?.ambient?.intensity ?? 0.25
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#ffb347',
          intensity: config?.lighting?.directional?.intensity ?? 0.22,
          position: config?.lighting?.directional?.position ?? [0, 35, -60],
          castShadow: false
        },
        pointLights: config?.lighting?.pointLights ?? [
          { color: '#ff9e2c', intensity: 2.2, distance: 28, position: [0, 2.2, 16] },
          { color: '#ff7b1c', intensity: 1.8, distance: 32, position: [-10, 4.5, -18] },
          { color: '#ffaa3b', intensity: 1.8, distance: 32, position: [12, 5.5, -24] }
        ]
      },
      shaders: config?.shaders ?? {},
      audio: {
        trackId: config?.audio?.trackId ?? 'lantern-night-ambient',
        name: config?.audio?.name ?? 'Đêm Hoa Đăng',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/starry-night-horizon.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.68,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 3.2, wet: 0.36 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 2.15, 22],
        lookAt: config?.camera?.lookAt ?? [0, 5.2, -32],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 5.5,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.4,
        wanderRadius: config?.camera?.wanderRadius ?? 95,
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 2.2, 22],
          [-16, 1.8, 4],
          [18, 3.2, -16],
          [0, 7.5, -36]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.65
      }
    };

    // 1. Pure Pitch-Black Ink Void Background & Fog
    const fogColor = this.currentConfig.fog.color;
    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.FogExp2(fogColor, this.currentConfig.fog.density);

    // 2. Subtle Warm Candlelight Illumination for Wooden Pier & Silhouetted Boats
    const amb = new THREE.AmbientLight(
      this.currentConfig.lighting.ambient.color,
      this.currentConfig.lighting.ambient.intensity
    );
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    dir.position.set(...this.currentConfig.lighting.directional.position);
    this.scene.add(dir);

    this.warmLights = [];
    for (const pl of this.currentConfig.lighting.pointLights) {
      const light = new THREE.PointLight(pl.color, pl.intensity, pl.distance, 1.6);
      light.position.set(...pl.position);
      this.scene.add(light);
      this.warmLights.push(light);
    }

    // 3. Build Core World Layers
    this.buildInkSkyDome();
    this.buildMirrorWaterPlane();
    this.buildSkyLanternsAndReflections();
    this.buildHeroBrassLanternsAndReflections();
    this.buildFestivalHorizonShore();
    this.buildFloatingHoaDangAndRipples();
    this.buildRisingEmbers();
    this.buildWoodenLanternPier();
    this.buildSilhouettedSampanBoats();

    // 4. HDR Cinematic Post-Processing (velvety golden lantern bloom on pitch-black ink void)
    if (renderer && typeof renderer.getSize === 'function') {
      this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
        defaultStyle: 'natural',
        bloomStrength: 0.62,
        bloomRadius: 0.65,
        bloomThreshold: 0.58
      });
    }

    this.worldRuntime.attach({
      scene: this.scene,
      renderer,
      camera,
      directionalLight: dir,
      pipeline: this.pipeline,
      fallbackFocusPos: this.getSpawnPoint().position
    });

    this.isInitialized = true;
  }

  private buildInkSkyDome(): void {
    const skyGeo = new THREE.SphereGeometry(420, 24, 16);
    this.skyMaterial = createLanternInkSkyMaterial();
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    skyMesh.name = 'LanternInkSkyDome';
    skyMesh.frustumCulled = false;
    this.scene.add(skyMesh);
  }

  private buildMirrorWaterPlane(): void {
    const waterGeo = new THREE.PlaneGeometry(520, 520, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMaterial = createLanternMirrorWaterMaterial();
    const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    waterMesh.name = 'LanternMirrorWater';
    waterMesh.position.y = 0.0;
    waterMesh.renderOrder = 2;
    waterMesh.frustumCulled = false;
    this.scene.add(waterMesh);
  }

  private buildSkyLanternsAndReflections(): void {
    const count = 420;
    const rng = mulberry32(20261129);
    const baseGeo = createSkyLanternGeometry();

    const basePosArr = new Float32Array(count * 4);
    const paramsArr = new Float32Array(count * 4);
    const tintArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute lanterns richly across the panorama, with an extra dense ribbon
      // rising along the forward horizon (-z) like the reference festival photo!
      let x: number;
      let z: number;
      let startY: number;
      let travelH: number;

      if (i < 160) {
        // Dense festival horizon release arc in front of the viewer
        const ang = (rng() - 0.5) * Math.PI * 1.15;
        const rad = 26 + rng() * 95;
        x = Math.sin(ang) * rad;
        z = -Math.cos(ang) * rad + 6;
        startY = rng() * 75;
        travelH = 68 + rng() * 28;
      } else {
        // Full 360-degree immersive lantern sky surrounding the viewer
        const ang = rng() * Math.PI * 2;
        const rad = 10 + Math.pow(rng(), 0.72) * 140;
        x = Math.cos(ang) * rad;
        z = Math.sin(ang) * rad;
        startY = rng() * 88;
        travelH = 72 + rng() * 26;
      }

      basePosArr[i * 4 + 0] = x;
      basePosArr[i * 4 + 1] = startY;
      basePosArr[i * 4 + 2] = z;
      basePosArr[i * 4 + 3] = travelH;

      paramsArr[i * 4 + 0] = rng() * Math.PI * 2;       // phase
      paramsArr[i * 4 + 1] = 0.55 + rng() * 0.95;       // rise speed (m/s)
      paramsArr[i * 4 + 2] = 0.8 + rng() * 2.2;         // horizontal breeze sway
      paramsArr[i * 4 + 3] = 0.72 + rng() * 0.78;       // lantern scale

      tintArr[i] = rng();
    }

    const createInstancedLayer = (isReflection: boolean): THREE.InstancedMesh => {
      const geo = baseGeo.clone();
      geo.setAttribute('aBasePos', new THREE.InstancedBufferAttribute(basePosArr, 4));
      geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(paramsArr, 4));
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintArr, 1));

      const mat = createSkyLanternMaterial(isReflection);
      if (isReflection) {
        this.skyLanternReflMaterial = mat;
      } else {
        this.skyLanternMaterial = mat;
      }

      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.name = isReflection ? 'SkyLanternReflections' : 'RisingSkyLanterns';
      const identity = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        inst.setMatrixAt(i, identity);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      inst.renderOrder = isReflection ? 1 : 3;
      return inst;
    };

    const skyLayer = createInstancedLayer(false);
    const reflLayer = createInstancedLayer(true);
    baseGeo.dispose();

    this.scene.add(reflLayer);
    this.scene.add(skyLayer);
  }

  private buildHeroBrassLanternsAndReflections(): void {
    const count = 80;
    const rng = mulberry32(29002026);
    const baseGeo = createBrassLanternGeometry();

    const basePosArr = new Float32Array(count * 4);
    const paramsArr = new Float32Array(count * 4);
    const tintArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Cluster hero brass palace lanterns in mid-foreground & scenic corridor
      const ang = (rng() - 0.5) * Math.PI * 1.45;
      const rad = 10 + rng() * 64;
      basePosArr[i * 4 + 0] = Math.sin(ang) * rad;
      basePosArr[i * 4 + 1] = rng() * 48;
      basePosArr[i * 4 + 2] = -Math.cos(ang) * rad + 10;
      basePosArr[i * 4 + 3] = 52 + rng() * 24;

      paramsArr[i * 4 + 0] = rng() * Math.PI * 2;
      paramsArr[i * 4 + 1] = 0.42 + rng() * 0.58; // majestic slower rise
      paramsArr[i * 4 + 2] = 0.7 + rng() * 1.5;
      paramsArr[i * 4 + 3] = 0.92 + rng() * 0.68; // slightly larger hero silhouette

      tintArr[i] = rng();
    }

    const createLayer = (isReflection: boolean): THREE.InstancedMesh => {
      const geo = baseGeo.clone();
      geo.setAttribute('aBasePos', new THREE.InstancedBufferAttribute(basePosArr, 4));
      geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(paramsArr, 4));
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintArr, 1));

      const mat = createBrassLanternMaterial(isReflection);
      if (isReflection) {
        this.brassLanternReflMaterial = mat;
      } else {
        this.brassLanternMaterial = mat;
      }

      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.name = isReflection ? 'HeroBrassLanternReflections' : 'HeroBrassSkyLanterns';
      const identity = new THREE.Matrix4();
      for (let i = 0; i < count; i++) inst.setMatrixAt(i, identity);
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      inst.renderOrder = isReflection ? 1 : 3;
      return inst;
    };

    const skyLayer = createLayer(false);
    const reflLayer = createLayer(true);
    baseGeo.dispose();

    this.scene.add(reflLayer);
    this.scene.add(skyLayer);
  }

  /**
   * Distant Festival Release Horizon Line (inspired directly by the reference photo):
   * - Dark low silhouette crowd standing along the far water edge (z ~ -74)
   * - 120 glowing low-altitude newly-lit lanterns hovering right above the silhouettes
   * - 120 mirrored vertical glow reflections shimmering in the pitch-black water below
   */
  private buildFestivalHorizonShore(): void {
    const rng = mulberry32(773311);
    const shoreGroup = new THREE.Group();
    shoreGroup.name = 'FestivalHorizonShore';

    // 1. Silhouetted festival-goers along the distant water bank
    const silhouetteCount = 110;
    const personGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.65, 6);
    const personMat = new THREE.MeshBasicMaterial({ color: '#040202' });
    const peopleInst = new THREE.InstancedMesh(personGeo, personMat, silhouetteCount);
    peopleInst.name = 'FestivalShoreSilhouettes';
    const dummy = new THREE.Object3D();

    for (let i = 0; i < silhouetteCount; i++) {
      const t = (i / (silhouetteCount - 1)) * 2 - 1; // -1 .. +1
      const x = t * 88 + (rng() - 0.5) * 2.2;
      const z = -74 - Math.abs(t) * 14 + (rng() - 0.5) * 3.0;
      const hScale = 0.85 + rng() * 0.35;
      dummy.position.set(x, 0.82 * hScale, z);
      dummy.scale.set(0.9 + rng() * 0.3, hScale, 0.9 + rng() * 0.3);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      peopleInst.setMatrixAt(i, dummy.matrix);
    }
    peopleInst.instanceMatrix.needsUpdate = true;
    peopleInst.renderOrder = 4;
    shoreGroup.add(peopleInst);

    // 2. Dense warm golden horizon release lanterns + direct water reflections
    const lanternCount = 120;
    const bulbGeo = new THREE.CylinderGeometry(0.42, 0.30, 0.95, 7);
    const bulbMat = new THREE.MeshBasicMaterial({
      color: '#ff9a2e',
      transparent: true,
      opacity: 0.92
    });
    const reflMat = new THREE.MeshBasicMaterial({
      color: '#ff7d1a',
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const horizonLanterns = new THREE.InstancedMesh(bulbGeo, bulbMat, lanternCount);
    horizonLanterns.name = 'FestivalHorizonLanterns';
    const horizonRefls = new THREE.InstancedMesh(bulbGeo, reflMat, lanternCount);
    horizonRefls.name = 'FestivalHorizonReflections';

    for (let i = 0; i < lanternCount; i++) {
      const t = (rng() - 0.5) * 2;
      const x = t * 84;
      const z = -72.5 - Math.abs(t) * 14 + (rng() - 0.5) * 4.5;
      const y = 1.45 + Math.pow(rng(), 1.6) * 4.2;
      const sc = 0.78 + rng() * 0.85;

      dummy.position.set(x, y, z);
      dummy.scale.set(sc, sc * (0.95 + rng() * 0.25), sc);
      dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.14);
      dummy.updateMatrix();
      horizonLanterns.setMatrixAt(i, dummy.matrix);

      // Elongated vertical water reflection right below y = 0
      dummy.position.set(x, -y * 1.15 - 0.35, z);
      dummy.scale.set(sc * 1.05, sc * 1.65, sc * 1.05);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      horizonRefls.setMatrixAt(i, dummy.matrix);
    }
    horizonLanterns.instanceMatrix.needsUpdate = true;
    horizonRefls.instanceMatrix.needsUpdate = true;
    horizonLanterns.renderOrder = 3;
    horizonRefls.renderOrder = 1;

    shoreGroup.add(horizonRefls);
    shoreGroup.add(horizonLanterns);
    this.scene.add(shoreGroup);
  }

  private buildFloatingHoaDangAndRipples(): void {
    // 180 classic drifting lotus hoa đăng + 36 larger foreground royal hoa đăng = 216 total
    const count = 216;
    const rng = mulberry32(99002026);

    const basePosArr = new Float32Array(count * 4);
    const paramsArr = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const isRoyal = i >= 180;
      let x: number;
      let z: number;

      // Avoid placing lotus lanterns inside the wooden pier footprint (|x| <= 5.2, z in [13, 31])
      do {
        const ang = isRoyal ? (rng() - 0.5) * Math.PI * 1.1 : rng() * Math.PI * 2;
        const rad = isRoyal
          ? 7.5 + rng() * 28
          : 4.5 + Math.pow(rng(), 0.78) * 105;
        x = isRoyal ? Math.sin(ang) * rad : Math.cos(ang) * rad;
        z = isRoyal ? -Math.cos(ang) * rad + 12 : Math.sin(ang) * rad;
      } while (Math.abs(x) <= 5.5 && z >= 12.5 && z <= 31.5);

      basePosArr[i * 4 + 0] = x;
      basePosArr[i * 4 + 1] = isRoyal ? 0.4 + rng() * 1.1 : 0.6 + rng() * 2.2;
      basePosArr[i * 4 + 2] = z;
      basePosArr[i * 4 + 3] = isRoyal ? 0.035 + rng() * 0.05 : 0.05 + rng() * 0.09;

      paramsArr[i * 4 + 0] = rng() * Math.PI * 2;
      paramsArr[i * 4 + 1] = isRoyal ? 1.45 + rng() * 0.55 : 0.75 + rng() * 0.65;
      paramsArr[i * 4 + 2] = rng();
      paramsArr[i * 4 + 3] = rng() * Math.PI * 2;
    }

    const lotusBaseGeo = createHoaDangGeometry();
    const identity = new THREE.Matrix4();

    // 1. Floating Hoa Đăng above water
    const lotusGeo = lotusBaseGeo.clone();
    lotusGeo.setAttribute('aBasePos', new THREE.InstancedBufferAttribute(basePosArr, 4));
    lotusGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(paramsArr, 4));
    this.hoaDangMaterial = createHoaDangMaterial(false);
    const lotusMesh = new THREE.InstancedMesh(lotusGeo, this.hoaDangMaterial, count);
    lotusMesh.name = 'FloatingHoaDangLanterns';
    for (let i = 0; i < count; i++) lotusMesh.setMatrixAt(i, identity);
    lotusMesh.instanceMatrix.needsUpdate = true;
    lotusMesh.frustumCulled = false;
    lotusMesh.renderOrder = 4;
    this.scene.add(lotusMesh);

    // 2. Mirrored Hoa Đăng underwater reflections
    const lotusReflGeo = lotusBaseGeo.clone();
    lotusReflGeo.setAttribute('aBasePos', new THREE.InstancedBufferAttribute(basePosArr, 4));
    lotusReflGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(paramsArr, 4));
    this.hoaDangReflMaterial = createHoaDangMaterial(true);
    const lotusReflMesh = new THREE.InstancedMesh(lotusReflGeo, this.hoaDangReflMaterial, count);
    lotusReflMesh.name = 'HoaDangWaterReflections';
    for (let i = 0; i < count; i++) lotusReflMesh.setMatrixAt(i, identity);
    lotusReflMesh.instanceMatrix.needsUpdate = true;
    lotusReflMesh.frustumCulled = false;
    lotusReflMesh.renderOrder = 1;
    this.scene.add(lotusReflMesh);
    lotusBaseGeo.dispose();

    // 3. Concentric expanding glowing ripple rings on water around each Hoa Đăng
    const rippleQuad = new THREE.PlaneGeometry(1, 1);
    rippleQuad.rotateX(-Math.PI / 2);
    rippleQuad.setAttribute('aBasePos', new THREE.InstancedBufferAttribute(basePosArr, 4));
    rippleQuad.setAttribute('aParams', new THREE.InstancedBufferAttribute(paramsArr, 4));
    this.rippleMaterial = createHoaDangRippleMaterial();
    const rippleMesh = new THREE.InstancedMesh(rippleQuad, this.rippleMaterial, count);
    rippleMesh.name = 'HoaDangConcentricRipples';
    for (let i = 0; i < count; i++) rippleMesh.setMatrixAt(i, identity);
    rippleMesh.instanceMatrix.needsUpdate = true;
    rippleMesh.frustumCulled = false;
    rippleMesh.renderOrder = 3;
    this.scene.add(rippleMesh);
  }

  private buildRisingEmbers(): void {
    const count = 360;
    const rng = mulberry32(441188);
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = 5 + rng() * 115;
      pos[i * 3 + 0] = Math.cos(ang) * rad;
      pos[i * 3 + 1] = rng() * 68;
      pos[i * 3 + 2] = Math.sin(ang) * rad;
      phase[i] = rng() * Math.PI * 2;
      speed[i] = 0.65 + rng() * 1.15;
      size[i] = 1.2 + rng() * 2.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    this.emberMaterial = createLanternEmberMaterial();
    const pts = new THREE.Points(geo, this.emberMaterial);
    pts.name = 'RisingLanternEmbers';
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    this.scene.add(pts);
  }

  private buildWoodenLanternPier(): void {
    const pierGroup = new THREE.Group();
    pierGroup.name = 'LanternReleasePier';

    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: '#1b120d',
      roughness: 0.88,
      metalness: 0.06
    });
    const brassCapMat = new THREE.MeshStandardMaterial({
      color: '#7a4b1f',
      roughness: 0.45,
      metalness: 0.65
    });
    const pierGlowMat = new THREE.MeshBasicMaterial({
      color: '#ffaa3b'
    });

    // Main low timber deck planks (z = 14.5 .. 29.5, width = 8.4m)
    const plankGeo = new THREE.BoxGeometry(8.4, 0.14, 0.42);
    for (let z = 14.8; z <= 29.2; z += 0.52) {
      const plank = new THREE.Mesh(plankGeo, darkWoodMat);
      plank.position.set(0, 0.44, z);
      pierGroup.add(plank);
    }

    // Two longitudinal timber support beams + vertical pilings rooted below water
    const beamGeo = new THREE.BoxGeometry(0.28, 0.24, 15.2);
    for (const bx of [-3.4, 3.4]) {
      const beam = new THREE.Mesh(beamGeo, darkWoodMat);
      beam.position.set(bx, 0.28, 22.0);
      pierGroup.add(beam);
    }

    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.85, 8);
    const capGeo = new THREE.CylinderGeometry(0.15, 0.14, 0.08, 8);
    const lanternOrbGeo = new THREE.SphereGeometry(0.14, 10, 8);

    for (const px of [-3.95, 3.95]) {
      for (const pz of [14.8, 19.6, 24.4, 29.2]) {
        const post = new THREE.Mesh(postGeo, darkWoodMat);
        post.position.set(px, 0.25, pz);
        pierGroup.add(post);

        const cap = new THREE.Mesh(capGeo, brassCapMat);
        cap.position.set(px, 1.18, pz);
        pierGroup.add(cap);

        // Warm miniature bronze post-lantern at the two water-edge tip bollards
        if (pz === 14.8 || pz === 19.6) {
          const orb = new THREE.Mesh(lanternOrbGeo, pierGlowMat);
          orb.position.set(px, 1.34, pz);
          pierGroup.add(orb);
        }
      }
    }

    // Stepped stone/wood water-edge ledge at z = 14.2 for releasing hoa đăng
    const step = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.14, 0.85), darkWoodMat);
    step.position.set(0, 0.22, 14.1);
    pierGroup.add(step);

    // Draped guide ropes connecting pier bollards along both sides
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#3b2818', roughness: 0.95 });
    const postZList = [14.8, 19.6, 24.4, 29.2];
    for (const px of [-3.95, 3.95]) {
      for (let i = 0; i < postZList.length - 1; i++) {
        const z0 = postZList[i];
        const z1 = postZList[i + 1];
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(px, 1.02, z0),
          new THREE.Vector3(px, 0.72, (z0 + z1) * 0.5),
          new THREE.Vector3(px, 1.02, z1)
        );
        const ropeGeo = new THREE.TubeGeometry(curve, 8, 0.025, 5, false);
        pierGroup.add(new THREE.Mesh(ropeGeo, ropeMat));
      }
    }

    // Woven wooden tray holding 3 glowing spare lotus hoa đăng on the release step
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.54, 0.08, 10), darkWoodMat);
    tray.position.set(2.15, 0.33, 14.15);
    pierGroup.add(tray);

    const spareLotusGeo = createHoaDangGeometry();
    const spareGlowMat = new THREE.MeshBasicMaterial({ color: '#ffae42' });
    for (const [lx, lz] of [[1.95, 14.08], [2.32, 14.05], [2.16, 14.32]]) {
      const spare = new THREE.Mesh(spareLotusGeo, spareGlowMat);
      spare.position.set(lx, 0.37, lz);
      spare.scale.setScalar(0.55);
      pierGroup.add(spare);
    }

    this.scene.add(pierGroup);
  }

  private buildSilhouettedSampanBoats(): void {
    this.boatGroups = [];
    const hullMat = new THREE.MeshStandardMaterial({
      color: '#120b08',
      roughness: 0.9,
      metalness: 0.05
    });
    const bowGlowMat = new THREE.MeshBasicMaterial({ color: '#ff9d2e' });

    const boatSpecs: Array<{ x: number; z: number; rotY: number; phase: number }> = [
      { x: -18, z: -12, rotY: 0.45, phase: 0.6 },
      { x: 22, z: -20, rotY: -0.62, phase: 2.3 },
      { x: -32, z: -38, rotY: 1.05, phase: 4.1 }
    ];

    const hullGeo = new THREE.CylinderGeometry(0.75, 0.42, 6.2, 8, 1, false, 0, Math.PI);
    hullGeo.rotateZ(Math.PI / 2);
    hullGeo.rotateX(Math.PI);

    const poleGeo = new THREE.CylinderGeometry(0.03, 0.035, 1.5, 6);
    const lanternGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.36, 8);

    for (const spec of boatSpecs) {
      const group = new THREE.Group();
      group.name = 'LanternSampanBoat';

      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.set(0, 0.28, 0);
      group.add(hull);

      // Curved bow lantern pole & warm glowing prow lantern
      const pole = new THREE.Mesh(poleGeo, hullMat);
      pole.position.set(2.55, 0.95, 0);
      pole.rotation.z = -0.28;
      group.add(pole);

      const bowLantern = new THREE.Mesh(lanternGeo, bowGlowMat);
      bowLantern.position.set(2.82, 1.48, 0);
      group.add(bowLantern);

      group.position.set(spec.x, 0.02, spec.z);
      group.rotation.y = spec.rotY;
      this.scene.add(group);
      this.boatGroups.push({ group, baseX: spec.x, baseZ: spec.z, phase: spec.phase });
    }
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = deltaTime;
    this.lastElapsedTime = elapsedTime;

    if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = elapsedTime;
    if (this.waterMaterial) this.waterMaterial.uniforms.uTime.value = elapsedTime;
    if (this.skyLanternMaterial) this.skyLanternMaterial.uniforms.uTime.value = elapsedTime;
    if (this.skyLanternReflMaterial) this.skyLanternReflMaterial.uniforms.uTime.value = elapsedTime;
    if (this.brassLanternMaterial) this.brassLanternMaterial.uniforms.uTime.value = elapsedTime;
    if (this.brassLanternReflMaterial) this.brassLanternReflMaterial.uniforms.uTime.value = elapsedTime;
    if (this.hoaDangMaterial) this.hoaDangMaterial.uniforms.uTime.value = elapsedTime;
    if (this.hoaDangReflMaterial) this.hoaDangReflMaterial.uniforms.uTime.value = elapsedTime;
    if (this.rippleMaterial) this.rippleMaterial.uniforms.uTime.value = elapsedTime;
    if (this.emberMaterial) this.emberMaterial.uniforms.uTime.value = elapsedTime;

    // Gentle boat rocking on night ripples
    for (const b of this.boatGroups) {
      b.group.position.y = 0.02 + Math.sin(elapsedTime * 1.15 + b.phase) * 0.04;
      b.group.rotation.x = Math.sin(elapsedTime * 0.9 + b.phase) * 0.028;
      b.group.rotation.z = Math.cos(elapsedTime * 0.8 + b.phase) * 0.022;
    }

    // Subtle candle flicker on warm pier/water point lights
    for (let i = 0; i < this.warmLights.length; i++) {
      const baseInt = this.currentConfig?.lighting.pointLights[i]?.intensity ?? 1.8;
      this.warmLights[i].intensity = baseInt * (0.92 + 0.08 * Math.sin(elapsedTime * 4.2 + i * 2.1));
    }

    this.worldRuntime.update(this.boundCamera, elapsedTime);
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    if (this.emberMaterial && typeof renderer.getPixelRatio === 'function') {
      this.emberMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    }
    if (this.pipeline) {
      this.pipeline.renderFrame(renderer, camera, this.lastDeltaTime, this.lastElapsedTime);
    } else {
      renderer.render(this.scene, camera);
    }
  }

  public setAudioEnergy(bass: number, mid: number, _treble: number): void {
    if (!this.isInitialized) return;
    const safeBass = Number.isFinite(bass) ? Math.max(0, Math.min(2, bass)) : 0;
    const safeMid = Number.isFinite(mid) ? Math.max(0, Math.min(2, mid)) : 0;

    if (this.skyMaterial) this.skyMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.waterMaterial) {
      this.waterMaterial.uniforms.uBassEnergy.value = safeBass;
      this.waterMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.skyLanternMaterial) {
      this.skyLanternMaterial.uniforms.uBassEnergy.value = safeBass;
      this.skyLanternMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.skyLanternReflMaterial) {
      this.skyLanternReflMaterial.uniforms.uBassEnergy.value = safeBass;
      this.skyLanternReflMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.brassLanternMaterial) {
      this.brassLanternMaterial.uniforms.uBassEnergy.value = safeBass;
      this.brassLanternMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.brassLanternReflMaterial) {
      this.brassLanternReflMaterial.uniforms.uBassEnergy.value = safeBass;
      this.brassLanternReflMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.hoaDangMaterial) {
      this.hoaDangMaterial.uniforms.uBassEnergy.value = safeBass;
      this.hoaDangMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.hoaDangReflMaterial) {
      this.hoaDangReflMaterial.uniforms.uBassEnergy.value = safeBass;
      this.hoaDangReflMaterial.uniforms.uMidEnergy.value = safeMid;
    }
    if (this.rippleMaterial) this.rippleMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.emberMaterial) this.emberMaterial.uniforms.uBassEnergy.value = safeBass;
  }

  public updateConfig(newConfig: Partial<SpaceConfig>): void {
    if (!this.currentConfig) return;

    if (newConfig.fog) {
      this.currentConfig.fog = { ...this.currentConfig.fog, ...newConfig.fog };
      const c = new THREE.Color(this.currentConfig.fog.color);
      this.scene.background = c;
      this.scene.fog = new THREE.FogExp2(this.currentConfig.fog.color, this.currentConfig.fog.density);
    }

    if (newConfig.wind) {
      this.currentConfig.wind = { ...this.currentConfig.wind, ...newConfig.wind };
      const wStr = Math.max(0.1, Math.min(3.0, this.currentConfig.wind.swayIntensity * 1.4));
      if (this.skyLanternMaterial) this.skyLanternMaterial.uniforms.uWindStrength.value = wStr;
      if (this.skyLanternReflMaterial) this.skyLanternReflMaterial.uniforms.uWindStrength.value = wStr;
      if (this.brassLanternMaterial) this.brassLanternMaterial.uniforms.uWindStrength.value = wStr;
      if (this.brassLanternReflMaterial) this.brassLanternReflMaterial.uniforms.uWindStrength.value = wStr;
    }

    if (this.onConfigUpdate) {
      this.onConfigUpdate(this.currentConfig);
    }
  }

  public getGroundHeight(x: number, z: number): number {
    return getLanternNightHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 0;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 22;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.65;
    const lookAt = this.currentConfig?.camera?.lookAt ?? [0, 5.2, -32];
    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2])
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = this.currentConfig?.camera?.wanderRadius ?? 95;
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
        name: 'Bến Thả Hoa Đăng',
        position: new THREE.Vector3(0, 2.15, 22),
        lookAt: new THREE.Vector3(0, 5.2, -32),
        dwellTime: 10.0
      },
      {
        name: 'Giữa Biển Hoa Đăng',
        position: new THREE.Vector3(-12, 1.35, 2),
        lookAt: new THREE.Vector3(4, 1.6, -24),
        dwellTime: 10.0
      },
      {
        name: 'Dòng Đèn Trời Bay Cao',
        position: new THREE.Vector3(0, 2.4, 8),
        lookAt: new THREE.Vector3(0, 24.0, -35),
        dwellTime: 12.0
      },
      {
        name: 'Gương Nước Đêm Đen',
        position: new THREE.Vector3(14, 0.95, 10),
        lookAt: new THREE.Vector3(-6, -2.5, -28),
        dwellTime: 10.0
      },
      {
        name: 'Thuyền Hoa Đăng Đêm',
        position: new THREE.Vector3(-10, 1.9, -4),
        lookAt: new THREE.Vector3(-18, 1.1, -12),
        dwellTime: 9.0
      },
      {
        name: 'Toàn Cảnh Đêm Đèn Lồng',
        position: new THREE.Vector3(0, 14.0, 42),
        lookAt: new THREE.Vector3(0, 7.0, -28),
        dwellTime: 12.0
      }
    ];
  }

  public dispose(): void {
    if (!this.isInitialized) return;

    this.pipeline?.dispose();
    this.pipeline = null;
    this.worldRuntime.dispose();

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    this.boundCamera = null;
    this.skyMaterial = null;
    this.waterMaterial = null;
    this.skyLanternMaterial = null;
    this.skyLanternReflMaterial = null;
    this.brassLanternMaterial = null;
    this.brassLanternReflMaterial = null;
    this.hoaDangMaterial = null;
    this.hoaDangReflMaterial = null;
    this.rippleMaterial = null;
    this.emberMaterial = null;
    this.boatGroups = [];
    this.warmLights = [];

    this.isInitialized = false;
  }
}
