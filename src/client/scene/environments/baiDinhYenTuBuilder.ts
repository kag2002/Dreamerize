import * as THREE from 'three';
import {
  VietnamBuilderContext,
  applyWorldBoxUV,
  createArchedWallGeometry,
  createGableRoofGeometry,
  createHaLongKarstGeometry,
  createHueImperialHipRoofGeometry,
  createIncenseSmokeSystem,
  createLanternCapGeometry,
  createLanternCoreGeometry,
  createNotchedLotusPadGeometry,
  createRibbedLanternShellGeometry,
  createSculptedRockGeometry,
  mulberry32
} from './vietnamGeometryHelpers';
import {
  createAncientStoneLanternParts,
  createBasReliefPanelParts,
  createBronzeBellParts,
  createGuardianBeastParts,
  createLotusPetalRingParts,
  createRoofFinialSetParts,
  createSculptedDeityParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  PartsBuilder,
  createMergedMesh,
  registerAnimatedUniform,
  transformGeometryXYZ
} from '../vietnam/geometry/PartsBuilder';

/**
 * Chùa Bái Đính – Cố Đô Hoa Lư (`BaiDinhHoaLuComplex` at `(460, -640)`) &
 * Núi Thiêng Yên Tử (`YenTuSacredMountainComplex` at `(240, -780)`) Builder.
 *
 * Implements 220 distinct architectural & cultural details (`BD-001..220`):
 *  - `BD-001..115` — Chùa Bái Đính (Tam Quan Nội, Giếng Ngọc, Tháp Chuông Bát Giác + 36-ton Đại Hồng Chung
 *    & Trống Đồng, Bảo Tháp Xá Lợi Phật 13 Tầng ~38.6m, Hai Dãy Hành Lang La Hán + 24 sculpted stone La Hán,
 *    Điện Pháp Chủ & Điện Tam Thế upper sanctuaries) & Cố Đô Hoa Lư (Ninh Bình karst backdrop, Sông Sào Khê,
 *    Cầu Đá Đông, Cổng Ngọ Môn Ngoại, Đền Vua Đinh Tiên Hoàng, Đền Vua Lê Đại Hành, twin Long Sàng Đá,
 *    guardian Nghê & 5-color Hoa Lư banners).
 *  - `BD-116..220` — Núi Thiêng Yên Tử (~34.2m rising sacred granite summit & stepped cliff ledges,
 *    Suối Giải Oan, Cầu Đá Giải Oan, Đường Tùng Cổ 700 Năm Xích Tùng & Trúc Vàng, Vườn Tháp Tổ Huệ Quang
 *    9-tier stupa + 12 funerary stupas, Chùa Hoa Yên & ancient Đại frangipani trees, Quảng Trường Phật Hoàng
 *    Trần Nhân Tông monumental bronze statue on Trần-wave lotus pedestal, and 100% cast-bronze & gold
 *    Chùa Đồng — Thiên Trúc Tự at the summit apex with bronze bell, khánh đồng & 1.068m elevation stele).
 *
 * Strict Budget & Zero-Defect Guarantees:
 *  - <= 50,000 total triangles across both complexes.
 *  - ZERO new `MeshStandardMaterial` allocations (reuses ONLY `ctx.materials.*`).
 *  - `castShadow = true` ONLY on the 5 hero architectural/mountain meshes.
 *  - Every column embedded `-0.15m`, every roof & finial flush, `-4.5m..6.5m` deep retaining skirts.
 */

export interface BaiDinhYenTuBuildResult {
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
}

const BAI_DINH_HOA_LU_MOTIF_IDS: readonly string[] = Array.from(
  { length: 115 },
  (_, i) => `BD-${String(i + 1).padStart(3, '0')}`
);

const YEN_TU_MOTIF_IDS: readonly string[] = Array.from(
  { length: 105 },
  (_, i) => `BD-${String(i + 116).padStart(3, '0')}`
);

function registerUniform(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  u: { uTime: { value: number }; uWindSpeed?: { value: number } }
): void {
  registerAnimatedUniform(ctx.animatedUniforms, flagUniforms, u, true);
}

function addIncenseSmoke(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  group: THREE.Group,
  sources: Array<{ x: number; y: number; z: number; scale?: number }>,
  name: string
): void {
  if (sources.length === 0) return;
  const smoke = createIncenseSmokeSystem(sources, ctx.sharedShaders?.incenseSmoke);
  smoke.mesh.name = name;
  smoke.mesh.castShadow = false;
  group.add(smoke.mesh);
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(smoke.mesh.material as THREE.Material);
    registerUniform(ctx, flagUniforms, smoke.uniforms);
  }
}

function emitBuilderMesh(
  group: THREE.Group,
  builder: PartsBuilder,
  material: THREE.Material,
  name: string,
  castShadow = false,
  receiveShadow = true,
  worldUvMeters?: number
): THREE.Mesh | null {
  if (builder.length === 0) return null;
  const raw = builder.rawParts();
  const mesh = createMergedMesh(name, raw, material, castShadow, receiveShadow);
  raw.length = 0;
  if (worldUvMeters && worldUvMeters > 0) {
    applyWorldBoxUV(mesh.geometry, worldUvMeters);
  }
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

function sampleTerrainRange(
  ctx: VietnamBuilderContext,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  step = 6
): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  const sx0 = Math.min(x0, x1);
  const sx1 = Math.max(x0, x1);
  const sz0 = Math.min(z0, z1);
  const sz1 = Math.max(z0, z1);
  for (let x = sx0; x <= sx1 + 0.01; x += step) {
    const cx = Math.min(x, sx1);
    for (let z = sz0; z <= sz1 + 0.01; z += step) {
      const cz = Math.min(z, sz1);
      const h = ctx.getHeight(cx, cz);
      if (h < minY) minY = h;
      if (h > maxY) maxY = h;
    }
  }
  if (!Number.isFinite(minY)) {
    const fallback = ctx.getHeight((sx0 + sx1) * 0.5, (sz0 + sz1) * 0.5);
    return { minY: fallback, maxY: fallback };
  }
  return { minY, maxY };
}

/**
 * Adds a grounded stone terrace slab with a deep retaining skirt (`>= 4.8m` below lowest terrain),
 * molded coping rim, and optional Bát Tràng / granite paving pad.
 */
function addGroundedTerrace(
  stonePb: PartsBuilder,
  capPb: PartsBuilder,
  ctx: VietnamBuilderContext,
  cx: number,
  cz: number,
  width: number,
  depth: number,
  topY: number,
  skirtExtra = 5.0,
  paveInset = 0.7
): { botY: number } {
  const { minY } = sampleTerrainRange(
    ctx,
    cx - width * 0.5,
    cx + width * 0.5,
    cz - depth * 0.5,
    cz + depth * 0.5,
    6
  );
  const botY = Math.min(topY - 2.2, minY - skirtExtra);
  const totalH = Math.max(1.2, topY - botY);
  stonePb.box(width, totalH, depth, cx, botY + totalH * 0.5, cz);
  // Molded upper coping cornice lip
  capPb.box(width + 0.36, 0.22, depth + 0.36, cx, topY - 0.11, cz);
  // Subtle raised courtyard paving field (flush top at topY + 0.03)
  if (width > paveInset * 2 + 1 && depth > paveInset * 2 + 1) {
    capPb.box(width - paveInset * 2, 0.06, depth - paveInset * 2, cx, topY + 0.03, cz);
  }
  return { botY };
}

/**
 * Crisp low-poly carved lotus newel post (`42 triangles`) for stairs & terrace balustrades.
 */
function addCrispLotusPost(
  pb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  pb.box(0.28 * s, 0.16 * s, 0.28 * s, x, y + 0.08 * s, z);
  pb.cyl(0.16 * s, 0.11 * s, 0.14 * s, 5, x, y + 0.22 * s, z);
  pb.cone(0.15 * s, 0.28 * s, 5, x, y + 0.42 * s, z);
}

/**
 * Crisp low-poly Vietnamese carved stone balustrade (`~48 triangles` per span) with top/bottom rails,
 * rhythmic lotus-capped piers, and recessed panel bars.
 */
function addCrispStoneBalustrade(
  pb: PartsBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  height = 0.90
): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.3) return;
  const yaw = Math.atan2(dx, dz);
  const mx = (x0 + x1) * 0.5;
  const mz = (z0 + z1) * 0.5;
  pb.box(0.18, 0.14, len, mx, y + height - 0.07, mz, { ry: yaw });
  pb.box(0.22, 0.16, len, mx, y + 0.08, mz, { ry: yaw });
  pb.box(0.10, height * 0.48, len * 0.94, mx, y + height * 0.48, mz, { ry: yaw });

  const piers = Math.max(1, Math.min(6, Math.round(len / 4.8)));
  for (let i = 0; i <= piers; i++) {
    const t = i / piers;
    const px = x0 + dx * t;
    const pz = z0 + dz * t;
    pb.box(0.26, height + 0.08, 0.26, px, y + (height + 0.08) * 0.5, pz, { ry: yaw });
    pb.cone(0.12, 0.22, 4, px, y + height + 0.19, pz, { ry: yaw + Math.PI * 0.25 });
  }
}

/**
 * Crisp low-poly bronze 3-legged incense tripod (`~104 triangles`) on octagonal stone pedestal.
 */
function addCrispBronzeTripod(
  stonePb: PartsBuilder,
  bronzePb: PartsBuilder,
  goldPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): number {
  const s = scale;
  stonePb.cyl(0.62 * s, 0.72 * s, 0.34 * s, 6, x, y + 0.17 * s, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    bronzePb.cyl(0.06 * s, 0.05 * s, 0.36 * s, 4, x + Math.cos(a) * 0.30 * s, y + 0.50 * s, z + Math.sin(a) * 0.30 * s);
  }
  bronzePb.cyl(0.46 * s, 0.34 * s, 0.56 * s, 6, x, y + 0.86 * s, z);
  bronzePb.box(1.08 * s, 0.28 * s, 0.08 * s, x, y + 0.98 * s, z);
  goldPb.cone(0.22 * s, 0.32 * s, 5, x, y + 1.30 * s, z);
  return y + 1.48 * s;
}

/**
 * Crisp low-poly bronze crane standing on tortoise (`~88 triangles`).
 */
function addCrispCraneOnTortoise(
  bronzePb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  scale = 1.0
): void {
  const s = scale;
  bronzePb.sphere(0.24 * s, 5, 3, x, y + 0.13 * s, z, [1.0, 0.55, 1.35]);
  bronzePb.cyl(0.025 * s, 0.03 * s, 0.64 * s, 4, x, y + 0.54 * s, z);
  bronzePb.sphere(0.18 * s, 5, 4, x, y + 0.96 * s, z, [0.85, 0.95, 1.45]);
  bronzePb.cyl(0.028 * s, 0.038 * s, 0.62 * s, 4, x + Math.sin(rotY) * 0.12 * s, y + 1.36 * s, z + Math.cos(rotY) * 0.12 * s);
  bronzePb.cone(0.03 * s, 0.22 * s, 4, x + Math.sin(rotY) * 0.24 * s, y + 1.66 * s, z + Math.cos(rotY) * 0.24 * s, {
    rx: Math.PI * 0.5,
    ry: rotY
  });
}

/**
 * Crisp low-poly stone guardian Nghê / Lion on carved plinth (`~92 triangles`).
 */
function addCrispStoneNghe(
  stonePb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  stonePb.box(0.80 * s, 0.26 * s, 0.90 * s, x, y + 0.08 * s, z);
  stonePb.cyl(0.18 * s, 0.24 * s, 0.56 * s, 5, x, y + 0.48 * s, z, { rx: 0.2 });
  stonePb.sphere(0.18 * s, 5, 4, x, y + 0.88 * s, z + 0.14 * s);
  stonePb.box(0.16 * s, 0.10 * s, 0.18 * s, x, y + 0.84 * s, z + 0.28 * s);
  stonePb.cone(0.06 * s, 0.20 * s, 4, x, y + 1.06 * s, z + 0.12 * s, { rx: -0.4 });
}

/**
 * Crisp low-poly sculpted dragon ramp cheek (`~84 triangles`) for secondary triple *thềm rồng* stairs.
 */
function addCrispDragonRampCheek(
  pb: PartsBuilder,
  x: number,
  yLow: number,
  zLow: number,
  yHigh: number,
  zHigh: number,
  scale = 1.0
): void {
  const s = scale;
  const dz = zHigh - zLow;
  const horiz = Math.max(0.4, Math.abs(dz));
  const dy = yHigh - yLow;
  const slopeLen = Math.hypot(horiz, dy);
  const midZ = (zLow + zHigh) * 0.5;
  const midY = (yLow + yHigh) * 0.5;
  const rx = zHigh < zLow ? Math.atan2(dy, horiz) : -Math.atan2(dy, horiz);
  const dirZ = zLow > zHigh ? 1 : -1;

  pb.box(0.42 * s, 0.58 * s, slopeLen + 0.35 * s, x, midY + 0.18 * s, midZ, { rx });
  // Undulating dragon spine crest + frontal dragon head & pearl at foot
  pb.cyl(0.13 * s, 0.18 * s, slopeLen * 0.92, 5, x, midY + 0.52 * s, midZ, {
    rx: rx + Math.PI * 0.5
  });
  pb.sphere(0.22 * s, 5, 4, x, yLow + 0.58 * s, zLow + dirZ * 0.16 * s, [0.9, 0.95, 1.3]);
  pb.sphere(0.12 * s, 5, 4, x, yLow + 0.24 * s, zLow + dirZ * 0.32 * s);
}

/**
 * Crisp low-poly gilded Buddha / royal statue (`~112 triangles`) for secondary shrine interiors.
 */
function addCrispSeatedStatue(
  bodyPb: PartsBuilder,
  accentPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0,
  withHalo = false
): void {
  const s = scale;
  bodyPb.cyl(0.56 * s, 0.68 * s, 0.26 * s, 6, x, y + 0.13 * s, z);
  bodyPb.cyl(0.42 * s, 0.58 * s, 0.36 * s, 6, x, y + 0.42 * s, z);
  bodyPb.cyl(0.28 * s, 0.42 * s, 0.88 * s, 6, x, y + 1.00 * s, z);
  bodyPb.box(0.68 * s, 0.34 * s, 0.36 * s, x, y + 1.12 * s, z);
  bodyPb.sphere(0.22 * s, 6, 4, x, y + 1.66 * s, z, [0.92, 1.12, 0.95]);
  accentPb.cone(0.10 * s, 0.22 * s, 5, x, y + 1.96 * s, z);
  if (withHalo) {
    accentPb.cyl(0.54 * s, 0.54 * s, 0.05 * s, 8, x, y + 1.64 * s, z - 0.18 * s, { rx: Math.PI * 0.5 });
  }
}

/**
 * Crisp low-poly ridge dragon & flaming-pearl finial set (`~108 triangles`) seated flush at `ridgeY`.
 */
function addCrispRidgeFinials(
  roofPb: PartsBuilder,
  goldPb: PartsBuilder,
  cx: number,
  ridgeY: number,
  cz: number,
  ridgeLen: number,
  scale = 1.0
): void {
  const s = scale;
  roofPb.box(ridgeLen, 0.26 * s, 0.28 * s, cx, ridgeY - 0.10 * s, cz);
  goldPb.cyl(0.16 * s, 0.24 * s, 0.22 * s, 5, cx, ridgeY + 0.06 * s, cz);
  goldPb.sphere(0.20 * s, 6, 4, cx, ridgeY + 0.30 * s, cz);
  goldPb.cone(0.08 * s, 0.24 * s, 4, cx, ridgeY + 0.56 * s, cz);
  for (const side of [-1, 1]) {
    const endX = cx + side * (ridgeLen * 0.46);
    roofPb.box(0.32 * s, 0.30 * s, 0.28 * s, endX, ridgeY - 0.08 * s, cz);
    goldPb.cone(0.14 * s, 0.52 * s, 5, endX + side * 0.08 * s, ridgeY + 0.26 * s, cz, {
      rz: -side * 0.45
    });
    goldPb.box(ridgeLen * 0.28, 0.14 * s, 0.12 * s, cx + side * (ridgeLen * 0.22), ridgeY + 0.16 * s, cz, {
      rz: -side * 0.12
    });
  }
}

/**
 * Crisp low-poly Vietnamese stone temple lantern (`~68 triangles`, `castShadow = false`)
 * with stepped plinth, tapered shaft, pierced firebox, and flared pagoda cap.
 */
function addCrispStoneLantern(
  stonePb: PartsBuilder,
  goldPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  stonePb.box(0.54 * s, 0.22 * s, 0.54 * s, x, y + 0.08 * s, z);
  stonePb.cyl(0.11 * s, 0.15 * s, 0.88 * s, 5, x, y + 0.62 * s, z);
  stonePb.box(0.42 * s, 0.12 * s, 0.42 * s, x, y + 1.12 * s, z);
  goldPb.box(0.24 * s, 0.34 * s, 0.24 * s, x, y + 1.35 * s, z);
  stonePb.cone(0.42 * s, 0.28 * s, 4, x, y + 1.66 * s, z, { ry: Math.PI * 0.25 });
  goldPb.sphere(0.07 * s, 4, 3, x, y + 1.84 * s, z);
}

/**
 * Crisp low-poly gilded Bodhi-leaf flame mandorla (`lá bồ đề kép`, `~56 triangles`) behind sanctuary Buddhas.
 */
function addCrispBodhiHalo(
  goldPb: PartsBuilder,
  crimsonPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  crimsonPb.cyl(0.86 * s, 0.86 * s, 0.08 * s, 8, x, y + 1.25 * s, z - 0.36 * s, { rx: Math.PI * 0.5 });
  goldPb.cyl(0.76 * s, 0.76 * s, 0.10 * s, 8, x, y + 1.25 * s, z - 0.32 * s, { rx: Math.PI * 0.5 });
  goldPb.cone(0.56 * s, 0.82 * s, 5, x, y + 2.18 * s, z - 0.32 * s);
}

/**
 * Crisp low-poly altar candlesticks & central offering bowl (`~56 triangles`) for temple sanctuaries.
 */
function addCrispAltarOfferings(
  goldPb: PartsBuilder,
  crimsonPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  halfSpan: number,
  scale = 1.0
): void {
  const s = scale;
  goldPb.cyl(0.18 * s, 0.12 * s, 0.16 * s, 5, x, y + 0.08 * s, z);
  crimsonPb.sphere(0.12 * s, 5, 3, x, y + 0.20 * s, z, [1.0, 0.65, 1.0]);
  for (const side of [-1, 1]) {
    const cx = x + side * halfSpan;
    goldPb.cyl(0.05 * s, 0.11 * s, 0.42 * s, 5, cx, y + 0.21 * s, z);
    crimsonPb.cyl(0.035 * s, 0.035 * s, 0.20 * s, 4, cx, y + 0.50 * s, z);
    goldPb.cone(0.035 * s, 0.09 * s, 4, cx, y + 0.64 * s, z);
  }
}

/**
 * Crisp low-poly lacquered *Bát Bửu* ceremonial weapon rack (`~96 triangles`) for Hoa Lư imperial temples.
 */
function addCrispBatBuuRack(
  woodPb: PartsBuilder,
  crimsonPb: PartsBuilder,
  goldPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  woodPb.box(1.16 * s, 0.16 * s, 0.34 * s, x, y + 0.08 * s, z);
  for (const side of [-1, 1]) {
    crimsonPb.box(0.10 * s, 0.84 * s, 0.14 * s, x + side * 0.50 * s, y + 0.52 * s, z);
  }
  crimsonPb.box(1.08 * s, 0.10 * s, 0.12 * s, x, y + 0.86 * s, z);
  for (let i = 0; i < 4; i++) {
    const wx = x + (-0.36 + i * 0.24) * s;
    const h = (1.72 + (i % 2) * 0.18) * s;
    woodPb.cyl(0.022 * s, 0.026 * s, h, 4, wx, y + 0.12 * s + h * 0.5, z);
    const topY = y + 0.12 * s + h;
    if (i === 0 || i === 3) {
      goldPb.cone(0.065 * s, 0.28 * s, 4, wx, topY + 0.12 * s, z);
    } else if (i === 1) {
      goldPb.box(0.18 * s, 0.14 * s, 0.05 * s, wx, topY + 0.08 * s, z);
    } else {
      goldPb.sphere(0.085 * s, 4, 3, wx, topY + 0.08 * s, z);
    }
  }
}

/**
 * Crisp low-poly cast-bronze lotus balustrade lantern (`~68 triangles`) for Quảng trường Phật Hoàng.
 */
function addCrispBronzeLotusLantern(
  bronzePb: PartsBuilder,
  goldPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  bronzePb.cyl(0.15 * s, 0.19 * s, 0.14 * s, 6, x, y + 0.07 * s, z);
  bronzePb.cyl(0.27 * s, 0.14 * s, 0.22 * s, 6, x, y + 0.24 * s, z);
  goldPb.sphere(0.15 * s, 5, 4, x, y + 0.42 * s, z);
  goldPb.cone(0.11 * s, 0.20 * s, 5, x, y + 0.60 * s, z);
}

/**
 * Adds a grounded stepped flight of stairs spanning from `(cx, zStart, yStart)` to `(cx, zEnd, yEnd)`
 * with solid masonry under-fill extending `-4.8m` below terrain and optional cheek curbs.
 */
