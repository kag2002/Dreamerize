import * as THREE from 'three';
import {
  VietnamBuilderContext,
  JunkBoatMotion,
  createArchedWallGeometry,
  createGableRoofGeometry
} from './vietnamGeometryHelpers';
import {
  createSmoothTaperedTubeGeometry,
  tagMotifIds
} from './vietnamMotifHelpers';
import { createMergedMesh } from '../vietnam/geometry/PartsBuilder';
import {
  createBenThanhCaiRangMaterialPack,
  BTCR_ART_UV,
  BTCR_RELIEF_UV,
  type BenThanhCaiRangMaterialPack,
  type BtcrArtKey,
  type BtcrReliefKey
} from '../textures/benThanhCaiRangPbrTextures';

/**
 * Chợ Bến Thành (TP. Hồ Chí Minh) & Chợ Nổi Cái Răng (Cần Thơ) Museum Builder
 * Implements all 128 visual QC items:
 *   - Chợ Bến Thành Exterior, Clock Tower, 1952 Biên Hòa Reliefs & Quách Thị Trang Plaza (`BT-01..32`)
 *   - Chợ Bến Thành Vaulted Interior Concourse, Fink Trusses, Rotunda & Bustling Stalls (`BI-01..32`)
 *   - Chợ Nổi Cái Răng Ghe Bầu Fleet, Painted Bow Eyes & Bamboo Cây Bẹo Poles (`CR-01..32`)
 *   - Cần Thơ Timber River Wharf, Retail Hủ Tiếu/Coffee Sampans & Mekong Stilt Shophouses (`CW-01..32`)
 *
 * Shares ONE single 2048×3072 Master PBR & Relief Atlas (`benThanhCaiRangMasterAtlasMat`)
 * across BOTH complexes -> net GPU material reduction (-6 materials vs legacy)!
 */

const btcrPackCache = new WeakMap<THREE.Scene, BenThanhCaiRangMaterialPack>();

