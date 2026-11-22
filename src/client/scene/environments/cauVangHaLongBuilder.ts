import * as THREE from 'three';
import {
  VietnamBuilderContext,
  mergeNormalized,
  createArchedWallGeometry,
  createGableRoofGeometry,
  createHaLongKarstGeometry,
  createSculptedRockGeometry,
  createWavingSilkFlagMaterial
} from './vietnamGeometryHelpers';
import {
  createSmoothTaperedTubeGeometry,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  getGoldenBridgeCurveAtX
} from '../shaders/vietnamHeritageShader';
import {
  createMergedMesh
} from '../vietnam/geometry/PartsBuilder';
import {
  createCauVangHaLongMaterialPack,
  CVHL_ART_UV,
  CVHL_RELIEF_UV,
  type CauVangHaLongMaterialPack,
  type CvhlArtKey,
  type CvhlReliefKey
} from '../textures/cauVangHaLongPbrTextures';

/**
 * Cầu Vàng (Bà Nà Hills) & Vịnh Hạ Long Museum Builder — implements all 128 QC items:
 *   - Cầu Vàng Giant Mossy Stone Hands & Sweeping 150m Arc (`CV-01..32`)
 *   - Cầu Vàng Merbau Walkway, Lobelia Troughs, Marseille Station & Le Jardin d'Amour (`CW-01..32`)
 *   - Vịnh Hạ Long Hòn Trống Mái, Hòn Đỉnh Hương (200k VND) & Stratified Karsts (`HL-01..32`)
 *   - Vịnh Hạ Long Bat-Wing Junk Boats, Làng Chài Cửa Vạn & Đảo Ti Tốp (`HJ-01..32`)
 *
 * Shares ONE single 2048×3072 Master PBR & Artwork Atlas (`cauVangHaLongMasterAtlasMat`)
 * across BOTH landmarks -> net reduction of 10+ GPU materials vs legacy!
 */

const cvhlPackCache = new WeakMap<THREE.Scene, CauVangHaLongMaterialPack>();

function getOrCreateCvhlPack(ctx: VietnamBuilderContext): CauVangHaLongMaterialPack {
  let pack = cvhlPackCache.get(ctx.scene);
  if (!pack) {
    pack = createCauVangHaLongMaterialPack(ctx.renderer);
    cvhlPackCache.set(ctx.scene, pack);
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

function remapRelief(geo: THREE.BufferGeometry, key: CvhlReliefKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, CVHL_RELIEF_UV[key], inset);
}

function remapArt(geo: THREE.BufferGeometry, key: CvhlArtKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, CVHL_ART_UV[key], inset);
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: CvhlReliefKey,
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
  key: CvhlReliefKey,
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
  key: CvhlArtKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const g = remapArt(new THREE.PlaneGeometry(w, h), key);
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

function addForestTree(
  barkParts: THREE.BufferGeometry[],
  leafParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number,
  palette: number[]
): void {
  const rand = mulberry32(seed);
  const trunkH = (4.2 + rand() * 1.4) * scale;
  const trunk = new THREE.CylinderGeometry(0.18 * scale, 0.36 * scale, trunkH, 7);
  trunk.translate(x, y + trunkH * 0.5, z);
  barkParts.push(trunk);

  for (let tier = 0; tier < 3; tier++) {
    const ty = y + trunkH * (0.68 + tier * 0.34);
    const rad = (2.6 - tier * 0.55) * scale;
    const count = 4;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + tier * 0.6 + rand() * 0.4;
      const card = new THREE.PlaneGeometry(rad * 1.45, rad * 1.15);
      card.rotateY(a);
      card.rotateX((k % 2 === 0 ? 1 : -1) * 0.25);
      card.translate(x + Math.cos(a) * rad * 0.35, ty, z + Math.sin(a) * rad * 0.35);
      colorizeGeo(card, palette[(tier + k) % palette.length]);
      leafParts.push(card);
    }
  }
}

/**
 * ============================================================================
 * PART 1: CẦU VÀNG — BÀ NÀ HILLS (GIANT MOSSY HANDS, 150M ARC, MARSEILLE & LE JARDIN D'AMOUR)
 * Implements CV-01..CV-32 & CW-01..CW-32
 * ============================================================================
 */
