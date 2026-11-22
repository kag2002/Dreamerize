import * as THREE from 'three';
import {
  VietnamBuilderContext,
  mergeNormalized,
  applyWorldBoxUV,
  createVietnameseCurvedRoofGeometry,
  createHueImperialHipRoofGeometry,
  createArchedWallGeometry
} from './vietnamGeometryHelpers';
import {
  createSignagePlaqueMesh,
  createPiercedBalustradeParts,
  createCarvedDragonBalustradeParts,
  createGuardianBeastParts,
  createImperialUrnParts,
  createMotifBandParts,
  createShouCharacterParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import { transformGeometryXYZ, colorizeGeometry } from '../vietnam/geometry/PartsBuilder';

function addBox(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  rz = 0
): void {
  parts.push(transformGeometryXYZ(new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx, rz));
}

function addCyl(
  parts: THREE.BufferGeometry[],
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  rz = 0
): void {
  parts.push(transformGeometryXYZ(new THREE.CylinderGeometry(rTop, rBot, h, segs), x, y, z, 0, rx, rz));
}

function setInstMat(
  inst: THREE.InstancedMesh,
  idx: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  sx = 1,
  sy = 1,
  sz = 1
): void {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  inst.setMatrixAt(idx, m);
}

/**
 * Builds a high-detail sculpted 3-dragon-legged spherical antique-bronze cauldron (`Bửu Đỉnh / Đỉnh Đồng`, Photo 1!)
 * complete with tiered lotus pedestal, 3 S-curved sculpted dragons, embossed spherical body,
 * 2 climbing flank kylins, and 1 crowned Lân perched atop the dome lid clutching a brocade orb.
 */
function addBuuDinhBronzeCauldron(
  bronzeParts: THREE.BufferGeometry[],
  cx: number,
  floorY: number,
  cz: number,
  scale = 1.0
): void {
  const s = scale;
  // 1. Circular tiered lotus-carved bronze pedestal base (smooth rounded torus rings — ZERO sharp spikes!)
  addCyl(bronzeParts, 0.46 * s, 0.56 * s, 0.14 * s, 20, cx, floorY + 0.07 * s, cz);
  addCyl(bronzeParts, 0.40 * s, 0.46 * s, 0.12 * s, 20, cx, floorY + 0.19 * s, cz);
  const lotusBand = new THREE.TorusGeometry(0.41 * s, 0.065 * s, 8, 22);
  lotusBand.rotateX(Math.PI * 0.5);
  lotusBand.translate(cx, floorY + 0.25 * s, cz);
  bronzeParts.push(lotusBand);

  // 2. Three sculpted S-curved tapered bronze dragons rising smoothly from pedestal to cradle cauldron belly (ZERO boxy cubes!)
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * Math.PI * 2 + Math.PI * 0.5;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const dragonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + ca * 0.36 * s, floorY + 0.24 * s, cz + sa * 0.36 * s),
      new THREE.Vector3(cx + ca * 0.48 * s, floorY + 0.54 * s, cz + sa * 0.48 * s),
      new THREE.Vector3(cx + ca * 0.28 * s, floorY + 0.86 * s, cz + sa * 0.28 * s),
      new THREE.Vector3(cx + ca * 0.37 * s, floorY + 1.12 * s, cz + sa * 0.37 * s)
    ]);
    bronzeParts.push(new THREE.TubeGeometry(dragonCurve, 14, 0.066 * s, 8, false));
    // Sculpted rounded dragon head & mane seamlessly cradling lower cauldron rim
    const dHead = new THREE.SphereGeometry(0.095 * s, 10, 8);
    dHead.scale(1.25, 0.92, 0.92);
    dHead.rotateY(-ang);
    dHead.translate(cx + ca * 0.38 * s, floorY + 1.12 * s, cz + sa * 0.38 * s);
    bronzeParts.push(dHead);
    // Flared dragon tail scroll at pedestal base
    const dTail = new THREE.SphereGeometry(0.08 * s, 8, 6);
    dTail.scale(1.4, 0.75, 0.85);
    dTail.rotateY(-ang);
    dTail.translate(cx + ca * 0.42 * s, floorY + 0.32 * s, cz + sa * 0.42 * s);
    bronzeParts.push(dTail);
  }

  // 3. Large spherical antique-bronze cauldron body + molded equatorial belt & embossed relief rings
  const bellyY = floorY + 1.50 * s;
  const sphereR = 0.54 * s;
  const belly = new THREE.SphereGeometry(sphereR, 22, 16);
  belly.translate(cx, bellyY, cz);
  bronzeParts.push(belly);
  const eqRing = new THREE.TorusGeometry(sphereR * 0.99, 0.036 * s, 8, 24);
  eqRing.rotateX(Math.PI * 0.5);
  eqRing.translate(cx, bellyY + 0.06 * s, cz);
  bronzeParts.push(eqRing);
  const lidRim = new THREE.TorusGeometry(sphereR * 0.72, 0.032 * s, 7, 20);
  lidRim.rotateX(Math.PI * 0.5);
  lidRim.translate(cx, bellyY + 0.36 * s, cz);
  bronzeParts.push(lidRim);

  // 4. Twin organic climbing flank Lân/kylins hugging left (-Z) and right (+Z) curved shoulders directly (ZERO flat tray bases!)
  for (const side of [-1, 1]) {
    const kz = cz + side * (sphereR + 0.09 * s);
    const body = new THREE.SphereGeometry(0.135 * s, 10, 8);
    body.scale(0.85, 1.38, 0.92);
    body.rotateX(-side * 0.32);
    body.translate(cx, bellyY + 0.05 * s, kz);
    bronzeParts.push(body);
    const head = new THREE.SphereGeometry(0.115 * s, 10, 8);
    head.scale(1.1, 1.0, 0.95);
    head.translate(cx + 0.05 * s, bellyY + 0.24 * s, kz + side * 0.04 * s);
    bronzeParts.push(head);
    // Curved paws gripping curved bronze sphere
    addCyl(bronzeParts, 0.036 * s, 0.042 * s, 0.22 * s, 7, cx + 0.06 * s, bellyY + 0.14 * s, cz + side * (sphereR - 0.02 * s), side * 1.10, 0);
    addCyl(bronzeParts, 0.036 * s, 0.042 * s, 0.22 * s, 7, cx - 0.06 * s, bellyY - 0.10 * s, cz + side * (sphereR + 0.01 * s), side * 0.85, 0);
  }

  // 5. Crowned seated Lân perched smoothly atop dome lid clutching openwork brocade orb (`cầu lửa` — ZERO tray base!)
  const topY = bellyY + sphereR - 0.02 * s;
  const topBody = new THREE.SphereGeometry(0.16 * s, 10, 8);
  topBody.scale(1.22, 0.98, 0.86);
  topBody.translate(cx - 0.04 * s, topY + 0.14 * s, cz);
  bronzeParts.push(topBody);
  const topHead = new THREE.SphereGeometry(0.135 * s, 10, 8);
  topHead.scale(1.15, 1.0, 0.95);
  topHead.translate(cx + 0.10 * s, topY + 0.30 * s, cz);
  bronzeParts.push(topHead);
  const brocadeBall = new THREE.SphereGeometry(0.088 * s, 10, 8);
  brocadeBall.translate(cx + 0.17 * s, topY + 0.07 * s, cz);
  bronzeParts.push(brocadeBall);
  // Swept curved bronze tail behind seated Lân
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 0.16 * s, topY + 0.12 * s, cz),
    new THREE.Vector3(cx - 0.28 * s, topY + 0.24 * s, cz),
    new THREE.Vector3(cx - 0.22 * s, topY + 0.36 * s, cz)
  ]);
  bronzeParts.push(new THREE.TubeGeometry(tailCurve, 7, 0.042 * s, 6, false));
}

/**
 * Builds the bright crimson-lacquered wooden ceremonial barrier fence with pierced `Chữ Thọ` medallions
 * spanning left & right of the Bửu Đỉnh cauldron across Điện Thái Hòa (Photo 1!).
 */
function addCrimsonChuThoBarrier(
  barrierParts: THREE.BufferGeometry[],
  xPos: number,
  floorY: number,
  cz: number,
  halfSpanZ: number,
  centerGapHalfZ: number
): void {
  const railH = 0.94;
  for (const side of [-1, 1]) {
    const zStart = cz + side * centerGapHalfZ;
    const zEnd = cz + side * halfSpanZ;
    const totalLen = Math.abs(zEnd - zStart);
    const numBays = Math.max(2, Math.round(totalLen / 1.95));
    const bayLen = totalLen / numBays;

    for (let b = 0; b <= numBays; b++) {
      const pz = zStart + side * (b * bayLen);
      // Stepped T-foot plinth & square red post with finial cap
      addBox(barrierParts, 0.42, 0.10, 0.14, xPos, floorY + 0.05, pz);
      addBox(barrierParts, 0.28, 0.08, 0.16, xPos, floorY + 0.14, pz);
      addBox(barrierParts, 0.10, railH, 0.10, xPos, floorY + railH * 0.5 + 0.04, pz);
      addBox(barrierParts, 0.14, 0.06, 0.14, xPos, floorY + railH + 0.06, pz);

      if (b < numBays) {
        const midZ = pz + side * (bayLen * 0.5);
        // Top handrail, upper/lower sub-rails, and bottom sill rail
        addBox(barrierParts, 0.09, 0.07, bayLen, xPos, floorY + railH - 0.02, midZ);
        addBox(barrierParts, 0.06, 0.05, bayLen, xPos, floorY + railH - 0.16, midZ);
        addBox(barrierParts, 0.06, 0.05, bayLen, xPos, floorY + 0.22, midZ);
        // Central pierced square Chữ Thọ geometric lattice panel (Photo 1 signature red fence motif!)
        const frameW = Math.min(0.68, bayLen * 0.42);
        const midY = floorY + 0.52;
        addBox(barrierParts, 0.045, 0.045, frameW, xPos, midY + 0.24, midZ);
        addBox(barrierParts, 0.045, 0.045, frameW, xPos, midY - 0.24, midZ);
        addBox(barrierParts, 0.045, 0.48, 0.045, xPos, midY, midZ - frameW * 0.5);
        addBox(barrierParts, 0.045, 0.48, 0.045, xPos, midY, midZ + frameW * 0.5);
        // Inner Chữ Thọ crossbars
        addBox(barrierParts, 0.04, 0.04, frameW * 0.92, xPos, midY, midZ);
        addBox(barrierParts, 0.04, 0.44, 0.04, xPos, midY, midZ);
        addBox(barrierParts, 0.04, 0.035, frameW * 0.58, xPos, midY + 0.12, midZ);
        addBox(barrierParts, 0.04, 0.035, frameW * 0.58, xPos, midY - 0.12, midZ);
        // Flanking geometric vertical fret mullions
        for (const fSign of [-1, 1]) {
          const fz = midZ + fSign * (bayLen * 0.34);
          addBox(barrierParts, 0.04, 0.56, 0.04, xPos, midY, fz);
          addBox(barrierParts, 0.04, 0.04, bayLen * 0.18, xPos, midY, fz);
        }
      }
    }
  }
}

/**
 * Sculpted ceramic-mosaic Cửu Long (9-Dragon) Roof Crown (Photo 6!)
 * Central Lưỡng Long Chầu Nhật (2 dragons + flaming orb), 2 mid-ridge dragons,
 * 2 upturned ridge-end Kìm Nóc dragon heads, and 4 corner hip-ridge dragons!
 */
