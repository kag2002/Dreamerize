import * as THREE from 'three';
import {
  VietnamBuilderContext,
  mergeNormalized,
  createArchedWallGeometry,
  createVietnameseCurvedRoofGeometry,
  createSculptedRockGeometry,
  createBronzeIncenseTripodParts
} from './vietnamGeometryHelpers';
import {
  createRoofFinialSetParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import { VIETNAM_WATER_LEVEL } from '../shaders/vietnamHeritageShader';
import { createMergedMesh } from '../vietnam/geometry/PartsBuilder';
import {
  createHanoiIconsMaterialPack,
  HANOI_ICONS_ART_UV,
  HANOI_ICONS_RELIEF_UV,
  type HanoiIconsArtKey,
  type HanoiIconsMaterialPack,
  type HanoiIconsReliefKey
} from '../textures/hanoiIconsPbrTextures';

/**
 * Core Hanoi Heritage Icons Museum Builder — implements all 128 QC items:
 *   - Chùa Một Cột — Liên Hoa Đài & Hồ Linh Chiểu (`MC-01..32`) at (-48, 22)
 *   - Chính Điện Tam Bảo — Chùa Diên Hựu (`DH-01..32`) at (-48, 43.5)
 *   - Tháp Rùa & Hồ Hoàn Kiếm (`TR-01..32`) at (52, 22)
 *   - Cầu Thê Húc, Đắc Nguyệt Lâu, Trấn Ba Đình, Tháp Bút & Đài Nghiên (`TH-01..32`) at (73..102, 3..14)
 *
 * Shares ONE single 2048×3072 Master PBR & Calligraphic Atlas (`hanoiIconsMasterAtlasMat`)
 * across BOTH complexes -> net GPU material reduction (-7 materials vs legacy)!
 */

const hanoiIconsPackCache = new WeakMap<THREE.Scene, HanoiIconsMaterialPack>();

function getOrCreateHanoiIconsPack(ctx: VietnamBuilderContext): HanoiIconsMaterialPack {
  let pack = hanoiIconsPackCache.get(ctx.scene);
  if (!pack) {
    pack = createHanoiIconsMaterialPack(ctx.renderer);
    hanoiIconsPackCache.set(ctx.scene, pack);
    ctx.extraMaterials.push(...pack.allMaterials);
    ctx.extraTextures.push(...pack.allTextures);
  }
  return pack;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function remapUvRect(
  geo: THREE.BufferGeometry,
  rect: readonly [number, number, number, number],
  inset = 0.004
): THREE.BufferGeometry {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const u0 = rect[0] + inset;
  const v0 = rect[1] + inset;
  const du = Math.max(0.001, rect[2] - rect[0] - inset * 2);
  const dv = Math.max(0.001, rect[3] - rect[1] - inset * 2);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + clamp01(uv.getX(i)) * du, v0 + clamp01(uv.getY(i)) * dv);
  }
  uv.needsUpdate = true;
  return geo;
}

function normalizeExtrudeUv(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (!bb || !pos || !uv) return geo;
  const sx = Math.max(0.01, bb.max.x - bb.min.x);
  const sy = Math.max(0.01, bb.max.y - bb.min.y);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
  }
  uv.needsUpdate = true;
  return geo;
}

function remapRelief(geo: THREE.BufferGeometry, key: HanoiIconsReliefKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, HANOI_ICONS_RELIEF_UV[key], inset);
}

function remapArt(geo: THREE.BufferGeometry, key: HanoiIconsArtKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, HANOI_ICONS_ART_UV[key], inset);
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: HanoiIconsReliefKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  const g = remapRelief(new THREE.BoxGeometry(w, h, d), key);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makeReliefCyl(
  rTop: number,
  rBot: number,
  h: number,
  seg: number,
  key: HanoiIconsReliefKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  const g = remapRelief(new THREE.CylinderGeometry(rTop, rBot, h, seg), key);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makeArtPlane(
  w: number,
  h: number,
  key: HanoiIconsArtKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  verticalFromHorizontal = false
): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  if (verticalFromHorizontal) {
    // Map a horizontal calligraphy strip cleanly top-to-bottom onto a vertical board!
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, 1 - v, u);
    }
    uv.needsUpdate = true;
  }
  remapArt(g, key);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function colorizeGeo(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  const col = new THREE.Color(hex);
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function addTiledFloor(
  parts: THREE.BufferGeometry[],
  x0: number,
  z0: number,
  width: number,
  depth: number,
  y: number,
  nx: number,
  nz: number,
  key: HanoiIconsReliefKey
): void {
  const tw = width / nx;
  const td = depth / nz;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const g = remapRelief(new THREE.PlaneGeometry(tw, td), key);
      g.rotateX(-Math.PI * 0.5);
      g.translate(x0 - width * 0.5 + (ix + 0.5) * tw, y, z0 - depth * 0.5 + (iz + 0.5) * td);
      parts.push(g);
    }
  }
}

/**
 * Helper to create a SOLID, thick, multi-layered curved Vietnamese tiled hip roof
 * with dark timber rafter soffit (ZERO see-through gaps, ZERO red tiles underneath!)
 */
function addVietnameseRoofWithSoffit(
  parts: THREE.BufferGeometry[],
  cx: number,
  baseY: number,
  cz: number,
  botW: number,
  botD: number,
  topW: number,
  topD: number,
  height: number,
  eaveCurve: number,
  roofKey: HanoiIconsReliefKey = 'ngoiMuiHaiMossy',
  soffitKey: HanoiIconsReliefKey = 'darkTimberSoffit'
): void {
  // 1. Dark timber rafter soffit plate closing the underside cleanly
  const soffit = remapRelief(new THREE.BoxGeometry(botW * 0.96, 0.14, botD * 0.96), soffitKey);
  soffit.translate(cx, baseY + 0.05, cz);
  parts.push(soffit);

  // 2. Solid stepped concave-profile tiled core (5 layered frustum courses -> thick, opaque from EVERY angle!)
  const courses = 5;
  for (let i = 0; i < courses; i++) {
    const t0 = i / courses;
    const t1 = (i + 1) / courses;
    // Concave Vietnamese roof sag curve
    const ease0 = 1 - Math.pow(1 - t0, 1.45);
    const ease1 = 1 - Math.pow(1 - t1, 1.45);
    const w0 = botW + (topW - botW) * ease0;
    const d0 = botD + (topD - botD) * ease0;
    const w1 = botW + (topW - botW) * ease1;
    const d1 = botD + (topD - botD) * ease1;
    const cw = (w0 + w1) * 0.5;
    const cd = (d0 + d1) * 0.5;
    const ch = height / courses + 0.06;
    const cy = baseY + 0.10 + (t0 + t1) * 0.5 * height;
    parts.push(makeReliefBox(cw, ch, cd, roofKey, cx, cy, cz));
  }

  // 3. Sweeping upturned curved outer shell hugging the stepped core for authentic silhouette
  const roof = remapRelief(
    createVietnameseCurvedRoofGeometry(botW * 1.02, botD * 1.02, topW, topD, height + 0.06, eaveCurve),
    roofKey
  );
  roof.translate(cx, baseY + 0.10, cz);
  parts.push(roof);

  // 4. Solid stone-plaster ridge beam crowning the top of the hipped roof
  parts.push(
    makeReliefBox(Math.max(0.32, topW + 0.16), 0.22, Math.max(0.32, topD + 0.16), 'monolithicStoneDrum', cx, baseY + height + 0.16, cz)
  );
}

/**
 * Helper to build a pointed Gothic-Vietnamese arched wall bay (for Tháp Rùa Tiers 1 & 2)
 */
function createPointedArchBayGeometry(
  bayW: number,
  bayH: number,
  wallT: number,
  archW: number,
  archH: number
): THREE.BufferGeometry {
  const halfW = bayW * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(halfW, 0);
  shape.lineTo(halfW, bayH);
  shape.lineTo(-halfW, bayH);
  shape.closePath();

  const hw = archW * 0.5;
  const springY = archH * 0.62;
  const hole = new THREE.Path();
  hole.moveTo(-hw, 0);
  hole.lineTo(-hw, springY);
  hole.quadraticCurveTo(-hw * 0.92, archH * 0.88, 0, archH);
  hole.quadraticCurveTo(hw * 0.92, archH * 0.88, hw, springY);
  hole.lineTo(hw, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: wallT,
    bevelEnabled: false,
    curveSegments: 10
  });
  geo.translate(0, 0, -wallT * 0.5);
  return normalizeExtrudeUv(geo);
}

function addFoliageCanopy(
  barkParts: THREE.BufferGeometry[],
  leafParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number,
  leafColors: number[],
  drooping = false
): void {
  const rand = mulberry32(seed);
  const trunkH = (drooping ? 3.5 : 4.2) * scale;
  const trunk = new THREE.CylinderGeometry(0.22 * scale, 0.42 * scale, trunkH, 8);
  trunk.rotateZ((rand() - 0.5) * 0.22);
  trunk.translate(x, y + trunkH * 0.5, z);
  barkParts.push(trunk);

  const limbs = drooping ? 5 : 6;
  for (let b = 0; b < limbs; b++) {
    const ang = (b / limbs) * Math.PI * 2 + rand() * 0.4;
    const limbLen = (drooping ? 2.4 : 3.2) * scale * (0.85 + rand() * 0.35);
    const br = new THREE.CylinderGeometry(0.08 * scale, 0.18 * scale, limbLen, 6);
    br.translate(0, limbLen * 0.5, 0);
    br.rotateZ(0.75 + rand() * 0.25);
    br.rotateY(ang);
    br.translate(x, y + trunkH * 0.86, z);
    barkParts.push(br);

    const cards = drooping ? 4 : 3;
    for (let k = 0; k < cards; k++) {
      const ca = ang + (k - 1.5) * 0.34;
      const r = (drooping ? 1.15 + k * 0.45 : 1.5 + k * 0.65) * scale;
      const w = (drooping ? 2.1 : 3.0) * scale;
      const h = (drooping ? 3.2 : 2.5) * scale;
      const card = new THREE.PlaneGeometry(w, h);
      card.rotateY(ca + k * 0.7);
      card.rotateX((k % 2 === 0 ? 1 : -1) * (drooping ? 0.16 : 0.3));
      card.translate(
        x + Math.cos(ca) * r,
        y + (drooping ? trunkH * 1.12 - k * 0.22 : trunkH * 1.18 + rand() * 1.2) * scale,
        z + Math.sin(ca) * r
      );
      colorizeGeo(card, leafColors[(b + k) % leafColors.length]);
      leafParts.push(card);
    }
  }
  for (let k = 0; k < 4; k++) {
    const topCard = new THREE.PlaneGeometry((drooping ? 3.4 : 4.0) * scale, (drooping ? 2.6 : 3.0) * scale);
    topCard.rotateY((k / 4) * Math.PI);
    topCard.rotateX((k % 2 === 0 ? 1 : -1) * 0.22);
    topCard.translate(x, y + (drooping ? trunkH * 1.32 : trunkH * 1.48) * scale, z);
    colorizeGeo(topCard, leafColors[k % leafColors.length]);
    leafParts.push(topCard);
  }
}

/**
 * ============================================================================
 * PART 1: CHÙA MỘT CỘT (LIÊN HOA ĐÀI & HỒ LINH CHIỂU) + CHÍNH ĐIỆN CHÙA DIÊN HỰU
 * Implements MC-01..MC-32 & DH-01..DH-32
 * ============================================================================
 */
export function buildOnePillarPagodaComplex(
  ctx: VietnamBuilderContext,
  registerFoliage?: (mesh: THREE.InstancedMesh, count: number) => void,
  foliageScale = 1.0
): THREE.Group {
  const pack = getOrCreateHanoiIconsPack(ctx);
  const group = new THREE.Group();
  group.name = 'OnePillarPagodaComplex';

  const cx = -48.0;
  const cz = 22.0;
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 22.0 },
    { x: -63.0, z: 8.0, r: 6.5 },
    { x: -48.0, z: 43.5, r: 12.0 }
  );

  const atlasParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const warmGlowParts: THREE.BufferGeometry[] = [];

  // --------------------------------------------------------------------------
  // 1. HỒ LINH CHIỂU SQUARE BASIN + GREEN GLAZED HOA CHANH BALUSTRADE (MC-27..MC-30)
  // --------------------------------------------------------------------------
  const halfBasin = 17.0;
  const rimH = 1.95;
  const rimY = -1.40 + rimH * 0.5;

  // Basin granite coping walls + green ceramic hoa chanh parapet on 4 sides (with East entrance gap for stairway)
  for (const sideZ of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(halfBasin * 2 + 1.0, rimH, 0.8, 'monolithicStoneDrum', cx, rimY, cz + sideZ * halfBasin)
    );
    // Pierced green-glazed hoa chanh ceramic balustrade panels
    for (let px = -15.0; px <= 15.0; px += 3.0) {
      atlasParts.push(
        makeReliefBox(2.72, 0.68, 0.16, 'hoaChanhGreenTile', cx + px, 0.92, cz + sideZ * halfBasin),
        makeReliefBox(0.24, 0.82, 0.24, 'weatheredLimeStucco', cx + px - 1.5, 0.96, cz + sideZ * halfBasin),
        makeReliefBox(2.96, 0.10, 0.24, 'monolithicStoneDrum', cx + px, 1.30, cz + sideZ * halfBasin)
      );
    }
  }
  for (const sideX of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(0.8, rimH, halfBasin * 2 + 1.0, 'monolithicStoneDrum', cx + sideX * halfBasin, rimY, cz)
    );
    for (let pz = -15.0; pz <= 15.0; pz += 3.0) {
      if (sideX === 1 && Math.abs(pz) < 2.2) continue; // Entrance to stairway
      atlasParts.push(
        makeReliefBox(0.16, 0.68, 2.72, 'hoaChanhGreenTile', cx + sideX * halfBasin, 0.92, cz + pz),
        makeReliefBox(0.24, 0.82, 0.24, 'weatheredLimeStucco', cx + sideX * halfBasin, 0.96, cz + pz - 1.5),
        makeReliefBox(0.24, 0.10, 2.96, 'monolithicStoneDrum', cx + sideX * halfBasin, 1.30, cz + pz)
      );
    }
  }
  // Corner square stone posts with lotus-bud caps
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(0.46, 1.15, 0.46, 'weatheredLimeStucco', cx + sx * halfBasin, 1.12, cz + sz * halfBasin),
        makeReliefCyl(0.06, 0.18, 0.28, 8, 'monolithicStoneDrum', cx + sx * halfBasin, 1.82, cz + sz * halfBasin)
      );
    }
  }

  // --------------------------------------------------------------------------
  // 2. MONOLITHIC 2-DRUM STONE PILLAR (MC-01..MC-04) — Clean footing, ZERO spiky collar!
  // --------------------------------------------------------------------------
  // Submerged + waterline square-to-round granite footing
  atlasParts.push(
    makeReliefCyl(0.88, 1.02, 1.25, 16, 'monolithicStoneDrum', cx, VIETNAM_WATER_LEVEL - 0.52, cz),
    makeReliefCyl(0.72, 0.80, 0.22, 16, 'monolithicStoneDrum', cx, VIETNAM_WATER_LEVEL + 0.14, cz),
    // Lower monolithic stone drum (1.25m diameter -> radius 0.625m)
    makeReliefCyl(0.625, 0.635, 1.85, 24, 'monolithicStoneDrum', cx, VIETNAM_WATER_LEVEL + 1.16, cz),
    // Subtle recessed mortar seam ring between the two monolithic drums
    makeReliefCyl(0.60, 0.60, 0.06, 20, 'darkTimberSoffit', cx, VIETNAM_WATER_LEVEL + 2.11, cz),
    // Upper monolithic stone drum
    makeReliefCyl(0.62, 0.625, 1.82, 24, 'monolithicStoneDrum', cx, VIETNAM_WATER_LEVEL + 3.04, cz),
    // Clean octagonal stone capital collar supporting timber bracketry
    makeReliefCyl(0.74, 0.66, 0.22, 16, 'monolithicStoneDrum', cx, VIETNAM_WATER_LEVEL + 4.02, cz)
  );

  // --------------------------------------------------------------------------
  // 3. THICK ORTHOGONAL 8-STRUT DARK-IRONWOOD ĐẤU CỦNG BRACKETRY (MC-05..MC-10)
  // --------------------------------------------------------------------------
  const floorY = VIETNAM_WATER_LEVEL + 4.42;
  // Crossed heavy timber capital bolster beams
  atlasParts.push(
    makeReliefBox(3.45, 0.26, 0.34, 'agedIronwood', cx, floorY - 0.18, cz),
    makeReliefBox(0.34, 0.26, 3.45, 'agedIronwood', cx, floorY - 0.18, cz),
    // Outer perimeter ring beams beneath Lien Hoa Dai floor
    makeReliefBox(3.55, 0.22, 0.22, 'agedIronwood', cx, floorY - 0.16, cz - 1.58),
    makeReliefBox(3.55, 0.22, 0.22, 'agedIronwood', cx, floorY - 0.16, cz + 1.58),
    makeReliefBox(0.22, 0.22, 3.55, 'agedIronwood', cx - 1.58, floorY - 0.16, cz),
    makeReliefBox(0.22, 0.22, 3.55, 'agedIronwood', cx + 1.58, floorY - 0.16, cz)
  );

  // 8 heavy diagonal timber struts radiating from pillar neck (y + 2.45) to pavilion floor grid + horizontal tie collars & drop-posts
  const strutDirs: Array<[number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.78, 0.78], [-0.78, 0.78], [0.78, -0.78], [-0.78, -0.78]
  ];
  for (const [dx, dz] of strutDirs) {
    const start = new THREE.Vector3(cx + dx * 0.56, VIETNAM_WATER_LEVEL + 2.52, cz + dz * 0.56);
    const end = new THREE.Vector3(cx + dx * 1.55, floorY - 0.16, cz + dz * 1.55);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const strut = remapRelief(new THREE.BoxGeometry(0.18, len, 0.18), 'agedIronwood');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    strut.applyQuaternion(q);
    strut.translate((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5);
    atlasParts.push(strut);

    // Secondary parallel inner knee-brace (double-tiered đấu củng timber density!)
    const start2 = new THREE.Vector3(cx + dx * 0.58, VIETNAM_WATER_LEVEL + 3.05, cz + dz * 0.58);
    const end2 = new THREE.Vector3(cx + dx * 1.18, floorY - 0.16, cz + dz * 1.18);
    const dir2 = new THREE.Vector3().subVectors(end2, start2);
    const brace = remapRelief(new THREE.BoxGeometry(0.14, dir2.length(), 0.14), 'agedIronwood');
    brace.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir2.clone().normalize()));
    brace.translate((start2.x + end2.x) * 0.5, (start2.y + end2.y) * 0.5, (start2.z + end2.z) * 0.5);
    atlasParts.push(brace);
  }
  // Horizontal octagonal collar beam clamping struts around pillar + 4 carved lotus drop-posts (trụ treo)
  for (const s of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(1.85, 0.16, 0.16, 'agedIronwood', cx, VIETNAM_WATER_LEVEL + 3.35, cz + s * 0.88),
      makeReliefBox(0.16, 0.16, 1.85, 'agedIronwood', cx + s * 0.88, VIETNAM_WATER_LEVEL + 3.35, cz)
    );
  }
  for (const sx of [-1.52, 1.52]) {
    for (const sz of [-1.52, 1.52]) {
      atlasParts.push(
        makeReliefBox(0.16, 0.58, 0.16, 'agedIronwood', cx + sx, floorY - 0.44, cz + sz),
        makeReliefCyl(0.05, 0.11, 0.18, 8, 'agedIronwood', cx + sx, floorY - 0.78, cz + sz)
      );
    }
  }

  // --------------------------------------------------------------------------
  // 4. OPEN WOODEN LIÊN HOA ĐÀI PAVILION, BALUSTERS, PLAQUE & QUAN ÂM SHRINE (MC-11..MC-16)
  // --------------------------------------------------------------------------
  // Wooden floor deck
  atlasParts.push(makeReliefBox(3.48, 0.16, 3.48, 'agedIronwood', cx, floorY, cz));

  // 4 corner dark ironwood columns + 4 inner doorway framing posts
  for (const sx of [-1.52, 1.52]) {
    for (const sz of [-1.52, 1.52]) {
      atlasParts.push(makeReliefCyl(0.11, 0.125, 2.38, 12, 'agedIronwood', cx + sx, floorY + 1.24, cz + sz));
    }
  }
  // Upper lintel beams & carved frieze
  for (const s of [-1.52, 1.52]) {
    atlasParts.push(
      makeReliefBox(3.26, 0.22, 0.20, 'agedIronwood', cx, floorY + 2.34, cz + s),
      makeReliefBox(0.20, 0.22, 3.26, 'agedIronwood', cx + s, floorY + 2.34, cz)
    );
  }

  // Closely-spaced wooden balusters around all 4 sides (leaving East stairway entrance open!)
  const railH = 0.76;
  for (const s of [-1.52, 1.52]) {
    // North & South top + bottom rails
    atlasParts.push(
      makeReliefBox(3.04, 0.08, 0.10, 'agedIronwood', cx, floorY + railH, cz + s),
      makeReliefBox(3.04, 0.08, 0.10, 'agedIronwood', cx, floorY + 0.14, cz + s)
    );
    for (let bx = -1.26; bx <= 1.27; bx += 0.21) {
      atlasParts.push(makeReliefBox(0.055, railH - 0.14, 0.055, 'agedIronwood', cx + bx, floorY + 0.45, cz + s));
    }
  }
  // West rail (full)
  atlasParts.push(
    makeReliefBox(0.10, 0.08, 3.04, 'agedIronwood', cx - 1.52, floorY + railH, cz),
    makeReliefBox(0.10, 0.08, 3.04, 'agedIronwood', cx - 1.52, floorY + 0.14, cz)
  );
  for (let bz = -1.26; bz <= 1.27; bz += 0.21) {
    atlasParts.push(makeReliefBox(0.055, railH - 0.14, 0.055, 'agedIronwood', cx - 1.52, floorY + 0.45, cz + bz));
  }
  // East rail flanking stairway opening
  for (const side of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(0.10, 0.08, 0.92, 'agedIronwood', cx + 1.52, floorY + railH, cz + side * 1.06),
      makeReliefBox(0.10, 0.08, 0.92, 'agedIronwood', cx + 1.52, floorY + 0.14, cz + side * 1.06)
    );
    for (let b = 0; b < 4; b++) {
      atlasParts.push(
        makeReliefBox(0.055, railH - 0.14, 0.055, 'agedIronwood', cx + 1.52, floorY + 0.45, cz + side * (0.72 + b * 0.22))
      );
    }
  }

  // Crisp Gilded "蓮 花 臺" Plaque + Couplets on East (front stairway) AND North (ref 02/50 visibility)
  atlasParts.push(
    makeReliefBox(0.12, 0.56, 1.56, 'agedIronwood', cx + 1.56, floorY + 2.08, cz),
    makeArtPlane(1.48, 0.48, 'lienHoaDaiPlaque', cx + 1.63, floorY + 2.08, cz, Math.PI * 0.5),
    makeReliefBox(1.56, 0.56, 0.12, 'agedIronwood', cx, floorY + 2.08, cz - 1.56),
    makeArtPlane(1.48, 0.48, 'lienHoaDaiPlaque', cx, floorY + 2.08, cz - 1.63, Math.PI)
  );
  // Hanging crimson-gold couplets flanking East doorway
  for (const side of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(0.08, 1.48, 0.24, 'tamBaoGoldLacquer', cx + 1.54, floorY + 1.32, cz + side * 0.95),
      makeArtPlane(0.20, 1.40, 'cauDoiPair', cx + 1.59, floorY + 1.32, cz + side * 0.95, Math.PI * 0.5, 0, true)
    );
  }
  // Sculpted glowing lotus lanterns (replacing pastel cylinders!)
  for (const sx of [-1.25, 1.25]) {
    for (const sz of [-1.25, 1.25]) {
      const lTop = makeReliefCyl(0.03, 0.14, 0.12, 8, 'tamBaoGoldLacquer', cx + sx, floorY + 2.15, cz + sz);
      const lOrb = new THREE.SphereGeometry(0.13, 10, 8);
      lOrb.scale(1.0, 1.25, 1.0);
      lOrb.translate(cx + sx, floorY + 1.98, cz + sz);
      atlasParts.push(lTop);
      warmGlowParts.push(lOrb);
    }
  }

  // Shadowed inner Quan Âm shrine & gilded Bodhisattva inside Liên Hoa Đài
  atlasParts.push(
    makeReliefBox(0.92, 1.55, 1.48, 'darkTimberSoffit', cx - 0.92, floorY + 0.86, cz),
    makeReliefBox(0.68, 0.82, 1.24, 'tamBaoGoldLacquer', cx - 0.68, floorY + 0.49, cz)
  );
  const qaLotus = new THREE.CylinderGeometry(0.28, 0.20, 0.24, 12);
  qaLotus.translate(cx - 0.64, floorY + 1.02, cz);
  const qaBody = new THREE.ConeGeometry(0.22, 0.58, 10);
  qaBody.translate(cx - 0.64, floorY + 1.40, cz);
  const qaHead = new THREE.SphereGeometry(0.11, 10, 8);
  qaHead.translate(cx - 0.64, floorY + 1.76, cz);
  const qaHalo = new THREE.TorusGeometry(0.26, 0.03, 8, 16);
  qaHalo.rotateY(Math.PI * 0.5);
  qaHalo.translate(cx - 0.78, floorY + 1.62, cz);
  goldParts.push(qaLotus, qaBody, qaHead, qaHalo);

  // --------------------------------------------------------------------------
  // 5. STEEP 4-SLOPE MOSSY NGÓI MŨI HÀI ROOF + DARK SOFFIT + LƯỠNG LONG CHẦU NGUYỆT (MC-17..MC-22)
  // --------------------------------------------------------------------------
  const roofBaseY = floorY + 2.42;
  addVietnameseRoofWithSoffit(
    atlasParts,
    cx,
    roofBaseY,
    cz,
    5.65,
    5.65,
    0.72,
    0.72,
    2.45,
    0.72,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  // Sleek tapered grey-mossy upturned corner đao góc eaves hugging the 4 hip corners
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const dao = makeReliefCyl(0.04, 0.14, 0.62, 6, 'monolithicStoneDrum', cx + sx * 2.68, roofBaseY + 0.34, cz + sz * 2.68, Math.atan2(sx, sz), 0.55);
      atlasParts.push(dao);
    }
  }
  const opcFinials = createRoofFinialSetParts(cx, roofBaseY + 2.67, cz, 0.82, Math.PI * 0.5, 0.48, false);
  for (const p of opcFinials.mainParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  goldParts.push(...opcFinials.goldParts);

  // --------------------------------------------------------------------------
  // 6. SHORTER, STEEPER 13-STEP TERRACOTTA BRICK STAIRWAY & GATE (MC-23..MC-26)
  // --------------------------------------------------------------------------
  const stairStartX = cx + 6.95; // Connects cleanly from East causeway/landing up to floorY (4.42m)
  const stairEndX = cx + 1.65;
  const steps = 13;
  const totalRun = stairStartX - stairEndX;
  const totalRise = floorY - (VIETNAM_WATER_LEVEL + 0.32);
  const stepRun = totalRun / steps;
  const stepRise = totalRise / steps;

  // East stone causeway from basin rim (x = cx + 17) to stair foot (x = cx + 6.95)
  atlasParts.push(
    makeReliefBox(10.4, 1.35, 2.35, 'monolithicStoneDrum', cx + 12.0, VIETNAM_WATER_LEVEL - 0.35, cz),
    makeReliefBox(10.2, 0.12, 2.15, 'batTrangFloor', cx + 12.0, VIETNAM_WATER_LEVEL + 0.36, cz)
  );
  // Causeway low weathered lime parapet walls
  for (const sz of [-1.05, 1.05]) {
    atlasParts.push(
      makeReliefBox(9.8, 0.62, 0.22, 'weatheredLimeStucco', cx + 12.0, VIETNAM_WATER_LEVEL + 0.68, cz + sz),
      makeReliefBox(9.85, 0.10, 0.28, 'monolithicStoneDrum', cx + 12.0, VIETNAM_WATER_LEVEL + 1.02, cz + sz)
    );
  }

  // 13 terracotta brick steps + weathered moss-streaked lime cheek walls
  for (let i = 0; i < steps; i++) {
    const sx = stairStartX - (i + 0.5) * stepRun;
    const topY = VIETNAM_WATER_LEVEL + 0.32 + (i + 1) * stepRise;
    const h = topY - (VIETNAM_WATER_LEVEL - 0.95);
    atlasParts.push(
      makeReliefBox(stepRun + 0.04, h, 1.68, 'batTrangFloor', sx, topY - h * 0.5, cz)
    );
    // Stepped cheek walls on both sides of the staircase
    for (const side of [-1, 1]) {
      const ch = h + 0.62;
      atlasParts.push(
        makeReliefBox(stepRun + 0.08, ch, 0.28, 'weatheredLimeStucco', sx, topY + 0.62 - ch * 0.5, cz + side * 0.96),
        makeReliefBox(stepRun + 0.10, 0.09, 0.34, 'monolithicStoneDrum', sx, topY + 0.65, cz + side * 0.96)
      );
    }
  }
  // Sculpted lotus-bud finials & Nghê guardian posts at stair foot + carved timber entry gate
  for (const side of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(0.46, 1.55, 0.46, 'weatheredLimeStucco', stairStartX + 0.25, VIETNAM_WATER_LEVEL + 1.05, cz + side * 1.02),
      makeReliefCyl(0.06, 0.16, 0.32, 8, 'monolithicStoneDrum', stairStartX + 0.25, VIETNAM_WATER_LEVEL + 1.98, cz + side * 1.02),
      // Carved wood gate jambs at top of stairs
      makeReliefBox(0.16, 1.75, 0.16, 'agedIronwood', stairEndX + 0.1, floorY + 0.88, cz + side * 0.72)
    );
  }

  // Bronze incense tripod on causeway landing
  const tripod = createBronzeIncenseTripodParts(cx + 9.2, VIETNAM_WATER_LEVEL + 0.42, cz, 0.78);
  for (const p of tripod.limestoneParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  bronzeParts.push(...tripod.bronzeParts);
  goldParts.push(...tripod.goldParts);

  // --------------------------------------------------------------------------
  // 7. SACRED BODHI TREE (CÂY BỒ ĐỀ) & LUSH GARDEN FRAMING (MC-31..MC-32)
  // --------------------------------------------------------------------------
  const bodhiX = -63.0;
  const bodhiZ = 8.0;
  const bodhiY = ctx.getHeight(bodhiX, bodhiZ);
  // Lotus-petal stone planter
  atlasParts.push(
    makeReliefCyl(2.75, 2.95, 0.65, 12, 'monolithicStoneDrum', bodhiX, bodhiY + 0.26, bodhiZ),
    makeReliefCyl(2.45, 2.55, 0.22, 12, 'lushIsletGrass', bodhiX, bodhiY + 0.62, bodhiZ)
  );
  addFoliageCanopy(barkParts, leafParts, bodhiX, bodhiY + 0.55, bodhiZ, 1.38, 195801, [0x2a6628, 0x357a32, 0x225420]);
  // Hanging aerial prop roots
  for (let r = 0; r < 6; r++) {
    const a = (r / 6) * Math.PI * 2 + 0.4;
    const root = new THREE.CylinderGeometry(0.05, 0.08, 3.8, 5);
    root.translate(bodhiX + Math.cos(a) * 1.55, bodhiY + 2.4, bodhiZ + Math.sin(a) * 1.55);
    barkParts.push(root);
  }
  // Lush temple garden backdrop framing behind Chùa Một Cột (all >= 4.5m clear of pavilions & galleries!)
  const gardenTrees: Array<[number, number, number, number]> = [
    [-74.0, 20.5, 1.12, 701],
    [-72.0, 42.0, 1.18, 702],
    [-30.5, 47.5, 1.05, 703],
    [-31.5, 53.5, 1.02, 704]
  ];
  for (const [tx, tz, ts, tSeed] of gardenTrees) {
    const ty = ctx.getHeight(tx, tz);
    addFoliageCanopy(barkParts, leafParts, tx, ty, tz, ts, tSeed, [0x2c6b29, 0x3a7d34, 0x245922]);
  }

  // --------------------------------------------------------------------------
  // 8. CHÍNH ĐIỆN TAM BẢO — CHÙA DIÊN HỰU AT (-48, 43.5) (DH-01..DH-32)
  // Full 3-bay enclosed Northern Vietnamese sanctuary facing North (-Z) toward camera at (-48, 34.5)!
  // --------------------------------------------------------------------------
  const dhX = -48.0;
  const dhZ = 43.5;
  const dhBaseY = ctx.getHeight(dhX, dhZ);
  const dhFloorY = dhBaseY + 0.62;
  const hallW = 13.6;
  const hallD = 9.4;

  // Raised stone plinth + 3-step tam cấp entry staircase on North (-Z) face
  atlasParts.push(
    makeReliefBox(hallW + 1.2, 0.68, hallD + 1.4, 'monolithicStoneDrum', dhX, dhBaseY + 0.30, dhZ)
  );
  for (let s = 0; s < 3; s++) {
    atlasParts.push(
      makeReliefBox(5.6, 0.20, 0.42, 'monolithicStoneDrum', dhX, dhBaseY + 0.12 + s * 0.20, dhZ - hallD * 0.5 - 0.95 + s * 0.36)
    );
  }
  // 30×30cm Bát Tràng terracotta floor inside sanctuary
  addTiledFloor(atlasParts, dhX, dhZ, hallW, hallD, dhFloorY + 0.02, 8, 6, 'batTrangFloor');

  // Enclosed warm ochre-plastered side & back walls (DH-01..04) — North face open 3-bay veranda so interior is completely visible!
  const wallH = 4.25;
  atlasParts.push(
    makeReliefBox(hallW, wallH, 0.42, 'weatheredLimeStucco', dhX, dhFloorY + wallH * 0.5, dhZ + hallD * 0.5 - 0.21), // Back South wall
    makeReliefBox(0.42, wallH, hallD, 'weatheredLimeStucco', dhX - hallW * 0.5 + 0.21, dhFloorY + wallH * 0.5, dhZ), // West wall
    makeReliefBox(0.42, wallH, hallD, 'weatheredLimeStucco', dhX + hallW * 0.5 - 0.21, dhFloorY + wallH * 0.5, dhZ), // East wall
    // Partial flanking front wing walls framing the wide 3-bay central opening
    makeReliefBox(2.2, wallH, 0.38, 'weatheredLimeStucco', dhX - hallW * 0.5 + 1.1, dhFloorY + wallH * 0.5, dhZ - hallD * 0.5 + 0.19),
    makeReliefBox(2.2, wallH, 0.38, 'weatheredLimeStucco', dhX + hallW * 0.5 - 1.1, dhFloorY + wallH * 0.5, dhZ - hallD * 0.5 + 0.19)
  );

  // Cylindrical dark gỗ lim columns on stone lotus bases (DH-07..09)
  const colXs = [-4.2, -1.9, 1.9, 4.2];
  const colZs = [dhZ - hallD * 0.5 + 0.35, dhZ - 1.2, dhZ + 2.4];
  for (const ox of colXs) {
    for (const czPos of colZs) {
      atlasParts.push(
        makeReliefCyl(0.28, 0.34, 0.26, 12, 'monolithicStoneDrum', dhX + ox, dhFloorY + 0.13, czPos),
        makeReliefCyl(0.18, 0.20, wallH - 0.22, 14, 'agedIronwood', dhX + ox, dhFloorY + 0.26 + (wallH - 0.22) * 0.5, czPos)
      );
    }
  }

  // Exposed dark timber chồng rường rafters & crimson-gold tie beams (DH-10..12)
  for (const ox of colXs) {
    atlasParts.push(
      makeReliefBox(0.26, 0.32, hallD - 0.6, 'agedIronwood', dhX + ox, dhFloorY + wallH - 0.18, dhZ)
    );
  }
  for (const czPos of colZs) {
    atlasParts.push(
      makeReliefBox(hallW - 0.8, 0.30, 0.24, 'tamBaoGoldLacquer', dhX, dhFloorY + wallH - 0.22, czPos)
    );
  }

  // Grand double-eave curved mossy terracotta roof with dark timber soffit (WELL above the Hoành Phi — zero clipping!)
  const dhRoofY = dhFloorY + wallH + 0.05;
  addVietnameseRoofWithSoffit(
    atlasParts,
    dhX,
    dhRoofY,
    dhZ,
    hallW + 2.6,
    hallD + 2.6,
    hallW * 0.58,
    1.1,
    3.15,
    0.75,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  const dhFinials = createRoofFinialSetParts(dhX, dhRoofY + 3.37, dhZ, 7.2, 0, 0.82, false);
  for (const p of dhFinials.mainParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  goldParts.push(...dhFinials.goldParts);

  // Exterior & Interior Angled Gilded Hoành Phi ("大 雄 寶 殿 / CHÙA DIÊN HỰU"), Cửa Võng & Câu Đối (DH-13..18)
  // Exterior front fascia plaque (cleanly tucked high under roof eave for generous interior sightline)
  atlasParts.push(
    makeReliefBox(3.15, 0.64, 0.14, 'tamBaoGoldLacquer', dhX, dhFloorY + wallH - 0.36, dhZ - hallD * 0.5 + 0.12),
    makeArtPlane(3.02, 0.56, 'dienHuuHoanhPhi', dhX, dhFloorY + wallH - 0.36, dhZ - hallD * 0.5 + 0.04, Math.PI)
  );
  // Interior tilted gilded Hoành Phi suspended over central altar bay
  atlasParts.push(
    makeReliefBox(3.05, 0.72, 0.12, 'tamBaoGoldLacquer', dhX, dhFloorY + 3.48, dhZ - 1.15, 0, 0.22),
    makeArtPlane(2.94, 0.64, 'dienHuuHoanhPhi', dhX, dhFloorY + 3.46, dhZ - 1.22, Math.PI, -0.22)
  );
  // Carved filigree Cửa Võng hanging gracefully across central sanctuary arch
  atlasParts.push(
    makeReliefBox(3.55, 0.95, 0.12, 'cuaVongFiligree', dhX, dhFloorY + 2.74, dhZ - 1.2),
    makeReliefBox(0.55, 1.95, 0.12, 'cuaVongFiligree', dhX - 1.52, dhFloorY + 1.85, dhZ - 1.2),
    makeReliefBox(0.55, 1.95, 0.12, 'cuaVongFiligree', dhX + 1.52, dhFloorY + 1.85, dhZ - 1.2)
  );
  // Vertical crimson-gold Câu Đối on the two central front columns
  for (const sx of [-1.9, 1.9]) {
    atlasParts.push(
      makeReliefBox(0.32, 2.35, 0.10, 'tamBaoGoldLacquer', dhX + sx, dhFloorY + 1.75, dhZ - 1.44),
      makeArtPlane(0.28, 2.25, 'cauDoiPair', dhX + sx, dhFloorY + 1.75, dhZ - 1.50, Math.PI, 0, true)
    );
  }
  // Hanging embroidered crimson-saffron silk Phướn banners flanking the altar
  for (const sx of [-3.1, 3.1]) {
    atlasParts.push(
      makeReliefBox(0.42, 2.1, 0.04, 'tamBaoGoldLacquer', dhX + sx, dhFloorY + 2.15, dhZ - 0.35),
      makeArtPlane(0.38, 2.02, 'silkPhuonBanner', dhX + sx, dhFloorY + 2.15, dhZ - 0.38, Math.PI, 0, true)
    );
  }

  // 5-Tier Stepped Crimson-Gold Tam Bảo Altar Dais (DH-13..15)
  const altarZ = dhZ + 2.55;
  for (let t = 0; t < 5; t++) {
    const tw = 5.4 - t * 0.42;
    const td = 3.2 - t * 0.42;
    const th = 0.34;
    atlasParts.push(
      makeReliefBox(tw, th, td, 'tamBaoGoldLacquer', dhX, dhFloorY + 0.17 + t * th, altarZ + t * 0.22)
    );
  }

  // Gilded Tam Thế Phật Triad (top tier) + Centerpiece Thousand-Arm Quan Thế Âm Bồ Tát (DH-19..24)
  const buddhaSpots: Array<[number, number, number, number]> = [
    [dhX - 1.15, dhFloorY + 1.72, altarZ + 0.85, 0.92],
    [dhX, dhFloorY + 1.76, altarZ + 0.85, 1.05],
    [dhX + 1.15, dhFloorY + 1.72, altarZ + 0.85, 0.92]
  ];
  for (const [bx, by, bz, bs] of buddhaSpots) {
    const lotus = new THREE.CylinderGeometry(0.36 * bs, 0.24 * bs, 0.26 * bs, 12);
    lotus.translate(bx, by + 0.13 * bs, bz);
    const body = new THREE.ConeGeometry(0.28 * bs, 0.72 * bs, 10);
    body.translate(bx, by + 0.58 * bs, bz);
    const head = new THREE.SphereGeometry(0.14 * bs, 10, 8);
    head.translate(bx, by + 1.02 * bs, bz);
    const ushnisha = new THREE.SphereGeometry(0.06 * bs, 8, 6);
    ushnisha.translate(bx, by + 1.16 * bs, bz);
    const halo = new THREE.TorusGeometry(0.34 * bs, 0.035 * bs, 8, 18);
    halo.translate(bx, by + 0.85 * bs, bz + 0.18 * bs);
    goldParts.push(lotus, body, head, ushnisha, halo);
  }
  // Centerpiece Thousand-Arm Quan Thế Âm Bồ Tát (tier 3 front center) with radiant multi-arm gold fan
  const qaX = dhX;
  const qaY = dhFloorY + 1.04;
  const qaZ = altarZ + 0.18;
  const qaThrone = new THREE.CylinderGeometry(0.42, 0.28, 0.30, 14);
  qaThrone.translate(qaX, qaY + 0.15, qaZ);
  const qaTorso = new THREE.ConeGeometry(0.30, 0.78, 12);
  qaTorso.translate(qaX, qaY + 0.64, qaZ);
  const qaHead2 = new THREE.SphereGeometry(0.14, 10, 8);
  qaHead2.translate(qaX, qaY + 1.10, qaZ);
  const qaAureole = new THREE.TorusGeometry(0.56, 0.045, 8, 22);
  qaAureole.translate(qaX, qaY + 0.84, qaZ + 0.14);
  goldParts.push(qaThrone, qaTorso, qaHead2, qaAureole);
  for (let a = -5; a <= 5; a++) {
    const ang = (a / 5) * 1.25;
    const arm = new THREE.BoxGeometry(0.045, 0.52, 0.03);
    arm.translate(0, 0.26, 0);
    arm.rotateZ(ang);
    arm.translate(qaX, qaY + 0.68, qaZ + 0.08);
    goldParts.push(arm);
  }

  // Crimson Án Gian Offering Table + Bronze Lư Hương + Twin Hạc Chầu Quy + Candlesticks, Vases, Fruit Trays, Mõ & Chuông (DH-25..32)
  const tableZ = dhZ + 0.15;
  atlasParts.push(
    makeReliefBox(3.4, 1.02, 1.05, 'tamBaoGoldLacquer', dhX, dhFloorY + 0.51, tableZ),
    makeReliefBox(3.55, 0.10, 1.16, 'tamBaoGoldLacquer', dhX, dhFloorY + 1.04, tableZ)
  );
  // Central bronze lư hương (incense burner)
  const luBody = new THREE.CylinderGeometry(0.24, 0.18, 0.36, 12);
  luBody.translate(dhX, dhFloorY + 1.28, tableZ);
  bronzeParts.push(luBody);
  // Twin Hạc Chầu Quy (bronze cranes standing on tortoises) flanking the offering table
  for (const sx of [-1.25, 1.25]) {
    const tort = new THREE.SphereGeometry(0.22, 10, 8);
    tort.scale(1.2, 0.55, 1.4);
    tort.translate(dhX + sx, dhFloorY + 1.16, tableZ);
    const legs = new THREE.CylinderGeometry(0.03, 0.04, 0.58, 6);
    legs.translate(dhX + sx, dhFloorY + 1.52, tableZ);
    const craneBody = new THREE.SphereGeometry(0.14, 10, 8);
    craneBody.scale(0.85, 1.0, 1.35);
    craneBody.translate(dhX + sx, dhFloorY + 1.84, tableZ);
    const neck = new THREE.CylinderGeometry(0.025, 0.035, 0.34, 6);
    neck.translate(dhX + sx, dhFloorY + 2.08, tableZ - 0.06);
    bronzeParts.push(tort, legs, craneBody, neck);
  }
  // Brass candlesticks + glowing red candles + lotus vases + fruit trays + mõ & chuông gia trì
  for (const sx of [-0.72, 0.72]) {
    const cBase = new THREE.CylinderGeometry(0.08, 0.12, 0.32, 10);
    cBase.translate(dhX + sx, dhFloorY + 1.26, tableZ - 0.22);
    goldParts.push(cBase);
    const flame = new THREE.SphereGeometry(0.055, 8, 6);
    flame.translate(dhX + sx, dhFloorY + 1.58, tableZ - 0.22);
    warmGlowParts.push(flame);
    // Porcelain lotus vase
    const vase = new THREE.CylinderGeometry(0.10, 0.13, 0.38, 10);
    vase.translate(dhX + sx * 1.45, dhFloorY + 1.28, tableZ + 0.18);
    atlasParts.push(remapRelief(vase, 'hoaChanhGreenTile'));
  }
  // Mõ gỗ (wooden fish) & Chuông gia trì (singing bowl bell)
  const mo = new THREE.SphereGeometry(0.16, 10, 8);
  mo.scale(1.25, 0.9, 1.0);
  mo.translate(dhX - 0.55, dhFloorY + 1.22, tableZ - 0.32);
  atlasParts.push(remapRelief(mo, 'tamBaoGoldLacquer'));
  const chuong = new THREE.CylinderGeometry(0.15, 0.11, 0.20, 12);
  chuong.translate(dhX + 0.55, dhFloorY + 1.20, tableZ - 0.32);
  bronzeParts.push(chuong);

  // Warm sanctuary candlelit PointLight illuminating Tam Bảo interior!
  const altarLight = new THREE.PointLight('#ffbe66', 4.5, 16, 1.6);
  altarLight.position.set(dhX, dhFloorY + 2.8, dhZ + 0.2);
  group.add(altarLight);

  // --------------------------------------------------------------------------
  // 8B. CHÙA MỘT CỘT & DIÊN HỰU QC EXPANSIONS (Items 001..025)
  // --------------------------------------------------------------------------
  const ePlzY = ctx.getHeight(cx + 20.0, cz);
  // 001-002. Tam Quan outer ceremonial entrance gate at East approach (-26, 22) with twin side archways
  const tqX = cx + 22.0; // -26.0
  const tqGateArch = remapRelief(
    createArchedWallGeometry(3.8, 4.2, 0.9, 2.2, 3.1),
    'weatheredLimeStucco'
  );
  tqGateArch.rotateY(Math.PI * 0.5);
  tqGateArch.translate(tqX, ePlzY, cz);
  atlasParts.push(tqGateArch);
  for (const sz of [-3.6, 3.6]) {
    const sideArch = remapRelief(
      createArchedWallGeometry(2.6, 3.2, 0.75, 1.35, 2.3),
      'weatheredLimeStucco'
    );
    sideArch.rotateY(Math.PI * 0.5);
    sideArch.translate(tqX, ePlzY, cz + sz);
    atlasParts.push(sideArch);
    addVietnameseRoofWithSoffit(atlasParts, tqX, ePlzY + 3.15, cz + sz, 1.6, 3.1, 0.45, 1.5, 0.95, 0.35);
    // 023. Carved timber câu đối vertical couplet boards on Tam Quan inner gate piers
    atlasParts.push(
      makeReliefBox(0.08, 1.75, 0.30, 'tamBaoGoldLacquer', tqX - 0.50, ePlzY + 1.95, cz + sz * 0.42),
      makeArtPlane(0.24, 1.65, 'cauDoiPair', tqX - 0.56, ePlzY + 1.95, cz + sz * 0.42, -Math.PI * 0.5, 0, true)
    );
  }
  addVietnameseRoofWithSoffit(atlasParts, tqX, ePlzY + 4.12, cz, 2.2, 4.8, 0.65, 2.2, 1.35, 0.48);
  const tqFinials = createRoofFinialSetParts(tqX, ePlzY + 5.69, cz, 2.15, Math.PI * 0.5, 0.52, false);
  for (const p of tqFinials.mainParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  goldParts.push(...tqFinials.goldParts);

  // 003-004. Stone Hạ Mã bollards + Bát Tràng diamond-tile East approach apron
  addTiledFloor(atlasParts, cx + 19.8, cz, 5.2, 5.0, ePlzY + 0.04, 3, 3, 'batTrangFloor');
  for (const sz of [-2.8, 2.8]) {
    atlasParts.push(
      makeReliefBox(0.42, 0.95, 0.42, 'monolithicStoneDrum', cx + 18.6, ePlzY + 0.48, cz + sz),
      makeReliefCyl(0.06, 0.16, 0.24, 8, 'monolithicStoneDrum', cx + 18.6, ePlzY + 1.06, cz + sz)
    );
  }

  // 005-006. Stone drainage dragon spouts & submerged stepped granite footing ledges on Hồ Linh Chiểu
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    atlasParts.push(
      makeReliefBox(0.32, 0.22, 0.56, 'monolithicStoneDrum', cx + sx * 10.0, VIETNAM_WATER_LEVEL + 0.28, cz + sz * (halfBasin - 0.55)),
      makeReliefBox(16.0, 0.35, 0.75, 'monolithicStoneDrum', cx, VIETNAM_WATER_LEVEL - 0.18, cz + sz * (halfBasin - 0.55))
    );
  }

  // 007-008. Miniature Hòn Non Bộ mossy limestone rockery islands in NW & SW corners of Hồ Linh Chiểu
  for (const rz of [-9.5, 9.5]) {
    const rRock = remapRelief(createSculptedRockGeometry(901 + rz, 1.45, 1.25, 1.35, 1), 'thapButSandstone');
    rRock.translate(cx - 10.2, VIETNAM_WATER_LEVEL + 0.28, cz + rz);
    atlasParts.push(rRock);
    if (rz > 0) {
      addFoliageCanopy(barkParts, leafParts, cx - 10.2, VIETNAM_WATER_LEVEL + 0.88, cz + rz, 0.26, 912, [0x2a6626, 0x3b7f35]);
    }
  }

  // 009. Carved stone incense burner (lư hương đá) & offering table at East courtyard entrance (outside basin rim!)
  const mcBurner = createBronzeIncenseTripodParts(cx + 19.2, ePlzY + 0.04, cz, 0.56);
  for (const p of mcBurner.limestoneParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  bronzeParts.push(...mcBurner.bronzeParts);
  goldParts.push(...mcBurner.goldParts);
  atlasParts.push(makeReliefBox(1.15, 0.62, 0.65, 'monolithicStoneDrum', cx + 19.2, ePlzY + 0.31, cz + 1.55));

  // 010. Twin Bia Công Đức (merit stele) sheltered kiosks flanking East courtyard (outside basin rim!)
  for (const sz of [-6.5, 6.5]) {
    const bx = cx + 19.6;
    const bz = cz + sz;
    const by = ctx.getHeight(bx, bz);
    atlasParts.push(
      makeReliefBox(1.4, 0.22, 1.0, 'monolithicStoneDrum', bx, by + 0.11, bz),
      makeReliefBox(0.76, 1.42, 0.16, 'monolithicStoneDrum', bx, by + 0.92, bz),
      makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', bx - 0.65, by + 0.92, bz),
      makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', bx + 0.65, by + 0.92, bz)
    );
    addVietnameseRoofWithSoffit(atlasParts, bx, by + 1.82, bz, 1.85, 1.35, 0.55, 0.35, 0.65, 0.22);
  }

  // 011-012. Traditional Quán Trà Sen (Lotus Tea Pavilion) area expansion at SE courtyard (-26, 35.5 — outside pond!)
  const teaX = cx + 22.0; // -26.0
  const teaZ = cz + 13.5; // 35.5
  const teaY = ctx.getHeight(teaX, teaZ);
  atlasParts.push(makeReliefBox(5.4, 0.88, 4.4, 'monolithicStoneDrum', teaX, teaY - 0.16, teaZ));
  addTiledFloor(atlasParts, teaX, teaZ, 5.0, 4.0, teaY + 0.29, 3, 2, 'batTrangFloor');
  for (const px of [-2.1, 2.1]) {
    for (const pz of [-1.6, 1.6]) {
      atlasParts.push(makeReliefCyl(0.11, 0.13, 2.55, 8, 'agedIronwood', teaX + px, teaY + 1.50, teaZ + pz));
    }
  }
  addVietnameseRoofWithSoffit(atlasParts, teaX, teaY + 2.72, teaZ, 6.2, 5.2, 2.4, 1.6, 1.35, 0.45);
  // Timber tea tables, low wooden stools & ceramic celadon tea sets inside Quán Trà Sen
  for (const txOff of [-1.1, 1.1]) {
    atlasParts.push(
      makeReliefBox(0.95, 0.08, 0.75, 'agedIronwood', teaX + txOff, teaY + 0.82, teaZ),
      makeReliefBox(0.14, 0.52, 0.14, 'agedIronwood', teaX + txOff, teaY + 0.54, teaZ),
      makeReliefCyl(0.09, 0.07, 0.18, 8, 'hoaChanhGreenTile', teaX + txOff, teaY + 0.95, teaZ)
    );
    for (const szOff of [-0.62, 0.62]) {
      atlasParts.push(makeReliefBox(0.42, 0.34, 0.32, 'agedIronwood', teaX + txOff, teaY + 0.45, teaZ + szOff));
    }
  }

  // 013-014. Carved stone benches & heritage stone lanterns along East & South promenades
  for (const [bx, bz, rot] of [
    [cx + 18.8, cz - 11.5, Math.PI * 0.5],
    [cx + 18.8, cz + 11.5, Math.PI * 0.5],
    [cx - 6.0, cz + 19.2, 0],
    [cx + 6.0, cz + 19.2, 0]
  ] as const) {
    const by = ctx.getHeight(bx, bz);
    atlasParts.push(
      makeReliefBox(1.85, 0.12, 0.56, 'monolithicStoneDrum', bx, by + 0.48, bz, rot),
      makeReliefBox(0.24, 0.42, 0.46, 'monolithicStoneDrum', bx - Math.cos(rot) * 0.65, by + 0.21, bz + Math.sin(rot) * 0.65, rot),
      makeReliefBox(0.24, 0.42, 0.46, 'monolithicStoneDrum', bx + Math.cos(rot) * 0.65, by + 0.21, bz - Math.sin(rot) * 0.65, rot)
    );
  }
  for (const [lx, lz] of [
    [cx + 20.5, cz - 4.2], [cx + 20.5, cz + 4.2],
    [cx - 4.5, cz + 29.0], [cx + 4.5, cz + 29.0]
  ] as const) {
    const ly = ctx.getHeight(lx, lz);
    atlasParts.push(
      makeReliefBox(0.48, 0.85, 0.48, 'monolithicStoneDrum', lx, ly + 0.42, lz),
      makeReliefBox(0.36, 0.42, 0.36, 'weatheredLimeStucco', lx, ly + 1.05, lz),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', lx, ly + 1.34, lz)
    );
    warmGlowParts.push(new THREE.BoxGeometry(0.22, 0.24, 0.22).translate(lx, ly + 1.05, lz));
  }

  // 015-016. Lầu Chuông (Bell Pavilion, East) & Lầu Trống (Drum Pavilion, West) flanking Diên Hựu (-48, 43.5)
  const dhY = ctx.getHeight(cx, 43.5);
  for (const side of [-1, 1]) {
    const px = cx + side * 10.5; // -58.5 & -37.5
    const pz = 43.5;
    atlasParts.push(makeReliefBox(3.4, 0.36, 3.4, 'monolithicStoneDrum', px, dhY + 0.18, pz));
    for (const dx of [-1.25, 1.25]) {
      for (const dz of [-1.25, 1.25]) {
        atlasParts.push(makeReliefCyl(0.11, 0.13, 3.0, 8, 'agedIronwood', px + dx, dhY + 1.86, pz + dz));
      }
    }
    addVietnameseRoofWithSoffit(atlasParts, px, dhY + 3.36, pz, 4.2, 4.2, 1.2, 1.2, 1.35, 0.48);
    if (side > 0) {
      // 015. Suspended Đại Hồng Chung bronze bell
      bronzeParts.push(new THREE.CylinderGeometry(0.36, 0.52, 1.15, 12).translate(px, dhY + 2.15, pz));
    } else {
      // 016. Red-lacquered Trống Chùa festival drum
      atlasParts.push(makeReliefCyl(0.46, 0.46, 0.92, 12, 'tamBaoGoldLacquer', px, dhY + 1.85, pz, 0, 0, Math.PI * 0.5));
    }
  }

  // 017-025. Diên Hựu walkway, potted kumquat/tùng planters, brass altar candle stands, roof finials, Cây Đại, info plaque, Bodhi curb & perimeter coping
  addTiledFloor(atlasParts, cx, 34.5, 4.6, 11.5, dhY + 0.04, 2, 5, 'batTrangFloor');
  for (const side of [-1, 1]) {
    // 018. Ceramic potted planters flanking Diên Hựu veranda
    atlasParts.push(makeReliefCyl(0.34, 0.24, 0.48, 8, 'hoaChanhGreenTile', cx + side * 4.8, dhY + 0.42, 38.2));
    addFoliageCanopy(barkParts, leafParts, cx + side * 4.8, dhY + 0.65, 38.2, 0.24, 920 + side, [0x2a6626, 0x3b7f35]);
    // 019. Brass candle stands & offering tray on Diên Hựu porch
    bronzeParts.push(new THREE.CylinderGeometry(0.05, 0.14, 0.68, 8).translate(cx + side * 1.15, dhFloorY + 0.34, 41.2));
  }
  // 021. Traditional Cây Đại (frangipani) temple trees with pale trunks
  for (const [fx, fz, fSeed] of [[cx - 12.5, 37.0, 931], [cx + 12.5, 37.0, 932]] as const) {
    addFoliageCanopy(barkParts, leafParts, fx, ctx.getHeight(fx, fz), fz, 0.68, fSeed, [0x3d7c34, 0xf2f0d8, 0x4b8a42]);
  }
  // 022. Heritage information plaque at Tam Quan entrance (-27.5, 25.8)
  atlasParts.push(
    makeReliefBox(0.14, 1.35, 0.95, 'agedIronwood', cx + 20.5, ePlzY + 0.85, cz + 3.8),
    makeArtPlane(0.84, 0.56, 'dienHuuHoanhPhi', cx + 20.41, ePlzY + 1.15, cz + 3.8, -Math.PI * 0.5)
  );
  // 024. Low mossy stone border curbing around Sacred Bodhi Tree root bed (-63, 8)
  const bdY = ctx.getHeight(-63.0, 8.0);
  atlasParts.push(makeReliefCyl(3.1, 3.3, 0.32, 12, 'monolithicStoneDrum', -63.0, bdY + 0.16, 8.0));
  // 025. Decorative Ngói Âm Dương coping caps along outer courtyard low wall (leave East causeway opening clear!)
  atlasParts.push(
    makeReliefBox(0.36, 0.32, 34.0, 'ngoiMuiHaiMossy', cx - (halfBasin + 0.05), 1.48, cz),
    makeReliefBox(0.36, 0.32, 14.4, 'ngoiMuiHaiMossy', cx + (halfBasin + 0.05), 1.48, cz - 9.8),
    makeReliefBox(0.36, 0.32, 14.4, 'ngoiMuiHaiMossy', cx + (halfBasin + 0.05), 1.48, cz + 9.8)
  );

  // --------------------------------------------------------------------------
  // 9. CLUSTERED ORGANIC LOTUS PADS & BLOOMS IN HỒ LINH CHIỂU (MC-29..MC-30)
  // --------------------------------------------------------------------------
  const rand = mulberry32(482201);
  const leafCount = 380;
  const flowerCount = 120;
  // Notched organic lily pad geometry (open cleft wedge) + sculpted multi-petal lotus blossom
  const leafGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.04, 14, 1, false, 0.28, Math.PI * 2 - 0.56);
  const petalParts: THREE.BufferGeometry[] = [];
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    const petal = new THREE.ConeGeometry(0.085, 0.24, 5);
    petal.scale(1.0, 1.0, 0.42);
    petal.rotateX(0.68);
    petal.rotateY(a);
    petal.translate(Math.sin(a) * 0.08, 0.08, Math.cos(a) * 0.08);
    petalParts.push(petal);
  }
  const petalGeo = mergeNormalized(petalParts);
  const coreGeo = new THREE.SphereGeometry(0.06, 8, 6);
  coreGeo.translate(0, 0.09, 0);
  const stemGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.42, 5);
  stemGeo.translate(0, -0.21, 0);

  const leafMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({ color: '#ffffff', roughness: 0.56, metalness: 0.02, side: THREE.DoubleSide })
    : ctx.materials.stone;
  const petalMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({ color: '#ffffff', roughness: 0.42, metalness: 0.02, side: THREE.DoubleSide })
    : ctx.materials.whitePlaster;

  const lotusLeaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  lotusLeaves.name = 'InstancedLotusLeaves';
  const lotusFlowers = new THREE.InstancedMesh(petalGeo, petalMat, flowerCount);
  lotusFlowers.name = 'InstancedLotusFlowers';
  const lotusCores = new THREE.InstancedMesh(coreGeo, ctx.materials.gold, flowerCount);
  const lotusStems = new THREE.InstancedMesh(stemGeo, leafMat, flowerCount);
  lotusLeaves.receiveShadow = true;

  const dummy = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  const isInsidePond = (px: number, pz: number): boolean => {
    if (Math.abs(px - cx) > 15.6 || Math.abs(pz - cz) > 15.6) return false;
    if (Math.hypot(px - cx, pz - cz) < 2.2) return false;
    if (px > cx - 0.5 && px < cx + 17.2 && Math.abs(pz - cz) < 2.2) return false;
    return true;
  };

  const clusterCenters: Array<[number, number]> = [
    [cx - 10.2, cz - 10.2],
    [cx + 9.5, cz - 10.5],
    [cx - 10.4, cz + 9.8],
    [cx + 9.2, cz + 10.2]
  ];
  let placedLeaves = 0;
  for (let i = 0; i < leafCount * 6 && placedLeaves < leafCount; i++) {
    const cl = clusterCenters[placedLeaves % clusterCenters.length];
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 5.8;
    const lx = cl[0] + Math.cos(a) * r;
    const lz = cl[1] + Math.sin(a) * r;
    if (!isInsidePond(lx, lz)) continue;
    const sc = 0.56 + rand() * 0.50;
    pos.set(lx, VIETNAM_WATER_LEVEL + 0.04 + rand() * 0.03, lz);
    euler.set((rand() - 0.5) * 0.05, rand() * Math.PI * 2, (rand() - 0.5) * 0.05);
    quat.setFromEuler(euler);
    scale.set(sc, 0.16, sc);
    dummy.compose(pos, quat, scale);
    lotusLeaves.setMatrixAt(placedLeaves, dummy);
    col.setHSL(0.30 + (rand() - 0.5) * 0.05, 0.46, 0.24 + rand() * 0.10);
    lotusLeaves.setColorAt(placedLeaves, col);
    placedLeaves++;
  }
  if (registerFoliage) registerFoliage(lotusLeaves, placedLeaves);
  lotusLeaves.count = Math.max(1, Math.round(placedLeaves * foliageScale));
  lotusLeaves.instanceMatrix.needsUpdate = true;
  if (lotusLeaves.instanceColor) lotusLeaves.instanceColor.needsUpdate = true;
  lotusLeaves.computeBoundingBox();
  lotusLeaves.computeBoundingSphere();
  group.add(lotusLeaves);

  let placedFlowers = 0;
  for (let i = 0; i < flowerCount * 6 && placedFlowers < flowerCount; i++) {
    const cl = clusterCenters[placedFlowers % clusterCenters.length];
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 5.2;
    const fx = cl[0] + Math.cos(a) * r;
    const fz = cl[1] + Math.sin(a) * r;
    if (!isInsidePond(fx, fz)) continue;
    const sc = 0.85 + rand() * 0.50;
    pos.set(fx, VIETNAM_WATER_LEVEL + 0.24 + rand() * 0.28, fz);
    quat.setFromAxisAngle(upAxis, rand() * Math.PI * 2);
    scale.set(sc, sc, sc);
    dummy.compose(pos, quat, scale);
    lotusFlowers.setMatrixAt(placedFlowers, dummy);
    lotusCores.setMatrixAt(placedFlowers, dummy);
    lotusStems.setMatrixAt(placedFlowers, dummy);
    col.set(rand() > 0.28 ? '#f592b6' : '#fef0f5');
    lotusFlowers.setColorAt(placedFlowers, col);
    placedFlowers++;
  }
  if (registerFoliage) {
    registerFoliage(lotusFlowers, placedFlowers);
    registerFoliage(lotusCores, placedFlowers);
    registerFoliage(lotusStems, placedFlowers);
  }
  const scaledF = Math.max(1, Math.round(placedFlowers * foliageScale));
  lotusFlowers.count = scaledF;
  lotusCores.count = scaledF;
  lotusStems.count = scaledF;
  lotusFlowers.instanceMatrix.needsUpdate = true;
  lotusCores.instanceMatrix.needsUpdate = true;
  lotusStems.instanceMatrix.needsUpdate = true;
  if (lotusFlowers.instanceColor) lotusFlowers.instanceColor.needsUpdate = true;
  lotusFlowers.computeBoundingBox();
  lotusCores.computeBoundingBox();
  lotusStems.computeBoundingBox();
  group.add(lotusFlowers, lotusCores, lotusStems);

  // Merge all static batches
  const foliageMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    : ctx.materials.stone;
  const glowMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#ffe8a8',
        emissive: '#ffaa33',
        emissiveIntensity: 2.5,
        roughness: 0.25
      })
    : ctx.materials.gold;

  const atlasMesh = createMergedMesh('OnePillarAtlasMesh', atlasParts, pack.hanoiIconsMasterAtlasMat, true, true);
  if (atlasMesh) group.add(atlasMesh);
  const goldMesh = createMergedMesh('OnePillarGoldMesh', goldParts, ctx.materials.gold, true, true);
  if (goldMesh) group.add(goldMesh);
  const bronzeMesh = createMergedMesh('OnePillarBronzeMesh', bronzeParts, ctx.materials.bronze, true, true);
  if (bronzeMesh) group.add(bronzeMesh);
  const barkMesh = createMergedMesh('OnePillarBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (barkMesh) group.add(barkMesh);
  const leafMesh = createMergedMesh('OnePillarLeafMesh', leafParts, foliageMat, true, false);
  if (leafMesh) group.add(leafMesh);
  const glowMesh = createMergedMesh('OnePillarGlowMesh', warmGlowParts, glowMat, false, false);
  if (glowMesh) group.add(glowMesh);

  // --------------------------------------------------------------------------
  // 10. CHÙA MỘT CỘT & DIÊN HỰU WAVE 2 REAL-WORLD DETAILS (Items 201..225)
  // Low-poly batched meshes (castShadow = false, 0 new materials)
  // --------------------------------------------------------------------------
  const opcW2Atlas: THREE.BufferGeometry[] = [];
  const opcW2Gold: THREE.BufferGeometry[] = [];
  const opcW2Bronze: THREE.BufferGeometry[] = [];
  const opcW2Glow: THREE.BufferGeometry[] = [];

  // 201. Cổng Làng Bắc Bộ secondary West garden gatehouse (-63.0, 16.5) framing Bodhi Tree path
  const wgY = ctx.getHeight(-63.0, 16.5);
  opcW2Atlas.push(
    makeReliefBox(0.55, 2.85, 0.55, 'weatheredLimeStucco', -64.4, wgY + 1.42, 16.5),
    makeReliefBox(0.55, 2.85, 0.55, 'weatheredLimeStucco', -61.6, wgY + 1.42, 16.5),
    makeReliefBox(3.5, 0.42, 0.65, 'weatheredLimeStucco', -63.0, wgY + 2.85, 16.5),
    makeReliefBox(3.9, 0.36, 1.35, 'ngoiMuiHaiMossy', -63.0, wgY + 3.22, 16.5),
    makeReliefBox(2.8, 0.28, 0.72, 'ngoiMuiHaiMossy', -63.0, wgY + 3.52, 16.5)
  );
  // 202-204. Diên Hựu sutra lectern, mõ gỗ & chuông gia trì, and pair of armored Hộ Pháp guardian statues
  opcW2Atlas.push(
    makeReliefBox(0.75, 0.92, 0.55, 'agedIronwood', dhX - 1.45, dhFloorY + 0.46, dhZ - 2.35),
    makeReliefBox(0.62, 0.08, 0.44, 'tamBaoGoldLacquer', dhX - 1.45, dhFloorY + 0.96, dhZ - 2.35, 0, 0.25),
    makeReliefBox(0.32, 0.22, 0.26, 'tamBaoGoldLacquer', dhX + 1.15, dhFloorY + 1.02, dhZ - 1.85)
  );
  opcW2Bronze.push(
    new THREE.CylinderGeometry(0.16, 0.12, 0.18, 6).translate(dhX - 1.15, dhFloorY + 1.02, dhZ - 1.85)
  );
  for (const side of [-1, 1]) {
    opcW2Atlas.push(makeReliefBox(0.72, 0.48, 0.72, 'monolithicStoneDrum', dhX + side * 3.1, dhFloorY + 0.24, dhZ - 3.6));
    opcW2Gold.push(
      new THREE.CylinderGeometry(0.20, 0.26, 1.25, 6).translate(dhX + side * 3.1, dhFloorY + 1.10, dhZ - 3.6),
      new THREE.ConeGeometry(0.16, 0.36, 5).translate(dhX + side * 3.1, dhFloorY + 1.88, dhZ - 3.6)
    );
  }
  // 205-206. Merit donation table & Hòm Công Đức near Tam Quan + Quán Trà Sen floral pergola arbor
  opcW2Atlas.push(
    makeReliefBox(1.35, 0.78, 0.65, 'agedIronwood', cx + 19.2, ePlzY + 0.39, cz - 3.2),
    makeReliefBox(0.48, 0.42, 0.38, 'tamBaoGoldLacquer', cx + 19.2, ePlzY + 0.98, cz - 3.2)
  );
  const pergX = teaX + 5.2; // -20.8, East of Quán Trà Sen (cleanly clear of Hành Lang Đông!)
  const pergY = ctx.getHeight(pergX, teaZ);
  for (const px of [pergX - 1.4, pergX + 1.4]) {
    for (const pz of [teaZ - 1.5, teaZ + 1.5]) {
      opcW2Atlas.push(makeReliefBox(0.14, 2.75, 0.14, 'agedIronwood', px, pergY + 1.24, pz));
    }
  }
  for (let b = -1.4; b <= 1.45; b += 0.7) {
    opcW2Atlas.push(makeReliefBox(3.2, 0.10, 0.12, 'agedIronwood', pergX, pergY + 2.58, teaZ + b));
  }
  // 207-208. Chu Đậu ceramic lotus vases flanking Diên Hựu altar + brass oil-lamp stands inside Liên Hoa Đài
  for (const side of [-1, 1]) {
    opcW2Atlas.push(
      makeReliefBox(0.38, 0.45, 0.38, 'agedIronwood', dhX + side * 2.35, dhFloorY + 0.22, dhZ + 1.8),
      makeReliefCyl(0.14, 0.18, 0.65, 6, 'hoaChanhGreenTile', dhX + side * 2.35, dhFloorY + 0.78, dhZ + 1.8)
    );
    opcW2Bronze.push(
      new THREE.CylinderGeometry(0.04, 0.10, 0.56, 5).translate(cx + 0.95, floorY + 0.36, cz + side * 0.58)
    );
    opcW2Glow.push(new THREE.BoxGeometry(0.08, 0.10, 0.08).translate(cx + 0.95, floorY + 0.68, cz + side * 0.58));
  }
  // 209-211. NW mossy stone footbridge, SW votive paper burner (Lư Hóa Vàng) & Diên Hựu scripture cabinets
  const nwBrY = ctx.getHeight(-62.5, 11.5);
  opcW2Atlas.push(
    makeReliefBox(2.6, 0.22, 1.25, 'monolithicStoneDrum', -62.5, nwBrY + 0.24, 11.5),
    makeReliefBox(2.6, 0.36, 0.14, 'monolithicStoneDrum', -62.5, nwBrY + 0.48, 10.92),
    makeReliefBox(2.6, 0.36, 0.14, 'monolithicStoneDrum', -62.5, nwBrY + 0.48, 12.08)
  );
  const lhvY = ctx.getHeight(cx - 20.5, 34.5);
  opcW2Atlas.push(
    makeReliefBox(1.15, 1.55, 1.15, 'weatheredLimeStucco', cx - 20.5, lhvY + 0.78, 34.5),
    makeReliefBox(1.38, 0.28, 1.38, 'ngoiMuiHaiMossy', cx - 20.5, lhvY + 1.68, 34.5),
    makeReliefCyl(0.16, 0.24, 0.58, 5, 'monolithicStoneDrum', cx - 20.5, lhvY + 2.08, 34.5)
  );
  for (const side of [-1, 1]) {
    opcW2Atlas.push(makeReliefBox(0.52, 1.85, 2.2, 'agedIronwood', dhX + side * 6.0, dhFloorY + 0.92, dhZ + 0.8));
  }
  // 212-214. Hanging bronze Khánh gong beside Lầu Chuông, drum cradle under Lầu Trống, Lý Thái Tông 1049 stele
  opcW2Atlas.push(
    makeReliefBox(0.12, 1.85, 0.12, 'agedIronwood', -35.2, dhY + 0.92, 43.5),
    makeReliefBox(0.12, 1.85, 0.12, 'agedIronwood', -33.6, dhY + 0.92, 43.5),
    makeReliefBox(1.85, 0.14, 0.14, 'agedIronwood', -34.4, dhY + 1.86, 43.5),
    makeReliefBox(1.15, 0.52, 0.72, 'agedIronwood', -58.5, dhY + 0.62, 43.5)
  );
  opcW2Bronze.push(new THREE.BoxGeometry(0.92, 0.48, 0.08).translate(-34.4, dhY + 1.32, 43.5));
  opcW2Atlas.push(
    makeReliefBox(0.95, 0.28, 0.55, 'monolithicStoneDrum', cx + 19.2, ePlzY + 0.14, cz - 2.6),
    makeReliefBox(0.72, 1.35, 0.18, 'monolithicStoneDrum', cx + 19.2, ePlzY + 0.95, cz - 2.6)
  );
  // 215-217. Bamboo tea table outside Quán Trà Sen, hexagonal lotus bowls at stair foot, seated stone Nghê flanking Diên Hựu stairs
  const qtOutY = ctx.getHeight(teaX - 3.4, teaZ);
  opcW2Atlas.push(
    makeReliefBox(0.92, 0.52, 0.62, 'agedIronwood', teaX - 3.4, qtOutY + 0.26, teaZ),
    makeReliefBox(0.32, 0.32, 0.32, 'agedIronwood', teaX - 4.1, qtOutY + 0.16, teaZ),
    makeReliefBox(0.32, 0.32, 0.32, 'agedIronwood', teaX - 2.7, qtOutY + 0.16, teaZ)
  );
  for (const side of [-1, 1]) {
    opcW2Atlas.push(
      makeReliefCyl(0.32, 0.24, 0.36, 6, 'monolithicStoneDrum', stairStartX + 1.2, VIETNAM_WATER_LEVEL + 0.58, cz + side * 0.82),
      makeReliefBox(0.55, 0.42, 0.68, 'monolithicStoneDrum', dhX + side * 3.15, dhBaseY + 0.21, dhZ - hallD * 0.5 - 1.1),
      makeReliefBox(0.36, 0.56, 0.48, 'monolithicStoneDrum', dhX + side * 3.15, dhBaseY + 0.68, dhZ - hallD * 0.5 - 1.1)
    );
  }
  // 218-221. West timber gallery walkway (outside West basin wall!), 5-color Buddhist flagpoles at Tam Quan, outdoor Bàn Thờ Thiên & Bodhi meditation pads
  const wg2X = cx - 20.2;
  const wg2Y = ctx.getHeight(wg2X, 29.0);
  opcW2Atlas.push(
    makeReliefBox(2.2, 0.38, 9.5, 'batTrangFloor', wg2X, wg2Y + 0.02, 29.0),
    makeReliefBox(2.6, 0.24, 9.8, 'ngoiMuiHaiMossy', wg2X, wg2Y + 2.85, 29.0)
  );
  for (const pz of [24.8, 29.0, 33.2]) {
    opcW2Atlas.push(
      makeReliefBox(0.14, 2.75, 0.14, 'agedIronwood', wg2X - 0.9, wg2Y + 1.42, pz),
      makeReliefBox(0.14, 2.75, 0.14, 'agedIronwood', wg2X + 0.9, wg2Y + 1.42, pz)
    );
  }
  for (const side of [-1, 1]) {
    opcW2Atlas.push(makeReliefCyl(0.04, 0.05, 4.2, 5, 'agedIronwood', cx + 23.2, ePlzY + 2.1, cz + side * 5.2));
    opcW2Gold.push(new THREE.BoxGeometry(0.05, 1.35, 0.62).translate(cx + 23.2, ePlzY + 3.45, cz + side * 5.55));
  }
  opcW2Atlas.push(
    makeReliefBox(0.52, 1.05, 0.52, 'monolithicStoneDrum', -60.0, bdY + 0.52, 8.0),
    makeReliefBox(0.72, 0.14, 0.72, 'ngoiMuiHaiMossy', -60.0, bdY + 1.12, 8.0),
    makeReliefBox(1.85, 0.24, 1.25, 'monolithicStoneDrum', -63.0, bdY + 0.12, 12.2),
    makeReliefBox(1.85, 0.24, 1.25, 'monolithicStoneDrum', -59.5, bdY + 0.12, 10.8)
  );
  // 222-225. Diên Hựu eaves lanterns, granite rainwater runnels, directional signpost & gilded altar cranes
  for (const lx of [-3.4, -1.2, 1.2, 3.4]) {
    opcW2Atlas.push(makeReliefCyl(0.14, 0.14, 0.34, 6, 'tamBaoGoldLacquer', dhX + lx, dhFloorY + wallH - 0.55, dhZ - hallD * 0.5 + 0.12));
    opcW2Glow.push(new THREE.BoxGeometry(0.14, 0.20, 0.14).translate(dhX + lx, dhFloorY + wallH - 0.55, dhZ - hallD * 0.5 + 0.12));
  }
  for (const side of [-1, 1]) {
    opcW2Atlas.push(makeReliefBox(0.32, 0.08, hallD + 1.8, 'monolithicStoneDrum', dhX + side * (hallW * 0.5 + 0.95), dhBaseY + 0.06, dhZ));
    opcW2Gold.push(
      new THREE.CylinderGeometry(0.12, 0.16, 0.14, 5).translate(dhX + side * 1.55, dhFloorY + 0.08, dhZ + 1.2),
      new THREE.CylinderGeometry(0.03, 0.04, 1.15, 5).translate(dhX + side * 1.55, dhFloorY + 0.68, dhZ + 1.2),
      new THREE.ConeGeometry(0.10, 0.26, 5).translate(dhX + side * 1.55, dhFloorY + 1.32, dhZ + 1.2)
    );
  }
  const spY = ctx.getHeight(-44.5, 33.0);
  opcW2Atlas.push(
    makeReliefBox(0.12, 1.85, 0.12, 'agedIronwood', -44.5, spY + 0.92, 33.0),
    makeReliefBox(0.88, 0.26, 0.08, 'tamBaoGoldLacquer', -44.5, spY + 1.65, 33.0)
  );

  // --------------------------------------------------------------------------
  // 10B. CHÙA MỘT CỘT & DIÊN HỰU WAVE 3 REAL-WORLD DETAILS (Items 401..450)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // --------------------------------------------------------------------------
  const opcW3Atlas: THREE.BufferGeometry[] = [];
  const opcW3Gold: THREE.BufferGeometry[] = [];
  const opcW3Bronze: THREE.BufferGeometry[] = [];
  const opcW3Glow: THREE.BufferGeometry[] = [];

  // 401-403, 449. West Nhà Tổ ancestral shrine pavilion (-74.5, 30.5 — cleanly West of West timber gallery!), altar, censer & rainwater jars
  const ntX = -74.5;
  const ntZ = 30.5;
  const ntY = ctx.getHeight(ntX, ntZ);
  opcW3Atlas.push(makeReliefBox(4.8, 0.72, 4.0, 'monolithicStoneDrum', ntX, ntY + 0.14, ntZ));
  for (const dx of [-1.9, 1.9]) {
    for (const dz of [-1.5, 1.5]) {
      opcW3Atlas.push(makeReliefCyl(0.11, 0.13, 2.75, 6, 'agedIronwood', ntX + dx, ntY + 1.62, ntZ + dz));
    }
  }
  opcW3Atlas.push(
    makeReliefBox(4.4, 2.35, 0.24, 'weatheredLimeStucco', ntX - 1.95, ntY + 1.68, ntZ, Math.PI * 0.5),
    makeReliefBox(5.6, 0.36, 4.8, 'ngoiMuiHaiMossy', ntX, ntY + 3.08, ntZ),
    makeReliefBox(3.4, 0.42, 2.4, 'ngoiMuiHaiMossy', ntX, ntY + 3.44, ntZ),
    makeReliefBox(0.92, 0.88, 1.85, 'tamBaoGoldLacquer', ntX - 1.15, ntY + 0.94, ntZ),
    makeReliefCyl(0.24, 0.28, 0.56, 6, 'hoaChanhGreenTile', ntX + 2.35, ntY + 0.28, ntZ - 1.7),
    makeReliefCyl(0.24, 0.28, 0.56, 6, 'hoaChanhGreenTile', ntX + 2.35, ntY + 0.28, ntZ + 1.7)
  );
  opcW3Gold.push(new THREE.BoxGeometry(0.14, 0.65, 0.38).translate(ntX - 1.35, ntY + 1.70, ntZ));
  opcW3Bronze.push(
    new THREE.CylinderGeometry(0.14, 0.11, 0.28, 6).translate(ntX - 0.95, ntY + 1.52, ntZ),
    new THREE.CylinderGeometry(0.04, 0.08, 0.36, 5).translate(ntX - 0.95, ntY + 1.56, ntZ - 0.58),
    new THREE.CylinderGeometry(0.04, 0.08, 0.36, 5).translate(ntX - 0.95, ntY + 1.56, ntZ + 0.58)
  );

  // 404-405, 412. East covered timber walkway Hành Lang Đông (-27.8, 30.0), veranda bench & monastic reception sập
  const hldX = -27.8;
  const hldZ = 30.0;
  const hldY = ctx.getHeight(hldX, hldZ);
  opcW3Atlas.push(
    makeReliefBox(2.4, 0.42, 7.6, 'batTrangFloor', hldX, hldY + 0.06, hldZ),
    makeReliefBox(2.8, 0.28, 8.0, 'ngoiMuiHaiMossy', hldX, hldY + 2.86, hldZ),
    makeReliefBox(0.42, 0.42, 5.2, 'agedIronwood', hldX + 0.72, hldY + 0.48, hldZ),
    makeReliefBox(1.35, 0.44, 1.85, 'agedIronwood', hldX - 0.15, hldY + 0.49, hldZ)
  );
  for (const pz of [-3.2, 0, 3.2]) {
    opcW3Atlas.push(
      makeReliefBox(0.13, 2.85, 0.13, 'agedIronwood', hldX - 0.95, hldY + 1.44, hldZ + pz),
      makeReliefBox(0.13, 2.85, 0.13, 'agedIronwood', hldX + 0.95, hldY + 1.44, hldZ + pz)
    );
  }

  // 406-407, 440-441. South Diên Hựu garden gate (-48, 50.8), hoa chanh boundary wall, stone footbridge & podocarpus urns
  const sgY = ctx.getHeight(dhX, 50.8);
  opcW3Atlas.push(
    makeReliefBox(0.55, 2.95, 0.55, 'weatheredLimeStucco', dhX - 1.65, sgY + 1.32, 50.8),
    makeReliefBox(0.55, 2.95, 0.55, 'weatheredLimeStucco', dhX + 1.65, sgY + 1.32, 50.8),
    makeReliefBox(4.0, 0.42, 0.68, 'weatheredLimeStucco', dhX, sgY + 2.82, 50.8),
    makeReliefBox(4.4, 0.34, 1.35, 'ngoiMuiHaiMossy', dhX, sgY + 3.16, 50.8),
    makeReliefBox(2.2, 0.20, 1.15, 'monolithicStoneDrum', dhX, ctx.getHeight(dhX, 49.0) + 0.12, 49.0)
  );
  for (const side of [-1, 1]) {
    opcW3Atlas.push(
      makeReliefBox(6.8, 1.15, 0.26, 'hoaChanhGreenTile', dhX + side * 5.6, sgY + 0.58, 50.8),
      makeReliefBox(7.0, 0.18, 0.42, 'ngoiMuiHaiMossy', dhX + side * 5.6, sgY + 1.24, 50.8),
      makeReliefCyl(0.34, 0.24, 0.44, 6, 'monolithicStoneDrum', dhX + side * 2.55, sgY + 0.22, 49.6),
      makeReliefCyl(0.28, 0.18, 0.58, 5, 'lushIsletGrass', dhX + side * 2.55, sgY + 0.72, 49.6)
    );
  }

  // 408-409. Diên Hựu ancient octagonal well (-36.5, 48.2) + 4-post tiled canopy
  const dwX = -36.5;
  const dwZ = 48.2;
  const dwY = ctx.getHeight(dwX, dwZ);
  opcW3Atlas.push(
    makeReliefCyl(0.95, 1.05, 0.68, 6, 'monolithicStoneDrum', dwX, dwY + 0.34, dwZ),
    makeReliefCyl(0.06, 0.06, 1.95, 5, 'agedIronwood', dwX, dwY + 1.55, dwZ, 0, 0, Math.PI * 0.5),
    makeReliefBox(2.9, 0.34, 2.9, 'ngoiMuiHaiMossy', dwX, dwY + 2.56, dwZ)
  );
  for (const dx of [-1.15, 1.15]) {
    for (const dz of [-1.15, 1.15]) {
      opcW3Atlas.push(makeReliefBox(0.12, 2.65, 0.12, 'agedIronwood', dwX + dx, dwY + 1.18, dwZ + dz));
    }
  }

  // 410-411, 413-415, 419-420, 429, 444, 447, 450. East Tam Quan courtyard details (ablution basin, lanterns, steps, 1955 stele, racks, bollards, etiquette board)
  const abY = ctx.getHeight(-28.5, 16.5);
  opcW3Atlas.push(
    makeReliefCyl(0.48, 0.34, 0.72, 6, 'monolithicStoneDrum', -28.5, abY + 0.36, 16.5),
    makeReliefBox(0.12, 1.85, 0.12, 'agedIronwood', -60.8, dhY + 0.85, 42.6),
    makeReliefBox(0.12, 1.85, 0.12, 'agedIronwood', -60.8, dhY + 0.85, 44.4),
    makeReliefBox(0.14, 0.14, 1.95, 'agedIronwood', -60.8, dhY + 1.78, 43.5),
    makeReliefBox(0.12, 0.52, 0.95, 'monolithicStoneDrum', -60.8, dhY + 1.25, 43.5),
    // 414. Tam Quan East 3-step apron
    makeReliefBox(0.95, 0.22, 3.6, 'monolithicStoneDrum', -24.8, ePlzY + 0.08, cz),
    // 415. 1955 reconstruction stele + hood
    makeReliefBox(0.92, 0.28, 0.56, 'monolithicStoneDrum', -28.5, ctx.getHeight(-28.5, 27.5) + 0.14, 27.5),
    makeReliefBox(0.72, 1.38, 0.18, 'monolithicStoneDrum', -28.5, ctx.getHeight(-28.5, 27.5) + 0.96, 27.5),
    makeReliefBox(1.18, 0.22, 0.72, 'ngoiMuiHaiMossy', -28.5, ctx.getHeight(-28.5, 27.5) + 1.74, 27.5),
    // 419-420. Dharma booklet rack & incense offering table
    makeReliefBox(0.75, 1.15, 0.42, 'agedIronwood', -28.8, ePlzY + 0.58, 18.8),
    makeReliefBox(1.25, 0.72, 0.62, 'agedIronwood', -29.2, ePlzY + 0.36, 25.2),
    // 447, 450. Architectural diagram lectern & etiquette signboard
    makeReliefBox(0.95, 0.88, 0.52, 'agedIronwood', -28.5, ePlzY + 0.44, 20.5),
    makeReliefBox(0.10, 1.55, 0.82, 'tamBaoGoldLacquer', -25.2, ePlzY + 0.78, 19.6)
  );
  for (const side of [-1, 1]) {
    const lqY = ctx.getHeight(-24.2, cz + side * 3.2);
    opcW3Atlas.push(
      makeReliefBox(0.46, 1.15, 0.46, 'monolithicStoneDrum', -24.2, lqY + 0.58, cz + side * 3.2),
      makeReliefBox(0.62, 0.18, 0.62, 'ngoiMuiHaiMossy', -24.2, lqY + 1.52, cz + side * 3.2),
      // 444. Stone flagpole sockets
      makeReliefCyl(0.24, 0.30, 0.34, 6, 'monolithicStoneDrum', cx + 23.2, ePlzY + 0.17, cz + side * 5.2)
    );
    opcW3Glow.push(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(-24.2, lqY + 1.28, cz + side * 3.2));
  }
  for (const bz of [15.5, 19.5, 24.5, 28.5]) {
    opcW3Atlas.push(makeReliefCyl(0.14, 0.18, 0.78, 5, 'monolithicStoneDrum', -24.0, ctx.getHeight(-24.0, bz) + 0.39, bz));
  }

  // 416-418, 421-424, 437-438, 442, 445. Diên Hựu sanctuary & veranda refinements (outdoor urn, fruit trays, streamers, đấu củng, chấn song, doors, lotus bowls, butter-lamp rack, shoe rack)
  opcW3Atlas.push(
    makeReliefCyl(0.55, 0.42, 0.92, 6, 'monolithicStoneDrum', dhX, dhY + 0.46, 36.8),
    makeReliefBox(1.35, 0.58, 0.42, 'agedIronwood', dhX + 4.8, dhFloorY + 0.29, dhZ - hallD * 0.5 - 0.15),
    makeReliefBox(1.45, 0.62, 0.42, 'agedIronwood', dhX, dhFloorY + 0.31, dhZ - 2.65),
    // 438. Stepped granite plinth reinforcing Lầu Trống
    makeReliefBox(3.8, 0.24, 3.8, 'monolithicStoneDrum', -58.5, dhY + 0.08, 43.5)
  );
  for (let b = -2; b <= 2; b++) {
    opcW3Glow.push(new THREE.BoxGeometry(0.08, 0.08, 0.08).translate(dhX + b * 0.24, dhFloorY + 0.68, dhZ - 2.65));
  }
  for (const bx of [-4.2, -1.9, 1.9, 4.2]) {
    // 421. Stepped timber đấu củng eave brackets under front fascia beam
    opcW3Atlas.push(makeReliefBox(0.32, 0.28, 0.52, 'tamBaoGoldLacquer', dhX + bx, dhFloorY + wallH - 0.34, dhZ - hallD * 0.5 + 0.05));
  }
  for (const side of [-1, 1]) {
    // 417-418. Gilded fruit trays & hanging prayer streamers
    opcW3Gold.push(
      new THREE.CylinderGeometry(0.24, 0.14, 0.18, 6).translate(dhX + side * 1.15, dhFloorY + 1.18, dhZ + 0.65),
      new THREE.BoxGeometry(0.26, 1.65, 0.06).translate(dhX + side * 2.85, dhFloorY + wallH - 1.35, dhZ - 1.2)
    );
    // 422-423. Side-wall chấn song window mullions & open front panel doors
    opcW3Atlas.push(
      makeReliefBox(0.16, 1.15, 1.35, 'agedIronwood', dhX + side * (hallW * 0.5 + 0.04), dhFloorY + 2.15, dhZ),
      makeReliefBox(0.14, 2.65, 0.95, 'agedIronwood', dhX + side * 4.55, dhFloorY + 1.32, dhZ - hallD * 0.5 + 0.72)
    );
    // 424. 4 lotus bowls lining Diên Hựu walkway
    for (const wz of [33.0, 36.2]) {
      opcW3Atlas.push(
        makeReliefBox(0.55, 0.36, 0.55, 'monolithicStoneDrum', dhX + side * 3.2, dhY + 0.18, wz),
        makeReliefCyl(0.24, 0.18, 0.32, 6, 'hoaChanhGreenTile', dhX + side * 3.2, dhY + 0.52, wz)
      );
    }
    // 437. Miniature bronze crane stands flanking Lầu Chuông
    opcW3Bronze.push(
      new THREE.CylinderGeometry(0.05, 0.12, 0.85, 5).translate(-37.5 + side * 1.15, dhY + 0.42, 41.2)
    );
    // 430, 439. Granite benches under Cây Đại & Buddhist-parable display boards
    const bcdY = ctx.getHeight(cx + side * 12.2, 39.2);
    opcW3Atlas.push(
      makeReliefBox(1.65, 0.42, 0.48, 'monolithicStoneDrum', cx + side * 12.2, bcdY + 0.21, 39.2),
      makeReliefBox(1.45, 1.25, 0.12, 'agedIronwood', dhX + side * 6.5, dhY + 0.82, 48.2)
    );
  }

  // 425-428, 436, 443, 446, 448. West & SW garden: 2 Tháp Tổ stupas (with deep stone plinth skirts!), epitaphs, Bodhi sutra table, raised lotus bed, 3 stone Arhats, West gate lions, garden bollards & Bodhi railing
  for (const tz of [44.0, 47.2]) {
    const ty = ctx.getHeight(-65.5, tz);
    opcW3Atlas.push(
      makeReliefBox(1.55, 0.92, 1.55, 'monolithicStoneDrum', -65.5, ty + 0.02, tz),
      makeReliefBox(1.15, 1.15, 1.15, 'weatheredLimeStucco', -65.5, ty + 1.05, tz),
      makeReliefBox(1.38, 0.22, 1.38, 'ngoiMuiHaiMossy', -65.5, ty + 1.72, tz),
      makeReliefBox(0.82, 0.88, 0.82, 'weatheredLimeStucco', -65.5, ty + 2.26, tz),
      makeReliefBox(1.02, 0.20, 1.02, 'ngoiMuiHaiMossy', -65.5, ty + 2.80, tz),
      makeReliefCyl(0.06, 0.22, 0.45, 5, 'monolithicStoneDrum', -65.5, ty + 3.12, tz),
      makeReliefBox(0.16, 0.72, 0.42, 'monolithicStoneDrum', -64.4, ty + 0.36, tz)
    );
  }
  const stBdY = ctx.getHeight(-61.2, 13.8);
  opcW3Atlas.push(
    makeReliefCyl(0.58, 0.36, 0.65, 6, 'monolithicStoneDrum', -61.2, stBdY + 0.32, 13.8),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', -60.2, stBdY + 0.19, 13.8),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', -62.2, stBdY + 0.19, 13.8),
    makeReliefBox(1.35, 0.38, 3.8, 'batTrangFloor', -66.8, ctx.getHeight(-66.8, 22.0) + 0.19, 22.0),
    makeReliefBox(1.10, 0.18, 3.5, 'lushIsletGrass', -66.8, ctx.getHeight(-66.8, 22.0) + 0.42, 22.0),
    // 448. Protective Bodhi railing on East flank
    makeReliefBox(0.10, 0.72, 3.8, 'agedIronwood', -59.5, bdY + 0.36, 8.0)
  );
  for (const az of [16.0, 20.0, 24.0]) {
    const ay = ctx.getHeight(-67.5, az);
    opcW3Atlas.push(
      makeReliefBox(0.62, 0.42, 0.62, 'monolithicStoneDrum', -67.5, ay + 0.21, az),
      makeReliefCyl(0.18, 0.24, 0.92, 6, 'monolithicStoneDrum', -67.5, ay + 0.88, az)
    );
  }
  for (const side of [-1, 1]) {
    opcW3Atlas.push(
      makeReliefBox(0.48, 0.38, 0.56, 'monolithicStoneDrum', -63.0 + side * 1.85, wgY + 0.19, 17.6),
      makeReliefBox(0.34, 0.48, 0.40, 'monolithicStoneDrum', -63.0 + side * 1.85, wgY + 0.62, 17.6)
    );
  }
  for (const lz of [11.5, 15.2, 19.0]) {
    const ly = ctx.getHeight(-66.2, lz);
    opcW3Atlas.push(makeReliefCyl(0.12, 0.16, 0.85, 5, 'hoaChanhGreenTile', -66.2, ly + 0.42, lz));
    opcW3Glow.push(new THREE.BoxGeometry(0.14, 0.16, 0.14).translate(-66.2, ly + 0.92, lz));
  }

  // 431-435. Quán Trà Sen souvenir kiosk (-26, 41.2), tea-brewing counter, eaves lanterns (on grounded hooks!), brick Bình Phong & East drainage runnel
  const qtsKioskY = ctx.getHeight(-26.0, 41.2);
  opcW3Atlas.push(
    makeReliefBox(2.6, 2.25, 2.2, 'agedIronwood', -26.0, qtsKioskY + 1.12, 41.2),
    makeReliefBox(3.1, 0.34, 2.7, 'ngoiMuiHaiMossy', -26.0, qtsKioskY + 2.40, 41.2),
    makeReliefBox(1.85, 0.85, 0.55, 'agedIronwood', teaX + 1.65, teaY + 0.70, teaZ),
    makeReliefBox(2.4, 1.55, 0.34, 'weatheredLimeStucco', teaX - 3.6, teaY + 0.78, teaZ + 2.8),
    makeReliefBox(2.65, 0.22, 0.52, 'ngoiMuiHaiMossy', teaX - 3.6, teaY + 1.66, teaZ + 2.8),
    makeReliefBox(0.32, 0.08, 12.0, 'monolithicStoneDrum', -26.5, ePlzY + 0.05, cz)
  );
  opcW3Bronze.push(new THREE.CylinderGeometry(0.12, 0.15, 0.24, 6).translate(teaX + 1.65, teaY + 1.24, teaZ));
  for (const lx of [-1.8, 1.8]) {
    for (const lz of [-1.4, 1.4]) {
      opcW3Atlas.push(makeReliefCyl(0.03, 0.03, 0.32, 5, 'agedIronwood', teaX + lx, teaY + 2.66, teaZ + lz));
      opcW3Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(teaX + lx, teaY + 2.45, teaZ + lz));
    }
  }

  const opcW3AtlasMesh = createMergedMesh('OnePillarWave3AtlasMesh', opcW3Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW3AtlasMesh) group.add(opcW3AtlasMesh);
  const opcW3GoldMesh = createMergedMesh('OnePillarWave3GoldMesh', opcW3Gold, ctx.materials.gold, false, false);
  if (opcW3GoldMesh) group.add(opcW3GoldMesh);
  const opcW3BronzeMesh = createMergedMesh('OnePillarWave3BronzeMesh', opcW3Bronze, ctx.materials.bronze, false, true);
  if (opcW3BronzeMesh) group.add(opcW3BronzeMesh);
  const opcW3GlowMesh = createMergedMesh('OnePillarWave3GlowMesh', opcW3Glow, glowMat, false, false);
  if (opcW3GlowMesh) group.add(opcW3GlowMesh);

  const opcW2AtlasMesh = createMergedMesh('OnePillarWave2AtlasMesh', opcW2Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW2AtlasMesh) group.add(opcW2AtlasMesh);
  const opcW2GoldMesh = createMergedMesh('OnePillarWave2GoldMesh', opcW2Gold, ctx.materials.gold, false, false);
  if (opcW2GoldMesh) group.add(opcW2GoldMesh);
  const opcW2BronzeMesh = createMergedMesh('OnePillarWave2BronzeMesh', opcW2Bronze, ctx.materials.bronze, false, true);
  if (opcW2BronzeMesh) group.add(opcW2BronzeMesh);
  const opcW2GlowMesh = createMergedMesh('OnePillarWave2GlowMesh', opcW2Glow, glowMat, false, false);
  if (opcW2GlowMesh) group.add(opcW2GlowMesh);

  // --------------------------------------------------------------------------
  // 10C. CHÙA MỘT CỘT & DIÊN HỰU WAVE 4 OUTER MONASTIC QUARTER (Items 801..850)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // --------------------------------------------------------------------------
  const opcW4Atlas: THREE.BufferGeometry[] = [];
  const opcW4Gold: THREE.BufferGeometry[] = [];
  const opcW4Bronze: THREE.BufferGeometry[] = [];
  const opcW4Glow: THREE.BufferGeometry[] = [];

  // 801-804, 825-826, 839, 842. Tàng Kinh Các Sutra Library (-74.5, 38.5), shelves, lectern, lanterns, steps, slab & censer
  const tkcX = -74.5;
  const tkcZ = 38.5;
  const tkcY = Math.max(ctx.getHeight(tkcX, tkcZ), ctx.getHeight(tkcX - 2.4, tkcZ - 2.0), ctx.getHeight(tkcX + 2.4, tkcZ + 2.0));
  opcW4Atlas.push(
    makeReliefBox(5.2, 2.2, 4.4, 'monolithicStoneDrum', tkcX, tkcY - 0.72, tkcZ),
    makeReliefBox(4.4, 2.55, 0.24, 'weatheredLimeStucco', tkcX - 2.15, tkcY + 1.66, tkcZ, Math.PI * 0.5),
    makeReliefBox(5.8, 0.36, 5.0, 'ngoiMuiHaiMossy', tkcX, tkcY + 3.04, tkcZ),
    makeReliefBox(3.6, 0.42, 2.8, 'ngoiMuiHaiMossy', tkcX, tkcY + 3.42, tkcZ),
    makeReliefBox(0.55, 1.95, 2.6, 'agedIronwood', tkcX - 1.45, tkcY + 1.36, tkcZ),
    makeReliefBox(0.85, 0.88, 0.55, 'agedIronwood', tkcX + 0.35, tkcY + 0.82, tkcZ),
    makeReliefBox(1.15, 0.28, 2.4, 'monolithicStoneDrum', tkcX + 3.05, tkcY + 0.14, tkcZ),
    makeReliefBox(1.85, 0.18, 1.15, 'monolithicStoneDrum', -71.2, ctx.getHeight(-71.2, 38.5) + 0.10, 38.5)
  );
  for (const dx of [-2.05, 2.05]) {
    for (const dz of [-1.65, 1.65]) {
      opcW4Atlas.push(makeReliefCyl(0.11, 0.13, 2.80, 6, 'agedIronwood', tkcX + dx, tkcY + 1.62, tkcZ + dz));
    }
  }
  for (const dz of [-1.4, 1.4]) {
    opcW4Atlas.push(
      makeReliefBox(0.42, 1.05, 0.42, 'monolithicStoneDrum', tkcX + 3.4, tkcY + 0.52, tkcZ + dz),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', tkcX + 3.4, tkcY + 1.12, tkcZ + dz),
      makeReliefCyl(0.03, 0.03, 0.32, 5, 'agedIronwood', tkcX + 2.1, tkcY + 2.72, tkcZ + dz)
    );
    opcW4Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(tkcX + 2.1, tkcY + 2.52, tkcZ + dz));
  }
  opcW4Gold.push(new THREE.BoxGeometry(0.45, 0.08, 0.32).translate(tkcX + 0.35, tkcY + 1.30, tkcZ));
  opcW4Bronze.push(new THREE.CylinderGeometry(0.18, 0.14, 0.36, 6).translate(tkcX + 3.85, tkcY + 0.36, tkcZ));

  // 805-808, 818, 822, 827, 833, 836-837, 841, 844, 847. Nhà Trai Đường South Vegetarian Hall (-48.0, 56.5) & South Garden Expansion
  const tdX = -48.0;
  const tdZ = 56.5;
  const tdY = Math.max(ctx.getHeight(tdX, tdZ), ctx.getHeight(tdX - 3.6, tdZ - 2.2), ctx.getHeight(tdX + 3.6, tdZ + 2.2));
  opcW4Atlas.push(
    makeReliefBox(7.8, 2.2, 4.8, 'monolithicStoneDrum', tdX, tdY - 0.72, tdZ),
    makeReliefBox(7.2, 2.55, 0.24, 'weatheredLimeStucco', tdX, tdY + 1.66, tdZ + 2.05),
    makeReliefBox(8.6, 0.38, 5.6, 'ngoiMuiHaiMossy', tdX, tdY + 3.04, tdZ),
    makeReliefBox(5.4, 0.42, 3.0, 'ngoiMuiHaiMossy', tdX, tdY + 3.44, tdZ),
    makeReliefBox(2.2, 0.78, 0.85, 'agedIronwood', tdX - 1.6, tdY + 0.76, tdZ - 0.2),
    makeReliefBox(2.2, 0.78, 0.85, 'agedIronwood', tdX + 1.6, tdY + 0.76, tdZ - 0.2),
    makeReliefBox(2.0, 0.42, 0.36, 'agedIronwood', tdX - 1.6, tdY + 0.58, tdZ - 1.0),
    makeReliefBox(2.0, 0.42, 0.36, 'agedIronwood', tdX + 1.6, tdY + 0.58, tdZ - 1.0),
    makeReliefBox(2.4, 1.65, 0.45, 'agedIronwood', tdX, tdY + 1.20, tdZ + 1.65),
    // 808, 818, 822, 833, 844, 847. Bình Phong, cistern, herb beds, votive burner, drainage runnel & donation stand
    makeReliefBox(2.8, 1.55, 0.36, 'monolithicStoneDrum', tdX, tdY + 0.78, tdZ - 3.6),
    makeReliefBox(3.0, 0.22, 0.55, 'ngoiMuiHaiMossy', tdX, tdY + 1.64, tdZ - 3.6),
    makeReliefBox(2.2, 1.25, 1.85, 'weatheredLimeStucco', -55.5, ctx.getHeight(-55.5, 56.5) + 0.62, 56.5),
    makeReliefBox(2.4, 0.38, 1.65, 'batTrangFloor', -41.5, ctx.getHeight(-41.5, 55.2) + 0.19, 55.2),
    makeReliefBox(2.4, 0.38, 1.65, 'batTrangFloor', -41.5, ctx.getHeight(-41.5, 57.8) + 0.19, 57.8),
    makeReliefBox(1.05, 1.45, 1.05, 'weatheredLimeStucco', -38.5, ctx.getHeight(-38.5, 56.5) + 0.72, 56.5),
    makeReliefBox(1.28, 0.24, 1.28, 'ngoiMuiHaiMossy', -38.5, ctx.getHeight(-38.5, 56.5) + 1.54, 56.5),
    makeReliefBox(14.0, 0.08, 0.36, 'monolithicStoneDrum', tdX, ctx.getHeight(tdX, 53.2) + 0.04, 53.2),
    makeReliefBox(1.05, 0.82, 0.55, 'agedIronwood', tdX + 3.2, sgY + 0.41, 52.2)
  );
  for (const dx of [-3.3, -1.1, 1.1, 3.3]) {
    for (const dz of [-1.95, 1.95]) {
      opcW4Atlas.push(makeReliefCyl(0.11, 0.13, 2.80, 6, 'agedIronwood', tdX + dx, tdY + 1.62, tdZ + dz));
    }
  }
  for (const lx of [-2.2, 0, 2.2]) {
    opcW4Atlas.push(makeReliefCyl(0.03, 0.03, 0.30, 5, 'agedIronwood', tdX + lx, tdY + 2.72, tdZ - 2.0));
    opcW4Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(tdX + lx, tdY + 2.52, tdZ - 2.0));
  }
  // 827, 829, 836, 841. South garden tea table, bollards, guardian pedestals & flagpoles
  const sTeaY = ctx.getHeight(-56.0, 52.5);
  opcW4Atlas.push(
    makeReliefCyl(0.55, 0.34, 0.65, 6, 'monolithicStoneDrum', -56.0, sTeaY + 0.32, 52.5),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', -57.0, sTeaY + 0.19, 52.5),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', -55.0, sTeaY + 0.19, 52.5)
  );
  for (const bx of [-58.0, -51.5, -44.5, -38.0]) {
    opcW4Atlas.push(makeReliefCyl(0.14, 0.18, 0.72, 6, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 59.5) + 0.36, 59.5));
  }
  for (const side of [-1, 1]) {
    opcW4Atlas.push(
      makeReliefBox(0.58, 0.62, 0.58, 'monolithicStoneDrum', tdX + side * 2.4, sgY + 0.31, 52.2),
      makeReliefCyl(0.04, 0.05, 3.6, 5, 'agedIronwood', tdX + side * 6.5, sgY + 1.72, 52.5)
    );
    opcW4Gold.push(new THREE.BoxGeometry(0.05, 1.15, 0.52).translate(tdX + side * 6.5, sgY + 2.95, 52.85));
  }

  // 809-813, 819-821, 823-824, 834-835, 840, 843, 845, 849-850. East Outer Pilgrim Rest Courtyard (-20.5, 22.0) & Quán Trà Sen East Props
  const epY = ctx.getHeight(-20.5, cz);
  opcW4Atlas.push(
    makeReliefBox(5.2, 0.16, 12.0, 'batTrangFloor', -20.5, epY + 0.08, cz),
    makeReliefCyl(0.95, 0.72, 0.65, 6, 'monolithicStoneDrum', -20.5, epY + 0.40, cz),
    makeReliefCyl(0.36, 0.28, 0.68, 6, 'monolithicStoneDrum', -22.2, epY + 0.42, cz),
    // 819-821, 823-824, 834-835, 840, 843, 845, 850. Tam Quan lintel, Lầu Chuông striker, lotus-seed trays, jars, signpost, vendor table, hat rack, archive showcase, flowerbed & bench
    makeReliefBox(0.18, 0.26, 2.4, 'tamBaoGoldLacquer', tqX + 0.45, ePlzY + 3.25, cz),
    makeReliefBox(0.12, 1.65, 0.12, 'agedIronwood', -35.8, dhY + 0.82, 44.6),
    makeReliefBox(0.12, 1.65, 0.12, 'agedIronwood', -35.8, dhY + 0.82, 45.8),
    makeReliefCyl(0.24, 0.28, 0.56, 6, 'hoaChanhGreenTile', teaX + 2.6, teaY + 0.28, teaZ - 1.6),
    makeReliefCyl(0.24, 0.28, 0.56, 6, 'hoaChanhGreenTile', teaX + 2.6, teaY + 0.28, teaZ + 1.6),
    makeReliefBox(0.12, 2.05, 0.12, 'agedIronwood', -22.5, epY + 1.02, 26.5),
    makeReliefBox(0.88, 0.24, 0.08, 'tamBaoGoldLacquer', -22.1, epY + 1.85, 26.5),
    makeReliefBox(1.25, 0.68, 0.62, 'agedIronwood', -22.5, epY + 0.34, 18.2),
    makeReliefBox(0.14, 1.55, 1.35, 'agedIronwood', hldX + 1.45, hldY + 0.78, hldZ),
    makeReliefBox(1.45, 1.55, 0.48, 'agedIronwood', -21.0, ctx.getHeight(-21.0, 15.5) + 0.78, 15.5),
    makeReliefBox(2.6, 0.36, 1.35, 'batTrangFloor', -19.5, ctx.getHeight(-19.5, 29.5) + 0.18, 29.5),
    makeReliefBox(1.85, 0.44, 0.52, 'agedIronwood', pergX, pergY + 0.22, teaZ),
    makeReliefBox(0.88, 1.45, 0.22, 'monolithicStoneDrum', -28.5, ctx.getHeight(-28.5, 5.5) + 0.72, 5.5)
  );
  opcW4Bronze.push(
    new THREE.CylinderGeometry(0.06, 0.06, 1.25, 5).rotateX(Math.PI * 0.5).translate(-35.8, dhY + 1.35, 45.2),
    new THREE.CylinderGeometry(0.03, 0.03, 0.42, 5).translate(teaX + 2.1, teaY + 2.45, teaZ)
  );
  for (const lz of [16.5, 19.5, 24.5, 27.5]) {
    const ly = ctx.getHeight(-18.5, lz);
    opcW4Atlas.push(
      makeReliefBox(0.42, 1.08, 0.42, 'monolithicStoneDrum', -18.5, ly + 0.54, lz),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', -18.5, ly + 1.16, lz),
      makeReliefBox(0.52, 0.42, 1.65, 'monolithicStoneDrum', -20.5, epY + 0.21, lz)
    );
  }
  for (let tr = 0; tr < 3; tr++) {
    const trY = ctx.getHeight(-21.5 + tr * 1.05, 39.2);
    opcW4Atlas.push(makeReliefCyl(0.38, 0.36, 0.10, 6, 'agedIronwood', -21.5 + tr * 1.05, trY + 0.42, 39.2));
  }

  // 814-817, 828, 830-832, 838, 846, 848. Prayer-Wheel Gallery (-74.5, 24.0), West stelae, Bodhi alcove, bonsai terrace, hoa chanh wall & North basin walk
  const pwY = ctx.getHeight(-74.5, 24.0);
  opcW4Atlas.push(
    makeReliefBox(1.45, 0.24, 5.2, 'monolithicStoneDrum', -74.5, pwY + 0.12, 24.0),
    makeReliefBox(1.85, 0.28, 5.6, 'ngoiMuiHaiMossy', -74.5, pwY + 2.38, 24.0),
    makeReliefBox(0.12, 2.45, 0.12, 'agedIronwood', -74.5, pwY + 1.15, 21.8),
    makeReliefBox(0.12, 2.45, 0.12, 'agedIronwood', -74.5, pwY + 1.15, 26.2),
    // 816-817, 828, 838. Bodhi meditation alcove, bonsai terrace, West hoa chanh wall & 1954 North stele
    makeReliefBox(1.65, 0.42, 0.58, 'monolithicStoneDrum', -63.0, ctx.getHeight(-63.0, 2.5) + 0.21, 2.5),
    makeReliefBox(2.2, 0.24, 1.35, 'ngoiMuiHaiMossy', -63.0, ctx.getHeight(-63.0, 2.5) + 2.25, 2.5),
    makeReliefBox(0.12, 2.25, 0.12, 'agedIronwood', -63.8, ctx.getHeight(-63.0, 2.5) + 1.08, 2.5),
    makeReliefBox(0.12, 2.25, 0.12, 'agedIronwood', -62.2, ctx.getHeight(-63.0, 2.5) + 1.08, 2.5),
    makeReliefBox(1.45, 0.42, 3.6, 'monolithicStoneDrum', -71.5, ctx.getHeight(-71.5, 34.5) + 0.21, 34.5),
    makeReliefBox(0.28, 1.15, 14.0, 'hoaChanhGreenTile', -77.8, ctx.getHeight(-77.8, 35.0) + 0.58, 35.0),
    makeReliefBox(0.44, 0.18, 14.2, 'ngoiMuiHaiMossy', -77.8, ctx.getHeight(-77.8, 35.0) + 1.24, 35.0),
    makeReliefBox(0.92, 1.48, 0.22, 'monolithicStoneDrum', -36.0, ctx.getHeight(-36.0, 3.5) + 0.74, 3.5)
  );
  for (let pwi = 0; pwi < 6; pwi++) {
    opcW4Gold.push(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 6).translate(-74.5, pwY + 1.15, 22.2 + pwi * 0.72));
  }
  for (const sz of [15.5, 17.5, 19.5]) {
    const sy = ctx.getHeight(-73.0, sz);
    opcW4Atlas.push(makeReliefBox(0.22, 1.25, 0.72, 'monolithicStoneDrum', -73.0, sy + 0.62, sz));
  }
  for (const lz of [25.0, 29.0, 33.0]) {
    const ly = ctx.getHeight(-71.5, lz);
    opcW4Atlas.push(makeReliefCyl(0.12, 0.16, 0.82, 5, 'hoaChanhGreenTile', -71.5, ly + 0.41, lz));
    opcW4Glow.push(new THREE.BoxGeometry(0.14, 0.16, 0.14).translate(-71.5, ly + 0.88, lz));
  }
  for (const side of [-1, 1]) {
    const nbY = ctx.getHeight(cx + side * 8.0, 3.2);
    opcW4Atlas.push(
      makeReliefBox(0.58, 0.38, 0.58, 'monolithicStoneDrum', cx + side * 8.0, nbY + 0.19, 3.2),
      makeReliefCyl(0.24, 0.18, 0.34, 6, 'hoaChanhGreenTile', cx + side * 8.0, nbY + 0.54, 3.2),
      makeReliefBox(1.65, 0.42, 0.48, 'monolithicStoneDrum', cx + side * 4.0, ctx.getHeight(cx + side * 4.0, 3.2) + 0.21, 3.2),
      makeReliefBox(0.42, 1.05, 0.42, 'monolithicStoneDrum', cx + side * 14.5, ctx.getHeight(cx + side * 14.5, 3.5) + 0.52, 3.5),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', cx + side * 14.5, ctx.getHeight(cx + side * 14.5, 3.5) + 1.12, 3.5),
      makeReliefCyl(0.32, 0.24, 0.46, 6, 'hoaChanhGreenTile', cx + side * 16.5, ctx.getHeight(cx + side * 16.5, 3.5) + 0.23, 3.5)
    );
  }

  const opcW4AtlasMesh = createMergedMesh('OnePillarWave4AtlasMesh', opcW4Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW4AtlasMesh) group.add(opcW4AtlasMesh);
  const opcW4GoldMesh = createMergedMesh('OnePillarWave4GoldMesh', opcW4Gold, ctx.materials.gold, false, false);
  if (opcW4GoldMesh) group.add(opcW4GoldMesh);
  const opcW4BronzeMesh = createMergedMesh('OnePillarWave4BronzeMesh', opcW4Bronze, ctx.materials.bronze, false, true);
  if (opcW4BronzeMesh) group.add(opcW4BronzeMesh);
  const opcW4GlowMesh = createMergedMesh('OnePillarWave4GlowMesh', opcW4Glow, glowMat, false, false);
  if (opcW4GlowMesh) group.add(opcW4GlowMesh);

  // --------------------------------------------------------------------------
  // 10D. CHÙA MỘT CỘT & DIÊN HỰU WAVE 5 OUTER HERITAGE PRECINCTS (Items 1201..1250)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // --------------------------------------------------------------------------
  const opcW5Atlas: THREE.BufferGeometry[] = [];
  const opcW5Gold: THREE.BufferGeometry[] = [];
  const opcW5Bronze: THREE.BufferGeometry[] = [];
  const opcW5Glow: THREE.BufferGeometry[] = [];

  // 1201-1210, 1241, 1243, 1245-1248. North Lotus-Viewing Pavilion (-48.0, -3.5) & North Promenade
  const nlX = -48.0;
  const nlZ = -3.5;
  const nlY = Math.max(ctx.getHeight(nlX, nlZ), ctx.getHeight(nlX - 2.2, nlZ - 2.2), ctx.getHeight(nlX + 2.2, nlZ + 2.2));
  opcW5Atlas.push(
    makeReliefBox(4.8, 2.2, 4.8, 'monolithicStoneDrum', nlX, nlY - 0.72, nlZ),
    makeReliefBox(5.6, 0.36, 5.6, 'ngoiMuiHaiMossy', nlX, nlY + 3.04, nlZ),
    makeReliefBox(3.2, 0.42, 3.2, 'ngoiMuiHaiMossy', nlX, nlY + 3.42, nlZ),
    makeReliefCyl(0.55, 0.36, 0.64, 6, 'monolithicStoneDrum', nlX, nlY + 0.70, nlZ),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', nlX - 1.0, nlY + 0.56, nlZ),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', nlX + 1.0, nlY + 0.56, nlZ),
    makeReliefBox(2.4, 0.28, 1.15, 'monolithicStoneDrum', nlX, nlY + 0.14, nlZ + 2.85),
    makeReliefBox(3.0, 1.55, 0.36, 'monolithicStoneDrum', nlX, ctx.getHeight(nlX, -8.0) + 0.78, -8.0),
    makeReliefBox(3.2, 0.22, 0.54, 'ngoiMuiHaiMossy', nlX, ctx.getHeight(nlX, -8.0) + 1.64, -8.0),
    makeReliefBox(0.92, 1.48, 0.22, 'monolithicStoneDrum', -59.5, ctx.getHeight(-59.5, -2.5) + 0.74, -2.5),
    makeReliefBox(0.12, 2.05, 0.12, 'agedIronwood', -34.5, ctx.getHeight(-34.5, -2.5) + 1.02, -2.5),
    makeReliefBox(0.88, 0.24, 0.08, 'tamBaoGoldLacquer', -34.1, ctx.getHeight(-34.5, -2.5) + 1.85, -2.5),
    makeReliefCyl(0.52, 0.32, 0.64, 6, 'monolithicStoneDrum', -66.5, ctx.getHeight(-66.5, 2.5) + 0.32, 2.5),
    makeReliefBox(16.0, 1.05, 0.28, 'hoaChanhGreenTile', nlX, ctx.getHeight(nlX, -10.0) + 0.52, -10.0),
    makeReliefBox(16.2, 0.18, 0.44, 'ngoiMuiHaiMossy', nlX, ctx.getHeight(nlX, -10.0) + 1.12, -10.0)
  );
  for (const dx of [-1.75, 1.75]) {
    for (const dz of [-1.75, 1.75]) {
      opcW5Atlas.push(makeReliefCyl(0.11, 0.13, 2.80, 6, 'agedIronwood', nlX + dx, nlY + 1.62, nlZ + dz));
    }
  }
  for (const side of [-1, 1]) {
    opcW5Atlas.push(
      makeReliefCyl(0.03, 0.03, 0.30, 5, 'agedIronwood', nlX + side * 1.4, nlY + 2.72, nlZ + 1.8),
      makeReliefCyl(0.04, 0.05, 3.6, 5, 'agedIronwood', nlX + side * 4.8, ctx.getHeight(nlX + side * 4.8, -7.5) + 1.72, -7.5),
      makeReliefBox(2.4, 0.36, 1.35, 'batTrangFloor', nlX + side * 9.5, ctx.getHeight(nlX + side * 9.5, -5.5) + 0.18, -5.5),
      makeReliefCyl(0.30, 0.22, 0.42, 6, 'hoaChanhGreenTile', nlX + side * 2.2, ctx.getHeight(nlX + side * 2.2, -8.0) + 0.21, -8.0)
    );
    opcW5Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(nlX + side * 1.4, nlY + 2.52, nlZ + 1.8));
    opcW5Gold.push(new THREE.BoxGeometry(0.05, 1.15, 0.52).translate(nlX + side * 4.8, ctx.getHeight(nlX + side * 4.8, -7.5) + 2.95, -7.15));
    opcW5Bronze.push(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 5).translate(nlX + side * 2.1, nlY + 2.68, nlZ - 2.1));
  }
  for (const nx of [-58.0, -52.5, -43.5, -38.0]) {
    const ny = ctx.getHeight(nx, -3.5);
    opcW5Atlas.push(
      makeReliefBox(0.42, 1.02, 0.42, 'monolithicStoneDrum', nx, ny + 0.51, -3.5),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', nx, ny + 1.09, -3.5),
      makeReliefBox(1.65, 0.42, 0.48, 'monolithicStoneDrum', nx, ctx.getHeight(nx, -1.2) + 0.21, -1.2)
    );
  }
  for (const bx of [-66.0, -62.0, -58.0]) {
    const by = ctx.getHeight(bx, 0.5);
    opcW5Atlas.push(makeReliefCyl(0.12, 0.16, 0.78, 5, 'monolithicStoneDrum', bx, by + 0.39, 0.5));
    opcW5Glow.push(new THREE.BoxGeometry(0.14, 0.16, 0.14).translate(bx, by + 0.84, 0.5));
  }

  // 1211-1220. West Monastic Reception Pavilion (-74.5, 48.5), Stupa (-68.5, 51.5), Incense Alcove & West Gate
  const wkX = -74.5;
  const wkZ = 48.5;
  const wkY = Math.max(ctx.getHeight(wkX, wkZ), ctx.getHeight(wkX - 2.4, wkZ - 2.0), ctx.getHeight(wkX + 2.4, wkZ + 2.0));
  opcW5Atlas.push(
    makeReliefBox(5.2, 2.4, 4.4, 'monolithicStoneDrum', wkX, wkY - 0.82, wkZ),
    makeReliefBox(4.4, 2.55, 0.24, 'weatheredLimeStucco', wkX - 2.15, wkY + 1.66, wkZ, Math.PI * 0.5),
    makeReliefBox(5.8, 0.36, 5.0, 'ngoiMuiHaiMossy', wkX, wkY + 3.04, wkZ),
    makeReliefBox(3.4, 0.40, 2.8, 'ngoiMuiHaiMossy', wkX, wkY + 3.40, wkZ),
    makeReliefBox(1.45, 0.72, 0.85, 'agedIronwood', wkX, wkY + 0.74, wkZ),
    makeReliefBox(1.25, 0.42, 0.38, 'agedIronwood', wkX, wkY + 0.58, wkZ - 1.0),
    // 1214. 3-tier Stone Stupa (-68.5, 51.5)
    makeReliefBox(1.45, 0.52, 1.45, 'monolithicStoneDrum', -68.5, ctx.getHeight(-68.5, 51.5) + 0.26, 51.5),
    makeReliefBox(1.05, 0.82, 1.05, 'monolithicStoneDrum', -68.5, ctx.getHeight(-68.5, 51.5) + 0.92, 51.5),
    makeReliefBox(0.68, 0.75, 0.68, 'monolithicStoneDrum', -68.5, ctx.getHeight(-68.5, 51.5) + 1.68, 51.5),
    // 1215-1218, 1220. Incense alcove, calligraphy desk, West gate, jars & bonsai terrace
    makeReliefBox(1.45, 1.55, 1.25, 'monolithicStoneDrum', -74.5, ctx.getHeight(-74.5, 54.5) + 0.78, 54.5),
    makeReliefBox(1.85, 0.26, 1.65, 'ngoiMuiHaiMossy', -74.5, ctx.getHeight(-74.5, 54.5) + 1.66, 54.5),
    makeReliefBox(1.15, 0.74, 0.58, 'agedIronwood', -70.5, ctx.getHeight(-70.5, 46.5) + 0.37, 46.5),
    makeReliefBox(0.45, 2.45, 0.45, 'weatheredLimeStucco', -77.8, ctx.getHeight(-77.8, 46.5) + 1.22, 45.4),
    makeReliefBox(0.45, 2.45, 0.45, 'weatheredLimeStucco', -77.8, ctx.getHeight(-77.8, 46.5) + 1.22, 47.6),
    makeReliefBox(0.95, 0.32, 3.0, 'ngoiMuiHaiMossy', -77.8, ctx.getHeight(-77.8, 46.5) + 2.58, 46.5),
    makeReliefCyl(0.24, 0.28, 0.56, 6, 'hoaChanhGreenTile', wkX + 2.4, wkY + 0.28, wkZ - 1.8),
    makeReliefCyl(0.24, 0.28, 0.56, 6, 'hoaChanhGreenTile', wkX + 2.4, wkY + 0.28, wkZ + 1.8),
    makeReliefBox(1.35, 0.42, 1.35, 'monolithicStoneDrum', -68.5, ctx.getHeight(-68.5, 48.0) + 0.21, 48.0)
  );
  for (const dx of [-2.05, 2.05]) {
    for (const dz of [-1.65, 1.65]) {
      opcW5Atlas.push(makeReliefCyl(0.11, 0.13, 2.80, 6, 'agedIronwood', wkX + dx, wkY + 1.62, wkZ + dz));
    }
  }
  for (const dz of [-1.4, 1.4]) {
    opcW5Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(wkX + 2.1, wkY + 2.52, wkZ + dz));
  }
  opcW5Bronze.push(new THREE.CylinderGeometry(0.18, 0.14, 0.36, 6).translate(-74.5, ctx.getHeight(-74.5, 54.5) + 0.92, 53.5));
  for (const wz of [42.5, 46.5, 50.5]) {
    const wy = ctx.getHeight(-71.5, wz);
    opcW5Atlas.push(
      makeReliefBox(0.40, 0.98, 0.40, 'monolithicStoneDrum', -71.5, wy + 0.49, wz),
      makeReliefBox(0.54, 0.16, 0.54, 'ngoiMuiHaiMossy', -71.5, wy + 1.06, wz)
    );
  }

  // 1221-1230. South Zen Garden Arbor (-61.5, 58.5), Rockery (-35.5, 58.5), South Gate (-48.0, 62.5) & Path Props
  const zaX = -61.5;
  const zaZ = 58.5;
  const zaY = Math.max(ctx.getHeight(zaX, zaZ), ctx.getHeight(zaX - 1.6, zaZ - 1.6), ctx.getHeight(zaX + 1.6, zaZ + 1.6));
  opcW5Atlas.push(
    makeReliefBox(3.4, 2.2, 3.4, 'monolithicStoneDrum', zaX, zaY - 0.72, zaZ),
    makeReliefBox(4.0, 0.34, 4.0, 'ngoiMuiHaiMossy', zaX, zaY + 2.74, zaZ),
    makeReliefBox(1.65, 0.42, 0.52, 'monolithicStoneDrum', zaX, zaY + 0.58, zaZ),
    // 1222-1223, 1225, 1229-1230. SE Rockery, South triple gate, trellis, flower stand & drainage runnel
    makeReliefCyl(1.45, 1.62, 0.52, 6, 'monolithicStoneDrum', -35.5, ctx.getHeight(-35.5, 58.5) + 0.26, 58.5),
    makeReliefBox(0.85, 1.15, 0.75, 'monolithicStoneDrum', -35.5, ctx.getHeight(-35.5, 58.5) + 0.92, 58.5),
    makeReliefBox(0.42, 2.85, 0.42, 'agedIronwood', -49.6, ctx.getHeight(-48.0, 62.5) + 1.35, 62.5),
    makeReliefBox(0.42, 2.85, 0.42, 'agedIronwood', -46.4, ctx.getHeight(-48.0, 62.5) + 1.35, 62.5),
    makeReliefBox(4.4, 0.36, 1.45, 'ngoiMuiHaiMossy', -48.0, ctx.getHeight(-48.0, 62.5) + 2.88, 62.5),
    makeReliefBox(2.6, 0.14, 1.45, 'agedIronwood', -41.5, ctx.getHeight(-41.5, 60.5) + 2.25, 60.5),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', -42.6, ctx.getHeight(-41.5, 60.5) + 1.08, 60.5),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', -40.4, ctx.getHeight(-41.5, 60.5) + 1.08, 60.5),
    makeReliefBox(1.85, 0.58, 0.85, 'batTrangFloor', -35.5, ctx.getHeight(-35.5, 54.5) + 0.29, 54.5),
    makeReliefBox(22.0, 0.08, 0.32, 'monolithicStoneDrum', -48.0, ctx.getHeight(-48.0, 64.2) + 0.04, 64.2)
  );
  for (const dx of [-1.25, 1.25]) {
    for (const dz of [-1.25, 1.25]) {
      opcW5Atlas.push(makeReliefCyl(0.09, 0.11, 2.50, 6, 'agedIronwood', zaX + dx, zaY + 1.48, zaZ + dz));
    }
  }
  opcW5Bronze.push(new THREE.CylinderGeometry(0.24, 0.18, 0.48, 6).translate(-48.0, ctx.getHeight(-48.0, 60.5) + 0.24, 60.5));
  for (const side of [-1, 1]) {
    const sy = ctx.getHeight(-48.0 + side * 3.2, 62.5);
    opcW5Atlas.push(
      makeReliefBox(0.42, 1.02, 0.42, 'monolithicStoneDrum', -48.0 + side * 3.2, sy + 0.51, 62.5),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', -48.0 + side * 3.2, sy + 1.09, 62.5)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bx = -60.0 + i * 4.8;
    opcW5Atlas.push(makeReliefCyl(0.14, 0.18, 0.68, 5, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 63.5) + 0.34, 63.5));
  }
  for (const sx of [-55.5, -48.0, -40.5]) {
    opcW5Atlas.push(makeReliefBox(1.65, 0.42, 0.48, 'monolithicStoneDrum', sx, ctx.getHeight(sx, 61.2) + 0.21, 61.2));
  }

  // 1231-1240, 1242, 1244, 1249-1250. East Exhibition Pavilion (-15.5, 22.0), Stalls, Rose Beds & East Heritage Lane
  const exX = -15.5;
  const exZ = cz;
  const exY = Math.max(ctx.getHeight(exX, exZ), ctx.getHeight(exX - 2.2, exZ - 2.4), ctx.getHeight(exX + 2.2, exZ + 2.4));
  opcW5Atlas.push(
    makeReliefBox(4.8, 2.2, 5.4, 'monolithicStoneDrum', exX, exY - 0.72, exZ),
    makeReliefBox(5.4, 0.36, 6.0, 'ngoiMuiHaiMossy', exX, exY + 3.04, exZ),
    makeReliefBox(3.2, 0.40, 3.6, 'ngoiMuiHaiMossy', exX, exY + 3.40, exZ),
    makeReliefBox(1.35, 1.15, 1.85, 'agedIronwood', exX, exY + 0.94, exZ),
    makeReliefBox(1.15, 0.82, 0.58, 'agedIronwood', -17.8, ctx.getHeight(-17.8, exZ) + 0.41, exZ),
    makeReliefBox(0.95, 1.15, 0.22, 'monolithicStoneDrum', -17.8, ctx.getHeight(-17.8, 18.5) + 0.58, 18.5),
    makeReliefBox(1.25, 1.55, 0.65, 'agedIronwood', -21.5, ctx.getHeight(-21.5, 34.5) + 0.78, 34.5),
    makeReliefBox(1.45, 0.22, 0.85, 'ngoiMuiHaiMossy', -21.5, ctx.getHeight(-21.5, 34.5) + 1.62, 34.5),
    makeReliefBox(0.10, 1.85, 1.45, 'agedIronwood', -20.5, ctx.getHeight(-20.5, 39.2) + 0.92, 39.2),
    makeReliefBox(0.88, 1.55, 0.26, 'monolithicStoneDrum', -13.5, ctx.getHeight(-13.5, exZ) + 0.78, exZ)
  );
  opcW5Gold.push(
    new THREE.BoxGeometry(0.68, 0.52, 0.68).translate(exX, exY + 1.72, exZ),
    new THREE.BoxGeometry(0.58, 0.75, 0.30).translate(-13.5, ctx.getHeight(-13.5, exZ) + 1.05, exZ)
  );
  for (const dx of [-1.85, 1.85]) {
    for (const dz of [-2.15, 2.15]) {
      opcW5Atlas.push(makeReliefCyl(0.11, 0.13, 2.80, 6, 'agedIronwood', exX + dx, exY + 1.62, exZ + dz));
    }
  }
  for (const lz of [exZ - 1.8, exZ, exZ + 1.8]) {
    opcW5Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(exX - 1.9, exY + 2.52, lz));
  }
  for (const sz of [16.0, 28.0]) {
    const sy = ctx.getHeight(-15.5, sz);
    for (const dx of [-0.95, 0.95]) {
      for (const dz of [-0.75, 0.75]) {
        opcW5Atlas.push(makeReliefBox(0.10, 2.20, 0.10, 'agedIronwood', -15.5 + dx, sy + 1.02, sz + dz));
      }
    }
    opcW5Atlas.push(
      makeReliefBox(2.3, 0.20, 1.9, 'tamBaoGoldLacquer', -15.5, sy + 2.18, sz),
      makeReliefBox(1.55, 0.62, 0.62, 'agedIronwood', -15.5, sy + 0.31, sz)
    );
  }
  for (const ez of [14.0, 19.5, 24.5, 30.0]) {
    const ey = ctx.getHeight(-13.5, ez);
    opcW5Atlas.push(
      makeReliefCyl(0.06, 0.08, 2.65, 5, 'agedIronwood', -13.5, ey + 1.28, ez),
      makeReliefCyl(0.14, 0.18, 0.68, 5, 'monolithicStoneDrum', -12.5, ctx.getHeight(-12.5, ez) + 0.34, ez)
    );
    opcW5Glow.push(new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(-13.5, ey + 2.68, ez));
  }
  for (const rz of [12.5, 31.5, 34.5]) {
    opcW5Atlas.push(makeReliefBox(2.2, 0.36, 1.25, 'batTrangFloor', -15.5, ctx.getHeight(-15.5, rz) + 0.18, rz));
  }
  for (const bz of [17.5, 22.0, 26.5]) {
    opcW5Atlas.push(makeReliefBox(0.52, 0.42, 1.65, 'monolithicStoneDrum', -14.2, ctx.getHeight(-14.2, bz) + 0.21, bz));
  }
  for (const side of [-1, 1]) {
    opcW5Atlas.push(
      makeReliefBox(0.58, 0.38, 0.58, 'monolithicStoneDrum', -17.8, ctx.getHeight(-17.8, exZ + side * 2.4) + 0.19, exZ + side * 2.4),
      makeReliefCyl(0.24, 0.18, 0.34, 6, 'hoaChanhGreenTile', -17.8, ctx.getHeight(-17.8, exZ + side * 2.4) + 0.54, exZ + side * 2.4)
    );
  }

  const opcW5AtlasMesh = createMergedMesh('OnePillarWave5AtlasMesh', opcW5Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW5AtlasMesh) group.add(opcW5AtlasMesh);
  const opcW5GoldMesh = createMergedMesh('OnePillarWave5GoldMesh', opcW5Gold, ctx.materials.gold, false, false);
  if (opcW5GoldMesh) group.add(opcW5GoldMesh);
  const opcW5BronzeMesh = createMergedMesh('OnePillarWave5BronzeMesh', opcW5Bronze, ctx.materials.bronze, false, true);
  if (opcW5BronzeMesh) group.add(opcW5BronzeMesh);
  const opcW5GlowMesh = createMergedMesh('OnePillarWave5GlowMesh', opcW5Glow, glowMat, false, false);
  if (opcW5GlowMesh) group.add(opcW5GlowMesh);

  // =================================================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADE (Items 1601..1650 — castShadow = false, 0 new materials)
  // =================================================================================================
  const opcW6Atlas: THREE.BufferGeometry[] = [];
  const opcW6Gold: THREE.BufferGeometry[] = [];
  const opcW6Bronze: THREE.BufferGeometry[] = [];
  const opcW6Glow: THREE.BufferGeometry[] = [];

  // 1601-1620. NW Calligraphy Cloister Garden (-72.0, -6.5)
  const nwX = -72.0;
  const nwZ = -6.5;
  const nwY = ctx.getHeight(nwX, nwZ);
  opcW6Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', nwX, nwY + 0.18, nwZ),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', nwX, nwY + 2.94, nwZ),
    makeReliefBox(1.45, 0.68, 0.72, 'monolithicStoneDrum', nwX, nwY + 0.70, nwZ),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', nwX - 0.95, nwY + 0.56, nwZ),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', nwX + 0.95, nwY + 0.56, nwZ),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', nwX, nwY + 0.12, nwZ + 2.2),
    makeReliefBox(3.0, 1.55, 0.34, 'monolithicStoneDrum', nwX, ctx.getHeight(nwX, -9.8) + 0.78, -9.8),
    makeReliefBox(3.4, 0.24, 0.56, 'ngoiMuiHaiMossy', nwX, ctx.getHeight(nwX, -9.8) + 1.64, -9.8),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -67.2, ctx.getHeight(-67.2, -6.5) + 0.74, -6.5),
    makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', -66.5, ctx.getHeight(-66.5, -3.5) + 0.21, -3.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -77.0, ctx.getHeight(-77.0, -6.5) + 0.21, -6.5),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -69.8, ctx.getHeight(-69.8, -8.2) + 0.27, -8.2),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -74.2, ctx.getHeight(-74.2, -8.2) + 0.27, -8.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -67.0, ctx.getHeight(-67.0, -9.0) + 0.17, -9.0),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -76.5, ctx.getHeight(-76.5, -9.5) + 0.17, -9.5),
    makeReliefBox(12.0, 0.08, 0.26, 'monolithicStoneDrum', nwX, ctx.getHeight(nwX, -10.6) + 0.04, -10.6),
    makeReliefBox(0.12, 2.10, 0.12, 'agedIronwood', -65.5, ctx.getHeight(-65.5, -2.8) + 0.98, -2.8)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW6Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', nwX + dx, nwY + 1.50, nwZ + dz));
    }
  }
  opcW6Glow.push(
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(nwX - 0.9, nwY + 2.66, nwZ + 1.5),
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(nwX + 0.9, nwY + 2.66, nwZ + 1.5)
  );
  opcW6Bronze.push(new THREE.CylinderGeometry(0.26, 0.20, 0.58, 4).translate(nwX, ctx.getHeight(nwX, -3.0) + 0.29, -3.0));
  opcW6Gold.push(new THREE.BoxGeometry(0.76, 0.22, 0.08).translate(-65.1, ctx.getHeight(-65.5, -2.8) + 1.78, -2.8));
  for (const [lx, lz] of [[-68.5, -3.2], [-75.5, -3.2], [-75.5, -9.2]] as const) {
    const ly = ctx.getHeight(lx, lz);
    opcW6Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly + 1.04, lz)
    );
  }
  for (const fx of [-68.0, -76.0]) {
    const fy = ctx.getHeight(fx, -9.8);
    opcW6Atlas.push(makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', fx, fy + 1.72, -9.8));
    opcW6Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(fx, fy + 2.95, -9.45));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -76.0 + i * 3.0;
    opcW6Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, -2.0) + 0.33, -2.0));
  }

  // 1621-1635. SW Monastic Sutra-Drying Porch Annex (-76.5, 61.5)
  const swX = -76.5;
  const swZ = 61.5;
  const swY = ctx.getHeight(swX, swZ);
  opcW6Atlas.push(
    makeReliefBox(4.2, 0.34, 3.4, 'monolithicStoneDrum', swX, swY + 0.17, swZ),
    makeReliefBox(4.8, 0.28, 4.0, 'ngoiMuiHaiMossy', swX, swY + 2.74, swZ),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', swX - 0.7, swY + 0.96, swZ),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', swX + 0.7, swY + 0.96, swZ),
    makeReliefBox(1.45, 0.85, 1.45, 'monolithicStoneDrum', -73.0, ctx.getHeight(-73.0, 61.5) + 0.42, 61.5),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -79.2, ctx.getHeight(-79.2, 60.5) + 0.26, 60.5),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -79.2, ctx.getHeight(-79.2, 62.5) + 0.26, 62.5),
    makeReliefBox(7.2, 0.88, 0.26, 'hoaChanhGreenTile', swX, ctx.getHeight(swX, 64.5) + 0.44, 64.5),
    makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', -73.5, ctx.getHeight(-73.5, 58.8) + 0.21, 58.8),
    makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', -79.5, ctx.getHeight(-79.5, 58.8) + 0.21, 58.8),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -72.0, ctx.getHeight(-71.5, 60.0) + 0.85, 60.0),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -71.0, ctx.getHeight(-71.5, 60.0) + 0.85, 60.0),
    makeReliefBox(1.25, 0.12, 0.12, 'agedIronwood', -71.5, ctx.getHeight(-71.5, 60.0) + 1.80, 60.0),
    makeReliefBox(1.15, 0.48, 1.15, 'monolithicStoneDrum', -79.5, ctx.getHeight(-79.5, 64.2) + 0.24, 64.2),
    makeReliefBox(8.5, 0.08, 0.26, 'monolithicStoneDrum', swX, ctx.getHeight(swX, 65.2) + 0.04, 65.2)
  );
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.25, 1.25]) {
      opcW6Atlas.push(makeReliefCyl(0.09, 0.11, 2.55, 4, 'agedIronwood', swX + dx, swY + 1.40, swZ + dz));
    }
  }
  opcW6Glow.push(new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(swX, swY + 2.46, swZ));
  opcW6Bronze.push(new THREE.CylinderGeometry(0.18, 0.26, 0.44, 4).translate(-71.5, ctx.getHeight(-71.5, 60.0) + 1.32, 60.0));
  for (const lx of [-72.5, -80.0]) {
    const ly = ctx.getHeight(lx, 63.5);
    opcW6Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly + 0.48, 63.5),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly + 1.04, 63.5)
    );
  }
  for (const bx of [-71.5, -75.5, -79.5]) {
    opcW6Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 57.5) + 0.33, 57.5));
  }

  // 1636-1650. SE Pilgrim Heritage Rest Terrace (-21.5, 57.5)
  const seX = -21.5;
  const seZ = 57.5;
  const seY = ctx.getHeight(seX, seZ);
  opcW6Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', seX, seY + 0.18, seZ),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', seX, seY + 2.94, seZ),
    makeReliefCyl(0.48, 0.30, 0.62, 4, 'monolithicStoneDrum', seX, seY + 0.66, seZ),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', seX, seY + 0.12, seZ - 2.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -25.5, ctx.getHeight(-25.5, 59.5) + 0.17, 59.5),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -17.5, ctx.getHeight(-17.5, 61.5) + 0.17, 61.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -15.5, ctx.getHeight(-15.5, 57.5) + 0.74, 57.5)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW6Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', seX + dx, seY + 1.50, seZ + dz));
    }
  }
  opcW6Glow.push(new THREE.BoxGeometry(0.20, 0.26, 0.20).translate(seX, seY + 2.66, seZ));
  opcW6Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(-25.2, ctx.getHeight(-25.2, 56.5) + 0.45, 56.5));
  for (const ez of [56.0, 59.0]) {
    const ey = ctx.getHeight(-17.5, ez);
    opcW6Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', -17.5, ey + 0.72, ez),
      makeReliefBox(0.10, 0.76, 1.00, 'weatheredLimeStucco', -17.58, ey + 1.08, ez)
    );
  }
  for (const side of [-1, 1]) {
    const lx = seX + side * 3.3;
    const ly = ctx.getHeight(lx, 54.5);
    opcW6Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly + 0.48, 54.5),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly + 1.04, 54.5),
      makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', seX + side * 3.7, ctx.getHeight(seX + side * 3.7, 53.2) + 0.21, 53.2),
      makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', seX + side * 3.0, ctx.getHeight(seX + side * 3.0, 61.2) + 1.72, 61.2)
    );
    opcW6Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(seX + side * 3.0, ctx.getHeight(seX + side * 3.0, 61.2) + 2.95, 61.55));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -25.0 + i * 2.6;
    opcW6Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 62.5) + 0.33, 62.5));
  }

  const opcW6AtlasMesh = createMergedMesh('OnePillarWave6AtlasMesh', opcW6Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW6AtlasMesh) group.add(opcW6AtlasMesh);
  const opcW6GoldMesh = createMergedMesh('OnePillarWave6GoldMesh', opcW6Gold, ctx.materials.gold, false, false);
  if (opcW6GoldMesh) group.add(opcW6GoldMesh);
  const opcW6BronzeMesh = createMergedMesh('OnePillarWave6BronzeMesh', opcW6Bronze, ctx.materials.bronze, false, true);
  if (opcW6BronzeMesh) group.add(opcW6BronzeMesh);
  const opcW6GlowMesh = createMergedMesh('OnePillarWave6GlowMesh', opcW6Glow, glowMat, false, false);
  if (opcW6GlowMesh) group.add(opcW6GlowMesh);

  // =================================================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADE (Items 2001..2050 — castShadow = false, 0 new materials)
  // =================================================================================================
  const opcW7Atlas: THREE.BufferGeometry[] = [];
  const opcW7Gold: THREE.BufferGeometry[] = [];
  const opcW7Bronze: THREE.BufferGeometry[] = [];
  const opcW7Glow: THREE.BufferGeometry[] = [];

  // 2001-2020. NE Outer Meditation Tea Cloister (-21.5, -6.5)
  const ne7X = -21.5;
  const ne7Z = -6.5;
  const ne7Y = ctx.getHeight(ne7X, ne7Z);
  opcW7Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', ne7X, ne7Y + 0.18, ne7Z),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', ne7X, ne7Y + 2.94, ne7Z),
    makeReliefBox(1.45, 0.68, 0.72, 'monolithicStoneDrum', ne7X, ne7Y + 0.70, ne7Z),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', ne7X - 0.95, ne7Y + 0.56, ne7Z),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', ne7X + 0.95, ne7Y + 0.56, ne7Z),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', ne7X, ne7Y + 0.12, ne7Z + 2.2),
    makeReliefBox(3.0, 1.55, 0.34, 'monolithicStoneDrum', ne7X, ctx.getHeight(ne7X, -9.8) + 0.78, -9.8),
    makeReliefBox(3.4, 0.24, 0.56, 'ngoiMuiHaiMossy', ne7X, ctx.getHeight(ne7X, -9.8) + 1.64, -9.8),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -26.2, ctx.getHeight(-26.2, -6.5) + 0.74, -6.5),
    makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', -27.0, ctx.getHeight(-27.0, -3.5) + 0.21, -3.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -16.5, ctx.getHeight(-16.5, -6.5) + 0.21, -6.5),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -23.7, ctx.getHeight(-23.7, -8.2) + 0.27, -8.2),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -19.3, ctx.getHeight(-19.3, -8.2) + 0.27, -8.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -26.5, ctx.getHeight(-26.5, -9.0) + 0.17, -9.0),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -17.0, ctx.getHeight(-17.0, -9.5) + 0.17, -9.5),
    makeReliefBox(12.0, 0.08, 0.26, 'monolithicStoneDrum', ne7X, ctx.getHeight(ne7X, -10.6) + 0.04, -10.6),
    makeReliefBox(0.12, 2.10, 0.12, 'agedIronwood', -28.0, ctx.getHeight(-28.0, -2.8) + 0.98, -2.8)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW7Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', ne7X + dx, ne7Y + 1.50, ne7Z + dz));
    }
  }
  opcW7Glow.push(
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(ne7X - 0.9, ne7Y + 2.66, ne7Z + 1.5),
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(ne7X + 0.9, ne7Y + 2.66, ne7Z + 1.5)
  );
  opcW7Bronze.push(new THREE.CylinderGeometry(0.26, 0.20, 0.58, 4).translate(ne7X, ctx.getHeight(ne7X, -3.0) + 0.29, -3.0));
  opcW7Gold.push(new THREE.BoxGeometry(0.76, 0.22, 0.08).translate(-27.6, ctx.getHeight(-28.0, -2.8) + 1.78, -2.8));
  for (const [lx, lz] of [[-25.0, -3.2], [-18.0, -3.2], [-18.0, -9.2]] as const) {
    const ly7 = ctx.getHeight(lx, lz);
    opcW7Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly7 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly7 + 1.04, lz)
    );
  }
  for (const fx of [-25.5, -17.5]) {
    const fy7 = ctx.getHeight(fx, -9.8);
    opcW7Atlas.push(makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', fx, fy7 + 1.72, -9.8));
    opcW7Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(fx, fy7 + 2.95, -9.45));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -25.5 + i * 3.0;
    opcW7Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, -2.0) + 0.33, -2.0));
  }

  // 2021-2035. Far-West Outer Monastic Herb-Drying Garden (-83.5, 27.5)
  const fw7X = -83.5;
  const fw7Z = 27.5;
  const fw7Y = ctx.getHeight(fw7X, fw7Z);
  opcW7Atlas.push(
    makeReliefBox(4.2, 0.34, 3.4, 'monolithicStoneDrum', fw7X, fw7Y + 0.17, fw7Z),
    makeReliefBox(4.8, 0.28, 4.0, 'ngoiMuiHaiMossy', fw7X, fw7Y + 2.74, fw7Z),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', fw7X - 0.7, fw7Y + 0.96, fw7Z),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', fw7X + 0.7, fw7Y + 0.96, fw7Z),
    makeReliefBox(1.45, 0.85, 1.45, 'monolithicStoneDrum', fw7X, ctx.getHeight(fw7X, 23.8) + 0.42, 23.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -82.5, ctx.getHeight(-82.5, 30.8) + 0.26, 30.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -84.5, ctx.getHeight(-84.5, 30.8) + 0.26, 30.8),
    makeReliefBox(0.26, 0.88, 7.2, 'hoaChanhGreenTile', -86.5, ctx.getHeight(-86.5, fw7Z) + 0.44, fw7Z),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -80.5, ctx.getHeight(-80.5, 24.5) + 0.21, 24.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -80.5, ctx.getHeight(-80.5, 30.5) + 0.21, 30.5),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -80.5, ctx.getHeight(-80.5, 27.5) + 0.85, 27.0),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -80.5, ctx.getHeight(-80.5, 27.5) + 0.85, 28.0),
    makeReliefBox(0.12, 0.12, 1.25, 'agedIronwood', -80.5, ctx.getHeight(-80.5, 27.5) + 1.80, 27.5),
    makeReliefBox(1.15, 0.48, 1.15, 'monolithicStoneDrum', -86.0, ctx.getHeight(-86.0, 31.2) + 0.24, 31.2),
    makeReliefBox(0.26, 0.08, 8.5, 'monolithicStoneDrum', -87.2, ctx.getHeight(-87.2, fw7Z) + 0.04, fw7Z)
  );
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.25, 1.25]) {
      opcW7Atlas.push(makeReliefCyl(0.09, 0.11, 2.55, 4, 'agedIronwood', fw7X + dx, fw7Y + 1.40, fw7Z + dz));
    }
  }
  opcW7Glow.push(new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(fw7X, fw7Y + 2.46, fw7Z));
  opcW7Bronze.push(new THREE.CylinderGeometry(0.18, 0.26, 0.44, 4).translate(-80.5, ctx.getHeight(-80.5, 27.5) + 1.32, 27.5));
  for (const lz of [23.5, 31.5]) {
    const ly7 = ctx.getHeight(-85.5, lz);
    opcW7Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', -85.5, ly7 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', -85.5, ly7 + 1.04, lz)
    );
  }
  for (const bz of [23.5, 27.5, 31.5]) {
    opcW7Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', -79.5, ctx.getHeight(-79.5, bz) + 0.33, bz));
  }

  // 2036-2050. South-Central Outer Pilgrim Heritage Court (-48.5, 65.5)
  const sc7X = -48.5;
  const sc7Z = 65.5;
  const sc7Y = ctx.getHeight(sc7X, sc7Z);
  opcW7Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', sc7X, sc7Y + 0.18, sc7Z),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', sc7X, sc7Y + 2.94, sc7Z),
    makeReliefCyl(0.48, 0.30, 0.62, 4, 'monolithicStoneDrum', sc7X, sc7Y + 0.66, sc7Z),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', sc7X, sc7Y + 0.12, sc7Z - 2.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -52.5, ctx.getHeight(-52.5, 67.5) + 0.17, 67.5),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -44.5, ctx.getHeight(-44.5, 69.5) + 0.17, 69.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -42.5, ctx.getHeight(-42.5, 65.5) + 0.74, 65.5)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW7Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', sc7X + dx, sc7Y + 1.50, sc7Z + dz));
    }
  }
  opcW7Glow.push(new THREE.BoxGeometry(0.20, 0.26, 0.20).translate(sc7X, sc7Y + 2.66, sc7Z));
  opcW7Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(-52.2, ctx.getHeight(-52.2, 64.5) + 0.45, 64.5));
  for (const ez of [64.0, 67.0]) {
    const ey7 = ctx.getHeight(-44.5, ez);
    opcW7Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', -44.5, ey7 + 0.72, ez),
      makeReliefBox(0.10, 0.76, 1.00, 'weatheredLimeStucco', -44.58, ey7 + 1.08, ez)
    );
  }
  for (const side of [-1, 1]) {
    const lx = sc7X + side * 3.3;
    const ly7 = ctx.getHeight(lx, 62.5);
    opcW7Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly7 + 0.48, 62.5),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly7 + 1.04, 62.5),
      makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', sc7X + side * 3.7, ctx.getHeight(sc7X + side * 3.7, 61.2) + 0.21, 61.2),
      makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', sc7X + side * 3.0, ctx.getHeight(sc7X + side * 3.0, 69.2) + 1.72, 69.2)
    );
    opcW7Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(sc7X + side * 3.0, ctx.getHeight(sc7X + side * 3.0, 69.2) + 2.95, 69.55));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -52.0 + i * 2.6;
    opcW7Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 70.5) + 0.33, 70.5));
  }

  const opcW7AtlasMesh = createMergedMesh('OnePillarWave7AtlasMesh', opcW7Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW7AtlasMesh) group.add(opcW7AtlasMesh);
  const opcW7GoldMesh = createMergedMesh('OnePillarWave7GoldMesh', opcW7Gold, ctx.materials.gold, false, false);
  if (opcW7GoldMesh) group.add(opcW7GoldMesh);
  const opcW7BronzeMesh = createMergedMesh('OnePillarWave7BronzeMesh', opcW7Bronze, ctx.materials.bronze, false, true);
  if (opcW7BronzeMesh) group.add(opcW7BronzeMesh);
  const opcW7GlowMesh = createMergedMesh('OnePillarWave7GlowMesh', opcW7Glow, glowMat, false, false);
  if (opcW7GlowMesh) group.add(opcW7GlowMesh);

  // =================================================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADE (Items 2401..2450 — castShadow = false, 0 new materials)
  // =================================================================================================
  const opcW8Atlas: THREE.BufferGeometry[] = [];
  const opcW8Gold: THREE.BufferGeometry[] = [];
  const opcW8Bronze: THREE.BufferGeometry[] = [];
  const opcW8Glow: THREE.BufferGeometry[] = [];

  // 2401-2420. NW Outer Lotus-Sutra Reading Court (-74.5, -9.5)
  const nw8X = -74.5;
  const nw8Z = -9.5;
  const nw8Y = ctx.getHeight(nw8X, nw8Z);
  opcW8Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', nw8X, nw8Y + 0.18, nw8Z),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', nw8X, nw8Y + 2.94, nw8Z),
    makeReliefBox(1.45, 0.68, 0.72, 'monolithicStoneDrum', nw8X, nw8Y + 0.70, nw8Z),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', nw8X - 0.95, nw8Y + 0.56, nw8Z),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', nw8X + 0.95, nw8Y + 0.56, nw8Z),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', nw8X, nw8Y + 0.12, nw8Z + 2.2),
    makeReliefBox(3.0, 1.55, 0.34, 'monolithicStoneDrum', nw8X, ctx.getHeight(nw8X, -12.8) + 0.78, -12.8),
    makeReliefBox(3.4, 0.24, 0.56, 'ngoiMuiHaiMossy', nw8X, ctx.getHeight(nw8X, -12.8) + 1.64, -12.8),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -79.2, ctx.getHeight(-79.2, -9.5) + 0.74, -9.5),
    makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', -80.0, ctx.getHeight(-80.0, -6.5) + 0.21, -6.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -69.5, ctx.getHeight(-69.5, -9.5) + 0.21, -9.5),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -76.7, ctx.getHeight(-76.7, -11.2) + 0.27, -11.2),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -72.3, ctx.getHeight(-72.3, -11.2) + 0.27, -11.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -79.5, ctx.getHeight(-79.5, -12.0) + 0.17, -12.0),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -70.0, ctx.getHeight(-70.0, -12.5) + 0.17, -12.5),
    makeReliefBox(12.0, 0.08, 0.26, 'monolithicStoneDrum', nw8X, ctx.getHeight(nw8X, -13.6) + 0.04, -13.6),
    makeReliefBox(0.12, 2.10, 0.12, 'agedIronwood', -80.8, ctx.getHeight(-80.8, -5.8) + 0.98, -5.8)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW8Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', nw8X + dx, nw8Y + 1.50, nw8Z + dz));
    }
  }
  opcW8Glow.push(
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(nw8X - 0.9, nw8Y + 2.66, nw8Z + 1.5),
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(nw8X + 0.9, nw8Y + 2.66, nw8Z + 1.5)
  );
  opcW8Bronze.push(new THREE.CylinderGeometry(0.26, 0.20, 0.58, 4).translate(nw8X, ctx.getHeight(nw8X, -6.0) + 0.29, -6.0));
  opcW8Gold.push(new THREE.BoxGeometry(0.76, 0.22, 0.08).translate(-80.4, ctx.getHeight(-80.8, -5.8) + 1.78, -5.8));
  for (const [lx, lz] of [[-78.0, -6.2], [-71.0, -6.2], [-71.0, -12.2]] as const) {
    const ly8 = ctx.getHeight(lx, lz);
    opcW8Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly8 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly8 + 1.04, lz)
    );
  }
  for (const fx of [-78.5, -70.5]) {
    const fy8 = ctx.getHeight(fx, -12.8);
    opcW8Atlas.push(makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', fx, fy8 + 1.72, -12.8));
    opcW8Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(fx, fy8 + 2.95, -12.45));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -78.5 + i * 3.0;
    opcW8Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, -5.0) + 0.33, -5.0));
  }

  // 2421-2435. Far-East Outer Zen Bamboo-Tea Cloister (-14.5, 28.5)
  const fe8X = -14.5;
  const fe8Z = 28.5;
  const fe8Y = ctx.getHeight(fe8X, fe8Z);
  opcW8Atlas.push(
    makeReliefBox(4.2, 0.34, 3.4, 'monolithicStoneDrum', fe8X, fe8Y + 0.17, fe8Z),
    makeReliefBox(4.8, 0.28, 4.0, 'ngoiMuiHaiMossy', fe8X, fe8Y + 2.74, fe8Z),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', fe8X - 0.7, fe8Y + 0.96, fe8Z),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', fe8X + 0.7, fe8Y + 0.96, fe8Z),
    makeReliefBox(1.45, 0.85, 1.45, 'monolithicStoneDrum', fe8X, ctx.getHeight(fe8X, 24.8) + 0.42, 24.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -13.5, ctx.getHeight(-13.5, 31.8) + 0.26, 31.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -15.5, ctx.getHeight(-15.5, 31.8) + 0.26, 31.8),
    makeReliefBox(0.26, 0.88, 7.2, 'hoaChanhGreenTile', -11.5, ctx.getHeight(-11.5, fe8Z) + 0.44, fe8Z),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -17.5, ctx.getHeight(-17.5, 25.5) + 0.21, 25.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -17.5, ctx.getHeight(-17.5, 31.5) + 0.21, 31.5),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -17.5, ctx.getHeight(-17.5, 28.5) + 0.85, 28.0),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -17.5, ctx.getHeight(-17.5, 28.5) + 0.85, 29.0),
    makeReliefBox(0.12, 0.12, 1.25, 'agedIronwood', -17.5, ctx.getHeight(-17.5, 28.5) + 1.80, 28.5),
    makeReliefBox(1.15, 0.48, 1.15, 'monolithicStoneDrum', -12.0, ctx.getHeight(-12.0, 32.2) + 0.24, 32.2),
    makeReliefBox(0.26, 0.08, 8.5, 'monolithicStoneDrum', -10.8, ctx.getHeight(-10.8, fe8Z) + 0.04, fe8Z)
  );
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.25, 1.25]) {
      opcW8Atlas.push(makeReliefCyl(0.09, 0.11, 2.55, 4, 'agedIronwood', fe8X + dx, fe8Y + 1.40, fe8Z + dz));
    }
  }
  opcW8Glow.push(new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(fe8X, fe8Y + 2.46, fe8Z));
  opcW8Bronze.push(new THREE.CylinderGeometry(0.18, 0.26, 0.44, 4).translate(-17.5, ctx.getHeight(-17.5, 28.5) + 1.32, 28.5));
  for (const lz of [24.5, 32.5]) {
    const ly8 = ctx.getHeight(-12.5, lz);
    opcW8Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', -12.5, ly8 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', -12.5, ly8 + 1.04, lz)
    );
  }
  for (const bz of [24.5, 28.5, 32.5]) {
    opcW8Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', -18.5, ctx.getHeight(-18.5, bz) + 0.33, bz));
  }

  // 2436-2450. South-West Outer Pilgrim Bell-Garden (-68.5, 65.5)
  const sw8X = -68.5;
  const sw8Z = 65.5;
  const sw8Y = ctx.getHeight(sw8X, sw8Z);
  opcW8Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', sw8X, sw8Y + 0.18, sw8Z),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', sw8X, sw8Y + 2.94, sw8Z),
    makeReliefCyl(0.48, 0.30, 0.62, 4, 'monolithicStoneDrum', sw8X, sw8Y + 0.66, sw8Z),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', sw8X, sw8Y + 0.12, sw8Z - 2.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -72.5, ctx.getHeight(-72.5, 67.5) + 0.17, 67.5),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -64.5, ctx.getHeight(-64.5, 69.5) + 0.17, 69.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -62.5, ctx.getHeight(-62.5, 65.5) + 0.74, 65.5)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW8Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', sw8X + dx, sw8Y + 1.50, sw8Z + dz));
    }
  }
  opcW8Glow.push(new THREE.BoxGeometry(0.20, 0.26, 0.20).translate(sw8X, sw8Y + 2.66, sw8Z));
  opcW8Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(-72.2, ctx.getHeight(-72.2, 64.5) + 0.45, 64.5));
  for (const ez of [64.0, 67.0]) {
    const ey8 = ctx.getHeight(-64.5, ez);
    opcW8Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', -64.5, ey8 + 0.72, ez),
      makeReliefBox(0.10, 0.76, 1.00, 'weatheredLimeStucco', -64.58, ey8 + 1.08, ez)
    );
  }
  for (const side of [-1, 1]) {
    const lx = sw8X + side * 3.3;
    const ly8 = ctx.getHeight(lx, 62.5);
    opcW8Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly8 + 0.48, 62.5),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly8 + 1.04, 62.5),
      makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', sw8X + side * 3.7, ctx.getHeight(sw8X + side * 3.7, 61.2) + 0.21, 61.2),
      makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', sw8X + side * 3.0, ctx.getHeight(sw8X + side * 3.0, 69.2) + 1.72, 69.2)
    );
    opcW8Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(sw8X + side * 3.0, ctx.getHeight(sw8X + side * 3.0, 69.2) + 2.95, 69.55));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -72.0 + i * 2.6;
    opcW8Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 70.5) + 0.33, 70.5));
  }

  const opcW8AtlasMesh = createMergedMesh('OnePillarWave8AtlasMesh', opcW8Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW8AtlasMesh) group.add(opcW8AtlasMesh);
  const opcW8GoldMesh = createMergedMesh('OnePillarWave8GoldMesh', opcW8Gold, ctx.materials.gold, false, false);
  if (opcW8GoldMesh) group.add(opcW8GoldMesh);
  const opcW8BronzeMesh = createMergedMesh('OnePillarWave8BronzeMesh', opcW8Bronze, ctx.materials.bronze, false, true);
  if (opcW8BronzeMesh) group.add(opcW8BronzeMesh);
  const opcW8GlowMesh = createMergedMesh('OnePillarWave8GlowMesh', opcW8Glow, glowMat, false, false);
  if (opcW8GlowMesh) group.add(opcW8GlowMesh);

  // =================================================================================================
  // WAVE 9 REAL-PHOTO VISUAL QC UPGRADE (Items 2801..2850 — castShadow = false, 0 new materials)
  // =================================================================================================
  const opcW9Atlas: THREE.BufferGeometry[] = [];
  const opcW9Gold: THREE.BufferGeometry[] = [];
  const opcW9Bronze: THREE.BufferGeometry[] = [];
  const opcW9Glow: THREE.BufferGeometry[] = [];

  // 2801-2820. Far-NW Outer Sutra-Library & Lotus Garden (-86.5, -9.5)
  const nw9X = -86.5;
  const nw9Z = -9.5;
  const nw9Y = ctx.getHeight(nw9X, nw9Z);
  opcW9Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', nw9X, nw9Y + 0.18, nw9Z),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', nw9X, nw9Y + 2.94, nw9Z),
    makeReliefBox(1.45, 0.68, 0.72, 'monolithicStoneDrum', nw9X, nw9Y + 0.70, nw9Z),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', nw9X - 0.95, nw9Y + 0.56, nw9Z),
    makeReliefBox(0.42, 0.40, 0.42, 'monolithicStoneDrum', nw9X + 0.95, nw9Y + 0.56, nw9Z),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', nw9X, nw9Y + 0.12, nw9Z + 2.2),
    makeReliefBox(3.0, 1.55, 0.34, 'monolithicStoneDrum', nw9X, ctx.getHeight(nw9X, -12.8) + 0.78, -12.8),
    makeReliefBox(3.4, 0.24, 0.56, 'ngoiMuiHaiMossy', nw9X, ctx.getHeight(nw9X, -12.8) + 1.64, -12.8),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -91.2, ctx.getHeight(-91.2, -9.5) + 0.74, -9.5),
    makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', -92.0, ctx.getHeight(-92.0, -6.5) + 0.21, -6.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -81.5, ctx.getHeight(-81.5, -9.5) + 0.21, -9.5),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -88.7, ctx.getHeight(-88.7, -11.2) + 0.27, -11.2),
    makeReliefCyl(0.24, 0.28, 0.54, 4, 'hoaChanhGreenTile', -84.3, ctx.getHeight(-84.3, -11.2) + 0.27, -11.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -91.5, ctx.getHeight(-91.5, -12.0) + 0.17, -12.0),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -82.0, ctx.getHeight(-82.0, -12.5) + 0.17, -12.5),
    makeReliefBox(12.0, 0.08, 0.26, 'monolithicStoneDrum', nw9X, ctx.getHeight(nw9X, -13.6) + 0.04, -13.6),
    makeReliefBox(0.12, 2.10, 0.12, 'agedIronwood', -92.8, ctx.getHeight(-92.8, -5.8) + 0.90, -5.8)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW9Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', nw9X + dx, nw9Y + 1.48, nw9Z + dz));
    }
  }
  opcW9Glow.push(
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(nw9X - 0.9, nw9Y + 2.66, nw9Z + 1.5),
    new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(nw9X + 0.9, nw9Y + 2.66, nw9Z + 1.5)
  );
  opcW9Bronze.push(new THREE.CylinderGeometry(0.26, 0.20, 0.58, 4).translate(nw9X, ctx.getHeight(nw9X, -6.0) + 0.29, -6.0));
  opcW9Gold.push(new THREE.BoxGeometry(0.76, 0.22, 0.08).translate(-92.4, ctx.getHeight(-92.8, -5.8) + 1.78, -5.8));
  for (const [lx, lz] of [[-90.0, -6.2], [-83.0, -6.2], [-83.0, -12.2]] as const) {
    const ly9 = ctx.getHeight(lx, lz);
    opcW9Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly9 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly9 + 1.04, lz)
    );
  }
  for (const fx of [-90.5, -82.5]) {
    const fy9 = ctx.getHeight(fx, -12.8);
    opcW9Atlas.push(makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', fx, fy9 + 1.65, -12.8));
    opcW9Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(fx, fy9 + 2.95, -12.45));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -90.5 + i * 3.0;
    opcW9Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, -5.0) + 0.33, -5.0));
  }

  // 2821-2835. Far-East Outer Zen Lotus Cloister (-5.5, 28.5)
  const fe9X = -5.5;
  const fe9Z = 28.5;
  const fe9Y = ctx.getHeight(fe9X, fe9Z);
  opcW9Atlas.push(
    makeReliefBox(4.2, 0.34, 3.4, 'monolithicStoneDrum', fe9X, fe9Y + 0.17, fe9Z),
    makeReliefBox(4.8, 0.28, 4.0, 'ngoiMuiHaiMossy', fe9X, fe9Y + 2.74, fe9Z),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', fe9X - 0.7, fe9Y + 0.96, fe9Z),
    makeReliefBox(0.42, 1.25, 2.2, 'agedIronwood', fe9X + 0.7, fe9Y + 0.96, fe9Z),
    makeReliefBox(1.45, 0.85, 1.45, 'monolithicStoneDrum', fe9X, ctx.getHeight(fe9X, 24.8) + 0.42, 24.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -4.5, ctx.getHeight(-4.5, 31.8) + 0.26, 31.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', -6.5, ctx.getHeight(-6.5, 31.8) + 0.26, 31.8),
    makeReliefBox(0.26, 0.88, 7.2, 'hoaChanhGreenTile', -2.5, ctx.getHeight(-2.5, fe9Z) + 0.44, fe9Z),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -8.5, ctx.getHeight(-8.5, 25.5) + 0.21, 25.5),
    makeReliefBox(0.48, 0.42, 1.55, 'monolithicStoneDrum', -8.5, ctx.getHeight(-8.5, 31.5) + 0.21, 31.5),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -8.5, ctx.getHeight(-8.5, 28.5) + 0.80, 28.0),
    makeReliefBox(0.10, 1.85, 0.10, 'agedIronwood', -8.5, ctx.getHeight(-8.5, 28.5) + 0.80, 29.0),
    makeReliefBox(0.12, 0.12, 1.25, 'agedIronwood', -8.5, ctx.getHeight(-8.5, 28.5) + 1.78, 28.5),
    makeReliefBox(1.15, 0.48, 1.15, 'monolithicStoneDrum', -3.0, ctx.getHeight(-3.0, 32.2) + 0.24, 32.2),
    makeReliefBox(0.26, 0.08, 8.5, 'monolithicStoneDrum', -1.8, ctx.getHeight(-1.8, fe9Z) + 0.04, fe9Z)
  );
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.25, 1.25]) {
      opcW9Atlas.push(makeReliefCyl(0.09, 0.11, 2.55, 4, 'agedIronwood', fe9X + dx, fe9Y + 1.38, fe9Z + dz));
    }
  }
  opcW9Glow.push(new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(fe9X, fe9Y + 2.46, fe9Z));
  opcW9Bronze.push(new THREE.CylinderGeometry(0.18, 0.26, 0.44, 4).translate(-8.5, ctx.getHeight(-8.5, 28.5) + 1.32, 28.5));
  for (const lz of [24.5, 32.5]) {
    const ly9 = ctx.getHeight(-3.5, lz);
    opcW9Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', -3.5, ly9 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', -3.5, ly9 + 1.04, lz)
    );
  }
  for (const bz of [24.5, 28.5, 32.5]) {
    opcW9Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', -9.5, ctx.getHeight(-9.5, bz) + 0.33, bz));
  }

  // 2836-2850. Far-SW Outer Pilgrim Incense & Lantern Garden (-68.5, 76.5)
  const sw9X = -68.5;
  const sw9Z = 76.5;
  const sw9Y = ctx.getHeight(sw9X, sw9Z);
  opcW9Atlas.push(
    makeReliefBox(4.0, 0.36, 4.0, 'monolithicStoneDrum', sw9X, sw9Y + 0.18, sw9Z),
    makeReliefBox(4.6, 0.30, 4.6, 'ngoiMuiHaiMossy', sw9X, sw9Y + 2.94, sw9Z),
    makeReliefCyl(0.48, 0.30, 0.62, 4, 'monolithicStoneDrum', sw9X, sw9Y + 0.66, sw9Z),
    makeReliefBox(1.80, 0.24, 0.78, 'monolithicStoneDrum', sw9X, sw9Y + 0.12, sw9Z - 2.2),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -72.5, ctx.getHeight(-72.5, 78.5) + 0.17, 78.5),
    makeReliefBox(1.85, 0.34, 1.15, 'batTrangFloor', -64.5, ctx.getHeight(-64.5, 80.5) + 0.17, 80.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thapButSandstone', -62.5, ctx.getHeight(-62.5, 76.5) + 0.74, 76.5)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.55, 1.55]) {
      opcW9Atlas.push(makeReliefCyl(0.09, 0.11, 2.75, 4, 'agedIronwood', sw9X + dx, sw9Y + 1.48, sw9Z + dz));
    }
  }
  opcW9Glow.push(new THREE.BoxGeometry(0.20, 0.26, 0.20).translate(sw9X, sw9Y + 2.66, sw9Z));
  opcW9Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(-72.2, ctx.getHeight(-72.2, 75.5) + 0.45, 75.5));
  for (const ez of [75.0, 78.0]) {
    const ey9 = ctx.getHeight(-64.5, ez);
    opcW9Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', -64.5, ey9 + 0.65, ez),
      makeReliefBox(0.10, 0.76, 1.00, 'weatheredLimeStucco', -64.58, ey9 + 1.08, ez)
    );
  }
  for (const side of [-1, 1]) {
    const lx = sw9X + side * 3.3;
    const ly9 = ctx.getHeight(lx, 73.5);
    opcW9Atlas.push(
      makeReliefBox(0.38, 0.96, 0.38, 'monolithicStoneDrum', lx, ly9 + 0.48, 73.5),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', lx, ly9 + 1.04, 73.5),
      makeReliefBox(1.55, 0.42, 0.48, 'monolithicStoneDrum', sw9X + side * 3.7, ctx.getHeight(sw9X + side * 3.7, 72.2) + 0.21, 72.2),
      makeReliefCyl(0.04, 0.05, 3.6, 4, 'agedIronwood', sw9X + side * 3.0, ctx.getHeight(sw9X + side * 3.0, 80.2) + 1.65, 80.2)
    );
    opcW9Gold.push(new THREE.BoxGeometry(0.05, 1.05, 0.46).translate(sw9X + side * 3.0, ctx.getHeight(sw9X + side * 3.0, 80.2) + 2.95, 80.55));
  }
  for (let i = 0; i < 4; i++) {
    const bx = -72.0 + i * 2.6;
    opcW9Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 81.5) + 0.33, 81.5));
  }

  const opcW9AtlasMesh = createMergedMesh('OnePillarWave9AtlasMesh', opcW9Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW9AtlasMesh) group.add(opcW9AtlasMesh);
  const opcW9GoldMesh = createMergedMesh('OnePillarWave9GoldMesh', opcW9Gold, ctx.materials.gold, false, false);
  if (opcW9GoldMesh) group.add(opcW9GoldMesh);
  const opcW9BronzeMesh = createMergedMesh('OnePillarWave9BronzeMesh', opcW9Bronze, ctx.materials.bronze, false, true);
  if (opcW9BronzeMesh) group.add(opcW9BronzeMesh);
  const opcW9GlowMesh = createMergedMesh('OnePillarWave9GlowMesh', opcW9Glow, glowMat, false, false);
  if (opcW9GlowMesh) group.add(opcW9GlowMesh);

  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-C01', 'HV-C02', 'HV-C04', 'HV-C05', 'HV-C13',
    'HV-D01', 'HV-D10', 'HV-D12', 'HV-E07', 'HV-J04', 'HV-NEW-MB-05', 'HV-NEW-MB-12'
  ]);

  ctx.scene.add(group);
  return group;
}

/**
 * ============================================================================
 * PART 2: HỒ HOÀN KIẾM — THÁP RÙA — CẦU THÊ HÚC — ĐẮC NGUYỆT LÂU — TRẤN BA ĐÌNH — THÁP BÚT & ĐÀI NGHIÊN
 * Implements TR-01..TR-32 & TH-01..TH-32
 * ============================================================================
 */
export function buildHoanKiemComplex(ctx: VietnamBuilderContext): THREE.Group {
  const pack = getOrCreateHanoiIconsPack(ctx);
  const group = new THREE.Group();
  group.name = 'TurtleTowerIslet';

  const cx = 52.0;
  const cz = 22.0;
  const isletY = ctx.getHeight(cx, cz);

  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 12.5 },
    { x: 75.5, z: 3.0, r: 13.5 },
    { x: 90.5, z: 3.0, r: 10.5 },
    { x: 101.0, z: 13.5, r: 9.0 }
  );

  const atlasParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const warmGlowParts: THREE.BufferGeometry[] = [];

  // --------------------------------------------------------------------------
  // 1. SLOPING GRASSY GÒ RÙA MOUND & MOSSY SHORELINE REVETMENT (TR-25..TR-32)
  // --------------------------------------------------------------------------
  // Organic sloping lush emerald grassy Gò Rùa mound (smoothly rising from seamless animated Fresnel water!)
  const moundBot = makeReliefCyl(9.6, 11.4, 1.25, 24, 'lushIsletGrass', cx, VIETNAM_WATER_LEVEL + 0.25, cz);
  const moundMid = makeReliefCyl(7.8, 9.5, 0.72, 24, 'lushIsletGrass', cx, isletY - 0.06, cz);
  const moundTop = makeReliefCyl(6.2, 7.6, 0.36, 20, 'lushIsletGrass', cx, isletY + 0.22, cz);
  atlasParts.push(moundBot, moundMid, moundTop);

  // Natural mossy shoreline revetment rocks ringing Gò Rùa (NO floating pebbles, NO out-of-place lantern!)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 9.4 + (i % 3) * 0.45;
    const rock = remapRelief(
      createSculptedRockGeometry(3100 + i * 17, 1.05 + (i % 2) * 0.35, 0.65, 0.95, 1),
      'monolithicStoneDrum'
    );
    rock.translate(cx + Math.cos(a) * r, VIETNAM_WATER_LEVEL + 0.14, cz + Math.sin(a) * r);
    atlasParts.push(rock);
  }

  // --------------------------------------------------------------------------
  // 2. THÁP RÙA — ICONIC WEATHERED 3-TIER + SOLIDLY ANCHORED TIER 4 CROWN (TR-01..TR-24)
  // Rectangular footprint: Long sides (North/South, X-axis) = 6.2m (3 pointed arches: narrow-wide-narrow)
  //                        Short sides (East/West, Z-axis) = 4.5m (2 pointed arches)
  // --------------------------------------------------------------------------
  const baseY = isletY + 0.38;
  // Stepped weathered stone plinth
  atlasParts.push(
    makeReliefBox(7.2, 0.48, 5.5, 'monolithicStoneDrum', cx, baseY + 0.24, cz),
    makeReliefBox(6.6, 0.32, 4.9, 'thapRuaMossyStucco', cx, baseY + 0.62, cz)
  );

  // Helper to build one complete Gothic-Vietnamese arched tier (Tier 1 or Tier 2)
  const addThapRuaArchedTier = (
    ty: number,
    w: number,
    d: number,
    h: number,
    wallT: number
  ) => {
    // Dark recessed vaulted interior core (creates deep authentic architectural shadow through the pointed arches!)
    atlasParts.push(makeReliefBox(w - wallT * 2.2, h - 0.15, d - wallT * 2.2, 'darkTimberSoffit', cx, ty + h * 0.5, cz));

    // Long sides (North & South: 3 pointed arches: narrow-wide-narrow)
    const sideW = w * 0.29;
    const midW = w - sideW * 2;
    for (const sz of [-1, 1]) {
      const zPos = cz + sz * (d * 0.5 - wallT * 0.5);
      // Center wide pointed arch
      const midArch = remapRelief(
        createPointedArchBayGeometry(midW, h, wallT, midW * 0.66, h * 0.80),
        'thapRuaMossyStucco'
      );
      midArch.translate(cx, ty, zPos);
      atlasParts.push(midArch);
      // Left & right narrower pointed arches
      for (const sx of [-1, 1]) {
        const sArch = remapRelief(
          createPointedArchBayGeometry(sideW, h, wallT, sideW * 0.58, h * 0.74),
          'thapRuaMossyStucco'
        );
        sArch.translate(cx + sx * (midW * 0.5 + sideW * 0.5), ty, zPos);
        atlasParts.push(sArch);
      }
      // Vertical decorative pilasters between bays & corners
      for (const px of [-w * 0.48, -midW * 0.5, midW * 0.5, w * 0.48]) {
        atlasParts.push(
          makeReliefBox(0.24, h, 0.14, 'thapRuaOchrePebble', cx + px, ty + h * 0.5, zPos + sz * (wallT * 0.5 + 0.04))
        );
      }
    }

    // Short sides (East & West: 2 pointed arches)
    const bayD = d * 0.5;
    for (const sx of [-1, 1]) {
      const xPos = cx + sx * (w * 0.5 - wallT * 0.5);
      for (const sz of [-1, 1]) {
        const sArch = remapRelief(
          createPointedArchBayGeometry(bayD, h, wallT, bayD * 0.58, h * 0.76),
          'thapRuaMossyStucco'
        );
        sArch.rotateY(Math.PI * 0.5);
        sArch.translate(xPos, ty, cz + sz * (bayD * 0.5));
        atlasParts.push(sArch);
      }
      for (const pz of [-d * 0.48, 0, d * 0.48]) {
        atlasParts.push(
          makeReliefBox(0.14, h, 0.24, 'thapRuaOchrePebble', xPos + sx * (wallT * 0.5 + 0.04), ty + h * 0.5, cz + pz)
        );
      }
    }
  };

  // TIER 1
  const t1Y = baseY + 0.78;
  const t1H = 2.65;
  addThapRuaArchedTier(t1Y, 6.2, 4.5, t1H, 0.44);
  // Multi-stepped cornice + ochre pebbled parapet around Tier 1 -> Tier 2 ledge
  const t1TopY = t1Y + t1H;
  atlasParts.push(
    makeReliefBox(6.65, 0.22, 4.95, 'thapRuaOchrePebble', cx, t1TopY + 0.11, cz),
    makeReliefBox(6.48, 0.14, 4.78, 'thapRuaMossyStucco', cx, t1TopY + 0.28, cz)
  );
  // Low pebbled parapet walls on Tier 1 roof ledge
  for (const sz of [-2.22, 2.22]) {
    atlasParts.push(makeReliefBox(6.35, 0.46, 0.20, 'thapRuaOchrePebble', cx, t1TopY + 0.56, cz + sz));
  }
  for (const sx of [-3.08, 3.08]) {
    atlasParts.push(makeReliefBox(0.20, 0.46, 4.64, 'thapRuaOchrePebble', cx + sx, t1TopY + 0.56, cz));
  }

  // TIER 2
  const t2Y = t1TopY + 0.35;
  const t2H = 2.25;
  addThapRuaArchedTier(t2Y, 5.0, 3.6, t2H, 0.38);
  const t2TopY = t2Y + t2H;
  atlasParts.push(
    makeReliefBox(5.42, 0.20, 4.02, 'thapRuaOchrePebble', cx, t2TopY + 0.10, cz)
  );
  // Pierced spindle balustrade on Tier 2 -> Tier 3 ledge (TR-14)
  for (const sz of [-1.84, 1.84]) {
    atlasParts.push(makeReliefBox(5.16, 0.09, 0.14, 'thapRuaOchrePebble', cx, t2TopY + 0.58, cz + sz));
    for (let px = -2.4; px <= 2.41; px += 0.30) {
      atlasParts.push(makeReliefBox(0.08, 0.38, 0.08, 'thapRuaMossyStucco', cx + px, t2TopY + 0.36, cz + sz));
    }
  }
  for (const sx of [-2.52, 2.52]) {
    atlasParts.push(makeReliefBox(0.14, 0.09, 3.76, 'thapRuaOchrePebble', cx + sx, t2TopY + 0.58, cz));
    for (let pz = -1.6; pz <= 1.61; pz += 0.32) {
      atlasParts.push(makeReliefBox(0.08, 0.38, 0.08, 'thapRuaMossyStucco', cx + sx, t2TopY + 0.36, cz + pz));
    }
  }

  // TIER 3 (Solid weathered mossy stucco with recessed "龜 塔" plaque on long sides & circular emblem on short sides!)
  const t3Y = t2TopY + 0.20;
  const t3H = 1.65;
  atlasParts.push(
    makeReliefBox(3.75, t3H, 2.68, 'thapRuaMossyStucco', cx, t3Y + t3H * 0.5, cz),
    // Recessed "龜 塔" calligraphic plaques on South (+Z) & North (-Z) long sides
    makeReliefBox(1.52, 0.72, 0.10, 'thapRuaOchrePebble', cx, t3Y + t3H * 0.52, cz + 1.35),
    makeArtPlane(1.38, 0.58, 'thapRuaPlaque', cx, t3Y + t3H * 0.52, cz + 1.41, 0),
    makeReliefBox(1.52, 0.72, 0.10, 'thapRuaOchrePebble', cx, t3Y + t3H * 0.52, cz - 1.35),
    makeArtPlane(1.38, 0.58, 'thapRuaPlaque', cx, t3Y + t3H * 0.52, cz - 1.41, Math.PI),
    // Short-side circular relief medallions (East & West)
    makeReliefCyl(0.36, 0.36, 0.10, 16, 'thapRuaOchrePebble', cx - 1.89, t3Y + t3H * 0.52, cz, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.36, 0.36, 0.10, 16, 'thapRuaOchrePebble', cx + 1.89, t3Y + t3H * 0.52, cz, 0, 0, Math.PI * 0.5)
  );

  // TIER 3 CURVED MOSSY CLAY-TILE LOWER EAVE + SOLIDLY ANCHORED TIER 4 CROWN & ROOF (ZERO floating horns!)
  const t3RoofY = t3Y + t3H;
  addVietnameseRoofWithSoffit(
    atlasParts,
    cx,
    t3RoofY,
    cz,
    4.65,
    3.58,
    2.45,
    1.72,
    0.88,
    0.34,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  // Tier 4 lantern box anchored SOLIDLY inside Tier 3 roof crown (overlapping by 0.22m!)
  const t4Y = t3RoofY + 0.66;
  const t4H = 0.92;
  atlasParts.push(
    makeReliefBox(2.25, t4H, 1.56, 'thapRuaMossyStucco', cx, t4Y + t4H * 0.5, cz),
    makeReliefBox(2.42, 0.14, 1.72, 'thapRuaOchrePebble', cx, t4Y + t4H, cz)
  );
  // Tier 4 curved hipped roof + 4 hip-ridge corner dragons + central gourd finial (bầu hồ lô)
  const t4RoofY = t4Y + t4H + 0.04;
  addVietnameseRoofWithSoffit(
    atlasParts,
    cx,
    t4RoofY,
    cz,
    3.08,
    2.36,
    0.68,
    0.32,
    0.96,
    0.30,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  // 4 sculpted corner hip-ridge scrolls resting firmly on Tier 4 roof corners
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(0.14, 0.24, 0.42, 'thapRuaOchrePebble', cx + sx * 1.32, t4RoofY + 0.20, cz + sz * 0.98, Math.atan2(sx, sz), -0.35)
      );
    }
  }
  // Central gourd finial (bầu hồ lô) crowning Tháp Rùa
  atlasParts.push(
    makeReliefCyl(0.18, 0.24, 0.22, 12, 'thapRuaOchrePebble', cx, t4RoofY + 1.06, cz),
    makeReliefCyl(0.10, 0.18, 0.26, 12, 'thapRuaOchrePebble', cx, t4RoofY + 1.28, cz),
    makeReliefCyl(0.03, 0.11, 0.28, 10, 'thapRuaOchrePebble', cx, t4RoofY + 1.52, cz)
  );

  // --------------------------------------------------------------------------
  // 3. CẦU THÊ HÚC — VIBRANT VERMILION-SCARLET CURVED WOODEN BRIDGE (TH-01..TH-08)
  // Spanning x = 80.5 (Đảo Ngọc / Đắc Nguyệt Lâu) to x = 100.5 (East shore) along z = 3.0
  // --------------------------------------------------------------------------
  const ngocZ = 3.0;
  const brStartX = 81.2;
  const brEndX = 100.4;
  const brLen = brEndX - brStartX;
  const brW = 2.65;
  const spans = 15; // Authentic 15 pairs of splayed round vermilion piles!
  const deckBaseY = VIETNAM_WATER_LEVEL + 1.35;
  const archRise = 1.65;

  const getBridgeY = (t: number) => deckBaseY + Math.sin(t * Math.PI) * archRise;

  // Dressed-stone abutments + cascading yellow-flower planter boxes at both ends
  for (const ax of [brStartX - 0.55, brEndX + 0.55]) {
    atlasParts.push(
      makeReliefBox(1.4, 2.3, brW + 0.8, 'monolithicStoneDrum', ax, VIETNAM_WATER_LEVEL + 0.25, ngocZ)
    );
    for (const sz of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(1.1, 0.55, 0.55, 'monolithicStoneDrum', ax, deckBaseY + 0.22, ngocZ + sz * (brW * 0.5 + 0.35)),
        makeReliefBox(0.96, 0.24, 0.42, 'lushIsletGrass', ax, deckBaseY + 0.56, ngocZ + sz * (brW * 0.5 + 0.35))
      );
      // Warm golden flower cluster accent
      const fl = new THREE.SphereGeometry(0.18, 8, 6);
      fl.scale(2.2, 0.8, 1.0);
      fl.translate(ax, deckBaseY + 0.72, ngocZ + sz * (brW * 0.5 + 0.35));
      goldParts.push(fl);
    }
  }

  // 15 pairs of outward-splayed round vermilion piles + crossbeams + curved arch girders + dark plank deck + X-braced railings + warm bulb string
  for (let i = 0; i <= spans; i++) {
    const t = i / spans;
    const x = brStartX + t * brLen;
    const y = getBridgeY(t);
    const pileH = y - (VIETNAM_WATER_LEVEL - 1.2);

    // Outward-splayed round vermilion piles + transverse cap beam
    for (const sz of [-1, 1]) {
      atlasParts.push(
        makeReliefCyl(0.10, 0.12, pileH, 10, 'vermilionBridgeWood', x, y - pileH * 0.5 - 0.08, ngocZ + sz * (brW * 0.48), 0, sz * 0.09, 0)
      );
    }
    atlasParts.push(
      makeReliefBox(0.20, 0.20, brW + 0.45, 'vermilionBridgeWood', x, y - 0.14, ngocZ)
    );

    if (i < spans) {
      const tNext = (i + 1) / spans;
      const xNext = brStartX + tNext * brLen;
      const yNext = getBridgeY(tNext);
      const segDx = xNext - x;
      const segDy = yNext - y;
      const segLen = Math.hypot(segDx, segDy);
      const slope = Math.atan2(segDy, segDx);
      const mx = (x + xNext) * 0.5;
      const my = (y + yNext) * 0.5;

      // Dark transverse plank deck
      atlasParts.push(
        makeReliefBox(segLen + 0.04, 0.14, brW, 'agedIronwood', mx, my, ngocZ, 0, 0, slope)
      );

      // Curved vermilion arch fascia girders + low authentic railing (top rail, bottom curb, posts, X-bracing, spindles) + warm bulb
      for (const sz of [-1, 1]) {
        const rz = ngocZ + sz * (brW * 0.5 - 0.06);
        atlasParts.push(
          // Lower curved arch fascia girder
          makeReliefBox(segLen + 0.06, 0.24, 0.14, 'vermilionBridgeWood', mx, my - 0.12, rz, 0, 0, slope),
          // Top handrail (authentic low 0.78m height)
          makeReliefBox(segLen + 0.05, 0.09, 0.10, 'vermilionBridgeWood', mx, my + 0.76, rz, 0, 0, slope),
          // Mid rail
          makeReliefBox(segLen + 0.05, 0.06, 0.08, 'vermilionBridgeWood', mx, my + 0.42, rz, 0, 0, slope),
          // Vertical railing post
          makeReliefBox(0.09, 0.84, 0.09, 'vermilionBridgeWood', x, y + 0.40, rz),
          // Authentic X-brace crossbars inside railing bay
          makeReliefBox(segLen * 0.92, 0.05, 0.05, 'vermilionBridgeWood', mx, my + 0.40, rz, 0, 0, slope + 0.48),
          makeReliefBox(segLen * 0.92, 0.05, 0.05, 'vermilionBridgeWood', mx, my + 0.40, rz, 0, 0, slope - 0.48)
        );
        // Warm golden bulb string along lower arch fascia
        const bulb = new THREE.SphereGeometry(0.065, 8, 6);
        bulb.translate(mx, my - 0.26, rz + sz * 0.06);
        warmGlowParts.push(bulb);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. ĐẮC NGUYỆT LÂU — COMMANDING 2-TIER MOON-GAZING GATE ON-AXIS AT (79.8, 3.0) (TH-09..TH-14)
  // --------------------------------------------------------------------------
  const ngocY = Math.max(VIETNAM_WATER_LEVEL + 0.85, ctx.getHeight(76.5, ngocZ));
  const dnlX = 79.8;
  // Lower arched masonry gatehouse (East-West passage aligned cleanly with Cầu Thê Húc!)
  const dnlArch = remapRelief(
    createArchedWallGeometry(4.4, 3.55, 2.2, 2.15, 2.65),
    'weatheredLimeStucco'
  );
  dnlArch.rotateY(Math.PI * 0.5);
  dnlArch.translate(dnlX, ngocY, ngocZ);
  atlasParts.push(dnlArch);
  // Couplets flanking the East archway (facing Cầu Thê Húc)
  for (const sz of [-1.42, 1.42]) {
    atlasParts.push(
      makeReliefBox(0.08, 1.85, 0.34, 'tamBaoGoldLacquer', dnlX + 1.12, ngocY + 1.55, ngocZ + sz),
      makeArtPlane(0.30, 1.75, 'cauDoiPair', dnlX + 1.18, ngocY + 1.55, ngocZ + sz, Math.PI * 0.5, 0, true)
    );
  }
  // Lower opaque curved dark mossy roof
  const dnlRoof1Y = ngocY + 3.52;
  addVietnameseRoofWithSoffit(
    atlasParts,
    dnlX,
    dnlRoof1Y,
    ngocZ,
    4.6,
    6.4,
    2.7,
    4.1,
    1.15,
    0.45,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  // Upper pavilion with pale turquoise dragon/cloud relief panel anchored snugly onto lower roof + circular Moon Oculus + "得 月 樓" plaque!
  const dnlUpperY = dnlRoof1Y + 0.92;
  atlasParts.push(
    makeReliefBox(2.55, 1.85, 3.9, 'dacNguyetTurquoise', dnlX, dnlUpperY + 0.92, ngocZ),
    // Circular moon oculus recessed ring on East, West & South faces
    makeReliefCyl(0.56, 0.56, 0.14, 18, 'darkTimberSoffit', dnlX + 1.26, dnlUpperY + 0.88, ngocZ, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.56, 0.56, 0.14, 18, 'darkTimberSoffit', dnlX - 1.26, dnlUpperY + 0.88, ngocZ, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.48, 0.48, 0.14, 18, 'darkTimberSoffit', dnlX, dnlUpperY + 0.80, ngocZ + 1.94, 0, Math.PI * 0.5, 0),
    // Crimson-gold "得 月 樓" plaques on East (bridge arrival) & South (camera 05 view)
    makeReliefBox(0.10, 0.52, 1.56, 'tamBaoGoldLacquer', dnlX + 1.30, dnlUpperY + 1.56, ngocZ),
    makeArtPlane(1.48, 0.44, 'dacNguyetLauPlaque', dnlX + 1.37, dnlUpperY + 1.56, ngocZ, Math.PI * 0.5),
    makeReliefBox(1.56, 0.52, 0.10, 'tamBaoGoldLacquer', dnlX, dnlUpperY + 1.56, ngocZ + 1.98),
    makeArtPlane(1.48, 0.44, 'dacNguyetLauPlaque', dnlX, dnlUpperY + 1.56, ngocZ + 2.04, 0)
  );
  // Upper opaque curved dark mossy roof + ridge finial
  const dnlRoof2Y = dnlUpperY + 1.82;
  addVietnameseRoofWithSoffit(
    atlasParts,
    dnlX,
    dnlRoof2Y,
    ngocZ,
    3.9,
    5.4,
    0.65,
    2.2,
    1.35,
    0.42,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  const dnlFin = createRoofFinialSetParts(dnlX, dnlRoof2Y + 1.57, ngocZ, 2.05, Math.PI * 0.5, 0.56, false);
  for (const p of dnlFin.mainParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  goldParts.push(...dnlFin.goldParts);

  // --------------------------------------------------------------------------
  // 5. TRẤN BA ĐÌNH — OPEN-AIR 4-SIDED WAVE-QUELLING PAVILION ON ĐẢO NGỌC (73.4, 3.0) (TH-15..TH-20)
  // Completely replaces the blank windowless white cube!
  // --------------------------------------------------------------------------
  const tbdX = 73.4;
  // Carved stone quay platform + stone balustrade + natural mossy shoreline revetment
  atlasParts.push(
    makeReliefBox(9.2, 1.65, 9.2, 'monolithicStoneDrum', tbdX, ngocY - 0.58, ngocZ),
    makeReliefBox(8.6, 0.14, 8.6, 'batTrangFloor', tbdX, ngocY + 0.28, ngocZ)
  );
  // Stone balustrade around Trấn Ba Đình quay (leaving East path to Đắc Nguyệt Lâu open)
  for (const sz of [-4.2, 4.2]) {
    atlasParts.push(makeReliefBox(8.4, 0.58, 0.22, 'monolithicStoneDrum', tbdX, ngocY + 0.62, ngocZ + sz));
  }
  atlasParts.push(makeReliefBox(0.22, 0.58, 8.4, 'monolithicStoneDrum', tbdX - 4.2, ngocY + 0.62, ngocZ));
  // Natural mossy shoreline boulders around Đảo Ngọc
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rx = tbdX + Math.cos(a) * 6.4;
    const rz = ngocZ + Math.sin(a) * 6.2;
    if (rx > 79.0 && Math.abs(rz - ngocZ) < 2.5) continue;
    const rock = remapRelief(
      createSculptedRockGeometry(4200 + i * 23, 1.15, 0.72, 1.05, 1),
      'monolithicStoneDrum'
    );
    rock.translate(rx, VIETNAM_WATER_LEVEL + 0.15, rz);
    atlasParts.push(rock);
  }

  // 8 outer + 4 inner crimson columns on stone lotus bases (OPEN-AIR on all 4 sides!)
  const tbdFloorY = ngocY + 0.35;
  const outerOff = [-2.85, 0, 2.85];
  for (const ox of outerOff) {
    for (const oz of outerOff) {
      if (ox === 0 && oz === 0) continue;
      atlasParts.push(
        makeReliefCyl(0.24, 0.28, 0.22, 10, 'monolithicStoneDrum', tbdX + ox, tbdFloorY + 0.11, ngocZ + oz),
        makeReliefCyl(0.14, 0.16, 3.15, 12, 'tamBaoGoldLacquer', tbdX + ox, tbdFloorY + 1.78, ngocZ + oz)
      );
    }
  }
  // 4 taller inner crimson columns supporting the upper pavilion tier
  for (const ix of [-1.45, 1.45]) {
    for (const iz of [-1.45, 1.45]) {
      atlasParts.push(
        makeReliefCyl(0.24, 0.28, 0.22, 10, 'monolithicStoneDrum', tbdX + ix, tbdFloorY + 0.11, ngocZ + iz),
        makeReliefCyl(0.15, 0.17, 4.95, 12, 'tamBaoGoldLacquer', tbdX + ix, tbdFloorY + 2.68, ngocZ + iz)
      );
    }
  }
  // Perimeter red-gold lintel beams + "鎮 波 亭" plaque on South & East faces
  for (const s of [-2.85, 2.85]) {
    atlasParts.push(
      makeReliefBox(5.9, 0.26, 0.22, 'tamBaoGoldLacquer', tbdX, tbdFloorY + 3.28, ngocZ + s),
      makeReliefBox(0.22, 0.26, 5.9, 'tamBaoGoldLacquer', tbdX + s, tbdFloorY + 3.28, ngocZ)
    );
  }
  atlasParts.push(
    makeReliefBox(1.85, 0.56, 0.10, 'tamBaoGoldLacquer', tbdX, tbdFloorY + 2.95, ngocZ + 2.95),
    makeArtPlane(1.75, 0.48, 'tranBaDinhPlaque', tbdX, tbdFloorY + 2.95, ngocZ + 3.02, 0),
    makeReliefBox(0.10, 0.56, 1.85, 'tamBaoGoldLacquer', tbdX + 2.95, tbdFloorY + 2.95, ngocZ),
    makeArtPlane(1.75, 0.48, 'tranBaDinhPlaque', tbdX + 3.02, tbdFloorY + 2.95, ngocZ, Math.PI * 0.5)
  );
  // 2-tier 8-eave curved dark mossy tiled roof + central gourd finial
  const tbdRoof1Y = tbdFloorY + 3.38;
  addVietnameseRoofWithSoffit(
    atlasParts,
    tbdX,
    tbdRoof1Y,
    ngocZ,
    7.8,
    7.8,
    3.6,
    3.6,
    1.45,
    0.65,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  const tbdRoof2Y = tbdRoof1Y + 1.55;
  addVietnameseRoofWithSoffit(
    atlasParts,
    tbdX,
    tbdRoof2Y,
    ngocZ,
    4.9,
    4.9,
    0.55,
    0.55,
    1.75,
    0.58,
    'ngoiMuiHaiMossy',
    'darkTimberSoffit'
  );
  // Central gilded gourd finial crowning Trấn Ba Đình
  const gourd = new THREE.CylinderGeometry(0.06, 0.22, 0.65, 12);
  gourd.translate(tbdX, tbdRoof2Y + 2.02, ngocZ);
  goldParts.push(gourd);

  // Bronze incense tripod between Đắc Nguyệt Lâu & Trấn Ba Đình
  const dnsTripod = createBronzeIncenseTripodParts(77.2, tbdFloorY + 0.02, ngocZ, 0.66);
  for (const p of dnsTripod.limestoneParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  bronzeParts.push(...dnsTripod.bronzeParts);
  goldParts.push(...dnsTripod.goldParts);

  // --------------------------------------------------------------------------
  // 6. THÁP BÚT (PEN TOWER) AT (102, 14) & ĐÀI NGHIÊN (INKSLAB ON 3 TOADS) AT (97.2, 12.2) (TH-21..TH-30)
  // --------------------------------------------------------------------------
  const butX = 102.0;
  const butZ = 14.0;
  const butY = ctx.getHeight(butX, butZ);

  // Paved lakeside stone promenade around Tháp Bút & Đài Nghiên
  addTiledFloor(atlasParts, 99.5, 13.5, 13.0, 11.5, butY + 0.06, 4, 4, 'monolithicStoneDrum');

  // Craggy mossy Núi Độc Tôn rockery mound supporting Tháp Bút
  for (let k = 0; k < 9; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rOff = k === 0 ? 0 : 1.85;
    const rock = remapRelief(
      createSculptedRockGeometry(5100 + k * 29, k === 0 ? 2.75 : 1.55, k === 0 ? 2.1 : 1.35, k === 0 ? 2.65 : 1.45, 2),
      'thapButSandstone'
    );
    rock.translate(butX + Math.cos(a) * rOff, butY + (k === 0 ? 1.15 : 0.62), butZ + Math.sin(a) * rOff);
    atlasParts.push(rock);
  }
  // Mossy turf accents nestled into Núi Độc Tôn rock crevices
  for (let m = 0; m < 5; m++) {
    const a = (m / 5) * Math.PI * 2 + 0.3;
    atlasParts.push(
      makeReliefCyl(0.55, 0.72, 0.22, 8, 'lushIsletGrass', butX + Math.cos(a) * 1.45, butY + 1.35, butZ + Math.sin(a) * 1.45)
    );
  }

  // 5-story tapering weathered sandstone Tháp Bút tower (total ~9.5m) + sharp calligraphy brush-tip apex
  let tierY = butY + 2.25;
  const tierSpecs = [
    { w: 1.62, h: 1.38 },
    { w: 1.38, h: 1.28 },
    { w: 1.16, h: 1.18 },
    { w: 0.96, h: 1.08 },
    { w: 0.78, h: 0.96 }
  ];
  for (let idx = 0; idx < tierSpecs.length; idx++) {
    const ts = tierSpecs[idx];
    atlasParts.push(
      makeReliefBox(ts.w, ts.h, ts.w, 'thapButSandstone', butX, tierY + ts.h * 0.5, butZ),
      makeReliefBox(ts.w + 0.22, 0.14, ts.w + 0.22, 'monolithicStoneDrum', butX, tierY + ts.h + 0.07, butZ)
    );
    tierY += ts.h + 0.14;
  }
  // Crisp vertical "寫 青 天" (Tả Thanh Thiên) cartouche spanning Tiers 2–4 on West (-X) & South (+Z) faces!
  const cartoucheY = butY + 5.25;
  atlasParts.push(
    makeReliefBox(0.10, 2.75, 0.62, 'thapButSandstone', butX - 0.64, cartoucheY, butZ),
    makeArtPlane(0.54, 2.62, 'taThanhThienCartouche', butX - 0.70, cartoucheY, butZ, -Math.PI * 0.5, 0, true),
    makeReliefBox(0.62, 2.75, 0.10, 'thapButSandstone', butX, cartoucheY, butZ + 0.64),
    makeArtPlane(0.54, 2.62, 'taThanhThienCartouche', butX, cartoucheY, butZ + 0.70, 0, 0, true)
  );
  // Sharp calligraphy brush-tip apex (Ngọn Bút) via LatheGeometry
  const nibPts = [
    new THREE.Vector2(0.32, 0.0),
    new THREE.Vector2(0.42, 0.36),
    new THREE.Vector2(0.36, 0.78),
    new THREE.Vector2(0.22, 1.30),
    new THREE.Vector2(0.09, 1.82),
    new THREE.Vector2(0.015, 2.25)
  ];
  const brushNib = remapRelief(new THREE.LatheGeometry(nibPts, 16), 'thapButSandstone');
  brushNib.translate(butX, tierY, butZ);
  atlasParts.push(brushNib);

  // ĐÀI NGHIÊN (Inkslab Gate) at (97.2, 12.2) — Masonry archway with couplets + hollowed half-peach dark stone inkslab on 3 sculpted stone toads (Ba Con Thiềm Thừ)!
  const dnX = 97.2;
  const dnZ = 12.2;
  const dnY = ctx.getHeight(dnX, dnZ);
  const dnArch = remapRelief(
    createArchedWallGeometry(3.4, 3.25, 1.05, 1.65, 2.25),
    'thapButSandstone'
  );
  dnArch.translate(dnX, dnY, dnZ);
  atlasParts.push(
    dnArch,
    makeReliefBox(3.75, 0.24, 1.35, 'monolithicStoneDrum', dnX, dnY + 3.36, dnZ)
  );
  // Couplets flanking Đài Nghiên archway (facing South/West camera 06!)
  for (const sx of [-1.22, 1.22]) {
    atlasParts.push(
      makeReliefBox(0.32, 1.95, 0.08, 'tamBaoGoldLacquer', dnX + sx, dnY + 1.55, dnZ + 0.56),
      makeArtPlane(0.28, 1.85, 'cauDoiPair', dnX + sx, dnY + 1.55, dnZ + 0.62, 0, 0, true)
    );
  }
  // 3 Sculpted Stone Toads (Ba Con Thiềm Thừ) supporting the hollowed half-peach dark stone Inkslab!
  const toadY = dnY + 3.66;
  for (let t = 0; t < 3; t++) {
    const a = (t / 3) * Math.PI * 2 + Math.PI * 0.5;
    const tx = dnX + Math.cos(a) * 0.58;
    const tz = dnZ + Math.sin(a) * 0.42;
    const toadBody = remapRelief(new THREE.SphereGeometry(0.28, 10, 8), 'monolithicStoneDrum');
    toadBody.scale(1.15, 0.72, 1.35);
    toadBody.rotateY(-a);
    toadBody.translate(tx, toadY, tz);
    const toadHead = remapRelief(new THREE.SphereGeometry(0.16, 8, 6), 'monolithicStoneDrum');
    toadHead.translate(tx + Math.cos(a) * 0.26, toadY + 0.08, tz + Math.sin(a) * 0.26);
    atlasParts.push(toadBody, toadHead);
  }
  // Unmistakable hollowed half-peach dark stone inkslab (Đài Nghiên) resting on the 3 toads
  const peachOuter = remapRelief(
    new THREE.SphereGeometry(0.76, 16, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58),
    'thapButSandstone'
  );
  peachOuter.scale(1.32, 0.68, 0.96);
  peachOuter.translate(dnX, dnY + 4.38, dnZ);
  const inkBasin = remapRelief(new THREE.CylinderGeometry(0.72, 0.62, 0.14, 16), 'darkTimberSoffit');
  inkBasin.scale(1.25, 1.0, 0.88);
  inkBasin.translate(dnX, dnY + 4.30, dnZ);
  atlasParts.push(peachOuter, inkBasin);

  // --------------------------------------------------------------------------
  // 7. WEEPING WILLOWS & LUSH LỘC VỪNG CANOPY TREES AROUND HỒ HOÀN KIẾM (TR-31, TH-31..32)
  // --------------------------------------------------------------------------
  const willowSpots: Array<[number, number, number, number, boolean]> = [
    [46.8, 16.2, 0.85, 601, true],   // Weeping willow framing Gò Rùa back-west edge (unobstructed Tháp Rùa!)
    [59.8, 18.2, 0.86, 602, true],   // Weeping willow framing Gò Rùa back-east edge
    [68.0, -7.2, 1.12, 603, false],  // Lush Lộc Vừng north of Đền Ngọc Sơn (>= 4.5m clear of roofs!)
    [77.5, -5.8, 1.18, 604, false],  // Leaning Lộc Vừng behind Đắc Nguyệt Lâu
    [115.5, 3.0, 1.15, 605, false],  // Lush backdrop canopy behind Water Puppet Pavilion (clear of shophouses!)
    [90.2, 15.8, 0.98, 606, true],   // Weeping willow left of promenade (leaves Đài Nghiên & 3 toads 100% clear!)
    [116.5, 18.5, 1.22, 607, false]  // Backdrop canopy behind shifted Old Quarter shophouses
  ];
  for (const [tx, tz, ts, tSeed, isWillow] of willowSpots) {
    const ty = Math.max(VIETNAM_WATER_LEVEL + 0.18, ctx.getHeight(tx, tz));
    addFoliageCanopy(
      barkParts,
      leafParts,
      tx,
      ty,
      tz,
      ts,
      tSeed,
      isWillow ? [0x4c8e38, 0x5ea144, 0x3a732b] : [0x2a6626, 0x387c32, 0x22541e],
      isWillow
    );
  }

  // --------------------------------------------------------------------------
  // 8. HỒ HOÀN KIẾM & THÁP RÙA QC EXPANSIONS (Items 026..050)
  // --------------------------------------------------------------------------
  // 027-028. Wrought-iron Gothic lancet window grilles & weathered brick dentil cornice bands seated flush on Tháp Rùa Tiers 1 & 2
  const trTierSpecs = [
    { y: t1Y, w: 6.15, halfD: 2.26, grilleZ: 2.08, grilleSpan: 1.75, corniceH: 2.15 },
    { y: t2Y, w: 4.95, halfD: 1.82, grilleZ: 1.66, grilleSpan: 1.42, corniceH: 1.82 }
  ];
  for (const ts of trTierSpecs) {
    for (const sz of [-1, 1]) {
      atlasParts.push(makeReliefBox(ts.w, 0.14, 0.18, 'thapRuaOchrePebble', cx, ts.y + ts.corniceH, cz + sz * ts.halfD));
      for (const gx of [-ts.grilleSpan, 0, ts.grilleSpan]) {
        bronzeParts.push(new THREE.BoxGeometry(0.04, 1.25, 0.04).translate(cx + gx, ts.y + 0.95, cz + sz * ts.grilleZ));
      }
    }
  }

  // 029-031. Mossy stone boat-landing steps on East Gò Rùa, lakeside sedge tufts & Golden Turtle marker
  for (let st = 0; st < 3; st++) {
    atlasParts.push(
      makeReliefBox(0.55, 0.22, 1.65, 'monolithicStoneDrum', cx + 8.6 + st * 0.45, VIETNAM_WATER_LEVEL + 0.55 - st * 0.18, cz)
    );
  }
  for (let rIdx = 0; rIdx < 12; rIdx++) {
    const ra = (rIdx / 12) * Math.PI * 2 + 0.25;
    const rx = cx + Math.cos(ra) * 9.8;
    const rz = cz + Math.sin(ra) * 9.8;
    const reed = new THREE.ConeGeometry(0.24, 0.85, 5);
    reed.translate(rx, VIETNAM_WATER_LEVEL + 0.42, rz);
    colorizeGeo(reed, 0x3b7834);
    leafParts.push(reed);
  }
  bronzeParts.push(new THREE.SphereGeometry(0.32, 8, 6).scale(1.3, 0.45, 1.0).translate(92.5, ctx.getHeight(92.5, 19.5) + 0.24, 19.5));

  // 032-036. Expanded Đền Ngọc Sơn sanctuary hall (66.0, 3.0) west of Trấn Ba Đình + Đảo Ngọc props
  const ngocSanctX = 65.5;
  const ngocSanctY = Math.max(ngocY, ctx.getHeight(ngocSanctX, 3.0));
  atlasParts.push(makeReliefBox(6.8, 1.92, 7.6, 'monolithicStoneDrum', ngocSanctX, ngocSanctY - 0.54, 3.0));
  for (const px of [-2.8, 2.8]) {
    for (const pz of [-3.1, -1.0, 1.0, 3.1]) {
      atlasParts.push(makeReliefCyl(0.13, 0.15, 3.1, 8, 'tamBaoGoldLacquer', ngocSanctX + px, ngocSanctY + 1.97, 3.0 + pz));
    }
  }
  atlasParts.push(
    makeReliefBox(5.6, 2.8, 0.36, 'thapRuaOchrePebble', ngocSanctX - 2.6, ngocSanctY + 1.82, 3.0, Math.PI * 0.5),
    makeReliefBox(0.10, 0.58, 2.4, 'tamBaoGoldLacquer', ngocSanctX + 2.86, ngocSanctY + 3.15, 3.0),
    makeArtPlane(2.2, 0.48, 'dacNguyetLauPlaque', ngocSanctX + 2.94, ngocSanctY + 3.15, 3.0, Math.PI * 0.5)
  );
  addVietnameseRoofWithSoffit(atlasParts, ngocSanctX, ngocSanctY + 3.52, 3.0, 7.8, 8.6, 2.2, 4.2, 1.85, 0.55);
  const nsBurner = createBronzeIncenseTripodParts(69.8, ngocSanctY + 0.04, 3.0, 0.58);
  for (const p of nsBurner.limestoneParts) atlasParts.push(remapRelief(p, 'monolithicStoneDrum'));
  bronzeParts.push(...nsBurner.bronzeParts);
  goldParts.push(...nsBurner.goldParts);
  for (const lx of [70.8, 76.2]) {
    atlasParts.push(
      makeReliefBox(0.42, 0.78, 0.42, 'monolithicStoneDrum', lx, ngocSanctY + 0.39, 5.8),
      makeReliefBox(0.46, 0.14, 0.46, 'ngoiMuiHaiMossy', lx, ngocSanctY + 1.15, 5.8)
    );
    warmGlowParts.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(lx, ngocSanctY + 0.92, 5.8));
  }
  atlasParts.push(makeReliefBox(1.8, 0.42, 0.52, 'monolithicStoneDrum', 73.4, ngocSanctY + 0.21, 8.0));

  // 037-040. Nhà Bát Giác (Octagonal Lakeside Gazebo at 98, 23.5) + Bến Thuyền Boat Dock & 2 Skiffs (90.5, 19.5)
  const gazX = 98.0;
  const gazZ = 23.5;
  const gazY = ctx.getHeight(gazX, gazZ);
  atlasParts.push(makeReliefCyl(3.3, 3.5, 0.36, 8, 'monolithicStoneDrum', gazX, gazY + 0.18, gazZ));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    atlasParts.push(makeReliefCyl(0.10, 0.12, 2.75, 6, 'agedIronwood', gazX + Math.cos(a) * 2.65, gazY + 1.72, gazZ + Math.sin(a) * 2.65));
  }
  addVietnameseRoofWithSoffit(atlasParts, gazX, gazY + 3.08, gazZ, 6.4, 6.4, 2.4, 2.4, 1.35, 0.48);
  addVietnameseRoofWithSoffit(atlasParts, gazX, gazY + 4.35, gazZ, 3.6, 3.6, 0.4, 0.4, 1.15, 0.36);

  // Wooden boat dock & 2 moored wooden skiffs
  const dockX = 90.5;
  const dockZ = 19.5;
  const dockY = VIETNAM_WATER_LEVEL + 0.36;
  atlasParts.push(
    makeReliefBox(4.8, 0.16, 2.2, 'agedIronwood', dockX - 1.2, dockY, dockZ),
    makeReliefCyl(0.10, 0.10, 1.2, 6, 'agedIronwood', dockX - 3.3, dockY - 0.1, dockZ - 0.9),
    makeReliefCyl(0.10, 0.10, 1.2, 6, 'agedIronwood', dockX - 3.3, dockY - 0.1, dockZ + 0.9)
  );
  for (const bzOff of [-1.85, 1.85]) {
    atlasParts.push(makeReliefBox(3.6, 0.36, 0.95, 'agedIronwood', dockX - 1.6, VIETNAM_WATER_LEVEL + 0.12, dockZ + bzOff, 0.12));
  }

  // 041-046. East lakeside promenade curb, cast-iron twin-globe streetlamps, Tháp Bút terrace balustrade, Đài Nghiên brush-rest, Cầu Thê Húc planters
  for (let i = 0; i < 5; i++) {
    const lz = 6.5 + i * 4.5;
    const lx = 94.2;
    const ly = ctx.getHeight(lx, lz);
    atlasParts.push(makeReliefBox(0.32, 0.48, 4.4, 'monolithicStoneDrum', lx, ly + 0.24, lz));
    if (i % 2 === 0) {
      bronzeParts.push(new THREE.CylinderGeometry(0.06, 0.12, 3.2, 8).translate(lx + 0.35, ly + 1.6, lz));
      warmGlowParts.push(
        new THREE.SphereGeometry(0.18, 8, 6).translate(lx + 0.35, ly + 3.25, lz - 0.26),
        new THREE.SphereGeometry(0.18, 8, 6).translate(lx + 0.35, ly + 3.25, lz + 0.26)
      );
    }
  }
  // Tháp Bút approach terrace steps & dedication plinth
  atlasParts.push(
    makeReliefBox(4.2, 0.22, 1.6, 'monolithicStoneDrum', butX - 2.6, butY + 0.12, butZ + 3.2),
    makeReliefBox(0.95, 0.82, 0.48, 'monolithicStoneDrum', butX - 3.6, butY + 0.45, butZ + 1.2)
  );
  // Đài Nghiên bronze brush-rest & Cầu Thê Húc East shore entrance floral planters (on shore, not in lake!)
  bronzeParts.push(new THREE.BoxGeometry(0.65, 0.18, 0.22).translate(dnX, dnY + 0.42, dnZ + 1.15));
  for (const sz of [-1.8, 1.8]) {
    atlasParts.push(makeReliefCyl(0.32, 0.24, 0.42, 8, 'hoaChanhGreenTile', 101.6, ctx.getHeight(101.6, 3.0 + sz) + 0.21, 3.0 + sz));
  }

  // 047-050. Cầu Thê Húc underside iron tie-plates (following curved arch!), Đắc Nguyệt Lâu signboard trim, Phượng Vĩ accent tree & wayfinding post
  for (const bxOff of [-3.2, 0, 3.2]) {
    const tieX = 90.8 + bxOff;
    const tieT = clamp01((tieX - brStartX) / brLen);
    bronzeParts.push(new THREE.BoxGeometry(0.18, 0.12, 2.35).translate(tieX, getBridgeY(tieT) - 0.16, 3.0));
  }
  goldParts.push(new THREE.BoxGeometry(0.06, 0.14, 1.85).translate(80.95, ngocY + 3.35, 3.0));
  addFoliageCanopy(barkParts, leafParts, 115.5, ctx.getHeight(115.5, 25.5), 25.5, 0.92, 619, [0xd83b28, 0x2e6f2a, 0xe85a38]);
  const wfY = ctx.getHeight(95.0, 18.0);
  atlasParts.push(
    makeReliefCyl(0.08, 0.10, 2.15, 6, 'agedIronwood', 95.0, wfY + 1.08, 18.0),
    makeReliefBox(0.75, 0.28, 0.08, 'tamBaoGoldLacquer', 95.0, wfY + 1.95, 18.0)
  );

  // Merge all static batches
  const foliageMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    : ctx.materials.stone;
  const glowMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#fff0b8',
        emissive: '#ffaa33',
        emissiveIntensity: 2.5,
        roughness: 0.25
      })
    : ctx.materials.gold;

  const atlasMesh = createMergedMesh('HoanKiemAtlasMesh', atlasParts, pack.hanoiIconsMasterAtlasMat, true, true);
  if (atlasMesh) group.add(atlasMesh);
  const goldMesh = createMergedMesh('HoanKiemGoldMesh', goldParts, ctx.materials.gold, true, true);
  if (goldMesh) group.add(goldMesh);
  const bronzeMesh = createMergedMesh('HoanKiemBronzeMesh', bronzeParts, ctx.materials.bronze, true, true);
  if (bronzeMesh) group.add(bronzeMesh);
  const barkMesh = createMergedMesh('HoanKiemBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (barkMesh) group.add(barkMesh);
  const leafMesh = createMergedMesh('HoanKiemLeafMesh', leafParts, foliageMat, true, false);
  if (leafMesh) group.add(leafMesh);
  const glowMesh = createMergedMesh('HoanKiemGlowMesh', warmGlowParts, glowMat, false, false);
  if (glowMesh) group.add(glowMesh);

  // --------------------------------------------------------------------------
  // 9. HỒ HOÀN KIẾM & ĐẢO NGỌC WAVE 2 REAL-WORLD DETAILS (Items 226..250)
  // Low-poly batched meshes (castShadow = false, 0 new materials)
  // --------------------------------------------------------------------------
  const hkW2Atlas: THREE.BufferGeometry[] = [];
  const hkW2Gold: THREE.BufferGeometry[] = [];
  const hkW2Bronze: THREE.BufferGeometry[] = [];
  const hkW2Glow: THREE.BufferGeometry[] = [];

  // 226-228. Lakeside Ông Đồ calligraphy stall, Hanoi sidewalk iced-tea stall (Quán Trà Đá) & vintage flower-vendor bicycle
  const odY = ctx.getHeight(96.5, 16.0);
  hkW2Atlas.push(
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 95.5, odY + 1.12, 15.0),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 97.5, odY + 1.12, 15.0),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 95.5, odY + 1.12, 17.0),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 97.5, odY + 1.12, 17.0),
    makeReliefBox(2.4, 0.18, 2.4, 'tamBaoGoldLacquer', 96.5, odY + 2.30, 16.0),
    makeReliefBox(1.45, 0.58, 0.68, 'agedIronwood', 96.5, odY + 0.29, 16.0),
    makeReliefBox(0.06, 1.15, 0.28, 'tamBaoGoldLacquer', 95.55, odY + 1.55, 15.6),
    makeReliefBox(0.06, 1.15, 0.28, 'tamBaoGoldLacquer', 95.55, odY + 1.55, 16.4)
  );
  const tdY = ctx.getHeight(96.2, 20.5);
  hkW2Atlas.push(
    makeReliefBox(0.85, 0.45, 0.62, 'agedIronwood', 96.2, tdY + 0.22, 20.5),
    makeReliefBox(0.28, 0.26, 0.28, 'hoaChanhGreenTile', 95.5, tdY + 0.13, 20.5),
    makeReliefBox(0.28, 0.26, 0.28, 'hoaChanhGreenTile', 96.9, tdY + 0.13, 20.5),
    makeReliefBox(0.28, 0.26, 0.28, 'hoaChanhGreenTile', 96.2, tdY + 0.13, 21.15)
  );
  const bikeY = ctx.getHeight(94.8, 10.5);
  hkW2Bronze.push(
    new THREE.CylinderGeometry(0.32, 0.32, 0.06, 6).rotateZ(Math.PI * 0.5).translate(94.8, bikeY + 0.34, 10.0),
    new THREE.CylinderGeometry(0.32, 0.32, 0.06, 6).rotateZ(Math.PI * 0.5).translate(94.8, bikeY + 0.34, 11.1),
    new THREE.BoxGeometry(0.08, 0.42, 1.15).translate(94.8, bikeY + 0.56, 10.55)
  );
  hkW2Gold.push(new THREE.BoxGeometry(0.55, 0.36, 0.62).translate(94.8, bikeY + 0.85, 10.05));

  // 229-230. French-colonial cast-iron electrical kiosk & heritage yellow-stucco Đền Ngọc Sơn ticket kiosk
  const elY = ctx.getHeight(96.0, 7.2);
  hkW2Bronze.push(
    new THREE.BoxGeometry(0.75, 1.45, 0.52).translate(96.0, elY + 0.72, 7.2),
    new THREE.ConeGeometry(0.52, 0.32, 4).rotateY(Math.PI * 0.25).translate(96.0, elY + 1.60, 7.2)
  );
  const tkY = ctx.getHeight(93.8, 5.8);
  hkW2Atlas.push(
    makeReliefBox(2.2, 2.35, 1.85, 'thapRuaOchrePebble', 93.8, tkY + 1.18, 5.8),
    makeReliefBox(2.6, 0.32, 2.25, 'ngoiMuiHaiMossy', 93.8, tkY + 2.48, 5.8),
    makeReliefBox(1.15, 0.78, 0.10, 'darkTimberSoffit', 93.8, tkY + 1.35, 4.86)
  );

  // 231-234. Đền Ngọc Sơn stone guardian lions, Trần Hưng Đạo sanctuary altar, Bát Bửu racks & compact Đảo Ngọc bell stand
  for (const side of [-1, 1]) {
    hkW2Atlas.push(
      makeReliefBox(0.52, 0.42, 0.65, 'monolithicStoneDrum', 69.0, ngocSanctY + 0.21, 3.0 + side * 2.15),
      makeReliefBox(0.36, 0.54, 0.46, 'monolithicStoneDrum', 69.0, ngocSanctY + 0.68, 3.0 + side * 2.15)
    );
    hkW2Bronze.push(
      new THREE.CylinderGeometry(0.03, 0.04, 1.85, 5).translate(66.4, ngocSanctY + 1.35, 3.0 + side * 1.45),
      new THREE.CylinderGeometry(0.03, 0.04, 1.85, 5).translate(66.4, ngocSanctY + 1.35, 3.0 + side * 1.85)
    );
  }
  hkW2Atlas.push(makeReliefBox(1.15, 0.96, 2.6, 'tamBaoGoldLacquer', 64.2, ngocSanctY + 0.90, 3.0));
  hkW2Gold.push(new THREE.BoxGeometry(0.18, 1.15, 0.52).translate(63.85, ngocSanctY + 1.85, 3.0));
  const dnBellY = ctx.getHeight(71.5, -1.2);
  hkW2Atlas.push(
    makeReliefBox(0.14, 2.2, 0.14, 'agedIronwood', 70.7, dnBellY + 1.1, -1.2),
    makeReliefBox(0.14, 2.2, 0.14, 'agedIronwood', 72.3, dnBellY + 1.1, -1.2),
    makeReliefBox(2.0, 0.18, 0.22, 'agedIronwood', 71.5, dnBellY + 2.22, -1.2),
    makeReliefBox(2.2, 0.24, 1.05, 'ngoiMuiHaiMossy', 71.5, dnBellY + 2.45, -1.2)
  );
  hkW2Bronze.push(new THREE.CylinderGeometry(0.24, 0.34, 0.78, 6).translate(71.5, dnBellY + 1.55, -1.2));

  // 235-238. Nguyễn Văn Siêu 1865 stele beside Tháp Bút, 4 brass Tháp Rùa uplight bollards, stone mooring posts & boat-dock awning
  hkW2Atlas.push(
    makeReliefBox(1.05, 0.28, 0.58, 'monolithicStoneDrum', butX - 3.2, butY + 0.14, butZ - 1.8),
    makeReliefBox(0.76, 1.42, 0.18, 'thapButSandstone', butX - 3.2, butY + 0.98, butZ - 1.8)
  );
  for (const sx of [-4.2, 4.2]) {
    for (const sz of [-3.4, 3.4]) {
      hkW2Bronze.push(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 5).translate(cx + sx, baseY + 0.21, cz + sz));
      hkW2Glow.push(new THREE.BoxGeometry(0.10, 0.10, 0.10).translate(cx + sx, baseY + 0.46, cz + sz));
    }
  }
  for (const dz of [-0.95, 0.95]) {
    hkW2Atlas.push(
      makeReliefCyl(0.12, 0.14, 0.65, 5, 'monolithicStoneDrum', dockX + 0.8, dockY + 0.28, dockZ + dz),
      makeReliefBox(0.12, 2.25, 0.12, 'agedIronwood', dockX - 0.8, dockY + 1.12, dockZ + dz),
      makeReliefBox(0.12, 2.25, 0.12, 'agedIronwood', dockX - 2.6, dockY + 1.12, dockZ + dz)
    );
  }
  hkW2Atlas.push(makeReliefBox(2.4, 0.16, 2.35, 'ngoiMuiHaiMossy', dockX - 1.7, dockY + 2.30, dockZ));

  // 239-242. 4 lakeside granite benches, Nhà Bát Giác terracotta floral urns, Chinese-chess stone table & vintage clock pillar
  for (const bz of [8.5, 13.5, 18.5, 23.5]) {
    const by = ctx.getHeight(95.4, bz);
    hkW2Atlas.push(
      makeReliefBox(0.48, 0.12, 1.65, 'monolithicStoneDrum', 95.4, by + 0.42, bz),
      makeReliefBox(0.42, 0.38, 0.16, 'monolithicStoneDrum', 95.4, by + 0.19, bz - 0.62),
      makeReliefBox(0.42, 0.38, 0.16, 'monolithicStoneDrum', 95.4, by + 0.19, bz + 0.62)
    );
  }
  for (let u = 0; u < 4; u++) {
    const ua = (u / 4) * Math.PI * 2 + Math.PI * 0.25;
    hkW2Atlas.push(makeReliefCyl(0.28, 0.20, 0.42, 6, 'hoaChanhGreenTile', gazX + Math.cos(ua) * 3.1, gazY + 0.56, gazZ + Math.sin(ua) * 3.1));
  }
  const chY = ctx.getHeight(102.2, 24.5);
  hkW2Atlas.push(
    makeReliefCyl(0.55, 0.32, 0.68, 6, 'monolithicStoneDrum', 102.2, chY + 0.34, 24.5),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', 101.2, chY + 0.19, 24.5),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', 103.2, chY + 0.19, 24.5)
  );
  const clY = ctx.getHeight(96.8, 13.8);
  hkW2Bronze.push(
    new THREE.CylinderGeometry(0.14, 0.22, 2.85, 6).translate(96.8, clY + 1.42, 13.8),
    new THREE.BoxGeometry(0.55, 0.55, 0.24).translate(96.8, clY + 3.05, 13.8)
  );
  hkW2Glow.push(new THREE.BoxGeometry(0.38, 0.38, 0.28).translate(96.8, clY + 3.05, 13.8));

  // 243-250. Đắc Nguyệt Lâu stone parapet, Cầu Thê Húc red entrance lanterns (on grounded posts!), portrait-artist easels, Rùa Cổ plinth, leaning Lộc Vừng bough, drinking fountain, rose flowerbed & festival pennants
  for (const sz of [-2.2, 2.2]) {
    hkW2Atlas.push(makeReliefBox(1.8, 0.52, 0.22, 'monolithicStoneDrum', 78.2, ngocY + 0.26, ngocZ + sz));
    hkW2Atlas.push(
      makeReliefCyl(0.05, 0.07, 1.55, 6, 'agedIronwood', 100.8, deckBaseY + 0.72, ngocZ + sz * 0.72),
      makeReliefCyl(0.16, 0.16, 0.42, 6, 'tamBaoGoldLacquer', 100.8, deckBaseY + 1.58, ngocZ + sz * 0.72)
    );
    hkW2Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(100.8, deckBaseY + 1.58, ngocZ + sz * 0.72));
  }
  const eaY = ctx.getHeight(97.8, 18.8);
  for (const ez of [18.2, 19.6]) {
    hkW2Atlas.push(
      makeReliefBox(0.08, 1.45, 0.08, 'agedIronwood', 97.8, eaY + 0.72, ez),
      makeReliefBox(0.08, 0.72, 0.58, 'weatheredLimeStucco', 97.72, eaY + 1.05, ez)
    );
  }
  hkW2Atlas.push(makeReliefBox(1.25, 0.78, 0.85, 'monolithicStoneDrum', 67.2, ngocSanctY + 0.39, 1.4));
  hkW2Gold.push(new THREE.BoxGeometry(1.15, 0.12, 0.75).translate(67.2, ngocSanctY + 0.84, 1.4));
  hkW2Atlas.push(makeReliefCyl(0.12, 0.18, 2.8, 5, 'agedIronwood', 75.5, ngocY + 1.1, -1.8, 0, 0.55, 0.35));
  hkW2Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.95, 6).translate(95.8, ctx.getHeight(95.8, 11.8) + 0.48, 11.8));
  hkW2Atlas.push(
    makeReliefBox(2.6, 0.34, 1.4, 'batTrangFloor', 99.6, butY + 0.17, 9.2),
    makeReliefBox(2.3, 0.18, 1.1, 'lushIsletGrass', 99.6, butY + 0.38, 9.2)
  );
  for (const sz of [-2.4, 2.4]) {
    const py = ctx.getHeight(102.5, ngocZ + sz);
    hkW2Atlas.push(makeReliefCyl(0.04, 0.05, 3.2, 5, 'agedIronwood', 102.5, py + 1.6, ngocZ + sz));
    hkW2Gold.push(new THREE.ConeGeometry(0.24, 0.95, 4).translate(102.5, py + 2.65, ngocZ + sz));
  }

  // --------------------------------------------------------------------------
  // 9B. HỒ HOÀN KIẾM, ĐẢO NGỌC & OLD QUARTER EDGE WAVE 3 DETAILS (Items 451..500)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // --------------------------------------------------------------------------
  const hkW3Atlas: THREE.BufferGeometry[] = [];
  const hkW3Gold: THREE.BufferGeometry[] = [];
  const hkW3Bronze: THREE.BufferGeometry[] = [];
  const hkW3Glow: THREE.BufferGeometry[] = [];

  // 451-453. Nhà Hát Múa Rối Nước Thăng Long heritage pavilion (104.5, 1.5), marquee & water-puppet preview showcase
  const wpX = 104.5;
  const wpZ = 1.5;
  const wpY = ctx.getHeight(wpX, wpZ);
  hkW3Atlas.push(
    makeReliefBox(7.2, 0.65, 6.2, 'monolithicStoneDrum', wpX, wpY + 0.18, wpZ),
    makeReliefBox(6.4, 3.8, 5.4, 'thapRuaOchrePebble', wpX, wpY + 2.40, wpZ),
    makeReliefBox(7.8, 0.42, 6.8, 'ngoiMuiHaiMossy', wpX, wpY + 4.48, wpZ),
    makeReliefBox(5.2, 0.55, 4.2, 'ngoiMuiHaiMossy', wpX, wpY + 4.95, wpZ),
    makeReliefBox(0.18, 0.85, 3.6, 'tamBaoGoldLacquer', wpX - 3.30, wpY + 3.85, wpZ),
    // 453. Mini water-puppet preview basin & bamboo screen
    makeReliefBox(1.85, 0.42, 2.4, 'monolithicStoneDrum', wpX - 4.4, wpY + 0.21, wpZ),
    makeReliefBox(0.16, 1.35, 2.1, 'tamBaoGoldLacquer', wpX - 3.6, wpY + 1.05, wpZ)
  );
  hkW3Gold.push(new THREE.BoxGeometry(0.10, 0.52, 3.2).translate(wpX - 3.42, wpY + 3.85, wpZ));
  for (const pz of [-2.2, -0.8, 0.8, 2.2]) {
    hkW3Atlas.push(makeReliefCyl(0.13, 0.15, 3.95, 6, 'tamBaoGoldLacquer', wpX - 3.32, wpY + 2.30, wpZ + pz));
  }

  // 454-456. 3 Hanoi Old Quarter Đinh Tiên Hoàng shophouses (110.0, 8.5 / 13.5 / 18.5 — cleanly East of Tháp Bút rockery!) with balconies, corbels, shutters & signboards
  for (const shZ of [8.5, 13.5, 18.5]) {
    const shY = ctx.getHeight(110.0, shZ);
    hkW3Atlas.push(
      makeReliefBox(5.2, 5.6, 4.4, 'thapRuaOchrePebble', 110.0, shY + 2.80, shZ),
      makeReliefBox(5.8, 0.45, 4.8, 'ngoiMuiHaiMossy', 110.0, shY + 5.82, shZ),
      makeReliefBox(3.6, 0.55, 3.2, 'ngoiMuiHaiMossy', 110.0, shY + 6.30, shZ),
      // Projecting colonial balcony slab & corbel brackets tied into front wall (x = 107.4)
      makeReliefBox(0.95, 0.16, 3.8, 'monolithicStoneDrum', 107.02, shY + 3.05, shZ),
      makeReliefBox(0.55, 0.28, 0.18, 'monolithicStoneDrum', 107.20, shY + 2.86, shZ - 1.45),
      makeReliefBox(0.55, 0.28, 0.18, 'monolithicStoneDrum', 107.20, shY + 2.86, shZ + 1.45),
      makeReliefBox(0.14, 1.35, 0.95, 'hoaChanhGreenTile', 107.36, shY + 4.05, shZ - 1.05),
      makeReliefBox(0.14, 1.35, 0.95, 'hoaChanhGreenTile', 107.36, shY + 4.05, shZ + 1.05),
      // Striped awning & vintage signboard
      makeReliefBox(1.15, 0.14, 3.6, 'tamBaoGoldLacquer', 106.9, shY + 2.55, shZ, 0, 0, 0.25),
      makeReliefBox(0.12, 0.48, 2.4, 'agedIronwood', 107.35, shY + 2.88, shZ)
    );
    hkW3Bronze.push(new THREE.BoxGeometry(0.08, 0.78, 3.7).translate(106.62, shY + 3.50, shZ));
    // 458. Sidewalk low stools & tea tables along Old Quarter edge (clear of Tháp Bút rockery!)
    hkW3Atlas.push(
      makeReliefBox(0.65, 0.45, 0.65, 'agedIronwood', 106.6, shY + 0.22, shZ),
      makeReliefBox(0.28, 0.26, 0.28, 'hoaChanhGreenTile', 106.0, shY + 0.13, shZ - 0.45),
      makeReliefBox(0.28, 0.26, 0.28, 'hoaChanhGreenTile', 106.0, shY + 0.13, shZ + 0.45)
    );
  }

  // 457, 459-462, 465-468, 472-475. Kem Tràng Tiền kiosk, 2 vintage cyclos, Bánh Mì cart (with handle posts!), phone booth, mailbox, warden kiosk, map kiosk, newsstand, busker stage, bike rack, tai-chi pad, Old Quarter arch & flags
  const ktKioskY = ctx.getHeight(103.5, 26.5);
  hkW3Atlas.push(
    makeReliefBox(3.4, 2.55, 2.8, 'thapRuaOchrePebble', 103.5, ktKioskY + 1.28, 26.5),
    makeReliefBox(3.9, 0.34, 3.3, 'ngoiMuiHaiMossy', 103.5, ktKioskY + 2.70, 26.5),
    makeReliefBox(0.42, 0.92, 2.2, 'agedIronwood', 101.65, ktKioskY + 0.46, 26.5)
  );
  for (const cyZ of [11.2, 15.0]) {
    const cyY = ctx.getHeight(98.5, cyZ);
    hkW3Bronze.push(
      new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6).rotateZ(Math.PI * 0.5).translate(98.1, cyY + 0.34, cyZ - 0.35),
      new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6).rotateZ(Math.PI * 0.5).translate(98.9, cyY + 0.34, cyZ - 0.35),
      new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6).rotateZ(Math.PI * 0.5).translate(98.5, cyY + 0.34, cyZ + 0.85),
      new THREE.CylinderGeometry(0.025, 0.025, 0.65, 4).translate(98.08, cyY + 1.05, cyZ - 0.65),
      new THREE.CylinderGeometry(0.025, 0.025, 0.65, 4).translate(98.92, cyY + 1.05, cyZ - 0.65)
    );
    hkW3Atlas.push(
      makeReliefBox(0.95, 0.65, 0.95, 'agedIronwood', 98.5, cyY + 0.68, cyZ - 0.25),
      makeReliefBox(1.02, 0.22, 1.05, 'tamBaoGoldLacquer', 98.5, cyY + 1.38, cyZ - 0.25)
    );
  }
  const cartY = ctx.getHeight(99.2, 20.8);
  hkW3Atlas.push(
    makeReliefBox(0.95, 0.92, 1.45, 'agedIronwood', 99.2, cartY + 0.62, 20.8),
    makeReliefBox(0.06, 0.85, 0.06, 'agedIronwood', 98.78, cartY + 1.42, 20.15),
    makeReliefBox(0.06, 0.85, 0.06, 'agedIronwood', 99.62, cartY + 1.42, 20.15),
    makeReliefBox(0.06, 0.85, 0.06, 'agedIronwood', 98.78, cartY + 1.42, 21.45),
    makeReliefBox(0.06, 0.85, 0.06, 'agedIronwood', 99.62, cartY + 1.42, 21.45),
    makeReliefBox(1.15, 0.16, 1.65, 'tamBaoGoldLacquer', 99.2, cartY + 1.85, 20.8)
  );
  hkW3Bronze.push(
    new THREE.CylinderGeometry(0.26, 0.26, 0.06, 6).rotateZ(Math.PI * 0.5).translate(98.7, cartY + 0.26, 20.8),
    new THREE.CylinderGeometry(0.26, 0.26, 0.06, 6).rotateZ(Math.PI * 0.5).translate(99.7, cartY + 0.26, 20.8)
  );
  // 461-462. Vintage phone booth & Hanoi Post Office pillar mailbox
  const phY = ctx.getHeight(101.8, 7.8);
  hkW3Atlas.push(makeReliefBox(0.92, 2.25, 0.92, 'tamBaoGoldLacquer', 101.8, phY + 1.12, 7.8));
  hkW3Glow.push(new THREE.BoxGeometry(0.68, 1.15, 0.96).translate(101.8, phY + 1.35, 7.8));
  hkW3Gold.push(new THREE.CylinderGeometry(0.24, 0.26, 1.25, 6).translate(101.2, ctx.getHeight(101.2, 11.8) + 0.62, 11.8));
  // 465-468, 472-474. Warden kiosk (96.5, 29.2), city-map kiosk, newsstand, busker platform (105.6, 22.8), bike rack, tai-chi pad & Old Quarter arch (zero overlaps!)
  const wkY = ctx.getHeight(96.5, 29.2);
  hkW3Atlas.push(
    makeReliefCyl(1.15, 1.15, 2.25, 6, 'thapRuaOchrePebble', 96.5, wkY + 1.12, 29.2),
    makeReliefCyl(0.18, 1.45, 0.65, 6, 'ngoiMuiHaiMossy', 96.5, wkY + 2.55, 29.2),
    makeReliefBox(0.18, 1.95, 1.35, 'agedIronwood', 98.5, ctx.getHeight(98.5, 17.5) + 0.98, 17.5),
    makeReliefBox(1.85, 2.05, 1.45, 'agedIronwood', 101.8, ctx.getHeight(101.8, 16.5) + 1.02, 16.5),
    makeReliefBox(2.25, 0.26, 1.85, 'ngoiMuiHaiMossy', 101.8, ctx.getHeight(101.8, 16.5) + 2.15, 16.5),
    makeReliefBox(3.4, 0.34, 3.4, 'monolithicStoneDrum', 105.6, ctx.getHeight(105.6, 22.8) + 0.17, 22.8),
    makeReliefBox(0.14, 1.85, 3.0, 'tamBaoGoldLacquer', 107.1, ctx.getHeight(105.6, 22.8) + 1.25, 22.8),
    makeReliefCyl(2.4, 2.5, 0.16, 8, 'monolithicStoneDrum', 99.0, ctx.getHeight(99.0, 27.5) + 0.08, 27.5),
    // 474. Old Quarter walking-street arch (103.5, 5.5)
    makeReliefBox(0.32, 3.6, 0.32, 'tamBaoGoldLacquer', 101.4, ctx.getHeight(101.4, 5.5) + 1.68, 5.5),
    makeReliefBox(0.32, 3.6, 0.32, 'tamBaoGoldLacquer', 105.6, ctx.getHeight(105.6, 5.5) + 1.68, 5.5),
    makeReliefBox(4.8, 0.45, 0.36, 'tamBaoGoldLacquer', 103.5, ctx.getHeight(103.5, 5.5) + 3.55, 5.5)
  );
  hkW3Glow.push(new THREE.BoxGeometry(0.24, 1.15, 1.15).translate(98.5, ctx.getHeight(98.5, 17.5) + 1.25, 17.5));
  hkW3Bronze.push(new THREE.BoxGeometry(0.45, 0.65, 2.4).translate(100.8, ctx.getHeight(100.8, 4.5) + 0.32, 4.5));

  // 463-464, 469-471, 475-478, 499-500. Extended lakeside railing, 4 French benches + bins, 4 flowerbeds, 4 lamps, 6 street flags, bronze turtle monument, boat-dock steps, life-ring post, iron bed edging & signpost
  for (let i = 0; i < 6; i++) {
    const rz = 5.0 + i * 4.0;
    const ry = ctx.getHeight(94.0, rz);
    hkW3Atlas.push(
      makeReliefBox(0.18, 0.68, 3.85, 'monolithicStoneDrum', 94.0, ry + 0.34, rz),
      makeReliefBox(0.28, 0.82, 0.28, 'monolithicStoneDrum', 94.0, ry + 0.41, rz - 1.95)
    );
    // 475. 6 angled festive walking-street flags
    const fy = ctx.getHeight(102.8, rz);
    hkW3Bronze.push(new THREE.CylinderGeometry(0.03, 0.04, 3.2, 5).translate(102.8, fy + 1.6, rz));
    hkW3Gold.push(new THREE.BoxGeometry(0.05, 0.68, 1.05).translate(102.8, fy + 2.85, rz + 0.45));
  }
  for (const bz of [6.5, 11.5, 16.5, 21.5]) {
    const by = ctx.getHeight(96.2, bz);
    hkW3Atlas.push(
      makeReliefBox(0.52, 0.10, 1.65, 'agedIronwood', 96.2, by + 0.44, bz),
      makeReliefBox(0.10, 0.48, 1.65, 'agedIronwood', 96.46, by + 0.70, bz)
    );
    hkW3Bronze.push(
      new THREE.BoxGeometry(0.48, 0.42, 0.10).translate(96.2, by + 0.21, bz - 0.68),
      new THREE.BoxGeometry(0.48, 0.42, 0.10).translate(96.2, by + 0.21, bz + 0.68),
      new THREE.CylinderGeometry(0.18, 0.16, 0.62, 6).translate(96.2, by + 0.31, bz + 1.15),
      // 470. 4 colonial twin-globe streetlamps along Old Quarter sidewalk
      new THREE.CylinderGeometry(0.05, 0.10, 3.2, 6).translate(102.5, ctx.getHeight(102.5, bz) + 1.6, bz)
    );
    hkW3Glow.push(
      new THREE.BoxGeometry(0.22, 0.24, 0.22).translate(102.5, ctx.getHeight(102.5, bz) + 3.25, bz - 0.24),
      new THREE.BoxGeometry(0.22, 0.24, 0.22).translate(102.5, ctx.getHeight(102.5, bz) + 3.25, bz + 0.24)
    );
    // 469. 4 octagonal brick floral planters
    hkW3Atlas.push(
      makeReliefCyl(0.68, 0.72, 0.38, 6, 'batTrangFloor', 99.6, ctx.getHeight(99.6, bz) + 0.19, bz),
      makeReliefCyl(0.56, 0.56, 0.18, 6, 'lushIsletGrass', 99.6, ctx.getHeight(99.6, bz) + 0.42, bz)
    );
  }
  const btY = ctx.getHeight(95.2, 22.0);
  hkW3Atlas.push(
    makeReliefBox(1.35, 0.52, 1.35, 'monolithicStoneDrum', 95.2, btY + 0.26, 22.0),
    makeReliefBox(2.2, 0.16, 1.45, 'agedIronwood', 90.5, dockY - 0.08, 22.2),
    makeReliefBox(0.14, 1.35, 0.14, 'tamBaoGoldLacquer', 93.6, ctx.getHeight(93.6, 19.5) + 0.68, 19.5),
    makeReliefBox(2.75, 0.38, 0.08, 'agedIronwood', 99.6, butY + 0.22, 8.45),
    makeReliefBox(2.75, 0.38, 0.08, 'agedIronwood', 99.6, butY + 0.22, 9.95)
  );
  hkW3Bronze.push(
    new THREE.CylinderGeometry(0.42, 0.48, 0.32, 6).translate(95.2, btY + 0.68, 22.0),
    new THREE.CylinderGeometry(0.06, 0.09, 2.35, 6).translate(97.5, ctx.getHeight(97.5, 9.5) + 1.18, 9.5),
    new THREE.BoxGeometry(0.85, 0.22, 0.06).translate(97.9, ctx.getHeight(97.5, 9.5) + 2.05, 9.5),
    new THREE.BoxGeometry(0.06, 0.22, 0.85).translate(97.5, ctx.getHeight(97.5, 9.5) + 1.82, 9.9)
  );

  // 479-498. Đền Ngọc Sơn, Trấn Ba Đình, Cầu Thê Húc, Tháp Bút, Gò Rùa & Nhà Bát Giác refinements
  hkW3Atlas.push(
    // 479-480, 482-483. Đền Ngọc Sơn brackets, Văn Xương altar, kneeling mats & Rùa Cổ glass vitrine
    makeReliefBox(0.32, 0.26, 6.2, 'tamBaoGoldLacquer', ngocSanctX + 2.8, ngocSanctY + 3.40, 3.0),
    makeReliefBox(0.95, 0.88, 1.65, 'tamBaoGoldLacquer', 64.2, ngocSanctY + 0.86, 5.4),
    makeReliefBox(1.15, 0.08, 1.85, 'tamBaoGoldLacquer', 66.8, ngocSanctY + 0.46, 3.0),
    makeReliefBox(1.18, 0.58, 0.78, 'agedIronwood', 67.2, ngocSanctY + 1.16, 1.4),
    // 485-489. Trấn Ba Đình tea table, tide gauge, Đền Ngọc Sơn merit desk, votive burner & stepping slab
    makeReliefCyl(0.52, 0.32, 0.62, 6, 'monolithicStoneDrum', 70.2, ngocY + 0.31, 6.2),
    makeReliefBox(0.24, 1.25, 0.24, 'monolithicStoneDrum', 73.4, VIETNAM_WATER_LEVEL + 0.45, 7.6),
    makeReliefBox(1.15, 0.78, 0.62, 'agedIronwood', 78.6, ngocY + 0.39, 1.0),
    makeReliefBox(0.42, 0.38, 0.34, 'tamBaoGoldLacquer', 78.6, ngocY + 0.96, 1.0),
    makeReliefBox(1.05, 1.45, 1.05, 'weatheredLimeStucco', 68.5, ngocY + 0.72, -1.5),
    makeReliefBox(1.28, 0.26, 1.28, 'ngoiMuiHaiMossy', 68.5, ngocY + 1.56, -1.5),
    makeReliefBox(1.85, 0.18, 1.15, 'monolithicStoneDrum', 69.5, ngocY + 0.12, -0.5),
    // 490, 492-493. Cầu Thê Húc restoration plaque, Tháp Bút photo terrace & Đài Nghiên urns
    makeReliefBox(0.85, 1.18, 0.20, 'thapButSandstone', 101.2, ctx.getHeight(101.2, 5.2) + 0.59, 5.2),
    makeReliefBox(2.4, 0.24, 3.2, 'monolithicStoneDrum', 100.2, butY + 0.12, 14.0),
    makeReliefCyl(0.32, 0.24, 0.42, 6, 'hoaChanhGreenTile', dnX - 2.1, dnY + 0.21, dnZ),
    makeReliefCyl(0.32, 0.24, 0.42, 6, 'hoaChanhGreenTile', dnX + 2.1, dnY + 0.21, dnZ)
  );
  // 481. Gilded parasols inside Đền Ngọc Sơn
  for (const side of [-1, 1]) {
    hkW3Atlas.push(makeReliefCyl(0.04, 0.04, 2.35, 5, 'tamBaoGoldLacquer', 64.6, ngocSanctY + 1.60, 3.0 + side * 1.45));
    hkW3Gold.push(new THREE.ConeGeometry(0.48, 0.36, 6).translate(64.6, ngocSanctY + 2.85, 3.0 + side * 1.45));
    // 491. Cầu Thê Húc East bridgehead bronze lamp standards
    hkW3Bronze.push(new THREE.CylinderGeometry(0.05, 0.09, 2.65, 5).translate(100.5, deckBaseY + 1.25, ngocZ + side * 2.2));
    hkW3Glow.push(new THREE.BoxGeometry(0.22, 0.24, 0.22).translate(100.5, deckBaseY + 2.68, ngocZ + side * 2.2));
  }
  // 484. 4 hanging corner lanterns under Trấn Ba Đình eaves (with timber hanging rods!)
  for (const sx of [-2.85, 2.85]) {
    for (const sz of [-2.85, 2.85]) {
      hkW3Atlas.push(makeReliefCyl(0.03, 0.03, 0.32, 5, 'tamBaoGoldLacquer', tbdX + sx, tbdFloorY + 3.24, ngocZ + sz));
      hkW3Glow.push(new THREE.BoxGeometry(0.18, 0.26, 0.18).translate(tbdX + sx, tbdFloorY + 3.05, ngocZ + sz));
    }
  }
  // 494-496. West Gò Rùa steps, 4 Gò Rùa perimeter bollards & subtle Tháp Rùa Tier 4 ridge collar accent
  for (let st = 0; st < 3; st++) {
    hkW3Atlas.push(makeReliefBox(0.55, 0.22, 1.55, 'monolithicStoneDrum', cx - 8.6 - st * 0.45, VIETNAM_WATER_LEVEL + 0.52 - st * 0.16, cz));
  }
  for (const sx of [-5.8, 5.8]) {
    for (const sz of [-4.6, 4.6]) {
      hkW3Atlas.push(makeReliefCyl(0.14, 0.18, 0.58, 5, 'monolithicStoneDrum', cx + sx, baseY + 0.29, cz + sz));
    }
  }
  hkW3Bronze.push(new THREE.CylinderGeometry(0.14, 0.22, 0.24, 6).translate(cx, t4RoofY + 0.96, cz));
  // 497-498. Nhà Bát Giác corner stone seats & central hanging lantern (on timber suspension rod!)
  for (let c = 0; c < 4; c++) {
    const ca = (c / 4) * Math.PI * 2;
    hkW3Atlas.push(makeReliefBox(0.85, 0.42, 0.42, 'monolithicStoneDrum', gazX + Math.cos(ca) * 2.4, gazY + 0.56, gazZ + Math.sin(ca) * 2.4, -ca));
  }
  hkW3Atlas.push(makeReliefCyl(0.03, 0.03, 0.36, 5, 'agedIronwood', gazX, gazY + 3.02, gazZ));
  hkW3Glow.push(new THREE.BoxGeometry(0.26, 0.34, 0.26).translate(gazX, gazY + 2.82, gazZ));

  const hkW3AtlasMesh = createMergedMesh('HoanKiemWave3AtlasMesh', hkW3Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW3AtlasMesh) group.add(hkW3AtlasMesh);
  const hkW3GoldMesh = createMergedMesh('HoanKiemWave3GoldMesh', hkW3Gold, ctx.materials.gold, false, false);
  if (hkW3GoldMesh) group.add(hkW3GoldMesh);
  const hkW3BronzeMesh = createMergedMesh('HoanKiemWave3BronzeMesh', hkW3Bronze, ctx.materials.bronze, false, true);
  if (hkW3BronzeMesh) group.add(hkW3BronzeMesh);
  const hkW3GlowMesh = createMergedMesh('HoanKiemWave3GlowMesh', hkW3Glow, glowMat, false, false);
  if (hkW3GlowMesh) group.add(hkW3GlowMesh);

  const hkW2AtlasMesh = createMergedMesh('HoanKiemWave2AtlasMesh', hkW2Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW2AtlasMesh) group.add(hkW2AtlasMesh);
  const hkW2GoldMesh = createMergedMesh('HoanKiemWave2GoldMesh', hkW2Gold, ctx.materials.gold, false, false);
  if (hkW2GoldMesh) group.add(hkW2GoldMesh);
  const hkW2BronzeMesh = createMergedMesh('HoanKiemWave2BronzeMesh', hkW2Bronze, ctx.materials.bronze, false, true);
  if (hkW2BronzeMesh) group.add(hkW2BronzeMesh);
  const hkW2GlowMesh = createMergedMesh('HoanKiemWave2GlowMesh', hkW2Glow, glowMat, false, false);
  if (hkW2GlowMesh) group.add(hkW2GlowMesh);

  // --------------------------------------------------------------------------
  // 9C. HỒ HOÀN KIẾM, ĐẢO NGỌC & OLD QUARTER EXTENDED WAVE 4 DETAILS (Items 851..900)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // --------------------------------------------------------------------------
  const hkW4Atlas: THREE.BufferGeometry[] = [];
  const hkW4Gold: THREE.BufferGeometry[] = [];
  const hkW4Bronze: THREE.BufferGeometry[] = [];
  const hkW4Glow: THREE.BufferGeometry[] = [];

  // 851-854, 894, 896, 899. 4th Old Quarter shophouse (110.0, 23.5) + Egg-Coffee corner pavilion (110.0, 29.0) + sidewalk café, drainage & uplights
  for (const [sZ, isCafe] of [[23.5, false], [29.0, true]] as const) {
    const sY = ctx.getHeight(110.0, sZ);
    hkW4Atlas.push(
      makeReliefBox(5.2, isCafe ? 5.2 : 5.6, 4.4, 'thapRuaOchrePebble', 110.0, sY + (isCafe ? 2.60 : 2.80), sZ),
      makeReliefBox(5.8, 0.45, 4.8, 'ngoiMuiHaiMossy', 110.0, sY + (isCafe ? 5.40 : 5.80), sZ),
      makeReliefBox(3.6, 0.52, 3.2, 'ngoiMuiHaiMossy', 110.0, sY + (isCafe ? 5.86 : 6.26), sZ),
      makeReliefBox(0.95, 0.16, 3.8, 'monolithicStoneDrum', 107.02, sY + 3.02, sZ),
      makeReliefBox(0.14, 1.32, 0.92, 'hoaChanhGreenTile', 107.36, sY + 4.00, sZ - 1.02),
      makeReliefBox(0.14, 1.32, 0.92, 'hoaChanhGreenTile', 107.36, sY + 4.00, sZ + 1.02),
      makeReliefBox(1.15, 0.14, 3.6, 'tamBaoGoldLacquer', 106.9, sY + 2.52, sZ, 0, 0, 0.24)
    );
    hkW4Bronze.push(new THREE.BoxGeometry(0.08, 0.76, 3.7).translate(106.62, sY + 3.46, sZ));
    if (isCafe) {
      for (const czOff of [-1.2, 0, 1.2]) {
        hkW4Atlas.push(
          makeReliefBox(0.62, 0.45, 0.62, 'agedIronwood', 106.2, sY + 0.22, sZ + czOff),
          makeReliefBox(0.26, 0.26, 0.26, 'hoaChanhGreenTile', 105.6, sY + 0.13, sZ + czOff)
        );
      }
    }
  }
  hkW4Atlas.push(makeReliefBox(0.28, 0.08, 22.0, 'monolithicStoneDrum', 106.8, ctx.getHeight(106.8, 16.0) + 0.04, 16.0));
  for (const uz of [8.5, 13.5, 18.5, 23.5]) {
    const uy = ctx.getHeight(107.2, uz);
    hkW4Bronze.push(new THREE.CylinderGeometry(0.08, 0.10, 0.38, 5).translate(107.2, uy + 0.19, uz));
    hkW4Glow.push(
      new THREE.BoxGeometry(0.10, 0.10, 0.10).translate(107.2, uy + 0.42, uz),
      new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(106.85, uy + 2.75, uz)
    );
  }

  // 855-858, 891. Lý Thái Tổ Preview Terrace (106.5, 35.5) & Colonial Bandstand Kiosk Nhà Kèn Bát Giác (98.5, 34.5)
  const ltY = ctx.getHeight(106.5, 35.5);
  hkW4Atlas.push(
    makeReliefBox(5.6, 0.62, 5.6, 'monolithicStoneDrum', 106.5, ltY + 0.31, 35.5),
    makeReliefBox(2.2, 1.45, 2.2, 'monolithicStoneDrum', 106.5, ltY + 1.32, 35.5),
    makeReliefBox(5.8, 0.42, 0.22, 'monolithicStoneDrum', 106.5, ltY + 0.82, 38.2),
    makeReliefBox(0.95, 1.55, 0.24, 'monolithicStoneDrum', 103.5, ctx.getHeight(103.5, 35.5) + 0.78, 35.5)
  );
  hkW4Bronze.push(
    new THREE.CylinderGeometry(0.42, 0.52, 1.65, 6).translate(106.5, ltY + 2.85, 35.5),
    new THREE.CylinderGeometry(0.24, 0.18, 0.48, 6).translate(106.5, ltY + 0.86, 33.4)
  );
  const nkX = 98.5;
  const nkZ = 34.5;
  const nkY = ctx.getHeight(nkX, nkZ);
  hkW4Atlas.push(
    makeReliefCyl(2.9, 3.1, 0.42, 8, 'monolithicStoneDrum', nkX, nkY + 0.21, nkZ),
    makeReliefBox(6.0, 0.36, 6.0, 'ngoiMuiHaiMossy', nkX, nkY + 3.12, nkZ),
    makeReliefBox(3.4, 0.45, 3.4, 'ngoiMuiHaiMossy', nkX, nkY + 3.54, nkZ)
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    hkW4Atlas.push(
      makeReliefCyl(0.09, 0.11, 2.80, 6, 'agedIronwood', nkX + Math.cos(a) * 2.45, nkY + 1.68, nkZ + Math.sin(a) * 2.45),
      makeReliefBox(1.85, 0.62, 0.10, 'agedIronwood', nkX + Math.cos(a + 0.39) * 2.45, nkY + 0.72, nkZ + Math.sin(a + 0.39) * 2.45, -a - 0.39)
    );
  }
  hkW4Glow.push(new THREE.BoxGeometry(0.26, 0.32, 0.26).translate(nkX, nkY + 2.75, nkZ));

  // 859-865, 869-876, 879-885, 892-893, 900. Northern Lakeside Garden: Lotus fountain, pergola, 2 flower stalls, bike, tram marker, chess, calligraphy, bollards, benches, lamps, planters, easels, tò he cart, drinking fountain, library, steps, skiff, arch, flags, clock, bike rack & monument marker
  const fnY = ctx.getHeight(96.5, 30.5);
  hkW4Atlas.push(
    makeReliefCyl(1.45, 1.62, 0.48, 8, 'monolithicStoneDrum', 96.5, fnY + 0.24, 30.5),
    makeReliefCyl(0.42, 0.55, 0.85, 6, 'monolithicStoneDrum', 96.5, fnY + 0.88, 30.5),
    // 860. Promenade pergola (95.5, 35.5)
    makeReliefBox(0.14, 2.65, 0.14, 'agedIronwood', 94.6, ctx.getHeight(95.5, 35.5) + 1.24, 34.2),
    makeReliefBox(0.14, 2.65, 0.14, 'agedIronwood', 96.4, ctx.getHeight(95.5, 35.5) + 1.24, 34.2),
    makeReliefBox(0.14, 2.65, 0.14, 'agedIronwood', 94.6, ctx.getHeight(95.5, 35.5) + 1.24, 36.8),
    makeReliefBox(0.14, 2.65, 0.14, 'agedIronwood', 96.4, ctx.getHeight(95.5, 35.5) + 1.24, 36.8),
    makeReliefBox(2.2, 0.16, 3.0, 'agedIronwood', 95.5, ctx.getHeight(95.5, 35.5) + 2.58, 35.5),
    // 864-865. Northern chess table & calligraphy kiosk (101.8, 37.5)
    makeReliefCyl(0.55, 0.34, 0.66, 6, 'monolithicStoneDrum', 95.2, ctx.getHeight(95.2, 33.2) + 0.33, 33.2),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', 94.3, ctx.getHeight(95.2, 33.2) + 0.19, 33.2),
    makeReliefCyl(0.22, 0.22, 0.38, 5, 'monolithicStoneDrum', 96.1, ctx.getHeight(95.2, 33.2) + 0.19, 33.2),
    makeReliefBox(2.2, 0.20, 2.0, 'tamBaoGoldLacquer', 101.8, ctx.getHeight(101.8, 37.5) + 2.28, 37.5),
    makeReliefBox(1.35, 0.62, 0.65, 'agedIronwood', 101.8, ctx.getHeight(101.8, 37.5) + 0.31, 37.5),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 100.8, ctx.getHeight(101.8, 37.5) + 1.12, 36.6),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 102.8, ctx.getHeight(101.8, 37.5) + 1.12, 36.6),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 100.8, ctx.getHeight(101.8, 37.5) + 1.12, 38.4),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 102.8, ctx.getHeight(101.8, 37.5) + 1.12, 38.4),
    // 874, 876, 879-882, 884, 897, 900. Tò he cart, free-library kiosk, boat steps, 3rd skiff, life-ring, north arch, reading table, viewing deck & monument marker
    makeReliefBox(0.88, 0.82, 1.25, 'agedIronwood', 104.5, ctx.getHeight(104.5, 25.5) + 0.56, 25.5),
    makeReliefBox(1.25, 1.85, 0.85, 'thapRuaOchrePebble', 104.2, ctx.getHeight(104.2, 29.5) + 0.92, 29.5),
    makeReliefBox(1.55, 0.24, 1.15, 'ngoiMuiHaiMossy', 104.2, ctx.getHeight(104.2, 29.5) + 1.92, 29.5),
    makeReliefBox(1.65, 0.28, 2.4, 'monolithicStoneDrum', 93.2, VIETNAM_WATER_LEVEL + 0.42, 31.5),
    makeReliefBox(3.4, 0.34, 0.92, 'agedIronwood', 89.8, VIETNAM_WATER_LEVEL + 0.12, 24.8, -0.18),
    makeReliefBox(0.14, 1.35, 0.14, 'tamBaoGoldLacquer', 94.2, ctx.getHeight(94.2, 34.0) + 0.68, 34.0),
    makeReliefBox(0.30, 3.55, 0.30, 'tamBaoGoldLacquer', 104.8, ctx.getHeight(106.5, 31.5) + 1.68, 31.5),
    makeReliefBox(0.30, 3.55, 0.30, 'tamBaoGoldLacquer', 108.2, ctx.getHeight(106.5, 31.5) + 1.68, 31.5),
    makeReliefBox(4.0, 0.42, 0.34, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, 31.5) + 3.52, 31.5),
    makeReliefCyl(0.52, 0.32, 0.66, 6, 'monolithicStoneDrum', 104.8, ctx.getHeight(104.8, 16.5) + 0.33, 16.5),
    makeReliefBox(2.2, 0.26, 2.8, 'monolithicStoneDrum', 93.6, ctx.getHeight(94.2, 8.0) + 0.14, 8.0),
    makeReliefBox(0.72, 1.42, 0.28, 'monolithicStoneDrum', 95.0, ctx.getHeight(95.0, 39.0) + 0.71, 39.0)
  );
  for (const fz of [31.2, 35.2]) {
    const fy = ctx.getHeight(103.2, fz);
    hkW4Atlas.push(
      makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 102.3, fy + 1.05, fz - 0.8),
      makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 104.1, fy + 1.05, fz - 0.8),
      makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 102.3, fy + 1.05, fz + 0.8),
      makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 104.1, fy + 1.05, fz + 0.8),
      makeReliefBox(2.2, 0.18, 2.0, 'tamBaoGoldLacquer', 103.2, fy + 2.22, fz),
      makeReliefBox(1.55, 0.58, 0.68, 'agedIronwood', 103.2, fy + 0.29, fz)
    );
  }
  for (let i = 0; i < 4; i++) {
    const nz = 28.5 + i * 3.2;
    const ny = ctx.getHeight(96.0, nz);
    hkW4Atlas.push(
      makeReliefCyl(0.14, 0.18, 0.72, 5, 'monolithicStoneDrum', 94.0, ctx.getHeight(94.0, nz) + 0.36, nz),
      makeReliefBox(0.52, 0.10, 1.62, 'agedIronwood', 96.0, ny + 0.44, nz),
      makeReliefBox(0.10, 0.46, 1.62, 'agedIronwood', 96.26, ny + 0.68, nz),
      makeReliefCyl(0.65, 0.70, 0.36, 6, 'batTrangFloor', 99.5, ctx.getHeight(99.5, nz) + 0.18, nz)
    );
    hkW4Bronze.push(
      new THREE.CylinderGeometry(0.18, 0.16, 0.58, 6).translate(96.0, ny + 0.29, nz + 1.1),
      new THREE.CylinderGeometry(0.05, 0.09, 3.1, 6).translate(100.8, ctx.getHeight(100.8, nz) + 1.55, nz),
      new THREE.CylinderGeometry(0.03, 0.04, 3.1, 5).translate(105.8, ctx.getHeight(105.8, nz) + 1.55, nz)
    );
    hkW4Glow.push(
      new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(100.8, ctx.getHeight(100.8, nz) + 3.18, nz - 0.22),
      new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(100.8, ctx.getHeight(100.8, nz) + 3.18, nz + 0.22)
    );
    hkW4Gold.push(new THREE.BoxGeometry(0.05, 0.65, 0.98).translate(105.8, ctx.getHeight(105.8, nz) + 2.78, nz + 0.42));
  }
  for (const ez of [10.5, 15.0, 19.5]) {
    const ey = ctx.getHeight(105.5, ez);
    hkW4Atlas.push(
      makeReliefBox(0.10, 1.55, 0.10, 'agedIronwood', 105.5, ey + 0.78, ez),
      makeReliefBox(0.10, 0.82, 1.05, 'weatheredLimeStucco', 105.42, ey + 1.15, ez)
    );
  }
  hkW4Bronze.push(
    new THREE.CylinderGeometry(0.30, 0.30, 0.06, 6).rotateZ(Math.PI * 0.5).translate(101.2, ctx.getHeight(101.2, 31.5) + 0.30, 31.0),
    new THREE.CylinderGeometry(0.30, 0.30, 0.06, 6).rotateZ(Math.PI * 0.5).translate(101.2, ctx.getHeight(101.2, 31.5) + 0.30, 32.0),
    new THREE.CylinderGeometry(0.14, 0.20, 2.2, 6).translate(104.2, ctx.getHeight(104.2, 10.5) + 1.1, 10.5),
    new THREE.CylinderGeometry(0.16, 0.12, 0.92, 6).translate(97.5, ctx.getHeight(97.5, 32.5) + 0.46, 32.5),
    new THREE.CylinderGeometry(0.14, 0.22, 2.85, 6).translate(102.5, ctx.getHeight(102.5, 33.5) + 1.42, 33.5),
    new THREE.BoxGeometry(0.45, 0.62, 2.2).translate(106.8, ctx.getHeight(106.8, 28.5) + 0.31, 28.5),
    new THREE.CylinderGeometry(0.06, 0.08, 2.35, 6).translate(105.2, ctx.getHeight(105.2, 6.2) + 1.18, 6.2)
  );
  hkW4Glow.push(new THREE.BoxGeometry(0.36, 0.36, 0.26).translate(102.5, ctx.getHeight(102.5, 33.5) + 2.98, 33.5));

  // 866-868, 877-878, 886-890, 895. Đảo Ngọc, Cầu Thê Húc, Tháp Bút & Water Puppet Pavilion refinements
  hkW4Atlas.push(
    makeReliefBox(1.85, 0.42, 2.4, 'monolithicStoneDrum', 73.4, ngocY + 0.12, -4.2),
    makeReliefBox(0.44, 1.05, 0.44, 'monolithicStoneDrum', 73.4, ngocY + 0.82, -5.0),
    makeReliefBox(0.58, 0.16, 0.58, 'ngoiMuiHaiMossy', 73.4, ngocY + 1.42, -5.0),
    makeReliefBox(0.18, 0.26, 3.2, 'tamBaoGoldLacquer', dnlX - 1.25, dnlRoof1Y - 0.18, ngocZ),
    makeReliefBox(1.15, 0.85, 0.62, 'agedIronwood', 100.5, wpY + 0.42, 1.5),
    makeReliefBox(0.95, 0.86, 1.45, 'tamBaoGoldLacquer', 64.2, ngocSanctY + 0.86, 0.8),
    makeReliefBox(2.4, 0.32, 1.15, 'monolithicStoneDrum', 75.8, ngocY + 0.16, -1.8)
  );
  hkW4Bronze.push(new THREE.CylinderGeometry(0.14, 0.10, 0.18, 6).translate(64.2, ngocSanctY + 1.38, 3.0));
  for (const side of [-1, 1]) {
    hkW4Atlas.push(
      makeReliefCyl(0.30, 0.22, 0.40, 6, 'hoaChanhGreenTile', 81.2, ngocY + 0.20, ngocZ + side * 1.8),
      makeReliefBox(0.46, 0.52, 0.52, 'monolithicStoneDrum', 99.2, butY + 0.26, 16.5 + side * 1.2),
      makeReliefBox(0.42, 1.05, 0.42, 'monolithicStoneDrum', 61.8, ngocSanctY + 0.52, 3.0 + side * 3.2),
      makeReliefBox(0.56, 0.16, 0.56, 'ngoiMuiHaiMossy', 61.8, ngocSanctY + 1.12, 3.0 + side * 3.2),
      makeReliefCyl(0.32, 0.24, 0.44, 6, 'hoaChanhGreenTile', 100.8, wpY + 0.22, 1.5 + side * 2.4)
    );
    hkW4Glow.push(
      new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(wpX - 3.32, wpY + 3.95, 1.5 + side * 1.4)
    );
  }

  const hkW4AtlasMesh = createMergedMesh('HoanKiemWave4AtlasMesh', hkW4Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW4AtlasMesh) group.add(hkW4AtlasMesh);
  const hkW4GoldMesh = createMergedMesh('HoanKiemWave4GoldMesh', hkW4Gold, ctx.materials.gold, false, false);
  if (hkW4GoldMesh) group.add(hkW4GoldMesh);
  const hkW4BronzeMesh = createMergedMesh('HoanKiemWave4BronzeMesh', hkW4Bronze, ctx.materials.bronze, false, true);
  if (hkW4BronzeMesh) group.add(hkW4BronzeMesh);
  const hkW4GlowMesh = createMergedMesh('HoanKiemWave4GlowMesh', hkW4Glow, glowMat, false, false);
  if (hkW4GlowMesh) group.add(hkW4GlowMesh);

  // --------------------------------------------------------------------------
  // 9D. HỒ HOÀN KIẾM, HÀNG KHAY & ĐINH TIÊN HOÀNG WAVE 5 DETAILS (Items 1251..1300)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // --------------------------------------------------------------------------
  const hkW5Atlas: THREE.BufferGeometry[] = [];
  const hkW5Gold: THREE.BufferGeometry[] = [];
  const hkW5Bronze: THREE.BufferGeometry[] = [];
  const hkW5Glow: THREE.BufferGeometry[] = [];

  // 1251-1256, 1285-1286, 1298. 5th & 6th Colonial Shophouses (110.0, -3.5 & 110.0, 41.5), balconies, shutters, awnings, bike rack & uplights
  for (const sZ of [-3.5, 41.5]) {
    const sY = ctx.getHeight(110.0, sZ);
    hkW5Atlas.push(
      makeReliefBox(5.2, 5.6, 4.6, 'thapRuaOchrePebble', 110.0, sY + 2.80, sZ),
      makeReliefBox(5.8, 0.45, 5.0, 'ngoiMuiHaiMossy', 110.0, sY + 5.80, sZ),
      makeReliefBox(3.6, 0.50, 3.2, 'ngoiMuiHaiMossy', 110.0, sY + 6.24, sZ),
      makeReliefBox(0.95, 0.16, 3.8, 'monolithicStoneDrum', 107.02, sY + 3.02, sZ),
      makeReliefBox(0.14, 1.32, 0.92, 'hoaChanhGreenTile', 107.36, sY + 4.00, sZ - 1.05),
      makeReliefBox(0.14, 1.32, 0.92, 'hoaChanhGreenTile', 107.36, sY + 4.00, sZ + 1.05),
      makeReliefBox(1.15, 0.14, 3.6, 'tamBaoGoldLacquer', 106.9, sY + 2.52, sZ, 0, 0, 0.24)
    );
    hkW5Bronze.push(
      new THREE.BoxGeometry(0.08, 0.76, 3.7).translate(106.62, sY + 3.46, sZ),
      new THREE.CylinderGeometry(0.08, 0.10, 0.36, 5).translate(107.2, sY + 0.18, sZ)
    );
    hkW5Glow.push(
      new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(106.85, sY + 2.75, sZ),
      new THREE.BoxGeometry(0.10, 0.10, 0.10).translate(107.2, sY + 0.40, sZ)
    );
  }
  hkW5Atlas.push(makeReliefBox(0.28, 0.08, 8.2, 'monolithicStoneDrum', 106.8, ctx.getHeight(106.8, -1.5) + 0.04, -1.5));
  hkW5Bronze.push(new THREE.BoxGeometry(0.45, 0.62, 2.2).translate(106.8, ctx.getHeight(106.8, -5.0) + 0.31, -5.0));

  // 1257-1265. Đông Hồ print kiosk, 3rd flower bike, flower baskets, iced-tea stall, colonial cabinet, mailbox, street sign & 2 lantern arches
  const dhKioskY = ctx.getHeight(106.5, -3.5);
  hkW5Atlas.push(
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 105.6, dhKioskY + 1.05, -4.3),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 107.4, dhKioskY + 1.05, -4.3),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 105.6, dhKioskY + 1.05, -2.7),
    makeReliefBox(0.10, 2.25, 0.10, 'agedIronwood', 107.4, dhKioskY + 1.05, -2.7),
    makeReliefBox(2.2, 0.18, 2.0, 'tamBaoGoldLacquer', 106.5, dhKioskY + 2.22, -3.5),
    makeReliefBox(1.45, 0.62, 0.62, 'agedIronwood', 106.5, dhKioskY + 0.31, -3.5),
    // 1259-1260, 1262. Flower vendor baskets, sidewalk iced-tea stall & Hanoi Post mailbox
    makeReliefCyl(0.32, 0.24, 0.34, 6, 'hoaChanhGreenTile', 105.5, ctx.getHeight(105.5, 22.0) + 0.17, 21.6),
    makeReliefCyl(0.32, 0.24, 0.34, 6, 'hoaChanhGreenTile', 105.5, ctx.getHeight(105.5, 22.0) + 0.17, 22.4),
    makeReliefBox(0.68, 0.44, 0.68, 'agedIronwood', 105.8, ctx.getHeight(105.8, 12.8) + 0.22, 12.8),
    makeReliefBox(0.26, 0.26, 0.26, 'hoaChanhGreenTile', 105.2, ctx.getHeight(105.8, 12.8) + 0.13, 12.8),
    makeReliefBox(0.26, 0.26, 0.26, 'hoaChanhGreenTile', 106.4, ctx.getHeight(105.8, 12.8) + 0.13, 12.8),
    makeReliefCyl(0.22, 0.24, 1.32, 6, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, 20.5) + 0.66, 20.5)
  );
  hkW5Bronze.push(
    new THREE.CylinderGeometry(0.30, 0.30, 0.06, 6).rotateZ(Math.PI * 0.5).translate(106.2, ctx.getHeight(106.2, 2.8) + 0.30, 2.3),
    new THREE.CylinderGeometry(0.30, 0.30, 0.06, 6).rotateZ(Math.PI * 0.5).translate(106.2, ctx.getHeight(106.2, 2.8) + 0.30, 3.3),
    new THREE.BoxGeometry(0.62, 1.15, 0.42).translate(107.2, ctx.getHeight(107.2, 16.0) + 0.58, 16.0),
    new THREE.CylinderGeometry(0.05, 0.07, 2.45, 5).translate(106.2, ctx.getHeight(106.2, 26.8) + 1.22, 26.8)
  );
  for (const az of [14.5, 21.5]) {
    const ay = ctx.getHeight(106.5, az);
    hkW5Atlas.push(
      makeReliefBox(0.22, 3.55, 0.22, 'tamBaoGoldLacquer', 104.8, ay + 1.68, az),
      makeReliefBox(0.22, 3.55, 0.22, 'tamBaoGoldLacquer', 108.2, ay + 1.68, az),
      makeReliefBox(3.8, 0.26, 0.24, 'tamBaoGoldLacquer', 106.5, ay + 3.48, az)
    );
    for (const lx of [105.5, 106.5, 107.5]) {
      hkW5Glow.push(new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(lx, ay + 3.16, az));
    }
  }

  // 1266-1278, 1295, 1299-1300. Northern Lakeside Balustrade, Floral Clock, Áo Dài Monument, North Gazebo, Boat Landing, Skiff & Km 0 Marker
  const ngzX = 96.5;
  const ngzZ = 42.5;
  const ngzY = ctx.getHeight(ngzX, ngzZ);
  hkW5Atlas.push(
    // 1266. Northern lakeside balustrade (94.2, 40.5)
    makeReliefBox(0.26, 0.72, 7.2, 'monolithicStoneDrum', 94.2, ctx.getHeight(94.2, 40.5) + 0.36, 40.5),
    // 1267. Floral Clock Plinth (99.5, 41.5)
    makeReliefCyl(1.45, 1.65, 0.52, 6, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, 41.5) + 0.26, 41.5),
    // 1268. Áo Dài Statue Plinth (104.5, 41.5)
    makeReliefBox(1.85, 1.15, 1.85, 'monolithicStoneDrum', 104.5, ctx.getHeight(104.5, 41.5) + 0.58, 41.5),
    // 1269-1270. North Lakeside Rest Gazebo (96.5, 42.5)
    makeReliefBox(3.8, 0.36, 3.8, 'monolithicStoneDrum', ngzX, ngzY + 0.18, ngzZ),
    makeReliefBox(4.4, 0.34, 4.4, 'ngoiMuiHaiMossy', ngzX, ngzY + 2.94, ngzZ),
    makeReliefBox(1.65, 0.42, 0.52, 'monolithicStoneDrum', ngzX, ngzY + 0.56, ngzZ),
    // 1276-1277, 1295, 1299-1300. Rescue boat steps, skiff, North chess table, wayfinding stele & Km 0 Marker
    makeReliefBox(1.65, 0.28, 2.2, 'monolithicStoneDrum', 92.8, VIETNAM_WATER_LEVEL + 0.40, 36.5),
    makeReliefBox(3.4, 0.34, 0.92, 'agedIronwood', 90.2, VIETNAM_WATER_LEVEL + 0.12, 36.5, 0.14),
    makeReliefCyl(0.52, 0.32, 0.64, 6, 'monolithicStoneDrum', 96.5, ctx.getHeight(96.5, 39.5) + 0.32, 39.5),
    makeReliefBox(0.88, 1.48, 0.22, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, 44.5) + 0.74, 44.5),
    makeReliefCyl(1.15, 1.35, 0.42, 6, 'monolithicStoneDrum', 102.0, ctx.getHeight(102.0, 44.0) + 0.21, 44.0)
  );
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.45, 1.45]) {
      hkW5Atlas.push(makeReliefCyl(0.09, 0.11, 2.70, 6, 'agedIronwood', ngzX + dx, ngzY + 1.54, ngzZ + dz));
    }
  }
  hkW5Glow.push(new THREE.BoxGeometry(0.22, 0.28, 0.22).translate(ngzX, ngzY + 2.58, ngzZ));
  hkW5Bronze.push(
    new THREE.CylinderGeometry(0.95, 1.05, 0.18, 6).translate(99.5, ctx.getHeight(99.5, 41.5) + 0.62, 41.5),
    new THREE.CylinderGeometry(0.32, 0.45, 1.55, 6).translate(104.5, ctx.getHeight(104.5, 41.5) + 1.92, 41.5),
    new THREE.CylinderGeometry(0.36, 0.42, 0.85, 6).translate(102.0, ctx.getHeight(102.0, 44.0) + 0.84, 44.0)
  );
  for (let i = 0; i < 4; i++) {
    const qx = 96.5 + i * 3.0;
    const qy = ctx.getHeight(qx, 44.2);
    hkW5Atlas.push(
      makeReliefBox(1.55, 0.10, 0.52, 'agedIronwood', qx, qy + 0.44, 44.2),
      makeReliefBox(1.55, 0.44, 0.10, 'agedIronwood', qx, qy + 0.66, 44.46),
      makeReliefCyl(0.14, 0.18, 0.68, 5, 'monolithicStoneDrum', 95.0 + i * 3.6, ctx.getHeight(95.0 + i * 3.6, 45.2) + 0.34, 45.2)
    );
    hkW5Bronze.push(
      new THREE.CylinderGeometry(0.05, 0.09, 3.0, 5).translate(qx, ctx.getHeight(qx, 40.0) + 1.50, 40.0),
      new THREE.CylinderGeometry(0.18, 0.16, 0.56, 6).translate(qx + 1.1, qy + 0.28, 44.2)
    );
    hkW5Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(qx, ctx.getHeight(qx, 40.0) + 3.08, 40.0));
  }
  for (const [px, pz] of [[97.5, 40.0], [101.5, 40.0], [99.5, 43.8]] as const) {
    hkW5Atlas.push(makeReliefCyl(0.62, 0.68, 0.36, 6, 'batTrangFloor', px, ctx.getHeight(px, pz) + 0.18, pz));
  }
  for (const ex of [100.0, 102.0, 104.0]) {
    const ey = ctx.getHeight(ex, 39.2);
    hkW5Atlas.push(
      makeReliefBox(0.10, 1.50, 0.10, 'agedIronwood', ex, ey + 0.75, 39.2),
      makeReliefBox(1.02, 0.78, 0.10, 'weatheredLimeStucco', ex, ey + 1.12, 39.28)
    );
  }

  // 1279-1284, 1296-1297. South Hàng Khay Promenade: drinking fountain, clock, flags, benches, lamps, planters, library & life-ring
  hkW5Bronze.push(
    new THREE.CylinderGeometry(0.16, 0.12, 0.92, 6).translate(104.5, ctx.getHeight(104.5, -1.5) + 0.46, -1.5),
    new THREE.CylinderGeometry(0.14, 0.22, 2.85, 6).translate(104.8, ctx.getHeight(104.8, -4.5) + 1.42, -4.5)
  );
  hkW5Glow.push(new THREE.BoxGeometry(0.36, 0.36, 0.26).translate(104.8, ctx.getHeight(104.8, -4.5) + 2.98, -4.5));
  hkW5Atlas.push(
    makeReliefBox(1.25, 1.75, 0.82, 'thapRuaOchrePebble', 104.2, ctx.getHeight(104.2, -3.5) + 0.88, -3.5),
    makeReliefBox(1.52, 0.22, 1.08, 'ngoiMuiHaiMossy', 104.2, ctx.getHeight(104.2, -3.5) + 1.84, -3.5),
    makeReliefBox(0.14, 1.35, 0.14, 'tamBaoGoldLacquer', 96.2, ctx.getHeight(96.2, -4.5) + 0.68, -4.5)
  );
  for (const sz of [-5.0, -3.0, -1.0]) {
    const sy = ctx.getHeight(102.5, sz);
    hkW5Atlas.push(
      makeReliefBox(0.52, 0.10, 1.55, 'agedIronwood', 102.5, sy + 0.44, sz),
      makeReliefBox(0.10, 0.44, 1.55, 'agedIronwood', 102.76, sy + 0.66, sz)
    );
    hkW5Bronze.push(
      new THREE.CylinderGeometry(0.05, 0.09, 3.0, 5).translate(101.0, ctx.getHeight(101.0, sz) + 1.50, sz),
      new THREE.CylinderGeometry(0.03, 0.04, 3.0, 5).translate(105.8, ctx.getHeight(105.8, sz) + 1.50, sz)
    );
    hkW5Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(101.0, ctx.getHeight(101.0, sz) + 3.08, sz));
    hkW5Gold.push(new THREE.BoxGeometry(0.05, 0.62, 0.92).translate(105.8, ctx.getHeight(105.8, sz) + 2.68, sz + 0.38));
  }
  for (const pz of [-4.5, -1.5]) {
    hkW5Atlas.push(makeReliefBox(1.85, 0.36, 1.15, 'batTrangFloor', 103.5, ctx.getHeight(103.5, pz) + 0.18, pz));
  }

  // 1287-1294. Đảo Ngọc & Đền Ngọc Sơn Micro-Architectural Details
  hkW5Atlas.push(
    makeReliefCyl(0.36, 0.28, 0.68, 6, 'monolithicStoneDrum', 70.2, ngocY + 0.34, 4.8),
    makeReliefCyl(0.52, 0.32, 0.62, 6, 'monolithicStoneDrum', 76.5, ngocY + 0.31, 6.2),
    makeReliefBox(0.88, 1.38, 0.22, 'thapButSandstone', 100.8, ctx.getHeight(100.8, 6.8) + 0.69, 6.8)
  );
  for (const side of [-1, 1]) {
    hkW5Gold.push(new THREE.BoxGeometry(0.10, 1.85, 0.28).translate(67.2, ngocSanctY + 1.85, 3.0 + side * 1.85));
    hkW5Glow.push(
      new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(67.2, ngocSanctY + 2.95, 3.0 + side * 1.15),
      new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(67.2, ngocSanctY + 2.95, 3.0 + side * 2.55)
    );
    hkW5Atlas.push(
      makeReliefCyl(0.30, 0.22, 0.42, 6, 'hoaChanhGreenTile', 78.5, ngocY + 0.21, 3.0 + side * 2.4),
      makeReliefBox(0.40, 0.98, 0.40, 'monolithicStoneDrum', 71.8 + side * 3.2, ngocY + 0.49, 7.2),
      makeReliefBox(0.54, 0.16, 0.54, 'ngoiMuiHaiMossy', 71.8 + side * 3.2, ngocY + 1.06, 7.2),
      makeReliefCyl(0.14, 0.18, 0.58, 5, 'monolithicStoneDrum', 73.4 + side * 1.2, ngocY + 0.29, -4.5)
    );
  }

  const hkW5AtlasMesh = createMergedMesh('HoanKiemWave5AtlasMesh', hkW5Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW5AtlasMesh) group.add(hkW5AtlasMesh);
  const hkW5GoldMesh = createMergedMesh('HoanKiemWave5GoldMesh', hkW5Gold, ctx.materials.gold, false, false);
  if (hkW5GoldMesh) group.add(hkW5GoldMesh);
  const hkW5BronzeMesh = createMergedMesh('HoanKiemWave5BronzeMesh', hkW5Bronze, ctx.materials.bronze, false, true);
  if (hkW5BronzeMesh) group.add(hkW5BronzeMesh);
  const hkW5GlowMesh = createMergedMesh('HoanKiemWave5GlowMesh', hkW5Glow, glowMat, false, false);
  if (hkW5GlowMesh) group.add(hkW5GlowMesh);

  // =================================================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADE (Items 1651..1700 — castShadow = false, 0 new materials)
  // =================================================================================================
  const hkW6Atlas: THREE.BufferGeometry[] = [];
  const hkW6Gold: THREE.BufferGeometry[] = [];
  const hkW6Bronze: THREE.BufferGeometry[] = [];
  const hkW6Glow: THREE.BufferGeometry[] = [];

  // 1651-1660. 7th & 8th Hàng Đào / Hàng Khay Colonial Shophouses (110.0, -10.5 & 48.5), balconies, shutters, awnings, sconces & curbs
  for (const sz of [-10.5, 48.5]) {
    const sy = ctx.getHeight(110.0, sz);
    hkW6Atlas.push(
      makeReliefBox(5.2, 6.2, 5.4, 'thapRuaOchrePebble', 110.0, sy + 3.10, sz),
      makeReliefBox(5.8, 0.36, 6.0, 'ngoiMuiHaiMossy', 110.0, sy + 6.32, sz),
      makeReliefBox(0.85, 0.16, 3.4, 'monolithicStoneDrum', 107.1, sy + 3.25, sz),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 107.35, sy + 4.20, sz - 1.15),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 107.35, sy + 4.20, sz + 1.15),
      makeReliefBox(1.10, 0.18, 3.6, 'tamBaoGoldLacquer', 106.95, sy + 2.45, sz),
      makeReliefBox(0.32, 0.16, 5.6, 'monolithicStoneDrum', 107.0, ctx.getHeight(107.0, sz) + 0.08, sz)
    );
    hkW6Bronze.push(new THREE.BoxGeometry(0.08, 0.82, 3.4).translate(106.72, sy + 3.74, sz));
    hkW6Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(107.32, sy + 2.85, sz));
  }

  // 1661-1670. Water-Puppet Backstage Courtyard (110.5, 6.5), Alley Arch, Utility Cabinet, Bike Rack, Mailbox & Street Sign
  const wp6Y = ctx.getHeight(110.5, 6.5);
  hkW6Atlas.push(
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 110.5, wp6Y + 1.58, 4.9),
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 110.5, wp6Y + 1.58, 8.1),
    makeReliefBox(0.95, 0.28, 4.0, 'ngoiMuiHaiMossy', 110.5, wp6Y + 3.34, 6.5),
    makeReliefBox(1.15, 0.68, 0.65, 'agedIronwood', 111.6, wp6Y + 0.34, 5.2),
    makeReliefBox(1.35, 0.42, 0.48, 'agedIronwood', 111.6, wp6Y + 0.21, 7.8),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', 109.6, wp6Y + 0.26, 5.2),
    // 1666. Old Quarter alleyway arch (110.5, -6.8)
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 110.5, ctx.getHeight(110.5, -6.8) + 1.58, -5.8),
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 110.5, ctx.getHeight(110.5, -6.8) + 1.58, -7.8),
    makeReliefBox(0.68, 0.42, 2.8, 'thapRuaOchrePebble', 110.5, ctx.getHeight(110.5, -6.8) + 3.25, -6.8),
    // 1669. Classic pillar mailbox (106.5, -8.5)
    makeReliefBox(0.42, 1.18, 0.42, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, -8.5) + 0.59, -8.5)
  );
  hkW6Glow.push(
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(110.5, wp6Y + 2.98, 5.6),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(110.5, wp6Y + 2.98, 7.4)
  );
  hkW6Bronze.push(
    new THREE.BoxGeometry(0.62, 1.35, 0.42).translate(107.2, ctx.getHeight(107.2, 46.5) + 0.68, 46.5),
    new THREE.BoxGeometry(0.48, 0.58, 1.85).translate(107.2, ctx.getHeight(107.2, 50.5) + 0.29, 50.5),
    new THREE.CylinderGeometry(0.05, 0.07, 2.40, 4).translate(106.5, ctx.getHeight(106.5, -12.2) + 1.20, -12.2)
  );
  hkW6Gold.push(new THREE.BoxGeometry(0.08, 0.26, 0.65).translate(106.5, ctx.getHeight(106.5, -12.2) + 2.25, -12.2));

  // 1671-1685. South Hoàn Kiếm Heritage Kiosk (104.5, -9.5), Stone Curb Wall, Willow Benches, Lamps, Easels & Iced-Tea Stall
  const skY = ctx.getHeight(104.5, -9.5);
  hkW6Atlas.push(
    makeReliefBox(2.4, 2.35, 2.2, 'thapRuaOchrePebble', 104.5, skY + 1.18, -9.5),
    makeReliefBox(3.0, 0.26, 2.8, 'ngoiMuiHaiMossy', 104.5, skY + 2.46, -9.5),
    makeReliefBox(0.75, 0.14, 2.1, 'tamBaoGoldLacquer', 103.0, skY + 2.05, -9.5),
    // 1673. Lakeside granite curb wall (95.2, -9.5)
    makeReliefBox(0.34, 0.58, 6.2, 'monolithicStoneDrum', 95.2, ctx.getHeight(95.2, -9.5) + 0.29, -9.5),
    // 1674-1676. Willow-shade granite benches
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, -7.8) + 0.21, -7.8),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, -10.8) + 0.21, -10.8),
    makeReliefBox(1.55, 0.42, 0.50, 'monolithicStoneDrum', 102.2, ctx.getHeight(102.2, -12.0) + 0.21, -12.0),
    // 1682-1683, 1685. Planters & sidewalk iced-tea stall
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 101.5, ctx.getHeight(101.5, -7.0) + 0.17, -7.0),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 104.5, ctx.getHeight(104.5, -12.2) + 0.17, -12.2),
    makeReliefBox(0.78, 0.48, 0.58, 'agedIronwood', 106.2, ctx.getHeight(106.2, -10.5) + 0.24, -10.5),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 106.2, ctx.getHeight(106.2, -11.1) + 0.15, -11.1),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 106.2, ctx.getHeight(106.2, -9.9) + 0.15, -9.9)
  );
  hkW6Glow.push(new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(103.1, skY + 2.15, -9.5));
  hkW6Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(102.0, ctx.getHeight(102.0, -8.5) + 0.45, -8.5));
  for (const lz of [-8.0, -11.5]) {
    const ly = ctx.getHeight(97.5, lz);
    hkW6Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(97.5, ly + 1.48, lz));
    hkW6Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(97.5, ly + 3.05, lz));
  }
  for (const [ex, ez] of [[101.8, -10.5], [103.5, -12.0]] as const) {
    const ey = ctx.getHeight(ex, ez);
    hkW6Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', ex, ey + 0.72, ez),
      makeReliefBox(0.95, 0.74, 0.10, 'weatheredLimeStucco', ex, ey + 1.08, ez + 0.08)
    );
  }
  for (let i = 0; i < 4; i++) {
    const bz = -7.5 - i * 1.5;
    hkW6Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', 96.2, ctx.getHeight(96.2, bz) + 0.33, bz));
  }

  // 1686-1700. NE Square Flower Kiosk (104.5, 49.5), Chess Table, Lantern Arch, Flower Cart & Đảo Ngọc Micro-Accents
  const nk6Y = ctx.getHeight(104.5, 49.5);
  hkW6Atlas.push(
    makeReliefBox(2.4, 2.30, 2.2, 'agedIronwood', 104.5, nk6Y + 1.15, 49.5),
    makeReliefBox(3.0, 0.26, 2.8, 'ngoiMuiHaiMossy', 104.5, nk6Y + 2.40, 49.5),
    makeReliefBox(0.75, 0.14, 2.1, 'tamBaoGoldLacquer', 103.0, nk6Y + 2.00, 49.5),
    makeReliefCyl(0.50, 0.32, 0.62, 4, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, 49.0) + 0.31, 49.0),
    makeReliefBox(1.65, 0.34, 1.05, 'batTrangFloor', 103.8, ctx.getHeight(103.8, 47.2) + 0.17, 47.2),
    // 1693. Hàng Đào Festive Lantern Arch (106.5, 48.5)
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 105.0, ctx.getHeight(106.5, 48.5) + 1.65, 48.5),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 108.0, ctx.getHeight(106.5, 48.5) + 1.65, 48.5),
    makeReliefBox(3.4, 0.24, 0.22, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, 48.5) + 3.42, 48.5),
    // 1694. 4th Flower Cart (106.2, 46.2)
    makeReliefBox(1.20, 0.42, 0.62, 'agedIronwood', 106.2, ctx.getHeight(106.2, 46.2) + 0.56, 46.2),
    // 1697-1700. Đảo Ngọc East Quay Urn, Lanterns, Plaque & Conservation Marker
    makeReliefCyl(0.32, 0.24, 0.62, 4, 'monolithicStoneDrum', 79.5, ngocY + 0.31, 1.0),
    makeReliefBox(0.86, 1.38, 0.22, 'thapButSandstone', 95.8, ctx.getHeight(95.8, -6.5) + 0.69, -6.5)
  );
  hkW6Gold.push(new THREE.BoxGeometry(0.12, 0.46, 2.2).translate(67.2, ngocSanctY + 3.35, 3.0));
  hkW6Bronze.push(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(105.8, ctx.getHeight(106.2, 46.2) + 0.32, 46.2),
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(106.6, ctx.getHeight(106.2, 46.2) + 0.32, 46.2)
  );
  hkW6Glow.push(
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(103.1, nk6Y + 2.10, 49.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(105.6, ctx.getHeight(106.5, 48.5) + 3.12, 48.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(106.5, ctx.getHeight(106.5, 48.5) + 3.12, 48.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(107.4, ctx.getHeight(106.5, 48.5) + 3.12, 48.5)
  );
  for (const lz of [47.5, 51.0]) {
    hkW6Atlas.push(makeReliefBox(0.50, 0.42, 1.55, 'agedIronwood', 97.5, ctx.getHeight(97.5, lz) + 0.21, lz));
    hkW6Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(101.5, ctx.getHeight(101.5, lz) + 1.48, lz));
    hkW6Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(101.5, ctx.getHeight(101.5, lz) + 3.05, lz));
  }
  for (let i = 0; i < 4; i++) {
    const bx = 96.0 + i * 3.0;
    hkW6Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 52.2) + 0.33, 52.2));
  }
  for (const dz of [-1.2, 4.8]) {
    hkW6Atlas.push(
      makeReliefBox(0.38, 0.94, 0.38, 'monolithicStoneDrum', 79.5, ngocY + 0.47, dz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', 79.5, ngocY + 1.02, dz)
    );
  }

  const hkW6AtlasMesh = createMergedMesh('HoanKiemWave6AtlasMesh', hkW6Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW6AtlasMesh) group.add(hkW6AtlasMesh);
  const hkW6GoldMesh = createMergedMesh('HoanKiemWave6GoldMesh', hkW6Gold, ctx.materials.gold, false, false);
  if (hkW6GoldMesh) group.add(hkW6GoldMesh);
  const hkW6BronzeMesh = createMergedMesh('HoanKiemWave6BronzeMesh', hkW6Bronze, ctx.materials.bronze, false, true);
  if (hkW6BronzeMesh) group.add(hkW6BronzeMesh);
  const hkW6GlowMesh = createMergedMesh('HoanKiemWave6GlowMesh', hkW6Glow, glowMat, false, false);
  if (hkW6GlowMesh) group.add(hkW6GlowMesh);

  // =================================================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADE (Items 2051..2100 — castShadow = false, 0 new materials)
  // =================================================================================================
  const hkW7Atlas: THREE.BufferGeometry[] = [];
  const hkW7Gold: THREE.BufferGeometry[] = [];
  const hkW7Bronze: THREE.BufferGeometry[] = [];
  const hkW7Glow: THREE.BufferGeometry[] = [];

  // 2051-2060. 9th & 10th Lê Thái Tổ / Hàng Bạc Corner Colonial Shophouses (110.0, -17.5 & 55.5)
  for (const sz of [-17.5, 55.5]) {
    const sy7 = ctx.getHeight(110.0, sz);
    hkW7Atlas.push(
      makeReliefBox(5.2, 6.2, 5.4, 'thapRuaOchrePebble', 110.0, sy7 + 3.10, sz),
      makeReliefBox(5.8, 0.36, 6.0, 'ngoiMuiHaiMossy', 110.0, sy7 + 6.32, sz),
      makeReliefBox(0.85, 0.16, 3.4, 'monolithicStoneDrum', 107.1, sy7 + 3.25, sz),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 107.35, sy7 + 4.20, sz - 1.15),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 107.35, sy7 + 4.20, sz + 1.15),
      makeReliefBox(1.10, 0.18, 3.6, 'tamBaoGoldLacquer', 106.95, sy7 + 2.45, sz),
      makeReliefBox(0.32, 0.16, 5.6, 'monolithicStoneDrum', 107.0, ctx.getHeight(107.0, sz) + 0.08, sz)
    );
    hkW7Bronze.push(new THREE.BoxGeometry(0.08, 0.82, 3.4).translate(106.72, sy7 + 3.74, sz));
    hkW7Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(107.32, sy7 + 2.85, sz));
  }

  // 2061-2070. Water-Puppet Ticket Plaza (112.5, 13.5), Lê Thái Tổ Alley Arch, Cabinet, Bike Rack, Mailbox & Street Sign
  const wp7Y = ctx.getHeight(112.5, 13.5);
  hkW7Atlas.push(
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 112.5, wp7Y + 1.58, 11.9),
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 112.5, wp7Y + 1.58, 15.1),
    makeReliefBox(0.95, 0.28, 4.0, 'ngoiMuiHaiMossy', 112.5, wp7Y + 3.34, 13.5),
    makeReliefBox(0.68, 0.96, 1.45, 'agedIronwood', 111.5, wp7Y + 0.48, 13.5),
    makeReliefBox(1.35, 0.42, 0.48, 'agedIronwood', 112.5, wp7Y + 0.21, 16.5),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', 111.2, wp7Y + 0.26, 11.2),
    // 2066. Old Quarter alleyway arch (110.5, -13.8)
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 110.5, ctx.getHeight(110.5, -13.8) + 1.58, -12.8),
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 110.5, ctx.getHeight(110.5, -13.8) + 1.58, -14.8),
    makeReliefBox(0.68, 0.42, 2.8, 'thapRuaOchrePebble', 110.5, ctx.getHeight(110.5, -13.8) + 3.25, -13.8),
    // 2069. Classic pillar mailbox (106.5, -15.5)
    makeReliefBox(0.42, 1.18, 0.42, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, -15.5) + 0.59, -15.5)
  );
  hkW7Glow.push(
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(112.5, wp7Y + 2.98, 12.6),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(112.5, wp7Y + 2.98, 14.4)
  );
  hkW7Bronze.push(
    new THREE.BoxGeometry(0.62, 1.35, 0.42).translate(107.2, ctx.getHeight(107.2, 53.5) + 0.68, 53.5),
    new THREE.BoxGeometry(0.48, 0.58, 1.85).translate(107.2, ctx.getHeight(107.2, 57.5) + 0.29, 57.5),
    new THREE.CylinderGeometry(0.05, 0.07, 2.40, 4).translate(106.5, ctx.getHeight(106.5, -19.2) + 1.20, -19.2)
  );
  hkW7Gold.push(new THREE.BoxGeometry(0.08, 0.26, 0.65).translate(106.5, ctx.getHeight(106.5, -19.2) + 2.25, -19.2));

  // 2071-2085. Far-South Lê Thái Tổ Lakeside Promenade (95.2..106.2, -14.0..-19.2)
  const sk7Y = ctx.getHeight(104.5, -16.5);
  hkW7Atlas.push(
    makeReliefBox(2.4, 2.35, 2.2, 'thapRuaOchrePebble', 104.5, sk7Y + 1.18, -16.5),
    makeReliefBox(3.0, 0.26, 2.8, 'ngoiMuiHaiMossy', 104.5, sk7Y + 2.46, -16.5),
    makeReliefBox(0.75, 0.14, 2.1, 'tamBaoGoldLacquer', 103.0, sk7Y + 2.05, -16.5),
    makeReliefBox(0.34, 0.58, 6.2, 'monolithicStoneDrum', 95.2, ctx.getHeight(95.2, -16.5) + 0.29, -16.5),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, -14.8) + 0.21, -14.8),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, -17.8) + 0.21, -17.8),
    makeReliefBox(1.55, 0.42, 0.50, 'monolithicStoneDrum', 102.2, ctx.getHeight(102.2, -19.0) + 0.21, -19.0),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 101.5, ctx.getHeight(101.5, -14.0) + 0.17, -14.0),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 104.5, ctx.getHeight(104.5, -19.2) + 0.17, -19.2),
    makeReliefBox(0.78, 0.48, 0.58, 'agedIronwood', 106.2, ctx.getHeight(106.2, -17.5) + 0.24, -17.5),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 106.2, ctx.getHeight(106.2, -18.1) + 0.15, -18.1),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 106.2, ctx.getHeight(106.2, -16.9) + 0.15, -16.9)
  );
  hkW7Glow.push(new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(103.1, sk7Y + 2.15, -16.5));
  hkW7Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(102.0, ctx.getHeight(102.0, -15.5) + 0.45, -15.5));
  for (const lz of [-15.0, -18.5]) {
    const ly7 = ctx.getHeight(97.5, lz);
    hkW7Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(97.5, ly7 + 1.48, lz));
    hkW7Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(97.5, ly7 + 3.05, lz));
  }
  for (const [ex, ez] of [[101.8, -17.5], [103.5, -19.0]] as const) {
    const ey7 = ctx.getHeight(ex, ez);
    hkW7Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', ex, ey7 + 0.72, ez),
      makeReliefBox(0.95, 0.74, 0.10, 'weatheredLimeStucco', ex, ey7 + 1.08, ez + 0.08)
    );
  }
  for (let i = 0; i < 4; i++) {
    const bz = -14.5 - i * 1.5;
    hkW7Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', 96.2, ctx.getHeight(96.2, bz) + 0.33, bz));
  }

  // 2086-2100. Far-North Hàng Bạc Cultural Square (96.0..108.0, 53.2..59.2) & Đảo Ngọc West Quay Accents
  const nk7Y = ctx.getHeight(104.5, 56.5);
  hkW7Atlas.push(
    makeReliefBox(2.4, 2.30, 2.2, 'agedIronwood', 104.5, nk7Y + 1.15, 56.5),
    makeReliefBox(3.0, 0.26, 2.8, 'ngoiMuiHaiMossy', 104.5, nk7Y + 2.40, 56.5),
    makeReliefBox(0.75, 0.14, 2.1, 'tamBaoGoldLacquer', 103.0, nk7Y + 2.00, 56.5),
    makeReliefCyl(0.50, 0.32, 0.62, 4, 'monolithicStoneDrum', 99.5, ctx.getHeight(99.5, 56.0) + 0.31, 56.0),
    makeReliefBox(1.65, 0.34, 1.05, 'batTrangFloor', 103.8, ctx.getHeight(103.8, 54.2) + 0.17, 54.2),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 105.0, ctx.getHeight(106.5, 55.5) + 1.65, 55.5),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 108.0, ctx.getHeight(106.5, 55.5) + 1.65, 55.5),
    makeReliefBox(3.4, 0.24, 0.22, 'tamBaoGoldLacquer', 106.5, ctx.getHeight(106.5, 55.5) + 3.42, 55.5),
    makeReliefBox(1.20, 0.42, 0.62, 'agedIronwood', 106.2, ctx.getHeight(106.2, 53.2) + 0.56, 53.2),
    makeReliefCyl(0.32, 0.24, 0.62, 4, 'monolithicStoneDrum', 59.5, ngocY + 0.31, 1.0),
    makeReliefBox(0.86, 1.38, 0.22, 'thapButSandstone', 95.8, ctx.getHeight(95.8, -13.5) + 0.69, -13.5)
  );
  hkW7Gold.push(new THREE.BoxGeometry(0.12, 0.46, 2.2).translate(61.2, ngocSanctY + 3.35, 3.0));
  hkW7Bronze.push(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(105.8, ctx.getHeight(106.2, 53.2) + 0.32, 53.2),
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(106.6, ctx.getHeight(106.2, 53.2) + 0.32, 53.2)
  );
  hkW7Glow.push(
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(103.1, nk7Y + 2.10, 56.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(105.6, ctx.getHeight(106.5, 55.5) + 3.12, 55.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(106.5, ctx.getHeight(106.5, 55.5) + 3.12, 55.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(107.4, ctx.getHeight(106.5, 55.5) + 3.12, 55.5)
  );
  for (const lz of [54.5, 58.0]) {
    hkW7Atlas.push(makeReliefBox(0.50, 0.42, 1.55, 'agedIronwood', 97.5, ctx.getHeight(97.5, lz) + 0.21, lz));
    hkW7Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(101.5, ctx.getHeight(101.5, lz) + 1.48, lz));
    hkW7Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(101.5, ctx.getHeight(101.5, lz) + 3.05, lz));
  }
  for (let i = 0; i < 4; i++) {
    const bx = 96.0 + i * 3.0;
    hkW7Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 59.2) + 0.33, 59.2));
  }
  for (const dz of [-1.2, 4.8]) {
    hkW7Atlas.push(
      makeReliefBox(0.38, 0.94, 0.38, 'monolithicStoneDrum', 59.5, ngocY + 0.47, dz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', 59.5, ngocY + 1.02, dz)
    );
  }

  const hkW7AtlasMesh = createMergedMesh('HoanKiemWave7AtlasMesh', hkW7Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW7AtlasMesh) group.add(hkW7AtlasMesh);
  const hkW7GoldMesh = createMergedMesh('HoanKiemWave7GoldMesh', hkW7Gold, ctx.materials.gold, false, false);
  if (hkW7GoldMesh) group.add(hkW7GoldMesh);
  const hkW7BronzeMesh = createMergedMesh('HoanKiemWave7BronzeMesh', hkW7Bronze, ctx.materials.bronze, false, true);
  if (hkW7BronzeMesh) group.add(hkW7BronzeMesh);
  const hkW7GlowMesh = createMergedMesh('HoanKiemWave7GlowMesh', hkW7Glow, glowMat, false, false);
  if (hkW7GlowMesh) group.add(hkW7GlowMesh);

  // =================================================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADE (Items 2451..2500 — castShadow = false, 0 new materials)
  // =================================================================================================
  const hkW8Atlas: THREE.BufferGeometry[] = [];
  const hkW8Gold: THREE.BufferGeometry[] = [];
  const hkW8Bronze: THREE.BufferGeometry[] = [];
  const hkW8Glow: THREE.BufferGeometry[] = [];

  // 2451-2462. 11th & 12th Outer Hàng Ngang / Cầu Gỗ Colonial Tube-House Shophouses (116.5, -24.5 & 62.5)
  for (const sz of [-24.5, 62.5]) {
    const sy8 = ctx.getHeight(116.5, sz);
    hkW8Atlas.push(
      makeReliefBox(5.2, 6.2, 5.4, 'thapRuaOchrePebble', 116.5, sy8 + 3.10, sz),
      makeReliefBox(5.8, 0.36, 6.0, 'ngoiMuiHaiMossy', 116.5, sy8 + 6.32, sz),
      makeReliefBox(0.85, 0.16, 3.4, 'monolithicStoneDrum', 113.6, sy8 + 3.25, sz),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 113.85, sy8 + 4.20, sz - 1.15),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 113.85, sy8 + 4.20, sz + 1.15),
      makeReliefBox(1.10, 0.18, 3.6, 'tamBaoGoldLacquer', 113.45, sy8 + 2.45, sz),
      makeReliefBox(0.32, 0.16, 5.6, 'monolithicStoneDrum', 113.5, ctx.getHeight(113.5, sz) + 0.08, sz)
    );
    hkW8Bronze.push(new THREE.BoxGeometry(0.08, 0.82, 3.4).translate(113.22, sy8 + 3.74, sz));
    hkW8Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(113.82, sy8 + 2.85, sz));
  }
  hkW8Atlas.push(
    makeReliefBox(0.65, 0.88, 1.55, 'agedIronwood', 113.2, ctx.getHeight(113.2, 61.5) + 0.44, 61.5),
    makeReliefBox(0.65, 0.88, 1.55, 'agedIronwood', 113.2, ctx.getHeight(113.2, -23.5) + 0.44, -23.5)
  );

  // 2463-2472. Cầu Gỗ Street Tea/Lantern Kiosk (116.5, 25.0), Alley Arch, Cabinet, Bike Rack, Mailbox & Sign
  const cg8Y = ctx.getHeight(116.5, 25.0);
  hkW8Atlas.push(
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 116.5, cg8Y + 1.58, 23.4),
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 116.5, cg8Y + 1.58, 26.6),
    makeReliefBox(0.95, 0.28, 4.0, 'ngoiMuiHaiMossy', 116.5, cg8Y + 3.34, 25.0),
    makeReliefBox(0.68, 0.96, 1.45, 'agedIronwood', 115.5, cg8Y + 0.48, 25.0),
    makeReliefBox(1.35, 0.42, 0.48, 'agedIronwood', 116.5, cg8Y + 0.21, 28.0),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', 115.2, cg8Y + 0.26, 22.8),
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 116.5, ctx.getHeight(116.5, -20.5) + 1.58, -19.5),
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 116.5, ctx.getHeight(116.5, -20.5) + 1.58, -21.5),
    makeReliefBox(0.68, 0.42, 2.8, 'thapRuaOchrePebble', 116.5, ctx.getHeight(116.5, -20.5) + 3.25, -20.5),
    makeReliefBox(0.42, 1.18, 0.42, 'tamBaoGoldLacquer', 113.0, ctx.getHeight(113.0, -22.2) + 0.59, -22.2)
  );
  hkW8Glow.push(
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(116.5, cg8Y + 2.98, 24.1),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(116.5, cg8Y + 2.98, 25.9)
  );
  hkW8Bronze.push(
    new THREE.BoxGeometry(0.62, 1.35, 0.42).translate(113.5, ctx.getHeight(113.5, 60.2) + 0.68, 60.2),
    new THREE.BoxGeometry(0.48, 0.58, 1.85).translate(113.5, ctx.getHeight(113.5, 64.8) + 0.29, 64.8),
    new THREE.CylinderGeometry(0.05, 0.07, 2.40, 4).translate(113.0, ctx.getHeight(113.0, -26.2) + 1.20, -26.2)
  );
  hkW8Gold.push(new THREE.BoxGeometry(0.08, 0.26, 0.65).translate(113.0, ctx.getHeight(113.0, -26.2) + 2.25, -26.2));

  // 2473-2486. Far-South Hoàn Kiếm Lakeside Viewing Pavilion & Promenade (96.2..108.5, -22.2..-27.6)
  const sp8Y = ctx.getHeight(101.5, -25.0);
  hkW8Atlas.push(
    makeReliefBox(3.8, 0.34, 3.8, 'monolithicStoneDrum', 101.5, sp8Y + 0.17, -25.0),
    makeReliefBox(4.4, 0.28, 4.4, 'ngoiMuiHaiMossy', 101.5, sp8Y + 2.86, -25.0),
    makeReliefCyl(0.46, 0.30, 0.60, 4, 'monolithicStoneDrum', 101.5, sp8Y + 0.64, -25.0),
    makeReliefBox(0.34, 0.58, 6.2, 'monolithicStoneDrum', 96.2, ctx.getHeight(96.2, -25.0) + 0.29, -25.0),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.2, ctx.getHeight(99.2, -22.5) + 0.21, -22.5),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.2, ctx.getHeight(99.2, -27.2) + 0.21, -27.2),
    makeReliefBox(1.55, 0.42, 0.50, 'monolithicStoneDrum', 105.0, ctx.getHeight(105.0, -27.2) + 0.21, -27.2),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 105.0, ctx.getHeight(105.0, -22.5) + 0.17, -22.5),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 107.8, ctx.getHeight(107.8, -26.5) + 0.17, -26.5),
    makeReliefBox(0.78, 0.48, 0.58, 'agedIronwood', 108.2, ctx.getHeight(108.2, -25.0) + 0.24, -25.0),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 108.2, ctx.getHeight(108.2, -25.6) + 0.15, -25.6),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 108.2, ctx.getHeight(108.2, -24.4) + 0.15, -24.4)
  );
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.45, 1.45]) {
      hkW8Atlas.push(makeReliefCyl(0.09, 0.11, 2.65, 4, 'agedIronwood', 101.5 + dx, sp8Y + 1.44, -25.0 + dz));
    }
  }
  hkW8Glow.push(new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(101.5, sp8Y + 2.58, -25.0));
  hkW8Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(104.2, ctx.getHeight(104.2, -24.0) + 0.45, -24.0));
  for (const lz of [-23.0, -27.0]) {
    const ly8 = ctx.getHeight(97.5, lz);
    hkW8Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(97.5, ly8 + 1.48, lz));
    hkW8Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(97.5, ly8 + 3.05, lz));
  }
  for (const [ex, ez] of [[105.5, -25.0], [107.2, -23.5]] as const) {
    const ey8 = ctx.getHeight(ex, ez);
    hkW8Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', ex, ey8 + 0.72, ez),
      makeReliefBox(0.95, 0.74, 0.10, 'weatheredLimeStucco', ex, ey8 + 1.08, ez + 0.08)
    );
  }
  for (let i = 0; i < 4; i++) {
    const bz = -22.2 - i * 1.8;
    hkW8Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', 96.2, ctx.getHeight(96.2, bz) + 0.33, bz));
  }

  // 2487-2500. Far-North Hàng Ngang Lakeside Scholar Pavilion & Cultural Plaza (96.5..108.5, 61.0..67.2)
  const np8Y = ctx.getHeight(102.5, 64.0);
  hkW8Atlas.push(
    makeReliefBox(3.8, 0.34, 3.8, 'monolithicStoneDrum', 102.5, np8Y + 0.17, 64.0),
    makeReliefBox(4.4, 0.28, 4.4, 'ngoiMuiHaiMossy', 102.5, np8Y + 2.86, 64.0),
    makeReliefCyl(0.48, 0.30, 0.60, 4, 'monolithicStoneDrum', 102.5, np8Y + 0.64, 64.0),
    makeReliefBox(1.65, 0.34, 1.05, 'batTrangFloor', 105.5, ctx.getHeight(105.5, 61.8) + 0.17, 61.8),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 106.0, ctx.getHeight(107.5, 64.0) + 1.65, 64.0),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 109.0, ctx.getHeight(107.5, 64.0) + 1.65, 64.0),
    makeReliefBox(3.4, 0.24, 0.22, 'tamBaoGoldLacquer', 107.5, ctx.getHeight(107.5, 64.0) + 3.42, 64.0),
    makeReliefBox(1.20, 0.42, 0.62, 'agedIronwood', 107.2, ctx.getHeight(107.2, 61.2) + 0.56, 61.2),
    makeReliefBox(0.86, 1.38, 0.22, 'thapButSandstone', 96.5, ctx.getHeight(96.5, 61.5) + 0.69, 61.5)
  );
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.45, 1.45]) {
      hkW8Atlas.push(makeReliefCyl(0.09, 0.11, 2.65, 4, 'agedIronwood', 102.5 + dx, np8Y + 1.44, 64.0 + dz));
    }
  }
  hkW8Bronze.push(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(106.8, ctx.getHeight(107.2, 61.2) + 0.32, 61.2),
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(107.6, ctx.getHeight(107.2, 61.2) + 0.32, 61.2)
  );
  hkW8Glow.push(
    new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(102.5, np8Y + 2.58, 64.0),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(106.6, ctx.getHeight(107.5, 64.0) + 3.12, 64.0),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(107.5, ctx.getHeight(107.5, 64.0) + 3.12, 64.0),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(108.4, ctx.getHeight(107.5, 64.0) + 3.12, 64.0)
  );
  for (const lz of [62.0, 66.0]) {
    hkW8Atlas.push(makeReliefBox(0.50, 0.42, 1.55, 'agedIronwood', 97.8, ctx.getHeight(97.8, lz) + 0.21, lz));
    hkW8Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(99.5, ctx.getHeight(99.5, lz) + 1.48, lz));
    hkW8Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(99.5, ctx.getHeight(99.5, lz) + 3.05, lz));
  }
  for (let i = 0; i < 4; i++) {
    const bx = 96.5 + i * 3.0;
    hkW8Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 67.2) + 0.33, 67.2));
  }
  for (const dz of [63.5, 65.5]) {
    const dy8 = ctx.getHeight(96.5, dz);
    hkW8Atlas.push(
      makeReliefBox(0.38, 0.94, 0.38, 'monolithicStoneDrum', 96.5, dy8 + 0.47, dz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', 96.5, dy8 + 1.02, dz)
    );
  }

  const hkW8AtlasMesh = createMergedMesh('HoanKiemWave8AtlasMesh', hkW8Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW8AtlasMesh) group.add(hkW8AtlasMesh);
  const hkW8GoldMesh = createMergedMesh('HoanKiemWave8GoldMesh', hkW8Gold, ctx.materials.gold, false, false);
  if (hkW8GoldMesh) group.add(hkW8GoldMesh);
  const hkW8BronzeMesh = createMergedMesh('HoanKiemWave8BronzeMesh', hkW8Bronze, ctx.materials.bronze, false, true);
  if (hkW8BronzeMesh) group.add(hkW8BronzeMesh);
  const hkW8GlowMesh = createMergedMesh('HoanKiemWave8GlowMesh', hkW8Glow, glowMat, false, false);
  if (hkW8GlowMesh) group.add(hkW8GlowMesh);

  // =================================================================================================
  // WAVE 9 REAL-PHOTO VISUAL QC UPGRADE (Items 2851..2900 — castShadow = false, 0 new materials)
  // =================================================================================================
  const hkW9Atlas: THREE.BufferGeometry[] = [];
  const hkW9Gold: THREE.BufferGeometry[] = [];
  const hkW9Bronze: THREE.BufferGeometry[] = [];
  const hkW9Glow: THREE.BufferGeometry[] = [];

  // 2851-2862. 13th & 14th Outer Hàng Bồ / Hàng Gai Colonial Tube-House Shophouses (116.5, -32.5 & 70.5)
  for (const sz of [-32.5, 70.5]) {
    const sy9 = ctx.getHeight(116.5, sz);
    hkW9Atlas.push(
      makeReliefBox(5.2, 6.2, 5.4, 'thapRuaOchrePebble', 116.5, sy9 + 3.10, sz),
      makeReliefBox(5.8, 0.36, 6.0, 'ngoiMuiHaiMossy', 116.5, sy9 + 6.32, sz),
      makeReliefBox(0.85, 0.16, 3.4, 'monolithicStoneDrum', 113.6, sy9 + 3.25, sz),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 113.85, sy9 + 4.20, sz - 1.15),
      makeReliefBox(0.14, 1.35, 0.85, 'hoaChanhGreenTile', 113.85, sy9 + 4.20, sz + 1.15),
      makeReliefBox(1.10, 0.18, 3.6, 'tamBaoGoldLacquer', 113.45, sy9 + 2.45, sz),
      makeReliefBox(0.32, 0.16, 5.6, 'monolithicStoneDrum', 113.5, ctx.getHeight(113.5, sz) + 0.08, sz)
    );
    hkW9Bronze.push(new THREE.BoxGeometry(0.08, 0.82, 3.4).translate(113.22, sy9 + 3.74, sz));
    hkW9Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(113.82, sy9 + 2.85, sz));
  }
  hkW9Atlas.push(
    makeReliefBox(0.65, 0.88, 1.55, 'agedIronwood', 113.2, ctx.getHeight(113.2, 69.5) + 0.44, 69.5),
    makeReliefBox(0.65, 0.88, 1.55, 'agedIronwood', 113.2, ctx.getHeight(113.2, -31.5) + 0.44, -31.5)
  );

  // 2863-2872. Hàng Bồ Heritage Craft Kiosk (116.5, -39.5), Hàng Gai Alley Arch (116.5, 75.5), Cabinet, Bike Rack, Mailbox & Sign
  const hb9Y = ctx.getHeight(116.5, -39.5);
  hkW9Atlas.push(
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 116.5, hb9Y + 1.52, -41.1),
    makeReliefBox(0.24, 3.35, 0.24, 'agedIronwood', 116.5, hb9Y + 1.52, -37.9),
    makeReliefBox(0.95, 0.28, 4.0, 'ngoiMuiHaiMossy', 116.5, hb9Y + 3.30, -39.5),
    makeReliefBox(0.68, 0.96, 1.45, 'agedIronwood', 115.5, hb9Y + 0.48, -39.5),
    makeReliefBox(1.35, 0.42, 0.48, 'agedIronwood', 116.5, ctx.getHeight(116.5, -36.5) + 0.21, -36.5),
    makeReliefCyl(0.24, 0.28, 0.52, 4, 'hoaChanhGreenTile', 115.2, ctx.getHeight(115.2, -41.7) + 0.26, -41.7),
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 116.5, ctx.getHeight(116.5, 75.5) + 1.50, 74.5),
    makeReliefBox(0.45, 3.15, 0.45, 'thapRuaOchrePebble', 116.5, ctx.getHeight(116.5, 75.5) + 1.50, 76.5),
    makeReliefBox(0.68, 0.42, 2.8, 'thapRuaOchrePebble', 116.5, ctx.getHeight(116.5, 75.5) + 3.20, 75.5),
    makeReliefBox(0.42, 1.18, 0.42, 'tamBaoGoldLacquer', 113.0, ctx.getHeight(113.0, -30.2) + 0.59, -30.2)
  );
  hkW9Glow.push(
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(116.5, hb9Y + 2.94, -40.4),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(116.5, hb9Y + 2.94, -38.6)
  );
  hkW9Bronze.push(
    new THREE.BoxGeometry(0.62, 1.35, 0.42).translate(113.5, ctx.getHeight(113.5, 68.2) + 0.68, 68.2),
    new THREE.BoxGeometry(0.48, 0.58, 1.85).translate(113.5, ctx.getHeight(113.5, 72.8) + 0.29, 72.8),
    new THREE.CylinderGeometry(0.05, 0.07, 2.40, 4).translate(113.0, ctx.getHeight(113.0, -34.2) + 1.08, -34.2)
  );
  hkW9Gold.push(new THREE.BoxGeometry(0.08, 0.26, 0.65).translate(113.0, ctx.getHeight(113.0, -34.2) + 2.20, -34.2));

  // 2873-2886. Far-South Hoàn Kiếm Lakeside Flower-Garden Pavilion & Promenade (96.2..108.5, -31.2..-36.6)
  const sp9Y = ctx.getHeight(101.5, -34.0);
  hkW9Atlas.push(
    makeReliefBox(3.8, 0.34, 3.8, 'monolithicStoneDrum', 101.5, sp9Y + 0.17, -34.0),
    makeReliefBox(4.4, 0.28, 4.4, 'ngoiMuiHaiMossy', 101.5, sp9Y + 2.86, -34.0),
    makeReliefCyl(0.46, 0.30, 0.60, 4, 'monolithicStoneDrum', 101.5, sp9Y + 0.64, -34.0),
    makeReliefBox(0.34, 0.58, 6.2, 'monolithicStoneDrum', 96.2, ctx.getHeight(96.2, -34.0) + 0.29, -34.0),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.2, ctx.getHeight(99.2, -31.5) + 0.21, -31.5),
    makeReliefBox(0.50, 0.42, 1.55, 'monolithicStoneDrum', 99.2, ctx.getHeight(99.2, -36.2) + 0.21, -36.2),
    makeReliefBox(1.55, 0.42, 0.50, 'monolithicStoneDrum', 105.0, ctx.getHeight(105.0, -36.2) + 0.21, -36.2),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 105.0, ctx.getHeight(105.0, -31.5) + 0.17, -31.5),
    makeReliefBox(1.75, 0.34, 1.05, 'batTrangFloor', 107.8, ctx.getHeight(107.8, -35.5) + 0.17, -35.5),
    makeReliefBox(0.78, 0.48, 0.58, 'agedIronwood', 108.2, ctx.getHeight(108.2, -34.0) + 0.24, -34.0),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 108.2, ctx.getHeight(108.2, -34.6) + 0.15, -34.6),
    makeReliefBox(0.32, 0.30, 0.32, 'agedIronwood', 108.2, ctx.getHeight(108.2, -33.4) + 0.15, -33.4)
  );
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.45, 1.45]) {
      hkW9Atlas.push(makeReliefCyl(0.09, 0.11, 2.65, 4, 'agedIronwood', 101.5 + dx, sp9Y + 1.42, -34.0 + dz));
    }
  }
  hkW9Glow.push(new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(101.5, sp9Y + 2.58, -34.0));
  hkW9Bronze.push(new THREE.CylinderGeometry(0.16, 0.12, 0.90, 4).translate(104.2, ctx.getHeight(104.2, -33.0) + 0.45, -33.0));
  for (const lz of [-32.0, -36.0]) {
    const ly9 = ctx.getHeight(97.5, lz);
    hkW9Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(97.5, ly9 + 1.38, lz));
    hkW9Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(97.5, ly9 + 2.96, lz));
  }
  for (const [ex, ez] of [[105.5, -34.0], [107.2, -32.5]] as const) {
    const ey9 = ctx.getHeight(ex, ez);
    hkW9Atlas.push(
      makeReliefBox(0.10, 1.45, 0.10, 'agedIronwood', ex, ey9 + 0.65, ez),
      makeReliefBox(0.95, 0.74, 0.10, 'weatheredLimeStucco', ex, ey9 + 1.08, ez + 0.08)
    );
  }
  for (let i = 0; i < 4; i++) {
    const bz = -31.2 - i * 1.8;
    hkW9Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', 96.2, ctx.getHeight(96.2, bz) + 0.33, bz));
  }

  // 2887-2900. Far-North Hàng Gai Lakeside Tea-Garden Pavilion & Cultural Plaza (96.5..109.0, 69.7..75.7)
  const np9Y = ctx.getHeight(102.5, 72.5);
  hkW9Atlas.push(
    makeReliefBox(3.8, 0.34, 3.8, 'monolithicStoneDrum', 102.5, np9Y + 0.17, 72.5),
    makeReliefBox(4.4, 0.28, 4.4, 'ngoiMuiHaiMossy', 102.5, np9Y + 2.86, 72.5),
    makeReliefCyl(0.48, 0.30, 0.60, 4, 'monolithicStoneDrum', 102.5, np9Y + 0.64, 72.5),
    makeReliefBox(1.65, 0.34, 1.05, 'batTrangFloor', 105.5, ctx.getHeight(105.5, 70.3) + 0.17, 70.3),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 106.0, ctx.getHeight(107.5, 72.5) + 1.60, 72.5),
    makeReliefBox(0.20, 3.50, 0.20, 'tamBaoGoldLacquer', 109.0, ctx.getHeight(107.5, 72.5) + 1.60, 72.5),
    makeReliefBox(3.4, 0.24, 0.22, 'tamBaoGoldLacquer', 107.5, ctx.getHeight(107.5, 72.5) + 3.42, 72.5),
    makeReliefBox(1.20, 0.42, 0.62, 'agedIronwood', 107.2, ctx.getHeight(107.2, 69.7) + 0.56, 69.7),
    makeReliefBox(0.86, 1.38, 0.22, 'thapButSandstone', 96.5, ctx.getHeight(96.5, 70.0) + 0.69, 70.0)
  );
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.45, 1.45]) {
      hkW9Atlas.push(makeReliefCyl(0.09, 0.11, 2.65, 4, 'agedIronwood', 102.5 + dx, np9Y + 1.42, 72.5 + dz));
    }
  }
  hkW9Bronze.push(
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(106.8, ctx.getHeight(107.2, 69.7) + 0.32, 69.7),
    new THREE.CylinderGeometry(0.28, 0.28, 0.08, 4).rotateX(Math.PI * 0.5).translate(107.6, ctx.getHeight(107.2, 69.7) + 0.32, 69.7)
  );
  hkW9Glow.push(
    new THREE.BoxGeometry(0.20, 0.24, 0.20).translate(102.5, np9Y + 2.58, 72.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(106.6, ctx.getHeight(107.5, 72.5) + 3.12, 72.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(107.5, ctx.getHeight(107.5, 72.5) + 3.12, 72.5),
    new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(108.4, ctx.getHeight(107.5, 72.5) + 3.12, 72.5)
  );
  for (const lz of [70.5, 74.5]) {
    hkW9Atlas.push(makeReliefBox(0.50, 0.42, 1.55, 'agedIronwood', 97.8, ctx.getHeight(97.8, lz) + 0.21, lz));
    hkW9Bronze.push(new THREE.CylinderGeometry(0.05, 0.08, 2.95, 4).translate(99.5, ctx.getHeight(99.5, lz) + 1.38, lz));
    hkW9Glow.push(new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(99.5, ctx.getHeight(99.5, lz) + 2.96, lz));
  }
  for (let i = 0; i < 4; i++) {
    const bx = 96.5 + i * 3.0;
    hkW9Atlas.push(makeReliefCyl(0.13, 0.16, 0.66, 4, 'monolithicStoneDrum', bx, ctx.getHeight(bx, 75.7) + 0.33, 75.7));
  }
  for (const dz of [72.0, 74.0]) {
    const dy9 = ctx.getHeight(96.5, dz);
    hkW9Atlas.push(
      makeReliefBox(0.38, 0.94, 0.38, 'monolithicStoneDrum', 96.5, dy9 + 0.47, dz),
      makeReliefBox(0.52, 0.16, 0.52, 'ngoiMuiHaiMossy', 96.5, dy9 + 1.02, dz)
    );
  }

  const hkW9AtlasMesh = createMergedMesh('HoanKiemWave9AtlasMesh', hkW9Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW9AtlasMesh) group.add(hkW9AtlasMesh);
  const hkW9GoldMesh = createMergedMesh('HoanKiemWave9GoldMesh', hkW9Gold, ctx.materials.gold, false, false);
  if (hkW9GoldMesh) group.add(hkW9GoldMesh);
  const hkW9BronzeMesh = createMergedMesh('HoanKiemWave9BronzeMesh', hkW9Bronze, ctx.materials.bronze, false, true);
  if (hkW9BronzeMesh) group.add(hkW9BronzeMesh);
  const hkW9GlowMesh = createMergedMesh('HoanKiemWave9GlowMesh', hkW9Glow, glowMat, false, false);
  if (hkW9GlowMesh) group.add(hkW9GlowMesh);

  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-B07', 'HV-D01', 'HV-D02', 'HV-D06', 'HV-D10',
    'HV-D12', 'HV-H02', 'HV-I01', 'HV-NEW-MB-12'
  ]);

  ctx.scene.add(group);
  return group;
}
