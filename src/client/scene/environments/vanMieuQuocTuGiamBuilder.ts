import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import {
  createDongSonBronzeTextures,
  getVietnamHeritageHeight
} from '../shaders/vietnamHeritageShader';
import {
  applyWorldBoxUV,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createForegroundLotusFlowerParts,
  createHueImperialHipRoofGeometry,
  createLanternCapGeometry,
  createLanternCoreGeometry,
  createLotusFinialParts,
  createRibbedLanternShellGeometry,
  createVietnameseCurvedRoofGeometry,
  createWavingSilkFlagMaterial,
  mergeNormalized,
  mulberry32,
  VietnamSharedMaterials,
  VietnamSharedShaders
} from './vietnamGeometryHelpers';
import {
  createAncientStoneLanternParts,
  createBasReliefPanelParts,
  createBronzeBellParts,
  createCuaVongParts,
  createGuardianBeastParts,
  createPhoenixFinialParts,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createSignagePlaqueMesh,
  createSmoothTaperedTubeGeometry,
  SignageAtlas,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  createVanMieuMaterialPack,
  VAN_MIEU_ATLAS_UV,
  VAN_MIEU_RELIEF_UV,
  VanMieuAtlasKey,
  VanMieuReliefKey
} from '../textures/vanMieuPbrTextures';

export interface VanMieuBuilderInput {
  scene: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  sharedMaterials: VietnamSharedMaterials;
  leafAtlas: THREE.Texture;
  cachedDongSon?: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
  lanternSilkMaterial: THREE.MeshStandardMaterial;
  lanternCoreMaterial: THREE.MeshStandardMaterial;
  sharedShaders?: VietnamSharedShaders | null;
  signageAtlas?: SignageAtlas | null;
  exclusionCircles: Array<{ x: number; z: number; r: number }>;
  incenseSources: Array<{ x: number; y: number; z: number; scale?: number }>;
  extraMaterials: THREE.Material[];
  extraTextures: THREE.Texture[];
  extraAnimatedUniforms: Array<{ uTime: { value: number } }>;
}

function colorizeGeo(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.attributes.position.count;
  const col = new THREE.Color(hex);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function addBox(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): void {
  const b = new THREE.BoxGeometry(w, h, d);
  if (rotX) b.rotateX(rotX);
  if (rotZ) b.rotateZ(rotZ);
  if (rotY) b.rotateY(rotY);
  b.translate(x, y, z);
  parts.push(b);
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
  rotX = 0,
  rotY = 0,
  rotZ = 0
): void {
  const c = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rotX) c.rotateX(rotX);
  if (rotZ) c.rotateZ(rotZ);
  if (rotY) c.rotateY(rotY);
  c.translate(x, y, z);
  parts.push(c);
}

function remapUvRect(
  geo: THREE.BufferGeometry,
  rect: readonly [number, number, number, number],
  pad = 0.002
): THREE.BufferGeometry {
  const [u0, v0, u1, v1] = rect;
  const pu0 = u0 + pad;
  const pv0 = v0 + pad;
  const du = Math.max(0.001, u1 - u0 - pad * 2);
  const dv = Math.max(0.001, v1 - v0 - pad * 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = Math.max(0, Math.min(1, uv.getX(i)));
    const v = Math.max(0, Math.min(1, uv.getY(i)));
    uv.setXY(i, pu0 + u * du, pv0 + v * dv);
  }
  return geo;
}

function remapReliefUv(geo: THREE.BufferGeometry, key: VanMieuReliefKey): THREE.BufferGeometry {
  return remapUvRect(geo, VAN_MIEU_RELIEF_UV[key], 0.002);
}

function makeAtlasPlane(
  w: number,
  h: number,
  atlasKey: VanMieuAtlasKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const geo = remapUvRect(new THREE.PlaneGeometry(w, h), VAN_MIEU_ATLAS_UV[atlasKey], 0.002);
  if (rotX) geo.rotateX(rotX);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

/**
 * Helper: Sculpted 3-Tier Stepped Corner Wooden Bracket (`Bẩy Góc / Con Sơn Chồng Rường` — KVC-09)
 */
function addKvcSteppedCornerBracket(
  parts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  rotY: number,
  scale = 1.0
): void {
  const tiers: Array<[number, number, number]> = [
    [0.36, 0.14, 0.0],
    [0.62, 0.14, 0.17],
    [0.92, 0.15, 0.34]
  ];
  for (const [reach, th, dy] of tiers) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(reach * scale, 0);
    sh.quadraticCurveTo(reach * scale * 0.92, -th * scale * 0.85, reach * scale * 0.45, -th * scale);
    sh.lineTo(0, -th * scale * 1.15);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.10 * scale, bevelEnabled: false });
    g.translate(0, 0, -0.05 * scale);
    g.rotateY(rotY);
    g.translate(x, y + dy * scale, z);
    parts.push(g);
  }
}

/**
 * Helper: Authentic Khuê Văn Các Dense *Con Tiện* Spindle Balcony Side (`KVC-11`)
 * 4 stepped-cap newel posts, plump LatheGeometry vase spindles spaced every 0.13m,
 * and lowered central window sill bay directly under the circular sunburst window!
 */
function addKvcBalconySide(
  parts: THREE.BufferGeometry[],
  cx: number,
  cz: number,
  baseY: number,
  rotY: number,
  lowerCenterBay: boolean
): void {
  const halfLen = 2.78;
  const fullH = 0.76;
  const centerH = lowerCenterBay ? 0.36 : 0.62;
  const spindleProf = [
    new THREE.Vector2(0.024, 0.0),
    new THREE.Vector2(0.036, 0.16),
    new THREE.Vector2(0.022, 0.34),
    new THREE.Vector2(0.040, 0.56),
    new THREE.Vector2(0.024, 1.0)
  ];

  const place = (g: THREE.BufferGeometry) => {
    if (rotY) g.rotateY(rotY);
    g.translate(cx, baseY, cz);
    parts.push(g);
  };

  // 4 chamfered square newel posts with stepped caps dividing side into Left, Center, Right bays
  const postXs = [-halfLen, -0.96, 0.96, halfLen];
  for (const px of postXs) {
    const post = new THREE.BoxGeometry(0.13, fullH + 0.10, 0.13);
    post.translate(px, (fullH + 0.10) * 0.5, 0);
    place(post);
    const cap1 = new THREE.BoxGeometry(0.17, 0.05, 0.17);
    cap1.translate(px, fullH + 0.125, 0);
    place(cap1);
    const cap2 = new THREE.CylinderGeometry(0.03, 0.095, 0.09, 4);
    cap2.rotateY(Math.PI * 0.25);
    cap2.translate(px, fullH + 0.19, 0);
    place(cap2);
  }

  // Build Left, Center, Right bays
  const bays: Array<[number, number, number]> = [
    [-halfLen + 0.07, -0.96 - 0.07, fullH],
    [-0.96 + 0.07, 0.96 - 0.07, centerH],
    [0.96 + 0.07, halfLen - 0.07, fullH]
  ];
  for (const [x0, x1, bh] of bays) {
    const len = x1 - x0;
    const midX = (x0 + x1) * 0.5;
    // Top grooved handrail + bottom sill rail
    const topRail = new THREE.BoxGeometry(len + 0.04, 0.08, 0.11);
    topRail.translate(midX, bh - 0.04, 0);
    place(topRail);
    const botRail = new THREE.BoxGeometry(len + 0.04, 0.07, 0.10);
    botRail.translate(midX, 0.06, 0);
    place(botRail);

    // Dense plump vase-turned spindles (`spacing ≈ 0.14m`)
    const count = Math.max(4, Math.floor(len / 0.165));
    const spH = Math.max(0.16, bh - 0.14);
    for (let i = 0; i < count; i++) {
      const sx = x0 + ((i + 0.5) / count) * len;
      const sp = new THREE.LatheGeometry(spindleProf, 4);
      sp.scale(1, spH, 1);
      sp.translate(sx, 0.09, 0);
      place(sp);
    }
  }
}

/**
 * Helper: Sculpted `ExtrudeGeometry` `Kìm Nóc` Dragon-Head Cloud-Scroll Ridge Finial (`KVC-24`)
 */
function createSculptedKimNocGeo(sx: number, scale = 1.0): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(-0.18, 0.0);
  sh.lineTo(0.28, 0.0);
  sh.quadraticCurveTo(0.42, 0.24, 0.34, 0.52);
  sh.quadraticCurveTo(0.26, 0.76, 0.02, 0.78);
  sh.quadraticCurveTo(-0.14, 0.76, -0.10, 0.60);
  sh.quadraticCurveTo(-0.04, 0.52, 0.08, 0.56);
  sh.quadraticCurveTo(0.16, 0.44, 0.06, 0.28);
  sh.quadraticCurveTo(-0.14, 0.24, -0.18, 0.0);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2
  });
  g.translate(0, 0, -0.07);
  if (sx < 0) g.scale(-scale, scale, scale);
  else g.scale(scale, scale, scale);
  return g;
}

/**
 * Helper: Sculpted `Đầu Đao` Dragon-Tail Corner Crest anchored flush to Hip Ridge (`KVC-26`)
 */
function createSculptedDauDaoGeo(scale = 1.0): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(0.0, 0.0);
  sh.lineTo(0.46, 0.04);
  sh.quadraticCurveTo(0.68, 0.14, 0.64, 0.42);
  sh.quadraticCurveTo(0.56, 0.58, 0.36, 0.52);
  sh.quadraticCurveTo(0.30, 0.44, 0.42, 0.36);
  sh.quadraticCurveTo(0.44, 0.24, 0.20, 0.22);
  sh.lineTo(0.0, 0.16);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: 0.10,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1
  });
  g.translate(0, 0, -0.05);
  g.scale(scale, scale, scale);
  return g;
}

/**
 * Helper: Authentic Giếng Thiên Quang Balustrade Side (`GTQ-07..12`)
 * Zero clipping: 3-tier chamfered stepped-cap posts, recessed plaster `ô hộc` frames,
 * and genuine see-through pierced 4-petal emerald ceramic `gạch thông gió` tiles!
 */
function addGiengThienQuangBalustradeSide(
  plasterParts: THREE.BufferGeometry[],
  ceramicParts: THREE.BufferGeometry[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  baseY: number,
  numBays: number,
  skipCenterGate = false
): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const totalLen = Math.hypot(dx, dz);
  const rotY = Math.atan2(dx, dz); // local +Z runs along balustrade
  const bayLen = totalLen / numBays;

  const placeOnLine = (g: THREE.BufferGeometry, localX: number, localY: number, alongZ: number) => {
    g.translate(localX, localY, alongZ);
    g.rotateY(rotY);
    g.translate(x0, baseY, z0);
    return g;
  };

  // Posts with Ref 71 3-tier chamfered stepped pyramidal caps
  for (let i = 0; i <= numBays; i++) {
    const along = i * bayLen;
    const isCorner = i === 0 || i === numBays;
    const pw = isCorner ? 0.48 : 0.42;
    const postH = 0.90;
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(pw, postH, pw), 0, postH * 0.5, along));
    // Neck collar
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(pw - 0.04, 0.05, pw - 0.04), 0, postH + 0.025, along));
    // 3-tier chamfered stepped cap (4-sided frustums rotated 45 deg for true beveled slopes!)
    const capTiers: Array<[number, number, number, number]> = [
      [pw + 0.14, pw + 0.18, 0.10, postH + 0.10],
      [pw + 0.02, pw + 0.08, 0.085, postH + 0.19],
      [pw - 0.12, pw - 0.04, 0.065, postH + 0.265]
    ];
    for (const [rT, rB, ch, cy] of capTiers) {
      const fr = new THREE.CylinderGeometry(rT * 0.707, rB * 0.707, ch, 4);
      fr.rotateY(Math.PI * 0.25);
      plasterParts.push(placeOnLine(fr, 0, cy, along));
    }
  }

  // Solid recessed plaster dado bays alternating `ô hộc chìm` frames & pierced emerald ceramic tile windows
  for (let b = 0; b < numBays; b++) {
    if (skipCenterGate && b === Math.floor(numBays / 2)) continue;
    const zStart = b * bayLen + 0.21;
    const zEnd = (b + 1) * bayLen - 0.21;
    const clearLen = zEnd - zStart;
    const zMid = (zStart + zEnd) * 0.5;

    // Continuous stepped base curb & overhanging beveled top rail
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.28, 0.14, clearLen + 0.04), 0, 0.07, zMid));
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.26, 0.12, clearLen + 0.04), 0, 0.78, zMid));
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.20, 0.05, clearLen + 0.02), 0, 0.695, zMid));

    // Subdivide bay into: [Solid Recessed Panel (34%)] — [Pierced Emerald Tile Aperture (32%)] — [Solid Recessed Panel (34%)]
    const winW = Math.min(0.96, clearLen * 0.34);
    const sideW = (clearLen - winW) * 0.5;

    // Left & Right solid recessed plaster panels (`ô hộc chìm`)
    for (const side of [-1, 1]) {
      const pMid = zMid + side * (winW * 0.5 + sideW * 0.5);
      // Recessed core wall (`0.14m` thick)
      plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.14, 0.54, sideW), 0, 0.41, pMid));
      // Raised outer picture-frame rails on both sides (creating crisp recessed shadow!)
      plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.21, 0.07, sideW), 0, 0.64, pMid));
      plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.21, 0.07, sideW), 0, 0.18, pMid));
      plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.21, 0.54, 0.07), 0, 0.41, pMid - sideW * 0.5 + 0.035));
      plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.21, 0.54, 0.07), 0, 0.41, pMid + sideW * 0.5 - 0.035));
    }

    // Center open aperture: top/bottom thin stone sills + 3 see-through pierced 4-petal emerald ceramic `gạch thông gió` tiles!
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.20, 0.10, winW + 0.02), 0, 0.19, zMid));
    plasterParts.push(placeOnLine(new THREE.BoxGeometry(0.20, 0.10, winW + 0.02), 0, 0.63, zMid));
    const tileCount = 3;
    const tileSize = Math.min(0.29, (winW - 0.04) / tileCount);
    for (let ti = 0; ti < tileCount; ti++) {
      const tz = zMid - winW * 0.5 + 0.02 + (ti + 0.5) * ((winW - 0.04) / tileCount);
      const tY = 0.41;
      // Outer ceramic frame (open center!)
      for (const s of [-1, 1]) {
        ceramicParts.push(placeOnLine(new THREE.BoxGeometry(0.08, 0.03, tileSize), 0, tY + s * (tileSize * 0.5 - 0.015), tz));
        ceramicParts.push(placeOnLine(new THREE.BoxGeometry(0.08, tileSize, 0.03), 0, tY, tz + s * (tileSize * 0.5 - 0.015)));
      }
      // Pierced 4-petal emerald floral lattice (`hoa chanh`) leaving real see-through daylight voids!
      const ring = new THREE.TorusGeometry(tileSize * 0.26, 0.022, 3, 6);
      ring.rotateY(Math.PI * 0.5);
      ceramicParts.push(placeOnLine(ring, 0, tY, tz));
      for (const ang of [Math.PI * 0.25, -Math.PI * 0.25]) {
        const rib = new THREE.BoxGeometry(0.06, tileSize * 0.88, 0.024);
        rib.rotateX(ang);
        ceramicParts.push(placeOnLine(rib, 0, tY, tz));
      }
    }
  }
}

/**
 * Helper: Sculpted Vietnamese `Cây Si` Bonsai Tree in Stoneware Planter (`KVC-07`, `GTQ-21`, `GTQ-22`)
 */
function addVietnameseBonsai(
  plasterParts: THREE.BufferGeometry[],
  woodParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  bx: number,
  by: number,
  bz: number,
  scale = 1.0,
  seed = 101
): void {
  const rand = mulberry32(seed);
  // Shallow weathered stoneware bowl (`LatheGeometry`)
  const bowlProf = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.32, 0.0),
    new THREE.Vector2(0.42, 0.14),
    new THREE.Vector2(0.46, 0.24),
    new THREE.Vector2(0.41, 0.26),
    new THREE.Vector2(0.36, 0.18)
  ];
  const bowl = new THREE.LatheGeometry(bowlProf, 10);
  bowl.scale(scale, scale, scale);
  bowl.translate(bx, by, bz);
  plasterParts.push(bowl);

  // Twisted S-curved gnarled trunk & 3 spreading boughs
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(bx, by + 0.16 * scale, bz),
    new THREE.Vector3(bx + 0.12 * scale, by + 0.44 * scale, bz + 0.06 * scale),
    new THREE.Vector3(bx - 0.10 * scale, by + 0.78 * scale, bz - 0.05 * scale),
    new THREE.Vector3(bx + 0.05 * scale, by + 1.12 * scale, bz + 0.02 * scale)
  ]);
  woodParts.push(createSmoothTaperedTubeGeometry(trunkCurve, 7, 5, (t) => (0.095 - t * 0.055) * scale));

  // 5 flattened horizontal manicured bonsai cloud-pads built from dense crossed leaf cards!
  const pads: Array<[number, number, number, number]> = [
    [-0.42, 0.72, 0.14, 0.44],
    [0.44, 0.84, -0.12, 0.42],
    [-0.26, 1.04, -0.22, 0.38],
    [0.28, 1.12, 0.18, 0.36],
    [0.02, 1.28, 0.0, 0.46]
  ];
  const greens = ['#1f4618', '#2d5f22', '#3f762b', '#4e8a34'];
  for (const [px, py, pz, pr] of pads) {
    // Connecting branch
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, by + (py - 0.14) * scale, bz),
      new THREE.Vector3(bx + px * scale * 0.85, by + (py - 0.04) * scale, bz + pz * scale * 0.85)
    ]);
    woodParts.push(createSmoothTaperedTubeGeometry(bCurve, 3, 4, () => 0.025 * scale));
    // 7 lush 3D tilted foliage cards per manicured bonsai cloud pad (visible from both eye-level & oblique views!)
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rand() * 0.4;
      const dist = rand() * pr * 0.45 * scale;
      const card = new THREE.PlaneGeometry(pr * 1.28 * scale, pr * 0.96 * scale);
      card.rotateX((rand() - 0.5) * 1.25);
      card.rotateY(a);
      card.rotateZ((rand() - 0.5) * 0.65);
      card.translate(
        bx + px * scale + Math.cos(a) * dist,
        by + (py + (rand() - 0.3) * 0.14) * scale,
        bz + pz * scale + Math.sin(a) * dist
      );
      foliageParts.push(colorizeGeo(card, greens[Math.floor(rand() * greens.length)]));
    }
  }
}

