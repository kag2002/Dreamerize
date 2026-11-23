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
  // [217] Exterior cast-iron trash receptacles & potted Areca palms at N/E/W gates (seated cleanly outside gates)
  for (const [px, pz] of [[6.2, hallD * 0.5 + 2.2], [-6.2, hallD * 0.5 + 2.2], [hallW * 0.5 + 2.6, 6.0], [-hallW * 0.5 - 2.6, -6.0]]) {
    const palmX = px + (px >= 0 ? 1.1 : -1.1);
    w2Iron.push(new THREE.CylinderGeometry(0.22, 0.20, 0.75, 6).translate(px, 0.72, pz));
    w2Atlas.push(makeReliefCyl(0.42, 0.32, 0.58, 6, 'benThanhTerracottaRoof', palmX, 0.64, pz));
    w2Bark.push(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 5).translate(palmX, 1.65, pz));
    w2Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.68, 1.15, 5).translate(palmX, 2.55, pz), 0x347d2e));
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

  // ==========================================================================
  // WAVE 3 REAL-WORLD VISUAL QC UPGRADES (401–460) — Low-Poly, castShadow=false
  // ==========================================================================
  const w3Atlas: THREE.BufferGeometry[] = [];
  const w3Gold: THREE.BufferGeometry[] = [];
  const w3Iron: THREE.BufferGeometry[] = [];
  const w3Bark: THREE.BufferGeometry[] = [];
  const w3Leaf: THREE.BufferGeometry[] = [];
  const w3Glow: THREE.BufferGeometry[] = [];

  // [401][402][403][413] Art-Deco Clock Tower upper cornice bands, corner fluted ribs, bronze clock frames & apex lightning mast
  w3Atlas.push(
    makeReliefBox(twW + 0.95, 0.34, twW + 0.95, 'benThanhCreamStucco', 0, 22.8, twZ),
    makeReliefBox(twW + 0.65, 0.24, twW + 0.65, 'benThanhTerracottaRoof', 0, 23.12, twZ)
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      w3Atlas.push(makeReliefBox(0.42, 11.4, 0.42, 'benThanhCreamStucco', sx * (twW * 0.5 + 0.08), 17.2, twZ + sz * (twW * 0.5 + 0.08)));
    }
  }
  w3Gold.push(
    new THREE.BoxGeometry(2.75, 2.75, 0.14).translate(0, 18.6, twZ - twW * 0.5 - 0.12),
    new THREE.BoxGeometry(0.14, 2.75, 2.75).translate(-twW * 0.5 - 0.12, 18.6, twZ),
    new THREE.BoxGeometry(0.14, 2.75, 2.75).translate(twW * 0.5 + 0.12, 18.6, twZ),
    // Apex lightning mast seated flush into tower roof peak (pyrRoof apex = 27.175m)
    new THREE.CylinderGeometry(0.03, 0.06, 2.6, 5).translate(0, 28.45, twZ),
    new THREE.ConeGeometry(0.16, 0.32, 5).translate(0, 29.85, twZ)
  );
  // [404][405] Art-Deco stepped pediment scrolls & Cửa Nam portico brass door-stop bollards
  for (const sx of [-1, 1]) {
    w3Atlas.push(
      makeReliefBox(1.4, 0.95, 0.48, 'benThanhCreamStucco', sx * 5.2, 11.4, pZ - 0.85),
      makeReliefBox(0.95, 0.65, 0.48, 'benThanhCreamStucco', sx * 6.2, 10.7, pZ - 0.85)
    );
    w3Gold.push(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 5).translate(sx * 2.5, 0.68, pZ - 0.8));
  }
  // [406][407][408][414][415] North/East/West Gate transom hoods, keystones, entrance lanterns & heritage gate-name plaques
  w3Atlas.push(
    makeReliefBox(2.2, 0.34, 0.55, 'benThanhGreenShutter', -2.6, 7.6, hallD * 0.5 + 2.45),
    makeReliefBox(2.2, 0.34, 0.55, 'benThanhGreenShutter', 2.6, 7.6, hallD * 0.5 + 2.45),
    makeReliefBox(0.95, 0.95, 0.45, 'benThanhCreamStucco', 0, 6.4, hallD * 0.5 + 2.52)
  );
  w3Gold.push(new THREE.BoxGeometry(3.6, 0.52, 0.10).translate(0, 5.65, hallD * 0.5 + 3.42));
  for (const sx of [-1, 1]) {
    w3Atlas.push(
      makeReliefBox(0.45, 0.95, 0.95, 'benThanhCreamStucco', sx * (hallW * 0.5 + 2.52), 6.2, 0),
      makeReliefBox(0.55, 0.22, 6.2, 'benThanhCreamStucco', sx * (hallW * 0.5 + 2.55), 5.35, 0)
    );
    w3Gold.push(new THREE.BoxGeometry(0.10, 0.52, 3.6).translate(sx * (hallW * 0.5 + 3.42), 5.65, 0));
    // Swan-neck entrance lanterns flanking E/W gates
    for (const lz of [-3.4, 3.4]) {
      w3Iron.push(new THREE.BoxGeometry(0.55, 0.08, 0.08).translate(sx * (hallW * 0.5 + 2.75), 4.4, lz));
      w3Glow.push(new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(sx * (hallW * 0.5 + 2.95), 4.22, lz));
    }
    // Swan-neck entrance lanterns flanking North Gate
    w3Iron.push(new THREE.BoxGeometry(0.08, 0.08, 0.55).translate(sx * 3.4, 4.4, hallD * 0.5 + 2.75));
    w3Glow.push(new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(sx * 3.4, 4.22, hallD * 0.5 + 2.95));
  }
  // [409][410][411][412] Perimeter plinth water-table, vent grilles, roof monitor louver slats & hipped ridge-end collars
  for (const sz of [-1, 1]) {
    w3Atlas.push(makeReliefBox(68.0, 0.22, 0.72, 'benThanhCreamStucco', 0, 1.24, sz * (hallD * 0.5 + 0.06)));
  }
  for (const sx of [-1, 1]) {
    for (const vz of [-22, -14, 14, 22]) {
      w3Iron.push(new THREE.BoxGeometry(0.12, 0.55, 1.4, ).translate(sx * (hallW * 0.5 + 0.28), 0.78, vz));
    }
    for (const sz of [-1, 1]) {
      const qx = sx * 29.5;
      const qz = sz * 20.5;
      w3Atlas.push(
        makeReliefBox(28.0, 0.18, 13.8, 'benThanhGreenShutter', qx, wallH + 2.85, qz),
        makeReliefBox(0.55, 0.36, 0.55, 'benThanhTerracottaRoof', qx - 14.2, wallH + 5.26, qz),
        makeReliefBox(0.55, 0.36, 0.55, 'benThanhTerracottaRoof', qx + 14.2, wallH + 5.26, qz)
      );
    }
  }

  // [416][422][423] Interior overhead hanging stall-zone signage boards, truss gussets & aisle-number placards
  for (const [sz, labelW] of [[-22, 4.2], [-12, 4.2], [12, 4.2], [22, 4.2]]) {
    w3Iron.push(
      new THREE.CylinderGeometry(0.025, 0.025, 1.85, 5).translate(-1.5, 7.35, sz),
      new THREE.CylinderGeometry(0.025, 0.025, 1.85, 5).translate(1.5, 7.35, sz)
    );
    w3Atlas.push(makeReliefBox(labelW, 0.56, 0.10, 'benThanhTerracottaRoof', 0, 6.45, sz));
    w3Gold.push(new THREE.BoxGeometry(labelW - 0.3, 0.38, 0.12).translate(0, 6.45, sz));
  }
  for (const ex of [-24, -14, 14, 24]) {
    w3Iron.push(
      new THREE.BoxGeometry(0.28, 0.28, 0.45).translate(ex, 8.2, 0),
      new THREE.CylinderGeometry(0.025, 0.025, 1.6, 5).translate(ex, 7.4, 0)
    );
    w3Gold.push(new THREE.BoxGeometry(0.10, 0.48, 1.8).translate(ex, 6.55, 0));
  }
  // [417][418][419] Traditional Saigon Coffee Roaster (Quầy Rang Xay Cà Phê) with copper drum, burlap sacks & phin shelf (SE concourse)
  const crX = 16.5;
  const crZ = -14.5;
  w3Atlas.push(
    makeReliefBox(3.6, 0.92, 1.5, 'wharfWeatheredPlank', crX, 0.82, crZ),
    makeReliefCyl(0.32, 0.38, 0.68, 6, 'wovenBambooBasket', crX - 2.3, 0.70, crZ - 0.4),
    makeReliefCyl(0.32, 0.38, 0.68, 6, 'wovenBambooBasket', crX - 2.3, 0.70, crZ + 0.4),
    makeReliefBox(2.4, 1.35, 0.38, 'wharfWeatheredPlank', crX + 0.4, 1.95, crZ + 0.55)
  );
  w3Gold.push(
    new THREE.CylinderGeometry(0.36, 0.36, 1.05, 6).rotateZ(Math.PI * 0.5).translate(crX - 0.6, 1.55, crZ),
    new THREE.ConeGeometry(0.26, 0.38, 5).rotateX(Math.PI).translate(crX - 0.6, 2.02, crZ)
  );
  // [420][421][437] Central Rotunda octagonal info counter, upper gallery railing & fire-hose cabinets on 4 rotunda piers
  w3Atlas.push(makeReliefCyl(2.4, 2.5, 0.98, 8, 'wharfWeatheredPlank', 0, 0.85, 0));
  w3Gold.push(new THREE.CylinderGeometry(2.55, 2.55, 0.08, 8).translate(0, 1.36, 0));
  w3Iron.push(new THREE.CylinderGeometry(5.1, 5.1, 0.12, 8).translate(0, 8.6, 0));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      w3Atlas.push(makeReliefBox(0.55, 0.82, 0.24, 'benThanhTerracottaRoof', sx * 5.2, 1.55, sz * 5.2));
    }
  }
  // [424][425][426][427][428] Lacquerware vitrines (NE), Nón Lá racks & Áo Dài mannequins (SW), rattan shelves (W), dried-fruit jars (E)
  for (const nz of [10.0, 18.0]) {
    w3Atlas.push(makeReliefBox(2.4, 1.05, 0.95, 'wharfWeatheredPlank', 18.5, 0.88, nz));
    w3Gold.push(new THREE.BoxGeometry(2.2, 0.32, 0.82).translate(18.5, 1.56, nz));
  }
  for (const swz of [-14.0, -22.0]) {
    w3Atlas.push(
      makeReliefCyl(0.02, 0.34, 0.22, 6, 'wovenBambooBasket', -22.0, 2.55, swz),
      makeReliefCyl(0.18, 0.24, 1.25, 6, 'benThanhSilkTextile', -20.2, 1.0, swz)
    );
    w3Gold.push(new THREE.CylinderGeometry(0.10, 0.10, 0.22, 5).translate(-20.2, 1.72, swz));
  }
  w3Atlas.push(
    makeReliefBox(0.85, 1.65, 4.2, 'wovenBambooBasket', -34.0, 1.18, -4.0),
    makeReliefBox(0.85, 1.45, 4.2, 'benThanhSpiceDryGoods', 34.0, 1.08, -4.0)
  );
  // [429][430][431][432][439] NW Food-Court: Phở cauldron, Bánh Xèo griddle, Chè display, stools & pendant lamps suspended from ceiling tie-beam
  for (let fc = 0; fc < 3; fc++) {
    const fcz = 10.0 + fc * 5.2;
    w3Atlas.push(
      makeReliefBox(3.2, 0.92, 1.15, 'benThanhRollShutter', -24.5, 0.82, fcz),
      makeReliefCyl(0.32, 0.30, 0.45, 6, 'benThanhRollShutter', -25.4, 1.48, fcz),
      makeReliefBox(0.34, 0.42, 0.34, fc % 2 === 0 ? 'corrugatedTinBlue' : 'benThanhTerracottaRoof', -22.2, 0.57, fcz - 0.5),
      makeReliefBox(0.34, 0.42, 0.34, fc % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', -22.2, 0.57, fcz + 0.5)
    );
    w3Iron.push(new THREE.CylinderGeometry(0.025, 0.025, 5.75, 5).translate(-24.5, 5.42, fcz));
    w3Glow.push(new THREE.BoxGeometry(0.18, 0.16, 0.18).translate(-24.5, 2.52, fcz));
  }
  // [433][434][435][436][438][440] Wet-market ice trays, brass scales, fruit crates, drainage grates, storage lockers & hand-carts
  for (const wx of [-12.0, 12.0]) {
    w3Atlas.push(
      makeReliefBox(3.4, 0.78, 1.35, 'benThanhRollShutter', wx, 0.75, 22.5),
      makeReliefBox(0.75, 0.48, 0.58, 'benThanhTerracottaRoof', wx + 2.4, 0.60, 22.5)
    );
    w3Gold.push(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 6).translate(wx, 1.72, 22.5));
  }
  w3Iron.push(
    new THREE.BoxGeometry(0.32, 0.04, 56.0).translate(0, 0.37, 0),
    new THREE.BoxGeometry(84.0, 0.04, 0.32).translate(0, 0.37, 0)
  );
  for (const sx of [-1, 1]) {
    w3Atlas.push(makeReliefBox(18.0, 1.15, 1.2, 'wharfWeatheredPlank', sx * 30.0, 3.6, 29.8));
    w3Iron.push(new THREE.BoxGeometry(0.95, 0.10, 1.35).translate(sx * 36.5, 0.55, -24.0));
  }

  // [441][442][443][444][445][446][447][448] METRO BẾN THÀNH STATION PLAZA (Line 1 Lotus Skylight Oculus, Entrances #1/#2, Totems, Amphitheater, Trees & LED Bollards)
  const metX = 24.0;
  const metZ = -54.0;
  // Iconic Lotus Skylight Oculus (Giếng Trời Hoa Sen) on SE Quách Thị Trang Plaza — grounded on 12 radial steel lotus-rib columns!
  w3Atlas.push(
    makeReliefCyl(7.6, 8.2, 0.85, 12, 'benThanhCreamStucco', metX, 0.15, metZ),
    makeReliefCyl(5.8, 7.2, 1.85, 12, 'corrugatedTinBlue', metX, 1.48, metZ),
    makeReliefCyl(3.2, 5.6, 1.15, 12, 'benThanhCreamStucco', metX, 2.92, metZ)
  );
  for (let lr = 0; lr < 12; lr++) {
    const la = (lr / 12) * Math.PI * 2;
    w3Iron.push(
      new THREE.CylinderGeometry(0.09, 0.12, 3.8, 5).translate(metX + Math.cos(la) * 6.8, 1.65, metZ + Math.sin(la) * 6.8)
    );
  }
  w3Glow.push(new THREE.CylinderGeometry(2.8, 3.0, 0.24, 8).translate(metX, 3.55, metZ));
  // Metro Entrance #1 Glass Pavilion (East forecourt, grounded columns)
  const m1X = 14.0;
  const m1Z = -45.5;
  w3Atlas.push(
    makeReliefBox(7.2, 0.28, 3.8, 'corrugatedTinBlue', m1X, 3.25, m1Z, 0, -0.14, 0),
    makeReliefBox(6.8, 0.65, 3.2, 'benThanhCreamStucco', m1X, 0.08, m1Z)
  );
  for (const ox of [-3.2, 0, 3.2]) {
    for (const oz of [-1.5, 1.5]) {
      w3Iron.push(new THREE.CylinderGeometry(0.08, 0.09, 3.65, 5).translate(m1X + ox, 1.65, m1Z + oz));
    }
  }
  // Metro Entrance #2 Canopy & "M1 BẾN THÀNH" Glowing Totem Pylons (West plaza)
  const m2X = -20.0;
  const m2Z = -54.0;
  w3Atlas.push(makeReliefBox(6.4, 0.24, 3.4, 'corrugatedTinBlue', m2X, 3.1, m2Z, 0, -0.12, 0));
  for (const ox of [-2.8, 2.8]) {
    for (const oz of [-1.3, 1.3]) {
      w3Iron.push(new THREE.CylinderGeometry(0.07, 0.08, 3.55, 5).translate(m2X + ox, 1.58, m2Z + oz));
    }
  }
  for (const [tx, tz] of [[m1X - 4.4, m1Z - 1.2], [m2X + 4.2, m2Z - 1.2]]) {
    w3Atlas.push(makeReliefBox(0.55, 3.6, 0.24, 'corrugatedTinBlue', tx, 1.8, tz));
    w3Glow.push(new THREE.BoxGeometry(0.45, 0.55, 0.28).translate(tx, 3.2, tz));
  }
  // Stepped granite amphitheater seating, young Saigon trees & LED plaza bollards
  for (let st = 0; st < 2; st++) {
    w3Atlas.push(makeReliefBox(14.0, 0.42, 0.95, 'benThanhCreamStucco', metX, 0.21 + st * 0.36, metZ + 9.4 + st * 1.1));
  }
  for (const [tx, tz] of [[11.0, -56.0], [34.0, -56.0], [-12.0, -56.0]]) {
    w3Iron.push(new THREE.BoxGeometry(1.5, 0.08, 1.5).translate(tx, 0.06, tz));
    w3Bark.push(new THREE.CylinderGeometry(0.10, 0.14, 2.8, 5).translate(tx, 1.4, tz));
    w3Leaf.push(colorizeGeo(new THREE.ConeGeometry(1.35, 1.8, 5).translate(tx, 3.2, tz), 0x2f7d2e));
  }
  for (let b = -3; b <= 3; b++) {
    w3Iron.push(new THREE.CylinderGeometry(0.07, 0.08, 0.85, 5).translate(b * 3.8, 0.42, -40.5));
    w3Glow.push(new THREE.BoxGeometry(0.12, 0.14, 0.12).translate(b * 3.8, 0.88, -40.5));
  }

  // [449][450][451][452][453] Quách Thị Trang compass inlay, circular benches, TNGo bike rack, tourist map kiosk & crosswalk islands
  w3Atlas.push(makeReliefCyl(2.6, 2.6, 0.08, 8, 'benThanhTerracottaRoof', 0, 0.06, -42.5));
  for (let cb = 0; cb < 4; cb++) {
    const a = (cb / 4) * Math.PI * 2 + Math.PI * 0.25;
    w3Atlas.push(makeReliefBox(2.2, 0.46, 0.56, 'wharfWeatheredPlank', Math.cos(a) * 9.8, 0.23, -52.5 + Math.sin(a) * 9.8, -a));
  }
  // TNGo public bike-share dock (4 blue bikes)
  w3Iron.push(new THREE.BoxGeometry(4.4, 0.10, 0.55).translate(10.5, 0.06, -49.5));
  for (let bk = 0; bk < 4; bk++) {
    w3Atlas.push(makeReliefBox(0.22, 0.72, 1.25, 'corrugatedTinBlue', 8.8 + bk * 1.1, 0.48, -49.5));
  }
  // Heritage bronze Saigon tourist map kiosk (SW forecourt)
  w3Atlas.push(makeReliefBox(1.4, 1.25, 0.35, 'benThanhCreamStucco', -16.5, 0.62, -41.5));
  w3Gold.push(new THREE.BoxGeometry(1.15, 0.78, 0.08).rotateX(-0.35).translate(-16.5, 1.32, -41.5));
  for (const rx of [-11.5, 11.5]) {
    w3Atlas.push(makeReliefBox(1.4, 0.18, 4.2, 'benThanhCreamStucco', rx, 0.09, -42.0));
    w3Gold.push(new THREE.CylinderGeometry(0.06, 0.07, 0.72, 5).translate(rx, 0.48, -43.6));
  }
  // [454][455][456][457][458][459][460] Sidewalk café umbrellas, flower carts, night-market string-lights, motorbike bay, planters, fire hydrants & taxi bay
  for (const sz of [-16.0, -4.0, 8.0]) {
    // Phan Chu Trinh (-X) sidewalk café tables & umbrellas
    w3Atlas.push(makeReliefBox(0.95, 0.68, 0.95, 'wharfWeatheredPlank', -56.2, 0.34, sz));
    w3Iron.push(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 5).translate(-56.2, 1.1, sz));
    w3Atlas.push(makeReliefCyl(0.08, 1.1, 0.38, 6, 'corrugatedTinBlue', -56.2, 2.25, sz));
    // Phan Bội Châu (+X) flower vendor carts
    w3Atlas.push(makeReliefBox(1.4, 0.78, 2.2, 'wharfWeatheredPlank', 56.2, 0.39, sz));
    w3Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.45, 0.55, 5).translate(56.2, 1.05, sz), 0xe8b824));
  }
  // Night-market overhead festoon string-light poles (grounded)
  for (const sx of [-1, 1]) {
    for (const fz of [-24.0, 0.0, 24.0]) {
      w3Iron.push(new THREE.CylinderGeometry(0.05, 0.06, 4.4, 5).translate(sx * 55.5, 2.2, fz));
      w3Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(sx * 53.5, 4.1, fz));
    }
  }
  // West sidewalk motorbike parking bay (4 neat scooters)
  for (let mb = 0; mb < 4; mb++) {
    w3Atlas.push(makeReliefBox(0.55, 0.82, 1.45, mb % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', -44.0 - mb * 1.4, 0.46, 35.8));
  }
  // North Gate (Cửa Bắc) planters, corner fire hydrants & East taxi shelter
  for (const nx of [-10.0, -5.0, 5.0, 10.0]) {
    w3Atlas.push(makeReliefBox(1.4, 0.58, 0.75, 'benThanhTerracottaRoof', nx, 0.65, hallD * 0.5 + 2.8));
    w3Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.42, 0.52, 5).translate(nx, 1.18, hallD * 0.5 + 2.8), 0x347d2e));
  }
  for (const sx of [-48.5, 48.5]) {
    w3Atlas.push(makeReliefCyl(0.14, 0.16, 0.78, 5, 'benThanhTerracottaRoof', sx, 0.39, -35.8));
  }
  w3Atlas.push(
    makeReliefBox(5.2, 0.14, 1.8, 'corrugatedTinRust', 34.0, 2.65, -47.5),
    makeReliefBox(3.6, 0.52, 0.48, 'wharfWeatheredPlank', 34.0, 0.26, -47.2)
  );
  for (const tx of [31.6, 36.4]) {
    w3Iron.push(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5).translate(tx, 1.25, -47.5));
  }

  // ==========================================================================
  // WAVE 4 REAL-WORLD VISUAL QC UPGRADES (801–860) — Low-Poly, castShadow=false
  // ==========================================================================
  const w4Atlas: THREE.BufferGeometry[] = [];
  const w4Gold: THREE.BufferGeometry[] = [];
  const w4Iron: THREE.BufferGeometry[] = [];
  const w4Bark: THREE.BufferGeometry[] = [];
  const w4Leaf: THREE.BufferGeometry[] = [];
  const w4Glow: THREE.BufferGeometry[] = [];

  // [801–806] Phan Bội Châu East Colonial Shophouse Terrace Strip (3 facades, arcade piers, signboards & French balconies)
  for (let sh = 0; sh < 3; sh++) {
    const shX = 64.5;
    const shZ = -16.0 + sh * 16.0;
    const shH = 7.4 + (sh % 2) * 0.8;
    w4Atlas.push(
      makeReliefBox(7.2, shH, 12.8, 'benThanhCreamStucco', shX, shH * 0.5 - 0.1, shZ),
      makeReliefBox(7.8, 0.32, 13.4, 'benThanhCreamStucco', shX, shH - 0.05, shZ),
      makeReliefBox(2.4, 0.24, 13.2, 'benThanhCreamStucco', shX - 4.4, 3.65, shZ), // arcade veranda canopy
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', shX - 3.62, 5.2, shZ - 3.2),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', shX - 3.62, 5.2, shZ + 3.2),
      makeReliefBox(0.22, 0.72, 6.2, sh % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', shX - 5.55, 4.15, shZ) // heritage signboard
    );
    const shRoof = remapRelief(createGableRoofGeometry(8.2, 13.6, 1.85, 0.22, 'z'), 'benThanhTerracottaRoof');
    shRoof.translate(shX, shH + 0.05, shZ);
    w4Atlas.push(shRoof);
    for (const pz of [-5.6, 0, 5.6]) {
      w4Atlas.push(makeReliefBox(0.42, 3.85, 0.42, 'benThanhCreamStucco', shX - 5.4, 1.78, shZ + pz)); // grounded arcade piers
    }
    w4Iron.push(new THREE.BoxGeometry(0.10, 0.85, 11.8).translate(shX - 5.45, 4.25, shZ)); // French balcony rail
  }
  // [807–812] Phan Chu Trinh West Night-Market Arch, Outdoor Phở/Bánh Xèo Dining Pavilion, Newspaper Kiosk & SE Electric Buggy Bay
  w4Atlas.push(
    makeReliefCyl(0.14, 0.18, 4.5, 5, 'benThanhTerracottaRoof', -58.5, 2.1, 26.0),
    makeReliefCyl(0.14, 0.18, 4.5, 5, 'benThanhTerracottaRoof', -53.5, 2.1, 26.0),
    makeReliefBox(5.8, 0.72, 0.24, 'benThanhTerracottaRoof', -56.0, 4.35, 26.0)
  );
  w4Glow.push(new THREE.BoxGeometry(4.2, 0.18, 0.28).translate(-56.0, 4.35, 26.0));
  // West outdoor dining pavilion (-63.5, -10) with grounded posts & tables
  w4Atlas.push(
    makeReliefBox(5.6, 0.20, 8.6, 'corrugatedTinBlue', -63.5, 2.95, -10.0),
    makeReliefBox(1.8, 0.74, 3.2, 'wharfWeatheredPlank', -63.5, 0.37, -12.0),
    makeReliefBox(1.8, 0.74, 3.2, 'wharfWeatheredPlank', -63.5, 0.37, -8.0),
    makeReliefBox(0.36, 0.40, 0.36, 'corrugatedTinRust', -61.8, 0.20, -12.0),
    makeReliefBox(0.36, 0.40, 0.36, 'corrugatedTinBlue', -61.8, 0.20, -8.0)
  );
  for (const ox of [-2.4, 2.4]) {
    for (const oz of [-3.8, 3.8]) {
      w4Iron.push(new THREE.CylinderGeometry(0.05, 0.06, 3.1, 5).translate(-63.5 + ox, 1.40, -10.0 + oz));
    }
  }
  // SW Saigon Newspaper & Lottery Kiosk (-46, -44) & SE Electric Tourist Buggy Bay (44, -48)
  w4Atlas.push(
    makeReliefBox(3.0, 2.25, 2.0, 'benThanhGreenShutter', -46.0, 1.12, -44.0),
    makeReliefBox(3.6, 0.18, 2.6, 'corrugatedTinRust', -46.0, 2.30, -44.0),
    // Electric tourist buggy & charging canopy (44, -48)
    makeReliefBox(1.65, 0.85, 3.2, 'benThanhCreamStucco', 44.0, 0.62, -48.0),
    makeReliefBox(1.70, 0.12, 3.1, 'corrugatedTinBlue', 44.0, 1.85, -48.0),
    makeReliefBox(4.2, 0.18, 4.8, 'corrugatedTinBlue', 44.0, 2.85, -48.0)
  );
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-2.0, 2.0]) {
      w4Iron.push(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 5).translate(44.0 + ox, 1.35, -48.0 + oz));
    }
  }
  // [813–820] Vintage Scooter Row, Lê Lợi Pedestrian Pergola, Heritage Clock Pillar, LED Bus/Taxi Totems & Tactile Paving
  for (let sc = 0; sc < 4; sc++) {
    w4Atlas.push(makeReliefBox(0.55, 0.82, 1.45, sc % 2 === 0 ? 'corrugatedTinBlue' : 'benThanhCreamStucco', 58.0, 0.45, -26.0 + sc * 1.6));
  }
  // Lê Lợi Boulevard Shade Pergola (-4, -64) with grounded iron columns & granite planter benches
  w4Atlas.push(
    makeReliefBox(10.6, 0.22, 3.6, 'wharfWeatheredPlank', -4.0, 3.15, -64.0),
    makeReliefBox(3.2, 0.52, 0.72, 'benThanhCreamStucco', -7.2, 0.26, -64.0),
    makeReliefBox(3.2, 0.52, 0.72, 'benThanhCreamStucco', -0.8, 0.26, -64.0)
  );
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-1.5, 1.5]) {
      w4Iron.push(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 5).translate(-4.0 + ox, 1.50, -64.0 + oz));
    }
  }
  // 4-Faced Street Clock Pillar (-16, -62), Bus/Taxi LED Totems & Tactile Paving Strips
  w4Iron.push(new THREE.CylinderGeometry(0.12, 0.20, 4.6, 6).translate(-16.0, 2.25, -62.0));
  w4Atlas.push(
    makeReliefBox(0.85, 0.85, 0.85, 'benThanhCreamStucco', -16.0, 4.75, -62.0),
    makeReliefBox(0.45, 2.4, 0.18, 'corrugatedTinBlue', -36.0, 1.2, -47.5),
    makeReliefBox(0.45, 2.4, 0.18, 'corrugatedTinRust', 38.0, 1.2, -47.5),
    makeReliefBox(3.2, 0.04, 14.0, 'benThanhCreamStucco', 0, 0.05, -44.0)
  );
  w4Glow.push(
    new THREE.BoxGeometry(0.36, 0.48, 0.22).translate(-36.0, 2.05, -47.5),
    new THREE.BoxGeometry(0.36, 0.48, 0.22).translate(38.0, 2.05, -47.5)
  );
  w4Gold.push(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 6).translate(-6.5, 0.06, -42.0));
  // [821–835] Metro Skylight Planter Ring & Bougainvillea, Metro #1/#2 Rails & Map, Smart Bench, 2nd Bike Dock, Security Bollards, Floodlights, Mural Wall, Lotus Bowls & Crosswalk Signals
  for (let p = 0; p < 6; p++) {
    const pa = (p / 6) * Math.PI * 2;
    const px = metX + Math.cos(pa) * 9.2;
    const pz = metZ + Math.sin(pa) * 9.2;
    w4Atlas.push(makeReliefBox(1.8, 0.48, 0.85, 'benThanhCreamStucco', px, 0.24, pz, -pa));
    w4Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.55, 5).translate(px, 0.72, pz), p % 2 === 0 ? 0xd83b7a : 0x347d2e));
  }
  w4Atlas.push(
    makeReliefBox(1.2, 1.85, 0.24, 'corrugatedTinBlue', m1X + 4.8, 0.92, m1Z), // Metro Line 1 transit map kiosk
    makeReliefBox(2.2, 0.48, 0.65, 'wharfWeatheredPlank', 14.0, 0.24, -54.0), // smart solar bench
    makeReliefBox(0.35, 3.2, 9.6, 'benThanhCreamStucco', 42.0, 1.6, -62.0), // Saigon street-art mural wall
    makeReliefCyl(0.55, 0.32, 0.72, 6, 'benThanhTerracottaRoof', -10.0, 0.36, -37.0), // Cửa Nam lotus bowl W
    makeReliefCyl(0.55, 0.32, 0.72, 6, 'benThanhTerracottaRoof', 10.0, 0.36, -37.0), // Cửa Nam lotus bowl E
    makeReliefCyl(0.28, 0.24, 0.95, 6, 'benThanhCreamStucco', 19.0, 0.48, -45.5) // drinking water fountain
  );
  // 2nd TNGo bike dock (-26, -58) + anti-vehicle bollards + clock-tower uplights + crosswalk signal poles
  w4Iron.push(new THREE.BoxGeometry(4.2, 0.08, 0.55).translate(-26.0, 0.05, -58.0));
  for (let bk = 0; bk < 4; bk++) {
    w4Atlas.push(makeReliefBox(0.22, 0.72, 1.25, 'corrugatedTinBlue', -27.6 + bk * 1.1, 0.46, -58.0));
  }
  for (const sx of [-20.0, 20.0]) {
    w4Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 5).translate(sx, 1.85, -41.0));
    w4Glow.push(new THREE.BoxGeometry(0.22, 0.45, 0.18).translate(sx, 3.45, -41.0));
    w4Gold.push(new THREE.BoxGeometry(0.45, 0.32, 0.45).translate(sx * 0.35, 0.20, -39.0));
  }
  // [836–843] East Flower Parasols, West Seafood Cart, Cửa Bắc Welcome Arch, Flower Market Stalls & Bike Delivery Carts
  for (const sz of [14.0, 22.0]) {
    w4Iron.push(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 5).translate(58.0, 1.1, sz));
    w4Atlas.push(makeReliefCyl(0.08, 1.15, 0.38, 6, 'corrugatedTinRust', 58.0, 2.25, sz));
  }
  w4Atlas.push(
    makeReliefBox(1.5, 0.88, 2.2, 'benThanhRollShutter', -56.0, 0.44, 18.0), // West grilled seafood cart
    // Cửa Bắc (Lê Thánh Tôn) pedestrian welcome archway (0, 37.5)
    makeReliefCyl(0.14, 0.18, 4.6, 5, 'benThanhTerracottaRoof', -4.2, 2.15, 37.5),
    makeReliefCyl(0.14, 0.18, 4.6, 5, 'benThanhTerracottaRoof', 4.2, 2.15, 37.5),
    makeReliefBox(9.2, 0.72, 0.26, 'benThanhTerracottaRoof', 0, 4.50, 37.5)
  );
  w4Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(-56.0, 1.95, 18.0));
  for (const fx of [-14.0, 14.0]) {
    w4Atlas.push(
      makeReliefBox(3.8, 0.78, 1.8, 'wharfWeatheredPlank', fx, 0.45, 36.5),
      makeReliefBox(4.2, 0.12, 2.2, fx < 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', fx, 2.45, 36.5)
    );
    for (const ox of [-1.8, 1.8]) {
      w4Iron.push(new THREE.CylinderGeometry(0.035, 0.04, 2.5, 5).translate(fx + ox, 1.20, 36.5));
    }
    w4Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.52, 0.55, 5).translate(fx, 1.15, 36.5), 0xf0c422));
  }
  w4Atlas.push(makeReliefBox(1.2, 0.65, 1.8, 'wharfWeatheredPlank', -22.0, 0.45, 36.5)); // flower delivery cart
  // [844–860] Interior Lantern Garlands, Tea/Nón Lá/Cashew/Fruit Displays, Compass Plaques, Mezzanine Brackets, Bánh Cuốn/Nước Mía & Exterior Unloading Decks
  for (const ix of [-20.0, -10.0, 10.0, 20.0]) {
    w4Glow.push(new THREE.BoxGeometry(0.24, 0.28, 0.24).translate(ix, 6.2, 0));
  }
  w4Atlas.push(
    makeReliefBox(2.4, 0.85, 1.2, 'wharfWeatheredPlank', 22.0, 0.80, -14.5), // SE tea tasting table
    makeReliefBox(2.2, 0.82, 1.1, 'wharfWeatheredPlank', -26.0, 0.78, -14.5), // SW nón lá workbench
    makeReliefCyl(0.36, 0.32, 0.72, 6, 'wovenBambooBasket', 24.0, 0.74, 14.0), // NE cashew barrel
    makeReliefCyl(0.36, 0.32, 0.72, 6, 'wovenBambooBasket', 25.0, 0.74, 14.0),
    makeReliefBox(2.4, 0.78, 1.2, 'benThanhRollShutter', -28.0, 0.76, 16.0), // NW Bánh Cuốn station
    makeReliefBox(1.4, 0.92, 0.95, 'benThanhGreenShutter', -28.0, 0.82, 20.0), // NW Nước Mía stand
    makeReliefBox(2.8, 0.32, 3.2, 'wharfWeatheredPlank', 53.0, 0.22, 6.0), // Cửa Đông fruit unloading deck
    makeReliefBox(1.4, 0.78, 2.2, 'benThanhSilkTextile', -53.0, 0.45, -12.0) // Cửa Tây fabric handcart
  );
  w4Gold.push(
    new THREE.CylinderGeometry(0.55, 0.55, 0.04, 6).translate(0, 0.40, -6.5),
    new THREE.CylinderGeometry(0.55, 0.55, 0.04, 6).translate(0, 0.40, 6.5),
    new THREE.CylinderGeometry(0.45, 0.45, 0.12, 8).rotateX(Math.PI * 0.5).translate(0, 6.8, hallD * 0.5 - 0.5) // interior pendulum clock
  );

  // ==========================================================================
  // WAVE 5 REAL-PHOTO VISUAL QC UPGRADES (1201–1260) — Low-Poly, castShadow=false
  // ==========================================================================
  const w5Atlas: THREE.BufferGeometry[] = [];
  const w5Gold: THREE.BufferGeometry[] = [];
  const w5Iron: THREE.BufferGeometry[] = [];
  const w5Bark: THREE.BufferGeometry[] = [];
  const w5Leaf: THREE.BufferGeometry[] = [];
  const w5Glow: THREE.BufferGeometry[] = [];

  // [1201–1206] Phan Chu Trinh West Colonial Shophouse Terrace Strip (3 facades, grounded arcade piers, balconies & signboards)
  for (let sh = 0; sh < 3; sh++) {
    const shX = -72.0;
    const shZ = -18.0 + sh * 16.0;
    const shH = 7.4 + (sh % 2) * 0.8;
    w5Atlas.push(
      makeReliefBox(7.2, shH, 12.8, 'benThanhCreamStucco', shX, shH * 0.5 - 0.1, shZ),
      makeReliefBox(7.8, 0.30, 13.4, 'benThanhCreamStucco', shX, shH - 0.05, shZ),
      makeReliefBox(2.4, 0.24, 13.2, 'benThanhCreamStucco', shX + 4.4, 3.65, shZ),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', shX + 3.62, 5.2, shZ - 3.2),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', shX + 3.62, 5.2, shZ + 3.2),
      makeReliefBox(0.22, 0.72, 6.2, sh % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', shX + 5.55, 4.15, shZ)
    );
    const shRoof = remapRelief(createGableRoofGeometry(8.2, 13.6, 1.85, 0.22, 'z'), 'benThanhTerracottaRoof');
    shRoof.translate(shX, shH + 0.04, shZ);
    w5Atlas.push(shRoof);
    for (const pz of [-5.6, 0, 5.6]) {
      w5Atlas.push(makeReliefBox(0.42, 3.85, 0.42, 'benThanhCreamStucco', shX + 5.4, 1.78, shZ + pz));
    }
    w5Iron.push(new THREE.BoxGeometry(0.10, 0.85, 11.8).translate(shX + 5.45, 4.25, shZ));
  }
  // [1207–1220] Sidewalk Street-Café Clusters, Cà Phê Sữa Đá Cart, Clock-Tower Trim, Sconces, Cyclo Bay #2 & Street Bollards
  for (const [cx0, cz0] of [[57.5, -8.0], [-65.0, 6.0]]) {
    w5Atlas.push(
      makeReliefBox(1.2, 0.52, 0.85, 'wharfWeatheredPlank', cx0, 0.26, cz0),
      makeReliefBox(0.34, 0.36, 0.34, 'corrugatedTinBlue', cx0 - 0.85, 0.18, cz0),
      makeReliefBox(0.34, 0.36, 0.34, 'corrugatedTinRust', cx0 + 0.85, 0.18, cz0),
      makeReliefCyl(0.08, 1.15, 0.36, 6, 'corrugatedTinRust', cx0, 2.25, cz0)
    );
    w5Iron.push(new THREE.CylinderGeometry(0.03, 0.04, 2.35, 5).translate(cx0, 1.05, cz0));
  }
  w5Atlas.push(
    makeReliefBox(1.3, 0.92, 1.8, 'benThanhGreenShutter', 57.5, 0.46, -18.0), // SE Cà Phê Sữa Đá cart
    makeReliefBox(0.32, 0.28, 3.6, 'benThanhTerracottaRoof', -3.6, 12.6, -34.2), // Clock tower cornice trim W
    makeReliefBox(0.32, 0.28, 3.6, 'benThanhTerracottaRoof', 3.6, 12.6, -34.2), // Clock tower cornice trim E
    makeReliefBox(1.4, 1.1, 0.18, 'benThanhGreenShutter', 0, 15.6, -35.4), // Belfry acoustic louver
    makeReliefBox(1.3, 0.78, 2.2, 'benThanhGreenShutter', 57.5, 0.48, 26.0), // Cyclo waiting bay #2
    makeReliefBox(0.48, 1.25, 0.48, 'benThanhGreenShutter', -43.5, 0.62, -44.0) // SW postal drop-box
  );
  w5Gold.push(
    new THREE.ConeGeometry(0.14, 0.72, 5).translate(-2.4, 20.4, -34.2), // Clock tower spire finial W
    new THREE.ConeGeometry(0.14, 0.72, 5).translate(2.4, 20.4, -34.2) // Clock tower spire finial E
  );
  for (const sx of [-14.0, 14.0]) {
    w5Iron.push(new THREE.BoxGeometry(0.24, 0.42, 0.28).translate(sx, 3.6, -34.2));
    w5Glow.push(new THREE.BoxGeometry(0.18, 0.24, 0.18).translate(sx, 3.45, -34.35));
  }
  for (const sx of [-51.2, 51.2]) {
    w5Atlas.push(makeReliefBox(0.28, 0.36, 9.2, 'benThanhTerracottaRoof', sx, 4.45, 0)); // Cửa Đông/Tây awning valance
  }
  for (const sx of [-52.0, 52.0]) {
    w5Iron.push(new THREE.CylinderGeometry(0.14, 0.18, 0.95, 6).translate(sx, 0.42, 35.0)); // NW/NE fire hydrants
  }
  for (const sx of [-26.0, 26.0]) {
    w5Iron.push(new THREE.CylinderGeometry(0.12, 0.14, 0.85, 5).translate(sx, 0.36, 38.5)); // Cửa Bắc bollards
  }

  // [1221–1240] Metro Line 1 Glass Elevator Pavilion, Entrance #3 Canopy, Amphitheater Tiers, Info Kiosk, Planter Boxes, Misting Arch & Chess Alcoves
  // Metro Glass Elevator Pavilion (34, -56)
  w5Iron.push(
    new THREE.BoxGeometry(3.6, 0.20, 3.6).translate(34.0, 3.45, -56.0),
    new THREE.CylinderGeometry(0.07, 0.08, 3.6, 5).translate(32.4, 1.65, -57.6),
    new THREE.CylinderGeometry(0.07, 0.08, 3.6, 5).translate(35.6, 1.65, -57.6),
    new THREE.CylinderGeometry(0.07, 0.08, 3.6, 5).translate(32.4, 1.65, -54.4),
    new THREE.CylinderGeometry(0.07, 0.08, 3.6, 5).translate(35.6, 1.65, -54.4)
  );
  w5Atlas.push(
    makeReliefBox(3.2, 0.24, 3.2, 'benThanhCreamStucco', 34.0, 0.12, -56.0),
    // Metro Entrance #3 Canopy (48, -58)
    makeReliefBox(6.8, 0.22, 4.4, 'corrugatedTinBlue', 48.0, 3.15, -58.0),
    // Curved Granite Amphitheater Tiers south of Skylight (24, -65.5)
    makeReliefBox(12.0, 0.42, 2.2, 'benThanhCreamStucco', 24.0, 0.21, -65.5),
    makeReliefBox(10.6, 0.42, 1.2, 'benThanhCreamStucco', 24.0, 0.62, -66.0),
    // Quách Thị Trang Tourist Info Kiosk (-32, -62)
    makeReliefBox(3.4, 2.45, 2.2, 'corrugatedTinBlue', -32.0, 1.22, -62.0),
    makeReliefBox(4.0, 0.18, 2.8, 'benThanhCreamStucco', -32.0, 2.50, -62.0),
    // SE/SW Granite Chess Alcoves & Bus Queue Benches
    makeReliefBox(1.2, 0.72, 1.2, 'benThanhCreamStucco', -38.0, 0.36, -58.0),
    makeReliefBox(1.2, 0.72, 1.2, 'benThanhCreamStucco', 36.0, 0.36, -66.0),
    makeReliefBox(2.8, 0.46, 0.58, 'wharfWeatheredPlank', -31.0, 0.23, -49.5),
    makeReliefBox(2.2, 0.05, 8.8, 'benThanhCreamStucco', 12.0, 0.04, -46.0) // accent paving band
  );
  for (const ox of [-3.0, 3.0]) {
    for (const oz of [-1.8, 1.8]) {
      w5Iron.push(new THREE.CylinderGeometry(0.07, 0.08, 3.3, 5).translate(48.0 + ox, 1.50, -58.0 + oz));
    }
  }
  // 4 Lê Lợi Boulevard Landscaped Granite Planters (-24/-12/+4/+16, -68)
  for (const px of [-24.0, -12.0, 4.0, 16.0]) {
    w5Atlas.push(makeReliefBox(2.6, 0.55, 1.2, 'benThanhCreamStucco', px, 0.28, -68.0));
    w5Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.58, 0.85, 5).translate(px, 0.92, -68.0), 0x2f7d2e));
  }
  // Pedestrian Misting Arch (-20, -54), Smart Solar Lamps (12/36, -52), Bronze Route Plaque & Nón Lá Sculpture (50, -42)
  w5Iron.push(
    new THREE.CylinderGeometry(0.06, 0.07, 3.2, 5).translate(-21.8, 1.50, -54.0),
    new THREE.CylinderGeometry(0.06, 0.07, 3.2, 5).translate(-18.2, 1.50, -54.0),
    new THREE.BoxGeometry(3.8, 0.14, 0.18).translate(-20.0, 3.10, -54.0),
    new THREE.CylinderGeometry(0.07, 0.09, 4.4, 5).translate(12.0, 2.05, -52.0),
    new THREE.CylinderGeometry(0.07, 0.09, 4.4, 5).translate(36.0, 2.05, -52.0),
    new THREE.CylinderGeometry(0.08, 0.10, 0.85, 5).translate(-18.0, 0.35, -43.0),
    new THREE.CylinderGeometry(0.08, 0.10, 0.85, 5).translate(18.0, 0.35, -43.0)
  );
  w5Glow.push(
    new THREE.BoxGeometry(0.42, 0.16, 0.22).translate(12.0, 4.25, -52.0),
    new THREE.BoxGeometry(0.42, 0.16, 0.22).translate(36.0, 4.25, -52.0),
    new THREE.BoxGeometry(0.24, 0.10, 0.24).translate(-8.0, 0.10, -52.0),
    new THREE.BoxGeometry(0.24, 0.10, 0.24).translate(8.0, 0.10, -52.0)
  );
  w5Gold.push(
    new THREE.BoxGeometry(1.1, 1.35, 0.22).translate(16.0, 0.68, -47.5), // Metro route plaque
    new THREE.ConeGeometry(1.1, 0.72, 6).translate(50.0, 1.55, -42.0), // Nón Lá street-art sculpture
    new THREE.BoxGeometry(0.45, 1.1, 0.45).translate(-12.0, 0.55, -46.0) // District 1 0 KM milestone
  );
  w5Atlas.push(makeReliefBox(1.8, 1.15, 1.8, 'benThanhCreamStucco', 50.0, 0.58, -42.0));

  // [1241–1260] Cửa Bắc Orchid Arbor, Cửa Đông Durian/Coconut Stalls, Interior Craft Galleries & Exterior Downspouts
  // Cửa Bắc Bamboo Orchid & Bonsai Shade Arbor (24, 37.5)
  w5Atlas.push(
    makeReliefBox(5.8, 0.16, 3.2, 'wovenBambooBasket', 24.0, 2.75, 37.5),
    makeReliefBox(4.8, 0.68, 1.2, 'wharfWeatheredPlank', 24.0, 0.34, 37.5),
    makeReliefBox(2.8, 0.82, 1.6, 'wharfWeatheredPlank', 53.5, 0.42, -8.0), // Cửa Đông durian stall
    makeReliefBox(3.2, 0.12, 2.0, 'corrugatedTinRust', 53.5, 2.45, -8.0),
    makeReliefBox(1.4, 0.85, 2.0, 'benThanhGreenShutter', -53.5, 0.45, 8.0), // Cửa Tây bánh tráng trộn cart
    makeReliefBox(1.6, 0.78, 1.4, 'wharfWeatheredPlank', 53.5, 0.40, 14.0), // Cửa Đông coconut stand
    makeReliefBox(1.4, 0.46, 0.55, 'wharfWeatheredPlank', -53.5, 0.24, -18.0), // Cửa Tây shoe-shine bench
    // Interior craft displays (Áo Dài, Lacquerware, Coffee Bins, Dried Seafood, Chè Counter)
    makeReliefBox(2.2, 1.35, 0.95, 'benThanhSilkTextile', -18.0, 0.98, -12.0),
    makeReliefBox(2.2, 1.25, 0.95, 'benThanhTerracottaRoof', 18.0, 0.92, -12.0),
    makeReliefBox(2.4, 0.85, 1.1, 'wharfWeatheredPlank', 18.0, 0.72, 12.0),
    makeReliefBox(2.4, 1.15, 1.1, 'benThanhSpiceDryGoods', -18.0, 0.88, 12.0),
    makeReliefBox(2.4, 0.95, 1.1, 'benThanhRollShutter', -24.0, 0.78, 20.0),
    makeReliefBox(2.6, 0.48, 0.62, 'wharfWeatheredPlank', -22.0, 0.54, 16.0)
  );
  for (const ox of [-2.6, 2.6]) {
    for (const oz of [-1.3, 1.3]) {
      w5Bark.push(new THREE.CylinderGeometry(0.06, 0.07, 2.9, 5).translate(24.0 + ox, 1.30, 37.5 + oz));
    }
  }
  w5Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.65, 5).translate(24.0, 1.05, 37.5), 0xd83b7a));
  w5Gold.push(
    new THREE.CylinderGeometry(1.15, 1.15, 0.14, 8).translate(0, 7.6, 0), // Central Rotunda brass-ring chandelier
    new THREE.BoxGeometry(0.95, 1.15, 0.10).translate(-5.2, 2.4, -5.2), // Rotunda heritage plaque SW
    new THREE.BoxGeometry(0.95, 1.15, 0.10).translate(5.2, 2.4, 5.2) // Rotunda heritage plaque NE
  );
  w5Glow.push(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 6).translate(0, 7.45, 0));
  for (const sx of [-48.5, 48.5]) {
    w5Iron.push(new THREE.CylinderGeometry(0.06, 0.06, 6.6, 5).translate(sx, 3.15, -24.0)); // exterior copper downspouts
  }

  // ==========================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADES (1601–1660) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w6Atlas: THREE.BufferGeometry[] = [];
  const w6Gold: THREE.BufferGeometry[] = [];
  const w6Iron: THREE.BufferGeometry[] = [];
  const w6Bark: THREE.BufferGeometry[] = [];
  const w6Leaf: THREE.BufferGeometry[] = [];
  const w6Glow: THREE.BufferGeometry[] = [];

  // [1601–1606] Phan Bội Châu East Colonial Shophouse Terrace Strip (3 facades, grounded arcade piers, balconies & signboards)
  for (let sh = 0; sh < 3; sh++) {
    const shX = 72.0;
    const shZ = -18.0 + sh * 16.0;
    const shH = 7.4 + (sh % 2) * 0.8;
    w6Atlas.push(
      makeReliefBox(7.2, shH, 12.8, 'benThanhCreamStucco', shX, shH * 0.5 - 0.1, shZ),
      makeReliefBox(7.8, 0.30, 13.4, 'benThanhCreamStucco', shX, shH - 0.05, shZ),
      makeReliefBox(2.4, 0.24, 13.2, 'benThanhCreamStucco', shX - 4.4, 3.65, shZ),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', shX - 3.62, 5.2, shZ - 3.2),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', shX - 3.62, 5.2, shZ + 3.2),
      makeReliefBox(0.22, 0.72, 6.2, sh % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', shX - 5.55, 4.15, shZ)
    );
    const shRoof = remapRelief(createGableRoofGeometry(8.2, 13.6, 1.85, 0.22, 'z'), 'benThanhTerracottaRoof');
    shRoof.translate(shX, shH + 0.04, shZ);
    w6Atlas.push(shRoof);
    for (const pz of [-5.6, 0, 5.6]) {
      w6Atlas.push(makeReliefBox(0.42, 3.85, 0.42, 'benThanhCreamStucco', shX - 5.4, 1.78, shZ + pz));
    }
    w6Iron.push(new THREE.BoxGeometry(0.10, 0.85, 11.8).translate(shX - 5.45, 4.25, shZ));
  }
  // [1607–1620] Night-Market Welcome Arches (East/West), Pop-Up Stalls, String-Lantern Crossbeams & Perimeter Trim
  for (const sx of [-58.0, 58.0]) {
    w6Iron.push(
      new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(sx - 3.2, 2.05, -30.0),
      new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(sx + 3.2, 2.05, -30.0)
    );
    w6Atlas.push(makeReliefBox(7.2, 0.65, 0.24, 'benThanhTerracottaRoof', sx, 4.25, -30.0));
    w6Glow.push(new THREE.BoxGeometry(5.2, 0.32, 0.28).translate(sx, 4.25, -30.0));
  }
  for (const [nx, nz, matKey] of [[62.0, -12.0, 'corrugatedTinRust'], [62.0, 8.0, 'corrugatedTinBlue'], [-62.0, -22.0, 'corrugatedTinBlue'], [-62.0, 22.0, 'corrugatedTinRust']] as const) {
    w6Atlas.push(
      makeReliefBox(2.6, 0.85, 3.6, 'wharfWeatheredPlank', nx, 0.42, nz),
      makeReliefBox(3.2, 0.14, 4.2, matKey, nx, 2.48, nz)
    );
    for (const ox of [-1.3, 1.3]) {
      w6Iron.push(new THREE.CylinderGeometry(0.04, 0.05, 2.65, 4).translate(nx + ox, 1.18, nz));
    }
    w6Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(nx, 2.28, nz));
  }
  for (const sx of [-14.0, 14.0]) {
    w6Iron.push(new THREE.BoxGeometry(0.22, 0.38, 0.26).translate(sx, 3.6, 34.2));
    w6Glow.push(new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(sx, 3.45, 34.35));
  }
  for (const sx of [-52.0, 52.0]) {
    w6Iron.push(new THREE.CylinderGeometry(0.12, 0.14, 0.85, 4).translate(sx, 0.35, -35.0));
  }
  // [1621–1640] Metro Entrance #4 West Canopy (-48, -58), Transit Totem, Bike Dock #3, SW/SE Pergolas, Lê Lợi Planters & Tram Plaque
  w6Atlas.push(
    makeReliefBox(6.8, 0.22, 4.4, 'corrugatedTinBlue', -48.0, 3.15, -58.0),
    makeReliefBox(6.2, 0.42, 3.8, 'benThanhCreamStucco', -48.0, 0.21, -58.0),
    makeReliefBox(0.55, 2.5, 0.22, 'corrugatedTinBlue', -42.0, 1.25, -54.0), // digital transit totem
    makeReliefBox(0.46, 1.25, 0.46, 'benThanhGreenShutter', -36.0, 0.62, -50.0), // West postal box #2
    makeReliefBox(0.52, 1.15, 0.52, 'benThanhRollShutter', 30.0, 0.58, -48.0), // bottle refill station
    makeReliefBox(6.8, 0.05, 2.2, 'benThanhCreamStucco', -34.0, 0.04, -58.0),
    makeReliefBox(6.8, 0.05, 2.2, 'benThanhCreamStucco', 38.0, 0.04, -62.0)
  );
  w6Glow.push(new THREE.BoxGeometry(0.42, 0.85, 0.26).translate(-42.0, 1.85, -54.0));
  for (const ox of [-3.0, 3.0]) {
    for (const oz of [-1.8, 1.8]) {
      w6Iron.push(new THREE.CylinderGeometry(0.07, 0.08, 3.3, 4).translate(-48.0 + ox, 1.50, -58.0 + oz));
    }
  }
  // East Bike-Share Dock #3 (42, -64)
  w6Iron.push(new THREE.BoxGeometry(3.8, 0.08, 0.52).translate(42.0, 0.05, -64.0));
  for (let bk = 0; bk < 3; bk++) {
    w6Atlas.push(makeReliefBox(0.22, 0.72, 1.2, 'corrugatedTinBlue', 40.9 + bk * 1.1, 0.45, -64.0));
  }
  // SW & SE Shaded Granite Pergola Seating Pavilions (±42, -70) + Solar Smart Benches (±26, -52) + Crosswalk Beacons (±10, -68) + Street Lamps (±6, -70)
  for (const sx of [-42.0, 42.0]) {
    w6Atlas.push(
      makeReliefBox(6.2, 0.20, 3.4, 'wharfWeatheredPlank', sx, 3.05, -70.0),
      makeReliefBox(3.4, 0.46, 0.58, 'wharfWeatheredPlank', sx, 0.23, -70.0)
    );
    for (const ox of [-2.8, 2.8]) {
      for (const oz of [-1.4, 1.4]) {
        w6Iron.push(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 4).translate(sx + ox, 1.45, -70.0 + oz));
      }
    }
  }
  for (const sx of [-26.0, 26.0]) {
    w6Atlas.push(makeReliefBox(2.4, 0.48, 0.62, 'wharfWeatheredPlank', sx, 0.24, -52.0));
    w6Iron.push(new THREE.BoxGeometry(2.6, 0.12, 0.95).translate(sx, 2.35, -52.0));
  }
  for (const px of [-32.0, -20.0, 20.0, 32.0]) {
    w6Atlas.push(makeReliefBox(2.4, 0.52, 1.1, 'benThanhCreamStucco', px, 0.26, -74.0));
    w6Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.52, 0.78, 5).translate(px, 0.88, -74.0), 0x2f7d2e));
  }
  w6Gold.push(
    new THREE.CylinderGeometry(0.65, 0.72, 0.24, 5).translate(0, 0.12, -72.0), // Saigon tram-track bronze medallion
    new THREE.CylinderGeometry(0.55, 0.55, 0.06, 5).translate(48.0, 0.06, -48.0) // East river-compass plaque
  );
  for (const sx of [-6.0, 6.0]) {
    w6Iron.push(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 4).translate(sx, 2.05, -70.0));
    w6Glow.push(new THREE.BoxGeometry(0.28, 0.32, 0.28).translate(sx, 4.35, -70.0));
  }
  for (const sx of [-10.0, 10.0]) {
    w6Iron.push(new THREE.CylinderGeometry(0.08, 0.10, 0.95, 4).translate(sx, 0.42, -68.0));
    w6Glow.push(new THREE.BoxGeometry(0.20, 0.20, 0.20).translate(sx, 0.98, -68.0));
  }
  // [1641–1660] Cửa Bắc West Orchid Arbor (-24, 37.5), Interior Food-Court Phở/Bún Bò Counters, Rotunda Benches & Corner Curbs
  w6Atlas.push(
    makeReliefBox(5.8, 0.16, 3.2, 'wovenBambooBasket', -24.0, 2.75, 37.5),
    makeReliefBox(4.8, 0.68, 1.2, 'wharfWeatheredPlank', -24.0, 0.34, 37.5),
    makeReliefBox(1.4, 0.72, 1.8, 'wharfWeatheredPlank', 30.0, 0.38, 37.5), // East floral handcart
    makeReliefBox(2.2, 0.82, 1.4, 'wharfWeatheredPlank', 53.5, 0.41, -16.0), // Cửa Đông weighing counter
    makeReliefBox(1.6, 0.48, 1.2, 'wharfWeatheredPlank', -53.5, 0.24, 16.0), // Cửa Tây cà phê vợt stools
    // Interior Food-Court Phở Bò & Bún Bò Huế counters + dining benches + craft islands
    makeReliefBox(2.8, 0.92, 1.2, 'benThanhRollShutter', -14.0, 0.76, 20.0),
    makeReliefBox(2.8, 0.92, 1.2, 'wharfWeatheredPlank', 14.0, 0.76, 20.0),
    makeReliefBox(2.6, 0.46, 0.60, 'wharfWeatheredPlank', -14.0, 0.52, 16.5),
    makeReliefBox(2.6, 0.46, 0.60, 'wharfWeatheredPlank', 14.0, 0.52, 16.5),
    makeReliefBox(2.2, 0.88, 1.1, 'benThanhSilkTextile', -24.0, 0.74, -8.0),
    makeReliefBox(2.2, 1.15, 1.1, 'benThanhTerracottaRoof', 24.0, 0.88, -8.0),
    makeReliefBox(2.2, 0.95, 1.1, 'benThanhSpiceDryGoods', -24.0, 0.78, 8.0),
    makeReliefBox(2.2, 0.95, 1.1, 'wovenBambooBasket', 24.0, 0.78, 8.0)
  );
  for (const ox of [-2.6, 2.6]) {
    for (const oz of [-1.3, 1.3]) {
      w6Bark.push(new THREE.CylinderGeometry(0.06, 0.07, 2.9, 4).translate(-24.0 + ox, 1.30, 37.5 + oz));
    }
  }
  w6Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.65, 5).translate(-24.0, 1.05, 37.5), 0xf0c224));
  for (const sx of [-4.5, 4.5]) {
    for (const sz of [-4.5, 4.5]) {
      w6Atlas.push(makeReliefBox(1.8, 0.46, 0.58, 'wharfWeatheredPlank', sx, 0.52, sz)); // Rotunda benches
    }
  }
  for (const sz of [-14.0, 14.0]) {
    w6Glow.push(new THREE.BoxGeometry(0.24, 0.28, 0.24).translate(0, 6.2, sz)); // N-S aisle hanging lanterns
  }
  for (const sx of [-48.5, 48.5]) {
    w6Iron.push(new THREE.CylinderGeometry(0.06, 0.06, 6.6, 4).translate(sx, 3.15, 24.0)); // North wing downspouts
  }
  for (const sx of [-16.0, 16.0]) {
    for (const sz of [-36.5, 36.5]) {
      w6Atlas.push(makeReliefCyl(0.38, 0.28, 0.58, 5, 'benThanhTerracottaRoof', sx, 0.29, sz));
      w6Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.65, 5).translate(sx, 0.88, sz), sz < 0 ? 0xf0c422 : 0xd83b7a));
    }
  }

  // ==========================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADES (2001–2060) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w7Atlas: THREE.BufferGeometry[] = [];
  const w7Gold: THREE.BufferGeometry[] = [];
  const w7Iron: THREE.BufferGeometry[] = [];
  const w7Bark: THREE.BufferGeometry[] = [];
  const w7Leaf: THREE.BufferGeometry[] = [];
  const w7Glow: THREE.BufferGeometry[] = [];

  // [2001–2020] Lê Thánh Tôn North Colonial Shophouse Strip (3 facades at z = +56), Flower-Market Arch, Stalls & Lamps
  for (let sh = 0; sh < 3; sh++) {
    const nshX = -26.0 + sh * 26.0;
    const nshZ = 56.0;
    const nshH = 7.4 + (sh % 2) * 0.8;
    w7Atlas.push(
      makeReliefBox(13.6, nshH, 7.2, 'benThanhCreamStucco', nshX, nshH * 0.5 - 0.1, nshZ),
      makeReliefBox(14.2, 0.30, 7.8, 'benThanhCreamStucco', nshX, nshH - 0.05, nshZ),
      makeReliefBox(14.0, 0.24, 2.4, 'benThanhCreamStucco', nshX, 3.65, nshZ - 4.4),
      makeReliefBox(2.2, 2.2, 0.24, 'benThanhGreenShutter', nshX - 3.4, 5.2, nshZ - 3.62),
      makeReliefBox(2.2, 2.2, 0.24, 'benThanhGreenShutter', nshX + 3.4, 5.2, nshZ - 3.62),
      makeReliefBox(6.4, 0.72, 0.22, sh % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', nshX, 4.15, nshZ - 5.55)
    );
    const nshRoof = remapRelief(createGableRoofGeometry(14.4, 8.2, 1.85, 0.22, 'x'), 'benThanhTerracottaRoof');
    nshRoof.translate(nshX, nshH + 0.04, nshZ);
    w7Atlas.push(nshRoof);
    for (const px of [-5.8, 0, 5.8]) {
      w7Atlas.push(makeReliefBox(0.42, 3.85, 0.42, 'benThanhCreamStucco', nshX + px, 1.78, nshZ - 5.4));
    }
    w7Iron.push(new THREE.BoxGeometry(12.4, 0.85, 0.10).translate(nshX, 4.25, nshZ - 5.45));
  }
  // North Flower-Market Welcome Arch (0, 45) & 3 North Pop-Up Stalls
  w7Iron.push(
    new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(-3.4, 2.05, 45.0),
    new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(3.4, 2.05, 45.0)
  );
  w7Atlas.push(makeReliefBox(7.4, 0.65, 0.24, 'benThanhTerracottaRoof', 0, 4.25, 45.0));
  w7Glow.push(new THREE.BoxGeometry(5.2, 0.32, 0.28).translate(0, 4.25, 45.0));
  for (const [nx, nz, mKey] of [[-38.0, 45.0, 'corrugatedTinRust'], [14.0, 45.0, 'corrugatedTinBlue'], [38.0, 45.0, 'corrugatedTinRust']] as const) {
    w7Atlas.push(
      makeReliefBox(3.4, 0.85, 2.4, 'wharfWeatheredPlank', nx, 0.42, nz),
      makeReliefBox(4.0, 0.14, 3.0, mKey, nx, 2.48, nz)
    );
    for (const ox of [-1.6, 1.6]) {
      w7Iron.push(new THREE.CylinderGeometry(0.04, 0.05, 2.65, 4).translate(nx + ox, 1.18, nz));
    }
    w7Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(nx, 2.28, nz));
  }
  for (const sx of [-14.0, 14.0]) {
    w7Iron.push(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 4).translate(sx, 2.05, 50.0));
    w7Glow.push(new THREE.BoxGeometry(0.28, 0.32, 0.28).translate(sx, 4.35, 50.0));
  }
  for (const px of [-34.0, -10.0, 10.0, 34.0]) {
    w7Atlas.push(makeReliefBox(2.2, 0.52, 1.0, 'benThanhCreamStucco', px, 0.26, 48.5));
    w7Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.72, 5).translate(px, 0.84, 48.5), 0x2f7d2e));
  }
  for (const sx of [-22.0, 22.0]) {
    w7Atlas.push(makeReliefBox(2.4, 0.46, 0.58, 'wharfWeatheredPlank', sx, 0.23, 49.5));
  }

  // [2021–2040] 23/9 Park Western Pergola (-64, -54), Ceramic-Mural Wall (-58, -66), Route Totem, Clock Pillars & Bike Dock #4
  w7Atlas.push(
    makeReliefBox(6.2, 0.20, 3.6, 'wharfWeatheredPlank', -64.0, 3.05, -54.0),
    makeReliefBox(3.4, 0.46, 0.58, 'wharfWeatheredPlank', -64.0, 0.23, -54.0),
    makeReliefBox(6.8, 2.6, 0.42, 'benThanhCreamStucco', -58.0, 1.30, -66.0), // Ceramic-Mural Art Wall
    makeReliefBox(5.8, 1.8, 0.48, 'corrugatedTinBlue', -58.0, 1.45, -66.0),
    makeReliefBox(0.55, 2.5, 0.22, 'corrugatedTinBlue', 38.0, 1.25, -52.0), // Route-Map Totem
    makeReliefBox(0.46, 1.25, 0.46, 'benThanhGreenShutter', 48.0, 0.62, -56.0), // Postal box #3
    makeReliefBox(6.4, 0.05, 2.0, 'benThanhCreamStucco', -56.0, 0.04, -58.0),
    makeReliefBox(6.4, 0.05, 2.0, 'benThanhCreamStucco', 48.0, 0.04, -70.0)
  );
  w7Glow.push(new THREE.BoxGeometry(0.42, 0.85, 0.26).translate(38.0, 1.85, -52.0));
  for (const ox of [-2.8, 2.8]) {
    for (const oz of [-1.5, 1.5]) {
      w7Iron.push(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 4).translate(-64.0 + ox, 1.45, -54.0 + oz));
    }
  }
  for (const sx of [-18.0, 18.0]) {
    w7Iron.push(new THREE.CylinderGeometry(0.10, 0.14, 3.8, 4).translate(sx, 1.75, -78.0));
    w7Gold.push(new THREE.BoxGeometry(0.72, 0.72, 0.36).translate(sx, 3.85, -78.0));
  }
  for (const sx of [-28.0, 28.0]) {
    w7Iron.push(new THREE.CylinderGeometry(0.08, 0.10, 3.4, 4).translate(sx, 1.55, -62.0)); // misting columns
  }
  w7Iron.push(new THREE.BoxGeometry(3.8, 0.08, 0.52).translate(-38.0, 0.05, -68.0)); // Bike Dock #4
  for (let bk = 0; bk < 3; bk++) {
    w7Atlas.push(makeReliefBox(0.22, 0.72, 1.2, 'corrugatedTinBlue', -39.1 + bk * 1.1, 0.45, -68.0));
  }
  for (const px of [-46.0, -14.0, 14.0, 46.0]) {
    w7Atlas.push(makeReliefBox(2.4, 0.52, 1.1, 'benThanhCreamStucco', px, 0.26, -78.0));
    w7Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.52, 0.78, 5).translate(px, 0.88, -78.0), 0x2f7d2e));
  }
  w7Gold.push(
    new THREE.BoxGeometry(0.85, 1.65, 0.32).translate(0, 0.82, -78.0), // Metro Line 1 commemorative stele
    new THREE.CylinderGeometry(0.05, 0.08, 5.2, 4).translate(-8.0, 2.45, -78.0),
    new THREE.CylinderGeometry(0.05, 0.08, 5.2, 4).translate(8.0, 2.45, -78.0)
  );
  for (const pz of [-42.0, -64.0]) {
    w7Iron.push(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 4).translate(-64.0, 2.05, pz));
    w7Glow.push(new THREE.BoxGeometry(0.28, 0.32, 0.28).translate(-64.0, 4.35, pz));
  }

  // [2041–2060] Exterior East/West Craft Awnings, Interior Specialty Counters, Rotunda Sign-Posts & Corner Planters
  for (const sx of [-54.5, 54.5]) {
    for (const sz of [-4.0, 4.0]) {
      w7Atlas.push(
        makeReliefBox(2.2, 0.82, 2.6, 'wharfWeatheredPlank', sx, 0.41, sz),
        makeReliefBox(2.6, 0.14, 3.0, sz < 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', sx, 2.45, sz)
      );
      w7Bark.push(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 4).translate(sx, 1.15, sz - 1.2));
    }
  }
  for (const sx of [-7.0, 7.0]) {
    for (const sz of [-7.0, 7.0]) {
      w7Gold.push(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 4).translate(sx, 1.35, sz));
    }
  }
  w7Atlas.push(
    makeReliefBox(2.6, 0.90, 1.2, 'benThanhSpiceDryGoods', -32.0, 0.75, -14.0),
    makeReliefBox(2.6, 0.90, 1.2, 'benThanhTerracottaRoof', 32.0, 0.75, -14.0),
    makeReliefBox(2.6, 0.90, 1.2, 'benThanhRollShutter', -32.0, 0.75, 14.0),
    makeReliefBox(2.6, 0.90, 1.2, 'wovenBambooBasket', 32.0, 0.75, 14.0),
    makeReliefBox(2.2, 0.95, 1.2, 'wharfWeatheredPlank', 0, 0.78, -10.5),
    makeReliefBox(2.4, 0.92, 1.0, 'benThanhRollShutter', 0, 0.76, 24.0)
  );
  for (const sx of [-20.0, 20.0]) {
    w7Glow.push(new THREE.BoxGeometry(0.24, 0.28, 0.24).translate(sx, 6.2, 0));
  }
  for (const sx of [-48.5, 48.5]) {
    w7Iron.push(new THREE.CylinderGeometry(0.06, 0.06, 6.6, 4).translate(sx, 3.15, -24.0));
  }
  for (const sx of [-53.5, 53.5]) {
    for (const sz of [-22.0, 22.0]) {
      w7Atlas.push(makeReliefCyl(0.38, 0.28, 0.58, 5, 'benThanhTerracottaRoof', sx, 0.29, sz));
      w7Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.65, 5).translate(sx, 0.88, sz), sx > 0 ? 0xd83b7a : 0xf0c422));
    }
  }

  // ==========================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADES (2401–2460) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w8Atlas: THREE.BufferGeometry[] = [];
  const w8Gold: THREE.BufferGeometry[] = [];
  const w8Iron: THREE.BufferGeometry[] = [];
  const w8Bark: THREE.BufferGeometry[] = [];
  const w8Leaf: THREE.BufferGeometry[] = [];
  const w8Glow: THREE.BufferGeometry[] = [];

  // [2401–2420] Phan Bội Châu East Heritage Shophouse Strip (3 facades at x = +66), Craft-Lane Arch, Stalls & Lamps
  for (let sh8 = 0; sh8 < 3; sh8++) {
    const eshX = 66.0;
    const eshZ = -18.0 + sh8 * 18.0;
    const eshH = 7.4 + (sh8 % 2) * 0.8;
    w8Atlas.push(
      makeReliefBox(7.2, eshH, 13.6, 'benThanhCreamStucco', eshX, eshH * 0.5 - 0.1, eshZ),
      makeReliefBox(7.8, 0.30, 14.2, 'benThanhCreamStucco', eshX, eshH - 0.05, eshZ),
      makeReliefBox(2.4, 0.24, 14.0, 'benThanhCreamStucco', eshX - 4.4, 3.65, eshZ),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', eshX - 3.62, 5.2, eshZ - 3.4),
      makeReliefBox(0.24, 2.2, 2.2, 'benThanhGreenShutter', eshX - 3.62, 5.2, eshZ + 3.4),
      makeReliefBox(0.22, 0.72, 6.4, sh8 % 2 === 0 ? 'benThanhTerracottaRoof' : 'corrugatedTinBlue', eshX - 5.55, 4.15, eshZ)
    );
    const eshRoof = remapRelief(createGableRoofGeometry(8.2, 14.4, 1.85, 0.22, 'z'), 'benThanhTerracottaRoof');
    eshRoof.translate(eshX, eshH + 0.04, eshZ);
    w8Atlas.push(eshRoof);
    for (const pz of [-5.8, 0, 5.8]) {
      w8Atlas.push(makeReliefBox(0.42, 3.85, 0.42, 'benThanhCreamStucco', eshX - 5.4, 1.78, eshZ + pz));
    }
    w8Iron.push(new THREE.BoxGeometry(0.10, 0.85, 12.4).translate(eshX - 5.45, 4.25, eshZ));
  }
  // East Craft-Lane Welcome Arch (+58, -26) & 3 East Pop-Up Stalls
  w8Iron.push(
    new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(58.0, 2.05, -29.2),
    new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(58.0, 2.05, -22.8)
  );
  w8Atlas.push(makeReliefBox(0.24, 0.65, 7.0, 'benThanhTerracottaRoof', 58.0, 4.25, -26.0));
  w8Glow.push(new THREE.BoxGeometry(0.28, 0.32, 5.0).translate(58.0, 4.25, -26.0));
  for (const [ex8, ez8, mKey8] of [[58.0, -12.0, 'corrugatedTinRust'], [58.0, 12.0, 'corrugatedTinBlue'], [58.0, 26.0, 'corrugatedTinRust']] as const) {
    w8Atlas.push(
      makeReliefBox(2.4, 0.85, 3.4, 'wharfWeatheredPlank', ex8, 0.42, ez8),
      makeReliefBox(3.0, 0.14, 4.0, mKey8, ex8, 2.48, ez8)
    );
    for (const oz of [-1.6, 1.6]) {
      w8Iron.push(new THREE.CylinderGeometry(0.04, 0.05, 2.65, 4).translate(ex8, 1.18, ez8 + oz));
    }
    w8Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(ex8, 2.28, ez8));
  }
  for (const sz of [-24.0, 24.0]) {
    w8Iron.push(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 4).translate(61.5, 2.05, sz));
    w8Glow.push(new THREE.BoxGeometry(0.28, 0.32, 0.28).translate(61.5, 4.35, sz));
  }
  for (const pz of [-18.0, -6.0, 6.0, 18.0]) {
    w8Atlas.push(makeReliefBox(1.0, 0.52, 2.2, 'benThanhCreamStucco', 61.5, 0.26, pz));
    w8Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.72, 5).translate(61.5, 0.84, pz), 0x2f7d2e));
  }
  for (const sz of [-12.0, 12.0]) {
    w8Atlas.push(makeReliefBox(0.58, 0.46, 2.4, 'wharfWeatheredPlank', 61.5, 0.23, sz));
  }

  // [2421–2440] Phan Chu Trinh West Night-Market Dining Strip (-66, -18/0/+18), Bike Dock #5, Route Totem #2 & Metro Plinths
  for (let nm8 = 0; nm8 < 3; nm8++) {
    const wnmZ = -18.0 + nm8 * 18.0;
    w8Atlas.push(
      makeReliefBox(5.2, 0.18, 10.6, nm8 % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', -66.0, 3.05, wnmZ),
      makeReliefBox(1.4, 0.72, 6.2, 'wharfWeatheredPlank', -66.0, 0.36, wnmZ)
    );
    for (const ox of [-2.2, 2.2]) {
      for (const oz of [-4.6, 4.6]) {
        w8Iron.push(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 4).translate(-66.0 + ox, 1.45, wnmZ + oz));
      }
    }
    w8Glow.push(new THREE.BoxGeometry(0.22, 0.22, 4.2).translate(-63.4, 2.85, wnmZ));
  }
  // West Night-Market Welcome Arch (-58, -26) & 2 West Street-Food Carts
  w8Iron.push(
    new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(-58.0, 2.05, -29.2),
    new THREE.CylinderGeometry(0.10, 0.12, 4.4, 4).translate(-58.0, 2.05, -22.8)
  );
  w8Atlas.push(makeReliefBox(0.24, 0.65, 7.0, 'benThanhTerracottaRoof', -58.0, 4.25, -26.0));
  w8Glow.push(new THREE.BoxGeometry(0.28, 0.32, 5.0).translate(-58.0, 4.25, -26.0));
  for (const wz8 of [-12.0, 12.0]) {
    w8Atlas.push(
      makeReliefBox(2.2, 0.85, 3.2, 'wharfWeatheredPlank', -58.0, 0.42, wz8),
      makeReliefBox(2.8, 0.14, 3.8, 'corrugatedTinBlue', -58.0, 2.48, wz8)
    );
    w8Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(-58.0, 2.28, wz8));
  }
  for (const pz of [-18.0, -6.0, 6.0, 18.0]) {
    w8Atlas.push(makeReliefBox(1.0, 0.52, 2.2, 'benThanhCreamStucco', -61.5, 0.26, pz));
    w8Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.72, 5).translate(-61.5, 0.84, pz), 0x2f7d2e));
  }
  for (const sz of [-24.0, 24.0]) {
    w8Iron.push(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 4).translate(-61.5, 2.05, sz));
    w8Glow.push(new THREE.BoxGeometry(0.28, 0.32, 0.28).translate(-61.5, 4.35, sz));
  }
  w8Iron.push(new THREE.BoxGeometry(3.8, 0.08, 0.52).translate(38.0, 0.05, -68.0)); // Bike Dock #5
  for (let bk8 = 0; bk8 < 3; bk8++) {
    w8Atlas.push(makeReliefBox(0.22, 0.72, 1.2, 'corrugatedTinBlue', 36.9 + bk8 * 1.1, 0.45, -68.0));
  }
  w8Atlas.push(
    makeReliefBox(0.55, 2.5, 0.22, 'corrugatedTinBlue', -38.0, 1.25, -52.0), // Route-Map Totem #2
    makeReliefBox(0.46, 1.25, 0.46, 'benThanhGreenShutter', -48.0, 0.62, -56.0), // Postal box #4
    makeReliefBox(2.0, 0.05, 6.4, 'benThanhCreamStucco', -58.0, 0.04, 0),
    makeReliefBox(2.0, 0.05, 6.4, 'benThanhCreamStucco', 58.0, 0.04, 0)
  );
  w8Glow.push(new THREE.BoxGeometry(0.42, 0.85, 0.26).translate(-38.0, 1.85, -52.0));
  for (const sx of [-42.0, 42.0]) {
    w8Iron.push(new THREE.CylinderGeometry(0.08, 0.10, 3.4, 4).translate(sx, 1.55, -62.0)); // outer misting columns
  }
  for (const sx of [-26.0, 26.0]) {
    w8Gold.push(new THREE.BoxGeometry(0.85, 1.65, 0.32).translate(sx, 0.82, -78.0)); // Heritage steles
  }
  for (const sx of [-32.0, 32.0]) {
    w8Gold.push(new THREE.CylinderGeometry(0.05, 0.08, 5.2, 4).translate(sx, 2.45, -78.0)); // Banner flagpoles
  }

  // [2441–2460] Market Hall Outer Corner Awnings, Interior Specialty Counters, Rotunda Chime-Lanterns & Planters
  for (const sx of [-54.5, 54.5]) {
    for (const sz of [-16.0, 16.0]) {
      w8Atlas.push(
        makeReliefBox(2.2, 0.82, 2.6, 'wharfWeatheredPlank', sx, 0.41, sz),
        makeReliefBox(2.6, 0.14, 3.0, sz < 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', sx, 2.45, sz)
      );
      w8Bark.push(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 4).translate(sx, 1.15, sz - 1.2));
    }
  }
  for (const sx of [-9.5, 9.5]) {
    for (const sz of [-9.5, 9.5]) {
      w8Gold.push(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 4).translate(sx, 1.35, sz));
    }
  }
  w8Atlas.push(
    makeReliefBox(2.6, 0.90, 1.2, 'benThanhSpiceDryGoods', -24.0, 0.75, -18.0),
    makeReliefBox(2.6, 0.90, 1.2, 'benThanhTerracottaRoof', 24.0, 0.75, -18.0),
    makeReliefBox(2.6, 0.90, 1.2, 'benThanhRollShutter', -24.0, 0.75, 18.0),
    makeReliefBox(2.6, 0.90, 1.2, 'wovenBambooBasket', 24.0, 0.75, 18.0),
    makeReliefBox(1.2, 0.95, 2.2, 'wharfWeatheredPlank', 10.5, 0.78, 0),
    makeReliefBox(1.0, 0.92, 2.4, 'benThanhRollShutter', -10.5, 0.76, 0)
  );
  for (const sz of [-18.0, 18.0]) {
    w8Glow.push(new THREE.BoxGeometry(0.24, 0.28, 0.24).translate(0, 6.2, sz));
  }
  for (const sx of [-48.5, 48.5]) {
    w8Iron.push(new THREE.CylinderGeometry(0.06, 0.06, 6.6, 4).translate(sx, 3.15, 24.0));
  }
  for (const sx of [-14.0, 14.0]) {
    w8Atlas.push(makeReliefCyl(0.38, 0.28, 0.58, 5, 'benThanhTerracottaRoof', sx, 0.29, -34.5));
    w8Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.65, 5).translate(sx, 0.88, -34.5), sx > 0 ? 0xd83b7a : 0xf0c422));
  }
  for (const sx of [-6.5, 6.5]) {
    w8Glow.push(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(sx, 4.2, 34.2));
  }

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

  // Wave 3 merged meshes (castShadow = false, zero new materials!)
  const w3AtlasM = createMergedMesh('BenThanhWave3Atlas', w3Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w3AtlasM) group.add(w3AtlasM);
  const w3GoldM = createMergedMesh('BenThanhWave3Gold', w3Gold, ctx.materials.gold, false, false);
  if (w3GoldM) group.add(w3GoldM);
  const w3IronM = createMergedMesh('BenThanhWave3Iron', w3Iron, ctx.materials.granite, false, true);
  if (w3IronM) group.add(w3IronM);
  const w3BarkM = createMergedMesh('BenThanhWave3Bark', w3Bark, ctx.materials.bark, false, true);
  if (w3BarkM) group.add(w3BarkM);
  const w3LeafM = createMergedMesh('BenThanhWave3Leaf', w3Leaf, foliageMat, false, false);
  if (w3LeafM) group.add(w3LeafM);
  const w3GlowM = createMergedMesh('BenThanhWave3Glow', w3Glow, glowMat, false, false);
  if (w3GlowM) group.add(w3GlowM);

  // Wave 4 merged meshes (castShadow = false, zero new materials!)
  const w4AtlasM = createMergedMesh('BenThanhWave4Atlas', w4Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w4AtlasM) group.add(w4AtlasM);
  const w4GoldM = createMergedMesh('BenThanhWave4Gold', w4Gold, ctx.materials.gold, false, false);
  if (w4GoldM) group.add(w4GoldM);
  const w4IronM = createMergedMesh('BenThanhWave4Iron', w4Iron, ctx.materials.granite, false, true);
  if (w4IronM) group.add(w4IronM);
  const w4BarkM = createMergedMesh('BenThanhWave4Bark', w4Bark, ctx.materials.bark, false, true);
  if (w4BarkM) group.add(w4BarkM);
  const w4LeafM = createMergedMesh('BenThanhWave4Leaf', w4Leaf, foliageMat, false, false);
  if (w4LeafM) group.add(w4LeafM);
  const w4GlowM = createMergedMesh('BenThanhWave4Glow', w4Glow, glowMat, false, false);
  if (w4GlowM) group.add(w4GlowM);

  // Wave 5 merged meshes (castShadow = false, zero new materials!)
  const w5AtlasM = createMergedMesh('BenThanhWave5Atlas', w5Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w5AtlasM) group.add(w5AtlasM);
  const w5GoldM = createMergedMesh('BenThanhWave5Gold', w5Gold, ctx.materials.gold, false, false);
  if (w5GoldM) group.add(w5GoldM);
  const w5IronM = createMergedMesh('BenThanhWave5Iron', w5Iron, ctx.materials.granite, false, true);
  if (w5IronM) group.add(w5IronM);
  const w5BarkM = createMergedMesh('BenThanhWave5Bark', w5Bark, ctx.materials.bark, false, true);
  if (w5BarkM) group.add(w5BarkM);
  const w5LeafM = createMergedMesh('BenThanhWave5Leaf', w5Leaf, foliageMat, false, false);
  if (w5LeafM) group.add(w5LeafM);
  const w5GlowM = createMergedMesh('BenThanhWave5Glow', w5Glow, glowMat, false, false);
  if (w5GlowM) group.add(w5GlowM);

  // Wave 6 merged meshes (castShadow = false, zero new materials!)
  const w6AtlasM = createMergedMesh('BenThanhWave6Atlas', w6Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w6AtlasM) group.add(w6AtlasM);
  const w6GoldM = createMergedMesh('BenThanhWave6Gold', w6Gold, ctx.materials.gold, false, false);
  if (w6GoldM) group.add(w6GoldM);
  const w6IronM = createMergedMesh('BenThanhWave6Iron', w6Iron, ctx.materials.granite, false, true);
  if (w6IronM) group.add(w6IronM);
  const w6BarkM = createMergedMesh('BenThanhWave6Bark', w6Bark, ctx.materials.bark, false, true);
  if (w6BarkM) group.add(w6BarkM);
  const w6LeafM = createMergedMesh('BenThanhWave6Leaf', w6Leaf, foliageMat, false, false);
  if (w6LeafM) group.add(w6LeafM);
  const w6GlowM = createMergedMesh('BenThanhWave6Glow', w6Glow, glowMat, false, false);
  if (w6GlowM) group.add(w6GlowM);

  // Wave 7 merged meshes (castShadow = false, zero new materials!)
  const w7AtlasM = createMergedMesh('BenThanhWave7Atlas', w7Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w7AtlasM) group.add(w7AtlasM);
  const w7GoldM = createMergedMesh('BenThanhWave7Gold', w7Gold, ctx.materials.gold, false, false);
  if (w7GoldM) group.add(w7GoldM);
  const w7IronM = createMergedMesh('BenThanhWave7Iron', w7Iron, ctx.materials.granite, false, true);
  if (w7IronM) group.add(w7IronM);
  const w7BarkM = createMergedMesh('BenThanhWave7Bark', w7Bark, ctx.materials.bark, false, true);
  if (w7BarkM) group.add(w7BarkM);
  const w7LeafM = createMergedMesh('BenThanhWave7Leaf', w7Leaf, foliageMat, false, false);
  if (w7LeafM) group.add(w7LeafM);
  const w7GlowM = createMergedMesh('BenThanhWave7Glow', w7Glow, glowMat, false, false);
  if (w7GlowM) group.add(w7GlowM);

  // Wave 8 merged meshes (castShadow = false, zero new materials!)
  const w8AtlasM = createMergedMesh('BenThanhWave8Atlas', w8Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (w8AtlasM) group.add(w8AtlasM);
  const w8GoldM = createMergedMesh('BenThanhWave8Gold', w8Gold, ctx.materials.gold, false, false);
  if (w8GoldM) group.add(w8GoldM);
  const w8IronM = createMergedMesh('BenThanhWave8Iron', w8Iron, ctx.materials.granite, false, true);
  if (w8IronM) group.add(w8IronM);
  const w8BarkM = createMergedMesh('BenThanhWave8Bark', w8Bark, ctx.materials.bark, false, true);
  if (w8BarkM) group.add(w8BarkM);
  const w8LeafM = createMergedMesh('BenThanhWave8Leaf', w8Leaf, foliageMat, false, false);
  if (w8LeafM) group.add(w8LeafM);
  const w8GlowM = createMergedMesh('BenThanhWave8Glow', w8Glow, glowMat, false, false);
  if (w8GlowM) group.add(w8GlowM);

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
  // Phase 1 Audit Fix: Relocated north-bank palms cleanly outside shophouses & craft workshops (>= 5m clearance!)
  const palmSpots: Array<[number, number, number]> = [
    [cx - 66, 333, 0.3], [cx - 52, 322, 0.25], [cx - 24, 313, 0.25],
    [cx + 24, 313, -0.25], [cx + 55, 333, -0.25], [cx + 52, 322, -0.2],
    [cx - 48, 387, -0.28], [cx - 18, 388, -0.22], [cx + 8, 387, 0.25], [cx + 42, 387, 0.3]
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
  // [229] Riverside Quán Cà Phê Võng (hammock coffee pavilion — Phase 1 Fix: moved forward to z = 339.8 clear of Shophouse #6!)
  const cfX = cx + 14.5;
  const cfZ = 339.8;
  const cfY = Math.max(1.25, ctx.getHeight(cfX, cfZ));
  crW2Atlas.push(
    makeReliefBox(5.2, 0.20, 4.2, 'wharfWeatheredPlank', cfX, cfY + 0.10, cfZ),
    makeReliefBox(5.6, 0.16, 4.6, 'corrugatedTinBlue', cfX, cfY + 2.75, cfZ),
    makeReliefBox(2.0, 0.14, 0.72, 'benThanhSilkTextile', cfX - 0.8, cfY + 0.95, cfZ),
    makeReliefBox(2.0, 0.14, 0.72, 'benThanhSilkTextile', cfX + 1.1, cfY + 0.95, cfZ + 0.8)
  );
  for (const px of [-2.4, 2.4]) {
    for (const pz of [-1.9, 1.9]) {
      crW2Atlas.push(makeReliefCyl(0.08, 0.10, cfY + 4.4, 5, 'wharfWeatheredPlank', cfX + px, (cfY + 2.75 - 1.65) * 0.5, cfZ + pz));
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

  // ==========================================================================
  // WAVE 3 REAL-WORLD VISUAL QC UPGRADES (461–520) — Low-Poly, castShadow=false
  // ==========================================================================
  const crW3Atlas: THREE.BufferGeometry[] = [];
  const crW3Iron: THREE.BufferGeometry[] = [];
  const crW3Bark: THREE.BufferGeometry[] = [];
  const crW3Leaf: THREE.BufferGeometry[] = [];
  const crW3Glow: THREE.BufferGeometry[] = [];

  // [461–476] TRADITIONAL LÒ HỦ TIẾU (CÁI RĂNG RICE-NOODLE FACTORY & WORKSHOP) on Eastern Riverbank (Phase 1 Fix: z = 341.2 clear of Shophouse #7!)
  const htX = cx + 29.0;
  const htZ = 341.2;
  const htY = Math.max(1.35, ctx.getHeight(htX, htZ) + 0.25);
  // Stilt deck + grounded pilings into seabed + corrugated gable workshop roof
  crW3Atlas.push(makeReliefBox(11.6, 0.24, 7.6, 'wharfWeatheredPlank', htX, htY, htZ));
  for (const ox of [-5.2, 0, 5.2]) {
    for (const oz of [-3.4, 3.4]) {
      crW3Atlas.push(
        makeReliefCyl(0.14, 0.16, htY + 2.0, 5, 'wharfWeatheredPlank', htX + ox, (htY - 2.0) * 0.5, htZ + oz),
        makeReliefCyl(0.10, 0.12, 3.65, 5, 'wharfWeatheredPlank', htX + ox, htY + 1.72, htZ + oz)
      );
    }
  }
  const htRoof = remapRelief(createGableRoofGeometry(12.6, 8.4, 1.75, 0.16, 'x'), 'corrugatedTinRust');
  htRoof.translate(htX, htY + 3.45, htZ);
  crW3Atlas.push(htRoof);
  // [462][463][465][466][467][468][470][471][472][473] Steaming hearth, millstone, cutter table, rice-husk sacks, tasting table, signboard, lu jars, mẹt trays & bulbs
  crW3Atlas.push(
    makeReliefCyl(0.65, 0.72, 0.92, 6, 'benThanhTerracottaRoof', htX - 3.2, htY + 0.52, htZ - 1.2), // steaming hearth
    makeReliefCyl(0.42, 0.42, 0.16, 6, 'benThanhCreamStucco', htX - 3.2, htY + 1.04, htZ - 1.2), // cloth steamer drum
    makeReliefCyl(0.36, 0.42, 0.65, 6, 'benThanhCreamStucco', htX - 1.4, htY + 0.42, htZ - 1.4), // stone rice mill
    makeReliefBox(2.4, 0.82, 1.1, 'wharfWeatheredPlank', htX + 1.4, htY + 0.52, htZ - 1.2), // noodle-cutting table
    makeReliefCyl(0.32, 0.36, 0.65, 6, 'wovenBambooBasket', htX - 4.4, htY + 0.42, htZ + 1.2), // rice-husk sack
    makeReliefBox(2.2, 0.74, 1.15, 'wharfWeatheredPlank', htX + 3.6, htY + 0.48, htZ + 1.4), // tasting table
    makeReliefBox(5.6, 0.75, 0.14, 'corrugatedTinBlue', htX, htY + 3.15, htZ + 3.62), // workshop signboard
    makeReliefCyl(0.30, 0.24, 0.62, 6, 'benThanhTerracottaRoof', htX - 5.2, htY + 0.42, htZ + 2.4), // lu water jar
    makeReliefCyl(0.42, 0.42, 0.08, 6, 'wovenBambooBasket', htX + 4.8, htY + 1.15, htZ + 3.35, 0, Math.PI * 0.5, 0), // mẹt drying tray
    makeReliefBox(1.2, 0.52, 0.85, 'wharfWeatheredPlank', htX - 4.6, htY + 0.36, htZ - 2.6) // firewood stack
  );
  for (const bx of [-3.0, 0, 3.0]) {
    crW3Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(htX + bx, htY + 3.25, htZ));
  }
  // [464] 4 Sloped bamboo vỉ phơi hủ tiếu sun-drying racks (white, pandan-green, gac-red noodle sheets)
  for (let dr = 0; dr < 4; dr++) {
    const dx = htX - 4.2 + dr * 2.8;
    const dz = htZ + 5.6;
    crW3Atlas.push(
      makeReliefBox(2.2, 0.08, 1.4, dr === 1 ? 'benThanhGreenShutter' : dr === 2 ? 'benThanhTerracottaRoof' : 'benThanhCreamStucco', dx, htY + 0.92, dz, 0, 0.32, 0),
      makeReliefCyl(0.04, 0.05, htY + 2.2, 5, 'wovenBambooBasket', dx - 0.9, (htY + 0.8 - 1.4) * 0.5, dz),
      makeReliefCyl(0.04, 0.05, htY + 2.2, 5, 'wovenBambooBasket', dx + 0.9, (htY + 0.8 - 1.4) * 0.5, dz)
    );
  }
  // [469][474][475][476] Hủ Tiếu jetty, connecting walkway, moored tourist sampan & timber steps
  crW3Atlas.push(
    makeReliefBox(4.2, 0.22, 4.8, 'wharfWeatheredPlank', htX, htY - 0.15, htZ + 6.4),
    makeReliefBox(7.2, 0.20, 1.8, 'wharfWeatheredPlank', htX - 9.2, htY - 0.05, htZ - 1.2),
    makeReliefBox(1.25, 0.38, 4.4, 'wharfWeatheredPlank', htX + 3.4, 0.16, htZ + 9.2, 0.35),
    makeReliefBox(1.8, 0.16, 2.2, 'wharfWeatheredPlank', htX, htY - 0.62, htZ + 9.4, 0, 0.38, 0)
  );
  for (const ox of [-1.8, 1.8]) {
    crW3Atlas.push(makeReliefCyl(0.10, 0.12, htY + 1.8, 5, 'wharfWeatheredPlank', htX + ox, (htY - 1.9) * 0.5, htZ + 8.5));
  }

  // [477–490] TRADITIONAL LÒ KẸO DỪA (COCONUT CANDY WORKSHOP & MEKONG CRAFT PIER) on Western Riverbank (Phase 1 Fix: z = 340.5 clear of Shophouse #0!)
  const kdX = cx - 44.0;
  const kdZ = 340.5;
  const kdY = Math.max(1.3, ctx.getHeight(kdX, kdZ) + 0.25);
  crW3Atlas.push(makeReliefBox(10.4, 0.24, 6.8, 'wharfWeatheredPlank', kdX, kdY, kdZ));
  for (const ox of [-4.6, 0, 4.6]) {
    for (const oz of [-3.0, 3.0]) {
      crW3Atlas.push(
        makeReliefCyl(0.14, 0.16, kdY + 2.0, 5, 'wharfWeatheredPlank', kdX + ox, (kdY - 2.0) * 0.5, kdZ + oz),
        makeReliefCyl(0.10, 0.12, 3.55, 5, 'wharfWeatheredPlank', kdX + ox, kdY + 1.65, kdZ + oz)
      );
    }
  }
  const kdRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.65, 0.16, 'x'), 'corrugatedTinBlue');
  kdRoof.translate(kdX, kdY + 3.35, kdZ);
  crW3Atlas.push(kdRoof);
  // [478–490] Boiling wok stove, grating bench, molding slab, souvenir counter, signboard, drying mats, coconut husks, tea veranda, jetty, wheelbarrow, mai pots & lanterns
  crW3Atlas.push(
    makeReliefCyl(0.62, 0.68, 0.88, 6, 'benThanhTerracottaRoof', kdX - 2.8, kdY + 0.52, kdZ - 1.0), // boiling stove
    makeReliefBox(1.8, 0.72, 0.95, 'wharfWeatheredPlank', kdX - 0.6, kdY + 0.48, kdZ - 1.2), // grating bench
    makeReliefBox(2.2, 0.78, 1.15, 'benThanhCreamStucco', kdX + 1.8, kdY + 0.50, kdZ - 1.0), // candy molding slab
    makeReliefBox(2.6, 0.95, 0.95, 'wharfWeatheredPlank', kdX + 2.8, kdY + 0.58, kdZ + 1.4), // souvenir showcase
    makeReliefBox(5.2, 0.72, 0.14, 'benThanhTerracottaRoof', kdX, kdY + 3.05, kdZ + 3.25), // craft-pier signboard
    makeReliefBox(2.6, 0.06, 1.6, 'wovenBambooBasket', kdX - 2.6, kdY + 0.15, kdZ + 2.0), // coconut drying mat
    makeReliefCyl(0.68, 0.85, 0.72, 6, 'benThanhSpiceDryGoods', kdX - 4.4, kdY + 0.45, kdZ - 2.0), // husk pile
    makeReliefBox(3.8, 0.22, 4.4, 'wharfWeatheredPlank', kdX, kdY - 0.15, kdZ + 5.6), // craft jetty
    makeReliefCyl(0.28, 0.22, 0.48, 6, 'benThanhTerracottaRoof', kdX + 4.4, kdY + 0.36, kdZ + 2.8) // mai vàng pot
  );
  crW3Iron.push(new THREE.CylinderGeometry(0.58, 0.38, 0.28, 6).translate(kdX - 2.8, kdY + 1.02, kdZ - 1.0)); // cast-iron wok
  crW3Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.52, 0.85, 5).translate(kdX + 4.4, kdY + 0.95, kdZ + 2.8), 0xf0c422));
  for (const bx of [-2.4, 2.4]) {
    crW3Atlas.push(makeReliefCyl(0.10, 0.12, kdY + 1.8, 5, 'wharfWeatheredPlank', kdX + bx * 0.7, (kdY - 1.9) * 0.5, kdZ + 7.4));
    crW3Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kdX + bx, kdY + 2.95, kdZ + 3.1));
  }

  // [491][492][493][494] 2 Large Wholesale Fruit Barges (Ghe Chành Trái Cây) with dual Cây Bẹo poles, cabins & supply boat
  for (const [bx, bz, byaw, idx] of [[cx - 22.0, 376.5, 0.18, 0], [cx + 22.0, 376.0, -0.22, 1]] as const) {
    const sinY = Math.sin(byaw);
    const cosY = Math.cos(byaw);
    const cabX = bx - sinY * 3.2;
    const cabZ = bz - cosY * 3.2;
    const prowX = bx + sinY * 4.4;
    const prowZ = bz + cosY * 4.4;
    crW3Atlas.push(
      makeReliefBox(3.6, 1.15, 11.4, 'gheBauPlankedHull', bx, 0.45, bz, byaw),
      makeReliefBox(3.2, 0.55, 5.2, idx === 0 ? 'watermelonStripedSkin' : 'benThanhSpiceDryGoods', bx + sinY * 1.8, 1.25, bz + cosY * 1.8, byaw),
      makeReliefBox(3.1, 1.35, 3.8, 'mekongShophouseWall', cabX, 1.65, cabZ, byaw),
      makeReliefBox(3.4, 0.18, 4.2, idx === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', cabX, 2.42, cabZ, byaw),
      // Tall dual Cây Bẹo produce poles seated flush on rotated prow deck
      makeReliefCyl(0.03, 0.04, 5.2, 5, 'wovenBambooBasket', prowX - cosY * 0.6, 3.1, prowZ + sinY * 0.6, byaw),
      makeReliefCyl(0.03, 0.04, 4.8, 5, 'wovenBambooBasket', prowX + cosY * 0.6, 2.9, prowZ - sinY * 0.6, byaw),
      makeReliefCyl(0.24, 0.24, 0.34, 6, 'watermelonStripedSkin', prowX - cosY * 0.6, 5.2, prowZ + sinY * 0.6),
      makeReliefCyl(0.22, 0.22, 0.34, 6, 'benThanhSpiceDryGoods', prowX + cosY * 0.6, 4.8, prowZ - sinY * 0.6)
    );
  }
  // [495] Floating Mekong Bè Nuôi Cá (fish-cage houseboat) along far bank
  const fcX = cx + 42.0;
  const fcZ = 378.0;
  crW3Atlas.push(
    makeReliefBox(7.2, 0.36, 5.4, 'wharfWeatheredPlank', fcX, 0.18, fcZ),
    makeReliefBox(4.8, 2.2, 3.8, 'mekongShophouseWall', fcX, 1.45, fcZ - 0.4),
    makeReliefBox(5.6, 0.22, 4.4, 'corrugatedTinBlue', fcX, 2.68, fcZ - 0.4)
  );
  // [496][497][498][499][500][501] Shophouse stilt-piers, produce chutes, pineapple carving table, chalkboard, floating petrol raft & Đờn Ca Tài Tử music boat
  for (const spX of [cx - 24.0, cx - 14.0, cx + 39.0]) {
    crW3Atlas.push(
      makeReliefBox(2.6, 0.20, 4.2, 'wharfWeatheredPlank', spX, 1.35, 336.5),
      makeReliefCyl(0.10, 0.12, 3.2, 5, 'wharfWeatheredPlank', spX - 1.1, -0.25, 338.2),
      makeReliefCyl(0.10, 0.12, 3.2, 5, 'wharfWeatheredPlank', spX + 1.1, -0.25, 338.2)
    );
  }
  crW3Atlas.push(
    makeReliefBox(1.8, 0.82, 0.95, 'wharfWeatheredPlank', cx + 6.4, dockY + 0.56, 344.2), // pineapple carving table
    makeReliefBox(1.8, 1.15, 0.10, 'benThanhGreenShutter', cx - 6.8, dockY + 2.35, 344.2), // price chalkboard
    // Floating petrol pump raft (Cây Xăng Nổi)
    makeReliefBox(4.2, 0.38, 3.6, 'wharfWeatheredPlank', cx + 34.0, 0.18, 358.0),
    makeReliefBox(0.85, 1.55, 0.65, 'benThanhTerracottaRoof', cx + 34.0, 1.12, 358.0),
    // Đờn Ca Tài Tử cultural music boat
    makeReliefBox(2.6, 0.58, 7.6, 'gheBauPlankedHull', cx - 2.0, 0.28, 369.0, 0.15),
    makeReliefBox(2.5, 0.16, 5.2, 'benThanhTerracottaRoof', cx - 2.0, 2.15, 369.0, 0.15)
  );
  for (const ox of [-1.1, 1.1]) {
    for (const oz of [-2.2, 2.2]) {
      const mpx = cx - 2.0 + Math.cos(0.15) * ox + Math.sin(0.15) * oz;
      const mpz = 369.0 - Math.sin(0.15) * ox + Math.cos(0.15) * oz;
      crW3Iron.push(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 5).translate(mpx, 1.35, mpz));
    }
  }
  // [502–520] Riverfront laundry/planters, utility poles, duck pen, navigation buoys, photo-frame arch, southern gazebos, river-taxi booth, nón lá tree, riprap, life-jacket rack, flower sampan & floodlights
  for (let up = 0; up < 4; up++) {
    const ux = cx - 36.0 + up * 24.0;
    const uy = Math.max(1.2, ctx.getHeight(ux, 326.5));
    crW3Bark.push(new THREE.CylinderGeometry(0.10, 0.14, 7.2, 5).translate(ux, uy + 3.4, 326.5));
  }
  // Red-and-white river navigation buoys
  for (const [bx, bz] of [[cx - 48.0, 368.0], [cx + 46.0, 368.0]]) {
    crW3Atlas.push(makeReliefCyl(0.28, 0.36, 1.1, 6, 'benThanhTerracottaRoof', bx, 0.45, bz));
    crW3Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(bx, 1.12, bz));
  }
  // Tourist photo-frame archway on eastern wharf deck & river-taxi ticket booth
  crW3Atlas.push(
    makeReliefCyl(0.08, 0.10, 2.8, 5, 'wovenBambooBasket', cx + 7.8, dockY + 1.4, 348.2),
    makeReliefCyl(0.08, 0.10, 2.8, 5, 'wovenBambooBasket', cx + 7.8, dockY + 1.4, 345.2),
    makeReliefBox(0.24, 0.52, 3.4, 'benThanhTerracottaRoof', cx + 7.8, dockY + 2.85, 346.7),
    // Landward river-taxi ticket booth (Phase 1 Fix: flush roof seating at bankY + 2.28!)
    makeReliefBox(2.6, 2.2, 2.2, 'mekongShophouseWall', cx - 6.2, bankY + 1.1, 333.8),
    makeReliefBox(3.2, 0.18, 2.8, 'corrugatedTinBlue', cx - 6.2, bankY + 2.28, 333.8),
    // Life-jacket rack & flower-delivery sampan
    makeReliefBox(1.8, 1.25, 0.24, 'corrugatedTinRust', cx - 3.6, dockY + 0.72, 349.0),
    makeReliefBox(1.25, 0.36, 4.4, 'wharfWeatheredPlank', cx + 8.5, 0.16, 362.0, -0.45)
  );
  crW3Leaf.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.55, 5).translate(cx + 8.5, 0.58, 362.0), 0xf0c224));
  // Southern riverbank thatched resting gazebo on grounded stilts
  const gzX = cx - 4.0;
  const gzZ = 385.0;
  crW3Atlas.push(makeReliefBox(4.2, 0.22, 4.2, 'wharfWeatheredPlank', gzX, 1.15, gzZ));
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.8, 1.8]) {
      crW3Atlas.push(makeReliefCyl(0.09, 0.11, 4.4, 5, 'wharfWeatheredPlank', gzX + ox, 1.35, gzZ + oz));
    }
  }
  crW3Atlas.push(makeReliefCyl(0.18, 3.2, 1.35, 4, 'wovenBambooBasket', gzX, 4.15, gzZ, Math.PI * 0.25));
  // Wharf corner floodlight poles (grounded into wharf deck)
  for (const fx of [cx - 8.6, cx + 8.6]) {
    crW3Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 4.8, 5).translate(fx, dockY + 2.4, 349.2));
    crW3Glow.push(new THREE.BoxGeometry(0.32, 0.22, 0.18).translate(fx, dockY + 4.85, 349.3));
  }

  // ==========================================================================
  // WAVE 4 REAL-WORLD VISUAL QC UPGRADES (861–920) — Low-Poly, castShadow=false
  // ==========================================================================
  const crW4Atlas: THREE.BufferGeometry[] = [];
  const crW4Iron: THREE.BufferGeometry[] = [];
  const crW4Bark: THREE.BufferGeometry[] = [];
  const crW4Leaf: THREE.BufferGeometry[] = [];
  const crW4Glow: THREE.BufferGeometry[] = [];

  // [861–880] EASTERN RIVERBANK LÒ BÁNH TRÁNG (RICE-PAPER CRAFT VILLAGE) at (cx + 46, 342)
  const btX = cx + 46.0;
  const btZ = 342.0;
  const btY = Math.max(1.35, ctx.getHeight(btX, btZ) + 0.25);
  crW4Atlas.push(makeReliefBox(10.8, 0.24, 6.8, 'wharfWeatheredPlank', btX, btY, btZ));
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.0, 3.0]) {
      crW4Atlas.push(
        makeReliefCyl(0.14, 0.16, btY + 2.0, 5, 'wharfWeatheredPlank', btX + ox, (btY - 2.0) * 0.5, btZ + oz),
        makeReliefCyl(0.10, 0.12, 3.55, 5, 'wharfWeatheredPlank', btX + ox, btY + 1.65, btZ + oz)
      );
    }
  }
  const btRoof = remapRelief(createGableRoofGeometry(11.8, 7.6, 1.65, 0.16, 'x'), 'corrugatedTinBlue');
  btRoof.translate(btX, btY + 3.35, btZ);
  crW4Atlas.push(
    btRoof,
    makeReliefCyl(0.62, 0.68, 0.88, 6, 'benThanhTerracottaRoof', btX - 3.0, btY + 0.50, btZ - 1.0), // steaming hearth
    makeReliefCyl(0.42, 0.42, 0.14, 6, 'benThanhCreamStucco', btX - 3.0, btY + 1.00, btZ - 1.0), // cotton steamer drum
    makeReliefBox(1.8, 0.72, 0.95, 'wharfWeatheredPlank', btX - 0.6, btY + 0.44, btZ - 1.0), // mortar bench
    makeReliefBox(2.4, 0.78, 1.15, 'wharfWeatheredPlank', btX + 2.4, btY + 0.46, btZ - 1.0), // packing table
    makeReliefBox(5.4, 0.72, 0.14, 'benThanhTerracottaRoof', btX, btY + 3.05, btZ + 3.25), // workshop signboard
    makeReliefCyl(0.28, 0.22, 0.58, 6, 'benThanhTerracottaRoof', btX - 4.4, btY + 0.38, btZ + 2.2), // rainwater lu jar
    makeReliefBox(7.2, 0.20, 1.8, 'wharfWeatheredPlank', btX - 8.8, btY - 0.05, btZ - 0.4), // catwalk linking Lò Hủ Tiếu
    makeReliefBox(3.8, 0.22, 4.4, 'wharfWeatheredPlank', btX, btY - 0.15, btZ + 5.6), // boat jetty
    makeReliefBox(1.25, 0.36, 4.4, 'wharfWeatheredPlank', btX + 3.6, 0.16, btZ + 8.6, 0.35) // moored rice sampan
  );
  for (let dr = 0; dr < 5; dr++) {
    const dx = btX - 4.4 + dr * 2.2;
    const dz = btZ + 4.8;
    crW4Atlas.push(
      makeReliefBox(1.8, 0.08, 1.2, 'benThanhCreamStucco', dx, btY + 0.88, dz, 0, 0.32, 0),
      makeReliefCyl(0.04, 0.05, btY + 2.2, 5, 'wovenBambooBasket', dx, (btY + 0.8 - 1.4) * 0.5, dz)
    );
  }
  for (const bx of [-2.4, 2.4]) {
    crW4Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(btX + bx, btY + 3.10, btZ));
  }
  // [881–900] WESTERN RIVERBANK TRẠI ĐÓNG GHE (MEKONG BOAT-BUILDING YARD) at (cx - 58, 342)
  const bgX = cx - 58.0;
  const bgZ = 342.0;
  const bgY = Math.max(1.3, ctx.getHeight(bgX, bgZ) + 0.25);
  crW4Atlas.push(makeReliefBox(11.2, 0.24, 7.2, 'wharfWeatheredPlank', bgX, bgY, bgZ));
  for (const ox of [-5.0, 0, 5.0]) {
    for (const oz of [-3.2, 3.2]) {
      crW4Atlas.push(
        makeReliefCyl(0.14, 0.16, bgY + 2.0, 5, 'wharfWeatheredPlank', bgX + ox, (bgY - 2.0) * 0.5, bgZ + oz),
        makeReliefCyl(0.10, 0.12, 3.75, 5, 'wharfWeatheredPlank', bgX + ox, bgY + 1.75, bgZ + oz)
      );
    }
  }
  const bgRoof = remapRelief(createGableRoofGeometry(12.2, 8.0, 1.75, 0.16, 'x'), 'corrugatedTinRust');
  bgRoof.translate(bgX, bgY + 3.55, bgZ);
  crW4Atlas.push(
    bgRoof,
    makeReliefBox(2.2, 0.85, 6.2, 'gheBauPlankedHull', bgX - 1.2, bgY + 0.72, bgZ), // half-built Ghe Bầu hull
    makeReliefBox(1.8, 0.76, 0.85, 'wharfWeatheredPlank', bgX + 2.8, bgY + 0.46, bgZ - 1.0), // carpenter workbench
    makeReliefBox(2.2, 0.18, 6.8, 'wharfWeatheredPlank', bgX - 1.2, 0.65, bgZ + 6.4, 0, 0.18, 0), // launching slipway
    makeReliefBox(1.2, 0.36, 4.2, 'gheBauPlankedHull', bgX - 1.2, 0.18, bgZ + 11.2, 0.12), // newly launched sampan
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', bgX + 7.8, bgY - 0.05, bgZ - 0.8), // walkway to Lò Kẹo Dừa
    // Elevated Mekong water-tank tower behind west shophouses (cx - 34, 324)
    makeReliefCyl(0.95, 0.95, 1.8, 6, 'benThanhRollShutter', cx - 34.0, 6.2, 324.0)
  );
  for (const ox of [-0.65, 0.65]) {
    for (const oz of [-0.65, 0.65]) {
      crW4Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 5.4, 5).translate(cx - 34.0 + ox, 2.7, 324.0 + oz));
    }
  }
  crW4Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(bgX, bgY + 3.25, bgZ + 3.4));
  // [901–920] SOUTHERN FAR BANK VƯỜN TRÁI CÂY ORCHARD PIER & NEW FLOATING MARKET BOATS
  const orX = cx + 22.0;
  const orZ = 385.0;
  crW4Atlas.push(
    makeReliefBox(7.2, 0.24, 5.4, 'wharfWeatheredPlank', orX, 1.15, orZ),
    makeReliefBox(2.2, 0.72, 1.1, 'wharfWeatheredPlank', orX, 1.62, orZ), // fruit tasting table
    makeReliefBox(4.8, 0.62, 0.14, 'benThanhTerracottaRoof', orX, 3.65, orZ - 2.6), // orchard signboard
    makeReliefBox(0.32, 0.12, 7.2, 'wovenBambooBasket', cx + 34.0, 1.35, 387.0, 0.25) // south bank cầu khỉ
  );
  for (const ox of [-3.2, 3.2]) {
    for (const oz of [-2.4, 2.4]) {
      crW4Atlas.push(makeReliefCyl(0.10, 0.12, 4.6, 5, 'wharfWeatheredPlank', orX + ox, 1.45, orZ + oz));
    }
  }
  const orRoof = remapRelief(createGableRoofGeometry(8.2, 6.2, 1.45, 0.16, 'x'), 'wovenBambooBasket');
  orRoof.translate(orX, 3.70, orZ);
  crW4Atlas.push(orRoof);
  for (let ot = 0; ot < 4; ot++) {
    const tx = cx + 10.0 + ot * 9.5;
    crW4Bark.push(new THREE.CylinderGeometry(0.14, 0.18, 2.6, 5).translate(tx, 1.3, 392.0));
    crW4Leaf.push(colorizeGeo(new THREE.ConeGeometry(2.0, 2.2, 5).translate(tx, 3.1, 392.0), ot % 2 === 0 ? 0x2f7a2c : 0x3f8f34));
  }
  // Floating Convenience Store Boat, Durian Barge, Gas/Ice Sampan, Breakfast Sampan & River-Bus Sightseeing Boat
  crW4Atlas.push(
    // Tạp Hóa Nổi (cx - 38, 372)
    makeReliefBox(2.6, 0.72, 7.2, 'gheBauPlankedHull', cx - 38.0, 0.34, 372.0, 0.22),
    makeReliefBox(2.4, 0.14, 4.8, 'corrugatedTinBlue', cx - 38.0, 2.05, 372.0, 0.22),
    // Durian & Rambutan Wholesale Barge (cx + 4, 378)
    makeReliefBox(3.4, 1.05, 10.6, 'gheBauPlankedHull', cx + 4.0, 0.42, 378.0, -0.15),
    makeReliefBox(3.0, 0.58, 4.8, 'benThanhSpiceDryGoods', cx + 4.0, 1.18, 379.5, -0.15),
    makeReliefCyl(0.03, 0.04, 4.8, 5, 'wovenBambooBasket', cx + 3.4, 2.9, 382.2),
    // Gas-Bottle & Ice Sampan (cx + 30, 368) & Breakfast Sampan (cx - 14, 356)
    makeReliefBox(1.5, 0.42, 5.2, 'wharfWeatheredPlank', cx + 30.0, 0.20, 368.0, -0.35),
    makeReliefCyl(0.18, 0.18, 0.62, 6, 'corrugatedTinBlue', cx + 30.0, 0.65, 368.0),
    makeReliefBox(1.3, 0.38, 4.6, 'wharfWeatheredPlank', cx - 14.0, 0.18, 356.0, 0.28),
    // Mekong River-Bus Sightseeing Boat (cx + 10, 374)
    makeReliefBox(3.2, 0.92, 9.6, 'gheBauPlankedHull', cx + 10.0, 0.42, 374.0, 0.12),
    makeReliefBox(3.0, 0.16, 7.6, 'corrugatedTinBlue', cx + 10.0, 2.35, 374.0, 0.12),
    // West Cargo Pontoon, Wharf Chute, Loudspeaker Pole & Far-West Buoy
    makeReliefBox(5.2, 0.32, 3.6, 'wharfWeatheredPlank', cx - 18.0, 0.16, 350.0),
    makeReliefBox(1.2, 0.14, 2.8, 'wharfWeatheredPlank', cx - 5.2, dockY + 0.18, 349.8, 0, 0.25, 0),
    makeReliefCyl(0.28, 0.36, 1.1, 6, 'benThanhTerracottaRoof', cx - 56.0, 0.45, 364.0)
  );
  crW4Iron.push(new THREE.CylinderGeometry(0.05, 0.06, 4.6, 5).translate(cx + 8.6, dockY + 2.3, 344.2));
  crW4Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(cx - 56.0, 1.12, 364.0));

  // ==========================================================================
  // WAVE 5 REAL-PHOTO VISUAL QC UPGRADES (1261–1320) — Low-Poly, castShadow=false
  // ==========================================================================
  const crW5Atlas: THREE.BufferGeometry[] = [];
  const crW5Iron: THREE.BufferGeometry[] = [];
  const crW5Bark: THREE.BufferGeometry[] = [];
  const crW5Leaf: THREE.BufferGeometry[] = [];
  const crW5Glow: THREE.BufferGeometry[] = [];

  // [1261–1280] RIVERFRONT WHOLESALE FRUIT WAREHOUSE #1 (cx + 60, 342) & RICE-MILL WAREHOUSE (cx - 72, 342)
  const fwX = cx + 60.0;
  const fwZ = 342.0;
  const fwY = Math.max(1.35, ctx.getHeight(fwX, fwZ) + 0.25);
  crW5Atlas.push(
    makeReliefBox(11.6, 0.24, 7.6, 'wharfWeatheredPlank', fwX, fwY, fwZ),
    makeReliefBox(10.6, 3.6, 6.4, 'corrugatedTinBlue', fwX, fwY + 1.85, fwZ - 0.3),
    makeReliefBox(1.8, 1.05, 1.4, 'wovenBambooBasket', fwX - 3.0, fwY + 0.62, fwZ + 3.0), // pineapple crate stack
    makeReliefBox(1.8, 1.05, 1.4, 'benThanhSpiceDryGoods', fwX + 2.8, fwY + 0.62, fwZ + 3.0),
    makeReliefBox(7.2, 0.20, 1.8, 'wharfWeatheredPlank', fwX - 8.8, fwY - 0.05, fwZ - 0.4), // catwalk to Lò Bánh Tráng
    makeReliefBox(5.6, 0.68, 0.16, 'benThanhTerracottaRoof', fwX, fwY + 3.35, fwZ + 3.2), // warehouse signboard
    makeReliefBox(3.4, 0.95, 9.2, 'gheBauPlankedHull', fwX, 0.42, 351.0, 0.08), // moored fruit barge
    makeReliefCyl(0.30, 0.24, 0.60, 6, 'benThanhTerracottaRoof', fwX + 4.5, fwY + 0.38, 335.0) // clay lu jar
  );
  for (const ox of [-5.2, 0, 5.2]) {
    for (const oz of [-3.4, 3.4]) {
      crW5Atlas.push(makeReliefCyl(0.14, 0.16, fwY + 2.0, 5, 'wharfWeatheredPlank', fwX + ox, (fwY - 2.0) * 0.5, fwZ + oz));
    }
  }
  const fwRoof = remapRelief(createGableRoofGeometry(12.2, 8.2, 1.85, 0.16, 'x'), 'corrugatedTinBlue');
  fwRoof.translate(fwX, fwY + 3.62, fwZ - 0.2);
  crW5Atlas.push(fwRoof);
  crW5Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(fwX, fwY + 3.35, fwZ + 3.5));

  // Western Mekong Brick Rice-Mill Warehouse (cx - 72, 342) + Chute + Jetty + Cargo Barge
  const rmX = cx - 72.0;
  const rmZ = 342.0;
  const rmY = Math.max(1.35, ctx.getHeight(rmX, rmZ) + 0.25);
  crW5Atlas.push(
    makeReliefBox(12.0, 0.24, 7.8, 'wharfWeatheredPlank', rmX, rmY, rmZ),
    makeReliefBox(10.8, 4.0, 6.6, 'benThanhCreamStucco', rmX, rmY + 2.05, rmZ - 0.3),
    makeReliefCyl(0.42, 0.48, 3.2, 6, 'benThanhRollShutter', rmX - 3.5, rmY + 5.6, rmZ - 1.2), // grain hopper chimney
    makeReliefBox(1.4, 0.16, 4.8, 'wharfWeatheredPlank', rmX, rmY - 0.25, rmZ + 5.2, 0, 0.22, 0), // rice-sack chute
    makeReliefBox(4.4, 0.22, 4.8, 'wharfWeatheredPlank', rmX, rmY - 0.18, 349.5), // rice-mill jetty
    makeReliefBox(3.6, 1.02, 9.8, 'gheBauPlankedHull', rmX, 0.44, 354.5, -0.06), // rice cargo barge
    makeReliefBox(7.2, 0.20, 1.8, 'wharfWeatheredPlank', rmX + 8.8, rmY - 0.05, rmZ - 0.4), // catwalk to boatyard
    makeReliefBox(2.8, 2.2, 2.4, 'corrugatedTinRust', cx - 64.0, rmY + 1.1, 335.0) // fuel-drum shed
  );
  for (const ox of [-5.4, 0, 5.4]) {
    for (const oz of [-3.5, 3.5]) {
      crW5Atlas.push(makeReliefCyl(0.14, 0.16, rmY + 2.0, 5, 'wharfWeatheredPlank', rmX + ox, (rmY - 2.0) * 0.5, rmZ + oz));
    }
  }
  const rmRoof = remapRelief(createGableRoofGeometry(12.4, 8.4, 1.95, 0.16, 'x'), 'corrugatedTinRust');
  rmRoof.translate(rmX, rmY + 4.02, rmZ - 0.2);
  crW5Atlas.push(rmRoof);
  crW5Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(rmX, rmY + 3.55, rmZ + 3.5),
    new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(cx + 68.0, 3.6, 348.0) // East headland solar beacon
  );
  crW5Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 5).translate(cx + 68.0, 1.7, 348.0));

  // [1281–1300] MEKONG ORCHARD BRIDGES, GRADING SHED, HAMMOCK HUT & COCONUT GROVES (South Bank z = 385..394)
  // SE Arched Orchard Footbridge (cx + 46, 386) + SW Bamboo Monkey Bridge (cx - 30, 386)
  crW5Atlas.push(
    makeReliefBox(8.4, 0.24, 1.8, 'benThanhCreamStucco', cx + 46.0, 1.95, 386.0),
    makeReliefBox(0.32, 0.12, 7.6, 'wovenBambooBasket', cx - 30.0, 1.35, 386.0, -0.22),
    // South Bank Durian & Rambutan Grading Shed (cx - 18, 386)
    makeReliefBox(7.6, 0.24, 5.4, 'wharfWeatheredPlank', cx - 18.0, 1.15, 386.0),
    makeReliefBox(2.4, 0.74, 1.1, 'wharfWeatheredPlank', cx - 18.0, 1.62, 386.0),
    makeReliefBox(1.3, 0.36, 4.4, 'gheBauPlankedHull', cx - 18.0, 0.18, 378.5, 0.18), // orchard harvest sampan
    // Orchard Hammock Rest Hut (cx + 38, 392)
    makeReliefBox(4.2, 0.20, 3.8, 'wharfWeatheredPlank', cx + 38.0, 1.05, 392.0),
    makeReliefBox(2.4, 0.45, 0.55, 'wharfWeatheredPlank', cx + 10.0, 1.35, 384.5), // viewing bench
    makeReliefBox(1.6, 0.85, 0.18, 'benThanhTerracottaRoof', cx - 40.0, 1.65, 385.0) // KM 06 marker board
  );
  for (const ox of [-3.4, 3.4]) {
    for (const oz of [-2.4, 2.4]) {
      crW5Atlas.push(makeReliefCyl(0.10, 0.12, 4.4, 5, 'wharfWeatheredPlank', cx - 18.0 + ox, 1.45, 386.0 + oz));
    }
  }
  const gsRoof = remapRelief(createGableRoofGeometry(8.4, 6.2, 1.45, 0.16, 'x'), 'wovenBambooBasket');
  gsRoof.translate(cx - 18.0, 3.60, 386.0);
  crW5Atlas.push(gsRoof);
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.6, 1.6]) {
      crW5Atlas.push(makeReliefCyl(0.08, 0.10, 3.4, 5, 'wharfWeatheredPlank', cx + 38.0 + ox, 2.15, 392.0 + oz));
    }
  }
  const hhRoof = remapRelief(new THREE.ConeGeometry(3.2, 1.45, 6), 'wovenBambooBasket');
  hhRoof.translate(cx + 38.0, 4.45, 392.0);
  crW5Atlas.push(hhRoof);
  for (let ot = 0; ot < 6; ot++) {
    const tx = cx - 36.0 + ot * 18.0;
    crW5Bark.push(new THREE.CylinderGeometry(0.13, 0.18, 3.4, 5).translate(tx, 1.7, 394.0));
    crW5Leaf.push(colorizeGeo(new THREE.ConeGeometry(2.1, 2.2, 5).translate(tx, 3.8, 394.0), ot % 2 === 0 ? 0x2d7a2b : 0x3e8f34));
  }

  // [1301–1320] FLOATING ICED-COFFEE & HỦ TIẾU SAMPANS, PINEAPPLE GHE BẦU, MOORING FINGER-PIERS & RIVER-CONTROL PONTOON
  crW5Atlas.push(
    // Floating Iced-Coffee Sampan (cx - 26, 360)
    makeReliefBox(1.4, 0.40, 4.8, 'gheBauPlankedHull', cx - 26.0, 0.18, 360.0, 0.25),
    makeReliefCyl(0.08, 1.05, 0.34, 6, 'corrugatedTinRust', cx - 26.0, 1.95, 360.0),
    // Floating Hủ Tiếu Noodle-Soup Boat (cx + 18, 360)
    makeReliefBox(1.6, 0.44, 5.4, 'gheBauPlankedHull', cx + 18.0, 0.20, 360.0, -0.22),
    makeReliefBox(1.2, 0.72, 1.2, 'benThanhCreamStucco', cx + 18.0, 0.72, 360.0, -0.22),
    // Floating Pineapple Wholesale Ghe Bầu (cx - 48, 366) & Watermelon Ghe Bầu #2 (cx + 42, 364)
    makeReliefBox(3.2, 1.02, 10.2, 'gheBauPlankedHull', cx - 48.0, 0.42, 366.0, 0.16),
    makeReliefBox(2.6, 0.55, 4.4, 'benThanhSpiceDryGoods', cx - 48.0, 1.15, 367.0, 0.16),
    makeReliefCyl(0.03, 0.04, 4.8, 5, 'wovenBambooBasket', cx - 47.4, 2.85, 370.2),
    makeReliefBox(3.0, 0.96, 9.6, 'gheBauPlankedHull', cx + 42.0, 0.40, 364.0, -0.18),
    makeReliefBox(2.8, 0.14, 5.2, 'corrugatedTinBlue', cx + 42.0, 2.15, 364.0, -0.18),
    // Floating Flower-Seller Sampan (cx - 4, 368)
    makeReliefBox(1.4, 0.40, 4.8, 'wharfWeatheredPlank', cx - 4.0, 0.18, 368.0, 0.12),
    // Wooden Sampan Mooring Finger-Piers #1 (cx + 38, 349.5) & #2 (cx - 32, 349.5) + Moored Sampans
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx + 38.0, 0.95, 349.5),
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx - 32.0, 0.95, 349.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx + 36.2, 0.16, 352.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx + 39.8, 0.16, 352.5),
    // Floating River-Safety & Market-Control Pontoon (cx + 50, 372) + Fish Cage (cx + 54, 358)
    makeReliefBox(4.8, 0.32, 6.2, 'wharfWeatheredPlank', cx + 50.0, 0.18, 372.0),
    makeReliefBox(3.4, 2.2, 4.2, 'corrugatedTinBlue', cx + 50.0, 1.42, 372.0),
    makeReliefBox(4.2, 0.28, 3.6, 'wovenBambooBasket', cx + 54.0, 0.14, 358.0),
    // Floating River-Taxi Boarding Raft (cx + 12, 351) & Channel Spar Buoy (cx + 62, 368)
    makeReliefBox(4.8, 0.26, 3.2, 'wharfWeatheredPlank', cx + 12.0, 0.16, 351.0),
    makeReliefCyl(0.24, 0.32, 1.15, 6, 'benThanhTerracottaRoof', cx + 62.0, 0.48, 368.0)
  );
  crW5Leaf.push(
    colorizeGeo(new THREE.ConeGeometry(0.65, 0.55, 5).translate(cx - 4.0, 0.65, 368.0), 0xf0b820), // marigold blossoms
    colorizeGeo(new THREE.ConeGeometry(0.85, 0.35, 5).translate(cx + 34.0, 0.18, 378.0), 0x3b8a36) // emerald hyacinth
  );
  for (const fx of [cx + 38.0, cx - 32.0]) {
    crW5Atlas.push(makeReliefCyl(0.12, 0.14, 3.2, 5, 'wharfWeatheredPlank', fx, 0.2, 352.4));
    crW5Glow.push(new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(fx, 2.0, 352.4));
  }
  crW5Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 18.0, 2.05, 358.2), // Hủ tiếu bow lantern
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 62.0, 1.15, 368.0) // East buoy beacon
  );

  // ==========================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADES (1661–1720) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const crW6Atlas: THREE.BufferGeometry[] = [];
  const crW6Iron: THREE.BufferGeometry[] = [];
  const crW6Bark: THREE.BufferGeometry[] = [];
  const crW6Leaf: THREE.BufferGeometry[] = [];
  const crW6Glow: THREE.BufferGeometry[] = [];

  // [1661–1680] Far-East Fruit-Export Packing Shed (cx + 74, 342) & Far-West Boat-Caulking Slipway (cx - 86, 342)
  const feX = cx + 74.0;
  const feZ = 342.0;
  const feY = Math.max(1.35, ctx.getHeight(feX, feZ) + 0.25);
  crW6Atlas.push(
    makeReliefBox(10.8, 0.24, 7.2, 'wharfWeatheredPlank', feX, feY, feZ),
    makeReliefBox(9.8, 3.4, 6.0, 'corrugatedTinBlue', feX, feY + 1.75, feZ - 0.3),
    makeReliefBox(2.2, 0.85, 1.2, 'wovenBambooBasket', feX - 2.6, feY + 0.52, feZ + 2.8),
    makeReliefBox(5.2, 0.65, 0.16, 'benThanhTerracottaRoof', feX, feY + 3.15, feZ + 3.0),
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', feX - 8.2, feY - 0.05, feZ - 0.4), // catwalk to Fruit Warehouse #1
    makeReliefBox(3.4, 0.95, 9.2, 'gheBauPlankedHull', feX, 0.42, 351.5, 0.06), // moored export barge #2
    makeReliefBox(2.4, 1.4, 1.8, 'corrugatedTinRust', cx + 66.0, feY + 0.72, 336.0) // ice-block shed
  );
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.2, 3.2]) {
      crW6Atlas.push(makeReliefCyl(0.14, 0.16, feY + 2.0, 4, 'wharfWeatheredPlank', feX + ox, (feY - 2.0) * 0.5, feZ + oz));
    }
  }
  const feRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.75, 0.16, 'x'), 'corrugatedTinBlue');
  feRoof.translate(feX, feY + 3.42, feZ - 0.2);
  crW6Atlas.push(feRoof);
  crW6Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(feX, feY + 3.15, feZ + 3.3));

  // Far-West Boat-Caulking & Rudder-Craft Shed (cx - 86, 342) + Caulking Hull + Headland Beacon
  const bcX = cx - 86.0;
  const bcZ = 342.0;
  const bcY = Math.max(1.35, ctx.getHeight(bcX, bcZ) + 0.25);
  crW6Atlas.push(
    makeReliefBox(10.8, 0.24, 7.2, 'wharfWeatheredPlank', bcX, bcY, bcZ),
    makeReliefBox(9.8, 3.4, 6.0, 'benThanhCreamStucco', bcX, bcY + 1.75, bcZ - 0.3),
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', bcX + 8.2, bcY - 0.05, bcZ - 0.4), // catwalk to Rice Mill
    makeReliefBox(2.2, 0.82, 6.4, 'gheBauPlankedHull', bcX, 0.36, 352.0, -0.10), // caulking repair hull
    makeReliefCyl(0.45, 0.52, 0.68, 5, 'benThanhTerracottaRoof', bcX + 2.8, bcY + 0.42, bcZ + 2.2), // pitch-boiling hearth
    makeReliefBox(0.22, 2.6, 0.22, 'benThanhTerracottaRoof', cx + 10.5, 1.2, 349.5) // river-level flood gauge
  );
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.2, 3.2]) {
      crW6Atlas.push(makeReliefCyl(0.14, 0.16, bcY + 2.0, 4, 'wharfWeatheredPlank', bcX + ox, (bcY - 2.0) * 0.5, bcZ + oz));
    }
  }
  const bcRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.75, 0.16, 'x'), 'corrugatedTinRust');
  bcRoof.translate(bcX, bcY + 3.42, bcZ - 0.2);
  crW6Atlas.push(bcRoof);
  crW6Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 4).translate(cx - 92.0, 1.7, 348.0));
  crW6Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(bcX, bcY + 3.15, bcZ + 3.3),
    new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(cx - 92.0, 3.6, 348.0)
  );

  // [1681–1700] South Bank Quán Cà Phê Sông Nước (cx + 2, 386), Elevated Orchard Lookout (cx + 56, 388), Far-West Footbridge & Palms
  crW6Atlas.push(
    makeReliefBox(7.2, 0.24, 5.2, 'wharfWeatheredPlank', cx + 2.0, 1.15, 386.0),
    makeReliefBox(1.6, 0.65, 1.0, 'wharfWeatheredPlank', cx + 2.0, 1.58, 386.0), // café table
    makeReliefBox(1.25, 0.36, 4.4, 'gheBauPlankedHull', cx + 2.0, 0.18, 378.5, -0.14), // customer sampan
    // Elevated Orchard Lookout Platform (cx + 56, 388)
    makeReliefBox(4.2, 0.22, 4.2, 'wharfWeatheredPlank', cx + 56.0, 3.15, 388.0),
    // Far-West Bamboo Footbridge (cx - 46, 386), South benches & KM 07 board
    makeReliefBox(0.34, 0.12, 7.4, 'wovenBambooBasket', cx - 46.0, 1.35, 386.0, 0.18),
    makeReliefBox(2.2, 0.45, 0.55, 'wharfWeatheredPlank', cx - 8.0, 1.35, 384.0),
    makeReliefBox(2.2, 0.45, 0.55, 'wharfWeatheredPlank', cx + 14.0, 1.35, 384.0),
    makeReliefBox(1.6, 0.85, 0.18, 'benThanhTerracottaRoof', cx + 62.0, 1.65, 385.0),
    makeReliefBox(1.25, 0.36, 4.4, 'gheBauPlankedHull', cx + 46.0, 0.18, 378.5, 0.16) // SE pomelo sampan
  );
  for (const ox of [-3.2, 3.2]) {
    for (const oz of [-2.2, 2.2]) {
      crW6Atlas.push(makeReliefCyl(0.10, 0.12, 4.4, 4, 'wharfWeatheredPlank', cx + 2.0 + ox, 1.45, 386.0 + oz));
    }
  }
  const cfRoof = remapRelief(createGableRoofGeometry(8.0, 6.0, 1.45, 0.16, 'x'), 'wovenBambooBasket');
  cfRoof.translate(cx + 2.0, 3.60, 386.0);
  crW6Atlas.push(cfRoof);
  crW6Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 2.0, 3.35, 383.5));
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.8, 1.8]) {
      crW6Atlas.push(makeReliefCyl(0.10, 0.12, 5.8, 4, 'wharfWeatheredPlank', cx + 56.0 + ox, 2.75, 388.0 + oz));
    }
  }
  const loRoof = remapRelief(new THREE.ConeGeometry(3.3, 1.45, 5), 'wovenBambooBasket');
  loRoof.translate(cx + 56.0, 6.32, 388.0);
  crW6Atlas.push(loRoof);
  for (const tx of [cx - 48.0, cx - 22.0, cx + 26.0, cx + 52.0]) {
    crW6Bark.push(new THREE.CylinderGeometry(0.13, 0.18, 3.6, 4).translate(tx, 1.8, 396.5));
    crW6Leaf.push(colorizeGeo(new THREE.ConeGeometry(2.1, 2.2, 5).translate(tx, 4.0, 396.5), 0x32822f));
  }

  // [1701–1720] Floating Bún Riêu Sampan, Dragon-Fruit Ghe Bầu, Floating Petrol/Ice Barge, Outer Finger-Piers #3/#4 & Spar Buoys
  crW6Atlas.push(
    // Floating Bún Riêu Noodle Sampan (cx - 10, 360)
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', cx - 10.0, 0.20, 360.0, 0.18),
    makeReliefCyl(0.08, 1.05, 0.34, 5, 'corrugatedTinBlue', cx - 10.0, 1.95, 360.0),
    // Floating Dragon-Fruit & Mango Ghe Bầu (cx + 28, 366) + Cây Bẹo
    makeReliefBox(3.2, 1.02, 10.0, 'gheBauPlankedHull', cx + 28.0, 0.42, 366.0, -0.16),
    makeReliefBox(2.6, 0.52, 4.2, 'benThanhTerracottaRoof', cx + 28.0, 1.15, 367.0, -0.16),
    makeReliefCyl(0.03, 0.04, 4.8, 4, 'wovenBambooBasket', cx + 27.4, 2.85, 370.0),
    // Floating River Petrol & Ice Supply Barge (cx - 60, 366)
    makeReliefBox(4.4, 0.55, 8.6, 'wharfWeatheredPlank', cx - 60.0, 0.26, 366.0),
    makeReliefBox(3.2, 2.1, 4.4, 'corrugatedTinBlue', cx - 60.0, 1.55, 366.0),
    // Floating Coconut-Water Skiff (cx + 6, 358) & Sweet-Potato Ghe Bầu (cx - 32, 368)
    makeReliefBox(1.3, 0.38, 4.6, 'wharfWeatheredPlank', cx + 6.0, 0.18, 358.0, -0.22),
    makeReliefBox(3.0, 0.94, 9.4, 'gheBauPlankedHull', cx - 32.0, 0.40, 368.0, 0.14),
    makeReliefBox(2.8, 0.14, 5.0, 'corrugatedTinRust', cx - 32.0, 2.12, 368.0, 0.14),
    // Outer East & West Finger-Piers #3 (cx + 54, 349.5) & #4 (cx - 46, 349.5) + Moored Sampans + West Fish-Cage #2
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx + 54.0, 0.95, 349.5),
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx - 46.0, 0.95, 349.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx - 47.8, 0.16, 352.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx - 44.2, 0.16, 352.5),
    makeReliefBox(4.2, 0.28, 3.6, 'wovenBambooBasket', cx - 54.0, 0.14, 358.0),
    // Outer West & East Spar Buoys
    makeReliefCyl(0.24, 0.32, 1.15, 5, 'benThanhTerracottaRoof', cx - 68.0, 0.48, 368.0),
    makeReliefCyl(0.24, 0.32, 1.15, 5, 'benThanhGreenShutter', cx + 72.0, 0.48, 368.0)
  );
  crW6Leaf.push(
    colorizeGeo(new THREE.ConeGeometry(0.82, 0.35, 5).translate(cx - 28.0, 0.18, 378.0), 0x3b8a36),
    colorizeGeo(new THREE.ConeGeometry(0.82, 0.35, 5).translate(cx + 68.0, 0.18, 374.0), 0x3b8a36)
  );
  for (const fx of [cx + 54.0, cx - 46.0]) {
    crW6Atlas.push(makeReliefCyl(0.12, 0.14, 3.2, 4, 'wharfWeatheredPlank', fx, 0.2, 352.4));
    crW6Glow.push(new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(fx, 2.0, 352.4));
  }
  crW6Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx - 10.0, 2.05, 358.2),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx - 68.0, 1.15, 368.0),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 72.0, 1.15, 368.0)
  );

  // ==========================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADES (2061–2120) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const crW7Atlas: THREE.BufferGeometry[] = [];
  const crW7Iron: THREE.BufferGeometry[] = [];
  const crW7Bark: THREE.BufferGeometry[] = [];
  const crW7Leaf: THREE.BufferGeometry[] = [];
  const crW7Glow: THREE.BufferGeometry[] = [];

  // [2061–2080] Far-East Lò Hủ Tiếu Noodle Workshop (cx + 88, 342) & Far-West Basket-Weaving Shed (cx - 100, 342)
  const htCrX = cx + 88.0;
  const htCrZ = 342.0;
  const htCrY = Math.max(1.35, ctx.getHeight(htCrX, htCrZ) + 0.25);
  crW7Atlas.push(
    makeReliefBox(10.8, 0.24, 7.2, 'wharfWeatheredPlank', htCrX, htCrY, htCrZ),
    makeReliefBox(9.8, 3.4, 6.0, 'benThanhCreamStucco', htCrX, htCrY + 1.75, htCrZ - 0.3),
    makeReliefCyl(0.45, 0.52, 0.72, 5, 'benThanhTerracottaRoof', htCrX - 2.0, htCrY + 0.45, htCrZ - 1.0), // batter steaming hearth
    makeReliefCyl(0.18, 0.22, 3.4, 5, 'benThanhRollShutter', htCrX - 2.0, htCrY + 4.8, htCrZ - 1.0), // chimney
    makeReliefBox(2.2, 0.78, 1.1, 'wharfWeatheredPlank', htCrX + 2.0, htCrY + 0.48, htCrZ + 2.2), // noodle-cutting bench
    makeReliefBox(5.2, 0.65, 0.16, 'benThanhTerracottaRoof', htCrX, htCrY + 3.15, htCrZ + 3.0),
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', htCrX - 8.2, htCrY - 0.05, htCrZ - 0.4), // catwalk to Far-East Packing Shed
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', htCrX, 0.20, 351.5, 0.10) // moored visitor sampan
  );
  for (const drX of [htCrX - 2.0, htCrX + 2.0, htCrX + 6.0]) {
    crW7Atlas.push(makeReliefBox(2.2, 0.12, 1.4, 'wovenBambooBasket', drX, htCrY + 0.75, 335.5, 0, 0.22, 0)); // sun-drying noodle mats
  }
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.2, 3.2]) {
      crW7Atlas.push(makeReliefCyl(0.14, 0.16, htCrY + 2.0, 4, 'wharfWeatheredPlank', htCrX + ox, (htCrY - 2.0) * 0.5, htCrZ + oz));
    }
  }
  const htCrRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.75, 0.16, 'x'), 'corrugatedTinRust');
  htCrRoof.translate(htCrX, htCrY + 3.42, htCrZ - 0.2);
  crW7Atlas.push(htCrRoof);
  crW7Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 4).translate(cx + 96.0, 1.7, 348.0));
  crW7Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(htCrX, htCrY + 3.15, htCrZ + 3.3),
    new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(cx + 96.0, 3.6, 348.0)
  );

  // Far-West Bamboo-Basket Weaving Shed (cx - 100, 342) + Catwalk + Moored Delivery Sampan
  const bwX = cx - 100.0;
  const bwZ = 342.0;
  const bwY = Math.max(1.35, ctx.getHeight(bwX, bwZ) + 0.25);
  crW7Atlas.push(
    makeReliefBox(10.8, 0.24, 7.2, 'wharfWeatheredPlank', bwX, bwY, bwZ),
    makeReliefBox(9.8, 3.4, 6.0, 'wovenBambooBasket', bwX, bwY + 1.75, bwZ - 0.3),
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', bwX + 8.2, bwY - 0.05, bwZ - 0.4), // catwalk to Boat-Caulking Shed
    makeReliefBox(2.2, 0.95, 1.4, 'wovenBambooBasket', bwX, bwY + 0.58, bwZ + 2.2), // stacked Cần Xé baskets
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', bwX, 0.20, 351.5, -0.10)
  );
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.2, 3.2]) {
      crW7Atlas.push(makeReliefCyl(0.14, 0.16, bwY + 2.0, 4, 'wharfWeatheredPlank', bwX + ox, (bwY - 2.0) * 0.5, bwZ + oz));
    }
  }
  const bwRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.75, 0.16, 'x'), 'wovenBambooBasket');
  bwRoof.translate(bwX, bwY + 3.42, bwZ - 0.2);
  crW7Atlas.push(bwRoof);
  crW7Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 4).translate(cx - 106.0, 1.7, 348.0));
  crW7Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(bwX, bwY + 3.15, bwZ + 3.3),
    new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(cx - 106.0, 3.6, 348.0)
  );

  // [2081–2100] South Bank Far-East Tasting Pavilion (cx + 70, 388), Far-West Boat Shelter (cx - 64, 387), Boardwalk & Orchard Trees
  crW7Atlas.push(
    makeReliefBox(4.8, 0.22, 4.8, 'wharfWeatheredPlank', cx + 70.0, 1.15, 388.0),
    makeReliefBox(1.6, 0.65, 1.0, 'wharfWeatheredPlank', cx + 70.0, 1.58, 388.0),
    makeReliefBox(7.2, 0.24, 5.0, 'wharfWeatheredPlank', cx - 64.0, 1.15, 387.0),
    makeReliefBox(2.4, 0.45, 0.55, 'wharfWeatheredPlank', cx - 64.0, 1.48, 387.0),
    makeReliefBox(1.3, 0.36, 4.4, 'gheBauPlankedHull', cx - 64.0, 0.18, 378.0, 0.14),
    makeReliefBox(1.3, 0.36, 4.4, 'gheBauPlankedHull', cx + 70.0, 0.18, 378.5, -0.14),
    makeReliefBox(14.0, 0.20, 1.6, 'wharfWeatheredPlank', cx - 30.0, 1.12, 384.5), // central canal boardwalk
    makeReliefBox(0.34, 0.12, 7.2, 'wovenBambooBasket', cx + 78.0, 1.35, 387.5, -0.18), // Cầu Khỉ #3
    makeReliefBox(1.6, 0.85, 0.18, 'benThanhTerracottaRoof', cx + 78.0, 1.65, 385.0) // KM 08 board
  );
  for (const ox of [-2.0, 2.0]) {
    for (const oz of [-2.0, 2.0]) {
      crW7Atlas.push(makeReliefCyl(0.10, 0.12, 4.4, 4, 'wharfWeatheredPlank', cx + 70.0 + ox, 1.45, 388.0 + oz));
    }
  }
  const tpCrRoof = remapRelief(new THREE.ConeGeometry(3.6, 1.50, 5), 'wovenBambooBasket');
  tpCrRoof.translate(cx + 70.0, 4.35, 388.0);
  crW7Atlas.push(tpCrRoof);
  for (const ox of [-3.2, 3.2]) {
    for (const oz of [-2.1, 2.1]) {
      crW7Atlas.push(makeReliefCyl(0.10, 0.12, 4.4, 4, 'wharfWeatheredPlank', cx - 64.0 + ox, 1.45, 387.0 + oz));
    }
  }
  const wsCrRoof = remapRelief(createGableRoofGeometry(8.0, 5.8, 1.45, 0.16, 'x'), 'wovenBambooBasket');
  wsCrRoof.translate(cx - 64.0, 3.60, 387.0);
  crW7Atlas.push(wsCrRoof);
  for (const tx of [cx - 64.0, cx - 38.0, cx + 42.0, cx + 68.0]) {
    crW7Bark.push(new THREE.CylinderGeometry(0.13, 0.18, 3.6, 4).translate(tx, 1.8, 397.5));
    crW7Leaf.push(colorizeGeo(new THREE.ConeGeometry(2.1, 2.2, 5).translate(tx, 4.0, 397.5), 0x32822f));
  }

  // [2101–2120] Floating Pizza Hủ Tiếu Sampan, Pomelo Ghe Bầu, Flower Barge, Finger-Piers #5/#6 & Far-Channel Spar Buoys
  crW7Atlas.push(
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', cx + 14.0, 0.20, 368.0, -0.18),
    makeReliefCyl(0.08, 1.05, 0.34, 5, 'corrugatedTinRust', cx + 14.0, 1.95, 368.0),
    makeReliefBox(3.2, 1.02, 10.0, 'gheBauPlankedHull', cx - 18.0, 0.42, 370.0, 0.16),
    makeReliefBox(2.6, 0.52, 4.2, 'benThanhSpiceDryGoods', cx - 18.0, 1.15, 371.0, 0.16),
    makeReliefCyl(0.03, 0.04, 4.8, 4, 'wovenBambooBasket', cx - 17.4, 2.85, 374.0),
    makeReliefBox(2.8, 0.85, 8.6, 'gheBauPlankedHull', cx + 36.0, 0.38, 374.0, -0.12), // Flower Barge
    makeReliefBox(1.3, 0.38, 4.6, 'wharfWeatheredPlank', cx - 2.0, 0.18, 358.0, 0.22), // Iced-coffee skiff
    makeReliefBox(3.0, 0.94, 9.4, 'gheBauPlankedHull', cx - 54.0, 0.40, 374.0, 0.14), // Yam & Banana Ghe Bầu
    makeReliefBox(2.8, 0.14, 5.0, 'corrugatedTinBlue', cx - 54.0, 2.12, 374.0, 0.14),
    // Outer Finger-Piers #5 (cx + 68, 349.5) & #6 (cx - 62, 349.5) + Moored Sampans + Rescue Pontoon #2 + Fish Cage #3
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx + 68.0, 0.95, 349.5),
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx - 62.0, 0.95, 349.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx + 66.2, 0.16, 352.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx + 69.8, 0.16, 352.5),
    makeReliefBox(4.4, 0.32, 6.0, 'wharfWeatheredPlank', cx - 42.0, 0.18, 376.0),
    makeReliefBox(3.2, 2.0, 4.0, 'corrugatedTinBlue', cx - 42.0, 1.38, 376.0),
    makeReliefBox(4.2, 0.28, 3.6, 'wovenBambooBasket', cx + 78.0, 0.14, 358.0),
    makeReliefCyl(0.24, 0.32, 1.15, 5, 'benThanhTerracottaRoof', cx - 82.0, 0.48, 368.0),
    makeReliefCyl(0.24, 0.32, 1.15, 5, 'benThanhGreenShutter', cx + 86.0, 0.48, 368.0)
  );
  crW7Leaf.push(
    colorizeGeo(new THREE.ConeGeometry(0.75, 0.65, 5).translate(cx + 36.0, 1.10, 374.0), 0xf0b820),
    colorizeGeo(new THREE.ConeGeometry(0.82, 0.35, 5).translate(cx - 56.0, 0.18, 380.0), 0x3b8a36),
    colorizeGeo(new THREE.ConeGeometry(0.82, 0.35, 5).translate(cx + 80.0, 0.18, 374.0), 0x3b8a36)
  );
  for (const fx of [cx + 68.0, cx - 62.0]) {
    crW7Atlas.push(makeReliefCyl(0.12, 0.14, 3.2, 4, 'wharfWeatheredPlank', fx, 0.2, 352.4));
    crW7Glow.push(new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(fx, 2.0, 352.4));
  }
  crW7Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 14.0, 2.05, 366.2),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx - 82.0, 1.15, 368.0),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 86.0, 1.15, 368.0)
  );

  // ==========================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADES (2461–2520) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const crW8Atlas: THREE.BufferGeometry[] = [];
  const crW8Iron: THREE.BufferGeometry[] = [];
  const crW8Bark: THREE.BufferGeometry[] = [];
  const crW8Leaf: THREE.BufferGeometry[] = [];
  const crW8Glow: THREE.BufferGeometry[] = [];

  // [2461–2480] Far-East Lò Bánh Tráng Rice-Paper Workshop (cx + 102, 342) & Far-West Sampan-Building Shed (cx - 114, 342)
  const btCrX = cx + 102.0;
  const btCrZ = 342.0;
  const btCrY = Math.max(1.35, ctx.getHeight(btCrX, btCrZ) + 0.25);
  crW8Atlas.push(
    makeReliefBox(10.8, 0.24, 7.2, 'wharfWeatheredPlank', btCrX, btCrY, btCrZ),
    makeReliefBox(9.8, 3.4, 6.0, 'benThanhCreamStucco', btCrX, btCrY + 1.75, btCrZ - 0.3),
    makeReliefCyl(0.45, 0.52, 0.72, 5, 'benThanhTerracottaRoof', btCrX - 2.0, btCrY + 0.45, btCrZ - 1.0), // steaming hearth
    makeReliefCyl(0.18, 0.22, 3.4, 5, 'benThanhRollShutter', btCrX - 2.0, btCrY + 4.8, btCrZ - 1.0), // smoke chimney
    makeReliefBox(2.2, 0.78, 1.1, 'wharfWeatheredPlank', btCrX + 2.0, btCrY + 0.48, btCrZ + 2.2), // bundling bench
    makeReliefBox(5.2, 0.65, 0.16, 'benThanhTerracottaRoof', btCrX, btCrY + 3.15, btCrZ + 3.0),
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', btCrX - 8.2, btCrY - 0.05, btCrZ - 0.4), // catwalk to Lò Hủ Tiếu
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', btCrX, 0.20, 351.5, 0.10) // moored visitor sampan
  );
  for (const drX8 of [btCrX - 2.0, btCrX + 2.0, btCrX + 6.0]) {
    crW8Atlas.push(makeReliefBox(2.2, 0.12, 1.4, 'wovenBambooBasket', drX8, btCrY + 0.75, 335.5, 0, 0.22, 0)); // sun-drying rice-paper racks
  }
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.2, 3.2]) {
      crW8Atlas.push(makeReliefCyl(0.14, 0.16, btCrY + 2.0, 4, 'wharfWeatheredPlank', btCrX + ox, (btCrY - 2.0) * 0.5, btCrZ + oz));
    }
  }
  const btCrRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.75, 0.16, 'x'), 'corrugatedTinRust');
  btCrRoof.translate(btCrX, btCrY + 3.42, btCrZ - 0.2);
  crW8Atlas.push(btCrRoof);
  crW8Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 4).translate(cx + 110.0, 1.7, 348.0));
  crW8Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(btCrX, btCrY + 3.15, btCrZ + 3.3),
    new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(cx + 110.0, 3.6, 348.0)
  );

  // Far-West Xưởng Đóng Xuồng Ba Lá Sampan-Building Shed (cx - 114, 342) + Catwalk + Launched Sampan
  const sbX = cx - 114.0;
  const sbZ = 342.0;
  const sbY = Math.max(1.35, ctx.getHeight(sbX, sbZ) + 0.25);
  crW8Atlas.push(
    makeReliefBox(10.8, 0.24, 7.2, 'wharfWeatheredPlank', sbX, sbY, sbZ),
    makeReliefBox(9.8, 3.4, 6.0, 'wharfWeatheredPlank', sbX, sbY + 1.75, sbZ - 0.3),
    makeReliefBox(6.8, 0.20, 1.8, 'wharfWeatheredPlank', sbX + 8.2, sbY - 0.05, sbZ - 0.4), // catwalk to Basket-Weaving Shed
    makeReliefBox(4.2, 0.65, 1.3, 'gheBauPlankedHull', sbX, sbY + 0.52, sbZ + 2.2), // hull-frame on trestles
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', sbX, 0.20, 351.5, -0.10)
  );
  for (const ox of [-4.8, 0, 4.8]) {
    for (const oz of [-3.2, 3.2]) {
      crW8Atlas.push(makeReliefCyl(0.14, 0.16, sbY + 2.0, 4, 'wharfWeatheredPlank', sbX + ox, (sbY - 2.0) * 0.5, sbZ + oz));
    }
  }
  const sbRoof = remapRelief(createGableRoofGeometry(11.4, 7.6, 1.75, 0.16, 'x'), 'wovenBambooBasket');
  sbRoof.translate(sbX, sbY + 3.42, sbZ - 0.2);
  crW8Atlas.push(sbRoof);
  crW8Iron.push(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 4).translate(cx - 120.0, 1.7, 348.0));
  crW8Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(sbX, sbY + 3.15, sbZ + 3.3),
    new THREE.BoxGeometry(0.20, 0.22, 0.20).translate(cx - 120.0, 3.6, 348.0)
  );

  // [2481–2500] South Bank Far-East Cacao Pavilion (cx + 84, 388), Far-West Đờn Ca Tài Tử Pavilion (cx - 78, 387), Boardwalk & Orchard Trees
  crW8Atlas.push(
    makeReliefBox(4.8, 0.22, 4.8, 'wharfWeatheredPlank', cx + 84.0, 1.15, 388.0),
    makeReliefBox(1.6, 0.65, 1.0, 'wharfWeatheredPlank', cx + 84.0, 1.58, 388.0),
    makeReliefBox(7.2, 0.24, 5.0, 'wharfWeatheredPlank', cx - 78.0, 1.15, 387.0),
    makeReliefBox(2.4, 0.45, 0.55, 'wharfWeatheredPlank', cx - 78.0, 1.48, 387.0),
    makeReliefBox(1.3, 0.36, 4.4, 'gheBauPlankedHull', cx - 78.0, 0.18, 378.0, 0.14),
    makeReliefBox(1.3, 0.36, 4.4, 'gheBauPlankedHull', cx + 84.0, 0.18, 378.5, -0.14),
    makeReliefBox(10.0, 0.20, 1.6, 'wharfWeatheredPlank', cx + 77.0, 1.12, 384.5), // eastern canal boardwalk
    makeReliefBox(0.34, 0.12, 7.2, 'wovenBambooBasket', cx - 86.0, 1.35, 387.5, 0.18), // Cầu Khỉ #4
    makeReliefBox(1.6, 0.85, 0.18, 'benThanhTerracottaRoof', cx - 86.0, 1.65, 385.0) // KM 09 board
  );
  for (const ox of [-2.0, 2.0]) {
    for (const oz of [-2.0, 2.0]) {
      crW8Atlas.push(makeReliefCyl(0.10, 0.12, 4.4, 4, 'wharfWeatheredPlank', cx + 84.0 + ox, 1.45, 388.0 + oz));
    }
  }
  const ccCrRoof = remapRelief(new THREE.ConeGeometry(3.6, 1.50, 5), 'wovenBambooBasket');
  ccCrRoof.translate(cx + 84.0, 4.35, 388.0);
  crW8Atlas.push(ccCrRoof);
  for (const ox of [-3.2, 3.2]) {
    for (const oz of [-2.1, 2.1]) {
      crW8Atlas.push(makeReliefCyl(0.10, 0.12, 4.4, 4, 'wharfWeatheredPlank', cx - 78.0 + ox, 1.45, 387.0 + oz));
    }
  }
  const dcCrRoof = remapRelief(createGableRoofGeometry(8.0, 5.8, 1.45, 0.16, 'x'), 'wovenBambooBasket');
  dcCrRoof.translate(cx - 78.0, 3.60, 387.0);
  crW8Atlas.push(dcCrRoof);
  for (const tx8 of [cx - 80.0, cx - 52.0, cx + 56.0, cx + 84.0]) {
    crW8Bark.push(new THREE.CylinderGeometry(0.13, 0.18, 3.6, 4).translate(tx8, 1.8, 398.5));
    crW8Leaf.push(colorizeGeo(new THREE.ConeGeometry(2.1, 2.2, 5).translate(tx8, 4.0, 398.5), 0x32822f));
  }

  // [2501–2520] Floating Bánh Mì Sampan, Rambutan Ghe Bầu, Dry-Goods Barge, Finger-Piers #7/#8 & Far-Channel Spar Buoys
  crW8Atlas.push(
    makeReliefBox(1.5, 0.42, 5.2, 'gheBauPlankedHull', cx - 26.0, 0.20, 362.0, 0.18),
    makeReliefCyl(0.08, 1.05, 0.34, 5, 'corrugatedTinBlue', cx - 26.0, 1.95, 362.0),
    makeReliefBox(3.2, 1.02, 10.0, 'gheBauPlankedHull', cx + 42.0, 0.42, 368.0, -0.16),
    makeReliefBox(2.6, 0.52, 4.2, 'benThanhTerracottaRoof', cx + 42.0, 1.15, 369.0, -0.16),
    makeReliefCyl(0.03, 0.04, 4.8, 4, 'wovenBambooBasket', cx + 41.4, 2.85, 372.0),
    makeReliefBox(2.8, 0.85, 8.6, 'gheBauPlankedHull', cx - 40.0, 0.38, 364.0, 0.12), // Dry-Goods Barge
    makeReliefBox(1.3, 0.38, 4.6, 'wharfWeatheredPlank', cx + 22.0, 0.18, 358.0, -0.22), // Trà Đá skiff
    makeReliefBox(3.0, 0.94, 9.4, 'gheBauPlankedHull', cx + 58.0, 0.40, 370.0, -0.14), // Watermelon Ghe Bầu
    makeReliefBox(2.8, 0.14, 5.0, 'corrugatedTinBlue', cx + 58.0, 2.12, 370.0, -0.14),
    // Outer Finger-Piers #7 (cx + 82, 349.5) & #8 (cx - 76, 349.5) + Moored Sampans + Patrol Pontoon #3 + Fish Cage #4
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx + 82.0, 0.95, 349.5),
    makeReliefBox(2.4, 0.22, 6.2, 'wharfWeatheredPlank', cx - 76.0, 0.95, 349.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx - 77.8, 0.16, 352.5),
    makeReliefBox(1.15, 0.34, 4.2, 'wharfWeatheredPlank', cx - 74.2, 0.16, 352.5),
    makeReliefBox(4.4, 0.32, 6.0, 'wharfWeatheredPlank', cx + 52.0, 0.18, 376.0),
    makeReliefBox(3.2, 2.0, 4.0, 'corrugatedTinRust', cx + 52.0, 1.38, 376.0),
    makeReliefBox(4.2, 0.28, 3.6, 'wovenBambooBasket', cx - 74.0, 0.14, 358.0),
    makeReliefCyl(0.24, 0.32, 1.15, 5, 'benThanhTerracottaRoof', cx - 96.0, 0.48, 368.0),
    makeReliefCyl(0.24, 0.32, 1.15, 5, 'benThanhGreenShutter', cx + 100.0, 0.48, 368.0)
  );
  crW8Leaf.push(
    colorizeGeo(new THREE.ConeGeometry(0.82, 0.35, 5).translate(cx - 72.0, 0.18, 376.0), 0x3b8a36),
    colorizeGeo(new THREE.ConeGeometry(0.82, 0.35, 5).translate(cx + 92.0, 0.18, 374.0), 0x3b8a36)
  );
  for (const fx8 of [cx + 82.0, cx - 76.0]) {
    crW8Atlas.push(makeReliefCyl(0.12, 0.14, 3.2, 4, 'wharfWeatheredPlank', fx8, 0.2, 352.4));
    crW8Glow.push(new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(fx8, 2.0, 352.4));
  }
  crW8Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx - 26.0, 2.05, 360.2),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx - 96.0, 1.15, 368.0),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(cx + 100.0, 1.15, 368.0)
  );

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

  // Wave 3 merged meshes (castShadow = false, zero new materials!)
  const crW3AtlasM = createMergedMesh('CaiRangWave3Atlas', crW3Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW3AtlasM) group.add(crW3AtlasM);
  const crW3IronM = createMergedMesh('CaiRangWave3Iron', crW3Iron, ctx.materials.granite, false, true);
  if (crW3IronM) group.add(crW3IronM);
  const crW3BarkM = createMergedMesh('CaiRangWave3Bark', crW3Bark, ctx.materials.bark, false, true);
  if (crW3BarkM) group.add(crW3BarkM);
  const crW3LeafM = createMergedMesh('CaiRangWave3Leaf', crW3Leaf, foliageMat, false, false);
  if (crW3LeafM) group.add(crW3LeafM);
  const crW3GlowM = createMergedMesh('CaiRangWave3Glow', crW3Glow, glowMat, false, false);
  if (crW3GlowM) group.add(crW3GlowM);

  // Wave 4 merged meshes (castShadow = false, zero new materials!)
  const crW4AtlasM = createMergedMesh('CaiRangWave4Atlas', crW4Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW4AtlasM) group.add(crW4AtlasM);
  const crW4IronM = createMergedMesh('CaiRangWave4Iron', crW4Iron, ctx.materials.granite, false, true);
  if (crW4IronM) group.add(crW4IronM);
  const crW4BarkM = createMergedMesh('CaiRangWave4Bark', crW4Bark, ctx.materials.bark, false, true);
  if (crW4BarkM) group.add(crW4BarkM);
  const crW4LeafM = createMergedMesh('CaiRangWave4Leaf', crW4Leaf, foliageMat, false, false);
  if (crW4LeafM) group.add(crW4LeafM);
  const crW4GlowM = createMergedMesh('CaiRangWave4Glow', crW4Glow, glowMat, false, false);
  if (crW4GlowM) group.add(crW4GlowM);

  // Wave 5 merged meshes (castShadow = false, zero new materials!)
  const crW5AtlasM = createMergedMesh('CaiRangWave5Atlas', crW5Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW5AtlasM) group.add(crW5AtlasM);
  const crW5IronM = createMergedMesh('CaiRangWave5Iron', crW5Iron, ctx.materials.granite, false, true);
  if (crW5IronM) group.add(crW5IronM);
  const crW5BarkM = createMergedMesh('CaiRangWave5Bark', crW5Bark, ctx.materials.bark, false, true);
  if (crW5BarkM) group.add(crW5BarkM);
  const crW5LeafM = createMergedMesh('CaiRangWave5Leaf', crW5Leaf, foliageMat, false, false);
  if (crW5LeafM) group.add(crW5LeafM);
  const crW5GlowM = createMergedMesh('CaiRangWave5Glow', crW5Glow, glowMat, false, false);
  if (crW5GlowM) group.add(crW5GlowM);

  // Wave 6 merged meshes (castShadow = false, zero new materials!)
  const crW6AtlasM = createMergedMesh('CaiRangWave6Atlas', crW6Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW6AtlasM) group.add(crW6AtlasM);
  const crW6IronM = createMergedMesh('CaiRangWave6Iron', crW6Iron, ctx.materials.granite, false, true);
  if (crW6IronM) group.add(crW6IronM);
  const crW6BarkM = createMergedMesh('CaiRangWave6Bark', crW6Bark, ctx.materials.bark, false, true);
  if (crW6BarkM) group.add(crW6BarkM);
  const crW6LeafM = createMergedMesh('CaiRangWave6Leaf', crW6Leaf, foliageMat, false, false);
  if (crW6LeafM) group.add(crW6LeafM);
  const crW6GlowM = createMergedMesh('CaiRangWave6Glow', crW6Glow, glowMat, false, false);
  if (crW6GlowM) group.add(crW6GlowM);

  // Wave 7 merged meshes (castShadow = false, zero new materials!)
  const crW7AtlasM = createMergedMesh('CaiRangWave7Atlas', crW7Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW7AtlasM) group.add(crW7AtlasM);
  const crW7IronM = createMergedMesh('CaiRangWave7Iron', crW7Iron, ctx.materials.granite, false, true);
  if (crW7IronM) group.add(crW7IronM);
  const crW7BarkM = createMergedMesh('CaiRangWave7Bark', crW7Bark, ctx.materials.bark, false, true);
  if (crW7BarkM) group.add(crW7BarkM);
  const crW7LeafM = createMergedMesh('CaiRangWave7Leaf', crW7Leaf, foliageMat, false, false);
  if (crW7LeafM) group.add(crW7LeafM);
  const crW7GlowM = createMergedMesh('CaiRangWave7Glow', crW7Glow, glowMat, false, false);
  if (crW7GlowM) group.add(crW7GlowM);

  // Wave 8 merged meshes (castShadow = false, zero new materials!)
  const crW8AtlasM = createMergedMesh('CaiRangWave8Atlas', crW8Atlas, pack.benThanhCaiRangMasterAtlasMat, false, true);
  if (crW8AtlasM) group.add(crW8AtlasM);
  const crW8IronM = createMergedMesh('CaiRangWave8Iron', crW8Iron, ctx.materials.granite, false, true);
  if (crW8IronM) group.add(crW8IronM);
  const crW8BarkM = createMergedMesh('CaiRangWave8Bark', crW8Bark, ctx.materials.bark, false, true);
  if (crW8BarkM) group.add(crW8BarkM);
  const crW8LeafM = createMergedMesh('CaiRangWave8Leaf', crW8Leaf, foliageMat, false, false);
  if (crW8LeafM) group.add(crW8LeafM);
  const crW8GlowM = createMergedMesh('CaiRangWave8Glow', crW8Glow, glowMat, false, false);
  if (crW8GlowM) group.add(crW8GlowM);

  tagMotifIds(group, ['HV-C06', 'HV-I04', 'HV-NEW-MN-01', 'HV-NEW-MN-11']);
  ctx.scene.add(group);
  return southernBoats;
}
