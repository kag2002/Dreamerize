import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';

export interface GlbEnvironmentSceneOptions {
  id?: string;
  slug?: string;
  name?: string;
  assetUrl?: string;
}

/**
 * GlbEnvironmentScene implements ISpace for `.glb` / `.gltf` baked-lighting PBR worlds.
 * Wires GLTFLoader with Draco, KTX2/Basis, and Meshopt decoders, PMREM atmospheric IBL,
 * embedded AnimationMixer playback, downward raycast ground clamping, and zero-leak disposal.
 */
export class GlbEnvironmentScene implements ISpace {
  public readonly id: string;
  public readonly name: string;
  public readonly slug: string;

  private readonly defaultAssetUrl: string;

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;

  // Loaders & IBL
  private dracoLoader: DRACOLoader | null = null;
  private ktx2Loader: KTX2Loader | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Model, animation & lights
  private modelRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private dirLight: THREE.DirectionalLight | null = null;
  private skyMesh: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private groundApron: THREE.Mesh | null = null;
  private groundApronMaterial: THREE.ShaderMaterial | null = null;

  // Ground raycasting & framing
  private collidableMeshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly rayOrigin = new THREE.Vector3();
  private readonly rayDown = new THREE.Vector3(0, -1, 0);
  private groundY = 0;
  private modelCenter = new THREE.Vector3(0, 1.0, 0);
  private modelRadius = 6.0;
  private spawnPoint: ISpawnPoint = {
    position: new THREE.Vector3(0, 1.7, 7),
    lookAt: new THREE.Vector3(0, 1.2, 0)
  };
  private pois: IPointOfInterest[] = [];

  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  constructor(options: GlbEnvironmentSceneOptions = {}) {
    this.id = options.id ?? 'space-glb-environment';
    this.slug = options.slug ?? 'glb-environment';
    this.name = options.name ?? 'GLB 3D Environment';
    this.defaultAssetUrl = options.assetUrl ?? '/samples/stone-lantern.glb';
    this.scene = new THREE.Scene();
  }

