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
  // Item 152: Iconic Central Highlands *Cây Kơ-nia* umbrella-crown tree anchoring the village square
  addOrganicTree(barkParts, leafParts, houseX + 16.5, ctx.getHeight(houseX + 16.5, houseZ - 11.5) - 0.2, houseZ - 11.5, 1.55, 8450, [0x265c28, 0x387434], false);

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

  // Lush multi-tiered *Pinus kesiya* three-needle highland pine forest around crater rim & Nhà Rông (ZERO cone trees, clear camera 06 sightline!) (TN-25, TN-30..32)
  const pinePalette = [0x1c4a24, 0x2a612e, 0x3b7838, 0x4b8742];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const px = lakeX + Math.cos(a) * (41.5 + (i % 3) * 4.5);
    const pz = lakeZ + Math.sin(a) * (41.5 + (i % 2) * 4.0);
    // Keep camera 06 corridor around (-406, 20) & Nhà Rông courtyard clear!
    if (Math.hypot(px - (-406), pz - 20) < 16.0) continue;
    if (Math.hypot(px - houseX, pz - houseZ) < 16.5) continue;
    const py = ctx.getHeight(px, pz);
    addOrganicTree(barkParts, leafParts, px, py - 0.3, pz, 1.15 + (i % 3) * 0.22, 8200 + i * 17, pinePalette, true);
  }
  // Framing pines behind Nhà Rông
  for (const [px, pz, ps, pSeed] of [[-396, 62, 1.25, 8301], [-416, 62, 1.32, 8302], [-392, 22, 1.18, 8303]]) {
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

  tagMotifIds(group, ['HV-G01', 'HV-G02', 'HV-G04', 'HV-G06', 'HV-NEW-MT-10']);
  ctx.scene.add(group);
  return group;
}