/**
 * Helper: Towering Ancient Hanoi `Muỗm / Sấu / Banyan` Courtyard Tree (`GTQ-16..18`, `BTS-27`, `KVC-32`)
 * Deep billowy multi-tiered emerald canopy screening background skyline while leaving clear walkways below!
 */
function addAncientHanoiTree(
  woodParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  tx: number,
  ty: number,
  tz: number,
  height: number,
  crownR: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  const trunkH = height * 0.48;
  // Flared buttressed banyan trunk
  addCyl(woodParts, crownR * 0.075, crownR * 0.135, trunkH, 6, tx, ty + trunkH * 0.5, tz);

  // 4 spreading primary boughs
  const boughTips: Array<[number, number, number]> = [[tx, ty + height * 0.82, tz]];
  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + rand() * 0.5;
    const bx = tx + Math.cos(ang) * crownR * 0.58;
    const bz = tz + Math.sin(ang) * crownR * 0.58;
    const by = ty + trunkH + height * (0.20 + rand() * 0.14);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(tx, ty + trunkH * 0.78, tz),
      new THREE.Vector3((tx + bx) * 0.5, ty + trunkH + height * 0.10, (tz + bz) * 0.5),
      new THREE.Vector3(bx, by, bz)
    ]);
    woodParts.push(createSmoothTaperedTubeGeometry(curve, 3, 4, (t) => crownR * (0.065 - t * 0.035)));
    boughTips.push([bx, by, bz]);
  }

  // Dense lush multi-tone emerald foliage cluster cards across all boughs
  const cDark = new THREE.Color('#183613');
  const cMid = new THREE.Color('#27551f');
  const cLit = new THREE.Color('#427a2d');
  const tmp = new THREE.Color();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let bi = 0; bi < boughTips.length; bi++) {
    const [cx, cy, cz] = boughTips[bi];
    const subR = bi === 0 ? crownR * 0.76 : crownR * 0.60;
    const cards = bi === 0 ? 14 : 9;
    for (let k = 0; k < cards; k++) {
      const f = (k + 0.5) / cards;
      const ny = (f - 0.15) * 1.15;
      const rRing = Math.sqrt(Math.max(0.04, 1 - Math.min(0.96, ny * ny)));
      const th = k * golden + rand() * 0.4;
      const nx = Math.cos(th) * rRing;
      const nz = Math.sin(th) * rRing;
      const dist = subR * (0.52 + rand() * 0.52);
      const cw = subR * (0.82 + rand() * 0.40);
      const card = new THREE.PlaneGeometry(cw, cw * 0.84);
      card.rotateX((rand() - 0.5) * 1.1);
      card.rotateY(th + (rand() - 0.5) * 1.2);
      card.rotateZ((rand() - 0.5) * 0.7);
      card.translate(cx + nx * dist, cy + ny * subR * 0.58, cz + nz * dist);
      const shade = clamp01((ny + 0.5) * 0.65 + (nx * 0.3 + nz * 0.2));
      if (shade < 0.5) tmp.copy(cDark).lerp(cMid, shade * 2);
      else tmp.copy(cMid).lerp(cLit, (shade - 0.5) * 2);
      foliageParts.push(colorizeGeo(card, `#${tmp.getHexString()}`));
    }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Helper: Museum-Grade Carved Thanh Hóa Limestone Tortoise & Doctors' Stele (`BTS-01..17`)
 *   - Seamless arched beveled stele monolith seated 6cm INSIDE an integrated mortise saddle (ZERO floating gap!)
 *   - Dedicated planar front/back UV face mapped to `1024×1536` `doctorsSteleFaceMat`
 *   - Lofted high-res monolithic tortoise carapace with top-down radial UVs for `1024×1024` `tortoiseCarapaceMat`
 *   - Anatomically sculpted broad smiling head with iconic dark glossy rubbed crown (`polishedHeadParts`)
 *   - Muscular splayed stone limbs with clawed paws on organic beveled boulder plinth!
 */
function addMuseumTurtleStele(
  limestoneParts: THREE.BufferGeometry[],
  steleFaceParts: THREE.BufferGeometry[],
  carapaceParts: THREE.BufferGeometry[],
  polishedHeadParts: THREE.BufferGeometry[],
  cx: number,
  y: number,
  cz: number,
  rotY: number,
  scale: number,
  eraIdx: number
): void {
  const wScale = 0.94 + (eraIdx % 3) * 0.05;
  const hScale = 0.94 + ((eraIdx + 1) % 3) * 0.06;
  const s = scale;

  const transformLocal = (g: THREE.BufferGeometry) => {
    if (rotY) g.rotateY(rotY);
    g.translate(cx, y, cz);
    return g;
  };

  // 1. Organic chamfered monolithic limestone boulder plinth (`Đế rùa`, BTS-16)
  const plinth = new THREE.CylinderGeometry(0.68 * s, 0.74 * s, 0.11 * s, 8);
  plinth.scale(0.96, 1.0, 1.24);
  plinth.translate(0, 0.055 * s, 0.04 * s);
  limestoneParts.push(transformLocal(plinth));

  // 2. Lofted High-Res Monolithic Tortoise Carapace (`Mai Rùa Lục Giác`, BTS-11 & BTS-12)
  const radSegs = 12;
  const elevSegs = 3;
  const posArr: number[] = [];
  const uvArr: number[] = [];
  const idxArr: number[] = [];
  for (let ei = 0; ei <= elevSegs; ei++) {
    const f = ei / elevSegs; // 0 = rim, 1 = apex
    const ringR = Math.cos(f * Math.PI * 0.48);
    // Flattened stately dorsal dome + subtly flared rim skirt
    const ry = (0.14 + Math.sin(f * Math.PI * 0.5) * 0.34 + (f < 0.15 ? (0.15 - f) * 0.06 : 0)) * s;
    for (let ri = 0; ri <= radSegs; ri++) {
      const a = (ri / radSegs) * Math.PI * 2;
      const px = Math.cos(a) * ringR * 0.64 * s;
      const pz = Math.sin(a) * ringR * 0.80 * s;
      posArr.push(px, ry, pz);
      uvArr.push(0.5 + (px / (1.32 * s)), 0.5 + (pz / (1.64 * s)));
    }
  }
  const stride = radSegs + 1;
  for (let ei = 0; ei < elevSegs; ei++) {
    for (let ri = 0; ri < radSegs; ri++) {
      const a = ei * stride + ri;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idxArr.push(a, c, b, b, c, d);
    }
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  shellGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  shellGeo.setIndex(idxArr);
  shellGeo.computeVertexNormals();
  carapaceParts.push(transformLocal(shellGeo));

  // 3. Sculpted Broad Smiling Tortoise Head & Neck (`Đầu Rùa`, BTS-13) + Glossy Dark Rubbed Crown (`BTS-14`!)
  const neck = new THREE.CylinderGeometry(0.16 * s, 0.21 * s, 0.34 * s, 6);
  neck.rotateX(Math.PI * 0.5);
  neck.translate(0, 0.21 * s, 0.66 * s);
  limestoneParts.push(transformLocal(neck));

  const head = new THREE.SphereGeometry(0.20 * s, 7, 5);
  head.scale(1.06, 0.86, 1.18);
  head.translate(0, 0.22 * s, 0.84 * s);
  limestoneParts.push(transformLocal(head));

  // Iconic dark glossy rubbed forehead crown cap (`Đầu rùa xoa bóng` — exact Ref 47 signature!)
  const crownCap = new THREE.SphereGeometry(0.185 * s, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.44);
  crownCap.scale(1.04, 0.88, 1.12);
  crownCap.translate(0, 0.232 * s, 0.84 * s);
  polishedHeadParts.push(transformLocal(crownCap));

  // 4. Four Muscular Splayed Stone Limbs with Webbed Clawed Paws (`BTS-15`) + Tucked Tail (`BTS-16`)
  const legSpecs: Array<[number, number, number]> = [
    [-0.46, 0.54, 0.48],
    [0.46, 0.54, -0.48],
    [-0.48, -0.48, -0.35],
    [0.48, -0.48, 0.35]
  ];
  for (const [lx, lz, yaw] of legSpecs) {
    const leg = new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.24 * s, 6);
    leg.scale(1.1, 1.0, 1.35);
    leg.rotateY(yaw);
    leg.translate(lx * s, 0.16 * s, lz * s);
    limestoneParts.push(transformLocal(leg));
    // 3 prominent carved rounded stone claws on each front paw
    if (lz > 0) {
      for (const co of [-0.075, 0, 0.075]) {
        const claw = new THREE.ConeGeometry(0.036 * s, 0.095 * s, 4);
        claw.rotateX(Math.PI * 0.5);
        claw.translate((lx + co) * s, 0.10 * s, (lz + 0.17) * s);
        limestoneParts.push(transformLocal(claw));
      }
    }
  }
  const tail = new THREE.ConeGeometry(0.09 * s, 0.24 * s, 4);
  tail.rotateX(-Math.PI * 0.42);
  tail.translate(0, 0.14 * s, -0.84 * s);
  limestoneParts.push(transformLocal(tail));

  // 5. Integrated Monolithic Mortise Saddle (`Ổ mộng`, rooted deep inside dome y = 0.34..0.56 -> ZERO air gap! BTS-02)
  const steleW = 0.98 * s * wScale;
  const steleD = 0.19 * s;
  const shaftH = 1.18 * s * hScale;
  const archR = steleW * 0.5;
  const totalSteleH = shaftH + archR;

  const saddle = new THREE.BoxGeometry(steleW + 0.14 * s, 0.24 * s, steleD + 0.18 * s);
  saddle.translate(0, 0.45 * s, -0.02 * s);
  limestoneParts.push(transformLocal(saddle));

  // 6. Seamless Arched Limestone Stele Monolith (`ExtrudeGeometry`, 6-seg smooth arch — BTS-03)
  const stShape = new THREE.Shape();
  stShape.moveTo(-archR, 0);
  stShape.lineTo(archR, 0);
  stShape.lineTo(archR * 0.97, shaftH);
  stShape.absarc(0, shaftH, archR * 0.97, 0, Math.PI, false);
  stShape.closePath();

  const steleBody = new THREE.ExtrudeGeometry(stShape, {
    depth: steleD,
    bevelEnabled: false,
    curveSegments: 6
  });
  steleBody.translate(0, 0.50 * s, -steleD * 0.5 - 0.02 * s);
  limestoneParts.push(transformLocal(steleBody));

  // 7. High-Resolution Carved Front & Back Stele Face Planes mapped cleanly 0..1 to `1024×1536` `doctorsSteleFaceMat` (`BTS-05..10`)
  const faceShape = new THREE.Shape();
  faceShape.moveTo(-archR * 0.96, 0);
  faceShape.lineTo(archR * 0.96, 0);
  faceShape.lineTo(archR * 0.94, shaftH);
  faceShape.absarc(0, shaftH, archR * 0.94, 0, Math.PI, false);
  faceShape.closePath();
  for (const faceSign of [1, -1]) {
    const faceGeo = new THREE.ShapeGeometry(faceShape, 6);
    const fPos = faceGeo.attributes.position;
    const fUv = faceGeo.attributes.uv;
    for (let vi = 0; vi < fPos.count; vi++) {
      const fx = fPos.getX(vi);
      const fy = fPos.getY(vi);
      fUv.setXY(vi, (fx + archR) / (archR * 2), fy / totalSteleH);
    }
    if (faceSign < 0) faceGeo.rotateY(Math.PI);
    faceGeo.translate(0, 0.51 * s, faceSign * (steleD * 0.5 + 0.008 * s) - 0.02 * s);
    steleFaceParts.push(transformLocal(faceGeo));
  }
}

/**
 * Helper: Sculpted Bát Tràng Cobalt Blue-and-White Porcelain Vase + Botanical Bouquet (`DDT-21`, `DDT-22`)
 */
function addPorcelainVaseWithFlowers(
  atlasParts: THREE.BufferGeometry[],
  solidColorParts: THREE.BufferGeometry[],
  vx: number,
  vy: number,
  vz: number,
  scale: number,
  flowerStyle: 'pink_lily' | 'yellow_chrysanthemum' | 'white_lily',
  seed: number
): void {
  const rand = mulberry32(seed);
  // Classic baluster `LatheGeometry` Bát Tràng porcelain vase mapped to `VAN_MIEU_ATLAS_UV.porcelain`!
  const prof = [
    new THREE.Vector2(0.08, 0.0),
    new THREE.Vector2(0.095, 0.04),
    new THREE.Vector2(0.075, 0.08),
    new THREE.Vector2(0.145, 0.20),
    new THREE.Vector2(0.15, 0.29),
    new THREE.Vector2(0.078, 0.37),
    new THREE.Vector2(0.085, 0.43),
    new THREE.Vector2(0.115, 0.46)
  ];
  const vase = new THREE.LatheGeometry(prof, 12);
  const [u0, v0, u1, v1] = VAN_MIEU_ATLAS_UV.porcelain;
  const uv = vase.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  vase.scale(scale, scale, scale);
  vase.translate(vx, vy, vz);
  atlasParts.push(vase);

  // Sculpted stems, lanceolate leaves & multi-petal botanical blooms (ZERO sphere blobs!)
  const stemCount = flowerStyle === 'yellow_chrysanthemum' ? 10 : 6;
  for (let k = 0; k < stemCount; k++) {
    const a = (k / stemCount) * Math.PI * 2 + rand() * 0.4;
    const spread = (0.12 + rand() * 0.16) * scale;
    const h = (0.28 + rand() * 0.24) * scale;
    const tipX = vx + Math.cos(a) * spread;
    const tipZ = vz + Math.sin(a) * spread;
    const tipY = vy + 0.42 * scale + h;

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(vx, vy + 0.38 * scale, vz),
      new THREE.Vector3(vx + Math.cos(a) * spread * 0.45, vy + 0.42 * scale + h * 0.55, vz + Math.sin(a) * spread * 0.45),
      new THREE.Vector3(tipX, tipY, tipZ)
    ]);
    solidColorParts.push(
      colorizeGeo(new THREE.TubeGeometry(stemCurve, 4, 0.008 * scale, 3, false), '#2a5620')
    );

    // Pointed green leaf along stem
    const leaf = new THREE.ConeGeometry(0.028 * scale, 0.14 * scale, 4);
    leaf.rotateZ(0.85);
    leaf.rotateY(a);
    leaf.translate(
      vx + Math.cos(a) * spread * 0.55,
      vy + 0.44 * scale + h * 0.42,
      vz + Math.sin(a) * spread * 0.55
    );
    solidColorParts.push(colorizeGeo(leaf, '#326626'));

    if (flowerStyle === 'yellow_chrysanthemum') {
      // Layered golden chrysanthemum petals
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2;
        const pet = new THREE.ConeGeometry(0.022 * scale, 0.055 * scale, 4);
        pet.rotateZ(Math.PI * 0.38);
        pet.rotateY(pa);
        pet.translate(tipX + Math.cos(pa) * 0.018 * scale, tipY, tipZ + Math.sin(pa) * 0.018 * scale);
        solidColorParts.push(colorizeGeo(pet, p % 2 === 0 ? '#f6cc1c' : '#e4ad10'));
      }
    } else {
      // 6-petal curved Asiatic lily trumpet (pink-crimson or creamy-white!)
      const pCol = flowerStyle === 'pink_lily' ? '#c82654' : '#fffdf0';
      const pCol2 = flowerStyle === 'pink_lily' ? '#e87898' : '#f7f1d4';
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2;
        const pet = new THREE.ConeGeometry(0.030 * scale, 0.115 * scale, 4);
        pet.rotateZ(0.95);
        pet.rotateY(pa);
        pet.translate(tipX + Math.cos(pa) * 0.036 * scale, tipY + 0.01 * scale, tipZ + Math.sin(pa) * 0.036 * scale);
        solidColorParts.push(colorizeGeo(pet, p % 2 === 0 ? pCol : pCol2));
      }
      const stamen = new THREE.SphereGeometry(0.016 * scale, 5, 4);
      stamen.translate(tipX, tipY + 0.012 * scale, tipZ);
      solidColorParts.push(colorizeGeo(stamen, '#f2b824'));
    }
  }
}

/**
 * Helper: Sculpted Bronze Crane Standing on Tortoise (`Hạc Chầu Quy`, DDT-26)
 */
