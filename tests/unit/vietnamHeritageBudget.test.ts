import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  VietnamHeritageScene,
  getVietnamHeritageHeight,
  VIETNAM_WATER_LEVEL
} from '../../src/client/scene/environments/VietnamHeritageScene';
import { QUALITY_PRESETS } from '../../src/client/scene/vietnam/core/QualityPreset';
import { ResourceScope } from '../../src/client/scene/vietnam/core/ResourceScope';
import { ZoneStreamer } from '../../src/client/scene/vietnam/core/ZoneStreamer';
import { VIETNAM_LANDMARK_REGISTRY } from '../../src/client/scene/vietnam/core/LandmarkRegistry';
import { PartsBuilder } from '../../src/client/scene/vietnam/geometry/PartsBuilder';
import { AnimationBus } from '../../src/client/scene/vietnam/core/AnimationBus';
import { MaterialLibrary } from '../../src/client/scene/vietnam/core/MaterialLibrary';
import { SignageAtlas } from '../../src/client/scene/environments/vietnamMotifHelpers';
import type { ZoneDescriptor } from '../../src/client/scene/vietnam/core/types';

describe('VietnamHeritageScene - Resource Optimization & Budget Gates', () => {
  it('enforces frustum culling, material dedupe, bamboo triangle budget, pooled lights & dynamic shadows', async () => {
    const scene = new VietnamHeritageScene();
    const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    camera.position.set(0, 2.2, 58);

    await scene.init({} as THREE.WebGLRenderer, camera);
    const threeScene = scene.getScene();
    const metrics = scene.getPerfMetrics();

    // 1. Frustum culling restored: only small sky/particles/water/weather allowlist remains unculled
    expect(metrics.frustumCulledOffCount).toBeLessThanOrEqual(45);

    // Every frustum-culled mesh & instanced mesh must have a finite positive bounding sphere
    threeScene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.frustumCulled) return;
      if ((m as THREE.InstancedMesh).isInstancedMesh) {
        const inst = m as THREE.InstancedMesh;
        expect(inst.boundingSphere).not.toBeNull();
        expect(Number.isFinite(inst.boundingSphere!.radius)).toBe(true);
        expect(inst.boundingSphere!.radius).toBeGreaterThan(0);
      } else if (m.geometry?.attributes?.position?.count > 0) {
        expect(m.geometry.boundingSphere).not.toBeNull();
        expect(Number.isFinite(m.geometry.boundingSphere!.radius)).toBe(true);
        expect(m.geometry.boundingSphere!.radius).toBeGreaterThan(0);
      }
    });

    // 2. Bamboo culm LatheGeometry optimization dropped total triangles well below 3.65M
    expect(metrics.totalTriangles).toBeLessThan(3_650_000);

    // 3. Static material deduplication cut unique materials significantly
    expect(metrics.uniqueMaterials).toBeLessThanOrEqual(250);
    expect(metrics.deduplicatedMaterialsSaved).toBeGreaterThan(50);

    // 4. Pooled PointLights preserve constant shader light count <= preset cap
    const preset = QUALITY_PRESETS[scene.getQualityTier()];
    let scenePointLights = 0;
    threeScene.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) scenePointLights++;
    });
    expect(scenePointLights).toBe(preset.maxActivePointLights);
    expect(preset.maxActivePointLights).toBeLessThanOrEqual(4);
    expect(metrics.managedPointLightsTotal).toBeGreaterThanOrEqual(20);
    expect(metrics.activeShadowCasterTriangles).toBeLessThanOrEqual(900_000);

    // 5. Move camera across POIs: light pool activates nearby lights & shadow target follows camera
    const dirLight = threeScene.children.find(
      (c) => (c as THREE.DirectionalLight).isDirectionalLight
    ) as THREE.DirectionalLight;
    expect(dirLight).toBeDefined();

    const poiVisits: Array<[number, number, number]> = [
      [0, 2.2, 58],
      [175, 10, 88],
      [275, 10, -210],
      [335, 10, 510]
    ];
    let lastTargetX = dirLight.target.position.x;
    for (let idx = 0; idx < poiVisits.length; idx++) {
      const [px, py, pz] = poiVisits[idx];
      camera.position.set(px, py, pz);
      camera.updateMatrixWorld();
      scene.update(0.016, (idx + 1) * 0.5);

      const m = scene.getPerfMetrics();
      expect(m.activePointLightsCount).toBeLessThanOrEqual(preset.maxActivePointLights);
      expect(m.activeShadowCasterTriangles).toBeLessThanOrEqual(900_000);
      if (idx > 0) {
        expect(Math.abs(dirLight.target.position.x - lastTargetX)).toBeGreaterThan(10);
      }
      lastTargetX = dirLight.target.position.x;
    }

    // Hoi An (175, 10, 88) & Phong Nha (275, 10, -210) must light nearby fixtures
    camera.position.set(275, 10, -210);
    scene.update(0.016, 4.0);
    expect(scene.getPerfMetrics().activePointLightsCount).toBeGreaterThanOrEqual(1);

    // 6. Quality tier switching & low-tier corner distance culling
    camera.position.set(-1200, 30, -1200);
    scene.setQualityTier('low');
    expect(scene.getQualityTier()).toBe('low');

    let lowPoolCount = 0;
    threeScene.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) lowPoolCount++;
    });
    expect(lowPoolCount).toBe(QUALITY_PRESETS.low.maxActivePointLights);

    const lowMetrics = scene.getPerfMetrics();
    expect(lowMetrics.visibleLandmarkGroups).toBeLessThan(lowMetrics.totalLandmarkGroups);

    // Atmosphere-controlled groups must remain governed by setAtmosphereState regardless of distance culling
    scene.setAtmosphereState({ timeOfDay: 22, weather: 'clear' });
    expect(threeScene.getObjectByName('VietnamFestivalLightBeams')?.visible).toBe(true);
    expect(threeScene.getObjectByName('VietnamMonsoonRainSystem')?.visible).toBe(false);

    scene.setAtmosphereState({ timeOfDay: 16, weather: 'rain' });
    expect(threeScene.getObjectByName('VietnamMonsoonRainSystem')?.visible).toBe(true);
    expect(threeScene.getObjectByName('VietnamFestivalLightBeams')?.visible).toBe(false);

    for (const tier of ['medium', 'high', 'ultra'] as const) {
      scene.setQualityTier(tier);
      expect(scene.getQualityTier()).toBe(tier);
    }

    scene.dispose();
  }, 20000);
});