function addSteppedStairFlight(
  stepPb: PartsBuilder,
  curbPb: PartsBuilder,
  ctx: VietnamBuilderContext,
  cx: number,
  zStart: number,
  yStart: number,
  zEnd: number,
  yEnd: number,
  width: number,
  stepsCount: number,
  includeCurbs = true
): void {
  const n = Math.max(2, stepsCount);
  const dz = (zEnd - zStart) / n;
  const stepDepth = Math.abs(dz) + 0.08;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const sz = zStart + (zEnd - zStart) * t;
    const sy = THREE.MathUtils.lerp(yStart, yEnd, (i + 1) / n);
    const groundY = ctx.getHeight(cx, sz);
    const botY = Math.min(yStart - 1.5, groundY - 4.8);
    const h = Math.max(0.4, sy - botY);
    stepPb.box(width, h, stepDepth, cx, botY + h * 0.5, sz);
  }
  if (includeCurbs) {
    const horizLen = Math.max(0.4, Math.abs(zEnd - zStart));
    const dy = yEnd - yStart;
    const slopeLen = Math.hypot(horizLen, dy);
    const pitch = Math.atan2(dy, zEnd - zStart >= 0 ? horizLen : -horizLen);
    const midZ = (zStart + zEnd) * 0.5;
    const midY = (yStart + yEnd) * 0.5;
    for (const side of [-1, 1]) {
      const kx = cx + side * (width * 0.5 + 0.22);
      const groundMid = ctx.getHeight(kx, midZ);
      const baseH = Math.max(0.6, Math.min(yStart, yEnd) - (groundMid - 4.8));
      curbPb.box(0.44, baseH, horizLen + 0.44, kx, Math.min(yStart, yEnd) - baseH * 0.5, midZ);
      curbPb.box(
        0.44,
        0.58,
        slopeLen + 0.36,
        kx,
        midY + 0.22,
        midZ,
        zEnd < zStart ? { rx: Math.atan2(dy, horizLen) } : { rx: -pitch }
      );
      addCrispLotusPost(curbPb, kx, yStart + 0.42, zStart, 0.85);
      addCrispLotusPost(curbPb, kx, yEnd + 0.42, zEnd, 0.85);
    }
  }
}

/**
 * Adds a column embedded `-0.15m` into `baseY` with a carved stone/bronze lotus base drum (`chân tảng`).
 */
function addEmbeddedColumn(
  colPb: PartsBuilder,
  plinthPb: PartsBuilder,
  x: number,
  baseY: number,
  z: number,
  height: number,
  radius = 0.28,
  segs = 5
): void {
  const embed = 0.15;
  plinthPb.box(radius * 2.5, 0.22, radius * 2.5, x, baseY + 0.08, z);
  colPb.cyl(radius * 0.92, radius, height + embed, Math.min(5, segs), x, baseY - embed + (height + embed) * 0.5, z);
}

/**
 * Builds an octagonal curved pagoda eave tier (`8-sided mái đao bát giác`) with upturned corner spurs
 * and solid soffit ring so octagonal bell towers & 13-story stupas have authentic silhouettes at low triangle cost.
 */
function addOctagonalCurvedRoofTier(
  roofPb: PartsBuilder,
  accentPb: PartsBuilder,
  cx: number,
  baseY: number,
  cz: number,
  innerR: number,
  outerR: number,
  riseH: number,
  addCornerSpurs = true
): number {
  const octRot = Math.PI / 8;
  // Stepped soffit collar seated -0.10m into supporting wall/neck
  roofPb.cyl(innerR * 1.04, outerR * 0.92, 0.22, 8, cx, baseY + 0.01, cz, { ry: octRot });
  // Lower flared eave skirt + upper pitched octagonal cap
  roofPb.cyl(innerR * 1.18, outerR, riseH * 0.46, 8, cx, baseY + riseH * 0.23, cz, { ry: octRot });
  roofPb.cyl(innerR * 0.92, innerR * 1.18, riseH * 0.58, 8, cx, baseY + riseH * 0.72, cz, { ry: octRot });

  if (addCornerSpurs) {
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + octRot;
      const sx = cx + Math.cos(ang) * (outerR * 0.98);
      const sz = cz + Math.sin(ang) * (outerR * 0.98);
      // Upturned dragon-tail corner spur (`đầu đao cong`)
      accentPb.cone(
        Math.max(0.08, outerR * 0.045),
        Math.max(0.28, outerR * 0.14),
        4,
        sx,
        baseY + 0.20,
        sz,
        { rz: -Math.cos(ang) * 0.55, rx: Math.sin(ang) * 0.55 }
      );
    }
  }
  return baseY + riseH;
}

/**
 * Builds a low-poly, expressive sculpted stone Arhat (*La Hán*) statue on a carved stone pedestal
 * (`~86 triangles` per statue so all 24 Arhats fit cleanly inside the strict budget while showing varied poses).
 */
function addSculptedArhatStatue(
  stonePb: PartsBuilder,
  granitePb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  rotY: number,
  variantIndex: number
): void {
  // Carved stepped stone pedestal (-0.12m embed)
  granitePb.box(1.06, 0.48, 1.06, x, y + 0.12, z, { ry: rotY });
  stonePb.box(0.88, 0.18, 0.88, x, y + 0.45, z, { ry: rotY });
  stonePb.cyl(0.40, 0.46, 0.16, 6, x, y + 0.62, z);

  const seatY = y + 0.70;
  const fwdX = Math.sin(rotY);
  const fwdZ = Math.cos(rotY);
  const rightX = Math.cos(rotY);
  const rightZ = -Math.sin(rotY);

  // Cross-legged lotus base & monastic robe torso
  stonePb.cyl(0.32, 0.42, 0.28, 5, x, seatY + 0.14, z);
  stonePb.cyl(0.22, 0.31, 0.56, 5, x, seatY + 0.54, z);
  // Draped kasaya collar fold
  stonePb.box(0.46, 0.24, 0.30, x, seatY + 0.64, z, { ry: rotY });

  // Head with subtle expressive tilt & elongated Arhat earlobes
  const tiltSide = ((variantIndex % 3) - 1) * 0.05;
  const hx = x + rightX * tiltSide + fwdX * 0.03;
  const hz = z + rightZ * tiltSide + fwdZ * 0.03;
  stonePb.sphere(0.165, 4, 3, hx, seatY + 0.98, hz, [0.92, 1.08, 0.95]);
  for (const s of [-1, 1]) {
    stonePb.box(
      0.04,
      0.13,
      0.05,
      hx + rightX * s * 0.16,
      seatY + 0.94,
      hz + rightZ * s * 0.16,
      { ry: rotY }
    );
  }

  // 4 distinct mudra & Dharma-implement poses across the 24 Arhats
  const pose = variantIndex % 4;
  if (pose === 0) {
    // Holding Khakkhara staff (`tích trượng`) upright on right + alms bowl in lap
    stonePb.cyl(0.07, 0.09, 0.38, 5, x + rightX * 0.24 + fwdX * 0.10, seatY + 0.56, z + rightZ * 0.24 + fwdZ * 0.10);
    stonePb.cyl(0.07, 0.09, 0.38, 5, x - rightX * 0.20 + fwdX * 0.12, seatY + 0.46, z - rightZ * 0.20 + fwdZ * 0.12);
    const sx = x + rightX * 0.32 + fwdX * 0.18;
    const sz = z + rightZ * 0.32 + fwdZ * 0.18;
    granitePb.cyl(0.022, 0.026, 1.38, 5, sx, seatY + 0.68, sz);
    granitePb.cyl(0.075, 0.075, 0.04, 6, sx, seatY + 1.40, sz, { rx: Math.PI * 0.5, ry: rotY });
  } else if (pose === 1) {
    // Anjali prayer hands at chest
    for (const s of [-1, 1]) {
      stonePb.box(
        0.11,
        0.34,
        0.12,
        x + rightX * s * 0.11 + fwdX * 0.18,
        seatY + 0.58,
        z + rightZ * s * 0.11 + fwdZ * 0.18,
        { ry: rotY, rz: s * 0.45 }
      );
    }
  } else if (pose === 2) {
    // Holding sutra scroll / rosary Mala & raised teaching hand
    stonePb.box(0.11, 0.38, 0.11, x + rightX * 0.25 + fwdX * 0.16, seatY + 0.68, z + rightZ * 0.25 + fwdZ * 0.16, { ry: rotY });
    stonePb.box(0.24, 0.08, 0.12, x + fwdX * 0.22, seatY + 0.38, z + fwdZ * 0.22, { ry: rotY });
  } else {
    // Meditative Dhyana mudra holding sacred alms bowl (`bình bát`)
    for (const s of [-1, 1]) {
      stonePb.box(
        0.12,
        0.34,
        0.12,
        x + rightX * s * 0.20 + fwdX * 0.12,
        seatY + 0.48,
        z + rightZ * s * 0.20 + fwdZ * 0.12,
        { ry: rotY, rz: s * 0.65 }
      );
    }
    granitePb.cyl(0.11, 0.08, 0.13, 6, x + fwdX * 0.20, seatY + 0.36, z + fwdZ * 0.20);
  }
}

/**
 * Builds the carved monolithic Stone Dragon Bed (*Long Sàng Đá Hoa Lư* — National Treasure)
 * in front of Đền Vua Đinh Tiên Hoàng and Đền Vua Lê Đại Hành.
 */
function addHoaLuLongSangDa(
  stonePb: PartsBuilder,
  granitePb: PartsBuilder,
  goldPb: PartsBuilder,
  woodPb: PartsBuilder,
  cx: number,
  y: number,
  cz: number
): void {
  // Stepped stone foundation mat (-0.15m embed)
  granitePb.box(2.56, 0.28, 1.92, cx, y - 0.01, cz);
  // 4 carved cabriole lotus-lion corner legs + recessed cloud-scroll apron panels
  for (const sx of [-0.94, 0.94]) {
    for (const sz of [-0.66, 0.66]) {
      stonePb.box(0.28, 0.56, 0.28, cx + sx, y + 0.38, cz + sz);
      granitePb.sphere(0.15, 5, 4, cx + sx, y + 0.24, cz + sz);
    }
  }
  stonePb.box(2.04, 0.34, 1.46, cx, y + 0.44, cz);
  // Carved front & rear cloud-wave apron relief moldings
  for (const sz of [-0.76, 0.76]) {
    granitePb.box(1.56, 0.16, 0.08, cx, y + 0.44, cz + sz);
  }
  // Thick monolithic stone bed slab (`1.9m x 1.35m`) with carved royal dragon high-relief on top surface
  stonePb.box(2.22, 0.22, 1.62, cx, y + 0.70, cz);
  // Sculpted high-relief Hoa Lư royal dragon (`rồng chầu mặt nguyệt`) + pearl & mane on top face
  granitePb.cyl(0.24, 0.26, 0.08, 6, cx, y + 0.84, cz + 0.22);
  granitePb.box(0.34, 0.07, 0.86, cx, y + 0.84, cz - 0.12);
  granitePb.sphere(0.10, 5, 4, cx, y + 0.89, cz + 0.46); // Flaming pearl in dragon jaws
  for (const sx of [-0.48, 0.48]) {
    granitePb.box(0.14, 0.06, 0.96, cx + sx, y + 0.83, cz, { ry: sx * 0.18 });
    // Flanking vertical stone dragon screen armrests (`tay ngai rồng đá`) with coiled dragon crests
    stonePb.box(0.20, 0.44, 1.54, cx + sx * 2.02, y + 0.96, cz);
    granitePb.sphere(0.15, 5, 4, cx + sx * 2.02, y + 1.24, cz + 0.68);
    granitePb.box(0.10, 0.12, 1.18, cx + sx * 2.02, y + 1.22, cz - 0.04);
  }
  // Flanking Hoa Lư stone flag-socket pedestals (`chân cột bát biểu`) & twin gilded ceremonial Long Đao halberds
  for (const side of [-1, 1]) {
    const px = cx + side * 1.56;
    const pz = cz - 0.48;
    stonePb.box(0.32, 0.28, 0.32, px, y + 0.14, pz);
    woodPb.cyl(0.032, 0.036, 2.35, 5, px, y + 1.32, pz);
    goldPb.cone(0.09, 0.42, 4, px, y + 2.66, pz);
    goldPb.box(0.22, 0.12, 0.05, px + side * 0.08, y + 2.38, pz);
  }
}

/**
 * Adds a gnarled 700-year *Xích Tùng* (Ancient Yên Tử Red Pine) with exposed surface roots,
 * leaning red-barked trunk, and flat layered umbrella needle pads.
 */
function addAncientXichTungPine(
  barkPb: PartsBuilder,
  foliagePb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  const s = scale;
  // 2 exposed gnarled surface roots gripping the mountain granite (-0.25m embed)
  for (let r = 0; r < 2; r++) {
    const a = (r / 2) * Math.PI * 2 + rand() * 0.7;
    const p0 = new THREE.Vector3(x + Math.cos(a) * 0.16 * s, y + 0.28 * s, z + Math.sin(a) * 0.16 * s);
    const p1 = new THREE.Vector3(x + Math.cos(a) * 1.15 * s, y - 0.24 * s, z + Math.sin(a) * 1.15 * s);
    barkPb.strut(p0, p1, 0.12 * s, 0.06 * s, 4);
  }
  const leanX = (rand() - 0.5) * 0.9 * s;
  const leanZ = (rand() - 0.5) * 0.7 * s;
  const pBase = new THREE.Vector3(x, y - 0.20, z);
  const pMid = new THREE.Vector3(x + leanX * 0.55, y + 3.2 * s, z + leanZ * 0.55);
  const pTop = new THREE.Vector3(x + leanX, y + 6.4 * s, z + leanZ);
  barkPb.strut(pBase, pMid, 0.25 * s, 0.36 * s, 5);
  barkPb.strut(pMid, pTop, 0.15 * s, 0.25 * s, 4);

  // 3 horizontal picturesque bonsai-like pine boughs + layered flat umbrella needle pads
  const pads: Array<[number, number, number, number]> = [
    [pTop.x, pTop.y + 0.35 * s, pTop.z, 1.95 * s],
    [pMid.x + 1.35 * s, pMid.y + 1.35 * s, pMid.z + 0.35 * s, 1.55 * s],
    [pMid.x - 1.25 * s, pMid.y + 1.95 * s, pMid.z - 0.45 * s, 1.48 * s]
  ];
  for (let i = 0; i < pads.length; i++) {
    const [px, py, pz, rad] = pads[i];
    if (i > 0) {
      barkPb.strut(
        new THREE.Vector3(pMid.x, pMid.y + i * 0.55 * s, pMid.z),
        new THREE.Vector3(px, py - 0.15 * s, pz),
        0.07 * s,
        0.12 * s,
        4
      );
    }
    const rockPad = createSculptedRockGeometry(seed + i * 19, rad, rad * 0.34, rad * 0.92, 0);
    rockPad.translate(px, py, pz);
    foliagePb.add(rockPad);
  }
}

/**
 * Adds a sacred *Trúc Vàng Yên Tử* (Golden Bamboo) clump with jointed golden culms and feathery crown.
 */
function addGoldenBambooCluster(
  bambooPb: PartsBuilder,
  foliagePb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  const culms = 4;
  for (let i = 0; i < culms; i++) {
    const a = (i / culms) * Math.PI * 2 + rand() * 0.4;
    const r = (0.18 + rand() * 0.28) * scale;
    const h = (4.2 + rand() * 1.8) * scale;
    const cx = x + Math.cos(a) * r;
    const cz = z + Math.sin(a) * r;
    const tiltX = Math.sin(a) * 0.08;
    const tiltZ = -Math.cos(a) * 0.08;
    bambooPb.cyl(0.038 * scale, 0.054 * scale, h + 0.2, 4, cx, y - 0.15 + h * 0.5, cz, {
      rx: tiltX,
      rz: tiltZ
    });
  }
  const tuft = createSculptedRockGeometry(seed + 31, 1.35 * scale, 0.85 * scale, 1.35 * scale, 0);
  tuft.translate(x, y + 4.8 * scale, z);
  foliagePb.add(tuft);
}

/**
 * Adds an ancient 700-year *Đại Cổ Thụ* (Sacred Frangipani) tree at Chùa Hoa Yên with pale sculptural limbs
 * and white-and-gold blossom clusters.
 */
function addAncientFrangipaniTree(
  barkPb: PartsBuilder,
  foliagePb: PartsBuilder,
  blossomPb: PartsBuilder,
  goldPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number
): void {
  const s = scale;
  const base = new THREE.Vector3(x, y - 0.20, z);
  const fork = new THREE.Vector3(x + 0.12 * s, y + 2.1 * s, z - 0.08 * s);
  barkPb.strut(base, fork, 0.24 * s, 0.36 * s, 6);
  const branches: Array<[number, number, number]> = [
    [-1.15 * s, 3.85 * s, 0.65 * s],
    [1.10 * s, 4.05 * s, 0.55 * s],
    [0.08 * s, 4.35 * s, -0.95 * s]
  ];
  for (let i = 0; i < branches.length; i++) {
    const [bx, by, bz] = branches[i];
    const tip = new THREE.Vector3(x + bx, y + by, z + bz);
    barkPb.strut(fork, tip, 0.11 * s, 0.19 * s, 5);
    const canopy = createSculptedRockGeometry(seed + i * 13, 1.28 * s, 0.68 * s, 1.22 * s, 1);
    canopy.translate(tip.x, tip.y + 0.28 * s, tip.z);
    foliagePb.add(canopy);
    // Frangipani white & gold floral clusters (`hoa đại trắng tâm vàng`)
    for (let f = 0; f < 3; f++) {
      const fa = (f / 3) * Math.PI * 2 + i;
      const fx = tip.x + Math.cos(fa) * 0.72 * s;
      const fz = tip.z + Math.sin(fa) * 0.72 * s;
      const fy = tip.y + 0.62 * s;
      blossomPb.sphere(0.14 * s, 5, 4, fx, fy, fz, [1.2, 0.7, 1.2]);
      goldPb.sphere(0.06 * s, 4, 3, fx, fy + 0.06 * s, fz);
    }
  }
}

/**
 * Adds a multi-story Vietnamese curved sanctuary hall (`2` or `3` stacked hipped roofs with flush
 * *cổ diêm* clerestory necks, embedded ironwood columns, triple doorways, and flush ridge finials).
 */
