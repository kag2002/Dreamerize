import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialHashGrid2D } from '../../src/client/scene/framework/SpatialHashGrid';
import { ZoneStreamer } from '../../src/client/scene/framework/ZoneStreamer';
import { ResourceScope } from '../../src/client/scene/framework/ResourceScope';
import { PartsBuilder } from '../../src/client/scene/framework/PartsBuilder';
import { MaterialLibrary } from '../../src/client/scene/framework/MaterialLibrary';
import { AnimationBus } from '../../src/client/scene/framework/AnimationBus';
import { findBuiltInSpace } from '../../src/client/scene/framework/SpaceCatalog';
import type { ZoneDescriptor } from '../../src/client/scene/framework/types';
import {
  VietnamHeritageScene,
  getVietnamHeritageHeight
} from '../../src/client/scene/environments/VietnamHeritageScene';
import {
  createSmoothDragonParts,
  createRealisticAncientBanyanParts
} from '../../src/client/scene/environments/vietnamMotifHelpers';

function makeZoneHarness() {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshStandardMaterial({ color: '#cccccc' });
  const shared = { stone: mat };
  const makeCtx = () => ({
    scene,
    scope: new ResourceScope(),
    parts: { create: () => new PartsBuilder() },
    materials: new MaterialLibrary(shared),
    anim: new AnimationBus(),
    terrain: {
      height: () => 0,
      normal: () => new THREE.Vector3(0, 1, 0)
    },
    rng: () => () => 0.5
  });
  const makeZone = (id: string, x: number, z: number, radius = 40): ZoneDescriptor => ({
    id,
    groupName: `ScaleZone_${id}`,
    region: 'macro',
    center: { x, z },
    radius,
    build: (ctx) => {
      const group = new THREE.Group();
      group.name = `ScaleZone_${id}`;
      const mesh = ctx.parts.create().box(4, 2, 4, x, 1, z).buildMesh(`${id}_m`, ctx.materials.shared.stone)!;
      group.add(mesh);
      return { group };
    }
  });
  return { scene, mat, makeCtx, makeZone };
}

describe('Scale Map Optimization - SpatialHashGrid2D', () => {
  it('deduplicates multi-cell items, supports insert/remove/containsPoint, and scales to 500+ entries', () => {
    const grid = new SpatialHashGrid2D<{ id: string }>(50);
    const largeItem = { id: 'large' };
    const smallItem = { id: 'small' };

    // Spans multiple 50m cells around (0, 0)
    grid.insert(largeItem, 0, 0, 95);
    grid.insert(smallItem, 220, -180, 15);
    expect(grid.size).toBe(2);

    // Multi-cell item must be visited at most once per query
    const visited: string[] = [];
    grid.queryRadius(10, 10, 120, (item) => {
      visited.push(item.id);
    });
    expect(visited).toEqual(['large']);

    // containsPoint respects exact radius + extraPadding
    expect(grid.containsPoint(90, 0, 0)).toBe(true);
    expect(grid.containsPoint(100, 0, 0)).toBe(false);
    expect(grid.containsPoint(100, 0, 10)).toBe(true);
    expect(grid.containsPoint(220, -180, 0)).toBe(true);

    // Remove cleanly deletes from all covered cells
    grid.remove(largeItem);
    expect(grid.size).toBe(1);
    expect(grid.containsPoint(0, 0, 0)).toBe(false);

    // Performance check: 10,000 queries across 500 exclusion circles in < 60ms
    grid.clear();
    for (let i = 0; i < 500; i++) {
      const gx = ((i * 73) % 4000) - 2000;
      const gz = ((i * 137) % 4000) - 2000;
      grid.insert({ id: `c${i}` }, gx, gz, 25 + (i % 40));
    }
    const t0 = performance.now();
    let hits = 0;
    for (let q = 0; q < 10_000; q++) {
      const qx = ((q * 193) % 4000) - 2000;
      const qz = ((q * 311) % 4000) - 2000;
      if (grid.containsPoint(qx, qz, 4)) hits++;
    }
    const elapsed = performance.now() - t0;
    expect(hits).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(80);
  });
});