export function buildGoldenBridgeComplex(ctx: VietnamBuilderContext): THREE.Group {
  const pack = getOrCreateCvhlPack(ctx);
  const group = new THREE.Group();
  group.name = 'GoldenBridgeComplex';

  ctx.exclusionCircles.push(
    { x: -78, z: -145, r: 16.0 },
    { x: -84, z: -145, r: 15.0 },
    { x: 78, z: -145, r: 16.0 },
    { x: 84, z: -145, r: 15.0 },
    { x: -30, z: -143, r: 15.0 },
    { x: 30, z: -143, r: 15.0 },
    { x: 0, z: -143, r: 18.0 } // Prevents stray mid-bridge tree clipping (CV-24)!
  );

  const atlasParts: THREE.BufferGeometry[] = [];
  const handParts: THREE.BufferGeometry[] = [];
  const goldMetalParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  // --------------------------------------------------------------------------
  // 1. SWEEPING 150M CHAMPAGNE-GOLD BRIDGE SPAN, MERBAU TIMBER DECK, DENSE GOLD RAILINGS & PURPLE LOBELIA TROUGHS (CV-17..23, CW-01..18)
  // --------------------------------------------------------------------------
  const segs = 56;
  const deckHalfW = 2.75; // 5.5m wide authentic walkway

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const x0 = THREE.MathUtils.lerp(-75, 75, t0);
    const x1 = THREE.MathUtils.lerp(-75, 75, t1);
    const c0 = getGoldenBridgeCurveAtX(x0);
    const c1 = getGoldenBridgeCurveAtX(x1);

    const xm = (x0 + x1) * 0.5;
    const ym = (c0.y + c1.y) * 0.5;
    const zm = (c0.z + c1.z) * 0.5;
    const dx = x1 - x0;
    const dy = c1.y - c0.y;
    const dz = c1.z - c0.z;
    const segLen = Math.hypot(dx, dy, dz) + 0.08;
    const yaw = -Math.atan2(dz, dx);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));

    const orient = (g: THREE.BufferGeometry) => {
      g.rotateZ(pitch);
      g.rotateY(yaw);
      g.translate(xm, ym, zm);
      return g;
    };

    // Warm reddish-brown Merbau timber plank walkway (CW-01..05)
    atlasParts.push(
      orient(remapRelief(new THREE.BoxGeometry(segLen, 0.24, 3.85), 'merbauTimberDeck'))
    );

    // Signature deep convex champagne-gold outer hull shell tapering into rounded underside soffit (CV-18..19, CW-10..11)
    const upperShell = remapRelief(new THREE.BoxGeometry(segLen, 0.72, deckHalfW * 2 + 0.42), 'champagneGoldCladding');
    upperShell.translate(0, -0.34, 0);
    const midBelly = remapRelief(new THREE.BoxGeometry(segLen, 0.62, deckHalfW * 2 - 0.35), 'champagneGoldCladding');
    midBelly.translate(0, -0.86, 0);
    const lowerSpine = remapRelief(new THREE.BoxGeometry(segLen, 0.42, deckHalfW * 1.15), 'champagneGoldCladding');
    lowerSpine.translate(0, -1.26, 0);
    atlasParts.push(orient(upperShell), orient(midBelly), orient(lowerSpine));

    // Continuous Purple Lobelia Chrysanthemum flowerbed troughs on BOTH inner edges (CW-13..18)
    for (const side of [-1, 1]) {
      const curb = remapRelief(new THREE.BoxGeometry(segLen, 0.32, 0.74), 'slateMansardRoof');
      curb.translate(0, 0.24, side * 2.18);
      const bloomTrough = remapRelief(new THREE.BoxGeometry(segLen, 0.36, 0.68), 'lobeliaVioletBloom');
      bloomTrough.translate(0, 0.48, side * 2.18);
      // Organic billowing floral crown mound spilling softly over curb
      const puff = remapRelief(new THREE.CylinderGeometry(0.28, 0.36, segLen, 6), 'lobeliaVioletBloom');
      puff.rotateZ(Math.PI * 0.5);
      puff.translate(0, 0.62, side * 2.16);
      atlasParts.push(orient(curb), orient(bloomTrough), orient(puff));

      // Dense brushed champagne-gold stainless-steel handrails & vertical balusters (3.5× density! CW-06..09)
      const railZ = side * (deckHalfW + 0.06);
      const topRail = new THREE.BoxGeometry(segLen, 0.085, 0.095);
      topRail.translate(0, 1.24, railZ);
      const midRail = new THREE.BoxGeometry(segLen, 0.055, 0.06);
      midRail.translate(0, 0.68, railZ);
      const baseRail = new THREE.BoxGeometry(segLen, 0.075, 0.09);
      baseRail.translate(0, 0.16, railZ);
      goldMetalParts.push(orient(topRail), orient(midRail), orient(baseRail));

      // 5 tightly-spaced vertical balusters per segment (~0.52m spacing -> comb-like golden rhythm!)
      for (let b = 0; b < 5; b++) {
        const bx = ((b + 0.5) / 5 - 0.5) * segLen;
        const post = new THREE.BoxGeometry(0.042, 1.12, 0.042);
        post.translate(bx, 0.68, railZ);
        goldMetalParts.push(orient(post));
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. DARK FOREST-GREEN STEEL PIERS WITH RIBBED COLLARS & 4-WAY GOLD V-STRUTS (CV-22..23, CW-12)
  // --------------------------------------------------------------------------
  const pierXs = [-62, -46, -15, 0, 15, 46, 62];
  for (const px of pierXs) {
    const pc = getGoldenBridgeCurveAtX(px);
    const groundY = ctx.getHeight(px, pc.z) - 2.5;
    const colTopY = pc.y - 3.4;
    const colH = Math.max(4.0, colTopY - groundY);

    atlasParts.push(
      makeReliefCyl(0.54, 0.64, colH, 14, 'greenSteelPier', px, groundY + colH * 0.5, pc.z),
      // Ribbed ornamental collar capital rings
      makeReliefCyl(0.84, 0.68, 0.55, 14, 'greenSteelPier', px, colTopY, pc.z),
      makeReliefCyl(0.92, 0.88, 0.18, 14, 'champagneGoldCladding', px, colTopY + 0.34, pc.z)
    );
    // 4-way splayed tapered champagne-gold V-struts cradling the bridge soffit
    for (const [sx, sz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) {
      const p0 = new THREE.Vector3(px, colTopY + 0.32, pc.z);
      const p1 = new THREE.Vector3(px + sx, pc.y - 1.28, pc.z + sz);
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const strut = new THREE.CylinderGeometry(0.14, 0.22, dir.length(), 8);
      strut.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
      strut.translate((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5, (p0.z + p1.z) * 0.5);
      goldMetalParts.push(strut);
    }
  }

  // --------------------------------------------------------------------------
  // 3. ANATOMICALLY RESCULPTED GIANT MOSSY STONE HANDS CRADLING THE GOLDEN RIBBON (CV-01..16, CW-19..25)
  // Opposing cupped pair at x = -28 & x = +28: forearm rises diagonally from jagged granite cliff,
  // sculpted palm cradles soffit from underneath, giant thumb wraps UPWARD in front of South fascia,
  // 4 articulated 3-phalanx fingers (natural length ratios + sculpted fingernails) rise behind North rail!
  // --------------------------------------------------------------------------
  const addSculptedGiantHand = (hx: number, sideSign: -1 | 1) => {
    const hc = getGoldenBridgeCurveAtX(hx);
    const groundY = ctx.getHeight(hx, hc.z + 9.0);
    const palmX = hx;
    const palmY = hc.y - 2.75; // Cradles cleanly beneath golden bridge soffit — ZERO deck poke-through!
    const palmZ = hc.z + 0.35;

    // A. Jagged multi-tiered granite cliff anchor outcrop embedded deep into the forested slope (CV-10, CW-25)
    const wristBaseX = hx + sideSign * 4.2;
    const wristBaseY = Math.max(groundY - 1.5, hc.y - 18.5);
    const wristBaseZ = hc.z + 11.2;
    for (let r = 0; r < 5; r++) {
      const a = (r / 5) * Math.PI * 2;
      const rock = remapRelief(
        createSculptedRockGeometry(8100 + (sideSign > 0 ? 100 : 0) + r * 19, 4.8 - r * 0.4, 4.2, 4.4 - r * 0.3, 2),
        'giantHandMossyStone'
      );
      rock.translate(wristBaseX + Math.cos(a) * 2.2, wristBaseY + 1.5, wristBaseZ + Math.sin(a) * 2.2);
      handParts.push(rock);
    }

    // B. Diagonally angled (~40deg) muscled stone forearm & wrist cuff rising to cup the palm (CV-09)
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wristBaseX, wristBaseY + 1.2, wristBaseZ),
      new THREE.Vector3(THREE.MathUtils.lerp(wristBaseX, palmX, 0.45), THREE.MathUtils.lerp(wristBaseY, palmY, 0.45) - 1.2, THREE.MathUtils.lerp(wristBaseZ, palmZ, 0.45)),
      new THREE.Vector3(palmX + sideSign * 0.6, palmY - 2.6, palmZ + 2.8),
      new THREE.Vector3(palmX, palmY, palmZ)
    ]);
    const forearm = remapRelief(
      createSmoothTaperedTubeGeometry(armCurve, 18, 12, (t) => 3.55 - t * 0.72 + Math.sin(t * Math.PI * 3) * 0.14),
      'giantHandMossyStone'
    );
    handParts.push(forearm);

    // C. Massive volumetric cupped palm cradling the bridge soffit (thenar + hypothenar muscle pads! CV-04)
    const palmCore = remapRelief(new THREE.SphereGeometry(3.85, 14, 12), 'giantHandMossyStone');
    palmCore.scale(1.38, 0.62, 1.15);
    palmCore.translate(palmX, palmY + 0.15, palmZ);
    const thenarPad = remapRelief(new THREE.SphereGeometry(2.35, 12, 10), 'giantHandMossyStone');
    thenarPad.scale(1.15, 0.85, 1.10);
    thenarPad.translate(palmX - sideSign * 2.4, palmY + 0.75, palmZ + 2.2);
    const hypothenarPad = remapRelief(new THREE.SphereGeometry(2.15, 12, 10), 'giantHandMossyStone');
    hypothenarPad.scale(1.15, 0.78, 1.05);
    hypothenarPad.translate(palmX + sideSign * 2.5, palmY + 0.45, palmZ + 0.8);
    handParts.push(palmCore, thenarPad, hypothenarPad);

    // Helper for articulated 3-phalanx stone finger/thumb with knuckle bulges & recessed sculpted fingernail!
    const addArticulatedDigit = (pts: THREE.Vector3[], baseR: number, tipR: number) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const digit = remapRelief(
        createSmoothTaperedTubeGeometry(curve, 16, 10, (t) => {
          const baseTaper = THREE.MathUtils.lerp(baseR, tipR, t);
          // Distinct MCP / PIP / DIP knuckle bulges
          const knuckle = 0.12 * baseR * (
            Math.exp(-Math.pow((t - 0.34) / 0.08, 2)) +
            Math.exp(-Math.pow((t - 0.68) / 0.07, 2))
          );
          return baseTaper + knuckle;
        }),
        'giantHandMossyStone'
      );
      handParts.push(digit);

      // Rounded fingertip dome + sculpted dorsal stone fingernail plate (CV-08, CW-22)
      const tip = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const tipDir = new THREE.Vector3().subVectors(tip, prev).normalize();
      const cap = remapRelief(new THREE.SphereGeometry(tipR * 1.02, 10, 8), 'giantHandMossyStone');
      cap.translate(tip.x, tip.y, tip.z);
      const nail = remapRelief(new THREE.BoxGeometry(tipR * 1.15, tipR * 1.45, tipR * 0.32), 'chateauAshlarStone');
      nail.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir));
      nail.translate(tip.x - tipDir.x * tipR * 0.45, tip.y - tipDir.y * tipR * 0.45, tip.z + tipR * 0.78);
      handParts.push(cap, nail);
    };

    // D. GIANT UPWARD-SWEEPING THUMB wrapping IN FRONT OF the outer (South, +Z) champagne-gold fascia! (CV-01..02, CW-20..21)
    addArticulatedDigit(
      [
        new THREE.Vector3(palmX - sideSign * 2.8, palmY + 0.6, palmZ + 2.4),
        new THREE.Vector3(palmX - sideSign * 3.8, palmY + 2.4, palmZ + 3.45),
        new THREE.Vector3(palmX - sideSign * 3.2, palmY + 4.8, palmZ + 3.55),
        new THREE.Vector3(palmX - sideSign * 2.1, palmY + 6.9, palmZ + 3.05) // Rises proudly above outer gold handrail!
      ],
      1.32,
      0.86
    );

    // E. 4 ARTICULATED FINGERS rising cleanly just behind the North (-Z) railing with anatomical length ratios! (CV-05..07)
    // Order from inner (index) to outer (pinky): index, tallest middle, ring, shorter gently splayed pinky
    const fingerSpecs = [
      { idxOff: -2.45, height: 7.4, splayX: -0.25, baseR: 1.04, tipR: 0.68 }, // Index
      { idxOff: -0.82, height: 8.4, splayX: -0.05, baseR: 1.08, tipR: 0.70 }, // Middle (tallest!)
      { idxOff: 0.88, height: 7.5, splayX: 0.12, baseR: 1.02, tipR: 0.66 },   // Ring
      { idxOff: 2.45, height: 6.1, splayX: 0.48, baseR: 0.88, tipR: 0.56 }    // Pinky (shorter & gently splayed!)
    ];
    for (const f of fingerSpecs) {
      const fx = palmX + sideSign * f.idxOff;
      const fz = palmZ - 2.65;
      addArticulatedDigit(
        [
          new THREE.Vector3(fx, palmY + 0.35, palmZ - 1.35),
          new THREE.Vector3(fx + sideSign * f.splayX * 0.4, palmY + f.height * 0.36, fz - 0.95),
          new THREE.Vector3(fx + sideSign * f.splayX * 0.8, palmY + f.height * 0.72, fz - 1.12),
          new THREE.Vector3(fx + sideSign * f.splayX, palmY + f.height, fz - 0.62) // Gentle inward arch cradling walkway!
        ],
        f.baseR,
        f.tipR
      );
    }
  };

  addSculptedGiantHand(-28.0, -1);
  addSculptedGiantHand(28.0, 1);

  // --------------------------------------------------------------------------
  // 4. MARSEILLE CABLE CAR STATION (WEST BLUFF -82, -145) & LE JARDIN D'AMOUR PAVILION (EAST BLUFF +82, -145) (CW-27..29)
  // --------------------------------------------------------------------------
  const buildFrenchChateauStation = (sx: number, sz: number, isWest: boolean) => {
    const cEnd = getGoldenBridgeCurveAtX(isWest ? -75 : 75);
    const baseY = cEnd.y - 0.25;
    // Stone arrival terrace plinth
    atlasParts.push(
      makeReliefBox(14.5, 9.5, 13.5, 'chateauAshlarStone', sx, baseY - 4.75, sz),
      makeReliefBox(14.8, 0.35, 13.8, 'baNaMosaicPaver', sx, baseY, sz)
    );
    // Main French-château ashlar limestone facade with arched portal
    const archWall = remapRelief(
      normalizeExtrudeUv(createArchedWallGeometry(9.6, 6.4, 8.2, 4.4, 4.8)),
      'chateauAshlarStone'
    );
    archWall.rotateY(Math.PI * 0.5);
    archWall.translate(sx + (isWest ? -2.2 : 2.2), baseY + 0.15, sz);
    atlasParts.push(archWall);

    // Corner cylindrical stone turrets + charcoal-blue French slate mansard roofs
    for (const tz of [-4.6, 4.6]) {
      atlasParts.push(
        makeReliefCyl(1.65, 1.75, 7.6, 14, 'chateauAshlarStone', sx + (isWest ? 2.4 : -2.4), baseY + 3.9, sz + tz),
        makeReliefCyl(0.12, 1.95, 3.8, 14, 'slateMansardRoof', sx + (isWest ? 2.4 : -2.4), baseY + 9.6, sz + tz)
      );
    }
    // Main French slate mansard roof crowning the station
    atlasParts.push(
      makeReliefBox(9.2, 2.8, 10.6, 'slateMansardRoof', sx + (isWest ? -2.2 : 2.2), baseY + 7.9, sz),
      makeReliefBox(7.2, 0.85, 8.4, 'slateMansardRoof', sx + (isWest ? -2.2 : 2.2), baseY + 9.6, sz),
      // Gilded French colonial station plaque
      makeReliefBox(0.18, 1.05, 4.6, 'champagneGoldCladding', sx + (isWest ? 2.1 : -2.1), baseY + 5.65, sz),
      makeArtPlane(4.4, 0.92, 'marseilleStationSign', sx + (isWest ? 2.22 : -2.22), baseY + 5.65, sz, isWest ? Math.PI * 0.5 : -Math.PI * 0.5)
    );
  };
  buildFrenchChateauStation(-82.5, -145.5, true);
  buildFrenchChateauStation(82.5, -145.5, false);

  // --------------------------------------------------------------------------
  // 5. CURVED TERRACED MOSAIC GARDEN WALKWAY + LUSH MULTI-LAYERED BÀ NÀ FOREST CANOPY (CV-27..28, CW-30..31)
  // --------------------------------------------------------------------------
  for (let w = -44; w <= 44; w += 8) {
    const wz = -126 + Math.sin(w * 0.06) * 4.5;
    const wy = ctx.getHeight(w, wz);
    atlasParts.push(
      makeReliefBox(8.2, 0.35, 3.2, 'baNaMosaicPaver', w, wy + 0.18, wz),
      // White spherical stone bowl planter flanking terrace path
      makeReliefCyl(0.55, 0.38, 0.58, 10, 'chateauAshlarStone', w, wy + 0.58, wz + 1.85)
    );
  }
  // Dense layered Bà Nà evergreen & broadleaf forest canopies framing the wrists & piers (NO low-poly green cones!)
  const baNaPalette = [0x1f4d22, 0x2c6629, 0x3b7832, 0x567a2e];
  const forestSpots: Array<[number, number, number, number]> = [
    [-54, -132, 1.35, 901], [-42, -128, 1.45, 902], [-34, -124, 1.25, 903],
    [-16, -132, 1.40, 904], [-4, -128, 1.35, 905], [10, -131, 1.42, 906],
    [22, -125, 1.30, 907], [38, -129, 1.48, 908], [52, -133, 1.38, 909],
    [-64, -136, 1.42, 910], [64, -136, 1.42, 911], [-22, -152, 1.55, 912],
    [22, -152, 1.55, 913], [0, -155, 1.62, 914]
  ];
  for (const [fx, fz, fs, fSeed] of forestSpots) {
    const fy = ctx.getHeight(fx, fz);
    addForestTree(barkParts, leafParts, fx, fy - 0.5, fz, fs, fSeed, baNaPalette);
  }

  // Merge all batches using 1 Master Atlas + shared materials!
  const brushedGoldMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#d8ba68',
        metalness: 0.84,
        roughness: 0.28
      })
    : ctx.materials.gold;
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

  const atlasMesh = createMergedMesh('GoldenBridgeAtlasMesh', atlasParts, pack.cauVangHaLongMasterAtlasMat, true, true);
  if (atlasMesh) group.add(atlasMesh);
  const handsMesh = createMergedMesh('GoldenBridgeGiantHands', handParts, pack.cauVangHaLongMasterAtlasMat, true, true);
  if (handsMesh) group.add(handsMesh);
  const goldMesh = createMergedMesh('GoldenBridgeRailingsMesh', goldMetalParts, brushedGoldMat, true, true);
  if (goldMesh) group.add(goldMesh);
  const barkMesh = createMergedMesh('GoldenBridgeBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (barkMesh) group.add(barkMesh);
  const leafMesh = createMergedMesh('GoldenBridgeForestMesh', leafParts, foliageMat, true, false);
  if (leafMesh) group.add(leafMesh);

  tagMotifIds(group, ['HV-C07', 'HV-H04', 'HV-NEW-MT-03', 'HV-NEW-MT-04']);
  ctx.scene.add(group);
  return group;
}

