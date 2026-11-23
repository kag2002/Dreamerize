import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createIncenseSmokeSystem,
  createLanternCoreGeometry,
  createLotusFinialParts,
  createRibbedLanternShellGeometry,
  createRoseWindowGeometry,
  createVietnameseCurvedRoofGeometry,
  createWavingSilkFlagMaterial
} from './vietnamGeometryHelpers';
import {
  createAncientStoneLanternParts,
  createBronzeCraneOnTortoiseParts,
  createGuardianBeastParts,
  createLotusPetalRingParts,
  createPhoenixFinialParts,
  createPiercedBalustradeParts,
  createSmoothTaperedTubeGeometry,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  createMergedMesh,
  registerAnimatedUniform
} from '../vietnam/geometry/PartsBuilder';
import {
  createThangLongMaterialPack,
  THANG_LONG_PLAQUE_UV,
  THANG_LONG_RELIEF_UV,
  type ThangLongPlaqueKey,
  type ThangLongReliefKey
} from '../textures/thangLongPbrTextures';

/**
 * Hoàng Thành Thăng Long (Imperial Citadel of Thăng Long — Hà Nội) Museum Builder.
 * Implements all 128 QC items (`DM-01..32`, `KT-01..32`, `CH-01..32`, `BM-01..32`):
 *   - Đoan Môn (5-Arch Imperial Gate, Walk-In Emperor Vault & 2-Tier Vọng Lâu)
 *   - Sân Long Trì, Nền & 9-Step Bậc Rồng Đá Điện Kính Thiên (6 Sculpted Lê Dragons & Red-Brown Bronze Cauldron)
 *   - Elongated 2-Story French Colonial Nhà Con Rồng D67 + Walk-In Operations Room
 *   - Cột Cờ Hà Nội (1812 Vauban 3-Tier Flag Tower with Zero-Stretch Bricks, 36 Rosettes, 6 Fan Windows & Vietnam Flag)
 *   - Chính Bắc Môn (Battered Vauban Gate, 2-Story Vọng Lâu, "正 北 門" Plaque & 1882 Cannonball Scars)
 *   - Hậu Lâu (Tĩnh Bắc Lâu 3-Tiered Hybrid Princess Pagoda) & 18 Hoàng Diệu Archaeological Shelter
 */

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

function remapRelief(geo: THREE.BufferGeometry, key: ThangLongReliefKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, THANG_LONG_RELIEF_UV[key], inset);
}

function remapPlaque(geo: THREE.BufferGeometry, key: ThangLongPlaqueKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, THANG_LONG_PLAQUE_UV[key], inset);
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: ThangLongReliefKey,
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

function makeReliefPlane(
  w: number,
  h: number,
  key: ThangLongReliefKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const g = remapRelief(new THREE.PlaneGeometry(w, h), key);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makePlaquePlane(
  w: number,
  h: number,
  key: ThangLongPlaqueKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const g = remapPlaque(new THREE.PlaneGeometry(w, h), key);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makeBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makeCyl(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotZ = 0,
  rotY = 0
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function colorizeGeo(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/**
 * Helper: Distortion-free Sloped 4-Sided Vauban Frustum mapped per-face into `thangLongBrick` (`CH-01..04`, `BM-01`)
 * Eliminates CylinderGeometry horizontal brick UV stretching!
 */
function addMappedVaubanFrustum(
  reliefParts: THREE.BufferGeometry[],
  cx: number,
  yBot: number,
  cz: number,
  botW: number,
  botD: number,
  topW: number,
  topD: number,
  h: number,
  key: ThangLongReliefKey = 'thangLongBrick'
): void {
  const hbW = botW * 0.5;
  const hbD = botD * 0.5;
  const htW = topW * 0.5;
  const htD = topD * 0.5;
  const yTop = yBot + h;
  const faces: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
    // South (+Z)
    [
      new THREE.Vector3(-hbW, yBot, hbD),
      new THREE.Vector3(hbW, yBot, hbD),
      new THREE.Vector3(htW, yTop, htD),
      new THREE.Vector3(-htW, yTop, htD)
    ],
    // North (-Z)
    [
      new THREE.Vector3(hbW, yBot, -hbD),
      new THREE.Vector3(-hbW, yBot, -hbD),
      new THREE.Vector3(-htW, yTop, -htD),
      new THREE.Vector3(htW, yTop, -htD)
    ],
    // East (+X)
    [
      new THREE.Vector3(hbW, yBot, hbD),
      new THREE.Vector3(hbW, yBot, -hbD),
      new THREE.Vector3(htW, yTop, -htD),
      new THREE.Vector3(htW, yTop, htD)
    ],
    // West (-X)
    [
      new THREE.Vector3(-hbW, yBot, -hbD),
      new THREE.Vector3(-hbW, yBot, hbD),
      new THREE.Vector3(-htW, yTop, htD),
      new THREE.Vector3(-htW, yTop, -htD)
    ]
  ];
  for (const [p0, p1, p2, p3] of faces) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z,
      p0.x, p0.y, p0.z,
      p2.x, p2.y, p2.z,
      p3.x, p3.y, p3.z
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    g.translate(cx, 0, cz);
    reliefParts.push(remapRelief(g, key));
  }
  // Top deck cap
  const topCap = remapRelief(new THREE.PlaneGeometry(topW, topD), 'batTrangPaving');
  topCap.rotateX(-Math.PI * 0.5);
  topCap.translate(cx, yTop + 0.01, cz);
  reliefParts.push(topCap);
}

/**
 * Helper: Crisp Flat-Faceted 8-Sided Octagonal Tapered Brick Shaft (`CH-15..17` — ZERO smooth cylinder look!)
 */
function addMappedOctagonalShaft(
  reliefParts: THREE.BufferGeometry[],
  cx: number,
  yBot: number,
  cz: number,
  rBot: number,
  rTop: number,
  h: number,
  key: ThangLongReliefKey = 'thangLongBrick',
  vertBands = 3
): void {
  const segs = 8;
  for (let b = 0; b < vertBands; b++) {
    const t0 = b / vertBands;
    const t1 = (b + 1) / vertBands;
    const y0 = yBot + h * t0;
    const y1 = yBot + h * t1;
    const r0 = THREE.MathUtils.lerp(rBot, rTop, t0);
    const r1 = THREE.MathUtils.lerp(rBot, rTop, t1);
    for (let f = 0; f < segs; f++) {
      const a0 = (f / segs) * Math.PI * 2;
      const a1 = ((f + 1) / segs) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.sin(a0) * r0, y0, Math.cos(a0) * r0);
      const p1 = new THREE.Vector3(Math.sin(a1) * r0, y0, Math.cos(a1) * r0);
      const p2 = new THREE.Vector3(Math.sin(a1) * r1, y1, Math.cos(a1) * r1);
      const p3 = new THREE.Vector3(Math.sin(a0) * r1, y1, Math.cos(a0) * r1);
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array([
        p0.x, p0.y, p0.z,
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p0.x, p0.y, p0.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z
      ]);
      const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      g.computeVertexNormals();
      g.translate(cx, 0, cz);
      reliefParts.push(remapRelief(g, key));
    }
  }
}

/**
 * Helper: Sculpted 15th-Century Lê-Dynasty Stone Dragon Balustrade (`KT-01..10`, Refs 39 & 72!)
 * Features upturned lion-snout head, open jaw/fangs, combed swept-back mane, 7-curve sinuous body,
 * continuous flame dorsal fins, muscular forelegs gripping cloud-pearl plinth, and `mây đao mác` side relief!
 */
function addLeDynastyStoneDragon(
  reliefParts: THREE.BufferGeometry[],
  x: number,
  yBot: number,
  zBot: number,
  yTop: number,
  zTop: number,
  scale: number,
  facingSouth = true
): void {
  const dirZ = facingSouth ? 1 : -1; // +1 means head at zBot facing +Z (South); -1 means head at zBot facing -Z (North)
  const lenZ = Math.abs(zTop - zBot);
  const dH = yTop - yBot;
  const slopeAng = Math.atan2(dH, lenZ);

  // 1. Sloped triangular stair stringer slab carved with `mây đao mác` cloud-flame side reliefs (`KT-06`)
  const slabSegs = 6;
  for (let i = 0; i < slabSegs; i++) {
    const tm = (i + 0.5) / slabSegs;
    const sz = THREE.MathUtils.lerp(zBot, zTop, tm);
    const sy = THREE.MathUtils.lerp(yBot, yTop, tm);
    const segLen = (lenZ / slabSegs) * 1.05;
    reliefParts.push(
      makeReliefBox(
        0.54 * scale,
        0.62 * scale,
        segLen,
        'dragonReliefStone',
        x,
        sy + 0.16 * scale,
        sz,
        0,
        facingSouth ? slopeAng : -slopeAng
      )
    );
  }

  // 2. High-Amplitude 7-Curve Sinuous Undulating Dragon Spine (`KT-03`, `KT-09`)
  const bodyPts: THREE.Vector3[] = [];
  const curveSamples = 18;
  for (let i = 0; i <= curveSamples; i++) {
    const t = i / curveSamples;
    const pz = THREE.MathUtils.lerp(zBot + dirZ * 0.22 * scale, zTop - dirZ * 0.12 * scale, t);
    const baseLineY = THREE.MathUtils.lerp(yBot + 0.58 * scale, yTop + 0.50 * scale, t);
    // 7 distinct undulating arches climbing the stair slope (with neck arch lifted cleanly for pass-through!)
    const waveY = Math.sin(t * Math.PI * 7.0) * 0.14 * scale + (t < 0.18 ? 0.16 * scale : 0);
    const waveX = Math.sin(t * Math.PI * 5.0) * 0.07 * scale;
    bodyPts.push(new THREE.Vector3(x + waveX, baseLineY + waveY, pz));
  }
  const bodyCurve = new THREE.CatmullRomCurve3(bodyPts);
  const bodyGeo = createSmoothTaperedTubeGeometry(bodyCurve, 22, 8, (t) => (0.22 - t * 0.13) * scale);
  reliefParts.push(remapRelief(bodyGeo, 'dragonReliefStone'));

  // 3. Continuous Jagged Flame-Shaped Dorsal Fin Plates (*Vây Lưng*, `KT-04`)
  for (let f = 1; f < 16; f++) {
    const t = f / 16;
    const pt = bodyCurve.getPoint(t);
    const finH = (0.20 - t * 0.08) * scale;
    const fin = new THREE.ConeGeometry(0.065 * scale, finH, 4);
    fin.scale(0.45, 1.0, 1.5);
    fin.rotateX(facingSouth ? -0.45 : 0.45);
    fin.translate(pt.x, pt.y + (0.18 - t * 0.06) * scale, pt.z);
    reliefParts.push(remapRelief(fin, 'dragonReliefStone'));
  }

  // 4. Sculpted 15th-Century Lê-Dynasty Dragon Head: Broad Lion Snout, Open Jaw, Swept-Back Combed Mane & Horns (`KT-01`, `KT-02`)
  const hx = x;
  const hy = yBot + 0.86 * scale;
  const hz = zBot + dirZ * 0.26 * scale;
  // Cranium + broad upturned lion snout
  const skull = new THREE.SphereGeometry(0.27 * scale, 10, 8);
  skull.scale(0.95, 0.92, 1.28);
  skull.translate(hx, hy, hz);
  const snout = new THREE.BoxGeometry(0.32 * scale, 0.22 * scale, 0.28 * scale);
  snout.translate(hx, hy + 0.02 * scale, hz + dirZ * 0.28 * scale);
  // Lower open jaw + central flaming pearl inside mouth
  const jaw = new THREE.BoxGeometry(0.28 * scale, 0.12 * scale, 0.26 * scale);
  jaw.rotateX(facingSouth ? 0.28 : -0.28);
  jaw.translate(hx, hy - 0.16 * scale, hz + dirZ * 0.24 * scale);
  const pearl = new THREE.SphereGeometry(0.085 * scale, 7, 6);
  pearl.translate(hx, hy - 0.04 * scale, hz + dirZ * 0.34 * scale);
  reliefParts.push(
    remapRelief(skull, 'dragonReliefStone'),
    remapRelief(snout, 'dragonReliefStone'),
    remapRelief(jaw, 'dragonReliefStone'),
    remapRelief(pearl, 'thanhHoaStone')
  );
  // Ridged brows, swept-back horns & layered combed mane (`bờm rồng`) sweeping behind head (`KT-02`)
  for (const sx of [-1, 1]) {
    const brow = new THREE.BoxGeometry(0.10 * scale, 0.06 * scale, 0.16 * scale);
    brow.translate(hx + sx * 0.16 * scale, hy + 0.15 * scale, hz + dirZ * 0.12 * scale);
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx + sx * 0.12 * scale, hy + 0.18 * scale, hz - dirZ * 0.04 * scale),
      new THREE.Vector3(hx + sx * 0.18 * scale, hy + 0.36 * scale, hz - dirZ * 0.28 * scale),
      new THREE.Vector3(hx + sx * 0.14 * scale, hy + 0.44 * scale, hz - dirZ * 0.48 * scale)
    ]);
    const horn = createSmoothTaperedTubeGeometry(hornCurve, 6, 5, (t) => (0.042 - t * 0.024) * scale);
    // Swept-back mane locks
    const mane = new THREE.ConeGeometry(0.09 * scale, 0.42 * scale, 5);
    mane.rotateX(facingSouth ? -1.15 : 1.15);
    mane.translate(hx + sx * 0.14 * scale, hy + 0.12 * scale, hz - dirZ * 0.32 * scale);
    // Articulated muscular forelegs & 5-clawed talons planted firmly on cloud-pearl plinth (`KT-05`)
    const leg = new THREE.CylinderGeometry(0.085 * scale, 0.105 * scale, 0.56 * scale, 6);
    leg.rotateZ(sx * 0.18);
    leg.translate(hx + sx * 0.22 * scale, yBot + 0.36 * scale, zBot + dirZ * 0.02 * scale);
    const paw = new THREE.SphereGeometry(0.12 * scale, 7, 5);
    paw.scale(1.15, 0.55, 1.35);
    paw.translate(hx + sx * 0.24 * scale, yBot + 0.10 * scale, zBot + dirZ * 0.12 * scale);
    reliefParts.push(
      remapRelief(brow, 'dragonReliefStone'),
      remapRelief(horn, 'dragonReliefStone'),
      remapRelief(mane, 'dragonReliefStone'),
      remapRelief(leg, 'dragonReliefStone'),
      remapRelief(paw, 'dragonReliefStone')
    );
  }
  // Carved grounding cloud-pearl plinth under dragon head & paws (`KT-05`, `KT-10`)
  reliefParts.push(makeReliefBox(0.76 * scale, 0.24 * scale, 0.88 * scale, 'thanhHoaStone', hx, yBot + 0.10 * scale, zBot + dirZ * 0.18 * scale));
}

