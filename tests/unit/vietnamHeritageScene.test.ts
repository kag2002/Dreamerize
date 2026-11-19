import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  VietnamHeritageScene,
  getVietnamHeritageHeight,
  getVietnamHeritageNormal,
  getGoldenBridgeCurveAtX,
  VIETNAM_WATER_LEVEL
} from '../../src/client/scene/environments/VietnamHeritageScene';

describe('VietnamHeritageScene - Analytical Terrain Height h(x, z)', () => {
  it('evaluates deterministic heights for spawn terrace, courtyard, lakes, islet, Sapa & Hạ Long Bay', () => {
    const hSpawn = getVietnamHeritageHeight(0, 58);
    expect(hSpawn).toBeCloseTo(0.5, 2);

    const hCourtyard = getVietnamHeritageHeight(0, 0);
    expect(hCourtyard).toBeCloseTo(1.45, 2);

    // Formal Hồ Linh Chiểu & Hoàn Kiếm Lake basins sit beneath water level (y = 0.0)
    expect(getVietnamHeritageHeight(-48, 22)).toBeLessThan(VIETNAM_WATER_LEVEL - 0.5);
    expect(getVietnamHeritageHeight(64, 22)).toBeLessThan(VIETNAM_WATER_LEVEL - 0.5);

    // Turtle Tower Gò Rùa Islet rises cleanly above water at (52, 22)
    expect(getVietnamHeritageHeight(52, 22)).toBeGreaterThan(0.5);

    // Mù Cang Chải / Sapa western terraced rice hillside rises westward
    const hSapaLow = getVietnamHeritageHeight(-125, -40);
    const hSapaHigh = getVietnamHeritageHeight(-220, -40);
    expect(hSapaHigh).toBeGreaterThan(hSapaLow + 15.0);

    // Both Cầu Vàng mountain abutments rise to support the 150m bridge deck cleanly
    expect(getVietnamHeritageHeight(-75, -145)).toBeGreaterThan(19.0);
    expect(getVietnamHeritageHeight(75, -145)).toBeGreaterThan(19.0);

    // Northern Hạ Long Bay basin sits underwater
    expect(getVietnamHeritageHeight(0, -360)).toBeLessThan(-1.0);
    expect(getVietnamHeritageHeight(-120, -450)).toBeLessThan(-1.0);

    // Deterministic purity
    for (let i = 0; i < 500; i++) {
      expect(getVietnamHeritageHeight(12.5, -7.25)).toBe(getVietnamHeritageHeight(12.5, -7.25));
    }
  });

  it('guarantees finite values across both [-680, 680] and expanded [-2200, 2200] domains without NaN or Infinity', () => {
    for (let x = -680; x <= 680; x += 34) {
      for (let z = -680; z <= 680; z += 34) {
        const h = getVietnamHeritageHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(Number.isNaN(h)).toBe(false);
      }
    }
    for (let x = -2200; x <= 2200; x += 110) {
      for (let z = -2200; z <= 2200; z += 110) {
        const h = getVietnamHeritageHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(Number.isNaN(h)).toBe(false);
      }
    }
  });

  it('computes normalized surface normals and Golden Bridge curve points cleanly', () => {
    const normal = getVietnamHeritageNormal(0, 0);
    expect(normal).toBeInstanceOf(THREE.Vector3);
    expect(normal.length()).toBeCloseTo(1.0, 4);
    expect(normal.y).toBeGreaterThan(0.95);

    const midBridge = getGoldenBridgeCurveAtX(0);
    expect(midBridge.y).toBeGreaterThan(22.0);
    expect(midBridge.z).toBeLessThan(-145.0);
  });

  it('evaluates 100,000 terrain samples in under 50ms', () => {
    const t0 = performance.now();
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += getVietnamHeritageHeight(((i * 7) % 1360) - 680, ((i * 13) % 1360) - 680);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
    expect(Number.isFinite(sum)).toBe(true);
  });
});