function addCuuLongCeramicRoofDragons(
  ceramicParts: THREE.BufferGeometry[],
  goldParts: THREE.BufferGeometry[],
  hx: number,
  ridgeY: number,
  cz: number,
  ridgeLenZ: number,
  hipSpanX: number,
  hipSpanZ: number,
  hipDropY: number,
  scale = 1.0
): void {
  const s = scale;
  // Molded main ridge beam (`bờ nóc`)
  addBox(ceramicParts, 0.42 * s, 0.38 * s, ridgeLenZ + 0.6 * s, hx, ridgeY + 0.14 * s, cz);
  addBox(goldParts, 0.48 * s, 0.10 * s, ridgeLenZ + 0.4 * s, hx, ridgeY + 0.36 * s, cz);

  // 1. Central Flaming Solar Pearl (`Mặt Nhật / Châu Báu`) + Lưỡng Long Chầu Nhật (Dragons #1 & #2)
  const orb = new THREE.SphereGeometry(0.32 * s, 10, 8);
  orb.translate(hx, ridgeY + 0.78 * s, cz);
  goldParts.push(orb);
  const orbRing = new THREE.TorusGeometry(0.44 * s, 0.06 * s, 6, 14);
  orbRing.rotateY(Math.PI * 0.5);
  orbRing.translate(hx, ridgeY + 0.78 * s, cz);
  ceramicParts.push(orbRing);

  for (const side of [-1, 1]) {
    const dCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, ridgeY + 0.85 * s, cz + side * 0.72 * s),
      new THREE.Vector3(hx, ridgeY + 0.52 * s, cz + side * 1.65 * s),
      new THREE.Vector3(hx, ridgeY + 0.96 * s, cz + side * 2.65 * s),
      new THREE.Vector3(hx, ridgeY + 0.44 * s, cz + side * 3.75 * s),
      new THREE.Vector3(hx, ridgeY + 0.76 * s, cz + side * 4.45 * s)
    ]);
    ceramicParts.push(new THREE.TubeGeometry(dCurve, 12, 0.16 * s, 6, false));
    // Dorsal crest spine & head facing central orb
    const dHead = new THREE.SphereGeometry(0.24 * s, 8, 6);
    dHead.scale(0.9, 1.0, 1.35);
    dHead.translate(hx, ridgeY + 0.90 * s, cz + side * 0.68 * s);
    ceramicParts.push(dHead);
    const horn = new THREE.ConeGeometry(0.08 * s, 0.34 * s, 5);
    horn.translate(hx, ridgeY + 1.18 * s, cz + side * 0.76 * s);
    goldParts.push(horn);
  }

  // 2. Two Mid-Ridge Ceramic Dragons (#3 & #4) & Two Upturned Ridge-End Kìm Nóc (#5 & #6)
  for (const side of [-1, 1]) {
    const midZ = cz + side * (ridgeLenZ * 0.30);
    const midCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, ridgeY + 0.38 * s, midZ - side * 1.1 * s),
      new THREE.Vector3(hx, ridgeY + 0.92 * s, midZ),
      new THREE.Vector3(hx, ridgeY + 0.48 * s, midZ + side * 1.1 * s)
    ]);
    ceramicParts.push(new THREE.TubeGeometry(midCurve, 8, 0.14 * s, 5, false));
    const crest = new THREE.ConeGeometry(0.14 * s, 0.38 * s, 5);
    crest.translate(hx, ridgeY + 1.05 * s, midZ);
    goldParts.push(crest);

    // Massive curled Kìm Nóc dragon terminal at ridge ends
    const endZ = cz + side * (ridgeLenZ * 0.50);
    const kimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, ridgeY + 0.32 * s, endZ - side * 0.45 * s),
      new THREE.Vector3(hx, ridgeY + 1.18 * s, endZ + side * 0.20 * s),
      new THREE.Vector3(hx, ridgeY + 1.56 * s, endZ - side * 0.18 * s)
    ]);
    ceramicParts.push(new THREE.TubeGeometry(kimCurve, 9, 0.20 * s, 6, false));
    const kimTip = new THREE.SphereGeometry(0.24 * s, 7, 6);
    kimTip.translate(hx, ridgeY + 1.58 * s, endZ - side * 0.18 * s);
    goldParts.push(kimTip);
  }

  // 3. Four Sweeping Serrated Ceramic-Mosaic Hip-Ridge Dragons (#7, #8, #9+) hugging createHueImperialHipRoofGeometry with 0.00m gap!
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      const samples = 9;
      const topHalfX = 0.9;
      const topHalfZ = ridgeLenZ * 0.5;
      const roofH = hipDropY + 0.32;
      const flare = 0.32;
      for (let k = 0; k <= samples; k++) {
        const r = k / samples;
        const px = hx + sx * THREE.MathUtils.lerp(topHalfX, hipSpanX, r);
        const pz = cz + sz * THREE.MathUtils.lerp(topHalfZ, hipSpanZ, r);
        const concave = Math.pow(1.0 - r, 1.32);
        const upturn = flare * Math.pow(r, 2.4) * 1.80;
        const py = (ridgeY - roofH) + concave * roofH + upturn + 0.08;
        pts.push(new THREE.Vector3(px, py, pz));
      }
      const last = pts[pts.length - 1];
      pts.push(new THREE.Vector3(last.x + sx * 0.36 * s, last.y + 0.38 * s, last.z + sz * 0.36 * s));
      const hipCurve = new THREE.CatmullRomCurve3(pts);
      ceramicParts.push(new THREE.TubeGeometry(hipCurve, 10, 0.15 * s, 6, false));
      const tip = pts[pts.length - 1];
      const eaveDragon = new THREE.ConeGeometry(0.17 * s, 0.46 * s, 6);
      eaveDragon.rotateZ(-sx * 0.55);
      eaveDragon.rotateX(sz * 0.55);
      eaveDragon.translate(tip.x, tip.y + 0.16 * s, tip.z);
      goldParts.push(eaveDragon);
    }
  }
}

/**
 * Builds an organic multi-branch bonsai tree on a turned terracotta-red pedestal & cobalt-blue porcelain bowl
 * (Photo 6 Sân Đại Triều Nghi hero foreground planters!).
 */
function addTerracottaPorcelainBonsai(
  terracottaParts: THREE.BufferGeometry[],
  porcelainParts: THREE.BufferGeometry[],
  woodParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  x: number,
  groundY: number,
  z: number,
  scale = 1.0,
  withTallPedestal = true
): void {
  const s = scale;
  let potBaseY = groundY;
  if (withTallPedestal) {
    // Turned terracotta-red tapered pedestal (Photo 6: stepped base + baluster shaft + flared rim)
    addBox(terracottaParts, 0.88 * s, 0.14 * s, 0.88 * s, x, groundY + 0.07 * s, z);
    addCyl(terracottaParts, 0.34 * s, 0.42 * s, 0.18 * s, 12, x, groundY + 0.23 * s, z);
    addCyl(terracottaParts, 0.24 * s, 0.32 * s, 0.62 * s, 12, x, groundY + 0.63 * s, z);
    addCyl(terracottaParts, 0.46 * s, 0.28 * s, 0.24 * s, 12, x, groundY + 1.06 * s, z);
    potBaseY = groundY + 1.18 * s;
  } else {
    addBox(terracottaParts, 0.84 * s, 0.34 * s, 0.84 * s, x, groundY + 0.17 * s, z);
    potBaseY = groundY + 0.34 * s;
  }

  // Cobalt blue-and-white glazed porcelain bowl (`chậu sứ Lam Huế`)
  addCyl(porcelainParts, 0.54 * s, 0.34 * s, 0.46 * s, 14, x, potBaseY + 0.23 * s, z);
  const rim = new THREE.TorusGeometry(0.54 * s, 0.045 * s, 6, 16);
  rim.rotateX(Math.PI * 0.5);
  rim.translate(x, potBaseY + 0.46 * s, z);
  porcelainParts.push(rim);

  // Gnarled curving bonsai trunk + branches + overlapping alpha-tested organic leaf cards (NOT smooth green balloons!)
  const treeY = potBaseY + 0.42 * s;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, treeY, z),
    new THREE.Vector3(x + 0.14 * s, treeY + 0.55 * s, z - 0.12 * s),
    new THREE.Vector3(x - 0.12 * s, treeY + 1.18 * s, z + 0.16 * s),
    new THREE.Vector3(x + 0.06 * s, treeY + 1.75 * s, z - 0.04 * s)
  ]);
  woodParts.push(new THREE.TubeGeometry(trunkCurve, 8, 0.075 * s, 6, false));

  const tufts: Array<[number, number, number, number, string]> = [
    [0.36, 0.85, -0.32, 0.72, '#2d6622'],
    [0.54, 0.94, -0.18, 0.58, '#3b7f2c'],
    [-0.38, 1.15, 0.34, 0.76, '#24581b'],
    [-0.22, 1.26, 0.48, 0.62, '#3c802d'],
    [0.24, 1.48, 0.26, 0.68, '#326f26'],
    [-0.20, 1.62, -0.24, 0.65, '#285d1e'],
    [0.04, 1.92, 0.02, 0.78, '#428932'],
    [0.22, 1.84, -0.10, 0.56, '#4f993c']
  ];
  for (let ti = 0; ti < tufts.length; ti++) {
    const [ox, oy, oz, rad, col] = tufts[ti];
    for (let c = 0; c < 3; c++) {
      const card = new THREE.PlaneGeometry(rad * s * 1.45, rad * s * 1.05);
      card.rotateX((c === 0 ? 0.35 : c === 1 ? -0.35 : 0.08));
      card.rotateY((c / 3) * Math.PI + ti * 0.7);
      card.translate(x + ox * s, treeY + oy * s, z + oz * s);
      foliageParts.push(colorizeGeometry(card, col));
    }
  }
}

export interface DienThaiHoaHallOptions {
  /** Center X of the hall footprint (facing +X East toward Sân Đại Triều Nghi) */
  hallCenterX: number;
  /** Ground elevation y at hall site */
  baseY: number;
  /** Center Z of the hall */
  centerZ: number;
  /** Total facade width along Z (Macro: 44m, Core: 34m) */
  widthZ: number;
  /** Total depth along X (Macro: 32m, Core: 24m) */
  depthX: number;
  /** Height of raised Thanh stone plinth above baseY */
  plinthH: number;
  /** Interior column shaft height */
  colH: number;
  /** Whether to place the hero foreground Bửu Đỉnh + barrier + full 4-tier trusses */
  fullHeroInterior: boolean;
}

/**
 * Builds the museum-grade **Điện Thái Hòa** Hall (Exterior Photo 6 + Interior Photos 1, 3, 4, 5)
 * reusable across BOTH `HueGrandImperialPalace` (Macro) AND `HueThaiHoaThroneHall` (Core)!
 */
