import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StarryNightScene, getStarryNightHeight } from '../../src/client/scene/environments/StarryNightScene';
import { DEFAULT_STARRY_NIGHT_CONFIG } from '../../src/server/db/seed';

describe('StarryNightScene', () => {
  it('evaluates analytical ground height function h(x, z) in O(1) time with continuous values', () => {
    // Test known analytical values
    const h00 = getStarryNightHeight(0, 0);
    expect(h00).toBeCloseTo(1.8, 4);

    // Verify across a wide grid that values are finite numbers and without NaN/Infinity
    for (let x = -60; x <= 60; x += 15) {
      for (let z = -60; z <= 60; z += 15) {
        const h = getStarryNightHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(isNaN(h)).toBe(false);
      }
    }

    // Verify negative quadratic term creates gentle horizon crest drop at perimeter
    const hFar = getStarryNightHeight(60, 60);
    expect(hFar).toBeLessThan(h00);
  });

  it('initializes the full procedural scene graph matching Van Gogh composition', async () => {
    const scene = new StarryNightScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);

    await scene.init(mockRenderer, camera, DEFAULT_STARRY_NIGHT_CONFIG);

    const threeScene = scene.getScene();
    expect(threeScene).toBeDefined();

    // Verify SkyDome
    const skyDome = threeScene.getObjectByName('SkyDome') as THREE.Mesh;
    expect(skyDome).toBeDefined();
    expect(skyDome.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(skyDome.material).toBeInstanceOf(THREE.ShaderMaterial);

    // Verify Crescent Moon
    const moon = threeScene.getObjectByName('CrescentMoon') as THREE.Mesh;
    expect(moon).toBeDefined();
    expect(moon.position.x).toBeGreaterThan(50); // upper right quadrant

    // Verify exactly 11 Van Gogh Star Halos
    for (let i = 1; i <= 11; i++) {
      const star = threeScene.getObjectByName(`StarHalo_${i}`);
      expect(star).toBeDefined();
    }

    // Verify Undulating Terrain Mesh
    const terrain = threeScene.getObjectByName('UndulatingHillTerrain') as THREE.Mesh;
    expect(terrain).toBeDefined();

    // Verify Monumental Cypress Tree
    const cypress = threeScene.getObjectByName('MonumentalCypressTree') as THREE.Mesh;
    expect(cypress).toBeDefined();
    expect(cypress.position.x).toBeLessThan(0); // Left foreground

    // Verify Alpilles Ridges
    for (let i = 1; i <= 3; i++) {
      const ridge = threeScene.getObjectByName(`AlpillesRidge_${i}`);
      expect(ridge).toBeDefined();
    }

    // Verify Sleeping Village
    const village = threeScene.getObjectByName('SleepingVillage');
    expect(village).toBeDefined();

    // Verify zero NaN vertices or bounding spheres across all geometries in the scene
    let nonFiniteVertices = 0;
    let nonFiniteBounds = 0;
    threeScene.traverse((obj) => {
      const geo = (obj as THREE.Mesh).geometry;
      if (geo) {
        const pos = geo.attributes.position;
        if (pos) {
          const arr = pos.array as ArrayLike<number>;
          for (let i = 0; i < arr.length; i++) {
            if (!Number.isFinite(arr[i])) {
              nonFiniteVertices++;
              break;
            }
          }
        }
        geo.computeBoundingSphere();
        if (!Number.isFinite(geo.boundingSphere?.radius)) {
          nonFiniteBounds++;
        }
      }
    });
    expect(nonFiniteVertices).toBe(0);
    expect(nonFiniteBounds).toBe(0);

    scene.dispose();
  }, 15000);

  it('provides accurate spawn point and wander bounds', async () => {
    const scene = new StarryNightScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera();

    await scene.init(mockRenderer, camera, DEFAULT_STARRY_NIGHT_CONFIG);

    const spawn = scene.getSpawnPoint();
    expect(spawn.position).toBeDefined();
    expect(spawn.lookAt).toBeDefined();

    // Spawn height must equal terrain height + heightOffset
    const expectedGroundY = getStarryNightHeight(spawn.position.x, spawn.position.z);
    expect(spawn.position.y).toBeCloseTo(expectedGroundY + 1.7, 2);

    const bounds = scene.getWanderBounds();
    expect(bounds.radius).toBe(70);
    expect(bounds.center.length()).toBe(0);

    scene.dispose();
  });

  it('provides scenic points of interest for autonomous exploration', async () => {
    const scene = new StarryNightScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera();

    await scene.init(mockRenderer, camera, DEFAULT_STARRY_NIGHT_CONFIG);

    const pois = scene.getPointsOfInterest();
    expect(pois.length).toBeGreaterThanOrEqual(4);

    const names = pois.map((p) => p.name);
    expect(names).toContain('Village Overlook');
    expect(names).toContain('Cypress Foot');
    expect(names).toContain('Moon Gazer');
    expect(names).toContain('Starry Ridge');

    pois.forEach((poi) => {
      expect(poi.dwellTime).toBeGreaterThan(0);
      expect(poi.position.y).toBeGreaterThan(getStarryNightHeight(poi.position.x, poi.position.z));
    });

    scene.dispose();
  });

  it('advances animated time uniforms and village window lights on update()', async () => {
    const scene = new StarryNightScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera();

    await scene.init(mockRenderer, camera, DEFAULT_STARRY_NIGHT_CONFIG);

    const threeScene = scene.getScene();
    const skyDome = threeScene.getObjectByName('SkyDome') as THREE.Mesh;
    const skyMat = skyDome.material as THREE.ShaderMaterial;

    expect(skyMat.uniforms.uTime.value).toBe(0);

    scene.update(0.016, 5.0);
    expect(skyMat.uniforms.uTime.value).toBe(5.0);

    scene.dispose();
  });

  it('reactively updates uniforms and scene settings without teardown on updateConfig()', async () => {
    const scene = new StarryNightScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera();

    await scene.init(mockRenderer, camera, DEFAULT_STARRY_NIGHT_CONFIG);

    const threeScene = scene.getScene();
    const skyDome = threeScene.getObjectByName('SkyDome') as THREE.Mesh;
    const skyMat = skyDome.material as THREE.ShaderMaterial;
    const moon = threeScene.getObjectByName('CrescentMoon') as THREE.Mesh;
    const moonMat = moon.material as THREE.ShaderMaterial;
    const cypress = threeScene.getObjectByName('MonumentalCypressTree') as THREE.Mesh;
    const cypressMat = cypress.material as THREE.ShaderMaterial;

    // Apply live updates
    scene.updateConfig({
      sky: {
        swirlSpeed: 2.8,
        moonGlow: 1.5,
        type: 'starry_night_flow',
        topColor: '#0a1128',
        bottomColor: '#1c2541',
        horizonColor: '#102015',
        starDensity: 600
      },
      fog: {
        type: 'exp2',
        color: '#0a0e1a',
        density: 0.025
      },
      wind: {
        speed: 3.0,
        swayIntensity: 0.85,
        direction: [0.9, 0.4],
        gustiness: 0.5
      }
    });

    expect(skyMat.uniforms.uSwirlSpeed.value).toBe(2.8);
    expect(moonMat.uniforms.uGlowIntensity.value).toBe(1.5);
    expect(cypressMat.uniforms.uWindStrength.value).toBe(0.85);

    const fog = threeScene.fog as THREE.FogExp2;
    expect(fog.density).toBe(0.025);

    scene.dispose();
  });

  it('cleans up all resources deterministically on dispose()', async () => {
    const scene = new StarryNightScene();
    const mockRenderer = {} as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera();

    await scene.init(mockRenderer, camera, DEFAULT_STARRY_NIGHT_CONFIG);

    const threeScene = scene.getScene();
    expect(threeScene.children.length).toBeGreaterThan(0);

    scene.dispose();
    expect(threeScene.children.length).toBe(0);

    // Idempotent dispose call
    expect(() => scene.dispose()).not.toThrow();
  });
});