describe('VietnamHeritageScene - Scene Graph Landmarks & Instancing', () => {
  it('initializes all iconic Vietnamese heritage landmarks & living nature systems', async () => {
    const scene = new VietnamHeritageScene();
    expect(scene.slug).toBe('vietnam-heritage');
    expect(scene.name).toBe('Việt Nam Kỳ Vĩ — Danh Thắng Di Sản');

    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());
    const threeScene = scene.getScene();

    expect(threeScene.getObjectByName('SkyDome')).toBeDefined();
    expect(threeScene.getObjectByName('VietnamHeritageTerrain')).toBeDefined();
    expect(threeScene.getObjectByName('HaLongAndLotusWater')).toBeDefined();
    expect(threeScene.getObjectByName('KhueVanCacComplex')).toBeDefined();
    expect(threeScene.getObjectByName('DongSonPlazaMedallion')).toBeDefined();
    expect(threeScene.getObjectByName('OnePillarPagodaComplex')).toBeDefined();
    expect(threeScene.getObjectByName('TurtleTowerIslet')).toBeDefined();
    expect(threeScene.getObjectByName('GoldenBridgeComplex')).toBeDefined();
    expect(threeScene.getObjectByName('GoldenBridgeGiantHands')).toBeDefined();
    expect(threeScene.getObjectByName('HaLongBayComplex')).toBeDefined();
    expect(threeScene.getObjectByName('HaLongJunkBoat_1')).toBeDefined();
    expect(threeScene.getObjectByName('HaLongJunkBoat_2')).toBeDefined();
    expect(threeScene.getObjectByName('HaLongJunkBoat_3')).toBeDefined();
    expect(threeScene.getObjectByName('SapaTerracedRiceFields')).toBeDefined();
    expect(threeScene.getObjectByName('InstancedBambooCulms')).toBeDefined();
    expect(threeScene.getObjectByName('InstancedBambooLeaves')).toBeDefined();
    expect(threeScene.getObjectByName('InstancedGrass')).toBeDefined();
    expect(threeScene.getObjectByName('GoldenHeritageMotes')).toBeDefined();
    expect(threeScene.getObjectByName('SoaringWhiteEgrets')).toBeDefined();

    const lotusLeaves = threeScene.getObjectByName('InstancedLotusLeaves') as THREE.InstancedMesh;
    expect(lotusLeaves.isInstancedMesh).toBe(true);
    expect(lotusLeaves.count).toBeGreaterThanOrEqual(320);

    const lotusFlowers = threeScene.getObjectByName('InstancedLotusFlowers') as THREE.InstancedMesh;
    expect(lotusFlowers.isInstancedMesh).toBe(true);
    expect(lotusFlowers.count).toBeGreaterThanOrEqual(100);

    const riceStalks = threeScene.getObjectByName('InstancedSapaRiceStalks') as THREE.InstancedMesh;
    expect(riceStalks.isInstancedMesh).toBe(true);
    expect(riceStalks.count).toBeGreaterThanOrEqual(4000);

    const egrets = threeScene.getObjectByName('SoaringWhiteEgrets') as THREE.InstancedMesh;
    expect(egrets.count).toBe(24);

    // Verify all 24 regional 3-Region Vietnam landmark groups exist
    const regionalGroups = [
      // North (5 new)
      'HoangThanhThangLongComplex',
      'LungCuFlagpoleComplex',
      'FansipanSummitComplex',
      'ChuaHuongComplex',
      'DenHungComplex',
      // Central & Highlands (9 new)
      'HueImperialCitadelComplex',
      'HoiAnAncientTownComplex',
      'DragonBridgeDaNangComplex',
      'SonDoongCaveComplex',
      'PhongNhaGrottoComplex',
      'MySonSanctuaryComplex',
      'PoshanuTowerComplex',
      'DaLatLangbiangComplex',
      'BienHoTNungComplex',
      // South & Islands (10 new)
      'BenThanhMarketComplex',
      'IndependencePalaceComplex',
      'NotreDameSaigonComplex',
      'CuChiTunnelsComplex',
      'PoNagarNhaTrangComplex',
      'CaiRangFloatingMarketComplex',
      'TraSuMelaleucaForestComplex',
      'MuiCaMauComplex',
      'PhuQuocIslandComplex',
      'ConDaoIslandComplex',
      // Vietnam Reference Spec Upgrades (01-09)
      'TrangAnGoldenRiceKarst',
      'HoiAnLanternCanopy',
      'HoiAnSkyLanterns',
      'HoiAnPavilionGates',
      'HoaiRiverFlowerLanterns',
      'HueThaiHoaThroneHall',
      'HuePalaceLanterns',
      'PlazaSacredLotus',
      'LotusColumnArcade',
      'LangCoBanyanVillage',
      'LangCoBanyanHero',
      'LangCoLateriteWalls',
      'LangCoVillageGate',
      'LacquerKarstGarden',
      'DragonBridgeFireShow',
      'FestivalNonQuaiThaoDrift',
      'FestivalTuongVanClouds',
      'TayNguyenBrocadeBanners',
      'DongSonDrumReplica',
      'MekongBananaGarden',
      'NipaThatchPavilion',
      'DenHungHeroicCliffRelief',
      'HoangThanhMemoryGallery',
      'VietnamFestivalLightBeams',
      'VietnamMonsoonRainSystem',
      'DienBienMountainBastion',
      'BachDangNavalFleet',
      // Outer Grand Cultural Sanctuaries (v2.0 4800m × 4800m Macro Expansion)
      'TamCocMacroKarstValley',
      'HoiAnGrandLanternQuarter',
      'HoaiRiverNightPromenade',
      'HueGrandImperialPalace',
      'DaiLienHoaLotusSanctuary',
      'DuongLamAncientVillageMacro',
      'LongVanLacquerValleyMacro',
      'DongSonSunSanctuaryMacro',
      'TayNguyenBrocadeSanctuaryMacro',
      'DatNuocHeroicCanyonMacro',
      'HistoricalMemoryColonnadeMacro',
      'TruongSonMonsoonJungleGorge',
      'DienBienHighlandCitadelMacro',
      'BachDangGrandArmadaMacro'
    ];
    for (const groupName of regionalGroups) {
      const grp = threeScene.getObjectByName(groupName);
      expect(grp, `Missing landmark group: ${groupName}`).toBeDefined();
    }

    // Verify zero NaN vertices or bounding spheres across entire 3-Region scene graph
    threeScene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const pos = mesh.geometry?.attributes?.position;
        if (pos) {
          const arr = pos.array as ArrayLike<number>;
          for (let i = 0; i < arr.length; i++) {
            if (!Number.isFinite(arr[i])) {
              throw new Error(`Non-finite vertex coordinate in mesh "${mesh.name}" at index ${i}`);
            }
          }
          mesh.geometry.computeBoundingSphere();
          expect(Number.isFinite(mesh.geometry.boundingSphere?.radius)).toBe(true);
        }
      }
    });

    scene.dispose();
  }, 15000);
});