export function buildDienThaiHoaHeroHall(
  ctx: VietnamBuilderContext,
  targetGroup: THREE.Group,
  opts: DienThaiHoaHallOptions
): {
  plinthTopY: number;
  frontEdgeX: number;
  rearEdgeX: number;
  throneX: number;
  buuTanY: number;
} {
  const hp = ctx.huePack!;
  const { hallCenterX: hx, baseY: y, centerZ: cz, widthZ, depthX, plinthH, colH } = opts;
  const halfZ = widthZ * 0.5;
  const halfX = depthX * 0.5;
  const frontX = hx + halfX; // East facade facing Sân Đại Triều Nghi (+X)
  const rearX = hx - halfX;  // West rear wall (-X)
  const floorY = y + plinthH;

  const thanhStoneParts: THREE.BufferGeometry[] = [];
  const plasterParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const brightRedParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const ceramicParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const ironwoodParts: THREE.BufferGeometry[] = [];
  const porcelainParts: THREE.BufferGeometry[] = [];
  const terracottaParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const yellowRoofParts: THREE.BufferGeometry[] = [];
  const darkWoodParts: THREE.BufferGeometry[] = [];
  const rafterGoldParts: THREE.BufferGeometry[] = [];

  // 1. Raised Dressed Thanh Stone Plinth + 3 Front Dragon Staircases (Photo 6!)
  addBox(thanhStoneParts, depthX + 3.6, plinthH, widthZ + 3.6, hx, y + plinthH * 0.5, cz);
  // Subtle molded Thanh stone plinth cornice coping
  addBox(thanhStoneParts, depthX + 4.1, 0.16, widthZ + 4.1, hx, floorY - 0.06, cz);

  // Glossy patterned encaustic imperial floor tiles covering entire interior hall (world-scale square UVs matching Photos 1 & 5!)
  const floorGeo = applyWorldBoxUV(
    new THREE.PlaneGeometry(depthX - 1.2, widthZ - 1.4).rotateX(-Math.PI * 0.5).translate(hx, floorY + 0.025, cz),
    1.35
  );
  const floorMesh = new THREE.Mesh(floorGeo, hp.encausticFloorMat);
  floorMesh.receiveShadow = true;
  targetGroup.add(floorMesh);

  // 3 Plinth Staircases climbing up to the veranda deck (wide central royal stair + 2 flanking)
  const stairList: Array<[number, number]> = [
    [cz - halfZ * 0.58, 3.2],
    [cz, 5.4],
    [cz + halfZ * 0.58, 3.2]
  ];
  for (const [sz, sw] of stairList) {
    const steps = 5;
    for (let st = 0; st < steps; st++) {
      const sh = plinthH * ((st + 1) / steps);
      const sx = frontX + 1.8 + (steps - 1 - st) * 0.42;
      addBox(thanhStoneParts, 0.46, sh, sw, sx, y + sh * 0.5, sz);
    }
    for (const s of [-1, 1]) {
      const rz = sz + s * (sw * 0.5 + 0.24);
      thanhStoneParts.push(
        ...createCarvedDragonBalustradeParts(frontX + 3.85, y, rz, frontX + 1.6, floorY, rz, 0.74)
      );
    }
  }

  // 2. Authentic 9-Bay Open Veranda Colonnade + Diamond-Weave Bamboo Blinds (`Mành Tre`, Photo 6!)
  const numBays = 9;
  const verandaSpanZ = widthZ - 3.6;
  const bayPitchZ = verandaSpanZ / numBays;
  const verandaX = frontX + 0.85;
  const doorX = frontX - 1.35; // Deep 2.2m shaded front veranda behind outer columns!

  // 10 Front Veranda Columns (defining 9 bays) + Interior Grid of Glossy Crimson Coiling-Dragon Columns!
  // 8 interior Z-lines (wide central nave bay ±2.75m scaled to widthZ) × 5 X-rows matching Photos 1, 3, 5!
  const zScale = widthZ / 44.0;
  const colRowsX = 5;
  const frontBayX = doorX - 1.2;
  const rearColX = rearX + 2.4;
  const rowPitchX = (frontBayX - rearColX) / (colRowsX - 1);
  const colPositions: Array<[number, number, boolean]> = [];

  // Outer veranda row (10 columns)
  for (let b = 0; b <= numBays; b++) {
    const pz = cz - verandaSpanZ * 0.5 + b * bayPitchZ;
    colPositions.push([verandaX, pz, true]);
  }
  const zLines = [
    -18.8 * zScale,
    -14.2 * zScale,
    -9.8 * zScale,
    -6.0 * zScale,
    -2.75 * zScale,
    2.75 * zScale,
    6.0 * zScale,
    9.8 * zScale,
    14.2 * zScale,
    18.8 * zScale
  ];
  const trussZLines = zLines.slice(1, zLines.length - 1); // 8 inner structural truss lines!
  for (let r = 0; r < colRowsX; r++) {
    const rx = frontBayX - r * rowPitchX;
    for (const zOff of trussZLines) {
      colPositions.push([rx, cz + zOff, false]);
    }
  }

  const colGeo = new THREE.CylinderGeometry(0.28, 0.31, colH, 16);
  const colInst = new THREE.InstancedMesh(colGeo, hp.dragonColumnMat, colPositions.length);
  colInst.castShadow = true;
  colInst.receiveShadow = true;
  // Authentic low sculpted grey Thanh stone circular `chân tảng` plinths (NOT glowing white cones!)
  const plinthColGeo = new THREE.CylinderGeometry(0.36, 0.46, 0.28, 14);
  const plinthInst = new THREE.InstancedMesh(plinthColGeo, hp.thanhStoneMat, colPositions.length);
  plinthInst.receiveShadow = true;

  for (let i = 0; i < colPositions.length; i++) {
    const [cxP, czP, isVeranda] = colPositions[i];
    const hScale = isVeranda ? 0.78 : 1.0;
    const actualH = colH * hScale;
    setInstMat(colInst, i, cxP, floorY + 0.28 + actualH * 0.5, czP, (i * 1.17) % (Math.PI * 2), isVeranda ? 0.82 : 1.0, hScale, isVeranda ? 0.82 : 1.0);
    setInstMat(plinthInst, i, cxP, floorY + 0.14, czP, 0, isVeranda ? 0.86 : 1.0, 1.0, isVeranda ? 0.86 : 1.0);

    // Sculpted gilded dragon-head corbel (`đầu dư`) & carved golden corner gussets on EVERY interior column capital (Photos 1, 3, 5!)
    if (!isVeranda) {
      const capY = floorY + 0.28 + actualH;
      addCyl(goldParts, 0.35, 0.30, 0.24, 12, cxP, capY - 0.12, czP);
      // Gilded dragon-head corbel projecting into nave
      const inwardZ = czP > cz ? -1 : 1;
      addBox(goldParts, 0.28, 0.38, 0.44, cxP, capY - 0.26, czP + inwardZ * 0.38);
      // Carved golden triangular corner brackets (`kê góc chạm lọng vàng`, Photos 1 & 3)
      for (const s of [-1, 1]) {
        const gus = new THREE.ConeGeometry(0.32, 0.56, 4);
        gus.rotateX(Math.PI);
        gus.translate(cxP, capY - 0.48, czP + s * 0.44);
        goldParts.push(gus);
      }
    }
  }
  colInst.instanceMatrix.needsUpdate = true;
  plinthInst.instanceMatrix.needsUpdate = true;
  targetGroup.add(colInst, plinthInst);

  // Diamond-Weave Imperial Bamboo Sun-Blinds (`Mành Tre Quả Trám`, Photo 6!) across bays 1..3 & 5..7
  const blindH = colH * 0.66;
  const blindY = floorY + 0.48 + blindH * 0.5;
  const blindParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < numBays; b++) {
    if (b === 4) continue; // Central royal bay open so interior shines through!
    const bz = cz - verandaSpanZ * 0.5 + (b + 0.5) * bayPitchZ;
    if (b === 0 || b === 8) {
      // Far outer end bays: dark-crimson recessed wooden Cửa Bức Bàn doors (Photo 6 flanks!)
      addBox(crimsonParts, 0.16, colH * 0.72, bayPitchZ - 0.45, doorX, floorY + colH * 0.36, bz);
      addBox(goldParts, 0.19, 0.10, bayPitchZ - 0.55, doorX + 0.04, floorY + colH * 0.34, bz);
    } else {
      // Crisp diamond-weave bamboo blinds suspended cleanly between front veranda columns (Photo 6!)
      const bPlane = new THREE.PlaneGeometry(bayPitchZ - 0.48, blindH);
      bPlane.rotateY(Math.PI * 0.5);
      bPlane.translate(verandaX - 0.14, blindY, bz);
      blindParts.push(bPlane);
      // Dark wooden blind roller header & bottom weight rod
      addBox(darkWoodParts, 0.14, 0.12, bayPitchZ - 0.42, verandaX - 0.12, blindY + blindH * 0.5 + 0.04, bz);
      addBox(darkWoodParts, 0.10, 0.08, bayPitchZ - 0.42, verandaX - 0.12, blindY - blindH * 0.5 - 0.04, bz);
    }
  }
  if (blindParts.length > 0) {
    const blindMesh = new THREE.Mesh(mergeNormalized(blindParts), hp.bambooBlindMat);
    targetGroup.add(blindMesh);
  }

  // Front Recessed 9-Bay Lacquered Red-and-Gold Folding `Cửa Bức Bàn` Doors (Photo 5 left — folded cleanly flat at center so ZERO slabs block interior shots!)
  for (let b = 0; b < numBays; b++) {
    const bz = cz - verandaSpanZ * 0.5 + (b + 0.5) * bayPitchZ;
    if (b === 4) {
      // Central royal portal leaves folded cleanly outside the central nave columns so interior view is 100% wide & unobstructed!
      for (const s of [-1, 1]) {
        addBox(crimsonParts, 0.14, colH * 0.74, 0.75, doorX + 0.14, floorY + colH * 0.37, bz + s * (bayPitchZ * 0.68), 0);
        addBox(goldParts, 0.16, 0.10, 0.68, doorX + 0.14, floorY + colH * 0.37, bz + s * (bayPitchZ * 0.68), 0);
      }
      continue;
    }
    if (b === 0 || b === 8) continue;
    // 4-leaf folding glazed-lattice & double-panel crimson door leaves (partially folded with warm amber glazing so harsh sunlight doesn't bleach aisle floor!)
    const leafW = (bayPitchZ - 0.52) / 4;
    for (let lf = 0; lf < 4; lf++) {
      const lz = bz - (bayPitchZ - 0.52) * 0.5 + (lf + 0.5) * leafW;
      const openAng = lf === 0 ? 0.35 : lf === 3 ? -0.35 : (lf === 1 ? 0.14 : -0.14);
      addBox(crimsonParts, 0.12, 1.85, leafW * 0.94, doorX, floorY + 0.94, lz, openAng);
      addBox(goldParts, 0.14, 0.08, leafW * 0.86, doorX, floorY + 1.78, lz, openAng);
      addBox(goldParts, 0.14, 0.08, leafW * 0.86, doorX, floorY + 0.22, lz, openAng);
      addBox(crimsonParts, 0.10, 0.14, leafW * 0.94, doorX, floorY + colH * 0.76, lz, openAng);
      // Warm amber glazed upper window backing + crimson lattice mullions (Photo 5 left!)
      addBox(rafterGoldParts, 0.04, colH * 0.40, leafW * 0.86, doorX, floorY + 1.85 + colH * 0.20, lz, openAng);
      for (const mOff of [-leafW * 0.32, 0, leafW * 0.32]) {
        addBox(crimsonParts, 0.08, colH * 0.42, 0.06, doorX, floorY + 1.85 + colH * 0.21, lz + mOff, openAng);
      }
      addBox(crimsonParts, 0.08, 0.06, leafW * 0.90, doorX, floorY + 1.85 + colH * 0.21, lz, openAng);
    }
  }

  // Front Veranda Porcelain Bonsai Planters & Conical Topiaries Flanking End Walls (Photo 6!)
  for (const s of [-1, 1]) {
    addTerracottaPorcelainBonsai(
      terracottaParts,
      porcelainParts,
      darkWoodParts,
      foliageParts,
      verandaX + 1.15,
      floorY,
      cz + s * (bayPitchZ * 1.15),
      0.86,
      false
    );
    // Trimmed conical dark-green leafy topiary trees fronting outer white-plaster corners (Photo 6!)
    const tx = verandaX + 1.15;
    const tz = cz + s * (halfZ - 0.5);
    addBox(thanhStoneParts, 0.92, 0.55, 0.92, tx, floorY + 0.275, tz);
    addCyl(darkWoodParts, 0.10, 0.13, 0.75, 6, tx, floorY + 0.85, tz);
    for (let t = 0; t < 4; t++) {
      const cardW = 1.45 - t * 0.26;
      const col = t === 0 ? '#204b1a' : t === 1 ? '#2b6322' : '#397b2c';
      for (let c = 0; c < 3; c++) {
        const card = new THREE.PlaneGeometry(cardW, 0.95);
        card.rotateY((c / 3) * Math.PI + t * 0.4);
        card.translate(tx, floorY + 1.38 + t * 0.48, tz);
        foliageParts.push(colorizeGeometry(card, col));
      }
    }
  }

  // 3. White-Plaster Exterior End Walls (`Tường Hồi`) & Rich Golden-Ochre Panelled Interior Walls (`Vách Đố Bản`, Photos 1, 3, 5, 6!)
  const wallH = colH + 0.35;
  // Exterior white plaster side walls & rear wall (strictly trimmed below roof eaves so zero "ears" poke through!)
  addBox(plasterParts, depthX, wallH, 0.45, hx, floorY + wallH * 0.5, cz - halfZ);
  addBox(plasterParts, depthX, wallH, 0.45, hx, floorY + wallH * 0.5, cz + halfZ);
  addBox(plasterParts, 0.45, wallH, widthZ, rearX, floorY + wallH * 0.5, cz);
  // Subtle front-facing white-plaster end pilasters with centered crimson Chữ Thọ medallions (Photo 6 corners!)
  for (const s of [-1, 1]) {
    addBox(plasterParts, 0.55, colH * 0.78, 1.85, frontX - 0.2, floorY + colH * 0.39, cz + s * (halfZ - 0.9));
    // Crimson circular Chữ Thọ medallion on side walls
    for (const gx of [hx + depthX * 0.24, hx - depthX * 0.24]) {
      const rim = new THREE.TorusGeometry(1.05, 0.11, 6, 18);
      rim.translate(gx, floorY + wallH * 0.54, cz + s * (halfZ + 0.25));
      crimsonParts.push(rim);
      goldParts.push(...createShouCharacterParts(gx, floorY + wallH * 0.54, cz + s * (halfZ + 0.28), 0.44, 'tron', s < 0 ? Math.PI : 0));
    }
  }

  // Rich Golden-Ochre Panelled Interior Walls (`Vách Đố Bản Sơn Vàng Viền Đỏ` — Photos 1, 3, 5!)
  const makeVachWall = (w: number, h: number, px: number, py: number, pz: number, ry: number) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(ry);
    geo.translate(px, py, pz);
    const mesh = new THREE.Mesh(geo, hp.vachDoBanMat);
    mesh.receiveShadow = true;
    targetGroup.add(mesh);
  };
  // North, South, and Rear West interior walls clad in golden-ochre Vách Đố Bản
  makeVachWall(depthX - 0.8, wallH - 0.2, hx, floorY + wallH * 0.5, cz - halfZ + 0.28, 0);
  makeVachWall(depthX - 0.8, wallH - 0.2, hx, floorY + wallH * 0.5, cz + halfZ - 0.28, Math.PI);
  makeVachWall(widthZ - 0.8, wallH - 0.2, rearX + 0.28, floorY + wallH * 0.5, cz, Math.PI * 0.5);

  // Framed deep recessed side doorways on Rear West wall flanking the Golden Throne (Photo 1 & Photo 3!)
  for (const s of [-1, 1]) {
    const dz = cz + s * (halfZ * 0.56);
    addBox(crimsonParts, 0.24, 3.6, 2.35, rearX + 0.36, floorY + 1.8, dz);
    addBox(goldParts, 0.28, 0.14, 2.55, rearX + 0.40, floorY + 3.65, dz);
  }

  // 4. EXPOSED VAULTED TIMBER ROOF & 4-TIER STEPPED `CHỒNG RƯỜNG — GIẢ THỦ` TRUSSES (Photos 1, 3, 5!)
  //    PROPERLY ORIENTED: Main ridge & parallel purlins run along Z (widthZ), 8 transverse 4-tier trusses span X,
  //    and 52 alternating crimson/gold rafters slope along East (+X) and West (-X) pitches strictly INSIDE the exterior yellow roofs!
  const beamBaseY = floorY + colH + 0.28;
  const ridgePeakY = beamBaseY + (opts.fullHeroInterior ? 2.45 : 2.15);
  const vaultSpanX = depthX - 2.6;
  const vaultHalfX = vaultSpanX * 0.5;

  // Longitudinal tie-beams (`xà dọc`) running along Z across every X column row
  for (let r = 0; r < colRowsX; r++) {
    const rx = frontBayX - r * rowPitchX;
    addBox(crimsonParts, 0.30, 0.36, widthZ - 1.2, rx, beamBaseY, cz);
    addBox(goldParts, 0.34, 0.08, widthZ - 1.4, rx, beamBaseY - 0.16, cz);
  }

  // 8 Transverse 4-Tier Stepped `Chồng Rường — Giả Thủ` Trusses along Z, each spanning front-to-back along X (Photo 5 centerpiece!)
  for (const zOff of trussZLines) {
    const tz = cz + zOff;
    // Lower continuous main tie-beam spanning hall depth X
    addBox(crimsonParts, vaultSpanX, 0.38, 0.32, hx, beamBaseY, tz);
    // Gilded cloud cartouches centered & flanking on tie-beam faces (Photo 5!)
    for (const cxOff of [-vaultHalfX * 0.52, 0, vaultHalfX * 0.52]) {
      addBox(goldParts, 1.05, 0.20, 0.36, hx + cxOff, beamBaseY, tz);
    }

    // 4 Stepped `Chồng Rường` stacked horizontal truss beams climbing cleanly toward the central Z-ridge!
    const tierSpecs: Array<[number, number]> = [
      [0.54, vaultSpanX * 0.72],
      [1.04, vaultSpanX * 0.54],
      [1.52, vaultSpanX * 0.36],
      [1.98, vaultSpanX * 0.20]
    ];
    for (let tIdx = 0; tIdx < tierSpecs.length; tIdx++) {
      const [dy, spanX] = tierSpecs[tIdx];
      const ty = beamBaseY + dy;
      addBox(crimsonParts, spanX, 0.28, 0.28, hx, ty, tz);
      // Gilded cartouche plaques on each stepped beam
      addBox(goldParts, Math.min(1.15, spanX * 0.30), 0.16, 0.32, hx, ty, tz);
      for (const s of [-1, 1]) {
        // Interlocking crimson-and-gold `Giả Thủ / Chữ Vạn` vertical & stepped truss struts supporting each beam
        const strutX = hx + s * (spanX * 0.42);
        addBox(crimsonParts, 0.24, 0.52, 0.24, strutX, ty - 0.26, tz);
        addBox(goldParts, 0.36, 0.12, 0.28, strutX, ty - 0.11, tz);
        addBox(goldParts, 0.34, 0.12, 0.28, strutX, ty - 0.40, tz);
      }
    }

    // Sloped diagonal `Kèo Quyết` rafters descending from central Z-ridge toward East (+X) front & West (-X) rear (Photos 1, 3, 5!)
    for (const s of [-1, 1]) {
      const slopeLen = Math.hypot(vaultHalfX, ridgePeakY - beamBaseY);
      const slopeAng = Math.atan2(ridgePeakY - beamBaseY, vaultHalfX);
      addBox(
        crimsonParts,
        slopeLen,
        0.26,
        0.24,
        hx + s * (vaultHalfX * 0.5),
        (beamBaseY + ridgePeakY) * 0.5 + 0.08,
        tz,
        0,
        0,
        -s * slopeAng
      );
      addBox(
        goldParts,
        slopeLen * 0.92,
        0.09,
        0.28,
        hx + s * (vaultHalfX * 0.5),
        (beamBaseY + ridgePeakY) * 0.5 - 0.04,
        tz,
        0,
        0,
        -s * slopeAng
      );
    }
  }

  // Dense Exposed Parallel Rafters (`Rui Mè`) & Cylindrical Purlins (`Đòn Tay`) running along Z (Photos 1, 3, 5!)
  const numPurlinsPerSlope = 6;
  for (const s of [-1, 1]) {
    const slopeAng = Math.atan2(ridgePeakY - beamBaseY, vaultHalfX);
    // Cylindrical crimson purlins running lengthwise along Z
    for (let p = 0; p < numPurlinsPerSlope; p++) {
      const frac = (p + 0.5) / numPurlinsPerSlope;
      const px = hx + s * (frac * vaultHalfX);
      const py = THREE.MathUtils.lerp(ridgePeakY + 0.06, beamBaseY + 0.16, frac);
      addCyl(crimsonParts, 0.095, 0.095, widthZ - 0.8, 8, px, py, cz, Math.PI * 0.5, 0);
    }
    // Dense closely-spaced parallel alternating crimson & orange-gold rafters sloping East/West directly above Hoành Phi (Photo 3!)
    const numRafters = opts.fullHeroInterior ? 52 : 36;
    const slopeLen = Math.hypot(vaultHalfX + 0.2, ridgePeakY - beamBaseY);
    for (let rf = 0; rf < numRafters; rf++) {
      const rz = cz - (halfZ - 0.7) + (rf / (numRafters - 1)) * (widthZ - 1.4);
      const target = rf % 2 === 0 ? crimsonParts : rafterGoldParts;
      addBox(
        target,
        slopeLen,
        0.10,
        0.10,
        hx + s * (vaultHalfX * 0.5),
        (beamBaseY + ridgePeakY) * 0.5 + 0.24,
        rz,
        0,
        0,
        -s * slopeAng
      );
    }
    // Deep crimson roof plank backing sheathing strictly BELOW exterior yellow roofs so ZERO sky leaks in and ZERO poke-through!
    addBox(
      crimsonParts,
      slopeLen + 0.2,
      0.12,
      widthZ - 0.6,
      hx + s * (vaultHalfX * 0.5),
      (beamBaseY + ridgePeakY) * 0.5 + 0.36,
      cz,
      0,
      0,
      -s * slopeAng
    );
  }
  // Central ridge purlin along Z
  addCyl(crimsonParts, 0.13, 0.13, widthZ - 0.8, 10, hx, ridgePeakY + 0.10, cz, Math.PI * 0.5, 0);

  // 5. GRAND INTERIOR `"殿和太"` HOÀNH PHI PLAQUE + 2-TIER `NHẤT THI NHẤT HỌA` FRIEZES (Photos 1, 3, 5!)
  //    Mounted cleanly at the 1st inner nave column frame (`heroFrameX = frontBayX - rowPitchX`) where vaulted ceiling is high above -> 100% UNOBSTRUCTED dead-center hero!
  const heroFrameX = frontBayX - rowPitchX;
  const plaqueW = opts.fullHeroInterior ? 3.55 : 2.85;
  const plaqueH = opts.fullHeroInterior ? 2.02 : 1.62;
  const plaqueY = beamBaseY + 0.62;
  const plaqueX = heroFrameX + 0.36;

  // 3D Carved Gilded Scrollwork Border Backing + 3 Iconic Golden Bottom Loops (Photos 1 & 3!)
  addBox(goldParts, 0.18, plaqueH + 0.24, plaqueW + 0.24, plaqueX - 0.08, plaqueY, cz, 0, 0, 0.08);
  for (const lOff of [-plaqueW * 0.30, 0, plaqueW * 0.30]) {
    const loop = new THREE.TorusGeometry(0.085, 0.025, 6, 12);
    loop.rotateY(Math.PI * 0.5);
    loop.translate(plaqueX - 0.02, plaqueY - plaqueH * 0.5 - 0.14, cz + lOff);
    goldParts.push(loop);
  }
  const hpPlane = new THREE.PlaneGeometry(plaqueW, plaqueH);
  hpPlane.rotateY(Math.PI * 0.5);
  hpPlane.rotateZ(0.08);
  hpPlane.translate(plaqueX + 0.03, plaqueY, cz);
  const hpMesh = new THREE.Mesh(hpPlane, hp.hoanhPhiThaiHoaMat);
  targetGroup.add(hpMesh);

  // Continuous 2-Tier Interior `Nhất Thi Nhất Họa` Frieze spanning full hall width directly BENEATH `"殿和太"` at heroFrameX (Photos 1, 3, 5!)
  const friezeH = 1.48;
  const friezeY = beamBaseY - 0.80;
  const addInteriorFriezeBand = (fx: number, zMin: number, zMax: number, faceDir: 1 | -1) => {
    const span = zMax - zMin;
    const panels = Math.max(1, Math.round(span / 4.4));
    const pw = span / panels;
    for (let i = 0; i < panels; i++) {
      const pz = zMin + (i + 0.5) * pw;
      const pGeo = new THREE.PlaneGeometry(pw - 0.08, friezeH);
      pGeo.rotateY(faceDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      pGeo.translate(fx + faceDir * 0.18, friezeY, pz);
      targetGroup.add(new THREE.Mesh(pGeo, hp.interiorNhatThiMat));
      addBox(crimsonParts, 0.22, friezeH + 0.10, pw, fx, friezeY, pz);
    }
  };
  addInteriorFriezeBand(heroFrameX, cz - halfZ + 0.8, cz + halfZ - 0.8, 1);

  // Longitudinal upper `Nhất Thi Nhất Họa` frieze strips above the East front doors facing INWARD (-X) cleanly offset so ZERO blank backside appears in Photo 5!
  const doorFriezeCount = 6;
  const dfW = (widthZ - 2.0) / doorFriezeCount;
  for (let i = 0; i < doorFriezeCount; i++) {
    const fz = cz - (widthZ - 2.0) * 0.5 + (i + 0.5) * dfW;
    const fg = new THREE.PlaneGeometry(dfW - 0.1, 1.18);
    fg.rotateY(-Math.PI * 0.5);
    fg.translate(doorX - 0.24, beamBaseY - 0.72, fz);
    targetGroup.add(new THREE.Mesh(fg, hp.interiorNhatThiMat));
  }

  // 6. FOREGROUND 3-DRAGON-LEGGED BRONZE CAULDRON (`BỬU ĐỈNH`) & RED `CHỮ THỌ` BARRIER FENCE (Photo 1!)
  const cauldronX = frontBayX + 1.05;
  addBuuDinhBronzeCauldron(bronzeParts, cauldronX, floorY, cz, opts.fullHeroInterior ? 1.06 : 0.90);
  addCrimsonChuThoBarrier(
    brightRedParts,
    frontBayX + 0.15,
    floorY,
    cz,
    halfZ - 0.9,
    1.15
  );

  // Flanking Antique Bronze Kỳ Lân Guardians on Crimson-and-Gold Pedestals & Lathe-Sculpted Porcelain Vases inside the Hall (Photo 1!)
  const vaseProfile = [
    new THREE.Vector2(0.18, 0.0),
    new THREE.Vector2(0.24, 0.14),
    new THREE.Vector2(0.20, 0.34),
    new THREE.Vector2(0.32, 0.68),
    new THREE.Vector2(0.26, 0.96),
    new THREE.Vector2(0.16, 1.12),
    new THREE.Vector2(0.23, 1.26)
  ];
  for (const s of [-1, 1]) {
    const klX = frontBayX - rowPitchX * 1.4;
    const klZ = cz + s * (8.6 * zScale);
    addBox(crimsonParts, 1.18, 0.92, 1.18, klX, floorY + 0.46, klZ);
    addBox(goldParts, 1.24, 0.09, 1.24, klX, floorY + 0.94, klZ);
    addBox(goldParts, 1.24, 0.08, 1.24, klX, floorY + 0.08, klZ);
    bronzeParts.push(...createGuardianBeastParts(klX, floorY + 0.98, klZ, Math.PI * 0.5, 1.05, 'kylan'));

    for (const vOff of [5.8 * zScale, 11.2 * zScale]) {
      const vx = rearX + 5.8;
      const vz = cz + s * vOff;
      addBox(crimsonParts, 0.66, 0.48, 0.66, vx, floorY + 0.24, vz);
      addBox(goldParts, 0.70, 0.06, 0.70, vx, floorY + 0.50, vz);
      const vaseGeo = new THREE.LatheGeometry(vaseProfile, 14);
      vaseGeo.translate(vx, floorY + 0.52, vz);
      porcelainParts.push(vaseGeo);
    }
  }

  // 7. BLAZING GOLDEN INNER SANCTUM: DOUBLE-LAYERED FILIGREE `CỬA VÕNG`, 3-TIER DAIS, `NGAI VÀNG` & `BỬU TÁN` + `CỬU LONG ẨN VÂN` (Photos 1, 3, 4!)
  const throneX = rearX + (opts.fullHeroInterior ? 6.8 : 5.4);
  const naveHalfZ = 2.75 * zScale;

  // Double-layered alpha-cutout carved golden openwork `Cửa Võng` filigree arches (Photos 1 & 3 — crisp lacework, ZERO blocky planks!)
  const cvH = 2.65;
  for (const cvX of [throneX + 4.8, throneX + 2.55]) {
    const cvPlane = new THREE.PlaneGeometry(naveHalfZ * 1.94, cvH);
    cvPlane.rotateY(Math.PI * 0.5);
    cvPlane.translate(cvX, beamBaseY - 0.15 - cvH * 0.5, cz);
    targetGroup.add(new THREE.Mesh(cvPlane, hp.cuaVongFiligreeMat));
    // Crisp slim gilded cornice bar framing top of Cửa Võng
    addBox(goldParts, 0.14, 0.14, naveHalfZ * 1.98, cvX, beamBaseY - 0.12, cz);
  }

  // 3-Tier Dark-Ironwood & Gilded-Dragon-Relief Throne Dais (`Bệ Ngai Vàng`, Photo 3!)
  const daisTiers: Array<[number, number, number]> = [
    [5.8, 5.4, 0.30],
    [4.4, 4.1, 0.30],
    [3.1, 2.9, 0.30]
  ];
  let daisTopY = floorY;
  for (const [dw, dd, dh] of daisTiers) {
    addBox(ironwoodParts, dw, dh, dd, throneX, daisTopY + dh * 0.5, cz);
    addBox(goldParts, dw + 0.12, 0.08, dd + 0.12, throneX, daisTopY + dh - 0.02, cz);
    addBox(goldParts, 0.10, dh * 0.72, dd + 0.08, throneX + dw * 0.5, daisTopY + dh * 0.5, cz);
    daisTopY += dh;
  }

  // Sculpted Golden Dragon Throne (`Ngai Vàng Triều Nguyễn`)
  const thrY = daisTopY;
  addBox(goldParts, 1.44, 0.28, 1.38, throneX - 0.18, thrY + 0.42, cz);
  addBox(crimsonParts, 1.22, 0.12, 1.16, throneX - 0.14, thrY + 0.60, cz);
  for (const lx of [-0.58, 0.58]) {
    for (const lz of [-0.56, 0.56]) {
      addCyl(goldParts, 0.10, 0.08, 0.42, 7, throneX - 0.18 + lx, thrY + 0.21, cz + lz);
    }
  }
  addBox(goldParts, 0.20, 1.22, 1.44, throneX - 0.84, thrY + 1.08, cz);
  const backArch = new THREE.TorusGeometry(0.70, 0.09, 6, 14, Math.PI);
  backArch.rotateY(Math.PI * 0.5);
  backArch.translate(throneX - 0.84, thrY + 1.62, cz);
  goldParts.push(backArch);
  for (const s of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(throneX - 0.82, thrY + 1.40, cz + s * 0.68),
      new THREE.Vector3(throneX - 0.34, thrY + 1.12, cz + s * 0.75),
      new THREE.Vector3(throneX + 0.26, thrY + 1.04, cz + s * 0.70),
      new THREE.Vector3(throneX + 0.56, thrY + 1.26, cz + s * 0.62)
    ]);
    goldParts.push(new THREE.TubeGeometry(armCurve, 10, 0.10, 6, false));
    addCyl(goldParts, 0.08, 0.09, 0.58, 6, throneX + 0.34, thrY + 0.78, cz + s * 0.65);
  }
  // Royal footstool
  addBox(goldParts, 0.68, 0.22, 0.90, throneX + 1.02, thrY + 0.11, cz);
  addBox(crimsonParts, 0.58, 0.06, 0.80, throneX + 1.02, thrY + 0.24, cz);
  // Luminous golden carved backdrop screen directly behind the Throne (Photo 3 glowing golden sanctuary!)
  addBox(goldParts, 0.26, 4.9, 5.8, throneX - 2.65, floorY + 2.6, cz);

  // SQUARE GILDED `BỬU TÁN` CANOPY WITH UNOBSTRUCTED 1024×1024 `CỬU LONG ẨN VÂN` CEILING MASTERPIECE (Photo 4!)
  const buuTanY = floorY + (opts.fullHeroInterior ? 4.45 : 4.15);
  const btSpan = 3.55;
  // Downward-facing 1024×1024 polychrome `Cửu Long Ẩn Vân` ceiling panel (completely unobstructed from below!)
  const clPlane = new THREE.PlaneGeometry(btSpan - 0.22, btSpan - 0.22);
  clPlane.rotateX(Math.PI * 0.5); // Normal pointing straight DOWN (-Y) so upward-looking viewer sees Photo 4 crisply!
  clPlane.translate(throneX, buuTanY + 0.18, cz);
  const clMesh = new THREE.Mesh(clPlane, hp.cuuLongAnVanMat);
  targetGroup.add(clMesh);

  // Thick 3D carved golden coffer fascia walls + stepped cornice + scalloped fringe lappets + 4 corner crimson-gold tassels!
  for (const s of [-1, 1]) {
    addBox(goldParts, btSpan + 0.24, 0.56, 0.18, throneX, buuTanY + 0.38, cz + s * (btSpan * 0.5));
    addBox(goldParts, btSpan + 0.52, 0.18, 0.28, throneX, buuTanY + 0.72, cz + s * (btSpan * 0.5 + 0.08));
    addBox(goldParts, 0.18, 0.56, btSpan + 0.24, throneX + s * (btSpan * 0.5), buuTanY + 0.38, cz);
    addBox(goldParts, 0.28, 0.18, btSpan + 0.52, throneX + s * (btSpan * 0.5 + 0.08), buuTanY + 0.72, cz);
    for (let k = -2; k <= 2; k++) {
      const off = k * 0.62;
      const sc1 = new THREE.ConeGeometry(0.18, 0.36, 4);
      sc1.rotateX(Math.PI);
      sc1.translate(throneX + off, buuTanY - 0.06, cz + s * (btSpan * 0.5));
      goldParts.push(sc1);
      const sc2 = new THREE.ConeGeometry(0.18, 0.36, 4);
      sc2.rotateX(Math.PI);
      sc2.translate(throneX + s * (btSpan * 0.5), buuTanY - 0.06, cz + off);
      goldParts.push(sc2);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tx = throneX + sx * (btSpan * 0.49);
      const tz = cz + sz * (btSpan * 0.49);
      addBox(goldParts, 0.32, 0.38, 0.32, tx, buuTanY + 0.80, tz);
      addCyl(goldParts, 0.10, 0.05, 0.85, 7, tx, buuTanY - 0.35, tz);
      addCyl(crimsonParts, 0.08, 0.14, 0.72, 7, tx, buuTanY - 0.82, tz);
    }
  }

  // 8. EXTERIOR `TRÙNG THIỀM ĐIỆP ỐC` DOUBLE-TIER `HOÀNG LƯU LY` TUBULAR-TILE ROOFS + `CỔ DIÊM` FRIEZE + `CỬU LONG` CROWN (Photo 6!)
  //    Taut ~4:1 horizontal silhouette strictly ABOVE interior vault sheathing -> ZERO poke-through AND ZERO interior clipping!
  const lowerEaveY = floorY + colH * 0.82 + 0.24;
  const frontRoofDepth = depthX * 0.56;
  const rearRoofDepth = depthX * 0.58;
  const frontHallX = hx + depthX * 0.24;
  const rearHallX = hx - depthX * 0.24;

  // Dark-brown overhanging front veranda fascia trim (*diềm mái hiên*, Photo 6)
  addBox(darkWoodParts, 0.36, 0.22, widthZ + 2.4, verandaX + 0.95, lowerEaveY - 0.04, cz);

  // Subtle classic gilded "殿 和 太" plaque tucked cleanly UNDER the shaded central veranda beam
  const extPlaque = createSignagePlaqueMesh(
    { text: '殿 和 太', subText: 'ĐIỆN THÁI HÒA', width: 2.65, height: 0.72, depth: 0.12, style: 'royal', motifSeed: 1805 },
    ctx
  );
  extPlaque.rotation.y = Math.PI * 0.5;
  extPlaque.position.set(verandaX + 0.18, lowerEaveY - 0.48, cz);
  targetGroup.add(extPlaque);

  // Lower Tier-1 Hoàng Lưu Ly tubular-tile roof skirt (TRUE wide-ridge imperial hipped roofs -> ZERO cone collapse, ZERO sky gap!)
  const lowRoofH = 2.40;
  const frontLow = createHueImperialHipRoofGeometry(
    frontRoofDepth + 4.4,
    widthZ + 3.6,
    frontRoofDepth * 0.68,
    widthZ - 4.2,
    lowRoofH,
    0.24,
    14,
    10,
    false
  );
  frontLow.translate(frontHallX + 0.6, lowerEaveY, cz);
  yellowRoofParts.push(frontLow);

  const rearLow = createHueImperialHipRoofGeometry(
    rearRoofDepth + 4.0,
    widthZ + 3.6,
    rearRoofDepth * 0.68,
    widthZ - 4.2,
    lowRoofH + 0.15,
    0.24,
    14,
    10,
    false
  );
  rearLow.translate(rearHallX - 0.4, lowerEaveY + 0.12, cz);
  yellowRoofParts.push(rearLow);

  // Crisp Jewel-Like Continuous `Cổ Diêm Nhất Thi Nhất Họa` Enamel Frieze sitting FLUSH between Lower & Upper Yellow Roofs (Photo 6!)
  const coDiemH = 0.82;
  const coDiemY = lowerEaveY + lowRoofH + coDiemH * 0.5 - 0.06;
  const upperBaseY = coDiemY + coDiemH * 0.5 - 0.04;
  const upperRoofH = opts.fullHeroInterior ? 2.85 : 2.50;

  // Recessed Thừa Lưu valley roof cleanly bridging frontHigh & rearHigh inside the twin roof valley (invisible on Photo 6, clean on Photo 7!)
  addBox(yellowRoofParts, 5.6, 0.28, widthZ - 5.2, hx, upperBaseY + 0.34, cz);

  // Front Hall Cổ Diêm clerestory drum & East-facing vivid multicolor enamel plaques (4 crisp squares across 39m!)
  const cdW = frontRoofDepth * 0.64;
  const cdZ = widthZ - 4.8;
  addBox(crimsonParts, cdW, coDiemH, cdZ, frontHallX + 0.4, coDiemY, cz);
  const numFriezeSegs = 4;
  const fSegW = (cdZ - 0.6) / numFriezeSegs;
  for (let fi = 0; fi < numFriezeSegs; fi++) {
    const fz = cz - (cdZ - 0.6) * 0.5 + (fi + 0.5) * fSegW;
    const fPlaque = createSignagePlaqueMesh(
      { text: '', style: 'nhat_thi_nhat_hoa', width: fSegW - 0.08, height: coDiemH - 0.06, depth: 0.12, motifSeed: 1805 + fi },
      ctx
    );
    fPlaque.rotation.y = Math.PI * 0.5;
    fPlaque.position.set(frontHallX + 0.4 + cdW * 0.5 + 0.05, coDiemY, fz);
    targetGroup.add(fPlaque);
  }
  // North & South Cổ Diêm side plaques
  for (const s of [-1, 1]) {
    const sPlaque = createSignagePlaqueMesh(
      { text: '', style: 'nhat_thi_nhat_hoa', width: cdW - 0.4, height: coDiemH - 0.06, depth: 0.12, motifSeed: 1820 + (s > 0 ? 1 : 0) },
      ctx
    );
    if (s < 0) sPlaque.rotation.y = Math.PI;
    sPlaque.position.set(frontHallX + 0.4, coDiemY, cz + s * (cdZ * 0.5 + 0.05));
    targetGroup.add(sPlaque);
  }

  // Upper Tier-2 Hoàng Lưu Ly Tubular-Tile Roofs (TRUE full-width horizontal ridge -> ZERO sky gap under Cửu Long ridge bar!)
  const frontHigh = createHueImperialHipRoofGeometry(
    cdW + 2.8,
    cdZ + 3.2,
    1.8,
    cdZ - 4.6,
    upperRoofH,
    0.32,
    16,
    10
  );
  frontHigh.translate(frontHallX + 0.4, upperBaseY, cz);
  yellowRoofParts.push(frontHigh);

  const rearHigh = createHueImperialHipRoofGeometry(
    rearRoofDepth * 0.68 + 2.8,
    cdZ + 3.4,
    1.8,
    cdZ - 4.4,
    upperRoofH + 0.25,
    0.32,
    16,
    10
  );
  rearHigh.translate(rearHallX - 0.3, upperBaseY + 0.12, cz);
  yellowRoofParts.push(rearHigh);

  // Full Sculpted 9-Dragon `Cửu Long` Ceramic-Mosaic Roof Crown on Front & Main Ridges (Photo 6!)
  addCuuLongCeramicRoofDragons(
    ceramicParts,
    goldParts,
    frontHallX + 0.4,
    upperBaseY + upperRoofH,
    cz,
    cdZ - 4.6,
    (cdW + 2.8) * 0.48,
    (cdZ + 3.2) * 0.48,
    upperRoofH - 0.32,
    opts.fullHeroInterior ? 0.92 : 0.78
  );
  addCuuLongCeramicRoofDragons(
    ceramicParts,
    goldParts,
    rearHallX - 0.3,
    upperBaseY + upperRoofH + 0.37,
    cz,
    cdZ - 4.4,
    (rearRoofDepth * 0.68 + 2.8) * 0.48,
    (cdZ + 3.4) * 0.48,
    upperRoofH - 0.12,
    opts.fullHeroInterior ? 0.96 : 0.80
  );

  // 9. Warm Architectural Interior Spotlights & Additive 6-Ray Starburst Glints (Photos 1, 3, 5 — active in BOTH Core & Macro!)
  const naveLight = new THREE.PointLight('#ffd074', opts.fullHeroInterior ? 16.0 : 12.0, 38, 1.35);
  naveLight.position.set(heroFrameX + 1.4, beamBaseY - 0.5, cz);
  const throneLight = new THREE.PointLight('#ffbe52', opts.fullHeroInterior ? 18.0 : 14.0, 34, 1.35);
  throneLight.position.set(throneX + 3.4, floorY + 2.4, cz);
  targetGroup.add(naveLight, throneLight);

  const bulbCoords: Array<[number, number, number, number]> = [
    [heroFrameX + 0.42, plaqueY + 0.16, cz - 2.35 * zScale, 1.55],
    [heroFrameX + 0.42, plaqueY + 0.16, cz + 2.35 * zScale, 1.55],
    [heroFrameX, beamBaseY - 0.38, cz - 2.75 * zScale, 1.25],
    [heroFrameX, beamBaseY - 0.38, cz + 2.75 * zScale, 1.25],
    [frontBayX - rowPitchX * 2, beamBaseY - 0.38, cz - 2.75 * zScale, 1.15],
    [frontBayX - rowPitchX * 2, beamBaseY - 0.38, cz + 2.75 * zScale, 1.15],
    [frontBayX - rowPitchX * 3, beamBaseY - 0.38, cz - 2.75 * zScale, 1.10],
    [frontBayX - rowPitchX * 3, beamBaseY - 0.38, cz + 2.75 * zScale, 1.10],
    [throneX + 1.6, buuTanY - 0.15, cz - 1.5 * zScale, 1.0],
    [throneX + 1.6, buuTanY - 0.15, cz + 1.5 * zScale, 1.0],
    [heroFrameX, beamBaseY - 0.38, cz - 6.0 * zScale, 1.25],
    [heroFrameX, beamBaseY - 0.38, cz + 6.0 * zScale, 1.25]
  ];
  for (const [sx, sy, sz, sc] of bulbCoords) {
    const spr = new THREE.Sprite(hp.starburstFlareMat);
    spr.position.set(sx, sy, sz);
    spr.scale.set(sc, sc, 1);
    targetGroup.add(spr);
  }

  // Merge all sub-meshes cleanly with shadow-caster budget discipline (`castShadow = false` on interior filigree/ornaments!)
  const addMerged = (
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
    worldUvMeters?: number
  ) => {
    if (parts.length === 0) return;
    let geo = mergeNormalized(parts);
    if (worldUvMeters) geo = applyWorldBoxUV(geo, worldUvMeters);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    targetGroup.add(mesh);
  };

  const rafterOrangeMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#d45a16', roughness: 0.44, metalness: 0.08 }) ??
    ctx.materials.yellowOchrePlaster;

  addMerged(thanhStoneParts, hp.thanhStoneMat, true, true, 2.8);
  addMerged(plasterParts, ctx.materials.whitePlaster, true, true, 3.2);
  addMerged(crimsonParts, hp.imperialCrimsonWoodMat, true, true);
  addMerged(brightRedParts, hp.brightBarrierRedMat, false, true);
  addMerged(goldParts, ctx.materials.gold, false, false);
  addMerged(rafterGoldParts, rafterOrangeMat, false, false);
  addMerged(ceramicParts, hp.ceramicMosaicMat, false, true);
  addMerged(bronzeParts, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(ironwoodParts, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addMerged(darkWoodParts, ctx.materials.darkWood, false, true);
  addMerged(porcelainParts, hp.porcelainCobaltMat, false, true);
  addMerged(terracottaParts, hp.terracottaBalustradeMat, false, true);
  addMerged(yellowRoofParts, hp.hoangLuuLyMat, true, true);

  if (foliageParts.length > 0) {
    const folMat = ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02
    }) ?? new THREE.MeshStandardMaterial({ map: ctx.pbr.leafAtlas, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72 });
    addMerged(foliageParts, folMat, false, true);
  }

  tagMotifIds(targetGroup, [
    'HV-A03', 'HV-A04', 'HV-A09', 'HV-A10', 'HV-B01', 'HV-C02', 'HV-D01', 'HV-D02',
    'HV-D03', 'HV-D12', 'HV-D15', 'HV-E05', 'HV-I01', 'HV-I05', 'HV-J01', 'HV-J03', 'HV-J04', 'HV-NEW-MT-15'
  ]);

  return {
    plinthTopY: floorY,
    frontEdgeX: frontX,
    rearEdgeX: rearX,
    throneX,
    buuTanY
  };
}