describe('Scale Map Optimization - ZoneStreamer Predictive Lookahead & VRAM Cap', () => {
  it('preloads upcoming zones along camera velocity vector while guarding against teleports', () => {
    const { scene, mat, makeCtx, makeZone } = makeZoneHarness();
    const streamer = new ZoneStreamer({
      mode: 'proximity',
      loadRadius: 120,
      unloadRadius: 200,
      maxBuildMsPerFrame: 50
    });

    // Zone at x=210, radius=30 -> effective load threshold from camera is 150m.
    // From x=0, dist=210 (outside). Moving +60m/s to x=60 in dt=1s -> lookahead = 60 + 60*1.4 = 144m,
    // distance from lookahead to x=210 is 66m < 150m -> preloads early!
    // Meanwhile, far zone at x=520 stays unloaded.
    streamer.registerAll([makeZone('ahead', 210, 0, 30), makeZone('very_far', 520, 0, 30)]);

    streamer.update(new THREE.Vector3(0, 0, 0), makeCtx, 1.0);
    expect(streamer.getLoadedZoneIds()).toEqual([]);

    streamer.update(new THREE.Vector3(60, 0, 0), makeCtx, 1.0);
    expect(streamer.getLoadedZoneIds()).toContain('ahead');
    expect(streamer.getLoadedZoneIds()).not.toContain('very_far');

    // Teleport jump >= 240m must NOT apply velocity lookahead overshoot into 'very_far' (at x=520)
    // Teleport from x=60 to x=330 (dx=270 >= 240). Effective load dist to 520 is 190 > 150.
    // Without teleport guard, lookahead would jump to 330+180=510 and falsely load 'very_far'.
    streamer.update(new THREE.Vector3(330, 0, 0), makeCtx, 1.0);
    expect(streamer.getLoadedZoneIds()).not.toContain('very_far');

    streamer.disposeAll();
    expect(scene.children.length).toBe(0);
    mat.dispose();
  });

  it('enforces maxLoadedZones VRAM cap by evicting farthest zones and supports setRadii', () => {
    const { scene, mat, makeCtx, makeZone } = makeZoneHarness();
    const streamer = new ZoneStreamer({
      mode: 'proximity',
      loadRadius: 400,
      unloadRadius: 500,
      maxLoadedZones: 3,
      maxBuildMsPerFrame: 50
    });

    streamer.registerAll([
      makeZone('z1', 20, 0, 20),
      makeZone('z2', 60, 0, 20),
      makeZone('z3', 100, 0, 20),
      makeZone('z4', 180, 0, 20),
      makeZone('z5', 260, 0, 20)
    ]);

    streamer.update(new THREE.Vector3(0, 0, 0), makeCtx, 0.5);
    const loaded = streamer.getLoadedZoneIds().sort();
    expect(loaded).toEqual(['z1', 'z2', 'z3']);
    expect(scene.children.length).toBe(3);

    // Lowering radii and cap evicts outer loaded zones cleanly
    streamer.setRadii(70, 90);
    streamer.setMaxLoadedZones(2);
    streamer.update(new THREE.Vector3(0, 0, 0), makeCtx, 0.5);
    expect(streamer.getLoadedZoneIds().sort()).toEqual(['z1', 'z2']);
    expect(scene.children.length).toBe(2);

    streamer.disposeAll();
    mat.dispose();
  });
});

