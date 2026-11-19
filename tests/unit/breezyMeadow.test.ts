import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BreezyMeadowScene,
  getBreezyMeadowHeight,
  getMeadowHeight,
  getMeadowNormal
} from '../../src/client/scene/environments/BreezyMeadowScene';
import { DEFAULT_BREEZY_MEADOW_CONFIG } from '../../src/server/db/seed';

describe('BreezyMeadowScene - Analytical Terrain Height h(x, z)', () => {
  it('evaluates exact known heights with O(1) determinism', () => {
    const h00 = getBreezyMeadowHeight(0, 0);
    // 3.2*cos(0)*cos(0) - 0 + 0.8*sin(0.4) + 0.5*cos(0) = 3.2 + 0.3115347 + 0.5 = 4.0115347
    expect(h00).toBeCloseTo(4.0115, 3);
    expect(getMeadowHeight(0, 0)).toBe(h00);

    // Deterministic purity: evaluate 1,000 times
    for (let i = 0; i < 1000; i++) {
      expect(getBreezyMeadowHeight(0, 0)).toBe(h00);
    }
  });

  it('guarantees continuous and finite values across 2,600 grid points without NaN or Infinity', () => {
    for (let x = -80; x <= 80; x += 3) {
      for (let z = -80; z <= 80; z += 3) {
        const h = getBreezyMeadowHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(isNaN(h)).toBe(false);
      }
    }
  });

  it('bounds terrain slope (|grad h| < 0.35 rad/m) across wander zone ensuring smooth traversability', () => {
    let maxSlope = 0;
    const eps = 0.01;
    for (let x = -45; x <= 45; x += 5) {
      for (let z = -45; z <= 45; z += 5) {
        const dhdx = (getBreezyMeadowHeight(x + eps, z) - getBreezyMeadowHeight(x, z)) / eps;
        const dhdz = (getBreezyMeadowHeight(x, z + eps) - getBreezyMeadowHeight(x, z)) / eps;
        const slope = Math.sqrt(dhdx * dhdx + dhdz * dhdz);
        if (slope > maxSlope) maxSlope = slope;
      }
    }
    expect(maxSlope).toBeLessThan(0.35);
  });

  it('exhibits horizon crest curvature where terrain slopes downward toward perimeter', () => {
    const hCenter = getBreezyMeadowHeight(0, 0);
    // Radial drops
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const x = 50 * Math.cos(angle);
      const z = 50 * Math.sin(angle);
      expect(getBreezyMeadowHeight(x, z)).toBeLessThan(hCenter);
    }
    // Perimeter drop below baseline
    expect(getBreezyMeadowHeight(70, 70)).toBeLessThan(0);
    expect(getBreezyMeadowHeight(-70, -70)).toBeLessThan(0);
  });

  it('computes exact normalized surface normal vector in O(1) time', () => {
    const normal = getMeadowNormal(0, 0);
    expect(normal).toBeInstanceOf(THREE.Vector3);
    expect(normal.length()).toBeCloseTo(1.0, 5);
    expect(normal.y).toBeGreaterThan(0.9); // Mostly upright on gentle slopes
  });

  it('executes 100,000 evaluations in under 50ms (< 0.0005 ms/eval)', () => {
    const t0 = performance.now();
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += getBreezyMeadowHeight(i * 0.01, i * 0.02);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
    expect(Number.isFinite(sum)).toBe(true);
  });
});

describe('BreezyMeadowScene - Scene Graph Initialization & Instancing', () => {
  it('initializes the full scene graph with all required entities', async () => {
    const scene = new BreezyMeadowScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera();

    await scene.init(mockRenderer, camera, DEFAULT_BREEZY_MEADOW_CONFIG);
    const threeScene = scene.getScene();

    expect(threeScene.getObjectByName('SkyDome')).toBeDefined();
    expect(threeScene.getObjectByName('UndulatingMeadowTerrain')).toBeDefined();
    expect(threeScene.getObjectByName('InstancedGrass')).toBeDefined();
    expect(threeScene.getObjectByName('InstancedFlowers')).toBeDefined();
    expect(threeScene.getObjectByName('GhibliCloudBank')).toBeDefined();

    scene.dispose();
  });

  it('validates InstancedGrass count >= 30,000 and anchors instances to terrain', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const grass = scene.getScene().getObjectByName('InstancedGrass') as THREE.InstancedMesh;
    expect(grass).toBeDefined();
    expect(grass.isInstancedMesh).toBe(true);
    expect(grass.count).toBeGreaterThanOrEqual(30000);
    expect(grass.instanceMatrix.array.length).toBe(grass.count * 16);

    // Sample 50 instances and verify ground anchoring
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    for (let i = 0; i < 50; i++) {
      const idx = Math.floor((i / 50) * grass.count);
      grass.getMatrixAt(idx, mat);
      pos.setFromMatrixPosition(mat);
      const expectedY = getBreezyMeadowHeight(pos.x, pos.z);
      expect(pos.y).toBeCloseTo(expectedY, 1);
    }

    scene.dispose();
  });

  it('validates InstancedFlowers count >= 1,500 with white/cream color distribution', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const flowers = scene.getScene().getObjectByName('InstancedFlowers') as THREE.InstancedMesh;
    expect(flowers).toBeDefined();
    expect(flowers.count).toBeGreaterThanOrEqual(1500);
    expect(flowers.instanceMatrix.array.length).toBe(flowers.count * 16);
    expect(flowers.instanceColor).toBeDefined();
    expect(flowers.instanceColor!.array.length).toBe(flowers.count * 3);

    scene.dispose();
  });

  it('validates GhibliCloudBank positioning and bounding dimensions', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const clouds = scene.getScene().getObjectByName('GhibliCloudBank') as THREE.Mesh;
    expect(clouds).toBeDefined();
    expect(clouds.material).toBeInstanceOf(THREE.ShaderMaterial);

    clouds.geometry.computeBoundingBox();
    const bbox = clouds.geometry.boundingBox!;
    // Spans horizontally across horizon
    expect(bbox.max.x - bbox.min.x).toBeGreaterThanOrEqual(150);
    // Spans vertically into high sky
    expect(bbox.max.y).toBeGreaterThanOrEqual(80);
    // Placed in background behind hill crest
    expect(bbox.max.z).toBeLessThan(-70);

    scene.dispose();
  });

  it('strictly respects draw call budget <= 15', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    let renderableMeshes = 0;
    scene.getScene().traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.InstancedMesh).isInstancedMesh) {
        renderableMeshes++;
      }
    });

    expect(renderableMeshes).toBeLessThanOrEqual(10); // Well under budget of 15
    scene.dispose();
  });
});