function addSculptedBronzeCraneOnTortoise(
  parts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  rotY: number,
  scale = 1.0
): void {
  const s = scale;
  const place = (g: THREE.BufferGeometry) => {
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    parts.push(g);
  };
  // Tortoise base (`Quy`)
  const shell = new THREE.SphereGeometry(0.24 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  shell.scale(0.92, 0.72, 1.28);
  shell.translate(0, 0.08 * s, 0);
  place(shell);
  const tHead = new THREE.SphereGeometry(0.065 * s, 8, 6);
  tHead.translate(0, 0.11 * s, 0.32 * s);
  place(tHead);
  for (const [lx, lz] of [[-0.16, 0.18], [0.16, 0.18], [-0.16, -0.18], [0.16, -0.18]]) {
    const leg = new THREE.CylinderGeometry(0.035 * s, 0.042 * s, 0.11 * s, 6);
    leg.translate(lx * s, 0.055 * s, lz * s);
    place(leg);
  }
  // Slender articulated crane legs
  for (const sx of [-0.065, 0.065]) {
    const leg = new THREE.CylinderGeometry(0.018 * s, 0.020 * s, 0.68 * s, 6);
    leg.translate(sx * s, 0.52 * s, 0);
    place(leg);
  }
  // Sculpted feathered teardrop body + folded wing plates + tail plume
  const body = new THREE.SphereGeometry(0.19 * s, 12, 8);
  body.scale(0.84, 0.96, 1.38);
  body.rotateX(-0.22);
  body.translate(0, 0.96 * s, -0.02 * s);
  place(body);
  const tail = new THREE.ConeGeometry(0.11 * s, 0.34 * s, 7);
  tail.rotateX(-Math.PI * 0.68);
  tail.translate(0, 0.86 * s, -0.32 * s);
  place(tail);
  // Graceful S-curved neck + head + tapered beak holding lotus stem
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.06 * s, 0.12 * s),
    new THREE.Vector3(0, 1.34 * s, 0.22 * s),
    new THREE.Vector3(0, 1.56 * s, 0.10 * s),
    new THREE.Vector3(0, 1.72 * s, 0.18 * s)
  ]);
  place(createSmoothTaperedTubeGeometry(neckCurve, 10, 6, (t) => (0.045 - t * 0.016) * s));
  const cHead = new THREE.SphereGeometry(0.055 * s, 8, 6);
  cHead.translate(0, 1.74 * s, 0.20 * s);
  place(cHead);
  const beak = new THREE.ConeGeometry(0.020 * s, 0.16 * s, 5);
  beak.rotateX(Math.PI * 0.56);
  beak.translate(0, 1.72 * s, 0.30 * s);
  place(beak);
}

/**
 * Builds the complete Museum-Grade Văn Miếu — Quốc Tử Giám Complex (`KhueVanCacComplex`),
 * implementing all 125 QC audit items (`KVC-01..32`, `GTQ-01..31`, `BTS-01..30`, `DDT-01..32`).
 */
