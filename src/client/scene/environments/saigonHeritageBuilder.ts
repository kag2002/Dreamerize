import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createVietnameseCurvedRoofGeometry,
  createWavingSilkFlagMaterial
} from './vietnamGeometryHelpers';
import {
  createSmoothTaperedTubeGeometry,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  createMergedMesh,
  registerAnimatedUniform
} from '../vietnam/geometry/PartsBuilder';
import {
  createSaigonMaterialPack,
  SAIGON_ART_UV,
  SAIGON_RELIEF_UV,
  type SaigonArtKey,
  type SaigonMaterialPack,
  type SaigonReliefKey
} from '../textures/saigonPbrTextures';

/**
 * TP. Hồ Chí Minh Heritage Precinct Museum Builder — implements all 128 QC items:
 *   - Dinh Độc Lập (`DL-01..32`, `DI-01..32`) at (0, 250)
 *   - Nhà Thờ Đức Bà Sài Gòn (`ND-01..32`, `NI-01..32`) at (108, 190)
 *
 * Shares ONE single 2048×3072 Master PBR & Artwork Atlas (`saigonMasterAtlasMat`)
 * across BOTH landmarks -> net material reduction (-3 GPU materials vs legacy)!
 */

const saigonPackCache = new WeakMap<THREE.Scene, SaigonMaterialPack>();

function getOrCreateSaigonPack(ctx: VietnamBuilderContext): SaigonMaterialPack {
  let pack = saigonPackCache.get(ctx.scene);
  if (!pack) {
    pack = createSaigonMaterialPack(ctx.renderer);
    saigonPackCache.set(ctx.scene, pack);
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

function remapRelief(geo: THREE.BufferGeometry, key: SaigonReliefKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, SAIGON_RELIEF_UV[key], inset);
}

function remapArt(geo: THREE.BufferGeometry, key: SaigonArtKey, inset = 0.004): THREE.BufferGeometry {
  return remapUvRect(geo, SAIGON_ART_UV[key], inset);
}

function makeReliefBox(
  w: number,
  h: number,
  d: number,
  key: SaigonReliefKey,
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

function makeReliefPlane(
  w: number,
  h: number,
  key: SaigonReliefKey,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0
): THREE.BufferGeometry {
  const g = remapRelief(new THREE.PlaneGeometry(w, h), key);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makeArtPlane(
  w: number,
  h: number,
  key: SaigonArtKey,
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

function makeBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function makeCyl(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotZ = 0,
  rotY = 0
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

function colorizeGeo(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function addSaigonParkTree(
  woodParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  height: number,
  canopyRadius: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  const trunkH = height * 0.46;
  woodParts.push(makeCyl(0.28, 0.46, trunkH, 7, x, y + trunkH * 0.5, z));
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2 + rand() * 0.6;
    const len = canopyRadius * (0.65 + rand() * 0.25);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y + trunkH * 0.82, z),
      new THREE.Vector3(x + Math.cos(a) * len * 0.4, y + trunkH + height * 0.14, z + Math.sin(a) * len * 0.4),
      new THREE.Vector3(x + Math.cos(a) * len * 0.75, y + trunkH + height * 0.26, z + Math.sin(a) * len * 0.75)
    ]);
    woodParts.push(createSmoothTaperedTubeGeometry(curve, 5, 4, (t) => 0.22 - t * 0.12));
  }
  const greens = ['#1c4d1e', '#266126', '#32722c', '#1f5422', '#3d7d34'];
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * canopyRadius;
    const cy = y + trunkH + height * (0.10 + rand() * 0.44) - (rad / canopyRadius) * 0.65;
    const cw = canopyRadius * (0.50 + rand() * 0.34);
    const card = new THREE.PlaneGeometry(cw, cw * 0.76);
    card.rotateX((rand() - 0.5) * 1.15);
    card.rotateY(rand() * Math.PI * 2);
    card.rotateZ((rand() - 0.5) * 0.65);
    card.translate(x + Math.cos(a) * rad, cy, z + Math.sin(a) * rad);
    foliageParts.push(colorizeGeo(card, greens[Math.floor(rand() * greens.length)]));
  }
}

function addTopiaryUrn(
  masterParts: THREE.BufferGeometry[],
  foliageParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number
): void {
  const rand = mulberry32(seed);
  masterParts.push(makeReliefBox(0.95 * scale, 0.72 * scale, 0.95 * scale, 'palacePrecastStone', x, y + 0.36 * scale, z));
  const greens = ['#205622', '#2c6c2a', '#387e32'];
  for (let tier = 0; tier < 3; tier++) {
    const ty = y + (1.05 + tier * 0.56) * scale;
    const tr = (0.62 - tier * 0.15) * scale;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + tier * 0.5;
      const card = new THREE.PlaneGeometry(tr * 1.25, tr * 0.85);
      card.rotateX((rand() - 0.5) * 0.8);
      card.rotateY(a);
      card.translate(x + Math.cos(a) * tr * 0.35, ty, z + Math.sin(a) * tr * 0.35);
      foliageParts.push(colorizeGeo(card, greens[(tier + k) % greens.length]));
    }
  }
}

