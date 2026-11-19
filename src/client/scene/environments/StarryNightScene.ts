import * as THREE from 'three';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { CinematicPipeline } from '../postprocessing/CinematicPipeline';
import { createStarrySkyMaterial } from '../shaders/starrySkyShader';
import { createStarHaloMaterial } from '../shaders/starHaloShader';
import { createCrescentMoonMaterial } from '../shaders/crescentMoonShader';
import { createCypressMaterial } from '../shaders/cypressShader';
import { createStarryGroundMaterial, createAlpillesRidgeMaterial } from '../shaders/starryGroundShader';
import { createGrassSwayMaterial } from '../shaders/grassSwayShader';
import {
  PbrTextureSet,
  createCobblestonePbrTextures,
  disposePbrTextureSet
} from '../textures/pbrTextures';
import {
  buildStarryNightTown,
  StarryNightTownHandle,
  getTownRoadCenterX,
  getDistanceToCarriageLane,
  getStreamCenterX
} from './starryNightTownBuilder';

/**
 * Analytical height function for "The Starry Night" terrain.
 * h(x, z) = 1.8 * cos(0.03*x) * cos(0.03*z) - 0.0005*(x^2 + z^2) + 0.5 * sin(0.06*x)
 * Evaluates continuous terrain elevation in O(1) time without mesh raycasting.
 */
export function getStarryNightHeight(x: number, z: number): number {
  return 1.8 * Math.cos(0.03 * x) * Math.cos(0.03 * z) - 0.0005 * (x * x + z * z) + 0.5 * Math.sin(0.06 * x);
}

/**
 * Exact analytical surface normal for "The Starry Night" terrain in O(1) time.
 */
export function getStarryNightNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
  const dhdx = -0.054 * Math.sin(0.03 * x) * Math.cos(0.03 * z) - 0.001 * x + 0.03 * Math.cos(0.06 * x);
  const dhdz = -0.054 * Math.cos(0.03 * x) * Math.sin(0.03 * z) - 0.001 * z;
  return target.set(-dhdx, 1.0, -dhdz).normalize();
}

/**
 * StarryNightScene implements ISpace for Vincent van Gogh's "The Starry Night".
 * 100% procedural WebGL assets:
 * - Dynamic dual-vortex celestial sky dome + baked PMREM nocturnal sky IBL
 * - 11 pulsating golden star halos with audio FFT reactivity
 * - Procedural circle-difference SDF crescent moon with radiating aureole
 * - Organic flame-shaped wind-swaying cypress tree with curl-flow brushwork & drifting cypress leaves
 * - Distant Alpilles mountain ridges with Van Gogh curl-flow brushwork & moonlit rim illumination
 * - Detailed Saint-Rémy Provençal village, Gothic church steeple, 16-segment streetlamps & reflective Rhone stream
 * - Swirl-following fireflies & continuous analytical hill terrain
 */
export class StarryNightScene implements ISpace {
  readonly id = 'space-starry-night';
  readonly name = 'The Starry Night';
  readonly slug = 'starry-night';

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;
  private hasUserMutation = false;
  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  // Rendering & IBL Pipeline
  private pipeline: CinematicPipeline | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private sharedCobblePbr: PbrTextureSet | null = null;
  private townHandle: StarryNightTownHandle | null = null;
  private lastDeltaTime = 0.016;
  private lastElapsedTime = 0;

  // Shader Materials & Animated Meshes
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private groundMaterial: THREE.ShaderMaterial | null = null;
  private nightGrassMaterial: THREE.ShaderMaterial | null = null;
  private moonMaterial: THREE.ShaderMaterial | null = null;
  private cypressMaterial: THREE.ShaderMaterial | null = null;
  private ridgeMaterials: THREE.ShaderMaterial[] = [];
  private starMaterials: THREE.ShaderMaterial[] = [];
  private fireflyMaterial: THREE.ShaderMaterial | null = null;
  private leafDriftMaterial: THREE.ShaderMaterial | null = null;

