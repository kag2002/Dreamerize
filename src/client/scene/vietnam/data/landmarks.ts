import type { ExclusionCircle } from '../../environments/vietnamGeometryHelpers';
import type { LandmarkSpec, PoiSpec } from '../core/types';

/**
 * Canonical 33 autonomous camera wander waypoints across all 3 regions + macro sanctuaries.
 * Single source of truth consumed by VietnamHeritageScene camera config.
 */
export const VIETNAM_WANDER_WAYPOINTS: ReadonlyArray<[number, number, number]> = [
  [0, 3.8, 58],
  [0, 6.0, 22],
  [-32, 6.0, 22],
  [35, 6.0, 22],
  [0, 12.0, -40],
  [0, 26.0, -96],
  [-158, 22.0, -172],
  [-355, 52.0, -310],
  [380, 82.0, -308],
  [178, 12.0, -138],
  [-132, 12.0, 42],
  [175, 10.0, 86],
  [335, 18.0, 28],
  [-108, 12.0, 132],
  [0, 14.0, 178],
  [108, 16.0, 130],
  [-72, 10.0, 330],
  [18, 12.0, 445],
  [305, 16.0, 462],
  [680, 12.0, -175],
  [640, 8.0, 206],
  [705, 8.0, 318],
  [-646, 8.0, 80],
  [0, 10.0, -494],
  [-640, 10.0, -108],
  [820, 14.0, 42],
  [-680, 12.0, 438],
  [-840, 20.0, 198],
  [-560, 28.0, -562],
  [0, 10.0, -274],
  [740, 16.0, -432],
  [-820, 38.0, -422],
  [-240, 14.0, -618]
];

/**
 * Canonical plaza & waterfront exclusion halos preventing wild foliage / rice stalks from clipping plazas.
 * Unifies the Mũi Cà Mau exclusion radius to 34m across core and South builders.
 */
export const VIETNAM_PLAZA_EXCLUSION_HALOS: ReadonlyArray<ExclusionCircle> = [
  { x: -185, z: 42, r: 40.0 },
  { x: -136, z: 42, r: 18.0 },
  { x: 175, z: 45, r: 38.0 },
  { x: -108, z: 190, r: 48.0 },
  { x: 0, z: 250, r: 56.0 },
  { x: 0, z: 195, r: 26.0 },
  { x: 108, z: 190, r: 48.0 },
  { x: 108, z: 146, r: 14.0 },
  { x: -72, z: 336, r: 18.0 },
  { x: 0, z: 475, r: 34.0 },
  { x: -335, z: 515, r: 42.0 },
  { x: 335, z: 510, r: 42.0 }
];

/**
 * All 45 scenic POIs (15 Miền Bắc, 15 Miền Trung & Tây Nguyên, 15 Miền Nam & Hải Đảo).
 */