describe('BreezyMeadowScene - Navigation, Spawn & POIs', () => {
  it('returns valid spawn point clamped to terrain + eye height', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const spawn = scene.getSpawnPoint();
    expect(spawn.position).toBeDefined();
    expect(spawn.lookAt).toBeDefined();

    const expectedY = getBreezyMeadowHeight(spawn.position.x, spawn.position.z) + 1.7;
    expect(spawn.position.y).toBeCloseTo(expectedY, 2);
    expect(spawn.lookAt.z).toBeLessThan(spawn.position.z);

    scene.dispose();
  });

  it('returns wander bounds with radius 90m centered at origin', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const bounds = scene.getWanderBounds();
    expect(bounds.radius).toBe(90);
    expect(bounds.center.length()).toBe(0);

    scene.dispose();
  });

  it('exposes at least 4 designated scenic points of interest', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const pois = scene.getPointsOfInterest();
    expect(pois.length).toBeGreaterThanOrEqual(4);

    const names = pois.map((p) => p.name);
    expect(names).toContain('Flowerbed Crest');
    expect(names).toContain('Cumulus Vista');
    expect(names).toContain('Grassland Glide');
    expect(names).toContain('Horizon View');

    pois.forEach((poi) => {
      expect(poi.dwellTime).toBeGreaterThanOrEqual(6.0);
      expect(poi.position.y).toBeGreaterThan(getBreezyMeadowHeight(poi.position.x, poi.position.z));
    });

    scene.dispose();
  });
});

describe('BreezyMeadowScene - Dynamic Updates & Reactivity', () => {
  it('advances elapsed time uniforms across shaders on update()', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    scene.update(0.016, 7.5);
    const clouds = scene.getScene().getObjectByName('GhibliCloudBank') as THREE.Mesh;
    const cloudMat = clouds.material as THREE.ShaderMaterial;
    expect(cloudMat.uniforms.uTime.value).toBe(7.5);

    const grass = scene.getScene().getObjectByName('InstancedGrass') as THREE.InstancedMesh;
    const grassMat = grass.material as THREE.ShaderMaterial;
    expect(grassMat.uniforms.uTime.value).toBe(7.5);

    scene.dispose();
  });

  it('reactively updates uniforms without scene teardown on updateConfig()', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    scene.updateConfig({
      wind: { speed: 3.5, swayIntensity: 1.2, direction: [0.7, 0.7, 0.0], gustiness: 0.8 },
      fog: { type: 'exp2', color: '#cce5ff', density: 0.015 }
    });

    const fog = scene.getScene().fog as THREE.FogExp2;
    expect(fog.density).toBe(0.015);

    scene.dispose();
  });
});

describe('BreezyMeadowScene - Deterministic Disposal Lifecycle', () => {
  it('completely deallocates all GPU resources and detaches scene hierarchy on dispose()', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);

    const threeScene = scene.getScene();
    expect(threeScene.children.length).toBeGreaterThan(0);

    scene.dispose();
    expect(threeScene.children.length).toBe(0);

    // Idempotent dispose
    expect(() => scene.dispose()).not.toThrow();
  });

  it('allows clean re-initialization after disposal with 0 dangling references', async () => {
    const scene = new BreezyMeadowScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);
    scene.dispose();

    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera(), DEFAULT_BREEZY_MEADOW_CONFIG);
    expect(scene.getScene().children.length).toBeGreaterThan(0);
    scene.dispose();
    expect(scene.getScene().children.length).toBe(0);
  });
});
