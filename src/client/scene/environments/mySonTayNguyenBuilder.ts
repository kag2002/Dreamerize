import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createSculptedRockGeometry
} from './vietnamGeometryHelpers';
import {
  tagMotifIds
} from './vietnamMotifHelpers';
import { createMergedMesh } from '../vietnam/geometry/PartsBuilder';
import {
  createMySonTayNguyenMaterialPack,
  MSTN_ART_UV,
  MSTN_RELIEF_UV,
  type MstnArtKey,
  type MstnReliefKey,
  type MySonTayNguyenMaterialPack
} from '../textures/mySonTayNguyenPbrTextures';

/**
 * Thánh Địa Mỹ Sơn & Nhà Rông Tây Nguyên — Biển Hồ T'Nưng Museum Builder
 * Implements all 128 visual QC items:
 *   - Thánh Địa Mỹ Sơn Kalan Towers, Rubbed Brick & Valley (`MS-01..32`)
 *   - Mỹ Sơn False Doors, Kala-Makara Tympanum, Linga-Yoni & Mandapa (`MR-01..32`)
 *   - Nhà Rông Tây Nguyên Soaring Axe-Blade Roof, Stilt X-Bracing & Carved Stairs (`NR-01..32`)
 *   - Cồng Chiêng, Thổ Cẩm, Cây Nêu, Rượu Cần, Tượng Nhà Mồ & Biển Hồ T'Nưng (`TN-01..32`)
 *
 * Shares ONE single 2048×3072 Master PBR & Relief Atlas (`mySonTayNguyenMasterAtlasMat`)
 * across BOTH complexes -> net GPU material reduction (-3 materials vs legacy)!
 */

const mstnPackCache = new WeakMap<THREE.Scene, MySonTayNguyenMaterialPack>();

function getOrCreateMstnPack(ctx: VietnamBuilderContext): MySonTayNguyenMaterialPack {
  let pack = mstnPackCache.get(ctx.scene);
  if (!pack) {
    pack = createMySonTayNguyenMaterialPack(ctx.renderer);
    mstnPackCache.set(ctx.scene, pack);
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

function remapRelief(geo: THREE.BufferGeometry, key: MstnReliefKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, MSTN_RELIEF_UV[key], inset);
}

function remapArt(geo: THREE.BufferGeometry, key: MstnArtKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, MSTN_ART_UV[key], inset);
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: MstnReliefKey,
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
  key: MstnReliefKey,
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
  key: MstnArtKey,
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

function addOrganicTree(
  barkParts: THREE.BufferGeometry[],
  leafParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number,
  palette: number[],
  isHighlandPine = false
): void {
  const rand = mulberry32(seed);
  const trunkH = (isHighlandPine ? 7.5 : 4.6) * scale * (0.88 + rand() * 0.25);
  const trunk = new THREE.CylinderGeometry(0.16 * scale, 0.34 * scale, trunkH, 7);
  trunk.translate(x, y + trunkH * 0.5, z);
  barkParts.push(trunk);

  const tiers = isHighlandPine ? 4 : 3;
  for (let t = 0; t < tiers; t++) {
    const ty = y + trunkH * (isHighlandPine ? 0.55 + t * 0.19 : 0.72 + t * 0.30);
    const rad = (isHighlandPine ? 2.8 - t * 0.45 : 3.2 - t * 0.65) * scale;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + t * 0.7 + rand() * 0.4;
      const card = new THREE.PlaneGeometry(rad * 1.5, rad * (isHighlandPine ? 0.92 : 1.18));
      card.rotateY(a);
      card.rotateX((k % 2 === 0 ? 1 : -1) * 0.24);
      card.translate(x + Math.cos(a) * rad * 0.32, ty, z + Math.sin(a) * rad * 0.32);
      colorizeGeo(card, palette[(t + k) % palette.length]);
      leafParts.push(card);
    }
  }
}

/**
 * Helper to build a richly articulated Cham Kalan Tower with stepped sandstone-and-brick plinth,
 * 3D projecting fluted pilasters, deeply recessed flame-arch false doors (*cửa giả*),
 * diminishing pyramidal roof stories & authentic miniature corner shrine spires (*tháp góc*)!
 */
function addArticulatedChamKalan(
  atlasParts: THREE.BufferGeometry[],
  leafParts: THREE.BufferGeometry[],
  x: number,
  baseY: number,
  z: number,
  w: number,
  totalH: number,
  tiers: number,
  hasEastPortal = true
): void {
  // 1. Stepped sandstone-and-brick cyma-torus plinth (MS-14, MR-19)
  atlasParts.push(
    makeReliefBox(w + 1.4, 0.55, w + 1.4, 'chamSandstoneMonolith', x, baseY + 0.275, z),
    makeReliefBox(w + 0.9, 0.52, w + 0.9, 'chamRubbedBrick', x, baseY + 0.80, z),
    makeReliefBox(w + 0.55, 0.28, w + 0.55, 'chamSandstoneMonolith', x, baseY + 1.20, z)
  );

  // 2. Main Kalan body shaft with 3D projecting fluted pilasters & recessed flame-arch false doors (MS-09, MS-13, MR-06..09)
  const bodyY = baseY + 1.34;
  const bodyH = totalH * 0.44;
  atlasParts.push(
    makeReliefBox(w, bodyH, w, 'chamRubbedBrick', x, bodyY + bodyH * 0.5, z)
  );
  // 4 corners & flanking vertical 3D projecting pilasters (bổ trụ) on all 4 facades
  for (const s of [-1, 1]) {
    for (const off of [-w * 0.44, -w * 0.24, w * 0.24, w * 0.44]) {
      atlasParts.push(
        makeReliefBox(0.42, bodyH, 0.24, 'chamCarvedPilaster', x + off, bodyY + bodyH * 0.5, z + s * (w * 0.5 + 0.08)),
        makeReliefBox(0.24, bodyH, 0.42, 'chamCarvedPilaster', x + s * (w * 0.5 + 0.08), bodyY + bodyH * 0.5, z + off)
      );
    }
  }
  // Sculpted recessed flame-arch false doors (*cửa giả*) on blind faces (North, South, West — and East if no portal)
  const fdW = w * 0.42;
  const fdH = bodyH * 0.72;
  for (const sz of [-1, 1]) {
    atlasParts.push(
      makeReliefBox(fdW, fdH, 0.28, 'chamFalseDoorArch', x, bodyY + fdH * 0.5, z + sz * (w * 0.5 + 0.12)),
      // Item 122: Carved sandstone Apsara & Dvarapala guardian bas-relief panels in blind niches
      makeReliefBox(0.58, 1.35, 0.22, 'chamSandstoneMonolith', x - w * 0.34, bodyY + 1.45, z + sz * (w * 0.5 + 0.14)),
      makeReliefBox(0.58, 1.35, 0.22, 'chamSandstoneMonolith', x + w * 0.34, bodyY + 1.45, z + sz * (w * 0.5 + 0.14))
    );
  }
  // Item 121: Cham sandstone Makara & Kala corner gargoyle spouts on plinth & cornice
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      atlasParts.push(
        makeReliefBox(0.45, 0.28, 0.45, 'chamSandstoneMonolith', x + sx * (w * 0.5 + 0.38), baseY + 1.18, z + sz * (w * 0.5 + 0.38))
      );
    }
  }
  // Item 129: Weathered moss & dark-charcoal lichen patches on shaded north/west brick faces
  const mossTuft = new THREE.SphereGeometry(0.42, 6, 5);
  mossTuft.scale(1.2, 0.45, 1.0);
  mossTuft.translate(x - w * 0.48, bodyY + bodyH * 0.65, z - w * 0.28);
  colorizeGeo(mossTuft, 0x355c24);
  leafParts.push(mossTuft);
  atlasParts.push(
    makeReliefBox(0.28, fdH, fdW, 'chamFalseDoorArch', x - (w * 0.5 + 0.12), bodyY + fdH * 0.5, z)
  );
  if (!hasEastPortal) {
    atlasParts.push(
      makeReliefBox(0.28, fdH, fdW, 'chamFalseDoorArch', x + (w * 0.5 + 0.12), bodyY + fdH * 0.5, z)
    );
  }

  // Deep multi-stepped corbelled cornice frieze crowning main Kalan body (MS-10)
  let curY = bodyY + bodyH;
  atlasParts.push(
    makeReliefBox(w + 0.65, 0.36, w + 0.65, 'chamRubbedBrick', x, curY + 0.18, z),
    makeReliefBox(w + 0.95, 0.30, w + 0.95, 'chamCarvedPilaster', x, curY + 0.50, z)
  );
  curY += 0.65;

  // 3. Diminishing pyramidal Cham roof stories + authentic miniature corner shrine spires (*tháp góc*) (MS-07..08, MR-08)
  const remH = totalH - (curY - baseY);
  const tierH = remH / (tiers + 0.6);
  for (let t = 0; t < tiers; t++) {
    const frac = 1 - (t + 1) * (0.68 / tiers);
    const tw = Math.max(1.3, w * frac);
    const th = tierH * (1 - t * 0.08);
    atlasParts.push(
      makeReliefBox(tw, th, tw, 'chamRubbedBrick', x, curY + th * 0.5, z),
      makeReliefBox(tw + 0.52, 0.28, tw + 0.52, 'chamCarvedPilaster', x, curY + th + 0.14, z)
    );
    // 4 Authentic miniature corner Kalan spires (*tháp góc*) seated solidly on cornice corners!
    const spOff = tw * 0.48;
    const spW = Math.max(0.42, tw * 0.17);
    const spH = th * 0.68;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        atlasParts.push(
          makeReliefBox(spW, spH, spW, 'chamRubbedBrick', x + sx * spOff, curY + spH * 0.5 + 0.12, z + sz * spOff),
          makeReliefCyl(spW * 0.12, spW * 0.52, spH * 0.55, 4, 'chamSandstoneMonolith', x + sx * spOff, curY + spH + spH * 0.25, z + sz * spOff, Math.PI * 0.25)
        );
      }
    }
    // Ruin-rooted fern tuft growing on shaded weathered brick ledges (MR-29)
    if (t === 0 || t === 1) {
      const fern = new THREE.PlaneGeometry(1.15, 0.78);
      fern.rotateY(t * 1.1 + 0.4);
      fern.translate(x + tw * 0.35, curY + 0.45, z + tw * 0.52);
      colorizeGeo(fern, 0x3b6e28);
      leafParts.push(fern);
    }
    curY += th + 0.26;
  }

  // Crowning lotus-bud sandstone finial (*đỉnh tháp hoa sen*)
  atlasParts.push(
    makeReliefCyl(0.14, Math.max(0.45, w * 0.14), tierH * 0.85, 8, 'chamSandstoneMonolith', x, curY + tierH * 0.4, z)
  );
}

/**
 * ============================================================================
 * PART 1: THÁNH ĐỊA MỸ SƠN (CHAM PA SANCTUARY AT -320, -135)
 * Implements MS-01..MS-32 & MR-01..MR-32
 * ============================================================================
 */
