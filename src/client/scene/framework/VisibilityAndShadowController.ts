import * as THREE from 'three';
import type { QualitySettings } from './types';

interface DistanceGroupEntry {
  group: THREE.Object3D;
  center: THREE.Vector3;
  radius: number;
  visible: boolean;
}

interface ShadowCasterEntry {
  mesh: THREE.Mesh;
  worldCenter: THREE.Vector3;
  worldRadius: number;
}

export interface VisibilityControllerOptions {
  unculledExactNames?: Iterable<string>;
  noDistanceCullNames?: Iterable<string>;
  unculledNamePattern?: RegExp;
  fallbackFocusPos?: THREE.Vector3;
  enableDistanceCulling?: boolean;
  enableShadowTracking?: boolean;
}

const DEFAULT_UNCULLABLE_EXACT_NAMES = new Set([
  'SkyDome',
  'VolumetricCloudDome',
  'WeatherParticles',
  'ParadiseWeatherParticles',
  'GhibliCloudBank',
  'GoldenHeritageMotes',
  'SoaringWhiteEgrets',
  'VietnamMonsoonRainSystem',
  'VietnamFestivalLightBeams',
  'DragonBridgeFireShow',
  'FestivalNonQuaiThaoDrift',
  'FestivalTuongVanClouds',
  'HoiAnSkyLanterns',
  'HoaiRiverFlowerLanterns',
  'VietnamHeritageTerrain',
  'HaLongAndLotusWater',
  'UndulatingMeadowTerrain',
  'UndulatingHillTerrain',
  'GhibliCoastalTerrain',
  'ObsidianStarTerrain',
  'FloatingSanctuaryTerrain'
]);

const DEFAULT_NO_DISTANCE_CULL_NAMES = new Set([
  ...DEFAULT_UNCULLABLE_EXACT_NAMES,
  'InstancedGrass',
  'InstancedFlowers',
  'InstancedGhibliGrass',
  'InstancedGhibliClovers',
  'InstancedGhibliWildflowers',
  'InstancedForestGrass',
  'InstancedForestFerns',
  'ParadiseGardenGrass',
  'ParadiseGardenFlowers',
  'ParadiseCloverMicroTurf',
  'InstancedWheatFields',
  'InstancedNightGrass',
  'VietnameseBambooGroves',
  'InstancedBambooCulms',
  'InstancedBambooLeaves',
  'IncenseSmoke'
]);

const DEFAULT_UNCULLABLE_NAME_PATTERN =
  /IncenseSmoke|Smoke|SteamPuff|Waterfall|Mist|RainSystem|Sunbeam|LightBeam|Cloud|Rainbow|Aurora|BlackHole|SolarCorona|GasGiant|Seagull|Butterfly|Dove|Bird|Trout|Kite/i;
const DEFAULT_FALLBACK_POS = new THREE.Vector3(0, 2.2, 58);