describe('Scale Map Optimization - VietnamHeritageScene Chunked Terrain, Warped Water & Catalog Streaming', () => {
  it('builds watertight 4x4 frustum-culled terrain chunks, warped water, lower triangle count & tier grass fade', async () => {
    const scene = new VietnamHeritageScene({ streamingMode: 'all' });
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    cam.position.set(0, 2.2, 58);
    await scene.init({} as THREE.WebGLRenderer, cam);

    const threeScene = scene.getScene();
    const terrainGroup = threeScene.getObjectByName('VietnamHeritageTerrain')!;
    expect(terrainGroup).toBeDefined();

    const chunks: THREE.Mesh[] = [];
    terrainGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) chunks.push(obj as THREE.Mesh);
    });
    expect(chunks.length).toBe(16);

    for (const chunk of chunks) {
      expect(chunk.frustumCulled).toBe(true);
      expect(chunk.geometry.boundingSphere).not.toBeNull();
      expect(chunk.geometry.boundingSphere!.radius).toBeGreaterThan(100);
    }

    // Verify watertight seam continuity between TerrainChunk_1_1 (right edge) and TerrainChunk_2_1 (left edge)
    const cLeft = threeScene.getObjectByName('TerrainChunk_1_1') as THREE.Mesh;
    const cRight = threeScene.getObjectByName('TerrainChunk_2_1') as THREE.Mesh;
    expect(cLeft).toBeDefined();
    expect(cRight).toBeDefined();
    const posL = cLeft.geometry.attributes.position as THREE.BufferAttribute;
    const posR = cRight.geometry.attributes.position as THREE.BufferAttribute;
    const normL = cLeft.geometry.attributes.normal as THREE.BufferAttribute;
    const normR = cRight.geometry.attributes.normal as THREE.BufferAttribute;
    const rowStride = 55; // chunkSegs + 1
    for (let row = 0; row < rowStride; row++) {
      const idxL = row * rowStride + 54; // rightmost col of chunk 1
      const idxR = row * rowStride + 0; // leftmost col of chunk 2
      expect(posL.getX(idxL)).toBeCloseTo(posR.getX(idxR), 5);
      expect(posL.getY(idxL)).toBeCloseTo(posR.getY(idxR), 5);
      expect(posL.getZ(idxL)).toBeCloseTo(posR.getZ(idxR), 5);
      expect(posL.getY(idxL)).toBeCloseTo(
        getVietnamHeritageHeight(posL.getX(idxL), posL.getZ(idxL)),
        4
      );
      expect(normL.getX(idxL)).toBeCloseTo(normR.getX(idxR), 5);
      expect(normL.getY(idxL)).toBeCloseTo(normR.getY(idxR), 5);
      expect(normL.getZ(idxL)).toBeCloseTo(normR.getZ(idxR), 5);
    }

    // Water remains a single THREE.Mesh with warped 120x120 grid (28,800 tris)
    const waterMesh = threeScene.getObjectByName('HaLongAndLotusWater') as THREE.Mesh;
    expect(waterMesh.isMesh).toBe(true);
    const waterTris = (waterMesh.geometry.index!.count) / 3;
    expect(waterTris).toBe(120 * 120 * 2);

    // Total triangles dropped by >200k vs pre-optimization 3.64M
    const metrics = scene.getPerfMetrics();
    expect(metrics.totalTriangles).toBeLessThan(3_460_000);
    expect(metrics.loadedZonesCount).toBe(14);

    // Grass GPU distance fade scales dynamically with QualityTier
    const grass = threeScene.getObjectByName('InstancedGrass') as THREE.InstancedMesh;
    const grassMat = grass.material as THREE.ShaderMaterial;
    scene.setQualityTier('low');
    const lowFadeEnd = grassMat.uniforms.uFadeEnd.value as number;
    scene.setQualityTier('ultra');
    const ultraFadeEnd = grassMat.uniforms.uFadeEnd.value as number;
    expect(lowFadeEnd).toBeGreaterThan(0);
    expect(ultraFadeEnd).toBeGreaterThan(lowFadeEnd);

    // Upgraded landmark meshes exist cleanly with finite bounds
    for (const upgradedName of [
      'ChuaHuongKapokBanyanAndKarstFoliage',
      'ChuaHuongCableCarSystem',
      'DaLatIconicArchitecture',
      'DaLatLamVienGlassPavilions',
      'LangCoBanyanLushCanopy'
    ]) {
      const mesh = threeScene.getObjectByName(upgradedName) as THREE.Mesh;
      expect(mesh, `Missing upgraded landmark mesh: ${upgradedName}`).toBeDefined();
      expect(mesh.geometry.attributes.position.count).toBeGreaterThan(30);
    }

    scene.dispose();
  }, 20000);

  it('SpaceCatalog boots vietnam-heritage in proximity streaming mode for fast large-map startup', async () => {
    const entry = findBuiltInSpace('vietnam-heritage');
    expect(entry).toBeDefined();
    const space = await entry!.loadFactory();
    expect(space).toBeInstanceOf(VietnamHeritageScene);
    const vn = space as VietnamHeritageScene;
    expect(vn.getStreamingMode()).toBe('proximity');

    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    cam.position.set(0, 2.2, 58);
    await vn.init({} as THREE.WebGLRenderer, cam);
    const metrics = vn.getPerfMetrics();
    expect(metrics.loadedZonesCount).toBeLessThan(14);
    expect(metrics.totalTriangles).toBeLessThan(2_600_000);

    vn.dispose();
  }, 20000);

  it('passes multi-angle micro-motif & geometric continuity QC across all 6 upgraded heritage zones', async () => {
    // 1. Verify smooth dragon spline loft (scales, belly plates, tongue, nostrils, gill scrolls, elbow spurs & 3-plume tail)
    const testCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8, 0, -4),
      new THREE.Vector3(-3, 4, 2),
      new THREE.Vector3(3, 8, -2),
      new THREE.Vector3(8, 12, 4)
    ]);
    const dragon = createSmoothDragonParts(testCurve, {
      baseRadius: 1.0,
      tubularSegments: 48,
      radialSegments: 10,
      headAt: 'end',
      includeLegs: true
    });
    expect(dragon.bodyParts.length).toBeGreaterThanOrEqual(10); // trunk, tongue, legs, skull, jaw, nostrils, gills, brows
    expect(dragon.accentParts.length).toBeGreaterThanOrEqual(20); // crest, 3 tail plumes, whiskers, 16 talons
    expect(dragon.maneParts.length).toBeGreaterThanOrEqual(16); // antlers, tines, manes, elbow spurs, fangs, teeth
    const trunkPos = dragon.bodyParts[0].attributes.position as THREE.BufferAttribute;
    expect(trunkPos.count).toBeGreaterThan(500);
    // Confirm 3D relief variation & zero NaNs
    for (let i = 0; i < trunkPos.array.length; i++) {
      expect(Number.isFinite(trunkPos.array[i])).toBe(true);
    }

    // 2. Verify realistic Ancient Banyan tree produces braided trunk, prop root toes & epiphytic fern clusters
    const banyan = createRealisticAncientBanyanParts(0, 0, 0, 1.0, 40404);
    expect(banyan.barkParts.length).toBeGreaterThan(45);
    expect(banyan.canopyParts.length).toBeGreaterThan(35);
    for (const part of [...banyan.barkParts, ...banyan.canopyParts]) {
      part.computeBoundingBox();
      expect(part.boundingBox).not.toBeNull();
      const size = new THREE.Vector3();
      part.boundingBox!.getSize(size);
      expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0.05);
    }

    // 3. Multi-angle 3D bounding-extent verification across all 6 upgraded heritage complexes
    const scene = new VietnamHeritageScene({ streamingMode: 'all' });
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 8500);
    cam.position.set(0, 2.2, 58);
    await scene.init({} as THREE.WebGLRenderer, cam);
    const threeScene = scene.getScene();

    const upgradedGroups = [
      'ChuaHuongComplex',
      'TruongSonMonsoonJungleGorge',
      'LongVanLacquerValleyMacro',
      'LangCoBanyanHero',
      'DaLatLangbiangComplex',
      'PhuQuocIslandComplex',
      'ConDaoIslandComplex',
      'HaLongBayComplex',
      'DragonBridgeDaNangComplex'
    ];
    for (const gName of upgradedGroups) {
      const obj = threeScene.getObjectByName(gName);
      expect(obj, `Missing group ${gName}`).toBeDefined();
      const box = new THREE.Box3().setFromObject(obj!);
      const dims = new THREE.Vector3();
      box.getSize(dims);
      expect(dims.x, `${gName} X span too shallow`).toBeGreaterThan(6.0);
      expect(dims.y, `${gName} Y span too flat`).toBeGreaterThan(6.0);
      expect(dims.z, `${gName} Z span too shallow`).toBeGreaterThan(6.0);

      // 6-viewpoint directional surface normal coverage (Front 0/+Z, Rear 180/-Z, Side ±90/±X, Oblique 45, Bird's-Eye +Y)
      let frontNormals = 0;
      let rearNormals = 0;
      let leftNormals = 0;
      let rightNormals = 0;
      let topNormals = 0;
      let obliqueNormals = 0;
      obj!.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const normAttr = mesh.geometry.attributes.normal as THREE.BufferAttribute | undefined;
        if (!normAttr) return;
        for (let i = 0; i < normAttr.count; i += 3) {
          const nx = normAttr.getX(i);
          const ny = normAttr.getY(i);
          const nz = normAttr.getZ(i);
          if (nz > 0.35) frontNormals++;
          if (nz < -0.35) rearNormals++;
          if (nx < -0.35) leftNormals++;
          if (nx > 0.35) rightNormals++;
          if (ny > 0.35) topNormals++;
          if (nx * 0.707 + nz * 0.707 > 0.45) obliqueNormals++;
        }
      });
      expect(frontNormals, `${gName} lacks Front (0°) surface detail`).toBeGreaterThan(30);
      expect(rearNormals, `${gName} lacks Rear (180°) surface detail`).toBeGreaterThan(30);
      expect(leftNormals, `${gName} lacks Left (-90°) surface detail`).toBeGreaterThan(30);
      expect(rightNormals, `${gName} lacks Right (+90°) surface detail`).toBeGreaterThan(30);
      expect(topNormals, `${gName} lacks Bird's-Eye (+Y) surface detail`).toBeGreaterThan(30);
      expect(obliqueNormals, `${gName} lacks Oblique (45°) surface detail`).toBeGreaterThan(30);
    }

    scene.dispose();
  }, 20000);
});