/**
 * Helper to add a lush organic leafy dark-green royal palace shade tree (Photo 6 backdrop & Photo 7 gardens!)
 */
export function addRoyalGardenTree(
  trunkParts: THREE.BufferGeometry[],
  canopyParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale = 1.0,
  seed = 1
): void {
  const s = scale;
  addCyl(trunkParts, 0.28 * s, 0.46 * s, 5.2 * s, 7, x, y + 2.6 * s, z);
  const shades = ['#1e4c19', '#275f20', '#317228', '#3c8531'];
  const puffs: Array<[number, number, number, number]> = [
    [0, 6.4, 0, 5.2],
    [2.1, 5.6, 1.3, 4.1],
    [-2.0, 5.8, -1.2, 4.2],
    [1.4, 7.6, -1.1, 3.6],
    [-1.5, 7.2, 1.4, 3.8],
    [0.2, 8.6, 0.1, 3.2]
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [ox, oy, oz, rad] = puffs[i];
    const ang = seed * 1.37;
    const rx = ox * Math.cos(ang) - oz * Math.sin(ang);
    const rz = ox * Math.sin(ang) + oz * Math.cos(ang);
    const col = shades[(i + seed) % shades.length];
    for (let c = 0; c < 3; c++) {
      const card = new THREE.PlaneGeometry(rad * s, rad * s * 0.85);
      card.rotateX(c === 0 ? 0.38 : c === 1 ? -0.38 : 0.05);
      card.rotateY((c / 3) * Math.PI + seed * 0.9 + i * 0.6);
      card.translate(x + rx * s, y + oy * s, z + rz * s);
      canopyParts.push(colorizeGeometry(card, col));
    }
  }
}