export function buildMySonSanctuaryComplex(ctx: VietnamBuilderContext): THREE.Group {
  const pack = getOrCreateMstnPack(ctx);
  const group = new THREE.Group();
  group.name = 'MySonSanctuaryComplex';

  const cx = -350.0;
  const cz = -155.0;
  const yBase = ctx.getHeight(cx, cz);
  const courtY = yBase + 0.12;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 44.0 });

  const atlasParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  // --------------------------------------------------------------------------
  // 1. COMPACTED RED-OCHRE QUẢNG NAM LATERITE SANCTUARY PATH & CRUMBLED ENCLOSURE (MS-24..27, MR-30)
  // --------------------------------------------------------------------------
  for (let ix = -3; ix <= 3; ix++) {
    for (let iz = -2; iz <= 2; iz++) {
      const tile = remapRelief(new THREE.PlaneGeometry(7.2, 7.6), 'quangNamLateritePath');
      tile.rotateX(-Math.PI * 0.5);
      tile.translate(cx + ix * 7.2, courtY + 0.02, cz + iz * 7.6);
      atlasParts.push(tile);
    }
  }
  // Low weathered ruined brick enclosure walls with stepped broken top courses (MS-25)
  for (const sideZ of [-1, 1]) {
    for (let wx = -22; wx <= 18; wx += 8) {
      const h = 0.85 + ((Math.abs(wx) * 7) % 5) * 0.16;
      atlasParts.push(makeReliefBox(7.6, h, 0.72, 'chamRubbedBrick', cx + wx, courtY + h * 0.5, cz + sideZ * 21.5));
    }
  }
  atlasParts.push(makeReliefBox(0.75, 1.35, 42.0, 'chamRubbedBrick', cx - 24.0, courtY + 0.68, cz));

  // --------------------------------------------------------------------------
  // 2. TOWER A1 KALAN (24m) + SUBSIDIARY TOWERS + STEPPED VESTIBULE, KALA-MAKARA TYMPANUM & LINGA-YONI (MS-07..18, MR-06..22)
  // --------------------------------------------------------------------------
  addArticulatedChamKalan(atlasParts, leafParts, cx - 7.0, courtY, cz, 8.2, 23.5, 4, true);
  addArticulatedChamKalan(atlasParts, leafParts, cx - 10.5, courtY, cz - 12.2, 5.2, 15.0, 3, false);
  addArticulatedChamKalan(atlasParts, leafParts, cx - 10.0, courtY, cz + 11.8, 4.6, 12.2, 3, false);
  // Item 123 (Area Expansion): Tháp B1 subsidiary brick Kalan + Kosa Grha (Tower B5) Fire-House with boat-shaped saddle roof (Item 125)
  addArticulatedChamKalan(atlasParts, leafParts, cx + 6.5, courtY, cz - 14.5, 4.4, 11.8, 3, false);
  const kosaX = cx + 6.5;
  const kosaZ = cz + 13.5;
  atlasParts.push(
    makeReliefBox(6.2, 0.75, 4.4, 'chamSandstoneMonolith', kosaX, courtY + 0.375, kosaZ),
    makeReliefBox(5.4, 3.2, 3.6, 'chamRubbedBrick', kosaX, courtY + 2.35, kosaZ),
    makeReliefBox(1.8, 2.2, 0.45, 'chamFalseDoorArch', kosaX, courtY + 1.85, kosaZ - 1.82)
  );
  // Boat-shaped saddle roof (*Mái Hình Thuyền*) on Kosa Grha
  for (let sr = 0; sr < 5; sr++) {
    const f = sr / 4;
    atlasParts.push(
      makeReliefBox(5.8 + f * 0.85, 0.42, 3.9 - f * 2.6, 'chamRubbedBrick', kosaX, courtY + 4.15 + sr * 0.42, kosaZ)
    );
  }
  // Item 124 (Area Expansion): Group G / B4 ruined brick temple plinth with exposed sandstone Yoni pedestal (cx + 15.5, cz + 14.5)
  atlasParts.push(
    makeReliefBox(5.2, 0.85, 5.2, 'chamRubbedBrick', cx + 15.5, courtY + 0.425, cz + 14.5),
    makeReliefBox(1.35, 0.65, 1.35, 'chamSandstoneMonolith', cx + 15.5, courtY + 1.15, cz + 14.5)
  );
  // Item 133 (Area Expansion): Khe Thẻ sacred stream stone-banked creek bed & wooden footbridge along southern valley edge
  atlasParts.push(
    makeReliefBox(36.0, 0.25, 3.4, 'chamSandstoneMonolith', cx + 2.0, courtY - 0.15, cz + 23.5),
    makeReliefBox(2.8, 0.22, 4.4, 'tayNguyenDarkHardwood', cx + 8.5, courtY + 0.25, cz + 23.5)
  );

  // Unified projecting corbelled brick East Vestibule (*tiền sảnh*) for Tower A1 (MS-16..18, MR-11..18)
  const vestX = cx - 0.8;
  const vestW = 4.6;
  const vestD = 5.2;
  const vestH = 4.9;
  // Stepped brick vestibule plinth + side walls + shadowed garbhagriha interior (NO glowing orbs, NO fake smoke!)
  atlasParts.push(
    makeReliefBox(vestW + 0.8, 1.15, vestD + 0.8, 'chamRubbedBrick', vestX, courtY + 0.58, cz),
    makeReliefBox(vestW, vestH, 0.85, 'chamRubbedBrick', vestX, courtY + 1.15 + vestH * 0.5, cz - vestD * 0.5 + 0.42),
    makeReliefBox(vestW, vestH, 0.85, 'chamRubbedBrick', vestX, courtY + 1.15 + vestH * 0.5, cz + vestD * 0.5 - 0.42),
    // Deep dark recessed inner sanctum chamber
    makeReliefBox(0.35, vestH - 0.4, vestD - 1.5, 'chamDarkInterior', vestX - 1.85, courtY + 1.15 + (vestH - 0.4) * 0.5, cz)
  );
  // Stepped corbelled terracotta brick barrel-vault vestibule roof (ZERO raw salmon triangle! MR-11)
  for (let r = 0; r < 5; r++) {
    const rw = vestW + 0.4 - r * 0.22;
    const rd = vestD + 0.5 - r * 0.78;
    atlasParts.push(makeReliefBox(rw, 0.46, Math.max(0.8, rd), 'chamRubbedBrick', vestX, courtY + 1.15 + vestH + 0.23 + r * 0.44, cz));
  }
  // Monolithic grey-buff sandstone post-and-lintel doorway frame + high-relief Kala-Makara & Apsara tympanum! (MS-15, MR-12..17)
  const portalX = vestX + vestW * 0.5 + 0.12;
  atlasParts.push(
    makeReliefBox(0.68, 3.65, 0.58, 'chamSandstoneMonolith', portalX, courtY + 1.15 + 1.82, cz - 1.32),
    makeReliefBox(0.68, 3.65, 0.58, 'chamSandstoneMonolith', portalX, courtY + 1.15 + 1.82, cz + 1.32),
    makeReliefBox(0.86, 0.68, 3.65, 'chamSandstoneMonolith', portalX, courtY + 1.15 + 3.85, cz),
    // Horseshoe monolithic sandstone Kala-Makara & Dancing Apsara relief tympanum
    makeReliefBox(0.36, 1.95, 2.85, 'chamSandstoneMonolith', portalX, courtY + 1.15 + 5.15, cz),
    makeArtPlane(2.65, 1.78, 'kalaMakaraTympanum', portalX + 0.20, courtY + 1.15 + 5.15, cz, Math.PI * 0.5)
  );
  // Stepped brick entrance stairs flanked by stepped cheek walls (MS-17, MR-18)
  for (let s = 0; s < 5; s++) {
    const sx = portalX + 0.55 + s * 0.45;
    const sh = 1.12 - s * 0.20;
    atlasParts.push(
      makeReliefBox(0.48, sh, 2.6, 'chamSandstoneMonolith', sx, courtY + sh * 0.5, cz),
      makeReliefBox(0.52, sh + 0.35, 0.42, 'chamRubbedBrick', sx, courtY + (sh + 0.35) * 0.5, cz - 1.52),
      makeReliefBox(0.52, sh + 0.35, 0.42, 'chamRubbedBrick', sx, courtY + (sh + 0.35) * 0.5, cz + 1.52)
    );
  }
  // Authentic carved dark sandstone Linga-Yoni altar pedestal cleanly seated inside vestibule (MR-20..21)
  const lyX = vestX - 0.45;
  const lyY = courtY + 1.18;
  atlasParts.push(
    makeReliefBox(1.55, 0.58, 1.55, 'chamSandstoneMonolith', lyX, lyY + 0.29, cz),
    makeReliefBox(1.25, 0.24, 1.25, 'chamSandstoneMonolith', lyX, lyY + 0.68, cz),
    makeReliefBox(1.62, 0.28, 1.62, 'chamSandstoneMonolith', lyX, lyY + 0.92, cz),
    // Projecting Yoni drainage spout (somasutra)
    makeReliefBox(0.28, 0.22, 0.85, 'chamSandstoneMonolith', lyX, lyY + 0.92, cz - 1.15),
    // Tripartite Linga (octagonal base collar + rounded domed cylinder)
    makeReliefCyl(0.26, 0.28, 0.38, 8, 'chamSandstoneMonolith', lyX, lyY + 1.25, cz),
    makeReliefCyl(0.24, 0.25, 0.52, 16, 'chamSandstoneMonolith', lyX, lyY + 1.68, cz)
  );
  const lingaDome = remapRelief(new THREE.SphereGeometry(0.24, 14, 10), 'chamSandstoneMonolith');
  lingaDome.translate(lyX, lyY + 1.94, cz);
  atlasParts.push(lingaDome);

  // Item 136: Warm amber oil-lamp niche PointLight inside Tower A1 Garbhagriha vestibule
  const mySonSanctumLight = new THREE.PointLight('#ffaa44', 3.4, 11, 1.5);
  mySonSanctumLight.position.set(lyX + 0.8, lyY + 1.85, cz);
  group.add(mySonSanctumLight);

  // --------------------------------------------------------------------------
  // 3. UNOBSTRUCTED AXIAL MANDAPA PILLARED BRICK HALL AT (-312, -135) (MR-23..26)
  // Twin symmetrical rows of articulated fluted brick pillars flanking the open central processional axis!
  // --------------------------------------------------------------------------
  const mX = cx + 8.5;
  atlasParts.push(
    makeReliefBox(10.4, 0.82, 8.6, 'chamRubbedBrick', mX, courtY + 0.41, cz),
    makeReliefBox(10.8, 0.22, 9.0, 'chamSandstoneMonolith', mX, courtY + 0.11, cz)
  );
  // 2 symmetrical rows × 3 articulated fluted brick columns (z = -2.85 and +2.85 -> wide unobstructed central axis!)
  for (const mxOff of [-3.4, 0, 3.4]) {
    for (const mzOff of [-2.85, 2.85]) {
      atlasParts.push(
        makeReliefBox(1.28, 0.36, 1.28, 'chamSandstoneMonolith', mX + mxOff, courtY + 1.0, cz + mzOff),
        makeReliefBox(0.96, 3.45, 0.96, 'chamCarvedPilaster', mX + mxOff, courtY + 2.90, cz + mzOff),
        makeReliefBox(1.24, 0.32, 1.24, 'chamSandstoneMonolith', mX + mxOff, courtY + 4.78, cz + mzOff)
      );
    }
  }
  // Low ruined brick perimeter curb along Mandapa flanks
  for (const mzOff of [-4.05, 4.05]) {
    atlasParts.push(
      makeReliefBox(9.8, 0.72, 0.48, 'chamRubbedBrick', mX, courtY + 1.18, cz + mzOff),
      // Item 127: Cham Bổ Trụ floral Giun Xoắn terracotta relief bands along Mandapa flanks
      makeReliefBox(9.6, 0.24, 0.56, 'chamCarvedPilaster', mX, courtY + 1.62, cz + mzOff)
    );
  }
  // Item 126 & 131: Carved sandstone Nandi bull pedestal & Bia Ký Chăm inscription stele beside Mandapa
  atlasParts.push(
    makeReliefBox(1.55, 0.58, 1.05, 'chamSandstoneMonolith', mX + 6.2, courtY + 0.29, cz - 2.6),
    makeReliefBox(0.95, 0.55, 0.55, 'chamSandstoneMonolith', mX + 6.2, courtY + 0.85, cz - 2.6),
    makeReliefBox(0.85, 0.35, 0.55, 'chamSandstoneMonolith', mX + 4.2, courtY + 0.18, cz + 5.8),
    makeReliefBox(0.65, 1.45, 0.22, 'chamSandstoneMonolith', mX + 4.2, courtY + 1.08, cz + 5.8)
  );
  // Item 132: Timber-framed archaeological protective shelter over delicate sandstone fragments
  const shX = cx + 12.5;
  const shZ = cz - 14.5;
  for (const sx of [-1.4, 1.4]) {
    for (const sz of [-1.1, 1.1]) {
      atlasParts.push(makeReliefCyl(0.08, 0.09, 2.75, 6, 'tayNguyenDarkHardwood', shX + sx, courtY + 1.225, shZ + sz));
    }
  }
  atlasParts.push(
    makeReliefBox(3.4, 0.16, 2.8, 'nhaRongGrassThatch', shX, courtY + 2.58, shZ),
    makeReliefBox(1.2, 0.75, 0.9, 'chamSandstoneMonolith', shX, courtY + 0.38, shZ)
  );

  // --------------------------------------------------------------------------
  // 4. COHESIVE UNIFIED CHAM RUBBED-BRICK GOPURA ENTRANCE AT (-300, -135) (MS-19..23)
  // --------------------------------------------------------------------------
  const gopX = cx + 19.5;
  const gopWall = remapRelief(
    normalizeExtrudeUv(createArchedWallGeometry(9.6, 5.8, 3.4, 3.0, 3.9)),
    'chamRubbedBrick'
  );
  gopWall.rotateY(Math.PI * 0.5);
  gopWall.translate(gopX, courtY, cz);
  atlasParts.push(
    gopWall,
    // Monolithic sandstone doorway jambs & lintel framing the Gopura passage
    makeReliefBox(3.6, 3.8, 0.46, 'chamSandstoneMonolith', gopX, courtY + 1.9, cz - 1.55),
    makeReliefBox(3.6, 3.8, 0.46, 'chamSandstoneMonolith', gopX, courtY + 1.9, cz + 1.55),
    makeReliefBox(3.75, 0.55, 3.95, 'chamSandstoneMonolith', gopX, courtY + 4.05, cz),
    // Fluted Cham pilasters & stepped diminishing brick superstructure with corner tháp góc!
    makeReliefBox(3.85, 0.42, 10.1, 'chamCarvedPilaster', gopX, courtY + 5.95, cz),
    makeReliefBox(3.1, 1.95, 7.6, 'chamRubbedBrick', gopX, courtY + 7.12, cz),
    makeReliefBox(3.5, 0.36, 8.1, 'chamCarvedPilaster', gopX, courtY + 8.25, cz),
    makeReliefBox(2.3, 1.65, 5.4, 'chamRubbedBrick', gopX, courtY + 9.25, cz),
    makeReliefCyl(0.16, 0.55, 1.1, 8, 'chamSandstoneMonolith', gopX, courtY + 10.6, cz),
    // Item 128: Gopura miniature corner Tháp Góc spires on superstructure
    makeReliefBox(0.55, 0.95, 0.55, 'chamRubbedBrick', gopX, courtY + 8.85, cz - 3.6),
    makeReliefBox(0.55, 0.95, 0.55, 'chamRubbedBrick', gopX, courtY + 8.85, cz + 3.6),
    // Item 130 & 137: Laterite stone kerbs & UNESCO trail markers along eastern approach path
    makeReliefBox(12.0, 0.24, 0.35, 'chamSandstoneMonolith', gopX + 8.5, courtY + 0.12, cz - 2.8),
    makeReliefBox(12.0, 0.24, 0.35, 'chamSandstoneMonolith', gopX + 8.5, courtY + 0.12, cz + 2.8),
    makeReliefCyl(0.14, 0.16, 1.1, 6, 'chamSandstoneMonolith', gopX + 6.5, courtY + 0.55, cz + 3.3),
    // Grounded carved sandstone pedestals & UNESCO heritage sign
    makeReliefBox(1.15, 0.92, 1.15, 'chamSandstoneMonolith', gopX + 2.6, courtY + 0.46, cz - 2.4),
    makeReliefBox(1.15, 0.92, 1.15, 'chamSandstoneMonolith', gopX + 2.6, courtY + 0.46, cz + 2.4),
    makeReliefBox(0.16, 1.12, 2.85, 'chamRubbedBrick', gopX + 2.9, courtY + 1.25, cz + 4.8),
    makeArtPlane(2.7, 0.98, 'mySonHeritageSign', gopX + 3.02, courtY + 1.25, cz + 4.8, Math.PI * 0.5)
  );

  // Foreground carved sandstone relic fragments & brick rubble (replacing generic grey boulders! MS-26, MR-27..28)
  for (const [rx, rz, rot] of [
    [cx + 12.5, cz + 10.2, 0.4], [cx + 2.5, cz - 13.5, -0.6], [cx + 15.2, cz - 9.8, 0.9],
    // Item 135: Additional fallen carved sandstone architraves & mossy brick mounds in Khu A/B ruin field
    [cx - 3.5, cz + 16.5, 0.25], [cx - 15.5, cz - 17.5, -0.45]
  ]) {
    atlasParts.push(
      makeReliefBox(2.2, 0.58, 0.72, 'chamSandstoneMonolith', rx, courtY + 0.29, rz, rot),
      makeReliefBox(1.1, 0.45, 0.85, 'chamRubbedBrick', rx + 1.2, courtY + 0.22, rz - 0.6, rot + 0.5)
    );
  }
  // Item 134: Tropical Dương Xỉ (tree ferns) & wild banana clumps around ruined brick enclosure walls
  for (const [fx, fz] of [[cx - 21.5, cz + 18.5], [cx - 21.5, cz - 18.5], [cx + 4.5, cz + 20.0], [cx - 17.0, cz + 20.0]]) {
    const fern = new THREE.ConeGeometry(1.35, 1.15, 6);
    fern.translate(fx, courtY + 0.55, fz);
    colorizeGeo(fern, 0x2f6b24);
    leafParts.push(fern);
  }

  // --------------------------------------------------------------------------
  // 5. DENSE QUẢNG NAM TROPICAL JUNGLE VALLEY CANOPY FRAMING MỸ SƠN (MS-28..30, MR-31)
  // --------------------------------------------------------------------------
  const valleyPalette = [0x1f5222, 0x2c6b29, 0x3a7d34, 0x245920];
  const jungleSpots: Array<[number, number, number, number]> = [
    [cx - 32, cz - 24, 1.55, 101], [cx - 34, cz - 6, 1.65, 102], [cx - 33, cz + 12, 1.50, 103],
    [cx - 28, cz + 26, 1.62, 104], [cx - 12, cz + 28, 1.55, 105], [cx + 6, cz + 27, 1.48, 106],
    [cx - 14, cz - 28, 1.58, 107], [cx + 4, cz - 27, 1.52, 108], [cx + 22, cz - 24, 1.45, 109],
    [cx - 24, cz - 18, 1.38, 110], [cx - 22, cz + 18, 1.42, 111], [cx + 26, cz + 22, 1.46, 112],
    // Item 138: Towering Chò Chỉ dipterocarp jungle canopy trees framing distant Mỹ Sơn valley ridge
    [cx - 42, cz - 14, 1.85, 113], [cx - 44, cz + 14, 1.90, 114], [cx - 38, cz + 32, 1.78, 115]
  ];
  for (const [tx, tz, ts, tSeed] of jungleSpots) {
    const ty = ctx.getHeight(tx, tz);
    addOrganicTree(barkParts, leafParts, tx, ty - 0.3, tz, ts, tSeed, valleyPalette, false);
  }

  // Merge all Mỹ Sơn batches
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

  const atlasMesh = createMergedMesh('MySonAtlasMesh', atlasParts, pack.mySonTayNguyenMasterAtlasMat, true, true);
  if (atlasMesh) group.add(atlasMesh);
  const barkMesh = createMergedMesh('MySonBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (barkMesh) group.add(barkMesh);
  const leafMesh = createMergedMesh('MySonJungleMesh', leafParts, foliageMat, true, false);
  if (leafMesh) group.add(leafMesh);

  // ==========================================================================
  // WAVE 2 UPGRADES (Items 321–340): Mỹ Sơn A10 Linga-Yoni Shrine, E1 Altar,
  // Archaeology Dig Walkways, Excavation Trench, Sculpture Garden & Khe Thẻ
  // ==========================================================================
  const w2MsAtlas: THREE.BufferGeometry[] = [];
  const w2MsLeaf: THREE.BufferGeometry[] = [];

  // 321: Đài Thờ Linga-Yoni Khu A10 exposed monolithic sandstone shrine on stepped brick platform (cx + 1.5, cz - 14.5)
  const a10X = cx + 1.5;
  const a10Z = cz - 14.5;
  w2MsAtlas.push(
    makeReliefBox(4.4, 0.65, 4.4, 'chamRubbedBrick', a10X, courtY + 0.32, a10Z),
    makeReliefBox(1.85, 0.68, 1.85, 'chamSandstoneMonolith', a10X, courtY + 0.98, a10Z),
    makeReliefBox(0.32, 0.22, 0.95, 'chamSandstoneMonolith', a10X, courtY + 1.15, a10Z - 1.25),
    makeReliefCyl(0.28, 0.30, 0.85, 6, 'chamSandstoneMonolith', a10X, courtY + 1.72, a10Z)
  );
  // 322: Carved sandstone Bệ Thờ Mỹ Sơn E1 pedestal beside Group B/C (cx - 1.0, cz + 14.2)
  w2MsAtlas.push(
    makeReliefBox(3.2, 0.85, 3.2, 'chamSandstoneMonolith', cx - 1.0, courtY + 0.42, cz + 14.2),
    makeReliefBox(2.4, 0.65, 2.4, 'chamCarvedPilaster', cx - 1.0, courtY + 1.15, cz + 14.2)
  );
  // 323–324: Elevated timber-planked Archaeology Dig Walkways & viewing deck with sleepers & interpretive lectern facing Tower A1
  w2MsAtlas.push(
    makeReliefBox(14.5, 0.32, 1.65, 'splitBambooDeck', cx + 3.5, courtY + 0.16, cz + 7.2),
    makeReliefBox(1.65, 0.32, 16.0, 'splitBambooDeck', cx - 2.8, courtY + 0.16, cz - 6.8),
    makeReliefBox(3.6, 0.36, 2.8, 'splitBambooDeck', cx + 3.8, courtY + 0.18, cz + 5.8),
    makeReliefBox(0.65, 0.95, 0.48, 'tayNguyenDarkHardwood', cx + 2.4, courtY + 0.85, cz + 5.8)
  );
  for (let wp = 0; wp < 5; wp++) {
    w2MsAtlas.push(
      makeReliefCyl(0.05, 0.06, 1.25, 5, 'tayNguyenDarkHardwood', cx - 2.5 + wp * 3.2, courtY + 0.48, cz + 8.1)
    );
  }
  // 325: Active archaeological excavation grid trench with timber shoring & exposed ancient brick courses (cx + 14.2, cz - 7.5)
  const trX = cx + 14.2;
  const trZ = cz - 7.5;
  w2MsAtlas.push(
    makeReliefBox(4.2, 0.28, 0.22, 'tayNguyenDarkHardwood', trX, courtY + 0.18, trZ - 1.8),
    makeReliefBox(4.2, 0.28, 0.22, 'tayNguyenDarkHardwood', trX, courtY + 0.18, trZ + 1.8),
    makeReliefBox(3.4, 0.32, 2.8, 'chamRubbedBrick', trX, courtY + 0.08, trZ)
  );
  // 326–327: Open-air sandstone Vườn Điêu Khắc Chăm relic plinths & inventory tags along eastern path (cx + 15.8, cz + 5.5)
  for (let rs = 0; rs < 3; rs++) {
    const rz = cz + 3.2 + rs * 2.4;
    w2MsAtlas.push(
      makeReliefBox(1.15, 0.45, 1.15, 'chamSandstoneMonolith', cx + 15.8, courtY + 0.22, rz),
      makeReliefCyl(0.28, 0.34, 0.88, 6, 'chamCarvedPilaster', cx + 15.8, courtY + 0.88, rz),
      makeReliefBox(0.22, 0.35, 0.14, 'tayNguyenDarkHardwood', cx + 16.6, courtY + 0.18, rz)
    );
  }
  // 328–331: Tháp B3/B6 ruined subsidiary brick walls, A1 sacred water-drainage basin, Mandapa guardian pedestals & Kosa Grha moonstone ramp
  w2MsAtlas.push(
    makeReliefBox(4.8, 2.2, 0.72, 'chamRubbedBrick', cx - 2.0, courtY + 1.1, cz - 17.5),
    makeReliefBox(0.72, 1.85, 4.2, 'chamRubbedBrick', cx - 4.2, courtY + 0.92, cz - 15.6),
    // 329: Ancient brick-lined Chăm sacred water-drainage basin beside A1 north Somasutra
    makeReliefBox(1.85, 0.38, 1.85, 'chamRubbedBrick', cx - 1.2, courtY + 0.18, cz - 4.2),
    // 330: Sandstone Ganesha/Dvarapala guardian pedestals flanking Mandapa steps
    makeReliefBox(0.95, 1.15, 0.95, 'chamSandstoneMonolith', mX + 5.8, courtY + 0.58, cz - 1.8),
    makeReliefBox(0.95, 1.15, 0.95, 'chamSandstoneMonolith', mX + 5.8, courtY + 0.58, cz + 1.8),
    // 331: Stepped laterite ramp & sandstone moonstone leading into Kosa Grha (Tower B5)
    makeReliefCyl(1.15, 1.25, 0.24, 6, 'chamSandstoneMonolith', kosaX, courtY + 0.14, kosaZ - 2.8)
  );
  // 332–333, 339: Khe Thẻ stream footbridge handrails/abutments, mossy river boulders & purple Hoa Mua clumps
  for (const s of [-1, 1]) {
    w2MsAtlas.push(
      makeReliefBox(0.14, 0.92, 4.4, 'tayNguyenDarkHardwood', cx + 8.5 + s * 1.32, courtY + 0.78, cz + 23.5),
      makeReliefBox(2.2, 0.85, 1.65, 'volcanicBasaltRock', cx + 3.5 + s * 8.5, courtY + 0.18, cz + 22.0)
    );
    const hoaMua = new THREE.ConeGeometry(0.95, 0.75, 5);
    hoaMua.translate(cx + 8.5 + s * 3.8, courtY + 0.38, cz + 21.5);
    colorizeGeo(hoaMua, 0x6c3a82);
    w2MsLeaf.push(hoaMua);
  }
  // 334–338, 340: UNESCO visitor rest-shelter (all 4 corner posts!), site-museum kiosk, conservation table, drainage crossing, uplight boxes & trail posts
  w2MsAtlas.push(
    // 334: Visitor rest-shelter outside eastern Gopura (cx + 26.5, cz - 7.5)
    makeReliefBox(4.8, 0.24, 3.6, 'chamSandstoneMonolith', cx + 26.5, courtY + 0.12, cz - 7.5),
    makeReliefCyl(0.10, 0.12, 2.95, 5, 'tayNguyenDarkHardwood', cx + 24.4, courtY + 1.48, cz - 9.0),
    makeReliefCyl(0.10, 0.12, 2.95, 5, 'tayNguyenDarkHardwood', cx + 28.6, courtY + 1.48, cz - 9.0),
    makeReliefCyl(0.10, 0.12, 2.95, 5, 'tayNguyenDarkHardwood', cx + 24.4, courtY + 1.48, cz - 6.0),
    makeReliefCyl(0.10, 0.12, 2.95, 5, 'tayNguyenDarkHardwood', cx + 28.6, courtY + 1.48, cz - 6.0),
    makeReliefBox(5.4, 0.24, 4.2, 'nhaRongGrassThatch', cx + 26.5, courtY + 2.88, cz - 7.5),
    // 335: Site-museum information kiosk (cx + 27.5, cz + 7.5)
    makeReliefBox(4.4, 2.6, 3.2, 'tayNguyenDarkHardwood', cx + 27.5, courtY + 1.35, cz + 7.5),
    makeReliefBox(5.0, 0.35, 3.8, 'nhaRongGrassThatch', cx + 27.5, courtY + 2.82, cz + 7.5),
    // 336: Sandstone conservation table under protective shelter
    makeReliefBox(1.85, 0.72, 1.05, 'chamSandstoneMonolith', shX + 0.6, courtY + 0.36, shZ),
    // 337–338, 340: Causeway stepping crossing, angled uplight housings at A1 portal & directional trail posts
    makeReliefBox(1.85, 0.16, 4.8, 'chamSandstoneMonolith', gopX + 4.5, courtY + 0.08, cz),
    makeReliefBox(0.38, 0.26, 0.38, 'chamSandstoneMonolith', portalX + 3.2, courtY + 0.14, cz - 2.2),
    makeReliefBox(0.38, 0.26, 0.38, 'chamSandstoneMonolith', portalX + 3.2, courtY + 0.14, cz + 2.2),
    makeReliefCyl(0.08, 0.09, 1.55, 5, 'tayNguyenDarkHardwood', cx + 14.5, courtY + 0.78, cz + 2.8)
  );

  const w2MsAtlasMesh = createMergedMesh('MySonWave2Atlas', w2MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w2MsAtlasMesh) group.add(w2MsAtlasMesh);
  const w2MsLeafMesh = createMergedMesh('MySonWave2Leaf', w2MsLeaf, foliageMat, false, false);
  if (w2MsLeafMesh) group.add(w2MsLeafMesh);

  // ==========================================================================
  // WAVE 3 UPGRADES (Items 641–680): Group C1 Kalan, Group D Brick Colonnade
  // & Sandstone Lintels, Group B Enclosure, Walkway Spurs & Jungle Canopy
  // ==========================================================================
  const w3MsAtlas: THREE.BufferGeometry[] = [];
  const w3MsLeaf: THREE.BufferGeometry[] = [];

  // 641–644: Khu C (Group C1 Sanctuary Kalan) at (cx - 17.5, cz + 6.2 — clear of subsidiary towers!) with deep retaining skirt, sandstone lintel, tiered Sikhara & interior Yoni
  const c1X = cx - 17.5;
  const c1Z = cz + 6.2;
  const c1Y = Math.max(
    ctx.getHeight(c1X, c1Z),
    ctx.getHeight(c1X - 3.6, c1Z - 3.6),
    ctx.getHeight(c1X + 3.6, c1Z - 3.6),
    ctx.getHeight(c1X - 3.6, c1Z + 3.6),
    ctx.getHeight(c1X + 3.6, c1Z + 3.6)
  );
  w3MsAtlas.push(
    makeReliefBox(7.2, 6.2, 7.2, 'chamRubbedBrick', c1X, c1Y - 2.9, c1Z),
    makeReliefBox(5.8, 4.4, 5.8, 'chamRubbedBrick', c1X, c1Y + 2.35, c1Z),
    // 642: East corbelled portal & carved sandstone lintel slab
    makeReliefBox(2.0, 3.2, 2.6, 'chamRubbedBrick', c1X + 3.2, c1Y + 1.75, c1Z),
    makeReliefBox(0.65, 0.58, 2.8, 'chamSandstoneMonolith', c1X + 4.15, c1Y + 2.95, c1Z),
    // 643: Tiered brick Sikhara upper stories & 4 corner Tháp Góc spires
    makeReliefBox(4.6, 2.4, 4.6, 'chamRubbedBrick', c1X, c1Y + 5.65, c1Z),
    makeReliefBox(3.2, 2.0, 3.2, 'chamRubbedBrick', c1X, c1Y + 7.75, c1Z),
    makeReliefCyl(0.18, 1.45, 2.2, 4, 'chamCarvedPilaster', c1X, c1Y + 9.75, c1Z, Math.PI * 0.25),
    // 644: Interior sandstone Yoni pedestal visible at east portal
    makeReliefBox(1.15, 0.55, 1.15, 'chamSandstoneMonolith', c1X + 2.4, c1Y + 0.45, c1Z)
  );
  for (const sx of [-2.2, 2.2]) {
    for (const sz of [-2.2, 2.2]) {
      w3MsAtlas.push(makeReliefCyl(0.12, 0.45, 1.35, 4, 'chamRubbedBrick', c1X + sx, c1Y + 5.15, c1Z + sz, Math.PI * 0.25));
    }
  }

  // 645–648: Khu D (Group D Long Mandapa) ruined brick colonnade hall (cx - 17.5, cz - 5.5 — clear of subsidiary towers!) with 8 fluted brick pillars & sandstone architrave lintels
  const d1X = cx - 17.5;
  const d1Z = cz - 5.5;
  const d1Y = Math.max(
    ctx.getHeight(d1X, d1Z),
    ctx.getHeight(d1X - 4.4, d1Z - 3.0),
    ctx.getHeight(d1X + 4.4, d1Z - 3.0),
    ctx.getHeight(d1X - 4.4, d1Z + 3.0),
    ctx.getHeight(d1X + 4.4, d1Z + 3.0)
  );
  w3MsAtlas.push(
    makeReliefBox(9.6, 6.2, 6.2, 'chamRubbedBrick', d1X, d1Y - 2.9, d1Z),
    // 647: Carved sandstone architrave lintel beams spanning across brick colonnade bays
    makeReliefBox(8.6, 0.48, 0.65, 'chamSandstoneMonolith', d1X, d1Y + 3.45, d1Z - 2.0),
    makeReliefBox(8.6, 0.48, 0.65, 'chamSandstoneMonolith', d1X, d1Y + 3.45, d1Z + 2.0),
    // 648: Carved sandstone Tympanum relief slab on conservation cradle
    makeReliefBox(1.65, 1.15, 0.42, 'chamCarvedPilaster', d1X + 5.4, d1Y + 0.72, d1Z)
  );
  // 646: 8 fluted brick colonnade pillars embedded -0.15m into plinth & connecting cleanly to sandstone lintels
  for (let cp = 0; cp < 4; cp++) {
    const px = d1X - 3.3 + cp * 2.2;
    w3MsAtlas.push(
      makeReliefBox(0.58, 3.55, 0.58, 'chamRubbedBrick', px, d1Y + 1.65, d1Z - 2.0),
      makeReliefBox(0.58, 3.55, 0.58, 'chamRubbedBrick', px, d1Y + 1.65, d1Z + 2.0)
    );
  }

  // 649–663: Group B enclosure wall & Gopura, A1 sandstone Kala tympanum/lintels/Makara spouts, A10 steles,
  // Group A west wall, Mandapa piers/lintel, Kosa Grha ridge crest, Gopura jambs/stairs & Group E1 stupa ruins
  w3MsAtlas.push(
    // 649–651: Group B brick enclosure wall, Gopura gateway & B4 Somasutra catch basin
    makeReliefBox(8.6, 1.85, 0.68, 'chamRubbedBrick', cx + 12.0, courtY + 0.92, cz + 17.2),
    makeReliefBox(2.4, 2.85, 1.15, 'chamRubbedBrick', cx + 12.0, courtY + 1.42, cz + 17.2),
    makeReliefBox(2.6, 0.42, 1.25, 'chamSandstoneMonolith', cx + 12.0, courtY + 2.85, cz + 17.2),
    makeReliefBox(1.15, 0.36, 1.15, 'chamSandstoneMonolith', cx + 14.8, courtY + 0.18, cz + 11.8),
    // 652–654: Tower A1 sandstone Kala tympanum, blind-doorway lintels & corner Makara spouts
    makeReliefBox(0.45, 0.95, 2.2, 'chamCarvedPilaster', portalX + 1.2, courtY + 4.45, cz),
    makeReliefBox(2.2, 0.45, 0.42, 'chamSandstoneMonolith', cx, courtY + 3.65, cz - 4.4),
    makeReliefBox(2.2, 0.45, 0.42, 'chamSandstoneMonolith', cx, courtY + 3.65, cz + 4.4),
    makeReliefBox(0.65, 0.32, 0.45, 'chamSandstoneMonolith', cx + 4.4, courtY + 6.45, cz - 4.4),
    makeReliefBox(0.65, 0.32, 0.45, 'chamSandstoneMonolith', cx + 4.4, courtY + 6.45, cz + 4.4),
    // 655–656: Group A10 brick curb + 4 corner steles & Group A west ruined brick enclosure wall
    makeReliefBox(5.2, 0.28, 5.2, 'chamRubbedBrick', a10X, courtY + 0.14, a10Z),
    makeReliefBox(0.68, 1.65, 9.6, 'chamRubbedBrick', cx - 10.2, courtY + 0.82, cz),
    // 657–658: Mandapa interior brick piers & carved sandstone entrance lintel + cheek walls
    makeReliefBox(0.55, 0.45, 2.6, 'chamSandstoneMonolith', mX + 4.6, courtY + 3.15, cz),
    makeReliefBox(1.65, 0.65, 0.38, 'chamSandstoneMonolith', mX + 5.2, courtY + 0.32, cz - 1.35),
    makeReliefBox(1.65, 0.65, 0.38, 'chamSandstoneMonolith', mX + 5.2, courtY + 0.32, cz + 1.35),
    // 659–660: Kosa Grha (Tower B5) boat-shaped ridge cresting & sandstone base molding
    makeReliefBox(3.8, 0.26, 0.24, 'chamCarvedPilaster', kosaX, courtY + 5.42, kosaZ),
    // 661–663: Gopura carved sandstone lintel/stairs & Group E1 miniature brick stupa ruins
    makeReliefBox(0.62, 0.48, 2.8, 'chamSandstoneMonolith', gopX + 1.2, courtY + 3.25, cz),
    makeReliefBox(1.85, 0.42, 3.2, 'chamRubbedBrick', gopX + 2.4, courtY + 0.21, cz),
    makeReliefBox(1.45, 1.65, 1.45, 'chamRubbedBrick', cx - 3.6, courtY + 0.82, cz + 14.2)
  );
  for (const sx of [-2.4, 2.4]) {
    for (const sz of [-2.4, 2.4]) {
      w3MsAtlas.push(makeReliefCyl(0.14, 0.18, 0.88, 5, 'chamSandstoneMonolith', a10X + sx, courtY + 0.44, a10Z + sz));
    }
  }

  // 664–680: Archaeological wooden walkway spurs to Group C1 & D1, Sculpture Garden extra plinths & 4-post awning,
  // Bia Ký Chăm canopy, Khe Thẻ stepping-stone ford, benches, uplights & jungle canopy trees
  w3MsAtlas.push(
    // 664–665: Elevated wooden walkway spurs connecting to Group C1 & Group D colonnade
    makeReliefBox(8.2, 0.28, 1.55, 'splitBambooDeck', cx - 7.5, courtY + 0.14, cz + 8.0),
    makeReliefBox(8.2, 0.28, 1.55, 'splitBambooDeck', cx - 7.5, courtY + 0.14, cz - 8.0),
    // 668: Sculpture Garden 4-post timber shade awning protecting delicate sandstone lintels
    makeReliefBox(3.4, 0.16, 4.6, 'nhaRongGrassThatch', cx + 15.8, courtY + 2.68, cz + 5.5),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'tayNguyenDarkHardwood', cx + 14.3, courtY + 1.32, cz + 3.4),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'tayNguyenDarkHardwood', cx + 17.3, courtY + 1.32, cz + 3.4),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'tayNguyenDarkHardwood', cx + 14.3, courtY + 1.32, cz + 7.6),
    makeReliefCyl(0.08, 0.09, 2.75, 5, 'tayNguyenDarkHardwood', cx + 17.3, courtY + 1.32, cz + 7.6),
    // 669: Excavation trench corner stakes & shade frame
    makeReliefCyl(0.05, 0.06, 1.85, 5, 'tayNguyenDarkHardwood', trX - 1.8, courtY + 0.92, trZ - 1.6),
    makeReliefCyl(0.05, 0.06, 1.85, 5, 'tayNguyenDarkHardwood', trX + 1.8, courtY + 0.92, trZ - 1.6),
    // 670: Bia Ký Chăm protective 4-post thatched canopy beside Mandapa
    makeReliefBox(2.2, 0.16, 2.2, 'nhaRongGrassThatch', mX + 1.2, courtY + 2.45, cz - 4.8),
    makeReliefCyl(0.07, 0.08, 2.55, 5, 'tayNguyenDarkHardwood', mX + 0.2, courtY + 1.20, cz - 5.8),
    makeReliefCyl(0.07, 0.08, 2.55, 5, 'tayNguyenDarkHardwood', mX + 2.2, courtY + 1.20, cz - 5.8),
    makeReliefCyl(0.07, 0.08, 2.55, 5, 'tayNguyenDarkHardwood', mX + 0.2, courtY + 1.20, cz - 3.8),
    makeReliefCyl(0.07, 0.08, 2.55, 5, 'tayNguyenDarkHardwood', mX + 2.2, courtY + 1.20, cz - 3.8),
    // 673–678: Rest-shelter benches, site-museum stone entry, causeway curbs, fallen fragments, UNESCO benches & uplights
    makeReliefBox(2.4, 0.45, 0.55, 'tayNguyenDarkHardwood', cx + 26.5, courtY + 0.45, cz - 8.8),
    makeReliefBox(2.2, 0.32, 1.45, 'chamSandstoneMonolith', cx + 24.8, courtY + 0.16, cz + 7.5),
    makeReliefBox(1.85, 0.46, 0.52, 'tayNguyenDarkHardwood', cx - 6.8, courtY + 0.23, cz + 2.2),
    makeReliefBox(1.15, 0.48, 0.85, 'chamSandstoneMonolith', cx - 12.2, courtY + 0.24, cz + 1.8),
    makeReliefBox(0.38, 0.26, 0.38, 'chamSandstoneMonolith', c1X + 5.2, c1Y + 0.14, c1Z),
    makeReliefBox(0.38, 0.26, 0.38, 'chamSandstoneMonolith', d1X + 5.2, d1Y + 0.14, d1Z)
  );
  // 666: Rope barrier posts along C/D spurs & 671 Khe Thẻ stepping-stone ford
  for (let sp = 0; sp < 3; sp++) {
    w3MsAtlas.push(
      makeReliefCyl(0.05, 0.06, 1.15, 5, 'tayNguyenDarkHardwood', cx - 10.5 + sp * 3.0, courtY + 0.48, cz + 8.9),
      makeReliefCyl(0.05, 0.06, 1.15, 5, 'tayNguyenDarkHardwood', cx - 10.5 + sp * 3.0, courtY + 0.48, cz - 8.9),
      makeReliefCyl(0.45, 0.52, 0.28, 6, 'volcanicBasaltRock', cx + 14.5 + sp * 1.15, courtY + 0.12, cz + 23.5)
    );
  }
  // 679–680: Giant tree ferns & towering Chò Chỉ jungle canopy trees framing Group C/D valley backdrop (deeply rooted -1.2m into slope & >= 6m clear of ruins!)
  for (const [tx, tz] of [[cx - 29.5, cz + 14.0], [cx - 29.5, cz - 13.0], [cx - 29.0, cz]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w3MsAtlas.push(makeReliefCyl(0.24, 0.34, 7.4, 5, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.2, 4.8, 5).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w3MsLeaf.push(canopy);
    const fern = new THREE.ConeGeometry(1.15, 0.85, 5).translate(tx + 1.8, ty + 0.42, tz);
    colorizeGeo(fern, 0x2f6b2a);
    w3MsLeaf.push(fern);
  }

  const w3MsAtlasMesh = createMergedMesh('MySonWave3Atlas', w3MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w3MsAtlasMesh) group.add(w3MsAtlasMesh);
  const w3MsLeafMesh = createMergedMesh('MySonWave3Leaf', w3MsLeaf, foliageMat, false, false);
  if (w3MsLeafMesh) group.add(w3MsLeafMesh);

  // ==========================================================================
  // WAVE 4 UPGRADES (Items 1041–1080): Group H & Group K Ruin Clusters,
  // Conservation Lapidarium, Khe Thẻ West Bridge & Cham Cultural Stage
  // ==========================================================================
  const w4MsAtlas: THREE.BufferGeometry[] = [];
  const w4MsLeaf: THREE.BufferGeometry[] = [];

  // 1041–1043: Khu Tháp H (Group H Ruined Brick Sanctuary) south-west of Group C1 (cx - 17.5, cz + 16.8)
  const hX = cx - 17.5;
  const hZ = cz + 16.8;
  const hY = Math.max(ctx.getHeight(hX, hZ), ctx.getHeight(hX - 3.2, hZ - 3.2), ctx.getHeight(hX + 3.2, hZ + 3.2));
  w4MsAtlas.push(
    makeReliefBox(6.4, 5.8, 6.4, 'chamRubbedBrick', hX, hY - 2.7, hZ),
    makeReliefBox(1.25, 3.6, 1.25, 'chamRubbedBrick', hX - 2.1, hY + 2.0, hZ - 2.1),
    makeReliefBox(1.25, 3.2, 1.25, 'chamRubbedBrick', hX - 2.1, hY + 1.8, hZ + 2.1),
    makeReliefBox(0.65, 2.8, 0.55, 'chamSandstoneMonolith', hX + 2.2, hY + 1.6, hZ - 1.0),
    makeReliefBox(0.65, 2.8, 0.55, 'chamSandstoneMonolith', hX + 2.2, hY + 1.6, hZ + 1.0),
    makeReliefBox(1.25, 0.58, 1.25, 'chamSandstoneMonolith', hX, hY + 0.48, hZ)
  );

  // 1044–1046: Khu Tháp K (Group K Entrance Sanctuary Gate-Tower at cx + 31.5, cz - 1.5)
  const kX = cx + 31.5;
  const kZ = cz - 1.5;
  const kY = Math.max(ctx.getHeight(kX, kZ), ctx.getHeight(kX - 2.8, kZ - 2.8), ctx.getHeight(kX + 2.8, kZ + 2.8));
  w4MsAtlas.push(
    makeReliefBox(5.6, 5.6, 5.6, 'chamRubbedBrick', kX, kY - 2.6, kZ),
    makeReliefBox(4.4, 3.6, 1.15, 'chamRubbedBrick', kX, kY + 2.0, kZ - 1.6),
    makeReliefBox(4.4, 3.6, 1.15, 'chamRubbedBrick', kX, kY + 2.0, kZ + 1.6),
    makeReliefBox(4.6, 0.52, 4.6, 'chamSandstoneMonolith', kX, kY + 3.95, kZ),
    makeReliefBox(3.4, 1.65, 3.4, 'chamRubbedBrick', kX, kY + 4.95, kZ),
    makeReliefCyl(0.16, 1.45, 1.65, 4, 'chamCarvedPilaster', kX, kY + 6.55, kZ, Math.PI * 0.25),
    makeReliefBox(0.85, 0.85, 0.85, 'chamSandstoneMonolith', kX + 3.6, kY + 0.45, kZ - 2.2),
    makeReliefBox(0.85, 0.85, 0.85, 'chamSandstoneMonolith', kX + 3.6, kY + 0.45, kZ + 2.2)
  );

  // 1047–1049: Nhà Trưng Bày Điêu Khắc Mỹ Sơn (Open-Air Conservation Lapidarium Pavilion at cx + 27.5, cz - 15.5)
  const lapX = cx + 27.5;
  const lapZ = cz - 15.5;
  const lapY = Math.max(ctx.getHeight(lapX, lapZ), ctx.getHeight(lapX - 4.0, lapZ - 2.8), ctx.getHeight(lapX + 4.0, lapZ + 2.8));
  w4MsAtlas.push(
    makeReliefBox(8.4, 5.4, 5.8, 'chamSandstoneMonolith', lapX, lapY - 2.5, lapZ),
    makeReliefBox(8.2, 0.26, 5.6, 'nhaRongGrassThatch', lapX, lapY + 3.25, lapZ)
  );
  for (const lxO of [-3.6, 0, 3.6]) {
    for (const lzO of [-2.4, 2.4]) {
      w4MsAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 5, 'tayNguyenDarkHardwood', lapX + lxO, lapY + 1.62, lapZ + lzO));
    }
  }
  for (let st = 0; st < 4; st++) {
    w4MsAtlas.push(
      makeReliefBox(0.95, 0.55, 0.95, 'chamSandstoneMonolith', lapX - 2.7 + st * 1.8, lapY + 0.45, lapZ),
      makeReliefBox(0.65, 1.15, 0.32, 'chamCarvedPilaster', lapX - 2.7 + st * 1.8, lapY + 1.25, lapZ)
    );
  }

  // 1050–1080: Group A2/C2 pedestals, Group D conservation awning, Khe Thẻ west bridge, boardwalk loop,
  // Cham cultural stage, brick restoration worktable, UNESCO granite monument & distant dipterocarp trees
  w4MsAtlas.push(
    // 1050 & 1054: Subsidiary A2 & C2 brick altar pedestals
    makeReliefBox(2.8, 0.75, 2.8, 'chamRubbedBrick', cx - 13.5, courtY + 0.38, cz + 0.2),
    makeReliefBox(2.6, 0.72, 2.6, 'chamRubbedBrick', cx - 17.5, courtY + 0.36, cz + 11.8),
    // 1056: Group D central protective timber awning (4 grounded posts)
    makeReliefBox(4.8, 0.18, 4.4, 'nhaRongGrassThatch', d1X, d1Y + 4.35, d1Z),
    makeReliefCyl(0.08, 0.09, 4.35, 5, 'tayNguyenDarkHardwood', d1X - 2.2, d1Y + 2.15, d1Z - 2.0),
    makeReliefCyl(0.08, 0.09, 4.35, 5, 'tayNguyenDarkHardwood', d1X + 2.2, d1Y + 2.15, d1Z - 2.0),
    makeReliefCyl(0.08, 0.09, 4.35, 5, 'tayNguyenDarkHardwood', d1X - 2.2, d1Y + 2.15, d1Z + 2.0),
    makeReliefCyl(0.08, 0.09, 4.35, 5, 'tayNguyenDarkHardwood', d1X + 2.2, d1Y + 2.15, d1Z + 2.0),
    // 1062–1063: UNESCO granite monument stele & Khe Thẻ western timber footbridge (cx - 8.5, cz + 23.5)
    makeReliefBox(1.35, 2.1, 0.42, 'chamSandstoneMonolith', cx + 24.5, courtY + 1.05, cz + 3.2),
    makeReliefBox(2.8, 0.22, 4.4, 'tayNguyenDarkHardwood', cx - 8.5, courtY + 0.25, cz + 23.5),
    makeReliefBox(0.14, 0.92, 4.4, 'tayNguyenDarkHardwood', cx - 9.8, courtY + 0.78, cz + 23.5),
    makeReliefBox(0.14, 0.92, 4.4, 'tayNguyenDarkHardwood', cx - 7.2, courtY + 0.78, cz + 23.5),
    // 1066 & 1068: Boardwalk loop to Group H & restoration brick worktable
    makeReliefBox(1.55, 0.24, 9.2, 'splitBambooDeck', cx - 12.5, courtY + 0.12, cz + 12.5),
    makeReliefBox(2.2, 0.78, 1.15, 'tayNguyenDarkHardwood', cx + 18.5, courtY + 0.42, cz - 12.5),
    makeReliefBox(1.25, 0.55, 0.85, 'chamRubbedBrick', cx + 18.5, courtY + 1.05, cz - 12.5),
    // 1075–1076: Cham Cultural Stage timber platform & 4-post thatched awning outside eastern gate (cx + 31.5, cz + 10.5)
    makeReliefBox(6.8, 0.42, 5.2, 'splitBambooDeck', cx + 31.5, courtY + 0.22, cz + 10.5),
    makeReliefBox(6.4, 0.22, 4.6, 'nhaRongGrassThatch', cx + 31.5, courtY + 3.25, cz + 10.5),
    makeReliefCyl(0.09, 0.11, 3.15, 5, 'tayNguyenDarkHardwood', cx + 28.5, courtY + 1.72, cz + 8.4),
    makeReliefCyl(0.09, 0.11, 3.15, 5, 'tayNguyenDarkHardwood', cx + 34.5, courtY + 1.72, cz + 8.4),
    makeReliefCyl(0.09, 0.11, 3.15, 5, 'tayNguyenDarkHardwood', cx + 28.5, courtY + 1.72, cz + 12.6),
    makeReliefCyl(0.09, 0.11, 3.15, 5, 'tayNguyenDarkHardwood', cx + 34.5, courtY + 1.72, cz + 12.6)
  );
  // 1079–1080: Outer valley tree ferns & dipterocarp canopy trees (>= 7m clear of all ruins!)
  for (const [tx, tz] of [[cx - 28.5, cz + 22.0], [cx + 38.5, cz - 16.0], [cx + 39.0, cz + 15.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w4MsAtlas.push(makeReliefCyl(0.24, 0.34, 7.6, 5, 'tayNguyenDarkHardwood', tx, ty + 2.6, tz));
    const canopy = new THREE.ConeGeometry(3.2, 4.8, 5).translate(tx, ty + 7.4, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w4MsLeaf.push(canopy);
  }

  const w4MsAtlasMesh = createMergedMesh('MySonWave4Atlas', w4MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w4MsAtlasMesh) group.add(w4MsAtlasMesh);
  const w4MsLeafMesh = createMergedMesh('MySonWave4Leaf', w4MsLeaf, foliageMat, false, false);
  if (w4MsLeafMesh) group.add(w4MsLeafMesh);

  // ==========================================================================
  // WAVE 5 UPGRADES (Items 1441–1480): Group B–C Brick Gopura Gateway,
  // Cham Sanskrit Sandstone Stele Sanctuary, Museum Boardwalk & Shuttle Pergola
  // ==========================================================================
  const w5MsAtlas: THREE.BufferGeometry[] = [];
  const w5MsLeaf: THREE.BufferGeometry[] = [];

  // 1441–1446: Cổng Gopura Nhóm B–C (Restored Cham Brick Gateway Arch at cx + 12.5, cz - 4.5)
  const w5GopX = cx + 12.5;
  const w5GopZ = cz - 4.5;
  const w5GopY = Math.max(ctx.getHeight(w5GopX, w5GopZ), ctx.getHeight(w5GopX - 2.6, w5GopZ - 2.6), ctx.getHeight(w5GopX + 2.6, w5GopZ + 2.6));
  w5MsAtlas.push(
    makeReliefBox(5.4, 5.2, 5.4, 'chamRubbedBrick', w5GopX, w5GopY - 2.45, w5GopZ),
    makeReliefBox(1.25, 3.6, 1.35, 'chamRubbedBrick', w5GopX, w5GopY + 1.95, w5GopZ - 1.55),
    makeReliefBox(1.25, 3.6, 1.35, 'chamRubbedBrick', w5GopX, w5GopY + 1.95, w5GopZ + 1.55),
    makeReliefBox(1.65, 0.58, 4.6, 'chamSandstoneMonolith', w5GopX, w5GopY + 3.98, w5GopZ),
    makeReliefBox(3.4, 1.55, 3.4, 'chamRubbedBrick', w5GopX, w5GopY + 4.95, w5GopZ),
    makeReliefCyl(0.18, 1.45, 1.65, 4, 'chamCarvedPilaster', w5GopX, w5GopY + 6.50, w5GopZ, Math.PI * 0.25),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', w5GopX + 2.4, w5GopY + 0.52, w5GopZ - 2.0),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', w5GopX + 2.4, w5GopY + 0.52, w5GopZ + 2.0)
  );

  // 1447–1451: Khu Bia Ký Chăm Pa (Cham Sanskrit Sandstone Stele Sanctuary at cx + 21.0, cz - 14.5)
  const stX = cx + 21.0;
  const stZ = cz - 14.5;
  const stY = Math.max(ctx.getHeight(stX, stZ), ctx.getHeight(stX - 3.0, stZ - 2.5), ctx.getHeight(stX + 3.0, stZ + 2.5));
  w5MsAtlas.push(
    makeReliefBox(6.4, 5.2, 5.4, 'chamSandstoneMonolith', stX, stY - 2.45, stZ),
    makeReliefBox(6.0, 0.24, 5.0, 'nhaRongGrassThatch', stX, stY + 3.25, stZ),
    // 1449–1450: 3 carved Sanskrit sandstone steles & central Yoni-Linga altar
    makeReliefBox(0.65, 1.85, 0.26, 'chamCarvedPilaster', stX - 1.8, stY + 1.05, stZ - 0.8),
    makeReliefBox(0.65, 2.05, 0.26, 'chamCarvedPilaster', stX, stY + 1.15, stZ - 0.8),
    makeReliefBox(0.65, 1.85, 0.26, 'chamCarvedPilaster', stX + 1.8, stY + 1.05, stZ - 0.8),
    makeReliefBox(1.15, 0.52, 1.15, 'chamSandstoneMonolith', stX, stY + 0.40, stZ + 1.0),
    makeReliefCyl(0.18, 0.22, 0.75, 6, 'chamSandstoneMonolith', stX, stY + 0.95, stZ + 1.0)
  );
  for (const ox of [-2.6, 2.6]) {
    for (const oz of [-2.1, 2.1]) {
      w5MsAtlas.push(makeReliefCyl(0.09, 0.11, 3.25, 5, 'tayNguyenDarkHardwood', stX + ox, stY + 1.62, stZ + oz));
    }
  }

  // 1452–1456: Lối Đi Bảo Tàng & Shaded Rest-Bench Pavilion (cx + 22.0, cz + 14.5 .. 20.5)
  const mbX = cx + 22.0;
  const mbZ = cz + 14.5;
  w5MsAtlas.push(
    makeReliefBox(1.85, 0.24, 10.5, 'splitBambooDeck', mbX, courtY + 0.24, mbZ),
    makeReliefBox(0.10, 0.92, 10.5, 'tayNguyenDarkHardwood', mbX - 0.88, courtY + 0.78, mbZ),
    makeReliefBox(0.10, 0.92, 10.5, 'tayNguyenDarkHardwood', mbX + 0.88, courtY + 0.78, mbZ),
    // 1454: 4-post visitor rest-bench pavilion at boardwalk south end
    makeReliefBox(4.2, 0.22, 3.4, 'nhaRongGrassThatch', mbX, courtY + 3.10, mbZ + 6.2),
    makeReliefBox(2.4, 0.46, 0.58, 'tayNguyenDarkHardwood', mbX, courtY + 0.45, mbZ + 6.2),
    // 1455–1456: Interpretive lectern posts & Khe Thẻ stepping-stone ford
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', mbX - 1.8, courtY + 0.65, mbZ - 3.2),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', mbX - 1.8, courtY + 0.65, mbZ + 1.5),
    makeReliefCyl(0.55, 0.62, 0.35, 6, 'volcanicBasaltRock', cx - 4.5, courtY + 0.12, cz + 23.5),
    makeReliefCyl(0.55, 0.62, 0.35, 6, 'volcanicBasaltRock', cx - 2.5, courtY + 0.12, cz + 23.5)
  );
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.4, 1.4]) {
      w5MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 5, 'tayNguyenDarkHardwood', mbX + ox, courtY + 1.55, mbZ + 6.2 + oz));
    }
  }

  // 1457–1480: Group A/B/C/D/G/H/K conservation details, Shuttle Waiting Pergola (cx + 35.5, cz + 2.5),
  // Lapidarium pillar capitals, trail milestones & distant dipterocarp valley trees
  const w5ShX = cx + 35.5;
  const w5ShZ = cz + 2.5;
  const w5ShY = Math.max(ctx.getHeight(w5ShX, w5ShZ), ctx.getHeight(w5ShX - 2.6, w5ShZ - 2.0), ctx.getHeight(w5ShX + 2.6, w5ShZ + 2.0));
  w5MsAtlas.push(
    makeReliefBox(5.6, 5.2, 4.4, 'chamSandstoneMonolith', w5ShX, w5ShY - 2.45, w5ShZ),
    makeReliefBox(5.4, 0.24, 4.2, 'nhaRongGrassThatch', w5ShX, w5ShY + 3.15, w5ShZ),
    makeReliefBox(2.8, 0.46, 0.56, 'tayNguyenDarkHardwood', w5ShX, w5ShY + 0.45, w5ShZ - 0.8),
    makeReliefBox(2.8, 0.46, 0.56, 'tayNguyenDarkHardwood', w5ShX, w5ShY + 0.45, w5ShZ + 0.8),
    // 1457–1464: Kala tympanum plinth, B5 offering table, C1 Nandi pedestal, H survey bench & K flagstones
    makeReliefBox(1.15, 1.25, 0.42, 'chamCarvedPilaster', cx - 10.2, courtY + 0.68, cz - 3.5),
    makeReliefBox(1.35, 0.68, 0.95, 'chamSandstoneMonolith', cx + 4.5, courtY + 0.36, cz + 6.2),
    makeReliefBox(1.45, 0.72, 1.05, 'chamSandstoneMonolith', cx - 12.2, courtY + 0.38, cz + 8.5),
    makeReliefBox(1.85, 0.75, 0.85, 'tayNguyenDarkHardwood', hX + 4.6, hY + 0.42, hZ),
    makeReliefBox(2.4, 0.24, 2.4, 'chamSandstoneMonolith', kX + 4.8, kY + 0.14, kZ),
    // 1467–1470: Cultural stage lamp pedestals, Lapidarium lotus capitals & site-map monolith
    makeReliefCyl(0.28, 0.34, 1.15, 6, 'chamRubbedBrick', cx + 27.5, courtY + 0.58, cz + 10.5),
    makeReliefCyl(0.28, 0.34, 1.15, 6, 'chamRubbedBrick', cx + 35.5, courtY + 0.58, cz + 10.5),
    makeReliefBox(1.25, 1.75, 0.38, 'chamSandstoneMonolith', lapX - 5.2, lapY + 0.95, lapZ + 2.2),
    // 1471–1474: 4 sandstone trail milestone markers
    makeReliefBox(0.45, 1.05, 0.45, 'chamSandstoneMonolith', cx + 26.0, courtY + 0.52, cz - 2.5),
    makeReliefBox(0.45, 1.05, 0.45, 'chamSandstoneMonolith', cx + 16.5, courtY + 0.52, cz + 4.5),
    makeReliefBox(0.45, 1.05, 0.45, 'chamSandstoneMonolith', cx - 6.5, courtY + 0.52, cz + 16.5),
    makeReliefBox(0.45, 1.05, 0.45, 'chamSandstoneMonolith', cx + 8.5, courtY + 0.52, cz - 12.5)
  );
  for (const ox of [-2.3, 2.3]) {
    for (const oz of [-1.7, 1.7]) {
      w5MsAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 5, 'tayNguyenDarkHardwood', w5ShX + ox, w5ShY + 1.58, w5ShZ + oz));
    }
  }
  for (let lc = 0; lc < 4; lc++) {
    w5MsAtlas.push(makeReliefCyl(0.36, 0.28, 0.58, 6, 'chamCarvedPilaster', lapX - 2.7 + lc * 1.8, lapY + 0.42, lapZ + 3.6));
  }
  // 1480: Distant outer dipterocarp valley canopy trees (>= 9m clear of all ruins!)
  for (const [tx, tz] of [[cx + 44.0, cz - 6.0], [cx - 29.0, cz + 6.0], [cx + 28.0, cz + 26.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w5MsAtlas.push(makeReliefCyl(0.24, 0.34, 7.6, 5, 'tayNguyenDarkHardwood', tx, ty + 2.6, tz));
    const canopy = new THREE.ConeGeometry(3.2, 4.8, 5).translate(tx, ty + 7.4, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w5MsLeaf.push(canopy);
  }

  const w5MsAtlasMesh = createMergedMesh('MySonWave5Atlas', w5MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w5MsAtlasMesh) group.add(w5MsAtlasMesh);
  const w5MsLeafMesh = createMergedMesh('MySonWave5Leaf', w5MsLeaf, foliageMat, false, false);
  if (w5MsLeafMesh) group.add(w5MsLeafMesh);

  // ==========================================================================
  // WAVE 6 UPGRADES (Items 1841–1880): Archaeological Lapidary Sculpture Garden,
  // West Suối Khe Thẻ Timber Creek Bridge, Sandstone Lintel Displays & Trails
  // ==========================================================================
  const w6MsAtlas: THREE.BufferGeometry[] = [];
  const w6MsLeaf: THREE.BufferGeometry[] = [];

  // 1841–1848: Vườn Biểu Tượng & Điêu Khắc Mỹ Sơn (Lapidary Sculpture Garden at cx + 30.5, cz - 14.5)
  const lgX = cx + 30.5;
  const lgZ = cz - 14.5;
  const lgY = Math.max(ctx.getHeight(lgX, lgZ), ctx.getHeight(lgX - 3.6, lgZ - 3.2), ctx.getHeight(lgX + 3.6, lgZ + 3.2));
  w6MsAtlas.push(
    makeReliefBox(7.6, 5.6, 6.8, 'chamSandstoneMonolith', lgX, lgY - 2.65, lgZ),
    // 1845–1848: Central 4-post conservation canopy, Apsara relief stele, perimeter rail & lectern
    makeReliefBox(3.8, 0.22, 3.4, 'nhaRongGrassThatch', lgX, lgY + 3.10, lgZ),
    makeReliefBox(0.72, 2.05, 0.30, 'chamCarvedPilaster', lgX, lgY + 1.15, lgZ),
    makeReliefBox(7.2, 0.10, 0.10, 'tayNguyenDarkHardwood', lgX, lgY + 0.95, lgZ + 3.2),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', lgX - 2.4, lgY + 0.65, lgZ + 3.6)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w6MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 4, 'tayNguyenDarkHardwood', lgX + ox, lgY + 1.55, lgZ + oz));
    }
  }
  // 1842–1844: 6 carved sandstone lintel & tympanum artifact plinths in 2 museum rows
  for (let lp = 0; lp < 6; lp++) {
    const px = lgX - 2.6 + (lp % 3) * 2.6;
    const pz = lgZ + (lp < 3 ? -2.2 : 2.2);
    w6MsAtlas.push(makeReliefBox(1.15, 0.72, 0.65, 'chamCarvedPilaster', px, lgY + 0.45, pz));
  }

  // 1849–1856: Cầu Gỗ Suối Khe Thẻ Tây (West Khe Thẻ Timber Creek Footbridge at cx - 10.5, cz + 23.5)
  const kbX = cx - 10.5;
  const kbZ = cz + 23.5;
  w6MsAtlas.push(
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', kbX - 4.0, courtY + 0.15, kbZ),
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', kbX + 4.0, courtY + 0.15, kbZ),
    makeReliefBox(8.2, 0.24, 2.2, 'splitBambooDeck', kbX, courtY + 0.85, kbZ),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', kbX, courtY + 1.75, kbZ - 1.0),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', kbX, courtY + 1.75, kbZ + 1.0),
    // 1852–1856: South-bank 4-post trailhead rest shelter, bench, creek stele & approach boulder
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', kbX, courtY + 3.05, kbZ + 3.8),
    makeReliefBox(2.0, 0.46, 0.55, 'tayNguyenDarkHardwood', kbX, courtY + 0.42, kbZ + 3.8),
    makeReliefBox(0.55, 1.45, 0.26, 'chamSandstoneMonolith', kbX - 4.4, courtY + 0.78, kbZ - 2.0),
    makeReliefCyl(0.75, 0.92, 0.65, 5, 'volcanicBasaltRock', kbX + 4.2, courtY + 0.28, kbZ - 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w6MsAtlas.push(makeReliefCyl(0.08, 0.09, 3.05, 4, 'tayNguyenDarkHardwood', kbX + ox, courtY + 1.52, kbZ + 3.8 + oz));
    }
  }

  // 1857–1880: Group A–K sandstone lintel displays, Group H excavation shade shelter, trail direction posts,
  // boardwalk benches, Lapidarium Yoni pedestal & distant dipterocarp valley canopy trees
  w6MsAtlas.push(
    makeReliefBox(1.55, 0.68, 0.55, 'chamCarvedPilaster', cx - 10.2, courtY + 0.40, cz + 2.5),
    makeReliefBox(1.45, 0.72, 0.55, 'chamCarvedPilaster', cx + 4.5, courtY + 0.42, cz - 8.5),
    makeReliefBox(0.95, 1.65, 0.95, 'chamRubbedBrick', cx + 6.5, courtY + 0.82, cz + 6.2),
    makeReliefBox(1.65, 0.75, 0.85, 'tayNguyenDarkHardwood', cx - 14.5, courtY + 0.42, cz + 12.5),
    // 1863–1864: Group H 4-post excavation shade shelter (hX + 6.5, hZ + 4.5) & sifting bench
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', hX + 6.5, hY + 2.95, hZ + 4.5),
    makeReliefBox(1.65, 0.72, 0.85, 'tayNguyenDarkHardwood', hX + 6.5, hY + 0.42, hZ + 4.5),
    // 1865–1866, 1876–1877: Group K guardian plinths, Lapidarium Yoni & Shuttle rack
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX + 4.8, kY + 0.45, kZ - 2.4),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX + 4.8, kY + 0.45, kZ + 2.4),
    makeReliefBox(1.25, 0.62, 1.25, 'chamSandstoneMonolith', lapX - 5.2, lapY + 0.38, lapZ - 2.4),
    makeReliefBox(1.85, 1.05, 0.65, 'tayNguyenDarkHardwood', w5ShX + 3.6, w5ShY + 0.58, w5ShZ),
    // 1869–1875: 4 trail direction posts & 3 boardwalk rest benches
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 25.0, courtY + 0.58, cz - 8.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 18.5, courtY + 0.58, cz + 9.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 2.5, courtY + 0.58, cz + 18.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 12.5, courtY + 0.58, cz - 14.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX + 1.6, courtY + 0.35, mbZ - 2.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX + 1.6, courtY + 0.35, mbZ + 2.5)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w6MsAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'tayNguyenDarkHardwood', hX + 6.5 + ox, hY + 1.48, hZ + 4.5 + oz));
    }
  }
  // 1880: Distant outer dipterocarp valley canopy trees (>= 10m clear of Lapidary Garden & all ruins!)
  for (const [tx, tz] of [[lgX + 11.5, lgZ - 4.0], [kbX - 11.0, kbZ + 8.0], [cx + 42.0, cz + 16.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w6MsAtlas.push(makeReliefCyl(0.22, 0.32, 7.2, 4, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.0, 4.6, 4).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w6MsLeaf.push(canopy);
  }

  const w6MsAtlasMesh = createMergedMesh('MySonWave6Atlas', w6MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w6MsAtlasMesh) group.add(w6MsAtlasMesh);
  const w6MsLeafMesh = createMergedMesh('MySonWave6Leaf', w6MsLeaf, foliageMat, false, false);
  if (w6MsLeafMesh) group.add(w6MsLeafMesh);

  // ==========================================================================
  // WAVE 7 UPGRADES (Items 2241–2280): East Brick Restoration Terrace,
  // East Suối Khe Thẻ Timber Creek Bridge, Group A–K Relief Plinths & Trails
  // ==========================================================================
  const w7MsAtlas: THREE.BufferGeometry[] = [];
  const w7MsLeaf: THREE.BufferGeometry[] = [];

  // 2241–2248: Khu Khai Quật & Ruộng Bậc Thang Gạch Cổ Đông (East Brick Terrace at cx + 30.5, cz + 6.5)
  const erX = cx + 30.5;
  const erZ = cz + 6.5;
  const erY = Math.max(ctx.getHeight(erX, erZ), ctx.getHeight(erX - 3.6, erZ - 3.2), ctx.getHeight(erX + 3.6, erZ + 3.2));
  w7MsAtlas.push(
    makeReliefBox(7.6, 5.6, 6.8, 'chamSandstoneMonolith', erX, erY - 2.65, erZ),
    makeReliefBox(5.4, 0.95, 0.58, 'chamRubbedBrick', erX - 0.6, erY + 0.55, erZ - 2.4),
    makeReliefBox(0.58, 0.95, 3.8, 'chamRubbedBrick', erX - 3.0, erY + 0.55, erZ - 0.8),
    // 2245–2248: 4-post thatched conservation shelter, sorting table, guardrail & lectern
    makeReliefBox(3.8, 0.22, 3.4, 'nhaRongGrassThatch', erX + 1.2, erY + 3.10, erZ + 0.2),
    makeReliefBox(1.85, 0.78, 0.92, 'tayNguyenDarkHardwood', erX + 1.2, erY + 0.45, erZ + 0.2),
    makeReliefBox(0.10, 0.10, 6.4, 'tayNguyenDarkHardwood', erX - 3.6, erY + 0.95, erZ),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', erX - 2.4, erY + 0.65, erZ + 3.6)
  );
  for (const ox of [-0.4, 2.8]) {
    for (const oz of [-1.2, 1.6]) {
      w7MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 4, 'tayNguyenDarkHardwood', erX + ox, erY + 1.55, erZ + oz));
    }
  }
  for (let ap = 0; ap < 4; ap++) {
    w7MsAtlas.push(makeReliefBox(1.15, 0.70, 0.62, 'chamCarvedPilaster', erX - 2.2 + (ap % 2) * 2.0, erY + 0.44, erZ + (ap < 2 ? -0.4 : 2.2)));
  }

  // 2249–2256: Cầu Gỗ Suối Khe Thẻ Đông (East Khe Thẻ Timber Creek Footbridge at cx + 14.5, cz + 23.5)
  const keX = cx + 14.5;
  const keZ = cz + 23.5;
  w7MsAtlas.push(
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', keX - 4.0, courtY + 0.15, keZ),
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', keX + 4.0, courtY + 0.15, keZ),
    makeReliefBox(8.2, 0.24, 2.2, 'splitBambooDeck', keX, courtY + 0.85, keZ),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', keX, courtY + 1.75, keZ - 1.0),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', keX, courtY + 1.75, keZ + 1.0),
    // 2252–2256: South-bank 4-post trailhead rest shelter, bench, creek stele & boulders
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', keX, courtY + 3.05, keZ + 3.8),
    makeReliefBox(2.0, 0.46, 0.55, 'tayNguyenDarkHardwood', keX, courtY + 0.42, keZ + 3.8),
    makeReliefBox(0.55, 1.45, 0.26, 'chamSandstoneMonolith', keX + 4.4, courtY + 0.78, keZ - 2.0),
    makeReliefCyl(0.75, 0.92, 0.65, 5, 'volcanicBasaltRock', keX - 4.2, courtY + 0.28, keZ - 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w7MsAtlas.push(makeReliefCyl(0.08, 0.09, 3.05, 4, 'tayNguyenDarkHardwood', keX + ox, courtY + 1.52, keZ + 3.8 + oz));
    }
  }

  // 2257–2280: Group A–K sandstone pedestals, Group H west 4-post shade shelter, trail posts, benches & outer trees
  w7MsAtlas.push(
    makeReliefBox(1.50, 0.68, 0.55, 'chamCarvedPilaster', cx - 10.2, courtY + 0.40, cz - 4.5),
    makeReliefBox(1.45, 0.72, 0.55, 'chamCarvedPilaster', cx + 4.5, courtY + 0.42, cz + 8.5),
    makeReliefBox(0.95, 1.65, 0.95, 'chamRubbedBrick', cx - 6.5, courtY + 0.82, cz - 8.2),
    makeReliefBox(1.65, 0.75, 0.85, 'tayNguyenDarkHardwood', cx + 14.5, courtY + 0.42, cz - 12.5),
    // 2263–2264: Group H west 4-post excavation shade canopy (hX - 7.5, hZ + 4.5) & survey table
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', hX - 7.5, hY + 2.95, hZ + 4.5),
    makeReliefBox(1.65, 0.72, 0.85, 'tayNguyenDarkHardwood', hX - 7.5, hY + 0.42, hZ + 4.5),
    // 2265–2276: Group K boundary plinths, Lapidarium Linga-Yoni, trail posts, benches & shuttle bench
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX - 4.8, kY + 0.45, kZ - 2.4),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX - 4.8, kY + 0.45, kZ + 2.4),
    makeReliefBox(1.25, 0.62, 1.25, 'chamSandstoneMonolith', lapX + 5.2, lapY + 0.38, lapZ - 2.4),
    makeReliefBox(1.85, 0.46, 0.55, 'tayNguyenDarkHardwood', w5ShX - 3.6, w5ShY + 0.38, w5ShZ),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 25.0, courtY + 0.58, cz + 12.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 18.5, courtY + 0.58, cz + 9.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 2.5, courtY + 0.58, cz + 18.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 12.5, courtY + 0.58, cz - 14.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX - 1.6, courtY + 0.35, mbZ - 2.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX - 1.6, courtY + 0.35, mbZ + 2.5)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w7MsAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'tayNguyenDarkHardwood', hX - 7.5 + ox, hY + 1.48, hZ + 4.5 + oz));
    }
  }
  // 2280: Distant outer dipterocarp valley canopy trees (>= 10m clear of East Terrace & all ruins!)
  for (const [tx, tz] of [[erX + 11.5, erZ + 5.0], [keX + 11.0, keZ + 8.0], [cx - 42.0, cz + 16.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w7MsAtlas.push(makeReliefCyl(0.22, 0.32, 7.2, 4, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.0, 4.6, 4).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w7MsLeaf.push(canopy);
  }

  const w7MsAtlasMesh = createMergedMesh('MySonWave7Atlas', w7MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w7MsAtlasMesh) group.add(w7MsAtlasMesh);
  const w7MsLeafMesh = createMergedMesh('MySonWave7Leaf', w7MsLeaf, foliageMat, false, false);
  if (w7MsLeafMesh) group.add(w7MsLeafMesh);

  // ==========================================================================
  // WAVE 8 UPGRADES (Items 2641–2680): North Sandstone Conservation Terrace,
  // West Suối Khe Thẻ Timber Creek Bridge, Group A–K Relief Plinths & Trails
  // ==========================================================================
  const w8MsAtlas: THREE.BufferGeometry[] = [];
  const w8MsLeaf: THREE.BufferGeometry[] = [];

  // 2641–2648: Khu Bảo Tồn Đá Sa Thạch & Bậc Thang Gạch Bắc (North Terrace at cx + 24.0, cz - 24.0)
  const nr8X = cx + 24.0;
  const nr8Z = cz - 24.0;
  const nr8Y = Math.max(ctx.getHeight(nr8X, nr8Z), ctx.getHeight(nr8X - 3.6, nr8Z - 3.2), ctx.getHeight(nr8X + 3.6, nr8Z + 3.2));
  w8MsAtlas.push(
    makeReliefBox(7.6, 5.6, 6.8, 'chamSandstoneMonolith', nr8X, nr8Y - 2.65, nr8Z),
    makeReliefBox(5.4, 0.95, 0.58, 'chamRubbedBrick', nr8X - 0.6, nr8Y + 0.55, nr8Z - 2.4),
    makeReliefBox(0.58, 0.95, 3.8, 'chamRubbedBrick', nr8X - 3.0, nr8Y + 0.55, nr8Z - 0.8),
    // 2645–2648: 4-post thatched conservation shelter, sorting table, guardrail & lectern
    makeReliefBox(3.8, 0.22, 3.4, 'nhaRongGrassThatch', nr8X + 1.2, nr8Y + 3.10, nr8Z + 0.2),
    makeReliefBox(1.85, 0.78, 0.92, 'tayNguyenDarkHardwood', nr8X + 1.2, nr8Y + 0.45, nr8Z + 0.2),
    makeReliefBox(6.8, 0.10, 0.10, 'tayNguyenDarkHardwood', nr8X, nr8Y + 0.95, nr8Z + 3.2),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', nr8X - 2.4, nr8Y + 0.65, nr8Z + 3.6)
  );
  for (const ox of [-0.4, 2.8]) {
    for (const oz of [-1.2, 1.6]) {
      w8MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 4, 'tayNguyenDarkHardwood', nr8X + ox, nr8Y + 1.55, nr8Z + oz));
    }
  }
  for (let ap = 0; ap < 4; ap++) {
    w8MsAtlas.push(makeReliefBox(1.15, 0.70, 0.62, 'chamCarvedPilaster', nr8X - 2.2 + (ap % 2) * 2.0, nr8Y + 0.44, nr8Z + (ap < 2 ? -0.4 : 2.2)));
  }

  // 2649–2656: Cầu Gỗ Suối Khe Thẻ Tây (West Khe Thẻ Timber Creek Footbridge at cx - 18.0, cz + 23.5)
  const kw8X = cx - 18.0;
  const kw8Z = cz + 23.5;
  w8MsAtlas.push(
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', kw8X - 4.0, courtY + 0.15, kw8Z),
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', kw8X + 4.0, courtY + 0.15, kw8Z),
    makeReliefBox(8.2, 0.24, 2.2, 'splitBambooDeck', kw8X, courtY + 0.85, kw8Z),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', kw8X, courtY + 1.75, kw8Z - 1.0),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', kw8X, courtY + 1.75, kw8Z + 1.0),
    // 2652–2656: South-bank 4-post trailhead rest shelter, bench, creek stele & boulders
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', kw8X, courtY + 3.05, kw8Z + 3.8),
    makeReliefBox(2.0, 0.46, 0.55, 'tayNguyenDarkHardwood', kw8X, courtY + 0.42, kw8Z + 3.8),
    makeReliefBox(0.55, 1.45, 0.26, 'chamSandstoneMonolith', kw8X - 4.4, courtY + 0.78, kw8Z - 2.0),
    makeReliefCyl(0.75, 0.92, 0.65, 5, 'volcanicBasaltRock', kw8X + 4.2, courtY + 0.28, kw8Z - 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w8MsAtlas.push(makeReliefCyl(0.08, 0.09, 3.05, 4, 'tayNguyenDarkHardwood', kw8X + ox, courtY + 1.52, kw8Z + 3.8 + oz));
    }
  }

  // 2657–2680: Group A–K sandstone pedestals, Group H east 4-post shade shelter, trail posts, benches & outer trees
  w8MsAtlas.push(
    makeReliefBox(1.50, 0.68, 0.55, 'chamCarvedPilaster', cx - 10.2, courtY + 0.40, cz + 4.5),
    makeReliefBox(1.45, 0.72, 0.55, 'chamCarvedPilaster', cx + 8.5, courtY + 0.42, cz + 8.5),
    makeReliefBox(0.95, 1.65, 0.95, 'chamRubbedBrick', cx + 6.5, courtY + 0.82, cz - 8.2),
    makeReliefBox(1.65, 0.75, 0.85, 'tayNguyenDarkHardwood', cx - 14.5, courtY + 0.42, cz - 12.5),
    // 2663–2664: Group H east 4-post excavation shade canopy (hX + 7.5, hZ + 4.5) & survey table
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', hX + 7.5, hY + 2.95, hZ + 4.5),
    makeReliefBox(1.65, 0.72, 0.85, 'tayNguyenDarkHardwood', hX + 7.5, hY + 0.42, hZ + 4.5),
    // 2665–2676: Group K east boundary plinths, Lapidarium altar, trail posts, benches & shuttle bench
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX + 4.8, kY + 0.45, kZ - 2.4),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX + 4.8, kY + 0.45, kZ + 2.4),
    makeReliefBox(1.25, 0.62, 1.25, 'chamSandstoneMonolith', lapX + 5.2, lapY + 0.38, lapZ + 2.4),
    makeReliefBox(1.85, 0.46, 0.55, 'tayNguyenDarkHardwood', w5ShX + 3.6, w5ShY + 0.38, w5ShZ),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 18.5, courtY + 0.58, cz - 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 22.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 4.5, courtY + 0.58, cz + 18.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 12.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX + 1.6, courtY + 0.35, mbZ - 2.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX + 1.6, courtY + 0.35, mbZ + 2.5)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w8MsAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'tayNguyenDarkHardwood', hX + 7.5 + ox, hY + 1.48, hZ + 4.5 + oz));
    }
  }
  // 2680: Distant outer dipterocarp valley canopy trees (>= 10m clear of North Terrace, West Bridge & ruins!)
  for (const [tx, tz] of [[nr8X + 11.5, nr8Z - 6.0], [kw8X - 11.0, kw8Z + 8.0], [cx + 42.0, cz - 14.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w8MsAtlas.push(makeReliefCyl(0.22, 0.32, 7.2, 4, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.0, 4.6, 4).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w8MsLeaf.push(canopy);
  }

  const w8MsAtlasMesh = createMergedMesh('MySonWave8Atlas', w8MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w8MsAtlasMesh) group.add(w8MsAtlasMesh);
  const w8MsLeafMesh = createMergedMesh('MySonWave8Leaf', w8MsLeaf, foliageMat, false, false);
  if (w8MsLeafMesh) group.add(w8MsLeafMesh);

  // ==========================================================================
  // WAVE 9 UPGRADES (Items 3041–3080): NW Inscription & Brick Terrace,
  // East Suối Khe Thẻ Timber Creek Bridge, Group A–K Relief Plinths & Trails
  // ==========================================================================
  const w9MsAtlas: THREE.BufferGeometry[] = [];
  const w9MsLeaf: THREE.BufferGeometry[] = [];

  // 3041–3048: Khu Bảo Tồn Bia Ký & Tháp Gạch Tây Bắc (NW Terrace at cx - 24.0, cz - 24.0)
  const nw9X = cx - 24.0;
  const nw9Z = cz - 24.0;
  const nw9Y = Math.max(ctx.getHeight(nw9X, nw9Z), ctx.getHeight(nw9X - 3.6, nw9Z - 3.2), ctx.getHeight(nw9X + 3.6, nw9Z + 3.2));
  w9MsAtlas.push(
    makeReliefBox(7.6, 5.6, 6.8, 'chamSandstoneMonolith', nw9X, nw9Y - 2.65, nw9Z),
    makeReliefBox(5.4, 0.95, 0.58, 'chamRubbedBrick', nw9X + 0.6, nw9Y + 0.55, nw9Z - 2.4),
    makeReliefBox(0.58, 0.95, 3.8, 'chamRubbedBrick', nw9X + 3.0, nw9Y + 0.55, nw9Z - 0.8),
    // 3045–3048: 4-post thatched conservation shelter, sorting table, guardrail & lectern
    makeReliefBox(3.8, 0.22, 3.4, 'nhaRongGrassThatch', nw9X - 1.2, nw9Y + 3.10, nw9Z + 0.2),
    makeReliefBox(1.85, 0.78, 0.92, 'tayNguyenDarkHardwood', nw9X - 1.2, nw9Y + 0.45, nw9Z + 0.2),
    makeReliefBox(6.8, 0.10, 0.10, 'tayNguyenDarkHardwood', nw9X, nw9Y + 0.95, nw9Z + 3.2),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', nw9X + 2.4, nw9Y + 0.65, nw9Z + 3.6)
  );
  for (const ox of [-2.8, 0.4]) {
    for (const oz of [-1.2, 1.6]) {
      w9MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 4, 'tayNguyenDarkHardwood', nw9X + ox, nw9Y + 1.55, nw9Z + oz));
    }
  }
  for (let ap = 0; ap < 4; ap++) {
    w9MsAtlas.push(makeReliefBox(1.15, 0.70, 0.62, 'chamCarvedPilaster', nw9X + 0.2 + (ap % 2) * 2.0, nw9Y + 0.44, nw9Z + (ap < 2 ? -0.4 : 2.2)));
  }

  // 3049–3056: Cầu Gỗ Suối Khe Thẻ Đông (East Khe Thẻ Timber Creek Footbridge at cx + 18.0, cz + 23.5)
  const ke9X = cx + 18.0;
  const ke9Z = cz + 23.5;
  w9MsAtlas.push(
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', ke9X - 4.0, courtY + 0.15, ke9Z),
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', ke9X + 4.0, courtY + 0.15, ke9Z),
    makeReliefBox(8.2, 0.24, 2.2, 'splitBambooDeck', ke9X, courtY + 0.85, ke9Z),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', ke9X, courtY + 1.75, ke9Z - 1.0),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', ke9X, courtY + 1.75, ke9Z + 1.0),
    // 3052–3056: South-bank 4-post trailhead rest shelter, bench, creek stele & boulders
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', ke9X, courtY + 3.05, ke9Z + 3.8),
    makeReliefBox(2.0, 0.46, 0.55, 'tayNguyenDarkHardwood', ke9X, courtY + 0.42, ke9Z + 3.8),
    makeReliefBox(0.55, 1.45, 0.26, 'chamSandstoneMonolith', ke9X + 4.4, courtY + 0.78, ke9Z - 2.0),
    makeReliefCyl(0.75, 0.92, 0.65, 5, 'volcanicBasaltRock', ke9X - 4.2, courtY + 0.28, ke9Z - 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w9MsAtlas.push(makeReliefCyl(0.08, 0.09, 3.05, 4, 'tayNguyenDarkHardwood', ke9X + ox, courtY + 1.52, ke9Z + 3.8 + oz));
    }
  }

  // 3057–3080: Group A–K sandstone pedestals, Group K west 4-post shade shelter, trail posts, benches & outer trees
  w9MsAtlas.push(
    makeReliefBox(1.50, 0.68, 0.55, 'chamCarvedPilaster', cx + 10.2, courtY + 0.40, cz + 4.5),
    makeReliefBox(1.45, 0.72, 0.55, 'chamCarvedPilaster', cx - 8.5, courtY + 0.42, cz + 8.5),
    makeReliefBox(0.95, 1.65, 0.95, 'chamRubbedBrick', cx - 6.5, courtY + 0.82, cz - 8.2),
    makeReliefBox(1.65, 0.75, 0.85, 'tayNguyenDarkHardwood', cx + 14.5, courtY + 0.42, cz - 12.5),
    // 3063–3064: Group K west 4-post excavation shade canopy (kX - 6.5, kZ + 4.5) & survey table
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', kX - 6.5, kY + 2.95, kZ + 4.5),
    makeReliefBox(1.65, 0.72, 0.85, 'tayNguyenDarkHardwood', kX - 6.5, kY + 0.42, kZ + 4.5),
    // 3065–3076: Group K west boundary plinths, Lapidarium altar, trail posts, benches & shuttle bench
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX - 4.8, kY + 0.45, kZ - 2.4),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX - 4.8, kY + 0.45, kZ + 2.4),
    makeReliefBox(1.25, 0.62, 1.25, 'chamSandstoneMonolith', lapX - 5.2, lapY + 0.38, lapZ - 2.4),
    makeReliefBox(1.85, 0.46, 0.55, 'tayNguyenDarkHardwood', w5ShX - 3.6, w5ShY + 0.38, w5ShZ),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 18.5, courtY + 0.58, cz - 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 22.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 4.5, courtY + 0.58, cz + 18.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 12.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX - 1.6, courtY + 0.35, mbZ - 2.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX - 1.6, courtY + 0.35, mbZ + 2.5)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w9MsAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'tayNguyenDarkHardwood', kX - 6.5 + ox, kY + 1.48, kZ + 4.5 + oz));
    }
  }
  // 3080: Distant outer dipterocarp valley canopy trees (>= 11m clear of NW Terrace, East Bridge & ruins!)
  for (const [tx, tz] of [[nw9X - 11.5, nw9Z - 6.0], [ke9X + 11.5, ke9Z + 8.0], [cx - 42.0, cz - 14.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w9MsAtlas.push(makeReliefCyl(0.22, 0.32, 7.2, 4, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.0, 4.6, 4).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w9MsLeaf.push(canopy);
  }

  const w9MsAtlasMesh = createMergedMesh('MySonWave9Atlas', w9MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w9MsAtlasMesh) group.add(w9MsAtlasMesh);
  const w9MsLeafMesh = createMergedMesh('MySonWave9Leaf', w9MsLeaf, foliageMat, false, false);
  if (w9MsLeafMesh) group.add(w9MsLeafMesh);

  // ==========================================================================
  // WAVE 10 UPGRADES (Items 3441–3480): NE Apsara Relief & Excavation Terrace,
  // West Suối Khe Thẻ Timber Creek Bridge, Group B–K Relief Plinths & Trails
  // ==========================================================================
  const w10MsAtlas: THREE.BufferGeometry[] = [];
  const w10MsLeaf: THREE.BufferGeometry[] = [];

  // 3441–3448: Khu Bảo Tồn Phù Điêu Apsara Đông Bắc (NE Terrace at cx + 26.0, cz - 24.0)
  const ne10X = cx + 26.0;
  const ne10Z = cz - 24.0;
  const ne10Y = Math.max(ctx.getHeight(ne10X, ne10Z), ctx.getHeight(ne10X - 3.6, ne10Z - 3.2), ctx.getHeight(ne10X + 3.6, ne10Z + 3.2));
  w10MsAtlas.push(
    makeReliefBox(7.6, 5.6, 6.8, 'chamSandstoneMonolith', ne10X, ne10Y - 2.65, ne10Z),
    makeReliefBox(5.4, 0.95, 0.58, 'chamRubbedBrick', ne10X - 0.6, ne10Y + 0.55, ne10Z - 2.4),
    makeReliefBox(0.58, 0.95, 3.8, 'chamRubbedBrick', ne10X - 3.0, ne10Y + 0.55, ne10Z - 0.8),
    // 3445–3448: 4-post thatched conservation shelter, cataloging table, guardrail & lectern
    makeReliefBox(3.8, 0.22, 3.4, 'nhaRongGrassThatch', ne10X + 1.2, ne10Y + 3.10, ne10Z + 0.2),
    makeReliefBox(1.85, 0.78, 0.92, 'tayNguyenDarkHardwood', ne10X + 1.2, ne10Y + 0.45, ne10Z + 0.2),
    makeReliefBox(6.8, 0.10, 0.10, 'tayNguyenDarkHardwood', ne10X, ne10Y + 0.95, ne10Z + 3.2),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', ne10X - 2.4, ne10Y + 0.65, ne10Z + 3.6)
  );
  for (const ox of [-0.4, 2.8]) {
    for (const oz of [-1.2, 1.6]) {
      w10MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 4, 'tayNguyenDarkHardwood', ne10X + ox, ne10Y + 1.55, ne10Z + oz));
    }
  }
  for (let ap = 0; ap < 4; ap++) {
    w10MsAtlas.push(makeReliefBox(1.15, 0.70, 0.62, 'chamCarvedPilaster', ne10X - 2.2 + (ap % 2) * 2.0, ne10Y + 0.44, ne10Z + (ap < 2 ? -0.4 : 2.2)));
  }

  // 3449–3456: Cầu Gỗ Suối Khe Thẻ Tây (West Khe Thẻ Timber Creek Footbridge at cx - 20.0, cz + 24.0)
  const kw10X = cx - 20.0;
  const kw10Z = cz + 24.0;
  w10MsAtlas.push(
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', kw10X - 4.0, courtY + 0.15, kw10Z),
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', kw10X + 4.0, courtY + 0.15, kw10Z),
    makeReliefBox(8.2, 0.24, 2.2, 'splitBambooDeck', kw10X, courtY + 0.85, kw10Z),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', kw10X, courtY + 1.75, kw10Z - 1.0),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', kw10X, courtY + 1.75, kw10Z + 1.0),
    // 3452–3456: North-bank 4-post trailhead rest shelter, bench, creek stele & boulders
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', kw10X, courtY + 3.05, kw10Z - 3.8),
    makeReliefBox(2.0, 0.46, 0.55, 'tayNguyenDarkHardwood', kw10X, courtY + 0.42, kw10Z - 3.8),
    makeReliefBox(0.55, 1.45, 0.26, 'chamSandstoneMonolith', kw10X - 4.4, courtY + 0.78, kw10Z + 2.0),
    makeReliefCyl(0.75, 0.92, 0.65, 5, 'volcanicBasaltRock', kw10X + 4.2, courtY + 0.28, kw10Z + 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w10MsAtlas.push(makeReliefCyl(0.08, 0.09, 3.05, 4, 'tayNguyenDarkHardwood', kw10X + ox, courtY + 1.52, kw10Z - 3.8 + oz));
    }
  }

  // 3457–3480: Group B–K sandstone pedestals, Group K east 4-post shade shelter, trail posts, benches & outer trees
  w10MsAtlas.push(
    makeReliefBox(1.50, 0.68, 0.55, 'chamCarvedPilaster', cx - 10.5, courtY + 0.40, cz + 4.5),
    makeReliefBox(1.45, 0.72, 0.55, 'chamCarvedPilaster', cx + 9.2, courtY + 0.42, cz + 8.5),
    makeReliefBox(0.95, 1.65, 0.95, 'chamRubbedBrick', cx + 7.2, courtY + 0.82, cz - 8.2),
    makeReliefBox(1.65, 0.75, 0.85, 'tayNguyenDarkHardwood', cx - 15.2, courtY + 0.42, cz - 12.5),
    // 3463–3464: Group K east 4-post excavation shade canopy (kX + 7.2, kZ + 4.5) & survey table
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', kX + 7.2, kY + 2.95, kZ + 4.5),
    makeReliefBox(1.65, 0.72, 0.85, 'tayNguyenDarkHardwood', kX + 7.2, kY + 0.42, kZ + 4.5),
    // 3465–3476: Group K east boundary plinths, Lapidarium east altar, trail posts & benches
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX + 5.2, kY + 0.45, kZ - 2.4),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX + 5.2, kY + 0.45, kZ + 2.4),
    makeReliefBox(1.25, 0.62, 1.25, 'chamSandstoneMonolith', lapX + 5.6, lapY + 0.38, lapZ - 2.4),
    makeReliefBox(1.85, 0.46, 0.55, 'tayNguyenDarkHardwood', w5ShX + 3.8, w5ShY + 0.38, w5ShZ),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 19.5, courtY + 0.58, cz - 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 23.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 5.2, courtY + 0.58, cz + 18.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 13.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX + 1.8, courtY + 0.35, mbZ - 2.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX + 1.8, courtY + 0.35, mbZ + 2.5)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w10MsAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'tayNguyenDarkHardwood', kX + 7.2 + ox, kY + 1.48, kZ + 4.5 + oz));
    }
  }
  // 3477–3480: Distant outer dipterocarp valley canopy trees (>= 12m clear of NE Terrace, West Bridge & ruins!)
  for (const [tx, tz] of [[ne10X + 12.0, ne10Z - 6.0], [kw10X - 12.0, kw10Z + 8.0], [cx + 44.0, cz - 14.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w10MsAtlas.push(makeReliefCyl(0.22, 0.32, 7.2, 4, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.0, 4.6, 4).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w10MsLeaf.push(canopy);
  }

  const w10MsAtlasMesh = createMergedMesh('MySonWave10Atlas', w10MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w10MsAtlasMesh) group.add(w10MsAtlasMesh);
  const w10MsLeafMesh = createMergedMesh('MySonWave10Leaf', w10MsLeaf, foliageMat, false, false);
  if (w10MsLeafMesh) group.add(w10MsLeafMesh);

  // ==========================================================================
  // WAVE 11 UPGRADES (Items 3841–3880): NW Champa Epigraphy & Stele Terrace,
  // East Suối Khe Thẻ Timber Creek Bridge, Group B–K Relief Plinths & Trails
  // ==========================================================================
  const w11MsAtlas: THREE.BufferGeometry[] = [];
  const w11MsLeaf: THREE.BufferGeometry[] = [];

  // 3841–3848: Khu Bảo Tồn Bia Ký & Đền Tháp Tây Bắc (NW Epigraphy Terrace at cx - 26.0, cz - 24.0)
  const nw11X = cx - 26.0;
  const nw11Z = cz - 24.0;
  const nw11Y = Math.max(ctx.getHeight(nw11X, nw11Z), ctx.getHeight(nw11X - 3.6, nw11Z - 3.2), ctx.getHeight(nw11X + 3.6, nw11Z + 3.2));
  w11MsAtlas.push(
    makeReliefBox(7.6, 5.6, 6.8, 'chamSandstoneMonolith', nw11X, nw11Y - 2.65, nw11Z),
    makeReliefBox(5.4, 0.95, 0.58, 'chamRubbedBrick', nw11X + 0.6, nw11Y + 0.55, nw11Z - 2.4),
    makeReliefBox(0.58, 0.95, 3.8, 'chamRubbedBrick', nw11X + 3.0, nw11Y + 0.55, nw11Z - 0.8),
    // 3845–3848: 4-post thatched conservation shelter, cataloging table, guardrail & lectern
    makeReliefBox(3.8, 0.22, 3.4, 'nhaRongGrassThatch', nw11X - 1.2, nw11Y + 3.10, nw11Z + 0.2),
    makeReliefBox(1.85, 0.78, 0.92, 'tayNguyenDarkHardwood', nw11X - 1.2, nw11Y + 0.45, nw11Z + 0.2),
    makeReliefBox(6.8, 0.10, 0.10, 'tayNguyenDarkHardwood', nw11X, nw11Y + 0.95, nw11Z + 3.2),
    makeReliefBox(0.65, 1.15, 0.22, 'chamSandstoneMonolith', nw11X + 2.4, nw11Y + 0.65, nw11Z + 3.6)
  );
  for (const ox of [-2.8, 0.4]) {
    for (const oz of [-1.2, 1.6]) {
      w11MsAtlas.push(makeReliefCyl(0.08, 0.10, 3.10, 4, 'tayNguyenDarkHardwood', nw11X + ox, nw11Y + 1.55, nw11Z + oz));
    }
  }
  for (let ap = 0; ap < 4; ap++) {
    w11MsAtlas.push(makeReliefBox(1.15, 0.70, 0.62, 'chamCarvedPilaster', nw11X + 0.2 + (ap % 2) * 2.0, nw11Y + 0.44, nw11Z + (ap < 2 ? -0.4 : 2.2)));
  }

  // 3849–3856: Cầu Gỗ Suối Khe Thẻ Đông (East Khe Thẻ Timber Creek Footbridge at cx + 22.0, cz + 26.0)
  const ke11X = cx + 22.0;
  const ke11Z = cz + 26.0;
  w11MsAtlas.push(
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', ke11X - 4.0, courtY + 0.15, ke11Z),
    makeReliefBox(1.45, 1.25, 2.6, 'volcanicBasaltRock', ke11X + 4.0, courtY + 0.15, ke11Z),
    makeReliefBox(8.2, 0.24, 2.2, 'splitBambooDeck', ke11X, courtY + 0.85, ke11Z),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', ke11X, courtY + 1.75, ke11Z - 1.0),
    makeReliefBox(8.2, 0.10, 0.10, 'tayNguyenDarkHardwood', ke11X, courtY + 1.75, ke11Z + 1.0),
    // 3852–3856: South-bank 4-post trailhead rest shelter, bench, creek stele & boulders
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', ke11X, courtY + 3.05, ke11Z + 3.8),
    makeReliefBox(2.0, 0.46, 0.55, 'tayNguyenDarkHardwood', ke11X, courtY + 0.42, ke11Z + 3.8),
    makeReliefBox(0.55, 1.45, 0.26, 'chamSandstoneMonolith', ke11X + 4.4, courtY + 0.78, ke11Z - 2.0),
    makeReliefCyl(0.75, 0.92, 0.65, 5, 'volcanicBasaltRock', ke11X - 4.2, courtY + 0.28, ke11Z - 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w11MsAtlas.push(makeReliefCyl(0.08, 0.09, 3.05, 4, 'tayNguyenDarkHardwood', ke11X + ox, courtY + 1.52, ke11Z + 3.8 + oz));
    }
  }

  // 3857–3880: Group B–K sandstone pedestals, Group K west 4-post shade shelter, trail posts, benches & outer trees
  w11MsAtlas.push(
    makeReliefBox(1.50, 0.68, 0.55, 'chamCarvedPilaster', cx - 12.5, courtY + 0.40, cz - 6.5),
    makeReliefBox(1.45, 0.72, 0.55, 'chamCarvedPilaster', cx + 11.2, courtY + 0.42, cz - 8.5),
    makeReliefBox(0.95, 1.65, 0.95, 'chamRubbedBrick', cx + 9.2, courtY + 0.82, cz + 10.2),
    makeReliefBox(1.65, 0.75, 0.85, 'tayNguyenDarkHardwood', cx - 17.2, courtY + 0.42, cz + 12.5),
    // 3863–3864: Group K west 4-post excavation shade canopy (kX - 7.4, kZ + 4.5) & survey table
    makeReliefBox(3.6, 0.20, 3.0, 'nhaRongGrassThatch', kX - 7.4, kY + 2.95, kZ + 4.5),
    makeReliefBox(1.65, 0.72, 0.85, 'tayNguyenDarkHardwood', kX - 7.4, kY + 0.42, kZ + 4.5),
    // 3865–3876: Group K west boundary plinths, Lapidarium west altar, trail posts & benches
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX - 5.4, kY + 0.45, kZ - 2.4),
    makeReliefBox(0.75, 0.85, 0.75, 'chamSandstoneMonolith', kX - 5.4, kY + 0.45, kZ + 2.4),
    makeReliefBox(1.25, 0.62, 1.25, 'chamSandstoneMonolith', lapX - 5.8, lapY + 0.38, lapZ - 2.4),
    makeReliefBox(1.85, 0.46, 0.55, 'tayNguyenDarkHardwood', w5ShX - 3.8, w5ShY + 0.38, w5ShZ),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 19.5, courtY + 0.58, cz - 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 23.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx + 5.2, courtY + 0.58, cz + 18.5),
    makeReliefBox(0.42, 1.15, 0.42, 'chamSandstoneMonolith', cx - 13.5, courtY + 0.58, cz + 14.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX - 2.2, courtY + 0.35, mbZ - 2.5),
    makeReliefBox(0.55, 0.46, 1.85, 'tayNguyenDarkHardwood', mbX - 2.2, courtY + 0.35, mbZ + 2.5)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w11MsAtlas.push(makeReliefCyl(0.08, 0.09, 2.95, 4, 'tayNguyenDarkHardwood', kX - 7.4 + ox, kY + 1.48, kZ + 4.5 + oz));
    }
  }
  // 3877–3880: Distant outer dipterocarp valley canopy trees (>= 12m clear of NW Terrace, East Bridge & ruins!)
  for (const [tx, tz] of [[nw11X - 12.0, nw11Z - 6.0], [ke11X + 12.0, ke11Z + 8.0], [cx - 44.0, cz - 14.0]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w11MsAtlas.push(makeReliefCyl(0.22, 0.32, 7.2, 4, 'tayNguyenDarkHardwood', tx, ty + 2.5, tz));
    const canopy = new THREE.ConeGeometry(3.0, 4.6, 4).translate(tx, ty + 7.2, tz);
    colorizeGeo(canopy, 0x1d4e20);
    w11MsLeaf.push(canopy);
  }

  const w11MsAtlasMesh = createMergedMesh('MySonWave11Atlas', w11MsAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w11MsAtlasMesh) group.add(w11MsAtlasMesh);
  const w11MsLeafMesh = createMergedMesh('MySonWave11Leaf', w11MsLeaf, foliageMat, false, false);
  if (w11MsLeafMesh) group.add(w11MsLeafMesh);

  tagMotifIds(group, [
    'HV-C09', 'HV-C10', 'HV-F01', 'HV-F02', 'HV-F03', 'HV-F04', 'HV-F05',
    'HV-F06', 'HV-F07', 'HV-F09', 'HV-F10', 'HV-F11',
    'HV-NEW-MT-05', 'HV-NEW-MT-06', 'HV-NEW-MT-07'
  ]);
  ctx.scene.add(group);
  return group;
}