  // Scene Lights
  private ambientLight: THREE.AmbientLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private moonDirectionalLight: THREE.DirectionalLight | null = null;
  private rimDirectionalLight: THREE.DirectionalLight | null = null;

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
      this.scene = new THREE.Scene();
    }

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#0b142d',
        density: config?.fog?.density ?? 0.0095
      },
      sky: {
        type: 'starry_night_flow',
        topColor: config?.sky?.topColor ?? '#081542',
        bottomColor: config?.sky?.bottomColor ?? '#1f3e78',
        horizonColor: config?.sky?.horizonColor ?? '#285249',
        swirlSpeed: config?.sky?.swirlSpeed ?? 1.2,
        starDensity: config?.sky?.starDensity ?? 500,
        moonGlow: config?.sky?.moonGlow ?? 0.95
      },
      wind: {
        speed: config?.wind?.speed ?? 1.5,
        direction: config?.wind?.direction ?? [0.8, 0.1, 0.5],
        gustiness: config?.wind?.gustiness ?? 0.35,
        swayIntensity: config?.wind?.swayIntensity ?? 0.4
      },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#243c70',
          intensity: config?.lighting?.ambient?.intensity ?? 0.65
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#fefcd7',
          intensity: config?.lighting?.directional?.intensity ?? 0.85,
          position: config?.lighting?.directional?.position ?? [30, 45, -25],
          castShadow: config?.lighting?.directional?.castShadow ?? true
        },
        pointLights: config?.lighting?.pointLights ?? [
          { color: '#ffb703', intensity: 1.5, distance: 20, position: [0, 3, 0] },
          { color: '#fb8500', intensity: 1.0, distance: 15, position: [15, 2, -10] }
        ]
      },
      shaders: config?.shaders ?? {
        swirlFlow: { frequency: 2.2, amplitude: 0.75, timeScale: 1.1 }
      },
      audio: {
        trackId: config?.audio?.trackId ?? 'starry-night-ambient',
        name: config?.audio?.name ?? 'StarryNight Horizon',
        sourceUrl: config?.audio?.sourceUrl ?? '/music/starry-night-horizon.mp3',
        defaultVolume: config?.audio?.defaultVolume ?? 0.7,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'audio_buffer',
        reverb: config?.audio?.reverb ?? { decay: 2.5, wet: 0.3 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 1.7, 12],
        lookAt: config?.camera?.lookAt ?? [0, 6, -20],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 3.8,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.0,
        wanderRadius: config?.camera?.wanderRadius ?? 70,
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 2.5, 12],
          [10, 4.0, -5],
          [-8, 3.5, -15],
          [2, 6.0, 0]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      }
    };

    // 1. Configure Atmospheric Nocturnal Fog
    const fogColor = config?.fog?.color ?? '#0b142d';
    const fogDensity = config?.fog?.density ?? 0.0095;
    this.scene.fog = new THREE.FogExp2(fogColor, fogDensity);

    // 2. Setup Nocturnal Moonlight, Sky-to-Ground Hemisphere Fill & Rim Lighting (fixes crushed dark lower half)
    this.setupLighting(renderer, config);

    // 3. Celestial Inverted Sky Dome & PMREM Night-Sky IBL
    this.buildSkyDome(config);
    this.bakeNightEnvironment(renderer, config);

    // 4. Crescent Moon
    this.buildCrescentMoon(config);

    // 5. 11 Van Gogh Star Halos
    this.buildStars(config);

    // 6. Shared 512x512 Cobblestone PBR + Undulating Terrain Hill with Van Gogh Curl-Flow Ground Shader
    const hasWebGLContext = Boolean(renderer && typeof (renderer as any).getContext === 'function');
    const cobbleSize = hasWebGLContext ? 512 : 256;
    this.sharedCobblePbr = createCobblestonePbrTextures({
      size: cobbleSize,
      seed: 101,
      renderer,
      normalStrength: 3.4
    });
    this.buildTerrain(renderer);

    // 6b. Moonlit Painted Grass Brushstrokes
    this.buildNightGrass(config);

    // 7. Monumental Flame-Shaped Cypress Tree + Drifting Cypress Leaves
    this.buildCypressTree(config);
    this.buildDriftingCypressLeaves(config);

    // 8. Distant Alpilles Mountain Ridges with Curl-Flow Brushstrokes & Moonlit Rim
    this.buildAlpillesRidges();

    // 9. Detailed Saint-Rémy Provençal Village, Church Steeple, 16-Segment Lamps & Reflective Stream
    this.townHandle = buildStarryNightTown(
      this.scene,
      getStarryNightHeight,
      getStarryNightNormal,
      renderer,
      this.sharedCobblePbr
    );

    // 10. Swirl-Following Nocturnal Fireflies
    this.buildSwirlFireflies();

    // 11. HDR Cinematic Post-Processing Pipeline (AgX Tone Mapping + Crisp Bloom)
    this.pipeline = new CinematicPipeline(renderer, this.scene, camera, {
      defaultStyle: 'natural',
      bloomStrength: 0.34,
      bloomRadius: 0.45,
      bloomThreshold: 0.86
    });

    this.isInitialized = true;
  }

  private setupLighting(renderer: THREE.WebGLRenderer, config?: SpaceConfig): void {
    const ambientColor = config?.lighting?.ambient?.color ?? '#243c70';
    const ambientIntensity = Math.max(config?.lighting?.ambient?.intensity ?? 0.65, 0.55);
    this.ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    this.scene.add(this.ambientLight);

    // Sky-to-ground hemisphere light (#3b5fa8 -> #1b2240) so shadows remain luminous cobalt-indigo
    this.hemiLight = new THREE.HemisphereLight('#3b5fa8', '#1b2240', 1.25);
    this.scene.add(this.hemiLight);

    // Config-compatible primary directional key light
    const dirColor = config?.lighting?.directional?.color ?? '#fefcd7';
    const dirIntensity = config?.lighting?.directional?.intensity ?? 0.85;
    const dirPos = config?.lighting?.directional?.position ?? [30, 45, -25];
    this.directionalLight = new THREE.DirectionalLight(dirColor, dirIntensity);
    this.directionalLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.scene.add(this.directionalLight);

    // Dedicated Moonlight Directional Fill (#7da4f8 intensity ~1.15) from Crescent Moon direction (115, 125, -165)
    this.moonDirectionalLight = new THREE.DirectionalLight('#7da4f8', 1.15);
    this.moonDirectionalLight.position.set(62, 68, -90);
    if (renderer && typeof (renderer as any).getContext === 'function') {
      try {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.moonDirectionalLight.castShadow = true;
        this.moonDirectionalLight.shadow.mapSize.set(2048, 2048);
        this.moonDirectionalLight.shadow.camera.near = 10;
        this.moonDirectionalLight.shadow.camera.far = 260;
        const d = 68;
        this.moonDirectionalLight.shadow.camera.left = -d;
        this.moonDirectionalLight.shadow.camera.right = d;
        this.moonDirectionalLight.shadow.camera.top = d;
        this.moonDirectionalLight.shadow.camera.bottom = -d;
        this.moonDirectionalLight.shadow.bias = -0.0005;
      } catch {
        // Safe no-op in headless test environments
      }
    }
    this.scene.add(this.moonDirectionalLight);

    // Opposite sky-bounce rim light for vivid village facades, cypress lobes & hill contours
    this.rimDirectionalLight = new THREE.DirectionalLight('#6b8fd8', 0.55);
    this.rimDirectionalLight.position.set(-55, 28, 60);
    this.scene.add(this.rimDirectionalLight);
  }

  private bakeNightEnvironment(renderer?: THREE.WebGLRenderer, config?: SpaceConfig): void {
    if (!renderer || typeof (renderer as any).getContext !== 'function') return;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      const envSkyGeo = new THREE.SphereGeometry(120, 32, 16);
      const envSkyMat = createStarrySkyMaterial({
        swirlSpeed: config?.sky?.swirlSpeed ?? 1.2,
        topColor: config?.sky?.topColor ?? '#081542',
        bottomColor: config?.sky?.bottomColor ?? '#1f3e78',
        horizonColor: config?.sky?.horizonColor ?? '#285249'
      });
      const envSkyMesh = new THREE.Mesh(envSkyGeo, envSkyMat);
      envScene.add(envSkyMesh);

      // Luminous moon & warm village horizon bounce proxies for PBR reflections
      const proxyGeo = new THREE.SphereGeometry(10, 12, 10);
      const moonProxyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.3, 0.95) });
      const moonProxy = new THREE.Mesh(proxyGeo, moonProxyMat);
      moonProxy.position.set(60, 65, -86);
      envScene.add(moonProxy);

      const villageProxyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.34, 0.10) });
      const villageProxy = new THREE.Mesh(proxyGeo, villageProxyMat);
      villageProxy.position.set(0, 6, -65);
      envScene.add(villageProxy);

      this.envRenderTarget = pmrem.fromScene(envScene, 0.04);
      this.scene.environment = this.envRenderTarget.texture;
      this.scene.environmentIntensity = 0.95;

      envSkyGeo.dispose();
      envSkyMat.dispose();
      proxyGeo.dispose();
      moonProxyMat.dispose();
      villageProxyMat.dispose();
      pmrem.dispose();
    } catch {
      // Safe fallback on headless mock renderers
    }
  }

  private buildSkyDome(config?: SpaceConfig): void {
    const skyGeo = new THREE.SphereGeometry(300, 64, 32);
    this.skyMaterial = createStarrySkyMaterial({
      swirlSpeed: config?.sky?.swirlSpeed ?? 1.2,
      topColor: config?.sky?.topColor ?? '#050a30',
      bottomColor: config?.sky?.bottomColor ?? '#1f305e',
      horizonColor: config?.sky?.horizonColor ?? '#1e3c38'
    });
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    skyMesh.name = 'SkyDome';
    this.scene.add(skyMesh);
  }

  private buildCrescentMoon(config?: SpaceConfig): void {
    const moonGeo = new THREE.PlaneGeometry(54, 54);
    this.moonMaterial = createCrescentMoonMaterial({
      glowIntensity: config?.sky?.moonGlow ?? 1.05,
      aureoleSpeed: 1.25
    });
    const moonMesh = new THREE.Mesh(moonGeo, this.moonMaterial);
    moonMesh.name = 'CrescentMoon';
    moonMesh.position.set(115, 125, -165);
    moonMesh.lookAt(0, 0, 0);
    this.scene.add(moonMesh);
  }

  private buildStars(config?: SpaceConfig): void {
    this.starMaterials = [];

    // 11 Calibrated Star Positions across the swirling night sky
    const starConfigs = [
      { pos: new THREE.Vector3(-45, 95, -165), size: 30, pulseSpeed: 1.7, intensity: 1.3 }, // Morning Star (Venus)
      { pos: new THREE.Vector3(25, 110, -170), size: 24, pulseSpeed: 1.4, intensity: 1.15 },
      { pos: new THREE.Vector3(0, 88, -155), size: 28, pulseSpeed: 1.9, intensity: 1.25 },
      { pos: new THREE.Vector3(75, 118, -145), size: 22, pulseSpeed: 1.3, intensity: 1.1 },
      { pos: new THREE.Vector3(55, 82, -165), size: 25, pulseSpeed: 1.6, intensity: 1.2 },
      { pos: new THREE.Vector3(-78, 80, -155), size: 22, pulseSpeed: 1.5, intensity: 1.05 },
      { pos: new THREE.Vector3(-15, 105, -180), size: 26, pulseSpeed: 1.6, intensity: 1.18 },
      { pos: new THREE.Vector3(-35, 62, -175), size: 20, pulseSpeed: 1.2, intensity: 1.0 },
      { pos: new THREE.Vector3(18, 138, -135), size: 28, pulseSpeed: 1.8, intensity: 1.25 },
      { pos: new THREE.Vector3(98, 92, -150), size: 24, pulseSpeed: 1.4, intensity: 1.1 },
      { pos: new THREE.Vector3(-92, 58, -145), size: 21, pulseSpeed: 1.5, intensity: 1.0 }
    ];

    const starDensityScale = (config?.sky?.starDensity ?? 500) / 500;

    starConfigs.forEach((cfg, index) => {
      const geo = new THREE.PlaneGeometry(cfg.size, cfg.size);
      const mat = createStarHaloMaterial({
        intensity: cfg.intensity * starDensityScale,
        pulseSpeed: cfg.pulseSpeed,
        coreSigma: 0.11,
        haloSigma: 0.39,
        waveFreq: 15.0 + index * 0.5
      });
      this.starMaterials.push(mat);

      const starMesh = new THREE.Mesh(geo, mat);
      starMesh.name = `StarHalo_${index + 1}`;
      starMesh.position.copy(cfg.pos);
      starMesh.lookAt(0, 0, 0);
      this.scene.add(starMesh);
    });
  }

  private buildTerrain(renderer?: THREE.WebGLRenderer): void {
    const width = 220;
    const depth = 220;
    const segments = 110;

    const terrainGeo = new THREE.PlaneGeometry(width, depth, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = getStarryNightHeight(x, z);
      posAttr.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const texData = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      const v = 228 + ((i * 19) % 27);
      texData[i * 4] = v;
      texData[i * 4 + 1] = v;
      texData[i * 4 + 2] = v;
      texData[i * 4 + 3] = 255;
    }
    const detailTex = new THREE.DataTexture(texData, 4, 4, THREE.RGBAFormat);
    detailTex.wrapS = THREE.RepeatWrapping;
    detailTex.wrapT = THREE.RepeatWrapping;
    detailTex.needsUpdate = true;
    if (renderer && typeof (renderer as any).initTexture === 'function') {
      try {
        (renderer as any).initTexture(detailTex);
      } catch { }
    }

    this.groundMaterial = createStarryGroundMaterial(
      new THREE.Vector3(115, 125, -165),
      detailTex,
      this.sharedCobblePbr ?? undefined
    );

    const terrainMesh = new THREE.Mesh(terrainGeo, this.groundMaterial);
    terrainMesh.name = 'UndulatingHillTerrain';
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
  }

  private buildNightGrass(config?: SpaceConfig): void {
    const count = 16500;
    const W0 = 0.075;
    const W1 = 0.042;
    const H = 0.56;

    const positions = new Float32Array([
      -W0 / 2, 0.0, 0.0,
      W0 / 2, 0.0, 0.0,
      -W1 / 2, 0.45 * H, 0.02,
      W1 / 2, 0.45 * H, 0.02,
      0.0, H, 0.09
    ]);
    const normals = new Float32Array([
      0, 0.2, 0.98,
      0, 0.2, 0.98,
      0, 0.3, 0.95,
      0, 0.3, 0.95,
      0, 0.5, 0.86
    ]);
    const uvs = new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.1, 0.45,
      0.9, 0.45,
      0.5, 1.0
    ]);
    const indices = [0, 1, 3, 0, 3, 2, 2, 3, 4];

    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bladeGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    bladeGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    bladeGeo.setIndex(indices);
    bladeGeo.computeBoundingSphere();

    this.nightGrassMaterial = createGrassSwayMaterial({
      windSpeed: config?.wind?.speed ?? 1.5,
      windDirection: [0.8, 0.5],
      windStrength: (config?.wind?.swayIntensity ?? 0.4) * 0.9,
      gustiness: config?.wind?.gustiness ?? 0.35,
      baseColor: '#122f3d',
      tipColor: '#2b5e66',
      sunDirection: [115, 125, -165]
    });

    const grassMesh = new THREE.InstancedMesh(bladeGeo, this.nightGrassMaterial, count);
    grassMesh.name = 'InstancedNightGrass';

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const goldenAngle = 2.399963229728653;

    let placed = 0;
    for (let i = 0; placed < count && i < count * 2.5; i++) {
      const j1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1.0;
      const j2 = Math.abs(Math.sin(i * 78.233) * 19341.123) % 1.0;

      const rRatio = Math.pow((i + j1) / (count * 1.4), 0.58);
      const r = 1.0 + rRatio * 48.0;
      const theta = i * goldenAngle + (j2 - 0.5) * 0.45;
      const x = r * Math.cos(theta) + (j1 - 0.5) * 0.9;
      const z = r * Math.sin(theta) + (j2 - 0.5) * 0.9;

      // Clear cobblestone path, plaza, carriage boulevard, cypress trunk & winding Rhone stream
      if (Math.abs(x - getTownRoadCenterX(z)) < 2.5) continue;
      if (Math.abs(x - getStreamCenterX(z)) < 3.0) continue;
      if (getDistanceToCarriageLane(x, z) < 2.5) continue;
      if (x >= -17.0 && x <= 11.5 && z >= -32.8 && z <= -16.4) continue;
      if (Math.hypot(x + 18.0, z + 12.0) < 2.6) continue;

      const y = getStarryNightHeight(x, z);
      pos.set(x, y, z);
      quat.setFromAxisAngle(upAxis, j1 * Math.PI * 2);
      const sy = 0.68 + j2 * 0.64;
      scale.set(1.0 + j1 * 0.35, sy, 1.0);
      dummy.compose(pos, quat, scale);
      grassMesh.setMatrixAt(placed, dummy);

      // Harmonized Van Gogh nocturnal cobalt, Prussian-teal, dark viridian, and subtle ochre glints
      if (placed % 11 === 0) {
        col.set('#889258'); // subtle moonlit olive-ochre brushstroke glint
      } else if (placed % 3 === 0) {
        col.set('#5a88cc'); // nocturnal cobalt moonlight reflection
      } else if (placed % 5 === 0) {
        col.set('#4e708c'); // deep Prussian blue-teal
      } else {
        col.set('#689c88'); // nocturnal viridian-emerald
      }
      grassMesh.setColorAt(placed, col);
      placed++;
    }

    grassMesh.count = placed;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    this.scene.add(grassMesh);
  }

  private buildCypressTree(config?: SpaceConfig): void {
    const treeHeight = 24.0;
    const cypressGeo = new THREE.CylinderGeometry(0.08, 2.4, treeHeight, 24, 48, true);
    cypressGeo.translate(0, treeHeight / 2, 0);

    const windSpeed = config?.wind?.speed ?? 1.5;
    const sway = config?.wind?.swayIntensity ?? 0.4;

    this.cypressMaterial = createCypressMaterial({
      treeHeight,
      windStrength: sway * (windSpeed / 1.5),
      windDirection: [0.85, 0.35],
      baseColor: '#061214',
      midColor: '#0f3328',
      rimColor: '#365da8'
    });

    const cypressMesh = new THREE.Mesh(cypressGeo, this.cypressMaterial);
    cypressMesh.name = 'MonumentalCypressTree';
    cypressMesh.castShadow = true;

    const treeX = -18.0;
    const treeZ = -12.0;
    const groundY = getStarryNightHeight(treeX, treeZ);
    cypressMesh.position.set(treeX, groundY - 0.2, treeZ);

    // Secondary companion flame tufts near the main cypress base
    const side1Geo = new THREE.CylinderGeometry(0.05, 1.35, 13.5, 16, 28, true);
    side1Geo.translate(0, 6.75, 0);
    const side1 = new THREE.Mesh(side1Geo, this.cypressMaterial);
    side1.name = 'CypressCompanionLeft';
    side1.position.set(treeX - 2.3, getStarryNightHeight(treeX - 2.3, treeZ + 1.5) - 0.2, treeZ + 1.5);

    const side2Geo = new THREE.CylinderGeometry(0.04, 1.15, 11.0, 16, 24, true);
    side2Geo.translate(0, 5.5, 0);
    const side2 = new THREE.Mesh(side2Geo, this.cypressMaterial);
    side2.name = 'CypressCompanionRight';
    side2.position.set(treeX + 2.2, getStarryNightHeight(treeX + 2.2, treeZ + 1.0) - 0.2, treeZ + 1.0);

    this.scene.add(cypressMesh);
    this.scene.add(side1);
    this.scene.add(side2);
  }

  private buildDriftingCypressLeaves(config?: SpaceConfig): void {
    const leafCount = 140;
    // Tapered 2-triangle diamond cypress needle leaf geometry (strictly finite)
    const leafPos = new Float32Array([
      0.0, 0.14, 0.0,
      -0.05, 0.0, 0.015,
      0.0, -0.14, 0.0,
      0.05, 0.0, -0.015
    ]);
    const leafNorm = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1
    ]);
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
    leafGeo.setAttribute('normal', new THREE.BufferAttribute(leafNorm, 3));
    leafGeo.setIndex([0, 1, 2, 0, 2, 3]);
    leafGeo.computeBoundingSphere();

    const windDir = config?.wind?.direction ?? [0.8, 0.5];
    const wx = Number.isFinite(windDir[0]) ? windDir[0] : 0.8;
    const wz = Number.isFinite(windDir[2] ?? windDir[1]) ? (windDir[2] ?? windDir[1]) : 0.5;
    const wLen = Math.hypot(wx, wz) || 1.0;

    this.leafDriftMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0.0 },
          uWindSpeed: { value: config?.wind?.speed ?? 1.5 },
          uWindDirection: { value: new THREE.Vector2(wx / wLen, wz / wLen) }
        }
      ]),
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        uniform float uTime;
        uniform float uWindSpeed;
        uniform vec2 uWindDirection;
        varying vec3 vColor;

        void main() {
          vec3 baseOrigin = vec3(instanceMatrix[3].xyz);
          float seed = fract(sin(dot(baseOrigin.xz, vec2(12.9898, 78.233))) * 43758.5453);
          float life = fract(uTime * (0.065 + 0.03 * uWindSpeed) + seed);

          // Helical Van Gogh swirl trajectory rising off the cypress flame crown
          float angle = life * 6.28318 * 1.4 + seed * 6.283;
          float radius = 1.6 + life * 16.0;
          vec3 driftPos = baseOrigin;
          driftPos.x += uWindDirection.x * life * 28.0 + cos(angle) * radius * 0.45;
          driftPos.z += uWindDirection.y * life * 22.0 + sin(angle) * radius * 0.45;
          driftPos.y += sin(life * 3.14159) * 4.5 + life * 3.2;

          // Tumble rotation per leaf
          float rot = uTime * (2.2 + seed * 1.8) + seed * 12.0;
          float c = cos(rot);
          float s = sin(rot);
          vec3 local = position * (0.85 + seed * 0.65);
          vec3 spun = vec3(local.x * c - local.y * s, local.x * s + local.y * c, local.z + local.x * s * 0.4);

          vColor = mix(vec3(0.020, 0.082, 0.058), vec3(0.045, 0.120, 0.235), seed);
          if (seed > 0.82) vColor = vec3(0.16, 0.125, 0.035);

          vec4 worldPos = vec4(driftPos + spun, 1.0);
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
          #include <fog_fragment>
        }
      `
    });

    const leafMesh = new THREE.InstancedMesh(leafGeo, this.leafDriftMaterial, leafCount);
    leafMesh.name = 'DriftingCypressLeaves';
    leafMesh.frustumCulled = false;

    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const treeBaseY = getStarryNightHeight(-18, -12);

    for (let i = 0; i < leafCount; i++) {
      const f1 = Math.abs(Math.sin(i * 19.13 + 0.7) * 43758.5453) % 1.0;
      const f2 = Math.abs(Math.cos(i * 41.71 + 1.3) * 19341.123) % 1.0;
      const f3 = (i / leafCount);
      const ang = f1 * Math.PI * 2;
      const rad = 0.8 + f2 * 2.4;
      const x = -18.0 + Math.cos(ang) * rad;
      const z = -12.0 + Math.sin(ang) * rad;
      const y = treeBaseY + 3.0 + f3 * 18.0;
      pos.set(x, y, z);
      dummy.compose(pos, quat, scale);
      leafMesh.setMatrixAt(i, dummy);
    }
    leafMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(leafMesh);
  }

  private buildSwirlFireflies(): void {
    const count = 280;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r1 = Math.abs(Math.sin(i * 12.9898 + 1.1) * 43758.5453) % 1.0;
      const r2 = Math.abs(Math.sin(i * 78.233 + 2.3) * 19341.123) % 1.0;
      const r3 = Math.abs(Math.cos(i * 37.719 + 0.5) * 28411.713) % 1.0;

      const angle = r1 * Math.PI * 2;
      const radius = 5.0 + Math.sqrt(r2) * 52.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 10.0;
      const groundY = getStarryNightHeight(x, z);
      const y = groundY + 0.6 + r3 * 3.8;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = r1;
      seeds[i] = r2;
    }

    const fireflyGeo = new THREE.BufferGeometry();
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    fireflyGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    fireflyGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    fireflyGeo.computeBoundingSphere();

    this.fireflyMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0.0 },
          uAudioEnergy: { value: 0.0 }
        }
      ]),
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        uniform float uTime;
        uniform float uAudioEnergy;
        attribute float aPhase;
        attribute float aSeed;
        varying float vPulse;
        varying float vSeed;

        void main() {
          vSeed = aSeed;
          float t = uTime * (0.45 + 0.35 * aSeed) + aPhase * 6.28318;

          // Curl-swirl elliptical hover path matching Van Gogh eddies
          vec3 p = position;
          p.x += sin(t * 0.85 + p.z * 0.08) * 1.45 + cos(t * 0.35) * 0.65;
          p.z += cos(t * 0.78 + p.x * 0.08) * 1.45 + sin(t * 0.32) * 0.65;
          p.y += sin(t * 1.35 + aPhase * 12.0) * 0.55;

          float audioBoost = 1.0 + clamp(uAudioEnergy, 0.0, 1.5) * 0.45;
          vPulse = (0.42 + 0.58 * (0.5 + 0.5 * sin(uTime * (2.4 + aSeed * 2.2) + aPhase * 19.0))) * audioBoost;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp((210.0 * (0.75 + 0.5 * vPulse)) / max(-mvPosition.z, 1.0), 4.0, 22.0);
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        varying float vPulse;
        varying float vSeed;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;

          float core = exp(-d * d * 26.0);
          float halo = smoothstep(0.5, 0.05, d) * 0.48;
          vec3 warmGold = vec3(1.15, 0.86, 0.24);
          vec3 chartreuse = vec3(0.74, 1.05, 0.32);
          vec3 col = mix(warmGold, chartreuse, vSeed * 0.45);
          gl_FragColor = vec4(col * (core + halo) * vPulse, (core + halo * 0.7) * vPulse);
          #include <fog_fragment>
        }
      `
    });

    const fireflyPoints = new THREE.Points(fireflyGeo, this.fireflyMaterial);
    fireflyPoints.name = 'SwirlFireflies';
    fireflyPoints.frustumCulled = false;
    this.scene.add(fireflyPoints);
  }

  private buildAlpillesRidges(): void {
    this.ridgeMaterials = [];
    const moonDir = new THREE.Vector3(115, 125, -165);

    // 3 layered mountain ridges with Van Gogh curl-flow brushwork & moonlit crest rim illumination
    const ridgeConfigs = [
      { z: -86, height: 32 },
      { z: -106, height: 42 },
      { z: -126, height: 52 }
    ];

    ridgeConfigs.forEach((cfg, idx) => {
      const width = 300;
      const segments = 64;
      const ridgeGeo = new THREE.PlaneGeometry(width, cfg.height, segments, 6);
      const pos = ridgeGeo.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const ny = (y / cfg.height) + 0.5; // 0 at bottom, 1 at top crest

        // Gentle amphitheater curve wrapping the northern valley
        const arcZ = (x * x) * 0.0011;
        pos.setZ(i, arcZ);

        // Modulate upper ridge silhouette into rolling rhythmic Alpilles peaks while keeping base grounded
        const crest =
          Math.sin(x * 0.04 + idx * 1.5) * 6.5 +
          Math.cos(x * 0.08 + idx) * 3.8 +
          Math.sin(x * 0.15) * 1.9;
        pos.setY(i, y + crest * Math.max(0, ny));
      }
      ridgeGeo.computeVertexNormals();

      const ridgeMat = createAlpillesRidgeMaterial(moonDir, idx);
      this.ridgeMaterials.push(ridgeMat);

      const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
      ridgeMesh.name = `AlpillesRidge_${idx + 1}`;
      ridgeMesh.position.set(0, cfg.height * 0.34 - 4.0, cfg.z);
      this.scene.add(ridgeMesh);
    });
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    this.lastDeltaTime = deltaTime;
    this.lastElapsedTime = elapsedTime;

    // 1. Advance Sky Swirl Shader & Impasto Ground Shader
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.groundMaterial) {
      this.groundMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.nightGrassMaterial) {
      this.nightGrassMaterial.uniforms.uTime.value = elapsedTime;
    }

    // 2. Advance Crescent Moon Aureole
    if (this.moonMaterial) {
      this.moonMaterial.uniforms.uTime.value = elapsedTime;
    }

    // 3. Advance Cypress Flame Wind Sway & Drifting Cypress Leaves
    if (this.cypressMaterial) {
      this.cypressMaterial.uniforms.uTime.value = elapsedTime;
    }
    if (this.leafDriftMaterial) {
      this.leafDriftMaterial.uniforms.uTime.value = elapsedTime;
    }

    // 4. Advance Alpilles Ridges & Swirl Fireflies
    for (const rMat of this.ridgeMaterials) {
      rMat.uniforms.uTime.value = elapsedTime;
    }
    if (this.fireflyMaterial) {
      this.fireflyMaterial.uniforms.uTime.value = elapsedTime;
    }

    // 5. Advance Star Halos Pulsation
    for (const mat of this.starMaterials) {
      mat.uniforms.uTime.value = elapsedTime;
    }

    // 6. Advance Detailed Saint-Rémy Village, Church, Stream, Train, Carriage & Chimney Smoke
    if (this.townHandle) {
      const windSpeed = this.currentConfig?.wind?.speed ?? 1.5;
      const wd = this.currentConfig?.wind?.direction ?? [0.85, 0.1, 0.45];
      this.townHandle.update(deltaTime, elapsedTime, windSpeed, [wd[0], wd[2] ?? wd[1] ?? 0.45]);
    }
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    if (this.pipeline) {
      this.pipeline.renderFrame(renderer, camera, this.lastDeltaTime, this.lastElapsedTime);
    } else {
      renderer.render(this.scene, camera);
    }
  }

  public setAudioEnergy(bass: number, mid: number, treble: number): void {
    if (!this.isInitialized) return;
    const safeBass = Number.isFinite(bass) ? Math.max(0, Math.min(2, bass)) : 0;
    const safeMid = Number.isFinite(mid) ? Math.max(0, Math.min(2, mid)) : 0;
    const safeTreble = Number.isFinite(treble) ? Math.max(0, Math.min(2, treble)) : 0;

    if (this.skyMaterial?.uniforms?.uBassEnergy) {
      this.skyMaterial.uniforms.uBassEnergy.value = safeBass;
    }
    if (this.moonMaterial?.uniforms?.uBassEnergy) {
      this.moonMaterial.uniforms.uBassEnergy.value = safeBass;
    }
    for (const mat of this.starMaterials) {
      if (mat.uniforms?.uPulseIntensity) {
        mat.uniforms.uPulseIntensity.value = 1.0 + safeBass * 0.35 + safeTreble * 0.18;
      }
      if (mat.uniforms?.uTrebleEnergy) {
        mat.uniforms.uTrebleEnergy.value = safeTreble;
      }
    }
    if (this.fireflyMaterial?.uniforms?.uAudioEnergy) {
      this.fireflyMaterial.uniforms.uAudioEnergy.value = safeMid * 0.5 + safeTreble * 0.5;
    }
    if (this.townHandle?.setAudioEnergy) {
      this.townHandle.setAudioEnergy(safeBass, safeMid, safeTreble);
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

    if (newConfig.sky && this.skyMaterial) {
      if (typeof newConfig.sky.swirlSpeed === 'number' && Number.isFinite(newConfig.sky.swirlSpeed) && newConfig.sky.swirlSpeed >= 0) {
        this.skyMaterial.uniforms.uSwirlSpeed.value = newConfig.sky.swirlSpeed;
        if (this.currentConfig?.sky) this.currentConfig.sky.swirlSpeed = newConfig.sky.swirlSpeed;
      }
      if (typeof newConfig.sky.starDensity === 'number' && Number.isFinite(newConfig.sky.starDensity) && newConfig.sky.starDensity >= 0) {
        if (this.currentConfig?.sky) this.currentConfig.sky.starDensity = newConfig.sky.starDensity;
      }
      if (newConfig.sky.topColor && typeof newConfig.sky.topColor === 'string') {
        this.skyMaterial.uniforms.uTopColor.value.set(newConfig.sky.topColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
      }
      if (newConfig.sky.bottomColor && typeof newConfig.sky.bottomColor === 'string') {
        this.skyMaterial.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
      }
      if (newConfig.sky.horizonColor && typeof newConfig.sky.horizonColor === 'string') {
        this.skyMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
      }
    }

    if (newConfig.sky && this.moonMaterial && typeof newConfig.sky.moonGlow === 'number' && Number.isFinite(newConfig.sky.moonGlow)) {
      this.moonMaterial.uniforms.uGlowIntensity.value = newConfig.sky.moonGlow;
      if (this.currentConfig?.sky) this.currentConfig.sky.moonGlow = newConfig.sky.moonGlow;
    }

    if (newConfig.wind) {
      if (this.cypressMaterial) {
        if (typeof newConfig.wind.swayIntensity === 'number' && Number.isFinite(newConfig.wind.swayIntensity)) {
          this.cypressMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity;
          if (this.currentConfig?.wind) this.currentConfig.wind.swayIntensity = newConfig.wind.swayIntensity;
        }
        if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
          if (this.currentConfig?.wind) this.currentConfig.wind.speed = newConfig.wind.speed;
        }
        if (typeof newConfig.wind.gustiness === 'number' && Number.isFinite(newConfig.wind.gustiness)) {
          if (this.currentConfig?.wind) this.currentConfig.wind.gustiness = newConfig.wind.gustiness;
        }
        if (newConfig.wind.direction && Array.isArray(newConfig.wind.direction)) {
          this.cypressMaterial.uniforms.uWindDirection.value.set(
            newConfig.wind.direction[0],
            newConfig.wind.direction[1]
          );
          if (this.currentConfig?.wind) this.currentConfig.wind.direction = newConfig.wind.direction as [number, number, number];
        }
      }
      if (this.nightGrassMaterial) {
        if (typeof newConfig.wind.swayIntensity === 'number' && Number.isFinite(newConfig.wind.swayIntensity)) {
          this.nightGrassMaterial.uniforms.uWindStrength.value = newConfig.wind.swayIntensity * 0.9;
        }
        if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
          this.nightGrassMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        }
      }
      if (this.leafDriftMaterial) {
        if (typeof newConfig.wind.speed === 'number' && Number.isFinite(newConfig.wind.speed)) {
          this.leafDriftMaterial.uniforms.uWindSpeed.value = newConfig.wind.speed;
        }
        if (newConfig.wind.direction && Array.isArray(newConfig.wind.direction)) {
          const wx = newConfig.wind.direction[0] ?? 0.8;
          const wz = newConfig.wind.direction[2] ?? newConfig.wind.direction[1] ?? 0.5;
          const wLen = Math.hypot(wx, wz) || 1.0;
          this.leafDriftMaterial.uniforms.uWindDirection.value.set(wx / wLen, wz / wLen);
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
    return getStarryNightHeight(x, z);
  }

  public getSpawnPoint(): ISpawnPoint {
    const x = this.currentConfig?.camera?.spawnPosition?.[0] ?? 0;
    const z = this.currentConfig?.camera?.spawnPosition?.[2] ?? 12;
    const groundY = this.getGroundHeight(x, z);
    const heightOffset = this.currentConfig?.camera?.heightOffset ?? 1.7;

    const lookAtX = this.currentConfig?.camera?.lookAt?.[0] ?? 0;
    const lookAtY = this.currentConfig?.camera?.lookAt?.[1] ?? 6;
    const lookAtZ = this.currentConfig?.camera?.lookAt?.[2] ?? -20;

    return {
      position: new THREE.Vector3(x, groundY + heightOffset, z),
      lookAt: new THREE.Vector3(lookAtX, lookAtY, lookAtZ)
    };
  }

  public getWanderBounds(): IWanderBounds {
    const radius = this.currentConfig?.camera?.wanderRadius ?? 70;
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
        name: 'Village Overlook',
        position: new THREE.Vector3(10.0, this.getGroundHeight(10.0, -15.0) + 2.5, -15.0),
        lookAt: new THREE.Vector3(2.0, this.getGroundHeight(2.0, -45.0) + 4.5, -45.0),
        dwellTime: 8.0
      },
      {
        name: 'Cypress Foot',
        position: new THREE.Vector3(-14.0, this.getGroundHeight(-14.0, -8.0) + 2.0, -8.0),
        lookAt: new THREE.Vector3(-18.0, this.getGroundHeight(-18.0, -12.0) + 8.0, -12.0),
        dwellTime: 10.0
      },
      {
        name: 'Moon Gazer',
        position: new THREE.Vector3(4.0, this.getGroundHeight(4.0, 5.0) + 3.0, 5.0),
        lookAt: new THREE.Vector3(45.0, 48.0, -90.0),
        dwellTime: 12.0
      },
      {
        name: 'Starry Ridge',
        position: new THREE.Vector3(0.0, this.getGroundHeight(0.0, 15.0) + 2.0, 15.0),
        lookAt: new THREE.Vector3(0.0, 10.0, -50.0),
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

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
    this.scene.environment = null;

    if (this.moonDirectionalLight?.shadow?.map) {
      this.moonDirectionalLight.shadow.map.dispose();
    }

    if (this.townHandle) {
      this.townHandle.pbrSets.forEach((set) => disposePbrTextureSet(set));
      this.townHandle.extraTextures.forEach((tex) => tex.dispose());
      this.townHandle.extraMaterials.forEach((mat) => mat.dispose());
      this.townHandle = null;
    }

    if (this.sharedCobblePbr) {
      disposePbrTextureSet(this.sharedCobblePbr);
      this.sharedCobblePbr = null;
    }

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    this.skyMaterial = null;
    this.groundMaterial = null;
    this.nightGrassMaterial = null;
    this.moonMaterial = null;
    this.cypressMaterial = null;
    this.ridgeMaterials = [];
    this.starMaterials = [];
    this.fireflyMaterial = null;
    this.leafDriftMaterial = null;
    this.ambientLight = null;
    this.hemiLight = null;
    this.directionalLight = null;
    this.moonDirectionalLight = null;
    this.rimDirectionalLight = null;

    this.isInitialized = false;
  }
}