export const VIETNAM_POI_SPECS: ReadonlyArray<PoiSpec> = [
  // I. Miền Bắc (15)
  {
    name: 'Khue Van Cac Courtyard',
    region: 'I. Miền Bắc',
    x: 0.0,
    z: 14.0,
    elevationOffset: 2.4,
    lookAt: [0.0, 5.8, 0.0],
    dwellTime: 9.0
  },
  {
    name: 'One Pillar Pagoda & Lotus Lake',
    region: 'I. Miền Bắc',
    x: -32.0,
    z: 22.0,
    elevationOffset: 3.2,
    lookAt: [-48.0, 4.2, 22.0],
    dwellTime: 10.0
  },
  {
    name: 'Turtle Tower Islet',
    region: 'I. Miền Bắc',
    x: 35.0,
    z: 22.0,
    elevationOffset: 3.2,
    lookAt: [52.0, 4.8, 22.0],
    dwellTime: 9.0
  },
  {
    name: 'Ha Long Bay & Rice Terraces Overlook',
    region: 'I. Miền Bắc',
    x: 0.0,
    z: -255.0,
    elevationOffset: 22.0,
    lookAt: [0.0, 18.0, -450.0],
    dwellTime: 10.0
  },
  {
    name: 'Ruộng bậc thang Mù Cang Chải',
    region: 'I. Miền Bắc',
    x: -118.0,
    z: -32.0,
    elevationOffset: 14.0,
    lookAt: [-225.0, 20.0, -48.0],
    dwellTime: 9.0
  },
  {
    name: 'Hoàng Thành Thăng Long',
    region: 'I. Miền Bắc',
    x: 0.0,
    z: -40.0,
    elevationOffset: 4.5,
    lookAt: [0.0, 7.5, -68.0],
    dwellTime: 9.0
  },
  {
    name: 'Cột cờ Lũng Cú — Hà Giang',
    region: 'I. Miền Bắc',
    x: -355.0,
    z: -310.0,
    elevationOffset: 38.0,
    lookAt: [-380.0, 62.0, -340.0],
    dwellTime: 9.5
  },
  {
    name: 'Đỉnh Fansipan — Nóc nhà Đông Dương',
    region: 'I. Miền Bắc',
    x: 380.0,
    z: -308.0,
    elevationOffset: 12.0,
    lookAt: [400.0, 79.0, -330.0],
    dwellTime: 10.0
  },
  {
    name: 'Chùa Hương & Suối Yến',
    region: 'I. Miền Bắc',
    x: 178.0,
    z: -138.0,
    elevationOffset: 7.5,
    lookAt: [208.0, 9.0, -185.0],
    dwellTime: 9.0
  },
  {
    name: 'Đền Hùng — Núi Nghĩa Lĩnh',
    region: 'I. Miền Bắc',
    x: -158.0,
    z: -172.0,
    elevationOffset: 14.0,
    lookAt: [-195.0, 28.0, -210.0],
    dwellTime: 9.0
  },
  {
    name: 'Thung Lũng Lúa Vàng Tràng An',
    region: 'I. Miền Bắc',
    x: 120.0,
    z: -62.0,
    elevationOffset: 3.2,
    lookAt: [120.0, 28.0, -165.0],
    dwellTime: 9.0
  },
  {
    name: 'Tam Cốc — Bích Động Hoàng Hôn',
    region: 'I. Miền Bắc',
    x: 680.0,
    z: -175.0,
    elevationOffset: 4.5,
    lookAt: [680.0, 32.0, -410.0],
    dwellTime: 10.0
  },
  {
    name: 'Làng Cổ Đường Lâm — Cây Đa Nghìn Năm',
    region: 'I. Miền Bắc',
    x: -640.0,
    z: -108.0,
    elevationOffset: 2.5,
    lookAt: [-640.0, 8.5, -196.0],
    dwellTime: 9.5
  },
  {
    name: 'Cứ Điểm Điện Biên Phủ — Đồi A1',
    region: 'I. Miền Bắc',
    x: -820.0,
    z: -422.0,
    elevationOffset: 3.8,
    lookAt: [-820.0, 44.0, -545.0],
    dwellTime: 9.5
  },
  {
    name: 'Đại Thuỷ Chiến Sông Bạch Đằng',
    region: 'I. Miền Bắc',
    x: -240.0,
    z: -618.0,
    elevationOffset: 5.2,
    lookAt: [-240.0, 15.0, -780.0],
    dwellTime: 10.0
  },

  // II. Miền Trung & Tây Nguyên (15)
  {
    name: 'Golden Bridge & Giant Hands Vista',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 0.0,
    z: -96.0,
    elevationOffset: 20.0,
    minY: 22.0,
    lookAt: [0.0, 22.0, -155.0],
    dwellTime: 11.0
  },
  {
    name: 'Cố đô Huế — Ngọ Môn',
    region: 'II. Miền Trung & Tây Nguyên',
    x: -108.0,
    z: 42.0,
    elevationOffset: 12.0,
    lookAt: [-178.0, 13.5, 42.0],
    dwellTime: 9.5
  },
  {
    name: 'Phố cổ Hội An & Chùa Cầu',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 175.0,
    z: 88.0,
    elevationOffset: 6.5,
    lookAt: [175.0, 4.5, 45.0],
    dwellTime: 9.5
  },
  {
    name: 'Cầu Rồng — Đà Nẵng',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 450.0,
    z: 12.0,
    elevationOffset: 14.5,
    lookAt: [385.0, 15.5, -35.0],
    dwellTime: 9.0
  },
  {
    name: 'Hang Sơn Đoòng — Quảng Bình',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 338.0,
    z: -205.0,
    elevationOffset: 5.5,
    lookAt: [372.0, 16.0, -205.0],
    dwellTime: 10.0
  },
  {
    name: 'Động Phong Nha — Kẻ Bàng',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 275.0,
    z: -210.0,
    elevationOffset: 6.5,
    lookAt: [275.0, 9.0, -255.0],
    dwellTime: 9.0
  },
  {
    name: 'Thánh địa Mỹ Sơn — Quảng Nam',
    region: 'II. Miền Trung & Tây Nguyên',
    x: -292.0,
    z: -110.0,
    elevationOffset: 11.5,
    lookAt: [-322.0, 11.5, -135.0],
    dwellTime: 9.0
  },
  {
    name: 'Tháp Chàm Poshanư — Phan Thiết',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 458.0,
    z: 95.0,
    elevationOffset: 7.5,
    lookAt: [435.0, 26.5, 95.0],
    dwellTime: 8.5
  },
  {
    name: 'Thung lũng Tình Yêu & Langbiang — Đà Lạt',
    region: 'II. Miền Trung & Tây Nguyên',
    x: -348.0,
    z: 165.0,
    elevationOffset: 6.5,
    lookAt: [-375.0, 39.0, 165.0],
    dwellTime: 9.0
  },
  {
    name: "Biển hồ T'Nưng — Pleiku",
    region: 'II. Miền Trung & Tây Nguyên',
    x: -382.0,
    z: 76.0,
    elevationOffset: 28.0,
    lookAt: [-432.0, 12.0, 42.0],
    dwellTime: 9.0
  },
  {
    name: 'Đại Nội Huế — Điện Thái Hòa',
    region: 'II. Miền Trung & Tây Nguyên',
    x: -646.0,
    z: 80.0,
    elevationOffset: 2.2,
    lookAt: [-692.0, 4.2, 80.0],
    dwellTime: 10.0
  },
  {
    name: 'Quảng Trường Hội Quán & Đèn Lồng Hội An',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 640.0,
    z: 206.0,
    elevationOffset: 2.5,
    lookAt: [640.0, 5.8, 128.0],
    dwellTime: 9.5
  },
  {
    name: 'Bến Sông Hoài Đêm Hoa Đăng',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 705.0,
    z: 318.0,
    elevationOffset: 3.0,
    lookAt: [775.0, 3.2, 248.0],
    dwellTime: 9.5
  },
  {
    name: 'Thung Lũng Sơn Mài Long Vân — Rồng Đại Việt',
    region: 'II. Miền Trung & Tây Nguyên',
    x: 820.0,
    z: 42.0,
    elevationOffset: 4.5,
    lookAt: [820.0, 18.0, -96.0],
    dwellTime: 10.0
  },
  {
    name: 'Không Gian Thổ Cẩm Tây Nguyên & Vòm Nón Lá',
    region: 'II. Miền Trung & Tây Nguyên',
    x: -840.0,
    z: 198.0,
    elevationOffset: 2.8,
    lookAt: [-840.0, 26.0, 106.0],
    dwellTime: 9.5
  },

  // III. Miền Nam & Hải Đảo (15)
  {
    name: 'Chợ Bến Thành — TP. Hồ Chí Minh',
    region: 'III. Miền Nam & Hải Đảo',
    x: -108.0,
    z: 120.0,
    elevationOffset: 8.5,
    lookAt: [-108.0, 14.0, 190.0],
    dwellTime: 9.0
  },
  {
    name: 'Dinh Độc Lập — TP. Hồ Chí Minh',
    region: 'III. Miền Nam & Hải Đảo',
    x: 0.0,
    z: 145.0,
    elevationOffset: 9.0,
    lookAt: [0.0, 12.5, 225.0],
    dwellTime: 9.5
  },
  {
    name: 'Nhà thờ Đức Bà — Sài Gòn',
    region: 'III. Miền Nam & Hải Đảo',
    x: 116.0,
    z: 84.0,
    elevationOffset: 12.0,
    lookAt: [108.0, 26.0, 178.0],
    dwellTime: 9.5
  },
  {
    name: 'Địa đạo Củ Chi',
    region: 'III. Miền Nam & Hải Đảo',
    x: -262.0,
    z: 240.0,
    elevationOffset: 8.5,
    lookAt: [-254.0, 8.5, 270.0],
    dwellTime: 8.5
  },
  {
    name: 'Tháp Bà Ponagar — Nha Trang',
    region: 'III. Miền Nam & Hải Đảo',
    x: 232.0,
    z: 232.0,
    elevationOffset: 22.0,
    lookAt: [265.0, 24.0, 275.0],
    dwellTime: 9.5
  },
  {
    name: 'Chợ nổi Cái Răng — Cần Thơ',
    region: 'III. Miền Nam & Hải Đảo',
    x: -72.0,
    z: 330.0,
    elevationOffset: 7.5,
    lookAt: [-72.0, 2.5, 365.0],
    dwellTime: 9.5
  },
  {
    name: 'Rừng tràm Trà Sư — An Giang',
    region: 'III. Miền Nam & Hải Đảo',
    x: -198.0,
    z: 398.5,
    elevationOffset: 5.5,
    lookAt: [-245.0, 3.8, 395.0],
    dwellTime: 9.0
  },
  {
    name: 'Mũi Cà Mau — Cực Nam Tổ Quốc',
    region: 'III. Miền Nam & Hải Đảo',
    x: 24.0,
    z: 439.0,
    elevationOffset: 9.5,
    lookAt: [0.0, 9.0, 482.0],
    dwellTime: 9.5
  },
  {
    name: 'Đảo Ngọc Phú Quốc',
    region: 'III. Miền Nam & Hải Đảo',
    x: -292.0,
    z: 412.0,
    elevationOffset: 14.0,
    lookAt: [-335.0, 5.5, 476.0],
    dwellTime: 9.5
  },
  {
    name: 'Côn Đảo — Vịnh Côn Sơn',
    region: 'III. Miền Nam & Hải Đảo',
    x: 278.0,
    z: 432.0,
    elevationOffset: 13.0,
    lookAt: [325.0, 9.0, 480.0],
    dwellTime: 9.5
  },
  {
    name: 'Liên Hoa Bạch Ngọc Đài — Sen Hồng',
    region: 'III. Miền Nam & Hải Đảo',
    x: 0.0,
    z: -494.0,
    elevationOffset: 2.8,
    lookAt: [0.0, 5.2, -562.0],
    dwellTime: 10.0
  },
  {
    name: 'Quảng Trường Trống Đồng & Vườn Chuối Lạc Việt',
    region: 'III. Miền Nam & Hải Đảo',
    x: -680.0,
    z: 438.0,
    elevationOffset: 2.8,
    lookAt: [-680.0, 9.5, 385.0],
    dwellTime: 9.5
  },
  {
    name: 'Đại Tượng Đài Đất Nước — Trường Sơn',
    region: 'III. Miền Nam & Hải Đảo',
    x: -560.0,
    z: -562.0,
    elevationOffset: 4.2,
    lookAt: [-560.0, 29.0, -680.0],
    dwellTime: 10.0
  },
  {
    name: 'Quảng Trường Ký Ức Lịch Sử 35mm',
    region: 'III. Miền Nam & Hải Đảo',
    x: 0.0,
    z: -274.0,
    elevationOffset: 2.6,
    lookAt: [0.0, 6.2, -338.0],
    dwellTime: 9.5
  },
  {
    name: 'Hẻm Núi Trường Sơn Mùa Mưa Bão',
    region: 'III. Miền Nam & Hải Đảo',
    x: 740.0,
    z: -432.0,
    elevationOffset: 5.8,
    lookAt: [740.0, 22.0, -595.0],
    dwellTime: 9.5
  }
];

