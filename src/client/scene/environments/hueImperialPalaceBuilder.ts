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
  // Item 038: Trùng Thiềm Điệp Ốc double-roof valley gutter beam & Lưỡng Long Chầu Nhật flaming pearl finial
  addBox(darkWoodParts, 0.48, 0.34, widthZ - 3.8, hx, lowerEaveY + lowRoofH + 0.12, cz);
  const pearl = new THREE.SphereGeometry(0.24, 8, 6);
  pearl.translate(frontHallX + 0.4, upperBaseY + upperRoofH + 0.65, cz);
  goldParts.push(pearl);
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
    [cx - 40, cz - 34, 1.65, 13],
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
  addRoyalGardenTree(woodParts, foliageParts, cx - 82, y + 0.32, cz - 53.0, 1.1, 88);
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
      addCyl(crimsonParts, 0.14, 0.16, 4.4, 6, archX, y + 2.8, cz + az);
    }
    addBox(goldParts, 0.42, 0.45, 7.4, archX, y + 4.9, cz);
    addBox(yellowRoofParts, 0.85, 0.36, 7.8, archX, y + 5.3, cz);
    bronzeParts.push(...createGuardianBeastParts(archX, y + 5.5, cz, Math.PI * 0.5, 0.55, 'kylan'));
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
  goldParts.push(new THREE.SphereGeometry(0.28, 8, 6).translate(nmX, y + 10.4, cz));
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
      addCyl(crimsonParts, 0.14, 0.16, 3.0, 6, cvX - 1.8, y + 1.9, cvZ + pzOff);
      addCyl(crimsonParts, 0.14, 0.16, 3.0, 6, cvX + 1.8, y + 1.9, cvZ + pzOff);
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

  const ccX = cx - 59;
  addBox(thanhStoneParts, 18.0, 1.15, 26.0, ccX, y + 0.575, cz);
  addBox(thanhStoneParts, 16.2, 0.25, 24.2, ccX, y + 1.25, cz);
  for (const s of [-1, 0, 1]) {
    addBox(thanhStoneParts, 2.6, 0.9, 3.2, ccX + 9.8, y + 0.45, cz + s * 7.4);
  }

  // Interconnected Emerald `Trường Lang` Corridor Network + East-West Gallery Link to Cung Diên Thọ + `Thái Bình Lâu` Pavilion!
  for (const s of [-1, 1]) {
    const tlZ = cz + s * 22.0;
    addBox(thanhStoneParts, 28.0, 0.50, 3.6, cx - 71, y + 0.25, tlZ);
    for (let k = 0; k < 8; k++) {
      const px = cx - 58 - k * 3.5;
      addCyl(crimsonParts, 0.14, 0.16, 3.2, 6, px, y + 2.1, tlZ - 1.3);
      addCyl(crimsonParts, 0.14, 0.16, 3.2, 6, px, y + 2.1, tlZ + 1.3);
    }
    jadeRoofParts.push(createHueImperialHipRoofGeometry(29.0, 4.8, 25.0, 0.6, 1.35, 0.20).translate(cx - 71, y + 3.7, tlZ));
  }
  // Cross-corridor linking Trường Lang west toward Cung Diên Thọ (+Z)
  jadeRoofParts.push(createHueImperialHipRoofGeometry(4.4, 24.0, 0.8, 20.0, 1.25, 0.18).translate(cx - 64, y + 3.6, cz + 35.0));
  // NE inner `Thái Bình Lâu` (Imperial Reading Pavilion)
  addBox(thanhStoneParts, 8.8, 0.75, 11.2, cx - 76, y + 0.375, cz - 14.0);
  addBox(crimsonParts, 7.2, 3.8, 9.4, cx - 76, y + 2.65, cz - 14.0);
  yellowRoofParts.push(createHueImperialHipRoofGeometry(9.8, 12.2, 3.4, 5.4, 2.2, 0.24).translate(cx - 76, y + 4.55, cz - 14.0));
  // Item 062: Thái Bình Lâu Khảm Sành Sứ porcelain-mosaic ridge finials & Hòn Non Bộ rockery
  goldParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(cx - 76, y + 6.95, cz - 14.0));
  addBox(thanhStoneParts, 2.2, 1.45, 2.2, cx - 69.5, y + 0.72, cz - 14.0);
  // Item 064 & 065: Điện Cần Chánh axial stone terrace behind Điện Thái Hòa & Trường Lang balustrade lanterns
  addBox(thanhStoneParts, 12.0, 0.55, 22.0, cx - 50.0, y + 0.28, cz);
  for (const s of [-1, 1]) {
    addBox(crimsonParts, 28.0, 0.65, 0.14, cx - 71, y + 0.82, cz + s * 22.0 - 1.3);
  }
  // Item 066 & 067 & 068 & 069 & 077: Điện Kiến Trung Art-Deco crest, Cung Diên Thọ rockery, Duyệt Thị Đường portico, Vườn Cơ Hạ moon-bridge & Phủ Nội Vụ wells
  goldParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(compX - compHalfX + 13.0, y + 12.0, cz));
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
  yellowRoofParts.push(createHueImperialHipRoofGeometry(13.8, 30.8, 4.2, 21.0, 2.6, 0.24).translate(ktX, y + 8.3, cz));
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

  // Rhythmic Royal Shade Trees lining Đường số 1, Đường số 2, Vườn Cơ Hạ & outer lawns (EX-29!)
  for (let t = 0; t < 16; t++) {
    const gx = cx + 24 - (t % 8) * 14.5;
    const gz = cz + (t < 8 ? -34 : 34) + ((t * 5) % 7) - 3;
    addRoyalGardenTree(woodParts, foliageParts, gx, y, gz, 1.12, 30 + t);
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

  const palMat = ctx.materials.lanternCore ?? ctx.materials.gold;
  ctx.scene.add(group);
  return { group, palMat };
}
