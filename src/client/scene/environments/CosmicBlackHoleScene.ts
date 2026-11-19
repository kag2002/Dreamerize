import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import {
  PbrTextureSet,
  applyWorldSpaceWeathering,
  createGraniteCliffPbrTextures,
  disposePbrTextureSet
} from '../textures/pbrTextures';
import {
  BasaltPbrTextureSet,
  createBasaltObsidianPbrTextures,
  disposeBasaltPbrTextures,
  createCosmicNebulaSkyMaterial,
  createSchwarzschildBlackHoleMaterial,
  createSurrealSunMaterial,
  createSolarCoronaMaterial,
  createSolarProminenceArcMaterial,
  createGasGiantMaterial,
  createPlanetaryRingMaterial,
  createAuroraMoonMaterial,
  createAuroraShellMaterial,
  createOrbitalMotesMaterial,
  createShootingMeteorsMaterial,
  createObsidianTerrainMaterial
} from '../shaders/cosmicBlackHoleShader';

/**
 * Analytical walkable cosmic obsidian terrace height h(x, z).
 * Smooth floating sanctuary plateau + gentle volcanic dune undulation across 680m x 680m in O(1) time.
 */
export function getCosmicBlackHoleHeight(x: number, z: number): number {
  const r2 = x * x + z * z;
  const horizonDrop = -0.000085 * Math.min(r2, 130000);
  const rimSwell = 2.4 * Math.max(0, Math.min(1, (Math.sqrt(r2) - 115) / 140)) * Math.sin(0.024 * x + 0.021 * z);
  return (
    1.2 * Math.cos(0.045 * x) * Math.cos(0.045 * z) +
    0.45 * Math.sin(0.09 * x + 0.5) +
    horizonDrop +
    rimSwell
  );
}

/**
 * Builds a craggy natural volcanic rock outcrop BufferGeometry (64x16 displaced radial strata)
 * with irregular horizontal lava-cooling shelves and zero hexagonal cylinder facets.
 */
function createCraggyVolcanicOutcropGeometry(seed = 1.0): THREE.BufferGeometry {
  const radialSegs = 64;
  const heightSegs = 20;
  const geo = new THREE.CylinderGeometry(0.84, 1.38, 1.0, radialSegs, heightSegs, false);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const hNorm = Math.max(0, Math.min(1, vy + 0.5));
    const rHoriz = Math.hypot(vx, vz);
    const ang = Math.atan2(vz, vx);

    if (rHoriz > 1e-4) {
      const strata = Math.sin(hNorm * Math.PI * 6.0) * 0.045 + Math.cos(hNorm * Math.PI * 12.0) * 0.018;
      const shelfWave = Math.sin(hNorm * Math.PI * 7.0 + ang * 2.0 + seed) * 0.065;
      const crag =
        1.0 +
        0.20 * Math.sin(ang * 3.0 + seed * 1.3) +
        0.13 * Math.cos(ang * 5.0 - hNorm * 4.5 + seed * 2.1) +
        0.07 * Math.sin(ang * 8.0 + hNorm * 6.5) -
        strata +
        shelfWave;
      vx *= crag;
      vz *= crag * (0.86 + 0.14 * Math.cos(seed * 3.1));
    }

    // Natural uneven volcanic rock shelf top instead of flat cylinder cap
    if (hNorm > 0.88) {
      const topRelief =
        0.07 * Math.sin(vx * 2.8 + seed) * Math.cos(vz * 2.6 - seed) +
        0.04 * Math.sin(ang * 4.0 + seed);
      vy += topRelief;
    }
    pos.setXYZ(i, vx, vy, vz);
  }
  geo.computeVertexNormals();
  return applyObsidianBoxPlanarUVs(geo, 0.24);
}

function applyObsidianBoxPlanarUVs(geo: THREE.BufferGeometry, tileScale = 0.28): THREE.BufferGeometry {
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

/**
 * Builds a grounded, jagged fractured volcanic basalt canyon spire BufferGeometry
 * with stepped cleavage shelves, angular rock facets, and crisp planar UVs.
 */
function createJaggedBasaltSpireGeometry(seed = 1.0): THREE.BufferGeometry {
  const radialSegs = 16;
  const heightSegs = 18;
  const totalH = 6.2; // y from -1.4 (rooted underground) to +4.8 (craggy peak)
  const geo = new THREE.CylinderGeometry(0.22, 1.48, totalH, radialSegs, heightSegs, false);
  geo.translate(0, 1.7, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);
    const hNorm = Math.max(0, Math.min(1, (vy + 1.4) / totalH));
    const ang = Math.atan2(vz, vx);

    // Smooth stratified volcanic cleavage shelves + fluted basalt ridges
    const shelf = Math.sin(hNorm * Math.PI * 8.0) * 0.045;
    const ridge = 1.0 + 0.24 * Math.sin(ang * 3.0 + hNorm * 3.8 + seed) + 0.13 * Math.cos(ang * 5.0 - hNorm * 6.0);
    const shearX = Math.sin(hNorm * 3.1 + seed) * 0.22 * hNorm;
    const shearZ = Math.cos(hNorm * 2.7 + seed * 1.4) * 0.16 * hNorm;

    if (hNorm > 0.94) {
      vy += Math.sin(ang * 2.0 + seed) * 0.28;
    }
    vx = vx * (ridge - shelf) + shearX;
    vz = vz * (ridge - shelf) + shearZ;
    pos.setXYZ(i, vx, vy, vz);
  }
  geo.computeVertexNormals();
  return applyObsidianBoxPlanarUVs(geo, 0.26);
}

/**
 * Builds a grounded fractured volcanic obsidian monolith obelisk with chiseled bevels,
 * stepped basal rock buttress, and sheared oblique fracture planes.
 */
function createFracturedObsidianMonolithGeometry(seed = 2.0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Main chiseled fractured obsidian blade shaft (rooted -1.5m into basalt ground)
  const shaft = new THREE.CylinderGeometry(0.46, 0.92, 5.4, 12, 12, false);
  shaft.translate(0, 1.2, 0);
  const sPos = shaft.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    let vx = sPos.getX(i);
    let vy = sPos.getY(i);
    let vz = sPos.getZ(i);
    const hNorm = Math.max(0, Math.min(1, (vy + 1.5) / 5.4));
    const ang = Math.atan2(vz, vx);
    // Elongate into dramatic volcanic obsidian blade + smooth stratified rock flutes
    const notch = 0.94 + 0.06 * Math.sin(hNorm * 10.0 + ang * 2.0 + seed);
    vx *= 1.18 * notch;
    vz *= 0.72 * notch;
    // Oblique sheared top cleavage plane (authentic fractured volcanic glass)
    if (hNorm > 0.86) {
      vy += vx * 0.42 + vz * 0.22;
    }
    sPos.setXYZ(i, vx, vy, vz);
  }
  shaft.computeVertexNormals();
  parts.push(shaft.index ? shaft.toNonIndexed() : shaft);

  // Grounded secondary rock shard buttress wedged at base
  const buttress = new THREE.CylinderGeometry(0.20, 0.74, 2.8, 10, 6, false);
  buttress.rotateZ(0.22);
  buttress.rotateY(0.8);
  buttress.translate(0.56, 0.05, 0.22);
  buttress.computeVertexNormals();
  parts.push(buttress.index ? buttress.toNonIndexed() : buttress);

  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  shaft.dispose();
  buttress.dispose();
  merged.computeVertexNormals();
  return applyObsidianBoxPlanarUVs(merged, 0.28);
}

/**
 * Builds a grounded cluster of shattered volcanic obsidian crystal shards
 * with asymmetric oblique cleavage planes and jagged basal rock roots.
 */
function createShatteredObsidianCrystalClusterGeometry(seed = 3.7): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shards: Array<{ dx: number; dz: number; rTop: number; rBot: number; h: number; tiltX: number; tiltZ: number; yaw: number }> = [
    { dx: 0.0, dz: 0.0, rTop: 0.16, rBot: 0.62, h: 3.4, tiltX: 0.08, tiltZ: -0.06, yaw: 0.2 },
    { dx: 0.58, dz: 0.22, rTop: 0.11, rBot: 0.44, h: 2.5, tiltX: -0.22, tiltZ: 0.28, yaw: 1.4 },
    { dx: -0.48, dz: 0.34, rTop: 0.10, rBot: 0.42, h: 2.2, tiltX: 0.26, tiltZ: 0.22, yaw: 2.6 },
    { dx: -0.18, dz: -0.52, rTop: 0.09, rBot: 0.38, h: 1.9, tiltX: -0.24, tiltZ: -0.18, yaw: 4.1 }
  ];

  shards.forEach((sh, idx) => {
    const g = new THREE.CylinderGeometry(sh.rTop, sh.rBot, sh.h, 7, 6, false);
    g.translate(0, sh.h * 0.5 - 0.95, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);
      const hNorm = Math.max(0, Math.min(1, (vy + 0.95) / sh.h));
      const ang = Math.atan2(vz, vx);
      const notch = 0.92 + 0.08 * Math.sin(ang * 3.0 + hNorm * 5.0 + seed + idx);
      vx *= 1.15 * notch;
      vz *= 0.80 * notch;
      if (hNorm > 0.82) {
        vy += vx * 0.55 - vz * 0.28;
      }
      pos.setXYZ(i, vx, vy, vz);
    }
    g.rotateX(sh.tiltX);
    g.rotateZ(sh.tiltZ);
    g.rotateY(sh.yaw);
    g.translate(sh.dx, 0, sh.dz);
    g.computeVertexNormals();
    parts.push(g.index ? g.toNonIndexed() : g);
  });

  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return applyObsidianBoxPlanarUVs(merged, 0.30);
}

/**
 * CosmicBlackHoleScene implements ISpace for Space 3:
 * "Vũ trụ Hố đen & Mặt trời siêu thực" (Surreal Black Hole & Solar Sanctuary).
 */