function addTankT54(
  masterParts: THREE.BufferGeometry[],
  darkParts: THREE.BufferGeometry[],
  whiteParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  yaw: number,
  is843: boolean
): void {
  const place = (g: THREE.BufferGeometry, target: THREE.BufferGeometry[]) => {
    g.rotateY(yaw);
    g.translate(x, y, z);
    target.push(g);
  };
  // Weathered concrete display plinth (`DL-23`)
  place(makeReliefBox(4.4, 0.36, 7.6, 'palacePrecastStone', 0, 0.18, 0), masterParts);
  // Sloped armored T-54B / Type 59 hull (`DL-24`, `DL-27`)
  place(makeReliefBox(3.15, 0.92, 6.2, 'militaryCamoArmor', 0, 1.18, 0), masterParts);
  place(makeReliefBox(3.12, 0.42, 1.4, 'militaryCamoArmor', 0, 1.12, -3.35, 0, 0.42), masterParts);
  // Twin side tracks + 5 pairs of spoked road wheels with white painted outer rims (`DL-26`)
  for (const sx of [-1.52, 1.52]) {
    place(makeBox(0.56, 0.82, 6.1, sx, 0.78, 0), darkParts);
    for (const wz of [-2.25, -0.95, 0.05, 1.05, 2.05]) {
      const wheel = makeCyl(0.38, 0.38, 0.62, 12, sx, 0.76, wz, 0, Math.PI * 0.5);
      place(wheel, darkParts);
      const rim = makeCyl(0.28, 0.28, 0.64, 10, sx, 0.76, wz, 0, Math.PI * 0.5);
      place(rim, whiteParts);
    }
  }
  // Cast hemispherical T-54 dome turret + commander cupola + 100mm D-10T cannon with bore evacuator (`DL-24`, `DL-25`)
  const turret = new THREE.SphereGeometry(1.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  turret.scale(1.05, 0.76, 1.18);
  turret.translate(0, 1.62, -0.15);
  place(remapRelief(turret, 'militaryCamoArmor'), masterParts);
  place(remapRelief(makeCyl(0.32, 0.36, 0.26, 10, 0.48, 2.48, 0.15), 'militaryCamoArmor'), masterParts);
  // Long 100mm gun barrel + cylindrical bore evacuator near muzzle
  place(remapRelief(makeCyl(0.085, 0.115, 5.4, 8, 0, 2.08, -3.55, Math.PI * 0.5 - 0.05), 'militaryCamoArmor'), masterParts);
  place(remapRelief(makeCyl(0.145, 0.145, 0.75, 10, 0, 2.18, -5.25, Math.PI * 0.5 - 0.05), 'militaryCamoArmor'), masterParts);
  // Rear cylindrical external fuel drums (`DL-27`)
  for (const sx of [-0.95, 0.95]) {
    place(remapRelief(makeCyl(0.28, 0.28, 0.95, 10, sx, 1.62, 2.75, 0, Math.PI * 0.5), 'militaryCamoArmor'), masterParts);
  }
  // Bold white "843" / "390" turret numeral plate (`DL-27`)
  for (const sx of [-1, 1]) {
    place(makeArtPlane(0.95, 0.42, 'tank843Board', sx * 1.34, 1.98, -0.15, sx * Math.PI * 0.5), masterParts);
  }
  if (is843) {
    place(makeArtPlane(1.15, 0.65, 'tank843Board', 2.45, 1.05, -2.55, -0.35), masterParts);
  }
}

function addUH1Huey(
  masterParts: THREE.BufferGeometry[],
  darkParts: THREE.BufferGeometry[],
  whiteParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  yaw: number
): void {
  const place = (g: THREE.BufferGeometry, target: THREE.BufferGeometry[]) => {
    g.rotateY(yaw);
    g.translate(x, y, z);
    target.push(g);
  };
  // Twin tubular landing skids + crossbars (`DL-29`)
  for (const sx of [-1.12, 1.12]) {
    place(makeCyl(0.055, 0.055, 4.6, 6, sx, 0.12, -0.3, Math.PI * 0.5), darkParts);
    for (const cz of [-1.4, 0.9]) {
      place(makeCyl(0.05, 0.05, 0.85, 6, sx * 0.82, 0.52, cz, 0, sx * 0.35), darkParts);
    }
  }
  // Bulbous 3-tone camo fuselage + dark wrap-around cockpit glazing (`DL-29`, `DL-31`)
  place(makeReliefBox(2.15, 1.55, 4.6, 'militaryCamoArmor', 0, 1.55, -0.2), masterParts);
  const nose = new THREE.SphereGeometry(1.08, 12, 8);
  nose.scale(0.98, 0.72, 1.25);
  nose.translate(0, 1.42, -2.55);
  place(remapRelief(nose, 'militaryCamoArmor'), masterParts);
  place(makeBox(1.95, 0.85, 1.35, 0, 1.82, -2.05), darkParts);
  // Tapered tail boom + horizontal stabilizers + swept vertical tail fin + "445" marking
  place(remapRelief(makeCyl(0.28, 0.65, 5.8, 8, 0, 1.75, 4.85, Math.PI * 0.5), 'militaryCamoArmor'), masterParts);
  place(makeReliefBox(2.4, 0.10, 0.65, 'militaryCamoArmor', 0, 1.75, 5.4), masterParts);
  place(makeReliefBox(0.22, 2.2, 1.15, 'militaryCamoArmor', 0, 2.65, 7.6, 0, -0.22), masterParts);
  for (const sx of [-1, 1]) {
    place(makeArtPlane(1.15, 0.52, 'huey445Marking', sx * 0.45, 1.75, 4.4, sx * Math.PI * 0.5), masterParts);
  }
  // Rotor mast + twin long main rotor blades with crisp white tip stripes + tail rotor (`DL-30`)
  place(makeCyl(0.14, 0.18, 0.95, 8, 0, 2.75, -0.25), darkParts);
  place(makeBox(12.2, 0.06, 0.44, 0, 3.22, -0.25, 0.38), darkParts);
  for (const sTip of [-1, 1]) {
    place(makeBox(0.75, 0.07, 0.46, sTip * 5.65, 3.22, -0.25, 0.38), whiteParts);
  }
  place(makeBox(0.08, 2.1, 0.22, 0.24, 3.25, 7.85), darkParts);
}

// =================================================================================================
// 1. DINH ĐỘC LẬP (INDEPENDENCE PALACE) AT (0, 250) — `DL-01..32`, `DI-01..32`
// =================================================================================================
export function buildIndependencePalaceComplex(ctx: VietnamBuilderContext): void {
  const cx = 0;
  const cz = 250;
  const yBase = ctx.getHeight(cx, cz);
  const pack = getOrCreateSaigonPack(ctx);

  const group = new THREE.Group();
  group.name = 'IndependencePalaceComplex';
  group.position.set(cx, yBase, cz);

  const masterParts: THREE.BufferGeometry[] = [];
  const whiteParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];
  const glassParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const jetParts: THREE.BufferGeometry[] = [];

  // 1. Sweeping Emerald 124m × 96m Saigon Park Lawn (6×5 tiled quads) + Curved Driveway & Historic Wrought-Iron Gates (`DL-19..21`)
  const lawnCenterZ = -55.0;
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      const tw = 124.0 / 6;
      const td = 96.0 / 5;
      masterParts.push(
        makeReliefPlane(tw, td, 'saigonParkLawn', -62 + (gx + 0.5) * tw, 0.05, -98 + (gz + 0.5) * td, 0, -Math.PI * 0.5)
      );
    }
  }
  // Driveway apron + elliptical loop around fountain
  masterParts.push(
    makeReliefBox(15.0, 0.14, 26.0, 'palacePrecastStone', 0, 0.04, -85.0),
    makeReliefBox(54.0, 0.14, 16.0, 'palacePrecastStone', 0, 0.04, -29.8)
  );
  const loopSegs = 36;
  for (let i = 0; i < loopSegs; i++) {
    const a0 = (i / loopSegs) * Math.PI * 2;
    const a1 = ((i + 1) / loopSegs) * Math.PI * 2;
    const x0 = Math.cos(a0) * 19.3;
    const z0 = lawnCenterZ + Math.sin(a0) * 14.8;
    const x1 = Math.cos(a1) * 19.3;
    const z1 = lawnCenterZ + Math.sin(a1) * 14.8;
    const segLen = Math.hypot(x1 - x0, z1 - z0) + 0.5;
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    masterParts.push(makeReliefBox(7.8, 0.14, segLen, 'palacePrecastStone', (x0 + x1) * 0.5, 0.04, (z0 + z1) * 0.5, yaw));
  }
  // Historic White Masonry Piers & Black Wrought-Iron Perimeter Gates (`Cổng Chính`, `DL-20`)
  for (const gx of [-18, -8, 8, 18]) {
    masterParts.push(makeReliefBox(1.15, 3.6, 1.15, 'palacePrecastStone', gx, 1.8, -97.5));
  }
  for (let bar = -7; bar <= 7; bar++) {
    darkParts.push(makeCyl(0.035, 0.035, 2.8, 4, bar * 1.05, 1.4, -97.5));
  }

  // 2. Iconic Rectangular Fountain Basin, Organic Clipped Boxwood Hedge & 3-Tier Parabolic Water Plumes (`DL-16`, `DL-17`)
  for (const sz of [-1, 1]) {
    masterParts.push(makeReliefBox(22.4, 0.65, 0.58, 'palacePrecastStone', 0, 0.34, lawnCenterZ + sz * 5.0));
    for (let hx = -11.5; hx <= 11.5; hx += 1.2) {
      const card = new THREE.PlaneGeometry(1.5, 1.0);
      card.translate(hx, 0.55, lawnCenterZ + sz * 5.9);
      foliageParts.push(colorizeGeo(card, '#225824'));
    }
  }
  for (const sx of [-1, 1]) {
    masterParts.push(makeReliefBox(0.58, 0.65, 10.6, 'palacePrecastStone', sx * 11.0, 0.34, lawnCenterZ));
    for (let hz = -5.5; hz <= 5.5; hz += 1.2) {
      const card = new THREE.PlaneGeometry(1.5, 1.0);
      card.rotateY(Math.PI * 0.5);
      card.translate(sx * 11.9, 0.55, lawnCenterZ + hz);
      foliageParts.push(colorizeGeo(card, '#225824'));
    }
  }
  // Translucent parabolic fountain spray rings (`DL-16`)
  jetParts.push(makeCyl(0.14, 0.85, 8.8, 10, 0, 4.7, lawnCenterZ));
  for (let j = 0; j < 18; j++) {
    const a = (j / 18) * Math.PI * 2;
    const jCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 1.2, 0.5, lawnCenterZ + Math.sin(a) * 1.2),
      new THREE.Vector3(Math.cos(a) * 3.8, 4.2, lawnCenterZ + Math.sin(a) * 3.8),
      new THREE.Vector3(Math.cos(a) * 6.8, 0.4, lawnCenterZ + Math.sin(a) * 6.8)
    ]);
    jetParts.push(createSmoothTaperedTubeGeometry(jCurve, 8, 4, (t) => 0.08 + Math.sin(t * Math.PI) * 0.04));
  }

  // 3. Rusticated Polygonal *Đá Chẻ* Retaining Base, Ceremonial Steps with Crimson Carpet & Topiary Urns (`DL-05`, `DL-10`, `DL-11`, `DL-18`)
  masterParts.push(makeReliefBox(78.0, 1.95, 44.0, 'palaceRusticatedBase', 0, 0.98, 2.0));
  for (let s = 0; s < 6; s++) {
    masterParts.push(makeReliefBox(14.0, 0.32, 0.68, 'palacePrecastStone', 0, 0.16 + s * 0.31, -23.5 + s * 0.62));
    // Formal crimson-red ceremonial carpet runner ascending travertine steps (`DL-11`)
    masterParts.push(makeReliefBox(4.8, 0.05, 0.72, 'palaceCrimsonBrocade', 0, 0.34 + s * 0.31, -23.5 + s * 0.62));
  }
  masterParts.push(makeReliefPlane(4.8, 5.2, 'palaceCrimsonBrocade', 0, 0.14, -26.4, 0, -Math.PI * 0.5));
  // Flanking sloped stone vehicle ramps (`DL-10`)
  for (const sx of [-1, 1]) {
    masterParts.push(makeReliefBox(5.2, 1.65, 11.0, 'palaceRusticatedBase', sx * 10.8, 0.85, -24.5, 0, 0.15));
    // 8 Symmetrical cloud-pruned topiaries lining retaining wall (`DL-18`)
    for (let ti = 0; ti < 4; ti++) {
      addTopiaryUrn(masterParts, foliageParts, sx * (16.5 + ti * 6.4), 0.05, -21.2, 1.0, 2900 + sx * 10 + ti);
    }
  }

  // 4. Iconic Ngô Viết Thụ Modernist Facade, 3-Tier Bamboo-Node Brise-Soleil & End Wings (`DL-01..12`)
  const mainY = 1.95;
  // Ground-floor shadowed colonnade columns + razor-thin cantilevered porte-cochère (`DL-08`, `DL-10`)
  for (let col = -6; col <= 6; col++) {
    masterParts.push(makeReliefBox(0.75, 4.8, 0.75, 'palacePrecastStone', col * 5.8, mainY + 2.4, -19.2));
  }
  masterParts.push(
    makeReliefBox(24.0, 0.42, 7.6, 'palacePrecastStone', 0, mainY + 4.9, -23.0),
    makeReliefBox(78.4, 0.52, 44.6, 'palacePrecastStone', 0, mainY + 5.0, 2.0)
  );
  // Upper 2nd–3rd Floor Core Recess + Dark Glass & Warm Terracotta Loggia Backdrop (`DL-04`)
  masterParts.push(makeReliefBox(75.0, 9.6, 40.0, 'palacePrecastStone', 0, mainY + 10.0, 3.5));
  darkParts.push(makeBox(46.0, 8.8, 0.35, 0, mainY + 9.8, -17.2));
  // Sculpted 3-Tier Hourglass Bamboo-Node Brise-Soleil (*Rèm Hoa Đá Đốt Trúc*) grouped 3 fins per pilaster bay (`DL-01`, `DL-02`)
  const bayStarts = [-21.5, -15.5, -9.5, 9.5, 15.5, 21.5];
  for (const bx of bayStarts) {
    // Structural vertical concrete bay pilasters (`DL-02`)
    masterParts.push(makeReliefBox(0.55, 9.2, 0.68, 'palacePrecastStone', bx - 2.9, mainY + 9.8, -18.8));
    masterParts.push(makeReliefBox(0.55, 9.2, 0.68, 'palacePrecastStone', bx + 2.9, mainY + 9.8, -18.8));
    // 3 Sculpted hourglass bamboo-node fins inside each bay (`DL-01`)
    for (let f = -1; f <= 1; f++) {
      const fx = bx + f * 1.55;
      for (let tier = 0; tier < 3; tier++) {
        const ty = mainY + 6.75 + tier * 2.95;
        // Double-concave tapered hourglass internode + raised horizontal bamboo joint collar (`đốt trúc`)
        const upperCone = makeCyl(0.42, 0.20, 1.38, 6, fx, ty + 0.68, -18.85);
        const lowerCone = makeCyl(0.20, 0.42, 1.38, 6, fx, ty - 0.68, -18.85);
        const jointRing = makeReliefBox(0.92, 0.14, 0.56, 'palacePrecastStone', fx, ty + 1.42, -18.85);
        masterParts.push(remapRelief(upperCone, 'palacePrecastStone'), remapRelief(lowerCone, 'palacePrecastStone'), jointRing);
      }
    }
  }
  // Slender Central Projecting Khánh Tiết Balcony (`DL-09`)
  masterParts.push(
    makeReliefBox(12.2, 0.36, 3.6, 'palacePrecastStone', 0, mainY + 7.2, -20.2),
    makeReliefBox(12.2, 1.05, 0.24, 'palacePrecastStone', 0, mainY + 7.85, -21.85),
    makeReliefBox(12.4, 0.32, 3.6, 'palacePrecastStone', 0, mainY + 12.2, -20.2)
  );
  // Closed End-Wing Masonry Bays + Carved Floral Stone Relief Spandrels (`DL-06`)
  for (const sx of [-1, 1]) {
    for (let wi = 0; wi < 2; wi++) {
      const wx = sx * (27.8 + wi * 5.6);
      darkParts.push(
        makeBox(2.4, 3.2, 0.25, wx, mainY + 7.4, -18.4),
        makeBox(2.4, 3.2, 0.25, wx, mainY + 12.2, -18.4)
      );
      masterParts.push(makeReliefPlane(3.2, 1.55, 'palaceCarvedSpandrel', wx, mainY + 9.8, -18.25, Math.PI));
    }
  }
  // 4th-Floor Recessed Ribbon Clerestory Band + Broad Overhanging Cantilevered Roof Slab (`DL-07`, `DL-12`)
  const roofY = mainY + 14.8;
  darkParts.push(makeBox(74.0, 2.1, 38.0, 0, roofY + 1.05, 2.0));
  for (let m = -18; m <= 18; m++) {
    masterParts.push(makeReliefBox(0.22, 2.1, 0.55, 'palacePrecastStone', m * 2.0, roofY + 1.05, -17.1));
  }
  masterParts.push(
    makeReliefBox(82.0, 0.72, 48.0, 'palacePrecastStone', 0, roofY + 2.45, 1.5),
    makeBox(82.4, 0.16, 48.4, 0, roofY + 2.86, 1.5)
  );

  // 5. Rooftop *Tứ Phương Vô Sự* Pavilion, Potted Palms, Radio Mast, Flagpole & Helipad with UH-1 `445` (`DL-13..15`, `DL-28..32`)
  const topDeckY = roofY + 2.88;
  masterParts.push(
    makeReliefBox(24.0, 3.6, 14.0, 'palacePrecastStone', 0, topDeckY + 1.8, -4.5),
    makeReliefBox(28.0, 0.48, 17.5, 'palacePrecastStone', 0, topDeckY + 3.85, -4.5)
  );
  darkParts.push(makeBox(22.4, 2.8, 14.2, 0, topDeckY + 1.75, -4.5));
  // Central ceremonial flagpole + animated waving Vietnam flag (`DL-15`)
  whiteParts.push(makeCyl(0.08, 0.14, 9.6, 8, 0, topDeckY + 8.6, -12.6));
  goldParts.push(new THREE.SphereGeometry(0.18, 8, 6).translate(0, topDeckY + 13.45, -12.6));
  const dlFlagMat = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 1.0, showStar: true }).material
    : (() => {
        const fl = createWavingSilkFlagMaterial({ waveScale: 1.0, showStar: true });
        ctx.extraMaterials.push(fl.material);
        if (ctx.animatedUniforms) registerAnimatedUniform(ctx.animatedUniforms, [], fl.uniforms, false);
        return fl.material;
      })();
  const dlFlagGeo = new THREE.PlaneGeometry(4.8, 3.2, 22, 12);
  dlFlagGeo.translate(2.48, 0, 0);
  const dlFlagMesh = new THREE.Mesh(dlFlagGeo, dlFlagMat);
  dlFlagMesh.position.set(0, topDeckY + 11.7, -12.6);
  dlFlagMesh.rotation.y = Math.PI + 0.25;
  group.add(dlFlagMesh);

  // Rooftop Radio Mast (`DL-14`) & Helipad with April 8, 1975 Red Bomb Rings + Bell UH-1H `445` (`DL-28..32`)
  darkParts.push(makeCyl(0.08, 0.28, 11.5, 6, 26.0, topDeckY + 5.75, 4.0));
  masterParts.push(makeArtPlane(20.0, 11.0, 'helipadBombMarker', -12.0, topDeckY + 0.06, 11.5, 0, -Math.PI * 0.5));
  addUH1Huey(masterParts, darkParts, whiteParts, -12.0, topDeckY + 0.08, 11.5, 0.42);
  for (let px = -34; px <= 34; px += 8.5) {
    addTopiaryUrn(masterParts, foliageParts, px, topDeckY, -19.5, 0.72, 2960 + Math.round(px));
  }

  // 6. Historic T-54B / Type 59 Tanks `843` & `390` on Front Park Lawn (`DL-23..27`)
  addTankT54(masterParts, darkParts, whiteParts, -25.0, 0.08, -36.0, -0.35, true);
  addTankT54(masterParts, darkParts, whiteParts, 25.0, 0.08, -36.0, 0.35, false);

  // 7. WALK-IN STATE ROOMS INTERIOR: PHÒNG TRÌNH QUỐC THƯ (Center) & PHÒNG ĐẠI YẾN (Flanks) (`DI-01..32` — Refs 118 & 119!)
  // Plush Wall-to-Wall Golden-Ochre Broadloom Wool Carpet (tiled cleanly in 5×4 quads — ZERO wavy grey floor! `DI-02`)
  for (let gx = 0; gx < 5; gx++) {
    for (let gz = 0; gz < 4; gz++) {
      masterParts.push(
        makeReliefPlane(12.0, 7.5, 'palaceGoldenCarpet', -24 + gx * 12, mainY + 0.04, -14 + gz * 7.5, 0, -Math.PI * 0.5)
      );
    }
  }
  // Full-Height Enclosed State-Room Walls (ZERO floating white stairs! `DI-01`, `DI-03`, `DI-04`)
  whiteParts.push(
    makeBox(62.0, 0.32, 30.0, 0, mainY + 4.82, -2.0), // recessed plaster ceiling
    makeBox(60.0, 4.8, 0.35, 0, mainY + 2.4, 11.8), // rear state wall
    makeBox(0.35, 4.8, 28.0, -29.5, mainY + 2.4, -2.0),
    makeBox(0.35, 4.8, 28.0, 29.5, mainY + 2.4, -2.0)
  );
  // PHÒNG TRÌNH QUỐC THƯ (`DI-16..28`, Ref 119):
  // Monumental 40-Panel (8×5) *Bình Ngô Đại Cáo* Lacquer Mural centered on rear wall above clean white dado!
  masterParts.push(makeArtPlane(13.6, 3.65, 'binhNgoDaiCaoMural', 0, mainY + 2.75, 11.55, Math.PI));
  // Monumental *Sơn Mài* Ceremonial Desk + Twin Corner Flagstaffs + Cream Presidential Throne Armchair (`DI-19`, `DI-20`)
  masterParts.push(makeReliefBox(4.8, 0.96, 1.65, 'palaceSonMaiLacquer', 0, mainY + 0.48, 7.6));
  whiteParts.push(
    makeBox(1.15, 0.55, 1.05, 0, mainY + 0.45, 9.2),
    makeBox(1.15, 1.25, 0.22, 0, mainY + 1.05, 9.65)
  );
  for (const sx of [-2.25, 2.25]) {
    goldParts.push(makeCyl(0.025, 0.035, 1.85, 6, sx, mainY + 1.25, 6.75));
  }
  // Symmetrical U-Shaped Ceremonial Seating Ensemble (Cream Sofas & Armchairs with Gold-Vermilion Lacquer Armrests + Coffee Tables, `DI-21..23`)
  for (const sx of [-1, 1]) {
    // Flanking cream modernist sofas & armchairs
    for (const sz of [1.2, 4.6]) {
      woodParts.push(makeBox(1.45, 0.24, 2.4, sx * 5.8, mainY + 0.12, sz));
      whiteParts.push(
        makeBox(1.25, 0.46, 2.15, sx * 5.8, mainY + 0.46, sz),
        makeBox(0.24, 0.85, 2.15, sx * 6.32, mainY + 0.88, sz)
      );
      masterParts.push(
        makeReliefBox(1.32, 0.22, 0.22, 'palaceSonMaiLacquer', sx * 5.8, mainY + 0.68, sz - 1.08),
        makeReliefBox(1.32, 0.22, 0.22, 'palaceSonMaiLacquer', sx * 5.8, mainY + 0.68, sz + 1.08)
      );
    }
    // Matching glossy *sơn mài* lacquer coffee table in front of each sofa (`DI-23`)
    masterParts.push(makeReliefBox(1.25, 0.52, 2.1, 'palaceSonMaiLacquer', sx * 3.85, mainY + 0.28, 2.9));
    // 4 Tall Patinated Antique-Bronze Trumpet Urns on 4-Legged Dark Hardwood Stands (`DI-24`)
    for (const uz of [6.8, 10.2]) {
      woodParts.push(makeBox(0.62, 0.88, 0.62, sx * 8.2, mainY + 0.44, uz));
      goldParts.push(makeCyl(0.32, 0.16, 0.92, 10, sx * 8.2, mainY + 1.32, uz));
    }
    // Floor-to-ceiling pleated crimson-vermilion brocade curtains framing side walls (`DI-26`)
    for (const czOff of [-6.0, 0.0, 6.0]) {
      masterParts.push(makeReliefBox(0.32, 4.5, 2.8, 'palaceCrimsonBrocade', sx * 10.6, mainY + 2.3, czOff));
    }
  }
  // Grand Multi-Tiered Empire Crystal-and-Brass Chandelier Overhead (`DI-25`)
  goldParts.push(
    makeCyl(0.05, 0.05, 0.95, 6, 0, mainY + 4.35, 3.8),
    new THREE.TorusGeometry(1.45, 0.08, 6, 18).rotateX(Math.PI * 0.5).translate(0, mainY + 3.85, 3.8),
    new THREE.TorusGeometry(0.95, 0.06, 6, 16).rotateX(Math.PI * 0.5).translate(0, mainY + 3.45, 3.8)
  );
  whiteParts.push(new THREE.SphereGeometry(0.32, 8, 6).translate(0, mainY + 3.25, 3.8));

  // PHÒNG ĐẠI YẾN (`DI-05..15`, Ref 118 — West Wing `x = -19.5`):
  // Elongated dark rosewood banquet table, 2 rows of 10 high-backed chairs, sideboard & landscape lacquer mural
  woodParts.push(makeBox(3.4, 0.14, 13.5, -19.5, mainY + 0.84, 1.5));
  whiteParts.push(makeBox(3.52, 0.06, 13.6, -19.5, mainY + 0.92, 1.5));
  for (let ch = 0; ch < 7; ch++) {
    const chZ = -4.2 + ch * 1.9;
    for (const side of [-1, 1]) {
      woodParts.push(
        makeBox(0.56, 0.48, 0.56, -19.5 + side * 2.15, mainY + 0.24, chZ),
        makeBox(0.10, 0.95, 0.52, -19.5 + side * 2.40, mainY + 0.72, chZ)
      );
    }
  }
  masterParts.push(makeArtPlane(8.6, 2.8, 'banquetLacquerMural', -19.5, mainY + 2.65, 11.55, Math.PI));

  // Warm 3000K State-Room Interior Key Light (`DI-30`)
  const stateLight = new THREE.PointLight('#ffdf9e', 9.5, 32.0, 1.5);
  stateLight.position.set(0, mainY + 3.6, 3.5);
  group.add(stateLight);

  // Mature Saigon Tropical Park Canopy Trees enclosing flanks & rear skyline (`DL-22`)
  for (const [tx, tz, th, tr, sd] of [
    [-52, -75, 18, 7.5, 2901],
    [52, -75, 18, 7.5, 2902],
    [-54, -45, 20, 8.2, 2903],
    [54, -45, 20, 8.2, 2904],
    [-52, -12, 22, 8.8, 2905],
    [52, -12, 22, 8.8, 2906],
    [-46, 28, 22, 9.0, 2907],
    [0, 34, 24, 9.5, 2908],
    [46, 28, 22, 9.0, 2909]
  ]) {
    addSaigonParkTree(woodParts, foliageParts, tx, 0, tz, th, tr, sd);
  }

  // Batched Merges (ZERO extra unique materials — reuses shared Saigon Master Atlas & materialLib!)
  const folMat =
    ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide
    }) ?? ctx.materials.darkWood;

  const pondWaterGeo = new THREE.PlaneGeometry(21.6, 9.6);
  pondWaterGeo.rotateX(-Math.PI * 0.5);
  pondWaterGeo.translate(0, 0.36, lawnCenterZ);
  const waterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.stainedGlass ?? ctx.materials.whitePlaster;
  const jetMat =
    ctx.materialLib?.getOrCreateStandard({
      color: '#eaf6fc',
      transparent: true,
      opacity: 0.52,
      roughness: 0.15,
      side: THREE.DoubleSide
    }) ?? ctx.materials.whitePlaster;

  const addM = (name: string, parts: THREE.BufferGeometry[], mat: THREE.Material, cast = true, recv = true) => {
    const m = createMergedMesh(name, parts, mat, cast, recv);
    if (m) group.add(m);
  };
  addM('IndependencePalaceMasterAtlas', masterParts, pack.saigonMasterAtlasMat, true, true);
  addM('IndependencePalaceWhiteTrim', whiteParts, ctx.materials.whitePlaster, true, true);
  addM('IndependencePalaceGoldTrim', goldParts, ctx.materials.gold, false, false);
  addM('IndependencePalaceTimberAndTrunks', woodParts, ctx.materials.darkIronwood ?? ctx.materials.darkWood, true, true);
  addM('IndependencePalaceDarkMetals', darkParts, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceGlass', glassParts, ctx.materials.stainedGlass ?? ctx.materials.darkVoid, false, false);
  addM('IndependencePalaceParkFoliage', foliageParts, folMat, false, false);
  addM('IndependencePalaceFountainJets', jetParts, jetMat, false, false);
  const waterMesh = new THREE.Mesh(pondWaterGeo, waterMat);
  waterMesh.name = 'IndependencePalacePondWater';
  group.add(waterMesh);

  tagMotifIds(group, ['HV-E01', 'HV-E04', 'HV-I02']);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 62.0 }, { x: 0, z: 195, r: 58.0 });
}