describe('Vietnam Modular Core Architecture (R1/R2/P2)', () => {
  it('ResourceScope tracks and disposes all GPU objects cleanly and idempotently', () => {
    const parent = new THREE.Scene();
    const scope = new ResourceScope();

    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 2, 3);
    const mat = new THREE.MeshStandardMaterial({ color: '#c44' });
    const tex = new THREE.DataTexture(new Uint8Array(16), 2, 2, THREE.RGBAFormat);
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    parent.add(group);

    let extraCleanupCalls = 0;
    scope.trackObject(group);
    scope.trackTexture(tex);
    scope.trackDisposable(() => {
      extraCleanupCalls++;
    });

    const before = scope.getCounts();
    expect(before.geometries).toBe(1);
    expect(before.materials).toBe(1);
    expect(before.textures).toBe(1);
    expect(before.objects).toBe(1);

    scope.dispose();
    const after = scope.getCounts();
    expect(after.geometries).toBe(0);
    expect(after.materials).toBe(0);
    expect(after.textures).toBe(0);
    expect(after.objects).toBe(0);
    expect(parent.children.length).toBe(0);
    expect(extraCleanupCalls).toBe(1);

    expect(() => scope.dispose()).not.toThrow();
    expect(extraCleanupCalls).toBe(1);
  });

  it('ZoneStreamer handles proximity hysteresis, repeated load/unload cycles, and sync mode', () => {
    const threeScene = new THREE.Scene();
    const makeZone = (id: string, x: number, z: number): ZoneDescriptor => ({
      id,
      groupName: `Zone_${id}`,
      region: 'north',
      center: { x, z },
      radius: 40,
      build: (ctx) => {
        const group = new THREE.Group();
        group.name = `Zone_${id}`;
        const mesh = ctx.parts
          .create()
          .box(4, 2, 4, x, 1, z)
          .buildMesh(`${id}_mesh`, ctx.materials.shared.stone)!;
        group.add(mesh);
        return { group };
      }
    });

    const mat = new THREE.MeshStandardMaterial({ color: '#ddd' });
    const sharedMats = {
      stone: mat,
      whitePlaster: mat,
      yellowOchrePlaster: mat,
      crimsonLacquer: mat,
      darkWood: mat,
      terracottaRoof: mat,
      darkRoof: mat,
      chamBrick: mat,
      granite: mat,
      gold: mat,
      bronze: mat,
      darkVoid: mat,
      lanternSilk: mat,
      bark: mat
    };
    const makeCtx = () => ({
      scene: threeScene,
      scope: new ResourceScope(),
      parts: { create: () => new PartsBuilder() },
      materials: new MaterialLibrary(sharedMats),
      anim: new AnimationBus(),
      terrain: {
        height: getVietnamHeritageHeight,
        normal: () => new THREE.Vector3(0, 1, 0)
      },
      rng: () => () => 0.5
    });

    // 1. Proximity mode with load=200, unload=300 (effective with radius=40: load<240, unload>340)
    const streamer = new ZoneStreamer({
      mode: 'proximity',
      loadRadius: 200,
      unloadRadius: 300,
      maxBuildMsPerFrame: 50
    });
    streamer.registerAll([makeZone('near', 0, 0), makeZone('far', 800, 0)]);

    streamer.update(new THREE.Vector3(0, 0, 0), makeCtx);
    expect(streamer.getLoadedZoneIds()).toEqual(['near']);
    expect(threeScene.getObjectByName('Zone_near')).toBeDefined();
    expect(threeScene.getObjectByName('Zone_far')).toBeUndefined();

    // Hysteresis zone (dist = 270 is > 240 load but < 340 unload -> stays loaded)
    streamer.update(new THREE.Vector3(270, 0, 0), makeCtx);
    expect(streamer.getLoadedZoneIds()).toEqual(['near']);

    // Beyond unload hysteresis (dist = 400 -> unloads 'near', still outside 'far')
    streamer.update(new THREE.Vector3(400, 0, 0), makeCtx);
    expect(streamer.getLoadedZoneIds()).toEqual([]);
    expect(threeScene.children.length).toBe(0);

    // Move to 'far' and cycle back twice to verify zero stale children
    for (let cycle = 0; cycle < 2; cycle++) {
      streamer.update(new THREE.Vector3(800, 0, 0), makeCtx);
      expect(streamer.getLoadedZoneIds()).toEqual(['far']);
      streamer.update(new THREE.Vector3(0, 0, 0), makeCtx);
      expect(streamer.getLoadedZoneIds()).toEqual(['near']);
    }
    streamer.disposeAll();
    expect(threeScene.children.length).toBe(0);

    // 2. Sync 'all' mode loads every registered zone
    const syncStreamer = new ZoneStreamer({ mode: 'all', loadRadius: 100, unloadRadius: 150 });
    syncStreamer.registerAll([makeZone('a', 0, 0), makeZone('b', 1500, 1500)]);
    syncStreamer.loadAllSync(makeCtx);
    expect(syncStreamer.getLoadedZoneIds().sort()).toEqual(['a', 'b']);
    syncStreamer.disposeAll();
    mat.dispose();
  });

  it('PartsBuilder produces finite geometry with valid normals and vertex colors', () => {
    const pb = new PartsBuilder();
    pb.box(2, 3, 4, 1, 1.5, -2, { rx: 0.1, ry: 0.3, rz: 0.05 })
      .cyl(0.4, 0.6, 5, 8, 0, 2.5, 0, { rx: 0.2 })
      .cone(0.8, 1.5, 6, 3, 1, 1, { ry: 0.5 })
      .strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 4, 1), 0.1)
      .addColored(new THREE.BoxGeometry(1, 1, 1), '#d9a441');

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const mesh = pb.buildMesh('FluentTestMesh', mat)!;
    expect(mesh).not.toBeNull();

    const pos = mesh.geometry.attributes.position;
    const norm = mesh.geometry.attributes.normal;
    const col = mesh.geometry.attributes.color;
    expect(pos.count).toBeGreaterThan(20);
    expect(norm.count).toBe(pos.count);
    expect(col.count).toBe(pos.count);

    for (let i = 0; i < pos.array.length; i++) {
      expect(Number.isFinite(pos.array[i])).toBe(true);
    }
    mesh.geometry.computeBoundingSphere();
    expect(Number.isFinite(mesh.geometry.boundingSphere?.radius)).toBe(true);
    expect(mesh.geometry.boundingSphere!.radius).toBeGreaterThan(1.0);

    mesh.geometry.dispose();
    mat.dispose();
  });

  it('LandmarkRegistry provides 57 POIs (19 per region), exclusions, and landmark metadata', () => {
    const pois = VIETNAM_LANDMARK_REGISTRY.buildPointsOfInterest(
      getVietnamHeritageHeight,
      VIETNAM_WATER_LEVEL
    );
    expect(pois.length).toBe(57);
    expect(pois.filter((p) => p.region === 'I. Miền Bắc').length).toBe(19);
    expect(pois.filter((p) => p.region === 'II. Miền Trung & Tây Nguyên').length).toBe(19);
    expect(pois.filter((p) => p.region === 'III. Miền Nam & Hải Đảo').length).toBe(19);

    const exclusions = VIETNAM_LANDMARK_REGISTRY.getExclusions();
    const caMau = exclusions.find((e) => e.x === 0 && e.z === 475);
    expect(caMau).toBeDefined();
    expect(caMau!.r).toBeGreaterThanOrEqual(34);

    expect(VIETNAM_LANDMARK_REGISTRY.byGroupName('KhueVanCacComplex')).toBeDefined();
    expect(VIETNAM_LANDMARK_REGISTRY.byGroupName('ConDaoIslandComplex')?.region).toBe('south');
    expect(VIETNAM_LANDMARK_REGISTRY.all().length).toBeGreaterThanOrEqual(40);
  });

  it('streams outer macro zones by proximity with clean load and hysteresis unload', async () => {
    const fullScene = new VietnamHeritageScene({ streamingMode: 'all' });
    const camFull = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    camFull.position.set(0, 2.2, 58);
    await fullScene.init({} as THREE.WebGLRenderer, camFull);
    const fullTris = fullScene.getPerfMetrics().totalTriangles;
    expect(fullScene.getLoadedMacroZoneIds().length).toBe(14);
    fullScene.dispose();

    const proxScene = new VietnamHeritageScene({ streamingMode: 'proximity' });
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    cam.position.set(0, 2.2, 58);
    await proxScene.init({} as THREE.WebGLRenderer, cam);

    expect(proxScene.getStreamingMode()).toBe('proximity');
    const initialLoaded = proxScene.getLoadedMacroZoneIds();
    expect(initialLoaded.length).toBeLessThan(14);
    expect(proxScene.getPerfMetrics().totalTriangles).toBeLessThan(fullTris);

    const tamCocSpec = VIETNAM_LANDMARK_REGISTRY.byGroupName('TamCocMacroKarstValley')!;
    expect(proxScene.getScene().getObjectByName('TamCocMacroKarstValley')).toBeUndefined();

    // Move camera near Tam Coc macro valley -> should load TamCocMacroKarstValley cleanly
    cam.position.set(680, 12, -175);
    proxScene.update(0.016, 1.0);
    expect(proxScene.getLoadedMacroZoneIds()).toContain(tamCocSpec.id);
    expect(proxScene.getScene().getObjectByName('TamCocMacroKarstValley')).toBeDefined();

    // Move camera back to spawn beyond unload hysteresis -> unloads TamCoc cleanly
    cam.position.set(0, 2.2, 58);
    proxScene.update(0.016, 2.0);
    expect(proxScene.getLoadedMacroZoneIds()).not.toContain(tamCocSpec.id);
    expect(proxScene.getScene().getObjectByName('TamCocMacroKarstValley')).toBeUndefined();

    proxScene.dispose();
  }, 15000);

  it('dynamically scales InstancedMesh foliage density when switching QualityTier at runtime', async () => {
    const scene = new VietnamHeritageScene();
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    cam.position.set(0, 2.2, 58);
    await scene.init({} as THREE.WebGLRenderer, cam);

    scene.setQualityTier('high');
    const highGrass = (scene.getScene().getObjectByName('InstancedGrass') as THREE.InstancedMesh)
      .count;
    const highRice = (
      scene.getScene().getObjectByName('InstancedSapaRiceStalks') as THREE.InstancedMesh
    ).count;
    const highTris = scene.getPerfMetrics().totalTriangles;

    scene.setQualityTier('low');
    const lowGrass = (scene.getScene().getObjectByName('InstancedGrass') as THREE.InstancedMesh)
      .count;
    const lowRice = (
      scene.getScene().getObjectByName('InstancedSapaRiceStalks') as THREE.InstancedMesh
    ).count;
    const lowTris = scene.getPerfMetrics().totalTriangles;

    expect(lowGrass).toBe(Math.max(1, Math.round(highGrass * QUALITY_PRESETS.low.foliageDensityScale)));
    expect(lowRice).toBe(Math.max(1, Math.round(highRice * QUALITY_PRESETS.low.foliageDensityScale)));
    expect(lowTris).toBeLessThan(highTris);

    scene.setQualityTier('high');
    expect((scene.getScene().getObjectByName('InstancedGrass') as THREE.InstancedMesh).count).toBe(
      highGrass
    );

    scene.dispose();
  });

  it('reuses shared ShaderMaterials, packs/caches SignageAtlas plaques, and respects sharedProtected materials', async () => {
    const scene = new VietnamHeritageScene();
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    cam.position.set(0, 2.2, 58);
    await scene.init({} as THREE.WebGLRenderer, cam);

    const shaderMats = new Set<THREE.Material>();
    scene.getScene().traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat && mat.type === 'ShaderMaterial') shaderMats.add(mat);
      }
    });
    expect(shaderMats.size).toBeLessThanOrEqual(26);
    scene.dispose();

    const atlas = new SignageAtlas();
    const p1 = atlas.createPlaqueMesh({ text: 'A', style: 'royal', motifSeed: 1 });
    const p2 = atlas.createPlaqueMesh({ text: 'B', style: 'royal', motifSeed: 2 });
    expect(p1.material).toBe(p2.material);
    expect(atlas.getStats().reusedMaterials).toBeGreaterThanOrEqual(1);

    let sharedDisposed = 0;
    const sharedMat = new THREE.MeshStandardMaterial({ color: '#aabbcc' });
    sharedMat.userData.sharedProtected = true;
    sharedMat.addEventListener('dispose', () => {
      sharedDisposed++;
    });

    const scope = new ResourceScope({ protectedMaterials: new Set() });
    const testMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMat);
    scope.trackObject(testMesh);
    scope.dispose();
    expect(sharedDisposed).toBe(0);

    sharedMat.dispose();
    atlas.dispose();
  });
});