function isParentChainVisible(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

function hasVertexDisplacementShader(mesh: THREE.Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m) continue;
    if ((m as THREE.ShaderMaterial).isShaderMaterial) return true;
    if (
      Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') &&
      m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Manages frustum culling restoration, distance culling of far landmark groups with hysteresis,
 * camera-following texel-snapped directional shadows, dynamic caster radii, and shadow cadence
 * across any Dreamerize 3D world.
 */
export class VisibilityAndShadowController {
  private scene: THREE.Scene | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private quality: QualitySettings | null = null;
  private readonly sunDir = new THREE.Vector3(62, 34, -85).normalize();

  private readonly unculledExactNames = new Set<string>(DEFAULT_UNCULLABLE_EXACT_NAMES);
  private readonly noDistanceCullNames = new Set<string>(DEFAULT_NO_DISTANCE_CULL_NAMES);
  private unculledNamePattern: RegExp = DEFAULT_UNCULLABLE_NAME_PATTERN;
  private readonly fallbackFocusPos = DEFAULT_FALLBACK_POS.clone();
  private enableDistanceCulling = true;
  private enableShadowTracking = true;

  private distanceGroups: DistanceGroupEntry[] = [];
  private shadowCasters: ShadowCasterEntry[] = [];
  private readonly paddedGeos = new Set<THREE.BufferGeometry>();

  private addedLightTarget = false;
  private prevShadowAutoUpdate: boolean | null = null;
  private frustumCulledOffCount = 0;
  private activeShadowCasters = 0;
  private activeShadowCasterTriangles = 0;

  private lastDistanceCheckTime = -1;
  private readonly lastShadowFocus = new THREE.Vector3(Infinity, Infinity, Infinity);
  private readonly lastCasterUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private sunDirty = true;
  private frameCounter = 0;

  private readonly tmpBox = new THREE.Box3();
  private readonly tmpSphere = new THREE.Sphere();
  private readonly tmpFocus = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();
  private readonly tmpUp = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);

  constructor(options?: VisibilityControllerOptions) {
    this.configure(options);
  }

  public configure(options?: VisibilityControllerOptions): void {
    if (!options) return;
    if (options.unculledExactNames) {
      for (const n of options.unculledExactNames) this.unculledExactNames.add(n);
    }
    if (options.noDistanceCullNames) {
      for (const n of options.noDistanceCullNames) this.noDistanceCullNames.add(n);
    }
    if (options.unculledNamePattern) {
      this.unculledNamePattern = options.unculledNamePattern;
    }
    if (options.fallbackFocusPos) {
      this.fallbackFocusPos.copy(options.fallbackFocusPos);
    }
    if (typeof options.enableDistanceCulling === 'boolean') {
      this.enableDistanceCulling = options.enableDistanceCulling;
    }
    if (typeof options.enableShadowTracking === 'boolean') {
      this.enableShadowTracking = options.enableShadowTracking;
    }
  }

  private isKeepUnculled(obj: THREE.Object3D): boolean {
    if ((obj as THREE.Points).isPoints) return true;
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.name) {
        if (this.unculledExactNames.has(cur.name)) return true;
        if (this.unculledNamePattern.test(cur.name)) return true;
      }
      cur = cur.parent;
    }
    return false;
  }

  private processMesh(mesh: THREE.Mesh): void {
    const geo = mesh.geometry;
    const keepUnculled = this.isKeepUnculled(mesh);

    if (keepUnculled) {
      mesh.frustumCulled = false;
      this.frustumCulledOffCount++;
    } else if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const inst = mesh as THREE.InstancedMesh;
      if (typeof inst.computeBoundingSphere === 'function') {
        inst.computeBoundingSphere();
      }
      if (inst.boundingSphere && Number.isFinite(inst.boundingSphere.radius)) {
        inst.boundingSphere.radius = Math.max(inst.boundingSphere.radius, 0.5) + 6.0;
      }
      mesh.frustumCulled = true;
    } else {
      if (geo && geo.attributes?.position && geo.attributes.position.count > 0) {
        if (!geo.boundingSphere) {
          geo.computeBoundingSphere();
        }
        if (geo.boundingSphere && Number.isFinite(geo.boundingSphere.radius)) {
          if (geo.boundingSphere.radius <= 0) {
            geo.boundingSphere.radius = 0.25;
          }
          if (!this.paddedGeos.has(geo) && hasVertexDisplacementShader(mesh)) {
            geo.boundingSphere.radius += 2.5;
            this.paddedGeos.add(geo);
          }
        }
      }
      mesh.frustumCulled = true;
    }

    if (mesh.castShadow) {
      this.tmpBox.setFromObject(mesh);
      if (!this.tmpBox.isEmpty()) {
        this.tmpBox.getBoundingSphere(this.tmpSphere);
        if (Number.isFinite(this.tmpSphere.radius)) {
          this.shadowCasters.push({
            mesh,
            worldCenter: this.tmpSphere.center.clone(),
            worldRadius: Math.max(this.tmpSphere.radius, 0.5)
          });
        }
      }
    }
  }

  private tryAddDistanceGroup(obj: THREE.Object3D): void {
    if ((obj as THREE.Light).isLight || (obj as THREE.Points).isPoints) return;
    if (this.directionalLight && obj === this.directionalLight.target) return;
    if (obj.name && this.noDistanceCullNames.has(obj.name)) return;
    if (!obj.visible) return;

    this.tmpBox.setFromObject(obj);
    if (this.tmpBox.isEmpty()) return;
    this.tmpBox.getBoundingSphere(this.tmpSphere);
    if (!Number.isFinite(this.tmpSphere.radius) || this.tmpSphere.radius <= 0) return;

    this.distanceGroups.push({
      group: obj,
      center: this.tmpSphere.center.clone(),
      radius: this.tmpSphere.radius,
      visible: obj.visible
    });
  }

  public initialize(
    scene: THREE.Scene,
    directionalLight: THREE.DirectionalLight | null,
    renderer: THREE.WebGLRenderer | undefined,
    quality: QualitySettings,
    sunDir: THREE.Vector3
  ): void {
    this.scene = scene;
    this.directionalLight = directionalLight;
    this.renderer = renderer ?? null;
    this.quality = quality;
    if (sunDir.lengthSq() > 1e-6) {
      this.sunDir.copy(sunDir).normalize();
    }

    scene.updateMatrixWorld(true);

    this.paddedGeos.clear();
    this.frustumCulledOffCount = 0;
    this.shadowCasters = [];

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        this.processMesh(mesh);
      }
    });

    this.distanceGroups = [];
    for (const child of scene.children) {
      this.tryAddDistanceGroup(child);
    }

    if (directionalLight && this.enableShadowTracking) {
      if (!directionalLight.target.parent) {
        scene.add(directionalLight.target);
        this.addedLightTarget = true;
      }
      this.applyDirectionalShadowConfig(quality);
    }

    const rAny = this.renderer as unknown as { shadowMap?: THREE.WebGLShadowMap } | null;
    if (rAny?.shadowMap && this.enableShadowTracking) {
      if (this.prevShadowAutoUpdate === null) {
        this.prevShadowAutoUpdate = Boolean(rAny.shadowMap.autoUpdate);
      }
      rAny.shadowMap.autoUpdate = false;
      rAny.shadowMap.needsUpdate = true;
    }

    this.lastDistanceCheckTime = -1;
    this.lastShadowFocus.set(Infinity, Infinity, Infinity);
    this.lastCasterUpdatePos.set(Infinity, Infinity, Infinity);
    this.sunDirty = true;
    this.frameCounter = 0;
  }

  private applyDirectionalShadowConfig(quality: QualitySettings): void {
    const dl = this.directionalLight;
    if (!dl || !this.enableShadowTracking) return;

    const sizeChanged = dl.shadow.mapSize.x !== quality.shadowMapSize;
    dl.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const hs = quality.shadowFrustumHalfSize;
    dl.shadow.camera.left = -hs;
    dl.shadow.camera.right = hs;
    dl.shadow.camera.top = hs;
    dl.shadow.camera.bottom = -hs;
    dl.shadow.camera.near = 10;
    dl.shadow.camera.far = 520;
    dl.shadow.camera.updateProjectionMatrix();

    if (sizeChanged && dl.shadow.map) {
      dl.shadow.map.dispose();
      dl.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    this.sunDirty = true;
  }

  public registerGroup(group: THREE.Object3D): void {
    group.updateMatrixWorld(true);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        this.processMesh(mesh);
      }
    });
    this.tryAddDistanceGroup(group);
    this.lastDistanceCheckTime = -1;
    this.lastCasterUpdatePos.set(Infinity, Infinity, Infinity);
  }

  public unregisterGroup(group: THREE.Object3D): void {
    const meshSet = new Set<THREE.Mesh>();
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        meshSet.add(mesh);
        if (!mesh.frustumCulled && this.frustumCulledOffCount > 0) {
          this.frustumCulledOffCount--;
        }
      }
    });
    if (meshSet.size > 0) {
      this.shadowCasters = this.shadowCasters.filter((s) => !meshSet.has(s.mesh));
    }
    this.distanceGroups = this.distanceGroups.filter((d) => d.group !== group);
    this.lastDistanceCheckTime = -1;
    this.lastCasterUpdatePos.set(Infinity, Infinity, Infinity);
  }

  public applyQuality(quality: QualitySettings): void {
    this.quality = quality;
    this.applyDirectionalShadowConfig(quality);
    this.lastDistanceCheckTime = -1;
    this.lastCasterUpdatePos.set(Infinity, Infinity, Infinity);
  }

  public setSunDirection(sunDir: THREE.Vector3): void {
    if (sunDir.lengthSq() > 1e-6) {
      this.sunDir.copy(sunDir).normalize();
      this.sunDirty = true;
    }
  }

  private resolveFocusPoint(camera: THREE.Camera | null): THREE.Vector3 {
    if (!camera || camera.position.lengthSq() < 1e-6) {
      return this.tmpFocus.copy(this.fallbackFocusPos);
    }
    this.tmpFocus.copy(camera.position);
    if (typeof camera.getWorldDirection === 'function') {
      camera.getWorldDirection(this.tmpForward);
      this.tmpForward.y = 0;
      if (this.tmpForward.lengthSq() > 1e-6) {
        this.tmpForward.normalize();
        const lead = this.quality ? this.quality.shadowFrustumHalfSize * 0.35 : 42;
        this.tmpFocus.addScaledVector(this.tmpForward, lead);
      }
    }
    return this.tmpFocus;
  }

  public update(camera: THREE.Camera | null, elapsedTime: number, force = false): void {
    if (!this.quality) return;

    const camPos =
      camera && camera.position.lengthSq() >= 1e-6 ? camera.position : this.fallbackFocusPos;

    // 1. Distance culling for far landmark groups with 60m hysteresis
    if (
      this.enableDistanceCulling &&
      (force || this.lastDistanceCheckTime < 0 || elapsedTime - this.lastDistanceCheckTime >= 0.2)
    ) {
      this.lastDistanceCheckTime = elapsedTime;
      const drawDist = this.quality.drawDistance;
      for (let i = 0; i < this.distanceGroups.length; i++) {
        const entry = this.distanceGroups[i];
        const edgeDist = camPos.distanceTo(entry.center) - entry.radius;
        if (entry.visible && edgeDist > drawDist + 60) {
          entry.visible = false;
          entry.group.visible = false;
        } else if (!entry.visible && edgeDist < drawDist) {
          entry.visible = true;
          entry.group.visible = true;
        }
      }
    }

    const focus = this.resolveFocusPoint(camera);
    let snappedTarget = focus;
    let focusMoved = 0;

    // 2. Texel-snapped directional shadow frustum tracking camera focus
    const dl = this.directionalLight;
    if (dl && this.enableShadowTracking) {
      const refUp = Math.abs(this.sunDir.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : this.worldUp;
      this.tmpRight.crossVectors(refUp, this.sunDir).normalize();
      this.tmpUp.crossVectors(this.sunDir, this.tmpRight).normalize();

      const texelWorld = (this.quality.shadowFrustumHalfSize * 2) / this.quality.shadowMapSize;
      const snapX = Math.round(focus.dot(this.tmpRight) / texelWorld) * texelWorld;
      const snapY = Math.round(focus.dot(this.tmpUp) / texelWorld) * texelWorld;
      const snapZ = focus.dot(this.sunDir);

      snappedTarget = this.tmpForward
        .set(0, 0, 0)
        .addScaledVector(this.tmpRight, snapX)
        .addScaledVector(this.tmpUp, snapY)
        .addScaledVector(this.sunDir, snapZ);

      focusMoved = snappedTarget.distanceTo(this.lastShadowFocus);
      if (force || focusMoved >= 0.5 || this.sunDirty) {
        dl.target.position.copy(snappedTarget);
        dl.target.updateMatrixWorld();
        dl.position.copy(snappedTarget).addScaledVector(this.sunDir, 150);
      }
    }

    // 3. Dynamic shadow caster selection within shadowDistance
    if (force || snappedTarget.distanceToSquared(this.lastCasterUpdatePos) >= 36.0) {
      this.lastCasterUpdatePos.copy(snappedTarget);
      const maxShadowDist = this.quality.shadowDistance;
      let activeCasters = 0;
      let activeTris = 0;

      for (let i = 0; i < this.shadowCasters.length; i++) {
        const entry = this.shadowCasters[i];
        const parentVis = isParentChainVisible(entry.mesh);
        const within =
          parentVis &&
          entry.worldCenter.distanceTo(snappedTarget) <= maxShadowDist + entry.worldRadius;
        entry.mesh.castShadow = within;
        if (within) {
          activeCasters++;
          const g = entry.mesh.geometry;
          const idx = g?.index;
          const pos = g?.attributes?.position;
          const tri = idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
          const inst = (entry.mesh as THREE.InstancedMesh).isInstancedMesh
            ? (entry.mesh as THREE.InstancedMesh).count
            : 1;
          activeTris += tri * inst;
        }
      }

      this.activeShadowCasters = activeCasters;
      this.activeShadowCasterTriangles = Math.round(activeTris);
    }

    if (dl && this.enableShadowTracking) {
      this.frameCounter++;
      const rAny = this.renderer as unknown as { shadowMap?: THREE.WebGLShadowMap } | null;
      if (
        rAny?.shadowMap &&
        (force ||
          this.sunDirty ||
          focusMoved >= 1.5 ||
          this.frameCounter % this.quality.shadowUpdateIntervalFrames === 0)
      ) {
        rAny.shadowMap.needsUpdate = true;
      }

      if (force || focusMoved >= 0.5 || this.sunDirty) {
        this.lastShadowFocus.copy(snappedTarget);
        this.sunDirty = false;
      }
    }
  }

  public getStats(): {
    frustumCulledOffCount: number;
    activeShadowCasters: number;
    activeShadowCasterTriangles: number;
    totalLandmarkGroups: number;
    visibleLandmarkGroups: number;
  } {
    let visibleGroups = 0;
    for (let i = 0; i < this.distanceGroups.length; i++) {
      if (this.distanceGroups[i].group.visible) visibleGroups++;
    }
    return {
      frustumCulledOffCount: this.frustumCulledOffCount,
      activeShadowCasters: this.activeShadowCasters,
      activeShadowCasterTriangles: this.activeShadowCasterTriangles,
      totalLandmarkGroups: this.distanceGroups.length,
      visibleLandmarkGroups: visibleGroups
    };
  }

  public dispose(): void {
    if (this.addedLightTarget && this.directionalLight?.target?.parent) {
      this.directionalLight.target.parent.remove(this.directionalLight.target);
    }
    this.addedLightTarget = false;
    const rAny = this.renderer as unknown as { shadowMap?: THREE.WebGLShadowMap } | null;
    if (rAny?.shadowMap && this.prevShadowAutoUpdate !== null) {
      rAny.shadowMap.autoUpdate = this.prevShadowAutoUpdate;
    }
    this.prevShadowAutoUpdate = null;
    this.scene = null;
    this.directionalLight = null;
    this.renderer = null;
    this.quality = null;
    this.distanceGroups = [];
    this.shadowCasters = [];
    this.paddedGeos.clear();
    this.frustumCulledOffCount = 0;
    this.activeShadowCasters = 0;
    this.activeShadowCasterTriangles = 0;
    this.lastDistanceCheckTime = -1;
    this.lastShadowFocus.set(Infinity, Infinity, Infinity);
    this.lastCasterUpdatePos.set(Infinity, Infinity, Infinity);
  }
}
