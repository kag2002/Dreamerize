import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createHueImperialHipRoofGeometry,
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
  const upperRoof = remapRelief(createHueImperialHipRoofGeometry(12.2, 5.4, 4.8, 0.36, 2.08, 0.42, 10, 6, false), 'ngoiMuiHaiRoof');
  upperRoof.translate(cx, coDiemY + coDiemH + 0.02, cz);
  reliefParts.push(upperRoof);

  const ridgeY = coDiemY + coDiemH + 2.12;
  reliefParts.push(makeReliefBox(5.0, 0.22, 0.26, 'thanhHoaStone', cx, ridgeY, cz));
  for (const sEnd of [-1, 1]) {
    const kim = new THREE.TorusGeometry(0.26, 0.075, 5, 10, Math.PI * 1.35);
    kim.rotateZ(sEnd > 0 ? 0.4 : Math.PI - 0.4);
    kim.translate(cx + sEnd * 2.42, ridgeY + 0.26, cz);
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
  const ncrRoof = remapRelief(createHueImperialHipRoofGeometry(ncrW + 1.6, ncrD + 1.6, ncrW - 5.2, 0.42, 2.85, 0.04, 10, 6, false), 'terracottaHipRoof');
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
  const bmRoof2 = remapRelief(createHueImperialHipRoofGeometry(6.8, 4.2, 2.8, 0.32, 1.55, 0.38, 8, 5, false), 'ngoiMuiHaiRoof');
  bmRoof2.translate(bmX, bmPavY + 4.68, bmZ);
  reliefParts.push(bmRoof2);
  reliefParts.push(makeReliefBox(2.9, 0.18, 0.22, 'thanhHoaStone', bmX, bmPavY + 6.26, bmZ));

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

  // Mature Organic Hanoi Heritage Trees (*Xà Cừ* / Banyan) framing Đoan Môn, Kính Thiên, Bắc Môn, Hậu Lâu & Cột Cờ Hà Nội (ZERO roof/shelter piercing! `DM-32`, `KT-30..31`, `CH-30..31`, `BM-30..32`)
  for (const [tx, tz, th, tr, sd] of [
    [-22.0, -68.5, 12.5, 4.2, 7101],
    [25.5, -60.5, 12.8, 4.2, 7102],
    [-49.5, -80.0, 13.5, 4.4, 7103],
    [18.5, -90.5, 13.0, 4.2, 7104],
    [-35.0, -112.5, 14.2, 4.0, 7105],
    [-4.5, -112.5, 14.4, 4.0, 7106],
    [5.5, -112.0, 14.2, 4.0, 7107],
    [38.5, -106.5, 14.0, 4.0, 7108],
    [hftX - 15.0, hftZ + 17.5, 11.5, 4.0, 7109],
    [hftX + 15.0, hftZ + 17.5, 11.8, 4.0, 7110],
    [hftX + 20.5, hftZ - 8.5, 13.5, 4.4, 7111],
    [hftX - 14.5, hftZ - 16.5, 13.8, 4.4, 7112]
  ]) {
    addHanoiHeritageTree(woodParts, foliageCardParts, tx, ctx.getHeight(tx, tz) - 0.15, tz, th, tr, sd);
  }

  // =================================================================================================
  // SECTION 6B: HOÀNG THÀNH THĂNG LONG QC & AREA EXPANSIONS (Items 101..145)
  // =================================================================================================
  // 101-105. Ngự Đạo Imperial Stone Way, Thành Bậc ramps, Cánh Thành wing walls & Cờ Ngũ Sắc
  for (let nz = cz + 11.0; nz >= ktZ + 9.0; nz -= 3.2) {
    reliefParts.push(makeReliefBox(3.4, 0.08, 3.0, 'imperialFlagstone', cx, yBase + 0.22, nz));
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
    // Timber bracket arm attaching each Vọng Lâu lantern to the facade (ZERO floating lanterns!)
    woodParts.push(makeBox(0.06, 0.06, 0.34, cx + lx, pavBaseY + 2.72, cz + 2.52));
    const ls = createRibbedLanternShellGeometry(0.18, 0.44, 8, 6);
    ls.translate(cx + lx, pavBaseY + 2.45, cz + 2.65);
    lanternParts.push(ls);
    const lc = createLanternCoreGeometry(0.18, 0.44);
    lc.translate(cx + lx, pavBaseY + 2.45, cz + 2.65);
    lanternCoreParts.push(lc);
  }

  // 116-130. Điện Kính Thiên column plinth grid, stone lanterns, Hầm D67 (behind Nhà Con Rồng, clear of Cột Cờ!), Hậu Lâu terrace props, Giếng Cổ, Chính Bắc Môn wings/bridge/cannon/Hạ Mã
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      reliefParts.push(remapRelief(makeCyl(0.42, 0.52, 0.22, 8, cx + gx * 4.2, ktTopY + 0.11, ktZ + gz * 3.8), 'thanhHoaStone'));
    }
  }
  for (const side of [-1, 1]) {
    reliefParts.push(...createAncientStoneLanternParts(cx + side * 5.2, ktTopY, ktZ + 7.2, 0.92).map((g) => remapRelief(g, 'thanhHoaStone')));
  }
  // 119. Hầm D67 underground bunker stair & blast-hood entrance behind Nhà Con Rồng (-12.5, -109.5 — clear of Cột Cờ Hà Nội!)
  const bunkerX = -12.5;
  const bunkerZ = -109.5;
  const bunkerY = ctx.getHeight(bunkerX, bunkerZ);
  reliefParts.push(
    makeReliefBox(3.8, 1.45, 4.2, 'thanhHoaStone', bunkerX, bunkerY + 0.72, bunkerZ),
    makeReliefBox(4.2, 0.24, 4.6, 'vongLauOchre', bunkerX, bunkerY + 1.56, bunkerZ)
  );
  // 122-125. Hậu Lâu (-20, -103.5, seated on ktTopY!) side staircases, front Hòn Non Bộ rockery, ceramic lotus urns & Giếng Cổ royal well (-29.5, -86)
  const hlY = ktTopY;
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
      makeReliefBox(6.8, 4.8, 2.2, 'thangLongBrick', 21.0 + side * 9.8, bmBaseY + 2.4, -103.5),
      makeReliefBox(0.48, 1.15, 0.48, 'thanhHoaStone', 21.0 + side * 4.5, bmY + 0.58, -112.0)
    );
  }
  reliefParts.push(makeReliefBox(6.4, 0.42, 7.2, 'imperialFlagstone', 21.0, bmY + 0.21, -110.5));
  bronzeParts.push(makeCyl(0.16, 0.24, 2.2, 8, 15.5, bmY + 0.68, -108.5, Math.PI * 0.46, 0, 0));

  // 131-145. Cột Cờ Hà Nội twin cannons, historical stele, corner sentry boxes (seated on Tier 1 terrace!), 18 Hoàng Diệu trenches/walkways/well, Artifact Pavilion (-34, -64) & wayfinding
  for (const side of [-1, 1]) {
    // 132. Twin historical bronze cannons flanking Cột Cờ South Plaza
    bronzeParts.push(makeCyl(0.16, 0.24, 2.35, 8, hftX + side * 6.5, hftY + 0.72, hftZ + 12.0, Math.PI * 0.48, 0, 0));
    woodParts.push(makeBox(0.95, 0.52, 1.35, hftX + side * 6.5, hftY + 0.26, hftZ + 12.0));
    // 134. Corner sentry boxes seated inside Tier 1 battlements (topW = 22.8 -> ±9.8m!)
    reliefParts.push(makeReliefBox(1.35, 1.85, 1.35, 'thangLongBrick', hftX + side * 9.8, hftY + 4.22, hftZ + 9.8));
  }
  // 133. 1812 historical stele at Cột Cờ south entrance
  reliefParts.push(makeReliefBox(1.15, 1.65, 0.28, 'thanhHoaStone', hftX - 9.5, hftY + 0.82, hftZ + 12.5));
  // 136-138. 18 Hoàng Diệu excavation trenches, boardwalk & Lý-Trần well inside shelter (-36, -80)
  woodParts.push(makeBox(16.5, 0.14, 1.85, archX, archY + 0.52, archZ));
  reliefParts.push(remapRelief(makeCyl(0.92, 1.02, 0.65, 10, archX + 3.8, archY + 0.48, archZ - 2.2), 'thangLongBrick'));
  // 139-141. Open-Air Heritage Artifact Pavilion at West Plaza (-34.0, -64.0) & brick ticket kiosk (-26, -56, with tiled roof!)
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
  const tkBaseY = ctx.getHeight(-26.0, -56.0);
  reliefParts.push(
    makeReliefBox(3.4, 2.8, 2.8, 'vongLauOchre', -26.0, tkBaseY + 1.4, -56.0),
    makeReliefBox(3.9, 0.32, 3.3, 'terracottaHipRoof', -26.0, tkBaseY + 2.94, -56.0)
  );
  // 142-145. Park lamps, stone benches & wayfinding post
  for (const [lx, lz] of [[-12.5, -55.0], [12.5, -55.0], [-14.0, -76.0], [14.0, -76.0]] as const) {
    const ly = ctx.getHeight(lx, lz);
    steelParts.push(makeCyl(0.05, 0.10, 3.0, 6, lx, ly + 1.5, lz));
    lanternCoreParts.push(new THREE.SphereGeometry(0.18, 8, 6).translate(lx, ly + 3.12, lz));
  }
  reliefParts.push(makeReliefBox(0.95, 1.45, 0.12, 'thanhHoaStone', -10.8, ctx.getHeight(-10.8, -55.0) + 0.72, -55.0));

  // Motif heritage tags & phoenix terracotta roof ornaments seated on carved stone display pedestals!
  for (const side of [-1, 1]) {
    reliefParts.push(makeReliefBox(0.75, 0.44, 0.75, 'thanhHoaStone', cx + side * 4.2, ktTopY + 0.22, ktZ + 8.6));
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

  // =================================================================================================
  // SECTION 7B: HOÀNG THÀNH THĂNG LONG WAVE 2 REAL-WORLD DETAILS (Items 301..350)
  // Low-poly batched meshes (castShadow = false, 0 new materials)
  // =================================================================================================
  const tlW2Relief: THREE.BufferGeometry[] = [];
  const tlW2Wood: THREE.BufferGeometry[] = [];
  const tlW2Bronze: THREE.BufferGeometry[] = [];
  const tlW2Gold: THREE.BufferGeometry[] = [];
  const tlW2Crimson: THREE.BufferGeometry[] = [];
  const tlW2Steel: THREE.BufferGeometry[] = [];
  const tlW2Glass: THREE.BufferGeometry[] = [];
  const tlW2Glow: THREE.BufferGeometry[] = [];

  // 301-306. Đoan Môn stone guardian lions, Sân Long Trì offering altar, Emperor Vault Bát Bửu racks, Vọng Lâu signal drum & bell, Cánh Thành embrasures
  for (const side of [-1, 1]) {
    tlW2Relief.push(
      makeReliefBox(0.65, 0.52, 0.85, 'thanhHoaStone', cx + side * 3.2, wallY + 0.26, cz + 8.8),
      makeReliefBox(0.45, 0.68, 0.58, 'thanhHoaStone', cx + side * 3.2, wallY + 0.86, cz + 8.8),
      // 306. Cánh Thành parapet embrasures & gun pads
      makeReliefBox(1.8, 0.65, 0.55, 'thangLongBrick', cx + side * 19.5, wallY + 5.25, cz + 0.45),
      makeReliefBox(1.8, 0.65, 0.55, 'thangLongBrick', cx + side * 15.8, wallY + 5.25, cz + 0.45),
      // 313. Secondary rear maintenance steps behind Cánh Thành wing walls
      makeReliefBox(1.6, 0.85, 2.2, 'thangLongBrick', cx + side * 18.2, wallY + 0.42, cz - 2.4)
    );
    // 303. Bát Bửu ceremonial halberd racks inside central Emperor Vault
    tlW2Bronze.push(
      makeCyl(0.03, 0.04, 2.15, 5, cx + side * 1.35, wallY + 1.08, cz - 1.2),
      makeCyl(0.03, 0.04, 2.15, 5, cx + side * 1.35, wallY + 1.08, cz + 1.2)
    );
    // 312. Tall vertical imperial dragon-pennant banners flanking Sân Long Trì
    tlW2Wood.push(makeCyl(0.04, 0.05, 4.6, 5, cx + side * 6.8, wallY + 2.3, cz - 14.5));
    tlW2Crimson.push(makeBox(0.06, 2.2, 0.62, cx + side * 6.8, wallY + 3.4, cz - 14.1));
    // 316. Exposed Lý-Trần brick drainage channel running parallel to Ngự Đạo
    tlW2Relief.push(makeReliefBox(0.42, 0.10, 14.0, 'thangLongBrick', cx + side * 3.2, wallY + 0.05, cz - 13.5));
    // 317. Stone garden table & round stools under Sân Long Trì trees
    tlW2Relief.push(
      makeReliefBox(0.95, 0.68, 0.95, 'thanhHoaStone', cx + side * 11.5, wallY + 0.34, cz - 15.5),
      makeReliefBox(0.36, 0.40, 0.36, 'thanhHoaStone', cx + side * 10.4, wallY + 0.20, cz - 15.5),
      makeReliefBox(0.36, 0.40, 0.36, 'thanhHoaStone', cx + side * 12.6, wallY + 0.20, cz - 15.5)
    );
    // 318. Reconstructed imperial guard sentry posts flanking Đoan Môn
    tlW2Relief.push(makeReliefBox(1.45, 2.15, 1.45, 'vongLauOchre', cx + side * 16.5, wallY + 1.08, cz + 11.5));
    tlW2Relief.push(makeReliefBox(1.85, 0.28, 1.85, 'terracottaHipRoof', cx + side * 16.5, wallY + 2.28, cz + 11.5));
  }
  // 302, 304-305. Sân Long Trì offering altar, Vọng Lâu signal drum & East terrace signal bell
  tlW2Relief.push(makeReliefBox(2.2, 0.88, 0.95, 'thanhHoaStone', cx, wallY + 0.44, cz - 11.0));
  tlW2Crimson.push(makeCyl(0.46, 0.46, 0.82, 6, cx - 2.6, pavBaseY + 1.35, cz, 0, Math.PI * 0.5));
  tlW2Wood.push(makeBox(0.95, 0.72, 0.68, cx - 2.6, pavBaseY + 0.45, cz));
  tlW2Wood.push(
    makeBox(0.14, 2.1, 0.14, cx + 10.2, deckY + 1.05, cz - 1.5),
    makeBox(0.14, 2.1, 0.14, cx + 11.6, deckY + 1.05, cz - 1.5),
    makeBox(1.65, 0.14, 0.18, cx + 10.9, deckY + 2.12, cz - 1.5)
  );
  tlW2Bronze.push(makeCyl(0.22, 0.34, 0.78, 6, cx + 10.9, deckY + 1.45, cz - 1.5));

  // 307-311, 314-315. Bilingual UNESCO lectern, 6 plaza lamp posts, stone culvert bridge, stamped-brick vitrine, 4 podocarpus pedestals, 4 photo-exhibition easels & tortoise stele fragment
  tlW2Relief.push(makeReliefBox(0.95, 0.82, 0.55, 'thanhHoaStone', cx - 12.6, wallY + 0.41, cz + 11.5));
  tlW2Glass.push(makeBox(0.92, 0.08, 0.58, cx - 12.6, wallY + 0.88, cz + 11.5, 0, 0.35));
  for (const lz of [-78.0, -83.0, -88.0]) {
    for (const side of [-1, 1]) {
      const ly = ctx.getHeight(cx + side * 8.5, lz);
      tlW2Bronze.push(makeCyl(0.05, 0.09, 2.85, 5, cx + side * 8.5, ly + 1.42, lz));
      tlW2Glow.push(makeBox(0.24, 0.28, 0.24, cx + side * 8.5, ly + 2.95, lz));
    }
  }
  tlW2Relief.push(
    makeReliefBox(3.6, 0.24, 1.65, 'thanhHoaStone', cx - 6.5, wallY + 0.22, cz - 11.5),
    makeReliefBox(1.35, 0.85, 0.85, 'thanhHoaStone', cx + 10.5, wallY + 0.42, cz - 9.5),
    makeReliefBox(1.15, 0.58, 0.82, 'thanhHoaStone', cx + 12.2, wallY + 0.29, cz - 12.5)
  );
  tlW2Glass.push(makeBox(1.25, 0.65, 0.78, cx + 10.5, wallY + 1.15, cz - 9.5));
  for (const px of [-8.8, -5.2, 5.2, 8.8]) {
    tlW2Relief.push(makeReliefBox(0.85, 0.72, 0.85, 'thanhHoaStone', cx + px, wallY + 0.36, cz + 13.6));
    tlW2Relief.push(makeReliefBox(0.68, 0.42, 0.68, 'courtyardLawn', cx + px, wallY + 0.92, cz + 13.6));
  }
  for (let ei = 0; ei < 4; ei++) {
    const ez = -76.5 - ei * 3.0;
    tlW2Wood.push(
      makeBox(0.10, 1.65, 0.10, cx - 12.8, wallY + 0.82, ez),
      makeBox(0.10, 0.88, 1.15, cx - 12.72, wallY + 1.25, ez)
    );
  }

  // 319-323. Điện Kính Thiên secondary offering table, stone censer (clear of bronze cauldron!), 4 corner flagpoles & 1428 foundation stele (on ktTopY!)
  tlW2Crimson.push(makeBox(2.4, 0.88, 0.92, cx, ktTopY + 0.44, ktZ + 1.8));
  tlW2Relief.push(makeReliefBox(1.25, 0.78, 0.85, 'thanhHoaStone', cx, ktTopY + 0.39, ktZ + 6.8));
  for (const side of [-1, 1]) {
    for (const fz of [-5.8, 5.8]) {
      tlW2Crimson.push(makeCyl(0.04, 0.05, 4.2, 5, cx + side * 11.2, ktTopY + 2.1, ktZ + fz));
      tlW2Gold.push(makeBox(0.06, 1.25, 0.58, cx + side * 11.2, ktTopY + 3.45, ktZ + fz + 0.32));
    }
  }
  tlW2Relief.push(makeReliefBox(1.05, 1.55, 0.24, 'thanhHoaStone', cx + 7.2, ktTopY + 0.78, ktZ + 10.2));

  // 324-327. Hầm D67 blast door, vent stack, radio mast & info stand (at actual bunkerX = -12.5, bunkerZ = -109.5!)
  tlW2Steel.push(
    makeBox(1.35, 1.75, 0.16, bunkerX, bunkerY + 0.88, bunkerZ + 2.15),
    makeCyl(0.22, 0.22, 1.45, 6, bunkerX + 1.4, bunkerY + 2.25, bunkerZ),
    makeCyl(0.04, 0.08, 7.2, 5, bunkerX - 3.2, bunkerY + 3.6, bunkerZ - 0.5)
  );
  tlW2Bronze.push(makeBox(0.85, 1.15, 0.14, bunkerX - 2.4, bunkerY + 0.58, bunkerZ + 2.0));

  // 328-335. Hậu Lâu tea table, pair of stone lanterns, crenellated brick garden wall, Giếng Cổ roof canopy & crossbar, cannonball pyramid, open timber gate leaves & moat revetment
  tlW2Wood.push(
    makeBox(1.05, 0.58, 0.75, -20.0, hlY + 0.29, -98.8),
    makeBox(0.32, 0.36, 0.32, -20.9, hlY + 0.18, -98.8),
    makeBox(0.32, 0.36, 0.32, -19.1, hlY + 0.18, -98.8)
  );
  for (const side of [-1, 1]) {
    tlW2Relief.push(
      makeReliefBox(0.42, 0.95, 0.42, 'thanhHoaStone', -20.0 + side * 3.2, hlY + 0.48, -96.5),
      makeReliefBox(0.54, 0.18, 0.54, 'terracottaHipRoof', -20.0 + side * 3.2, hlY + 1.05, -96.5),
      makeReliefBox(0.36, 1.15, 8.5, 'thangLongBrick', -20.0 + side * 8.2, hlY + 0.58, -99.5),
      // 334-335. Chính Bắc Môn open timber gate leaves (on bmBaseY!) & moat revetment walls
      makeBox(0.14, 2.85, 1.25, 21.0 + side * 1.45, bmBaseY + 1.45, -104.5),
      makeReliefBox(0.55, 0.95, 7.6, 'thanhHoaStone', 21.0 + side * 3.45, bmY + 0.48, -110.5)
    );
  }
  tlW2Relief.push(makeReliefBox(2.6, 0.32, 2.6, 'terracottaHipRoof', -29.5, gcY + 2.52, -86.0));
  tlW2Wood.push(makeCyl(0.06, 0.06, 2.0, 5, -29.5, gcY + 1.65, -86.0, 0, Math.PI * 0.5));
  tlW2Bronze.push(
    makeBox(0.68, 0.22, 0.68, 14.2, bmY + 0.11, -108.5),
    new THREE.ConeGeometry(0.30, 0.42, 4).rotateY(Math.PI * 0.25).translate(14.2, bmY + 0.42, -108.5)
  );

  // 336-350. Cột Cờ gun pads, cannonball pyramids, iron handrails, 4 floodlight bollards, 1812 marker; 18 Hoàng Diệu stratigraphic pit, drain pipes, grid stakes, stratigraphy lectern; West Pavilion dragon-tile plinths, docent desk, turnstiles, souvenir kiosk, perimeter flowerbeds & signpost
  for (const side of [-1, 1]) {
    tlW2Relief.push(makeReliefBox(1.85, 0.26, 2.45, 'thanhHoaStone', hftX + side * 6.5, hftY + 0.13, hftZ + 12.0));
    tlW2Bronze.push(new THREE.ConeGeometry(0.28, 0.38, 4).rotateY(Math.PI * 0.25).translate(hftX + side * 7.8, hftY + 0.28, hftZ + 12.0));
    tlW2Steel.push(makeBox(0.08, 0.92, 4.2, hftX + side * 2.2, hftY + 0.95, hftZ + 10.2));
  }
  for (const sx of [-11.5, 11.5]) {
    for (const sz of [-11.5, 11.5]) {
      tlW2Bronze.push(makeCyl(0.10, 0.12, 0.55, 5, hftX + sx, hftY + 0.28, hftZ + sz));
      tlW2Glow.push(makeBox(0.12, 0.12, 0.12, hftX + sx, hftY + 0.60, hftZ + sz));
    }
  }
  tlW2Relief.push(makeReliefBox(0.95, 0.48, 0.95, 'thanhHoaStone', hftX, hftY + 0.24, hftZ + 13.8));
  // 341-344. 18 Hoàng Diệu stratigraphic excavation pit, terracotta drain pipes, grid stakes & stratigraphy lectern
  tlW2Relief.push(
    makeReliefBox(4.8, 0.28, 3.6, 'thangLongBrick', archX - 3.6, archY + 0.32, archZ + 2.4),
    makeReliefBox(3.4, 0.24, 2.4, 'thanhHoaStone', archX - 3.6, archY + 0.48, archZ + 2.4)
  );
  tlW2Crimson.push(
    makeCyl(0.16, 0.16, 2.8, 6, archX - 3.6, archY + 0.66, archZ + 2.4, 0, Math.PI * 0.5),
    makeCyl(0.04, 0.04, 0.85, 4, archX - 5.8, archY + 0.68, archZ + 4.0),
    makeCyl(0.04, 0.04, 0.85, 4, archX - 1.4, archY + 0.68, archZ + 4.0)
  );
  tlW2Wood.push(makeBox(1.15, 0.92, 0.58, archX + 5.8, archY + 0.98, archZ + 0.5));
  // 345-350. Artifact Pavilion extra dragon-tile plinths, docent desk, entry turnstiles, souvenir kiosk (-28, -51), Điện Biên Phủ flowerbeds & 18 Hoàng Diệu signpost
  tlW2Relief.push(makeReliefBox(0.85, 0.78, 0.85, 'thanhHoaStone', -34.0, pavArtY + 0.58, -64.0));
  tlW2Crimson.push(new THREE.ConeGeometry(0.24, 0.42, 5).translate(-34.0, pavArtY + 1.18, -64.0));
  const tkW2Y = ctx.getHeight(-26.0, -56.0);
  tlW2Wood.push(makeBox(1.25, 0.82, 0.65, -23.6, tkW2Y + 0.41, -56.0));
  for (let tb = 0; tb < 3; tb++) {
    tlW2Steel.push(makeCyl(0.08, 0.10, 0.95, 5, -22.5 + tb * 1.1, tkW2Y + 0.48, -53.8));
  }
  const svY = ctx.getHeight(-28.0, -51.0);
  tlW2Relief.push(
    makeReliefBox(2.8, 2.35, 2.2, 'vongLauOchre', -28.0, svY + 1.18, -51.0),
    makeReliefBox(3.2, 0.28, 2.6, 'terracottaHipRoof', -28.0, svY + 2.48, -51.0),
    makeReliefBox(4.8, 0.42, 0.95, 'thangLongBrick', hftX - 6.5, hftY + 0.21, hftZ + 14.3),
    makeReliefBox(4.8, 0.42, 0.95, 'thangLongBrick', hftX + 6.5, hftY + 0.21, hftZ + 14.3),
    makeReliefBox(0.22, 1.65, 0.22, 'thanhHoaStone', -28.5, ctx.getHeight(-28.5, -92.0) + 0.82, -92.0)
  );

  addMerged(tlW2Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave2AtlasMesh', false, true);
  addMerged(tlW2Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave2Wood', false, true);
  addMerged(tlW2Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave2Bronze', false, true);
  addMerged(tlW2Gold, ctx.materials.gold, 'HoangThanhWave2Gold', false, false);
  addMerged(tlW2Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave2Crimson', false, true);
  addMerged(tlW2Steel, stainlessMat, 'HoangThanhWave2Steel', false, false);
  addMerged(tlW2Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave2Glass', false, false);
  addMerged(tlW2Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave2Glow', false, false);

  // =================================================================================================
  // SECTION 7C: HOÀNG THÀNH THĂNG LONG WAVE 3 REAL-WORLD DETAILS (Items 601..700)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // =================================================================================================
  const tlW3Relief: THREE.BufferGeometry[] = [];
  const tlW3Wood: THREE.BufferGeometry[] = [];
  const tlW3Bronze: THREE.BufferGeometry[] = [];
  const tlW3Gold: THREE.BufferGeometry[] = [];
  const tlW3Crimson: THREE.BufferGeometry[] = [];
  const tlW3Steel: THREE.BufferGeometry[] = [];
  const tlW3Glass: THREE.BufferGeometry[] = [];
  const tlW3Glow: THREE.BufferGeometry[] = [];

  // 601-630. Đoan Môn, Cánh Thành & Sân Long Trì details (đấu củng, shutters, Vọng Lâu shrine, halberds, water cauldrons, axis bollards, vitrines, rampart shelters, cannons, lanterns, shade pavilions, festival drum/gong, uplights)
  tlW3Crimson.push(makeBox(1.85, 0.88, 0.78, cx, pavBaseY + 0.44, cz));
  tlW3Bronze.push(makeCyl(0.16, 0.12, 0.30, 6, cx, pavBaseY + 1.04, cz));
  tlW3Relief.push(
    makeReliefBox(1.35, 0.85, 0.65, 'thanhHoaStone', cx + 4.5, wallY + 0.42, cz + 12.8),
    makeReliefBox(3.6, 0.24, 1.65, 'thanhHoaStone', cx + 6.5, wallY + 0.22, cz - 11.5),
    makeReliefBox(1.85, 0.38, 1.85, 'thanhHoaStone', cx - 5.5, wallY + 0.19, -84.0),
    makeReliefBox(1.45, 1.15, 0.36, 'thanhHoaStone', cx + 13.8, wallY + 0.58, -81.0),
    makeReliefBox(1.85, 0.44, 0.65, 'thanhHoaStone', cx + 15.2, wallY + 0.22, cz + 11.5)
  );
  tlW3Wood.push(
    makeBox(0.92, 1.45, 0.52, cx - 15.2, wallY + 0.72, cz - 4.8),
    makeBox(1.15, 0.72, 0.78, cx - 5.5, wallY + 0.72, -84.0),
    makeBox(0.12, 2.05, 0.12, cx + 4.8, wallY + 0.96, -84.0),
    makeBox(0.12, 2.05, 0.12, cx + 6.2, wallY + 0.96, -84.0),
    makeBox(1.65, 0.14, 0.14, cx + 5.5, wallY + 1.98, -84.0)
  );
  tlW3Crimson.push(makeCyl(0.48, 0.48, 0.85, 6, cx - 5.5, wallY + 1.45, -84.0, 0, Math.PI * 0.5));
  tlW3Bronze.push(makeCyl(0.36, 0.36, 0.08, 6, cx + 5.5, wallY + 1.38, -84.0, Math.PI * 0.5));
  for (const side of [-1, 1]) {
    // 601-602, 604. Vọng Lâu brackets, shutters & halberd racks
    tlW3Wood.push(
      makeBox(0.32, 0.28, 0.52, cx + side * 5.4, pavBaseY + 3.12, cz + 2.45),
      makeBox(1.05, 1.45, 0.10, cx + side * 5.4, pavBaseY + 1.65, cz + 2.48)
    );
    tlW3Bronze.push(
      makeCyl(0.03, 0.04, 2.05, 5, cx + side * 5.2, deckY + 1.02, cz),
      // 605, 627. Imperial water cauldrons (Vạc Đồng) & North Emperor Vault censers
      makeCyl(0.58, 0.42, 0.72, 6, cx + side * 8.2, wallY + 0.36, cz + 7.2),
      makeCyl(0.24, 0.18, 0.46, 6, cx + side * 2.8, wallY + 0.23, cz - 5.4)
    );
    // 606, 615. Ngự Đạo axis bollards & 6 hexagonal stone lotus bowls
    for (const az of [-76.0, -81.0, -86.0]) {
      tlW3Relief.push(
        makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', cx + side * 2.4, wallY + 0.34, az),
        makeReliefBox(0.48, 0.38, 0.48, 'thanhHoaStone', cx + side * 3.8, wallY + 0.19, az)
      );
    }
    // 607-608. Outdoor archaeological vitrines along Sân Long Trì
    tlW3Relief.push(makeReliefBox(1.35, 0.82, 0.85, 'thanhHoaStone', cx + side * 9.5, wallY + 0.41, -79.5));
    tlW3Glass.push(makeBox(1.25, 0.58, 0.78, cx + side * 9.5, wallY + 1.10, -79.5));
    // 609-610. Cánh Thành rampart sentry watch-shelters (posts narrowed to ±0.52m, seated cleanly on Cánh Thành coping!) & compact garrison cannons
    const wingTopY = wallY + 5.12;
    for (const dx of [-1.05, 1.05]) {
      for (const dz of [-0.52, 0.52]) {
        tlW3Wood.push(makeBox(0.12, 2.25, 0.12, cx + side * 20.5 + dx, wingTopY + 1.02, cz + dz));
      }
    }
    tlW3Relief.push(makeReliefBox(2.6, 0.30, 1.85, 'terracottaHipRoof', cx + side * 20.5, wingTopY + 2.24, cz));
    tlW3Bronze.push(makeCyl(0.12, 0.18, 1.85, 6, cx + side * 18.2, deckY + 0.62, cz + 7.2, Math.PI * 0.48));
    tlW3Wood.push(makeBox(0.75, 0.42, 1.05, cx + side * 18.2, deckY + 0.21, cz + 7.2));
    // 611-614, 616-617, 619, 622, 629-630. South lanterns, bougainvillea beds, Long Trì banners, drain slabs, visitor shade pavilions, bronze lamps, stanchions, uplights & Kính Thiên approach bollards
    tlW3Relief.push(
      makeReliefBox(0.48, 1.25, 0.48, 'thanhHoaStone', cx + side * 13.5, wallY + 0.62, cz + 12.8),
      makeReliefBox(0.64, 0.18, 0.64, 'terracottaHipRoof', cx + side * 13.5, wallY + 1.34, cz + 12.8),
      makeReliefBox(3.6, 0.42, 1.35, 'thangLongBrick', cx + side * 17.5, wallY + 0.21, cz + 13.8),
      makeReliefBox(1.45, 0.14, 1.15, 'thanhHoaStone', cx + side * 3.2, wallY + 0.12, -80.5),
      makeReliefBox(0.32, 0.72, 0.32, 'thanhHoaStone', cx + side * 3.6, wallY + 0.36, ktZ + 12.5),
      makeReliefBox(0.32, 0.72, 0.32, 'thanhHoaStone', cx + side * 3.6, wallY + 0.36, ktZ + 14.5)
    );
    for (const fz of [-77.0, -85.0]) {
      tlW3Wood.push(makeCyl(0.04, 0.05, 4.2, 5, cx + side * 14.2, wallY + 2.02, fz));
      tlW3Crimson.push(makeBox(0.05, 1.65, 0.58, cx + side * 14.2, wallY + 3.25, fz + 0.32));
    }
    const pvX = cx + side * 21.5;
    const pvY = ctx.getHeight(pvX, -82.0);
    tlW3Relief.push(makeReliefBox(3.8, 0.36, 3.8, 'imperialFlagstone', pvX, pvY + 0.18, -82.0));
    for (const dx of [-1.45, 1.45]) {
      for (const dz of [-1.45, 1.45]) {
        tlW3Wood.push(makeBox(0.13, 2.65, 0.13, pvX + dx, pvY + 1.42, -82.0 + dz));
      }
    }
    tlW3Relief.push(makeReliefBox(4.5, 0.34, 4.5, 'terracottaHipRoof', pvX, pvY + 2.86, -82.0));
    tlW3Wood.push(makeBox(0.48, 0.44, 2.2, pvX, pvY + 0.58, -82.0));
    for (const lx of [4.5, 11.5]) {
      tlW3Bronze.push(makeCyl(0.05, 0.09, 2.95, 5, cx + side * lx, wallY + 1.48, cz + 14.5));
      tlW3Glow.push(makeBox(0.22, 0.26, 0.22, cx + side * lx, wallY + 3.05, cz + 14.5));
    }
    tlW3Bronze.push(
      makeCyl(0.05, 0.07, 0.72, 5, cx + side * 9.0, wallY + 0.36, cz - 10.5),
      makeCyl(0.05, 0.07, 0.72, 5, cx + side * 7.4, wallY + 0.36, cz - 10.5)
    );
    for (const ux of [1.8, 6.2, 11.0]) {
      tlW3Bronze.push(makeCyl(0.08, 0.10, 0.38, 5, cx + side * ux, wallY + 0.19, cz + 6.2));
      tlW3Glow.push(makeBox(0.10, 0.10, 0.10, cx + side * ux, wallY + 0.42, cz + 6.2));
    }
  }

  // 631-665. Điện Kính Thiên (offset to side of axis!), D67, Hậu Lâu & Chính Bắc Môn details
  tlW3Crimson.push(makeBox(2.1, 0.85, 0.85, cx + 4.8, ktTopY + 0.42, ktZ + 3.6));
  tlW3Relief.push(
    makeReliefBox(2.6, 0.32, 2.2, 'thangLongBrick', cx - 8.5, ktTopY + 0.16, ktZ - 1.5),
    makeReliefBox(1.05, 1.55, 0.24, 'thanhHoaStone', cx - 7.2, ktTopY + 0.78, ktZ + 10.2),
    // 645-646. Hậu Lâu front lotus basin & miniature arched stone bridge
    makeReliefBox(3.4, 0.42, 2.6, 'thanhHoaStone', -20.0, hlY + 0.21, -93.5),
    makeReliefBox(1.25, 0.22, 2.9, 'thanhHoaStone', -20.0, hlY + 0.48, -93.5),
    // 651-653. Giếng Cổ stone water trough, curb posts & interpretive plaque
    makeReliefBox(1.25, 0.46, 0.65, 'thanhHoaStone', -29.5, gcY + 0.23, -84.2),
    makeReliefBox(0.75, 1.15, 0.18, 'thanhHoaStone', -27.2, gcY + 0.58, -86.0),
    // 662-663, 665. Chính Bắc Môn 1882 scar marker, East sentry post & South brick drainage
    makeReliefBox(0.88, 0.92, 0.42, 'thanhHoaStone', 24.8, bmY + 0.46, -107.2),
    makeReliefBox(1.55, 2.15, 1.55, 'vongLauOchre', 31.5, ctx.getHeight(31.5, -105.5) + 1.08, -105.5),
    makeReliefBox(1.95, 0.28, 1.95, 'terracottaHipRoof', 31.5, ctx.getHeight(31.5, -105.5) + 2.28, -105.5),
    makeReliefBox(12.0, 0.10, 0.42, 'thangLongBrick', 21.0, bmY + 0.05, -98.5)
  );
  tlW3Glass.push(makeBox(2.5, 0.08, 2.1, cx - 8.5, ktTopY + 0.36, ktZ - 1.5));
  // 639-643. D67 command table, campaign map easel, secondary bunker snorkel, stair handrail & bulkhead lamps
  tlW3Wood.push(
    makeBox(3.4, 0.78, 1.15, cx, ktTopY + 0.39, ktZ - 8.2),
    makeBox(0.14, 1.65, 1.45, cx + 2.6, ktTopY + 0.82, ktZ - 8.2)
  );
  tlW3Steel.push(
    makeCyl(0.18, 0.18, 1.25, 6, bunkerX - 1.5, bunkerY + 2.15, bunkerZ - 1.2),
    makeBox(0.08, 0.88, 2.4, bunkerX - 0.95, bunkerY + 0.55, bunkerZ + 3.2),
    makeBox(0.08, 0.88, 2.4, bunkerX + 0.95, bunkerY + 0.55, bunkerZ + 3.2)
  );
  tlW3Glow.push(
    makeBox(0.16, 0.18, 0.12, bunkerX - 0.85, bunkerY + 1.45, bunkerZ + 2.18),
    makeBox(0.16, 0.18, 0.12, bunkerX + 0.85, bunkerY + 1.45, bunkerZ + 2.18)
  );
  // 644, 647. Hậu Lâu Imperial Garden Pavilion (-32.5, -101.5 — cleanly West of Hậu Lâu brick garden wall!) & stone chess table
  tlW3Relief.push(makeReliefBox(4.2, 0.36, 4.2, 'imperialFlagstone', -32.5, hlY + 0.18, -101.5));
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.6, 1.6]) {
      tlW3Wood.push(makeCyl(0.11, 0.13, 2.75, 6, -32.5 + dx, hlY + 1.46, -101.5 + dz));
    }
  }
  tlW3Relief.push(
    makeReliefBox(4.9, 0.36, 4.9, 'terracottaHipRoof', -32.5, hlY + 2.94, -101.5),
    makeReliefBox(2.8, 0.38, 2.8, 'terracottaHipRoof', -32.5, hlY + 3.30, -101.5),
    makeReliefBox(0.85, 0.65, 0.85, 'thanhHoaStone', -32.5, hlY + 0.68, -101.5)
  );
  // 654-658. Chính Bắc Môn Vọng Lâu memorial altar, bronze cranes, brackets, West cannon plinth & East matching cannon
  tlW3Crimson.push(makeBox(1.95, 0.88, 0.82, 21.0, bmBaseY + 6.84, -103.5));
  tlW3Bronze.push(
    makeCyl(0.14, 0.11, 0.28, 6, 21.0, bmBaseY + 7.42, -103.5),
    makeCyl(0.16, 0.24, 2.2, 6, 26.5, bmY + 0.68, -108.5, Math.PI * 0.46),
    new THREE.ConeGeometry(0.28, 0.38, 4).rotateY(Math.PI * 0.25).translate(27.8, bmY + 0.28, -108.5)
  );
  tlW3Relief.push(
    makeReliefBox(1.85, 0.28, 2.45, 'thanhHoaStone', 15.5, bmY + 0.14, -108.5),
    makeReliefBox(1.85, 0.28, 2.45, 'thanhHoaStone', 26.5, bmY + 0.14, -108.5)
  );
  for (const side of [-1, 1]) {
    // 631-632, 635-637. Kính Thiên rear curb, side censers, parasols, bronze cranes & 4 corner stone lanterns
    tlW3Relief.push(
      makeReliefBox(0.48, 0.72, 2.2, 'thanhHoaStone', cx + side * 3.8, ktTopY + 0.36, ktZ - 5.2),
      makeReliefBox(0.75, 0.68, 0.75, 'thanhHoaStone', cx + side * 7.8, ktTopY + 0.34, ktZ + 5.2)
    );
    tlW3Crimson.push(makeCyl(0.04, 0.04, 2.55, 5, cx + side * 2.4, ktTopY + 1.28, ktZ + 1.8));
    tlW3Gold.push(new THREE.ConeGeometry(0.52, 0.38, 6).translate(cx + side * 2.4, ktTopY + 2.65, ktZ + 1.8));
    tlW3Bronze.push(makeCyl(0.08, 0.14, 1.25, 5, cx + side * 3.2, ktTopY + 0.62, ktZ + 4.8));
    for (const lz of [-6.5, 6.5]) {
      tlW3Relief.push(
        makeReliefBox(0.44, 1.15, 0.44, 'thanhHoaStone', cx + side * 10.2, ktTopY + 0.58, ktZ + lz),
        makeReliefBox(0.58, 0.18, 0.58, 'terracottaHipRoof', cx + side * 10.2, ktTopY + 1.25, ktZ + lz)
      );
    }
    // 648-650, 652. Hậu Lâu brackets, shutters, bonsai & Giếng Cổ corner posts
    tlW3Wood.push(
      makeBox(0.28, 0.24, 0.48, -20.0 + side * 3.2, hlY + 3.25, -98.2),
      makeBox(0.85, 1.25, 0.10, -20.0 + side * 2.8, hlY + 1.65, -98.4)
    );
    tlW3Relief.push(
      makeReliefBox(0.72, 0.52, 0.72, 'thanhHoaStone', -20.0 + side * 4.2, hlY + 0.26, -97.5),
      makeReliefBox(0.26, 0.72, 0.26, 'thanhHoaStone', -29.5 + side * 1.45, gcY + 0.36, -86.0 + side * 1.45)
    );
    // 655-656, 659-661, 664. Bắc Môn cranes, brackets, moat parapets, lanterns (with roof caps!), flagpoles & benches
    tlW3Bronze.push(makeCyl(0.05, 0.10, 0.85, 5, 21.0 + side * 1.25, bmBaseY + 6.82, -103.5));
    tlW3Wood.push(makeBox(0.28, 0.24, 0.48, 21.0 + side * 2.8, bmBaseY + 8.32, -101.7));
    tlW3Relief.push(
      makeReliefBox(0.32, 0.72, 7.2, 'thanhHoaStone', 21.0 + side * 3.1, bmY + 0.58, -110.5),
      makeReliefBox(0.46, 1.15, 0.46, 'thanhHoaStone', 21.0 + side * 4.8, bmY + 0.58, -114.2),
      makeReliefBox(0.62, 0.18, 0.62, 'terracottaHipRoof', 21.0 + side * 4.8, bmY + 1.24, -114.2),
      makeReliefBox(1.75, 0.42, 0.52, 'thanhHoaStone', 21.0 + side * 6.8, bmY + 0.21, -96.5)
    );
    tlW3Crimson.push(makeCyl(0.04, 0.05, 4.2, 5, 21.0 + side * 11.5, bmY + 2.02, -106.5));
    tlW3Gold.push(makeBox(0.05, 1.35, 0.58, 21.0 + side * 11.5, bmY + 3.35, -106.1));
  }

  // 666-700. Cột Cờ Hà Nội, 18 Hoàng Diệu Archaeological Site & West Visitor Zone details
  tlW3Bronze.push(makeBox(0.85, 0.16, 0.85, hftX, hftY + 0.56, hftZ + 13.8));
  tlW3Wood.push(makeBox(1.25, 0.92, 0.55, hftX + 4.8, hftY + 0.46, hftZ + 13.5));
  tlW3Steel.push(makeBox(4.2, 2.25, 0.12, hftX, hftY + 1.12, hftZ + 15.2));
  tlW3Relief.push(
    makeReliefBox(2.2, 2.35, 1.85, 'vongLauOchre', hftX - 12.2, hftY + 1.18, hftZ + 13.8),
    makeReliefBox(2.6, 0.28, 2.25, 'terracottaHipRoof', hftX - 12.2, hftY + 2.48, hftZ + 13.8)
  );
  for (const side of [-1, 1]) {
    // 667-671, 674. Cột Cờ planters, 4 lanterns, Tier 1 cannons, Tier 2 flags & perimeter benches
    for (const px of [4.2, 9.2]) {
      tlW3Relief.push(makeReliefBox(0.85, 0.62, 0.85, 'thanhHoaStone', hftX + side * px, hftY + 0.31, hftZ + 13.2));
    }
    for (const lz of [-13.2, 13.2]) {
      tlW3Relief.push(
        makeReliefBox(0.46, 1.25, 0.46, 'thanhHoaStone', hftX + side * 13.2, hftY + 0.62, hftZ + lz),
        makeReliefBox(0.62, 0.18, 0.62, 'terracottaHipRoof', hftX + side * 13.2, hftY + 1.34, hftZ + lz)
      );
    }
    tlW3Bronze.push(makeCyl(0.12, 0.18, 1.85, 6, hftX + side * 8.2, hftY + 3.92, hftZ + 8.5, Math.PI * 0.48));
    tlW3Wood.push(makeBox(0.72, 0.38, 1.05, hftX + side * 8.2, hftY + 3.58, hftZ + 8.5));
    tlW3Crimson.push(makeCyl(0.03, 0.04, 2.4, 5, hftX + side * 5.8, hftY + 8.32, hftZ + 5.8));
    tlW3Gold.push(makeBox(0.04, 0.72, 1.05, hftX + side * 5.8, hftY + 9.05, hftZ + 6.3));
    for (const bz of [-4.0, 4.0]) {
      tlW3Relief.push(makeReliefBox(0.52, 0.42, 1.75, 'thanhHoaStone', hftX + side * 14.5, hftY + 0.21, hftZ + bz));
    }
  }
  // 675-689. 18 Hoàng Diệu roof steel trusses, Pit B, Lê well, brick cistern, access ladder, sorting table, tile rack, 2 vitrines, 6 spotlights, South boardwalk, 3 stratigraphy signs & North rest shelter
  for (const tx of [-6.0, 0.0, 6.0]) {
    tlW3Steel.push(
      makeBox(0.14, 0.18, 14.2, archX + tx, archY + sheltH + 0.45, archZ),
      makeBox(0.14, 0.42, 0.14, archX + tx, archY + sheltH + 0.24, archZ - 6.8),
      makeBox(0.14, 0.42, 0.14, archX + tx, archY + sheltH + 0.24, archZ + 6.8)
    );
    for (const sz of [-3.2, 3.2]) {
      tlW3Steel.push(makeCyl(0.10, 0.14, 0.38, 5, archX + tx, archY + sheltH + 0.22, archZ + sz));
      tlW3Glow.push(makeBox(0.12, 0.08, 0.12, archX + tx, archY + sheltH + 0.02, archZ + sz));
    }
  }
  tlW3Relief.push(
    makeReliefBox(4.4, 0.28, 3.4, 'thangLongBrick', archX + 3.6, archY + 0.32, archZ + 2.8),
    remapRelief(makeCyl(0.82, 0.92, 0.62, 6, archX + 4.2, archY + 0.56, archZ + 3.0), 'thangLongBrick'),
    makeReliefBox(3.4, 0.42, 2.4, 'thangLongBrick', archX - 4.2, archY + 0.38, archZ - 2.6),
    makeReliefBox(1.15, 1.55, 0.24, 'thanhHoaStone', archX, ctx.getHeight(archX, -71.5) + 0.78, -71.5)
  );
  tlW3Wood.push(
    makeBox(0.55, 1.85, 0.10, archX - 5.6, archY + 0.72, archZ + 2.4, 0, 0.35),
    makeBox(1.85, 0.82, 0.85, archX + 6.5, archY + 0.68, archZ - 3.8),
    makeBox(0.75, 1.45, 2.2, archX + 7.2, archY + 0.98, archZ - 1.5),
    makeBox(1.35, 0.85, 0.85, archX - 1.5, archY + 0.68, archZ - 4.8),
    makeBox(1.35, 0.85, 0.85, archX + 1.5, archY + 0.68, archZ - 4.8),
    makeBox(16.0, 0.16, 1.65, archX, archY + 0.54, archZ + 5.2)
  );
  tlW3Glass.push(
    makeBox(1.28, 0.68, 0.78, archX - 1.5, archY + 1.42, archZ - 4.8),
    makeBox(1.28, 0.68, 0.78, archX + 1.5, archY + 1.42, archZ - 4.8)
  );
  for (const sx of [-4.5, 0, 4.5]) {
    tlW3Steel.push(makeCyl(0.04, 0.05, 0.95, 5, archX + sx, archY + 1.02, archZ + 4.45));
    tlW3Bronze.push(makeBox(0.85, 0.65, 0.14, archX + sx, archY + 1.05, archZ + 5.95, 0, 0.35));
  }
  const hdShY = ctx.getHeight(archX, -90.5);
  tlW3Relief.push(makeReliefBox(4.2, 0.32, 3.6, 'imperialFlagstone', archX, hdShY + 0.16, -90.5));
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.3, 1.3]) {
      tlW3Wood.push(makeBox(0.12, 2.55, 0.12, archX + dx, hdShY + 1.32, -90.5 + dz));
    }
  }
  tlW3Relief.push(
    makeReliefBox(4.8, 0.34, 4.2, 'terracottaHipRoof', archX, hdShY + 2.72, -90.5),
    makeReliefBox(0.95, 0.65, 0.95, 'thanhHoaStone', archX, hdShY + 0.64, -90.5)
  );
  // 690-700. West Artifact Pavilion upgrades, SW café, Ticket Kiosk awning, iron fence, flowerbeds, colonial lamps & 4-way signpost
  tlW3Wood.push(
    makeBox(1.25, 0.88, 0.95, -34.0, pavArtY + 0.80, -62.2),
    makeBox(0.28, 0.24, 0.48, -37.2, pavArtY + 3.45, -61.8),
    makeBox(0.28, 0.24, 0.48, -30.8, pavArtY + 3.45, -61.8),
    makeBox(1.25, 0.72, 0.85, -31.2, svY + 0.36, -51.0),
    makeBox(0.36, 0.38, 0.36, -32.2, svY + 0.19, -51.0),
    makeBox(0.36, 0.38, 0.36, -30.2, svY + 0.19, -51.0)
  );
  tlW3Glass.push(makeBox(1.18, 0.72, 0.88, -34.0, pavArtY + 1.56, -62.2));
  tlW3Relief.push(
    makeReliefBox(3.4, 0.24, 1.25, 'thanhHoaStone', -34.0, pavArtY + 0.12, -60.8),
    makeReliefBox(0.42, 1.05, 0.42, 'thanhHoaStone', -37.2, pavArtY + 0.52, -60.5),
    makeReliefBox(0.56, 0.16, 0.56, 'terracottaHipRoof', -37.2, pavArtY + 1.12, -60.5),
    makeReliefBox(0.42, 1.05, 0.42, 'thanhHoaStone', -30.8, pavArtY + 0.52, -60.5),
    makeReliefBox(0.56, 0.16, 0.56, 'terracottaHipRoof', -30.8, pavArtY + 1.12, -60.5),
    makeReliefBox(3.8, 0.28, 1.35, 'terracottaHipRoof', -26.0, tkW2Y + 2.45, -54.2),
    makeReliefBox(5.6, 0.95, 0.32, 'vongLauOchre', -24.0, tkW2Y + 0.48, -52.5),
    makeReliefBox(2.4, 0.38, 1.25, 'thangLongBrick', -20.5, tkW2Y + 0.19, -54.5),
    makeReliefBox(2.4, 0.38, 1.25, 'thangLongBrick', -20.5, tkW2Y + 0.19, -58.5)
  );
  tlW3Steel.push(makeBox(5.4, 0.85, 0.08, -24.0, tkW2Y + 1.32, -52.5));
  for (const lz of [-60.0, -68.0, -76.0]) {
    const ly = ctx.getHeight(-28.5, lz);
    tlW3Bronze.push(makeCyl(0.05, 0.09, 3.0, 5, -28.5, ly + 1.5, lz));
    tlW3Glow.push(makeBox(0.22, 0.24, 0.22, -28.5, ly + 3.12, lz));
  }
  const sp4Y = ctx.getHeight(-18.5, -75.0);
  tlW3Bronze.push(
    makeCyl(0.06, 0.09, 2.35, 6, -18.5, sp4Y + 1.18, -75.0),
    makeBox(0.95, 0.22, 0.08, -18.0, sp4Y + 2.08, -75.0),
    makeBox(0.08, 0.22, 0.95, -18.5, sp4Y + 1.82, -74.5)
  );

  addMerged(tlW3Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave3AtlasMesh', false, true);
  addMerged(tlW3Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave3Wood', false, true);
  addMerged(tlW3Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave3Bronze', false, true);
  addMerged(tlW3Gold, ctx.materials.gold, 'HoangThanhWave3Gold', false, false);
  addMerged(tlW3Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave3Crimson', false, true);
  addMerged(tlW3Steel, stainlessMat, 'HoangThanhWave3Steel', false, false);
  addMerged(tlW3Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave3Glass', false, false);
  addMerged(tlW3Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave3Glow', false, false);

  // =================================================================================================
  // SECTION 7D: HOÀNG THÀNH THĂNG LONG WAVE 4 OUTER EXPANSIONS (Items 1001..1100)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // =================================================================================================
  const tlW4Relief: THREE.BufferGeometry[] = [];
  const tlW4Wood: THREE.BufferGeometry[] = [];
  const tlW4Bronze: THREE.BufferGeometry[] = [];
  const tlW4Gold: THREE.BufferGeometry[] = [];
  const tlW4Crimson: THREE.BufferGeometry[] = [];
  const tlW4Steel: THREE.BufferGeometry[] = [];
  const tlW4Glass: THREE.BufferGeometry[] = [];
  const tlW4Glow: THREE.BufferGeometry[] = [];

  // 1001-1035. Outer Đoan Môn Imperial Forecourt & Hoàng Diệu Avenue (z = -45..-54)
  const sfY = ctx.getHeight(0, -49.5);
  tlW4Relief.push(
    // 1011, 1022, 1033. UNESCO emblem plinth, South censer & 3-step approach apron
    makeReliefBox(1.85, 0.85, 1.85, 'thanhHoaStone', 0, sfY + 0.42, -49.5),
    makeReliefBox(1.15, 0.72, 0.82, 'thanhHoaStone', 0, sfY + 0.36, -52.5),
    makeReliefBox(7.2, 0.24, 1.65, 'imperialFlagstone', 0, ctx.getHeight(0, -45.5) + 0.12, -45.5),
    // 1018-1019, 1021, 1027, 1030. Map lectern, info booth, dragon relief plinth, West rest table & Đoan Môn stele
    makeReliefBox(1.25, 0.88, 0.65, 'thanhHoaStone', -5.8, sfY + 0.44, -48.5),
    makeReliefBox(2.2, 2.25, 1.85, 'vongLauOchre', 5.8, sfY + 1.12, -48.5),
    makeReliefBox(2.6, 0.28, 2.25, 'terracottaHipRoof', 5.8, sfY + 2.38, -48.5),
    makeReliefBox(1.45, 0.75, 0.85, 'thanhHoaStone', -11.5, ctx.getHeight(-11.5, -52.5) + 0.38, -52.5),
    makeReliefBox(0.95, 0.65, 0.95, 'thanhHoaStone', -18.5, ctx.getHeight(-18.5, -49.5) + 0.32, -49.5),
    makeReliefBox(0.95, 1.48, 0.24, 'thanhHoaStone', -9.5, ctx.getHeight(-9.5, -54.0) + 0.74, -54.0)
  );
  tlW4Gold.push(makeCyl(0.45, 0.45, 0.14, 8, 0, sfY + 0.96, -49.5));
  tlW4Glass.push(makeBox(1.15, 0.08, 0.58, -5.8, sfY + 0.92, -48.5, 0, 0.32));
  // 1004-1005, 1028, 1032. Imperial Palanquin Shelter (18.5, -52.0) & royal palanquin
  const palY = ctx.getHeight(18.5, -52.0);
  tlW4Relief.push(makeReliefBox(4.4, 0.34, 4.4, 'imperialFlagstone', 18.5, palY + 0.17, -52.0));
  for (const dx of [-1.7, 1.7]) {
    for (const dz of [-1.7, 1.7]) {
      tlW4Wood.push(makeCyl(0.11, 0.13, 2.75, 6, 18.5 + dx, palY + 1.46, -52.0 + dz));
    }
  }
  tlW4Relief.push(makeReliefBox(5.0, 0.34, 5.0, 'terracottaHipRoof', 18.5, palY + 2.94, -52.0));
  tlW4Crimson.push(makeBox(1.35, 1.15, 1.65, 18.5, palY + 0.98, -52.0));
  tlW4Gold.push(makeBox(1.55, 0.26, 1.85, 18.5, palY + 1.68, -52.0));
  tlW4Wood.push(makeBox(0.12, 1.45, 2.2, 18.5, palY + 0.72, -48.0));
  tlW4Bronze.push(makeCyl(0.18, 0.14, 0.36, 6, 18.5, palY + 0.52, -49.6));
  // 1009-1010, 1034. Welcome drum (-8.2, -50.5), bronze gong (8.2, -50.5) & 4-way signpost
  tlW4Wood.push(
    makeBox(0.95, 0.68, 0.68, -8.2, sfY + 0.34, -50.5),
    makeBox(0.12, 1.95, 0.12, 7.5, sfY + 0.92, -50.5),
    makeBox(0.12, 1.95, 0.12, 8.9, sfY + 0.92, -50.5),
    makeBox(1.65, 0.14, 0.14, 8.2, sfY + 1.92, -50.5)
  );
  tlW4Crimson.push(makeCyl(0.46, 0.46, 0.78, 6, -8.2, sfY + 1.05, -50.5, 0, Math.PI * 0.5));
  tlW4Bronze.push(
    makeCyl(0.36, 0.36, 0.08, 6, 8.2, sfY + 1.32, -50.5, Math.PI * 0.5),
    makeCyl(0.06, 0.09, 2.35, 6, 10.5, sfY + 1.18, -52.5)
  );
  for (const side of [-1, 1]) {
    // 1001-1002, 1015, 1031, 1035. Outer West/East Guardhouses (±14.5, -49.5)
    const ghY = ctx.getHeight(side * 14.5, -49.5);
    tlW4Relief.push(
      makeReliefBox(3.2, 2.65, 2.8, 'vongLauOchre', side * 14.5, ghY + 1.32, -49.5),
      makeReliefBox(3.8, 0.34, 3.4, 'terracottaHipRoof', side * 14.5, ghY + 2.78, -49.5),
      makeReliefBox(0.42, 1.05, 0.42, 'thanhHoaStone', side * 12.2, ghY + 0.52, -49.5),
      makeReliefBox(0.56, 0.16, 0.56, 'terracottaHipRoof', side * 12.2, ghY + 1.12, -49.5),
      makeReliefBox(0.42, 0.48, 0.42, 'thangLongBrick', side * 16.4, ghY + 0.24, -49.5)
    );
    tlW4Glow.push(makeBox(0.16, 0.22, 0.16, side * 14.5, ghY + 2.48, -47.9));
    // 1006-1008, 1024. Outer Bronze Cannon Batteries (±22.5, -54.0)
    const cbY = ctx.getHeight(side * 22.5, -54.0);
    tlW4Relief.push(makeReliefBox(4.2, 0.36, 4.2, 'thanhHoaStone', side * 22.5, cbY + 0.18, -54.0));
    tlW4Bronze.push(
      makeCyl(0.14, 0.20, 2.1, 6, side * 22.5, cbY + 0.78, -54.0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.26, 0.36, 4).rotateY(Math.PI * 0.25).translate(side * 21.2, cbY + 0.52, -54.0)
    );
    tlW4Wood.push(makeBox(0.85, 0.46, 1.25, side * 22.5, cbY + 0.48, -54.0));
    tlW4Steel.push(makeBox(4.2, 0.78, 0.08, side * 22.5, cbY + 0.72, -51.9));
    // 1003, 1012-1014, 1016-1017, 1020, 1023, 1025-1026, 1029. Avenue bollards, benches, lamps, flowerbeds, flags, parapet & runnels
    for (const az of [-47.0, -50.0, -53.0]) {
      const ay = ctx.getHeight(side * 10.5, az);
      tlW4Relief.push(
        makeReliefBox(0.28, 0.72, 0.28, 'thanhHoaStone', side * 4.8, ay + 0.36, az),
        makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', side * 10.5, ay + 0.21, az)
      );
      tlW4Bronze.push(makeCyl(0.05, 0.09, 2.95, 5, side * 12.5, ay + 1.48, az));
      tlW4Glow.push(makeBox(0.22, 0.24, 0.22, side * 12.5, ay + 3.05, az));
    }
    tlW4Relief.push(
      makeReliefBox(2.4, 0.38, 1.25, 'thangLongBrick', side * 8.5, sfY + 0.19, -48.5),
      makeReliefBox(2.4, 0.38, 1.25, 'thangLongBrick', side * 8.5, sfY + 0.19, -52.5),
      makeReliefBox(5.2, 1.05, 0.42, 'thangLongBrick', side * 19.5, sfY + 0.52, -48.5),
      makeReliefBox(0.72, 0.56, 0.72, 'thanhHoaStone', side * 6.5, sfY + 0.28, -51.5),
      makeReliefBox(0.28, 0.08, 8.0, 'thanhHoaStone', side * 3.8, sfY + 0.04, -49.5),
      makeReliefBox(0.32, 0.72, 0.32, 'thanhHoaStone', side * 6.5, sfY + 0.36, -45.5)
    );
    tlW4Wood.push(
      makeCyl(0.04, 0.05, 4.0, 5, side * 16.5, sfY + 1.95, -47.5),
      makeCyl(0.05, 0.06, 2.45, 5, side * 3.4, sfY + 1.22, -48.5)
    );
    tlW4Crimson.push(makeBox(0.05, 1.35, 0.55, side * 16.5, sfY + 3.25, -47.15));
    tlW4Bronze.push(makeCyl(0.08, 0.10, 0.38, 5, side * 1.4, sfY + 0.19, -48.5));
    tlW4Glow.push(makeBox(0.16, 0.20, 0.16, side * 3.4, sfY + 2.42, -48.5));
  }

  // 1036-1068. Điện Kính Thiên, D67, Hậu Lâu & Chính Bắc Môn Extended Imperial Gardens
  // 1036-1038, 1046-1047, 1054, 1061. Đình Lan Orchid Pavilion (-35.5, -96.5), pergola & Lý-Trần Ceramic Kiln (-35.5, -106.5)
  const dlY = ctx.getHeight(-35.5, -96.5);
  tlW4Relief.push(makeReliefBox(4.0, 0.36, 4.0, 'imperialFlagstone', -35.5, dlY + 0.18, -96.5));
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-1.5, 1.5]) {
      tlW4Wood.push(makeCyl(0.10, 0.12, 2.70, 6, -35.5 + dx, dlY + 1.44, -96.5 + dz));
    }
  }
  tlW4Relief.push(
    makeReliefBox(4.6, 0.34, 4.6, 'terracottaHipRoof', -35.5, dlY + 2.90, -96.5),
    makeReliefBox(2.6, 0.36, 2.6, 'terracottaHipRoof', -35.5, dlY + 3.24, -96.5),
    makeReliefBox(0.85, 0.65, 0.85, 'thanhHoaStone', -35.5, dlY + 0.68, -96.5),
    makeReliefBox(1.65, 0.16, 1.25, 'thanhHoaStone', -35.5, ctx.getHeight(-35.5, -101.5) + 0.08, -101.5),
    // 1046-1047. Ceramic kiln dome (-35.5, -106.5)
    remapRelief(makeCyl(1.15, 1.45, 1.65, 8, -35.5, ctx.getHeight(-35.5, -106.5) + 0.82, -106.5), 'thangLongBrick'),
    remapRelief(makeCyl(0.28, 0.36, 0.95, 6, -35.5, ctx.getHeight(-35.5, -106.5) + 2.05, -106.5), 'thangLongBrick')
  );
  tlW4Wood.push(
    makeBox(3.4, 0.14, 1.85, -35.5, dlY + 2.35, -92.5),
    makeBox(0.12, 2.35, 0.12, -37.0, dlY + 1.12, -92.5),
    makeBox(0.12, 2.35, 0.12, -34.0, dlY + 1.12, -92.5),
    makeBox(1.45, 1.15, 0.55, -33.2, ctx.getHeight(-33.2, -106.5) + 0.58, -106.5)
  );
  tlW4Glow.push(makeBox(0.20, 0.24, 0.20, -35.5, dlY + 2.55, -96.5));
  // 1039, 1041, 1051-1053, 1062, 1065. East Moat Watchtower (33.5, -110.5) & Bắc Môn North upgrades
  const wtY = ctx.getHeight(33.5, -110.5);
  tlW4Relief.push(
    makeReliefBox(3.6, 3.2, 3.6, 'thangLongBrick', 33.5, wtY + 1.60, -110.5),
    makeReliefBox(4.2, 0.34, 4.2, 'terracottaHipRoof', 33.5, wtY + 3.36, -110.5),
    makeReliefBox(2.4, 1.45, 2.4, 'vongLauOchre', 33.5, wtY + 4.24, -110.5),
    makeReliefBox(3.0, 0.34, 3.0, 'terracottaHipRoof', 33.5, wtY + 5.12, -110.5),
    makeReliefBox(0.95, 1.55, 0.24, 'thanhHoaStone', 21.0, bmY + 0.78, -115.5),
    makeReliefBox(0.44, 0.52, 0.44, 'thangLongBrick', 31.2, wtY + 0.26, -110.5)
  );
  tlW4Wood.push(makeBox(5.6, 0.24, 0.32, 21.0, bmBaseY + 8.38, -101.6));
  tlW4Bronze.push(
    makeCyl(0.18, 0.14, 0.36, 6, 21.0, bmY + 0.58, -114.2),
    makeCyl(0.14, 0.11, 0.26, 6, 21.0, bmBaseY + 7.42, -103.0)
  );
  // 1042-1045, 1048-1050, 1055-1060, 1063-1064, 1066-1068. Hầm D67 field comm/netting, Hậu Lâu rear lotus basin/wall & Bắc Môn moat props
  tlW4Steel.push(
    makeBox(0.95, 1.35, 0.55, -8.8, bunkerY + 0.68, -109.5),
    makeBox(3.6, 0.10, 2.8, -12.5, bunkerY + 2.25, -106.2),
    makeBox(0.08, 2.25, 0.08, -14.2, bunkerY + 1.12, -106.2),
    makeBox(0.08, 2.25, 0.08, -10.8, bunkerY + 1.12, -106.2),
    makeBox(1.25, 1.35, 0.12, -8.2, bunkerY + 0.92, -105.5)
  );
  tlW4Relief.push(
    makeReliefBox(5.2, 0.42, 3.2, 'thanhHoaStone', -20.0, hlY + 0.21, -112.5),
    makeReliefBox(1.45, 0.22, 3.6, 'thanhHoaStone', -20.0, hlY + 0.48, -112.5),
    makeReliefBox(18.0, 1.85, 0.42, 'thangLongBrick', -20.0, hlY + 0.92, -116.5),
    makeReliefBox(2.2, 0.36, 1.15, 'thangLongBrick', -32.5, hlY + 0.18, -97.5),
    makeReliefBox(2.2, 0.36, 1.15, 'thangLongBrick', -32.5, hlY + 0.18, -105.5),
    makeReliefBox(0.95, 0.65, 0.95, 'thanhHoaStone', 29.5, bmY + 0.32, -98.5),
    makeReliefBox(1.15, 0.68, 0.85, 'thanhHoaStone', -26.5, hlY + 0.34, -95.5),
    makeReliefBox(18.0, 0.08, 0.36, 'thangLongBrick', 0, ktTopY + 0.04, -106.5)
  );
  tlW4Bronze.push(makeCyl(0.06, 0.08, 2.25, 6, 0, ktTopY + 1.12, -105.5));
  for (const side of [-1, 1]) {
    for (const mz of [-108.0, -113.0]) {
      tlW4Relief.push(
        makeReliefBox(0.42, 1.05, 0.42, 'thanhHoaStone', 21.0 + side * 3.4, bmY + 0.52, mz),
        makeReliefBox(0.56, 0.16, 0.56, 'terracottaHipRoof', 21.0 + side * 3.4, bmY + 1.12, mz)
      );
    }
    tlW4Relief.push(
      makeReliefBox(0.42, 1.05, 0.42, 'thanhHoaStone', -20.0 + side * 6.5, hlY + 0.52, -112.5),
      makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', -20.0 + side * 5.2, hlY + 0.21, -112.5),
      makeReliefBox(0.68, 0.48, 0.68, 'thanhHoaStone', -20.0 + side * 3.2, hlY + 0.24, -108.2),
      makeReliefBox(1.65, 0.42, 0.52, 'thanhHoaStone', 21.0 + side * 6.5, bmY + 0.21, -113.5)
    );
    tlW4Steel.push(makeCyl(0.05, 0.08, 2.85, 5, -12.5 + side * 3.2, bunkerY + 1.42, -104.5));
    tlW4Crimson.push(makeCyl(0.04, 0.05, 4.0, 5, 21.0 + side * 6.5, bmY + 1.95, -115.5));
    tlW4Gold.push(makeBox(0.05, 1.25, 0.55, 21.0 + side * 6.5, bmY + 3.25, -115.15));
    tlW4Bronze.push(makeCyl(0.08, 0.10, 0.38, 5, 21.0 + side * 4.2, bmY + 0.19, -100.2));
    tlW4Glow.push(makeBox(0.10, 0.10, 0.10, 21.0 + side * 4.2, bmY + 0.42, -100.2));
  }
  for (let bi = 0; bi < 6; bi++) {
    tlW4Relief.push(makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', 14.5 + bi * 2.6, bmY + 0.34, -114.8));
  }

  // 1069-1100. 18 Hoàng Diệu Archaeological Field Lab (-50.5, -72.0), Pit C (-50.5, -64.5) & Cột Cờ East Cannon Park (53.5, -76.0)
  const flY = ctx.getHeight(-50.5, -72.0);
  tlW4Relief.push(
    makeReliefBox(6.4, 0.32, 5.2, 'imperialFlagstone', -50.5, flY + 0.16, -72.0),
    // 1072, 1074, 1085. Stratigraphic plinths, Pit C & stone artifact plinth
    makeReliefBox(3.6, 0.85, 1.25, 'thangLongBrick', -48.5, ctx.getHeight(-48.5, -66.5) + 0.42, -66.5),
    makeReliefBox(5.2, 0.32, 4.2, 'thangLongBrick', -50.5, ctx.getHeight(-50.5, -64.5) + 0.16, -64.5),
    makeReliefBox(1.85, 0.65, 1.25, 'thanhHoaStone', -46.5, ctx.getHeight(-46.5, -88.5) + 0.32, -88.5)
  );
  for (const dx of [-2.6, 0, 2.6]) {
    for (const dz of [-2.1, 2.1]) {
      tlW4Wood.push(makeBox(0.14, 2.85, 0.14, -50.5 + dx, flY + 1.48, -72.0 + dz));
    }
  }
  tlW4Glass.push(
    makeBox(6.8, 0.12, 5.6, -50.5, flY + 2.95, -72.0),
    makeBox(1.25, 0.62, 0.78, -46.5, ctx.getHeight(-46.5, -69.0) + 1.15, -69.0)
  );
  tlW4Wood.push(
    // 1070-1071, 1073, 1086-1087, 1093-1094, 1099. Washing tables, sherd racks, drafting easel, boardwalk, showcase, tent, crates & signpost
    makeBox(2.4, 0.82, 0.85, -50.5, flY + 0.58, -73.0),
    makeBox(2.4, 0.82, 0.85, -50.5, flY + 0.58, -71.0),
    makeBox(0.65, 1.55, 3.6, -53.2, flY + 0.92, -72.0),
    makeBox(0.14, 1.55, 1.15, -46.5, flY + 0.78, -72.0),
    makeBox(1.45, 0.16, 4.4, -47.0, ctx.getHeight(-47.0, -64.5) + 0.32, -64.5),
    makeBox(1.35, 0.78, 0.85, -46.5, ctx.getHeight(-46.5, -69.0) + 0.39, -69.0),
    makeBox(3.4, 0.18, 2.6, -50.5, ctx.getHeight(-50.5, -60.5) + 2.25, -60.5),
    makeBox(0.10, 2.25, 0.10, -52.0, ctx.getHeight(-50.5, -60.5) + 1.08, -60.5),
    makeBox(0.10, 2.25, 0.10, -49.0, ctx.getHeight(-50.5, -60.5) + 1.08, -60.5),
    makeBox(0.95, 0.65, 0.95, -48.5, flY + 0.48, -73.5),
    makeBox(0.12, 2.15, 0.12, -43.5, ctx.getHeight(-43.5, -62.5) + 1.08, -62.5)
  );
  tlW4Steel.push(
    makeBox(5.4, 0.82, 0.08, -50.5, ctx.getHeight(-50.5, -64.5) + 0.41, -62.3),
    makeBox(5.4, 0.82, 0.08, -50.5, ctx.getHeight(-50.5, -64.5) + 0.41, -66.7),
    makeCyl(0.05, 0.07, 2.15, 5, -53.2, ctx.getHeight(-53.2, -64.5) + 1.08, -64.5)
  );
  tlW4Glow.push(makeBox(0.18, 0.14, 0.18, -53.2, ctx.getHeight(-53.2, -64.5) + 2.20, -64.5));
  for (const lz of [-64.0, -70.0, -76.0, -82.0]) {
    tlW4Relief.push(
      makeReliefBox(0.42, 1.02, 0.42, 'thanhHoaStone', -42.5, ctx.getHeight(-42.5, lz) + 0.51, lz),
      makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', -54.5, ctx.getHeight(-54.5, lz) + 0.34, lz)
    );
  }
  for (const bz of [-68.0, -76.0, -84.0]) {
    tlW4Relief.push(makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', -44.5, ctx.getHeight(-44.5, bz) + 0.21, bz));
  }
  for (const nlz of [-86.0, -91.0]) {
    tlW4Bronze.push(makeCyl(0.05, 0.09, 2.95, 5, -46.5, ctx.getHeight(-46.5, nlz) + 1.48, nlz));
    tlW4Glow.push(makeBox(0.20, 0.24, 0.20, -46.5, ctx.getHeight(-46.5, nlz) + 3.05, nlz));
  }
  // 1077-1084, 1090-1092, 1096-1098. Cột Cờ East Military Cannon Park (53.5, -76.0)
  const cpY = ctx.getHeight(53.5, -76.0);
  tlW4Relief.push(
    makeReliefBox(6.8, 0.32, 18.0, 'imperialFlagstone', 53.5, cpY + 0.16, -76.0),
    makeReliefBox(0.32, 0.78, 17.5, 'thanhHoaStone', 56.5, cpY + 0.55, -76.0),
    makeReliefBox(0.28, 0.08, 17.5, 'thanhHoaStone', 50.5, cpY + 0.04, -76.0),
    // 1080, 1091, 1098. 1812 Obelisk (53.5, -65.5), 1954 stele & planters
    makeReliefBox(1.35, 0.52, 1.35, 'thanhHoaStone', 53.5, cpY + 0.26, -65.5),
    remapRelief(makeCyl(0.26, 0.52, 3.2, 4, 53.5, cpY + 2.12, -65.5), 'thanhHoaStone'),
    makeReliefBox(0.95, 1.55, 0.24, 'thanhHoaStone', 51.5, cpY + 0.78, -67.5),
    makeReliefBox(0.68, 0.48, 0.68, 'thanhHoaStone', 51.3, cpY + 0.24, -65.5),
    makeReliefBox(0.68, 0.48, 0.68, 'thanhHoaStone', 55.7, cpY + 0.24, -65.5)
  );
  // 1081, 1096. NE Cột Cờ rest gazebo (53.5, -86.5)
  const gzY = ctx.getHeight(53.5, -86.5);
  tlW4Relief.push(makeReliefBox(4.0, 0.36, 4.0, 'imperialFlagstone', 53.5, gzY + 0.18, -86.5));
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-1.5, 1.5]) {
      tlW4Wood.push(makeCyl(0.10, 0.12, 2.70, 6, 53.5 + dx, gzY + 1.44, -86.5 + dz));
    }
  }
  tlW4Relief.push(makeReliefBox(4.6, 0.34, 4.6, 'terracottaHipRoof', 53.5, gzY + 2.90, -86.5));
  tlW4Glow.push(makeBox(0.20, 0.24, 0.20, 53.5, gzY + 2.55, -86.5));
  for (let ci = 0; ci < 4; ci++) {
    const czPos = -82.0 + ci * 4.0;
    tlW4Bronze.push(
      makeCyl(0.14, 0.20, 2.1, 6, 53.5, cpY + 0.78, czPos, 0, Math.PI * 0.48),
      makeCyl(0.05, 0.09, 2.95, 5, 55.5, cpY + 1.48, czPos)
    );
    tlW4Wood.push(makeBox(1.25, 0.46, 0.85, 53.5, cpY + 0.48, czPos));
    tlW4Relief.push(makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', 51.5, cpY + 0.21, czPos));
    tlW4Glow.push(makeBox(0.20, 0.24, 0.20, 55.5, cpY + 3.05, czPos));
    tlW4Crimson.push(makeCyl(0.04, 0.05, 3.8, 5, 56.2, cpY + 1.90, czPos));
    tlW4Gold.push(makeBox(0.05, 1.15, 0.52, 56.2, cpY + 3.15, czPos + 0.32));
    if (ci < 2) {
      tlW4Bronze.push(new THREE.ConeGeometry(0.24, 0.34, 4).rotateY(Math.PI * 0.25).translate(53.5, cpY + 0.48, czPos + 1.6));
    }
  }
  for (const fz of [-66.5, -75.5, -84.0]) {
    tlW4Relief.push(makeReliefBox(1.85, 0.38, 1.25, 'thangLongBrick', 51.5, cpY + 0.19, fz));
  }

  addMerged(tlW4Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave4AtlasMesh', false, true);
  addMerged(tlW4Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave4Wood', false, true);
  addMerged(tlW4Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave4Bronze', false, true);
  addMerged(tlW4Gold, ctx.materials.gold, 'HoangThanhWave4Gold', false, false);
  addMerged(tlW4Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave4Crimson', false, true);
  addMerged(tlW4Steel, stainlessMat, 'HoangThanhWave4Steel', false, false);
  addMerged(tlW4Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave4Glass', false, false);
  addMerged(tlW4Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave4Glow', false, false);

  // =========================================================================
  // SECTION 7E: HOÀNG THÀNH THĂNG LONG WAVE 5 EXPANSIONS (Items 1401..1500)
  // Low-poly batched meshes (castShadow = false, 0 new materials, columns embedded -0.15m)
  // =========================================================================
  const tlW5Relief: THREE.BufferGeometry[] = [];
  const tlW5Wood: THREE.BufferGeometry[] = [];
  const tlW5Bronze: THREE.BufferGeometry[] = [];
  const tlW5Gold: THREE.BufferGeometry[] = [];
  const tlW5Crimson: THREE.BufferGeometry[] = [];
  const tlW5Steel: THREE.BufferGeometry[] = [];
  const tlW5Glass: THREE.BufferGeometry[] = [];
  const tlW5Glow: THREE.BufferGeometry[] = [];

  // 1401-1430. Outer South Ceremonial Gateway (0, -40.5), Imperial Pillars, Basins, Brick Parapet & Entrance Kiosks
  const sgW5Y = ctx.getHeight(0, -40.5);
  tlW5Relief.push(
    makeReliefBox(1.15, 3.65, 1.15, 'thangLongBrick', -2.6, sgW5Y + 1.82, -40.5),
    makeReliefBox(1.15, 3.65, 1.15, 'thangLongBrick', 2.6, sgW5Y + 1.82, -40.5),
    makeReliefBox(7.2, 0.58, 1.85, 'terracottaHipRoof', 0, sgW5Y + 3.88, -40.5),
    makeReliefBox(4.4, 0.42, 1.35, 'terracottaHipRoof', 0, sgW5Y + 4.35, -40.5),
    makeReliefBox(0.95, 1.48, 0.24, 'thanhHoaStone', -7.5, ctx.getHeight(-7.5, -39.5) + 0.74, -39.5)
  );
  tlW5Wood.push(
    makeBox(1.15, 0.92, 0.58, 7.5, ctx.getHeight(7.5, -39.5) + 0.46, -39.5),
    makeBox(0.55, 0.95, 0.95, 20.5, ctx.getHeight(20.5, -40.5) + 0.48, -40.5)
  );
  for (const side of [-1, 1]) {
    // 1402-1409, 1413-1429. Pillars, cauldrons, basins, parapet, display tables, lanterns, benches, kiosks, stelae & urns
    for (const px of [6.5, 12.5]) {
      const py = ctx.getHeight(side * px, -42.5);
      tlW5Relief.push(
        makeReliefBox(0.68, 3.15, 0.68, 'thanhHoaStone', side * px, py + 1.58, -42.5),
        makeReliefBox(0.88, 0.36, 0.88, 'thanhHoaStone', side * px, py + 3.30, -42.5)
      );
    }
    tlW5Bronze.push(
      makeCyl(0.28, 0.22, 0.56, 6, side * 3.8, sgW5Y + 0.28, -42.5),
      makeCyl(0.08, 0.10, 0.36, 5, side * 2.2, sgW5Y + 0.18, -38.8),
      makeCyl(0.05, 0.08, 2.95, 5, side * 13.5, ctx.getHeight(side * 13.5, -40.5) + 1.48, -40.5),
      makeCyl(0.05, 0.08, 2.95, 5, side * 21.5, ctx.getHeight(side * 21.5, -44.5) + 1.48, -44.5),
      makeCyl(0.18, 0.16, 0.56, 6, side * 16.8, ctx.getHeight(side * 16.8, -42.5) + 0.28, -42.5)
    );
    const bsY = ctx.getHeight(side * 18.5, -42.5);
    tlW5Relief.push(
      remapRelief(makeCyl(1.45, 1.62, 0.48, 6, side * 18.5, bsY + 0.24, -42.5), 'thanhHoaStone'),
      makeReliefBox(10.0, 0.92, 0.38, 'thangLongBrick', side * 11.5, ctx.getHeight(side * 11.5, -38.5) + 0.46, -38.5),
      makeReliefBox(1.55, 0.78, 0.85, 'thanhHoaStone', side * 9.5, ctx.getHeight(side * 9.5, -40.5) + 0.39, -40.5),
      makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', side * 15.5, ctx.getHeight(side * 15.5, -42.5) + 0.21, -42.5),
      makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', side * 15.5, ctx.getHeight(side * 15.5, -45.5) + 0.21, -45.5),
      makeReliefBox(2.2, 0.36, 1.15, 'thangLongBrick', side * 18.5, bsY + 0.18, -39.8),
      makeReliefBox(2.2, 0.36, 1.15, 'thangLongBrick', side * 18.5, bsY + 0.18, -45.2),
      // 1415-1416. Entrance guard kiosks (±22.5, -40.5)
      makeReliefBox(2.8, 2.55, 2.6, 'vongLauOchre', side * 22.5, ctx.getHeight(side * 22.5, -40.5) + 1.28, -40.5),
      makeReliefBox(3.4, 0.34, 3.2, 'terracottaHipRoof', side * 22.5, ctx.getHeight(side * 22.5, -40.5) + 2.70, -40.5),
      makeReliefBox(0.54, 0.65, 0.58, 'thanhHoaStone', side * 2.8, sgW5Y + 0.32, -39.5),
      makeReliefBox(10.0, 0.08, 0.30, 'thanhHoaStone', side * 12.0, ctx.getHeight(side * 12.0, -37.8) + 0.04, -37.8),
      makeReliefBox(0.56, 0.44, 0.56, 'thanhHoaStone', side * 4.2, sgW5Y + 0.22, -38.8),
      makeReliefBox(0.56, 0.44, 0.56, 'thanhHoaStone', side * 4.2, sgW5Y + 0.22, -41.8),
      remapRelief(makeCyl(0.52, 0.32, 0.62, 6, side * 21.5, ctx.getHeight(side * 21.5, -45.5) + 0.31, -45.5), 'thanhHoaStone'),
      makeReliefBox(0.95, 1.55, 0.24, 'thanhHoaStone', side * 14.5, ctx.getHeight(side * 14.5, -44.5) + 0.78, -44.5),
      makeReliefBox(0.32, 0.78, 0.32, 'thanhHoaStone', side * 3.2, ctx.getHeight(side * 3.2, -44.5) + 0.39, -44.5)
    );
    tlW5Glow.push(
      makeBox(0.16, 0.22, 0.16, side * 22.5, ctx.getHeight(side * 22.5, -40.5) + 2.40, -39.0),
      makeBox(0.10, 0.10, 0.10, side * 2.2, sgW5Y + 0.40, -38.8),
      makeBox(0.20, 0.22, 0.20, side * 13.5, ctx.getHeight(side * 13.5, -40.5) + 3.05, -40.5),
      makeBox(0.20, 0.22, 0.20, side * 21.5, ctx.getHeight(side * 21.5, -44.5) + 3.05, -44.5)
    );
    for (const fx of [8.8, 20.5]) {
      const fy = ctx.getHeight(side * fx, -39.5);
      tlW5Crimson.push(makeCyl(0.04, 0.05, 3.8, 5, side * fx, fy + 1.85, -39.5));
      tlW5Gold.push(makeBox(0.05, 1.25, 0.52, side * fx, fy + 3.10, -39.15));
    }
    for (const lx of [4.8, 15.5]) {
      const ly = ctx.getHeight(side * lx, -39.5);
      tlW5Wood.push(makeCyl(0.05, 0.07, 2.55, 5, side * lx, ly + 1.22, -39.5));
      tlW5Glow.push(makeBox(0.18, 0.22, 0.18, side * lx, ly + 2.55, -39.5));
    }
    for (const bx of [5.5, 10.5, 16.5]) {
      tlW5Relief.push(makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', side * bx, ctx.getHeight(side * bx, -37.2) + 0.34, -37.2));
    }
    for (const sx of [13.0, 16.0]) {
      const sy = ctx.getHeight(side * sx, -44.5);
      tlW5Relief.push(
        makeReliefBox(0.40, 0.98, 0.40, 'thanhHoaStone', side * sx, sy + 0.49, -44.5),
        makeReliefBox(0.54, 0.16, 0.54, 'terracottaHipRoof', side * sx, sy + 1.06, -44.5)
      );
    }
  }

  // 1431-1455. Điện Kính Thiên Side Colonnades (±25.5, -86.5), Dragon Balustrade Wings, Court Banners & Rituals
  const ktForeY = ctx.getHeight(0, -82.5);
  tlW5Crimson.push(makeBox(2.2, 0.88, 0.82, 0, ktForeY + 0.44, -82.5));
  tlW5Relief.push(makeReliefBox(0.92, 1.45, 0.22, 'thanhHoaStone', 11.5, ctx.getHeight(11.5, -81.5) + 0.72, -81.5));
  tlW5Bronze.push(makeCyl(0.06, 0.08, 2.15, 6, -17.5, ctx.getHeight(-17.5, -94.5) + 1.08, -94.5));
  for (const side of [-1, 1]) {
    const colX = side * 25.5;
    const colY = ctx.getHeight(colX, -86.5);
    tlW5Relief.push(
      makeReliefBox(4.2, 0.42, 11.5, 'thangLongBrick', colX, colY + 0.21, -86.5),
      makeReliefBox(4.8, 0.36, 12.2, 'terracottaHipRoof', colX, colY + 3.12, -86.5),
      makeReliefBox(1.15, 0.24, 2.4, 'thanhHoaStone', side * 22.5, colY + 0.12, -86.5),
      makeReliefBox(2.6, 1.55, 0.38, 'thangLongBrick', colX, colY + 0.78, -93.5),
      makeReliefBox(0.26, 0.08, 12.0, 'thanhHoaStone', side * 28.2, colY + 0.04, -86.5),
      // 1434, 1440, 1444, 1451, 1454. Dragon wing wall, planters, benches, lotus urns & column-base display
      makeReliefBox(0.48, 1.05, 3.6, 'thanhHoaStone', side * 14.5, ctx.getHeight(side * 14.5, -81.5) + 0.52, -81.5),
      makeReliefBox(2.0, 0.36, 1.15, 'thangLongBrick', side * 19.5, ctx.getHeight(side * 19.5, -86.5) + 0.18, -86.5),
      makeReliefBox(2.0, 0.36, 1.15, 'thangLongBrick', side * 19.5, ctx.getHeight(side * 19.5, -90.5) + 0.18, -90.5),
      makeReliefBox(0.48, 0.42, 1.65, 'thanhHoaStone', side * 21.5, ctx.getHeight(side * 21.5, -79.5) + 0.21, -79.5),
      makeReliefBox(0.48, 0.42, 1.65, 'thanhHoaStone', side * 21.5, ctx.getHeight(side * 21.5, -93.5) + 0.21, -93.5),
      remapRelief(makeCyl(0.46, 0.36, 0.52, 6, side * 13.5, ctx.getHeight(side * 13.5, -84.5) + 0.26, -84.5), 'thanhHoaStone'),
      makeReliefBox(0.85, 0.42, 0.85, 'thanhHoaStone', side * 17.5, ctx.getHeight(side * 17.5, -79.5) + 0.21, -79.5)
    );
    for (const dx of [-1.55, 1.55]) {
      for (const dz of [-4.6, 0, 4.6]) {
        tlW5Wood.push(makeCyl(0.11, 0.13, 2.85, 6, colX + dx, colY + 1.64, -86.5 + dz));
      }
    }
    for (const lz of [-82.5, -86.5, -90.5]) {
      tlW5Glow.push(makeBox(0.16, 0.22, 0.16, colX - side * 1.4, colY + 2.75, lz));
    }
    // 1435-1439, 1446, 1448-1449, 1453. Censers, banners, lanterns, showcases, cranes, bollards, uplights & lamps
    for (const uz of [-80.5, -86.5]) {
      tlW5Bronze.push(makeCyl(0.24, 0.18, 0.48, 6, side * 8.5, ctx.getHeight(side * 8.5, uz) + 0.24, uz));
    }
    for (const bz of [-82.0, -87.0, -92.0]) {
      const by = ctx.getHeight(side * 16.5, bz);
      tlW5Crimson.push(makeCyl(0.04, 0.05, 3.8, 5, side * 16.5, by + 1.85, bz));
      tlW5Gold.push(makeBox(0.05, 1.25, 0.52, side * 16.5, by + 3.10, bz + 0.32));
    }
    for (const lz of [-78.5, -91.5]) {
      const ly = ctx.getHeight(side * 11.5, lz);
      tlW5Relief.push(
        makeReliefBox(0.42, 1.02, 0.42, 'thanhHoaStone', side * 11.5, ly + 0.51, lz),
        makeReliefBox(0.56, 0.16, 0.56, 'terracottaHipRoof', side * 11.5, ly + 1.10, lz)
      );
    }
    tlW5Wood.push(makeBox(1.35, 0.82, 0.85, side * 19.5, ctx.getHeight(side * 19.5, -82.5) + 0.41, -82.5));
    tlW5Glass.push(makeBox(1.25, 0.62, 0.78, side * 19.5, ctx.getHeight(side * 19.5, -82.5) + 1.12, -82.5));
    tlW5Bronze.push(
      makeCyl(0.05, 0.09, 1.25, 5, side * 3.5, ktForeY + 0.62, -83.5),
      makeCyl(0.05, 0.08, 2.95, 5, side * 22.5, ctx.getHeight(side * 22.5, -82.0) + 1.48, -82.0),
      makeCyl(0.05, 0.08, 2.95, 5, side * 22.5, ctx.getHeight(side * 22.5, -91.0) + 1.48, -91.0)
    );
    for (const pz of [-83.5, -88.5]) {
      tlW5Relief.push(makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', side * 7.2, ctx.getHeight(side * 7.2, pz) + 0.34, pz));
    }
    for (const uz of [-84.5, -87.5]) {
      tlW5Bronze.push(makeCyl(0.08, 0.10, 0.36, 5, side * 5.5, ctx.getHeight(side * 5.5, uz) + 0.18, uz));
      tlW5Glow.push(makeBox(0.10, 0.10, 0.10, side * 5.5, ctx.getHeight(side * 5.5, uz) + 0.40, uz));
    }
  }
  // 1442-1443. Ceremonial drum in Tả Vu & bell in Hữu Vu
  tlW5Wood.push(
    makeBox(0.88, 0.65, 0.65, -25.5, ctx.getHeight(-25.5, -86.5) + 0.72, -86.5),
    makeBox(0.12, 1.95, 0.12, 24.9, ctx.getHeight(25.5, -86.5) + 1.32, -86.5),
    makeBox(0.12, 1.95, 0.12, 26.1, ctx.getHeight(25.5, -86.5) + 1.32, -86.5),
    makeBox(1.45, 0.14, 0.14, 25.5, ctx.getHeight(25.5, -86.5) + 2.30, -86.5)
  );
  tlW5Crimson.push(makeCyl(0.42, 0.42, 0.72, 6, -25.5, ctx.getHeight(-25.5, -86.5) + 1.38, -86.5, 0, Math.PI * 0.5));
  tlW5Bronze.push(makeCyl(0.22, 0.30, 0.68, 6, 25.5, ctx.getHeight(25.5, -86.5) + 1.75, -86.5));

  // 1456-1480. 18 Hoàng Diệu Archaeological Site Canopy Pit D (-59.5, -74.0), Ancient Lý Well (-59.5, -67.5) & Field Lab
  const pdY = ctx.getHeight(-59.5, -74.0);
  tlW5Relief.push(
    makeReliefBox(5.8, 0.32, 6.4, 'thangLongBrick', -59.5, pdY + 0.16, -74.0),
    remapRelief(makeCyl(1.15, 1.25, 0.78, 8, -59.5, ctx.getHeight(-59.5, -67.5) + 0.39, -67.5), 'thangLongBrick'),
    makeReliefBox(1.35, 0.78, 0.95, 'thanhHoaStone', -55.5, ctx.getHeight(-55.5, -68.5) + 0.39, -68.5),
    makeReliefBox(4.2, 0.38, 1.45, 'thangLongBrick', -59.5, ctx.getHeight(-59.5, -86.5) + 0.19, -86.5),
    makeReliefBox(1.85, 0.36, 1.15, 'thangLongBrick', -55.5, ctx.getHeight(-55.5, -62.5) + 0.18, -62.5),
    makeReliefBox(1.85, 0.36, 1.15, 'thangLongBrick', -55.5, ctx.getHeight(-55.5, -88.5) + 0.18, -88.5),
    makeReliefBox(0.92, 1.45, 0.22, 'thanhHoaStone', -56.5, ctx.getHeight(-56.5, -60.5) + 0.72, -60.5),
    makeReliefBox(0.26, 0.08, 12.0, 'thanhHoaStone', -63.8, pdY + 0.04, -74.0)
  );
  for (const dx of [-2.8, 2.8]) {
    for (const dz of [-3.0, 0, 3.0]) {
      tlW5Steel.push(makeBox(0.14, 3.20, 0.14, -59.5 + dx, pdY + 1.55, -74.0 + dz));
    }
  }
  tlW5Glass.push(
    makeBox(6.4, 0.12, 7.0, -59.5, pdY + 3.18, -74.0),
    makeBox(3.4, 0.10, 3.4, -59.5, ctx.getHeight(-59.5, -67.5) + 2.48, -67.5),
    makeBox(1.25, 0.62, 0.85, -55.5, ctx.getHeight(-55.5, -68.5) + 1.12, -68.5),
    makeBox(4.4, 0.10, 3.2, -59.5, ctx.getHeight(-59.5, -81.5) + 2.48, -81.5)
  );
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.45, 1.45]) {
      tlW5Steel.push(makeBox(0.10, 2.55, 0.10, -59.5 + dx, ctx.getHeight(-59.5, -67.5) + 1.20, -67.5 + dz));
    }
  }
  for (const dx of [-1.9, 1.9]) {
    for (const dz of [-1.3, 1.3]) {
      tlW5Steel.push(makeBox(0.10, 2.55, 0.10, -59.5 + dx, ctx.getHeight(-59.5, -81.5) + 1.20, -81.5 + dz));
    }
  }
  tlW5Wood.push(
    makeBox(1.55, 0.18, 6.8, -55.5, pdY + 0.34, -74.0),
    makeBox(2.2, 0.82, 0.82, -59.5, ctx.getHeight(-59.5, -81.5) + 0.41, -82.2),
    makeBox(2.2, 0.82, 0.82, -59.5, ctx.getHeight(-59.5, -81.5) + 0.41, -80.8),
    makeBox(0.65, 1.55, 2.8, -62.5, ctx.getHeight(-62.5, -81.5) + 0.78, -81.5),
    makeBox(1.05, 0.85, 0.72, -56.5, ctx.getHeight(-56.5, -85.5) + 0.42, -85.5),
    makeBox(0.88, 0.62, 0.88, -57.8, ctx.getHeight(-57.8, -82.5) + 0.31, -82.5),
    // 1472. Researcher field shelter (-61.5, -62.0)
    makeBox(2.8, 2.25, 2.4, -61.5, ctx.getHeight(-61.5, -62.0) + 1.12, -62.0),
    makeBox(0.12, 2.15, 0.12, -54.2, ctx.getHeight(-54.2, -60.5) + 1.08, -60.5)
  );
  tlW5Relief.push(makeReliefBox(3.4, 0.32, 3.0, 'terracottaHipRoof', -61.5, ctx.getHeight(-61.5, -62.0) + 2.38, -62.0));
  tlW5Steel.push(
    makeBox(6.0, 0.82, 0.08, -59.5, pdY + 0.41, -70.5),
    makeBox(6.0, 0.82, 0.08, -59.5, pdY + 0.41, -77.5),
    makeBox(0.68, 1.15, 0.52, -61.5, ctx.getHeight(-61.5, -62.0) + 0.58, -60.6)
  );
  for (const [fx, fz] of [[-56.0, -70.0], [-63.0, -70.0], [-56.0, -78.0], [-63.0, -78.0]] as const) {
    const fy = ctx.getHeight(fx, fz);
    tlW5Steel.push(makeCyl(0.05, 0.07, 2.45, 5, fx, fy + 1.22, fz));
    tlW5Glow.push(makeBox(0.18, 0.16, 0.18, fx, fy + 2.48, fz));
  }
  tlW5Glow.push(
    makeBox(0.22, 0.14, 0.22, -59.5, pdY + 2.95, -72.0),
    makeBox(0.22, 0.14, 0.22, -59.5, pdY + 2.95, -76.0)
  );
  for (const iz of [-70.0, -74.0, -78.0]) {
    tlW5Steel.push(makeBox(0.12, 1.15, 0.85, -54.8, ctx.getHeight(-54.8, iz) + 0.58, iz));
  }
  for (const bz of [-66.5, -74.0, -82.5]) {
    tlW5Relief.push(makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', -54.2, ctx.getHeight(-54.2, bz) + 0.21, bz));
  }
  for (const lz of [-63.5, -71.5, -79.5]) {
    const ly = ctx.getHeight(-54.2, lz);
    tlW5Relief.push(
      makeReliefBox(0.40, 0.98, 0.40, 'thanhHoaStone', -54.2, ly + 0.49, lz),
      makeReliefBox(0.54, 0.16, 0.54, 'terracottaHipRoof', -54.2, ly + 1.06, lz)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bz = -66.0 - i * 4.0;
    tlW5Relief.push(makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', -64.5, ctx.getHeight(-64.5, bz) + 0.34, bz));
  }

  // 1481-1500. East Cột Cờ Brick Bastion Turret (60.5, -76.0) & Chính Bắc Môn Moat Watch Pavilion (38.5, -104.0)
  const ebY = ctx.getHeight(60.5, -76.0);
  tlW5Relief.push(
    makeReliefBox(4.2, 3.4, 4.2, 'thangLongBrick', 60.5, ebY + 1.70, -76.0),
    makeReliefBox(4.8, 0.36, 4.8, 'terracottaHipRoof', 60.5, ebY + 3.56, -76.0),
    makeReliefBox(2.6, 1.45, 2.6, 'vongLauOchre', 60.5, ebY + 4.44, -76.0),
    makeReliefBox(3.2, 0.34, 3.2, 'terracottaHipRoof', 60.5, ebY + 5.32, -76.0),
    makeReliefBox(0.65, 2.25, 8.2, 'thangLongBrick', 60.5, ebY + 1.12, -69.5),
    makeReliefBox(0.65, 2.25, 8.2, 'thangLongBrick', 60.5, ebY + 1.12, -82.5),
    makeReliefBox(0.95, 1.55, 0.24, 'thanhHoaStone', 58.5, ebY + 0.78, -76.0),
    makeReliefBox(0.58, 0.44, 0.58, 'thanhHoaStone', 58.5, ebY + 0.22, -74.5),
    makeReliefBox(0.58, 0.44, 0.58, 'thanhHoaStone', 58.5, ebY + 0.22, -77.5)
  );
  for (const cz2 of [-71.5, -80.5]) {
    tlW5Bronze.push(
      makeCyl(0.14, 0.20, 2.1, 6, 58.5, ebY + 0.78, cz2, 0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.24, 0.34, 4).rotateY(Math.PI * 0.25).translate(58.5, ebY + 0.48, cz2 + 1.4)
    );
    tlW5Wood.push(makeBox(1.25, 0.46, 0.85, 58.5, ebY + 0.48, cz2));
  }
  for (const fz of [-73.0, -79.0]) {
    tlW5Crimson.push(makeCyl(0.04, 0.05, 3.8, 5, 60.5, ebY + 5.15, fz));
    tlW5Gold.push(makeBox(0.05, 1.15, 0.52, 60.5, ebY + 6.40, fz + 0.30));
  }
  for (const lz of [-67.5, -73.5, -78.5, -84.5]) {
    const ly = ctx.getHeight(58.5, lz);
    tlW5Relief.push(
      makeReliefBox(0.40, 0.98, 0.40, 'thanhHoaStone', 58.5, ly + 0.49, lz),
      makeReliefBox(0.54, 0.16, 0.54, 'terracottaHipRoof', 58.5, ly + 1.06, lz)
    );
  }
  for (const bz of [-68.5, -83.5]) {
    tlW5Relief.push(makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', 58.8, ctx.getHeight(58.8, bz) + 0.21, bz));
  }
  // 1488-1497, 1500. North Moat Watch Pavilion (38.5, -104.0) & NE Park
  const nmY = ctx.getHeight(38.5, -104.0);
  tlW5Relief.push(
    makeReliefBox(3.8, 2.8, 3.8, 'vongLauOchre', 38.5, nmY + 1.40, -104.0),
    makeReliefBox(4.4, 0.34, 4.4, 'terracottaHipRoof', 38.5, nmY + 2.96, -104.0),
    makeReliefBox(2.4, 1.35, 2.4, 'vongLauOchre', 38.5, nmY + 3.78, -104.0),
    makeReliefBox(3.0, 0.32, 3.0, 'terracottaHipRoof', 38.5, nmY + 4.60, -104.0),
    makeReliefBox(1.85, 0.18, 1.25, 'thanhHoaStone', 35.5, nmY + 0.10, -104.0),
    makeReliefBox(2.0, 0.36, 1.15, 'thangLongBrick', 38.5, nmY + 0.18, -100.5),
    makeReliefBox(2.0, 0.36, 1.15, 'thangLongBrick', 38.5, nmY + 0.18, -107.5),
    remapRelief(makeCyl(0.52, 0.32, 0.62, 6, 36.5, ctx.getHeight(36.5, -111.5) + 0.31, -111.5), 'thanhHoaStone'),
    remapRelief(makeCyl(0.32, 0.24, 0.64, 6, 31.5, ctx.getHeight(31.5, -112.5) + 0.32, -112.5), 'thanhHoaStone')
  );
  tlW5Glow.push(makeBox(0.18, 0.22, 0.18, 36.6, nmY + 2.65, -104.0));
  tlW5Wood.push(makeBox(1.35, 1.45, 0.52, 31.5, ctx.getHeight(31.5, -106.5) + 0.72, -106.5));
  tlW5Bronze.push(makeCyl(0.06, 0.08, 2.25, 6, 46.5, ctx.getHeight(46.5, -92.5) + 1.12, -92.5));
  for (const nz of [-99.5, -104.0, -108.5]) {
    const ny = ctx.getHeight(36.5, nz);
    tlW5Relief.push(makeReliefBox(0.52, 0.42, 1.65, 'thanhHoaStone', 36.5, ny + 0.21, nz));
    tlW5Bronze.push(makeCyl(0.05, 0.08, 2.95, 5, 39.5, ctx.getHeight(39.5, nz) + 1.48, nz));
    tlW5Glow.push(makeBox(0.20, 0.22, 0.20, 39.5, ctx.getHeight(39.5, nz) + 3.05, nz));
  }
  for (const bz of [-100.0, -103.0, -106.0, -109.0]) {
    tlW5Relief.push(makeReliefBox(0.28, 0.68, 0.28, 'thanhHoaStone', 34.5, ctx.getHeight(34.5, bz) + 0.34, bz));
  }

  addMerged(tlW5Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave5AtlasMesh', false, true);
  addMerged(tlW5Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave5Wood', false, true);
  addMerged(tlW5Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave5Bronze', false, true);
  addMerged(tlW5Gold, ctx.materials.gold, 'HoangThanhWave5Gold', false, false);
  addMerged(tlW5Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave5Crimson', false, true);
  addMerged(tlW5Steel, stainlessMat, 'HoangThanhWave5Steel', false, false);
  addMerged(tlW5Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave5Glass', false, false);
  addMerged(tlW5Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave5Glow', false, false);

  // =================================================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADE (Items 1801..1900 — castShadow = false, 0 new materials)
  // =================================================================================================
  const tlW6Relief: THREE.BufferGeometry[] = [];
  const tlW6Wood: THREE.BufferGeometry[] = [];
  const tlW6Bronze: THREE.BufferGeometry[] = [];
  const tlW6Gold: THREE.BufferGeometry[] = [];
  const tlW6Crimson: THREE.BufferGeometry[] = [];
  const tlW6Steel: THREE.BufferGeometry[] = [];
  const tlW6Glass: THREE.BufferGeometry[] = [];
  const tlW6Glow: THREE.BufferGeometry[] = [];

  // 1801-1830. Outer 18 Hoàng Diệu Archaeological Exhibition Pavilion (-69.5, -74.0) & Stratigraphic Pit (-69.5, -81.5)
  const exY = ctx.getHeight(-69.5, -74.0);
  const stY = ctx.getHeight(-69.5, -81.5);
  tlW6Glass.push(
    makeBox(5.2, 0.14, 8.6, -69.5, exY + 3.12, -74.0),
    makeBox(1.45, 0.82, 1.45, -69.5, exY + 1.15, -74.0),
    makeBox(4.4, 0.14, 4.4, -69.5, stY + 2.65, -81.5)
  );
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-3.6, 0.0, 3.6]) {
      tlW6Steel.push(makeBox(0.12, 3.25, 0.12, -69.5 + dx, exY + 1.52, -74.0 + dz));
    }
    for (const dz of [-1.8, 1.8]) {
      tlW6Steel.push(makeBox(0.10, 2.75, 0.10, -69.5 + dx * 0.85, stY + 1.28, -81.5 + dz));
    }
  }
  tlW6Relief.push(
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -69.5, exY + 0.32, -71.5),
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -69.5, exY + 0.32, -76.5),
    makeReliefBox(1.55, 0.72, 1.55, 'thanhHoaStone', -69.5, exY + 0.36, -74.0),
    makeReliefBox(3.4, 0.58, 3.2, 'thangLongBrick', -69.5, stY + 0.29, -81.5),
    makeReliefBox(2.4, 0.42, 2.2, 'thanhHoaStone', -69.5, stY + 0.74, -81.5),
    makeReliefBox(0.42, 0.26, 12.0, 'thangLongBrick', -72.5, exY + 0.13, -74.0),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -69.5, ctx.getHeight(-69.5, -65.5) + 0.17, -65.5),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -69.5, ctx.getHeight(-69.5, -87.5) + 0.17, -87.5),
    // 1825, 1829. Field guard kiosk (-70.5, -62.5) & archaeological monument (-66.5, -62.5)
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', -70.5, ctx.getHeight(-70.5, -62.5) + 1.15, -62.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', -70.5, ctx.getHeight(-70.5, -62.5) + 2.42, -62.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thanhHoaStone', -66.5, ctx.getHeight(-66.5, -62.5) + 0.74, -62.5)
  );
  tlW6Wood.push(
    makeBox(0.68, 1.35, 1.45, -67.2, exY + 0.68, -71.5),
    makeBox(0.68, 1.35, 1.45, -67.2, exY + 0.68, -76.5),
    makeBox(1.15, 0.80, 0.68, -68.0, ctx.getHeight(-68.0, -62.5) + 0.40, -62.5),
    makeBox(0.85, 0.58, 0.85, -72.2, ctx.getHeight(-72.2, -62.5) + 0.29, -62.5)
  );
  tlW6Steel.push(
    makeBox(4.4, 0.78, 0.08, -69.5, stY + 0.39, -79.2),
    makeBox(4.4, 0.78, 0.08, -69.5, stY + 0.39, -83.8),
    makeBox(0.12, 1.12, 0.82, -66.8, exY + 0.56, -74.0),
    makeBox(0.12, 1.12, 0.82, -66.8, stY + 0.56, -81.5)
  );
  tlW6Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, -66.5, ctx.getHeight(-66.5, -88.5) + 1.10, -88.5));
  tlW6Glow.push(makeBox(0.18, 0.20, 0.18, -69.2, ctx.getHeight(-70.5, -62.5) + 2.15, -62.5));
  for (const [fx, fz] of [[-67.0, -68.5], [-72.0, -68.5], [-67.0, -84.5], [-72.0, -84.5]] as const) {
    const fy = ctx.getHeight(fx, fz);
    tlW6Steel.push(makeCyl(0.05, 0.07, 2.45, 4, fx, fy + 1.22, fz));
    tlW6Glow.push(makeBox(0.18, 0.16, 0.18, fx, fy + 2.48, fz));
  }
  for (const bz of [-66.5, -78.5, -86.5]) {
    tlW6Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', -66.5, ctx.getHeight(-66.5, bz) + 0.21, bz));
  }
  for (const lz of [-69.5, -83.5]) {
    const ly = ctx.getHeight(-66.5, lz);
    tlW6Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', -66.5, ly + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', -66.5, ly + 1.04, lz)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bz = -66.0 - i * 4.0;
    tlW6Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', -73.8, ctx.getHeight(-73.8, bz) + 0.33, bz));
  }

  // 1831-1855. Royal Brick Drainage Channels (±27.5, -42.0) & South Imperial Lantern Avenue (±25.8, -37..-46)
  for (const side of [-1, 1]) {
    const dx = side * 27.5;
    const dy = ctx.getHeight(dx, -42.0);
    tlW6Relief.push(
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx - 0.32, dy + 0.14, -42.0),
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx + 0.32, dy + 0.14, -42.0),
      makeReliefBox(1.35, 0.16, 1.45, 'thanhHoaStone', dx, dy + 0.28, -42.0),
      makeReliefBox(0.48, 0.95, 11.5, 'thangLongBrick', side * 30.5, ctx.getHeight(side * 30.5, -42.0) + 0.48, -42.0),
      makeReliefBox(0.88, 1.38, 0.22, 'thanhHoaStone', side * 25.8, ctx.getHeight(side * 25.8, -44.5) + 0.69, -44.5),
      makeReliefBox(1.95, 0.34, 1.15, 'thangLongBrick', side * 29.2, ctx.getHeight(side * 29.2, -42.0) + 0.17, -42.0)
    );
    tlW6Bronze.push(
      makeCyl(0.32, 0.24, 0.68, 4, side * 25.8, ctx.getHeight(side * 25.8, -38.5) + 0.34, -38.5),
      makeBox(0.22, 0.16, 0.22, dx, dy + 0.08, -39.5),
      makeBox(0.22, 0.16, 0.22, dx, dy + 0.08, -44.5)
    );
    for (const lz of [-37.0, -40.0, -43.0, -46.0]) {
      const ly = ctx.getHeight(side * 25.8, lz);
      tlW6Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, side * 25.8, ly + 1.40, lz));
      tlW6Glow.push(makeBox(0.22, 0.26, 0.22, side * 25.8, ly + 2.92, lz));
      tlW6Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 32.2, ctx.getHeight(side * 32.2, lz) + 0.33, lz));
    }
    for (const bz of [-39.0, -45.0]) {
      tlW6Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 29.2, ctx.getHeight(side * 29.2, bz) + 0.21, bz));
    }
    for (const uz of [-37.0, -47.0]) {
      tlW6Relief.push(makeReliefBox(0.56, 0.42, 0.56, 'thanhHoaStone', side * 28.8, ctx.getHeight(side * 28.8, uz) + 0.21, uz));
    }
    for (const fz of [-38.0, -46.0]) {
      const fy = ctx.getHeight(side * 31.5, fz);
      tlW6Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 31.5, fy + 1.72, fz));
      tlW6Gold.push(makeBox(0.05, 1.05, 0.46, side * 31.5, fy + 2.95, fz + 0.28));
    }

    // 1856-1875. Kính Thiên Outer East & West Imperial Garden Pavilions (±33.5, -86.5)
    const kx = side * 33.5;
    const ky = ctx.getHeight(kx, -86.5);
    tlW6Relief.push(
      makeReliefBox(4.0, 0.36, 4.0, 'thanhHoaStone', kx, ky + 0.18, -86.5),
      makeReliefBox(4.6, 0.30, 4.6, 'terracottaHipRoof', kx, ky + 2.94, -86.5),
      remapRelief(makeCyl(0.48, 0.30, 0.62, 4, kx, ky + 0.66, -86.5), 'thanhHoaStone'),
      makeReliefBox(2.8, 1.55, 0.36, 'thanhHoaStone', kx, ctx.getHeight(kx, -92.5) + 0.78, -92.5),
      makeReliefBox(2.0, 0.34, 1.15, 'thangLongBrick', kx, ctx.getHeight(kx, -79.5) + 0.17, -79.5),
      makeReliefBox(0.24, 0.08, 10.0, 'thanhHoaStone', side * 35.8, ky + 0.04, -86.5),
      makeReliefBox(1.05, 0.22, 1.95, 'thanhHoaStone', side * 31.2, ky + 0.11, -86.5),
      makeReliefBox(0.86, 1.38, 0.22, 'thanhHoaStone', side * 31.5, ctx.getHeight(side * 31.5, -79.5) + 0.69, -79.5)
    );
    for (const dx2 of [-1.50, 1.50]) {
      for (const dz2 of [-1.50, 1.50]) {
        tlW6Crimson.push(makeCyl(0.09, 0.11, 2.70, 4, kx + dx2, ky + 1.50, -86.5 + dz2));
      }
    }
    tlW6Glow.push(makeBox(0.20, 0.24, 0.20, kx, ky + 2.66, -86.5));
    tlW6Bronze.push(makeCyl(0.30, 0.22, 0.62, 4, side * 30.8, ky + 0.31, -86.5));
    for (const lz of [-81.5, -90.5]) {
      const ly = ctx.getHeight(kx, lz);
      tlW6Relief.push(
        makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', kx, ly + 0.48, lz),
        makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', kx, ly + 1.04, lz)
      );
    }
    for (const bz of [-83.0, -90.0]) {
      tlW6Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 31.2, ctx.getHeight(side * 31.2, bz) + 0.21, bz));
    }
    for (const fz of [-82.0, -91.0]) {
      const fy = ctx.getHeight(side * 36.0, fz);
      tlW6Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 36.0, fy + 1.72, fz));
      tlW6Gold.push(makeBox(0.05, 1.05, 0.46, side * 36.0, fy + 2.95, fz + 0.28));
    }
    for (const cz2 of [-80.0, -93.0]) {
      tlW6Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 36.5, ctx.getHeight(side * 36.5, cz2) + 0.33, cz2));
    }
  }

  // 1876-1900. Outer East Rampart Cannon Battery (64.2..66.5, -68..-85) & North Moat Lantern Promenade (42..47, -97..-112)
  const rpY = ctx.getHeight(65.5, -76.0);
  tlW6Relief.push(
    makeReliefBox(0.65, 1.85, 16.0, 'thangLongBrick', 65.5, rpY + 0.92, -76.0),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', 65.5, ctx.getHeight(65.5, -85.5) + 1.15, -85.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', 65.5, ctx.getHeight(65.5, -85.5) + 2.42, -85.5),
    makeReliefBox(0.90, 1.48, 0.22, 'thanhHoaStone', 63.5, rpY + 0.74, -76.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 63.5, ctx.getHeight(63.5, -84.0) + 0.21, -84.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 63.5, ctx.getHeight(63.5, -68.8) + 0.21, -68.8),
    // 1892-1896, 1899. North Moat Bridge, Planters, Tea Table, Incense Burner & Drainage
    makeReliefBox(1.85, 0.18, 1.25, 'thanhHoaStone', 43.5, ctx.getHeight(43.5, -112.0) + 0.10, -112.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 45.2, ctx.getHeight(45.2, -98.0) + 0.17, -98.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 45.2, ctx.getHeight(45.2, -111.0) + 0.17, -111.0),
    remapRelief(makeCyl(0.48, 0.30, 0.60, 4, 46.5, ctx.getHeight(46.5, -104.5) + 0.30, -104.5), 'thanhHoaStone'),
    remapRelief(makeCyl(0.30, 0.22, 0.60, 4, 42.5, ctx.getHeight(42.5, -112.5) + 0.30, -112.5), 'thanhHoaStone'),
    makeReliefBox(0.24, 0.08, 12.0, 'thanhHoaStone', 46.5, ctx.getHeight(46.5, -104.5) + 0.04, -104.5)
  );
  tlW6Glow.push(makeBox(0.18, 0.22, 0.18, 64.2, ctx.getHeight(65.5, -85.5) + 2.15, -85.5));
  tlW6Wood.push(makeBox(1.30, 1.40, 0.50, 45.5, ctx.getHeight(45.5, -96.5) + 0.70, -96.5));
  tlW6Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, 42.5, ctx.getHeight(42.5, -97.0) + 1.10, -97.0));
  tlW6Gold.push(makeBox(0.76, 0.22, 0.08, 42.9, ctx.getHeight(42.5, -97.0) + 1.85, -97.0));
  for (const cz2 of [-70.5, -76.0, -81.5]) {
    const cy2 = ctx.getHeight(64.2, cz2);
    tlW6Bronze.push(
      makeCyl(0.14, 0.19, 2.05, 5, 64.2, cy2 + 0.76, cz2, 0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI * 0.25).translate(64.2, cy2 + 0.46, cz2 + 1.35)
    );
    tlW6Wood.push(makeBox(1.20, 0.44, 0.82, 64.2, cy2 + 0.46, cz2));
  }
  for (const lz of [-67.5, -73.2, -78.8]) {
    const ly = ctx.getHeight(63.5, lz);
    tlW6Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', 63.5, ly + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', 63.5, ly + 1.04, lz)
    );
  }
  for (const fz of [-71.5, -80.5]) {
    const fy = ctx.getHeight(66.5, fz);
    tlW6Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, 66.5, fy + 1.72, fz));
    tlW6Gold.push(makeBox(0.05, 1.05, 0.46, 66.5, fy + 2.95, fz + 0.28));
  }
  for (const bz of [-69.0, -74.0, -79.0, -84.0]) {
    tlW6Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 67.2, ctx.getHeight(67.2, bz) + 0.33, bz));
  }
  for (const lz of [-99.0, -102.5, -106.0, -109.5]) {
    const ly = ctx.getHeight(43.5, lz);
    tlW6Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, 43.5, ly + 1.40, lz));
    tlW6Glow.push(makeBox(0.22, 0.26, 0.22, 43.5, ly + 2.92, lz));
    tlW6Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 47.2, ctx.getHeight(47.2, lz) + 0.33, lz));
  }
  for (const nz of [-100.5, -104.5, -108.5]) {
    tlW6Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 45.2, ctx.getHeight(45.2, nz) + 0.21, nz));
    tlW6Bronze.push(makeCyl(0.05, 0.08, 2.85, 4, 42.2, ctx.getHeight(42.2, nz) + 1.42, nz));
    tlW6Glow.push(makeBox(0.18, 0.20, 0.18, 42.2, ctx.getHeight(42.2, nz) + 2.95, nz));
  }

  addMerged(tlW6Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave6AtlasMesh', false, true);
  addMerged(tlW6Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave6Wood', false, true);
  addMerged(tlW6Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave6Bronze', false, true);
  addMerged(tlW6Gold, ctx.materials.gold, 'HoangThanhWave6Gold', false, false);
  addMerged(tlW6Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave6Crimson', false, true);
  addMerged(tlW6Steel, stainlessMat, 'HoangThanhWave6Steel', false, false);
  addMerged(tlW6Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave6Glass', false, false);
  addMerged(tlW6Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave6Glow', false, false);

  // =================================================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADE (Items 2201..2300 — castShadow = false, 0 new materials)
  // =================================================================================================
  const tlW7Relief: THREE.BufferGeometry[] = [];
  const tlW7Wood: THREE.BufferGeometry[] = [];
  const tlW7Bronze: THREE.BufferGeometry[] = [];
  const tlW7Gold: THREE.BufferGeometry[] = [];
  const tlW7Crimson: THREE.BufferGeometry[] = [];
  const tlW7Steel: THREE.BufferGeometry[] = [];
  const tlW7Glass: THREE.BufferGeometry[] = [];
  const tlW7Glow: THREE.BufferGeometry[] = [];

  // 2201-2230. Far-West 18 Hoàng Diệu Outer Archaeological Gallery Wing (-77.5, -74.0) & Stratigraphic Pit #2 (-77.5, -81.5)
  const ex7Y = ctx.getHeight(-77.5, -74.0);
  const st7Y = ctx.getHeight(-77.5, -81.5);
  tlW7Glass.push(
    makeBox(5.2, 0.14, 8.6, -77.5, ex7Y + 3.12, -74.0),
    makeBox(1.45, 0.82, 1.45, -77.5, ex7Y + 1.15, -74.0),
    makeBox(4.4, 0.14, 4.4, -77.5, st7Y + 2.65, -81.5)
  );
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-3.6, 0.0, 3.6]) {
      tlW7Steel.push(makeBox(0.12, 3.25, 0.12, -77.5 + dx, ex7Y + 1.52, -74.0 + dz));
    }
    for (const dz of [-1.8, 1.8]) {
      tlW7Steel.push(makeBox(0.10, 2.75, 0.10, -77.5 + dx * 0.85, st7Y + 1.28, -81.5 + dz));
    }
  }
  tlW7Relief.push(
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -77.5, ex7Y + 0.32, -71.5),
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -77.5, ex7Y + 0.32, -76.5),
    makeReliefBox(1.55, 0.72, 1.55, 'thanhHoaStone', -77.5, ex7Y + 0.36, -74.0),
    makeReliefBox(3.4, 0.58, 3.2, 'thangLongBrick', -77.5, st7Y + 0.29, -81.5),
    makeReliefBox(2.4, 0.42, 2.2, 'thanhHoaStone', -77.5, st7Y + 0.74, -81.5),
    makeReliefBox(0.42, 0.26, 12.0, 'thangLongBrick', -80.5, ex7Y + 0.13, -74.0),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -77.5, ctx.getHeight(-77.5, -65.5) + 0.17, -65.5),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -77.5, ctx.getHeight(-77.5, -87.5) + 0.17, -87.5),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', -78.5, ctx.getHeight(-78.5, -62.5) + 1.15, -62.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', -78.5, ctx.getHeight(-78.5, -62.5) + 2.42, -62.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thanhHoaStone', -74.5, ctx.getHeight(-74.5, -62.5) + 0.74, -62.5)
  );
  tlW7Wood.push(
    makeBox(0.68, 1.35, 1.45, -75.2, ex7Y + 0.68, -71.5),
    makeBox(0.68, 1.35, 1.45, -75.2, ex7Y + 0.68, -76.5),
    makeBox(1.15, 0.80, 0.68, -76.0, ctx.getHeight(-76.0, -62.5) + 0.40, -62.5),
    makeBox(0.85, 0.58, 0.85, -80.2, ctx.getHeight(-80.2, -62.5) + 0.29, -62.5)
  );
  tlW7Steel.push(
    makeBox(4.4, 0.78, 0.08, -77.5, st7Y + 0.39, -79.2),
    makeBox(4.4, 0.78, 0.08, -77.5, st7Y + 0.39, -83.8),
    makeBox(0.12, 1.12, 0.82, -74.8, ex7Y + 0.56, -74.0),
    makeBox(0.12, 1.12, 0.82, -74.8, st7Y + 0.56, -81.5)
  );
  tlW7Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, -74.5, ctx.getHeight(-74.5, -88.5) + 1.10, -88.5));
  tlW7Glow.push(makeBox(0.18, 0.20, 0.18, -77.2, ctx.getHeight(-78.5, -62.5) + 2.15, -62.5));
  for (const [fx, fz] of [[-75.0, -68.5], [-80.0, -68.5], [-75.0, -84.5], [-80.0, -84.5]] as const) {
    const fy7 = ctx.getHeight(fx, fz);
    tlW7Steel.push(makeCyl(0.05, 0.07, 2.45, 4, fx, fy7 + 1.22, fz));
    tlW7Glow.push(makeBox(0.18, 0.16, 0.18, fx, fy7 + 2.48, fz));
  }
  for (const bz of [-66.5, -78.5, -86.5]) {
    tlW7Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', -74.5, ctx.getHeight(-74.5, bz) + 0.21, bz));
  }
  for (const lz of [-69.5, -83.5]) {
    const ly7 = ctx.getHeight(-74.5, lz);
    tlW7Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', -74.5, ly7 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', -74.5, ly7 + 1.04, lz)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bz = -66.0 - i * 4.0;
    tlW7Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', -81.8, ctx.getHeight(-81.8, bz) + 0.33, bz));
  }

  // 2231-2255. Outer South Imperial Guard Avenue & Brick Bastion Walls (±35.5..40.2, -37..-47)
  for (const side of [-1, 1]) {
    const dx7 = side * 35.5;
    const d7Y = ctx.getHeight(dx7, -42.0);
    tlW7Relief.push(
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx7 - 0.32, d7Y + 0.14, -42.0),
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx7 + 0.32, d7Y + 0.14, -42.0),
      makeReliefBox(1.35, 0.16, 1.45, 'thanhHoaStone', dx7, d7Y + 0.28, -42.0),
      makeReliefBox(0.48, 0.95, 11.5, 'thangLongBrick', side * 38.5, ctx.getHeight(side * 38.5, -42.0) + 0.48, -42.0),
      makeReliefBox(0.88, 1.38, 0.22, 'thanhHoaStone', side * 33.8, ctx.getHeight(side * 33.8, -44.5) + 0.69, -44.5),
      makeReliefBox(1.95, 0.34, 1.15, 'thangLongBrick', side * 37.2, ctx.getHeight(side * 37.2, -42.0) + 0.17, -42.0)
    );
    tlW7Bronze.push(
      makeCyl(0.32, 0.24, 0.68, 4, side * 33.8, ctx.getHeight(side * 33.8, -38.5) + 0.34, -38.5),
      makeBox(0.22, 0.16, 0.22, dx7, d7Y + 0.08, -39.5),
      makeBox(0.22, 0.16, 0.22, dx7, d7Y + 0.08, -44.5)
    );
    for (const lz of [-37.0, -40.0, -43.0, -46.0]) {
      const ly7 = ctx.getHeight(side * 33.8, lz);
      tlW7Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, side * 33.8, ly7 + 1.40, lz));
      tlW7Glow.push(makeBox(0.22, 0.26, 0.22, side * 33.8, ly7 + 2.92, lz));
      tlW7Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 40.2, ctx.getHeight(side * 40.2, lz) + 0.33, lz));
    }
    for (const bz of [-39.0, -45.0]) {
      tlW7Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 37.2, ctx.getHeight(side * 37.2, bz) + 0.21, bz));
    }
    for (const uz of [-37.0, -47.0]) {
      tlW7Relief.push(makeReliefBox(0.56, 0.42, 0.56, 'thanhHoaStone', side * 36.8, ctx.getHeight(side * 36.8, uz) + 0.21, uz));
    }
    for (const fz of [-38.0, -46.0]) {
      const fy7 = ctx.getHeight(side * 39.5, fz);
      tlW7Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 39.5, fy7 + 1.72, fz));
      tlW7Gold.push(makeBox(0.05, 1.05, 0.46, side * 39.5, fy7 + 2.95, fz + 0.28));
    }

    // 2256-2275. Outer Kính Thiên East & West Royal Heritage Gardens (±40.5, -86.5)
    const kx7 = side * 40.5;
    const k7Y = ctx.getHeight(kx7, -86.5);
    tlW7Relief.push(
      makeReliefBox(4.0, 0.36, 4.0, 'thanhHoaStone', kx7, k7Y + 0.18, -86.5),
      makeReliefBox(4.6, 0.30, 4.6, 'terracottaHipRoof', kx7, k7Y + 2.94, -86.5),
      remapRelief(makeCyl(0.48, 0.30, 0.62, 4, kx7, k7Y + 0.66, -86.5), 'thanhHoaStone'),
      makeReliefBox(2.8, 1.55, 0.36, 'thanhHoaStone', kx7, ctx.getHeight(kx7, -92.5) + 0.78, -92.5),
      makeReliefBox(2.0, 0.34, 1.15, 'thangLongBrick', kx7, ctx.getHeight(kx7, -79.5) + 0.17, -79.5),
      makeReliefBox(0.24, 0.08, 10.0, 'thanhHoaStone', side * 42.8, k7Y + 0.04, -86.5),
      makeReliefBox(1.05, 0.22, 1.95, 'thanhHoaStone', side * 38.2, k7Y + 0.11, -86.5),
      makeReliefBox(0.86, 1.38, 0.22, 'thanhHoaStone', side * 38.5, ctx.getHeight(side * 38.5, -79.5) + 0.69, -79.5)
    );
    for (const dx2 of [-1.50, 1.50]) {
      for (const dz2 of [-1.50, 1.50]) {
        tlW7Crimson.push(makeCyl(0.09, 0.11, 2.70, 4, kx7 + dx2, k7Y + 1.50, -86.5 + dz2));
      }
    }
    tlW7Glow.push(makeBox(0.20, 0.24, 0.20, kx7, k7Y + 2.66, -86.5));
    tlW7Bronze.push(makeCyl(0.30, 0.22, 0.62, 4, side * 37.8, k7Y + 0.31, -86.5));
    for (const lz of [-81.5, -90.5]) {
      const ly7 = ctx.getHeight(kx7, lz);
      tlW7Relief.push(
        makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', kx7, ly7 + 0.48, lz),
        makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', kx7, ly7 + 1.04, lz)
      );
    }
    for (const bz of [-83.0, -90.0]) {
      tlW7Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 38.2, ctx.getHeight(side * 38.2, bz) + 0.21, bz));
    }
    for (const fz of [-82.0, -91.0]) {
      const fy7 = ctx.getHeight(side * 43.0, fz);
      tlW7Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 43.0, fy7 + 1.72, fz));
      tlW7Gold.push(makeBox(0.05, 1.05, 0.46, side * 43.0, fy7 + 2.95, fz + 0.28));
    }
    for (const cz2 of [-80.0, -93.0]) {
      tlW7Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 43.5, ctx.getHeight(side * 43.5, cz2) + 0.33, cz2));
    }
  }

  // 2276-2300. Far-East Cột Cờ Outer Bastion Garden (70.5..74.2, -67.5..-85.5) & Far-North Moat Esplanade (49.2..54.2, -96.5..-112.5)
  const rp7Y = ctx.getHeight(72.5, -76.0);
  tlW7Relief.push(
    makeReliefBox(0.65, 1.85, 16.0, 'thangLongBrick', 72.5, rp7Y + 0.92, -76.0),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', 72.5, ctx.getHeight(72.5, -85.5) + 1.15, -85.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', 72.5, ctx.getHeight(72.5, -85.5) + 2.42, -85.5),
    makeReliefBox(0.90, 1.48, 0.22, 'thanhHoaStone', 70.5, rp7Y + 0.74, -76.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 70.5, ctx.getHeight(70.5, -84.0) + 0.21, -84.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 70.5, ctx.getHeight(70.5, -68.8) + 0.21, -68.8),
    makeReliefBox(1.85, 0.18, 1.25, 'thanhHoaStone', 50.5, ctx.getHeight(50.5, -112.0) + 0.10, -112.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 52.2, ctx.getHeight(52.2, -98.0) + 0.17, -98.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 52.2, ctx.getHeight(52.2, -111.0) + 0.17, -111.0),
    remapRelief(makeCyl(0.48, 0.30, 0.60, 4, 53.5, ctx.getHeight(53.5, -104.5) + 0.30, -104.5), 'thanhHoaStone'),
    remapRelief(makeCyl(0.30, 0.22, 0.60, 4, 49.5, ctx.getHeight(49.5, -112.5) + 0.30, -112.5), 'thanhHoaStone'),
    makeReliefBox(0.24, 0.08, 12.0, 'thanhHoaStone', 53.5, ctx.getHeight(53.5, -104.5) + 0.04, -104.5)
  );
  tlW7Glow.push(makeBox(0.18, 0.22, 0.18, 71.2, ctx.getHeight(72.5, -85.5) + 2.15, -85.5));
  tlW7Wood.push(makeBox(1.30, 1.40, 0.50, 52.5, ctx.getHeight(52.5, -96.5) + 0.70, -96.5));
  tlW7Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, 49.5, ctx.getHeight(49.5, -97.0) + 1.10, -97.0));
  tlW7Gold.push(makeBox(0.76, 0.22, 0.08, 49.9, ctx.getHeight(49.5, -97.0) + 1.85, -97.0));
  for (const cz2 of [-70.5, -76.0, -81.5]) {
    const cy7 = ctx.getHeight(71.2, cz2);
    tlW7Bronze.push(
      makeCyl(0.14, 0.19, 2.05, 5, 71.2, cy7 + 0.76, cz2, 0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI * 0.25).translate(71.2, cy7 + 0.46, cz2 + 1.35)
    );
    tlW7Wood.push(makeBox(1.20, 0.44, 0.82, 71.2, cy7 + 0.46, cz2));
  }
  for (const lz of [-67.5, -73.2, -78.8]) {
    const ly7 = ctx.getHeight(70.5, lz);
    tlW7Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', 70.5, ly7 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', 70.5, ly7 + 1.04, lz)
    );
  }
  for (const fz of [-71.5, -80.5]) {
    const fy7 = ctx.getHeight(73.5, fz);
    tlW7Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, 73.5, fy7 + 1.72, fz));
    tlW7Gold.push(makeBox(0.05, 1.05, 0.46, 73.5, fy7 + 2.95, fz + 0.28));
  }
  for (const bz of [-69.0, -74.0, -79.0, -84.0]) {
    tlW7Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 74.2, ctx.getHeight(74.2, bz) + 0.33, bz));
  }
  for (const lz of [-99.0, -102.5, -106.0, -109.5]) {
    const ly7 = ctx.getHeight(50.5, lz);
    tlW7Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, 50.5, ly7 + 1.40, lz));
    tlW7Glow.push(makeBox(0.22, 0.26, 0.22, 50.5, ly7 + 2.92, lz));
    tlW7Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 54.2, ctx.getHeight(54.2, lz) + 0.33, lz));
  }
  for (const nz of [-100.5, -104.5, -108.5]) {
    tlW7Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 52.2, ctx.getHeight(52.2, nz) + 0.21, nz));
    tlW7Bronze.push(makeCyl(0.05, 0.08, 2.85, 4, 49.2, ctx.getHeight(49.2, nz) + 1.42, nz));
    tlW7Glow.push(makeBox(0.18, 0.20, 0.18, 49.2, ctx.getHeight(49.2, nz) + 2.95, nz));
  }

  addMerged(tlW7Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave7AtlasMesh', false, true);
  addMerged(tlW7Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave7Wood', false, true);
  addMerged(tlW7Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave7Bronze', false, true);
  addMerged(tlW7Gold, ctx.materials.gold, 'HoangThanhWave7Gold', false, false);
  addMerged(tlW7Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave7Crimson', false, true);
  addMerged(tlW7Steel, stainlessMat, 'HoangThanhWave7Steel', false, false);
  addMerged(tlW7Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave7Glass', false, false);
  addMerged(tlW7Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave7Glow', false, false);

  // =================================================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADE (Items 2601..2700 — castShadow = false, 0 new materials)
  // =================================================================================================
  const tlW8Relief: THREE.BufferGeometry[] = [];
  const tlW8Wood: THREE.BufferGeometry[] = [];
  const tlW8Bronze: THREE.BufferGeometry[] = [];
  const tlW8Gold: THREE.BufferGeometry[] = [];
  const tlW8Crimson: THREE.BufferGeometry[] = [];
  const tlW8Steel: THREE.BufferGeometry[] = [];
  const tlW8Glass: THREE.BufferGeometry[] = [];
  const tlW8Glow: THREE.BufferGeometry[] = [];

  // 2601-2630. Far-West 18 Hoàng Diệu Excavation Shelter #3 (-86.5, -74.0) & Stratigraphic Pit #3 (-86.5, -82.5)
  const ex8Y = ctx.getHeight(-86.5, -74.0);
  const st8Y = ctx.getHeight(-86.5, -82.5);
  tlW8Glass.push(
    makeBox(5.2, 0.14, 8.6, -86.5, ex8Y + 3.12, -74.0),
    makeBox(1.45, 0.82, 1.45, -86.5, ex8Y + 1.15, -74.0),
    makeBox(4.4, 0.14, 4.4, -86.5, st8Y + 2.65, -82.5)
  );
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-3.6, 0.0, 3.6]) {
      tlW8Steel.push(makeBox(0.12, 3.25, 0.12, -86.5 + dx, ex8Y + 1.52, -74.0 + dz));
    }
    for (const dz of [-1.8, 1.8]) {
      tlW8Steel.push(makeBox(0.10, 2.75, 0.10, -86.5 + dx * 0.85, st8Y + 1.28, -82.5 + dz));
    }
  }
  tlW8Relief.push(
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -86.5, ex8Y + 0.32, -71.5),
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -86.5, ex8Y + 0.32, -76.5),
    makeReliefBox(1.55, 0.72, 1.55, 'thanhHoaStone', -86.5, ex8Y + 0.36, -74.0),
    makeReliefBox(3.4, 0.58, 3.2, 'thangLongBrick', -86.5, st8Y + 0.29, -82.5),
    makeReliefBox(2.4, 0.42, 2.2, 'thanhHoaStone', -86.5, st8Y + 0.74, -82.5),
    makeReliefBox(0.42, 0.26, 12.0, 'thangLongBrick', -89.5, ex8Y + 0.13, -74.0),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -86.5, ctx.getHeight(-86.5, -65.5) + 0.17, -65.5),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -86.5, ctx.getHeight(-86.5, -87.5) + 0.17, -87.5),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', -87.5, ctx.getHeight(-87.5, -62.5) + 1.15, -62.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', -87.5, ctx.getHeight(-87.5, -62.5) + 2.42, -62.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thanhHoaStone', -83.5, ctx.getHeight(-83.5, -62.5) + 0.74, -62.5)
  );
  tlW8Wood.push(
    makeBox(0.68, 1.35, 1.45, -84.2, ex8Y + 0.68, -71.5),
    makeBox(0.68, 1.35, 1.45, -84.2, ex8Y + 0.68, -76.5),
    makeBox(1.15, 0.80, 0.68, -85.0, ctx.getHeight(-85.0, -62.5) + 0.40, -62.5),
    makeBox(0.85, 0.58, 0.85, -89.2, ctx.getHeight(-89.2, -62.5) + 0.29, -62.5)
  );
  tlW8Steel.push(
    makeBox(4.4, 0.78, 0.08, -86.5, st8Y + 0.39, -80.2),
    makeBox(4.4, 0.78, 0.08, -86.5, st8Y + 0.39, -84.8),
    makeBox(0.12, 1.12, 0.82, -83.8, ex8Y + 0.56, -74.0),
    makeBox(0.12, 1.12, 0.82, -83.8, st8Y + 0.56, -82.5)
  );
  tlW8Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, -83.5, ctx.getHeight(-83.5, -89.5) + 1.10, -89.5));
  tlW8Glow.push(makeBox(0.18, 0.20, 0.18, -86.2, ctx.getHeight(-87.5, -62.5) + 2.15, -62.5));
  for (const [fx, fz] of [[-84.0, -68.5], [-89.0, -68.5], [-84.0, -85.5], [-89.0, -85.5]] as const) {
    const fy8 = ctx.getHeight(fx, fz);
    tlW8Steel.push(makeCyl(0.05, 0.07, 2.45, 4, fx, fy8 + 1.22, fz));
    tlW8Glow.push(makeBox(0.18, 0.16, 0.18, fx, fy8 + 2.48, fz));
  }
  for (const bz of [-66.5, -78.5, -86.5]) {
    tlW8Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', -83.5, ctx.getHeight(-83.5, bz) + 0.21, bz));
  }
  for (const lz of [-69.5, -83.5]) {
    const ly8 = ctx.getHeight(-83.5, lz);
    tlW8Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', -83.5, ly8 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', -83.5, ly8 + 1.04, lz)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bz = -66.0 - i * 4.0;
    tlW8Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', -90.8, ctx.getHeight(-90.8, bz) + 0.33, bz));
  }

  // 2631-2655. Outer South Imperial Guard Promenade & Vauban Brick Bastion Spur (±44.5..49.2, -37..-47)
  for (const side of [-1, 1]) {
    const dx8 = side * 44.5;
    const d8Y = ctx.getHeight(dx8, -42.0);
    tlW8Relief.push(
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx8 - 0.32, d8Y + 0.14, -42.0),
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx8 + 0.32, d8Y + 0.14, -42.0),
      makeReliefBox(1.35, 0.16, 1.45, 'thanhHoaStone', dx8, d8Y + 0.28, -42.0),
      makeReliefBox(0.48, 0.95, 11.5, 'thangLongBrick', side * 47.5, ctx.getHeight(side * 47.5, -42.0) + 0.48, -42.0),
      makeReliefBox(0.88, 1.38, 0.22, 'thanhHoaStone', side * 42.8, ctx.getHeight(side * 42.8, -44.5) + 0.69, -44.5),
      makeReliefBox(1.95, 0.34, 1.15, 'thangLongBrick', side * 46.2, ctx.getHeight(side * 46.2, -42.0) + 0.17, -42.0)
    );
    tlW8Bronze.push(
      makeCyl(0.32, 0.24, 0.68, 4, side * 42.8, ctx.getHeight(side * 42.8, -38.5) + 0.34, -38.5),
      makeBox(0.22, 0.16, 0.22, dx8, d8Y + 0.08, -39.5),
      makeBox(0.22, 0.16, 0.22, dx8, d8Y + 0.08, -44.5)
    );
    for (const lz of [-37.0, -40.0, -43.0, -46.0]) {
      const ly8 = ctx.getHeight(side * 42.8, lz);
      tlW8Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, side * 42.8, ly8 + 1.40, lz));
      tlW8Glow.push(makeBox(0.22, 0.26, 0.22, side * 42.8, ly8 + 2.92, lz));
      tlW8Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 49.2, ctx.getHeight(side * 49.2, lz) + 0.33, lz));
    }
    for (const bz of [-39.0, -45.0]) {
      tlW8Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 46.2, ctx.getHeight(side * 46.2, bz) + 0.21, bz));
    }
    for (const uz of [-37.0, -47.0]) {
      tlW8Relief.push(makeReliefBox(0.56, 0.42, 0.56, 'thanhHoaStone', side * 45.8, ctx.getHeight(side * 45.8, uz) + 0.21, uz));
    }
    for (const fz of [-38.0, -46.0]) {
      const fy8 = ctx.getHeight(side * 48.5, fz);
      tlW8Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 48.5, fy8 + 1.72, fz));
      tlW8Gold.push(makeBox(0.05, 1.05, 0.46, side * 48.5, fy8 + 2.95, fz + 0.28));
    }

    // 2656-2675. Outer Kính Thiên East & West Imperial Pavilion Gardens (±48.5, -86.5)
    const kx8 = side * 48.5;
    const k8Y = ctx.getHeight(kx8, -86.5);
    tlW8Relief.push(
      makeReliefBox(4.0, 0.36, 4.0, 'thanhHoaStone', kx8, k8Y + 0.18, -86.5),
      makeReliefBox(4.6, 0.30, 4.6, 'terracottaHipRoof', kx8, k8Y + 2.94, -86.5),
      remapRelief(makeCyl(0.48, 0.30, 0.62, 4, kx8, k8Y + 0.66, -86.5), 'thanhHoaStone'),
      makeReliefBox(2.8, 1.55, 0.36, 'thanhHoaStone', kx8, ctx.getHeight(kx8, -92.5) + 0.78, -92.5),
      makeReliefBox(2.0, 0.34, 1.15, 'thangLongBrick', kx8, ctx.getHeight(kx8, -79.5) + 0.17, -79.5),
      makeReliefBox(0.24, 0.08, 10.0, 'thanhHoaStone', side * 50.8, k8Y + 0.04, -86.5),
      makeReliefBox(1.05, 0.22, 1.95, 'thanhHoaStone', side * 46.2, k8Y + 0.11, -86.5),
      makeReliefBox(0.86, 1.38, 0.22, 'thanhHoaStone', side * 46.5, ctx.getHeight(side * 46.5, -79.5) + 0.69, -79.5)
    );
    for (const dx2 of [-1.50, 1.50]) {
      for (const dz2 of [-1.50, 1.50]) {
        tlW8Crimson.push(makeCyl(0.09, 0.11, 2.70, 4, kx8 + dx2, k8Y + 1.50, -86.5 + dz2));
      }
    }
    tlW8Glow.push(makeBox(0.20, 0.24, 0.20, kx8, k8Y + 2.66, -86.5));
    tlW8Bronze.push(makeCyl(0.30, 0.22, 0.62, 4, side * 45.8, k8Y + 0.31, -86.5));
    for (const lz of [-81.5, -90.5]) {
      const ly8 = ctx.getHeight(kx8, lz);
      tlW8Relief.push(
        makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', kx8, ly8 + 0.48, lz),
        makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', kx8, ly8 + 1.04, lz)
      );
    }
    for (const bz of [-83.0, -90.0]) {
      tlW8Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 46.2, ctx.getHeight(side * 46.2, bz) + 0.21, bz));
    }
    for (const fz of [-82.0, -91.0]) {
      const fy8 = ctx.getHeight(side * 51.0, fz);
      tlW8Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 51.0, fy8 + 1.72, fz));
      tlW8Gold.push(makeBox(0.05, 1.05, 0.46, side * 51.0, fy8 + 2.95, fz + 0.28));
    }
    for (const cz2 of [-80.0, -93.0]) {
      tlW8Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 51.5, ctx.getHeight(side * 51.5, cz2) + 0.33, cz2));
    }
  }

  // 2676-2700. Far-East Cột Cờ Outer Bastion Artillery Garden (78.5..82.2, -67.5..-85.5) & Far-North Moat Esplanade Wing (58.2..63.2, -96.5..-112.5)
  const rp8Y = ctx.getHeight(80.5, -76.0);
  tlW8Relief.push(
    makeReliefBox(0.65, 1.85, 16.0, 'thangLongBrick', 80.5, rp8Y + 0.92, -76.0),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', 80.5, ctx.getHeight(80.5, -85.5) + 1.15, -85.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', 80.5, ctx.getHeight(80.5, -85.5) + 2.42, -85.5),
    makeReliefBox(0.90, 1.48, 0.22, 'thanhHoaStone', 78.5, rp8Y + 0.74, -76.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 78.5, ctx.getHeight(78.5, -84.0) + 0.21, -84.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 78.5, ctx.getHeight(78.5, -68.8) + 0.21, -68.8),
    makeReliefBox(1.85, 0.18, 1.25, 'thanhHoaStone', 59.5, ctx.getHeight(59.5, -112.0) + 0.10, -112.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 61.2, ctx.getHeight(61.2, -98.0) + 0.17, -98.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 61.2, ctx.getHeight(61.2, -111.0) + 0.17, -111.0),
    remapRelief(makeCyl(0.48, 0.30, 0.60, 4, 62.5, ctx.getHeight(62.5, -104.5) + 0.30, -104.5), 'thanhHoaStone'),
    remapRelief(makeCyl(0.30, 0.22, 0.60, 4, 58.5, ctx.getHeight(58.5, -112.5) + 0.30, -112.5), 'thanhHoaStone'),
    makeReliefBox(0.24, 0.08, 12.0, 'thanhHoaStone', 62.5, ctx.getHeight(62.5, -104.5) + 0.04, -104.5)
  );
  tlW8Glow.push(makeBox(0.18, 0.22, 0.18, 79.2, ctx.getHeight(80.5, -85.5) + 2.15, -85.5));
  tlW8Wood.push(makeBox(1.30, 1.40, 0.50, 61.5, ctx.getHeight(61.5, -96.5) + 0.70, -96.5));
  tlW8Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, 58.5, ctx.getHeight(58.5, -97.0) + 1.10, -97.0));
  tlW8Gold.push(makeBox(0.76, 0.22, 0.08, 58.9, ctx.getHeight(58.5, -97.0) + 1.85, -97.0));
  for (const cz2 of [-70.5, -76.0, -81.5]) {
    const cy8 = ctx.getHeight(79.2, cz2);
    tlW8Bronze.push(
      makeCyl(0.14, 0.19, 2.05, 5, 79.2, cy8 + 0.76, cz2, 0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI * 0.25).translate(79.2, cy8 + 0.46, cz2 + 1.35)
    );
    tlW8Wood.push(makeBox(1.20, 0.44, 0.82, 79.2, cy8 + 0.46, cz2));
  }
  for (const lz of [-67.5, -73.2, -78.8]) {
    const ly8 = ctx.getHeight(78.5, lz);
    tlW8Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', 78.5, ly8 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', 78.5, ly8 + 1.04, lz)
    );
  }
  for (const fz of [-71.5, -80.5]) {
    const fy8 = ctx.getHeight(81.5, fz);
    tlW8Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, 81.5, fy8 + 1.72, fz));
    tlW8Gold.push(makeBox(0.05, 1.05, 0.46, 81.5, fy8 + 2.95, fz + 0.28));
  }
  for (const bz of [-69.0, -74.0, -79.0, -84.0]) {
    tlW8Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 82.2, ctx.getHeight(82.2, bz) + 0.33, bz));
  }
  for (const lz of [-99.0, -102.5, -106.0, -109.5]) {
    const ly8 = ctx.getHeight(59.5, lz);
    tlW8Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, 59.5, ly8 + 1.40, lz));
    tlW8Glow.push(makeBox(0.22, 0.26, 0.22, 59.5, ly8 + 2.92, lz));
    tlW8Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 63.2, ctx.getHeight(63.2, lz) + 0.33, lz));
  }
  for (const nz of [-100.5, -104.5, -108.5]) {
    tlW8Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 61.2, ctx.getHeight(61.2, nz) + 0.21, nz));
    tlW8Bronze.push(makeCyl(0.05, 0.08, 2.85, 4, 58.2, ctx.getHeight(58.2, nz) + 1.42, nz));
    tlW8Glow.push(makeBox(0.18, 0.20, 0.18, 58.2, ctx.getHeight(58.2, nz) + 2.95, nz));
  }

  addMerged(tlW8Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave8AtlasMesh', false, true);
  addMerged(tlW8Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave8Wood', false, true);
  addMerged(tlW8Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave8Bronze', false, true);
  addMerged(tlW8Gold, ctx.materials.gold, 'HoangThanhWave8Gold', false, false);
  addMerged(tlW8Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave8Crimson', false, true);
  addMerged(tlW8Steel, stainlessMat, 'HoangThanhWave8Steel', false, false);
  addMerged(tlW8Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave8Glass', false, false);
  addMerged(tlW8Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave8Glow', false, false);

  // =================================================================================================
  // WAVE 9 REAL-PHOTO VISUAL QC UPGRADE (Items 3001..3100 — castShadow = false, 0 new materials)
  // =================================================================================================
  const tlW9Relief: THREE.BufferGeometry[] = [];
  const tlW9Wood: THREE.BufferGeometry[] = [];
  const tlW9Bronze: THREE.BufferGeometry[] = [];
  const tlW9Gold: THREE.BufferGeometry[] = [];
  const tlW9Crimson: THREE.BufferGeometry[] = [];
  const tlW9Steel: THREE.BufferGeometry[] = [];
  const tlW9Glass: THREE.BufferGeometry[] = [];
  const tlW9Glow: THREE.BufferGeometry[] = [];

  // 3001-3030. Far-West 18 Hoàng Diệu Excavation Shelter #4 (-96.5, -74.0) & Stratigraphic Pit #4 (-96.5, -82.5)
  const ex9Y = ctx.getHeight(-96.5, -74.0);
  const st9Y = ctx.getHeight(-96.5, -82.5);
  tlW9Glass.push(
    makeBox(5.2, 0.14, 8.6, -96.5, ex9Y + 3.12, -74.0),
    makeBox(1.45, 0.82, 1.45, -96.5, ex9Y + 1.15, -74.0),
    makeBox(4.4, 0.14, 4.4, -96.5, st9Y + 2.65, -82.5)
  );
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-3.6, 0.0, 3.6]) {
      tlW9Steel.push(makeBox(0.12, 3.25, 0.12, -96.5 + dx, ex9Y + 1.48, -74.0 + dz));
    }
    for (const dz of [-1.8, 1.8]) {
      tlW9Steel.push(makeBox(0.10, 2.75, 0.10, -96.5 + dx * 0.85, st9Y + 1.24, -82.5 + dz));
    }
  }
  tlW9Relief.push(
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -96.5, ex9Y + 0.32, -71.5),
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -96.5, ex9Y + 0.32, -76.5),
    makeReliefBox(1.55, 0.72, 1.55, 'thanhHoaStone', -96.5, ex9Y + 0.36, -74.0),
    makeReliefBox(3.4, 0.58, 3.2, 'thangLongBrick', -96.5, st9Y + 0.29, -82.5),
    makeReliefBox(2.4, 0.42, 2.2, 'thanhHoaStone', -96.5, st9Y + 0.74, -82.5),
    makeReliefBox(0.42, 0.26, 12.0, 'thangLongBrick', -99.5, ex9Y + 0.13, -74.0),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -96.5, ctx.getHeight(-96.5, -65.5) + 0.17, -65.5),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -96.5, ctx.getHeight(-96.5, -87.5) + 0.17, -87.5),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', -97.5, ctx.getHeight(-97.5, -62.5) + 1.15, -62.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', -97.5, ctx.getHeight(-97.5, -62.5) + 2.42, -62.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thanhHoaStone', -93.5, ctx.getHeight(-93.5, -62.5) + 0.74, -62.5)
  );
  tlW9Wood.push(
    makeBox(0.68, 1.35, 1.45, -94.2, ex9Y + 0.68, -71.5),
    makeBox(0.68, 1.35, 1.45, -94.2, ex9Y + 0.68, -76.5),
    makeBox(1.15, 0.80, 0.68, -95.0, ctx.getHeight(-95.0, -62.5) + 0.40, -62.5),
    makeBox(0.85, 0.58, 0.85, -99.2, ctx.getHeight(-99.2, -62.5) + 0.29, -62.5)
  );
  tlW9Steel.push(
    makeBox(4.4, 0.78, 0.08, -96.5, st9Y + 0.39, -80.2),
    makeBox(4.4, 0.78, 0.08, -96.5, st9Y + 0.39, -84.8),
    makeBox(0.12, 1.12, 0.82, -93.8, ex9Y + 0.56, -74.0),
    makeBox(0.12, 1.12, 0.82, -93.8, st9Y + 0.56, -82.5)
  );
  tlW9Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, -93.5, ctx.getHeight(-93.5, -89.5) + 0.98, -89.5));
  tlW9Glow.push(makeBox(0.18, 0.20, 0.18, -96.2, ctx.getHeight(-97.5, -62.5) + 2.15, -62.5));
  for (const [fx, fz] of [[-94.0, -68.5], [-99.0, -68.5], [-94.0, -85.5], [-99.0, -85.5]] as const) {
    const fy9 = ctx.getHeight(fx, fz);
    tlW9Steel.push(makeCyl(0.05, 0.07, 2.45, 4, fx, fy9 + 1.10, fz));
    tlW9Glow.push(makeBox(0.18, 0.16, 0.18, fx, fy9 + 2.40, fz));
  }
  for (const bz of [-66.5, -78.5, -86.5]) {
    tlW9Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', -93.5, ctx.getHeight(-93.5, bz) + 0.21, bz));
  }
  for (const lz of [-69.5, -83.5]) {
    const ly9 = ctx.getHeight(-93.5, lz);
    tlW9Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', -93.5, ly9 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', -93.5, ly9 + 1.04, lz)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bz = -66.0 - i * 4.0;
    tlW9Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', -100.8, ctx.getHeight(-100.8, bz) + 0.33, bz));
  }

  // 3031-3055. Far-Outer South Imperial Bastion Garden & Vauban Brick Spur (±53.5..58.2, -37..-47)
  for (const side of [-1, 1]) {
    const dx9 = side * 53.5;
    const d9Y = ctx.getHeight(dx9, -42.0);
    tlW9Relief.push(
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx9 - 0.32, d9Y + 0.14, -42.0),
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx9 + 0.32, d9Y + 0.14, -42.0),
      makeReliefBox(1.35, 0.16, 1.45, 'thanhHoaStone', dx9, d9Y + 0.28, -42.0),
      makeReliefBox(0.48, 0.95, 11.5, 'thangLongBrick', side * 56.5, ctx.getHeight(side * 56.5, -42.0) + 0.48, -42.0),
      makeReliefBox(0.88, 1.38, 0.22, 'thanhHoaStone', side * 51.8, ctx.getHeight(side * 51.8, -44.5) + 0.69, -44.5),
      makeReliefBox(1.95, 0.34, 1.15, 'thangLongBrick', side * 55.2, ctx.getHeight(side * 55.2, -42.0) + 0.17, -42.0)
    );
    tlW9Bronze.push(
      makeCyl(0.32, 0.24, 0.68, 4, side * 51.8, ctx.getHeight(side * 51.8, -38.5) + 0.34, -38.5),
      makeBox(0.22, 0.16, 0.22, dx9, d9Y + 0.08, -39.5),
      makeBox(0.22, 0.16, 0.22, dx9, d9Y + 0.08, -44.5)
    );
    for (const lz of [-37.0, -40.0, -43.0, -46.0]) {
      const ly9 = ctx.getHeight(side * 51.8, lz);
      tlW9Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, side * 51.8, ly9 + 1.35, lz));
      tlW9Glow.push(makeBox(0.22, 0.26, 0.22, side * 51.8, ly9 + 2.92, lz));
      tlW9Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 58.2, ctx.getHeight(side * 58.2, lz) + 0.33, lz));
    }
    for (const bz of [-39.0, -45.0]) {
      tlW9Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 55.2, ctx.getHeight(side * 55.2, bz) + 0.21, bz));
    }
    for (const uz of [-37.0, -47.0]) {
      tlW9Relief.push(makeReliefBox(0.56, 0.42, 0.56, 'thanhHoaStone', side * 54.8, ctx.getHeight(side * 54.8, uz) + 0.21, uz));
    }
    for (const fz of [-38.0, -46.0]) {
      const fy9 = ctx.getHeight(side * 57.5, fz);
      tlW9Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 57.5, fy9 + 1.65, fz));
      tlW9Gold.push(makeBox(0.05, 1.05, 0.46, side * 57.5, fy9 + 2.95, fz + 0.28));
    }

    // 3056-3075. Far-Outer Kính Thiên East & West Royal Lotus Gardens (±56.5, -86.5)
    const kx9 = side * 56.5;
    const k9Y = ctx.getHeight(kx9, -86.5);
    tlW9Relief.push(
      makeReliefBox(4.0, 0.36, 4.0, 'thanhHoaStone', kx9, k9Y + 0.18, -86.5),
      makeReliefBox(4.6, 0.30, 4.6, 'terracottaHipRoof', kx9, k9Y + 2.94, -86.5),
      remapRelief(makeCyl(0.48, 0.30, 0.62, 4, kx9, k9Y + 0.66, -86.5), 'thanhHoaStone'),
      makeReliefBox(2.8, 1.55, 0.36, 'thanhHoaStone', kx9, ctx.getHeight(kx9, -92.5) + 0.78, -92.5),
      makeReliefBox(2.0, 0.34, 1.15, 'thangLongBrick', kx9, ctx.getHeight(kx9, -79.5) + 0.17, -79.5),
      makeReliefBox(0.24, 0.08, 10.0, 'thanhHoaStone', side * 58.8, k9Y + 0.04, -86.5),
      makeReliefBox(1.05, 0.22, 1.95, 'thanhHoaStone', side * 54.2, k9Y + 0.11, -86.5),
      makeReliefBox(0.86, 1.38, 0.22, 'thanhHoaStone', side * 54.5, ctx.getHeight(side * 54.5, -79.5) + 0.69, -79.5)
    );
    for (const dx2 of [-1.50, 1.50]) {
      for (const dz2 of [-1.50, 1.50]) {
        tlW9Crimson.push(makeCyl(0.09, 0.11, 2.70, 4, kx9 + dx2, k9Y + 1.48, -86.5 + dz2));
      }
    }
    tlW9Glow.push(makeBox(0.20, 0.24, 0.20, kx9, k9Y + 2.66, -86.5));
    tlW9Bronze.push(makeCyl(0.30, 0.22, 0.62, 4, side * 53.8, k9Y + 0.31, -86.5));
    for (const lz of [-81.5, -90.5]) {
      const ly9 = ctx.getHeight(kx9, lz);
      tlW9Relief.push(
        makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', kx9, ly9 + 0.48, lz),
        makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', kx9, ly9 + 1.04, lz)
      );
    }
    for (const bz of [-83.0, -90.0]) {
      tlW9Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 54.2, ctx.getHeight(side * 54.2, bz) + 0.21, bz));
    }
    for (const fz of [-82.0, -91.0]) {
      const fy9 = ctx.getHeight(side * 59.0, fz);
      tlW9Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 59.0, fy9 + 1.65, fz));
      tlW9Gold.push(makeBox(0.05, 1.05, 0.46, side * 59.0, fy9 + 2.95, fz + 0.28));
    }
    for (const cz2 of [-80.0, -93.0]) {
      tlW9Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 59.5, ctx.getHeight(side * 59.5, cz2) + 0.33, cz2));
    }
  }

  // 3076-3100. Far-East Cột Cờ Outer Bastion Guard Terrace (86.5..90.2, -67.5..-85.5) & Far-North Moat Esplanade East Wing (67.2..72.2, -96.5..-112.5)
  const rp9Y = ctx.getHeight(88.5, -76.0);
  tlW9Relief.push(
    makeReliefBox(0.65, 1.85, 16.0, 'thangLongBrick', 88.5, rp9Y + 0.92, -76.0),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', 88.5, ctx.getHeight(88.5, -85.5) + 1.15, -85.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', 88.5, ctx.getHeight(88.5, -85.5) + 2.42, -85.5),
    makeReliefBox(0.90, 1.48, 0.22, 'thanhHoaStone', 86.5, rp9Y + 0.74, -76.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 86.5, ctx.getHeight(86.5, -84.0) + 0.21, -84.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 86.5, ctx.getHeight(86.5, -68.8) + 0.21, -68.8),
    makeReliefBox(1.85, 0.18, 1.25, 'thanhHoaStone', 68.5, ctx.getHeight(68.5, -112.0) + 0.10, -112.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 70.2, ctx.getHeight(70.2, -98.0) + 0.17, -98.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 70.2, ctx.getHeight(70.2, -111.0) + 0.17, -111.0),
    remapRelief(makeCyl(0.48, 0.30, 0.60, 4, 71.5, ctx.getHeight(71.5, -104.5) + 0.30, -104.5), 'thanhHoaStone'),
    remapRelief(makeCyl(0.30, 0.22, 0.60, 4, 67.5, ctx.getHeight(67.5, -112.5) + 0.30, -112.5), 'thanhHoaStone'),
    makeReliefBox(0.24, 0.08, 12.0, 'thanhHoaStone', 71.5, ctx.getHeight(71.5, -104.5) + 0.04, -104.5)
  );
  tlW9Glow.push(makeBox(0.18, 0.22, 0.18, 87.2, ctx.getHeight(88.5, -85.5) + 2.15, -85.5));
  tlW9Wood.push(makeBox(1.30, 1.40, 0.50, 70.5, ctx.getHeight(70.5, -96.5) + 0.70, -96.5));
  tlW9Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, 67.5, ctx.getHeight(67.5, -97.0) + 0.98, -97.0));
  tlW9Gold.push(makeBox(0.76, 0.22, 0.08, 67.9, ctx.getHeight(67.5, -97.0) + 1.85, -97.0));
  for (const cz2 of [-70.5, -76.0, -81.5]) {
    const cy9 = ctx.getHeight(87.2, cz2);
    tlW9Bronze.push(
      makeCyl(0.14, 0.19, 2.05, 5, 87.2, cy9 + 0.76, cz2, 0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI * 0.25).translate(87.2, cy9 + 0.46, cz2 + 1.35)
    );
    tlW9Wood.push(makeBox(1.20, 0.44, 0.82, 87.2, cy9 + 0.46, cz2));
  }
  for (const lz of [-67.5, -73.2, -78.8]) {
    const ly9 = ctx.getHeight(86.5, lz);
    tlW9Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', 86.5, ly9 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', 86.5, ly9 + 1.04, lz)
    );
  }
  for (const fz of [-71.5, -80.5]) {
    const fy9 = ctx.getHeight(89.5, fz);
    tlW9Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, 89.5, fy9 + 1.65, fz));
    tlW9Gold.push(makeBox(0.05, 1.05, 0.46, 89.5, fy9 + 2.95, fz + 0.28));
  }
  for (const bz of [-69.0, -74.0, -79.0, -84.0]) {
    tlW9Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 90.2, ctx.getHeight(90.2, bz) + 0.33, bz));
  }
  for (const lz of [-99.0, -102.5, -106.0, -109.5]) {
    const ly9 = ctx.getHeight(68.5, lz);
    tlW9Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, 68.5, ly9 + 1.35, lz));
    tlW9Glow.push(makeBox(0.22, 0.26, 0.22, 68.5, ly9 + 2.92, lz));
    tlW9Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 72.2, ctx.getHeight(72.2, lz) + 0.33, lz));
  }
  for (const nz of [-100.5, -104.5, -108.5]) {
    tlW9Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 70.2, ctx.getHeight(70.2, nz) + 0.21, nz));
    tlW9Bronze.push(makeCyl(0.05, 0.08, 2.85, 4, 67.2, ctx.getHeight(67.2, nz) + 1.30, nz));
    tlW9Glow.push(makeBox(0.18, 0.20, 0.18, 67.2, ctx.getHeight(67.2, nz) + 2.88, nz));
  }

  addMerged(tlW9Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave9AtlasMesh', false, true);
  addMerged(tlW9Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave9Wood', false, true);
  addMerged(tlW9Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave9Bronze', false, true);
  addMerged(tlW9Gold, ctx.materials.gold, 'HoangThanhWave9Gold', false, false);
  addMerged(tlW9Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave9Crimson', false, true);
  addMerged(tlW9Steel, stainlessMat, 'HoangThanhWave9Steel', false, false);
  addMerged(tlW9Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave9Glass', false, false);
  addMerged(tlW9Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave9Glow', false, false);

  // =================================================================================================
  // WAVE 10 REAL-PHOTO VISUAL QC UPGRADE (Items 3401..3500 — castShadow = false, 0 new materials)
  // =================================================================================================
  const tlW10Relief: THREE.BufferGeometry[] = [];
  const tlW10Wood: THREE.BufferGeometry[] = [];
  const tlW10Bronze: THREE.BufferGeometry[] = [];
  const tlW10Gold: THREE.BufferGeometry[] = [];
  const tlW10Crimson: THREE.BufferGeometry[] = [];
  const tlW10Steel: THREE.BufferGeometry[] = [];
  const tlW10Glass: THREE.BufferGeometry[] = [];
  const tlW10Glow: THREE.BufferGeometry[] = [];

  // 3401-3430. Far-West 18 Hoàng Diệu Excavation Shelter #5 (-106.5, -74.0) & Stratigraphic Pit #5 (-106.5, -82.5)
  const ex10Y = ctx.getHeight(-106.5, -74.0);
  const st10Y = ctx.getHeight(-106.5, -82.5);
  tlW10Glass.push(
    makeBox(5.2, 0.14, 8.6, -106.5, ex10Y + 3.12, -74.0),
    makeBox(1.45, 0.82, 1.45, -106.5, ex10Y + 1.15, -74.0),
    makeBox(4.4, 0.14, 4.4, -106.5, st10Y + 2.65, -82.5)
  );
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-3.6, 0.0, 3.6]) {
      tlW10Steel.push(makeBox(0.12, 3.25, 0.12, -106.5 + dx, ex10Y + 1.48, -74.0 + dz));
    }
    for (const dz of [-1.8, 1.8]) {
      tlW10Steel.push(makeBox(0.10, 2.75, 0.10, -106.5 + dx * 0.85, st10Y + 1.24, -82.5 + dz));
    }
  }
  tlW10Relief.push(
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -106.5, ex10Y + 0.32, -71.5),
    makeReliefBox(1.15, 0.65, 1.15, 'thanhHoaStone', -106.5, ex10Y + 0.32, -76.5),
    makeReliefBox(1.55, 0.72, 1.55, 'thanhHoaStone', -106.5, ex10Y + 0.36, -74.0),
    makeReliefBox(3.4, 0.58, 3.2, 'thangLongBrick', -106.5, st10Y + 0.29, -82.5),
    makeReliefBox(2.4, 0.42, 2.2, 'thanhHoaStone', -106.5, st10Y + 0.74, -82.5),
    makeReliefBox(0.42, 0.26, 12.0, 'thangLongBrick', -109.5, ex10Y + 0.13, -74.0),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -106.5, ctx.getHeight(-106.5, -65.5) + 0.17, -65.5),
    makeReliefBox(2.2, 0.34, 1.15, 'thangLongBrick', -106.5, ctx.getHeight(-106.5, -87.5) + 0.17, -87.5),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', -107.5, ctx.getHeight(-107.5, -62.5) + 1.15, -62.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', -107.5, ctx.getHeight(-107.5, -62.5) + 2.42, -62.5),
    makeReliefBox(0.92, 1.48, 0.22, 'thanhHoaStone', -103.5, ctx.getHeight(-103.5, -62.5) + 0.74, -62.5)
  );
  tlW10Wood.push(
    makeBox(0.68, 1.35, 1.45, -104.2, ex10Y + 0.68, -71.5),
    makeBox(0.68, 1.35, 1.45, -104.2, ex10Y + 0.68, -76.5),
    makeBox(1.15, 0.80, 0.68, -105.0, ctx.getHeight(-105.0, -62.5) + 0.40, -62.5),
    makeBox(0.85, 0.58, 0.85, -109.2, ctx.getHeight(-109.2, -62.5) + 0.29, -62.5)
  );
  tlW10Steel.push(
    makeBox(4.4, 0.78, 0.08, -106.5, st10Y + 0.39, -80.2),
    makeBox(4.4, 0.78, 0.08, -106.5, st10Y + 0.39, -84.8),
    makeBox(0.12, 1.12, 0.82, -103.8, ex10Y + 0.56, -74.0),
    makeBox(0.12, 1.12, 0.82, -103.8, st10Y + 0.56, -82.5)
  );
  tlW10Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, -103.5, ctx.getHeight(-103.5, -89.5) + 0.98, -89.5));
  tlW10Glow.push(makeBox(0.18, 0.20, 0.18, -106.2, ctx.getHeight(-107.5, -62.5) + 2.15, -62.5));
  for (const [fx, fz] of [[-104.0, -68.5], [-109.0, -68.5], [-104.0, -85.5], [-109.0, -85.5]] as const) {
    const fy10 = ctx.getHeight(fx, fz);
    tlW10Steel.push(makeCyl(0.05, 0.07, 2.45, 4, fx, fy10 + 1.10, fz));
    tlW10Glow.push(makeBox(0.18, 0.16, 0.18, fx, fy10 + 2.40, fz));
  }
  for (const bz of [-66.5, -78.5, -86.5]) {
    tlW10Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', -103.5, ctx.getHeight(-103.5, bz) + 0.21, bz));
  }
  for (const lz of [-69.5, -83.5]) {
    const ly10 = ctx.getHeight(-103.5, lz);
    tlW10Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', -103.5, ly10 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', -103.5, ly10 + 1.04, lz)
    );
  }
  for (let i = 0; i < 6; i++) {
    const bz = -66.0 - i * 4.0;
    tlW10Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', -110.8, ctx.getHeight(-110.8, bz) + 0.33, bz));
  }

  // 3431-3455. Outer-Rim South Imperial Bastion Garden & Vauban Brick Spur (±62.5..67.2, -37..-47)
  for (const side of [-1, 1]) {
    const dx10 = side * 62.5;
    const d10Y = ctx.getHeight(dx10, -42.0);
    tlW10Relief.push(
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx10 - 0.32, d10Y + 0.14, -42.0),
      makeReliefBox(0.18, 0.28, 10.5, 'thangLongBrick', dx10 + 0.32, d10Y + 0.14, -42.0),
      makeReliefBox(1.35, 0.16, 1.45, 'thanhHoaStone', dx10, d10Y + 0.28, -42.0),
      makeReliefBox(0.48, 0.95, 11.5, 'thangLongBrick', side * 65.5, ctx.getHeight(side * 65.5, -42.0) + 0.48, -42.0),
      makeReliefBox(0.88, 1.38, 0.22, 'thanhHoaStone', side * 60.8, ctx.getHeight(side * 60.8, -44.5) + 0.69, -44.5),
      makeReliefBox(1.95, 0.34, 1.15, 'thangLongBrick', side * 64.2, ctx.getHeight(side * 64.2, -42.0) + 0.17, -42.0)
    );
    tlW10Bronze.push(
      makeCyl(0.32, 0.24, 0.68, 4, side * 60.8, ctx.getHeight(side * 60.8, -38.5) + 0.34, -38.5),
      makeBox(0.22, 0.16, 0.22, dx10, d10Y + 0.08, -39.5),
      makeBox(0.22, 0.16, 0.22, dx10, d10Y + 0.08, -44.5)
    );
    for (const lz of [-37.0, -40.0, -43.0, -46.0]) {
      const ly10 = ctx.getHeight(side * 60.8, lz);
      tlW10Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, side * 60.8, ly10 + 1.35, lz));
      tlW10Glow.push(makeBox(0.22, 0.26, 0.22, side * 60.8, ly10 + 2.92, lz));
      tlW10Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 67.2, ctx.getHeight(side * 67.2, lz) + 0.33, lz));
    }
    for (const bz of [-39.0, -45.0]) {
      tlW10Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 64.2, ctx.getHeight(side * 64.2, bz) + 0.21, bz));
    }
    for (const uz of [-37.0, -47.0]) {
      tlW10Relief.push(makeReliefBox(0.56, 0.42, 0.56, 'thanhHoaStone', side * 63.8, ctx.getHeight(side * 63.8, uz) + 0.21, uz));
    }
    for (const fz of [-38.0, -46.0]) {
      const fy10 = ctx.getHeight(side * 66.5, fz);
      tlW10Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 66.5, fy10 + 1.65, fz));
      tlW10Gold.push(makeBox(0.05, 1.05, 0.46, side * 66.5, fy10 + 2.95, fz + 0.28));
    }

    // 3456-3475. Outer-Rim Kính Thiên East & West Royal Lotus Gardens (±65.5, -86.5)
    const kx10 = side * 65.5;
    const k10Y = ctx.getHeight(kx10, -86.5);
    tlW10Relief.push(
      makeReliefBox(4.0, 0.36, 4.0, 'thanhHoaStone', kx10, k10Y + 0.18, -86.5),
      makeReliefBox(4.6, 0.30, 4.6, 'terracottaHipRoof', kx10, k10Y + 2.94, -86.5),
      remapRelief(makeCyl(0.48, 0.30, 0.62, 4, kx10, k10Y + 0.66, -86.5), 'thanhHoaStone'),
      makeReliefBox(2.8, 1.55, 0.36, 'thanhHoaStone', kx10, ctx.getHeight(kx10, -92.5) + 0.78, -92.5),
      makeReliefBox(2.0, 0.34, 1.15, 'thangLongBrick', kx10, ctx.getHeight(kx10, -79.5) + 0.17, -79.5),
      makeReliefBox(0.24, 0.08, 10.0, 'thanhHoaStone', side * 67.8, k10Y + 0.04, -86.5),
      makeReliefBox(1.05, 0.22, 1.95, 'thanhHoaStone', side * 63.2, k10Y + 0.11, -86.5),
      makeReliefBox(0.86, 1.38, 0.22, 'thanhHoaStone', side * 63.5, ctx.getHeight(side * 63.5, -79.5) + 0.69, -79.5)
    );
    for (const dx2 of [-1.50, 1.50]) {
      for (const dz2 of [-1.50, 1.50]) {
        tlW10Crimson.push(makeCyl(0.09, 0.11, 2.70, 4, kx10 + dx2, k10Y + 1.48, -86.5 + dz2));
      }
    }
    tlW10Glow.push(makeBox(0.20, 0.24, 0.20, kx10, k10Y + 2.66, -86.5));
    tlW10Bronze.push(makeCyl(0.30, 0.22, 0.62, 4, side * 62.8, k10Y + 0.31, -86.5));
    for (const lz of [-81.5, -90.5]) {
      const ly10 = ctx.getHeight(kx10, lz);
      tlW10Relief.push(
        makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', kx10, ly10 + 0.48, lz),
        makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', kx10, ly10 + 1.04, lz)
      );
    }
    for (const bz of [-83.0, -90.0]) {
      tlW10Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', side * 63.2, ctx.getHeight(side * 63.2, bz) + 0.21, bz));
    }
    for (const fz of [-82.0, -91.0]) {
      const fy10 = ctx.getHeight(side * 68.0, fz);
      tlW10Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, side * 68.0, fy10 + 1.65, fz));
      tlW10Gold.push(makeBox(0.05, 1.05, 0.46, side * 68.0, fy10 + 2.95, fz + 0.28));
    }
    for (const cz2 of [-80.0, -93.0]) {
      tlW10Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', side * 68.5, ctx.getHeight(side * 68.5, cz2) + 0.33, cz2));
    }
  }

  // 3476-3500. Outer-East Cột Cờ Bastion Guard Terrace (95.5..99.2, -67.5..-85.5) & Outer-North Moat Esplanade East Wing (76.2..81.2, -96.5..-112.5)
  const rp10Y = ctx.getHeight(97.5, -76.0);
  tlW10Relief.push(
    makeReliefBox(0.65, 1.85, 16.0, 'thangLongBrick', 97.5, rp10Y + 0.92, -76.0),
    makeReliefBox(2.4, 2.30, 2.2, 'vongLauOchre', 97.5, ctx.getHeight(97.5, -85.5) + 1.15, -85.5),
    makeReliefBox(3.0, 0.28, 2.8, 'terracottaHipRoof', 97.5, ctx.getHeight(97.5, -85.5) + 2.42, -85.5),
    makeReliefBox(0.90, 1.48, 0.22, 'thanhHoaStone', 95.5, rp10Y + 0.74, -76.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 95.5, ctx.getHeight(95.5, -84.0) + 0.21, -84.0),
    makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 95.5, ctx.getHeight(95.5, -68.8) + 0.21, -68.8),
    makeReliefBox(1.85, 0.18, 1.25, 'thanhHoaStone', 77.5, ctx.getHeight(77.5, -112.0) + 0.10, -112.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 79.2, ctx.getHeight(79.2, -98.0) + 0.17, -98.0),
    makeReliefBox(1.85, 0.34, 1.15, 'thangLongBrick', 79.2, ctx.getHeight(79.2, -111.0) + 0.17, -111.0),
    remapRelief(makeCyl(0.48, 0.30, 0.60, 4, 80.5, ctx.getHeight(80.5, -104.5) + 0.30, -104.5), 'thanhHoaStone'),
    remapRelief(makeCyl(0.30, 0.22, 0.60, 4, 76.5, ctx.getHeight(76.5, -112.5) + 0.30, -112.5), 'thanhHoaStone'),
    makeReliefBox(0.24, 0.08, 12.0, 'thanhHoaStone', 80.5, ctx.getHeight(80.5, -104.5) + 0.04, -104.5)
  );
  tlW10Glow.push(makeBox(0.18, 0.22, 0.18, 96.2, ctx.getHeight(97.5, -85.5) + 2.15, -85.5));
  tlW10Wood.push(makeBox(1.30, 1.40, 0.50, 79.5, ctx.getHeight(79.5, -96.5) + 0.70, -96.5));
  tlW10Bronze.push(makeCyl(0.05, 0.07, 2.20, 4, 76.5, ctx.getHeight(76.5, -97.0) + 0.98, -97.0));
  tlW10Gold.push(makeBox(0.76, 0.22, 0.08, 76.9, ctx.getHeight(76.5, -97.0) + 1.85, -97.0));
  for (const cz2 of [-70.5, -76.0, -81.5]) {
    const cy10 = ctx.getHeight(96.2, cz2);
    tlW10Bronze.push(
      makeCyl(0.14, 0.19, 2.05, 5, 96.2, cy10 + 0.76, cz2, 0, Math.PI * 0.48),
      new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI * 0.25).translate(96.2, cy10 + 0.46, cz2 + 1.35)
    );
    tlW10Wood.push(makeBox(1.20, 0.44, 0.82, 96.2, cy10 + 0.46, cz2));
  }
  for (const lz of [-67.5, -73.2, -78.8]) {
    const ly10 = ctx.getHeight(95.5, lz);
    tlW10Relief.push(
      makeReliefBox(0.38, 0.96, 0.38, 'thanhHoaStone', 95.5, ly10 + 0.48, lz),
      makeReliefBox(0.52, 0.16, 0.52, 'terracottaHipRoof', 95.5, ly10 + 1.04, lz)
    );
  }
  for (const fz of [-71.5, -80.5]) {
    const fy10 = ctx.getHeight(98.5, fz);
    tlW10Crimson.push(makeCyl(0.04, 0.05, 3.6, 4, 98.5, fy10 + 1.65, fz));
    tlW10Gold.push(makeBox(0.05, 1.05, 0.46, 98.5, fy10 + 2.95, fz + 0.28));
  }
  for (const bz of [-69.0, -74.0, -79.0, -84.0]) {
    tlW10Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 99.2, ctx.getHeight(99.2, bz) + 0.33, bz));
  }
  for (const lz of [-99.0, -102.5, -106.0, -109.5]) {
    const ly10 = ctx.getHeight(77.5, lz);
    tlW10Crimson.push(makeCyl(0.05, 0.07, 2.95, 4, 77.5, ly10 + 1.35, lz));
    tlW10Glow.push(makeBox(0.22, 0.26, 0.22, 77.5, ly10 + 2.92, lz));
    tlW10Relief.push(makeReliefBox(0.26, 0.66, 0.26, 'thanhHoaStone', 81.2, ctx.getHeight(81.2, lz) + 0.33, lz));
  }
  for (const nz of [-100.5, -104.5, -108.5]) {
    tlW10Relief.push(makeReliefBox(0.50, 0.42, 1.55, 'thanhHoaStone', 79.2, ctx.getHeight(79.2, nz) + 0.21, nz));
    tlW10Bronze.push(makeCyl(0.05, 0.08, 2.85, 4, 76.2, ctx.getHeight(76.2, nz) + 1.30, nz));
    tlW10Glow.push(makeBox(0.18, 0.20, 0.18, 76.2, ctx.getHeight(76.2, nz) + 2.88, nz));
  }

  addMerged(tlW10Relief, tl.thangLongMasterAtlasMat, 'HoangThanhWave10AtlasMesh', false, true);
  addMerged(tlW10Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'HoangThanhWave10Wood', false, true);
  addMerged(tlW10Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'HoangThanhWave10Bronze', false, true);
  addMerged(tlW10Gold, ctx.materials.gold, 'HoangThanhWave10Gold', false, false);
  addMerged(tlW10Crimson, ctx.materials.crimsonLacquer, 'HoangThanhWave10Crimson', false, true);
  addMerged(tlW10Steel, stainlessMat, 'HoangThanhWave10Steel', false, false);
  addMerged(tlW10Glass, ctx.materials.stainedGlass ?? stainlessMat, 'HoangThanhWave10Glass', false, false);
  addMerged(tlW10Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, 'HoangThanhWave10Glow', false, false);

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
