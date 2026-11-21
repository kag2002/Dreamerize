import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { IPointOfInterest, ISpawnPoint, IWanderBounds } from '../../src/client/scene/ISpace';
import { BaseWorldScene } from '../../src/client/scene/framework/BaseWorldScene';
import { QUALITY_PRESETS } from '../../src/client/scene/framework/QualityPreset';
import {
  createBuiltInSpaceBySlug,
  findBuiltInSpace,
  getBuiltInSpaces,
  isKnownBuiltInSlug,
  normalizeBuiltInSlug,
  registerBuiltInSpace,
  unregisterBuiltInSpace
} from '../../src/client/scene/framework/SpaceCatalog';
import type { ZoneDescriptor } from '../../src/client/scene/framework/types';
import { SpaceEngine } from '../../src/client/scene/SpaceEngine';
import { StarryNightScene } from '../../src/client/scene/environments/StarryNightScene';
import { BreezyMeadowScene } from '../../src/client/scene/environments/BreezyMeadowScene';
import { CosmicBlackHoleScene } from '../../src/client/scene/environments/CosmicBlackHoleScene';
import { MistyForestScene } from '../../src/client/scene/environments/MistyForestScene';
import { ParadiseScene } from '../../src/client/scene/environments/ParadiseScene';
import { GhibliValleyScene } from '../../src/client/scene/environments/GhibliValleyScene';

class DemoFutureWorld extends BaseWorldScene {
  readonly id = 'space-aurora-fjord';
  readonly name = 'Aurora Fjord Sanctuary';
  readonly slug = 'aurora-fjord';

  protected buildWorld(): void {
    const sun = new THREE.DirectionalLight('#fff5d6', 1.5);
    sun.position.set(40, 60, -50);
    sun.castShadow = true;
    this.directionalLight = sun;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2b5238', roughness: 0.85 })
    );
    ground.name = 'AuroraTerrain';
    this.scene.add(ground);

    const stoneMatA = new THREE.MeshStandardMaterial({ color: '#8e8982', roughness: 0.72 });
    const stoneMatB = new THREE.MeshStandardMaterial({ color: '#8e8982', roughness: 0.72 });
    const pillarGeoA = new THREE.BoxGeometry(2, 6, 2);
    const pillarGeoB = new THREE.BoxGeometry(2, 6, 2);
    const mA = new THREE.Mesh(pillarGeoA, stoneMatA);
    const mB = new THREE.Mesh(pillarGeoB, stoneMatB);
    mA.position.set(5, 3, 5);
    mB.position.set(-5, 3, -5);
    mA.castShadow = true;
    mB.castShadow = true;
    this.scene.add(mA, mB);

    const bladeGeo = new THREE.PlaneGeometry(0.12, 0.7, 1, 2);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#3b8c3b', roughness: 0.7 });
    const grass = new THREE.InstancedMesh(bladeGeo, grassMat, 1000);
    grass.name = 'InstancedDemoGrass';
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < 1000; i++) {
      mat4.makeTranslation((i % 50) * 1.2 - 30, 0.35, Math.floor(i / 50) * 1.2 - 12);
      grass.setMatrixAt(i, mat4);
    }
    grass.instanceMatrix.needsUpdate = true;
    this.scene.add(grass);

    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight('#ffd27d', 2.0, 20, 1.5);
      pl.name = `FjordLantern_${i}`;
      pl.position.set(i * 4 - 10, 2.5, 4);
      this.scene.add(pl);
    }
  }

  protected override createZones(): ZoneDescriptor[] {
    const makeZone = (id: string, x: number, z: number): ZoneDescriptor => ({
      id,
      groupName: `Group_${id}`,
      region: 'core',
      center: { x, z },
      radius: 80,
      build: (ctx) => {
        const g = new THREE.Group();
        g.name = `Group_${id}`;
        const mat = ctx.materials.getOrCreateStandard({ color: '#a57c52', roughness: 0.75 });
        const cabin = ctx.parts.create().box(4, 3, 4, x, 1.5, z).buildMesh(`${id}_cabin`, mat)!;
        g.add(cabin);
        return { group: g };
      }
    });

    return [makeZone('zone_near', 0, 0), makeZone('zone_far', 900, 0)];
  }

  public getGroundHeight(_x: number, _z: number): number {
    return 0;
  }

  public getSpawnPoint(): ISpawnPoint {
    return {
      position: new THREE.Vector3(0, 1.7, 12),
      lookAt: new THREE.Vector3(0, 2, -20)
    };
  }

  public getWanderBounds(): IWanderBounds {
    return {
      radius: 200,
      center: new THREE.Vector3(0, 0, 0)
    };
  }

  public getPointsOfInterest(): IPointOfInterest[] {
    return [
      {
        name: 'Fjord Overlook',
        position: new THREE.Vector3(0, 3, 10),
        lookAt: new THREE.Vector3(0, 2, -20),
        dwellTime: 8
      },
      {
        name: 'Far Camp',
        position: new THREE.Vector3(900, 4, 10),
        lookAt: new THREE.Vector3(900, 2, 0),
        dwellTime: 8
      }
    ];
  }
}