  public async init(
    renderer: THREE.WebGLRenderer,
    _camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> {
    if (this.isInitialized) {
      this.dispose();
    }

    this.scene = new THREE.Scene();
    const cfgAny = config as any;
    const assetUrl: string = cfgAny?.assetUrl || this.defaultAssetUrl || '/samples/stone-lantern.glb';

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#dce8f2',
        density: config?.fog?.density ?? 0.006
      },
      sky: {
        type: config?.sky?.type ?? ('custom_asset' as any),
        topColor: config?.sky?.topColor ?? '#3468c8',
        bottomColor: config?.sky?.bottomColor ?? '#97c7f5',
        horizonColor: config?.sky?.horizonColor ?? '#f2e8d8',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0,
        starDensity: config?.sky?.starDensity ?? 0,
        cloudCoverage: config?.sky?.cloudCoverage ?? 0.35,
        cloudSpeed: config?.sky?.cloudSpeed ?? 0.5
      },
      wind: config?.wind ?? { speed: 1.0, direction: [1, 0, 0.2], gustiness: 0.3, swayIntensity: 0.2 },
      lighting: {
        ambient: {
          color: config?.lighting?.ambient?.color ?? '#f5f8ff',
          intensity: config?.lighting?.ambient?.intensity ?? 0.75
        },
        directional: {
          color: config?.lighting?.directional?.color ?? '#fff4dc',
          intensity: config?.lighting?.directional?.intensity ?? 1.85,
          position: config?.lighting?.directional?.position ?? [12, 22, 14],
          castShadow: config?.lighting?.directional?.castShadow ?? false
        },
        pointLights: config?.lighting?.pointLights ?? []
      },
      shaders: config?.shaders ?? {},
      audio: {
        trackId: config?.audio?.trackId ?? 'glb-sanctuary-ambient',
        name: config?.audio?.name ?? 'Garden Stone Sanctuary & Wind Chimes',
        sourceUrl: config?.audio?.sourceUrl ?? '/audio/breezy-meadow-ambient.ogg',
        defaultVolume: config?.audio?.defaultVolume ?? 0.65,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'procedural_synth',
        reverb: config?.audio?.reverb ?? { decay: 2.0, wet: 0.25 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 1.7, 7.0],
        lookAt: config?.camera?.lookAt ?? [0, 1.2, 0],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 3.8,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.1,
        wanderRadius: config?.camera?.wanderRadius ?? 18,
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 2.0, 6],
          [5, 2.2, 1],
          [0, 2.1, -6],
          [-5, 2.2, 1]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      },
      ...(cfgAny?.assetUrl ? { assetUrl } : {}),
      ...(cfgAny?.assetFormat ? { assetFormat: cfgAny.assetFormat } : {})
    } as SpaceConfig;

    this.scene.fog = new THREE.FogExp2(
      this.currentConfig.fog.color,
      this.currentConfig.fog.density
    );

    // 1. Setup Lighting & PMREM IBL
    this.setupLightingAndEnvironment(renderer, config);
    this.buildSkyDome(config);

    // 2. Wire GLTFLoader with Draco, KTX2/Basis, and Meshopt decoders
    try {
      await MeshoptDecoder.ready;
    } catch {
      // Ignore if WASM/JS ready check fails in restricted test envs
    }

    const gltfLoader = new GLTFLoader();

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/libs/draco/');
    gltfLoader.setDRACOLoader(this.dracoLoader);

    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath('/libs/basis/');
    if (renderer && typeof renderer.getContext === 'function') {
      try {
        this.ktx2Loader.detectSupport(renderer);
      } catch {
        // Ignore KTX2 detectSupport issues in mock renderers
      }
    }
    gltfLoader.setKTX2Loader(this.ktx2Loader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // 3. Load GLTF/GLB asset
    const gltf = await gltfLoader.loadAsync(assetUrl);
    this.modelRoot = gltf.scene || gltf.scenes?.[0] || new THREE.Group();
    this.modelRoot.name = 'GlbEnvironmentRoot';

    this.collidableMeshes = [];
    this.modelRoot.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        this.collidableMeshes.push(mesh);
      }
    });

    this.scene.add(this.modelRoot);

    // 4. Play embedded animations if present
    if (gltf.animations && gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.modelRoot);
      for (const clip of gltf.animations) {
        this.mixer.clipAction(clip).play();
      }
    }

    // 5. Auto-frame camera, ground apron, and POIs from loaded model bounds
    this.computeFramingFromModel(config);
    this.buildGroundApron();

    this.isInitialized = true;
  }

  private setupLightingAndEnvironment(renderer: THREE.WebGLRenderer, config?: SpaceConfig): void {
    const ambColor = config?.lighting?.ambient?.color ?? '#f5f8ff';
    const ambIntensity = config?.lighting?.ambient?.intensity ?? 0.75;
    this.hemiLight = new THREE.HemisphereLight(ambColor, '#64725e', ambIntensity);
    this.scene.add(this.hemiLight);

    const dirColor = config?.lighting?.directional?.color ?? '#fff4dc';
    const dirIntensity = config?.lighting?.directional?.intensity ?? 1.85;
    const dirPos = config?.lighting?.directional?.position ?? [12, 22, 14];
    this.dirLight = new THREE.DirectionalLight(dirColor, dirIntensity);
    this.dirLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    this.scene.add(this.dirLight);

    // Generate clean procedural atmospheric PMREM environment for PBR metallic/roughness reflections
    if (renderer && typeof renderer.getContext === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envScene = new THREE.Scene();

        const skyEnvGeo = new THREE.SphereGeometry(20, 24, 16);
        const skyEnvMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#9ac8f2'),
          side: THREE.BackSide
        });
        const skyEnvMesh = new THREE.Mesh(skyEnvGeo, skyEnvMat);
        envScene.add(skyEnvMesh);

        const sunBallGeo = new THREE.SphereGeometry(2.5, 16, 12);
        const sunBallMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(3.2, 2.8, 2.2)
        });
        const sunBall = new THREE.Mesh(sunBallGeo, sunBallMat);
        sunBall.position.set(dirPos[0] * 0.4, dirPos[1] * 0.4, dirPos[2] * 0.4);
        envScene.add(sunBall);

        const groundBounceGeo = new THREE.PlaneGeometry(36, 36);
        groundBounceGeo.rotateX(-Math.PI / 2);
        const groundBounceMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#5a6b54')
        });
        const groundBounce = new THREE.Mesh(groundBounceGeo, groundBounceMat);
        groundBounce.position.y = -5;
        envScene.add(groundBounce);

        this.envRenderTarget = pmrem.fromScene(envScene, 0.04);
        this.scene.environment = this.envRenderTarget.texture;

        ThreeResourceDisposer.disposeHierarchy(envScene);
        pmrem.dispose();
      } catch {
        // Fallback to HemisphereLight + DirectionalLight if PMREM unsupported
      }
    }
  }

  private buildSkyDome(config?: SpaceConfig): void {
    const skyGeo = new THREE.SphereGeometry(260, 48, 24);
    const topColor = new THREE.Color(config?.sky?.topColor ?? '#3468c8');
    const bottomColor = new THREE.Color(config?.sky?.bottomColor ?? '#97c7f5');
    const horizonColor = new THREE.Color(config?.sky?.horizonColor ?? '#f2e8d8');
    const dirPos = config?.lighting?.directional?.position ?? [12, 22, 14];
    const sunDir = new THREE.Vector3(dirPos[0], dirPos[1], dirPos[2]).normalize();

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: topColor },
        uBottomColor: { value: bottomColor },
        uHorizonColor: { value: horizonColor },
        uSunDir: { value: sunDir }
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uBottomColor, smoothstep(0.0, 0.25, h));
          col = mix(col, uTopColor, smoothstep(0.20, 0.92, h));
          float sunDot = max(dot(d, uSunDir), 0.0);
          col += vec3(1.0, 0.94, 0.80) * (pow(sunDot, 12.0) * 0.24 + smoothstep(0.997, 0.9995, sunDot) * 1.2);
          if (d.y < 0.0) {
            col = mix(col, uHorizonColor * 0.86, smoothstep(0.0, -0.25, d.y));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.name = 'GlbSkyDome';
    this.scene.add(this.skyMesh);
  }

  private buildGroundApron(): void {
    const apronGeo = new THREE.CircleGeometry(180, 64);
    apronGeo.rotateX(-Math.PI / 2);

    this.groundApronMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uInnerColor: { value: new THREE.Color('#476b40') },
        uOuterColor: { value: new THREE.Color(this.currentConfig?.fog?.color ?? '#dce8f2') }
      },
      vertexShader: /* glsl */ `
        varying vec2 vXZ;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vXZ = worldPos.xz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uInnerColor;
        uniform vec3 uOuterColor;
        varying vec2 vXZ;
        void main() {
          float dist = length(vXZ);
          float fade = smoothstep(5.5, 85.0, dist);
          gl_FragColor = vec4(mix(uInnerColor, uOuterColor, fade), 1.0);
        }
      `,
      depthWrite: true,
      fog: false
    });

    this.groundApron = new THREE.Mesh(apronGeo, this.groundApronMaterial);
    this.groundApron.name = 'GlbGroundApron';
    this.groundApron.position.set(this.modelCenter.x, this.groundY - 0.01, this.modelCenter.z);
    this.scene.add(this.groundApron);
  }

  private computeFramingFromModel(config?: SpaceConfig): void {
    const box = new THREE.Box3();
    if (this.modelRoot) {
      box.setFromObject(this.modelRoot);
    }

    if (box.isEmpty()) {
      this.groundY = 0;
      this.modelCenter.set(0, 1.2, 0);
      this.modelRadius = 5.0;
    } else {
      const size = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(this.modelCenter);
      this.groundY = Number.isFinite(box.min.y) ? box.min.y : 0;
      this.modelRadius = Math.max(2.5, 0.5 * Math.hypot(size.x, size.z));
    }

    const eyeOffset = config?.camera?.heightOffset ?? 1.7;
    const hasCustomSpawn = Boolean(config?.camera?.spawnPosition);
    const hasCustomLookAt = Boolean(config?.camera?.lookAt);

    if (hasCustomSpawn && hasCustomLookAt) {
      const sp = config!.camera!.spawnPosition!;
      const lk = config!.camera!.lookAt!;
      this.spawnPoint = {
        position: new THREE.Vector3(sp[0], Math.max(this.groundY + eyeOffset, sp[1]), sp[2]),
        lookAt: new THREE.Vector3(lk[0], lk[1], lk[2])
      };
    } else {
      const standDist = Math.min(12.0, Math.max(4.0, this.modelRadius * 0.62));
      const spawnY = Math.max(this.groundY + eyeOffset, this.modelCenter.y + 0.35);
      this.spawnPoint = {
        position: new THREE.Vector3(
          this.modelCenter.x + standDist * 0.34,
          spawnY,
          this.modelCenter.z + standDist * 0.94
        ),
        lookAt: new THREE.Vector3(
          this.modelCenter.x,
          Math.max(this.groundY + 1.05, this.modelCenter.y),
          this.modelCenter.z
        )
      };
    }

    const poiR = Math.min(10.0, Math.max(3.2, this.modelRadius * 0.65));
    const poiY = Math.max(this.groundY + eyeOffset + 0.2, this.modelCenter.y + 0.5);
    this.pois = [
      {
        name: 'Sanctuary Front',
        position: new THREE.Vector3(this.modelCenter.x, poiY, this.modelCenter.z + poiR),
        dwellTime: 8.0
      },
      {
        name: 'East Promenade',
        position: new THREE.Vector3(this.modelCenter.x + poiR, poiY + 0.4, this.modelCenter.z - poiR * 0.25),
        dwellTime: 9.0
      },
      {
        name: 'West Overlook',
        position: new THREE.Vector3(this.modelCenter.x - poiR, poiY + 0.4, this.modelCenter.z - poiR * 0.3),
        dwellTime: 9.0
      }
    ];
  }

  public update(deltaTime: number, _elapsedTime: number): void {
    if (!this.isInitialized) return;
    if (this.mixer) {
      this.mixer.update(Math.min(deltaTime, 0.1));
    }
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;
    renderer.render(this.scene, camera);
  }

  public updateConfig(newConfig: Partial<SpaceConfig>): void {
    if (!this.isInitialized || !newConfig) return;

    if (newConfig.fog && this.scene.fog instanceof THREE.FogExp2) {
      if (newConfig.fog.color) {
        this.scene.fog.color.set(newConfig.fog.color);
        if (this.currentConfig?.fog) this.currentConfig.fog.color = newConfig.fog.color;
      }
      if (typeof newConfig.fog.density === 'number' && Number.isFinite(newConfig.fog.density)) {
        this.scene.fog.density = Math.max(0, newConfig.fog.density);
        if (this.currentConfig?.fog) this.currentConfig.fog.density = this.scene.fog.density;
      }
    }

    if (newConfig.sky && this.skyMaterial) {
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

    if (newConfig.lighting) {
      if (newConfig.lighting.ambient && this.hemiLight) {
        if (newConfig.lighting.ambient.color) this.hemiLight.color.set(newConfig.lighting.ambient.color);
        if (typeof newConfig.lighting.ambient.intensity === 'number') {
          this.hemiLight.intensity = newConfig.lighting.ambient.intensity;
        }
      }
      if (newConfig.lighting.directional && this.dirLight) {
        if (newConfig.lighting.directional.color) this.dirLight.color.set(newConfig.lighting.directional.color);
        if (typeof newConfig.lighting.directional.intensity === 'number') {
          this.dirLight.intensity = newConfig.lighting.directional.intensity;
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
  }

  public getGroundHeight(x: number, z: number): number {
    if (this.collidableMeshes.length === 0) {
      return this.groundY;
    }

    // Probe downward from walkable step-up height (+1.5m above base ground) so tall roofs
    // or lantern canopies don't elevate the camera unrealistically.
    this.rayOrigin.set(x, this.groundY + 1.5, z);
    this.raycaster.set(this.rayOrigin, this.rayDown);
    this.raycaster.far = 4.0;

    const hits = this.raycaster.intersectObjects(this.collidableMeshes, false);
    if (hits.length > 0 && Number.isFinite(hits[0].point.y)) {
      return hits[0].point.y;
    }
    return this.groundY;
  }

  public getSpawnPoint(): ISpawnPoint {
    return {
      position: this.spawnPoint.position.clone(),
      lookAt: this.spawnPoint.lookAt.clone()
    };
  }

  public getWanderBounds(): IWanderBounds {
    const r = Math.max(10, Math.min(35, this.modelRadius * 2.2));
    return {
      radius: r,
      center: new THREE.Vector3(this.modelCenter.x, this.groundY, this.modelCenter.z),
      minX: this.modelCenter.x - r,
      maxX: this.modelCenter.x + r,
      minZ: this.modelCenter.z - r,
      maxZ: this.modelCenter.z + r
    };
  }

  public getPointsOfInterest(): IPointOfInterest[] {
    return this.pois.map((p) => ({
      name: p.name,
      position: p.position.clone(),
      dwellTime: p.dwellTime
    }));
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public dispose(): void {
    if (!this.isInitialized) return;

    if (this.mixer && this.modelRoot) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.modelRoot);
    }
    this.mixer = null;

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
    this.scene.environment = null;

    if (this.dracoLoader) {
      this.dracoLoader.dispose();
      this.dracoLoader = null;
    }
    if (this.ktx2Loader) {
      this.ktx2Loader.dispose();
      this.ktx2Loader = null;
    }

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    this.collidableMeshes = [];
    this.modelRoot = null;
    this.hemiLight = null;
    this.dirLight = null;
    this.skyMesh = null;
    this.skyMaterial = null;
    this.groundApron = null;
    this.groundApronMaterial = null;

    this.isInitialized = false;
  }
}