function addCurvedRoofSanctuary(opts: {
  cx: number;
  yPlatformTop: number;
  cz: number;
  width: number;
  depth: number;
  colH: number;
  tiers: 2 | 3;
  colsX: number;
  colsZ: number;
  openFrontPortal?: boolean;
  finialMode?: 'hero' | 'crisp' | 'none';
  finialScale?: number;
  roofPb: PartsBuilder;
  woodPb: PartsBuilder;
  plasterPb: PartsBuilder;
  crimsonPb: PartsBuilder;
  goldPb: PartsBuilder;
  stonePb: PartsBuilder;
  voidPb: PartsBuilder;
}): { ridgeTopY: number } {
  const {
    cx,
    yPlatformTop,
    cz,
    width,
    depth,
    colH,
    tiers,
    colsX,
    colsZ,
    openFrontPortal = true,
    finialMode = 'hero',
    finialScale = 1.0,
    roofPb,
    woodPb,
    plasterPb,
    crimsonPb,
    goldPb,
    stonePb,
    voidPb
  } = opts;

  // Perimeter & interior dark-ironwood columns embedded -0.15m into stone platform
  for (let ix = 0; ix < colsX; ix++) {
    const tx = colsX > 1 ? ix / (colsX - 1) - 0.5 : 0;
    const px = cx + tx * width;
    for (let iz = 0; iz < colsZ; iz++) {
      const tz = colsZ > 1 ? iz / (colsZ - 1) - 0.5 : 0;
      const pz = cz + tz * depth;
      const isPerim = ix === 0 || ix === colsX - 1 || iz === 0 || iz === colsZ - 1;
      if (!isPerim && ix !== 1 && ix !== colsX - 2) continue;
      addEmbeddedColumn(woodPb, stonePb, px, yPlatformTop, pz, colH, isPerim ? 0.30 : 0.34, 6);
    }
  }

  // Eave tie beams (`xà nách / kẻ hiên`)
  woodPb.box(width + 0.5, 0.34, depth + 0.5, cx, yPlatformTop + colH - 0.14, cz);

  // Recessed sanctuary chamber walls (inset from veranda colonnade)
  const wallW = width - 2.4;
  const wallD = depth - 2.4;
  const wallH = colH + 0.08;
  // Back & side walls
  plasterPb.box(wallW, wallH, 0.36, cx, yPlatformTop + wallH * 0.5, cz - wallD * 0.5);
  plasterPb.box(0.36, wallH, wallD, cx - wallW * 0.5, yPlatformTop + wallH * 0.5, cz);
  plasterPb.box(0.36, wallH, wallD, cx + wallW * 0.5, yPlatformTop + wallH * 0.5, cz);

  // Front facade (+Z facing pilgrim approach) with central open sanctuary portal & flanking lattice bays
  const portalW = Math.min(wallW * 0.44, 7.6);
  const sideSpan = Math.max(0.8, (wallW - portalW) * 0.5);
  const frontZ = cz + wallD * 0.5;
  plasterPb.box(sideSpan, wallH, 0.36, cx - portalW * 0.5 - sideSpan * 0.5, yPlatformTop + wallH * 0.5, frontZ);
  plasterPb.box(sideSpan, wallH, 0.36, cx + portalW * 0.5 + sideSpan * 0.5, yPlatformTop + wallH * 0.5, frontZ);
  // Transom lintel above central portal
  crimsonPb.box(portalW + 0.4, 0.72, 0.42, cx, yPlatformTop + wallH - 0.36, frontZ);

  if (openFrontPortal) {
    // Dark recessed interior depth backdrop behind statues + gilded Cửa Võng ceremonial arch
    voidPb.box(portalW * 0.96, wallH - 0.8, 0.24, cx, yPlatformTop + (wallH - 0.8) * 0.5, cz - wallD * 0.42);
    goldPb.box(portalW * 0.88, 0.24, 0.12, cx, yPlatformTop + wallH - 0.88, frontZ + 0.08);
    for (const s of [-1, 1]) {
      goldPb.box(portalW * 0.14, 0.92, 0.10, cx + s * (portalW * 0.37), yPlatformTop + wallH - 1.30, frontZ + 0.08);
      crimsonPb.box(0.14, wallH - 0.85, 1.15, cx + s * (portalW * 0.46), yPlatformTop + (wallH - 0.85) * 0.5, frontZ - 0.48);
    }
  } else {
    crimsonPb.box(portalW, wallH - 0.72, 0.22, cx, yPlatformTop + (wallH - 0.72) * 0.5, frontZ);
    goldPb.box(portalW * 0.78, 0.12, 0.26, cx, yPlatformTop + (wallH - 0.72) * 0.55, frontZ);
  }

  // Framed red-and-gold horizontal *Hoành Phi* nameboard under front eave
  crimsonPb.box(Math.min(4.6, portalW * 0.82), 0.86, 0.16, cx, yPlatformTop + colH - 0.52, cz + depth * 0.5 + 0.14);
  goldPb.box(Math.min(4.8, portalW * 0.86), 0.98, 0.10, cx, yPlatformTop + colH - 0.52, cz + depth * 0.5 + 0.10);

  // Real-photo architectural facade details:
  // 1) Twin vertical red-and-gold lacquer *Câu Đối* couplet boards on front portal columns
  const coupletH = Math.min(2.85, colH * 0.62);
  for (const s of [-1, 1]) {
    const cpx = cx + s * (portalW * 0.5 + 0.22);
    crimsonPb.box(0.28, coupletH, 0.10, cpx, yPlatformTop + colH * 0.50, frontZ + 0.24);
    goldPb.box(0.34, coupletH + 0.08, 0.06, cpx, yPlatformTop + colH * 0.50, frontZ + 0.21);
    // 2) Carved ironwood *Cửa Bức Bàn* paneled doors with gilded upper lattice on flanking front bays
    if (sideSpan > 2.0) {
      const bayX = cx + s * (portalW * 0.5 + sideSpan * 0.5);
      const bayDoorW = Math.min(sideSpan * 0.72, 3.2);
      const bayDoorH = colH * 0.76;
      woodPb.box(bayDoorW, bayDoorH, 0.14, bayX, yPlatformTop + bayDoorH * 0.5, frontZ + 0.18);
      crimsonPb.box(bayDoorW * 0.86, bayDoorH * 0.44, 0.18, bayX, yPlatformTop + bayDoorH * 0.26, frontZ + 0.19);
      goldPb.box(bayDoorW * 0.84, bayDoorH * 0.30, 0.18, bayX, yPlatformTop + bayDoorH * 0.72, frontZ + 0.19);
    }
  }
  // 3) Carved ironwood *Kẻ Hiên* eave bracket corbels along front veranda columns
  for (let ix = 0; ix < colsX; ix++) {
    const tx = colsX > 1 ? ix / (colsX - 1) - 0.5 : 0;
    const px = cx + tx * width;
    woodPb.box(0.22, 0.24, 1.35, px, yPlatformTop + colH - 0.32, cz + depth * 0.5 + 0.42, { rx: 0.22 });
  }

  // Stacked curved hipped roofs (`createHueImperialHipRoofGeometry`) with flush *cổ diêm* necks
  let curY = yPlatformTop + colH - 0.08;
  let curW = width + 3.2;
  let curD = depth + 3.0;
  let ridgeLen = width * 0.48;
  let ridgeTopY = curY;

  for (let t = 0; t < tiers; t++) {
    const isTop = t === tiers - 1;
    const roofH = isTop ? 2.65 : 1.95;
    const topW = isTop ? curW * 0.44 : curW * 0.72;
    const topD = isTop ? 0.36 : curD * 0.70;
    const flare = isTop ? 0.46 : 0.38;

    const roofGeo = createHueImperialHipRoofGeometry(
      curW,
      curD,
      topW,
      topD,
      roofH,
      flare,
      4,
      3,
      true
    );
    roofGeo.translate(cx, curY, cz);
    roofPb.add(roofGeo);

    if (!isTop) {
      // Recessed *Cổ Diêm* clerestory neck seated -0.25m into lower roof & +0.18m into upper roof (0.0m gap!)
      const neckW = topW * 0.96;
      const neckD = topD * 0.96;
      const neckH = 1.18;
      const neckBaseY = curY + roofH - 0.26;
      crimsonPb.box(neckW, neckH + 0.18, neckD, cx, neckBaseY + (neckH + 0.18) * 0.5, cz);
      // Gilded horizontal frieze band along front & rear clerestory
      goldPb.box(neckW * 0.92, 0.18, neckD + 0.08, cx, neckBaseY + neckH * 0.55, cz);
      curY = neckBaseY + neckH - 0.06;
      curW = neckW + 2.55;
      curD = neckD + 2.35;
    } else {
      ridgeLen = topW;
      ridgeTopY = curY + roofH;
      // Molded horizontal ridge beam (`bờ nóc`) seated solidly into roof apex
      roofPb.box(ridgeLen + 0.24, 0.34, 0.40, cx, ridgeTopY - 0.04, cz);
      if (finialMode === 'hero') {
        const finials = createRoofFinialSetParts(
          cx,
          ridgeTopY - 0.05,
          cz,
          ridgeLen,
          0,
          finialScale,
          false
        );
        roofPb.add(...finials.mainParts);
        goldPb.add(...finials.goldParts);
      } else if (finialMode === 'crisp') {
        addCrispRidgeFinials(roofPb, goldPb, cx, ridgeTopY - 0.05, cz, ridgeLen, finialScale);
      }
    }
  }

  return { ridgeTopY };
}

// ============================================================================
// 1. CHÙA BÁI ĐÍNH – CỐ ĐÔ HOA LƯ COMPLEX (`(460, -640)`) — `BD-001..115`
// ============================================================================

