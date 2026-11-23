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

    // Item 002: Sculpted palm lifeline/muscle creases & stratified granite wrist-cuff outcrops
    for (let cr = 0; cr < 3; cr++) {
      const crease = remapRelief(new THREE.BoxGeometry(2.6 - cr * 0.4, 0.18, 0.24), 'giantHandMossyStone');
      crease.rotateY((cr - 1) * 0.28);
      crease.translate(palmX + sideSign * (cr - 1) * 0.65, palmY + 0.42, palmZ + 1.4 - cr * 0.45);
      handParts.push(crease);
    }
    const wristCollar = remapRelief(new THREE.CylinderGeometry(3.4, 3.8, 1.25, 10), 'giantHandMossyStone');
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

    // Item 006: Curved stainless-steel handrail end-scroll terminals flaring into station plazas
    const endX = isWest ? -75 : 75;
    for (const side of [-1, 1]) {
      const scroll = new THREE.TorusGeometry(0.45, 0.055, 6, 10, Math.PI * 0.75);
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

  // Item 010 (Area Expansion): Le Jardin d'Amour geometric boxwood-bordered flower parterres east of East station (x = 94..112)
  for (let px = 94; px <= 108; px += 7) {
    for (const pz of [-150.5, -140.5]) {
      const py = Math.max(
        ctx.getHeight(px, pz),
        ctx.getHeight(px - 2.6, pz - 2.6),
        ctx.getHeight(px + 2.6, pz - 2.6),
        ctx.getHeight(px - 2.6, pz + 2.6),
        ctx.getHeight(px + 2.6, pz + 2.6)
      );
      atlasParts.push(
        makeReliefBox(5.6, 2.6, 5.6, 'chateauAshlarStone', px, py - 1.15, pz),
        makeReliefBox(5.7, 0.28, 5.7, 'baNaMosaicPaver', px, py + 0.18, pz),
        makeReliefBox(4.8, 0.42, 4.8, 'lobeliaVioletBloom', px, py + 0.46, pz)
      );
      const hedge = new THREE.BoxGeometry(5.2, 0.48, 0.38);
      hedge.translate(px, py + 0.46, pz + 2.5);
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
      makeReliefCyl(0.55, 0.38, 0.58, 10, 'chateauAshlarStone', w, wy + 0.58, wz + 1.85),
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
    // Item 019: Additional Bà Nà broadleaf canopy trees on eastern Le Jardin d'Amour slope
    [90, -154, 1.45, 915], [102, -155, 1.52, 916], [96, -134, 1.38, 917]
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
  // 439: Bà Nà mist-shrouded pine clusters framing Luna Castle & Chùa Linh Ứng
  for (const [tx, tz] of [[-134, -176], [-116, -184], [132, -174], [116, -180]] as const) {
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
    const band = remapRelief(new THREE.CylinderGeometry(br, br * 1.12, 0.48, 12), 'chateauAshlarStone');
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

  // Item 021 (cont) & 023: Waterline oyster mineral bands on Hòn Đỉnh Hương legs + hanging stalactites inside open sea-arch
  for (const side of [-1, 1]) {
    const legBand = remapRelief(new THREE.CylinderGeometry(1.72, 1.95, 0.46, 10), 'chateauAshlarStone');
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
  // Item 024: Bamboo-woven coracle boats (*thuyền thúng*) moored alongside Cửa Vạn rafts
  for (const [tx, tz] of [[96.2, -365.5], [115.8, -346.2]]) {
    const coracle = remapRelief(new THREE.CylinderGeometry(0.82, 0.52, 0.42, 10), 'weatheredPierPlank');
    coracle.translate(tx, 0.20, tz);
    atlasParts.push(coracle);
  }
  // Item 025 & 026: Aquaculture net-pen posts, red/yellow mooring buoys & leaning wooden oars at Cửa Vạn
  for (const [bx, bz] of [[95.5, -350.5], [120.5, -350.0], [109.5, -368.5]]) {
    const buoy = remapRelief(new THREE.SphereGeometry(0.28, 8, 6), 'corrugatedTinRoof');
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

  tagMotifIds(group, ['HV-D02', 'HV-D06', 'HV-I01', 'HV-J01', 'HV-NEW-MB-08', 'HV-NEW-MB-09', 'HV-NEW-MB-11']);
  ctx.scene.add(group);
  return group;
}