/**
 * Builds the COMPLETE **Hoàng Cung Huế (Đại Nội Huế)** Macro Compound (`HueGrandImperialPalace` at `-660, 80`)
 * faithfully reconstructing:
 * - **Photo 6:** 2-tier Sân Đại Triều Nghi (Lower `Sân Hạ` + Upper `Sân Thượng` in blue-grey Thanh stone),
 *   wide 7-step central staircase with massive crouching-dragon stone balustrades, 2 tall terracotta-red pedestals
 *   with cobalt blue-and-white porcelain bonsai planters, 18 weathered Thanh stone Phẩm Sơn mandarin rank steles,
 *   pierced ochre-stone balustrades, ceremonial lamp posts, lush dark-green framing trees, and 9-bay Điện Thái Hòa!
 * - **Photos 1, 3, 4, 5:** Full museum-grade walkable Điện Thái Hòa Interior!
 * - **Photo 7 (Sơ đồ Hoàng Cung Huế):** Complete ~164m × 154m axial walled Imperial City with outer moat,
 *   battered red-brick Hoàng Thành walls, 4 cardinal gates (Ngọ Môn, Hòa Bình, Chương Đức, Hiển Nhơn),
 *   Hồ Thái Dịch + Cầu Trung Đạo, Tả/Hữu Vu + Nền Điện Cần Chánh + Trường Lang corridors + Điện Kiến Trung,
 *   SW Thế Miếu + Hiển Lâm Các + Cửu Đỉnh + Hưng Miếu, SE Thái Miếu + Triệu Miếu,
 *   NW Cung Diên Thọ + Cung Trường Sanh, NE Duyệt Thị Đường + Phủ Nội Vụ + Vườn Cơ Hạ + Hậu Hồ!
 */