/**
 * ============================================================================
 * PART 2: VỊNH HẠ LONG (HÒN TRỐNG MÁI, HÒN ĐỈNH HƯƠNG, KARSTS, THUYỀN BUỒM CÁNH DƠI, CỬA VẠN & ĐẢO TI TỐP)
 * Implements HL-01..HL-32 & HJ-01..HJ-32
 * ============================================================================
 */
export function buildHaLongBayComplex(
  ctx: VietnamBuilderContext,
  updateJunkBoatsCb?: () => void
): THREE.Group {
  const pack = getOrCreateCvhlPack(ctx);
  const group = new THREE.Group();
  group.name = 'HaLongBayComplex';

  const atlasParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const warmGlowParts: THREE.BufferGeometry[] = [];
  const foliageAnchors: Array<{ x: number; y: number; z: number; scale: number }> = [];

  // --------------------------------------------------------------------------
  // 1. HÒN TRỐNG MÁI (FIGHTING COCKS AT -28, -410) — TWO COMPLETELY SEPARATE ISLETS WITH CLEAR SKY GAP & OPPOSING BEAKS! (HL-01..HL-09)
  // --------------------------------------------------------------------------
  const sculptFightingCock = (
    seed: number,
    rad: number,
    h: number,
    leanX: number,
    beakDir: 1 | -1
  ): THREE.BufferGeometry => {
    const geo = createHaLongKarstGeometry(seed, rad, h, leanX, 0.22);
    const p = geo.attributes.position;
    for (let vi = 0; vi < p.count; vi++) {
      let vx = p.getX(vi);
      const vy = p.getY(vi);
      let vz = p.getZ(vi);
      const t = clamp01(vy / h);
      // Heavy wave-undercut narrow pedestal (~38% width at waterline t = 0.08..0.18!)
      const waist = 1.0 - 0.62 * Math.exp(-Math.pow((t - 0.14) / 0.11, 2.0));
      vx *= waist * 1.12;
      vz *= waist * 0.56;
      // Sharp opposing beak jutting inward at t ~ 0.66..0.82
      const beakMask = Math.exp(-Math.pow((t - 0.72) / 0.10, 2.0));
      if (vx * beakDir > 0) {
        vx += beakDir * beakMask * 2.65 * clamp01(Math.abs(vx) / (rad * 0.55));
      } else {
        // Swept rear tail ridge
        const tailMask = Math.exp(-Math.pow((t - 0.54) / 0.18, 2.0));
        vx -= beakDir * tailMask * 1.35;
      }
      p.setXYZ(vi, vx, vy, vz);
    }
    geo.computeVertexNormals();
    return remapRelief(geo, 'haLongDiagonalKarst');
  };

  // Separated horizontally by 11.4m (center -33.7 and -22.3) -> crisp open sky/water gap between the two pedestals & facing beaks!
  const rooster = sculptFightingCock(41, 4.2, 16.2, 1.4, 1);
  rooster.translate(-33.7, -1.2, -410.0);
  atlasParts.push(rooster);
  foliageAnchors.push(
    { x: -33.2, y: 14.5, z: -410.0, scale: 2.2 },
    { x: -35.4, y: 11.8, z: -409.5, scale: 1.7 }
  );

  const hen = sculptFightingCock(47, 3.8, 13.8, -1.3, -1);
  hen.translate(-22.3, -1.2, -410.0);
  atlasParts.push(hen);
  foliageAnchors.push(
    { x: -22.8, y: 12.2, z: -410.2, scale: 1.9 },
    { x: -20.6, y: 9.8, z: -409.8, scale: 1.5 }
  );

  // --------------------------------------------------------------------------
  // 2. HÒN ĐỈNH HƯƠNG (200,000 VND ICON AT 36, -435) — OPEN SEA-ARCH TWIN LEGS, 60° SLAB & TWIN V-NOTCH PEAKS! (HL-10..HL-18)
  // --------------------------------------------------------------------------
  const dhX = 36.0;
  const dhZ = -435.0;
  // Twin deeply tide-eroded legs spaced 8.6m apart -> wide OPEN daylight sea-arch tunnel right through the bottom!
  for (const side of [-1, 1]) {
    const legPts = [
      new THREE.Vector2(2.4, 0.0),
      new THREE.Vector2(1.45, 2.2), // Deep tidal undercut waist!
      new THREE.Vector2(1.75, 4.2),
      new THREE.Vector2(2.95, 6.2)
    ];
    const leg = remapRelief(new THREE.LatheGeometry(legPts, 14), 'haLongDiagonalKarst');
    leg.scale(1.15, 1.0, 0.72);
    leg.translate(dhX + side * 4.5, -1.2, dhZ);
    atlasParts.push(leg);
  }
  // Slab-sided overhanging monolithic upper block with twin jagged peaks separated by a sharp central V-notch!
  const slabShape = new THREE.Shape();
  slabShape.moveTo(-7.8, 4.8);
  slabShape.lineTo(-9.2, 8.8);
  slabShape.lineTo(-8.4, 15.6);
  slabShape.lineTo(-4.8, 18.8); // Angular left peak
  slabShape.lineTo(-0.4, 15.2); // Sharp central V-notch cleft!
  slabShape.lineTo(4.4, 17.8);  // Stepped right peak
  slabShape.lineTo(9.4, 14.5);
  slabShape.lineTo(10.2, 8.2);  // Asymmetric overhanging lower-right prow!
  slabShape.lineTo(7.4, 4.6);
  slabShape.lineTo(2.4, 5.4);   // Arch ceiling right
  slabShape.lineTo(0.0, 6.2);   // High open sea-arch crown!
  slabShape.lineTo(-2.4, 5.4);  // Arch ceiling left
  slabShape.closePath();

  const dinhHuongSlab = new THREE.ExtrudeGeometry(slabShape, {
    depth: 4.8,
    bevelEnabled: true,
    bevelThickness: 0.75,
    bevelSize: 0.65,
    bevelSegments: 2
  });
  dinhHuongSlab.translate(0, 0, -2.4);
  // Subtle organic rock crag displacement so front cliff face looks sculpted & natural!
  const dhPos = dinhHuongSlab.attributes.position;
  for (let vi = 0; vi < dhPos.count; vi++) {
    const px = dhPos.getX(vi);
    const py = dhPos.getY(vi);
    const pz = dhPos.getZ(vi);
    const crag = Math.sin(px * 0.65 + py * 0.45) * 0.32 + Math.cos(py * 0.8 - px * 0.3) * 0.22;
    dhPos.setXYZ(vi, px + crag * 0.45, py, pz + crag * (pz >= 0 ? 1 : -1));
  }
  dinhHuongSlab.computeVertexNormals();
  normalizeExtrudeUv(dinhHuongSlab);
  remapRelief(dinhHuongSlab, 'haLongDiagonalKarst');
  dinhHuongSlab.translate(dhX, -0.6, dhZ);
  atlasParts.push(dinhHuongSlab);

  // Clinging dwarf karst shrubs inside the central V-cleft & shoulder crests (HL-17)
  foliageAnchors.push(
    { x: dhX - 4.6, y: 18.2, z: dhZ, scale: 2.0 },
    { x: dhX - 0.3, y: 14.9, z: dhZ + 1.2, scale: 1.8 },
    { x: dhX + 4.5, y: 17.4, z: dhZ, scale: 2.2 },
    { x: dhX + 7.8, y: 14.2, z: dhZ + 0.8, scale: 1.6 }
  );

  // --------------------------------------------------------------------------
  // 3. SURROUNDING STRATIFIED LIMESTONE KARSTS (CLEAR OF CẦU VÀNG AT z=-145 & CLEAR SIGHTLINE BEHIND HERO ISLETS!) (CW-26, HL-24..30)
  // --------------------------------------------------------------------------
  const rand = mulberry32(991042);
  const karstSpecs: Array<[number, number, number, number]> = [
    // Far emerald bay skyline karsts (z <= -290, NEVER touching Cầu Vàng at z = -145!)
    [-165, -360, 18, 46], [-115, -395, 16, 42], [-88, -465, 22, 54],
    [-55, -515, 20, 48], [-12, -545, 24, 56], [42, -555, 22, 52],
    [88, -510, 20, 46], [165, -475, 24, 58], [210, -415, 19, 44],
    [-215, -485, 26, 62], [-145, -580, 28, 66], [-65, -630, 25, 60],
    [25, -650, 28, 64], [115, -620, 24, 56], [195, -580, 26, 62],
    [-95, -315, 13, 32], [185, -340, 16, 38], [240, -355, 18, 42]
  ];
  karstSpecs.forEach(([kx, kz, kr, kh], idx) => {
    const kGeo = remapRelief(
      createHaLongKarstGeometry(200 + idx * 31, kr, kh, (rand() - 0.5) * 4.5, 0.25),
      'haLongDiagonalKarst'
    );
    kGeo.translate(kx, -2.5, kz);
    atlasParts.push(kGeo);
    // Lush multi-cluster jungle foliage crowning 75%+ of karst summits & upper ledges (HL-26)
    const crownClusters = 7 + Math.floor(kr * 0.32);
    for (let c = 0; c < crownClusters; c++) {
      const a = (c / crownClusters) * Math.PI * 2 + rand() * 0.5;
      const rr = kr * (0.14 + rand() * 0.52);
      foliageAnchors.push({
        x: kx + Math.cos(a) * rr,
        y: kh * (0.62 + rand() * 0.34) - 2.2,
        z: kz + Math.sin(a) * rr,
        scale: 4.4 + rand() * 3.8
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4. LÀNG CHÀI CỬA VẠN FLOATING FISHING VILLAGE AT (108, -362) (HJ-13..HJ-23)
  // Varied coastal plank houses, corrugated roofs, verandas, pontoon drums, bridged gangways, submerged fish cages, bougainvillea & moored sampans!
  // --------------------------------------------------------------------------
  const cuaVanHouses: Array<[number, number, number, number, number, CvhlReliefKey]> = [
    [98, -360, 0.14, 4.6, 3.8, 'cuaVanTurquoisePlank'],
    [108, -364, -0.06, 5.2, 4.1, 'cuaVanOchrePlank'],
    [118, -361, 0.12, 4.4, 3.6, 'cuaVanTurquoisePlank'],
    [102, -351, -0.10, 4.8, 3.9, 'cuaVanOchrePlank'],
    [113, -352, 0.08, 4.5, 3.7, 'cuaVanTurquoisePlank'],
    [123, -354, -0.14, 4.2, 3.5, 'cuaVanOchrePlank']
  ];

  cuaVanHouses.forEach(([fx, fz, ry, hw, hd, wallKey], idx) => {
    const rw = hw + 2.4;
    const rd = hd + 2.2;
    // Planked timber raft deck + perimeter curb
    atlasParts.push(
      makeReliefBox(rw, 0.26, rd, 'weatheredPierPlank', fx, 0.30, fz, ry)
    );
    // Strapped blue/white cylindrical buoyancy barrels (phuy nhựa) beneath raft joists (HJ-16)
    for (const bx of [-rw * 0.38, 0, rw * 0.38]) {
      const barrel = remapRelief(new THREE.CylinderGeometry(0.28, 0.28, rd * 0.88, 8), 'slateMansardRoof');
      barrel.rotateX(Math.PI * 0.5);
      barrel.translate(bx, 0.06, 0);
      barrel.rotateY(ry);
      barrel.translate(fx, 0, fz);
      atlasParts.push(barrel);
    }
    // Weathered vertical coastal timber plank house body + recessed porch veranda + corrugated gable roof (HJ-13..15)
    atlasParts.push(
      makeReliefBox(hw, 2.55, hd, wallKey, fx, 1.65, fz, ry)
    );
    const roof = remapRelief(createGableRoofGeometry(hw + 0.9, hd + 1.1, 1.15, 0.14, 'x'), 'corrugatedTinRoof');
    roof.rotateY(ry);
    roof.translate(fx, 2.92, fz);
    atlasParts.push(roof);

    // Front porch awning posts + warm porch bulb (HJ-15, HJ-22)
    for (const px of [-hw * 0.42, hw * 0.42]) {
      const post = remapRelief(new THREE.CylinderGeometry(0.06, 0.07, 2.45, 6), 'weatheredPierPlank');
      post.translate(px, 1.60, hd * 0.5 + 0.65);
      post.rotateY(ry);
      post.translate(fx, 0, fz);
      atlasParts.push(post);
    }
    const bulb = new THREE.SphereGeometry(0.09, 8, 6);
    bulb.translate(0, 2.65, hd * 0.5 + 0.52);
    bulb.rotateY(ry);
    bulb.translate(fx, 0, fz);
    warmGlowParts.push(bulb);

    // Lush multi-stem potted Bougainvillea (*hoa giấy*) spilling over porch corner (HJ-19)
    const pot = remapRelief(new THREE.CylinderGeometry(0.26, 0.18, 0.36, 8), 'corrugatedTinRoof');
    pot.translate(-hw * 0.48, 0.58, hd * 0.5 + 0.45);
    pot.rotateY(ry);
    pot.translate(fx, 0, fz);
    atlasParts.push(pot);
    const bloom = remapRelief(new THREE.SphereGeometry(0.44, 8, 6), 'lobeliaVioletBloom');
    bloom.scale(1.2, 0.95, 1.1);
    bloom.translate(-hw * 0.48, 1.05, hd * 0.5 + 0.45);
    bloom.rotateY(ry);
    bloom.translate(fx, 0, fz);
    atlasParts.push(bloom);

    // Authentic 3D submerged floating fish-farming cage (*lồng bè nuôi cá*) beside alternate rafts (HJ-18)
    if (idx < 3) {
      const cx = fx + 0.5;
      const cz = fz + rd * 0.5 + 2.2;
      for (const s of [-1.45, 1.45]) {
        atlasParts.push(
          makeReliefBox(3.1, 0.18, 0.34, 'weatheredPierPlank', cx, 0.24, cz + s),
          makeReliefBox(0.34, 0.18, 3.1, 'weatheredPierPlank', cx + s, 0.24, cz)
        );
      }
      // Submerged dark fish-net pen descending into water
      atlasParts.push(makeReliefBox(2.5, 0.85, 2.5, 'greenSteelPier', cx, -0.25, cz));
    }
  });

  // Bridged inter-raft gangways physically linking neighboring rafts + bamboo handrails (HJ-17)
  const gangways: Array<[number, number, number, number]> = [
    [98, -360, 108, -364],
    [108, -364, 118, -361],
    [102, -351, 113, -352],
    [113, -352, 123, -354],
    [108, -364, 113, -352]
  ];
  for (const [x0, z0, x1, z1] of gangways) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = -Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    atlasParts.push(
      makeReliefBox(len, 0.16, 1.15, 'weatheredPierPlank', mx, 0.32, mz, ang),
      makeReliefBox(len, 0.06, 0.06, 'weatheredPierPlank', mx, 1.02, mz + 0.52, ang)
    );
  }
  // Cửa Vạn village signboard mounted proudly at front cove entrance (HJ-22)
  atlasParts.push(
    makeReliefBox(3.4, 1.15, 0.14, 'weatheredPierPlank', 102.0, 2.1, -347.2),
    makeArtPlane(3.25, 1.02, 'cuaVanVillageSign', 102.0, 2.1, -347.11, 0)
  );
  // 3 Moored wooden rowing sampans (*Thuyền Nan*) alongside Cửa Vạn rafts (HJ-21)
  for (const [sx, sz, syaw] of [[93.5, -355.0, 0.45], [107.2, -347.5, -0.28], [126.5, -358.0, 0.85]]) {
    const sHull = remapRelief(new THREE.CylinderGeometry(0.42, 0.24, 4.8, 8), 'mahoganyJunkHull');
    sHull.scale(1.0, 1.0, 0.65);
    sHull.rotateZ(Math.PI * 0.5);
    sHull.rotateY(syaw);
    sHull.translate(sx, 0.18, sz);
    atlasParts.push(sHull);
  }

  // --------------------------------------------------------------------------
  // 5. ĐẢO TI TỐP — STEPPED FORESTED HILL, EXPANDED CRESCENT BEACH, COHESIVE L-JETTY, 6 PALMS, EXPOSED STAIRS & SUMMIT HEXAGONAL PAVILION (HJ-24..HJ-32)
  // --------------------------------------------------------------------------
  const ttX = 136.0;
  const ttZ = -418.0;
  // Wide stepped karst hill (never swallows stairs or summit pavilion! HJ-24)
  const tiTopHill = remapRelief(createHaLongKarstGeometry(777, 17.5, 22.0, 0.0, 0.16), 'haLongDiagonalKarst');
  tiTopHill.scale(1.18, 1.0, 0.92);
  tiTopHill.translate(ttX, -1.8, ttZ);
  atlasParts.push(tiTopHill);
  for (let c = 0; c < 10; c++) {
    const a = (c / 10) * Math.PI * 2;
    foliageAnchors.push({
      x: ttX + Math.cos(a) * (7.5 + (c % 2) * 4.0),
      y: 11.5 + (c % 3) * 3.2,
      z: ttZ + Math.sin(a) * (6.8 + (c % 2) * 3.5),
      scale: 3.4
    });
  }

  // Expanded golden-white crescent sandy beach (HJ-25)
  const sandCrescent = remapRelief(new THREE.CylinderGeometry(12.2, 13.8, 0.95, 22), 'goldenBeachSand');
  sandCrescent.scale(1.22, 1.0, 0.58);
  sandCrescent.translate(ttX, 0.12, ttZ + 14.5);
  atlasParts.push(sandCrescent);

  // Cohesive L-shaped timber tourist arrival pier with pilings & side railings (HJ-26)
  atlasParts.push(
    makeReliefBox(3.0, 0.26, 13.5, 'weatheredPierPlank', ttX + 6.5, 0.68, ttZ + 22.5),
    makeReliefBox(7.2, 0.26, 2.8, 'weatheredPierPlank', ttX + 9.2, 0.68, ttZ + 28.0),
    makeReliefBox(2.6, 0.92, 0.14, 'weatheredPierPlank', ttX - 3.5, 1.65, ttZ + 12.2),
    makeArtPlane(2.45, 0.80, 'tiTopIslandSign', ttX - 3.5, 1.65, ttZ + 12.3, 0)
  );
  for (let pz = ttZ + 17; pz <= ttZ + 29; pz += 3.0) {
    for (const ox of [-1.25, 1.25]) {
      atlasParts.push(makeReliefCyl(0.12, 0.14, 2.6, 6, 'weatheredPierPlank', ttX + 6.5 + ox, -0.45, pz));
    }
  }
  // 4 Full-scale beach parasols + wooden loungers (HJ-27)
  for (const [bx, bz] of [[ttX - 7.5, ttZ + 15.2], [ttX - 3.2, ttZ + 16.0], [ttX + 1.5, ttZ + 16.0], [ttX + 4.8, ttZ + 15.2]]) {
    atlasParts.push(
      makeReliefCyl(0.06, 0.07, 2.5, 6, 'weatheredPierPlank', bx, 1.45, bz),
      makeReliefCyl(0.12, 1.45, 0.62, 8, 'corrugatedTinRoof', bx, 2.85, bz),
      makeReliefBox(0.85, 0.26, 1.85, 'weatheredPierPlank', bx + 0.45, 0.72, bz)
    );
  }
  // 5 Spaced multi-frond leaning coconut palms (deduplicated! HJ-28)
  for (const [px, pz, lx] of [
    [ttX - 11.2, ttZ + 12.8, -1.6],
    [ttX - 6.8, ttZ + 11.6, -0.9],
    [ttX + 0.5, ttZ + 11.2, 0.4],
    [ttX + 6.4, ttZ + 11.8, 1.1],
    [ttX + 10.8, ttZ + 13.0, 1.6]
  ]) {
    const pCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, 0.45, pz),
      new THREE.Vector3(px + lx * 0.5, 3.4, pz + 0.8),
      new THREE.Vector3(px + lx, 6.4, pz + 1.8)
    ]);
    barkParts.push(createSmoothTaperedTubeGeometry(pCurve, 8, 6, (t) => 0.22 - t * 0.10));
    const top = pCurve.getPoint(1);
    for (let f = 0; f < 10; f++) {
      const fa = (f / 10) * Math.PI * 2;
      const frond = new THREE.PlaneGeometry(0.85, 3.1);
      frond.rotateX(1.05);
      frond.rotateY(fa);
      frond.translate(top.x + Math.sin(fa) * 1.15, top.y - 0.15, top.z + Math.cos(fa) * 1.15);
      colorizeGeo(frond, f % 2 === 0 ? 0x2e7d32 : 0x439c40);
      leafParts.push(frond);
    }
  }
  // Exposed stone staircase climbing front slope to prominent Summit 2-Tier Hexagonal Pavilion (*Lầu Vọng Cảnh*) (HJ-29..30)
  for (let s = 0; s < 26; s++) {
    const t = s / 25;
    const sy = 1.0 + t * 19.6;
    const sz = ttZ + 11.8 - t * 10.2;
    const sx = ttX + Math.sin(t * Math.PI * 1.5) * 2.2;
    atlasParts.push(makeReliefBox(1.85, 0.78, 0.85, 'chateauAshlarStone', sx, sy, sz));
  }
  // Summit Hexagonal Terrace & 2-Tier Red-Roofed Pavilion (*Lầu Vọng Cảnh*) clearly silhouetted against sky!
  const pavY = 20.6;
  atlasParts.push(
    makeReliefCyl(4.6, 5.2, 1.1, 6, 'chateauAshlarStone', ttX, pavY - 0.45, ttZ),
    makeReliefCyl(4.4, 4.4, 0.65, 6, 'chateauAshlarStone', ttX, pavY + 0.35, ttZ)
  );
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    atlasParts.push(
      makeReliefCyl(0.16, 0.18, 3.4, 8, 'corrugatedTinRoof', ttX + Math.cos(a) * 3.1, pavY + 1.85, ttZ + Math.sin(a) * 3.1)
    );
  }
  atlasParts.push(
    makeReliefCyl(1.8, 4.4, 1.65, 6, 'corrugatedTinRoof', ttX, pavY + 4.35, ttZ),
    makeReliefCyl(1.75, 1.75, 0.72, 6, 'mahoganyJunkHull', ttX, pavY + 5.45, ttZ),
    makeReliefCyl(0.18, 2.85, 1.55, 6, 'corrugatedTinRoof', ttX, pavY + 6.45, ttZ)
  );
  const tiTopFin = new THREE.SphereGeometry(0.28, 8, 6);
  tiTopFin.translate(ttX, pavY + 7.45, ttZ);
  goldParts.push(tiTopFin);

  // --------------------------------------------------------------------------
  // 6. INSTANCED LUSH TROPICAL KARST FOLIAGE CROWNS (HL-26, HJ-31)
  // --------------------------------------------------------------------------
  const cardParts: THREE.BufferGeometry[] = [];
  for (let c = 0; c < 4; c++) {
    const p = new THREE.PlaneGeometry(2.1, 1.9);
    p.rotateY((c / 4) * Math.PI);
    p.rotateX((c % 2 === 0 ? 1 : -1) * 0.26);
    cardParts.push(p);
  }
  const foliageGeo = mergeNormalized(cardParts);
  const karstFoliageMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#2c6128',
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        roughness: 0.78,
        side: THREE.DoubleSide
      })
    : ctx.materials.stone;

  const karstFoliage = new THREE.InstancedMesh(foliageGeo, karstFoliageMat, foliageAnchors.length);
  karstFoliage.name = 'HaLongKarstFoliage';
  const dummy = new THREE.Matrix4();
  const col = new THREE.Color();
  foliageAnchors.forEach((fa, i) => {
    dummy.compose(
      new THREE.Vector3(fa.x, fa.y, fa.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
      new THREE.Vector3(fa.scale, fa.scale * 0.85, fa.scale)
    );
    karstFoliage.setMatrixAt(i, dummy);
    col.setHSL(0.30 + (rand() - 0.5) * 0.05, 0.46, 0.25 + rand() * 0.14);
    karstFoliage.setColorAt(i, col);
  });
  karstFoliage.instanceMatrix.needsUpdate = true;
  if (karstFoliage.instanceColor) karstFoliage.instanceColor.needsUpdate = true;
  group.add(karstFoliage);

  // --------------------------------------------------------------------------
  // 7. 3 HERO SAILING BAT-WING WOODEN JUNK BOATS (*THUYỀN BUỒM CÁNH DƠI*) (HJ-01..HJ-12)
  // Deep mahogany lofted hull, twin burnt-orange trim, multi-deck shuttered cabin, sun-deck railings & parasols,
  // twin raked masts with burnt-sienna bat-wing sails + 11 bamboo battens, warm lanterns & waving Vietnamese flag!
  // --------------------------------------------------------------------------
  const evalBatWingPoint = (xn: number, yn: number, w: number, h: number): THREE.Vector3 => {
    const fanSweep = 0.58 + 0.56 * Math.sin(yn * Math.PI * 0.78) + 0.18 * yn;
    const x = (xn - 0.16) * w * fanSweep;
    const yardTilt = xn * Math.tan((32 * Math.PI) / 180) * w * (0.28 + 0.72 * yn);
    const y = (yn - 0.5) * h + yardTilt * 0.58;
    const billow = Math.sin(xn * Math.PI) * Math.sin(yn * Math.PI) * 0.55;
    return new THREE.Vector3(x, y, billow);
  };

  const createBatWingSailGeo = (w: number, h: number): THREE.BufferGeometry => {
    const geo = new THREE.PlaneGeometry(w, h, 8, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const xn = pos.getX(i) / w + 0.5;
      const yn = pos.getY(i) / h + 0.5;
      const p = evalBatWingPoint(xn, yn, w, h);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    geo.computeVertexNormals();
    return remapArt(geo, 'batWingSailCanvas');
  };

  const flagHandle = createWavingSilkFlagMaterial();
  ctx.extraMaterials.push(flagHandle.material);
  ctx.animatedUniforms?.push(flagHandle.uniforms);

  const dsOpts: THREE.MeshStandardMaterialParameters = {
    roughness: 0.76,
    side: THREE.DoubleSide
  };
  if (pack.cauVangHaLongMasterAtlasMat.map) dsOpts.map = pack.cauVangHaLongMasterAtlasMat.map;
  if (pack.cauVangHaLongMasterAtlasMat.normalMap) dsOpts.normalMap = pack.cauVangHaLongMasterAtlasMat.normalMap;
  const doubleSidedAtlasMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard(dsOpts)
    : pack.cauVangHaLongMasterAtlasMat;

  const boatConfigs = [
    { cx: 88, cz: -346, rx: 14, rz: 10, speed: 0.08, phase: 0.4, scale: 1.65 },  // Hero Junk #1 in clear view of Cửa Vạn!
    { cx: -6, cz: -455, rx: 28, rz: 18, speed: 0.06, phase: 2.1, scale: 1.75 },  // Mid-bay Junk #2 framing Hòn Trống Mái & Đỉnh Hương!
    { cx: 56, cz: -505, rx: 32, rz: 20, speed: 0.05, phase: 4.3, scale: 1.60 }
  ];

  boatConfigs.forEach((bc, idx) => {
    const boat = new THREE.Group();
    boat.name = `HaLongJunkBoat_${idx + 1}`;
    const bAtlas: THREE.BufferGeometry[] = [];
    const bGold: THREE.BufferGeometry[] = [];
    const bGlow: THREE.BufferGeometry[] = [];

    // Lofted curved deep mahogany hull (upturned pointed prow + raised transom stern)
    const stations = [
      { x: -4.5, halfBeam: 0.55, keelY: 0.22, sheerY: 1.48 },
      { x: -3.2, halfBeam: 1.05, keelY: -0.30, sheerY: 1.10 },
      { x: -1.4, halfBeam: 1.38, keelY: -0.64, sheerY: 0.88 },
      { x: 0.4, halfBeam: 1.42, keelY: -0.68, sheerY: 0.86 },
      { x: 2.1, halfBeam: 1.18, keelY: -0.50, sheerY: 0.98 },
      { x: 3.6, halfBeam: 0.65, keelY: -0.15, sheerY: 1.28 },
      { x: 4.6, halfBeam: 0.16, keelY: 0.30, sheerY: 1.62 },
      { x: 5.1, halfBeam: 0.03, keelY: 0.68, sheerY: 1.85 }
    ];
    const profU = [-1.0, -0.82, -0.45, 0.0, 0.45, 0.82, 1.0];
    const profY = [1.0, 0.42, 0.08, 0.0, 0.08, 0.42, 1.0];
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const stride = profU.length;

    for (let si = 0; si < stations.length; si++) {
      const st = stations[si];
      const uCoord = si / (stations.length - 1);
      for (let pi = 0; pi < stride; pi++) {
        positions.push(st.x, THREE.MathUtils.lerp(st.keelY, st.sheerY, profY[pi]), profU[pi] * st.halfBeam);
        uvs.push(uCoord, pi / (stride - 1));
      }
    }
    for (let si = 0; si < stations.length - 1; si++) {
      for (let pi = 0; pi < stride - 1; pi++) {
        const a = si * stride + pi;
        const b = (si + 1) * stride + pi;
        const c = (si + 1) * stride + pi + 1;
        const d = si * stride + pi + 1;
        indices.push(a, b, d, b, c, d);
      }
      const p0 = si * stride;
      const s0 = si * stride + (stride - 1);
      const p1 = (si + 1) * stride;
      const s1 = (si + 1) * stride + (stride - 1);
      indices.push(p0, s0, s1, p0, s1, p1);
    }
    const hullGeo = new THREE.BufferGeometry();
    hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    hullGeo.setIndex(indices);
    hullGeo.computeVertexNormals();
    bAtlas.push(remapRelief(hullGeo, 'mahoganyJunkHull'));

    // Multi-deck cabin with shuttered amber-lit windows + projecting eaves + dense sun-deck balustrade (HJ-04..06)
    bAtlas.push(
      makeReliefBox(5.2, 1.35, 2.25, 'junkCabinShutter', -0.65, 1.55, 0),
      makeReliefBox(5.6, 0.14, 2.55, 'mahoganyJunkHull', -0.65, 2.26, 0),
      makeReliefBox(3.4, 1.05, 1.85, 'junkCabinShutter', -1.25, 2.84, 0),
      makeReliefBox(3.8, 0.14, 2.15, 'mahoganyJunkHull', -1.25, 3.42, 0)
    );
    // Dense wooden sun-deck railings + 2 canvas deck parasols + orange-white lifebuoys (HJ-06..07)
    for (const sz of [-1.08, 1.08]) {
      bAtlas.push(makeReliefBox(4.8, 0.07, 0.07, 'mahoganyJunkHull', -0.6, 2.88, sz));
      for (let bx = -2.8; bx <= 1.6; bx += 0.45) {
        bAtlas.push(makeReliefBox(0.05, 0.56, 0.05, 'mahoganyJunkHull', bx, 2.58, sz));
      }
      // Lifebuoy hung on side rail
      const buoy = remapRelief(new THREE.TorusGeometry(0.20, 0.06, 6, 12), 'corrugatedTinRoof');
      buoy.translate(-0.2, 2.58, sz * 1.06);
      bAtlas.push(buoy);
    }
    // Sun-deck canvas parasol
    bAtlas.push(
      makeReliefCyl(0.04, 0.05, 1.5, 6, 'mahoganyJunkHull', -2.2, 4.15, 0),
      makeReliefCyl(0.08, 1.05, 0.42, 8, 'chateauAshlarStone', -2.2, 4.95, 0)
    );

    // Twin raked masts + yards + rigging + carved dragon prow + warm deck lanterns (HJ-03, HJ-10..11)
    bAtlas.push(
      makeReliefCyl(0.08, 0.13, 7.6, 8, 'mahoganyJunkHull', 0.55, 4.5, 0, 0, 0, 0.06),
      makeReliefCyl(0.06, 0.10, 5.6, 8, 'mahoganyJunkHull', 2.65, 3.6, 0, 0, 0, -0.05),
      makeReliefCyl(0.04, 0.06, 1.6, 6, 'mahoganyJunkHull', 5.2, 1.95, 0, 0, 0, -1.15) // Bowsprit
    );
    const prowScroll = new THREE.ConeGeometry(0.22, 0.72, 6);
    prowScroll.rotateZ(-0.65);
    prowScroll.translate(5.15, 1.98, 0);
    bGold.push(prowScroll);
    for (const [lx, ly, lz] of [[4.85, 2.15, 0], [1.95, 2.12, 1.12], [1.95, 2.12, -1.12], [-3.2, 2.12, 0]]) {
      const lOrb = new THREE.SphereGeometry(0.14, 8, 6);
      lOrb.translate(lx, ly, lz);
      bGlow.push(lOrb);
    }

    const bAtlasMesh = createMergedMesh(`JunkHull_${idx}`, bAtlas, pack.cauVangHaLongMasterAtlasMat, true, true);
    if (bAtlasMesh) boat.add(bAtlasMesh);
    const bGoldMesh = createMergedMesh(`JunkGold_${idx}`, bGold, ctx.materials.gold, false, false);
    if (bGoldMesh) boat.add(bGoldMesh);
    const glowMat = ctx.materialLib
      ? ctx.materialLib.getOrCreateStandard({ color: '#ffe49c', emissive: '#ffaa30', emissiveIntensity: 2.6, roughness: 0.25 })
      : ctx.materials.gold;
    const bGlowMesh = createMergedMesh(`JunkLanterns_${idx}`, bGlow, glowMat, false, false);
    if (bGlowMesh) boat.add(bGlowMesh);

    // Swept burnt-sienna bat-wing sails (double-sided!)
    const mainSail = new THREE.Mesh(createBatWingSailGeo(3.9, 5.2), doubleSidedAtlasMat);
    mainSail.position.set(0.55, 4.45, 0.08);
    mainSail.rotation.y = 0.18;
    mainSail.castShadow = true;
    const foreSail = new THREE.Mesh(createBatWingSailGeo(2.7, 3.7), doubleSidedAtlasMat);
    foreSail.position.set(2.65, 3.55, 0.08);
    foreSail.rotation.y = 0.18;
    foreSail.castShadow = true;
    boat.add(mainSail, foreSail);

    // Waving Vietnamese crimson-gold flag on stern flagstaff (HJ-12)
    const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.76, 8, 4), flagHandle.material);
    flagMesh.position.set(-3.85, 4.35, 0);
    boat.add(flagMesh);

    boat.scale.setScalar(bc.scale);
    group.add(boat);
    ctx.junkBoats.push({
      group: boat,
      centerX: bc.cx,
      centerZ: bc.cz,
      radiusX: bc.rx,
      radiusZ: bc.rz,
      speed: bc.speed,
      phase: bc.phase
    });
  });

  if (updateJunkBoatsCb) updateJunkBoatsCb();

  // Merge all static Ha Long Bay batches
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

  const hlAtlasMesh = createMergedMesh('HaLongAtlasMesh', atlasParts, pack.cauVangHaLongMasterAtlasMat, true, true);
  if (hlAtlasMesh) group.add(hlAtlasMesh);
  const hlGoldMesh = createMergedMesh('HaLongGoldMesh', goldParts, ctx.materials.gold, true, true);
  if (hlGoldMesh) group.add(hlGoldMesh);
  const hlBarkMesh = createMergedMesh('HaLongBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (hlBarkMesh) group.add(hlBarkMesh);
  const hlLeafMesh = createMergedMesh('HaLongLeafMesh', leafParts, foliageMat, true, false);
  if (hlLeafMesh) group.add(hlLeafMesh);
  const hlGlowMesh = createMergedMesh('HaLongGlowMesh', warmGlowParts, glowMat, false, false);
  if (hlGlowMesh) group.add(hlGlowMesh);

  tagMotifIds(group, ['HV-D02', 'HV-D06', 'HV-I01', 'HV-J01', 'HV-NEW-MB-08', 'HV-NEW-MB-09', 'HV-NEW-MB-11']);
  ctx.scene.add(group);
  return group;
}