describe('VietnamHeritageScene - Navigation, Spawn & POIs', () => {
  it('returns spawn point matched to getVietnamHeritageHeight(0, 58) + 1.7', async () => {
    const scene = new VietnamHeritageScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());

    const spawn = scene.getSpawnPoint();
    expect(spawn.position.x).toBe(0);
    expect(spawn.position.z).toBe(58);
    expect(spawn.position.y).toBeCloseTo(getVietnamHeritageHeight(0, 58) + 1.7, 2);
    expect(spawn.position.y).toBeCloseTo(2.2, 2);
    expect(spawn.lookAt.z).toBeLessThan(0);

    scene.dispose();
  });

  it('returns expanded 3-region panorama wander bounds (radius 1450m centered at origin)', async () => {
    const scene = new VietnamHeritageScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());

    const bounds = scene.getWanderBounds();
    expect(bounds.radius).toBe(1450);
    expect(bounds.center.length()).toBe(0);

    scene.dispose();
  });

  it('exposes all 45 designated scenic POIs (15 North, 15 Central, 15 South) above terrain & water', async () => {
    const scene = new VietnamHeritageScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());

    const pois = scene.getPointsOfInterest() as Array<{
      name: string;
      region?: string;
      position: THREE.Vector3;
      lookAt?: THREE.Vector3;
      dwellTime: number;
    }>;
    expect(pois.length).toBe(45);

    const names = pois.map((p) => p.name);
    expect(names).toContain('Khue Van Cac Courtyard');
    expect(names).toContain('One Pillar Pagoda & Lotus Lake');
    expect(names).toContain('Turtle Tower Islet');
    expect(names).toContain('Golden Bridge & Giant Hands Vista');
    expect(names).toContain('Ha Long Bay & Rice Terraces Overlook');

    const regionCounts = new Map<string, number>();
    for (const poi of pois) {
      expect(poi.region).toBeDefined();
      regionCounts.set(poi.region!, (regionCounts.get(poi.region!) ?? 0) + 1);
      expect(poi.dwellTime).toBeGreaterThanOrEqual(7.0);
      expect(poi.position.y).toBeGreaterThan(getVietnamHeritageHeight(poi.position.x, poi.position.z));
      expect(poi.position.y).toBeGreaterThan(VIETNAM_WATER_LEVEL);
      expect(Math.hypot(poi.position.x, poi.position.z)).toBeLessThan(1450);
      expect(poi.lookAt).toBeInstanceOf(THREE.Vector3);
      expect(Number.isFinite(poi.lookAt!.x)).toBe(true);
      expect(Number.isFinite(poi.lookAt!.y)).toBe(true);
      expect(Number.isFinite(poi.lookAt!.z)).toBe(true);
    }

    expect(regionCounts.get('I. Miền Bắc')).toBe(15);
    expect(regionCounts.get('II. Miền Trung & Tây Nguyên')).toBe(15);
    expect(regionCounts.get('III. Miền Nam & Hải Đảo')).toBe(15);

    scene.dispose();
  });
});

