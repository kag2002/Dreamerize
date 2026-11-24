import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import {
  applyWorldBoxUV,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createHueImperialHipRoofGeometry,
  createLanternCapGeometry,
  createLanternCoreGeometry,
  createRibbedLanternShellGeometry,
  createWarmLightPoolMaterial,
  mergeNormalized,
  mulberry32,
  VietnamBuilderContext
} from './vietnamGeometryHelpers';
import {
  createGuardianBeastParts,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createSmoothTaperedTubeGeometry,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  createHoiAnMaterialPack,
  HOI_AN_RELIEF_UV,
  HOI_AN_SIGN_UV,
  HoiAnReliefKey,
  HoiAnSignKey
} from '../textures/hoiAnPbrTextures';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
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

function remapUvRect(
  geo: THREE.BufferGeometry,
  rect: readonly [number, number, number, number],
  pad = 0.003
): THREE.BufferGeometry {
  const [u0, v0, u1, v1] = rect;
  const pu0 = u0 + pad;
  const pv0 = v0 + pad;
  const du = Math.max(0.001, u1 - u0 - pad * 2);
  const dv = Math.max(0.001, v1 - v0 - pad * 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = clamp01(uv.getX(i));
    const v = clamp01(uv.getY(i));
    uv.setXY(i, pu0 + u * du, pv0 + v * dv);
  }
  return geo;
}

function normalizeExtrudeUv(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const sx = Math.max(0.01, bb.max.x - bb.min.x);
  const sy = Math.max(0.01, bb.max.y - bb.min.y);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
  }
  return geo;
}

function remapRelief(geo: THREE.BufferGeometry, key: HoiAnReliefKey): THREE.BufferGeometry {
  return remapUvRect(geo, HOI_AN_RELIEF_UV[key], 0.003);
}

function makeSignPlane(
  w: number,
  h: number,
  key: HoiAnSignKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const geo = remapUvRect(new THREE.PlaneGeometry(w, h), HOI_AN_SIGN_UV[key], 0.003);
  if (rotX) geo.rotateX(rotX);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

function makeReliefPlane(
  w: number,
  h: number,
  key: HoiAnReliefKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const geo = remapRelief(new THREE.PlaneGeometry(w, h), key);
  if (rotX) geo.rotateX(rotX);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: HoiAnReliefKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  const geo = remapRelief(new THREE.BoxGeometry(w, h, d), key);
  if (rotX) geo.rotateX(rotX);
  if (rotZ) geo.rotateZ(rotZ);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
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

function addCone(
  parts: THREE.BufferGeometry[],
  r: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotY = 0,
  rotZ = 0
): void {
  const c = new THREE.ConeGeometry(r, h, segs);
  if (rotX) c.rotateX(rotX);
  if (rotZ) c.rotateZ(rotZ);
  if (rotY) c.rotateY(rotY);
  c.translate(x, y, z);
  parts.push(c);
}

/**
 * Helper: Sculpted 3D Cobalt-Blue & White *Khảm Sành Sứ* Dragon/Cloud/Wave Crest (`CC-13`, `CC-24`, `CC-25`)
 * Mapped directly into `HOI_AN_RELIEF_UV.ceramicMosaic` so mosaic glaze & blue-white scrollwork read cleanly!
 */
function createCeramicDragonCrestGeo(width: number, height: number, depth = 0.14): THREE.BufferGeometry {
  const hw = width * 0.5;
  const sh = new THREE.Shape();
  sh.moveTo(-hw, 0);
  sh.lineTo(hw, 0);
  sh.quadraticCurveTo(hw * 0.96, height * 0.56, hw * 0.70, height * 0.68);
  sh.quadraticCurveTo(hw * 0.44, height * 0.36, hw * 0.24, height * 0.72);
  sh.quadraticCurveTo(0, height * 1.08, -hw * 0.24, height * 0.72);
  sh.quadraticCurveTo(-hw * 0.44, height * 0.36, -hw * 0.70, height * 0.68);
  sh.quadraticCurveTo(-hw * 0.96, height * 0.56, -hw, 0);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -depth * 0.5);
  // Normalize UVs 0..1 across crest bounding box before remapping into ceramicMosaic
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const spanX = Math.max(0.01, bb.max.x - bb.min.x);
  const spanY = Math.max(0.01, bb.max.y - bb.min.y);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / spanX, (pos.getY(i) - bb.min.y) / spanY);
  }
  return remapRelief(g, 'ceramicMosaic');
}

/**
 * Helper: Curved-Crest Stepped Hội An Firewall (`Tường Hồi Bít Đốc`, `HA-02` — Ref 84!)
 * Eliminates 90° blocky rectangle steps with authentic softly concave sloping masonry profile + white plaster coping!
 */
function createCurvedFirewallGeo(depthX: number, height: number, thicknessZ = 0.24): THREE.BufferGeometry {
  const hd = depthX * 0.5;
  const sh = new THREE.Shape();
  sh.moveTo(-hd, 0);
  sh.lineTo(hd, 0);
  sh.lineTo(hd, height * 0.22);
  sh.quadraticCurveTo(hd * 0.55, height * 0.48, hd * 0.22, height * 0.88);
  sh.quadraticCurveTo(0, height * 1.06, -hd * 0.22, height * 0.88);
  sh.quadraticCurveTo(-hd * 0.55, height * 0.48, -hd, height * 0.22);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: thicknessZ, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -thicknessZ * 0.5);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const sx = Math.max(0.01, bb.max.x - bb.min.x);
  const sy = Math.max(0.01, bb.max.y - bb.min.y);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
  }
  return remapRelief(g, 'mustardOchreWall');
}

/**
 * Helper: Pitched Gable Slope Quad Pair mapped cleanly 0..1 into `chuaCauRoof` or `mossyYinYangRoof`
 * (`CC-21`, `CC-22`, `HA-06` — guarantees crisp vertical tile flutes & white lime-mortar stripes!)
 */
function addMappedGableRoof(
  reliefParts: THREE.BufferGeometry[],
  whitePlasterParts: THREE.BufferGeometry[],
  key: HoiAnReliefKey,
  cx: number,
  baseY: number,
  cz: number,
  spanAlongRidge: number,
  eaveSpan: number,
  ridgeH: number,
  ridgeAxis: 'x' | 'z',
  withWhiteVerge = true
): void {
  const halfSpan = eaveSpan * 0.5;
  const slopeLen = Math.hypot(halfSpan, ridgeH);
  const slopeAng = Math.atan2(ridgeH, halfSpan);
  for (const s of [-1, 1]) {
    const plane = remapRelief(new THREE.PlaneGeometry(spanAlongRidge, slopeLen), key);
    // Plane faces +Z initially with width=X (along ridge), height=Y (up slope).
    // Rotate to face outward-upward over ridgeAxis:
    if (ridgeAxis === 'x') {
      // Slope runs along Z: s=+1 faces +Z/+Y, s=-1 faces -Z/+Y
      plane.rotateX(s > 0 ? -(Math.PI * 0.5 - slopeAng) : -(Math.PI * 0.5 + slopeAng));
      if (s < 0) plane.rotateY(Math.PI);
      plane.translate(cx, baseY + ridgeH * 0.5, cz + s * (halfSpan * 0.5));
    } else {
      // Ridge runs along Z, slopes face +X/+Y and -X/+Y
      plane.rotateX(-(Math.PI * 0.5 - slopeAng));
      plane.rotateY(s > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      plane.translate(cx + s * (halfSpan * 0.5), baseY + ridgeH * 0.5, cz);
    }
    reliefParts.push(plane);
  }
  if (withWhiteVerge) {
    if (ridgeAxis === 'x') {
      addBox(whitePlasterParts, spanAlongRidge + 0.14, 0.22, 0.28, cx, baseY + ridgeH + 0.08, cz);
      // Sloped white verge bargeboards at both ends (`bờ quyết`)
      for (const gx of [-spanAlongRidge * 0.5, spanAlongRidge * 0.5]) {
        for (const s of [-1, 1]) {
          addBox(whitePlasterParts, 0.16, 0.16, slopeLen + 0.08, cx + gx, baseY + ridgeH * 0.5 + 0.04, cz + s * (halfSpan * 0.5), 0, s * slopeAng, 0);
        }
      }
    } else {
      addBox(whitePlasterParts, 0.28, 0.22, spanAlongRidge + 0.04, cx, baseY + ridgeH + 0.08, cz);
    }
  }
}

/**
 * Helper: Sculpted Potted Areca Palm (`Cau Cảnh` in round terracotta pot — Ref 19 left quay! `CC-05`)
 */
function addPottedArecaPalm(
  solidColorParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  px: number,
  py: number,
  pz: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  // Wide flared terracotta planter pot
  const pot = new THREE.CylinderGeometry(0.30, 0.21, 0.34, 8);
  pot.translate(px, py + 0.17, pz);
  solidColorParts.push(colorizeGeo(pot, '#9e543a'));
  const rim = new THREE.CylinderGeometry(0.33, 0.32, 0.06, 8);
  rim.translate(px, py + 0.34, pz);
  solidColorParts.push(colorizeGeo(rim, '#ad6044'));
  // Slender ringed green-brown areca palm cane + 6 arching feathery frond cards
  const caneH = 1.15 + rand() * 0.25;
  const cane = new THREE.CylinderGeometry(0.032, 0.045, caneH, 5);
  cane.translate(px, py + 0.32 + caneH * 0.5, pz);
  solidColorParts.push(colorizeGeo(cane, '#586e3c'));
  const palmGreens = ['#265c1f', '#347428', '#468c32'];
  for (let f = 0; f < 6; f++) {
    const a = (f / 6) * Math.PI * 2 + rand() * 0.4;
    const card = new THREE.PlaneGeometry(0.76, 0.46);
    card.rotateX(-0.52 - rand() * 0.32);
    card.rotateY(a);
    card.translate(
      px + Math.cos(a) * 0.32,
      py + 0.36 + caneH + 0.10 + (rand() - 0.5) * 0.14,
      pz + Math.sin(a) * 0.32
    );
    foliageParts.push(colorizeGeo(card, palmGreens[f % palmGreens.length]));
  }
}

/**
 * Helper: Sculpted Porcelain Vase or Lidded Urn (`Chóe Gốm` / `Bình Hoa Lam`) + Yellow Chrysanthemums (`BD-23`, `BD-24`, `TK-22`, `TK-23`)
 */
function addHoiAnPorcelainVase(
  reliefParts: THREE.BufferGeometry[],
  solidColorParts: THREE.BufferGeometry[],
  vx: number,
  vy: number,
  vz: number,
  scale: number,
  mode: 'lidded_urn' | 'chrysanthemum_vase' | 'incense_jar',
  seed: number
): void {
  const rand = mulberry32(seed);
  if (mode === 'incense_jar') {
    const jar = remapRelief(new THREE.CylinderGeometry(0.14 * scale, 0.12 * scale, 0.28 * scale, 12), 'porcelainCobalt');
    jar.translate(vx, vy + 0.14 * scale, vz);
    reliefParts.push(jar);
    // Dense magenta-pink incense sticks (`BD-23`)
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const r = (0.02 + rand() * 0.06) * scale;
      const stick = new THREE.CylinderGeometry(0.004 * scale, 0.004 * scale, 0.34 * scale, 4);
      stick.rotateZ((rand() - 0.5) * 0.14);
      stick.translate(vx + Math.cos(a) * r, vy + 0.34 * scale, vz + Math.sin(a) * r);
      solidColorParts.push(colorizeGeo(stick, k % 3 === 0 ? '#e62e78' : '#c81c5e'));
    }
    return;
  }

  const prof =
    mode === 'lidded_urn'
      ? [
          new THREE.Vector2(0.09, 0.0),
          new THREE.Vector2(0.12, 0.08),
          new THREE.Vector2(0.22, 0.30),
          new THREE.Vector2(0.21, 0.50),
          new THREE.Vector2(0.11, 0.62),
          new THREE.Vector2(0.16, 0.67),
          new THREE.Vector2(0.09, 0.78),
          new THREE.Vector2(0.03, 0.85),
          new THREE.Vector2(0.0, 0.88)
        ]
      : [
          new THREE.Vector2(0.08, 0.0),
          new THREE.Vector2(0.14, 0.18),
          new THREE.Vector2(0.15, 0.30),
          new THREE.Vector2(0.075, 0.40),
          new THREE.Vector2(0.105, 0.47)
        ];
  const vase = remapRelief(new THREE.LatheGeometry(prof, 12), 'porcelainCobalt');
  vase.scale(scale, scale, scale);
  vase.translate(vx, vy, vz);
  reliefParts.push(vase);

  if (mode === 'chrysanthemum_vase') {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rand() * 0.4;
      const spread = (0.06 + rand() * 0.14) * scale;
      const h = (0.20 + rand() * 0.22) * scale;
      const tx = vx + Math.cos(a) * spread;
      const tz = vz + Math.sin(a) * spread;
      const ty = vy + 0.44 * scale + h;
      const stem = new THREE.CylinderGeometry(0.006 * scale, 0.008 * scale, h + 0.12 * scale, 4);
      stem.translate((vx + tx) * 0.5, vy + 0.40 * scale + h * 0.45, (vz + tz) * 0.5);
      solidColorParts.push(colorizeGeo(stem, '#265c20'));
      // Lush golden pompom chrysanthemum bloom (Ref 56 & Ref 114!)
      const bloom = new THREE.DodecahedronGeometry(0.058 * scale, 0);
      bloom.scale(1.15, 0.85, 1.15);
      bloom.translate(tx, ty, tz);
      solidColorParts.push(colorizeGeo(bloom, k % 2 === 0 ? '#f8d018' : '#ebb80c'));
      const leaf = new THREE.ConeGeometry(0.028 * scale, 0.12 * scale, 4);
      leaf.rotateZ(0.8);
      leaf.rotateY(a);
      leaf.translate((vx + tx) * 0.55, vy + 0.46 * scale + h * 0.35, (vz + tz) * 0.55);
      solidColorParts.push(colorizeGeo(leaf, '#2d6822'));
    }
  }
}

/**
 * Helper: Sculpted Dark-Bronze Crane (`Hạc Đồng` — Ref 56 inward-facing cranes!)
 */
function addBronzeCrane(
  bronzeParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  rotY: number,
  scale: number
): void {
  const s = scale;
  const place = (g: THREE.BufferGeometry) => {
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    bronzeParts.push(g);
  };
  for (const sx of [-0.04, 0.04]) {
    const leg = new THREE.CylinderGeometry(0.012 * s, 0.014 * s, 0.48 * s, 5);
    leg.translate(sx * s, 0.24 * s, 0);
    place(leg);
  }
  const base = new THREE.CylinderGeometry(0.11 * s, 0.14 * s, 0.06 * s, 8);
  base.translate(0, 0.03 * s, 0);
  place(base);
  const body = new THREE.SphereGeometry(0.14 * s, 8, 6);
  body.scale(0.82, 0.92, 1.45);
  body.rotateX(-0.28);
  body.translate(0, 0.56 * s, -0.02 * s);
  place(body);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.64 * s, 0.09 * s),
    new THREE.Vector3(0, 0.86 * s, 0.16 * s),
    new THREE.Vector3(0, 1.02 * s, 0.08 * s),
    new THREE.Vector3(0, 1.14 * s, 0.14 * s)
  ]);
  place(createSmoothTaperedTubeGeometry(neckCurve, 7, 5, (t) => (0.032 - t * 0.010) * s));
  const head = new THREE.SphereGeometry(0.042 * s, 6, 5);
  head.translate(0, 1.16 * s, 0.15 * s);
  place(head);
  const beak = new THREE.ConeGeometry(0.014 * s, 0.14 * s, 4);
  beak.rotateX(Math.PI * 0.56);
  beak.translate(0, 1.15 * s, 0.24 * s);
  place(beak);
}

/**
 * Helper: Sculpted Organic Cascading Bougainvillea Vine & Magenta Foliage Cards (`HA-07` — ZERO blocky icosahedra!)
 */
function addOrganicBougainvillea(
  woodParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  fx: number,
  fy: number,
  fz: number,
  facing: number,
  spanZ: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  // Gnarled climbing woody vine stem rising to balcony eaves
  const vineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(fx, fy - 4.0, fz - spanZ * 0.42),
    new THREE.Vector3(fx + facing * 0.12, fy - 2.0, fz - spanZ * 0.36),
    new THREE.Vector3(fx + facing * 0.18, fy - 0.15, fz - spanZ * 0.22),
    new THREE.Vector3(fx + facing * 0.22, fy + 0.18, fz + spanZ * 0.34)
  ]);
  woodParts.push(createSmoothTaperedTubeGeometry(vineCurve, 6, 4, (t) => 0.048 - t * 0.025));

  const magentaHexes = ['#c81664', '#de2478', '#e63c88', '#b81058', '#eb5698'];
  const leafHexes = ['#1f4d1a', '#2c6424', '#38762c'];
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const pz = fz + (t - 0.5) * spanZ * 0.92 + (rand() - 0.5) * 0.35;
    const px = fx + facing * (0.14 + rand() * 0.34);
    const py = fy + 0.25 - rand() * 1.15 - Math.sin(t * Math.PI) * 0.25;
    const cw = 0.42 + rand() * 0.34;
    const card = new THREE.PlaneGeometry(cw, cw * 0.78);
    card.rotateX((rand() - 0.5) * 1.2);
    card.rotateY(rand() * Math.PI * 2);
    card.rotateZ((rand() - 0.5) * 0.7);
    card.translate(px, py, pz);
    const isFlower = rand() > 0.36;
    foliageParts.push(
      colorizeGeo(
        card,
        isFlower
          ? magentaHexes[Math.floor(rand() * magentaHexes.length)]
          : leafHexes[Math.floor(rand() * leafHexes.length)]
      )
    );
  }
}

/**
 * Helper: Mature Hội An Street Tree with Whitewashed Lower Trunk (`HA-10`, Ref 84!)
 */
function addHoiAnStreetTree(
  woodParts: THREE.BufferGeometry[],
  whiteParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  tx: number,
  ty: number,
  tz: number,
  height: number,
  crownR: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  // Whitewashed lower 1.3m trunk (signature Vietnamese heritage street tree — Ref 84!)
  addCyl(whiteParts, 0.16, 0.20, 1.35, 6, tx, ty + 0.675, tz);
  addCyl(woodParts, 0.12, 0.16, height * 0.44, 6, tx, ty + 1.35 + height * 0.22, tz);
  const boughY = ty + 1.35 + height * 0.42;
  const tips: Array<[number, number, number]> = [[tx, ty + height * 0.85, tz]];
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI * 2 + rand() * 0.6;
    const bx = tx + Math.cos(a) * crownR * 0.56;
    const bz = tz + Math.sin(a) * crownR * 0.56;
    const by = boughY + height * 0.28;
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(tx, boughY, tz), new THREE.Vector3(bx, by, bz)]);
    woodParts.push(createSmoothTaperedTubeGeometry(c, 3, 4, (t) => 0.11 - t * 0.06));
    tips.push([bx, by, bz]);
  }
  const greens = ['#1f4d1a', '#2d6624', '#3f7d2e', '#529038'];
  for (const [cx, cy, cz] of tips) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + rand() * 0.5;
      const dist = crownR * (0.28 + rand() * 0.48);
      const cw = crownR * (0.55 + rand() * 0.35);
      const card = new THREE.PlaneGeometry(cw, cw * 0.82);
      card.rotateX((rand() - 0.5) * 1.1);
      card.rotateY(a);
      card.rotateZ((rand() - 0.5) * 0.6);
      card.translate(cx + Math.cos(a) * dist, cy + (rand() - 0.35) * crownR * 0.45, cz + Math.sin(a) * dist);
      foliageParts.push(colorizeGeo(card, greens[k % greens.length]));
    }
  }
}

/**
 * Builds the Complete Museum-Grade Phố Cổ Hội An Complex (`HoiAnAncientTownComplex`),
 * implementing all 128 QC audit items (`CC-01..32`, `BD-01..32`, `TK-01..32`, `HA-01..32`).
 */
