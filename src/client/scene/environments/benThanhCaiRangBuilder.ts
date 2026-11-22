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
  // Concrete sidewalk apron around the 98m x 66m market hall
  atlasParts.push(
    makeReliefBox(102.0, 0.36, 70.0, 'benThanhCreamStucco', 0, 0.18, 0)
  );
  // Dark urban asphalt street & white pedestrian zebra crosswalk in front of Cửa Nam (-Z)
  for (let ix = -3; ix <= 3; ix++) {
    const roadTile = remapRelief(new THREE.PlaneGeometry(14.5, 13.0), 'saigonCrosswalkAsphalt');
    roadTile.rotateX(-Math.PI * 0.5);
    roadTile.translate(ix * 14.5, 0.08, -42.0);
    atlasParts.push(roadTile);
  }
  // Symmetrical terracotta-potted tiered ornamental Ficus topiary trees flanking portal (NO blocking banyan tree! BT-30)
  for (const px of [-17.5, -5.8, 5.8, 17.5]) {
    atlasParts.push(
      makeReliefCyl(0.68, 0.48, 0.82, 10, 'benThanhTerracottaRoof', px, 0.75, -36.5)
    );
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.8, 7);
    trunk.translate(px, 1.9, -36.5);
    barkParts.push(trunk);
    for (let t = 0; t < 3; t++) {
      const card = new THREE.PlaneGeometry(1.85 - t * 0.3, 1.35);
      card.rotateY(t * 1.05);
      card.translate(px, 2.55 + t * 0.55, -36.5);
      colorizeGeo(card, t % 2 === 0 ? 0x2d6b28 : 0x3d8234);
      leafParts.push(card);
    }
  }
  // Slender cobra-head heritage streetlamps along outer sidewalk edge (BT-31)
  for (const lx of [-34, -21, -9, 9, 21, 34]) {
    const pole = new THREE.CylinderGeometry(0.08, 0.12, 5.6, 8);
    pole.translate(lx, 3.1, -36.8);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.2);
    arm.translate(lx, 5.85, -37.3);
    darkIronParts.push(pole, arm);
    const bulb = new THREE.SphereGeometry(0.18, 8, 6);
    bulb.translate(lx, 5.75, -37.8);
    warmGlowParts.push(bulb);
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
  // East & West flank walls
  for (const sx of [-1, 1]) {
    const wx = sx * (hallW * 0.5);
    for (const sz of [-1, 1]) {
      const wingD = 20.5;
      const wingCz = sz * 21.0;
      atlasParts.push(
        makeReliefBox(0.55, 0.85, wingD, 'benThanhGreenShutter', wx, 0.78, wingCz),
        makeReliefBox(0.48, wallH - 0.85, wingD, 'benThanhCreamStucco', wx, 1.2 + (wallH - 0.85) * 0.5, wingCz),
        makeReliefBox(1.65, 0.28, wingD + 0.8, 'benThanhCreamStucco', wx + sx * 0.75, 5.15, wingCz)
      );
    }
  }

  // Multi-tier pitched corrugated terracotta market roofs + continuous clerestory monitor louver bands (BT-24..26)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const qx = sx * 29.5;
      const qz = sz * 20.5;
      // Lower pitched roof tier
      const roof1 = remapRelief(createGableRoofGeometry(34.5, 21.5, 2.6, 0.3, 'x'), 'benThanhTerracottaRoof');
      roof1.translate(qx, wallH + 0.35, qz);
      // Clerestory monitor louver band
      const monitor = makeReliefBox(28.5, 1.15, 13.5, 'benThanhGreenShutter', qx, wallH + 2.45, qz);
      // Upper pitched monitor roof tier
      const roof2 = remapRelief(createGableRoofGeometry(29.8, 14.8, 2.1, 0.25, 'x'), 'benThanhTerracottaRoof');
      roof2.translate(qx, wallH + 3.05, qz);
      atlasParts.push(roof1, monitor, roof2);
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

  // ICONIC 3-FACED CLOCK TOWER (y = 12.0 .. 28.5m, BT-01..10)
  const twZ = pZ - 0.8;
  const twW = 8.4;
  atlasParts.push(
    // Stepped base ledge
    makeReliefBox(9.2, 0.45, 9.2, 'benThanhCreamStucco', 0, 12.05, twZ),
    // Main cream clock tower shaft
    makeReliefBox(twW, 9.6, twW, 'benThanhCreamStucco', 0, 17.05, twZ),
    // 3 green louvered arch windows directly below the front clock dial!
    makeArtSubPlane(4.6, 2.2, 'benThanhClockAndTitle', 0.52, 0.52, 0.98, 0.94, 0, 13.75, twZ - twW * 0.5 - 0.06, Math.PI)
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
  // 3 Identical Circular Clock Dials (North front -Z, West -X, East +X) with stepped cream bezel & turquoise numeral ring (BT-07, BT-09..10)
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
    atlasParts.push(
      bezel,
      makeArtSubPlane(3.9, 3.9, 'benThanhClockAndTitle', 0.02, 0.02, 0.48, 0.98, ckX + Math.sin(ckRot) * 0.15, clockY, ckZ + Math.cos(ckRot) * 0.15, ckRot)
    );
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

  // CENTRAL INTERSECTION ROTUNDA (Nhà Lồng Giữa) & Octagonal Florist/Souvenir Island Kiosk (BI-10..11)
  for (const sx of [-4.6, 4.6]) {
    for (const sz of [-4.6, 4.6]) {
      atlasParts.push(makeReliefCyl(0.38, 0.44, 8.6, 12, 'benThanhCreamStucco', sx, 4.65, sz));
    }
  }
  atlasParts.push(
    makeReliefCyl(2.6, 2.8, 1.05, 8, 'benThanhCreamStucco', 0, 0.90, 0),
    makeReliefCyl(2.4, 2.4, 0.45, 8, 'benThanhSpiceDryGoods', 0, 1.55, 0),
    makeReliefCyl(0.3, 3.2, 1.15, 8, 'benThanhTerracottaRoof', 0, 3.85, 0)
  );
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
    atlasParts.push(makeReliefCyl(0.08, 0.08, 2.4, 6, 'wharfWeatheredPlank', Math.cos(a) * 2.1, 2.25, Math.sin(a) * 2.1));
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

      // Rich 3D differentiated merchandise: draped silk bolts & áo dài, conical nón lá pyramids, 3D spice bowls, coffee tins & lacquerware (BI-22..28)
      if (idx % 2 === 0) {
        for (let b = -1; b <= 1; b++) {
          atlasParts.push(
            makeReliefBox(0.45, 1.35, 1.15, 'benThanhSilkTextile', sx - side * 0.2, 2.15, sz + b * 1.45),
            makeReliefCyl(0.04, 0.44, 0.85, 10, 'wovenBambooBasket', sx - side * 0.85, 1.82, sz + b * 1.35)
          );
        }
      } else {
        // Stepped wooden counter shelves topped with 3D cylindrical spice bowls, coffee tins & woven fruit baskets!
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
        }
      }

      // Molded blue/red plastic vendor stool in front of stall (BI-30)
      atlasParts.push(
        makeReliefBox(0.38, 0.44, 0.38, idx % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust', side * 2.45, 0.60, sz + 0.8)
      );
    });
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
  // Support pilings + diagonal cross-bracing + rubber tire dock fenders (CW-03)
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

  // Stacked multi-tier pyramids of woven bamboo wholesale fruit baskets (*cần xé*) on wharf deck (CW-11..14)
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

    // Second-row 2-story Cần Thơ town shophouse backdrop screening bare grass (CW-27..28)
    atlasParts.push(
      makeReliefBox(8.8, 6.8, 7.2, 'benThanhCreamStucco', sx + 1.2, sy + 3.4, sz - 9.5),
      makeReliefBox(9.2, 0.45, 7.6, 'corrugatedTinRust', sx + 1.2, sy + 6.95, sz - 9.5)
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
      // Upturned painted red-and-green prow with bold black-and-white folk bow eyes (*mắt thuyền*) on left & right cheeks + timber foredeck cap!
      makeReliefBox(bBeam * 0.74, 1.04, bLen * 0.28, 'gheBauPaintedProw', 0, 0.50, bLen * 0.34),
      makeReliefBox(bBeam * 0.76, 0.10, bLen * 0.29, 'wharfWeatheredPlank', 0, 1.05, bLen * 0.34),
      // Enclosed mid/aft wooden living cabin with shuttered windows + pitched corrugated *mui thuyền* roof! (CR-06..08)
      makeReliefBox(bBeam * 0.86, 1.18, bLen * 0.42, 'mekongShophouseWall', 0, 1.24, -bLen * 0.16),
      (() => {
        const roofGable = remapRelief(
          createGableRoofGeometry(bBeam * 0.98, bLen * 0.46, 0.52, 0.10, 'z'),
          idx % 2 === 0 ? 'corrugatedTinBlue' : 'corrugatedTinRust'
        );
        roofGable.translate(0, 1.82, -bLen * 0.16);
        return roofGable;
      })(),
      // Recessed wooden foredeck cargo hold + woven bamboo baskets (CR-16..17)
      makeReliefBox(bBeam * 0.76, 0.38, bLen * 0.26, 'wharfWeatheredPlank', 0, 0.78, bLen * 0.12),
      makeReliefCyl(0.38, 0.28, 0.44, 8, 'wovenBambooBasket', -bBeam * 0.22, 1.15, bLen * 0.22),
      // Scalloped foredeck sun umbrella (*dù che nắng*, CR-10)
      makeReliefCyl(0.03, 0.04, 1.8, 6, 'wharfWeatheredPlank', bBeam * 0.22, 1.65, bLen * 0.12),
      makeReliefCyl(0.08, 1.05, 0.38, 10, idx % 2 === 0 ? 'corrugatedTinRust' : 'corrugatedTinBlue', bBeam * 0.22, 2.62, bLen * 0.12)
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
    // 4 Realistic-scale dangling produce samples (dark-green striped watermelons & golden pineapples — ZERO giant spheres!)
    for (let p = 0; p < 4; p++) {
      const py = 3.25 + p * 0.52;
      const pz = poleZ + 0.12 + p * 0.04;
      const sample = remapRelief(
        new THREE.SphereGeometry(0.16, 8, 6),
        idx % 2 === 0 ? 'watermelonStripedSkin' : 'wovenBambooBasket'
      );
      sample.scale(1.0, 1.25, 1.0);
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
      // Hủ tiếu broth pot / coffee cooler & scalloped striped market parasol
      makeReliefBox(0.76, 0.68, 0.92, rIdx % 2 === 0 ? 'benThanhCreamStucco' : 'corrugatedTinBlue', 0, 0.62, 0.55),
      makeReliefCyl(0.24, 0.22, 0.38, 10, 'benThanhRollShutter', 0, 0.58, -0.25),
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

  tagMotifIds(group, ['HV-C06', 'HV-I04', 'HV-NEW-MN-01', 'HV-NEW-MN-11']);
  ctx.scene.add(group);
  return southernBoats;
}