/**
 * Canonical Landmark catalog binding group names, regions, coordinates, and culling radii.
 */
export const VIETNAM_LANDMARK_SPECS: ReadonlyArray<LandmarkSpec> = [
  // Core landmarks
  { id: 'north.khue-van-cac', groupName: 'KhueVanCacComplex', region: 'north', center: [0, 0], radius: 48 },
  { id: 'north.one-pillar', groupName: 'OnePillarPagodaComplex', region: 'north', center: [-48, 22], radius: 36 },
  { id: 'north.turtle-tower', groupName: 'TurtleTowerIslet', region: 'north', center: [52, 22], radius: 42 },
  { id: 'central.golden-bridge', groupName: 'GoldenBridgeComplex', region: 'central', center: [0, -155], radius: 95 },
  { id: 'north.ha-long', groupName: 'HaLongBayComplex', region: 'north', center: [0, -420], radius: 220 },

  // Regional North
  { id: 'north.hoang-thanh', groupName: 'HoangThanhThangLongComplex', region: 'north', center: [0, -76], radius: 55 },
  { id: 'north.lung-cu', groupName: 'LungCuFlagpoleComplex', region: 'north', center: [-380, -340], radius: 48 },
  { id: 'north.fansipan', groupName: 'FansipanSummitComplex', region: 'north', center: [400, -330], radius: 58 },
  { id: 'north.chua-huong', groupName: 'ChuaHuongComplex', region: 'north', center: [210, -185], radius: 55 },
  { id: 'north.den-hung', groupName: 'DenHungComplex', region: 'north', center: [-195, -210], radius: 58 },

  // Regional Central & Highlands
  { id: 'central.hue-citadel', groupName: 'HueImperialCitadelComplex', region: 'central', center: [-185, 42], radius: 68, exclusionRadius: 40 },
  { id: 'central.hoi-an', groupName: 'HoiAnAncientTownComplex', region: 'central', center: [175, 45], radius: 56, exclusionRadius: 38 },
  { id: 'central.dragon-bridge', groupName: 'DragonBridgeDaNangComplex', region: 'central', center: [335, -35], radius: 118 },
  { id: 'central.son-doong', groupName: 'SonDoongCaveComplex', region: 'central', center: [380, -205], radius: 82 },
  { id: 'central.phong-nha', groupName: 'PhongNhaGrottoComplex', region: 'central', center: [275, -255], radius: 54 },
  { id: 'central.my-son', groupName: 'MySonSanctuaryComplex', region: 'central', center: [-322, -135], radius: 56 },
  { id: 'central.poshanu', groupName: 'PoshanuTowerComplex', region: 'central', center: [435, 95], radius: 42 },
  { id: 'central.da-lat', groupName: 'DaLatLangbiangComplex', region: 'central', center: [-375, 165], radius: 62 },
  { id: 'central.bien-ho', groupName: 'BienHoTNungComplex', region: 'central', center: [-432, 42], radius: 75 },

  // Regional South & Islands
  { id: 'south.ben-thanh', groupName: 'BenThanhMarketComplex', region: 'south', center: [-108, 190], radius: 52, exclusionRadius: 48 },
  { id: 'south.independence-palace', groupName: 'IndependencePalaceComplex', region: 'south', center: [0, 250], radius: 66, exclusionRadius: 56 },
  { id: 'south.notre-dame', groupName: 'NotreDameSaigonComplex', region: 'south', center: [108, 190], radius: 52, exclusionRadius: 48 },
  { id: 'south.cu-chi', groupName: 'CuChiTunnelsComplex', region: 'south', center: [-254, 270], radius: 56 },
  { id: 'south.po-nagar', groupName: 'PoNagarNhaTrangComplex', region: 'south', center: [265, 275], radius: 48 },
  { id: 'south.cai-rang', groupName: 'CaiRangFloatingMarketComplex', region: 'south', center: [-72, 365], radius: 62 },
  { id: 'south.tra-su', groupName: 'TraSuMelaleucaForestComplex', region: 'south', center: [-245, 395], radius: 76 },
  { id: 'south.mui-ca-mau', groupName: 'MuiCaMauComplex', region: 'south', center: [0, 482], radius: 56, exclusionRadius: 34 },
  { id: 'south.phu-quoc', groupName: 'PhuQuocIslandComplex', region: 'south', center: [-335, 515], radius: 78, exclusionRadius: 42 },
  { id: 'south.con-dao', groupName: 'ConDaoIslandComplex', region: 'south', center: [335, 510], radius: 78, exclusionRadius: 42 },

  // Macro sanctuaries
  { id: 'macro.tam-coc', groupName: 'TamCocMacroKarstValley', region: 'macro', center: [680, -340], radius: 210 },
  { id: 'macro.hoi-an-quarter', groupName: 'HoiAnGrandLanternQuarter', region: 'macro', center: [640, 128], radius: 135 },
  { id: 'macro.hoai-river', groupName: 'HoaiRiverNightPromenade', region: 'macro', center: [775, 248], radius: 120 },
  { id: 'macro.hue-grand-palace', groupName: 'HueGrandImperialPalace', region: 'macro', center: [-692, 80], radius: 145 },
  { id: 'macro.dai-lien-hoa', groupName: 'DaiLienHoaLotusSanctuary', region: 'macro', center: [0, -562], radius: 110 },
  { id: 'macro.duong-lam', groupName: 'DuongLamAncientVillageMacro', region: 'macro', center: [-640, -196], radius: 130 },
  { id: 'macro.long-van', groupName: 'LongVanLacquerValleyMacro', region: 'macro', center: [820, -96], radius: 160 },
  { id: 'macro.dong-son-sun', groupName: 'DongSonSunSanctuaryMacro', region: 'macro', center: [-680, 385], radius: 135 },
  { id: 'macro.tay-nguyen-brocade', groupName: 'TayNguyenBrocadeSanctuaryMacro', region: 'macro', center: [-840, 106], radius: 140 },
  { id: 'macro.dat-nuoc', groupName: 'DatNuocHeroicCanyonMacro', region: 'macro', center: [-560, -680], radius: 165 },
  { id: 'macro.historical-memory', groupName: 'HistoricalMemoryColonnadeMacro', region: 'macro', center: [0, -338], radius: 95 },
  { id: 'macro.truong-son', groupName: 'TruongSonMonsoonJungleGorge', region: 'macro', center: [740, -595], radius: 195 },
  { id: 'macro.dien-bien', groupName: 'DienBienHighlandCitadelMacro', region: 'macro', center: [-820, -545], radius: 185 },
  { id: 'macro.bach-dang', groupName: 'BachDangGrandArmadaMacro', region: 'macro', center: [-240, -780], radius: 190 }
];