describe('VietnamHeritageScene - Reactivity & Deterministic Disposal', () => {
  it('advances shader uniforms, reacts to audio energy, and updates config cleanly', async () => {
    const scene = new VietnamHeritageScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());

    scene.update(0.016, 12.5);
    const sky = scene.getScene().getObjectByName('SkyDome') as THREE.Mesh;
    const skyMat = sky.material as THREE.ShaderMaterial;
    expect(skyMat.uniforms.uTime.value).toBe(12.5);

    const water = scene.getScene().getObjectByName('HaLongAndLotusWater') as THREE.Mesh;
    const waterMat = water.material as THREE.ShaderMaterial;
    expect(waterMat.uniforms.uTime.value).toBe(12.5);

    const caiRangBoat = scene.getScene().getObjectByName('CaiRangMarketBoat_1');
    expect(caiRangBoat).toBeDefined();
    expect(Math.abs(caiRangBoat!.rotation.y - 1.45)).toBeLessThan(0.1);

    scene.setAudioEnergy(0.75, 0.5, 0.6);
    expect(skyMat.uniforms.uBassEnergy.value).toBe(0.75);
    expect(waterMat.uniforms.uTrebleEnergy.value).toBe(0.6);

    scene.setAtmosphereState({ timeOfDay: 22, weather: 'clear' });
    expect(scene.getScene().getObjectByName('VietnamFestivalLightBeams')?.visible).toBe(true);
    expect(scene.getScene().getObjectByName('VietnamMonsoonRainSystem')?.visible).toBe(false);

    scene.setAtmosphereState({ timeOfDay: 16, weather: 'rain' });
    expect(scene.getScene().getObjectByName('VietnamMonsoonRainSystem')?.visible).toBe(true);
    expect(scene.getScene().getObjectByName('VietnamFestivalLightBeams')?.visible).toBe(false);

    scene.updateConfig({
      fog: { type: 'exp2', color: '#ffe5c4', density: 0.0009 },
      wind: { speed: 3.4, direction: [1, 0, 0], gustiness: 0.7, swayIntensity: 1.1 }
    });
    const fog = scene.getScene().fog as THREE.FogExp2;
    expect(fog.density).toBe(0.0009);

    scene.dispose();
  });

  it('completely disposes all GPU resources and supports clean re-initialization', async () => {
    const scene = new VietnamHeritageScene();
    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());
    expect(scene.getScene().children.length).toBeGreaterThan(0);

    scene.dispose();
    expect(scene.getScene().children.length).toBe(0);
    expect(() => scene.dispose()).not.toThrow();

    await scene.init({} as THREE.WebGLRenderer, new THREE.PerspectiveCamera());
    expect(scene.getScene().children.length).toBeGreaterThan(0);
    scene.dispose();
    expect(scene.getScene().children.length).toBe(0);
  });
});