/**
 * ============================================================================
 * PART 2: NHÀ RÔNG TÂY NGUYÊN — CỒNG CHIÊNG — TƯỢNG NHÀ MỒ & BIỂN HỒ T'NƯNG
 * Implements NR-01..NR-32 & TN-01..TN-32
 * ============================================================================
 */
export function buildBienHoTNungComplex(ctx: VietnamBuilderContext): THREE.Group {
  const pack = getOrCreateMstnPack(ctx);
  const group = new THREE.Group();
  group.name = 'BienHoTNungComplex';

  const houseX = -404.0;
  const houseZ = 42.0;
  const rimY = ctx.getHeight(houseX, houseZ);
  const deckY = rimY + 2.65;
  ctx.exclusionCircles.push(
    { x: houseX, z: houseZ, r: 22.0 },
    { x: -455.0, z: 42.0, r: 44.0 }
  );

  const atlasParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const emberParts: THREE.BufferGeometry[] = [];

  // --------------------------------------------------------------------------
  // 1. TALL DARK-TIMBER STILT FRAME WITH STONE FOOTINGS & DIAGONAL X-BRACING (NR-25..28)
  // --------------------------------------------------------------------------
  const stiltXs = [-3.6, 0.0, 3.6];
  const stiltZs = [-5.8, -1.9, 1.9, 5.8];
  for (const ox of stiltXs) {
    for (const oz of stiltZs) {
      const px = houseX + ox;
      const pz = houseZ + oz;
      const gy = ctx.getHeight(px, pz) - 0.6;
      const h = deckY - gy;
      atlasParts.push(
        makeReliefCyl(0.32, 0.38, 0.34, 8, 'volcanicBasaltRock', px, gy + 0.55, pz),
        makeReliefCyl(0.20, 0.25, h, 10, 'tayNguyenDarkHardwood', px, gy + h * 0.5, pz)
      );
    }
  }
  // Diagonal timber X-bracing (*thanh giằng chéo*) & longitudinal under-deck girders (NR-26..27)
  for (const oz of [-5.8, -1.9, 1.9, 5.8]) {
    atlasParts.push(makeReliefBox(7.8, 0.24, 0.24, 'tayNguyenDarkHardwood', houseX, deckY - 0.26, houseZ + oz));
  }
  for (const ox of [-3.6, 3.6]) {
    atlasParts.push(makeReliefBox(0.24, 0.26, 12.2, 'tayNguyenDarkHardwood', houseX + ox, deckY - 0.34, houseZ));
    // Diagonal X-braces between stilt bays
    for (const bz of [-3.85, 0.0, 3.85]) {
      atlasParts.push(
        makeReliefBox(0.12, 0.12, 4.1, 'tayNguyenDarkHardwood', houseX + ox, deckY - 1.35, houseZ + bz, 0, 0.52, 0),
        makeReliefBox(0.12, 0.12, 4.1, 'tayNguyenDarkHardwood', houseX + ox, deckY - 1.35, houseZ + bz, 0, -0.52, 0)
      );
    }
  }
  // Item 141: Under-croft storage beneath Nhà Rông stilts: carved wooden Thuyền Độc Mộc (dugout canoe) & Cối Giã Gạo (rice mortar & pestles)
  const canoeGeo = remapRelief(new THREE.CylinderGeometry(0.32, 0.24, 5.4, 8), 'tayNguyenDarkHardwood');
  canoeGeo.rotateX(Math.PI * 0.5);
  canoeGeo.translate(houseX - 1.5, rimY + 0.36, houseZ + 0.8);
  atlasParts.push(
    canoeGeo,
    makeReliefCyl(0.28, 0.22, 0.65, 8, 'tayNguyenDarkHardwood', houseX + 1.4, rimY + 0.32, houseZ - 2.4),
    makeReliefCyl(0.05, 0.05, 1.35, 6, 'splitBambooDeck', houseX + 1.4, rimY + 0.88, houseZ - 2.35, 0.18, 0, 0)
  );

  // --------------------------------------------------------------------------
  // 2. SPLIT-BAMBOO DECK, WOVEN BAMBOO WALLS, CEREMONIAL PORCH & THỔ CẨM BANNERS (NR-13..20, TN-06..10)
  // --------------------------------------------------------------------------
  const hallH = 3.55;
  atlasParts.push(
    makeReliefBox(9.2, 0.24, 14.2, 'splitBambooDeck', houseX, deckY, houseZ),
    // Projecting central ceremonial front porch (*sàn đón*) on East (+X) side with terrain-grounded stilts
    makeReliefBox(2.4, 0.24, 5.2, 'splitBambooDeck', houseX + 5.6, deckY, houseZ),
    ...([-2.2, 2.2] as const).map((oz) => {
      const gy = ctx.getHeight(houseX + 6.5, houseZ + oz) - 0.6;
      const h = Math.max(2.0, deckY - gy);
      return makeReliefCyl(0.18, 0.22, h, 8, 'tayNguyenDarkHardwood', houseX + 6.5, gy + h * 0.5, houseZ + oz);
    })
  );
  // Woven split-bamboo hall walls (*phên tre đan*) + open wide central entrance + light woven veranda balustrade
  atlasParts.push(
    makeReliefBox(0.22, hallH, 11.4, 'wovenBambooWall', houseX - 3.35, deckY + hallH * 0.5, houseZ),
    makeReliefBox(6.8, hallH, 0.22, 'wovenBambooWall', houseX, deckY + hallH * 0.5, houseZ - 5.65),
    makeReliefBox(6.8, hallH, 0.22, 'wovenBambooWall', houseX, deckY + hallH * 0.5, houseZ + 5.65)
  );
  for (const side of [-1, 1]) {
    // East flanking woven bamboo walls leaving wide 4.2m central communal entrance
    atlasParts.push(
      makeReliefBox(0.22, hallH, 3.5, 'wovenBambooWall', houseX + 3.35, deckY + hallH * 0.5, houseZ + side * 3.9),
      // Light woven bamboo veranda balustrade with top timber handrail
      makeReliefBox(0.10, 0.82, 4.4, 'wovenBambooWall', houseX + 4.45, deckY + 0.52, houseZ + side * 4.65),
      makeReliefBox(0.14, 0.10, 4.5, 'tayNguyenDarkHardwood', houseX + 4.45, deckY + 0.96, houseZ + side * 4.65),
      // Hanging vertical Thổ Cẩm brocade banners flanking the entrance (TN-07, UV rotated cleanly!)
      makeReliefBox(0.08, 2.35, 0.62, 'thoCamBrocade', houseX + 3.52, deckY + 2.05, houseZ + side * 2.55),
      (() => {
        const g = new THREE.PlaneGeometry(0.56, 2.25);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          const u = uv.getX(i);
          const v = uv.getY(i);
          uv.setXY(i, 1 - v, u);
        }
        uv.needsUpdate = true;
        remapRelief(g, 'thoCamBrocade');
        g.rotateY(Math.PI * 0.5);
        g.translate(houseX + 3.58, deckY + 2.05, houseZ + side * 2.55);
        return g;
      })()
    );
  }
  // Crisp Bahnar geometric Thổ Cẩm fascia beam across the entire front lintel (NR-16, TN-06)
  atlasParts.push(
    makeReliefBox(0.28, 0.56, 11.6, 'thoCamBrocade', houseX + 3.45, deckY + hallH - 0.24, houseZ),
    // Item 139: Carved hornbill (*Chim Hồng Hoàng*) & geometric *Răng Cưa* reliefs on veranda posts
    makeReliefBox(0.24, 0.48, 0.28, 'thoCamBrocade', houseX + 6.5, deckY + 1.05, houseZ - 2.2),
    makeReliefBox(0.24, 0.48, 0.28, 'thoCamBrocade', houseX + 6.5, deckY + 1.05, houseZ + 2.2),
    // Item 154: Woven bamboo *Gùi* (highland back-baskets) resting along the Nhà Rông front veranda
    makeReliefCyl(0.24, 0.16, 0.52, 8, 'wovenBambooWall', houseX + 4.1, deckY + 0.38, houseZ - 3.2),
    makeReliefCyl(0.22, 0.15, 0.48, 8, 'wovenBambooWall', houseX + 4.1, deckY + 0.36, houseZ + 3.2)
  );

  // --------------------------------------------------------------------------
  // 3. TWIN OPPOSING CARVED NOTCHED-LOG STAIRCASES (*CẦU THANG ĐỘC MỘC*) (NR-21..24, TN-14)
  // --------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const bot = new THREE.Vector3(houseX + 9.2, rimY - 0.15, houseZ + side * 1.45);
    const top = new THREE.Vector3(houseX + 6.6, deckY + 0.15, houseZ + side * 1.45);
    const dir = new THREE.Vector3().subVectors(top, bot);
    const len = dir.length();
    const log = remapRelief(new THREE.CylinderGeometry(0.26, 0.34, len + 0.9, 10), 'tayNguyenDarkHardwood');
    log.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    log.translate((bot.x + top.x) * 0.5, (bot.y + top.y) * 0.5 + 0.15, bot.z);
    atlasParts.push(log);
    // 7 adze-carved step notches + sculpted twin breast/crescent fertility motifs at stair head!
    for (let st = 0; st < 7; st++) {
      const t = (st + 0.5) / 7;
      atlasParts.push(
        makeReliefBox(0.32, 0.10, 0.52, 'splitBambooDeck', THREE.MathUtils.lerp(bot.x, top.x, t), THREE.MathUtils.lerp(bot.y, top.y, t) + 0.18, bot.z)
      );
    }
    // Carved crescent & twin breast fertility motif on top head of stair log (NR-23)
    const headBase = new THREE.Vector3(top.x - 0.25, top.y + 0.65, bot.z);
    for (const bs of [-0.14, 0.14]) {
      const breast = remapRelief(new THREE.SphereGeometry(0.11, 8, 6), 'tayNguyenDarkHardwood');
      breast.translate(headBase.x + 0.16, headBase.y - 0.12, headBase.z + bs);
      atlasParts.push(breast);
    }
    const crescent = remapRelief(new THREE.TorusGeometry(0.20, 0.05, 6, 12, Math.PI), 'tayNguyenDarkHardwood');
    crescent.rotateY(Math.PI * 0.5);
    crescent.rotateZ(Math.PI);
    crescent.translate(headBase.x, headBase.y + 0.24, headBase.z);
    atlasParts.push(crescent);
  }

  // --------------------------------------------------------------------------
  // 4. SMOOTH SOARING CONCAVE HYPERBOLIC AXE-BLADE (*LƯỠI RÌU*) THATCH ROOF + SỪNG NÓC FINIALS (NR-01..12, TN-15..16)
  // Smooth extruded hyperbolic profile — ZERO blocky stair-step edges!
  // --------------------------------------------------------------------------
  const roofBaseY = deckY + hallH - 0.55; // Overlaps below wall top plate -> ZERO light gap! (NR-04)
  const roofH = 14.8;
  const halfBaseX = 5.85;
  const halfTopX = 0.28;
  const axeShape = new THREE.Shape();
  axeShape.moveTo(-halfBaseX, 0);
  axeShape.lineTo(halfBaseX, 0);
  // Smooth concave hyperbolic right slope
  const slopeSteps = 12;
  for (let i = 1; i <= slopeSteps; i++) {
    const t = i / slopeSteps;
    const x = halfTopX + (halfBaseX - halfTopX) * Math.pow(1 - t, 1.38);
    axeShape.lineTo(x, t * roofH);
  }
  axeShape.lineTo(-halfTopX, roofH);
  // Smooth concave hyperbolic left slope
  for (let i = slopeSteps - 1; i >= 0; i--) {
    const t = i / slopeSteps;
    const x = -(halfTopX + (halfBaseX - halfTopX) * Math.pow(1 - t, 1.38));
    axeShape.lineTo(x, t * roofH);
  }
  axeShape.closePath();

  const axeRoofGeo = new THREE.ExtrudeGeometry(axeShape, {
    depth: 15.6,
    bevelEnabled: false
  });
  axeRoofGeo.translate(0, 0, -7.8);
  // Subtle axe-blade flare along Z at upper crest!
  const arPos = axeRoofGeo.attributes.position;
  for (let vi = 0; vi < arPos.count; vi++) {
    const vy = arPos.getY(vi);
    const vz = arPos.getZ(vi);
    const t = clamp01(vy / roofH);
    const zScale = 1.0 - t * 0.16 + Math.pow(t, 2.2) * 0.12;
    arPos.setZ(vi, vz * zScale);
  }
  axeRoofGeo.computeVertexNormals();
  normalizeExtrudeUv(axeRoofGeo);
  remapRelief(axeRoofGeo, 'nhaRongGrassThatch');
  axeRoofGeo.translate(houseX, roofBaseY, houseZ);
  atlasParts.push(axeRoofGeo);

  // Crisp woven Thổ Cẩm diamond ridge-crown frieze band hugging upper roof crest (NR-09)
  atlasParts.push(
    makeReliefBox(1.85, 1.05, 14.3, 'thoCamBrocade', houseX, roofBaseY + roofH - 1.55, houseZ)
  );
  // Protruding crossed bamboo ridge-finials (*sừng nóc*) + central sun-wheel emblem along the towering ridge (NR-10..11)
  const ridgeY = roofBaseY + roofH + 0.15;
  atlasParts.push(makeReliefCyl(0.14, 0.14, 14.2, 8, 'tayNguyenDarkHardwood', houseX, ridgeY, houseZ, 0, Math.PI * 0.5, 0));
  for (let r = -6; r <= 6; r++) {
    const rz = houseZ + r * 1.05;
    const isMajor = r % 2 === 0;
    const hHorn = isMajor ? 1.65 : 0.95;
    atlasParts.push(
      makeReliefCyl(0.03, 0.055, hHorn, 5, 'tayNguyenDarkHardwood', houseX, ridgeY + hHorn * 0.45, rz, 0, 0, 0.38),
      makeReliefCyl(0.03, 0.055, hHorn, 5, 'tayNguyenDarkHardwood', houseX, ridgeY + hHorn * 0.45, rz, 0, 0, -0.38)
    );
  }
  // Central sun-wheel emblem (*mặt trời*) crowning the ridge apex + Item 140: 12-ray spokes & Sừng Nóc rattan lashings
  const sunRing = new THREE.TorusGeometry(0.55, 0.08, 8, 16);
  sunRing.rotateY(Math.PI * 0.5);
  sunRing.translate(houseX, ridgeY + 1.05, houseZ);
  goldParts.push(sunRing);
  for (let sp = 0; sp < 6; sp++) {
    const spoke = new THREE.CylinderGeometry(0.025, 0.025, 1.15, 4);
    spoke.rotateX((sp / 6) * Math.PI);
    spoke.translate(houseX, ridgeY + 1.05, houseZ);
    goldParts.push(spoke);
  }

  // --------------------------------------------------------------------------
  // 5. OPEN COMMUNAL INTERIOR: HEARTH, 2-TIER BRONZE CỒNG CHIÊNG RACK & CHÓE RƯỢU CẦN JARS (NR-29..32, TN-01..05, TN-17..20)
  // --------------------------------------------------------------------------
  // Sunken clay-and-timber communal hearth (*bếp lửa*) with 3-stone trivet & glowing amber embers (NR-30, TN-20)
  const hearthX = houseX + 0.4;
  atlasParts.push(
    makeReliefBox(1.85, 0.24, 1.85, 'tayNguyenDarkHardwood', hearthX, deckY + 0.18, houseZ + 1.4),
    makeReliefBox(1.52, 0.18, 1.52, 'highlandLateriteSoil', hearthX, deckY + 0.22, houseZ + 1.4)
  );
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2;
    atlasParts.push(makeReliefCyl(0.11, 0.14, 0.28, 6, 'volcanicBasaltRock', hearthX + Math.cos(a) * 0.34, deckY + 0.36, houseZ + 1.4 + Math.sin(a) * 0.34));
  }
  const embers = new THREE.SphereGeometry(0.32, 8, 6);
  embers.scale(1.3, 0.45, 1.3);
  embers.translate(hearthX, deckY + 0.34, houseZ + 1.4);
  emberParts.push(embers);

  // 2-Tier Lashed Bamboo Gong Rack (*Giá Treo Cồng Chiêng*) with 7 Graduated Patinated Bronze Bossed Gongs! (TN-01..05)
  const rackX = houseX - 1.55;
  const rackZ = houseZ - 0.65;
  atlasParts.push(
    makeReliefCyl(0.08, 0.10, 2.55, 8, 'tayNguyenDarkHardwood', rackX, deckY + 1.35, rackZ - 2.35),
    makeReliefCyl(0.08, 0.10, 2.55, 8, 'tayNguyenDarkHardwood', rackX, deckY + 1.35, rackZ + 2.35),
    makeReliefCyl(0.06, 0.06, 5.1, 8, 'tayNguyenDarkHardwood', rackX, deckY + 2.35, rackZ, 0, Math.PI * 0.5, 0),
    makeReliefCyl(0.05, 0.05, 5.1, 8, 'tayNguyenDarkHardwood', rackX, deckY + 1.25, rackZ, 0, Math.PI * 0.5, 0)
  );
  // 7 graduated bronze gongs with prominent hemispherical central bosses & turned rims!
  for (let g = 0; g < 7; g++) {
    const gz = rackZ - 1.8 + g * 0.60;
    const rad = 0.34 - g * 0.025;
    const gy = deckY + 1.82;
    const gongDisc = new THREE.CylinderGeometry(rad, rad, 0.08, 16);
    gongDisc.rotateZ(Math.PI * 0.5);
    gongDisc.translate(rackX + 0.08, gy, gz);
    const boss = new THREE.SphereGeometry(rad * 0.34, 10, 8);
    boss.translate(rackX + 0.15, gy, gz);
    bronzeParts.push(gongDisc, boss);
    // Item 142: 2nd lower tier of smaller flat *Chiêng* gongs without bosses
    if (g < 5) {
      const chieng = new THREE.CylinderGeometry(rad * 0.72, rad * 0.72, 0.05, 12);
      chieng.rotateZ(Math.PI * 0.5);
      chieng.translate(rackX + 0.06, deckY + 0.92, gz + 0.35);
      bronzeParts.push(chieng);
    }
  }
  // Item 143: *Trống Da Trâu* (buffalo-hide ceremonial drum) & padded wooden gong mallets beside gong rack
  const drum = remapRelief(new THREE.CylinderGeometry(0.36, 0.32, 0.78, 10), 'tayNguyenDarkHardwood');
  drum.rotateZ(Math.PI * 0.42);
  drum.translate(rackX + 0.35, deckY + 0.62, rackZ + 2.55);
  atlasParts.push(
    drum,
    makeReliefCyl(0.025, 0.025, 0.42, 5, 'splitBambooDeck', rackX + 0.45, deckY + 0.25, rackZ - 1.2, 0, Math.PI * 0.3, 0)
  );

  // Clustered bulbous glazed stoneware *chóe rượu cần* jars with curved arched bamboo straws! (TN-17..19)
  const jarSpots: Array<[number, number, number]> = [
    [houseX + 1.4, houseZ - 1.65, 1.0],
    [houseX + 1.9, houseZ - 1.15, 0.88],
    [houseX + 1.3, houseZ - 0.95, 0.92]
  ];
  for (const [jx, jz, js] of jarSpots) {
    const jarPts = [
      new THREE.Vector2(0.18 * js, 0.0),
      new THREE.Vector2(0.32 * js, 0.36 * js),
      new THREE.Vector2(0.34 * js, 0.58 * js),
      new THREE.Vector2(0.20 * js, 0.82 * js),
      new THREE.Vector2(0.24 * js, 0.92 * js)
    ];
    const jar = remapRelief(new THREE.LatheGeometry(jarPts, 12), 'ruouCanStoneware');
    jar.translate(jx, deckY + 0.12, jz);
    atlasParts.push(jar);
    // 3 organically arched bamboo drinking straws (*cần hút*)
    for (let st = 0; st < 3; st++) {
      const ang = (st / 3) * Math.PI * 2 + 0.4;
      const strawCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(jx, deckY + 0.95 * js, jz),
        new THREE.Vector3(jx + Math.cos(ang) * 0.28, deckY + 1.45 * js, jz + Math.sin(ang) * 0.28),
        new THREE.Vector3(jx + Math.cos(ang) * 0.62, deckY + 1.25 * js, jz + Math.sin(ang) * 0.62)
      ]);
      atlasParts.push(remapRelief(new THREE.TubeGeometry(strawCurve, 8, 0.018, 5, false), 'splitBambooDeck'));
    }
  }
  // Warm firelight PointLight illuminating the Nhà Rông interior & bronze gongs!
  const hearthLight = new THREE.PointLight('#ffaa44', 5.2, 16, 1.5);
  hearthLight.position.set(houseX + 0.5, deckY + 2.2, houseZ);
  group.add(hearthLight);

  // --------------------------------------------------------------------------
  // 6. CEREMONIAL CÂY NÊU TOTEM & TƯỢNG NHÀ MỒ FOLK STATUE PALISADE IN COURTYARD (TN-11..13, TN-21..24)
  // Positioned cleanly off-axis so ZERO pole blocks the front stairs or doorway!
  // --------------------------------------------------------------------------
  const neuX = houseX + 11.5;
  const neuZ = houseZ - 6.8;
  const neuY = ctx.getHeight(neuX, neuZ);
  atlasParts.push(
    makeReliefCyl(0.10, 0.16, 10.5, 10, 'thoCamBrocade', neuX, neuY + 5.25, neuZ),
    makeReliefBox(1.85, 0.12, 0.12, 'thoCamBrocade', neuX, neuY + 7.2, neuZ),
    makeReliefBox(0.12, 0.12, 1.85, 'thoCamBrocade', neuX, neuY + 8.6, neuZ)
  );
  // Starburst woven bamboo finial crowning Cây Nêu + Item 145: Hanging woven-bamboo Chùm Tua & Thổ Cẩm tassels
  const neuStar = new THREE.OctahedronGeometry(0.62, 0);
  neuStar.translate(neuX, neuY + 10.85, neuZ);
  goldParts.push(neuStar);
  for (const [tx, tz] of [[-0.82, 0], [0.82, 0], [0, -0.82], [0, 0.82]]) {
    atlasParts.push(makeReliefBox(0.14, 0.95, 0.14, 'thoCamBrocade', neuX + tx, neuY + 6.65, neuZ + tz));
  }

  // Silver-wood Palisade & 6 Faceted Adze-Carved *Tượng Nhà Mồ* Folk Statues (seated thinkers, ancestors & hornbill) (TN-21..24)
  const nmX = houseX + 10.2;
  const nmZ = houseZ + 7.4;
  const nmY = ctx.getHeight(nmX, nmZ);
  for (let i = 0; i < 6; i++) {
    const sx = nmX - 3.0 + i * 1.25;
    const sz = nmZ + (i % 2) * 0.4;
    const postH = 1.65 + (i % 3) * 0.25;
    atlasParts.push(
      makeReliefCyl(0.14, 0.18, postH, 6, 'nhaMoSilverWood', sx, nmY + postH * 0.5, sz),
      // Faceted adze-carved folk ancestor torso & head seated atop post
      makeReliefBox(0.32, 0.52, 0.26, 'nhaMoSilverWood', sx, nmY + postH + 0.26, sz),
      makeReliefBox(0.24, 0.28, 0.24, 'nhaMoSilverWood', sx, nmY + postH + 0.68, sz),
      // Item 146: Sculpted Tượng Khóc / Ngà Voi (elephant tusk / bird) post finials
      makeReliefCyl(0.03, 0.06, 0.45, 5, 'nhaMoSilverWood', sx + 0.18, nmY + postH + 0.88, sz, 0, 0, -0.35)
    );
  }
  atlasParts.push(makeReliefBox(7.2, 0.12, 0.14, 'nhaMoSilverWood', nmX + 0.1, nmY + 0.95, nmZ));

  // Item 144 (Area Expansion): 2 smaller Bahnar/Gia Rai family *Nhà Sàn* stilt houses flanking the courtyard (*Buôn Làng* cluster)
  for (const [sx, sz] of [[houseX - 15.5, houseZ - 17.5], [houseX - 15.5, houseZ + 18.0]]) {
    const sy = Math.max(
      ctx.getHeight(sx, sz),
      ctx.getHeight(sx - 2.2, sz - 2.4),
      ctx.getHeight(sx + 2.2, sz - 2.4),
      ctx.getHeight(sx - 2.2, sz + 2.4),
      ctx.getHeight(sx + 2.2, sz + 2.4)
    );
    const nsDeckY = sy + 2.2;
    for (const ox of [-2.2, 2.2]) {
      for (const oz of [-2.4, 2.4]) {
        const gy = ctx.getHeight(sx + ox, sz + oz) - 0.5;
        const sh = Math.max(2.0, nsDeckY - gy);
        atlasParts.push(makeReliefCyl(0.14, 0.16, sh, 6, 'tayNguyenDarkHardwood', sx + ox, gy + sh * 0.5, sz + oz));
      }
    }
    atlasParts.push(
      makeReliefBox(5.4, 0.22, 6.2, 'splitBambooDeck', sx, nsDeckY, sz),
      makeReliefBox(4.8, 2.35, 5.4, 'wovenBambooWall', sx, nsDeckY + 1.25, sz),
      makeReliefCyl(0.35, 3.8, 3.2, 4, 'nhaRongGrassThatch', sx, nsDeckY + 3.9, sz, Math.PI * 0.25)
    );
  }

  // Item 147 & 153: *Bến Nước Giọt* (Highland Bamboo Water-Drop Spring) & Festival Fire-Pit Ring with log benches
  const springX = houseX + 14.5;
  const springZ = houseZ + 12.5;
  const springY = ctx.getHeight(springX, springZ);
  atlasParts.push(
    makeReliefBox(1.8, 1.4, 0.45, 'volcanicBasaltRock', springX, springY + 0.7, springZ),
    makeReliefCyl(0.06, 0.08, 2.4, 6, 'splitBambooDeck', springX + 0.85, springY + 1.05, springZ, 0, 0, -1.25),
    // Festival plaza fire-pit ring & log benches
    makeReliefCyl(0.85, 0.95, 0.26, 8, 'volcanicBasaltRock', houseX + 11.2, rimY + 0.12, houseZ),
    makeReliefCyl(0.18, 0.18, 2.8, 6, 'tayNguyenDarkHardwood', houseX + 13.6, rimY + 0.22, houseZ, 0, Math.PI * 0.5, 0)
  );
  // Item 152: Iconic Central Highlands *Cây Kơ-nia* umbrella-crown tree anchoring the village square (clear of Kitchen Shed & Nhà Mồ!)
  addOrganicTree(barkParts, leafParts, houseX + 20.5, ctx.getHeight(houseX + 20.5, houseZ + 9.5) - 0.2, houseZ + 9.5, 1.45, 8450, [0x265c28, 0x387434], false);

  // --------------------------------------------------------------------------
  // 7. BIỂN HỒ T'NƯNG SAPPHIRE VOLCANIC CRATER LAKE, BASALT RIM, OVERLOOK PAVILION & HIGHLAND PINES (TN-25..32)
  // ZERO flat plastic cone trees! Replaced with lush multi-tiered *Pinus kesiya* three-needle pines!
  // --------------------------------------------------------------------------
  const lakeX = -455.0;
  const lakeZ = 42.0;
  const lakeY = ctx.getHeight(lakeX, lakeZ) + 0.65;
  // Smooth 32-segment organic sapphire volcanic crater lake surface
  const lakeDisc = remapRelief(new THREE.CylinderGeometry(36.0, 36.0, 0.25, 32), 'sapphireCraterWater');
  lakeDisc.translate(lakeX, lakeY, lakeZ);
  atlasParts.push(lakeDisc);
  // Item 155: Subtle water-ripple ring & shoreline pebble shelf around Biển Hồ T'Nưng crater edge
  const rippleRing = remapRelief(new THREE.TorusGeometry(34.8, 0.35, 6, 32), 'volcanicBasaltRock');
  rippleRing.rotateX(Math.PI * 0.5);
  rippleRing.translate(lakeX, lakeY + 0.08, lakeZ);
  atlasParts.push(rippleRing);

  // Faceted dark volcanic basalt outcrops & red-ochre laterite bank accents ringing the caldera rim (TN-27)
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const rx = lakeX + Math.cos(a) * (35.5 + (i % 3) * 2.2);
    const rz = lakeZ + Math.sin(a) * (35.5 + (i % 2) * 2.0);
    const ry = ctx.getHeight(rx, rz);
    const basalt = remapRelief(createSculptedRockGeometry(6100 + i * 19, 2.8, 2.2, 2.5, 1), 'volcanicBasaltRock');
    basalt.translate(rx, ry + 0.4, rz);
    atlasParts.push(basalt);
    // Item 151: Hexagonal columnar volcanic basalt outcrops (*Cột Đá Bazan*) along crater shoreline
    if (i % 4 === 0) {
      atlasParts.push(makeReliefCyl(0.45, 0.52, 2.4, 6, 'volcanicBasaltRock', rx * 0.99 + lakeX * 0.01, ry + 0.9, rz * 0.99 + lakeZ * 0.01));
    }
  }

  // Prominent Central Highlands Timber Overlook Pavilion (*Nhà Vọng Cảnh Biển Hồ T'Nưng*) on East promontory (-420, 34) (TN-28..29)
  const pavX = -421.0;
  const pavZ = 34.0;
  const pavY = Math.max(lakeY + 5.5, ctx.getHeight(pavX, pavZ));
  atlasParts.push(
    // Stone promontory terrace & viewing walkway projecting out toward sapphire lake
    makeReliefBox(9.2, 4.2, 8.8, 'volcanicBasaltRock', pavX, pavY - 2.1, pavZ),
    makeReliefBox(9.6, 0.28, 9.2, 'splitBambooDeck', pavX, pavY + 0.14, pavZ),
    // Timber walkway guardrail
    makeReliefBox(0.14, 0.92, 9.0, 'tayNguyenDarkHardwood', pavX - 4.6, pavY + 0.62, pavZ),
    // "BIỂN HỒ T'NƯNG" carved highland timber signboard
    makeReliefBox(0.14, 1.05, 3.2, 'tayNguyenDarkHardwood', pavX + 4.4, pavY + 1.4, pavZ - 2.8),
    makeArtPlane(3.05, 0.92, 'bienHoTNungSign', pavX + 4.50, pavY + 1.4, pavZ - 2.8, Math.PI * 0.5)
  );
  // 6 dark hardwood columns + tiered dark grass-thatch hexagonal roof
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * Math.PI * 2;
    atlasParts.push(
      makeReliefCyl(0.16, 0.20, 3.80, 8, 'tayNguyenDarkHardwood', pavX + Math.cos(a) * 3.1, pavY + 1.98, pavZ + Math.sin(a) * 3.1)
    );
  }
  const stairDrop = Math.max(1.0, pavY - (lakeY + 0.65));
  const stairSlope = Math.atan2(stairDrop, 5.6);
  const stairLen = Math.hypot(5.6, stairDrop);
  atlasParts.push(
    makeReliefCyl(1.4, 4.6, 2.1, 6, 'nhaRongGrassThatch', pavX, pavY + 4.8, pavZ),
    makeReliefCyl(0.18, 2.6, 1.65, 6, 'nhaRongGrassThatch', pavX, pavY + 6.55, pavZ),
    // Item 148 (Area Expansion): Sloped descending stone staircase & pile-supported lakeside viewing pier extending toward sapphire crater water
    makeReliefBox(stairLen, 0.42, 2.8, 'volcanicBasaltRock', pavX - 6.8, (pavY + lakeY + 0.65) * 0.5, pavZ, 0, 0, stairSlope),
    makeReliefBox(4.8, stairDrop * 0.75, 2.6, 'volcanicBasaltRock', pavX - 6.0, lakeY + stairDrop * 0.38, pavZ),
    makeReliefBox(6.4, 0.28, 3.2, 'splitBambooDeck', pavX - 10.5, lakeY + 0.65, pavZ),
    // Item 149: Biển Hồ lakeside heritage stone stele on promontory
    makeReliefBox(0.85, 1.85, 0.35, 'volcanicBasaltRock', pavX + 3.2, pavY + 1.05, pavZ + 3.2),
    // Item 156: Red laterite trail curbs linking Nhà Rông plaza to Biển Hồ overlook
    makeReliefBox(11.0, 0.22, 2.2, 'highlandLateriteSoil', pavX + 9.5, ctx.getHeight(pavX + 9.5, pavZ + 4.0) + 0.08, pavZ + 4.0)
  );
  // Item 150 (Area Expansion): Đồi Chè Biển Hồ (tea-plantation contour rows) & Hoa Dã Quỳ (golden wild sunflower) shrubs
  for (let tr = 0; tr < 4; tr++) {
    const tx = lakeX + 26.0 + tr * 3.2;
    const tz = lakeZ + 28.0 + tr * 1.4;
    const ty = ctx.getHeight(tx, tz);
    const teaRow = new THREE.BoxGeometry(10.5, 0.72, 1.15);
    teaRow.rotateY(-0.35);
    teaRow.translate(tx, ty + 0.36, tz);
    colorizeGeo(teaRow, 0x3b7a2c);
    leafParts.push(teaRow);
    const daQuy = new THREE.SphereGeometry(0.45, 6, 5);
    daQuy.translate(tx + 5.6, ty + 0.45, tz - 1.2);
    goldParts.push(daQuy);
  }

  // Lush multi-tiered *Pinus kesiya* three-needle highland pine forest around crater rim & Nhà Rông (ZERO cone trees, clear of all village buildings!) (TN-25, TN-30..32)
  const pinePalette = [0x1c4a24, 0x2a612e, 0x3b7838, 0x4b8742];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const px = lakeX + Math.cos(a) * (41.5 + (i % 3) * 4.5);
    const pz = lakeZ + Math.sin(a) * (41.5 + (i % 2) * 4.0);
    // Keep camera 06 corridor, Nhà Rông, Overlook Pavilion, Pine Lookout, Family Stilt Houses, Granary, Coffee Yard & Tea Hut clear!
    if (Math.hypot(px - (-406), pz - 20) < 16.0) continue;
    if (Math.hypot(px - houseX, pz - houseZ) < 16.5) continue;
    if (Math.hypot(px - pavX, pz - pavZ) < 11.0) continue;
    if (Math.hypot(px - (houseX - 15.5), pz - (houseZ - 17.5)) < 9.5) continue;
    if (Math.hypot(px - (houseX - 15.5), pz - (houseZ + 18.0)) < 9.5) continue;
    if (Math.hypot(px - (houseX - 21.0), pz - (houseZ - 14.5)) < 8.5) continue;
    if (Math.hypot(px - (houseX - 8.5), pz - (houseZ + 22.5)) < 10.5) continue;
    if (Math.hypot(px - (lakeX + 35.5), pz - (lakeZ + 32.0)) < 9.0) continue;
    const py = ctx.getHeight(px, pz);
    addOrganicTree(barkParts, leafParts, px, py - 0.3, pz, 1.15 + (i % 3) * 0.22, 8200 + i * 17, pinePalette, true);
  }
  // Framing pines behind Nhà Rông (strictly clear of Coffee Drying Yard & Roasting Shed!)
  for (const [px, pz, ps, pSeed] of [[-391.0, 61.5, 1.22, 8301], [-425.5, 69.5, 1.28, 8302], [-392, 20, 1.18, 8303]]) {
    addOrganicTree(barkParts, leafParts, px, ctx.getHeight(px, pz) - 0.3, pz, ps, pSeed, pinePalette, true);
  }

  // Merge all Tây Nguyên & Biển Hồ batches
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
  const emberMat = ctx.materialLib
    ? ctx.materialLib.getOrCreateStandard({
        color: '#ff6622',
        emissive: '#ff4400',
        emissiveIntensity: 2.8,
        roughness: 0.4
      })
    : ctx.materials.gold;

  const atlasMesh = createMergedMesh('BienHoAtlasMesh', atlasParts, pack.mySonTayNguyenMasterAtlasMat, true, true);
  if (atlasMesh) group.add(atlasMesh);
  const bronzeMesh = createMergedMesh('BienHoGongsMesh', bronzeParts, ctx.materials.bronze, true, true);
  if (bronzeMesh) group.add(bronzeMesh);
  const goldMesh = createMergedMesh('BienHoGoldMesh', goldParts, ctx.materials.gold, true, true);
  if (goldMesh) group.add(goldMesh);
  const barkMesh = createMergedMesh('BienHoBarkMesh', barkParts, ctx.materials.bark, true, true);
  if (barkMesh) group.add(barkMesh);
  const leafMesh = createMergedMesh('BienHoPinesMesh', leafParts, foliageMat, true, false);
  if (leafMesh) group.add(leafMesh);
  const emberMesh = createMergedMesh('BienHoEmberMesh', emberParts, emberMat, false, false);
  if (emberMesh) group.add(emberMesh);

  // ==========================================================================
  // WAVE 2 UPGRADES (Items 341–360): Tây Nguyên Gong Festival Arena, Coffee
  // Drying Racks, Granary Hut, Brocade Loom & Biển Hồ T'Nưng Lakeside Pier
  // ==========================================================================
  const w2TnAtlas: THREE.BufferGeometry[] = [];
  const w2TnBronze: THREE.BufferGeometry[] = [];
  const w2TnGold: THREE.BufferGeometry[] = [];
  const w2TnLeaf: THREE.BufferGeometry[] = [];

  // 341–345: Circular stone-rimmed Gong Festival Arena (houseX + 11.2, houseZ), Cột Đâm Trâu pole, hewn-log benches, portable gong stand & Rượu Cần hitching rail
  const arX = houseX + 11.2;
  const arZ = houseZ;
  const arY = ctx.getHeight(arX, arZ);
  w2TnAtlas.push(
    makeReliefCyl(4.8, 5.1, 0.22, 6, 'volcanicBasaltRock', arX, arY + 0.11, arZ),
    // 342: Ceremonial Cột Đâm Trâu festival pole with Thổ Cẩm collars
    makeReliefCyl(0.11, 0.15, 5.4, 6, 'thoCamBrocade', arX + 2.8, arY + 2.7, arZ - 2.6),
    // 343: Curved semi-circle of hewn-log spectator benches
    makeReliefCyl(0.20, 0.22, 3.2, 5, 'tayNguyenDarkHardwood', arX + 3.8, arY + 0.26, arZ + 2.2, 0, 0.65, Math.PI * 0.5),
    makeReliefCyl(0.20, 0.22, 3.2, 5, 'tayNguyenDarkHardwood', arX + 0.8, arY + 0.26, arZ + 4.2, 0, -0.25, Math.PI * 0.5),
    // 344: Outdoor festival portable gong stand & buffalo-hide drum
    makeReliefCyl(0.06, 0.07, 1.85, 5, 'splitBambooDeck', arX - 1.8, arY + 0.95, arZ - 3.6),
    makeReliefCyl(0.06, 0.07, 1.85, 5, 'splitBambooDeck', arX + 0.6, arY + 0.95, arZ - 3.6),
    makeReliefBox(2.8, 0.08, 0.08, 'splitBambooDeck', arX - 0.6, arY + 1.82, arZ - 3.6),
    makeReliefCyl(0.32, 0.30, 0.62, 6, 'tayNguyenDarkHardwood', arX + 1.4, arY + 0.52, arZ - 3.4, 0, 0, Math.PI * 0.45),
    // 345: Festival Dàn Chóe Rượu Cần (5 stoneware wine jars lashed to bamboo rail)
    makeReliefBox(3.4, 0.08, 0.08, 'splitBambooDeck', arX - 2.4, arY + 0.85, arZ + 3.4)
  );
  w2TnGold.push(new THREE.ConeGeometry(0.42, 0.65, 5).translate(arX + 2.8, arY + 5.72, arZ - 2.6));
  for (let fg = 0; fg < 3; fg++) {
    w2TnBronze.push(
      new THREE.CylinderGeometry(0.28, 0.28, 0.07, 6).rotateX(Math.PI * 0.5).translate(arX - 1.3 + fg * 0.7, arY + 1.35, arZ - 3.6)
    );
  }
  for (let fj = 0; fj < 5; fj++) {
    w2TnAtlas.push(makeReliefCyl(0.18, 0.24, 0.68, 6, 'ruouCanStoneware', arX - 3.6 + fj * 0.6, arY + 0.42, arZ + 3.4));
  }

  // 346–349 (Area Expansion): Sân Phơi Cà Phê Tây Nguyên sun-drying coffee yard, raised bamboo drying racks, bean mats, rakes/sacks & coffee bush rows
  const cfX = houseX - 8.5;
  const cfZ = houseZ + 22.5;
  const cfY = Math.max(
    ctx.getHeight(cfX, cfZ),
    ctx.getHeight(cfX - 4.6, cfZ - 3.4),
    ctx.getHeight(cfX + 4.6, cfZ - 3.4),
    ctx.getHeight(cfX - 4.6, cfZ + 3.4),
    ctx.getHeight(cfX + 4.6, cfZ + 3.4)
  );
  w2TnAtlas.push(
    makeReliefBox(9.2, 3.6, 6.8, 'volcanicBasaltRock', cfX, cfY - 1.54, cfZ),
    // 348: Wooden coffee-raking push-board, burlap sacks & bamboo winnowing trays
    makeReliefCyl(0.30, 0.34, 0.72, 6, 'nhaRongGrassThatch', cfX + 3.8, cfY + 0.52, cfZ - 1.8),
    makeReliefCyl(0.30, 0.34, 0.72, 6, 'nhaRongGrassThatch', cfX + 3.8, cfY + 0.52, cfZ - 0.9),
    makeReliefCyl(0.45, 0.45, 0.08, 6, 'wovenBambooWall', cfX + 3.6, cfY + 0.32, cfZ + 1.4)
  );
  for (let rk = 0; rk < 3; rk++) {
    const rz = cfZ - 2.0 + rk * 2.0;
    w2TnAtlas.push(
      makeReliefBox(5.6, 0.12, 1.35, 'splitBambooDeck', cfX - 0.8, cfY + 0.88, rz),
      makeReliefBox(5.2, 0.10, 1.15, rk === 1 ? 'highlandLateriteSoil' : 'tayNguyenDarkHardwood', cfX - 0.8, cfY + 0.98, rz),
      makeReliefCyl(0.06, 0.06, 0.75, 5, 'tayNguyenDarkHardwood', cfX - 3.2, cfY + 0.50, rz),
      makeReliefCyl(0.06, 0.06, 0.75, 5, 'tayNguyenDarkHardwood', cfX + 1.6, cfY + 0.50, rz)
    );
    // 349: Lush highland coffee bush rows bordering the drying yard
    const bush = new THREE.ConeGeometry(0.85, 1.15, 5);
    bush.translate(cfX - 6.2, cfY + 0.62, rz);
    colorizeGeo(bush, 0x225a24);
    w2TnLeaf.push(bush);
  }

  // 350–354: Elevated Kho Thóc granary hut, Thổ Cẩm weaving loom & drying racks, Bến Nước Giọt water trough & Nhà Rông firewood stacks
  const grX = houseX - 21.0;
  const grZ = houseZ - 14.5;
  const grY = Math.max(
    ctx.getHeight(grX, grZ),
    ctx.getHeight(grX - 1.2, grZ - 1.2),
    ctx.getHeight(grX + 1.2, grZ - 1.2),
    ctx.getHeight(grX - 1.2, grZ + 1.2),
    ctx.getHeight(grX + 1.2, grZ + 1.2)
  );
  w2TnAtlas.push(
    makeReliefBox(2.8, 1.65, 2.8, 'wovenBambooWall', grX, grY + 2.35, grZ),
    makeReliefCyl(0.18, 2.35, 1.85, 4, 'nhaRongGrassThatch', grX, grY + 4.10, grZ, Math.PI * 0.25),
    // 351–352: Weaving loom & dyed Thổ Cẩm textile drying rack
    makeReliefBox(1.45, 0.88, 0.72, 'tayNguyenDarkHardwood', houseX - 12.2, ctx.getHeight(houseX - 12.2, houseZ - 17.5) + 0.45, houseZ - 17.5),
    makeReliefBox(2.2, 1.15, 0.08, 'thoCamBrocade', houseX - 7.5, ctx.getHeight(houseX - 7.5, houseZ - 15.5) + 1.25, houseZ - 15.5),
    // 353: Dugout log water trough & bamboo water tubes at Bến Nước Giọt
    makeReliefBox(1.85, 0.42, 0.58, 'tayNguyenDarkHardwood', springX + 1.65, springY + 0.24, springZ),
    // 354: Firewood stacks neatly piled under Nhà Rông rear stilt bay
    makeReliefBox(2.2, 0.85, 0.85, 'tayNguyenDarkHardwood', houseX - 2.6, rimY + 0.42, houseZ - 3.8)
  );
  for (const ox of [-1.1, 1.1]) {
    for (const oz of [-1.1, 1.1]) {
      const stGy = ctx.getHeight(grX + ox, grZ + oz) - 0.5;
      const stH = Math.max(1.6, grY + 1.6 - stGy);
      w2TnAtlas.push(
        makeReliefCyl(0.10, 0.12, stH, 5, 'tayNguyenDarkHardwood', grX + ox, stGy + stH * 0.5, grZ + oz),
        makeReliefCyl(0.28, 0.28, 0.08, 6, 'tayNguyenDarkHardwood', grX + ox, grY + 1.35, grZ + oz)
      );
    }
  }

  // 355–360: Biển Hồ T'Nưng viewing pier pilings/railings/bench, highland dugout canoe, descending staircase handrails, tea-harvester hut, Bia Đá Đôi Mắt Pleiku & Hoa Dã Quỳ border
  for (const pxOff of [-13.4, -10.5, -7.6]) {
    for (const pzOff of [-1.5, 1.5]) {
      w2TnAtlas.push(
        makeReliefCyl(0.09, 0.11, 3.4, 5, 'tayNguyenDarkHardwood', pavX + pxOff, lakeY - 0.1, pavZ + pzOff)
      );
    }
  }
  const teaHutX = lakeX + 35.5;
  const teaHutZ = lakeZ + 32.0;
  const teaHutY = Math.max(
    ctx.getHeight(teaHutX, teaHutZ),
    ctx.getHeight(teaHutX - 1.4, teaHutZ - 1.2),
    ctx.getHeight(teaHutX + 1.4, teaHutZ + 1.2)
  );
  w2TnAtlas.push(
    // 355: Pier railings & cantilevered bench overlooking crater lake
    makeReliefBox(6.4, 0.10, 0.10, 'tayNguyenDarkHardwood', pavX - 10.5, lakeY + 1.55, pavZ - 1.5),
    makeReliefBox(6.4, 0.10, 0.10, 'tayNguyenDarkHardwood', pavX - 10.5, lakeY + 1.55, pavZ + 1.5),
    makeReliefBox(0.55, 0.45, 2.4, 'tayNguyenDarkHardwood', pavX - 13.2, lakeY + 1.02, pavZ),
    // 356: Highland dugout fishing canoe moored beside Biển Hồ pier
    makeReliefCyl(0.28, 0.20, 4.4, 6, 'tayNguyenDarkHardwood', pavX - 10.2, lakeY + 0.22, pavZ + 2.8, 0, 0.15, Math.PI * 0.5),
    // 357: Descending staircase basalt cheeks matching sloped stair angle
    makeReliefBox(stairLen, 0.55, 0.28, 'volcanicBasaltRock', pavX - 6.8, (pavY + lakeY + 0.65) * 0.5 + 0.32, pavZ - 1.45, 0, 0, stairSlope),
    makeReliefBox(stairLen, 0.55, 0.28, 'volcanicBasaltRock', pavX - 6.8, (pavY + lakeY + 0.65) * 0.5 + 0.32, pavZ + 1.45, 0, 0, stairSlope),
    // 358: Đồi Chè Biển Hồ wooden tea-harvester shelter hut with retaining plinth
    makeReliefBox(3.2, 2.6, 2.8, 'volcanicBasaltRock', teaHutX, teaHutY - 1.3, teaHutZ),
    makeReliefBox(2.8, 2.1, 2.4, 'wovenBambooWall', teaHutX, teaHutY + 1.05, teaHutZ),
    makeReliefCyl(0.15, 2.2, 1.35, 4, 'nhaRongGrassThatch', teaHutX, teaHutY + 2.75, teaHutZ, Math.PI * 0.25),
    // 359: Carved basalt Bia Đá Đôi Mắt Pleiku heritage marker on rim trail
    makeReliefBox(1.15, 1.65, 0.38, 'volcanicBasaltRock', pavX + 7.8, ctx.getHeight(pavX + 7.8, pavZ + 2.2) + 0.82, pavZ + 2.2),
    // 360: Low split-bamboo trail fence framing Biển Hồ overlook entrance
    makeReliefBox(0.10, 0.72, 4.4, 'splitBambooDeck', pavX + 4.8, pavY + 0.45, pavZ + 4.8)
  );
  for (let dq = 0; dq < 4; dq++) {
    w2TnGold.push(new THREE.ConeGeometry(0.42, 0.48, 5).translate(pavX + 5.2 + dq * 1.4, pavY + 0.35, pavZ + 6.4));
  }

  const w2TnAtlasMesh = createMergedMesh('BienHoWave2Atlas', w2TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w2TnAtlasMesh) group.add(w2TnAtlasMesh);
  const w2TnBronzeMesh = createMergedMesh('BienHoWave2Bronze', w2TnBronze, ctx.materials.bronze, false, true);
  if (w2TnBronzeMesh) group.add(w2TnBronzeMesh);
  const w2TnGoldMesh = createMergedMesh('BienHoWave2Gold', w2TnGold, ctx.materials.gold, false, false);
  if (w2TnGoldMesh) group.add(w2TnGoldMesh);
  const w2TnLeafMesh = createMergedMesh('BienHoWave2Leaf', w2TnLeaf, foliageMat, false, false);
  if (w2TnLeafMesh) group.add(w2TnLeafMesh);

  // ==========================================================================
  // WAVE 3 UPGRADES (Items 681–720): Communal Highland Kitchen, Coffee Roasting
  // Shed, 2nd Ceremonial Gong Rack, Biển Hồ Pine Lookout & Village Details
  // ==========================================================================
  const w3TnAtlas: THREE.BufferGeometry[] = [];
  const w3TnBronze: THREE.BufferGeometry[] = [];
  const w3TnGold: THREE.BufferGeometry[] = [];
  const w3TnLeaf: THREE.BufferGeometry[] = [];
  const w3TnEmber: THREE.BufferGeometry[] = [];

  // 681–686: Nhà Bếp Cộng Đồng Tây Nguyên (Communal Highland Kitchen Shed at houseX + 18.5, houseZ - 14.5)
  const kitX = houseX + 18.5;
  const kitZ = houseZ - 14.5;
  const kitY = Math.max(
    ctx.getHeight(kitX, kitZ),
    ctx.getHeight(kitX - 3.2, kitZ - 2.6),
    ctx.getHeight(kitX + 3.2, kitZ - 2.6),
    ctx.getHeight(kitX - 3.2, kitZ + 2.6),
    ctx.getHeight(kitX + 3.2, kitZ + 2.6)
  );
  w3TnAtlas.push(
    makeReliefBox(6.8, 6.0, 5.6, 'volcanicBasaltRock', kitX, kitY - 2.9, kitZ),
    makeReliefBox(6.4, 0.20, 5.2, 'splitBambooDeck', kitX, kitY + 0.14, kitZ),
    // 682: Pitched grass-thatch gable roof & connecting eave tie-beams
    makeReliefBox(5.6, 0.16, 0.16, 'tayNguyenDarkHardwood', kitX, kitY + 3.12, kitZ - 2.1),
    makeReliefBox(5.6, 0.16, 0.16, 'tayNguyenDarkHardwood', kitX, kitY + 3.12, kitZ + 2.1),
    makeReliefBox(0.16, 0.16, 4.4, 'tayNguyenDarkHardwood', kitX - 2.6, kitY + 3.12, kitZ),
    makeReliefBox(0.16, 0.16, 4.4, 'tayNguyenDarkHardwood', kitX + 2.6, kitY + 3.12, kitZ),
    makeReliefCyl(0.18, 4.4, 2.35, 4, 'nhaRongGrassThatch', kitX, kitY + 4.15, kitZ, Math.PI * 0.25),
    // 683–686: Central clay hearth, suspended smoking rack (supported by 2 hearth posts!), stacked clay pots, firewood & chopping block
    makeReliefCyl(0.85, 0.95, 0.34, 6, 'volcanicBasaltRock', kitX, kitY + 0.38, kitZ),
    makeReliefCyl(0.04, 0.05, 2.15, 5, 'tayNguyenDarkHardwood', kitX - 0.85, kitY + 1.12, kitZ),
    makeReliefCyl(0.04, 0.05, 2.15, 5, 'tayNguyenDarkHardwood', kitX + 0.85, kitY + 1.12, kitZ),
    makeReliefBox(1.85, 0.08, 1.25, 'splitBambooDeck', kitX, kitY + 2.15, kitZ),
    makeReliefCyl(0.24, 0.28, 0.36, 6, 'ruouCanStoneware', kitX + 1.8, kitY + 0.42, kitZ - 1.2),
    makeReliefCyl(0.24, 0.28, 0.36, 6, 'ruouCanStoneware', kitX + 1.8, kitY + 0.42, kitZ - 0.5),
    makeReliefBox(1.45, 0.65, 0.65, 'tayNguyenDarkHardwood', kitX - 2.0, kitY + 0.52, kitZ - 1.4),
    makeReliefCyl(0.28, 0.30, 0.48, 6, 'tayNguyenDarkHardwood', kitX - 1.6, kitY + 0.45, kitZ + 1.2)
  );
  for (const kxO of [-2.6, 2.6]) {
    for (const kzO of [-2.1, 2.1]) {
      w3TnAtlas.push(makeReliefCyl(0.11, 0.13, 3.35, 5, 'tayNguyenDarkHardwood', kitX + kxO, kitY + 1.65, kitZ + kzO));
    }
  }
  w3TnEmber.push(new THREE.ConeGeometry(0.45, 0.35, 5).translate(kitX, kitY + 0.65, kitZ));

  // 687–691, 702–703: Nhà Rang Cà Phê Tây Nguyên (Traditional Highland Coffee Roasting Shed at houseX - 2.0, houseZ + 28.5)
  const crX = houseX - 2.0;
  const crZ = houseZ + 28.5;
  const crY = Math.max(
    ctx.getHeight(crX, crZ),
    ctx.getHeight(crX - 3.0, crZ - 2.4),
    ctx.getHeight(crX + 3.0, crZ - 2.4),
    ctx.getHeight(crX - 3.0, crZ + 2.4),
    ctx.getHeight(crX + 3.0, crZ + 2.4)
  );
  w3TnAtlas.push(
    makeReliefBox(6.4, 6.0, 5.2, 'volcanicBasaltRock', crX, crY - 2.9, crZ),
    makeReliefBox(6.0, 0.18, 4.8, 'splitBambooDeck', crX, crY + 0.12, crZ),
    // 688: Pitched thatch roof with connecting eave tie-beams
    makeReliefBox(5.2, 0.16, 0.16, 'tayNguyenDarkHardwood', crX, crY + 3.02, crZ - 1.9),
    makeReliefBox(5.2, 0.16, 0.16, 'tayNguyenDarkHardwood', crX, crY + 3.02, crZ + 1.9),
    makeReliefBox(0.16, 0.16, 4.0, 'tayNguyenDarkHardwood', crX - 2.5, crY + 3.02, crZ),
    makeReliefBox(0.16, 0.16, 4.0, 'tayNguyenDarkHardwood', crX + 2.5, crY + 3.02, crZ),
    makeReliefCyl(0.18, 4.1, 2.15, 4, 'nhaRongGrassThatch', crX, crY + 3.95, crZ, Math.PI * 0.25),
    // 689–691: Basalt firebox, wooden cooling-tray table with roasted beans, burlap sacks & tasting counter
    makeReliefBox(1.25, 0.72, 1.05, 'volcanicBasaltRock', crX - 1.2, crY + 0.55, crZ),
    makeReliefBox(1.65, 0.78, 0.95, 'tayNguyenDarkHardwood', crX + 1.2, crY + 0.58, crZ),
    makeReliefBox(1.50, 0.10, 0.82, 'highlandLateriteSoil', crX + 1.2, crY + 1.02, crZ),
    makeReliefCyl(0.30, 0.34, 0.72, 6, 'nhaRongGrassThatch', crX + 2.2, crY + 0.55, crZ - 1.4),
    makeReliefBox(2.2, 0.85, 0.65, 'tayNguyenDarkHardwood', crX, crY + 0.60, crZ + 1.8)
  );
  for (const rxO of [-2.5, 2.5]) {
    for (const rzO of [-1.9, 1.9]) {
      w3TnAtlas.push(makeReliefCyl(0.10, 0.12, 3.25, 5, 'tayNguyenDarkHardwood', crX + rxO, crY + 1.60, crZ + rzO));
    }
  }
  // 689: Cylindrical bronze hand-crank coffee roaster drum over firebox
  w3TnBronze.push(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 6).rotateZ(Math.PI * 0.5).translate(crX - 1.2, crY + 1.18, crZ));

  // 692–701, 716–718: 2nd Ceremonial Bamboo Gong Rack (5 bronze gongs + buffalo drum), Nhà Rông trims,
  // Buôn Làng festival fence, extra Tượng Nhà Mồ totems, Kho Thóc ladder, Bến Nước Giọt paving & arena torches
  w3TnAtlas.push(
    // 692 & 694: South ceremonial bamboo gong rack & X-frame Trống Da Trâu stand
    makeReliefCyl(0.06, 0.07, 1.95, 5, 'splitBambooDeck', arX - 3.2, arY + 0.98, arZ + 4.8),
    makeReliefCyl(0.06, 0.07, 1.95, 5, 'splitBambooDeck', arX + 0.2, arY + 0.98, arZ + 4.8),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', arX - 1.5, arY + 1.90, arZ + 4.8),
    makeReliefCyl(0.34, 0.32, 0.68, 6, 'tayNguyenDarkHardwood', arX + 1.4, arY + 0.55, arZ + 4.6, 0, 0, Math.PI * 0.45),
    // 695–697: Nhà Rông under-croft weaving bench & staircase hornbill newel posts
    makeReliefBox(2.2, 0.48, 0.72, 'splitBambooDeck', houseX + 2.4, rimY + 0.24, houseZ + 3.4),
    makeReliefCyl(0.11, 0.13, 1.65, 5, 'tayNguyenDarkHardwood', houseX + 5.8, rimY + 0.82, houseZ - 1.4),
    makeReliefCyl(0.11, 0.13, 1.65, 5, 'tayNguyenDarkHardwood', houseX + 5.8, rimY + 0.82, houseZ + 1.4),
    // 698: Buôn Làng festival split-bamboo perimeter fence & totem entrance posts
    makeReliefBox(0.12, 0.92, 8.5, 'splitBambooDeck', arX + 6.4, arY + 0.46, arZ - 6.5),
    makeReliefCyl(0.14, 0.18, 2.85, 5, 'thoCamBrocade', arX + 6.4, arY + 1.42, arZ - 2.2),
    // 700–701: Kho Thóc notched wooden climbing ladder & Bến Nước Giọt stepped basalt paving
    makeReliefBox(0.45, 2.2, 0.14, 'tayNguyenDarkHardwood', grX + 1.6, grY + 1.05, grZ, 0, 0, 0.42),
    makeReliefBox(2.8, 0.24, 2.4, 'volcanicBasaltRock', springX + 1.5, springY + 0.12, springZ)
  );
  // 693: 5 graduated bronze Chiêng gongs suspended on south ceremonial rack
  for (let sg = 0; sg < 5; sg++) {
    const r = 0.28 - sg * 0.025;
    w3TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 6).rotateX(Math.PI * 0.5).translate(arX - 2.8 + sg * 0.65, arY + 1.42, arZ + 4.8));
  }
  // 699: 2 additional carved Tượng Nhà Mồ funerary totem posts along north forest edge
  for (const txO of [-14.0, -10.5]) {
    const ty = ctx.getHeight(houseX + txO, houseZ - 22.0);
    w3TnAtlas.push(makeReliefCyl(0.14, 0.18, 2.45, 5, 'tayNguyenDarkHardwood', houseX + txO, ty + 1.20, houseZ - 22.0));
  }
  // 717: 4 corner bamboo torch stands with glowing ember tips around Gong Festival Arena
  for (const [txO, tzO] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]] as const) {
    w3TnAtlas.push(makeReliefCyl(0.05, 0.06, 1.85, 5, 'splitBambooDeck', arX + txO, arY + 0.92, arZ + tzO));
    w3TnEmber.push(new THREE.ConeGeometry(0.14, 0.24, 5).translate(arX + txO, arY + 1.95, arZ + tzO));
  }

  // 704–715, 719–720: Đài Vọng Cảnh Rừng Thông Biển Hồ (Biển Hồ Elevated Pine Lookout Deck at pavX + 12.5, pavZ - 16.5),
  // lakeside pier lanterns, 2nd dugout canoe, basalt cairns, Đồi Chè trail stairs & pine/sunflower borders
  const plX = pavX + 12.5;
  const plZ = pavZ - 16.5;
  const plY = Math.max(
    ctx.getHeight(plX, plZ),
    ctx.getHeight(plX - 4.2, plZ - 3.2),
    ctx.getHeight(plX + 4.2, plZ - 3.2),
    ctx.getHeight(plX - 4.2, plZ + 3.2),
    ctx.getHeight(plX + 4.2, plZ + 3.2)
  );
  w3TnAtlas.push(
    // 704–705: Deep basalt retaining skirt (-3.5m), cantilevered timber deck & handrail posts
    makeReliefBox(8.6, 7.0, 6.6, 'volcanicBasaltRock', plX, plY - 3.4, plZ),
    makeReliefBox(9.0, 0.24, 7.0, 'splitBambooDeck', plX, plY + 0.16, plZ),
    makeReliefBox(8.8, 0.10, 0.10, 'tayNguyenDarkHardwood', plX, plY + 1.15, plZ - 3.3),
    makeReliefBox(8.8, 0.10, 0.10, 'tayNguyenDarkHardwood', plX, plY + 1.15, plZ + 3.3),
    // 706: Shaded timber gable pergola with 4 grounded posts & viewing bench
    makeReliefBox(4.8, 0.18, 3.6, 'tayNguyenDarkHardwood', plX + 1.2, plY + 3.15, plZ),
    makeReliefBox(2.4, 0.46, 0.58, 'tayNguyenDarkHardwood', plX + 1.2, plY + 0.45, plZ),
    // 708: Stepped basalt trail stairs connecting rim path to pine lookout
    makeReliefBox(2.4, 0.45, 4.2, 'volcanicBasaltRock', plX - 2.2, plY - 0.15, plZ + 5.2),
    // 710–712: Pier lantern posts, 2nd highland dugout canoe on shoreline & columnar basalt cairn
    makeReliefCyl(0.05, 0.06, 1.95, 5, 'tayNguyenDarkHardwood', pavX - 13.2, lakeY + 1.45, pavZ - 1.5),
    makeReliefCyl(0.05, 0.06, 1.95, 5, 'tayNguyenDarkHardwood', pavX - 13.2, lakeY + 1.45, pavZ + 1.5),
    makeReliefCyl(0.26, 0.18, 4.2, 6, 'tayNguyenDarkHardwood', pavX - 6.8, lakeY + 0.32, pavZ - 5.2, 0, -0.22, Math.PI * 0.5),
    makeReliefCyl(0.45, 0.58, 1.65, 6, 'volcanicBasaltRock', pavX - 5.2, lakeY + 0.72, pavZ - 8.5),
    // 713–715: Đồi Chè stepped laterite trail & resting bench beside tea shelter
    makeReliefBox(1.85, 0.45, 0.55, 'tayNguyenDarkHardwood', teaHutX + 2.4, teaHutY + 0.24, teaHutZ)
  );
  for (const pxO of [-1.1, 3.5]) {
    for (const pzO of [-1.6, 1.6]) {
      w3TnAtlas.push(makeReliefCyl(0.09, 0.11, 3.15, 5, 'tayNguyenDarkHardwood', plX + pxO, plY + 1.58, plZ + pzO));
    }
  }
  // 707 & 709: Brass panoramic crater-lake map lectern (with grounded post!) & Biển Hồ pavilion gilded sun-crest finial
  w3TnAtlas.push(makeReliefCyl(0.08, 0.10, 1.05, 5, 'tayNguyenDarkHardwood', plX - 3.6, plY + 0.62, plZ));
  w3TnGold.push(
    new THREE.BoxGeometry(0.85, 0.10, 0.55).rotateZ(0.28).translate(plX - 3.6, plY + 1.18, plZ),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(pavX - 13.2, lakeY + 2.52, pavZ - 1.5),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(pavX - 13.2, lakeY + 2.52, pavZ + 1.5)
  );
  // 719–720: Pinus kesiya highland pines & Hoa Dã Quỳ wild sunflower clusters framing Pine Lookout & Coffee Shed (deeply rooted -1.0m & >= 4.5m clear!)
  for (const [tx, tz] of [[plX + 8.5, plZ - 5.0], [plX + 8.2, plZ + 5.2], [crX - 7.5, crZ + 4.2]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w3TnAtlas.push(makeReliefCyl(0.16, 0.22, 5.6, 5, 'tayNguyenDarkHardwood', tx, ty + 1.8, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 5).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w3TnLeaf.push(pine);
    w3TnGold.push(new THREE.ConeGeometry(0.45, 0.52, 5).translate(tx + 1.8, ty + 0.32, tz + 1.4));
  }

  const w3TnAtlasMesh = createMergedMesh('BienHoWave3Atlas', w3TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w3TnAtlasMesh) group.add(w3TnAtlasMesh);
  const w3TnBronzeMesh = createMergedMesh('BienHoWave3Bronze', w3TnBronze, ctx.materials.bronze, false, true);
  if (w3TnBronzeMesh) group.add(w3TnBronzeMesh);
  const w3TnGoldMesh = createMergedMesh('BienHoWave3Gold', w3TnGold, ctx.materials.gold, false, false);
  if (w3TnGoldMesh) group.add(w3TnGoldMesh);
  const w3TnLeafMesh = createMergedMesh('BienHoWave3Leaf', w3TnLeaf, foliageMat, false, false);
  if (w3TnLeafMesh) group.add(w3TnLeafMesh);
  const w3TnEmberMesh = createMergedMesh('BienHoWave3Ember', w3TnEmber, emberMat, false, false);
  if (w3TnEmberMesh) group.add(w3TnEmberMesh);

  // ==========================================================================
  // WAVE 4 UPGRADES (Items 1081–1120): Highland Coffee Tasting Pavilion,
  // Gong Festival Amphitheater, Đồi Chè Watchtower & Buôn Làng Cultural Details
  // ==========================================================================
  const w4TnAtlas: THREE.BufferGeometry[] = [];
  const w4TnBronze: THREE.BufferGeometry[] = [];
  const w4TnGold: THREE.BufferGeometry[] = [];
  const w4TnLeaf: THREE.BufferGeometry[] = [];

  // 1081–1084: Nhà Thưởng Thức Cà Phê Tây Nguyên (Highland Coffee Tasting Stilt Pavilion at houseX + 10.5, houseZ + 24.5)
  const ctPavX = houseX + 10.5;
  const ctPavZ = houseZ + 24.5;
  const ctPavY = Math.max(ctx.getHeight(ctPavX, ctPavZ), ctx.getHeight(ctPavX - 3.2, ctPavZ - 2.6), ctx.getHeight(ctPavX + 3.2, ctPavZ + 2.6));
  w4TnAtlas.push(
    makeReliefBox(6.8, 5.8, 5.4, 'volcanicBasaltRock', ctPavX, ctPavY - 2.8, ctPavZ),
    makeReliefBox(6.4, 0.22, 5.0, 'splitBambooDeck', ctPavX, ctPavY + 0.15, ctPavZ),
    makeReliefBox(5.6, 0.16, 0.16, 'tayNguyenDarkHardwood', ctPavX, ctPavY + 3.12, ctPavZ - 2.1),
    makeReliefBox(5.6, 0.16, 0.16, 'tayNguyenDarkHardwood', ctPavX, ctPavY + 3.12, ctPavZ + 2.1),
    makeReliefCyl(0.18, 4.4, 2.35, 4, 'nhaRongGrassThatch', ctPavX, ctPavY + 4.15, ctPavZ, Math.PI * 0.25),
    // 1083–1084: Brew-bar counter, stools & stepped timber stairs
    makeReliefBox(3.4, 0.92, 0.72, 'tayNguyenDarkHardwood', ctPavX, ctPavY + 0.65, ctPavZ - 0.8),
    makeReliefCyl(0.24, 0.26, 0.52, 6, 'tayNguyenDarkHardwood', ctPavX - 0.9, ctPavY + 0.45, ctPavZ + 0.4),
    makeReliefCyl(0.24, 0.26, 0.52, 6, 'tayNguyenDarkHardwood', ctPavX + 0.9, ctPavY + 0.45, ctPavZ + 0.4),
    makeReliefBox(2.2, 0.35, 1.45, 'splitBambooDeck', ctPavX - 3.8, ctPavY + 0.12, ctPavZ)
  );
  for (const ox of [-2.6, 2.6]) {
    for (const oz of [-2.1, 2.1]) {
      w4TnAtlas.push(makeReliefCyl(0.11, 0.13, 3.25, 5, 'tayNguyenDarkHardwood', ctPavX + ox, ctPavY + 1.62, ctPavZ + oz));
    }
  }
  w4TnBronze.push(new THREE.CylinderGeometry(0.14, 0.16, 0.26, 6).translate(ctPavX, ctPavY + 1.24, ctPavZ - 0.8));

  // 1085–1087: Khán Đài Cồng Chiêng (Semi-Circular Basalt Gong Amphitheater east of Gong Arena at arX + 9.5, arZ)
  const ampX = arX + 9.5;
  const ampZ = arZ;
  const ampY = Math.max(ctx.getHeight(ampX, ampZ), ctx.getHeight(ampX - 2.5, ampZ - 4.5), ctx.getHeight(ampX + 2.5, ampZ + 4.5));
  for (let tier = 0; tier < 3; tier++) {
    w4TnAtlas.push(makeReliefBox(1.45, 0.48 + tier * 0.42, 8.8 - tier * 0.8, 'volcanicBasaltRock', ampX + tier * 1.4, ampY + (0.48 + tier * 0.42) * 0.5, ampZ));
  }
  // 1087: Elders' 4-post thatch canopy crowning upper tier
  w4TnAtlas.push(makeReliefBox(2.8, 0.22, 4.6, 'nhaRongGrassThatch', ampX + 3.2, ampY + 3.85, ampZ));
  for (const ox of [-1.1, 1.1]) {
    for (const oz of [-1.9, 1.9]) {
      w4TnAtlas.push(makeReliefCyl(0.08, 0.10, 2.85, 5, 'tayNguyenDarkHardwood', ampX + 3.2 + ox, ampY + 2.48, ampZ + oz));
    }
  }

  // 1088–1090: Chòi Vọng Cảnh Đồi Chè (Tea-Hill Timber Watchtower Pavilion at lakeX + 42.0, lakeZ + 38.0)
  const twX = lakeX + 42.0;
  const twZ = lakeZ + 38.0;
  const twY = Math.max(ctx.getHeight(twX, twZ), ctx.getHeight(twX - 2.0, twZ - 2.0), ctx.getHeight(twX + 2.0, twZ + 2.0));
  w4TnAtlas.push(
    makeReliefBox(4.4, 4.8, 4.4, 'volcanicBasaltRock', twX, twY - 2.3, twZ),
    makeReliefBox(3.8, 0.22, 3.8, 'splitBambooDeck', twX, twY + 2.2, twZ),
    makeReliefCyl(0.16, 3.0, 1.85, 4, 'nhaRongGrassThatch', twX, twY + 5.75, twZ, Math.PI * 0.25),
    makeReliefBox(0.48, 2.6, 0.14, 'tayNguyenDarkHardwood', twX - 2.2, twY + 1.15, twZ, 0, 0, -0.35)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.6, 1.6]) {
      w4TnAtlas.push(makeReliefCyl(0.10, 0.12, 5.15, 5, 'tayNguyenDarkHardwood', twX + ox, twY + 2.48, twZ + oz));
    }
  }

  // 1091–1120: Hornbill gateway pillars, Đàn T'rưng xylophone, Bến Nước Giọt 4-post spring canopy, Tượng Nhà Mồ funerary canopy,
  // Dệt Thổ Cẩm 4-post loom shelter, Biển Hồ floating fishing raft, 3rd dugout canoe, Đàn K'lông Pút & outer pines
  w4TnAtlas.push(
    // 1091: Twin hornbill totem gateway pillars
    makeReliefCyl(0.14, 0.18, 3.6, 5, 'thoCamBrocade', houseX + 16.5, rimY + 1.8, houseZ - 3.5),
    makeReliefCyl(0.14, 0.18, 3.6, 5, 'thoCamBrocade', houseX + 16.5, rimY + 1.8, houseZ + 3.5),
    // 1102: Bến Nước Giọt 4-post thatched spring shrine canopy
    makeReliefBox(3.2, 0.18, 3.2, 'nhaRongGrassThatch', springX + 1.5, springY + 2.65, springZ),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', springX + 0.1, springY + 1.32, springZ - 1.4),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', springX + 2.9, springY + 1.32, springZ - 1.4),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', springX + 0.1, springY + 1.32, springZ + 1.4),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', springX + 2.9, springY + 1.32, springZ + 1.4),
    // 1105: Dệt Thổ Cẩm 4-post thatched loom shelter (houseX - 12.2, houseZ - 17.5)
    makeReliefBox(3.4, 0.18, 3.0, 'nhaRongGrassThatch', houseX - 12.2, ctx.getHeight(houseX - 12.2, houseZ - 17.5) + 2.65, houseZ - 17.5),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', houseX - 13.7, ctx.getHeight(houseX - 12.2, houseZ - 17.5) + 1.32, houseZ - 18.8),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', houseX - 10.7, ctx.getHeight(houseX - 12.2, houseZ - 17.5) + 1.32, houseZ - 18.8),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', houseX - 13.7, ctx.getHeight(houseX - 12.2, houseZ - 17.5) + 1.32, houseZ - 16.2),
    makeReliefCyl(0.07, 0.08, 2.75, 5, 'tayNguyenDarkHardwood', houseX - 10.7, ctx.getHeight(houseX - 12.2, houseZ - 17.5) + 1.32, houseZ - 16.2),
    // 1109, 1113, 1115–1116: Biển Hồ floating fishing raft, 3rd dugout canoe, Đàn K'lông Pút rack & Buôn Làng welcome stele
    makeReliefBox(4.8, 0.22, 3.6, 'splitBambooDeck', lakeX + 18.0, lakeY + 0.22, lakeZ - 24.0),
    makeReliefCyl(0.26, 0.18, 4.2, 6, 'tayNguyenDarkHardwood', lakeX + 28.0, lakeY + 0.35, lakeZ + 22.0, 0, 0.28, Math.PI * 0.5),
    makeReliefBox(1.85, 1.35, 0.18, 'splitBambooDeck', arX - 3.6, arY + 0.85, arZ - 1.2),
    makeReliefBox(1.25, 1.85, 0.42, 'volcanicBasaltRock', arX + 15.5, ctx.getHeight(arX + 15.5, arZ) + 0.92, arZ)
  );
  w4TnGold.push(
    new THREE.ConeGeometry(0.28, 0.55, 5).translate(houseX + 16.5, rimY + 3.85, houseZ - 3.5),
    new THREE.ConeGeometry(0.28, 0.55, 5).translate(houseX + 16.5, rimY + 3.85, houseZ + 3.5),
    new THREE.CylinderGeometry(0.06, 0.08, 1.15, 5).translate(plX - 3.6, plY + 0.68, plZ - 2.2)
  );
  // 1118–1120: Outer highland pines & Hoa Dã Quỳ (>= 8.5m clear of all buildings!)
  for (const [tx, tz] of [[ctPavX + 9.0, ctPavZ + 6.0], [twX + 9.0, twZ + 4.5], [ampX + 9.5, ampZ - 8.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w4TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.8, 5, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.3, 5.0, 5).translate(tx, ty + 6.0, tz);
    colorizeGeo(pine, 0x1d4d24);
    w4TnLeaf.push(pine);
  }

  const w4TnAtlasMesh = createMergedMesh('BienHoWave4Atlas', w4TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w4TnAtlasMesh) group.add(w4TnAtlasMesh);
  const w4TnBronzeMesh = createMergedMesh('BienHoWave4Bronze', w4TnBronze, ctx.materials.bronze, false, true);
  if (w4TnBronzeMesh) group.add(w4TnBronzeMesh);
  const w4TnGoldMesh = createMergedMesh('BienHoWave4Gold', w4TnGold, ctx.materials.gold, false, false);
  if (w4TnGoldMesh) group.add(w4TnGoldMesh);
  const w4TnLeafMesh = createMergedMesh('BienHoWave4Leaf', w4TnLeaf, foliageMat, false, false);
  if (w4TnLeafMesh) group.add(w4TnLeafMesh);

  // ==========================================================================
  // WAVE 5 UPGRADES (Items 1481–1520): Communal Coffee-Drying Terrace, Gong &
  // Folk Wood-Carving Gallery, Biển Hồ West Sunset Deck & Đồi Chè Shade Hut
  // ==========================================================================
  const w5TnAtlas: THREE.BufferGeometry[] = [];
  const w5TnBronze: THREE.BufferGeometry[] = [];
  const w5TnGold: THREE.BufferGeometry[] = [];
  const w5TnLeaf: THREE.BufferGeometry[] = [];

  // 1481–1486: Sân Phơi Cà Phê Tây Nguyên (Communal Highland Coffee-Drying & Roasting Terrace at houseX - 18.5, houseZ + 18.5)
  const w5CfX = houseX - 18.5;
  const w5CfZ = houseZ + 18.5;
  const w5CfY = Math.max(ctx.getHeight(w5CfX, w5CfZ), ctx.getHeight(w5CfX - 4.5, w5CfZ - 3.8), ctx.getHeight(w5CfX + 4.5, w5CfZ + 3.8));
  w5TnAtlas.push(
    makeReliefBox(9.4, 6.4, 7.8, 'volcanicBasaltRock', w5CfX, w5CfY - 3.1, w5CfZ),
    makeReliefBox(9.0, 0.20, 7.4, 'splitBambooDeck', w5CfX, w5CfY + 0.12, w5CfZ),
    // 1484: 4-post thatched coffee-roasting shelter (grounded columns + flush roof)
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', w5CfX - 2.2, w5CfY + 3.05, w5CfZ - 1.6),
    // 1485–1486: Burlap coffee-sack stack & sorting bench
    makeReliefBox(1.45, 0.85, 1.05, 'nhaRongGrassThatch', w5CfX - 2.8, w5CfY + 0.58, w5CfZ + 1.8),
    makeReliefBox(2.2, 0.46, 0.58, 'tayNguyenDarkHardwood', w5CfX + 2.2, w5CfY + 0.42, w5CfZ + 2.4)
  );
  for (const ox of [-3.8, -0.6]) {
    for (const oz of [-2.9, -0.3]) {
      w5TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 5, 'tayNguyenDarkHardwood', w5CfX + ox, w5CfY + 1.52, w5CfZ + oz));
    }
  }
  // 1483: 4 raised split-bamboo coffee-bean drying tables
  for (const [dx, dz] of [[1.4, -2.0], [3.4, -2.0], [1.4, 0.2], [3.4, 0.2]] as const) {
    w5TnAtlas.push(makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX + dx, w5CfY + 0.52, w5CfZ + dz));
  }
  w5TnBronze.push(new THREE.CylinderGeometry(0.32, 0.32, 0.78, 6).rotateZ(Math.PI * 0.5).translate(w5CfX - 2.2, w5CfY + 0.95, w5CfZ - 1.6));

  // 1487–1496: Sân Cồng Chiêng & Vườn Tượng Gỗ (Communal Gong Terrace & Folk Wood-Carving Gallery at arX - 9.5, arZ + 10.5)
  const vgX = arX - 9.5;
  const vgZ = arZ + 10.5;
  const vgY = Math.max(ctx.getHeight(vgX, vgZ), ctx.getHeight(vgX - 3.8, vgZ - 3.2), ctx.getHeight(vgX + 3.8, vgZ + 3.2));
  w5TnAtlas.push(
    makeReliefBox(8.2, 5.6, 6.8, 'volcanicBasaltRock', vgX, vgY - 2.7, vgZ),
    // 1494: 3rd ceremonial bamboo gong rack
    makeReliefCyl(0.06, 0.07, 1.95, 5, 'splitBambooDeck', vgX - 1.8, vgY + 0.98, vgZ - 2.2),
    makeReliefCyl(0.06, 0.07, 1.95, 5, 'splitBambooDeck', vgX + 1.8, vgY + 0.98, vgZ - 2.2),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', vgX, vgY + 1.90, vgZ - 2.2),
    // 1495–1496: Rượu Cần wine-jar stands & brocade gallery archway
    makeReliefCyl(0.24, 0.30, 0.72, 6, 'tayNguyenDarkHardwood', vgX - 2.8, vgY + 0.52, vgZ + 1.8),
    makeReliefCyl(0.24, 0.30, 0.72, 6, 'tayNguyenDarkHardwood', vgX + 2.8, vgY + 0.52, vgZ + 1.8),
    makeReliefCyl(0.11, 0.13, 3.25, 5, 'thoCamBrocade', vgX + 3.8, vgY + 1.62, vgZ - 1.6),
    makeReliefCyl(0.11, 0.13, 3.25, 5, 'thoCamBrocade', vgX + 3.8, vgY + 1.62, vgZ + 1.6),
    makeReliefBox(0.22, 0.36, 3.6, 'thoCamBrocade', vgX + 3.8, vgY + 3.25, vgZ)
  );
  // 1488–1493: 6 carved hardwood Tượng Gỗ Tây Nguyên folk statues on basalt plinths
  for (let st = 0; st < 6; st++) {
    const sx = vgX - 2.5 + (st % 3) * 2.5;
    const sz = vgZ + (st < 3 ? -0.4 : 1.8);
    w5TnAtlas.push(
      makeReliefBox(0.65, 0.42, 0.65, 'volcanicBasaltRock', sx, vgY + 0.25, sz),
      makeReliefCyl(0.16, 0.20, 1.55, 5, 'tayNguyenDarkHardwood', sx, vgY + 1.18, sz)
    );
  }
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.26 - sg * 0.02;
    w5TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 6).rotateX(Math.PI * 0.5).translate(vgX - 1.15 + sg * 0.76, vgY + 1.42, vgZ - 2.2));
  }

  // 1497–1520: Nhà Rông rice-pounding mortar & Cây Nêu, Biển Hồ West Sunset Deck (lakeX - 24, lakeZ + 22),
  // lotus research pontoon, 4th dugout canoe, Đồi Chè tea-picker shade hut, Hoa Dã Quỳ & outer pines
  const wsX = lakeX - 24.0;
  const wsZ = lakeZ + 22.0;
  const wsY = Math.max(ctx.getHeight(wsX, wsZ), ctx.getHeight(wsX - 3.6, wsZ - 3.0), ctx.getHeight(wsX + 3.6, wsZ + 3.0));
  const thX = lakeX + 36.0;
  const thZ = lakeZ + 30.0;
  const thY = Math.max(ctx.getHeight(thX, thZ), ctx.getHeight(thX - 2.0, thZ - 2.0), ctx.getHeight(thX + 2.0, thZ + 2.0));
  w5TnAtlas.push(
    // 1498–1501: Nhà Rông mortar-and-pestle, basket rack & tall Cây Nêu festival pole
    makeReliefCyl(0.32, 0.24, 0.72, 6, 'tayNguyenDarkHardwood', houseX - 2.8, rimY + 0.36, houseZ + 3.8),
    makeReliefBox(1.85, 1.15, 0.55, 'splitBambooDeck', houseX + 6.4, rimY + 0.58, houseZ + 4.2),
    makeReliefCyl(0.08, 0.12, 7.2, 5, 'thoCamBrocade', arX - 5.2, arY + 3.55, arZ - 5.2),
    // 1505–1508: Biển Hồ West Sunset Viewing Deck (-3.4m basalt skirt, deck, 4-post thatched shelter & bench)
    makeReliefBox(7.8, 6.8, 6.4, 'volcanicBasaltRock', wsX, wsY - 3.3, wsZ),
    makeReliefBox(8.2, 0.24, 6.8, 'splitBambooDeck', wsX, wsY + 0.16, wsZ),
    makeReliefBox(8.0, 0.10, 0.10, 'tayNguyenDarkHardwood', wsX, wsY + 1.15, wsZ - 3.2),
    makeReliefBox(3.6, 0.22, 3.2, 'nhaRongGrassThatch', wsX - 1.6, wsY + 3.05, wsZ + 0.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', wsX + 1.8, wsY + 0.42, wsZ - 1.2),
    // 1510–1511: Floating lotus-conservation pontoon & 4th highland dugout canoe
    makeReliefBox(4.2, 0.22, 3.2, 'splitBambooDeck', lakeX - 10.0, lakeY + 0.22, lakeZ + 16.0),
    makeReliefCyl(0.26, 0.18, 4.2, 6, 'tayNguyenDarkHardwood', lakeX - 18.0, lakeY + 0.34, lakeZ + 14.0, 0, -0.32, Math.PI * 0.5),
    // 1513–1514: Đồi Chè 4-post bamboo tea-picker shade hut & harvest baskets
    makeReliefBox(4.2, 4.4, 3.8, 'volcanicBasaltRock', thX, thY - 2.1, thZ),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', thX, thY + 2.85, thZ),
    makeReliefCyl(0.32, 0.24, 0.55, 6, 'splitBambooDeck', thX + 2.2, thY + 0.38, thZ),
    // 1516–1517: Buôn Làng welcome archway & Bến Nước Giọt spout plinth
    makeReliefCyl(0.14, 0.18, 3.8, 5, 'tayNguyenDarkHardwood', arX + 15.5, ctx.getHeight(arX + 15.5, arZ + 4.5) + 1.85, arZ + 2.5),
    makeReliefCyl(0.14, 0.18, 3.8, 5, 'tayNguyenDarkHardwood', arX + 15.5, ctx.getHeight(arX + 15.5, arZ + 4.5) + 1.85, arZ + 6.5),
    makeReliefBox(0.28, 0.36, 4.4, 'thoCamBrocade', arX + 15.5, ctx.getHeight(arX + 15.5, arZ + 4.5) + 3.72, arZ + 4.5),
    makeReliefBox(1.15, 0.65, 1.15, 'volcanicBasaltRock', springX - 0.8, springY + 0.32, springZ)
  );
  for (const ox of [-3.1, -0.1]) {
    for (const oz of [-0.5, 2.1]) {
      w5TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 5, 'tayNguyenDarkHardwood', wsX + ox, wsY + 1.52, wsZ + oz));
    }
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w5TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 5, 'tayNguyenDarkHardwood', thX + ox, thY + 1.42, thZ + oz));
    }
  }
  w5TnGold.push(
    new THREE.ConeGeometry(0.30, 0.62, 5).translate(arX - 5.2, arY + 7.45, arZ - 5.2),
    new THREE.CylinderGeometry(0.32, 0.32, 0.12, 6).translate(wsX + 2.4, wsY + 1.05, wsZ - 2.4),
    new THREE.ConeGeometry(0.24, 0.55, 5).translate(twX, twY + 6.95, twZ),
    new THREE.ConeGeometry(0.45, 0.52, 5).translate(w5CfX + 5.2, w5CfY + 0.35, w5CfZ + 3.5),
    new THREE.ConeGeometry(0.45, 0.52, 5).translate(wsX + 4.8, wsY + 0.35, wsZ + 3.2)
  );
  // 1520: Distant outer highland pines (>= 9m clear of all buildings!)
  for (const [tx, tz] of [[w5CfX - 10.0, w5CfZ + 6.0], [wsX - 9.5, wsZ + 5.5], [vgX - 9.5, vgZ + 6.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w5TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.8, 5, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.3, 5.0, 5).translate(tx, ty + 6.0, tz);
    colorizeGeo(pine, 0x1d4d24);
    w5TnLeaf.push(pine);
  }

  const w5TnAtlasMesh = createMergedMesh('BienHoWave5Atlas', w5TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w5TnAtlasMesh) group.add(w5TnAtlasMesh);
  const w5TnBronzeMesh = createMergedMesh('BienHoWave5Bronze', w5TnBronze, ctx.materials.bronze, false, true);
  if (w5TnBronzeMesh) group.add(w5TnBronzeMesh);
  const w5TnGoldMesh = createMergedMesh('BienHoWave5Gold', w5TnGold, ctx.materials.gold, false, false);
  if (w5TnGoldMesh) group.add(w5TnGoldMesh);
  const w5TnLeafMesh = createMergedMesh('BienHoWave5Leaf', w5TnLeaf, foliageMat, false, false);
  if (w5TnLeafMesh) group.add(w5TnLeafMesh);

  // ==========================================================================
  // WAVE 6 UPGRADES (Items 1881–1920): Highland Brocade-Weaving & Indigo-Dye
  // Terrace, Biển Hồ NE Crater Rim Coffee Lookout, Gong Terrace & Đồi Chè
  // ==========================================================================
  const w6TnAtlas: THREE.BufferGeometry[] = [];
  const w6TnBronze: THREE.BufferGeometry[] = [];
  const w6TnGold: THREE.BufferGeometry[] = [];
  const w6TnLeaf: THREE.BufferGeometry[] = [];

  // 1881–1888: Sân Dệt Thổ Cẩm & Nhuộm Chàm Tây Nguyên (Weaving & Indigo-Dye Terrace at houseX - 24.0, houseZ - 14.0)
  const wvX = houseX - 24.0;
  const wvZ = houseZ - 14.0;
  const wvY = Math.max(ctx.getHeight(wvX, wvZ), ctx.getHeight(wvX - 4.2, wvZ - 3.6), ctx.getHeight(wvX + 4.2, wvZ + 3.6));
  w6TnAtlas.push(
    makeReliefBox(8.8, 6.4, 7.4, 'volcanicBasaltRock', wvX, wvY - 3.1, wvZ),
    makeReliefBox(8.4, 0.20, 7.0, 'splitBambooDeck', wvX, wvY + 0.12, wvZ),
    // 1882: 4-post thatched indigo-dye & loom pavilion (grounded posts + flush roof)
    makeReliefBox(4.0, 0.22, 3.4, 'nhaRongGrassThatch', wvX - 1.6, wvY + 3.05, wvZ - 1.2),
    // 1883–1888: 3 stoneware indigo-dye vats, brocade drying rack, loom bench & entrance totems
    makeReliefCyl(0.32, 0.28, 0.68, 5, 'ruouCanStoneware', wvX - 2.6, wvY + 0.50, wvZ + 1.8),
    makeReliefCyl(0.32, 0.28, 0.68, 5, 'ruouCanStoneware', wvX - 1.5, wvY + 0.50, wvZ + 1.8),
    makeReliefCyl(0.32, 0.28, 0.68, 5, 'ruouCanStoneware', wvX - 0.4, wvY + 0.50, wvZ + 1.8),
    makeReliefBox(0.18, 2.15, 2.8, 'thoCamBrocade', wvX + 2.4, wvY + 1.25, wvZ - 1.0),
    makeReliefBox(1.85, 0.52, 0.65, 'tayNguyenDarkHardwood', wvX - 1.6, wvY + 0.42, wvZ - 1.2),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', wvX + 4.0, wvY + 1.60, wvZ - 1.8),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', wvX + 4.0, wvY + 1.60, wvZ + 1.8)
  );
  for (const ox of [-3.3, 0.1]) {
    for (const oz of [-2.6, 0.2]) {
      w6TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', wvX + ox, wvY + 1.52, wvZ + oz));
    }
  }

  // 1889–1896: Đài Cà Phê & Vọng Cảnh Đồi Thông Biển Hồ (Biển Hồ NE Crater Rim Coffee Lookout at lakeX + 26.0, lakeZ - 34.0)
  const neX = lakeX + 26.0;
  const neZ = lakeZ - 34.0;
  const neY = Math.max(ctx.getHeight(neX, neZ), ctx.getHeight(neX - 4.0, neZ - 3.2), ctx.getHeight(neX + 4.0, neZ + 3.2));
  w6TnAtlas.push(
    makeReliefBox(8.4, 6.8, 6.8, 'volcanicBasaltRock', neX, neY - 3.3, neZ),
    makeReliefBox(8.8, 0.24, 7.2, 'splitBambooDeck', neX, neY + 0.16, neZ),
    makeReliefBox(8.6, 0.10, 0.10, 'tayNguyenDarkHardwood', neX, neY + 1.15, neZ + 3.4),
    // 1891–1896: 4-post thatched coffee gazebo, brew counter, compass plinth, viewing benches & stair
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', neX - 1.6, neY + 3.05, neZ - 0.8),
    makeReliefBox(2.4, 0.88, 0.68, 'tayNguyenDarkHardwood', neX - 1.6, neY + 0.60, neZ - 0.8),
    makeReliefCyl(0.32, 0.38, 1.05, 5, 'volcanicBasaltRock', neX + 2.4, neY + 0.65, neZ + 1.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', neX + 2.2, neY + 0.42, neZ - 1.2),
    makeReliefBox(2.4, 0.45, 2.2, 'volcanicBasaltRock', neX, neY - 0.12, neZ - 4.4)
  );
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-2.1, 0.5]) {
      w6TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', neX + ox, neY + 1.52, neZ + oz));
    }
  }
  w6TnBronze.push(new THREE.CylinderGeometry(0.16, 0.18, 0.32, 5).translate(neX - 1.6, neY + 1.20, neZ - 0.8));
  w6TnGold.push(new THREE.CylinderGeometry(0.30, 0.30, 0.10, 5).translate(neX + 2.4, neY + 1.22, neZ + 1.8));

  // 1897–1920: 4th Gong Rack, festival totems, Cây Nêu #2, Rượu Cần circle, Nhà Rông war-drum,
  // extra coffee trays, 5th dugout canoe, fish-trap raft, Đồi Chè tea-weighing shelter & outer pines
  const tw2X = thX + 8.5;
  const tw2Z = thZ - 6.5;
  const tw2Y = Math.max(ctx.getHeight(tw2X, tw2Z), ctx.getHeight(tw2X - 2.0, tw2Z - 1.8), ctx.getHeight(tw2X + 2.0, tw2Z + 1.8));
  w6TnAtlas.push(
    // 1897–1900: 4th bamboo gong rack, amphitheater guardian totems, Cây Nêu #2 & Rượu Cần jars
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', ampX - 5.2, ampY + 0.98, ampZ - 6.8),
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', ampX - 1.8, ampY + 0.98, ampZ - 6.8),
    makeReliefBox(3.6, 0.08, 0.08, 'splitBambooDeck', ampX - 3.5, ampY + 1.90, ampZ - 6.8),
    makeReliefCyl(0.15, 0.19, 2.25, 4, 'tayNguyenDarkHardwood', ampX - 1.8, ampY + 1.12, ampZ - 4.2),
    makeReliefCyl(0.15, 0.19, 2.25, 4, 'tayNguyenDarkHardwood', ampX - 1.8, ampY + 1.12, ampZ + 4.2),
    makeReliefCyl(0.08, 0.12, 7.0, 4, 'thoCamBrocade', vgX + 4.5, vgY + 3.45, vgZ - 4.5),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', arX - 1.2, arY + 0.35, arZ - 3.6),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', arX + 1.2, arY + 0.35, arZ - 3.6),
    // 1901–1904: Nhà Rông war-drum rack & extra Sân Phơi Cà Phê trays
    makeReliefCyl(0.36, 0.32, 0.85, 5, 'tayNguyenDarkHardwood', houseX + 7.2, rimY + 0.62, houseZ - 3.4, 0, 0, Math.PI * 0.45),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX + 1.4, w5CfY + 0.52, w5CfZ + 2.4),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX + 3.4, w5CfY + 0.52, w5CfZ + 2.4),
    // 1909–1910: 5th highland dugout canoe & floating fish-trap mooring raft
    makeReliefCyl(0.26, 0.18, 4.2, 5, 'tayNguyenDarkHardwood', lakeX + 22.0, lakeY + 0.34, lakeZ - 26.0, 0, 0.28, Math.PI * 0.5),
    makeReliefBox(4.0, 0.22, 3.0, 'splitBambooDeck', lakeX - 16.0, lakeY + 0.22, lakeZ - 18.0),
    // 1913–1915: Đồi Chè 4-post tea-weighing shelter & baskets
    makeReliefBox(4.0, 4.4, 3.6, 'volcanicBasaltRock', tw2X, tw2Y - 2.1, tw2Z),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', tw2X, tw2Y + 2.85, tw2Z),
    makeReliefCyl(0.32, 0.24, 0.55, 5, 'splitBambooDeck', tw2X + 1.8, tw2Y + 0.38, tw2Z)
  );
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.25 - sg * 0.02;
    w6TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 5).rotateX(Math.PI * 0.5).translate(ampX - 4.6 + sg * 0.74, ampY + 1.42, ampZ - 6.8));
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w6TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'tayNguyenDarkHardwood', tw2X + ox, tw2Y + 1.42, tw2Z + oz));
    }
  }
  w6TnGold.push(
    new THREE.ConeGeometry(0.28, 0.58, 4).translate(vgX + 4.5, vgY + 7.25, vgZ - 4.5),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(wvX + 4.8, wvY + 0.35, wvZ + 3.2),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(neX + 4.8, neY + 0.35, neZ + 3.0)
  );
  // 1920: Distant outer highland pines (>= 10m clear of all terraces & structures!)
  for (const [tx, tz] of [[wvX - 10.5, wvZ - 4.5], [neX + 10.5, neZ - 5.5], [tw2X + 10.5, tw2Z - 4.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w6TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.6, 4, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w6TnLeaf.push(pine);
  }

  const w6TnAtlasMesh = createMergedMesh('BienHoWave6Atlas', w6TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w6TnAtlasMesh) group.add(w6TnAtlasMesh);
  const w6TnBronzeMesh = createMergedMesh('BienHoWave6Bronze', w6TnBronze, ctx.materials.bronze, false, true);
  if (w6TnBronzeMesh) group.add(w6TnBronzeMesh);
  const w6TnGoldMesh = createMergedMesh('BienHoWave6Gold', w6TnGold, ctx.materials.gold, false, false);
  if (w6TnGoldMesh) group.add(w6TnGoldMesh);
  const w6TnLeafMesh = createMergedMesh('BienHoWave6Leaf', w6TnLeaf, foliageMat, false, false);
  if (w6TnLeafMesh) group.add(w6TnLeafMesh);

  // ==========================================================================
  // WAVE 7 UPGRADES (Items 2281–2320): Buôn Đôn Traditional Ede Long Stilt
  // House, Biển Hồ NW Pine Crater Lookout, Gong Rack #5 & Đồi Chè Pavilion
  // ==========================================================================
  const w7TnAtlas: THREE.BufferGeometry[] = [];
  const w7TnBronze: THREE.BufferGeometry[] = [];
  const w7TnGold: THREE.BufferGeometry[] = [];
  const w7TnLeaf: THREE.BufferGeometry[] = [];

  // 2281–2288: Nhà Sàn Dài Buôn Đôn (Buôn Đôn Ede Long Stilt House at houseX + 24.5, houseZ + 12.0)
  const bdX = houseX + 24.5;
  const bdZ = houseZ + 12.0;
  const bdY = Math.max(ctx.getHeight(bdX, bdZ), ctx.getHeight(bdX - 4.8, bdZ - 3.2), ctx.getHeight(bdX + 4.8, bdZ + 3.2));
  w7TnAtlas.push(
    makeReliefBox(10.2, 6.4, 6.8, 'volcanicBasaltRock', bdX, bdY - 3.1, bdZ),
    makeReliefBox(9.4, 0.22, 5.2, 'splitBambooDeck', bdX, bdY + 1.45, bdZ),
    makeReliefBox(7.4, 2.35, 3.8, 'tayNguyenDarkHardwood', bdX - 0.4, bdY + 2.75, bdZ),
    makeReliefBox(8.6, 1.35, 5.0, 'nhaRongGrassThatch', bdX - 0.4, bdY + 4.45, bdZ),
    // 2284–2288: Notched hardwood ladder, elephant hitching post, Rượu Cần jars & brocade totems
    makeReliefBox(0.55, 2.15, 0.16, 'tayNguyenDarkHardwood', bdX + 4.6, bdY + 0.78, bdZ, 0, 0, -0.42),
    makeReliefCyl(0.14, 0.18, 2.4, 4, 'tayNguyenDarkHardwood', bdX + 4.4, bdY + 1.20, bdZ + 2.6),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', bdX + 3.4, bdY + 1.85, bdZ - 1.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', bdX + 3.4, bdY + 1.85, bdZ + 1.4),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', bdX + 5.2, bdY + 1.60, bdZ - 2.2),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', bdX + 5.2, bdY + 1.60, bdZ + 2.2)
  );
  for (const ox of [-4.2, -1.4, 1.4, 4.2]) {
    for (const oz of [-2.2, 2.2]) {
      w7TnAtlas.push(makeReliefCyl(0.10, 0.12, 1.65, 4, 'tayNguyenDarkHardwood', bdX + ox, bdY + 0.72, bdZ + oz));
    }
  }

  // 2289–2296: Đài Vọng Cảnh Đồi Thông Biển Hồ Tây Bắc (Biển Hồ NW Pine Crater Rim Lookout at lakeX - 24.0, lakeZ - 26.0)
  const nwX = lakeX - 24.0;
  const nwZ = lakeZ - 26.0;
  const nwY = Math.max(ctx.getHeight(nwX, nwZ), ctx.getHeight(nwX - 4.0, nwZ - 3.2), ctx.getHeight(nwX + 4.0, nwZ + 3.2));
  w7TnAtlas.push(
    makeReliefBox(8.4, 6.8, 6.8, 'volcanicBasaltRock', nwX, nwY - 3.3, nwZ),
    makeReliefBox(8.8, 0.24, 7.2, 'splitBambooDeck', nwX, nwY + 0.16, nwZ),
    makeReliefBox(8.6, 0.10, 0.10, 'tayNguyenDarkHardwood', nwX, nwY + 1.15, nwZ + 3.4),
    // 2291–2296: 4-post thatched viewing gazebo, lectern plinth, benches & access stairs
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', nwX + 1.6, nwY + 3.05, nwZ - 0.8),
    makeReliefCyl(0.28, 0.34, 1.05, 5, 'volcanicBasaltRock', nwX - 2.4, nwY + 0.65, nwZ + 1.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', nwX - 2.2, nwY + 0.42, nwZ - 1.2),
    makeReliefBox(2.4, 0.45, 2.2, 'volcanicBasaltRock', nwX, nwY - 0.12, nwZ - 4.4)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-2.1, 0.5]) {
      w7TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', nwX + ox, nwY + 1.52, nwZ + oz));
    }
  }
  w7TnGold.push(new THREE.BoxGeometry(0.82, 0.10, 0.52).rotateZ(-0.26).translate(nwX - 2.4, nwY + 1.22, nwZ + 1.8));

  // 2297–2320: 5th Gong Rack, Cây Nêu #3, Coffee drying & Brocade racks, 6th canoe, Đồi Chè tea-sorting pavilion & pines
  const tsX = thX - 9.5;
  const tsZ = thZ + 6.5;
  const tsY = Math.max(ctx.getHeight(tsX, tsZ), ctx.getHeight(tsX - 2.0, tsZ - 1.8), ctx.getHeight(tsX + 2.0, tsZ + 1.8));
  w7TnAtlas.push(
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', bdX - 1.8, bdY + 0.98, bdZ - 5.2),
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', bdX + 1.8, bdY + 0.98, bdZ - 5.2),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', bdX, bdY + 1.90, bdZ - 5.2),
    makeReliefCyl(0.08, 0.12, 7.0, 4, 'thoCamBrocade', bdX - 5.2, bdY + 3.45, bdZ - 4.5),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX - 1.4, w5CfY + 0.52, w5CfZ + 2.4),
    makeReliefBox(0.18, 2.05, 2.6, 'thoCamBrocade', wvX + 2.4, wvY + 1.20, wvZ + 2.0),
    // 2307–2308: 6th highland dugout canoe & floating water-monitoring pontoon
    makeReliefCyl(0.26, 0.18, 4.2, 5, 'tayNguyenDarkHardwood', lakeX - 20.0, lakeY + 0.34, lakeZ - 14.0, 0, -0.25, Math.PI * 0.5),
    makeReliefBox(4.0, 0.22, 3.0, 'splitBambooDeck', lakeX + 14.0, lakeY + 0.22, lakeZ + 18.0),
    // 2313–2319: Đồi Chè 4-post tea-sorting shade pavilion & harvest baskets
    makeReliefBox(4.0, 4.4, 3.6, 'volcanicBasaltRock', tsX, tsY - 2.1, tsZ),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', tsX, tsY + 2.85, tsZ),
    makeReliefCyl(0.32, 0.24, 0.55, 5, 'splitBambooDeck', tsX - 1.8, tsY + 0.38, tsZ)
  );
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.25 - sg * 0.02;
    w7TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 5).rotateX(Math.PI * 0.5).translate(bdX - 1.15 + sg * 0.76, bdY + 1.42, bdZ - 5.2));
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w7TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'tayNguyenDarkHardwood', tsX + ox, tsY + 1.42, tsZ + oz));
    }
  }
  w7TnGold.push(
    new THREE.ConeGeometry(0.28, 0.58, 4).translate(bdX - 5.2, bdY + 7.25, bdZ - 4.5),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(bdX + 5.8, bdY + 0.35, bdZ + 3.2),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(nwX - 4.8, nwY + 0.35, nwZ + 3.0)
  );
  // 2320: Distant outer highland pines (>= 10m clear of Buôn Đôn, NW lookout & tea pavilion!)
  for (const [tx, tz] of [[bdX + 11.5, bdZ + 6.5], [nwX - 10.5, nwZ - 5.5], [tsX - 10.5, tsZ + 5.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w7TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.6, 4, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w7TnLeaf.push(pine);
  }

  const w7TnAtlasMesh = createMergedMesh('BienHoWave7Atlas', w7TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w7TnAtlasMesh) group.add(w7TnAtlasMesh);
  const w7TnBronzeMesh = createMergedMesh('BienHoWave7Bronze', w7TnBronze, ctx.materials.bronze, false, true);
  if (w7TnBronzeMesh) group.add(w7TnBronzeMesh);
  const w7TnGoldMesh = createMergedMesh('BienHoWave7Gold', w7TnGold, ctx.materials.gold, false, false);
  if (w7TnGoldMesh) group.add(w7TnGoldMesh);
  const w7TnLeafMesh = createMergedMesh('BienHoWave7Leaf', w7TnLeaf, foliageMat, false, false);
  if (w7TnLeafMesh) group.add(w7TnLeafMesh);

  // ==========================================================================
  // WAVE 8 UPGRADES (Items 2681–2720): Buôn Kotam Highland Long Stilt House,
  // Biển Hồ SW Pine Crater Lookout, Gong Rack #6 & Đồi Chè Tasting Pavilion
  // ==========================================================================
  const w8TnAtlas: THREE.BufferGeometry[] = [];
  const w8TnBronze: THREE.BufferGeometry[] = [];
  const w8TnGold: THREE.BufferGeometry[] = [];
  const w8TnLeaf: THREE.BufferGeometry[] = [];

  // 2681–2688: Nhà Dài & Sân Cồng Chiêng Buôn Kotam (Kotam Long Stilt House at houseX + 24.5, houseZ - 16.0)
  const kt8X = houseX + 24.5;
  const kt8Z = houseZ - 16.0;
  const kt8Y = Math.max(ctx.getHeight(kt8X, kt8Z), ctx.getHeight(kt8X - 4.8, kt8Z - 3.2), ctx.getHeight(kt8X + 4.8, kt8Z + 3.2));
  w8TnAtlas.push(
    makeReliefBox(10.2, 6.4, 6.8, 'volcanicBasaltRock', kt8X, kt8Y - 3.1, kt8Z),
    makeReliefBox(9.4, 0.22, 5.2, 'splitBambooDeck', kt8X, kt8Y + 1.45, kt8Z),
    makeReliefBox(7.4, 2.35, 3.8, 'tayNguyenDarkHardwood', kt8X - 0.4, kt8Y + 2.75, kt8Z),
    makeReliefBox(8.6, 1.35, 5.0, 'nhaRongGrassThatch', kt8X - 0.4, kt8Y + 4.45, kt8Z),
    // 2684–2688: Notched hardwood ladder, rice mortar, Rượu Cần jars & brocade totems
    makeReliefBox(0.55, 2.15, 0.16, 'tayNguyenDarkHardwood', kt8X + 4.6, kt8Y + 0.78, kt8Z, 0, 0, -0.42),
    makeReliefCyl(0.32, 0.24, 0.85, 5, 'tayNguyenDarkHardwood', kt8X + 4.2, kt8Y + 0.48, kt8Z + 2.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', kt8X + 3.4, kt8Y + 1.85, kt8Z - 1.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', kt8X + 3.4, kt8Y + 1.85, kt8Z + 1.4),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', kt8X + 5.2, kt8Y + 1.60, kt8Z - 2.2),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', kt8X + 5.2, kt8Y + 1.60, kt8Z + 2.2)
  );
  for (const ox of [-4.2, -1.4, 1.4, 4.2]) {
    for (const oz of [-2.2, 2.2]) {
      w8TnAtlas.push(makeReliefCyl(0.10, 0.12, 1.65, 4, 'tayNguyenDarkHardwood', kt8X + ox, kt8Y + 0.72, kt8Z + oz));
    }
  }

  // 2689–2696: Đài Vọng Cảnh Đồi Thông Biển Hồ Tây Nam (Biển Hồ SW Crater Rim Lookout at lakeX - 24.0, lakeZ + 26.0)
  const sw8X = lakeX - 24.0;
  const sw8Z = lakeZ + 26.0;
  const sw8Y = Math.max(ctx.getHeight(sw8X, sw8Z), ctx.getHeight(sw8X - 4.0, sw8Z - 3.2), ctx.getHeight(sw8X + 4.0, sw8Z + 3.2));
  w8TnAtlas.push(
    makeReliefBox(8.4, 6.8, 6.8, 'volcanicBasaltRock', sw8X, sw8Y - 3.3, sw8Z),
    makeReliefBox(8.8, 0.24, 7.2, 'splitBambooDeck', sw8X, sw8Y + 0.16, sw8Z),
    makeReliefBox(8.6, 0.10, 0.10, 'tayNguyenDarkHardwood', sw8X, sw8Y + 1.15, sw8Z - 3.4),
    // 2691–2696: 4-post thatched viewing gazebo, lectern plinth, bench & access stairs
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', sw8X + 1.6, sw8Y + 3.05, sw8Z + 0.8),
    makeReliefCyl(0.28, 0.34, 1.05, 5, 'volcanicBasaltRock', sw8X - 2.4, sw8Y + 0.65, sw8Z - 1.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', sw8X - 2.2, sw8Y + 0.42, sw8Z + 1.2),
    makeReliefBox(2.4, 0.45, 2.2, 'volcanicBasaltRock', sw8X, sw8Y - 0.12, sw8Z + 4.4)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-0.5, 2.1]) {
      w8TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', sw8X + ox, sw8Y + 1.52, sw8Z + oz));
    }
  }
  w8TnGold.push(new THREE.BoxGeometry(0.82, 0.10, 0.52).rotateZ(-0.26).translate(sw8X - 2.4, sw8Y + 1.22, sw8Z - 1.8));

  // 2697–2720: 6th Gong Rack, Cây Nêu #4, Coffee tables & Brocade loom, 7th canoe, Đồi Chè tasting pavilion & pines
  const tt8X = thX + 10.5;
  const tt8Z = thZ + 6.5;
  const tt8Y = Math.max(ctx.getHeight(tt8X, tt8Z), ctx.getHeight(tt8X - 2.0, tt8Z - 1.8), ctx.getHeight(tt8X + 2.0, tt8Z + 1.8));
  w8TnAtlas.push(
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', kt8X - 1.8, kt8Y + 0.98, kt8Z + 5.2),
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', kt8X + 1.8, kt8Y + 0.98, kt8Z + 5.2),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', kt8X, kt8Y + 1.90, kt8Z + 5.2),
    makeReliefCyl(0.08, 0.12, 7.0, 4, 'thoCamBrocade', kt8X - 5.2, kt8Y + 3.45, kt8Z + 4.5),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX - 3.4, w5CfY + 0.52, w5CfZ + 2.4),
    makeReliefBox(0.18, 2.05, 2.6, 'thoCamBrocade', wvX - 2.4, wvY + 1.20, wvZ + 2.0),
    // 2707–2708: 7th highland dugout canoe & floating water-lily observation raft
    makeReliefCyl(0.26, 0.18, 4.2, 5, 'tayNguyenDarkHardwood', lakeX - 20.0, lakeY + 0.34, lakeZ + 14.0, 0, 0.25, Math.PI * 0.5),
    makeReliefBox(4.0, 0.22, 3.0, 'splitBambooDeck', lakeX + 16.0, lakeY + 0.22, lakeZ - 16.0),
    // 2713–2719: Đồi Chè 4-post tea-tasting pavilion & harvest baskets
    makeReliefBox(4.0, 4.4, 3.6, 'volcanicBasaltRock', tt8X, tt8Y - 2.1, tt8Z),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', tt8X, tt8Y + 2.85, tt8Z),
    makeReliefCyl(0.32, 0.24, 0.55, 5, 'splitBambooDeck', tt8X + 1.8, tt8Y + 0.38, tt8Z)
  );
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.25 - sg * 0.02;
    w8TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 5).rotateX(Math.PI * 0.5).translate(kt8X - 1.15 + sg * 0.76, kt8Y + 1.42, kt8Z + 5.2));
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w8TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'tayNguyenDarkHardwood', tt8X + ox, tt8Y + 1.42, tt8Z + oz));
    }
  }
  w8TnGold.push(
    new THREE.ConeGeometry(0.28, 0.58, 4).translate(kt8X - 5.2, kt8Y + 7.25, kt8Z + 4.5),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(kt8X + 5.8, kt8Y + 0.35, kt8Z - 3.2),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(sw8X - 4.8, sw8Y + 0.35, sw8Z - 3.0)
  );
  // 2720: Distant outer highland pines (>= 10m clear of Buôn Kotam, SW lookout & tea pavilion!)
  for (const [tx, tz] of [[kt8X + 11.5, kt8Z - 6.5], [sw8X - 10.5, sw8Z + 5.5], [tt8X + 10.5, tt8Z + 5.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w8TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.6, 4, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w8TnLeaf.push(pine);
  }

  const w8TnAtlasMesh = createMergedMesh('BienHoWave8Atlas', w8TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w8TnAtlasMesh) group.add(w8TnAtlasMesh);
  const w8TnBronzeMesh = createMergedMesh('BienHoWave8Bronze', w8TnBronze, ctx.materials.bronze, false, true);
  if (w8TnBronzeMesh) group.add(w8TnBronzeMesh);
  const w8TnGoldMesh = createMergedMesh('BienHoWave8Gold', w8TnGold, ctx.materials.gold, false, false);
  if (w8TnGoldMesh) group.add(w8TnGoldMesh);
  const w8TnLeafMesh = createMergedMesh('BienHoWave8Leaf', w8TnLeaf, foliageMat, false, false);
  if (w8TnLeafMesh) group.add(w8TnLeafMesh);

  // ==========================================================================
  // WAVE 9 UPGRADES (Items 3081–3120): Buôn Ako Dhong Highland Long Stilt House,
  // Biển Hồ SE Pine Crater Lookout, Gong Rack #7 & Đồi Chè Weighing Pavilion
  // ==========================================================================
  const w9TnAtlas: THREE.BufferGeometry[] = [];
  const w9TnBronze: THREE.BufferGeometry[] = [];
  const w9TnGold: THREE.BufferGeometry[] = [];
  const w9TnLeaf: THREE.BufferGeometry[] = [];

  // 3081–3088: Nhà Dài & Sân Cồng Chiêng Buôn Ako Dhong (Ako Dhong Long Stilt House at houseX + 38.0, houseZ - 2.0)
  const ad9X = houseX + 38.0;
  const ad9Z = houseZ - 2.0;
  const ad9Y = Math.max(ctx.getHeight(ad9X, ad9Z), ctx.getHeight(ad9X - 4.8, ad9Z - 3.2), ctx.getHeight(ad9X + 4.8, ad9Z + 3.2));
  w9TnAtlas.push(
    makeReliefBox(10.2, 6.4, 6.8, 'volcanicBasaltRock', ad9X, ad9Y - 3.1, ad9Z),
    makeReliefBox(9.4, 0.22, 5.2, 'splitBambooDeck', ad9X, ad9Y + 1.45, ad9Z),
    makeReliefBox(7.4, 2.35, 3.8, 'tayNguyenDarkHardwood', ad9X - 0.4, ad9Y + 2.75, ad9Z),
    makeReliefBox(8.6, 1.35, 5.0, 'nhaRongGrassThatch', ad9X - 0.4, ad9Y + 4.45, ad9Z),
    // 3084–3088: Notched hardwood ladder, rice mortar, Rượu Cần jars & brocade totems
    makeReliefBox(0.55, 2.15, 0.16, 'tayNguyenDarkHardwood', ad9X + 4.6, ad9Y + 0.78, ad9Z, 0, 0, -0.42),
    makeReliefCyl(0.32, 0.24, 0.85, 5, 'tayNguyenDarkHardwood', ad9X + 4.2, ad9Y + 0.48, ad9Z + 2.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', ad9X + 3.4, ad9Y + 1.85, ad9Z - 1.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', ad9X + 3.4, ad9Y + 1.85, ad9Z + 1.4),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', ad9X + 5.2, ad9Y + 1.60, ad9Z - 2.2),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', ad9X + 5.2, ad9Y + 1.60, ad9Z + 2.2)
  );
  for (const ox of [-4.2, -1.4, 1.4, 4.2]) {
    for (const oz of [-2.2, 2.2]) {
      w9TnAtlas.push(makeReliefCyl(0.10, 0.12, 1.65, 4, 'tayNguyenDarkHardwood', ad9X + ox, ad9Y + 0.72, ad9Z + oz));
    }
  }

  // 3089–3096: Đài Vọng Cảnh Đồi Thông Biển Hồ Đông Nam (Biển Hồ SE Crater Rim Lookout at lakeX + 24.0, lakeZ + 26.0)
  const se9X = lakeX + 24.0;
  const se9Z = lakeZ + 26.0;
  const se9Y = Math.max(ctx.getHeight(se9X, se9Z), ctx.getHeight(se9X - 4.0, se9Z - 3.2), ctx.getHeight(se9X + 4.0, se9Z + 3.2));
  w9TnAtlas.push(
    makeReliefBox(8.4, 6.8, 6.8, 'volcanicBasaltRock', se9X, se9Y - 3.3, se9Z),
    makeReliefBox(8.8, 0.24, 7.2, 'splitBambooDeck', se9X, se9Y + 0.16, se9Z),
    makeReliefBox(8.6, 0.10, 0.10, 'tayNguyenDarkHardwood', se9X, se9Y + 1.15, se9Z - 3.4),
    // 3091–3096: 4-post thatched viewing gazebo, lectern plinth, bench & access stairs
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', se9X - 1.6, se9Y + 3.05, se9Z + 0.8),
    makeReliefCyl(0.28, 0.34, 1.05, 5, 'volcanicBasaltRock', se9X + 2.4, se9Y + 0.65, se9Z - 1.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', se9X + 2.2, se9Y + 0.42, se9Z + 1.2),
    makeReliefBox(2.4, 0.45, 2.2, 'volcanicBasaltRock', se9X, se9Y - 0.12, se9Z + 4.4)
  );
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-0.5, 2.1]) {
      w9TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', se9X + ox, se9Y + 1.52, se9Z + oz));
    }
  }
  w9TnGold.push(new THREE.BoxGeometry(0.82, 0.10, 0.52).rotateZ(0.26).translate(se9X + 2.4, se9Y + 1.22, se9Z - 1.8));

  // 3097–3120: 7th Gong Rack, Cây Nêu #5, Coffee tables & Brocade loom, 8th canoe, Đồi Chè weighing pavilion & pines
  const tw9X = thX + 10.5;
  const tw9Z = thZ - 6.5;
  const tw9Y = Math.max(ctx.getHeight(tw9X, tw9Z), ctx.getHeight(tw9X - 2.0, tw9Z - 1.8), ctx.getHeight(tw9X + 2.0, tw9Z + 1.8));
  w9TnAtlas.push(
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', ad9X - 1.8, ad9Y + 0.98, ad9Z + 5.2),
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', ad9X + 1.8, ad9Y + 0.98, ad9Z + 5.2),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', ad9X, ad9Y + 1.90, ad9Z + 5.2),
    makeReliefCyl(0.08, 0.12, 7.0, 4, 'thoCamBrocade', ad9X - 5.2, ad9Y + 3.45, ad9Z + 4.5),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX + 3.4, w5CfY + 0.52, w5CfZ - 2.4),
    makeReliefBox(0.18, 2.05, 2.6, 'thoCamBrocade', wvX - 2.4, wvY + 1.20, wvZ - 2.0),
    // 3107–3108: 8th highland dugout canoe & floating water-lily observation raft
    makeReliefCyl(0.26, 0.18, 4.2, 5, 'tayNguyenDarkHardwood', lakeX + 20.0, lakeY + 0.34, lakeZ + 14.0, 0, -0.25, Math.PI * 0.5),
    makeReliefBox(4.0, 0.22, 3.0, 'splitBambooDeck', lakeX - 16.0, lakeY + 0.22, lakeZ - 16.0),
    // 3113–3119: Đồi Chè 4-post tea-weighing pavilion & harvest baskets
    makeReliefBox(4.0, 4.4, 3.6, 'volcanicBasaltRock', tw9X, tw9Y - 2.1, tw9Z),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', tw9X, tw9Y + 2.85, tw9Z),
    makeReliefCyl(0.32, 0.24, 0.55, 5, 'splitBambooDeck', tw9X + 1.8, tw9Y + 0.38, tw9Z)
  );
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.25 - sg * 0.02;
    w9TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 5).rotateX(Math.PI * 0.5).translate(ad9X - 1.15 + sg * 0.76, ad9Y + 1.42, ad9Z + 5.2));
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w9TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'tayNguyenDarkHardwood', tw9X + ox, tw9Y + 1.42, tw9Z + oz));
    }
  }
  w9TnGold.push(
    new THREE.ConeGeometry(0.28, 0.58, 4).translate(ad9X - 5.2, ad9Y + 7.25, ad9Z + 4.5),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(ad9X + 5.8, ad9Y + 0.35, ad9Z - 3.2),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(se9X + 4.8, se9Y + 0.35, se9Z - 3.0)
  );
  // 3120: Distant outer highland pines (>= 11m clear of Buôn Ako Dhong, SE lookout & tea pavilion!)
  for (const [tx, tz] of [[ad9X + 12.0, ad9Z - 2.0], [se9X + 11.0, se9Z + 5.5], [tw9X + 11.0, tw9Z - 5.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w9TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.6, 4, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w9TnLeaf.push(pine);
  }

  const w9TnAtlasMesh = createMergedMesh('BienHoWave9Atlas', w9TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w9TnAtlasMesh) group.add(w9TnAtlasMesh);
  const w9TnBronzeMesh = createMergedMesh('BienHoWave9Bronze', w9TnBronze, ctx.materials.bronze, false, true);
  if (w9TnBronzeMesh) group.add(w9TnBronzeMesh);
  const w9TnGoldMesh = createMergedMesh('BienHoWave9Gold', w9TnGold, ctx.materials.gold, false, false);
  if (w9TnGoldMesh) group.add(w9TnGoldMesh);
  const w9TnLeafMesh = createMergedMesh('BienHoWave9Leaf', w9TnLeaf, foliageMat, false, false);
  if (w9TnLeafMesh) group.add(w9TnLeafMesh);

  // ==========================================================================
  // WAVE 10 UPGRADES (Items 3481–3520): Highland Coffee Drying Yard & Stilt Roastery,
  // Biển Hồ NW Pine Crater Lookout, Gong Rack #8, Cây Nêu #6 & Đồi Chè West Pavilion
  // ==========================================================================
  const w10TnAtlas: THREE.BufferGeometry[] = [];
  const w10TnBronze: THREE.BufferGeometry[] = [];
  const w10TnGold: THREE.BufferGeometry[] = [];
  const w10TnLeaf: THREE.BufferGeometry[] = [];

  // 3481–3488: Sân Phơi Cà Phê & Nhà Kho Buôn Ma Thuột (Coffee Drying Yard & Stilt Roastery at houseX + 38.0, houseZ + 18.0)
  const cf10X = houseX + 38.0;
  const cf10Z = houseZ + 18.0;
  const cf10Y = Math.max(ctx.getHeight(cf10X, cf10Z), ctx.getHeight(cf10X - 4.8, cf10Z - 3.2), ctx.getHeight(cf10X + 4.8, cf10Z + 3.2));
  w10TnAtlas.push(
    makeReliefBox(10.2, 6.4, 6.8, 'volcanicBasaltRock', cf10X, cf10Y - 3.1, cf10Z),
    makeReliefBox(9.4, 0.22, 5.2, 'splitBambooDeck', cf10X, cf10Y + 1.45, cf10Z),
    makeReliefBox(7.4, 2.35, 3.8, 'tayNguyenDarkHardwood', cf10X - 0.4, cf10Y + 2.75, cf10Z),
    makeReliefBox(8.6, 1.35, 5.0, 'nhaRongGrassThatch', cf10X - 0.4, cf10Y + 4.45, cf10Z),
    // 3484–3488: Notched hardwood ladder, coffee mortar, Rượu Cần jars & brocade totems
    makeReliefBox(0.55, 2.15, 0.16, 'tayNguyenDarkHardwood', cf10X + 4.6, cf10Y + 0.78, cf10Z, 0, 0, -0.42),
    makeReliefCyl(0.32, 0.24, 0.85, 5, 'tayNguyenDarkHardwood', cf10X + 4.2, cf10Y + 0.48, cf10Z + 2.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', cf10X + 3.4, cf10Y + 1.85, cf10Z - 1.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', cf10X + 3.4, cf10Y + 1.85, cf10Z + 1.4),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', cf10X + 5.2, cf10Y + 1.60, cf10Z - 2.2),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', cf10X + 5.2, cf10Y + 1.60, cf10Z + 2.2)
  );
  for (const ox of [-4.2, -1.4, 1.4, 4.2]) {
    for (const oz of [-2.2, 2.2]) {
      w10TnAtlas.push(makeReliefCyl(0.10, 0.12, 1.65, 4, 'tayNguyenDarkHardwood', cf10X + ox, cf10Y + 0.72, cf10Z + oz));
    }
  }

  // 3489–3496: Đài Vọng Cảnh Đồi Thông Biển Hồ Tây Bắc (Biển Hồ NW Crater Rim Lookout at lakeX - 26.0, lakeZ - 26.0)
  const nw10X = lakeX - 26.0;
  const nw10Z = lakeZ - 26.0;
  const nw10Y = Math.max(ctx.getHeight(nw10X, nw10Z), ctx.getHeight(nw10X - 4.0, nw10Z - 3.2), ctx.getHeight(nw10X + 4.0, nw10Z + 3.2));
  w10TnAtlas.push(
    makeReliefBox(8.4, 6.8, 6.8, 'volcanicBasaltRock', nw10X, nw10Y - 3.3, nw10Z),
    makeReliefBox(8.8, 0.24, 7.2, 'splitBambooDeck', nw10X, nw10Y + 0.16, nw10Z),
    makeReliefBox(8.6, 0.10, 0.10, 'tayNguyenDarkHardwood', nw10X, nw10Y + 1.15, nw10Z + 3.4),
    // 3491–3496: 4-post thatched viewing gazebo, lectern plinth, bench & access stairs
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', nw10X - 1.6, nw10Y + 3.05, nw10Z - 0.8),
    makeReliefCyl(0.28, 0.34, 1.05, 5, 'volcanicBasaltRock', nw10X + 2.4, nw10Y + 0.65, nw10Z + 1.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', nw10X + 2.2, nw10Y + 0.42, nw10Z - 1.2),
    makeReliefBox(2.4, 0.45, 2.2, 'volcanicBasaltRock', nw10X, nw10Y - 0.12, nw10Z - 4.4)
  );
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-2.1, 0.5]) {
      w10TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', nw10X + ox, nw10Y + 1.52, nw10Z + oz));
    }
  }
  w10TnGold.push(new THREE.BoxGeometry(0.82, 0.10, 0.52).rotateZ(-0.26).translate(nw10X + 2.4, nw10Y + 1.22, nw10Z + 1.8));

  // 3497–3520: 8th Gong Rack, Cây Nêu #6, Coffee table & Brocade loom, 9th canoe, Đồi Chè west pavilion & pines
  const tw10X = thX - 11.0;
  const tw10Z = thZ - 6.5;
  const tw10Y = Math.max(ctx.getHeight(tw10X, tw10Z), ctx.getHeight(tw10X - 2.0, tw10Z - 1.8), ctx.getHeight(tw10X + 2.0, tw10Z + 1.8));
  w10TnAtlas.push(
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', cf10X - 1.8, cf10Y + 0.98, cf10Z + 5.2),
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', cf10X + 1.8, cf10Y + 0.98, cf10Z + 5.2),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', cf10X, cf10Y + 1.90, cf10Z + 5.2),
    makeReliefCyl(0.08, 0.12, 7.0, 4, 'thoCamBrocade', cf10X - 5.2, cf10Y + 3.45, cf10Z + 4.5),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX - 3.6, w5CfY + 0.52, w5CfZ - 2.4),
    makeReliefBox(0.18, 2.05, 2.6, 'thoCamBrocade', wvX + 2.6, wvY + 1.20, wvZ - 2.0),
    // 3507–3512: 9th highland dugout canoe & floating lotus observation raft
    makeReliefCyl(0.26, 0.18, 4.2, 5, 'tayNguyenDarkHardwood', lakeX - 20.0, lakeY + 0.34, lakeZ + 16.0, 0, 0.25, Math.PI * 0.5),
    makeReliefBox(4.0, 0.22, 3.0, 'splitBambooDeck', lakeX + 18.0, lakeY + 0.22, lakeZ - 18.0),
    // 3513–3519: Đồi Chè west 4-post tea-sorting pavilion & harvest baskets
    makeReliefBox(4.0, 4.4, 3.6, 'volcanicBasaltRock', tw10X, tw10Y - 2.1, tw10Z),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', tw10X, tw10Y + 2.85, tw10Z),
    makeReliefCyl(0.32, 0.24, 0.55, 5, 'splitBambooDeck', tw10X - 1.8, tw10Y + 0.38, tw10Z)
  );
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.25 - sg * 0.02;
    w10TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 5).rotateX(Math.PI * 0.5).translate(cf10X - 1.15 + sg * 0.76, cf10Y + 1.42, cf10Z + 5.2));
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w10TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'tayNguyenDarkHardwood', tw10X + ox, tw10Y + 1.42, tw10Z + oz));
    }
  }
  w10TnGold.push(
    new THREE.ConeGeometry(0.28, 0.58, 4).translate(cf10X - 5.2, cf10Y + 7.25, cf10Z + 4.5),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(cf10X + 5.8, cf10Y + 0.35, cf10Z - 3.2),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(nw10X - 4.8, nw10Y + 0.35, nw10Z + 3.0)
  );
  // 3520: Distant outer highland pines (>= 12m clear of Coffee Roastery, NW lookout & tea pavilion!)
  for (const [tx, tz] of [[cf10X + 12.0, cf10Z + 2.0], [nw10X - 12.0, nw10Z - 5.5], [tw10X - 12.0, tw10Z - 5.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w10TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.6, 4, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w10TnLeaf.push(pine);
  }

  const w10TnAtlasMesh = createMergedMesh('BienHoWave10Atlas', w10TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w10TnAtlasMesh) group.add(w10TnAtlasMesh);
  const w10TnBronzeMesh = createMergedMesh('BienHoWave10Bronze', w10TnBronze, ctx.materials.bronze, false, true);
  if (w10TnBronzeMesh) group.add(w10TnBronzeMesh);
  const w10TnGoldMesh = createMergedMesh('BienHoWave10Gold', w10TnGold, ctx.materials.gold, false, false);
  if (w10TnGoldMesh) group.add(w10TnGoldMesh);
  const w10TnLeafMesh = createMergedMesh('BienHoWave10Leaf', w10TnLeaf, foliageMat, false, false);
  if (w10TnLeafMesh) group.add(w10TnLeafMesh);

  // ==========================================================================
  // WAVE 11 UPGRADES (Items 3881–3920): Buôn Đôn Brocade-Weaving Stilt Longhouse,
  // Biển Hồ NE Pine Crater Lookout, Gong Rack #9, Cây Nêu #7 & Đồi Chè SW Pavilion
  // ==========================================================================
  const w11TnAtlas: THREE.BufferGeometry[] = [];
  const w11TnBronze: THREE.BufferGeometry[] = [];
  const w11TnGold: THREE.BufferGeometry[] = [];
  const w11TnLeaf: THREE.BufferGeometry[] = [];

  // 3881–3888: Nhà Dài & Xưởng Dệt Thổ Cẩm Buôn Đôn (Buôn Đôn Brocade Longhouse at houseX + 38.0, houseZ - 22.0)
  const bd11X = houseX + 38.0;
  const bd11Z = houseZ - 22.0;
  const bd11Y = Math.max(ctx.getHeight(bd11X, bd11Z), ctx.getHeight(bd11X - 4.8, bd11Z - 3.2), ctx.getHeight(bd11X + 4.8, bd11Z + 3.2));
  w11TnAtlas.push(
    makeReliefBox(10.2, 6.4, 6.8, 'volcanicBasaltRock', bd11X, bd11Y - 3.1, bd11Z),
    makeReliefBox(9.4, 0.22, 5.2, 'splitBambooDeck', bd11X, bd11Y + 1.45, bd11Z),
    makeReliefBox(7.4, 2.35, 3.8, 'tayNguyenDarkHardwood', bd11X - 0.4, bd11Y + 2.75, bd11Z),
    makeReliefBox(8.6, 1.35, 5.0, 'nhaRongGrassThatch', bd11X - 0.4, bd11Y + 4.45, bd11Z),
    // 3884–3888: Notched hardwood ladder, rice mortar, Rượu Cần jars & brocade totems
    makeReliefBox(0.55, 2.15, 0.16, 'tayNguyenDarkHardwood', bd11X + 4.6, bd11Y + 0.78, bd11Z, 0, 0, -0.42),
    makeReliefCyl(0.32, 0.24, 0.85, 5, 'tayNguyenDarkHardwood', bd11X + 4.2, bd11Y + 0.48, bd11Z + 2.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', bd11X + 3.4, bd11Y + 1.85, bd11Z - 1.4),
    makeReliefCyl(0.24, 0.28, 0.65, 5, 'ruouCanStoneware', bd11X + 3.4, bd11Y + 1.85, bd11Z + 1.4),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', bd11X + 5.2, bd11Y + 1.60, bd11Z - 2.2),
    makeReliefCyl(0.12, 0.15, 3.1, 4, 'thoCamBrocade', bd11X + 5.2, bd11Y + 1.60, bd11Z + 2.2)
  );
  for (const ox of [-4.2, -1.4, 1.4, 4.2]) {
    for (const oz of [-2.2, 2.2]) {
      w11TnAtlas.push(makeReliefCyl(0.10, 0.12, 1.65, 4, 'tayNguyenDarkHardwood', bd11X + ox, bd11Y + 0.72, bd11Z + oz));
    }
  }

  // 3889–3896: Đài Vọng Cảnh Đồi Thông Biển Hồ Đông Bắc (Biển Hồ NE Crater Rim Lookout at lakeX + 26.0, lakeZ - 26.0)
  const ne11X = lakeX + 26.0;
  const ne11Z = lakeZ - 26.0;
  const ne11Y = Math.max(ctx.getHeight(ne11X, ne11Z), ctx.getHeight(ne11X - 4.0, ne11Z - 3.2), ctx.getHeight(ne11X + 4.0, ne11Z + 3.2));
  w11TnAtlas.push(
    makeReliefBox(8.4, 6.8, 6.8, 'volcanicBasaltRock', ne11X, ne11Y - 3.3, ne11Z),
    makeReliefBox(8.8, 0.24, 7.2, 'splitBambooDeck', ne11X, ne11Y + 0.16, ne11Z),
    makeReliefBox(8.6, 0.10, 0.10, 'tayNguyenDarkHardwood', ne11X, ne11Y + 1.15, ne11Z + 3.4),
    // 3891–3896: 4-post thatched viewing gazebo, lectern plinth, bench & access stairs
    makeReliefBox(3.8, 0.22, 3.2, 'nhaRongGrassThatch', ne11X + 1.6, ne11Y + 3.05, ne11Z - 0.8),
    makeReliefCyl(0.28, 0.34, 1.05, 5, 'volcanicBasaltRock', ne11X - 2.4, ne11Y + 0.65, ne11Z + 1.8),
    makeReliefBox(2.2, 0.46, 0.55, 'tayNguyenDarkHardwood', ne11X - 2.2, ne11Y + 0.42, ne11Z - 1.2),
    makeReliefBox(2.4, 0.45, 2.2, 'volcanicBasaltRock', ne11X, ne11Y - 0.12, ne11Z - 4.4)
  );
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-2.1, 0.5]) {
      w11TnAtlas.push(makeReliefCyl(0.08, 0.10, 3.05, 4, 'tayNguyenDarkHardwood', ne11X + ox, ne11Y + 1.52, ne11Z + oz));
    }
  }
  w11TnGold.push(new THREE.BoxGeometry(0.82, 0.10, 0.52).rotateZ(0.26).translate(ne11X - 2.4, ne11Y + 1.22, ne11Z + 1.8));

  // 3897–3920: 9th Gong Rack, Cây Nêu #7, Coffee table & Brocade loom, 10th canoe, Đồi Chè SW pavilion & pines
  const ts11X = thX - 11.0;
  const ts11Z = thZ + 6.8;
  const ts11Y = Math.max(ctx.getHeight(ts11X, ts11Z), ctx.getHeight(ts11X - 2.0, ts11Z - 1.8), ctx.getHeight(ts11X + 2.0, ts11Z + 1.8));
  w11TnAtlas.push(
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', bd11X - 1.8, bd11Y + 0.98, bd11Z + 5.2),
    makeReliefCyl(0.06, 0.07, 1.95, 4, 'splitBambooDeck', bd11X + 1.8, bd11Y + 0.98, bd11Z + 5.2),
    makeReliefBox(3.8, 0.08, 0.08, 'splitBambooDeck', bd11X, bd11Y + 1.90, bd11Z + 5.2),
    makeReliefCyl(0.08, 0.12, 7.0, 4, 'thoCamBrocade', bd11X - 5.2, bd11Y + 3.45, bd11Z + 4.5),
    makeReliefBox(1.55, 0.72, 1.55, 'splitBambooDeck', w5CfX + 3.8, w5CfY + 0.52, w5CfZ + 2.4),
    makeReliefBox(0.18, 2.05, 2.6, 'thoCamBrocade', wvX + 2.6, wvY + 1.20, wvZ + 2.2),
    // 3907–3912: 10th highland dugout canoe & floating lotus observation raft
    makeReliefCyl(0.26, 0.18, 4.2, 5, 'tayNguyenDarkHardwood', lakeX + 22.0, lakeY + 0.34, lakeZ - 12.0, 0, -0.25, Math.PI * 0.5),
    makeReliefBox(4.0, 0.22, 3.0, 'splitBambooDeck', lakeX - 20.0, lakeY + 0.22, lakeZ + 18.0),
    // 3913–3919: Đồi Chè SW 4-post tea-drying pavilion & harvest baskets
    makeReliefBox(4.0, 4.4, 3.6, 'volcanicBasaltRock', ts11X, ts11Y - 2.1, ts11Z),
    makeReliefBox(3.6, 0.20, 3.2, 'nhaRongGrassThatch', ts11X, ts11Y + 2.85, ts11Z),
    makeReliefCyl(0.32, 0.24, 0.55, 5, 'splitBambooDeck', ts11X - 1.8, ts11Y + 0.38, ts11Z)
  );
  for (let sg = 0; sg < 4; sg++) {
    const r = 0.25 - sg * 0.02;
    w11TnBronze.push(new THREE.CylinderGeometry(r, r, 0.06, 5).rotateX(Math.PI * 0.5).translate(bd11X - 1.15 + sg * 0.76, bd11Y + 1.42, bd11Z + 5.2));
  }
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.3, 1.3]) {
      w11TnAtlas.push(makeReliefCyl(0.07, 0.08, 2.85, 4, 'tayNguyenDarkHardwood', ts11X + ox, ts11Y + 1.42, ts11Z + oz));
    }
  }
  w11TnGold.push(
    new THREE.ConeGeometry(0.28, 0.58, 4).translate(bd11X - 5.2, bd11Y + 7.25, bd11Z + 4.5),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(bd11X + 5.8, bd11Y + 0.35, bd11Z - 3.2),
    new THREE.ConeGeometry(0.45, 0.52, 4).translate(ne11X + 4.8, ne11Y + 0.35, ne11Z + 3.0)
  );
  // 3920: Distant outer highland pines (>= 12m clear of Buôn Đôn Longhouse, NE lookout & SW tea pavilion!)
  for (const [tx, tz] of [[bd11X + 12.0, bd11Z - 2.0], [ne11X + 12.0, ne11Z - 5.5], [ts11X - 12.0, ts11Z + 5.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    w11TnAtlas.push(makeReliefCyl(0.18, 0.24, 5.6, 4, 'tayNguyenDarkHardwood', tx, ty + 1.9, tz));
    const pine = new THREE.ConeGeometry(2.2, 4.8, 4).translate(tx, ty + 5.8, tz);
    colorizeGeo(pine, 0x1d4d24);
    w11TnLeaf.push(pine);
  }

  const w11TnAtlasMesh = createMergedMesh('BienHoWave11Atlas', w11TnAtlas, pack.mySonTayNguyenMasterAtlasMat, false, true);
  if (w11TnAtlasMesh) group.add(w11TnAtlasMesh);
  const w11TnBronzeMesh = createMergedMesh('BienHoWave11Bronze', w11TnBronze, ctx.materials.bronze, false, true);
  if (w11TnBronzeMesh) group.add(w11TnBronzeMesh);
  const w11TnGoldMesh = createMergedMesh('BienHoWave11Gold', w11TnGold, ctx.materials.gold, false, false);
  if (w11TnGoldMesh) group.add(w11TnGoldMesh);
  const w11TnLeafMesh = createMergedMesh('BienHoWave11Leaf', w11TnLeaf, foliageMat, false, false);
  if (w11TnLeafMesh) group.add(w11TnLeafMesh);

  tagMotifIds(group, ['HV-G01', 'HV-G02', 'HV-G04', 'HV-G06', 'HV-NEW-MT-10']);
  ctx.scene.add(group);
  return group;
}