function getOrCreateBtcrPack(ctx: VietnamBuilderContext): BenThanhCaiRangMaterialPack {
  let pack = btcrPackCache.get(ctx.scene);
  if (!pack) {
    pack = createBenThanhCaiRangMaterialPack(ctx.renderer);
    btcrPackCache.set(ctx.scene, pack);
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

function remapRelief(geo: THREE.BufferGeometry, key: BtcrReliefKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, BTCR_RELIEF_UV[key], inset);
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: BtcrReliefKey,
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
  key: BtcrReliefKey,
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

function makeArtSubPlane(
  w: number,
  h: number,
  key: BtcrArtKey,
  subU0: number,
  subV0: number,
  subU1: number,
  subV1: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const base = BTCR_ART_UV[key];
  const u0 = base[0] + (base[2] - base[0]) * subU0;
  const v0 = base[1] + (base[3] - base[1]) * subV0;
  const u1 = base[0] + (base[2] - base[0]) * subU1;
  const v1 = base[1] + (base[3] - base[1]) * subV1;
  const g = remapUvRect(new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1], 0.002);
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

/**
 * ============================================================================
 * PART 1: CHỢ BẾN THÀNH — TP. HỒ CHÍ MINH (-108, 190)
 * Implements BT-01..BT-32 & BI-01..BI-32
 * ============================================================================
 */
export function buildBenThanhMarketComplex(ctx: VietnamBuilderContext): THREE.Group {
  const pack = getOrCreateBtcrPack(ctx);
  const cx = -152.0;
  const cz = 190.0;
  const yBase = ctx.getHeight(cx, cz);

  const group = new THREE.Group();
  group.name = 'BenThanhMarketComplex';
  group.position.set(cx, yBase, cz);
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 58.0 },
    { x: cx - 28.0, z: cz - 36.0, r: 24.0 },
    { x: cx + 28.0, z: cz - 36.0, r: 24.0 }
  );

  const atlasParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const darkIronParts: THREE.BufferGeometry[] = [];
  const warmGlowParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  // --------------------------------------------------------------------------
  // 1. QUÁCH THỊ TRANG FORECOURT PLAZA, CROSSWALK, SIDEWALK & POTTED TOPIARY (BT-29..32)
  // --------------------------------------------------------------------------
  // Concrete sidewalk apron around the 98m x 66m market hall (extended downward 0.64m into terrain so it never floats on slopes)
  atlasParts.push(
    makeReliefBox(102.0, 1.0, 70.0, 'benThanhCreamStucco', 0, -0.14, 0)
  );
  // Dark urban asphalt street & white pedestrian zebra crosswalk in front of Cửa Nam (-Z)
  for (let ix = -3; ix <= 3; ix++) {
    const roadTile = remapRelief(new THREE.PlaneGeometry(14.5, 13.0), 'saigonCrosswalkAsphalt');
    roadTile.rotateX(-Math.PI * 0.5);
    roadTile.translate(ix * 14.5, 0.08, -42.0);
    atlasParts.push(roadTile);
  }
  // Symmetrical terracotta-potted tiered ornamental Ficus topiary trees flanking portal (seated on street level y = 0.08)
  for (const px of [-17.5, -5.8, 5.8, 17.5]) {
    atlasParts.push(
      makeReliefCyl(0.68, 0.48, 0.82, 10, 'benThanhTerracottaRoof', px, 0.49, -36.5)
    );
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.8, 7);
    trunk.translate(px, 1.64, -36.5);
    barkParts.push(trunk);
    for (let t = 0; t < 3; t++) {
      const card = new THREE.PlaneGeometry(1.85 - t * 0.3, 1.35);
      card.rotateY(t * 1.05);
      card.translate(px, 2.29 + t * 0.55, -36.5);
      colorizeGeo(card, t % 2 === 0 ? 0x2d6b28 : 0x3d8234);
      leafParts.push(card);
    }
  }
  // Slender cobra-head heritage streetlamps along outer sidewalk edge (grounded down to y = 0.0)
  for (const lx of [-34, -21, -9, 9, 21, 34]) {
    const pole = new THREE.CylinderGeometry(0.08, 0.12, 5.9, 8);
    pole.translate(lx, 2.95, -36.8);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.2);
    arm.translate(lx, 5.85, -37.3);
    darkIronParts.push(pole, arm);
    const bulb = new THREE.SphereGeometry(0.18, 8, 6);
    bulb.translate(lx, 5.75, -37.8);
    warmGlowParts.push(bulb);
  }

  // [017][019][020] Quách Thị Trang Roundabout Plaza, Granite Curbs, Bollards, Bougainvillea Planters & Xích Lô
  // Circular roundabout island & curb ring in front of Cửa Nam (-Z)
  const rbtCurb = remapRelief(new THREE.TorusGeometry(8.6, 0.34, 6, 20), 'benThanhCreamStucco');
  rbtCurb.rotateX(Math.PI * 0.5);
  rbtCurb.translate(0, 0.22, -52.5);
  const rbtMound = remapRelief(new THREE.CylinderGeometry(7.8, 8.2, 0.42, 16), 'benThanhTerracottaRoof');
  rbtMound.translate(0, 0.22, -52.5);
  atlasParts.push(rbtCurb, rbtMound);
  for (let fl = 0; fl < 8; fl++) {
    const fa = (fl / 8) * Math.PI * 2;
    const fShrub = new THREE.SphereGeometry(0.65, 6, 5);
    fShrub.translate(Math.cos(fa) * 5.2, 0.72, -52.5 + Math.sin(fa) * 5.2);
    colorizeGeo(fShrub, fl % 2 === 0 ? 0xd83b7a : 0x3a8530);
    leafParts.push(fShrub);
  }
  // Pedestrian stone bollards & corner sidewalk curbs (grounded to street level y = 0.0)
  for (const bx of [-12, -8, -4, 4, 8, 12]) {
    atlasParts.push(makeReliefCyl(0.14, 0.17, 0.92, 8, 'benThanhCreamStucco', bx, 0.46, -35.2));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      atlasParts.push(makeReliefCyl(1.4, 1.4, 0.38, 8, 'benThanhCreamStucco', sx * 50.5, 0.19, sz * 34.5));
    }
    // Bougainvillea terracotta planters flanking Cửa Nam entrance (grounded to street level)
    atlasParts.push(makeReliefBox(1.8, 0.78, 0.9, 'benThanhTerracottaRoof', sx * 4.8, 0.45, -35.4));
    const bLeaf = new THREE.SphereGeometry(0.62, 6, 5);
    bLeaf.scale(1.4, 0.75, 0.85);
    bLeaf.translate(sx * 4.8, 1.05, -35.4);
    colorizeGeo(bLeaf, 0xc92a6a);
    leafParts.push(bLeaf);
  }
  // Parked vintage Xích Lô (cyclos) along the forecourt curb
  for (const cxOff of [-25.5, 25.5]) {
    const cab = makeReliefBox(1.05, 0.85, 0.95, 'corrugatedTinBlue', cxOff, 0.72, -36.2);
    const hood = makeReliefBox(1.08, 0.12, 0.85, 'benThanhCreamStucco', cxOff, 1.25, -36.1);
    atlasParts.push(cab, hood);
    for (const wx of [-0.58, 0.58]) {
      const wheel = new THREE.TorusGeometry(0.32, 0.05, 5, 10);
      wheel.rotateY(Math.PI * 0.5);
      wheel.translate(cxOff + wx, 0.38, -36.2);
      darkIronParts.push(wheel);
    }
  }

  // [018] Exterior Bến Thành Night-Market & Street-Food Carts along East & West sidewalks (grounded cleanly to y = 0.0)
  for (const side of [-1, 1]) {
    for (let st = 0; st < 4; st++) {
      const stX = side * 52.8;
      const stZ = -21.0 + st * 14.0;
      atlasParts.push(
        makeReliefBox(1.8, 0.92, 2.8, 'wharfWeatheredPlank', stX, 0.46, stZ),
        makeReliefBox(2.2, 0.14, 3.2, st % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', stX, 2.45, stZ),
        makeReliefBox(0.36, 0.42, 0.36, st % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', stX + side * 1.4, 0.21, stZ - 0.6),
        makeReliefBox(0.36, 0.42, 0.36, st % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', stX + side * 1.4, 0.21, stZ + 0.6)
      );
      for (const px of [-0.9, 0.9]) {
        for (const pz of [-1.3, 1.3]) {
          darkIronParts.push(new THREE.CylinderGeometry(0.03, 0.03, 2.45, 5).translate(stX + px, 1.225, stZ + pz));
        }
      }
      warmGlowParts.push(new THREE.SphereGeometry(0.11, 6, 5).translate(stX, 2.32, stZ));
    }
  }

  // --------------------------------------------------------------------------
  // 2. PERIMETER FACADE, GREEN LOUVERED ARCH WINDOWS, CONCRETE RAIN CANOPY & MULTI-TIER ROOFS (BT-17..28)
  // --------------------------------------------------------------------------
  const hallW = 94.0;
  const hallD = 64.0;
  const wallH = 8.4;
  // Dark forest-green masonry base skirting plinth + warm butter-cream walls + continuous concrete rain-canopy awning (BT-22)
  for (const sx of [-1, 1]) {
    const wingW = 33.5;
    const wingCx = sx * 29.5;
    for (const sz of [-1, 1]) {
      const wz = sz * (hallD * 0.5);
      atlasParts.push(
        makeReliefBox(wingW, 0.85, 0.55, 'benThanhGreenShutter', wingCx, 0.78, wz),
        makeReliefBox(wingW, wallH - 0.85, 0.48, 'benThanhCreamStucco', wingCx, 1.2 + (wallH - 0.85) * 0.5, wz),
        // Continuous projecting concrete rain-canopy awning (mái đón bê tông)
        makeReliefBox(wingW + 0.8, 0.28, 1.65, 'benThanhCreamStucco', wingCx, 5.15, wz + sz * 0.75),
        // Upper parapet coping
        makeReliefBox(wingW + 0.6, 0.38, 0.68, 'benThanhCreamStucco', wingCx, wallH + 0.5, wz)
      );
      // 4 Deep arched storefront bays with heritage emerald-green louvered wooden shutters per wing (BT-21)
      for (let b = 0; b < 4; b++) {
        const bx = wingCx - 11.5 + b * 7.6;
        // Pilaster fins flanking each bay
        atlasParts.push(
          makeReliefBox(0.56, wallH, 0.68, 'benThanhCreamStucco', bx - 3.8, 0.36 + wallH * 0.5, wz),
          // Recessed green louvered shuttered arch window
          makeReliefBox(3.4, 3.8, 0.58, 'benThanhGreenShutter', bx, 2.75, wz),
          makeReliefCyl(1.7, 1.7, 0.58, 14, 'benThanhGreenShutter', bx, 4.65, wz, 0, Math.PI * 0.5, 0)
        );
      }
    }
  }
  // [008][009] East & West flank walls + arched louvered windows, pilasters & rain-canopy corbels
  for (const sx of [-1, 1]) {
    const wx = sx * (hallW * 0.5);
    for (const sz of [-1, 1]) {
      const wingD = 20.5;
      const wingCz = sz * 21.0;
      atlasParts.push(
        makeReliefBox(0.55, 0.85, wingD, 'benThanhGreenShutter', wx, 0.78, wingCz),
        makeReliefBox(0.48, wallH - 0.85, wingD, 'benThanhCreamStucco', wx, 1.2 + (wallH - 0.85) * 0.5, wingCz),
        makeReliefBox(1.65, 0.28, wingD + 0.8, 'benThanhCreamStucco', wx + sx * 0.75, 5.15, wingCz),
        makeReliefBox(0.68, 0.38, wingD + 0.6, 'benThanhCreamStucco', wx, wallH + 0.5, wingCz)
      );
      for (let b = 0; b < 3; b++) {
        const bz = wingCz - 6.8 + b * 6.8;
        atlasParts.push(
          makeReliefBox(0.68, wallH, 0.56, 'benThanhCreamStucco', wx, 0.36 + wallH * 0.5, bz - 3.4),
          makeReliefBox(0.58, 3.8, 3.4, 'benThanhGreenShutter', wx, 2.75, bz),
          makeReliefCyl(1.7, 1.7, 0.58, 12, 'benThanhGreenShutter', wx, 4.65, bz, 0, 0, Math.PI * 0.5),
          makeReliefBox(0.95, 0.42, 0.28, 'benThanhCreamStucco', wx + sx * 0.55, 4.88, bz - 3.4)
        );
        darkIronParts.push(new THREE.CylinderGeometry(0.05, 0.05, 7.6, 5).translate(wx + sx * 0.35, 4.2, bz - 3.4));
      }
    }
  }

  // [001][002][003] North Gate (Cửa Bắc, +Z), East Gate (Cửa Đông, +X) & West Gate (Cửa Tây, -X) Portals
  const nArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(9.2, 10.6, 2.8, 5.2, 5.8)), 'benThanhCreamStucco');
  nArch.translate(0, 0.36, hallD * 0.5 + 1.1);
  atlasParts.push(
    nArch,
    makeReliefBox(8.6, 0.28, 1.5, 'benThanhCreamStucco', 0, 5.15, hallD * 0.5 + 2.65),
    makeReliefBox(5.2, 1.45, 0.26, 'benThanhTerracottaRoof', 0, 9.6, hallD * 0.5 + 2.55)
  );
  for (const sx of [-1, 1]) {
    const ewArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(9.2, 10.4, 2.8, 5.0, 5.6)), 'benThanhCreamStucco');
    ewArch.rotateY(sx * Math.PI * 0.5);
    ewArch.translate(sx * (hallW * 0.5 + 1.1), 0.36, 0);
    atlasParts.push(
      ewArch,
      makeReliefBox(1.5, 0.28, 8.6, 'benThanhCreamStucco', sx * (hallW * 0.5 + 2.65), 5.15, 0),
      makeReliefBox(0.26, 1.45, 5.2, 'benThanhTerracottaRoof', sx * (hallW * 0.5 + 2.55), 9.5, 0),
      makeReliefBox(0.32, 0.65, 1.4, 'benThanhGreenShutter', sx * (hallW * 0.5 + 2.45), 7.6, -2.1),
      makeReliefBox(0.32, 0.65, 1.4, 'benThanhGreenShutter', sx * (hallW * 0.5 + 2.45), 7.6, 2.1)
    );
  }

  // [007] Multi-tier pitched corrugated terracotta market roofs + hip-ridge cap tiles & finials (BT-24..26)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const qx = sx * 29.5;
      const qz = sz * 20.5;
      const roof1 = remapRelief(createGableRoofGeometry(34.5, 21.5, 2.6, 0.3, 'x'), 'benThanhTerracottaRoof');
      roof1.translate(qx, wallH + 0.35, qz);
      const monitor = makeReliefBox(28.5, 1.15, 13.5, 'benThanhGreenShutter', qx, wallH + 2.45, qz);
      const roof2 = remapRelief(createGableRoofGeometry(29.8, 14.8, 2.1, 0.25, 'x'), 'benThanhTerracottaRoof');
      roof2.translate(qx, wallH + 3.05, qz);
      const ridgeCap = makeReliefBox(29.2, 0.28, 0.38, 'benThanhTerracottaRoof', qx, wallH + 5.22, qz);
      atlasParts.push(roof1, monitor, roof2, ridgeCap);
      goldParts.push(
        new THREE.SphereGeometry(0.18, 6, 5).translate(qx - 14.2, wallH + 5.45, qz),
        new THREE.SphereGeometry(0.18, 6, 5).translate(qx + 14.2, wallH + 5.45, qz)
      );
    }
  }

  // --------------------------------------------------------------------------
  // 3. CỬA NAM PORTAL, 3-FACED CLOCK TOWER, "CHỢ BẾN THÀNH" LETTERING & 1952 BIÊN HÒA CERAMIC RELIEFS (BT-01..20)
  // --------------------------------------------------------------------------
  const pZ = -hallD * 0.5 - 1.2; // -33.2m local
  // Stepped central portal bay projecting forward from flanking shutter bays (BT-17..18)
  const mainArch = remapRelief(
    normalizeExtrudeUv(createArchedWallGeometry(9.6, 11.4, 3.2, 5.6, 6.2)),
    'benThanhCreamStucco'
  );
  mainArch.translate(0, 0.36, pZ - 0.8);
  atlasParts.push(mainArch);

  // Vertical projecting pilaster ribs on Cửa Nam portal
  for (const px of [-4.6, 4.6, -12.4, 12.4]) {
    atlasParts.push(
      makeReliefBox(0.68, 11.6, 0.75, 'benThanhCreamStucco', px, 6.16, pZ - (Math.abs(px) < 6 ? 0.9 : 0.1))
    );
  }
  // Flanking shutter bays (left & right of main arch) with corrugated metallic roll-up shutters & triple wave-louver vents (BT-19..20)
  for (const side of [-1, 1]) {
    const bx = side * 8.5;
    atlasParts.push(
      makeReliefBox(7.8, 10.2, 2.4, 'benThanhCreamStucco', bx, 5.46, pZ),
      // Fine corrugated metallic silver-grey roll-up shutter
      makeReliefBox(4.8, 4.2, 0.25, 'benThanhRollShutter', bx, 2.55, pZ - 1.15),
      // Concrete rain canopy over flanking shutter
      makeReliefBox(7.6, 0.28, 1.5, 'benThanhCreamStucco', bx, 5.05, pZ - 1.65)
    );
    // 3 horizontal wave-louver vent openings above each side shutter
    for (let v = -1; v <= 1; v++) {
      atlasParts.push(
        makeReliefBox(1.45, 0.56, 0.24, 'benThanhGreenShutter', bx + v * 1.75, 5.95, pZ - 1.15)
      );
    }
  }

  // 1952 BIÊN HÒA POLYCHROME CERAMIC RELIEFS (BT-13..16):
  // Central Cow relief above main arch + Left Stingray relief + Right Banana Cluster relief!
  atlasParts.push(
    // Central Cow ceramic relief frame & plaque
    makeReliefBox(2.35, 2.55, 0.24, 'benThanhCreamStucco', 0, 8.35, pZ - 2.35),
    makeArtSubPlane(2.1, 2.3, 'bienHoaCeramicReliefs', 0.0, 0.0, 0.333, 1.0, 0, 8.35, pZ - 2.49, Math.PI),
    // Left Stingray (Cá Đuối) ceramic relief frame & plaque
    makeReliefBox(1.85, 1.85, 0.22, 'benThanhCreamStucco', -8.5, 8.05, pZ - 1.18),
    makeArtSubPlane(1.62, 1.62, 'bienHoaCeramicReliefs', 0.333, 0.0, 0.666, 1.0, -8.5, 8.05, pZ - 1.31, Math.PI),
    // Right Banana Cluster (Buồng Chuối) ceramic relief frame & plaque
    makeReliefBox(1.85, 1.85, 0.22, 'benThanhCreamStucco', 8.5, 8.05, pZ - 1.18),
    makeArtSubPlane(1.62, 1.62, 'bienHoaCeramicReliefs', 0.666, 0.0, 1.0, 1.0, 8.5, 8.05, pZ - 1.31, Math.PI),
    // Bold black 3D relief "CHỢ BẾN THÀNH" lettering banner directly below clock tower (BT-11..12)
    makeReliefBox(8.4, 1.55, 0.28, 'benThanhCreamStucco', 0, 11.15, pZ - 2.32),
    makeArtSubPlane(8.1, 1.38, 'benThanhClockAndTitle', 0.52, 0.04, 0.98, 0.38, 0, 11.15, pZ - 2.48, Math.PI)
  );

  // [006] Molded architrave & keystone voussoir blocks around Cửa Nam main arch
  for (let kv = -2; kv <= 2; kv++) {
    const ka = kv * 0.38;
    atlasParts.push(
      makeReliefBox(0.46, 0.62, 0.42, 'benThanhCreamStucco', Math.sin(ka) * 2.95, 3.6 + Math.cos(ka) * 2.95, pZ - 2.42, 0, 0, -ka)
    );
  }

  // ICONIC 3-FACED CLOCK TOWER (y = 12.0 .. 28.5m, BT-01..10)
  const twZ = pZ - 0.8;
  const twW = 8.4;
  atlasParts.push(
    // Stepped base ledge
    makeReliefBox(9.2, 0.45, 9.2, 'benThanhCreamStucco', 0, 12.05, twZ),
    // Main cream clock tower shaft
    makeReliefBox(twW, 9.6, twW, 'benThanhCreamStucco', 0, 17.05, twZ),
    // [005] 3 green louvered arch windows below front, West & East clock dials!
    makeArtSubPlane(4.6, 2.2, 'benThanhClockAndTitle', 0.52, 0.52, 0.98, 0.94, 0, 13.75, twZ - twW * 0.5 - 0.06, Math.PI),
    makeArtSubPlane(4.6, 2.2, 'benThanhClockAndTitle', 0.52, 0.52, 0.98, 0.94, -twW * 0.5 - 0.06, 13.75, twZ, -Math.PI * 0.5),
    makeArtSubPlane(4.6, 2.2, 'benThanhClockAndTitle', 0.52, 0.52, 0.98, 0.94, twW * 0.5 + 0.06, 13.75, twZ, Math.PI * 0.5)
  );
  // Corner pilasters & triple-fluted upper corbels (con sơn, BT-06)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(0.76, 9.6, 0.76, 'benThanhCreamStucco', sx * 3.95, 17.05, twZ + sz * 3.95),
        makeReliefBox(0.55, 1.15, 0.95, 'benThanhCreamStucco', sx * 3.55, 21.1, twZ + sz * 4.35)
      );
    }
  }
  // [004] 3 Identical Circular Clock Dials with 3D Sculpted Hour/Minute Hands & Brass Boss
  const clockY = 18.25;
  const clockFaces: Array<[number, number, number]> = [
    [0, twZ - twW * 0.5 - 0.14, Math.PI],
    [-twW * 0.5 - 0.14, twZ, -Math.PI * 0.5],
    [twW * 0.5 + 0.14, twZ, Math.PI * 0.5]
  ];
  for (const [ckX, ckZ, ckRot] of clockFaces) {
    const bezel = remapRelief(new THREE.CylinderGeometry(2.15, 2.22, 0.26, 24), 'benThanhCreamStucco');
    bezel.rotateX(Math.PI * 0.5);
    bezel.rotateY(ckRot);
    bezel.translate(ckX, clockY, ckZ);
    const fx = ckX + Math.sin(ckRot) * 0.15;
    const fz = ckZ + Math.cos(ckRot) * 0.15;
    atlasParts.push(
      bezel,
      makeArtSubPlane(3.9, 3.9, 'benThanhClockAndTitle', 0.02, 0.02, 0.48, 0.98, fx, clockY, fz, ckRot)
    );
    const boss = new THREE.SphereGeometry(0.14, 6, 5);
    boss.translate(fx + Math.sin(ckRot) * 0.05, clockY, fz + Math.cos(ckRot) * 0.05);
    goldParts.push(boss);
    const hHand = new THREE.BoxGeometry(0.10, 0.95, 0.06);
    hHand.translate(0, 0.40, 0);
    hHand.rotateZ(-0.95);
    hHand.rotateY(ckRot);
    hHand.translate(fx + Math.sin(ckRot) * 0.05, clockY, fz + Math.cos(ckRot) * 0.05);
    const mHand = new THREE.BoxGeometry(0.08, 1.38, 0.06);
    mHand.translate(0, 0.58, 0);
    mHand.rotateZ(0.55);
    mHand.rotateY(ckRot);
    mHand.translate(fx + Math.sin(ckRot) * 0.06, clockY, fz + Math.cos(ckRot) * 0.06);
    darkIronParts.push(hHand, mHand);
  }
  // Multi-stepped projecting tower cornice + recessed dark-iron attic grille frieze (BT-04..05)
  atlasParts.push(
    makeReliefBox(9.2, 0.34, 9.2, 'benThanhCreamStucco', 0, 21.95, twZ),
    makeReliefBox(9.7, 0.34, 9.7, 'benThanhCreamStucco', 0, 22.30, twZ),
    makeReliefBox(8.2, 0.78, 8.2, 'benThanhGreenShutter', 0, 22.85, twZ),
    makeReliefBox(10.2, 0.32, 10.2, 'benThanhCreamStucco', 0, 23.38, twZ)
  );
  // STRAIGHT-EDGED 4-SLOPE PYRAMIDAL TERRACOTTA HIP ROOF CAP (ZERO upturned pagoda corners! BT-01..03)
  const pyrRoof = remapRelief(new THREE.ConeGeometry(7.95, 3.65, 4), 'benThanhTerracottaRoof');
  pyrRoof.rotateY(Math.PI * 0.25);
  pyrRoof.translate(0, 25.35, twZ);
  atlasParts.push(pyrRoof);
  // Bronze turned cupola pedestal + tall needle-thin lightning rod spire
  const cupola = new THREE.CylinderGeometry(0.14, 0.34, 0.65, 10);
  cupola.translate(0, 27.45, twZ);
  goldParts.push(cupola);
  const spire = new THREE.CylinderGeometry(0.025, 0.055, 2.35, 8);
  spire.translate(0, 28.9, twZ);
  darkIronParts.push(spire);

  // --------------------------------------------------------------------------
  // 4. INTERIOR CONCOURSE: 35CM CERAMIC TILE FLOOR, ARCHED CONCRETE RIBS, FINK TRUSSES, SKYLIGHT, ROTUNDA & BUSTLING STALLS (BI-01..32)
  // --------------------------------------------------------------------------
  // 35x35cm warm stone-beige glazed ceramic tile concourse floor (BI-12..14)
  for (let iz = -6; iz <= 6; iz++) {
    const fTile = remapRelief(new THREE.PlaneGeometry(10.5, 9.6), 'benThanhConcourseTile');
    fTile.rotateX(-Math.PI * 0.5);
    fTile.translate(0, 0.38, iz * 4.8);
    atlasParts.push(fTile);
  }
  for (let ix = -8; ix <= 8; ix++) {
    if (Math.abs(ix) <= 1) continue;
    const fTile = remapRelief(new THREE.PlaneGeometry(10.5, 9.6), 'benThanhConcourseTile');
    fTile.rotateX(-Math.PI * 0.5);
    fTile.translate(ix * 5.4, 0.38, 0);
    atlasParts.push(fTile);
  }

  // Overhead French-colonial arched concrete portal ribs + pitched dark-steel Fink trusses & bright central skylight slot (BI-01..06)
  for (let tz = -25; tz <= 25; tz += 5.0) {
    // Haunched cream concrete portal piers & arch haunches
    for (const side of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(0.55, 7.8, 0.55, 'benThanhCreamStucco', side * 6.8, 4.25, tz),
        makeReliefBox(2.8, 0.45, 0.52, 'benThanhCreamStucco', side * 5.6, 8.35, tz, 0, 0, -side * 0.32)
      );
    }
    // Pitched dark-steel Fink roof truss + king-post + web struts + longitudinal purlins
    const rL = new THREE.BoxGeometry(7.6, 0.20, 0.18);
    rL.rotateZ(0.28);
    rL.translate(-3.5, 9.45, tz);
    const rR = new THREE.BoxGeometry(7.6, 0.20, 0.18);
    rR.rotateZ(-0.28);
    rR.translate(3.5, 9.45, tz);
    const king = new THREE.BoxGeometry(0.16, 2.2, 0.16);
    king.translate(0, 9.35, tz);
    const tie = new THREE.BoxGeometry(13.6, 0.16, 0.16);
    tie.translate(0, 8.28, tz);
    const webL = new THREE.BoxGeometry(2.6, 0.12, 0.12);
    webL.rotateZ(-0.48);
    webL.translate(-2.4, 8.95, tz);
    const webR = new THREE.BoxGeometry(2.6, 0.12, 0.12);
    webR.rotateZ(0.48);
    webR.translate(2.4, 8.95, tz);
    darkIronParts.push(rL, rR, king, tie, webL, webR);

    // [010] Longitudinal steel sway-bracing purlins & gusset plates
    if (tz < 25) {
      for (const px of [-3.5, 0, 3.5]) {
        const purlin = new THREE.BoxGeometry(0.12, 0.12, 5.0);
        purlin.translate(px, px === 0 ? 10.35 : 9.45, tz + 2.5);
        darkIronParts.push(purlin);
      }
    }

    // Bright translucent clerestory skylight monitor panel & warm pendant market lamps (BI-04, BI-18)
    const skyLight = new THREE.BoxGeometry(4.2, 0.10, 4.6);
    skyLight.translate(0, 10.65, tz);
    warmGlowParts.push(skyLight);
    for (const lx of [-3.6, 0, 3.6]) {
      const cord = new THREE.CylinderGeometry(0.015, 0.015, 1.45, 5);
      cord.translate(lx, 7.55, tz);
      darkIronParts.push(cord);
      const shade = remapRelief(new THREE.ConeGeometry(0.32, 0.22, 8), 'benThanhGreenShutter');
      shade.translate(lx, 6.85, tz);
      atlasParts.push(shade);
      const bulb = new THREE.SphereGeometry(0.14, 8, 6);
      bulb.translate(lx, 6.72, tz);
      warmGlowParts.push(bulb);
    }
  }

  // [011][016] CENTRAL INTERSECTION ROTUNDA (Nhà Lồng Giữa) + Cupola Ring + Cà Phê Phin Counter (BI-10..11)
  for (const sx of [-4.6, 4.6]) {
    for (const sz of [-4.6, 4.6]) {
      atlasParts.push(makeReliefCyl(0.38, 0.44, 8.6, 12, 'benThanhCreamStucco', sx, 4.65, sz));
    }
  }
  atlasParts.push(
    makeReliefCyl(2.6, 2.8, 1.05, 8, 'benThanhCreamStucco', 0, 0.90, 0),
    makeReliefCyl(2.4, 2.4, 0.45, 8, 'benThanhSpiceDryGoods', 0, 1.55, 0),
    makeReliefCyl(0.3, 3.2, 1.15, 8, 'benThanhTerracottaRoof', 0, 3.85, 0),
    makeReliefCyl(3.4, 3.6, 0.35, 8, 'benThanhCreamStucco', 0, 8.55, 0)
  );
  // Cà Phê Phin drip coffee props & folding café table near rotunda
  atlasParts.push(
    makeReliefBox(0.85, 0.08, 0.85, 'wharfWeatheredPlank', 2.8, 1.02, 2.8),
    makeReliefCyl(0.08, 0.08, 0.16, 6, 'benThanhRollShutter', 2.7, 1.14, 2.8),
    makeReliefCyl(0.08, 0.08, 0.16, 6, 'benThanhRollShutter', 2.95, 1.14, 2.75)
  );
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
    atlasParts.push(makeReliefCyl(0.08, 0.08, 2.4, 6, 'wharfWeatheredPlank', Math.cos(a) * 2.1, 2.25, Math.sin(a) * 2.1));
  }

  // [012] East-West Cross-Concourse Market Stalls radiating toward Cửa Đông & Cửa Tây
  for (const ewSide of [-1, 1]) {
    for (const ewX of [-36, -26, -16, 16, 26, 36]) {
      const ewZ = ewSide * 4.4;
      atlasParts.push(
        makeReliefBox(5.2, 0.96, 2.6, 'wharfWeatheredPlank', ewX, 0.86, ewZ),
        makeReliefBox(5.3, 0.10, 2.7, 'benThanhCreamStucco', ewX, 1.36, ewZ),
        makeReliefBox(4.8, 0.45, 1.2, 'benThanhSpiceDryGoods', ewX, 1.62, ewZ)
      );
    }
  }

  // 16 DENSE MULTI-TIER MARKET STALLS flanking the intimate 4.2m N-S concourse (BI-08..09, BI-15..30)
  const stallZs = [-25, -19, -13, -7, 7, 13, 19, 25];
  for (const side of [-1, 1]) {
    const sx = side * 4.4; // Leaves an intimate, bustling ~4.8m central walking corridor!
    // Continuous 2.6m-high market stall overhead fascia signboard band (BI-15..16)
    for (const sz of [-16, 16]) {
      atlasParts.push(
        makeReliefBox(0.24, 0.85, 22.5, 'benThanhTerracottaRoof', side * 2.65, 3.15, sz),
        makeArtSubPlane(5.2, 0.72, 'benThanhStallSigns', 0.02, 0.05, 0.98, 0.95, side * 2.51, 3.15, sz - 6.0, -side * Math.PI * 0.5),
        makeArtSubPlane(5.2, 0.72, 'benThanhStallSigns', 0.02, 0.05, 0.98, 0.95, side * 2.51, 3.15, sz + 6.0, -side * Math.PI * 0.5)
      );
    }

    stallZs.forEach((sz, idx) => {
      // Multi-level counter & floor-to-fascia back wall (NO empty mid-ground wall voids! BI-09, BI-21)
      atlasParts.push(
        makeReliefBox(2.8, 0.96, 5.2, 'wharfWeatheredPlank', sx, 0.86, sz),
        makeReliefBox(2.9, 0.10, 5.3, 'benThanhCreamStucco', sx, 1.36, sz),
        makeReliefBox(0.32, 3.6, 5.4, 'benThanhSilkTextile', side * 5.8, 2.18, sz),
        // Perpendicular hanging stall number plaque (BI-17)
        makeReliefBox(0.68, 0.42, 0.06, 'benThanhTerracottaRoof', side * 2.45, 2.75, sz - 2.4),
        // Support posts
        makeReliefBox(0.12, 2.8, 0.12, 'wharfWeatheredPlank', side * 2.75, 1.78, sz - 2.45),
        makeReliefBox(0.12, 2.8, 0.12, 'wharfWeatheredPlank', side * 2.75, 1.78, sz + 2.45)
      );

      // [013][014][015] Rich 3D differentiated merchandise: draped silk bolts & áo dài, conical nón lá pyramids, 3D spice bowls, coffee tins & lacquerware (BI-22..28)
      if (idx % 2 === 0) {
        for (let b = -1; b <= 1; b++) {
          atlasParts.push(
            makeReliefBox(0.45, 1.35, 1.15, 'benThanhSilkTextile', sx - side * 0.2, 2.15, sz + b * 1.45),
            makeReliefCyl(0.04, 0.44, 0.85, 10, 'wovenBambooBasket', sx - side * 0.85, 1.82, sz + b * 1.35),
            // Hanging Áo Dài silk display + lacquered vase
            makeReliefCyl(0.18, 0.28, 1.25, 8, 'benThanhSilkTextile', sx + side * 0.35, 2.15, sz + b * 1.35),
            makeReliefCyl(0.14, 0.18, 0.38, 8, 'benThanhTerracottaRoof', sx - side * 0.65, 1.58, sz + b * 1.35)
          );
        }
      } else {
        // Stepped wooden counter shelves topped with 3D cylindrical spice bowls, tropical fruit & coffee tins!
        atlasParts.push(
          makeReliefBox(1.5, 0.28, 4.6, 'wharfWeatheredPlank', sx - side * 0.25, 1.54, sz),
          makeReliefBox(0.95, 0.28, 4.4, 'wharfWeatheredPlank', sx + side * 0.22, 1.82, sz)
        );
        for (let b = -2; b <= 2; b++) {
          atlasParts.push(
            makeReliefCyl(0.32, 0.24, 0.32, 10, 'wovenBambooBasket', sx - side * 0.65, 1.82, sz + b * 0.92),
            makeReliefCyl(0.28, 0.28, 0.14, 10, b % 2 === 0 ? 'corrugatedTinRust' : 'watermelonStripedSkin', sx - side * 0.65, 1.98, sz + b * 0.92),
            makeReliefCyl(0.22, 0.22, 0.42, 10, b % 2 === 0 ? 'corrugatedTinBlue' : 'benThanhTerracottaRoof', sx + side * 0.18, 2.16, sz + b * 0.88)
          );
          const fruit = remapRelief(new THREE.SphereGeometry(0.14, 6, 5), b % 2 === 0 ? 'watermelonStripedSkin' : 'benThanhSpiceDryGoods');
          fruit.translate(sx - side * 0.65, 2.12, sz + b * 0.92);
          atlasParts.push(fruit);
        }
      }

      // Molded blue/red plastic vendor stool in front of stall (BI-30)
      atlasParts.push(
        makeReliefBox(0.38, 0.44, 0.38, idx % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', side * 2.45, 0.60, sz + 0.8)
      );
    });
  }

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (201–220) — Low-Poly, castShadow=false
  // ==========================================================================
  const w2Atlas: THREE.BufferGeometry[] = [];
  const w2Gold: THREE.BufferGeometry[] = [];
  const w2Iron: THREE.BufferGeometry[] = [];
  const w2Bark: THREE.BufferGeometry[] = [];
  const w2Leaf: THREE.BufferGeometry[] = [];
  const w2Glow: THREE.BufferGeometry[] = [];

  // [201] North Gate (Cửa Bắc) 1952 Lê Văn Mậu ceramic relief lunettes (ducks & bananas)
  w2Atlas.push(
    makeReliefBox(2.2, 2.0, 0.20, 'benThanhCreamStucco', 0, 8.2, hallD * 0.5 + 2.52),
    makeArtSubPlane(1.95, 1.75, 'bienHoaCeramicReliefs', 0.666, 0.0, 1.0, 1.0, 0, 8.2, hallD * 0.5 + 2.64, 0),
    makeReliefBox(1.5, 1.4, 0.18, 'benThanhCreamStucco', -5.4, 7.6, hallD * 0.5 + 0.32),
    makeArtSubPlane(1.3, 1.2, 'bienHoaCeramicReliefs', 0.333, 0.0, 0.666, 1.0, -5.4, 7.6, hallD * 0.5 + 0.43, 0),
    makeReliefBox(1.5, 1.4, 0.18, 'benThanhCreamStucco', 5.4, 7.6, hallD * 0.5 + 0.32),
    makeArtSubPlane(1.3, 1.2, 'bienHoaCeramicReliefs', 0.0, 0.0, 0.333, 1.0, 5.4, 7.6, hallD * 0.5 + 0.43, 0)
  );
  // [202][203] East Gate (Cửa Đông) & West Gate (Cửa Tây) 1952 Lê Văn Mậu ceramic relief lunettes
  for (const sx of [-1, 1]) {
    const gx = sx * (hallW * 0.5 + 2.52);
    const rotY = sx * Math.PI * 0.5;
    w2Atlas.push(
      makeReliefBox(0.20, 2.0, 2.2, 'benThanhCreamStucco', gx, 8.1, 0),
      makeArtSubPlane(1.95, 1.75, 'bienHoaCeramicReliefs', sx > 0 ? 0.0 : 0.333, 0.0, sx > 0 ? 0.333 : 0.666, 1.0, gx + sx * 0.12, 8.1, 0, rotY)
    );
    for (const szOff of [-5.2, 5.2]) {
      w2Atlas.push(
        makeReliefBox(0.18, 1.4, 1.5, 'benThanhCreamStucco', sx * (hallW * 0.5 + 0.32), 7.5, szOff),
        makeArtSubPlane(1.3, 1.2, 'bienHoaCeramicReliefs', 0.666, 0.0, 1.0, 1.0, sx * (hallW * 0.5 + 0.43), 7.5, szOff, rotY)
      );
    }
  }
  // [204][205] Illuminated West & East Bến Thành Night Market Archways (Cổng Chợ Đêm)
  for (const sx of [-1, 1]) {
    const ax = sx * 53.0;
    const az = -28.0;
    w2Atlas.push(
      makeReliefCyl(0.16, 0.20, 4.6, 6, 'benThanhTerracottaRoof', ax - 2.4, 2.3, az),
      makeReliefCyl(0.16, 0.20, 4.6, 6, 'benThanhTerracottaRoof', ax + 2.4, 2.3, az),
      makeReliefBox(5.6, 0.85, 0.26, 'benThanhTerracottaRoof', ax, 4.65, az)
    );
    w2Gold.push(new THREE.BoxGeometry(5.2, 0.12, 0.30).translate(ax, 5.12, az));
    for (let b = -2; b <= 2; b++) {
      w2Glow.push(new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(ax + b * 1.1, 4.18, az - 0.16));
    }
  }
  // [206] Clock Tower attic corner urn finials & belfry sill ledges
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      w2Gold.push(new THREE.ConeGeometry(0.24, 0.68, 5).translate(sx * 4.5, 23.85, twZ + sz * 4.5));
    }
  }
  w2Atlas.push(
    makeReliefBox(5.0, 0.18, 0.38, 'benThanhCreamStucco', 0, 12.6, twZ - twW * 0.5 - 0.18),
    makeReliefBox(0.38, 0.18, 5.0, 'benThanhCreamStucco', -twW * 0.5 - 0.18, 12.6, twZ),
    makeReliefBox(0.38, 0.18, 5.0, 'benThanhCreamStucco', twW * 0.5 + 0.18, 12.6, twZ)
  );
  // [207] Cửa Nam bronze heritage threshold plaque & step-ramp curbs
  w2Gold.push(new THREE.BoxGeometry(1.4, 0.55, 0.08).translate(3.4, 2.2, pZ - 2.44));
  w2Atlas.push(
    makeReliefBox(0.35, 0.28, 2.2, 'benThanhCreamStucco', -3.2, 0.32, pZ - 2.4),
    makeReliefBox(0.35, 0.28, 2.2, 'benThanhCreamStucco', 3.2, 0.32, pZ - 2.4)
  );
  // [208] Fabric & Áo Dài tailoring measurement tables with stacked silk bolts (SW interior quadrant)
  for (const tz of [-18.0, -10.0]) {
    w2Atlas.push(
      makeReliefBox(2.2, 0.88, 1.2, 'wharfWeatheredPlank', -16.0, 0.82, tz),
      makeReliefCyl(0.14, 0.14, 1.0, 6, 'benThanhSilkTextile', -16.4, 1.38, tz, 0, 0, Math.PI * 0.5),
      makeReliefCyl(0.14, 0.14, 1.0, 6, 'benThanhTerracottaRoof', -15.6, 1.38, tz, 0, 0, Math.PI * 0.5)
    );
  }
  // [209] Dried seafood & Saigon spice counter dial scales & tea/coffee canisters (seated solidly on counter top y = 1.41)
  for (const ex of [16.0, 26.0]) {
    w2Iron.push(new THREE.CylinderGeometry(0.03, 0.05, 0.52, 5).translate(ex, 1.66, 4.4));
    w2Atlas.push(
      makeReliefCyl(0.18, 0.18, 0.10, 6, 'benThanhCreamStucco', ex, 1.98, 4.4, 0, Math.PI * 0.5, 0),
      makeReliefCyl(0.16, 0.16, 0.36, 6, 'benThanhTerracottaRoof', ex + 1.2, 1.56, 4.4)
    );
  }
  // [210] Fresh tropical flower stalls near Cửa Bắc (+Z)
  for (const fx of [-6.8, 6.8]) {
    w2Atlas.push(makeReliefBox(3.4, 0.65, 1.6, 'wharfWeatheredPlank', fx, 0.70, 27.5));
    for (let fl = -1; fl <= 1; fl++) {
      w2Atlas.push(makeReliefCyl(0.22, 0.16, 0.36, 6, 'benThanhTerracottaRoof', fx + fl * 0.9, 1.20, 27.5));
      w2Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.28, 0.36, 5).translate(fx + fl * 0.9, 1.52, 27.5), fl === 0 ? 0xe8b824 : 0xd93a6e));
    }
  }
  // [211] Interior food-court communal dining counters & condiment caddies (NW concourse)
  for (const nz of [12.0, 18.0]) {
    w2Atlas.push(
      makeReliefBox(3.6, 0.82, 1.1, 'benThanhRollShutter', -16.5, 0.78, nz),
      makeReliefBox(0.32, 0.42, 0.32, 'corrugatedTinBlue', -17.4, 0.58, nz - 0.9),
      makeReliefBox(0.32, 0.42, 0.32, 'corrugatedTinRust', -15.6, 0.58, nz - 0.9)
    );
    w2Gold.push(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 5).translate(-16.5, 1.30, nz));
  }
  // [212] Overhead vintage metal ceiling fans suspended directly from interior Fink truss tie-beams (y = 8.28)
  for (const fz of [-20.0, -10.0, 10.0, 20.0]) {
    w2Iron.push(
      new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5).translate(0, 7.55, fz),
      new THREE.BoxGeometry(1.9, 0.04, 0.16).translate(0, 6.8, fz),
      new THREE.BoxGeometry(0.16, 0.04, 1.9).translate(0, 6.8, fz)
    );
  }
  // [213] Central Rotunda brass directional aisle signboards facing 4 cardinal corridors
  for (let d = 0; d < 4; d++) {
    const a = (d / 4) * Math.PI * 2;
    w2Gold.push(new THREE.BoxGeometry(2.2, 0.46, 0.08).rotateY(a).translate(Math.sin(a) * 4.7, 5.8, Math.cos(a) * 4.7));
  }
  // [214] Exterior sidewalk Bánh Mì & Nước Mía pushcarts (SE & SW corners, grounded with canopy posts!)
  for (const sx of [-1, 1]) {
    const cxP = sx * 42.0;
    const czP = -35.8;
    w2Atlas.push(
      makeReliefBox(1.5, 0.92, 0.85, 'benThanhRollShutter', cxP, 0.78, czP),
      makeReliefBox(1.6, 0.10, 1.05, sx < 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', cxP, 1.91, czP)
    );
    w2Iron.push(
      new THREE.CylinderGeometry(0.24, 0.24, 0.08, 6).rotateX(Math.PI * 0.5).translate(cxP - 0.5, 0.30, czP + 0.42),
      new THREE.CylinderGeometry(0.24, 0.24, 0.08, 6).rotateX(Math.PI * 0.5).translate(cxP + 0.5, 0.30, czP + 0.42),
      new THREE.CylinderGeometry(0.025, 0.025, 0.72, 5).translate(cxP - 0.68, 1.55, czP),
      new THREE.CylinderGeometry(0.025, 0.025, 0.72, 5).translate(cxP + 0.68, 1.55, czP)
    );
  }
  // [215] Quách Thị Trang Square central flagpole & tiered floral pedestal
  w2Atlas.push(makeReliefCyl(1.4, 1.8, 0.65, 6, 'benThanhCreamStucco', 0, 0.72, -52.5));
  w2Iron.push(new THREE.CylinderGeometry(0.06, 0.10, 9.5, 6).translate(0, 5.7, -52.5));
  w2Gold.push(new THREE.ConeGeometry(0.16, 0.35, 5).translate(0, 10.6, -52.5));
  // [216] Saigon heritage bus-stop shelter along South forecourt road edge (grounded posts & solid bench block)
  w2Atlas.push(
    makeReliefBox(5.4, 0.14, 1.8, 'corrugatedTinBlue', -32.0, 2.65, -47.5),
    makeReliefBox(3.8, 0.62, 0.48, 'wharfWeatheredPlank', -32.0, 0.31, -47.2)
  );
  for (const bx of [-34.4, -29.6]) {
    w2Iron.push(new THREE.CylinderGeometry(0.05, 0.05, 2.65, 5).translate(bx, 1.325, -47.5));
  }
  // [217] Exterior cast-iron trash receptacles & potted Areca palms at N/E/W gates (seated on sidewalk apron)
  for (const [px, pz] of [[6.2, hallD * 0.5 + 2.2], [-6.2, hallD * 0.5 + 2.2], [hallW * 0.5 + 2.6, 6.0], [-hallW * 0.5 - 2.6, -6.0]]) {
    w2Iron.push(new THREE.CylinderGeometry(0.22, 0.20, 0.75, 6).translate(px, 0.72, pz));
    w2Atlas.push(makeReliefCyl(0.42, 0.32, 0.58, 6, 'benThanhTerracottaRoof', px + 1.1, 0.64, pz));
    w2Bark.push(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 5).translate(px + 1.1, 1.65, pz));
    w2Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.68, 1.15, 5).translate(px + 1.1, 2.55, pz), 0x347d2e));
  }
  // [218] Wrought-iron arched transom grilles in N/E/W portals
  w2Iron.push(
    new THREE.BoxGeometry(4.8, 0.08, 0.08).translate(0, 5.2, hallD * 0.5 + 1.1),
    new THREE.BoxGeometry(0.08, 0.08, 4.6).translate(hallW * 0.5 + 1.1, 5.0, 0),
    new THREE.BoxGeometry(0.08, 0.08, 4.6).translate(-hallW * 0.5 - 1.1, 5.0, 0)
  );
  // [219] Corner roof rainwater collector hoppers & masonry parapet corner pilasters
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      w2Atlas.push(makeReliefBox(0.95, 9.2, 0.95, 'benThanhCreamStucco', sx * (hallW * 0.5 + 0.15), 4.95, sz * (hallD * 0.5 + 0.15)));
      w2Iron.push(new THREE.BoxGeometry(0.42, 0.36, 0.42).translate(sx * (hallW * 0.5 + 0.65), 8.2, sz * (hallD * 0.5 + 0.65)));
    }
  }
  // [220] Interior wooden shipping-crate & hand-truck staging zone (NE service entry)
  w2Atlas.push(
    makeReliefBox(1.1, 0.72, 0.95, 'wharfWeatheredPlank', 38.0, 0.74, 24.0),
    makeReliefBox(0.95, 0.65, 0.85, 'wharfWeatheredPlank', 38.1, 1.42, 24.0),
    makeReliefBox(1.0, 0.72, 0.95, 'wharfWeatheredPlank', 39.4, 0.74, 24.2)
  );
  w2Iron.push(new THREE.BoxGeometry(0.55, 1.25, 0.08).rotateX(-0.22).translate(36.8, 0.98, 24.0));

  // Merge all Chợ Bến Thành batches
  const foliageMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        vertexColors: true,
        roughness: 0.74,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    : ctx.materials.stone;
  const glowMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#fff4cc',
        emissive: '#ffbb44',
        emissiveIntensity: 2.4,
        roughness: 0.25
      })
    : ctx.materials.gold;

  const atlasMesh = createMergedMesh('BenThanhAtlasMesh', atlasParts, pack.benThanhCaiRangMasterAtlasMat, true, true);
  if (atlasMesh) group.add(atlasMesh);
  const goldMesh = createMergedMesh('BenThanhGoldMesh', goldParts, ctx.materials.gold, true, true);
  if (goldMesh) group.add(goldMesh);
  const ironMesh = createMergedMesh('BenThanhIronMesh', darkIronParts, ctx.materials.granite, true, true);
  if (ironMesh) group.add(ironMesh);
  const barkMesh = createMergedMesh('BenThanhBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (barkMesh) group.add(barkMesh);
  const leafMesh = createMergedMesh('BenThanhLeafMesh', leafParts, foliageMat, true, false);
  if (leafMesh) group.add(leafMesh);
  const glowMesh = createMergedMesh('BenThanhGlowMesh', warmGlowParts, glowMat, false, false);
  if (glowMesh) group.add(glowMesh);

  // Wave 2 merged meshes (castShadow = false, zero new materials!)
  const w2AtlasM = createMergedMesh('BenThanhWave2Atlas', w2Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w2AtlasM) group.add(w2AtlasM);
  const w2GoldM = createMergedMesh('BenThanhWave2Gold', w2Gold, ctx.materials.gold, false, false);
  if (w2GoldM) group.add(w2GoldM);
  const w2IronM = createMergedMesh('BenThanhWave2Iron', w2Iron, ctx.materials.granite, false, true);
  if (w2IronM) group.add(w2IronM);
  const w2BarkM = createMergedMesh('BenThanhWave2Bark', w2Bark, ctx.materials.bark, false, true);
  if (w2BarkM) group.add(w2BarkM);
  const w2LeafM = createMergedMesh('BenThanhWave2Leaf', w2Leaf, foliageMat, false, false);
  if (w2LeafM) group.add(w2LeafM);
  const w2GlowM = createMergedMesh('BenThanhWave2Glow', w2Glow, glowMat, false, false);
  if (w2GlowM) group.add(w2GlowM);

  ctx.scene.add(group);
  return group;
}