export function buildHoangCungHueMasterCompound(ctx: VietnamBuilderContext): {
  group: THREE.Group;
  palMat: THREE.MeshStandardMaterial;
} {
  const cx = -660;
  const cz = 80;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 122 });
  const group = new THREE.Group();
  group.name = 'HueGrandImperialPalace';
  const y = ctx.getHeight(cx, cz);
  const hp = ctx.huePack!;

  // 1. HERO ĐIỆN THÁI HÒA (Center at cx - 22, cz = 80, facing East +X toward Sân Đại Triều Nghi!)
  //    Sits on top of Upper Sân Thượng terrace (y + 1.35m)
  const sanHaY = y + 0.35;
  const sanThuongY = y + 1.35;
  buildDienThaiHoaHeroHall(ctx, group, {
    hallCenterX: cx - 22,
    baseY: sanThuongY,
    centerZ: cz,
    widthZ: 44.0,
    depthX: 30.0,
    plinthH: 0.95,
    colH: 5.45,
    fullHeroInterior: true
  });

  const thanhStoneParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const plasterParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const yellowRoofParts: THREE.BufferGeometry[] = [];
  const jadeRoofParts: THREE.BufferGeometry[] = [];
  const terracottaRoofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const terracottaParts: THREE.BufferGeometry[] = [];
  const porcelainParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const lawnParts: THREE.BufferGeometry[] = [];
  const walkwayParts: THREE.BufferGeometry[] = [];

  // 2. 2-TIER SÂN ĐẠI TRIỀU NGHI (Photo 6 Exact Foreground Architecture!)
  //    Upper Terrace (`Sân Thượng`, x in [cx - 39 .. cx + 16], z in [cz - 28 .. cz + 28]) at sanThuongY (y + 1.35)
  addBox(thanhStoneParts, 55.0, 1.35, 56.0, cx - 11.5, y + 0.675, cz);
  // Crisp molded stone coping lip along East retaining step edge (`x = cx + 16.0`)
  addBox(thanhStoneParts, 0.42, 0.16, 56.4, cx + 16.0, sanThuongY - 0.04, cz);

  //    Lower Terrace (`Sân Hạ`, x in [cx + 16 .. cx + 38], z in [cz - 28 .. cz + 28]) at sanHaY (y + 0.35)
  addBox(thanhStoneParts, 22.0, 0.35, 56.0, cx + 27.0, y + 0.175, cz);

  // Wide 7-Step Central Ceremonial Thanh Stone Staircase climbing 1.0m from Sân Hạ to Sân Thượng (Photo 6 foreground hero!)
  const stairW = 6.8;
  const numSteps = 7;
  const stepRun = 0.46;
  const stairXTop = cx + 16.0;
  for (let st = 0; st < numSteps; st++) {
    const sh = (sanThuongY - sanHaY) * ((st + 1) / numSteps);
    const sx = stairXTop + (numSteps - 1 - st) * stepRun + stepRun * 0.5;
    addBox(thanhStoneParts, stepRun + 0.04, sh, stairW, sx, sanHaY + sh * 0.5, cz);
  }
  // Massive Sculpted Crouching-Dragon Stone Balustrades (`Thành Bậc Rồng Đá Mây Cuộn`, Photo 6!)
  const stairXBot = stairXTop + numSteps * stepRun;
  for (const s of [-1, 1]) {
    const rz = cz + s * (stairW * 0.5 + 0.36);
    // Solid carved stepped stone cheek wall + dragon rail
    thanhStoneParts.push(
      ...createCarvedDragonBalustradeParts(stairXBot + 0.35, sanHaY, rz, stairXTop - 0.2, sanThuongY, rz, 0.92)
    );
    // Crouching stone dragon head & carved stone orb resting at the bottom stair foot (Photo 6 left & right!)
    const dHead = new THREE.SphereGeometry(0.34, 9, 7);
    dHead.scale(1.35, 0.95, 0.95);
    dHead.translate(stairXBot + 0.52, sanHaY + 0.52, rz);
    thanhStoneParts.push(dHead);
    const orb = new THREE.SphereGeometry(0.22, 8, 6);
    orb.translate(stairXBot + 0.62, sanHaY + 0.22, rz);
    thanhStoneParts.push(orb);

    // 2 Tall Turned Terracotta-Red Pedestals + Cobalt Blue-and-White Porcelain Bonsai Bowls flanking stair top (Photo 6!)
    addTerracottaPorcelainBonsai(
      terracottaParts,
      porcelainParts,
      woodParts,
      foliageParts,
      stairXTop - 0.55,
      sanThuongY,
      cz + s * (stairW * 0.5 + 1.15),
      1.05,
      true
    );
  }

  // 18 Authentic Weathered Thanh Stone `Phẩm Sơn` Mandarin Rank Steles (pulled cleanly into Photo 6 sightlines!)
  for (const side of [-1, 1]) {
    for (let rank = 0; rank < 9; rank++) {
      const rx = cx + 9.5 + (rank % 3) * 1.9;
      const rz = cz + side * (12.2 + Math.floor(rank / 3) * 3.4);
      addBox(thanhStoneParts, 0.62, 0.22, 0.62, rx, sanThuongY + 0.11, rz);
      addBox(thanhStoneParts, 0.22, 0.72, 0.36, rx, sanThuongY + 0.58, rz);
      addCyl(thanhStoneParts, 0.18, 0.18, 0.22, 8, rx, sanThuongY + 0.94, rz, 0, Math.PI * 0.5);
    }
  }

  // Pierced Ochre-Stone Perimeter Balustrades + Ceremonial Lamp Pillars + Lush Framing Palace Trees (Photo 6!)
  for (const side of [-1, 1]) {
    const bz = cz + side * 27.6;
    thanhStoneParts.push(
      ...createPiercedBalustradeParts(cx - 34.0, bz, cx + 16.0, bz, sanThuongY, 0.92, 'chu_van'),
      ...createPiercedBalustradeParts(cx + 16.0, bz, cx + 37.6, bz, sanHaY, 0.92, 'chu_van')
    );
    bronzeParts.push(...createGuardianBeastParts(cx + 12.5, sanThuongY, cz + side * 22.8, Math.PI * 0.5, 1.25, 'kylan'));
    // Ceremonial tall stone/iron lamp columns visible flanking Sân Đại Triều Nghi (Photo 6!)
    addCyl(thanhStoneParts, 0.14, 0.20, 4.4, 8, cx + 8.0, sanThuongY + 2.2, cz + side * 20.5);
    addBox(goldParts, 0.36, 0.42, 0.36, cx + 8.0, sanThuongY + 4.55, cz + side * 20.5);
  }
  // Lush dark-green framing royal palace trees flanking Sân Đại Triều Nghi (including tall back-left screen masking Tây Nguyên banner in Photo 6!)
  const framingTrees: Array<[number, number, number, number]> = [
    [cx - 8, cz - 36, 1.55, 11],
    [cx - 26, cz - 38, 1.75, 12],
    [cx - 42, cz - 34, 1.55, 13],
    [cx - 8, cz + 36, 1.55, 14],
    [cx - 26, cz + 38, 1.75, 15],
    [cx - 42, cz + 34, 1.65, 16],
    [cx - 46, cz + 26, 2.45, 19],
    [cx - 42, cz + 21, 2.20, 21],
    [cx - 48, cz + 17, 1.85, 20],
    [cx + 6, cz - 35, 1.35, 17],
    [cx + 6, cz + 35, 1.35, 18]
  ];
  for (const [tx, tz, sc, sd] of framingTrees) {
    addRoyalGardenTree(woodParts, foliageParts, tx, y, tz, sc, sd);
  }

  // 3. COMPLETE HOÀNG CUNG HUẾ AXIAL WALLED COMPOUND MASTER PLAN (Photo 7: ~152m × 152m, cleanly inside flat plateau!)
  //    Facing -X from Ngọ Môn toward Điện Kiến Trung: Viewer LEFT = +Z (SW/NW), Viewer RIGHT = -Z (SE/NE) — 100% matching Photo 7!
  const compX = cx - 22; // Compound center X = -682; East wall (Ngọ Môn) at -606 (+54), West wall (Cửa Hòa Bình) at -758 (-98) -> cleanly East of Tây Nguyên hill!
  const compHalfX = 76;  // Total E-W length = 152m
  const compHalfZ = 76;  // Total N-S width = 152m

  // Vivid manicured emerald palace lawns covering the walled Imperial City grounds (Photo 7!)
  const lawnGeo = new THREE.PlaneGeometry(compHalfX * 2 + 10, compHalfZ * 2 + 10);
  lawnGeo.rotateX(-Math.PI * 0.5);
  lawnGeo.translate(compX, y + 0.08, cz);
  lawnParts.push(colorizeGeometry(lawnGeo, '#498236'));

  // Crisp pale-grey stone axial & ring walkways (`Đường số 1..10`, Photo 7 exact grid!)
  const walkY = y + 0.14;
  addBox(walkwayParts, 4.6, 0.08, compHalfZ * 1.92, cx + 38.0, walkY, cz);
  addBox(walkwayParts, 4.4, 0.08, compHalfZ * 1.92, cx - 42.0, walkY, cz);
  addBox(walkwayParts, 4.2, 0.08, compHalfZ * 1.45, cx - 80.0, walkY, cz);
  for (const rz of [-compHalfZ + 8, -32, 32, compHalfZ - 8]) {
    addBox(walkwayParts, compHalfX * 1.92, 0.08, 4.0, compX, walkY, cz + rz);
  }

  // Outer Turquoise Imperial Moat (`Hào Hoàng Thành`, Photo 7!) wrapping all 4 sides + Hollow Hồ Thái Dịch + Hậu Hồ + Cung Trường Sanh crescent pond!
  const moatW = 9.0;
  const moatGeos: THREE.BufferGeometry[] = [
    new THREE.PlaneGeometry(moatW, compHalfZ * 2 + moatW * 2 + 8).rotateX(-Math.PI * 0.5).translate(compX + compHalfX + 6.2, y + 0.14, cz),
    new THREE.PlaneGeometry(moatW, compHalfZ * 2 + moatW * 2 + 8).rotateX(-Math.PI * 0.5).translate(compX - compHalfX - 6.2, y + 0.14, cz),
    new THREE.PlaneGeometry(compHalfX * 2 + 14, moatW).rotateX(-Math.PI * 0.5).translate(compX, y + 0.14, cz - compHalfZ - 6.2),
    new THREE.PlaneGeometry(compHalfX * 2 + 14, moatW).rotateX(-Math.PI * 0.5).translate(compX, y + 0.14, cz + compHalfZ + 6.2)
  ];
  // Hollow Hồ Thái Dịch twin rectangular lotus ponds inside front Ngọ Môn flanking Cầu Trung Đạo (water strictly VISIBLE at y + 0.28!)
  for (const s of [-1, 1]) {
    const pondCx = cx + 44.5;
    const pondCz = cz + s * 16.5;
    const pond = new THREE.PlaneGeometry(14.0, 21.5);
    pond.rotateX(-Math.PI * 0.5);
    pond.translate(pondCx, y + 0.28, pondCz);
    moatGeos.push(pond);
    // 4 narrow dressed stone curb walls framing the hollow basin (NEVER a solid stone block burying the water!)
    addBox(thanhStoneParts, 15.2, 0.44, 0.75, pondCx, y + 0.22, pondCz - 11.0);
    addBox(thanhStoneParts, 15.2, 0.44, 0.75, pondCx, y + 0.22, pondCz + 11.0);
    addBox(thanhStoneParts, 0.75, 0.44, 22.4, pondCx - 7.3, y + 0.22, pondCz);
    addBox(thanhStoneParts, 0.75, 0.44, 22.4, pondCx + 7.3, y + 0.22, pondCz);
    // Subtle dark-green lotus pads floating on Hồ Thái Dịch
    for (let lp = 0; lp < 10; lp++) {
      const lx = pondCx - 5.0 + (lp % 5) * 2.5;
      const lz = pondCz - 6.0 + Math.floor(lp / 5) * 12.0 + (lp % 2) * 1.4;
      const pad = new THREE.CircleGeometry(0.65, 8);
      pad.rotateX(-Math.PI * 0.5);
      pad.translate(lx, y + 0.31, lz);
      lawnParts.push(colorizeGeometry(pad, '#2d6828'));
    }
  }
  // Photo 7 Top-Left (NW, +Z) Cung Trường Sanh crescent lake & Top-Right (NE, -Z) Hậu Hồ ornamental pond!
  const truongSanhPond = new THREE.CircleGeometry(10.5, 16);
  truongSanhPond.rotateX(-Math.PI * 0.5);
  truongSanhPond.translate(cx - 82, y + 0.24, cz + 56.0);
  moatGeos.push(truongSanhPond);
  const hauHoPond = new THREE.PlaneGeometry(18.0, 22.0);
  hauHoPond.rotateX(-Math.PI * 0.5);
  hauHoPond.translate(cx - 82, y + 0.24, cz - 53.0);
  moatGeos.push(hauHoPond);

  const moatMesh = new THREE.Mesh(mergeNormalized(moatGeos), hp.moatReflectiveWaterMat);
  group.add(moatMesh);

  // Cầu Trung Đạo axial bridge crossing Hồ Thái Dịch + Twin Gilded Ceremonial `Tam Quan` Arches (Photo 7!)
  addBox(thanhStoneParts, 17.5, 0.55, 8.2, cx + 44.5, y + 0.34, cz);
  thanhStoneParts.push(
    ...createPiercedBalustradeParts(cx + 36.0, cz - 3.9, cx + 53.0, cz - 3.9, y + 0.62, 0.78, 'chu_van'),
    ...createPiercedBalustradeParts(cx + 36.0, cz + 3.9, cx + 53.0, cz + 3.9, y + 0.62, 0.78, 'chu_van')
  );
  for (const archX of [cx + 36.6, cx + 52.2]) {
    for (const az of [-3.4, -1.6, 1.6, 3.4]) {
      addCyl(crimsonParts, 0.14, 0.16, 4.4, 6, archX, y + 2.8, cz + az);
    }
    addBox(goldParts, 0.42, 0.45, 7.4, archX, y + 4.9, cz);
    addBox(yellowRoofParts, 0.85, 0.36, 7.8, archX, y + 5.3, cz);
  }

  // Outer Battered Red-Brick Hoàng Thành Fortification Walls enclosing all 4 sides + 4 Cardinal Gates (Photo 7!)
  const wallHExt = 3.8;
  for (const s of [-1, 1]) {
    addBox(brickParts, 2.4, wallHExt, compHalfZ - 18, compX + compHalfX, y + wallHExt * 0.5, cz + s * (compHalfZ * 0.5 + 9));
    addBox(brickParts, 2.4, wallHExt, compHalfZ - 10, compX - compHalfX, y + wallHExt * 0.5, cz + s * (compHalfZ * 0.5 + 5));
    addBox(brickParts, compHalfX - 10, wallHExt, 2.4, compX - compHalfX * 0.5 - 5, y + wallHExt * 0.5, cz + s * compHalfZ);
    addBox(brickParts, compHalfX - 10, wallHExt, 2.4, compX + compHalfX * 0.5 + 5, y + wallHExt * 0.5, cz + s * compHalfZ);
  }

  // Front Entrance Gate: Miniature Axial Ngọ Môn + Lầu Ngũ Phụng at East wall (`x = compX + compHalfX = cx + 54`)!
  const nmX = compX + compHalfX;
  const nmArch = createArchedWallGeometry(34.0, 4.4, 7.2, 4.2, 3.4);
  nmArch.rotateY(Math.PI * 0.5);
  nmArch.translate(nmX, y, cz);
  brickParts.push(nmArch);
  addBox(crimsonParts, 5.4, 3.0, 14.0, nmX, y + 5.9, cz);
  const nmYellowRoof = createVietnameseCurvedRoofGeometry(7.8, 16.5, 2.2, 9.5, 2.5, 0.42);
  nmYellowRoof.translate(nmX, y + 7.4, cz);
  yellowRoofParts.push(nmYellowRoof);
  for (const s of [-1, 1]) {
    addBox(brickParts, 11.0, 4.4, 6.2, nmX + 6.0, y + 2.2, cz + s * 14.5);
    addBox(crimsonParts, 8.6, 2.5, 5.4, nmX + 5.0, y + 5.65, cz + s * 14.5);
    const nmWingRoof = createVietnameseCurvedRoofGeometry(10.6, 7.2, 3.4, 2.4, 2.0, 0.36);
    nmWingRoof.translate(nmX + 5.0, y + 6.9, cz + s * 14.5);
    jadeRoofParts.push(nmWingRoof);
  }

  // Rear Gate (`Cửa Hòa Bình` at West wall) & Side Gates (`Cửa Chương Đức` Left/+Z, `Cửa Hiển Nhơn` Right/-Z — exact Photo 7!)
  const addCardinalGate = (gx: number, gz: number, rotY: number, useJade: boolean) => {
    const gWall = createArchedWallGeometry(14.0, 4.4, 4.8, 3.6, 3.2);
    gWall.rotateY(rotY);
    gWall.translate(gx, y, gz);
    brickParts.push(gWall);
    addBox(crimsonParts, 4.8, 2.6, 8.6, gx, y + 5.7, gz, rotY);
    const gRoof = createVietnameseCurvedRoofGeometry(6.8, 11.2, 2.0, 5.2, 2.2, 0.38);
    gRoof.rotateY(rotY);
    gRoof.translate(gx, y + 7.0, gz);
    (useJade ? jadeRoofParts : terracottaRoofParts).push(gRoof);
    const bBridge = new THREE.BoxGeometry(11.5, 0.5, 6.4);
    bBridge.rotateY(rotY);
    const dx = Math.cos(rotY) * 6.5;
    const dz = -Math.sin(rotY) * 6.5;
    bBridge.translate(gx + dx, y + 0.32, gz + dz);
    thanhStoneParts.push(bBridge);
  };
  addCardinalGate(compX - compHalfX, cz, -Math.PI * 0.5, false); // Cửa Hòa Bình (Rear/Top on Photo 7)
  addCardinalGate(compX, cz + compHalfZ, 0, true);               // Cửa Chương Đức (Left/+Z on Photo 7)
  addCardinalGate(compX, cz - compHalfZ, Math.PI, true);         // Cửa Hiển Nhơn (Right/-Z on Photo 7)

  // 4. FORBIDDEN PURPLE CITY (`TỬ CẤM THÀNH`) BEHIND ĐIỆN THÁI HÒA (Photo 7 Central Axis!)
  for (const s of [-1, 1]) {
    const vuX = cx - 49;
    const vuZ = cz + s * 19.5;
    addBox(thanhStoneParts, 15.5, 0.65, 9.2, vuX, y + 0.325, vuZ);
    addBox(plasterParts, 14.2, 4.0, 7.8, vuX, y + 2.65, vuZ);
    addBox(crimsonParts, 14.6, 0.42, 8.2, vuX, y + 4.7, vuZ);
    const vuRoof = createVietnameseCurvedRoofGeometry(16.8, 10.6, 10.5, 2.2, 2.45, 0.36);
    vuRoof.translate(vuX, y + 4.85, vuZ);
    terracottaRoofParts.push(vuRoof);
  }

  const ccX = cx - 59;
  addBox(thanhStoneParts, 18.0, 1.15, 26.0, ccX, y + 0.575, cz);
  addBox(thanhStoneParts, 16.2, 0.25, 24.2, ccX, y + 1.25, cz);
  for (const s of [-1, 0, 1]) {
    addBox(thanhStoneParts, 2.6, 0.9, 3.2, ccX + 9.8, y + 0.45, cz + s * 7.4);
  }

  for (const s of [-1, 1]) {
    const tlZ = cz + s * 22.0;
    addBox(thanhStoneParts, 28.0, 0.50, 3.6, cx - 71, y + 0.25, tlZ);
    for (let k = 0; k < 8; k++) {
      const px = cx - 58 - k * 3.5;
      addCyl(crimsonParts, 0.14, 0.16, 3.2, 6, px, y + 2.1, tlZ - 1.3);
      addCyl(crimsonParts, 0.14, 0.16, 3.2, 6, px, y + 2.1, tlZ + 1.3);
    }
    const tlRoof = createVietnameseCurvedRoofGeometry(29.0, 4.8, 25.0, 0.6, 1.35, 0.28);
    tlRoof.translate(cx - 71, y + 3.7, tlZ);
    jadeRoofParts.push(tlRoof);
  }

  // Điện Kiến Trung (Ornate 2-Story Ivory-and-Ochre Imperial Palace at rear axis before Cửa Hòa Bình!)
  const ktX = compX - compHalfX + 13.0;
  addBox(thanhStoneParts, 13.5, 1.1, 32.0, ktX, y + 0.55, cz);
  addBox(plasterParts, 11.4, 6.8, 28.0, ktX, y + 4.5, cz);
  addBox(goldParts, 11.8, 0.35, 28.6, ktX, y + 4.6, cz);
  addBox(goldParts, 12.0, 0.45, 29.0, ktX, y + 7.9, cz);
  addBox(plasterParts, 12.6, 8.2, 10.2, ktX, y + 5.2, cz);
  const ktRoof = createVietnameseCurvedRoofGeometry(13.6, 30.0, 4.0, 20.0, 2.6, 0.35);
  ktRoof.translate(ktX, y + 8.1, cz);
  yellowRoofParts.push(ktRoof);

  // 5. FOUR FLANKING PRECINCTS (Photo 7 Exact Quadrant Orientation: Viewer LEFT = +Z, Viewer RIGHT = -Z!)
  //    a) SW Precinct (Viewer LEFT-FRONT, +Z): Hiển Lâm Các (3-tier) + Cửu Đỉnh (9 bronze urns) + Thế Miếu (9-bay) + Hưng Miếu
  const swZ = cz + 53.0;
  addBox(thanhStoneParts, 11.5, 0.85, 13.5, cx + 18, y + 0.425, swZ);
  addBox(crimsonParts, 8.8, 3.4, 10.6, cx + 18, y + 2.55, swZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(12.2, 14.2, 7.6, 9.2, 1.8, 0.35).translate(cx + 18, y + 4.25, swZ));
  addBox(crimsonParts, 6.4, 2.6, 7.8, cx + 18, y + 6.4, swZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(9.0, 10.6, 4.6, 5.6, 1.7, 0.36).translate(cx + 18, y + 7.7, swZ));
  addBox(crimsonParts, 4.2, 2.2, 5.0, cx + 18, y + 9.8, swZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(6.4, 7.4, 1.6, 2.2, 1.9, 0.42).translate(cx + 18, y + 10.9, swZ));
  // 9 Cửu Đỉnh Imperial Bronze Urns on dressed Thanh stone terrace between Hiển Lâm Các & Thế Miếu (clearly visible from aerial Photo 7!)
  addBox(thanhStoneParts, 4.2, 0.22, 26.5, cx + 7.5, y + 0.11, swZ);
  for (let u = 0; u < 9; u++) {
    const uz = swZ - 11.2 + u * 2.8;
    const urn = createImperialUrnParts(cx + 7.5 + (u === 4 ? 0.6 : 0), y + 0.22, uz, 1.05);
    thanhStoneParts.push(...urn.stoneParts);
    bronzeParts.push(...urn.bronzeParts);
  }
  addBox(thanhStoneParts, 13.0, 0.95, 29.0, cx - 7.0, y + 0.475, swZ);
  addBox(crimsonParts, 11.2, 4.6, 26.8, cx - 7.0, y + 3.25, swZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(15.2, 31.2, 3.2, 23.0, 3.1, 0.42).translate(cx - 7.0, y + 5.55, swZ));
  addBox(thanhStoneParts, 10.5, 0.75, 20.0, cx - 25.0, y + 0.375, swZ);
  addBox(crimsonParts, 8.8, 3.8, 18.0, cx - 25.0, y + 2.65, swZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(12.2, 22.0, 2.6, 16.0, 2.4, 0.36).translate(cx - 25.0, y + 4.55, swZ));

  //    b) SE Precinct (Viewer RIGHT-FRONT, -Z): Thái Miếu & Triệu Miếu!
  const seZ = cz - 53.0;
  addBox(thanhStoneParts, 13.0, 0.95, 29.0, cx - 7.0, y + 0.475, seZ);
  addBox(crimsonParts, 11.2, 4.6, 26.8, cx - 7.0, y + 3.25, seZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(15.2, 31.2, 3.2, 23.0, 3.1, 0.42).translate(cx - 7.0, y + 5.55, seZ));
  addBox(thanhStoneParts, 10.5, 0.75, 20.0, cx - 25.0, y + 0.375, seZ);
  addBox(crimsonParts, 8.8, 3.8, 18.0, cx - 25.0, y + 2.65, seZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(12.2, 22.0, 2.6, 16.0, 2.4, 0.36).translate(cx - 25.0, y + 4.55, seZ));

  //    c) NW Precinct (Viewer LEFT-REAR, +Z): Cung Diên Thọ & Cung Trường Sanh!
  addBox(thanhStoneParts, 13.5, 0.85, 21.0, cx - 58, y + 0.425, swZ);
  addBox(plasterParts, 11.8, 4.4, 19.0, cx - 58, y + 3.05, swZ);
  yellowRoofParts.push(createVietnameseCurvedRoofGeometry(14.8, 23.0, 3.4, 16.0, 2.7, 0.38).translate(cx - 58, y + 5.25, swZ));
  addBox(thanhStoneParts, 11.0, 0.75, 14.5, cx - 80, y + 0.375, swZ - 6.0);
  addBox(crimsonParts, 8.8, 3.6, 12.2, cx - 80, y + 2.55, swZ - 6.0);
  jadeRoofParts.push(createVietnameseCurvedRoofGeometry(11.8, 16.0, 3.0, 10.0, 2.2, 0.38).translate(cx - 80, y + 4.35, swZ - 6.0));

  //    d) NE Precinct (Viewer RIGHT-REAR, -Z): Duyệt Thị Đường (Royal Theatre), Phủ Nội Vụ & Vườn Cơ Hạ!
  addBox(thanhStoneParts, 13.5, 0.85, 15.5, cx - 54, y + 0.425, cz - 38.0);
  addBox(crimsonParts, 11.8, 4.6, 14.0, cx - 54, y + 3.15, cz - 38.0);
  jadeRoofParts.push(createVietnameseCurvedRoofGeometry(14.8, 17.5, 3.6, 11.0, 2.5, 0.36).translate(cx - 54, y + 5.45, cz - 38.0));
  addBox(thanhStoneParts, 12.5, 0.75, 20.0, cx - 60, y + 0.375, seZ - 4.0);
  addBox(plasterParts, 11.2, 5.4, 18.2, cx - 60, y + 3.45, seZ - 4.0);
  terracottaRoofParts.push(createVietnameseCurvedRoofGeometry(13.4, 21.0, 4.0, 15.0, 2.2, 0.28).translate(cx - 60, y + 6.15, seZ - 4.0));
  addBox(thanhStoneParts, 9.5, 0.65, 9.5, cx - 78, y + 0.325, seZ + 4.0);
  addBox(crimsonParts, 6.8, 3.2, 6.8, cx - 78, y + 2.25, seZ + 4.0);
  jadeRoofParts.push(createVietnameseCurvedRoofGeometry(9.8, 9.8, 2.4, 2.4, 2.2, 0.40).translate(cx - 78, y + 3.85, seZ + 4.0));
  for (let t = 0; t < 8; t++) {
    const gx = cx - 68 - (t % 4) * 6.5;
    const gz = cz + (t < 4 ? -44 : 44) + ((t * 5) % 9) - 4;
    addRoyalGardenTree(woodParts, foliageParts, gx, y, gz, 1.15, 30 + t);
  }

  // Inner red-brick precinct dividing walls (Photo 7!)
  for (const s of [-1, 1]) {
    addBox(brickParts, 1.2, 2.6, 42.0, cx - 39.0, y + 1.3, cz + s * 52.0);
    addBox(brickParts, 136.0, 2.6, 1.2, compX, y + 1.3, cz + s * 31.0);
  }

  // Merge all compound geometry cleanly
  const addMerged = (
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
    worldUvMeters?: number
  ) => {
    if (parts.length === 0) return;
    let geo = mergeNormalized(parts);
    if (worldUvMeters) geo = applyWorldBoxUV(geo, worldUvMeters);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    group.add(mesh);
  };

  addMerged(thanhStoneParts, hp.thanhStoneMat, true, true, 3.0);
  addMerged(walkwayParts, ctx.materials.whitePlaster, false, true, 3.5);
  addMerged(brickParts, ctx.materials.weatheredImperialBrick ?? ctx.materials.stone, true, true, 2.6);
  addMerged(plasterParts, ctx.materials.whitePlaster, true, true, 3.2);
  addMerged(crimsonParts, hp.imperialCrimsonWoodMat, true, true);
  addMerged(yellowRoofParts, hp.hoangLuuLyMat, true, true);
  addMerged(jadeRoofParts, hp.thanhLuuLyMat, true, true);
  addMerged(terracottaRoofParts, ctx.materials.terracottaRoof, true, true);
  addMerged(goldParts, ctx.materials.gold, false, false);
  addMerged(bronzeParts, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(terracottaParts, hp.terracottaBalustradeMat, false, true);
  addMerged(porcelainParts, hp.porcelainCobaltMat, false, true);
  addMerged(woodParts, ctx.materials.darkWood, false, true);

  if (lawnParts.length > 0) {
    const lawnMat = ctx.materialLib?.getOrCreateStandard({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.02
    }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
    addMerged(lawnParts, lawnMat, false, true);
  }
  if (foliageParts.length > 0) {
    const folMat = ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02
    }) ?? new THREE.MeshStandardMaterial({ map: ctx.pbr.leafAtlas, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72 });
    addMerged(foliageParts, folMat, false, true);
  }

  // Keep palMat handle for `buildVietnamReferenceShowUpgrades` atmosphere hook (reuse shared lanternCore so 0 extra mats!)
  const palMat = ctx.materials.lanternCore ?? ctx.materials.gold;
  ctx.scene.add(group);
  return { group, palMat };
}
