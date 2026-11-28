import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  LanternNightScene,
  getLanternNightHeight
} from '../../src/client/scene/environments/LanternNightScene';
import { findBuiltInSpace } from '../../src/client/scene/framework/SpaceCatalog';

describe('LanternNightScene ("Đêm Hoa Đăng & Đèn Trời")', () => {
  it('is registered in SpaceCatalog under slug lantern-night', () => {
    const entry = findBuiltInSpace('lantern-night');
    expect(entry).toBeDefined();
    expect(entry?.id).toBe('space-lantern-night');
    expect(entry?.slug).toBe('lantern-night');
  });

  it('initializes pitch-black ink void, mirror water, rising sky lanterns, hoa dang & reflections', async () => {
    const scene = new LanternNightScene();
    const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 1000);
    await scene.init({} as THREE.WebGLRenderer, camera);

    const threeScene = scene.getScene();
    expect(threeScene.background).toBeInstanceOf(THREE.Color);
    expect((threeScene.background as THREE.Color).getHexString()).toBe('010103');

    const skyLanterns = threeScene.getObjectByName('RisingSkyLanterns') as THREE.InstancedMesh;
    const skyRefl = threeScene.getObjectByName('SkyLanternReflections') as THREE.InstancedMesh;
    const hoaDang = threeScene.getObjectByName('FloatingHoaDangLanterns') as THREE.InstancedMesh;
    const hoaDangRefl = threeScene.getObjectByName('HoaDangWaterReflections') as THREE.InstancedMesh;
    const ripples = threeScene.getObjectByName('HoaDangConcentricRipples') as THREE.InstancedMesh;
    const water = threeScene.getObjectByName('LanternMirrorWater');
    const pier = threeScene.getObjectByName('LanternReleasePier');

    expect(skyLanterns?.count).toBe(420);
    expect(skyRefl?.count).toBe(420);
    expect(hoaDang?.count).toBe(180);
    expect(hoaDangRefl?.count).toBe(180);
    expect(ripples?.count).toBe(180);
    expect(water).toBeDefined();
    expect(pier).toBeDefined();

    // Verify finite geometry coordinates & clean update/audio reactivity
    scene.update(0.016, 4.5);
    scene.setAudioEnergy(0.8, 0.6, 0.4);
    scene.updateConfig({ wind: { speed: 1.2, direction: [1, 0, 0], gustiness: 0.3, swayIntensity: 0.9 } });

    const spawn = scene.getSpawnPoint();
    expect(spawn.position.y).toBeCloseTo(getLanternNightHeight(0, 22) + 1.65, 2);

    const pois = scene.getPointsOfInterest();
    expect(pois.length).toBeGreaterThanOrEqual(6);
    for (const poi of pois) {
      expect(Number.isFinite(poi.position.x)).toBe(true);
      expect(Number.isFinite(poi.position.y)).toBe(true);
      expect(Number.isFinite(poi.position.z)).toBe(true);
    }

    // Deterministic disposal and clean re-init
    scene.dispose();
    await scene.init({} as THREE.WebGLRenderer, camera);
    expect(scene.getScene().getObjectByName('RisingSkyLanterns')).toBeDefined();
    scene.dispose();
  });
});