/**
 * ============================================================================
 * PART 2: CHỢ NỔI CÁI RĂNG — CẦN THƠ (-72, 365)
 * Implements CR-01..CR-32 & CW-01..CW-32
 * ============================================================================
 */
export function buildCaiRangFloatingMarketComplex(ctx: VietnamBuilderContext): JunkBoatMotion[] {
  const pack = getOrCreateBtcrPack(ctx);
  const cx = -72.0;
  const group = new THREE.Group();
  group.name = 'CaiRangFloatingMarketComplex';

  const atlasParts: THREE.BufferGeometry[] = [];
  const darkIronParts: THREE.BufferGeometry[] = [];
  const warmGlowParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const southernBoats: JunkBoatMotion[] = [];

  // --------------------------------------------------------------------------
  // 1. CẦN THƠ TIMBER RIVER WHARF, CORRUGATED SHED, UNOBSTRUCTED ARCHWAY & STACKED CẦN XÉ BASKETS (CW-01..14)
  // --------------------------------------------------------------------------
  const bankY = ctx.getHeight(cx, 334.0);
  const dockY = Math.max(1.25, bankY + 0.35);

  // Distinct 16cm weathered timber deck planks (ZERO wavy zebra stripes! CW-01)
  atlasParts.push(
    makeReliefBox(8.2, 0.28, 13.5, 'wharfWeatheredPlank', cx, dockY, 339.5),
    makeReliefBox(18.6, 0.32, 6.4, 'wharfWeatheredPlank', cx, dockY, 346.6)
  );
  // [030] Support pilings + diagonal cross-bracing + rubber tire dock fenders (CW-03)
  for (const px of [cx - 8.2, cx - 3.6, cx, cx + 3.6, cx + 8.2]) {
    for (const pz of [334.5, 340.5, 344.2, 348.8]) {
      if (Math.abs(px - cx) > 4.5 && pz < 343.0) continue;
      atlasParts.push(makeReliefCyl(0.18, 0.22, dockY + 2.4, 8, 'wharfWeatheredPlank', px, (dockY - 2.2) * 0.5, pz));
      if (pz > 348.0) {
        const tire = new THREE.TorusGeometry(0.36, 0.12, 6, 12);
        tire.translate(px, dockY - 0.15, pz + 0.35);
        darkIronParts.push(tire);
      }
    }
  }
  for (const px of [cx - 5.9, cx - 1.8, cx + 1.8, cx + 5.9]) {
    atlasParts.push(
      makeReliefBox(4.2, 0.14, 0.14, 'wharfWeatheredPlank', px, dockY - 0.65, 348.8, 0, 0, 0.45),
      makeReliefBox(4.2, 0.14, 0.14, 'wharfWeatheredPlank', px, dockY - 0.65, 348.8, 0, 0, -0.45)
    );
  }
  // Riverside landing stairs with timber side-stringers & galvanized handrails (CW-05)
  for (let s = 0; s < 3; s++) {
    atlasParts.push(makeReliefBox(4.4, 0.22, 0.85, 'wharfWeatheredPlank', cx, dockY - 0.22 - s * 0.25, 350.0 + s * 0.72));
  }
  for (const sx of [-2.25, 2.25]) {
    const rail = new THREE.BoxGeometry(0.08, 0.08, 2.4);
    rail.rotateX(0.32);
    rail.translate(cx + sx, dockY + 0.45, 350.6);
    darkIronParts.push(rail);
  }

  // Ribbed corrugated teal-blue tin wharf shed roof + timber trusses + enamel pendant lamps (CW-02, CW-04)
  for (const px of [cx - 7.4, cx - 2.5, cx + 2.5, cx + 7.4]) {
    for (const pz of [344.0, 348.8]) {
      atlasParts.push(makeReliefCyl(0.12, 0.15, 3.4, 8, 'wharfWeatheredPlank', px, dockY + 1.7, pz));
    }
  }
  const shedRoof = remapRelief(createGableRoofGeometry(17.6, 6.8, 1.85, 0.18, 'x'), 'corrugatedTinBlue');
  shedRoof.translate(cx, dockY + 3.35, 346.4);
  atlasParts.push(shedRoof);
  for (let lx = cx - 6.0; lx <= cx + 6.0; lx += 3.0) {
    const shade = remapRelief(new THREE.ConeGeometry(0.28, 0.18, 8), 'benThanhGreenShutter');
    shade.translate(lx, dockY + 3.15, 348.8);
    atlasParts.push(shade);
    const bulb = new THREE.SphereGeometry(0.13, 8, 6);
    bulb.translate(lx, dockY + 3.04, 348.8);
    warmGlowParts.push(bulb);
  }

  // HIGH, UNOBSTRUCTED "CHỢ NỔI CÁI RĂNG — CẦN THƠ" RIVERFRONT ARCHWAY (CW-07..10)
  // Raised to dockY + 5.65m above the wharf shed ridge so it is 100% visible from both river and shore!
  for (const side of [-1, 1]) {
    atlasParts.push(makeReliefCyl(0.18, 0.22, 6.2, 8, 'corrugatedTinRust', cx + side * 4.4, dockY + 3.1, 346.4));
  }
  atlasParts.push(
    makeReliefBox(9.4, 1.65, 0.26, 'corrugatedTinRust', cx, dockY + 5.75, 346.4),
    makeArtSubPlane(9.0, 1.48, 'caiRangWharfArchSign', 0.02, 0.04, 0.98, 0.96, cx, dockY + 5.75, 346.56, 0),
    makeArtSubPlane(9.0, 1.48, 'caiRangWharfArchSign', 0.02, 0.04, 0.98, 0.96, cx, dockY + 5.75, 346.24, Math.PI)
  );

  // [029][039][040] Stacked multi-tier pyramids of woven bamboo wholesale fruit baskets (*cần xé*), wooden crates, bollards & wharf benches (CW-11..14)
  const basketClusters: Array<[number, number]> = [
    [cx - 5.6, 345.8], [cx - 4.4, 346.5], [cx - 4.9, 345.5],
    [cx + 4.4, 345.8], [cx + 5.6, 346.5], [cx + 4.9, 345.5]
  ];
  basketClusters.forEach(([bx, bz], idx) => {
    const by = dockY + 0.16 + (idx % 3 === 2 ? 0.55 : 0);
    atlasParts.push(
      makeReliefCyl(0.56, 0.42, 0.58, 10, 'wovenBambooBasket', bx, by + 0.29, bz),
      // Mound of dark-green striped watermelons & golden pineapples inside basket
      makeReliefCyl(0.48, 0.52, 0.24, 10, idx % 2 === 0 ? 'watermelonStripedSkin' : 'benThanhSpiceDryGoods', bx, by + 0.62, bz)
    );
  });
  for (const wx of [cx - 7.8, cx - 2.8, cx + 2.8, cx + 7.8]) {
    darkIronParts.push(new THREE.CylinderGeometry(0.14, 0.18, 0.52, 7).translate(wx, dockY + 0.42, 349.4));
  }
  for (const side of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(1.15, 0.55, 0.95, 'wharfWeatheredPlank', cx + side * 6.8, dockY + 0.42, 347.2),
      makeReliefBox(1.15, 0.55, 0.95, 'wharfWeatheredPlank', cx + side * 6.8, dockY + 0.97, 347.2),
      makeReliefBox(2.2, 0.46, 0.52, 'wharfWeatheredPlank', cx + side * 5.2, dockY + 0.38, 344.6),
      makeReliefBox(2.4, 0.10, 0.55, 'wharfWeatheredPlank', cx + side * 2.2, dockY + 0.18, 351.2, 0, 0.18, 0)
    );
  }
  // [025][031][035][036] Concrete embankment retaining wall, water hyacinth (*lục bình*) clusters & floating wholesale ice/fuel pontoon
  atlasParts.push(makeReliefBox(84.0, 2.2, 1.4, 'benThanhCreamStucco', cx, 0.4, 333.2));
  const pontoonX = cx + 18.0;
  const pontoonZ = 357.5;
  atlasParts.push(
    makeReliefBox(7.2, 0.65, 3.8, 'wharfWeatheredPlank', pontoonX, 0.24, pontoonZ),
    makeReliefBox(5.8, 0.18, 3.2, 'corrugatedTinBlue', pontoonX, 2.35, pontoonZ),
    makeReliefBox(1.4, 0.95, 1.2, 'benThanhCreamStucco', pontoonX - 1.6, 0.98, pontoonZ),
    makeReliefBox(1.1, 0.72, 1.1, 'corrugatedTinRust', pontoonX + 1.4, 0.88, pontoonZ)
  );
  for (const px of [-2.6, 2.6]) {
    for (const pz of [-1.4, 1.4]) {
      darkIronParts.push(new THREE.CylinderGeometry(0.06, 0.06, 1.85, 5).translate(pontoonX + px, 1.42, pontoonZ + pz));
    }
  }
  for (let h = 0; h < 14; h++) {
    const hx = cx - 34 + h * 5.2;
    const hz = 350.5 + (h % 3) * 1.4;
    const hyLeaf = new THREE.SphereGeometry(0.45, 5, 4);
    hyLeaf.scale(1.4, 0.4, 1.2);
    hyLeaf.translate(hx, 0.08, hz);
    colorizeGeo(hyLeaf, 0x3b8c32);
    leafParts.push(hyLeaf);
  }

  // --------------------------------------------------------------------------
  // 2. CONTINUOUS STAGGERED ROW OF MEKONG STILT SHOPHOUSES + 2-STORY CẦN THƠ TOWN BACKDROP & PALMS (CW-23..32)
  // --------------------------------------------------------------------------
  for (let i = 0; i < 10; i++) {
    const sx = cx - 44.0 + i * 9.8;
    if (Math.abs(sx - cx) < 7.5) continue; // Keep wharf entrance clear
    const sz = 330.5 + (i % 2) * 1.4;
    const sy = Math.max(1.3, ctx.getHeight(sx, sz) + 0.3);
    const hw = 8.6;
    const hd = 6.8;
    const hh = 3.4 + (i % 3) * 0.45;
    // Timber stilts + deck + weathered Mekong shophouse wall + cantilevered striped awning + corrugated gable roof!
    for (const px of [-3.6, 0, 3.6]) {
      atlasParts.push(makeReliefCyl(0.14, 0.16, sy + 1.8, 6, 'wharfWeatheredPlank', sx + px, (sy - 1.5) * 0.5, sz + 3.2));
    }
    atlasParts.push(
      makeReliefBox(hw + 0.8, 0.22, hd + 1.6, 'wharfWeatheredPlank', sx, sy, sz),
      makeReliefBox(hw, hh, hd, 'mekongShophouseWall', sx, sy + hh * 0.5, sz),
      // Projecting cantilevered corrugated/striped awning over river balcony (CW-25)
      makeReliefBox(hw + 0.6, 0.14, 1.85, i % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', sx, sy + 2.45, sz + hd * 0.5 + 0.75, 0, 0.22, 0)
    );
    const sRoof = remapRelief(
      createGableRoofGeometry(hw + 1.0, hd + 1.2, 1.45, 0.16, 'x'),
      i % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust'
    );
    sRoof.translate(sx, sy + hh, sz);
    atlasParts.push(sRoof);

    // [032][033][037][038] Rear veranda solid balustrade, water-access ladders, water jars, drying racks & 2nd-row shophouse signboards
    atlasParts.push(
      makeReliefBox(hw + 0.6, 0.95, 0.10, 'wharfWeatheredPlank', sx, sy + 0.48, sz + hd * 0.5 + 0.72),
      makeReliefBox(0.65, 2.2, 0.12, 'wharfWeatheredPlank', sx + 2.2, sy - 0.85, sz + hd * 0.5 + 0.75, 0, -0.25, 0),
      makeReliefCyl(0.28, 0.22, 0.58, 7, 'benThanhTerracottaRoof', sx - 2.6, sy + 0.35, sz + hd * 0.5 + 0.35),
      makeReliefBox(2.2, 0.08, 0.95, 'wovenBambooBasket', sx, sy + 0.75, sz + hd * 0.5 + 0.35),
      // Second-row 2-story Cần Thơ town shophouse backdrop + signboard & awning (CW-27..28)
      makeReliefBox(8.8, 6.8, 7.2, 'benThanhCreamStucco', sx + 1.2, sy + 3.4, sz - 9.5),
      makeReliefBox(9.2, 0.45, 7.6, 'corrugatedTinRust', sx + 1.2, sy + 6.95, sz - 9.5),
      makeReliefBox(4.8, 0.85, 0.14, i % 2 === 0 ? 'corrugatedTinBlue' : 'benThanhTerracottaRoof', sx + 1.2, sy + 4.4, sz - 5.82)
    );
    warmGlowParts.push(new THREE.SphereGeometry(0.12, 6, 5).translate(sx, sy + 2.25, sz + hd * 0.5 + 0.85));
  }
  // [034] Traditional Mekong Cầu Khỉ (bamboo monkey bridge with grounded X-braced bamboo stilts) & moored dinghy
  atlasParts.push(
    makeReliefBox(0.32, 0.12, 9.5, 'wovenBambooBasket', cx - 18.5, 1.45, 338.5, 0.35),
    makeReliefBox(0.08, 0.08, 9.5, 'wovenBambooBasket', cx - 18.1, 2.32, 338.5, 0.35),
    makeReliefBox(1.1, 0.32, 3.6, 'wharfWeatheredPlank', cx - 25.0, 0.16, 339.5, 0.4)
  );
  for (const tOff of [-3.2, 0.0, 3.2]) {
    const pxB = cx - 18.5 + Math.sin(0.35) * tOff;
    const pzB = 338.5 + Math.cos(0.35) * tOff;
    atlasParts.push(
      makeReliefCyl(0.045, 0.055, 3.1, 5, 'wovenBambooBasket', pxB - 0.18, 0.78, pzB, 0.35, 0, -0.18),
      makeReliefCyl(0.045, 0.055, 3.1, 5, 'wovenBambooBasket', pxB + 0.22, 0.78, pzB, 0.35, 0, 0.18)
    );
  }

  // Dense multi-frond Water-Coconut (*Dừa Nước*) clumps & leaning Mekong Coconut Palms (*Dừa Xiêm*) along shoreline (CW-29..30)
  const palmSpots: Array<[number, number, number]> = [
    [cx - 52, 333, 0.3], [cx - 42, 331, 0.25], [cx - 16, 333, 0.35],
    [cx + 14, 333, -0.25], [cx + 28, 332, -0.3], [cx + 44, 333, -0.2],
    [cx - 38, 386, -0.28], [cx - 18, 388, -0.22], [cx + 8, 387, 0.25], [cx + 30, 386, 0.3]
  ];
  for (const [px, pz, lean] of palmSpots) {
    const py = Math.max(0.2, ctx.getHeight(px, pz));
    // Leaning Mekong coconut palm trunk
    const pCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, py, pz),
      new THREE.Vector3(px + lean * 2.5, py + 4.5, pz + (pz < 350 ? 1.8 : -1.8)),
      new THREE.Vector3(px + lean * 4.5, py + 8.8, pz + (pz < 350 ? 3.4 : -3.4))
    ]);
    barkParts.push(createSmoothTaperedTubeGeometry(pCurve, 8, 6, (t) => 0.24 - t * 0.11));
    const top = pCurve.getPoint(1);
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2;
      const frond = new THREE.PlaneGeometry(0.95, 3.4);
      frond.rotateX(1.08);
      frond.rotateY(a);
      frond.translate(top.x + Math.sin(a) * 1.25, top.y - 0.15, top.z + Math.cos(a) * 1.25);
      colorizeGeo(frond, f % 2 === 0 ? 0x2e7d32 : 0x459c3e);
      leafParts.push(frond);
    }
    // Lower riverside Water-Coconut (*Dừa Nước*) frond cluster at water edge
    for (let nf = 0; nf < 6; nf++) {
      const na = (nf / 6) * Math.PI * 2 + 0.3;
      const nFrond = new THREE.PlaneGeometry(0.85, 2.6);
      nFrond.rotateX(0.75);
      nFrond.rotateY(na);
      nFrond.translate(px + Math.sin(na) * 0.9, 0.85, pz + (pz < 350 ? 2.2 : -2.2) + Math.cos(na) * 0.9);
      colorizeGeo(nFrond, 0x36822f);
      leafParts.push(nFrond);
    }
  }

  // --------------------------------------------------------------------------
  // 3. FLEET OF 28 AUTHENTIC MEKONG GHE BẦU MERCHANT BOATS WITH PAINTED BOW EYES & CÂY BẸO POLES (CR-01..32, CW-21..22)
  // --------------------------------------------------------------------------
  const createGheBauMeshGroup = (idx: number, bLen: number, bBeam: number, yaw: number): THREE.Group => {
    const bGroup = new THREE.Group();
    bGroup.name = `CaiRangMarketBoat_${idx + 1}`;
    const bAtlas: THREE.BufferGeometry[] = [];
    const bIron: THREE.BufferGeometry[] = [];

    // Deep-bellied planked wooden Ghe Bầu cargo hull + raised painted prow with expressive folk bow eyes (*mắt thuyền* on side cheeks ONLY!) (CR-01..05)
    bAtlas.push(
      makeReliefBox(bBeam, 1.05, bLen * 0.68, 'gheBauPlankedHull', 0, 0.36, -bLen * 0.06),
      // Clean tapered wooden stern counter flush with hull
      makeReliefBox(bBeam * 0.72, 1.02, bLen * 0.20, 'gheBauPlankedHull', 0, 0.44, -bLen * 0.44),
      // [021][022][023][028] Upturned painted red-and-green prow + 3D folk bow eyes (*mắt thuyền*) + cabin ribs + fish trap
      makeReliefBox(bBeam * 0.74, 1.04, bLen * 0.28, 'gheBauPaintedProw', 0, 0.50, bLen * 0.34),
      makeReliefBox(bBeam * 0.76, 0.10, bLen * 0.29, 'wharfWeatheredPlank', 0, 1.05, bLen * 0.34),
      // 3D Almond folk bow eyes (*mắt thuyền*) on port & starboard prow cheeks
      makeReliefBox(0.08, 0.26, 0.44, 'benThanhCreamStucco', -bBeam * 0.38, 0.72, bLen * 0.38),
      makeReliefBox(0.08, 0.26, 0.44, 'benThanhCreamStucco', bBeam * 0.38, 0.72, bLen * 0.38),
      // Enclosed mid/aft wooden living cabin with shuttered windows + pitched corrugated *mui thuyền* roof! (CR-06..08)
      makeReliefBox(bBeam * 0.86, 1.18, bLen * 0.42, 'mekongShophouseWall', 0, 1.24, -bLen * 0.16),
      makeReliefBox(bBeam * 0.90, 0.56, 0.75, 'benThanhGreenShutter', 0, 1.32, -bLen * 0.16),
      (() => {
        const roofGable = remapRelief(
          createGableRoofGeometry(bBeam * 0.98, bLen * 0.46, 0.52, 0.10, 'z'),
          idx % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust'
        );
        roofGable.translate(0, 1.82, -bLen * 0.16);
        return roofGable;
      })(),
      // Recessed wooden foredeck cargo hold + woven bamboo baskets & fish trap (*lờ*) (CR-16..17)
      makeReliefBox(bBeam * 0.76, 0.38, bLen * 0.26, 'wharfWeatheredPlank', 0, 0.78, bLen * 0.12),
      makeReliefCyl(0.38, 0.28, 0.44, 8, 'wovenBambooBasket', -bBeam * 0.22, 1.15, bLen * 0.22),
      makeReliefCyl(0.18, 0.22, 0.65, 6, 'wovenBambooBasket', -bBeam * 0.24, 1.12, bLen * 0.35, 0, Math.PI * 0.5, 0),
      // Scalloped foredeck sun umbrella (*dù che nắng*, CR-10)
      makeReliefCyl(0.03, 0.04, 1.8, 6, 'wharfWeatheredPlank', bBeam * 0.22, 1.65, bLen * 0.12),
      makeReliefCyl(0.08, 1.05, 0.38, 10, idx % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', bBeam * 0.22, 2.62, bLen * 0.12)
    );
    // Stern long-tail outboard motor (*máy đuôi tôm*) & propeller shaft
    bIron.push(
      new THREE.BoxGeometry(0.42, 0.38, 0.52).translate(0, 1.05, -bLen * 0.48),
      new THREE.CylinderGeometry(0.025, 0.025, 2.8, 5).rotateX(Math.PI * 0.5 - 0.24).translate(0, 0.68, -bLen * 0.60)
    );
    // 3D mound of dark-green striped watermelons & golden pineapples heaped on foredeck!
    for (let mx = -1; mx <= 1; mx++) {
      for (let mz = -1; mz <= 1; mz++) {
        const melon = remapRelief(
          new THREE.SphereGeometry(0.24, 8, 6),
          idx % 2 === 0 ? 'watermelonStripedSkin' : 'wovenBambooBasket'
        );
        melon.scale(1.15, 0.9, 1.0);
        melon.translate(mx * 0.42, 1.08 + ((mx + mz) & 1) * 0.12, bLen * 0.12 + mz * 0.38);
        bAtlas.push(melon);
      }
    }

    // Thick black rubber bow-bumper tire & side fender tires (CR-03)
    const bowTire = new THREE.TorusGeometry(0.28, 0.09, 6, 10);
    bowTire.translate(0, 0.65, bLen * 0.58);
    bIron.push(bowTire);
    for (const side of [-1, 1]) {
      for (const tz of [-bLen * 0.15, bLen * 0.18]) {
        const sTire = new THREE.TorusGeometry(0.24, 0.08, 6, 10);
        sTire.rotateY(Math.PI * 0.5);
        sTire.translate(side * (bBeam * 0.5 + 0.05), 0.48, tz);
        bIron.push(sTire);
      }
    }

    // Slender, slightly curved bamboo *Cây Bẹo* sample pole at the bow dangling realistic-scale produce! (CR-12..15, CW-22)
    const poleX = 0.15;
    const poleZ = bLen * 0.42;
    bAtlas.push(
      makeReliefCyl(0.022, 0.038, 4.8, 6, 'wovenBambooBasket', poleX, 3.05, poleZ, 0, 0.08, -0.05)
    );
    // [024] 6 Distinct Realistic-scale dangling produce varieties on Cây Bẹo (watermelons, pineapples, pumpkins, cabbages, taro, sugarcane)
    const produceSkins: BtcrReliefKey[] = [
      'watermelonStripedSkin', 'benThanhSpiceDryGoods', 'corrugatedTinRust',
      'benThanhGreenShutter', 'wovenBambooBasket', 'benThanhCreamStucco'
    ];
    const pSkin = produceSkins[idx % produceSkins.length];
    for (let p = 0; p < 4; p++) {
      const py = 3.25 + p * 0.52;
      const pz = poleZ + 0.12 + p * 0.04;
      const sample = idx % 6 === 5
        ? new THREE.CylinderGeometry(0.05, 0.05, 0.85, 5)
        : new THREE.SphereGeometry(0.16, 7, 5);
      remapRelief(sample, pSkin);
      sample.scale(1.0, idx % 6 === 5 ? 1.0 : 1.25, 1.0);
      sample.translate(poleX - 0.12, py, pz);
      bAtlas.push(sample);
    }

    const mAtlas = createMergedMesh(`GheBauAtlas_${idx}`, bAtlas, pack.benThanhCaiRangMasterAtlasMat, true, true);
    if (mAtlas) bGroup.add(mAtlas);
    const mIron = createMergedMesh(`GheBauTires_${idx}`, bIron, ctx.materials.granite, false, false);
    if (mIron) bGroup.add(mIron);

    bGroup.rotation.y = yaw;
    return bGroup;
  };

  const rand = mulberry32(336499);
  for (let i = 0; i < 28; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    let bx = -124.0 + col * 16.5 + (rand() - 0.5) * 4.5;
    let bz = 355.5 + row * 8.2 + (rand() - 0.5) * 2.8;
    // Hero Ghe Bầu #0 positioned cleanly for Shot 05 close-up (-73.5, 360.5)!
    if (i === 0) {
      bx = -73.0;
      bz = 360.5;
    }
    const bLen = 10.2 + (i % 3) * 1.4;
    const bBeam = 2.55 + (i % 2) * 0.35;
    const yaw = i === 0 ? 1.45 : (i % 2 === 0 ? 1.15 : -1.25) + (rand() - 0.5) * 0.35;

    const bGroup = createGheBauMeshGroup(i, bLen, bBeam, yaw);
    bGroup.position.set(bx, 0.04, bz);
    group.add(bGroup);
    southernBoats.push({
      group: bGroup,
      centerX: bx,
      centerZ: bz,
      radiusX: 1.2,
      radiusZ: 0.85,
      speed: 0.16 + (i % 4) * 0.03,
      phase: i * 0.75
    });
  }

  // --------------------------------------------------------------------------
  // 4. 6 AGILE XUỒNG BA LÁ RETAIL SAMPANS (HỦ TIẾU GHE, CÀ PHÊ KHO & KHÓM GỌT) (CW-15..20)
  // --------------------------------------------------------------------------
  const retailSpots: Array<[number, number, number]> = [
    [-112.0, 358.0, 0.85],
    [-92.0, 363.0, -1.10],
    [-77.5, 355.5, 0.95],
    [-64.5, 353.5, -0.82],
    [-46.0, 362.0, 1.12],
    [-28.0, 359.0, -1.25]
  ];
  retailSpots.forEach(([rx, rz, ryaw], rIdx) => {
    const rGroup = new THREE.Group();
    rGroup.name = `CaiRangRetailSampan_${rIdx + 1}`;
    const rParts: THREE.BufferGeometry[] = [];

    // Streamlined planked wooden xuồng ba lá hull + floorboards + posed vendor with nón lá + scalloped umbrella + hủ tiếu / coffee gear
    rParts.push(
      makeReliefBox(1.28, 0.42, 4.6, 'wharfWeatheredPlank', 0, 0.18, 0),
      makeReliefCyl(0.06, 0.62, 1.1, 6, 'gheBauPaintedProw', 0, 0.28, 2.65, 0, Math.PI * 0.45, 0),
      makeReliefCyl(0.06, 0.58, 1.0, 6, 'wharfWeatheredPlank', 0, 0.26, -2.6, 0, -Math.PI * 0.45, 0),
      // Posed vendor in colorful đồ bộ & woven nón lá hat
      makeReliefCyl(0.16, 0.22, 0.72, 8, rIdx % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', 0, 0.68, -1.25),
      makeReliefCyl(0.02, 0.34, 0.22, 10, 'wovenBambooBasket', 0, 1.22, -1.25),
      // [026][027] Hủ tiếu broth pot, noodle cabinet / Cà Phê Kho cooler box & scalloped striped market parasol
      makeReliefBox(0.76, 0.68, 0.92, rIdx % 2 === 0 ? 'benThanhCreamStucco' : 'corrugatedTinBlue', 0, 0.62, 0.55),
      makeReliefCyl(0.24, 0.22, 0.38, 10, 'benThanhRollShutter', 0, 0.58, -0.25),
      makeReliefCyl(0.14, 0.14, 0.22, 7, 'benThanhTerracottaRoof', -0.22, 0.52, 0.18),
      makeReliefBox(0.28, 0.26, 0.28, 'corrugatedTinRust', 0.25, 0.54, -0.65),
      makeReliefCyl(0.03, 0.04, 1.85, 6, 'wharfWeatheredPlank', 0.25, 1.25, 0.15),
      makeReliefCyl(0.08, 1.15, 0.38, 12, rIdx % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', 0.25, 2.25, 0.15)
    );

    const rMesh = createMergedMesh(`RetailSampanMesh_${rIdx}`, rParts, pack.benThanhCaiRangMasterAtlasMat, true, true);
    if (rMesh) rGroup.add(rMesh);
    rGroup.position.set(rx, 0.03, rz);
    rGroup.rotation.y = ryaw;
    group.add(rGroup);
    southernBoats.push({
      group: rGroup,
      centerX: rx,
      centerZ: rz,
      radiusX: 1.5,
      radiusZ: 1.1,
      speed: 0.25 + (rIdx % 3) * 0.04,
      phase: rIdx * 1.1
    });
  });

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (221–240) — Low-Poly, castShadow=false
  // ==========================================================================
  const crW2Atlas: THREE.BufferGeometry[] = [];
  const crW2Iron: THREE.BufferGeometry[] = [];
  const crW2Bark: THREE.BufferGeometry[] = [];
  const crW2Leaf: THREE.BufferGeometry[] = [];
  const crW2Glow: THREE.BufferGeometry[] = [];

  // [221] Floating Hủ Tiếu noodle-boat arched tarpaulin canopies with hanging lanterns on moored kitchen rafts
  for (const [kx, kz] of [[cx - 11.5, 353.0], [cx + 11.5, 353.0]]) {
    crW2Atlas.push(
      makeReliefBox(3.4, 0.36, 5.2, 'wharfWeatheredPlank', kx, 0.16, kz),
      makeReliefBox(3.2, 0.12, 4.6, 'corrugatedTinBlue', kx, 2.05, kz),
      makeReliefBox(1.1, 0.72, 1.4, 'benThanhCreamStucco', kx, 0.72, kz + 0.6)
    );
    for (const px of [-1.4, 1.4]) {
      for (const pz of [-2.0, 2.0]) {
        crW2Iron.push(new THREE.CylinderGeometry(0.03, 0.03, 1.85, 5).translate(kx + px, 1.12, kz + pz));
      }
    }
    crW2Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kx, 1.92, kz));
  }
  // [222] Floating wholesale fruit-sorting timber rafts moored mid-market with bamboo sorting tables & produce sacks
  for (const [rx, rz] of [[cx - 32.0, 366.0], [cx + 28.0, 364.0]]) {
    crW2Atlas.push(
      makeReliefBox(5.6, 0.32, 4.2, 'wharfWeatheredPlank', rx, 0.14, rz),
      makeReliefBox(2.4, 0.65, 1.2, 'wovenBambooBasket', rx - 1.0, 0.62, rz),
      makeReliefCyl(0.36, 0.42, 0.65, 6, 'watermelonStripedSkin', rx + 1.2, 0.62, rz - 0.8),
      makeReliefCyl(0.36, 0.42, 0.65, 6, 'benThanhSpiceDryGoods', rx + 1.2, 0.62, rz + 0.8)
    );
  }
  // [223] Riverbank Mekong tropical orchard behind stilt village (rambutan/mango trees + harvest ladders)
  for (let ot = 0; ot < 6; ot++) {
    const ox = cx - 36.0 + ot * 14.5;
    const oz = 315.5 + (ot % 2) * 2.5;
    const oy = Math.max(1.2, ctx.getHeight(ox, oz));
    crW2Bark.push(new THREE.CylinderGeometry(0.14, 0.20, 2.8, 5).translate(ox, oy + 1.4, oz));
    crW2Leaf.push(colorizeGeo(new THREE.ConeGeometry(2.1, 2.4, 6).translate(ox, oy + 3.4, oz), ot % 2 === 0 ? 0x2f7a2c : 0x3e8d34));
    if (ot % 2 === 0) {
      crW2Atlas.push(makeReliefBox(0.55, 2.4, 0.08, 'wovenBambooBasket', ox + 0.9, oy + 1.2, oz + 0.6, 0, -0.22, 0));
    }
  }
  // [224][225] Wharfside Bánh Tét & grilled-banana stall + wholesale beam-scale (cân tạ) tripod
  crW2Atlas.push(
    makeReliefBox(1.8, 0.82, 0.95, 'wharfWeatheredPlank', cx - 6.8, dockY + 0.56, 344.2),
    makeReliefCyl(0.24, 0.22, 0.28, 6, 'benThanhTerracottaRoof', cx - 7.3, dockY + 1.10, 344.2),
    makeReliefCyl(0.42, 0.34, 0.42, 6, 'wovenBambooBasket', cx + 3.2, dockY + 0.65, 347.8)
  );
  for (let lg = 0; lg < 3; lg++) {
    const la = (lg / 3) * Math.PI * 2;
    crW2Iron.push(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5).rotateZ(0.28).rotateY(la).translate(cx + 3.2 + Math.cos(la) * 0.35, dockY + 1.1, 347.8 + Math.sin(la) * 0.35));
  }
  // [226] Floating wooden fuel-drum & ice-crusher shed off eastern end of wholesale pontoon (with 4 corner posts!)
  crW2Atlas.push(
    makeReliefBox(3.4, 0.42, 2.8, 'wharfWeatheredPlank', pontoonX + 5.6, 0.20, pontoonZ),
    makeReliefBox(3.2, 0.14, 2.6, 'corrugatedTinRust', pontoonX + 5.6, 2.1, pontoonZ),
    makeReliefCyl(0.32, 0.32, 0.88, 6, 'corrugatedTinBlue', pontoonX + 4.8, 0.85, pontoonZ),
    makeReliefCyl(0.32, 0.32, 0.88, 6, 'benThanhTerracottaRoof', pontoonX + 6.2, 0.85, pontoonZ)
  );
  for (const px of [-1.4, 1.4]) {
    for (const pz of [-1.1, 1.1]) {
      crW2Iron.push(new THREE.CylinderGeometry(0.04, 0.04, 1.75, 5).translate(pontoonX + 5.6 + px, 1.22, pontoonZ + pz));
    }
  }
  // [227] Stilt-house timber boat-repair slipway (ụ sửa ghe) along western mudbank
  crW2Atlas.push(
    makeReliefBox(2.2, 0.24, 7.2, 'wharfWeatheredPlank', cx - 34.0, 0.65, 338.0, 0, 0.18, 0),
    makeReliefBox(1.5, 0.65, 5.4, 'gheBauPlankedHull', cx - 34.0, 1.15, 337.5, 0, 0.18, 0)
  );
  // [228] Hanging fishing nets draped over bamboo drying poles along riverfront
  for (const nx of [cx - 12.5, cx + 12.5]) {
    crW2Atlas.push(
      makeReliefCyl(0.04, 0.05, 2.4, 5, 'wovenBambooBasket', nx - 1.6, 1.4, 334.2),
      makeReliefCyl(0.04, 0.05, 2.4, 5, 'wovenBambooBasket', nx + 1.6, 1.4, 334.2),
      makeReliefBox(3.2, 1.35, 0.06, 'wovenBambooBasket', nx, 1.75, 334.2)
    );
  }
  // [229] Riverside Quán Cà Phê Võng (hammock coffee pavilion with 4 grounded timber corner posts!)
  const cfX = cx + 14.5;
  const cfZ = 334.5;
  const cfY = Math.max(1.2, ctx.getHeight(cfX, cfZ));
  crW2Atlas.push(
    makeReliefBox(5.2, 0.20, 4.2, 'wharfWeatheredPlank', cfX, cfY + 0.10, cfZ),
    makeReliefBox(5.6, 0.16, 4.6, 'corrugatedTinBlue', cfX, cfY + 2.75, cfZ),
    makeReliefBox(2.0, 0.14, 0.72, 'benThanhSilkTextile', cfX - 0.8, cfY + 0.95, cfZ),
    makeReliefBox(2.0, 0.14, 0.72, 'benThanhSilkTextile', cfX + 1.1, cfY + 0.95, cfZ + 0.8)
  );
  for (const px of [-2.4, 2.4]) {
    for (const pz of [-1.9, 1.9]) {
      crW2Atlas.push(makeReliefCyl(0.08, 0.10, 3.25, 5, 'wharfWeatheredPlank', cfX + px, cfY + 1.12, cfZ + pz));
    }
  }
  // [230] Timber river-depth gauge post (thước đo mực nước) beside wharf pilings
  crW2Atlas.push(
    makeReliefBox(0.18, 3.2, 0.18, 'benThanhCreamStucco', cx - 8.8, 1.2, 349.6),
    makeReliefBox(0.20, 0.55, 0.20, 'corrugatedTinRust', cx - 8.8, 1.6, 349.6),
    makeReliefBox(0.20, 0.55, 0.20, 'corrugatedTinBlue', cx - 8.8, 0.6, 349.6)
  );
  // [231] Stacked sugarcane & coconut wholesale piles under striped tarps (with 4 bamboo corner poles!)
  crW2Atlas.push(
    makeReliefCyl(0.38, 0.45, 1.6, 6, 'benThanhGreenShutter', cx - 2.6, dockY + 0.42, 340.5, 0, Math.PI * 0.5, 0),
    makeReliefBox(2.2, 0.62, 1.4, 'watermelonStripedSkin', cx + 2.6, dockY + 0.45, 340.5),
    makeReliefBox(2.6, 0.10, 1.8, 'corrugatedTinRust', cx + 2.6, dockY + 1.65, 340.5)
  );
  for (const px of [-1.15, 1.15]) {
    for (const pz of [-0.75, 0.75]) {
      crW2Atlas.push(makeReliefCyl(0.03, 0.04, 1.52, 5, 'wovenBambooBasket', cx + 2.6 + px, dockY + 0.89, 340.5 + pz));
    }
  }
  // [232] Mekong wooden footbridge stairs & mud-bank retaining timber palisades east of wharf
  for (let p = 0; p < 8; p++) {
    crW2Atlas.push(makeReliefCyl(0.10, 0.12, 2.2, 5, 'wharfWeatheredPlank', cx + 10.5 + p * 1.4, 0.65, 336.5));
  }
  // [233] Miniature River God Shrine (Miếu Thổ Địa / Miếu Bà Sông Nước) at wharf corner
  crW2Atlas.push(
    makeReliefCyl(0.10, 0.12, 1.4, 6, 'wharfWeatheredPlank', cx + 8.4, dockY + 0.70, 344.2),
    makeReliefBox(0.95, 0.85, 0.85, 'benThanhTerracottaRoof', cx + 8.4, dockY + 1.75, 344.2),
    makeReliefCyl(0.06, 0.82, 0.48, 4, 'benThanhTerracottaRoof', cx + 8.4, dockY + 2.42, 344.2, Math.PI * 0.25)
  );
  // [234] Wooden hand-carts & bicycle cargo trailers parked behind wharf archway
  for (const hx of [cx - 2.2, cx + 2.2]) {
    crW2Atlas.push(makeReliefBox(1.1, 0.42, 1.6, 'wharfWeatheredPlank', hx, dockY + 0.56, 335.2));
    crW2Iron.push(
      new THREE.CylinderGeometry(0.28, 0.28, 0.08, 6).rotateZ(Math.PI * 0.5).translate(hx - 0.62, dockY + 0.34, 335.2),
      new THREE.CylinderGeometry(0.28, 0.28, 0.08, 6).rotateZ(Math.PI * 0.5).translate(hx + 0.62, dockY + 0.34, 335.2)
    );
  }
  // [235] Floating bamboo mooring-boom clusters (cọc neo ghe) tied in tripod bundles
  for (const [mx, mz] of [[cx - 46.0, 354.0], [cx - 16.0, 372.0], [cx + 22.0, 374.0], [cx + 42.0, 356.0]]) {
    for (let k = 0; k < 3; k++) {
      const ka = (k / 3) * Math.PI * 2;
      crW2Atlas.push(makeReliefCyl(0.06, 0.08, 3.2, 5, 'wovenBambooBasket', mx + Math.cos(ka) * 0.25, 1.1, mz + Math.sin(ka) * 0.25, ka, 0.14, 0));
    }
  }
  // [236][237] Stilt-house roof vents, rainwater gutters & painted wooden trade signboards
  for (let i = 0; i < 6; i++) {
    const sx = cx - 44.0 + i * 16.0;
    if (Math.abs(sx - cx) < 8.0) continue;
    const sz = 330.5;
    const sy = Math.max(1.3, ctx.getHeight(sx, sz) + 0.3);
    crW2Atlas.push(
      makeReliefBox(3.4, 0.55, 0.12, i % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', sx, sy + 2.85, sz + 3.55),
      makeReliefBox(8.2, 0.12, 0.16, 'benThanhRollShutter', sx, sy + 3.35, sz + 3.45)
    );
  }
  // [238] Moored floating coconut-husk & pineapple-peeling work sampan beside sorting raft
  crW2Atlas.push(
    makeReliefBox(1.2, 0.38, 4.4, 'wharfWeatheredPlank', cx - 26.5, 0.16, 366.5, 0.45),
    makeReliefCyl(0.32, 0.26, 0.36, 6, 'wovenBambooBasket', cx - 26.5, 0.52, 366.5)
  );
  // [239] Warm festoon string-lights draped from wharf archway posts to flanking eaves
  for (const sx of [-1, 1]) {
    for (let f = 1; f <= 4; f++) {
      crW2Glow.push(new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(cx + sx * (4.4 + f * 1.8), dockY + 5.2 - f * 0.35, 344.5 - f * 1.4));
    }
  }
  // [240] Southern riverbank reed beds & wooden mooring stakes framing far bank of Cần Thơ River
  for (let r = 0; r < 10; r++) {
    const rx = cx - 40.0 + r * 9.0;
    const rz = 384.5 + (r % 2) * 1.5;
    crW2Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.65, 1.45, 5).translate(rx, 0.65, rz), 0x3b8430));
    if (r % 2 === 0) {
      crW2Atlas.push(makeReliefCyl(0.06, 0.08, 1.8, 5, 'wharfWeatheredPlank', rx + 0.8, 0.65, rz - 1.2));
    }
  }

  // Merge all static Cái Răng batches
  const foliageMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        map: ctx.pbr.leafAtlas,
        alphaTest: 0.42,
        vertexColors: true,
        roughness: 0.74,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    : ctx.materials.stone;
  const glowMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#fff2be',
        emissive: '#ffaa33',
        emissiveIntensity: 2.5,
        roughness: 0.25
      })
    : ctx.materials.gold;

  const crAtlasMesh = createMergedMesh('CaiRangAtlasMesh', atlasParts, pack.benThanhCaiRangMasterAtlasMat, true, true);
  if (crAtlasMesh) group.add(crAtlasMesh);
  const crIronMesh = createMergedMesh('CaiRangIronMesh', darkIronParts, ctx.materials.granite, true, true);
  if (crIronMesh) group.add(crIronMesh);
  const crBarkMesh = createMergedMesh('CaiRangBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (crBarkMesh) group.add(crBarkMesh);
  const crLeafMesh = createMergedMesh('CaiRangLeafMesh', leafParts, foliageMat, true, false);
  if (crLeafMesh) group.add(crLeafMesh);
  const crGlowMesh = createMergedMesh('CaiRangGlowMesh', warmGlowParts, glowMat, false, false);
  if (crGlowMesh) group.add(crGlowMesh);

  // Wave 2 merged meshes (castShadow = false, zero new materials!)
  const crW2AtlasM = createMergedMesh('CaiRangWave2Atlas', crW2Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW2AtlasM) group.add(crW2AtlasM);
  const crW2IronM = createMergedMesh('CaiRangWave2Iron', crW2Iron, ctx.materials.granite, false, true);
  if (crW2IronM) group.add(crW2IronM);
  const crW2BarkM = createMergedMesh('CaiRangWave2Bark', crW2Bark, ctx.materials.bark, false, true);
  if (crW2BarkM) group.add(crW2BarkM);
  const crW2LeafM = createMergedMesh('CaiRangWave2Leaf', crW2Leaf, foliageMat, false, false);
  if (crW2LeafM) group.add(crW2LeafM);
  const crW2GlowM = createMergedMesh('CaiRangWave2Glow', crW2Glow, glowMat, false, false);
  if (crW2GlowM) group.add(crW2GlowM);

  tagMotifIds(group, ['HV-C06', 'HV-I04', 'HV-NEW-MN-01', 'HV-NEW-MN-11']);
  ctx.scene.add(group);
  return southernBoats;
}
