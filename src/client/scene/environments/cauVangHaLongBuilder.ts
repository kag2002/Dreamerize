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

      // Item 005: Multi-tone golden-yellow marigold/daisy accent tufts among purple Lobelia blooms
      if (i % 2 === 0) {
        const marigold = new THREE.SphereGeometry(0.16, 6, 5);
        marigold.scale(1.4, 0.75, 1.0);
        marigold.translate(0, 0.72, side * 2.14);
        goldMetalParts.push(orient(marigold));
      }

      // Item 003: Brushed champagne-gold vertical fascia rib seams along outer hull shell
      if (i % 2 === 0) {
        const rib = new THREE.BoxGeometry(0.08, 1.05, 0.08);
        rib.translate(0, -0.55, side * (deckHalfW + 0.24));
        goldMetalParts.push(orient(rib));
      }

      // Item 004: Recessed warm LED deck-edge lighting bollards along the Merbau timber walkway
      if (i % 4 === 1) {
        const bollard = new THREE.BoxGeometry(0.12, 0.28, 0.08);
        bollard.translate(0, 0.26, side * 1.82);
        goldMetalParts.push(orient(bollard));
      }

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
      makeReliefCyl(0.54, 0.64, colH, 8, 'greenSteelPier', px, groundY + colH * 0.5, pc.z),
      // Ribbed ornamental collar capital rings
      makeReliefCyl(0.84, 0.68, 0.55, 8, 'greenSteelPier', px, colTopY, pc.z),
      makeReliefCyl(0.92, 0.88, 0.18, 8, 'champagneGoldCladding', px, colTopY + 0.34, pc.z)
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
    // Item 013: Brass deck expansion-joint strips across the Merbau timber walkway at each pier
    const expJoint = new THREE.BoxGeometry(0.12, 0.04, 3.88);
    expJoint.translate(px, pc.y + 0.13, pc.z);
    goldMetalParts.push(expJoint);
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
      createSmoothTaperedTubeGeometry(armCurve, 14, 10, (t) => 3.55 - t * 0.72 + Math.sin(t * Math.PI * 3) * 0.14),
      'giantHandMossyStone'
    );
    handParts.push(forearm);

    // C. Massive volumetric cupped palm cradling the bridge soffit (thenar + hypothenar muscle pads! CV-04)
    const palmCore = remapRelief(new THREE.SphereGeometry(3.85, 11, 9), 'giantHandMossyStone');
    palmCore.scale(1.38, 0.62, 1.15);
    palmCore.translate(palmX, palmY + 0.15, palmZ);
    const thenarPad = remapRelief(new THREE.SphereGeometry(2.35, 9, 7), 'giantHandMossyStone');
    thenarPad.scale(1.15, 0.85, 1.10);
    thenarPad.translate(palmX - sideSign * 2.4, palmY + 0.75, palmZ + 2.2);
    const hypothenarPad = remapRelief(new THREE.SphereGeometry(2.15, 9, 7), 'giantHandMossyStone');
    hypothenarPad.scale(1.15, 0.78, 1.05);
    hypothenarPad.translate(palmX + sideSign * 2.5, palmY + 0.45, palmZ + 0.8);
    handParts.push(palmCore, thenarPad, hypothenarPad);

    // Item 002: Sculpted palm lifeline/muscle creases & stratified granite wrist-cuff outcrops
    for (let cr = 0; cr < 3; cr++) {
      const crease = remapRelief(new THREE.BoxGeometry(2.6 - cr * 0.4, 0.18, 0.24), 'giantHandMossyStone');
      crease.rotateY((cr - 1) * 0.28);
      crease.translate(palmX + sideSign * (cr - 1) * 0.65, palmY + 0.42, palmZ + 1.4 - cr * 0.45);
      handParts.push(crease);
    }
    const wristCollar = remapRelief(new THREE.CylinderGeometry(3.4, 3.8, 1.25, 8), 'giantHandMossyStone');
    wristCollar.rotateX(0.65);
    wristCollar.translate(palmX + sideSign * 0.8, palmY - 3.6, palmZ + 3.8);
    handParts.push(wristCollar);

    // Item 001: Mossy stone weathering ribs & green lichen/moss patches on Giant Hands' dorsal fingers & wrist
    for (let mp = 0; mp < 6; mp++) {
      const mossPatch = new THREE.SphereGeometry(0.62 - (mp % 3) * 0.12, 6, 5);
      mossPatch.scale(1.3, 0.45, 1.1);
      mossPatch.translate(
        palmX + sideSign * (-2.2 + mp * 0.9),
        palmY + 2.8 + (mp % 3) * 1.4,
        palmZ - 3.25
      );
      colorizeGeo(mossPatch, mp % 2 === 0 ? 0x3b6326 : 0x4c7a30);
      leafParts.push(mossPatch);
    }

    // Item 012: Mist-shrouded Bà Nà pine & fern understory clusters beneath the Giant Hands' granite cliff outcrops
    for (const [ux, uz] of [[-4.8, 12.6], [4.8, 13.2]]) {
      const fern = new THREE.ConeGeometry(1.45, 1.15, 6);
      fern.translate(wristBaseX + ux * 0.6, wristBaseY + 1.8, wristBaseZ + uz * 0.2);
      colorizeGeo(fern, 0x2c5c26);
      leafParts.push(fern);
    }

    // Helper for articulated 3-phalanx stone finger/thumb with knuckle bulges & recessed sculpted fingernail!
    const addArticulatedDigit = (pts: THREE.Vector3[], baseR: number, tipR: number) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const digit = remapRelief(
        createSmoothTaperedTubeGeometry(curve, 12, 8, (t) => {
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
      const cap = remapRelief(new THREE.SphereGeometry(tipR * 1.02, 8, 6), 'giantHandMossyStone');
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
        makeReliefCyl(1.65, 1.75, 7.6, 8, 'chateauAshlarStone', sx + (isWest ? 2.4 : -2.4), baseY + 3.9, sz + tz),
        makeReliefCyl(0.12, 1.95, 3.8, 8, 'slateMansardRoof', sx + (isWest ? 2.4 : -2.4), baseY + 9.6, sz + tz)
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

    // Item 006: Curved stainless-steel handrail end-scroll terminals flaring into station plazas
    const endX = isWest ? -75 : 75;
    for (const side of [-1, 1]) {
      const scroll = new THREE.TorusGeometry(0.45, 0.055, 4, 7, Math.PI * 0.75);
      scroll.rotateX(Math.PI * 0.5);
      scroll.rotateY(isWest ? Math.PI : 0);
      scroll.translate(endX + (isWest ? -0.4 : 0.4), cEnd.y + 1.15, cEnd.z + side * (deckHalfW + 0.42));
      goldMetalParts.push(scroll);
    }

    // Item 007 & 008: French-château ornamental dormer windows (lucarnes), arched dark-glass bays & stone quoins
    for (const dz of [-2.8, 2.8]) {
      const faceX = sx + (isWest ? 2.15 : -2.15);
      atlasParts.push(
        makeReliefBox(0.95, 1.35, 1.15, 'chateauAshlarStone', faceX, baseY + 7.55, sz + dz),
        makeReliefCyl(0.08, 0.85, 0.95, 4, 'slateMansardRoof', faceX, baseY + 8.65, sz + dz, Math.PI * 0.25),
        makeReliefBox(0.18, 2.15, 1.25, 'greenSteelPier', faceX, baseY + 2.45, sz + dz)
      );
    }
    // Item 011: Classical French stone balustrades & twin ornamental urns flanking arrival terraces
    for (const side of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(0.42, 0.95, 2.6, 'chateauAshlarStone', sx + (isWest ? 5.6 : -5.6), baseY + 0.65, sz + side * 4.8),
        makeReliefCyl(0.36, 0.24, 0.68, 8, 'chateauAshlarStone', sx + (isWest ? 5.6 : -5.6), baseY + 1.46, sz + side * 3.6)
      );
    }
    // Item 017: Gilded French-château roof ridge cresting & weathervane finials atop turrets
    for (const tz of [-4.6, 4.6]) {
      const fin = new THREE.CylinderGeometry(0.03, 0.06, 1.35, 6);
      fin.translate(sx + (isWest ? 2.4 : -2.4), baseY + 12.1, sz + tz);
      goldMetalParts.push(fin);
    }
    // Item 018: Deeper granite cliffside buttress boulders anchoring bridge abutments (x = ±75)
    const buttress = remapRelief(
      createSculptedRockGeometry(isWest ? 7501 : 7502, 5.5, 5.2, 5.8, 1),
      'giantHandMossyStone'
    );
    buttress.translate(endX, baseY - 6.2, cEnd.z + (isWest ? 4.5 : -4.5));
    handParts.push(buttress);
    if (isWest) {
      // Item 016 & 020: Projecting stone viewing belvedere balcony & heritage directional plinth on West Marseille terrace
      atlasParts.push(
        makeReliefBox(6.2, 0.45, 3.8, 'baNaMosaicPaver', sx + 1.2, baseY + 0.05, sz + 8.4),
        makeReliefBox(6.4, 0.88, 0.35, 'chateauAshlarStone', sx + 1.2, baseY + 0.68, sz + 10.1),
        makeReliefBox(1.15, 1.45, 0.55, 'chateauAshlarStone', sx + 5.8, baseY + 0.72, sz - 3.6)
      );
    }
  };
  buildFrenchChateauStation(-82.5, -145.5, true);
  buildFrenchChateauStation(82.5, -145.5, false);

  // Item 009 (Area Expansion): Bà Nà Hills overhead cable-car steel truss pylon, haul cables & 2 suspended gondola cabins
  const pylonX = -112.0;
  const pylonZ = -145.5;
  const pylonBaseY = Math.min(
    ctx.getHeight(pylonX - 1.2, pylonZ - 1.2),
    ctx.getHeight(pylonX + 1.2, pylonZ + 1.2),
    ctx.getHeight(pylonX, pylonZ)
  ) - 1.5;
  const pylonTopY = getGoldenBridgeCurveAtX(-75).y + 11.5;
  const pylonH = Math.max(12.0, pylonTopY - pylonBaseY);
  atlasParts.push(
    makeReliefBox(2.2, pylonH, 2.2, 'greenSteelPier', pylonX, pylonBaseY + pylonH * 0.5, pylonZ),
    makeReliefBox(1.8, 0.45, 7.6, 'greenSteelPier', pylonX, pylonTopY, pylonZ)
  );
  for (const czOff of [-2.4, 2.4]) {
    const p0 = new THREE.Vector3(pylonX, pylonTopY, pylonZ + czOff);
    const p1 = new THREE.Vector3(-82.5, getGoldenBridgeCurveAtX(-75).y + 5.2, -145.5 + czOff);
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const cable = new THREE.CylinderGeometry(0.05, 0.05, dir.length(), 5);
    cable.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    cable.translate((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5, (p0.z + p1.z) * 0.5);
    atlasParts.push(cable);
    // Suspended cable-car gondola cabin
    const tCab = czOff < 0 ? 0.38 : 0.68;
    const cabPos = new THREE.Vector3().lerpVectors(p0, p1, tCab);
    atlasParts.push(
      makeReliefBox(0.12, 1.35, 0.12, 'greenSteelPier', cabPos.x, cabPos.y - 0.7, cabPos.z),
      makeReliefBox(2.1, 1.65, 1.55, 'champagneGoldCladding', cabPos.x, cabPos.y - 1.95, cabPos.z)
    );
  }

  // Item 010 (Area Expansion): Le Jardin d'Amour geometric boxwood-bordered flower parterres east of East station (x = 94..112, clear of pergola at z = -145.5!)
  for (let px = 94; px <= 108; px += 7) {
    for (const pz of [-152.2, -138.8]) {
      const py = Math.max(
        ctx.getHeight(px, pz),
        ctx.getHeight(px - 2.4, pz - 2.2),
        ctx.getHeight(px + 2.4, pz - 2.2),
        ctx.getHeight(px - 2.4, pz + 2.2),
        ctx.getHeight(px + 2.4, pz + 2.2)
      );
      atlasParts.push(
        makeReliefBox(4.8, 2.6, 4.4, 'chateauAshlarStone', px, py - 1.15, pz),
        makeReliefBox(4.9, 0.28, 4.5, 'baNaMosaicPaver', px, py + 0.18, pz),
        makeReliefBox(4.2, 0.42, 3.8, 'lobeliaVioletBloom', px, py + 0.46, pz)
      );
      const hedge = new THREE.BoxGeometry(4.6, 0.48, 0.36);
      hedge.translate(px, py + 0.46, pz + 2.0);
      colorizeGeo(hedge, 0x2c6629);
      leafParts.push(hedge);
    }
  }

  // --------------------------------------------------------------------------
  // 5. CURVED TERRACED MOSAIC GARDEN WALKWAY + LUSH MULTI-LAYERED BÀ NÀ FOREST CANOPY (CV-27..28, CW-30..31)
  // --------------------------------------------------------------------------
  for (let w = -44; w <= 44; w += 8) {
    const wz = -135.5 + Math.sin(w * 0.06) * 2.2;
    const wy = ctx.getHeight(w, wz);
    atlasParts.push(
      makeReliefBox(8.2, 0.35, 3.2, 'baNaMosaicPaver', w, wy + 0.18, wz),
      // White spherical stone bowl planter flanking terrace path
      makeReliefCyl(0.55, 0.38, 0.58, 7, 'chateauAshlarStone', w, wy + 0.58, wz + 1.85),
      // Item 014: Sculpted stone rockery retaining curbs along terraced mosaic garden walkway
      makeReliefBox(8.2, 0.45, 0.38, 'chateauAshlarStone', w, wy + 0.22, wz - 1.75)
    );
    // Item 015: Wrought-iron French park benches & vintage lamp posts along mosaic terrace
    if (Math.abs(w) % 16 === 0) {
      atlasParts.push(
        makeReliefBox(1.65, 0.12, 0.52, 'greenSteelPier', w + 2.2, wy + 0.58, wz - 1.15),
        makeReliefCyl(0.06, 0.09, 2.8, 6, 'greenSteelPier', w - 2.4, wy + 1.55, wz + 1.45)
      );
    }
  }
  // Dense layered Bà Nà evergreen & broadleaf forest canopies framing the wrists & piers (NO low-poly green cones!)
  const baNaPalette = [0x1f4d22, 0x2c6629, 0x3b7832, 0x567a2e];
  const forestSpots: Array<[number, number, number, number]> = [
    [-54, -136, 1.35, 901], [-42, -135, 1.45, 902], [-34, -134, 1.25, 903],
    [-16, -136, 1.40, 904], [-4, -135, 1.35, 905], [10, -136, 1.42, 906],
    [22, -134, 1.30, 907], [38, -135, 1.48, 908], [52, -136, 1.38, 909],
    [-64, -138, 1.42, 910], [64, -138, 1.42, 911], [-22, -152, 1.55, 912],
    [22, -152, 1.55, 913], [0, -155, 1.62, 914],
    // Item 019: Additional Bà Nà broadleaf canopy trees on eastern Le Jardin d'Amour slope (clear of East Station, Debay & parterres!)
    [88, -166, 1.45, 915], [108, -165, 1.48, 916], [96, -130, 1.38, 917]
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

  // ==========================================================================
  // WAVE 2 UPGRADES (Items 201–220): Bà Nà French Village Plaza, Fountain,
  // St. Denis Bell Tower, Debay Wine Cellar, Le Jardin d'Amour Pergola & Details
  // ==========================================================================
  const w2CvAtlas: THREE.BufferGeometry[] = [];
  const w2CvGold: THREE.BufferGeometry[] = [];
  const w2CvLeaf: THREE.BufferGeometry[] = [];
  const wEndY = getGoldenBridgeCurveAtX(-75).y - 0.25;
  const eEndY = getGoldenBridgeCurveAtX(75).y - 0.25;

  // 201–202: Bà Nà French Village cobblestone plaza terrace & tiered stone fountain (-102, -158)
  const fvX = -102.0;
  const fvZ = -158.0;
  const fvY = Math.max(
    ctx.getHeight(fvX, fvZ),
    ctx.getHeight(fvX - 9.0, fvZ - 7.5),
    ctx.getHeight(fvX + 9.0, fvZ - 7.5),
    ctx.getHeight(fvX - 9.0, fvZ + 7.5),
    ctx.getHeight(fvX + 9.0, fvZ + 7.5)
  );
  w2CvAtlas.push(
    makeReliefBox(18.0, 10.0, 15.0, 'chateauAshlarStone', fvX, fvY - 4.8, fvZ),
    makeReliefBox(18.4, 0.28, 15.4, 'baNaMosaicPaver', fvX, fvY + 0.32, fvZ),
    // Tiered octagonal fountain basin + central pedestal + upper bowl
    makeReliefCyl(2.4, 2.6, 0.58, 6, 'chateauAshlarStone', fvX, fvY + 0.72, fvZ),
    makeReliefCyl(0.45, 0.58, 1.35, 6, 'chateauAshlarStone', fvX, fvY + 1.45, fvZ),
    makeReliefCyl(1.15, 0.45, 0.32, 6, 'chateauAshlarStone', fvX, fvY + 2.15, fvZ),
    makeReliefCyl(0.18, 0.24, 0.65, 5, 'chateauAshlarStone', fvX, fvY + 2.55, fvZ)
  );
  // 203–204: St. Denis Church Gothic bell tower, corner buttresses, rose window medallion & lancets
  const stX = fvX - 6.8;
  const stZ = fvZ - 4.8;
  w2CvAtlas.push(
    makeReliefBox(4.4, 11.5, 4.4, 'chateauAshlarStone', stX, fvY + 6.0, stZ),
    makeReliefCyl(0.18, 2.85, 5.2, 5, 'slateMansardRoof', stX, fvY + 14.3, stZ),
    // Corner buttresses & tall lancet window reveals
    makeReliefBox(0.65, 9.2, 0.65, 'chateauAshlarStone', stX + 2.1, fvY + 4.8, stZ + 2.1),
    makeReliefBox(0.65, 9.2, 0.65, 'chateauAshlarStone', stX + 2.1, fvY + 4.8, stZ - 2.1),
    makeReliefBox(0.18, 3.2, 1.15, 'greenSteelPier', stX + 2.24, fvY + 4.2, stZ),
    makeReliefCyl(0.78, 0.78, 0.22, 6, 'champagneGoldCladding', stX + 2.24, fvY + 8.4, stZ, 0, 0, Math.PI * 0.5)
  );
  const stCross = new THREE.BoxGeometry(0.16, 1.45, 0.16);
  stCross.translate(stX, fvY + 17.5, stZ);
  const stCrossArm = new THREE.BoxGeometry(0.16, 0.16, 0.85);
  stCrossArm.translate(stX, fvY + 17.8, stZ);
  w2CvGold.push(stCross, stCrossArm);

  // 205–206: Twin Haussmann French Village café facades, chimneys, striped awnings & bistro tables
  for (const czOff of [-5.2, 5.2]) {
    const cfX = fvX + 6.6;
    const cfZ = fvZ + czOff;
    w2CvAtlas.push(
      makeReliefBox(4.2, 5.8, 5.4, 'chateauAshlarStone', cfX, fvY + 3.2, cfZ),
      makeReliefBox(4.4, 1.85, 5.6, 'slateMansardRoof', cfX, fvY + 7.0, cfZ),
      makeReliefBox(0.62, 1.25, 0.62, 'chateauAshlarStone', cfX, fvY + 8.4, cfZ + 1.4),
      makeReliefBox(1.45, 0.16, 4.6, 'lobeliaVioletBloom', cfX - 2.65, fvY + 2.95, cfZ, 0, 0, 0.26),
      // Bistro round table & chairs
      makeReliefCyl(0.45, 0.45, 0.08, 6, 'merbauTimberDeck', cfX - 3.2, fvY + 1.12, cfZ),
      makeReliefCyl(0.06, 0.08, 0.72, 5, 'greenSteelPier', cfX - 3.2, fvY + 0.74, cfZ)
    );
  }

  // 207: Debay Wine Cellar arched stone tunnel portal & wooden wine barrels (96, -158)
  const dbX = 96.0;
  const dbZ = -158.0;
  const dbY = Math.max(
    ctx.getHeight(dbX, dbZ),
    ctx.getHeight(dbX - 2.8, dbZ - 2.4),
    ctx.getHeight(dbX + 2.8, dbZ - 2.4),
    ctx.getHeight(dbX - 2.8, dbZ + 2.4),
    ctx.getHeight(dbX + 2.8, dbZ + 2.4)
  );
  w2CvAtlas.push(
    makeReliefBox(6.2, 5.2, 5.4, 'chateauAshlarStone', dbX, dbY - 2.6, dbZ),
    makeReliefBox(5.6, 3.6, 4.8, 'chateauAshlarStone', dbX, dbY + 1.8, dbZ),
    makeReliefBox(2.2, 2.5, 0.35, 'greenSteelPier', dbX, dbY + 1.25, dbZ + 2.35),
    makeReliefCyl(0.36, 0.36, 0.92, 6, 'merbauTimberDeck', dbX - 2.1, dbY + 0.48, dbZ + 2.95, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.36, 0.36, 0.92, 6, 'merbauTimberDeck', dbX + 2.1, dbY + 0.48, dbZ + 2.95, 0, 0, Math.PI * 0.5)
  );

  // 208–209: Le Jardin d'Amour Love Garden arched stone pergola & central sundial (101, -145.5)
  const ljX = 101.0;
  const ljZ = -145.5;
  const ljY = Math.max(
    ctx.getHeight(ljX, ljZ),
    ctx.getHeight(ljX - 3.8, ljZ - 2.6),
    ctx.getHeight(ljX + 3.8, ljZ - 2.6),
    ctx.getHeight(ljX - 3.8, ljZ + 2.6),
    ctx.getHeight(ljX + 3.8, ljZ + 2.6)
  );
  w2CvAtlas.push(
    makeReliefBox(8.6, 5.0, 6.2, 'chateauAshlarStone', ljX, ljY - 2.5, ljZ),
    makeReliefBox(8.8, 0.24, 6.4, 'baNaMosaicPaver', ljX, ljY + 0.12, ljZ)
  );
  for (const px of [-3.5, 0, 3.5]) {
    for (const pz of [-2.4, 2.4]) {
      w2CvAtlas.push(makeReliefCyl(0.16, 0.20, 3.30, 6, 'chateauAshlarStone', ljX + px, ljY + 1.60, ljZ + pz));
    }
    w2CvAtlas.push(makeReliefBox(0.24, 0.24, 5.4, 'chateauAshlarStone', ljX + px, ljY + 3.2, ljZ));
  }
  w2CvAtlas.push(
    makeReliefBox(7.8, 0.22, 0.24, 'chateauAshlarStone', ljX, ljY + 3.2, ljZ - 2.4),
    makeReliefBox(7.8, 0.22, 0.24, 'chateauAshlarStone', ljX, ljY + 3.2, ljZ + 2.4),
    // Sundial stone plinth
    makeReliefCyl(0.38, 0.48, 1.05, 6, 'chateauAshlarStone', ljX, ljY + 0.55, ljZ)
  );
  const sundialPlate = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 6);
  sundialPlate.translate(ljX, ljY + 1.12, ljZ);
  const gnomon = new THREE.ConeGeometry(0.12, 0.36, 5);
  gnomon.rotateZ(-0.45);
  gnomon.translate(ljX + 0.06, ljY + 1.30, ljZ);
  w2CvGold.push(sundialPlate, gnomon);

  // 210, 212, 213, 215, 218: Heritage wayfinding signposts, vintage street-clock, belvedere binoculars, crowd-guide stanchions & dormer flower boxes
  for (const [sx, sy, sgn] of [[-78.5, wEndY, 1], [78.5, eEndY, -1]] as const) {
    // 210: Heritage wayfinding signpost
    w2CvGold.push(
      new THREE.CylinderGeometry(0.05, 0.07, 2.6, 5).translate(sx, sy + 1.3, -141.5),
      new THREE.BoxGeometry(0.95, 0.22, 0.06).translate(sx + sgn * 0.38, sy + 2.35, -141.5)
    );
    // 215: Gold-trimmed crowd-guide stanchions flanking bridge thresholds
    for (const side of [-1, 1]) {
      w2CvGold.push(
        new THREE.CylinderGeometry(0.04, 0.07, 0.95, 5).translate(sx - sgn * 2.2, sy + 0.55, -145.5 + side * 2.4)
      );
    }
    // 218: Alpine flower planter boxes under station dormers
    w2CvAtlas.push(
      makeReliefBox(0.45, 0.32, 1.25, 'lobeliaVioletBloom', sx - sgn * 2.0, sy + 6.75, -148.3),
      makeReliefBox(0.45, 0.32, 1.25, 'lobeliaVioletBloom', sx - sgn * 2.0, sy + 6.75, -142.7)
    );
  }
  // 212: Vintage French street-clock column at Marseille Station forecourt
  w2CvAtlas.push(makeReliefCyl(0.11, 0.16, 3.6, 6, 'greenSteelPier', -76.8, wEndY + 1.8, -149.2));
  w2CvGold.push(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 6).rotateZ(Math.PI * 0.5).translate(-76.8, wEndY + 3.85, -149.2));
  // 213: Brass viewfinder binocular stands on Marseille south belvedere balcony
  for (const bx of [-82.5, -80.0]) {
    w2CvGold.push(
      new THREE.CylinderGeometry(0.05, 0.07, 1.25, 5).translate(bx, wEndY + 0.72, -135.8),
      new THREE.BoxGeometry(0.28, 0.16, 0.38).translate(bx, wEndY + 1.40, -135.8)
    );
  }
  // 211, 214, 216, 217, 219, 220: Drainage culvert ribs, mountain trail steps, granite cliff ledges, mossy garden lanterns, cable-car gantry & eastern picnic pergola
  w2CvAtlas.push(
    makeReliefBox(1.8, 3.8, 0.95, 'chateauAshlarStone', -82.5, wEndY - 3.2, -138.6),
    makeReliefBox(1.8, 3.8, 0.95, 'chateauAshlarStone', -78.5, wEndY - 3.2, -138.6),
    // 216: Northern hillside granite cliff strata ledges under central piers
    makeReliefBox(6.4, 2.2, 4.2, 'giantHandMossyStone', -15.0, ctx.getHeight(-15, -149) + 0.8, -149.0),
    makeReliefBox(6.4, 2.2, 4.2, 'giantHandMossyStone', 15.0, ctx.getHeight(15, -149) + 0.8, -149.0),
    // 219: Cable-car maintenance gantry catwalk & safety ladder on truss pylon (-112)
    makeReliefBox(3.4, 0.18, 2.8, 'greenSteelPier', pylonX, pylonTopY - 1.2, pylonZ),
    makeReliefBox(0.38, pylonH * 0.85, 0.14, 'greenSteelPier', pylonX + 1.2, pylonBaseY + pylonH * 0.45, pylonZ),
    // 220: Wooden picnic benches & shaded pergola overlooking eastern Bà Nà pine slope (112, -138)
    ...(() => {
      const picX = 112.0;
      const picZ = -138.0;
      const picY = Math.max(
        ctx.getHeight(picX, picZ),
        ctx.getHeight(picX - 2.1, picZ - 1.7),
        ctx.getHeight(picX + 2.1, picZ - 1.7),
        ctx.getHeight(picX - 2.1, picZ + 1.7),
        ctx.getHeight(picX + 2.1, picZ + 1.7)
      );
      const pts: THREE.BufferGeometry[] = [
        makeReliefBox(4.8, 4.2, 4.0, 'chateauAshlarStone', picX, picY - 2.1, picZ),
        makeReliefBox(4.9, 0.22, 4.1, 'baNaMosaicPaver', picX, picY + 0.08, picZ),
        makeReliefBox(4.2, 0.18, 3.4, 'merbauTimberDeck', picX, picY + 2.65, picZ),
        makeReliefBox(2.2, 0.14, 0.75, 'merbauTimberDeck', picX, picY + 0.78, picZ),
        makeReliefBox(0.16, 0.85, 0.65, 'merbauTimberDeck', picX - 0.82, picY + 0.35, picZ),
        makeReliefBox(0.16, 0.85, 0.65, 'merbauTimberDeck', picX + 0.82, picY + 0.35, picZ)
      ];
      for (const ox of [-1.85, 1.85]) {
        for (const oz of [-1.45, 1.45]) {
          pts.push(makeReliefCyl(0.10, 0.12, 2.85, 6, 'merbauTimberDeck', picX + ox, picY + 1.28, picZ + oz));
        }
      }
      return pts;
    })()
  );
  // 214: Mountain trail steps connecting mosaic terrace up toward East station
  for (let st = 0; st < 5; st++) {
    const sx = 50.0 + st * 2.4;
    const sz = -137.5 - st * 0.9;
    w2CvAtlas.push(makeReliefBox(2.2, 0.35, 1.8, 'chateauAshlarStone', sx, ctx.getHeight(sx, sz) + 0.18, sz));
  }
  // 217: Mossy stone garden lantern pedestals lining mosaic terrace
  for (const lx of [-32, 0, 32]) {
    const lz = -135.5 + Math.sin(lx * 0.06) * 2.2 + 1.7;
    const ly = ctx.getHeight(lx, lz);
    w2CvAtlas.push(
      makeReliefBox(0.42, 0.95, 0.42, 'chateauAshlarStone', lx, ly + 0.55, lz),
      makeReliefCyl(0.10, 0.42, 0.32, 4, 'slateMansardRoof', lx, ly + 1.22, lz, Math.PI * 0.25)
    );
    const fernBase = new THREE.ConeGeometry(0.48, 0.38, 5);
    fernBase.translate(lx, ly + 0.25, lz + 0.35);
    colorizeGeo(fernBase, 0x2f6828);
    w2CvLeaf.push(fernBase);
  }

  const w2CvAtlasMesh = createMergedMesh('GoldenBridgeWave2Atlas', w2CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w2CvAtlasMesh) group.add(w2CvAtlasMesh);
  const w2CvGoldMesh = createMergedMesh('GoldenBridgeWave2Gold', w2CvGold, brushedGoldMat, false, false);
  if (w2CvGoldMesh) group.add(w2CvGoldMesh);
  const w2CvLeafMesh = createMergedMesh('GoldenBridgeWave2Leaf', w2CvLeaf, foliageMat, false, false);
  if (w2CvLeafMesh) group.add(w2CvLeafMesh);

  // ==========================================================================
  // WAVE 3 UPGRADES (Items 401–440): Luna Castle, Eclipse Square,
  // Chùa Linh Ứng Bà Nà, Làng Pháp & Le Jardin d'Amour Details
  // ==========================================================================
  const w3CvAtlas: THREE.BufferGeometry[] = [];
  const w3CvGold: THREE.BufferGeometry[] = [];
  const w3CvLeaf: THREE.BufferGeometry[] = [];

  // 401–408: Lâu Đài Mặt Trăng (Luna Castle) raised medieval fortress north-west of French Village (-124, -172)
  const lcX = -124.0;
  const lcZ = -172.0;
  const lcY = Math.max(
    ctx.getHeight(lcX, lcZ),
    ctx.getHeight(lcX - 8.5, lcZ - 7.0),
    ctx.getHeight(lcX + 8.5, lcZ - 7.0),
    ctx.getHeight(lcX - 8.5, lcZ + 7.0),
    ctx.getHeight(lcX + 8.5, lcZ + 7.0)
  );
  w3CvAtlas.push(
    // 401: Deep retaining foundation skirt (-3.8m) & mosaic terrace deck
    makeReliefBox(17.4, 7.8, 14.4, 'chateauAshlarStone', lcX, lcY - 3.8, lcZ),
    makeReliefBox(17.8, 0.28, 14.8, 'baNaMosaicPaver', lcX, lcY + 0.14, lcZ),
    // 402: Central Gothic stone keep & battlement parapet
    makeReliefBox(11.6, 7.6, 8.8, 'chateauAshlarStone', lcX, lcY + 3.9, lcZ - 1.2),
    makeReliefBox(12.0, 0.72, 9.2, 'chateauAshlarStone', lcX, lcY + 7.95, lcZ - 1.2),
    // 403–404: Twin cylindrical corner defensive turrets & flush conical slate spires
    makeReliefCyl(1.48, 1.58, 10.6, 6, 'chateauAshlarStone', lcX - 5.6, lcY + 5.2, lcZ + 2.8),
    makeReliefCyl(1.48, 1.58, 10.6, 6, 'chateauAshlarStone', lcX + 5.6, lcY + 5.2, lcZ + 2.8),
    makeReliefCyl(0.14, 1.82, 4.4, 6, 'slateMansardRoof', lcX - 5.6, lcY + 12.6, lcZ + 2.8),
    makeReliefCyl(0.14, 1.82, 4.4, 6, 'slateMansardRoof', lcX + 5.6, lcY + 12.6, lcZ + 2.8),
    // 405: Central tall Gothic spire lantern tower
    makeReliefBox(3.4, 4.6, 3.4, 'chateauAshlarStone', lcX, lcY + 10.3, lcZ - 1.2),
    makeReliefCyl(0.16, 2.35, 5.0, 6, 'slateMansardRoof', lcX, lcY + 15.0, lcZ - 1.2),
    // 406: Pointed Gothic arched entry portal & dark-steel portcullis recess
    makeReliefBox(3.4, 4.4, 1.15, 'chateauAshlarStone', lcX, lcY + 2.3, lcZ + 3.4),
    makeReliefBox(2.0, 3.2, 0.35, 'greenSteelPier', lcX, lcY + 1.7, lcZ + 3.92),
    // 407: Flanking medieval stone buttress piers
    makeReliefBox(0.85, 6.2, 1.15, 'chateauAshlarStone', lcX - 2.6, lcY + 3.2, lcZ + 3.4),
    makeReliefBox(0.85, 6.2, 1.15, 'chateauAshlarStone', lcX + 2.6, lcY + 3.2, lcZ + 3.4),
    // 408: Stepped stone approach stairs & side parapet cheeks
    makeReliefBox(4.2, 0.45, 2.8, 'chateauAshlarStone', lcX, lcY + 0.22, lcZ + 5.8),
    makeReliefBox(0.38, 1.05, 2.8, 'chateauAshlarStone', lcX - 2.1, lcY + 0.65, lcZ + 5.8),
    makeReliefBox(0.38, 1.05, 2.8, 'chateauAshlarStone', lcX + 2.1, lcY + 0.65, lcZ + 5.8)
  );
  w3CvGold.push(
    new THREE.ConeGeometry(0.22, 1.15, 5).translate(lcX, lcY + 17.95, lcZ - 1.2),
    new THREE.ConeGeometry(0.16, 0.72, 5).translate(lcX - 5.6, lcY + 15.05, lcZ + 2.8),
    new THREE.ConeGeometry(0.16, 0.72, 5).translate(lcX + 5.6, lcY + 15.05, lcZ + 2.8)
  );

  // 409–415: Quảng Trường Nhật Thực (Eclipse Square) conical Nón Lá glass-steel tower & classical stone colonnades (-102, -182)
  const esX = -102.0;
  const esZ = -182.0;
  const esY = Math.max(
    ctx.getHeight(esX, esZ),
    ctx.getHeight(esX - 10.0, esZ - 8.0),
    ctx.getHeight(esX + 10.0, esZ - 8.0),
    ctx.getHeight(esX - 10.0, esZ + 8.0),
    ctx.getHeight(esX + 10.0, esZ + 8.0)
  );
  w3CvAtlas.push(
    // 409: Broad mosaic plaza terrace & deep retaining foundation skirt
    makeReliefBox(20.4, 7.6, 16.4, 'chateauAshlarStone', esX, esY - 3.7, esZ),
    makeReliefBox(20.8, 0.26, 16.8, 'baNaMosaicPaver', esX, esY + 0.13, esZ),
    // 410–411: Stepped circular dance-floor dais & conical Louvre/Nón Lá tower
    makeReliefCyl(4.6, 4.9, 0.48, 6, 'chateauAshlarStone', esX, esY + 0.36, esZ),
    makeReliefCyl(0.24, 3.85, 7.6, 6, 'greenSteelPier', esX, esY + 4.35, esZ),
    // 414: Continuous classical stone entablature lintel beams crowning west & east colonnades
    makeReliefBox(1.15, 0.65, 13.6, 'chateauAshlarStone', esX - 8.4, esY + 4.85, esZ),
    makeReliefBox(1.15, 0.65, 13.6, 'chateauAshlarStone', esX + 8.4, esY + 4.85, esZ)
  );
  // 412–413: West & East classical stone colonnade pillars (6 per wing, embedded -0.15m into plaza top & connecting to entablature)
  for (let cp = 0; cp < 6; cp++) {
    const czPos = esZ - 6.0 + cp * 2.4;
    w3CvAtlas.push(
      makeReliefCyl(0.26, 0.30, 4.72, 6, 'chateauAshlarStone', esX - 8.4, esY + 2.38, czPos),
      makeReliefCyl(0.26, 0.30, 4.72, 6, 'chateauAshlarStone', esX + 8.4, esY + 2.38, czPos)
    );
  }
  // 415: Gilded celestial sun-and-moon medallion emblems & tower apex spire
  w3CvGold.push(
    new THREE.ConeGeometry(0.28, 1.05, 5).translate(esX, esY + 8.55, esZ),
    new THREE.CylinderGeometry(0.65, 0.65, 0.14, 6).rotateZ(Math.PI * 0.5).translate(esX - 7.78, esY + 4.85, esZ),
    new THREE.CylinderGeometry(0.65, 0.65, 0.14, 6).rotateZ(Math.PI * 0.5).translate(esX + 7.78, esY + 4.85, esZ)
  );

  // 416–423: Chùa Linh Ứng Bà Nà sanctuary terrace, 27m-motif Shakyamuni Buddha on octagonal lotus base & Chánh Điện (122, -168)
  const luX = 122.0;
  const luZ = -168.0;
  const luY = Math.max(
    ctx.getHeight(luX, luZ),
    ctx.getHeight(luX - 9.0, luZ - 8.0),
    ctx.getHeight(luX + 9.0, luZ - 8.0),
    ctx.getHeight(luX - 9.0, luZ + 8.0),
    ctx.getHeight(luX + 9.0, luZ + 8.0)
  );
  w3CvAtlas.push(
    // 416: Sacred mountain terrace & deep retaining foundation skirt
    makeReliefBox(18.4, 7.8, 16.4, 'chateauAshlarStone', luX, luY - 3.8, luZ),
    makeReliefBox(18.8, 0.26, 16.8, 'baNaMosaicPaver', luX, luY + 0.13, luZ),
    // 417: Multi-tiered octagonal stone lotus pedestal base
    makeReliefCyl(3.8, 4.2, 1.35, 6, 'chateauAshlarStone', luX, luY + 0.85, luZ - 3.8),
    makeReliefCyl(2.9, 3.3, 1.05, 6, 'chateauAshlarStone', luX, luY + 2.02, luZ - 3.8),
    // 418: Monumental white-stone seated Shakyamuni Buddha silhouette atop lotus pedestal
    makeReliefCyl(2.2, 2.55, 1.45, 6, 'chateauAshlarStone', luX, luY + 3.22, luZ - 3.8),
    makeReliefCyl(1.35, 1.95, 3.6, 6, 'chateauAshlarStone', luX, luY + 5.65, luZ - 3.8),
    makeReliefCyl(0.82, 0.92, 1.65, 6, 'chateauAshlarStone', luX, luY + 8.15, luZ - 3.8),
    makeReliefCyl(0.32, 0.48, 0.55, 6, 'chateauAshlarStone', luX, luY + 9.18, luZ - 3.8),
    // 419: Traditional Northern Vietnamese Chánh Điện hall with 4 grounded timber columns & double-tier flat-ridge roof
    makeReliefBox(7.8, 3.6, 4.2, 'merbauTimberDeck', luX, luY + 1.95, luZ + 3.1),
    makeReliefBox(9.0, 0.95, 6.4, 'slateMansardRoof', luX, luY + 4.18, luZ + 3.6),
    makeReliefBox(6.8, 0.85, 4.6, 'slateMansardRoof', luX, luY + 5.02, luZ + 3.6),
    // 421: Twin bronze/stone incense cauldrons (Lư Hương) before Buddha terrace
    makeReliefCyl(0.45, 0.55, 1.05, 6, 'greenSteelPier', luX - 2.8, luY + 0.65, luZ + 0.2),
    makeReliefCyl(0.45, 0.55, 1.05, 6, 'greenSteelPier', luX + 2.8, luY + 0.65, luZ + 0.2),
    // 422: Stone stairway with carved side balustrades ascending from Le Jardin d'Amour trail
    makeReliefBox(4.0, 0.45, 3.2, 'chateauAshlarStone', luX - 7.8, luY + 0.22, luZ + 5.6),
    makeReliefBox(0.35, 0.95, 3.2, 'chateauAshlarStone', luX - 9.8, luY + 0.62, luZ + 5.6),
    makeReliefBox(0.35, 0.95, 3.2, 'chateauAshlarStone', luX - 5.8, luY + 0.62, luZ + 5.6),
    // 423: Manicured bonsai pine planter boxes flanking sanctuary terrace
    makeReliefBox(1.35, 0.55, 1.35, 'chateauAshlarStone', luX - 6.8, luY + 0.40, luZ - 2.5),
    makeReliefBox(1.35, 0.55, 1.35, 'chateauAshlarStone', luX + 6.8, luY + 0.40, luZ - 2.5)
  );
  // 419 front timber veranda columns embedded -0.15m into floor & connecting to lower eave
  for (const cxO of [-3.4, -1.15, 1.15, 3.4]) {
    w3CvAtlas.push(makeReliefCyl(0.13, 0.15, 3.85, 5, 'merbauTimberDeck', luX + cxO, luY + 1.98, luZ + 6.15));
  }
  // 420: Gilded flat-ridge roof dragon-scroll finial seated flush (ridgeTopY - 0.05) on Chánh Điện
  w3CvGold.push(
    new THREE.BoxGeometry(4.4, 0.28, 0.24).translate(luX, luY + 5.54, luZ + 3.6),
    new THREE.ConeGeometry(0.24, 0.62, 5).translate(luX, luY + 5.92, luZ + 3.6)
  );
  for (const s of [-1, 1]) {
    const bp = new THREE.ConeGeometry(0.95, 1.45, 5).translate(luX + s * 6.8, luY + 1.38, luZ - 2.5);
    colorizeGeo(bp, 0x225a24);
    w3CvLeaf.push(bp);
  }

  // 424–440: French Village connector ramp, café umbrellas, fountain bollards, St. Denis side-aisle & lantern posts,
  // Marseille belvedere urns, cable-car canopy struts, Cầu Vàng pier collars & ribs, map lecterns, Le Jardin arches, Debay barrel rack & alpine pines
  const rampMidY = Math.max(fvY, esY, ctx.getHeight(fvX, -170.0));
  w3CvAtlas.push(
    // 424: French Village to Eclipse Square cobbled connector ramp with deep stone retaining foundation skirt
    makeReliefBox(6.2, 7.6, 9.0, 'chateauAshlarStone', fvX, rampMidY - 3.7, -170.0),
    makeReliefBox(6.4, 0.45, 9.2, 'baNaMosaicPaver', fvX, rampMidY + 0.15, -170.0),
    // 425: French Village north-edge café umbrella stands & bistro tables
    makeReliefCyl(0.05, 0.06, 2.55, 5, 'greenSteelPier', fvX - 2.4, fvY + 1.55, fvZ - 5.6),
    makeReliefCyl(0.05, 0.06, 2.55, 5, 'greenSteelPier', fvX + 2.4, fvY + 1.55, fvZ - 5.6),
    makeReliefCyl(0.18, 1.45, 0.55, 6, 'lobeliaVioletBloom', fvX - 2.4, fvY + 2.85, fvZ - 5.6),
    makeReliefCyl(0.18, 1.45, 0.55, 6, 'lobeliaVioletBloom', fvX + 2.4, fvY + 2.85, fvZ - 5.6),
    // 427–428: St. Denis Church flanking side-aisle buttresses, slate lean-to roof & portal steps
    makeReliefBox(2.2, 4.6, 5.2, 'chateauAshlarStone', stX - 3.2, fvY + 2.4, stZ),
    makeReliefBox(2.4, 0.65, 5.4, 'slateMansardRoof', stX - 3.2, fvY + 4.95, stZ),
    makeReliefBox(1.85, 0.45, 2.8, 'chateauAshlarStone', stX + 2.9, fvY + 0.35, stZ),
    // 430: Marseille cable-car arrival canopy steel support struts & overhead signage beam
    makeReliefCyl(0.10, 0.12, 3.6, 5, 'greenSteelPier', -84.2, wEndY + 1.75, -148.5),
    makeReliefCyl(0.10, 0.12, 3.6, 5, 'greenSteelPier', -84.2, wEndY + 1.75, -142.5),
    makeReliefBox(0.35, 0.42, 6.6, 'champagneGoldCladding', -84.2, wEndY + 3.55, -145.5),
    // 436–437: Debay Wine Cellar 4-post timber barrel-rack awning & stacked oak casks (deep retaining foundation skirt on slope!)
    makeReliefBox(4.0, 5.6, 2.8, 'chateauAshlarStone', dbX + 4.8, dbY - 2.8, dbZ + 1.2),
    makeReliefBox(4.1, 0.22, 2.9, 'baNaMosaicPaver', dbX + 4.8, dbY + 0.11, dbZ + 1.2),
    makeReliefBox(3.8, 0.18, 2.6, 'merbauTimberDeck', dbX + 4.8, dbY + 2.55, dbZ + 1.2),
    makeReliefCyl(0.08, 0.10, 2.75, 5, 'merbauTimberDeck', dbX + 3.1, dbY + 1.28, dbZ + 0.1),
    makeReliefCyl(0.08, 0.10, 2.75, 5, 'merbauTimberDeck', dbX + 6.5, dbY + 1.28, dbZ + 0.1),
    makeReliefCyl(0.08, 0.10, 2.75, 5, 'merbauTimberDeck', dbX + 3.1, dbY + 1.28, dbZ + 2.3),
    makeReliefCyl(0.08, 0.10, 2.75, 5, 'merbauTimberDeck', dbX + 6.5, dbY + 1.28, dbZ + 2.3),
    makeReliefCyl(0.38, 0.38, 1.05, 6, 'merbauTimberDeck', dbX + 4.8, dbY + 0.55, dbZ + 1.2, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.38, 0.38, 1.05, 6, 'merbauTimberDeck', dbX + 4.8, dbY + 1.22, dbZ + 1.2, 0, 0, Math.PI * 0.5),
    // 438: Eastern Bà Nà pine-slope stone retaining curb wall
    makeReliefBox(0.55, 0.85, 10.5, 'chateauAshlarStone', 114.6, ctx.getHeight(114.6, -138.0) + 0.35, -138.0)
  );
  // 426: Fountain corner lion-spout bollards & 428 St. Denis twin entry lantern posts
  for (const s of [-1, 1]) {
    w3CvAtlas.push(
      makeReliefCyl(0.16, 0.22, 0.92, 5, 'chateauAshlarStone', fvX + s * 3.1, fvY + 0.72, fvZ + s * 3.1),
      makeReliefCyl(0.06, 0.08, 2.45, 5, 'greenSteelPier', stX + 3.4, fvY + 1.35, stZ + s * 1.6),
      // 429: Marseille south belvedere stone parapet urns
      makeReliefCyl(0.28, 0.20, 0.58, 6, 'chateauAshlarStone', -81.2 + s * 2.4, wEndY + 1.25, -135.4),
      // 435: Le Jardin d'Amour stone garden benches beside pergola
      makeReliefBox(1.85, 0.46, 0.52, 'chateauAshlarStone', ljX + s * 5.2, ljY + 0.32, ljZ),
      // 440: Vintage French double-arm plaza lamp-posts on Eclipse Square
      makeReliefCyl(0.08, 0.11, 3.85, 5, 'greenSteelPier', esX + s * 5.8, esY + 2.0, esZ + 5.8)
    );
    w3CvGold.push(
      new THREE.BoxGeometry(0.26, 0.34, 0.26).translate(stX + 3.4, fvY + 2.72, stZ + s * 1.6),
      new THREE.BoxGeometry(0.95, 0.10, 0.10).translate(esX + s * 5.8, esY + 3.85, esZ + 5.8),
      new THREE.BoxGeometry(0.26, 0.32, 0.26).translate(esX + s * 5.8 - 0.42, esY + 4.05, esZ + 5.8),
      new THREE.BoxGeometry(0.26, 0.32, 0.26).translate(esX + s * 5.8 + 0.42, esY + 4.05, esZ + 5.8)
    );
  }
  // 431–432: Cầu Vàng central pier granite rockery collars & champagne-gold under-deck structural rib brackets
  for (const px of [-46, 0, 46]) {
    const pc = getGoldenBridgeCurveAtX(px);
    const pGy = ctx.getHeight(px, pc.z);
    w3CvAtlas.push(makeReliefCyl(1.45, 1.85, 1.35, 6, 'giantHandMossyStone', px, pGy + 0.45, pc.z));
    w3CvGold.push(new THREE.BoxGeometry(0.45, 0.55, 4.4).translate(px, pc.y - 0.65, pc.z));
  }
  // 433: East & West arrival plaza brass heritage map lecterns
  for (const [mx, my] of [[-77.2, wEndY], [77.2, eEndY]] as const) {
    w3CvAtlas.push(makeReliefBox(0.55, 1.02, 0.45, 'chateauAshlarStone', mx, my + 0.52, -140.2));
    w3CvGold.push(new THREE.BoxGeometry(0.75, 0.10, 0.52).rotateX(0.32).translate(mx, my + 1.08, -140.2));
  }
  // 434: Le Jardin d'Amour floral arch trellises (grounded posts)
  for (const ax of [93.5, 108.5]) {
    const ay = Math.max(ctx.getHeight(ax, -145.5), ctx.getHeight(ax, -147.2), ctx.getHeight(ax, -143.8));
    w3CvAtlas.push(
      makeReliefCyl(0.07, 0.08, 3.85, 5, 'greenSteelPier', ax, ay + 0.85, -147.2),
      makeReliefCyl(0.07, 0.08, 3.85, 5, 'greenSteelPier', ax, ay + 0.85, -143.8),
      makeReliefBox(0.24, 0.24, 3.6, 'lobeliaVioletBloom', ax, ay + 2.78, -145.5)
    );
  }
  // 439: Bà Nà mist-shrouded pine clusters framing Luna Castle & Chùa Linh Ứng (clear >= 5.5m outside all walls & terraces!)
  for (const [tx, tz] of [[-139.5, -176], [-116, -185.5], [137.5, -174], [116, -182.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w3CvAtlas.push(makeReliefCyl(0.18, 0.26, 4.2, 5, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pineTop = new THREE.ConeGeometry(2.4, 5.2, 5).translate(tx, ty + 5.6, tz);
    colorizeGeo(pineTop, 0x1e4d22);
    w3CvLeaf.push(pineTop);
  }

  const w3CvAtlasMesh = createMergedMesh('GoldenBridgeWave3Atlas', w3CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w3CvAtlasMesh) group.add(w3CvAtlasMesh);
  const w3CvGoldMesh = createMergedMesh('GoldenBridgeWave3Gold', w3CvGold, brushedGoldMat, false, false);
  if (w3CvGoldMesh) group.add(w3CvGoldMesh);
  const w3CvLeafMesh = createMergedMesh('GoldenBridgeWave3Leaf', w3CvLeaf, foliageMat, false, false);
  if (w3CvLeafMesh) group.add(w3CvLeafMesh);

  // ==========================================================================
  // WAVE 4 UPGRADES (Items 801–840): Bà Nà Brew Plaza, Alpine Coaster Station,
  // Le Jardin d'Amour Maze & Sculpture Terrace, Chùa Linh Ứng Bell/Drum Pavilions
  // ==========================================================================
  const w4CvAtlas: THREE.BufferGeometry[] = [];
  const w4CvGold: THREE.BufferGeometry[] = [];
  const w4CvLeaf: THREE.BufferGeometry[] = [];

  // 801–807: Quảng Trường Bia Thủ Công (Bà Nà Brew Plaza) west of French Village (-124, -152)
  const bpX = -124.0;
  const bpZ = -152.0;
  const bpY = Math.max(
    ctx.getHeight(bpX, bpZ),
    ctx.getHeight(bpX - 6.5, bpZ - 5.5),
    ctx.getHeight(bpX + 6.5, bpZ - 5.5),
    ctx.getHeight(bpX - 6.5, bpZ + 5.5),
    ctx.getHeight(bpX + 6.5, bpZ + 5.5)
  );
  w4CvAtlas.push(
    makeReliefBox(13.2, 7.6, 11.2, 'chateauAshlarStone', bpX, bpY - 3.7, bpZ),
    makeReliefBox(13.6, 0.26, 11.6, 'baNaMosaicPaver', bpX, bpY + 0.13, bpZ),
    // 802: Alpine Beer Hall facade & flush pitched slate roof
    makeReliefBox(6.8, 4.4, 4.6, 'chateauAshlarStone', bpX - 2.6, bpY + 2.35, bpZ - 2.4),
    makeReliefBox(7.4, 1.55, 5.2, 'slateMansardRoof', bpX - 2.6, bpY + 5.30, bpZ - 2.4),
    // 805: 4-post timber sun-pergola shading tasting courtyard
    makeReliefBox(4.4, 0.18, 3.6, 'merbauTimberDeck', bpX + 3.2, bpY + 2.95, bpZ + 1.8),
    makeReliefCyl(0.09, 0.11, 3.05, 5, 'merbauTimberDeck', bpX + 1.2, bpY + 1.45, bpZ + 0.2),
    makeReliefCyl(0.09, 0.11, 3.05, 5, 'merbauTimberDeck', bpX + 5.2, bpY + 1.45, bpZ + 0.2),
    makeReliefCyl(0.09, 0.11, 3.05, 5, 'merbauTimberDeck', bpX + 1.2, bpY + 1.45, bpZ + 3.4),
    makeReliefCyl(0.09, 0.11, 3.05, 5, 'merbauTimberDeck', bpX + 5.2, bpY + 1.45, bpZ + 3.4),
    // 807: Stepped stone staircase descending toward Marseille Station plaza
    makeReliefBox(3.2, 0.45, 2.4, 'chateauAshlarStone', bpX + 7.2, bpY - 0.15, bpZ + 1.8)
  );
  // 803–804, 806: Copper-gold brewing kettle towers, oak-barrel high-top tables & wrought-iron sign gantry
  for (const s of [-1, 1]) {
    w4CvGold.push(
      new THREE.CylinderGeometry(0.68, 0.72, 2.4, 6).translate(bpX - 2.6 + s * 4.2, bpY + 1.45, bpZ - 2.4),
      new THREE.ConeGeometry(0.70, 0.85, 6).translate(bpX - 2.6 + s * 4.2, bpY + 3.05, bpZ - 2.4),
      new THREE.CylinderGeometry(0.06, 0.08, 3.1, 5).translate(bpX + 5.8, bpY + 1.65, bpZ + 1.8 + s * 1.6)
    );
    w4CvAtlas.push(
      makeReliefCyl(0.38, 0.36, 0.96, 6, 'merbauTimberDeck', bpX + 2.4 + s * 1.1, bpY + 0.68, bpZ + 1.8),
      makeReliefCyl(0.38, 0.36, 0.96, 6, 'merbauTimberDeck', bpX - 1.2 + s * 1.4, bpY + 0.68, bpZ + 2.8)
    );
  }
  w4CvGold.push(new THREE.BoxGeometry(0.18, 0.32, 3.5).translate(bpX + 5.8, bpY + 3.25, bpZ + 1.8));

  // 808–812: Ga Xe Trượt Ống Bà Nà (Alpine Coaster boarding station & downhill track at 114, -152)
  const acX = 114.0;
  const acZ = -152.0;
  const acY = Math.max(
    ctx.getHeight(acX, acZ),
    ctx.getHeight(acX - 4.0, acZ - 3.2),
    ctx.getHeight(acX + 4.0, acZ + 3.2)
  );
  w4CvAtlas.push(
    makeReliefBox(8.2, 6.8, 6.4, 'chateauAshlarStone', acX, acY - 3.3, acZ),
    makeReliefBox(8.4, 0.24, 6.6, 'baNaMosaicPaver', acX, acY + 0.12, acZ),
    makeReliefBox(6.8, 0.22, 5.2, 'slateMansardRoof', acX, acY + 3.25, acZ),
    // 810: Elevated twin-rail downhill track curve descending east
    makeReliefBox(12.5, 0.16, 0.14, 'greenSteelPier', acX + 9.2, acY + 0.45, acZ - 0.52, 0, 0, -0.18),
    makeReliefBox(12.5, 0.16, 0.14, 'greenSteelPier', acX + 9.2, acY + 0.45, acZ + 0.52, 0, 0, -0.18)
  );
  for (const ox of [-3.0, 3.0]) {
    for (const oz of [-2.2, 2.2]) {
      w4CvAtlas.push(makeReliefCyl(0.10, 0.12, 3.25, 5, 'greenSteelPier', acX + ox, acY + 1.62, acZ + oz));
    }
  }
  for (let ts = 0; ts < 3; ts++) {
    const tx = acX + 5.5 + ts * 3.8;
    const tGy = ctx.getHeight(tx, acZ) - 0.8;
    const tTop = acY + 0.85 - ts * 0.65;
    const tH = Math.max(1.5, tTop - tGy);
    w4CvAtlas.push(makeReliefCyl(0.10, 0.12, tH, 5, 'greenSteelPier', tx, tGy + tH * 0.5, acZ));
  }
  // 812: 2 champagne-gold Alpine Coaster sled carts
  w4CvGold.push(
    new THREE.BoxGeometry(1.45, 0.48, 0.92).translate(acX - 0.8, acY + 0.55, acZ),
    new THREE.BoxGeometry(1.45, 0.48, 0.92).translate(acX + 1.6, acY + 0.55, acZ)
  );

  // 813–817: Vườn Tượng & Mê Cung Le Jardin d'Amour (Hedge-Maze & Sculpture Terrace at 122, -142)
  const mzX = 122.0;
  const mzZ = -142.0;
  const mzY = Math.max(
    ctx.getHeight(mzX, mzZ),
    ctx.getHeight(mzX - 5.2, mzZ - 4.4),
    ctx.getHeight(mzX + 5.2, mzZ + 4.4)
  );
  w4CvAtlas.push(
    makeReliefBox(10.6, 6.8, 9.0, 'chateauAshlarStone', mzX, mzY - 3.3, mzZ),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', mzX, mzY + 0.12, mzZ),
    makeReliefCyl(0.58, 0.68, 1.35, 6, 'chateauAshlarStone', mzX, mzY + 0.85, mzZ),
    makeReliefBox(8.6, 0.48, 0.52, 'chateauAshlarStone', mzX, mzY + 0.42, mzZ + 4.0)
  );
  w4CvGold.push(new THREE.TorusGeometry(0.68, 0.06, 4, 7).translate(mzX, mzY + 2.25, mzZ));
  for (const sx of [-4.2, 4.2]) {
    for (const sz of [-3.4, 3.4]) {
      w4CvAtlas.push(makeReliefCyl(0.28, 0.22, 0.82, 6, 'chateauAshlarStone', mzX + sx, mzY + 0.62, mzZ + sz));
    }
  }
  for (const s of [-1, 1]) {
    const h1 = new THREE.BoxGeometry(7.2, 0.95, 0.52).translate(mzX, mzY + 0.65, mzZ + s * 2.6);
    const h2 = new THREE.BoxGeometry(0.52, 0.95, 4.8).translate(mzX + s * 3.2, mzY + 0.65, mzZ);
    colorizeGeo(h1, 0x2a6626);
    colorizeGeo(h2, 0x2a6626);
    w4CvLeaf.push(h1, h2);
  }

  // 818–840: Luna Castle curtain wall & obelisk, Eclipse Square balustrade/benches/compass, Chùa Linh Ứng Bell & Drum Pavilions,
  // French Village arcade & Morris kiosk, Debay tasting bar, Marseille tension pylon, Cầu Vàng markers, Mosaic viewing deck & outer pines
  w4CvAtlas.push(
    // 818–819: Luna Castle western curtain-wall & sentry turret + courtyard obelisk
    makeReliefBox(1.15, 5.2, 8.6, 'chateauAshlarStone', lcX - 8.2, lcY + 2.6, lcZ),
    makeReliefCyl(1.15, 1.25, 6.8, 6, 'chateauAshlarStone', lcX - 8.2, lcY + 3.4, lcZ + 4.4),
    makeReliefCyl(0.12, 1.38, 2.8, 6, 'slateMansardRoof', lcX - 8.2, lcY + 8.15, lcZ + 4.4),
    makeReliefCyl(0.28, 0.45, 3.2, 4, 'chateauAshlarStone', lcX, lcY + 1.75, lcZ + 5.2, Math.PI * 0.25),
    // 821–822: Eclipse Square north stone balustrade & amphitheater benches
    makeReliefBox(16.0, 0.92, 0.36, 'chateauAshlarStone', esX, esY + 0.62, esZ - 7.8),
    makeReliefBox(5.2, 0.48, 0.58, 'chateauAshlarStone', esX - 4.2, esY + 0.42, esZ - 5.2),
    makeReliefBox(5.2, 0.48, 0.58, 'chateauAshlarStone', esX + 4.2, esY + 0.42, esZ - 5.2),
    // 824 & 826: Chùa Linh Ứng Lầu Chuông (Bell Pavilion) & Lầu Trống (Drum Pavilion) on flanking terrace corners
    makeReliefBox(3.4, 0.22, 3.4, 'slateMansardRoof', luX + 7.2, luY + 3.35, luZ + 5.2),
    makeReliefCyl(0.14, 2.55, 1.45, 4, 'slateMansardRoof', luX + 7.2, luY + 4.15, luZ + 5.2, Math.PI * 0.25),
    makeReliefBox(3.4, 0.22, 3.4, 'slateMansardRoof', luX - 7.2, luY + 3.35, luZ + 5.2),
    makeReliefCyl(0.14, 2.55, 1.45, 4, 'slateMansardRoof', luX - 7.2, luY + 4.15, luZ + 5.2, Math.PI * 0.25),
    // 827: Chùa Linh Ứng stone Bình Phong meditation screen
    makeReliefBox(3.6, 2.1, 0.42, 'chateauAshlarStone', luX, luY + 1.20, luZ + 7.4),
    // 829–830: French Village south arcade colonnade & Parisian Colonne Morris kiosk
    makeReliefBox(11.0, 0.48, 1.85, 'chateauAshlarStone', fvX, fvY + 3.85, fvZ + 6.4),
    makeReliefCyl(0.62, 0.66, 3.1, 6, 'greenSteelPier', fvX - 5.8, fvY + 1.85, fvZ + 4.6),
    makeReliefCyl(0.14, 0.82, 0.72, 6, 'slateMansardRoof', fvX - 5.8, fvY + 3.72, fvZ + 4.6),
    // 832–833: Debay Wine Cellar stone tasting counter & vineyard trellis arch
    makeReliefBox(2.4, 0.95, 0.72, 'chateauAshlarStone', dbX, dbY + 0.55, dbZ + 3.8),
    makeReliefCyl(0.07, 0.08, 2.85, 5, 'greenSteelPier', dbX + 2.6, dbY + 1.42, dbZ + 3.2),
    makeReliefCyl(0.07, 0.08, 2.85, 5, 'greenSteelPier', dbX + 7.0, dbY + 1.42, dbZ + 3.2),
    makeReliefBox(4.6, 0.16, 0.18, 'greenSteelPier', dbX + 4.8, dbY + 2.85, dbZ + 3.2),
    // 834–835: Marseille secondary tension pylon & arrival bench
    makeReliefBox(1.85, 10.5, 1.85, 'greenSteelPier', pylonX, pylonBaseY + 5.2, pylonZ + 6.5),
    makeReliefBox(1.85, 0.48, 0.58, 'merbauTimberDeck', -78.2, wEndY + 0.42, -148.0),
    // 838: Vườn Hoa Mosaic lower terrace curved viewing deck
    makeReliefBox(7.2, 0.32, 3.6, 'merbauTimberDeck', 0.0, ctx.getHeight(0, -131.0) + 0.35, -131.0)
  );
  // 824–826 grounded corner posts + suspended bell/drum
  for (const pavX of [luX + 7.2, luX - 7.2]) {
    for (const pxO of [-1.35, 1.35]) {
      for (const pzO of [-1.35, 1.35]) {
        w4CvAtlas.push(makeReliefCyl(0.10, 0.12, 3.35, 5, 'merbauTimberDeck', pavX + pxO, luY + 1.72, luZ + 5.2 + pzO));
      }
    }
  }
  w4CvGold.push(
    new THREE.CylinderGeometry(0.28, 0.42, 0.85, 6).translate(luX + 7.2, luY + 2.15, luZ + 5.2),
    new THREE.CylinderGeometry(0.45, 0.45, 0.72, 6).rotateZ(Math.PI * 0.5).translate(luX - 7.2, luY + 1.55, luZ + 5.2),
    // 819–820, 823, 828, 836: Luna obelisk finial, Eclipse compass inlay, Linh Ứng lanterns & Cầu Vàng elevation markers
    new THREE.ConeGeometry(0.24, 0.65, 5).translate(lcX, lcY + 3.62, lcZ + 5.2),
    new THREE.CylinderGeometry(1.15, 1.15, 0.06, 6).translate(esX, esY + 0.64, esZ),
    new THREE.BoxGeometry(0.42, 0.32, 0.10).translate(-15.0, getGoldenBridgeCurveAtX(-15).y + 1.35, getGoldenBridgeCurveAtX(-15).z + 2.75),
    new THREE.BoxGeometry(0.42, 0.32, 0.10).translate(15.0, getGoldenBridgeCurveAtX(15).y + 1.35, getGoldenBridgeCurveAtX(15).z + 2.75)
  );
  // 829: French Village south arcade columns (5 grounded columns)
  for (let ac = -2; ac <= 2; ac++) {
    w4CvAtlas.push(makeReliefCyl(0.18, 0.22, 3.65, 6, 'chateauAshlarStone', fvX + ac * 2.5, fvY + 1.98, fvZ + 6.4));
  }
  // 839–840: Mosaic hydrangea planters & distant outer Bà Nà pines (well clear >= 6m!)
  for (const px of [-24, -8, 8, 24]) {
    const py = ctx.getHeight(px, -132.5);
    w4CvAtlas.push(makeReliefBox(1.15, 0.48, 1.15, 'chateauAshlarStone', px, py + 0.28, -132.5));
  }
  for (const [tx, tz] of [[-137, -148], [133, -152], [134, -138]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w4CvAtlas.push(makeReliefCyl(0.18, 0.26, 4.6, 5, 'merbauTimberDeck', tx, ty + 2.1, tz));
    const pine = new THREE.ConeGeometry(2.3, 5.0, 5).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d22);
    w4CvLeaf.push(pine);
  }

  const w4CvAtlasMesh = createMergedMesh('GoldenBridgeWave4Atlas', w4CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w4CvAtlasMesh) group.add(w4CvAtlasMesh);
  const w4CvGoldMesh = createMergedMesh('GoldenBridgeWave4Gold', w4CvGold, brushedGoldMat, false, false);
  if (w4CvGoldMesh) group.add(w4CvGoldMesh);
  const w4CvLeafMesh = createMergedMesh('GoldenBridgeWave4Leaf', w4CvLeaf, foliageMat, false, false);
  if (w4CvLeafMesh) group.add(w4CvLeafMesh);

  // ==========================================================================
  // WAVE 5 UPGRADES (Items 1201–1240): French Village Fountain Square & Stone
  // Arcade, Suối Mơ Cloud Viewing Terrace, Le Jardin d'Amour Botanical Pergola,
  // Luna Castle East Bastion, Golden Bridge, Marseille, Debay & Linh Ứng Details
  // ==========================================================================
  const w5CvAtlas: THREE.BufferGeometry[] = [];
  const w5CvGold: THREE.BufferGeometry[] = [];
  const w5CvLeaf: THREE.BufferGeometry[] = [];

  // 1201–1208: Quảng Trường Đài Phun Nước Làng Pháp (French Village Fountain Square & Stone Arcade at -104, -158)
  const fsX = -104.0;
  const fsZ = -158.0;
  const fsY = Math.max(
    ctx.getHeight(fsX, fsZ),
    ctx.getHeight(fsX - 5.5, fsZ - 4.5),
    ctx.getHeight(fsX + 5.5, fsZ - 4.5),
    ctx.getHeight(fsX - 5.5, fsZ + 4.5),
    ctx.getHeight(fsX + 5.5, fsZ + 4.5)
  );
  w5CvAtlas.push(
    makeReliefBox(11.4, 7.2, 9.4, 'chateauAshlarStone', fsX, fsY - 3.5, fsZ),
    makeReliefBox(11.8, 0.24, 9.8, 'baNaMosaicPaver', fsX, fsY + 0.12, fsZ),
    // 1202: Tiered octagonal limestone fountain basin
    makeReliefCyl(2.1, 2.35, 0.65, 6, 'chateauAshlarStone', fsX, fsY + 0.45, fsZ + 0.6),
    makeReliefCyl(0.52, 0.72, 1.35, 6, 'chateauAshlarStone', fsX, fsY + 1.25, fsZ + 0.6),
    // 1205–1206: North stone arcade portico (4 grounded columns embedded -0.15m + flush slate roof)
    makeReliefBox(8.6, 0.42, 2.2, 'chateauAshlarStone', fsX, fsY + 3.45, fsZ - 3.4),
    makeReliefBox(9.0, 0.95, 2.6, 'slateMansardRoof', fsX, fsY + 4.10, fsZ - 3.4),
    // 1207–1208: Twin Parisian café tables & vintage four-faced street clock pillar
    makeReliefCyl(0.45, 0.45, 0.85, 6, 'merbauTimberDeck', fsX - 3.8, fsY + 0.55, fsZ + 3.2),
    makeReliefCyl(0.45, 0.45, 0.85, 6, 'merbauTimberDeck', fsX + 3.8, fsY + 0.55, fsZ + 3.2),
    makeReliefCyl(0.14, 0.22, 3.3, 6, 'greenSteelPier', fsX + 4.8, fsY + 1.75, fsZ - 0.6)
  );
  for (let fc = -1.5; fc <= 1.5; fc += 1.0) {
    w5CvAtlas.push(makeReliefCyl(0.16, 0.20, 3.45, 6, 'chateauAshlarStone', fsX + fc * 2.4, fsY + 1.70, fsZ - 3.4));
  }
  // 1204: 4 limestone promenade benches ringing fountain
  for (const s of [-1, 1]) {
    w5CvAtlas.push(
      makeReliefBox(2.2, 0.46, 0.52, 'chateauAshlarStone', fsX + s * 3.4, fsY + 0.38, fsZ + 0.6),
      makeReliefBox(2.2, 0.46, 0.52, 'chateauAshlarStone', fsX, fsY + 0.38, fsZ + 0.6 + s * 2.8)
    );
  }
  // 1203 & 1208: Gilded fountain spout finial & clock dial
  w5CvGold.push(
    new THREE.ConeGeometry(0.32, 0.72, 6).translate(fsX, fsY + 2.25, fsZ + 0.6),
    new THREE.CylinderGeometry(0.42, 0.42, 0.28, 6).rotateX(Math.PI * 0.5).translate(fsX + 4.8, fsY + 3.55, fsZ - 0.6)
  );

  // 1209–1215: Đài Vọng Cảnh Suối Mơ (Suối Mơ Cloud Viewing Terrace at -56, -126)
  const smX = -56.0;
  const smZ = -126.0;
  const smY = Math.max(
    ctx.getHeight(smX, smZ),
    ctx.getHeight(smX - 4.5, smZ - 3.5),
    ctx.getHeight(smX + 4.5, smZ + 3.5)
  );
  w5CvAtlas.push(
    makeReliefBox(9.4, 7.6, 7.2, 'chateauAshlarStone', smX, smY - 3.7, smZ),
    makeReliefBox(9.8, 0.26, 7.6, 'merbauTimberDeck', smX, smY + 0.15, smZ),
    // 1211: 4-post timber wind-shelter pavilion with flush slate roof
    makeReliefBox(4.4, 0.22, 3.6, 'slateMansardRoof', smX - 1.8, smY + 3.15, smZ - 1.2),
    makeReliefCyl(0.14, 3.2, 1.35, 4, 'slateMansardRoof', smX - 1.8, smY + 3.85, smZ - 1.2, Math.PI * 0.25),
    // 1212–1214: Telescope pedestal, 2 alpine planters & stepped stone access stair
    makeReliefCyl(0.16, 0.20, 1.15, 6, 'chateauAshlarStone', smX + 2.8, smY + 0.72, smZ + 2.2),
    makeReliefBox(1.6, 0.52, 0.72, 'chateauAshlarStone', smX - 3.2, smY + 0.42, smZ + 2.8),
    makeReliefBox(1.6, 0.52, 0.72, 'chateauAshlarStone', smX + 0.8, smY + 0.42, smZ + 2.8),
    makeReliefBox(2.6, 0.45, 2.2, 'chateauAshlarStone', smX + 5.6, smY - 0.12, smZ - 1.2)
  );
  for (const ox of [-3.6, 0.0]) {
    for (const oz of [-2.7, 0.3]) {
      w5CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 5, 'merbauTimberDeck', smX + ox, smY + 1.58, smZ + oz));
    }
  }
  w5CvGold.push(
    new THREE.BoxGeometry(9.6, 0.10, 0.10).translate(smX, smY + 1.15, smZ + 3.6),
    new THREE.CylinderGeometry(0.08, 0.12, 0.65, 5).rotateZ(Math.PI * 0.45).translate(smX + 2.8, smY + 1.38, smZ + 2.2),
    new THREE.BoxGeometry(0.26, 0.34, 0.26).translate(smX - 4.4, smY + 1.35, smZ + 3.6),
    new THREE.BoxGeometry(0.26, 0.34, 0.26).translate(smX + 4.4, smY + 1.35, smZ + 3.6)
  );

  // 1216–1222: Vườn Địa Đàng (Le Jardin d'Amour Upper Botanical Pergola Terrace at 122, -128)
  const vdX = 122.0;
  const vdZ = -128.0;
  const vdY = Math.max(
    ctx.getHeight(vdX, vdZ),
    ctx.getHeight(vdX - 4.8, vdZ - 3.6),
    ctx.getHeight(vdX + 4.8, vdZ + 3.6)
  );
  w5CvAtlas.push(
    makeReliefBox(9.8, 6.8, 7.6, 'chateauAshlarStone', vdX, vdY - 3.3, vdZ),
    makeReliefBox(10.2, 0.24, 8.0, 'baNaMosaicPaver', vdX, vdY + 0.12, vdZ),
    // 1217: 3-bay wisteria pergola lintel + 6 grounded columns
    makeReliefBox(7.8, 0.26, 2.8, 'merbauTimberDeck', vdX, vdY + 3.18, vdZ - 1.2),
    // 1218, 1220–1222: Sundial plinth, amphora urns, south stone balustrade & garden bench
    makeReliefCyl(0.38, 0.46, 1.05, 6, 'chateauAshlarStone', vdX, vdY + 0.68, vdZ + 1.8),
    makeReliefCyl(0.28, 0.20, 0.78, 6, 'chateauAshlarStone', vdX - 3.8, vdY + 0.55, vdZ + 2.6),
    makeReliefCyl(0.28, 0.20, 0.78, 6, 'chateauAshlarStone', vdX + 3.8, vdY + 0.55, vdZ + 2.6),
    makeReliefBox(9.2, 0.78, 0.34, 'chateauAshlarStone', vdX, vdY + 0.52, vdZ + 3.6),
    makeReliefBox(2.2, 0.46, 0.54, 'chateauAshlarStone', vdX, vdY + 0.38, vdZ - 1.2)
  );
  for (const pxO of [-3.4, 0.0, 3.4]) {
    for (const pzO of [-2.3, -0.1]) {
      w5CvAtlas.push(makeReliefCyl(0.11, 0.13, 3.18, 5, 'chateauAshlarStone', vdX + pxO, vdY + 1.60, vdZ + pzO));
    }
  }
  w5CvGold.push(new THREE.ConeGeometry(0.22, 0.35, 5).translate(vdX, vdY + 1.35, vdZ + 1.8));
  for (const sx of [-4.2, 4.2]) {
    for (const sz of [-3.0, 2.8]) {
      const topiary = new THREE.ConeGeometry(0.58, 1.35, 5).translate(vdX + sx, vdY + 0.85, vdZ + sz);
      colorizeGeo(topiary, 0x2a6a28);
      w5CvLeaf.push(topiary);
    }
  }

  // 1223–1240: Luna Castle east bastion turret & banners, Eclipse Square podium & solar bollards,
  // Cầu Vàng welcome plinths & wind-vanes, Marseille clock gable, Debay cask pyramid, Chùa Linh Ứng incense canopy & outer pines
  w5CvAtlas.push(
    // 1223–1224: Luna Castle eastern bastion turret & flush conical slate spire
    makeReliefCyl(1.25, 1.38, 7.2, 6, 'chateauAshlarStone', lcX + 8.5, lcY + 2.8, lcZ + 4.5),
    makeReliefCyl(0.14, 1.52, 2.8, 6, 'slateMansardRoof', lcX + 8.5, lcY + 7.75, lcZ + 4.5),
    // 1226–1227, 1229–1230: Luna approach curbs, Eclipse podium & directional signpost
    makeReliefBox(0.45, 0.85, 4.2, 'chateauAshlarStone', lcX - 3.6, lcY + 0.55, lcZ + 7.2),
    makeReliefBox(0.45, 0.85, 4.2, 'chateauAshlarStone', lcX + 3.6, lcY + 0.55, lcZ + 7.2),
    makeReliefBox(5.2, 0.42, 3.6, 'merbauTimberDeck', esX + 6.8, esY + 0.32, esZ + 5.8),
    makeReliefCyl(0.10, 0.12, 2.6, 5, 'chateauAshlarStone', esX - 6.8, esY + 1.42, esZ + 5.8),
    // 1231, 1233–1235: Cầu Vàng welcome plinths, Marseille clock pediment & info counter, Debay wine-cask pyramid
    makeReliefBox(1.15, 1.35, 0.52, 'chateauAshlarStone', -72.0, wEndY + 0.72, -142.5),
    makeReliefBox(1.15, 1.35, 0.52, 'chateauAshlarStone', 72.0, ctx.getHeight(72.0, -142.5) + 0.72, -142.5),
    makeReliefBox(2.4, 0.95, 0.85, 'merbauTimberDeck', -76.5, wEndY + 0.58, -145.5),
    makeReliefCyl(0.36, 0.36, 0.82, 6, 'merbauTimberDeck', dbX - 2.6, dbY + 0.52, dbZ + 3.8, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.36, 0.36, 0.82, 6, 'merbauTimberDeck', dbX - 2.6, dbY + 1.18, dbZ + 3.8, 0, 0, Math.PI * 0.5),
    // 1237 & 1239: Chùa Linh Ứng 4-post incense-burner canopy & twin lotus stair pedestals
    makeReliefBox(2.8, 0.22, 2.8, 'slateMansardRoof', luX, luY + 3.10, luZ + 3.4),
    makeReliefCyl(0.12, 2.1, 1.15, 4, 'slateMansardRoof', luX, luY + 3.72, luZ + 3.4, Math.PI * 0.25),
    makeReliefBox(0.75, 0.85, 0.75, 'chateauAshlarStone', luX - 2.6, luY + 0.52, luZ + 9.2),
    makeReliefBox(0.75, 0.85, 0.75, 'chateauAshlarStone', luX + 2.6, luY + 0.52, luZ + 9.2)
  );
  for (const ox of [-1.1, 1.1]) {
    for (const oz of [-1.1, 1.1]) {
      w5CvAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 5, 'merbauTimberDeck', luX + ox, luY + 1.55, luZ + 3.4 + oz));
    }
  }
  w5CvGold.push(
    new THREE.ConeGeometry(0.18, 0.65, 5).translate(lcX + 8.5, lcY + 9.45, lcZ + 4.5),
    new THREE.CylinderGeometry(0.05, 0.06, 3.6, 5).translate(lcX - 3.6, lcY + 2.4, lcZ + 5.6),
    new THREE.CylinderGeometry(0.05, 0.06, 3.6, 5).translate(lcX + 3.6, lcY + 2.4, lcZ + 5.6),
    new THREE.CylinderGeometry(0.45, 0.36, 0.85, 6).translate(luX, luY + 0.58, luZ + 3.4),
    new THREE.ConeGeometry(0.20, 0.55, 5).translate(-28.0, getGoldenBridgeCurveAtX(-28).y + 1.75, getGoldenBridgeCurveAtX(-28).z + 2.75),
    new THREE.ConeGeometry(0.20, 0.55, 5).translate(28.0, getGoldenBridgeCurveAtX(28).y + 1.75, getGoldenBridgeCurveAtX(28).z + 2.75)
  );
  // 1228: 4 Eclipse Square gilded solar-disc bollards
  for (const [bx, bz] of [[-5.5, 4.2], [5.5, 4.2], [-5.5, -4.2], [5.5, -4.2]] as const) {
    w5CvGold.push(new THREE.CylinderGeometry(0.14, 0.18, 0.95, 5).translate(esX + bx, esY + 0.62, esZ + bz));
  }
  // 1240: Distant outer mountain pines (>= 9m clear of Fountain Square & Suối Mơ Terrace!)
  for (const [tx, tz] of [[-116, -166], [-68, -120], [134, -124]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w5CvAtlas.push(makeReliefCyl(0.18, 0.26, 4.8, 5, 'merbauTimberDeck', tx, ty + 2.1, tz));
    const pine = new THREE.ConeGeometry(2.3, 5.0, 5).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d22);
    w5CvLeaf.push(pine);
  }

  const w5CvAtlasMesh = createMergedMesh('GoldenBridgeWave5Atlas', w5CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w5CvAtlasMesh) group.add(w5CvAtlasMesh);
  const w5CvGoldMesh = createMergedMesh('GoldenBridgeWave5Gold', w5CvGold, brushedGoldMat, false, false);
  if (w5CvGoldMesh) group.add(w5CvGoldMesh);
  const w5CvLeafMesh = createMergedMesh('GoldenBridgeWave5Leaf', w5CvLeaf, foliageMat, false, false);
  if (w5CvLeafMesh) group.add(w5CvLeafMesh);

  // ==========================================================================
  // WAVE 6 UPGRADES (Items 1601–1640): French Village Clock-Tower Terrace,
  // Le Jardin d'Amour Floral Archway Tunnel, Luna Castle SW Observatory,
  // Chùa Linh Ứng Bell Pavilion & Bà Nà Micro-Architectural Details
  // ==========================================================================
  const w6CvAtlas: THREE.BufferGeometry[] = [];
  const w6CvGold: THREE.BufferGeometry[] = [];
  const w6CvLeaf: THREE.BufferGeometry[] = [];

  // 1601–1608: Quảng Trường Tháp Đồng Hồ Làng Pháp (Clock-Tower Terrace at -120, -158)
  const ctX = -120.0;
  const ctZ = -158.0;
  const ctY = Math.max(
    ctx.getHeight(ctX, ctZ),
    ctx.getHeight(ctX - 5.2, ctZ - 4.4),
    ctx.getHeight(ctX + 5.2, ctZ + 4.4)
  );
  w6CvAtlas.push(
    makeReliefBox(10.8, 7.6, 9.2, 'chateauAshlarStone', ctX, ctY - 3.7, ctZ),
    makeReliefBox(11.2, 0.24, 9.6, 'baNaMosaicPaver', ctX, ctY + 0.12, ctZ),
    // 1602–1603: 3-tier European limestone clock tower & flush conical slate spire
    makeReliefBox(3.2, 11.2, 3.2, 'chateauAshlarStone', ctX, ctY + 5.65, ctZ - 2.6),
    makeReliefCyl(0.14, 2.35, 3.4, 4, 'slateMansardRoof', ctX, ctY + 12.90, ctZ - 2.6, Math.PI * 0.25),
    // 1605–1608: Corner fountain basin, lamp posts, south balustrade & bistro tables
    makeReliefCyl(1.45, 1.65, 0.58, 5, 'chateauAshlarStone', ctX - 3.2, ctY + 0.42, ctZ + 2.0),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', ctX - 4.4, ctY + 1.65, ctZ + 3.6),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', ctX + 4.4, ctY + 1.65, ctZ + 3.6),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', ctX, ctY + 0.48, ctZ + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', ctX + 2.8, ctY + 0.52, ctZ + 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ctX + 2.8, ctY + 0.36, ctZ + 3.2)
  );
  w6CvGold.push(
    new THREE.ConeGeometry(0.18, 0.68, 4).translate(ctX, ctY + 14.92, ctZ - 2.6),
    new THREE.CylinderGeometry(0.68, 0.68, 0.16, 5).rotateX(Math.PI * 0.5).translate(ctX, ctY + 9.4, ctZ - 0.95),
    new THREE.CylinderGeometry(0.68, 0.68, 0.16, 5).rotateZ(Math.PI * 0.5).translate(ctX + 1.65, ctY + 9.4, ctZ - 2.6),
    new THREE.ConeGeometry(0.24, 0.55, 4).translate(ctX - 3.2, ctY + 1.05, ctZ + 2.0),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(ctX - 4.4, ctY + 3.35, ctZ + 3.6),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(ctX + 4.4, ctY + 3.35, ctZ + 3.6)
  );

  // 1609–1615: Đường Hầm Hoa Le Jardin d'Amour (Floral Archway Tunnel Promenade at 136, -128)
  const ftX = 136.0;
  const ftZ = -128.0;
  const ftY = Math.max(
    ctx.getHeight(ftX, ftZ),
    ctx.getHeight(ftX - 2.6, ftZ - 5.4),
    ctx.getHeight(ftX + 2.6, ftZ + 5.4)
  );
  w6CvAtlas.push(
    makeReliefBox(5.6, 7.2, 11.4, 'chateauAshlarStone', ftX, ftY - 3.5, ftZ),
    makeReliefBox(6.0, 0.24, 11.8, 'baNaMosaicPaver', ftX, ftY + 0.12, ftZ),
    // 1614–1615: Amphora urns & garden bench
    makeReliefCyl(0.26, 0.18, 0.72, 5, 'chateauAshlarStone', ftX - 2.2, ftY + 0.50, ftZ + 5.2),
    makeReliefCyl(0.26, 0.18, 0.72, 5, 'chateauAshlarStone', ftX + 2.2, ftY + 0.50, ftZ + 5.2),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ftX, ftY + 0.38, ftZ)
  );
  for (let bay = 0; bay < 4; bay++) {
    const bz = ftZ - 4.2 + bay * 2.8;
    w6CvAtlas.push(
      makeReliefCyl(0.10, 0.12, 3.15, 4, 'chateauAshlarStone', ftX - 2.1, ftY + 1.58, bz),
      makeReliefCyl(0.10, 0.12, 3.15, 4, 'chateauAshlarStone', ftX + 2.1, ftY + 1.58, bz),
      makeReliefBox(4.6, 0.24, 0.34, 'merbauTimberDeck', ftX, ftY + 3.15, bz)
    );
    const garland = new THREE.BoxGeometry(4.4, 0.42, 0.65).translate(ftX, ftY + 3.45, bz);
    colorizeGeo(garland, bay % 2 === 0 ? 0x2c7830 : 0xc43b7a);
    w6CvLeaf.push(garland);
  }
  w6CvGold.push(new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(ftX, ftY + 1.05, ftZ + 5.4));

  // 1616–1622: Sân Vọng Cảnh Lâu Đài Mặt Trăng (Luna Castle SW Observatory Terrace at lcX - 12.5, lcZ + 12.5)
  const loX = lcX - 12.5;
  const loZ = lcZ + 12.5;
  const loY = Math.max(
    ctx.getHeight(loX, loZ),
    ctx.getHeight(loX - 4.2, loZ - 3.4),
    ctx.getHeight(loX + 4.2, loZ + 3.4)
  );
  w6CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', loX, loY - 3.5, loZ),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', loX, loY + 0.12, loZ),
    // 1617: 4-post medieval observation gazebo with flush slate roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', loX - 1.6, loY + 3.15, loZ - 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', loX - 1.6, loY + 3.92, loZ - 0.8, Math.PI * 0.25),
    // 1618–1622: Armillary plinth, bollards, access stair, rose planters & viewing bench
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', loX + 2.4, loY + 0.65, loZ + 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', loX + 4.8, loY - 0.12, loZ - 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', loX - 3.6, loY + 0.40, loZ + 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', loX + 2.0, loY + 0.38, loZ + 2.4)
  );
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-2.2, 0.6]) {
      w6CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', loX + ox, loY + 1.58, loZ + oz));
    }
  }
  w6CvGold.push(
    new THREE.ConeGeometry(0.34, 0.55, 5).translate(loX + 2.4, loY + 1.42, loZ + 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(loX + 3.6, loY + 0.62, loZ - 2.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(loX + 3.6, loY + 0.62, loZ + 0.2)
  );

  // 1623–1640: Patisserie kiosk, Suối Mơ wind-wall, Eclipse bench/sundial, Cầu Vàng plaques/finials,
  // Ga Marseille trolley/pulley, Debay barrel table, Chùa Linh Ứng Lầu Chuông bell pavilion & outer pines
  w6CvAtlas.push(
    // 1623: Fountain Square west patisserie kiosk (4 grounded posts + flush slate canopy)
    makeReliefBox(2.8, 0.20, 2.4, 'slateMansardRoof', fsX - 6.8, fsY + 2.85, fsZ + 5.8),
    makeReliefBox(2.2, 0.85, 1.25, 'merbauTimberDeck', fsX - 6.8, fsY + 0.55, fsZ + 5.8),
    // 1625–1627: Suối Mơ west stone wind-wall, trail signpost & Eclipse north stone bench
    makeReliefBox(0.42, 1.35, 5.2, 'chateauAshlarStone', smX - 5.2, smY + 0.72, smZ),
    makeReliefCyl(0.08, 0.10, 2.4, 4, 'merbauTimberDeck', smX + 4.8, smY + 1.25, smZ + 2.8),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ - 7.8),
    // 1631–1634: Ga Marseille luggage trolley & pulley plinth; Debay barrel table & vintage archway
    makeReliefBox(1.65, 0.75, 0.95, 'merbauTimberDeck', -79.5, wEndY + 0.52, -148.5),
    makeReliefBox(0.95, 1.05, 0.95, 'chateauAshlarStone', -82.5, wEndY + 0.58, -145.5),
    makeReliefCyl(0.45, 0.45, 0.92, 5, 'merbauTimberDeck', dbX + 4.8, dbY + 0.55, dbZ + 3.2),
    makeReliefBox(0.48, 3.0, 0.48, 'chateauAshlarStone', dbX + 6.4, dbY + 1.55, dbZ + 1.8),
    makeReliefBox(0.48, 3.0, 0.48, 'chateauAshlarStone', dbX + 6.4, dbY + 1.55, dbZ + 4.6),
    makeReliefBox(0.55, 0.38, 3.4, 'chateauAshlarStone', dbX + 6.4, dbY + 3.12, dbZ + 3.2),
    // 1635–1638: Chùa Linh Ứng Lầu Chuông 4-post bell-tower pavilion (luX - 7.5, luZ + 3.4) & dharma pillar
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX - 7.5, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX - 7.5, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX - 7.5, luY + 4.08, luZ + 3.4, Math.PI * 0.25),
    makeReliefBox(0.52, 1.45, 0.52, 'chateauAshlarStone', luX - 11.2, luY + 0.75, luZ + 3.4)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w6CvAtlas.push(
        makeReliefCyl(0.06, 0.08, 2.85, 4, 'merbauTimberDeck', fsX - 6.8 + ox, fsY + 1.45, fsZ + 5.8 + oz),
        makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX - 7.5 + ox, luY + 1.75, luZ + 3.4 + oz)
      );
    }
  }
  w6CvGold.push(
    // 1624, 1628–1630, 1632, 1636–1637: Bakery plaque, Eclipse sundial, Cầu Vàng finials, pulley wheel & Lầu Chuông bell
    new THREE.BoxGeometry(0.65, 0.45, 0.10).translate(fsX - 5.2, fsY + 2.35, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.55, 5).translate(esX, esY + 0.85, esZ - 6.2),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-14.0, getGoldenBridgeCurveAtX(-14).y + 1.72, getGoldenBridgeCurveAtX(-14).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(14.0, getGoldenBridgeCurveAtX(14).y + 1.72, getGoldenBridgeCurveAtX(14).z + 2.75),
    new THREE.CylinderGeometry(0.55, 0.55, 0.16, 5).rotateX(Math.PI * 0.5).translate(-82.5, wEndY + 1.65, -145.5),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX - 7.5, luY + 4.95, luZ + 3.4),
    new THREE.CylinderGeometry(0.32, 0.46, 0.95, 5).translate(luX - 7.5, luY + 2.15, luZ + 3.4)
  );
  // 1639–1640: Vườn Địa Đàng topiary pillars & distant outer Bà Nà highland pines (>= 10m clear!)
  for (const sz of [-1.8, 1.8]) {
    const tp = new THREE.ConeGeometry(0.48, 1.45, 4).translate(vdX + 4.6, vdY + 0.88, vdZ + sz);
    colorizeGeo(tp, 0x2a6a28);
    w6CvLeaf.push(tp);
  }
  for (const [tx, tz] of [[-132, -162], [148, -124], [loX - 11.0, loZ + 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w6CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w6CvLeaf.push(pine);
  }

  const w6CvAtlasMesh = createMergedMesh('GoldenBridgeWave6Atlas', w6CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w6CvAtlasMesh) group.add(w6CvAtlasMesh);
  const w6CvGoldMesh = createMergedMesh('GoldenBridgeWave6Gold', w6CvGold, brushedGoldMat, false, false);
  if (w6CvGoldMesh) group.add(w6CvGoldMesh);
  const w6CvLeafMesh = createMergedMesh('GoldenBridgeWave6Leaf', w6CvLeaf, foliageMat, false, false);
  if (w6CvLeafMesh) group.add(w6CvLeafMesh);

  // ==========================================================================
  // WAVE 7 UPGRADES (Items 2001–2040): St. Denis Bell Tower Terrace, Le Jardin
  // d'Amour Thought & Mythology Pergola, Promise Square East & Lầu Trống
  // ==========================================================================
  const w7CvAtlas: THREE.BufferGeometry[] = [];
  const w7CvGold: THREE.BufferGeometry[] = [];
  const w7CvLeaf: THREE.BufferGeometry[] = [];

  // 2001–2008: Quảng Trường St. Denis & Tháp Chuông Làng Pháp (-124, -140)
  const sdX = -124.0;
  const sdZ = -140.0;
  const sdY = Math.max(
    ctx.getHeight(sdX, sdZ),
    ctx.getHeight(sdX - 5.2, sdZ - 4.4),
    ctx.getHeight(sdX + 5.2, sdZ + 4.4)
  );
  w7CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', sdX, sdY - 3.7, sdZ),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', sdX, sdY + 0.12, sdZ),
    // 2002–2003: St. Denis Gothic bell tower shaft with buttresses & flush slate spire
    makeReliefBox(3.0, 10.8, 3.0, 'chateauAshlarStone', sdX, sdY + 5.45, sdZ - 2.5),
    makeReliefBox(3.4, 7.2, 0.55, 'chateauAshlarStone', sdX, sdY + 3.65, sdZ - 2.5),
    makeReliefCyl(0.14, 2.25, 3.3, 4, 'slateMansardRoof', sdX, sdY + 12.45, sdZ - 2.5, Math.PI * 0.25),
    // 2005–2008: 4-post cobblestone café kiosk, lamp standards, south parapet & bistro tables
    makeReliefBox(2.8, 0.20, 2.4, 'slateMansardRoof', sdX - 3.2, sdY + 2.95, sdZ + 1.8),
    makeReliefBox(2.0, 0.85, 1.10, 'merbauTimberDeck', sdX - 3.2, sdY + 0.55, sdZ + 1.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', sdX - 4.4, sdY + 1.65, sdZ + 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', sdX + 4.4, sdY + 1.65, sdZ + 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', sdX, sdY + 0.48, sdZ + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', sdX + 2.8, sdY + 0.52, sdZ + 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', sdX + 2.8, sdY + 0.36, sdZ + 3.2)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w7CvAtlas.push(makeReliefCyl(0.07, 0.08, 2.95, 4, 'merbauTimberDeck', sdX - 3.2 + ox, sdY + 1.50, sdZ + 1.8 + oz));
    }
  }
  w7CvGold.push(
    new THREE.ConeGeometry(0.18, 0.68, 4).translate(sdX, sdY + 14.42, sdZ - 2.5),
    new THREE.CylinderGeometry(0.32, 0.42, 0.72, 5).translate(sdX, sdY + 9.4, sdZ - 2.5),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(sdX - 4.4, sdY + 3.35, sdZ + 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(sdX + 4.4, sdY + 3.35, sdZ + 3.8)
  );

  // 2009–2016: Vườn Suy Tư & Vườn Thần Thoại Le Jardin d'Amour (136, -146)
  const thGX = 136.0;
  const thGZ = -146.0;
  const thGY = Math.max(
    ctx.getHeight(thGX, thGZ),
    ctx.getHeight(thGX - 2.8, thGZ - 5.4),
    ctx.getHeight(thGX + 2.8, thGZ + 5.4)
  );
  w7CvAtlas.push(
    makeReliefBox(5.8, 7.2, 11.4, 'chateauAshlarStone', thGX, thGY - 3.5, thGZ),
    makeReliefBox(6.2, 0.24, 11.8, 'baNaMosaicPaver', thGX, thGY + 0.12, thGZ),
    // 2014–2016: Greco-Roman pedestal, sunken parterre curbs & contemplation bench
    makeReliefCyl(0.38, 0.46, 1.25, 5, 'chateauAshlarStone', thGX, thGY + 0.72, thGZ - 1.2),
    makeReliefBox(0.55, 0.42, 8.2, 'chateauAshlarStone', thGX - 2.4, thGY + 0.32, thGZ),
    makeReliefBox(0.55, 0.42, 8.2, 'chateauAshlarStone', thGX + 2.4, thGY + 0.32, thGZ),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', thGX, thGY + 0.38, thGZ + 2.4)
  );
  for (let bay = 0; bay < 4; bay++) {
    const bz = thGZ - 4.2 + bay * 2.8;
    w7CvAtlas.push(
      makeReliefCyl(0.10, 0.12, 3.15, 4, 'chateauAshlarStone', thGX - 2.1, thGY + 1.58, bz),
      makeReliefCyl(0.10, 0.12, 3.15, 4, 'chateauAshlarStone', thGX + 2.1, thGY + 1.58, bz),
      makeReliefBox(4.6, 0.24, 0.34, 'merbauTimberDeck', thGX, thGY + 3.15, bz)
    );
    const vine = new THREE.BoxGeometry(4.4, 0.38, 0.60).translate(thGX, thGY + 3.44, bz);
    colorizeGeo(vine, bay % 2 === 0 ? 0x2a7630 : 0x7b4eb8);
    w7CvLeaf.push(vine);
  }
  w7CvGold.push(
    new THREE.ConeGeometry(0.32, 0.65, 5).translate(thGX, thGY + 1.65, thGZ - 1.2),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(thGX, thGY + 1.05, thGZ + 5.4)
  );

  // 2017–2024: Quảng Trường Hứa Hẹn Đông (Promise Square East Balcony at lcX + 14.0, lcZ + 12.5)
  const peX = lcX + 14.0;
  const peZ = lcZ + 12.5;
  const peY = Math.max(
    ctx.getHeight(peX, peZ),
    ctx.getHeight(peX - 4.2, peZ - 3.4),
    ctx.getHeight(peX + 4.2, peZ + 3.4)
  );
  w7CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', peX, peY - 3.5, peZ),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', peX, peY + 0.12, peZ),
    // 2018: 4-post medieval observation turret with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', peX + 1.6, peY + 3.15, peZ - 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', peX + 1.6, peY + 3.92, peZ - 0.8, Math.PI * 0.25),
    // 2019–2024: Compass plinth, access stair, rose troughs, viewing bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', peX - 2.4, peY + 0.65, peZ + 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', peX - 4.8, peY - 0.12, peZ - 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', peX + 3.6, peY + 0.40, peZ + 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', peX - 2.0, peY + 0.38, peZ + 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', peX + 3.8, peY + 1.60, peZ - 2.6)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-2.2, 0.6]) {
      w7CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', peX + ox, peY + 1.58, peZ + oz));
    }
  }
  w7CvGold.push(
    new THREE.ConeGeometry(0.34, 0.55, 5).translate(peX - 2.4, peY + 1.42, peZ + 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(peX - 3.6, peY + 0.62, peZ - 2.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(peX - 3.6, peY + 0.62, peZ + 0.2),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(peX + 3.8, peY + 3.22, peZ - 2.6)
  );

  // 2025–2040: Busker stage, Suối Mơ floral steps, Eclipse south bench/obelisk, Cầu Vàng outer lamps,
  // Ga Marseille clock-post/rack, Debay cellar lantern/casks, Chùa Linh Ứng Lầu Trống & outer pines
  w7CvAtlas.push(
    makeReliefBox(3.4, 0.45, 2.8, 'merbauTimberDeck', fsX + 6.8, fsY + 0.25, fsZ + 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX + 8.4, fsY + 1.50, fsZ + 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX + 5.2, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ + 7.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -78.5, wEndY + 1.60, -144.5),
    makeReliefBox(1.85, 0.85, 0.85, 'merbauTimberDeck', -76.5, wEndY + 0.52, -148.5),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX + 4.8, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX + 6.2, dbY + 0.52, dbZ - 2.6),
    // 2037–2038: Chùa Linh Ứng Lầu Trống 4-post drum pavilion (luX + 7.5, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX + 7.5, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX + 7.5, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX + 7.5, luY + 4.08, luZ + 3.4, Math.PI * 0.25),
    makeReliefCyl(0.45, 0.45, 0.78, 5, 'merbauTimberDeck', luX + 7.5, luY + 1.45, luZ + 3.4, 0, 0, Math.PI * 0.5)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w7CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX + 7.5 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w7CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX + 8.4, fsY + 3.08, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ + 6.2),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-26.0, getGoldenBridgeCurveAtX(-26).y + 1.72, getGoldenBridgeCurveAtX(-26).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(26.0, getGoldenBridgeCurveAtX(26).y + 1.72, getGoldenBridgeCurveAtX(26).z + 2.75),
    new THREE.CylinderGeometry(0.36, 0.36, 0.14, 5).rotateX(Math.PI * 0.5).translate(-78.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX + 4.8, dbY + 1.88, dbZ - 2.6),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX + 7.5, luY + 4.95, luZ + 3.4)
  );
  // 2039–2040: Vườn Địa Đàng boxwood curbs & distant outer Bà Nà highland pines (>= 10m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX - 4.6, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w7CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-136, -138], [148, -148], [peX + 11.0, peZ + 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w7CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w7CvLeaf.push(pine);
  }

  const w7CvAtlasMesh = createMergedMesh('GoldenBridgeWave7Atlas', w7CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w7CvAtlasMesh) group.add(w7CvAtlasMesh);
  const w7CvGoldMesh = createMergedMesh('GoldenBridgeWave7Gold', w7CvGold, brushedGoldMat, false, false);
  if (w7CvGoldMesh) group.add(w7CvGoldMesh);
  const w7CvLeafMesh = createMergedMesh('GoldenBridgeWave7Leaf', w7CvLeaf, foliageMat, false, false);
  if (w7CvLeafMesh) group.add(w7CvLeafMesh);

  // ==========================================================================
  // WAVE 8 UPGRADES (Items 2401–2440): Convergence Square & Cross Fountain,
  // Le Jardin d'Amour Mystery Maze Garden, Sun God West Balcony & Lầu Chuông
  // ==========================================================================
  const w8CvAtlas: THREE.BufferGeometry[] = [];
  const w8CvGold: THREE.BufferGeometry[] = [];
  const w8CvLeaf: THREE.BufferGeometry[] = [];

  // 2401–2408: Quảng Trường Hội Tụ & Đài Phun Nước Chữ Thập Làng Pháp (-114, -156)
  const cv8X = -114.0;
  const cv8Z = -156.0;
  const cv8Y = Math.max(
    ctx.getHeight(cv8X, cv8Z),
    ctx.getHeight(cv8X - 5.2, cv8Z - 4.4),
    ctx.getHeight(cv8X + 5.2, cv8Z + 4.4)
  );
  w8CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', cv8X, cv8Y - 3.7, cv8Z),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', cv8X, cv8Y + 0.12, cv8Z),
    // 2402: Stepped classical ashlar fountain basin & central column
    makeReliefCyl(2.2, 2.5, 0.65, 5, 'chateauAshlarStone', cv8X, cv8Y + 0.45, cv8Z - 1.2),
    makeReliefCyl(0.45, 0.65, 2.2, 5, 'chateauAshlarStone', cv8X, cv8Y + 1.55, cv8Z - 1.2),
    // 2404–2408: 4-post pastry-and-wine kiosk, lamp standards, south parapet, bistro table & bench
    makeReliefBox(2.8, 0.20, 2.4, 'slateMansardRoof', cv8X - 3.4, cv8Y + 2.95, cv8Z + 1.8),
    makeReliefBox(2.0, 0.85, 1.10, 'merbauTimberDeck', cv8X - 3.4, cv8Y + 0.55, cv8Z + 1.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', cv8X - 4.4, cv8Y + 1.65, cv8Z + 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', cv8X + 4.4, cv8Y + 1.65, cv8Z + 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', cv8X, cv8Y + 0.48, cv8Z + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', cv8X + 3.0, cv8Y + 0.52, cv8Z + 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', cv8X + 3.0, cv8Y + 0.36, cv8Z + 3.2)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w8CvAtlas.push(makeReliefCyl(0.07, 0.08, 2.95, 4, 'merbauTimberDeck', cv8X - 3.4 + ox, cv8Y + 1.50, cv8Z + 1.8 + oz));
    }
  }
  w8CvGold.push(
    new THREE.ConeGeometry(0.28, 0.72, 4).translate(cv8X, cv8Y + 2.98, cv8Z - 1.2),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(cv8X - 4.4, cv8Y + 3.35, cv8Z + 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(cv8X + 4.4, cv8Y + 3.35, cv8Z + 3.8)
  );

  // 2409–2416: Vườn Bí Ẩn & Vườn Ký Ức Le Jardin d'Amour (148, -134)
  const mg8X = 148.0;
  const mg8Z = -134.0;
  const mg8Y = Math.max(
    ctx.getHeight(mg8X, mg8Z),
    ctx.getHeight(mg8X - 4.2, mg8Z - 4.6),
    ctx.getHeight(mg8X + 4.2, mg8Z + 4.6)
  );
  w8CvAtlas.push(
    makeReliefBox(8.6, 7.2, 9.6, 'chateauAshlarStone', mg8X, mg8Y - 3.5, mg8Z),
    makeReliefBox(9.0, 0.24, 10.0, 'baNaMosaicPaver', mg8X, mg8Y + 0.12, mg8Z),
    // 2414–2416: 4-post limestone romantic gazebo, parterre curbs & bench
    makeReliefBox(3.4, 0.20, 3.4, 'slateMansardRoof', mg8X, mg8Y + 3.15, mg8Z),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', mg8X, mg8Y + 3.88, mg8Z, Math.PI * 0.25),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', mg8X - 3.4, mg8Y + 0.32, mg8Z),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', mg8X + 3.4, mg8Y + 0.32, mg8Z),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', mg8X, mg8Y + 0.38, mg8Z + 3.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      w8CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'chateauAshlarStone', mg8X + ox, mg8Y + 1.58, mg8Z + oz));
    }
  }
  for (const [hx, hz, hw, hd] of [
    [-2.4, -3.6, 2.8, 0.65], [2.4, -3.6, 2.8, 0.65],
    [-2.4, 3.6, 2.8, 0.65], [2.4, 3.6, 2.8, 0.65]
  ] as const) {
    const hedge = new THREE.BoxGeometry(hw, 1.35, hd).translate(mg8X + hx, mg8Y + 0.78, mg8Z + hz);
    colorizeGeo(hedge, 0x266c2c);
    w8CvLeaf.push(hedge);
  }
  w8CvGold.push(
    new THREE.ConeGeometry(0.22, 0.54, 4).translate(mg8X, mg8Y + 4.78, mg8Z),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(mg8X, mg8Y + 1.05, mg8Z + 4.6)
  );

  // 2417–2424: Đài Vọng Cảnh Thác Thần Mặt Trời Tây (Sun God West Balcony at lcX - 15.0, lcZ + 14.0)
  const sg8X = lcX - 15.0;
  const sg8Z = lcZ + 14.0;
  const sg8Y = Math.max(
    ctx.getHeight(sg8X, sg8Z),
    ctx.getHeight(sg8X - 4.2, sg8Z - 3.4),
    ctx.getHeight(sg8X + 4.2, sg8Z + 3.4)
  );
  w8CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', sg8X, sg8Y - 3.5, sg8Z),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', sg8X, sg8Y + 0.12, sg8Z),
    // 2418: 4-post medieval belvedere with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', sg8X - 1.6, sg8Y + 3.15, sg8Z - 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', sg8X - 1.6, sg8Y + 3.92, sg8Z - 0.8, Math.PI * 0.25),
    // 2419–2424: Sunburst plinth, access stair, hydrangea trough, bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', sg8X + 2.4, sg8Y + 0.65, sg8Z + 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', sg8X + 4.8, sg8Y - 0.12, sg8Z - 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', sg8X - 3.6, sg8Y + 0.40, sg8Z + 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', sg8X + 2.0, sg8Y + 0.38, sg8Z + 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', sg8X - 3.8, sg8Y + 1.60, sg8Z - 2.6)
  );
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-2.2, 0.6]) {
      w8CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', sg8X + ox, sg8Y + 1.58, sg8Z + oz));
    }
  }
  w8CvGold.push(
    new THREE.ConeGeometry(0.36, 0.62, 5).translate(sg8X + 2.4, sg8Y + 1.45, sg8Z + 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(sg8X + 3.6, sg8Y + 0.62, sg8Z - 2.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(sg8X + 3.6, sg8Y + 0.62, sg8Z + 0.2),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(sg8X - 3.8, sg8Y + 3.22, sg8Z - 2.6)
  );

  // 2425–2440: Flower-cart stall, Suối Mơ west steps, Eclipse north bench/astrolabe, Cầu Vàng inner lamps,
  // Ga Marseille timetable, Debay west lantern/barrel, Chùa Linh Ứng Lầu Chuông & outer pines
  w8CvAtlas.push(
    makeReliefBox(2.8, 0.72, 1.65, 'merbauTimberDeck', fsX - 7.2, fsY + 0.42, fsZ + 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX - 8.6, fsY + 1.50, fsZ + 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX - 5.6, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ - 7.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -72.5, wEndY + 1.60, -144.5),
    makeReliefBox(2.0, 0.46, 0.56, 'merbauTimberDeck', -72.5, wEndY + 0.36, -148.0),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX - 5.2, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX - 6.6, dbY + 0.52, dbZ - 2.6),
    // 2437–2438: Chùa Linh Ứng Lầu Chuông 4-post bell pavilion (luX - 7.5, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX - 7.5, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX - 7.5, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX - 7.5, luY + 4.08, luZ + 3.4, Math.PI * 0.25)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w8CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX - 7.5 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w8CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX - 8.6, fsY + 3.08, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ - 6.2),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-14.0, getGoldenBridgeCurveAtX(-14).y + 1.72, getGoldenBridgeCurveAtX(-14).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(14.0, getGoldenBridgeCurveAtX(14).y + 1.72, getGoldenBridgeCurveAtX(14).z + 2.75),
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5).rotateX(Math.PI * 0.5).translate(-72.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX - 5.2, dbY + 1.88, dbZ - 2.6),
    new THREE.CylinderGeometry(0.32, 0.44, 0.85, 5).translate(luX - 7.5, luY + 1.65, luZ + 3.4),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX - 7.5, luY + 4.95, luZ + 3.4)
  );
  // 2439–2440: Vườn Địa Đàng east boxwood curbs & distant outer Bà Nà highland pines (>= 10m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX + 4.6, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w8CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-128, -168], [160, -134], [sg8X - 11.0, sg8Z + 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w8CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w8CvLeaf.push(pine);
  }

  const w8CvAtlasMesh = createMergedMesh('GoldenBridgeWave8Atlas', w8CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w8CvAtlasMesh) group.add(w8CvAtlasMesh);
  const w8CvGoldMesh = createMergedMesh('GoldenBridgeWave8Gold', w8CvGold, brushedGoldMat, false, false);
  if (w8CvGoldMesh) group.add(w8CvGoldMesh);
  const w8CvLeafMesh = createMergedMesh('GoldenBridgeWave8Leaf', w8CvLeaf, foliageMat, false, false);
  if (w8CvLeafMesh) group.add(w8CvLeafMesh);

  // ==========================================================================
  // WAVE 9 UPGRADES (Items 2801–2840): Du Dôme Square & Alpine Bandstand,
  // Le Jardin d'Amour Vineyard Pergola, Sun God East Balcony & Lầu Trống
  // ==========================================================================
  const w9CvAtlas: THREE.BufferGeometry[] = [];
  const w9CvGold: THREE.BufferGeometry[] = [];
  const w9CvLeaf: THREE.BufferGeometry[] = [];

  // 2801–2808: Quảng Trường Du Dôme & Sân Khấu Nhạc Làng Pháp (-126, -142)
  const dd9X = -126.0;
  const dd9Z = -142.0;
  const dd9Y = Math.max(
    ctx.getHeight(dd9X, dd9Z),
    ctx.getHeight(dd9X - 5.2, dd9Z - 4.4),
    ctx.getHeight(dd9X + 5.2, dd9Z + 4.4)
  );
  w9CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', dd9X, dd9Y - 3.7, dd9Z),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', dd9X, dd9Y + 0.12, dd9Z),
    // 2802, 2804: Stepped ashlar bandstand podium, lectern & 4-post slate bandstand canopy
    makeReliefCyl(2.2, 2.5, 0.55, 5, 'chateauAshlarStone', dd9X, dd9Y + 0.40, dd9Z - 1.2),
    makeReliefCyl(0.32, 0.42, 1.15, 5, 'chateauAshlarStone', dd9X, dd9Y + 1.15, dd9Z - 1.2),
    makeReliefBox(3.4, 0.20, 3.0, 'slateMansardRoof', dd9X, dd9Y + 3.45, dd9Z - 1.2),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', dd9X, dd9Y + 4.18, dd9Z - 1.2, Math.PI * 0.25),
    // 2805–2808: Twin lamp standards, south valley parapet, wine-barrel café table & stone bench
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', dd9X - 4.4, dd9Y + 1.65, dd9Z + 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', dd9X + 4.4, dd9Y + 1.65, dd9Z + 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', dd9X, dd9Y + 0.48, dd9Z + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', dd9X + 3.0, dd9Y + 0.52, dd9Z + 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', dd9X - 3.0, dd9Y + 0.36, dd9Z + 2.4)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.2, 1.2]) {
      w9CvAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'merbauTimberDeck', dd9X + ox, dd9Y + 2.00, dd9Z - 1.2 + oz));
    }
  }
  w9CvGold.push(
    new THREE.ConeGeometry(0.26, 0.68, 4).translate(dd9X, dd9Y + 5.10, dd9Z - 1.2),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(dd9X - 4.4, dd9Y + 3.35, dd9Z + 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(dd9X + 4.4, dd9Y + 3.35, dd9Z + 3.8)
  );

  // 2809–2816: Vườn Suối Mơ & Vườn Nho Le Jardin d'Amour (164, -118)
  const vn9X = 164.0;
  const vn9Z = -118.0;
  const vn9Y = Math.max(
    ctx.getHeight(vn9X, vn9Z),
    ctx.getHeight(vn9X - 4.2, vn9Z - 4.6),
    ctx.getHeight(vn9X + 4.2, vn9Z + 4.6)
  );
  w9CvAtlas.push(
    makeReliefBox(8.6, 7.2, 9.6, 'chateauAshlarStone', vn9X, vn9Y - 3.5, vn9Z),
    makeReliefBox(9.0, 0.24, 10.0, 'baNaMosaicPaver', vn9X, vn9Y + 0.12, vn9Z),
    // 2814–2816: 4-post limestone vineyard pergola, parterre curbs & bench
    makeReliefBox(3.4, 0.20, 3.4, 'slateMansardRoof', vn9X, vn9Y + 3.15, vn9Z),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', vn9X, vn9Y + 3.88, vn9Z, Math.PI * 0.25),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', vn9X - 3.4, vn9Y + 0.32, vn9Z),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', vn9X + 3.4, vn9Y + 0.32, vn9Z),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', vn9X, vn9Y + 0.38, vn9Z + 3.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      w9CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'chateauAshlarStone', vn9X + ox, vn9Y + 1.58, vn9Z + oz));
    }
  }
  for (const [hx, hz, hw, hd] of [
    [-2.4, -3.6, 2.8, 0.65], [2.4, -3.6, 2.8, 0.65],
    [-2.4, 3.6, 2.8, 0.65], [2.4, 3.6, 2.8, 0.65]
  ] as const) {
    const hedge = new THREE.BoxGeometry(hw, 1.35, hd).translate(vn9X + hx, vn9Y + 0.78, vn9Z + hz);
    colorizeGeo(hedge, 0x266c2c);
    w9CvLeaf.push(hedge);
  }
  w9CvGold.push(
    new THREE.ConeGeometry(0.22, 0.54, 4).translate(vn9X, vn9Y + 4.78, vn9Z),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(vn9X, vn9Y + 1.05, vn9Z + 4.6)
  );

  // 2817–2824: Đài Vọng Cảnh Thác Thần Mặt Trời Đông (Sun God East Balcony at lcX + 16.0, lcZ + 14.0)
  const se9X = lcX + 16.0;
  const se9Z = lcZ + 14.0;
  const se9Y = Math.max(
    ctx.getHeight(se9X, se9Z),
    ctx.getHeight(se9X - 4.2, se9Z - 3.4),
    ctx.getHeight(se9X + 4.2, se9Z + 3.4)
  );
  w9CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', se9X, se9Y - 3.5, se9Z),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', se9X, se9Y + 0.12, se9Z),
    // 2818: 4-post medieval belvedere with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', se9X + 1.6, se9Y + 3.15, se9Z - 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', se9X + 1.6, se9Y + 3.92, se9Z - 0.8, Math.PI * 0.25),
    // 2819–2824: Solar-chariot plinth, access stair, hydrangea trough, bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', se9X - 2.4, se9Y + 0.65, se9Z + 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', se9X - 4.8, se9Y - 0.12, se9Z - 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', se9X + 3.6, se9Y + 0.40, se9Z + 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', se9X - 2.0, se9Y + 0.38, se9Z + 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', se9X + 3.8, se9Y + 1.60, se9Z - 2.6)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-2.2, 0.6]) {
      w9CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', se9X + ox, se9Y + 1.58, se9Z + oz));
    }
  }
  w9CvGold.push(
    new THREE.ConeGeometry(0.36, 0.62, 5).translate(se9X - 2.4, se9Y + 1.45, se9Z + 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(se9X - 3.6, se9Y + 0.62, se9Z - 2.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(se9X - 3.6, se9Y + 0.62, se9Z + 0.2),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(se9X + 3.8, se9Y + 3.22, se9Z - 2.6)
  );

  // 2825–2840: Crêpe cart, Suối Mơ east steps, Eclipse south bench/sundial, Cầu Vàng outer lamps,
  // Ga Marseille west timetable, Debay east lantern/barrel, Chùa Linh Ứng Lầu Trống & outer pines
  w9CvAtlas.push(
    makeReliefBox(2.8, 0.72, 1.65, 'merbauTimberDeck', fsX + 7.2, fsY + 0.42, fsZ + 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX + 8.6, fsY + 1.50, fsZ + 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX + 5.6, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ + 7.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -84.5, wEndY + 1.60, -144.5),
    makeReliefBox(2.0, 0.46, 0.56, 'merbauTimberDeck', -84.5, wEndY + 0.36, -148.0),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX + 5.2, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX + 6.6, dbY + 0.52, dbZ - 2.6),
    // 2837–2838: Chùa Linh Ứng Lầu Trống 4-post drum pavilion (luX + 7.5, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX + 7.5, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX + 7.5, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX + 7.5, luY + 4.08, luZ + 3.4, Math.PI * 0.25)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w9CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX + 7.5 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w9CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX + 8.6, fsY + 3.08, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ + 6.2),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-26.0, getGoldenBridgeCurveAtX(-26).y + 1.72, getGoldenBridgeCurveAtX(-26).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(26.0, getGoldenBridgeCurveAtX(26).y + 1.72, getGoldenBridgeCurveAtX(26).z + 2.75),
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5).rotateX(Math.PI * 0.5).translate(-84.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX + 5.2, dbY + 1.88, dbZ - 2.6),
    new THREE.CylinderGeometry(0.42, 0.42, 0.65, 5).rotateZ(Math.PI * 0.5).translate(luX + 7.5, luY + 1.75, luZ + 3.4),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX + 7.5, luY + 4.95, luZ + 3.4)
  );
  // 2839–2840: Vườn Địa Đàng west boxwood curbs & distant outer Bà Nà highland pines (>= 11m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX - 4.6, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w9CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-140, -142], [178, -118], [se9X + 11.5, se9Z + 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w9CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w9CvLeaf.push(pine);
  }

  const w9CvAtlasMesh = createMergedMesh('GoldenBridgeWave9Atlas', w9CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w9CvAtlasMesh) group.add(w9CvAtlasMesh);
  const w9CvGoldMesh = createMergedMesh('GoldenBridgeWave9Gold', w9CvGold, brushedGoldMat, false, false);
  if (w9CvGoldMesh) group.add(w9CvGoldMesh);
  const w9CvLeafMesh = createMergedMesh('GoldenBridgeWave9Leaf', w9CvLeaf, foliageMat, false, false);
  if (w9CvLeafMesh) group.add(w9CvLeafMesh);

  // ==========================================================================
  // WAVE 10 UPGRADES (Items 3201–3240): West Rose & Sunflower Fountain Square,
  // St. Denis East Cloister & Hydrangea Terrace, Lunar Castle South Belvedere & Lầu Chuông Tây
  // ==========================================================================
  const w10CvAtlas: THREE.BufferGeometry[] = [];
  const w10CvGold: THREE.BufferGeometry[] = [];
  const w10CvLeaf: THREE.BufferGeometry[] = [];

  // 3201–3208: Vườn Hoa Tình Yêu Tây — Đài Phun Nước Nhật Nguyệt (-142, -124)
  const rf10X = -142.0;
  const rf10Z = -124.0;
  const rf10Y = Math.max(
    ctx.getHeight(rf10X, rf10Z),
    ctx.getHeight(rf10X - 5.2, rf10Z - 4.4),
    ctx.getHeight(rf10X + 5.2, rf10Z + 4.4)
  );
  w10CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', rf10X, rf10Y - 3.7, rf10Z),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', rf10X, rf10Y + 0.12, rf10Z),
    // 3202, 3204: Stepped ashlar fountain basin, pedestal column & 4-post slate rose-garden gazebo
    makeReliefCyl(2.2, 2.5, 0.55, 5, 'chateauAshlarStone', rf10X, rf10Y + 0.40, rf10Z - 1.2),
    makeReliefCyl(0.32, 0.42, 1.15, 5, 'chateauAshlarStone', rf10X, rf10Y + 1.15, rf10Z - 1.2),
    makeReliefBox(3.4, 0.20, 3.0, 'slateMansardRoof', rf10X, rf10Y + 3.45, rf10Z - 1.2),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', rf10X, rf10Y + 4.18, rf10Z - 1.2, Math.PI * 0.25),
    // 3205–3208: Twin lamp standards, west valley parapet, oak bistro table & stone bench
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', rf10X - 4.4, rf10Y + 1.65, rf10Z + 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', rf10X + 4.4, rf10Y + 1.65, rf10Z + 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', rf10X, rf10Y + 0.48, rf10Z + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', rf10X + 3.0, rf10Y + 0.52, rf10Z + 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', rf10X - 3.0, rf10Y + 0.36, rf10Z + 2.4)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.2, 1.2]) {
      w10CvAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'merbauTimberDeck', rf10X + ox, rf10Y + 2.00, rf10Z - 1.2 + oz));
    }
  }
  w10CvGold.push(
    new THREE.ConeGeometry(0.26, 0.68, 4).translate(rf10X, rf10Y + 5.10, rf10Z - 1.2),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(rf10X - 4.4, rf10Y + 3.35, rf10Z + 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(rf10X + 4.4, rf10Y + 3.35, rf10Z + 3.8)
  );

  // 3209–3216: Quảng Trường St. Denis Đông & Vườn Cẩm Tú Cầu (178, -102)
  const sd10X = 178.0;
  const sd10Z = -102.0;
  const sd10Y = Math.max(
    ctx.getHeight(sd10X, sd10Z),
    ctx.getHeight(sd10X - 4.2, sd10Z - 4.6),
    ctx.getHeight(sd10X + 4.2, sd10Z + 4.6)
  );
  w10CvAtlas.push(
    makeReliefBox(8.6, 7.2, 9.6, 'chateauAshlarStone', sd10X, sd10Y - 3.5, sd10Z),
    makeReliefBox(9.0, 0.24, 10.0, 'baNaMosaicPaver', sd10X, sd10Y + 0.12, sd10Z),
    // 3214–3216: 4-post Gothic limestone cloister pavilion, parterre curbs & bench
    makeReliefBox(3.4, 0.20, 3.4, 'slateMansardRoof', sd10X, sd10Y + 3.15, sd10Z),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', sd10X, sd10Y + 3.88, sd10Z, Math.PI * 0.25),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd10X - 3.4, sd10Y + 0.32, sd10Z),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd10X + 3.4, sd10Y + 0.32, sd10Z),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', sd10X, sd10Y + 0.38, sd10Z + 3.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      w10CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'chateauAshlarStone', sd10X + ox, sd10Y + 1.58, sd10Z + oz));
    }
  }
  for (const [hx, hz, hw, hd] of [
    [-2.4, -3.6, 2.8, 0.65], [2.4, -3.6, 2.8, 0.65],
    [-2.4, 3.6, 2.8, 0.65], [2.4, 3.6, 2.8, 0.65]
  ] as const) {
    const hedge = new THREE.BoxGeometry(hw, 1.35, hd).translate(sd10X + hx, sd10Y + 0.78, sd10Z + hz);
    colorizeGeo(hedge, 0x2a7030);
    w10CvLeaf.push(hedge);
  }
  w10CvGold.push(
    new THREE.ConeGeometry(0.22, 0.54, 4).translate(sd10X, sd10Y + 4.78, sd10Z),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(sd10X, sd10Y + 1.05, sd10Z + 4.6)
  );

  // 3217–3224: Đài Vọng Cảnh Lâu Đài Mặt Trăng Nam (Lunar Castle South Belvedere at lcX + 28.0, lcZ + 22.0)
  const ls10X = lcX + 28.0;
  const ls10Z = lcZ + 22.0;
  const ls10Y = Math.max(
    ctx.getHeight(ls10X, ls10Z),
    ctx.getHeight(ls10X - 4.2, ls10Z - 3.4),
    ctx.getHeight(ls10X + 4.2, ls10Z + 3.4)
  );
  w10CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', ls10X, ls10Y - 3.5, ls10Z),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', ls10X, ls10Y + 0.12, ls10Z),
    // 3218: 4-post alpine timber-and-slate belvedere with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', ls10X + 1.6, ls10Y + 3.15, ls10Z - 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', ls10X + 1.6, ls10Y + 3.92, ls10Z - 0.8, Math.PI * 0.25),
    // 3219–3224: Crescent-moon plinth, access stair, hydrangea trough, bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', ls10X - 2.4, ls10Y + 0.65, ls10Z + 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', ls10X - 4.8, ls10Y - 0.12, ls10Z - 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', ls10X + 3.6, ls10Y + 0.40, ls10Z + 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ls10X - 2.0, ls10Y + 0.38, ls10Z + 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', ls10X + 3.8, ls10Y + 1.60, ls10Z - 2.6)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-2.2, 0.6]) {
      w10CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', ls10X + ox, ls10Y + 1.58, ls10Z + oz));
    }
  }
  w10CvGold.push(
    new THREE.ConeGeometry(0.36, 0.62, 5).translate(ls10X - 2.4, ls10Y + 1.45, ls10Z + 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ls10X - 3.6, ls10Y + 0.62, ls10Z - 2.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ls10X - 3.6, ls10Y + 0.62, ls10Z + 0.2),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ls10X + 3.8, ls10Y + 3.22, ls10Z - 2.6)
  );

  // 3225–3240: Patisserie cart, Suối Mơ west steps, Eclipse north bench/armillary, Cầu Vàng far-outer lamps,
  // Ga Marseille east clock, Debay west lantern/barrel, Chùa Linh Ứng Lầu Chuông Tây & outer pines
  w10CvAtlas.push(
    makeReliefBox(2.8, 0.72, 1.65, 'merbauTimberDeck', fsX - 7.8, fsY + 0.42, fsZ + 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX - 9.2, fsY + 1.50, fsZ + 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX - 5.8, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ - 8.2),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -72.5, wEndY + 1.60, -144.5),
    makeReliefBox(2.0, 0.46, 0.56, 'merbauTimberDeck', -72.5, wEndY + 0.36, -148.0),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX - 5.4, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX - 6.8, dbY + 0.52, dbZ - 2.6),
    // 3237–3238: Chùa Linh Ứng Lầu Chuông Tây 4-post bell pavilion (luX - 7.8, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX - 7.8, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX - 7.8, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX - 7.8, luY + 4.08, luZ + 3.4, Math.PI * 0.25)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w10CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX - 7.8 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w10CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX - 9.2, fsY + 3.08, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ - 6.6),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-34.0, getGoldenBridgeCurveAtX(-34).y + 1.72, getGoldenBridgeCurveAtX(-34).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(34.0, getGoldenBridgeCurveAtX(34).y + 1.72, getGoldenBridgeCurveAtX(34).z + 2.75),
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5).rotateX(Math.PI * 0.5).translate(-72.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX - 5.4, dbY + 1.88, dbZ - 2.6),
    new THREE.CylinderGeometry(0.36, 0.48, 0.72, 5).translate(luX - 7.8, luY + 1.85, luZ + 3.4),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX - 7.8, luY + 4.95, luZ + 3.4)
  );
  // 3239–3240: Vườn Địa Đàng east boxwood curbs & distant outer Bà Nà highland pines (>= 12m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX + 4.8, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w10CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-156, -124], [192, -102], [ls10X + 12.0, ls10Z + 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w10CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w10CvLeaf.push(pine);
  }

  const w10CvAtlasMesh = createMergedMesh('GoldenBridgeWave10Atlas', w10CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w10CvAtlasMesh) group.add(w10CvAtlasMesh);
  const w10CvGoldMesh = createMergedMesh('GoldenBridgeWave10Gold', w10CvGold, brushedGoldMat, false, false);
  if (w10CvGoldMesh) group.add(w10CvGoldMesh);
  const w10CvLeafMesh = createMergedMesh('GoldenBridgeWave10Leaf', w10CvLeaf, foliageMat, false, false);
  if (w10CvLeafMesh) group.add(w10CvLeafMesh);

  // ==========================================================================
  // WAVE 11 UPGRADES (Items 3601–3640): NW Mystery Labyrinth & Sundial Garden,
  // St. Denis South Lavender Terrace, Lunar Castle North Observatory & Lầu Trống Đông
  // ==========================================================================
  const w11CvAtlas: THREE.BufferGeometry[] = [];
  const w11CvGold: THREE.BufferGeometry[] = [];
  const w11CvLeaf: THREE.BufferGeometry[] = [];

  // 3601–3608: Vườn Hoa Tình Yêu Tây Bắc — Vườn Mê Cung & Đài Thiên Văn (-142, -148)
  const ml11X = -142.0;
  const ml11Z = -148.0;
  const ml11Y = Math.max(
    ctx.getHeight(ml11X, ml11Z),
    ctx.getHeight(ml11X - 5.2, ml11Z - 4.4),
    ctx.getHeight(ml11X + 5.2, ml11Z + 4.4)
  );
  w11CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', ml11X, ml11Y - 3.7, ml11Z),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', ml11X, ml11Y + 0.12, ml11Z),
    // 3602, 3604: Stepped ashlar sundial plinth, pedestal column & 4-post slate labyrinth belvedere
    makeReliefCyl(2.2, 2.5, 0.55, 5, 'chateauAshlarStone', ml11X, ml11Y + 0.40, ml11Z - 1.2),
    makeReliefCyl(0.32, 0.42, 1.15, 5, 'chateauAshlarStone', ml11X, ml11Y + 1.15, ml11Z - 1.2),
    makeReliefBox(3.4, 0.20, 3.0, 'slateMansardRoof', ml11X, ml11Y + 3.45, ml11Z - 1.2),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', ml11X, ml11Y + 4.18, ml11Z - 1.2, Math.PI * 0.25),
    // 3605–3608: Twin lamp standards, north valley parapet, wine-barrel table & stone bench
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', ml11X - 4.4, ml11Y + 1.65, ml11Z - 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', ml11X + 4.4, ml11Y + 1.65, ml11Z - 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', ml11X, ml11Y + 0.48, ml11Z - 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', ml11X + 3.0, ml11Y + 0.52, ml11Z + 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ml11X - 3.0, ml11Y + 0.36, ml11Z + 2.4)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.2, 1.2]) {
      w11CvAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'merbauTimberDeck', ml11X + ox, ml11Y + 2.00, ml11Z - 1.2 + oz));
    }
  }
  w11CvGold.push(
    new THREE.ConeGeometry(0.26, 0.68, 4).translate(ml11X, ml11Y + 5.10, ml11Z - 1.2),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(ml11X - 4.4, ml11Y + 3.35, ml11Z - 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(ml11X + 4.4, ml11Y + 3.35, ml11Z - 3.8)
  );

  // 3609–3616: Quảng Trường St. Denis Nam & Vườn Oải Hương (178, -78)
  const sd11X = 178.0;
  const sd11Z = -78.0;
  const sd11Y = Math.max(
    ctx.getHeight(sd11X, sd11Z),
    ctx.getHeight(sd11X - 4.2, sd11Z - 4.6),
    ctx.getHeight(sd11X + 4.2, sd11Z + 4.6)
  );
  w11CvAtlas.push(
    makeReliefBox(8.6, 7.2, 9.6, 'chateauAshlarStone', sd11X, sd11Y - 3.5, sd11Z),
    makeReliefBox(9.0, 0.24, 10.0, 'baNaMosaicPaver', sd11X, sd11Y + 0.12, sd11Z),
    // 3614–3616: 4-post Gothic limestone cloister pavilion, parterre curbs & bench
    makeReliefBox(3.4, 0.20, 3.4, 'slateMansardRoof', sd11X, sd11Y + 3.15, sd11Z),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', sd11X, sd11Y + 3.88, sd11Z, Math.PI * 0.25),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd11X - 3.4, sd11Y + 0.32, sd11Z),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd11X + 3.4, sd11Y + 0.32, sd11Z),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', sd11X, sd11Y + 0.38, sd11Z + 3.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      w11CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'chateauAshlarStone', sd11X + ox, sd11Y + 1.58, sd11Z + oz));
    }
  }
  for (const [hx, hz, hw, hd] of [
    [-2.4, -3.6, 2.8, 0.65], [2.4, -3.6, 2.8, 0.65],
    [-2.4, 3.6, 2.8, 0.65], [2.4, 3.6, 2.8, 0.65]
  ] as const) {
    const hedge = new THREE.BoxGeometry(hw, 1.35, hd).translate(sd11X + hx, sd11Y + 0.78, sd11Z + hz);
    colorizeGeo(hedge, 0x3b6e3c);
    w11CvLeaf.push(hedge);
  }
  w11CvGold.push(
    new THREE.ConeGeometry(0.22, 0.54, 4).translate(sd11X, sd11Y + 4.78, sd11Z),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(sd11X, sd11Y + 1.05, sd11Z + 4.6)
  );

  // 3617–3624: Đài Vọng Cảnh Lâu Đài Mặt Trăng Bắc (Lunar Castle North Observatory at lcX + 28.0, lcZ - 24.0)
  const ln11X = lcX + 28.0;
  const ln11Z = lcZ - 24.0;
  const ln11Y = Math.max(
    ctx.getHeight(ln11X, ln11Z),
    ctx.getHeight(ln11X - 4.2, ln11Z - 3.4),
    ctx.getHeight(ln11X + 4.2, ln11Z + 3.4)
  );
  w11CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', ln11X, ln11Y - 3.5, ln11Z),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', ln11X, ln11Y + 0.12, ln11Z),
    // 3618: 4-post medieval timber-and-slate lookout gazebo with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', ln11X + 1.6, ln11Y + 3.15, ln11Z + 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', ln11X + 1.6, ln11Y + 3.92, ln11Z + 0.8, Math.PI * 0.25),
    // 3619–3624: Solar-eclipse armillary plinth, access stair, flower planter, bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', ln11X - 2.4, ln11Y + 0.65, ln11Z - 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', ln11X - 4.8, ln11Y - 0.12, ln11Z + 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', ln11X + 3.6, ln11Y + 0.40, ln11Z - 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ln11X - 2.0, ln11Y + 0.38, ln11Z - 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', ln11X + 3.8, ln11Y + 1.60, ln11Z + 2.6)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-0.6, 2.2]) {
      w11CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', ln11X + ox, ln11Y + 1.58, ln11Z + oz));
    }
  }
  w11CvGold.push(
    new THREE.ConeGeometry(0.36, 0.62, 5).translate(ln11X - 2.4, ln11Y + 1.45, ln11Z - 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ln11X - 3.6, ln11Y + 0.62, ln11Z - 0.2),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ln11X - 3.6, ln11Y + 0.62, ln11Z + 2.6),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ln11X + 3.8, ln11Y + 3.22, ln11Z + 2.6)
  );

  // 3625–3640: Crepe cart, Suối Mơ east steps, Eclipse south bench/sundial, Cầu Vàng far-outer lamps,
  // Ga Marseille west clock, Debay east lantern/barrel, Chùa Linh Ứng Lầu Trống Đông & outer pines
  w11CvAtlas.push(
    makeReliefBox(2.8, 0.72, 1.65, 'merbauTimberDeck', fsX + 8.6, fsY + 0.42, fsZ + 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX + 10.0, fsY + 1.50, fsZ + 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX + 6.4, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ + 9.2),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -78.5, wEndY + 1.60, -144.5),
    makeReliefBox(2.0, 0.46, 0.56, 'merbauTimberDeck', -78.5, wEndY + 0.36, -148.0),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX + 6.2, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX + 7.6, dbY + 0.52, dbZ - 2.6),
    // 3637–3638: Chùa Linh Ứng Lầu Trống Đông 4-post drum pavilion (luX + 8.4, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX + 8.4, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX + 8.4, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX + 8.4, luY + 4.08, luZ + 3.4, Math.PI * 0.25)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w11CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX + 8.4 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w11CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX + 10.0, fsY + 3.08, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ + 7.6),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-38.0, getGoldenBridgeCurveAtX(-38).y + 1.72, getGoldenBridgeCurveAtX(-38).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(38.0, getGoldenBridgeCurveAtX(38).y + 1.72, getGoldenBridgeCurveAtX(38).z + 2.75),
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5).rotateX(Math.PI * 0.5).translate(-78.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX + 6.2, dbY + 1.88, dbZ - 2.6),
    new THREE.CylinderGeometry(0.42, 0.42, 0.68, 5).rotateZ(Math.PI * 0.5).translate(luX + 8.4, luY + 1.85, luZ + 3.4),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX + 8.4, luY + 4.95, luZ + 3.4)
  );
  // 3639–3640: Vườn Địa Đàng west boxwood curbs & distant outer Bà Nà highland pines (>= 12m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX - 5.2, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w11CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-158, -148], [194, -78], [ln11X + 12.5, ln11Z - 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w11CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w11CvLeaf.push(pine);
  }

  const w11CvAtlasMesh = createMergedMesh('GoldenBridgeWave11Atlas', w11CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w11CvAtlasMesh) group.add(w11CvAtlasMesh);
  const w11CvGoldMesh = createMergedMesh('GoldenBridgeWave11Gold', w11CvGold, brushedGoldMat, false, false);
  if (w11CvGoldMesh) group.add(w11CvGoldMesh);
  const w11CvLeafMesh = createMergedMesh('GoldenBridgeWave11Leaf', w11CvLeaf, foliageMat, false, false);
  if (w11CvLeafMesh) group.add(w11CvLeafMesh);

  // ==========================================================================
  // WAVE 12 UPGRADES (Items 4001–4040): SW Thought Garden Chessboard & Pavilion,
  // St. Denis East Rose Cloister, Lunar Castle SE Observatory & Lầu Chuông Tây
  // ==========================================================================
  const w12CvAtlas: THREE.BufferGeometry[] = [];
  const w12CvGold: THREE.BufferGeometry[] = [];
  const w12CvLeaf: THREE.BufferGeometry[] = [];

  // 4001–4008: Vườn Suy Tưởng Tây Nam — Đài Cờ Vua & Vọng Lâu (-142, -112)
  const tg12X = -142.0;
  const tg12Z = -112.0;
  const tg12Y = Math.max(
    ctx.getHeight(tg12X, tg12Z),
    ctx.getHeight(tg12X - 5.2, tg12Z - 4.4),
    ctx.getHeight(tg12X + 5.2, tg12Z + 4.4)
  );
  w12CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', tg12X, tg12Y - 3.7, tg12Z),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', tg12X, tg12Y + 0.12, tg12Z),
    // 4002, 4004: Stepped ashlar chessboard plinth, giant chess-king pedestal & 4-post slate belvedere
    makeReliefCyl(2.2, 2.5, 0.55, 5, 'chateauAshlarStone', tg12X, tg12Y + 0.40, tg12Z + 1.2),
    makeReliefCyl(0.32, 0.42, 1.15, 5, 'chateauAshlarStone', tg12X, tg12Y + 1.15, tg12Z + 1.2),
    makeReliefBox(3.4, 0.20, 3.0, 'slateMansardRoof', tg12X, tg12Y + 3.45, tg12Z + 1.2),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', tg12X, tg12Y + 4.18, tg12Z + 1.2, Math.PI * 0.25),
    // 4005–4008: Twin lamp standards, south valley parapet, wine-barrel table & stone bench
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', tg12X - 4.4, tg12Y + 1.65, tg12Z + 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', tg12X + 4.4, tg12Y + 1.65, tg12Z + 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', tg12X, tg12Y + 0.48, tg12Z + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', tg12X + 3.0, tg12Y + 0.52, tg12Z - 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', tg12X - 3.0, tg12Y + 0.36, tg12Z - 2.4)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.2, 1.2]) {
      w12CvAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'merbauTimberDeck', tg12X + ox, tg12Y + 2.00, tg12Z + 1.2 + oz));
    }
  }
  w12CvGold.push(
    new THREE.ConeGeometry(0.26, 0.68, 4).translate(tg12X, tg12Y + 5.10, tg12Z + 1.2),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(tg12X - 4.4, tg12Y + 3.35, tg12Z + 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(tg12X + 4.4, tg12Y + 3.35, tg12Z + 3.8)
  );

  // 4009–4016: Quảng Trường St. Denis Đông — Vườn Hoa Hồng & Hồi Lang (196, -104)
  const sd12X = 196.0;
  const sd12Z = -104.0;
  const sd12Y = Math.max(
    ctx.getHeight(sd12X, sd12Z),
    ctx.getHeight(sd12X - 4.2, sd12Z - 4.6),
    ctx.getHeight(sd12X + 4.2, sd12Z + 4.6)
  );
  w12CvAtlas.push(
    makeReliefBox(8.6, 7.2, 9.6, 'chateauAshlarStone', sd12X, sd12Y - 3.5, sd12Z),
    makeReliefBox(9.0, 0.24, 10.0, 'baNaMosaicPaver', sd12X, sd12Y + 0.12, sd12Z),
    // 4014–4016: 4-post Gothic limestone cloister gazebo, parterre curbs & bench
    makeReliefBox(3.4, 0.20, 3.4, 'slateMansardRoof', sd12X, sd12Y + 3.15, sd12Z),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', sd12X, sd12Y + 3.88, sd12Z, Math.PI * 0.25),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd12X - 3.4, sd12Y + 0.32, sd12Z),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd12X + 3.4, sd12Y + 0.32, sd12Z),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', sd12X, sd12Y + 0.38, sd12Z - 3.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      w12CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'chateauAshlarStone', sd12X + ox, sd12Y + 1.58, sd12Z + oz));
    }
  }
  for (const [hx, hz, hw, hd] of [
    [-2.4, -3.6, 2.8, 0.65], [2.4, -3.6, 2.8, 0.65],
    [-2.4, 3.6, 2.8, 0.65], [2.4, 3.6, 2.8, 0.65]
  ] as const) {
    const hedge = new THREE.BoxGeometry(hw, 1.35, hd).translate(sd12X + hx, sd12Y + 0.78, sd12Z + hz);
    colorizeGeo(hedge, 0x3b6e3c);
    w12CvLeaf.push(hedge);
  }
  w12CvGold.push(
    new THREE.ConeGeometry(0.22, 0.54, 4).translate(sd12X, sd12Y + 4.78, sd12Z),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(sd12X, sd12Y + 1.05, sd12Z - 4.6)
  );

  // 4017–4024: Lâu Đài Mặt Trăng — Đài Thiên Văn Đông Nam (Lunar Castle SE Observatory at lcX + 36.0, lcZ + 22.0)
  const ls12X = lcX + 36.0;
  const ls12Z = lcZ + 22.0;
  const ls12Y = Math.max(
    ctx.getHeight(ls12X, ls12Z),
    ctx.getHeight(ls12X - 4.2, ls12Z - 3.4),
    ctx.getHeight(ls12X + 4.2, ls12Z + 3.4)
  );
  w12CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', ls12X, ls12Y - 3.5, ls12Z),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', ls12X, ls12Y + 0.12, ls12Z),
    // 4018: 4-post medieval timber-and-slate turret belvedere with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', ls12X + 1.6, ls12Y + 3.15, ls12Z - 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', ls12X + 1.6, ls12Y + 3.92, ls12Z - 0.8, Math.PI * 0.25),
    // 4019–4024: Astrolabe plinth, access stair, alpine flower planter, bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', ls12X - 2.4, ls12Y + 0.65, ls12Z + 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', ls12X - 4.8, ls12Y - 0.12, ls12Z - 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', ls12X + 3.6, ls12Y + 0.40, ls12Z + 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ls12X - 2.0, ls12Y + 0.38, ls12Z + 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', ls12X + 3.8, ls12Y + 1.60, ls12Z - 2.6)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-2.2, 0.6]) {
      w12CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', ls12X + ox, ls12Y + 1.58, ls12Z + oz));
    }
  }
  w12CvGold.push(
    new THREE.ConeGeometry(0.36, 0.62, 5).translate(ls12X - 2.4, ls12Y + 1.45, ls12Z + 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ls12X - 3.6, ls12Y + 0.62, ls12Z + 0.2),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ls12X - 3.6, ls12Y + 0.62, ls12Z - 2.6),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ls12X + 3.8, ls12Y + 3.22, ls12Z - 2.6)
  );

  // 4025–4040: West bakery cart, Suối Mơ west steps, Eclipse north bench/obelisk, Cầu Vàng outer-approach lamps,
  // Ga Marseille east clock, Debay west lantern/barrel, Chùa Linh Ứng Lầu Chuông Tây & outer pines
  w12CvAtlas.push(
    makeReliefBox(2.8, 0.72, 1.65, 'merbauTimberDeck', fsX - 9.4, fsY + 0.42, fsZ + 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX - 10.8, fsY + 1.50, fsZ + 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX - 6.8, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ - 9.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -66.5, wEndY + 1.60, -144.5),
    makeReliefBox(2.0, 0.46, 0.56, 'merbauTimberDeck', -66.5, wEndY + 0.36, -148.0),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX - 6.6, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX - 8.0, dbY + 0.52, dbZ - 2.6),
    // 4037–4038: Chùa Linh Ứng Lầu Chuông Tây 4-post bell pavilion (luX - 8.6, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX - 8.6, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX - 8.6, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX - 8.6, luY + 4.08, luZ + 3.4, Math.PI * 0.25)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w12CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX - 8.6 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w12CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX - 10.8, fsY + 3.08, fsZ + 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ - 8.2),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-44.0, getGoldenBridgeCurveAtX(-44).y + 1.72, getGoldenBridgeCurveAtX(-44).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(44.0, getGoldenBridgeCurveAtX(44).y + 1.72, getGoldenBridgeCurveAtX(44).z + 2.75),
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5).rotateX(Math.PI * 0.5).translate(-66.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX - 6.6, dbY + 1.88, dbZ - 2.6),
    new THREE.CylinderGeometry(0.28, 0.42, 0.72, 5).translate(luX - 8.6, luY + 1.92, luZ + 3.4),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX - 8.6, luY + 4.95, luZ + 3.4)
  );
  // 4039–4040: Vườn Địa Đàng east boxwood curbs & distant outer Bà Nà highland pines (>= 12m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX + 5.4, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w12CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-158, -112], [212, -104], [ls12X + 13.0, ls12Z + 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w12CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w12CvLeaf.push(pine);
  }

  const w12CvAtlasMesh = createMergedMesh('GoldenBridgeWave12Atlas', w12CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w12CvAtlasMesh) group.add(w12CvAtlasMesh);
  const w12CvGoldMesh = createMergedMesh('GoldenBridgeWave12Gold', w12CvGold, brushedGoldMat, false, false);
  if (w12CvGoldMesh) group.add(w12CvGoldMesh);
  const w12CvLeafMesh = createMergedMesh('GoldenBridgeWave12Leaf', w12CvLeaf, foliageMat, false, false);
  if (w12CvLeafMesh) group.add(w12CvLeafMesh);

  // ==========================================================================
  // WAVE 13 UPGRADES (Items 4401–4440): SE Memory Garden Fountain & Belvedere,
  // St. Denis North Hydrangea Cloister, Lunar Castle NW Belvedere & Lầu Trống Đông
  // ==========================================================================
  const w13CvAtlas: THREE.BufferGeometry[] = [];
  const w13CvGold: THREE.BufferGeometry[] = [];
  const w13CvLeaf: THREE.BufferGeometry[] = [];

  // 4401–4408: Vườn Ký Ức Đông Nam — Quảng Trường Đá & Đài Phun Nước (-164, -112)
  const mg13X = -164.0;
  const mg13Z = -112.0;
  const mg13Y = Math.max(
    ctx.getHeight(mg13X, mg13Z),
    ctx.getHeight(mg13X - 5.2, mg13Z - 4.4),
    ctx.getHeight(mg13X + 5.2, mg13Z + 4.4)
  );
  w13CvAtlas.push(
    makeReliefBox(10.6, 7.6, 9.0, 'chateauAshlarStone', mg13X, mg13Y - 3.7, mg13Z),
    makeReliefBox(11.0, 0.24, 9.4, 'baNaMosaicPaver', mg13X, mg13Y + 0.12, mg13Z),
    // 4402, 4404: Stepped ashlar fountain basin, limestone urn pedestal & 4-post slate belvedere
    makeReliefCyl(2.2, 2.5, 0.55, 5, 'chateauAshlarStone', mg13X, mg13Y + 0.40, mg13Z + 1.2),
    makeReliefCyl(0.32, 0.42, 1.15, 5, 'chateauAshlarStone', mg13X, mg13Y + 1.15, mg13Z + 1.2),
    makeReliefBox(3.4, 0.20, 3.0, 'slateMansardRoof', mg13X, mg13Y + 3.45, mg13Z + 1.2),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', mg13X, mg13Y + 4.18, mg13Z + 1.2, Math.PI * 0.25),
    // 4405–4408: Twin lamp standards, south valley parapet, wine-barrel table & stone bench
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', mg13X - 4.4, mg13Y + 1.65, mg13Z + 3.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', mg13X + 4.4, mg13Y + 1.65, mg13Z + 3.8),
    makeReliefBox(10.2, 0.72, 0.30, 'chateauAshlarStone', mg13X, mg13Y + 0.48, mg13Z + 4.4),
    makeReliefCyl(0.45, 0.45, 0.82, 5, 'merbauTimberDeck', mg13X + 3.0, mg13Y + 0.52, mg13Z - 1.8),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', mg13X - 3.0, mg13Y + 0.36, mg13Z - 2.4)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.2, 1.2]) {
      w13CvAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'merbauTimberDeck', mg13X + ox, mg13Y + 2.00, mg13Z + 1.2 + oz));
    }
  }
  w13CvGold.push(
    new THREE.ConeGeometry(0.26, 0.68, 4).translate(mg13X, mg13Y + 5.10, mg13Z + 1.2),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(mg13X - 4.4, mg13Y + 3.35, mg13Z + 3.8),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(mg13X + 4.4, mg13Y + 3.35, mg13Z + 3.8)
  );

  // 4409–4416: Quảng Trường St. Denis Bắc — Vườn Cẩm Tú Cầu & Hồi Lang (196, -126)
  const sd13X = 196.0;
  const sd13Z = -126.0;
  const sd13Y = Math.max(
    ctx.getHeight(sd13X, sd13Z),
    ctx.getHeight(sd13X - 4.2, sd13Z - 4.6),
    ctx.getHeight(sd13X + 4.2, sd13Z + 4.6)
  );
  w13CvAtlas.push(
    makeReliefBox(8.6, 7.2, 9.6, 'chateauAshlarStone', sd13X, sd13Y - 3.5, sd13Z),
    makeReliefBox(9.0, 0.24, 10.0, 'baNaMosaicPaver', sd13X, sd13Y + 0.12, sd13Z),
    // 4414–4416: 4-post Gothic limestone cloister gazebo, parterre curbs & bench
    makeReliefBox(3.4, 0.20, 3.4, 'slateMansardRoof', sd13X, sd13Y + 3.15, sd13Z),
    makeReliefCyl(0.12, 2.55, 1.38, 4, 'slateMansardRoof', sd13X, sd13Y + 3.88, sd13Z, Math.PI * 0.25),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd13X - 3.4, sd13Y + 0.32, sd13Z),
    makeReliefBox(0.55, 0.42, 7.4, 'chateauAshlarStone', sd13X + 3.4, sd13Y + 0.32, sd13Z),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', sd13X, sd13Y + 0.38, sd13Z - 3.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.4, 1.4]) {
      w13CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'chateauAshlarStone', sd13X + ox, sd13Y + 1.58, sd13Z + oz));
    }
  }
  for (const [hx, hz, hw, hd] of [
    [-2.4, -3.6, 2.8, 0.65], [2.4, -3.6, 2.8, 0.65],
    [-2.4, 3.6, 2.8, 0.65], [2.4, 3.6, 2.8, 0.65]
  ] as const) {
    const hedge = new THREE.BoxGeometry(hw, 1.35, hd).translate(sd13X + hx, sd13Y + 0.78, sd13Z + hz);
    colorizeGeo(hedge, 0x3b6e3c);
    w13CvLeaf.push(hedge);
  }
  w13CvGold.push(
    new THREE.ConeGeometry(0.22, 0.54, 4).translate(sd13X, sd13Y + 4.78, sd13Z),
    new THREE.BoxGeometry(0.75, 0.42, 0.14).translate(sd13X, sd13Y + 1.05, sd13Z - 4.6)
  );

  // 4417–4424: Lâu Đài Mặt Trăng — Đài Vọng Cảnh Tây Bắc (Lunar Castle NW Belvedere at lcX - 36.0, lcZ - 22.0)
  const ln13X = lcX - 36.0;
  const ln13Z = lcZ - 22.0;
  const ln13Y = Math.max(
    ctx.getHeight(ln13X, ln13Z),
    ctx.getHeight(ln13X - 4.2, ln13Z - 3.4),
    ctx.getHeight(ln13X + 4.2, ln13Z + 3.4)
  );
  w13CvAtlas.push(
    makeReliefBox(8.6, 7.2, 7.0, 'chateauAshlarStone', ln13X, ln13Y - 3.5, ln13Z),
    makeReliefBox(9.0, 0.24, 7.4, 'baNaMosaicPaver', ln13X, ln13Y + 0.12, ln13Z),
    // 4418: 4-post medieval timber-and-slate turret belvedere with flush slate hip roof
    makeReliefBox(4.0, 0.22, 3.6, 'slateMansardRoof', ln13X - 1.6, ln13Y + 3.15, ln13Z + 0.8),
    makeReliefCyl(0.12, 2.95, 1.45, 4, 'slateMansardRoof', ln13X - 1.6, ln13Y + 3.92, ln13Z + 0.8, Math.PI * 0.25),
    // 4419–4424: Armillary plinth, access stair, alpine flower planter, bench & lamp post
    makeReliefCyl(0.32, 0.40, 1.05, 5, 'chateauAshlarStone', ln13X + 2.4, ln13Y + 0.65, ln13Z - 0.6),
    makeReliefBox(2.4, 0.45, 2.4, 'chateauAshlarStone', ln13X + 4.8, ln13Y - 0.12, ln13Z + 1.4),
    makeReliefBox(1.6, 0.48, 0.65, 'chateauAshlarStone', ln13X - 3.6, ln13Y + 0.40, ln13Z - 2.4),
    makeReliefBox(2.0, 0.46, 0.52, 'chateauAshlarStone', ln13X + 2.0, ln13Y + 0.38, ln13Z - 2.4),
    makeReliefCyl(0.08, 0.10, 3.0, 4, 'greenSteelPier', ln13X - 3.8, ln13Y + 1.60, ln13Z + 2.6)
  );
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-0.6, 2.2]) {
      w13CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 4, 'merbauTimberDeck', ln13X + ox, ln13Y + 1.58, ln13Z + oz));
    }
  }
  w13CvGold.push(
    new THREE.ConeGeometry(0.36, 0.62, 5).translate(ln13X + 2.4, ln13Y + 1.45, ln13Z - 0.6),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ln13X + 3.6, ln13Y + 0.62, ln13Z - 0.2),
    new THREE.CylinderGeometry(0.14, 0.18, 0.95, 4).translate(ln13X + 3.6, ln13Y + 0.62, ln13Z + 2.6),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ln13X - 3.8, ln13Y + 3.22, ln13Z + 2.6)
  );

  // 4425–4440: East pastry cart, Suối Mơ east steps, Eclipse south bench/obelisk, Cầu Vàng outer-approach lamps,
  // Ga Marseille west clock, Debay east lantern/barrel, Chùa Linh Ứng Lầu Trống Đông & outer pines
  w13CvAtlas.push(
    makeReliefBox(2.8, 0.72, 1.65, 'merbauTimberDeck', fsX + 10.6, fsY + 0.42, fsZ - 5.8),
    makeReliefCyl(0.08, 0.10, 2.9, 4, 'greenSteelPier', fsX + 12.0, fsY + 1.50, fsZ - 5.8),
    makeReliefBox(1.8, 0.55, 4.6, 'chateauAshlarStone', smX + 7.2, smY + 0.32, smZ),
    makeReliefBox(5.6, 0.48, 0.68, 'chateauAshlarStone', esX, esY + 0.36, esZ + 10.8),
    makeReliefCyl(0.08, 0.10, 3.1, 4, 'greenSteelPier', -74.5, wEndY + 1.60, -144.5),
    makeReliefBox(2.0, 0.46, 0.56, 'merbauTimberDeck', -74.5, wEndY + 0.36, -148.0),
    makeReliefBox(0.45, 1.65, 0.45, 'chateauAshlarStone', dbX + 7.4, dbY + 0.88, dbZ - 2.6),
    makeReliefCyl(0.42, 0.42, 0.88, 5, 'merbauTimberDeck', dbX + 8.8, dbY + 0.52, dbZ - 2.6),
    // 4437–4438: Chùa Linh Ứng Lầu Trống Đông 4-post drum pavilion (luX + 8.8, luZ + 3.4)
    makeReliefBox(3.4, 0.45, 3.4, 'chateauAshlarStone', luX + 8.8, luY + 0.25, luZ + 3.4),
    makeReliefBox(3.2, 0.20, 3.2, 'slateMansardRoof', luX + 8.8, luY + 3.35, luZ + 3.4),
    makeReliefCyl(0.12, 2.45, 1.35, 4, 'slateMansardRoof', luX + 8.8, luY + 4.08, luZ + 3.4, Math.PI * 0.25)
  );
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-1.0, 1.0]) {
      w13CvAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 4, 'merbauTimberDeck', luX + 8.8 + ox, luY + 1.75, luZ + 3.4 + oz));
    }
  }
  w13CvGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(fsX + 12.0, fsY + 3.08, fsZ - 5.8),
    new THREE.ConeGeometry(0.28, 0.95, 4).translate(esX, esY + 0.95, esZ + 9.2),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(-48.0, getGoldenBridgeCurveAtX(-48).y + 1.72, getGoldenBridgeCurveAtX(-48).z + 2.75),
    new THREE.ConeGeometry(0.18, 0.48, 4).translate(48.0, getGoldenBridgeCurveAtX(48).y + 1.72, getGoldenBridgeCurveAtX(48).z + 2.75),
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 5).rotateX(Math.PI * 0.5).translate(-74.5, wEndY + 3.15, -144.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(dbX + 7.4, dbY + 1.88, dbZ - 2.6),
    new THREE.CylinderGeometry(0.36, 0.36, 0.68, 5).rotateZ(Math.PI * 0.5).translate(luX + 8.8, luY + 1.78, luZ + 3.4),
    new THREE.ConeGeometry(0.22, 0.52, 4).translate(luX + 8.8, luY + 4.95, luZ + 3.4)
  );
  // 4439–4440: Vườn Địa Đàng west boxwood curbs & distant outer Bà Nà highland pines (>= 12m clear!)
  for (const sz of [-1.8, 1.8]) {
    const bx = new THREE.BoxGeometry(1.6, 0.65, 0.55).translate(vdX - 5.8, vdY + 0.42, vdZ + sz);
    colorizeGeo(bx, 0x2a6a28);
    w13CvLeaf.push(bx);
  }
  for (const [tx, tz] of [[-180, -112], [212, -126], [ln13X - 13.0, ln13Z - 8.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w13CvAtlas.push(makeReliefCyl(0.18, 0.25, 4.8, 4, 'merbauTimberDeck', tx, ty + 2.0, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.6, tz);
    colorizeGeo(pine, 0x1d4d22);
    w13CvLeaf.push(pine);
  }

  const w13CvAtlasMesh = createMergedMesh('GoldenBridgeWave13Atlas', w13CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w13CvAtlasMesh) group.add(w13CvAtlasMesh);
  const w13CvGoldMesh = createMergedMesh('GoldenBridgeWave13Gold', w13CvGold, brushedGoldMat, false, false);
  if (w13CvGoldMesh) group.add(w13CvGoldMesh);
  const w13CvLeafMesh = createMergedMesh('GoldenBridgeWave13Leaf', w13CvLeaf, foliageMat, false, false);
  if (w13CvLeafMesh) group.add(w13CvLeafMesh);

  // ==========================================================================
  // WAVE 15 REAL-PHOTO ARCHITECTURAL DETAIL UPGRADES (castShadow = false, 0 new materials):
  // Cầu Vàng heavy structural railing stanchions, recessed deck-edge lamp housings,
  // cantilevered observation-bay soffit ribs, cascading purple Lobelia clusters,
  // and weathered Giant Hands stone fissures, fingernail cuticle rims & knuckle moss
  // ==========================================================================
  const w15CvAtlas: THREE.BufferGeometry[] = [];
  const w15CvGold: THREE.BufferGeometry[] = [];
  const w15CvLeaf: THREE.BufferGeometry[] = [];

  const orientAtBridgeX = (g: THREE.BufferGeometry, x: number): THREE.BufferGeometry => {
    const c0 = getGoldenBridgeCurveAtX(x - 0.5);
    const c1 = getGoldenBridgeCurveAtX(x + 0.5);
    const c = getGoldenBridgeCurveAtX(x);
    const dx = 1.0;
    const dy = c1.y - c0.y;
    const dz = c1.z - c0.z;
    const yaw = -Math.atan2(dz, dx);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    g.rotateZ(pitch);
    g.rotateY(yaw);
    g.translate(x, c.y, c.z);
    return g;
  };

  // 15.1 Heavy champagne-gold structural railing stanchions, collar caps & angled deck-edge lamp housings
  for (let rx = -60; rx <= 60; rx += 12) {
    for (const side of [-1, 1]) {
      const railZ = side * (deckHalfW + 0.06);
      // Heavy stainless-steel stanchion post & curved top collar joint
      w15CvGold.push(
        orientAtBridgeX(new THREE.BoxGeometry(0.11, 1.28, 0.11).translate(0, 0.66, railZ), rx),
        orientAtBridgeX(new THREE.BoxGeometry(0.16, 0.11, 0.14).translate(0, 1.26, railZ), rx)
      );
      // Low-profile angled deck lamp housing along inner Lobelia curb + warm gold reflector lens
      w15CvAtlas.push(
        orientAtBridgeX(remapRelief(new THREE.BoxGeometry(0.24, 0.18, 0.16), 'slateMansardRoof').translate(0, 0.24, side * 1.82), rx)
      );
      w15CvGold.push(
        orientAtBridgeX(new THREE.BoxGeometry(0.18, 0.08, 0.06).translate(0, 0.22, side * 1.73), rx)
      );
    }
  }

  // 15.2 Flared cantilevered observation/photo-bay soffit ribs & gilded rail plaque trims (x = -18, 0, +18)
  for (const bx of [-18, 0, 18]) {
    for (const side of [-1, 1]) {
      w15CvGold.push(
        orientAtBridgeX(new THREE.BoxGeometry(1.65, 0.18, 0.28).translate(0, -0.45, side * (deckHalfW + 0.22)), bx),
        orientAtBridgeX(new THREE.BoxGeometry(1.45, 0.12, 0.08).translate(0, 1.18, side * (deckHalfW + 0.14)), bx)
      );
    }
  }

  // 15.3 Staggered billowing purple Lobelia flower crown clusters overflowing inner planter curbs
  for (let lx = -68; lx <= 68; lx += 8) {
    for (const side of [-1, 1]) {
      const zOff = side * (2.06 + ((Math.abs(lx) % 16 === 0) ? -0.10 : 0.08));
      const tuft = remapRelief(new THREE.CylinderGeometry(0.20, 0.28, 0.26, 5), 'lobeliaVioletBloom');
      tuft.scale(1.45, 0.92, 1.05);
      tuft.translate(0, 0.66, zOff);
      w15CvAtlas.push(orientAtBridgeX(tuft, lx));
    }
  }

  // 15.4 Weathered Giant Hands: fingernail cuticle lunula rims, distal nail bevels, stone crack fissures & knuckle/wrist moss cushions
  for (const [hx, sideSign] of [[-28.0, -1], [28.0, 1]] as const) {
    const hc = getGoldenBridgeCurveAtX(hx);
    const palmX = hx;
    const palmY = hc.y - 2.75;
    const palmZ = hc.z + 0.35;

    // Diagonal stone weathering fissure ribs across forearm, wrist cuff & outer palm
    const fissureSpecs: Array<[number, number, number, number, number, number]> = [
      [palmX + sideSign * 1.4, palmY - 2.8, palmZ + 4.4, 2.2, 0.18, 0.22],
      [palmX + sideSign * 2.2, palmY - 4.8, palmZ + 6.4, 2.4, 0.20, 0.24],
      [palmX - sideSign * 1.8, palmY + 0.2, palmZ + 2.8, 1.8, 0.16, 0.20],
      [palmX + sideSign * 1.8, palmY + 0.1, palmZ + 1.8, 1.8, 0.16, 0.20],
      [palmX - sideSign * 2.9, palmY + 3.4, palmZ + 3.6, 0.22, 1.65, 0.22],
      [palmX + sideSign * 0.2, palmY + 3.8, palmZ - 3.6, 0.22, 1.85, 0.22]
    ];
    for (const [fx, fy, fz, fw, fh, fd] of fissureSpecs) {
      w15CvAtlas.push(makeReliefBox(fw, fh, fd, 'giantHandMossyStone', fx, fy, fz, sideSign * 0.24, 0.18, 0.14));
    }

    // Sculpted fingernail cuticle lunula rims & distal nail bevel lips on thumb + 4 articulated fingers
    const digitTips: Array<[THREE.Vector3, THREE.Vector3, number]> = [
      [
        new THREE.Vector3(palmX - sideSign * 3.2, palmY + 4.8, palmZ + 3.55),
        new THREE.Vector3(palmX - sideSign * 2.1, palmY + 6.9, palmZ + 3.05),
        0.86
      ],
      [
        new THREE.Vector3(palmX + sideSign * (-2.45 + -0.25 * 0.8), palmY + 7.4 * 0.72, palmZ - 2.65 - 1.12),
        new THREE.Vector3(palmX + sideSign * (-2.45 + -0.25), palmY + 7.4, palmZ - 2.65 - 0.62),
        0.68
      ],
      [
        new THREE.Vector3(palmX + sideSign * (-0.82 + -0.05 * 0.8), palmY + 8.4 * 0.72, palmZ - 2.65 - 1.12),
        new THREE.Vector3(palmX + sideSign * (-0.82 + -0.05), palmY + 8.4, palmZ - 2.65 - 0.62),
        0.70
      ],
      [
        new THREE.Vector3(palmX + sideSign * (0.88 + 0.12 * 0.8), palmY + 7.5 * 0.72, palmZ - 2.65 - 1.12),
        new THREE.Vector3(palmX + sideSign * (0.88 + 0.12), palmY + 7.5, palmZ - 2.65 - 0.62),
        0.66
      ],
      [
        new THREE.Vector3(palmX + sideSign * (2.45 + 0.48 * 0.8), palmY + 6.1 * 0.72, palmZ - 2.65 - 1.12),
        new THREE.Vector3(palmX + sideSign * (2.45 + 0.48), palmY + 6.1, palmZ - 2.65 - 0.62),
        0.56
      ]
    ];
    for (const [prev, tip, tipR] of digitTips) {
      const tipDir = new THREE.Vector3().subVectors(tip, prev).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
      // Cuticle lunula ridge at base of nail
      const cuticle = remapRelief(new THREE.BoxGeometry(tipR * 1.24, tipR * 0.28, tipR * 0.36), 'giantHandMossyStone');
      cuticle.applyQuaternion(q);
      cuticle.translate(tip.x - tipDir.x * tipR * 1.05, tip.y - tipDir.y * tipR * 1.05, tip.z + tipR * 0.76);
      // Distal fingernail tip bevel
      const nailTip = remapRelief(new THREE.BoxGeometry(tipR * 1.08, tipR * 0.24, tipR * 0.26), 'chateauAshlarStone');
      nailTip.applyQuaternion(q);
      nailTip.translate(tip.x + tipDir.x * tipR * 0.18, tip.y + tipDir.y * tipR * 0.18, tip.z + tipR * 0.80);
      w15CvAtlas.push(cuticle, nailTip);
    }

    // Targeted green stone-moss & alpine lichen cushions nestled into thumb knuckle, wrist fold & dorsal finger knuckles
    const mossSpots: Array<[number, number, number, number]> = [
      [palmX - sideSign * 3.5, palmY + 3.4, palmZ + 3.65, 0.56],
      [palmX + sideSign * 1.1, palmY - 3.3, palmZ + 4.3, 0.72],
      [palmX + sideSign * -2.45, palmY + 3.2, palmZ - 3.55, 0.48],
      [palmX + sideSign * -0.82, palmY + 4.2, palmZ - 3.65, 0.52],
      [palmX + sideSign * 0.88, palmY + 3.8, palmZ - 3.60, 0.48],
      [palmX + sideSign * 2.45, palmY + 2.8, palmZ - 3.50, 0.44]
    ];
    mossSpots.forEach(([mx, my, mz, mr], mi) => {
      const mGeo = new THREE.SphereGeometry(mr, 5, 4);
      mGeo.scale(1.35, 0.48, 1.05);
      mGeo.translate(mx, my, mz);
      colorizeGeo(mGeo, mi % 2 === 0 ? 0x3a6425 : 0x4f7e32);
      w15CvLeaf.push(mGeo);
    });
  }

  const w15CvAtlasMesh = createMergedMesh('GoldenBridgeWave15Atlas', w15CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w15CvAtlasMesh) group.add(w15CvAtlasMesh);
  const w15CvGoldMesh = createMergedMesh('GoldenBridgeWave15Gold', w15CvGold, brushedGoldMat, false, false);
  if (w15CvGoldMesh) group.add(w15CvGoldMesh);
  const w15CvLeafMesh = createMergedMesh('GoldenBridgeWave15Leaf', w15CvLeaf, foliageMat, false, false);
  if (w15CvLeafMesh) group.add(w15CvLeafMesh);

  // ==========================================================================
  // WAVE 21 REAL-PHOTO ARCHITECTURAL DETAIL UPGRADES (castShadow = false, 0 new materials):
  // Cầu Vàng West/East stone abutment gateway piers with gilded lantern-urns,
  // stepped Lobelia/hydrangea terraced flowerbeds & cloud-overlook benches
  // ==========================================================================
  const w21CvAtlas: THREE.BufferGeometry[] = [];
  const w21CvGold: THREE.BufferGeometry[] = [];
  const w21CvLeaf: THREE.BufferGeometry[] = [];

  // 21.1 West & East Stone Abutment Gateway Piers framing Cầu Vàng bridge entry thresholds (x = ±75.6)
  for (const isWest of [true, false]) {
    const endX = isWest ? -75.0 : 75.0;
    const pierX = isWest ? -75.6 : 75.6;
    const sgn = isWest ? -1 : 1;
    const cEnd = getGoldenBridgeCurveAtX(endX);
    const baseY = cEnd.y - 0.25;
    for (const side of [-1, 1]) {
      const pierZ = cEnd.z + side * 3.65;
      // Stepped ashlar plinth, pier shaft, moulded cornice cap & wing-curb transition
      w21CvAtlas.push(
        makeReliefBox(1.18, 0.55, 1.18, 'chateauAshlarStone', pierX, baseY + 0.18, pierZ),
        makeReliefBox(0.88, 2.35, 0.88, 'chateauAshlarStone', pierX, baseY + 1.50, pierZ),
        makeReliefBox(1.06, 0.22, 1.06, 'chateauAshlarStone', pierX, baseY + 2.78, pierZ),
        makeReliefBox(1.45, 0.72, 0.42, 'chateauAshlarStone', pierX + sgn * 1.05, baseY + 0.34, pierZ),
        makeReliefCyl(0.24, 0.18, 0.42, 6, 'chateauAshlarStone', pierX, baseY + 3.08, pierZ)
      );
      // Brushed champagne-gold collar band & gateway lantern-urn finial
      w21CvGold.push(
        new THREE.BoxGeometry(0.96, 0.10, 0.96).translate(pierX, baseY + 2.58, pierZ),
        new THREE.ConeGeometry(0.18, 0.34, 5).translate(pierX, baseY + 3.44, pierZ)
      );
    }
  }

  // 21.2 Stepped Terraced Lobelia & Hydrangea Flowerbeds along southern mosaic walkway slope
  for (const fw of [-36, -20, -4, 12, 28, 40]) {
    const fz = -135.5 + Math.sin(fw * 0.06) * 2.2 + 2.35;
    const fy = ctx.getHeight(fw, fz);
    w21CvAtlas.push(
      makeReliefBox(3.4, 1.65, 1.05, 'chateauAshlarStone', fw, fy - 0.35, fz),
      makeReliefBox(3.1, 0.34, 0.82, 'lobeliaVioletBloom', fw, fy + 0.60, fz)
    );
    for (const side of [-1, 1]) {
      const tuft = new THREE.SphereGeometry(0.32, 5, 4);
      tuft.scale(1.25, 0.85, 1.0);
      tuft.translate(fw + side * 1.15, fy + 0.80, fz);
      colorizeGeo(tuft, side < 0 ? 0x366d2e : 0x4c8236);
      w21CvLeaf.push(tuft);
    }
  }

  // 21.3 Cloud-Overlook Timber-and-Iron Viewing Benches at panoramic terrace pockets
  for (const bw of [-28, -12, 12, 28]) {
    const bz = -135.5 + Math.sin(bw * 0.06) * 2.2 + 1.05;
    const by = ctx.getHeight(bw, bz);
    w21CvAtlas.push(
      // Merbau timber seat & angled backrest slat
      makeReliefBox(1.75, 0.09, 0.46, 'merbauTimberDeck', bw, by + 0.72, bz),
      makeReliefBox(1.75, 0.34, 0.07, 'merbauTimberDeck', bw, by + 0.98, bz - 0.21, 0, -0.18, 0),
      // Grounded cast-iron side leg/armrest frames embedded into mosaic paver deck
      makeReliefBox(0.08, 0.56, 0.48, 'greenSteelPier', bw - 0.72, by + 0.50, bz),
      makeReliefBox(0.08, 0.56, 0.48, 'greenSteelPier', bw + 0.72, by + 0.50, bz)
    );
    w21CvGold.push(
      new THREE.BoxGeometry(0.22, 0.14, 0.05).translate(bw, by + 1.00, bz - 0.17)
    );
  }

  const w21CvAtlasMesh = createMergedMesh('GoldenBridgeWave21Atlas', w21CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w21CvAtlasMesh) group.add(w21CvAtlasMesh);
  const w21CvGoldMesh = createMergedMesh('GoldenBridgeWave21Gold', w21CvGold, brushedGoldMat, false, false);
  if (w21CvGoldMesh) group.add(w21CvGoldMesh);
  const w21CvLeafMesh = createMergedMesh('GoldenBridgeWave21Leaf', w21CvLeaf, foliageMat, false, false);
  if (w21CvLeafMesh) group.add(w21CvLeafMesh);

  // ==========================================================================
  // WAVE 27 REAL-PHOTO ARCHITECTURAL DETAIL UPGRADES (castShadow = false, 0 new materials):
  // Cầu Vàng stone abutment garden directional signposts (stone plinth + Merbau timber post
  // + dual pointed bilingual route blades + bronze collar/finial) & low-profile stone-and-bronze
  // garden lamp bollards lining abutment terrace thresholds and mosaic garden walkway
  // ==========================================================================
  const w27CvAtlas: THREE.BufferGeometry[] = [];
  const w27CvGold: THREE.BufferGeometry[] = [];

  // 27.1 Cầu Vàng West & East Stone Abutment Garden Directional Signposts (4 corners)
  for (const w27IsWest of [true, false]) {
    const w27SignX = w27IsWest ? -75.8 : 75.8;
    const w27Sgn = w27IsWest ? -1 : 1;
    const w27BaseY = w27IsWest ? wEndY : eEndY;
    for (const w27SignZ of [-139.4, -151.4]) {
      const w27BladeYawA = w27SignZ > -145 ? 0.22 * w27Sgn : -0.22 * w27Sgn;
      const w27BladeYawB = -w27BladeYawA + 0.55 * w27Sgn;
      w27CvAtlas.push(
        // Stepped ashlar stone base plinth grounded into mosaic paver (top at w27BaseY + 0.175)
        makeReliefBox(0.46, 0.56, 0.46, 'chateauAshlarStone', w27SignX, w27BaseY + 0.42, w27SignZ),
        makeReliefBox(0.54, 0.10, 0.54, 'chateauAshlarStone', w27SignX, w27BaseY + 0.72, w27SignZ),
        // Dark-stained Merbau timber signpost shaft
        makeReliefCyl(0.065, 0.08, 2.05, 4, 'merbauTimberDeck', w27SignX, w27BaseY + 1.76, w27SignZ),
        // Upper & lower rustic wooden directional arrow blades aligned cleanly to post & arrow tips
        makeReliefBox(
          0.86,
          0.20,
          0.06,
          'merbauTimberDeck',
          w27SignX + w27Sgn * 0.43 * Math.cos(w27BladeYawA),
          w27BaseY + 2.52,
          w27SignZ - w27Sgn * 0.43 * Math.sin(w27BladeYawA),
          w27BladeYawA
        ),
        makeReliefBox(
          0.76,
          0.18,
          0.06,
          'merbauTimberDeck',
          w27SignX - w27Sgn * 0.38 * Math.cos(w27BladeYawB),
          w27BaseY + 2.22,
          w27SignZ + w27Sgn * 0.38 * Math.sin(w27BladeYawB),
          w27BladeYawB
        )
      );
      // Pointed arrow tips flush with each directional blade end
      const w27TipA = remapRelief(new THREE.ConeGeometry(0.11, 0.18, 4), 'merbauTimberDeck');
      w27TipA.rotateZ(-w27Sgn * Math.PI * 0.5);
      w27TipA.rotateY(w27BladeYawA);
      w27TipA.translate(
        w27SignX + w27Sgn * 0.94 * Math.cos(w27BladeYawA),
        w27BaseY + 2.52,
        w27SignZ - w27Sgn * 0.94 * Math.sin(w27BladeYawA)
      );
      const w27TipB = remapRelief(new THREE.ConeGeometry(0.10, 0.16, 4), 'merbauTimberDeck');
      w27TipB.rotateZ(w27Sgn * Math.PI * 0.5);
      w27TipB.rotateY(w27BladeYawB);
      w27TipB.translate(
        w27SignX - w27Sgn * 0.83 * Math.cos(w27BladeYawB),
        w27BaseY + 2.22,
        w27SignZ + w27Sgn * 0.83 * Math.sin(w27BladeYawB)
      );
      w27CvAtlas.push(w27TipA, w27TipB);
      // Brushed champagne-gold mounting collar & finial spire
      w27CvGold.push(
        new THREE.BoxGeometry(0.18, 0.10, 0.18).translate(w27SignX, w27BaseY + 2.78, w27SignZ),
        new THREE.ConeGeometry(0.08, 0.22, 4).translate(w27SignX, w27BaseY + 2.94, w27SignZ)
      );
    }
  }

  // 27.2 Low-Profile Stone-and-Bronze Garden Lamp Bollards (8 on West/East abutment terraces + 4 along mosaic garden walkway)
  const w27AddLampBollard = (bx: number, byTop: number, bz: number) => {
    w27CvAtlas.push(
      makeReliefBox(0.28, 0.24, 0.28, 'chateauAshlarStone', bx, byTop + 0.08, bz),
      makeReliefCyl(0.08, 0.095, 0.58, 4, 'greenSteelPier', bx, byTop + 0.48, bz),
      makeReliefCyl(0.04, 0.16, 0.12, 4, 'slateMansardRoof', bx, byTop + 0.94, bz)
    );
    w27CvGold.push(
      new THREE.CylinderGeometry(0.075, 0.075, 0.14, 4).translate(bx, byTop + 0.82, bz)
    );
  };
  for (const [w27Bx, w27Bz, w27By] of [
    [-76.3, -139.0, wEndY + 0.175],
    [-78.6, -139.0, wEndY + 0.175],
    [-76.3, -151.9, wEndY + 0.175],
    [-77.8, -151.9, wEndY + 0.175],
    [76.3, -139.0, eEndY + 0.175],
    [78.6, -139.0, eEndY + 0.175],
    [76.3, -151.9, eEndY + 0.175],
    [77.8, -151.9, eEndY + 0.175]
  ] as const) {
    w27AddLampBollard(w27Bx, w27By, w27Bz);
  }
  for (const w27Ww of [-40, -24, 24, 40]) {
    const w27Wz = -135.5 + Math.sin(w27Ww * 0.06) * 2.2 - 1.25;
    const w27Wy = ctx.getHeight(w27Ww, w27Wz) + 0.35;
    w27AddLampBollard(w27Ww, w27Wy, w27Wz);
  }

  const w27CvAtlasMesh = createMergedMesh('GoldenBridgeWave27Atlas', w27CvAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w27CvAtlasMesh) group.add(w27CvAtlasMesh);
  const w27CvGoldMesh = createMergedMesh('GoldenBridgeWave27Gold', w27CvGold, brushedGoldMat, false, false);
  if (w27CvGoldMesh) group.add(w27CvGoldMesh);

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

  // Item 021: Tidal limestone undercut pale oyster/mineral bands at waterline (y = 0.0..0.7m) of Hòn Trống Mái
  for (const [bx, bz, br] of [[-33.7, -410.0, 2.25], [-22.3, -410.0, 2.05]]) {
    const band = remapRelief(new THREE.CylinderGeometry(br, br * 1.12, 0.48, 8), 'chateauAshlarStone');
    band.scale(1.05, 1.0, 0.58);
    band.translate(bx, 0.15, bz);
    atlasParts.push(band);
  }
  // Item 022: 3rd smaller accompanying karst sea-stack (*Hòn Con Gà* / reef outcrop) near Hòn Trống Mái
  const conGa = sculptFightingCock(53, 2.2, 7.6, 0.4, 1);
  conGa.translate(-42.5, -1.0, -414.5);
  atlasParts.push(conGa);
  foliageAnchors.push({ x: -42.3, y: 6.4, z: -414.5, scale: 1.2 });

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
    const leg = remapRelief(new THREE.LatheGeometry(legPts, 10), 'haLongDiagonalKarst');
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

  // Item 021 (cont) & 023: Waterline oyster mineral bands on Hòn Đỉnh Hương legs + hanging stalactites inside open sea-arch
  for (const side of [-1, 1]) {
    const legBand = remapRelief(new THREE.CylinderGeometry(1.72, 1.95, 0.46, 7), 'chateauAshlarStone');
    legBand.scale(1.12, 1.0, 0.72);
    legBand.translate(dhX + side * 4.5, 0.16, dhZ);
    atlasParts.push(legBand);
  }
  for (const stOff of [-1.4, -0.4, 0.7, 1.6]) {
    const stal = remapRelief(new THREE.ConeGeometry(0.32, 1.55, 6), 'haLongDiagonalKarst');
    stal.rotateX(Math.PI);
    stal.translate(dhX + stOff, 4.45, dhZ);
    atlasParts.push(stal);
  }

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
    [-95, -315, 13, 32], [185, -340, 16, 38], [240, -355, 18, 42],
    // Item 028 (Area Expansion): Distant northern Hạ Long Bay horizon karsts (z = -590..-680)
    [-250, -640, 28, 64], [-110, -675, 30, 68], [70, -680, 28, 66], [235, -635, 26, 58]
  ];
  // Item 029: Coastal karst sea-tunnel grotto arch (*Hang Luồn* motif) on western karst flank (x = -95, z = -315)
  const luonArch = remapRelief(
    normalizeExtrudeUv(createArchedWallGeometry(16.0, 12.5, 9.5, 6.2, 4.6)),
    'haLongDiagonalKarst'
  );
  luonArch.translate(-95, -1.2, -304);
  atlasParts.push(luonArch);
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
    const bulb = new THREE.SphereGeometry(0.09, 6, 5);
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
    const bloom = remapRelief(new THREE.SphereGeometry(0.44, 6, 5), 'lobeliaVioletBloom');
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
  // Item 024: Bamboo-woven coracle boats (*thuyền thúng*) moored alongside Cửa Vạn rafts
  for (const [tx, tz] of [[96.2, -365.5], [115.8, -346.2]]) {
    const coracle = remapRelief(new THREE.CylinderGeometry(0.82, 0.52, 0.42, 7), 'weatheredPierPlank');
    coracle.translate(tx, 0.20, tz);
    atlasParts.push(coracle);
  }
  // Item 025 & 026: Aquaculture net-pen posts, red/yellow mooring buoys & leaning wooden oars at Cửa Vạn
  for (const [bx, bz] of [[95.5, -350.5], [120.5, -350.0], [109.5, -368.5]]) {
    const buoy = remapRelief(new THREE.SphereGeometry(0.28, 6, 5), 'corrugatedTinRoof');
    buoy.translate(bx, 0.12, bz);
    atlasParts.push(buoy);
  }
  for (const [ox, oz] of [[98.8, -357.8], [113.6, -349.8]]) {
    atlasParts.push(
      makeReliefCyl(0.035, 0.04, 2.4, 5, 'weatheredPierPlank', ox, 1.35, oz, 0.28, 0, 0.15)
    );
  }
  // Item 027 (Area Expansion): Cửa Vạn floating cultural/schoolhouse pavilion raft (*Nhà Văn Hóa Cửa Vạn*)
  atlasParts.push(
    makeReliefBox(9.2, 0.28, 6.8, 'weatheredPierPlank', 117.0, 0.30, -342.0),
    makeReliefBox(7.2, 2.85, 5.0, 'cuaVanOchrePlank', 117.0, 1.85, -342.0),
    remapRelief(createGableRoofGeometry(8.4, 6.2, 1.45, 0.15, 'x'), 'corrugatedTinRoof').translate(117.0, 3.28, -342.0)
  );

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
  const sandCrescent = remapRelief(new THREE.CylinderGeometry(12.2, 13.8, 0.95, 14), 'goldenBeachSand');
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
      atlasParts.push(
        makeReliefCyl(0.12, 0.14, 2.6, 6, 'weatheredPierPlank', ttX + 6.5 + ox, -0.45, pz),
        // Item 030: Timber handrail posts & mooring cleats along Đảo Ti Tốp arrival jetty
        makeReliefCyl(0.06, 0.07, 1.05, 6, 'weatheredPierPlank', ttX + 6.5 + ox, 1.25, pz)
      );
    }
  }
  for (const oz of [-1.15, 1.15]) {
    atlasParts.push(
      makeReliefCyl(0.12, 0.14, 2.6, 6, 'weatheredPierPlank', ttX + 12.2, -0.45, ttZ + 28.0 + oz)
    );
  }
  // Item 031 & 032: Ti Tốp stone retaining seawall, timber beachside kiosk & cosmonaut memorial stele
  atlasParts.push(
    makeReliefBox(16.0, 0.85, 0.45, 'chateauAshlarStone', ttX - 1.5, 0.62, ttZ + 11.4),
    makeReliefBox(3.4, 2.35, 2.6, 'weatheredPierPlank', ttX - 9.8, 1.65, ttZ + 12.6),
    remapRelief(createGableRoofGeometry(4.0, 3.2, 0.95, 0.14, 'x'), 'corrugatedTinRoof').translate(ttX - 9.8, 2.82, ttZ + 12.6),
    makeReliefBox(1.15, 2.1, 0.42, 'chateauAshlarStone', ttX + 2.6, 1.65, ttZ + 11.6)
  );
  // Item 036: Emerald sea-grass/kelp rock-shelf accents around Đảo Ti Tốp & Cửa Vạn shallows
  for (const [kx, kz] of [[ttX - 12.5, ttZ + 17.5], [ttX + 12.5, ttZ + 18.0], [95.0, -347.5]]) {
    const reef = remapRelief(createSculptedRockGeometry(3601 + Math.round(kx), 1.6, 0.75, 1.4, 1), 'giantHandMossyStone');
    reef.translate(kx, 0.02, kz);
    atlasParts.push(reef);
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
  const tiTopFin = new THREE.SphereGeometry(0.28, 6, 5);
  tiTopFin.translate(ttX, pavY + 7.45, ttZ);
  goldParts.push(tiTopFin);

  // --------------------------------------------------------------------------
  // 6. INSTANCED LUSH TROPICAL KARST FOLIAGE CROWNS (HL-26, HJ-31) - TRUE BOTANICAL LEAF SCALE
  // --------------------------------------------------------------------------
  const cardParts: THREE.BufferGeometry[] = [];
  for (let c = 0; c < 6; c++) {
    const p = new THREE.PlaneGeometry(0.55, 0.46);
    p.translate(0, 0.23, 0);
    p.rotateY((c / 6) * Math.PI);
    p.rotateX((c % 2 === 0 ? 1 : -1) * 0.22);
    cardParts.push(p);
  }
  const foliageGeo = mergeNormalized(cardParts);
  const karstFoliageMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#2a5a26',
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        roughness: 0.82,
        side: THREE.DoubleSide
      })
    : ctx.materials.stone;

  const karstFoliage = new THREE.InstancedMesh(foliageGeo, karstFoliageMat, foliageAnchors.length);
  karstFoliage.name = 'HaLongKarstFoliage';
  const dummy = new THREE.Matrix4();
  const col = new THREE.Color();
  foliageAnchors.forEach((fa, i) => {
    // True botanical scale: clamp card width to realistic shrub clump size (0.6 - 1.15m)
    const fScale = Math.min(1.15, Math.max(0.65, fa.scale * 0.38));
    dummy.compose(
      new THREE.Vector3(fa.x, fa.y, fa.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2),
      new THREE.Vector3(fScale, fScale * 0.85, fScale)
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
    const geo = new THREE.PlaneGeometry(w, h, 6, 6);
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
    { cx: 135, cz: -388, rx: 14, rz: 10, speed: 0.08, phase: 0.4, scale: 1.65 },  // Hero Junk #1 cruising in deep emerald bay framing Cửa Vạn! (depth h = -2.2m)
    { cx: -115, cz: -435, rx: 20, rz: 14, speed: 0.06, phase: 2.1, scale: 1.75 },  // Mid-bay Junk #2 framing Hòn Trống Mái & Đỉnh Hương in deep open water! (h = -2.2m)
    { cx: -165, cz: -495, rx: 22, rz: 15, speed: 0.05, phase: 4.3, scale: 1.60 }   // Outer Bay Junk #3 in deep open bay! (h = -2.2m)
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
      const buoy = remapRelief(new THREE.TorusGeometry(0.20, 0.06, 5, 8), 'corrugatedTinRoof');
      buoy.translate(-0.2, 2.58, sz * 1.06);
      bAtlas.push(buoy);
    }
    // Sun-deck canvas parasol + Item 035: Sun-deck lounge chairs
    bAtlas.push(
      makeReliefCyl(0.04, 0.05, 1.5, 6, 'mahoganyJunkHull', -2.2, 4.15, 0),
      makeReliefCyl(0.08, 1.05, 0.42, 8, 'chateauAshlarStone', -2.2, 4.95, 0),
      makeReliefBox(1.35, 0.18, 0.58, 'weatheredPierPlank', -0.4, 3.58, -0.55),
      makeReliefBox(1.35, 0.18, 0.58, 'weatheredPierPlank', -0.4, 3.58, 0.55)
    );

    // Item 034: Stern rudder blade & bow anchor winch on each Junk Boat
    bAtlas.push(
      makeReliefBox(0.85, 1.25, 0.12, 'mahoganyJunkHull', -4.7, 0.35, 0),
      makeReliefCyl(0.22, 0.22, 0.55, 8, 'mahoganyJunkHull', 4.15, 1.55, 0, 0, Math.PI * 0.5, 0)
    );

    // Twin raked masts + yards + rigging + Item 033: 11-batten sail yards & shrouds + carved dragon prow + warm deck lanterns (HJ-03, HJ-10..11)
    bAtlas.push(
      makeReliefCyl(0.08, 0.13, 7.6, 8, 'mahoganyJunkHull', 0.55, 4.5, 0, 0, 0, 0.06),
      makeReliefCyl(0.06, 0.10, 5.6, 8, 'mahoganyJunkHull', 2.65, 3.6, 0, 0, 0, -0.05),
      makeReliefCyl(0.04, 0.06, 1.6, 6, 'mahoganyJunkHull', 5.2, 1.95, 0, 0, 0, -1.15), // Bowsprit
      // Shroud stays anchoring main mast to deck gunwales
      makeReliefCyl(0.02, 0.02, 6.2, 4, 'mahoganyJunkHull', 0.55, 4.2, -0.58, 0.22, 0, 0),
      makeReliefCyl(0.02, 0.02, 6.2, 4, 'mahoganyJunkHull', 0.55, 4.2, 0.58, -0.22, 0, 0)
    );
    // 11 bamboo battens across main sail
    for (let bt = 0; bt < 11; bt++) {
      const by = 2.25 + bt * 0.44;
      bAtlas.push(makeReliefCyl(0.025, 0.025, 3.4, 4, 'weatheredPierPlank', 0.85, by, 0.12, 0, Math.PI * 0.5, 0.32));
    }
    const prowScroll = new THREE.ConeGeometry(0.22, 0.72, 6);
    prowScroll.rotateZ(-0.65);
    prowScroll.translate(5.15, 1.98, 0);
    bGold.push(prowScroll);
    for (const [lx, ly, lz] of [[4.85, 2.15, 0], [1.95, 2.12, 1.12], [1.95, 2.12, -1.12], [-3.2, 2.12, 0]]) {
      const lOrb = new THREE.SphereGeometry(0.14, 6, 5);
      lOrb.translate(lx, ly, lz);
      bGlow.push(lOrb);
    }

    // Wave 15 Real-Photo Junk Boat Upgrades (castShadow = false):
    // Fore-sail 7 bamboo battens, traditional bow boat-eyes (Mắt Thuyền), stern wooden tiller, masthead gaff spars & cabin window eaves
    const bW15Detail: THREE.BufferGeometry[] = [];
    for (let bt = 0; bt < 7; bt++) {
      const by = 2.05 + bt * 0.44;
      bW15Detail.push(makeReliefCyl(0.022, 0.022, 2.35, 4, 'weatheredPierPlank', 2.85, by, 0.12, 0, Math.PI * 0.5, 0.30));
    }
    // Twin painted wooden boat-eyes (Mắt Thuyền) on port & starboard upturned bow cheeks
    for (const side of [-1, 1]) {
      bW15Detail.push(
        makeReliefCyl(0.18, 0.18, 0.08, 4, 'chateauAshlarStone', 3.95, 1.25, side * 0.62, 0, Math.PI * 0.5, 0),
        // Upper cabin shutter rain-eyebrow eaves
        makeReliefBox(3.55, 0.08, 0.22, 'mahoganyJunkHull', -1.25, 3.28, side * 1.02)
      );
    }
    // Curved stern wooden tiller arm + main & fore masthead gaff yardarm spars
    bW15Detail.push(
      makeReliefBox(1.45, 0.10, 0.12, 'weatheredPierPlank', -4.25, 1.42, 0, 0, 0, 0.18),
      makeReliefBox(1.25, 0.09, 0.09, 'weatheredPierPlank', 0.85, 7.65, 0.08, 0, 0, 0.34),
      makeReliefBox(0.95, 0.08, 0.08, 'weatheredPierPlank', 2.85, 5.85, 0.08, 0, 0, 0.32),
      makeReliefBox(4.8, 0.08, 0.14, 'cuaVanOchrePlank', -0.65, 1.02, 0)
    );

    // Wave 21 Real-Photo Junk Boat Upgrades (castShadow = false, 0 new materials):
    // Detailed bow anchor windlass (cheek stanchions, cast-iron ratchet gear, crank & hanging bow anchor),
    // hexagonal carved-wood stern lanterns (aft eave & stern rail davits), and aft-bulkhead life-rings
    const bW21Detail: THREE.BufferGeometry[] = [];
    // 21.4 Bow anchor windlass assembly seated on foredeck around x = 4.15
    bW21Detail.push(
      makeReliefBox(0.22, 0.44, 0.10, 'mahoganyJunkHull', 4.15, 1.48, -0.32),
      makeReliefBox(0.22, 0.44, 0.10, 'mahoganyJunkHull', 4.15, 1.48, 0.32),
      makeReliefCyl(0.24, 0.24, 0.06, 6, 'greenSteelPier', 4.15, 1.55, -0.30, 0, Math.PI * 0.5, 0),
      makeReliefBox(0.38, 0.06, 0.06, 'greenSteelPier', 4.30, 1.66, -0.36, 0, 0, 0.35),
      // Hanging cast-iron bow anchor shank & flukes flush against starboard bow cheek
      makeReliefBox(0.08, 0.62, 0.08, 'greenSteelPier', 4.34, 1.24, 0.36, 0, 0, -0.14),
      makeReliefBox(0.32, 0.07, 0.07, 'greenSteelPier', 4.36, 1.48, 0.36),
      makeReliefBox(0.34, 0.08, 0.07, 'greenSteelPier', 4.30, 0.96, 0.36, 0, 0, 0.22)
    );

    // 21.5 Traditional hexagonal carved-wood stern lanterns (aft cabin eave brackets + stern quarter davits)
    for (const side of [-1, 1]) {
      // Aft cabin eave lantern bracket & hexagonal lantern frame
      bW21Detail.push(
        makeReliefBox(0.42, 0.07, 0.07, 'mahoganyJunkHull', -3.52, 2.24, side * 0.92),
        makeReliefCyl(0.16, 0.14, 0.07, 5, 'mahoganyJunkHull', -3.68, 2.13, side * 0.92),
        makeReliefCyl(0.14, 0.16, 0.07, 5, 'mahoganyJunkHull', -3.68, 1.83, side * 0.92),
        // Stern quarter lantern davit post & hexagonal lantern frame
        makeReliefCyl(0.04, 0.05, 0.95, 5, 'mahoganyJunkHull', -4.35, 1.82, side * 0.46),
        makeReliefCyl(0.15, 0.13, 0.07, 5, 'mahoganyJunkHull', -4.35, 2.50, side * 0.46),
        makeReliefCyl(0.13, 0.15, 0.07, 5, 'mahoganyJunkHull', -4.35, 2.22, side * 0.46)
      );
      bGlow.push(
        new THREE.CylinderGeometry(0.11, 0.10, 0.24, 6).translate(-3.68, 1.98, side * 0.92),
        new THREE.CylinderGeometry(0.10, 0.09, 0.22, 6).translate(-4.35, 2.36, side * 0.46)
      );
      bGold.push(
        new THREE.ConeGeometry(0.06, 0.16, 5).rotateX(Math.PI).translate(-3.68, 1.72, side * 0.92),
        new THREE.ConeGeometry(0.06, 0.15, 5).translate(-4.35, 2.60, side * 0.46)
      );

      // 21.6 Prominent aft-bulkhead life-rings (life buoys) with grab-line straps & mounting pegs
      const aftRing = remapRelief(new THREE.TorusGeometry(0.22, 0.055, 5, 8), 'corrugatedTinRoof');
      aftRing.rotateY(Math.PI * 0.5);
      aftRing.translate(-2.98, 2.86, side * 0.58);
      bW21Detail.push(
        aftRing,
        makeReliefBox(0.13, 0.08, 0.08, 'chateauAshlarStone', -2.98, 3.08, side * 0.58),
        makeReliefBox(0.13, 0.08, 0.08, 'chateauAshlarStone', -2.98, 2.64, side * 0.58),
        makeReliefBox(0.14, 0.07, 0.07, 'mahoganyJunkHull', -2.93, 2.86, side * 0.58)
      );
    }

    const bAtlasMesh = createMergedMesh(`JunkHull_${idx}`, bAtlas, pack.cauVangHaLongMasterAtlasMat, true, true);
    if (bAtlasMesh) boat.add(bAtlasMesh);
    const bW15Mesh = createMergedMesh(`JunkW15Detail_${idx}`, bW15Detail, pack.cauVangHaLongMasterAtlasMat, false, true);
    if (bW15Mesh) boat.add(bW15Mesh);
    const bW21Mesh = createMergedMesh(`JunkW21Detail_${idx}`, bW21Detail, pack.cauVangHaLongMasterAtlasMat, false, true);
    if (bW21Mesh) boat.add(bW21Mesh);
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

  // ==========================================================================
  // WAVE 2 UPGRADES (Items 221–240): Tùng Sâu Pearl Farm, Oyster Grids,
  // Cửa Vạn Fishing Pier, Watchman Hut, Navigation Buoy, Ti Tốp & Hang Luồn
  // ==========================================================================
  const w2HlAtlas: THREE.BufferGeometry[] = [];
  const w2HlGold: THREE.BufferGeometry[] = [];

  // 221–225: Trang Trại Ngọc Trai Tùng Sâu floating pearl-farm raft, twin-gable pavilion, oyster cultivation grids & kayak launch dock (134, -346)
  const pfX = 134.0;
  const pfZ = -346.0;
  w2HlAtlas.push(
    makeReliefBox(10.5, 0.28, 7.6, 'weatheredPierPlank', pfX, 0.30, pfZ),
    makeReliefBox(7.8, 2.75, 5.2, 'cuaVanTurquoisePlank', pfX, 1.75, pfZ),
    remapRelief(createGableRoofGeometry(9.0, 6.4, 1.45, 0.14, 'x'), 'corrugatedTinRoof').translate(pfX, 3.12, pfZ),
    // 223–224: Parallel oyster-basket cultivation grid floats & suspended cylindrical cage hangers
    makeReliefBox(9.2, 0.16, 0.32, 'weatheredPierPlank', pfX + 1.0, 0.22, pfZ - 6.2),
    makeReliefBox(9.2, 0.16, 0.32, 'weatheredPierPlank', pfX + 1.0, 0.22, pfZ - 9.0),
    makeReliefBox(0.32, 0.16, 3.2, 'weatheredPierPlank', pfX - 3.4, 0.22, pfZ - 7.6),
    makeReliefBox(0.32, 0.16, 3.2, 'weatheredPierPlank', pfX + 5.4, 0.22, pfZ - 7.6),
    // 225: Floating timber kayak launch dock & 3 touring kayaks
    makeReliefBox(2.4, 0.22, 6.4, 'weatheredPierPlank', pfX - 6.4, 0.26, pfZ + 1.5)
  );
  for (let og = 0; og < 4; og++) {
    w2HlAtlas.push(
      makeReliefCyl(0.24, 0.24, 0.85, 5, 'greenSteelPier', pfX - 2.2 + og * 2.1, -0.18, pfZ - 7.6),
      makeReliefCyl(0.06, 0.06, 1.15, 5, 'weatheredPierPlank', pfX - 2.2 + og * 2.1, 0.65, pfZ - 6.2)
    );
  }
  for (let ky = 0; ky < 3; ky++) {
    w2HlAtlas.push(
      makeReliefBox(3.4, 0.24, 0.62, ky === 1 ? 'champagneGoldCladding' : 'cuaVanOchrePlank', pfX - 8.4, 0.18, pfZ - 0.5 + ky * 1.9, 0.12)
    );
  }

  // 226–230, 239: Cửa Vạn main timber fishing pier, bamboo fish-trap creels, net-drying A-frames, rainwater barrels, watchman hut & supply sampan
  w2HlAtlas.push(
    // 226: Cửa Vạn main timber fishing pier extension (92, -356)
    makeReliefBox(2.6, 0.24, 9.8, 'weatheredPierPlank', 92.0, 0.36, -356.0),
    makeReliefCyl(0.10, 0.12, 2.2, 5, 'weatheredPierPlank', 90.9, -0.35, -352.0),
    makeReliefCyl(0.10, 0.12, 2.2, 5, 'weatheredPierPlank', 93.1, -0.35, -360.0),
    // 227: Woven bamboo fish-trap creels & catch crates on pier
    makeReliefCyl(0.32, 0.24, 0.78, 6, 'weatheredPierPlank', 91.6, 0.86, -354.5),
    makeReliefBox(0.75, 0.42, 0.55, 'cuaVanTurquoisePlank', 92.4, 0.68, -357.5),
    // 228: Timber net-drying A-frames along northern Cửa Vạn walkway (supported at both ends on raft deck!)
    makeReliefCyl(0.05, 0.06, 2.4, 5, 'weatheredPierPlank', 105.2, 1.45, -366.8, 0, 0, 0.24),
    makeReliefCyl(0.05, 0.06, 2.4, 5, 'weatheredPierPlank', 105.2, 1.45, -366.8, 0, 0, -0.24),
    makeReliefCyl(0.05, 0.06, 2.4, 5, 'weatheredPierPlank', 109.4, 1.45, -366.8, 0, 0, 0.24),
    makeReliefCyl(0.05, 0.06, 2.4, 5, 'weatheredPierPlank', 109.4, 1.45, -366.8, 0, 0, -0.24),
    makeReliefBox(4.2, 1.45, 0.08, 'greenSteelPier', 107.3, 1.55, -366.8),
    // 229: Rainwater collection barrels & rooftop solar-panel frame
    makeReliefCyl(0.32, 0.32, 0.88, 6, 'slateMansardRoof', 100.8, 0.85, -358.2),
    makeReliefBox(1.85, 0.08, 1.15, 'slateMansardRoof', 108.0, 4.18, -364.0, 0, 0.22, 0),
    // 230: Traditional aquaculture watchman hut (*Nhà Chòi Canh Cá*) at (128, -362)
    makeReliefBox(3.4, 0.22, 3.4, 'weatheredPierPlank', 128.0, 0.30, -362.0),
    makeReliefBox(2.4, 2.0, 2.4, 'cuaVanOchrePlank', 128.0, 1.40, -362.0),
    makeReliefCyl(0.12, 2.15, 1.15, 4, 'corrugatedTinRoof', 128.0, 2.98, -362.0, Math.PI * 0.25),
    // 239: Cargo supply sampan laden with woven baskets near Nhà Văn Hóa Cửa Vạn
    makeReliefBox(4.4, 0.45, 1.35, 'mahoganyJunkHull', 123.5, 0.22, -342.0, 0.18),
    makeReliefCyl(0.34, 0.26, 0.45, 6, 'weatheredPierPlank', 123.5, 0.65, -342.0)
  );

  // 231: Maritime channel navigation buoy (*Phao Tiêu Hàng Hải*) between Hòn Trống Mái & Hòn Đỉnh Hương
  w2HlAtlas.push(
    makeReliefCyl(0.85, 0.95, 0.72, 6, 'corrugatedTinRoof', 4.0, 0.25, -422.0),
    makeReliefCyl(0.18, 0.58, 1.95, 5, 'chateauAshlarStone', 4.0, 1.55, -422.0)
  );
  w2HlGold.push(new THREE.ConeGeometry(0.32, 0.58, 5).translate(4.0, 2.82, -422.0));

  // 232–236, 240: Đảo Ti Tốp gangplanks, lifeguard watchtower, freshwater showers/cabins, halfway stair terrace, summit railing/plaque & coastal driftwood
  w2HlAtlas.push(
    // 232: Boarding gangplanks & fender bumpers along Ti Tốp L-jetty
    makeReliefBox(2.4, 0.16, 1.25, 'weatheredPierPlank', ttX + 4.4, 0.58, ttZ + 25.0, 0, 0, -0.18),
    makeReliefBox(0.28, 0.42, 6.2, 'greenSteelPier', ttX + 9.2, 0.52, ttZ + 29.5),
    // 233: Beachside timber lifeguard watchtower chair (grounded posts connecting base to shade roof!)
    makeReliefBox(1.4, 1.85, 1.4, 'weatheredPierPlank', ttX + 8.8, 1.35, ttZ + 14.5),
    makeReliefCyl(0.05, 0.06, 1.15, 5, 'weatheredPierPlank', ttX + 8.18, 2.72, ttZ + 13.88),
    makeReliefCyl(0.05, 0.06, 1.15, 5, 'weatheredPierPlank', ttX + 9.42, 2.72, ttZ + 13.88),
    makeReliefCyl(0.05, 0.06, 1.15, 5, 'weatheredPierPlank', ttX + 8.18, 2.72, ttZ + 15.12),
    makeReliefCyl(0.05, 0.06, 1.15, 5, 'weatheredPierPlank', ttX + 9.42, 2.72, ttZ + 15.12),
    makeReliefBox(1.65, 0.14, 1.65, 'corrugatedTinRoof', ttX + 8.8, 3.25, ttZ + 14.5),
    // 234: Freshwater shower posts & wooden changing cabins behind seawall
    makeReliefBox(2.8, 2.25, 1.6, 'cuaVanTurquoisePlank', ttX - 5.8, 1.68, ttZ + 10.6),
    makeReliefCyl(0.06, 0.08, 2.2, 5, 'greenSteelPier', ttX - 3.6, 1.65, ttZ + 10.8),
    // 235: Halfway rest-platform terrace with stone benches on Ti Tốp staircase
    makeReliefBox(4.2, 0.55, 3.4, 'chateauAshlarStone', ttX + 1.8, 10.6, ttZ + 6.8),
    makeReliefBox(1.8, 0.45, 0.52, 'chateauAshlarStone', ttX + 3.2, 11.1, ttZ + 6.8),
    // 240: Coastal driftwood logs & shoreline granite boulders at western Ti Tốp beach
    makeReliefCyl(0.22, 0.28, 3.8, 5, 'weatheredPierPlank', ttX - 13.2, 0.42, ttZ + 14.8, 0, 0.42, Math.PI * 0.5),
    makeReliefBox(2.2, 1.15, 1.85, 'haLongDiagonalKarst', ttX - 14.6, 0.52, ttZ + 13.5, 0.35)
  );
  // 236: Brass panoramic railing panels & elevation plaque around Ti Tốp summit pavilion
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    w2HlGold.push(
      new THREE.BoxGeometry(2.2, 0.08, 0.08).rotateY(-a + Math.PI * 0.5).translate(ttX + Math.cos(a) * 3.85, pavY + 1.15, ttZ + Math.sin(a) * 3.85)
    );
  }
  w2HlGold.push(new THREE.BoxGeometry(0.95, 0.55, 0.10).translate(ttX, pavY + 1.45, ttZ + 4.15));

  // 237–238: Hang Luồn floating bamboo-boat waiting pontoon & grotto waterline stalagmite needles (-95, -294)
  w2HlAtlas.push(
    makeReliefBox(6.8, 0.24, 3.2, 'weatheredPierPlank', -95.0, 0.24, -294.0),
    makeReliefBox(3.6, 0.32, 1.05, 'mahoganyJunkHull', -91.5, 0.20, -291.5, 0.25),
    makeReliefCyl(0.14, 0.42, 2.4, 5, 'haLongDiagonalKarst', -97.6, 0.95, -304.0),
    makeReliefCyl(0.14, 0.38, 2.1, 5, 'haLongDiagonalKarst', -92.4, 0.85, -304.0)
  );

  const w2HlAtlasMesh = createMergedMesh('HaLongWave2Atlas', w2HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w2HlAtlasMesh) group.add(w2HlAtlasMesh);
  const w2HlGoldMesh = createMergedMesh('HaLongWave2Gold', w2HlGold, ctx.materials.gold, false, false);
  if (w2HlGoldMesh) group.add(w2HlGoldMesh);

  // ==========================================================================
  // WAVE 3 UPGRADES (Items 441–480): Hang Sửng Sốt Pier & Cliff Stairs,
  // Kayak Coves, Cửa Vạn Fishing Buoys, Ti Tốp Boardwalk & Karst Reefs
  // ==========================================================================
  const w3HlAtlas: THREE.BufferGeometry[] = [];
  const w3HlGold: THREE.BufferGeometry[] = [];
  const w3HlLeaf: THREE.BufferGeometry[] = [];

  // 441–446: Bến Tàu Hang Sửng Sốt (Surprise Cave arrival pier, boarding shelter, cliffside stairs & cave overhang at -118, -342)
  const ssX = -118.0;
  const ssZ = -342.0;
  w3HlAtlas.push(
    // 441–442: Timber arrival pier deck & deep submerged pilings
    makeReliefBox(10.5, 0.28, 3.8, 'weatheredPierPlank', ssX, 0.42, ssZ),
    makeReliefCyl(0.12, 0.14, 2.4, 5, 'weatheredPierPlank', ssX - 4.4, -0.55, ssZ - 1.5),
    makeReliefCyl(0.12, 0.14, 2.4, 5, 'weatheredPierPlank', ssX - 4.4, -0.55, ssZ + 1.5),
    makeReliefCyl(0.12, 0.14, 2.4, 5, 'weatheredPierPlank', ssX + 4.4, -0.55, ssZ - 1.5),
    makeReliefCyl(0.12, 0.14, 2.4, 5, 'weatheredPierPlank', ssX + 4.4, -0.55, ssZ + 1.5),
    // 443: Covered wooden ticket & boarding shelter with 4 grounded posts
    makeReliefBox(3.8, 0.16, 2.8, 'corrugatedTinRoof', ssX + 2.2, 3.02, ssZ),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ssX + 0.5, 1.65, ssZ - 1.2),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ssX + 3.9, 1.65, ssZ - 1.2),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ssX + 0.5, 1.65, ssZ + 1.2),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ssX + 3.9, 1.65, ssZ + 1.2),
    // 444–446: Cliffside stone karst plinth, zigzagging stone stairs, midway viewing balcony & cave-mouth arch overhang
    makeReliefBox(9.5, 10.5, 8.8, 'haLongDiagonalKarst', ssX - 9.8, 4.8, ssZ),
    makeReliefBox(5.2, 0.55, 2.4, 'chateauAshlarStone', ssX - 6.8, 1.65, ssZ + 1.4, 0, 0, -0.32),
    makeReliefBox(4.2, 0.55, 2.6, 'chateauAshlarStone', ssX - 6.2, 3.85, ssZ - 1.2),
    makeReliefBox(4.4, 0.85, 0.24, 'chateauAshlarStone', ssX - 6.2, 4.45, ssZ - 2.35),
    makeReliefBox(6.4, 1.45, 5.2, 'haLongDiagonalKarst', ssX - 9.2, 9.6, ssZ),
    makeReliefCyl(0.12, 0.34, 1.85, 5, 'haLongDiagonalKarst', ssX - 6.8, 8.2, ssZ - 1.2),
    makeReliefCyl(0.12, 0.34, 1.65, 5, 'haLongDiagonalKarst', ssX - 6.8, 8.3, ssZ + 1.2)
  );

  // 447–451: Vịnh Chèo Kayak Hạ Long floating kayak cove pontoon, guide rails, 4 touring kayaks, paddle rack & safety tender (-82, -312)
  const kcX = -82.0;
  const kcZ = -312.0;
  w3HlAtlas.push(
    makeReliefBox(7.8, 0.24, 3.2, 'weatheredPierPlank', kcX, 0.26, kcZ),
    makeReliefBox(1.2, 0.18, 3.4, 'weatheredPierPlank', kcX - 2.6, 0.24, kcZ + 3.0),
    makeReliefBox(1.2, 0.18, 3.4, 'weatheredPierPlank', kcX + 2.6, 0.24, kcZ + 3.0),
    // 450: Wooden paddle-rack & life-jacket frame with 2 grounded posts
    makeReliefCyl(0.06, 0.07, 1.85, 5, 'weatheredPierPlank', kcX - 2.2, 1.15, kcZ - 1.1),
    makeReliefCyl(0.06, 0.07, 1.85, 5, 'weatheredPierPlank', kcX + 2.2, 1.15, kcZ - 1.1),
    makeReliefBox(4.6, 0.12, 0.12, 'weatheredPierPlank', kcX, 1.98, kcZ - 1.1),
    // 451: Moored bamboo-canopy safety tender boat
    makeReliefBox(4.2, 0.45, 1.35, 'mahoganyJunkHull', kcX + 5.8, 0.24, kcZ + 1.2, 0.16),
    makeReliefBox(2.4, 0.85, 1.18, 'corrugatedTinRoof', kcX + 5.8, 0.88, kcZ + 1.2, 0.16)
  );
  // 449: 4 colorful touring kayaks staged at Kayak Cove
  for (let ky = 0; ky < 4; ky++) {
    w3HlAtlas.push(
      makeReliefBox(3.1, 0.22, 0.58, ky % 2 === 0 ? 'cuaVanOchrePlank' : 'cuaVanTurquoisePlank', kcX - 2.8 + ky * 1.85, 0.22, kcZ + 2.8, Math.PI * 0.5)
    );
  }

  // 452–460, 477–478: Cửa Vạn perimeter fishing buoys, walkway bridges, net-pen posts, sorting table, Nhà Văn Hóa ramp, Tùng Sâu secondary oyster floats & pier floats
  for (let bu = 0; bu < 8; bu++) {
    const ba = (bu / 8) * Math.PI * 2;
    const bx = 112.0 + Math.cos(ba) * 24.0;
    const bz = -354.0 + Math.sin(ba) * 18.0;
    w3HlAtlas.push(makeReliefCyl(0.32, 0.36, 0.48, 5, bu % 2 === 0 ? 'corrugatedTinRoof' : 'cuaVanOchrePlank', bx, 0.22, bz));
  }
  w3HlAtlas.push(
    // 453: Floating walkway bridge connecting Cửa Vạn inner houses to watchman hut
    makeReliefBox(14.5, 0.20, 1.45, 'weatheredPierPlank', 119.5, 0.28, -361.5),
    // 454: Net-pen timber corner guide posts & taut beams
    makeReliefCyl(0.08, 0.09, 2.2, 5, 'weatheredPierPlank', 116.0, 0.45, -356.0),
    makeReliefCyl(0.08, 0.09, 2.2, 5, 'weatheredPierPlank', 124.0, 0.45, -356.0),
    makeReliefBox(8.2, 0.12, 0.12, 'weatheredPierPlank', 120.0, 1.38, -356.0),
    // 455–456: Veranda potted plants, fish-sorting table & stacked baskets
    makeReliefBox(1.85, 0.78, 0.85, 'weatheredPierPlank', 92.2, 0.78, -353.0),
    makeReliefCyl(0.28, 0.22, 0.38, 5, 'cuaVanOchrePlank', 92.2, 1.32, -353.0),
    // 457: Nhà Văn Hóa Cửa Vạn boarding ramp & twin lantern posts
    makeReliefBox(2.6, 0.20, 3.2, 'weatheredPierPlank', 118.5, 0.34, -345.0),
    makeReliefCyl(0.06, 0.07, 2.15, 5, 'weatheredPierPlank', 117.3, 1.35, -343.6),
    makeReliefCyl(0.06, 0.07, 2.15, 5, 'weatheredPierPlank', 119.7, 1.35, -343.6),
    // 458–460: Tùng Sâu pearl-harvest table, secondary oyster float array & dockside mooring bollards
    makeReliefBox(2.2, 0.78, 0.95, 'weatheredPierPlank', pfX + 1.2, 0.82, pfZ + 2.8),
    makeReliefBox(8.4, 0.16, 0.32, 'weatheredPierPlank', pfX + 10.2, 0.22, pfZ - 4.2),
    makeReliefBox(8.4, 0.16, 0.32, 'weatheredPierPlank', pfX + 10.2, 0.22, pfZ - 7.0),
    makeReliefCyl(0.16, 0.18, 0.58, 5, 'greenSteelPier', pfX - 5.2, 0.58, pfZ + 4.2),
    // 477–478: Fishing-gear drying poles & cylindrical drum raft floats along Cửa Vạn pier
    makeReliefCyl(0.05, 0.06, 2.6, 5, 'weatheredPierPlank', 90.8, 1.58, -358.8),
    makeReliefCyl(0.28, 0.28, 0.85, 5, 'cuaVanTurquoisePlank', 90.8, 0.08, -356.0, 0, 0, Math.PI * 0.5),
    makeReliefCyl(0.28, 0.28, 0.85, 5, 'cuaVanTurquoisePlank', 93.2, 0.08, -356.0, 0, 0, Math.PI * 0.5)
  );
  w3HlGold.push(
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(117.3, 2.48, -343.6),
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(119.7, 2.48, -343.6)
  );

  // 461–463: 3 Hạ Long bay junk-boat channel tender mooring rafts with stern lantern posts & deck crates
  for (const [jx, jz] of [[-38.0, -365.0], [24.0, -385.0], [62.0, -355.0]] as const) {
    w3HlAtlas.push(
      makeReliefBox(4.6, 0.38, 1.85, 'mahoganyJunkHull', jx, 0.22, jz, 0.14),
      makeReliefBox(0.85, 0.55, 0.65, 'weatheredPierPlank', jx + 0.6, 0.65, jz),
      makeReliefCyl(0.05, 0.06, 2.15, 5, 'weatheredPierPlank', jx - 1.8, 1.25, jz)
    );
    w3HlGold.push(new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(jx - 1.8, 2.38, jz));
  }

  // 464–469, 479: Đảo Ti Tốp coastal boardwalk, 4-post beachfront pergola, jetty cleats/beacon, upper stair landing, summit finial & western cove boulders
  w3HlAtlas.push(
    // 464: Eastern crescent beach timber boardwalk
    makeReliefBox(10.5, 0.24, 2.1, 'weatheredPierPlank', ttX + 12.2, 0.68, ttZ + 12.5),
    // 465: Shaded beachfront timber pergola with 4 grounded posts & bench
    makeReliefBox(4.2, 0.16, 3.2, 'weatheredPierPlank', ttX + 12.5, 3.25, ttZ + 11.2),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ttX + 10.6, 1.85, ttZ + 9.8),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ttX + 14.4, 1.85, ttZ + 9.8),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ttX + 10.6, 1.85, ttZ + 12.6),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'weatheredPierPlank', ttX + 14.4, 1.85, ttZ + 12.6),
    makeReliefBox(2.2, 0.45, 0.58, 'weatheredPierPlank', ttX + 12.5, 1.02, ttZ + 11.2),
    // 467: Ti Tốp upper stair stone rest-landing (y ~ 16.5m)
    makeReliefBox(3.8, 0.55, 3.0, 'chateauAshlarStone', ttX + 1.2, 16.5, ttZ + 4.4),
    // 469 & 479: Western rocky cove limestone boulders & beach plaza driftwood bench + bay-map board
    makeReliefBox(2.6, 1.35, 2.1, 'haLongDiagonalKarst', ttX - 16.2, 0.65, ttZ + 11.8, 0.28),
    makeReliefBox(2.0, 0.45, 0.55, 'weatheredPierPlank', ttX - 8.5, 0.85, ttZ + 12.8),
    makeReliefBox(1.25, 1.45, 0.18, 'weatheredPierPlank', ttX - 2.4, 1.45, ttZ + 12.8)
  );
  // 466 & 468: L-jetty brass mooring cleats, solar pier-end beacon & Ti Tốp summit gilded plaque finial
  w3HlGold.push(
    new THREE.CylinderGeometry(0.12, 0.14, 0.35, 5).translate(ttX + 8.8, 0.85, ttZ + 26.5),
    new THREE.CylinderGeometry(0.06, 0.08, 2.45, 5).translate(ttX + 9.0, 1.95, ttZ + 32.8),
    new THREE.ConeGeometry(0.28, 0.42, 5).translate(ttX + 9.0, 3.28, ttZ + 32.8),
    new THREE.ConeGeometry(0.32, 0.65, 5).translate(ttX, pavY + 1.88, ttZ + 4.15)
  );

  // 470–476, 480: Hòn Trống Mái & Hòn Đỉnh Hương reef shelves, protective buoys, Hang Luồn stalactite teeth & sampans, horizon sea-stack islets & green starboard buoy
  w3HlAtlas.push(
    // 470–471: Hòn Trống Mái reef shoal stones & protective buoy
    makeReliefBox(3.4, 1.15, 2.6, 'haLongDiagonalKarst', -24.5, 0.35, -408.0, 0.42),
    makeReliefCyl(0.55, 0.62, 0.65, 5, 'cuaVanOchrePlank', -16.0, 0.25, -402.0),
    // 472: Hòn Đỉnh Hương basal reef shelf
    makeReliefBox(4.2, 1.05, 3.2, 'haLongDiagonalKarst', 28.0, 0.32, -434.0, -0.35),
    // 473–475: Hang Luồn stalactite teeth, pontoon ticket counter & 2 moored rowing sampans
    makeReliefCyl(0.10, 0.32, 1.85, 5, 'haLongDiagonalKarst', -95.0, 5.2, -310.0),
    makeReliefBox(1.85, 1.45, 1.15, 'cuaVanTurquoisePlank', -97.2, 1.02, -294.0),
    makeReliefBox(3.4, 0.34, 0.98, 'mahoganyJunkHull', -88.2, 0.20, -295.0, 0.32),
    makeReliefBox(3.4, 0.34, 0.98, 'mahoganyJunkHull', -86.4, 0.20, -292.5, 0.18),
    // 480: Green starboard channel buoy opposite red channel buoy (-12, -422)
    makeReliefCyl(0.82, 0.92, 0.72, 6, 'greenSteelPier', -12.0, 0.25, -422.0),
    makeReliefCyl(0.18, 0.55, 1.85, 5, 'chateauAshlarStone', -12.0, 1.50, -422.0)
  );
  // 476: Northern horizon limestone sea-stack islets with emerald foliage crowns
  for (const [ix, iz, ih] of [[-78, -540, 14.5], [18, -565, 18.0], [96, -548, 15.5]] as const) {
    w3HlAtlas.push(makeReliefCyl(3.4, 6.2, ih, 6, 'haLongDiagonalKarst', ix, ih * 0.45, iz));
    const crown = new THREE.ConeGeometry(4.8, 4.2, 5).translate(ix, ih * 0.92 + 1.8, iz);
    colorizeGeo(crown, 0x1e5628);
    w3HlLeaf.push(crown);
  }

  const w3HlAtlasMesh = createMergedMesh('HaLongWave3Atlas', w3HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w3HlAtlasMesh) group.add(w3HlAtlasMesh);
  const w3HlGoldMesh = createMergedMesh('HaLongWave3Gold', w3HlGold, ctx.materials.gold, false, false);
  if (w3HlGoldMesh) group.add(w3HlGoldMesh);
  const w3HlLeafMesh = createMergedMesh('HaLongWave3Leaf', w3HlLeaf, foliageMat, false, false);
  if (w3HlLeafMesh) group.add(w3HlLeafMesh);

  // ==========================================================================
  // WAVE 4 UPGRADES (Items 841–880): Vung Viêng Floating Village, Hạ Long
  // Maritime Lighthouse, Cửa Vạn Seafood Market & Ti Tốp Kayak Cove
  // ==========================================================================
  const w4HlAtlas: THREE.BufferGeometry[] = [];
  const w4HlGold: THREE.BufferGeometry[] = [];
  const w4HlLeaf: THREE.BufferGeometry[] = [];

  // 841–846: Làng Chài Vung Viêng floating welcome gatehouse, community hall, cottages, net-pens & coracles (68, -378)
  const vvX = 68.0;
  const vvZ = -378.0;
  w4HlAtlas.push(
    // 841: Welcome gatehouse raft (76, -374) with 4 grounded posts & flush roof
    makeReliefBox(5.6, 0.24, 4.4, 'weatheredPierPlank', 76.0, 0.28, -374.0),
    makeReliefCyl(0.10, 0.12, 3.0, 5, 'weatheredPierPlank', 73.6, 1.78, -375.8),
    makeReliefCyl(0.10, 0.12, 3.0, 5, 'weatheredPierPlank', 78.4, 1.78, -375.8),
    makeReliefCyl(0.10, 0.12, 3.0, 5, 'weatheredPierPlank', 73.6, 1.78, -372.2),
    makeReliefCyl(0.10, 0.12, 3.0, 5, 'weatheredPierPlank', 78.4, 1.78, -372.2),
    makeReliefBox(6.2, 0.35, 5.0, 'corrugatedTinRoof', 76.0, 3.35, -374.0),
    // 842–843: Community hall raft (68, -378) & connecting walkway
    makeReliefBox(7.8, 0.26, 5.8, 'weatheredPierPlank', vvX, 0.28, vvZ),
    makeReliefBox(5.6, 2.55, 4.0, 'cuaVanOchrePlank', vvX, 1.65, vvZ),
    makeReliefBox(6.4, 0.65, 4.8, 'corrugatedTinRoof', vvX, 3.18, vvZ),
    makeReliefBox(5.2, 0.16, 1.35, 'weatheredPierPlank', 72.0, 0.30, -376.0, 0.45),
    // 844: 2 floating turquoise fishermen's cottages
    makeReliefBox(5.2, 0.24, 4.4, 'weatheredPierPlank', 60.0, 0.26, -372.0),
    makeReliefBox(3.8, 2.15, 3.2, 'cuaVanTurquoisePlank', 60.0, 1.42, -372.0),
    makeReliefBox(4.4, 0.55, 3.8, 'corrugatedTinRoof', 60.0, 2.72, -372.0),
    makeReliefBox(5.2, 0.24, 4.4, 'weatheredPierPlank', 72.0, 0.26, -386.0),
    makeReliefBox(3.8, 2.15, 3.2, 'cuaVanTurquoisePlank', 72.0, 1.42, -386.0),
    makeReliefBox(4.4, 0.55, 3.8, 'corrugatedTinRoof', 72.0, 2.72, -386.0),
    // 845–846: Net-pen frames, 2 bamboo coracles & rowing sampan
    makeReliefBox(4.6, 0.16, 0.28, 'weatheredPierPlank', vvX - 1.5, 0.22, vvZ - 4.8),
    makeReliefBox(4.6, 0.16, 0.28, 'weatheredPierPlank', vvX - 1.5, 0.22, vvZ - 7.4),
    makeReliefCyl(0.75, 0.48, 0.38, 6, 'weatheredPierPlank', 79.8, 0.20, -373.5),
    makeReliefCyl(0.75, 0.48, 0.38, 6, 'weatheredPierPlank', 79.5, 0.20, -376.0),
    makeReliefBox(4.2, 0.36, 1.05, 'mahoganyJunkHull', 76.0, 0.20, -369.5, 0.22)
  );

  // 847–850: Hải Đăng Vịnh Hạ Long (Hạ Long Maritime Lighthouse on karst plinth at -54, -362)
  const lhX = -54.0;
  const lhZ = -362.0;
  w4HlAtlas.push(
    makeReliefCyl(4.4, 5.6, 3.6, 6, 'haLongDiagonalKarst', lhX, 0.8, lhZ),
    makeReliefCyl(1.15, 1.65, 11.0, 6, 'chateauAshlarStone', lhX, 7.9, lhZ),
    makeReliefCyl(1.68, 1.55, 0.42, 6, 'chateauAshlarStone', lhX, 13.5, lhZ),
    makeReliefCyl(0.18, 1.45, 1.65, 6, 'corrugatedTinRoof', lhX, 15.65, lhZ),
    // 850: Keeper's stone cottage & timber supply jetty
    makeReliefBox(3.8, 2.35, 3.2, 'chateauAshlarStone', lhX + 3.2, 3.65, lhZ + 1.8),
    makeReliefBox(4.4, 0.55, 3.8, 'corrugatedTinRoof', lhX + 3.2, 5.05, lhZ + 1.8),
    makeReliefBox(2.2, 0.24, 5.6, 'weatheredPierPlank', lhX + 3.2, 0.45, lhZ + 6.4)
  );
  w4HlGold.push(new THREE.CylinderGeometry(0.95, 0.95, 1.25, 6).translate(lhX, 14.3, lhZ));

  // 851–863: Hang Sửng Sốt upper gazebo & tender, Kayak Cove rest-platform & buoys, Cửa Vạn Seafood Market & solar pontoon, Tùng Sâu work-barge
  w4HlAtlas.push(
    // 851–853: Hang Sửng Sốt upper viewing gazebo (-124, -342), pier bollards & moored tender
    makeReliefBox(3.8, 0.22, 3.4, 'weatheredPierPlank', ssX - 6.0, 6.25, ssZ),
    makeReliefBox(4.2, 0.24, 3.8, 'corrugatedTinRoof', ssX - 6.0, 9.15, ssZ),
    makeReliefCyl(0.08, 0.09, 2.95, 5, 'weatheredPierPlank', ssX - 7.6, 7.72, ssZ - 1.4),
    makeReliefCyl(0.08, 0.09, 2.95, 5, 'weatheredPierPlank', ssX - 4.4, 7.72, ssZ - 1.4),
    makeReliefCyl(0.08, 0.09, 2.95, 5, 'weatheredPierPlank', ssX - 7.6, 7.72, ssZ + 1.4),
    makeReliefCyl(0.08, 0.09, 2.95, 5, 'weatheredPierPlank', ssX - 4.4, 7.72, ssZ + 1.4),
    makeReliefBox(4.4, 0.42, 1.45, 'mahoganyJunkHull', ssX + 6.8, 0.24, ssZ + 1.8, 0.18),
    // 854–855: Kayak Cove rest-platform & 3 channel buoys
    makeReliefBox(3.6, 0.24, 3.2, 'weatheredPierPlank', kcX - 7.5, 0.26, kcZ + 4.5),
    makeReliefCyl(0.06, 0.07, 2.2, 5, 'weatheredPierPlank', kcX - 7.5, 1.38, kcZ + 4.5),
    makeReliefCyl(0.14, 1.25, 0.48, 6, 'cuaVanOchrePlank', kcX - 7.5, 2.55, kcZ + 4.5),
    // 856–860: Cửa Vạn floating seafood market raft (96, -342), solar pontoon & slipway
    makeReliefBox(6.8, 0.26, 4.8, 'weatheredPierPlank', 96.0, 0.28, -342.0),
    makeReliefBox(5.6, 0.18, 3.8, 'corrugatedTinRoof', 96.0, 3.05, -342.0),
    makeReliefCyl(0.08, 0.09, 2.85, 5, 'weatheredPierPlank', 93.4, 1.65, -343.6),
    makeReliefCyl(0.08, 0.09, 2.85, 5, 'weatheredPierPlank', 98.6, 1.65, -343.6),
    makeReliefCyl(0.08, 0.09, 2.85, 5, 'weatheredPierPlank', 93.4, 1.65, -340.4),
    makeReliefCyl(0.08, 0.09, 2.85, 5, 'weatheredPierPlank', 98.6, 1.65, -340.4),
    makeReliefBox(2.8, 0.72, 1.15, 'cuaVanTurquoisePlank', 96.0, 0.76, -342.0),
    makeReliefBox(4.2, 0.22, 3.2, 'slateMansardRoof', 106.0, 0.35, -341.5),
    makeReliefBox(4.4, 0.18, 2.2, 'weatheredPierPlank', 129.0, 0.34, -352.0, 0, 0, 0.14),
    // 861–862: Tùng Sâu floating work-barge with crane davit
    makeReliefBox(5.2, 0.38, 2.4, 'mahoganyJunkHull', pfX + 8.5, 0.28, pfZ + 2.5),
    makeReliefCyl(0.07, 0.09, 2.8, 5, 'greenSteelPier', pfX + 8.5, 1.68, pfZ + 2.5, 0, 0, -0.35)
  );
  for (let kb = 0; kb < 3; kb++) {
    w4HlAtlas.push(makeReliefCyl(0.28, 0.32, 0.45, 5, 'corrugatedTinRoof', kcX - 11.0 + kb * 6.5, 0.22, kcZ + 11.5));
  }

  // 864–880: Đảo Ti Tốp western kayak dock, coconut bar kiosk, beach net, arch, summit bench, mid-bay rafts, beacons & horizon sea-stacks
  w4HlAtlas.push(
    // 864–865: Ti Tốp western kayak launch dock (118, -402) & 3 kayaks
    makeReliefBox(6.4, 0.24, 2.6, 'weatheredPierPlank', 118.0, 0.32, -402.0),
    makeReliefBox(3.0, 0.22, 0.56, 'cuaVanOchrePlank', 116.0, 0.24, -399.5, 0.2),
    makeReliefBox(3.0, 0.22, 0.56, 'cuaVanTurquoisePlank', 118.5, 0.24, -399.5, 0.2),
    makeReliefBox(3.0, 0.22, 0.56, 'champagneGoldCladding', 121.0, 0.24, -399.5, 0.2),
    // 866–868: Ti Tốp beachside coconut bar kiosk (4 grounded posts), volleyball net posts & lower stair arch
    makeReliefBox(3.2, 0.85, 2.2, 'weatheredPierPlank', ttX - 5.2, 1.05, ttZ + 14.5),
    makeReliefBox(3.6, 0.20, 2.6, 'corrugatedTinRoof', ttX - 5.2, 3.15, ttZ + 14.5),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', ttX - 6.7, 1.85, ttZ + 13.4),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', ttX - 3.7, 1.85, ttZ + 13.4),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', ttX - 6.7, 1.85, ttZ + 15.6),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', ttX - 3.7, 1.85, ttZ + 15.6),
    makeReliefCyl(0.06, 0.07, 2.4, 5, 'weatheredPierPlank', ttX + 5.2, 1.55, ttZ + 17.5),
    makeReliefCyl(0.06, 0.07, 2.4, 5, 'weatheredPierPlank', ttX + 9.2, 1.55, ttZ + 17.5),
    makeReliefBox(4.2, 0.08, 0.08, 'weatheredPierPlank', ttX + 7.2, 2.65, ttZ + 17.5),
    makeReliefBox(2.8, 0.26, 0.35, 'chateauAshlarStone', ttX, 3.45, ttZ + 11.4),
    // 872–875: Hang Luồn pontoon shelter (4 posts), barrier boom, mid-bay fish raft & Thuyền Mành cargo junk
    makeReliefBox(3.6, 0.18, 2.6, 'corrugatedTinRoof', -95.0, 2.85, -294.0),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', -96.6, 1.52, -295.1),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', -93.4, 1.52, -295.1),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', -96.6, 1.52, -292.9),
    makeReliefCyl(0.07, 0.08, 2.65, 5, 'weatheredPierPlank', -93.4, 1.52, -292.9),
    makeReliefBox(5.2, 0.22, 3.8, 'weatheredPierPlank', 46.0, 0.24, -370.0),
    makeReliefBox(6.8, 0.65, 2.2, 'mahoganyJunkHull', 52.0, 0.35, -392.0, 0.35),
    makeReliefCyl(0.08, 0.11, 5.2, 5, 'mahoganyJunkHull', 52.0, 2.95, -392.0),
    // 876–880: Port/starboard navigation beacons, Hòn Cổng Trời sea-arch, Hòn Đôi islets & mid-bay kayak rest raft
    makeReliefCyl(0.65, 0.95, 3.6, 5, 'corrugatedTinRoof', -68.0, 1.65, -398.0),
    makeReliefCyl(0.65, 0.95, 3.6, 5, 'greenSteelPier', 84.0, 1.65, -418.0),
    makeReliefCyl(2.8, 4.2, 12.0, 6, 'haLongDiagonalKarst', -36.0, 5.5, -530.0),
    makeReliefCyl(2.8, 4.2, 12.0, 6, 'haLongDiagonalKarst', -28.0, 5.5, -530.0),
    makeReliefBox(10.5, 2.8, 4.2, 'haLongDiagonalKarst', -32.0, 11.2, -530.0),
    makeReliefCyl(3.2, 5.4, 15.0, 6, 'haLongDiagonalKarst', 160.0, 7.0, -515.0),
    makeReliefCyl(2.8, 4.8, 12.5, 6, 'haLongDiagonalKarst', 170.0, 5.8, -515.0),
    makeReliefBox(4.2, 0.24, 3.4, 'weatheredPierPlank', 14.0, 0.24, -375.0)
  );
  w4HlGold.push(
    new THREE.ConeGeometry(0.32, 0.65, 5).translate(-68.0, 3.75, -398.0),
    new THREE.ConeGeometry(0.32, 0.65, 5).translate(84.0, 3.75, -418.0),
    new THREE.CylinderGeometry(0.06, 0.08, 1.15, 5).translate(ttX + 1.4, pavY + 1.15, ttZ + 1.8)
  );
  for (const [fx, fy, fz] of [[-32.0, 13.8, -530.0], [160.0, 15.5, -515.0], [170.0, 13.2, -515.0]] as const) {
    const crown = new THREE.ConeGeometry(3.8, 3.6, 5).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w4HlLeaf.push(crown);
  }

  const w4HlAtlasMesh = createMergedMesh('HaLongWave4Atlas', w4HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w4HlAtlasMesh) group.add(w4HlAtlasMesh);
  const w4HlGoldMesh = createMergedMesh('HaLongWave4Gold', w4HlGold, ctx.materials.gold, false, false);
  if (w4HlGoldMesh) group.add(w4HlGoldMesh);
  const w4HlLeafMesh = createMergedMesh('HaLongWave4Leaf', w4HlLeaf, foliageMat, false, false);
  if (w4HlLeafMesh) group.add(w4HlLeafMesh);

  // ==========================================================================
  // WAVE 5 UPGRADES (Items 1241–1280): Eastern Pearl-Cultivation Rafts,
  // Ba Hang Floating Cove, Tuần Châu Heritage Cruise Anchorage & Karst Stacks
  // ==========================================================================
  const w5HlAtlas: THREE.BufferGeometry[] = [];
  const w5HlGold: THREE.BufferGeometry[] = [];
  const w5HlLeaf: THREE.BufferGeometry[] = [];

  // 1241–1248: Trại Ngọc Trai Đông Vịnh (Eastern Floating Pearl-Cultivation Raft Complex at 32, -346)
  const epX = 32.0;
  const epZ = -346.0;
  w5HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.4, 'weatheredPierPlank', epX, 0.28, epZ),
    makeReliefBox(4.8, 0.22, 3.8, 'corrugatedTinRoof', epX - 0.8, 3.12, epZ),
    makeReliefBox(3.4, 0.18, 0.18, 'weatheredPierPlank', epX + 2.4, 2.65, epZ),
    makeReliefCyl(0.08, 0.10, 2.65, 5, 'weatheredPierPlank', epX + 2.4, 1.38, epZ - 1.5),
    makeReliefCyl(0.08, 0.10, 2.65, 5, 'weatheredPierPlank', epX + 2.4, 1.38, epZ + 1.5),
    // 1244, 1246–1247: Nursery catwalks, fresh-water tank barge & pearl-harvester sampan
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', epX + 6.2, 0.26, epZ),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', epX - 6.2, 0.26, epZ),
    makeReliefBox(4.0, 0.42, 2.2, 'cuaVanTurquoisePlank', epX, 0.34, epZ - 4.4),
    makeReliefBox(4.2, 0.38, 1.15, 'mahoganyJunkHull', epX + 1.5, 0.22, epZ + 4.2, 0.18)
  );
  for (const ox of [-2.8, 1.2]) {
    for (const oz of [-1.6, 1.6]) {
      w5HlAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 5, 'weatheredPierPlank', epX + ox, 1.62, epZ + oz));
    }
  }
  for (let fb = 0; fb < 6; fb++) {
    w5HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.36, 5, 'cuaVanOchrePlank', epX + 4.5 + (fb % 3) * 2.2, 0.20, epZ + (fb < 3 ? -2.4 : 2.4)));
  }
  w5HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 5).translate(epX - 3.4, 2.25, epZ + 2.4));

  // 1249–1256: Làng Chài Ba Hang Floating Karst Cove Hamlet at (-26, -344)
  const bhX = -26.0;
  const bhZ = -344.0;
  w5HlAtlas.push(
    makeReliefBox(5.6, 0.24, 4.6, 'weatheredPierPlank', bhX, 0.26, bhZ),
    makeReliefBox(4.0, 2.25, 3.2, 'cuaVanTurquoisePlank', bhX, 1.48, bhZ),
    makeReliefBox(4.6, 0.55, 3.8, 'corrugatedTinRoof', bhX, 2.82, bhZ),
    // 1250–1251: Net-mending ochre raft, connecting catwalk & fish-drying frame
    makeReliefBox(5.2, 0.24, 4.0, 'cuaVanOchrePlank', bhX + 7.2, 0.26, bhZ + 1.5),
    makeReliefBox(2.4, 0.16, 1.15, 'weatheredPierPlank', bhX + 3.6, 0.28, bhZ + 0.8),
    makeReliefBox(3.4, 0.08, 0.08, 'weatheredPierPlank', bhX + 7.2, 1.85, bhZ + 2.8),
    // 1252–1254: Moored wooden fishing trawler, 2 coracles & fish-cage pen
    makeReliefBox(6.4, 0.58, 2.0, 'mahoganyJunkHull', bhX - 5.8, 0.32, bhZ + 2.2, -0.25),
    makeReliefBox(2.2, 1.45, 1.55, 'cuaVanOchrePlank', bhX - 5.8, 1.25, bhZ + 2.2, -0.25),
    makeReliefCyl(0.07, 0.09, 4.4, 5, 'weatheredPierPlank', bhX - 5.8, 2.65, bhZ + 2.2),
    makeReliefCyl(0.72, 0.46, 0.36, 6, 'weatheredPierPlank', bhX - 1.2, 0.20, bhZ + 3.8),
    makeReliefCyl(0.72, 0.46, 0.36, 6, 'weatheredPierPlank', bhX + 1.2, 0.20, bhZ + 3.8),
    makeReliefBox(4.2, 0.16, 0.24, 'weatheredPierPlank', bhX + 7.2, 0.22, bhZ - 2.6)
  );

  // 1257–1264: Bến Du Thuyền Tuần Châu Karst Anchorage & 2-Deck Heritage Cruise Junk (-96, -384)
  const tcX = -96.0;
  const tcZ = -384.0;
  w5HlAtlas.push(
    makeReliefBox(8.6, 0.26, 3.2, 'weatheredPierPlank', tcX, 0.32, tcZ),
    makeReliefBox(3.6, 0.20, 2.6, 'corrugatedTinRoof', tcX - 1.8, 3.05, tcZ),
    // 1260–1262: 2-deck heritage cruise junk & supply pontoon
    makeReliefBox(10.8, 1.15, 3.2, 'mahoganyJunkHull', tcX + 1.5, 0.62, tcZ + 4.8),
    makeReliefBox(7.4, 1.65, 2.6, 'chateauAshlarStone', tcX + 1.5, 1.95, tcZ + 4.8),
    makeReliefBox(6.8, 0.22, 2.4, 'weatheredPierPlank', tcX + 1.5, 2.88, tcZ + 4.8),
    makeReliefCyl(0.09, 0.12, 6.2, 5, 'mahoganyJunkHull', tcX + 1.5, 4.2, tcZ + 4.8),
    makeReliefBox(4.2, 0.24, 2.4, 'weatheredPierPlank', tcX - 5.2, 0.28, tcZ + 4.2),
    // 1263: Entrance channel spar buoys
    makeReliefCyl(0.32, 0.38, 1.65, 5, 'corrugatedTinRoof', tcX + 8.5, 0.82, tcZ + 9.2),
    makeReliefCyl(0.32, 0.38, 1.65, 5, 'greenSteelPier', tcX - 8.5, 0.82, tcZ + 9.2)
  );
  for (const ox of [-3.4, -0.2]) {
    for (const oz of [-1.1, 1.1]) {
      w5HlAtlas.push(makeReliefCyl(0.08, 0.09, 2.85, 5, 'weatheredPierPlank', tcX + ox, 1.65, tcZ + oz));
    }
  }
  w5HlGold.push(
    new THREE.CylinderGeometry(0.10, 0.12, 0.45, 5).translate(tcX + 3.8, 0.65, tcZ + 1.2),
    new THREE.ConeGeometry(0.28, 0.55, 5).translate(tcX + 4.2, 2.45, tcZ)
  );

  // 1265–1280: Sửng Sốt lower ticket shelter, Ti Tốp tide-gauge/sunset deck/lifeguard chair, Hang Luồn kayaks,
  // Hòn Con Cóc, Hòn Đũa, seagrass buoy, squid-fishing boat & NW horizon karst stacks
  w5HlAtlas.push(
    // 1265: Sửng Sốt lower cliffside ticket shelter (4 grounded posts + flush roof)
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', ssX + 3.2, 3.15, ssZ - 3.6),
    // 1267–1269: Ti Tốp tide-gauge pillar, sunset viewing deck & elevated lifeguard watch-chair
    makeReliefCyl(0.26, 0.32, 2.8, 6, 'chateauAshlarStone', ttX + 16.5, 1.45, ttZ + 6.5),
    makeReliefBox(4.8, 0.24, 3.2, 'weatheredPierPlank', ttX + 15.2, 1.15, ttZ + 15.8),
    makeReliefBox(1.85, 0.18, 1.85, 'weatheredPierPlank', ttX + 2.2, 2.45, ttZ + 18.2),
    makeReliefBox(2.2, 0.16, 2.2, 'corrugatedTinRoof', ttX + 2.2, 4.45, ttZ + 18.2),
    // 1271–1272: Hang Luồn kayak rack & 2 kayaks + reef boulder
    makeReliefBox(2.6, 0.22, 0.54, 'cuaVanOchrePlank', -98.5, 0.65, -296.5),
    makeReliefBox(2.6, 0.22, 0.54, 'champagneGoldCladding', -98.5, 1.15, -296.5),
    makeReliefBox(2.8, 1.15, 2.2, 'haLongDiagonalKarst', -90.5, 0.45, -304.0, 0.35),
    // 1273–1275: Hòn Con Cóc (Toad Islet), Hòn Đũa (Chopstick Sea-Stack) & Hòn Gà Chọi reef boulder
    makeReliefCyl(2.4, 3.8, 7.5, 6, 'haLongDiagonalKarst', -12.0, 3.4, -458.0),
    makeReliefCyl(1.15, 1.95, 13.5, 6, 'haLongDiagonalKarst', 58.0, 6.2, -448.0),
    makeReliefBox(3.4, 1.05, 2.6, 'haLongDiagonalKarst', -18.5, 0.38, -418.0, -0.28),
    // 1276–1277, 1280: Seagrass research buoy, mid-bay squid-fishing boat & eastern light-buoy
    makeReliefCyl(0.55, 0.62, 0.68, 6, 'greenSteelPier', 4.0, 0.28, -396.0),
    makeReliefBox(5.6, 0.48, 1.75, 'mahoganyJunkHull', 38.0, 0.28, -410.0, 0.24),
    makeReliefBox(4.8, 0.08, 0.08, 'weatheredPierPlank', 38.0, 2.25, -410.0),
    makeReliefCyl(0.52, 0.62, 2.2, 5, 'cuaVanOchrePlank', 88.0, 0.95, -388.0),
    // 1278–1279: NW horizon distant karst sea-stacks
    makeReliefCyl(3.0, 5.2, 16.0, 6, 'haLongDiagonalKarst', -135.0, 7.4, -520.0),
    makeReliefCyl(2.6, 4.6, 13.5, 6, 'haLongDiagonalKarst', -118.0, 6.2, -538.0)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.1, 1.1]) {
      w5HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 5, 'weatheredPierPlank', ssX + 3.2 + ox, 1.72, ssZ - 3.6 + oz));
    }
  }
  for (const ox of [-0.75, 0.75]) {
    for (const oz of [-0.75, 0.75]) {
      w5HlAtlas.push(makeReliefCyl(0.06, 0.07, 4.15, 5, 'weatheredPierPlank', ttX + 2.2 + ox, 2.42, ttZ + 18.2 + oz));
    }
  }
  w5HlGold.push(
    new THREE.ConeGeometry(0.28, 0.55, 5).translate(88.0, 2.35, -388.0),
    new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(36.2, 2.25, -410.0),
    new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(39.8, 2.25, -410.0)
  );
  for (const [fx, fy, fz, rad] of [[-12.0, 8.2, -458.0, 2.8], [-135.0, 16.5, -520.0, 3.8], [-118.0, 14.0, -538.0, 3.4]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 5).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w5HlLeaf.push(crown);
  }

  const w5HlAtlasMesh = createMergedMesh('HaLongWave5Atlas', w5HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w5HlAtlasMesh) group.add(w5HlAtlasMesh);
  const w5HlGoldMesh = createMergedMesh('HaLongWave5Gold', w5HlGold, ctx.materials.gold, false, false);
  if (w5HlGoldMesh) group.add(w5HlGoldMesh);
  const w5HlLeafMesh = createMergedMesh('HaLongWave5Leaf', w5HlLeaf, foliageMat, false, false);
  if (w5HlLeafMesh) group.add(w5HlLeafMesh);

  // ==========================================================================
  // WAVE 6 UPGRADES (Items 1641–1680): Floating Pearl-Showroom Pavilion,
  // Karst Cove Fishing-Junk Dock, Eastern Cove Signal Pier & Horizon Karsts
  // ==========================================================================
  const w6HlAtlas: THREE.BufferGeometry[] = [];
  const w6HlGold: THREE.BufferGeometry[] = [];
  const w6HlLeaf: THREE.BufferGeometry[] = [];

  // 1641–1648: Nhà Trưng Bày Ngọc Trai Vịnh Hạ Long (Floating Pearl-Showroom Pavilion at 46, -346)
  const psX = 46.0;
  const psZ = -346.0;
  w6HlAtlas.push(
    makeReliefBox(6.8, 0.26, 5.4, 'weatheredPierPlank', psX, 0.28, psZ),
    makeReliefBox(4.8, 0.22, 4.0, 'corrugatedTinRoof', psX, 3.12, psZ),
    makeReliefBox(2.8, 0.85, 1.15, 'cuaVanTurquoisePlank', psX, 0.82, psZ),
    // 1644–1645, 1647: Oyster-basket rack, connecting gangway & moored visitor sampan
    makeReliefBox(3.4, 0.14, 0.16, 'weatheredPierPlank', psX, 1.75, psZ + 2.4),
    makeReliefBox(4.6, 0.18, 1.15, 'weatheredPierPlank', psX - 5.6, 0.26, psZ),
    makeReliefBox(4.0, 0.36, 1.10, 'mahoganyJunkHull', psX + 1.2, 0.22, psZ + 4.0, 0.16)
  );
  for (const ox of [-2.1, 2.1]) {
    for (const oz of [-1.7, 1.7]) {
      w6HlAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'weatheredPierPlank', psX + ox, 1.62, psZ + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w6HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanOchrePlank', psX + 4.8 + (b % 2) * 2.2, 0.20, psZ + (b < 2 ? -1.8 : 1.8)));
  }
  w6HlGold.push(
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(psX, 3.52, psZ),
    new THREE.ConeGeometry(0.22, 0.45, 4).translate(psX + 3.1, 2.15, psZ + 2.4)
  );

  // 1649–1656: Bến Thuyền Cánh Dơi Làng Chài (Karst Cove Fishing-Junk Dock at -42, -344)
  const fjX = -42.0;
  const fjZ = -344.0;
  w6HlAtlas.push(
    makeReliefBox(7.6, 0.26, 3.4, 'weatheredPierPlank', fjX, 0.28, fjZ),
    makeReliefBox(3.8, 2.15, 2.8, 'cuaVanOchrePlank', fjX - 1.6, 1.45, fjZ),
    makeReliefBox(4.4, 0.48, 3.4, 'corrugatedTinRoof', fjX - 1.6, 2.75, fjZ),
    // 1651–1652: Moored Thuyền Buồm Cánh Dơi wooden junk with mast & furled yardarm
    makeReliefBox(7.2, 0.68, 2.2, 'mahoganyJunkHull', fjX + 1.8, 0.36, fjZ + 4.2, -0.18),
    makeReliefBox(2.4, 1.35, 1.65, 'cuaVanTurquoisePlank', fjX + 1.8, 1.25, fjZ + 4.2, -0.18),
    makeReliefCyl(0.08, 0.11, 5.6, 4, 'mahoganyJunkHull', fjX + 1.8, 3.25, fjZ + 4.2),
    makeReliefBox(3.8, 0.10, 0.10, 'weatheredPierPlank', fjX + 1.8, 4.85, fjZ + 4.2),
    // 1653–1656: 2 bamboo coracles, fish-trap gantry & aquaculture pen frame
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', fjX - 2.6, 0.20, fjZ + 3.2),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', fjX - 4.6, 0.20, fjZ + 3.2),
    makeReliefBox(3.2, 0.12, 0.12, 'weatheredPierPlank', fjX + 2.0, 2.05, fjZ - 1.2),
    makeReliefBox(4.2, 0.16, 0.24, 'weatheredPierPlank', fjX, 0.22, fjZ - 3.6)
  );
  w6HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(fjX + 3.4, 0.58, fjZ + 1.4));

  // 1657–1664: Cảng Tín Hiệu Vịnh Đông (Eastern Karst Cove Signal Pier at 104, -378)
  const ecX = 104.0;
  const ecZ = -378.0;
  w6HlAtlas.push(
    makeReliefBox(8.2, 0.26, 3.2, 'weatheredPierPlank', ecX, 0.30, ecZ),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', ecX - 1.8, 3.05, ecZ),
    makeReliefCyl(0.32, 0.48, 4.2, 5, 'chateauAshlarStone', ecX + 3.6, 2.25, ecZ),
    // 1660–1662: Moored 2-deck excursion junk & provision tender raft
    makeReliefBox(9.8, 1.05, 3.0, 'mahoganyJunkHull', ecX + 1.2, 0.58, ecZ + 4.6),
    makeReliefBox(6.6, 1.55, 2.4, 'chateauAshlarStone', ecX + 1.2, 1.85, ecZ + 4.6),
    makeReliefCyl(0.08, 0.11, 5.6, 4, 'mahoganyJunkHull', ecX + 1.2, 3.95, ecZ + 4.6),
    makeReliefBox(3.8, 0.24, 2.2, 'weatheredPierPlank', ecX - 4.8, 0.28, ecZ + 4.0),
    // 1663–1664: Port/starboard channel spar buoys & passenger bench
    makeReliefCyl(0.30, 0.36, 1.55, 4, 'corrugatedTinRoof', ecX + 8.0, 0.78, ecZ + 8.8),
    makeReliefCyl(0.30, 0.36, 1.55, 4, 'greenSteelPier', ecX - 8.0, 0.78, ecZ + 8.8),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', ecX - 1.8, 0.62, ecZ)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w6HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', ecX + ox, 1.65, ecZ + oz));
    }
  }
  w6HlGold.push(new THREE.ConeGeometry(0.32, 0.58, 4).translate(ecX + 3.6, 4.65, ecZ));

  // 1665–1680: Sửng Sốt east bench/map, Ti Tốp NW deck/compass, Hang Luồn guide booth,
  // Hòn Yên Ngựa, Hòn Bút, oyster sampan, Tuần Châu baggage shelter, lighthouse steps & NE horizon karsts
  w6HlAtlas.push(
    makeReliefBox(2.2, 0.46, 0.56, 'weatheredPierPlank', ssX + 8.5, 1.25, ssZ - 3.6),
    makeReliefBox(0.95, 1.15, 0.35, 'chateauAshlarStone', ssX + 10.2, 1.45, ssZ - 3.6),
    makeReliefBox(4.4, 0.24, 2.8, 'weatheredPierPlank', ttX - 11.5, 1.15, ttZ + 6.5),
    makeReliefCyl(0.28, 0.34, 1.05, 5, 'chateauAshlarStone', ttX - 11.5, 1.75, ttZ + 6.5),
    // 1669–1670: Hang Luồn kayak-guide booth (4 posts + flush roof) & 2 staged kayaks
    makeReliefBox(3.0, 0.18, 2.4, 'corrugatedTinRoof', -103.5, 2.85, -296.5),
    makeReliefBox(2.6, 0.22, 0.54, 'cuaVanOchrePlank', -103.5, 0.45, -294.2),
    makeReliefBox(2.6, 0.22, 0.54, 'champagneGoldCladding', -103.5, 0.45, -293.4),
    // 1671–1673: Hòn Yên Ngựa, Hòn Bút & mid-bay oyster-tending sampan
    makeReliefCyl(2.4, 4.0, 9.5, 5, 'haLongDiagonalKarst', 74.0, 4.4, -462.0),
    makeReliefCyl(1.05, 1.85, 14.5, 5, 'haLongDiagonalKarst', -48.0, 6.8, -472.0),
    makeReliefBox(4.8, 0.42, 1.45, 'mahoganyJunkHull', 18.0, 0.26, -364.0, 0.22),
    // 1674, 1676–1679: Tuần Châu baggage shelter, lighthouse tidal steps, Cửa Vạn noticeboard & NE horizon karsts
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX - 6.8, 3.05, tcZ - 1.5),
    makeReliefBox(2.4, 0.48, 2.2, 'chateauAshlarStone', lhX + 5.8, 0.42, lhZ + 5.2),
    makeReliefBox(1.45, 1.65, 0.22, 'weatheredPierPlank', 102.5, 1.12, -346.5),
    makeReliefCyl(3.0, 5.2, 16.5, 5, 'haLongDiagonalKarst', 132.0, 7.6, -540.0),
    makeReliefCyl(2.6, 4.6, 13.8, 5, 'haLongDiagonalKarst', 148.0, 6.4, -525.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', -26.0, 0.92, -432.0)
  );
  for (const ox of [-1.3, 1.3]) {
    for (const oz of [-1.0, 1.0]) {
      w6HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.75, 4, 'weatheredPierPlank', -103.5 + ox, 1.50, -296.5 + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX - 6.8 + ox, 1.65, tcZ - 1.5 + oz)
      );
    }
  }
  w6HlGold.push(
    new THREE.ConeGeometry(0.24, 0.42, 4).translate(ttX - 11.5, 2.42, ttZ + 6.5),
    new THREE.CylinderGeometry(0.22, 0.28, 0.45, 5).translate(tcX - 5.2, 2.15, tcZ - 1.5),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(-26.0, 2.25, -432.0)
  );
  for (const [fx, fy, fz, rad] of [[74.0, 9.8, -462.0, 2.8], [132.0, 16.8, -540.0, 3.8], [148.0, 14.2, -525.0, 3.4]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w6HlLeaf.push(crown);
  }

  const w6HlAtlasMesh = createMergedMesh('HaLongWave6Atlas', w6HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w6HlAtlasMesh) group.add(w6HlAtlasMesh);
  const w6HlGoldMesh = createMergedMesh('HaLongWave6Gold', w6HlGold, ctx.materials.gold, false, false);
  if (w6HlGoldMesh) group.add(w6HlGoldMesh);
  const w6HlLeafMesh = createMergedMesh('HaLongWave6Leaf', w6HlLeaf, foliageMat, false, false);
  if (w6HlLeafMesh) group.add(w6HlLeafMesh);

  // ==========================================================================
  // WAVE 7 UPGRADES (Items 2041–2080): Cửa Vạn Floating Cultural Center,
  // Vung Viêng Sheltered HDPE Kayak Dock, West Ranger Pier & Horizon Karsts
  // ==========================================================================
  const w7HlAtlas: THREE.BufferGeometry[] = [];
  const w7HlGold: THREE.BufferGeometry[] = [];
  const w7HlLeaf: THREE.BufferGeometry[] = [];

  // 2041–2048: Nhà Văn Hóa Nổi Làng Chài Cửa Vạn (Floating Cultural Center at 82, -344)
  const ccHlX = 82.0;
  const ccHlZ = -344.0;
  w7HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', ccHlX, 0.28, ccHlZ),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanOchrePlank', ccHlX - 1.0, 1.55, ccHlZ),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', ccHlX - 1.0, 2.98, ccHlZ),
    // 2043–2047: 4-post boardwalk awning, rainwater barrel, connecting walkway & bamboo sampan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', ccHlX + 2.2, 2.85, ccHlZ),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanTurquoisePlank', ccHlX - 3.1, 0.82, ccHlZ + 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', ccHlX + 6.4, 0.26, ccHlZ + 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', ccHlX + 1.2, 0.22, ccHlZ + 4.2, 0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w7HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', ccHlX + ox, 1.52, ccHlZ + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w7HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanTurquoisePlank', ccHlX - 3.6 + b * 2.2, 0.20, ccHlZ - 3.6));
  }
  w7HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(ccHlX + 3.4, 2.15, ccHlZ + 2.6));

  // 2049–2056: Bến Kayak Vịnh Kín Vung Viêng (Sheltered Low-Profile HDPE Kayak Dock at 58, -388)
  const kdHlX = 58.0;
  const kdHlZ = -388.0;
  w7HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', kdHlX, 0.22, kdHlZ),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', kdHlX - 1.8, 2.95, kdHlZ),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', kdHlX - 1.8, 0.72, kdHlZ),
    // 2051–2056: 4 staged sea kayaks, paddle rack, net-cage frame & safety buoy
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanOchrePlank', kdHlX + 1.4, 0.38, kdHlZ - 1.1),
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanTurquoisePlank', kdHlX + 1.4, 0.38, kdHlZ - 0.3),
    makeReliefBox(2.6, 0.20, 0.52, 'champagneGoldCladding', kdHlX + 1.4, 0.38, kdHlZ + 0.5),
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanOchrePlank', kdHlX + 1.4, 0.38, kdHlZ + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', kdHlX + 3.4, 1.65, kdHlZ),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', kdHlX, 0.20, kdHlZ - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', kdHlX + 5.8, 0.45, kdHlZ + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w7HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', kdHlX + ox, 1.55, kdHlZ + oz));
    }
  }
  w7HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(kdHlX + 3.6, 0.52, kdHlZ + 1.5));

  // 2057–2064: Trạm Kiểm Lâm & Bến Ca Nô Tây Vịnh (West Ranger & Tender Pier at -72, -354)
  const rpX = -72.0;
  const rpZ = -354.0;
  w7HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', rpX, 0.30, rpZ),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', rpX - 1.6, 3.05, rpZ),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', rpX + 3.6, 2.35, rpZ),
    // 2060–2064: Moored ranger patrol tender, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', rpX + 1.0, 0.42, rpZ + 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', rpX + 1.0, 1.45, rpZ + 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', rpX - 4.6, 0.28, rpZ + 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', rpX + 7.5, 0.75, rpZ + 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', rpX - 7.5, 0.75, rpZ + 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', rpX - 1.6, 0.62, rpZ),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', rpX + 1.8, 1.85, rpZ - 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w7HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', rpX + ox, 1.65, rpZ + oz));
    }
  }
  w7HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(rpX + 3.6, 4.82, rpZ),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(rpX + 3.4, 0.58, rpZ + 1.4)
  );

  // 2065–2080: Sửng Sốt west rest pergola, Ti Tốp SE boardwalk/tide-marker, Hang Luồn return dock,
  // Hòn Chó Đá, Hòn Mâm Xôi, work sampan, Tuần Châu east canopy, lighthouse mast & far horizon karsts
  w7HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX - 10.5, 3.05, ssZ - 3.6),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX + 14.5, 1.15, ttZ + 6.5),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX + 14.5, 2.05, ttZ + 6.5),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -103.5, 0.24, -304.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -101.0, 0.20, -306.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -103.2, 0.20, -306.5),
    // 2071–2073: Hòn Chó Đá, Hòn Mâm Xôi & mid-bay pearl-basket work sampan
    makeReliefCyl(2.2, 3.8, 10.2, 5, 'haLongDiagonalKarst', -36.0, 4.8, -458.0),
    makeReliefCyl(3.4, 4.2, 8.2, 5, 'haLongDiagonalKarst', 86.0, 3.8, -474.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', -8.0, 0.26, -366.0, -0.22),
    // 2074, 2076–2080: Tuần Châu east waiting canopy, lighthouse mast, Cửa Vạn table & far horizon karsts
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX + 7.5, 3.05, tcZ - 1.5),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX - 4.8, 3.15, lhZ + 4.2),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 88.5, 0.65, -348.5),
    makeReliefCyl(3.0, 5.2, 16.5, 5, 'haLongDiagonalKarst', -152.0, 7.6, -535.0),
    makeReliefCyl(2.8, 4.8, 14.5, 5, 'haLongDiagonalKarst', 162.0, 6.8, -542.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', 24.0, 0.92, -438.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w7HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX - 10.5 + ox, 1.65, ssZ - 3.6 + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX + 7.5 + ox, 1.65, tcZ - 1.5 + oz)
      );
    }
  }
  w7HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX - 8.5, 2.65, ssZ - 3.6),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX - 4.8, 5.95, lhZ + 4.2),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX + 5.8, 0.65, tcZ - 1.5),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(24.0, 2.25, -438.0)
  );
  for (const [fx, fy, fz, rad] of [[-36.0, 10.2, -458.0, 2.6], [-152.0, 16.8, -535.0, 3.8], [162.0, 14.8, -542.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w7HlLeaf.push(crown);
  }

  const w7HlAtlasMesh = createMergedMesh('HaLongWave7Atlas', w7HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w7HlAtlasMesh) group.add(w7HlAtlasMesh);
  const w7HlGoldMesh = createMergedMesh('HaLongWave7Gold', w7HlGold, ctx.materials.gold, false, false);
  if (w7HlGoldMesh) group.add(w7HlGoldMesh);
  const w7HlLeafMesh = createMergedMesh('HaLongWave7Leaf', w7HlLeaf, foliageMat, false, false);
  if (w7HlLeafMesh) group.add(w7HlLeafMesh);

  // ==========================================================================
  // WAVE 8 UPGRADES (Items 2441–2480): Ba Hang Floating Rowboat Station,
  // Trinh Nữ Sheltered Kayak Dock, SW Maritime Pilot Pier & Horizon Karsts
  // ==========================================================================
  const w8HlAtlas: THREE.BufferGeometry[] = [];
  const w8HlGold: THREE.BufferGeometry[] = [];
  const w8HlLeaf: THREE.BufferGeometry[] = [];

  // 2441–2448: Làng Chài Nổi Ba Hang — Trạm Chèo Đò (Floating Rowboat Station at 64, -332)
  const bh8X = 64.0;
  const bh8Z = -332.0;
  w8HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', bh8X, 0.28, bh8Z),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanOchrePlank', bh8X - 1.0, 1.55, bh8Z),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', bh8X - 1.0, 2.98, bh8Z),
    // 2443–2447: 4-post boarding awning, rainwater cistern barrel, walkway & moored Thuyền Nan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', bh8X + 2.2, 2.85, bh8Z),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanTurquoisePlank', bh8X - 3.1, 0.82, bh8Z + 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', bh8X + 6.4, 0.26, bh8Z + 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', bh8X + 1.2, 0.22, bh8Z + 4.2, 0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w8HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', bh8X + ox, 1.52, bh8Z + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w8HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanTurquoisePlank', bh8X - 3.6 + b * 2.2, 0.20, bh8Z - 3.6));
  }
  w8HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(bh8X + 3.4, 2.15, bh8Z + 2.6));

  // 2449–2456: Bến Kayak Hang Trinh Nữ (Sheltered Karst-Cove Kayak Dock at 42, -396)
  const tn8X = 42.0;
  const tn8Z = -396.0;
  w8HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', tn8X, 0.22, tn8Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tn8X - 1.8, 2.95, tn8Z),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', tn8X - 1.8, 0.72, tn8Z),
    // 2451–2456: 4 staged sea kayaks, lifejacket rack, net-cage frame & safety buoy
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanOchrePlank', tn8X + 1.4, 0.38, tn8Z - 1.1),
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanTurquoisePlank', tn8X + 1.4, 0.38, tn8Z - 0.3),
    makeReliefBox(2.6, 0.20, 0.52, 'champagneGoldCladding', tn8X + 1.4, 0.38, tn8Z + 0.5),
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanOchrePlank', tn8X + 1.4, 0.38, tn8Z + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', tn8X + 3.4, 1.65, tn8Z),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', tn8X, 0.20, tn8Z - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', tn8X + 5.8, 0.45, tn8Z + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w8HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tn8X + ox, 1.55, tn8Z + oz));
    }
  }
  w8HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tn8X + 3.6, 0.52, tn8Z + 1.5));

  // 2457–2464: Trạm Hoa Tiêu & Bến Ca Nô Tây Nam (SW Maritime Pilot Pier at -86, -342)
  const mp8X = -86.0;
  const mp8Z = -342.0;
  w8HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', mp8X, 0.30, mp8Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', mp8X - 1.6, 3.05, mp8Z),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', mp8X + 3.6, 2.35, mp8Z),
    // 2460–2464: Moored pilot launch, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', mp8X + 1.0, 0.42, mp8Z + 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', mp8X + 1.0, 1.45, mp8Z + 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', mp8X - 4.6, 0.28, mp8Z + 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', mp8X + 7.5, 0.75, mp8Z + 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', mp8X - 7.5, 0.75, mp8Z + 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', mp8X - 1.6, 0.62, mp8Z),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', mp8X + 1.8, 1.85, mp8Z - 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w8HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', mp8X + ox, 1.65, mp8Z + oz));
    }
  }
  w8HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(mp8X + 3.6, 4.82, mp8Z),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(mp8X + 3.4, 0.58, mp8Z + 1.4)
  );

  // 2465–2480: Sửng Sốt south shelter, Ti Tốp SW boardwalk/elevation marker, Hang Luồn south dock,
  // Hòn Con Rùa, Hòn Thiên Nga, pearl-diver sampan, Tuần Châu west canopy, lighthouse vane & horizon karsts
  w8HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX, 3.05, ssZ + 8.5),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX - 14.5, 1.15, ttZ - 6.0),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX - 14.5, 2.05, ttZ - 6.0),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -103.5, 0.24, -312.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -101.0, 0.20, -314.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -103.2, 0.20, -314.5),
    // 2471–2473: Hòn Con Rùa, Hòn Thiên Nga & mid-bay pearl-diver sampan
    makeReliefCyl(2.4, 4.0, 9.6, 5, 'haLongDiagonalKarst', -58.0, 4.5, -452.0),
    makeReliefCyl(2.8, 4.4, 11.2, 5, 'haLongDiagonalKarst', 98.0, 5.2, -468.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', 4.0, 0.26, -378.0, 0.22),
    // 2474, 2476–2480: Tuần Châu west canopy, lighthouse weather-vane mast, Cửa Vạn table & far horizon karsts
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX - 12.5, 3.05, tcZ - 1.5),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX + 4.8, 3.15, lhZ - 4.2),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 76.0, 0.65, -348.5),
    makeReliefCyl(3.0, 5.2, 16.5, 5, 'haLongDiagonalKarst', -168.0, 7.6, -525.0),
    makeReliefCyl(2.8, 4.8, 14.5, 5, 'haLongDiagonalKarst', 174.0, 6.8, -532.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', -14.0, 0.92, -444.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w8HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX + ox, 1.65, ssZ + 8.5 + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX - 12.5 + ox, 1.65, tcZ - 1.5 + oz)
      );
    }
  }
  w8HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX + 2.0, 2.65, ssZ + 8.5),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX + 4.8, 5.95, lhZ - 4.2),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX - 10.8, 0.65, tcZ - 1.5),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(-14.0, 2.25, -444.0)
  );
  for (const [fx, fy, fz, rad] of [[-58.0, 9.6, -452.0, 2.6], [-168.0, 16.8, -525.0, 3.8], [174.0, 14.8, -532.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w8HlLeaf.push(crown);
  }

  const w8HlAtlasMesh = createMergedMesh('HaLongWave8Atlas', w8HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w8HlAtlasMesh) group.add(w8HlAtlasMesh);
  const w8HlGoldMesh = createMergedMesh('HaLongWave8Gold', w8HlGold, ctx.materials.gold, false, false);
  if (w8HlGoldMesh) group.add(w8HlGoldMesh);
  const w8HlLeafMesh = createMergedMesh('HaLongWave8Leaf', w8HlLeaf, foliageMat, false, false);
  if (w8HlLeafMesh) group.add(w8HlLeafMesh);

  // ==========================================================================
  // WAVE 9 UPGRADES (Items 2841–2880): Vung Viêng Floating Cultural House,
  // East Hang Luồn Kayak Dock, NW Hydrographic & Launch Pier & Horizon Karsts
  // ==========================================================================
  const w9HlAtlas: THREE.BufferGeometry[] = [];
  const w9HlGold: THREE.BufferGeometry[] = [];
  const w9HlLeaf: THREE.BufferGeometry[] = [];

  // 2841–2848: Làng Chài Nổi Vung Viêng — Nhà Văn Hóa Biển (Floating Cultural House at 78, -320)
  const vv9X = 78.0;
  const vv9Z = -320.0;
  w9HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', vv9X, 0.28, vv9Z),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanTurquoisePlank', vv9X - 1.0, 1.55, vv9Z),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', vv9X - 1.0, 2.98, vv9Z),
    // 2843–2847: 4-post boarding awning, rainwater cistern barrel, walkway & moored Thuyền Nan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', vv9X + 2.2, 2.85, vv9Z),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanOchrePlank', vv9X - 3.1, 0.82, vv9Z + 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', vv9X + 6.4, 0.26, vv9Z + 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', vv9X + 1.2, 0.22, vv9Z + 4.2, 0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w9HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', vv9X + ox, 1.52, vv9Z + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w9HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanOchrePlank', vv9X - 3.6 + b * 2.2, 0.20, vv9Z - 3.6));
  }
  w9HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(vv9X + 3.4, 2.15, vv9Z + 2.6));

  // 2849–2856: Bến Kayak Hang Luồn Đông (East Sheltered Karst-Cove Kayak Dock at 26, -406)
  const hl9X = 26.0;
  const hl9Z = -406.0;
  w9HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', hl9X, 0.22, hl9Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', hl9X - 1.8, 2.95, hl9Z),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', hl9X - 1.8, 0.72, hl9Z),
    // 2851–2856: 4 staged sea kayaks, paddle rack, net-cage frame & safety buoy
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanTurquoisePlank', hl9X + 1.4, 0.38, hl9Z - 1.1),
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanOchrePlank', hl9X + 1.4, 0.38, hl9Z - 0.3),
    makeReliefBox(2.6, 0.20, 0.52, 'champagneGoldCladding', hl9X + 1.4, 0.38, hl9Z + 0.5),
    makeReliefBox(2.6, 0.20, 0.52, 'cuaVanTurquoisePlank', hl9X + 1.4, 0.38, hl9Z + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', hl9X + 3.4, 1.65, hl9Z),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', hl9X, 0.20, hl9Z - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', hl9X + 5.8, 0.45, hl9Z + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w9HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', hl9X + ox, 1.55, hl9Z + oz));
    }
  }
  w9HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(hl9X + 3.6, 0.52, hl9Z + 1.5));

  // 2857–2864: Trạm Quan Trắc Hải Văn & Bến Ca Nô Tây Bắc (NW Hydrographic Pier at -98, -330)
  const hp9X = -98.0;
  const hp9Z = -330.0;
  w9HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', hp9X, 0.30, hp9Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', hp9X - 1.6, 3.05, hp9Z),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', hp9X + 3.6, 2.35, hp9Z),
    // 2860–2864: Moored hydrographic launch, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', hp9X + 1.0, 0.42, hp9Z + 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', hp9X + 1.0, 1.45, hp9Z + 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', hp9X - 4.6, 0.28, hp9Z + 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', hp9X + 7.5, 0.75, hp9Z + 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', hp9X - 7.5, 0.75, hp9Z + 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', hp9X - 1.6, 0.62, hp9Z),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', hp9X + 1.8, 1.85, hp9Z - 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w9HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', hp9X + ox, 1.65, hp9Z + oz));
    }
  }
  w9HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(hp9X + 3.6, 4.82, hp9Z),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(hp9X + 3.4, 0.58, hp9Z + 1.4)
  );

  // 2865–2880: Sửng Sốt north shelter, Ti Tốp NE boardwalk/elevation marker, Hang Luồn north dock,
  // Hòn Đầu Người, Hòn Yên Ngựa, oyster-farmer sampan, Tuần Châu north canopy, lighthouse mast & horizon karsts
  w9HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX, 3.05, ssZ - 8.5),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX + 14.5, 1.15, ttZ - 6.0),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX + 14.5, 2.05, ttZ - 6.0),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -103.5, 0.24, -296.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -101.0, 0.20, -294.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -103.2, 0.20, -294.5),
    // 2871–2873: Hòn Đầu Người, Hòn Yên Ngựa & mid-bay oyster-farmer sampan
    makeReliefCyl(2.4, 4.0, 10.4, 5, 'haLongDiagonalKarst', -74.0, 4.9, -448.0),
    makeReliefCyl(2.8, 4.4, 9.8, 5, 'haLongDiagonalKarst', 112.0, 4.6, -462.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', 16.0, 0.26, -384.0, -0.22),
    // 2874, 2876–2880: Tuần Châu north canopy, lighthouse anemometer mast, Cửa Vạn table & far horizon karsts
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX, 3.05, tcZ - 11.5),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX - 4.8, 3.15, lhZ - 4.2),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 82.0, 0.65, -340.0),
    makeReliefCyl(3.0, 5.2, 16.5, 5, 'haLongDiagonalKarst', -182.0, 7.6, -518.0),
    makeReliefCyl(2.8, 4.8, 14.5, 5, 'haLongDiagonalKarst', 186.0, 6.8, -524.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', -28.0, 0.92, -448.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w9HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX + ox, 1.65, ssZ - 8.5 + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX + ox, 1.65, tcZ - 11.5 + oz)
      );
    }
  }
  w9HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX + 2.0, 2.65, ssZ - 8.5),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX - 4.8, 5.95, lhZ - 4.2),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX + 1.8, 0.65, tcZ - 11.5),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(-28.0, 2.25, -448.0)
  );
  for (const [fx, fy, fz, rad] of [[-74.0, 10.4, -448.0, 2.6], [-182.0, 16.8, -518.0, 3.8], [186.0, 14.8, -524.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w9HlLeaf.push(crown);
  }

  const w9HlAtlasMesh = createMergedMesh('HaLongWave9Atlas', w9HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w9HlAtlasMesh) group.add(w9HlAtlasMesh);
  const w9HlGoldMesh = createMergedMesh('HaLongWave9Gold', w9HlGold, ctx.materials.gold, false, false);
  if (w9HlGoldMesh) group.add(w9HlGoldMesh);
  const w9HlLeafMesh = createMergedMesh('HaLongWave9Leaf', w9HlLeaf, foliageMat, false, false);
  if (w9HlLeafMesh) group.add(w9HlLeafMesh);

  // ==========================================================================
  // WAVE 10 UPGRADES (Items 3241–3280): Ba Hang Floating Rowboat Village,
  // Tùng Sâu Pearl-Farm Raft, West Sail-Rock Yacht Tender Pier & Horizon Karsts
  // ==========================================================================
  const w10HlAtlas: THREE.BufferGeometry[] = [];
  const w10HlGold: THREE.BufferGeometry[] = [];
  const w10HlLeaf: THREE.BufferGeometry[] = [];

  // 3241–3248: Làng Chài Nổi Ba Hang — Trạm Bến Đò Nan (Floating Rowboat Station at 96, -310)
  const bh10X = 96.0;
  const bh10Z = -310.0;
  w10HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', bh10X, 0.28, bh10Z),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanTurquoisePlank', bh10X - 1.0, 1.55, bh10Z),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', bh10X - 1.0, 2.98, bh10Z),
    // 3243–3247: 4-post boarding awning, rainwater cistern barrel, walkway & moored Thuyền Nan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', bh10X + 2.2, 2.85, bh10Z),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanOchrePlank', bh10X - 3.1, 0.82, bh10Z + 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', bh10X + 6.4, 0.26, bh10Z + 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', bh10X + 1.2, 0.22, bh10Z + 4.2, 0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w10HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', bh10X + ox, 1.52, bh10Z + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w10HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanOchrePlank', bh10X - 3.6 + b * 2.2, 0.20, bh10Z - 3.6));
  }
  w10HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(bh10X + 3.4, 2.15, bh10Z + 2.6));

  // 3249–3256: Trại Nuôi Ngọc Trai Tùng Sâu (Floating Pearl-Farm Raft at 44, -418)
  const ts10X = 44.0;
  const ts10Z = -418.0;
  w10HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', ts10X, 0.22, ts10Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', ts10X - 1.8, 2.95, ts10Z),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', ts10X - 1.8, 0.72, ts10Z),
    // 3251–3256: 4 staged pearl-harvesting trays, oar rack, oyster-cage frame & safety buoy
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', ts10X + 1.4, 0.38, ts10Z - 1.1),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanTurquoisePlank', ts10X + 1.4, 0.38, ts10Z - 0.3),
    makeReliefBox(2.4, 0.20, 0.56, 'champagneGoldCladding', ts10X + 1.4, 0.38, ts10Z + 0.5),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', ts10X + 1.4, 0.38, ts10Z + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', ts10X + 3.4, 1.65, ts10Z),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', ts10X, 0.20, ts10Z - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', ts10X + 5.8, 0.45, ts10Z + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w10HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', ts10X + ox, 1.55, ts10Z + oz));
    }
  }
  w10HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(ts10X + 3.6, 0.52, ts10Z + 1.5));

  // 3257–3264: Bến Du Thuyền Hòn Cánh Buồm Tây (West Sail-Rock Yacht Tender Pier at -114, -342)
  const sr10X = -114.0;
  const sr10Z = -342.0;
  w10HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', sr10X, 0.30, sr10Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', sr10X - 1.6, 3.05, sr10Z),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', sr10X + 3.6, 2.35, sr10Z),
    // 3260–3264: Moored yacht tender, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', sr10X + 1.0, 0.42, sr10Z + 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', sr10X + 1.0, 1.45, sr10Z + 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', sr10X - 4.6, 0.28, sr10Z + 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', sr10X + 7.5, 0.75, sr10Z + 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', sr10X - 7.5, 0.75, sr10Z + 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', sr10X - 1.6, 0.62, sr10Z),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', sr10X + 1.8, 1.85, sr10Z - 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w10HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', sr10X + ox, 1.65, sr10Z + oz));
    }
  }
  w10HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(sr10X + 3.6, 4.82, sr10Z),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(sr10X + 3.4, 0.58, sr10Z + 1.4)
  );

  // 3265–3280: Sửng Sốt south shelter, Ti Tốp SE boardwalk/elevation marker, Hang Luồn south dock,
  // Hòn Con Cóc, Hòn Đũa, pearl-diver sampan, Tuần Châu south canopy, weather mast & horizon karsts
  w10HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX, 3.05, ssZ + 9.2),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX + 16.5, 1.15, ttZ + 7.5),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX + 16.5, 2.05, ttZ + 7.5),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -106.5, 0.24, -312.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -104.0, 0.20, -310.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -106.2, 0.20, -310.5),
    // 3271–3273: Hòn Con Cóc, Hòn Đũa & mid-bay pearl-diver sampan
    makeReliefCyl(2.4, 4.0, 10.6, 5, 'haLongDiagonalKarst', -92.0, 5.0, -462.0),
    makeReliefCyl(2.6, 4.2, 10.2, 5, 'haLongDiagonalKarst', 128.0, 4.8, -474.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', -18.0, 0.26, -396.0, 0.22),
    // 3274–3280: Tuần Châu south canopy, weather mast, Cửa Vạn table, horizon karsts & outer buoy
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX, 3.05, tcZ + 12.2),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX + 5.2, 3.15, lhZ - 4.2),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 92.0, 0.65, -348.0),
    makeReliefCyl(3.0, 5.2, 16.8, 5, 'haLongDiagonalKarst', -196.0, 7.8, -532.0),
    makeReliefCyl(2.8, 4.8, 15.0, 5, 'haLongDiagonalKarst', 200.0, 7.0, -538.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', 34.0, 0.92, -456.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w10HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX + ox, 1.65, ssZ + 9.2 + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX + ox, 1.65, tcZ + 12.2 + oz)
      );
    }
  }
  w10HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX + 2.0, 2.65, ssZ + 9.2),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX + 5.2, 5.95, lhZ - 4.2),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX + 1.8, 0.65, tcZ + 12.2),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(34.0, 2.25, -456.0)
  );
  for (const [fx, fy, fz, rad] of [[-92.0, 10.6, -462.0, 2.6], [-196.0, 17.0, -532.0, 3.8], [200.0, 15.2, -538.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w10HlLeaf.push(crown);
  }

  const w10HlAtlasMesh = createMergedMesh('HaLongWave10Atlas', w10HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w10HlAtlasMesh) group.add(w10HlAtlasMesh);
  const w10HlGoldMesh = createMergedMesh('HaLongWave10Gold', w10HlGold, ctx.materials.gold, false, false);
  if (w10HlGoldMesh) group.add(w10HlGoldMesh);
  const w10HlLeafMesh = createMergedMesh('HaLongWave10Leaf', w10HlLeaf, foliageMat, false, false);
  if (w10HlLeafMesh) group.add(w10HlLeafMesh);

  // ==========================================================================
  // WAVE 11 UPGRADES (Items 3641–3680): Cống Đầm Floating Fishing Village,
  // Hang Trống Oyster-Farm Raft, SW Kissing-Rocks Yacht Tender Pier & Sea-Stacks
  // ==========================================================================
  const w11HlAtlas: THREE.BufferGeometry[] = [];
  const w11HlGold: THREE.BufferGeometry[] = [];
  const w11HlLeaf: THREE.BufferGeometry[] = [];

  // 3641–3648: Làng Chài Nổi Cống Đầm — Trạm Ngư Phủ (Floating Fishing Village at 114, -324)
  const cd11X = 114.0;
  const cd11Z = -324.0;
  w11HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', cd11X, 0.28, cd11Z),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanTurquoisePlank', cd11X - 1.0, 1.55, cd11Z),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', cd11X - 1.0, 2.98, cd11Z),
    // 3643–3647: 4-post boarding awning, rainwater cistern barrel, walkway & moored Thuyền Nan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', cd11X + 2.2, 2.85, cd11Z),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanOchrePlank', cd11X - 3.1, 0.82, cd11Z + 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', cd11X + 6.4, 0.26, cd11Z + 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', cd11X + 1.2, 0.22, cd11Z + 4.2, 0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w11HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', cd11X + ox, 1.52, cd11Z + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w11HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanOchrePlank', cd11X - 3.6 + b * 2.2, 0.20, cd11Z - 3.6));
  }
  w11HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(cd11X + 3.4, 2.15, cd11Z + 2.6));

  // 3649–3656: Bến Đò Hang Trống & Trại Hàu Vịnh Bái Tử Long (Floating Oyster-Farm Raft at 62, -432)
  const ht11X = 62.0;
  const ht11Z = -432.0;
  w11HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', ht11X, 0.22, ht11Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', ht11X - 1.8, 2.95, ht11Z),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', ht11X - 1.8, 0.72, ht11Z),
    // 3651–3656: 4 staged oyster-harvest trays, oar rack, net-cage frame & safety buoy
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', ht11X + 1.4, 0.38, ht11Z - 1.1),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanTurquoisePlank', ht11X + 1.4, 0.38, ht11Z - 0.3),
    makeReliefBox(2.4, 0.20, 0.56, 'champagneGoldCladding', ht11X + 1.4, 0.38, ht11Z + 0.5),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', ht11X + 1.4, 0.38, ht11Z + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', ht11X + 3.4, 1.65, ht11Z),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', ht11X, 0.20, ht11Z - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', ht11X + 5.8, 0.45, ht11Z + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w11HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', ht11X + ox, 1.55, ht11Z + oz));
    }
  }
  w11HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(ht11X + 3.6, 0.52, ht11Z + 1.5));

  // 3657–3664: Bến Du Thuyền Hòn Trống Mái Tây Nam (SW Kissing-Rocks Yacht Tender Pier at -132, -356)
  const kr11X = -132.0;
  const kr11Z = -356.0;
  w11HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', kr11X, 0.30, kr11Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', kr11X - 1.6, 3.05, kr11Z),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', kr11X + 3.6, 2.35, kr11Z),
    // 3660–3664: Moored yacht tender, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', kr11X + 1.0, 0.42, kr11Z + 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', kr11X + 1.0, 1.45, kr11Z + 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', kr11X - 4.6, 0.28, kr11Z + 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', kr11X + 7.5, 0.75, kr11Z + 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', kr11X - 7.5, 0.75, kr11Z + 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', kr11X - 1.6, 0.62, kr11Z),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', kr11X + 1.8, 1.85, kr11Z - 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w11HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', kr11X + ox, 1.65, kr11Z + oz));
    }
  }
  w11HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(kr11X + 3.6, 4.82, kr11Z),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(kr11X + 3.4, 0.58, kr11Z + 1.4)
  );

  // 3665–3680: Sửng Sốt east shelter, Ti Tốp NW boardwalk/marker, Hang Luồn west dock,
  // Hòn Lư Hương, Hòn Mâm Xôi, pearl-diver sampan, Tuần Châu east canopy, weather mast & horizon karsts
  w11HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX + 9.5, 3.05, ssZ),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX - 16.5, 1.15, ttZ + 7.5),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX - 16.5, 2.05, ttZ + 7.5),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -112.5, 0.24, -304.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -110.0, 0.20, -302.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -112.2, 0.20, -302.5),
    // 3671–3673: Hòn Lư Hương, Hòn Mâm Xôi & mid-bay pearl-diver sampan
    makeReliefCyl(2.4, 4.0, 10.6, 5, 'haLongDiagonalKarst', -108.0, 5.0, -476.0),
    makeReliefCyl(2.6, 4.2, 10.2, 5, 'haLongDiagonalKarst', 144.0, 4.8, -488.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', -34.0, 0.26, -408.0, -0.22),
    // 3674–3680: Tuần Châu east canopy, south weather mast, Cửa Vạn table, horizon karsts & outer buoy
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX + 12.5, 3.05, tcZ),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX, 3.15, lhZ + 5.6),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 98.0, 0.65, -338.0),
    makeReliefCyl(3.0, 5.2, 16.8, 5, 'haLongDiagonalKarst', -212.0, 7.8, -546.0),
    makeReliefCyl(2.8, 4.8, 15.0, 5, 'haLongDiagonalKarst', 216.0, 7.0, -552.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', 50.0, 0.92, -468.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w11HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX + 9.5 + ox, 1.65, ssZ + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX + 12.5 + ox, 1.65, tcZ + oz)
      );
    }
  }
  w11HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX + 11.5, 2.65, ssZ),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX, 5.95, lhZ + 5.6),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX + 14.3, 0.65, tcZ),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(50.0, 2.25, -468.0)
  );
  for (const [fx, fy, fz, rad] of [[-108.0, 10.6, -476.0, 2.6], [-212.0, 17.0, -546.0, 3.8], [216.0, 15.2, -552.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w11HlLeaf.push(crown);
  }

  const w11HlAtlasMesh = createMergedMesh('HaLongWave11Atlas', w11HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w11HlAtlasMesh) group.add(w11HlAtlasMesh);
  const w11HlGoldMesh = createMergedMesh('HaLongWave11Gold', w11HlGold, ctx.materials.gold, false, false);
  if (w11HlGoldMesh) group.add(w11HlGoldMesh);
  const w11HlLeafMesh = createMergedMesh('HaLongWave11Leaf', w11HlLeaf, foliageMat, false, false);
  if (w11HlLeafMesh) group.add(w11HlLeafMesh);

  // ==========================================================================
  // WAVE 12 UPGRADES (Items 4041–4080): Vung Viêng Floating Cultural House,
  // Tùng Sâu Pearl-Farm Raft, NW Incense-Burner Yacht Tender Pier & Sea-Stacks
  // ==========================================================================
  const w12HlAtlas: THREE.BufferGeometry[] = [];
  const w12HlGold: THREE.BufferGeometry[] = [];
  const w12HlLeaf: THREE.BufferGeometry[] = [];

  // 4041–4048: Làng Chài Nổi Vung Viêng — Nhà Văn Hóa Biển (Floating Cultural House at 136, -342)
  const vv12X = 136.0;
  const vv12Z = -342.0;
  w12HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', vv12X, 0.28, vv12Z),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanOchrePlank', vv12X - 1.0, 1.55, vv12Z),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', vv12X - 1.0, 2.98, vv12Z),
    // 4043–4047: 4-post boarding awning, rainwater cistern barrel, walkway & moored Thuyền Nan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', vv12X + 2.2, 2.85, vv12Z),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanTurquoisePlank', vv12X - 3.1, 0.82, vv12Z - 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', vv12X + 6.4, 0.26, vv12Z - 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', vv12X + 1.2, 0.22, vv12Z - 4.2, -0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w12HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', vv12X + ox, 1.52, vv12Z + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w12HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanTurquoisePlank', vv12X - 3.6 + b * 2.2, 0.20, vv12Z + 3.6));
  }
  w12HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(vv12X + 3.4, 2.15, vv12Z - 2.6));

  // 4049–4056: Trại Ngọc Trai Tùng Sâu — Nhà Nuôi Cấy (Floating Pearl-Farm Raft at 84, -446)
  const ts12X = 84.0;
  const ts12Z = -446.0;
  w12HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', ts12X, 0.22, ts12Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', ts12X - 1.8, 2.95, ts12Z),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', ts12X - 1.8, 0.72, ts12Z),
    // 4051–4056: 4 staged pearl-oyster trays, oar rack, pearl-cage frame & safety buoy
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', ts12X + 1.4, 0.38, ts12Z - 1.1),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanTurquoisePlank', ts12X + 1.4, 0.38, ts12Z - 0.3),
    makeReliefBox(2.4, 0.20, 0.56, 'champagneGoldCladding', ts12X + 1.4, 0.38, ts12Z + 0.5),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', ts12X + 1.4, 0.38, ts12Z + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', ts12X + 3.4, 1.65, ts12Z),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', ts12X, 0.20, ts12Z - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', ts12X + 5.8, 0.45, ts12Z + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w12HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', ts12X + ox, 1.55, ts12Z + oz));
    }
  }
  w12HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(ts12X + 3.6, 0.52, ts12Z + 1.5));

  // 4057–4064: Bến Du Thuyền Hòn Đỉnh Hương Tây Bắc (NW Incense-Burner Yacht Tender Pier at -148, -376)
  const ib12X = -148.0;
  const ib12Z = -376.0;
  w12HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', ib12X, 0.30, ib12Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', ib12X - 1.6, 3.05, ib12Z),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', ib12X + 3.6, 2.35, ib12Z),
    // 4060–4064: Moored yacht tender, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', ib12X + 1.0, 0.42, ib12Z - 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', ib12X + 1.0, 1.45, ib12Z - 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', ib12X - 4.6, 0.28, ib12Z - 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', ib12X + 7.5, 0.75, ib12Z - 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', ib12X - 7.5, 0.75, ib12Z - 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', ib12X - 1.6, 0.62, ib12Z),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', ib12X + 1.8, 1.85, ib12Z + 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w12HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', ib12X + ox, 1.65, ib12Z + oz));
    }
  }
  w12HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(ib12X + 3.6, 4.82, ib12Z),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(ib12X + 3.4, 0.58, ib12Z - 1.4)
  );

  // 4065–4080: Sửng Sốt west shelter, Ti Tốp NE boardwalk/marker, Hang Luồn east dock,
  // Hòn Con Cóc, Hòn Đầu Người, pearl-fishing sampan, Tuần Châu west canopy, north weather mast & horizon karsts
  w12HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX - 9.8, 3.05, ssZ),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX + 16.5, 1.15, ttZ + 7.5),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX + 16.5, 2.05, ttZ + 7.5),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -92.5, 0.24, -304.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -90.0, 0.20, -302.5),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -92.2, 0.20, -302.5),
    // 4071–4073: Hòn Con Cóc, Hòn Đầu Người & mid-bay pearl-fishing junk sampan
    makeReliefCyl(2.4, 4.0, 10.6, 5, 'haLongDiagonalKarst', -132.0, 5.0, -492.0),
    makeReliefCyl(2.6, 4.2, 10.2, 5, 'haLongDiagonalKarst', 166.0, 4.8, -498.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', 34.0, 0.26, -408.0, 0.22),
    // 4074–4080: Tuần Châu west canopy, north weather mast, Cửa Vạn south table, horizon karsts & outer buoy
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX - 12.8, 3.05, tcZ),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX, 3.15, lhZ - 5.8),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 98.0, 0.65, -314.0),
    makeReliefCyl(3.0, 5.2, 16.8, 5, 'haLongDiagonalKarst', -236.0, 7.8, -562.0),
    makeReliefCyl(2.8, 4.8, 15.0, 5, 'haLongDiagonalKarst', 238.0, 7.0, -566.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', -52.0, 0.92, -472.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w12HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX - 9.8 + ox, 1.65, ssZ + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX - 12.8 + ox, 1.65, tcZ + oz)
      );
    }
  }
  w12HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX - 11.8, 2.65, ssZ),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX, 5.95, lhZ - 5.8),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX - 14.6, 0.65, tcZ),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(-52.0, 2.25, -472.0)
  );
  for (const [fx, fy, fz, rad] of [[-132.0, 10.6, -492.0, 2.6], [-236.0, 17.0, -562.0, 3.8], [238.0, 15.2, -566.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w12HlLeaf.push(crown);
  }

  const w12HlAtlasMesh = createMergedMesh('HaLongWave12Atlas', w12HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w12HlAtlasMesh) group.add(w12HlAtlasMesh);
  const w12HlGoldMesh = createMergedMesh('HaLongWave12Gold', w12HlGold, ctx.materials.gold, false, false);
  if (w12HlGoldMesh) group.add(w12HlGoldMesh);
  const w12HlLeafMesh = createMergedMesh('HaLongWave12Leaf', w12HlLeaf, foliageMat, false, false);
  if (w12HlLeafMesh) group.add(w12HlLeafMesh);

  // ==========================================================================
  // WAVE 13 UPGRADES (Items 4441–4480): Ba Hang Floating Cultural House,
  // Hòn Bồ Nâu Pearl-Farm Raft, NE Cock-and-Hen Yacht Tender Pier & Sea-Stacks
  // ==========================================================================
  const w13HlAtlas: THREE.BufferGeometry[] = [];
  const w13HlGold: THREE.BufferGeometry[] = [];
  const w13HlLeaf: THREE.BufferGeometry[] = [];

  // 4441–4448: Làng Chài Nổi Ba Hang — Nhà Văn Hóa & Bến Đò (Floating Cultural House at 154, -360)
  const bh13X = 154.0;
  const bh13Z = -360.0;
  w13HlAtlas.push(
    makeReliefBox(7.2, 0.26, 5.6, 'weatheredPierPlank', bh13X, 0.28, bh13Z),
    makeReliefBox(4.4, 2.35, 3.6, 'cuaVanTurquoisePlank', bh13X - 1.0, 1.55, bh13Z),
    makeReliefBox(5.2, 0.52, 4.4, 'corrugatedTinRoof', bh13X - 1.0, 2.98, bh13Z),
    // 4443–4447: 4-post boarding awning, rainwater cistern barrel, walkway & moored Thuyền Nan
    makeReliefBox(2.4, 0.18, 4.2, 'corrugatedTinRoof', bh13X + 2.2, 2.85, bh13Z),
    makeReliefCyl(0.32, 0.34, 0.85, 5, 'cuaVanOchrePlank', bh13X - 3.1, 0.82, bh13Z - 2.1),
    makeReliefBox(5.6, 0.18, 1.15, 'weatheredPierPlank', bh13X + 6.4, 0.26, bh13Z - 0.8),
    makeReliefBox(4.2, 0.34, 1.08, 'mahoganyJunkHull', bh13X + 1.2, 0.22, bh13Z - 4.2, -0.18)
  );
  for (const ox of [1.2, 3.2]) {
    for (const oz of [-1.8, 1.8]) {
      w13HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.75, 4, 'weatheredPierPlank', bh13X + ox, 1.52, bh13Z + oz));
    }
  }
  for (let b = 0; b < 4; b++) {
    w13HlAtlas.push(makeReliefCyl(0.22, 0.24, 0.34, 4, 'cuaVanOchrePlank', bh13X - 3.6 + b * 2.2, 0.20, bh13Z + 3.6));
  }
  w13HlGold.push(new THREE.ConeGeometry(0.24, 0.48, 4).translate(bh13X + 3.4, 2.15, bh13Z - 2.6));

  // 4449–4456: Trại Ngọc Trai Hòn Bồ Nâu — Bè Nuôi Cấy (Floating Pearl-Farm Raft at 104, -462)
  const bn13X = 104.0;
  const bn13Z = -462.0;
  w13HlAtlas.push(
    makeReliefBox(7.8, 0.22, 3.6, 'weatheredPierPlank', bn13X, 0.22, bn13Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', bn13X - 1.8, 2.95, bn13Z),
    makeReliefBox(2.2, 0.85, 1.10, 'cuaVanTurquoisePlank', bn13X - 1.8, 0.72, bn13Z),
    // 4451–4456: 4 staged pearl-oyster trays, oar rack, pearl-cage frame & safety buoy
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', bn13X + 1.4, 0.38, bn13Z - 1.1),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanTurquoisePlank', bn13X + 1.4, 0.38, bn13Z - 0.3),
    makeReliefBox(2.4, 0.20, 0.56, 'champagneGoldCladding', bn13X + 1.4, 0.38, bn13Z + 0.5),
    makeReliefBox(2.4, 0.20, 0.56, 'cuaVanOchrePlank', bn13X + 1.4, 0.38, bn13Z + 1.3),
    makeReliefBox(2.4, 0.12, 0.14, 'weatheredPierPlank', bn13X + 3.4, 1.65, bn13Z),
    makeReliefBox(4.0, 0.16, 0.24, 'weatheredPierPlank', bn13X, 0.20, bn13Z - 3.4),
    makeReliefCyl(0.28, 0.32, 0.95, 4, 'corrugatedTinRoof', bn13X + 5.8, 0.45, bn13Z + 3.2)
  );
  for (const ox of [-3.3, -0.3]) {
    for (const oz of [-1.1, 1.1]) {
      w13HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', bn13X + ox, 1.55, bn13Z + oz));
    }
  }
  w13HlGold.push(new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(bn13X + 3.6, 0.52, bn13Z + 1.5));

  // 4457–4464: Bến Du Thuyền Hòn Gà Chọi Đông Bắc (NE Cock-and-Hen Yacht Tender Pier at -166, -396)
  const gc13X = -166.0;
  const gc13Z = -396.0;
  w13HlAtlas.push(
    makeReliefBox(8.0, 0.26, 3.2, 'weatheredPierPlank', gc13X, 0.30, gc13Z),
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', gc13X - 1.6, 3.05, gc13Z),
    makeReliefCyl(0.30, 0.44, 4.4, 5, 'chateauAshlarStone', gc13X + 3.6, 2.35, gc13Z),
    // 4460–4464: Moored yacht tender, water raft, channel spar buoys, bench & fish-trap rack
    makeReliefBox(7.4, 0.72, 2.3, 'mahoganyJunkHull', gc13X + 1.0, 0.42, gc13Z - 4.2),
    makeReliefBox(3.2, 1.45, 1.75, 'chateauAshlarStone', gc13X + 1.0, 1.45, gc13Z - 4.2),
    makeReliefBox(3.6, 0.24, 2.2, 'weatheredPierPlank', gc13X - 4.6, 0.28, gc13Z - 3.8),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'corrugatedTinRoof', gc13X + 7.5, 0.75, gc13Z - 8.4),
    makeReliefCyl(0.28, 0.34, 1.50, 4, 'greenSteelPier', gc13X - 7.5, 0.75, gc13Z - 8.4),
    makeReliefBox(2.0, 0.44, 0.52, 'weatheredPierPlank', gc13X - 1.6, 0.62, gc13Z),
    makeReliefBox(2.8, 0.12, 0.14, 'weatheredPierPlank', gc13X + 1.8, 1.85, gc13Z + 1.3)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-1.1, 1.1]) {
      w13HlAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', gc13X + ox, 1.65, gc13Z + oz));
    }
  }
  w13HlGold.push(
    new THREE.ConeGeometry(0.30, 0.56, 4).translate(gc13X + 3.6, 4.82, gc13Z),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(gc13X + 3.4, 0.58, gc13Z - 1.4)
  );

  // 4465–4480: Sửng Sốt north shelter, Ti Tốp SW boardwalk/marker, Hang Luồn south dock,
  // Hòn Yên Ngựa, Hòn Mắt Rồng, fishing sampan, Tuần Châu north canopy, west weather mast & horizon karsts
  w13HlAtlas.push(
    makeReliefBox(3.2, 0.18, 2.6, 'corrugatedTinRoof', ssX, 3.05, ssZ - 10.4),
    makeReliefBox(4.8, 0.24, 2.6, 'weatheredPierPlank', ttX - 18.0, 1.15, ttZ - 8.5),
    makeReliefCyl(0.24, 0.30, 1.65, 5, 'chateauAshlarStone', ttX - 18.0, 2.05, ttZ - 8.5),
    makeReliefBox(4.4, 0.22, 2.6, 'weatheredPierPlank', -102.5, 0.24, -292.0),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -100.0, 0.20, -290.0),
    makeReliefCyl(0.68, 0.44, 0.34, 5, 'weatheredPierPlank', -102.2, 0.20, -290.0),
    // 4471–4473: Hòn Yên Ngựa, Hòn Mắt Rồng & mid-bay mahogany fishing sampan
    makeReliefCyl(2.4, 4.0, 10.6, 5, 'haLongDiagonalKarst', -150.0, 5.0, -508.0),
    makeReliefCyl(2.6, 4.2, 10.2, 5, 'haLongDiagonalKarst', 184.0, 4.8, -514.0),
    makeReliefBox(4.6, 0.40, 1.40, 'mahoganyJunkHull', -52.0, 0.26, -418.0, -0.22),
    // 4474–4480: Tuần Châu north canopy, west weather mast, Cửa Vạn north table, horizon karsts & outer buoy
    makeReliefBox(3.4, 0.20, 2.6, 'corrugatedTinRoof', tcX, 3.05, tcZ - 13.2),
    makeReliefCyl(0.10, 0.14, 5.2, 4, 'weatheredPierPlank', lhX - 6.2, 3.15, lhZ),
    makeReliefBox(2.0, 0.78, 1.05, 'weatheredPierPlank', 106.0, 0.65, -304.0),
    makeReliefCyl(3.0, 5.2, 16.8, 5, 'haLongDiagonalKarst', -256.0, 7.8, -578.0),
    makeReliefCyl(2.8, 4.8, 15.0, 5, 'haLongDiagonalKarst', 258.0, 7.0, -582.0),
    makeReliefCyl(0.48, 0.58, 2.0, 4, 'cuaVanOchrePlank', 68.0, 0.92, -482.0)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w13HlAtlas.push(
        makeReliefCyl(0.06, 0.07, 2.85, 4, 'weatheredPierPlank', ssX + ox, 1.65, ssZ - 10.4 + oz),
        makeReliefCyl(0.07, 0.08, 2.85, 4, 'weatheredPierPlank', tcX + ox, 1.65, tcZ - 13.2 + oz)
      );
    }
  }
  w13HlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(ssX + 2.0, 2.65, ssZ - 10.4),
    new THREE.ConeGeometry(0.24, 0.45, 4).translate(lhX - 6.2, 5.95, lhZ),
    new THREE.CylinderGeometry(0.10, 0.12, 0.42, 4).translate(tcX + 1.8, 0.65, tcZ - 13.2),
    new THREE.ConeGeometry(0.28, 0.55, 4).translate(68.0, 2.25, -482.0)
  );
  for (const [fx, fy, fz, rad] of [[-150.0, 10.6, -508.0, 2.6], [-256.0, 17.0, -578.0, 3.8], [258.0, 15.2, -582.0, 3.6]] as const) {
    const crown = new THREE.ConeGeometry(rad, 3.4, 4).translate(fx, fy, fz);
    colorizeGeo(crown, 0x1e5628);
    w13HlLeaf.push(crown);
  }

  const w13HlAtlasMesh = createMergedMesh('HaLongWave13Atlas', w13HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w13HlAtlasMesh) group.add(w13HlAtlasMesh);
  const w13HlGoldMesh = createMergedMesh('HaLongWave13Gold', w13HlGold, ctx.materials.gold, false, false);
  if (w13HlGoldMesh) group.add(w13HlGoldMesh);
  const w13HlLeafMesh = createMergedMesh('HaLongWave13Leaf', w13HlLeaf, foliageMat, false, false);
  if (w13HlLeafMesh) group.add(w13HlLeafMesh);

  // ==========================================================================
  // WAVE 15 REAL-PHOTO ARCHITECTURAL DETAIL UPGRADES (castShadow = false, 0 new materials):
  // Hòn Trống Mái jagged rooster comb crest & limestone strata ledges,
  // Cửa Vạn corner mooring bollards, draped fishing nets, moored sampan thwarts/oars,
  // fish-cage barrel buoy collars & warm hanging cultural-house porch lanterns
  // ==========================================================================
  const w15HlAtlas: THREE.BufferGeometry[] = [];
  const w15HlLeaf: THREE.BufferGeometry[] = [];
  const w15HlGlow: THREE.BufferGeometry[] = [];

  // 15.5 Hòn Trống Mái: Rooster comb limestone rock-crests, weathered horizontal cliff strata ledges & clinging karst shrubs
  w15HlAtlas.push(
    makeReliefBox(1.15, 1.45, 0.85, 'haLongDiagonalKarst', -33.2, 14.3, -410.0, 0.18, 0, -0.22),
    makeReliefBox(0.95, 1.25, 0.78, 'haLongDiagonalKarst', -34.2, 13.8, -410.1, -0.14, 0, 0.16),
    makeReliefBox(0.85, 1.05, 0.72, 'haLongDiagonalKarst', -32.4, 13.4, -409.9, 0.22, 0, -0.30),
    // Horizontal limestone strata ledges flanking Rooster & Hen
    makeReliefBox(3.4, 0.55, 1.65, 'haLongDiagonalKarst', -34.0, 6.2, -410.0, 0.12, 0, 0.08),
    makeReliefBox(2.9, 0.52, 1.55, 'haLongDiagonalKarst', -33.4, 9.6, -410.0, -0.08, 0, -0.06),
    makeReliefBox(3.0, 0.52, 1.55, 'haLongDiagonalKarst', -22.2, 5.4, -410.0, -0.10, 0, -0.08),
    makeReliefBox(2.5, 0.48, 1.42, 'haLongDiagonalKarst', -22.6, 8.6, -410.0, 0.08, 0, 0.06)
  );
  for (const [kx, ky, kz, kr] of [
    [-34.6, 12.6, -409.6, 0.92],
    [-32.8, 14.9, -410.1, 0.78],
    [-21.4, 10.6, -409.8, 0.86],
    [-23.1, 12.6, -410.2, 0.72]
  ] as const) {
    const tuft = new THREE.ConeGeometry(kr, kr * 1.15, 5).translate(kx, ky, kz);
    colorizeGeo(tuft, 0x265e2a);
    w15HlLeaf.push(tuft);
  }

  // 15.6 Làng Chài Cửa Vạn Floating Fishing Village real-photo timber, net & sampan details
  cuaVanHouses.forEach(([fx, fz, ry, hw, hd], idx) => {
    const rw = hw + 2.4;
    const rd = hd + 2.2;
    // Twin corner mooring bollards on front raft deck
    for (const bx of [-rw * 0.44, rw * 0.44]) {
      const bollard = remapRelief(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 5), 'weatheredPierPlank');
      bollard.translate(bx, 0.65, rd * 0.44);
      bollard.rotateY(ry);
      bollard.translate(fx, 0, fz);
      w15HlAtlas.push(bollard);
    }
    // Draped dark-green fishing nets & bamboo drying poles along alternate house eaves
    if (idx < 3) {
      const pole = remapRelief(new THREE.BoxGeometry(hw * 0.78, 0.07, 0.07), 'weatheredPierPlank');
      pole.translate(0, 2.38, hd * 0.5 + 0.65);
      pole.rotateY(ry);
      pole.translate(fx, 0, fz);
      const net = remapRelief(new THREE.BoxGeometry(hw * 0.68, 1.05, 0.06), 'greenSteelPier');
      net.translate(0, 1.82, hd * 0.5 + 0.65);
      net.rotateY(ry);
      net.translate(fx, 0, fz);
      w15HlAtlas.push(pole, net);

      // 4 floating barrel buoy collars anchoring the submerged fish-farming cage (lồng bè nuôi cá)
      const cx = fx + 0.5;
      const cz = fz + rd * 0.5 + 2.2;
      for (const ox of [-1.48, 1.48]) {
        for (const oz of [-1.48, 1.48]) {
          w15HlAtlas.push(makeReliefCyl(0.22, 0.22, 0.48, 5, 'cuaVanTurquoisePlank', cx + ox, 0.08, cz + oz, 0, Math.PI * 0.5, 0));
        }
      }
    }
  });

  // Wooden thwarts (seats) & paired bamboo sculling oars resting inside the 3 moored Thuyền Nan sampans
  for (const [sx, sz, syaw] of [[93.5, -355.0, 0.45], [107.2, -347.5, -0.28], [126.5, -358.0, 0.85]] as const) {
    const thwart1 = remapRelief(new THREE.BoxGeometry(0.24, 0.08, 0.52), 'weatheredPierPlank');
    thwart1.translate(-0.75, 0.34, 0);
    thwart1.rotateY(syaw);
    thwart1.translate(sx, 0, sz);
    const thwart2 = remapRelief(new THREE.BoxGeometry(0.24, 0.08, 0.52), 'weatheredPierPlank');
    thwart2.translate(0.75, 0.34, 0);
    thwart2.rotateY(syaw);
    thwart2.translate(sx, 0, sz);
    const oar = remapRelief(new THREE.CylinderGeometry(0.03, 0.035, 2.8, 4), 'weatheredPierPlank');
    oar.rotateZ(Math.PI * 0.5);
    oar.translate(0, 0.40, 0.14);
    oar.rotateY(syaw);
    oar.translate(sx, 0, sz);
    w15HlAtlas.push(thwart1, thwart2, oar);
  }

  // Warm hanging porch lanterns under Nhà Văn Hóa Cửa Vạn & village entrance signboard (reusing existing glowMat!)
  for (const [lx, ly, lz] of [
    [114.8, 2.72, -339.2],
    [119.2, 2.72, -339.2],
    [100.6, 2.48, -347.1],
    [103.4, 2.48, -347.1]
  ] as const) {
    w15HlGlow.push(new THREE.SphereGeometry(0.11, 5, 4).translate(lx, ly, lz));
  }

  const w15HlAtlasMesh = createMergedMesh('HaLongWave15Atlas', w15HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w15HlAtlasMesh) group.add(w15HlAtlasMesh);
  const w15HlLeafMesh = createMergedMesh('HaLongWave15Leaf', w15HlLeaf, foliageMat, false, false);
  if (w15HlLeafMesh) group.add(w15HlLeafMesh);
  const w15HlGlowMesh = createMergedMesh('HaLongWave15Glow', w15HlGlow, glowMat, false, false);
  if (w15HlGlowMesh) group.add(w15HlGlowMesh);

  // ==========================================================================
  // WAVE 21 REAL-PHOTO ARCHITECTURAL DETAIL UPGRADES (castShadow = false, 0 new materials):
  // Cửa Vạn floating village bamboo walkway handrails/stanchions/pontoons &
  // dedicated floating lobster-cage aquaculture pens with colorful spherical floats
  // ==========================================================================
  const w21HlAtlas: THREE.BufferGeometry[] = [];
  const w21HlGold: THREE.BufferGeometry[] = [];

  // 21.7 Cửa Vạn Bamboo Walkway Twin Handrails, Vertical Stanchion Posts & Buoyancy Pontoons
  for (const [x0, z0, x1, z1] of gangways) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = -Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const placeOnGangway = (g: THREE.BufferGeometry) => {
      g.rotateY(ang);
      g.translate(mx, 0, mz);
      return g;
    };
    // Opposite-side upper bamboo handrail & mid-rail aligned cleanly to angled walkway edges
    w21HlAtlas.push(
      placeOnGangway(remapRelief(new THREE.BoxGeometry(len, 0.055, 0.055), 'weatheredPierPlank').translate(0, 1.02, -0.54)),
      placeOnGangway(remapRelief(new THREE.BoxGeometry(len, 0.045, 0.045), 'weatheredPierPlank').translate(0, 0.66, -0.54))
    );
    // Grounded vertical bamboo handrail stanchion posts (2 stations × both sides) + buoyancy drum pontoons underneath
    for (const frac of [-0.30, 0.30]) {
      const lx = frac * len;
      for (const side of [-1, 1]) {
        w21HlAtlas.push(
          placeOnGangway(remapRelief(new THREE.CylinderGeometry(0.035, 0.04, 0.88, 5), 'weatheredPierPlank').translate(lx, 0.68, side * 0.54))
        );
      }
      w21HlAtlas.push(
        placeOnGangway(
          remapRelief(new THREE.CylinderGeometry(0.16, 0.16, 1.35, 5), 'cuaVanTurquoisePlank')
            .rotateX(Math.PI * 0.5)
            .translate(lx, 0.12, 0)
        )
      );
    }
  }

  // 21.8 Dedicated Cửa Vạn Floating Lobster-Cage Pens (Lồng Nuôi Tôm Hùm) & Vibrant Spherical Lobster Floats
  const lobsterCages: Array<[number, number]> = [
    [106.5, -343.2],
    [123.5, -348.2],
    [118.5, -367.2]
  ];
  const floatKeys: readonly CvhlReliefKey[] = ['corrugatedTinRoof', 'cuaVanOchrePlank', 'cuaVanTurquoisePlank'];
  for (const [cx, cz] of lobsterCages) {
    // Timber perimeter catwalk frame + submerged lobster trap mesh box + tie-rail
    w21HlAtlas.push(
      makeReliefBox(2.8, 0.14, 0.24, 'weatheredPierPlank', cx, 0.20, cz - 1.28),
      makeReliefBox(2.8, 0.14, 0.24, 'weatheredPierPlank', cx, 0.20, cz + 1.28),
      makeReliefBox(0.24, 0.14, 2.8, 'weatheredPierPlank', cx - 1.28, 0.20, cz),
      makeReliefBox(0.24, 0.14, 2.8, 'weatheredPierPlank', cx + 1.28, 0.20, cz),
      makeReliefBox(2.1, 0.78, 2.1, 'greenSteelPier', cx, -0.22, cz),
      makeReliefBox(2.6, 0.06, 0.06, 'weatheredPierPlank', cx, 1.32, cz - 1.28)
    );
    // 4 corner bamboo marker poles embedded into frame corners
    for (const ox of [-1.28, 1.28]) {
      for (const oz of [-1.28, 1.28]) {
        w21HlAtlas.push(makeReliefCyl(0.03, 0.035, 1.35, 5, 'weatheredPierPlank', cx + ox, 0.78, cz + oz));
      }
    }
    // 6 bobbing spherical lobster-trap marker floats ringing the cage waterline
    const floatOffsets: Array<[number, number]> = [
      [-1.56, -0.95], [1.56, -0.95],
      [-1.56, 0.95], [1.56, 0.95],
      [-0.75, 1.56], [0.75, 1.56]
    ];
    floatOffsets.forEach(([fx, fz], fi) => {
      const sph = new THREE.SphereGeometry(0.18, 5, 4);
      sph.translate(cx + fx, 0.08, cz + fz);
      if (fi === 4) {
        w21HlGold.push(sph);
      } else {
        w21HlAtlas.push(remapRelief(sph, floatKeys[fi % floatKeys.length]));
      }
    });
  }

  const w21HlAtlasMesh = createMergedMesh('HaLongWave21Atlas', w21HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w21HlAtlasMesh) group.add(w21HlAtlasMesh);
  const w21HlGoldMesh = createMergedMesh('HaLongWave21Gold', w21HlGold, ctx.materials.gold, false, false);
  if (w21HlGoldMesh) group.add(w21HlGoldMesh);

  // ==========================================================================
  // WAVE 27 REAL-PHOTO ARCHITECTURAL DETAIL UPGRADES (castShadow = false, 0 new materials):
  // Làng Chài Cửa Vạn floating village slatted bamboo fish-sorting tables (bàn phân loại cá),
  // elevated lashed-bamboo fish/squid drying racks (giàn phơi) & cleated wooden boat-boarding planks
  // ==========================================================================
  const w27HlAtlas: THREE.BufferGeometry[] = [];

  const w27PlaceLocal = (
    g: THREE.BufferGeometry,
    fx: number,
    fz: number,
    ry: number
  ): THREE.BufferGeometry => {
    g.rotateY(ry);
    g.translate(fx, 0, fz);
    return g;
  };

  // 27.3 Slatted Bamboo Fish-Sorting Tables (3 tables: fishing pier south end + Houses 1 & 4 front-right decks)
  const w27AddSortingTable = (
    tx: number,
    deckY: number,
    tz: number,
    ry: number,
    lx: number,
    lz: number
  ) => {
    const w27Tw = 1.06;
    const w27Td = 0.58;
    const w27Th = 0.76;
    // 4 slender bamboo legs embedded -0.04m into raft/pier deck
    for (const ox of [-w27Tw * 0.44, w27Tw * 0.44]) {
      for (const oz of [-w27Td * 0.42, w27Td * 0.42]) {
        w27HlAtlas.push(
          w27PlaceLocal(
            remapRelief(new THREE.CylinderGeometry(0.03, 0.035, w27Th + 0.04, 4), 'weatheredPierPlank')
              .translate(lx + ox, deckY + w27Th * 0.5 - 0.02, lz + oz),
            tx,
            tz,
            ry
          )
        );
      }
    }
    // Lower bamboo cross-stretchers & raised end rim rails
    w27HlAtlas.push(
      w27PlaceLocal(
        remapRelief(new THREE.BoxGeometry(w27Tw * 0.88, 0.04, 0.04), 'weatheredPierPlank')
          .translate(lx, deckY + 0.24, lz - w27Td * 0.42),
        tx,
        tz,
        ry
      ),
      w27PlaceLocal(
        remapRelief(new THREE.BoxGeometry(w27Tw * 0.88, 0.04, 0.04), 'weatheredPierPlank')
          .translate(lx, deckY + 0.24, lz + w27Td * 0.42),
        tx,
        tz,
        ry
      ),
      w27PlaceLocal(
        remapRelief(new THREE.BoxGeometry(0.05, 0.07, w27Td), 'weatheredPierPlank')
          .translate(lx - w27Tw * 0.48, deckY + w27Th + 0.03, lz),
        tx,
        tz,
        ry
      ),
      w27PlaceLocal(
        remapRelief(new THREE.BoxGeometry(0.05, 0.07, w27Td), 'weatheredPierPlank')
          .translate(lx + w27Tw * 0.48, deckY + w27Th + 0.03, lz),
        tx,
        tz,
        ry
      )
    );
    // 4 spaced split-bamboo draining tabletop slats
    for (let s = 0; s < 4; s++) {
      const szOff = ((s + 0.5) / 4 - 0.5) * (w27Td - 0.08);
      w27HlAtlas.push(
        w27PlaceLocal(
          remapRelief(new THREE.BoxGeometry(w27Tw, 0.035, 0.09), 'cuaVanOchrePlank')
            .translate(lx, deckY + w27Th, lz + szOff),
          tx,
          tz,
          ry
        )
      );
    }
    // Woven bamboo sorting tray on tabletop + catch basket resting on deck underneath
    w27HlAtlas.push(
      w27PlaceLocal(
        remapRelief(new THREE.CylinderGeometry(0.24, 0.20, 0.08, 4), 'cuaVanOchrePlank')
          .translate(lx - 0.18, deckY + w27Th + 0.06, lz),
        tx,
        tz,
        ry
      ),
      w27PlaceLocal(
        remapRelief(new THREE.BoxGeometry(0.42, 0.26, 0.34), 'cuaVanTurquoisePlank')
          .translate(lx + 0.16, deckY + 0.13, lz),
        tx,
        tz,
        ry
      )
    );
  };
  // Pier south end (world-aligned)
  w27AddSortingTable(92.0, 0.48, -359.4, 0, 0, 0);
  // House 1 (108, -364, ry=-0.06) front-right veranda
  w27AddSortingTable(108.0, 0.43, -364.0, -0.06, 1.15, 2.48);
  // House 4 (113, -352, ry=0.08) front-right veranda
  w27AddSortingTable(113.0, 0.43, -352.0, 0.08, 1.05, 2.32);

  // 27.4 Elevated Lashed-Bamboo Fish & Squid Drying Racks (Giàn Phơi) on gangway-free outer raft decks
  const w27DryingSpecs: Array<[number, number, number, number, number, number]> = [
    // [houseX, houseZ, houseRy, localX, localZ, rackYaw]
    [98.0, -360.0, 0.14, -2.92, 0.0, Math.PI * 0.5],   // House 0 West deck
    [118.0, -361.0, 0.12, 0.0, -2.35, 0],               // House 2 North deck
    [102.0, -351.0, -0.10, -3.02, 0.0, Math.PI * 0.5]   // House 3 West deck
  ];
  for (const [hx, hz, hry, rlx, rlz, rYaw] of w27DryingSpecs) {
    const w27PlaceRack = (g: THREE.BufferGeometry) => {
      g.rotateY(rYaw);
      g.translate(rlx, 0, rlz);
      g.rotateY(hry);
      g.translate(hx, 0, hz);
      return g;
    };
    const w27DeckY = 0.43;
    // 2 vertical bamboo stanchions grounded into deck + 2 angled knee-brace struts
    for (const sx of [-0.82, 0.82]) {
      w27HlAtlas.push(
        w27PlaceRack(
          remapRelief(new THREE.CylinderGeometry(0.036, 0.042, 1.56, 4), 'weatheredPierPlank')
            .translate(sx, w27DeckY + 0.74, 0)
        ),
        w27PlaceRack(
          remapRelief(new THREE.BoxGeometry(0.045, 0.62, 0.045), 'weatheredPierPlank')
            .rotateZ(sx < 0 ? -0.45 : 0.45)
            .translate(sx * 0.82, w27DeckY + 1.24, 0)
        )
      );
    }
    // 3 horizontal bamboo drying bars + 3 sun-curing fish/squid strips
    for (let bar = 0; bar < 3; bar++) {
      const bzOff = (bar - 1) * 0.22;
      w27HlAtlas.push(
        w27PlaceRack(
          remapRelief(new THREE.BoxGeometry(1.92, 0.04, 0.04), 'weatheredPierPlank')
            .translate(0, w27DeckY + 1.46, bzOff)
        ),
        w27PlaceRack(
          remapRelief(new THREE.BoxGeometry(0.32, 0.03, 0.14), bar === 1 ? 'champagneGoldCladding' : 'cuaVanOchrePlank')
            .translate((bar - 1) * 0.46, w27DeckY + 1.49, bzOff)
        )
      );
    }
  }

  // 27.5 Cleated Wooden Boat-Boarding Planks (Cầu Dẫn / Ván Ghép) bridging pier & rafts to moored sampans/coracle
  const w27PlankSpecs: Array<[number, number, number, number, number, number]> = [
    [92.55, 0.48, -355.2, 93.55, 0.34, -355.0],  // Fishing pier -> Sampan #1
    [105.1, 0.43, -348.5, 106.8, 0.32, -347.7],  // House 3 deck -> Sampan #2
    [125.7, 0.43, -356.2, 126.4, 0.32, -357.6],  // House 5 deck -> Sampan #3
    [115.1, 0.43, -348.8, 115.7, 0.36, -346.9]   // House 4 deck -> Moored coracle
  ];
  for (const [px0, py0, pz0, px1, py1, pz1] of w27PlankSpecs) {
    const w27Dx = px1 - px0;
    const w27Dy = py1 - py0;
    const w27Dz = pz1 - pz0;
    const w27Len = Math.hypot(w27Dx, w27Dy, w27Dz);
    const w27Yaw = -Math.atan2(w27Dz, w27Dx);
    const w27Pitch = Math.atan2(w27Dy, Math.hypot(w27Dx, w27Dz));
    const w27Mx = (px0 + px1) * 0.5;
    const w27My = (py0 + py1) * 0.5;
    const w27Mz = (pz0 + pz1) * 0.5;

    const w27OrientPlank = (g: THREE.BufferGeometry) => {
      g.rotateZ(w27Pitch);
      g.rotateY(w27Yaw);
      g.translate(w27Mx, w27My, w27Mz);
      return g;
    };
    // Heavy weathered boarding plank + 3 raised anti-slip transverse grip cleats
    w27HlAtlas.push(
      w27OrientPlank(remapRelief(new THREE.BoxGeometry(w27Len, 0.065, 0.54), 'weatheredPierPlank'))
    );
    for (const cFrac of [-0.30, 0.0, 0.30]) {
      w27HlAtlas.push(
        w27OrientPlank(
          remapRelief(new THREE.BoxGeometry(0.055, 0.035, 0.50), 'cuaVanOchrePlank')
            .translate(cFrac * w27Len, 0.045, 0)
        )
      );
    }
    // Raft-edge timber hinge chock + single bamboo boarding grab-pole offset perpendicular to plank edge
    w27HlAtlas.push(
      makeReliefBox(0.16, 0.08, 0.62, 'weatheredPierPlank', px0, py0 + 0.02, pz0, w27Yaw),
      makeReliefCyl(
        0.032,
        0.038,
        1.15,
        4,
        'weatheredPierPlank',
        px0 + Math.sin(w27Yaw) * 0.34,
        py0 + 0.54,
        pz0 + Math.cos(w27Yaw) * 0.34
      )
    );
  }

  const w27HlAtlasMesh = createMergedMesh('HaLongWave27Atlas', w27HlAtlas, pack.cauVangHaLongMasterAtlasMat, false, true);
  if (w27HlAtlasMesh) group.add(w27HlAtlasMesh);

  tagMotifIds(group, ['HV-D02', 'HV-D06', 'HV-I01', 'HV-J01', 'HV-NEW-MB-08', 'HV-NEW-MB-09', 'HV-NEW-MB-11']);
  ctx.scene.add(group);
  return group;
}