describe('Project-Wide 3D World Framework (BaseWorldScene, WorldRuntime, SpaceCatalog)', () => {
  it('BaseWorldScene provides proximity streaming, pooled PointLights, dedupe, foliage scaling & zero-leak dispose', async () => {
    const world = new DemoFutureWorld({
      streamingMode: 'proximity',
      zoneLoadRadius: 200,
      zoneUnloadRadius: 300
    });
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 2000);
    cam.position.set(0, 1.7, 12);

    await world.init({} as THREE.WebGLRenderer, cam);
    expect(world.getStreamingMode()).toBe('proximity');
    expect(world.getLoadedZoneIds()).toEqual(['zone_near']);
    expect(world.getScene().getObjectByName('Group_zone_near')).toBeDefined();
    expect(world.getScene().getObjectByName('Group_zone_far')).toBeUndefined();

    const highMetrics = world.getPerfMetrics();
    expect(highMetrics.deduplicatedMaterialsSaved).toBeGreaterThanOrEqual(1);
    expect(highMetrics.pooledPointLightsCount).toBeLessThanOrEqual(
      QUALITY_PRESETS.high.maxActivePointLights
    );
    expect(highMetrics.managedPointLightsTotal).toBe(6);

    const grass = world.getScene().getObjectByName('InstancedDemoGrass') as THREE.InstancedMesh;
    expect(grass.count).toBe(1000);

    world.setQualityTier('low');
    expect(world.getQualityTier()).toBe('low');
    expect(grass.count).toBe(Math.round(1000 * QUALITY_PRESETS.low.foliageDensityScale));
    expect(world.getPerfMetrics().pooledPointLightsCount).toBe(
      QUALITY_PRESETS.low.maxActivePointLights
    );

    cam.position.set(900, 5, 0);
    world.update(0.016, 1.0);
    expect(world.getLoadedZoneIds()).toEqual(['zone_far']);
    expect(world.getScene().getObjectByName('Group_zone_far')).toBeDefined();
    expect(world.getScene().getObjectByName('Group_zone_near')).toBeUndefined();

    cam.position.set(0, 1.7, 12);
    world.update(0.016, 2.0);
    expect(world.getLoadedZoneIds()).toEqual(['zone_near']);

    world.dispose();
    expect(world.getScene().children.length).toBe(0);

    // Clean re-init works deterministically after disposal
    await world.init({} as THREE.WebGLRenderer, cam);
    expect(world.getLoadedZoneIds()).toEqual(['zone_near']);
    world.dispose();
  });

  it('SpaceCatalog resolves all 7 built-in maps and dynamically registers/unregisters future maps', async () => {
    const builtIns = getBuiltInSpaces();
    expect(builtIns.length).toBeGreaterThanOrEqual(7);

    for (const entry of builtIns) {
      expect(isKnownBuiltInSlug(entry.slug)).toBe(true);
      expect(normalizeBuiltInSlug(`space-${entry.slug}`)).toBe(entry.slug);
      expect(findBuiltInSpace(entry.slug)?.id).toBe(entry.id);
    }

    registerBuiltInSpace({
      id: 'space-aurora-fjord',
      slug: 'aurora-fjord',
      aliases: ['aurora-fjord', 'space-aurora-fjord'],
      keywordMatches: ['aurora', 'fjord'],
      name: 'Aurora Fjord Sanctuary',
      viewerTitle: 'Aurora Fjord Sanctuary',
      viewerSubtitle: 'Aurora Fjord • Framework Demo',
      gallerySubtitle: 'Aurora Fjord • Ambient Piano & Pads',
      description: 'Future modular world built on BaseWorldScene.',
      accentColor: '#38bdf8',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #0284c7 100%)',
      tags: ['Proximity Streaming', 'BaseWorldScene'],
      tabLabel: 'Aurora Fjord',
      tabTestId: 'switch-space-aurora-fjord',
      loadFactory: async () => new DemoFutureWorld()
    });

    try {
      expect(isKnownBuiltInSlug('aurora-fjord')).toBe(true);
      expect(normalizeBuiltInSlug('space-aurora-fjord')).toBe('aurora-fjord');

      const fromCatalog = await createBuiltInSpaceBySlug('aurora-fjord');
      expect(fromCatalog.slug).toBe('aurora-fjord');
      expect(typeof fromCatalog.setQualityTier).toBe('function');

      const fromEngine = await SpaceEngine.createSpaceBySlug('aurora-fjord');
      expect(fromEngine.slug).toBe('aurora-fjord');
    } finally {
      unregisterBuiltInSpace('aurora-fjord');
    }
    expect(isKnownBuiltInSlug('aurora-fjord')).toBe(false);
  });

  it('powers all 6 existing built-in worlds with unified WorldRuntime quality scaling & budgets', async () => {
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 2000);

    // 1. StarryNightScene
    const starry = new StarryNightScene();
    await starry.init({} as THREE.WebGLRenderer, cam);
    const starryMetrics = starry.getPerfMetrics();
    expect(starryMetrics.managedPointLightsTotal).toBeGreaterThanOrEqual(12);
    expect(starryMetrics.pooledPointLightsCount).toBeLessThanOrEqual(
      QUALITY_PRESETS.high.maxActivePointLights
    );
    starry.setQualityTier('low');
    expect(starry.getQualityTier()).toBe('low');
    expect(starry.getPerfMetrics().pooledPointLightsCount).toBe(
      QUALITY_PRESETS.low.maxActivePointLights
    );
    starry.dispose();

    // 2. BreezyMeadowScene
    const meadow = new BreezyMeadowScene();
    await meadow.init({} as THREE.WebGLRenderer, cam);
    const meadowGrass = meadow.getScene().getObjectByName('InstancedGrass') as THREE.InstancedMesh;
    const meadowGrassMat = meadowGrass.material as THREE.ShaderMaterial;
    const meadowHighGrass = meadowGrass.count;
    expect(meadowHighGrass).toBeGreaterThanOrEqual(30000);
    expect(meadow.getPerfMetrics().pooledPointLightsCount).toBe(0);
    expect(meadowGrassMat.uniforms.uFadeEnd.value).toBe(QUALITY_PRESETS.high.foliageFadeEnd);
    meadow.setQualityTier('low');
    expect(meadowGrass.count).toBe(
      Math.round(meadowHighGrass * QUALITY_PRESETS.low.foliageDensityScale)
    );
    expect(meadowGrassMat.uniforms.uFadeEnd.value).toBe(QUALITY_PRESETS.low.foliageFadeEnd);
    meadow.dispose();

    // 3. CosmicBlackHoleScene
    const cosmic = new CosmicBlackHoleScene();
    await cosmic.init({} as THREE.WebGLRenderer, cam);
    const cosmicHigh = cosmic.getPerfMetrics();
    cosmic.setQualityTier('low');
    const cosmicLow = cosmic.getPerfMetrics();
    expect(cosmicLow.activeShadowCasterTriangles).toBeLessThanOrEqual(
      cosmicHigh.activeShadowCasterTriangles
    );
    cosmic.dispose();

    // 4. MistyForestScene
    const misty = new MistyForestScene();
    await misty.init({} as THREE.WebGLRenderer, cam);
    const mistyMetrics = misty.getPerfMetrics();
    expect(mistyMetrics.managedPointLightsTotal).toBeGreaterThanOrEqual(14);
    expect(mistyMetrics.pooledPointLightsCount).toBeLessThanOrEqual(
      QUALITY_PRESETS.high.maxActivePointLights
    );
    misty.setQualityTier('low');
    expect(misty.getQualityTier()).toBe('low');
    expect(misty.getPerfMetrics().totalTriangles).toBeLessThan(mistyMetrics.totalTriangles);
    misty.dispose();

    // 5. ParadiseScene
    const paradise = new ParadiseScene();
    await paradise.init({} as THREE.WebGLRenderer, cam);
    const paradiseHigh = paradise.getPerfMetrics();
    paradise.setQualityTier('low');
    expect(paradise.getQualityTier()).toBe('low');
    expect(paradise.getPerfMetrics().totalTriangles).toBeLessThan(paradiseHigh.totalTriangles);
    paradise.dispose();

    // 6. GhibliValleyScene
    const ghibli = new GhibliValleyScene();
    await ghibli.init({} as THREE.WebGLRenderer, cam);
    const ghibliHigh = ghibli.getPerfMetrics();
    expect(ghibliHigh.frustumCulledOffCount).toBeLessThan(60);
    const ghibliGrass = ghibli
      .getScene()
      .getObjectByName('InstancedGhibliGrass') as THREE.InstancedMesh;
    const ghibliGrassMat = ghibliGrass.material as THREE.ShaderMaterial;
    const ghibliHighGrass = ghibliGrass.count;
    expect(ghibliGrassMat.uniforms.uFadeEnd.value).toBe(QUALITY_PRESETS.high.foliageFadeEnd);
    ghibli.setQualityTier('low');
    expect(ghibliGrass.count).toBe(
      Math.round(ghibliHighGrass * QUALITY_PRESETS.low.foliageDensityScale)
    );
    expect(ghibliGrassMat.uniforms.uFadeEnd.value).toBe(QUALITY_PRESETS.low.foliageFadeEnd);
    ghibli.dispose();
  }, 30000);
});