function buildBaiDinhHoaLuComplex(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const group = new THREE.Group();
  group.name = 'BaiDinhHoaLuComplex';
  group.userData = {
    landmarkId: 'bai_dinh_hoa_lu',
    centerX: 460,
    centerZ: -640
  };
  tagMotifIds(group, BAI_DINH_HOA_LU_MOTIF_IDS);

  // Register exclusion zones across both Bái Đính & Hoa Lư precincts so scatter trees/grass never intrude
  ctx.exclusionCircles.push(
    { x: 472, z: -590, r: 34 },
    { x: 472, z: -625, r: 40 },
    { x: 472, z: -662, r: 38 },
    { x: 472, z: -685, r: 34 },
    { x: 413, z: -630, r: 28 },
    { x: 413, z: -668, r: 24 }
  );

  // Reuse ONLY ctx.materials.* (ZERO new MeshStandardMaterials!)
  const stoneMat = ctx.materials.stone;
  const graniteMat = ctx.materials.granite;
  const whiteMarbleMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const whitePlasterMat = ctx.materials.agedPlaster ?? ctx.materials.whitePlaster;
  const yellowPlasterMat = ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster;
  const crimsonMat = ctx.materials.crimsonLacquer;
  const ironwoodMat = ctx.materials.darkIronwood ?? ctx.materials.darkWood;
  const terraRoofMat = ctx.materials.terracottaRoof;
  const mossyRoofMat = ctx.materials.darkRoof;
  const chamBrickMat = ctx.materials.weatheredImperialBrick ?? ctx.materials.chamBrick;
  const batTrangMat = ctx.materials.batTrangFloor ?? ctx.materials.terracottaRoof;
  const goldMat = ctx.materials.gold;
  const bronzeMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  const voidMat = ctx.materials.darkVoid;
  const lanternSilkMat = ctx.materials.lanternSilk;
  const lanternCoreMat = ctx.materials.lanternCore ?? ctx.materials.whitePlaster;
  const foliageMat = ctx.materials.jadeRoof ?? ctx.materials.darkRoof;
  const barkMat = ctx.materials.bark;
  const waterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.jadeRoof ?? ctx.materials.granite;

  // Material geometry accumulators
  // HERO SHADOW MESHES (castShadow = true):
  //   #1 stupaHeroBrickPb (13-Story Bảo Tháp Xá Lợi core tower)
  //   #2 baiDinhHeroRoofPb (Bái Đính curved terracotta sanctuary/gate/bell roofs)
  //   #3 hoaLuHeroKarstRoofPb (Hoa Lư mossy sanctuary roofs)
  const stupaHeroBrickPb = new PartsBuilder();
  const baiDinhHeroRoofPb = new PartsBuilder();
  const hoaLuHeroRoofPb = new PartsBuilder();

  // Non-shadow detail accumulators (castShadow = false)
  const stonePb = new PartsBuilder();
  const granitePb = new PartsBuilder();
  const marblePb = new PartsBuilder();
  const plasterPb = new PartsBuilder();
  const yellowPb = new PartsBuilder();
  const crimsonPb = new PartsBuilder();
  const woodPb = new PartsBuilder();
  const minorTerraRoofPb = new PartsBuilder();
  const brickDetailPb = new PartsBuilder();
  const batTrangPb = new PartsBuilder();
  const goldPb = new PartsBuilder();
  const bronzePb = new PartsBuilder();
  const voidPb = new PartsBuilder();
  const lanternSilkPb = new PartsBuilder();
  const lanternCorePb = new PartsBuilder();
  const foliagePb = new PartsBuilder();
  const barkPb = new PartsBuilder();
  const waterPb = new PartsBuilder();

  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  // --------------------------------------------------------------------------
  // STEPPED HILLSIDE TERRACE ELEVATIONS (Rising Northwards z = -576 -> -695)
  // --------------------------------------------------------------------------
  const bdAxisX = 472.0;

  // Terrace 1 (`BD-001..006`): Lower Forecourt, Giếng Ngọc & Tam Quan Nội (`z = -576..-602`)
  const gT1 = sampleTerrainRange(ctx, 442, 504, -602, -576, 6);
  const yT1 = gT1.maxY + 0.75;
  addGroundedTerrace(stonePb, batTrangPb, ctx, 473, -589, 62, 26, yT1, 5.2, 1.0);
  // Welcome forecourt stone stairs at south edge (`z = -573.5 -> -576.5`)
  const ySouthGround = ctx.getHeight(bdAxisX, -573.0);
  addSteppedStairFlight(
    granitePb,
    stonePb,
    ctx,
    bdAxisX,
    -572.5,
    Math.min(yT1 - 0.5, ySouthGround + 0.15),
    -576.2,
    yT1,
    10.4,
    7,
    true
  );

  // Terrace 2 (`BD-007..012`): Bell Tower & 13-Story Stupa Grand Courtyard (`z = -603..-643`)
  const gT2 = sampleTerrainRange(ctx, 438, 509, -643, -603, 6);
  const yT2 = Math.max(yT1 + 2.6, gT2.maxY + 0.85);
  addGroundedTerrace(stonePb, batTrangPb, ctx, 473.5, -623, 70, 40, yT2, 5.4, 1.2);
  addSteppedStairFlight(granitePb, stonePb, ctx, bdAxisX, -600.2, yT1, -604.2, yT2, 9.2, 9, true);

  // Terrace 3 (`BD-013..018`): Điện Pháp Chủ Upper Sanctuary Terrace (`z = -650..-672`)
  const gT3 = sampleTerrainRange(ctx, 442, 504, -672, -650, 6);
  const yT3 = Math.max(yT2 + 3.6, gT3.maxY + 0.90);
  addGroundedTerrace(stonePb, batTrangPb, ctx, bdAxisX, -661, 60, 22, yT3, 5.8, 1.1);
  // Grand central Dragon Stairway from Terrace 2 (`z = -642.5`) up to Terrace 3 (`z = -650.5`)
  addSteppedStairFlight(granitePb, stonePb, ctx, bdAxisX, -642.2, yT2, -650.4, yT3, 10.6, 10, false);
  // Central & flanking carved stone dragon ramps (`thềm rồng đá`)
  for (const dx of [-5.4, 0, 5.4]) {
    addCrispDragonRampCheek(stonePb, bdAxisX + dx, yT2, -642.2, yT3, -650.4, 1.15);
  }
  // Courtyard stone balustrades along south terrace rims
  addCrispStoneBalustrade(stonePb, 444, -603.4, bdAxisX - 5.2, -603.4, yT2, 0.92);
  addCrispStoneBalustrade(stonePb, bdAxisX + 5.2, -603.4, 502, -603.4, yT2, 0.92);
  addCrispStoneBalustrade(stonePb, 444, -650.4, bdAxisX - 5.8, -650.4, yT3, 0.92);
  addCrispStoneBalustrade(stonePb, bdAxisX + 5.8, -650.4, 500, -650.4, yT3, 0.92);

  // Terrace 4 (`BD-019..024`): Điện Tam Thế Apex Terrace (`z = -673..-696`)
  const gT4 = sampleTerrainRange(ctx, 440, 504, -696, -673, 6);
  const yT4 = Math.max(yT3 + 3.8, gT4.maxY + 1.0);
  addGroundedTerrace(stonePb, batTrangPb, ctx, bdAxisX, -684.5, 64, 23, yT4, 6.2, 1.2);
  // Twin flanking stone staircases ascending around Điện Pháp Chủ from Terrace 3 to Terrace 4
  for (const side of [-1, 1]) {
    addSteppedStairFlight(
      granitePb,
      stonePb,
      ctx,
      bdAxisX + side * 18.5,
      -669.5,
      yT3,
      -674.0,
      yT4,
      5.4,
      11,
      true
    );
  }
  addCrispStoneBalustrade(stonePb, 442, -673.4, bdAxisX - 21.8, -673.4, yT4, 0.92);
  addCrispStoneBalustrade(stonePb, bdAxisX - 15.2, -673.4, bdAxisX + 15.2, -673.4, yT4, 0.92);
  addCrispStoneBalustrade(stonePb, bdAxisX + 21.8, -673.4, 502, -673.4, yT4, 0.92);

  // --------------------------------------------------------------------------
  // A. GIẾNG NGỌC (Sacred Jade Ring Well — `BD-025..033`) at `(451.5, -586.5)`
  // --------------------------------------------------------------------------
  const gnX = 451.5;
  const gnZ = -586.5;
  const gnR = 4.9;
  // Raised carved octagonal/12-sided stone well curb & inner jade-ring water mirror
  granitePb.cyl(gnR + 0.65, gnR + 0.95, 0.44, 12, gnX, yT1 + 0.22, gnZ);
  marblePb.cyl(gnR + 0.15, gnR + 0.28, 0.72, 12, gnX, yT1 + 0.36, gnZ);
  voidPb.cyl(gnR - 0.35, gnR - 0.35, 0.16, 12, gnX, yT1 + 0.32, gnZ);
  waterPb.cyl(gnR - 0.32, gnR - 0.32, 0.08, 12, gnX, yT1 + 0.56, gnZ);
  // Floating lotus leaves & blooming lotus blossoms in Giếng Ngọc
  for (let lp = 0; lp < 5; lp++) {
    const la = (lp / 5) * Math.PI * 2 + 0.35;
    const lx = gnX + Math.cos(la) * 2.1;
    const lz = gnZ + Math.sin(la) * 2.1;
    const pad = createNotchedLotusPadGeometry(0.42, 8);
    pad.translate(lx, yT1 + 0.61, lz);
    foliagePb.add(pad);
    if (lp % 2 === 0) {
      crimsonPb.cone(0.18, 0.16, 5, lx, yT1 + 0.70, lz);
      goldPb.sphere(0.06, 4, 3, lx, yT1 + 0.76, lz);
    }
  }
  // Carved white-stone balustrade ring around Giếng Ngọc with 8 lotus piers & East stone steps
  for (let seg = 0; seg < 8; seg++) {
    const a0 = (seg / 8) * Math.PI * 2;
    const a1 = ((seg + 1) / 8) * Math.PI * 2;
    const x0 = gnX + Math.cos(a0) * (gnR + 0.05);
    const z0 = gnZ + Math.sin(a0) * (gnR + 0.05);
    const x1 = gnX + Math.cos(a1) * (gnR + 0.05);
    const z1 = gnZ + Math.sin(a1) * (gnR + 0.05);
    addCrispLotusPost(marblePb, x0, yT1 + 1.38, z0, 0.9);
    if (seg !== 0) {
      addCrispStoneBalustrade(marblePb, x0, z0, x1, z1, yT1 + 0.68, 0.78);
    }
  }
  // Stepped stone entry descent on East opening of Giếng Ngọc
  for (let gs = 0; gs < 3; gs++) {
    granitePb.box(0.55, 0.18 * (3 - gs), 1.65, gnX + gnR + 0.45 + gs * 0.42, yT1 + 0.09 * (3 - gs), gnZ + 1.65);
  }
  // Carved stone turtle stele & twin stone lanterns at north rim of Giếng Ngọc
  stonePb.box(1.1, 0.16, 1.35, gnX, yT1 + 0.08, gnZ - gnR - 1.35);
  granitePb.sphere(0.48, 5, 3, gnX, yT1 + 0.24, gnZ - gnR - 1.35, [0.95, 0.48, 1.25]);
  stonePb.box(0.72, 1.25, 0.18, gnX, yT1 + 1.02, gnZ - gnR - 1.35);
  for (const s of [-1, 1]) {
    addCrispStoneLantern(stonePb, goldPb, gnX + s * 2.25, yT1, gnZ - gnR - 1.35, 0.88);
  }

  // --------------------------------------------------------------------------
  // B. TAM QUAN NỘI (3-Bay, 3-Tier Ironwood Gatehouse — `BD-034..045`) at `(472, -593)`
  // --------------------------------------------------------------------------
  const tqZ = -593.0;
  const yTQ = yT1 + 0.85;
  granitePb.box(19.6, 1.45, 9.4, bdAxisX, yT1 + 0.25, tqZ);
  addSteppedStairFlight(granitePb, stonePb, ctx, bdAxisX, -587.2, yT1, -588.5, yTQ, 6.8, 4, true);

  // 16 thick ironwood columns (-0.15m embed) framing 3 walkthrough portals
  const tqXs = [-8.2, -3.2, 3.2, 8.2];
  const tqZs = [-3.4, -1.1, 1.1, 3.4];
  const tqColH = 4.8;
  for (const ox of tqXs) {
    for (const oz of tqZs) {
      addEmbeddedColumn(woodPb, stonePb, bdAxisX + ox, yTQ, tqZ + oz, tqColH, 0.32, 6);
    }
  }
  woodPb.box(17.4, 0.36, 7.6, bdAxisX, yTQ + tqColH - 0.16, tqZ);

  // 3 arched masonry/timber portal partitions + open crimson ironwood doors with brass bands
  const centerArchGeo = createArchedWallGeometry(6.4, tqColH - 0.2, 1.1, 3.5, 3.7);
  centerArchGeo.translate(bdAxisX, yTQ, tqZ);
  plasterPb.add(centerArchGeo);
  for (const side of [-1, 1]) {
    const bx = side * 5.7;
    plasterPb.box(1.3, tqColH - 0.2, 1.1, bdAxisX + bx - 1.85, yTQ + (tqColH - 0.2) * 0.5, tqZ);
    plasterPb.box(1.3, tqColH - 0.2, 1.1, bdAxisX + bx + 1.85, yTQ + (tqColH - 0.2) * 0.5, tqZ);
    plasterPb.box(5.0, 1.5, 1.1, bdAxisX + bx, yTQ + tqColH - 0.95, tqZ);
  }
  for (const [bx, aw, ah] of [
    [0, 3.5, 3.7],
    [-5.7, 2.4, 3.1],
    [5.7, 2.4, 3.1]
  ] as const) {
    for (const s of [-1, 1]) {
      crimsonPb.box(0.14, ah * 0.78, aw * 0.44, bdAxisX + bx + s * (aw * 0.44), yTQ + ah * 0.40, tqZ + 0.25);
      goldPb.box(0.18, 0.14, aw * 0.38, bdAxisX + bx + s * (aw * 0.44), yTQ + ah * 0.46, tqZ + 0.25);
    }
  }

  // Twin guardian stone Nghê / Lions & hanging silk lanterns at Tam Quan Nội
  for (const s of [-1, 1]) {
    addCrispStoneNghe(stonePb, bdAxisX + s * 4.2, yT1 + 0.04, -586.4, 1.22);
    const lx = bdAxisX + s * 3.2;
    const ly = yTQ + tqColH - 0.85;
    const lz = tqZ + 3.65;
    lanternSilkPb.add(createRibbedLanternShellGeometry(0.32, 0.58, 6, 4, 'pumpkin').translate(lx, ly, lz));
    lanternCorePb.add(createLanternCoreGeometry(0.30, 0.52).translate(lx, ly, lz));
    goldPb.add(createLanternCapGeometry(0.32, 0.58, true).translate(lx, ly, lz));
  }

  // Tam Quan Nội lower-eave gilded *Hoành Phi* signboard & twin armored *Kim Cương* guardians on stone pedestals
  goldPb.box(4.45, 0.94, 0.10, bdAxisX, yTQ + tqColH - 0.56, tqZ + 3.56);
  crimsonPb.box(4.15, 0.72, 0.14, bdAxisX, yTQ + tqColH - 0.56, tqZ + 3.59);
  goldPb.box(3.25, 0.24, 0.16, bdAxisX, yTQ + tqColH - 0.56, tqZ + 3.61);
  for (const s of [-1, 1]) {
    goldPb.box(0.24, 0.64, 0.14, bdAxisX + s * 2.30, yTQ + tqColH - 0.56, tqZ + 3.56);
    const kx = bdAxisX + s * 5.7;
    const kz = tqZ + 2.25;
    // Carved stepped stone *Kim Cương* pedestal (-0.08m embed into yTQ)
    granitePb.box(1.48, 0.44, 1.24, kx, yTQ + 0.14, kz);
    stonePb.box(1.18, 0.24, 1.02, kx, yTQ + 0.48, kz);
    // Standing armored *Hộ Pháp Kim Cương* guardian with gilded breastplate, crown & Dharma halberd
    bronzePb.box(0.66, 0.72, 0.42, kx, yTQ + 0.96, kz);
    goldPb.box(0.86, 0.82, 0.46, kx, yTQ + 1.66, kz);
    bronzePb.sphere(0.21, 5, 4, kx, yTQ + 2.30, kz);
    goldPb.cone(0.16, 0.28, 5, kx, yTQ + 2.58, kz);
    woodPb.cyl(0.032, 0.036, 2.35, 4, kx + s * 0.52, yTQ + 1.76, kz + 0.12);
    goldPb.cone(0.09, 0.34, 4, kx + s * 0.52, yTQ + 3.06, kz + 0.12);
  }

  // 3-Tier stacked curved terracotta roofs on Tam Quan Nội + flush ridge finials (`ridgeTopY - 0.05`)
  const tqRoof1 = createHueImperialHipRoofGeometry(20.6, 10.6, 13.8, 6.4, 1.85, 0.38, 4, 3, true);
  tqRoof1.translate(bdAxisX, yTQ + tqColH - 0.08, tqZ);
  baiDinhHeroRoofPb.add(tqRoof1);

  const tqNeck1Y = yTQ + tqColH + 1.52;
  woodPb.box(13.2, 1.18, 6.0, bdAxisX, tqNeck1Y + 0.48, tqZ);
  crimsonPb.box(4.6, 0.82, 0.16, bdAxisX, tqNeck1Y + 0.52, tqZ + 3.08);
  goldPb.box(4.8, 0.94, 0.10, bdAxisX, tqNeck1Y + 0.52, tqZ + 3.04);

  const tqRoof2Y = tqNeck1Y + 0.96;
  const tqRoof2 = createHueImperialHipRoofGeometry(15.6, 8.2, 9.6, 4.4, 1.68, 0.36, 4, 3, true);
  tqRoof2.translate(bdAxisX, tqRoof2Y, tqZ);
  baiDinhHeroRoofPb.add(tqRoof2);

  const tqNeck2Y = tqRoof2Y + 1.42;
  woodPb.box(9.0, 1.06, 4.0, bdAxisX, tqNeck2Y + 0.44, tqZ);
  const tqRoof3Y = tqNeck2Y + 0.88;
  const tqRoof3 = createHueImperialHipRoofGeometry(11.6, 6.4, 5.2, 0.36, 2.05, 0.42, 4, 3, true);
  tqRoof3.translate(bdAxisX, tqRoof3Y, tqZ);
  baiDinhHeroRoofPb.add(tqRoof3);
  const tqRidgeTopY = tqRoof3Y + 2.05;
  baiDinhHeroRoofPb.box(5.4, 0.30, 0.36, bdAxisX, tqRidgeTopY - 0.04, tqZ);
  addCrispRidgeFinials(baiDinhHeroRoofPb, goldPb, bdAxisX, tqRidgeTopY - 0.05, tqZ, 5.2, 0.95);

  // --------------------------------------------------------------------------
  // C. THÁP CHUÔNG BÁT GIÁC (3-Tier Bell Tower + 36-Ton Đại Hồng Chung — `BD-046..056`)
  // --------------------------------------------------------------------------
  const btX = 456.0;
  const btZ = -621.0;
  const yBT = yT2 + 1.20;
  const octRot = Math.PI / 8;
  granitePb.cyl(7.2, 7.8, 1.85, 8, btX, yT2 + 0.32, btZ, { ry: octRot });
  marblePb.cyl(6.6, 6.8, 0.18, 8, btX, yBT - 0.05, btZ, { ry: octRot });
  // Cardinal stone stairs & octagonal balustrades around Bell Tower terrace
  addSteppedStairFlight(granitePb, stonePb, ctx, btX, -612.8, yT2, -614.4, yBT, 3.6, 5, false);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + octRot;
    const a1 = ((i + 1) / 8) * Math.PI * 2 + octRot;
    const rBal = 6.35;
    const x0 = btX + Math.cos(a0) * rBal;
    const z0 = btZ + Math.sin(a0) * rBal;
    const x1 = btX + Math.cos(a1) * rBal;
    const z1 = btZ + Math.sin(a1) * rBal;
    addCrispLotusPost(stonePb, x0, yBT + 0.88, z0, 0.85);
    if (i !== 1) {
      addCrispStoneBalustrade(stonePb, x0, z0, x1, z1, yBT, 0.86);
    }
  }

  // 8 outer + 8 tall inner dark-ironwood columns (-0.15m embed) supporting 3 octagonal roofs + eave bracket struts
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + octRot;
    const ox = btX + Math.cos(a) * 5.3;
    const oz = btZ + Math.sin(a) * 5.3;
    addEmbeddedColumn(woodPb, stonePb, ox, yBT, oz, 4.6, 0.27, 6);
    addEmbeddedColumn(woodPb, stonePb, btX + Math.cos(a) * 3.4, yBT, btZ + Math.sin(a) * 3.4, 8.8, 0.30, 6);
    // Radial ironwood *kẻ hiên* eave bracket corbel supporting lower octagonal roof skirt
    woodPb.strut(
      new THREE.Vector3(ox, yBT + 3.95, oz),
      new THREE.Vector3(btX + Math.cos(a) * 6.35, yBT + 4.48, btZ + Math.sin(a) * 6.35),
      0.09,
      0.11,
      4
    );
  }
  // 4 corner carved stone lanterns framing the Bell Tower octagonal terrace
  for (let li = 0; li < 4; li++) {
    const la = (li / 4) * Math.PI * 2 + Math.PI * 0.25;
    addCrispStoneLantern(stonePb, goldPb, btX + Math.cos(la) * 8.4, yT2, btZ + Math.sin(la) * 8.4, 0.92);
  }
  // Tier 1, Tier 2 & Tier 3 octagonal curved terracotta roofs + recessed octagonal timber necks
  const btR1Top = addOctagonalCurvedRoofTier(baiDinhHeroRoofPb, goldPb, btX, yBT + 4.5, btZ, 3.6, 6.8, 1.9, true);
  woodPb.cyl(3.45, 3.55, 2.2, 8, btX, btR1Top + 0.85, btZ, { ry: octRot });
  const btR2Top = addOctagonalCurvedRoofTier(baiDinhHeroRoofPb, goldPb, btX, btR1Top + 1.85, btZ, 2.45, 5.3, 1.85, true);
  woodPb.cyl(2.35, 2.45, 1.9, 8, btX, btR2Top + 0.72, btZ, { ry: octRot });
  const btR3Top = addOctagonalCurvedRoofTier(baiDinhHeroRoofPb, goldPb, btX, btR2Top + 1.55, btZ, 0.32, 4.0, 2.45, true);
  // Flush gilded gourd finial seated -0.12m into Bell Tower apex
  goldPb.cyl(0.26, 0.42, 0.45, 6, btX, btR3Top + 0.10, btZ);
  goldPb.sphere(0.32, 6, 5, btX, btR3Top + 0.52, btZ);
  goldPb.cone(0.18, 1.15, 6, btX, btR3Top + 1.25, btZ);

  // Giant Bronze Drum (*Trống Đồng Bái Đính*) on stone lotus base at floor + 36-Ton Đại Hồng Chung suspended above!
  stonePb.cyl(1.85, 2.05, 0.32, 8, btX, yBT + 0.16, btZ);
  bronzePb.cyl(1.42, 1.34, 0.65, 10, btX, yBT + 0.64, btZ);
  bronzePb.cyl(1.56, 1.18, 0.72, 10, btX, yBT + 1.32, btZ);
  goldPb.cyl(1.58, 1.58, 0.08, 10, btX, yBT + 1.68, btZ);
  // 4 cast-bronze drum loop handles (*quai trống đồng*)
  for (let dh = 0; dh < 4; dh++) {
    const da = (dh / 4) * Math.PI * 2;
    goldPb.box(0.14, 0.28, 0.14, btX + Math.cos(da) * 1.48, yBT + 1.28, btZ + Math.sin(da) * 1.48);
  }
  // Heavy crossed ironwood bell yoke beams + suspended wooden bell striker (`chày kình`)
  woodPb.box(6.4, 0.38, 0.42, btX, yBT + 6.35, btZ);
  woodPb.box(0.42, 0.38, 6.4, btX, yBT + 6.35, btZ);
  bronzePb.cyl(0.10, 0.10, 0.95, 6, btX, yBT + 5.85, btZ);
  // Carved dragon crown loop (*quai bồ lao*) & 4 cardinal boss medallions (*núm chuông*) on Đại Hồng Chung
  goldPb.box(0.68, 0.36, 0.24, btX, yBT + 5.38, btZ);
  bronzePb.add(...createBronzeBellParts(btX, yBT + 3.05, btZ, 2.15));
  for (let bm = 0; bm < 4; bm++) {
    const ba = (bm / 4) * Math.PI * 2;
    goldPb.sphere(0.16, 5, 4, btX + Math.cos(ba) * 1.02, yBT + 3.72, btZ + Math.sin(ba) * 1.02);
  }
  // Suspended wooden striker (`chày kình`) anchored by twin bronze suspension chains to upper yoke (0 floating!)
  woodPb.cyl(0.16, 0.16, 2.6, 6, btX + 2.35, yBT + 3.55, btZ, { rz: Math.PI * 0.5 });
  crimsonPb.cyl(0.19, 0.19, 0.24, 6, btX + 1.15, yBT + 3.55, btZ, { rz: Math.PI * 0.5 });
  for (const chainX of [btX + 1.65, btX + 3.05]) {
    bronzePb.cyl(0.032, 0.032, 2.82, 4, chainX, yBT + 4.96, btZ);
  }

  // --------------------------------------------------------------------------
  // D. BẢO THÁP XÁ LỢI PHẬT 13 TẦNG (~38.6m Tall Hero Stupa — `BD-057..071`)
  // --------------------------------------------------------------------------
  const stX = 491.5;
  const stZ = -622.0;
  const plinthH = 2.65;
  const yStupaDeck = yT2 + plinthH;

  // Monumental 2-step octagonal carved stone & white-marble base terrace (-5.0m skirt via Terrace 2 + embedded base)
  granitePb.cyl(8.6, 9.4, 1.65, 8, stX, yT2 + 0.62, stZ, { ry: octRot });
  marblePb.cyl(7.5, 8.1, 1.35, 8, stX, yT2 + 1.98, stZ, { ry: octRot });
  // 4 cardinal entrance staircases & base octagonal white-stone balustrades
  addSteppedStairFlight(granitePb, marblePb, ctx, stX, -612.2, yT2, -614.4, yStupaDeck, 3.8, 7, false);
  addSteppedStairFlight(granitePb, marblePb, ctx, stX, -631.8, yT2, -629.6, yStupaDeck, 3.8, 7, false);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + octRot;
    const a1 = ((i + 1) / 8) * Math.PI * 2 + octRot;
    const rB = 7.25;
    const x0 = stX + Math.cos(a0) * rB;
    const z0 = stZ + Math.sin(a0) * rB;
    const x1 = stX + Math.cos(a1) * rB;
    const z1 = stZ + Math.sin(a1) * rB;
    marblePb.box(0.34, 1.05, 0.34, x0, yStupaDeck + 0.52, z0);
    goldPb.sphere(0.14, 5, 4, x0, yStupaDeck + 1.12, z0);
    if (i !== 1 && i !== 5) {
      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      marblePb.box(0.18, 0.78, segLen, mx, yStupaDeck + 0.39, mz, { ry: yaw });
    }
  }

  // 13 Octagonal Stories rising ~31.2m + 4.8m Gilded Lotus-Gourd Spire = ~38.65m total height above yT2!
  let tierBaseY = yStupaDeck - 0.15;
  for (let tier = 0; tier < 13; tier++) {
    const tFrac = tier / 12;
    const shaftR = THREE.MathUtils.lerp(5.35, 2.05, tFrac);
    const tierH = THREE.MathUtils.lerp(2.92, 1.92, tFrac);
    const eaveR = shaftR + THREE.MathUtils.lerp(1.42, 0.76, tFrac);

    // Octagonal crimson/chamBrick masonry shaft (`stupaHeroBrickPb` = Hero Shadow Mesh #1!)
    stupaHeroBrickPb.cyl(
      shaftR * 0.97,
      shaftR * 1.01,
      tierH + 0.18,
      8,
      stX,
      tierBaseY + (tierH + 0.18) * 0.5,
      stZ,
      { ry: octRot }
    );
    // Warm ochre carved lotus frieze band beneath eave
    yellowPb.cyl(shaftR * 1.03, shaftR * 1.03, tierH * 0.18, 8, stX, tierBaseY + tierH * 0.82, stZ, {
      ry: octRot
    });

    // White stone octagonal balustrade wrapping EVERY tier (1..13) on top of the previous tier's eave ledge
    const balR = shaftR + THREE.MathUtils.lerp(0.62, 0.32, tFrac);
    const balH = THREE.MathUtils.lerp(0.58, 0.36, tFrac);
    marblePb.cyl(balR, balR * 1.02, balH * 0.78, 8, stX, tierBaseY + balH * 0.39, stZ, { ry: octRot });
    if (tier === 0 || tier === 6 || tier === 12) {
      for (let f = 0; f < 8; f++) {
        const a0 = (f / 8) * Math.PI * 2 + octRot;
        marblePb.box(0.18, balH * 1.08, 0.18, stX + Math.cos(a0) * balR, tierBaseY + balH * 0.54, stZ + Math.sin(a0) * balR);
      }
    }

    // 8 Carved Terracotta Corner Relief Pilasters (*cột góc chạm nổi gạch nung Bát Tràng*, castShadow=false)
    for (let k = 0; k < 8; k++) {
      const ca = (k / 8) * Math.PI * 2 + octRot;
      const pilW = THREE.MathUtils.lerp(0.28, 0.14, tFrac);
      brickDetailPb.box(
        pilW,
        tierH * 0.88,
        pilW,
        stX + Math.cos(ca) * (shaftR * 0.98),
        tierBaseY + tierH * 0.46,
        stZ + Math.sin(ca) * (shaftR * 0.98),
        { ry: -ca }
      );
    }

    // 8-Face Gilded Buddha Relief Window Niches per tier (4 cardinal + 4 diagonal on tiers 1..11!)
    const apothem = shaftR * Math.cos(Math.PI / 8);
    const faceCount = tier >= 1 && tier <= 11 ? 8 : 4;
    for (let c = 0; c < faceCount; c++) {
      const faceAng = (c / faceCount) * Math.PI * 2;
      const nx = stX + Math.cos(faceAng) * (apothem + 0.04);
      const nz = stZ + Math.sin(faceAng) * (apothem + 0.04);
      const faceYaw = Math.PI * 0.5 - faceAng;
      const isCardinal = faceCount === 4 || c % 2 === 0;
      const nw = THREE.MathUtils.lerp(isCardinal ? 1.25 : 0.88, isCardinal ? 0.52 : 0.40, tFrac);
      const nh = tierH * (isCardinal ? 0.54 : 0.46);
      const ny = tierBaseY + tierH * 0.44;
      if (tier === 0) {
        goldPb.box(nw + 0.26, nh + 0.24, 0.16, nx, ny, nz, { ry: faceYaw });
        // Carved Bát Tràng lotus archivolt pediment crowning each cardinal portal
        goldPb.cone(nw * 0.42, 0.48, 4, nx, ny + nh * 0.56, nz, { ry: faceYaw + Math.PI * 0.25 });
        voidPb.box(nw * 0.84, nh * 0.88, 0.20, nx, ny - 0.04, nz, { ry: faceYaw });
        goldPb.cone(nw * 0.26, nh * 0.56, 4, nx, ny - 0.08, nz);
      } else {
        // Recessed dark niche + gleaming gilded votive Buddha relief inside
        voidPb.box(nw * 0.82, nh * 0.84, 0.12, nx, ny, nz, { ry: faceYaw });
        goldPb.cone(nw * 0.26, nh * 0.54, 4, nx, ny - nh * 0.04, nz);
      }
    }

    // Upturned octagonal terracotta eave + gilded corner spurs on ALL 13 tiers + hanging bronze wind-chimes on key tiers
    addOctagonalCurvedRoofTier(
      minorTerraRoofPb,
      goldPb,
      stX,
      tierBaseY + tierH - 0.10,
      stZ,
      shaftR * 0.88,
      eaveR,
      0.62,
      true
    );
    if (tier === 0 || tier === 4 || tier === 8 || tier === 12) {
      for (let w = 0; w < 8; w += 2) {
        const wa = (w / 8) * Math.PI * 2 + octRot;
        const wx = stX + Math.cos(wa) * (eaveR * 0.94);
        const wz = stZ + Math.sin(wa) * (eaveR * 0.94);
        bronzePb.cone(0.08, 0.22, 4, wx, tierBaseY + tierH - 0.26, wz);
      }
    }

    tierBaseY += tierH;
  }

  // Tier 13 conical octagonal cap + Tall Gilded 9-Ring Lotus-Gourd Spire (*Búp Sen & Hồ Lô Mạ Vàng*, ~4.9m!)
  const capTopY = addOctagonalCurvedRoofTier(
    minorTerraRoofPb,
    goldPb,
    stX,
    tierBaseY - 0.08,
    stZ,
    0.42,
    2.65,
    1.55,
    true
  );
  // Seated FLUSH (-0.18m embed) into Tier 13 roof apex!
  const spireBaseY = capTopY - 0.18;
  bronzePb.cyl(0.68, 0.92, 0.52, 8, stX, spireBaseY + 0.26, stZ);
  goldPb.add(...createLotusPetalRingParts(stX, spireBaseY + 0.55, stZ, 0.72, 8, 1, true));
  // Lower & upper gourd bulbs (`Hồ Lô`) + 9 sacred Dharma rings (`Cửu Trùng Vòng Tướng Luân`) + flame tip
  goldPb.sphere(0.56, 8, 6, stX, spireBaseY + 1.15, stZ, [1.0, 1.18, 1.0]);
  goldPb.cyl(0.22, 0.30, 0.45, 6, stX, spireBaseY + 1.72, stZ);
  goldPb.sphere(0.38, 7, 5, stX, spireBaseY + 2.12, stZ, [1.0, 1.15, 1.0]);
  goldPb.cyl(0.08, 0.16, 2.55, 6, stX, spireBaseY + 3.55, stZ);
  for (let ring = 0; ring < 9; ring++) {
    const rf = ring / 8;
    const rr = THREE.MathUtils.lerp(0.36, 0.14, rf);
    goldPb.cyl(rr, rr, 0.06, 6, stX, spireBaseY + 2.58 + ring * 0.22, stZ);
  }
  goldPb.cone(0.16, 0.58, 6, stX, spireBaseY + 4.92, stZ);

  // --------------------------------------------------------------------------
  // E. HAI DÃY HÀNH LANG LA HÁN + 24 SCULPTED STONE ARHAT STATUES (`BD-072..085`)
  // --------------------------------------------------------------------------
  // Placed cleanly along West (`x = 440.5`) and East (`x = 506.0`) flanks with > 5.5m clearance from Bell Tower & Stupa!
  const galleryBays = 6;
  const galZ0 = -606.0;
  const galZ1 = -658.0;
  const baySpanZ = (galZ1 - galZ0) / galleryBays; // negative (northward)
  const bayLen = Math.abs(baySpanZ);

  for (let gSide = 0; gSide < 2; gSide++) {
    const isWest = gSide === 0;
    const gx = isWest ? 440.5 : 506.0;
    const inwardSign = isWest ? 1 : -1;
    const arhatYaw = isWest ? Math.PI * 0.5 : -Math.PI * 0.5;

    for (let b = 0; b < galleryBays; b++) {
      const bz = galZ0 + (b + 0.5) * baySpanZ;
      const by = THREE.MathUtils.lerp(yT2 + 0.35, yT3 + 0.25, b / (galleryBays - 1));
      const gGround = ctx.getHeight(gx, bz);
      const gBot = Math.min(by - 2.0, gGround - 5.0);
      // Stepped stone foundation & Bát Tràng walkway floor
      stonePb.box(4.6, by - gBot, bayLen + 0.25, gx, gBot + (by - gBot) * 0.5, bz);
      batTrangPb.box(4.2, 0.08, bayLen + 0.18, gx, by + 0.04, bz);

      // 4 ironwood columns per bay (-0.15m embed) + outer plaster screen wall + inner wooden railing
      const galColH = 3.35;
      for (const sz of [-bayLen * 0.45, bayLen * 0.45]) {
        addEmbeddedColumn(woodPb, stonePb, gx - 1.85, by, bz + sz, galColH, 0.20, 5);
        addEmbeddedColumn(woodPb, stonePb, gx + 1.85, by, bz + sz, galColH, 0.20, 5);
      }
      // Outer screen wall with pierced *chữ Thọ* / gilded octagonal lattice window frame
      const wallX = gx - inwardSign * 1.92;
      plasterPb.box(0.24, galColH * 0.92, bayLen + 0.12, wallX, by + galColH * 0.46, bz);
      woodPb.box(0.32, 0.82, 1.25, wallX, by + 1.85, bz);
      goldPb.cyl(0.34, 0.34, 0.36, 6, wallX, by + 1.85, bz, { rz: Math.PI * 0.5 });
      // Inner courtyard ironwood balustrade rail & overhead tie beam (`xà ngang`)
      const innerRailX = gx + inwardSign * 1.85;
      woodPb.box(0.12, 0.10, bayLen * 0.82, innerRailX, by + 0.78, bz);
      woodPb.box(0.10, 0.08, bayLen * 0.82, innerRailX, by + 0.38, bz);
      woodPb.box(3.9, 0.18, 0.18, gx, by + galColH - 0.18, bz);
      // Hanging temple silk lantern suspended from overhead tie beam on alternating bays
      if (b % 2 === 0) {
        const ly = by + galColH - 0.72;
        woodPb.cyl(0.025, 0.025, 0.42, 4, gx + inwardSign * 0.65, by + galColH - 0.36, bz);
        lanternSilkPb.cyl(0.22, 0.22, 0.36, 5, gx + inwardSign * 0.65, ly, bz);
        goldPb.cyl(0.18, 0.18, 0.07, 5, gx + inwardSign * 0.65, ly + 0.20, bz);
        goldPb.cyl(0.16, 0.16, 0.07, 5, gx + inwardSign * 0.65, ly - 0.20, bz);
      }
      // Stepped pitched terracotta gallery roof (`createGableRoofGeometry` along `'z'`)
      const gRoof = createGableRoofGeometry(5.3, bayLen + 0.55, 1.35, 0.16, 'z');
      gRoof.translate(gx, by + galColH - 0.06, bz);
      minorTerraRoofPb.add(gRoof);

      // 2 Sculpted Stone Arhat (*La Hán*) Statues per bay -> 6 * 2 * 2 = 24 La Hán Statues!
      for (let sub = 0; sub < 2; sub++) {
        const arhatIdx = gSide * 12 + b * 2 + sub;
        const az = bz + (sub === 0 ? -bayLen * 0.24 : bayLen * 0.24);
        addSculptedArhatStatue(stonePb, granitePb, gx - inwardSign * 0.45, by, az, arhatYaw, arhatIdx);
      }

      // Carved stone incense bowl (*lư hương đá Hành Lang La Hán*) centered on alternating bays
      if (b % 2 === 0) {
        const ix = gx + inwardSign * 0.95;
        granitePb.box(0.56, 0.22, 0.56, ix, by + 0.15, bz);
        stonePb.cyl(0.28, 0.20, 0.34, 6, ix, by + 0.43, bz);
        granitePb.cyl(0.32, 0.30, 0.08, 6, ix, by + 0.62, bz);
        crimsonPb.cyl(0.05, 0.04, 0.18, 4, ix, by + 0.72, bz);
      }
    }
  }

  // Courtyard carved stone bonsai planters (*chậu cây cảnh bonsai đá*) flanking Hành lang La Hán on Terrace 2
  for (const [bx, bz] of [
    [445.5, -608.5],
    [445.5, -638.5],
    [500.5, -608.5],
    [500.5, -638.5]
  ]) {
    stonePb.cyl(0.88, 0.74, 0.54, 6, bx, yT2 + 0.27, bz);
    granitePb.cyl(0.96, 0.92, 0.12, 6, bx, yT2 + 0.58, bz);
    barkPb.cyl(0.09, 0.15, 0.95, 5, bx, yT2 + 1.02, bz, { rz: 0.14 });
    barkPb.cyl(0.06, 0.09, 0.65, 4, bx + 0.26, yT2 + 1.48, bz, { rz: -0.58 });
    barkPb.cyl(0.06, 0.09, 0.62, 4, bx - 0.24, yT2 + 1.56, bz + 0.12, { rz: 0.52 });
    foliagePb.sphere(0.46, 5, 3, bx, yT2 + 1.92, bz, [1.35, 0.55, 1.35]);
    foliagePb.sphere(0.36, 5, 3, bx + 0.46, yT2 + 1.66, bz, [1.3, 0.52, 1.3]);
    foliagePb.sphere(0.36, 5, 3, bx - 0.44, yT2 + 1.74, bz + 0.14, [1.3, 0.52, 1.3]);
  }

  // --------------------------------------------------------------------------
  // F. ĐIỆN PHÁP CHỦ & ĐIỆN TAM THẾ UPPER SANCTUARIES (`BD-086..098`)
  // --------------------------------------------------------------------------
  // 1) ĐIỆN PHÁP CHỦ (2-Tier Curved Sanctuary at `(472, -662)`)
  const pcZ = -662.0;
  const yPC = yT3 + 1.25;
  granitePb.box(25.6, 1.85, 14.4, bdAxisX, yT3 + 0.32, pcZ);
  // Triple Dragon Stairway (`thềm rồng`) on front (+Z) of Điện Pháp Chủ
  addSteppedStairFlight(granitePb, stonePb, ctx, bdAxisX, -653.0, yT3, -654.8, yPC, 8.6, 5, false);
  for (const dx of [-4.5, -1.5, 1.5, 4.5]) {
    addCrispDragonRampCheek(stonePb, bdAxisX + dx, yT3, -653.0, yPC, -654.8, 0.95);
  }
  addCurvedRoofSanctuary({
    cx: bdAxisX,
    yPlatformTop: yPC,
    cz: pcZ,
    width: 23.2,
    depth: 12.2,
    colH: 5.4,
    tiers: 2,
    colsX: 6,
    colsZ: 4,
    openFrontPortal: true,
    finialMode: 'crisp',
    finialScale: 1.05,
    roofPb: baiDinhHeroRoofPb,
    woodPb,
    plasterPb: yellowPb,
    crimsonPb,
    goldPb,
    stonePb,
    voidPb
  });
  // Gilded 100-ton Sakyamuni Buddha (*Phật Pháp Chủ*) with double Bodhi-leaf mandorla & altar offerings
  crimsonPb.box(3.4, 0.92, 2.4, bdAxisX, yPC + 0.46, pcZ - 1.2);
  addCrispSeatedStatue(goldPb, goldPb, bdAxisX, yPC + 0.92, pcZ - 1.2, 1.65, true);
  addCrispBodhiHalo(goldPb, crimsonPb, bdAxisX, yPC + 0.92, pcZ - 1.2, 1.55);
  addCrispAltarOfferings(goldPb, crimsonPb, bdAxisX, yPC + 0.92, pcZ - 0.25, 1.25, 1.15);

  const pcSmokeY = addCrispBronzeTripod(stonePb, bronzePb, goldPb, bdAxisX, yT3, -651.6, 1.15);
  smokeSources.push({ x: bdAxisX, y: pcSmokeY, z: -651.6, scale: 1.15 });
  for (const s of [-1, 1]) {
    addCrispCraneOnTortoise(bronzePb, bdAxisX + s * 2.5, yT3, -651.6, -s * 0.35, 1.08);
    addCrispStoneLantern(stonePb, goldPb, bdAxisX + s * 6.8, yT3, -652.4, 1.05);
  }

  // 2) ĐIỆN TAM THẾ (3-Tier Grand Apex Sanctuary at `(472, -685.5)`)
  const ttZ = -685.5;
  const yTT = yT4 + 1.55;
  granitePb.box(29.6, 2.15, 16.2, bdAxisX, yT4 + 0.48, ttZ);
  addSteppedStairFlight(granitePb, stonePb, ctx, bdAxisX, -675.2, yT4, -677.4, yTT, 10.2, 6, false);
  for (const dx of [-5.3, -1.8, 1.8, 5.3]) {
    addCrispDragonRampCheek(stonePb, bdAxisX + dx, yT4, -675.2, yTT, -677.4, 1.05);
  }
  addCurvedRoofSanctuary({
    cx: bdAxisX,
    yPlatformTop: yTT,
    cz: ttZ,
    width: 27.2,
    depth: 14.0,
    colH: 5.8,
    tiers: 3,
    colsX: 6,
    colsZ: 4,
    openFrontPortal: true,
    finialMode: 'crisp',
    finialScale: 1.18,
    roofPb: baiDinhHeroRoofPb,
    woodPb,
    plasterPb: yellowPb,
    crimsonPb,
    goldPb,
    stonePb,
    voidPb
  });

  // Gilded Tam Thế Buddha Triad (Past, Present, Future) with Bodhi-leaf halos & altar offerings!
  crimsonPb.box(7.4, 1.05, 2.6, bdAxisX, yTT + 0.52, ttZ - 1.4);
  addCrispSeatedStatue(goldPb, goldPb, bdAxisX, yTT + 1.05, ttZ - 1.4, 1.55, true);
  addCrispBodhiHalo(goldPb, crimsonPb, bdAxisX, yTT + 1.05, ttZ - 1.4, 1.42);
  addCrispSeatedStatue(goldPb, goldPb, bdAxisX - 2.25, yTT + 1.05, ttZ - 1.4, 1.38, true);
  addCrispBodhiHalo(goldPb, crimsonPb, bdAxisX - 2.25, yTT + 1.05, ttZ - 1.4, 1.25);
  addCrispSeatedStatue(goldPb, goldPb, bdAxisX + 2.25, yTT + 1.05, ttZ - 1.4, 1.38, true);
  addCrispBodhiHalo(goldPb, crimsonPb, bdAxisX + 2.25, yTT + 1.05, ttZ - 1.4, 1.25);
  addCrispAltarOfferings(goldPb, crimsonPb, bdAxisX, yTT + 1.05, ttZ - 0.35, 2.6, 1.18);
  const ttSmokeY = addCrispBronzeTripod(stonePb, bronzePb, goldPb, bdAxisX, yT4, -674.2, 1.25);
  smokeSources.push({ x: bdAxisX, y: ttSmokeY, z: -674.2, scale: 1.25 });
  for (const s of [-1, 1]) {
    stonePb.add(...createAncientStoneLanternParts(bdAxisX + s * 7.8, yT4, -674.8, 1.18));
    addCrispCraneOnTortoise(bronzePb, bdAxisX + s * 2.8, yT4, -674.2, -s * 0.3, 1.12);
  }

  // --------------------------------------------------------------------------
  // G. CỐ ĐÔ HOA LƯ PRECINCT (`x = 395..430, z = -650..-610` — `BD-099..115`)
  // --------------------------------------------------------------------------
  const gHL = sampleTerrainRange(ctx, 395, 430, -650, -608, 6);
  const yHL = gHL.maxY + 0.70;
  // Main Hoa Lư walled courtyard terrace (`z = -648..-616`, `x = 396..429`)
  addGroundedTerrace(stonePb, batTrangPb, ctx, 412.5, -632.0, 33.0, 32.0, yHL, 5.2, 0.9);
  // Forecourt south of Sào Khê River (`z = -609..-606`)
  addGroundedTerrace(stonePb, granitePb, ctx, 412.5, -607.2, 26.0, 3.8, yHL - 0.35, 5.0, 0.4);

  // 1) DRAMATIC NINH BÌNH LIMESTONE KARST CRAGS — placed strictly BEHIND Hoa Lư (`z = -668..-678`, >= 13m clear of temples!)
  const karstSpecs: Array<[number, number, number, number, number]> = [
    [397.5, -669.0, 7.2, 27.5, 101], // Mã Yên Mountain West peak
    [409.5, -673.5, 7.8, 32.0, 205], // Central limestone pinnacle
    [421.5, -671.0, 7.4, 29.0, 309], // Twin-horn Hoa Lư karst
    [430.0, -668.5, 6.4, 25.0, 412]  // East limestone crag
  ];
  for (const [kx, kz, kr, kh, kSeed] of karstSpecs) {
    const ky = ctx.getHeight(kx, kz) - 3.8;
    const karstGeo = createHaLongKarstGeometry(kSeed, kr, kh + 3.8, 0.3, -0.2);
    karstGeo.translate(kx, ky, kz);
    stonePb.add(karstGeo);
    // Emerald mountain-crest karst vegetation cap strictly on upper crag summit
    const capPuff = createSculptedRockGeometry(kSeed + 77, kr * 0.62, 1.8, kr * 0.62, 0);
    capPuff.translate(kx, ky + kh + 2.4, kz);
    foliagePb.add(capPuff);
  }

  // 2) SÔNG SÀO KHÊ & CẦU ĐÁ ĐÔNG (`z = -612.2`, `x = 395..430`)
  const skZ = -612.2;
  stonePb.box(34.0, 3.8, 0.65, 412.5, yHL - 2.0, skZ - 2.4);
  stonePb.box(34.0, 3.8, 0.65, 412.5, yHL - 2.0, skZ + 2.4);
  voidPb.box(33.6, 0.3, 4.3, 412.5, yHL - 0.95, skZ);
  waterPb.box(33.6, 0.08, 4.3, 412.5, yHL - 0.55, skZ);
  for (const lx of [401.5, 405.0, 420.5, 424.5]) {
    foliagePb.add(createNotchedLotusPadGeometry(0.38, 8).translate(lx, yHL - 0.49, skZ + (lx % 2 === 0 ? 0.6 : -0.5)));
  }

  // Arched Grey-Stone Bridge (*Cầu Đá Sông Sào Khê*) centered at `(412.5, -612.2)`
  const brX = 412.5;
  const archWall = createArchedWallGeometry(4.4, 1.65, 5.4, 2.8, 1.25);
  archWall.rotateY(Math.PI * 0.5);
  archWall.translate(brX, yHL - 1.15, skZ);
  granitePb.add(archWall);
  // Gently cambered bridge deck + carved stone lotus railings
  granitePb.box(4.2, 0.24, 2.8, brX, yHL + 0.42, skZ);
  granitePb.box(4.2, 0.22, 1.8, brX, yHL + 0.24, skZ - 2.1, { rx: 0.16 });
  granitePb.box(4.2, 0.22, 1.8, brX, yHL + 0.24, skZ + 2.1, { rx: -0.16 });
  for (const sx of [-1.95, 1.95]) {
    addCrispStoneBalustrade(stonePb, brX + sx, skZ - 2.8, brX + sx, skZ + 2.8, yHL + 0.42, 0.78);
    addCrispStoneLantern(stonePb, goldPb, brX + sx, yHL - 0.35, skZ + 3.45, 0.78);
  }

  // 3) CỔNG NGỌ MÔN NGOẠI HOA LƯ (3-Arch Mossy Brick Gate at `(412.5, -618.2)`)
  const nmZ = -618.2;
  const gateBody = createArchedWallGeometry(11.6, 4.15, 2.15, 2.55, 3.05);
  gateBody.translate(brX, yHL, nmZ);
  brickDetailPb.add(gateBody);
  // Carved brick arch keystone & gilded Hoa Lư *Ngọ Môn Ngoại* gate plaque
  stonePb.box(0.55, 0.48, 2.28, brX, yHL + 3.16, nmZ);
  crimsonPb.box(2.55, 0.62, 0.14, brX, yHL + 3.68, nmZ + 1.12);
  goldPb.box(2.72, 0.74, 0.08, brX, yHL + 3.68, nmZ + 1.09);
  // Flanking side portal arches + mossy boundary walls enclosing Hoa Lư precinct
  for (const sx of [-4.1, 4.1]) {
    voidPb.box(1.45, 2.35, 2.22, brX + sx, yHL + 1.18, nmZ);
    stonePb.box(1.75, 0.22, 2.30, brX + sx, yHL + 2.42, nmZ);
  }
  brickDetailPb.box(9.8, 2.25, 0.42, 401.6, yHL + 1.12, nmZ);
  brickDetailPb.box(9.8, 2.25, 0.42, 423.4, yHL + 1.12, nmZ);
  minorTerraRoofPb.box(10.0, 0.28, 0.68, 401.6, yHL + 2.32, nmZ);
  minorTerraRoofPb.box(10.0, 0.28, 0.68, 423.4, yHL + 2.32, nmZ);

  // 2-tier mossy dark curved pavilion (*Vọng Lâu*) crowning Ngọ Môn Ngoại
  const nmRoof1 = createHueImperialHipRoofGeometry(12.6, 4.2, 7.6, 2.4, 1.25, 0.28, 4, 3, true);
  nmRoof1.translate(brX, yHL + 4.08, nmZ);
  hoaLuHeroRoofPb.add(nmRoof1);
  brickDetailPb.box(6.8, 1.35, 2.1, brX, yHL + 5.75, nmZ);
  const nmRoof2 = createHueImperialHipRoofGeometry(8.4, 3.6, 3.8, 0.32, 1.38, 0.32, 4, 3, true);
  nmRoof2.translate(brX, yHL + 6.36, nmZ);
  hoaLuHeroRoofPb.add(nmRoof2);
  stonePb.box(3.9, 0.22, 0.28, brX, yHL + 7.72, nmZ);

  // Carved Stone *Bình Phong* (Spirit Screen) inside courtyard axis
  stonePb.box(3.8, 2.15, 0.42, brX, yHL + 1.08, -622.6);
  granitePb.add(...createBasReliefPanelParts(brX, yHL + 1.12, -622.36, 2.8, 1.35, 0, 'tu_quy'));
  hoaLuHeroRoofPb.box(4.3, 0.26, 0.72, brX, yHL + 2.24, -622.6);

  // 4) ĐỀN VUA ĐINH TIÊN HOÀNG (`(404.8, -637.5)`) & ĐỀN VUA LÊ ĐẠI HÀNH (`(420.8, -638.5)`)
  //    with courtyard Long Sàng Đá (monolithic stone dragon beds) & stone guardian Nghê!
  const dinhX = 404.8;
  const dinhZ = -637.5;
  const yDinh = yHL + 0.65;
  granitePb.box(12.2, 0.85, 9.8, dinhX, yHL + 0.22, dinhZ);
  addCurvedRoofSanctuary({
    cx: dinhX,
    yPlatformTop: yDinh,
    cz: dinhZ,
    width: 11.0,
    depth: 8.6,
    colH: 3.95,
    tiers: 2,
    colsX: 4,
    colsZ: 3,
    openFrontPortal: true,
    finialMode: 'crisp',
    finialScale: 0.76,
    roofPb: hoaLuHeroRoofPb,
    woodPb,
    plasterPb,
    crimsonPb,
    goldPb,
    stonePb,
    voidPb
  });
  // Gilded Emperor Đinh Tiên Hoàng statue & altar offerings + stepped stone *ngưỡng cửa* + Long Sàng Đá #1 & twin Nghê
  addCrispSeatedStatue(goldPb, goldPb, dinhX, yDinh + 0.55, dinhZ - 0.8, 1.05, false);
  crimsonPb.box(2.0, 0.55, 1.4, dinhX, yDinh + 0.28, dinhZ - 0.8);
  addCrispAltarOfferings(goldPb, crimsonPb, dinhX, yDinh + 0.55, dinhZ - 0.25, 0.72, 0.85);
  granitePb.box(3.4, 0.34, 0.55, dinhX, yHL + 0.17, dinhZ + 5.15);
  stonePb.box(2.8, 0.16, 0.24, dinhX, yDinh + 0.08, dinhZ + 3.15); // Iconic Đền Vua Đinh carved stone threshold (`ngưỡng cửa đá`)
  addHoaLuLongSangDa(stonePb, granitePb, goldPb, woodPb, dinhX, yHL + 0.04, -629.6);
  for (const s of [-1, 1]) {
    stonePb.add(...createGuardianBeastParts(dinhX + s * 2.15, yHL + 0.04, -629.6, 0, 0.92, 'nghe'));
  }
  stonePb.cyl(0.55, 0.65, 0.30, 6, dinhX, yHL + 0.15, -626.8);
  bronzePb.cyl(0.42, 0.32, 0.62, 6, dinhX, yHL + 0.58, -626.8);
  goldPb.cone(0.18, 0.28, 5, dinhX, yHL + 1.02, -626.8);
  smokeSources.push({ x: dinhX, y: yHL + 1.18, z: -626.8, scale: 0.88 });

  // Đền Vua Lê Đại Hành (`(420.8, -638.5)`)
  const leX = 420.8;
  const leZ = -638.5;
  const yLe = yHL + 0.60;
  granitePb.box(11.2, 0.80, 9.2, leX, yHL + 0.20, leZ);
  addCurvedRoofSanctuary({
    cx: leX,
    yPlatformTop: yLe,
    cz: leZ,
    width: 10.0,
    depth: 8.0,
    colH: 3.80,
    tiers: 2,
    colsX: 4,
    colsZ: 3,
    openFrontPortal: true,
    finialMode: 'crisp',
    finialScale: 0.72,
    roofPb: hoaLuHeroRoofPb,
    woodPb,
    plasterPb,
    crimsonPb,
    goldPb,
    stonePb,
    voidPb
  });
  // Real-life Đền Vua Lê Hậu Cung Triad: Vua Lê Đại Hành (center), Thái hậu Dương Vân Nga (left), Khải Minh Vương (right)
  crimsonPb.box(3.15, 0.52, 1.35, leX, yLe + 0.26, leZ - 0.7);
  addCrispSeatedStatue(goldPb, goldPb, leX, yLe + 0.52, leZ - 0.7, 0.98, false);
  addCrispSeatedStatue(goldPb, goldPb, leX - 1.02, yLe + 0.52, leZ - 0.65, 0.76, false);
  addCrispSeatedStatue(goldPb, goldPb, leX + 1.02, yLe + 0.52, leZ - 0.65, 0.76, false);
  addCrispAltarOfferings(goldPb, crimsonPb, leX, yLe + 0.52, leZ - 0.15, 1.15, 0.82);
  granitePb.box(3.2, 0.30, 0.52, leX, yHL + 0.15, leZ + 4.82);
  addHoaLuLongSangDa(stonePb, granitePb, goldPb, woodPb, leX, yHL + 0.04, -630.8);
  for (const s of [-1, 1]) {
    // Low-poly guardian stone Nghê pair flanking Long Sàng Đá #2
    const nx = leX + s * 2.0;
    stonePb.box(0.66, 0.26, 0.76, nx, yHL + 0.13, -630.8);
    stonePb.cyl(0.16, 0.22, 0.52, 5, nx, yHL + 0.52, -630.8);
    stonePb.sphere(0.16, 5, 4, nx, yHL + 0.86, -630.68);
  }
  // Courtyard bronze incense tripod & smoke in front of Đền Vua Lê
  stonePb.cyl(0.52, 0.62, 0.28, 6, leX, yHL + 0.14, -627.6);
  bronzePb.cyl(0.40, 0.30, 0.58, 6, leX, yHL + 0.55, -627.6);
  goldPb.cone(0.16, 0.26, 5, leX, yHL + 0.96, -627.6);
  smokeSources.push({ x: leX, y: yHL + 1.12, z: -627.6, scale: 0.82 });

  // Lacquered *Bát Bửu* ceremonial weapon racks flanking Đền Vua Đinh & Đền Vua Lê front portals
  for (const s of [-1, 1]) {
    addCrispBatBuuRack(woodPb, crimsonPb, goldPb, dinhX + s * 3.65, yHL, dinhZ + 5.15, 0.95);
    addCrispBatBuuRack(woodPb, crimsonPb, goldPb, leX + s * 3.45, yHL, leZ + 4.82, 0.92);
  }

  // Ceremonial gilded royal palanquin (*Kiệu Rước Long Đình*) resting on trestles between Đền Vua Đinh & Đền Vua Lê
  const palX = 412.8;
  const palZ = -632.5;
  for (const sz of [-1.05, 1.05]) {
    woodPb.box(1.38, 0.52, 0.16, palX, yHL + 0.26, palZ + sz);
  }
  for (const sx of [-0.54, 0.54]) {
    crimsonPb.cyl(0.045, 0.045, 3.65, 5, palX + sx, yHL + 0.56, palZ, { rx: Math.PI * 0.5 });
    for (const sz of [-1.85, 1.85]) {
      goldPb.sphere(0.065, 4, 3, palX + sx, yHL + 0.56, palZ + sz);
    }
  }
  crimsonPb.box(1.18, 0.34, 1.38, palX, yHL + 0.74, palZ);
  goldPb.box(1.24, 0.12, 1.44, palX, yHL + 0.94, palZ);
  for (const sx of [-0.48, 0.48]) {
    for (const sz of [-0.56, 0.56]) {
      goldPb.cyl(0.04, 0.045, 1.15, 5, palX + sx, yHL + 1.54, palZ + sz);
    }
  }
  crimsonPb.cone(0.96, 0.54, 4, palX, yHL + 2.36, palZ, { ry: Math.PI * 0.25 });
  goldPb.cone(0.64, 0.42, 4, palX, yHL + 2.74, palZ, { ry: Math.PI * 0.25 });
  goldPb.sphere(0.11, 5, 4, palX, yHL + 3.00, palZ);

  // 5) FESTIVE 5-COLOR HOA LƯ FESTIVAL BANNERS (*Cờ Ngũ Sắc Lễ Hội Trường Yên*)
  const bannerSpecs: Array<{ x: number; y: number; z: number; pb: PartsBuilder }> = [
    { x: 407.8, y: yHL, z: -616.5, pb: crimsonPb }, // Red (Fire)
    { x: 417.2, y: yHL, z: -616.5, pb: goldPb },    // Yellow (Earth)
    { x: 400.2, y: yHL, z: -625.5, pb: bronzePb },  // Verdigris-Blue (Water)
    { x: 425.2, y: yHL, z: -625.5, pb: foliagePb }, // Green (Wood)
    { x: 412.8, y: yHL, z: -626.0, pb: marblePb }   // White (Metal)
  ];
  for (let bi = 0; bi < bannerSpecs.length; bi++) {
    const b = bannerSpecs[bi];
    stonePb.box(0.46, 0.36, 0.46, b.x, b.y + 0.18, b.z);
    woodPb.cyl(0.045, 0.062, 5.4, 5, b.x, b.y + 2.65, b.z);
    goldPb.cone(0.08, 0.24, 5, b.x, b.y + 5.46, b.z);
    const flagGeo = new THREE.PlaneGeometry(1.15, 2.15, 4, 2);
    const fPos = flagGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const u = (fPos.getX(vi) + 0.575) / 1.15;
      fPos.setZ(vi, Math.sin(u * Math.PI * 2.2 + bi) * 0.12 * u);
    }
    flagGeo.computeVertexNormals();
    flagGeo.translate(b.x + 0.60, b.y + 4.15, b.z);
    b.pb.add(flagGeo);
    crimsonPb.box(1.22, 0.10, 0.06, b.x + 0.60, b.y + 5.22, b.z);
  }

  // Ornamental courtyard bonsai / Bodhi trees on wide terrace margins (>= 7m clear of every roof!)
  for (const [tx, ty, tz] of [
    [495.5, yT1, -585.5],
    [497.5, yT1, -596.0],
    [453.0, yT3, -654.0],
    [491.0, yT3, -654.0]
  ]) {
    stonePb.cyl(0.95, 1.05, 0.48, 6, tx, ty + 0.24, tz);
    barkPb.cyl(0.16, 0.26, 2.4, 5, tx, ty + 1.3, tz);
    const crown = createSculptedRockGeometry(Math.round(tx + Math.abs(tz)), 1.45, 1.05, 1.45, 1);
    crown.translate(tx, ty + 2.75, tz);
    foliagePb.add(crown);
  }

  // Emit merged meshes — ONLY the 3 Bái Đính / Hoa Lư hero meshes have castShadow = true!
  emitBuilderMesh(group, stupaHeroBrickPb, crimsonMat, 'BaiDinhStupa13StoryHero', true, true, 2.2);
  emitBuilderMesh(group, baiDinhHeroRoofPb, terraRoofMat, 'BaiDinhMainSanctuaryRoofsHero', true, true);
  emitBuilderMesh(group, hoaLuHeroRoofPb, mossyRoofMat, 'HoaLuTempleRoofsHero', true, true);

  // All supporting architecture, steps, railings, statues, lanterns, trees -> castShadow = false!
  emitBuilderMesh(group, stonePb, stoneMat, 'BaiDinhHoaLuStonework', false, true, 2.4);
  emitBuilderMesh(group, granitePb, graniteMat, 'BaiDinhHoaLuGranite', false, true, 2.4);
  emitBuilderMesh(group, marblePb, whiteMarbleMat, 'BaiDinhHoaLuWhiteMarble', false, true, 2.0);
  emitBuilderMesh(group, plasterPb, whitePlasterMat, 'BaiDinhHoaLuPlaster', false, true, 2.2);
  emitBuilderMesh(group, yellowPb, yellowPlasterMat, 'BaiDinhHoaLuYellowPlaster', false, true, 2.2);
  emitBuilderMesh(group, crimsonPb, crimsonMat, 'BaiDinhHoaLuCrimsonLacquer', false, true);
  emitBuilderMesh(group, woodPb, ironwoodMat, 'BaiDinhHoaLuIronwood', false, true);
  emitBuilderMesh(group, minorTerraRoofPb, terraRoofMat, 'BaiDinhGalleryAndStupaEaves', false, true);
  emitBuilderMesh(group, brickDetailPb, chamBrickMat, 'HoaLuAncientBrickwork', false, true, 1.8);
  emitBuilderMesh(group, batTrangPb, batTrangMat, 'BaiDinhHoaLuBatTrangPaving', false, true, 2.0);
  emitBuilderMesh(group, goldPb, goldMat, 'BaiDinhHoaLuGildedDetails', false, false);
  emitBuilderMesh(group, bronzePb, bronzeMat, 'BaiDinhHoaLuBronzes', false, true);
  emitBuilderMesh(group, voidPb, voidMat, 'BaiDinhHoaLuPortalVoids', false, false);
  emitBuilderMesh(group, lanternSilkPb, lanternSilkMat, 'BaiDinhLanternSilk', false, false);
  emitBuilderMesh(group, lanternCorePb, lanternCoreMat, 'BaiDinhLanternCore', false, false);
  emitBuilderMesh(group, foliagePb, foliageMat, 'BaiDinhHoaLuFoliage', false, true);
  emitBuilderMesh(group, barkPb, barkMat, 'BaiDinhHoaLuBark', false, true);
  emitBuilderMesh(group, waterPb, waterMat, 'BaiDinhHoaLuSacredWaters', false, true);

  addIncenseSmoke(ctx, flagUniforms, group, smokeSources, 'BaiDinhHoaLuIncenseSmoke');

  ctx.scene.add(group);
}