/**
 * Helper: Mature Hanoi Heritage Canopy Tree (*Xà Cừ* / Banyan — ZERO lollipop icosahedra! `DM-32`, `KT-31`, `CH-30`, `BM-30`)
 */
function addHanoiHeritageTree(
  woodParts: THREE.BufferGeometry[],
  foliageCardParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  height: number,
  canopyRadius: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  const trunkH = height * 0.48;
  woodParts.push(makeCyl(0.24, 0.42, trunkH, 7, x, y + trunkH * 0.5, z));
  const branchCount = 4;
  for (let b = 0; b < branchCount; b++) {
    const a = (b / branchCount) * Math.PI * 2 + rand() * 0.55;
    const len = canopyRadius * (0.68 + rand() * 0.25);
    const bx = x + Math.cos(a) * len * 0.65;
    const bz = z + Math.sin(a) * len * 0.65;
    const by = y + trunkH + height * (0.18 + rand() * 0.16);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y + trunkH * 0.85, z),
      new THREE.Vector3((x + bx) * 0.5, y + trunkH + height * 0.10, (z + bz) * 0.5),
      new THREE.Vector3(bx, by, bz)
    ]);
    woodParts.push(createSmoothTaperedTubeGeometry(curve, 5, 5, (t) => 0.20 - t * 0.11));
  }
  const greens = ['#1f4a1c', '#2b5e24', '#376f2c', '#235220', '#447a32'];
  const cardCount = 26;
  for (let i = 0; i < cardCount; i++) {
    const a = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * canopyRadius;
    const cy = y + trunkH + height * (0.10 + rand() * 0.42) - (rad / canopyRadius) * 0.7;
    const cw = canopyRadius * (0.48 + rand() * 0.36);
    const card = new THREE.PlaneGeometry(cw, cw * 0.78);
    card.rotateX((rand() - 0.5) * 1.15);
    card.rotateY(rand() * Math.PI * 2);
    card.rotateZ((rand() - 0.5) * 0.65);
    card.translate(x + Math.cos(a) * rad, cy, z + Math.sin(a) * rad);
    foliageCardParts.push(colorizeGeo(card, greens[Math.floor(rand() * greens.length)]));
  }
}

/**
 * Helper: Sculpted Vietnamese Heritage Bonsai Planter (`KT-25`, `DM-29`, `BM-29` — replaces faceted green blobs!)
 */
function addHeritageBonsaiPlanter(
  reliefParts: THREE.BufferGeometry[],
  woodParts: THREE.BufferGeometry[],
  foliageCardParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  // Carved rectangular stone pedestal + glazed ceramic planter
  reliefParts.push(makeReliefBox(0.92 * scale, 0.56 * scale, 0.92 * scale, 'thanhHoaStone', x, y + 0.28 * scale, z));
  reliefParts.push(makeReliefBox(0.84 * scale, 0.36 * scale, 0.84 * scale, 'batTrangPaving', x, y + 0.74 * scale, z));
  // Asymmetrical gnarled bonsai trunk
  const tCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, y + 0.88 * scale, z),
    new THREE.Vector3(x + 0.14 * scale, y + 1.24 * scale, z - 0.08 * scale),
    new THREE.Vector3(x - 0.08 * scale, y + 1.62 * scale, z + 0.10 * scale)
  ]);
  woodParts.push(createSmoothTaperedTubeGeometry(tCurve, 6, 5, (t) => (0.11 - t * 0.06) * scale));
  const greens = ['#235420', '#316a2a', '#3d7a32'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.4;
    const r = (0.15 + rand() * 0.42) * scale;
    const card = new THREE.PlaneGeometry(0.46 * scale, 0.36 * scale);
    card.rotateX((rand() - 0.5) * 1.0);
    card.rotateY(rand() * Math.PI * 2);
    card.translate(x + Math.cos(a) * r, y + (1.42 + rand() * 0.42) * scale, z + Math.sin(a) * r);
    foliageCardParts.push(colorizeGeo(card, greens[i % greens.length]));
  }
}