export class CosmicBlackHoleScene implements ISpace {
  readonly id = 'space-cosmic-blackhole';
  readonly name = 'Vũ trụ Hố đen & Mặt trời siêu thực';
  readonly slug = 'cosmic-blackhole';

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;
  private hasUserMutation = false;
  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  private skyMaterial: THREE.ShaderMaterial | null = null;
  private blackHoleMaterial: THREE.ShaderMaterial | null = null;
  private sunMaterial: THREE.ShaderMaterial | null = null;
  private coronaMaterial: THREE.ShaderMaterial | null = null;
  private solarArcMaterials: THREE.ShaderMaterial[] = [];
  private gasGiantMaterial: THREE.ShaderMaterial | null = null;
  private planetaryRingMaterial: THREE.ShaderMaterial | null = null;
  private auroraMoonMaterial: THREE.ShaderMaterial | null = null;
  private auroraShellMaterial: THREE.ShaderMaterial | null = null;
  private orbitalMotesMaterial: THREE.ShaderMaterial | null = null;
  private meteorMaterial: THREE.ShaderMaterial | null = null;
  private magmaticObsidianMaterial: THREE.MeshStandardMaterial | null = null;
  private magmaUniforms: { uTime: { value: number }; uBassEnergy: { value: number } } | null = null;
  private terrainMaterial: THREE.ShaderMaterial | null = null;
  private starPointsMaterial: THREE.ShaderMaterial | null = null;

  private blackHoleMesh: THREE.Mesh | null = null;
  private coronaMesh: THREE.Mesh | null = null;
  private gasGiantMesh: THREE.Mesh | null = null;
  private auroraMoonMesh: THREE.Mesh | null = null;

  private readonly bhScale = 6.8;
  private readonly bhBoundRadiusUnits = 12.2;
  private readonly bhCenter = new THREE.Vector3(-52, 54, -162);

  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private pipeline: CinematicPipeline | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private basaltPbrSet: BasaltPbrTextureSet | null = null;
  private pbrSets: PbrTextureSet[] = [];
  private boundRenderer: THREE.WebGLRenderer | null = null;
  private prevShadowEnabled = false;
  private prevShadowType: THREE.ShadowMapType = THREE.PCFSoftShadowMap;
  private lastDeltaTime = 0.016;
  private lastElapsedTime = 0.0;

  // Local normal of the accretion disk inside bhGroup
  private readonly diskNormalLocal = new THREE.Vector3(-0.18, 0.86, 0.48).normalize();
  // Pre-allocated scratch math objects for zero per-frame allocations
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchVec3 = new THREE.Vector3();
  private readonly scratchMat4 = new THREE.Matrix4();
  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchEuler = new THREE.Euler();

  constructor() {
    this.scene = new THREE.Scene();
  }

  public getPipeline(): CinematicPipeline | null {
    return this.pipeline;
  }

  public async init(
    _renderer: THREE.WebGLRenderer,
    _camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> {
    if (this.isInitialized) {
      this.dispose();
    }

    this.scene = new THREE.Scene();
    this.boundRenderer = _renderer ?? null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;

    if (_renderer && (_renderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.prevShadowEnabled = Boolean(_renderer.shadowMap.enabled);
      this.prevShadowType = _renderer.shadowMap.type;
      _renderer.shadowMap.enabled = true;
      _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#08051a',
        density: config?.fog?.density ?? 0.0032
      },
      sky: {
        type: config?.sky?.type ?? 'cosmic_nebula',
        topColor: config?.sky?.topColor ?? '#03020b',
        bottomColor: config?.sky?.bottomColor ?? '#1a0c38',
        horizonColor: config?.sky?.horizonColor ?? '#0c2342',
        swirlSpeed: config?.sky?.swirlSpeed ?? 1.0,
        starDensity: config?.sky?.starDensity ?? 3000
      },
      wind: {
        speed: config?.wind?.speed ?? 1.2,
        direction: config?.wind?.direction ?? [1.0, 0.2, 0.4],
        gustiness: config?.wind?.gustiness ?? 0.3,
        swayIntensity: config?.wind?.swayIntensity ?? 0.5
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#24184a',
          intensity: config?.lighting?.ambient?.intensity ?? 0.65
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#ffd27d',
          intensity: config?.lighting?.directional?.intensity ?? 1.55,
          position: config?.lighting?.directional?.position ?? [88, 62, -175],
          castShadow: false
        },
        pointLights: config?.lighting?.pointLights ?? []
      },
      shaders: config?.shaders ?? {
        swirlFlow: { frequency: 1.5, amplitude: 0.8, timeScale: 1.0 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'cosmic-blackhole-ambient',
        name: config?.audio?.name ?? "Gravity's Edge",
        sourceUrl: config?.audio?.sourceUrl ?? '/music/gravitys-edge.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.7,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 3.5, wet: 0.4 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 1.7, 16],
        lookAt: config?.camera?.lookAt ?? [6, 22, -85],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 4.5,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.2,
        wanderRadius: Math.max(config?.camera?.wanderRadius ?? 124, 124),
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 3.0, 16],
          [-16, 4.5, -10],
          [18, 4.5, -12],
          [-46, 4.5, -24],
          [-86, 5.2, -52],
          [76, 4.8, -42],
          [84, 5.0, 56],
          [-78, 5.0, 58],
          [0, 6.0, 92]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    this.scene.fog = new THREE.FogExp2(this.currentConfig.fog.color, this.currentConfig.fog.density);

    this.ambientLight = new THREE.AmbientLight(
      this.currentConfig.lighting.ambient.color,
      this.currentConfig.lighting.ambient.intensity
    );
    this.scene.add(this.ambientLight);

    const dirPos = this.currentConfig.lighting.directional.position;
    this.directionalLight = new THREE.DirectionalLight(
      this.currentConfig.lighting.directional.color,
      this.currentConfig.lighting.directional.intensity
    );
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(2048, 2048);
    this.directionalLight.shadow.camera.near = 10;
    this.directionalLight.shadow.camera.far = 360;
    this.directionalLight.shadow.camera.left = -115;
    this.directionalLight.shadow.camera.right = 115;
    this.directionalLight.shadow.camera.top = 115;
    this.directionalLight.shadow.camera.bottom = -115;
    this.directionalLight.shadow.bias = -0.0003;
    this.directionalLight.shadow.normalBias = 0.025;
    this.scene.add(this.directionalLight);

    // Subtle cosmic fill lights from the Black Hole & Gas Giant hemispheres for crystalline & basalt speculars
    const bhRimLight = new THREE.PointLight('#a855f7', 3.0, 280, 1.15);
    bhRimLight.position.set(-52, 54, -162);
    bhRimLight.name = 'BlackHoleRimLight';
    this.scene.add(bhRimLight);

    const giantRimLight = new THREE.PointLight('#38bdf8', 2.4, 280, 1.15);
    giantRimLight.position.set(-58, 56, 194);
    giantRimLight.name = 'GasGiantRimLight';
    this.scene.add(giantRimLight);

    // 1. Full 360° Deep Cosmic Nebula Sky Dome, Starfield & PMREM Space-Nebula IBL
    this.buildSkyDome(config);
    this.bakeCosmicEnvironment(_renderer, config);
    this.buildStarfield();

    // 2. Relativistic Gargantua-Style Black Hole (-Z left focal point)
    this.buildBlackHole();

    // 3. Boiling Surreal Corona Sun & Magnetic Prominences (-Z right focal point)
    this.buildSurrealSun();

    // 4. 360° Opposite-Hemisphere Ringed Iridescent Gas Giant & Aurora Moon (+Z sky)
    this.buildGasGiantAndAuroraMoon();

    // 5. AAA 512x512 Basalt/Obsidian & Granite Cliff PBR Textures, Canyon Cliffs, Mirror Salt-Flat, Stardust Rings & Monoliths
    this.basaltPbrSet = createBasaltObsidianPbrTextures(_renderer, 512, 1, 1);
    const graniteCliffPbr = createGraniteCliffPbrTextures({
      size: 512,
      seed: 809,
      renderer: _renderer,
      normalStrength: 4.0
    });
    this.pbrSets = [graniteCliffPbr];
    this.buildObsidianTerrain();
    this.buildVolcanicBasaltCanyon();
    this.buildOrbitingStardustRings();
    this.buildShootingMeteors();
    this.buildVolcanicObsidianMonolithsAndSpires(graniteCliffPbr);

    // Sync initial swirlSpeed across all animated shaders
    const swirl = this.currentConfig.sky.swirlSpeed;
    this.applySwirlSpeed(swirl);

    // 6. HDR Natural Post-Processing Pipeline (AgXToneMapping + DepthTexture Micro-Contrast + Crisp Bloom)
    this.pipeline = new CinematicPipeline(_renderer, this.scene, _camera, {
      defaultStyle: 'natural',
      bloomStrength: 0.30,
      bloomRadius: 0.40,
      bloomThreshold: 0.90
    });

    this.isInitialized = true;
  }

  private bakeCosmicEnvironment(renderer?: THREE.WebGLRenderer, config?: SpaceConfig): void {
    if (!renderer || typeof renderer.getContext !== 'function') return;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      const envSkyGeo = new THREE.SphereGeometry(120, 32, 16);
      const envSkyMat = createCosmicNebulaSkyMaterial({
        swirlSpeed: config?.sky?.swirlSpeed ?? 1.0,
        topColor: config?.sky?.topColor,
        bottomColor: config?.sky?.bottomColor,
        horizonColor: config?.sky?.horizonColor
      });
      const envSkyMesh = new THREE.Mesh(envSkyGeo, envSkyMat);
      envScene.add(envSkyMesh);

      // Luminous HDR proxy orbs so PBR basalt cliffs & obsidian columns reflect Gargantua, Sun, and Gas Giant
      const proxyGeo = new THREE.SphereGeometry(10, 16, 12);
      const bhProxyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 0.78, 0.42) });
      const bhProxy = new THREE.Mesh(proxyGeo, bhProxyMat);
      bhProxy.position.set(-52, 54, -162);
      envScene.add(bhProxy);