// ============================================================================
// 2. NÚI THIÊNG YÊN TỬ SACRED MOUNTAIN COMPLEX (`(240, -780)`) — `BD-116..220`
// ============================================================================

function buildYenTuSacredMountainComplex(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const group = new THREE.Group();
  group.name = 'YenTuSacredMountainComplex';
  group.userData = {
    landmarkId: 'yen_tu_sacred_mountain',
    centerX: 240,
    centerZ: -780
  };
  tagMotifIds(group, YEN_TU_MOTIF_IDS);

  ctx.exclusionCircles.push(
    { x: 240, z: -726, r: 30 },
    { x: 240, z: -756, r: 36 },
    { x: 240, z: -785, r: 40 },
    { x: 240, z: -812, r: 30 }
  );

  // Reuse ONLY ctx.materials.*
  const graniteMat = ctx.materials.granite;
  const stoneMat = ctx.materials.stone;
  const whitePlasterMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const yellowPlasterMat = ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster;
  const crimsonMat = ctx.materials.crimsonLacquer;
  const ironwoodMat = ctx.materials.darkIronwood ?? ctx.materials.darkWood;
  const terraRoofMat = ctx.materials.terracottaRoof;
  const chamBrickMat = ctx.materials.weatheredImperialBrick ?? ctx.materials.chamBrick;
  const bronzeMat = ctx.materials.bronze;
  const bronzePatinaMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  const goldMat = ctx.materials.gold;
  const voidMat = ctx.materials.darkVoid;
  const barkMat = ctx.materials.bark;
  const foliageMat = ctx.materials.jadeRoof ?? ctx.materials.darkRoof;
  const bambooMat = ctx.materials.bambooWeave ?? ctx.materials.yellowOchrePlaster;
  const waterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.jadeRoof ?? ctx.materials.granite;

  // HERO SHADOW MESHES #4 & #5 (`castShadow = true`):
  //   #4 mountainHeroGranitePb (34.2m rising sacred Yên Tử granite summit massif & stepped cliff walls)
  //   #5 chuaDongHeroBronzePb (100% cast-bronze Chùa Đồng — Thiên Trúc Tự at the peak apex)
  const mountainHeroGranitePb = new PartsBuilder();
  const chuaDongHeroBronzePb = new PartsBuilder();

  // Supporting non-shadow accumulators (`castShadow = false`)
  const stonePb = new PartsBuilder();
  const graniteDetailPb = new PartsBuilder();
  const whitePb = new PartsBuilder();
  const yellowPb = new PartsBuilder();
  const crimsonPb = new PartsBuilder();
  const woodPb = new PartsBuilder();
  const terraRoofPb = new PartsBuilder();
  const brickPb = new PartsBuilder();
  const bronzeDetailPb = new PartsBuilder();
  const goldPb = new PartsBuilder();
  const voidPb = new PartsBuilder();
  const barkPb = new PartsBuilder();
  const foliagePb = new PartsBuilder();
  const bambooPb = new PartsBuilder();
  const waterPb = new PartsBuilder();

  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  // --------------------------------------------------------------------------
  // SACRED MOUNTAIN ELEVATION SPINE (~34.2m rise from Suối Giải Oan to Chùa Đồng!)
  // --------------------------------------------------------------------------
  const ytX = 240.0;
  const gAll = sampleTerrainRange(ctx, 200, 280, -824, -716, 8);
  const gFoot = sampleTerrainRange(ctx, 214, 266, -736, -716, 6);
  const yFoot = gFoot.maxY + 0.55;
  const mountainBotY = gAll.minY - 6.5;

  const yHoaYen = Math.max(yFoot + 10.6, gAll.maxY + 6.5);
  const yPhatHoang = yHoaYen + 11.2;
  const ySummit = Math.max(yFoot + 34.2, yPhatHoang + 12.4);

  // Helper to add a flat-topped carved granite cliff shelf inside `mountainHeroGranitePb`
  const addGraniteCliffShelf = (cx: number, cz: number, w: number, d: number, topY: number) => {
    const h = Math.max(2.0, topY - mountainBotY);
    mountainHeroGranitePb.box(w, h, d, cx, mountainBotY + h * 0.5, cz);
    stonePb.box(w + 0.4, 0.26, d + 0.4, cx, topY - 0.13, cz);
  };

  // Build the 3 flat carved mountain shelves + sheer sculpted granite crag flanks (ZERO burial of temple decks!)
  // 1) Mid-Mountain Shelf (Vườn Tháp Huệ Quang & Chùa Hoa Yên): `x = 216..264, z = -776..-754`
  addGraniteCliffShelf(ytX, -765.0, 48.0, 22.0, yHoaYen);
  // 2) Upper Ridge Shelf (Quảng Trường Phật Hoàng Trần Nhân Tông): `x = 221..259, z = -799..-782`
  addGraniteCliffShelf(ytX, -790.5, 38.0, 17.0, yPhatHoang);
  // 3) Summit Crown Shelf (Chùa Đồng — Thiên Trúc Tự Apex): `x = 232.5..247.5, z = -818.5..-806.5`
  addGraniteCliffShelf(ytX, -812.5, 15.0, 12.0, ySummit);

  // Sculpted Granite Mountain Massif Crags wrapping strictly OUTSIDE the flat temple ledges!
  // Every crag's (cx + rx, cy + ry, cz + rz) is verified clear of all flat ledges & temple roofs.
  const mountainCrags: Array<[number, number, number, number, number, number, number]> = [
    // Lower mountain shoulders flanking Đường Tùng Cổ (`x <= 217` & `x >= 263`)
    [211.0, yFoot + 3.2, -744.0, 9.5, 7.5, 10.5, 701],
    [269.0, yFoot + 3.4, -745.0, 9.5, 7.8, 10.5, 702],
    // Mid-mountain granite cliff buttresses flanking Hoa Yên (`x = 205 / 275`, >= 11m outside `216..264`)
    [205.5, yHoaYen - 2.0, -765.0, 10.0, 11.5, 13.5, 703],
    [274.5, yHoaYen - 1.8, -766.0, 10.0, 11.8, 13.5, 704],
    // Upper ridge sheer granite flanks outside Phật Hoàng Plaza (`x = 208 / 272`, >= 13m outside `221..259`)
    [208.5, yPhatHoang - 3.5, -790.0, 11.5, 16.5, 13.0, 705],
    [271.5, yPhatHoang - 3.2, -790.5, 11.5, 16.8, 13.0, 706],
    // Summit Peak Jagged Granite Massif wrapping around and BELOW `ySummit - 0.6m`!
    // Notice `cy + ry * 1.16 <= ySummit - 0.6` where near the summit crown, and taller crag spires ONLY behind `z <= -824.5`!
    [223.0, ySummit - 12.5, -811.0, 9.2, 10.0, 10.5, 707],
    [257.0, ySummit - 12.5, -811.0, 9.2, 10.0, 10.5, 708],
    [240.0, ySummit - 14.0, -823.5, 14.0, 11.5, 8.5, 709],
    [228.5, ySummit - 7.5, -820.5, 6.8, 5.8, 6.5, 710],
    [251.5, ySummit - 7.5, -820.5, 6.8, 5.8, 6.5, 711],
    // Lower cliff skirt anchors grounding all mountain flanks -6m below terrain
    [216.0, yFoot + 1.5, -778.0, 11.0, 9.0, 10.0, 712],
    [264.0, yFoot + 1.5, -778.0, 11.0, 9.0, 10.0, 713],
    [224.0, yFoot + 5.5, -804.0, 12.0, 14.0, 10.0, 714],
    [256.0, yFoot + 5.5, -804.0, 12.0, 14.0, 10.0, 715]
  ];
  for (const [rx, ry, rz, sx, sy, sz, rSeed] of mountainCrags) {
    const crag = createSculptedRockGeometry(rSeed, sx, sy, sz, 1);
    crag.translate(rx, ry, rz);
    mountainHeroGranitePb.add(crag);
    // Sub-skirt plinth beneath each crag so zero floating rock bellies ever appear on steep slopes
    const skirtH = Math.max(1.5, ry - mountainBotY);
    mountainHeroGranitePb.box(sx * 1.15, skirtH, sz * 1.15, rx, mountainBotY + skirtH * 0.5, rz);
  }

  // Mountain Mist-Pine & Cliff Shrub Tufts on outer granite shoulders (>= 12m clear of all temples!)
  for (const [fx, fy, fz, fr, fSeed] of [
    [206.0, yHoaYen + 8.8, -765.0, 3.2, 801],
    [274.0, yHoaYen + 9.0, -766.0, 3.2, 802],
    [209.0, yPhatHoang + 12.0, -790.0, 3.4, 803],
    [271.0, yPhatHoang + 12.2, -790.5, 3.4, 804],
    [222.5, ySummit - 2.2, -812.0, 2.4, 805],
    [257.5, ySummit - 2.2, -812.0, 2.4, 806]
  ]) {
    const tuft = createSculptedRockGeometry(fSeed, fr, fr * 0.55, fr, 0);
    tuft.translate(fx, fy, fz);
    foliagePb.add(tuft);
  }

  // --------------------------------------------------------------------------
  // A. SUỐI GIẢI OAN, CẦU ĐÁ & ĐƯỜNG TÙNG CỔ 700 NĂM (`BD-116..145`)
  // --------------------------------------------------------------------------
  // Mountain foot arrival terrace (`z = -720.5..-716.0`) & streamside landing (`z = -732.0..-728.5`)
  addGroundedTerrace(stonePb, graniteDetailPb, ctx, ytX, -718.5, 22.0, 5.2, yFoot, 5.0, 0.5);
  addGroundedTerrace(stonePb, graniteDetailPb, ctx, ytX, -730.8, 34.0, 6.2, yFoot + 0.25, 5.0, 0.6);

  // Stone Four-Pillar Entrance Gate (*Cổng Khai Tâm Yên Tử*) at `(240, -717.2)`
  for (const [px, ph] of [
    [-2.4, 5.2],
    [2.4, 5.2],
    [-4.8, 3.9],
    [4.8, 3.9]
  ] as const) {
    stonePb.box(0.62, ph + 0.2, 0.62, ytX + px, yFoot + ph * 0.5 - 0.1, -717.2);
    addCrispLotusPost(stonePb, ytX + px, yFoot + ph, -717.2, 1.15);
  }
  graniteDetailPb.box(5.4, 0.52, 0.48, ytX, yFoot + 4.35, -717.2);
  goldPb.box(3.2, 0.42, 0.54, ytX, yFoot + 4.35, -717.2);

  // Suối Giải Oan Stream (`z = -724.6`, `x = 218..262`) + weathered river boulders outside bridge
  const sgoZ = -724.6;
  stonePb.box(42.0, 3.4, 0.65, ytX, yFoot - 1.85, sgoZ + 3.1);
  stonePb.box(42.0, 3.4, 0.65, ytX, yFoot - 1.85, sgoZ - 3.1);
  voidPb.box(41.6, 0.3, 5.6, ytX, yFoot - 0.85, sgoZ);
  waterPb.box(41.6, 0.08, 5.6, ytX, yFoot - 0.42, sgoZ);
  for (const [bx, bz, br] of [
    [228.5, sgoZ - 0.8, 1.35],
    [232.0, sgoZ + 1.1, 1.05],
    [248.5, sgoZ - 0.9, 1.25],
    [252.5, sgoZ + 0.8, 1.45]
  ]) {
    graniteDetailPb.add(createSculptedRockGeometry(Math.round(bx * 10), br, br * 0.65, br * 0.9, 1).translate(bx, yFoot - 0.35, bz));
  }

  // Cầu Đá Giải Oan (Arched Green-Stone Bridge spanning `z = -728.2..-721.0` at `x = 240`)
  const goBridgeArch = createArchedWallGeometry(4.6, 1.85, 7.2, 3.4, 1.35);
  goBridgeArch.rotateY(Math.PI * 0.5);
  goBridgeArch.translate(ytX, yFoot - 1.05, sgoZ);
  stonePb.add(goBridgeArch);
  graniteDetailPb.box(4.4, 0.24, 3.6, ytX, yFoot + 0.68, sgoZ);
  graniteDetailPb.box(4.4, 0.22, 2.1, ytX, yFoot + 0.38, sgoZ + 2.65, { rx: -0.22 });
  graniteDetailPb.box(4.4, 0.22, 2.1, ytX, yFoot + 0.45, sgoZ - 2.65, { rx: 0.16 });
  for (const sx of [-2.02, 2.02]) {
    addCrispStoneBalustrade(stonePb, ytX + sx, sgoZ - 3.6, ytX + sx, sgoZ + 3.6, yFoot + 0.62, 0.82);
    addCrispStoneLantern(stonePb, goldPb, ytX + sx, yFoot, sgoZ + 4.05, 0.82);
  }
  // Carved stone bridge keystone medallion on Cầu Đá Giải Oan
  graniteDetailPb.box(4.68, 0.34, 0.42, ytX, yFoot + 0.32, sgoZ);

  // Small Streamside Chùa Giải Oan Shrine at `(251.5, -731.0)` (>= 6m clear of trail pines!)
  const goShrineX = 251.5;
  const goShrineZ = -731.0;
  const yGO = yFoot + 0.72;
  graniteDetailPb.box(6.4, 0.65, 5.2, goShrineX, yFoot + 0.42, goShrineZ);
  for (const ox of [-2.4, 0, 2.4]) {
    for (const oz of [-1.9, 1.9]) {
      addEmbeddedColumn(woodPb, stonePb, goShrineX + ox, yGO, goShrineZ + oz, 2.85, 0.18, 5);
    }
  }
  whitePb.box(4.8, 2.85, 0.28, goShrineX, yGO + 1.42, goShrineZ - 1.85);
  // Front red-and-gold *Chùa Giải Oan* Hoành Phi plaque, altar, seated Buddha & forecourt censer
  crimsonPb.box(2.15, 0.48, 0.12, goShrineX, yGO + 2.48, goShrineZ + 1.98);
  goldPb.box(2.28, 0.56, 0.08, goShrineX, yGO + 2.48, goShrineZ + 1.94);
  crimsonPb.box(1.85, 0.54, 1.15, goShrineX, yGO + 0.27, goShrineZ - 0.95);
  addCrispSeatedStatue(goldPb, goldPb, goShrineX, yGO + 0.54, goShrineZ - 0.95, 0.78, true);
  stonePb.cyl(0.42, 0.50, 0.24, 6, goShrineX, yFoot + 0.37, goShrineZ + 3.25);
  bronzeDetailPb.cyl(0.32, 0.24, 0.46, 6, goShrineX, yFoot + 0.68, goShrineZ + 3.25);
  const goRoof = createHueImperialHipRoofGeometry(7.4, 6.2, 3.4, 0.30, 1.45, 0.30, 4, 3, true);
  goRoof.translate(goShrineX, yGO + 2.78, goShrineZ);
  terraRoofPb.add(goRoof);
  terraRoofPb.box(3.5, 0.22, 0.28, goShrineX, yGO + 4.21, goShrineZ);
  addCrispRidgeFinials(terraRoofPb, goldPb, goShrineX, yGO + 4.22, goShrineZ, 3.4, 0.64);

  // Đường Tùng Cổ 700 Năm — Stepped Granite Pilgrim Stairway climbing `z = -733.5 -> -754.2` (`yFoot + 0.25 -> yHoaYen`)
  addSteppedStairFlight(
    graniteDetailPb,
    stonePb,
    ctx,
    ytX,
    -733.2,
    yFoot + 0.25,
    -754.4,
    yHoaYen,
    5.6,
    14,
    true
  );
  // 6 Paired Carved Stone Pilgrim Trail Lanterns & Base Trail Stele (`Bia Đường Tùng Cổ`)
  for (let tl = 0; tl < 3; tl++) {
    const tFrac = (tl + 0.5) / 3;
    const tlz = THREE.MathUtils.lerp(-734.5, -751.5, tFrac);
    const tly = THREE.MathUtils.lerp(yFoot + 0.55, yHoaYen - 1.1, tFrac);
    for (const s of [-1, 1]) {
      addCrispStoneLantern(stonePb, goldPb, ytX + s * 3.18, tly + 0.15, tlz, 0.72);
    }
  }
  // Trailhead stele at West landing (`(235.5, -731.5)`)
  stonePb.box(1.15, 0.28, 0.78, ytX - 4.5, yFoot + 0.39, -731.5);
  graniteDetailPb.box(0.86, 1.38, 0.22, ytX - 4.5, yFoot + 1.18, -731.5);
  stonePb.cone(0.58, 0.32, 4, ytX - 4.5, yFoot + 2.02, -731.5, { ry: Math.PI * 0.25 });

  // Đường Tùng Cổ carved granite pilgrim resting benches (*ghế đá nghỉ chân*) & waymarker milestones (*cột mốc hành hương*)
  for (const [bz, tFrac] of [
    [-737.65, 0.21],
    [-746.1, 0.61]
  ] as const) {
    const by = THREE.MathUtils.lerp(yFoot + 0.25, yHoaYen, tFrac);
    for (const side of [-1, 1]) {
      const bx = ytX + side * 4.55;
      const gY = ctx.getHeight(bx, bz) - 4.5;
      const padH = Math.max(1.2, by - gY);
      stonePb.box(1.15, padH, 2.25, bx, gY + padH * 0.5, bz);
      graniteDetailPb.box(0.52, 0.42, 0.22, bx, by + 0.21, bz - 0.68);
      graniteDetailPb.box(0.52, 0.42, 0.22, bx, by + 0.21, bz + 0.68);
      graniteDetailPb.box(0.68, 0.14, 1.86, bx, by + 0.48, bz);
    }
  }
  for (const [wx, wy, wz] of [
    [ytX - 3.35, yFoot + 0.65, -734.0],
    [ytX + 3.35, THREE.MathUtils.lerp(yFoot + 0.25, yHoaYen, 0.42), -742.0],
    [ytX - 3.35, THREE.MathUtils.lerp(yFoot + 0.25, yHoaYen, 0.79), -750.0],
    [ytX + 3.55, yHoaYen, -774.2]
  ] as const) {
    stonePb.box(0.56, 1.35, 0.48, wx, wy - 0.52, wz);
    graniteDetailPb.box(0.34, 1.12, 0.24, wx, wy + 0.68, wz);
    goldPb.box(0.26, 0.36, 0.26, wx, wy + 0.86, wz);
    stonePb.cone(0.28, 0.22, 4, wx, wy + 1.34, wz, { ry: Math.PI * 0.25 });
  }

  // 8 Gnarled 700-Year *Xích Tùng* Pines & 6 *Trúc Vàng* Golden Bamboo Clusters along the pilgrim trail
  // Placed at `z = -735..-748.5` (`>= 7.5m` south of Hoa Yên terrace buildings -> ZERO roof intersection!)
  const pineZs = [-735.5, -739.8, -744.0, -748.2];
  for (let i = 0; i < pineZs.length; i++) {
    const pz = pineZs[i];
    const tTrail = (i + 0.5) / pineZs.length;
    const py = THREE.MathUtils.lerp(yFoot + 0.9, yHoaYen - 1.8, tTrail);
    for (const side of [-1, 1]) {
      const px = ytX + side * 6.8;
      // Grounded stone root terrace pocket for each ancient pine
      stonePb.box(3.2, Math.max(2.0, py - (ctx.getHeight(px, pz) - 4.8)), 3.2, px, (py + (ctx.getHeight(px, pz) - 4.8)) * 0.5, pz);
      addAncientXichTungPine(barkPb, foliagePb, px, py, pz, 0.92, 910 + i * 7 + (side > 0 ? 3 : 0));
    }
  }
  for (let b = 0; b < 3; b++) {
    const bz = -736.8 - b * 5.2;
    const by = THREE.MathUtils.lerp(yFoot + 1.1, yHoaYen - 2.2, (b + 0.5) / 3);
    for (const side of [-1, 1]) {
      const bx = ytX + side * 10.4;
      stonePb.box(2.4, Math.max(1.8, by - (ctx.getHeight(bx, bz) - 4.8)), 2.4, bx, (by + (ctx.getHeight(bx, bz) - 4.8)) * 0.5, bz);
      addGoldenBambooCluster(bambooPb, foliagePb, bx, by, bz, 0.95, 960 + b * 11 + (side > 0 ? 5 : 0));
    }
  }

  // --------------------------------------------------------------------------
  // B. VƯỜN THÁP TỔ HUỆ QUANG & CHÙA HOA YÊN (`BD-146..175`) at `yHoaYen`
  // --------------------------------------------------------------------------
  // South cliff balustrade protecting the mid-mountain terrace
  addCrispStoneBalustrade(stonePb, 217.0, -754.4, ytX - 3.4, -754.4, yHoaYen, 0.92);
  addCrispStoneBalustrade(stonePb, ytX + 3.4, -754.4, 263.0, -754.4, yHoaYen, 0.92);

  // 1) THÁP TỔ HUỆ QUANG (9-Tier Sacred Patriarch Stupa at `(227.5, -765.5)`) + 12 Smaller Funerary Stupas!
  const hqX = 227.5;
  const hqZ = -765.5;
  // Trần-dynasty carved wave & lotus pedestal (`bệ sen sóng nước nhà Trần`)
  graniteDetailPb.box(4.2, 0.55, 4.2, hqX, yHoaYen + 0.20, hqZ);
  stonePb.box(3.8, 0.28, 3.8, hqX, yHoaYen + 0.58, hqZ);
  stonePb.add(...createLotusPetalRingParts(hqX, yHoaYen + 0.72, hqZ, 1.75, 8, 1, true));
  // Ground shrine chamber (`Khám thờ Sơ Tổ`) with arched portal & white marble seated statue inside
  const hqChamberY = yHoaYen + 0.72;
  brickPb.box(2.55, 2.05, 2.55, hqX, hqChamberY + 1.02, hqZ);
  voidPb.box(0.95, 1.38, 0.35, hqX, hqChamberY + 0.72, hqZ + 1.18);
  goldPb.cone(0.32, 0.78, 5, hqX, hqChamberY + 0.52, hqZ + 0.95);
  goldPb.sphere(0.14, 5, 4, hqX, hqChamberY + 1.02, hqZ + 0.95);

  // 9 Diminishing Square Stone/Brick Tiers + Miniature Arched Relief Niches & Sacred Gourd Crown (`~9.4m` total height)
  let hqY = hqChamberY + 2.02;
  for (let t = 0; t < 9; t++) {
    const tf = t / 8;
    const tw = THREE.MathUtils.lerp(2.42, 1.05, tf);
    const th = THREE.MathUtils.lerp(0.66, 0.42, tf);
    brickPb.box(tw, th * 0.65, tw, hqX, hqY + th * 0.32, hqZ);
    stonePb.box(tw + 0.48, th * 0.36, tw + 0.48, hqX, hqY + th * 0.82, hqZ);
    if (t < 5) {
      voidPb.box(tw * 0.28, th * 0.44, 0.12, hqX, hqY + th * 0.32, hqZ + tw * 0.5 + 0.02);
    }
    hqY += th;
  }
  stonePb.cyl(0.28, 0.48, 0.38, 6, hqX, hqY + 0.14, hqZ);
  goldPb.sphere(0.24, 6, 4, hqX, hqY + 0.52, hqZ, [1.0, 1.3, 1.0]);
  goldPb.cone(0.14, 0.55, 5, hqX, hqY + 0.95, hqZ);

  // Carved Stone Inner Precinct Curb, Front Offering Altar & Huệ Quang Patriarch Stele
  addCrispStoneBalustrade(stonePb, hqX - 3.6, hqZ - 3.6, hqX + 3.6, hqZ - 3.6, yHoaYen, 0.62);
  addCrispStoneBalustrade(stonePb, hqX - 3.6, hqZ - 3.6, hqX - 3.6, hqZ + 3.6, yHoaYen, 0.62);
  addCrispStoneBalustrade(stonePb, hqX + 3.6, hqZ - 3.6, hqX + 3.6, hqZ + 3.6, yHoaYen, 0.62);
  // Front stone offering table + bronze incense bowl before Tháp Tổ
  graniteDetailPb.box(1.75, 0.68, 0.88, hqX, yHoaYen + 0.34, hqZ + 3.05);
  bronzeDetailPb.cyl(0.28, 0.22, 0.34, 6, hqX, yHoaYen + 0.85, hqZ + 3.05);
  // Huệ Quang stone stele (`Bia Huệ Quang`) on East side of entrance
  stonePb.box(0.88, 0.22, 0.62, hqX + 2.45, yHoaYen + 0.11, hqZ + 3.65);
  graniteDetailPb.box(0.64, 1.12, 0.18, hqX + 2.45, yHoaYen + 0.78, hqZ + 3.65);

  // 12 Smaller 3-to-4-Tier Stone Funerary Stupas framing Tháp Tổ Huệ Quang in a sacred perimeter court
  const subStupaOffsets: Array<[number, number]> = [
    [-6.2, -5.8], [-2.1, -6.4], [2.1, -6.4], [6.2, -5.8],
    [-6.6, -1.8], [6.6, -1.8],
    [-6.6, 2.2], [6.6, 2.2],
    [-6.2, 5.8], [-2.1, 6.2], [2.1, 6.2], [6.2, 5.8]
  ];
  for (let sIdx = 0; sIdx < subStupaOffsets.length; sIdx++) {
    const [ox, oz] = subStupaOffsets[sIdx];
    const sx = hqX + ox;
    const sz = hqZ + oz;
    const numSubTiers = 3 + (sIdx % 2);
    graniteDetailPb.box(1.32, 0.32, 1.32, sx, yHoaYen + 0.10, sz);
    let sy = yHoaYen + 0.26;
    for (let st = 0; st < numSubTiers; st++) {
      const sw = 0.96 - st * 0.16;
      stonePb.box(sw, 0.42, sw, sx, sy + 0.21, sz);
      graniteDetailPb.box(sw + 0.24, 0.14, sw + 0.24, sx, sy + 0.48, sz);
      sy += 0.55;
    }
    stonePb.cone(0.18, 0.45, 5, sx, sy + 0.22, sz);
  }

  // 2) CHÙA HOA YÊN (2-Tier Curved Sanctuary at `(249.5, -766.5)`) + Ancient Frangipani Trees!
  const hyX = 249.5;
  const hyZ = -766.5;
  const yHY = yHoaYen + 0.85;
  graniteDetailPb.box(15.6, 1.05, 10.6, hyX, yHoaYen + 0.32, hyZ);
  addSteppedStairFlight(graniteDetailPb, stonePb, ctx, hyX, -759.6, yHoaYen, -761.1, yHY, 4.8, 4, false);
  for (const s of [-1, 1]) {
    addCrispDragonRampCheek(stonePb, hyX + s * 2.58, yHoaYen, -759.5, yHY, -761.1, 0.82);
    addCrispStoneLantern(stonePb, goldPb, hyX + s * 4.2, yHoaYen, -758.4, 0.88);
  }
  addCurvedRoofSanctuary({
    cx: hyX,
    yPlatformTop: yHY,
    cz: hyZ,
    width: 14.0,
    depth: 9.2,
    colH: 4.15,
    tiers: 2,
    colsX: 4,
    colsZ: 3,
    openFrontPortal: true,
    finialMode: 'crisp',
    finialScale: 0.82,
    roofPb: terraRoofPb,
    woodPb,
    plasterPb: yellowPb,
    crimsonPb,
    goldPb,
    stonePb,
    voidPb
  });
  // Gilded Trúc Lâm Three Patriarchs (*Tam Tổ Trúc Lâm*) altar & offerings inside Chùa Hoa Yên
  crimsonPb.box(4.2, 0.68, 1.6, hyX, yHY + 0.34, hyZ - 1.1);
  for (const bx of [-1.2, 0, 1.2]) {
    addCrispSeatedStatue(goldPb, goldPb, hyX + bx, yHY + 0.68, hyZ - 1.1, bx === 0 ? 0.98 : 0.84, bx === 0);
  }
  addCrispAltarOfferings(goldPb, crimsonPb, hyX, yHY + 0.68, hyZ - 0.35, 1.55, 0.88);
  stonePb.cyl(0.56, 0.66, 0.32, 6, hyX, yHoaYen + 0.16, -758.2);
  bronzeDetailPb.cyl(0.45, 0.34, 0.65, 6, hyX, yHoaYen + 0.62, -758.2);
  goldPb.cone(0.20, 0.30, 5, hyX, yHoaYen + 1.08, -758.2);
  smokeSources.push({ x: hyX, y: yHoaYen + 1.28, z: -758.2, scale: 0.92 });
  for (const s of [-1, 1]) {
    addCrispCraneOnTortoise(bronzeDetailPb, hyX + s * 1.95, yHoaYen, -758.2, -s * 0.35, 0.92);
  }

  // 2 Ancient 700-Year Frangipani Trees (*Đại Cổ Thụ Hoa Yên*) in carved stone octagonal planters (>= 6.2m clear of roof!)
  for (const [fx, fz, fScale, fSeed] of [
    [238.2, -757.2, 0.95, 1021],
    [260.8, -757.8, 0.92, 1029]
  ]) {
    stonePb.cyl(1.18, 1.28, 0.42, 8, fx, yHoaYen + 0.21, fz);
    addAncientFrangipaniTree(barkPb, foliagePb, whitePb, goldPb, fx, yHoaYen + 0.32, fz, fScale, fSeed);
  }

  // Chùa Hoa Yên East courtyard stone bell-stand (*Giá Chuông Đá Sân Chùa Hoa Yên*) at `(260.2, -764.8)`
  const hyBellX = 260.2;
  const hyBellZ = -764.8;
  graniteDetailPb.box(2.15, 0.34, 1.62, hyBellX, yHoaYen + 0.17, hyBellZ);
  for (const sx of [-0.78, 0.78]) {
    stonePb.box(0.36, 0.42, 0.36, hyBellX + sx, yHoaYen + 0.55, hyBellZ);
    woodPb.cyl(0.10, 0.12, 2.35, 5, hyBellX + sx, yHoaYen + 1.72, hyBellZ);
  }
  woodPb.box(2.15, 0.20, 0.24, hyBellX, yHoaYen + 2.78, hyBellZ);
  for (const sx of [-1.14, 1.14]) {
    goldPb.cone(0.09, 0.24, 4, hyBellX + sx, yHoaYen + 2.86, hyBellZ, { rz: -Math.sign(sx) * 1.1 });
  }
  const hyBellHood = createGableRoofGeometry(2.45, 1.65, 0.58, 0.12, 'x');
  hyBellHood.translate(hyBellX, yHoaYen + 2.86, hyBellZ);
  terraRoofPb.add(hyBellHood);
  bronzeDetailPb.cyl(0.04, 0.04, 0.42, 4, hyBellX, yHoaYen + 2.52, hyBellZ);
  bronzeDetailPb.add(...createBronzeBellParts(hyBellX, yHoaYen + 1.18, hyBellZ, 0.54));

  // Chùa Hoa Yên West courtyard *Bia Công Đức* (Carved Merit Stele on Stone Tortoise) at `(238.8, -764.8)`
  const hySteleX = 238.8;
  const hySteleZ = -764.8;
  graniteDetailPb.box(1.96, 0.32, 1.38, hySteleX, yHoaYen + 0.16, hySteleZ);
  stonePb.sphere(0.52, 5, 3, hySteleX, yHoaYen + 0.44, hySteleZ, [1.0, 0.44, 1.32]);
  graniteDetailPb.box(1.06, 1.66, 0.24, hySteleX, yHoaYen + 1.40, hySteleZ);
  goldPb.box(0.88, 0.26, 0.28, hySteleX, yHoaYen + 1.98, hySteleZ);
  for (const sx of [-0.80, 0.80]) {
    for (const sz of [-0.52, 0.52]) {
      woodPb.cyl(0.07, 0.08, 2.38, 5, hySteleX + sx, yHoaYen + 1.48, hySteleZ + sz);
    }
  }
  const hySteleHood = createGableRoofGeometry(2.25, 1.62, 0.54, 0.12, 'x');
  hySteleHood.translate(hySteleX, yHoaYen + 2.62, hySteleZ);
  terraRoofPb.add(hySteleHood);

  // --------------------------------------------------------------------------
  // C. QUẢNG TRƯỜNG PHẬT HOÀNG TRẦN NHÂN TÔNG (`BD-176..196`) at `yPhatHoang`
  // --------------------------------------------------------------------------
  // Stepped granite ascent from Hoa Yên terrace (`z = -775.2`) up to Phật Hoàng Plaza (`z = -782.4`)
  addSteppedStairFlight(
    graniteDetailPb,
    stonePb,
    ctx,
    ytX,
    -774.8,
    yHoaYen,
    -782.4,
    yPhatHoang,
    6.2,
    12,
    true
  );
  // Perimeter cliff balustrades around Quảng Trường Phật Hoàng
  addCrispStoneBalustrade(stonePb, 222.0, -782.4, ytX - 3.6, -782.4, yPhatHoang, 0.95);
  addCrispStoneBalustrade(stonePb, ytX + 3.6, -782.4, 258.0, -782.4, yPhatHoang, 0.95);
  addCrispStoneBalustrade(stonePb, 222.0, -782.4, 222.0, -798.2, yPhatHoang, 0.95);
  addCrispStoneBalustrade(stonePb, 258.0, -782.4, 258.0, -798.2, yPhatHoang, 0.95);
  // 10 Cast-Bronze Lotus Balustrade Lanterns (*Đèn Hoa Sen Đồng*) seated atop Quảng trường Phật Hoàng piers
  for (const [lx, lz] of [
    [222.0, -782.4],
    [229.2, -782.4],
    [236.4, -782.4],
    [243.6, -782.4],
    [250.8, -782.4],
    [258.0, -782.4],
    [222.0, -790.3],
    [222.0, -798.2],
    [258.0, -790.3],
    [258.0, -798.2]
  ] as const) {
    addCrispBronzeLotusLantern(bronzeDetailPb, goldPb, lx, yPhatHoang + 0.95, lz, 0.95);
  }

  // Monumental Cast-Bronze Statue: TƯỢNG PHẬT HOÀNG TRẦN NHÂN TÔNG (138-ton bronze masterpiece!) at `(240, -791.2)`
  const phZ = -791.2;
  // Multi-tier carved Trần-Dynasty wave & lotus stone/bronze pedestal (`height = 3.85m`)
  graniteDetailPb.box(8.4, 1.15, 8.4, ytX, yPhatHoang + 0.48, phZ);
  stonePb.box(6.6, 1.15, 6.6, ytX, yPhatHoang + 1.62, phZ);
  // Sculpted Trần-wave relief moldings around the stone pedestal
  for (let w = -2; w <= 2; w++) {
    stonePb.box(1.05, 0.36, 6.76, ytX + w * 1.25, yPhatHoang + 1.62, phZ);
    stonePb.box(6.76, 0.36, 1.05, ytX, yPhatHoang + 1.62, phZ + w * 1.25);
  }
  // Cast-bronze double lotus throne (`đài sen đồng 2 lớp`)
  bronzeDetailPb.cyl(2.85, 3.15, 0.72, 8, ytX, yPhatHoang + 2.55, phZ);
  bronzeDetailPb.add(
    ...createLotusPetalRingParts(ytX, yPhatHoang + 2.55, phZ, 2.95, 10, 1, false),
    ...createLotusPetalRingParts(ytX, yPhatHoang + 3.18, phZ, 2.65, 10, 1, true)
  );
  // Towering Cast-Bronze Emperor-Monk Statue (`scale = 2.95`) seated atop the lotus throne!
  const phatHoang = createSculptedDeityParts(ytX, yPhatHoang + 3.55, phZ, 0, 2.95, 'amitabha', {
    skipHalo: true
  });
  bronzeDetailPb.add(...phatHoang.bodyParts);
  goldPb.add(...phatHoang.accentParts);
  goldPb.cyl(1.75, 1.75, 0.14, 10, ytX, yPhatHoang + 8.85, phZ - 0.55, { rx: Math.PI * 0.5 });

  // 4 Cast-Bronze Ceremonial Braziers (*Lư Lửa Đồng*), Central Bronze Tripod & Trúc Lâm Banners
  for (const [bx, bz] of [
    [ytX - 6.8, -785.5],
    [ytX + 6.8, -785.5],
    [ytX - 6.8, -795.5],
    [ytX + 6.8, -795.5]
  ]) {
    graniteDetailPb.box(1.25, 0.55, 1.25, bx, yPhatHoang + 0.25, bz);
    bronzeDetailPb.cyl(0.62, 0.42, 0.78, 6, bx, yPhatHoang + 0.92, bz);
    goldPb.cyl(0.66, 0.66, 0.08, 6, bx, yPhatHoang + 1.32, bz);
  }
  const phSmokeY = addCrispBronzeTripod(stonePb, bronzeDetailPb, goldPb, ytX, yPhatHoang, -785.0, 1.25);
  smokeSources.push({ x: ytX, y: phSmokeY, z: -785.0, scale: 1.22 });
  // Front ceremonial stone steps & cast-bronze offering altar table before Phật Hoàng pedestal
  for (let ps = 0; ps < 3; ps++) {
    graniteDetailPb.box(3.4, 0.32 * (ps + 1), 0.42, ytX, yPhatHoang + 0.16 * (ps + 1), phZ + 4.85 - ps * 0.38);
  }
  bronzeDetailPb.box(2.65, 0.82, 1.05, ytX, yPhatHoang + 1.45, phZ + 3.65);
  addCrispAltarOfferings(goldPb, crimsonPb, ytX, yPhatHoang + 1.86, phZ + 3.65, 0.95, 1.0);
  for (const s of [-1, 1]) {
    addCrispCraneOnTortoise(bronzeDetailPb, ytX + s * 2.55, yPhatHoang, -785.0, -s * 0.32, 1.05);
  }

  for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
    const s = sideIdx === 0 ? -1 : 1;
    const fx = ytX + s * 11.2;
    const fz = -786.5;
    stonePb.box(0.55, 0.45, 0.55, fx, yPhatHoang + 0.22, fz);
    bronzeDetailPb.cyl(0.055, 0.075, 6.2, 6, fx, yPhatHoang + 3.1, fz);
    goldPb.cone(0.10, 0.28, 5, fx, yPhatHoang + 6.32, fz);
    const bannerGeo = new THREE.PlaneGeometry(1.25, 2.55, 4, 2);
    const bPos = bannerGeo.attributes.position;
    for (let vi = 0; vi < bPos.count; vi++) {
      const u = (bPos.getX(vi) + 0.625) / 1.25;
      bPos.setZ(vi, Math.sin(u * Math.PI * 2.2 + sideIdx) * 0.14 * u);
    }
    bannerGeo.computeVertexNormals();
    bannerGeo.translate(fx + 0.65, yPhatHoang + 4.65, fz);
    (sideIdx === 0 ? crimsonPb : goldPb).add(bannerGeo);
  }

  // --------------------------------------------------------------------------
  // D. CHÙA ĐỒNG — THIÊN TRÚC TỰ (100% Cast Bronze & Gold at Summit Apex `ySummit`! — `BD-197..220`)
  // --------------------------------------------------------------------------
  // Steep carved granite summit stairway (`Đường Lên Cổng Trời & Đỉnh Thiêng`) ascending `z = -798.2 -> -806.6`
  // Routed along East flank (`x = 248.8` -> curving to summit front at `z = -806.6`) so it never blocks Phật Hoàng!
  addSteppedStairFlight(
    graniteDetailPb,
    stonePb,
    ctx,
    ytX + 9.2,
    -796.5,
    yPhatHoang,
    -803.8,
    ySummit - 4.2,
    3.6,
    10,
    true
  );
  addGraniteCliffShelf(ytX + 4.6, -805.2, 13.2, 3.4, ySummit - 4.2);
  addSteppedStairFlight(
    graniteDetailPb,
    stonePb,
    ctx,
    ytX,
    -804.2,
    ySummit - 4.2,
    -806.8,
    ySummit,
    4.2,
    7,
    true
  );

  // Summit safety cast-bronze perimeter balustrade along cliff crown (`x = 233.2..246.8, z = -818.0..-806.8`)
  addCrispStoneBalustrade(bronzeDetailPb, 233.2, -806.8, ytX - 2.4, -806.8, ySummit, 0.86);
  addCrispStoneBalustrade(bronzeDetailPb, ytX + 2.4, -806.8, 246.8, -806.8, ySummit, 0.86);
  addCrispStoneBalustrade(bronzeDetailPb, 233.2, -806.8, 233.2, -818.0, ySummit, 0.86);
  addCrispStoneBalustrade(bronzeDetailPb, 246.8, -806.8, 246.8, -818.0, ySummit, 0.86);
  addCrispStoneBalustrade(bronzeDetailPb, 233.2, -818.0, 246.8, -818.0, ySummit, 0.86);

  // CHÙA ĐỒNG — THIÊN TRÚC TỰ (`(240.0, -812.6)`): Built 100% in Cast Bronze (`bronzeMat`) & Gold (`goldMat`)!
  const cdZ = -812.6;
  const cdPedH = 0.98;
  const yCD = ySummit + cdPedH;

  // 1) Cast-Bronze Lotus-Shaped Pedestal (`Đài Sen Đồng Nguyên Khối`, `6.8m x 5.6m`) gripping the flat summit granite!
  chuaDongHeroBronzePb.box(6.8, cdPedH + 0.18, 5.6, ytX, ySummit + (cdPedH - 0.18) * 0.5, cdZ);
  goldPb.box(7.1, 0.14, 5.9, ytX, yCD - 0.07, cdZ);
  // Sculpted double-tier cast-bronze lotus petals wrapping the pedestal perimeter (`đài sen nở 2 lớp`)
  chuaDongHeroBronzePb.add(
    ...createLotusPetalRingParts(ytX, ySummit + 0.55, cdZ, 3.65, 12, 1, true)
  );
  // Lower downturned cast-bronze lotus petal ring (castShadow = false via bronzeDetailPb)
  bronzeDetailPb.add(
    ...createLotusPetalRingParts(ytX, ySummit + 0.34, cdZ, 3.82, 12, 1, false)
  );
  // Cast-bronze front dragon staircase (`z = -808.6 -> -809.8`)
  for (let st = 0; st < 4; st++) {
    const sz = -808.6 - st * 0.32;
    const sh = ((st + 1) / 4) * cdPedH;
    chuaDongHeroBronzePb.box(2.55, sh + 0.12, 0.38, ytX, ySummit + (sh - 0.12) * 0.5, sz);
  }
  for (const sx of [-1.42, 1.42]) {
    addCrispDragonRampCheek(goldPb, ytX + sx, ySummit, -808.5, yCD, -809.8, 0.72);
  }

  // 2) 12 Gleaming Cast-Bronze Columns (-0.15m embed into bronze lotus deck) & Cast-Bronze Lattice Walls
  const cdW = 5.4;
  const cdD = 4.2;
  const cdColH = 2.95;
  for (const ox of [-cdW * 0.5, -cdW * 0.18, cdW * 0.18, cdW * 0.5]) {
    for (const oz of [-cdD * 0.5, 0, cdD * 0.5]) {
      if (Math.abs(ox) < cdW * 0.4 && oz === 0) continue;
      addEmbeddedColumn(chuaDongHeroBronzePb, goldPb, ytX + ox, yCD, cdZ + oz, cdColH, 0.16, 6);
      // Gilded bronze lotus capital / *đấu củng* bracket collar at top of each bronze column
      goldPb.cyl(0.24, 0.18, 0.18, 6, ytX + ox, yCD + cdColH - 0.16, cdZ + oz);
    }
  }
  // Cast-bronze sanctuary walls with embossed lotus-cloud panels & open central front portal
  const cdWallW = 4.2;
  const cdWallD = 3.1;
  chuaDongHeroBronzePb.box(cdWallW, cdColH, 0.18, ytX, yCD + cdColH * 0.5, cdZ - cdWallD * 0.5);
  chuaDongHeroBronzePb.box(0.18, cdColH, cdWallD, ytX - cdWallW * 0.5, yCD + cdColH * 0.5, cdZ);
  chuaDongHeroBronzePb.box(0.18, cdColH, cdWallD, ytX + cdWallW * 0.5, yCD + cdColH * 0.5, cdZ);
  // Front bronze portal jambs + gilded *"Thiên Trúc Tự"* plaque & filigree arch
  for (const sx of [-1.45, 1.45]) {
    chuaDongHeroBronzePb.box(1.25, cdColH, 0.18, ytX + sx, yCD + cdColH * 0.5, cdZ + cdWallD * 0.5);
    goldPb.add(...createBasReliefPanelParts(ytX + sx, yCD + cdColH * 0.5, cdZ + cdWallD * 0.5 + 0.10, 0.85, 1.45, 0, 'tu_quy'));
  }
  goldPb.box(1.95, 0.52, 0.14, ytX, yCD + cdColH - 0.36, cdZ + cdD * 0.5 + 0.12);
  goldPb.box(1.55, 0.22, 0.10, ytX, yCD + cdColH - 0.78, cdZ + cdWallD * 0.5 + 0.06);

  // Gilded Shakyamuni Buddha & Three Trúc Lâm Patriarchs with Bodhi-leaf mandorla & bronze altar offerings!
  goldPb.box(2.2, 0.48, 1.0, ytX, yCD + 0.24, cdZ - 0.65);
  addCrispSeatedStatue(goldPb, goldPb, ytX, yCD + 0.48, cdZ - 0.65, 0.78, true);
  addCrispBodhiHalo(goldPb, bronzeDetailPb, ytX, yCD + 0.48, cdZ - 0.65, 0.72);
  addCrispSeatedStatue(goldPb, goldPb, ytX - 0.68, yCD + 0.48, cdZ - 0.55, 0.58, false);
  addCrispSeatedStatue(goldPb, goldPb, ytX + 0.68, yCD + 0.48, cdZ - 0.55, 0.58, false);
  addCrispAltarOfferings(goldPb, bronzeDetailPb, ytX, yCD + 0.48, cdZ - 0.18, 0.85, 0.62);

  // 3) Cast-Bronze Upturned Dragon-Tail Curved Roof (`createHueImperialHipRoofGeometry` + flush `createRoofFinialSetParts`)
  const cdRoofY = yCD + cdColH - 0.06;
  const cdRoof = createHueImperialHipRoofGeometry(7.2, 6.0, 3.1, 0.32, 1.88, 0.46, 5, 4, true);
  cdRoof.translate(ytX, cdRoofY, cdZ);
  chuaDongHeroBronzePb.add(cdRoof);
  const cdRidgeTopY = cdRoofY + 1.88;
  chuaDongHeroBronzePb.box(3.25, 0.24, 0.30, ytX, cdRidgeTopY - 0.04, cdZ);
  const cdFinials = createRoofFinialSetParts(ytX, cdRidgeTopY - 0.05, cdZ, 3.1, 0, 0.74, true);
  chuaDongHeroBronzePb.add(...cdFinials.mainParts);
  goldPb.add(...cdFinials.goldParts);
  // 4 Hanging Cast-Bronze Corner Wind-Chime Bells (`chuông gió đồng`) & Gilded Hip-Ridge Corner Accents (`đầu đao`)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = ytX + sx * 3.42;
      const cz = cdZ + sz * 2.84;
      goldPb.cyl(0.02, 0.02, 0.28, 4, cx, cdRoofY - 0.02, cz);
      goldPb.cone(0.09, 0.22, 5, cx, cdRoofY - 0.24, cz);
      goldPb.cone(0.11, 0.36, 4, cx + sx * 0.12, cdRoofY + 0.38, cz + sz * 0.12, {
        rz: -sx * 0.55,
        rx: sz * 0.55
      });
    }
  }

  // 4) Flanking Cast-Bronze Bell Pavilion (*Lầu Chuông Đồng* West) & Bronze Gong Pavilion (*Lầu Khánh Đồng* East)
  for (const side of [-1, 1]) {
    const px = ytX + side * 5.05;
    const pz = cdZ + 0.6;
    chuaDongHeroBronzePb.box(1.95, 0.32, 1.95, px, ySummit + 0.14, pz);
    for (const cxOff of [-0.72, 0.72]) {
      for (const czOff of [-0.72, 0.72]) {
        addEmbeddedColumn(chuaDongHeroBronzePb, goldPb, px + cxOff, ySummit + 0.30, pz + czOff, 2.05, 0.085, 5);
      }
    }
    const miniRoof = createHueImperialHipRoofGeometry(2.55, 2.55, 0.24, 0.24, 0.88, 0.28, 4, 3, true);
    miniRoof.translate(px, ySummit + 2.30, pz);
    chuaDongHeroBronzePb.add(miniRoof);
    goldPb.cone(0.12, 0.36, 5, px, ySummit + 3.28, pz);

    if (side === -1) {
      // Hanging Cast-Bronze Bell (*Chuông Đồng*)
      goldPb.add(...createBronzeBellParts(px, ySummit + 1.05, pz, 0.56));
    } else {
      // Hanging Cast-Bronze Cloud-Bat Gong (*Khánh Đồng Yên Tử*)
      chuaDongHeroBronzePb.box(1.18, 0.08, 0.08, px, ySummit + 2.12, pz);
      goldPb.box(0.96, 0.52, 0.07, px, ySummit + 1.48, pz);
      goldPb.cyl(0.24, 0.24, 0.08, 6, px, ySummit + 1.66, pz, { rx: Math.PI * 0.5 });
      for (const ws of [-0.42, 0.42]) {
        goldPb.cone(0.22, 0.44, 4, px + ws, ySummit + 1.42, pz, { rz: ws * 1.1 });
      }
    }
  }

  // Cast-Bronze Sacred Lotus Water Basin (*Bể Nước Thiêng Chùa Đồng*) & Bronze Censer on Summit Forecourt
  bronzeDetailPb.cyl(0.62, 0.46, 0.56, 8, ytX - 2.1, ySummit + 0.28, -808.1);
  waterPb.cyl(0.54, 0.54, 0.05, 8, ytX - 2.1, ySummit + 0.54, -808.1);
  // Chùa Đồng summit carved granite offering steps (*Bậc Đá Dâng Hương Đỉnh Chùa Đồng*) & flanking offering pedestals
  graniteDetailPb.box(2.85, 0.14, 1.38, ytX, ySummit + 0.07, -807.68);
  stonePb.box(2.55, 0.12, 0.72, ytX, ySummit + 0.18, -808.16);
  for (const s of [-1, 1]) {
    // Low granite offering-tray pedestals flanking the summit incense censer
    stonePb.box(0.46, 0.44, 0.42, ytX + s * 1.12, ySummit + 0.29, -807.42);
    bronzeDetailPb.cyl(0.16, 0.11, 0.14, 6, ytX + s * 1.12, ySummit + 0.58, -807.42);
    // Stepped granite offering aprons in front of West Bell & East Gong pavilions
    graniteDetailPb.box(1.55, 0.16, 0.62, ytX + s * 5.05, ySummit + 0.08, cdZ + 1.88);
  }
  chuaDongHeroBronzePb.cyl(0.46, 0.56, 0.28, 6, ytX, ySummit + 0.14, -807.5);
  chuaDongHeroBronzePb.cyl(0.38, 0.28, 0.52, 6, ytX, ySummit + 0.52, -807.5);
  goldPb.cone(0.18, 0.28, 5, ytX, ySummit + 0.92, -807.5);
  smokeSources.push({ x: ytX, y: ySummit + 1.12, z: -807.5, scale: 0.75 });

  // 5) ICONIC SUMMIT ELEVATION STELE (`ĐỈNH YÊN TỬ 1.068m`) at `(243.4, -807.6)`
  const stPeakX = 243.4;
  const stPeakZ = -807.6;
  graniteDetailPb.box(1.36, 0.34, 0.92, stPeakX, ySummit + 0.15, stPeakZ, { ry: -0.25 });
  // Tapered triangular granite & bronze summit marker pyramid (`Chóp Đỉnh Yên Tử 1.068m`)
  const markerPyr = transformGeometryXYZ(
    new THREE.ConeGeometry(0.48, 1.38, 4),
    stPeakX,
    ySummit + 0.98,
    stPeakZ,
    Math.PI * 0.25 - 0.25,
    0,
    0
  );
  bronzeDetailPb.add(markerPyr);
  goldPb.box(0.54, 0.32, 0.08, stPeakX - 0.06, ySummit + 0.86, stPeakZ + 0.24, { ry: -0.25 });
  goldPb.sphere(0.11, 5, 4, stPeakX, ySummit + 1.70, stPeakZ);

  // Emit merged meshes — ONLY the 2 Yên Tử hero meshes have castShadow = true! (Total across file = 5 hero shadow meshes!)
  emitBuilderMesh(group, mountainHeroGranitePb, graniteMat, 'YenTuSacredGraniteMountainHero', true, true, 3.2);
  emitBuilderMesh(group, chuaDongHeroBronzePb, bronzeMat, 'YenTuChuaDongBronzeHero', true, true);

  // All supporting Yên Tử steps, railings, stupas, statues, pines, bamboo -> castShadow = false!
  emitBuilderMesh(group, stonePb, stoneMat, 'YenTuStoneworkAndStupas', false, true, 2.2);
  emitBuilderMesh(group, graniteDetailPb, graniteMat, 'YenTuGraniteStairsAndPedestals', false, true, 2.2);
  emitBuilderMesh(group, whitePb, whitePlasterMat, 'YenTuWhitePlasterAndBlossoms', false, true);
  emitBuilderMesh(group, yellowPb, yellowPlasterMat, 'YenTuHoaYenWalls', false, true, 2.0);
  emitBuilderMesh(group, crimsonPb, crimsonMat, 'YenTuCrimsonLacquer', false, true);
  emitBuilderMesh(group, woodPb, ironwoodMat, 'YenTuIronwoodStructures', false, true);
  emitBuilderMesh(group, terraRoofPb, terraRoofMat, 'YenTuCurvedTerracottaRoofs', false, true);
  emitBuilderMesh(group, brickPb, chamBrickMat, 'YenTuHueQuangBrickwork', false, true, 1.8);
  emitBuilderMesh(group, bronzeDetailPb, bronzePatinaMat, 'YenTuPhatHoangAndBronzes', false, true);
  emitBuilderMesh(group, goldPb, goldMat, 'YenTuGildedDetails', false, false);
  emitBuilderMesh(group, voidPb, voidMat, 'YenTuPortalVoids', false, false);
  emitBuilderMesh(group, barkPb, barkMat, 'YenTuXichTungPineBark', false, true);
  emitBuilderMesh(group, foliagePb, foliageMat, 'YenTuPineAndBambooFoliage', false, true);
  emitBuilderMesh(group, bambooPb, bambooMat, 'YenTuGoldenBambooCulms', false, true);
  emitBuilderMesh(group, waterPb, waterMat, 'YenTuGiaiOanStreamWater', false, true);

  addIncenseSmoke(ctx, flagUniforms, group, smokeSources, 'YenTuIncenseSmoke');

  ctx.scene.add(group);
}

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

export function buildBaiDinhYenTuLandmarks(ctx: VietnamBuilderContext): BaiDinhYenTuBuildResult {
  const flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [];

  buildBaiDinhHoaLuComplex(ctx, flagUniforms);
  buildYenTuSacredMountainComplex(ctx, flagUniforms);

  return { flagUniforms };
}