export function buildThangLongCitadelComplex(
  ctx: VietnamBuilderContext,
  stainlessMat: THREE.MeshStandardMaterial,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const cx = 0;
  const cz = -71;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 28.0 },
    { x: cx, z: -95.5, r: 32.0 },
    { x: 38.0, z: -76.0, r: 18.0 },
    { x: -36.0, z: -80.0, r: 16.0 }
  );

  const tl = createThangLongMaterialPack(ctx.renderer);
  ctx.extraMaterials.push(...tl.allMaterials);
  ctx.extraTextures.push(...tl.allTextures);

  const group = new THREE.Group();
  group.name = 'HoangThanhThangLongComplex';

  const reliefParts: THREE.BufferGeometry[] = [];
  const plaqueParts: THREE.BufferGeometry[] = [];
  const whitePlasterParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const foliageCardParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];
  const glassParts: THREE.BufferGeometry[] = [];
  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  // =================================================================================================
  // SECTION 1: ĐOAN MÔN — 5-ARCH IMPERIAL GATE, WALK-IN VAULT & VỌNG LÂU (`DM-01..DM-32`)
  // =================================================================================================
  const plinthH = 0.20;
  const gateDepth = 9.0; // z in [-72.5, -63.5]
  const skirtBot = yBase - 1.6;
  const podiumFullH = plinthH + 1.6;
  const wallY = yBase + plinthH;
  const wallH = 6.0;
  const deckY = yBase + 6.20;

  // Imperial South Plaza Paving (`imperialFlagstone`) & Manicured Lawn Flowerbeds (`courtyardLawn`, `DM-32`)
  reliefParts.push(
    makeReliefBox(46.8, podiumFullH, 14.8, 'imperialFlagstone', cx, skirtBot + podiumFullH * 0.5, cz - 2.75),
    makeReliefBox(28.0, podiumFullH, 9.6, 'imperialFlagstone', cx, skirtBot + podiumFullH * 0.5, cz + 9.2)
  );
  for (const side of [-1, 1]) {
    reliefParts.push(makeReliefBox(10.8, podiumFullH, 5.8, 'imperialFlagstone', cx + side * 18.0, skirtBot + podiumFullH * 0.5, cz + 7.3));
    // Symmetrical manicured lawn & heritage topiary beds flanking the South Imperial Axis (`DM-32`)
    const bedX = cx + side * 10.2;
    const bedZ = cz + 9.4;
    reliefParts.push(makeReliefBox(6.8, 0.34, 6.8, 'thanhHoaStone', bedX, wallY + 0.17, bedZ));
    reliefParts.push(makeReliefPlane(6.4, 6.4, 'courtyardLawn', bedX, wallY + 0.35, bedZ, 0, -Math.PI * 0.5));
    addHeritageBonsaiPlanter(reliefParts, woodParts, foliageCardParts, bedX, wallY + 0.34, bedZ - 1.4, 0.85, 601 + side);
    addHeritageBonsaiPlanter(reliefParts, woodParts, foliageCardParts, bedX, wallY + 0.34, bedZ + 1.4, 0.85, 605 + side);
    // Flanking Imperial Stone Lanterns (`HV-NEW-MB-12`)
    const lx = cx + side * 6.4;
    const lz = cz + 13.2;
    reliefParts.push(...createAncientStoneLanternParts(lx, wallY, lz, 1.05).map((g) => remapRelief(g, 'thanhHoaStone')));
  }

  // 5 Hierarchical Round-Arched Portals in Mottled Thăng Long *Gạch Vồ* Brick (`DM-05..15`)
  const archSpecs = [
    { ox: 0.0, w: 6.8, h: wallH, aw: 3.4, ah: 4.6 },
    { ox: -5.8, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 },
    { ox: 5.8, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 },
    { ox: -10.6, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 },
    { ox: 10.6, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 }
  ];
  for (const a of archSpecs) {
    const archWall = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(a.w, a.h, gateDepth, a.aw, a.ah)), 'thangLongBrick');
    archWall.translate(cx + a.ox, wallY, cz);
    reliefParts.push(archWall);

    const haw = a.aw * 0.5;
    const frameW = a.aw + 1.15;
    const frameH = a.ah + 0.68;

    // Walk-in Barrel Vault Transverse Ribs, Keystones & Hanging Palace Lantern (`DM-16`, `DM-20`)
    for (const vzOff of [-3.4, 0.0, 3.4]) {
      const rib = new THREE.TorusGeometry(haw - 0.04, 0.085, 6, 16, Math.PI);
      rib.translate(cx + a.ox, wallY + a.ah - haw, cz + vzOff);
      reliefParts.push(remapRelief(rib, 'thanhHoaStone'));
      reliefParts.push(makeReliefBox(0.32, 0.36, 0.28, 'thanhHoaStone', cx + a.ox, wallY + a.ah - 0.04, cz + vzOff));
    }
    // Authentic dark-framed Vietnamese palace lantern suspended on wrought-iron chain (`DM-20` — replaces pink ball!)
    const lantY = wallY + a.ah - 0.58;
    steelParts.push(makeCyl(0.015, 0.015, 0.45, 4, cx + a.ox, wallY + a.ah - 0.25, cz));
    woodParts.push(
      makeCyl(0.24, 0.24, 0.06, 6, cx + a.ox, lantY + 0.20, cz),
      makeCyl(0.20, 0.20, 0.06, 6, cx + a.ox, lantY - 0.20, cz)
    );
    lanternParts.push(createRibbedLanternShellGeometry(0.20, 0.36, 8, 6).translate(cx + a.ox, lantY, cz));
    lanternCoreParts.push(createLanternCoreGeometry(0.12, 0.24).translate(cx + a.ox, lantY, cz));

    // Heavy Dark *Gỗ Lim* Open Double Gate Leaves with Flush Baked Iron Studs (ZERO floating studs! `DM-02`, `DM-17`, `DM-18`)
    for (const side of [-1, 1]) {
      const leafW = a.aw * 0.48;
      const leafH = a.ah - 0.42;
      const lx = cx + a.ox + side * (haw - 0.14);
      // Doors opened cleanly inward along the vault side walls
      reliefParts.push(makeReliefBox(0.14, leafH, leafW, 'ironwoodGate', lx, wallY + leafH * 0.5, cz + gateDepth * 0.5 - leafW * 0.5 - 0.35));
      // Carved blue-stone pivot socket (`cối cửa đá`) & beveled wheel-guard curb (`DM-18`)
      reliefParts.push(makeReliefBox(0.34, 0.32, 0.44, 'thanhHoaStone', lx, wallY + 0.16, cz + gateDepth * 0.5 - 0.28));
      reliefParts.push(makeReliefBox(0.34, 0.32, 0.44, 'thanhHoaStone', lx, wallY + 0.16, cz - gateDepth * 0.5 + 0.28));
    }

    // Central Emperor Portal Interior Details: Tiled Stone Paving Wheel-Ruts & Guard Benches (NO floating X-mesh! `DM-03`, `DM-19`)
    if (Math.abs(a.ox) < 0.1) {
      for (let tileZ = 0; tileZ < 3; tileZ++) {
        reliefParts.push(
          makeReliefPlane(a.aw + 0.2, (gateDepth + 0.6) / 3, 'imperialFlagstone', cx, wallY + 0.02, cz - gateDepth * 0.33 + tileZ * (gateDepth * 0.33), 0, -Math.PI * 0.5)
        );
      }
      for (const side of [-1, 1]) {
        woodParts.push(makeBox(0.42, 0.44, 2.8, cx + side * (haw - 0.28), wallY + 0.22, cz - 1.1));
      }
    }

    // Exterior South & North Portal Frames: 7-Course Stepped Thanh Hóa Blue-Stone Quoining, Peeling Spandrels & Recessed Frames (`DM-07..14`)
    for (const zFace of [-1, 1]) {
      const fz = cz + zFace * (gateDepth * 0.5 + 0.08);
      // Radial stone/brick voussoir ring + springer blocks (`DM-08`)
      const voussoir = new THREE.TorusGeometry(haw + 0.08, 0.12, 6, 18, Math.PI);
      voussoir.translate(cx + a.ox, wallY + a.ah - haw, fz);
      reliefParts.push(remapRelief(voussoir, 'thanhHoaStone'));
      // Peeling pale lime-plaster spandrel inset above arch (`DM-14`)
      reliefParts.push(makeReliefPlane(a.aw + 0.65, 0.68, 'peelingSpandrel', cx + a.ox, wallY + a.ah + 0.28, fz - zFace * 0.02, zFace < 0 ? Math.PI : 0));
      // 7 alternating long-short stepped blue-stone quoin courses (`DM-07`)
      for (const side of [-1, 1]) {
        for (let q = 0; q < 7; q++) {
          const qw = q % 2 === 0 ? 0.56 : 0.36;
          const qx = cx + a.ox + side * (haw + 0.22 + qw * 0.32);
          reliefParts.push(makeReliefBox(qw, 0.38, 0.20, 'thanhHoaStone', qx, wallY + 0.20 + q * 0.40, fz + zFace * 0.02));
        }
        reliefParts.push(makeReliefBox(0.24, frameH, 0.22, 'thangLongBrick', cx + a.ox + side * (frameW * 0.5), wallY + frameH * 0.5, fz));
      }
      reliefParts.push(makeReliefBox(frameW + 0.24, 0.26, 0.24, 'thangLongBrick', cx + a.ox, wallY + frameH + 0.08, fz));
      reliefParts.push(makeReliefBox(frameW + 0.42, 0.14, 0.28, 'thanhHoaStone', cx + a.ox, wallY + frameH + 0.26, fz));
    }
  }

  // Carved Stone "端 門" (Đoan Môn) Stele Plaque centered cleanly below the cornice over the Emperor Portal (`DM-13`)
  const plaqueZ = cz + gateDepth * 0.5 + 0.20;
  reliefParts.push(makeReliefBox(3.15, 0.96, 0.18, 'thanhHoaStone', cx, wallY + 5.02, plaqueZ));
  plaqueParts.push(makePlaquePlane(2.96, 0.80, 'doanMonPlaque', cx, wallY + 5.02, plaqueZ + 0.10));

  // U-Shaped Flanking Brick Bastion Wings + Lower Blue-Stone Courses + Rainwater Downspouts (`DM-10`)
  const stoneCourseH = 1.85;
  const brickUpperH = wallH - stoneCourseH;
  for (const side of [-1, 1]) {
    const bx = cx + side * 18.0;
    reliefParts.push(
      makeReliefBox(10.0, stoneCourseH, gateDepth, 'thanhHoaStone', bx, wallY + stoneCourseH * 0.5, cz),
      makeReliefBox(10.0, brickUpperH, gateDepth, 'thangLongBrick', bx, wallY + stoneCourseH + brickUpperH * 0.5, cz),
      makeReliefBox(8.6, stoneCourseH, 5.5, 'thanhHoaStone', bx + side * 0.7, wallY + stoneCourseH * 0.5, cz + 7.25),
      makeReliefBox(8.6, brickUpperH, 5.5, 'thangLongBrick', bx + side * 0.7, wallY + stoneCourseH + brickUpperH * 0.5, cz + 7.25),
      makeReliefBox(8.6, stoneCourseH, 5.5, 'thanhHoaStone', bx + side * 0.7, wallY + stoneCourseH * 0.5, cz - 7.25),
      makeReliefBox(8.6, brickUpperH, 5.5, 'thangLongBrick', bx + side * 0.7, wallY + stoneCourseH + brickUpperH * 0.5, cz - 7.25)
    );
    // Vertical rainwater downspout tucked in inner 90° bastion corners (`DM-10`)
    steelParts.push(makeCyl(0.06, 0.06, wallH, 6, cx + side * 13.85, wallY + wallH * 0.5, cz + gateDepth * 0.5 + 0.08));
  }

  // Projecting Bastion Cornice & Bát Tràng Terracotta Upper Terrace Deck (`DM-15`, `DM-29`)
  reliefParts.push(
    makeReliefBox(46.8, 0.42, gateDepth + 0.65, 'thanhHoaStone', cx, deckY - 0.52, cz),
    makeReliefBox(46.4, 0.34, gateDepth + 0.35, 'thanhHoaStone', cx, deckY - 0.17, cz),
    makeReliefPlane(45.6, gateDepth - 0.4, 'batTrangPaving', cx, deckY + 0.02, cz, 0, -Math.PI * 0.5)
  );
  for (const side of [-1, 1]) {
    const bx = cx + side * 18.7;
    reliefParts.push(
      makeReliefBox(9.2, 0.42, 20.6, 'thanhHoaStone', bx, deckY - 0.52, cz),
      makeReliefBox(9.0, 0.34, 20.2, 'thanhHoaStone', bx, deckY - 0.17, cz),
      makeReliefPlane(8.4, 19.6, 'batTrangPaving', bx, deckY + 0.02, cz, 0, -Math.PI * 0.5)
    );
  }

  // Solid Yellow-Ochre Tier 1 Parapet Wall with Pilasters, Pink Lotus Lanterns & Cờ Ngũ Sắc (`DM-25`, `DM-30`, `DM-31`)
  const addOchreParapetX = (x0: number, x1: number, zPos: number) => {
    const w = Math.abs(x1 - x0);
    const mx = (x0 + x1) * 0.5;
    reliefParts.push(makeReliefBox(w, 0.88, 0.34, 'vongLauOchre', mx, deckY + 0.44, zPos));
    reliefParts.push(makeReliefBox(w + 0.08, 0.12, 0.42, 'thanhHoaStone', mx, deckY + 0.92, zPos));
  };
  const addOchreParapetZ = (xPos: number, z0: number, z1: number) => {
    const d = Math.abs(z1 - z0);
    const mz = (z0 + z1) * 0.5;
    reliefParts.push(makeReliefBox(0.34, 0.88, d, 'vongLauOchre', xPos, deckY + 0.44, mz));
    reliefParts.push(makeReliefBox(0.42, 0.12, d + 0.08, 'thanhHoaStone', xPos, deckY + 0.92, mz));
  };
  addOchreParapetX(-14.2, 14.2, cz + gateDepth * 0.5);
  addOchreParapetX(-14.2, 14.2, cz - gateDepth * 0.5);
  for (const side of [-1, 1]) {
    addOchreParapetX(side * 14.4, side * 23.0, cz + 10.0);
    addOchreParapetX(side * 14.4, side * 23.0, cz - 10.0);
    addOchreParapetZ(side * 23.0, cz - 10.0, cz + 10.0);
    addOchreParapetZ(side * 14.4, cz + 4.5, cz + 10.0);
    addOchreParapetZ(side * 14.4, cz - 10.0, cz - 4.5);
  }
  // Pink Lotus Blossom Lanterns (`Đèn Hoa Sen`) & Ceremonial Five-Color Flags (`Cờ Ngũ Sắc`) lining parapet (`DM-30`, `DM-31`)
  for (const fx of [-18.5, -13.2, -9.0, -4.6, 4.6, 9.0, 13.2, 18.5]) {
    const fz = Math.abs(fx) > 14.3 ? cz + 9.9 : cz + gateDepth * 0.5;
    // Square parapet pier + sculpted pink lotus blossom lantern
    reliefParts.push(makeReliefBox(0.50, 1.02, 0.50, 'vongLauOchre', cx + fx, deckY + 0.51, fz));
    const lotusCup = new THREE.CylinderGeometry(0.24, 0.10, 0.18, 8);
    lotusCup.translate(cx + fx, deckY + 1.12, fz);
    lanternParts.push(lotusCup);
    // Angled ceremonial pole + traditional 5-color `Cờ Ngũ Sắc` banner
    woodParts.push(makeCyl(0.03, 0.038, 2.45, 6, cx + fx, deckY + 1.65, fz - 0.15, 0.22));
    plaqueParts.push(makePlaquePlane(0.86, 0.72, 'coNguSac', cx + fx + 0.44, deckY + 2.38, fz + 0.06, 0.12));
  }
  // Twin Tall White Flagpoles on East Terrace flying Vietnam Flag & Large Cờ Ngũ Sắc (`DM-30` — Ref 108!)
  for (const [fx, fKey] of [
    [17.5, 'vietnamFlag'],
    [20.2, 'coNguSac']
  ] as const) {
    whitePlasterParts.push(makeCyl(0.055, 0.08, 7.2, 8, cx + fx, deckY + 3.6, cz - 2.0));
    plaqueParts.push(makePlaquePlane(2.1, 1.4, fKey, cx + fx + 1.08, deckY + 6.4, cz - 2.0));
  }

  // Twin rear brick & stone rampart staircases ascending behind U-wings
  for (const side of [-1, 1]) {
    const stairX = cx + side * 13.05;
    for (let st = 0; st < 12; st++) {
      const t = st / 11;
      const sz = THREE.MathUtils.lerp(cz - 9.2, cz - 0.4, t);
      const sy = THREE.MathUtils.lerp(wallY + 0.2, deckY - 0.15, t);
      const sh = Math.max(0.45, sy - (yBase - 0.5));
      reliefParts.push(
        makeReliefBox(2.2, sh, 0.92, 'thangLongBrick', stairX, yBase - 0.5 + sh * 0.5, sz),
        makeReliefBox(2.3, 0.14, 0.96, 'thanhHoaStone', stairX, sy, sz)
      );
    }
  }

  // Upper Vọng Lâu (Tiers 2 & 3 — `DM-23..28`, Refs 06 & 108!)
  const pavBaseY = deckY;
  const lowerH = 3.35;
  reliefParts.push(
    makeReliefBox(17.2, 0.30, 5.2, 'thanhHoaStone', cx, pavBaseY + 0.15, cz),
    makeReliefBox(16.8, lowerH, 4.8, 'vongLauOchre', cx, pavBaseY + lowerH * 0.5, cz),
    makeReliefBox(17.4, 0.28, 5.4, 'vongLauOchre', cx, pavBaseY + lowerH - 0.12, cz)
  );
  for (const pilX of [-8.25, -2.65, 2.65, 8.25]) {
    for (const zSide of [-1, 1]) {
      reliefParts.push(makeReliefBox(0.42, lowerH, 0.20, 'vongLauOchre', cx + pilX, pavBaseY + lowerH * 0.5, cz + zSide * 2.44));
    }
  }
  // Tier 2 White Pierced Geometric *Hoa Gió* Lattice Windows (`DM-24`)
  for (const zSide of [-1, 1]) {
    const wz = cz + zSide * 2.44;
    for (const [bx, winW, winH] of [
      [-5.4, 2.25, 1.95],
      [0.0, 3.25, 1.85],
      [5.4, 2.25, 1.95]
    ]) {
      const winY = pavBaseY + 1.58;
      whitePlasterParts.push(
        makeBox(winW + 0.22, 0.14, 0.18, cx + bx, winY + winH * 0.5, wz + zSide * 0.02),
        makeBox(winW + 0.22, 0.14, 0.18, cx + bx, winY - winH * 0.5, wz + zSide * 0.02),
        makeBox(0.14, winH, 0.18, cx + bx - winW * 0.5, winY, wz + zSide * 0.02),
        makeBox(0.14, winH, 0.18, cx + bx + winW * 0.5, winY, wz + zSide * 0.02)
      );
      reliefParts.push(makeReliefPlane(winW, winH, 'piercedLattice', cx + bx, winY, wz + zSide * 0.04, zSide < 0 ? Math.PI : 0));
    }
    // Recessed rectangular cartouche above center window (`DM-23`)
    whitePlasterParts.push(makeBox(1.85, 0.42, 0.10, cx, pavBaseY + 2.88, wz + zSide * 0.02));
  }
  // Tier 2 Pierced Yellow-Brick Balustrade (`hoaChanhParapet` + capped piers, `DM-25`)
  const tier2TopY = pavBaseY + lowerH;
  for (const zSide of [-1, 1]) {
    reliefParts.push(makeReliefBox(16.8, 0.78, 0.20, 'hoaChanhParapet', cx, tier2TopY + 0.40, cz + zSide * 2.45));
    for (const px of [-8.3, -4.15, 0, 4.15, 8.3]) {
      reliefParts.push(makeReliefBox(0.38, 0.92, 0.38, 'vongLauOchre', cx + px, tier2TopY + 0.46, cz + zSide * 2.45));
    }
  }
  for (const xSide of [-1, 1]) {
    reliefParts.push(makeReliefBox(0.20, 0.78, 4.9, 'hoaChanhParapet', cx + xSide * 8.35, tier2TopY + 0.40, cz));
  }

  // Tier 3 Ochre Upper Pavilion + Central Arched *Thọ* Window + Double-Tiered *Ngói Mũi Hài* Roof (`DM-24..28`)
  const upperY = tier2TopY + 0.06;
  const upperH = 2.68;
  for (const zSide of [-1, 1]) {
    const frontArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(10.8, upperH, 0.48, 2.15, 2.05)), 'vongLauOchre');
    frontArch.translate(cx, upperY, cz + zSide * 1.52);
    reliefParts.push(frontArch);
    const archTrim = new THREE.TorusGeometry(1.12, 0.08, 6, 16, Math.PI);
    archTrim.translate(cx, upperY + 0.98, cz + zSide * 1.78);
    whitePlasterParts.push(archTrim);
    reliefParts.push(makeReliefPlane(1.95, 1.85, 'piercedLattice', cx, upperY + 1.02, cz + zSide * 1.74, zSide < 0 ? Math.PI : 0));
    for (const bx of [-3.35, 3.35]) {
      reliefParts.push(makeReliefPlane(1.38, 0.85, 'piercedLattice', cx + bx, upperY + 1.42, cz + zSide * 1.78, zSide < 0 ? Math.PI : 0));
      whitePlasterParts.push(
        makeBox(1.52, 0.08, 0.10, cx + bx, upperY + 1.88, cz + zSide * 1.79),
        makeBox(1.52, 0.08, 0.10, cx + bx, upperY + 0.96, cz + zSide * 1.79)
      );
    }
  }
  reliefParts.push(
    makeReliefBox(0.48, upperH, 3.52, 'vongLauOchre', cx - 5.16, upperY + upperH * 0.5, cz),
    makeReliefBox(0.48, upperH, 3.52, 'vongLauOchre', cx + 5.16, upperY + upperH * 0.5, cz),
    makeReliefBox(11.3, 0.24, 3.9, 'vongLauOchre', cx, upperY + upperH - 0.08, cz)
  );
  // Double-tiered dark-brown *ngói mũi hài* roof (`ngoiMuiHaiRoof`) + slatted timber *cổ diêm* + corner ridge dragons (`DM-26..28`)
  const lowerRoof = remapRelief(createVietnameseCurvedRoofGeometry(14.4, 6.4, 9.8, 3.6, 1.38, 0.42), 'ngoiMuiHaiRoof');
  lowerRoof.translate(cx, upperY + upperH + 0.02, cz);
  reliefParts.push(lowerRoof);

  const coDiemY = upperY + upperH + 1.20;
  const coDiemH = 0.88;
  voidParts.push(makeBox(8.9, coDiemH * 0.88, 2.9, cx, coDiemY + coDiemH * 0.48, cz));
  woodParts.push(
    makeBox(9.6, 0.14, 3.5, cx, coDiemY + 0.07, cz),
    makeBox(9.6, 0.14, 3.5, cx, coDiemY + coDiemH - 0.05, cz)
  );
  for (let sx = -4.4; sx <= 4.41; sx += 0.44) {
    for (const zSide of [-1, 1]) {
      woodParts.push(makeBox(0.08, coDiemH, 0.10, cx + sx, coDiemY + coDiemH * 0.5, cz + zSide * 1.62));
    }
  }
  const upperRoof = remapRelief(createVietnameseCurvedRoofGeometry(12.2, 5.4, 4.8, 0.52, 2.08, 0.60), 'ngoiMuiHaiRoof');
  upperRoof.translate(cx, coDiemY + coDiemH + 0.02, cz);
  reliefParts.push(upperRoof);

  const ridgeY = coDiemY + coDiemH + 2.08;
  reliefParts.push(makeReliefBox(5.0, 0.22, 0.24, 'thanhHoaStone', cx, ridgeY, cz));
  for (const sEnd of [-1, 1]) {
    const kim = new THREE.TorusGeometry(0.26, 0.075, 5, 10, Math.PI * 1.35);
    kim.rotateZ(sEnd > 0 ? 0.4 : Math.PI - 0.4);
    kim.translate(cx + sEnd * 2.48, ridgeY + 0.30, cz);
    reliefParts.push(remapRelief(kim, 'thanhHoaStone'));
    // Sculpted corner ridge dragons striding up lower hip ridges (`DM-28`)
    for (const zS of [-1, 1]) {
      const rDrag = new THREE.TorusGeometry(0.24, 0.07, 5, 8, Math.PI * 1.2);
      rDrag.rotateY(zS > 0 ? sEnd * 0.6 : -sEnd * 0.6);
      rDrag.translate(cx + sEnd * 6.4, upperY + upperH + 0.55, cz + zS * 2.85);
      reliefParts.push(remapRelief(rDrag, 'dragonReliefStone'));
    }
  }

  // =================================================================================================
  // SECTION 2: SÂN LONG TRÌ, NỀN & 9-STEP BẬC RỒNG ĐÁ ĐIỆN KÍNH THIÊN (`KT-01..KT-25`)
  // =================================================================================================
  const ktZ = -95.5; // z in [-107, -84]
  const ktW = 46.0;
  const ktD = 23.0;
  const ktGroundY = ctx.getHeight(cx, ktZ);
  const ktTopY = Math.max(yBase + 2.45, ktGroundY + 2.45);
  const ktSkirtBot = Math.min(yBase, ktGroundY) - 2.6;
  const ktFullH = ktTopY - ktSkirtBot;

  // Paved *Long Trì* Sacred Way & Courtyard Lawns between Đoan Môn and Điện Kính Thiên (`KT-16`, `KT-32`)
  const courtY = ctx.getHeight(cx, -79.5);
  reliefParts.push(
    makeReliefBox(22.0, 1.2, 10.2, 'imperialFlagstone', cx, courtY - 0.52, -79.5),
    makeReliefPlane(21.4, 9.8, 'imperialFlagstone', cx, courtY + 0.12, -79.5, 0, -Math.PI * 0.5)
  );
  for (const side of [-1, 1]) {
    reliefParts.push(makeReliefPlane(14.0, 9.5, 'courtyardLawn', cx + side * 18.0, courtY + 0.08, -79.5, 0, -Math.PI * 0.5));
  }

  // Monumental 46m x 23m Thanh Hóa Stone Retaining Platform + Multi-Tiled 30×30cm Bát Tràng Terracotta Terrace (`KT-13`, `KT-15`)
  reliefParts.push(
    makeReliefBox(ktW + 4.0, ktFullH, ktD, 'thanhHoaStone', cx + 1.5, ktSkirtBot + ktFullH * 0.5, ktZ),
    makeReliefBox(ktW + 4.6, 0.34, ktD + 0.85, 'thanhHoaStone', cx + 1.5, ktTopY - 0.14, ktZ),
    makeReliefBox(ktW + 5.0, 0.55, ktD + 1.2, 'thanhHoaStone', cx + 1.5, ktGroundY + 0.28, ktZ)
  );
  // Tile Bát Tràng terracotta paving into 6×4 sub-quads for crisp 30×30cm brick scale (`KT-15`)
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 4; gz++) {
      const tw = (ktW + 3.2) / 6;
      const td = (ktD - 0.8) / 4;
      const tx = cx + 1.5 - (ktW + 3.2) * 0.5 + (gx + 0.5) * tw;
      const tz = ktZ - (ktD - 0.8) * 0.5 + (gz + 0.5) * td;
      reliefParts.push(makeReliefPlane(tw, td, 'batTrangPaving', tx, ktTopY + 0.04, tz, 0, -Math.PI * 0.5));
    }
  }

  // Carved Stone Lotus-Petal Perimeter Balustrades (`KT-14` — stops cleanly before Chính Bắc Môn on East flank!)
  const halfKtW = ktW * 0.5 - 0.45;
  const halfKtD = ktD * 0.5 - 0.45;
  const ktBals = [
    ...createPiercedBalustradeParts(cx - halfKtW, ktZ - halfKtD, cx - halfKtW, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + halfKtW + 2.2, ktZ - 2.2, cx + halfKtW + 2.2, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx - halfKtW, ktZ + halfKtD, cx - 7.3, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + 7.3, ktZ + halfKtD, cx + halfKtW + 2.2, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx - halfKtW, ktZ - halfKtD, cx - 4.5, ktZ - halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + 4.5, ktZ - halfKtD, cx + 14.5, ktZ - halfKtD, ktTopY, 0.96, 'lotus_stone')
  ];
  for (const b of ktBals) reliefParts.push(remapRelief(b, 'thanhHoaStone'));
  for (const sx of [-halfKtW, halfKtW]) {
    for (const sz of [-halfKtD, halfKtD]) {
      for (const f of createLotusFinialParts(cx + sx, ktTopY + 1.0, ktZ + sz, 0.85)) {
        reliefParts.push(remapRelief(f, 'thanhHoaStone'));
      }
    }
  }

  // Front 9-Step Monolithic Dressed Stone Staircase (`KT-11`, `KT-12` — ZERO stray stair bumps!) + 4 Sculpted Lê-Dynasty Stone Dragons (`KT-01..10`)
  const frontSteps = 9;
  const fZTop = ktZ + ktD * 0.5; // -84.0
  const fZBot = -78.0;
  const fBotGround = ctx.getHeight(cx, fZBot);
  for (let s = 0; s < frontSteps; s++) {
    const t = s / (frontSteps - 1);
    const sz = THREE.MathUtils.lerp(fZTop, fZBot, t);
    const sy = THREE.MathUtils.lerp(ktTopY - 0.06, fBotGround + 0.14, t);
    const sBot = Math.min(sy - 1.3, ctx.getHeight(cx, sz) - 1.3);
    const sh = Math.max(0.5, sy - sBot);
    for (const bxOff of [-4.8, 0, 4.8]) {
      reliefParts.push(makeReliefBox(4.8, sh, 0.95, 'thanhHoaStone', cx + bxOff, sBot + sh * 0.5, sz));
    }
  }
  // Monumental inner pair (`scale 1.24`) + slightly slimmer outer flanking pair (`scale 1.06`) — `KT-08`!
  for (const [dX, dScale] of [
    [-6.85, 1.06],
    [-2.28, 1.24],
    [2.28, 1.24],
    [6.85, 1.06]
  ]) {
    addLeDynastyStoneDragon(reliefParts, cx + dX, fBotGround + 0.14, fZBot + 0.15, ktTopY + 0.06, fZTop - 0.1, dScale, true);
  }
  // Rear 7-step North Thềm Rồng with 2 Lê Trung Hưng stone dragons
  const rearSteps = 7;
  const rZTop = ktZ - ktD * 0.5;
  const rZBot = -111.2;
  const rBotGround = ctx.getHeight(cx, rZBot);
  for (let s = 0; s < rearSteps; s++) {
    const t = s / (rearSteps - 1);
    const sz = THREE.MathUtils.lerp(rZTop, rZBot, t);
    const sy = THREE.MathUtils.lerp(ktTopY - 0.06, rBotGround + 0.14, t);
    const sBot = Math.min(sy - 1.3, ctx.getHeight(cx, sz) - 1.3);
    const sh = Math.max(0.5, sy - sBot);
    reliefParts.push(makeReliefBox(8.6, sh, 0.95, 'thanhHoaStone', cx, sBot + sh * 0.5, sz));
  }
  for (const dX of [-4.05, 4.05]) {
    addLeDynastyStoneDragon(reliefParts, cx + dX, rBotGround + 0.14, rZBot - 0.15, ktTopY + 0.06, rZTop + 0.1, 1.08, false);
  }

  // Carved Imperial Incense Altar (`Hương Án`) & Royal `"敬 天 殿 / ĐIỆN KÍNH THIÊN"` Plaque (`KT-17`)
  crimsonParts.push(makeBox(5.2, 1.22, 1.55, cx, ktTopY + 0.61, ktZ - 1.2));
  goldParts.push(
    makeBox(5.45, 0.18, 1.72, cx, ktTopY + 1.24, ktZ - 1.2),
    makeBox(3.52, 1.20, 0.16, cx, ktTopY + 2.08, ktZ - 1.45)
  );
  plaqueParts.push(makePlaquePlane(3.36, 1.04, 'dienKinhThienPlaque', cx, ktTopY + 2.08, ktZ - 1.36));

  // Monumental Antique Red-Brown Bronze Dragon Cauldron (*Đỉnh Đồng Điện Kính Thiên*, Ref 39 — `KT-19..23`!)
  const caulZ = ktZ + 4.4;
  // Multi-tiered carved marble/limestone plinth + scalloped cast-bronze lower tray (`KT-22`)
  reliefParts.push(
    makeReliefBox(2.25, 0.36, 2.25, 'thanhHoaStone', cx, ktTopY + 0.18, caulZ),
    makeReliefBox(1.85, 0.44, 1.85, 'dragonReliefStone', cx, ktTopY + 0.58, caulZ),
    remapRelief(makeCyl(0.86, 0.92, 0.16, 16, cx, ktTopY + 0.88, caulZ), 'redBronzeRelief')
  );
  const ktCenser = createBronzeIncenseTripodParts(cx, ktTopY + 0.62, caulZ, 1.42);
  for (const bp of [...ktCenser.bronzeParts, ...ktCenser.goldParts]) {
    reliefParts.push(remapRelief(bp, 'redBronzeRelief'));
  }
  // Twin massive S-curved upturned dragon handles + intertwined lid dragon finial (`KT-20`)
  for (const sx of [-1, 1]) {
    const hCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + sx * 0.60, ktTopY + 1.48, caulZ),
      new THREE.Vector3(cx + sx * 0.98, ktTopY + 1.78, caulZ),
      new THREE.Vector3(cx + sx * 0.90, ktTopY + 2.38, caulZ),
      new THREE.Vector3(cx + sx * 0.70, ktTopY + 2.56, caulZ)
    ]);
    reliefParts.push(remapRelief(createSmoothTaperedTubeGeometry(hCurve, 10, 6, (t) => 0.095 - t * 0.03), 'redBronzeRelief'));
  }
  // Red-stemmed joss sticks (`KT-23`)
  for (let ji = -3; ji <= 3; ji++) {
    crimsonParts.push(makeCyl(0.008, 0.008, 0.42, 4, cx + ji * 0.06, ktTopY + 2.28, caulZ + 0.45));
  }
  smokeSources.push({ x: cx, y: ktTopY + 3.25, z: caulZ, scale: 0.85 });

  // Paired Bronze Cranes on Tortoises (`KT-24`), Sculpted Stone *Nghê* (`KT-18`) & Heritage Bonsai (`KT-25`)
  for (const side of [-1, 1]) {
    bronzeParts.push(...createBronzeCraneOnTortoiseParts(cx + side * 2.95, ktTopY, ktZ + 1.4, side > 0 ? -0.35 : 0.35, 1.24));
    for (const ng of createGuardianBeastParts(cx + side * 8.4, ktTopY + 0.32, ktZ + 9.4, 0, 1.32, 'nghe')) {
      reliefParts.push(remapRelief(ng, 'thanhHoaStone'));
    }
    reliefParts.push(makeReliefBox(1.25, 0.34, 1.45, 'thanhHoaStone', cx + side * 8.4, ktTopY + 0.17, ktZ + 9.4));
    for (const lzOff of [-5.2, 1.6, 8.2]) {
      addHeritageBonsaiPlanter(reliefParts, woodParts, foliageCardParts, cx + side * 14.5, ktTopY, ktZ + lzOff, 1.05, 920 + Math.round(side * 10 + lzOff));
    }
  }
  // Exposed Lý–Trần lotus stone column plinths (`chân tảng hoa sen`)
  for (const px of [-16, -11, -6, 6, 11, 16]) {
    for (const pz of [-4.5, 3.0]) {
      reliefParts.push(makeReliefBox(1.15, 0.32, 1.15, 'thanhHoaStone', cx + px, ktTopY + 0.16, ktZ + pz));
      for (const lp of createLotusPetalRingParts(cx + px, ktTopY + 0.36, ktZ + pz, 0.44, 10, 1, false)) {
        reliefParts.push(remapRelief(lp, 'thanhHoaStone'));
      }
    }
  }

  // =================================================================================================
  // SECTION 3: ELONGATED 2-STORY FRENCH COLONIAL NHÀ CON RỒNG D67 (`KT-26..29`, `BM-25..28` — Ref 39 & 109!)
  // =================================================================================================
  const ncrZ = ktZ - 6.8;
  const ncrW = 28.4; // Expanded 7-bay colonial rhythm!
  const ncrD = 7.8;
  const ncrH = 8.8;
  // Core shaded interior body (set back 1.4m behind dual-level arched veranda colonnade!)
  reliefParts.push(
    makeReliefBox(ncrW - 0.6, 4.2, 0.42, 'vongLauOchre', cx, ktTopY + 2.1, ncrZ - ncrD * 0.5 + 0.21),
    makeReliefBox(0.42, 8.6, ncrD, 'vongLauOchre', cx - ncrW * 0.5 + 0.21, ktTopY + 4.3, ncrZ),
    makeReliefBox(0.42, 8.6, ncrD, 'vongLauOchre', cx + ncrW * 0.5 - 0.21, ktTopY + 4.3, ncrZ),
    makeReliefBox(ncrW - 0.8, 4.4, ncrD - 1.6, 'vongLauOchre', cx, ktTopY + 6.5, ncrZ - 0.7)
  );
  // Horizontal white colonial stringcourse, upper floor deck & projecting dentil roof cornice (`KT-27`, `BM-27`)
  whitePlasterParts.push(
    makeBox(ncrW + 0.5, 0.34, ncrD + 0.4, cx, ktTopY + 4.28, ncrZ),
    makeBox(ncrW + 0.8, 0.42, ncrD + 0.6, cx, ktTopY + ncrH + 0.16, ncrZ)
  );
  // 7 Semicircular Arched Colonnade Veranda Bays on BOTH Ground & 2nd Floor + Classical Balustrades (`KT-26..28`, `BM-25..27`)
  const frontArcZ = ncrZ + ncrD * 0.5 - 0.22;
  const baySpacing = 3.85;
  for (let bay = -3; bay <= 3; bay++) {
    const bx = cx + bay * baySpacing;
    for (const [fy, isUpper] of [
      [ktTopY, false],
      [ktTopY + 4.42, true]
    ] as const) {
      const arcWall = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(baySpacing, 4.25, 0.42, 2.45, 3.45)), 'vongLauOchre');
      arcWall.translate(bx, fy, frontArcZ);
      reliefParts.push(arcWall);
      // Molded white archivolts & pier capitals
      const aTrim = new THREE.TorusGeometry(1.24, 0.07, 5, 14, Math.PI);
      aTrim.translate(bx, fy + 2.22, frontArcZ + 0.22);
      whitePlasterParts.push(aTrim);
      if (isUpper) {
        // Recessed dark forest-green louvered French shutter doors deeply inside 2nd-floor veranda (`KT-28`, `BM-26`)
        reliefParts.push(makeReliefPlane(1.95, 2.75, 'colonialShutter', bx, fy + 1.65, frontArcZ - 1.15));
        whitePlasterParts.push(makeBox(2.12, 0.12, 0.14, bx, fy + 3.06, frontArcZ - 1.12));
        // Continuous cream-white classical vertical-baluster railing across 2nd-floor veranda (`KT-27`, `BM-27`)
        whitePlasterParts.push(makeBox(2.55, 0.10, 0.18, bx, fy + 0.96, frontArcZ + 0.02));
        for (let bi = -4; bi <= 4; bi++) {
          whitePlasterParts.push(makeCyl(0.036, 0.045, 0.88, 6, bx + bi * 0.26, fy + 0.48, frontArcZ + 0.02));
        }
      }
    }
    // Rooftop pierced parapet balustrade screening the terracotta hipped roof (`KT-27`, `BM-27`)
    whitePlasterParts.push(
      makeBox(baySpacing, 0.12, 0.22, bx, ktTopY + ncrH + 1.12, frontArcZ + 0.05),
      makeBox(0.32, 0.88, 0.32, bx - baySpacing * 0.5, ktTopY + ncrH + 0.72, frontArcZ + 0.05)
    );
    for (let bi = -5; bi <= 5; bi++) {
      whitePlasterParts.push(makeCyl(0.035, 0.042, 0.72, 5, bx + bi * 0.30, ktTopY + ncrH + 0.72, frontArcZ + 0.05));
    }
  }
  // Antique Bronze Gong hanging under East colonial archway (`KT-25` — Ref 39!)
  woodParts.push(
    makeBox(0.12, 2.1, 0.12, cx + 10.6, ktTopY + 1.05, frontArcZ - 0.55),
    makeBox(0.12, 2.1, 0.12, cx + 12.2, ktTopY + 1.05, frontArcZ - 0.55),
    makeBox(1.8, 0.14, 0.14, cx + 11.4, ktTopY + 2.12, frontArcZ - 0.55)
  );
  const gong = makeCyl(0.56, 0.56, 0.12, 16, cx + 11.4, ktTopY + 1.32, frontArcZ - 0.55, Math.PI * 0.5);
  reliefParts.push(remapRelief(gong, 'redBronzeRelief'));

  // Broad Terracotta-Red Colonial Hipped Tile Roof (ZERO bizarre grey roof pipes! `KT-29`, `BM-28`)
  const ncrRoof = remapRelief(createVietnameseCurvedRoofGeometry(ncrW + 1.6, ncrD + 1.6, ncrW - 5.2, 0.6, 2.85, 0.04), 'terracottaHipRoof');
  ncrRoof.translate(cx, ktTopY + ncrH + 0.42, ncrZ);
  reliefParts.push(ncrRoof);

  // Walk-In D67 Operations Room Interior: Green-Baize Campaign Table, Chairs, Phones, Strategic Map & Blast Door
  woodParts.push(makeBox(8.6, 0.84, 2.2, cx, ktTopY + 0.42, ncrZ + 0.2));
  reliefParts.push(makeReliefBox(8.2, 0.06, 1.95, 'courtyardLawn', cx, ktTopY + 0.86, ncrZ + 0.2));
  for (let ch = -2; ch <= 2; ch++) {
    for (const czSide of [-1.45, 1.45]) {
      woodParts.push(
        makeBox(0.56, 0.46, 0.52, cx + ch * 1.65, ktTopY + 0.23, ncrZ + 0.2 + czSide),
        makeBox(0.56, 0.52, 0.10, cx + ch * 1.65, ktTopY + 0.72, ncrZ + 0.2 + czSide * 1.18)
      );
    }
  }
  for (const txOff of [-2.4, -0.8, 0.8, 2.4]) {
    steelParts.push(makeBox(0.28, 0.16, 0.24, cx + txOff, ktTopY + 0.94, ncrZ + 0.2));
  }
  woodParts.push(makeBox(6.4, 2.35, 0.14, cx, ktTopY + 2.35, ncrZ - ncrD * 0.5 + 0.52));
  plaqueParts.push(makePlaquePlane(5.9, 1.95, 'd67BattleMap', cx, ktTopY + 2.35, ncrZ - ncrD * 0.5 + 0.60));
  steelParts.push(
    makeBox(1.85, 2.55, 0.28, cx - 7.8, ktTopY + 1.28, ncrZ - ncrD * 0.5 + 0.55),
    new THREE.TorusGeometry(0.28, 0.045, 5, 10).translate(cx - 7.35, ktTopY + 1.28, ncrZ - ncrD * 0.5 + 0.72)
  );

  // =================================================================================================
  // SECTION 4: HẬU LÂU (TĨNH BẮC LÂU 3-TIER PRINCESS PAGODA) & CHÍNH BẮC MÔN (`BM-01..BM-32`!)
  // =================================================================================================
  // 4A. Rebuilt 3-Tiered Hậu Lâu (Tĩnh Bắc Lâu) at (-20.0, -103.5) (`BM-18..24`)
  const hlX = -20.0;
  const hlZ = -103.5;
  const hlTiers = [
    { w: 9.2, d: 6.8, y0: ktTopY, h: 3.8, wins: [-2.8, 0, 2.8] },
    { w: 6.8, d: 5.2, y0: ktTopY + 3.8, h: 3.1, wins: [-1.9, 0, 1.9] },
    { w: 4.6, d: 3.8, y0: ktTopY + 6.9, h: 2.5, wins: [0] }
  ];
  for (let ti = 0; ti < hlTiers.length; ti++) {
    const ht = hlTiers[ti];
    reliefParts.push(makeReliefBox(ht.w, ht.h, ht.d, 'vongLauOchre', hlX, ht.y0 + ht.h * 0.5, hlZ));
    // Crisp white molded cornices & corner pilasters (`BM-20`)
    whitePlasterParts.push(
      makeBox(ht.w + 0.36, 0.22, ht.d + 0.36, hlX, ht.y0 + ht.h - 0.08, hlZ),
      makeBox(ht.w + 0.24, 0.16, ht.d + 0.24, hlX, ht.y0 + 0.08, hlZ)
    );
    // Arched & louvered dark-green French-colonial windows on South & North facades (`BM-19`)
    for (const zS of [-1, 1]) {
      const wz = hlZ + zS * (ht.d * 0.5 + 0.04);
      for (const wxOff of ht.wins) {
        const winH = ti === 0 ? 2.15 : 1.75;
        const winW = ti === 0 ? 1.45 : 1.18;
        const wy = ht.y0 + ht.h * 0.48;
        reliefParts.push(makeReliefPlane(winW, winH, 'colonialShutter', hlX + wxOff, wy, wz, zS < 0 ? Math.PI : 0));
        whitePlasterParts.push(
          makeBox(winW + 0.20, 0.10, 0.12, hlX + wxOff, wy - winH * 0.5 - 0.04, wz),
          new THREE.TorusGeometry(winW * 0.52, 0.06, 5, 12, Math.PI).translate(hlX + wxOff, wy + winH * 0.36, wz)
        );
      }
    }
    // Balcony balustrades on Tiers 2 & 3 (`BM-21`)
    if (ti > 0) {
      const prev = hlTiers[ti - 1];
      whitePlasterParts.push(
        makeBox(prev.w + 0.1, 0.65, 0.14, hlX, ht.y0 + 0.32, hlZ + prev.d * 0.5 - 0.08),
        makeBox(prev.w + 0.1, 0.65, 0.14, hlX, ht.y0 + 0.32, hlZ - prev.d * 0.5 + 0.08)
      );
    }
    // Curved Dark-Brown *Ngói Mũi Hài* Tiered Roofs with Upturned Eaves & Scroll Ridge Crests (`BM-22`, `BM-23`)
    const rH = ti === 2 ? 1.75 : 1.38;
    const hlRoof = remapRelief(
      createVietnameseCurvedRoofGeometry(ht.w + 1.8, ht.d + 1.8, ht.w * 0.52, ht.d * 0.42, rH, 0.42),
      'ngoiMuiHaiRoof'
    );
    hlRoof.translate(hlX, ht.y0 + ht.h + 0.02, hlZ);
    reliefParts.push(hlRoof);
    if (ti === 2) {
      reliefParts.push(makeReliefBox(ht.w * 0.56, 0.20, 0.22, 'thanhHoaStone', hlX, ht.y0 + ht.h + rH + 0.06, hlZ));
    }
  }

  // 4B. Rebuilt Chính Bắc Môn (North Gate) at (+21.0, -103.5) — Ref 123 (`BM-01..17`!)
  const bmX = 21.0;
  const bmZ = -103.5;
  const bmBaseY = ktTopY;
  const bmWallH = 5.4;
  // Lower battered green-stone foundation courses (`đá xanh`, `BM-07`) + battered Vauban brick wings (`BM-01`, `BM-08`)
  addMappedVaubanFrustum(reliefParts, bmX - 3.65, bmBaseY, bmZ, 3.6, 4.8, 3.0, 4.2, 1.35, 'thanhHoaStone');
  addMappedVaubanFrustum(reliefParts, bmX + 3.65, bmBaseY, bmZ, 3.6, 4.8, 3.0, 4.2, 1.35, 'thanhHoaStone');
  addMappedVaubanFrustum(reliefParts, bmX - 3.55, bmBaseY + 1.35, bmZ, 3.2, 4.4, 2.5, 3.6, bmWallH - 1.35, 'thangLongBrick');
  addMappedVaubanFrustum(reliefParts, bmX + 3.55, bmBaseY + 1.35, bmZ, 3.2, 4.4, 2.5, 3.6, bmWallH - 1.35, 'thangLongBrick');
  // Central arched portal block (`BM-11..16`)
  const bmArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(4.4, bmWallH, 4.2, 2.8, 3.45)), 'thangLongBrick');
  bmArch.translate(bmX, bmBaseY, bmZ);
  reliefParts.push(bmArch);
  // Full-height alternating stepped limestone quoining, ashlar base piers, radial arch ring & scalloped lintel (`BM-11..15`)
  for (const side of [-1, 1]) {
    reliefParts.push(makeReliefBox(0.55, 1.85, 4.35, 'thanhHoaStone', bmX + side * 1.48, bmBaseY + 0.92, bmZ));
    for (let q = 0; q < 9; q++) {
      const qw = q % 2 === 0 ? 0.58 : 0.36;
      reliefParts.push(makeReliefBox(qw, 0.38, 0.24, 'thanhHoaStone', bmX + side * (1.62 + qw * 0.32), bmBaseY + 0.22 + q * 0.42, bmZ + 2.16));
    }
  }
  const bmArchRing = new THREE.TorusGeometry(1.44, 0.12, 6, 16, Math.PI);
  bmArchRing.translate(bmX, bmBaseY + 2.05, bmZ + 2.15);
  reliefParts.push(remapRelief(bmArchRing, 'thanhHoaStone'));
  // Scalloped carved stone lintel & recessed carved stone "正 北 門" (Chính Bắc Môn) plaque (`BM-14`, `BM-15`)
  reliefParts.push(
    makeReliefBox(4.35, 0.24, 0.28, 'thanhHoaStone', bmX, bmBaseY + 4.02, bmZ + 2.16),
    makeReliefBox(2.55, 0.92, 0.16, 'thanhHoaStone', bmX, bmBaseY + 4.68, bmZ + 2.14)
  );
  plaqueParts.push(makePlaquePlane(2.38, 0.78, 'chinhBacMonPlaque', bmX, bmBaseY + 4.68, bmZ + 2.23));

  // Heavy Recessed *Gỗ Lim* Double Doors inside Chính Bắc Môn (`BM-16`)
  for (const side of [-1, 1]) {
    reliefParts.push(makeReliefBox(1.32, 3.25, 0.16, 'ironwoodGate', bmX + side * 0.70, bmBaseY + 1.62, bmZ + 0.85, side * 0.22));
  }
  // TWO Iconic 1882 French Cannonball Impact Craters (circular recessed discs — ZERO square borders!) + "25 AVRIL 1882" Plaque & Wall Ferns (`BM-09`, `BM-10` — Ref 123!)
  const scar1 = remapRelief(new THREE.CircleGeometry(0.46, 14), 'cannonballScar');
  scar1.rotateX(-0.09);
  scar1.translate(bmX - 3.65, bmBaseY + 3.85, bmZ + 2.08);
  const scar2 = remapRelief(new THREE.CircleGeometry(0.30, 12), 'cannonballScar');
  scar2.rotateX(-0.09);
  scar2.translate(bmX - 3.25, bmBaseY + 2.45, bmZ + 2.20);
  reliefParts.push(scar1, scar2);
  plaqueParts.push(makePlaquePlane(0.68, 0.56, 'bacMon1882Plaque', bmX - 3.50, bmBaseY + 3.12, bmZ + 2.16, 0, -0.09));
  // Small fern cluster rooting inside upper 1882 cannonball crater
  for (let fi = 0; fi < 4; fi++) {
    const fCard = new THREE.PlaneGeometry(0.32, 0.26);
    fCard.rotateY((fi - 1.5) * 0.5);
    fCard.translate(bmX - 3.65 + (fi - 1.5) * 0.08, bmBaseY + 3.82, bmZ + 2.14);
    foliageCardParts.push(colorizeGeo(fCard, '#2d6822'));
  }
  // Flanking stainless-steel heritage signage stands (`BM-17`)
  for (const side of [-1, 1]) {
    steelParts.push(makeCyl(0.03, 0.03, 0.95, 6, bmX + side * 2.55, bmBaseY + 0.48, bmZ + 2.75));
    plaqueParts.push(makePlaquePlane(0.68, 0.48, 'heritageBoard', bmX + side * 2.55, bmBaseY + 0.98, bmZ + 2.78, 0, -0.35));
  }

  // Projecting Stepped Stone Cornice (`BM-06`), Pierced *Hoa Chanh* Diamond-Lattice Parapet (`BM-05`) & FULL 2-Story Vọng Lâu Watchtower (`BM-02..04`!)
  const bmDeckY = bmBaseY + bmWallH;
  reliefParts.push(
    makeReliefBox(10.4, 0.28, 4.45, 'thanhHoaStone', bmX, bmDeckY + 0.14, bmZ),
    makeReliefBox(10.0, 0.84, 0.22, 'hoaChanhParapet', bmX, bmDeckY + 0.68, bmZ + 2.02),
    makeReliefBox(10.0, 0.84, 0.22, 'hoaChanhParapet', bmX, bmDeckY + 0.68, bmZ - 2.02)
  );
  for (const px of [-4.9, -2.45, 0, 2.45, 4.9]) {
    reliefParts.push(makeReliefBox(0.36, 0.98, 0.36, 'thanhHoaStone', bmX + px, bmDeckY + 0.72, bmZ + 2.02));
  }
  // Centered 2-Story Traditional Watchtower Pavilion (*Vọng Lâu Bắc Môn*, Ref 123 — `BM-02..04`)
  const bmPavY = bmDeckY + 0.28;
  reliefParts.push(makeReliefBox(6.8, 2.85, 3.6, 'vongLauOchre', bmX, bmPavY + 1.42, bmZ));
  for (const colX of [-3.1, -1.05, 1.05, 3.1]) {
    woodParts.push(makeCyl(0.11, 0.12, 2.85, 8, bmX + colX, bmPavY + 1.42, bmZ + 1.84));
  }
  reliefParts.push(makeReliefPlane(1.85, 2.25, 'ironwoodGate', bmX, bmPavY + 1.15, bmZ + 1.83));
  const bmRoof1 = remapRelief(createVietnameseCurvedRoofGeometry(8.6, 5.2, 5.4, 2.8, 1.25, 0.44), 'ngoiMuiHaiRoof');
  bmRoof1.translate(bmX, bmPavY + 2.85, bmZ);
  reliefParts.push(bmRoof1);
  // Slatted timber clerestory (`con tiện`) + upper tier roof (`BM-03`, `BM-04`)
  woodParts.push(makeBox(5.2, 0.72, 2.6, bmX, bmPavY + 4.35, bmZ));
  const bmRoof2 = remapRelief(createVietnameseCurvedRoofGeometry(6.8, 4.2, 2.8, 0.45, 1.55, 0.52), 'ngoiMuiHaiRoof');
  bmRoof2.translate(bmX, bmPavY + 4.68, bmZ);
  reliefParts.push(bmRoof2);
  reliefParts.push(makeReliefBox(2.9, 0.18, 0.20, 'thanhHoaStone', bmX, bmPavY + 6.26, bmZ));

  // =================================================================================================
  // SECTION 5: CỘT CỜ HÀ NỘI (HANOI FLAG TOWER, 1812 — `CH-01..CH-32`, Ref 73!)
  // =================================================================================================
  const hftX = 38.0;
  const hftZ = -76.0;
  const hftY = ctx.getHeight(hftX, hftZ);
  const hftSkirt = 2.0;

  // Stone forecourt paving & stepped approach (`CH-28`)
  reliefParts.push(makeReliefBox(30.0, 0.42, 30.0, 'imperialFlagstone', hftX, hftY - 0.18, hftZ));

  // Broad True-Pyramid 3 Diminishing Sloped Vauban Brick Bastion Tiers with ZERO UV Stretching (`CH-01..08`!)
  const bastionTiers = [
    { botW: 25.0, topW: 22.8, h: 3.3, y0: hftY, hasPortals: false },
    { botW: 17.6, topW: 15.8, h: 3.9, y0: hftY + 3.3, hasPortals: true },
    { botW: 11.4, topW: 10.0, h: 4.2, y0: hftY + 7.2, hasPortals: true }
  ];
  for (let ti = 0; ti < bastionTiers.length; ti++) {
    const bt = bastionTiers[ti];
    const yBot = ti === 0 ? bt.y0 - hftSkirt : bt.y0;
    const totalH = bt.h + (ti === 0 ? hftSkirt : 0);
    const botSpread = ti === 0 ? bt.botW + ((bt.botW - bt.topW) / bt.h) * hftSkirt : bt.botW;
    addMappedVaubanFrustum(reliefParts, hftX, yBot, hftZ, botSpread, botSpread, bt.topW, bt.topW, totalH, 'thangLongBrick');

    // Articulated corner stone quoins (`CH-05`)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const qW = (bt.botW + bt.topW) * 0.25;
        reliefParts.push(makeReliefBox(0.46, bt.h, 0.46, 'thanhHoaStone', hftX + sx * qW, bt.y0 + bt.h * 0.5, hftZ + sz * qW));
      }
    }
    // Multi-stepped projecting stone cornice coping (`CH-06`)
    reliefParts.push(
      makeReliefBox(bt.topW + 0.72, 0.24, bt.topW + 0.72, 'thanhHoaStone', hftX, bt.y0 + bt.h + 0.06, hftZ),
      makeReliefBox(bt.topW + 0.42, 0.18, bt.topW + 0.42, 'thanhHoaStone', hftX, bt.y0 + bt.h + 0.24, hftZ)
    );
    // Thick weathered pierced *hoa chanh* masonry parapet with solid corner piers (`CH-07`)
    const hw = bt.topW * 0.5 - 0.14;
    const parY = bt.y0 + bt.h + 0.76;
    reliefParts.push(
      makeReliefBox(bt.topW - 0.2, 0.88, 0.24, 'hoaChanhParapet', hftX, parY, hftZ + hw),
      makeReliefBox(bt.topW - 0.2, 0.88, 0.24, 'hoaChanhParapet', hftX, parY, hftZ - hw),
      makeReliefBox(0.24, 0.88, bt.topW - 0.2, 'hoaChanhParapet', hftX - hw, parY, hftZ),
      makeReliefBox(0.24, 0.88, bt.topW - 0.2, 'hoaChanhParapet', hftX + hw, parY, hftZ)
    );
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        reliefParts.push(makeReliefBox(0.44, 1.02, 0.44, 'thanhHoaStone', hftX + sx * hw, parY + 0.05, hftZ + sz * hw));
      }
    }

    // Deeply Recessed Arched Portals on Tiers 2 & 3 with High-Contrast Pale Plaster Surrounds & Carved Plaques (`CH-09..14`)
    if (bt.hasPortals) {
      const pAw = ti === 1 ? 2.15 : 1.75;
      const pAh = ti === 1 ? 2.65 : 2.35;
      const midHalfW = (bt.botW + bt.topW) * 0.25;
      const dirs: Array<{ ang: number; pKey: ThangLongPlaqueKey }> = [
        { ang: 0, pKey: 'huongMinhPlaque' },
        { ang: Math.PI * 0.5, pKey: 'nghenhHucPlaque' },
        { ang: -Math.PI * 0.5, pKey: 'hoiQuangPlaque' }
      ];
      for (const d of dirs) {
        const portalFrame = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(pAw + 1.15, pAh + 0.92, 0.65, pAw, pAh)), 'thangLongBrick');
        portalFrame.translate(0, 0, midHalfW + 0.14);
        portalFrame.rotateY(d.ang);
        portalFrame.translate(hftX, bt.y0 + 0.12, hftZ);
        reliefParts.push(portalFrame);

        // High-contrast pale lime-plaster arch surround (`CH-10`)
        const pTrim = new THREE.TorusGeometry(pAw * 0.52, 0.09, 6, 14, Math.PI);
        pTrim.translate(0, pAh - pAw * 0.5, midHalfW + 0.48);
        pTrim.rotateY(d.ang);
        pTrim.translate(hftX, bt.y0 + 0.12, hftZ);
        whitePlasterParts.push(pTrim);

        // Deep shadowed recessed portal door cavity (`CH-09`, `CH-14`)
        const pVoid = makeBox(pAw * 0.88, pAh * 0.86, 0.35, 0, pAh * 0.44, midHalfW + 0.06);
        pVoid.rotateY(d.ang);
        pVoid.translate(hftX, bt.y0 + 0.12, hftZ);
        voidParts.push(pVoid);

        // Crisp Carved Stone Relief Plaque ("向 明" South, "迎 旭" East, "回 光" West) proud of arch wall (`CH-11`)
        if (ti === 1) {
          const pBack = makeReliefBox(2.25, 0.78, 0.16, 'thanhHoaStone', 0, pAh + 0.46, midHalfW + 0.48);
          pBack.rotateY(d.ang);
          pBack.translate(hftX, bt.y0 + 0.12, hftZ);
          reliefParts.push(pBack);

          const pFace = makePlaquePlane(2.08, 0.66, d.pKey, 0, pAh + 0.46, midHalfW + 0.57);
          pFace.rotateY(d.ang);
          pFace.translate(hftX, bt.y0 + 0.12, hftZ);
          plaqueParts.push(pFace);
        }
      }
    }
  }

  // Crisp 8-Faceted Tapered Octagonal Brick Shaft (`CH-15..21` — ZERO smooth cylinder look!)
  const hftShaftBaseY = hftY + 11.4;
  const hftShaftH = 18.2;
  const hftShaftTopY = hftShaftBaseY + hftShaftH;
  // Stepped octagonal base plinth collar (`CH-20`)
  reliefParts.push(remapRelief(makeCyl(3.05, 3.25, 0.65, 8, hftX, hftShaftBaseY + 0.32, hftZ), 'thanhHoaStone'));
  addMappedOctagonalShaft(reliefParts, hftX, hftShaftBaseY + 0.55, hftZ, 2.74, 2.02, hftShaftH - 0.55, 'thangLongBrick', 4);

  // Exact 36 Deeply Recessed 3D 6-Petal Flower Rosette Vents (*Hoa Thị*, `CH-18`)
  for (let level = 0; level < 5; level++) {
    const frac = 0.14 + level * 0.14;
    const vy = hftShaftBaseY + hftShaftH * frac;
    const rAtY = THREE.MathUtils.lerp(2.74, 2.02, frac) * Math.cos(Math.PI / 8);
    for (let f = 0; f < 8; f++) {
      if (level === 4 && f % 2 === 1) continue;
      const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
      const vx = hftX + Math.sin(ang) * (rAtY + 0.05);
      const vz = hftZ + Math.cos(ang) * (rAtY + 0.05);
      const rosette = createRoseWindowGeometry(0.34, 6, 0.16);
      rosette.scale(0.84, 0.84, 1.0);
      rosette.rotateY(ang);
      rosette.translate(vx, vy, vz);
      whitePlasterParts.push(rosette);
      const hole = makeCyl(0.28, 0.28, 0.12, 10, 0, 0, 0);
      hole.rotateX(Math.PI * 0.5);
      hole.rotateY(ang);
      hole.translate(vx - Math.sin(ang) * 0.02, vy, vz - Math.cos(ang) * 0.02);
      voidParts.push(hole);
    }
  }
  // Exact 6 Symmetrically Aligned Upper Fan-Shaped Windows (`CH-19`)
  const fanY = hftShaftBaseY + hftShaftH * 0.86;
  const fanRAtY = THREE.MathUtils.lerp(2.74, 2.02, 0.86) * Math.cos(Math.PI / 8);
  for (let f = 0; f < 8; f++) {
    if (f === 3 || f === 7) continue;
    const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
    const fx = hftX + Math.sin(ang) * (fanRAtY + 0.05);
    const fz = hftZ + Math.cos(ang) * (fanRAtY + 0.05);
    const fanRim = new THREE.TorusGeometry(0.44, 0.07, 6, 12, Math.PI);
    fanRim.rotateY(ang);
    fanRim.translate(fx, fanY, fz);
    whitePlasterParts.push(fanRim);
    const fanSill = makeBox(0.96, 0.09, 0.16, 0, 0, 0);
    fanSill.rotateY(ang);
    fanSill.translate(fx, fanY - 0.04, fz);
    whitePlasterParts.push(fanSill);
    const fanVoid = new THREE.CylinderGeometry(0.39, 0.39, 0.12, 10, 1, false, 0, Math.PI);
    fanVoid.rotateZ(-Math.PI * 0.5);
    fanVoid.rotateY(ang + Math.PI * 0.5);
    fanVoid.translate(fx - Math.sin(ang) * 0.02, fanY, fz - Math.cos(ang) * 0.02);
    voidParts.push(fanVoid);
  }

  // Multi-Tiered Weathered Corbel Necking & Top Octagonal Watchtower (`CH-21..24`)
  reliefParts.push(
    remapRelief(makeCyl(2.42, 2.08, 0.28, 8, hftX, hftShaftTopY + 0.14, hftZ), 'thanhHoaStone'),
    remapRelief(makeCyl(2.76, 2.42, 0.30, 8, hftX, hftShaftTopY + 0.42, hftZ), 'thanhHoaStone')
  );
  const pavY = hftShaftTopY + 0.56;
  const pavH = 2.65;
  addMappedOctagonalShaft(reliefParts, hftX, pavY, hftZ, 2.46, 2.42, pavH, 'thangLongBrick', 1);
  const watchApothem = 2.44 * Math.cos(Math.PI / 8);
  for (let f = 0; f < 8; f++) {
    const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
    const wx = hftX + Math.sin(ang) * (watchApothem + 0.04);
    const wz = hftZ + Math.cos(ang) * (watchApothem + 0.04);
    const winY = pavY + pavH * 0.52;
    const wPane = makeReliefPlane(0.86, 1.38, 'colonialShutter', 0, 0, 0);
    wPane.rotateY(ang);
    wPane.translate(wx, winY, wz);
    reliefParts.push(wPane);
    for (const sy of [-0.74, 0.74]) {
      const trim = makeBox(1.04, 0.10, 0.18, 0, sy, 0.04);
      trim.rotateY(ang);
      trim.translate(wx, winY, wz);
      whitePlasterParts.push(trim);
    }
  }
  // Dark weathered flared cornice & octagonal roof cap (`CH-24`)
  reliefParts.push(
    remapRelief(makeCyl(2.42, 2.96, 0.34, 8, hftX, pavY + pavH + 0.17, hftZ), 'thanhHoaStone'),
    remapRelief(makeCyl(1.55, 2.42, 0.48, 8, hftX, pavY + pavH + 0.56, hftZ), 'thanhHoaStone')
  );

  // Full Central 8.6m Flagpole Mast & Vibrant Waving Vietnamese National Flag (`CH-25`, `CH-26`)
  const hftPoleBaseY = pavY + pavH + 0.78;
  const hftPoleH = 8.6;
  bronzeParts.push(makeCyl(0.32, 0.48, 0.68, 8, hftX, hftPoleBaseY + 0.34, hftZ));
  steelParts.push(makeCyl(0.08, 0.16, hftPoleH, 12, hftX, hftPoleBaseY + hftPoleH * 0.5, hftZ));
  goldParts.push(new THREE.ConeGeometry(0.18, 0.52, 8).translate(hftX, hftPoleBaseY + hftPoleH + 0.26, hftZ));

  let hftFlagMat: THREE.ShaderMaterial;
  if (ctx.sharedShaders) {
    hftFlagMat = ctx.sharedShaders.getWavingFlag({ waveScale: 1.2, showStar: true }).material;
  } else {
    const fl = createWavingSilkFlagMaterial({ waveScale: 1.2, showStar: true });
    ctx.extraMaterials.push(fl.material);
    registerAnimatedUniform(ctx.animatedUniforms, flagUniforms, fl.uniforms, false);
    hftFlagMat = fl.material;
  }
  const hftFlagW = 5.8;
  const hftFlagH = 3.85;
  const hftFlagGeo = new THREE.PlaneGeometry(hftFlagW, hftFlagH, 28, 16);
  hftFlagGeo.translate(hftFlagW * 0.5 + 0.1, 0, 0);
  const hftFlagMesh = new THREE.Mesh(hftFlagGeo, hftFlagMat);
  hftFlagMesh.name = 'HanoiFlagTowerSilkFlag';
  hftFlagMesh.position.set(hftX, hftPoleBaseY + hftPoleH - hftFlagH * 0.5 - 0.18, hftZ);
  hftFlagMesh.rotation.y = -0.32;
  hftFlagMesh.castShadow = true;
  group.add(hftFlagMesh);

  // Colonial Yellow Điện Biên Phủ Perimeter Wall + Dark Iron Fence (`CH-29`)
  reliefParts.push(makeReliefBox(28.0, 1.35, 0.36, 'vongLauOchre', hftX, hftY + 0.68, hftZ + 15.2));
  for (let p = -3; p <= 3; p++) {
    reliefParts.push(makeReliefBox(0.56, 1.88, 0.56, 'vongLauOchre', hftX + p * 4.4, hftY + 0.94, hftZ + 15.2));
    if (p < 3) {
      for (let bar = 1; bar <= 5; bar++) {
        steelParts.push(makeCyl(0.02, 0.02, 0.85, 4, hftX + p * 4.4 + bar * 0.72, hftY + 1.65, hftZ + 15.2));
      }
    }
  }

  // =================================================================================================
  // SECTION 6: 18 HOÀNG DIỆU ARCHAEOLOGICAL SITE SHELTER (-36, -80) & MATURE HANOI HERITAGE TREES
  // (`DM-32`, `KT-30..31`, `CH-30..31`, `BM-30..32`)
  // =================================================================================================
  const archX = -36.0;
  const archZ = -80.0;
  const archY = ctx.getHeight(archX, archZ);
  reliefParts.push(
    makeReliefBox(18.6, 1.5, 14.6, 'thanhHoaStone', archX, archY - 0.72, archZ),
    makeReliefBox(17.2, 0.45, 13.2, 'batTrangPaving', archX, archY + 0.16, archZ)
  );
  steelParts.push(
    ...createPiercedBalustradeParts(archX - 8.6, archZ - 6.6, archX + 8.6, archZ - 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX - 8.6, archZ + 6.6, archX - 2.0, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX + 2.0, archZ + 6.6, archX + 8.6, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX - 8.6, archZ - 6.6, archX - 8.6, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX + 8.6, archZ - 6.6, archX + 8.6, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe')
  );
  for (const ox of [-5.4, -1.8, 1.8, 5.4]) {
    for (const oz of [-3.0, 2.4]) {
      reliefParts.push(makeReliefBox(1.25, 0.36, 1.25, 'thanhHoaStone', archX + ox, archY + 0.56, archZ + oz));
      for (const lp of createLotusPetalRingParts(archX + ox, archY + 0.84, archZ + oz, 0.46, 8, 1, false)) {
        reliefParts.push(remapRelief(lp, 'thanhHoaStone'));
      }
    }
  }
  const sheltH = 5.4;
  for (const sx of [-8.8, -3.0, 3.0, 8.8]) {
    for (const sz of [-6.8, 6.8]) {
      woodParts.push(makeBox(0.32, sheltH, 0.32, archX + sx, archY + sheltH * 0.5, archZ + sz));
    }
    woodParts.push(makeBox(0.26, 0.32, 15.0, archX + sx, archY + sheltH + 0.12, archZ));
  }
  for (const sz of [-6.8, 0, 6.8]) {
    woodParts.push(makeBox(19.2, 0.28, 0.28, archX, archY + sheltH + (sz === 0 ? 1.15 : 0.16), archZ + sz));
  }
  for (const side of [-1, 1]) {
    const panel = makeBox(19.6, 0.10, 8.0, 0, 0, 0);
    panel.rotateX(side * 0.145);
    panel.translate(archX, archY + sheltH + 0.68, archZ + side * 3.85);
    glassParts.push(panel);
  }

  // Mature Organic Hanoi Heritage Trees (*Xà Cừ* / Banyan) framing Đoan Môn, Kính Thiên, Bắc Môn, Hậu Lâu & Cột Cờ Hà Nội (ZERO lollipop blobs! `DM-32`, `KT-30..31`, `CH-30..31`, `BM-30..32`)
  for (const [tx, tz, th, tr, sd] of [
    [-25.5, -66.0, 12.5, 4.6, 7101],
    [25.5, -66.0, 12.8, 4.6, 7102],
    [-26.5, -82.0, 13.5, 4.8, 7103],
    [26.5, -82.0, 13.0, 4.6, 7104],
    [-28.0, -107.0, 14.2, 4.2, 7105],
    [-10.5, -108.0, 14.4, 4.2, 7106],
    [10.5, -108.0, 14.2, 4.2, 7107],
    [29.5, -107.0, 14.0, 4.2, 7108],
    [hftX - 15.0, hftZ + 11.5, 11.5, 4.4, 7109],
    [hftX + 15.0, hftZ + 11.5, 11.8, 4.4, 7110],
    [hftX + 16.5, hftZ - 8.5, 13.5, 5.0, 7111],
    [hftX - 14.5, hftZ - 14.5, 13.8, 5.0, 7112]
  ]) {
    addHanoiHeritageTree(woodParts, foliageCardParts, tx, ctx.getHeight(tx, tz) - 0.15, tz, th, tr, sd);
  }

  // =================================================================================================
  // SECTION 6B: HOÀNG THÀNH THĂNG LONG QC & AREA EXPANSIONS (Items 101..145)
  // =================================================================================================
  // 101-105. Ngự Đạo Imperial Stone Way, heavy Gỗ Lim gate doors, Thành Bậc ramps, Cánh Thành wing walls & Cờ Ngũ Sắc
  for (let nz = cz + 11.0; nz >= ktZ + 9.0; nz -= 3.2) {
    reliefParts.push(makeReliefBox(3.4, 0.08, 3.0, 'imperialFlagstone', cx, yBase + 0.22, nz));
  }
  for (const a of archSpecs) {
    for (const side of [-1, 1]) {
      const doorW = a.aw * 0.44;
      woodParts.push(makeBox(0.12, a.ah * 0.85, doorW, cx + a.ox + side * (a.aw * 0.45), wallY + a.ah * 0.42, cz + gateDepth * 0.28));
      goldParts.push(makeBox(0.14, 0.14, 0.14, cx + a.ox + side * (a.aw * 0.45), wallY + a.ah * 0.45, cz + gateDepth * 0.28));
    }
  }
  for (const side of [-1, 1]) {
    // 103-104. Thành Bậc stone ramps & Cánh Thành stepped brick wing walls extending East/West
    reliefParts.push(
      makeReliefBox(1.4, 0.52, 3.8, 'thanhHoaStone', cx + side * 14.5, wallY + 0.26, cz + 4.8),
      makeReliefBox(8.5, 4.6, 1.4, 'thangLongBrick', cx + side * 17.8, wallY + 2.3, cz),
      makeReliefBox(8.5, 0.55, 1.55, 'thanhHoaStone', cx + side * 17.8, wallY + 4.85, cz)
    );
    // 105. Cờ Ngũ Sắc festival flags along Đoan Môn parapet
    for (const fx of [6.0, 10.5]) {
      woodParts.push(makeCyl(0.035, 0.045, 2.6, 6, cx + side * fx, deckY + 1.3, cz + 2.8));
      crimsonParts.push(makeBox(0.95, 0.62, 0.04, cx + side * fx + 0.48, deckY + 2.2, cz + 2.8));
    }
  }

  // 106-115. UNESCO stele, twin Đỉnh Đồng cauldrons, Chân tảng hoa sen, drainage scuppers, Vọng Lâu plaque/lanterns, Long Trì curbs, trees & benches
  reliefParts.push(
    makeReliefBox(1.45, 0.36, 0.85, 'thanhHoaStone', cx - 14.5, wallY + 0.18, cz + 11.5),
    makeReliefBox(0.92, 1.55, 0.24, 'thanhHoaStone', cx - 14.5, wallY + 1.12, cz + 11.5)
  );
  for (const side of [-1, 1]) {
    const dc = createBronzeIncenseTripodParts(cx + side * 4.8, wallY + 0.04, cz + 10.5, 0.65);
    reliefParts.push(...dc.limestoneParts.map((g) => remapRelief(g, 'thanhHoaStone')));
    bronzeParts.push(...dc.bronzeParts);
    goldParts.push(...dc.goldParts);
    // 108. Chân tảng đá hoa sen displayed along Sân Long Trì flanks
    reliefParts.push(makeReliefBox(1.15, 0.26, 1.15, 'thanhHoaStone', cx + side * 8.2, wallY + 0.13, cz - 10.5));
    // 109. Stone drainage scuppers protruding from Đoan Môn upper terrace
    reliefParts.push(makeReliefBox(0.26, 0.22, 0.72, 'thanhHoaStone', cx + side * 8.5, deckY - 0.18, cz + gateDepth * 0.5 + 0.3));
    // 113-115. Heritage courtyard planters, benches & hedges
    reliefParts.push(makeReliefBox(1.85, 0.42, 0.55, 'thanhHoaStone', cx + side * 6.5, wallY + 0.21, cz - 13.5));
  }
  plaqueParts.push(makePlaquePlane(2.15, 0.55, 'doanMonPlaque', cx, pavBaseY + 2.75, cz + 2.45));
  for (const lx of [-2.4, 2.4]) {
    const ls = createRibbedLanternShellGeometry(0.18, 0.44, 8, 6);
    ls.translate(cx + lx, pavBaseY + 2.45, cz + 2.65);
    lanternParts.push(ls);
    const lc = createLanternCoreGeometry(0.18, 0.44);
    lc.translate(cx + lx, pavBaseY + 2.45, cz + 2.65);
    lanternCoreParts.push(lc);
  }

  // 116-130. Điện Kính Thiên column plinth grid, Lan Can Rồng balustrade, stone lanterns, Hầm D67, D67 rails/plaque, Hậu Lâu stairs/rockery/urns, Giếng Cổ, Chính Bắc Môn bastions/bridge/cannon/Hạ Mã
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      reliefParts.push(remapRelief(makeCyl(0.42, 0.52, 0.22, 8, cx + gx * 4.2, ktTopY + 0.11, ktZ + gz * 3.8), 'thanhHoaStone'));
    }
  }
  reliefParts.push(
    ...createPiercedBalustradeParts(cx - 12.0, ktZ - 6.8, cx + 12.0, ktZ - 6.8, ktTopY + 0.04, 0.78, 'chu_van').map((g) =>
      remapRelief(g, 'thanhHoaStone')
    )
  );
  for (const side of [-1, 1]) {
    reliefParts.push(...createAncientStoneLanternParts(cx + side * 5.2, ktTopY, ktZ + 7.2, 0.92).map((g) => remapRelief(g, 'thanhHoaStone')));
  }
  // 119-121. Hầm D67 underground bunker stair & blast-hood entrance (38.0, -84.0) + Nhà Con Rồng railings
  const bunkerY = ctx.getHeight(38.0, -84.0);
  reliefParts.push(
    makeReliefBox(3.8, 1.45, 4.2, 'thanhHoaStone', 38.0, bunkerY + 0.72, -84.0),
    makeReliefBox(4.2, 0.24, 4.6, 'vongLauOchre', 38.0, bunkerY + 1.56, -84.0)
  );
  steelParts.push(
    ...createPiercedBalustradeParts(31.5, -71.5, 44.5, -71.5, ctx.getHeight(38.0, -71.5) + 0.35, 0.85, 'gold_pipe')
  );
  // 122-125. Hậu Lâu (-20, -103.5) side staircases, front Hòn Non Bộ rockery, ceramic lotus urns & Giếng Cổ royal well (-29.5, -86)
  const hlY = ctx.getHeight(-20.0, -103.5);
  for (const side of [-1, 1]) {
    reliefParts.push(makeReliefBox(1.8, 0.85, 2.4, 'thangLongBrick', -20.0 + side * 6.5, hlY + 0.42, -100.5));
    bronzeParts.push(makeCyl(0.36, 0.28, 0.68, 8, -20.0 + side * 2.4, hlY + 0.34, -97.8));
  }
  reliefParts.push(makeReliefBox(2.4, 1.25, 1.8, 'thanhHoaStone', -20.0, hlY + 0.62, -96.5));
  const gcY = ctx.getHeight(-29.5, -86.0);
  reliefParts.push(remapRelief(makeCyl(1.05, 1.15, 0.72, 10, -29.5, gcY + 0.36, -86.0), 'thangLongBrick'));
  woodParts.push(makeBox(0.14, 2.4, 0.14, -30.5, gcY + 1.2, -86.0), makeBox(0.14, 2.4, 0.14, -28.5, gcY + 1.2, -86.0));

  // 126-130. Chính Bắc Môn (21.0, -103.5) flanking Mang Cá bastion wings, moat causeway bridge, cannon & Hạ Mã markers
  const bmY = ctx.getHeight(21.0, -103.5);
  for (const side of [-1, 1]) {
    reliefParts.push(
      makeReliefBox(6.8, 4.8, 2.2, 'thangLongBrick', 21.0 + side * 9.8, bmY + 2.4, -103.5),
      makeReliefBox(0.48, 1.15, 0.48, 'thanhHoaStone', 21.0 + side * 4.5, bmY + 0.58, -112.0)
    );
  }
  reliefParts.push(makeReliefBox(6.4, 0.42, 7.2, 'imperialFlagstone', 21.0, bmY + 0.21, -110.5));
  bronzeParts.push(makeCyl(0.16, 0.24, 2.2, 8, 15.5, bmY + 0.68, -108.5, Math.PI * 0.46, 0, 0));

  // 131-145. Cột Cờ Hà Nội spiral turret cap, twin cannons, historical stele, corner sentry boxes, 18 Hoàng Diệu trenches/walkways/well, Artifact Pavilion (-34, -64) & wayfinding
  goldParts.push(new THREE.SphereGeometry(0.45, 8, 6).translate(hftX + 1.4, pavY + pavH + 0.8, hftZ));
  for (const side of [-1, 1]) {
    // 132. Twin historical bronze cannons flanking Cột Cờ South Plaza
    bronzeParts.push(makeCyl(0.16, 0.24, 2.35, 8, hftX + side * 6.5, hftY + 0.72, hftZ + 12.0, Math.PI * 0.48, 0, 0));
    woodParts.push(makeBox(0.95, 0.52, 1.35, hftX + side * 6.5, hftY + 0.26, hftZ + 12.0));
    // 134. Corner sentry boxes on Tier 1 battlements
    reliefParts.push(makeReliefBox(1.35, 1.85, 1.35, 'thangLongBrick', hftX + side * 12.8, hftY + 3.4, hftZ + 12.8));
  }
  // 133. 1812 historical stele at Cột Cờ south entrance
  reliefParts.push(makeReliefBox(1.15, 1.65, 0.28, 'thanhHoaStone', hftX - 9.5, hftY + 0.82, hftZ + 12.5));
  // 136-138. 18 Hoàng Diệu excavation trenches, boardwalk & Lý-Trần well inside shelter (-36, -80)
  woodParts.push(makeBox(16.5, 0.14, 1.85, archX, archY + 0.52, archZ));
  reliefParts.push(remapRelief(makeCyl(0.92, 1.02, 0.65, 10, archX + 3.8, archY + 0.48, archZ - 2.2), 'thangLongBrick'));
  // 139-141. Open-Air Heritage Artifact Pavilion at West Plaza (-34.0, -64.0) & brick ticket kiosk (-26, -56)
  const pavArtY = ctx.getHeight(-34.0, -64.0);
  reliefParts.push(makeReliefBox(8.2, 0.36, 5.6, 'imperialFlagstone', -34.0, pavArtY + 0.18, -64.0));
  for (const px of [-3.4, 0, 3.4]) {
    for (const pz of [-2.2, 2.2]) {
      woodParts.push(makeCyl(0.12, 0.14, 3.2, 8, -34.0 + px, pavArtY + 1.96, -64.0 + pz));
    }
  }
  const artRoof = createVietnameseCurvedRoofGeometry(9.2, 6.6, 4.2, 1.8, 1.45, 0.28);
  artRoof.translate(-34.0, pavArtY + 3.56, -64.0);
  reliefParts.push(remapRelief(artRoof, 'terracottaHipRoof'));
  for (const vx of [-2.0, 2.0]) {
    woodParts.push(makeBox(1.25, 0.88, 0.95, -34.0 + vx, pavArtY + 0.80, -64.0));
    glassParts.push(makeBox(1.18, 0.72, 0.88, -34.0 + vx, pavArtY + 1.56, -64.0));
  }
  reliefParts.push(makeReliefBox(3.4, 2.8, 2.8, 'vongLauOchre', -26.0, ctx.getHeight(-26.0, -56.0) + 1.4, -56.0));
  // 142-145. Park lamps, stone benches & wayfinding post
  for (const [lx, lz] of [[-12.5, -55.0], [12.5, -55.0], [-14.0, -76.0], [14.0, -76.0]] as const) {
    const ly = ctx.getHeight(lx, lz);
    steelParts.push(makeCyl(0.05, 0.10, 3.0, 6, lx, ly + 1.5, lz));
    lanternCoreParts.push(new THREE.SphereGeometry(0.18, 8, 6).translate(lx, ly + 3.12, lz));
  }
  reliefParts.push(makeReliefBox(0.95, 1.45, 0.12, 'thanhHoaStone', -12.5, ctx.getHeight(-12.5, -55.0) + 0.72, -55.0));

  // Motif heritage tags & phoenix terracotta roof ornaments
  for (const side of [-1, 1]) {
    for (const ph of createPhoenixFinialParts(cx + side * 4.2, ktTopY + 0.42, ktZ + 8.6, side < 0 ? 0.5 : -0.5, 0.85, 'single')) {
      reliefParts.push(remapRelief(ph, 'terracottaHipRoof'));
    }
  }
  tagMotifIds(group, [
    'HV-A01', 'HV-A02', 'HV-A04', 'HV-A06', 'HV-C02', 'HV-C13', 'HV-C14',
    'HV-D01', 'HV-D02', 'HV-D06', 'HV-D14', 'HV-D15', 'HV-H05', 'HV-H11',
    'HV-I01', 'HV-NEW-MB-03', 'HV-NEW-MB-04', 'HV-NEW-MB-09', 'HV-NEW-MB-12'
  ]);

  // Warm interior lighting inside Đoan Môn Vọng Lâu & central Emperor Vault
  const vongLauLight = new THREE.PointLight('#ffca72', 1.8, 16, 1.5);
  vongLauLight.position.set(cx, pavBaseY + 2.15, cz + 3.1);
  group.add(vongLauLight);

  // =================================================================================================
  // SECTION 7: CLEAN BATCHED MERGE (REPLACES 3 LEGACY MATERIALS WITH 2 ATLASES + 1 ALPHA FOLIAGE -> NET 0!)
  // =================================================================================================
  const addMerged = (
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    name: string,
    castShadow = true,
    receiveShadow = true
  ) => {
    const m = createMergedMesh(name, parts, mat, castShadow, receiveShadow);
    if (m) group.add(m);
  };

  const folMat =
    ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide
    }) ?? ctx.materials.darkWood;

  addMerged([...reliefParts, ...plaqueParts], tl.thangLongMasterAtlasMat, 'HoangThanhMasterAtlasMesh', true, true);
  addMerged(whitePlasterParts, ctx.materials.whitePlaster, 'HoangThanhWhitePlasterTrim', false, true);
  addMerged(crimsonParts, ctx.materials.crimsonLacquer, 'HoangThanhCrimsonAndAccents', false, true);
  addMerged(goldParts, ctx.materials.gold, 'HoangThanhGoldTrim', false, false);
  addMerged(woodParts, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhTimberFrames', false, true);
  addMerged(bronzeParts, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhBronzeRelics', false, true);
  addMerged(lanternParts, ctx.materials.lanternSilk, 'HoangThanhLanterns', false, false);
  addMerged(lanternCoreParts, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhLanternCores', false, false);
  addMerged(voidParts, ctx.materials.darkVoid, 'HoangThanhDarkRecesses', false, false);
  addMerged(steelParts, stainlessMat, 'HoangThanhIronHardware', false, false);
  addMerged(foliageCardParts, folMat, 'HoangThanhHeritageFoliage', false, false);
  addMerged(glassParts, ctx.materials.stainedGlass ?? stainlessMat, 'HoangDieuShelterGlass', false, false);

  if (smokeSources.length > 0) {
    const smoke = createIncenseSmokeSystem(smokeSources, ctx.sharedShaders?.incenseSmoke);
    smoke.mesh.name = 'HoangThanhIncenseSmoke';
    group.add(smoke.mesh);
    if (!ctx.sharedShaders) {
      ctx.extraMaterials.push(smoke.mesh.material as THREE.Material);
      registerAnimatedUniform(ctx.animatedUniforms, flagUniforms, smoke.uniforms, false);
    }
  }
  ctx.scene.add(group);
}