// =================================================================================================
// 2. NHÀ THỜ ĐỨC BÀ SÀI GÒN (NOTRE-DAME CATHEDRAL BASILICA) AT (108, 190) — `ND-01..32`, `NI-01..32`
// =================================================================================================
export function buildNotreDameSaigonComplex(ctx: VietnamBuilderContext): void {
  const cx = 138;
  const cz = 190;
  const yBase = ctx.getHeight(cx, cz);
  const pack = getOrCreateSaigonPack(ctx);

  const group = new THREE.Group();
  group.name = 'NotreDameSaigonComplex';
  group.position.set(cx, yBase, cz);

  const masterParts: THREE.BufferGeometry[] = [];
  const marbleParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const darkParts: THREE.BufferGeometry[] = [];
  const glowParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  // 1. Paris Commune Square Oval Granite Plaza, Lush Curved Flowerbeds, Parisian Lamps & Carrara Marble Virgin Mary (`ND-25..32`)
  const maryZ = -50.0; // Authentic spatial separation from cathedral facade (`z = -24.0`, `ND-26`)!
  const maryGroundRel = ctx.getHeight(cx, cz + maryZ) - yBase;
  masterParts.push(makeReliefBox(44.0, 0.72, 106.0, 'creamLimestone', 0, -0.34, 8.0));
  const ovalPlaza = new THREE.CylinderGeometry(18.0, 18.6, 0.42, 32);
  ovalPlaza.scale(1.12, 1.0, 0.92);
  ovalPlaza.translate(0, maryGroundRel - 0.16, maryZ);
  masterParts.push(remapRelief(ovalPlaza, 'creamLimestone'));

  // Multi-Tiered Polished Red-Brown Granite Octagonal Pedestal + Bolted Bronze `REGINA PACIS` Plaque (`ND-27`, `ND-28`)
  masterParts.push(
    remapRelief(makeCyl(3.8, 4.1, 0.36, 8, 0, maryGroundRel + 0.18, maryZ), 'palaceRusticatedBase'),
    remapRelief(makeCyl(2.9, 3.2, 0.36, 8, 0, maryGroundRel + 0.54, maryZ), 'palaceRusticatedBase'),
    remapRelief(makeCyl(1.42, 1.56, 2.75, 16, 0, maryGroundRel + 2.08, maryZ), 'palaceSonMaiLacquer'),
    remapRelief(makeCyl(1.68, 1.52, 0.34, 16, 0, maryGroundRel + 3.55, maryZ), 'creamLimestone')
  );
  // Crisp Bolted Bronze `REGINA PACIS` Plaque facing North (`-Z`) (`ND-28`)
  masterParts.push(makeArtPlane(1.45, 0.78, 'reginaPacisPlaque', 0, maryGroundRel + 2.15, maryZ - 1.54, Math.PI));

  // Sculpted 4.6m Carrara White Marble Statue of Our Lady of Peace (*Đức Mẹ Hòa Bình*, `ND-25`)
  const statY = maryGroundRel + 3.72;
  marbleParts.push(
    makeCyl(0.76, 0.96, 0.38, 12, 0, statY + 0.19, maryZ), // rocky cloud base
    makeCyl(0.46, 0.78, 2.75, 14, 0, statY + 1.72, maryZ), // fluted marble robe
    makeCyl(0.56, 0.48, 1.05, 12, 0, statY + 3.25, maryZ), // draped mantle & shoulders
    new THREE.SphereGeometry(0.32, 10, 8).translate(0, statY + 4.02, maryZ), // serene upturned head & veil
    new THREE.SphereGeometry(0.34, 10, 8).translate(0, statY + 2.95, maryZ - 0.46) // globe cradled at chest
  );
  goldParts.push(
    makeBox(0.06, 0.48, 0.06, 0, statY + 3.48, maryZ - 0.46),
    makeBox(0.28, 0.06, 0.06, 0, statY + 3.58, maryZ - 0.46)
  );

  // Lush Curved Flowerbeds & Manicured Ficus Topiary Urns (`ND-30` — replaces pastel Easter eggs!) + Parisian Lamps (`ND-32`)
  for (let q = 0; q < 4; q++) {
    const qa = (q / 4) * Math.PI * 2 + Math.PI * 0.25;
    const fx = Math.cos(qa) * 10.6;
    const fz = maryZ + Math.sin(qa) * 9.0;
    addTopiaryUrn(masterParts, foliageParts, fx, maryGroundRel + 0.04, fz, 0.95, 3040 + q);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI * 0.125;
    const lx = Math.cos(a) * 15.6;
    const lz = maryZ + Math.sin(a) * 13.0;
    darkParts.push(makeCyl(0.07, 0.14, 4.4, 8, lx, maryGroundRel + 2.2, lz));
    glowParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(lx, maryGroundRel + 4.55, lz));
  }

  // 2. Marseille Unplastered Red-Orange Brick Facade, Twin 60.5m Bell Towers, Rose Window & Swiss Clock (`ND-01..24`)
  const frontZ = -24.0;
  // Twin 60.5m Bell Towers at x = ±11.2, z = -20.5 (`ND-01..04`, `ND-17..24`)
  for (const sx of [-1, 1]) {
    const tx = sx * 11.2;
    const tz = -20.5;
    // Lower sandstone stepped plinth + 38m Marseille brick square shaft (`ND-01`, `ND-02`, `ND-04`)
    masterParts.push(
      makeReliefBox(9.8, 3.2, 9.8, 'creamLimestone', tx, 1.6, tz),
      makeReliefBox(9.2, 34.8, 9.2, 'marseilleBrick', tx, 20.6, tz)
    );
    // Projecting stepped corner buttresses & Romanesque cream-limestone stringcourses (`ND-04`, `ND-05`)
    for (const bx of [-4.6, 4.6]) {
      for (const bz of [-4.6, 4.6]) {
        masterParts.push(makeReliefBox(0.85, 36.5, 0.85, 'creamLimestone', tx + bx, 19.5, tz + bz));
      }
    }
    for (const sy of [11.2, 20.4, 29.8, 37.8]) {
      masterParts.push(makeReliefBox(10.0, 0.68, 10.0, 'creamLimestone', tx, sy, tz));
    }
    // Deeply Recessed Ground Side Portals with Wrought-Iron Gates & Mahogany Doors proud of tower brick (`ND-03`, `ND-11`)
    const sidePortal = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(6.8, 8.8, 1.2, 3.6, 6.2)), 'creamLimestone');
    sidePortal.translate(tx, 0.2, tz - 4.8);
    masterParts.push(sidePortal);
    masterParts.push(makeReliefBox(3.55, 5.4, 0.24, 'cathedralDoorWood', tx, 2.9, tz - 4.78));
    // Mid-Tier Grand Enclosing Arch (Oculus + Twin Bifora) (`ND-17`) & Belfry Tier Horizontal Louver Slats (`ND-18`)
    for (const [wy, wh, hasSlats] of [
      [15.6, 5.4, false],
      [25.0, 5.6, false],
      [33.8, 5.8, true]
    ] as const) {
      for (const ox of [-1.55, 1.55]) {
        darkParts.push(makeBox(1.85, wh, 0.32, tx + ox, wy, tz - 4.66));
        masterParts.push(
          makeReliefBox(2.2, 0.28, 0.42, 'creamLimestone', tx + ox, wy - wh * 0.5, tz - 4.72),
          remapRelief(new THREE.TorusGeometry(0.95, 0.16, 6, 12, Math.PI).translate(tx + ox, wy + wh * 0.35, tz - 4.72), 'creamLimestone')
        );
        if (hasSlats) {
          for (let sl = -4; sl <= 4; sl++) {
            darkParts.push(makeBox(1.65, 0.14, 0.42, tx + ox, wy + sl * 0.52, tz - 4.74, 0, 0.45));
          }
        }
      }
    }
    // Octagonal Slate-Grey Zinc Spires (`zincSpireCladding`), 4 Gabled Dormer Lucarnes, Corner Gablets & Gilded Crosses to 60.5m (`ND-20..24`)
    const spire = makeCyl(0.28, 4.45, 19.6, 8, tx, 48.0, tz);
    masterParts.push(remapRelief(spire, 'zincSpireCladding'));
    // 4 Deeply projecting gabled dormer lucarnes around spire base (`ND-21`)
    for (let d = 0; d < 4; d++) {
      const ang = (d / 4) * Math.PI * 2;
      const luc = makeReliefBox(1.85, 3.2, 1.65, 'zincSpireCladding', 0, 0, -4.1);
      luc.rotateY(ang);
      luc.translate(tx, 39.8, tz);
      masterParts.push(luc);
      const lHole = makeBox(1.1, 2.1, 0.35, 0, 0, -4.85);
      lHole.rotateY(ang);
      lHole.translate(tx, 39.6, tz);
      darkParts.push(lHole);
    }
    // Gilded Cross crowning 60.5m spire apex (`ND-24`)
    goldParts.push(
      new THREE.SphereGeometry(0.38, 10, 8).translate(tx, 57.8, tz),
      makeBox(0.24, 2.9, 0.24, tx, 59.2, tz),
      makeBox(1.8, 0.24, 0.24, tx, 59.7, tz)
    );
  }

  // Central Gabled Facade Bay: Deeply Recessed Portal, Inscribed 1880 Tympanum, Trifora, Carved Rose Window & Swiss Clock (`ND-06..16`)
  masterParts.push(makeReliefBox(13.6, 29.8, 2.2, 'marseilleBrick', 0, 14.9, frontZ + 0.8));
  // Central gabled triangular pediment + raking limestone cornice + apex cross (`ND-15`, `ND-16`)
  const pedSh = new THREE.Shape();
  pedSh.moveTo(-7.2, 0);
  pedSh.lineTo(7.2, 0);
  pedSh.lineTo(0, 7.6);
  pedSh.closePath();
  const pedGeo = remapRelief(normalizeExtrudeUv(new THREE.ExtrudeGeometry(pedSh, { depth: 2.2, bevelEnabled: false })), 'marseilleBrick');
  pedGeo.translate(0, 29.8, frontZ - 0.3);
  masterParts.push(pedGeo);
  goldParts.push(
    makeBox(0.24, 2.2, 0.24, 0, 38.4, frontZ + 0.4),
    makeBox(1.35, 0.24, 0.24, 0, 38.8, frontZ + 0.4)
  );
  // Deeply recessed central portal archivolts + inscribed 1880 tympanum + paneled mahogany doors (`ND-09`, `ND-10`)
  const mainPortal = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(12.2, 11.4, 2.4, 6.2, 8.6)), 'creamLimestone');
  mainPortal.translate(0, 0.2, frontZ - 0.35);
  masterParts.push(mainPortal);
  masterParts.push(
    makeArtPlane(5.4, 2.1, 'notreDameTympanum', 0, 7.2, frontZ - 0.65, Math.PI),
    makeReliefBox(2.95, 5.9, 0.28, 'cathedralDoorWood', -1.52, 3.05, frontZ - 0.58),
    makeReliefBox(2.95, 5.9, 0.28, 'cathedralDoorWood', 1.52, 3.05, frontZ - 0.58)
  );
  // Ground-gallery trifora (3 arched windows with stained glass & stone mullions, `ND-12`)
  for (const gx of [-3.4, 0, 3.4]) {
    masterParts.push(
      makeReliefPlane(2.1, 4.2, 'stainedGlassLancet', gx, 14.8, frontZ - 0.38, Math.PI),
      makeReliefBox(2.45, 0.26, 0.38, 'creamLimestone', gx, 12.6, frontZ - 0.42)
    );
  }
  // Carved 8-Roundel Limestone Rose Window (`ND-13`) & Swiss Cathedral Clock with Roman Numerals (`ND-14`)
  const roseDisk = remapRelief(new THREE.CircleGeometry(3.85, 24), 'roseWindowTracery');
  roseDisk.rotateY(Math.PI);
  roseDisk.translate(0, 22.8, frontZ - 0.42);
  masterParts.push(roseDisk);
  masterParts.push(remapRelief(new THREE.TorusGeometry(3.95, 0.32, 8, 24).translate(0, 22.8, frontZ - 0.44), 'creamLimestone'));
  const clockDisk = remapArt(new THREE.CircleGeometry(1.75, 20), 'saigonClockFace');
  clockDisk.rotateY(Math.PI);
  clockDisk.translate(0, 31.8, frontZ - 0.42);
  masterParts.push(clockDisk);
  masterParts.push(remapRelief(new THREE.TorusGeometry(1.82, 0.22, 8, 20).translate(0, 31.8, frontZ - 0.44), 'creamLimestone'));

  // 3. WALK-IN ROMANESQUE-GOTHIC CATHEDRAL NAVE INTERIOR (`NI-01..32`, Ref 120 — ZERO exterior brick or sky holes!)
  const naveLen = 62.0; // z from -22.0 to +40.0
  const naveStartZ = -22.0;
  const naveEndZ = 40.0;
  const naveH = 24.0;
  // Exterior Marseille brick shell + dark pitched slate nave roof
  for (const sx of [-1, 1]) {
    masterParts.push(makeReliefBox(0.85, naveH, naveLen, 'marseilleBrick', sx * 15.6, naveH * 0.5, 9.0));
  }
  const naveRoof = createVietnameseCurvedRoofGeometry(32.5, naveLen + 2.0, 2.0, naveLen - 4.0, 7.5, 0.02);
  naveRoof.translate(0, naveH, 9.0);
  darkParts.push(naveRoof);

  // Completely Sealed Smooth Warm Cream/Ochre Lime-Plaster Nave Walls & Side Aisles (`NI-06`, `NI-14`, `NI-15`)
  for (const sx of [-1, 1]) {
    masterParts.push(makeReliefBox(0.45, naveH, naveLen, 'naveCreamVault', sx * 15.0, naveH * 0.5, 9.0));
    // Continuous molded cream horizontal stringcourses separating arcade, triforium & clerestory (`NI-11`)
    masterParts.push(
      makeReliefBox(0.45, 0.42, naveLen, 'creamLimestone', sx * 7.6, 9.8, 9.0),
      makeReliefBox(0.45, 0.42, naveLen, 'creamLimestone', sx * 7.6, 15.4, 9.0)
    );
  }
  // Full-Width Sealed Smooth Cream-Plaster Vault Ceiling covering Central Nave + BOTH Side Aisles (ZERO sky gaps! `NI-01`, `NI-14`)
  masterParts.push(makeReliefPlane(31.0, naveLen + 4.0, 'naveCreamVault', 0, naveH - 0.15, 9.0, 0, Math.PI * 0.5));
  for (let bay = 0; bay <= 7; bay++) {
    const bz = naveStartZ + bay * 8.2;
    // Bold deep ochre-brown transverse stone-banded arch (`NI-02`)
    const tArch = new THREE.TorusGeometry(7.6, 0.34, 8, 22, Math.PI);
    tArch.translate(0, 16.2, bz);
    masterParts.push(remapRelief(tArch, 'marseilleBrick'));
    // Sculpted keystone boss at vault apex (`NI-03`)
    goldParts.push(new THREE.SphereGeometry(0.42, 8, 6).translate(0, 23.75, bz));
    // Massive Cream-Plaster Clustered Arcade Piers, Corinthian Capitals & Engaged Ochre-Brown Wall Colonnettes (`NI-07..10`)
    for (const sx of [-1, 1]) {
      masterParts.push(
        makeReliefBox(1.55, 9.8, 1.55, 'naveCreamVault', sx * 7.6, 4.9, bz),
        makeReliefBox(2.05, 0.65, 2.05, 'creamLimestone', sx * 7.6, 0.32, bz), // stepped base
        makeReliefBox(2.05, 0.72, 2.05, 'creamLimestone', sx * 7.6, 9.65, bz), // Corinthian capital
        remapRelief(makeCyl(0.24, 0.24, 16.4, 8, sx * 6.82, 8.2, bz), 'marseilleBrick') // engaged brown colonnette
      );
      if (bay < 7) {
        const midZ = bz + 4.1;
        // Ground arcade semicircular arch (`NI-10`)
        const arcA = new THREE.TorusGeometry(3.55, 0.28, 6, 14, Math.PI);
        arcA.rotateY(Math.PI * 0.5);
        arcA.translate(sx * 7.6, 6.4, midZ);
        masterParts.push(remapRelief(arcA, 'creamLimestone'));
        // 2nd-story Triforium bifora stained-glass bay (`NI-12`) + 3rd-story Clerestory stained-glass lunette (`NI-13`)
        masterParts.push(
          makeReliefPlane(3.2, 3.6, 'stainedGlassLancet', sx * 7.85, 12.6, midZ, -sx * Math.PI * 0.5),
          makeReliefPlane(2.8, 4.2, 'stainedGlassLancet', sx * 14.68, 10.5, midZ, -sx * Math.PI * 0.5),
          makeArtPlane(1.25, 1.55, 'stationsOfCross', sx * 14.68, 3.6, midZ, -sx * Math.PI * 0.5)
        );
      }
    }
    // Ornate Hanging Wrought-Iron & Brass Cathedral Chandelier suspended along central aisle (`NI-29`)
    if (bay >= 1 && bay <= 6) {
      const chZ = bz - 4.1;
      darkParts.push(makeCyl(0.035, 0.035, 11.2, 5, 0, 18.2, chZ));
      goldParts.push(
        new THREE.TorusGeometry(1.15, 0.08, 6, 16).rotateX(Math.PI * 0.5).translate(0, 12.6, chZ),
        new THREE.TorusGeometry(0.65, 0.06, 6, 12).rotateX(Math.PI * 0.5).translate(0, 13.3, chZ)
      );
      for (let c = 0; c < 6; c++) {
        const ca = (c / 6) * Math.PI * 2;
        glowParts.push(new THREE.SphereGeometry(0.14, 6, 5).translate(Math.cos(ca) * 1.15, 12.82, chZ + Math.sin(ca) * 1.15));
      }
    }
  }

  // Isometric Tumbling-Block French Encaustic Cathedral Tile Floor (`NI-17`, `NI-18` — tiled cleanly in 6×14 quads!)
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 14; gz++) {
      const tw = 29.0 / 6;
      const td = 62.0 / 14;
      masterParts.push(
        makeReliefPlane(tw, td, 'cathedralTumblingTile', -14.5 + (gx + 0.5) * tw, 0.06, naveStartZ + (gz + 0.5) * td, 0, -Math.PI * 0.5)
      );
    }
  }

  // 16 Tightly Spaced Symmetrical Rows of Dark Polished Mahogany Pews with Backrests & Kneelers (`NI-19..21`)
  for (let row = 0; row < 16; row++) {
    const pz = -14.0 + row * 2.65;
    for (const sx of [-1, 1]) {
      const px = sx * 4.25;
      masterParts.push(
        makeReliefBox(4.35, 0.10, 0.54, 'cathedralDoorWood', px, 0.52, pz), // seat
        makeReliefBox(4.35, 0.62, 0.09, 'cathedralDoorWood', px, 0.88, pz - 0.24), // slatted backrest
        makeReliefBox(4.20, 0.08, 0.22, 'cathedralDoorWood', px, 0.16, pz - 0.52), // kneeler
        makeReliefBox(0.12, 1.12, 0.62, 'cathedralDoorWood', px - 2.15, 0.56, pz),
        makeReliefBox(0.12, 1.12, 0.62, 'cathedralDoorWood', px + 2.15, 0.56, pz)
      );
    }
  }

  // Three-Tier Curved Semicircular Apse, Radiating 6-Rib Half-Dome, 5 Glowing Stained-Glass Lancets & Carved Marble High Altar (`NI-22..28`)
  const apseCenterZ = naveEndZ;
  const apseR = 8.4;
  // Curved apse wall segments + 5 tall glowing ruby/cobalt/gold stained-glass apse lancets (`NI-22`, `NI-23`)
  for (let seg = 0; seg < 7; seg++) {
    const a0 = -Math.PI * 0.5 + (seg / 7) * Math.PI;
    const a1 = -Math.PI * 0.5 + ((seg + 1) / 7) * Math.PI;
    const am = (a0 + a1) * 0.5;
    const ax = Math.sin(am) * apseR;
    const az = apseCenterZ + Math.cos(am) * apseR;
    const segW = 2 * apseR * Math.sin(Math.PI / 14) + 0.25;
    masterParts.push(makeReliefBox(segW, naveH, 0.65, 'naveCreamVault', ax, naveH * 0.5, az, am));
    if (seg >= 1 && seg <= 5) {
      // Glowing stained-glass apse clerestory lancet facing into nave (`NI-23`)
      masterParts.push(
        makeReliefPlane(2.1, 6.2, 'stainedGlassLancet', Math.sin(am) * (apseR - 0.42), 14.5, apseCenterZ + Math.cos(am) * (apseR - 0.42), am + Math.PI)
      );
    }
  }
  // Radiating semicircular apse half-dome vault (`NI-05`)
  const halfDome = new THREE.SphereGeometry(apseR, 14, 8, 0, Math.PI, 0, Math.PI * 0.5);
  halfDome.rotateY(Math.PI * 0.5);
  halfDome.translate(0, 16.2, apseCenterZ);
  masterParts.push(remapRelief(halfDome, 'naveCreamVault'));

  // Raised Multi-Tiered Marble Sanctuary Steps, Carved Marble High Altar with White Cloth, 6 Brass Candlesticks & Suspended Crucifix (`NI-24..27`)
  marbleParts.push(
    makeBox(13.5, 0.32, 9.5, 0, 0.16, apseCenterZ - 1.5),
    makeBox(11.5, 0.32, 8.0, 0, 0.48, apseCenterZ - 0.8),
    makeBox(9.5, 0.32, 6.5, 0, 0.80, apseCenterZ - 0.2),
    // Carved marble high altar + draped white linen altar cloth
    makeBox(4.8, 1.32, 1.65, 0, 1.62, apseCenterZ + 0.8),
    makeBox(5.05, 0.16, 1.82, 0, 2.32, apseCenterZ + 0.8)
  );
  // 6 Tall Brass Candlesticks with lit warm candles + gilded altar crucifix (`NI-24`, `NI-27`)
  for (const cxOff of [-1.95, -1.35, -0.75, 0.75, 1.35, 1.95]) {
    goldParts.push(makeCyl(0.05, 0.12, 0.78, 8, cxOff, 2.75, apseCenterZ + 0.8));
    glowParts.push(new THREE.SphereGeometry(0.07, 5, 4).translate(cxOff, 3.22, apseCenterZ + 0.8));
  }
  goldParts.push(
    makeBox(0.18, 3.8, 0.18, 0, 5.2, apseCenterZ + 2.2),
    makeBox(2.2, 0.18, 0.18, 0, 6.1, apseCenterZ + 2.2)
  );
  // Warm Balanced Golden Sanctuary Lighting (`NI-30`, `NI-31`)
  const sanctuaryLight = new THREE.PointLight('#ffcc6e', 5.8, 42.0, 1.5);
  sanctuaryLight.position.set(0, 8.5, apseCenterZ - 1.5);
  group.add(sanctuaryLight);

  // Mature Saigon Tropical Canopy Trees framing cathedral flanks (`ND-31`)
  for (const [tx, tz, th, tr, sd] of [
    [-26, -42, 16, 6.8, 3001],
    [26, -42, 16, 6.8, 3002],
    [-28, -12, 18, 7.5, 3003],
    [28, -12, 18, 7.5, 3004],
    [-28, 22, 18, 7.5, 3005],
    [28, 22, 18, 7.5, 3006]
  ]) {
    addSaigonParkTree(woodParts, foliageParts, tx, 0, tz, th, tr, sd);
  }

  // Batched Merges (ZERO extra unique materials!)
  const folMat =
    ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide
    }) ?? ctx.materials.darkWood;

  const addM = (name: string, parts: THREE.BufferGeometry[], mat: THREE.Material, cast = true, recv = true) => {
    const m = createMergedMesh(name, parts, mat, cast, recv);
    if (m) group.add(m);
  };
  addM('NotreDameMasterAtlas', masterParts, pack.saigonMasterAtlasMat, true, true);
  addM('NotreDameCarraraMarble', marbleParts, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, true, true);
  addM('NotreDameGoldCrossesAndAltars', goldParts, ctx.materials.gold, false, false);
  addM('NotreDameTreeTrunks', woodParts, ctx.materials.darkIronwood ?? ctx.materials.darkWood, true, true);
  addM('NotreDameDarkIronAndRoofs', darkParts, ctx.materials.darkVoid, true, true);
  addM('NotreDameWarmLampsAndCandles', glowParts, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDamePlazaFoliage', foliageParts, folMat, false, false);

  tagMotifIds(group, ['HV-H05', 'HV-I01', 'HV-I02']);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz + 6.0, r: 54.0 }, { x: cx, z: 144, r: 19.0 });
}