export function buildVanMieuQuocTuGiamComplex(input: VanMieuBuilderInput): THREE.Group {
  const {
    scene,
    renderer,
    sharedMaterials: shared,
    leafAtlas,
    cachedDongSon,
    lanternSilkMaterial,
    lanternCoreMaterial,
    sharedShaders,
    signageAtlas,
    exclusionCircles,
    incenseSources,
    extraMaterials,
    extraTextures,
    extraAnimatedUniforms
  } = input;

  const group = new THREE.Group();
  group.name = 'KhueVanCacComplex';

  const courtY = getVietnamHeritageHeight(0, 0); // 1.45m
  exclusionCircles.push(
    { x: 0, z: 0, r: 18.0 },
    { x: 0, z: 16, r: 12.0 },
    { x: 0, z: 36, r: 11.0 },
    { x: 0, z: 54, r: 14.0 }
  );

  // Build our lean 14-material museum PBR & Hanzi Calligraphy Pack
  const vm = createVanMieuMaterialPack(renderer);
  extraMaterials.push(...vm.allMaterials);
  extraTextures.push(...vm.allTextures);

  // Shared canonical materials (ZERO redundant extra materials!)
  const stoneMat = shared.stone;
  const wellPlasterMat = shared.agedPlaster ?? shared.whitePlaster;
  const steleLimestoneMat = shared.mossyPlaster ?? shared.agedPlaster ?? shared.stone;
  const ancientBrickMat = shared.weatheredImperialBrick ?? shared.stone;
  const batTrangMat = shared.batTrangFloor ?? shared.stone;
  const ironwoodMat = shared.darkIronwood ?? shared.darkWood;
  const bronzeMat = shared.bronzePatina ?? shared.bronze;
  const goldMat = shared.gold;
  const jadeCeramicMat = shared.jadeRoof ?? wellPlasterMat;

  // Geometry merge buckets
  const stoneParts: THREE.BufferGeometry[] = [];
  const wellPlasterParts: THREE.BufferGeometry[] = [];
  const kvcPierReliefParts: THREE.BufferGeometry[] = [];
  const kvcCrimsonParts: THREE.BufferGeometry[] = [];
  const kvcFriezeParts: THREE.BufferGeometry[] = [];
  const kvcRoofParts: THREE.BufferGeometry[] = [];
  const ancientBrickParts: THREE.BufferGeometry[] = [];
  const ironwoodParts: THREE.BufferGeometry[] = [];
  const ngoiChieuParts: THREE.BufferGeometry[] = [];
  const batTrangParts: THREE.BufferGeometry[] = [];
  const greenCeramicParts: THREE.BufferGeometry[] = [];
  const steleLimestoneParts: THREE.BufferGeometry[] = [];
  const steleFaceParts: THREE.BufferGeometry[] = [];
  const carapaceParts: THREE.BufferGeometry[] = [];
  const polishedHeadParts: THREE.BufferGeometry[] = [];
  const sanctuaryCrimsonParts: THREE.BufferGeometry[] = [];
  const sanctuaryGoldParts: THREE.BufferGeometry[] = [];
  const confuciusHeroParts: THREE.BufferGeometry[] = [];
  const calligraphyAtlasParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const solidColorParts: THREE.BufferGeometry[] = []; // vertex-colored botanicals, dark beard, tray, lotus, moss!
  const foliageCardParts: THREE.BufferGeometry[] = []; // leafAtlas alpha-tested Hanoi trees, bonsai & hedges!

  const signageCtx = {
    extraTextures,
    extraMaterials,
    signageAtlas: signageAtlas ?? undefined
  };

  // =================================================================================================
  // SECTION 1: SPAWN PROMENADE, ANTI-GLARE TRỐNG ĐỒNG ĐÔNG SƠN MEDALLION, NON-BLOOMING TRIPODS & LOTUS BASINS
  // (GTQ-25..GTQ-29)
  // =================================================================================================
  const dongSon =
    cachedDongSon ??
    (() => {
      const t = createDongSonBronzeTextures(512, renderer);
      extraTextures.push(t.map, t.normalMap, t.roughnessMap);
      return t;
    })();
  // Anti-glare museum antique patinated bronze (GTQ-25: deeper color #a48a62, roughness 0.74, metalness 0.24!)
  const drumPlazaMat = new THREE.MeshStandardMaterial({
    color: '#a48a62',
    map: dongSon.map,
    normalMap: dongSon.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: dongSon.roughnessMap,
    roughness: 0.74,
    metalness: 0.24
  });
  extraMaterials.push(drumPlazaMat);

  const drumGeo = new THREE.CylinderGeometry(6.45, 6.55, 0.05, 48);
  const drumMesh = new THREE.Mesh(drumGeo, [bronzeMat, drumPlazaMat, bronzeMat]);
  const drumCenterY = getVietnamHeritageHeight(0, 16) + 0.025;
  drumMesh.position.set(0, drumCenterY, 16);
  drumMesh.receiveShadow = true;
  drumMesh.name = 'DongSonPlazaMedallion';
  group.add(drumMesh);

  // Flush carved dark Thanh Hóa stone ring curb embedding the medallion (GTQ-26!)
  const curbRingShape = new THREE.Shape();
  curbRingShape.absarc(0, 0, 7.05, 0, Math.PI * 2, false);
  const curbHole = new THREE.Path();
  curbHole.absarc(0, 0, 6.48, 0, Math.PI * 2, true);
  curbRingShape.holes.push(curbHole);
  const curbRingGeo = new THREE.ExtrudeGeometry(curbRingShape, {
    depth: 0.065,
    bevelEnabled: false,
    curveSegments: 24
  });
  curbRingGeo.rotateX(-Math.PI * 0.5);
  curbRingGeo.translate(0, drumCenterY - 0.015, 16);
  stoneParts.push(curbRingGeo);

  // Stepped promenade tiers & weathered grey granite step curbs (GTQ-29 — zero stark white glare bar!)
  for (const tz of [48.0, 36.0, 24.5]) {
    const ty = getVietnamHeritageHeight(0, tz);
    const tierW = tz === 48.0 ? 9.6 : 16.6;
    addBox(stoneParts, tierW, 0.24, 1.35, 0, ty + 0.06, tz);
    addBox(wellPlasterParts, tierW + 0.16, 0.12, 0.26, 0, ty + 0.17, tz + 0.56);
  }
  for (const side of [-1, 1]) {
    const midY = getVietnamHeritageHeight(side * 4.5, 52.4);
    addBox(wellPlasterParts, 0.36, 0.11, 8.2, side * 4.5, midY + 0.04, 52.4);
  }
  for (const pz of [50.4, 52.8, 55.2]) {
    const py = getVietnamHeritageHeight(0, pz);
    addBox(stoneParts, 8.6, 0.05, 0.68, 0, py + 0.025, pz);
  }

  // Four Monumental *Trụ biểu* Ceremonial Pillars along south promenade (z = 41, 28)
  for (const tz of [41.0, 28.0]) {
    for (const side of [-1, 1]) {
      const px = side * 8.5;
      const py = getVietnamHeritageHeight(px, tz);
      addBox(stoneParts, 0.68, 3.6, 0.68, px, py + 1.8, tz);
      addBox(wellPlasterParts, 0.92, 0.34, 0.92, px, py + 3.72, tz);
      addCyl(goldParts, 0.28, 0.38, 0.32, 8, px, py + 4.02, tz);
      const flameBud = new THREE.ConeGeometry(0.22, 0.56, 8);
      flameBud.translate(px, py + 4.44, tz);
      goldParts.push(flameBud);
    }
  }

  // Four Bronze Incense Tripods on weathered grey stone pedestals (GTQ-27: zero glowing white blobs, slender incense wisps!)
  for (const [ux, uz, uScale] of [
    [-5.8, 22.5, 1.05],
    [5.8, 22.5, 1.05],
    [-3.35, 51.4, 0.92],
    [3.35, 51.4, 0.92]
  ] as const) {
    const uy = getVietnamHeritageHeight(ux, uz);
    const tripod = createBronzeIncenseTripodParts(ux, uy, uz, uScale);
    wellPlasterParts.push(...tripod.limestoneParts);
    bronzeParts.push(...tripod.bronzeParts, ...tripod.goldParts);
    incenseSources.push({ x: ux, y: tripod.smokeY, z: uz, scale: uScale * 0.44 });
  }

  // Twin Foreground Lotus Basins at (±9.4, 48.5) — vertex-colored foliage/flowers (0 extra materials!)
  const fgRand = mulberry32(771122);
  const lanternPositions: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    const bx = side * 9.4;
    const bz = 48.5;
    const by = getVietnamHeritageHeight(bx, bz);
    const waterY = by + 0.28;
    exclusionCircles.push({ x: bx, z: bz, r: 6.2 });
    for (const sz of [-5.3, 5.3]) {
      addBox(stoneParts, 7.8, 0.26, 0.44, bx, by + 0.03, bz + sz);
      addBox(wellPlasterParts, 7.9, 0.16, 0.52, bx, by + 0.24, bz + sz);
    }
    for (const sx of [-3.65, 3.65]) {
      addBox(stoneParts, 0.44, 0.26, 11.0, bx + sx, by + 0.03, bz);
      addBox(wellPlasterParts, 0.52, 0.16, 11.1, bx + sx, by + 0.24, bz);
    }
    for (const sz of [-5.3, 5.3]) {
      for (const sx of [-3.65, 3.65]) {
        const cx = bx + sx;
        const cz = bz + sz;
        addBox(wellPlasterParts, 0.58, 0.54, 0.58, cx, by + 0.27, cz);
        wellPlasterParts.push(...createLotusFinialParts(cx, by + 0.54, cz, 0.72));
      }
    }
    const wPlane = new THREE.PlaneGeometry(7.0, 10.4);
    wPlane.rotateX(-Math.PI * 0.5);
    wPlane.translate(bx, waterY, bz);
    solidColorParts.push(colorizeGeo(wPlane, '#4b5b2a'));

    for (let k = 0; k < 28; k++) {
      const px = bx + (fgRand() - 0.5) * 5.8;
      const pz = bz + (fgRand() - 0.5) * 9.0;
      const padR = 0.24 + fgRand() * 0.20;
      const pad = new THREE.CircleGeometry(padR, 8, 0.2, Math.PI * 1.82);
      pad.rotateX(-Math.PI * 0.5);
      pad.rotateY(fgRand() * Math.PI * 2);
      pad.translate(px, waterY + 0.02 + fgRand() * 0.06, pz);
      solidColorParts.push(colorizeGeo(pad, k % 2 === 0 ? '#2c6c34' : '#3a7c3a'));
    }
    for (let f = 0; f < 8; f++) {
      const fx = bx + (fgRand() - 0.5) * 5.4;
      const fz = bz + (fgRand() - 0.5) * 8.6;
      const flower = createForegroundLotusFlowerParts(fx, waterY, fz, 0.16 + fgRand() * 0.24, 0.95 + fgRand() * 0.35, 0.4 + fgRand() * 0.55, fgRand() * Math.PI * 2);
      for (const g of flower.stemParts) solidColorParts.push(colorizeGeo(g, '#28602c'));
      for (const g of flower.petalParts) solidColorParts.push(colorizeGeo(g, '#e87ca4'));
      for (const g of flower.coreParts) solidColorParts.push(colorizeGeo(g, '#ecc038'));
    }
  }

  // Ceremonial Stone Balustrades STRICTLY SOUTH of Khuê Văn Các (`z = 8..14` & `28..40`, GTQ-13: ZERO stray rails/lanterns blocking Khuê Văn Các wing walls!)
  for (const [zStart, zEnd] of [
    [8, 14],
    [28, 40]
  ] as const) {
    for (let z = zStart; z <= zEnd + 0.01; z += 6.0) {
      for (const side of [-1, 1]) {
        const px = side * 8.5;
        const py = getVietnamHeritageHeight(px, z);
        addBox(stoneParts, 0.46, 1.15, 0.46, px, py + 0.56, z);
        addBox(wellPlasterParts, 0.58, 0.15, 0.58, px, py + 1.18, z);
        if (z + 6.0 <= zEnd + 0.01) {
          const nextY = getVietnamHeritageHeight(px, z + 6.0);
          const len = Math.hypot(6.0, nextY - py);
          addBox(stoneParts, 0.20, 0.16, len, px, (py + nextY) * 0.5 + 0.86, z + 3.0, 0, Math.atan2(py - nextY, 6.0));
        }
        if (z >= 28) lanternPositions.push(new THREE.Vector3(px, py + 1.26, z));
      }
    }
  }

  // =================================================================================================
  // SECTION 2: KHUÊ VĂN CÁC — AUTHENTIC *LẦU VUÔNG 8 MÁI* (KVC-01..KVC-32)
  // =================================================================================================
  // Low authentic 2-step square stone platform (`0.48m` total rise — KVC-01, zero giant pyramid/wave rails!)
  const plinthTop = courtY + 0.48;
  addBox(stoneParts, 7.4, 0.34, 7.4, 0, courtY + 0.07, 0);
  addBox(stoneParts, 6.8, 0.26, 6.8, 0, courtY + 0.35, 0);
  addBox(wellPlasterParts, 6.92, 0.07, 6.92, 0, plinthTop - 0.02, 0);
  // Compact 2-riser South & North steps
  for (const dirZ of [-1, 1]) {
    addBox(stoneParts, 3.4, 0.24, 0.62, 0, courtY + 0.12, dirZ * 3.92);
    addBox(stoneParts, 3.4, 0.24, 0.52, 0, courtY + 0.34, dirZ * 3.55);
  }

  // 4 Open Corner Square Lime-Plaster Piers (1.02m × 3.55m) with 16 Sculpted *Tứ Quý / Sóng Nước* Relief Faces (`KVC-02..05`)
  const pierH = 3.55;
  const pierOffsets: Array<[number, number]> = [
    [-2.44, -2.44],
    [2.44, -2.44],
    [-2.44, 2.44],
    [2.44, 2.44]
  ];
  for (const [ox, oz] of pierOffsets) {
    // 2-step subtle damp weathered socle (NO oversized capital! KVC-04)
    addBox(stoneParts, 1.14, 0.10, 1.14, ox, plinthTop + 0.05, oz);
    addBox(wellPlasterParts, 1.07, 0.08, 1.07, ox, plinthTop + 0.14, oz);
    // Main pier core flush into perimeter lintel
    addBox(wellPlasterParts, 1.02, pierH, 1.02, ox, plinthTop + pierH * 0.5, oz);
    // All 4 vertical faces mapped cleanly 0..1 to `512×1024` `kvcPierReliefMat`!
    for (const faceRy of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
      const rp = new THREE.PlaneGeometry(0.98, pierH - 0.14);
      rp.translate(0, 0, 0.516);
      rp.rotateY(faceRy);
      rp.translate(ox, plinthTop + pierH * 0.5 + 0.04, oz);
      kvcPierReliefParts.push(rp);
    }
  }

  // Flush perimeter ring lintels + recessed weathered cinnabar wooden tie-beams + dark-crimson plank soffit (`KVC-06`)
  const beamY = plinthTop + pierH + 0.12;
  for (const side of [-1, 1]) {
    addBox(wellPlasterParts, 5.90, 0.24, 1.02, 0, beamY, side * 2.44);
    addBox(wellPlasterParts, 1.02, 0.24, 5.90, side * 2.44, beamY, 0);
    // Inset weathered cinnabar wooden lintel strip visible right under the frieze on all 4 sides!
    addBox(kvcCrimsonParts, 3.92, 0.16, 0.94, 0, plinthTop + pierH - 0.04, side * 2.44);
    addBox(kvcCrimsonParts, 0.94, 0.16, 3.92, side * 2.44, plinthTop + pierH - 0.04, 0);
  }
  // Dark-crimson timber underside ceiling + 5 cross-joists spanning the open walk-through
  addBox(kvcCrimsonParts, 4.95, 0.08, 4.95, 0, plinthTop + pierH + 0.04, 0);
  for (let j = -2; j <= 2; j++) {
    addBox(ironwoodParts, 4.85, 0.12, 0.11, 0, plinthTop + pierH - 0.04, j * 0.98);
  }

  // Carved 6-Bay Under-Balcony Frieze (`Yếm chạm rồng mây`, height 0.34m — KVC-10) + Slim Recessed Deck (`KVC-12`)
  const friezeY = beamY + 0.29;
  const upperFloorY = friezeY + 0.22;
  addBox(kvcCrimsonParts, 5.88, 0.34, 5.88, 0, friezeY, 0);
  // Projecting stepped weathered molding shelves top & bottom of frieze
  addBox(wellPlasterParts, 6.04, 0.06, 6.04, 0, friezeY - 0.18, 0);
  addBox(wellPlasterParts, 6.04, 0.06, 6.04, 0, friezeY + 0.18, 0);
  for (const faceRy of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
    const fp = new THREE.PlaneGeometry(5.92, 0.32);
    fp.translate(0, 0, 2.96);
    fp.rotateY(faceRy);
    fp.translate(0, friezeY, 0);
    kvcFriezeParts.push(fp);
  }
  addBox(kvcCrimsonParts, 5.56, 0.10, 5.56, 0, upperFloorY + 0.05, 0);

  // Authentic Dense *Con Tiện* Spindle Balcony (`KVC-11` — 4 capped posts, ~10 spindles/bay, lowered center window sill!)
  const balY = upperFloorY + 0.10;
  addKvcBalconySide(kvcCrimsonParts, 0, 2.78, balY, 0, true);
  addKvcBalconySide(kvcCrimsonParts, 0, -2.78, balY, Math.PI, true);
  addKvcBalconySide(kvcCrimsonParts, 2.78, 0, balY, Math.PI * 0.5, false);
  addKvcBalconySide(kvcCrimsonParts, -2.78, 0, balY, -Math.PI * 0.5, false);

  // Upper Pavilion Walls & Aligned 12 Flush Timber Columns (`±2.12m` — KVC-16!)
  const wallHalf = 2.12;
  const wallH = 2.48;
  const winCenterY = upperFloorY + 1.24;
  for (const [cx, cz, r] of [
    [-2.12, -2.12, 0.135],
    [2.12, -2.12, 0.135],
    [-2.12, 2.12, 0.135],
    [2.12, 2.12, 0.135],
    [-0.90, 2.12, 0.105],
    [0.90, 2.12, 0.105],
    [-0.90, -2.12, 0.105],
    [0.90, -2.12, 0.105],
    [2.12, -0.90, 0.105],
    [2.12, 0.90, 0.105],
    [-2.12, -0.90, 0.105],
    [-2.12, 0.90, 0.105]
  ]) {
    addCyl(kvcCrimsonParts, r * 0.94, r, wallH + 0.12, 10, cx, upperFloorY + wallH * 0.5 + 0.06, cz);
  }
  for (const side of [-1, 1]) {
    addBox(kvcCrimsonParts, 4.44, 0.16, 0.18, 0, upperFloorY + wallH + 0.04, side * wallHalf);
    addBox(kvcCrimsonParts, 0.18, 0.16, 4.44, side * wallHalf, upperFloorY + wallH + 0.04, 0);
  }

  // Upper Wall Spandrels, Bold Chamfered `Cửa Sổ Mặt Trời` + 8 Turned Corner Sun-Rays + 8 Flush Hanzi `Câu Đối` (`KVC-13..18`)
  // (ZERO duplicate floating sun-windows! ZERO North Latin plaque!)
  const sunRingShape = new THREE.Shape();
  sunRingShape.absarc(0, 0, 0.80, 0, Math.PI * 2, false);
  const sunHole = new THREE.Path();
  sunHole.absarc(0, 0, 0.65, 0, Math.PI * 2, true);
  sunRingShape.holes.push(sunHole);
  const rayProf = [
    new THREE.Vector2(0.036, 0.0),
    new THREE.Vector2(0.048, 0.18),
    new THREE.Vector2(0.036, 0.30),
    new THREE.Vector2(0.038, 0.70),
    new THREE.Vector2(0.048, 0.82),
    new THREE.Vector2(0.036, 1.0)
  ];

  const kvcFaces: Array<[number, number, number]> = [
    [0, wallHalf, 0],
    [0, -wallHalf, Math.PI],
    [wallHalf, 0, Math.PI * 0.5],
    [-wallHalf, 0, -Math.PI * 0.5]
  ];
  for (let fi = 0; fi < kvcFaces.length; fi++) {
    const [fx, fz, ry] = kvcFaces[fi];
    const placeFace = (g: THREE.BufferGeometry) => {
      g.rotateY(ry);
      g.translate(fx, winCenterY, fz);
      kvcCrimsonParts.push(g);
    };
    // Flanking vertical plank pilasters (`±1.48m`) & top/bottom spandrels framing `1.62m × 1.62m` square opening
    for (const sx of [-1.48, 1.48]) {
      const pil = new THREE.BoxGeometry(1.16, wallH, 0.18);
      pil.translate(sx, 0, -0.04);
      placeFace(pil);
    }
    for (const sy of [-1.02, 1.02]) {
      const sp = new THREE.BoxGeometry(1.76, 0.42, 0.18);
      sp.translate(0, sy, -0.04);
      placeFace(sp);
    }
    // Mitered `1.62m × 1.62m` timber window casing
    for (const s of [-1, 1]) {
      const fh = new THREE.BoxGeometry(1.72, 0.09, 0.16);
      fh.translate(0, s * 0.81, 0);
      placeFace(fh);
      const fv = new THREE.BoxGeometry(0.09, 1.70, 0.16);
      fv.translate(s * 0.81, 0, 0);
      placeFace(fv);
    }
    // Bold beveled circular sun ring kissing all 4 square frame edges (`KVC-14`)
    const ringGeo = new THREE.ExtrudeGeometry(sunRingShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 1,
      curveSegments: 32
    });
    ringGeo.translate(0, 0, -0.07);
    placeFace(ringGeo);

    // 8 straight turned sun-rays radiating 2 per corner quadrant (`±23°, ±67°`)
    const rayAnglesDeg = [23, 67, 113, 157, 203, 247, 293, 337];
    for (const deg of rayAnglesDeg) {
      const ang = (deg * Math.PI) / 180;
      const ca = Math.abs(Math.cos(ang));
      const sa = Math.abs(Math.sin(ang));
      const maxD = Math.min(ca > 0.01 ? 0.83 / ca : 2, sa > 0.01 ? 0.83 / sa : 2);
      const rLen = Math.max(0.14, maxD - 0.78);
      const ray = new THREE.LatheGeometry(rayProf, 7);
      ray.scale(1, rLen, 1);
      ray.translate(0, 0.78, 0);
      ray.rotateZ(ang - Math.PI * 0.5);
      placeFace(ray);
    }

    // Authentic weathered Hanzi vertical `Câu Đối` couplets on ALL 4 faces (`KVC-18`, 8 boards total!)
    for (const [side, key] of [
      [-1, 'cauDoiKvc1'],
      [1, 'cauDoiKvc2']
    ] as Array<[-1 | 1, VanMieuAtlasKey]>) {
      const board = makeAtlasPlane(0.36, 1.56, key, 0, 0, 0);
      board.translate(side * 1.38, 0, 0.075);
      board.rotateY(ry);
      board.translate(fx, winCenterY, fz);
      calligraphyAtlasParts.push(board);
    }
  }

  // South-only weathered antique gold-on-dark-lacquer `"閣 文 奎"` Hoành Phi tucked above South window (`KVC-17`)
  addBox(kvcCrimsonParts, 1.76, 0.56, 0.08, 0, upperFloorY + 2.26, wallHalf + 0.08);
  calligraphyAtlasParts.push(makeAtlasPlane(1.70, 0.50, 'khueVan', 0, upperFloorY + 2.26, wallHalf + 0.125, 0));

  // Authentic Stepped 3-Tier Carved Wooden Corner Brackets (`Bẩy Góc / Con Sơn`) UNDER Lower Roof Eaves (`KVC-09`!)
  for (const [ox, oz] of [
    [-2.06, -2.06],
    [2.06, -2.06],
    [-2.06, 2.06],
    [2.06, 2.06]
  ]) {
    const diagRot = Math.atan2(ox, oz) - Math.PI * 0.5;
    addKvcSteppedCornerBracket(kvcCrimsonParts, ox, upperFloorY + 2.02, oz, diagRot, 1.0);
  }
  for (const [ix, iz, rY] of [
    [-0.90, 2.12, -Math.PI * 0.5],
    [0.90, 2.12, -Math.PI * 0.5],
    [-0.90, -2.12, Math.PI * 0.5],
    [0.90, -2.12, Math.PI * 0.5],
    [2.12, -0.90, 0],
    [2.12, 0.90, 0],
    [-2.12, -0.90, Math.PI],
    [-2.12, 0.90, Math.PI]
  ]) {
    addKvcSteppedCornerBracket(kvcCrimsonParts, ix, upperFloorY + 2.12, iz, rY, 0.65);
  }

  // Clean Open Atmospheric Interior: Dark Timber Ceiling Cross-Beams & Raised Verdigris Bronze Bell (`KVC-19`, zero glowing orange orb!)
  for (const off of [-1.05, 0, 1.05]) {
    addBox(ironwoodParts, 3.9, 0.14, 0.13, 0, upperFloorY + 2.40, off);
    addBox(ironwoodParts, 0.13, 0.14, 3.9, off, upperFloorY + 2.40, 0);
  }
  bronzeParts.push(...createBronzeBellParts(0, upperFloorY + 2.02, 0, 0.42));

  // Authentic Compact Thickened Double-Tiered 8-Roof Crown (`Lầu Vuông 8 Mái` — KVC-20..27!)
  const roof1Y = upperFloorY + 2.46;
  const r1W = 6.95;
  const r1Top = 4.60;
  const r1H = 1.04;
  const roof1Geo = createHueImperialHipRoofGeometry(r1W, r1W, r1Top, r1Top, r1H, 0.22, 10, 6, false);
  roof1Geo.translate(0, roof1Y, 0);
  kvcRoofParts.push(roof1Geo);
  // Dark-timber underside soffit shell + exposed eave rafter tails sealing roof thickness (`KVC-21`!)
  const roof1Soffit = createHueImperialHipRoofGeometry(r1W - 0.10, r1W - 0.10, r1Top, r1Top, r1H, 0.20, 6, 4, false);
  roof1Soffit.scale(1, 0.96, 1);
  roof1Soffit.translate(0, roof1Y - 0.08, 0);
  ironwoodParts.push(roof1Soffit);
  for (let ri = -12; ri <= 12; ri++) {
    const rOff = ri * 0.26;
    for (const s of [-1, 1]) {
      addBox(ironwoodParts, 0.055, 0.07, 1.05, rOff, roof1Y + 0.16, s * 2.86, 0, s * 0.34, 0);
      addBox(ironwoodParts, 1.05, 0.07, 0.055, s * 2.86, roof1Y + 0.16, rOff, 0, 0, -s * 0.34);
    }
  }

  // Recessed `Cổ Diêm` Clerestory Collar + Grey Lime Flashing Ledge (`KVC-27`)
  addBox(wellPlasterParts, r1Top + 0.18, 0.12, r1Top + 0.18, 0, roof1Y + r1H + 0.04, 0);
  addBox(kvcCrimsonParts, 4.38, 0.36, 4.38, 0, roof1Y + r1H + 0.24, 0);

  // Upper 4-Roof Crown (`Mái Trên`, compact `5.45m × 5.25m` -> `2.45m × 0.28m` knife ridge! KVC-20)
  const roof2Y = roof1Y + r1H + 0.38;
  const r2W = 5.45;
  const r2D = 5.25;
  const r2TopW = 2.45;
  const r2H = 1.54;
  const roof2Geo = createHueImperialHipRoofGeometry(r2W, r2D, r2TopW, 0.28, r2H, 0.24, 10, 6, false);
  roof2Geo.translate(0, roof2Y, 0);
  kvcRoofParts.push(roof2Geo);
  const roof2Soffit = createHueImperialHipRoofGeometry(r2W - 0.10, r2D - 0.10, r2TopW, 0.28, r2H, 0.22, 6, 4, false);
  roof2Soffit.scale(1, 0.96, 1);
  roof2Soffit.translate(0, roof2Y - 0.08, 0);
  ironwoodParts.push(roof2Soffit);

  // East & West Recessed Crimson Triangular Gable Pediments + Stepped Mossy Mortar Bargeboards (`KVC-27`)
  const gableSh = new THREE.Shape();
  gableSh.moveTo(-1.05, 0);
  gableSh.lineTo(1.05, 0);
  gableSh.lineTo(0, 0.82);
  gableSh.closePath();
  for (const sx of [-1, 1]) {
    const gf = new THREE.ExtrudeGeometry(gableSh, { depth: 0.12, bevelEnabled: false });
    gf.rotateY(Math.PI * 0.5);
    gf.translate(sx * (r2TopW * 0.5 - 0.02) - 0.06, roof2Y + r2H - 0.84, 0);
    kvcCrimsonParts.push(gf);
  }

  // All 8 Flush Curved Mossy Lime-Mortar Hip Ridges (`Bờ Chảy`) + Sculpted `Đầu Đao` Corner Crests (ZERO hanging bells! KVC-23, KVC-26)
  const addKvcHipRidgesAndDauDao = (
    baseW: number,
    baseD: number,
    topW: number,
    topD: number,
    baseY: number,
    h: number,
    flare: number,
    daoScale: number
  ) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          const x = sx * (THREE.MathUtils.lerp(baseW, topW, t) * 0.5);
          const z = sz * (THREE.MathUtils.lerp(baseD, topD, t) * 0.5);
          const concave = Math.pow(t, 1.38);
          const cornerUp = (1 - t) * (1 - t) * flare * 0.92;
          const py = baseY + concave * h + cornerUp + 0.06;
          pts.push(new THREE.Vector3(x, py, z));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        wellPlasterParts.push(createSmoothTaperedTubeGeometry(curve, 10, 6, () => 0.088));
        // Anchor sculpted `Đầu Đao` flush to outer hip ridge endpoint (`pts[0]`)!
        const dd = createSculptedDauDaoGeo(daoScale);
        dd.rotateY(Math.atan2(-sz, sx));
        dd.translate(pts[0].x, pts[0].y - 0.04, pts[0].z);
        wellPlasterParts.push(dd);
      }
    }
  };
  addKvcHipRidgesAndDauDao(r1W, r1W, r1Top, r1Top, roof1Y, r1H, 0.22, 0.88);
  addKvcHipRidgesAndDauDao(r2W, r2D, r2TopW, 0.28, roof2Y, r2H, 0.24, 0.78);

  // Carved 3-Tier Main Ridge (`Bờ Nóc`, KVC-23) + Sculpted `Kìm Nóc` Dragon Finials (`KVC-24`) + Hollow Flaming `Mặt Nguyệt` (`KVC-25`)
  const ridgeY = roof2Y + r2H;
  addBox(wellPlasterParts, r2TopW + 0.16, 0.16, 0.26, 0, ridgeY + 0.08, 0);
  addBox(wellPlasterParts, r2TopW + 0.06, 0.14, 0.20, 0, ridgeY + 0.22, 0);
  addBox(wellPlasterParts, r2TopW + 0.22, 0.06, 0.28, 0, ridgeY + 0.30, 0);
  for (const sx of [-1, 1]) {
    const kn = createSculptedKimNocGeo(sx, 0.96);
    kn.translate(sx * (r2TopW * 0.5 - 0.04), ridgeY + 0.24, 0);
    wellPlasterParts.push(kn);
  }
  // Hollow Flaming `Mặt Nguyệt` on spreading cloud-scroll pedestal
  addBox(wellPlasterParts, 0.74, 0.18, 0.22, 0, ridgeY + 0.38, 0);
  const moonRing = new THREE.TorusGeometry(0.22, 0.052, 8, 20);
  moonRing.translate(0, ridgeY + 0.68, 0);
  wellPlasterParts.push(moonRing);
  const centerFlame = new THREE.ConeGeometry(0.075, 0.36, 5);
  centerFlame.translate(0, ridgeY + 1.06, 0);
  wellPlasterParts.push(centerFlame);
  for (const fa of [-0.72, -0.36, 0.36, 0.72]) {
    const fl = new THREE.ConeGeometry(0.045, 0.20, 4);
    fl.rotateZ(-fa);
    fl.translate(Math.sin(fa) * 0.31, ridgeY + 0.68 + Math.cos(fa) * 0.31, 0);
    wellPlasterParts.push(fl);
  }

  // Flanking Mottled Ancient Exposed Brick Walls (`KVC-28`) + Rounded Mossy Coping (`KVC-29`) + Barrel-Capped `Bí Văn / Súc Văn` Gates (`KVC-31`, `GTQ-20`)
  const copingProf = new THREE.Shape();
  copingProf.moveTo(-0.34, 0);
  copingProf.lineTo(0.34, 0);
  copingProf.lineTo(0.32, 0.10);
  copingProf.quadraticCurveTo(0, 0.26, -0.32, 0.10);
  copingProf.closePath();

  for (const side of [-1, 1]) {
    const wallLen = 8.8;
    const wallCx = side * (2.94 + wallLen * 0.5);
    addBox(ancientBrickParts, wallLen, 2.20, 0.56, wallCx, courtY + 1.02, 0);
    // Rounded saddle-backed velvety mossy mortar coping
    const copGeo = new THREE.ExtrudeGeometry(copingProf, { depth: wallLen + 0.12, bevelEnabled: false });
    copGeo.rotateY(Math.PI * 0.5);
    copGeo.translate(wallCx - (wallLen + 0.12) * 0.5, courtY + 2.12, 0);
    solidColorParts.push(colorizeGeo(copGeo, '#536234'));

    // Flanking `Bí Văn Môn` (East) & `Súc Văn Môn` (West) Arched Side Gates with Barrel Plaster Cap & Small Tiled Roof + Hanzi Plaque!
    const gateX = side * 12.6;
    const sideArch = createArchedWallGeometry(2.5, 3.0, 0.74, 1.30, 2.28);
    sideArch.translate(gateX, courtY - 0.10, 0);
    wellPlasterParts.push(sideArch);
    // Curved semicircular barrel cap (Ref 71!) + small terracotta eave trim
    const barrelCap = new THREE.CylinderGeometry(0.46, 0.46, 2.68, 12, 1, false, 0, Math.PI);
    barrelCap.rotateZ(Math.PI * 0.5);
    barrelCap.translate(gateX, courtY + 2.90, 0);
    wellPlasterParts.push(barrelCap);
    // Hanzi `"秘 文"` / `"畜 文"` gate plaques on both North & South faces
    const gKey: VanMieuAtlasKey = side > 0 ? 'biVan' : 'sucVan';
    calligraphyAtlasParts.push(makeAtlasPlane(0.86, 0.42, gKey, gateX, courtY + 2.52, 0.39, 0));
    calligraphyAtlasParts.push(makeAtlasPlane(0.86, 0.42, gKey, gateX, courtY + 2.52, -0.39, Math.PI));

    // Twin symmetrical manicured bonsai trees directly in front of North brick wing walls (Ref 01 — `KVC-07`, `GTQ-22`!)
    // + South plinth stoneware bonsai planters (Ref 49!)
    addVietnameseBonsai(wellPlasterParts, ironwoodParts, foliageCardParts, side * 5.2, courtY + 0.04, -1.05, 1.05, 101 + (side > 0 ? 1 : 0));
    addVietnameseBonsai(wellPlasterParts, ironwoodParts, foliageCardParts, side * 2.55, courtY + 0.04, 4.25, 0.92, 105 + (side > 0 ? 1 : 0));
  }

  // =================================================================================================
  // SECTION 3: GIẾNG THIÊN QUANG — SUNKEN LIVE-MIRROR POND, STEPPED-CAP BALUSTRADE & EMERALD CERAMIC TILES
  // (GTQ-01..GTQ-24)
  // =================================================================================================
  const wellCx = 0.0;
  const wellCz = -24.0;
  const wellY = courtY; // 1.45m surrounding promenade level (center basin carved down to 0.18m!)
  const wellHalf = 11.0;
  exclusionCircles.push({ x: wellCx, z: wellCz, r: 15.0 });

  // Paved stone perimeter promenade (`3.95m` wide around the 22m×22m well, bridging cleanly over the 14.8m sunken terrain basin!)
  const walkW = 3.95;
  for (const sz of [-1, 1]) {
    addBox(stoneParts, wellHalf * 2 + walkW * 2, 0.96, walkW, wellCx, wellY - 0.42, wellCz + sz * (wellHalf + walkW * 0.5));
  }
  for (const sx of [-1, 1]) {
    addBox(stoneParts, walkW, 0.96, wellHalf * 2, wellCx + sx * (wellHalf + walkW * 0.5), wellY - 0.42, wellCz);
  }

  // Opaque sunken dark-silt pond liner (`y = wellY - 1.05m`, GTQ-02) + Exposed Weathered Mossy Brick Sub-Waterline Embankment (`GTQ-05`!)
  const liner = new THREE.PlaneGeometry(wellHalf * 2 - 0.2, wellHalf * 2 - 0.2);
  liner.rotateX(-Math.PI * 0.5);
  liner.translate(wellCx, wellY - 1.05, wellCz);
  solidColorParts.push(colorizeGeo(liner, '#1b2810'));

  for (const sz of [-1, 1]) {
    // Lower exposed weathered brick embankment rising from pond bed up to plaster plinth (`wellY - 1.08 .. wellY + 0.16`)
    addBox(ancientBrickParts, wellHalf * 2 + 0.55, 1.24, 0.58, wellCx, wellY - 0.46, wellCz + sz * wellHalf);
    // Upper weathered grey lime-plaster coping plinth (`wellY + 0.16 .. wellY + 0.42`)
    addBox(wellPlasterParts, wellHalf * 2 + 0.64, 0.26, 0.66, wellCx, wellY + 0.29, wellCz + sz * wellHalf);
  }
  for (const sx of [-1, 1]) {
    addBox(ancientBrickParts, 0.58, 1.24, wellHalf * 2 + 0.55, wellCx + sx * wellHalf, wellY - 0.46, wellCz);
    addBox(wellPlasterParts, 0.66, 0.26, wellHalf * 2 + 0.64, wellCx + sx * wellHalf, wellY + 0.29, wellCz);
  }

  // Live Planar Mirror `Reflector` inside Giếng Thiên Quang (`y = wellY - 0.28 = 1.17m`, color `0x4c5f2b` olive-jade — GTQ-03!)
  const wellWaterY = wellY - 0.28;
  const wellWaterGeo = new THREE.PlaneGeometry(wellHalf * 2 - 0.50, wellHalf * 2 - 0.50);
  const useLiveMirror =
    typeof window !== 'undefined' &&
    Boolean(renderer && renderer.domElement && renderer.domElement.width > 0);
  if (useLiveMirror) {
    const wellReflector = new Reflector(wellWaterGeo, {
      clipBias: 0.004,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x4c5f2b
    });
    wellReflector.rotation.x = -Math.PI * 0.5;
    wellReflector.position.set(wellCx, wellWaterY, wellCz);
    wellReflector.name = 'GiengThienQuangMirrorWater';
    group.add(wellReflector);
  } else {
    wellWaterGeo.rotateX(-Math.PI * 0.5);
    wellWaterGeo.translate(wellCx, wellWaterY, wellCz);
    solidColorParts.push(colorizeGeo(wellWaterGeo, '#53662c'));
  }

  // Authentic Non-Clipping Giếng Thiên Quang Balustrade (`GTQ-07..12` — 6 bays/side, 3-tier chamfered stepped-cap posts, recessed plaster frames, pierced emerald ceramic tiles!)
  const wellBalY = wellY + 0.42;
  addGiengThienQuangBalustradeSide(wellPlasterParts, greenCeramicParts, wellCx - wellHalf, wellCz + wellHalf, wellCx + wellHalf, wellCz + wellHalf, wellBalY, 6, false);
  addGiengThienQuangBalustradeSide(wellPlasterParts, greenCeramicParts, wellCx - wellHalf, wellCz - wellHalf, wellCx + wellHalf, wellCz - wellHalf, wellBalY, 6, false);
  addGiengThienQuangBalustradeSide(wellPlasterParts, greenCeramicParts, wellCx - wellHalf, wellCz - wellHalf, wellCx - wellHalf, wellCz + wellHalf, wellBalY, 6, false);
  addGiengThienQuangBalustradeSide(wellPlasterParts, greenCeramicParts, wellCx + wellHalf, wellCz - wellHalf, wellCx + wellHalf, wellCz + wellHalf, wellBalY, 6, true);

  // Ref 71 East Wrought-Iron Water-Access Gate & Submerged Stone Steps (`GTQ-06`)
  for (let gi = -3; gi <= 3; gi++) {
    addCyl(bronzeParts, 0.018, 0.018, 0.84, 5, wellCx + wellHalf, wellBalY + 0.42, wellCz + gi * 0.22);
  }
  addBox(bronzeParts, 0.04, 0.04, 1.48, wellCx + wellHalf, wellBalY + 0.78, wellCz);
  addBox(bronzeParts, 0.04, 0.04, 1.48, wellCx + wellHalf, wellBalY + 0.14, wellCz);
  for (let st = 0; st < 3; st++) {
    addBox(stoneParts, 0.42, 0.18, 1.44, wellCx + wellHalf - 0.35 - st * 0.32, wellY - 0.08 - st * 0.18, wellCz);
  }

  // 4 Sculpted Corner Bonsai Pots (`GTQ-21`) & Lush `Cỏ Mạch Môn` Border Hedges around Giếng Thiên Quang (`GTQ-23`!)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVietnameseBonsai(
        wellPlasterParts,
        ironwoodParts,
        foliageCardParts,
        wellCx + sx * (wellHalf + 1.55),
        wellY + 0.06,
        wellCz + sz * (wellHalf + 1.55),
        0.95,
        201 + (sx > 0 ? 1 : 0) + (sz > 0 ? 2 : 0)
      );
    }
  }
  // Lush dark-emerald `Cỏ Mạch Môn` garden hedge strips lining the outer courtyard perimeter (Ref 71 bottom-left!)
  const hedgeRand = mulberry32(712345);
  const hedgeGreens = ['#193e14', '#26581e', '#356f27', '#448230'];
  const addHedgeStrip = (x0: number, z0: number, x1: number, z1: number, width: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(4, Math.floor(len / 0.85));
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const hx = THREE.MathUtils.lerp(x0, x1, t);
      const hz = THREE.MathUtils.lerp(z0, z1, t);
      const hy = getVietnamHeritageHeight(hx, hz);
      for (let k = 0; k < 3; k++) {
        const card = new THREE.PlaneGeometry(0.72 + hedgeRand() * 0.26, 0.56 + hedgeRand() * 0.20);
        card.rotateX((hedgeRand() - 0.5) * 0.6);
        card.rotateY(hedgeRand() * Math.PI);
        card.translate(
          hx + (hedgeRand() - 0.5) * width * 0.65,
          hy + 0.28 + hedgeRand() * 0.16,
          hz + (hedgeRand() - 0.5) * width * 0.65
        );
        foliageCardParts.push(colorizeGeo(card, hedgeGreens[Math.floor(hedgeRand() * hedgeGreens.length)]));
      }
    }
  };
  for (const s of [-1, 1]) {
    addHedgeStrip(s * 14.5, -13.5, s * 14.5, -34.5, 1.3);
    addHedgeStrip(s * 25.4, -12.5, s * 25.4, -36.5, 1.5);
    addHedgeStrip(s * 4.5, 5.2, s * 12.2, 5.2, 1.2);
  }

  // =================================================================================================
  // SECTION 4: HAI NHÀ BIA TIẾN SĨ, 32 MUSEUM TURTLE STELAE, `VÌ KÈO` RAFTERS, `NGÓI CHIẾU` CEILING & BRICK ENCLOSURE WALLS
  // (BTS-01..BTS-30)
  // =================================================================================================
  for (const side of [-1, 1]) {
    const sx = side * 21.5;
    const sz = -24.0;
    const sy = getVietnamHeritageHeight(sx, sz);
    exclusionCircles.push({ x: sx, z: sz - 5.5, r: 8.5 }, { x: sx, z: sz + 5.5, r: 8.5 });

    // Grounded 22m platform + cut Thanh Hóa limestone curb + pale sun-bleached 33cm Bát Tràng floor (`BTS-24`, `BTS-25`)
    addBox(stoneParts, 6.2, 1.12, 22.2, sx, sy - 0.24, sz);
    addBox(wellPlasterParts, 6.45, 0.14, 22.45, sx, sy + 0.36, sz);
    addBox(batTrangParts, 6.08, 0.08, 22.08, sx, sy + 0.44, sz);

    // 2 wide cut-limestone entry steps facing Giếng Thiên Quang (Ref 71!)
    const stepDir = -side;
    addBox(stoneParts, 0.65, 0.22, 6.4, sx + stepDir * 3.35, sy + 0.12, sz);
    addBox(stoneParts, 0.55, 0.22, 6.4, sx + stepDir * 3.05, sy + 0.28, sz);

    // Low protective dark-ironwood heritage guard railing along outer pavilion perimeter (`BTS-25`)
    for (let r = -9; r <= 9; r += 3) {
      addBox(ironwoodParts, 0.09, 0.58, 0.09, sx + side * 2.88, sy + 0.74, sz + r);
    }
    addBox(ironwoodParts, 0.07, 0.06, 18.6, sx + side * 2.88, sy + 1.00, sz);

    // Thickened warm aged *gỗ lim* columns (`r = 0.19m`, lowered intimate eaves `h = 2.95m`) on 3-part carved *chân tảng* plinths (`BTS-18`, `BTS-22`)
    const colH = 3.05;
    const eaveY = sy + 0.48 + colH;
    for (const ox of [-2.42, 2.42]) {
      for (let rz = 0; rz < 6; rz++) {
        const czCol = sz - 9.6 + rz * 3.84;
        addCyl(ironwoodParts, 0.175, 0.195, colH, 12, sx + ox, sy + 0.48 + colH * 0.5, czCol);
        // 3-part carved stone *chân tảng đá* cushion plinth
        addBox(wellPlasterParts, 0.54, 0.12, 0.54, sx + ox, sy + 0.54, czCol);
        addCyl(wellPlasterParts, 0.22, 0.25, 0.14, 8, sx + ox, sy + 0.66, czCol);
      }
      // Longitudinal eave plate beam (`xà dọc`)
      addBox(ironwoodParts, 0.24, 0.26, 20.6, sx + ox, eaveY - 0.08, sz);
    }

    // Full Northern Vietnamese `Vì Kèo Kẻ Chuyền` Double Tie-Beam & Diagonal Strut Trusses (`BTS-19`, matching Ref 47 top!)
    const ridgePeakY = eaveY + 1.92;
    for (let rz = 0; rz < 6; rz++) {
      const czCol = sz - 9.6 + rz * 3.84;
      // Lower main tie-beam (`quá giang`) + stepped upper collar beam (`câu đầu`) + king/queen struts
      addBox(ironwoodParts, 5.25, 0.24, 0.22, sx, eaveY - 0.14, czCol);
      addBox(ironwoodParts, 3.15, 0.20, 0.18, sx, eaveY + 0.58, czCol);
      addBox(ironwoodParts, 0.18, 0.72, 0.18, sx, eaveY + 1.04, czCol);
      for (const s of [-1, 1]) {
        addBox(ironwoodParts, 0.16, 0.58, 0.16, sx + s * 1.15, eaveY + 0.22, czCol);
        // Sloped diagonal `kẻ chuyền` rafters supporting overhanging eaves
        const diagLen = Math.hypot(3.4, 1.85);
        const diagAng = Math.atan2(1.85, 3.4);
        addBox(ironwoodParts, diagLen, 0.17, 0.16, sx + s * 1.75, eaveY + 0.76, czCol, 0, 0, -s * diagAng);
      }
    }
    // 5 Longitudinal Roof Purlins (`Hoành`) + Closely Spaced Diagonal Wooden Rafters (`Rui`, ~76 per slope! BTS-20)
    for (const [pxOff, pyOff] of [
      [0, 1.82],
      [-1.35, 1.12],
      [1.35, 1.12],
      [-2.65, 0.42],
      [2.65, 0.42]
    ]) {
      addBox(ironwoodParts, 0.16, 0.16, 21.8, sx + pxOff, eaveY + pyOff, sz);
    }
    const ruiSlopeLen = Math.hypot(3.85, 1.98);
    const ruiAng = Math.atan2(1.98, 3.85);
    for (let ri = 0; ri < 34; ri++) {
      const rz = sz - 10.6 + (ri / 33) * 21.2;
      for (const s of [-1, 1]) {
        addBox(ironwoodParts, ruiSlopeLen, 0.075, 0.055, sx + s * 1.92, eaveY + 0.88, rz, 0, 0, -s * ruiAng);
      }
    }

    // Dedicated Inward-Facing Warm Burnt-Terracotta *Ngói Chiếu* Ceiling Soffit (`BTS-21` — ZERO exterior brick grid bleed!)
    for (const s of [-1, 1]) {
      const soff = new THREE.PlaneGeometry(22.2, ruiSlopeLen + 0.15);
      soff.rotateX(Math.PI * 0.5);
      soff.rotateY(Math.PI * 0.5);
      soff.rotateZ(-s * ruiAng);
      soff.translate(sx + s * 1.92, eaveY + 0.94, sz);
      ngoiChieuParts.push(soff);
    }

    // Authentic Knife-Edge Hipped Curved Mossy Terracotta Roof (`topWidth = 0.28m`, deep `8.2m` eaves — BTS-28!)
    const biaRoof = createHueImperialHipRoofGeometry(8.2, 24.0, 0.28, 18.6, 2.04, 0.24, 8, 5, false);
    biaRoof.translate(sx, eaveY - 0.12, sz);
    kvcRoofParts.push(biaRoof);
    // Molded aged-lime ridge beam & dignified subtle end finials (Ref 71)
    addBox(wellPlasterParts, 0.26, 0.22, 18.8, sx, eaveY + 1.94, sz);
    const biaFinials = createRoofFinialSetParts(sx, eaveY + 2.02, sz, 18.2, Math.PI * 0.5, 0.58, false);
    wellPlasterParts.push(...biaFinials.mainParts, ...biaFinials.goldParts);

    // 16 Museum-Grade Carved Stone Turtles & Doctors' Stelae per pavilion (32 total!) seated on raised stone dais (`BTS-01..17`, `BTS-23`)
    const turtleRotY = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    for (const colIdx of [0, 1]) {
      const daisX = sx + (colIdx === 0 ? -1.20 : 1.20);
      addBox(wellPlasterParts, 1.75, 0.10, 18.4, daisX, sy + 0.53, sz);
      for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
        const tz = sz - 8.05 + rowIdx * 2.30;
        addMuseumTurtleStele(
          steleLimestoneParts,
          steleFaceParts,
          carapaceParts,
          polishedHeadParts,
          daisX,
          sy + 0.58,
          tz,
          turtleRotY,
          0.92,
          rowIdx + colIdx * 3
        );
      }
    }

    // Continuous Weathered Antique-Brick Courtyard Enclosure Wall Behind Nhà Bia (`x = ±25.2m`, `BTS-26`, Ref 71!)
    const encX = side * 25.2;
    const encY = getVietnamHeritageHeight(encX, sz);
    addBox(ancientBrickParts, 0.44, 2.45, 36.0, encX, encY + 1.15, -24.0);
    // Brick buttress pilasters every 4.5m + sloped terracotta wall coping
    for (let bz = -40; bz <= -8; bz += 4.5) {
      addBox(ancientBrickParts, 0.62, 2.50, 0.44, encX, encY + 1.18, bz);
    }
    const wallTileCap = createHueImperialHipRoofGeometry(0.95, 36.4, 0.14, 35.8, 0.36, 0.04, 4, 2, false);
    wallTileCap.translate(encX, encY + 2.36, -24.0);
    kvcRoofParts.push(wallTileCap);
  }

  // =================================================================================================
  // SECTION 5: ĐẠI THÀNH MÔN & WALK-IN ĐIỆN ĐẠI THÀNH CONFUCIAN SANCTUARY (DDT-01..DDT-32)
  // =================================================================================================
  const dtmZ = -37.2;
  const dtmY = getVietnamHeritageHeight(0, dtmZ);
  exclusionCircles.push({ x: 0, z: dtmZ, r: 10.5 });

  addBox(stoneParts, 14.8, 1.0, 5.4, 0, dtmY - 0.14, dtmZ);
  addBox(wellPlasterParts, 15.2, 0.14, 5.7, 0, dtmY + 0.38, dtmZ);
  for (const cxCol of [-6.0, -2.15, 2.15, 6.0]) {
    for (const oz of [-1.75, 1.75]) {
      addCyl(kvcCrimsonParts, 0.17, 0.20, 3.65, 10, cxCol, dtmY + 2.25, dtmZ + oz);
      addCyl(wellPlasterParts, 0.28, 0.34, 0.26, 10, cxCol, dtmY + 0.54, dtmZ + oz);
    }
    addBox(kvcCrimsonParts, 0.20, 0.24, 3.9, cxCol, dtmY + 3.96, dtmZ);
  }
  for (const oz of [-1.75, 1.75]) {
    addBox(kvcCrimsonParts, 12.6, 0.28, 0.26, 0, dtmY + 3.98, dtmZ + oz);
  }
  // Dark-crimson timber soffit under Đại Thành Môn roof (`DDT-32`)
  addBox(ironwoodParts, 12.8, 0.12, 4.2, 0, dtmY + 4.06, dtmZ);
  for (const side of [-1, 1]) {
    addBox(wellPlasterParts, 0.42, 3.65, 3.8, side * 6.35, dtmY + 2.26, dtmZ);
    // Articulated open `cửa bức bàn` door leaves (`DDT-32`)
    addBox(kvcCrimsonParts, 1.15, 2.60, 0.10, side * 3.15, dtmY + 1.72, dtmZ + 0.72, side * 0.55);
    addBox(goldParts, 0.85, 0.06, 0.13, side * 3.15, dtmY + 1.65, dtmZ + 0.72, side * 0.55);
    stoneParts.push(...createGuardianBeastParts(side * 3.85, dtmY, dtmZ + 3.55, 0, 0.96, 'nghe'));
  }
  const dtmRoof = createHueImperialHipRoofGeometry(16.4, 7.6, 9.6, 0.32, 2.20, 0.26, 10, 6, false);
  dtmRoof.translate(0, dtmY + 4.02, dtmZ);
  kvcRoofParts.push(dtmRoof);
  const dtmFinials = createRoofFinialSetParts(0, dtmY + 6.24, dtmZ, 9.2, 0, 0.78, true);
  wellPlasterParts.push(...dtmFinials.mainParts, ...dtmFinials.goldParts);
  const dtmPlaque = createSignagePlaqueMesh(
    { text: 'ĐẠI THÀNH MÔN', subText: '大 成 門', width: 2.85, height: 0.78, depth: 0.12, style: 'royal', motifSeed: 121 },
    signageCtx
  );
  dtmPlaque.position.set(0, dtmY + 3.72, dtmZ + 1.92);
  group.add(dtmPlaque);

  // ---- ĐIỆN ĐẠI THÀNH WALK-IN CONFUCIAN SANCTUARY (`(0, -45.8)`, Ref 110 — DDT-01..DDT-32!) ----
  const dtdZ = -45.8;
  const dtdY = getVietnamHeritageHeight(0, dtdZ);
  exclusionCircles.push({ x: 0, z: dtdZ, r: 15.0 });

  addBox(batTrangParts, 19.6, 0.24, 6.4, 0, dtdY - 0.04, -40.8);
  addBox(stoneParts, 21.4, 1.15, 10.6, 0, dtdY - 0.12, dtdZ);
  addBox(wellPlasterParts, 21.8, 0.14, 11.0, 0, dtdY + 0.42, dtdZ);
  addBox(batTrangParts, 20.8, 0.08, 10.0, 0, dtdY + 0.50, dtdZ);

  const dtdFloorY = dtdY + 0.54;
  const dtdColH = 4.18;

  // 12 Deep Glossy Ruby-Lacquer Sanctuary Columns + Carved Stone Lotus Drum Bases (`DDT-29`)
  for (const cxCol of [-8.8, -5.2, -1.95, 1.95, 5.2, 8.8]) {
    for (const oz of [-3.8, 3.8]) {
      addCyl(sanctuaryCrimsonParts, 0.20, 0.23, dtdColH, 12, cxCol, dtdFloorY + dtdColH * 0.5, dtdZ + oz);
      addCyl(wellPlasterParts, 0.30, 0.36, 0.26, 10, cxCol, dtdFloorY + 0.13, dtdZ + oz);
    }
    addBox(sanctuaryCrimsonParts, 0.24, 0.28, 8.2, cxCol, dtdFloorY + dtdColH - 0.18, dtdZ);
  }
  // Longitudinal tie-beams
  for (const oz of [-3.8, 3.8]) {
    addBox(sanctuaryCrimsonParts, 18.2, 0.28, 0.26, 0, dtdFloorY + dtdColH - 0.14, dtdZ + oz);
  }

  // 100% SEALED Rear, Side & Triangular Gable Enclosure Walls (`height = 4.65m` — ZERO sky leaks! DDT-27)
  // Deep shadowed aged *gỗ lim* interior paneling matching Ref 110's dramatic temple chiaroscuro!
  const sealH = dtdColH + 0.48;
  addBox(ironwoodParts, 18.4, sealH, 0.34, 0, dtdFloorY + sealH * 0.5, dtdZ - 4.12);
  addBox(sanctuaryCrimsonParts, 18.0, 0.24, 0.12, 0, dtdFloorY + sealH - 0.28, dtdZ - 3.94);
  for (const side of [-1, 1]) {
    addBox(ironwoodParts, 0.34, sealH, 8.4, side * 9.05, dtdFloorY + sealH * 0.5, dtdZ);
    // Triangular gable seal above side walls
    const gSh = new THREE.Shape();
    gSh.moveTo(-4.3, 0);
    gSh.lineTo(4.3, 0);
    gSh.lineTo(0, 2.85);
    gSh.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gSh, { depth: 0.26, bevelEnabled: false });
    gGeo.rotateY(Math.PI * 0.5);
    gGeo.translate(side * 9.05 - 0.13, dtdFloorY + dtdColH - 0.05, dtdZ);
    ironwoodParts.push(gGeo);

    // Articulated front `cửa bức bàn` wings (leaving central 3.9m bay wide open! DDT-32)
    addBox(sanctuaryCrimsonParts, 5.1, 1.45, 0.16, side * 6.1, dtdFloorY + 0.725, dtdZ + 3.8);
    addBox(sanctuaryCrimsonParts, 5.1, 0.65, 0.20, side * 6.1, dtdFloorY + dtdColH - 0.32, dtdZ + 3.8);
    for (let m = 0; m < 8; m++) {
      addBox(sanctuaryCrimsonParts, 0.08, 2.1, 0.10, side * (3.85 + m * 0.64), dtdFloorY + 2.45, dtdZ + 3.8);
    }
    addBox(sanctuaryCrimsonParts, 1.15, 3.25, 0.12, side * 2.42, dtdFloorY + 1.62, dtdZ + 3.35, side * -0.55);
  }
  // Upper front lintel wall closing central bay above `y = 3.85m`
  addBox(sanctuaryCrimsonParts, 4.1, 0.65, 0.24, 0, dtdFloorY + dtdColH - 0.12, dtdZ + 3.8);

  // Authentic Sealed Interior Ceiling: Stepped Dark-Crimson Coffered Central Bay + Exposed Rafters & *Ngói Chiếu* Side Aisles (`DDT-28`!)
  // Central coffered ceiling (`x ∈ [-2.05, +2.05]`, `y = dtdFloorY + 3.90..4.18`, matching Ref 110 top!)
  addBox(sanctuaryCrimsonParts, 4.30, 0.12, 8.30, 0, dtdFloorY + 4.12, dtdZ);
  for (let czIdx = -2; czIdx <= 2; czIdx++) {
    addBox(sanctuaryCrimsonParts, 4.10, 0.24, 0.20, 0, dtdFloorY + 3.96, dtdZ + czIdx * 1.65);
    addBox(sanctuaryGoldParts, 4.00, 0.04, 0.22, 0, dtdFloorY + 3.83, dtdZ + czIdx * 1.65);
  }
  for (const cxCof of [-1.85, -0.92, 0.92, 1.85]) {
    addBox(sanctuaryCrimsonParts, 0.18, 0.24, 8.10, cxCof, dtdFloorY + 3.96, dtdZ);
  }
  // Side aisle sealed *ngói chiếu* slats + exposed dark-crimson parallel rafters & purlins (0% exterior roof grid bleed!)
  for (const side of [-1, 1]) {
    const ceilPlane = new THREE.PlaneGeometry(7.2, 8.3);
    ceilPlane.rotateX(Math.PI * 0.5);
    ceilPlane.translate(side * 5.55, dtdFloorY + 4.06, dtdZ);
    ngoiChieuParts.push(ceilPlane);
    for (let r = 0; r < 18; r++) {
      const rx = side * (2.25 + (r / 17) * 6.6);
      addBox(sanctuaryCrimsonParts, 0.08, 0.12, 8.1, rx, dtdFloorY + 3.96, dtdZ);
    }
    for (const pz of [-2.4, 0.0, 2.4]) {
      addCyl(sanctuaryCrimsonParts, 0.12, 0.12, 7.2, 8, side * 5.55, dtdFloorY + 3.82, dtdZ + pz, 0, 0, Math.PI * 0.5);
    }
  }

  // ---- HERO CENTERPIECE: OPEN 3-SIDED CARVED `KHÁM THỜ`, BACKLIT GLOW & BESPOKE SCULPTED ĐỨC THÁNH KHỔNG TỬ (DDT-01..DDT-12!) ----
  const khamZ = dtdZ - 2.30;
  // Open 3-sided recessed crimson shrine housing (ZERO solid blocking box! DDT-01)
  addBox(sanctuaryCrimsonParts, 2.56, 2.68, 0.12, 0, dtdFloorY + 2.42, khamZ - 0.90); // rear backboard
  for (const sx of [-1.22, 1.22]) {
    addBox(sanctuaryCrimsonParts, 0.12, 2.68, 1.06, sx, dtdFloorY + 2.42, khamZ - 0.42); // left/right walls
    // Carved gilded front relief pilasters (`DDT-04`)
    addBox(sanctuaryCrimsonParts, 0.18, 2.48, 0.14, sx, dtdFloorY + 2.36, khamZ + 0.14);
    addBox(sanctuaryGoldParts, 0.10, 2.32, 0.17, sx, dtdFloorY + 2.36, khamZ + 0.15);
    // Flared pierced golden scroll cheek-wings (`Tai khám`)
    addBox(sanctuaryGoldParts, 0.22, 0.84, 0.08, sx + Math.sign(sx) * 0.18, dtdFloorY + 3.22, khamZ + 0.12, 0, 0, -Math.sign(sx) * 0.14);
  }
  // Nested inner crimson-gold sub-frame (`Khung khám trong`, DDT-05)
  for (const sx of [-0.78, 0.78]) {
    addBox(sanctuaryCrimsonParts, 0.10, 2.18, 0.10, sx, dtdFloorY + 2.46, khamZ - 0.62);
    addBox(sanctuaryGoldParts, 0.05, 2.12, 0.12, sx, dtdFloorY + 2.46, khamZ - 0.61);
  }
  addBox(sanctuaryGoldParts, 1.72, 0.08, 0.12, 0, dtdFloorY + 3.52, khamZ - 0.61);

  // Warm backlit glowing ivory-gold inner sanctum halo panel directly behind Confucius's shoulders (`DDT-02`, packed in calligraphy atlas!)
  calligraphyAtlasParts.push(makeAtlasPlane(1.42, 1.82, 'sanctumHalo', 0, dtdFloorY + 2.54, khamZ - 0.81, 0));

  // Scalloped Ogee-Arched 24K Golden Dragon Crown (`Diềm khám chạm rồng`, DDT-03!)
  const crownSh = new THREE.Shape();
  crownSh.moveTo(-1.46, 0.0);
  crownSh.lineTo(1.46, 0.0);
  crownSh.lineTo(1.42, 0.36);
  crownSh.quadraticCurveTo(0.88, 0.44, 0.48, 0.48);
  crownSh.quadraticCurveTo(0.0, 0.82, -0.48, 0.48);
  crownSh.quadraticCurveTo(-0.88, 0.44, -1.42, 0.36);
  crownSh.closePath();
  const crownGeo = new THREE.ExtrudeGeometry(crownSh, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2
  });
  crownGeo.translate(0, dtdFloorY + 3.44, khamZ + 0.08);
  sanctuaryGoldParts.push(crownGeo);
  addBox(sanctuaryCrimsonParts, 2.86, 0.14, 0.24, 0, dtdFloorY + 3.46, khamZ + 0.12);
  addBox(sanctuaryGoldParts, 2.94, 0.06, 0.28, 0, dtdFloorY + 3.38, khamZ + 0.14);
  const crownPearl = new THREE.SphereGeometry(0.11, 10, 8);
  crownPearl.translate(0, dtdFloorY + 3.94, khamZ + 0.20);
  sanctuaryGoldParts.push(crownPearl);

  // Pierced golden corner brackets (`Nách chạm lộng`) under central beam above Khám Thờ (`DDT-05`)
  for (const sx of [-1.72, 1.72]) {
    addBox(sanctuaryGoldParts, 0.44, 0.44, 0.12, sx, dtdFloorY + 3.60, khamZ + 0.22);
  }

  // Elevated 2-step crimson-and-gold throne dais inside alcove (`Bệ ngai`, DDT-06)
  addBox(sanctuaryCrimsonParts, 1.50, 0.34, 0.82, 0, dtdFloorY + 1.32, khamZ - 0.36);
  addBox(sanctuaryGoldParts, 1.56, 0.07, 0.88, 0, dtdFloorY + 1.49, khamZ - 0.36);

  // BESPOKE SCULPTED & TEXTURED ĐỨC THÁNH KHỔNG TỬ STATUE (`DDT-07..DDT-12`, Ref 110!)
  const sageY = dtdFloorY + 1.44;
  const sageZ = khamZ - 0.34;
  // Helper to remap geometry UVs into Confucius face or vermilion dragon robe inside `vanMieuCalligraphyMat`!
  const mapConfuciusUv = (g: THREE.BufferGeometry, region: 'face' | 'robe') =>
    remapUvRect(g, VAN_MIEU_ATLAS_UV[region === 'face' ? 'confuciusFace' : 'confuciusRobe'], 0.002);
  // Draped seated lap & broad ceremonial vermilion-and-gold torso (`DDT-11`)
  const lapGeo = new THREE.CylinderGeometry(0.40, 0.48, 0.52, 16);
  lapGeo.scale(1.18, 1.0, 0.86);
  lapGeo.translate(0, sageY + 0.26, sageZ + 0.08);
  confuciusHeroParts.push(mapConfuciusUv(lapGeo, 'robe'));

  const torsoGeo = new THREE.CylinderGeometry(0.32, 0.41, 0.78, 16);
  torsoGeo.scale(1.15, 1.0, 0.78);
  torsoGeo.translate(0, sageY + 0.86, sageZ);
  confuciusHeroParts.push(mapConfuciusUv(torsoGeo, 'robe'));
  // Front flat/curved chest medallion showcase plate so `Bổ Tử` 24K golden dragon shines clearly straight toward camera!
  const chestPlate = new THREE.PlaneGeometry(0.56, 0.62);
  chestPlate.translate(0, sageY + 0.84, sageZ + 0.295);
  confuciusHeroParts.push(mapConfuciusUv(chestPlate, 'robe'));

  // Broad sloping draped shoulders & clasped sleeves (`ống tay rộng`, DDT-12)
  for (const sx of [-1, 1]) {
    const shd = new THREE.SphereGeometry(0.19, 10, 8);
    shd.scale(1.0, 0.95, 0.85);
    shd.translate(sx * 0.38, sageY + 1.12, sageZ + 0.02);
    confuciusHeroParts.push(mapConfuciusUv(shd, 'robe'));
    const arm = new THREE.CylinderGeometry(0.11, 0.14, 0.44, 10);
    arm.rotateZ(sx * 1.08);
    arm.translate(sx * 0.26, sageY + 0.86, sageZ + 0.24);
    confuciusHeroParts.push(mapConfuciusUv(arm, 'robe'));
  }
  // Clasped ivory-gilt scholar hands & golden ceremonial `Hốt` tablet (`DDT-12`)
  const hands = new THREE.SphereGeometry(0.11, 10, 8);
  hands.scale(1.55, 0.80, 0.85);
  hands.translate(0, sageY + 0.84, sageZ + 0.34);
  solidColorParts.push(colorizeGeo(hands, '#edd09e'));
  addBox(sanctuaryGoldParts, 0.08, 0.30, 0.025, 0, sageY + 0.94, sageZ + 0.40, 0, -0.22);

  // Serene painted ivory-gilt head (`Diện tượng`, DDT-08) + elongated scholar ears
  const headGeo = new THREE.SphereGeometry(0.20, 18, 14);
  headGeo.scale(0.92, 1.14, 0.94);
  headGeo.rotateY(-Math.PI * 0.5); // aligns u=0.5 (painted eyes/brows/mouth) straight toward +Z camera!
  headGeo.translate(0, sageY + 1.44, sageZ + 0.05);
  confuciusHeroParts.push(mapConfuciusUv(headGeo, 'face'));
  for (const sx of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.045, 6, 5);
    ear.scale(0.55, 1.65, 0.8);
    ear.translate(sx * 0.19, sageY + 1.43, sageZ + 0.04);
    solidColorParts.push(colorizeGeo(ear, '#e6be82'));
  }
  // Long dark scholarly beard & drooping mustache (`Râu dài`, DDT-09)
  const beard = new THREE.ConeGeometry(0.055, 0.28, 8);
  beard.rotateX(Math.PI + 0.12);
  beard.scale(1.0, 1.0, 0.55);
  beard.translate(0, sageY + 1.16, sageZ + 0.21);
  solidColorParts.push(colorizeGeo(beard, '#241e1b'));
  for (const sx of [-1, 1]) {
    const must = new THREE.BoxGeometry(0.09, 0.022, 0.025);
    must.rotateZ(-sx * 0.28);
    must.translate(sx * 0.055, sageY + 1.32, sageZ + 0.23);
    solidColorParts.push(colorizeGeo(must, '#241e1b'));
  }
  // Ornate square imperial ceremonial crown (`Miện / Mũ Bình Thiên`, DDT-10)
  addBox(sanctuaryCrimsonParts, 0.34, 0.24, 0.30, 0, sageY + 1.70, sageZ + 0.04);
  addBox(sanctuaryGoldParts, 0.36, 0.14, 0.32, 0, sageY + 1.68, sageZ + 0.05);
  addBox(sanctuaryGoldParts, 0.42, 0.05, 0.36, 0, sageY + 1.83, sageZ + 0.04);
  for (const sx of [-1, 1]) {
    addBox(sanctuaryGoldParts, 0.14, 0.04, 0.04, sx * 0.24, sageY + 1.68, sageZ + 0.04);
  }

  // ---- 2-TIER CARVED `HƯƠNG ÁN` ALTAR, UNDER-ALTAR `CHỮ THỌ` CAULDRON & FOREGROUND `BÀN LỄ` (DDT-13..DDT-18!) ----
  const haZ = khamZ + 0.78;
  // Glossy vermilion tabletop + rear raised `Bàn cấp` tier (`DDT-13`)
  addBox(sanctuaryCrimsonParts, 3.16, 0.12, 1.24, 0, dtdFloorY + 1.02, haZ);
  addBox(sanctuaryGoldParts, 3.22, 0.04, 1.28, 0, dtdFloorY + 0.96, haZ);
  addBox(sanctuaryCrimsonParts, 2.94, 0.22, 0.56, 0, dtdFloorY + 1.18, khamZ + 0.36);
  addBox(sanctuaryGoldParts, 3.00, 0.05, 0.60, 0, dtdFloorY + 1.29, khamZ + 0.36);
  // Multi-band carved `Cổ án` + `Ô huỳnh` + carved gilded `Dạ án` apron leaving an OPEN ARCHWAY underneath (`DDT-14`!)
  addBox(sanctuaryGoldParts, 3.02, 0.13, 0.08, 0, dtdFloorY + 0.88, haZ + 0.56);
  addBox(sanctuaryCrimsonParts, 3.04, 0.22, 0.10, 0, dtdFloorY + 0.72, haZ + 0.55);
  for (const sx of [-0.82, 0.82]) {
    addBox(sanctuaryGoldParts, 0.96, 0.12, 0.12, sx, dtdFloorY + 0.72, haZ + 0.56);
  }
  addBox(sanctuaryGoldParts, 2.92, 0.22, 0.10, 0, dtdFloorY + 0.52, haZ + 0.54);
  // 4 stout carved crimson-and-gold corner legs (`Chân quỳ`)
  for (const sx of [-1.42, 1.42]) {
    for (const sz of [-0.50, 0.50]) {
      addBox(sanctuaryCrimsonParts, 0.16, 0.98, 0.16, sx, dtdFloorY + 0.49, haZ + sz);
      addBox(sanctuaryGoldParts, 0.18, 0.10, 0.18, sx, dtdFloorY + 0.12, haZ + sz);
    }
  }

  // Patinated dark-bronze globular incense cauldron (`Lư đồng nắp chạm chữ Thọ`) nestled UNDER the open `Hương Án` arch (`DDT-15`!)
  const underCaul = new THREE.SphereGeometry(0.36, 16, 12);
  underCaul.scale(1.12, 0.76, 1.05);
  underCaul.translate(0, dtdFloorY + 0.32, haZ + 0.25);
  bronzeParts.push(underCaul);
  const underLid = new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
  underLid.translate(0, dtdFloorY + 0.44, haZ + 0.25);
  bronzeParts.push(underLid);
  for (const sx of [-1, 1]) {
    const ear = new THREE.TorusGeometry(0.12, 0.032, 6, 12);
    ear.translate(sx * 0.44, dtdFloorY + 0.36, haZ + 0.25);
    bronzeParts.push(ear);
  }

  // Foreground Dark-Crimson Lacquered Offering Table (`Bàn Lễ`, Ref 110 bottom third — `DDT-16`!)
  const blZ = khamZ + 2.20;
  addBox(sanctuaryCrimsonParts, 2.68, 0.10, 1.06, 0, dtdFloorY + 0.84, blZ);
  addBox(sanctuaryGoldParts, 2.64, 0.08, 0.08, 0, dtdFloorY + 0.74, blZ + 0.48);
  for (const sx of [-1.31, 1.31]) {
    addBox(sanctuaryCrimsonParts, 0.06, 0.065, 1.06, sx, dtdFloorY + 0.91, blZ);
  }
  for (const sx of [-1.22, 1.22]) {
    for (const sz of [-0.44, 0.44]) {
      addBox(sanctuaryCrimsonParts, 0.12, 0.80, 0.12, sx, dtdFloorY + 0.40, blZ + sz);
    }
  }
  // Black lacquered donation tray (`Khay công đức`) with ceremonial notes (`DDT-17`)
  addBox(solidColorParts.length >= 0 ? [] : [], 0, 0, 0, 0, 0, 0); // noop helper check
  const trayBase = new THREE.BoxGeometry(0.76, 0.035, 0.48);
  trayBase.translate(0, dtdFloorY + 0.905, blZ + 0.14);
  solidColorParts.push(colorizeGeo(trayBase, '#181615'));
  for (const sx of [-0.37, 0.37]) {
    const tRail = new THREE.CylinderGeometry(0.022, 0.022, 0.48, 6);
    tRail.rotateX(Math.PI * 0.5);
    tRail.translate(sx, dtdFloorY + 0.935, blZ + 0.14);
    solidColorParts.push(colorizeGeo(tRail, '#22201e'));
  }
  const noteColors = ['#9c7c62', '#8f7282', '#6f828e', '#9a8c66'];
  for (let ni = 0; ni < 10; ni++) {
    const note = new THREE.BoxGeometry(0.10, 0.004, 0.05);
    note.rotateY((ni - 4.5) * 0.38);
    note.translate((ni % 3 - 1) * 0.15, dtdFloorY + 0.926 + ni * 0.002, blZ + 0.14 + (Math.floor(ni / 3) - 1.2) * 0.08);
    solidColorParts.push(colorizeGeo(note, noteColors[ni % noteColors.length]));
  }
  // Pastel-lavender porcelain plate + sculpted yellow-lime Buddha's Hand fruit (`Quả Phật thủ`, DDT-18)
  const plate = new THREE.CylinderGeometry(0.21, 0.15, 0.028, 16);
  plate.translate(0.86, dtdFloorY + 0.904, blZ + 0.16);
  solidColorParts.push(colorizeGeo(plate, '#b8b4e0'));
  const phatThu = new THREE.SphereGeometry(0.09, 10, 8);
  phatThu.scale(1.45, 0.72, 0.85);
  phatThu.translate(0.86, dtdFloorY + 0.96, blZ + 0.16);
  solidColorParts.push(colorizeGeo(phatThu, '#b8c424'));
  for (let fi = -2; fi <= 2; fi++) {
    const finger = new THREE.ConeGeometry(0.022, 0.11, 5);
    finger.rotateZ(-Math.PI * 0.48 + fi * 0.10);
    finger.translate(0.98, dtdFloorY + 0.955, blZ + 0.16 + fi * 0.024);
    solidColorParts.push(colorizeGeo(finger, '#ccd42a'));
  }

  // ---- AUTHENTIC ALTAR RITUAL ARTIFACTS: SQUARE `ĐỈNH ĐỒNG`, CANDLESTICKS, 4 BÁT TRÀNG VASES + FLOWERS, `避/肅`, `CÂU ĐỐI` (DDT-19..26!) ----
  const censerY = dtdFloorY + 1.08;
  const censerZ = haZ + 0.14;
  // Square archaic bronze `Đỉnh Đồng Phương Đỉnh` (`DDT-19`)
  addBox(bronzeParts, 0.44, 0.12, 0.34, 0, censerY + 0.06, censerZ);
  addBox(bronzeParts, 0.38, 0.36, 0.28, 0, censerY + 0.34, censerZ);
  addBox(bronzeParts, 0.44, 0.06, 0.34, 0, censerY + 0.54, censerZ);
  // Twin soaring upturned dragon-ear handles (`tai rồng vươn cao`!)
  for (const sx of [-1, 1]) {
    const earCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.20, censerY + 0.32, censerZ),
      new THREE.Vector3(sx * 0.30, censerY + 0.58, censerZ),
      new THREE.Vector3(sx * 0.34, censerY + 0.82, censerZ),
      new THREE.Vector3(sx * 0.26, censerY + 0.92, censerZ)
    ]);
    bronzeParts.push(createSmoothTaperedTubeGeometry(earCurve, 9, 6, () => 0.032));
  }
  // Sculpted golden-bronze Nghê finial + `"VĂN TUYÊN VƯƠNG KHỔNG TỬ"` front nameplate + glowing incense sticks!
  const ngheOrb = new THREE.SphereGeometry(0.085, 8, 6);
  ngheOrb.scale(1.25, 0.95, 0.9);
  ngheOrb.translate(0, censerY + 0.65, censerZ);
  sanctuaryGoldParts.push(ngheOrb);
  calligraphyAtlasParts.push(makeAtlasPlane(0.32, 0.12, 'censerTag', 0, censerY + 0.14, censerZ + 0.18, 0));
  for (const ix of [-0.04, 0, 0.04]) {
    const stick = new THREE.CylinderGeometry(0.004, 0.004, 0.34, 4);
    stick.translate(ix, censerY + 0.72, censerZ + 0.04);
    solidColorParts.push(colorizeGeo(stick, '#a62618'));
  }
  incenseSources.push({ x: 0, y: censerY + 0.92, z: censerZ, scale: 0.36 });

  // Twin Tall Crimson-and-Gold Lacquered Candlesticks (`Chân nến`, DDT-20)
  const candProf = [
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.12, 0.08),
    new THREE.Vector2(0.045, 0.16),
    new THREE.Vector2(0.068, 0.34),
    new THREE.Vector2(0.040, 0.50),
    new THREE.Vector2(0.155, 0.56),
    new THREE.Vector2(0.160, 0.60),
    new THREE.Vector2(0.052, 0.60)
  ];
  for (const sx of [-0.90, 0.90]) {
    const cs = new THREE.LatheGeometry(candProf, 12);
    cs.translate(sx, censerY, haZ + 0.18);
    sanctuaryCrimsonParts.push(cs);
    addCyl(sanctuaryCrimsonParts, 0.042, 0.046, 0.32, 10, sx, censerY + 0.76, haZ + 0.18);
    addCyl(sanctuaryGoldParts, 0.048, 0.048, 0.04, 10, sx, censerY + 0.76, haZ + 0.18);
    const fl = new THREE.ConeGeometry(0.018, 0.065, 5);
    fl.translate(sx, censerY + 0.95, haZ + 0.18);
    solidColorParts.push(colorizeGeo(fl, '#ffd858'));
  }

  // 4 Bát Tràng Cobalt Blue-and-White Porcelain Vases + Sculpted Pink Lilies, Yellow Chrysanthemums & White Lilies (`DDT-21`, `DDT-22`!)
  addPorcelainVaseWithFlowers(calligraphyAtlasParts, solidColorParts, -0.96, dtdFloorY + 0.89, blZ - 0.18, 1.0, 'pink_lily', 801);
  addPorcelainVaseWithFlowers(calligraphyAtlasParts, solidColorParts, 0.96, dtdFloorY + 0.89, blZ - 0.18, 1.0, 'yellow_chrysanthemum', 802);
  addPorcelainVaseWithFlowers(calligraphyAtlasParts, solidColorParts, -0.66, censerY, haZ - 0.08, 0.88, 'white_lily', 803);
  addPorcelainVaseWithFlowers(calligraphyAtlasParts, solidColorParts, 0.66, censerY, haZ - 0.08, 0.88, 'white_lily', 804);

  // Twin Glowing Amber-Gold Lotus Altar Lamps behind rear vases (`Đèn thờ`, DDT-23) + Twin Miniature Oil Lamps
  for (const sx of [-0.46, 0.46]) {
    const lamp = new THREE.SphereGeometry(0.11, 10, 8);
    lamp.scale(0.85, 1.25, 0.85);
    lamp.translate(sx, censerY + 0.24, haZ - 0.10);
    solidColorParts.push(colorizeGeo(lamp, '#ffbc42'));
    addCyl(sanctuaryGoldParts, 0.07, 0.09, 0.10, 8, sx, censerY + 0.05, haZ - 0.10);
    // Miniature porcelain oil lamp flanking front corners of square censer
    addCyl(wellPlasterParts, 0.045, 0.055, 0.16, 8, sx * 0.72, censerY + 0.08, haZ + 0.34);
  }

  // Flanking Gilded `避` (`Hồi Tỵ`) & `肅` (`Túc Tĩnh`) Ceremonial Halberd/Placard Racks (`DDT-24`)
  // + Hanging Vermilion-Gold `Câu Đối` Boards (`DDT-25`) + Resculpted `Hạc Chầu Quy` (`DDT-26`)
  for (const [side, placardKey, cdKey] of [
    [-1, 'hoiTy', 'cauDoiDdt1'],
    [1, 'tucTinh', 'cauDoiDdt2']
  ] as Array<[-1 | 1, VanMieuAtlasKey, VanMieuAtlasKey]>) {
    const rx = side * 1.66;
    const rz = haZ + 0.14;
    addBox(sanctuaryCrimsonParts, 0.24, 0.92, 0.72, rx, dtdFloorY + 0.46, rz);
    for (const pz of [-0.22, -0.07, 0.08, 0.22]) {
      addCyl(sanctuaryCrimsonParts, 0.022, 0.026, 2.28, 6, rx, dtdFloorY + 1.24, rz + pz);
      addCyl(sanctuaryGoldParts, 0.036, 0.026, 0.22, 6, rx, dtdFloorY + 2.45, rz + pz);
    }
    // Prominent eye-level carved crimson-gold `"避"` / `"肅"` placard framing the altar!
    addBox(sanctuaryGoldParts, 0.46, 0.50, 0.08, rx, dtdFloorY + 2.24, rz + 0.30);
    calligraphyAtlasParts.push(makeAtlasPlane(0.38, 0.42, placardKey, rx, dtdFloorY + 2.24, rz + 0.35, 0));

    // Hanging vertical `Câu Đối` couplets directly flanking `Khám Thờ` (`x = ±1.56`, `DDT-25`!)
    addBox(sanctuaryGoldParts, 0.32, 2.28, 0.07, side * 1.56, dtdFloorY + 2.24, khamZ + 0.22);
    calligraphyAtlasParts.push(makeAtlasPlane(0.28, 2.22, cdKey, side * 1.56, dtdFloorY + 2.24, khamZ + 0.265, 0));

    // Resculpted Bronze Cranes on Tortoises (`Hạc Chầu Quy`, DDT-26)
    addSculptedBronzeCraneOnTortoise(bronzeParts, side * 2.42, dtdFloorY, haZ + 0.45, side > 0 ? -0.32 : 0.32, 1.04);

    // Flanking `Tứ Phối` Side Sage Altars (`x = ±5.6`, DDT-26)
    addBox(sanctuaryCrimsonParts, 2.45, 0.98, 1.05, side * 5.6, dtdFloorY + 0.49, khamZ + 0.22);
    addBox(sanctuaryGoldParts, 2.54, 0.10, 1.12, side * 5.6, dtdFloorY + 1.00, khamZ + 0.22);
    addBox(sanctuaryCrimsonParts, 0.62, 0.96, 0.14, side * 5.6, dtdFloorY + 1.54, khamZ + 0.04);
    addBox(sanctuaryGoldParts, 0.68, 1.02, 0.10, side * 5.6, dtdFloorY + 1.54, khamZ + 0.02);
  }

  // Single Carved Gilded `Cửa Võng` (deleting duplicate flat box! DDT-31) + Interior Tilted `"表 師 世 萬"` Hoành Phi!
  sanctuaryGoldParts.push(
    ...createCuaVongParts(0, dtdFloorY + 3.55, dtdZ + 1.65, 3.7, 0.86, 0, 'long_phung'),
    ...createBasReliefPanelParts(-5.6, dtdFloorY + 2.15, dtdZ + 3.65, 2.2, 0.95, 0, 'tu_quy'),
    ...createBasReliefPanelParts(5.6, dtdFloorY + 2.15, dtdZ + 3.65, 2.2, 0.95, 0, 'tu_quy')
  );
  // Interior tilted royal `"表 師 世 萬"` Hoành Phi hanging high before the altar (`DDT-31`)
  addBox(sanctuaryGoldParts, 2.56, 0.78, 0.10, 0, dtdFloorY + 3.48, dtdZ + 0.72, 0, 0.22);
  calligraphyAtlasParts.push(makeAtlasPlane(2.44, 0.68, 'vanThe', 0, dtdFloorY + 3.46, dtdZ + 0.79, 0, 0.22));

  // Sweeping Curved Mossy Terracotta Roof over Điện Đại Thành + Exterior `"萬 世 師 表"` Plaque
  const dtdRoof = createHueImperialHipRoofGeometry(23.2, 12.6, 15.6, 0.34, 2.85, 0.28, 10, 5, false);
  dtdRoof.translate(0, dtdFloorY + dtdColH, dtdZ);
  kvcRoofParts.push(dtdRoof);
  addBox(wellPlasterParts, 15.8, 0.28, 0.30, 0, dtdFloorY + dtdColH + 2.90, dtdZ);
  const dtdFinials = createRoofFinialSetParts(0, dtdFloorY + dtdColH + 2.96, dtdZ, 15.2, 0, 0.92, true);
  wellPlasterParts.push(...dtdFinials.mainParts, ...dtdFinials.goldParts);
  addBox(sanctuaryGoldParts, 3.15, 0.84, 0.12, 0, dtdFloorY + 3.68, dtdZ + 3.92);
  calligraphyAtlasParts.push(makeAtlasPlane(3.02, 0.74, 'vanThe', 0, dtdFloorY + 3.68, dtdZ + 3.99, 0));

  // Dedicated Warm Intimate Sanctuary Lighting Rig inside Điện Đại Thành (`DDT-30` — zero bloom washout!)
  const confuciusLight = new THREE.PointLight('#ffd27c', 5.6, 11.0, 1.65);
  confuciusLight.position.set(0, dtdFloorY + 3.25, khamZ + 1.55);
  const leftAltarLampLight = new THREE.PointLight('#ffaa38', 3.4, 6.0, 1.75);
  leftAltarLampLight.position.set(-0.62, censerY + 0.55, haZ + 0.15);
  const rightAltarLampLight = new THREE.PointLight('#ffaa38', 3.4, 6.0, 1.75);
  rightAltarLampLight.position.set(0.62, censerY + 0.55, haZ + 0.15);
  group.add(confuciusLight, leftAltarLampLight, rightAltarLampLight);

  // =================================================================================================
  // SECTION 6: ANCIENT HANOI `MUỖM / SẤU / BANYAN` CANOPY SCREENING RING (26 TREES — GTQ-16..18, BTS-27, KVC-32!)
  // Completely screens modern distant landmarks behind Khuê Văn Các (Ref 01 & Ref 71) & empty grass behind Nhà Bia!
  // =================================================================================================
  const treeSpecs: Array<[number, number, number, number, number]> = [
    // South screening curtain right behind Khuê Văn Các brick wing walls (clear of oblique Ref 49 camera!)
    [-11.4, 8.6, 13.5, 5.2, 901],
    [11.4, 8.6, 13.8, 5.2, 902],
    [-16.2, 6.5, 15.2, 5.4, 903],
    [16.2, 6.5, 15.0, 5.4, 904],
    [-21.0, 8.5, 14.8, 5.0, 905],
    [21.0, 8.5, 14.5, 5.0, 906],
    [-11.5, 16.5, 16.0, 5.4, 907],
    [11.5, 16.5, 15.8, 5.4, 908],
    [-19.5, 18.0, 16.5, 5.4, 909],
    [19.5, 18.0, 16.5, 5.4, 910],
    [-13.5, 29.0, 15.0, 5.2, 911],
    [13.5, 29.0, 15.2, 5.2, 912],
    [-20.0, 32.0, 16.0, 5.2, 913],
    [20.0, 32.0, 16.0, 5.2, 914],
    // East & West lush canopy wall rising behind both Nhà Bia Tiến Sĩ & antique brick enclosure walls (Ref 47 & Ref 71!)
    [-23.5, -12.0, 13.8, 3.8, 915],
    [23.5, -12.0, 14.0, 3.8, 916],
    [-23.8, -22.0, 14.5, 4.0, 917],
    [23.8, -22.0, 14.4, 4.0, 918],
    [-23.5, -32.0, 14.0, 3.8, 919],
    [23.5, -32.0, 13.8, 3.8, 920],
    [-23.2, -40.0, 13.5, 3.8, 921],
    [23.2, -40.0, 13.6, 3.8, 922],
    // North framing trees behind Đại Thành Môn / Điện Đại Thành
    [-16.5, -43.5, 13.5, 4.0, 923],
    [16.5, -43.5, 13.5, 4.0, 924],
    [-21.0, -46.8, 13.8, 3.8, 925],
    [21.0, -46.8, 13.8, 3.8, 926]
  ];
  for (const [tx, tz, th, tr, sd] of treeSpecs) {
    const ty = getVietnamHeritageHeight(tx, tz);
    addAncientHanoiTree(ironwoodParts, foliageCardParts, tx, ty - 0.15, tz, th, tr, sd);
  }

  // =================================================================================================
  // SECTION 7: VĂN MIẾU MÔN CEREMONIAL GATE PILLARS (*Tứ Trụ* at z = 62.5) & FESTIVAL BANNERS
  // =================================================================================================
  const vmmZ = 62.5;
  const vmmY = getVietnamHeritageHeight(0, vmmZ);
  exclusionCircles.push({ x: 0, z: vmmZ, r: 10.5 });

  for (const side of [-1, 1]) {
    const inX = side * 4.6;
    addBox(stoneParts, 1.55, 0.72, 1.55, inX, vmmY + 0.24, vmmZ);
    addBox(wellPlasterParts, 1.06, 5.4, 1.06, inX, vmmY + 3.25, vmmZ);
    addBox(wellPlasterParts, 1.38, 0.36, 1.38, inX, vmmY + 6.08, vmmZ);
    wellPlasterParts.push(...createPhoenixFinialParts(inX, vmmY + 6.26, vmmZ, 0, 0.76, 'quad_pillar'));
    wellPlasterParts.push(
      ...createAncientStoneLanternParts(side * 6.8, vmmY, vmmZ - 2.4, 0.92),
      ...createAncientStoneLanternParts(side * 6.8, dtdY, dtdZ + 5.8, 0.92)
    );
    const outX = side * 9.2;
    addBox(stoneParts, 1.32, 0.62, 1.32, outX, vmmY + 0.20, vmmZ);
    addBox(wellPlasterParts, 0.88, 4.1, 0.88, outX, vmmY + 2.50, vmmZ);
    addBox(wellPlasterParts, 1.18, 0.30, 1.18, outX, vmmY + 4.66, vmmZ);
    stoneParts.push(...createGuardianBeastParts(outX, vmmY + 4.82, vmmZ, side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0.64, 'nghe'));

    const wallMidX = side * 6.9;
    addBox(wellPlasterParts, 3.8, 2.35, 0.44, wallMidX, vmmY + 1.18, vmmZ);
    stoneParts.push(
      ...createPiercedBalustradeParts(
        side < 0 ? outX + 0.48 : inX + 0.56,
        vmmZ,
        side < 0 ? inX - 0.56 : outX - 0.48,
        vmmZ,
        vmmY + 2.36,
        0.68,
        'chu_van'
      )
    );
    const wingRoof = createVietnameseCurvedRoofGeometry(4.4, 1.45, 3.2, 0.25, 0.75, 0.22);
    wingRoof.translate(wallMidX, vmmY + 3.04, vmmZ);
    kvcRoofParts.push(wingRoof);

    const pillarPlaque = createSignagePlaqueMesh(
      {
        text: side < 0 ? 'VĂN MIẾU' : 'QUỐC TỬ',
        subText: side < 0 ? 'MÔN' : 'GIÁM',
        width: 0.52,
        height: 2.35,
        depth: 0.09,
        style: 'royal',
        motifSeed: 130 + (side > 0 ? 1 : 0)
      },
      signageCtx
    );
    pillarPlaque.position.set(inX, vmmY + 3.35, vmmZ - 0.58);
    pillarPlaque.rotation.y = Math.PI;
    group.add(pillarPlaque);
  }

  // Courtyard Silk Lanterns strictly along south spawn promenade (`z >= 28` — zero blocking of Khuê Văn Các brick walls!)
  const lanternSilkParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  for (const lp of lanternPositions) {
    addCyl(kvcCrimsonParts, 0.045, 0.055, 1.72, 8, lp.x, lp.y + 0.85, lp.z);
    const armDir = lp.x < 0 ? 1 : -1;
    addBox(kvcCrimsonParts, 0.68, 0.06, 0.06, lp.x + armDir * 0.28, lp.y + 1.68, lp.z);
    const lx = lp.x + armDir * 0.58;
    const ly = lp.y + 1.32;
    const silk = createRibbedLanternShellGeometry(0.24, 0.58, 12, 8);
    silk.translate(lx, ly, lp.z);
    lanternSilkParts.push(silk);
    const cap = createLanternCapGeometry(0.24, 0.58);
    cap.translate(lx, ly, lp.z);
    goldParts.push(cap);
    const core = createLanternCoreGeometry(0.24, 0.58);
    core.translate(lx, ly, lp.z);
    lanternCoreParts.push(core);
  }

  // Waving Silk Ceremonial Festival Banners wider at `x = ±11.8m` (`GTQ-29` — graceful framing of spawn vista!)
  const plazaFlagHandle = sharedShaders
    ? sharedShaders.getWavingFlag({ waveScale: 0.72, color: '#d41b1e', showStar: true })
    : createWavingSilkFlagMaterial({ waveScale: 0.72, color: '#d41b1e', showStar: true });
  if (!sharedShaders) {
    extraMaterials.push(plazaFlagHandle.material);
    extraAnimatedUniforms.push(plazaFlagHandle.uniforms);
  }
  for (const [bannerX, bz] of [
    [11.8, 41.6],
    [11.2, 30.0]
  ] as const) {
    for (const side of [-1, 1]) {
      const bx = side * bannerX;
      const by = getVietnamHeritageHeight(bx, bz);
      addCyl(kvcCrimsonParts, 0.05, 0.065, 5.2, 8, bx, by + 2.6, bz);
      const spear = new THREE.ConeGeometry(0.10, 0.34, 6);
      spear.translate(bx, by + 5.34, bz);
      goldParts.push(spear);
      const bannerGeo = new THREE.PlaneGeometry(1.65, 1.08, 14, 8);
      bannerGeo.translate(0.88, 0, 0);
      const bannerMesh = new THREE.Mesh(bannerGeo, plazaFlagHandle.material);
      bannerMesh.position.set(bx, by + 4.55, bz);
      bannerMesh.rotation.y = side < 0 ? 0.15 : Math.PI - 0.15;
      group.add(bannerMesh);
    }
  }

  // =================================================================================================
  // SECTION 8: CLEAN BATCHED MERGE & SHADOW BUDGET HYGIENE
  // =================================================================================================
  const addMerged = (
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
    worldUvScale?: number
  ) => {
    if (parts.length === 0) return;
    let geo = mergeNormalized(parts);
    if (worldUvScale) geo = applyWorldBoxUV(geo, worldUvScale);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    group.add(mesh);
  };

  // Pack all 5 high-relief geometry buckets into ONE `vanMieuReliefAtlasMat` (2048×2048 albedo + Sobel normal!)
  const reliefAtlasParts: THREE.BufferGeometry[] = [
    ...kvcPierReliefParts.map((g) => remapReliefUv(g, 'kvcPierRelief')),
    ...kvcFriezeParts.map((g) => remapReliefUv(g, 'kvcCarvedFrieze')),
    ...ngoiChieuParts.map((g) => remapReliefUv(g, 'ngoiChieu')),
    ...steleFaceParts.map((g) => remapReliefUv(g, 'doctorsStele')),
    ...carapaceParts.map((g) => remapReliefUv(g, 'tortoiseCarapace'))
  ];
  // Pack Confucius hero geometry directly into `vanMieuCalligraphyMat` (fog: false, warm temple glow!)
  calligraphyAtlasParts.push(...confuciusHeroParts);
  // Pack dark rubbed glossy tortoise crown into vertex-colored `solidColorParts` (0 extra materials!)
  for (const ch of polishedHeadParts) {
    solidColorParts.push(colorizeGeo(ch, '#282c30'));
  }

  addMerged(stoneParts, stoneMat, true, true, 2.0);
  addMerged(wellPlasterParts, wellPlasterMat, true, true, 2.2);
  addMerged(kvcCrimsonParts, vm.kvcWeatheredCrimsonMat, true, true, 1.8);
  addMerged(kvcRoofParts, vm.kvcAgedTerracottaMat, true, true);
  addMerged(ancientBrickParts, ancientBrickMat, true, true, 2.2);
  addMerged(ironwoodParts, ironwoodMat, true, true, 2.4);
  addMerged(batTrangParts, batTrangMat, false, true, 1.35);
  addMerged(greenCeramicParts, jadeCeramicMat, false, true);
  addMerged(steleLimestoneParts, steleLimestoneMat, false, true, 2.6);
  addMerged(reliefAtlasParts, vm.vanMieuReliefAtlasMat, false, true);
  addMerged(sanctuaryCrimsonParts, vm.sanctuaryCrimsonLacquerMat, false, true, 1.8);
  addMerged(sanctuaryGoldParts, vm.sanctuaryCarvedGoldMat, false, false, 1.2);
  addMerged(calligraphyAtlasParts, vm.vanMieuCalligraphyMat, false, true);
  addMerged(bronzeParts, bronzeMat, false, true);
  addMerged(goldParts, goldMat, false, false);

  // Vertex-colored solid props (matches canonical roughness: 0.78, DoubleSide so MaterialLibrary deduplicates it!)
  if (solidColorParts.length > 0) {
    const solidMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      side: THREE.DoubleSide
    });
    extraMaterials.push(solidMat);
    addMerged(solidColorParts, solidMat, false, true);
  }

  // Alpha-tested leaf-atlas ancient Hanoi trees, bonsai & `cỏ mạch môn` hedges (matches canonical leafAtlas material!)
  if (foliageCardParts.length > 0) {
    const folMat = new THREE.MeshStandardMaterial({
      map: leafAtlas,
      alphaTest: 0.42,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    extraMaterials.push(folMat);
    addMerged(foliageCardParts, folMat, false, true);
  }

  if (lanternSilkParts.length > 0) {
    const lanternSilkMesh = new THREE.Mesh(mergeNormalized(lanternSilkParts), lanternSilkMaterial);
    lanternSilkMesh.name = 'VietnameseSilkLanterns';
    group.add(lanternSilkMesh);
  }
  if (lanternCoreParts.length > 0) {
    const lanternCoreMesh = new THREE.Mesh(mergeNormalized(lanternCoreParts), lanternCoreMaterial);
    lanternCoreMesh.name = 'VietnameseLanternCores';
    group.add(lanternCoreMesh);
  }

  tagMotifIds(group, [
    'HV-NEW-MB-01', 'HV-B04', 'HV-I01', 'HV-I02', 'HV-I03', 'HV-D15',
    'HV-A04', 'HV-A06', 'HV-D01', 'HV-D02', 'HV-D06', 'HV-D10', 'HV-D11', 'HV-D12',
    'HV-C02', 'HV-C07', 'HV-C08', 'HV-C13', 'HV-B05', 'HV-B06', 'HV-E06', 'HV-E07',
    'HV-J04', 'HV-NEW-MB-03', 'HV-NEW-MB-12'
  ]);

  scene.add(group);
  return group;
}