      const sunProxyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 1.35, 0.55) });
      const sunProxy = new THREE.Mesh(proxyGeo, sunProxyMat);
      sunProxy.position.set(88, 62, -175);
      envScene.add(sunProxy);

      const giantProxyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.15, 1.35) });
      const giantProxy = new THREE.Mesh(proxyGeo, giantProxyMat);
      giantProxy.position.set(-58, 56, 194);
      envScene.add(giantProxy);

      this.envRenderTarget = pmrem.fromScene(envScene, 0.04);
      this.scene.environment = this.envRenderTarget.texture;
      this.scene.environmentIntensity = 0.92;

      envSkyGeo.dispose();
      envSkyMat.dispose();
      proxyGeo.dispose();
      bhProxyMat.dispose();
      sunProxyMat.dispose();
      giantProxyMat.dispose();
      pmrem.dispose();
    } catch {
      // Safe fallback on headless mock renderers
    }
  }

  private buildSkyDome(config?: SpaceConfig): void {
    const geo = new THREE.SphereGeometry(560, 64, 32);
    this.skyMaterial = createCosmicNebulaSkyMaterial({
      swirlSpeed: config?.sky?.swirlSpeed ?? 1.0,
      topColor: config?.sky?.topColor,
      bottomColor: config?.sky?.bottomColor,
      horizonColor: config?.sky?.horizonColor
    });
    const mesh = new THREE.Mesh(geo, this.skyMaterial);
    mesh.name = 'SkyDome';
    this.scene.add(mesh);
  }

  private buildStarfield(): void {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    const palette = [
      new THREE.Color('#fff9e6'),
      new THREE.Color('#93c5fd'),
      new THREE.Color('#f9a8d4'),
      new THREE.Color('#fde68a'),
      new THREE.Color('#6ee7b7')
    ];

    for (let i = 0; i < count; i++) {
      // Independent quasi-random seeds covering the entire 360° celestial sphere
      const u = Math.abs(Math.sin(i * 12.9898 + 1.23) * 43758.5453) % 1.0;
      const v = Math.abs(Math.sin(i * 78.233 + 4.56) * 19341.123) % 1.0;
      const theta = u * Math.PI * 2.0;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 395.0 + ((i * 0.137) % 1.0) * 70.0;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      phases[i] = i * 0.91;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.starPointsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uStarBrightness: { value: 1.0 }
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec3 aColor;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vColor = aColor;
          vTwinkle = 0.54 + 0.46 * sin(uTime * 1.7 + aPhase);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(1.1 + 1.9 * vTwinkle, 1.0, 3.2);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStarBrightness;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float core = pow(smoothstep(0.5, 0.0, d), 2.1);
          gl_FragColor = vec4(vColor * uStarBrightness, core * vTwinkle);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, this.starPointsMaterial);
    points.name = 'CosmicStarfield';
    this.scene.add(points);
  }

  private buildBlackHole(): void {
    const bhGroup = new THREE.Group();
    bhGroup.name = 'BlackHoleSingularity';
    bhGroup.position.copy(this.bhCenter);

    // Unified 3D Schwarzschild geodesic raymarching volume (pure #000000 event horizon core +
    // razor-bright thin Photon Ring + warped upper/lower lensed arches + Doppler accretion disk)
    const boundRadius = this.bhBoundRadiusUnits * this.bhScale;
    const bhGeo = new THREE.SphereGeometry(boundRadius, 48, 32);
    this.blackHoleMaterial = createSchwarzschildBlackHoleMaterial(this.bhScale);

    const diskNorm = this.diskNormalLocal.clone().normalize();
    const diskTan = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), diskNorm).normalize();
    const diskBitan = new THREE.Vector3().crossVectors(diskNorm, diskTan).normalize();
    this.blackHoleMaterial.uniforms.uDiskNormal.value.copy(diskNorm);
    this.blackHoleMaterial.uniforms.uDiskTangent.value.copy(diskTan);
    this.blackHoleMaterial.uniforms.uDiskBitangent.value.copy(diskBitan);

    this.blackHoleMesh = new THREE.Mesh(bhGeo, this.blackHoleMaterial);
    this.blackHoleMesh.name = 'SchwarzschildBlackHoleVolume';
    this.blackHoleMesh.renderOrder = 2;
    bhGroup.add(this.blackHoleMesh);

    this.scene.add(bhGroup);
  }

  private buildSurrealSun(): void {
    const sunGroup = new THREE.Group();
    sunGroup.name = 'SurrealSolarSystem';
    sunGroup.position.set(88, 62, -175);

    const sunRadius = 23.0;
    const sunGeo = new THREE.SphereGeometry(sunRadius, 64, 48);
    this.sunMaterial = createSurrealSunMaterial();
    const sunMesh = new THREE.Mesh(sunGeo, this.sunMaterial);
    sunMesh.name = 'SurrealSun';
    sunMesh.renderOrder = 1;
    sunGroup.add(sunMesh);

    const coronaSize = 156;
    const coronaGeo = new THREE.PlaneGeometry(coronaSize, coronaSize);
    this.coronaMaterial = createSolarCoronaMaterial();
    this.coronaMaterial.uniforms.uSunLimbUv.value = sunRadius / (coronaSize * 0.5);
    this.coronaMesh = new THREE.Mesh(coronaGeo, this.coronaMaterial);
    this.coronaMesh.name = 'SolarCorona';
    this.coronaMesh.renderOrder = 2;
    sunGroup.add(this.coronaMesh);

    // 3D Magnetic Coronal Loops & CME Prominence Arcs erupting from the solar photosphere
    this.solarArcMaterials = [];
    const arcSpecs: Array<{
      theta: number;
      phi: number;
      span: number;
      apex: number;
      tilt: number;
      tube: number;
      phase: number;
    }> = [
      { theta: 0.45, phi: 0.35, span: 0.42, apex: 8.8, tilt: 0.25, tube: 0.72, phase: 0.0 },
      { theta: 1.95, phi: -0.28, span: 0.38, apex: 7.6, tilt: -0.32, tube: 0.62, phase: 0.27 },
      { theta: -0.82, phi: 0.18, span: 0.48, apex: 10.4, tilt: 0.18, tube: 0.80, phase: 0.51 },
      { theta: -2.25, phi: -0.42, span: 0.36, apex: 7.2, tilt: -0.22, tube: 0.58, phase: 0.74 },
      { theta: 2.85, phi: 0.48, span: 0.34, apex: 6.8, tilt: 0.30, tube: 0.54, phase: 0.89 }
    ];

    arcSpecs.forEach((spec, idx) => {
      const pts: THREE.Vector3[] = [];
      const steps = 20;
      const baseDir = new THREE.Vector3(
        Math.cos(spec.phi) * Math.cos(spec.theta),
        Math.sin(spec.phi),
        Math.cos(spec.phi) * Math.sin(spec.theta)
      ).normalize();
      const tangent = new THREE.Vector3(-Math.sin(spec.theta), spec.tilt, Math.cos(spec.theta)).normalize();
      const binormal = new THREE.Vector3().crossVectors(baseDir, tangent).normalize();

      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const angleOff = (u - 0.5) * spec.span * 2.0;
        const archLift = Math.sin(u * Math.PI) * spec.apex;
        const twist = Math.sin(u * Math.PI * 2.0) * 1.4;
        const p = baseDir
          .clone()
          .multiplyScalar(Math.cos(angleOff))
          .addScaledVector(tangent, Math.sin(angleOff))
          .normalize()
          .multiplyScalar(sunRadius - 0.6 + archLift)
          .addScaledVector(binormal, twist);
        pts.push(p);
      }

      const curve = new THREE.CatmullRomCurve3(pts);
      const arcGeo = new THREE.TubeGeometry(curve, 28, spec.tube, 8, false);
      const arcMat = createSolarProminenceArcMaterial(spec.phase);
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.name = `SolarProminenceArc_${idx + 1}`;
      arcMesh.renderOrder = 3;
      sunGroup.add(arcMesh);
      this.solarArcMaterials.push(arcMat);
    });

    this.scene.add(sunGroup);
  }

  private buildGasGiantAndAuroraMoon(): void {
    const lightDir = new THREE.Vector3(0.65, 0.30, -0.69).normalize();

    // 1. Ringed Iridescent Gas Giant in the +Z hemisphere (discovered on 180°/360° pan)
    const giantCenter = new THREE.Vector3(-58, 56, 194);
    const giantGroup = new THREE.Group();
    giantGroup.name = 'IridescentGasGiantSystem';
    giantGroup.position.copy(giantCenter);

    const axialGroup = new THREE.Group();
    axialGroup.name = 'GasGiantAxialTilt';
    axialGroup.rotation.set(-0.56, 0.14, 0.24);

    const planetRadius = 23.5;
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 48);
    this.gasGiantMaterial = createGasGiantMaterial();
    this.gasGiantMaterial.uniforms.uLightDir.value.copy(lightDir);
    this.gasGiantMesh = new THREE.Mesh(planetGeo, this.gasGiantMaterial);
    this.gasGiantMesh.name = 'IridescentGasGiant';
    this.gasGiantMesh.renderOrder = 1;
    axialGroup.add(this.gasGiantMesh);

    const innerRing = 30.5;
    const outerRing = 59.5;
    const ringGeo = new THREE.RingGeometry(innerRing, outerRing, 128, 2);
    this.planetaryRingMaterial = createPlanetaryRingMaterial(
      innerRing,
      outerRing,
      planetRadius,
      giantCenter
    );
    this.planetaryRingMaterial.uniforms.uLightDir.value.copy(lightDir);
    const ringMesh = new THREE.Mesh(ringGeo, this.planetaryRingMaterial);
    ringMesh.name = 'GasGiantRings';
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.renderOrder = 2;
    axialGroup.add(ringMesh);

    giantGroup.add(axialGroup);
    this.scene.add(giantGroup);

    // 2. Aurora Moon accompanying the Gas Giant in the +Z hemisphere
    const moonGroup = new THREE.Group();
    moonGroup.name = 'AuroraMoonSystem';
    moonGroup.position.set(62, 62, 184);

    const moonGeo = new THREE.SphereGeometry(8.2, 48, 32);
    this.auroraMoonMaterial = createAuroraMoonMaterial();
    this.auroraMoonMaterial.uniforms.uLightDir.value.copy(lightDir);
    this.auroraMoonMesh = new THREE.Mesh(moonGeo, this.auroraMoonMaterial);
    this.auroraMoonMesh.name = 'AuroraMoon';
    this.auroraMoonMesh.renderOrder = 1;
    moonGroup.add(this.auroraMoonMesh);

    const auroraShellGeo = new THREE.SphereGeometry(9.7, 48, 32);
    this.auroraShellMaterial = createAuroraShellMaterial();
    const auroraShellMesh = new THREE.Mesh(auroraShellGeo, this.auroraShellMaterial);
    auroraShellMesh.name = 'MoonAuroraCorona';
    auroraShellMesh.renderOrder = 2;
    moonGroup.add(auroraShellMesh);

    this.scene.add(moonGroup);
  }

  private buildObsidianTerrain(): void {
    const terrainGeo = new THREE.PlaneGeometry(680, 680, 240, 240);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      posAttr.setY(i, getCosmicBlackHoleHeight(x, z));
    }
    terrainGeo.computeVertexNormals();

    this.terrainMaterial = createObsidianTerrainMaterial(this.basaltPbrSet ?? undefined);
    const terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMaterial);
    terrainMesh.name = 'ObsidianStarTerrain';
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
  }

  /**
   * Builds craggy natural volcanic rock outcrops (64x16 displaced radial strata),
   * towering stratified volcanic basalt canyon arches & mesas on the 440m horizon,
   * and an ancient obsidian astronomical ring / monolith observatory.
   */
  private buildVolcanicBasaltCanyon(): void {
    if (!this.basaltPbrSet) return;

    const basaltPbrMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0xb6c2de,
        map: this.basaltPbrSet.map,
        normalMap: this.basaltPbrSet.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: this.basaltPbrSet.roughnessMap,
        aoMap: this.basaltPbrSet.aoMap,
        aoMapIntensity: 0.92,
        roughness: 0.64,
        metalness: 0.18,
        envMapIntensity: 1.45
      }),
      {
        macroScale: 0.14,
        mossHeight: -0.5,
        mossColor: '#241a26',
        dampRoughness: 0.28,
        dirtTint: '#14111c'
      }
    );

    const obsidianShatterMat = applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0x626e94,
        map: this.basaltPbrSet.map,
        normalMap: this.basaltPbrSet.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: this.basaltPbrSet.roughnessMap,
        aoMap: this.basaltPbrSet.aoMap,
        aoMapIntensity: 0.85,
        roughness: 0.58,
        metalness: 0.16,
        envMapIntensity: 1.15
      }),
      {
        macroScale: 0.18,
        mossHeight: -0.4,
        mossColor: '#1c1824',
        dampRoughness: 0.30,
        dirtTint: '#100e18'
      }
    );

    // 1. Craggy Natural Volcanic Rock Outcrops (64x16 displaced radial strata — zero hexagonal cylinders!)
    const rockProto = createCraggyVolcanicOutcropGeometry(2.4);
    const colPositions: Array<{ x: number; z: number; r: number; h: number; tiltX: number; tiltZ: number; rotY: number }> = [];

    const addBasaltCluster = (cx: number, cz: number, count: number, spread: number, minH: number, maxH: number, seedBase: number) => {
      for (let i = 0; i < count; i++) {
        const h1 = Math.abs(Math.sin((seedBase + i) * 19.31 + 0.7) * 43758.54) % 1.0;
        const h2 = Math.abs(Math.sin((seedBase + i) * 73.17 + 1.9) * 19341.12) % 1.0;
        const h3 = Math.abs(Math.sin((seedBase + i) * 41.89 + 3.1) * 28471.63) % 1.0;

        const a = (i / count) * Math.PI * 2.0 + h1 * 0.7;
        const dist = (0.15 + 0.85 * Math.sqrt(h2)) * spread;
        const x = cx + Math.cos(a) * dist;
        const z = cz + Math.sin(a) * dist;
        const edgeFactor = Math.max(0.25, 1.0 - dist / (spread * 1.15));
        const h = minH + (maxH - minH) * edgeFactor * (0.45 + 0.55 * h3);
        const r = 1.05 + h1 * 1.15;

        colPositions.push({
          x,
          z,
          r,
          h,
          tiltX: (h2 - 0.5) * 0.16,
          tiltZ: (h3 - 0.5) * 0.16,
          rotY: h1 * Math.PI * 2
        });
      }
    };

    // Foreground framing volcanic rock outcrops (well outside spawn sightline x in [-10..10], z in [-5..22])
    addBasaltCluster(-24, 6, 16, 8.0, 1.2, 4.6, 100);
    addBasaltCluster(25, 5, 16, 8.0, 1.2, 4.8, 200);
    addBasaltCluster(-30, -18, 22, 10.5, 1.8, 7.2, 300);
    addBasaltCluster(32, -16, 22, 10.5, 1.8, 7.6, 400);

    // Mid-desert basalt outcrops across the expanded 124m obsidian dunes
    addBasaltCluster(-72, 34, 16, 10.0, 1.8, 6.8, 420);
    addBasaltCluster(76, -34, 16, 10.0, 1.8, 7.2, 440);
    addBasaltCluster(-76, -68, 18, 11.0, 2.2, 8.2, 460);
    addBasaltCluster(72, 68, 18, 11.0, 2.0, 7.6, 480);

    // Outer 360° volcanic basalt canyon mesas & stratified horizon rim (r ~ 154..228m)
    const rimSectors = 28;
    for (let s = 0; s < rimSectors; s++) {
      const ang = (s / rimSectors) * Math.PI * 2.0 + 0.14;
      const radius = 156 + (s % 4) * 22.0;
      const cx = Math.cos(ang) * radius;
      const cz = Math.sin(ang) * radius;
      const inSightline = Math.abs(cx) < 28 && Math.abs(cz) > 75;
      const maxH = inSightline ? 5.2 : 22.0 + (s % 4) * 6.5;
      addBasaltCluster(cx, cz, 14, 18.0, 4.2, maxH, 500 + s * 40);
    }

    const columnsMesh = new THREE.InstancedMesh(rockProto, basaltPbrMat, colPositions.length);
    columnsMesh.name = 'VolcanicBasaltOutcrops';
    columnsMesh.castShadow = true;
    columnsMesh.receiveShadow = true;

    const colDummy = new THREE.Matrix4();
    const colPos = new THREE.Vector3();
    const colQuat = new THREE.Quaternion();
    const colScale = new THREE.Vector3();
    const colEuler = new THREE.Euler();

    colPositions.forEach((c, idx) => {
      const gy = getCosmicBlackHoleHeight(c.x, c.z);
      const sinkY = gy - 1.8 + c.h * 0.5;
      colPos.set(c.x, sinkY, c.z);
      colEuler.set(c.tiltX, c.rotY, c.tiltZ);
      colQuat.setFromEuler(colEuler);
      colScale.set(c.r, c.h + 1.8, c.r);
      colDummy.compose(colPos, colQuat, colScale);
      columnsMesh.setMatrixAt(idx, colDummy);
    });
    columnsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(columnsMesh);

    // 2. Merged High-Res Craggy Obsidian Rock Outcrop Platforms (64x16 displaced radial strata — zero hex cylinders!)
    const shelfGeos: THREE.BufferGeometry[] = [];
    const baseOutcrop = createCraggyVolcanicOutcropGeometry(5.1);
    const slabSpecs: Array<[number, number, number, number, number]> = [
      [-17.5, 11.0, 4.2, 0.9, 0.3],
      [18.2, 10.5, 4.4, 0.95, -0.4],
      [-21.0, -5.0, 5.2, 1.4, 0.8],
      [22.5, -4.0, 5.4, 1.5, -0.7],
      [-14.5, 23.0, 3.8, 0.85, 1.1],
      [15.0, 22.5, 3.9, 0.85, -1.2],
      [-34.0, 24.0, 6.4, 2.2, 0.5],
      [35.0, 25.0, 6.2, 2.1, -0.5],
      [-58.0, 52.0, 7.2, 2.4, 0.7],
      [62.0, 48.0, 7.0, 2.3, -0.6],
      [-64.0, -54.0, 7.6, 2.6, 1.2],
      [66.0, -48.0, 7.4, 2.5, -1.1]
    ];

    for (const [sx, sz, rad, h, rotY] of slabSpecs) {
      const g = baseOutcrop.clone();
      g.scale(rad, h + 1.6, rad * 0.86);
      g.rotateY(rotY);
      const gy = getCosmicBlackHoleHeight(sx, sz);
      g.translate(sx, gy - 0.85 + h * 0.5, sz);
      const nonIdx = g.index ? g.toNonIndexed() : g;
      if (nonIdx !== g) g.dispose();
      shelfGeos.push(nonIdx);
    }
    baseOutcrop.dispose();

    // 3. Towering Stratified Volcanic Basalt Canyon Arches & Horizon Mesas (r ~ 105..165m)
    const archSpecs: Array<{ x: number; z: number; span: number; height: number; yaw: number }> = [
      { x: -94, z: -52, span: 32, height: 32, yaw: 0.55 },
      { x: 96, z: -48, span: 30, height: 30, yaw: -0.62 },
      { x: -92, z: 60, span: 34, height: 34, yaw: -0.48 },
      { x: 98, z: 62, span: 32, height: 32, yaw: 0.52 },
      { x: -146, z: 8, span: 38, height: 38, yaw: 1.42 },
      { x: 148, z: -10, span: 36, height: 36, yaw: -1.38 }
    ];

    const archParts: THREE.BufferGeometry[] = [];
    for (let ai = 0; ai < archSpecs.length; ai++) {
      const arch = archSpecs[ai];
      const gy = getCosmicBlackHoleHeight(arch.x, arch.z);

      // Left & right craggy mesa buttresses
      for (const side of [-1, 1]) {
        const bx = arch.x + Math.cos(arch.yaw) * side * (arch.span * 0.48);
        const bz = arch.z - Math.sin(arch.yaw) * side * (arch.span * 0.48);
        const buttress = createCraggyVolcanicOutcropGeometry(ai * 4.7 + side * 2.1);
        buttress.scale(6.8, arch.height * 0.92, 5.8);
        buttress.translate(bx, gy + arch.height * 0.36 - 2.0, bz);
        archParts.push(buttress.index ? buttress.toNonIndexed() : buttress);
      }

      // Sculpted stratified volcanic basalt arch span
      const segs = 20;
      const archPts: THREE.Vector3[] = [];
      for (let s = 0; s <= segs; s++) {
        const theta = (s / segs) * Math.PI;
        const lx = -Math.cos(theta) * (arch.span * 0.5);
        const ly = Math.sin(theta) * (arch.height * 0.56) + arch.height * 0.42;
        archPts.push(
          new THREE.Vector3(
            arch.x + Math.cos(arch.yaw) * lx,
            gy + ly - 1.5,
            arch.z - Math.sin(arch.yaw) * lx
          )
        );
      }
      const archTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts), 24, 3.2, 12, false);
      const aPos = archTube.attributes.position;
      for (let vi = 0; vi < aPos.count; vi++) {
        const vx = aPos.getX(vi);
        const vy = aPos.getY(vi);
        const vz = aPos.getZ(vi);
        const crag = Math.sin(vx * 0.38 + vy * 0.72) * 0.85 + Math.cos(vz * 0.42 - vy * 0.55) * 0.65;
        aPos.setXYZ(vi, vx + crag * 0.45, vy + Math.sin(vy * 2.4) * 0.35, vz + crag * 0.45);
      }
      archTube.computeVertexNormals();
      applyObsidianBoxPlanarUVs(archTube, 0.14);
      archParts.push(archTube.index ? archTube.toNonIndexed() : archTube);
    }

    // 4. Ancient Obsidian Astronomical Ring & Monolith Observatory at (-46, -24)
    const obsX = -46;
    const obsZ = -24;
    const obsY = getCosmicBlackHoleHeight(obsX, obsZ);
    const obsPlinth = createCraggyVolcanicOutcropGeometry(9.3);
    obsPlinth.scale(9.8, 2.8, 9.8);
    obsPlinth.translate(obsX, obsY - 0.5, obsZ);
    shelfGeos.push(obsPlinth.index ? obsPlinth.toNonIndexed() : obsPlinth);

    // Central carved obsidian astrolabe pedestal & gnomon spine anchoring the rings
    const centralPedestal = createCraggyVolcanicOutcropGeometry(10.7);
    centralPedestal.scale(2.1, 3.6, 2.1);
    centralPedestal.translate(obsX, obsY + 1.8, obsZ);
    shelfGeos.push(centralPedestal.index ? centralPedestal.toNonIndexed() : centralPedestal);

    // Twin heavy basalt gimbal pylons rising from the plinth to cradle the outer astronomical ring
    for (const side of [-1, 1]) {
      const cradleX = obsX + Math.cos(0.45) * side * 6.5;
      const cradleZ = obsZ - Math.sin(0.45) * side * 6.5;
      const cradlePylon = createCraggyVolcanicOutcropGeometry(15.2 + side);
      cradlePylon.scale(1.15, 7.6, 1.35);
      cradlePylon.rotateY(0.45);
      cradlePylon.translate(cradleX, obsY + 3.6, cradleZ);
      shelfGeos.push(cradlePylon.index ? cradlePylon.toNonIndexed() : cradlePylon);
    }

    const ringOuter = new THREE.TorusGeometry(6.4, 0.48, 16, 72);
    ringOuter.rotateX(Math.PI * 0.28);
    ringOuter.rotateY(0.45);
    ringOuter.translate(obsX, obsY + 7.2, obsZ);
    applyObsidianBoxPlanarUVs(ringOuter, 0.28);
    shelfGeos.push(ringOuter.index ? ringOuter.toNonIndexed() : ringOuter);

    const ringInner = new THREE.TorusGeometry(4.6, 0.34, 14, 56);
    ringInner.rotateX(-Math.PI * 0.32);
    ringInner.rotateZ(0.38);
    ringInner.translate(obsX, obsY + 7.2, obsZ);
    applyObsidianBoxPlanarUVs(ringInner, 0.28);
    shelfGeos.push(ringInner.index ? ringInner.toNonIndexed() : ringInner);

    for (let pi = 0; pi < 6; pi++) {
      const pa = (pi / 6) * Math.PI * 2 + 0.2;
      const px = obsX + Math.cos(pa) * 8.1;
      const pz = obsZ + Math.sin(pa) * 8.1;
      const pillar = createCraggyVolcanicOutcropGeometry(12.0 + pi);
      pillar.scale(1.05, 5.2, 0.85);
      pillar.rotateY(-pa);
      pillar.translate(px, obsY + 2.2, pz);
      shelfGeos.push(pillar.index ? pillar.toNonIndexed() : pillar);
    }

    const mergedShelves = mergeGeometries(shelfGeos, false);
    shelfGeos.forEach((g) => g.dispose());
    if (mergedShelves) {
      const shelvesMesh = new THREE.Mesh(mergedShelves, obsidianShatterMat);
      shelvesMesh.name = 'ObsidianCanyonShelves';
      shelvesMesh.castShadow = true;
      shelvesMesh.receiveShadow = true;
      this.scene.add(shelvesMesh);
    }

    const mergedArches = mergeGeometries(archParts, false);
    archParts.forEach((g) => g.dispose());
    if (mergedArches) {
      const archesMesh = new THREE.Mesh(mergedArches, basaltPbrMat);
      archesMesh.name = 'VolcanicBasaltCanyonArches';
      archesMesh.castShadow = true;
      archesMesh.receiveShadow = true;
      this.scene.add(archesMesh);
    }
  }

  private buildOrbitingStardustRings(): void {
    const ringsGroup = new THREE.Group();
    ringsGroup.name = 'OrbitingStardustRings';

    // Orbital stardust particle belts revolving gracefully without solid wire-tube scratches across the sky
    const beltSpecs = [
      { radius: 28, y: 12.0, tiltX: 0.12, tiltZ: -0.08 },
      { radius: 40, y: 17.5, tiltX: -0.15, tiltZ: 0.11 },
      { radius: 56, y: 22.5, tiltX: 0.09, tiltZ: 0.14 },
      { radius: 82, y: 28.0, tiltX: -0.10, tiltZ: 0.08 }
    ];

    const moteCount = 3200;
    const positions = new Float32Array(moteCount * 3);
    const orbitSpeeds = new Float32Array(moteCount);
    const phases = new Float32Array(moteCount);
    const colors = new Float32Array(moteCount * 3);

    const motePalette = [
      new THREE.Color('#67e8f9'),
      new THREE.Color('#c084fc'),
      new THREE.Color('#fde68a'),
      new THREE.Color('#6ee7b7')
    ];

    for (let i = 0; i < moteCount; i++) {
      const spec = beltSpecs[i % beltSpecs.length];
      const h1 = Math.abs(Math.sin(i * 19.31 + 0.7) * 43758.54) % 1.0;
      const h2 = Math.abs(Math.sin(i * 73.17 + 1.9) * 19341.12) % 1.0;
      const h3 = Math.abs(Math.sin(i * 41.89 + 3.1) * 28471.63) % 1.0;

      const angle = h1 * Math.PI * 2.0;
      const radialSpread = spec.radius + (h2 - 0.5) * 8.5;
      const lx = Math.cos(angle) * radialSpread;
      const lz = Math.sin(angle) * radialSpread;
      const ly = spec.y + (h3 - 0.5) * 4.2 - lz * Math.sin(spec.tiltX) + lx * Math.sin(spec.tiltZ);

      positions[i * 3] = lx;
      positions[i * 3 + 1] = ly;
      positions[i * 3 + 2] = lz;

      orbitSpeeds[i] = (i % 2 === 0 ? 1 : -0.75) * (0.045 + h2 * 0.065);
      phases[i] = h3 * Math.PI * 2.0;

      const c = motePalette[i % motePalette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    moteGeo.setAttribute('aOrbitSpeed', new THREE.BufferAttribute(orbitSpeeds, 1));
    moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    moteGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    this.orbitalMotesMaterial = createOrbitalMotesMaterial();
    const motes = new THREE.Points(moteGeo, this.orbitalMotesMaterial);
    motes.name = 'OrbitingStardustMotes';
    ringsGroup.add(motes);

    this.scene.add(ringsGroup);
  }

  private buildShootingMeteors(): void {
    const meteorCount = 28;
    const vertCount = meteorCount * 4;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const origins = new Float32Array(vertCount * 3);
    const velocities = new Float32Array(vertCount * 3);
    const timings = new Float32Array(vertCount * 4);
    const colors = new Float32Array(vertCount * 3);
    const indices: number[] = [];

    const meteorPalette = [
      new THREE.Color('#93c5fd'),
      new THREE.Color('#67e8f9'),
      new THREE.Color('#fde68a'),
      new THREE.Color('#e879f9')
    ];

    for (let m = 0; m < meteorCount; m++) {
      const h1 = Math.abs(Math.sin(m * 31.7 + 1.1) * 43758.54) % 1.0;
      const h2 = Math.abs(Math.sin(m * 79.3 + 2.7) * 19341.12) % 1.0;
      const h3 = Math.abs(Math.sin(m * 53.9 + 4.3) * 28471.63) % 1.0;
      const h4 = Math.abs(Math.sin(m * 97.1 + 0.9) * 31947.29) % 1.0;

      const azim = h1 * Math.PI * 2.0;
      const dist = 165.0 + h2 * 155.0;
      const ox = Math.cos(azim) * dist;
      const oz = Math.sin(azim) * dist;
      const oy = 75.0 + h3 * 95.0;

      // Tangent-inward downward streak across the upper celestial vault
      const dirAngle = azim + 1.15 + (h4 - 0.5) * 1.1;
      const speed = 58.0 + h2 * 44.0;
      const vx = Math.cos(dirAngle) * speed;
      const vz = Math.sin(dirAngle) * speed;
      const vy = -(18.0 + h3 * 20.0);

      const period = 7.5 + h4 * 9.5;
      const phase = h1 * period;
      const activeFrac = 0.22 + h2 * 0.14;
      const lenScale = 0.65 + h3 * 0.85;

      const c = meteorPalette[m % meteorPalette.length];
      const baseV = m * 4;
      const cornerUvs: Array<[number, number]> = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ];

      for (let v = 0; v < 4; v++) {
        const vi = baseV + v;
        positions[vi * 3] = ox;
        positions[vi * 3 + 1] = oy;
        positions[vi * 3 + 2] = oz;

        uvs[vi * 2] = cornerUvs[v][0];
        uvs[vi * 2 + 1] = cornerUvs[v][1];

        origins[vi * 3] = ox;
        origins[vi * 3 + 1] = oy;
        origins[vi * 3 + 2] = oz;

        velocities[vi * 3] = vx;
        velocities[vi * 3 + 1] = vy;
        velocities[vi * 3 + 2] = vz;

        timings[vi * 4] = phase;
        timings[vi * 4 + 1] = period;
        timings[vi * 4 + 2] = activeFrac;
        timings[vi * 4 + 3] = lenScale;

        colors[vi * 3] = c.r;
        colors[vi * 3 + 1] = c.g;
        colors[vi * 3 + 2] = c.b;
      }

      indices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3);
    }

    const meteorGeo = new THREE.BufferGeometry();
    meteorGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    meteorGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    meteorGeo.setAttribute('aOrigin', new THREE.BufferAttribute(origins, 3));
    meteorGeo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    meteorGeo.setAttribute('aTiming', new THREE.BufferAttribute(timings, 4));
    meteorGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    meteorGeo.setIndex(indices);

    this.meteorMaterial = createShootingMeteorsMaterial();
    const meteorMesh = new THREE.Mesh(meteorGeo, this.meteorMaterial);
    meteorMesh.name = 'ShootingMeteors';
    meteorMesh.frustumCulled = false;
    meteorMesh.renderOrder = 1;
    this.scene.add(meteorMesh);
  }

  private buildVolcanicObsidianMonolithsAndSpires(granitePbr: PbrTextureSet): void {
    const magmaUniforms = {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 }
    };
    this.magmaUniforms = magmaUniforms;

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#222636'),
      map: granitePbr.map,
      normalMap: granitePbr.normalMap,
      normalScale: new THREE.Vector2(1.75, 1.75),
      roughnessMap: granitePbr.roughnessMap,
      aoMap: granitePbr.aoMap,
      aoMapIntensity: 0.92,
      roughness: 0.62,
      metalness: 0.34,
      envMapIntensity: 1.75
    });

    // Inject glowing amber-crimson magmatic vein fissures along deep basalt fractures
    obsidianMat.customProgramCacheKey = () => 'cosmic-magmatic-obsidian-v1';
    obsidianMat.onBeforeCompile = (shader) => {
      shader.uniforms.uMagmaTime = magmaUniforms.uTime;
      shader.uniforms.uMagmaBass = magmaUniforms.uBassEnergy;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          varying vec3 vMagmaWorldPos;
          `
        )
        .replace(
          '#include <worldpos_vertex>',
          /* glsl */ `
          #include <worldpos_vertex>
          vec4 magmaWPos = vec4( transformed, 1.0 );
          #ifdef USE_BATCHING
            magmaWPos = batchingMatrix * magmaWPos;
          #endif
          #ifdef USE_INSTANCING
            magmaWPos = instanceMatrix * magmaWPos;
          #endif
          magmaWPos = modelMatrix * magmaWPos;
          vMagmaWorldPos = magmaWPos.xyz;
          `
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uMagmaTime;
          uniform float uMagmaBass;
          varying vec3 vMagmaWorldPos;

          float magmaHash3( vec3 p ) {
            p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
            p += dot( p, p.yxz + 33.33 );
            return fract( ( p.x + p.y ) * p.z );
          }

          float magmaNoise3( vec3 p ) {
            vec3 i = floor( p );
            vec3 f = fract( p );
            vec3 u = f * f * ( 3.0 - 2.0 * f );
            return mix(
              mix(
                mix( magmaHash3( i + vec3( 0.0, 0.0, 0.0 ) ), magmaHash3( i + vec3( 1.0, 0.0, 0.0 ) ), u.x ),
                mix( magmaHash3( i + vec3( 0.0, 1.0, 0.0 ) ), magmaHash3( i + vec3( 1.0, 1.0, 0.0 ) ), u.x ),
                u.y
              ),
              mix(
                mix( magmaHash3( i + vec3( 0.0, 0.0, 1.0 ) ), magmaHash3( i + vec3( 1.0, 0.0, 1.0 ) ), u.x ),
                mix( magmaHash3( i + vec3( 0.0, 1.0, 1.0 ) ), magmaHash3( i + vec3( 1.0, 1.0, 1.0 ) ), u.x ),
                u.y
              ),
              u.z
            );
          }
          `
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `
          #include <emissivemap_fragment>
          vec3 mCoord = vMagmaWorldPos * vec3( 0.85, 0.55, 0.85 );
          vec3 flowShift = vec3( uMagmaTime * 0.14, -uMagmaTime * 0.42, uMagmaTime * 0.11 );
          float mWarp = magmaNoise3( mCoord * 0.65 + flowShift * 0.18 ) * 1.45;
          float f1 = 1.0 - abs( magmaNoise3( mCoord + vec3( mWarp, -mWarp * 0.5, mWarp * 0.8 ) ) * 2.0 - 1.0 );
          float f2 = 1.0 - abs( magmaNoise3( mCoord * 2.2 - vec3( mWarp * 0.7 ) ) * 2.0 - 1.0 );
          float veinPrimary = pow( clamp( f1, 0.0, 1.0 ), 30.0 );
          float veinBranch = pow( clamp( f2, 0.0, 1.0 ), 36.0 ) * 0.52;
          // Animated molten lava surging through the basalt crack network
          float lavaStream = magmaNoise3( mCoord * 2.6 + flowShift );
          float lavaSurge = 0.55 + 0.75 * smoothstep( 0.30, 0.88, lavaStream );
          float heightFade = smoothstep( 10.5, -0.8, vMagmaWorldPos.y );
          float veinIntensity = ( veinPrimary + veinBranch ) * ( 0.18 + 0.82 * heightFade ) * lavaSurge;
          float pulse = 0.82 + 0.18 * sin( uMagmaTime * 1.8 - vMagmaWorldPos.y * 0.65 + vMagmaWorldPos.x * 0.22 );
          vec3 crimsonCore = vec3( 0.98, 0.12, 0.01 );
          vec3 amberHot = vec3( 1.65, 0.58, 0.06 );
          vec3 whiteHot = vec3( 2.10, 1.25, 0.35 );
          vec3 magmaCol = mix( crimsonCore, amberHot, smoothstep( 0.52, 0.94, f1 ) );
          magmaCol = mix( magmaCol, whiteHot, smoothstep( 0.68, 0.96, lavaStream ) * 0.48 );
          totalEmissiveRadiance += magmaCol * veinIntensity * pulse * ( 0.82 + uMagmaBass * 0.42 );
          `
        );
    };

    this.magmaticObsidianMaterial = applyWorldSpaceWeathering(obsidianMat, {
      macroScale: 0.15,
      mossHeight: -0.5,
      mossColor: '#241820',
      dampRoughness: 0.20,
      dirtTint: '#14121c'
    });

    // 1. Grounded Fractured Volcanic Obsidian Monoliths (36 sculpted volcanic glass blades rooted deep in basalt across 108m desert)
    const monolithGeo = createFracturedObsidianMonolithGeometry(2.7);
    const monolithCount = 36;
    const monolithsMesh = new THREE.InstancedMesh(monolithGeo, this.magmaticObsidianMaterial, monolithCount);
    monolithsMesh.name = 'VolcanicObsidianMonoliths';
    monolithsMesh.castShadow = true;
    monolithsMesh.receiveShadow = true;

    for (let i = 0; i < monolithCount; i++) {
      const h1 = Math.abs(Math.sin(i * 23.14 + 0.5) * 43758.54) % 1.0;
      const h2 = Math.abs(Math.sin(i * 91.7 + 2.1) * 19341.12) % 1.0;
      const h3 = Math.abs(Math.sin(i * 57.3 + 4.3) * 31947.29) % 1.0;

      let angle = (i / monolithCount) * Math.PI * 2.0 + (h1 - 0.5) * 0.16;
      // Keep direct spawn sightline (+Z walkway and -Z Black Hole / Binary Sun corridor) wide open
      const spawnDist = Math.abs(((angle - Math.PI * 0.5 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (spawnDist < 0.34) {
        angle += angle > Math.PI * 0.5 ? 0.36 : -0.36;
      }
      const northDist = Math.abs(((angle + Math.PI * 0.5 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (northDist < 0.28) {
        angle += angle > -Math.PI * 0.5 ? 0.30 : -0.30;
      }

      const radius = i < 20 ? 19.5 + h2 * 16.5 : 54.0 + h2 * 52.0;
      let x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;
      // Keep Astronomical Observatory plaza (-46, -24) and approach sightline clear
      if (Math.hypot(x + 46, z + 24) < 15.0 || Math.hypot(x + 28, z + 10) < 9.5) {
        angle += 0.42;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
      }
      const sy = (i < 20 ? 0.78 : 1.05) + h3 * 0.92;
      const sxz = (i < 20 ? 0.88 : 1.08) + h1 * 0.52;
      const groundY = getCosmicBlackHoleHeight(x, z);

      this.scratchPos.set(x, groundY - 0.25, z);
      this.scratchEuler.set((h1 - 0.5) * 0.14, h2 * Math.PI * 2.0, (h3 - 0.5) * 0.14);
      this.scratchQuat.setFromEuler(this.scratchEuler);
      this.scratchScale.set(sxz, sy, sxz);
      this.scratchMat4.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      monolithsMesh.setMatrixAt(i, this.scratchMat4);
    }
    monolithsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(monolithsMesh);

    // 2. Grounded Jagged Basalt Canyon Spires framing the doubled outer basalt amphitheater & volcanic rim (54 spires)
    const spireGeo = createJaggedBasaltSpireGeometry(4.3);
    const spireCount = 54;
    const spiresMesh = new THREE.InstancedMesh(spireGeo, this.magmaticObsidianMaterial, spireCount);
    spiresMesh.name = 'JaggedBasaltCanyonSpires';
    spiresMesh.castShadow = true;
    spiresMesh.receiveShadow = true;

    for (let i = 0; i < spireCount; i++) {
      const h1 = Math.abs(Math.sin(i * 37.9 + 1.3) * 43758.54) % 1.0;
      const h2 = Math.abs(Math.sin(i * 61.3 + 2.7) * 19341.12) % 1.0;
      const h3 = Math.abs(Math.sin(i * 83.7 + 0.9) * 31947.29) % 1.0;

      let angle = (i / spireCount) * Math.PI * 2.0 + (h1 - 0.5) * 0.12;
      const northGap = Math.abs(((angle + Math.PI * 0.5 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (northGap < 0.28) {
        angle += angle > -Math.PI * 0.5 ? 0.30 : -0.30;
      }

      const radius = i < 28 ? 34.0 + h2 * 22.0 : 88.0 + h2 * 66.0;
      let x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;
      // Keep Astronomical Observatory plaza (-46, -24) clear of jagged spires
      if (Math.hypot(x + 46, z + 24) < 15.5) {
        angle += 0.44;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
      }
      const sy = (i < 28 ? 0.85 : 1.35) + h3 * 1.45;
      const sxz = (i < 28 ? 1.05 : 1.35) + h1 * 0.95;
      const groundY = getCosmicBlackHoleHeight(x, z);

      this.scratchPos.set(x, groundY - 0.35, z);
      this.scratchEuler.set((h1 - 0.5) * 0.12, h2 * Math.PI * 2.0, (h3 - 0.5) * 0.12);
      this.scratchQuat.setFromEuler(this.scratchEuler);
      this.scratchScale.set(sxz, sy, sxz);
      this.scratchMat4.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      spiresMesh.setMatrixAt(i, this.scratchMat4);
    }
    spiresMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(spiresMesh);

    // 3. Shattered Obsidian Crystal Clusters across the expanded desert & tidal mirror edges (46 clusters)
    const crystalGeo = createShatteredObsidianCrystalClusterGeometry(3.7);
    const crystalCount = 46;
    const crystalsMesh = new THREE.InstancedMesh(crystalGeo, this.magmaticObsidianMaterial, crystalCount);
    crystalsMesh.name = 'ShatteredObsidianCrystals';
    crystalsMesh.castShadow = true;
    crystalsMesh.receiveShadow = true;

    for (let i = 0; i < crystalCount; i++) {
      const h1 = Math.abs(Math.sin(i * 41.7 + 2.1) * 43758.54) % 1.0;
      const h2 = Math.abs(Math.sin(i * 67.3 + 5.3) * 19341.12) % 1.0;
      const h3 = Math.abs(Math.sin(i * 29.9 + 1.7) * 31947.29) % 1.0;

      let angle = (i / crystalCount) * Math.PI * 2.0 + (h1 - 0.5) * 0.18;
      const spawnDist = Math.abs(((angle - Math.PI * 0.5 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (spawnDist < 0.25) angle += 0.28;

      const radius = 38.0 + h2 * 86.0;
      let x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;
      if (Math.hypot(x + 46, z + 24) < 14.5) {
        angle += 0.35;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
      }
      const gy = getCosmicBlackHoleHeight(x, z);
      const sy = 0.85 + h3 * 1.15;
      const sxz = 0.90 + h1 * 0.70;

      this.scratchPos.set(x, gy - 0.15, z);
      this.scratchEuler.set((h1 - 0.5) * 0.18, h2 * Math.PI * 2.0, (h3 - 0.5) * 0.18);
      this.scratchQuat.setFromEuler(this.scratchEuler);
      this.scratchScale.set(sxz, sy, sxz);
      this.scratchMat4.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      crystalsMesh.setMatrixAt(i, this.scratchMat4);
    }
    crystalsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(crystalsMesh);
  }

  private applySwirlSpeed(swirlSpeed: number): void {
    if (!Number.isFinite(swirlSpeed)) return;
    if (this.skyMaterial) this.skyMaterial.uniforms.uSwirlSpeed.value = swirlSpeed;
    if (this.blackHoleMaterial) this.blackHoleMaterial.uniforms.uSwirlSpeed.value = swirlSpeed;
    if (this.gasGiantMaterial) this.gasGiantMaterial.uniforms.uSwirlSpeed.value = swirlSpeed;
    if (this.auroraShellMaterial) this.auroraShellMaterial.uniforms.uSwirlSpeed.value = swirlSpeed;
    if (this.orbitalMotesMaterial) this.orbitalMotesMaterial.uniforms.uSwirlSpeed.value = swirlSpeed;
    if (this.meteorMaterial) this.meteorMaterial.uniforms.uSwirlSpeed.value = swirlSpeed;
  }

  public update(_deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = _deltaTime;
    this.lastElapsedTime = elapsedTime;

    if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = elapsedTime;
    if (this.blackHoleMaterial) this.blackHoleMaterial.uniforms.uTime.value = elapsedTime;
    if (this.sunMaterial) this.sunMaterial.uniforms.uTime.value = elapsedTime;
    if (this.coronaMaterial) this.coronaMaterial.uniforms.uTime.value = elapsedTime;
    for (const mat of this.solarArcMaterials) {
      mat.uniforms.uTime.value = elapsedTime;
    }
    if (this.gasGiantMaterial) this.gasGiantMaterial.uniforms.uTime.value = elapsedTime;
    if (this.planetaryRingMaterial) this.planetaryRingMaterial.uniforms.uTime.value = elapsedTime;
    if (this.auroraMoonMaterial) this.auroraMoonMaterial.uniforms.uTime.value = elapsedTime;
    if (this.auroraShellMaterial) this.auroraShellMaterial.uniforms.uTime.value = elapsedTime;
    if (this.orbitalMotesMaterial) this.orbitalMotesMaterial.uniforms.uTime.value = elapsedTime;
    if (this.meteorMaterial) this.meteorMaterial.uniforms.uTime.value = elapsedTime;
    if (this.magmaUniforms) this.magmaUniforms.uTime.value = elapsedTime;
    if (this.terrainMaterial) this.terrainMaterial.uniforms.uTime.value = elapsedTime;
    if (this.starPointsMaterial) this.starPointsMaterial.uniforms.uTime.value = elapsedTime;

    const swirl = this.currentConfig?.sky?.swirlSpeed ?? 1.0;

    if (this.gasGiantMesh) {
      this.gasGiantMesh.rotation.y = elapsedTime * 0.025 * swirl;
    }
    if (this.auroraMoonMesh) {
      this.auroraMoonMesh.rotation.y = elapsedTime * 0.045 * swirl;
    }
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    if (this.blackHoleMesh && this.blackHoleMaterial) {
      this.scratchVec3.copy(camera.position).sub(this.bhCenter);
      const distToCam = this.scratchVec3.length();
      this.blackHoleMaterial.uniforms.uCamLocalPos.value
        .copy(this.scratchVec3)
        .divideScalar(this.bhScale);
      const boundWorld = this.bhBoundRadiusUnits * this.bhScale;
      const targetSide = distToCam < boundWorld * 1.06 ? THREE.BackSide : THREE.FrontSide;
      if (this.blackHoleMaterial.side !== targetSide) {
        this.blackHoleMaterial.side = targetSide;
        this.blackHoleMaterial.needsUpdate = true;
      }
    }
    if (this.coronaMesh) {
      this.coronaMesh.lookAt(camera.position);
    }
    if (this.pipeline) {
      this.pipeline.renderFrame(renderer, camera, this.lastDeltaTime, this.lastElapsedTime);
      return;
    }
    renderer.render(this.scene, camera);
  }

  public setAudioEnergy(bass: number, _mid: number, _treble: number): void {
    if (!this.isInitialized) return;
    const safeBass = Number.isFinite(bass) ? Math.max(0, Math.min(2, bass)) : 0;
    if (this.skyMaterial?.uniforms?.uBassEnergy) this.skyMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.blackHoleMaterial?.uniforms?.uBassEnergy) this.blackHoleMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.sunMaterial?.uniforms?.uBassEnergy) this.sunMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.coronaMaterial?.uniforms?.uBassEnergy) this.coronaMaterial.uniforms.uBassEnergy.value = safeBass;
    for (const mat of this.solarArcMaterials) {
      if (mat.uniforms?.uBassEnergy) mat.uniforms.uBassEnergy.value = safeBass;
    }
    if (this.gasGiantMaterial?.uniforms?.uBassEnergy) this.gasGiantMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.orbitalMotesMaterial?.uniforms?.uBassEnergy) this.orbitalMotesMaterial.uniforms.uBassEnergy.value = safeBass;
    if (this.magmaUniforms) this.magmaUniforms.uBassEnergy.value = safeBass;
    if (this.terrainMaterial?.uniforms?.uBassEnergy) this.terrainMaterial.uniforms.uBassEnergy.value = safeBass;
  }

  /**
   * Optional atmosphere state hook for SpaceEngine (`{ timeOfDay, weather }`) and
   * direct cosmic mood tuning (`swirlSpeed`, `fogDensity`, `fogColor`, `nebulaIntensity`, `starBrightness`, `bassEnergy`).
   */
  public setAtmosphereState(state: Record<string, unknown>): void {
    if (!this.isInitialized || !state || typeof state !== 'object') return;

    const baseFogDensity = this.currentConfig?.fog?.density ?? 0.0032;
    const baseFogColor = this.currentConfig?.fog?.color ?? '#08051a';
    const baseSwirl = this.currentConfig?.sky?.swirlSpeed ?? 1.0;

    if (typeof state.timeOfDay === 'number' && Number.isFinite(state.timeOfDay)) {
      const hour = ((state.timeOfDay % 24) + 24) % 24;
      // 0..24 cosmic cycle: midnight (0/24) = crisp deep-space stars; noon (12) = luminous solar/nebula bloom
      const dayCycle = 0.5 - 0.5 * Math.cos((hour / 24) * Math.PI * 2);
      const starBoost = 1.25 - 0.30 * dayCycle;
      const nebBoost = 0.92 + 0.32 * dayCycle;
      if (this.skyMaterial?.uniforms?.uStarBrightness) {
        this.skyMaterial.uniforms.uStarBrightness.value = starBoost;
      }
      if (this.starPointsMaterial?.uniforms?.uStarBrightness) {
        this.starPointsMaterial.uniforms.uStarBrightness.value = starBoost;
      }
      if (this.skyMaterial?.uniforms?.uNebulaIntensity) {
        this.skyMaterial.uniforms.uNebulaIntensity.value = nebBoost;
      }
      if (this.directionalLight) {
        const baseDirInt = this.currentConfig?.lighting?.directional?.intensity ?? 1.55;
        this.directionalLight.intensity = baseDirInt * (0.85 + 0.30 * dayCycle);
      }
    }

    if (typeof state.weather === 'string') {
      const weather = state.weather;
      if (this.scene.fog instanceof THREE.FogExp2) {
        if (weather === 'mist') {
          this.scene.fog.density = Math.max(baseFogDensity, 0.0046);
          this.scene.fog.color.set('#0e0b28');
        } else if (weather === 'rain') {
          this.scene.fog.density = Math.max(baseFogDensity, 0.0040);
          this.scene.fog.color.set('#071226');
          this.applySwirlSpeed(baseSwirl * 1.25);
        } else if (weather === 'fireflies') {
          this.scene.fog.density = baseFogDensity * 0.92;
          this.scene.fog.color.set(baseFogColor);
          if (this.skyMaterial?.uniforms?.uStarBrightness) {
            this.skyMaterial.uniforms.uStarBrightness.value = 1.32;
          }
          if (this.starPointsMaterial?.uniforms?.uStarBrightness) {
            this.starPointsMaterial.uniforms.uStarBrightness.value = 1.32;
          }
        } else {
          this.scene.fog.density = baseFogDensity;
          this.scene.fog.color.set(baseFogColor);
          this.applySwirlSpeed(baseSwirl);
        }
      }
    }

    const swirlSpeed = state.swirlSpeed;
    if (typeof swirlSpeed === 'number' && Number.isFinite(swirlSpeed)) {
      this.applySwirlSpeed(swirlSpeed);
    }

    const fogDensity = state.fogDensity;
    if (typeof fogDensity === 'number' && Number.isFinite(fogDensity) && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = Math.max(0, Math.min(0.05, fogDensity));
    }

    const fogColor = state.fogColor;
    if (typeof fogColor === 'string' && this.scene.fog instanceof THREE.FogExp2) {
      try {
        this.scene.fog.color.set(fogColor);
      } catch {
        // Ignore malformed color string
      }
    }

    const nebulaIntensity = state.nebulaIntensity;
    if (typeof nebulaIntensity === 'number' && Number.isFinite(nebulaIntensity) && this.skyMaterial?.uniforms?.uNebulaIntensity) {
      this.skyMaterial.uniforms.uNebulaIntensity.value = Math.max(0, Math.min(3, nebulaIntensity));
    }

    const starBrightness = state.starBrightness;
    if (typeof starBrightness === 'number' && Number.isFinite(starBrightness)) {
      const clamped = Math.max(0, Math.min(3, starBrightness));
      if (this.skyMaterial?.uniforms?.uStarBrightness) {
        this.skyMaterial.uniforms.uStarBrightness.value = clamped;
      }
      if (this.starPointsMaterial?.uniforms?.uStarBrightness) {
        this.starPointsMaterial.uniforms.uStarBrightness.value = clamped;
      }
    }

    const bassEnergy = state.bassEnergy;
    if (typeof bassEnergy === 'number' && Number.isFinite(bassEnergy)) {
      this.setAudioEnergy(bassEnergy, 0, 0);
    }
  }

  public updateConfig(newConfig: Partial<SpaceConfig>, isInitialHydration = false): void {
    if (!this.isInitialized || !newConfig || typeof newConfig !== 'object') return;
    if (isInitialHydration && this.hasUserMutation) return;
    if (!isInitialHydration) this.hasUserMutation = true;

    if (newConfig.fog && this.scene.fog instanceof THREE.FogExp2) {
      if (newConfig.fog.color) {
        this.scene.fog.color.set(newConfig.fog.color);
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
      }
      if (typeof newConfig.fog.density === 'number' && Number.isFinite(newConfig.fog.density)) {
        this.scene.fog.density = newConfig.fog.density;
        if (this.currentConfig?.fog) this.currentConfig.fog.density = newConfig.fog.density;
      }
    }

    if (newConfig.sky) {
      if (typeof newConfig.sky.swirlSpeed === 'number' && Number.isFinite(newConfig.sky.swirlSpeed)) {
        this.applySwirlSpeed(newConfig.sky.swirlSpeed);
        if (this.currentConfig?.sky) this.currentConfig.sky.swirlSpeed = newConfig.sky.swirlSpeed;
      }
      if (newConfig.sky.topColor && this.skyMaterial) {
        this.skyMaterial.uniforms.uTopColor.value.set(newConfig.sky.topColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
      }
      if (newConfig.sky.bottomColor && this.skyMaterial) {
        this.skyMaterial.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
      }
      if (newConfig.sky.horizonColor && this.skyMaterial) {
        this.skyMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
      }
    }

    if (newConfig.wind && this.currentConfig?.wind) {
      if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
        this.currentConfig.wind.speed = newConfig.wind.speed;
      }
      if (typeof newConfig.wind.swayIntensity === 'number' && Number.isFinite(newConfig.wind.swayIntensity)) {
        this.currentConfig.wind.swayIntensity = newConfig.wind.swayIntensity;
      }
    }

    if (newConfig.lighting) {
      if (newConfig.lighting.ambient && this.ambientLight) {
        if (newConfig.lighting.ambient.color) {
          this.ambientLight.color.set(newConfig.lighting.ambient.color);
          if (this.currentConfig?.lighting?.ambient) {
            this.currentConfig.lighting.ambient.color = newConfig.lighting.ambient.color;
          }
        }
        if (typeof newConfig.lighting.ambient.intensity === 'number' && Number.isFinite(newConfig.lighting.ambient.intensity)) {
          this.ambientLight.intensity = newConfig.lighting.ambient.intensity;
          if (this.currentConfig?.lighting?.ambient) {
            this.currentConfig.lighting.ambient.intensity = newConfig.lighting.ambient.intensity;
          }
        }
      }
      if (newConfig.lighting.directional && this.directionalLight) {
        if (newConfig.lighting.directional.color) {
          this.directionalLight.color.set(newConfig.lighting.directional.color);
          if (this.currentConfig?.lighting?.directional) {
            this.currentConfig.lighting.directional.color = newConfig.lighting.directional.color;
          }
        }
        if (typeof newConfig.lighting.directional.intensity === 'number' && Number.isFinite(newConfig.lighting.directional.intensity)) {
          this.directionalLight.intensity = newConfig.lighting.directional.intensity;
          if (this.currentConfig?.lighting?.directional) {
            this.currentConfig.lighting.directional.intensity = newConfig.lighting.directional.intensity;
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
    return getCosmicBlackHoleHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 0;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 16;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;
    const lookAt = this.currentConfig?.camera?.lookAt ?? [6, 22, -85];
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
    return [
      {
        name: 'Event Horizon Overlook',
        position: new THREE.Vector3(-14, this.getGroundHeight(-14, -8) + 2.5, -8),
        dwellTime: 12.0
      },
      {
        name: 'Solar Corona Terrace',
        position: new THREE.Vector3(18, this.getGroundHeight(18, -10) + 2.5, -10),
        dwellTime: 10.0
      },
      {
        name: 'Obsidian Bridge',
        position: new THREE.Vector3(0, this.getGroundHeight(0, 12) + 2.2, 12),
        dwellTime: 8.0
      },
      {
        name: 'Singularity Zenith',
        position: new THREE.Vector3(2, this.getGroundHeight(2, -22) + 3.0, -22),
        dwellTime: 10.0
      },
      {
        name: 'Iridescent Giant Overlook',
        position: new THREE.Vector3(-4, this.getGroundHeight(-4, 24) + 3.0, 24),
        dwellTime: 10.0
      },
      {
        name: 'Astronomical Ring Observatory',
        position: new THREE.Vector3(-38, this.getGroundHeight(-38, -22) + 3.2, -22),
        dwellTime: 11.0
      },
      {
        name: 'Outer Basalt Monolith Arch',
        position: new THREE.Vector3(-84, this.getGroundHeight(-84, -46) + 3.2, -46),
        dwellTime: 10.0
      },
      {
        name: 'Obsidian Crystal Basin',
        position: new THREE.Vector3(78, this.getGroundHeight(78, 52) + 2.8, 52),
        dwellTime: 10.0
      },
      {
        name: 'Southern Dune Horizon',
        position: new THREE.Vector3(0, this.getGroundHeight(0, 96) + 3.0, 96),
        dwellTime: 10.0
      },
      {
        name: 'Eastern Solar Rim',
        position: new THREE.Vector3(86, this.getGroundHeight(86, -42) + 3.0, -42),
        dwellTime: 10.0
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

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    if (this.basaltPbrSet) {
      disposeBasaltPbrTextures(this.basaltPbrSet);
      this.basaltPbrSet = null;
    }

    for (const set of this.pbrSets) {
      disposePbrTextureSet(set);
    }
    this.pbrSets = [];

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
    if (this.scene) {
      this.scene.environment = null;
    }

    if (this.boundRenderer && (this.boundRenderer as unknown as { shadowMap?: THREE.WebGLShadowMap }).shadowMap) {
      this.boundRenderer.shadowMap.enabled = this.prevShadowEnabled;
      this.boundRenderer.shadowMap.type = this.prevShadowType;
    }
    this.boundRenderer = null;

    this.skyMaterial = null;
    this.blackHoleMaterial = null;
    this.sunMaterial = null;
    this.coronaMaterial = null;
    this.solarArcMaterials = [];
    this.gasGiantMaterial = null;
    this.planetaryRingMaterial = null;
    this.auroraMoonMaterial = null;
    this.auroraShellMaterial = null;
    this.orbitalMotesMaterial = null;
    this.meteorMaterial = null;
    this.magmaticObsidianMaterial = null;
    this.magmaUniforms = null;
    this.terrainMaterial = null;
    this.starPointsMaterial = null;

    this.blackHoleMesh = null;
    this.coronaMesh = null;
    this.gasGiantMesh = null;
    this.auroraMoonMesh = null;
    this.ambientLight = null;
    this.directionalLight = null;
    this.lastDeltaTime = 0.016;
    this.lastElapsedTime = 0.0;

    this.isInitialized = false;
  }
}
