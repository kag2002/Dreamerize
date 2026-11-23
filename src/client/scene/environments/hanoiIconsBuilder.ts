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
  // Lush temple garden backdrop framing behind Chùa Một Cột
  const gardenTrees: Array<[number, number, number, number]> = [
    [-66.0, 26.0, 1.15, 701],
    [-64.0, 39.0, 1.22, 702],
    [-38.5, 38.0, 1.05, 703],
    [-39.5, 44.0, 1.02, 704]
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
  const pergY = ctx.getHeight(teaX, teaZ - 4.2);
  for (const px of [teaX - 1.6, teaX + 1.6]) {
    for (const pz of [teaZ - 5.5, teaZ - 2.9]) {
      opcW2Atlas.push(makeReliefBox(0.14, 2.75, 0.14, 'agedIronwood', px, pergY + 1.24, pz));
    }
  }
  for (let b = -1.4; b <= 1.45; b += 0.7) {
    opcW2Atlas.push(makeReliefBox(3.6, 0.10, 0.12, 'agedIronwood', teaX, pergY + 2.58, teaZ - 4.2 + b));
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

  const opcW2AtlasMesh = createMergedMesh('OnePillarWave2AtlasMesh', opcW2Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (opcW2AtlasMesh) group.add(opcW2AtlasMesh);
  const opcW2GoldMesh = createMergedMesh('OnePillarWave2GoldMesh', opcW2Gold, ctx.materials.gold, false, false);
  if (opcW2GoldMesh) group.add(opcW2GoldMesh);
  const opcW2BronzeMesh = createMergedMesh('OnePillarWave2BronzeMesh', opcW2Bronze, ctx.materials.bronze, false, true);
  if (opcW2BronzeMesh) group.add(opcW2BronzeMesh);
  const opcW2GlowMesh = createMergedMesh('OnePillarWave2GlowMesh', opcW2Glow, glowMat, false, false);
  if (opcW2GlowMesh) group.add(opcW2GlowMesh);

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
    [69.0, -3.5, 1.15, 603, false],  // Lush Lộc Vừng on Đảo Ngọc
    [77.5, -4.8, 1.22, 604, false],  // Leaning Lộc Vừng behind Đắc Nguyệt Lâu
    [104.5, 6.2, 1.18, 605, false],  // Lush lakeside Lộc Vừng near Cầu Thê Húc east shore
    [90.2, 15.8, 0.98, 606, true],   // Weeping willow left of promenade (leaves Đài Nghiên & 3 toads 100% clear!)
    [107.2, 18.5, 1.25, 607, false]  // Backdrop canopy behind Tháp Bút
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
  addFoliageCanopy(barkParts, leafParts, 105.0, ctx.getHeight(105.0, 21.0), 21.0, 0.92, 619, [0xd83b28, 0x2e6f2a, 0xe85a38]);
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

  const hkW2AtlasMesh = createMergedMesh('HoanKiemWave2AtlasMesh', hkW2Atlas, pack.hanoiIconsMasterAtlasMat, false, true);
  if (hkW2AtlasMesh) group.add(hkW2AtlasMesh);
  const hkW2GoldMesh = createMergedMesh('HoanKiemWave2GoldMesh', hkW2Gold, ctx.materials.gold, false, false);
  if (hkW2GoldMesh) group.add(hkW2GoldMesh);
  const hkW2BronzeMesh = createMergedMesh('HoanKiemWave2BronzeMesh', hkW2Bronze, ctx.materials.bronze, false, true);
  if (hkW2BronzeMesh) group.add(hkW2BronzeMesh);
  const hkW2GlowMesh = createMergedMesh('HoanKiemWave2GlowMesh', hkW2Glow, glowMat, false, false);
  if (hkW2GlowMesh) group.add(hkW2GlowMesh);

  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-B07', 'HV-D01', 'HV-D02', 'HV-D06', 'HV-D10',
    'HV-D12', 'HV-H02', 'HV-I01', 'HV-NEW-MB-12'
  ]);

  ctx.scene.add(group);
  return group;
}