export function buildHoiAnAncientTownComplex(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HoiAnAncientTownComplex';

  const cx = 175;
  const cz = 45;
  const bankY = ctx.getHeight(160, 45); // ~1.35m on both canal banks
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 54.0 },
    { x: 150, z: 87.2, r: 22.0 },
    { x: 205.5, z: 65.0, r: 22.0 },
    { x: 143.5, z: 62.0, r: 16.0 }
  );

  // Ultra-lean 3-material Hội An Museum Pack (net material delta <= +1!)
  const ha = createHoiAnMaterialPack(ctx.renderer);
  ctx.extraMaterials.push(...ha.allMaterials);
  ctx.extraTextures.push(...ha.allTextures);
  animatedUniforms.push(ha.lanternTimeUniform);

  // Geometry merge buckets
  const stoneParts: THREE.BufferGeometry[] = [];
  const whitePlasterParts: THREE.BufferGeometry[] = [];
  const reliefAtlasParts: THREE.BufferGeometry[] = [];
  const signAtlasParts: THREE.BufferGeometry[] = [];
  const jadeRoofParts: THREE.BufferGeometry[] = [];
  const ironwoodParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const solidColorParts: THREE.BufferGeometry[] = [];
  const foliageCardParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];
  const lightPoolParts: THREE.BufferGeometry[] = [];

  const lanternPalette = ['#cc2018', '#f2b62a', '#f6edd6', '#e65a1c', '#267844', '#9e244c'];
  const lanternProfiles: Array<'pumpkin' | 'garlic' | 'diamond' | 'cylinder'> = [
    'pumpkin',
    'garlic',
    'diamond',
    'cylinder'
  ];

  const addHoiAnLantern = (
    lx: number,
    ly: number,
    lz: number,
    rad: number,
    h: number,
    hex: string,
    shapeIdx: number,
    tasselRed: boolean
  ): void => {
    const prof = lanternProfiles[Math.abs(shapeIdx) % 4];
    const shell = createRibbedLanternShellGeometry(rad, h, 10, 6, prof);
    const yScale = prof === 'pumpkin' ? 0.88 : prof === 'garlic' ? 1.12 : prof === 'diamond' ? 1.15 : 1.24;
    const rScale = prof === 'pumpkin' ? 1.16 : prof === 'garlic' ? 1.0 : prof === 'diamond' ? 1.06 : 0.78;
    shell.scale(rScale, yScale, rScale);
    shell.translate(lx, ly, lz);
    lanternParts.push(colorizeGeo(shell, hex));

    const effH = h * yScale;
    const cap = createLanternCapGeometry(rad * 0.90, effH, false);
    cap.translate(lx, ly, lz);
    ironwoodParts.push(cap);

    const core = createLanternCoreGeometry(rad * 0.84, effH * 0.86);
    core.translate(lx, ly, lz);
    coreParts.push(core);

    const tasselTarget = tasselRed ? crimsonParts : goldParts;
    const knotY = ly - effH * 0.5 - 0.05;
    const tasselLen = Math.max(0.16, effH * 0.32);
    addCone(tasselTarget, rad * 0.13, tasselLen, 5, lx, knotY - tasselLen * 0.52, lz);
  };

  // =================================================================================================
  // SECTION 1: HOÀI CANAL QUAY WALLS, SLOPED FLAGSTONE REVETMENTS, MIRROR WATER & POTTED ARECA PALMS
  // (CC-03..CC-07, CC-27, HA-08, HA-09)
  // =================================================================================================
  for (const [qx, dir] of [
    [166.2, 1],
    [183.8, -1]
  ] as const) {
    // Dark polygonal rubble-stone quay retaining wall & weathered stone coping (`CC-04`)
    addBox(stoneParts, 1.4, 3.1, 84.0, qx, 0.05, cz);
    addBox(stoneParts, 2.2, 0.28, 84.0, qx, bankY + 0.14, cz);
    // Dry-laid inward-sloping stone revetment bank burying 100% of any terrain grass edge inside canal (`CC-03`!)
    addBox(stoneParts, 4.3, 0.72, 82.0, qx + dir * 2.15, 0.34, cz, 0, 0, -dir * 0.27);
    // Continuous clean flagstone heritage sidewalk strictly on DRY quay embankment (`x = 163.2` & `186.8`, HA-08/HA-09!)
    addBox(stoneParts, 5.2, 0.34, 84.0, qx - dir * 3.15, bankY - 0.05, cz);
    // Item 104: Bờ Kè Sông Hoài cast-iron & stone riverside bollard-and-chain posts along promenade
    for (let bz = 14.0; bz <= 76.0; bz += 6.2) {
      if (Math.abs(bz - 45.0) < 4.5) continue;
      addCyl(stoneParts, 0.11, 0.14, 0.72, 6, qx - dir * 0.35, bankY + 0.42, bz);
    }
  }
  // Item 108 & 119: Outdoor wooden café tables & stools on West Bach Dang sidewalk + traditional Xích Lô (cyclo)
  for (const czTab of [32.0, 58.0]) {
    addCyl(ironwoodParts, 0.36, 0.36, 0.06, 8, 162.8, bankY + 0.76, czTab);
    addCyl(ironwoodParts, 0.05, 0.06, 0.68, 6, 162.8, bankY + 0.40, czTab);
    addCyl(ironwoodParts, 0.18, 0.18, 0.38, 6, 162.1, bankY + 0.26, czTab + 0.52);
  }
  // Traditional Xích Lô (cyclo) near West Nguyen Thai Hoc corner (162.2, 39.2)
  addBox(ironwoodParts, 0.72, 0.38, 0.92, 162.2, bankY + 0.56, 39.2);
  for (const sx of [-0.42, 0.42]) {
    const cWheel = new THREE.TorusGeometry(0.28, 0.028, 4, 8);
    cWheel.rotateY(Math.PI * 0.5);
    cWheel.translate(162.2 + sx, bankY + 0.38, 39.0);
    ironwoodParts.push(cWheel);
  }
  // Item 103 (Area Expansion): Chợ Hội An riverside market stalls with woven bamboo baskets & Nón Lá on East quay
  for (const mz of [21.5, 36.5]) {
    addBox(ironwoodParts, 1.85, 0.72, 2.8, 186.6, bankY + 0.44, mz);
    addCone(solidColorParts, 1.35, 0.55, 6, 186.6, bankY + 2.35, mz);
    addCyl(ironwoodParts, 0.05, 0.06, 1.9, 6, 186.6, bankY + 1.25, mz);
    addCone(goldParts, 0.28, 0.16, 8, 186.2, bankY + 0.92, mz - 0.55);
    addCone(goldParts, 0.28, 0.16, 8, 186.2, bankY + 0.92, mz + 0.55);
  }

  // 4 Stone quay staircases descending cleanly to Hoài Canal waterline
  for (const [qx, dir] of [
    [166.2, 1],
    [183.8, -1]
  ] as const) {
    for (const stZ of [25.5, 64.5]) {
      for (let st = 0; st < 5; st++) {
        const sy = bankY - st * 0.28;
        const sx = qx + dir * (0.95 + st * 0.42);
        addBox(stoneParts, 0.54, Math.max(0.45, sy + 1.4), 3.2, sx, (sy - 1.4) * 0.5, stZ);
      }
      for (const rz of [-1.65, 1.65]) {
        addBox(stoneParts, 2.1, 0.68, 0.22, qx + dir * 1.45, bankY * 0.55, stZ + rz);
      }
      // Item 118: Weathered granite mooring rings at the 4 quay boat landings
      addCyl(bronzeParts, 0.10, 0.10, 0.08, 6, qx + dir * 0.65, bankY + 0.28, stZ + 1.85);
    }
  }

  // Deep Glassy Hoài Canal Live Planar Mirror Reflection (`CC-27`, `HA-31` — zero extra unique material!)
  const useLiveMirror =
    typeof window !== 'undefined' &&
    Boolean(ctx.renderer && ctx.renderer.domElement && ctx.renderer.domElement.width > 0);
  if (useLiveMirror) {
    const canalMirrorGeo = new THREE.PlaneGeometry(15.6, 80.0);
    const canalReflector = new Reflector(canalMirrorGeo, {
      clipBias: 0.004,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x24303a
    });
    canalReflector.rotation.x = -Math.PI * 0.5;
    canalReflector.position.set(cx, 0.035, cz);
    canalReflector.name = 'HoaiCanalMirrorWater';
    group.add(canalReflector);
  }

  // Ref 19 Left Quay Row of 8 Potted Areca Palms (`Cau Cảnh` in terracotta pots — `CC-05`!)
  for (let pi = 0; pi < 8; pi++) {
    addPottedArecaPalm(solidColorParts, foliageCardParts, 165.45, bankY + 0.28, 50.2 + pi * 1.42, 1950 + pi);
  }

  // Grounded Wrought-Iron Streetlamps & Parked Vintage Bicycles STRICTLY ON DRY SIDEWALKS (`CC-06`, `HA-09`!)
  for (let lp = 0; lp < 6; lp++) {
    const lz = 18.0 + lp * 11.4;
    if (Math.abs(lz - 45) < 5.0) continue;
    const side = lp % 2 === 0 ? -1 : 1;
    const lx = cx + side * 10.6; // 164.4 (West quay) or 185.6 (East quay) — 100% ON DRY STONE!
    addCyl(ironwoodParts, 0.05, 0.085, 3.65, 6, lx, bankY + 1.92, lz);
    addBox(ironwoodParts, 0.46, 0.055, 0.055, lx - side * 0.22, bankY + 3.68, lz);
    const bulb = new THREE.SphereGeometry(0.13, 6, 5);
    bulb.translate(lx - side * 0.42, bankY + 3.52, lz);
    coreParts.push(bulb);
  }
  for (const [bx, bz, byaw] of [
    [162.4, 22.0, 0.16],
    [187.4, 34.5, -0.18],
    [162.5, 58.5, 0.14],
    [187.5, 67.5, -0.16]
  ]) {
    for (const wz of [-0.44, 0.44]) {
      const wheel = new THREE.TorusGeometry(0.30, 0.028, 4, 8);
      wheel.rotateY(Math.PI * 0.5 + byaw);
      wheel.translate(bx + Math.sin(byaw) * wz, bankY + 0.42, bz + Math.cos(byaw) * wz);
      ironwoodParts.push(wheel);
    }
    addBox(ironwoodParts, 0.045, 0.045, 0.88, bx, bankY + 0.62, bz, byaw);
    addCyl(ironwoodParts, 0.022, 0.022, 0.62, 5, bx + Math.sin(byaw) * 0.30, bankY + 0.72, bz + Math.cos(byaw) * 0.30);
    addBox(ironwoodParts, 0.42, 0.036, 0.036, bx + Math.sin(byaw) * 0.32, bankY + 1.00, bz + Math.cos(byaw) * 0.32, byaw);
  }

  // =================================================================================================
  // SECTION 2: CHÙA CẦU EXTERIOR (LAI VIỄN KIỀU — Ref 19, `CC-01..CC-26`)
  // =================================================================================================
  const bridgeZ = 45;
  for (const ax of [165.3, 184.7]) {
    addBox(stoneParts, 3.0, 4.0, 5.2, ax, -0.15, bridgeZ);
  }
  // Exact 5-Span Substructure: 2 narrow semicircular vaults West, 1 wide OPEN rectangular central span, 2 narrow vaults East (`CC-01`, `CC-02`)
  for (const ac of [
    { x: 168.0, w: 3.1, h: 4.10, openW: 1.85, openH: 3.30 },
    { x: 171.2, w: 3.1, h: 4.60, openW: 1.85, openH: 3.80 },
    { x: 178.8, w: 3.1, h: 4.60, openW: 1.85, openH: 3.80 },
    { x: 182.0, w: 3.1, h: 4.10, openW: 1.85, openH: 3.30 }
  ]) {
    const aWall = createArchedWallGeometry(ac.w, ac.h, 4.7, ac.openW, ac.openH);
    aWall.translate(ac.x, -2.2, bridgeZ);
    stoneParts.push(aWall);
  }
  // Wide OPEN central rectangular canal span (`x = 172.8..177.2`) flanked by pointed stone cutwater piers!
  for (const px of [173.05, 176.95]) {
    addBox(stoneParts, 1.08, 5.10, 4.95, px, 0.35, bridgeZ);
    // Pointed triangular cutwaters on South & North pier noses (`CC-02`) + Item 079: Cutwater stone caps
    for (const dirZ of [-1, 1]) {
      const cw = new THREE.CylinderGeometry(0.45, 0.56, 3.8, 3);
      cw.rotateY(dirZ > 0 ? 0 : Math.PI);
      cw.translate(px, 0.05, bridgeZ + dirZ * 2.52);
      stoneParts.push(cw);
      addCone(stoneParts, 0.58, 0.45, 3, px, 2.15, bridgeZ + dirZ * 2.52, 0, dirZ > 0 ? 0 : Math.PI);
    }
  }
  // Item 088: Weathered moss & lichen stone patina strips along lower bridge abutment arches near waterline
  for (const ax of [166.8, 183.2]) {
    const mossStrip = new THREE.BoxGeometry(2.6, 0.38, 4.8);
    mossStrip.translate(ax, 0.22, bridgeZ);
    solidColorParts.push(colorizeGeo(mossStrip, '#384e26'));
  }
  // Clean horizontal stone lintel beam spanning central opening (`y = 2.84`, leaving full clear water view underneath!)
  addBox(stoneParts, 4.4, 0.42, 4.85, cx, 2.86, bridgeZ);

  // Cambered White-Plaster Curved Arch Fascia Band + Central Recessed Ceramic Medallion (`CC-08`, `CC-09`!)
  const bandSegs = 18;
  for (let i = 0; i < bandSegs; i++) {
    const tm = (i + 0.5) / bandSegs;
    const bx = THREE.MathUtils.lerp(165.4, 184.6, tm);
    const bandY = bankY + 0.02 + 1.56 * Math.sin(tm * Math.PI);
    const slope = Math.atan2(1.56 * Math.cos(tm * Math.PI) * (Math.PI / 19.2), 1.0);
    for (const sz of [-2.42, 2.42]) {
      addBox(whitePlasterParts, 1.18, 0.44, 0.22, bx, bandY, bridgeZ + sz, 0, 0, slope);
      // Fine raised upper/lower horizontal fascia molding lines
      addBox(whitePlasterParts, 1.18, 0.06, 0.27, bx, bandY + 0.20, bridgeZ + sz, 0, 0, slope);
      addBox(whitePlasterParts, 1.18, 0.06, 0.27, bx, bandY - 0.20, bridgeZ + sz, 0, 0, slope);
    }
  }
  // Central recessed rectangular polychrome *khảm sành* ornament panel on South white fascia crown (`CC-09`!)
  for (const sz of [-2.55, 2.55]) {
    addBox(whitePlasterParts, 2.25, 0.34, 0.06, cx, bankY + 1.58, bridgeZ + sz);
    reliefAtlasParts.push(
      makeReliefPlane(2.05, 0.22, 'ceramicMosaic', cx, bankY + 1.58, bridgeZ + sz + Math.sign(sz) * 0.038, sz < 0 ? Math.PI : 0)
    );
  }

  // Curved Terracotta-Red Plastered End Wing Walls (`#a8362a`, NOT zebra crimson!) + Undulating White Coping + 3D Cobalt-White Ceramic Crests (`CC-11..14`!)
  for (const [endX, dir] of [
    [165.4, -1],
    [184.6, 1]
  ] as const) {
    for (const sz of [-1, 1]) {
      const wingPts = [
        new THREE.Vector3(endX, bankY + 0.85, bridgeZ + sz * 2.38),
        new THREE.Vector3(endX + dir * 1.55, bankY + 0.68, bridgeZ + sz * 2.88),
        new THREE.Vector3(endX + dir * 3.05, bankY + 0.52, bridgeZ + sz * 3.72)
      ];
      for (let w = 0; w < 2; w++) {
        const p0 = wingPts[w];
        const p1 = wingPts[w + 1];
        const segLen = Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.14;
        const rotY = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
        const hWall = w === 0 ? 3.25 : 2.55;
        const mx = (p0.x + p1.x) * 0.5;
        const mz = (p0.z + p1.z) * 0.5;
        // Smooth terracotta-red plastered wing wall (`#a8362a` vertex-colored smooth stucco!)
        const wBox = new THREE.BoxGeometry(segLen, hWall, 0.36);
        wBox.rotateY(rotY);
        wBox.translate(mx, bankY + hWall * 0.5, mz);
        solidColorParts.push(colorizeGeo(wBox, '#a8362a'));
        // Weathered stone base plinth + crisp white plaster coping molding
        addBox(stoneParts, segLen + 0.06, 0.34, 0.44, mx, bankY + 0.17, mz, rotY);
        addBox(whitePlasterParts, segLen + 0.12, 0.18, 0.44, mx, bankY + hWall + 0.08, mz, rotY);
        // Sculpted 3D cobalt-blue & white *khảm sành sứ* dragon/cloud/wave crest crowning the wing wall (`CC-13`!)
        const crest = createCeramicDragonCrestGeo(segLen * 0.86, 0.72, 0.14);
        crest.rotateY(rotY);
        crest.translate(mx, bankY + hWall + 0.16, mz);
        reliefAtlasParts.push(crest);
      }
      const pierBox = new THREE.BoxGeometry(0.48, 2.75, 0.48);
      pierBox.translate(wingPts[2].x, bankY + 1.38, wingPts[2].z);
      solidColorParts.push(colorizeGeo(pierBox, '#a8362a'));
      addBox(whitePlasterParts, 0.58, 0.16, 0.58, wingPts[2].x, bankY + 2.80, wingPts[2].z);
    }
    // Item 080, 081, 082, 089, 090, 092: Mắt Cửa spiral eye medallions, Chó (West) & Khỉ (East) guardian statues,
    // Lai Viễn Kiều plaque frame, entrance lanterns, anti-slip stone ramp ribs & oil-lamp sconces!
    for (const sz of [-0.95, 0.95]) {
      addCyl(goldParts, 0.14, 0.14, 0.08, 10, endX, bankY + 2.95, bridgeZ + sz, 0, 0, Math.PI * 0.5);
      // Pedestal + Guardian Statue (Dog at West endX < cx, Monkey at East endX > cx)
      addBox(stoneParts, 0.62, 0.68, 0.62, endX + dir * 1.15, bankY + 0.34, bridgeZ + sz * 1.35);
      const statBody = new THREE.CylinderGeometry(0.16, 0.22, 0.58, 7);
      statBody.translate(endX + dir * 1.15, bankY + 0.96, bridgeZ + sz * 1.35);
      const statHead = new THREE.SphereGeometry(0.14, 7, 5);
      statHead.translate(endX + dir * 1.15, bankY + 1.32, bridgeZ + sz * 1.35);
      solidColorParts.push(colorizeGeo(statBody, dir < 0 ? '#a8967c' : '#8a7662'), colorizeGeo(statHead, dir < 0 ? '#a8967c' : '#8a7662'));
      // Symmetrical red silk Đèn Lồng Hội An under entrance eaves
      addHoiAnLantern(endX + dir * 0.35, bankY + 2.45, bridgeZ + sz * 1.65, 0.22, 0.52, '#cc2018', 1, true);
    }
    // Anti-slip transverse stone ribs on bridge approach ramps
    for (let rb = 0; rb < 4; rb++) {
      addBox(stoneParts, 0.14, 0.08, 3.8, endX + dir * (0.6 + rb * 0.7), bankY + 0.14, bridgeZ);
    }
    if (dir > 0) {
      // Lai Viễn Kiều gilded plaque frame above East entrance arch
      addBox(goldParts, 0.14, 0.56, 1.75, endX + 0.18, bankY + 3.25, bridgeZ);
    }
  }

  // Open Arched Timber Gallery, Slender *Con Tiện* Balustrade (ZERO opaque black slab!), Columns & Warm Interior Lanterns (`CC-15..20`)
  const bridgeSegs = 18;
  for (let i = 0; i < bridgeSegs; i++) {
    const t0 = i / bridgeSegs;
    const t1 = (i + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const bx0 = THREE.MathUtils.lerp(165.2, 184.8, t0);
    const bx1 = THREE.MathUtils.lerp(165.2, 184.8, t1);
    const bx = (bx0 + bx1) * 0.5;
    const archY = bankY + 0.24 + 1.56 * Math.sin(tm * Math.PI);
    const slope = Math.atan2(1.56 * Math.cos(tm * Math.PI) * (Math.PI / 19.6), 1.0);

    // Matte planked timber bridge deck (`weatheredTimber` UV, ZERO zebra wood!)
    reliefAtlasParts.push(makeReliefBox(1.22, 0.24, 4.6, 'weatheredTimber', bx, archY, bridgeZ, 0, 0, slope));
    // Item 084: Traditional wooden bench seats (*Bàn Ngồi*) running along inner walkways of Chùa Cầu
    if (i > 2 && i < bridgeSegs - 3) {
      reliefAtlasParts.push(makeReliefBox(1.12, 0.08, 0.42, 'weatheredTimber', bx, archY + 0.48, bridgeZ + 1.82, 0, 0, slope));
    }
    // Item 087: Curved timber Kèo Chồng Rường roof truss tie-beams inside Chùa Cầu vaulted ceiling
    if (i % 3 === 0) {
      addBox(ironwoodParts, 0.16, 0.16, 4.1, bx, archY + 2.72, bridgeZ);
    }

    const isShrineOpening = Math.abs(bx - cx) < 2.45;
    for (const sz of [-2.15, 2.15]) {
      if (sz < 0 && isShrineOpening) {
        // Leave central North shrine bay 100% WIDE OPEN (zero column blocking camera `02`!)
        continue;
      }
      // Low slim sill curb (`0.22m` tall — NOT 0.92m opaque black wall!) + see-through slender *con tiện* balusters (`CC-15`, `CC-16`!)
      reliefAtlasParts.push(makeReliefBox(1.16, 0.22, 0.18, 'weatheredTimber', bx, archY + 0.22, bridgeZ + sz, 0, 0, slope));
      reliefAtlasParts.push(makeReliefBox(1.16, 0.08, 0.18, 'weatheredTimber', bx, archY + 1.08, bridgeZ + sz, 0, 0, slope));
      for (let sp = 0; sp < 4; sp++) {
        const sx = THREE.MathUtils.lerp(bx0 + 0.14, bx1 - 0.14, sp / 3);
        const sY = bankY + 0.24 + 1.56 * Math.sin(((sx - 165.2) / 19.6) * Math.PI);
        reliefAtlasParts.push(makeReliefBox(0.055, 0.78, 0.055, 'weatheredTimber', sx, sY + 0.68, bridgeZ + sz));
      }
      if (i % 3 === 0 || i === bridgeSegs - 1) {
        addCyl(ironwoodParts, 0.105, 0.12, 2.88, 8, bx, archY + 1.56, bridgeZ + sz);
      }
    }
    if (i % 3 === 0 || i === bridgeSegs - 1) {
      reliefAtlasParts.push(makeReliefBox(0.20, 0.22, 4.7, 'weatheredTimber', bx, archY + 2.98, bridgeZ));
    }
  }
  // Warm interior gallery silk lanterns glowing cleanly inside the 3 covered bays (`CC-18`)
  for (const [lx, ly, hex] of [
    [169.5, bankY + 3.05, '#e85a1c'],
    [175.0, bankY + 3.92, '#f2b62a'],
    [180.5, bankY + 3.05, '#cc2018']
  ] as const) {
    addHoiAnLantern(lx, ly, bridgeZ, 0.18, 0.42, hex, 0, true);
  }

  // Interior end-bay guardian pedestals housing Sacred Dog (West) & Monkey (East) (`CC-19`)
  for (const [pedX, beastType, faceRot] of [
    [166.7, 'dog' as const, Math.PI * 0.5],
    [183.3, 'monkey' as const, -Math.PI * 0.5]
  ] as const) {
    const tEnd = clamp01((pedX - 165.2) / 19.6);
    const floorY = bankY + 0.36 + 1.56 * Math.sin(tEnd * Math.PI);
    for (const sz of [-1.42, 1.42]) {
      reliefAtlasParts.push(makeReliefBox(0.68, 0.72, 0.68, 'weatheredTimber', pedX, floorY + 0.36, bridgeZ + sz));
      ironwoodParts.push(...createGuardianBeastParts(pedX, floorY + 0.74, bridgeZ + sz, faceRot, 0.64, beastType));
    }
  }

  // 3-Bay Stepped Warm Terracotta *Ngói Âm Dương* Roof with White Lime-Mortar Rib Stripes & 3D Cobalt-White Ceramic Crests (`CC-21..26`!)
  const bridgeBays = [
    { x: 168.4, w: 7.2, y: bankY + 3.35, h: 1.75, isCenter: false },
    { x: cx, w: 7.6, y: bankY + 4.18, h: 2.15, isCenter: true },
    { x: 181.6, w: 7.2, y: bankY + 3.35, h: 1.75, isCenter: false }
  ];
  for (const bay of bridgeBays) {
    addMappedGableRoof(reliefAtlasParts, whitePlasterParts, 'chuaCauRoof', bay.x, bay.y, bridgeZ, bay.w, 6.0, bay.h, 'x', true);
    // Warm *ngói chiếu* underside ceiling soffit inside bridge gallery (ZERO exterior tile bleed!)
    const halfS = 3.0;
    const sLen = Math.hypot(halfS, bay.h);
    const sAng = Math.atan2(bay.h, halfS);
    for (const s of [-1, 1]) {
      const soff = remapRelief(new THREE.PlaneGeometry(bay.w - 0.1, sLen - 0.1), 'ngoiChieu');
      soff.rotateX(s > 0 ? Math.PI * 0.5 + sAng : Math.PI * 0.5 - sAng);
      soff.translate(bay.x, bay.y + bay.h * 0.5 - 0.12, bridgeZ + s * (halfS * 0.5));
      reliefAtlasParts.push(soff);
    }
    // 3D Cobalt-Blue & White *Lưỡng Long Chầu Nhật* / Dragon-Cloud Ceramic Ridge Crest (`CC-24`, `CC-25`!)
    const crestW = bay.isCenter ? 4.8 : 3.6;
    const crestH = bay.isCenter ? 1.05 : 0.72;
    const crest = createCeramicDragonCrestGeo(crestW, crestH, 0.16);
    crest.translate(bay.x, bay.y + bay.h + 0.18, bridgeZ);
    reliefAtlasParts.push(crest);
  }
  // Crisp Red-and-Gold `"來 遠 橋 / LAI VIỄN KIỀU"` Plaques mounted unobstructed at East, West & Center portals (`CC-19`)
  for (const [px, rotY] of [
    [165.05, -Math.PI * 0.5],
    [184.95, Math.PI * 0.5]
  ] as const) {
    addBox(crimsonParts, 0.12, 0.74, 2.25, px, bankY + 2.75, bridgeZ);
    signAtlasParts.push(makeSignPlane(2.15, 0.64, 'laiVienKieu', px + (rotY < 0 ? -0.07 : 0.07), bankY + 2.75, bridgeZ, rotY));
  }

  // =================================================================================================
  // SECTION 3: CHÙA CẦU INTERIOR — MIẾU BẮC ĐẾ TRẤN VÕ SANCTUARY (Ref 56, `BD-01..BD-32`!)
  // =================================================================================================
  const shrineZ = bridgeZ - 4.35; // 40.65
  const shrineDeckY = bankY + 0.24 + 1.56; // ~3.15
  const shrinePierH = shrineDeckY + 2.2;
  // Twin flanking shrine foundation piers leaving the center canal passage OPEN beneath Chùa Cầu (`CC-01`!)
  for (const sx of [-2.45, 2.45]) {
    addBox(stoneParts, 1.35, shrinePierH, 6.8, cx + sx, -2.2 + shrinePierH * 0.5, shrineZ - 0.8);
  }
  // Matte rough-sawn aged timber plank floor (`weatheredTimber` UV, ZERO zebra wood! `BD-02`)
  reliefAtlasParts.push(makeReliefBox(6.2, 0.28, 7.0, 'weatheredTimber', cx, shrineDeckY, shrineZ - 0.7));

  // Matte Dark-Weathered Timber Corridor Side Walls & Exposed Overhead Rafters + *Ngói Chiếu* Ceiling (`BD-01..05`)
  for (const side of [-1, 1]) {
    reliefAtlasParts.push(makeReliefBox(0.24, 3.35, 6.8, 'weatheredTimber', cx + side * 2.95, shrineDeckY + 1.68, shrineZ - 0.7));
    // Heavy side frame posts & horizontal rails
    reliefAtlasParts.push(makeReliefBox(0.26, 3.35, 0.24, 'weatheredTimber', cx + side * 2.55, shrineDeckY + 1.68, shrineZ + 1.25));
    // Upper partition beam framing the shrine opening cleanly (`BD-05`)
    reliefAtlasParts.push(makeReliefBox(0.22, 0.24, 6.4, 'weatheredTimber', cx + side * 2.45, shrineDeckY + 3.16, shrineZ - 0.6));
  }
  // Overhead exposed dark-timber crossbeams & parallel rafters + warm terracotta *ngói chiếu* ceiling (ZERO grey tile bleed! `BD-04`)
  const shCeilY = shrineDeckY + 3.24;
  reliefAtlasParts.push(makeReliefPlane(6.2, 7.0, 'ngoiChieu', cx, shCeilY + 0.14, shrineZ - 0.7, 0, Math.PI * 0.5));
  for (let r = 0; r < 11; r++) {
    const rx = cx - 2.6 + (r / 10) * 5.2;
    reliefAtlasParts.push(makeReliefBox(0.09, 0.14, 6.6, 'weatheredTimber', rx, shCeilY + 0.04, shrineZ - 0.7));
  }
  for (const bz of [shrineZ + 1.45, shrineZ + 0.15, shrineZ - 1.45]) {
    reliefAtlasParts.push(makeReliefBox(6.0, 0.22, 0.20, 'weatheredTimber', cx, shCeilY - 0.08, bz));
  }

  // Timber Partition Wall with TWO FLANKING OPEN DOORWAYS into Enclosed Warm Coral-Terracotta Rear Chamber (`BD-14..16`!)
  const partZ = shrineZ - 1.55;
  // Upper lintel transom across full width above the 2 doorways (`y = 2.45..3.30`)
  reliefAtlasParts.push(makeReliefBox(5.9, 0.85, 0.18, 'weatheredTimber', cx, shrineDeckY + 2.86, partZ));
  // Left & Right outer narrow door jamb panels (`x = ±2.58`, leaving clean open doorways at `x ∈ [±1.22, ±2.22]`!)
  for (const side of [-1, 1]) {
    reliefAtlasParts.push(makeReliefBox(0.68, 2.52, 0.18, 'weatheredTimber', cx + side * 2.58, shrineDeckY + 1.26, partZ));
    // Solid wooden doorway threshold & jamb frames
    reliefAtlasParts.push(makeReliefBox(0.12, 2.52, 0.22, 'weatheredTimber', cx + side * 2.24, shrineDeckY + 1.26, partZ));
    reliefAtlasParts.push(makeReliefBox(0.12, 2.52, 0.22, 'weatheredTimber', cx + side * 1.18, shrineDeckY + 1.26, partZ));
    // Outer pillar weathered couplet boards (`浮梁通文萬里程` / `刺蛟得道千年蹟` — `BD-12`!)
    reliefAtlasParts.push(makeReliefBox(0.24, 2.15, 0.06, 'weatheredTimber', cx + side * 2.44, shrineDeckY + 1.54, partZ + 0.26));
    signAtlasParts.push(
      makeSignPlane(0.22, 2.08, side < 0 ? 'bacDeOuterL' : 'bacDeOuterR', cx + side * 2.44, shrineDeckY + 1.54, partZ + 0.30, 0)
    );
    // Low dark-wood side balustrades behind altar ends toward doorways (`BD-19`)
    reliefAtlasParts.push(makeReliefBox(0.95, 0.08, 0.08, 'weatheredTimber', cx + side * 1.68, shrineDeckY + 0.72, partZ + 0.15));
    for (const bxOff of [-0.35, 0, 0.35]) {
      reliefAtlasParts.push(makeReliefBox(0.05, 0.66, 0.05, 'weatheredTimber', cx + side * 1.68 + bxOff, shrineDeckY + 0.38, partZ + 0.15));
    }
  }
  // Enclosed Rear Coral-Terracotta Chamber (`z = partZ .. partZ - 2.35`) with 2 Glowing Pierced Octagonal Ceramic Windows (`BD-15`, `BD-16`!)
  const rearWallZ = partZ - 2.25;
  const rearWallBox = new THREE.BoxGeometry(6.0, 3.35, 0.24);
  rearWallBox.translate(cx, shrineDeckY + 1.68, rearWallZ);
  solidColorParts.push(colorizeGeo(rearWallBox, '#d66d4d')); // exact Ref 56 warm coral-terracotta plaster!
  for (const side of [-1, 1]) {
    const sideCoral = new THREE.BoxGeometry(0.18, 3.35, 2.4);
    sideCoral.translate(cx + side * 2.84, shrineDeckY + 1.68, (partZ + rearWallZ) * 0.5);
    solidColorParts.push(colorizeGeo(sideCoral, '#c86244'));
    // Glowing pierced octagonal ceramic window centered directly on camera sightline through each open doorway (`x = cx ± 2.18`, exact Ref 56 sightline!)
    signAtlasParts.push(makeSignPlane(0.76, 0.76, 'octagonalWindow', cx + side * 2.18, shrineDeckY + 1.62, rearWallZ + 0.14, 0));
  }

  // Carved Antique Dark-Wood *Khám Thờ* Frame, Flared Scrolled Dragon Cornice, 3 Transoms, Inner Couplets & Red-Ochre Mural (`BD-06..13`!)
  const khamZ = partZ + 0.06;
  // Red-ochre painted mountain-landscape timber backboard behind Bắc Đế (`BD-13`!)
  reliefAtlasParts.push(makeReliefBox(2.26, 2.55, 0.14, 'weatheredTimber', cx, shrineDeckY + 1.32, khamZ - 0.55));
  reliefAtlasParts.push(makeReliefPlane(2.02, 2.15, 'bacDeMural', cx, shrineDeckY + 1.56, khamZ - 0.47, 0));
  // Side cabinet jamb walls
  for (const side of [-1, 1]) {
    reliefAtlasParts.push(makeReliefBox(0.16, 2.65, 0.72, 'weatheredTimber', cx + side * 1.12, shrineDeckY + 1.38, khamZ - 0.18));
    // Inner shrine jamb couplets (`明明帝德耀千秋` / `赫赫神威昭萬古` — `BD-11`!)
    signAtlasParts.push(
      makeSignPlane(0.24, 1.58, side < 0 ? 'bacDeInnerL' : 'bacDeInnerR', cx + side * 0.98, shrineDeckY + 1.54, khamZ + 0.20, 0)
    );
  }
  // 3 Pierced Carved Transom Panels: Center = Seal-Script `北帝鎮武` (bottom half of bacDeKhamCarving), Sides & Cornice = Pure Carved Dragon Openwork (top half)!
  const khamDragonUv = [0.25, 0.625, 0.5, 0.75] as const;
  const khamSealUv = [0.25, 0.5, 0.5, 0.625] as const;
  reliefAtlasParts.push(makeReliefBox(2.44, 0.42, 0.18, 'weatheredTimber', cx, shrineDeckY + 2.58, khamZ + 0.16));
  const cPlaque = remapUvRect(new THREE.PlaneGeometry(0.84, 0.34), khamSealUv, 0.003);
  cPlaque.translate(cx, shrineDeckY + 2.58, khamZ + 0.26);
  reliefAtlasParts.push(cPlaque);
  for (const side of [-1, 1]) {
    const sTrans = remapUvRect(new THREE.PlaneGeometry(0.64, 0.34), khamDragonUv, 0.003);
    sTrans.translate(cx + side * 0.80, shrineDeckY + 2.58, khamZ + 0.26);
    reliefAtlasParts.push(sTrans);
  }
  // Flared upward-scrolling carved wooden *Khám Thờ* dragon cornice crest (`BD-07` — pure carved dragon filigree!)
  const kCornSh = new THREE.Shape();
  kCornSh.moveTo(-1.38, 0);
  kCornSh.lineTo(1.38, 0);
  kCornSh.quadraticCurveTo(1.54, 0.26, 1.44, 0.44);
  kCornSh.quadraticCurveTo(0.70, 0.36, 0, 0.48);
  kCornSh.quadraticCurveTo(-0.70, 0.36, -1.44, 0.44);
  kCornSh.quadraticCurveTo(-1.54, 0.26, -1.38, 0);
  kCornSh.closePath();
  const kCornGeo = normalizeExtrudeUv(new THREE.ExtrudeGeometry(kCornSh, { depth: 0.18, bevelEnabled: false, curveSegments: 8 }));
  kCornGeo.translate(cx, shrineDeckY + 2.78, khamZ + 0.10);
  reliefAtlasParts.push(remapUvRect(kCornGeo, khamDragonUv, 0.003));

  // Bespoke Antique Dark-Bronze Bắc Đế Trấn Võ Statue raised clearly above censer lid (exact Ref 56 silhouette! `BD-17`)
  const statY = shrineDeckY + 1.50;
  const statZ = khamZ - 0.16;
  reliefAtlasParts.push(makeReliefBox(0.78, 0.56, 0.56, 'weatheredTimber', cx, shrineDeckY + 1.24, statZ));
  // Seated dark charcoal-bronze martial robes, broad shoulders, topknot crown & long flowing beard
  const bdTorso = new THREE.CylinderGeometry(0.18, 0.27, 0.54, 10);
  bdTorso.translate(cx, statY + 0.36, statZ);
  const bdLap = new THREE.CylinderGeometry(0.28, 0.32, 0.24, 10);
  bdLap.scale(1.15, 1.0, 0.85);
  bdLap.translate(cx, statY + 0.16, statZ + 0.05);
  const bdHead = new THREE.SphereGeometry(0.13, 10, 8);
  bdHead.translate(cx, statY + 0.74, statZ + 0.02);
  const bdCrown = new THREE.CylinderGeometry(0.085, 0.105, 0.11, 8);
  bdCrown.translate(cx, statY + 0.88, statZ + 0.01);
  const bdBeard = new THREE.ConeGeometry(0.05, 0.22, 6);
  bdBeard.rotateX(Math.PI);
  bdBeard.translate(cx, statY + 0.56, statZ + 0.14);
  for (const g of [bdTorso, bdLap, bdHead, bdCrown, bdBeard]) {
    solidColorParts.push(colorizeGeo(g, '#282624'));
  }

  // Dark-Ebonized Open-Legged Altar Table (`BD-18`) + Full Ref 56 Ritual Ensemble (`BD-20..31`)
  const altZ = khamZ + 0.82;
  const altTopY = shrineDeckY + 1.04;
  // Glossy dark-ebonized overhanging tabletop + recessed maroon apron + 4 slim open legs & stretchers
  const altTop = new THREE.BoxGeometry(3.45, 0.09, 1.08);
  altTop.translate(cx, altTopY, altZ);
  solidColorParts.push(colorizeGeo(altTop, '#1c1512'));
  const altApron = new THREE.BoxGeometry(3.05, 0.18, 0.88);
  altApron.translate(cx, altTopY - 0.13, altZ);
  solidColorParts.push(colorizeGeo(altApron, '#4a1816'));
  for (const sx of [-1.48, 1.48]) {
    for (const sz of [-0.42, 0.42]) {
      const leg = new THREE.BoxGeometry(0.10, 1.0, 0.10);
      leg.translate(cx + sx, shrineDeckY + 0.50, altZ + sz);
      solidColorParts.push(colorizeGeo(leg, '#1e1714'));
    }
    const str = new THREE.BoxGeometry(0.08, 0.08, 0.86);
    str.translate(cx + sx, shrineDeckY + 0.26, altZ);
    solidColorParts.push(colorizeGeo(str, '#1e1714'));
  }

  // Centerpiece: Large Bulbous Antique Brass *Đỉnh Đồng* with Graceful Pale-Celadon Dragon-Ear Handles & Nghê Finial (`BD-20`)
  const urnY = altTopY + 0.045;
  const tripod = createBronzeIncenseTripodParts(cx, urnY, altZ + 0.06, 0.50);
  bronzeParts.push(...tripod.bronzeParts, ...tripod.goldParts);
  // Twin iconic pale-celadon carved dragon-ear handles hugging censer shoulders (Ref 56 signature!)
  for (const sx of [-1, 1]) {
    const ear = new THREE.TorusGeometry(0.082, 0.022, 6, 10);
    ear.scale(0.85, 1.25, 0.85);
    ear.translate(cx + sx * 0.23, urnY + 0.44, altZ + 0.06);
    solidColorParts.push(colorizeGeo(ear, '#a6bea8'));
  }

  // Twin Tall Turned-Brass Candlesticks with Tall Red Calligraphy Candles (`BD-21`)
  const candProf = [
    new THREE.Vector2(0.13, 0.0),
    new THREE.Vector2(0.11, 0.08),
    new THREE.Vector2(0.04, 0.18),
    new THREE.Vector2(0.065, 0.30),
    new THREE.Vector2(0.036, 0.44),
    new THREE.Vector2(0.16, 0.48),
    new THREE.Vector2(0.05, 0.50)
  ];
  for (const sx of [-1.30, 1.30]) {
    const cs = new THREE.LatheGeometry(candProf, 10);
    cs.translate(cx + sx, urnY, altZ + 0.14);
    goldParts.push(cs);
    // Tall red ritual candle inside sleeve
    const cdl = new THREE.CylinderGeometry(0.044, 0.046, 0.38, 8);
    cdl.translate(cx + sx, urnY + 0.68, altZ + 0.14);
    solidColorParts.push(colorizeGeo(cdl, '#c82018'));
    const fl = new THREE.ConeGeometry(0.018, 0.06, 5);
    fl.translate(cx + sx, urnY + 0.90, altZ + 0.14);
    coreParts.push(fl);
  }

  // Twin Inward-Facing Dark-Bronze Cranes (`BD-22`), Blue-White Dragon Incense Jar (`BD-23`), Yellow Chrysanthemum Vase (`BD-24`),
  // Dark-Bronze *Chuông Gia Trì* Bell on Straw Cushion (`BD-25`), Lidded *Đài Thờ* & Fruit Pyramid (`BD-26`, `BD-27`)
  addBronzeCrane(bronzeParts, cx - 0.82, urnY, altZ - 0.12, Math.PI * 0.42, 0.72);
  addBronzeCrane(bronzeParts, cx + 0.82, urnY, altZ - 0.12, -Math.PI * 0.42, 0.72);
  addHoiAnPorcelainVase(reliefAtlasParts, solidColorParts, cx - 0.94, urnY, altZ + 0.18, 1.0, 'incense_jar', 5623);
  addHoiAnPorcelainVase(reliefAtlasParts, solidColorParts, cx + 0.56, urnY, altZ - 0.02, 0.88, 'chrysanthemum_vase', 5624);
  // Wide dark-bronze *chuông gia trì* bowl bell on braided golden straw ring (`BD-25`)
  const straw = new THREE.TorusGeometry(0.14, 0.032, 6, 12);
  straw.rotateX(Math.PI * 0.5);
  straw.translate(cx + 0.92, urnY + 0.032, altZ + 0.16);
  solidColorParts.push(colorizeGeo(straw, '#c4a45c'));
  const bellBowl = new THREE.SphereGeometry(0.17, 10, 7, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65);
  bellBowl.translate(cx + 0.92, urnY + 0.19, altZ + 0.16);
  solidColorParts.push(colorizeGeo(bellBowl, '#22201e'));
  // Twin dark-bronze lidded `đài thờ` canisters + red wine cups + left fruit pyramid
  for (const sx of [-0.46, 0.42]) {
    const can = new THREE.CylinderGeometry(0.065, 0.06, 0.20, 8);
    can.translate(cx + sx, urnY + 0.10, altZ + 0.22);
    solidColorParts.push(colorizeGeo(can, '#2a2624'));
    const cup = new THREE.CylinderGeometry(0.026, 0.02, 0.055, 6);
    cup.translate(cx + sx * 0.75, urnY + 0.028, altZ + 0.36);
    solidColorParts.push(colorizeGeo(cup, '#b61e1a'));
  }
  const pomelo = new THREE.SphereGeometry(0.11, 8, 6);
  pomelo.translate(cx - 0.56, urnY + 0.32, altZ - 0.04);
  solidColorParts.push(colorizeGeo(pomelo, '#6ea63c'));
  for (let fi = 0; fi < 4; fi++) {
    const fr = new THREE.SphereGeometry(0.065, 6, 5);
    fr.translate(cx - 0.56 + (fi % 2 === 0 ? -0.07 : 0.07), urnY + 0.14 + Math.floor(fi / 2) * 0.09, altZ + 0.02);
    solidColorParts.push(colorizeGeo(fr, fi % 2 === 0 ? '#e88a22' : '#d63428'));
  }

  // Foreground Square Weathered Terracotta/Stone Incense Basin (`來遠橋` + key-fret rim + ash & pink sticks) & Donation Stool (`BD-28..30`!)
  const basZ = altZ + 1.02;
  // Dark 4-legged wooden stand
  reliefAtlasParts.push(makeReliefBox(0.86, 0.08, 0.62, 'weatheredTimber', cx, shrineDeckY + 0.52, basZ));
  for (const sx of [-0.36, 0.36]) {
    for (const sz of [-0.24, 0.24]) {
      reliefAtlasParts.push(makeReliefBox(0.07, 0.52, 0.07, 'weatheredTimber', cx + sx, shrineDeckY + 0.26, basZ + sz));
    }
  }
  // Tapered square incense basin mapped to `incenseBasin` (`來遠橋` + carved grey key-fret rim!)
  reliefAtlasParts.push(makeReliefBox(0.76, 0.42, 0.52, 'incenseBasin', cx, shrineDeckY + 0.77, basZ));
  const ashPlane = new THREE.PlaneGeometry(0.68, 0.44);
  ashPlane.rotateX(-Math.PI * 0.5);
  ashPlane.translate(cx, shrineDeckY + 0.985, basZ);
  solidColorParts.push(colorizeGeo(ashPlane, '#b8b2a8'));
  for (let sIdx = 0; sIdx < 16; sIdx++) {
    const sx = cx + ((sIdx % 5) - 2) * 0.11 + (sIdx % 2) * 0.03;
    const sz = basZ + (Math.floor(sIdx / 5) - 1.5) * 0.09;
    const st = new THREE.CylinderGeometry(0.004, 0.004, 0.24, 4);
    st.rotateZ(((sIdx % 3) - 1) * 0.08);
    st.translate(sx, shrineDeckY + 1.08, sz);
    solidColorParts.push(colorizeGeo(st, '#d43678'));
  }
  // Foreground wooden donation stool right below basin (`BD-30`)
  const stool = new THREE.BoxGeometry(0.72, 0.36, 0.42);
  stool.translate(cx, shrineDeckY + 0.18, basZ + 0.48);
  solidColorParts.push(colorizeGeo(stool, '#5a2d1e'));

  // Twin Warm Tungsten Hanging Bare-Bulb Sconces on Upper Rafters (`BD-31`, removing altar orbs!)
  for (const sx of [-2.45, 2.45]) {
    addCyl(ironwoodParts, 0.012, 0.012, 0.52, 4, cx + sx, shCeilY - 0.28, partZ + 1.55);
    const bulb = new THREE.SphereGeometry(0.065, 6, 5);
    bulb.translate(cx + sx, shCeilY - 0.56, partZ + 1.55);
    coreParts.push(bulb);
  }
  const shrineLight = new THREE.PointLight('#ffbe6c', 7.2, 11.5, 1.55);
  shrineLight.position.set(cx, shrineDeckY + 2.35, altZ + 0.65);
  group.add(shrineLight);

  // Double-tiered North shrine terracotta roof capping the T-wing over Bắc Đế shrine (mapped to `chuaCauRoof`!)
  addMappedGableRoof(reliefAtlasParts, whitePlasterParts, 'chuaCauRoof', cx, shrineDeckY + 3.28, shrineZ - 0.4, 6.4, 7.2, 2.05, 'x', true);
  const shCrest = createCeramicDragonCrestGeo(3.8, 0.86, 0.15);
  shCrest.translate(cx, shrineDeckY + 5.42, shrineZ - 0.4);
  reliefAtlasParts.push(shCrest);
  // Item 083, 085, 086, 091: Chùa Cầu upturned Đầu Đao eave tips, Hoành Phi & Câu Đối on Bắc Đế shrine, red silk altar drape & Vách Ngăn lattice screen
  addBox(goldParts, 1.85, 0.46, 0.10, cx, shrineDeckY + 2.55, altZ - 0.55);
  for (const sx of [-1.45, 1.45]) {
    addBox(crimsonParts, 0.24, 1.65, 0.08, cx + sx, shrineDeckY + 1.65, altZ - 0.45);
    addBox(whitePlasterParts, 0.35, 0.22, 0.18, cx + sx * 2.2, shrineDeckY + 3.35, shrineZ + 2.8);
  }
  const altarCloth = new THREE.BoxGeometry(2.8, 0.58, 0.08);
  altarCloth.translate(cx, shrineDeckY + 0.72, altZ + 0.56);
  solidColorParts.push(colorizeGeo(altarCloth, '#b81c18'));

  // =================================================================================================
  // SECTION 4: 16 HERITAGE TUBE HOUSES — INCLUDING HERO NHÀ CỔ TẤN KÝ (101) & LANTERN WORKSHOP (Ref 44, 55, 84, 114!)
  // (`TK-01..TK-32`, `HA-01..HA-12`, `HA-24..HA-28`)
  // =================================================================================================
  const tubeRowZs = [11.8, 17.0, 22.2, 27.4, 56.6, 61.8, 67.0, 72.2];
  const houseSpecs: Array<{
    x: number;
    z: number;
    facing: number;
    w: number;
    d: number;
    h: number;
    rowIdx: number;
    isOneStory: boolean;
    role: 'tan_ky' | 'lantern_shop' | 'standard';
  }> = [];
  // Item 102 (Area Expansion): 4 additional heritage shophouses extending North & South (z = 6.6 and z = 77.4)
  for (const extZ of [6.6, 77.4]) {
    houseSpecs.push({ x: 156.8, z: extZ, facing: 1, w: 5.14, d: 8.6, h: 7.35, rowIdx: extZ < 10 ? 0 : 7, isOneStory: false, role: 'standard' });
    houseSpecs.push({ x: 193.2, z: extZ, facing: -1, w: 5.14, d: 8.6, h: 7.25, rowIdx: extZ < 10 ? 0 : 7, isOneStory: false, role: 'standard' });
  }
  for (const [idx, zPos] of tubeRowZs.entries()) {
    const wVar = 5.14;
    const oneStoryW = idx === 1 || idx === 5;
    const oneStoryE = idx === 2 || idx === 6;
    const hVarW = oneStoryW ? 4.45 : 7.35 + ((idx * 3) % 4) * 0.25;
    const hVarE = oneStoryE ? 4.55 : 7.25 + ((idx * 5 + 1) % 4) * 0.25;
    houseSpecs.push({
      x: 156.8,
      z: zPos,
      facing: 1,
      w: wVar,
      d: 8.6,
      h: idx === 3 ? 7.45 : hVarW,
      rowIdx: idx,
      isOneStory: idx === 3 ? false : oneStoryW,
      role: idx === 3 ? 'tan_ky' : 'standard' // Hero Nhà Cổ Tấn Ký (101) at West (156.8, 27.4)!
    });
    houseSpecs.push({
      x: 193.2,
      z: zPos,
      facing: -1,
      w: wVar,
      d: 8.6,
      h: hVarE,
      rowIdx: idx,
      isOneStory: idx === 4 ? false : oneStoryE,
      role: idx === 4 ? 'lantern_shop' : 'standard' // Hero Lantern Workshop (Ref 44) at East (193.2, 56.6)!
    });
  }

  // Concave Curved-Crest Stepped Firewalls (`Tường Hồi Bít Đốc`, `HA-02` — Ref 84! ZERO 90° blocky steps!)
  for (const [bankX, facing] of [
    [156.8, 1],
    [193.2, -1]
  ] as const) {
    for (const blockStart of [0, 4]) {
      const baseZ = tubeRowZs[blockStart] - 2.6;
      for (let fw = 0; fw <= 4; fw++) {
        const fwZ = baseZ + fw * 5.2;
        const gy = ctx.getHeight(bankX, fwZ);
        const topBaseY = gy + 0.35 + 7.25;
        const fwGeo = createCurvedFirewallGeo(9.2, 2.55, 0.24);
        fwGeo.translate(bankX + facing * 0.25, topBaseY, fwZ);
        reliefAtlasParts.push(fwGeo);
        // White lime-plaster crest coping ridge
        addBox(whitePlasterParts, 3.4, 0.16, 0.30, bankX + facing * 0.25, topBaseY + 2.55, fwZ);
      }
    }
  }

  const shopKeys: HoiAnSignKey[] = ['shopSign1', 'shopSign2', 'shopSign3', 'shopSign4'];

  for (const [hsIdx, hs] of houseSpecs.entries()) {
    const gy = ctx.getHeight(hs.x, hs.z);
    const plinthBottom = Math.min(gy, bankY) - 1.1;
    const plinthTop = gy + 0.32;
    const plinthH = plinthTop - plinthBottom;
    const frontX = hs.x + hs.facing * (hs.d * 0.5);
    const rotFace = hs.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

    // Grounded weathered stone curb plinth (`HA-08`, `TK-02`)
    addBox(stoneParts, hs.d + 0.45, plinthH, hs.w + 0.04, hs.x, plinthBottom + plinthH * 0.5, hs.z);

    if (hs.role === 'tan_ky') {
      // =============================================================================================
      // HERO LANDMARK: NHÀ CỔ TẤN KÝ (101 NGUYỄN THÁI HỌC) — FACADE (Ref 55) & WALK-IN SALON (Ref 114)
      // (`TK-01..TK-32`)
      // =============================================================================================
      // Upper 2nd-story wall shell (`y = 3.55..hs.h`) + deep hollow walk-in ground-floor salon (`x = 152.5..161.1`, 100% UNBURIED! `TK-16`)
      reliefAtlasParts.push(makeReliefBox(hs.d, hs.h - 3.55, hs.w - 0.06, 'mustardOchreWall', hs.x, plinthTop + 3.55 + (hs.h - 3.55) * 0.5, hs.z));
      // 2nd-story Ref 55 aged off-white lime plaster facade + dark vertical timber frames + shutters + pierced *ô thoáng* lattices (`TK-11`, `TK-12`)
      addBox(whitePlasterParts, 0.14, 2.75, hs.w - 0.44, frontX + 0.04, plinthTop + 5.25, hs.z);
      for (const sz of [-hs.w * 0.44, -0.78, 0.78, hs.w * 0.44]) {
        reliefAtlasParts.push(makeReliefBox(0.18, 2.80, 0.12, 'weatheredTimber', frontX + 0.08, plinthTop + 5.25, hs.z + sz));
      }
      // Center dark-wood double shutters + flanking pierced geometric *ô thoáng* windows (with knotted red cloth on right!)
      reliefAtlasParts.push(makeReliefBox(0.16, 2.15, 1.38, 'weatheredTimber', frontX + 0.08, plinthTop + 5.18, hs.z));
      for (const side of [-1, 1]) {
        addBox(voidParts, 0.16, 0.88, 0.88, frontX + 0.07, plinthTop + 5.62, hs.z + side * 1.56);
        for (const bar of [-0.22, 0.22]) {
          reliefAtlasParts.push(makeReliefBox(0.18, 0.88, 0.06, 'weatheredTimber', frontX + 0.09, plinthTop + 5.62, hs.z + side * 1.56 + bar));
          reliefAtlasParts.push(makeReliefBox(0.18, 0.06, 0.88, 'weatheredTimber', frontX + 0.09, plinthTop + 5.62 + bar, hs.z + side * 1.56));
        }
      }
      // Knotted red silk cloth draped from right upper lattice (`TK-12`)
      const rCloth = new THREE.ConeGeometry(0.16, 0.58, 4);
      rCloth.rotateZ(0.22);
      rCloth.translate(frontX + 0.16, plinthTop + 5.28, hs.z + 1.56);
      solidColorParts.push(colorizeGeo(rCloth, '#c8341c'));

      // Ground-floor flanking weathered mustard-ochre plaster pilasters + curved right corbel + pale cut-stone column plinths (`TK-02`, `TK-03`)
      for (const side of [-1, 1]) {
        reliefAtlasParts.push(makeReliefBox(0.54, 3.62, 0.46, 'mustardOchreWall', frontX - 0.04, plinthTop + 1.81, hs.z + side * (hs.w * 0.46)));
        addBox(stoneParts, 0.36, 0.22, 0.32, frontX + 0.08, plinthTop + 0.11, hs.z + side * 2.14);
        // Low damp moss-stained masonry wainscot dado beneath plank bays (`TK-03`)
        const dampDado = new THREE.BoxGeometry(0.24, 0.42, 1.58);
        dampDado.translate(frontX + 0.02, plinthTop + 0.21, hs.z + side * 1.48);
        solidColorParts.push(colorizeGeo(dampDado, '#3a422c'));
      }
      // Centered cut-stone entry threshold step (`bậc thềm đá`, `TK-03`)
      addBox(stoneParts, 0.46, 0.16, 1.48, frontX + 0.22, plinthTop + 0.08, hs.z);

      // Full-width blackened horizontal ironwood plank facade (`cửa bàn khoa`, `TK-01`) leaving central 1.38m walk-in doorway!
      for (const side of [-1, 1]) {
        for (let pl = 0; pl < 6; pl++) {
          reliefAtlasParts.push(makeReliefBox(0.16, 0.44, 1.54, 'weatheredTimber', frontX + 0.02, plinthTop + 0.64 + pl * 0.46, hs.z + side * 1.48));
        }
        // Molded doorway jamb posts
        reliefAtlasParts.push(makeReliefBox(0.22, 3.18, 0.14, 'weatheredTimber', frontX + 0.04, plinthTop + 1.59, hs.z + side * 0.72));
        // Double-leaf ironwood entrance doors pivoted inward ajar (`TK-04` — clearly visible from outside AND lets walk-in/camera 04 enter!)
        reliefAtlasParts.push(
          makeReliefBox(0.10, 2.74, 0.64, 'weatheredTimber', frontX - 0.24, plinthTop + 1.40, hs.z + side * 0.56, side * 1.05)
        );
      }
      // Heavy upper timber lintel & recessed transom panels (`ván đố`, `TK-01`)
      reliefAtlasParts.push(makeReliefBox(0.26, 0.42, hs.w - 0.40, 'weatheredTimber', frontX + 0.04, plinthTop + 3.24, hs.z));

      // Mossy Low-Slope *Ngói Âm Dương* Awning Overhang directly above lintel (`TK-05`!)
      const awn = remapRelief(new THREE.BoxGeometry(0.95, 0.14, hs.w - 0.08), 'mossyYinYangRoof');
      awn.rotateZ(-0.28);
      awn.translate(frontX + 0.44, plinthTop + 3.58, hs.z);
      reliefAtlasParts.push(awn);

      // Illuminated `"記 進 / TẤN KÝ"` Signboard (`TK-06`), Carved Spiral *Mắt Cửa* + Pleated Orange-Scarlet Silk (`TK-07`),
      // Green-Gold `"101"` Plate (`TK-08`) & Dragon-Crested `"Nhà cổ TẤN KÝ"` Heritage Board (`TK-09`)!
      addBox(whitePlasterParts, 0.10, 0.58, 1.24, frontX + 0.18, plinthTop + 3.04, hs.z);
      signAtlasParts.push(makeSignPlane(1.18, 0.52, 'tanKySign', frontX + 0.24, plinthTop + 3.04, hs.z, Math.PI * 0.5));
      for (const side of [-1, 1]) {
        const mc = remapRelief(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 8), 'matCuaSpiral');
        mc.rotateZ(Math.PI * 0.5);
        mc.translate(frontX + 0.18, plinthTop + 2.68, hs.z + side * 0.36);
        reliefAtlasParts.push(mc);
        // Naturally folded pleated orange-scarlet silk cloth draping beneath each Door Eye (`TK-07`)
        for (const fold of [-0.05, 0.0, 0.05]) {
          const drape = new THREE.ConeGeometry(0.13, 0.62, 4);
          drape.rotateZ(0.08);
          drape.scale(0.45, 1.0, 1.0);
          drape.translate(frontX + 0.22, plinthTop + 2.34, hs.z + side * 0.36 + fold);
          solidColorParts.push(colorizeGeo(drape, fold === 0 ? '#d8461c' : '#be3414'));
        }
      }
      // Green-gold `"101"` house number plate (`TK-08`) on camera-LEFT (+Z) door jamb matching Ref 55!
      signAtlasParts.push(makeSignPlane(0.24, 0.20, 'house101', frontX + 0.17, plinthTop + 2.52, hs.z + 0.74, Math.PI * 0.5));
      // Dragon-crested mahogany `"Nhà cổ TẤN KÝ"` heritage board on camera-LEFT (+Z) plank bay (`TK-09`, exact Ref 55!)
      reliefAtlasParts.push(makeReliefBox(0.10, 1.18, 0.94, 'weatheredTimber', frontX + 0.14, plinthTop + 1.66, hs.z + 1.44));
      signAtlasParts.push(makeSignPlane(0.86, 1.10, 'tanKyHeritageBoard', frontX + 0.20, plinthTop + 1.66, hs.z + 1.44, Math.PI * 0.5));
      // Sculpted dark-wood dragon-and-cloud crest crowning the heritage board (pure carved dragon scrollwork, NO seal script!)
      const hbCrest = createCeramicDragonCrestGeo(1.38, 0.42, 0.10);
      hbCrest.rotateY(Math.PI * 0.5);
      hbCrest.translate(frontX + 0.16, plinthTop + 2.24, hs.z + 1.44);
      reliefAtlasParts.push(remapUvRect(hbCrest, [0.25, 0.625, 0.5, 0.75], 0.003));

      // Twin Glowing Hexagonal Carved-Wood Hội An Palace Lanterns flanking the doorway (`TK-10`, `TK-12`!)
      for (const [lxOff, lyOff, lzOff] of [
        [0.42, 2.94, -1.44],
        [0.42, 2.74, 1.48],
        [0.36, 6.20, 0.52]
      ] as const) {
        const lx = frontX + lxOff;
        const ly = plinthTop + lyOff;
        const lz = hs.z + lzOff;
        addCyl(ironwoodParts, 0.015, 0.015, 0.42, 4, lx, ly + 0.36, lz);
        // Hexagonal wood frame + glowing golden calligraphic silk faces (`palaceLanternFace`)
        addCyl(ironwoodParts, 0.24, 0.18, 0.06, 6, lx, ly + 0.24, lz);
        addCyl(ironwoodParts, 0.16, 0.22, 0.06, 6, lx, ly - 0.24, lz);
        const body = remapUvRect(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 6), HOI_AN_SIGN_UV.palaceLanternFace, 0.003);
        body.translate(lx, ly, lz);
        signAtlasParts.push(body);
        addCone(goldParts, 0.026, 0.24, 5, lx, ly - 0.38, lz);
      }

      // ---- WALK-IN NHÀ CỔ TẤN KÝ HERITAGE SALON INTERIOR (Ref 114, `TK-14..TK-32`, x = 152.5..161.0!) ----
      // Reddish-brown square *gạch tàu* floor (`TK-15`), aged dark-brown vertical timber plank walls (`TK-14`) & ceiling beams
      reliefAtlasParts.push(makeReliefPlane(8.4, hs.w - 0.18, 'gachTauFloor', hs.x, plinthTop + 0.02, hs.z, 0, -Math.PI * 0.5));
      reliefAtlasParts.push(makeReliefPlane(8.4, hs.w - 0.18, 'weatheredTimber', hs.x, plinthTop + 3.48, hs.z, 0, Math.PI * 0.5));
      // Left & Right side interior timber walls
      for (const side of [-1, 1]) {
        reliefAtlasParts.push(makeReliefBox(8.4, 3.55, 0.16, 'weatheredTimber', hs.x, plinthTop + 1.78, hs.z + side * (hs.w * 0.48)));
      }
      // Rear salon partition wall (`x = 154.9`) leaving an OPEN CAMERA-RIGHT (-Z) DOORWAY (`z ∈ [hs.z - 2.35, hs.z - 1.05]`) into amber *Thiên Tỉnh* courtyard (exact Ref 114 left-to-right composition! `TK-28`, `TK-29`!)
      const rearPartX = 154.9;
      reliefAtlasParts.push(makeReliefBox(0.18, 3.55, 3.45, 'weatheredTimber', rearPartX, plinthTop + 1.78, hs.z + 0.70));
      reliefAtlasParts.push(makeReliefBox(0.18, 0.85, 1.55, 'weatheredTimber', rearPartX, plinthTop + 3.12, hs.z - 1.68));
      // Softly gathered cream-yellow floral drapery swag tucked neatly along the doorway jamb (ZERO giant tilted slab blocking couplet! `TK-28`)
      for (let dIdx = 0; dIdx < 3; dIdx++) {
        const pleat = new THREE.CylinderGeometry(0.055, 0.085, 2.38, 6);
        pleat.rotateX(-0.08);
        pleat.translate(rearPartX + 0.13, plinthTop + 1.58, hs.z - 1.16 - dIdx * 0.09);
        solidColorParts.push(colorizeGeo(pleat, dIdx % 2 === 0 ? '#dcd69c' : '#c6be80'));
      }
      // Recessed Amber-Lit Inner *Thiên Tỉnh* Courtyard (`x = 152.6..154.9`) glimpsed on camera-RIGHT (-Z) (`TK-29`)
      // + Item 093, 094, 095, 096: Giếng Trời stone drainage basin & mossy rockery, Chồng Rường ceiling tie-beams, antique porcelain cabinet & flood-level marker!
      reliefAtlasParts.push(makeReliefBox(0.20, 3.55, hs.w - 0.10, 'weatheredTimber', 152.65, plinthTop + 1.78, hs.z));
      reliefAtlasParts.push(makeReliefBox(0.68, 0.82, 1.65, 'tanKyNacre', 153.25, plinthTop + 0.41, hs.z - 1.58));
      addBox(stoneParts, 1.15, 0.24, 1.35, 153.85, plinthTop + 0.12, hs.z + 1.15);
      addBox(ironwoodParts, 0.42, 1.85, 1.15, 154.65, plinthTop + 0.92, hs.z - 1.95);
      addBox(goldParts, 0.18, 0.14, 0.04, 159.26, plinthTop + 1.68, hs.z - 1.95);
      for (const bxBeam of [156.2, 159.4]) {
        addBox(ironwoodParts, 0.20, 0.22, 4.4, bxBeam, plinthTop + 3.42, hs.z);
      }
      const ttLamp = remapUvRect(new THREE.BoxGeometry(0.32, 0.48, 0.32), HOI_AN_SIGN_UV.palaceLanternFace, 0.003);
      ttLamp.translate(153.28, plinthTop + 1.06, hs.z - 1.34);
      signAtlasParts.push(ttLamp);
      const ttMed = remapRelief(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12), 'tanKySilkScreen');
      ttMed.rotateZ(Math.PI * 0.5);
      ttMed.translate(153.28, plinthTop + 1.18, hs.z - 1.88);
      reliefAtlasParts.push(ttMed);

      // Polished Dark Ironwood Round Columns (`Cột Tròn Gỗ Lim`) on Cut-Stone Bases (`TK-17`)
      for (const [colX, colZ] of [
        [159.4, hs.z - 1.95],
        [159.4, hs.z + 1.95],
        [156.2, hs.z - 1.95],
        [156.2, hs.z + 1.95]
      ]) {
        addCyl(ironwoodParts, 0.14, 0.155, 3.32, 10, colX, plinthTop + 1.78, colZ);
        addCyl(stoneParts, 0.21, 0.24, 0.18, 8, colX, plinthTop + 0.09, colZ);
      }

      // Sculpted Cabriole-Leg Mother-of-Pearl Inlaid (*Khảm Xà Cừ*) Curved Settee (*Trường Kỷ*), Oval Tea Table, Armchairs & Stools (`TK-18..21`, `TK-30`!)
      const salX = 156.0;
      const salZ = hs.z - 0.12;
      // 1. Curved *Trường Kỷ* Settee facing East (`+X`) against rear timber wall (`x = 155.65`)
      reliefAtlasParts.push(makeReliefBox(0.68, 0.12, 1.72, 'tanKyNacre', salX - 0.32, plinthTop + 0.46, salZ));
      reliefAtlasParts.push(makeReliefBox(0.12, 0.76, 1.76, 'tanKyNacre', salX - 0.62, plinthTop + 0.87, salZ));
      // Lobed carved crest rail atop settee
      const setCrest = createCeramicDragonCrestGeo(1.76, 0.32, 0.10);
      setCrest.rotateY(Math.PI * 0.5);
      setCrest.translate(salX - 0.62, plinthTop + 1.24, salZ);
      reliefAtlasParts.push(remapRelief(setCrest, 'tanKyNacre'));
      for (const sz of [-0.78, 0.78]) {
        reliefAtlasParts.push(makeReliefBox(0.62, 0.32, 0.09, 'tanKyNacre', salX - 0.32, plinthTop + 0.66, salZ + sz));
        for (const sx of [-0.28, 0.28]) {
          addCyl(ironwoodParts, 0.036, 0.026, 0.46, 6, salX - 0.32 + sx, plinthTop + 0.23, salZ + sz);
        }
      }
      // 2. Serpentine Oval Mother-of-Pearl Center Tea Table (`Bàn Trà Khảm Xà Cừ`, `x = 156.95`, `TK-19`)
      const tblTop = remapRelief(new THREE.CylinderGeometry(0.62, 0.58, 0.09, 14), 'tanKyNacre');
      tblTop.scale(0.86, 1.0, 1.38);
      tblTop.translate(salX + 0.92, plinthTop + 0.74, salZ + 0.24);
      reliefAtlasParts.push(tblTop);
      for (const [lx, lz] of [[-0.36, -0.58], [0.36, -0.58], [-0.36, 0.58], [0.36, 0.58]]) {
        addCyl(ironwoodParts, 0.036, 0.024, 0.72, 6, salX + 0.92 + lx, plinthTop + 0.36, salZ + 0.24 + lz);
      }
      // Yellow bilingual `"Weak chairs. Please don't be seated / Ghế yếu. Xin đừng ngồi."` tabletop placard (`TK-30`)
      signAtlasParts.push(makeSignPlane(0.40, 0.20, 'weakChairs', salX + 1.38, plinthTop + 0.84, salZ - 0.14, Math.PI * 0.56, -0.18));
      // 3. Matching Carved Mother-of-Pearl Armchairs (`Ghế Bành`, `TK-20`) flanking North & South + Yellow Conservation Ribbon (`TK-30`)
      for (const [ax, az, aRot] of [
        [salX + 0.05, salZ + 1.36, -0.38],
        [salX + 0.25, salZ - 1.32, 0.45]
      ]) {
        reliefAtlasParts.push(makeReliefBox(0.64, 0.10, 0.66, 'tanKyNacre', ax, plinthTop + 0.46, az, aRot));
        reliefAtlasParts.push(makeReliefBox(0.10, 0.72, 0.66, 'tanKyNacre', ax - Math.cos(aRot) * 0.28, plinthTop + 0.84, az + Math.sin(aRot) * 0.28, aRot));
        for (const ox of [-0.26, 0.26]) {
          for (const oz of [-0.26, 0.26]) {
            addCyl(ironwoodParts, 0.03, 0.022, 0.46, 5, ax + ox, plinthTop + 0.23, az + oz);
          }
        }
      }
      // Delicate yellow silk conservation ribbon stretched across settee & armchairs (`TK-30`)
      const rib = new THREE.BoxGeometry(0.018, 0.022, 2.95);
      rib.translate(salX + 0.12, plinthTop + 0.76, salZ - 0.08);
      solidColorParts.push(colorizeGeo(rib, '#e8ce2c'));
      // 4. Inlaid Cabriole Side Stool (`Đôn`) + Black Lacquered Round Visitor Stools (`TK-21`)
      reliefAtlasParts.push(makeReliefBox(0.46, 0.08, 0.46, 'tanKyNacre', salX + 1.28, plinthTop + 0.56, salZ - 0.48));
      for (const ox of [-0.18, 0.18]) {
        for (const oz of [-0.18, 0.18]) {
          addCyl(ironwoodParts, 0.025, 0.018, 0.54, 5, salX + 1.28 + ox, plinthTop + 0.27, salZ - 0.48 + oz);
        }
      }
      for (const [sx, sz] of [[salX + 0.35, salZ - 0.65], [salX + 0.78, salZ - 1.05]]) {
        const sTop = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10);
        sTop.translate(sx, plinthTop + 0.42, sz);
        solidColorParts.push(colorizeGeo(sTop, '#181412'));
        addCyl(ironwoodParts, 0.02, 0.02, 0.42, 4, sx - 0.10, plinthTop + 0.21, sz - 0.10);
        addCyl(ironwoodParts, 0.02, 0.02, 0.42, 4, sx + 0.10, plinthTop + 0.21, sz + 0.10);
      }

      // Tall Blue-and-White Dragon Lidded Porcelain *Chóe Gốm* Urn (`TK-22`), Yellow Chrysanthemum Vase (`TK-23`),
      // Two-Panel Celadon Silk Mountain Screen (`TK-24`), Couplets (`TK-25`, `TK-26`) & Framed Heritage Certificates (`TK-27`) — EXACT Ref 114 Left-to-Right!
      addCyl(stoneParts, 0.22, 0.26, 0.62, 10, rearPartX + 0.44, plinthTop + 0.31, salZ + 0.88);
      addHoiAnPorcelainVase(reliefAtlasParts, solidColorParts, rearPartX + 0.44, plinthTop + 0.62, salZ + 0.88, 1.15, 'lidded_urn', 1142);
      // White porcelain vase bursting with bright yellow chrysanthemums on carved stand (camera-LEFT +Z, `TK-23`)
      reliefAtlasParts.push(makeReliefBox(0.42, 0.74, 0.42, 'weatheredTimber', rearPartX + 0.68, plinthTop + 0.37, salZ + 1.72));
      addHoiAnPorcelainVase(reliefAtlasParts, solidColorParts, rearPartX + 0.68, plinthTop + 0.74, salZ + 1.72, 1.05, 'chrysanthemum_vase', 1143);
      // Two-panel celadon mountain-landscape silk screen (`Bình Phong`, camera-LEFT +Z, `TK-24`)
      reliefAtlasParts.push(makeReliefPlane(1.08, 1.68, 'tanKySilkScreen', rearPartX + 0.14, plinthTop + 1.62, salZ + 1.56, Math.PI * 0.5));
      // Vertical mother-of-pearl bamboo *Câu Đối* (`TK-25`), crimson-gold `"與貴是人之所欲"` couplet (`TK-26` camera-RIGHT) & framed bilingual certificates (`TK-27`)
      signAtlasParts.push(
        makeSignPlane(0.28, 1.78, 'tanKyCoupletNacre', rearPartX + 0.14, plinthTop + 1.82, salZ + 0.58, Math.PI * 0.5),
        makeSignPlane(0.28, 1.78, 'tanKyCoupletRed', rearPartX + 0.14, plinthTop + 1.82, salZ - 0.76, Math.PI * 0.5),
        makeSignPlane(0.68, 0.78, 'tanKyCerts', rearPartX + 0.14, plinthTop + 1.86, salZ - 0.08, Math.PI * 0.5),
        makeSignPlane(0.62, 0.42, 'tanKyCerts', rearPartX + 0.16, plinthTop + 2.66, salZ - 0.08, Math.PI * 0.5, 0.22)
      );
      // Warm interior salon & *Thiên Tỉnh* lighting (`TK-32`)
      const tkLight = new THREE.PointLight('#ffd288', 6.5, 10.5, 1.6);
      tkLight.position.set(157.8, plinthTop + 2.75, hs.z + 0.2);
      group.add(tkLight);
    } else if (hs.role === 'lantern_shop') {
      // =============================================================================================
      // HERO OPEN-FRONT SILK LANTERN WORKSHOP (Ref 44, East Bank `193.2, 56.6` — `HA-24..HA-28`)
      // =============================================================================================
      reliefAtlasParts.push(makeReliefBox(hs.d, hs.h - 3.35, hs.w - 0.06, 'mustardOchreWall', hs.x, plinthTop + 3.35 + (hs.h - 3.35) * 0.5, hs.z));
      // Deep warm-black recessed workshop interior (`HA-27`)
      addBox(voidParts, hs.d - 0.4, 3.35, hs.w - 0.35, hs.x - hs.facing * 0.2, plinthTop + 1.68, hs.z);
      for (const side of [-1, 1]) {
        reliefAtlasParts.push(makeReliefBox(0.45, 3.40, 0.36, 'mustardOchreWall', frontX, plinthTop + 1.70, hs.z + side * (hs.w * 0.46)));
      }
      reliefAtlasParts.push(makeReliefBox(0.28, 0.36, hs.w - 0.10, 'weatheredTimber', frontX, plinthTop + 3.18, hs.z));
      signAtlasParts.push(makeSignPlane(2.25, 0.62, 'shopSign1', frontX + hs.facing * 0.20, plinthTop + 3.48, hs.z, rotFace));

      // Subtle cool indigo-cyan upper ceiling accent strip behind foreground warm lanterns (exact Ref 44 color contrast!)
      const coveStrip = new THREE.PlaneGeometry(hs.w - 0.6, 0.48);
      coveStrip.rotateY(rotFace);
      coveStrip.translate(frontX - hs.facing * 1.85, plinthTop + 2.98, hs.z);
      solidColorParts.push(colorizeGeo(coveStrip, '#1462b8'));

      // Foreground timber counter displaying glowing crimson, amber, cobalt & ivory conical/lotus table lamps (`HA-28`)
      reliefAtlasParts.push(makeReliefBox(0.76, 0.72, hs.w - 0.75, 'weatheredTimber', frontX - hs.facing * 0.65, plinthTop + 0.36, hs.z));
      const lampCols = ['#d82218', '#f6a418', '#1b5ec8', '#f8f2d8', '#e64c1c'];
      for (let li = 0; li < 5; li++) {
        const lz = hs.z - 1.55 + li * 0.76;
        const lampCone = new THREE.ConeGeometry(0.14, 0.42, 8);
        lampCone.translate(frontX - hs.facing * 0.60, plinthTop + 0.94, lz);
        lanternParts.push(colorizeGeo(lampCone, lampCols[li]));
      }
      // Tall 4-tier circular rotating rack packed with glowing miniature jewel lanterns (`HA-28`)
      const rackX = frontX - hs.facing * 1.65;
      addCyl(ironwoodParts, 0.035, 0.045, 2.35, 6, rackX, plinthTop + 1.18, hs.z);
      for (let tier = 0; tier < 3; tier++) {
        const ty = plinthTop + 1.12 + tier * 0.56;
        const tr = 0.58 - tier * 0.12;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + tier * 0.6;
          addHoiAnLantern(rackX + Math.cos(a) * tr, ty, hs.z + Math.sin(a) * tr, 0.10, 0.22, lanternPalette[(tier * 3 + k) % lanternPalette.length], tier + k, k % 2 === 0);
        }
      }
      // Two rich upper rows of multi-silhouette silk lanterns across the shop opening (Ref 44!)
      for (let k = -2; k <= 2; k++) {
        addHoiAnLantern(frontX - hs.facing * 0.35, plinthTop + 2.58, hs.z + k * 0.84, 0.20, 0.46, lanternPalette[(k + 6) % lanternPalette.length], k + 2, k % 2 === 0);
      }
      // Item 100: Extra outdoor hanging silk lantern display rack spilling onto shopfront
      addHoiAnLantern(frontX + hs.facing * 0.72, plinthTop + 2.35, hs.z - 1.25, 0.22, 0.52, '#f2b62a', 0, true);
      addHoiAnLantern(frontX + hs.facing * 0.72, plinthTop + 2.35, hs.z + 1.25, 0.22, 0.52, '#cc2018', 2, false);
    } else {
      // =============================================================================================
      // STANDARD WEATHERED MUSTARD-OCHRE HỘI AN TUBE HOUSES (Ref 84 — `HA-01..HA-07`)
      // =============================================================================================
      reliefAtlasParts.push(makeReliefBox(hs.d, hs.h, hs.w - 0.06, 'mustardOchreWall', hs.x, plinthTop + hs.h * 0.5, hs.z));
      // Ground-floor dark-timber lintel + recessed *cửa bàn khoa* horizontal planks + central double doors (`HA-05`)
      reliefAtlasParts.push(makeReliefBox(0.24, 0.34, hs.w * 0.88, 'weatheredTimber', frontX + hs.facing * 0.05, plinthTop + 3.16, hs.z));
      for (const side of [-1, 1]) {
        const panelZ = hs.z + side * (hs.w * 0.27);
        for (let pl = 0; pl < 5; pl++) {
          reliefAtlasParts.push(makeReliefBox(0.14, 0.54, hs.w * 0.25, 'weatheredTimber', frontX + hs.facing * 0.08, plinthTop + 0.32 + pl * 0.57, panelZ));
        }
        reliefAtlasParts.push(makeReliefBox(0.14, 2.94, hs.w * 0.13, 'weatheredTimber', frontX + hs.facing * 0.06, plinthTop + 1.48, hs.z + side * (hs.w * 0.07)));
      }
      // Carved *Mắt Cửa* + scarlet silk drapes on every heritage tube house!
      for (const tz of [-0.52, 0.52]) {
        const mc = remapRelief(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), 'matCuaSpiral');
        mc.rotateZ(Math.PI * 0.5);
        mc.translate(frontX + hs.facing * 0.18, plinthTop + 3.14, hs.z + tz);
        reliefAtlasParts.push(mc);
        const dr = new THREE.ConeGeometry(0.08, 0.32, 4);
        dr.translate(frontX + hs.facing * 0.19, plinthTop + 2.92, hs.z + tz);
        solidColorParts.push(colorizeGeo(dr, '#c8341c'));
      }
      if (hsIdx % 3 === 0) {
        signAtlasParts.push(
          makeSignPlane(2.15, 0.56, shopKeys[(hsIdx / 3) % shopKeys.length], frontX + hs.facing * 0.22, plinthTop + 3.48, hs.z, rotFace)
        );
      }
      // Item 097, 099, 101, 105, 106, 107: Hanging vertical Hán-Nôm shop signboards, cascading Bougainvillea trellises on 6 shophouses,
      // Nhà Cổ Phùng Hưng dark-timber merchant cornice on East bank (193.2, 27.4), and terracotta Âm Dương eave-end roundels
      if (hsIdx % 2 === 0) {
        addBox(crimsonParts, 0.36, 1.35, 0.08, frontX + hs.facing * 0.85, plinthTop + 2.55, hs.z + hs.w * 0.42);
      }
      if (hsIdx % 3 === 1) {
        addOrganicBougainvillea(ironwoodParts, foliageCardParts, frontX + hs.facing * 0.35, plinthTop + 0.15, hs.z - hs.w * 0.42, 1, 0.85, 3100 + hsIdx);
      }
      if (hs.x > 190 && Math.abs(hs.z - 27.4) < 1.0) {
        reliefAtlasParts.push(makeReliefBox(0.32, 0.42, hs.w - 0.1, 'weatheredTimber', frontX - 0.18, plinthTop + 6.85, hs.z));
      }
      for (let ez = -2; ez <= 2; ez++) {
        addCyl(whitePlasterParts, 0.07, 0.07, 0.12, 6, frontX + hs.facing * 0.32, plinthTop + hs.h - 0.08, hs.z + ez * 0.95, 0, 0, Math.PI * 0.5);
      }
    }

    // 2nd-Story Recessed Dark-Timber Loggias & *Con Tiện* Balustrades OR 1-Story Mossy Awning (`HA-03`, `HA-04`)
    if (!hs.isOneStory && hs.role !== 'tan_ky') {
      const balcX = frontX + hs.facing * 1.18;
      reliefAtlasParts.push(makeReliefBox(1.32, 0.18, hs.w - 0.04, 'weatheredTimber', frontX + hs.facing * 0.64, plinthTop + 3.80, hs.z));
      ironwoodParts.push(
        ...createPiercedBalustradeParts(balcX, hs.z - hs.w * 0.46, balcX, hs.z + hs.w * 0.46, plinthTop + 3.89, 0.88, 'con_tien')
      );
      for (const pz of [-hs.w * 0.44, hs.w * 0.44]) {
        addCyl(ironwoodParts, 0.10, 0.12, 3.95, 7, frontX + hs.facing * 1.16, plinthTop + 1.825, hs.z + pz);
      }
      // White-molded louvered shuttered upper windows + angled rain hood (`mái hắt`, `HA-04`, Ref 84!)
      for (const wz of [-hs.w * 0.22, hs.w * 0.22]) {
        addBox(whitePlasterParts, 0.14, 2.08, 1.12, frontX + hs.facing * 0.02, plinthTop + 5.26, hs.z + wz);
        addBox(whitePlasterParts, 0.28, 0.12, 1.24, frontX + hs.facing * 0.10, plinthTop + 6.32, hs.z + wz);
        addBox(voidParts, 0.16, 1.88, 0.88, frontX + hs.facing * 0.05, plinthTop + 5.26, hs.z + wz);
        for (const sw of [-0.52, 0.52]) {
          reliefAtlasParts.push(makeReliefBox(0.18, 1.92, 0.26, 'weatheredTimber', frontX + hs.facing * 0.12, plinthTop + 5.26, hs.z + wz + sw));
        }
      }
    } else if (hs.isOneStory) {
      const awn = remapRelief(new THREE.BoxGeometry(1.75, 0.14, hs.w - 0.04), 'mossyYinYangRoof');
      awn.rotateZ(hs.facing > 0 ? -0.28 : 0.28);
      awn.translate(frontX + hs.facing * 0.84, plinthTop + 3.68, hs.z);
      reliefAtlasParts.push(awn);
      for (const pz of [-hs.w * 0.42, hs.w * 0.42]) {
        addCyl(ironwoodParts, 0.095, 0.115, 3.62, 6, frontX + hs.facing * 1.50, plinthTop + 1.71, hs.z + pz);
        addCyl(stoneParts, 0.16, 0.19, 0.18, 6, frontX + hs.facing * 1.50, plinthTop + 0.09, hs.z + pz);
      }
    }

    // Authentic Mossy Aged *Ngói Âm Dương* 2-Slope Roof with Lime-Plaster Ridge (`HA-06`)
    addMappedGableRoof(reliefAtlasParts, whitePlasterParts, 'mossyYinYangRoof', hs.x + hs.facing * 0.35, plinthTop + hs.h - 0.05, hs.z, hs.w - 0.04, hs.d + 2.4, 2.25, 'z', true);

    // Flanking Entrance Ribbed Silk Lanterns (skipping Nhà Cổ Tấn Ký which has its authentic hexagonal palace lanterns!)
    if (hs.role !== 'tan_ky') {
      for (const ltz of [-hs.w * 0.35, hs.w * 0.35]) {
        const lantX = frontX + hs.facing * 1.18;
        const lantY = plinthTop + 3.36;
        addCyl(ironwoodParts, 0.018, 0.018, 0.36, 4, lantX, lantY + 0.36, hs.z + ltz);
        addHoiAnLantern(lantX, lantY, hs.z + ltz, 0.20, 0.50, lanternPalette[(hsIdx * 2 + (ltz > 0 ? 1 : 0)) % lanternPalette.length], hsIdx + (ltz > 0 ? 1 : 0), ltz > 0);
      }
      // Organic Cascading Alpha-Tested Bougainvillea Vines (`HA-07` — ZERO blocky icosahedra!)
      if (hsIdx % 2 === 0) {
        addOrganicBougainvillea(ironwoodParts, foliageCardParts, frontX + hs.facing * 1.15, plinthTop + 4.05, hs.z, hs.facing, hs.w, 77000 + hsIdx * 191);
      }
    }
  }

  // =================================================================================================
  // SECTION 5: NEW LANDMARK — TAM QUAN HỘI QUÁN PHÚC KIẾN (福建會館 / 金山寺, Ref 115 — `HA-13..HA-23`)
  // Placed proudly at South-West Heritage Square (`x = 156.2, z = 87.2`, cleanly separated south of shophouse at z = 77.4!)
  // =================================================================================================
  const pkX = 156.2;
  const pkZ = 87.2;
  const pkY = ctx.getHeight(pkX, pkZ);
  const pkBaseY = pkY + 0.58;
  // Pink-stone forecourt steps + central carved stone dragon ramp (`bậc rồng`, `HA-20`!)
  for (let st = 0; st < 4; st++) {
    const stBox = new THREE.BoxGeometry(0.45, 0.16, 10.6);
    stBox.translate(pkX + 4.45 - st * 0.42, pkY + 0.08 + st * 0.14, pkZ);
    solidColorParts.push(colorizeGeo(stBox, '#b68a8c'));
  }
  const dragRamp = remapRelief(new THREE.BoxGeometry(1.95, 0.16, 1.55), 'matCuaSpiral');
  dragRamp.rotateZ(0.32);
  dragRamp.translate(pkX + 3.82, pkY + 0.34, pkZ);
  reliefAtlasParts.push(dragRamp);
  addBox(stoneParts, 5.2, 0.62, 11.2, pkX + 0.6, pkY + 0.27, pkZ);

  // Rose-Pink Masonry Brick Triple-Arch Tam Quan Wall (`phucKienBrick` UV normalized cleanly -> crisp horizontal brick courses! `HA-13`)
  const mainArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(4.2, 4.15, 0.88, 2.35, 3.15)), 'phucKienBrick');
  mainArch.rotateY(Math.PI * 0.5);
  mainArch.translate(pkX + 0.6, pkBaseY, pkZ);
  reliefAtlasParts.push(mainArch);
  for (const side of [-1, 1]) {
    const sArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(2.85, 3.65, 0.78, 1.38, 2.58)), 'phucKienBrick');
    sArch.rotateY(Math.PI * 0.5);
    sArch.translate(pkX + 0.6, pkBaseY, pkZ + side * 3.50);
    reliefAtlasParts.push(sArch);
    // Flanking octagonal *Thọ* openwork side windows (`HA-15`)
    signAtlasParts.push(makeSignPlane(0.68, 1.15, 'octagonalWindow', pkX + 1.02, pkBaseY + 1.95, pkZ + side * 4.55, Math.PI * 0.5));
    // Ornate white filigree arch spandrel trim + rich matte crimson inner doors (`HA-14`)
    const sRing = new THREE.TorusGeometry(0.68, 0.06, 5, 10, Math.PI);
    sRing.rotateY(Math.PI * 0.5);
    sRing.translate(pkX + 1.02, pkBaseY + 1.90, pkZ + side * 3.50);
    whitePlasterParts.push(sRing);
    const sDoor = new THREE.BoxGeometry(0.10, 2.15, 1.24);
    sDoor.translate(pkX + 0.55, pkBaseY + 1.08, pkZ + side * 3.50);
    solidColorParts.push(colorizeGeo(sDoor, '#9a1612'));
  }
  const mRing = new THREE.TorusGeometry(1.16, 0.08, 6, 12, Math.PI);
  mRing.rotateY(Math.PI * 0.5);
  mRing.translate(pkX + 1.06, pkBaseY + 2.02, pkZ);
  whitePlasterParts.push(mRing);
  const mDoor = new THREE.BoxGeometry(0.10, 2.65, 2.18);
  mDoor.translate(pkX + 0.52, pkBaseY + 1.32, pkZ);
  solidColorParts.push(colorizeGeo(mDoor, '#9a1612'));
  addBox(goldParts, 0.14, 0.68, 0.68, pkX + 0.54, pkBaseY + 1.65, pkZ);

  // Yellow-Gold `"館 會 建 福"` Dragon Plaque Draped with Matte Crimson Silk Ribbon (`HA-18`)
  addBox(goldParts, 0.14, 0.96, 2.75, pkX + 1.12, pkBaseY + 3.45, pkZ);
  signAtlasParts.push(makeSignPlane(2.62, 0.84, 'phucKienMain', pkX + 1.20, pkBaseY + 3.45, pkZ, Math.PI * 0.5));
  for (const side of [-1, 1]) {
    const sw = new THREE.BoxGeometry(0.08, 2.15, 0.16);
    sw.rotateX(side * 0.42);
    sw.translate(pkX + 1.24, pkBaseY + 3.05, pkZ + side * 1.48);
    solidColorParts.push(colorizeGeo(sw, '#c61814'));
  }

  // Sweeping Emerald-Jade Glazed Tube-Tile Lower Roof (`shared.jadeRoof`) + Crimson/Gold Eave Brackets (`HA-16`, `HA-17`)
  const pkFrieze = new THREE.BoxGeometry(1.45, 0.34, 10.2);
  pkFrieze.translate(pkX + 0.6, pkBaseY + 4.02, pkZ);
  solidColorParts.push(colorizeGeo(pkFrieze, '#9c1814'));
  addBox(goldParts, 1.52, 0.10, 10.3, pkX + 0.6, pkBaseY + 3.86, pkZ);
  const pkRoof1 = createHueImperialHipRoofGeometry(3.4, 11.4, 1.8, 8.6, 1.25, 0.28, 8, 4, false);
  pkRoof1.translate(pkX + 0.6, pkBaseY + 4.10, pkZ);
  jadeRoofParts.push(pkRoof1);

  // Upper `"寺 山 金"` Second-Tier Pavilion + Hanging Red Orb Lantern + Twin Emerald Glazed Roofs (`HA-19`)
  const pkTopY = pkBaseY + 5.32;
  const pkUpperArch = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(3.2, 2.35, 0.74, 1.15, 1.68)), 'phucKienBrick');
  pkUpperArch.rotateY(Math.PI * 0.5);
  pkUpperArch.translate(pkX + 0.6, pkTopY, pkZ);
  reliefAtlasParts.push(pkUpperArch);
  addBox(goldParts, 0.10, 0.52, 1.32, pkX + 1.00, pkTopY + 1.92, pkZ);
  signAtlasParts.push(makeSignPlane(1.22, 0.44, 'kimSonTu', pkX + 1.07, pkTopY + 1.92, pkZ, Math.PI * 0.5));
  const redOrb = new THREE.SphereGeometry(0.18, 8, 6);
  redOrb.translate(pkX + 0.6, pkTopY + 1.32, pkZ);
  solidColorParts.push(colorizeGeo(redOrb, '#c81612'));
  const pkRoof2 = createHueImperialHipRoofGeometry(3.1, 4.8, 0.26, 2.8, 1.38, 0.28, 6, 4, false);
  pkRoof2.translate(pkX + 0.6, pkTopY + 2.32, pkZ);
  jadeRoofParts.push(pkRoof2);
  const pkFinials = createRoofFinialSetParts(pkX + 0.6, pkTopY + 3.65, pkZ, 2.6, Math.PI * 0.5, 0.55, true);
  whitePlasterParts.push(...pkFinials.mainParts, ...pkFinials.goldParts);

  // Item 109, 110, 111, 112, 113, 114 (Area Expansion): Hội Quán Phúc Kiến inner Sân Thiên Tỉnh courtyard behind Tam Quan,
  // Hồ Phóng Sinh dragon fountain basin, Bình Phong spirit screen, Tiền Điện/Chính Điện Thiên Hậu sanctuary roof & giant hanging Hương Vòng incense coils!
  const hqX = pkX - 9.5;
  addBox(stoneParts, 14.5, 0.42, 12.6, hqX, pkY + 0.21, pkZ);
  // Bình Phong spirit screen & Hồ Phóng Sinh fountain basin in courtyard
  addBox(whitePlasterParts, 0.42, 2.45, 3.6, pkX - 3.6, pkBaseY + 1.22, pkZ);
  addCyl(stoneParts, 1.45, 1.55, 0.48, 12, pkX - 6.8, pkBaseY + 0.24, pkZ);
  addCyl(stoneParts, 0.28, 0.36, 1.15, 8, pkX - 6.8, pkBaseY + 0.72, pkZ);
  // Main Thiên Hậu Sanctuary Hall behind courtyard
  addBox(whitePlasterParts, 6.8, 4.4, 11.4, hqX - 4.2, pkBaseY + 2.2, pkZ);
  addBox(crimsonParts, 0.35, 3.6, 8.8, hqX - 0.7, pkBaseY + 1.8, pkZ);
  const hqRoof = createHueImperialHipRoofGeometry(8.6, 13.2, 2.2, 9.4, 2.1, 0.26, 8, 4, false);
  hqRoof.translate(hqX - 4.2, pkBaseY + 4.4, pkZ);
  jadeRoofParts.push(hqRoof);
  const hqFinials = createRoofFinialSetParts(hqX - 4.2, pkBaseY + 6.45, pkZ, 8.8, Math.PI * 0.5, 0.55, true);
  whitePlasterParts.push(...hqFinials.mainParts, ...hqFinials.goldParts);
  // Giant conical Hương Vòng spiral incense coils suspended under portico eaves
  for (const iz of [-2.4, 0, 2.4]) {
    addCone(goldParts, 0.28, 0.52, 8, hqX - 0.2, pkBaseY + 3.25, pkZ + iz, Math.PI);
  }
  // Flanking stone Kỳ Lân relief panels on Tam Quan wing walls
  for (const side of [-1, 1]) {
    addBox(whitePlasterParts, 0.22, 1.15, 1.15, pkX + 1.04, pkBaseY + 1.25, pkZ + side * 4.55);
  }

  // Monumental Dark-Bronze Forecourt Tripod Cauldron (`Đỉnh Đồng`, `HA-21`), Flanking Stone Guardian Lions with Red Silk Bows (`HA-22`) & Bonsai Pots (`HA-23`)
  const pkCaul = createBronzeIncenseTripodParts(pkX + 2.65, pkBaseY, pkZ, 0.92);
  bronzeParts.push(...pkCaul.bronzeParts, ...pkCaul.goldParts);
  for (const side of [-1, 1]) {
    addBox(stoneParts, 0.92, 0.78, 0.92, pkX + 3.45, pkBaseY + 0.39, pkZ + side * 4.25);
    stoneParts.push(...createGuardianBeastParts(pkX + 3.45, pkBaseY + 0.78, pkZ + side * 4.25, Math.PI * 0.5, 0.72, 'nghe'));
    // Subtle red silk chest ribbon bow on each guardian lion (`HA-22`)
    const bow = new THREE.BoxGeometry(0.06, 0.14, 0.12);
    bow.translate(pkX + 3.74, pkBaseY + 1.22, pkZ + side * 4.25);
    solidColorParts.push(colorizeGeo(bow, '#d61c18'));
    // Flowering pink bonsai in blue-white porcelain pot (`HA-23`)
    addHoiAnPorcelainVase(reliefAtlasParts, solidColorParts, pkX + 2.45, pkBaseY, pkZ + side * 2.75, 0.85, 'incense_jar', 1155 + side);
    addOrganicBougainvillea(ironwoodParts, foliageCardParts, pkX + 2.45, pkBaseY + 0.95, pkZ + side * 2.75, 1, 0.65, 1159 + side);
  }

  // Mature Whitewashed-Trunk Hội An Street Trees screening perimeter vistas (`HA-10`, `CC-07` — strictly >= 5.5m clear of all facades & assembly halls!)
  for (const [tx, tz, th, tr, sd] of [
    [145.5, 29.0, 10.2, 3.8, 8401],
    [145.5, 16.0, 10.6, 3.8, 8402],
    [204.5, 17.0, 10.5, 3.8, 8403],
    [204.5, 45.0, 10.2, 3.8, 8404],
    [164.0, 97.5, 9.2, 3.6, 8405],
    [188.0, 86.5, 9.4, 3.6, 8406],
    [164.0, -11.5, 9.6, 3.6, 8407],
    [188.0, -2.5, 9.4, 3.6, 8408]
  ]) {
    addHoiAnStreetTree(ironwoodParts, whitePlasterParts, foliageCardParts, tx, ctx.getHeight(tx, tz) - 0.1, tz, th, tr, sd);
  }

  // =================================================================================================
  // SECTION 6: HANGING SILK LANTERN ARCS, OPEN-PETALED HOA ĐĂNG & WOODEN SAMPAN BOATS
  // (`CC-28`, `CC-29`, `CC-31`, `HA-24..32` — leaving z ∈ [45..62] CLEAR in front of Chùa Cầu!)
  // =================================================================================================
  const stringZs = [16.5, 25.5, 34.5, 64.0, 71.0, 76.2];
  stringZs.forEach((sz, sIdx) => {
    const xStart = 161.2;
    const xEnd = 188.8;
    const sagPts: THREE.Vector3[] = [];
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      sagPts.push(new THREE.Vector3(THREE.MathUtils.lerp(xStart, xEnd, t), bankY + 6.45 - 1.55 * Math.sin(t * Math.PI), sz));
    }
    ironwoodParts.push(createSmoothTaperedTubeGeometry(new THREE.CatmullRomCurve3(sagPts), 12, 4, () => 0.024));
    for (let l = 1; l < segs; l += 2) {
      const p = sagPts[l];
      const hex = lanternPalette[(sIdx * 3 + l) % lanternPalette.length];
      addHoiAnLantern(p.x, p.y - 0.44, p.z, 0.30, 0.76, hex, sIdx + l, (sIdx + l) % 2 === 0);
      const poolY = p.x > 166.8 && p.x < 183.2 ? 0.05 : bankY + 0.06;
      const pool = new THREE.CircleGeometry(2.4, 12);
      pool.rotateX(-Math.PI * 0.5);
      pool.translate(p.x, poolY, p.z);
      lightPoolParts.push(colorizeGeo(pool, hex));
    }
  });

  // Multi-Layered Open-Petaled Glowing *Hoa Đăng* Paper Lotus Lanterns on Hoài Canal (`CC-29`, `HA-32`) + Item 116: 18 more lanterns (z = 4..86)
  const rand = mulberry32(202607);
  for (let i = 0; i < 60; i++) {
    const fx = 168.4 + rand() * 13.2;
    const fz = 4.0 + rand() * 82.0;
    if (Math.abs(fz - bridgeZ) < 6.2) continue;
    const hoaHex = i % 3 === 0 ? '#ff6a33' : i % 3 === 1 ? '#ffd24d' : '#ff77aa';
    const outerCup = new THREE.CylinderGeometry(0.34, 0.14, 0.13, 6, 1, true);
    outerCup.translate(fx, 0.09, fz);
    const innerCup = new THREE.CylinderGeometry(0.20, 0.11, 0.11, 6, 1, true);
    innerCup.rotateY(Math.PI / 6);
    innerCup.translate(fx, 0.11, fz);
    lanternParts.push(colorizeGeo(outerCup, hoaHex), colorizeGeo(innerCup, '#fff0c8'));
    const flame = new THREE.SphereGeometry(0.08, 5, 4);
    flame.translate(fx, 0.17, fz);
    coreParts.push(flame);
    const waterPool = new THREE.CircleGeometry(1.10, 8);
    waterPool.rotateX(-Math.PI * 0.5);
    waterPool.translate(fx, 0.045, fz);
    lightPoolParts.push(colorizeGeo(waterPool, hoaHex));
  }

  // 4 Animated Wooden *Thuyền Chài* Sampan Boats with Upturned Bows, Warm Bow Lanterns & Seated Boatman (`CC-28`, `HA-32`)
  const sampanConfigs = [
    { x: 171.6, z: 20.5, yaw: Math.PI * 0.5 + 0.06, speed: 0.24, phase: 0.2 },
    { x: 178.4, z: 31.0, yaw: -Math.PI * 0.5 - 0.05, speed: 0.28, phase: 1.7 },
    { x: 171.8, z: 59.5, yaw: Math.PI * 0.5 - 0.04, speed: 0.26, phase: 3.1 },
    { x: 178.2, z: 70.0, yaw: -Math.PI * 0.5 + 0.07, speed: 0.22, phase: 4.5 },
    // Item 115 (Area Expansion): 2 additional Thuyền Chài sampan boats on North & South Hoài canal
    { x: 174.5, z: 10.5, yaw: Math.PI * 0.5 + 0.04, speed: 0.20, phase: 2.4 },
    { x: 174.8, z: 79.5, yaw: -Math.PI * 0.5 - 0.04, speed: 0.21, phase: 5.1 }
  ];
  // Item 117 & 120: Bamboo-pole lantern arches framing Chùa Cầu plaza approaches & warm amber light pool at Hội Quán Phúc Kiến
  for (const ax of [162.8, 187.2]) {
    addCyl(ironwoodParts, 0.06, 0.08, 3.6, 6, ax, bankY + 1.8, bridgeZ - 3.6);
    addHoiAnLantern(ax, bankY + 3.25, bridgeZ - 3.6, 0.24, 0.54, '#f2b62a', 1, true);
  }
  const pkPool = new THREE.CircleGeometry(3.2, 12);
  pkPool.rotateX(-Math.PI * 0.5);
  pkPool.translate(pkX + 2.6, pkBaseY + 0.05, pkZ);
  lightPoolParts.push(colorizeGeo(pkPool, '#ff9c44'));
  const sampanHullParts: THREE.BufferGeometry[] = [];
  addBox(sampanHullParts, 3.8, 0.12, 1.15, 0, 0.06, 0);
  for (const sz of [-0.58, 0.58]) {
    addBox(sampanHullParts, 4.1, 0.42, 0.09, 0, 0.28, sz, 0, sz > 0 ? -0.18 : 0.18, 0);
  }
  for (const sx of [-2.25, 2.25]) {
    const dir = Math.sign(sx);
    addCone(sampanHullParts, 0.56, 1.15, 4, sx, 0.34, 0, 0, Math.PI * 0.25, -dir * Math.PI * 0.42);
  }
  for (const bx of [-0.95, 0.15, 1.15]) addBox(sampanHullParts, 0.32, 0.07, 1.08, bx, 0.34, 0);
  addCyl(sampanHullParts, 0.14, 0.18, 0.56, 6, -0.95, 0.64, 0);
  const rHead = new THREE.SphereGeometry(0.10, 6, 4);
  rHead.translate(-0.95, 1.00, 0);
  sampanHullParts.push(rHead);
  addCone(sampanHullParts, 0.28, 0.18, 8, -0.95, 1.14, 0);
  addCyl(sampanHullParts, 0.024, 0.028, 2.9, 5, -1.25, 0.65, 0.52, 0.35, 0.25, 0.45);
  addCyl(sampanHullParts, 0.024, 0.030, 1.32, 5, 2.45, 0.90, 0, 0, 0, -0.22);
  const bowCap = createLanternCapGeometry(0.17, 0.44, false);
  bowCap.translate(2.70, 1.22, 0);
  sampanHullParts.push(bowCap);
  const sharedSampanGeo = mergeNormalized(sampanHullParts);

  const bowShell = createRibbedLanternShellGeometry(0.17, 0.44, 8, 6);
  bowShell.translate(2.70, 1.22, 0);
  const bowCore = createLanternCoreGeometry(0.17, 0.44);
  bowCore.translate(2.70, 1.22, 0);
  const bowTassel = new THREE.ConeGeometry(0.028, 0.16, 5);
  bowTassel.translate(2.70, 0.88, 0);

  sampanConfigs.forEach((sc, idx) => {
    const boatGrp = new THREE.Group();
    boatGrp.name = `HoiAnSampanBoat_${idx + 1}`;
    const hullMesh = new THREE.Mesh(sharedSampanGeo.clone(), ctx.materials.darkIronwood ?? ctx.materials.darkWood);
    hullMesh.castShadow = true;
    const bShell = new THREE.Mesh(colorizeGeo(bowShell.clone(), lanternPalette[idx % lanternPalette.length]), ha.hoiAnSilkLanternMat);
    const bCore = new THREE.Mesh(bowCore.clone(), ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat);
    const bTassel = new THREE.Mesh(bowTassel.clone(), ctx.materials.crimsonLacquer);
    boatGrp.add(hullMesh, bShell, bCore, bTassel);
    boatGrp.position.set(sc.x, 0.04, sc.z);
    boatGrp.rotation.y = sc.yaw;
    group.add(boatGrp);
    ctx.junkBoats.push({
      group: boatGrp,
      centerX: sc.x,
      centerZ: sc.z,
      radiusX: 0.65,
      radiusZ: 2.2,
      speed: sc.speed,
      phase: sc.phase
    });
  });
  sharedSampanGeo.dispose();
  bowShell.dispose();
  bowCore.dispose();
  bowTassel.dispose();

  for (const lz of [25.5, 64.5]) {
    const hoiAnLight = new THREE.PointLight('#ff9c44', 24.0, 42.0, 1.5);
    hoiAnLight.position.set(cx, bankY + 4.8, lz);
    group.add(hoiAnLight);
  }

  // =================================================================================================
  // SECTION 7: CLEAN BATCHED MERGE & STRICT MATERIAL/SHADOW BUDGET HYGIENE
  // =================================================================================================
  const addMerged = (
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
    worldUvScale?: number,
    name?: string
  ) => {
    if (parts.length === 0) return;
    let geo = mergeNormalized(parts);
    if (worldUvScale) geo = applyWorldBoxUV(geo, worldUvScale);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    if (name) mesh.name = name;
    group.add(mesh);
  };

  const lightPoolMat = ctx.sharedShaders
    ? ctx.sharedShaders.warmLightPool.material
    : (() => {
        const res = createWarmLightPoolMaterial();
        ctx.extraMaterials.push(res.material);
        animatedUniforms.push(res.uniforms);
        return res.material;
      })();

  const solidMat =
    ctx.materialLib?.getOrCreateStandard({
      vertexColors: true,
      roughness: 0.78,
      side: THREE.DoubleSide
    }) ?? ctx.materials.stone;

  const folMat =
    ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide
    }) ?? ctx.materials.darkWood;

  addMerged(stoneParts, ctx.materials.stone, true, true, 2.4);
  addMerged(whitePlasterParts, ctx.materials.whitePlaster, true, true, 2.2);
  addMerged(reliefAtlasParts, ha.hoiAnReliefAtlasMat, true, true);
  addMerged(signAtlasParts, ha.hoiAnCalligraphyMat, false, true);
  addMerged(jadeRoofParts, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, true, true);
  addMerged(ironwoodParts, ctx.materials.darkIronwood ?? ctx.materials.darkWood, true, true, 2.4);
  addMerged(crimsonParts, ctx.materials.crimsonLacquer, false, true);
  addMerged(bronzeParts, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(goldParts, ctx.materials.gold, false, false);
  addMerged(voidParts, ctx.materials.darkVoid, false, false);
  addMerged(solidColorParts, solidMat, false, true);
  addMerged(foliageCardParts, folMat, false, true, undefined, 'HoiAnBotanicalFoliage');
  addMerged(lanternParts, ha.hoiAnSilkLanternMat, false, false, undefined, 'HoiAnLanternsAndHoaDang');
  addMerged(coreParts, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false, undefined, 'HoiAnLanternCandleCores');
  addMerged(lightPoolParts, lightPoolMat, false, false, undefined, 'HoiAnLanternLightPools');

  // =================================================================================================
  // WAVE 2 UPGRADES (Items 281–320): Hoài Canal Boat Docks, Chùa Cầu Shrine Bells/Drums,
  // Tailor/Calligraphy/Ceramic/Tea/Mask Artisan Stalls, Giếng Bá Lễ, Tam Quan Chùa Bà Mụ & Phúc Kiến
  // =================================================================================================
  const w2Stone: THREE.BufferGeometry[] = [];
  const w2Plaster: THREE.BufferGeometry[] = [];
  const w2Wood: THREE.BufferGeometry[] = [];
  const w2Crimson: THREE.BufferGeometry[] = [];
  const w2Gold: THREE.BufferGeometry[] = [];
  const w2Bronze: THREE.BufferGeometry[] = [];
  const w2JadeRoof: THREE.BufferGeometry[] = [];
  const w2Solid: THREE.BufferGeometry[] = [];
  const w2Core: THREE.BufferGeometry[] = [];

  // 281–284, 291–295: West & East Hoài Canal boat-boarding docks, Hoa Đăng vendor desk, oar racks, fishing-net lift rig, covered tour boat & sluice grates
  addBox(w2Wood, 3.2, 0.22, 5.2, 167.2, 0.42, 34.0);
  addBox(w2Wood, 3.2, 0.22, 5.2, 182.8, 0.42, 56.0);
  for (const [dx, dz] of [[168.6, 31.8], [168.6, 36.2], [181.4, 53.8], [181.4, 58.2]] as const) {
    addCyl(w2Wood, 0.08, 0.10, 1.85, 5, dx, 0.45, dz);
  }
  // 283–284: Hoa Đăng lantern-release bamboo ticket desk & glowing paper-lantern display tray at West dock
  addBox(w2Wood, 0.85, 0.82, 1.65, 164.6, bankY + 0.48, 34.0);
  for (const lz of [-0.45, 0, 0.45]) {
    addCone(w2Core, 0.16, 0.14, 5, 164.6, bankY + 0.98, 34.0 + lz);
  }
  // 291: Coiled mooring ropes & leaning oars on docks
  addCyl(w2Wood, 0.03, 0.03, 2.2, 5, 167.4, 1.15, 36.0, 0.25, 0, 0.18);
  addCyl(w2Wood, 0.03, 0.03, 2.2, 5, 182.6, 1.15, 54.0, -0.25, 0, -0.18);
  // 292: Bamboo fishing-net lift rig (Rớ Sông Hoài) at northern canal bend (170.5, 11.5) with grounded pivot stanchions
  addCyl(w2Wood, 0.07, 0.09, 2.6, 5, 167.8, 0.55, 10.9);
  addCyl(w2Wood, 0.07, 0.09, 2.6, 5, 167.8, 0.55, 12.1);
  addCyl(w2Wood, 0.05, 0.07, 4.8, 5, 168.5, 2.1, 11.5, 0, 0, -0.58);
  addBox(w2Wood, 2.8, 0.08, 2.8, 171.2, 1.15, 11.5);
  // 293: Traditional covered river tour boat (Đò Du Lịch) moored at East dock (180.6, 56.0)
  addBox(w2Wood, 1.65, 0.55, 5.2, 180.6, 0.28, 56.0);
  w2Solid.push(colorizeGeo(new THREE.CylinderGeometry(0.78, 0.78, 3.2, 6).rotateX(Math.PI * 0.5).translate(180.6, 0.92, 56.0), '#7a6244'));
  // 294–295: Riverside curved bamboo lantern poles & mossy stone sluice grates
  for (const lz of [20.5, 68.5]) {
    addCyl(w2Wood, 0.04, 0.06, 3.4, 5, 166.4, bankY + 1.6, lz, 0, 0, -0.32);
    addBox(w2Core, 0.24, 0.36, 0.24, 167.4, bankY + 3.05, lz);
    addBox(w2Stone, 0.22, 0.65, 0.85, 166.85, 0.62, lz);
  }

  // 285–290: Chùa Cầu Cửa Võng arch curtain, bronze temple bell, Trống Đế drum (grounded stands!), stone drainage spouts, flood-barricade posts & heritage stele
  addBox(w2Gold, 1.85, 0.42, 0.14, cx, 5.35, bridgeZ - 1.72);
  addCyl(w2Wood, 0.06, 0.07, 1.15, 5, cx - 1.65, shrineDeckY + 0.52, bridgeZ - 2.45);
  addCyl(w2Wood, 0.06, 0.07, 1.15, 5, cx - 1.05, shrineDeckY + 0.52, bridgeZ - 2.45);
  addBox(w2Wood, 0.72, 0.08, 0.08, cx - 1.35, shrineDeckY + 1.06, bridgeZ - 2.45);
  addCyl(w2Bronze, 0.16, 0.24, 0.58, 6, cx - 1.35, 3.85, bridgeZ - 2.45);
  addCyl(w2Wood, 0.06, 0.08, 0.65, 5, cx + 1.35, shrineDeckY + 0.28, bridgeZ - 2.45);
  addCyl(w2Crimson, 0.24, 0.24, 0.44, 6, cx + 1.35, 3.72, bridgeZ - 2.45, 0, 0, Math.PI * 0.5);
  for (const sx of [-4.5, 4.5]) {
    addBox(w2Stone, 0.28, 0.18, 0.62, cx + sx, 3.05, bridgeZ + 2.65);
  }
  for (const px of [166.2, 183.8]) {
    addBox(w2Wood, 0.22, 1.65, 0.22, px, bankY + 0.85, bridgeZ - 2.15);
    addBox(w2Wood, 0.22, 1.65, 0.22, px, bankY + 0.85, bridgeZ + 2.15);
  }
  // 290: Bia Di Tích Chùa Cầu heritage stele under 4-post tiled canopy on West plaza (163.5, 49.2)
  addBox(w2Stone, 0.85, 1.45, 0.32, 163.5, bankY + 0.72, 49.2);
  for (const px of [-0.55, 0.55]) {
    for (const pz of [-0.55, 0.55]) {
      addCyl(w2Wood, 0.045, 0.055, 1.88, 5, 163.5 + px, bankY + 0.78, 49.2 + pz);
    }
  }
  addCone(w2JadeRoof, 0.95, 0.52, 4, 163.5, bankY + 1.88, 49.2, 0, Math.PI * 0.25);

  // 296–310: Hội An Artisan Stalls — Tailors, Calligraphy, Thanh Hà Ceramics, Mót Tea, Café, Tuồng Masks, Street-Food Pushcart, Giếng Bá Lễ, Alley Arch & Wall Lanterns
  // 296–297: Tiệm May Áo Dài Hội An (West bank 161.2, 33.5) — mannequin stands & rolled silk racks
  for (const mz of [-0.55, 0.55]) {
    addCyl(w2Wood, 0.04, 0.06, 1.35, 5, 161.2, bankY + 0.72, 33.5 + mz);
    w2Solid.push(colorizeGeo(new THREE.ConeGeometry(0.24, 0.95, 5).translate(161.2, bankY + 1.05, 33.5 + mz), mz < 0 ? '#d62828' : '#f4b41a'));
  }
  addBox(w2Wood, 0.62, 0.82, 1.55, 160.2, bankY + 0.45, 33.5);
  // 298–299: Master Calligraphy Stall (162.4, 52.8) — crimson table, vertical scroll rack & A-frame easel
  addBox(w2Crimson, 0.85, 0.78, 1.75, 162.4, bankY + 0.42, 52.8);
  addBox(w2Wood, 0.14, 1.85, 1.55, 161.8, bankY + 1.25, 52.8);
  addBox(w2Gold, 0.10, 1.15, 0.36, 161.92, bankY + 1.35, 52.35);
  addBox(w2Gold, 0.10, 1.15, 0.36, 161.92, bankY + 1.35, 53.25);
  addBox(w2Wood, 0.62, 1.05, 0.12, 162.6, bankY + 0.62, 54.1, 0.35, 0.18);
  // 300–301: Gốm Thanh Hà Ceramic Stall (East bank 187.2, 62.5) — stepped shelves & terracotta jars/teapots
  addBox(w2Wood, 0.95, 1.35, 2.4, 187.2, bankY + 0.72, 62.5);
  for (const czOff of [-0.75, 0, 0.75]) {
    w2Solid.push(colorizeGeo(new THREE.CylinderGeometry(0.18, 0.14, 0.36, 6).translate(186.9, bankY + 1.58, 62.5 + czOff), '#b85636'));
  }
  // 302–303: Quán Trà Thảo Mộc Mót Hội An (162.6, 63.5) with grounded canopy posts & Heritage Balcony Café counter
  addBox(w2Wood, 0.95, 0.82, 2.2, 162.6, bankY + 0.45, 63.5);
  for (const px of [-0.52, 0.52]) {
    for (const pz of [-1.05, 1.05]) {
      addCyl(w2Wood, 0.045, 0.055, 2.42, 5, 162.6 + px, bankY + 1.06, 63.5 + pz);
    }
  }
  addBox(w2JadeRoof, 1.55, 0.14, 2.5, 162.6, bankY + 2.25, 63.5, 0, 0, -0.18);
  addCyl(w2Bronze, 0.20, 0.18, 0.42, 6, 162.6, bankY + 1.05, 63.1);
  addBox(w2Wood, 0.78, 0.95, 1.85, 161.4, bankY + 0.52, 68.5);
  // 304–306: Tuồng Mask Display (187.2, 27.4) with grounded legs, Cao Lầu/Bánh Mì Pushcart (186.8, 49.5) & Gánh Hàng Rong baskets
  addBox(w2Crimson, 0.18, 1.35, 1.65, 187.2, bankY + 1.45, 27.4);
  for (const lz of [-0.72, 0.72]) {
    addCyl(w2Wood, 0.04, 0.05, 1.15, 5, 187.2, bankY + 0.42, 27.4 + lz);
  }
  for (const mz of [-0.45, 0, 0.45]) {
    addBox(w2Gold, 0.22, 0.32, 0.26, 187.1, bankY + 1.55, 27.4 + mz);
  }
  addBox(w2Wood, 0.78, 1.05, 1.45, 186.8, bankY + 0.78, 49.5);
  addBox(w2Plaster, 0.68, 0.58, 1.25, 186.8, bankY + 1.55, 49.5);
  addCyl(w2Wood, 0.24, 0.16, 0.36, 6, 186.5, bankY + 0.26, 39.2);
  addCyl(w2Wood, 0.24, 0.16, 0.36, 6, 186.5, bankY + 0.26, 40.4);
  // 307–310: Giếng Bá Lễ square heritage well in open pocket (156.8, 34.5, clear of shophouses!), Alleyway Arch (156.5, 39.2), Breeze-blocks & Wall-bracket lanterns
  addBox(w2Stone, 1.85, 0.85, 1.85, 156.8, bankY + 0.42, 34.5);
  addBox(w2Wood, 0.14, 1.65, 1.95, 156.8, bankY + 1.45, 34.5);
  addBox(w2Plaster, 3.2, 3.8, 0.55, 156.5, bankY + 1.9, 39.2);
  for (const lz of [24.0, 38.0, 56.0, 70.0]) {
    addBox(w2Plaster, 0.24, 0.65, 1.45, 161.2, bankY + 4.45, lz);
    addBox(w2Core, 0.18, 0.28, 0.18, 161.6, bankY + 3.05, lz);
  }

  // 311–315 (Area Expansion): Tam Quan Chùa Bà Mụ (156.8, -1.5 — clear North of shophouses!) — 3-bay gate, double-tier curved roofs, lotus pond & stone stepping bridge
  const bmX = 156.8;
  const bmZ = -1.5;
  const bmY = Math.max(
    ctx.getHeight(bmX, bmZ),
    ctx.getHeight(bmX - 3.1, bmZ - 4.9),
    ctx.getHeight(bmX + 3.1, bmZ - 4.9),
    ctx.getHeight(bmX - 3.1, bmZ + 4.9),
    ctx.getHeight(bmX + 3.1, bmZ + 4.9)
  );
  addBox(w2Stone, 6.2, 3.4, 9.8, bmX, bmY - 1.28, bmZ);
  addBox(w2Plaster, 1.15, 3.8, 9.2, bmX, bmY + 2.2, bmZ);
  addBox(w2Crimson, 1.24, 2.55, 2.2, bmX, bmY + 1.55, bmZ);
  for (const s of [-1, 1]) {
    addBox(w2Crimson, 1.24, 2.15, 1.35, bmX, bmY + 1.35, bmZ + s * 3.1);
    addBox(w2Gold, 1.28, 0.68, 0.68, bmX, bmY + 2.85, bmZ + s * 3.1);
    // 315: Carved stone courtyard benches
    addBox(w2Stone, 1.45, 0.46, 0.52, bmX + 3.8, bmY + 0.35, bmZ + s * 4.2);
  }
  // 312: Double-tier Tam Quan Bà Mụ curved roofs
  addBox(w2JadeRoof, 2.8, 0.65, 10.4, bmX, bmY + 4.35, bmZ);
  addBox(w2Plaster, 1.05, 1.65, 4.2, bmX, bmY + 5.35, bmZ);
  addBox(w2JadeRoof, 2.4, 0.72, 5.2, bmX, bmY + 6.45, bmZ);
  // 314: Reflecting lotus-pond terrace & stone stepping bridge in front of Tam Quan Bà Mụ
  addBox(w2Stone, 3.8, 0.36, 7.6, bmX + 3.6, bmY + 0.18, bmZ);
  addBox(w2Stone, 3.4, 0.48, 1.45, bmX + 3.6, bmY + 0.32, bmZ);

  // 316–320: Hội Quán Phúc Kiến Thiên Hậu altar canopy, model merchant junk ship, crane candle-stands, Bình Phong trim & Tấn Ký threshold/abacus
  addBox(w2Gold, 1.65, 0.45, 3.8, hqX - 1.2, pkBaseY + 2.85, pkZ);
  addBox(w2Crimson, 1.05, 0.95, 2.8, hqX - 1.2, pkBaseY + 0.52, pkZ);
  // 317: Sacred wooden model merchant junk ship offering in Phúc Kiến courtyard
  addBox(w2Wood, 1.95, 0.58, 0.68, pkX - 5.2, pkBaseY + 0.65, pkZ + 3.2);
  addCyl(w2Wood, 0.03, 0.04, 1.45, 5, pkX - 5.2, pkBaseY + 1.45, pkZ + 3.2);
  // 318–319: Flanking red-lacquered crane candle-stands & corner stone lanterns
  for (const s of [-1, 1]) {
    addCyl(w2Crimson, 0.08, 0.14, 1.35, 5, pkX - 6.8, pkBaseY + 0.72, pkZ + s * 2.1);
    addBox(w2Stone, 0.48, 1.15, 0.48, pkX - 3.6, pkBaseY + 0.58, pkZ + s * 2.4);
  }
  // 320: Nhà Cổ Tấn Ký (z = 27.4) front wooden threshold step & antique reception counter
  addBox(w2Wood, 0.32, 0.24, 2.2, 161.4, bankY + 0.16, 27.4);
  addBox(w2Wood, 0.55, 0.82, 1.25, 160.2, bankY + 0.45, 28.6);

  addMerged(w2Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w2Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w2Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w2Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w2Gold, ctx.materials.gold, false, false);
  addMerged(w2Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w2JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w2Solid, solidMat, false, true);
  addMerged(w2Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 3 UPGRADES (Items 561–640): Hội Quán Quảng Đông & Hội Quán Triều Châu Facades,
  // Wooden Shutters (Thượng Song Hạ Bản), Lantern Alleys & Bạch Đằng Waterfront
  // =================================================================================================
  const w3Stone: THREE.BufferGeometry[] = [];
  const w3Plaster: THREE.BufferGeometry[] = [];
  const w3Wood: THREE.BufferGeometry[] = [];
  const w3Crimson: THREE.BufferGeometry[] = [];
  const w3Gold: THREE.BufferGeometry[] = [];
  const w3Bronze: THREE.BufferGeometry[] = [];
  const w3JadeRoof: THREE.BufferGeometry[] = [];
  const w3Solid: THREE.BufferGeometry[] = [];
  const w3Core: THREE.BufferGeometry[] = [];

  // 561–569, 597: Hội Quán Quảng Đông (Cantonese Assembly Hall) on open West Heritage Quarter (143.5, 44.5 — clear of shophouses!)
  const qdX = 143.5;
  const qdZ = 44.5;
  const qdY = Math.max(
    ctx.getHeight(qdX, qdZ),
    ctx.getHeight(qdX - 5.5, qdZ - 5.2),
    ctx.getHeight(qdX + 5.5, qdZ - 5.2),
    ctx.getHeight(qdX - 5.5, qdZ + 5.2),
    ctx.getHeight(qdX + 5.5, qdZ + 5.2)
  );
  // 561: Retaining stone plinth & Tam Quan 3-bay facade
  addBox(w3Stone, 11.4, 3.2, 10.8, qdX, qdY - 1.35, qdZ);
  addBox(w3Plaster, 1.15, 3.8, 9.6, qdX + 4.4, qdY + 2.15, qdZ);
  // 562: Double-tier curved jade-glazed roofs & flush ridge finials
  addBox(w3JadeRoof, 2.8, 0.65, 10.6, qdX + 4.4, qdY + 4.32, qdZ);
  addBox(w3Plaster, 1.05, 1.55, 4.4, qdX + 4.4, qdY + 5.32, qdZ);
  addBox(w3JadeRoof, 2.4, 0.68, 5.4, qdX + 4.4, qdY + 6.38, qdZ);
  addBox(w3Gold, 0.24, 0.28, 4.6, qdX + 4.4, qdY + 6.82, qdZ);
  // 563–564: Grounded crimson entrance columns, stone drum bases, crimson door leaves & gilded QUẢNG ĐÔNG plaque
  for (const czO of [-3.4, -1.2, 1.2, 3.4]) {
    addCyl(w3Stone, 0.22, 0.26, 0.32, 6, qdX + 5.05, qdY + 0.35, qdZ + czO);
    addCyl(w3Crimson, 0.12, 0.14, 3.75, 6, qdX + 5.05, qdY + 2.25, qdZ + czO);
  }
  addBox(w3Crimson, 1.24, 2.65, 2.2, qdX + 4.4, qdY + 1.58, qdZ);
  addBox(w3Gold, 0.18, 0.65, 3.2, qdX + 5.15, qdY + 3.65, qdZ);
  // 565–566: Inner courtyard stone basin & coiled porcelain dragon fountain centerpiece
  addCyl(w3Stone, 1.75, 1.95, 0.55, 6, qdX + 0.6, qdY + 0.52, qdZ);
  w3Solid.push(
    colorizeGeo(new THREE.CylinderGeometry(0.45, 0.72, 1.65, 6).translate(qdX + 0.6, qdY + 1.48, qdZ), '#2d7a9c'),
    colorizeGeo(new THREE.ConeGeometry(0.48, 0.78, 5).translate(qdX + 0.6, qdY + 2.55, qdZ), '#e6b84c')
  );
  // 567–569, 597: Main Quan Công sanctuary facade, porch columns, gilded altar, spiral incense coils, side cloisters & wall lanterns
  addBox(w3Plaster, 3.2, 4.0, 9.2, qdX - 3.6, qdY + 2.25, qdZ);
  addBox(w3JadeRoof, 4.4, 0.85, 10.2, qdX - 3.6, qdY + 4.62, qdZ);
  addBox(w3Gold, 0.24, 0.28, 8.4, qdX - 3.6, qdY + 5.12, qdZ);
  addBox(w3Crimson, 0.95, 0.92, 2.6, qdX - 1.6, qdY + 0.72, qdZ);
  for (const s of [-1, 1]) {
    addCyl(w3Crimson, 0.12, 0.14, 3.85, 6, qdX - 1.7, qdY + 2.15, qdZ + s * 2.8);
    addCone(w3Gold, 0.34, 0.58, 5, qdX - 1.7, qdY + 3.25, qdZ + s * 1.4);
    addBox(w3Plaster, 7.6, 2.6, 0.55, qdX + 0.4, qdY + 1.55, qdZ + s * 4.8);
    addBox(w3Gold, 0.68, 0.68, 0.62, qdX + 0.6, qdY + 1.85, qdZ + s * 4.8);
    addBox(w3Core, 0.22, 0.32, 0.22, qdX + 5.2, qdY + 2.85, qdZ + s * 2.4);
  }

  // 570–576, 598: Hội Quán Triều Châu (Chaozhou Assembly Hall) on open East Heritage Quarter (205.5, 32.0 — clear of shophouses!)
  const tcX = 205.5;
  const tcZ = 32.0;
  const tcY = Math.max(
    ctx.getHeight(tcX, tcZ),
    ctx.getHeight(tcX - 5.2, tcZ - 4.8),
    ctx.getHeight(tcX + 5.2, tcZ - 4.8),
    ctx.getHeight(tcX - 5.2, tcZ + 4.8),
    ctx.getHeight(tcX + 5.2, tcZ + 4.8)
  );
  addBox(w3Stone, 10.6, 3.2, 9.8, tcX, tcY - 1.35, tcZ);
  addBox(w3Plaster, 1.25, 3.9, 8.8, tcX - 4.0, tcY + 2.20, tcZ);
  addBox(w3JadeRoof, 2.8, 0.72, 9.8, tcX - 4.0, tcY + 4.45, tcZ);
  // 571: Ornate porcelain-relief roof-ridge crest & upturned gable scrolls
  addBox(w3Gold, 0.28, 0.34, 8.6, tcX - 4.0, tcY + 4.92, tcZ);
  // 572–573: Dark ironwood 3-bay portico columns, Thượng Song Hạ Bản lattice doors & gilded TRIỀU CHÂU signboard
  for (const czO of [-3.0, -1.0, 1.0, 3.0]) {
    addCyl(w3Wood, 0.12, 0.14, 3.85, 6, tcX - 4.75, tcY + 2.15, tcZ + czO);
  }
  addBox(w3Wood, 1.32, 2.55, 2.1, tcX - 4.0, tcY + 1.52, tcZ);
  addBox(w3Gold, 0.18, 0.62, 3.0, tcX - 4.88, tcY + 3.65, tcZ);
  // 574–576, 598: Courtyard stone Bình Phong, bronze censer, rear Phục Ba sanctuary hall, flanking benches & potted trees
  addBox(w3Stone, 0.45, 2.05, 3.4, tcX - 0.8, tcY + 1.28, tcZ);
  addCyl(w3Bronze, 0.36, 0.28, 0.68, 6, tcX + 0.8, tcY + 0.62, tcZ);
  addBox(w3Plaster, 3.2, 3.9, 8.6, tcX + 3.2, tcY + 2.20, tcZ);
  addBox(w3JadeRoof, 4.2, 0.82, 9.4, tcX + 3.2, tcY + 4.52, tcZ);
  for (const s of [-1, 1]) {
    addBox(w3Stone, 1.45, 0.46, 0.55, tcX - 5.4, tcY + 0.48, tcZ + s * 3.6);
    addBox(w3Core, 0.24, 0.36, 0.24, tcX - 4.8, tcY + 3.15, tcZ + s * 2.0);
    addCyl(w3Stone, 0.34, 0.26, 0.52, 6, tcX - 5.6, tcY + 0.50, tcZ + s * 2.2);
  }

  // 577–600: Hội Quán Phúc Kiến, Chùa Cầu, Nhà Cổ Tấn Ký, Phùng Hưng, Tam Quan Bà Mụ & Giếng Bá Lễ details
  // 577–579, 599: Hội Quán Phúc Kiến guardian lion pedestals, offering desk, flush ridge finial & ventilation medallions
  for (const s of [-1, 1]) {
    addBox(w3Stone, 0.78, 0.85, 0.78, pkX + 1.4, pkBaseY + 0.42, pkZ + s * 2.6);
    addBox(w3Bronze, 0.48, 0.55, 0.48, pkX + 1.4, pkBaseY + 1.12, pkZ + s * 2.6);
    addBox(w3Gold, 0.22, 0.62, 0.62, pkX - 4.2, pkBaseY + 2.25, pkZ + s * 5.2);
  }
  addBox(w3Wood, 0.85, 0.82, 1.85, pkX - 3.2, pkBaseY + 0.42, pkZ);
  addBox(w3Gold, 0.28, 0.32, 6.2, hqX, pkBaseY + 6.55, pkZ);
  // 580–585, 596, 600: Chùa Cầu approach stone curbs, lantern standards, side balustrade panels, knee-braces, abutment rings & West map kiosk
  for (const [px, sgn] of [[165.6, -1], [184.4, 1]] as const) {
    addBox(w3Stone, 0.42, 0.24, 4.6, px, bankY + 0.12, bridgeZ);
    for (const sz of [-2.2, 2.2]) {
      addCyl(w3Wood, 0.06, 0.08, 2.45, 5, px + sgn * 0.4, bankY + 1.15, bridgeZ + sz);
      addBox(w3Core, 0.26, 0.38, 0.26, px + sgn * 0.4, bankY + 2.45, bridgeZ + sz);
    }
  }
  for (const sx of [-3.6, 0, 3.6]) {
    addBox(w3Wood, 2.4, 0.72, 0.14, cx + sx, shrineDeckY + 0.42, bridgeZ + 2.15);
    addBox(w3Wood, 0.18, 0.65, 0.18, cx + sx, shrineDeckY + 2.15, bridgeZ + 1.85);
  }
  addBox(w3Gold, 2.4, 0.32, 0.24, cx, shrineDeckY + 5.38, shrineZ - 0.4);
  addBox(w3Stone, 1.35, 0.85, 0.85, cx - 5.2, 0.55, bridgeZ + 2.55);
  addBox(w3Stone, 1.35, 0.85, 0.85, cx + 5.2, 0.55, bridgeZ + 2.55);
  addBox(w3Wood, 0.95, 1.35, 0.24, 163.2, bankY + 0.72, 41.2);
  addBox(w3Wood, 2.8, 0.24, 1.45, 166.2, bankY + 0.18, 39.2);
  // 586–590: Nhà Cổ Tấn Ký (161.2, 27.4) & Nhà Cổ Phùng Hưng (188.8, 27.4) wooden louvered shutters & balcony balusters
  for (const lz of [25.8, 29.0]) {
    addBox(w3Wood, 0.18, 1.25, 0.92, 161.25, bankY + 4.45, lz);
    addBox(w3Wood, 0.18, 1.25, 0.92, 188.75, bankY + 4.45, lz);
  }
  addBox(w3Wood, 0.16, 1.35, 0.22, 161.25, bankY + 0.82, 25.8);
  addBox(w3Wood, 0.16, 1.35, 0.22, 161.25, bankY + 0.82, 29.0);
  addCyl(w3Stone, 0.55, 0.62, 0.42, 6, 153.8, bankY + 0.22, 27.4);
  // 591–595: Tam Quan Bà Mụ flush ridge crests (seated at ridgeTopY - 0.05!), lotus-pond edge lanterns, ochre wing walls, Giếng Bá Lễ pulley & Alley Arch lanterns
  addBox(w3Gold, 0.22, 0.26, 4.4, bmX, bmY + 6.89, bmZ);
  addBox(w3Gold, 0.22, 0.24, 9.2, bmX, bmY + 4.74, bmZ);
  for (const s of [-1, 1]) {
    addBox(w3Stone, 0.36, 0.92, 0.36, bmX + 5.2, bmY + 0.46, bmZ + s * 3.4);
    addBox(w3Core, 0.24, 0.28, 0.24, bmX + 5.2, bmY + 1.05, bmZ + s * 3.4);
    addBox(w3Plaster, 0.55, 2.2, 3.2, bmX, bmY + 1.10, bmZ + s * 6.4);
  }
  addCyl(w3Wood, 0.12, 0.12, 0.32, 6, 156.8, bankY + 1.85, 34.5, 0, 0, Math.PI * 0.5);
  addBox(w3Stone, 1.15, 0.18, 1.15, 158.2, bankY + 0.10, 34.5);
  addBox(w3Core, 0.24, 0.34, 0.24, 156.5, bankY + 3.25, 39.2);

  // 601–640: Phố Cổ Wooden Shutters (Thượng Song Hạ Bản), Overhead Lantern Alleys, Bạch Đằng Waterfront Benches,
  // Double-Globe Streetlamps, Market Stalls, Boats, Bougainvillea Trellises & Heritage Props
  // 601–606, 634–635, 639–640: Ground-floor Thượng Song Hạ Bản shutters, 2nd-story louvered shutters, awning brackets, Mắt Cửa, signboards & glowing windows (aligned with shophouses!)
  for (const sz of [11.8, 17.0, 22.2, 56.6, 61.8, 67.0, 72.2]) {
    // West bank shophouse face (x ~ 161.2)
    addBox(w3Wood, 0.16, 2.15, 2.4, 161.22, bankY + 1.25, sz);
    addBox(w3Wood, 0.16, 1.15, 1.65, 161.22, bankY + 4.35, sz);
    addBox(w3Wood, 0.95, 0.14, 2.8, 161.75, bankY + 2.75, sz, 0, 0, -0.22);
    addBox(w3Core, 0.14, 0.72, 1.15, 161.18, bankY + 4.35, sz);
    // East bank shophouse face (x ~ 188.8)
    addBox(w3Wood, 0.16, 2.15, 2.4, 188.78, bankY + 1.25, sz);
    addBox(w3Wood, 0.16, 1.15, 1.65, 188.78, bankY + 4.35, sz);
    addBox(w3Wood, 0.95, 0.14, 2.8, 188.25, bankY + 2.75, sz, 0, 0, 0.22);
    addBox(w3Wood, 0.85, 0.34, 0.08, 188.2, bankY + 3.15, sz + 1.4);
    addCyl(w3Bronze, 0.05, 0.05, 3.8, 5, 161.32, bankY + 2.0, sz + 2.2);
  }
  // 607–610: Overhead Hẻm Đèn Lồng (Lantern Alley) cross-poles with grounded posts on BOTH inner & outer ends!
  for (const lz of [18.0, 27.0, 58.0, 68.0]) {
    // West promenade span (x = 161.5..166.0) with grounded inner & outer bamboo poles
    addCyl(w3Wood, 0.05, 0.07, 4.2, 5, 161.5, bankY + 2.05, lz);
    addCyl(w3Wood, 0.05, 0.07, 4.2, 5, 166.0, bankY + 2.05, lz);
    addCyl(w3Wood, 0.04, 0.04, 4.8, 5, 163.75, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    for (const lxO of [-1.2, 0, 1.2]) {
      addBox(w3Core, 0.26, 0.36, 0.26, 163.75 + lxO, bankY + 3.58, lz);
    }
    // East promenade span (x = 184.0..188.5) with grounded inner & outer bamboo poles
    const ez = lz + 4.0;
    addCyl(w3Wood, 0.05, 0.07, 4.2, 5, 184.0, bankY + 2.05, ez);
    addCyl(w3Wood, 0.05, 0.07, 4.2, 5, 188.5, bankY + 2.05, ez);
    addCyl(w3Wood, 0.04, 0.04, 4.8, 5, 186.25, bankY + 3.95, ez, 0, 0, Math.PI * 0.5);
    for (const lxO of [-1.2, 0, 1.2]) {
      addBox(w3Core, 0.26, 0.36, 0.26, 186.25 + lxO, bankY + 3.58, ez);
    }
  }
  // 611–615, 636, 638: Bạch Đằng Waterfront stone benches, double-globe streetlamps, flood-gauge markers, chain bollards & pedestrian posts
  for (const bz of [16.0, 28.0, 58.0, 70.0]) {
    // West quay bench & streetlamp
    addBox(w3Stone, 0.55, 0.48, 1.85, 165.6, bankY + 0.24, bz);
    addCyl(w3Bronze, 0.06, 0.09, 3.4, 5, 165.8, bankY + 1.65, bz + 2.2);
    addBox(w3Core, 0.22, 0.26, 0.22, 165.8, bankY + 3.42, bz + 1.9);
    addBox(w3Core, 0.22, 0.26, 0.22, 165.8, bankY + 3.42, bz + 2.5);
    // East quay bench & streetlamp
    const ez = bz + 4.0;
    addBox(w3Stone, 0.55, 0.48, 1.85, 184.4, bankY + 0.24, ez);
    addCyl(w3Bronze, 0.06, 0.09, 3.4, 5, 184.2, bankY + 1.65, ez - 2.2);
    addBox(w3Core, 0.22, 0.26, 0.22, 184.2, bankY + 3.42, ez - 2.5);
    addBox(w3Core, 0.22, 0.26, 0.22, 184.2, bankY + 3.42, ez - 1.9);
  }
  // 616–620: Boat dock fenders, East dock ticket canopy, 2 southern sampan boats, woven coracle & 12 extra drifting Hoa Đăng lanterns
  addBox(w3Wood, 0.24, 0.32, 4.8, 168.8, 0.42, 34.0);
  addBox(w3Wood, 0.24, 0.32, 4.8, 181.2, 0.42, 56.0);
  addBox(w3Wood, 1.45, 2.25, 1.65, 184.8, bankY + 1.15, 56.0);
  addBox(w3JadeRoof, 1.95, 0.24, 2.15, 184.8, bankY + 2.38, 56.0);
  for (const sz of [72.0, 78.5]) {
    addBox(w3Wood, 1.45, 0.46, 4.6, 179.8, 0.24, sz);
  }
  addCyl(w3Wood, 0.72, 0.52, 0.42, 6, 185.2, bankY + 0.26, 65.5);
  for (let hd = 0; hd < 12; hd++) {
    const hdx = 171.5 + (hd % 3) * 3.2;
    const hdz = 60.5 + hd * 2.0;
    addCone(w3Core, 0.16, 0.14, 5, hdx, 0.12, hdz);
  }
  // 621–633, 637: Chợ Hội An market stalls, Nón Lá pyramids, artisan shopfront upgrades, Bougainvillea trellises, potted frangipani, 2nd Cyclo & café tables
  for (const mz of [18.5, 23.5]) {
    addBox(w3Wood, 1.65, 0.78, 2.2, 186.2, bankY + 0.40, mz);
    for (const pxO of [-0.75, 0.75]) {
      for (const pzO of [-1.0, 1.0]) {
        addCyl(w3Wood, 0.04, 0.05, 2.35, 5, 186.2 + pxO, bankY + 1.12, mz + pzO);
      }
    }
    addBox(w3Crimson, 2.05, 0.16, 2.55, 186.2, bankY + 2.32, mz);
    addCone(w3Gold, 0.32, 0.28, 5, 186.2, bankY + 0.95, mz);
  }
  // 630–631: Cascading magenta Hoa Giấy trellises & terracotta frangipani planters
  for (const [bx, bz] of [[161.4, 17.5], [161.4, 58.5], [188.6, 19.5], [188.6, 66.5]] as const) {
    addBox(w3Wood, 0.12, 3.2, 0.95, bx, bankY + 1.60, bz);
    w3Solid.push(colorizeGeo(new THREE.ConeGeometry(0.68, 1.85, 5).translate(bx, bankY + 2.45, bz), '#c92a76'));
    addCyl(w3Stone, 0.28, 0.22, 0.45, 5, bx + (bx < 175 ? 0.55 : -0.55), bankY + 0.22, bz + 1.1);
  }
  // 632–633, 637–638: 2nd Cyclo on East promenade, heritage bicycle, riverside café tables & pedestrian bollards
  addBox(w3Wood, 1.05, 0.85, 1.75, 186.5, bankY + 0.58, 22.0);
  addBox(w3Crimson, 0.95, 0.65, 0.85, 186.5, bankY + 1.15, 22.3);
  addBox(w3Gold, 0.12, 0.75, 1.35, 161.6, bankY + 0.42, 49.5);
  for (const czO of [36.0, 42.0]) {
    addCyl(w3Wood, 0.42, 0.42, 0.68, 6, 185.4, bankY + 0.34, czO);
  }
  for (const pz of [8.0, 82.0]) {
    addCyl(w3Stone, 0.16, 0.20, 0.78, 5, 163.5, bankY + 0.39, pz);
    addCyl(w3Stone, 0.16, 0.20, 0.78, 5, 186.5, bankY + 0.39, pz);
  }

  addMerged(w3Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w3Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w3Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w3Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w3Gold, ctx.materials.gold, false, false);
  addMerged(w3Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w3JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w3Solid, solidMat, false, true);
  addMerged(w3Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 4 UPGRADES (Items 961–1040): Hội Quán Hải Nam, Chợ Đêm Nguyễn Hoàng,
  // Traditional Silk/Woodcarving Workshop, Bến Phà Bạch Đằng & Cầu Gỗ An Hội
  // =================================================================================================
  const w4Stone: THREE.BufferGeometry[] = [];
  const w4Plaster: THREE.BufferGeometry[] = [];
  const w4Wood: THREE.BufferGeometry[] = [];
  const w4Crimson: THREE.BufferGeometry[] = [];
  const w4Gold: THREE.BufferGeometry[] = [];
  const w4Bronze: THREE.BufferGeometry[] = [];
  const w4JadeRoof: THREE.BufferGeometry[] = [];
  const w4Core: THREE.BufferGeometry[] = [];

  // 961–966: Hội Quán Hải Nam (Hainan Assembly Hall) on East Heritage Quarter (205.5, 58.0)
  const hnX = 205.5;
  const hnZ = 58.0;
  const hnY = Math.max(
    ctx.getHeight(hnX, hnZ),
    ctx.getHeight(hnX - 5.0, hnZ - 4.8),
    ctx.getHeight(hnX + 5.0, hnZ + 4.8)
  );
  addBox(w4Stone, 10.4, 3.2, 9.6, hnX, hnY - 1.35, hnZ);
  addBox(w4Plaster, 1.15, 3.8, 8.8, hnX - 4.0, hnY + 2.15, hnZ);
  addBox(w4JadeRoof, 2.6, 0.65, 9.8, hnX - 4.0, hnY + 4.30, hnZ);
  addBox(w4Plaster, 1.0, 1.45, 4.0, hnX - 4.0, hnY + 5.25, hnZ);
  addBox(w4JadeRoof, 2.2, 0.65, 5.0, hnX - 4.0, hnY + 6.25, hnZ);
  addBox(w4Gold, 0.24, 0.28, 4.4, hnX - 4.0, hnY + 6.68, hnZ);
  for (const czO of [-3.0, -1.0, 1.0, 3.0]) {
    addCyl(w4Stone, 0.20, 0.24, 0.30, 6, hnX - 4.65, hnY + 0.35, hnZ + czO);
    addCyl(w4Crimson, 0.12, 0.14, 3.75, 6, hnX - 4.65, hnY + 2.20, hnZ + czO);
  }
  addBox(w4Crimson, 1.24, 2.55, 2.1, hnX - 4.0, hnY + 1.55, hnZ);
  addBox(w4Gold, 0.18, 0.62, 3.0, hnX - 4.78, hnY + 3.60, hnZ);
  // 965–966: Inner courtyard Bình Phong, bronze tripod, side cloisters & rear sanctuary hall
  addBox(w4Stone, 0.45, 2.05, 3.2, hnX - 0.8, hnY + 1.28, hnZ);
  addCyl(w4Bronze, 0.34, 0.26, 0.65, 6, hnX + 0.8, hnY + 0.60, hnZ);
  addBox(w4Plaster, 3.2, 3.8, 8.6, hnX + 3.2, hnY + 2.15, hnZ);
  addBox(w4JadeRoof, 4.2, 0.82, 9.4, hnX + 3.2, hnY + 4.42, hnZ);
  for (const s of [-1, 1]) {
    addBox(w4Core, 0.24, 0.34, 0.24, hnX - 4.7, hnY + 3.10, hnZ + s * 2.0);
  }

  // 967–970: Chợ Đêm Nguyễn Hoàng (Night Lantern Market) south of Hải Nam on East quarter (205.5, 72.0)
  const nmktX = 205.5;
  const nmktZ = 72.0;
  const nmktY = Math.max(ctx.getHeight(nmktX, nmktZ), ctx.getHeight(nmktX - 4.5, nmktZ - 5.5), ctx.getHeight(nmktX + 4.5, nmktZ + 5.5));
  addBox(w4Stone, 10.2, 3.0, 12.2, nmktX, nmktY - 1.35, nmktZ);
  // 968–969: 4 timber-framed lantern-vendor stalls with 4 grounded posts, crimson canopies & glowing lanterns
  for (const sxO of [-2.8, 2.8]) {
    for (const szO of [-3.2, 3.2]) {
      const stX = nmktX + sxO;
      const stZ = nmktZ + szO;
      addBox(w4Wood, 2.4, 0.78, 3.2, stX, nmktY + 0.55, stZ);
      addBox(w4Crimson, 2.8, 0.22, 3.6, stX, nmktY + 2.68, stZ);
      for (const pxO of [-1.1, 1.1]) {
        for (const pzO of [-1.45, 1.45]) {
          addCyl(w4Wood, 0.05, 0.06, 2.65, 5, stX + pxO, nmktY + 1.38, stZ + pzO);
        }
      }
      addBox(w4Core, 0.24, 0.34, 0.24, stX, nmktY + 2.25, stZ - 0.8);
      addBox(w4Core, 0.24, 0.34, 0.24, stX, nmktY + 2.25, stZ + 0.8);
    }
  }
  // 970: Overhead entrance archway with glowing golden lantern crown
  addCyl(w4Wood, 0.09, 0.11, 3.6, 5, nmktX - 4.8, nmktY + 1.95, nmktZ - 2.2);
  addCyl(w4Wood, 0.09, 0.11, 3.6, 5, nmktX - 4.8, nmktY + 1.95, nmktZ + 2.2);
  addBox(w4Crimson, 0.26, 0.42, 4.8, nmktX - 4.8, nmktY + 3.72, nmktZ);
  addBox(w4Gold, 0.32, 0.32, 0.32, nmktX - 4.8, nmktY + 4.10, nmktZ);

  // 971–974: Xưởng Thủ Công Mỹ Nghệ Hội An (Traditional Silk & Woodcarving Workshop Courtyard at 143.5, 62.0)
  const cwX = 143.5;
  const cwZ = 62.0;
  const cwY = Math.max(ctx.getHeight(cwX, cwZ), ctx.getHeight(cwX - 4.5, cwZ - 4.5), ctx.getHeight(cwX + 4.5, cwZ + 4.5));
  addBox(w4Stone, 9.6, 3.0, 9.6, cwX, cwY - 1.35, cwZ);
  addBox(w4Plaster, 4.2, 3.4, 7.6, cwX - 2.0, cwY + 1.85, cwZ);
  addBox(w4JadeRoof, 5.2, 0.82, 8.6, cwX - 2.0, cwY + 3.92, cwZ);
  for (const pzO of [-3.2, -1.1, 1.1, 3.2]) {
    addCyl(w4Wood, 0.10, 0.12, 3.45, 5, cwX + 0.65, cwY + 1.85, cwZ + pzO);
  }
  // 973–974: Outdoor silk-weaving loom, silk drying rack & woodcarver's bench
  addBox(w4Wood, 1.65, 1.15, 1.15, cwX + 2.8, cwY + 0.72, cwZ - 2.0);
  addBox(w4Crimson, 0.12, 1.65, 2.2, cwX + 3.4, cwY + 1.25, cwZ + 2.0);
  addBox(w4Wood, 1.85, 0.78, 0.85, cwX + 2.4, cwY + 0.55, cwZ + 2.0);

  // 975–1000: Assembly hall garden upgrades (Quảng Đông, Triều Châu, Phúc Kiến side cloisters), Chùa Cầu & artisan lane upgrades
  addCyl(w4Stone, 0.68, 0.68, 0.75, 6, qdX - 1.5, qdY + 0.55, qdZ + 3.2);
  for (const s of [-1, 1]) {
    addBox(w4Stone, 0.78, 0.78, 0.78, qdX + 5.8, qdY + 0.55, qdZ + s * 3.8);
    // 979: Hội Quán Phúc Kiến side-courtyard covered Hành Lang cloisters (at relocated pkZ = 87.2!)
    addBox(w4Plaster, 9.6, 2.6, 0.48, hqX + 1.2, pkBaseY + 1.30, pkZ + s * 5.8);
    addBox(w4JadeRoof, 10.2, 0.55, 1.65, hqX + 1.2, pkBaseY + 2.85, pkZ + s * 5.4);
    addCyl(w4Wood, 0.08, 0.10, 2.75, 5, pkX + 4.8, pkBaseY + 1.38, pkZ + s * 5.2);
    addBox(w4Core, 0.24, 0.34, 0.24, pkX + 4.8, pkBaseY + 2.88, pkZ + s * 5.2);
  }
  addBox(w4Wood, 0.85, 0.82, 1.85, tcX - 2.2, tcY + 0.55, tcZ);
  addBox(w4Stone, 1.65, 0.48, 0.55, 186.2, bankY + 0.24, bridgeZ + 3.8);

  // 1001–1040: Bến Phà Bạch Đằng southern ferry pier, Bến Thuyền Bắc, Cầu Gỗ An Hội north footbridge,
  // extra Hoa Đăng & sampans, extra Lantern Alley spans, Cyclo #3, streetlife & heritage bollards
  // 1001–1003: Bến Phà Bạch Đằng southern wooden ferry pier (167.2, 82.0) + 4-post waiting shelter + ferryboat
  addBox(w4Wood, 3.6, 0.24, 6.2, 167.2, 0.42, 82.0);
  addBox(w4JadeRoof, 3.2, 0.24, 3.6, 164.6, bankY + 2.55, 82.0);
  for (const pxO of [-1.35, 1.35]) {
    for (const pzO of [-1.55, 1.55]) {
      addCyl(w4Wood, 0.06, 0.08, 2.60, 5, 164.6 + pxO, bankY + 1.25, 82.0 + pzO);
    }
  }
  addBox(w4Wood, 1.85, 0.55, 5.6, 170.2, 0.28, 82.0);
  // 1004–1005: Bến Thuyền Bắc northern landing deck (182.8, 14.0) & moored sampan
  addBox(w4Wood, 3.2, 0.22, 5.0, 182.8, 0.42, 14.0);
  addBox(w4Wood, 1.45, 0.48, 4.6, 180.2, 0.24, 14.0);
  // 1006–1007: Cầu Gỗ An Hội northern arched wooden pedestrian footbridge (175.0, 3.5) with railings & twin lantern posts
  addBox(w4Wood, 16.4, 0.28, 2.8, 175.0, bankY + 0.55, 3.5);
  for (const szO of [-1.28, 1.28]) {
    addBox(w4Wood, 16.4, 0.10, 0.10, 175.0, bankY + 1.48, 3.5 + szO);
    for (let bp = -6; bp <= 6; bp += 3) {
      addCyl(w4Wood, 0.06, 0.07, 0.96, 5, 175.0 + bp, bankY + 1.02, 3.5 + szO);
    }
  }
  for (const bxEnd of [166.8, 183.2]) {
    addCyl(w4Wood, 0.08, 0.10, 2.6, 5, bxEnd, bankY + 1.75, 3.5);
    addBox(w4Core, 0.28, 0.38, 0.28, bxEnd, bankY + 3.15, 3.5);
  }
  // 1009: 16 extra floating glowing Hoa Đăng paper lotus lanterns on north & south canal
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 170.5 + (hd % 4) * 3.0;
    const hdz = hd < 8 ? 6.0 + hd * 2.2 : 66.0 + (hd - 8) * 2.4;
    addCone(w4Core, 0.16, 0.14, 5, hdx, 0.12, hdz);
  }
  // 1010–1011: 4 additional overhead Hẻm Đèn Lồng lantern spans (West z = 12, 74; East z = 14, 74)
  for (const [xA, xB, lz] of [[161.5, 166.0, 12.0], [161.5, 166.0, 74.0], [184.0, 188.5, 14.0], [184.0, 188.5, 74.0]] as const) {
    addCyl(w4Wood, 0.05, 0.07, 4.2, 5, xA, bankY + 2.05, lz);
    addCyl(w4Wood, 0.05, 0.07, 4.2, 5, xB, bankY + 2.05, lz);
    addCyl(w4Wood, 0.04, 0.04, 4.8, 5, (xA + xB) * 0.5, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w4Core, 0.24, 0.34, 0.24, (xA + xB) * 0.5, bankY + 3.58, lz);
  }
  // 1012, 1014–1019, 1025, 1028, 1036: North/south streetlamps, flower pushcart, Cyclo #3, café tables, East Hoa Đăng kiosk & map board
  for (const [lx, lz] of [[165.6, 8.5], [184.4, 8.5], [165.6, 81.5], [184.4, 81.5]] as const) {
    addCyl(w4Bronze, 0.06, 0.09, 3.4, 5, lx, bankY + 1.65, lz);
    addBox(w4Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  addBox(w4Wood, 0.85, 0.85, 1.65, 186.2, bankY + 0.52, 30.5);
  addBox(w4Wood, 1.05, 0.85, 1.75, 162.8, bankY + 0.58, 65.5);
  addBox(w4Crimson, 0.95, 0.65, 0.85, 162.8, bankY + 1.15, 65.8);
  addBox(w4Wood, 1.45, 0.85, 1.85, 184.6, bankY + 0.45, 59.5);
  addBox(w4JadeRoof, 1.95, 0.20, 2.25, 184.6, bankY + 2.38, 59.5);
  for (const pxO of [-0.75, 0.75]) {
    for (const pzO of [-0.95, 0.95]) {
      addCyl(w4Wood, 0.045, 0.055, 2.35, 5, 184.6 + pxO, bankY + 1.22, 59.5 + pzO);
    }
  }
  addBox(w4Gold, 0.22, 1.25, 1.15, 186.2, bankY + 1.12, 48.5);

  addMerged(w4Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w4Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w4Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w4Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w4Gold, ctx.materials.gold, false, false);
  addMerged(w4Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w4JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w4Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 5 UPGRADES (Items 1361–1440): Merchant Shophouse Folding Shutters, Yin-Yang Tiled Rooftop
  // Dormers, Nhà Cổ Tấn Ký Courtyard, Overhead Silk Lantern Garlands & Bạch Đằng Waterfront Piers
  // =================================================================================================
  const w5Stone: THREE.BufferGeometry[] = [];
  const w5Plaster: THREE.BufferGeometry[] = [];
  const w5Wood: THREE.BufferGeometry[] = [];
  const w5Crimson: THREE.BufferGeometry[] = [];
  const w5Gold: THREE.BufferGeometry[] = [];
  const w5Bronze: THREE.BufferGeometry[] = [];
  const w5JadeRoof: THREE.BufferGeometry[] = [];
  const w5Core: THREE.BufferGeometry[] = [];

  // 1361–1370: 10 pairs of authentic dark-ironwood folding paneled shophouse shutters (Cửa Bàn Khoa) & shop-awning brackets
  for (const sz of [16.0, 26.5, 37.0, 52.0, 64.5]) {
    // West Trần Phú shophouse facade shutters (x = 161.2)
    addBox(w5Wood, 0.14, 2.15, 0.55, 161.2, bankY + 1.15, sz - 0.95);
    addBox(w5Wood, 0.14, 2.15, 0.55, 161.2, bankY + 1.15, sz + 0.95);
    addBox(w5Wood, 0.85, 0.12, 2.45, 161.55, bankY + 2.45, sz, 0, 0, -0.25);
    // East Bạch Đằng shophouse facade shutters (x = 188.8)
    addBox(w5Wood, 0.14, 2.15, 0.55, 188.8, bankY + 1.15, sz - 0.95);
    addBox(w5Wood, 0.14, 2.15, 0.55, 188.8, bankY + 1.15, sz + 0.95);
    addBox(w5Wood, 0.85, 0.12, 2.45, 188.45, bankY + 2.45, sz, 0, 0, 0.25);
  }

  // 1371–1380: 8 projecting yin-yang tiled rooftop dormers (Cửa Sổ Mái Âm Dương), Mắt Cửa door-eye plaques & gable firewalls
  for (const dz of [21.0, 35.0, 55.0, 69.0]) {
    // West row rooftop dormers seated flush on shophouse eaves
    addBox(w5Plaster, 1.35, 1.15, 1.65, 159.8, bankY + 5.65, dz);
    addBox(w5JadeRoof, 1.75, 0.42, 2.05, 159.8, bankY + 6.38, dz);
    // East row rooftop dormers seated flush
    addBox(w5Plaster, 1.35, 1.15, 1.65, 190.2, bankY + 5.65, dz);
    addBox(w5JadeRoof, 1.75, 0.42, 2.05, 190.2, bankY + 6.38, dz);
    // 1379: Gilded Mắt Cửa door-eye plaques
    addBox(w5Gold, 0.12, 0.28, 0.65, 161.3, bankY + 2.68, dz);
    addBox(w5Gold, 0.12, 0.28, 0.65, 188.7, bankY + 2.68, dz);
  }

  // 1381–1388: Nhà Cổ Tấn Ký (Merchant Heritage Courtyard House at 143.5, 44.0)
  const tkX = 143.5;
  const tkZ = 44.0;
  const tkY = Math.max(ctx.getHeight(tkX, tkZ), ctx.getHeight(tkX - 4.5, tkZ - 4.5), ctx.getHeight(tkX + 4.5, tkZ + 4.5));
  addBox(w5Stone, 9.6, 5.6, 9.2, tkX, tkY - 2.65, tkZ);
  addBox(w5Plaster, 4.6, 3.6, 7.8, tkX - 1.8, tkY + 1.95, tkZ);
  addBox(w5JadeRoof, 5.8, 0.88, 8.8, tkX - 1.8, tkY + 4.10, tkZ);
  for (const pzO of [-3.2, -1.1, 1.1, 3.2]) {
    addCyl(w5Wood, 0.10, 0.12, 3.55, 5, tkX + 0.95, tkY + 1.88, tkZ + pzO);
  }
  addBox(w5Gold, 0.18, 0.52, 2.6, tkX + 1.02, tkY + 3.15, tkZ);
  addCyl(w5Stone, 0.78, 0.85, 0.62, 6, tkX + 3.0, tkY + 0.45, tkZ);
  addBox(w5Wood, 1.15, 0.85, 2.4, tkX + 2.4, tkY + 0.58, tkZ - 2.6);
  for (const s of [-1, 1]) {
    addBox(w5Core, 0.24, 0.34, 0.24, tkX + 1.15, tkY + 2.95, tkZ + s * 2.1);
  }

  // 1389–1400: Assembly hall Hoành Phi & incense racks, Chùa Cầu flood-gauge & ridge finials, artisan street displays
  addBox(w5Gold, 0.18, 0.58, 3.2, pkX + 4.7, pkBaseY + 3.45, pkZ);
  addCyl(w5Bronze, 0.34, 0.26, 0.68, 6, qdX + 3.8, qdY + 0.52, qdZ);
  addBox(w5Gold, 0.18, 0.52, 2.4, tcX - 2.8, tcY + 3.25, tcZ);
  addBox(w5Core, 0.24, 0.34, 0.24, hnX - 4.7, hnY + 3.10, hnZ);
  // 1393–1395: Chùa Cầu flood-level marker pillar, ridge crest accent & west ticket desk
  addBox(w5Stone, 0.36, 2.15, 0.36, 166.4, bankY + 1.08, bridgeZ - 2.8);
  addBox(w5Gold, 0.32, 0.36, 1.45, 175.0, bankY + 5.75, bridgeZ);
  addBox(w5Wood, 1.15, 0.85, 1.65, 164.2, bankY + 0.45, bridgeZ + 3.2);
  // 1396–1398: Tailor silk-bolt rack, ceramic pottery shelf & lantern-frame drying stand
  addBox(w5Wood, 0.65, 1.65, 1.85, 161.6, bankY + 0.85, 31.5);
  addBox(w5Crimson, 0.42, 0.95, 1.45, 161.6, bankY + 1.05, 31.5);
  addBox(w5Wood, 0.65, 1.55, 1.85, 188.4, bankY + 0.80, 41.5);
  addBox(w5Wood, 0.14, 2.2, 2.2, cwX + 3.6, cwY + 1.25, cwZ - 2.8);

  // 1401–1410: 6 crisscrossing overhead silk lantern garlands (18 glowing lanterns) + 4 diagonal riverfront garlands
  for (const lz of [20.0, 30.0, 40.0, 50.0, 62.0, 70.0]) {
    addCyl(w5Wood, 0.05, 0.07, 4.4, 5, 161.8, bankY + 2.10, lz);
    addCyl(w5Wood, 0.05, 0.07, 4.4, 5, 166.2, bankY + 2.10, lz);
    addCyl(w5Wood, 0.035, 0.035, 4.6, 5, 164.0, bankY + 4.05, lz, 0, 0, Math.PI * 0.5);
    for (const lx of [162.8, 164.0, 165.2]) {
      addBox(w5Core, 0.24, 0.34, 0.24, lx, bankY + 3.65, lz);
    }
  }
  for (const lz of [24.0, 38.0, 54.0, 68.0]) {
    addCyl(w5Wood, 0.05, 0.07, 4.4, 5, 183.8, bankY + 2.10, lz);
    addCyl(w5Wood, 0.05, 0.07, 4.4, 5, 188.2, bankY + 2.10, lz);
    addCyl(w5Wood, 0.035, 0.035, 4.6, 5, 186.0, bankY + 4.05, lz, 0, 0, Math.PI * 0.5);
    addBox(w5Core, 0.24, 0.34, 0.24, 185.2, bankY + 3.65, lz);
    addBox(w5Core, 0.24, 0.34, 0.24, 186.8, bankY + 3.65, lz);
  }

  // 1411–1426: 4 stepped stone river-landing stairs, West/East mid-promenade wooden sampan piers,
  // 3 moored Sông Hoài rowing sampans with canopies & bow lanterns, bamboo coracle & 20 extra Hoa Đăng
  for (const rz of [26.0, 62.0]) {
    addBox(w5Stone, 1.85, 0.72, 2.8, 166.6, 0.45, rz);
    addBox(w5Stone, 1.85, 0.72, 2.8, 183.4, 0.45, rz);
  }
  // 1415–1416: West (167.4, 48.0) & East (182.6, 36.0) mid-promenade wooden boarding piers on grounded pilings
  addBox(w5Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 48.0);
  addBox(w5Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 36.0);
  for (const [px, pz] of [[168.6, 46.0], [168.6, 50.0], [181.4, 34.0], [181.4, 38.0]] as const) {
    addCyl(w5Wood, 0.09, 0.11, 2.2, 5, px, -0.45, pz);
  }
  // 1419–1423: 3 wooden Sông Hoài rowing sampans with curved canopies & glowing bow lanterns + coracle
  for (const [sx, sz] of [[169.8, 48.0], [180.2, 36.0], [170.2, 26.0]] as const) {
    addBox(w5Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w5JadeRoof, 1.35, 0.65, 2.2, sx, 0.78, sz);
    addBox(w5Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  addCyl(w5Wood, 0.72, 0.50, 0.38, 6, 165.4, bankY + 0.22, 62.0);
  // 1424–1426: 20 extra glowing floating Hoa Đăng paper lotus lanterns along central canal
  for (let hd = 0; hd < 20; hd++) {
    const hdx = 171.2 + (hd % 4) * 2.5;
    const hdz = 16.0 + hd * 3.1;
    addCone(w5Core, 0.16, 0.14, 5, hdx, 0.12, hdz);
  }

  // 1427–1440: 2 night-market noodle stalls, illuminated lantern tree, riverside café tables, Cyclo #4,
  // UNESCO heritage monolith, 4 bronze streetlamps, Bến Thuyền Bắc 4-post canopy & riverside benches
  for (const kz of [67.0, 77.0]) {
    addBox(w5Wood, 2.0, 0.78, 2.4, nmktX + 5.8, nmktY + 0.52, kz);
    addBox(w5Crimson, 2.4, 0.18, 2.8, nmktX + 5.8, nmktY + 2.58, kz);
    for (const ox of [-0.95, 0.95]) {
      for (const oz of [-1.1, 1.1]) {
        addCyl(w5Wood, 0.045, 0.055, 2.55, 5, nmktX + 5.8 + ox, nmktY + 1.32, kz + oz);
      }
    }
  }
  // 1428 & 1430–1433: Illuminated lantern tree, Cyclo #4, UNESCO monolith & 4 north/south bronze streetlamps
  addCyl(w5Wood, 0.09, 0.12, 3.6, 5, nmktX - 5.2, nmktY + 1.85, nmktZ + 4.8);
  addBox(w5Core, 0.32, 0.42, 0.32, nmktX - 5.2, nmktY + 3.65, nmktZ + 4.8);
  addBox(w5Wood, 1.05, 0.85, 1.75, 163.2, bankY + 0.58, 7.5);
  addBox(w5Crimson, 0.95, 0.65, 0.85, 163.2, bankY + 1.15, 7.8);
  addBox(w5Stone, 0.95, 1.85, 0.42, 162.8, bankY + 0.92, bridgeZ - 5.2);
  for (const [lx, lz] of [[165.6, 22.0], [184.4, 22.0], [165.6, 66.0], [184.4, 66.0]] as const) {
    addCyl(w5Bronze, 0.06, 0.09, 3.4, 5, lx, bankY + 1.65, lz);
    addBox(w5Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  // 1438 & 1440: Bến Thuyền Bắc 4-post boatman canopy & 4 riverside viewing benches
  addBox(w5JadeRoof, 3.0, 0.22, 3.4, 184.8, bankY + 2.55, 14.0);
  for (const ox of [-1.25, 1.25]) {
    for (const oz of [-1.45, 1.45]) {
      addCyl(w5Wood, 0.06, 0.08, 2.60, 5, 184.8 + ox, bankY + 1.25, 14.0 + oz);
    }
  }
  for (const [bx, bz] of [[165.2, 34.0], [165.2, 56.0], [184.8, 32.0], [184.8, 52.0]] as const) {
    addBox(w5Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w5Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w5Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w5Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w5Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w5Gold, ctx.materials.gold, false, false);
  addMerged(w5Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w5JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w5Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 6 UPGRADES (Items 1761–1840): West & East Outer Craft Alleys, Slanted Tailor Awnings,
  // 10 Alley-Mouth Silk Lantern Garlands, 2 New Sông Hoài Wooden Boarding Piers & Moored Sampans
  // =================================================================================================
  const w6Stone: THREE.BufferGeometry[] = [];
  const w6Plaster: THREE.BufferGeometry[] = [];
  const w6Wood: THREE.BufferGeometry[] = [];
  const w6Crimson: THREE.BufferGeometry[] = [];
  const w6Gold: THREE.BufferGeometry[] = [];
  const w6Bronze: THREE.BufferGeometry[] = [];
  const w6JadeRoof: THREE.BufferGeometry[] = [];
  const w6Core: THREE.BufferGeometry[] = [];

  // 1761–1768: Hẻm May Đo & Thủ Công Tây (West Outer Tailor Craft Alley at 143.5, 24.0)
  const taX = 143.5;
  const taZ = 24.0;
  const taY = Math.max(ctx.getHeight(taX, taZ), ctx.getHeight(taX - 4.4, taZ - 4.2), ctx.getHeight(taX + 4.4, taZ + 4.2));
  addBox(w6Stone, 9.4, 5.6, 8.8, taX, taY - 2.65, taZ);
  addBox(w6Plaster, 4.4, 3.5, 7.4, taX - 1.8, taY + 1.90, taZ);
  addBox(w6JadeRoof, 5.6, 0.85, 8.4, taX - 1.8, taY + 3.98, taZ);
  addBox(w6Wood, 2.2, 0.16, 7.2, taX + 1.4, taY + 3.15, taZ, 0, 0, -0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w6Wood, 0.09, 0.11, 3.15, 4, taX + 2.2, taY + 1.62, taZ + pzO);
  }
  addBox(w6Gold, 0.16, 0.52, 2.8, taX + 2.32, taY + 3.05, taZ);
  addBox(w6Wood, 0.62, 1.65, 1.85, taX + 3.2, taY + 0.95, taZ - 2.0);
  addBox(w6Crimson, 0.40, 0.95, 1.45, taX + 3.2, taY + 1.12, taZ - 2.0);
  addBox(w6Wood, 1.15, 0.82, 1.85, taX + 3.0, taY + 0.55, taZ + 2.0);
  for (const s of [-1, 1]) {
    addBox(w6Core, 0.24, 0.34, 0.24, taX + 2.4, taY + 2.75, taZ + s * 2.0);
    addCyl(w6Stone, 0.28, 0.22, 0.46, 5, taX + 3.6, taY + 0.35, taZ + s * 3.4);
  }

  // 1769–1776: Hẻm Đèn Lồng & Gốm Thanh Hà Đông (East Outer Craft & Pottery Alley at 205.5, 34.0)
  const paX = 205.5;
  const paZ = 34.0;
  const paY = Math.max(ctx.getHeight(paX, paZ), ctx.getHeight(paX - 4.4, paZ - 4.2), ctx.getHeight(paX + 4.4, paZ + 4.2));
  addBox(w6Stone, 9.4, 5.6, 8.8, paX, paY - 2.65, paZ);
  addBox(w6Plaster, 4.4, 3.5, 7.4, paX + 1.8, paY + 1.90, paZ);
  addBox(w6JadeRoof, 5.6, 0.85, 8.4, paX + 1.8, paY + 3.98, paZ);
  addBox(w6Wood, 2.2, 0.16, 7.2, paX - 1.4, paY + 3.15, paZ, 0, 0, 0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w6Wood, 0.09, 0.11, 3.15, 4, paX - 2.2, paY + 1.62, paZ + pzO);
  }
  addBox(w6Gold, 0.16, 0.52, 2.8, paX - 2.32, paY + 3.05, paZ);
  addBox(w6Wood, 0.62, 1.55, 2.0, paX - 3.2, paY + 0.90, paZ - 1.8);
  addBox(w6Wood, 0.14, 2.1, 2.0, paX - 3.2, paY + 1.15, paZ + 2.0);
  addCyl(w6Stone, 0.72, 0.78, 0.62, 5, paX - 3.8, paY + 0.45, paZ);
  for (const s of [-1, 1]) {
    addBox(w6Core, 0.24, 0.34, 0.24, paX - 2.4, paY + 2.75, paZ + s * 2.0);
  }

  // 1777–1788: 6 slanted tailor-shop weather awnings, upper louvered shutters, Mắt Cửa & silk shop banners
  for (const az of [19.0, 32.0, 46.0]) {
    addBox(w6Wood, 1.05, 0.12, 2.6, 161.65, bankY + 2.52, az, 0, 0, -0.26);
    addBox(w6Wood, 1.05, 0.12, 2.6, 188.35, bankY + 2.52, az, 0, 0, 0.26);
    addBox(w6Crimson, 0.10, 1.15, 0.48, 161.9, bankY + 2.15, az + 1.5);
    addBox(w6Crimson, 0.10, 1.15, 0.48, 188.1, bankY + 2.15, az + 1.5);
  }
  for (const uz of [23.5, 58.5]) {
    addBox(w6Wood, 0.14, 1.45, 1.15, 161.1, bankY + 4.25, uz);
    addBox(w6Wood, 0.14, 1.45, 1.15, 188.9, bankY + 4.25, uz);
    addBox(w6Gold, 0.12, 0.26, 0.62, 161.3, bankY + 2.68, uz);
    addBox(w6Gold, 0.12, 0.26, 0.62, 188.7, bankY + 2.68, uz);
  }

  // 1789–1800: Assembly halls, Chùa Cầu east bench/plaque/lanterns, Tấn Ký tea table & Xưởng woodblock bench
  addCyl(w6Stone, 0.42, 0.34, 0.65, 5, pkX + 2.4, pkBaseY + 0.45, pkZ);
  addBox(w6Wood, 1.15, 0.82, 1.85, qdX + 1.6, qdY + 0.55, qdZ);
  addBox(w6Stone, 0.72, 0.78, 0.72, tcX - 3.6, tcY + 0.52, tcZ - 2.4);
  addBox(w6Stone, 0.72, 0.78, 0.72, tcX - 3.6, tcY + 0.52, tcZ + 2.4);
  addCyl(w6Stone, 0.68, 0.74, 0.58, 5, hnX + 1.2, hnY + 0.45, hnZ + 2.8);
  addBox(w6Wood, 0.56, 0.46, 1.85, 184.2, bankY + 0.24, bridgeZ + 3.2);
  addBox(w6Gold, 0.18, 0.65, 0.95, 183.6, bankY + 1.05, bridgeZ - 2.8);
  for (const s of [-1, 1]) {
    addCyl(w6Bronze, 0.06, 0.08, 3.2, 4, 183.8, bankY + 1.60, bridgeZ + s * 2.2);
    addBox(w6Core, 0.24, 0.30, 0.24, 183.8, bankY + 3.32, bridgeZ + s * 2.2);
  }
  addBox(w6Wood, 1.15, 0.68, 1.15, tkX + 2.8, tkY + 0.48, tkZ + 2.4);
  addBox(w6Wood, 1.45, 0.78, 0.85, cwX + 2.8, cwY + 0.52, cwZ);

  // 1801–1810: 10 West & East outer-alley overhead silk lantern garlands
  for (const lz of [24.0, 34.0, 44.0, 54.0, 64.0]) {
    // West alley-mouth lantern garland
    addCyl(w6Wood, 0.05, 0.07, 4.2, 4, 152.0, bankY + 2.05, lz);
    addCyl(w6Wood, 0.05, 0.07, 4.2, 4, 158.0, bankY + 2.05, lz);
    addCyl(w6Wood, 0.035, 0.035, 6.2, 4, 155.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w6Core, 0.24, 0.34, 0.24, 153.8, bankY + 3.58, lz);
    addBox(w6Core, 0.24, 0.34, 0.24, 156.2, bankY + 3.58, lz);
    // East alley-mouth lantern garland
    addCyl(w6Wood, 0.05, 0.07, 4.2, 4, 192.0, bankY + 2.05, lz);
    addCyl(w6Wood, 0.05, 0.07, 4.2, 4, 198.0, bankY + 2.05, lz);
    addCyl(w6Wood, 0.035, 0.035, 6.2, 4, 195.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w6Core, 0.24, 0.34, 0.24, 193.8, bankY + 3.58, lz);
    addBox(w6Core, 0.24, 0.34, 0.24, 196.2, bankY + 3.58, lz);
  }

  // 1811–1826: 2 new wooden sampan boarding piers (West 167.4, 20.0 & East 182.6, 68.0),
  // 4 moored Sông Hoài rowing sampans & 16 additional floating Hoa Đăng lotus lanterns
  addBox(w6Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 20.0);
  addBox(w6Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 68.0);
  for (const [px, pz] of [[168.6, 18.0], [168.6, 22.0], [181.4, 66.0], [181.4, 70.0]] as const) {
    addCyl(w6Wood, 0.09, 0.11, 2.2, 4, px, -0.45, pz);
  }
  addBox(w6Stone, 1.85, 0.72, 2.6, 166.4, 0.45, 20.0);
  addBox(w6Stone, 1.85, 0.72, 2.6, 183.6, 0.45, 68.0);
  // 1815: East South-Mid pier 4-post boatman shade canopy
  addBox(w6JadeRoof, 2.8, 0.20, 3.2, 184.8, bankY + 2.55, 68.0);
  for (const ox of [-1.15, 1.15]) {
    for (const oz of [-1.35, 1.35]) {
      addCyl(w6Wood, 0.055, 0.075, 2.60, 4, 184.8 + ox, bankY + 1.25, 68.0 + oz);
    }
  }
  // 1819–1822: 4 moored Sông Hoài wooden sampans with canopies & bow lanterns
  for (const [sx, sz] of [[169.8, 20.0], [180.2, 68.0], [170.0, 62.0], [179.8, 24.0]] as const) {
    addBox(w6Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w6JadeRoof, 1.32, 0.62, 2.1, sx, 0.76, sz);
    addBox(w6Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 171.4 + (hd % 4) * 2.4;
    const hdz = 12.0 + hd * 4.2;
    addCone(w6Core, 0.16, 0.14, 4, hdx, 0.12, hdz);
  }

  // 1827–1840: Chợ Đêm festival arches, riverside coffee tables, Cyclo #5, bronze streetlamps & benches
  for (const dz of [-6.8, 6.8]) {
    addCyl(w6Wood, 0.08, 0.10, 3.6, 4, nmktX - 2.2, nmktY + 1.85, nmktZ + dz);
    addCyl(w6Wood, 0.08, 0.10, 3.6, 4, nmktX + 2.2, nmktY + 1.85, nmktZ + dz);
    addBox(w6Crimson, 4.8, 0.36, 0.24, nmktX, nmktY + 3.65, nmktZ + dz);
    addBox(w6Core, 0.28, 0.34, 0.28, nmktX, nmktY + 3.25, nmktZ + dz);
  }
  addBox(w6Wood, 1.05, 0.85, 1.75, 192.5, bankY + 0.58, 34.0);
  addBox(w6Crimson, 0.95, 0.65, 0.85, 192.5, bankY + 1.15, 34.3);
  for (const [lx, lz] of [[165.6, 15.0], [184.4, 15.0], [165.6, 75.0], [184.4, 75.0]] as const) {
    addCyl(w6Bronze, 0.06, 0.08, 3.4, 4, lx, bankY + 1.65, lz);
    addBox(w6Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  for (const [bx, bz] of [[164.8, 28.0], [164.8, 60.0], [185.2, 28.0], [185.2, 60.0]] as const) {
    addBox(w6Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w6Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w6Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w6Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w6Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w6Gold, ctx.materials.gold, false, false);
  addMerged(w6Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w6JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w6Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 7 UPGRADES (Items 2161–2240): West Thanh Hà Pottery Guild, East Kim Bồng Carpentry Guild,
  // Shophouse Eaves & Shutters, 10 Outer-Alley Lantern Garlands, 2 New Piers & 4 Moored Sampans
  // =================================================================================================
  const w7Stone: THREE.BufferGeometry[] = [];
  const w7Plaster: THREE.BufferGeometry[] = [];
  const w7Wood: THREE.BufferGeometry[] = [];
  const w7Crimson: THREE.BufferGeometry[] = [];
  const w7Gold: THREE.BufferGeometry[] = [];
  const w7Bronze: THREE.BufferGeometry[] = [];
  const w7JadeRoof: THREE.BufferGeometry[] = [];
  const w7Core: THREE.BufferGeometry[] = [];

  // 2161–2168: Làng Gốm Thanh Hà — Sân Lò Nung Gốm Tây (West Terracotta Pottery Guild at 143.5, 80.0)
  const thGX = 143.5;
  const thGZ = 80.0;
  const thGY = Math.max(ctx.getHeight(thGX, thGZ), ctx.getHeight(thGX - 4.4, thGZ - 4.2), ctx.getHeight(thGX + 4.4, thGZ + 4.2));
  addBox(w7Stone, 9.4, 5.6, 8.8, thGX, thGY - 2.65, thGZ);
  addBox(w7Plaster, 4.4, 3.5, 7.4, thGX - 1.8, thGY + 1.90, thGZ);
  addBox(w7JadeRoof, 5.6, 0.85, 8.4, thGX - 1.8, thGY + 3.98, thGZ);
  addBox(w7Wood, 2.2, 0.16, 7.2, thGX + 1.4, thGY + 3.15, thGZ, 0, 0, -0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w7Wood, 0.09, 0.11, 3.15, 4, thGX + 2.2, thGY + 1.62, thGZ + pzO);
  }
  addCyl(w7Stone, 0.85, 1.35, 1.65, 5, thGX + 3.2, thGY + 0.92, thGZ - 2.2);
  addBox(w7Wood, 1.15, 0.82, 1.65, thGX + 3.0, thGY + 0.55, thGZ + 1.8);
  addBox(w7Wood, 0.62, 1.45, 1.85, thGX + 3.4, thGY + 0.85, thGZ);
  addBox(w7Gold, 0.16, 0.52, 2.8, thGX + 2.32, thGY + 3.05, thGZ);
  for (const s of [-1, 1]) {
    addBox(w7Core, 0.24, 0.34, 0.24, thGX + 2.4, thGY + 2.75, thGZ + s * 2.0);
    addCyl(w7Stone, 0.28, 0.22, 0.46, 5, thGX + 3.8, thGY + 0.35, thGZ + s * 3.4);
  }

  // 2169–2176: Làng Mộc Kim Bồng — Xưởng Chạm Khắc Gỗ Đông (East Carpentry Guild at 205.5, 54.0)
  const kbGX = 205.5;
  const kbGZ = 54.0;
  const kbGY = Math.max(ctx.getHeight(kbGX, kbGZ), ctx.getHeight(kbGX - 4.4, kbGZ - 4.2), ctx.getHeight(kbGX + 4.4, kbGZ + 4.2));
  addBox(w7Stone, 9.4, 5.6, 8.8, kbGX, kbGY - 2.65, kbGZ);
  addBox(w7Plaster, 4.4, 3.5, 7.4, kbGX + 1.8, kbGY + 1.90, kbGZ);
  addBox(w7JadeRoof, 5.6, 0.85, 8.4, kbGX + 1.8, kbGY + 3.98, kbGZ);
  addBox(w7Wood, 2.2, 0.16, 7.2, kbGX - 1.4, kbGY + 3.15, kbGZ, 0, 0, 0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w7Wood, 0.09, 0.11, 3.15, 4, kbGX - 2.2, kbGY + 1.62, kbGZ + pzO);
  }
  addBox(w7Wood, 1.35, 0.55, 3.8, kbGX - 3.2, kbGY + 0.65, kbGZ - 1.6);
  addBox(w7Wood, 1.15, 0.80, 1.85, kbGX - 3.2, kbGY + 0.55, kbGZ + 2.0);
  addBox(w7Gold, 0.16, 0.52, 2.8, kbGX - 2.32, kbGY + 3.05, kbGZ);
  addCyl(w7Stone, 0.68, 0.74, 0.58, 5, kbGX - 3.8, kbGY + 0.42, kbGZ);
  for (const s of [-1, 1]) {
    addBox(w7Core, 0.24, 0.34, 0.24, kbGX - 2.4, kbGY + 2.75, kbGZ + s * 2.0);
  }

  // 2177–2188: 8 slanted shophouse awnings, crimson guild flags, upper louvered shutters & Mắt Cửa plaques
  for (const az of [11.5, 29.0, 42.5, 61.5]) {
    addBox(w7Wood, 1.05, 0.12, 2.6, 161.65, bankY + 2.52, az, 0, 0, -0.26);
    addBox(w7Wood, 1.05, 0.12, 2.6, 188.35, bankY + 2.52, az, 0, 0, 0.26);
    addBox(w7Crimson, 0.10, 1.15, 0.48, 161.9, bankY + 2.15, az + 1.5);
    addBox(w7Crimson, 0.10, 1.15, 0.48, 188.1, bankY + 2.15, az + 1.5);
  }
  for (const uz of [14.5, 49.5]) {
    addBox(w7Wood, 0.14, 1.45, 1.15, 161.1, bankY + 4.25, uz);
    addBox(w7Wood, 0.14, 1.45, 1.15, 188.9, bankY + 4.25, uz);
    addBox(w7Gold, 0.12, 0.26, 0.62, 161.3, bankY + 2.68, uz);
    addBox(w7Gold, 0.12, 0.26, 0.62, 188.7, bankY + 2.68, uz);
  }

  // 2189–2200: Assembly hall furnishings, Chùa Cầu bollards/lanterns & courtyard artisan props
  addBox(w7Wood, 1.15, 0.82, 1.85, pkX + 2.4, pkBaseY + 0.55, pkZ - 2.6);
  addBox(w7Stone, 0.48, 1.35, 0.48, qdX + 4.2, qdY + 0.68, qdZ - 3.2);
  addBox(w7Stone, 0.48, 1.35, 0.48, qdX + 4.2, qdY + 0.68, qdZ + 3.2);
  addCyl(w7Stone, 0.36, 0.28, 0.58, 5, tcX - 3.2, tcY + 0.45, tcZ);
  addBox(w7Wood, 1.15, 0.80, 1.65, hnX - 2.6, hnY + 0.55, hnZ);
  for (const s of [-1, 1]) {
    addBox(w7Stone, 0.42, 0.95, 0.42, 166.2, bankY + 0.48, bridgeZ + s * 2.6);
    addCyl(w7Bronze, 0.06, 0.08, 3.2, 4, 166.2, bankY + 1.60, bridgeZ + s * 3.6);
    addBox(w7Core, 0.24, 0.30, 0.24, 166.2, bankY + 3.32, bridgeZ + s * 3.6);
  }
  addBox(w7Stone, 0.85, 0.72, 0.85, tkX + 3.4, tkY + 0.48, tkZ - 1.8);
  addBox(w7Wood, 1.45, 0.78, 0.85, taX + 3.2, taY + 0.52, taZ);

  // 2201–2210: 10 West & East outer-alley overhead silk lantern garlands
  for (const lz of [18.0, 28.0, 48.0, 58.0, 72.0]) {
    addCyl(w7Wood, 0.05, 0.07, 4.2, 4, 152.0, bankY + 2.05, lz);
    addCyl(w7Wood, 0.05, 0.07, 4.2, 4, 158.0, bankY + 2.05, lz);
    addCyl(w7Wood, 0.035, 0.035, 6.2, 4, 155.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w7Core, 0.24, 0.34, 0.24, 153.8, bankY + 3.58, lz);
    addBox(w7Core, 0.24, 0.34, 0.24, 156.2, bankY + 3.58, lz);

    addCyl(w7Wood, 0.05, 0.07, 4.2, 4, 192.0, bankY + 2.05, lz);
    addCyl(w7Wood, 0.05, 0.07, 4.2, 4, 198.0, bankY + 2.05, lz);
    addCyl(w7Wood, 0.035, 0.035, 6.2, 4, 195.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w7Core, 0.24, 0.34, 0.24, 193.8, bankY + 3.58, lz);
    addBox(w7Core, 0.24, 0.34, 0.24, 196.2, bankY + 3.58, lz);
  }

  // 2211–2226: 2 new wooden sampan piers (West South 167.4, 74.0 & East North-Mid 182.6, 26.0),
  // 4-post boatman shade canopy, 4 moored sampans & 16 extra floating Hoa Đăng lotus lanterns
  addBox(w7Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 74.0);
  addBox(w7Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 26.0);
  for (const [px, pz] of [[168.6, 72.0], [168.6, 76.0], [181.4, 24.0], [181.4, 28.0]] as const) {
    addCyl(w7Wood, 0.09, 0.11, 2.2, 4, px, -0.45, pz);
  }
  addBox(w7Stone, 1.85, 0.72, 2.6, 166.4, 0.45, 74.0);
  addBox(w7Stone, 1.85, 0.72, 2.6, 183.6, 0.45, 26.0);
  addBox(w7JadeRoof, 2.8, 0.20, 3.2, 165.2, bankY + 2.55, 74.0);
  for (const ox of [-1.15, 1.15]) {
    for (const oz of [-1.35, 1.35]) {
      addCyl(w7Wood, 0.055, 0.075, 2.60, 4, 165.2 + ox, bankY + 1.25, 74.0 + oz);
    }
  }
  for (const [sx, sz] of [[169.8, 74.0], [180.2, 26.0], [170.2, 34.0], [179.8, 56.0]] as const) {
    addBox(w7Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w7JadeRoof, 1.32, 0.62, 2.1, sx, 0.76, sz);
    addBox(w7Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 171.6 + (hd % 4) * 2.3;
    const hdz = 14.0 + hd * 4.0;
    addCone(w7Core, 0.16, 0.14, 4, hdx, 0.12, hdz);
  }

  // 2227–2240: Chợ Đêm handicraft stall, Cyclo #6, 4 bronze streetlamps & 4 promenade benches
  addBox(w7Wood, 2.2, 0.78, 2.6, nmktX + 5.8, nmktY + 0.52, 72.0);
  addBox(w7Crimson, 2.6, 0.18, 3.0, nmktX + 5.8, nmktY + 2.58, 72.0);
  for (const ox of [-1.0, 1.0]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w7Wood, 0.045, 0.055, 2.55, 4, nmktX + 5.8 + ox, nmktY + 1.32, 72.0 + oz);
    }
  }
  addBox(w7Wood, 1.05, 0.85, 1.75, 193.0, bankY + 0.58, 54.0);
  addBox(w7Crimson, 0.95, 0.65, 0.85, 193.0, bankY + 1.15, 54.3);
  for (const [lx, lz] of [[165.6, 36.0], [184.4, 36.0], [165.6, 54.0], [184.4, 54.0]] as const) {
    addCyl(w7Bronze, 0.06, 0.08, 3.4, 4, lx, bankY + 1.65, lz);
    addBox(w7Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  for (const [bx, bz] of [[164.8, 18.0], [164.8, 68.0], [185.2, 18.0], [185.2, 68.0]] as const) {
    addBox(w7Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w7Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w7Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w7Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w7Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w7Gold, ctx.materials.gold, false, false);
  addMerged(w7Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w7JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w7Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 8 UPGRADES (Items 2561–2640): West Làng Lụa Silk Guild, East Minh An Lantern Guild,
  // Shophouse Awnings & Shutters, 10 Outer-Alley Lantern Garlands, 2 New Piers & 4 Moored Sampans
  // =================================================================================================
  const w8Stone: THREE.BufferGeometry[] = [];
  const w8Plaster: THREE.BufferGeometry[] = [];
  const w8Wood: THREE.BufferGeometry[] = [];
  const w8Crimson: THREE.BufferGeometry[] = [];
  const w8Gold: THREE.BufferGeometry[] = [];
  const w8Bronze: THREE.BufferGeometry[] = [];
  const w8JadeRoof: THREE.BufferGeometry[] = [];
  const w8Core: THREE.BufferGeometry[] = [];

  // 2561–2568: Làng Lụa Hội An — Xưởng Dệt Lụa Tây (West Heritage Silk-Weaving Guild at 143.5, 62.0)
  const sl8X = 143.5;
  const sl8Z = 62.0;
  const sl8Y = Math.max(ctx.getHeight(sl8X, sl8Z), ctx.getHeight(sl8X - 4.4, sl8Z - 4.2), ctx.getHeight(sl8X + 4.4, sl8Z + 4.2));
  addBox(w8Stone, 9.4, 5.6, 8.8, sl8X, sl8Y - 2.65, sl8Z);
  addBox(w8Plaster, 4.4, 3.5, 7.4, sl8X - 1.8, sl8Y + 1.90, sl8Z);
  addBox(w8JadeRoof, 5.6, 0.85, 8.4, sl8X - 1.8, sl8Y + 3.98, sl8Z);
  addBox(w8Wood, 2.2, 0.16, 7.2, sl8X + 1.4, sl8Y + 3.15, sl8Z, 0, 0, -0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w8Wood, 0.09, 0.11, 3.15, 4, sl8X + 2.2, sl8Y + 1.62, sl8Z + pzO);
  }
  addBox(w8Wood, 1.35, 1.15, 1.85, sl8X + 3.1, sl8Y + 0.68, sl8Z - 1.8);
  addBox(w8Crimson, 0.18, 1.85, 2.4, sl8X + 3.4, sl8Y + 1.05, sl8Z + 1.6);
  addBox(w8Gold, 0.16, 0.52, 2.8, sl8X + 2.32, sl8Y + 3.05, sl8Z);
  for (const s of [-1, 1]) {
    addBox(w8Core, 0.24, 0.34, 0.24, sl8X + 2.4, sl8Y + 2.75, sl8Z + s * 2.0);
    addCyl(w8Stone, 0.28, 0.22, 0.48, 5, sl8X + 3.8, sl8Y + 0.36, sl8Z + s * 3.4);
  }

  // 2569–2576: Xưởng Đèn Lồng Thủ Công Đông — Phường Minh An (East Lantern Guild at 205.5, 36.0)
  const ln8X = 205.5;
  const ln8Z = 36.0;
  const ln8Y = Math.max(ctx.getHeight(ln8X, ln8Z), ctx.getHeight(ln8X - 4.4, ln8Z - 4.2), ctx.getHeight(ln8X + 4.4, ln8Z + 4.2));
  addBox(w8Stone, 9.4, 5.6, 8.8, ln8X, ln8Y - 2.65, ln8Z);
  addBox(w8Plaster, 4.4, 3.5, 7.4, ln8X + 1.8, ln8Y + 1.90, ln8Z);
  addBox(w8JadeRoof, 5.6, 0.85, 8.4, ln8X + 1.8, ln8Y + 3.98, ln8Z);
  addBox(w8Wood, 2.2, 0.16, 7.2, ln8X - 1.4, ln8Y + 3.15, ln8Z, 0, 0, 0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w8Wood, 0.09, 0.11, 3.15, 4, ln8X - 2.2, ln8Y + 1.62, ln8Z + pzO);
  }
  addBox(w8Wood, 1.15, 0.80, 2.2, ln8X - 3.2, ln8Y + 0.55, ln8Z - 1.6);
  addBox(w8Wood, 0.16, 2.15, 2.6, ln8X - 3.4, ln8Y + 1.20, ln8Z + 1.8);
  addBox(w8Core, 0.28, 0.36, 0.28, ln8X - 3.4, ln8Y + 1.95, ln8Z + 1.2);
  addBox(w8Core, 0.28, 0.36, 0.28, ln8X - 3.4, ln8Y + 1.95, ln8Z + 2.4);
  addBox(w8Gold, 0.16, 0.52, 2.8, ln8X - 2.32, ln8Y + 3.05, ln8Z);
  addCyl(w8Stone, 0.68, 0.74, 0.58, 5, ln8X - 3.8, ln8Y + 0.42, ln8Z);
  for (const s of [-1, 1]) {
    addBox(w8Core, 0.24, 0.34, 0.24, ln8X - 2.4, ln8Y + 2.75, ln8Z + s * 2.0);
  }

  // 2577–2588: 8 slanted shophouse awnings, crimson guild flags, upper louvered shutters & Mắt Cửa plaques
  for (const az of [16.5, 33.5, 46.5, 66.5]) {
    addBox(w8Wood, 1.05, 0.12, 2.6, 161.65, bankY + 2.52, az, 0, 0, -0.26);
    addBox(w8Wood, 1.05, 0.12, 2.6, 188.35, bankY + 2.52, az, 0, 0, 0.26);
    addBox(w8Crimson, 0.10, 1.15, 0.48, 161.9, bankY + 2.15, az + 1.5);
    addBox(w8Crimson, 0.10, 1.15, 0.48, 188.1, bankY + 2.15, az + 1.5);
  }
  for (const uz of [21.5, 56.5]) {
    addBox(w8Wood, 0.14, 1.45, 1.15, 161.1, bankY + 4.25, uz);
    addBox(w8Wood, 0.14, 1.45, 1.15, 188.9, bankY + 4.25, uz);
    addBox(w8Gold, 0.12, 0.26, 0.62, 161.3, bankY + 2.68, uz);
    addBox(w8Gold, 0.12, 0.26, 0.62, 188.7, bankY + 2.68, uz);
  }

  // 2589–2600: Assembly hall furnishings, Chùa Cầu east bollards/lanterns & courtyard artisan props
  addBox(w8Wood, 1.15, 0.82, 1.85, pkX + 2.4, pkBaseY + 0.55, pkZ + 2.6);
  addBox(w8Stone, 0.48, 1.35, 0.48, qdX - 4.2, qdY + 0.68, qdZ - 3.2);
  addBox(w8Stone, 0.48, 1.35, 0.48, qdX - 4.2, qdY + 0.68, qdZ + 3.2);
  addCyl(w8Stone, 0.36, 0.28, 0.58, 5, tcX + 3.2, tcY + 0.45, tcZ);
  addBox(w8Wood, 1.15, 0.80, 1.65, hnX + 2.6, hnY + 0.55, hnZ);
  for (const s of [-1, 1]) {
    addBox(w8Stone, 0.42, 0.95, 0.42, 183.8, bankY + 0.48, bridgeZ + s * 2.6);
    addCyl(w8Bronze, 0.06, 0.08, 3.2, 4, 183.8, bankY + 1.60, bridgeZ + s * 3.6);
    addBox(w8Core, 0.24, 0.30, 0.24, 183.8, bankY + 3.32, bridgeZ + s * 3.6);
  }
  addBox(w8Stone, 0.85, 0.72, 0.85, tkX + 3.4, tkY + 0.48, tkZ + 1.8);
  addBox(w8Wood, 1.45, 0.78, 0.85, taX - 3.2, taY + 0.52, taZ);

  // 2601–2610: 10 West & East outer-alley overhead silk lantern garlands
  for (const lz of [14.0, 31.0, 41.0, 51.0, 68.0]) {
    addCyl(w8Wood, 0.05, 0.07, 4.2, 4, 152.0, bankY + 2.05, lz);
    addCyl(w8Wood, 0.05, 0.07, 4.2, 4, 158.0, bankY + 2.05, lz);
    addCyl(w8Wood, 0.035, 0.035, 6.2, 4, 155.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w8Core, 0.24, 0.34, 0.24, 153.8, bankY + 3.58, lz);
    addBox(w8Core, 0.24, 0.34, 0.24, 156.2, bankY + 3.58, lz);

    addCyl(w8Wood, 0.05, 0.07, 4.2, 4, 192.0, bankY + 2.05, lz);
    addCyl(w8Wood, 0.05, 0.07, 4.2, 4, 198.0, bankY + 2.05, lz);
    addCyl(w8Wood, 0.035, 0.035, 6.2, 4, 195.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w8Core, 0.24, 0.34, 0.24, 193.8, bankY + 3.58, lz);
    addBox(w8Core, 0.24, 0.34, 0.24, 196.2, bankY + 3.58, lz);
  }

  // 2611–2626: 2 new wooden sampan piers (West Mid-North 167.4, 38.0 & East South-Mid 182.6, 52.0),
  // 4-post boatman shade canopy, 4 moored sampans & 16 extra floating Hoa Đăng lotus lanterns
  addBox(w8Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 38.0);
  addBox(w8Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 52.0);
  for (const [px, pz] of [[168.6, 36.0], [168.6, 40.0], [181.4, 50.0], [181.4, 54.0]] as const) {
    addCyl(w8Wood, 0.09, 0.11, 2.2, 4, px, -0.45, pz);
  }
  addBox(w8Stone, 1.85, 0.72, 2.6, 166.4, 0.45, 38.0);
  addBox(w8Stone, 1.85, 0.72, 2.6, 183.6, 0.45, 52.0);
  addBox(w8JadeRoof, 2.8, 0.20, 3.2, 184.8, bankY + 2.55, 52.0);
  for (const ox of [-1.15, 1.15]) {
    for (const oz of [-1.35, 1.35]) {
      addCyl(w8Wood, 0.055, 0.075, 2.60, 4, 184.8 + ox, bankY + 1.25, 52.0 + oz);
    }
  }
  for (const [sx, sz] of [[169.8, 38.0], [180.2, 52.0], [170.2, 48.0], [179.8, 38.0]] as const) {
    addBox(w8Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w8JadeRoof, 1.32, 0.62, 2.1, sx, 0.76, sz);
    addBox(w8Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 171.8 + (hd % 4) * 2.2;
    const hdz = 16.0 + hd * 3.8;
    addCone(w8Core, 0.16, 0.14, 4, hdx, 0.12, hdz);
  }

  // 2627–2640: Chợ Đêm west lacquerware stall, Cyclo #7, 4 bronze streetlamps & 4 promenade benches
  addBox(w8Wood, 2.2, 0.78, 2.6, nmktX - 5.8, nmktY + 0.52, 72.0);
  addBox(w8Crimson, 2.6, 0.18, 3.0, nmktX - 5.8, nmktY + 2.58, 72.0);
  for (const ox of [-1.0, 1.0]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w8Wood, 0.045, 0.055, 2.55, 4, nmktX - 5.8 + ox, nmktY + 1.32, 72.0 + oz);
    }
  }
  addBox(w8Wood, 1.05, 0.85, 1.75, 156.5, bankY + 0.58, 62.0);
  addBox(w8Crimson, 0.95, 0.65, 0.85, 156.5, bankY + 1.15, 62.3);
  for (const [lx, lz] of [[165.6, 22.0], [184.4, 22.0], [165.6, 64.0], [184.4, 64.0]] as const) {
    addCyl(w8Bronze, 0.06, 0.08, 3.4, 4, lx, bankY + 1.65, lz);
    addBox(w8Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  for (const [bx, bz] of [[164.8, 38.0], [164.8, 52.0], [185.2, 38.0], [185.2, 52.0]] as const) {
    addBox(w8Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w8Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w8Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w8Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w8Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w8Gold, ctx.materials.gold, false, false);
  addMerged(w8Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w8JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w8Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 9 UPGRADES (Items 2961–3040): NW Làng Gốm Thanh Hà Pottery Guild, SE Xưởng Mộc Kim Bồng,
  // Shophouse Awnings & Shutters, 10 Outer-Alley Lantern Garlands, 2 New Piers & 4 Moored Sampans
  // =================================================================================================
  const w9Stone: THREE.BufferGeometry[] = [];
  const w9Plaster: THREE.BufferGeometry[] = [];
  const w9Wood: THREE.BufferGeometry[] = [];
  const w9Crimson: THREE.BufferGeometry[] = [];
  const w9Gold: THREE.BufferGeometry[] = [];
  const w9Bronze: THREE.BufferGeometry[] = [];
  const w9JadeRoof: THREE.BufferGeometry[] = [];
  const w9Core: THREE.BufferGeometry[] = [];

  // 2961–2968: Làng Gốm Thanh Hà — Xưởng Gốm Tây Bắc (NW Heritage Pottery Guild at 143.5, 24.0)
  const th9X = 143.5;
  const th9Z = 24.0;
  const th9Y = Math.max(ctx.getHeight(th9X, th9Z), ctx.getHeight(th9X - 4.4, th9Z - 4.2), ctx.getHeight(th9X + 4.4, th9Z + 4.2));
  addBox(w9Stone, 9.4, 5.6, 8.8, th9X, th9Y - 2.65, th9Z);
  addBox(w9Plaster, 4.4, 3.5, 7.4, th9X - 1.8, th9Y + 1.90, th9Z);
  addBox(w9JadeRoof, 5.6, 0.85, 8.4, th9X - 1.8, th9Y + 3.98, th9Z);
  addBox(w9Wood, 2.2, 0.16, 7.2, th9X + 1.4, th9Y + 3.15, th9Z, 0, 0, -0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w9Wood, 0.09, 0.11, 3.15, 4, th9X + 2.2, th9Y + 1.62, th9Z + pzO);
  }
  addBox(w9Wood, 1.35, 1.05, 1.85, th9X + 3.1, th9Y + 0.62, th9Z - 1.8);
  addBox(w9Crimson, 0.18, 1.85, 2.4, th9X + 3.4, th9Y + 1.05, th9Z + 1.6);
  addBox(w9Gold, 0.16, 0.52, 2.8, th9X + 2.32, th9Y + 3.05, th9Z);
  for (const s of [-1, 1]) {
    addBox(w9Core, 0.24, 0.34, 0.24, th9X + 2.4, th9Y + 2.75, th9Z + s * 2.0);
    addCyl(w9Stone, 0.34, 0.28, 0.56, 5, th9X + 3.8, th9Y + 0.40, th9Z + s * 3.4);
  }

  // 2969–2976: Xưởng Mộc Kim Bồng Đông Nam (SE Carpentry & Woodcarving Guild at 205.5, 56.0)
  const kb9X = 205.5;
  const kb9Z = 56.0;
  const kb9Y = Math.max(ctx.getHeight(kb9X, kb9Z), ctx.getHeight(kb9X - 4.4, kb9Z - 4.2), ctx.getHeight(kb9X + 4.4, kb9Z + 4.2));
  addBox(w9Stone, 9.4, 5.6, 8.8, kb9X, kb9Y - 2.65, kb9Z);
  addBox(w9Plaster, 4.4, 3.5, 7.4, kb9X + 1.8, kb9Y + 1.90, kb9Z);
  addBox(w9JadeRoof, 5.6, 0.85, 8.4, kb9X + 1.8, kb9Y + 3.98, kb9Z);
  addBox(w9Wood, 2.2, 0.16, 7.2, kb9X - 1.4, kb9Y + 3.15, kb9Z, 0, 0, 0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w9Wood, 0.09, 0.11, 3.15, 4, kb9X - 2.2, kb9Y + 1.62, kb9Z + pzO);
  }
  addBox(w9Wood, 1.15, 0.80, 2.2, kb9X - 3.2, kb9Y + 0.55, kb9Z - 1.6);
  addBox(w9Wood, 0.16, 2.15, 2.6, kb9X - 3.4, kb9Y + 1.20, kb9Z + 1.8);
  addBox(w9Gold, 0.16, 0.52, 2.8, kb9X - 2.32, kb9Y + 3.05, kb9Z);
  addCyl(w9Stone, 0.68, 0.74, 0.58, 5, kb9X - 3.8, kb9Y + 0.42, kb9Z);
  for (const s of [-1, 1]) {
    addBox(w9Core, 0.24, 0.34, 0.24, kb9X - 2.4, kb9Y + 2.75, kb9Z + s * 2.0);
  }

  // 2977–2988: 8 slanted shophouse awnings, crimson guild flags, upper louvered shutters & Mắt Cửa plaques
  for (const az of [24.5, 39.5, 53.5, 70.5]) {
    addBox(w9Wood, 1.05, 0.12, 2.6, 161.65, bankY + 2.52, az, 0, 0, -0.26);
    addBox(w9Wood, 1.05, 0.12, 2.6, 188.35, bankY + 2.52, az, 0, 0, 0.26);
    addBox(w9Crimson, 0.10, 1.15, 0.48, 161.9, bankY + 2.15, az + 1.5);
    addBox(w9Crimson, 0.10, 1.15, 0.48, 188.1, bankY + 2.15, az + 1.5);
  }
  for (const uz of [29.5, 63.5]) {
    addBox(w9Wood, 0.14, 1.45, 1.15, 161.1, bankY + 4.25, uz);
    addBox(w9Wood, 0.14, 1.45, 1.15, 188.9, bankY + 4.25, uz);
    addBox(w9Gold, 0.12, 0.26, 0.62, 161.3, bankY + 2.68, uz);
    addBox(w9Gold, 0.12, 0.26, 0.62, 188.7, bankY + 2.68, uz);
  }

  // 2989–3000: Assembly hall furnishings, Chùa Cầu outer bollards/lanterns & courtyard artisan props
  addBox(w9Wood, 1.15, 0.82, 1.85, pkX - 2.4, pkBaseY + 0.55, pkZ - 2.6);
  addBox(w9Stone, 0.48, 1.35, 0.48, qdX + 6.2, qdY + 0.68, qdZ - 3.2);
  addBox(w9Stone, 0.48, 1.35, 0.48, qdX + 6.2, qdY + 0.68, qdZ + 3.2);
  addCyl(w9Stone, 0.36, 0.28, 0.58, 5, tcX, tcY + 0.45, tcZ - 3.2);
  addBox(w9Wood, 1.15, 0.80, 1.65, hnX, hnY + 0.55, hnZ + 2.6);
  for (const s of [-1, 1]) {
    addBox(w9Stone, 0.42, 0.95, 0.42, 164.2, bankY + 0.48, bridgeZ + s * 4.8);
    addCyl(w9Bronze, 0.06, 0.08, 3.2, 4, 185.8, bankY + 1.60, bridgeZ + s * 4.8);
    addBox(w9Core, 0.24, 0.30, 0.24, 185.8, bankY + 3.32, bridgeZ + s * 4.8);
  }
  addBox(w9Stone, 0.85, 0.72, 0.85, tkX - 3.4, tkY + 0.48, tkZ - 1.8);
  addBox(w9Wood, 1.45, 0.78, 0.85, taX, taY + 0.52, taZ + 3.2);

  // 3001–3010: 10 West & East outer-alley overhead silk lantern garlands
  for (const lz of [22.0, 34.0, 44.0, 54.0, 64.0]) {
    addCyl(w9Wood, 0.05, 0.07, 4.2, 4, 152.0, bankY + 2.05, lz);
    addCyl(w9Wood, 0.05, 0.07, 4.2, 4, 158.0, bankY + 2.05, lz);
    addCyl(w9Wood, 0.035, 0.035, 6.2, 4, 155.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w9Core, 0.24, 0.34, 0.24, 153.8, bankY + 3.58, lz);
    addBox(w9Core, 0.24, 0.34, 0.24, 156.2, bankY + 3.58, lz);

    addCyl(w9Wood, 0.05, 0.07, 4.2, 4, 192.0, bankY + 2.05, lz);
    addCyl(w9Wood, 0.05, 0.07, 4.2, 4, 198.0, bankY + 2.05, lz);
    addCyl(w9Wood, 0.035, 0.035, 6.2, 4, 195.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w9Core, 0.24, 0.34, 0.24, 193.8, bankY + 3.58, lz);
    addBox(w9Core, 0.24, 0.34, 0.24, 196.2, bankY + 3.58, lz);
  }

  // 3011–3026: 2 new wooden sampan piers (West South-Mid 167.4, 62.0 & East North-Mid 182.6, 40.0),
  // 4-post boatman shade canopy, 4 moored sampans & 16 extra floating Hoa Đăng lotus lanterns
  addBox(w9Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 62.0);
  addBox(w9Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 40.0);
  for (const [px, pz] of [[168.6, 60.0], [168.6, 64.0], [181.4, 38.0], [181.4, 42.0]] as const) {
    addCyl(w9Wood, 0.09, 0.11, 2.2, 4, px, -0.45, pz);
  }
  addBox(w9Stone, 1.85, 0.72, 2.6, 166.4, 0.45, 62.0);
  addBox(w9Stone, 1.85, 0.72, 2.6, 183.6, 0.45, 40.0);
  addBox(w9JadeRoof, 2.8, 0.20, 3.2, 165.2, bankY + 2.55, 62.0);
  for (const ox of [-1.15, 1.15]) {
    for (const oz of [-1.35, 1.35]) {
      addCyl(w9Wood, 0.055, 0.075, 2.60, 4, 165.2 + ox, bankY + 1.25, 62.0 + oz);
    }
  }
  for (const [sx, sz] of [[169.8, 62.0], [180.2, 40.0], [170.2, 56.0], [179.8, 44.0]] as const) {
    addBox(w9Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w9JadeRoof, 1.32, 0.62, 2.1, sx, 0.76, sz);
    addBox(w9Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 171.4 + (hd % 4) * 2.3;
    const hdz = 15.0 + hd * 3.9;
    addCone(w9Core, 0.16, 0.14, 4, hdx, 0.12, hdz);
  }

  // 3027–3040: Chợ Đêm east silk-fan stall, Cyclo #8, 4 bronze streetlamps & 4 promenade benches
  addBox(w9Wood, 2.2, 0.78, 2.6, nmktX + 9.2, nmktY + 0.52, 72.0);
  addBox(w9Crimson, 2.6, 0.18, 3.0, nmktX + 9.2, nmktY + 2.58, 72.0);
  for (const ox of [-1.0, 1.0]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w9Wood, 0.045, 0.055, 2.55, 4, nmktX + 9.2 + ox, nmktY + 1.32, 72.0 + oz);
    }
  }
  addBox(w9Wood, 1.05, 0.85, 1.75, 156.5, bankY + 0.58, 24.0);
  addBox(w9Crimson, 0.95, 0.65, 0.85, 156.5, bankY + 1.15, 24.3);
  for (const [lx, lz] of [[165.6, 28.0], [184.4, 28.0], [165.6, 60.0], [184.4, 60.0]] as const) {
    addCyl(w9Bronze, 0.06, 0.08, 3.4, 4, lx, bankY + 1.65, lz);
    addBox(w9Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  for (const [bx, bz] of [[164.8, 28.0], [164.8, 60.0], [185.2, 28.0], [185.2, 60.0]] as const) {
    addBox(w9Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w9Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w9Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w9Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w9Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w9Gold, ctx.materials.gold, false, false);
  addMerged(w9Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w9JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w9Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 10 UPGRADES (Items 3361–3440): SW Xưởng Lụa & Đèn Lồng Silk Guild, NE Nhà Thuốc Bắc Apothecary,
  // Shophouse Awnings & Shutters, 10 Outer-Alley Lantern Garlands, 2 New Piers & 4 Moored Sampans
  // =================================================================================================
  const w10Stone: THREE.BufferGeometry[] = [];
  const w10Plaster: THREE.BufferGeometry[] = [];
  const w10Wood: THREE.BufferGeometry[] = [];
  const w10Crimson: THREE.BufferGeometry[] = [];
  const w10Gold: THREE.BufferGeometry[] = [];
  const w10Bronze: THREE.BufferGeometry[] = [];
  const w10JadeRoof: THREE.BufferGeometry[] = [];
  const w10Core: THREE.BufferGeometry[] = [];

  // 3361–3368: Xưởng Lụa & Đèn Lồng Hội An Tây Nam (SW Silk-Weaving & Lantern Guild at 143.5, 62.0)
  const sl10X = 143.5;
  const sl10Z = 62.0;
  const sl10Y = Math.max(ctx.getHeight(sl10X, sl10Z), ctx.getHeight(sl10X - 4.4, sl10Z - 4.2), ctx.getHeight(sl10X + 4.4, sl10Z + 4.2));
  addBox(w10Stone, 9.4, 5.6, 8.8, sl10X, sl10Y - 2.65, sl10Z);
  addBox(w10Plaster, 4.4, 3.5, 7.4, sl10X - 1.8, sl10Y + 1.90, sl10Z);
  addBox(w10JadeRoof, 5.6, 0.85, 8.4, sl10X - 1.8, sl10Y + 3.98, sl10Z);
  addBox(w10Wood, 2.2, 0.16, 7.2, sl10X + 1.4, sl10Y + 3.15, sl10Z, 0, 0, -0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w10Wood, 0.09, 0.11, 3.15, 4, sl10X + 2.2, sl10Y + 1.62, sl10Z + pzO);
  }
  addBox(w10Wood, 1.35, 1.05, 1.85, sl10X + 3.1, sl10Y + 0.62, sl10Z - 1.8);
  addBox(w10Crimson, 0.18, 1.85, 2.4, sl10X + 3.4, sl10Y + 1.05, sl10Z + 1.6);
  addBox(w10Gold, 0.16, 0.52, 2.8, sl10X + 2.32, sl10Y + 3.05, sl10Z);
  for (const s of [-1, 1]) {
    addBox(w10Core, 0.24, 0.34, 0.24, sl10X + 2.4, sl10Y + 2.75, sl10Z + s * 2.0);
    addCyl(w10Stone, 0.34, 0.28, 0.56, 5, sl10X + 3.8, sl10Y + 0.40, sl10Z + s * 3.4);
  }

  // 3369–3376: Nhà Thuốc Bắc & Trà Thảo Mộc Đông Bắc (NE Apothecary & Herbal Tea House at 205.5, 24.0)
  const ap10X = 205.5;
  const ap10Z = 24.0;
  const ap10Y = Math.max(ctx.getHeight(ap10X, ap10Z), ctx.getHeight(ap10X - 4.4, ap10Z - 4.2), ctx.getHeight(ap10X + 4.4, ap10Z + 4.2));
  addBox(w10Stone, 9.4, 5.6, 8.8, ap10X, ap10Y - 2.65, ap10Z);
  addBox(w10Plaster, 4.4, 3.5, 7.4, ap10X + 1.8, ap10Y + 1.90, ap10Z);
  addBox(w10JadeRoof, 5.6, 0.85, 8.4, ap10X + 1.8, ap10Y + 3.98, ap10Z);
  addBox(w10Wood, 2.2, 0.16, 7.2, ap10X - 1.4, ap10Y + 3.15, ap10Z, 0, 0, 0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w10Wood, 0.09, 0.11, 3.15, 4, ap10X - 2.2, ap10Y + 1.62, ap10Z + pzO);
  }
  addBox(w10Wood, 1.15, 0.80, 2.2, ap10X - 3.2, ap10Y + 0.55, ap10Z - 1.6);
  addBox(w10Wood, 0.16, 2.15, 2.6, ap10X - 3.4, ap10Y + 1.20, ap10Z + 1.8);
  addBox(w10Gold, 0.16, 0.52, 2.8, ap10X - 2.32, ap10Y + 3.05, ap10Z);
  addCyl(w10Stone, 0.68, 0.74, 0.58, 5, ap10X - 3.8, ap10Y + 0.42, ap10Z);
  for (const s of [-1, 1]) {
    addBox(w10Core, 0.24, 0.34, 0.24, ap10X - 2.4, ap10Y + 2.75, ap10Z + s * 2.0);
  }

  // 3377–3388: 8 slanted shophouse awnings, crimson guild flags, upper louvered shutters & Mắt Cửa plaques
  for (const az of [20.5, 35.5, 49.5, 66.5]) {
    addBox(w10Wood, 1.05, 0.12, 2.6, 161.65, bankY + 2.52, az, 0, 0, -0.26);
    addBox(w10Wood, 1.05, 0.12, 2.6, 188.35, bankY + 2.52, az, 0, 0, 0.26);
    addBox(w10Crimson, 0.10, 1.15, 0.48, 161.9, bankY + 2.15, az + 1.5);
    addBox(w10Crimson, 0.10, 1.15, 0.48, 188.1, bankY + 2.15, az + 1.5);
  }
  for (const uz of [33.5, 58.5]) {
    addBox(w10Wood, 0.14, 1.45, 1.15, 161.1, bankY + 4.25, uz);
    addBox(w10Wood, 0.14, 1.45, 1.15, 188.9, bankY + 4.25, uz);
    addBox(w10Gold, 0.12, 0.26, 0.62, 161.3, bankY + 2.68, uz);
    addBox(w10Gold, 0.12, 0.26, 0.62, 188.7, bankY + 2.68, uz);
  }

  // 3389–3400: Assembly hall courtyard props, Chùa Cầu outer-north bollards/lanterns & artisan props
  addBox(w10Wood, 1.15, 0.82, 1.85, pkX - 2.4, pkBaseY + 0.55, pkZ + 2.8);
  addBox(w10Stone, 0.48, 1.35, 0.48, qdX + 6.2, qdY + 0.68, qdZ - 5.2);
  addBox(w10Stone, 0.48, 1.35, 0.48, qdX + 6.2, qdY + 0.68, qdZ + 5.2);
  addCyl(w10Stone, 0.36, 0.28, 0.58, 5, tcX, tcY + 0.45, tcZ + 3.4);
  addBox(w10Wood, 1.15, 0.80, 1.65, hnX, hnY + 0.55, hnZ - 2.8);
  for (const s of [-1, 1]) {
    addBox(w10Stone, 0.42, 0.95, 0.42, 164.2, bankY + 0.48, bridgeZ + s * 6.8);
    addCyl(w10Bronze, 0.06, 0.08, 3.2, 4, 185.8, bankY + 1.60, bridgeZ + s * 6.8);
    addBox(w10Core, 0.24, 0.30, 0.24, 185.8, bankY + 3.32, bridgeZ + s * 6.8);
  }
  addBox(w10Stone, 0.85, 0.72, 0.85, tkX - 3.4, tkY + 0.48, tkZ + 2.2);
  addBox(w10Wood, 1.45, 0.78, 0.85, taX, taY + 0.52, taZ - 3.4);

  // 3401–3410: 10 West & East outer-alley overhead silk lantern garlands
  for (const lz of [18.0, 30.0, 40.0, 50.0, 68.0]) {
    addCyl(w10Wood, 0.05, 0.07, 4.2, 4, 152.0, bankY + 2.05, lz);
    addCyl(w10Wood, 0.05, 0.07, 4.2, 4, 158.0, bankY + 2.05, lz);
    addCyl(w10Wood, 0.035, 0.035, 6.2, 4, 155.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w10Core, 0.24, 0.34, 0.24, 153.8, bankY + 3.58, lz);
    addBox(w10Core, 0.24, 0.34, 0.24, 156.2, bankY + 3.58, lz);

    addCyl(w10Wood, 0.05, 0.07, 4.2, 4, 192.0, bankY + 2.05, lz);
    addCyl(w10Wood, 0.05, 0.07, 4.2, 4, 198.0, bankY + 2.05, lz);
    addCyl(w10Wood, 0.035, 0.035, 6.2, 4, 195.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w10Core, 0.24, 0.34, 0.24, 193.8, bankY + 3.58, lz);
    addBox(w10Core, 0.24, 0.34, 0.24, 196.2, bankY + 3.58, lz);
  }

  // 3411–3426: 2 new wooden sampan piers (West North-Mid 167.4, 30.0 & East South-Mid 182.6, 60.0),
  // 4-post boatman shade canopy, 4 moored sampans & 16 extra floating Hoa Đăng lotus lanterns
  addBox(w10Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 30.0);
  addBox(w10Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 60.0);
  for (const [px, pz] of [[168.6, 28.0], [168.6, 32.0], [181.4, 58.0], [181.4, 62.0]] as const) {
    addCyl(w10Wood, 0.09, 0.11, 2.2, 4, px, -0.45, pz);
  }
  addBox(w10Stone, 1.85, 0.72, 2.6, 166.4, 0.45, 30.0);
  addBox(w10Stone, 1.85, 0.72, 2.6, 183.6, 0.45, 60.0);
  addBox(w10JadeRoof, 2.8, 0.20, 3.2, 184.8, bankY + 2.55, 60.0);
  for (const ox of [-1.15, 1.15]) {
    for (const oz of [-1.35, 1.35]) {
      addCyl(w10Wood, 0.055, 0.075, 2.60, 4, 184.8 + ox, bankY + 1.25, 60.0 + oz);
    }
  }
  for (const [sx, sz] of [[169.8, 30.0], [180.2, 60.0], [170.2, 24.0], [179.8, 64.0]] as const) {
    addBox(w10Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w10JadeRoof, 1.32, 0.62, 2.1, sx, 0.76, sz);
    addBox(w10Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 172.0 + (hd % 4) * 2.3;
    const hdz = 13.5 + hd * 3.9;
    addCone(w10Core, 0.16, 0.14, 4, hdx, 0.12, hdz);
  }

  // 3427–3440: Chợ Đêm west lantern-craft stall, Cyclo #9, 4 bronze streetlamps & 4 promenade benches
  addBox(w10Wood, 2.2, 0.78, 2.6, nmktX - 9.4, nmktY + 0.52, 72.0);
  addBox(w10Crimson, 2.6, 0.18, 3.0, nmktX - 9.4, nmktY + 2.58, 72.0);
  for (const ox of [-1.0, 1.0]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w10Wood, 0.045, 0.055, 2.55, 4, nmktX - 9.4 + ox, nmktY + 1.32, 72.0 + oz);
    }
  }
  addBox(w10Wood, 1.05, 0.85, 1.75, 193.5, bankY + 0.58, 24.0);
  addBox(w10Crimson, 0.95, 0.65, 0.85, 193.5, bankY + 1.15, 24.3);
  for (const [lx, lz] of [[165.6, 20.0], [184.4, 20.0], [165.6, 68.0], [184.4, 68.0]] as const) {
    addCyl(w10Bronze, 0.06, 0.08, 3.4, 4, lx, bankY + 1.65, lz);
    addBox(w10Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  for (const [bx, bz] of [[164.8, 20.0], [164.8, 68.0], [185.2, 20.0], [185.2, 68.0]] as const) {
    addBox(w10Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w10Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w10Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w10Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w10Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w10Gold, ctx.materials.gold, false, false);
  addMerged(w10Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w10JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w10Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  // =================================================================================================
  // WAVE 11 UPGRADES (Items 3761–3840): West Xưởng Giấy Trúc Chỉ Folk-Art Guild, East Nhà Trà Cung Đình,
  // Shophouse Awnings & Shutters, 10 Outer-Alley Lantern Garlands, 2 New Piers & 4 Moored Sampans
  // =================================================================================================
  const w11Stone: THREE.BufferGeometry[] = [];
  const w11Plaster: THREE.BufferGeometry[] = [];
  const w11Wood: THREE.BufferGeometry[] = [];
  const w11Crimson: THREE.BufferGeometry[] = [];
  const w11Gold: THREE.BufferGeometry[] = [];
  const w11Bronze: THREE.BufferGeometry[] = [];
  const w11JadeRoof: THREE.BufferGeometry[] = [];
  const w11Core: THREE.BufferGeometry[] = [];

  // 3761–3768: Xưởng Giấy Trúc Chỉ & Tranh Dân Gian Tây (West Mid-Town Folk-Art Guild at 143.5, 43.0)
  const tc11X = 143.5;
  const tc11Z = 43.0;
  const tc11Y = Math.max(ctx.getHeight(tc11X, tc11Z), ctx.getHeight(tc11X - 4.4, tc11Z - 4.2), ctx.getHeight(tc11X + 4.4, tc11Z + 4.2));
  addBox(w11Stone, 9.4, 5.6, 8.8, tc11X, tc11Y - 2.65, tc11Z);
  addBox(w11Plaster, 4.4, 3.5, 7.4, tc11X - 1.8, tc11Y + 1.90, tc11Z);
  addBox(w11JadeRoof, 5.6, 0.85, 8.4, tc11X - 1.8, tc11Y + 3.98, tc11Z);
  addBox(w11Wood, 2.2, 0.16, 7.2, tc11X + 1.4, tc11Y + 3.15, tc11Z, 0, 0, -0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w11Wood, 0.09, 0.11, 3.15, 4, tc11X + 2.2, tc11Y + 1.62, tc11Z + pzO);
  }
  addBox(w11Wood, 1.35, 1.05, 1.85, tc11X + 3.1, tc11Y + 0.62, tc11Z - 1.8);
  addBox(w11Crimson, 0.18, 1.85, 2.4, tc11X + 3.4, tc11Y + 1.05, tc11Z + 1.6);
  addBox(w11Gold, 0.16, 0.52, 2.8, tc11X + 2.32, tc11Y + 3.05, tc11Z);
  for (const s of [-1, 1]) {
    addBox(w11Core, 0.24, 0.34, 0.24, tc11X + 2.4, tc11Y + 2.75, tc11Z + s * 2.0);
    addCyl(w11Stone, 0.34, 0.28, 0.56, 5, tc11X + 3.8, tc11Y + 0.40, tc11Z + s * 3.4);
  }

  // 3769–3776: Nhà Trà Cung Đình & Gốm Mỹ Nghệ Đông (East Mid-Town Royal Tea House at 205.5, 40.0)
  const rt11X = 205.5;
  const rt11Z = 40.0;
  const rt11Y = Math.max(ctx.getHeight(rt11X, rt11Z), ctx.getHeight(rt11X - 4.4, rt11Z - 4.2), ctx.getHeight(rt11X + 4.4, rt11Z + 4.2));
  addBox(w11Stone, 9.4, 5.6, 8.8, rt11X, rt11Y - 2.65, rt11Z);
  addBox(w11Plaster, 4.4, 3.5, 7.4, rt11X + 1.8, rt11Y + 1.90, rt11Z);
  addBox(w11JadeRoof, 5.6, 0.85, 8.4, rt11X + 1.8, rt11Y + 3.98, rt11Z);
  addBox(w11Wood, 2.2, 0.16, 7.2, rt11X - 1.4, rt11Y + 3.15, rt11Z, 0, 0, 0.18);
  for (const pzO of [-3.1, -1.0, 1.0, 3.1]) {
    addCyl(w11Wood, 0.09, 0.11, 3.15, 4, rt11X - 2.2, rt11Y + 1.62, rt11Z + pzO);
  }
  addBox(w11Wood, 1.15, 0.80, 2.2, rt11X - 3.2, rt11Y + 0.55, rt11Z - 1.6);
  addBox(w11Wood, 0.16, 2.15, 2.6, rt11X - 3.4, rt11Y + 1.20, rt11Z + 1.8);
  addBox(w11Gold, 0.16, 0.52, 2.8, rt11X - 2.32, rt11Y + 3.05, rt11Z);
  addCyl(w11Stone, 0.68, 0.74, 0.58, 5, rt11X - 3.8, rt11Y + 0.42, rt11Z);
  for (const s of [-1, 1]) {
    addBox(w11Core, 0.24, 0.34, 0.24, rt11X - 2.4, rt11Y + 2.75, rt11Z + s * 2.0);
  }

  // 3777–3788: 8 slanted shophouse awnings, crimson guild flags, upper louvered shutters & Mắt Cửa plaques
  for (const az of [16.5, 31.5, 45.5, 62.5]) {
    addBox(w11Wood, 1.05, 0.12, 2.6, 161.65, bankY + 2.52, az, 0, 0, -0.26);
    addBox(w11Wood, 1.05, 0.12, 2.6, 188.35, bankY + 2.52, az, 0, 0, 0.26);
    addBox(w11Crimson, 0.10, 1.15, 0.48, 161.9, bankY + 2.15, az + 1.5);
    addBox(w11Crimson, 0.10, 1.15, 0.48, 188.1, bankY + 2.15, az + 1.5);
  }
  for (const uz of [25.5, 54.5]) {
    addBox(w11Wood, 0.14, 1.45, 1.15, 161.1, bankY + 4.25, uz);
    addBox(w11Wood, 0.14, 1.45, 1.15, 188.9, bankY + 4.25, uz);
    addBox(w11Gold, 0.12, 0.26, 0.62, 161.3, bankY + 2.68, uz);
    addBox(w11Gold, 0.12, 0.26, 0.62, 188.7, bankY + 2.68, uz);
  }

  // 3789–3800: Assembly hall courtyard props, Chùa Cầu far-outer bollards/lanterns & courtyard artisan props
  addBox(w11Wood, 1.15, 0.82, 1.85, pkX - 2.4, pkBaseY + 0.55, pkZ + 5.2);
  addBox(w11Stone, 0.48, 1.35, 0.48, qdX + 8.4, qdY + 0.68, qdZ - 3.6);
  addBox(w11Stone, 0.48, 1.35, 0.48, qdX + 8.4, qdY + 0.68, qdZ + 3.6);
  addCyl(w11Stone, 0.36, 0.28, 0.58, 5, tcX + 2.8, tcY + 0.45, tcZ + 3.4);
  addBox(w11Wood, 1.15, 0.80, 1.65, hnX + 2.8, hnY + 0.55, hnZ - 2.8);
  for (const s of [-1, 1]) {
    addBox(w11Stone, 0.42, 0.95, 0.42, 164.2, bankY + 0.48, bridgeZ + s * 8.8);
    addCyl(w11Bronze, 0.06, 0.08, 3.2, 4, 185.8, bankY + 1.60, bridgeZ + s * 8.8);
    addBox(w11Core, 0.24, 0.30, 0.24, 185.8, bankY + 3.32, bridgeZ + s * 8.8);
  }
  addBox(w11Stone, 0.85, 0.72, 0.85, tkX - 3.4, tkY + 0.48, tkZ + 4.4);
  addBox(w11Wood, 1.45, 0.78, 0.85, taX + 2.6, taY + 0.52, taZ - 3.4);

  // 3801–3810: 10 West & East outer-alley overhead silk lantern garlands
  for (const lz of [14.0, 26.0, 36.0, 46.0, 72.0]) {
    addCyl(w11Wood, 0.05, 0.07, 4.2, 4, 152.0, bankY + 2.05, lz);
    addCyl(w11Wood, 0.05, 0.07, 4.2, 4, 158.0, bankY + 2.05, lz);
    addCyl(w11Wood, 0.035, 0.035, 6.2, 4, 155.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w11Core, 0.24, 0.34, 0.24, 153.8, bankY + 3.58, lz);
    addBox(w11Core, 0.24, 0.34, 0.24, 156.2, bankY + 3.58, lz);

    addCyl(w11Wood, 0.05, 0.07, 4.2, 4, 192.0, bankY + 2.05, lz);
    addCyl(w11Wood, 0.05, 0.07, 4.2, 4, 198.0, bankY + 2.05, lz);
    addCyl(w11Wood, 0.035, 0.035, 6.2, 4, 195.0, bankY + 3.95, lz, 0, 0, Math.PI * 0.5);
    addBox(w11Core, 0.24, 0.34, 0.24, 193.8, bankY + 3.58, lz);
    addBox(w11Core, 0.24, 0.34, 0.24, 196.2, bankY + 3.58, lz);
  }

  // 3811–3826: 2 new wooden sampan piers (West Far-North 167.4, 18.0 & East Far-South 182.6, 70.0),
  // 4-post boatman shade canopy, 4 moored sampans & 16 extra floating Hoa Đăng lotus lanterns
  addBox(w11Wood, 3.0, 0.22, 4.8, 167.4, 0.42, 18.0);
  addBox(w11Wood, 3.0, 0.22, 4.8, 182.6, 0.42, 70.0);
  for (const [px, pz] of [[168.6, 16.0], [168.6, 20.0], [181.4, 68.0], [181.4, 72.0]] as const) {
    addCyl(w11Wood, 0.09, 0.11, 2.2, 4, px, -0.45, pz);
  }
  addBox(w11Stone, 1.85, 0.72, 2.6, 166.4, 0.45, 18.0);
  addBox(w11Stone, 1.85, 0.72, 2.6, 183.6, 0.45, 70.0);
  addBox(w11JadeRoof, 2.8, 0.20, 3.2, 165.2, bankY + 2.55, 18.0);
  for (const ox of [-1.15, 1.15]) {
    for (const oz of [-1.35, 1.35]) {
      addCyl(w11Wood, 0.055, 0.075, 2.60, 4, 165.2 + ox, bankY + 1.25, 18.0 + oz);
    }
  }
  for (const [sx, sz] of [[169.8, 18.0], [180.2, 70.0], [170.2, 14.0], [179.8, 74.0]] as const) {
    addBox(w11Wood, 1.45, 0.45, 4.6, sx, 0.24, sz);
    addBox(w11JadeRoof, 1.32, 0.62, 2.1, sx, 0.76, sz);
    addBox(w11Core, 0.22, 0.28, 0.22, sx, 0.85, sz + 2.1);
  }
  for (let hd = 0; hd < 16; hd++) {
    const hdx = 171.7 + (hd % 4) * 2.3;
    const hdz = 12.0 + hd * 3.9;
    addCone(w11Core, 0.16, 0.14, 4, hdx, 0.12, hdz);
  }

  // 3827–3840: Chợ Đêm south-center calligraphy stall, Cyclo #10, 4 bronze streetlamps & 4 promenade benches
  addBox(w11Wood, 2.2, 0.78, 2.6, nmktX, nmktY + 0.52, 76.5);
  addBox(w11Crimson, 2.6, 0.18, 3.0, nmktX, nmktY + 2.58, 76.5);
  for (const ox of [-1.0, 1.0]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w11Wood, 0.045, 0.055, 2.55, 4, nmktX + ox, nmktY + 1.32, 76.5 + oz);
    }
  }
  addBox(w11Wood, 1.05, 0.85, 1.75, 193.5, bankY + 0.58, 64.0);
  addBox(w11Crimson, 0.95, 0.65, 0.85, 193.5, bankY + 1.15, 64.3);
  for (const [lx, lz] of [[165.6, 14.0], [184.4, 14.0], [165.6, 74.0], [184.4, 74.0]] as const) {
    addCyl(w11Bronze, 0.06, 0.08, 3.4, 4, lx, bankY + 1.65, lz);
    addBox(w11Core, 0.24, 0.28, 0.24, lx, bankY + 3.45, lz);
  }
  for (const [bx, bz] of [[164.8, 14.0], [164.8, 74.0], [185.2, 14.0], [185.2, 74.0]] as const) {
    addBox(w11Wood, 0.55, 0.46, 1.85, bx, bankY + 0.24, bz);
  }

  addMerged(w11Stone, ctx.materials.stone, false, true, 2.4);
  addMerged(w11Plaster, ctx.materials.whitePlaster, false, true, 2.2);
  addMerged(w11Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true, 2.4);
  addMerged(w11Crimson, ctx.materials.crimsonLacquer, false, true);
  addMerged(w11Gold, ctx.materials.gold, false, false);
  addMerged(w11Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, false, true);
  addMerged(w11JadeRoof, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true);
  addMerged(w11Core, ctx.materials.lanternCore ?? ha.hoiAnSilkLanternMat, false, false);

  tagMotifIds(group, [
    'HV-A06', 'HV-B09', 'HV-C08', 'HV-D02', 'HV-D08', 'HV-D09', 'HV-D10',
    'HV-D13', 'HV-H05', 'HV-I01', 'HV-I02', 'HV-J07', 'HV-NEW-MT-01', 'HV-NEW-MT-02'
  ]);
  ctx.scene.add(group);
  return group;
}
