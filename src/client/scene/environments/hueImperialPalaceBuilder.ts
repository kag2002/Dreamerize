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
  createHueNguyenDragonBalustradeParts,
  createGuardianBeastParts,
  createImperialUrnParts,
  createShouCharacterParts,
  createSmoothTaperedTubeGeometry,
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
  sz = 1,
  rx = 0,
  rz = 0
): void {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  inst.setMatrixAt(idx, m);
}

/**
 * Helper: Sculpted 3D Gilded Dragon-Head `Đầu Dư` Corbel projecting from interior column capitals — IN-24, AS-08, CL-28
 */
function addSculptedDauDuCorbel(
  goldParts: THREE.BufferGeometry[],
  cx: number,
  capY: number,
  cz: number,
  dirZ: number
): void {
  addCyl(goldParts, 0.33, 0.30, 0.14, 8, cx, capY - 0.08, cz);
  addCyl(goldParts, 0.36, 0.33, 0.09, 8, cx, capY - 0.20, cz);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx, capY - 0.16, cz + dirZ * 0.24),
    new THREE.Vector3(cx, capY - 0.32, cz + dirZ * 0.44),
    new THREE.Vector3(cx, capY - 0.24, cz + dirZ * 0.64)
  ]);
  goldParts.push(createSmoothTaperedTubeGeometry(neckCurve, 5, 5, (t) => 0.14 - t * 0.03));
  const snout = new THREE.SphereGeometry(0.115, 6, 5);
  snout.scale(0.88, 0.86, 1.32);
  snout.translate(cx, capY - 0.22, cz + dirZ * 0.70);
  const jaw = new THREE.BoxGeometry(0.14, 0.055, 0.18);
  jaw.translate(cx, capY - 0.33, cz + dirZ * 0.66);
  goldParts.push(snout, jaw);
}

/**
 * Builds a museum-grade sculpted 3-dragon-legged spherical antique-bronze cauldron (`Bửu Đỉnh`, Photo 1!) — IN-16..IN-20!
 * Authentic ~1.74m museum height, Leg #1 facing straight front (+X), closed stepped lotus plinth with 3 scroll feet,
 * 3 articulated S-curved sculpted dragons with claws/dorsal fins, embossed spherical body with double equatorial rings,
 * 2 muscular climbing flank Kỳ Lân with beaded manes & claws, and 1 crowned seated Kỳ Lân clutching a ribbed brocade orb!
 */
function addBuuDinhBronzeCauldron(
  bronzeParts: THREE.BufferGeometry[],
  cx: number,
  floorY: number,
  cz: number,
  scale = 0.74
): void {
  const s = scale;

  // 1. Solid Closed Stepped Circular Bronze Lotus Plinth with 3 Scroll Feet (ZERO hollow bowl! IN-20)
  addCyl(bronzeParts, 0.50 * s, 0.58 * s, 0.11 * s, 24, cx, floorY + 0.055 * s, cz);
  addCyl(bronzeParts, 0.42 * s, 0.49 * s, 0.12 * s, 24, cx, floorY + 0.17 * s, cz);
  addCyl(bronzeParts, 0.46 * s, 0.42 * s, 0.09 * s, 24, cx, floorY + 0.275 * s, cz);
  // Carved lotus-petal collar ring + solid closed top bronze disc
  const lotusBand = new THREE.TorusGeometry(0.45 * s, 0.048 * s, 8, 24);
  lotusBand.rotateX(Math.PI * 0.5);
  lotusBand.translate(cx, floorY + 0.31 * s, cz);
  bronzeParts.push(lotusBand);
  for (let f = 0; f < 3; f++) {
    const a = (f / 3) * Math.PI * 2;
    const foot = new THREE.SphereGeometry(0.11 * s, 8, 6);
    foot.scale(1.3, 0.72, 0.95);
    foot.rotateY(-a);
    foot.translate(cx + Math.cos(a) * 0.54 * s, floorY + 0.06 * s, cz + Math.sin(a) * 0.54 * s);
    bronzeParts.push(foot);
  }

  // 2. Three Articulated Sculpted Bronze Dragons (`Tam Long Đỡ Đỉnh`) — Leg #1 faces straight +X toward viewer! (IN-16, IN-17)
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * Math.PI * 2; // 0° (+X front!), 120°, 240°
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const tx = -sa;
    const tz = ca;

    const dragonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + ca * 0.34 * s, floorY + 0.29 * s, cz + sa * 0.34 * s),
      new THREE.Vector3(cx + ca * 0.52 * s, floorY + 0.56 * s, cz + sa * 0.52 * s),
      new THREE.Vector3(cx + ca * 0.30 * s, floorY + 0.86 * s, cz + sa * 0.30 * s),
      new THREE.Vector3(cx + ca * 0.40 * s, floorY + 1.14 * s, cz + sa * 0.40 * s)
    ]);
    bronzeParts.push(
      createSmoothTaperedTubeGeometry(
        dragonCurve,
        16,
        7,
        (t) => (0.055 + 0.032 * Math.sin(t * Math.PI)) * s,
        (t, theta) => 1.0 + Math.pow(Math.max(0, Math.cos(theta)), 4) * (0.28 + 0.18 * Math.sin(t * Math.PI * 10))
      )
    );

    // Sculpted fierce open-jaw dragon head + swept curved horns cradling lower cauldron rim
    const hx = cx + ca * 0.40 * s;
    const hy = floorY + 1.12 * s;
    const hz = cz + sa * 0.40 * s;
    const dCranium = new THREE.SphereGeometry(0.105 * s, 9, 7);
    dCranium.scale(1.28, 0.92, 0.92);
    dCranium.rotateY(-ang);
    dCranium.translate(hx, hy, hz);
    const dJaw = new THREE.BoxGeometry(0.14 * s, 0.048 * s, 0.11 * s);
    dJaw.rotateY(-ang);
    dJaw.translate(hx + ca * 0.07 * s, hy - 0.07 * s, hz + sa * 0.07 * s);
    bronzeParts.push(dCranium, dJaw);

    // Articulated clawed dragon forelimbs pressed firmly upward against the cauldron belly + swept horns
    for (const side of [-1, 1]) {
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx - ca * 0.04 * s + tx * side * 0.06 * s, hy - 0.14 * s, hz - sa * 0.04 * s + tz * side * 0.06 * s),
        new THREE.Vector3(hx + ca * 0.08 * s + tx * side * 0.15 * s, hy - 0.02 * s, hz + sa * 0.08 * s + tz * side * 0.15 * s),
        new THREE.Vector3(hx + ca * 0.02 * s + tx * side * 0.12 * s, hy + 0.12 * s, hz + sa * 0.02 * s + tz * side * 0.12 * s)
      ]);
      bronzeParts.push(createSmoothTaperedTubeGeometry(armCurve, 6, 5, () => 0.032 * s));
      const horn = new THREE.ConeGeometry(0.022 * s, 0.13 * s, 5);
      horn.rotateZ(-0.55);
      horn.rotateY(-ang + side * 0.35);
      horn.translate(hx - ca * 0.05 * s + tx * side * 0.06 * s, hy + 0.09 * s, hz - sa * 0.05 * s + tz * side * 0.06 * s);
      bronzeParts.push(horn);
    }

    // Flared curled lower tail scroll & hind claws gripping the bronze plinth
    const tailCurl = new THREE.TorusGeometry(0.095 * s, 0.036 * s, 6, 10, Math.PI * 1.35);
    tailCurl.rotateY(-ang + Math.PI * 0.5);
    tailCurl.translate(cx + ca * 0.45 * s, floorY + 0.36 * s, cz + sa * 0.45 * s);
    bronzeParts.push(tailCurl);
  }

  // 3. Large Embossed Spherical Antique-Bronze Cauldron Body + Double Beaded Equatorial Belt (IN-20)
  const bellyY = floorY + 1.50 * s;
  const sphereR = 0.54 * s;
  const belly = new THREE.SphereGeometry(sphereR, 20, 14);
  belly.translate(cx, bellyY, cz);
  bronzeParts.push(belly);
  for (const dy of [0.02 * s, 0.08 * s]) {
    const eqRing = new THREE.TorusGeometry(sphereR * 0.995, 0.024 * s, 6, 18);
    eqRing.rotateX(Math.PI * 0.5);
    eqRing.translate(cx, bellyY + dy, cz);
    bronzeParts.push(eqRing);
  }
  const lidRim = new THREE.TorusGeometry(sphereR * 0.74, 0.032 * s, 6, 16);
  lidRim.rotateX(Math.PI * 0.5);
  lidRim.translate(cx, bellyY + 0.36 * s, cz);
  bronzeParts.push(lidRim);

  // 4. Sculpted Muscular Climbing Flank Kỳ Lân (`Song Lân Bám Đỉnh` — ZERO smooth snowmen! IN-18)
  for (const side of [-1, 1]) {
    const kz = cz + side * (sphereR + 0.08 * s);
    // Curved muscular climbing torso hugging the cauldron flank
    const kBodyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx - 0.03 * s, bellyY - 0.18 * s, kz - side * 0.04 * s),
      new THREE.Vector3(cx + 0.02 * s, bellyY + 0.02 * s, kz + side * 0.06 * s),
      new THREE.Vector3(cx + 0.05 * s, bellyY + 0.22 * s, kz + side * 0.02 * s)
    ]);
    bronzeParts.push(createSmoothTaperedTubeGeometry(kBodyCurve, 9, 7, (t) => (0.115 - t * 0.02 + Math.sin(t * Math.PI) * 0.025) * s));
    // Sculpted outward-turned roaring kylin head + beaded curly mane collar + twin upright ears
    const khx = cx + 0.07 * s;
    const khy = bellyY + 0.26 * s;
    const khz = kz + side * 0.06 * s;
    const kHead = new THREE.SphereGeometry(0.105 * s, 9, 7);
    kHead.scale(1.18, 0.95, 0.95);
    kHead.translate(khx, khy, khz);
    const kSnout = new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.09 * s);
    kSnout.translate(khx + 0.08 * s, khy - 0.02 * s, khz + side * 0.02 * s);
    const kMane = new THREE.TorusGeometry(0.10 * s, 0.035 * s, 6, 12);
    kMane.rotateX(Math.PI * 0.35);
    kMane.translate(khx - 0.02 * s, khy - 0.04 * s, khz - side * 0.01 * s);
    bronzeParts.push(kHead, kSnout, kMane);
    for (const eo of [-0.045, 0.045]) {
      const ear = new THREE.ConeGeometry(0.024 * s, 0.075 * s, 5);
      ear.translate(khx - 0.01 * s, khy + 0.10 * s, khz + eo * s);
      bronzeParts.push(ear);
    }
    // 4 Articulated bent clawed limbs gripping cauldron shoulder & lower cheek
    for (const [fx, fy, fzOff] of [
      [0.08, 0.16, -0.04],
      [-0.06, 0.14, -0.04],
      [0.06, -0.14, -0.05],
      [-0.07, -0.15, -0.05]
    ]) {
      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx + fx * 0.4 * s, bellyY + fy * s, kz + side * 0.02 * s),
        new THREE.Vector3(cx + fx * 1.1 * s, bellyY + (fy + 0.03) * s, kz - side * 0.03 * s),
        new THREE.Vector3(cx + fx * 0.9 * s, bellyY + (fy - 0.02) * s, cz + side * (sphereR + fzOff * s))
      ]);
      bronzeParts.push(createSmoothTaperedTubeGeometry(legCurve, 6, 5, () => 0.034 * s));
    }
    // Upright S-curved flame-scroll tail behind flank haunch
    const kTail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx - 0.04 * s, bellyY - 0.16 * s, kz + side * 0.06 * s),
      new THREE.Vector3(cx - 0.06 * s, bellyY - 0.02 * s, kz + side * 0.20 * s),
      new THREE.Vector3(cx - 0.02 * s, bellyY + 0.14 * s, kz + side * 0.16 * s)
    ]);
    bronzeParts.push(createSmoothTaperedTubeGeometry(kTail, 7, 5, (t) => (0.042 - t * 0.018) * s));
  }

  // 5. Sculpted Seated Crowned Kỳ Lân perched atop Molded Lotus Lid Collar clutching Ribbed Brocade Orb (`Cầu Lửa` — IN-19!)
  const topY = bellyY + sphereR - 0.01 * s;
  addCyl(bronzeParts, 0.24 * s, 0.30 * s, 0.08 * s, 16, cx, topY + 0.02 * s, cz);
  const lidCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 0.10 * s, topY + 0.14 * s, cz),
    new THREE.Vector3(cx - 0.02 * s, topY + 0.24 * s, cz + 0.02 * s),
    new THREE.Vector3(cx + 0.08 * s, topY + 0.36 * s, cz + 0.03 * s)
  ]);
  bronzeParts.push(createSmoothTaperedTubeGeometry(lidCurve, 9, 8, (t) => (0.14 - t * 0.025) * s));
  // Roaring head turned ~25° 3/4-forward + beaded curly mane ruff + twin horns + swept upright flame tail
  const lhx = cx + 0.12 * s;
  const lhy = topY + 0.42 * s;
  const lhz = cz + 0.04 * s;
  const topHead = new THREE.SphereGeometry(0.125 * s, 10, 8);
  topHead.scale(1.22, 0.96, 0.96);
  topHead.rotateY(0.35);
  topHead.translate(lhx, lhy, lhz);
  const topSnout = new THREE.BoxGeometry(0.12 * s, 0.08 * s, 0.10 * s);
  topSnout.rotateY(0.35);
  topSnout.translate(lhx + 0.09 * s, lhy - 0.02 * s, lhz + 0.03 * s);
  const topMane = new THREE.TorusGeometry(0.12 * s, 0.040 * s, 6, 14);
  topMane.rotateY(Math.PI * 0.5 + 0.35);
  topMane.translate(lhx - 0.03 * s, lhy - 0.04 * s, lhz - 0.01 * s);
  const brocadeBall = new THREE.SphereGeometry(0.095 * s, 10, 8);
  brocadeBall.translate(cx + 0.19 * s, topY + 0.11 * s, cz + 0.04 * s);
  const ballBand = new THREE.TorusGeometry(0.096 * s, 0.018 * s, 5, 14);
  ballBand.translate(cx + 0.19 * s, topY + 0.11 * s, cz + 0.04 * s);
  bronzeParts.push(topHead, topSnout, topMane, brocadeBall, ballBand);
  // Right forepaw planted squarely atop brocade orb + left planted foreleg
  const pawR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx + 0.06 * s, topY + 0.28 * s, cz + 0.09 * s),
    new THREE.Vector3(cx + 0.15 * s, topY + 0.22 * s, cz + 0.09 * s),
    new THREE.Vector3(cx + 0.18 * s, topY + 0.18 * s, cz + 0.05 * s)
  ]);
  const pawL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx + 0.04 * s, topY + 0.26 * s, cz - 0.09 * s),
    new THREE.Vector3(cx + 0.08 * s, topY + 0.14 * s, cz - 0.10 * s),
    new THREE.Vector3(cx + 0.10 * s, topY + 0.06 * s, cz - 0.09 * s)
  ]);
  bronzeParts.push(
    createSmoothTaperedTubeGeometry(pawR, 6, 5, () => 0.038 * s),
    createSmoothTaperedTubeGeometry(pawL, 6, 5, () => 0.038 * s)
  );
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 0.16 * s, topY + 0.14 * s, cz),
    new THREE.Vector3(cx - 0.30 * s, topY + 0.28 * s, cz),
    new THREE.Vector3(cx - 0.22 * s, topY + 0.44 * s, cz - 0.02 * s),
    new THREE.Vector3(cx - 0.14 * s, topY + 0.50 * s, cz)
  ]);
  bronzeParts.push(createSmoothTaperedTubeGeometry(tailCurve, 9, 6, (t) => (0.048 - t * 0.020) * s));
}

/**
 * Builds the glossy vermilion-scarlet wooden ceremonial barrier fence with authentic 14-segment interlocking
 * `Chữ Thọ Triện` (`壽`) openwork, 4 dense vertical flanking spindles per side & upper transom fretwork (Photo 1!) — IN-21!
 */
function addCrimsonChuThoBarrier(
  barrierParts: THREE.BufferGeometry[],
  xPos: number,
  floorY: number,
  cz: number,
  halfSpanZ: number,
  centerGapHalfZ: number
): void {
  const railH = 0.96;
  const buildRun = (zA: number, zB: number) => {
    const totalLen = Math.abs(zB - zA);
    if (totalLen < 0.8) return;
    const dir = zB >= zA ? 1 : -1;
    const numBays = Math.max(2, Math.round(totalLen / 1.92));
    const bayLen = totalLen / numBays;

    for (let b = 0; b <= numBays; b++) {
      const pz = zA + dir * (b * bayLen);
      // Stepped mitered 2-tier T-foot plinth & square red post with rounded finial cap
      addBox(barrierParts, 0.44, 0.09, 0.14, xPos, floorY + 0.045, pz);
      addBox(barrierParts, 0.28, 0.08, 0.16, xPos, floorY + 0.13, pz);
      addBox(barrierParts, 0.10, railH, 0.10, xPos, floorY + railH * 0.5 + 0.04, pz);
      addBox(barrierParts, 0.15, 0.05, 0.15, xPos, floorY + railH + 0.055, pz);
      const cap = new THREE.SphereGeometry(0.055, 7, 5);
      cap.translate(xPos, floorY + railH + 0.10, pz);
      barrierParts.push(cap);

      if (b < numBays) {
        const midZ = pz + dir * (bayLen * 0.5);
        // Top handrail, upper sub-rail, lower sill rail
        addBox(barrierParts, 0.085, 0.065, bayLen, xPos, floorY + railH - 0.01, midZ);
        addBox(barrierParts, 0.055, 0.045, bayLen, xPos, floorY + railH - 0.15, midZ);
        addBox(barrierParts, 0.055, 0.050, bayLen, xPos, floorY + 0.22, midZ);
        // Upper narrow pierced transom fret bars between handrail & sub-rail
        for (let uf = -3; uf <= 3; uf++) {
          addBox(barrierParts, 0.036, 0.12, 0.032, xPos, floorY + railH - 0.08, midZ + uf * (bayLen * 0.12));
        }

        // Authentic 14-Segment Interlocking `Chữ Thọ Triện` (`壽`) Seal-Script Openwork Medallion!
        const frameW = Math.min(0.64, bayLen * 0.36);
        const frameH = 0.50;
        const midY = floorY + 0.51;
        const barT = 0.036;
        // Outer square frame (4 bars)
        addBox(barrierParts, barT, barT, frameW, xPos, midY + frameH * 0.5, midZ);
        addBox(barrierParts, barT, barT, frameW, xPos, midY - frameH * 0.5, midZ);
        addBox(barrierParts, barT, frameH, barT, xPos, midY, midZ - frameW * 0.5);
        addBox(barrierParts, barT, frameH, barT, xPos, midY, midZ + frameW * 0.5);
        // Central vertical spine + 3 horizontal seal bars (`士 / 壽`)
        addBox(barrierParts, barT, frameH * 0.94, barT, xPos, midY, midZ);
        addBox(barrierParts, barT, barT, frameW * 0.92, xPos, midY, midZ);
        addBox(barrierParts, barT, barT, frameW * 0.68, xPos, midY + frameH * 0.26, midZ);
        addBox(barrierParts, barT, barT, frameW * 0.68, xPos, midY - frameH * 0.26, midZ);
        // Paired interlocking symmetric return hooks (`triện thọ` maze)
        for (const s of [-1, 1]) {
          addBox(barrierParts, barT, frameH * 0.28, barT, xPos, midY + frameH * 0.13, midZ + s * frameW * 0.32);
          addBox(barrierParts, barT, frameH * 0.28, barT, xPos, midY - frameH * 0.13, midZ + s * frameW * 0.32);
          addBox(barrierParts, barT, barT, frameW * 0.20, xPos, midY + frameH * 0.38, midZ + s * frameW * 0.36);
          addBox(barrierParts, barT, barT, frameW * 0.20, xPos, midY - frameH * 0.38, midZ + s * frameW * 0.36);
        }

        // 4 Crisp Slender Vertical Spindles flanking EACH side of the Chữ Thọ panel (Photo 1 exact rhythm!)
        const flankSpan = (bayLen - frameW - 0.16) * 0.5;
        for (const fSign of [-1, 1]) {
          const flankStart = midZ + fSign * (frameW * 0.5 + 0.04);
          for (let sp = 1; sp <= 4; sp++) {
            const fz = flankStart + fSign * ((sp / 4.5) * flankSpan);
            addBox(barrierParts, 0.032, 0.57, 0.032, xPos, midY, fz);
          }
          // Subtle horizontal tie bar connecting the 4 spindles at mid-height
          addBox(barrierParts, 0.030, 0.032, flankSpan * 0.94, xPos, midY, flankStart + fSign * flankSpan * 0.48);
        }
      }
    }
  };

  if (centerGapHalfZ <= 0.05) {
    buildRun(cz - halfSpanZ, cz + halfSpanZ);
  } else {
    buildRun(cz - halfSpanZ, cz - centerGapHalfZ);
    buildRun(cz + centerGapHalfZ, cz + halfSpanZ);
  }
}

/**
 * Sculpted Polychrome Ceramic-Mosaic `Cửu Long` (9-Dragon) Roof Crown + Pierced Ridge Wall + Serrated Hip Fins — EX-04, EX-05!
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
  scale = 1.0,
  eaveFlare = 0.26
): void {
  const s = scale;
  // 2-Tier Molded Openwork Ridge Wall (`Bờ Nóc Khảm Sành Sứ`)
  addBox(ceramicParts, 0.44 * s, 0.28 * s, ridgeLenZ + 0.7 * s, hx, ridgeY + 0.10 * s, cz);
  addBox(ceramicParts, 0.34 * s, 0.24 * s, ridgeLenZ + 0.3 * s, hx, ridgeY + 0.36 * s, cz);
  addBox(goldParts, 0.46 * s, 0.09 * s, ridgeLenZ + 0.5 * s, hx, ridgeY + 0.50 * s, cz);

  // 1. Central Flaming Solar Pearl (`Mặt Nhật`) + Spiky Sculpted `Lưỡng Long Chầu Nhật` (Dragons #1 & #2)
  const orb = new THREE.SphereGeometry(0.36 * s, 10, 8);
  orb.translate(hx, ridgeY + 0.96 * s, cz);
  goldParts.push(orb);
  const orbRing = new THREE.TorusGeometry(0.50 * s, 0.065 * s, 6, 14);
  orbRing.rotateY(Math.PI * 0.5);
  orbRing.translate(hx, ridgeY + 0.96 * s, cz);
  ceramicParts.push(orbRing);

  for (const side of [-1, 1]) {
    const dCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, ridgeY + 1.02 * s, cz + side * 0.76 * s),
      new THREE.Vector3(hx, ridgeY + 0.64 * s, cz + side * 1.72 * s),
      new THREE.Vector3(hx, ridgeY + 1.18 * s, cz + side * 2.75 * s),
      new THREE.Vector3(hx, ridgeY + 0.56 * s, cz + side * 3.85 * s),
      new THREE.Vector3(hx, ridgeY + 0.92 * s, cz + side * 4.65 * s)
    ]);
    ceramicParts.push(
      createSmoothTaperedTubeGeometry(
        dCurve,
        14,
        6,
        (t) => (0.20 - t * 0.07) * s,
        (t, theta) => 1.0 + Math.pow(Math.max(0, Math.sin(theta)), 4) * (0.45 + 0.25 * Math.sin(t * Math.PI * 10))
      )
    );
    const dHead = new THREE.SphereGeometry(0.28 * s, 8, 6);
    dHead.scale(0.95, 1.05, 1.42);
    dHead.translate(hx, ridgeY + 1.06 * s, cz + side * 0.70 * s);
    ceramicParts.push(dHead);
    const horn = new THREE.ConeGeometry(0.09 * s, 0.40 * s, 5);
    horn.translate(hx, ridgeY + 1.38 * s, cz + side * 0.80 * s);
    goldParts.push(horn);
  }

  // 2. Two Mid-Ridge Ceramic Dragons (#3 & #4) & Massive Curled `Kìm Nóc` Dragon Terminals (#5 & #6)
  for (const side of [-1, 1]) {
    const midZ = cz + side * (ridgeLenZ * 0.30);
    const midCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, ridgeY + 0.48 * s, midZ - side * 1.25 * s),
      new THREE.Vector3(hx, ridgeY + 1.08 * s, midZ),
      new THREE.Vector3(hx, ridgeY + 0.58 * s, midZ + side * 1.25 * s)
    ]);
    ceramicParts.push(createSmoothTaperedTubeGeometry(midCurve, 10, 6, (t) => (0.16 + Math.sin(t * Math.PI) * 0.06) * s));
    const crest = new THREE.ConeGeometry(0.16 * s, 0.44 * s, 5);
    crest.translate(hx, ridgeY + 1.22 * s, midZ);
    ceramicParts.push(crest);

    // Massive curled Kìm Nóc dragon-cloud volute at ridge ends
    const endZ = cz + side * (ridgeLenZ * 0.50);
    const kimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, ridgeY + 0.44 * s, endZ - side * 0.55 * s),
      new THREE.Vector3(hx, ridgeY + 1.35 * s, endZ + side * 0.22 * s),
      new THREE.Vector3(hx, ridgeY + 1.76 * s, endZ - side * 0.22 * s),
      new THREE.Vector3(hx, ridgeY + 1.44 * s, endZ - side * 0.48 * s)
    ]);
    ceramicParts.push(createSmoothTaperedTubeGeometry(kimCurve, 10, 6, (t) => (0.24 - t * 0.08) * s));
  }

  // 3. Four Serrated Ceramic-Mosaic Hip-Ridge Dragons (#7..#10) hugging updated createHueImperialHipRoofGeometry (0.00m gap!)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      const samples = 9;
      const topHalfX = 0.9;
      const topHalfZ = ridgeLenZ * 0.5;
      const roofH = hipDropY + eaveFlare;
      for (let k = 0; k <= samples; k++) {
        const r = k / samples;
        const px = hx + sx * THREE.MathUtils.lerp(topHalfX, hipSpanX, r);
        const pz = cz + sz * THREE.MathUtils.lerp(topHalfZ, hipSpanZ, r);
        const concave = Math.pow(1.0 - r, 1.38);
        const upturn = eaveFlare * Math.pow(r, 2.55) * 1.10;
        const py = ridgeY - roofH + concave * roofH + upturn + 0.09;
        pts.push(new THREE.Vector3(px, py, pz));
      }
      const hipCurve = new THREE.CatmullRomCurve3(pts);
      ceramicParts.push(
        createSmoothTaperedTubeGeometry(
          hipCurve,
          12,
          6,
          () => 0.16 * s,
          (t, theta) => 1.0 + Math.pow(Math.max(0, Math.sin(theta)), 4) * (0.35 + 0.22 * Math.sin(t * Math.PI * 10))
        )
      );
      // Curled dragon-cloud corner volute seated flush on the eave corner (ZERO skinny banana spike!)
      const tip = pts[pts.length - 1];
      const volute = new THREE.TorusGeometry(0.24 * s, 0.095 * s, 6, 10, Math.PI * 1.45);
      volute.rotateY(Math.atan2(sx, sz));
      volute.translate(tip.x + sx * 0.12 * s, tip.y + 0.24 * s, tip.z + sz * 0.12 * s);
      ceramicParts.push(volute);
    }
  }
}

/**
 * Builds a turned antique brick-red terracotta baluster pedestal (or cobalt porcelain drum stand on veranda)
 * + LatheGeometry rolled-rim cobalt blue-and-white porcelain bowl + gnarled multi-branch cloud-pad bonsai — EX-16..EX-18!
 */
function addTerracottaPorcelainBonsai(
  terracottaParts: THREE.BufferGeometry[],
  porcelainParts: THREE.BufferGeometry[],
  stoneParts: THREE.BufferGeometry[],
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
    // Grey Thanh stone square footing pad + smooth 24-segment LatheGeometry classical terracotta baluster pedestal (EX-16!)
    addBox(stoneParts, 0.94 * s, 0.12 * s, 0.94 * s, x, groundY + 0.06 * s, z);
    const pedProfile = [
      new THREE.Vector2(0.42 * s, 0.0),
      new THREE.Vector2(0.40 * s, 0.12 * s),
      new THREE.Vector2(0.31 * s, 0.24 * s),
      new THREE.Vector2(0.24 * s, 0.44 * s),
      new THREE.Vector2(0.29 * s, 0.68 * s),
      new THREE.Vector2(0.34 * s, 0.80 * s),
      new THREE.Vector2(0.23 * s, 0.94 * s),
      new THREE.Vector2(0.38 * s, 1.08 * s),
      new THREE.Vector2(0.45 * s, 1.14 * s),
      new THREE.Vector2(0.42 * s, 1.18 * s)
    ];
    const pedGeo = new THREE.LatheGeometry(pedProfile, 14);
    pedGeo.translate(x, groundY + 0.12 * s, z);
    terracottaParts.push(pedGeo);
    potBaseY = groundY + 1.30 * s;
  } else {
    // Inner veranda waisted blue-and-white ceramic drum pedestal (`đôn sứ lam`, Photo 6 veranda — ZERO orange boxes! EX-18)
    const drumProfile = [
      new THREE.Vector2(0.36 * s, 0.0),
      new THREE.Vector2(0.42 * s, 0.18 * s),
      new THREE.Vector2(0.44 * s, 0.38 * s),
      new THREE.Vector2(0.36 * s, 0.56 * s),
      new THREE.Vector2(0.39 * s, 0.62 * s)
    ];
    const drumGeo = new THREE.LatheGeometry(drumProfile, 12);
    drumGeo.translate(x, groundY, z);
    porcelainParts.push(drumGeo);
    potBaseY = groundY + 0.62 * s;
  }

  // Smooth LatheGeometry Cobalt Blue-and-White Rolled-Rim Porcelain Bowl (`Chậu Sứ Lam Huế`, EX-17!)
  const bowlProfile = [
    new THREE.Vector2(0.28 * s, 0.0),
    new THREE.Vector2(0.34 * s, 0.06 * s),
    new THREE.Vector2(0.46 * s, 0.24 * s),
    new THREE.Vector2(0.50 * s, 0.40 * s),
    new THREE.Vector2(0.48 * s, 0.46 * s),
    new THREE.Vector2(0.56 * s, 0.50 * s),
    new THREE.Vector2(0.54 * s, 0.55 * s),
    new THREE.Vector2(0.44 * s, 0.52 * s)
  ];
  const bowlGeo = new THREE.LatheGeometry(bowlProfile, 14);
  bowlGeo.translate(x, potBaseY, z);
  porcelainParts.push(bowlGeo);
  // Dark mossy soil bed inside bowl
  addCyl(woodParts, 0.44 * s, 0.42 * s, 0.08 * s, 12, x, potBaseY + 0.46 * s, z);

  // Gnarled multi-branch miniature pine bonsai trunk + spreading boughs + layered sunlit cloud-pads (`tán mâm xôi` — EX-18!)
  const treeY = potBaseY + 0.48 * s;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, treeY, z),
    new THREE.Vector3(x + 0.18 * s, treeY + 0.52 * s, z - 0.14 * s),
    new THREE.Vector3(x - 0.14 * s, treeY + 1.12 * s, z + 0.16 * s),
    new THREE.Vector3(x + 0.08 * s, treeY + 1.72 * s, z - 0.04 * s)
  ]);
  woodParts.push(createSmoothTaperedTubeGeometry(trunkCurve, 10, 6, (t) => (0.095 - t * 0.055) * s));
  // 2 spreading horizontal bonsai boughs
  for (const [bx, by, bz] of [
    [0.48, 0.86, -0.34],
    [-0.46, 1.18, 0.36]
  ]) {
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, treeY + by * 0.72 * s, z),
      new THREE.Vector3(x + bx * 0.6 * s, treeY + by * 0.92 * s, z + bz * 0.6 * s),
      new THREE.Vector3(x + bx * s, treeY + by * s, z + bz * s)
    ]);
    woodParts.push(createSmoothTaperedTubeGeometry(bCurve, 6, 5, (t) => (0.052 - t * 0.025) * s));
  }

  // Dense layered cloud-pad foliage puffs graded sunlit chartreuse tips -> deep shadowed forest undersides
  const pads: Array<[number, number, number, number, string]> = [
    [0.42, 0.82, -0.34, 0.72, '#1d4c16'],
    [0.48, 0.94, -0.30, 0.66, '#4c8e28'],
    [-0.42, 1.12, 0.34, 0.76, '#1a4514'],
    [-0.36, 1.24, 0.38, 0.68, '#54962c'],
    [0.24, 1.44, 0.24, 0.70, '#2e6e1e'],
    [-0.22, 1.56, -0.22, 0.68, '#28641b'],
    [0.06, 1.84, 0.02, 0.84, '#5ea032'],
    [0.18, 1.94, -0.06, 0.62, '#70b03a'],
    [-0.08, 1.76, 0.10, 0.62, '#225818']
  ];
  for (let pi = 0; pi < pads.length; pi++) {
    const [ox, oy, oz, rad, col] = pads[pi];
    for (let c = 0; c < 4; c++) {
      const card = new THREE.PlaneGeometry(rad * s * 1.42, rad * s * 0.92);
      card.rotateX(c === 0 ? 0.55 : c === 1 ? -0.45 : c === 2 ? 0.15 : -0.15);
      card.rotateY((c / 4) * Math.PI + pi * 0.85);
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
  /** Total depth along X (Macro: 30m, Core: 24m) */
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
  const rafterOrangeParts: THREE.BufferGeometry[] = [];
  const doorGlassParts: THREE.BufferGeometry[] = [];
  const keGocParts: THREE.BufferGeometry[] = [];

  // 1. Raised Dressed Thanh Stone Plinth + 3 Front Monolithic Nguyễn Dragon Staircases (Photo 6!)
  addBox(thanhStoneParts, depthX + 3.6, plinthH, widthZ + 3.6, hx, y + plinthH * 0.5, cz);
  addBox(thanhStoneParts, depthX + 4.1, 0.16, widthZ + 4.1, hx, floorY - 0.06, cz);

  // Glossy Antique Encaustic Imperial Floor Tiles (tighter authentic ~0.36m tile scale — AS-20, IN-25!)
  const floorGeo = applyWorldBoxUV(
    new THREE.PlaneGeometry(depthX - 1.2, widthZ - 1.4).rotateX(-Math.PI * 0.5).translate(hx, floorY + 0.025, cz),
    1.55
  );
  const floorMesh = new THREE.Mesh(floorGeo, hp.encausticFloorMat);
  floorMesh.receiveShadow = true;
  targetGroup.add(floorMesh);

  // 3 Plinth Staircases with Monolithic Nguyễn Dragon Balustrades (`EX-15`)
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
      addBox(thanhStoneParts, 0.48, sh, sw, sx, y + sh * 0.5, sz);
    }
    for (const s of [-1, 1]) {
      const rz = sz + s * (sw * 0.5 + 0.26);
      thanhStoneParts.push(
        ...createHueNguyenDragonBalustradeParts(frontX + 3.85, y, rz, frontX + 1.6, floorY, rz, 0.78)
      );
    }
  }
  // Item 037: Carved Thanh stone *Ngũ Bậc* royal dragon-ramp (*Long Đạo*) slanting down center of main staircase
  addBox(thanhStoneParts, 2.35, 0.16, 1.35, frontX + 2.72, y + plinthH * 0.52, cz, 0, 0, -0.36);
  // Item 044 & 049 & 051 & 054: Tán Lọng parasol pedestals, stone drainage gargoyles, outer corner Kỳ Lân & weathered moss plinth skirt
  for (const s of [-1, 1]) {
    addBox(thanhStoneParts, 0.52, 0.36, 0.52, frontX + 1.95, floorY + 0.18, cz + s * 3.4);
    addBox(thanhStoneParts, 0.45, 0.18, 0.24, frontX + 2.15, floorY - 0.16, cz + s * (halfZ * 0.85));
    bronzeParts.push(...createGuardianBeastParts(frontX + 2.10, floorY, cz + s * (halfZ + 0.6), Math.PI * 0.5, 0.95, 'kylan'));
    // Item 047 & 052: Bronze Đỉnh Đồng cauldrons & ceramic Đôn Sứ barrel stools on side terrace galleries
    addBuuDinhBronzeCauldron(bronzeParts, frontX + 2.30, floorY, cz + s * 6.8, 0.46);
    addCyl(porcelainParts, 0.22, 0.20, 0.46, 10, frontX + 1.70, floorY + 0.23, cz + s * 9.5);
  }
  // Item 053: Stepped rear imperial exit staircase behind Điện Thái Hòa
  for (let st = 0; st < 4; st++) {
    const sh = plinthH * ((st + 1) / 4);
    addBox(thanhStoneParts, 0.48, sh, 3.6, rearX - 1.9 - (3 - st) * 0.44, y + sh * 0.5, cz);
  }

  // 2. 9-Bay Shaded Veranda Colonnade + Interior Grid of 28-Segment Glossy Dragon Columns (EX-09, AS-15..AS-17, IN-23, IN-24)
  const numBays = 9;
  const verandaSpanZ = widthZ - 3.6;
  const bayPitchZ = verandaSpanZ / numBays;
  const verandaX = frontX + 0.85;
  const doorX = frontX - 1.35;

  const zScale = widthZ / 44.0;
  const colRowsX = 5;
  const frontBayX = doorX - 1.2;
  const rearColX = rearX + 2.4;
  const rowPitchX = (frontBayX - rearColX) / (colRowsX - 1);
  const heroFrameX = frontBayX - rowPitchX; // 1st inner nave colonnade row

  // 10 Slender Weathered Crimson Exterior Veranda Columns + Carved Stone Plinths + Dark-Timber `Con Sơn` Eave Brackets (EX-09!)
  for (let b = 0; b <= numBays; b++) {
    const pz = cz - verandaSpanZ * 0.5 + b * bayPitchZ;
    const vColH = colH * 0.78;
    addBox(thanhStoneParts, 0.54, 0.22, 0.54, verandaX, floorY + 0.11, pz);
    addCyl(crimsonParts, 0.18, 0.21, vColH, 14, verandaX, floorY + 0.22 + vColH * 0.5, pz);
    addCyl(goldParts, 0.215, 0.215, 0.08, 12, verandaX, floorY + 0.26, pz);
    addCyl(goldParts, 0.20, 0.20, 0.09, 12, verandaX, floorY + 0.22 + vColH - 0.12, pz);
    // Carved dark-timber `con sơn` stepped eave bracket projecting outward under lower roof overhang
    addBox(darkWoodParts, 0.85, 0.14, 0.18, verandaX + 0.34, floorY + 0.22 + vColH - 0.08, pz);
    addBox(darkWoodParts, 0.52, 0.12, 0.16, verandaX + 0.20, floorY + 0.22 + vColH - 0.22, pz);
    // Item 050: Ceremonial red silk palace lanterns hanging along all 9 front veranda bays
    if (b < numBays) {
      const lz = pz + bayPitchZ * 0.5;
      addCyl(brightRedParts, 0.16, 0.14, 0.42, 8, verandaX - 0.12, floorY + 0.22 + vColH - 0.48, lz);
      addCyl(goldParts, 0.10, 0.10, 0.06, 8, verandaX - 0.12, floorY + 0.22 + vColH - 0.26, lz);
    }
  }
  // Item 039: Exterior gilded Hoàng Phi horizontal plaque & vertical Câu Đối couplet boards on central veranda bay
  addBox(crimsonParts, 0.14, 0.78, 2.85, verandaX - 0.05, floorY + colH * 0.76, cz);
  addBox(goldParts, 0.16, 0.72, 2.75, verandaX - 0.03, floorY + colH * 0.76, cz);
  for (const s of [-1, 1]) {
    addBox(crimsonParts, 0.12, 2.45, 0.34, verandaX + 0.18, floorY + colH * 0.46, cz + s * (bayPitchZ * 0.5));
    addBox(goldParts, 0.14, 2.35, 0.26, verandaX + 0.19, floorY + colH * 0.46, cz + s * (bayPitchZ * 0.5));
  }
  // Solid dark-timber veranda ceiling soffit deck + overhanging eave valance (`diềm hiên`) sealing 100% of veranda transom gaps! (EX-06, AS-01)
  const verandaSoffitY = floorY + colH * 0.78 + 0.24;
  addBox(darkWoodParts, verandaX - doorX + 1.4, 0.18, widthZ + 1.6, (verandaX + doorX) * 0.5 + 0.4, verandaSoffitY, cz);
  addBox(darkWoodParts, 0.34, 0.36, widthZ + 2.2, verandaX + 0.92, verandaSoffitY - 0.14, cz);
  // Subtle dark rainwater drip-line strip along veranda edge (EX-30)
  addBox(ironwoodParts, 0.28, 0.02, widthZ + 1.8, verandaX + 0.95, floorY + 0.015, cz);

  // 40 Interior Glossy Crimson Coiling-Dragon Columns (`28`-segment smooth cylinder + sculpted `LatheGeometry` Thanh stone plinths!)
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
  const intColPositions: Array<[number, number]> = [];
  for (let r = 0; r < colRowsX; r++) {
    const rx = frontBayX - r * rowPitchX;
    for (const zOff of trussZLines) {
      intColPositions.push([rx, cz + zOff]);
    }
  }

  const colGeo = new THREE.CylinderGeometry(0.255, 0.295, colH, opts.fullHeroInterior ? 24 : 12);
  const colInst = new THREE.InstancedMesh(colGeo, hp.dragonColumnMat, intColPositions.length);
  colInst.castShadow = true;
  colInst.receiveShadow = true;

  // Sculpted LatheGeometry Weathered Thanh Stone `Chân Tảng` lotus-drum plinths (AS-15, IN-23!)
  const plinthProf = [
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.42, 0.07),
    new THREE.Vector2(0.39, 0.12),
    new THREE.Vector2(0.41, 0.19),
    new THREE.Vector2(0.34, 0.26),
    new THREE.Vector2(0.31, 0.30)
  ];
  const plinthColGeo = new THREE.LatheGeometry(plinthProf, opts.fullHeroInterior ? 18 : 8);
  const plinthInst = new THREE.InstancedMesh(plinthColGeo, hp.weatheredMoatBalustradeMat, intColPositions.length);
  plinthInst.receiveShadow = true;

  // Helper: add delicate lacy alpha-cutout `Kê Góc` triangular openwork golden corner spandrel (IN-24, AS-28, CL-28!)
  const addKeGocSpandrel = (px: number, py: number, pz: number, rotY: number, flipX: number, wSp = 0.62, hSp = 0.66) => {
    const g = new THREE.PlaneGeometry(wSp, hSp);
    if (flipX < 0) {
      const uvAttr = g.attributes.uv;
      for (let vi = 0; vi < uvAttr.count; vi++) {
        uvAttr.setX(vi, 1.0 - uvAttr.getX(vi));
      }
    }
    g.rotateY(rotY);
    g.translate(px, py, pz);
    keGocParts.push(g);
  };

  for (let i = 0; i < intColPositions.length; i++) {
    const [cxP, czP] = intColPositions[i];
    setInstMat(colInst, i, cxP, floorY + 0.30 + colH * 0.5, czP, (i * 1.17) % (Math.PI * 2));
    setInstMat(plinthInst, i, cxP, floorY + 0.01, czP, 0);

    // Thin 24K gilded base collar ring flush atop stone plinth (AS-15!)
    const baseRing = new THREE.TorusGeometry(0.298, 0.022, 4, 10);
    baseRing.rotateX(Math.PI * 0.5);
    baseRing.translate(cxP, floorY + 0.31, czP);
    goldParts.push(baseRing);

    // Sculpted 3D gilded dragon-head `Đầu Dư` corbel + lacy openwork `Kê Góc` spandrels!
    const capY = floorY + 0.30 + colH;
    const inwardZ = czP > cz ? -1 : 1;
    if (opts.fullHeroInterior || Math.abs(czP - cz) < 7.0 * zScale) {
      addSculptedDauDuCorbel(goldParts, cxP, capY, czP, inwardZ);
    } else {
      addCyl(goldParts, 0.34, 0.30, 0.20, 8, cxP, capY - 0.10, czP);
    }
    // Longitudinal (±Z) & Transverse (±X) pierced golden openwork spandrels (ZERO upside-down cones!)
    addKeGocSpandrel(cxP, capY - 0.38, czP + 0.44, Math.PI * 0.5, -1, 0.64, 0.68);
    addKeGocSpandrel(cxP, capY - 0.38, czP - 0.44, Math.PI * 0.5, 1, 0.64, 0.68);
    addKeGocSpandrel(cxP + 0.44, capY - 0.38, czP, 0, 1, 0.62, 0.66);
    addKeGocSpandrel(cxP - 0.44, capY - 0.38, czP, 0, -1, 0.62, 0.66);
  }
  colInst.instanceMatrix.needsUpdate = true;
  plinthInst.instanceMatrix.needsUpdate = true;
  targetGroup.add(colInst, plinthInst);

  // Crisp 3×7 Diamond-Weave Imperial Bamboo Blinds (`Mành Tre Quả Trám`, Photo 6!) — FrontSide facing +X so Photo 5 interior doors glow cleanly! (EX-07, AS-03)
  const blindH = colH * 0.64;
  const blindY = floorY + 0.52 + blindH * 0.5;
  const blindParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < numBays; b++) {
    if (b === 4) continue;
    const bz = cz - verandaSpanZ * 0.5 + (b + 0.5) * bayPitchZ;
    if (b === 0 || b === 8) {
      // Multi-leaf authentic carved crimson `Cửa Bức Bàn` doors on far outer veranda bays (EX-08!)
      const lfW = (bayPitchZ - 0.48) / 4;
      for (let lf = 0; lf < 4; lf++) {
        const lz = bz - (bayPitchZ - 0.48) * 0.5 + (lf + 0.5) * lfW;
        // Recessed lower crimson panel + molded stiles + upper dark timber lattice slats
        addBox(crimsonParts, 0.14, colH * 0.36, lfW * 0.92, doorX, floorY + colH * 0.18, lz);
        addBox(goldParts, 0.16, 0.05, lfW * 0.80, doorX + 0.02, floorY + colH * 0.32, lz);
        addBox(goldParts, 0.16, 0.05, lfW * 0.80, doorX + 0.02, floorY + 0.24, lz);
        addBox(ironwoodParts, 0.08, colH * 0.36, lfW * 0.90, doorX - 0.03, floorY + colH * 0.54, lz);
        for (let sl = -2; sl <= 2; sl++) {
          addBox(crimsonParts, 0.12, colH * 0.36, 0.045, doorX + 0.02, floorY + colH * 0.54, lz + sl * (lfW * 0.16));
        }
        addBox(crimsonParts, 0.14, 0.12, lfW * 0.96, doorX, floorY + colH * 0.72, lz);
      }
    } else {
      // Front-facing (+X) bamboo blind for Photo 6 exterior silhouette
      const bPlane = new THREE.PlaneGeometry(bayPitchZ - 0.46, blindH);
      bPlane.rotateY(Math.PI * 0.5);
      bPlane.translate(verandaX - 0.08, blindY, bz);
      blindParts.push(bPlane);
      addBox(darkWoodParts, 0.14, 0.12, bayPitchZ - 0.40, verandaX - 0.06, blindY + blindH * 0.5 + 0.04, bz);
      addBox(darkWoodParts, 0.10, 0.08, bayPitchZ - 0.40, verandaX - 0.06, blindY - blindH * 0.5 - 0.04, bz);
    }
  }
  if (blindParts.length > 0) {
    // Use FrontSide so exterior Photo 6 sees crisp 3x7 diamond blinds while interior Photo 5 glazed doors receive pure daylight!
    hp.bambooBlindMat.side = THREE.FrontSide;
    const blindMesh = new THREE.Mesh(mergeNormalized(blindParts), hp.bambooBlindMat);
    targetGroup.add(blindMesh);
  }

  // Authentic Raised Crimson Wooden Door Threshold Sill (`Ngưỡng Cửa`) + Ceremonial Portal Stanchion Cord (EX-30, AS-12!)
  const doorTopY = floorY + 3.55;
  addBox(crimsonParts, 0.22, 0.14, verandaSpanZ, doorX, floorY + 0.07, cz);
  // Continuous solid dark-crimson header lintel & sealed upper spandrel wall above ALL doors (ZERO sky leak! AS-01, AS-27!)
  addBox(crimsonParts, 0.30, 0.28, widthZ - 0.4, doorX, doorTopY + 0.14, cz);
  addBox(crimsonParts, 0.28, colH + 0.75 - 3.68, widthZ - 0.4, doorX + 0.08, (doorTopY + 0.28 + floorY + colH + 0.75) * 0.5, cz);

  // Flanking low ceremonial gilded entrance bollards (leaving Bửu Đỉnh 100% unobstructed in foreground center! IN-16)
  for (const s of [-1, 1]) {
    addCyl(goldParts, 0.035, 0.045, 0.84, 8, doorX + 0.42, floorY + 0.42, cz + s * 2.15);
  }

  // Authentic Open Accordion-Folded 4-Leaf Glazed `Cửa Bức Bàn` Doors (Photo 5 Left Wall — AS-12!)
  for (let b = 0; b < numBays; b++) {
    const bz = cz - verandaSpanZ * 0.5 + (b + 0.5) * bayPitchZ;
    // Heavy crimson vertical door jamb columns between bays
    addBox(crimsonParts, 0.24, 3.62, 0.22, doorX, floorY + 1.81, bz - bayPitchZ * 0.5);
    if (b === 4) {
      for (const s of [-1, 1]) {
        addBox(crimsonParts, 0.14, 3.42, 0.78, doorX + 0.14, floorY + 1.82, bz + s * (bayPitchZ * 0.68));
        addBox(goldParts, 0.16, 0.08, 0.70, doorX + 0.14, floorY + 1.65, bz + s * (bayPitchZ * 0.68));
      }
      continue;
    }
    if (b === 0 || b === 8) continue;

    // 4-Leaf accordion pairs folded wide open at realistic 70°–82° angles so bright outdoor daylight pours through!
    const leafW = (bayPitchZ - 0.54) / 4;
    const leafH = 3.38;
    const lowerH = leafH * 0.46;
    const upperH = leafH * 0.54;
    for (let lf = 0; lf < 4; lf++) {
      const pairSide = lf < 2 ? -1 : 1;
      const isOuter = lf === 0 || lf === 3;
      const lz = bz + pairSide * (bayPitchZ * 0.5 - 0.42 - (isOuter ? 0.14 : 0.68));
      const openAng = pairSide * (isOuter ? 1.24 : 1.05);
      const lx = doorX - (isOuter ? 0.38 : 0.72);

      // Lower 46%: Sculpted crimson stile frame + double recessed panel + crisp double 24K gold molding!
      addBox(crimsonParts, 0.09, lowerH, leafW * 0.94, lx, floorY + 0.14 + lowerH * 0.5, lz, openAng);
      addBox(goldParts, 0.11, 0.055, leafW * 0.80, lx, floorY + 0.14 + lowerH - 0.12, lz, openAng);
      addBox(goldParts, 0.11, 0.055, leafW * 0.80, lx, floorY + 0.14 + lowerH * 0.50, lz, openAng);
      addBox(goldParts, 0.11, 0.055, leafW * 0.80, lx, floorY + 0.26, lz, openAng);

      // Upper 54%: Crisp 2×4 crimson wooden muntin lattice framing luminous cool-daylight glass panes!
      const uMidY = floorY + 0.14 + lowerH + upperH * 0.5;
      addBox(doorGlassParts, 0.025, upperH - 0.12, leafW * 0.84, lx, uMidY, lz, openAng);
      // Outer crimson frame rails + 3 horizontal muntins + central vertical mullion
      addBox(crimsonParts, 0.09, 0.08, leafW * 0.94, lx, floorY + 0.14 + leafH - 0.04, lz, openAng);
      addBox(crimsonParts, 0.08, upperH, 0.06, lx, uMidY, lz, openAng);
      for (const hFrac of [0.25, 0.50, 0.75]) {
        addBox(crimsonParts, 0.07, 0.045, leafW * 0.88, lx, floorY + 0.14 + lowerH + upperH * hFrac, lz, openAng);
      }
      // Antique bronze hinge straps
      addBox(bronzeParts, 0.11, 0.08, 0.08, lx + 0.02, floorY + 0.72, lz, openAng);
      addBox(bronzeParts, 0.11, 0.08, 0.08, lx + 0.02, floorY + 2.65, lz, openAng);
    }
  }

  // Front Veranda Porcelain Bonsai Planters (on cobalt ceramic drum stands!) & Lush Conical Corner Topiaries (Photo 6 — EX-18!)
  for (const s of [-1, 1]) {
    addTerracottaPorcelainBonsai(
      terracottaParts,
      porcelainParts,
      thanhStoneParts,
      darkWoodParts,
      foliageParts,
      verandaX + 1.15,
      floorY,
      cz + s * (bayPitchZ * 1.15),
      0.86,
      false
    );
    // Dense solid manicured teardrop dark-emerald corner topiary on carved stone planter (EX-18)
    const tx = verandaX + 1.15;
    const tz = cz + s * (halfZ - 0.5);
    addBox(thanhStoneParts, 0.96, 0.56, 0.96, tx, floorY + 0.28, tz);
    addBox(thanhStoneParts, 1.04, 0.10, 1.04, tx, floorY + 0.58, tz);
    addCyl(darkWoodParts, 0.10, 0.13, 0.55, 6, tx, floorY + 0.80, tz);
    for (let t = 0; t < 6; t++) {
      const frac = t / 5;
      const cardW = (1.58 - frac * 1.12);
      const col = t < 2 ? '#163c12' : t < 4 ? '#22581a' : '#357826';
      for (let c = 0; c < 4; c++) {
        const card = new THREE.PlaneGeometry(cardW, 0.88);
        card.rotateX(c % 2 === 0 ? 0.28 : -0.28);
        card.rotateY((c / 4) * Math.PI + t * 0.55);
        card.translate(tx, floorY + 1.16 + t * 0.36, tz);
        foliageParts.push(colorizeGeometry(card, col));
      }
    }
  }

  // 3. Weathered Aged-Plaster Exterior End Walls (`Tường Hồi` + Thanh Stone Base Dado, EX-10) & Deep Burnished `Vách Đố Bản` + SEALED GABLES (AS-02, AS-18)!
  const wallH = colH + 0.45;
  const beamBaseY = floorY + colH + 0.30;
  const ridgePeakY = beamBaseY + (opts.fullHeroInterior ? 2.85 : 2.35);

  addBox(plasterParts, depthX, wallH, 0.45, hx, floorY + wallH * 0.5, cz - halfZ);
  addBox(plasterParts, depthX, wallH, 0.45, hx, floorY + wallH * 0.5, cz + halfZ);
  addBox(plasterParts, 0.45, wallH, widthZ, rearX, floorY + wallH * 0.5, cz);
  // Dark weathered Thanh stone base water-table dado along exterior end walls (EX-10)
  for (const s of [-1, 1]) {
    addBox(thanhStoneParts, depthX + 0.2, 0.52, 0.56, hx, floorY + 0.26, cz + s * halfZ);
    addBox(plasterParts, 0.55, colH * 0.78, 1.85, frontX - 0.2, floorY + colH * 0.39, cz + s * (halfZ - 0.9));
    for (const gx of [hx + depthX * 0.24, hx - depthX * 0.24]) {
      const rim = new THREE.TorusGeometry(1.05, 0.11, 6, 18);
      rim.translate(gx, floorY + wallH * 0.54, cz + s * (halfZ + 0.25));
      crimsonParts.push(rim);
      goldParts.push(...createShouCharacterParts(gx, floorY + wallH * 0.54, cz + s * (halfZ + 0.28), 0.44, 'tron', s < 0 ? Math.PI : 0));
    }
  }

  // SEAL TRIANGULAR GABLE VOIDS ABOVE BOTH NORTH & SOUTH END WALLS (AS-02 — ZERO sky or tree leaks into interior!)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfX - 0.4, 0);
  gableShape.lineTo(halfX + 0.4, 0);
  gableShape.lineTo(0, ridgePeakY - (floorY + wallH) + 0.95);
  gableShape.closePath();
  for (const s of [-1, 1]) {
    const extGable = new THREE.ExtrudeGeometry(gableShape, { depth: 0.32, bevelEnabled: false });
    extGable.translate(hx, floorY + wallH - 0.12, cz + s * (halfZ - 0.16) - (s > 0 ? 0.16 : 0.16));
    plasterParts.push(extGable);
    const intGable = new THREE.ExtrudeGeometry(gableShape, { depth: 0.16, bevelEnabled: false });
    intGable.translate(hx, floorY + wallH - 0.12, cz + s * (halfZ - 0.34));
    crimsonParts.push(intGable);
  }

  // Rich Burnished Honey-Ochre Panelled Interior Walls (`Vách Đố Bản`) + 3D Projecting Crimson Pilasters & Rails (AS-18!)
  const makeVachWall = (w: number, h: number, px: number, py: number, pz: number, ry: number) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(ry);
    geo.translate(px, py, pz);
    const mesh = new THREE.Mesh(geo, hp.vachDoBanMat);
    mesh.receiveShadow = true;
    targetGroup.add(mesh);
  };
  makeVachWall(depthX - 0.8, wallH - 0.15, hx, floorY + wallH * 0.5, cz - halfZ + 0.30, 0);
  makeVachWall(depthX - 0.8, wallH - 0.15, hx, floorY + wallH * 0.5, cz + halfZ - 0.30, Math.PI);
  makeVachWall(widthZ - 0.8, wallH - 0.15, rearX + 0.30, floorY + wallH * 0.5, cz, Math.PI * 0.5);

  // Physical 3D projecting crimson structural pilasters & cornice rails across the North/South Vách Đố Bản end walls (AS-18!)
  for (const s of [-1, 1]) {
    const wz = cz + s * (halfZ - 0.36);
    addBox(crimsonParts, depthX - 0.8, 0.22, 0.16, hx, floorY + wallH - 0.10, wz);
    addBox(crimsonParts, depthX - 0.8, 0.16, 0.14, hx, floorY + wallH * 0.74, wz);
    addBox(goldParts, depthX - 0.8, 0.05, 0.17, hx, floorY + wallH * 0.74, wz);
    for (let px = rearX + 2.4; px <= frontBayX + 0.5; px += rowPitchX) {
      addBox(crimsonParts, 0.22, wallH - 0.15, 0.16, px, floorY + wallH * 0.5, wz);
    }
  }

  // Deep Recessed Flanking Doorways on Rear West Wall (dark interior shadow void + projecting crimson jambs & gold lintel — IN-28!)
  for (const s of [-1, 1]) {
    const dz = cz + s * (halfZ * 0.56);
    addBox(ironwoodParts, 0.18, 3.55, 2.20, rearX + 0.34, floorY + 1.775, dz);
    for (const js of [-1, 1]) {
      addBox(crimsonParts, 0.26, 3.68, 0.22, rearX + 0.40, floorY + 1.84, dz + js * 1.18);
    }
    addBox(crimsonParts, 0.28, 0.26, 2.66, rearX + 0.42, floorY + 3.68, dz);
    addBox(goldParts, 0.30, 0.10, 2.72, rearX + 0.44, floorY + 3.82, dz);
  }

  // 4. AUTHENTIC `TRÙNG THIỀM ĐIỆP ỐC` TWIN-VAULT CEILING & 4-TIER STEPPED `CHỒNG RƯỜNG — GIẢ THỦ` TRUSSES OVER THE LONGITUDINAL AISLE!
  //    (AS-04..AS-11, IN-05, IN-10, IN-11)
  //    Vault 1 (Tiền Điện): centered directly over the front longitudinal aisle (`frontVaultX = (frontBayX + heroFrameX) * 0.5`)!
  //    Vault 2 (Chính Điện): spanning the inner throne nave behind `heroFrameX`!
  const frontVaultX = (frontBayX + heroFrameX) * 0.5;
  const frontAisleSpanX = Math.abs(frontBayX - heroFrameX); // ~5.6–6.2m
  const frontVaultPeakY = beamBaseY + (opts.fullHeroInterior ? 2.65 : 2.25);

  const mainVaultMinX = rearColX - 1.2;
  const mainVaultMaxX = heroFrameX;
  const mainVaultX = (mainVaultMinX + mainVaultMaxX) * 0.5;
  const mainVaultHalfX = (mainVaultMaxX - mainVaultMinX) * 0.5;

  // Longitudinal tie-beams (`xà dọc`) running along Z across every X column row with crisp gold soffit fillets
  for (let r = 0; r < colRowsX; r++) {
    const rx = frontBayX - r * rowPitchX;
    addBox(crimsonParts, 0.32, 0.38, widthZ - 0.8, rx, beamBaseY, cz);
    addBox(goldParts, 0.35, 0.06, widthZ - 1.0, rx, beamBaseY - 0.17, cz);
  }

  // Helper: Sculpted 4-Tier Stepped `Chồng Rường — Giả Thủ` Truss with Cambered Beams, 5 Gilded Cloud Cartouches & Pierced `Hồi Văn` Key-Fret Blocks! (AS-05..AS-07)
  const addChongRuongTruss = (centerX: number, spanX: number, baseY: number, peakY: number, tz: number) => {
    const halfSpan = spanX * 0.5;
    // Lower cambered crimson tie-beam (`Câu Đầu`) with bullnose rounded ends & 5 gilded cloud-scroll cartouches + gold soffit pinstripe
    addBox(crimsonParts, spanX + 0.55, 0.36, 0.30, centerX, baseY, tz);
    addBox(goldParts, spanX + 0.35, 0.045, 0.33, centerX, baseY - 0.16, tz);
    for (const fOff of [-0.40, -0.20, 0, 0.20, 0.40]) {
      addBox(goldParts, Math.min(0.68, spanX * 0.13), 0.17, 0.34, centerX + fOff * spanX, baseY + 0.01, tz);
    }
    // Rounded bullnose beam end-caps
    for (const s of [-1, 1]) {
      addCyl(crimsonParts, 0.18, 0.18, 0.30, 10, centerX + s * (halfSpan + 0.26), baseY, tz, Math.PI * 0.5, 0);
    }

    // 4 Stepped Pyramidal `Chồng Rường` Tiers climbing cleanly to the aisle ridge with central pierced `Hồi Văn` key-fret blocks!
    const tierFracs: Array<[number, number]> = [
      [0.24, 0.78],
      [0.48, 0.56],
      [0.71, 0.36],
      [0.90, 0.20]
    ];
    let prevY = baseY + 0.18;
    for (let t = 0; t < tierFracs.length; t++) {
      const [hFrac, wFrac] = tierFracs[t];
      const ty = THREE.MathUtils.lerp(baseY, peakY, hFrac);
      const bw = spanX * wFrac;
      const gapH = Math.max(0.24, ty - prevY);
      const midGapY = prevY + gapH * 0.5;

      // Stepped horizontal crimson beam + gilded cloud cartouche + lower gold pinstripe
      addBox(crimsonParts, bw, 0.24, 0.26, centerX, ty, tz);
      addBox(goldParts, bw * 0.96, 0.04, 0.29, centerX, ty - 0.11, tz);
      for (const cOff of bw > 2.8 ? [-0.28, 0, 0.28] : [0]) {
        addBox(goldParts, Math.min(0.62, bw * 0.24), 0.14, 0.30, centerX + cOff * bw, ty, tz);
      }

      // Center Pierced 3D `Hồi Văn` Key-Fret Carved Strut Block (`Chạm Lộng Hồi Văn` — AS-07!)
      const hvW = Math.min(1.10, bw * 0.42);
      addBox(crimsonParts, hvW, 0.06, 0.18, centerX, midGapY + gapH * 0.30, tz);
      addBox(crimsonParts, hvW, 0.06, 0.18, centerX, midGapY - gapH * 0.30, tz);
      addBox(goldParts, hvW + 0.06, 0.035, 0.21, centerX, midGapY + gapH * 0.30, tz);
      addBox(goldParts, hvW + 0.06, 0.035, 0.21, centerX, midGapY - gapH * 0.30, tz);
      for (const hs of [-1, 1]) {
        addBox(crimsonParts, 0.08, gapH * 0.84, 0.18, centerX + hs * hvW * 0.44, midGapY, tz);
        addBox(goldParts, 0.10, gapH * 0.34, 0.20, centerX + hs * hvW * 0.22, midGapY, tz);
      }

      // Flanking cantilevered `Giả Thủ` stepped bracket cradles supporting beam ends
      for (const s of [-1, 1]) {
        const sx = centerX + s * (bw * 0.42);
        addBox(crimsonParts, 0.20, gapH, 0.22, sx, midGapY, tz);
        addBox(goldParts, 0.34, 0.09, 0.26, sx, ty - 0.16, tz);
        addBox(goldParts, 0.28, 0.08, 0.25, sx, prevY + 0.06, tz);
      }
      prevY = ty + 0.12;
    }

    // Sloped diagonal `Kèo` rafters flanking the 4-tier truss down to both aisle colonnade lines
    const slopeLen = Math.hypot(halfSpan + 0.25, peakY - baseY);
    const slopeAng = Math.atan2(peakY - baseY, halfSpan + 0.25);
    for (const s of [-1, 1]) {
      addBox(crimsonParts, slopeLen, 0.22, 0.22, centerX + s * (halfSpan * 0.5), (baseY + peakY) * 0.5 + 0.06, tz, 0, 0, -s * slopeAng);
      addBox(goldParts, slopeLen * 0.90, 0.06, 0.25, centerX + s * (halfSpan * 0.5), (baseY + peakY) * 0.5 - 0.05, tz, 0, 0, -s * slopeAng);
    }
  };

  // Build all 8 consecutive 4-tier `Chồng Rường` trusses directly overhead along the Front Longitudinal Aisle (Photo 5!)
  // PLUS side-aisle arched `Kẻ / Xà Nách` beams & main-hall trusses!
  for (let zi = 0; zi < trussZLines.length; zi++) {
    const zOff = trussZLines[zi];
    const tz = cz + zOff;
    if (opts.fullHeroInterior || (zi >= 2 && zi <= 5)) {
      addChongRuongTruss(frontVaultX, frontAisleSpanX, beamBaseY, frontVaultPeakY, tz);
    } else {
      addBox(crimsonParts, frontAisleSpanX + 0.5, 0.34, 0.28, frontVaultX, beamBaseY, tz);
    }

    // Left (East) side-aisle arched `Kẻ Hiên` spanning from frontBayX to doorX + gilded cloud plaque (AS-11!)
    const sideSpan = Math.abs(doorX - frontBayX) + 0.3;
    const sideAng = 0.30;
    addBox(crimsonParts, sideSpan, 0.24, 0.22, (frontBayX + doorX) * 0.5, beamBaseY - 0.16, tz, 0, 0, -sideAng);
    addBox(goldParts, sideSpan * 0.65, 0.08, 0.25, (frontBayX + doorX) * 0.5, beamBaseY - 0.26, tz, 0, 0, -sideAng);

    // Main Hall (*Chính Điện*) tie-beam + stepped upper trusses behind `heroFrameX`
    const mainSpan = mainVaultMaxX - mainVaultMinX;
    addBox(crimsonParts, mainSpan, 0.34, 0.28, mainVaultX, beamBaseY, tz);
    addBox(goldParts, mainSpan * 0.92, 0.05, 0.31, mainVaultX, beamBaseY - 0.16, tz);
    // Diagonal `Kèo Quyết` rafters framing the central `"殿和太"` hero bay with sculpted gilded cloud cartouches (IN-11!)
    const isHeroCol = Math.abs(Math.abs(zOff) - 2.75 * zScale) < 0.35;
    for (const s of [-1, 1]) {
      const mSlopeLen = Math.hypot(mainVaultHalfX, ridgePeakY - beamBaseY);
      const mSlopeAng = Math.atan2(ridgePeakY - beamBaseY, mainVaultHalfX);
      addBox(crimsonParts, mSlopeLen, 0.24, 0.22, mainVaultX + s * (mainVaultHalfX * 0.5), (beamBaseY + ridgePeakY) * 0.5 + 0.06, tz, 0, 0, -s * mSlopeAng);
      if (isHeroCol && s > 0) {
        // Ornate gilded double-stripe + 3 raised cloud-scroll plaques on the 2 diagonal rafters framing `"殿和太"` (IN-11!)
        addBox(goldParts, mSlopeLen * 0.92, 0.08, 0.27, mainVaultX + mVaultHalfOr(mainVaultHalfX) * 0.5, (beamBaseY + ridgePeakY) * 0.5 - 0.06, tz, 0, 0, -mSlopeAng);
        for (const pFrac of [0.22, 0.50, 0.78]) {
          addBox(
            goldParts,
            0.92,
            0.16,
            0.30,
            THREE.MathUtils.lerp(mainVaultX, mainVaultMaxX, pFrac),
            THREE.MathUtils.lerp(ridgePeakY, beamBaseY, pFrac) + 0.02,
            tz,
            0,
            0,
            -mSlopeAng
          );
        }
      }
    }
  }

  // Dense Glossy Dark-Crimson Parallel Rafters (`Rui`) via InstancedMesh (116 tightly spaced rafters! AS-10)
  // + Sealed Dark-Crimson Roof Sheathing (`#200203`) across Front Aisle Vault, Left Door Side-Aisle & Main Hall Vault!
  const frontHalfX = frontAisleSpanX * 0.5 + 0.15;
  const fSlopeLen = Math.hypot(frontHalfX, frontVaultPeakY - beamBaseY);
  const fSlopeAng = Math.atan2(frontVaultPeakY - beamBaseY, frontHalfX);
  const numRafters = opts.fullHeroInterior ? 96 : 64;
  const rafterGeo = new THREE.BoxGeometry(fSlopeLen, 0.085, 0.085);
  const rafterInst = new THREE.InstancedMesh(rafterGeo, hp.imperialCrimsonWoodMat, numRafters * 2);
  let rIdx = 0;
  for (const s of [-1, 1]) {
    // Longitudinal cylindrical purlins (`Xà Gồ`) with slim gold trim along Front Aisle Vault
    for (let p = 0; p < 4; p++) {
      const frac = (p + 0.5) / 4;
      const px = frontVaultX + s * (frac * frontHalfX);
      const py = THREE.MathUtils.lerp(frontVaultPeakY + 0.05, beamBaseY + 0.14, frac);
      addCyl(crimsonParts, 0.095, 0.095, widthZ - 0.4, 8, px, py, cz, Math.PI * 0.5, 0);
      addBox(goldParts, 0.05, 0.03, widthZ - 0.6, px, py - 0.09, cz);
    }
    for (let rf = 0; rf < numRafters; rf++) {
      const rz = cz - (halfZ - 0.45) + (rf / (numRafters - 1)) * (widthZ - 0.9);
      setInstMat(
        rafterInst,
        rIdx++,
        frontVaultX + s * (frontHalfX * 0.5),
        (beamBaseY + frontVaultPeakY) * 0.5 + 0.20,
        rz,
        0,
        1,
        1,
        1,
        0,
        -s * fSlopeAng
      );
    }
    // Sealed deep-shadowed roof boarding above rafters (0% sky leak!)
    addBox(ironwoodParts, fSlopeLen + 0.4, 0.12, widthZ + 0.2, frontVaultX + s * (frontHalfX * 0.5), (beamBaseY + frontVaultPeakY) * 0.5 + 0.30, cz, 0, 0, -s * fSlopeAng);
  }
  rafterInst.instanceMatrix.needsUpdate = true;
  targetGroup.add(rafterInst);
  addCyl(crimsonParts, 0.12, 0.12, widthZ - 0.4, 10, frontVaultX, frontVaultPeakY + 0.10, cz, Math.PI * 0.5, 0);

  // Sealed Left Side-Aisle Sloped Sheathing & Rafters connecting `frontBayX` cleanly over `doorX` (AS-01, AS-11!)
  const leftSideLen = Math.hypot(doorX - frontBayX + 0.8, 0.85);
  addBox(ironwoodParts, leftSideLen, 0.14, widthZ + 0.2, (frontBayX + doorX) * 0.5 + 0.2, beamBaseY - 0.06, cz, 0, 0, -0.32);

  // Main Hall Vault Dark-Crimson Sheathing + Vivid Alternating Glossy Crimson & Tangerine-Orange Striped Rafters Directly ABOVE `"殿和太"`! (IN-05, IN-10!)
  const mSlopeLen = Math.hypot(mainVaultHalfX + 0.4, ridgePeakY - beamBaseY);
  const mSlopeAng = Math.atan2(ridgePeakY - beamBaseY, mainVaultHalfX + 0.4);
  for (const s of [-1, 1]) {
    addBox(ironwoodParts, mSlopeLen + 0.4, 0.14, widthZ + 0.2, mainVaultX + s * (mainVaultHalfX * 0.5), (beamBaseY + ridgePeakY) * 0.5 + 0.30, cz, 0, 0, -s * mSlopeAng);
    for (let p = 0; p < 4; p++) {
      const frac = (p + 0.5) / 4;
      const px = mainVaultX + s * (frac * mainVaultHalfX);
      const py = THREE.MathUtils.lerp(ridgePeakY + 0.05, beamBaseY + 0.14, frac);
      addCyl(crimsonParts, 0.09, 0.09, widthZ - 0.6, 8, px, py, cz, Math.PI * 0.5, 0);
    }
  }
  // Photo 3 Iconic Canopy Directly Over `"殿和太"`: Tightly packed alternating glossy crimson & fiery tangerine-orange striped rafters! (IN-10!)
  const heroStripeSpanZ = 5.4 * zScale;
  const heroStripeCount = 24;
  for (let rs = 0; rs < heroStripeCount; rs++) {
    const rz = cz - heroStripeSpanZ * 0.5 + (rs / (heroStripeCount - 1)) * heroStripeSpanZ;
    const isOrange = rs % 2 === 1;
    addBox(
      isOrange ? rafterOrangeParts : crimsonParts,
      fSlopeLen * 0.96,
      0.11,
      0.13,
      frontVaultX - frontHalfX * 0.5,
      (beamBaseY + frontVaultPeakY) * 0.5 + 0.16,
      rz,
      0,
      0,
      fSlopeAng
    );
  }
  // Thick Glossy Cylindrical Crimson Horizontal Crossbeam (`Xà Ngang Tròn`) directly crowning `"殿和太"` (Photo 3 — IN-10!)
  addCyl(crimsonParts, 0.19, 0.19, 5.5 * zScale, 14, heroFrameX + 0.28, beamBaseY + 1.54, cz, Math.PI * 0.5, 0);

  // 5. GRAND 3D RECESSED `"殿和太"` HOÀNH PHI PLAQUE + BAY-ALIGNED 2-TIER `NHẤT THI NHẤT HỌA` FRIEZES (IN-09, IN-14, IN-15, AS-26!)
  const plaqueW = opts.fullHeroInterior ? 3.30 : 2.70;
  const plaqueH = opts.fullHeroInterior ? 1.84 : 1.50;
  const plaqueY = beamBaseY + 0.12;
  const plaqueX = heroFrameX + 0.44;
  const plaqueTilt = 0.14;

  // Solid crimson backing cabinet (ZERO blank grey back in Photo 5!) + 4-bar 3D beveled carved golden perimeter frame!
  addBox(crimsonParts, 0.18, plaqueH + 0.12, plaqueW + 0.12, plaqueX - 0.12, plaqueY, cz, 0, 0, plaqueTilt);
  addBox(goldParts, 0.22, 0.14, plaqueW + 0.26, plaqueX - 0.04, plaqueY + plaqueH * 0.5 + 0.04, cz, 0, 0, plaqueTilt);
  addBox(goldParts, 0.22, 0.14, plaqueW + 0.26, plaqueX - 0.04, plaqueY - plaqueH * 0.5 - 0.04, cz, 0, 0, plaqueTilt);
  addBox(goldParts, 0.22, plaqueH + 0.24, 0.14, plaqueX - 0.04, plaqueY, cz - plaqueW * 0.5 - 0.05, 0, 0, plaqueTilt);
  addBox(goldParts, 0.22, plaqueH + 0.24, 0.14, plaqueX - 0.04, plaqueY, cz + plaqueW * 0.5 + 0.05, 0, 0, plaqueTilt);
  // 4 Authentic Gilded Vertical U-Clasp Bottom Mounting Hooks gripping lower carved border (Photo 3 — IN-09!)
  for (const lOff of [-plaqueW * 0.33, -plaqueW * 0.11, plaqueW * 0.11, plaqueW * 0.33]) {
    addBox(goldParts, 0.09, 0.14, 0.055, plaqueX + 0.03, plaqueY - plaqueH * 0.5 - 0.05, cz + lOff);
  }
  const hpPlane = new THREE.PlaneGeometry(plaqueW, plaqueH);
  hpPlane.rotateY(Math.PI * 0.5);
  hpPlane.rotateZ(plaqueTilt);
  hpPlane.translate(plaqueX + 0.02, plaqueY, cz);
  targetGroup.add(new THREE.Mesh(hpPlane, hp.hoanhPhiThaiHoaMat));

  // Column-Bay-Aligned DOUBLE-SIDED 2-Tier `Nhất Thi Nhất Họa` Frieze (ZERO center seam! ZERO grey backside! + 3D Cornice Moldings! IN-14, IN-15, AS-09, AS-26!)
  const friezeH = 1.48;
  const friezeY = beamBaseY - 0.80;
  for (let i = 0; i < zLines.length - 1; i++) {
    const z0 = cz + zLines[i];
    const z1 = cz + zLines[i + 1];
    const pw = Math.abs(z1 - z0) - 0.16;
    const pz = (z0 + z1) * 0.5;
    if (pw < 0.8) continue;
    // Closed crimson backing cabinet + projecting 3D molded horizontal crimson/gold cornice bars (top, mid-register, bottom!)
    addBox(crimsonParts, 0.26, friezeH + 0.10, pw + 0.16, heroFrameX, friezeY, pz);
    addBox(goldParts, 0.36, 0.07, pw + 0.16, heroFrameX, friezeY + friezeH * 0.50, pz);
    addBox(crimsonParts, 0.34, 0.08, pw + 0.16, heroFrameX, friezeY + friezeH * 0.21, pz);
    addBox(goldParts, 0.38, 0.04, pw + 0.16, heroFrameX, friezeY + friezeH * 0.18, pz);
    addBox(goldParts, 0.38, 0.09, pw + 0.16, heroFrameX, friezeY - friezeH * 0.50, pz);

    // Front (+X) & Rear (-X) frieze faces cleanly mapped 1:1 per column bay -> central nave bay shows exact Photo 3 symmetry!
    for (const faceDir of [1, -1] as Array<1 | -1>) {
      const pGeo = new THREE.PlaneGeometry(pw, friezeH);
      pGeo.rotateY(faceDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      pGeo.translate(heroFrameX + faceDir * 0.145, friezeY, pz);
      targetGroup.add(new THREE.Mesh(pGeo, hp.interiorNhatThiMat));
    }
  }

  // Left Doorway Inward-Facing Upper `Nhất Thi Nhất Họa` Transom Frieze flush atop the door lintel (AS-01, AS-27!)
  const transomH = 1.24;
  const transomY = doorTopY + 0.28 + transomH * 0.5;
  for (let b = 0; b < numBays; b++) {
    const bz = cz - verandaSpanZ * 0.5 + (b + 0.5) * bayPitchZ;
    const fg = new THREE.PlaneGeometry(bayPitchZ - 0.12, transomH);
    fg.rotateY(-Math.PI * 0.5);
    fg.translate(doorX - 0.16, transomY, bz);
    targetGroup.add(new THREE.Mesh(fg, hp.interiorNhatThiMat));
    addBox(goldParts, 0.18, 0.06, bayPitchZ, doorX - 0.14, transomY - transomH * 0.5, bz);
    addBox(goldParts, 0.18, 0.06, bayPitchZ, doorX - 0.14, transomY + transomH * 0.5, bz);
  }

  // 6. FOREGROUND SCULPTED `BỬU ĐỈNH` (`1.74m`, FRONT-FACING DRAGON!) & GLOSSY RED `CHỮ THỌ TRIỆN` BARRIER (Photo 1 — IN-16..IN-22, AS-03!)
  const cauldronX = frontBayX + 1.15;
  addBuuDinhBronzeCauldron(bronzeParts, cauldronX, floorY, cz, opts.fullHeroInterior ? 0.74 : 0.66);
  // Runs continuously right behind Bửu Đỉnh across the ceremonial nave (Photo 1), while leaving far side aisles unobstructed for Photo 5!
  addCrimsonChuThoBarrier(
    brightRedParts,
    frontBayX + 0.12,
    floorY,
    cz,
    Math.min(halfZ - 2.2, 13.5 * zScale),
    0.0
  );

  // Flanking Antique Bronze Kỳ Lân Guardians & Painted Porcelain Jardinières in Clear Photo 1 Mid-Aisle Sightlines (IN-26, IN-27!)
  const vaseProfile = [
    new THREE.Vector2(0.18, 0.0),
    new THREE.Vector2(0.24, 0.14),
    new THREE.Vector2(0.22, 0.34),
    new THREE.Vector2(0.35, 0.64),
    new THREE.Vector2(0.29, 0.90),
    new THREE.Vector2(0.18, 1.06),
    new THREE.Vector2(0.25, 1.20)
  ];
  for (const s of [-1, 1]) {
    // Repositioned into clearly visible left/right Photo 1 bays right above the red Chữ Thọ fence!
    const klX = frontBayX - rowPitchX * 0.92;
    const klZ = cz + s * (7.6 * zScale);
    addBox(crimsonParts, 1.12, 0.92, 1.12, klX, floorY + 0.46, klZ);
    addBox(goldParts, 1.18, 0.08, 1.18, klX, floorY + 0.94, klZ);
    addBox(goldParts, 1.18, 0.08, 1.18, klX, floorY + 0.08, klZ);
    bronzeParts.push(...createGuardianBeastParts(klX, floorY + 0.98, klZ, Math.PI * 0.5 - s * 0.28, 1.05, 'kylan'));

    // Foreground painted cobalt-porcelain jardinières right behind the red fence + inner sanctuary pair (IN-27!)
    for (const [vx, vz] of [
      [frontBayX - 1.15, cz + s * (4.4 * zScale)],
      [frontBayX - 1.15, cz + s * (11.2 * zScale)],
      [rearX + 5.6, cz + s * (5.6 * zScale)]
    ]) {
      addBox(crimsonParts, 0.64, 0.68, 0.64, vx, floorY + 0.34, vz);
      addBox(goldParts, 0.68, 0.06, 0.68, vx, floorY + 0.70, vz);
      const vaseGeo = new THREE.LatheGeometry(vaseProfile, 18);
      vaseGeo.translate(vx, floorY + 0.72, vz);
      porcelainParts.push(vaseGeo);
    }
  }

  // 7. GOLDEN INNER SANCTUM: TELESCOPING 3D `CỬA VÕNG`, CRIMSON-GOLD 3-TIER DAIS, SCULPTED `NGAI VÀNG`,
  //    3-PART ARCHED `BÌNH PHONG` SCREEN & 4-TIER BAROQUE-NGUYỄN `CỬU LONG ẨN VÂN` COFFER FRAME (CL-15..CL-24, IN-28!)
  const throneX = rearX + (opts.fullHeroInterior ? 6.8 : 5.4);
  const naveHalfZ = 2.75 * zScale;

  // 7a. Telescoping 3D Layered `Cửa Võng` (paired offset planes ±0.055m + clean telescoping step down to Bửu Tán — CL-21!)
  const cvSpecs: Array<[number, number, number, number]> = [
    [throneX + 4.90, beamBaseY - 0.10, naveHalfZ * 1.94, 2.82],
    [throneX + 2.45, beamBaseY - 0.54, naveHalfZ * 1.68, 2.40]
  ];
  for (const [cvX, cvTopY, cvW, cvH] of cvSpecs) {
    for (const offX of [-0.055, 0.055]) {
      const cvPlane = new THREE.PlaneGeometry(cvW, cvH);
      cvPlane.rotateY(Math.PI * 0.5);
      cvPlane.translate(cvX + offX, cvTopY - cvH * 0.5, cz);
      targetGroup.add(new THREE.Mesh(cvPlane, hp.cuaVongFiligreeMat));
    }
    // Stepped 3D crimson-and-gold top cornice header + raised 3D central gilded solar pearl boss
    addBox(crimsonParts, 0.20, 0.16, cvW + 0.12, cvX, cvTopY + 0.04, cz);
    addBox(goldParts, 0.24, 0.10, cvW + 0.18, cvX, cvTopY - 0.06, cz);
    const boss = new THREE.SphereGeometry(0.14, 10, 8);
    boss.scale(0.55, 1.0, 1.0);
    boss.translate(cvX + 0.08, cvTopY - cvH * 0.27, cz);
    goldParts.push(boss);
  }

  // 7b. Crimson-and-Gold 3-Tier `Bệ Ngai Vàng` Dais with Recessed Crimson Risers, Carved Gold Cartouches & Central Ascent Stair (CL-22!)
  const daisTiers: Array<[number, number, number, number]> = [
    [5.8, 5.4, 0.32, 5],
    [4.4, 4.1, 0.32, 4],
    [3.1, 2.9, 0.32, 3]
  ];
  let daisTopY = floorY;
  for (let ti = 0; ti < daisTiers.length; ti++) {
    const [dw, dd, dh, numCart] = daisTiers[ti];
    // Deep glossy crimson lacquer core recessed behind overhanging carved 24K lotus cornice & base molding
    addBox(crimsonParts, dw - 0.12, dh, dd - 0.12, throneX, daisTopY + dh * 0.5, cz);
    addBox(goldParts, dw + 0.14, 0.07, dd + 0.14, throneX, daisTopY + dh - 0.02, cz);
    addBox(goldParts, dw + 0.10, 0.06, dd + 0.10, throneX, daisTopY + 0.03, cz);
    // Rhythmic inlaid carved-gold dragon-cloud relief cartouche panels along East (+X) front & sides
    const cartSpan = (dd - 0.6) / numCart;
    for (let ci = 0; ci < numCart; ci++) {
      const cartZ = cz - (dd - 0.6) * 0.5 + (ci + 0.5) * cartSpan;
      addBox(goldParts, 0.07, dh * 0.52, cartSpan * 0.72, throneX + dw * 0.5 - 0.04, daisTopY + dh * 0.5, cartZ);
    }
    // Central royal ascent stair steps on lower 2 tiers
    if (ti < 2) {
      addBox(crimsonParts, 0.62, dh * 0.92, 1.24, throneX + dw * 0.5 + 0.24, daisTopY + dh * 0.46, cz);
      addBox(goldParts, 0.68, 0.06, 1.32, throneX + dw * 0.5 + 0.24, daisTopY + dh * 0.92, cz);
    }
    daisTopY += dh;
  }

  // 7c. Sculpted `Ngai Vàng Triều Nguyễn` Dragon Throne (Cabriole Legs, Dragon-Head Armrests, Crimson-Backed Dragon Crest & Brocade Cushion — CL-23!)
  const thrY = daisTopY;
  addBox(goldParts, 1.48, 0.26, 1.42, throneX - 0.18, thrY + 0.44, cz);
  // Item 042 & 043: Twin flanking bronze Hạc Chầu Rùa (cranes on tortoises), Bát Bửu halberd racks & lacquered Bình Phong screen behind dais
  addBox(crimsonParts, 0.18, 2.95, 4.2, throneX - 2.45, floorY + 1.48, cz);
  addBox(goldParts, 0.20, 2.75, 4.0, throneX - 2.42, floorY + 1.48, cz);
  for (const s of [-1, 1]) {
    addCyl(bronzeParts, 0.05, 0.16, 1.65, 8, throneX + 0.85, floorY + 0.82, cz + s * 3.15);
    addCyl(goldParts, 0.03, 0.04, 2.35, 6, throneX - 0.65, floorY + 1.18, cz + s * 3.25);
  }
  // Plump imperial saffron-gold brocade seat cushion + side bolsters
  const cushion = new THREE.BoxGeometry(1.20, 0.16, 1.18);
  cushion.translate(throneX - 0.14, thrY + 0.64, cz);
  goldParts.push(cushion);
  addBox(crimsonParts, 1.26, 0.06, 1.24, throneX - 0.14, thrY + 0.58, cz);
  // Cabriole S-scroll curved golden legs (`Chân Quỳ Dạ Cá`)
  for (const lx of [-0.58, 0.58]) {
    for (const lz of [-0.56, 0.56]) {
      const legCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(throneX - 0.18 + lx, thrY + 0.42, cz + lz),
        new THREE.Vector3(throneX - 0.18 + lx * 1.12, thrY + 0.24, cz + lz * 1.10),
        new THREE.Vector3(throneX - 0.18 + lx * 0.96, thrY + 0.04, cz + lz * 0.96)
      ]);
      goldParts.push(createSmoothTaperedTubeGeometry(legCurve, 7, 6, (t) => 0.088 - t * 0.018));
    }
  }
  // Tall stepped backrest with DEEP CRIMSON LACQUER inset center panel (separates throne cleanly from gold rear screen!)
  addBox(goldParts, 0.20, 1.34, 1.50, throneX - 0.86, thrY + 1.16, cz);
  addBox(crimsonParts, 0.24, 1.06, 1.14, throneX - 0.84, thrY + 1.16, cz);
  // Raised carved golden dragon medallion centered on crimson backrest + arched `Lưỡng Long Chầu Nhật` crest & cloud-ear wings
  const backOrb = new THREE.SphereGeometry(0.14, 10, 8);
  backOrb.translate(throneX - 0.82, thrY + 1.98, cz);
  const backArch = new THREE.TorusGeometry(0.74, 0.10, 7, 16, Math.PI);
  backArch.rotateY(Math.PI * 0.5);
  backArch.translate(throneX - 0.84, thrY + 1.72, cz);
  goldParts.push(backOrb, backArch);
  // Swept dragon armrests ending in sculpted 3D upturned dragon heads
  for (const s of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(throneX - 0.84, thrY + 1.48, cz + s * 0.70),
      new THREE.Vector3(throneX - 0.34, thrY + 1.18, cz + s * 0.76),
      new THREE.Vector3(throneX + 0.28, thrY + 1.08, cz + s * 0.72),
      new THREE.Vector3(throneX + 0.62, thrY + 1.32, cz + s * 0.64)
    ]);
    goldParts.push(createSmoothTaperedTubeGeometry(armCurve, 10, 6, () => 0.095));
    const dh = new THREE.SphereGeometry(0.13, 8, 6);
    dh.scale(1.3, 0.95, 0.9);
    dh.translate(throneX + 0.66, thrY + 1.35, cz + s * 0.63);
    goldParts.push(dh);
    addCyl(goldParts, 0.075, 0.09, 0.56, 7, throneX + 0.34, thrY + 0.80, cz + s * 0.68);
  }
  // Cabriole-legged gilded `Đôn Kê Chân` footstool
  addBox(goldParts, 0.70, 0.22, 0.94, throneX + 1.06, thrY + 0.14, cz);
  addBox(crimsonParts, 0.60, 0.06, 0.84, throneX + 1.06, thrY + 0.27, cz);

  // 7d. Authentic 3-Part Rear Sanctum `Bình Phong` Screen (Crimson Outer Frame + Upper Crimson Oval Transom + Arched 24K Hammered Gold-Leaf Screen — CL-24, IN-28!)
  const scrX = throneX - 2.65;
  // Outer deep crimson lacquer surround frame & base dado
  addBox(crimsonParts, 0.26, 4.95, 5.2, scrX - 0.04, floorY + 2.48, cz);
  addBox(goldParts, 0.30, 0.10, 5.3, scrX, floorY + 4.95, cz);
  addBox(goldParts, 0.30, 0.10, 5.3, scrX, floorY + 3.88, cz);
  // Upper recessed crimson transom oval medallion above golden arch (distinctly visible in Photo #3!)
  const transomOval = new THREE.TorusGeometry(0.72, 0.08, 6, 18);
  transomOval.scale(0.55, 1.0, 1.55);
  transomOval.rotateY(Math.PI * 0.5);
  transomOval.translate(scrX + 0.12, floorY + 4.40, cz);
  goldParts.push(transomOval);
  // Central Arched Hammered 24K Gold-Leaf Screen (`Bình Phong Vòm Vàng`, Photo 3!)
  const archW = 3.10;
  const archH = 3.55;
  const screenShape = new THREE.Shape();
  screenShape.moveTo(-archW * 0.5, 0);
  screenShape.lineTo(-archW * 0.5, archH - 0.65);
  screenShape.quadraticCurveTo(-archW * 0.5, archH, -archW * 0.5 + 0.65, archH);
  screenShape.lineTo(archW * 0.5 - 0.65, archH);
  screenShape.quadraticCurveTo(archW * 0.5, archH, archW * 0.5, archH - 0.65);
  screenShape.lineTo(archW * 0.5, 0);
  screenShape.closePath();
  const screenGeo = new THREE.ShapeGeometry(screenShape, 12);
  // Normalize shape UVs to [0..1] for hammered gold-leaf texture
  const sPos = screenGeo.attributes.position;
  const sUv = screenGeo.attributes.uv;
  for (let vi = 0; vi < sPos.count; vi++) {
    sUv.setXY(vi, (sPos.getX(vi) + archW * 0.5) / archW, sPos.getY(vi) / archH);
  }
  screenGeo.rotateY(Math.PI * 0.5);
  screenGeo.translate(scrX + 0.13, floorY + 0.12, cz);
  targetGroup.add(new THREE.Mesh(screenGeo, hp.throneScreenGoldMat));
  // Crisp molded crimson-and-gold inner arch trim framing the gold-leaf screen
  for (const s of [-1, 1]) {
    addBox(goldParts, 0.14, archH, 0.14, scrX + 0.14, floorY + 0.12 + archH * 0.5, cz + s * (archW * 0.5 + 0.06));
  }

  // 7e. 4-TIER BAROQUE-NGUYỄN CARVED GOLDEN COFFER FRAME & `BỬU TÁN` CANOPY AROUND `CỬU LONG ẨN VÂN` (CL-15..CL-18 — ZERO 4-sided pyramids!)
  const buuTanY = floorY + (opts.fullHeroInterior ? 4.55 : 4.20);
  const btSpan = 3.60;
  const clPlane = new THREE.PlaneGeometry(btSpan - 0.24, btSpan - 0.24);
  clPlane.rotateX(Math.PI * 0.5); // Facing straight DOWN (-Y)
  clPlane.rotateY(Math.PI);       // Upright orientation: Hỏa Châu flaming pearl at 12 o'clock when viewed looking up!
  clPlane.translate(throneX, buuTanY + 0.22, cz);
  targetGroup.add(new THREE.Mesh(clPlane, hp.cuuLongAnVanMat));

  // Tier 1: Innermost continuous braided-rope torus molding hugging the `Cửu Long Ẩn Vân` painting perimeter
  // Tier 2: Recessed dark-oxblood shadow cove (`crimsonParts`)
  // Tier 3: Wide `0.38m` multi-layer carved-gold ogee border with undulating scalloped outer rim lobes (matching Photo 4!)
  const halfInner = (btSpan - 0.22) * 0.5;
  for (const s of [-1, 1]) {
    // Tier 1 braided rope molding along all 4 sides
    addCyl(goldParts, 0.055, 0.055, btSpan - 0.14, 12, throneX, buuTanY + 0.20, cz + s * halfInner, 0, Math.PI * 0.5);
    addCyl(goldParts, 0.055, 0.055, btSpan - 0.14, 12, throneX + s * halfInner, buuTanY + 0.20, cz, Math.PI * 0.5, 0);
    // Tier 2 dark recessed shadow cove
    addBox(crimsonParts, btSpan + 0.08, 0.14, 0.10, throneX, buuTanY + 0.26, cz + s * (halfInner + 0.08));
    addBox(crimsonParts, 0.10, 0.14, btSpan + 0.08, throneX + s * (halfInner + 0.08), buuTanY + 0.26, cz);
    // Tier 3 wide deeply-profiled Baroque-Nguyễn carved-gold ogee frame fascia + stepped upper crown
    addBox(goldParts, btSpan + 0.84, 0.34, 0.38, throneX, buuTanY + 0.34, cz + s * (halfInner + 0.30));
    addBox(goldParts, 0.38, 0.34, btSpan + 0.84, throneX + s * (halfInner + 0.30), buuTanY + 0.34, cz);
    addBox(goldParts, btSpan + 1.04, 0.20, 0.28, throneX, buuTanY + 0.62, cz + s * (halfInner + 0.42));
    addBox(goldParts, 0.28, 0.20, btSpan + 1.04, throneX + s * (halfInner + 0.42), buuTanY + 0.62, cz);

    // Undulating scalloped baroque carved-gold rim lobes along the outer coffer perimeter (replaces chunky pyramids! CL-15)
    for (let k = -4; k <= 4; k++) {
      const off = k * 0.42;
      const lobe1 = new THREE.TorusGeometry(0.14, 0.048, 6, 10, Math.PI);
      lobe1.rotateX(Math.PI * 0.5);
      if (s < 0) lobe1.rotateZ(Math.PI);
      lobe1.translate(throneX + off, buuTanY + 0.18, cz + s * (halfInner + 0.48));
      const lobe2 = new THREE.TorusGeometry(0.14, 0.048, 6, 10, Math.PI);
      lobe2.rotateX(Math.PI * 0.5);
      lobe2.rotateZ(s > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
      lobe2.translate(throneX + s * (halfInner + 0.48), buuTanY + 0.18, cz + off);
      goldParts.push(lobe1, lobe2);
    }

    // Lacy gilded scalloped hanging valance apron (`Yếm Tán`) set strictly OUTSIDE inner coffer aperture (`CL-17`, `CL-18`!)
    const valZ = new THREE.PlaneGeometry(btSpan + 0.62, 0.68);
    valZ.translate(throneX, buuTanY - 0.14, cz + s * (halfInner + 0.46));
    targetGroup.add(new THREE.Mesh(valZ, hp.cuaVongFiligreeMat));
    const valX = new THREE.PlaneGeometry(btSpan + 0.62, 0.68);
    valX.rotateY(Math.PI * 0.5);
    valX.translate(throneX + s * (halfInner + 0.46), buuTanY - 0.14, cz);
    targetGroup.add(new THREE.Mesh(valX, hp.cuaVongFiligreeMat));
  }

  // Sculpted LatheGeometry Royal `Lưu Tô` Silk-and-Gold Corner Tassels + Upturned Corner Scrolls (CL-17, CL-18!)
  const tasselProf = [
    new THREE.Vector2(0.02, 0.0),
    new THREE.Vector2(0.11, 0.08),
    new THREE.Vector2(0.09, 0.34),
    new THREE.Vector2(0.04, 0.48),
    new THREE.Vector2(0.08, 0.56),
    new THREE.Vector2(0.04, 0.66),
    new THREE.Vector2(0.09, 0.78),
    new THREE.Vector2(0.03, 0.92)
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tx = throneX + sx * (halfInner + 0.48);
      const tz = cz + sz * (halfInner + 0.48);
      // Upturned dragon-scroll canopy corner finial
      const scroll = new THREE.TorusGeometry(0.16, 0.055, 6, 10, Math.PI * 1.2);
      scroll.rotateY(Math.atan2(sx, sz));
      scroll.translate(tx, buuTanY + 0.78, tz);
      goldParts.push(scroll);
      // Lathe-turned crimson-and-gold royal `lưu tô` tassel
      const tSkirt = new THREE.LatheGeometry(tasselProf, 12);
      tSkirt.translate(tx, buuTanY - 0.86, tz);
      crimsonParts.push(tSkirt);
      const tBell = new THREE.CylinderGeometry(0.05, 0.10, 0.16, 10);
      tBell.translate(tx, buuTanY - 0.36, tz);
      goldParts.push(tBell);
    }
  }

  // 8. EXTERIOR `TRÙNG THIỀM ĐIỆP ỐC` DOUBLE-TIER `HOÀNG LƯU LY` ROOFS + 2048px `CỔ DIÊM` MOSAIC FRIEZE + `CỬU LONG` CROWN (EX-01..EX-06!)
  const lowerEaveY = floorY + colH * 0.80 + 0.24;
  const frontRoofDepth = depthX * 0.56;
  const rearRoofDepth = depthX * 0.58;
  const frontHallX = hx + depthX * 0.24;
  const rearHallX = hx - depthX * 0.24;

  // Lower Tier-1 Hoàng Lưu Ly tubular-tile roof skirt (with downturned fascia lip from createHueImperialHipRoofGeometry!)
  const roofSegS = opts.fullHeroInterior ? 14 : 8;
  const roofSegR = opts.fullHeroInterior ? 9 : 6;
  const lowRoofH = 2.40;
  const frontLow = createHueImperialHipRoofGeometry(
    frontRoofDepth + 4.4,
    widthZ + 3.6,
    frontRoofDepth * 0.68,
    widthZ - 4.2,
    lowRoofH,
    0.20,
    roofSegS,
    roofSegR,
    false
  );
  frontLow.translate(frontHallX + 0.6, lowerEaveY, cz);
  yellowRoofParts.push(frontLow);

  const rearLow = createHueImperialHipRoofGeometry(
    rearRoofDepth + 4.0,
    widthZ + 3.6,
    rearRoofDepth * 0.68,
    widthZ - 4.2,
    lowRoofH + 0.14,
    0.20,
    roofSegS,
    roofSegR,
    false
  );
  rearLow.translate(rearHallX - 0.4, lowerEaveY + 0.10, cz);
  yellowRoofParts.push(rearLow);

  // Curled Ceramic-Mosaic Corner Volutes on LOWER Tier-1 roof corners as well (EX-04!)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cVol = new THREE.TorusGeometry(0.22, 0.08, 6, 10, Math.PI * 1.4);
      cVol.rotateY(Math.atan2(sx, sz));
      cVol.translate(
        frontHallX + 0.6 + sx * (frontRoofDepth + 4.4) * 0.49,
        lowerEaveY + 0.28,
        cz + sz * (widthZ + 3.6) * 0.49
      );
      ceramicParts.push(cVol);
    }
  }

  // Dedicated 2048×256 Polychrome Ceramic-Mosaic `Cổ Diêm` Clerestory Frieze + 3D Crimson Mullion Ribs (EX-03!)
  const coDiemH = 0.86;
  const coDiemY = lowerEaveY + lowRoofH + coDiemH * 0.5 - 0.06;
  const upperBaseY = coDiemY + coDiemH * 0.5 - 0.04;
  const upperRoofH = opts.fullHeroInterior ? 3.12 : 2.72;

  addBox(yellowRoofParts, 5.6, 0.28, widthZ - 5.2, hx, upperBaseY + 0.34, cz);
  // Item 038: Trùng Thiềm Điệp Ốc double-roof valley gutter beam (flaming pearl is already sculpted in addCuuLongCeramicRoofDragons!)
  addBox(darkWoodParts, 0.48, 0.34, widthZ - 3.8, hx, lowerEaveY + lowRoofH + 0.12, cz);
  // Item 045 & 046: Glazed Ống Ngói Lưu Ly eave-end roundels & Đầu Đao upturned corner scrolls along lower roof
  for (let r = -8; r <= 8; r += 2) {
    addCyl(goldParts, 0.09, 0.09, 0.16, 6, frontHallX + 0.6 + (frontRoofDepth + 4.4) * 0.49, lowerEaveY + 0.08, cz + r * 2.2, 0, Math.PI * 0.5);
  }

  const cdW = frontRoofDepth * 0.64;
  const cdZ = widthZ - 4.8;
  addBox(crimsonParts, cdW, coDiemH, cdZ, frontHallX + 0.4, coDiemY, cz);
  // East-facing continuous 2048px mosaic Cổ Diêm frieze + projecting 3D crimson/gold cornice & vertical mullions!
  const cdFrontPlane = new THREE.PlaneGeometry(cdZ - 0.2, coDiemH - 0.04);
  cdFrontPlane.rotateY(Math.PI * 0.5);
  cdFrontPlane.translate(frontHallX + 0.4 + cdW * 0.5 + 0.03, coDiemY, cz);
  targetGroup.add(new THREE.Mesh(cdFrontPlane, hp.coDiemMosaicMat));
  addBox(crimsonParts, 0.16, 0.08, cdZ + 0.2, frontHallX + 0.4 + cdW * 0.5 + 0.04, coDiemY + coDiemH * 0.48, cz);
  addBox(crimsonParts, 0.16, 0.08, cdZ + 0.2, frontHallX + 0.4 + cdW * 0.5 + 0.04, coDiemY - coDiemH * 0.48, cz);
  for (let m = 0; m <= 8; m++) {
    const mz = cz - cdZ * 0.48 + (m / 8) * (cdZ * 0.96);
    addBox(crimsonParts, 0.12, coDiemH, 0.14, frontHallX + 0.4 + cdW * 0.5 + 0.04, coDiemY, mz);
  }
  for (const s of [-1, 1]) {
    const cdSide = new THREE.PlaneGeometry(cdW - 0.2, coDiemH - 0.04);
    if (s < 0) cdSide.rotateY(Math.PI);
    cdSide.translate(frontHallX + 0.4, coDiemY, cz + s * (cdZ * 0.5 + 0.03));
    targetGroup.add(new THREE.Mesh(cdSide, hp.coDiemMosaicMat));
  }

  // Upper Tier-2 Hoàng Lưu Ly Roofs (Steeper crisp Ref #6 silhouette, rearHigh cleanly aligned so zero duplicate stick clutter! EX-05)
  const frontHigh = createHueImperialHipRoofGeometry(
    cdW + 2.8,
    cdZ + 3.2,
    1.8,
    cdZ - 4.6,
    upperRoofH,
    0.26,
    roofSegS,
    roofSegR
  );
  frontHigh.translate(frontHallX + 0.4, upperBaseY, cz);
  yellowRoofParts.push(frontHigh);

  const rearHigh = createHueImperialHipRoofGeometry(
    rearRoofDepth * 0.68 + 2.8,
    cdZ + 3.4,
    1.8,
    cdZ - 4.4,
    upperRoofH + 0.06,
    0.26,
    roofSegS,
    roofSegR
  );
  rearHigh.translate(rearHallX - 0.3, upperBaseY + 0.04, cz);
  yellowRoofParts.push(rearHigh);

  addCuuLongCeramicRoofDragons(
    ceramicParts,
    goldParts,
    frontHallX + 0.4,
    upperBaseY + upperRoofH,
    cz,
    cdZ - 4.6,
    (cdW + 2.8) * 0.48,
    (cdZ + 3.2) * 0.48,
    upperRoofH - 0.26,
    opts.fullHeroInterior ? 0.94 : 0.78,
    0.26
  );
  addCuuLongCeramicRoofDragons(
    ceramicParts,
    goldParts,
    rearHallX - 0.3,
    upperBaseY + upperRoofH + 0.10,
    cz,
    cdZ - 4.4,
    (rearRoofDepth * 0.68 + 2.8) * 0.48,
    (cdZ + 3.4) * 0.48,
    upperRoofH - 0.20,
    opts.fullHeroInterior ? 0.88 : 0.74,
    0.26
  );

  // 9. BALANCED MUSEUM CHIAROSCURO LIGHTING + 18 PAIRED MOUNTED SPOTLIGHT FIXTURES & 12-RAY STARBURSTS!
  //    (IN-03, IN-04, CL-25, AS-13, AS-24, AS-25 — rich warm royal crimson-gold chiaroscuro glow!)
  const naveLight = new THREE.PointLight('#ffbd4c', opts.fullHeroInterior ? 16.0 : 13.5, 28, 1.55);
  naveLight.position.set(heroFrameX + 2.6, beamBaseY - 1.3, cz);
  const throneUpLight = new THREE.PointLight('#ffab32', opts.fullHeroInterior ? 14.0 : 12.0, 18, 1.6);
  throneUpLight.position.set(throneX - 1.2, floorY + 2.0, cz);
  const throneCanopyLight = new THREE.PointLight('#ffc858', opts.fullHeroInterior ? 13.0 : 11.0, 20, 1.55);
  throneCanopyLight.position.set(throneX + 1.8, buuTanY - 0.8, cz);
  targetGroup.add(naveLight, throneUpLight, throneCanopyLight);

  if (opts.fullHeroInterior) {
    // Rhythmic warm architectural lights marching down the longitudinal aisle right beneath the 4-tier Chồng Rường trusses (AS-25!)
    for (const az of [-11.5 * zScale, 11.5 * zScale]) {
      const aisleLight = new THREE.PointLight('#ffbc4a', 14.5, 26, 1.55);
      aisleLight.position.set(frontVaultX, beamBaseY - 0.8, cz + az);
      targetGroup.add(aisleLight);
    }
    // Cool crisp outdoor daylight bounce along the open left glazed Cửa Bức Bàn doorway thresholds (AS-13!)
    for (const dz of [-9.5 * zScale, 9.5 * zScale]) {
      const doorDayLight = new THREE.PointLight('#d4ebff', 4.2, 9.5, 1.8);
      doorDayLight.position.set(doorX - 0.4, floorY + 1.2, cz + dz);
      targetGroup.add(doorDayLight);
    }
  }

  // Paired Physical Dark-Bronze Track Spotlight Fixtures + Razor-Sharp 12-Ray Starburst Glints along EVERY Colonnade Bay! (IN-04, AS-24)
  const bulbCoords: Array<[number, number, number, number]> = [
    [heroFrameX + 0.44, plaqueY + 0.14, cz - 2.38 * zScale, 1.75],
    [heroFrameX + 0.44, plaqueY + 0.14, cz + 2.38 * zScale, 1.75],
    [throneX + 1.6, buuTanY - 0.18, cz - 1.55 * zScale, 1.05],
    [throneX + 1.6, buuTanY - 0.18, cz + 1.55 * zScale, 1.05]
  ];
  for (const zOff of trussZLines) {
    // Paired ceiling spotlights framing every longitudinal aisle truss bay (Photo 5!)
    bulbCoords.push([frontBayX - 0.35, beamBaseY - 0.24, cz + zOff, 1.15]);
    bulbCoords.push([heroFrameX + 0.35, beamBaseY - 0.24, cz + zOff, 1.20]);
  }
  for (const [sx, sy, sz, sc] of bulbCoords) {
    // Physical mounted dark-bronze spotlight barrel fixture
    addCyl(bronzeParts, 0.055, 0.055, 0.16, 7, sx, sy + 0.08, sz);
    const spr = new THREE.Sprite(hp.starburstFlareMat);
    spr.position.set(sx, sy, sz);
    spr.scale.set(sc, sc, 1);
    targetGroup.add(spr);
  }

  // Merge all sub-meshes cleanly with shadow-caster & material-budget discipline!
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

  // Fiery glossy tangerine-vermilion striped rafter material directly above `"殿和太"` (auto-consolidated into shared vertex-color bucket -> 0 unique mats! IN-10!)
  const rafterOrangeMat = new THREE.MeshStandardMaterial({
    color: '#e64c0c',
    roughness: 0.24,
    metalness: 0.08,
    fog: false
  });
  ctx.extraMaterials.push(rafterOrangeMat);
  // Clear lightly-tinted historic glass panes for the open glazed `Cửa Bức Bàn` doors (AS-12 — lets real sky/courtyard shine through!)
  const doorGlassMat =
    ctx.materialLib?.getOrCreateStandard({
      color: '#a8cce6',
      roughness: 0.08,
      metalness: 0.08,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      fog: false
    }) ?? ctx.materials.whitePlaster;

  addMerged(thanhStoneParts, hp.thanhStoneMat, true, true, 3.0);
  addMerged(plasterParts, ctx.materials.agedPlaster ?? ctx.materials.whitePlaster, true, true, 3.2);
  addMerged(crimsonParts, hp.imperialCrimsonWoodMat, true, true, 1.8);
  addMerged(brightRedParts, hp.brightBarrierRedMat, false, true);
  addMerged(goldParts, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(rafterOrangeParts, rafterOrangeMat, false, false);
  addMerged(doorGlassParts, doorGlassMat, false, false);
  addMerged(keGocParts, hp.keGocFiligreeMat, false, false);
  addMerged(ceramicParts, hp.ceramicMosaicMat, false, true, 1.6);
  addMerged(bronzeParts, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(ironwoodParts, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addMerged(darkWoodParts, ctx.materials.darkWood, false, true);
  addMerged(porcelainParts, hp.porcelainCobaltMat, false, true);
  addMerged(terracottaParts, hp.terracottaBalustradeMat, false, true);
  addMerged(yellowRoofParts, hp.hoangLuuLyMat, true, true);

  if (foliageParts.length > 0) {
    const folMat =
      ctx.materialLib?.getOrCreateStandard({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.02
      }) ??
      new THREE.MeshStandardMaterial({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        vertexColors: true,
        roughness: 0.72
      });
    addMerged(foliageParts, folMat, false, true);
  }

  // ==========================================================================
  // WAVE 2 UPGRADES (Items 249–255): Điện Thái Hòa Interior Quạt Vả Fans,
  // Nhã Nhạc Drum/Bell Rack, Cửa Võng Valance, Throne Kỷ, Bronze Rainwater
  // Cauldrons, Courtyard Bình Phong Screens & Eave Wind-Bells
  // ==========================================================================
  const w2HallStone: THREE.BufferGeometry[] = [];
  const w2HallCrimson: THREE.BufferGeometry[] = [];
  const w2HallGold: THREE.BufferGeometry[] = [];
  const w2HallBronze: THREE.BufferGeometry[] = [];
  const w2HallWood: THREE.BufferGeometry[] = [];

  // 249: Interior gilded Quạt Vả (tall ceremonial feather-fan standards) flanking Dragon Throne
  for (const s of [-1, 1]) {
    addCyl(w2HallGold, 0.04, 0.05, 2.85, 5, throneX + 0.85, floorY + 1.45, cz + s * 2.35);
    addBox(w2HallGold, 0.08, 0.92, 0.68, throneX + 0.85, floorY + 3.05, cz + s * 2.35);
    // 252: Stepped lacquered Kỷ footstool & side tea-tables flanking Dragon Throne platform
    addBox(w2HallCrimson, 0.65, 0.58, 0.55, throneX + 1.55, floorY + 0.30, cz + s * 1.95);
    addBox(w2HallGold, 0.68, 0.06, 0.58, throneX + 1.55, floorY + 0.62, cz + s * 1.95);
  }
  addBox(w2HallCrimson, 0.72, 0.24, 1.35, throneX + 1.85, floorY + 0.14, cz);

  // 250: Nhã Nhạc court-orchestra drum stand (Trống Chiến) & bronze bell rack (Biên Chung) on front veranda wing
  addBox(w2HallWood, 0.85, 0.95, 0.14, verandaX - 0.55, floorY + 0.55, cz - halfZ * 0.45);
  addCyl(w2HallCrimson, 0.34, 0.34, 0.52, 6, verandaX - 0.55, floorY + 0.82, cz - halfZ * 0.45, 0, Math.PI * 0.5);
  addBox(w2HallCrimson, 0.14, 1.45, 1.35, verandaX - 0.55, floorY + 0.75, cz + halfZ * 0.45);
  for (const bz of [-0.36, 0, 0.36]) {
    addCyl(w2HallBronze, 0.08, 0.12, 0.28, 5, verandaX - 0.55, floorY + 1.02, cz + halfZ * 0.45 + bz);
  }

  // 251: Carved wooden Cửa Võng hanging gilded valance fretwork inside front central bay
  addBox(w2HallGold, 0.16, 0.62, 4.6, doorX - 0.55, floorY + colH * 0.68, cz);
  for (const s of [-1, 1]) {
    addBox(w2HallGold, 0.16, 1.45, 0.42, doorX - 0.55, floorY + colH * 0.52, cz + s * 2.15);
  }

  // 253–255: Exterior bronze Chậu Đồng rainwater cauldrons at 4 plinth corners, side Bình Phong wind-screens & corner eave wind-bells
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cxP = hx + sx * (halfX + 1.15);
      const czP = cz + sz * (halfZ + 1.15);
      addCyl(w2HallStone, 0.46, 0.52, 0.22, 6, cxP, floorY + 0.11, czP);
      addCyl(w2HallBronze, 0.42, 0.32, 0.58, 6, cxP, floorY + 0.50, czP);
      // 255: Gilded roof-corner eave wind-bells attached cleanly under lower eave corners
      const bellX = (sx > 0 ? frontHallX + 0.6 + (frontRoofDepth + 4.4) * 0.48 : rearHallX - 0.4 - (rearRoofDepth + 4.0) * 0.48);
      const bellZ = cz + sz * (widthZ + 3.6) * 0.48;
      addCyl(w2HallGold, 0.015, 0.015, 0.26, 4, bellX, lowerEaveY + 0.08, bellZ);
      addCyl(w2HallGold, 0.04, 0.11, 0.26, 5, bellX, lowerEaveY - 0.14, bellZ);
    }
  }
  for (const sz of [-1, 1]) {
    addBox(w2HallWood, 0.22, 1.85, 2.45, hx, floorY + 0.95, cz + sz * (halfZ - 0.45));
    addBox(w2HallGold, 0.26, 1.55, 2.15, hx, floorY + 0.95, cz + sz * (halfZ - 0.45));
  }

  addMerged(w2HallStone, hp.thanhStoneMat, false, true, 2.4);
  addMerged(w2HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w2HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w2HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w2HallWood, ctx.materials.darkWood, false, true);

  // ==========================================================================
  // WAVE 3 UPGRADES (Items 493–498, 500, 510, 516–517): Điện Thái Hòa Glazed
  // Dragon Balustrades, 3-Fold Imperial Screens, Veranda Tie-Beams, Floor
  // Candelabra, Vạc Đồng Cauldrons, Drainage Gutters & Ceremonial Gong
  // ==========================================================================
  const w3HallStone: THREE.BufferGeometry[] = [];
  const w3HallCrimson: THREE.BufferGeometry[] = [];
  const w3HallGold: THREE.BufferGeometry[] = [];
  const w3HallBronze: THREE.BufferGeometry[] = [];
  const w3HallPorcelain: THREE.BufferGeometry[] = [];

  // 493–494: Glazed dragon balustrades flanking central Ngũ Bậc staircase & corner dragon-head terminals
  for (const s of [-1, 1]) {
    addBox(w3HallStone, 2.6, 0.72, 0.36, verandaX + 2.4, floorY + 0.36, cz + s * 2.55);
    addBox(w3HallPorcelain, 2.68, 0.24, 0.40, verandaX + 2.4, floorY + 0.80, cz + s * 2.55);
    addBox(w3HallPorcelain, 0.42, 0.46, 0.42, verandaX + 3.65, floorY + 1.05, cz + s * 2.55);
    // 495: Interior 3-fold gilded Bình Phong imperial dragon screen panels flanking rear throne hall
    addBox(w3HallCrimson, 0.18, 2.35, 1.65, throneX - 1.45, floorY + 1.18, cz + s * 3.15);
    addBox(w3HallGold, 0.22, 2.05, 1.38, throneX - 1.45, floorY + 1.18, cz + s * 3.15);
    // 496: Interior crimson-and-gold Kèo Cột cross-beam brackets under front veranda eaves
    addBox(w3HallCrimson, 1.65, 0.24, 0.22, verandaX - 0.85, floorY + colH * 0.78, cz + s * 4.2);
    addBox(w3HallGold, 1.70, 0.10, 0.24, verandaX - 0.85, floorY + colH * 0.78 - 0.14, cz + s * 4.2);
    // 497–498: Lacquered side Hương Án offering tables & standing bronze floor candelabra flanking Dragon Throne
    addBox(w3HallCrimson, 0.85, 0.78, 1.15, throneX + 0.25, floorY + 0.40, cz + s * 3.85);
    addCyl(w3HallBronze, 0.08, 0.18, 1.65, 5, throneX + 1.25, floorY + 0.82, cz + s * 3.15);
    addCyl(w3HallGold, 0.16, 0.10, 0.24, 5, throneX + 1.25, floorY + 1.72, cz + s * 3.15);
    // 500: Flanking Vạc Đồng giant bronze imperial cauldrons on stepped stone rings along north/south terrace
    addCyl(w3HallStone, 0.62, 0.68, 0.24, 6, hx + 0.5, floorY + 0.12, cz + s * (halfZ + 1.85));
    addCyl(w3HallBronze, 0.58, 0.46, 0.72, 6, hx + 0.5, floorY + 0.58, cz + s * (halfZ + 1.85));
    // 510: Outer plinth stone drainage gutter channels along north/south flanks
    addBox(w3HallStone, halfX * 1.9, 0.16, 0.42, hx, floorY - 0.06, cz + s * (halfZ + 2.45));
    // 516: Gilded Thọ medallion ridge-end plaques on upper Trùng Thiềm gable
    addCyl(w3HallGold, 0.36, 0.36, 0.14, 6, hx, lowerEaveY + 2.65, cz + s * (widthZ * 0.48), Math.PI * 0.5);
  }
  // 517: Bronze ceremonial gong (Chiêng Đồng) on crimson frame beside Biên Chung bell rack
  addBox(w3HallCrimson, 0.14, 1.38, 1.15, verandaX - 0.55, floorY + 0.70, cz + halfZ * 0.45 + 1.65);
  addCyl(w3HallBronze, 0.32, 0.32, 0.08, 6, verandaX - 0.55, floorY + 0.88, cz + halfZ * 0.45 + 1.65, 0, Math.PI * 0.5);

  addMerged(w3HallStone, hp.thanhStoneMat, false, true, 2.4);
  addMerged(w3HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w3HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w3HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w3HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 4 Upgrades (Items 898–901): Điện Thái Hòa side-gallery steps, Bát Bửu racks, Hạc Chầu Rùa & Sập Gụ divans
  const w4HallStone: THREE.BufferGeometry[] = [];
  const w4HallCrimson: THREE.BufferGeometry[] = [];
  const w4HallGold: THREE.BufferGeometry[] = [];
  const w4HallBronze: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // 898: North/South exterior side-gallery stone steps descending to lawn
    addBox(w4HallStone, 2.6, plinthH * 0.65, 1.65, hx, y + plinthH * 0.325, cz + s * (halfZ + 2.45));
    // 899: Interior gilded Bát Bửu processional umbrella racks in north/south nave bays
    addBox(w4HallCrimson, 0.32, 0.24, 1.45, heroFrameX - 1.2, floorY + 0.14, cz + s * (10.5 * zScale));
    addCyl(w4HallGold, 0.03, 0.04, 2.55, 5, heroFrameX - 1.2, floorY + 1.42, cz + s * (10.5 * zScale));
    // 900: Antique bronze Hạc Chầu Rùa (crane on tortoise) flanking front veranda threshold
    addCyl(w4HallBronze, 0.22, 0.26, 0.22, 6, verandaX - 0.35, floorY + 0.11, cz + s * 2.85);
    addCyl(w4HallBronze, 0.06, 0.08, 1.45, 5, verandaX - 0.35, floorY + 0.92, cz + s * 2.85);
    // 901: Interior crimson-and-gold Sập Gụ royal side divans in outer east bays
    addBox(w4HallCrimson, 1.55, 0.52, 2.35, frontBayX - 1.4, floorY + 0.28, cz + s * (14.2 * zScale));
    addBox(w4HallGold, 1.60, 0.08, 2.40, frontBayX - 1.4, floorY + 0.56, cz + s * (14.2 * zScale));
  }
  addMerged(w4HallStone, hp.thanhStoneMat, false, true, 2.4);
  addMerged(w4HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w4HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w4HallBronze, hp.antiqueBronzeCauldronMat, false, true);

  // Wave 5 Upgrades (Items 1293–1296): Điện Thái Hòa porcelain balustrade inlays, interior Lọng Vàng canopies,
  // central bronze tripod before Golden Throne & rear veranda Thanh stone rain-basins
  const w5HallStone: THREE.BufferGeometry[] = [];
  const w5HallGold: THREE.BufferGeometry[] = [];
  const w5HallBronze: THREE.BufferGeometry[] = [];
  const w5HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // 1293: Glazed cobalt-porcelain balustrade medallion inlays
    addBox(w5HallPorcelain, 0.22, 0.42, 0.85, verandaX + 1.15, floorY + 0.55, cz + s * 6.8);
    // 1294: Interior gilded Lọng Vàng royal throne-flanking canopies
    addCyl(w5HallGold, 0.04, 0.05, 3.15, 5, throneX + 1.4, floorY + 1.60, cz + s * 2.4);
    w5HallGold.push(new THREE.ConeGeometry(0.68, 0.48, 6).translate(throneX + 1.4, floorY + 3.32, cz + s * 2.4));
    // 1296: Rear veranda carved Thanh stone rain-basins
    addCyl(w5HallStone, 0.48, 0.36, 0.55, 6, rearX - 0.85, floorY + 0.28, cz + s * 5.2);
  }
  // 1295: Interior bronze incense tripod centered before Golden Throne steps
  addCyl(w5HallBronze, 0.34, 0.26, 0.72, 6, throneX + 3.2, floorY + 0.38, cz);
  addMerged(w5HallStone, hp.thanhStoneMat, false, true, 2.4);
  addMerged(w5HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w5HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w5HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 6 Upgrades (Items 1713–1717): Điện Thái Hòa exterior mounting blocks, gilded banner stanchions,
  // interior lacquer offering table, throne-flanking incense stands & rear porcelain rainwater urns
  const w6HallStone: THREE.BufferGeometry[] = [];
  const w6HallCrimson: THREE.BufferGeometry[] = [];
  const w6HallGold: THREE.BufferGeometry[] = [];
  const w6HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addBox(w6HallStone, 1.05, 0.48, 0.65, verandaX + 1.85, floorY + 0.24, cz + s * 4.8);
    addCyl(w6HallGold, 0.045, 0.055, 3.2, 4, verandaX + 1.15, floorY + 1.60, cz + s * 9.2);
    w6HallGold.push(new THREE.ConeGeometry(0.18, 0.45, 4).translate(verandaX + 1.15, floorY + 3.42, cz + s * 9.2));
    addCyl(w6HallGold, 0.20, 0.24, 0.85, 5, throneX + 2.2, floorY + 0.45, cz + s * 1.8);
    addCyl(w6HallPorcelain, 0.42, 0.32, 0.58, 5, rearX - 0.85, floorY + 0.30, cz + s * 7.8);
  }
  addBox(w6HallCrimson, 1.15, 0.82, 2.2, throneX + 2.2, floorY + 0.42, cz);
  addMerged(w6HallStone, hp.thanhStoneMat, false, true, 2.4);
  addMerged(w6HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w6HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w6HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 7 Upgrades (Items 2113–2117): Điện Thái Hòa exterior bronze dragon urns, gilded court drum stand,
  // interior ceremonial screen frame, rear lotus rainwater urns & crimson altar runner plinth
  const w7HallCrimson: THREE.BufferGeometry[] = [];
  const w7HallGold: THREE.BufferGeometry[] = [];
  const w7HallBronze: THREE.BufferGeometry[] = [];
  const w7HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w7HallBronze, 0.34, 0.26, 0.72, 5, verandaX + 1.85, floorY + 0.36, cz + s * 7.2);
    addCyl(w7HallPorcelain, 0.40, 0.30, 0.56, 5, rearX - 0.85, floorY + 0.28, cz + s * 5.2);
  }
  addCyl(w7HallGold, 0.42, 0.42, 0.65, 5, verandaX + 1.2, floorY + 1.05, cz - 7.8, 0, Math.PI * 0.5);
  addBox(w7HallGold, 0.16, 2.2, 3.2, throneX - 1.8, floorY + 1.15, cz);
  addBox(w7HallCrimson, 1.45, 0.18, 2.8, throneX + 3.6, floorY + 0.09, cz);
  addMerged(w7HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w7HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w7HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w7HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 8 Upgrades (Items 2513–2517): Điện Thái Hòa crane-on-tortoise incense stands,
  // court-ritual bronze bell stand, dragon-screen side panels, rear lotus urns & throne-step runner
  const w8HallCrimson: THREE.BufferGeometry[] = [];
  const w8HallGold: THREE.BufferGeometry[] = [];
  const w8HallBronze: THREE.BufferGeometry[] = [];
  const w8HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w8HallBronze, 0.24, 0.34, 1.15, 5, verandaX + 1.85, floorY + 0.58, cz + s * 5.2);
    addBox(w8HallGold, 0.14, 1.85, 1.15, throneX - 1.8, floorY + 0.98, cz + s * 2.4);
    addCyl(w8HallPorcelain, 0.38, 0.28, 0.56, 5, rearX - 0.85, floorY + 0.28, cz + s * 3.2);
  }
  addCyl(w8HallGold, 0.36, 0.44, 0.72, 5, verandaX + 1.2, floorY + 1.05, cz + 7.8);
  addBox(w8HallCrimson, 1.25, 0.16, 2.4, throneX + 2.4, floorY + 0.08, cz);
  addMerged(w8HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w8HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w8HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w8HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 9 Upgrades (Items 2913–2917): Điện Thái Hòa phoenix-crest candelabra stands,
  // court-ritual jade-chime stand, cloud-scroll side screens, rear flower vases & royal-dais border trim
  const w9HallCrimson: THREE.BufferGeometry[] = [];
  const w9HallGold: THREE.BufferGeometry[] = [];
  const w9HallBronze: THREE.BufferGeometry[] = [];
  const w9HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w9HallBronze, 0.24, 0.34, 1.15, 5, verandaX + 1.85, floorY + 0.58, cz + s * 6.8);
    addBox(w9HallGold, 0.14, 1.85, 1.15, throneX - 1.8, floorY + 0.98, cz + s * 3.8);
    addCyl(w9HallPorcelain, 0.38, 0.28, 0.56, 5, rearX - 0.85, floorY + 0.28, cz + s * 4.6);
  }
  addCyl(w9HallGold, 0.36, 0.44, 0.72, 5, verandaX + 1.2, floorY + 1.05, cz - 7.8);
  addBox(w9HallCrimson, 1.25, 0.16, 2.4, throneX + 3.8, floorY + 0.08, cz);
  addMerged(w9HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w9HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w9HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w9HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 10 Upgrades (Items 3313–3317): Điện Thái Hòa bronze Hạc Chầu crane-on-tortoise stands,
  // imperial silk banner frames, rear celadon jardinières, court-ritual bell stand & brocade dais runner
  const w10HallCrimson: THREE.BufferGeometry[] = [];
  const w10HallGold: THREE.BufferGeometry[] = [];
  const w10HallBronze: THREE.BufferGeometry[] = [];
  const w10HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w10HallBronze, 0.24, 0.34, 1.25, 5, verandaX + 1.85, floorY + 0.62, cz + s * 8.2);
    addBox(w10HallGold, 0.14, 1.85, 1.15, throneX - 1.8, floorY + 0.98, cz + s * 5.2);
    addCyl(w10HallPorcelain, 0.38, 0.28, 0.56, 5, rearX - 0.85, floorY + 0.28, cz + s * 6.2);
  }
  addCyl(w10HallGold, 0.36, 0.44, 0.72, 5, verandaX + 1.2, floorY + 1.05, cz + 7.8);
  addBox(w10HallCrimson, 1.25, 0.16, 2.4, throneX + 5.2, floorY + 0.08, cz);
  addMerged(w10HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w10HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w10HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w10HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 11 Upgrades (Items 3713–3717): Điện Thái Hòa bronze Lư Hương tripod braziers,
  // gilded Bát Bửu halberd racks, rear cobalt dragon vases, jade-chime Biên Khánh stand & royal ceremony mat
  const w11HallCrimson: THREE.BufferGeometry[] = [];
  const w11HallGold: THREE.BufferGeometry[] = [];
  const w11HallBronze: THREE.BufferGeometry[] = [];
  const w11HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w11HallBronze, 0.28, 0.34, 0.92, 5, verandaX + 2.45, floorY + 0.46, cz + s * 6.4);
    addBox(w11HallGold, 0.14, 2.05, 0.95, throneX - 2.4, floorY + 1.05, cz + s * 6.8);
    addCyl(w11HallPorcelain, 0.34, 0.26, 0.68, 5, rearX - 1.35, floorY + 0.34, cz + s * 4.8);
  }
  addBox(w11HallGold, 0.24, 1.45, 0.95, verandaX + 1.2, floorY + 0.78, cz - 7.8);
  addBox(w11HallCrimson, 1.35, 0.14, 2.6, throneX + 6.8, floorY + 0.07, cz);
  addMerged(w11HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w11HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w11HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w11HallPorcelain, hp.porcelainCobaltMat, false, true);

  // Wave 12 Upgrades (Items 4113–4117): Điện Thái Hòa bronze Đỉnh Trầm incense stands,
  // gilded Lọng Vàng canopies, rear cobalt cloud vases, Nhã Nhạc Biên Chung bell-chime rack & silk dais runner
  const w12HallCrimson: THREE.BufferGeometry[] = [];
  const w12HallGold: THREE.BufferGeometry[] = [];
  const w12HallBronze: THREE.BufferGeometry[] = [];
  const w12HallPorcelain: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w12HallBronze, 0.28, 0.34, 0.92, 5, verandaX + 2.45, floorY + 0.46, cz + s * 8.2);
    addCyl(w12HallCrimson, 0.05, 0.06, 2.85, 4, throneX - 3.6, floorY + 1.42, cz + s * 5.2);
    w12HallGold.push(new THREE.ConeGeometry(0.68, 0.48, 5).translate(throneX - 3.6, floorY + 2.95, cz + s * 5.2));
    addCyl(w12HallPorcelain, 0.34, 0.26, 0.68, 5, rearX - 1.35, floorY + 0.34, cz + s * 6.6);
  }
  addBox(w12HallGold, 0.24, 1.45, 0.95, verandaX + 1.2, floorY + 0.78, cz + 7.8);
  addBox(w12HallCrimson, 1.35, 0.14, 2.6, throneX + 8.6, floorY + 0.07, cz);
  addMerged(w12HallCrimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w12HallGold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w12HallBronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w12HallPorcelain, hp.porcelainCobaltMat, false, true);

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

function mVaultHalfOr(v: number): number {
  return v;
}

/**
 * Builds a lush billowing asymmetric ancient tropical royal palace tree (flared buttress root, curved trunk,
 * 3–4 spreading boughs & 18 sunlit-to-shadowed volumetric foliage lobes — EX-23!)
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
  const ang = seed * 1.37;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // Flared buttressed curved main trunk + 3 diverging boughs
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(x + ca * 0.25 * s, y + 2.4 * s, z + sa * 0.25 * s),
    new THREE.Vector3(x - ca * 0.15 * s, y + 5.0 * s, z + sa * 0.45 * s)
  ]);
  trunkParts.push(createSmoothTaperedTubeGeometry(trunkCurve, 8, 6, (t) => (0.52 - t * 0.28) * s));

  const boughs: Array<[number, number, number]> = [
    [2.6, 5.4, 1.4],
    [-2.4, 5.8, -1.5],
    [0.8, 7.2, -1.8]
  ];
  for (const [bx, by, bz] of boughs) {
    const rx = bx * ca - bz * sa;
    const rz = bx * sa + bz * ca;
    const bc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y + 3.6 * s, z),
      new THREE.Vector3(x + rx * 0.6 * s, y + by * 0.85 * s, z + rz * 0.6 * s),
      new THREE.Vector3(x + rx * s, y + by * s, z + rz * s)
    ]);
    trunkParts.push(createSmoothTaperedTubeGeometry(bc, 5, 5, (t) => (0.22 - t * 0.12) * s));
  }

  // 12 volumetric billowing canopy lobes with directional sunlit lime-green crowns -> velvety dark forest undersides
  const puffs: Array<[number, number, number, number, string]> = [
    [0, 6.2, 0, 5.4, '#1b4714'],
    [2.4, 5.6, 1.5, 4.4, '#153a10'],
    [-2.4, 5.9, -1.3, 4.6, '#265f1b'],
    [1.6, 7.6, -1.2, 4.0, '#367c22'],
    [-1.8, 7.4, 1.6, 4.2, '#2d6c1e'],
    [0.3, 8.8, 0.2, 3.8, '#4a9028'],
    [-2.8, 7.0, 0.8, 3.6, '#488d26'],
    [2.6, 6.8, -1.6, 3.6, '#1f5217'],
    [0.6, 5.2, 2.2, 3.5, '#12330d'],
    [-0.8, 9.6, -0.4, 3.0, '#5aa230']
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [ox, oy, oz, rad, col] = puffs[i];
    const rx = ox * ca - oz * sa;
    const rz = ox * sa + oz * ca;
    for (let c = 0; c < 3; c++) {
      const card = new THREE.PlaneGeometry(rad * s, rad * s * 0.84);
      card.rotateX(c === 0 ? 0.42 : c === 1 ? -0.42 : 0.06);
      card.rotateY((c / 3) * Math.PI + seed * 0.9 + i * 0.55);
      card.translate(x + rx * s, y + oy * s, z + rz * s);
      canopyParts.push(colorizeGeometry(card, col));
    }
  }
}

/**
 * Builds the COMPLETE **Hoàng Cung Huế (Đại Nội Huế)** Macro Compound (`HueGrandImperialPalace` at `-660, 80`)
 * matching ALL 7 uploaded real-life reference photos at museum detail density!
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

  const sanHaY = y + 0.35;
  const sanThuongY = y + 1.35;
  // 1. HERO ĐIỆN THÁI HÒA (`colH: 5.80m` for monumental Ref #5 vertical aisle proportions — AS-17!)
  buildDienThaiHoaHeroHall(ctx, group, {
    hallCenterX: cx - 22,
    baseY: sanThuongY,
    centerZ: cz,
    widthZ: 44.0,
    depthX: 30.0,
    plinthH: 0.95,
    colH: 5.80,
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
  const ochreBalParts: THREE.BufferGeometry[] = [];

  // 2. 2-TIER SÂN ĐẠI TRIỀU NGHI (Photo 6 Exact Foreground Architecture! — EX-11..EX-23, EX-30)
  addBox(thanhStoneParts, 55.0, 1.35, 56.0, cx - 11.5, y + 0.675, cz);
  // Sculpted Sân Thượng retaining wall with recessed dark stone dado, bottom plinth & thick overhanging coping (EX-12!)
  addBox(thanhStoneParts, 0.56, 0.18, 56.4, cx + 16.08, sanThuongY - 0.05, cz);
  addBox(thanhStoneParts, 0.36, 0.18, 56.2, cx + 16.05, sanHaY + 0.09, cz);
  // Ceremonial axial processional stone runner (`Đường Thần Đạo`) across Sân Thượng (EX-13!)
  addBox(thanhStoneParts, 22.8, 0.04, 5.8, cx + 4.4, sanThuongY + 0.015, cz);
  for (const s of [-1, 1]) {
    addBox(thanhStoneParts, 22.8, 0.07, 0.34, cx + 4.4, sanThuongY + 0.025, cz + s * 3.05);
  }
  // Lower Terrace (`Sân Hạ`)
  addBox(thanhStoneParts, 22.0, 0.35, 56.0, cx + 27.0, y + 0.175, cz);

  // Wide 7-Step Central Ceremonial Thanh Stone Staircase with Projecting Nosing Overhangs & Shadow Risers (EX-12!)
  const stairW = 6.8;
  const numSteps = 7;
  const stepRun = 0.46;
  const stairXTop = cx + 16.0;
  for (let st = 0; st < numSteps; st++) {
    const sh = (sanThuongY - sanHaY) * ((st + 1) / numSteps);
    const sx = stairXTop + (numSteps - 1 - st) * stepRun + stepRun * 0.5;
    addBox(thanhStoneParts, stepRun + 0.02, sh - 0.04, stairW, sx, sanHaY + (sh - 0.04) * 0.5, cz);
    // Projecting 0.04m chiseled stone step nosing casting crisp horizontal shadow groove
    addBox(thanhStoneParts, stepRun + 0.08, 0.06, stairW + 0.04, sx + 0.02, sanHaY + sh - 0.02, cz);
  }
  const stairXBot = stairXTop + numSteps * stepRun;
  // Subtle dark contact moisture crease at bottom step meeting Sân Hạ (EX-30)
  addBox(woodParts, 0.24, 0.015, stairW + 1.2, stairXBot + 0.14, sanHaY + 0.01, cz);

  // Massive Monolithic Carved Nguyễn-Dynasty Stone Dragon Balustrades (ZERO duplicate snowman spheres! EX-14!)
  for (const s of [-1, 1]) {
    const rz = cz + s * (stairW * 0.5 + 0.36);
    thanhStoneParts.push(
      ...createHueNguyenDragonBalustradeParts(stairXBot + 0.38, sanHaY, rz, stairXTop - 0.2, sanThuongY, rz, 0.96)
    );
    // 2 Tall Lathe-Turned Antique Terracotta Pedestals + Cobalt Porcelain Bowls + Gnarled Cloud-Pad Bonsai (EX-16..EX-18!)
    addTerracottaPorcelainBonsai(
      terracottaParts,
      porcelainParts,
      thanhStoneParts,
      woodParts,
      foliageParts,
      stairXTop - 0.55,
      sanThuongY,
      cz + s * (stairW * 0.5 + 1.15),
      1.05,
      true
    );
  }

  // Iconic Bottom-Right Golden-Ochre Heritage Notice Signboard (`SÂN KHẤU / SÂN ĐIỆN THÁI HÒA` — Photo 6 bottom-right! EX-19!)
  const signX = stairXBot + 0.45;
  const signZ = cz - (stairW * 0.5 + 1.55);
  addBox(thanhStoneParts, 0.38, 0.24, 0.88, signX, sanHaY + 0.12, signZ);
  addBox(woodParts, 0.12, 1.14, 0.84, signX, sanHaY + 0.80, signZ);
  const signPlaque = createSignagePlaqueMesh(
    {
      text: 'SÂN ĐIỆN THÁI HÒA',
      subText: '09:00 - 09:30 | NHÃ NHẠC CUNG ĐÌNH',
      width: 0.74,
      height: 1.02,
      depth: 0.06,
      style: 'royal',
      motifSeed: 1805
    },
    ctx
  );
  signPlaque.rotation.y = Math.PI * 0.5;
  signPlaque.position.set(signX + 0.06, sanHaY + 0.80, signZ);
  group.add(signPlaque);

  // 18 Detailed Carved `Phẩm Sơn` Mandarin Rank Steles (`Cửu Phẩm Văn Võ` — stepped plinth + chamfered tablet + arched lotus crown — EX-20!)
  for (const side of [-1, 1]) {
    for (let rank = 0; rank < 9; rank++) {
      const rx = cx + 6.5 + (rank % 3) * 2.4;
      const rz = cz + side * (11.6 + Math.floor(rank / 3) * 3.8);
      addBox(thanhStoneParts, 0.68, 0.16, 0.68, rx, sanThuongY + 0.08, rz);
      addBox(thanhStoneParts, 0.52, 0.12, 0.52, rx, sanThuongY + 0.22, rz);
      addBox(thanhStoneParts, 0.20, 0.78, 0.38, rx, sanThuongY + 0.66, rz);
      addCyl(thanhStoneParts, 0.19, 0.19, 0.20, 10, rx, sanThuongY + 1.05, rz, 0, Math.PI * 0.5);
    }
  }

  // Warm Golden-Ochre Ceramic `Hoa Chanh` Wing Balustrades (visible flanking Điện Thái Hòa in Photo 6! EX-21!)
  // + Sculpted Stone Ceremonial Lantern Pillars (`Trụ Biểu`, EX-22!) + Perimeter Balustrades
  for (const side of [-1, 1]) {
    // Transverse wing balustrade connecting Điện Thái Hòa's outer white end-walls outward across Sân Thượng!
    const wingZStart = cz + side * 22.8;
    const wingZEnd = cz + side * 34.0;
    ochreBalParts.push(
      ...createPiercedBalustradeParts(cx - 6.0, wingZStart, cx - 6.0, wingZEnd, sanThuongY, 0.94, 'hoa_chanh_ceramic')
    );
    const bz = cz + side * 27.6;
    ochreBalParts.push(
      ...createPiercedBalustradeParts(cx - 34.0, bz, cx + 16.0, bz, sanThuongY, 0.92, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(cx + 16.0, bz, cx + 37.6, bz, sanHaY, 0.92, 'hoa_chanh_ceramic')
    );
    bronzeParts.push(...createGuardianBeastParts(cx + 12.5, sanThuongY, cz + side * 22.8, Math.PI * 0.5, 1.25, 'kylan'));
    // Sculpted weathered Thanh stone ceremonial lantern pillar (`Trụ Biểu / Cột Đèn Đá`, Photo 6 left flank! EX-22!)
    const px = cx + 2.5;
    const pz = cz + side * 21.8;
    addBox(thanhStoneParts, 0.68, 0.32, 0.68, px, sanThuongY + 0.16, pz);
    addCyl(thanhStoneParts, 0.14, 0.20, 4.45, 10, px, sanThuongY + 2.54, pz);
    addCyl(thanhStoneParts, 0.28, 0.16, 0.22, 10, px, sanThuongY + 4.86, pz);
    addBox(thanhStoneParts, 0.40, 0.44, 0.40, px, sanThuongY + 5.18, pz);
    const lCap = new THREE.ConeGeometry(0.38, 0.34, 4);
    lCap.rotateY(Math.PI * 0.25);
    lCap.translate(px, sanThuongY + 5.56, pz);
    thanhStoneParts.push(lCap);
  }

  // Towering Asymmetric Sunlit Ancient Tropical Hero Tree (left flank) & Dense Dark-Emerald Woodland Bank (Photo 6 — EX-23!)
  const framingTrees: Array<[number, number, number, number]> = [
    [cx - 4, cz + 33, 2.15, 14], // Towering Ref #6 upper-left hero tree!
    [cx - 18, cz + 38, 1.95, 15],
    [cx - 36, cz + 34, 1.75, 16],
    [cx + 10, cz + 36, 1.55, 18],
    [cx - 6, cz - 34, 1.70, 11], // Right woodland bank
    [cx - 24, cz - 38, 1.85, 12],
    [cx - 34, cz - 42, 1.45, 13],
    [cx + 8, cz - 35, 1.45, 17]
  ];
  for (const [tx, tz, sc, sd] of framingTrees) {
    addRoyalGardenTree(woodParts, foliageParts, tx, y, tz, sc, sd);
  }

  // 3. COMPLETE HOÀNG CUNG HUẾ AXIAL WALLED COMPOUND MASTER PLAN (Photo 7 — EX-26..EX-29!)
  const compX = cx - 22;
  const compHalfX = 76;
  const compHalfZ = 76;

  // Multi-tone botanical palace lawns + outer serene greenbelt margin surrounding the Imperial Moat (EX-25, EX-29!)
  const outerBelt = new THREE.PlaneGeometry(compHalfX * 2 + 88, compHalfZ * 2 + 88);
  outerBelt.rotateX(-Math.PI * 0.5);
  outerBelt.translate(compX, y + 0.02, cz);
  lawnParts.push(colorizeGeometry(outerBelt, '#3a6a2a'));
  const lawnGeo = new THREE.PlaneGeometry(compHalfX * 2 + 10, compHalfZ * 2 + 10);
  lawnGeo.rotateX(-Math.PI * 0.5);
  lawnGeo.translate(compX, y + 0.08, cz);
  lawnParts.push(colorizeGeometry(lawnGeo, '#498236'));

  // Weathered Pale-Limestone Axial & Ring Walkways (`Đường số 1..10`) bordered by stone curbs (EX-29 — ZERO chalk-white tape!)
  const walkY = y + 0.14;
  addBox(walkwayParts, 4.6, 0.08, compHalfZ * 1.92, cx + 38.0, walkY, cz);
  addBox(walkwayParts, 4.4, 0.08, compHalfZ * 1.92, cx - 42.0, walkY, cz);
  addBox(walkwayParts, 4.2, 0.08, compHalfZ * 1.45, cx - 80.0, walkY, cz);
  for (const rz of [-compHalfZ + 8, -32, 32, compHalfZ - 8]) {
    addBox(walkwayParts, compHalfX * 1.92, 0.08, 4.0, compX, walkY, cz + rz);
  }

  // Outer Imperial Moat + Projecting Gate Bastion Salients (`Pháo Đài` — EX-28!) + Hồ Thái Dịch + Hậu Hồ with Island!
  const moatW = 9.0;
  const moatGeos: THREE.BufferGeometry[] = [
    new THREE.PlaneGeometry(moatW, compHalfZ * 2 + moatW * 2 + 8).rotateX(-Math.PI * 0.5).translate(compX + compHalfX + 6.2, y + 0.14, cz),
    new THREE.PlaneGeometry(moatW, compHalfZ * 2 + moatW * 2 + 8).rotateX(-Math.PI * 0.5).translate(compX - compHalfX - 6.2, y + 0.14, cz),
    new THREE.PlaneGeometry(compHalfX * 2 + 14, moatW).rotateX(-Math.PI * 0.5).translate(compX, y + 0.14, cz - compHalfZ - 6.2),
    new THREE.PlaneGeometry(compHalfX * 2 + 14, moatW).rotateX(-Math.PI * 0.5).translate(compX, y + 0.14, cz + compHalfZ + 6.2)
  ];

  // Hollow Hồ Thái Dịch twin lotus ponds with organic clustered dark-olive lotus colonies (ZERO dice-pip grid! EX-26!)
  for (const s of [-1, 1]) {
    const pondCx = cx + 44.5;
    const pondCz = cz + s * 16.5;
    const pond = new THREE.PlaneGeometry(14.0, 21.5);
    pond.rotateX(-Math.PI * 0.5);
    pond.translate(pondCx, y + 0.28, pondCz);
    moatGeos.push(pond);
    addBox(thanhStoneParts, 15.2, 0.44, 0.75, pondCx, y + 0.22, pondCz - 11.0);
    addBox(thanhStoneParts, 15.2, 0.44, 0.75, pondCx, y + 0.22, pondCz + 11.0);
    addBox(thanhStoneParts, 0.75, 0.44, 22.4, pondCx - 7.3, y + 0.22, pondCz);
    addBox(thanhStoneParts, 0.75, 0.44, 22.4, pondCx + 7.3, y + 0.22, pondCz);

    const clusterCenters: Array<[number, number]> = [
      [pondCx - 4.2, pondCz - 6.8],
      [pondCx + 3.6, pondCz + 5.8],
      [pondCx - 3.0, pondCz + 7.2]
    ];
    for (let c = 0; c < clusterCenters.length; c++) {
      const [lcx, lcz] = clusterCenters[c];
      for (let lp = 0; lp < 7; lp++) {
        const a = lp * 2.1 + c * 1.4;
        const r = 0.6 + (lp % 3) * 0.85;
        const pad = new THREE.CircleGeometry(0.42 + (lp % 3) * 0.16, 8);
        pad.rotateX(-Math.PI * 0.5);
        pad.translate(lcx + Math.cos(a) * r, y + 0.31, lcz + Math.sin(a) * r);
        lawnParts.push(colorizeGeometry(pad, lp % 2 === 0 ? '#234c1d' : '#2f5e24'));
      }
    }
  }

  // NW Cung Trường Sanh crescent pond & NE Hậu Hồ organic lake with Lush Central Garden Island (`Đảo Hậu Hồ` — EX-27!)
  const truongSanhPond = new THREE.CircleGeometry(10.5, 18);
  truongSanhPond.rotateX(-Math.PI * 0.5);
  truongSanhPond.translate(cx - 82, y + 0.24, cz + 56.0);
  moatGeos.push(truongSanhPond);
  const hauHoPond = new THREE.CircleGeometry(14.5, 20);
  hauHoPond.scale(1.15, 1.35, 1.0);
  hauHoPond.rotateX(-Math.PI * 0.5);
  hauHoPond.translate(cx - 82, y + 0.24, cz - 53.0);
  moatGeos.push(hauHoPond);
  // Central lush green island inside Hậu Hồ + arched garden bridge + 2 lakeside pavilions!
  const hauHoIsland = new THREE.CircleGeometry(6.2, 14);
  hauHoIsland.rotateX(-Math.PI * 0.5);
  hauHoIsland.translate(cx - 82, y + 0.32, cz - 53.0);
  lawnParts.push(colorizeGeometry(hauHoIsland, '#386e28'));
  addRoyalGardenTree(woodParts, foliageParts, cx - 85.2, y + 0.32, cz - 55.8, 0.78, 88);
  addBox(thanhStoneParts, 1.8, 0.35, 10.5, cx - 82, y + 0.42, cz - 43.0);

  const moatMesh = new THREE.Mesh(mergeNormalized(moatGeos), hp.moatReflectiveWaterMat);
  group.add(moatMesh);

  // Cầu Trung Đạo + Twin Tam Quan Arches
  addBox(thanhStoneParts, 17.5, 0.55, 8.2, cx + 44.5, y + 0.34, cz);
  // Item 058: Cầu Trung Đạo cambered stone bridge deck & bronze Kỳ Lân finials on twin Tam Quan arches
  addBox(thanhStoneParts, 14.5, 0.28, 7.6, cx + 44.5, y + 0.68, cz);
  thanhStoneParts.push(
    ...createPiercedBalustradeParts(cx + 36.0, cz - 3.9, cx + 53.0, cz - 3.9, y + 0.62, 0.78, 'hue_moat_panel'),
    ...createPiercedBalustradeParts(cx + 36.0, cz + 3.9, cx + 53.0, cz + 3.9, y + 0.62, 0.78, 'hue_moat_panel')
  );
  for (const archX of [cx + 36.6, cx + 52.2]) {
    for (const az of [-3.4, -1.6, 1.6, 3.4]) {
      addCyl(crimsonParts, 0.14, 0.16, 4.6, 6, archX, y + 2.75, cz + az);
    }
    addBox(goldParts, 0.42, 0.45, 7.4, archX, y + 4.9, cz);
    addBox(yellowRoofParts, 0.85, 0.36, 7.8, archX, y + 5.3, cz);
    bronzeParts.push(...createGuardianBeastParts(archX, y + 5.45, cz, Math.PI * 0.5, 0.55, 'kylan'));
  }
  // Item 059: Hồ Thái Dịch lotus-bud balustrade corner posts & pink/white lotus blossom accents
  for (const s of [-1, 1]) {
    const pondCx = cx + 44.5;
    const pondCz = cz + s * 16.5;
    for (const px of [-7.3, 7.3]) {
      for (const pz of [-11.0, 11.0]) {
        addCyl(thanhStoneParts, 0.22, 0.26, 0.95, 6, pondCx + px, y + 0.55, pondCz + pz);
      }
    }
    for (let fl = 0; fl < 4; fl++) {
      const fGeo = new THREE.ConeGeometry(0.18, 0.24, 5);
      fGeo.translate(pondCx - 3.0 + fl * 2.0, y + 0.42, pondCz + (fl % 2 === 0 ? -4.5 : 4.5));
      terracottaParts.push(fGeo);
    }
  }

  // Bastioned Crenellated Red-Brick `Hoàng Thành` Fortification Walls with Pale Stone Coping & Merlons (EX-28!)
  const wallHExt = 3.8;
  for (const s of [-1, 1]) {
    addBox(brickParts, 2.4, wallHExt, compHalfZ - 18, compX + compHalfX, y + wallHExt * 0.5, cz + s * (compHalfZ * 0.5 + 9));
    addBox(thanhStoneParts, 2.6, 0.24, compHalfZ - 18, compX + compHalfX, y + wallHExt + 0.12, cz + s * (compHalfZ * 0.5 + 9));
    addBox(brickParts, 2.4, wallHExt, compHalfZ - 10, compX - compHalfX, y + wallHExt * 0.5, cz + s * (compHalfZ * 0.5 + 5));
    addBox(thanhStoneParts, 2.6, 0.24, compHalfZ - 10, compX - compHalfX, y + wallHExt + 0.12, cz + s * (compHalfZ * 0.5 + 5));
    addBox(brickParts, compHalfX - 10, wallHExt, 2.4, compX - compHalfX * 0.5 - 5, y + wallHExt * 0.5, cz + s * compHalfZ);
    addBox(thanhStoneParts, compHalfX - 10, 0.24, 2.6, compX - compHalfX * 0.5 - 5, y + wallHExt + 0.12, cz + s * compHalfZ);
    addBox(brickParts, compHalfX - 10, wallHExt, 2.4, compX + compHalfX * 0.5 + 5, y + wallHExt * 0.5, cz + s * compHalfZ);
    addBox(thanhStoneParts, compHalfX - 10, 0.24, 2.6, compX + compHalfX * 0.5 + 5, y + wallHExt + 0.12, cz + s * compHalfZ);
  }

  // Front Entrance Gate: Continuous U-Bastion 9-Roof Axial Ngọ Môn (EX-27!)
  const nmX = compX + compHalfX;
  const nmArch = createArchedWallGeometry(36.0, 4.6, 7.6, 4.4, 3.5);
  nmArch.rotateY(Math.PI * 0.5);
  nmArch.translate(nmX, y, cz);
  brickParts.push(nmArch);
  // Item 055 & 056 & 057: 5-portal Ngọ Môn stone lintels, Lầu Ngũ Phụng ceramic dragon finials & Hoàng Thành crenellated parapet merlons
  addBox(thanhStoneParts, 7.8, 0.45, 5.2, nmX, y + 3.65, cz);
  for (const mz of [-28, -22, -16, 16, 22, 28, -42, 42]) {
    addBox(brickParts, 2.2, 0.65, 1.4, nmX, y + 4.35, cz + mz);
  }
  addBox(crimsonParts, 5.8, 3.0, 15.0, nmX, y + 6.1, cz);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(8.2, 17.5, 2.2, 10.2, 2.6, 0.26).translate(nmX, y + 7.6, cz));
  goldParts.push(new THREE.SphereGeometry(0.28, 8, 6).translate(nmX, y + 10.30, cz));
  for (const s of [-1, 1]) {
    addBox(brickParts, 12.0, 4.6, 6.8, nmX + 6.0, y + 2.3, cz + s * 15.0);
    addBox(crimsonParts, 9.6, 2.4, 5.6, nmX + 5.2, y + 5.8, cz + s * 15.0);
    jadeRoofParts.push(createHueImperialHipRoofGeometry(11.4, 7.4, 4.0, 2.6, 2.0, 0.24).translate(nmX + 5.2, y + 7.0, cz + s * 15.0));
    jadeRoofParts.push(createHueImperialHipRoofGeometry(7.2, 7.8, 2.4, 2.6, 2.1, 0.24).translate(nmX, y + 7.0, cz + s * 12.2));
  }
  // Item 070 (Area Expansion): Kỳ Đài (Hue Flag Tower) 3-tier stepped brick bastion & tall flagstaff in front of Ngọ Môn
  const kdX = nmX + 26.0;
  addBox(brickParts, 14.0, 2.8, 14.0, kdX, y + 1.4, cz);
  addBox(brickParts, 10.2, 2.4, 10.2, kdX, y + 4.0, cz);
  addBox(brickParts, 6.8, 2.2, 6.8, kdX, y + 6.3, cz);
  addCyl(woodParts, 0.16, 0.24, 11.5, 8, kdX, y + 13.0, cz);
  addBox(crimsonParts, 0.10, 1.85, 2.95, kdX + 1.45, y + 17.6, cz);
  // Item 071 (Area Expansion): Cửu Vị Thần Công (Nine Holy Cannons) sheltered pavilions flanking outer Ngọ Môn forecourt
  for (const s of [-1, 1]) {
    const cvX = nmX + 19.0;
    const cvZ = cz + s * 24.0;
    addBox(thanhStoneParts, 5.2, 0.45, 9.8, cvX, y + 0.225, cvZ);
    for (const pzOff of [-4.0, 0, 4.0]) {
      addCyl(crimsonParts, 0.14, 0.16, 3.3, 6, cvX - 1.8, y + 1.95, cvZ + pzOff);
      addCyl(crimsonParts, 0.14, 0.16, 3.3, 6, cvX + 1.8, y + 1.95, cvZ + pzOff);
      addCyl(bronzeParts, 0.18, 0.24, 2.2, 8, cvX, y + 0.85, cvZ + pzOff, 0, Math.PI * 0.5);
    }
    terracottaRoofParts.push(createHueImperialHipRoofGeometry(6.4, 11.2, 1.2, 7.6, 1.65, 0.22).translate(cvX, y + 3.45, cvZ));
  }
  // Item 078: Outer Ngọ Môn stone approach causeway & flanking royal shade trees
  addBox(thanhStoneParts, 24.0, 0.35, 8.4, nmX + 14.0, y + 0.18, cz);
  for (const s of [-1, 1]) {
    addRoyalGardenTree(woodParts, foliageParts, nmX + 16.0, y, cz + s * 11.5, 1.35, 78 + s);
  }

  // Bastioned 2-Tier 3-Arch Cardinal Gates (`Cửa Hòa Bình`, `Cửa Chương Đức`, `Cửa Hiển Nhơn` — EX-28!)
  const addCardinalGate = (gx: number, gz: number, rotY: number, useJade: boolean) => {
    const gWall = createArchedWallGeometry(16.0, 4.6, 5.4, 3.8, 3.2);
    gWall.rotateY(rotY);
    gWall.translate(gx, y, gz);
    brickParts.push(gWall);
    addBox(crimsonParts, 5.2, 2.5, 9.6, gx, y + 5.85, gz, rotY);
    const gRoof1 = createHueImperialHipRoofGeometry(7.2, 11.8, 3.8, 6.8, 1.5, 0.22);
    gRoof1.rotateY(rotY);
    gRoof1.translate(gx, y + 7.0, gz);
    addBox(crimsonParts, 3.4, 1.6, 6.2, gx, y + 8.6, gz, rotY);
    const gRoof2 = createHueImperialHipRoofGeometry(5.2, 8.2, 1.4, 3.8, 1.7, 0.24);
    gRoof2.rotateY(rotY);
    gRoof2.translate(gx, y + 9.4, gz);
    (useJade ? jadeRoofParts : terracottaRoofParts).push(gRoof1, gRoof2);
    const bBridge = new THREE.BoxGeometry(12.2, 0.52, 6.8);
    bBridge.rotateY(rotY);
    const dx = Math.cos(rotY) * 6.8;
    const dz = -Math.sin(rotY) * 6.8;
    bBridge.translate(gx + dx, y + 0.32, gz + dz);
    thanhStoneParts.push(bBridge);
  };
  addCardinalGate(compX - compHalfX, cz, -Math.PI * 0.5, false);
  addCardinalGate(compX, cz + compHalfZ, 0, true);
  addCardinalGate(compX, cz - compHalfZ, Math.PI, true);

  // 4. FORBIDDEN PURPLE CITY (`TỬ CẤM THÀNH` — Interconnected `Trường Lang` + `Thái Bình Lâu` + Articulated 2-Story `Điện Kiến Trung` — EX-27!)
  for (const s of [-1, 1]) {
    const vuX = cx - 49;
    const vuZ = cz + s * 19.5;
    addBox(thanhStoneParts, 15.5, 0.65, 9.2, vuX, y + 0.325, vuZ);
    addBox(plasterParts, 14.2, 4.0, 7.8, vuX, y + 2.65, vuZ);
    addBox(crimsonParts, 14.6, 0.42, 8.2, vuX, y + 4.7, vuZ);
    terracottaRoofParts.push(createHueImperialHipRoofGeometry(16.8, 10.6, 10.5, 2.2, 2.45, 0.24).translate(vuX, y + 4.85, vuZ));
  }

  // Interconnected Emerald `Trường Lang` Corridor Network + East-West Gallery Link to Cung Diên Thọ + `Thái Bình Lâu` Pavilion!
  for (const s of [-1, 1]) {
    const tlZ = cz + s * 22.0;
    addBox(thanhStoneParts, 28.0, 0.50, 3.6, cx - 71, y + 0.25, tlZ);
    for (let k = 0; k < 8; k++) {
      const px = cx - 58 - k * 3.5;
      addCyl(crimsonParts, 0.14, 0.16, 3.5, 6, px, y + 2.1, tlZ - 1.3);
      addCyl(crimsonParts, 0.14, 0.16, 3.5, 6, px, y + 2.1, tlZ + 1.3);
    }
    jadeRoofParts.push(createHueImperialHipRoofGeometry(29.0, 4.8, 25.0, 0.6, 1.35, 0.20).translate(cx - 71, y + 3.7, tlZ));
  }
  // Cross-corridor linking Trường Lang west toward Cung Diên Thọ (+Z) — with grounded stone plinth & crimson columns!
  addBox(thanhStoneParts, 4.0, 0.48, 22.0, cx - 64, y + 0.24, cz + 35.0);
  for (let k = 0; k < 6; k++) {
    const pz = cz + 25.5 + k * 3.8;
    addCyl(crimsonParts, 0.14, 0.16, 3.55, 6, cx - 65.4, y + 2.02, pz);
    addCyl(crimsonParts, 0.14, 0.16, 3.55, 6, cx - 62.6, y + 2.02, pz);
  }
  jadeRoofParts.push(createHueImperialHipRoofGeometry(4.4, 24.0, 0.8, 20.0, 1.25, 0.18).translate(cx - 64, y + 3.6, cz + 35.0));
  // NE inner `Thái Bình Lâu` (Imperial Reading Pavilion)
  addBox(thanhStoneParts, 8.8, 0.75, 11.2, cx - 76, y + 0.375, cz - 14.0);
  addBox(crimsonParts, 7.2, 3.8, 9.4, cx - 76, y + 2.65, cz - 14.0);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(9.8, 12.2, 3.4, 5.4, 2.2, 0.24).translate(cx - 76, y + 4.55, cz - 14.0));
  // Item 062: Thái Bình Lâu Khảm Sành Sứ porcelain-mosaic ridge finials & Hòn Non Bộ rockery
  goldParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(cx - 76, y + 6.86, cz - 14.0));
  addBox(thanhStoneParts, 2.2, 1.45, 2.2, cx - 69.5, y + 0.72, cz - 14.0);
  // Item 064 & 065: Sân Bái Mạng axial stone courtyard paving behind Đại Cung Môn & Trường Lang balustrade lanterns
  addBox(thanhStoneParts, 8.0, 0.22, 18.0, cx - 49.0, y + 0.11, cz);
  for (const s of [-1, 1]) {
    addBox(crimsonParts, 28.0, 0.65, 0.14, cx - 71, y + 0.82, cz + s * 22.0 - 1.3);
  }
  // Item 066 & 067 & 068 & 069 & 077: Điện Kiến Trung Art-Deco crest, Cung Diên Thọ rockery, Duyệt Thị Đường portico, Vườn Cơ Hạ moon-bridge & Phủ Nội Vụ wells
  goldParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(compX - compHalfX + 13.0, y + 11.88, cz));
  addBox(thanhStoneParts, 2.4, 1.2, 2.4, cx - 58, y + 0.6, cz + 42.0);
  addBox(crimsonParts, 3.2, 3.2, 4.4, cx - 47.0, y + 2.0, cz - 38.0);
  addCyl(thanhStoneParts, 0.55, 0.65, 0.65, 10, cx - 60, y + 0.32, cz - 46.0);
  // Vườn Cơ Hạ arched moon-bridge over Hậu Hồ
  addBox(thanhStoneParts, 2.2, 0.45, 12.0, cx - 82, y + 0.85, cz - 43.0);

  // Articulated 2-Story Indo-Vietnamese `Điện Kiến Trung` (arched arcade colonnades, grand front stairs & multi-gable roof — EX-27!)
  const ktX = compX - compHalfX + 13.0;
  addBox(thanhStoneParts, 14.5, 1.15, 33.0, ktX, y + 0.575, cz);
  addBox(thanhStoneParts, 3.6, 0.85, 7.4, ktX + 8.6, y + 0.425, cz); // Grand front stair
  addBox(plasterParts, 11.4, 7.0, 28.6, ktX, y + 4.6, cz);
  addBox(goldParts, 11.8, 0.35, 29.0, ktX, y + 4.7, cz);
  addBox(goldParts, 12.0, 0.45, 29.4, ktX, y + 8.1, cz);
  addBox(plasterParts, 12.8, 8.6, 10.6, ktX, y + 5.4, cz);
  // Rhythmic arched colonnade window recesses along East facade of Điện Kiến Trung
  for (let w = -5; w <= 5; w++) {
    addBox(crimsonParts, 0.26, 2.2, 1.3, ktX + 5.75, y + 2.6, cz + w * 2.45);
    addBox(crimsonParts, 0.26, 2.2, 1.3, ktX + 5.75, y + 6.3, cz + w * 2.45);
  }
  yellowRoofParts.push(createHueImperialHipRoofGeometry(13.8, 30.8, 4.2, 21.0, 2.6, 0.24).translate(ktX, y + 8.05, cz));
  yellowRoofParts.push(createHueImperialHipRoofGeometry(14.8, 12.0, 4.6, 4.8, 2.2, 0.24).translate(ktX, y + 9.6, cz));

  // 5. FOUR FLANKING PRECINCTS (Double-Tier Roofs & Side Shrines — EX-27!)
  const swZ = cz + 53.0;
  addBox(thanhStoneParts, 11.5, 0.85, 13.5, cx + 18, y + 0.425, swZ);
  addBox(crimsonParts, 8.8, 3.4, 10.6, cx + 18, y + 2.55, swZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(12.2, 14.2, 7.6, 9.2, 1.8, 0.24).translate(cx + 18, y + 4.25, swZ));
  addBox(crimsonParts, 6.4, 2.6, 7.8, cx + 18, y + 6.4, swZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(9.0, 10.6, 4.6, 5.6, 1.7, 0.24).translate(cx + 18, y + 7.7, swZ));
  addBox(crimsonParts, 4.2, 2.2, 5.0, cx + 18, y + 9.8, swZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(6.4, 7.4, 1.6, 2.2, 1.9, 0.28).translate(cx + 18, y + 10.9, swZ));

  addBox(thanhStoneParts, 4.2, 0.22, 26.5, cx + 7.5, y + 0.11, swZ);
  // Item 060: Elevated central Cao Đỉnh dais & individual stepped stone plinths for Cửu Đỉnh
  addBox(thanhStoneParts, 1.8, 0.22, 1.8, cx + 8.1, y + 0.32, swZ);
  for (let u = 0; u < 9; u++) {
    const uz = swZ - 11.2 + u * 2.8;
    const urn = createImperialUrnParts(cx + 7.5 + (u === 4 ? 0.6 : 0), y + 0.22 + (u === 4 ? 0.22 : 0), uz, 1.05);
    thanhStoneParts.push(...urn.stoneParts);
    bronzeParts.push(...urn.bronzeParts);
  }
  // Item 061 (Area Expansion): Hiển Lâm Các 3-tier pavilion south of Thế Miếu + flanking stone steles
  addBox(thanhStoneParts, 8.4, 0.85, 10.6, cx + 18, y + 0.425, swZ + 18.0);
  addBox(crimsonParts, 6.6, 3.4, 8.6, cx + 18, y + 2.55, swZ + 18.0);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(9.2, 11.4, 2.8, 5.4, 2.1, 0.24).translate(cx + 18, y + 4.25, swZ + 18.0));
  // Item 063 & 072 & 073 & 074 & 075 & 076: Tả/Hữu Vu screens, Phẩm Sơn gold medallions, Hộ Thành Hà embankments, Thái Miếu Tam Quan, Vạn Tuế pots & Trụ Biểu lantern heads
  for (const s of [-1, 1]) {
    addBox(brickParts, 0.45, 2.4, 4.2, cx - 40.5, y + 1.2, cz + s * 19.5);
    addBox(goldParts, 0.24, 0.28, 0.28, cx + 6.5, sanThuongY + 0.72, cz + s * 11.6);
    addBox(thanhStoneParts, 4.2, 0.45, 4.2, compX + compHalfX + 4.0, y + 0.22, cz + s * (compHalfZ + 4.0));
    addBox(brickParts, 1.2, 3.8, 9.6, cx + 3.5, y + 1.9, cz - 53.0);
    addCyl(porcelainParts, 0.34, 0.24, 0.48, 8, cx + 10.0, sanThuongY + 0.24, cz + s * 4.5);
    addBox(goldParts, 0.36, 0.36, 0.36, cx + 2.5, sanThuongY + 5.18, cz + s * 21.8);
  }
  // Thế Miếu (Double-tier 9-bay royal temple!) & Hưng Miếu
  addBox(thanhStoneParts, 13.4, 0.95, 29.4, cx - 7.0, y + 0.475, swZ);
  addBox(crimsonParts, 11.2, 4.6, 26.8, cx - 7.0, y + 3.25, swZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(15.4, 31.4, 10.2, 24.4, 1.8, 0.22, 10, 6, false).translate(cx - 7.0, y + 5.25, swZ));
  yellowRoofParts.push(createHueImperialHipRoofGeometry(11.6, 25.8, 2.4, 19.6, 2.4, 0.24).translate(cx - 7.0, y + 7.05, swZ));
  addBox(thanhStoneParts, 10.5, 0.75, 20.0, cx - 25.0, y + 0.375, swZ);
  addBox(crimsonParts, 8.8, 3.8, 18.0, cx - 25.0, y + 2.65, swZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(12.2, 22.0, 2.6, 16.0, 2.4, 0.24).translate(cx - 25.0, y + 4.55, swZ));

  // SE Precinct: Thái Miếu (Double-tier!) & Triệu Miếu
  const seZ = cz - 53.0;
  addBox(thanhStoneParts, 13.4, 0.95, 29.4, cx - 7.0, y + 0.475, seZ);
  addBox(crimsonParts, 11.2, 4.6, 26.8, cx - 7.0, y + 3.25, seZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(15.4, 31.4, 10.2, 24.4, 1.8, 0.22, 10, 6, false).translate(cx - 7.0, y + 5.25, seZ));
  yellowRoofParts.push(createHueImperialHipRoofGeometry(11.6, 25.8, 2.4, 19.6, 2.4, 0.24).translate(cx - 7.0, y + 7.05, seZ));
  addBox(thanhStoneParts, 10.5, 0.75, 20.0, cx - 25.0, y + 0.375, seZ);
  addBox(crimsonParts, 8.8, 3.8, 18.0, cx - 25.0, y + 2.65, seZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(12.2, 22.0, 2.6, 16.0, 2.4, 0.24).translate(cx - 25.0, y + 4.55, seZ));

  // NW Precinct: Cung Diên Thọ (Double-tier!) & Cung Trường Sanh
  addBox(thanhStoneParts, 13.5, 0.85, 21.0, cx - 58, y + 0.425, swZ);
  addBox(plasterParts, 11.8, 4.4, 19.0, cx - 58, y + 3.05, swZ);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(14.8, 23.0, 10.0, 17.5, 1.5, 0.22, 10, 6, false).translate(cx - 58, y + 5.05, swZ));
  yellowRoofParts.push(createHueImperialHipRoofGeometry(11.2, 18.6, 2.6, 13.5, 2.0, 0.24).translate(cx - 58, y + 6.55, swZ));
  addBox(thanhStoneParts, 11.0, 0.75, 14.5, cx - 80, y + 0.375, swZ - 6.0);
  addBox(crimsonParts, 8.8, 3.6, 12.2, cx - 80, y + 2.55, swZ - 6.0);
  jadeRoofParts.push(createHueImperialHipRoofGeometry(11.8, 16.0, 3.0, 10.0, 2.2, 0.24).translate(cx - 80, y + 4.35, swZ - 6.0));

  // NE Precinct: Duyệt Thị Đường, Phủ Nội Vụ & 3 Vườn Cơ Hạ Pavilions!
  addBox(thanhStoneParts, 13.5, 0.85, 15.5, cx - 54, y + 0.425, cz - 38.0);
  addBox(crimsonParts, 11.8, 4.6, 14.0, cx - 54, y + 3.15, cz - 38.0);
  jadeRoofParts.push(createHueImperialHipRoofGeometry(14.8, 17.5, 3.6, 11.0, 2.5, 0.24).translate(cx - 54, y + 5.45, cz - 38.0));
  addBox(thanhStoneParts, 12.5, 0.75, 20.0, cx - 60, y + 0.375, seZ - 4.0);
  addBox(plasterParts, 11.2, 5.4, 18.2, cx - 60, y + 3.45, seZ - 4.0);
  terracottaRoofParts.push(createHueImperialHipRoofGeometry(13.4, 21.0, 4.0, 15.0, 2.2, 0.20).translate(cx - 60, y + 6.15, seZ - 4.0));
  for (const [px, pz, szP] of [
    [cx - 78, seZ + 4.0, 6.8],
    [cx - 68, seZ + 12.0, 5.4],
    [cx - 86, seZ + 16.0, 5.2]
  ]) {
    addBox(thanhStoneParts, szP + 2.2, 0.65, szP + 2.2, px, y + 0.325, pz);
    addBox(crimsonParts, szP, 3.0, szP, px, y + 2.15, pz);
    jadeRoofParts.push(createHueImperialHipRoofGeometry(szP + 2.8, szP + 2.8, 2.2, 2.2, 2.0, 0.24).translate(px, y + 3.65, pz));
  }

  // Rhythmic Royal Shade Trees lining Đường số 1, Đường số 2, Vườn Cơ Hạ & outer lawns (EX-29 — strictly clear of all buildings & walls!)
  for (let t = 0; t < 16; t++) {
    const gx = cx + 24 - (t % 8) * 14.5;
    const baseSign = t < 8 ? -1 : 1;
    const gz = cz + baseSign * 38.5 + ((t * 5) % 5) - 2;
    // Skip any spot near Duyệt Thị Đường (cx-54, cz-38), Trường Lang cross-corridor (cx-64, cz+35), Cung Diên Thọ (cx-58, cz+53), or Phủ Nội Vụ (cx-60, cz-57)
    if (Math.hypot(gx - (cx - 54), gz - (cz - 38)) < 14.5) continue;
    if (Math.hypot(gx - (cx - 64), gz - (cz + 35)) < 11.5) continue;
    if (Math.hypot(gx - (cx - 58), gz - (cz + 53)) < 14.5) continue;
    if (Math.hypot(gx - (cx - 60), gz - (cz - 57)) < 14.5) continue;
    addRoyalGardenTree(woodParts, foliageParts, gx, y, gz, 1.08, 30 + t);
  }

  // Inner red-brick precinct dividing walls
  for (const s of [-1, 1]) {
    addBox(brickParts, 1.2, 2.6, 42.0, cx - 39.0, y + 1.3, cz + s * 52.0);
    addBox(brickParts, 136.0, 2.6, 1.2, compX, y + 1.3, cz + s * 31.0);
  }

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
  addMerged(walkwayParts, hp.thanhStoneMat, false, true, 4.0);
  addMerged(brickParts, hp.bastionBrickMat, true, true, 2.6);
  addMerged(plasterParts, ctx.materials.agedPlaster ?? ctx.materials.whitePlaster, true, true, 3.2);
  addMerged(crimsonParts, hp.imperialCrimsonWoodMat, true, true, 1.8);
  addMerged(yellowRoofParts, hp.hoangLuuLyMat, true, true);
  addMerged(jadeRoofParts, hp.thanhLuuLyMat, true, true);
  addMerged(terracottaRoofParts, ctx.materials.terracottaRoof, true, true);
  addMerged(goldParts, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(bronzeParts, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(terracottaParts, hp.terracottaBalustradeMat, false, true);
  addMerged(ochreBalParts, ctx.materials.yellowOchrePlaster ?? hp.terracottaBalustradeMat, false, true);
  addMerged(porcelainParts, hp.porcelainCobaltMat, false, true);
  addMerged(woodParts, ctx.materials.darkWood, false, true);

  if (lawnParts.length > 0) {
    const lawnMat =
      ctx.materialLib?.getOrCreateStandard({
        vertexColors: true,
        roughness: 0.84,
        metalness: 0.02
      }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
    addMerged(lawnParts, lawnMat, false, true);
  }
  if (foliageParts.length > 0) {
    const folMat =
      ctx.materialLib?.getOrCreateStandard({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.02
      }) ??
      new THREE.MeshStandardMaterial({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        vertexColors: true,
        roughness: 0.72
      });
    addMerged(foliageParts, folMat, false, true);
  }

  // ==========================================================================
  // WAVE 2 UPGRADES (Items 241–248, 256–280): Imperial Palanquin, Courtyard
  // Sundial (Nhật Quỹ), Bát Bửu, Hương Án, Thế Miếu, Duyệt Thị Đường,
  // Thái Bình Lâu, Điện Kiến Trung, Cung Diên Thọ, Vườn Cơ Hạ & Kỳ Đài
  // ==========================================================================
  const w2Stone: THREE.BufferGeometry[] = [];
  const w2Brick: THREE.BufferGeometry[] = [];
  const w2Crimson: THREE.BufferGeometry[] = [];
  const w2Gold: THREE.BufferGeometry[] = [];
  const w2Bronze: THREE.BufferGeometry[] = [];
  const w2Wood: THREE.BufferGeometry[] = [];
  const w2YellowRoof: THREE.BufferGeometry[] = [];
  const w2JadeRoof: THREE.BufferGeometry[] = [];
  const w2Terracotta: THREE.BufferGeometry[] = [];
  const w2Porcelain: THREE.BufferGeometry[] = [];

  // 241–242: Royal ceremonial imperial palanquin (Kiệu Rồng Ngự Giá) & twin Lọng Vàng parasols on Sân Thượng
  const palX = cx + 10.5;
  const palZ = cz + 7.5;
  addBox(w2Crimson, 1.65, 0.24, 1.25, palX, sanThuongY + 0.65, palZ);
  addBox(w2Crimson, 4.6, 0.10, 0.10, palX, sanThuongY + 0.55, palZ - 0.58);
  addBox(w2Crimson, 4.6, 0.10, 0.10, palX, sanThuongY + 0.55, palZ + 0.58);
  for (const px of [-0.68, 0.68]) {
    for (const pz of [-0.52, 0.52]) {
      addCyl(w2Gold, 0.05, 0.05, 1.45, 5, palX + px, sanThuongY + 1.45, palZ + pz);
    }
  }
  addBox(w2Gold, 1.95, 0.35, 1.55, palX, sanThuongY + 2.28, palZ);
  for (const s of [-1, 1]) {
    addCyl(w2Crimson, 0.04, 0.05, 2.75, 5, palX, sanThuongY + 1.38, palZ + s * 1.45);
    const para = new THREE.ConeGeometry(0.68, 0.42, 6);
    para.translate(palX, sanThuongY + 2.85, palZ + s * 1.45);
    w2Gold.push(para);
  }

  // 243–244: Authentic Nguyễn-Dynasty courtyard stone sundial (Nhật Quỹ) & bronze gnomon on Sân Thượng
  const sdX = cx + 12.2;
  const sdZ = cz - 7.8;
  addCyl(w2Stone, 0.72, 0.85, 0.28, 6, sdX, sanThuongY + 0.14, sdZ);
  addCyl(w2Stone, 0.42, 0.52, 0.92, 6, sdX, sanThuongY + 0.72, sdZ);
  addCyl(w2Bronze, 0.56, 0.56, 0.08, 6, sdX, sanThuongY + 1.24, sdZ);
  addCyl(w2Gold, 0.03, 0.04, 0.58, 5, sdX + 0.08, sanThuongY + 1.52, sdZ, 0, -0.45);

  // 245–248, 256–260: Bát Bửu halberd stands, Hương Án incense table, drainage channels, Tắc Môn blocks, mounting blocks, Đường Thần Đạo curbs, sentry kiosks, stele pavilion & lecterns
  for (const s of [-1, 1]) {
    // 245: Bát Bửu ceremonial halberd racks lining Đường Thần Đạo
    addBox(w2Crimson, 0.38, 0.24, 1.25, cx + 10.0, sanThuongY + 0.14, cz + s * 4.1);
    for (const hz of [-0.38, 0, 0.38]) {
      addCyl(w2Gold, 0.03, 0.04, 2.35, 5, cx + 10.0, sanThuongY + 1.32, cz + s * 4.1 + hz);
    }
    // 247: Stepped stone rain-drainage channels bordering Sân Đại Triều Nghi
    addBox(w2Stone, 48.0, 0.18, 0.48, cx - 8.0, sanThuongY + 0.09, cz + s * 26.8);
    // 248: Thanh stone Tắc Môn spirit-curb blocks at lateral stair landings
    addBox(w2Stone, 0.42, 0.55, 1.85, cx + 15.8, sanThuongY + 0.28, cz + s * 16.5);
    // 256: Stone mounting blocks (Bệ Lên Ngựa) flanking Sân Hạ steps
    addBox(w2Stone, 1.15, 0.52, 0.68, stairXBot + 2.4, sanHaY + 0.26, cz + s * 5.2);
    // 257: Dressed stone curbing & lotus-cap bollards along Sân Hạ processional lane
    addBox(w2Stone, 16.0, 0.14, 0.32, cx + 29.0, sanHaY + 0.07, cz + s * 3.8);
    addCyl(w2Stone, 0.14, 0.18, 0.68, 6, cx + 36.2, sanHaY + 0.34, cz + s * 3.8);
    // 258: Terracotta-tiled heritage guard sentry kiosks (Điếm Canh) behind Ngọ Môn
    addBox(w2Brick, 2.2, 2.4, 2.2, nmX - 7.5, y + 1.2, cz + s * 10.5);
    const kRoof = new THREE.ConeGeometry(1.95, 1.15, 4);
    kRoof.rotateY(Math.PI * 0.25);
    kRoof.translate(nmX - 7.5, y + 2.95, cz + s * 10.5);
    w2Terracotta.push(kRoof);
  }
  // 246: Crimson-lacquered Hương Án imperial offering table with bronze censer at base of Điện Thái Hòa steps
  addBox(w2Crimson, 1.05, 0.88, 1.95, cx - 1.5, sanThuongY + 0.44, cz);
  addCyl(w2Bronze, 0.26, 0.20, 0.42, 6, cx - 1.5, sanThuongY + 1.08, cz);
  // 259–260: Imperial decree stele pavilion (Nhà Bia) on north lawn & wooden interpretation lecterns
  addBox(w2Stone, 3.6, 0.45, 3.6, cx + 26.0, y + 0.22, cz - 38.0);
  addBox(w2Stone, 0.32, 1.75, 0.95, cx + 26.0, y + 1.32, cz - 38.0);
  for (const bx of [-1.35, 1.35]) {
    for (const bz of [-1.35, 1.35]) {
      addCyl(w2Crimson, 0.11, 0.13, 2.55, 6, cx + 26.0 + bx, y + 1.58, cz - 38.0 + bz);
    }
  }
  const biaRoof = new THREE.ConeGeometry(2.8, 1.45, 4);
  biaRoof.rotateY(Math.PI * 0.25);
  biaRoof.translate(cx + 26.0, y + 3.45, cz - 38.0);
  w2YellowRoof.push(biaRoof);
  for (const lz of [-8.5, 8.5]) {
    addBox(w2Wood, 0.45, 0.95, 0.65, cx + 22.0, sanHaY + 0.48, cz + lz);
  }

  // 261–265: Thế Miếu front veranda colonnade, triple stairs, bronze Đỉnh & Hiển Lâm Các 2nd/3rd tiers + tortoise steles
  for (let b = -4; b <= 4; b++) {
    addCyl(w2Crimson, 0.14, 0.16, 4.6, 6, cx - 0.6, y + 3.10, swZ + b * 3.1);
  }
  for (const szOff of [-7.5, 0, 7.5]) {
    addBox(w2Stone, 2.4, 0.85, 3.2, cx + 0.8, y + 0.42, swZ + szOff);
  }
  addCyl(w2Bronze, 0.48, 0.36, 0.85, 6, cx + 3.8, y + 0.55, swZ);
  // 264–265: Hiển Lâm Các upper galleries & flanking tortoise-base stone steles
  addBox(w2Crimson, 4.8, 2.4, 6.2, cx + 18, y + 6.4, swZ + 18.0);
  const hlcTop = new THREE.ConeGeometry(4.4, 1.95, 4);
  hlcTop.rotateY(Math.PI * 0.25);
  hlcTop.translate(cx + 18, y + 8.55, swZ + 18.0);
  w2YellowRoof.push(hlcTop);
  for (const s of [-1, 1]) {
    addBox(w2Stone, 0.85, 0.42, 1.15, cx + 14.5, y + 0.22, swZ + 18.0 + s * 5.8);
    addBox(w2Stone, 0.28, 1.65, 0.85, cx + 14.5, y + 1.22, swZ + 18.0 + s * 5.8);
  }

  // 266–268: Duyệt Thị Đường portico columns (aligned onto plinth & into eave!), gilded plaque, Trống Đại drum pavilion & Hồi Lang cloister
  const dtdX = cx - 54;
  const dtdZ = cz - 38.0;
  for (const pz of [-4.2, -1.4, 1.4, 4.2]) {
    addCyl(w2Crimson, 0.15, 0.17, 4.9, 6, dtdX + 6.4, y + 3.15, dtdZ + pz);
  }
  addBox(w2Gold, 0.18, 0.72, 3.2, dtdX + 6.55, y + 4.65, dtdZ);
  addCyl(w2Crimson, 0.52, 0.52, 0.85, 6, dtdX + 10.5, y + 1.15, dtdZ, 0, Math.PI * 0.5);
  for (const s of [-1, 1]) {
    addBox(w2Crimson, 8.5, 2.8, 0.45, dtdX + 10.5, y + 1.4, dtdZ + s * 7.8);
  }

  // 269–270: Thái Bình Lâu front reading veranda, balustrade, stairs & Hòn Non Bộ basin + ceramic Đôn Sứ
  for (const pz of [-3.6, -1.2, 1.2, 3.6]) {
    addCyl(w2Crimson, 0.13, 0.15, 4.1, 6, cx - 71.8, y + 2.65, cz - 14.0 + pz);
  }
  addBox(w2Stone, 1.85, 0.65, 3.2, cx - 70.6, y + 0.35, cz - 14.0);
  addCyl(w2Porcelain, 0.24, 0.20, 0.48, 6, cx - 68.2, y + 0.24, cz - 11.5);
  addCyl(w2Porcelain, 0.24, 0.20, 0.48, 6, cx - 68.2, y + 0.24, cz - 16.5);

  // 271–272: Điện Kiến Trung stair cheek-walls, Art-Deco urns, front parterre beds & fountain ring
  for (const s of [-1, 1]) {
    addBox(w2Stone, 3.8, 1.15, 0.48, ktX + 8.6, y + 0.65, cz + s * 3.9);
    addCyl(w2Gold, 0.28, 0.18, 0.62, 6, ktX + 10.4, y + 1.48, cz + s * 3.9);
    addBox(w2Stone, 5.2, 0.32, 6.4, ktX + 14.5, y + 0.18, cz + s * 7.8);
  }
  addCyl(w2Stone, 2.1, 2.25, 0.42, 6, ktX + 14.5, y + 0.22, cz);

  // 273–275: Cung Diên Thọ water pavilion, Cung Trường Sanh pond bridge & Vườn Cơ Hạ octagonal tea pavilion on Đảo Hậu Hồ
  addBox(w2Crimson, 4.2, 2.8, 4.2, cx - 58, y + 1.85, swZ + 14.5);
  const dtPavRoof = new THREE.ConeGeometry(3.4, 1.45, 6);
  dtPavRoof.translate(cx - 58, y + 3.95, swZ + 14.5);
  w2JadeRoof.push(dtPavRoof);
  // 274: Cung Trường Sanh arched pond bridge & rockery
  addBox(w2Stone, 1.8, 0.42, 9.5, cx - 82, y + 0.58, cz + 56.0);
  // 275: Vườn Cơ Hạ octagonal tea pavilion on Đảo Hậu Hồ
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w2Crimson, 0.12, 0.14, 3.05, 5, cx - 82 + Math.cos(a) * 2.4, y + 1.695, cz - 53.0 + Math.sin(a) * 2.4);
  }
  const vhPavRoof = new THREE.ConeGeometry(3.5, 1.65, 6);
  vhPavRoof.translate(cx - 82, y + 3.85, cz - 53.0);
  w2JadeRoof.push(vhPavRoof);

  // 276–280: Tả/Hữu Vu veranda columns & stairs, Kỳ Đài ramps & signal cannons, Cửu Vị Thần Công gun carriages, Hộ Thành Hà corner watch-turrets & Thái Miếu spirit screens
  for (const s of [-1, 1]) {
    // 276: Tả/Hữu Vu front veranda stairs & columns (embedded into plinth & reaching roof eave!)
    addBox(w2Stone, 1.65, 0.58, 3.2, cx - 40.5, y + 0.30, cz + s * 19.5);
    addCyl(w2Crimson, 0.13, 0.15, 4.5, 6, cx - 41.4, y + 2.75, cz + s * 17.0);
    addCyl(w2Crimson, 0.13, 0.15, 4.5, 6, cx - 41.4, y + 2.75, cz + s * 22.0);
    // 277: Kỳ Đài stair ramps & Tier-2 signal cannons
    addBox(w2Brick, 3.2, 2.2, 2.2, kdX - 7.8, y + 1.1, cz + s * 3.6);
    addCyl(w2Bronze, 0.16, 0.22, 1.85, 6, kdX + 4.6, y + 5.45, cz + s * 2.8, 0, Math.PI * 0.5);
    // 278: Cửu Vị Thần Công timber gun-carriage frames under cannons
    addBox(w2Wood, 1.45, 0.42, 7.8, nmX + 19.0, y + 0.58, cz + s * 24.0);
    // 279: Hộ Thành Hà corner bastion watch-turrets at NE & SE corners
    addBox(w2Brick, 4.4, 3.4, 4.4, compX + compHalfX + 4.0, y + 2.0, cz + s * (compHalfZ + 4.0));
    const turRoof = new THREE.ConeGeometry(3.4, 1.55, 4);
    turRoof.rotateY(Math.PI * 0.25);
    turRoof.translate(compX + compHalfX + 4.0, y + 4.45, cz + s * (compHalfZ + 4.0));
    w2Terracotta.push(turRoof);
  }
  // 280: Thái Miếu & Triệu Miếu courtyard spirit screens & bronze crane pedestals
  addBox(w2Brick, 0.48, 2.35, 4.6, cx + 1.2, y + 1.18, seZ);
  addCyl(w2Bronze, 0.16, 0.22, 1.45, 5, cx + 2.4, y + 0.72, seZ - 3.2);
  addCyl(w2Bronze, 0.16, 0.22, 1.45, 5, cx + 2.4, y + 0.72, seZ + 3.2);

  addMerged(w2Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w2Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w2Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w2Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w2Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w2Wood, ctx.materials.darkWood, false, true);
  addMerged(w2YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w2JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w2Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w2Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 3 UPGRADES (Items 481–492, 499, 501–509, 511–515, 518–560):
  // Tử Cấm Thành (Điện Cần Chánh, Điện Càn Thành, Đại Cung Môn), Glazed Dragon
  // Balustrades, Moat Bridges (Cầu Kim Thủy & Hộ Thành Hà) & Royal Precincts
  // ==========================================================================
  const w3Stone: THREE.BufferGeometry[] = [];
  const w3Brick: THREE.BufferGeometry[] = [];
  const w3Crimson: THREE.BufferGeometry[] = [];
  const w3Gold: THREE.BufferGeometry[] = [];
  const w3Bronze: THREE.BufferGeometry[] = [];
  const w3Wood: THREE.BufferGeometry[] = [];
  const w3YellowRoof: THREE.BufferGeometry[] = [];
  const w3JadeRoof: THREE.BufferGeometry[] = [];
  const w3Terracotta: THREE.BufferGeometry[] = [];
  const w3Porcelain: THREE.BufferGeometry[] = [];

  // 481–485, 511–512: Điện Cần Chánh reconstructed imperial palace behind Đại Cung Môn & Sân Bái Mạng (cx - 57.5, cz — zero overlap with Điện Thái Hòa!)
  const ccW3X = cx - 57.5;
  const ccFloorY = y + 1.15;
  addBox(w3Stone, 13.6, 1.35, 20.8, ccW3X, y + 0.58, cz);
  for (const szOff of [-6.4, 0, 6.4]) {
    addBox(w3Stone, 2.2, 0.95, 2.6, ccW3X + 7.6, y + 0.48, cz + szOff);
  }
  addBox(w3Crimson, 9.8, 3.85, 17.2, ccW3X - 0.6, ccFloorY + 1.95, cz);
  // 482: 7-bay front crimson veranda colonnade embedded -0.15m into terrace & rising to lower eave
  for (let b = -3; b <= 3; b++) {
    addCyl(w3Crimson, 0.14, 0.16, 4.15, 6, ccW3X + 5.6, ccFloorY + 1.92, cz + b * 2.5);
  }
  // 483: Double-tier Hoàng Lưu Ly imperial flat-ridge roof & flush gilded dragon crest
  addBox(w3YellowRoof, 13.4, 1.15, 20.0, ccW3X + 0.2, ccFloorY + 4.35, cz);
  addBox(w3YellowRoof, 9.8, 1.05, 15.8, ccW3X - 0.2, ccFloorY + 5.38, cz);
  addBox(w3Gold, 0.32, 0.34, 14.2, ccW3X - 0.2, ccFloorY + 6.02, cz);
  // 484–485, 511–512: Gilded ĐIỆN CẦN CHÁNH plaque, flanking bronze Đỉnh, Đôn Sứ bonsai pedestals & corridor links to Tả/Hữu Vu
  addBox(w3Gold, 0.18, 0.72, 3.4, ccW3X + 5.75, ccFloorY + 3.45, cz);
  for (const s of [-1, 1]) {
    addCyl(w3Bronze, 0.42, 0.34, 0.78, 6, ccW3X + 8.4, y + 0.48, cz + s * 4.2);
    addCyl(w3Porcelain, 0.28, 0.24, 0.56, 6, ccW3X + 8.4, y + 0.28, cz + s * 8.2);
    addBox(w3Crimson, 3.6, 2.8, 4.4, ccW3X + 2.2, y + 1.45, cz + s * 12.6);
    addBox(w3JadeRoof, 4.2, 0.55, 5.0, ccW3X + 2.2, y + 3.05, cz + s * 12.6);
  }

  // 486–488, 513: Điện Càn Thành (Emperor's Private Residence, cx - 72.5, cz — clear of Thái Bình Lâu at cz - 14!), Bình Phong privacy screen & courtyard lotus fountain
  const ctX = cx - 72.5;
  const ctFloorY = y + 1.05;
  addBox(w3Stone, 10.6, 1.25, 14.4, ctX, y + 0.52, cz);
  addBox(w3Crimson, 7.8, 3.45, 11.8, ctX - 0.4, ctFloorY + 1.72, cz);
  for (let b = -2; b <= 2; b++) {
    addCyl(w3Crimson, 0.13, 0.15, 3.75, 6, ctX + 4.3, ctFloorY + 1.72, cz + b * 2.4);
  }
  addBox(w3YellowRoof, 10.4, 1.05, 14.0, ctX, ctFloorY + 3.85, cz);
  addBox(w3Gold, 0.28, 0.30, 11.2, ctX, ctFloorY + 4.48, cz);
  // 488 & 513: Carved stone Bình Phong privacy screen & lotus-basin fountain between Cần Chánh & Càn Thành
  addBox(w3Stone, 0.52, 2.65, 5.0, cx - 65.8, y + 1.32, cz);
  addCyl(w3Stone, 1.35, 1.50, 0.48, 6, cx - 65.8, y + 0.24, cz + 5.2);
  addCyl(w3Porcelain, 0.38, 0.48, 0.85, 6, cx - 65.8, y + 0.68, cz + 5.2);

  // 489–490, 514, 520: Đại Cung Môn (Great Palace Gate, cx - 42.5, cz — cleanly behind Điện Thái Hòa rear edge cx - 37!) 5-bay gatehouse, gilded doors, Kỳ Lân pedestals & bonsai planters
  const dcmX = cx - 42.5;
  addBox(w3Stone, 4.4, 0.72, 16.4, dcmX, y + 0.36, cz);
  for (let b = -2; b <= 2; b++) {
    addCyl(w3Crimson, 0.14, 0.16, 3.95, 6, dcmX + 1.75, y + 2.52, cz + b * 3.2);
    addCyl(w3Crimson, 0.14, 0.16, 3.95, 6, dcmX - 1.75, y + 2.52, cz + b * 3.2);
  }
  addBox(w3YellowRoof, 5.2, 1.15, 17.4, dcmX, y + 4.82, cz);
  addBox(w3Gold, 0.26, 0.28, 14.2, dcmX, y + 5.48, cz);
  addBox(w3Gold, 0.18, 0.68, 3.2, dcmX + 1.90, y + 3.95, cz);
  for (const s of [-1, 1]) {
    addBox(w3Stone, 0.95, 1.05, 0.95, dcmX - 3.1, y + 0.52, cz + s * 3.8);
    addBox(w3Bronze, 0.65, 0.72, 0.65, dcmX - 3.1, y + 1.38, cz + s * 3.8);
    addBox(w3Stone, 1.05, 0.55, 1.05, dcmX - 3.1, y + 0.28, cz + s * 7.2);
  }

  // 491–492, 515: Tử Cấm Thành brick perimeter screen walls, terracotta coping, Tả/Hữu Túc Môn side wickets & inner stone archways
  for (const s of [-1, 1]) {
    addBox(w3Brick, 56.0, 2.85, 0.68, cx - 54.0, y + 1.42, cz + s * 28.5);
    addBox(w3Terracotta, 56.4, 0.28, 0.92, cx - 54.0, y + 2.95, cz + s * 28.5);
    // 492: Tả/Hữu Túc Môn side wickets with jade-glazed gable roofs
    addBox(w3Brick, 3.4, 3.6, 1.45, cx - 32.0, y + 1.80, cz + s * 28.5);
    addBox(w3JadeRoof, 4.2, 0.85, 2.25, cx - 32.0, y + 3.95, cz + s * 28.5);
    // 515: Inner garden ornamental stone archways
    addBox(w3Stone, 0.75, 3.2, 3.6, cx - 60.0, y + 1.60, cz + s * 16.5);
  }

  // 499, 501–509, 518–519: Axial walkway curbs, Sân Đại Triều Nghi dragon stair cheeks, Hạc/Rùa plinths,
  // Cửu Phẩm curbs, Tả/Hữu Vu ridge finials & screens, Trường Lang tie-beams/lanterns, flag sockets & map plaque
  for (const s of [-1, 1]) {
    // 499: Rear Tử Cấm Thành axial stone walkway curbing across Sân Bái Mạng
    addBox(w3Stone, 6.2, 0.22, 0.38, cx - 48.0, y + 0.11, cz + s * 3.4);
    // 501: Sân Đại Triều Nghi glazed dragon-balustrade cheek walls along central Sân Thượng -> Sân Hạ stairs
    addBox(w3Porcelain, 4.8, 0.78, 0.36, stairXBot - 1.8, sanHaY + 0.65, cz + s * 3.8);
    // 502: Carved stone Hạc & Rùa ceremonial plinths flanking lower Đường Thần Đạo entry
    addBox(w3Stone, 1.05, 0.72, 1.05, stairXBot + 6.5, sanHaY + 0.36, cz + s * 4.4);
    addCyl(w3Bronze, 0.16, 0.22, 1.35, 5, stairXBot + 6.5, sanHaY + 1.38, cz + s * 4.4);
    // 503–504: Sân Thượng corner lantern pedestals & Sân Hạ Cửu Phẩm rank-stele curbs
    addBox(w3Stone, 0.55, 1.45, 0.55, cx + 14.8, sanThuongY + 0.72, cz + s * 24.5);
    addBox(w3Gold, 0.42, 0.42, 0.42, cx + 14.8, sanThuongY + 1.65, cz + s * 24.5);
    addBox(w3Stone, 10.5, 0.18, 0.85, cx + 26.0, sanHaY + 0.09, cz + s * 12.5);
    // 505–507: Tả Vu & Hữu Vu glazed ridge finials (seated flush at y + 7.25 on roof top y + 7.30!), courtyard Bình Phong screens & veranda railings
    addBox(w3Gold, 0.26, 0.28, 10.2, cx - 49.0, y + 7.25, cz + s * 19.5);
    addBox(w3Stone, 0.38, 1.85, 3.2, cx - 39.2, y + 0.92, cz + s * 19.5);
    addBox(w3Crimson, 0.16, 0.85, 5.2, cx - 41.4, y + 1.02, cz + s * 19.5);
    // 508–509: Trường Lang covered corridor tie-beams & hanging palace lanterns (aligned to Trường Lang at cx - 71, cz ± 22.0!)
    addBox(w3Crimson, 28.0, 0.24, 0.24, cx - 71.0, y + 3.45, cz + s * 22.0);
    addBox(w3Gold, 0.26, 0.36, 0.26, cx - 64.0, y + 3.05, cz + s * 22.0);
    addBox(w3Gold, 0.26, 0.36, 0.26, cx - 78.0, y + 3.05, cz + s * 22.0);
    // 518: Imperial flag-socket stone blocks flanking Kiệu Rồng palanquin
    addBox(w3Stone, 0.65, 0.48, 0.65, palX + s * 2.2, sanThuongY + 0.24, palZ);
    // 558: Royal bonsai planters at Sân Đại Triều Nghi corners
    addBox(w3Stone, 1.35, 0.58, 1.35, cx + 34.0, sanHaY + 0.29, cz + s * 22.0);
  }
  // 519: Visitor-guide heritage bronze map plaque on Sân Hạ
  addBox(w3Stone, 0.62, 0.95, 0.48, cx + 34.5, sanHaY + 0.48, cz + 6.8);
  addBox(w3Bronze, 0.72, 0.12, 0.56, cx + 34.5, sanHaY + 1.02, cz + 6.8);

  // 521–525: Cầu Kim Thủy north & south arched stone moat bridges (cx + 38, cz ± 26) with lotus balustrades, Cầu Trung Đạo dragon caps & Hồ Thái Dịch lanterns
  for (const s of [-1, 1]) {
    const kbZ = cz + s * 26.0;
    addBox(w3Stone, 11.5, 0.68, 4.2, cx + 38.0, y + 0.34, kbZ);
    addBox(w3Stone, 11.5, 0.85, 0.32, cx + 38.0, y + 1.05, kbZ - 1.95);
    addBox(w3Stone, 11.5, 0.85, 0.32, cx + 38.0, y + 1.05, kbZ + 1.95);
    for (const bxO of [-5.2, 0, 5.2]) {
      addCyl(w3Stone, 0.14, 0.18, 1.18, 5, cx + 38.0 + bxO, y + 1.25, kbZ - 1.95);
      addCyl(w3Stone, 0.14, 0.18, 1.18, 5, cx + 38.0 + bxO, y + 1.25, kbZ + 1.95);
    }
    // 524–525: Cầu Trung Đạo porcelain dragon-cap posts & Hồ Thái Dịch corner lanterns
    addBox(w3Porcelain, 0.42, 0.48, 0.42, cx + 44.5, y + 1.48, cz + s * 3.8);
    addBox(w3Stone, 0.55, 1.45, 0.55, cx + 44.5, y + 0.72, cz + s * 16.5);
    addBox(w3Gold, 0.38, 0.38, 0.38, cx + 44.5, y + 1.65, cz + s * 16.5);
  }

  // 526–533, 557, 559–560: Ngọ Môn veranda balustrades, bastion battlements, Trụ Biểu obelisks, Hộ Thành Hà outer moat bridge, Kỳ Đài & Cửu Vị Thần Công
  for (const s of [-1, 1]) {
    // 526–528: Ngọ Môn upper balustrade, bastion battlements & forecourt Trụ Biểu obelisks
    addBox(w3Crimson, 0.24, 0.85, 12.5, nmX + 1.6, y + 5.85, cz + s * 10.5);
    addBox(w3Brick, 1.15, 1.05, 8.5, nmX + 4.4, y + 5.25, cz + s * 22.0);
    addBox(w3Stone, 0.72, 4.6, 0.72, nmX + 8.5, y + 2.30, cz + s * 7.8);
    w3Gold.push(new THREE.ConeGeometry(0.45, 0.65, 5).translate(nmX + 8.5, y + 4.92, cz + s * 7.8));
    // 529–530: Hộ Thành Hà outer moat stone bridge parapet walls & cutwater piers (nmX + 18, cz)
    addBox(w3Stone, 12.5, 0.92, 0.42, nmX + 18.0, y + 0.85, cz + s * 4.2);
    addCyl(w3Stone, 0.62, 0.78, 1.85, 5, nmX + 18.0, y - 0.15, cz + s * 4.8);
    // 531–533: Kỳ Đài corner watch-boxes, Cửu Vị Thần Công corner plinths & forecourt banner stands
    addBox(w3Brick, 2.2, 2.0, 2.2, kdX - 6.8, y + 1.0, cz + s * 8.2);
    addBox(w3Stone, 1.65, 0.45, 8.4, nmX + 19.0, y + 0.22, cz + s * 24.0);
    addCyl(w3Bronze, 0.06, 0.08, 3.2, 5, nmX - 11.5, y + 1.60, cz + s * 5.2);
    addBox(w3Gold, 0.12, 0.85, 0.45, nmX - 11.5, y + 2.75, cz + s * 5.2);
    // 559–560: Kỳ Đài forecourt stone benches & outer Hoàng Thành defensive bollards
    addBox(w3Stone, 1.85, 0.46, 0.55, kdX + 9.5, y + 0.23, cz + s * 6.5);
    addCyl(w3Stone, 0.22, 0.28, 0.92, 5, compX + compHalfX + 6.5, y + 0.46, cz + s * (compHalfZ + 6.5));
  }
  addBox(w3Stone, 12.5, 0.62, 8.2, nmX + 18.0, y + 0.31, cz);
  // 532: Kỳ Đài Tier-3 bronze flagpole collar rings
  addCyl(w3Bronze, 0.48, 0.55, 0.85, 6, kdX, y + 10.6, cz);

  // 534–556: Thế Miếu, Hiển Lâm Các, Duyệt Thị Đường, Thái Bình Lâu, Điện Kiến Trung, Cung Diên Thọ, Cung Trường Sanh, Vườn Cơ Hạ, Thái/Triệu Miếu & Phủ Nội Vụ
  // 534–537: Thế Miếu Bình Phong behind Hiển Lâm Các, Cửu Đỉnh terrace curbs & Hiển Lâm Các ground columns + flush ridge finial (ridgeTopY - 0.05!)
  addBox(w3Stone, 0.48, 2.35, 5.2, cx + 11.5, y + 1.18, swZ + 18.0);
  addBox(w3Stone, 1.45, 0.24, 24.0, cx + 6.2, y + 0.12, swZ);
  for (const hxO of [-2.4, 2.4]) {
    for (const hzO of [-3.0, 3.0]) {
      addCyl(w3Crimson, 0.14, 0.16, 4.2, 6, cx + 18.0 + hxO, y + 2.45, swZ + 18.0 + hzO);
    }
  }
  w3Gold.push(new THREE.ConeGeometry(0.34, 0.82, 5).translate(cx + 18.0, y + 9.48, swZ + 18.0));
  // 538–539: Duyệt Thị Đường theater courtyard stone border, red-silk lanterns & ticket pavilion counter
  addBox(w3Stone, 14.5, 0.20, 14.5, dtdX + 10.5, y + 0.10, dtdZ);
  addBox(w3Wood, 1.45, 1.05, 2.6, dtdX + 15.2, y + 0.52, dtdZ + 4.8);
  addBox(w3Gold, 0.28, 0.42, 0.28, dtdX + 6.6, y + 3.85, dtdZ - 2.8);
  addBox(w3Gold, 0.28, 0.42, 0.28, dtdX + 6.6, y + 3.85, dtdZ + 2.8);
  // 540–541: Thái Bình Lâu porcelain-mosaic ridge crest (seated flush at y + 6.72 on roof top y + 6.75!) & lakeside stone lanterns
  addBox(w3Porcelain, 0.32, 0.42, 5.4, cx - 76.0, y + 6.72, cz - 14.0);
  addBox(w3Stone, 0.48, 1.35, 0.48, cx - 66.5, y + 0.68, cz - 14.0);
  // 542–544: Điện Kiến Trung Art-Deco pilasters, roof parapet balustrades & parterre fountain finial
  for (const s of [-1, 1]) {
    addBox(w3Stone, 0.48, 4.2, 0.48, ktX + 6.8, y + 2.10, cz + s * 6.5);
    addBox(w3Stone, 1.65, 0.46, 0.52, ktX + 14.5, y + 0.23, cz + s * 3.8);
  }
  addBox(w3Stone, 0.42, 0.78, 18.0, ktX + 6.5, y + 7.85, cz);
  addCyl(w3Gold, 0.22, 0.35, 1.15, 6, ktX + 14.5, y + 0.95, cz);
  // 545–548: Cung Diên Thọ water pavilion pilings & Bình Phong + Cung Trường Sanh bridge balustrades & Đôn Sứ tea set
  for (const pxO of [-1.8, 1.8]) {
    for (const pzO of [-1.8, 1.8]) {
      addCyl(w3Wood, 0.11, 0.13, 2.2, 5, cx - 58.0 + pxO, y + 0.45, swZ + 14.5 + pzO);
    }
  }
  addBox(w3Stone, 0.45, 2.15, 4.4, cx - 50.0, y + 1.08, swZ + 14.5);
  addBox(w3Stone, 0.24, 0.72, 9.5, cx - 82.8, y + 1.05, cz + 56.0);
  addBox(w3Stone, 0.24, 0.72, 9.5, cx - 81.2, y + 1.05, cz + 56.0);
  addCyl(w3Stone, 0.62, 0.62, 0.72, 6, cx - 77.5, y + 0.36, cz + 56.0);
  addCyl(w3Porcelain, 0.22, 0.20, 0.46, 5, cx - 76.4, y + 0.23, cz + 56.0);
  addCyl(w3Porcelain, 0.22, 0.20, 0.46, 5, cx - 78.6, y + 0.23, cz + 56.0);
  // 549–551: Vườn Cơ Hạ moon-bridge rails, Tạ Thưởng Trà deck/benches & lakeside stone lanterns
  addBox(w3Stone, 0.24, 0.72, 7.6, cx - 74.5, y + 0.85, cz - 53.0);
  addCyl(w3Wood, 2.65, 2.65, 0.28, 6, cx - 82.0, y + 0.22, cz - 53.0);
  addBox(w3Stone, 0.48, 1.25, 0.48, cx - 78.0, y + 0.62, cz - 48.0);
  // 552–556: Thái/Triệu Miếu stairs, Phủ Nội Vụ brick gateway arch, cardinal gate mosaic trims & bastion watch-turret landings
  addBox(w3Stone, 2.2, 0.65, 3.6, cx + 4.8, y + 0.32, seZ);
  addBox(w3Brick, 0.75, 3.4, 4.8, cx - 32.0, y + 1.70, seZ + 12.0);
  addBox(w3Terracotta, 1.15, 0.42, 5.2, cx - 32.0, y + 3.55, seZ + 12.0);
  addBox(w3Porcelain, 0.55, 0.65, 4.4, compX - compHalfX - 1.2, y + 4.2, cz);
  addBox(w3Stone, 2.6, 0.55, 2.6, compX + compHalfX + 4.0, y + 0.28, cz - (compHalfZ + 7.2));
  addBox(w3Stone, 2.6, 0.55, 2.6, compX + compHalfX + 4.0, y + 0.28, cz + (compHalfZ + 7.2));

  addMerged(w3Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w3Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w3Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w3Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w3Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w3Wood, ctx.materials.darkWood, false, true);
  addMerged(w3YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w3JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w3Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w3Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 4 UPGRADES (Items 881–897, 902–960): Tứ Phương Vô Sự Lầu, Điện Phụng
  // Tiên, Lục Viện, Trường Lang West Wing, Điện Thọ Ninh, Moat Barge & Bastions
  // ==========================================================================
  const w4Stone: THREE.BufferGeometry[] = [];
  const w4Brick: THREE.BufferGeometry[] = [];
  const w4Crimson: THREE.BufferGeometry[] = [];
  const w4Gold: THREE.BufferGeometry[] = [];
  const w4Bronze: THREE.BufferGeometry[] = [];
  const w4Wood: THREE.BufferGeometry[] = [];
  const w4YellowRoof: THREE.BufferGeometry[] = [];
  const w4JadeRoof: THREE.BufferGeometry[] = [];
  const w4Terracotta: THREE.BufferGeometry[] = [];
  const w4Porcelain: THREE.BufferGeometry[] = [];

  // 881–884: Tứ Phương Vô Sự Lầu (2-Story Imperial Belvedere Pavilion atop rear rampart, compX - compHalfX, cz + 26)
  const tpX = compX - compHalfX;
  const tpZ = cz + 26.0;
  addBox(w4Stone, 9.6, 0.72, 11.4, tpX, y + 4.12, tpZ);
  addBox(w4Brick, 7.6, 3.2, 9.2, tpX, y + 6.08, tpZ);
  addBox(w4YellowRoof, 9.2, 0.95, 10.8, tpX, y + 8.05, tpZ);
  addBox(w4Crimson, 5.8, 2.55, 7.2, tpX, y + 9.75, tpZ);
  addBox(w4YellowRoof, 7.2, 1.15, 8.6, tpX, y + 11.45, tpZ);
  addBox(w4Gold, 0.28, 0.30, 6.2, tpX, y + 12.12, tpZ);

  // 885–888: Điện Phụng Tiên memorial temple terrace in SW precinct (cx - 25, cz + 70 — clear of Hưng Miếu & wall!)
  const ptX = cx - 25.0;
  const ptZ = cz + 70.0;
  addBox(w4Stone, 10.6, 0.85, 9.2, ptX, y + 0.425, ptZ);
  addBox(w4Crimson, 7.8, 3.4, 7.2, ptX - 0.5, y + 2.55, ptZ);
  for (let b = -2; b <= 2; b++) {
    addCyl(w4Crimson, 0.13, 0.15, 3.55, 6, ptX + 4.2, y + 2.55, ptZ + b * 1.65);
  }
  addBox(w4YellowRoof, 10.2, 1.05, 8.8, ptX, y + 4.65, ptZ);
  addBox(w4Gold, 0.26, 0.28, 6.8, ptX, y + 5.26, ptZ);
  addBox(w4Brick, 0.48, 2.15, 3.8, ptX + 6.8, y + 1.08, ptZ);
  addCyl(w4Bronze, 0.34, 0.26, 0.68, 6, ptX + 5.6, y + 0.42, ptZ - 2.2);
  addCyl(w4Bronze, 0.34, 0.26, 0.68, 6, ptX + 5.6, y + 0.42, ptZ + 2.2);

  // 889–890: Lục Viện (Six Imperial Concubines' Courtyard Pavilion at cx - 72, cz + 14.5)
  const lvX = cx - 72.0;
  const lvZ = cz + 14.5;
  addBox(w4Stone, 8.6, 0.65, 7.4, lvX, y + 0.325, lvZ);
  addBox(w4Crimson, 6.8, 3.1, 5.8, lvX, y + 2.20, lvZ);
  addBox(w4JadeRoof, 8.2, 0.95, 7.2, lvX, y + 4.15, lvZ);
  addCyl(w4Stone, 1.15, 1.25, 0.42, 6, lvX + 5.8, y + 0.22, lvZ);

  // 891–897, 902–920: Cần Chánh dais & side stairs, Càn Thành side pavilions, Đại Cung Môn lanterns, Sân Đại Triều Nghi canopies,
  // Trường Lang west gallery to Kiến Trung, Kiến Trung rear balcony & parterres, Thái Bình Lâu grotto, Cung Diên Thọ Điện Thọ Ninh & Cung Trường Sanh Thủy Tạ
  addBox(w4Gold, 2.2, 0.55, 3.2, ccW3X - 1.5, ccFloorY + 0.32, cz);
  addBox(w4Stone, 1.8, 0.72, 2.6, ctX - 5.8, y + 0.36, cz);
  addBox(w4Gold, 0.16, 0.62, 2.8, dcmX - 1.88, y + 3.95, cz);
  for (const s of [-1, 1]) {
    // 892–893: Cần Chánh mounting blocks & side stairs
    addBox(w4Stone, 1.05, 0.48, 0.62, ccW3X + 9.2, y + 0.24, cz + s * 5.8);
    addBox(w4Stone, 2.4, 0.85, 1.65, ccW3X, y + 0.42, cz + s * 10.8);
    // 894: Càn Thành flanking Tả/Hữu Tương side pavilions
    addBox(w4Crimson, 4.6, 2.8, 3.6, ctX, y + 1.55, cz + s * 9.6);
    addBox(w4JadeRoof, 5.2, 0.65, 4.2, ctX, y + 3.18, cz + s * 9.6);
    // 902–903: Sân Thượng incense pedestals & Sân Hạ Nhã Nhạc performance canopies (4 grounded posts + roof!)
    addCyl(w4Stone, 0.42, 0.48, 0.85, 6, stairXTop - 1.4, sanThuongY + 0.42, cz + s * 5.2);
    const nnX = cx + 26.0;
    const nnZ = cz + s * 17.5;
    addBox(w4Crimson, 3.6, 0.22, 3.6, nnX, sanHaY + 2.85, nnZ);
    for (const pxO of [-1.55, 1.55]) {
      for (const pzO of [-1.55, 1.55]) {
        addCyl(w4Crimson, 0.08, 0.09, 2.95, 5, nnX + pxO, sanHaY + 1.42, nnZ + pzO);
      }
    }
    // 905–906: Tả/Hữu Vu plaques & rear stone wells
    addBox(w4Gold, 0.16, 0.58, 2.4, cx - 41.2, y + 3.95, cz + s * 19.5);
    addCyl(w4Stone, 0.65, 0.72, 0.78, 6, cx - 58.0, y + 0.39, cz + s * 20.5);
    // 907–908: Trường Lang west gallery linking Càn Thành to Kiến Trung (grounded columns + jade roof!)
    const wgZ = cz + s * 11.5;
    addBox(w4Stone, 11.0, 0.42, 2.8, cx - 80.5, y + 0.21, wgZ);
    for (let k = 0; k < 4; k++) {
      addCyl(w4Crimson, 0.11, 0.13, 3.25, 5, cx - 76.2 - k * 2.8, y + 1.88, wgZ - 1.0);
      addCyl(w4Crimson, 0.11, 0.13, 3.25, 5, cx - 76.2 - k * 2.8, y + 1.88, wgZ + 1.0);
    }
    addBox(w4JadeRoof, 11.6, 0.62, 3.4, cx - 80.5, y + 3.68, wgZ);
    // 910: Kiến Trung formal parterre curbs & urns
    addBox(w4Stone, 4.6, 0.35, 3.8, ktX + 8.5, y + 0.18, cz + s * 12.5);
    // 914: Duyệt Thị Đường guardian plinths
    addBox(w4Stone, 0.85, 0.78, 0.85, dtdX + 8.5, y + 0.39, dtdZ + s * 4.5);
  }
  // 909 & 911: Kiến Trung rear balcony & courtyard sundial
  addBox(w4Stone, 2.4, 0.45, 9.2, ktX - 6.8, y + 4.35, cz);
  addCyl(w4Gold, 0.42, 0.48, 0.95, 6, ktX + 18.2, y + 0.48, cz);
  // 916–918: Cung Diên Thọ Điện Thọ Ninh rear prayer pavilion (cx - 69, cz + 56) & Cung Trường Sanh octagonal Thủy Tạ gazebo (cx - 82, cz + 43)
  addBox(w4Stone, 7.6, 0.65, 8.2, cx - 69.0, y + 0.325, cz + 56.0);
  addBox(w4Crimson, 6.0, 3.1, 6.6, cx - 69.0, y + 2.20, cz + 56.0);
  addBox(w4JadeRoof, 7.4, 0.92, 8.0, cx - 69.0, y + 4.15, cz + 56.0);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w4Crimson, 0.10, 0.12, 3.05, 5, cx - 82.0 + Math.cos(a) * 2.2, y + 1.55, cz + 43.0 + Math.sin(a) * 2.2);
  }
  w4JadeRoof.push(new THREE.ConeGeometry(3.2, 1.55, 6).translate(cx - 82.0, y + 3.72, cz + 43.0));

  // 921–960: Moat bridge cutwaters & lanterns, Ngọ Môn bastion cannons, Hộ Thành Hà dragon barge, Kỳ Đài stairs & cannons,
  // Thế Miếu Tả/Hữu Tùng Tự, Phủ Nội Vụ well canopy, Vườn Cơ Hạ boat deck, NW/SW bastion turrets & perimeter lanterns
  for (const s of [-1, 1]) {
    // 921–922: Cầu Kim Thủy cutwater piers & corner lantern pillars
    addCyl(w4Stone, 0.55, 0.72, 1.85, 5, cx + 38.0, y - 0.15, cz + s * 26.0);
    addBox(w4Stone, 0.48, 1.45, 0.48, cx + 32.5, y + 0.72, cz + s * 28.0);
    addBox(w4Gold, 0.36, 0.36, 0.36, cx + 32.5, y + 1.62, cz + s * 28.0);
    // 925: Ngọ Môn bastion defense cannons (4 cannons)
    addCyl(w4Bronze, 0.14, 0.20, 2.2, 6, nmX + 4.5, y + 5.15, cz + s * 18.5, 0, Math.PI * 0.5);
    addCyl(w4Bronze, 0.14, 0.20, 2.2, 6, nmX + 4.5, y + 5.15, cz + s * 24.5, 0, Math.PI * 0.5);
    // 927 & 955: Hộ Thành Hà quay landing steps & bridge lamp standards
    addBox(w4Stone, 2.4, 0.55, 4.2, nmX + 12.2, y + 0.28, cz + s * 7.2);
    addCyl(w4Bronze, 0.06, 0.08, 3.2, 5, nmX + 18.0, y + 1.85, cz + s * 4.2);
    addBox(w4Gold, 0.28, 0.34, 0.28, nmX + 18.0, y + 3.55, cz + s * 4.2);
    // 930 & 932: Kỳ Đài Tier-2 salute cannons & Cửu Vị Thần Công rear brick screen walls
    addCyl(w4Bronze, 0.14, 0.20, 1.85, 6, kdX - 4.6, y + 5.45, cz + s * 2.8, 0, Math.PI * 0.5);
    addBox(w4Brick, 0.52, 2.6, 10.6, nmX + 22.8, y + 1.30, cz + s * 24.0);
    // 948: Hoàng Thành NW & SW corner brick bastion watch-turrets with flush terracotta roofs
    addBox(w4Brick, 4.4, 3.4, 4.4, compX - compHalfX - 4.0, y + 2.0, cz + s * (compHalfZ + 4.0));
    w4Terracotta.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(compX - compHalfX - 4.0, y + 4.45, cz + s * (compHalfZ + 4.0)));
    // 951 & 954: Outer Kỳ Đài Trụ Biểu obelisks & Tử Cấm Thành ceramic Chữ Thọ medallions
    addBox(w4Stone, 0.72, 4.4, 0.72, kdX + 11.5, y + 2.20, cz + s * 7.2);
    w4Gold.push(new THREE.ConeGeometry(0.42, 0.62, 5).translate(kdX + 11.5, y + 4.72, cz + s * 7.2));
    addBox(w4Porcelain, 0.68, 0.68, 0.78, cx - 44.0, y + 1.85, cz + s * 28.5);
    addBox(w4Porcelain, 0.68, 0.68, 0.78, cx - 64.0, y + 1.85, cz + s * 28.5);
  }
  // 928: Hộ Thành Hà floating imperial Thuyền Rồng ceremonial dragon barge (nmX + 18, cz - 18)
  addBox(w4Wood, 2.6, 0.55, 8.6, nmX + 18.0, y + 0.35, cz - 18.0);
  addBox(w4Crimson, 2.1, 1.45, 5.2, nmX + 18.0, y + 1.32, cz - 18.0);
  addBox(w4YellowRoof, 2.5, 0.45, 5.8, nmX + 18.0, y + 2.25, cz - 18.0);
  addBox(w4Gold, 0.55, 0.85, 1.15, nmX + 18.0, y + 1.25, cz - 13.4);
  // 935 & 938: Thế Miếu Tả Tùng Tự wing & Thái Miếu connecting brick gate-arch
  addBox(w4Crimson, 8.2, 3.2, 4.6, cx - 7.0, y + 1.85, cz + 71.0);
  addBox(w4Terracotta, 9.2, 0.85, 5.6, cx - 7.0, y + 3.85, cz + 71.0);
  addBox(w4Brick, 1.15, 3.6, 4.8, cx - 16.0, y + 1.80, seZ);
  addBox(w4Terracotta, 1.85, 0.65, 5.6, cx - 16.0, y + 3.88, seZ);
  // 941 & 943: Phủ Nội Vụ wellhead canopy (4 posts) & Vườn Cơ Hạ lakeside boat deck
  addCyl(w4Stone, 0.85, 0.95, 0.78, 6, cx - 52.0, y + 0.39, seZ - 4.0);
  for (const wxO of [-1.1, 1.1]) {
    for (const wzO of [-1.1, 1.1]) {
      addCyl(w4Crimson, 0.08, 0.09, 2.65, 5, cx - 52.0 + wxO, y + 1.32, seZ - 4.0 + wzO);
    }
  }
  w4Terracotta.push(new THREE.ConeGeometry(2.1, 1.05, 4).rotateY(Math.PI * 0.25).translate(cx - 52.0, y + 3.05, seZ - 4.0));
  addBox(w4Wood, 3.6, 0.24, 5.2, cx - 71.5, y + 0.42, cz - 53.0);

  addMerged(w4Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w4Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w4Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w4Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w4Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w4Wood, ctx.materials.darkWood, false, true);
  addMerged(w4YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w4JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w4Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w4Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 5 UPGRADES (Items 1281–1292, 1297–1360): Thế Miếu & Cửu Đỉnh Bronze
  // Tripods & Glazed Ceramic Bình Phong Screens, Vườn Cơ Hạ Royal Garden
  // Pavilion & Moon-Bridge, Moat Footbridges & Citadel Bastion Details
  // ==========================================================================
  const w5Stone: THREE.BufferGeometry[] = [];
  const w5Brick: THREE.BufferGeometry[] = [];
  const w5Crimson: THREE.BufferGeometry[] = [];
  const w5Gold: THREE.BufferGeometry[] = [];
  const w5Bronze: THREE.BufferGeometry[] = [];
  const w5Wood: THREE.BufferGeometry[] = [];
  const w5YellowRoof: THREE.BufferGeometry[] = [];
  const w5JadeRoof: THREE.BufferGeometry[] = [];
  const w5Terracotta: THREE.BufferGeometry[] = [];
  const w5Porcelain: THREE.BufferGeometry[] = [];

  // 1281–1288: Thế Miếu glazed cobalt-ceramic Bình Phong, Cửu Đỉnh bronze tripod censers & twin Nhà Bia stele pavilions
  addBox(w5Stone, 0.72, 0.42, 5.6, cx + 14.5, y + 0.21, swZ);
  addBox(w5Porcelain, 0.46, 2.25, 4.8, cx + 14.5, y + 1.52, swZ);
  addBox(w5Gold, 0.24, 0.32, 4.4, cx + 14.5, y + 2.78, swZ);
  // 1284: 3 antique bronze tripod censers flanking Cửu Đỉnh
  for (const bzO of [-8.0, 0.0, 8.0]) {
    addBox(w5Stone, 1.05, 0.35, 1.05, cx + 8.5, y + 0.18, swZ + bzO);
    addCyl(w5Bronze, 0.38, 0.28, 0.78, 6, cx + 8.5, y + 0.72, swZ + bzO);
  }
  // 1285–1288: Twin Nhà Bia royal stele pavilions (4 grounded crimson columns + flush jade hip roof) & guardian plinths
  for (const s of [-1, 1]) {
    const nbX = cx + 11.5;
    const nbZ = swZ + s * 13.5;
    addBox(w5Stone, 3.8, 0.45, 3.8, nbX, y + 0.225, nbZ);
    for (const ox of [-1.4, 1.4]) {
      for (const oz of [-1.4, 1.4]) {
        addCyl(w5Crimson, 0.10, 0.12, 3.05, 5, nbX + ox, y + 1.75, nbZ + oz);
      }
    }
    w5JadeRoof.push(new THREE.ConeGeometry(2.95, 1.45, 4).rotateY(Math.PI * 0.25).translate(nbX, y + 3.88, nbZ));
    addBox(w5Stone, 0.42, 1.85, 0.95, nbX, y + 1.35, nbZ);
    addBox(w5Stone, 0.92, 0.85, 0.92, cx + 16.5, y + 0.425, swZ + s * 3.8);
  }

  // 1289–1292: Sân Đại Triều Nghi twin bronze Vạc Đồng cauldrons, Sân Thượng incense braziers, Phẩm Sơn steles & Tán Lọng
  for (const s of [-1, 1]) {
    addBox(w5Stone, 1.45, 0.42, 1.45, stairXTop + 2.8, sanThuongY + 0.21, cz + s * 8.5);
    addCyl(w5Bronze, 0.58, 0.46, 0.88, 6, stairXTop + 2.8, sanThuongY + 0.85, cz + s * 8.5);
    addCyl(w5Gold, 0.28, 0.22, 0.65, 6, stairXTop - 1.2, sanThuongY + 0.72, cz + s * 9.8);
    // 1291: 3 additional Phẩm Sơn mandarin rank steles on Sân Hạ
    for (let ps = 0; ps < 3; ps++) {
      addBox(w5Stone, 0.34, 1.15, 0.48, cx + 22.0 + ps * 3.2, sanHaY + 0.58, cz + s * 7.8);
    }
    // 1292: Tán Lọng ceremonial umbrella stands
    addCyl(w5Crimson, 0.05, 0.06, 3.2, 5, cx + 29.0, sanHaY + 1.60, cz + s * 4.5);
    w5Gold.push(new THREE.ConeGeometry(0.65, 0.48, 6).translate(cx + 29.0, sanHaY + 3.35, cz + s * 4.5));
  }

  // 1297–1320: Cung Diên Thọ & Trường Sanh screens/bridge/chess set, Kiến Trung fountain, Duyệt Thị Đường loggia,
  // Tả/Hữu Vu glazed Bình Phong, Cần Chánh tripods & Lục Viện garden pavilion
  addBox(w5Porcelain, 0.42, 2.05, 3.8, cx - 62.5, y + 1.02, cz + 56.0);
  // 1298: Cung Diên Thọ covered garden bridge (4 grounded columns + flush jade roof)
  addBox(w5Wood, 2.6, 0.26, 6.2, cx - 58.0, y + 0.42, swZ + 6.5);
  addBox(w5JadeRoof, 3.0, 0.45, 6.6, cx - 58.0, y + 3.35, swZ + 6.5);
  for (const ox of [-1.1, 1.1]) {
    for (const oz of [-2.6, 2.6]) {
      addCyl(w5Crimson, 0.09, 0.11, 3.05, 5, cx - 58.0 + ox, y + 1.80, swZ + 6.5 + oz);
    }
  }
  // 1301–1302: Cung Trường Sanh stone chess table, 4 porcelain Đôn Sứ & ceramic garden Bình Phong
  addCyl(w5Stone, 0.65, 0.65, 0.72, 6, cx - 75.5, y + 0.36, cz + 43.0);
  for (const [dx, dz] of [[-1.1, 0], [1.1, 0], [0, -1.1], [0, 1.1]] as const) {
    addCyl(w5Porcelain, 0.22, 0.20, 0.46, 5, cx - 75.5 + dx, y + 0.23, cz + 43.0 + dz);
  }
  addBox(w5Porcelain, 0.42, 1.95, 3.4, cx - 75.5, y + 0.98, cz + 47.5);
  // 1305–1308: Kiến Trung mosaic piers, east octagonal fountain & rear benches
  addCyl(w5Stone, 2.1, 2.25, 0.48, 6, ktX + 16.5, y + 0.24, cz + 7.5);
  addCyl(w5Gold, 0.26, 0.34, 1.05, 6, ktX + 16.5, y + 0.85, cz + 7.5);
  // 1311–1312: Duyệt Thị Đường exterior 4-column ticket loggia + bronze gong stand
  addBox(w5Terracotta, 3.6, 0.45, 4.4, dtdX + 12.5, y + 3.25, dtdZ - 5.2);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.8, 1.8]) {
      addCyl(w5Crimson, 0.09, 0.11, 3.25, 5, dtdX + 12.5 + ox, y + 1.55, dtdZ - 5.2 + oz);
    }
  }
  addCyl(w5Bronze, 0.42, 0.42, 0.08, 6, dtdX + 9.2, y + 1.35, dtdZ, Math.PI * 0.5);
  // 1313–1318: Tả/Hữu Vu glazed Bình Phong, Cần Chánh rear tripods & Lục Viện garden pavilion (4 posts + flush jade hip roof)
  for (const s of [-1, 1]) {
    addBox(w5Porcelain, 0.42, 1.95, 3.6, cx - 37.5, y + 0.98, cz + s * 19.5);
    addCyl(w5Bronze, 0.34, 0.26, 0.72, 6, ccW3X - 7.5, y + 0.36, cz + s * 3.8);
  }
  const lvPavX = lvX + 7.5;
  const lvPavZ = lvZ + 6.5;
  addBox(w5Stone, 3.8, 0.42, 3.8, lvPavX, y + 0.21, lvPavZ);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w5Crimson, 0.09, 0.11, 2.95, 5, lvPavX + ox, y + 1.65, lvPavZ + oz);
    }
  }
  w5JadeRoof.push(new THREE.ConeGeometry(2.9, 1.4, 4).rotateY(Math.PI * 0.25).translate(lvPavX, y + 3.72, lvPavZ));

  // 1321–1328: Vườn Cơ Hạ Royal Garden Precinct (cx - 86, cz - 42): Hexagonal Đình pavilion, moon-bridge, Hòn Non Bộ,
  // glazed ceramic Bình Phong, stone garden archway & lotus pool curb
  const chX = cx - 86.0;
  const chZ = cz - 42.0;
  addCyl(w5Stone, 3.4, 3.6, 0.52, 6, chX, y + 0.26, chZ);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w5Crimson, 0.10, 0.12, 3.15, 5, chX + Math.cos(a) * 2.4, y + 1.85, chZ + Math.sin(a) * 2.4);
  }
  w5JadeRoof.push(new THREE.ConeGeometry(3.5, 1.75, 6).translate(chX, y + 4.18, chZ));
  w5Gold.push(new THREE.ConeGeometry(0.28, 0.62, 5).translate(chX, y + 5.25, chZ));
  // 1323–1326: Moon-bridge, Hòn Non Bộ limestone rockery, ceramic Bình Phong & stone archway with flush yellow tile cap
  addBox(w5Stone, 2.4, 0.36, 6.4, chX + 6.2, y + 0.78, chZ);
  addBox(w5Stone, 0.22, 0.72, 6.4, chX + 5.1, y + 1.25, chZ);
  addBox(w5Stone, 0.22, 0.72, 6.4, chX + 7.3, y + 1.25, chZ);
  addCyl(w5Stone, 1.35, 2.15, 2.65, 6, chX + 6.2, y + 1.25, chZ - 6.2);
  addBox(w5Porcelain, 0.42, 2.05, 3.6, chX + 11.2, y + 1.02, chZ);
  addBox(w5Stone, 0.92, 3.2, 0.92, chX + 14.5, y + 1.60, chZ - 2.2);
  addBox(w5Stone, 0.92, 3.2, 0.92, chX + 14.5, y + 1.60, chZ + 2.2);
  addBox(w5YellowRoof, 1.85, 0.65, 5.8, chX + 14.5, y + 3.45, chZ);

  // 1329–1360: Cầu Trung Đạo finials, Hồ Thái Dịch lotus islets, East/West moat stone-arch footbridges,
  // Ngọ Môn Hạ Mã stele, Kỳ Đài guard pavilion, Cardinal gate mosaic spandrels, Thái/Triệu Miếu & Phủ Nội Vụ
  for (const s of [-1, 1]) {
    // 1330: Hồ Thái Dịch lotus islet rockeries
    addCyl(w5Stone, 1.85, 2.25, 0.65, 6, cx + 38.0, y + 0.15, cz + s * 14.5);
    // 1331–1332: East & West Hộ Thành Hà moat stone-arch footbridges
    addBox(w5Stone, 9.6, 0.48, 3.2, nmX + 18.0, y + 0.85, cz + s * 36.0);
    addBox(w5Stone, 9.6, 0.75, 0.26, nmX + 18.0, y + 1.42, cz + s * 36.0 - 1.45);
    addBox(w5Stone, 9.6, 0.75, 0.26, nmX + 18.0, y + 1.42, cz + s * 36.0 + 1.45);
    addCyl(w5Stone, 0.55, 0.68, 1.95, 5, nmX + 18.0, y - 0.10, cz + s * 36.0);
    // 1334 & 1337: Bridge-head lantern pillars & Ngọ Môn Hạ Mã stele
    addBox(w5Stone, 0.48, 1.55, 0.48, nmX + 12.8, y + 0.78, cz + s * 36.0);
    addBox(w5Gold, 0.34, 0.36, 0.34, nmX + 12.8, y + 1.72, cz + s * 36.0);
    // 1340, 1345–1346: Cửu Vị Thần Công nameplates, rampart sentry alcoves & bastion flagstaffs
    addBox(w5Gold, 0.24, 0.95, 0.65, nmX + 21.5, y + 0.65, cz + s * 20.5);
    addBox(w5Brick, 2.2, 2.4, 2.2, compX - 24.0, y + 4.4, cz + s * compHalfZ);
    addCyl(w5Crimson, 0.08, 0.10, 6.2, 5, compX - compHalfX - 4.0, y + 6.8, cz + s * (compHalfZ + 4.0));
    w5Gold.push(new THREE.ConeGeometry(0.22, 0.55, 5).translate(compX - compHalfX - 4.0, y + 10.1, cz + s * (compHalfZ + 4.0)));
    // 1360: Gilded bronze courtyard lamp standards lining main imperial avenue
    addCyl(w5Bronze, 0.06, 0.08, 3.1, 5, cx + 10.0, y + 1.55, cz + s * 10.5);
    addBox(w5Gold, 0.26, 0.32, 0.26, cx + 10.0, y + 3.25, cz + s * 10.5);
  }
  // 1338: Kỳ Đài lower terrace 4-column crimson flag-guard sentry pavilion with flush terracotta roof
  const kgX = kdX - 10.5;
  const kgZ = cz - 10.5;
  addBox(w5Stone, 3.8, 0.42, 3.8, kgX, y + 0.21, kgZ);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w5Crimson, 0.09, 0.11, 2.85, 5, kgX + ox, y + 1.62, kgZ + oz);
    }
  }
  w5Terracotta.push(new THREE.ConeGeometry(2.8, 1.35, 4).rotateY(Math.PI * 0.25).translate(kgX, y + 3.65, kgZ));
  // 1347–1356: Tứ Phương Vô Sự Lầu Bình Phong, Thái Miếu Bình Phong & tripod, Phủ Nội Vụ 4-post ledger pavilion
  addBox(w5Porcelain, 0.42, 1.85, 3.4, tpX + 4.8, y + 5.2, tpZ);
  addBox(w5Porcelain, 0.42, 2.05, 3.8, cx + 8.5, y + 1.02, seZ);
  addCyl(w5Bronze, 0.34, 0.26, 0.72, 6, cx + 6.5, y + 0.36, seZ);
  const pnvX = cx - 42.0;
  const pnvZ = seZ + 8.5;
  addBox(w5Stone, 4.2, 0.38, 3.6, pnvX, y + 0.19, pnvZ);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w5Crimson, 0.08, 0.10, 2.85, 5, pnvX + ox, y + 1.55, pnvZ + oz);
    }
  }
  addBox(w5Terracotta, 4.6, 0.48, 4.0, pnvX, y + 3.12, pnvZ);
  // 1355: Điện Phụng Tiên twin porcelain urns
  addCyl(w5Porcelain, 0.32, 0.24, 0.65, 6, ptX + 6.2, y + 0.35, ptZ - 3.6);
  addCyl(w5Porcelain, 0.32, 0.24, 0.65, 6, ptX + 6.2, y + 0.35, ptZ + 3.6);

  addMerged(w5Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w5Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w5Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w5Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w5Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w5Wood, ctx.materials.darkWood, false, true);
  addMerged(w5YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w5JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w5Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w5Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 6 UPGRADES (Items 1681–1712, 1718–1760): East Moat Royal Boat Landing
  // Pavilion, Outer Cổng Thượng Tứ Gatehouse, Hiển Nhơn/Chương Đức Porcelain
  // Mosaics, NE Đình Tạ Thưởng Nguyệt & SE Lầu Tàng Thơ Courtyard Pavilions
  // ==========================================================================
  const w6Stone: THREE.BufferGeometry[] = [];
  const w6Brick: THREE.BufferGeometry[] = [];
  const w6Crimson: THREE.BufferGeometry[] = [];
  const w6Gold: THREE.BufferGeometry[] = [];
  const w6Bronze: THREE.BufferGeometry[] = [];
  const w6Wood: THREE.BufferGeometry[] = [];
  const w6YellowRoof: THREE.BufferGeometry[] = [];
  const w6JadeRoof: THREE.BufferGeometry[] = [];
  const w6Terracotta: THREE.BufferGeometry[] = [];
  const w6Porcelain: THREE.BufferGeometry[] = [];

  // 1681–1688: Bến Thuyền Ngự Hộ Thành Hà (East Moat Royal Boat Landing Pavilion at nmX + 24.5, cz - 26.0)
  const bnX = nmX + 24.5;
  const bnZ = cz - 26.0;
  addBox(w6Stone, 6.2, 0.58, 6.8, bnX, y + 0.29, bnZ);
  addBox(w6Stone, 6.2, 0.65, 0.26, bnX, y + 0.85, bnZ - 3.25);
  addBox(w6Stone, 6.2, 0.65, 0.26, bnX, y + 0.85, bnZ + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w6Crimson, 0.10, 0.12, 3.15, 4, bnX + ox, y + 1.98, bnZ + oz);
    }
  }
  w6YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(bnX, y + 4.22, bnZ));
  w6Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(bnX, y + 5.20, bnZ));
  addBox(w6Porcelain, 0.42, 1.95, 3.6, bnX + 3.6, y + 1.15, bnZ);
  for (const s of [-1, 1]) {
    addCyl(w6Bronze, 0.14, 0.18, 0.55, 5, bnX - 2.8, y + 0.82, bnZ + s * 2.2);
    addBox(w6Stone, 0.45, 1.45, 0.45, bnX + 2.8, y + 0.92, bnZ + s * 3.0);
    addBox(w6Gold, 0.30, 0.34, 0.30, bnX + 2.8, y + 1.82, bnZ + s * 3.0);
  }

  // 1689–1696: Cổng Thượng Tứ Ngoại Thành (Outer South-East Moat Gatehouse at nmX + 24.5, cz + 26.0)
  const ttGX = nmX + 24.5;
  const ttGZ = cz + 26.0;
  addBox(w6Stone, 5.2, 0.52, 7.2, ttGX, y + 0.26, ttGZ);
  addBox(w6Brick, 2.4, 3.6, 1.55, ttGX, y + 2.15, ttGZ - 2.2);
  addBox(w6Brick, 2.4, 3.6, 1.55, ttGX, y + 2.15, ttGZ + 2.2);
  addBox(w6Brick, 2.4, 1.15, 6.2, ttGX, y + 4.25, ttGZ);
  addBox(w6Terracotta, 3.8, 0.88, 7.6, ttGX, y + 5.22, ttGZ);
  addBox(w6Gold, 0.22, 0.26, 5.6, ttGX, y + 5.75, ttGZ);
  addBox(w6Gold, 0.16, 0.58, 2.6, ttGX + 1.28, y + 4.25, ttGZ);
  for (const s of [-1, 1]) {
    addBox(w6Porcelain, 0.24, 0.85, 1.15, ttGX + 1.25, y + 3.45, ttGZ + s * 2.0);
    addBox(w6Stone, 0.45, 1.35, 0.45, ttGX + 3.2, y + 0.68, ttGZ + s * 3.2);
    addCyl(w6Bronze, 0.06, 0.08, 3.0, 4, ttGX + 3.2, y + 1.50, ttGZ + s * 1.8);
    addBox(w6Gold, 0.26, 0.30, 0.26, ttGX + 3.2, y + 3.15, ttGZ + s * 1.8);
  }

  // 1697–1704: Cửa Hiển Nhơn (East) & Cửa Chương Đức (West) porcelain-mosaic upgrades
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ + 3.2);
    addBox(w6Porcelain, 3.6, 0.42, 0.45, compX, y + 6.45, gz);
    addBox(w6Porcelain, 3.8, 1.95, 0.42, compX, y + 1.02, cz + s * (compHalfZ - 4.8));
    addCyl(w6Bronze, 0.32, 0.24, 0.68, 5, compX - 2.4, y + 0.36, cz + s * (compHalfZ - 2.8));
    addCyl(w6Bronze, 0.32, 0.24, 0.68, 5, compX + 2.4, y + 0.36, cz + s * (compHalfZ - 2.8));
    addBox(w6Stone, 0.95, 0.48, 0.62, compX - 3.6, y + 0.24, gz);
  }

  // 1705–1712, 1718–1720: Thế Miếu/Hưng Miếu curbs, porcelain plinths, Vạc Đồng, Sân Hạ Tán Lọng & Đại Cung Môn censers
  for (const s of [-1, 1]) {
    addBox(w6Stone, 1.25, 0.35, 4.8, cx - 7.0, y + 0.18, cz + s * 66.5);
    addCyl(w6Porcelain, 0.34, 0.26, 0.68, 5, cx + 12.5, y + 0.36, swZ + s * 4.5);
    addCyl(w6Bronze, 0.52, 0.42, 0.82, 5, cx + 16.5, y + 0.42, swZ + s * 10.5);
    addCyl(w6Crimson, 0.05, 0.06, 3.2, 4, cx + 34.0, sanHaY + 1.60, cz + s * 4.5);
    w6Gold.push(new THREE.ConeGeometry(0.62, 0.46, 5).translate(cx + 34.0, sanHaY + 3.35, cz + s * 4.5));
    addCyl(w6Bronze, 0.34, 0.26, 0.72, 5, dcmX + 2.4, y + 0.36, cz + s * 3.4);
  }
  addBox(w6Porcelain, 0.42, 1.95, 3.6, cx - 18.0, y + 1.02, swZ + 12.5);
  addBox(w6Gold, 0.24, 0.28, 7.6, cx - 7.0, y + 4.38, cz + 71.0);

  // 1721–1728: Đình Tạ Thưởng Nguyệt (NE Royal Moon-Viewing Courtyard Pavilion at cx - 56.0, cz - 58.0)
  const tnX = cx - 56.0;
  const tnZ = cz - 58.0;
  addBox(w6Stone, 5.2, 0.48, 5.2, tnX, y + 0.24, tnZ);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w6Crimson, 0.10, 0.12, 3.15, 4, tnX + ox, y + 1.88, tnZ + oz);
    }
  }
  w6JadeRoof.push(new THREE.ConeGeometry(3.8, 1.65, 4).rotateY(Math.PI * 0.25).translate(tnX, y + 4.18, tnZ));
  w6Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(tnX, y + 5.22, tnZ));
  addCyl(w6Stone, 0.62, 0.62, 0.72, 5, tnX, y + 0.84, tnZ);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w6Porcelain, 0.20, 0.18, 0.44, 4, tnX + dx, y + 0.70, tnZ + dz);
  }
  addBox(w6Porcelain, 0.42, 1.95, 3.6, tnX + 4.4, y + 1.02, tnZ);
  addBox(w6Stone, 0.45, 1.35, 0.45, tnX - 2.2, y + 0.68, tnZ + 3.8);
  addBox(w6Stone, 0.45, 1.35, 0.45, tnX + 2.2, y + 0.68, tnZ + 3.8);

  // 1729–1736: Lầu Tàng Thơ Ngoại Viện (SE Royal Archive Courtyard Pavilion at cx - 28.0, cz - 62.0)
  const ltX = cx - 28.0;
  const ltZ = cz - 62.0;
  addBox(w6Stone, 8.8, 0.62, 7.4, ltX, y + 0.31, ltZ);
  addBox(w6Brick, 6.2, 3.2, 5.8, ltX - 0.8, y + 2.20, ltZ);
  addBox(w6Terracotta, 8.4, 0.92, 7.2, ltX, y + 4.22, ltZ);
  addBox(w6Gold, 0.24, 0.26, 5.4, ltX, y + 4.78, ltZ);
  for (const oz of [-2.4, -0.8, 0.8, 2.4]) {
    addCyl(w6Crimson, 0.10, 0.12, 3.25, 4, ltX + 3.4, y + 2.20, ltZ + oz);
  }
  addBox(w6Porcelain, 0.42, 1.95, 3.4, ltX + 6.2, y + 1.02, ltZ);
  addCyl(w6Bronze, 0.34, 0.26, 0.70, 5, ltX + 4.8, y + 0.38, ltZ);

  // 1737–1760: Thái Bình Lâu rear reading pergola, Kiến Trung mosaic urns, Diên Thọ/Trường Sanh/Duyệt Thị Đường,
  // Kỳ Đài lower salute platforms & cannons, Phủ Nội Vụ guard booth, Điện Phụng Tiên screen & imperial avenue lamps
  const tbPX = cx - 84.0;
  const tbPZ = cz - 14.0;
  addBox(w6Stone, 3.8, 0.42, 3.8, tbPX, y + 0.21, tbPZ);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w6Crimson, 0.09, 0.11, 2.95, 4, tbPX + ox, y + 1.65, tbPZ + oz);
    }
  }
  w6JadeRoof.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(tbPX, y + 3.72, tbPZ));
  addBox(w6Stone, 1.85, 0.46, 0.54, tbPX, y + 0.65, tbPZ);
  // 1739–1748: Kiến Trung, Duyệt Thị Đường, Lục Viện, Vườn Cơ Hạ
  addBox(w6Porcelain, 0.42, 1.95, 3.4, dtdX + 16.5, y + 1.02, dtdZ);
  addBox(w6Wood, 2.2, 0.46, 0.55, chX + 3.2, y + 0.25, chZ + 4.5);
  addCyl(w6Porcelain, 0.32, 0.24, 0.65, 5, lvX + 5.8, y + 0.35, lvZ - 3.6);
  addCyl(w6Porcelain, 0.32, 0.24, 0.65, 5, lvX + 5.8, y + 0.35, lvZ + 3.6);
  // 1749–1750, 1756–1760: Kỳ Đài lower salute platforms & cannons, Tứ Phương lanterns, imperial avenue lamps
  for (const s of [-1, 1]) {
    addBox(w6Brick, 3.2, 0.65, 3.2, kdX + 4.2, y + 0.32, cz + s * 10.5);
    addCyl(w6Bronze, 0.14, 0.20, 1.95, 5, kdX + 4.2, y + 1.05, cz + s * 10.5, 0, Math.PI * 0.5);
    addCyl(w6Bronze, 0.06, 0.08, 3.0, 4, tpX + 3.8, y + 5.8, tpZ + s * 4.4);
    addBox(w6Gold, 0.26, 0.30, 0.26, tpX + 3.8, y + 7.45, tpZ + s * 4.4);
    addCyl(w6Bronze, 0.06, 0.08, 3.1, 4, cx - 18.0, y + 1.55, cz + s * 10.5);
    addBox(w6Gold, 0.26, 0.32, 0.26, cx - 18.0, y + 3.25, cz + s * 10.5);
    addCyl(w6Bronze, 0.06, 0.08, 3.1, 4, cx + 32.5, y + 1.55, cz + s * 18.0);
    addBox(w6Gold, 0.26, 0.32, 0.26, cx + 32.5, y + 3.25, cz + s * 18.0);
  }
  // 1752–1753: Phủ Nội Vụ vault plinth & Điện Phụng Tiên rear porcelain Bình Phong
  addBox(w6Stone, 4.2, 0.55, 3.6, cx - 42.0, y + 0.28, seZ - 8.5);
  addBox(w6Porcelain, 0.42, 1.95, 3.6, ptX - 6.8, y + 1.02, ptZ);
  addCyl(w6Bronze, 0.34, 0.26, 0.70, 5, ptX - 5.2, y + 0.38, ptZ);

  addMerged(w6Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w6Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w6Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w6Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w6Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w6Wood, ctx.materials.darkWood, false, true);
  addMerged(w6YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w6JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w6Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w6Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 7 UPGRADES (Items 2081–2112, 2118–2160): NW Outer Cổng Hòa Bình,
  // SE Đình Hộ Thành Hà Nam, Vườn Thiệu Phương Four-Season Royal Garden,
  // Khâm Văn Điện Co Hạ Lakeside Pavilion & Imperial Courtyard Furnishings
  // ==========================================================================
  const w7Stone: THREE.BufferGeometry[] = [];
  const w7Brick: THREE.BufferGeometry[] = [];
  const w7Crimson: THREE.BufferGeometry[] = [];
  const w7Gold: THREE.BufferGeometry[] = [];
  const w7Bronze: THREE.BufferGeometry[] = [];
  const w7Wood: THREE.BufferGeometry[] = [];
  const w7YellowRoof: THREE.BufferGeometry[] = [];
  const w7JadeRoof: THREE.BufferGeometry[] = [];
  const w7Terracotta: THREE.BufferGeometry[] = [];
  const w7Porcelain: THREE.BufferGeometry[] = [];

  // 2081–2088: Cổng Hòa Bình Ngoại Thành (NW Outer Moat Gatehouse at compX - compHalfX - 18.0, cz - 26.0)
  const hbX = compX - compHalfX - 18.0;
  const hbZ = cz - 26.0;
  addBox(w7Stone, 5.2, 0.52, 7.2, hbX, y + 0.26, hbZ);
  addBox(w7Brick, 2.4, 3.6, 1.55, hbX, y + 2.15, hbZ - 2.2);
  addBox(w7Brick, 2.4, 3.6, 1.55, hbX, y + 2.15, hbZ + 2.2);
  addBox(w7Brick, 2.4, 1.15, 6.2, hbX, y + 4.25, hbZ);
  addBox(w7Terracotta, 3.8, 0.88, 7.6, hbX, y + 5.22, hbZ);
  addBox(w7Gold, 0.22, 0.26, 5.6, hbX, y + 5.75, hbZ);
  addBox(w7Gold, 0.16, 0.58, 2.6, hbX - 1.28, y + 4.25, hbZ);
  addBox(w7Porcelain, 0.42, 1.95, 3.6, hbX + 3.8, y + 1.02, hbZ);
  for (const s of [-1, 1]) {
    addBox(w7Porcelain, 0.24, 0.85, 1.15, hbX - 1.25, y + 3.45, hbZ + s * 2.0);
    addBox(w7Stone, 0.45, 1.35, 0.45, hbX - 3.2, y + 0.68, hbZ + s * 3.2);
    addCyl(w7Bronze, 0.06, 0.08, 3.0, 4, hbX - 3.2, y + 1.50, hbZ + s * 1.8);
    addBox(w7Gold, 0.26, 0.30, 0.26, hbX - 3.2, y + 3.15, hbZ + s * 1.8);
  }

  // 2089–2096: Đình Hộ Thành Hà Nam (SE Outer Moat Watch Pavilion & Quay at nmX + 24.5, cz + 42.0)
  const smHX = nmX + 24.5;
  const smHZ = cz + 42.0;
  addBox(w7Stone, 6.2, 0.58, 6.8, smHX, y + 0.29, smHZ);
  addBox(w7Stone, 6.2, 0.65, 0.26, smHX, y + 0.85, smHZ - 3.25);
  addBox(w7Stone, 6.2, 0.65, 0.26, smHX, y + 0.85, smHZ + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w7Crimson, 0.10, 0.12, 3.15, 4, smHX + ox, y + 1.98, smHZ + oz);
    }
  }
  w7YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(smHX, y + 4.22, smHZ));
  w7Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(smHX, y + 5.20, smHZ));
  addBox(w7Porcelain, 0.42, 1.95, 3.6, smHX + 3.6, y + 1.15, smHZ);
  addCyl(w7Crimson, 0.06, 0.08, 3.8, 4, smHX - 2.6, y + 2.15, smHZ + 2.8);
  for (const s of [-1, 1]) {
    addCyl(w7Bronze, 0.14, 0.18, 0.55, 5, smHX - 2.8, y + 0.82, smHZ + s * 2.0);
    addBox(w7Stone, 0.45, 1.45, 0.45, smHX + 2.8, y + 0.92, smHZ + s * 3.0);
    addBox(w7Gold, 0.30, 0.34, 0.30, smHX + 2.8, y + 1.82, smHZ + s * 3.0);
  }

  // 2097–2104: Vườn Thiệu Phương (Four-Season Royal Garden Precinct at cx - 56.0, cz + 66.0)
  const tpGX = cx - 56.0;
  const tpGZ = cz + 66.0;
  addCyl(w7Stone, 3.5, 3.7, 0.52, 6, tpGX, y + 0.26, tpGZ);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w7Crimson, 0.10, 0.12, 3.15, 4, tpGX + Math.cos(a) * 2.4, y + 1.85, tpGZ + Math.sin(a) * 2.4);
  }
  w7JadeRoof.push(new THREE.ConeGeometry(3.6, 1.72, 6).translate(tpGX, y + 4.18, tpGZ));
  w7Gold.push(new THREE.ConeGeometry(0.26, 0.58, 4).translate(tpGX, y + 5.25, tpGZ));
  addCyl(w7Stone, 1.35, 2.05, 2.45, 5, tpGX + 5.8, y + 1.20, tpGZ - 4.5);
  addBox(w7Porcelain, 0.42, 1.95, 3.6, tpGX + 5.8, y + 1.02, tpGZ);
  addCyl(w7Stone, 0.62, 0.62, 0.72, 5, tpGX, y + 0.86, tpGZ);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w7Porcelain, 0.20, 0.18, 0.44, 4, tpGX + dx, y + 0.72, tpGZ + dz);
  }
  addBox(w7Stone, 0.85, 3.1, 0.85, tpGX + 9.2, y + 1.55, tpGZ - 2.0);
  addBox(w7Stone, 0.85, 3.1, 0.85, tpGX + 9.2, y + 1.55, tpGZ + 2.0);
  addBox(w7YellowRoof, 1.75, 0.60, 5.4, tpGX + 9.2, y + 3.35, tpGZ);

  // 2105–2108: Cửa Hiển Nhơn & Cửa Chương Đức outer lantern pillars & bronze tripods
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ + 5.8);
    addBox(w7Stone, 0.48, 1.45, 0.48, compX - 2.8, y + 0.72, gz);
    addBox(w7Gold, 0.30, 0.34, 0.30, compX - 2.8, y + 1.62, gz);
    addCyl(w7Bronze, 0.34, 0.26, 0.70, 5, compX + 2.8, y + 0.38, gz);
  }

  // 2109–2112, 2118–2124: Khâm Văn Điện (Vườn Cơ Hạ North Lakeside Pavilion at cx - 86.0, cz - 58.0)
  const kvX = cx - 86.0;
  const kvZ = cz - 58.0;
  addBox(w7Stone, 5.4, 0.50, 5.4, kvX, y + 0.25, kvZ);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w7Crimson, 0.10, 0.12, 3.15, 4, kvX + ox, y + 1.90, kvZ + oz);
    }
  }
  w7JadeRoof.push(new THREE.ConeGeometry(3.9, 1.65, 4).rotateY(Math.PI * 0.25).translate(kvX, y + 4.22, kvZ));
  w7Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(kvX, y + 5.26, kvZ));
  addBox(w7Wood, 2.2, 0.28, 5.8, kvX + 5.6, y + 0.68, kvZ);
  addCyl(w7Stone, 1.25, 1.95, 2.35, 5, kvX + 5.6, y + 1.15, kvZ + 5.4);
  addBox(w7Stone, 1.85, 0.46, 0.54, kvX, y + 0.72, kvZ);
  for (const s of [-1, 1]) {
    addCyl(w7Porcelain, 0.32, 0.24, 0.64, 5, kvX + 3.4, y + 0.36, kvZ + s * 2.2);
    addBox(w7Stone, 0.45, 1.35, 0.45, kvX - 2.6, y + 0.68, kvZ + s * 3.4);
  }

  // 2125–2160: Thế Miếu/Hưng Miếu drum stands & Tán Lọng, Sân Đại Triều Nghi Phẩm Sơn steles,
  // Cần Chánh/Càn Thành, Kiến Trung/Thái Bình Lâu, Duyệt Thị Đường, Phủ Nội Vụ stele pavilion & avenue lamps
  for (const s of [-1, 1]) {
    addCyl(w7Crimson, 0.05, 0.06, 3.2, 4, cx + 19.5, y + 1.60, swZ + s * 7.5);
    w7Gold.push(new THREE.ConeGeometry(0.60, 0.45, 5).translate(cx + 19.5, y + 3.35, swZ + s * 7.5));
    addBox(w7Stone, 0.34, 1.15, 0.48, cx + 31.5, sanHaY + 0.58, cz + s * 7.8);
    addBox(w7Stone, 0.34, 1.15, 0.48, cx + 34.5, sanHaY + 0.58, cz + s * 7.8);
    addCyl(w7Gold, 0.26, 0.22, 0.68, 5, stairXTop + 4.8, sanThuongY + 0.36, cz + s * 11.2);
    addCyl(w7Bronze, 0.06, 0.08, 3.0, 4, ccW3X + 8.5, y + 1.50, cz + s * 8.5);
    addBox(w7Gold, 0.26, 0.30, 0.26, ccW3X + 8.5, y + 3.15, cz + s * 8.5);
    addCyl(w7Porcelain, 0.34, 0.26, 0.66, 5, ktX + 12.5, y + 0.36, cz + s * 11.5);
    addBox(w7Stone, 0.48, 1.35, 0.48, kdX + 9.2, y + 0.68, cz + s * 11.2);
    addCyl(w7Bronze, 0.06, 0.08, 3.1, 4, cx - 28.0, y + 1.55, cz + s * 10.5);
    addBox(w7Gold, 0.26, 0.32, 0.26, cx - 28.0, y + 3.25, cz + s * 10.5);
  }
  addBox(w7Porcelain, 0.42, 1.95, 3.4, dtdX + 16.5, y + 1.02, dtdZ - 6.8);
  addCyl(w7Bronze, 0.38, 0.46, 0.85, 5, dtdX + 12.5, y + 1.25, dtdZ + 5.2);
  // 2149–2152: Phủ Nội Vụ 4-post royal archive stele pavilion (cx - 42.0, seZ - 15.5)
  const pnvSX = cx - 42.0;
  const pnvSZ = seZ - 15.5;
  addBox(w7Stone, 3.8, 0.42, 3.8, pnvSX, y + 0.21, pnvSZ);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w7Crimson, 0.09, 0.11, 2.95, 4, pnvSX + ox, y + 1.65, pnvSZ + oz);
    }
  }
  w7Terracotta.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(pnvSX, y + 3.72, pnvSZ));
  addBox(w7Stone, 0.40, 1.80, 0.92, pnvSX, y + 1.32, pnvSZ);

  addMerged(w7Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w7Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w7Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w7Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w7Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w7Wood, ctx.materials.darkWood, false, true);
  addMerged(w7YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w7JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w7Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w7Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 8 UPGRADES (Items 2481–2512, 2518–2560): SW Outer Cổng Thượng Tứ,
  // NE Đình Hộ Thành Hà Bắc, Vườn Hậu Hồ West Lotus Garden, Minh Viễn Lâu
  // Co Hạ Lakeside Pavilion & Imperial Courtyard Furnishings
  // ==========================================================================
  const w8Stone: THREE.BufferGeometry[] = [];
  const w8Brick: THREE.BufferGeometry[] = [];
  const w8Crimson: THREE.BufferGeometry[] = [];
  const w8Gold: THREE.BufferGeometry[] = [];
  const w8Bronze: THREE.BufferGeometry[] = [];
  const w8Wood: THREE.BufferGeometry[] = [];
  const w8YellowRoof: THREE.BufferGeometry[] = [];
  const w8JadeRoof: THREE.BufferGeometry[] = [];
  const w8Terracotta: THREE.BufferGeometry[] = [];
  const w8Porcelain: THREE.BufferGeometry[] = [];

  // 2481–2488: Cổng Thượng Tứ Ngoại Thành Tây Nam (SW Outer Moat Gatehouse at compX - compHalfX - 18.0, cz + 26.0)
  const tt8X = compX - compHalfX - 18.0;
  const tt8Z = cz + 26.0;
  addBox(w8Stone, 5.2, 0.52, 7.2, tt8X, y + 0.26, tt8Z);
  addBox(w8Brick, 2.4, 3.6, 1.55, tt8X, y + 2.15, tt8Z - 2.2);
  addBox(w8Brick, 2.4, 3.6, 1.55, tt8X, y + 2.15, tt8Z + 2.2);
  addBox(w8Brick, 2.4, 1.15, 6.2, tt8X, y + 4.25, tt8Z);
  addBox(w8Terracotta, 3.8, 0.88, 7.6, tt8X, y + 5.22, tt8Z);
  addBox(w8Gold, 0.22, 0.26, 5.6, tt8X, y + 5.75, tt8Z);
  addBox(w8Gold, 0.16, 0.58, 2.6, tt8X - 1.28, y + 4.25, tt8Z);
  addBox(w8Porcelain, 0.42, 1.95, 3.6, tt8X + 3.8, y + 1.02, tt8Z);
  for (const s of [-1, 1]) {
    addBox(w8Porcelain, 0.24, 0.85, 1.15, tt8X - 1.25, y + 3.45, tt8Z + s * 2.0);
    addBox(w8Stone, 0.45, 1.35, 0.45, tt8X - 3.2, y + 0.68, tt8Z + s * 3.2);
    addCyl(w8Bronze, 0.06, 0.08, 3.0, 4, tt8X - 3.2, y + 1.50, tt8Z + s * 1.8);
    addBox(w8Gold, 0.26, 0.30, 0.26, tt8X - 3.2, y + 3.15, tt8Z + s * 1.8);
  }

  // 2489–2496: Đình Hộ Thành Hà Bắc (NE Outer Moat Watch Pavilion & Quay at nmX + 24.5, cz - 42.0)
  const nb8X = nmX + 24.5;
  const nb8Z = cz - 42.0;
  addBox(w8Stone, 6.2, 0.58, 6.8, nb8X, y + 0.29, nb8Z);
  addBox(w8Stone, 6.2, 0.65, 0.26, nb8X, y + 0.85, nb8Z - 3.25);
  addBox(w8Stone, 6.2, 0.65, 0.26, nb8X, y + 0.85, nb8Z + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w8Crimson, 0.10, 0.12, 3.15, 4, nb8X + ox, y + 1.98, nb8Z + oz);
    }
  }
  w8YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(nb8X, y + 4.22, nb8Z));
  w8Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(nb8X, y + 5.20, nb8Z));
  addBox(w8Porcelain, 0.42, 1.95, 3.6, nb8X + 3.6, y + 1.15, nb8Z);
  addCyl(w8Crimson, 0.06, 0.08, 3.8, 4, nb8X - 2.6, y + 2.15, nb8Z - 2.8);
  for (const s of [-1, 1]) {
    addCyl(w8Bronze, 0.14, 0.18, 0.55, 5, nb8X - 2.8, y + 0.82, nb8Z + s * 2.0);
    addBox(w8Stone, 0.45, 1.45, 0.45, nb8X + 2.8, y + 0.92, nb8Z + s * 3.0);
    addBox(w8Gold, 0.30, 0.34, 0.30, nb8X + 2.8, y + 1.82, nb8Z + s * 3.0);
  }

  // 2497–2504: Vườn Hậu Hồ (West Royal Lotus-Garden Precinct at cx - 56.0, cz + 80.0)
  const hh8X = cx - 56.0;
  const hh8Z = cz + 80.0;
  addCyl(w8Stone, 3.5, 3.7, 0.52, 6, hh8X, y + 0.26, hh8Z);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w8Crimson, 0.10, 0.12, 3.15, 4, hh8X + Math.cos(a) * 2.4, y + 1.85, hh8Z + Math.sin(a) * 2.4);
  }
  w8JadeRoof.push(new THREE.ConeGeometry(3.6, 1.72, 6).translate(hh8X, y + 4.18, hh8Z));
  w8Gold.push(new THREE.ConeGeometry(0.26, 0.58, 4).translate(hh8X, y + 5.25, hh8Z));
  addCyl(w8Stone, 1.35, 2.05, 2.45, 5, hh8X + 5.8, y + 1.20, hh8Z - 4.5);
  addBox(w8Porcelain, 0.42, 1.95, 3.6, hh8X + 5.8, y + 1.02, hh8Z);
  addCyl(w8Stone, 0.62, 0.62, 0.72, 5, hh8X, y + 0.86, hh8Z);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w8Porcelain, 0.20, 0.18, 0.44, 4, hh8X + dx, y + 0.72, hh8Z + dz);
  }
  addBox(w8Stone, 0.85, 3.1, 0.85, hh8X + 9.2, y + 1.55, hh8Z - 2.0);
  addBox(w8Stone, 0.85, 3.1, 0.85, hh8X + 9.2, y + 1.55, hh8Z + 2.0);
  addBox(w8YellowRoof, 1.75, 0.60, 5.4, hh8X + 9.2, y + 3.35, hh8Z);

  // 2505–2508: Cửa Hiển Nhơn & Cửa Chương Đức inner-courtyard lantern pillars & bronze tripods
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ - 4.8);
    addBox(w8Stone, 0.48, 1.45, 0.48, compX - 4.8, y + 0.72, gz);
    addBox(w8Gold, 0.30, 0.34, 0.30, compX - 4.8, y + 1.62, gz);
    addCyl(w8Bronze, 0.34, 0.26, 0.70, 5, compX + 4.8, y + 0.38, gz);
  }

  // 2509–2512, 2518–2524: Minh Viễn Lâu — Đình Vọng Hồ Cơ Hạ (SW Co Hạ Lakeside Pavilion at cx - 86.0, cz - 44.0)
  const mv8X = cx - 86.0;
  const mv8Z = cz - 44.0;
  addBox(w8Stone, 5.4, 0.50, 5.4, mv8X, y + 0.25, mv8Z);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w8Crimson, 0.10, 0.12, 3.15, 4, mv8X + ox, y + 1.90, mv8Z + oz);
    }
  }
  w8JadeRoof.push(new THREE.ConeGeometry(3.9, 1.65, 4).rotateY(Math.PI * 0.25).translate(mv8X, y + 4.22, mv8Z));
  w8Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(mv8X, y + 5.26, mv8Z));
  addBox(w8Wood, 2.2, 0.28, 5.8, mv8X + 5.6, y + 0.68, mv8Z);
  addCyl(w8Stone, 1.25, 1.95, 2.35, 5, mv8X + 5.6, y + 1.15, mv8Z + 5.4);
  addBox(w8Stone, 1.85, 0.46, 0.54, mv8X, y + 0.72, mv8Z);
  for (const s of [-1, 1]) {
    addCyl(w8Porcelain, 0.32, 0.24, 0.64, 5, mv8X + 3.4, y + 0.36, mv8Z + s * 2.2);
    addBox(w8Stone, 0.45, 1.35, 0.45, mv8X - 2.6, y + 0.68, mv8Z + s * 3.4);
  }

  // 2525–2560: Thế Miếu/Hưng Miếu Tán Lọng, Sân Đại Triều Nghi outer Phẩm Sơn steles,
  // Cần Chánh/Càn Thành, Kiến Trung, Duyệt Thị Đường, Phủ Nội Vụ seal-archive pavilion & avenue lamps
  for (const s of [-1, 1]) {
    addCyl(w8Crimson, 0.05, 0.06, 3.2, 4, cx + 19.5, y + 1.60, swZ + s * 10.5);
    w8Gold.push(new THREE.ConeGeometry(0.60, 0.45, 5).translate(cx + 19.5, y + 3.35, swZ + s * 10.5));
    addBox(w8Stone, 0.34, 1.15, 0.48, cx + 37.5, sanHaY + 0.58, cz + s * 7.8);
    addBox(w8Stone, 0.34, 1.15, 0.48, cx + 40.5, sanHaY + 0.58, cz + s * 7.8);
    addCyl(w8Gold, 0.26, 0.22, 0.68, 5, stairXTop + 4.8, sanThuongY + 0.36, cz + s * 13.8);
    addCyl(w8Bronze, 0.06, 0.08, 3.0, 4, ccW3X + 12.5, y + 1.50, cz + s * 8.5);
    addBox(w8Gold, 0.26, 0.30, 0.26, ccW3X + 12.5, y + 3.15, cz + s * 8.5);
    addCyl(w8Porcelain, 0.34, 0.26, 0.66, 5, ktX + 15.5, y + 0.36, cz + s * 11.5);
    addBox(w8Stone, 0.48, 1.35, 0.48, kdX + 13.2, y + 0.68, cz + s * 11.2);
    addCyl(w8Bronze, 0.06, 0.08, 3.1, 4, cx - 38.0, y + 1.55, cz + s * 10.5);
    addBox(w8Gold, 0.26, 0.32, 0.26, cx - 38.0, y + 3.25, cz + s * 10.5);
  }
  addBox(w8Porcelain, 0.42, 1.95, 3.4, dtdX + 16.5, y + 1.02, dtdZ + 6.8);
  addCyl(w8Bronze, 0.38, 0.46, 0.85, 5, dtdX + 12.5, y + 1.25, dtdZ - 5.2);
  // 2549–2552: Phủ Nội Vụ 4-post royal seal-archive pavilion (cx - 42.0, seZ - 22.0)
  const pnv8X = cx - 42.0;
  const pnv8Z = seZ - 22.0;
  addBox(w8Stone, 3.8, 0.42, 3.8, pnv8X, y + 0.21, pnv8Z);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w8Crimson, 0.09, 0.11, 2.95, 4, pnv8X + ox, y + 1.65, pnv8Z + oz);
    }
  }
  w8Terracotta.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(pnv8X, y + 3.72, pnv8Z));
  addBox(w8Stone, 0.40, 1.80, 0.92, pnv8X, y + 1.32, pnv8Z);

  addMerged(w8Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w8Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w8Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w8Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w8Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w8Wood, ctx.materials.darkWood, false, true);
  addMerged(w8YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w8JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w8Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w8Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 9 UPGRADES (Items 2881–2912, 2918–2960): NW Outer Cổng An Hòa,
  // SE Đình Hộ Thành Hà Nam, Vườn Ngự Uyển Đông, Trường Du Tạ
  // NW Co Hạ Lakeside Water Pavilion & Imperial Courtyard Furnishings
  // ==========================================================================
  const w9Stone: THREE.BufferGeometry[] = [];
  const w9Brick: THREE.BufferGeometry[] = [];
  const w9Crimson: THREE.BufferGeometry[] = [];
  const w9Gold: THREE.BufferGeometry[] = [];
  const w9Bronze: THREE.BufferGeometry[] = [];
  const w9Wood: THREE.BufferGeometry[] = [];
  const w9YellowRoof: THREE.BufferGeometry[] = [];
  const w9JadeRoof: THREE.BufferGeometry[] = [];
  const w9Terracotta: THREE.BufferGeometry[] = [];
  const w9Porcelain: THREE.BufferGeometry[] = [];

  // 2881–2888: Cổng An Hòa Ngoại Thành Tây Bắc (NW Outer Moat Gatehouse at compX - compHalfX - 18.0, cz - 26.0)
  const ah9X = compX - compHalfX - 18.0;
  const ah9Z = cz - 26.0;
  addBox(w9Stone, 5.2, 0.52, 7.2, ah9X, y + 0.26, ah9Z);
  addBox(w9Brick, 2.4, 3.6, 1.55, ah9X, y + 2.15, ah9Z - 2.2);
  addBox(w9Brick, 2.4, 3.6, 1.55, ah9X, y + 2.15, ah9Z + 2.2);
  addBox(w9Brick, 2.4, 1.15, 6.2, ah9X, y + 4.25, ah9Z);
  addBox(w9Terracotta, 3.8, 0.88, 7.6, ah9X, y + 5.22, ah9Z);
  addBox(w9Gold, 0.22, 0.26, 5.6, ah9X, y + 5.75, ah9Z);
  addBox(w9Gold, 0.16, 0.58, 2.6, ah9X - 1.28, y + 4.25, ah9Z);
  addBox(w9Porcelain, 0.42, 1.95, 3.6, ah9X + 3.8, y + 1.02, ah9Z);
  for (const s of [-1, 1]) {
    addBox(w9Porcelain, 0.24, 0.85, 1.15, ah9X - 1.25, y + 3.45, ah9Z + s * 2.0);
    addBox(w9Stone, 0.45, 1.35, 0.45, ah9X - 3.2, y + 0.68, ah9Z + s * 3.2);
    addCyl(w9Bronze, 0.06, 0.08, 3.0, 4, ah9X - 3.2, y + 1.50, ah9Z + s * 1.8);
    addBox(w9Gold, 0.26, 0.30, 0.26, ah9X - 3.2, y + 3.15, ah9Z + s * 1.8);
  }

  // 2889–2896: Đình Hộ Thành Hà Nam (SE Outer Moat Watch Pavilion & Quay at nmX + 24.5, cz + 42.0)
  const sb9X = nmX + 24.5;
  const sb9Z = cz + 42.0;
  addBox(w9Stone, 6.2, 0.58, 6.8, sb9X, y + 0.29, sb9Z);
  addBox(w9Stone, 6.2, 0.65, 0.26, sb9X, y + 0.85, sb9Z - 3.25);
  addBox(w9Stone, 6.2, 0.65, 0.26, sb9X, y + 0.85, sb9Z + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w9Crimson, 0.10, 0.12, 3.15, 4, sb9X + ox, y + 1.98, sb9Z + oz);
    }
  }
  w9YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(sb9X, y + 4.22, sb9Z));
  w9Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(sb9X, y + 5.20, sb9Z));
  addBox(w9Porcelain, 0.42, 1.95, 3.6, sb9X + 3.6, y + 1.15, sb9Z);
  addCyl(w9Crimson, 0.06, 0.08, 3.8, 4, sb9X - 2.6, y + 2.15, sb9Z + 2.8);
  for (const s of [-1, 1]) {
    addCyl(w9Bronze, 0.14, 0.18, 0.55, 5, sb9X - 2.8, y + 0.82, sb9Z + s * 2.0);
    addBox(w9Stone, 0.45, 1.45, 0.45, sb9X + 2.8, y + 0.92, sb9Z + s * 3.0);
    addBox(w9Gold, 0.30, 0.34, 0.30, sb9X + 2.8, y + 1.82, sb9Z + s * 3.0);
  }

  // 2897–2904: Vườn Ngự Uyển Đông — Đình Thưởng Nguyệt (East Royal Lotus Garden at cx - 56.0, cz - 80.0)
  const tn9X = cx - 56.0;
  const tn9Z = cz - 80.0;
  addCyl(w9Stone, 3.5, 3.7, 0.52, 6, tn9X, y + 0.26, tn9Z);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w9Crimson, 0.10, 0.12, 3.15, 4, tn9X + Math.cos(a) * 2.4, y + 1.85, tn9Z + Math.sin(a) * 2.4);
  }
  w9JadeRoof.push(new THREE.ConeGeometry(3.6, 1.72, 6).translate(tn9X, y + 4.18, tn9Z));
  w9Gold.push(new THREE.ConeGeometry(0.26, 0.58, 4).translate(tn9X, y + 5.25, tn9Z));
  addCyl(w9Stone, 1.35, 2.05, 2.45, 5, tn9X + 5.8, y + 1.20, tn9Z + 4.5);
  addBox(w9Porcelain, 0.42, 1.95, 3.6, tn9X + 5.8, y + 1.02, tn9Z);
  addCyl(w9Stone, 0.62, 0.62, 0.72, 5, tn9X, y + 0.86, tn9Z);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w9Porcelain, 0.20, 0.18, 0.44, 4, tn9X + dx, y + 0.72, tn9Z + dz);
  }
  addBox(w9Stone, 0.85, 3.1, 0.85, tn9X + 9.2, y + 1.55, tn9Z - 2.0);
  addBox(w9Stone, 0.85, 3.1, 0.85, tn9X + 9.2, y + 1.55, tn9Z + 2.0);
  addBox(w9YellowRoof, 1.75, 0.60, 5.4, tn9X + 9.2, y + 3.35, tn9Z);

  // 2905–2908: Cửa Hiển Nhơn & Cửa Chương Đức mid-bridge lantern pillars & bronze tripods
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ + 9.2);
    addBox(w9Stone, 0.48, 1.45, 0.48, compX - 4.8, y + 0.72, gz);
    addBox(w9Gold, 0.30, 0.34, 0.30, compX - 4.8, y + 1.62, gz);
    addCyl(w9Bronze, 0.34, 0.26, 0.70, 5, compX + 4.8, y + 0.38, gz);
  }

  // 2909–2912, 2918–2924: Trường Du Tạ — Đình Vọng Hồ Tây Bắc (NW Co Hạ Pavilion at cx - 72.0, cz - 44.0)
  const td9X = cx - 72.0;
  const td9Z = cz - 44.0;
  addBox(w9Stone, 5.4, 0.50, 5.4, td9X, y + 0.25, td9Z);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w9Crimson, 0.10, 0.12, 3.15, 4, td9X + ox, y + 1.90, td9Z + oz);
    }
  }
  w9JadeRoof.push(new THREE.ConeGeometry(3.9, 1.65, 4).rotateY(Math.PI * 0.25).translate(td9X, y + 4.22, td9Z));
  w9Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(td9X, y + 5.26, td9Z));
  addBox(w9Wood, 2.2, 0.28, 5.8, td9X + 5.6, y + 0.68, td9Z);
  addCyl(w9Stone, 1.25, 1.95, 2.35, 5, td9X + 5.6, y + 1.15, td9Z + 5.4);
  addBox(w9Stone, 1.85, 0.46, 0.54, td9X, y + 0.72, td9Z);
  for (const s of [-1, 1]) {
    addCyl(w9Porcelain, 0.32, 0.24, 0.64, 5, td9X + 3.4, y + 0.36, td9Z + s * 2.2);
    addBox(w9Stone, 0.45, 1.35, 0.45, td9X - 2.6, y + 0.68, td9Z + s * 3.4);
  }

  // 2925–2960: Thế Miếu/Hưng Miếu outer Tán Lọng, Sân Đại Triều Nghi far-outer Phẩm Sơn steles,
  // Cần Chánh/Càn Thành, Kiến Trung, Duyệt Thị Đường, Phủ Nội Vụ treasury-scroll pavilion & avenue lamps
  for (const s of [-1, 1]) {
    addCyl(w9Crimson, 0.05, 0.06, 3.2, 4, cx + 19.5, y + 1.60, swZ + s * 13.5);
    w9Gold.push(new THREE.ConeGeometry(0.60, 0.45, 5).translate(cx + 19.5, y + 3.35, swZ + s * 13.5));
    addBox(w9Stone, 0.34, 1.15, 0.48, cx + 43.5, sanHaY + 0.58, cz + s * 7.8);
    addBox(w9Stone, 0.34, 1.15, 0.48, cx + 46.5, sanHaY + 0.58, cz + s * 7.8);
    addCyl(w9Gold, 0.26, 0.22, 0.68, 5, stairXTop + 4.8, sanThuongY + 0.36, cz + s * 16.4);
    addCyl(w9Bronze, 0.06, 0.08, 3.0, 4, ccW3X + 16.5, y + 1.50, cz + s * 8.5);
    addBox(w9Gold, 0.26, 0.30, 0.26, ccW3X + 16.5, y + 3.15, cz + s * 8.5);
    addCyl(w9Porcelain, 0.34, 0.26, 0.66, 5, ktX + 18.5, y + 0.36, cz + s * 11.5);
    addBox(w9Stone, 0.48, 1.35, 0.48, kdX + 17.2, y + 0.68, cz + s * 11.2);
    addCyl(w9Bronze, 0.06, 0.08, 3.1, 4, cx - 48.0, y + 1.55, cz + s * 10.5);
    addBox(w9Gold, 0.26, 0.32, 0.26, cx - 48.0, y + 3.25, cz + s * 10.5);
  }
  addBox(w9Porcelain, 0.42, 1.95, 3.4, dtdX + 16.5, y + 1.02, dtdZ - 10.5);
  addCyl(w9Bronze, 0.38, 0.46, 0.85, 5, dtdX + 12.5, y + 1.25, dtdZ + 8.8);
  // 2949–2952: Phủ Nội Vụ 4-post royal treasury-scroll pavilion (cx - 42.0, seZ - 28.5)
  const pnv9X = cx - 42.0;
  const pnv9Z = seZ - 28.5;
  addBox(w9Stone, 3.8, 0.42, 3.8, pnv9X, y + 0.21, pnv9Z);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w9Crimson, 0.09, 0.11, 2.95, 4, pnv9X + ox, y + 1.65, pnv9Z + oz);
    }
  }
  w9Terracotta.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(pnv9X, y + 3.72, pnv9Z));
  addBox(w9Stone, 0.40, 1.80, 0.92, pnv9X, y + 1.32, pnv9Z);

  addMerged(w9Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w9Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w9Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w9Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w9Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w9Wood, ctx.materials.darkWood, false, true);
  addMerged(w9YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w9JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w9Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w9Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 10 UPGRADES (Items 3281–3312, 3318–3360): SW Outer Cổng Chính Tây,
  // NE Đình Hộ Thành Hà Bắc, Vườn Thiệu Phương Đình Ngự Thảo, Vườn Cơ Hạ
  // Minh Viễn Tạ, Tàng Thơ Lâu Archive Pavilion & Imperial Courtyard Furnishings
  // ==========================================================================
  const w10Stone: THREE.BufferGeometry[] = [];
  const w10Brick: THREE.BufferGeometry[] = [];
  const w10Crimson: THREE.BufferGeometry[] = [];
  const w10Gold: THREE.BufferGeometry[] = [];
  const w10Bronze: THREE.BufferGeometry[] = [];
  const w10Wood: THREE.BufferGeometry[] = [];
  const w10YellowRoof: THREE.BufferGeometry[] = [];
  const w10JadeRoof: THREE.BufferGeometry[] = [];
  const w10Terracotta: THREE.BufferGeometry[] = [];
  const w10Porcelain: THREE.BufferGeometry[] = [];

  // 3281–3288: Cổng Chính Tây — Ngoại Thành Tây Nam (SW Outer Gatehouse at compX - compHalfX - 18.0, cz + 28.0)
  const ct10X = compX - compHalfX - 18.0;
  const ct10Z = cz + 28.0;
  addBox(w10Stone, 5.2, 0.52, 7.2, ct10X, y + 0.26, ct10Z);
  addBox(w10Brick, 2.4, 3.6, 1.55, ct10X, y + 2.15, ct10Z - 2.2);
  addBox(w10Brick, 2.4, 3.6, 1.55, ct10X, y + 2.15, ct10Z + 2.2);
  addBox(w10Brick, 2.4, 1.15, 6.2, ct10X, y + 4.25, ct10Z);
  addBox(w10Terracotta, 3.8, 0.88, 7.6, ct10X, y + 5.22, ct10Z);
  addBox(w10Gold, 0.22, 0.26, 5.6, ct10X, y + 5.75, ct10Z);
  addBox(w10Gold, 0.16, 0.58, 2.6, ct10X - 1.28, y + 4.25, ct10Z);
  addBox(w10Porcelain, 0.42, 1.95, 3.6, ct10X + 3.8, y + 1.02, ct10Z);
  for (const s of [-1, 1]) {
    addBox(w10Porcelain, 0.24, 0.85, 1.15, ct10X - 1.25, y + 3.45, ct10Z + s * 2.0);
    addBox(w10Stone, 0.45, 1.35, 0.45, ct10X - 3.2, y + 0.68, ct10Z + s * 3.2);
    addCyl(w10Bronze, 0.06, 0.08, 3.0, 4, ct10X - 3.2, y + 1.50, ct10Z + s * 1.8);
    addBox(w10Gold, 0.26, 0.30, 0.26, ct10X - 3.2, y + 3.15, ct10Z + s * 1.8);
  }

  // 3289–3296: Đình Hộ Thành Hà Bắc (NE Outer Moat Lotus Watch Pavilion & Quay at nmX + 24.5, cz - 44.0)
  const nb10X = nmX + 24.5;
  const nb10Z = cz - 44.0;
  addBox(w10Stone, 6.2, 0.58, 6.8, nb10X, y + 0.29, nb10Z);
  addBox(w10Stone, 6.2, 0.65, 0.26, nb10X, y + 0.85, nb10Z - 3.25);
  addBox(w10Stone, 6.2, 0.65, 0.26, nb10X, y + 0.85, nb10Z + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w10Crimson, 0.10, 0.12, 3.15, 4, nb10X + ox, y + 1.98, nb10Z + oz);
    }
  }
  w10YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(nb10X, y + 4.22, nb10Z));
  w10Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(nb10X, y + 5.20, nb10Z));
  addBox(w10Porcelain, 0.42, 1.95, 3.6, nb10X + 3.6, y + 1.15, nb10Z);
  addCyl(w10Crimson, 0.06, 0.08, 3.8, 4, nb10X - 2.6, y + 2.15, nb10Z + 2.8);
  for (const s of [-1, 1]) {
    addCyl(w10Bronze, 0.14, 0.18, 0.55, 5, nb10X - 2.8, y + 0.82, nb10Z + s * 2.0);
    addBox(w10Stone, 0.45, 1.45, 0.45, nb10X + 2.8, y + 0.92, nb10Z + s * 3.0);
    addBox(w10Gold, 0.30, 0.34, 0.30, nb10X + 2.8, y + 1.82, nb10Z + s * 3.0);
  }

  // 3297–3304: Vườn Thiệu Phương — Đình Ngự Thảo (South Royal Botanical Hexagonal Pavilion at cx - 56.0, cz + 82.0)
  const tp10X = cx - 56.0;
  const tp10Z = cz + 82.0;
  addCyl(w10Stone, 3.5, 3.7, 0.52, 6, tp10X, y + 0.26, tp10Z);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w10Crimson, 0.10, 0.12, 3.15, 4, tp10X + Math.cos(a) * 2.4, y + 1.85, tp10Z + Math.sin(a) * 2.4);
  }
  w10JadeRoof.push(new THREE.ConeGeometry(3.6, 1.72, 6).translate(tp10X, y + 4.18, tp10Z));
  w10Gold.push(new THREE.ConeGeometry(0.26, 0.58, 4).translate(tp10X, y + 5.25, tp10Z));
  addCyl(w10Stone, 1.35, 2.05, 2.45, 5, tp10X + 5.8, y + 1.20, tp10Z - 4.5);
  addBox(w10Porcelain, 0.42, 1.95, 3.6, tp10X + 5.8, y + 1.02, tp10Z);
  addCyl(w10Stone, 0.62, 0.62, 0.72, 5, tp10X, y + 0.86, tp10Z);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w10Porcelain, 0.20, 0.18, 0.44, 4, tp10X + dx, y + 0.72, tp10Z + dz);
  }
  addBox(w10Stone, 0.85, 3.1, 0.85, tp10X + 9.2, y + 1.55, tp10Z - 2.0);
  addBox(w10Stone, 0.85, 3.1, 0.85, tp10X + 9.2, y + 1.55, tp10Z + 2.0);
  addBox(w10YellowRoof, 1.75, 0.60, 5.4, tp10X + 9.2, y + 3.35, tp10Z);

  // 3305–3308: Cửa Hiển Nhơn & Cửa Chương Đức outer-moat lantern pillars & bronze lotus cauldrons
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ + 12.2);
    addBox(w10Stone, 0.48, 1.45, 0.48, compX - 8.2, y + 0.72, gz);
    addBox(w10Gold, 0.30, 0.34, 0.30, compX - 8.2, y + 1.62, gz);
    addCyl(w10Bronze, 0.34, 0.26, 0.70, 5, compX + 8.2, y + 0.38, gz);
  }

  // 3309–3312, 3318–3324: Vườn Cơ Hạ — Minh Viễn Tạ (SW Co Hạ Lakeside Water Pavilion at cx - 72.0, cz + 46.0)
  const mv10X = cx - 72.0;
  const mv10Z = cz + 46.0;
  addBox(w10Stone, 5.4, 0.50, 5.4, mv10X, y + 0.25, mv10Z);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w10Crimson, 0.10, 0.12, 3.15, 4, mv10X + ox, y + 1.90, mv10Z + oz);
    }
  }
  w10JadeRoof.push(new THREE.ConeGeometry(3.9, 1.65, 4).rotateY(Math.PI * 0.25).translate(mv10X, y + 4.22, mv10Z));
  w10Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(mv10X, y + 5.26, mv10Z));
  addBox(w10Wood, 2.2, 0.28, 5.8, mv10X + 5.6, y + 0.68, mv10Z);
  addCyl(w10Stone, 1.25, 1.95, 2.35, 5, mv10X + 5.6, y + 1.15, mv10Z - 5.4);
  addBox(w10Stone, 1.85, 0.46, 0.54, mv10X, y + 0.72, mv10Z);
  for (const s of [-1, 1]) {
    addCyl(w10Porcelain, 0.32, 0.24, 0.64, 5, mv10X + 3.4, y + 0.36, mv10Z + s * 2.2);
    addBox(w10Stone, 0.45, 1.35, 0.45, mv10X - 2.6, y + 0.68, mv10Z + s * 3.4);
  }

  // 3325–3360: Thế Miếu/Hưng Miếu far-outer Tán Lọng, Sân Đại Triều Nghi outer-east Phẩm Sơn steles,
  // Cần Chánh/Càn Thành, Kiến Trung, Duyệt Thị Đường, Tàng Thơ Lâu Archive Pavilion & avenue lamps
  for (const s of [-1, 1]) {
    addCyl(w10Crimson, 0.05, 0.06, 3.2, 4, cx + 23.5, y + 1.60, swZ + s * 13.5);
    w10Gold.push(new THREE.ConeGeometry(0.60, 0.45, 5).translate(cx + 23.5, y + 3.35, swZ + s * 13.5));
    addBox(w10Stone, 0.34, 1.15, 0.48, cx + 49.5, sanHaY + 0.58, cz + s * 7.8);
    addBox(w10Stone, 0.34, 1.15, 0.48, cx + 52.5, sanHaY + 0.58, cz + s * 7.8);
    addCyl(w10Gold, 0.26, 0.22, 0.68, 5, stairXTop + 4.8, sanThuongY + 0.36, cz + s * 19.6);
    addCyl(w10Bronze, 0.06, 0.08, 3.0, 4, ccW3X + 20.5, y + 1.50, cz + s * 8.5);
    addBox(w10Gold, 0.26, 0.30, 0.26, ccW3X + 20.5, y + 3.15, cz + s * 8.5);
    addCyl(w10Porcelain, 0.34, 0.26, 0.66, 5, ktX + 22.5, y + 0.36, cz + s * 11.5);
    addBox(w10Stone, 0.48, 1.35, 0.48, kdX + 21.2, y + 0.68, cz + s * 11.2);
    addCyl(w10Bronze, 0.06, 0.08, 3.1, 4, cx - 54.0, y + 1.55, cz + s * 10.5);
    addBox(w10Gold, 0.26, 0.32, 0.26, cx - 54.0, y + 3.25, cz + s * 10.5);
  }
  addBox(w10Porcelain, 0.42, 1.95, 3.4, dtdX + 20.5, y + 1.02, dtdZ - 10.5);
  addCyl(w10Bronze, 0.38, 0.46, 0.85, 5, dtdX + 16.5, y + 1.25, dtdZ + 8.8);
  // 3349–3354: Tàng Thơ Lâu 4-post royal archive stele pavilion (cx - 42.0, seZ + 28.5)
  const ttl10X = cx - 42.0;
  const ttl10Z = seZ + 28.5;
  addBox(w10Stone, 3.8, 0.42, 3.8, ttl10X, y + 0.21, ttl10Z);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w10Crimson, 0.09, 0.11, 2.95, 4, ttl10X + ox, y + 1.65, ttl10Z + oz);
    }
  }
  w10Terracotta.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(ttl10X, y + 3.72, ttl10Z));
  addBox(w10Stone, 0.40, 1.80, 0.92, ttl10X, y + 1.32, ttl10Z);

  addMerged(w10Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w10Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w10Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w10Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w10Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w10Wood, ctx.materials.darkWood, false, true);
  addMerged(w10YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w10JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w10Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w10Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 11 UPGRADES (Items 3681–3712, 3718–3760): NW Far-Outer Cổng Chính Bắc,
  // East Đình Ngự Hà Đông, Vườn Cơ Hạ Đình Lục Giác Tứ Phương, Vườn Thiệu Phương
  // Thưởng Liên Tạ, Quốc Tử Giám Academy Pavilion & Imperial Courtyard Furnishings
  // ==========================================================================
  const w11Stone: THREE.BufferGeometry[] = [];
  const w11Brick: THREE.BufferGeometry[] = [];
  const w11Crimson: THREE.BufferGeometry[] = [];
  const w11Gold: THREE.BufferGeometry[] = [];
  const w11Bronze: THREE.BufferGeometry[] = [];
  const w11Wood: THREE.BufferGeometry[] = [];
  const w11YellowRoof: THREE.BufferGeometry[] = [];
  const w11JadeRoof: THREE.BufferGeometry[] = [];
  const w11Terracotta: THREE.BufferGeometry[] = [];
  const w11Porcelain: THREE.BufferGeometry[] = [];

  // 3681–3688: Cổng Chính Bắc — Ngoại Thành Tây Bắc (NW Far-Outer Gatehouse at compX - compHalfX - 18.0, cz - 54.0)
  const cb11X = compX - compHalfX - 18.0;
  const cb11Z = cz - 54.0;
  addBox(w11Stone, 5.2, 0.52, 7.2, cb11X, y + 0.26, cb11Z);
  addBox(w11Brick, 2.4, 3.6, 1.55, cb11X, y + 2.15, cb11Z - 2.2);
  addBox(w11Brick, 2.4, 3.6, 1.55, cb11X, y + 2.15, cb11Z + 2.2);
  addBox(w11Brick, 2.4, 1.15, 6.2, cb11X, y + 4.25, cb11Z);
  addBox(w11Terracotta, 3.8, 0.88, 7.6, cb11X, y + 5.22, cb11Z);
  addBox(w11Gold, 0.22, 0.26, 5.6, cb11X, y + 5.75, cb11Z);
  addBox(w11Gold, 0.16, 0.58, 2.6, cb11X - 1.28, y + 4.25, cb11Z);
  addBox(w11Porcelain, 0.42, 1.95, 3.6, cb11X + 3.8, y + 1.02, cb11Z);
  for (const s of [-1, 1]) {
    addBox(w11Porcelain, 0.24, 0.85, 1.15, cb11X - 1.25, y + 3.45, cb11Z + s * 2.0);
    addBox(w11Stone, 0.45, 1.35, 0.45, cb11X - 3.2, y + 0.68, cb11Z + s * 3.2);
    addCyl(w11Bronze, 0.06, 0.08, 3.0, 4, cb11X - 3.2, y + 1.50, cb11Z + s * 1.8);
    addBox(w11Gold, 0.26, 0.30, 0.26, cb11X - 3.2, y + 3.15, cb11Z + s * 1.8);
  }

  // 3689–3696: Đình Ngự Hà Đông — Lầu Vọng Thủy (East Outer Moat Water-Gate Watch Pavilion at nmX + 24.5, cz - 70.0)
  const nh11X = nmX + 24.5;
  const nh11Z = cz - 70.0;
  addBox(w11Stone, 6.2, 0.58, 6.8, nh11X, y + 0.29, nh11Z);
  addBox(w11Stone, 6.2, 0.65, 0.26, nh11X, y + 0.85, nh11Z - 3.25);
  addBox(w11Stone, 6.2, 0.65, 0.26, nh11X, y + 0.85, nh11Z + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w11Crimson, 0.10, 0.12, 3.15, 4, nh11X + ox, y + 1.98, nh11Z + oz);
    }
  }
  w11YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(nh11X, y + 4.22, nh11Z));
  w11Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(nh11X, y + 5.20, nh11Z));
  addBox(w11Porcelain, 0.42, 1.95, 3.6, nh11X + 3.6, y + 1.15, nh11Z);
  addCyl(w11Crimson, 0.06, 0.08, 3.8, 4, nh11X - 2.6, y + 2.15, nh11Z + 2.8);
  for (const s of [-1, 1]) {
    addCyl(w11Bronze, 0.14, 0.18, 0.55, 5, nh11X - 2.8, y + 0.82, nh11Z + s * 2.0);
    addBox(w11Stone, 0.45, 1.45, 0.45, nh11X + 2.8, y + 0.92, nh11Z + s * 3.0);
    addBox(w11Gold, 0.30, 0.34, 0.30, nh11X + 2.8, y + 1.82, nh11Z + s * 3.0);
  }

  // 3697–3704: Vườn Cơ Hạ — Đình Lục Giác Tứ Phương (NW Royal Orchid Hexagonal Pavilion at cx - 86.0, cz - 76.0)
  const ch11X = cx - 86.0;
  const ch11Z = cz - 76.0;
  addCyl(w11Stone, 3.5, 3.7, 0.52, 6, ch11X, y + 0.26, ch11Z);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w11Crimson, 0.10, 0.12, 3.15, 4, ch11X + Math.cos(a) * 2.4, y + 1.85, ch11Z + Math.sin(a) * 2.4);
  }
  w11JadeRoof.push(new THREE.ConeGeometry(3.6, 1.72, 6).translate(ch11X, y + 4.18, ch11Z));
  w11Gold.push(new THREE.ConeGeometry(0.26, 0.58, 4).translate(ch11X, y + 5.25, ch11Z));
  addCyl(w11Stone, 1.35, 2.05, 2.45, 5, ch11X + 5.8, y + 1.20, ch11Z + 4.5);
  addBox(w11Porcelain, 0.42, 1.95, 3.6, ch11X + 5.8, y + 1.02, ch11Z);
  addCyl(w11Stone, 0.62, 0.62, 0.72, 5, ch11X, y + 0.86, ch11Z);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w11Porcelain, 0.20, 0.18, 0.44, 4, ch11X + dx, y + 0.72, ch11Z + dz);
  }
  addBox(w11Stone, 0.85, 3.1, 0.85, ch11X + 9.2, y + 1.55, ch11Z - 2.0);
  addBox(w11Stone, 0.85, 3.1, 0.85, ch11X + 9.2, y + 1.55, ch11Z + 2.0);
  addBox(w11YellowRoof, 1.75, 0.60, 5.4, ch11X + 9.2, y + 3.35, ch11Z);

  // 3705–3708: Cửa Hiển Nhơn & Cửa Chương Đức far-outer-moat lantern pillars & bronze lotus cauldrons
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ + 15.2);
    addBox(w11Stone, 0.48, 1.45, 0.48, compX - 11.6, y + 0.72, gz);
    addBox(w11Gold, 0.30, 0.34, 0.30, compX - 11.6, y + 1.62, gz);
    addCyl(w11Bronze, 0.34, 0.26, 0.70, 5, compX + 11.6, y + 0.38, gz);
  }

  // 3709–3712, 3718–3724: Vườn Thiệu Phương — Thưởng Liên Tạ (SW Far-Outer Lotus Lakeside Pavilion at cx - 86.0, cz + 76.0)
  const tl11X = cx - 86.0;
  const tl11Z = cz + 76.0;
  addBox(w11Stone, 5.4, 0.50, 5.4, tl11X, y + 0.25, tl11Z);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w11Crimson, 0.10, 0.12, 3.15, 4, tl11X + ox, y + 1.90, tl11Z + oz);
    }
  }
  w11JadeRoof.push(new THREE.ConeGeometry(3.9, 1.65, 4).rotateY(Math.PI * 0.25).translate(tl11X, y + 4.22, tl11Z));
  w11Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(tl11X, y + 5.26, tl11Z));
  addBox(w11Wood, 2.2, 0.28, 5.8, tl11X + 5.6, y + 0.68, tl11Z);
  addCyl(w11Stone, 1.25, 1.95, 2.35, 5, tl11X + 5.6, y + 1.15, tl11Z - 5.4);
  addBox(w11Stone, 1.85, 0.46, 0.54, tl11X, y + 0.72, tl11Z);
  for (const s of [-1, 1]) {
    addCyl(w11Porcelain, 0.32, 0.24, 0.64, 5, tl11X + 3.4, y + 0.36, tl11Z + s * 2.2);
    addBox(w11Stone, 0.45, 1.35, 0.45, tl11X - 2.6, y + 0.68, tl11Z + s * 3.4);
  }

  // 3725–3760: Thế Miếu/Hưng Miếu far-outer Tán Lọng, Sân Đại Triều Nghi outer-east Phẩm Sơn steles,
  // Cần Chánh/Càn Thành, Kiến Trung, Duyệt Thị Đường, Quốc Tử Giám Academy Pavilion & avenue lamps
  for (const s of [-1, 1]) {
    addCyl(w11Crimson, 0.05, 0.06, 3.2, 4, cx + 27.5, y + 1.60, swZ + s * 13.5);
    w11Gold.push(new THREE.ConeGeometry(0.60, 0.45, 5).translate(cx + 27.5, y + 3.35, swZ + s * 13.5));
    addBox(w11Stone, 0.34, 1.15, 0.48, cx + 55.5, sanHaY + 0.58, cz + s * 7.8);
    addBox(w11Stone, 0.34, 1.15, 0.48, cx + 58.5, sanHaY + 0.58, cz + s * 7.8);
    addCyl(w11Gold, 0.26, 0.22, 0.68, 5, stairXTop + 4.8, sanThuongY + 0.36, cz + s * 22.8);
    addCyl(w11Bronze, 0.06, 0.08, 3.0, 4, ccW3X + 24.5, y + 1.50, cz + s * 8.5);
    addBox(w11Gold, 0.26, 0.30, 0.26, ccW3X + 24.5, y + 3.15, cz + s * 8.5);
    addCyl(w11Porcelain, 0.34, 0.26, 0.66, 5, ktX + 26.5, y + 0.36, cz + s * 11.5);
    addBox(w11Stone, 0.48, 1.35, 0.48, kdX + 25.2, y + 0.68, cz + s * 11.2);
    addCyl(w11Bronze, 0.06, 0.08, 3.1, 4, cx - 60.0, y + 1.55, cz + s * 10.5);
    addBox(w11Gold, 0.26, 0.32, 0.26, cx - 60.0, y + 3.25, cz + s * 10.5);
  }
  addBox(w11Porcelain, 0.42, 1.95, 3.4, dtdX + 24.5, y + 1.02, dtdZ - 10.5);
  addCyl(w11Bronze, 0.38, 0.46, 0.85, 5, dtdX + 20.5, y + 1.25, dtdZ + 8.8);
  // 3749–3754: Quốc Tử Giám 4-post royal academy stele pavilion (cx - 64.0, seZ + 28.5)
  const qtg11X = cx - 64.0;
  const qtg11Z = seZ + 28.5;
  addBox(w11Stone, 3.8, 0.42, 3.8, qtg11X, y + 0.21, qtg11Z);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w11Crimson, 0.09, 0.11, 2.95, 4, qtg11X + ox, y + 1.65, qtg11Z + oz);
    }
  }
  w11Terracotta.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(qtg11X, y + 3.72, qtg11Z));
  addBox(w11Stone, 0.40, 1.80, 0.92, qtg11X, y + 1.32, qtg11Z);

  addMerged(w11Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w11Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w11Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w11Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w11Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w11Wood, ctx.materials.darkWood, false, true);
  addMerged(w11YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w11JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w11Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w11Porcelain, hp.porcelainCobaltMat, false, true);

  // ==========================================================================
  // WAVE 12 UPGRADES (Items 4081–4112, 4118–4160): SW Far-Outer Cổng Tây Nam,
  // West Đình Ngự Hà Tây, Vườn Cơ Hạ Đông Đình Minh Nguyệt, Vườn Thiệu Phương Đông
  // Đình Thưởng Nguyệt, Tàng Thơ Lâu Archive Pavilion & Imperial Courtyard Furnishings
  // ==========================================================================
  const w12Stone: THREE.BufferGeometry[] = [];
  const w12Brick: THREE.BufferGeometry[] = [];
  const w12Crimson: THREE.BufferGeometry[] = [];
  const w12Gold: THREE.BufferGeometry[] = [];
  const w12Bronze: THREE.BufferGeometry[] = [];
  const w12Wood: THREE.BufferGeometry[] = [];
  const w12YellowRoof: THREE.BufferGeometry[] = [];
  const w12JadeRoof: THREE.BufferGeometry[] = [];
  const w12Terracotta: THREE.BufferGeometry[] = [];
  const w12Porcelain: THREE.BufferGeometry[] = [];

  // 4081–4088: Cổng Tây Nam — Ngoại Thành Tây Nam (SW Far-Outer Gatehouse at compX - compHalfX - 18.0, cz + 54.0)
  const cb12X = compX - compHalfX - 18.0;
  const cb12Z = cz + 54.0;
  addBox(w12Stone, 5.2, 0.52, 7.2, cb12X, y + 0.26, cb12Z);
  addBox(w12Brick, 2.4, 3.6, 1.55, cb12X, y + 2.15, cb12Z - 2.2);
  addBox(w12Brick, 2.4, 3.6, 1.55, cb12X, y + 2.15, cb12Z + 2.2);
  addBox(w12Brick, 2.4, 1.15, 6.2, cb12X, y + 4.25, cb12Z);
  addBox(w12Terracotta, 3.8, 0.88, 7.6, cb12X, y + 5.22, cb12Z);
  addBox(w12Gold, 0.22, 0.26, 5.6, cb12X, y + 5.75, cb12Z);
  addBox(w12Gold, 0.16, 0.58, 2.6, cb12X - 1.28, y + 4.25, cb12Z);
  addBox(w12Porcelain, 0.42, 1.95, 3.6, cb12X + 3.8, y + 1.02, cb12Z);
  for (const s of [-1, 1]) {
    addBox(w12Porcelain, 0.24, 0.85, 1.15, cb12X - 1.25, y + 3.45, cb12Z + s * 2.0);
    addBox(w12Stone, 0.45, 1.35, 0.45, cb12X - 3.2, y + 0.68, cb12Z + s * 3.2);
    addCyl(w12Bronze, 0.06, 0.08, 3.0, 4, cb12X - 3.2, y + 1.50, cb12Z + s * 1.8);
    addBox(w12Gold, 0.26, 0.30, 0.26, cb12X - 3.2, y + 3.15, cb12Z + s * 1.8);
  }

  // 4089–4096: Đình Ngự Hà Tây — Lầu Vọng Nguyệt (West Outer Moat Water-Gate Watch Pavilion at nmX + 24.5, cz + 70.0)
  const nh12X = nmX + 24.5;
  const nh12Z = cz + 70.0;
  addBox(w12Stone, 6.2, 0.58, 6.8, nh12X, y + 0.29, nh12Z);
  addBox(w12Stone, 6.2, 0.65, 0.26, nh12X, y + 0.85, nh12Z - 3.25);
  addBox(w12Stone, 6.2, 0.65, 0.26, nh12X, y + 0.85, nh12Z + 3.25);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w12Crimson, 0.10, 0.12, 3.15, 4, nh12X + ox, y + 1.98, nh12Z + oz);
    }
  }
  w12YellowRoof.push(new THREE.ConeGeometry(3.4, 1.55, 4).rotateY(Math.PI * 0.25).translate(nh12X, y + 4.22, nh12Z));
  w12Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(nh12X, y + 5.20, nh12Z));
  addBox(w12Porcelain, 0.42, 1.95, 3.6, nh12X + 3.6, y + 1.15, nh12Z);
  addCyl(w12Crimson, 0.06, 0.08, 3.8, 4, nh12X - 2.6, y + 2.15, nh12Z - 2.8);
  for (const s of [-1, 1]) {
    addCyl(w12Bronze, 0.14, 0.18, 0.55, 5, nh12X - 2.8, y + 0.82, nh12Z + s * 2.0);
    addBox(w12Stone, 0.45, 1.45, 0.45, nh12X + 2.8, y + 0.92, nh12Z + s * 3.0);
    addBox(w12Gold, 0.30, 0.34, 0.30, nh12X + 2.8, y + 1.82, nh12Z + s * 3.0);
  }

  // 4097–4104: Vườn Cơ Hạ Đông — Đình Minh Nguyệt (NE Royal Garden Hexagonal Pavilion at cx + 86.0, cz - 76.0)
  const ch12X = cx + 86.0;
  const ch12Z = cz - 76.0;
  addCyl(w12Stone, 3.5, 3.7, 0.52, 6, ch12X, y + 0.26, ch12Z);
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    addCyl(w12Crimson, 0.10, 0.12, 3.15, 4, ch12X + Math.cos(a) * 2.4, y + 1.85, ch12Z + Math.sin(a) * 2.4);
  }
  w12JadeRoof.push(new THREE.ConeGeometry(3.6, 1.72, 6).translate(ch12X, y + 4.18, ch12Z));
  w12Gold.push(new THREE.ConeGeometry(0.26, 0.58, 4).translate(ch12X, y + 5.25, ch12Z));
  addCyl(w12Stone, 1.35, 2.05, 2.45, 5, ch12X - 5.8, y + 1.20, ch12Z + 4.5);
  addBox(w12Porcelain, 0.42, 1.95, 3.6, ch12X - 5.8, y + 1.02, ch12Z);
  addCyl(w12Stone, 0.62, 0.62, 0.72, 5, ch12X, y + 0.86, ch12Z);
  for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]] as const) {
    addCyl(w12Porcelain, 0.20, 0.18, 0.44, 4, ch12X + dx, y + 0.72, ch12Z + dz);
  }
  addBox(w12Stone, 0.85, 3.1, 0.85, ch12X - 9.2, y + 1.55, ch12Z - 2.0);
  addBox(w12Stone, 0.85, 3.1, 0.85, ch12X - 9.2, y + 1.55, ch12Z + 2.0);
  addBox(w12YellowRoof, 1.75, 0.60, 5.4, ch12X - 9.2, y + 3.35, ch12Z);

  // 4105–4108: Cửa Hiển Nhơn & Cửa Chương Đức far-outer-east/west lantern pillars & bronze drums
  for (const s of [-1, 1]) {
    const gz = cz + s * (compHalfZ + 15.2);
    addBox(w12Stone, 0.48, 1.45, 0.48, compX - 15.8, y + 0.72, gz);
    addBox(w12Gold, 0.30, 0.34, 0.30, compX - 15.8, y + 1.62, gz);
    addCyl(w12Bronze, 0.34, 0.26, 0.70, 5, compX + 15.8, y + 0.38, gz);
  }

  // 4109–4112, 4118–4124: Vườn Thiệu Phương Đông — Đình Thưởng Nguyệt (SE Far-Outer Lotus Lakeside Pavilion at cx + 86.0, cz + 76.0)
  const tl12X = cx + 86.0;
  const tl12Z = cz + 76.0;
  addBox(w12Stone, 5.4, 0.50, 5.4, tl12X, y + 0.25, tl12Z);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.9, 1.9]) {
      addCyl(w12Crimson, 0.10, 0.12, 3.15, 4, tl12X + ox, y + 1.90, tl12Z + oz);
    }
  }
  w12JadeRoof.push(new THREE.ConeGeometry(3.9, 1.65, 4).rotateY(Math.PI * 0.25).translate(tl12X, y + 4.22, tl12Z));
  w12Gold.push(new THREE.ConeGeometry(0.24, 0.55, 4).translate(tl12X, y + 5.26, tl12Z));
  addBox(w12Wood, 2.2, 0.28, 5.8, tl12X - 5.6, y + 0.68, tl12Z);
  addCyl(w12Stone, 1.25, 1.95, 2.35, 5, tl12X - 5.6, y + 1.15, tl12Z - 5.4);
  addBox(w12Stone, 1.85, 0.46, 0.54, tl12X, y + 0.72, tl12Z);
  for (const s of [-1, 1]) {
    addCyl(w12Porcelain, 0.32, 0.24, 0.64, 5, tl12X - 3.4, y + 0.36, tl12Z + s * 2.2);
    addBox(w12Stone, 0.45, 1.35, 0.45, tl12X + 2.6, y + 0.68, tl12Z + s * 3.4);
  }

  // 4125–4160: Thế Miếu/Hưng Miếu bronze cranes, Sân Đại Triều Nghi outer-east Phẩm Sơn steles,
  // Cần Chánh/Càn Thành, Kiến Trung, Duyệt Thị Đường, Tàng Thơ Lâu Archive Pavilion & avenue lamps
  for (const s of [-1, 1]) {
    addCyl(w12Bronze, 0.14, 0.20, 1.45, 5, cx + 31.5, y + 0.72, swZ + s * 13.5);
    w12Gold.push(new THREE.ConeGeometry(0.32, 0.48, 4).translate(cx + 31.5, y + 1.68, swZ + s * 13.5));
    addBox(w12Stone, 0.34, 1.15, 0.48, cx + 61.5, sanHaY + 0.58, cz + s * 7.8);
    addBox(w12Stone, 0.34, 1.15, 0.48, cx + 64.5, sanHaY + 0.58, cz + s * 7.8);
    addCyl(w12Gold, 0.26, 0.22, 0.68, 5, stairXTop + 7.2, sanThuongY + 0.36, cz + s * 22.8);
    addCyl(w12Bronze, 0.06, 0.08, 3.0, 4, ccW3X + 27.5, y + 1.50, cz + s * 8.5);
    addBox(w12Gold, 0.26, 0.30, 0.26, ccW3X + 27.5, y + 3.15, cz + s * 8.5);
    addCyl(w12Porcelain, 0.34, 0.26, 0.66, 5, ktX + 29.5, y + 0.36, cz + s * 11.5);
    addBox(w12Stone, 0.48, 1.35, 0.48, kdX + 28.2, y + 0.68, cz + s * 11.2);
    addCyl(w12Bronze, 0.06, 0.08, 3.1, 4, cx - 66.0, y + 1.55, cz + s * 10.5);
    addBox(w12Gold, 0.26, 0.32, 0.26, cx - 66.0, y + 3.25, cz + s * 10.5);
  }
  addBox(w12Porcelain, 0.42, 1.95, 3.4, dtdX + 27.5, y + 1.02, dtdZ - 10.5);
  addCyl(w12Bronze, 0.38, 0.46, 0.85, 5, dtdX + 23.5, y + 1.25, dtdZ + 8.8);
  // 4149–4154: Tàng Thơ Lâu 4-post royal archive stele pavilion (cx - 64.0, seZ - 28.5)
  const ttl12X = cx - 64.0;
  const ttl12Z = seZ - 28.5;
  addBox(w12Stone, 3.8, 0.42, 3.8, ttl12X, y + 0.21, ttl12Z);
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w12Crimson, 0.09, 0.11, 2.95, 4, ttl12X + ox, y + 1.65, ttl12Z + oz);
    }
  }
  w12Terracotta.push(new THREE.ConeGeometry(2.9, 1.38, 4).rotateY(Math.PI * 0.25).translate(ttl12X, y + 3.72, ttl12Z));
  addBox(w12Stone, 0.40, 1.80, 0.92, ttl12X, y + 1.32, ttl12Z);

  addMerged(w12Stone, hp.thanhStoneMat, false, true, 3.0);
  addMerged(w12Brick, hp.bastionBrickMat, false, true, 2.6);
  addMerged(w12Crimson, hp.imperialCrimsonWoodMat, false, true, 1.8);
  addMerged(w12Gold, hp.imperialGoldLeafMat, false, false, 1.2);
  addMerged(w12Bronze, hp.antiqueBronzeCauldronMat, false, true);
  addMerged(w12Wood, ctx.materials.darkWood, false, true);
  addMerged(w12YellowRoof, hp.hoangLuuLyMat, false, true);
  addMerged(w12JadeRoof, hp.thanhLuuLyMat, false, true);
  addMerged(w12Terracotta, ctx.materials.terracottaRoof, false, true);
  addMerged(w12Porcelain, hp.porcelainCobaltMat, false, true);

  const palMat = ctx.materials.lanternCore ?? ctx.materials.gold;
  ctx.scene.add(group);
  return { group, palMat };
}
