import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createGableRoofGeometry,
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
  // [041][053][054] Historic White Masonry Piers, Black Wrought-Iron Perimeter Gates, Full-Width Fence & Twin Guardhouses (`Cổng Chính`)
  for (const gx of [-18, -8, 8, 18]) {
    masterParts.push(makeReliefBox(1.15, 3.6, 1.15, 'palacePrecastStone', gx, 1.8, -97.5));
    goldParts.push(new THREE.SphereGeometry(0.22, 6, 5).translate(gx, 3.72, -97.5));
  }
  for (let bar = -7; bar <= 7; bar++) {
    darkParts.push(makeCyl(0.035, 0.035, 2.8, 4, bar * 1.05, 1.4, -97.5));
    goldParts.push(new THREE.ConeGeometry(0.06, 0.18, 4).translate(bar * 1.05, 2.88, -97.5));
  }
  // Full-width perimeter masonry dwarf wall & wrought-iron fence + twin modernist Guardhouses (Nhà Bảo Vệ)
  for (const sx of [-1, 1]) {
    masterParts.push(
      makeReliefBox(44.0, 0.95, 0.55, 'palacePrecastStone', sx * 40.0, 0.48, -97.5),
      makeReliefBox(3.4, 2.7, 3.0, 'palacePrecastStone', sx * 21.5, 1.35, -95.2),
      makeReliefBox(4.4, 0.28, 4.0, 'palacePrecastStone', sx * 21.5, 2.84, -95.2)
    );
    darkParts.push(makeBox(2.4, 1.3, 2.2, sx * 21.5, 1.55, -95.2));
    for (let fb = 0; fb < 16; fb++) {
      darkParts.push(makeCyl(0.03, 0.03, 1.65, 4, sx * (20.0 + fb * 2.6), 1.75, -97.5));
    }
  }
  // [055][056][057][058] Curved red-brick garden walkways, floral beds, Saigon park benches & globe park lamps
  for (const sx of [-1, 1]) {
    masterParts.push(
      makeReliefBox(2.4, 0.10, 42.0, 'palaceCrimsonBrocade', sx * 29.0, 0.08, -62.0),
      makeReliefBox(1.8, 0.42, 16.0, 'palaceCrimsonBrocade', sx * 13.8, 0.22, lawnCenterZ)
    );
    for (let bz = -82; bz <= -42; bz += 14) {
      woodParts.push(makeBox(1.65, 0.46, 0.58, sx * 26.8, 0.28, bz));
      darkParts.push(makeCyl(0.05, 0.07, 3.2, 6, sx * 30.8, 1.6, bz));
      whiteParts.push(new THREE.SphereGeometry(0.24, 7, 5).translate(sx * 30.8, 3.35, bz));
    }
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
  // [051] Sculpted central lotus-spout column & submerged nozzle pedestals inside fountain basin
  masterParts.push(
    remapRelief(makeCyl(0.45, 0.65, 1.35, 8, 0, 0.72, lawnCenterZ), 'palacePrecastStone'),
    remapRelief(makeCyl(1.15, 0.35, 0.36, 10, 0, 1.45, lawnCenterZ), 'palacePrecastStone')
  );
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
  // [052] Ornamental cycad (*vạn tuế*) stone planters flanking ceremonial steps (`DL-10`)
  for (const sx of [-1, 1]) {
    masterParts.push(makeReliefBox(5.2, 1.65, 11.0, 'palaceRusticatedBase', sx * 10.8, 0.85, -24.5, 0, 0.15));
    masterParts.push(makeReliefBox(1.6, 0.65, 1.6, 'palacePrecastStone', sx * 8.2, 0.35, -24.5));
    for (let cf = 0; cf < 6; cf++) {
      const ca = (cf / 6) * Math.PI * 2;
      const frond = new THREE.PlaneGeometry(0.42, 1.35);
      frond.rotateX(0.95);
      frond.rotateY(ca);
      frond.translate(sx * 8.2 + Math.sin(ca) * 0.45, 0.92, -24.5 + Math.cos(ca) * 0.45);
      foliageParts.push(colorizeGeo(frond, '#2a6c28'));
    }
    // 8 Symmetrical cloud-pruned topiaries lining retaining wall (`DL-18`)
    for (let ti = 0; ti < 4; ti++) {
      addTopiaryUrn(masterParts, foliageParts, sx * (16.5 + ti * 6.4), 0.05, -21.2, 1.0, 2900 + sx * 10 + ti);
    }
  }

  // 4. Iconic Ngô Viết Thụ Modernist Facade, 3-Tier Bamboo-Node Brise-Soleil & End Wings (`DL-01..12`)
  const mainY = 1.95;
  // [042] Ground-floor shadowed colonnade columns with plinth bases & lotus-petal capitals + porte-cochère (`DL-08`, `DL-10`)
  for (let col = -6; col <= 6; col++) {
    const cxCol = col * 5.8;
    masterParts.push(
      makeReliefBox(0.75, 4.8, 0.75, 'palacePrecastStone', cxCol, mainY + 2.4, -19.2),
      makeReliefBox(1.02, 0.36, 1.02, 'palacePrecastStone', cxCol, mainY + 0.18, -19.2),
      makeReliefBox(1.06, 0.34, 1.06, 'palacePrecastStone', cxCol, mainY + 4.65, -19.2)
    );
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
        // [043] Double-concave tapered hourglass internode + raised horizontal bamboo joint collar (`đốt trúc`) + mid-node ring
        const upperCone = makeCyl(0.42, 0.20, 1.38, 6, fx, ty + 0.68, -18.85);
        const lowerCone = makeCyl(0.20, 0.42, 1.38, 6, fx, ty - 0.68, -18.85);
        const jointRing = makeReliefBox(0.92, 0.14, 0.56, 'palacePrecastStone', fx, ty + 1.42, -18.85);
        const midCollar = makeReliefBox(0.56, 0.12, 0.44, 'palacePrecastStone', fx, ty, -18.85);
        masterParts.push(remapRelief(upperCone, 'palacePrecastStone'), remapRelief(lowerCone, 'palacePrecastStone'), jointRing, midCollar);
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

  // [044] 5. Rooftop *Tứ Phương Vô Sự* Pavilion with Eaves Fascia & Mullions, Radio Mast, Flagpole & Helipad (`DL-13..15`, `DL-28..32`)
  const topDeckY = roofY + 2.88;
  masterParts.push(
    makeReliefBox(24.0, 3.6, 14.0, 'palacePrecastStone', 0, topDeckY + 1.8, -4.5),
    makeReliefBox(28.0, 0.48, 17.5, 'palacePrecastStone', 0, topDeckY + 3.85, -4.5),
    makeReliefBox(28.6, 0.22, 18.1, 'palacePrecastStone', 0, topDeckY + 4.15, -4.5)
  );
  darkParts.push(makeBox(22.4, 2.8, 14.2, 0, topDeckY + 1.75, -4.5));
  for (let pm = -9; pm <= 9; pm += 3) {
    masterParts.push(makeReliefBox(0.24, 3.2, 0.28, 'palacePrecastStone', pm, topDeckY + 1.8, -11.65));
  }
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

  // [045][046] Rooftop Radio Mast (`DL-14`) & Helipad with White "H" Ring + Bell UH-1H `445` (`DL-28..32`)
  darkParts.push(makeCyl(0.08, 0.28, 11.5, 6, 26.0, topDeckY + 5.75, 4.0));
  masterParts.push(makeArtPlane(20.0, 11.0, 'helipadBombMarker', -12.0, topDeckY + 0.06, 11.5, 0, -Math.PI * 0.5));
  whiteParts.push(
    new THREE.RingGeometry(4.1, 4.45, 20).rotateX(-Math.PI * 0.5).translate(-12.0, topDeckY + 0.08, 11.5),
    makeBox(0.32, 0.04, 2.8, -12.8, topDeckY + 0.08, 11.5),
    makeBox(0.32, 0.04, 2.8, -11.2, topDeckY + 0.08, 11.5),
    makeBox(1.6, 0.04, 0.32, -12.0, topDeckY + 0.08, 11.5)
  );
  addUH1Huey(masterParts, darkParts, whiteParts, -12.0, topDeckY + 0.08, 11.5, 0.42);
  for (let px = -34; px <= 34; px += 8.5) {
    addTopiaryUrn(masterParts, foliageParts, px, topDeckY, -19.5, 0.72, 2960 + Math.round(px));
  }

  // 6. Historic T-54B / Type 59 Tanks `843` & `390` on Front Park Lawn with Road-Wheels & Liberation Markers (`DL-23..27`)
  addTankT54(masterParts, darkParts, whiteParts, -25.0, 0.08, -36.0, -0.35, true);
  addTankT54(masterParts, darkParts, whiteParts, 25.0, 0.08, -36.0, 0.35, false);
  for (const [tx, tyaw] of [[-25.0, -0.35], [25.0, 0.35]] as const) {
    for (let rw = -2; rw <= 2; rw++) {
      for (const side of [-1.45, 1.45]) {
        darkParts.push(
          new THREE.CylinderGeometry(0.36, 0.36, 0.24, 8)
            .rotateZ(Math.PI * 0.5)
            .translate(side, 0.42, rw * 0.98)
            .rotateY(tyaw)
            .translate(tx, 0.08, -36.0)
        );
      }
    }
  }

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
  // [047][048] Twin Corner Flagstaffs grounded solidly on floor & Carved Ceiling Coffers (`DI-19`, `DI-20`)
  for (const sx of [-2.25, 2.25]) {
    goldParts.push(makeCyl(0.025, 0.035, 2.18, 6, sx, mainY + 1.09, 6.75));
    masterParts.push(makeReliefBox(0.75, 0.52, 0.06, 'palaceCrimsonBrocade', sx + (sx < 0 ? 0.35 : -0.35), mainY + 1.92, 6.75, 0.25));
  }
  for (let cf = -1; cf <= 1; cf++) {
    whiteParts.push(makeBox(14.0, 0.16, 0.28, 0, mainY + 4.66, cf * 4.2));
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

  // [049][050] PHÒNG ĐẠI YẾN (`DI-05..15`, Ref 118 — West Wing `x = -19.5`) + Porcelain Place Settings & Grand Staircase:
  // Elongated dark rosewood banquet table with grounded trestle pedestals, 2 rows of chairs, sideboard & landscape lacquer mural
  woodParts.push(
    makeBox(3.4, 0.14, 13.5, -19.5, mainY + 0.84, 1.5),
    makeBox(1.8, 0.78, 1.2, -19.5, mainY + 0.39, -3.2),
    makeBox(1.8, 0.78, 1.2, -19.5, mainY + 0.39, 1.5),
    makeBox(1.8, 0.78, 1.2, -19.5, mainY + 0.39, 6.2)
  );
  whiteParts.push(makeBox(3.52, 0.06, 13.6, -19.5, mainY + 0.92, 1.5));
  for (let ch = 0; ch < 7; ch++) {
    const chZ = -4.2 + ch * 1.9;
    for (const side of [-1, 1]) {
      woodParts.push(
        makeBox(0.56, 0.48, 0.56, -19.5 + side * 2.15, mainY + 0.24, chZ),
        makeBox(0.10, 0.95, 0.52, -19.5 + side * 2.40, mainY + 0.72, chZ)
      );
      whiteParts.push(makeCyl(0.16, 0.14, 0.04, 8, -19.5 + side * 1.15, mainY + 0.98, chZ));
    }
  }
  masterParts.push(makeArtPlane(8.6, 2.8, 'banquetLacquerMural', -19.5, mainY + 2.65, 11.55, Math.PI));
  // Grand ceremonial staircase (Cầu Thang Danh Dự) in East Lobby
  for (let st = 0; st < 8; st++) {
    whiteParts.push(makeBox(4.2, 0.28, 0.55, 18.5, mainY + 0.14 + st * 0.28, -4.0 + st * 0.55));
    masterParts.push(makeReliefBox(2.2, 0.04, 0.56, 'palaceCrimsonBrocade', 18.5, mainY + 0.30 + st * 0.28, -4.0 + st * 0.55));
  }
  // [059][060] Rear Palace Garden Courtyard (*Sân Sau*) & Oil-Palm (*Cây Dầu*) Avenue
  masterParts.push(makeReliefBox(42.0, 0.18, 18.0, 'palacePrecastStone', 0, 0.09, 32.0));
  for (const bx of [-14, -7, 7, 14]) {
    addTopiaryUrn(masterParts, foliageParts, bx, 0.18, 36.0, 0.85, 3100 + bx);
  }
  // Phase 1 Fix: Relocate rear park trees cleanly outside Palace rear roof overhang, pergola & reflection pool!
  for (const sx of [-1, 1]) {
    for (const pz of [34, 48]) {
      addSaigonParkTree(woodParts, foliageParts, sx * 38, 0, pz, 18, 6.2, 3150 + sx * 10 + pz);
    }
  }

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
    [-52, 32, 21, 8.2, 2907],
    [0, 56, 22, 8.5, 2908],
    [52, 32, 21, 8.2, 2909]
  ]) {
    addSaigonParkTree(woodParts, foliageParts, tx, 0, tz, th, tr, sd);
  }

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (241–260) — Low-Poly, castShadow=false
  // ==========================================================================
  const w2Master: THREE.BufferGeometry[] = [];
  const w2White: THREE.BufferGeometry[] = [];
  const w2Gold: THREE.BufferGeometry[] = [];
  const w2Wood: THREE.BufferGeometry[] = [];
  const w2Dark: THREE.BufferGeometry[] = [];
  const w2Foliage: THREE.BufferGeometry[] = [];

  // [241] Historic F-5E Tiger II Jet Fighter Monument on Eastern Palace Lawn (38, -42)
  const jx = 38.0;
  const jz = -42.0;
  const jYaw = -0.45;
  const placeJet = (g: THREE.BufferGeometry, arr: THREE.BufferGeometry[]) => {
    g.rotateY(jYaw);
    g.translate(jx, 0.08, jz);
    arr.push(g);
  };
  placeJet(makeReliefBox(5.2, 0.42, 9.4, 'palacePrecastStone', 0, 0.21, 0), w2Master);
  placeJet(makeReliefBox(1.1, 1.35, 1.8, 'palacePrecastStone', 0, 1.05, 0), w2Master);
  // Fuselage, nose cone, swept wings, tail fin, twin exhaust & cockpit canopy
  placeJet(remapRelief(makeCyl(0.55, 0.62, 8.6, 6, 0, 2.35, 0, Math.PI * 0.5), 'militaryCamoArmor'), w2Master);
  placeJet(remapRelief(new THREE.ConeGeometry(0.55, 2.4, 6).rotateX(-Math.PI * 0.5).translate(0, 2.35, -5.5), 'militaryCamoArmor'), w2Master);
  placeJet(makeReliefBox(6.8, 0.14, 2.2, 'militaryCamoArmor', 0, 2.28, 0.4), w2Master);
  placeJet(makeReliefBox(2.8, 0.12, 1.1, 'militaryCamoArmor', 0, 2.35, 3.6), w2Master);
  placeJet(makeReliefBox(0.16, 1.75, 1.5, 'militaryCamoArmor', 0, 3.15, 3.4, 0, -0.25), w2Master);
  placeJet(makeBox(0.68, 0.45, 2.1, 0, 2.82, -2.1), w2Dark);

  // [242][243] Basement Command Bunker exterior concrete stairwell entrance, blast-door hood & cut-away tactical map/radio exhibit bay (Phase 1 Fix: placed cleanly outside West retaining base!)
  const bnkX = -43.2;
  const bnkZ = 16.0;
  w2Master.push(
    makeReliefBox(6.4, 2.6, 5.2, 'palaceRusticatedBase', bnkX, 1.3, bnkZ),
    makeReliefBox(6.8, 0.36, 5.6, 'palacePrecastStone', bnkX, 2.75, bnkZ),
    makeReliefBox(2.4, 2.2, 2.4, 'palacePrecastStone', bnkX - 4.2, 1.1, bnkZ)
  );
  w2Dark.push(
    makeBox(1.6, 1.9, 0.22, bnkX - 5.42, 1.0, bnkZ), // blast door
    makeBox(3.8, 1.8, 0.25, bnkX, 1.4, bnkZ + 2.55) // cut-away window opening
  );
  w2Wood.push(
    makeBox(2.8, 0.78, 1.1, bnkX, 0.42, bnkZ + 1.2), // radio console desk
    makeBox(1.6, 0.95, 0.12, bnkX, 1.55, bnkZ + 0.4) // tactical map board
  );
  w2Gold.push(makeBox(0.45, 0.32, 0.35, bnkX - 0.8, 0.96, bnkZ + 1.2));

  // [244] Ceremonial Twin Flagstaffs & Granite Plinths flanking Cổng Chính front driveway
  for (const sx of [-10.5, 10.5]) {
    w2Master.push(makeReliefBox(1.4, 0.75, 1.4, 'palacePrecastStone', sx, 0.38, -92.5));
    w2White.push(makeCyl(0.06, 0.10, 10.2, 6, sx, 5.8, -92.5));
    w2Gold.push(new THREE.ConeGeometry(0.16, 0.35, 5).translate(sx, 11.05, -92.5));
  }
  // [245] April 30, 1975 Bronze Commemorative Plaque Pedestal between Tanks 843 & 390
  w2Master.push(makeReliefBox(2.2, 1.15, 0.65, 'palacePrecastStone', 0, 0.58, -36.5));
  w2Gold.push(makeBox(1.85, 0.72, 0.08, 0, 0.72, -36.86));

  // [246] Press & Visitor Information Pavilion (Quầy Vé / Nhà Trưng Bày) inside eastern park gate (Phase 1 Fix: shifted east to x = 36.5 clear of red-brick walkway!)
  w2Master.push(
    makeReliefBox(6.8, 3.1, 4.4, 'palacePrecastStone', 36.5, 1.55, -88.0),
    makeReliefBox(8.2, 0.34, 5.6, 'palacePrecastStone', 36.5, 3.25, -88.0)
  );
  w2Dark.push(makeBox(5.2, 1.5, 0.18, 36.5, 1.65, -90.22));

  // [247] Presidential Cabinet Meeting Room oval conference table with grounded pedestals & chairs in East State Wing
  w2Wood.push(
    makeBox(3.2, 0.14, 9.6, 18.5, mainY + 0.84, 5.5),
    makeBox(1.6, 0.78, 1.0, 18.5, mainY + 0.39, 2.5),
    makeBox(1.6, 0.78, 1.0, 18.5, mainY + 0.39, 8.5)
  );
  for (let ch = 0; ch < 5; ch++) {
    for (const side of [-1, 1]) {
      w2Wood.push(makeBox(0.52, 0.82, 0.52, 18.5 + side * 2.0, mainY + 0.42, 1.5 + ch * 2.0));
    }
  }
  // [248] Rooftop Tứ Phương Vô Sự corner ceramic planters & low stone benches
  for (const sx of [-15.5, 15.5]) {
    w2Master.push(makeReliefBox(1.2, 0.75, 1.2, 'palacePrecastStone', sx, topDeckY + 0.38, -11.5));
    w2White.push(makeBox(2.4, 0.45, 0.65, sx, topDeckY + 0.24, -6.5));
  }
  // [249] Rooftop helipad twin red bomb-impact commemorative markers (April 8, 1975)
  for (const [bx, bz] of [[-4.5, 9.5], [3.5, 12.0]]) {
    w2Master.push(remapRelief(makeCyl(0.95, 0.95, 0.05, 6, bx, topDeckY + 0.06, bz), 'palaceCrimsonBrocade'));
  }
  // [250] Porte-cochère recessed coffered ceiling beams & twin bronze ceremonial lanterns with suspension rods
  for (const sx of [-4.2, 4.2]) {
    w2Master.push(makeReliefBox(0.42, 0.36, 7.2, 'palacePrecastStone', sx, mainY + 4.62, -23.0));
    w2Gold.push(
      makeCyl(0.03, 0.03, 1.25, 5, sx * 1.1, mainY + 4.12, -19.6),
      makeCyl(0.22, 0.22, 0.72, 6, sx * 1.1, mainY + 3.2, -19.6)
    );
  }
  // [251] Front elliptical driveway granite curb islands & directional stone bollards
  for (const sx of [-1, 1]) {
    w2Master.push(makeReliefBox(1.4, 0.24, 6.2, 'palacePrecastStone', sx * 8.2, 0.14, -76.0));
    for (let b = 0; b < 3; b++) {
      w2Master.push(remapRelief(makeCyl(0.14, 0.16, 0.75, 6, sx * 8.2, 0.42, -78.0 + b * 2.0), 'palacePrecastStone'));
    }
  }
  // [252] Manicured ornamental Lotus & Carp Pond (Hồ Bán Nguyệt) in West palace garden
  w2Master.push(remapRelief(makeCyl(5.4, 5.6, 0.42, 8, -38.0, 0.22, -62.0), 'palacePrecastStone'));
  for (let lp = 0; lp < 5; lp++) {
    const la = (lp / 5) * Math.PI * 2;
    w2Foliage.push(colorizeGeo(new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI * 0.5).translate(-38.0 + Math.cos(la) * 2.6, 0.46, -62.0 + Math.sin(la) * 2.6), '#2f7c2e'));
  }
  // [253] Classic 1960s Presidential Mercedes-Benz 200 W110 display near West portico
  const mx = -28.0;
  const mz = -25.0;
  w2Master.push(makeReliefBox(2.6, 0.26, 5.2, 'palacePrecastStone', mx, 0.14, mz));
  w2Dark.push(
    makeBox(1.85, 0.65, 4.4, mx, 0.78, mz),
    makeBox(1.62, 0.58, 2.2, mx, 1.35, mz + 0.15)
  );
  w2White.push(makeBox(1.88, 0.12, 0.14, mx, 0.58, mz - 2.22));
  // [254] Rear palace tennis court perimeter fence posts connected with horizontal rails & modernist shade pergola
  for (const sx of [-18.0, -6.0]) {
    for (const sz of [38.0, 48.0]) {
      w2Dark.push(makeCyl(0.05, 0.05, 3.2, 5, sx, 1.6, sz));
    }
    w2Dark.push(
      makeBox(0.06, 0.06, 10.0, sx, 3.15, 43.0),
      makeBox(0.06, 0.06, 10.0, sx, 1.60, 43.0)
    );
  }
  for (const sz of [38.0, 48.0]) {
    w2Dark.push(
      makeBox(12.0, 0.06, 0.06, -12.0, 3.15, sz),
      makeBox(12.0, 0.06, 0.06, -12.0, 1.60, sz)
    );
  }
  w2Master.push(makeReliefBox(6.2, 0.24, 3.2, 'palacePrecastStone', 16.0, 3.1, 42.0));
  for (const px of [13.4, 18.6]) {
    w2Master.push(makeReliefBox(0.32, 3.0, 0.32, 'palacePrecastStone', px, 1.5, 42.0));
  }
  // [255] Side-wing vertical louvered concrete sun-breaker fins along East & West elevations
  for (const sx of [-1, 1]) {
    for (let fz = -12; fz <= 16; fz += 4.0) {
      w2Master.push(makeReliefBox(0.45, 8.8, 0.22, 'palacePrecastStone', sx * 37.8, mainY + 10.0, fz));
    }
  }
  // [256][257] Carved Sơn Mài lacquer folding screen & grand lobby marble podium + stanchions
  w2Master.push(
    makeReliefBox(3.6, 2.2, 0.16, 'palaceSonMaiLacquer', 0, mainY + 1.1, -6.5),
    makeReliefBox(1.2, 1.05, 0.85, 'palacePrecastStone', 14.5, mainY + 0.52, -6.5)
  );
  for (const sx of [16.5, 20.5]) {
    w2Gold.push(makeCyl(0.04, 0.08, 0.95, 5, sx, mainY + 0.48, -5.2));
  }
  // [258] Park perimeter tall royal-palm accents framing twin modernist guardhouses (Phase 1 Fix: shifted to ±28.5m clear of guardhouse eaves!)
  for (const sx of [-28.5, 28.5]) {
    w2Wood.push(makeCyl(0.16, 0.24, 8.5, 6, sx, 4.25, -95.2));
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2;
      w2Foliage.push(colorizeGeo(new THREE.PlaneGeometry(1.1, 3.2).rotateX(1.0).rotateY(a).translate(sx + Math.sin(a) * 1.1, 8.5, -95.2 + Math.cos(a) * 1.1), '#2b742a'));
    }
  }
  // [259] Garden drinking-fountain & heritage Saigon directional map lectern
  w2Master.push(
    makeReliefBox(0.75, 0.95, 0.75, 'palacePrecastStone', -24.5, 0.48, -68.0),
    makeReliefBox(1.1, 1.15, 0.45, 'palacePrecastStone', 24.5, 0.58, -68.0)
  );
  w2Gold.push(makeBox(0.95, 0.65, 0.06, 24.5, 1.25, -68.0, 0, -0.45));
  // [260] Roof parapet lightning-arrestor masts & drainage scuppers
  for (const sx of [-38.0, 38.0]) {
    for (const sz of [-20.0, 22.0]) {
      w2Dark.push(makeCyl(0.03, 0.05, 3.4, 5, sx, topDeckY + 1.7, sz));
    }
  }

  // ==========================================================================
  // WAVE 3 REAL-WORLD VISUAL QC UPGRADES (521–580) — Low-Poly, castShadow=false
  // ==========================================================================
  const w3Master: THREE.BufferGeometry[] = [];
  const w3White: THREE.BufferGeometry[] = [];
  const w3Gold: THREE.BufferGeometry[] = [];
  const w3Wood: THREE.BufferGeometry[] = [];
  const w3Dark: THREE.BufferGeometry[] = [];
  const w3Foliage: THREE.BufferGeometry[] = [];

  // [521][522] Ceremonial Hall (Phòng Khánh Tiết) continuous crimson velvet carpet runner & brass stanchion corridor
  w3Master.push(makeReliefBox(3.4, 0.06, 22.0, 'palaceCrimsonBrocade', 0, mainY + 0.05, -14.0));
  for (const sx of [-2.1, 2.1]) {
    for (let sz = -22.0; sz <= -6.0; sz += 4.0) {
      w3Gold.push(makeCyl(0.035, 0.07, 0.92, 5, sx, mainY + 0.46, sz));
    }
    w3Master.push(makeReliefBox(0.05, 0.05, 16.0, 'palaceCrimsonBrocade', sx, mainY + 0.82, -14.0));
  }
  // [523][524][525] 40-Panel Bình Ngô Đại Cáo Lacquer Mural, 8 gilded wall torches & Credentials Hall reception set
  w3Master.push(makeReliefBox(14.8, 4.6, 0.18, 'palaceSonMaiLacquer', 0, mainY + 3.4, 15.6));
  w3Gold.push(
    makeBox(15.2, 0.16, 0.24, 0, mainY + 5.75, 15.6),
    makeBox(15.2, 0.16, 0.24, 0, mainY + 1.05, 15.6)
  );
  for (let t = -3.5; t <= 3.5; t += 1.0) {
    w3Gold.push(
      makeCyl(0.06, 0.04, 0.85, 5, t * 2.1, mainY + 3.4, 15.35),
      new THREE.ConeGeometry(0.12, 0.24, 5).translate(t * 2.1, mainY + 3.92, 15.35)
    );
  }
  w3Wood.push(
    makeBox(1.1, 0.92, 0.95, 0, mainY + 0.46, 11.8), // presidential chair
    makeBox(1.8, 0.48, 0.95, 0, mainY + 0.24, 10.2) // diplomatic coffee table
  );
  // [526][527][528][529] Banquet Hall extensions/ceiling light grid & Cabinet Room green-felt inlay + mics + teak slats
  w3White.push(makeBox(2.4, 0.12, 7.6, -18.5, mainY + 0.86, 5.5));
  w3Wood.push(makeBox(1.2, 0.80, 1.2, -18.5, mainY + 0.40, 2.5), makeBox(1.2, 0.80, 1.2, -18.5, mainY + 0.40, 8.5));
  w3Gold.push(makeBox(0.55, 0.35, 0.55, -18.5, mainY + 1.08, 5.5));
  w3Master.push(makeReliefBox(2.4, 0.04, 8.8, 'saigonParkLawn', 18.5, mainY + 0.93, 5.5));
  for (let m = 0; m < 4; m++) {
    w3Gold.push(makeCyl(0.03, 0.05, 0.26, 5, 17.8, mainY + 1.06, 2.5 + m * 2.0));
  }
  // [530][531][532][533][534][535][536] Presidential Office, Grand Staircase curbs/urn, 2nd-floor gallery benches, Reception lounge & Cinema/Game rooms
  w3Wood.push(
    makeBox(2.8, 0.78, 1.2, -19.0, mainY + 0.39, -6.5), // Presidential desk
    makeBox(3.6, 2.4, 0.42, -22.2, mainY + 1.2, -6.5), // bookcase wall
    makeBox(2.4, 0.48, 0.72, -10.5, mainY + 5.24, -15.5), // 2nd-floor gallery bench W
    makeBox(2.4, 0.48, 0.72, 10.5, mainY + 5.24, -15.5) // 2nd-floor gallery bench E
  );
  w3Master.push(
    makeReliefBox(0.32, 0.45, 7.2, 'palacePrecastStone', -2.6, mainY + 2.2, -2.5, 0, -0.42),
    makeReliefBox(0.32, 0.45, 7.2, 'palacePrecastStone', 2.6, mainY + 2.2, -2.5, 0, -0.42),
    makeReliefBox(4.8, 2.6, 0.16, 'palacePrecastStone', 0, mainY + 10.4, 18.5) // Cinema screen frame
  );
  // [537][538][539][540][541][542][543][544] Basement Bunker tactical table/radio racks/hazard strip, Kitchen hoist, Central Atrium planter & lobby gong
  w3Wood.push(makeBox(2.4, 0.76, 1.4, bnkX + 2.6, 0.38, bnkZ + 1.0)); // tactical ops table
  w3Dark.push(
    makeBox(0.85, 1.9, 0.65, bnkX - 3.2, 0.95, bnkZ + 0.6), // cipher radio rack
    makeBox(0.32, 0.32, 0.18, bnkX - 5.55, 1.05, bnkZ) // blast-door wheel lock
  );
  w3Gold.push(makeBox(1.8, 0.08, 0.28, bnkX - 5.42, 0.06, bnkZ)); // threshold strip
  w3Master.push(makeReliefBox(4.4, 0.65, 4.4, 'palacePrecastStone', 0, mainY + 0.32, 2.5)); // indoor atrium planter
  w3Foliage.push(colorizeGeo(new THREE.ConeGeometry(1.4, 2.2, 5).translate(0, mainY + 1.65, 2.5), '#2b742a'));
  w3Gold.push(makeCyl(0.45, 0.45, 0.08, 6, -5.8, mainY + 1.35, -6.5, Math.PI * 0.5)); // lobby bronze gong

  // [545][546][547][548][549][550] Rooftop Tứ Phương Vô Sự curved bar counter, terrace tables, helipad safety markings, Huey stanchions & rooftop flagpole
  w3Wood.push(
    makeBox(4.8, 1.05, 0.95, 0, topDeckY + 0.52, -7.2), // rooftop bar counter
    makeBox(1.4, 0.76, 1.4, -8.5, topDeckY + 0.38, -9.5), // terrace table W
    makeBox(1.4, 0.76, 1.4, 8.5, topDeckY + 0.38, -9.5) // terrace table E
  );
  w3Gold.push(
    makeBox(4.8, 0.08, 0.08, 0, topDeckY + 0.18, -7.78), // bar foot-rail
    // Rooftop flagpole behind Tứ Phương Vô Sự cornice (grounded to topDeckY - 0.15)
    makeCyl(0.05, 0.08, 7.6, 5, 0, topDeckY + 3.65, -2.5),
    new THREE.ConeGeometry(0.14, 0.32, 5).translate(0, topDeckY + 7.55, -2.5)
  );
  for (const sx of [-9.5, 9.5]) {
    w3White.push(makeBox(1.2, 0.06, 0.24, sx, topDeckY + 0.04, 8.5)); // helipad safety dashes
    w3Gold.push(makeCyl(0.035, 0.06, 0.85, 5, sx * 0.65, topDeckY + 0.42, 4.5)); // Huey visitor stanchions
  }
  // [551][552][553][554][555][556][557][558][559][560] Brise-soleil drip-rails, colonnade uplights, porte-cochère curbs, rear louvers, F-5E plaque & Mercedes stanchions
  w3Master.push(
    makeReliefBox(48.0, 0.22, 0.55, 'palacePrecastStone', 0, mainY + 13.85, -18.2),
    makeReliefBox(48.0, 0.22, 0.55, 'palacePrecastStone', 0, mainY + 5.15, -18.2),
    makeReliefBox(0.38, 0.26, 7.2, 'palacePrecastStone', -7.2, mainY + 0.14, -23.0),
    makeReliefBox(0.38, 0.26, 7.2, 'palacePrecastStone', 7.2, mainY + 0.14, -23.0),
    // Rear terrace cantilevered louver canopy with 4 grounded support columns
    makeReliefBox(24.0, 0.24, 3.6, 'palacePrecastStone', 0, mainY + 4.2, 22.8)
  );
  for (const rcx of [-10.5, -3.5, 3.5, 10.5]) {
    w3Master.push(makeReliefBox(0.32, 4.35, 0.32, 'palacePrecastStone', rcx, mainY + 2.02, 24.2));
  }
  w3Gold.push(
    makeBox(26.0, 0.12, 0.12, 0, mainY + 5.85, -18.5), // front balcony brass rail
    makeBox(1.2, 0.65, 0.08, 36.0, 1.05, -48.5, 0, -0.35), // F-5E historical plaque
    makeCyl(0.035, 0.06, 0.85, 5, mx - 1.8, 0.42, mz - 2.6), // Mercedes stanchions
    makeCyl(0.035, 0.06, 0.85, 5, mx + 1.8, 0.42, mz - 2.6)
  );

  // [561][562][563][564][565][566][567][568] Front Fountain corner spouts, Guardbox boom-gates, Main Gate crests, Tank barriers/beams & Ticket Kiosk queue
  for (const sx of [-8.8, 8.8]) {
    for (const sz of [-3.6, 3.6]) {
      w3Master.push(makeReliefBox(0.95, 0.85, 0.95, 'palacePrecastStone', sx, 0.42, lawnCenterZ + sz));
      w3White.push(makeCyl(0.08, 0.14, 1.15, 5, sx, 1.25, lawnCenterZ + sz));
    }
  }
  for (const sx of [-1, 1]) {
    // Boom-gate barrier arms at twin guardboxes
    w3White.push(makeBox(4.2, 0.10, 0.10, sx * 17.5, 1.15, -94.8));
    w3Master.push(makeReliefBox(1.2, 0.12, 0.12, 'palaceCrimsonBrocade', sx * 17.5, 1.16, -94.8));
    // Main gate bronze crest medallions
    w3Gold.push(makeCyl(0.45, 0.45, 0.08, 6, sx * 3.8, 1.65, -97.45, Math.PI * 0.5));
    // Side-gate turnstiles
    w3Dark.push(makeBox(1.8, 1.05, 0.45, sx * 24.5, 0.52, -97.5));
    // Tank 843 & 390 perimeter low brass-chain barriers & rear unditching logs
    w3Gold.push(makeBox(6.8, 0.06, 0.06, sx * 26.5, 0.65, -45.5));
    w3Wood.push(makeCyl(0.14, 0.14, 2.8, 5, sx * 26.5, 1.45, -40.2, 0, Math.PI * 0.5));
  }
  // [569][570][571][572][573][574][575][576][577][578][579][580] Flowerbeds, Hồ Bán Nguyệt bridge, East Park café kiosk, Rear pool, Tennis net, Photo boards, Stone lanterns & Floodlight masts
  // Hồ Bán Nguyệt arched stone footbridge (West garden — grounded on twin stone abutment piers)
  w3Master.push(
    makeReliefBox(2.2, 0.24, 9.6, 'palacePrecastStone', -38.0, 0.68, -62.0),
    makeReliefBox(2.2, 0.85, 0.65, 'palacePrecastStone', -38.0, 0.28, -66.5),
    makeReliefBox(2.2, 0.85, 0.65, 'palacePrecastStone', -38.0, 0.28, -57.5)
  );
  for (const sx of [-1.05, 1.05]) {
    w3Master.push(makeReliefBox(0.14, 0.72, 9.6, 'palacePrecastStone', -38.0 + sx, 1.05, -62.0));
  }
  // East Park shaded colonial café kiosk (Quán Cà Phê Công Viên) with grounded posts
  const pkX = 38.0;
  const pkZ = -62.0;
  w3Master.push(makeReliefBox(5.6, 0.24, 4.4, 'palacePrecastStone', pkX, 0.12, pkZ));
  for (const ox of [-2.4, 2.4]) {
    for (const oz of [-1.8, 1.8]) {
      w3Dark.push(makeCyl(0.07, 0.08, 3.1, 5, pkX + ox, 1.48, pkZ + oz));
    }
  }
  w3White.push(makeBox(6.2, 0.22, 5.0, pkX, 3.05, pkZ));
  w3Wood.push(makeBox(2.8, 0.92, 0.85, pkX, 0.58, pkZ));
  // Rear Courtyard reflection pool & Tennis Court net + umpire chair
  w3Master.push(makeReliefBox(14.0, 0.36, 5.4, 'palacePrecastStone', 0, 0.18, 36.5));
  w3White.push(makeBox(11.6, 0.95, 0.06, -12.0, 0.48, 43.0)); // tennis net
  w3Wood.push(makeBox(0.65, 1.65, 0.65, -5.2, 0.82, 43.0)); // umpire chair
  // Historical photo-exhibition boards along East lawn walkway & Floodlight masts
  for (const ez of [-76.0, -68.0, -60.0]) {
    w3Master.push(makeReliefBox(0.18, 1.65, 2.4, 'palacePrecastStone', 25.5, 1.05, ez));
    w3Gold.push(makeBox(0.22, 1.15, 1.9, 25.5, 1.15, ez));
  }
  for (const sx of [-36.0, 36.0]) {
    w3Dark.push(makeCyl(0.08, 0.12, 8.8, 5, sx, 4.25, -36.0));
    w3White.push(makeBox(0.85, 0.45, 0.28, sx, 8.65, -36.0));
    // Rear garden granite stone lanterns & boxwood hedges
    w3Master.push(makeReliefBox(0.65, 1.65, 0.65, 'palacePrecastStone', sx * 0.45, 0.82, 32.0));
    w3Foliage.push(colorizeGeo(new THREE.BoxGeometry(10.0, 0.72, 0.95).translate(sx * 0.45, 0.36, -27.5), '#256424'));
  }
  // Flagpole courtyard bench ring
  for (const sx of [-10.5, 10.5]) {
    w3Wood.push(makeBox(2.6, 0.46, 0.55, sx, 0.24, -89.5));
  }

  // ==========================================================================
  // WAVE 4 REAL-WORLD VISUAL QC UPGRADES (921–980) — Low-Poly, castShadow=false
  // ==========================================================================
  const w4Master: THREE.BufferGeometry[] = [];
  const w4White: THREE.BufferGeometry[] = [];
  const w4Gold: THREE.BufferGeometry[] = [];
  const w4Wood: THREE.BufferGeometry[] = [];
  const w4Dark: THREE.BufferGeometry[] = [];
  const w4Foliage: THREE.BufferGeometry[] = [];

  // [921–924] 1975 Historical Exhibition Gallery Pavilion (Nhà Trưng Bày 30/4) on East lawn (48, -68)
  const exX = 48.0;
  const exZ = -68.0;
  w4Master.push(
    makeReliefBox(10.4, 0.36, 14.0, 'palacePrecastStone', exX, 0.18, exZ),
    makeReliefBox(8.6, 3.8, 12.2, 'palacePrecastStone', exX, 2.26, exZ),
    makeReliefBox(10.8, 0.38, 14.4, 'palacePrecastStone', exX, 4.30, exZ), // cantilevered modernist roof slab flush on wall top
    makeReliefBox(1.8, 2.2, 0.48, 'palacePrecastStone', exX - 6.8, 1.1, exZ) // April 30 bronze monument stele
  );
  w4Dark.push(makeBox(0.18, 2.6, 9.6, exX - 4.35, 2.2, exZ));
  w4Gold.push(makeBox(1.4, 1.1, 0.52, exX - 6.8, 1.35, exZ));
  // [925–936] Outer 30/4 Park Boulevard Canopies, Double-Globe Lamps, Promenade, Flag Podium, Tank Lecterns & Vintage 1975 Jeep Display
  for (const sx of [-34.0, 34.0]) {
    w4Master.push(makeReliefBox(7.2, 0.24, 3.6, 'palacePrecastStone', sx, 3.1, -103.0));
    for (const ox of [-3.2, 3.2]) {
      for (const oz of [-1.4, 1.4]) {
        w4Dark.push(makeCyl(0.06, 0.08, 3.25, 5, sx + ox, 1.50, -103.0 + oz));
      }
    }
  }
  w4Master.push(
    makeReliefBox(96.0, 0.12, 3.2, 'palaceCrimsonBrocade', 0, 0.06, -101.2), // outer 30/4 Park red-brick promenade
    makeReliefBox(4.8, 0.42, 3.2, 'palacePrecastStone', 0, 0.21, -91.0) // ceremonial flag-raising podium
  );
  for (let lb = -2; lb <= 2; lb++) {
    const lx = lb * 16.0;
    w4Dark.push(makeCyl(0.06, 0.09, 4.2, 5, lx, 2.0, -102.5), makeBox(1.1, 0.08, 0.08, lx, 4.05, -102.5));
    w4White.push(makeBox(0.24, 0.26, 0.24, lx - 0.52, 4.25, -102.5), makeBox(0.24, 0.26, 0.24, lx + 0.52, 4.25, -102.5));
  }
  // Vintage 1975 Military Jeep display (-40, -42) + Tank 843/390 granite lecterns & drinking fountains
  w4Master.push(makeReliefBox(2.8, 0.28, 4.6, 'palacePrecastStone', -40.0, 0.14, -42.0));
  w4Dark.push(makeBox(1.75, 0.72, 3.6, -40.0, 0.78, -42.0), makeBox(1.65, 0.65, 0.12, -40.0, 1.42, -43.0));
  for (const sx of [-1, 1]) {
    w4Master.push(makeReliefBox(1.1, 1.05, 0.42, 'palacePrecastStone', sx * 25.0, 0.52, -42.5));
    w4Gold.push(makeBox(0.88, 0.58, 0.08, sx * 25.0, 1.12, -42.5, 0, -0.35));
    w4White.push(makeCyl(0.32, 0.22, 0.95, 6, sx * 31.0, 0.48, -52.0));
  }
  // [941–960] Rear Diplomatic Guest Tea Pavilion (-32, 46), Botanical Orchid Greenhouse (30, 46), Pool Bridge, Tennis Lights, Bunker Vents & East Motorcade Canopy
  // Diplomatic Guest Tea Pavilion (-32, 46)
  w4Master.push(
    makeReliefBox(8.2, 0.32, 6.8, 'palacePrecastStone', -32.0, 0.16, 46.0),
    makeReliefBox(8.8, 0.28, 7.4, 'palacePrecastStone', -32.0, 3.55, 46.0)
  );
  for (const ox of [-3.6, 3.6]) {
    for (const oz of [-2.9, 2.9]) {
      w4Master.push(makeReliefBox(0.32, 3.55, 0.32, 'palacePrecastStone', -32.0 + ox, 1.75, 46.0 + oz));
    }
  }
  w4Wood.push(makeBox(2.2, 0.72, 1.2, -32.0, 0.68, 46.0));
  // Palace Botanical Orchid Greenhouse (30, 46)
  w4Master.push(makeReliefBox(9.2, 0.95, 6.4, 'palacePrecastStone', 30.0, 0.48, 46.0));
  w4White.push(makeBox(8.8, 2.4, 6.0, 30.0, 2.15, 46.0));
  const ghRoof = createGableRoofGeometry(9.4, 6.6, 1.65, 0.14, 'x');
  ghRoof.translate(30.0, 3.35, 46.0);
  w4White.push(ghRoof);
  // Connecting rear promenade, reflection pool bridge, tennis pergola & bunker vents/hatch
  w4Master.push(
    makeReliefBox(54.0, 0.12, 2.4, 'palaceCrimsonBrocade', 0, 0.06, 44.5),
    makeReliefBox(2.6, 0.22, 6.2, 'palacePrecastStone', 0, 0.48, 36.5),
    makeReliefBox(5.6, 0.24, 3.2, 'palacePrecastStone', -20.0, 2.85, 43.0),
    makeReliefBox(1.8, 1.15, 1.8, 'palaceRusticatedBase', bnkX + 2.5, 0.58, bnkZ + 4.5), // bunker escape hatch
    // East-wing diplomatic motorcade canopy (44, 4)
    makeReliefBox(6.2, 0.28, 9.6, 'palacePrecastStone', 44.0, 4.1, 4.0)
  );
  for (const oz of [-4.2, 4.2]) {
    w4Master.push(makeReliefBox(0.36, 4.25, 0.36, 'palacePrecastStone', 46.6, 1.98, 4.0 + oz));
  }
  w4Dark.push(
    makeCyl(0.18, 0.22, 1.65, 6, bnkX - 2.0, 0.82, bnkZ + 4.5), // bunker periscope vent
    makeCyl(0.06, 0.08, 2.95, 5, -22.2, 1.38, 43.0),
    makeCyl(0.06, 0.08, 2.95, 5, -17.8, 1.38, 43.0)
  );
  // [961–980] Rooftop Helipad Wind-Sock & Beacons, Khánh Tiết Lectern, State-Room Credenzas, Banquet Sideboards, Cabinet Map & Cinema Seating
  w4Dark.push(makeCyl(0.04, 0.06, 3.6, 5, -24.0, topDeckY + 1.65, 14.0));
  w4Master.push(
    makeReliefBox(1.2, 0.36, 0.36, 'palaceCrimsonBrocade', -23.3, topDeckY + 3.25, 14.0), // wind-sock
    makeReliefBox(0.85, 1.15, 0.65, 'palaceSonMaiLacquer', 0, mainY + 7.95, -21.2) // balcony lectern
  );
  for (const sx of [-1, 1]) {
    w4Wood.push(
      makeBox(2.4, 0.95, 0.68, sx * 8.5, mainY + 0.48, 11.2), // State Room credenzas
      makeBox(0.68, 0.95, 3.8, -24.5, mainY + 0.48, sx * 3.8) // Banquet Hall wine sideboards
    );
    w4Gold.push(makeCyl(0.16, 0.16, 0.22, 5, -12.0 + sx * 6.5, topDeckY + 0.11, 11.5 + sx * 4.5)); // helipad beacons
  }
  w4Gold.push(makeBox(0.12, 1.85, 3.2, 24.5, mainY + 2.4, 5.5)); // Cabinet Room Vietnam relief map
  for (let cr = 0; cr < 3; cr++) {
    w4Master.push(makeReliefBox(4.4, 0.55, 0.65, 'palaceCrimsonBrocade', 0, mainY + 9.2 + cr * 0.28, 13.5 - cr * 1.4)); // Cinema seating
  }

  // ==========================================================================
  // WAVE 5 REAL-PHOTO VISUAL QC UPGRADES (1321–1380) — Low-Poly, castShadow=false
  // ==========================================================================
  const w5Master: THREE.BufferGeometry[] = [];
  const w5White: THREE.BufferGeometry[] = [];
  const w5Gold: THREE.BufferGeometry[] = [];
  const w5Wood: THREE.BufferGeometry[] = [];
  const w5Dark: THREE.BufferGeometry[] = [];
  const w5Foliage: THREE.BufferGeometry[] = [];

  // [1321–1340] West Lawn Historical Photo Gallery Pavilion (-48, -68), Reflection Basins, Ceremonial Review Stands, Rest Pergolas & Vintage Diplomatic Sedan
  const wxX = -48.0;
  const wxZ = -68.0;
  w5Master.push(
    makeReliefBox(10.4, 0.36, 14.0, 'palacePrecastStone', wxX, 0.18, wxZ),
    makeReliefBox(8.6, 3.8, 12.2, 'palacePrecastStone', wxX, 2.26, wxZ),
    makeReliefBox(10.8, 0.38, 14.4, 'palacePrecastStone', wxX, 4.30, wxZ),
    makeReliefBox(1.8, 2.2, 0.48, 'palacePrecastStone', wxX + 6.8, 1.1, wxZ) // chronicle stele
  );
  w5Dark.push(makeBox(0.18, 2.6, 9.6, wxX + 4.35, 2.2, wxZ));
  w5Gold.push(makeBox(1.4, 1.1, 0.52, wxX + 6.8, 1.35, wxZ));
  for (const sx of [-1, 1]) {
    // Twin shallow concrete water-lily reflection basins (±22, -64) + lotus urns
    w5White.push(
      makeBox(6.8, 0.36, 4.2, sx * 22.0, 0.18, -64.0),
      makeCyl(0.42, 0.28, 0.65, 6, sx * 25.0, 0.52, -64.0)
    );
    // Ceremonial state-review & press viewing stands (±22, -84) + state-seal reliefs
    w5Master.push(makeReliefBox(6.4, 0.85, 3.2, 'palacePrecastStone', sx * 22.0, 0.42, -84.0));
    w5Gold.push(makeBox(1.2, 0.62, 0.12, sx * 22.0, 0.52, -85.62));
    // Shaded concrete park rest-pergolas (±42, -82) + teak benches
    w5Master.push(makeReliefBox(7.2, 0.24, 3.6, 'palacePrecastStone', sx * 42.0, 3.05, -82.0));
    w5Wood.push(makeBox(3.4, 0.46, 0.58, sx * 42.0, 0.23, -82.0));
    for (const ox of [-3.2, 3.2]) {
      for (const oz of [-1.4, 1.4]) {
        w5Dark.push(makeCyl(0.06, 0.08, 3.2, 5, sx * 42.0 + ox, 1.45, -82.0 + oz));
      }
    }
    // Heritage bilingual architectural plaques (±14, -54) & Tứ Linh garden lanterns (±18, -68)
    w5Gold.push(makeBox(0.85, 0.55, 0.08, sx * 14.0, 1.05, -54.0, 0, -0.35));
    w5Master.push(
      makeReliefBox(0.65, 1.65, 0.65, 'palacePrecastStone', sx * 18.0, 0.82, -68.0),
      makeReliefBox(2.2, 0.52, 2.2, 'palacePrecastStone', sx * 46.0, 0.26, -52.0) // park water kiosk base
    );
    w5White.push(makeCyl(0.08, 1.25, 0.38, 6, sx * 46.0, 2.45, -52.0));
    w5Dark.push(makeCyl(0.04, 0.05, 2.5, 5, sx * 46.0, 1.15, -52.0));
  }
  // Vintage 1960s Black Diplomatic Sedan display on East lawn (40, -42)
  w5Master.push(makeReliefBox(2.8, 0.28, 5.2, 'palacePrecastStone', 40.0, 0.14, -42.0));
  w5Dark.push(makeBox(1.85, 0.72, 4.4, 40.0, 0.76, -42.0), makeBox(1.65, 0.58, 2.2, 40.0, 1.38, -42.0));
  // [1341–1360] Rear SE Diplomatic Briefing Pavilion (34, 34), Rear SW Tea-Arbor (-38, 34), Reflection Pool Terraces, Helipad GPU/Steps & Weather Mast
  w5Master.push(
    makeReliefBox(8.4, 0.32, 6.8, 'palacePrecastStone', 34.0, 0.16, 34.0),
    makeReliefBox(9.0, 0.28, 7.4, 'palacePrecastStone', 34.0, 3.55, 34.0),
    // Rear SW Tea-Arbor (-38, 34)
    makeReliefBox(7.2, 0.24, 5.2, 'palacePrecastStone', -38.0, 3.15, 34.0),
    // Rear central stone sundial plinth (0, 50)
    makeReliefBox(1.4, 1.15, 1.4, 'palacePrecastStone', 0, 0.58, 50.0)
  );
  for (const ox of [-3.6, 3.6]) {
    for (const oz of [-2.9, 2.9]) {
      w5Master.push(makeReliefBox(0.32, 3.55, 0.32, 'palacePrecastStone', 34.0 + ox, 1.75, 34.0 + oz));
    }
  }
  for (const ox of [-3.1, 3.1]) {
    for (const oz of [-2.1, 2.1]) {
      w5White.push(makeBox(0.28, 3.3, 0.28, -38.0 + ox, 1.50, 34.0 + oz));
    }
  }
  w5Wood.push(
    makeBox(3.2, 0.74, 1.4, 34.0, 0.68, 34.0), // briefing conference table
    makeBox(2.2, 0.46, 0.58, -38.0, 0.23, 34.0) // tea-arbor bench
  );
  for (const sx of [-1, 1]) {
    w5Master.push(makeReliefBox(4.2, 0.32, 5.4, 'palacePrecastStone', sx * 14.0, 0.16, 36.5)); // pool viewing terraces
    w5White.push(makeBox(2.2, 0.65, 0.65, sx * 10.0, topDeckY + 0.32, -15.0)); // rooftop planter boxes
    w5Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.45, 0.55, 5).translate(sx * 10.0, topDeckY + 0.88, -15.0), '#2d7a2d'));
    w5Wood.push(makeBox(1.4, 0.62, 1.4, sx * 6.5, topDeckY + 0.31, -11.5)); // rooftop tea tables
  }
  // Rooftop Helipad GPU cart (-18.5, 16.5), boarding steps (-15.5, 13.5), NE weather mast (22, 15) & corner lightning rods
  w5Gold.push(makeBox(1.1, 0.85, 1.6, -18.5, topDeckY + 0.48, 16.5));
  w5Dark.push(
    makeBox(1.0, 1.15, 1.8, -15.5, topDeckY + 0.58, 13.5),
    makeCyl(0.06, 0.10, 5.2, 5, 22.0, topDeckY + 2.5, 15.0)
  );
  // [1361–1380] Side-Wing Brise-Soleil Louvers, North Sun-Hoods, Lobby Urns, State-Room Screens, Presidential Bookcase & Bunker Blast Walls
  for (const sx of [-1, 1]) {
    for (let lv = 0; lv < 5; lv++) {
      w5White.push(makeBox(0.24, 5.8, 0.28, sx * 33.6, mainY + 4.8, -12.0 + lv * 3.0)); // side-wing bamboo brise-soleil
    }
    w5Master.push(makeReliefBox(3.4, 0.24, 5.2, 'palacePrecastStone', sx * 34.5, mainY + 3.2, 10.0)); // side stair rain-canopy
    w5Gold.push(
      makeCyl(0.36, 0.26, 0.95, 6, sx * 6.5, mainY + 0.52, -12.0), // Grand Lobby ceremonial urns
      makeBox(0.18, 2.4, 3.6, sx * 11.5, mainY + 1.2, 8.0), // State Room lacquer folding screens
      makeCyl(0.12, 0.16, 1.65, 6, -21.5, mainY + 0.82, sx * 6.5) // Banquet candelabra pedestals
    );
  }
  w5White.push(makeBox(38.0, 0.28, 1.1, 0, mainY + 7.4, 21.6)); // Rear North sun-hood eyebrow
  w5Master.push(
    makeReliefBox(3.6, 0.06, 18.0, 'palaceCrimsonBrocade', 0, mainY + 0.04, 2.0), // State Room crimson carpet
    makeReliefBox(2.2, 1.25, 0.42, 'palaceRusticatedBase', bnkX, 0.62, bnkZ - 1.5) // Bunker blast-baffle wall
  );
  w5Wood.push(
    makeBox(3.2, 1.05, 0.85, 0, mainY + 0.52, -14.5), // Grand Lobby reception counter
    makeBox(3.4, 2.4, 0.55, 12.5, mainY + 6.4, -11.5), // Presidential Office rosewood bookcase
    makeBox(2.2, 0.52, 1.1, -12.5, mainY + 5.46, -11.5), // Presidential Reception coffee table
    makeBox(1.8, 0.72, 1.8, 14.0, mainY + 9.56, 4.0), // 3rd-floor Card Room table
    makeBox(2.4, 0.95, 1.1, -14.0, mainY + 9.68, 4.0) // 3rd-floor Library map chest
  );
  w5Gold.push(makeBox(2.4, 0.65, 0.12, 0, 5.2, -97.6)); // Main Gatehouse 1966 crest

  // ==========================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADES (1721–1780) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w6Master: THREE.BufferGeometry[] = [];
  const w6White: THREE.BufferGeometry[] = [];
  const w6Gold: THREE.BufferGeometry[] = [];
  const w6Wood: THREE.BufferGeometry[] = [];
  const w6Dark: THREE.BufferGeometry[] = [];
  const w6Foliage: THREE.BufferGeometry[] = [];

  // [1721–1740] Outer 30/4 Park Welcome Kiosks (±54, -103), Front Lawn Pergolas (±32, -72), Banner Pylons & Diplomatic Plinths
  for (const sx of [-1, 1]) {
    // Outer 30/4 Park Modernist Welcome Kiosks (±54, -103)
    w6Master.push(
      makeReliefBox(6.4, 0.24, 3.4, 'palacePrecastStone', sx * 54.0, 3.05, -103.0),
      makeReliefBox(6.0, 0.24, 3.0, 'palacePrecastStone', sx * 54.0, 0.12, -103.0),
      // Front Lawn Lotus-Fountain Modernist Pergolas (±32, -72)
      makeReliefBox(6.8, 0.24, 3.4, 'palacePrecastStone', sx * 32.0, 3.05, -72.0),
      // Ceremonial Banner-Pylons (±16, -78) & Diplomatic Escort Display Plinths (±38, -34)
      makeReliefBox(0.95, 3.4, 0.95, 'palacePrecastStone', sx * 16.0, 1.70, -78.0),
      makeReliefBox(2.6, 0.26, 3.6, 'palacePrecastStone', sx * 38.0, 0.13, -34.0),
      // Main Gatehouse side-walkway rain-canopy extensions (±26, -97.5)
      makeReliefBox(4.8, 0.22, 2.6, 'palacePrecastStone', sx * 26.0, 3.15, -97.5)
    );
    w6Wood.push(
      makeBox(2.6, 0.85, 0.65, sx * 54.0, 0.55, -103.0),
      makeBox(3.2, 0.46, 0.58, sx * 32.0, 0.23, -72.0),
      makeBox(2.6, 0.46, 0.58, sx * 22.0, 0.23, -59.5) // reflection basin benches
    );
    for (const ox of [-2.8, 2.8]) {
      for (const oz of [-1.3, 1.3]) {
        w6Dark.push(
          makeCyl(0.06, 0.08, 3.2, 4, sx * 54.0 + ox, 1.45, -103.0 + oz),
          makeCyl(0.06, 0.08, 3.2, 4, sx * 32.0 + ox, 1.45, -72.0 + oz)
        );
      }
    }
    w6Gold.push(
      makeBox(0.68, 0.68, 0.12, sx * 16.0, 2.65, -78.52), // banner-pylon state medallion
      makeBox(0.95, 0.62, 0.08, sx * 22.0, 1.05, -101.0, 0, -0.35), // 30/4 Park map lectern
      makeBox(0.85, 0.55, 0.08, sx * 4.5, 0.85, -91.0, 0, -0.35) // flagpole laurel plaque
    );
    w6Dark.push(makeBox(1.4, 0.72, 2.4, sx * 38.0, 0.62, -34.0)); // escort display silhouette
    w6Foliage.push(colorizeGeo(new THREE.BoxGeometry(3.8, 0.62, 0.85).translate(sx * 28.0, 0.31, -100.5), '#256424'));
    w6White.push(makeCyl(0.18, 0.22, 0.95, 4, sx * 14.0, 0.48, -62.0)); // fountain bollard lights
  }
  // [1741–1760] Rear North-Central Ceremonial Tea-Deck (0, 56), Tennis Shelter (-26, 43), Orchid Pergola (38, 46) & Rooftop Helipad/Canopies
  w6Master.push(
    makeReliefBox(8.6, 0.32, 6.4, 'palacePrecastStone', 0, 0.16, 56.0),
    makeReliefBox(9.2, 0.28, 7.0, 'palacePrecastStone', 0, 3.55, 56.0),
    makeReliefBox(4.8, 0.22, 2.8, 'palacePrecastStone', -26.0, 2.85, 43.0), // tennis spectator shelter
    makeReliefBox(5.2, 0.20, 3.4, 'palacePrecastStone', 38.0, 2.85, 46.0), // orchid potting pergola
    makeReliefBox(1.8, 1.25, 1.4, 'palaceRusticatedBase', bnkX + 4.5, 0.62, bnkZ + 2.0), // bunker generator vent
    makeReliefBox(1.4, 0.95, 1.8, 'palaceCrimsonBrocade', -8.0, topDeckY + 0.48, 17.5) // rooftop fire foam cart
  );
  for (const ox of [-3.8, 3.8]) {
    for (const oz of [-2.7, 2.7]) {
      w6Master.push(makeReliefBox(0.32, 3.55, 0.32, 'palacePrecastStone', ox, 1.75, 56.0 + oz));
    }
  }
  w6Wood.push(
    makeBox(2.4, 0.72, 1.2, 0, 0.68, 56.0),
    makeBox(3.4, 0.46, 0.58, -26.0, 0.23, 43.0),
    makeBox(2.6, 0.82, 1.1, 38.0, 0.41, 46.0)
  );
  for (const ox of [-2.1, 2.1]) {
    w6Dark.push(
      makeCyl(0.06, 0.08, 3.0, 4, -26.0 + ox, 1.35, 43.0),
      makeCyl(0.06, 0.08, 3.0, 4, 38.0 + ox, 1.35, 46.0)
    );
  }
  for (const sx of [-1, 1]) {
    w6Master.push(makeReliefBox(0.68, 1.65, 0.68, 'palacePrecastStone', sx * 24.0, 0.82, 36.5)); // koi-pond lanterns
    w6White.push(
      makeBox(4.8, 0.22, 4.2, sx * 14.0, topDeckY + 2.8, -11.5), // rooftop cantilevered louver canopies
      makeBox(1.8, 0.85, 1.2, sx * 10.0, topDeckY + 0.42, 19.0) // rear roof HVAC boxes
    );
    w6Dark.push(
      makeCyl(0.06, 0.08, 2.95, 4, sx * 16.0, topDeckY + 1.35, -13.2),
      makeCyl(0.06, 0.08, 2.95, 4, sx * 16.0, topDeckY + 1.35, -9.8)
    );
    w6Gold.push(
      makeCyl(0.05, 0.08, 1.45, 4, sx * 8.0, topDeckY + 0.72, -15.8), // rooftop telescopes
      makeCyl(0.08, 0.10, 1.8, 4, sx * 24.0, topDeckY + 0.90, -17.0), // aviation beacons
      makeCyl(0.08, 0.10, 1.8, 4, sx * 24.0, topDeckY + 0.90, 17.0)
    );
  }
  // [1761–1780] Side-Wing Ground Sun-Screen Fins, 3rd-Floor Eyebrow Molding & State-Room Interior Details
  for (const sx of [-1, 1]) {
    for (let lv = 0; lv < 4; lv++) {
      w6White.push(makeBox(0.24, 3.6, 0.26, sx * 34.0, mainY + 1.8, -12.0 + lv * 5.0)); // ground sun-screen fins
    }
    w6Gold.push(makeCyl(0.05, 0.08, 2.4, 4, sx * 8.5, mainY + 1.2, -14.0)); // lobby flag stands
    w6Wood.push(
      makeBox(1.4, 0.65, 1.4, sx * 6.0, mainY + 0.32, 4.0), // State Room lacquer tea tables
      makeBox(2.2, 0.46, 0.62, sx * 18.0, mainY + 9.43, -8.0) // 3rd-floor lounge benches
    );
  }
  w6White.push(makeBox(48.0, 0.26, 0.85, 0, mainY + 11.2, -18.4)); // 3rd-floor south eyebrow molding
  w6Master.push(
    makeReliefBox(3.4, 0.06, 14.0, 'palaceCrimsonBrocade', 0, mainY + 5.24, -10.0), // Khánh Tiết crimson runner
    makeReliefBox(42.0, 0.24, 1.4, 'palacePrecastStone', 0, mainY + 0.14, 22.2) // Rear rainwater splash apron
  );
  w6Wood.push(
    makeBox(0.75, 0.95, 5.2, -18.0, mainY + 0.48, 0), // Banquet Hall buffet credenza
    makeBox(1.8, 1.45, 0.28, 20.0, mainY + 0.78, -5.5), // Cabinet Room tactical map easel
    makeBox(2.2, 0.76, 1.1, -14.0, mainY + 5.58, -4.0), // 2nd-floor Library reading table
    makeBox(2.2, 1.85, 0.55, 14.0, mainY + 6.12, -4.0), // Presidential Office lacquer cabinet
    makeBox(2.0, 1.25, 1.2, 0, mainY + 9.85, 16.5) // 3rd-floor Cinema projector console
  );
  w6Gold.push(makeBox(0.28, 0.22, 8.6, -20.0, mainY + 4.2, 0)); // Banquet linear chandelier beam

  // ==========================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADES (2121–2180) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w7Master: THREE.BufferGeometry[] = [];
  const w7White: THREE.BufferGeometry[] = [];
  const w7Gold: THREE.BufferGeometry[] = [];
  const w7Wood: THREE.BufferGeometry[] = [];
  const w7Dark: THREE.BufferGeometry[] = [];
  const w7Foliage: THREE.BufferGeometry[] = [];

  // [2121–2140] Outer 30/4 Park Far-West/East Reading Shelters (±66, -103), Lawn Planters, Guard Pillars & Turnstile Canopies
  for (const sx of [-1, 1]) {
    w7Master.push(
      makeReliefBox(6.2, 0.24, 3.4, 'palacePrecastStone', sx * 66.0, 3.05, -103.0),
      makeReliefBox(5.8, 0.24, 3.0, 'palacePrecastStone', sx * 66.0, 0.12, -103.0),
      makeReliefBox(2.8, 0.55, 2.8, 'palacePrecastStone', sx * 44.0, 0.28, -66.0), // Lawn water-lily planters
      makeReliefBox(0.95, 3.2, 0.95, 'palacePrecastStone', sx * 12.0, 1.60, -86.0), // Front driveway guard pillars
      makeReliefBox(4.4, 0.22, 2.4, 'palacePrecastStone', sx * 34.0, 3.10, -97.5) // Turnstile canopies
    );
    w7Wood.push(
      makeBox(3.0, 0.46, 0.58, sx * 66.0, 0.23, -103.0),
      makeBox(1.4, 1.35, 0.28, sx * 32.0, 0.72, -46.0), // Tank 843/390 photo easels
      makeBox(1.2, 1.45, 0.36, sx * 36.0, 0.72, -82.0) // Lawn orientation map kiosks
    );
    for (const ox of [-2.6, 2.6]) {
      for (const oz of [-1.3, 1.3]) {
        w7Dark.push(makeCyl(0.06, 0.08, 3.2, 4, sx * 66.0 + ox, 1.45, -103.0 + oz));
      }
    }
    w7Gold.push(
      makeCyl(0.06, 0.09, 4.2, 4, sx * 36.0, 2.0, -101.0), // 30/4 Park heritage lamps
      makeCyl(0.06, 0.09, 4.2, 4, sx * 60.0, 2.0, -101.0),
      makeBox(0.55, 0.55, 0.55, sx * 12.0, 3.45, -86.0) // Guard pillar gold finials
    );
    w7Foliage.push(
      colorizeGeo(new THREE.ConeGeometry(0.85, 0.65, 5).translate(sx * 44.0, 0.85, -66.0), '#287a2c'),
      colorizeGeo(new THREE.BoxGeometry(3.6, 0.60, 0.85).translate(sx * 50.0, 0.30, -100.5), '#256424')
    );
    w7White.push(makeCyl(0.16, 0.20, 0.85, 4, sx * 16.5, 0.42, -62.0));
  }
  w7Gold.push(
    makeBox(0.95, 0.62, 0.08, 38.0, 1.05, -32.0, 0, -0.35), // F-5E pilot lectern
    makeBox(0.65, 1.25, 0.32, 0, 0.62, -103.5) // 30/4 Park boulevard milestone
  );

  // [2141–2160] Rear Garden Bonsai/Orchid Pergolas (±46, 54), Reflection Pool Bridges, Windsock Tower & Rooftop Planters
  for (const sx of [-1, 1]) {
    w7Master.push(
      makeReliefBox(6.8, 0.28, 4.6, 'palacePrecastStone', sx * 46.0, 0.14, 54.0),
      makeReliefBox(7.2, 0.24, 5.0, 'palacePrecastStone', sx * 46.0, 3.15, 54.0),
      makeReliefBox(3.6, 0.22, 2.2, 'palacePrecastStone', sx * 12.0, 0.42, 36.5), // Reflection pool stepping bridges
      makeReliefBox(1.1, 2.8, 1.1, 'palacePrecastStone', sx * 8.0, 1.40, 60.0), // North perimeter gate piers
      makeReliefBox(0.65, 1.45, 0.65, 'palacePrecastStone', sx * 6.2, 0.72, 56.0) // Tea-deck lantern pedestals
    );
    for (const ox of [-3.0, 3.0]) {
      for (const oz of [-2.0, 2.0]) {
        w7Master.push(makeReliefBox(0.28, 3.15, 0.28, 'palacePrecastStone', sx * 46.0 + ox, 1.55, 54.0 + oz));
      }
    }
    w7Wood.push(
      makeBox(2.4, 0.72, 1.0, sx * 46.0, 0.62, 54.0),
      makeBox(2.4, 0.46, 0.58, sx * 44.0, 0.23, -4.0), // VIP motorcade benches
      makeBox(1.2, 0.72, 1.2, sx * 18.0, 0.36, 54.0) // Garden stone chess tables
    );
    w7White.push(makeBox(1.2, 0.65, 6.2, sx * 20.0, topDeckY + 0.32, 0)); // Rooftop planter troughs
    w7Foliage.push(colorizeGeo(new THREE.BoxGeometry(0.85, 0.45, 5.6).translate(sx * 20.0, topDeckY + 0.82, 0), '#287a2c'));
  }
  w7Master.push(makeReliefBox(1.6, 1.45, 1.4, 'palaceRusticatedBase', bnkX - 4.5, 0.72, bnkZ + 2.0)); // Bunker vent turret
  w7Dark.push(
    makeCyl(0.06, 0.09, 4.6, 4, 12.0, topDeckY + 2.2, 18.0), // Rooftop windsock mast
    makeCyl(0.04, 0.06, 4.2, 4, 16.0, topDeckY + 2.0, 19.0) // Telemetry whip antenna
  );
  w7Gold.push(
    makeBox(1.2, 0.35, 0.35, 12.6, topDeckY + 4.2, 18.0), // Windsock cone
    makeCyl(0.55, 0.62, 1.05, 5, 0, topDeckY + 0.52, -16.5) // Rooftop skyline dial
  );

  // [2161–2180] Front 2nd-Floor Brise-Soleil Fins, Rear Sun-Breakers & Interior Diplomatic Suite Furnishings
  for (const sx of [-1, 1]) {
    for (let fin = 0; fin < 3; fin++) {
      w7White.push(makeBox(0.24, 3.4, 0.32, sx * (24.0 + fin * 3.0), mainY + 6.8, -18.4));
    }
    w7White.push(makeBox(10.0, 0.24, 0.65, sx * 14.0, mainY + 11.0, 21.5)); // Rear terrace sun-breakers
    w7Gold.push(
      makeBox(0.26, 0.14, 5.2, sx * 4.5, mainY + 4.4, -22.0), // Porte-cochère light coffers
      makeBox(0.18, 2.2, 3.2, sx * 10.5, mainY + 1.1, 6.0), // State Room gilded screens
      makeCyl(0.05, 0.08, 2.4, 4, sx * 6.5, mainY + 6.4, -14.0) // Credentials Room flagpoles
    );
    w7Master.push(makeReliefBox(1.2, 0.22, 18.0, 'palacePrecastStone', sx * 35.5, mainY + 0.14, -4.0)); // Side-wing drainage
    w7Wood.push(makeBox(1.6, 0.72, 1.6, sx * 12.0, mainY + 9.56, -8.0)); // 3rd-floor recreation tables
  }
  w7Wood.push(
    makeBox(3.4, 1.05, 1.1, 0, mainY + 0.52, -15.5), // Lobby rosewood reception desk
    makeBox(0.75, 0.92, 2.2, -24.0, mainY + 0.46, -4.5), // Banquet marble console S
    makeBox(0.75, 0.92, 2.2, -24.0, mainY + 0.46, 4.5), // Banquet marble console N
    makeBox(0.95, 1.15, 0.65, 16.0, mainY + 0.58, -5.5), // Cabinet press lectern
    makeBox(0.55, 2.4, 4.6, -18.0, mainY + 6.4, -4.0), // Presidential Study bookshelf
    makeBox(8.2, 0.85, 2.4, 0, mainY + 9.62, 12.5) // 3rd-floor Cinema seating tiers
  );

  // ==========================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADES (2521–2580) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w8Master: THREE.BufferGeometry[] = [];
  const w8White: THREE.BufferGeometry[] = [];
  const w8Gold: THREE.BufferGeometry[] = [];
  const w8Wood: THREE.BufferGeometry[] = [];
  const w8Dark: THREE.BufferGeometry[] = [];
  const w8Foliage: THREE.BufferGeometry[] = [];

  // [2521–2540] Outer 30/4 Park Far-West/East Pergolas #2 (±80, -103), Outer Lawn Planters, Guard Pillars & Ticket Canopies
  for (const sx of [-1, 1]) {
    w8Master.push(
      makeReliefBox(6.2, 0.24, 3.4, 'palacePrecastStone', sx * 80.0, 3.05, -103.0),
      makeReliefBox(5.8, 0.24, 3.0, 'palacePrecastStone', sx * 80.0, 0.12, -103.0),
      makeReliefBox(2.8, 0.55, 2.8, 'palacePrecastStone', sx * 54.0, 0.28, -66.0), // Outer lawn lotus planters
      makeReliefBox(0.95, 3.2, 0.95, 'palacePrecastStone', sx * 16.0, 1.60, -86.0), // Outer driveway guard pillars
      makeReliefBox(4.4, 0.22, 2.4, 'palacePrecastStone', sx * 44.0, 3.10, -97.5) // Outer ticket-check canopies
    );
    w8Wood.push(
      makeBox(3.0, 0.46, 0.58, sx * 80.0, 0.23, -103.0),
      makeBox(1.2, 1.45, 0.36, sx * 46.0, 0.72, -82.0) // Outer lawn map kiosks
    );
    for (const ox of [-2.6, 2.6]) {
      for (const oz of [-1.3, 1.3]) {
        w8Dark.push(makeCyl(0.06, 0.08, 3.2, 4, sx * 80.0 + ox, 1.45, -103.0 + oz));
      }
    }
    w8Gold.push(
      makeCyl(0.06, 0.09, 4.2, 4, sx * 48.0, 2.0, -101.0), // Outer 30/4 Park lamps
      makeCyl(0.06, 0.09, 4.2, 4, sx * 74.0, 2.0, -101.0),
      makeBox(0.55, 0.55, 0.55, sx * 16.0, 3.45, -86.0), // Guard pillar finials
      makeCyl(0.10, 0.12, 1.05, 4, sx * 36.0, 0.52, -46.0) // Tank perimeter bollards
    );
    w8Foliage.push(
      colorizeGeo(new THREE.ConeGeometry(0.85, 0.65, 5).translate(sx * 54.0, 0.85, -66.0), '#287a2c'),
      colorizeGeo(new THREE.BoxGeometry(3.6, 0.60, 0.85).translate(sx * 62.0, 0.30, -100.5), '#256424')
    );
    w8White.push(makeCyl(0.16, 0.20, 0.85, 4, sx * 19.5, 0.42, -62.0));
  }
  w8Gold.push(
    makeBox(0.95, 0.62, 0.08, 38.0, 1.05, -26.0, 0, -0.35), // F-5E spec plinth
    makeBox(0.65, 1.25, 0.32, -10.0, 0.62, -103.5) // 30/4 Park architectural stele
  );

  // [2541–2560] Rear Garden Outer Tea/Sculpture Pergolas (±58, 54), Outer Pool Bridges, Approach-Light Mast & Rooftop Planters
  for (const sx of [-1, 1]) {
    w8Master.push(
      makeReliefBox(6.8, 0.28, 4.6, 'palacePrecastStone', sx * 58.0, 0.14, 54.0),
      makeReliefBox(7.2, 0.24, 5.0, 'palacePrecastStone', sx * 58.0, 3.15, 54.0),
      makeReliefBox(3.6, 0.22, 2.2, 'palacePrecastStone', sx * 22.0, 0.42, 36.5), // Outer reflection pool bridges
      makeReliefBox(1.1, 2.8, 1.1, 'palacePrecastStone', sx * 16.0, 1.40, 60.0), // Outer north perimeter gate piers
      makeReliefBox(0.65, 1.45, 0.65, 'palacePrecastStone', sx * 11.5, 0.72, 56.0) // Outer tea-deck lanterns
    );
    for (const ox of [-3.0, 3.0]) {
      for (const oz of [-2.0, 2.0]) {
        w8Master.push(makeReliefBox(0.28, 3.15, 0.28, 'palacePrecastStone', sx * 58.0 + ox, 1.55, 54.0 + oz));
      }
    }
    w8Wood.push(
      makeBox(2.4, 0.72, 1.0, sx * 58.0, 0.62, 54.0),
      makeBox(2.4, 0.46, 0.58, sx * 48.0, 0.23, -4.0), // Outer VIP benches
      makeBox(1.2, 0.72, 1.2, sx * 28.0, 0.36, 54.0) // Outer chess tables
    );
    w8White.push(makeBox(4.8, 0.65, 1.2, sx * 12.0, topDeckY + 0.32, -12.0)); // Rooftop planter troughs
    w8Foliage.push(colorizeGeo(new THREE.BoxGeometry(4.2, 0.45, 0.85).translate(sx * 12.0, topDeckY + 0.82, -12.0), '#287a2c'));
    w8Gold.push(makeCyl(0.18, 0.22, 1.05, 4, sx * 4.5, topDeckY + 0.52, -16.5)); // Rooftop compass bollards
  }
  w8Master.push(makeReliefBox(1.6, 1.45, 1.4, 'palaceRusticatedBase', bnkX - 8.5, 0.72, bnkZ + 2.0)); // Bunker radio-relay turret
  w8Dark.push(
    makeCyl(0.06, 0.09, 4.6, 4, -12.0, topDeckY + 2.2, 18.0), // Rooftop approach-light mast
    makeCyl(0.04, 0.06, 4.2, 4, -16.0, topDeckY + 2.0, 19.0) // West telemetry whip antenna
  );

  // [2561–2580] Front 3rd-Floor Brise-Soleil Fins, Rear 2nd-Floor Sun-Breakers & Interior Diplomatic Suites
  for (const sx of [-1, 1]) {
    for (let fin8 = 0; fin8 < 3; fin8++) {
      w8White.push(makeBox(0.24, 3.4, 0.32, sx * (24.0 + fin8 * 3.0), mainY + 10.6, -18.4));
    }
    w8White.push(makeBox(10.0, 0.24, 0.65, sx * 14.0, mainY + 7.2, 21.5)); // Rear 2nd-floor sun-breakers
    w8Gold.push(
      makeBox(0.75, 1.05, 0.75, sx * 7.5, mainY + 0.52, -22.0), // Porte-cochère honor-guard plinths
      makeBox(0.18, 2.2, 3.2, sx * 10.5, mainY + 6.3, -12.0) // Credentials Room screens
    );
    w8Master.push(makeReliefBox(1.2, 0.55, 1.2, 'palacePrecastStone', sx * 35.5, mainY + 0.28, 8.0)); // Side-wing catch-basins
    w8Wood.push(
      makeBox(1.2, 1.05, 0.65, sx * 5.5, mainY + 0.52, -15.5), // Lobby guestbook podiums
      makeBox(1.8, 0.78, 1.4, sx * 18.0, mainY + 9.59, -8.0) // 3rd-floor billiard/mahjong tables
    );
  }
  w8Gold.push(makeBox(2.2, 1.45, 1.2, 0, mainY + 0.72, 8.5)); // State Room diplomatic gift vitrine
  w8Wood.push(
    makeBox(0.95, 0.88, 1.6, 16.0, mainY + 0.44, -8.5), // Cabinet stenographer desk S
    makeBox(0.95, 0.88, 1.6, 16.0, mainY + 0.44, 8.5), // Cabinet stenographer desk N
    makeBox(0.85, 1.25, 0.85, -14.0, mainY + 5.82, -6.5), // Presidential Study globe pedestal
    makeBox(2.6, 1.85, 1.4, 0, mainY + 10.12, 16.5) // 3rd-floor Cinema projection booth
  );

  // ==========================================================================
  // WAVE 9 REAL-PHOTO VISUAL QC UPGRADES (2921–2980) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w9Master: THREE.BufferGeometry[] = [];
  const w9White: THREE.BufferGeometry[] = [];
  const w9Gold: THREE.BufferGeometry[] = [];
  const w9Wood: THREE.BufferGeometry[] = [];
  const w9Dark: THREE.BufferGeometry[] = [];
  const w9Foliage: THREE.BufferGeometry[] = [];

  // [2921–2940] Outer 30/4 Park Far-West/East Gazebos #3 (±92, -103), Stepped Reflection Planters, Flagstaff Plinths & Shade Canopies
  for (const sx of [-1, 1]) {
    w9Master.push(
      makeReliefBox(6.2, 0.24, 3.4, 'palacePrecastStone', sx * 92.0, 3.05, -103.0),
      makeReliefBox(5.8, 0.24, 3.0, 'palacePrecastStone', sx * 92.0, 0.12, -103.0),
      makeReliefBox(2.8, 0.55, 2.8, 'palacePrecastStone', sx * 64.0, 0.28, -66.0), // Stepped reflection planters
      makeReliefBox(0.95, 3.2, 0.95, 'palacePrecastStone', sx * 22.0, 1.60, -86.0), // Outer flagstaff plinths
      makeReliefBox(4.4, 0.22, 2.4, 'palacePrecastStone', sx * 54.0, 3.10, -97.5), // Far-outer shade canopies
      makeReliefBox(0.75, 2.4, 0.75, 'palacePrecastStone', sx * 26.0, 1.20, -97.5), // Outer gatehouse lantern piers
      makeReliefBox(0.85, 1.15, 0.85, 'palacePrecastStone', sx * 60.0, 0.58, -46.0), // Outer sundial pedestals
      makeReliefBox(2.4, 0.26, 0.55, 'palacePrecastStone', sx * 23.0, 0.13, -72.0) // Driveway curb-markers
    );
    w9Wood.push(
      makeBox(3.0, 0.46, 0.58, sx * 92.0, 0.23, -103.0),
      makeBox(1.2, 1.45, 0.36, sx * 56.0, 0.72, -82.0) // Audio-guide pickup kiosks
    );
    for (const ox of [-2.6, 2.6]) {
      for (const oz of [-1.3, 1.3]) {
        w9Dark.push(makeCyl(0.06, 0.08, 3.2, 4, sx * 92.0 + ox, 1.45, -103.0 + oz));
      }
      w9Dark.push(makeCyl(0.06, 0.08, 3.2, 4, sx * 54.0 + ox * 0.75, 1.45, -97.5));
    }
    w9Gold.push(
      makeCyl(0.06, 0.09, 4.2, 4, sx * 60.0, 2.0, -101.0), // Outer 30/4 Park lamps
      makeCyl(0.06, 0.09, 4.2, 4, sx * 86.0, 2.0, -101.0),
      makeBox(0.55, 0.55, 0.55, sx * 22.0, 3.45, -86.0), // Flagstaff finials
      makeBox(0.95, 0.72, 0.24, sx * 38.0, 0.95, -46.0), // Tank 843/390 commemorative lecterns
      makeCyl(0.12, 0.14, 1.05, 4, sx * 38.0, 0.52, -102.5) // Drinking-water pedestals
    );
    w9Foliage.push(
      colorizeGeo(new THREE.ConeGeometry(0.85, 0.65, 5).translate(sx * 64.0, 0.85, -66.0), '#287a2c'),
      colorizeGeo(new THREE.BoxGeometry(3.6, 0.60, 0.85).translate(sx * 74.0, 0.30, -100.5), '#256424')
    );
    w9White.push(makeCyl(0.16, 0.20, 0.85, 4, sx * 22.5, 0.42, -62.0));
  }
  w9Wood.push(makeBox(1.8, 0.85, 1.2, 41.0, 0.42, -26.0)); // F-5E cockpit-viewing step-platform
  w9Gold.push(makeBox(0.65, 1.25, 0.32, 10.0, 0.62, -103.5)); // Ngô Viết Thụ architectural-legacy stele

  // [2941–2960] Rear Garden Far-West/East Lotus & Orchid Pavilions (±70, 54), Pool Lantern Piers, Helipad Wind-Cone & Rooftop Planters
  for (const sx of [-1, 1]) {
    w9Master.push(
      makeReliefBox(6.8, 0.28, 4.6, 'palacePrecastStone', sx * 70.0, 0.14, 54.0),
      makeReliefBox(7.2, 0.24, 5.0, 'palacePrecastStone', sx * 70.0, 3.15, 54.0),
      makeReliefBox(0.95, 1.85, 0.95, 'palacePrecastStone', sx * 30.0, 0.92, 36.5), // Outer pool stone lantern piers
      makeReliefBox(1.1, 2.8, 1.1, 'palacePrecastStone', sx * 24.0, 1.40, 60.0), // Outer north perimeter lantern pillars
      makeReliefBox(0.65, 1.45, 0.65, 'palacePrecastStone', sx * 16.5, 0.72, 56.0), // Far-outer tea-deck lanterns
      makeReliefBox(0.85, 0.85, 0.85, 'palacePrecastStone', sx * 44.0, 0.42, sx > 0 ? 27.5 : 39.5) // Diplomatic pavilion urns
    );
    for (const ox of [-3.0, 3.0]) {
      for (const oz of [-2.0, 2.0]) {
        w9Master.push(makeReliefBox(0.28, 3.15, 0.28, 'palacePrecastStone', sx * 70.0 + ox, 1.55, 54.0 + oz));
      }
    }
    w9Wood.push(
      makeBox(2.4, 0.72, 1.0, sx * 70.0, 0.62, 54.0),
      makeBox(2.4, 0.46, 0.58, sx * 54.0, 0.23, -4.0), // Outer guard-rest benches
      makeBox(1.2, 0.72, 1.2, sx * 38.0, 0.36, 54.0), // Outer stone tea tables
      makeBox(2.2, 0.46, 0.58, sx * 60.0, 0.23, -48.0) // Wing-garden shaded teak benches
    );
    w9White.push(makeBox(2.4, 0.58, 0.95, sx * 18.0, topDeckY + 0.29, -12.0)); // Rooftop outer planter troughs
    w9Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.65, 5).translate(sx * 18.0, topDeckY + 0.85, -12.0), '#2c7d2c'));
    w9Gold.push(
      makeCyl(0.10, 0.14, 1.05, 4, sx * 6.5, topDeckY + 0.52, -16.5), // Rooftop railing finials
      makeCyl(0.06, 0.08, 1.15, 4, sx * 6.5, topDeckY + 0.58, 12.5) // Helipad S corner stanchions
    );
  }
  w9Master.push(
    makeReliefBox(2.4, 1.45, 2.0, 'palacePrecastStone', bnkX + 8.5, 0.72, bnkZ + 2.0), // Bunker air-intake hood
    makeReliefBox(2.2, 0.82, 1.0, 'palacePrecastStone', 24.0, 0.41, 50.0) // Orchid greenhouse potting bench
  );
  w9Dark.push(
    makeCyl(0.06, 0.08, 3.8, 4, 12.0, topDeckY + 1.9, 18.0), // Helipad E wind-cone mast
    makeCyl(0.04, 0.06, 4.2, 4, 16.0, topDeckY + 2.1, 19.0) // Rooftop E whip antenna
  );
  w9Wood.push(makeBox(1.4, 1.65, 1.2, -14.0, 0.82, 43.0)); // Tennis umpire chair & bench

  // [2961–2980] Modernist 4th-Floor Brise-Soleil Fins, Rear 3rd-Floor Sun-Breakers & Interior Diplomatic Suites
  for (const sx of [-1, 1]) {
    for (let bf9 = 0; bf9 < 3; bf9++) {
      w9White.push(makeBox(0.24, 3.0, 0.55, sx * (24.0 + bf9 * 3.0), mainY + 13.8, -18.4));
    }
    w9White.push(
      makeBox(10.0, 0.24, 0.65, sx * 14.0, mainY + 10.4, 21.5), // Rear 3rd-floor sun-breakers
      makeBox(3.6, 0.24, 1.4, sx * 24.0, mainY + 6.8, 22.2), // Rear balcony canopies
      makeBox(2.2, 0.55, 0.85, sx * 26.0, mainY + 9.48, 4.0) // 3rd-floor terrace planters #2
    );
    w9Gold.push(
      makeCyl(0.14, 0.16, 1.05, 4, sx * 10.5, mainY + 0.52, -22.0), // Porte-cochère diplomatic-seal bollards
      makeCyl(0.08, 0.12, 2.4, 4, sx * 6.5, mainY + 1.20, 8.5), // State Room ceremonial flag stands
      makeCyl(0.10, 0.14, 2.1, 4, sx * 16.5, mainY + 6.25, -10.0), // Khánh Tiết floor-lamp standards
      makeBox(4.8, 0.18, 0.22, sx * 18.0, mainY + 3.6, -22.5) // Porte-cochère cornice accent strips
    );
    w9Master.push(
      makeReliefBox(1.2, 0.55, 1.2, 'palacePrecastStone', sx * 35.5, mainY + 0.28, -8.0), // Side-wing catch-basins #2
      makeReliefBox(1.6, 0.90, 0.85, 'palacePrecastStone', sx * 24.0, mainY + 0.45, -27.5), // South banner plinths
      makeReliefBox(0.75, 1.15, 0.75, 'palacePrecastStone', sx * 18.5, mainY + 0.58, -10.0) // Lobby vase plinths
    );
    w9Wood.push(
      makeBox(2.2, 0.78, 1.0, sx * 12.0, mainY + 9.59, -8.0), // 3rd-floor lounge set
      makeBox(0.32, 2.6, 0.45, sx * 8.5, mainY + 10.6, 12.0) // Cinema acoustic pilasters
    );
  }
  w9Wood.push(
    makeBox(2.8, 1.05, 0.85, 0.0, mainY + 0.52, -13.5), // Lobby reception console
    makeBox(0.95, 0.92, 2.4, -24.0, mainY + 0.46, -5.5), // Banquet credenza S
    makeBox(0.95, 0.92, 2.4, -24.0, mainY + 0.46, 5.5), // Banquet credenza N
    makeBox(0.18, 2.2, 3.6, 22.0, mainY + 2.4, 0.0), // Cabinet map-board frame
    makeBox(0.65, 2.6, 2.4, -18.0, mainY + 6.5, -4.0), // Library bookcase S
    makeBox(0.65, 2.6, 2.4, -18.0, mainY + 6.5, 4.0), // Library bookcase N
    makeBox(1.8, 0.82, 0.95, 14.0, mainY + 5.61, -2.5) // Presidential Office armchairs
  );
  w9Gold.push(makeCyl(0.45, 0.25, 0.85, 5, 0.0, mainY + 8.6, -10.0)); // Credentials Room chandelier pendant

  // ==========================================================================
  // WAVE 10 REAL-PHOTO VISUAL QC UPGRADES (3321–3380) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const w10Master: THREE.BufferGeometry[] = [];
  const w10White: THREE.BufferGeometry[] = [];
  const w10Gold: THREE.BufferGeometry[] = [];
  const w10Wood: THREE.BufferGeometry[] = [];
  const w10Dark: THREE.BufferGeometry[] = [];
  const w10Foliage: THREE.BufferGeometry[] = [];

  // [3321–3340] 30/4 Park Far-Outer Diplomatic Promenade & Lê Duẩn Gatehouses
  for (const sx of [-1, 1]) {
    w10Master.push(
      makeReliefBox(6.2, 0.24, 3.4, 'palacePrecastStone', sx * 104.0, 3.05, -103.0),
      makeReliefBox(5.8, 0.24, 3.0, 'palacePrecastStone', sx * 104.0, 0.12, -103.0),
      makeReliefBox(2.8, 0.55, 2.8, 'palacePrecastStone', sx * 76.0, 0.28, -66.0),
      makeReliefBox(0.95, 3.2, 0.95, 'palacePrecastStone', sx * 30.0, 1.60, -86.0),
      makeReliefBox(4.4, 0.22, 2.4, 'palacePrecastStone', sx * 66.0, 3.10, -97.5),
      makeReliefBox(0.75, 2.4, 0.75, 'palacePrecastStone', sx * 34.0, 1.20, -97.5),
      makeReliefBox(0.85, 1.15, 0.85, 'palacePrecastStone', sx * 72.0, 0.58, -46.0),
      makeReliefBox(2.4, 0.26, 0.55, 'palacePrecastStone', sx * 31.0, 0.13, -72.0),
      makeReliefBox(0.42, 0.92, 0.42, 'palacePrecastStone', sx * 16.0, 0.46, -103.0)
    );
    w10Wood.push(
      makeBox(3.0, 0.46, 0.58, sx * 104.0, 0.23, -103.0),
      makeBox(1.2, 1.45, 0.36, sx * 66.0, 0.72, -82.0),
      makeBox(2.6, 0.46, 0.58, sx * 82.0, 0.23, -103.0)
    );
    for (const ox of [-2.6, 2.6]) {
      for (const oz of [-1.3, 1.3]) {
        w10Dark.push(makeCyl(0.06, 0.08, 3.2, 4, sx * 104.0 + ox, 1.45, -103.0 + oz));
      }
      w10Dark.push(makeCyl(0.06, 0.08, 3.2, 4, sx * 66.0 + ox * 0.75, 1.45, -97.5));
    }
    w10Gold.push(
      makeCyl(0.06, 0.09, 4.2, 4, sx * 72.0, 2.0, -101.0),
      makeCyl(0.06, 0.09, 4.2, 4, sx * 98.0, 2.0, -101.0),
      makeBox(0.55, 0.55, 0.55, sx * 30.0, 3.45, -86.0),
      makeBox(0.95, 0.72, 0.24, sx * 46.0, 0.95, -46.0),
      makeCyl(0.12, 0.14, 1.05, 4, sx * 46.0, 0.52, -102.5),
      makeBox(0.85, 0.95, 0.24, sx * 44.0, 0.48, -30.0)
    );
    w10Foliage.push(
      colorizeGeo(new THREE.ConeGeometry(0.85, 0.65, 5).translate(sx * 76.0, 0.85, -66.0), '#287a2c'),
      colorizeGeo(new THREE.BoxGeometry(3.6, 0.60, 0.85).translate(sx * 86.0, 0.30, -100.5), '#256424')
    );
    w10White.push(makeCyl(0.16, 0.20, 0.85, 4, sx * 30.5, 0.42, -62.0));
  }
  w10Wood.push(makeBox(2.2, 0.46, 0.58, 46.0, 0.23, -22.0));
  w10Gold.push(makeBox(0.65, 1.25, 0.32, -10.0, 0.62, -103.5));

  // [3341–3360] Rear Garden Far-Outer Bamboo & Frangipani Pavilions (±82, 54), Pool & Helipad
  for (const sx of [-1, 1]) {
    w10Master.push(
      makeReliefBox(6.8, 0.28, 4.6, 'palacePrecastStone', sx * 82.0, 0.14, 54.0),
      makeReliefBox(7.2, 0.24, 5.0, 'palacePrecastStone', sx * 82.0, 3.15, 54.0),
      makeReliefBox(0.95, 1.85, 0.95, 'palacePrecastStone', sx * 38.0, 0.92, 36.5),
      makeReliefBox(1.1, 2.8, 1.1, 'palacePrecastStone', sx * 32.0, 1.40, 60.0),
      makeReliefBox(0.65, 1.45, 0.65, 'palacePrecastStone', sx * 24.5, 0.72, 56.0),
      makeReliefBox(0.85, 0.85, 0.85, 'palacePrecastStone', sx * 52.0, 0.42, sx > 0 ? 27.5 : 39.5),
      makeReliefBox(1.4, 0.14, 1.4, 'palacePrecastStone', sx * 58.0, 0.07, 54.0)
    );
    for (const ox of [-3.0, 3.0]) {
      for (const oz of [-2.0, 2.0]) {
        w10Master.push(makeReliefBox(0.28, 3.15, 0.28, 'palacePrecastStone', sx * 82.0 + ox, 1.55, 54.0 + oz));
      }
    }
    w10Wood.push(
      makeBox(2.4, 0.72, 1.0, sx * 82.0, 0.62, 54.0),
      makeBox(2.4, 0.46, 0.58, sx * 64.0, 0.23, -4.0),
      makeBox(1.2, 0.72, 1.2, sx * 48.0, 0.36, 54.0),
      makeBox(2.2, 0.46, 0.58, sx * 70.0, 0.23, -48.0)
    );
    w10White.push(makeBox(2.4, 0.58, 0.95, sx * 24.0, topDeckY + 0.29, -12.0));
    w10Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.65, 5).translate(sx * 24.0, topDeckY + 0.85, -12.0), '#2c7d2c'));
    w10Gold.push(
      makeCyl(0.10, 0.14, 1.05, 4, sx * 12.5, topDeckY + 0.52, -16.5),
      makeCyl(0.06, 0.08, 1.15, 4, sx * 6.5, topDeckY + 0.58, 24.5),
      makeCyl(0.10, 0.12, 0.55, 4, sx * 10.5, topDeckY + 0.28, 18.0)
    );
  }
  w10Master.push(
    makeReliefBox(2.4, 1.45, 2.0, 'palacePrecastStone', bnkX + 12.5, 0.72, bnkZ + 2.0),
    makeReliefBox(2.2, 0.82, 1.0, 'palacePrecastStone', 28.0, 0.41, 50.0)
  );
  w10Dark.push(
    makeCyl(0.06, 0.08, 3.8, 4, -12.0, topDeckY + 1.9, 18.0),
    makeCyl(0.04, 0.06, 4.2, 4, -16.0, topDeckY + 2.1, 19.0)
  );
  w10Wood.push(makeBox(2.2, 0.46, 0.58, -18.0, 0.23, 43.0));
  w10Gold.push(makeBox(0.95, 1.15, 0.28, 0.0, 0.58, 62.0));

  // [3361–3380] Modernist Upper-Facade Sun-Screens & State-Suite Interior Furnishings
  for (const sx of [-1, 1]) {
    for (let bf10 = 0; bf10 < 3; bf10++) {
      w10White.push(makeBox(0.24, 3.0, 0.55, sx * (33.0 + bf10 * 3.0), mainY + 13.8, -18.4));
    }
    w10White.push(
      makeBox(10.0, 0.24, 0.65, sx * 14.0, mainY + 13.8, 21.5),
      makeBox(3.6, 0.24, 1.4, sx * 24.0, mainY + 10.4, 22.2),
      makeBox(2.2, 0.55, 0.85, sx * 26.0, mainY + 9.48, -4.0)
    );
    w10Gold.push(
      makeCyl(0.14, 0.16, 1.05, 4, sx * 14.5, mainY + 0.52, -22.0),
      makeCyl(0.08, 0.12, 2.4, 4, sx * 10.5, mainY + 1.20, 8.5),
      makeCyl(0.10, 0.14, 2.1, 4, sx * 20.5, mainY + 6.25, -10.0),
      makeBox(4.8, 0.18, 0.22, sx * 24.0, mainY + 3.6, -22.5),
      makeCyl(0.08, 0.10, 1.15, 4, sx * 4.5, mainY + 3.2, -6.0)
    );
    w10Master.push(
      makeReliefBox(1.2, 0.55, 1.2, 'palacePrecastStone', sx * 35.5, mainY + 0.28, 8.0),
      makeReliefBox(1.6, 0.90, 0.85, 'palacePrecastStone', sx * 30.0, mainY + 0.45, -27.5),
      makeReliefBox(0.75, 1.15, 0.75, 'palacePrecastStone', sx * 22.5, mainY + 0.58, -10.0)
    );
    w10Wood.push(
      makeBox(2.2, 0.78, 1.0, sx * 16.0, mainY + 9.59, -8.0),
      makeBox(0.32, 2.6, 0.45, sx * 11.5, mainY + 10.6, 12.0)
    );
  }
  w10Wood.push(
    makeBox(2.8, 1.05, 0.85, 0.0, mainY + 0.52, -9.5),
    makeBox(0.95, 0.92, 2.4, 24.0, mainY + 0.46, -5.5),
    makeBox(0.95, 0.92, 2.4, 24.0, mainY + 0.46, 5.5),
    makeBox(0.95, 0.92, 2.8, -22.0, mainY + 0.46, 0.0),
    makeBox(1.6, 0.78, 2.2, -14.0, mainY + 5.6, -4.0),
    makeBox(1.6, 0.78, 2.2, -14.0, mainY + 5.6, 4.0),
    makeBox(1.8, 0.82, 0.95, 14.0, mainY + 5.61, 2.5)
  );
  w10Gold.push(makeCyl(0.45, 0.25, 0.85, 5, 0.0, mainY + 8.6, -4.0));

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
  // Wave 2 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave2Master', w2Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave2White', w2White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave2Gold', w2Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave2Wood', w2Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave2Dark', w2Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave2Foliage', w2Foliage, folMat, false, false);
  // Wave 3 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave3Master', w3Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave3White', w3White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave3Gold', w3Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave3Wood', w3Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave3Dark', w3Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave3Foliage', w3Foliage, folMat, false, false);
  // Wave 4 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave4Master', w4Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave4White', w4White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave4Gold', w4Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave4Wood', w4Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave4Dark', w4Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave4Foliage', w4Foliage, folMat, false, false);
  // Wave 5 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave5Master', w5Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave5White', w5White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave5Gold', w5Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave5Wood', w5Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave5Dark', w5Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave5Foliage', w5Foliage, folMat, false, false);
  // Wave 6 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave6Master', w6Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave6White', w6White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave6Gold', w6Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave6Wood', w6Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave6Dark', w6Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave6Foliage', w6Foliage, folMat, false, false);
  // Wave 7 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave7Master', w7Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave7White', w7White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave7Gold', w7Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave7Wood', w7Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave7Dark', w7Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave7Foliage', w7Foliage, folMat, false, false);
  // Wave 8 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave8Master', w8Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave8White', w8White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave8Gold', w8Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave8Wood', w8Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave8Dark', w8Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave8Foliage', w8Foliage, folMat, false, false);
  // Wave 9 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave9Master', w9Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave9White', w9White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave9Gold', w9Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave9Wood', w9Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave9Dark', w9Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave9Foliage', w9Foliage, folMat, false, false);
  // Wave 10 merged meshes (castShadow = false, zero new materials!)
  addM('IndependencePalaceWave10Master', w10Master, pack.saigonMasterAtlasMat, false, true);
  addM('IndependencePalaceWave10White', w10White, ctx.materials.whitePlaster, false, true);
  addM('IndependencePalaceWave10Gold', w10Gold, ctx.materials.gold, false, false);
  addM('IndependencePalaceWave10Wood', w10Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('IndependencePalaceWave10Dark', w10Dark, ctx.materials.darkVoid, false, true);
  addM('IndependencePalaceWave10Foliage', w10Foliage, folMat, false, false);
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

  // [075][076][077][078] Công Xã Paris Square Curb, Floral Beds, Candle Holders, Bollards & Virgin Mary Statue (`ND-25..32`)
  const statY = maryGroundRel + 3.72;
  marbleParts.push(
    makeCyl(0.76, 0.96, 0.38, 12, 0, statY + 0.19, maryZ), // rocky cloud base
    makeCyl(0.46, 0.78, 2.75, 14, 0, statY + 1.72, maryZ), // fluted marble robe
    makeCyl(0.56, 0.48, 1.05, 12, 0, statY + 3.25, maryZ), // draped mantle & shoulders
    makeBox(0.32, 0.24, 0.36, 0, statY + 2.88, maryZ - 0.34), // folded hands
    new THREE.SphereGeometry(0.32, 10, 8).translate(0, statY + 4.02, maryZ), // serene upturned head & veil
    new THREE.SphereGeometry(0.34, 10, 8).translate(0, statY + 2.95, maryZ - 0.46) // globe cradled at chest
  );
  goldParts.push(
    makeBox(0.06, 0.48, 0.06, 0, statY + 3.48, maryZ - 0.46),
    makeBox(0.28, 0.06, 0.06, 0, statY + 3.58, maryZ - 0.46)
  );
  // Concentric floral bed ring + 4 corner bronze candle holders around pedestal
  const floralRing = remapRelief(new THREE.TorusGeometry(4.6, 0.45, 5, 18), 'saigonParkLawn');
  floralRing.rotateX(Math.PI * 0.5);
  floralRing.translate(0, maryGroundRel + 0.18, maryZ);
  masterParts.push(floralRing);
  for (const cxS of [-2.4, 2.4]) {
    for (const czS of [-2.4, 2.4]) {
      goldParts.push(makeCyl(0.06, 0.12, 0.72, 6, cxS, maryGroundRel + 0.36, maryZ + czS));
      glowParts.push(new THREE.SphereGeometry(0.08, 5, 4).translate(cxS, maryGroundRel + 0.78, maryZ + czS));
    }
  }
  // Circular square curb, Parisian bollards & park benches
  const sqCurb = remapRelief(new THREE.TorusGeometry(18.2, 0.28, 5, 24), 'creamLimestone');
  sqCurb.rotateX(Math.PI * 0.5);
  sqCurb.scale(1.12, 1.0, 0.92);
  sqCurb.translate(0, maryGroundRel + 0.06, maryZ);
  masterParts.push(sqCurb);
  for (let i = 0; i < 12; i++) {
    const ba = (i / 12) * Math.PI * 2;
    darkParts.push(makeCyl(0.08, 0.11, 0.85, 6, Math.cos(ba) * 19.6, maryGroundRel + 0.42, maryZ + Math.sin(ba) * 16.2));
  }
  for (const bxS of [-12.5, 12.5]) {
    woodParts.push(makeBox(0.65, 0.48, 2.2, bxS, maryGroundRel + 0.24, maryZ));
  }

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
          // [067] Visible bronze cathedral bell suspended inside belfry opening
          goldParts.push(makeCyl(0.28, 0.48, 0.85, 8, tx + ox, wy + 0.65, tz - 4.15));
        }
      }
    }
    // [066] Octagonal Slate-Grey Zinc Spires (`zincSpireCladding`), 4 Gabled Dormer Lucarnes, 4 Corner Pinnacles & Gilded Crosses to 60.5m (`ND-20..24`)
    const spire = makeCyl(0.28, 4.45, 19.6, 8, tx, 48.0, tz);
    masterParts.push(remapRelief(spire, 'zincSpireCladding'));
    for (const pxS of [-4.2, 4.2]) {
      for (const pzS of [-4.2, 4.2]) {
        masterParts.push(
          makeReliefBox(0.95, 2.2, 0.95, 'creamLimestone', tx + pxS, 39.1, tz + pzS),
          remapRelief(new THREE.ConeGeometry(0.68, 2.4, 4).rotateY(Math.PI * 0.25).translate(tx + pxS, 41.4, tz + pzS), 'creamLimestone')
        );
      }
    }
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
  // [061][062][065] Deeply recessed central portal multi-order archivolts, raking dentils & paneled mahogany doors (`ND-09`, `ND-10`)
  const mainPortal = remapRelief(normalizeExtrudeUv(createArchedWallGeometry(12.2, 11.4, 2.4, 6.2, 8.6)), 'creamLimestone');
  mainPortal.translate(0, 0.2, frontZ - 0.35);
  masterParts.push(mainPortal);
  for (let r = 0; r < 6; r++) {
    const rt = r / 5;
    masterParts.push(
      makeReliefBox(0.32, 0.32, 0.32, 'creamLimestone', -6.6 + rt * 6.4, 30.0 + rt * 7.2, frontZ - 0.42),
      makeReliefBox(0.32, 0.32, 0.32, 'creamLimestone', 6.6 - rt * 6.4, 30.0 + rt * 7.2, frontZ - 0.42)
    );
  }
  for (const ax of [-3.45, 3.45]) {
    masterParts.push(remapRelief(makeCyl(0.18, 0.18, 6.2, 8, ax, 3.3, frontZ - 0.72), 'creamLimestone'));
  }
  masterParts.push(
    makeArtPlane(5.4, 2.1, 'notreDameTympanum', 0, 7.2, frontZ - 0.65, Math.PI),
    makeReliefBox(2.95, 5.9, 0.28, 'cathedralDoorWood', -1.52, 3.05, frontZ - 0.58),
    makeReliefBox(2.95, 5.9, 0.28, 'cathedralDoorWood', 1.52, 3.05, frontZ - 0.58)
  );
  for (const dx of [-1.52, 1.52]) {
    for (const hy of [1.6, 4.4]) {
      darkParts.push(makeBox(2.2, 0.14, 0.08, dx, hy, frontZ - 0.74));
    }
    goldParts.push(new THREE.TorusGeometry(0.14, 0.03, 5, 8).translate(dx * 0.45, 2.6, frontZ - 0.76));
  }
  // Ground-gallery trifora (3 arched windows with stained glass & stone mullions, `ND-12`)
  for (const gx of [-3.4, 0, 3.4]) {
    masterParts.push(
      makeReliefPlane(2.1, 4.2, 'stainedGlassLancet', gx, 14.8, frontZ - 0.38, Math.PI),
      makeReliefBox(2.45, 0.26, 0.38, 'creamLimestone', gx, 12.6, frontZ - 0.42)
    );
  }
  // [063][064] Carved 8-Roundel Limestone Rose Window with 3D Radial Tracery Spokes (`ND-13`) & Swiss Cathedral Clock with Hands (`ND-14`)
  const roseDisk = remapRelief(new THREE.CircleGeometry(3.85, 24), 'roseWindowTracery');
  roseDisk.rotateY(Math.PI);
  roseDisk.translate(0, 22.8, frontZ - 0.42);
  masterParts.push(roseDisk);
  masterParts.push(
    remapRelief(new THREE.TorusGeometry(3.95, 0.32, 8, 24).translate(0, 22.8, frontZ - 0.44), 'creamLimestone'),
    remapRelief(new THREE.TorusGeometry(1.15, 0.14, 6, 16).translate(0, 22.8, frontZ - 0.46), 'creamLimestone')
  );
  for (let sp = 0; sp < 4; sp++) {
    masterParts.push(makeReliefBox(7.6, 0.14, 0.14, 'creamLimestone', 0, 22.8, frontZ - 0.46, 0, 0, (sp / 4) * Math.PI));
  }
  const clockDisk = remapArt(new THREE.CircleGeometry(1.75, 20), 'saigonClockFace');
  clockDisk.rotateY(Math.PI);
  clockDisk.translate(0, 31.8, frontZ - 0.42);
  masterParts.push(clockDisk);
  masterParts.push(remapRelief(new THREE.TorusGeometry(1.82, 0.22, 8, 20).translate(0, 31.8, frontZ - 0.44), 'creamLimestone'));
  darkParts.push(
    makeBox(0.08, 0.95, 0.06, 0.2, 32.1, frontZ - 0.48, 0, 0.6),
    makeBox(0.06, 1.25, 0.06, -0.25, 32.2, frontZ - 0.49, 0, -0.4)
  );

  // 3. WALK-IN ROMANESQUE-GOTHIC CATHEDRAL NAVE INTERIOR (`NI-01..32`, Ref 120 — ZERO exterior brick or sky holes!)
  const naveLen = 62.0; // z from -22.0 to +40.0
  const naveStartZ = -22.0;
  const naveEndZ = 40.0;
  const naveH = 24.0;
  // [068][079][080] Exterior Marseille brick shell, buttress pilasters, side walkways & lamps
  for (const sx of [-1, 1]) {
    masterParts.push(
      makeReliefBox(0.85, naveH, naveLen, 'marseilleBrick', sx * 15.6, naveH * 0.5, 9.0),
      makeReliefBox(0.65, 0.45, naveLen, 'creamLimestone', sx * 16.0, 12.2, 9.0),
      makeReliefBox(3.4, 0.14, 72.0, 'creamLimestone', sx * 20.5, 0.08, 4.0)
    );
    for (let bz = -16; bz <= 36; bz += 8.2) {
      masterParts.push(makeReliefBox(0.95, 22.0, 1.15, 'marseilleBrick', sx * 16.3, 11.0, bz));
      darkParts.push(makeCyl(0.06, 0.09, 4.2, 6, sx * 22.2, 2.1, bz));
      glowParts.push(new THREE.SphereGeometry(0.18, 6, 5).translate(sx * 22.2, 4.3, bz));
    }
  }
  // True straight-ridge Romanesque-Gothic pitched gable nave roof so [268] ridge cresting & apse cross seat with 0.0m air gap!
  const naveRoof = createGableRoofGeometry(32.5, naveLen + 2.0, 7.5, 0.28, 'z');
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
        // [070] Diagonal groin-vault ribs crossing between transverse nave arches
        masterParts.push(
          makeReliefBox(0.24, 0.24, 10.6, 'creamLimestone', -3.6, 20.2, midZ, 0.58),
          makeReliefBox(0.24, 0.24, 10.6, 'creamLimestone', 3.6, 20.2, midZ, -0.58)
        );
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

  // [071][073][074] Carved Wooden Pulpit (*Tòa Giảng*) with back-post supporting sounding canopy, Narthex Choir Loft & Pipe Organ, Confessional Booths & Holy-Water Stoups
  masterParts.push(
    makeReliefBox(1.85, 2.2, 1.85, 'cathedralDoorWood', -6.4, 4.2, 12.0),
    makeReliefBox(0.30, 2.35, 0.30, 'cathedralDoorWood', -7.2, 5.4, 12.0),
    remapRelief(makeCyl(0.18, 0.24, 3.1, 8, -6.4, 1.55, 12.0), 'cathedralDoorWood'),
    remapRelief(makeCyl(1.15, 1.35, 0.45, 8, -6.4, 6.45, 12.0), 'cathedralDoorWood')
  );
  // Narthex choir loft & gilded pipe organ above main entrance (-Z)
  masterParts.push(
    makeReliefBox(13.8, 0.45, 4.5, 'cathedralDoorWood', 0, 7.6, -19.5),
    makeReliefBox(6.8, 3.8, 0.85, 'cathedralDoorWood', 0, 9.8, -21.2)
  );
  for (let op = -6; op <= 6; op++) {
    const ph = 3.2 - Math.abs(op) * 0.22;
    goldParts.push(makeCyl(0.08, 0.08, ph, 6, op * 0.46, 9.2 + ph * 0.5, -20.65));
  }
  for (const sx of [-1, 1]) {
    marbleParts.push(makeCyl(0.42, 0.24, 1.15, 8, sx * 5.8, 0.58, -19.8));
    masterParts.push(makeReliefBox(1.6, 2.6, 2.2, 'cathedralDoorWood', sx * 13.6, 1.3, 4.0));
  }

  // [069][072] Three-Tier Curved Semicircular Apse, Exterior Radiating Chapels, Altar Rail & Carved Marble High Altar (`NI-22..28`)
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
      if (seg % 2 === 1) {
        const chapX = Math.sin(am) * (apseR + 2.4);
        const chapZ = apseCenterZ + Math.cos(am) * (apseR + 2.4);
        masterParts.push(
          remapRelief(makeCyl(2.4, 2.4, 7.2, 8, chapX, 3.6, chapZ), 'marseilleBrick'),
          remapRelief(new THREE.ConeGeometry(2.7, 2.8, 8).translate(chapX, 8.6, chapZ), 'zincSpireCladding')
        );
      }
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
    // Carved marble high altar + draped white linen altar cloth + Sanctuary Altar Rail
    makeBox(4.8, 1.32, 1.65, 0, 1.62, apseCenterZ + 0.8),
    makeBox(5.05, 0.16, 1.82, 0, 2.32, apseCenterZ + 0.8),
    makeBox(4.4, 0.82, 0.22, -4.2, 0.72, apseCenterZ - 5.8),
    makeBox(4.4, 0.82, 0.22, 4.2, 0.72, apseCenterZ - 5.8)
  );
  // 6 Tall Brass Candlesticks with lit warm candles + gilded altar crucifix (`NI-24`, `NI-27`)
  for (const cxOff of [-1.95, -1.35, -0.75, 0.75, 1.35, 1.95]) {
    goldParts.push(makeCyl(0.05, 0.12, 0.78, 8, cxOff, 2.75, apseCenterZ + 0.8));
    glowParts.push(new THREE.SphereGeometry(0.07, 5, 4).translate(cxOff, 3.22, apseCenterZ + 0.8));
  }
  goldParts.push(
    makeBox(0.18, 6.2, 0.18, 0, 4.0, apseCenterZ + 2.2),
    makeBox(2.2, 0.18, 0.18, 0, 6.1, apseCenterZ + 2.2)
  );
  // Warm Balanced Golden Sanctuary Lighting (`NI-30`, `NI-31`)
  const sanctuaryLight = new THREE.PointLight('#ffcc6e', 5.8, 42.0, 1.5);
  sanctuaryLight.position.set(0, 8.5, apseCenterZ - 1.5);
  group.add(sanctuaryLight);

  // Mature Saigon Tropical Canopy Trees framing cathedral flanks (`ND-31`)
  // Phase 1 Fix: Relocated [-26, -42] -> [-42, -44] (clear of Book Street) & [28, -12] -> [26, -34] (clear of Post Office!)
  for (const [tx, tz, th, tr, sd] of [
    [-42, -44, 16, 6.2, 3001],
    [26, -42, 16, 6.4, 3002],
    [-28, -12, 18, 7.2, 3003],
    [26, -34, 16, 5.8, 3004],
    [-28, 22, 18, 7.2, 3005],
    [28, 22, 18, 7.2, 3006]
  ]) {
    addSaigonParkTree(woodParts, foliageParts, tx, 0, tz, th, tr, sd);
  }

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (261–280) — Low-Poly, castShadow=false
  // ==========================================================================
  const ndW2Master: THREE.BufferGeometry[] = [];
  const ndW2Marble: THREE.BufferGeometry[] = [];
  const ndW2Gold: THREE.BufferGeometry[] = [];
  const ndW2Wood: THREE.BufferGeometry[] = [];
  const ndW2Dark: THREE.BufferGeometry[] = [];
  const ndW2Glow: THREE.BufferGeometry[] = [];

  // [261][262] Saigon Central Post Office (Bưu Điện Trung Tâm) side-plaza arched colonial facade bay & stepped granite stairs (East of square, x = +34)
  const poX = 34.5;
  const poZ = -12.0;
  ndW2Master.push(
    makeReliefBox(8.5, 11.4, 34.0, 'naveCreamVault', poX + 4.0, 5.7, poZ),
    makeReliefBox(9.2, 0.52, 34.8, 'creamLimestone', poX + 4.0, 11.55, poZ),
    // Central projecting pediment clock bay facing Cathedral (-X)
    makeReliefBox(1.8, 13.6, 10.2, 'naveCreamVault', poX - 0.6, 6.8, poZ),
    makeArtPlane(2.2, 2.2, 'saigonClockFace', poX - 1.56, 11.4, poZ, -Math.PI * 0.5),
    // Stepped granite entrance stairs & plaza apron
    makeReliefBox(5.2, 0.24, 34.0, 'creamLimestone', poX - 2.6, 0.12, poZ),
    makeReliefBox(2.4, 0.36, 9.6, 'creamLimestone', poX - 2.2, 0.34, poZ)
  );
  for (let bay = -3; bay <= 3; bay++) {
    const bz = poZ + bay * 4.4;
    ndW2Dark.push(makeBox(0.32, 3.8, 2.1, poX - 0.32, 3.4, bz));
    ndW2Master.push(makeReliefBox(0.45, 0.28, 2.6, 'creamLimestone', poX - 0.42, 5.4, bz));
  }
  for (let b = -3; b <= 3; b++) {
    ndW2Dark.push(makeCyl(0.08, 0.10, 0.85, 5, poX - 4.8, 0.44, poZ + b * 4.5));
  }

  // [263] French-colonial wrought-iron & slatted-wood Saigon park benches along Công Xã Paris promenade
  for (const bz of [-36.0, -24.0, -12.0, 2.0]) {
    ndW2Wood.push(
      makeBox(0.58, 0.10, 2.1, 24.8, 0.48, bz),
      makeBox(0.10, 0.48, 2.1, 25.05, 0.78, bz)
    );
    ndW2Dark.push(
      makeBox(0.55, 0.46, 0.10, 24.8, 0.24, bz - 0.85),
      makeBox(0.55, 0.46, 0.10, 24.8, 0.24, bz + 0.85)
    );
  }
  // [264] 3D recessed stained-glass window mullion frames & stone sills on exterior nave flanks
  for (const sx of [-1, 1]) {
    for (let bz = -12; bz <= 30; bz += 8.2) {
      ndW2Master.push(
        makeReliefBox(0.36, 0.28, 2.8, 'creamLimestone', sx * 16.05, 8.2, bz),
        makeReliefBox(0.24, 4.2, 0.18, 'creamLimestone', sx * 16.05, 10.4, bz),
        makeReliefPlane(2.4, 3.8, 'stainedGlassLancet', sx * 16.02, 10.4, bz, sx * Math.PI * 0.5)
      );
    }
  }
  // [265] Cathedral main-entrance granite parvis steps with wrought-iron central handrail
  for (let st = 0; st < 3; st++) {
    ndW2Master.push(makeReliefBox(14.5, 0.22, 0.65, 'creamLimestone', 0, 0.11 + st * 0.16, frontZ - 2.6 + st * 0.62));
  }
  ndW2Dark.push(makeBox(0.08, 0.85, 2.2, 0, 0.85, frontZ - 2.0));

  // [266] Sculpted limestone spire-dormer gable finials on both bell towers
  for (const sx of [-1, 1]) {
    const tx = sx * 11.2;
    const tz = -20.5;
    for (let d = 0; d < 4; d++) {
      const ang = (d / 4) * Math.PI * 2;
      ndW2Master.push(remapRelief(new THREE.ConeGeometry(0.24, 1.05, 4).translate(tx + Math.sin(ang) * 4.1, 41.9, tz - Math.cos(ang) * 4.1), 'creamLimestone'));
    }
  }
  // [267] Side-transept projecting brick portal bays (East & West flanks)
  for (const sx of [-1, 1]) {
    ndW2Master.push(
      makeReliefBox(1.8, 9.5, 6.2, 'marseilleBrick', sx * 16.6, 4.75, 18.0),
      makeReliefBox(2.0, 0.45, 6.6, 'creamLimestone', sx * 16.6, 9.65, 18.0),
      makeReliefBox(0.26, 4.6, 2.8, 'cathedralDoorWood', sx * 17.55, 2.35, 18.0)
    );
  }
  // [268] Roof-ridge cast-iron cresting & apse gilded cross finial
  for (let rz = -14; rz <= 34; rz += 6.0) {
    ndW2Dark.push(makeBox(0.14, 0.95, 0.14, 0, naveH + 7.8, rz));
  }
  ndW2Dark.push(makeBox(0.12, 0.12, 50.0, 0, naveH + 8.2, 10.0));
  ndW2Gold.push(
    makeBox(0.18, 2.4, 0.18, 0, naveH + 8.6, apseCenterZ),
    makeBox(1.2, 0.18, 0.18, 0, naveH + 9.2, apseCenterZ)
  );
  // [269] Exterior rainwater gargoyle spouts & vertical copper downspouts along nave buttresses
  for (const sx of [-1, 1]) {
    for (const bz of [-8, 8.4, 24.8]) {
      ndW2Dark.push(
        makeBox(0.95, 0.22, 0.22, sx * 16.8, 21.8, bz),
        makeCyl(0.06, 0.06, 21.5, 5, sx * 16.7, 10.8, bz + 0.55)
      );
    }
  }
  // [270][271][272] Interior wooden Lectern, side-aisle Marian/St. Joseph marble side-altars & Vestment Credence Table
  ndW2Wood.push(
    makeBox(0.75, 1.25, 0.65, 4.2, 1.55, apseCenterZ - 1.2),
    makeBox(1.6, 0.92, 0.72, -5.8, 1.42, apseCenterZ + 0.4)
  );
  ndW2Gold.push(
    makeBox(0.55, 0.08, 0.42, 4.2, 2.22, apseCenterZ - 1.2, 0, 0.35),
    makeCyl(0.04, 0.04, 2.4, 5, -5.8, 2.2, apseCenterZ + 0.4)
  );
  for (const sx of [-1, 1]) {
    ndW2Marble.push(makeBox(2.4, 1.15, 0.95, sx * 11.4, 0.58, apseCenterZ - 1.5));
    ndW2Gold.push(makeCyl(0.06, 0.10, 0.55, 5, sx * 11.4, 1.45, apseCenterZ - 1.5));
    ndW2Glow.push(new THREE.BoxGeometry(0.10, 0.10, 0.10).translate(sx * 11.4, 1.78, apseCenterZ - 1.5));
  }
  // [273][274] Interior marble memorial wall plaques & narthex hymn-board / charity alms boxes
  for (const sx of [-1, 1]) {
    ndW2Marble.push(makeBox(0.12, 1.35, 1.1, sx * 14.72, 2.2, -6.0));
    ndW2Wood.push(makeBox(0.52, 0.92, 0.45, sx * 3.8, 0.46, -18.5));
  }
  ndW2Wood.push(makeBox(1.1, 1.65, 0.12, -5.8, 2.4, -18.5));
  // [275][276] Công Xã Paris book-street kiosk (Đường Sách — Phase 1 Fix: moved to (-16.5, -56.5) clear of Reading Pergola!) & vintage green Saigon postal pillar box
  ndW2Wood.push(
    makeBox(3.4, 2.4, 1.8, -16.5, 1.2, -56.5),
    makeBox(3.9, 0.16, 2.2, -16.5, 2.48, -56.5)
  );
  ndW2Dark.push(makeCyl(0.28, 0.30, 1.35, 6, poX - 5.4, 0.68, poZ - 8.5));
  ndW2Gold.push(makeCyl(0.32, 0.32, 0.18, 6, poX - 5.4, 1.42, poZ - 8.5));
  // [277] Flock of white plaza pigeons around Virgin Mary square
  for (let pg = 0; pg < 8; pg++) {
    const pa = (pg / 8) * Math.PI * 2 + 0.4;
    const pr = 6.2 + (pg % 3) * 1.4;
    ndW2Marble.push(makeBox(0.16, 0.14, 0.26, Math.cos(pa) * pr, maryGroundRel + 0.12, maryZ + Math.sin(pa) * pr, pa));
  }
  // [278][279][280] Side-garden prayer plinths, Parisian double-globe crosswalk lamps & 1880 granite heritage stele
  for (const sx of [-1, 1]) {
    for (const pz of [-4.0, 12.0]) {
      ndW2Master.push(makeReliefBox(0.65, 1.45, 0.45, 'creamLimestone', sx * 21.8, 0.72, pz));
    }
  }
  for (const lz of [-30.0, -18.0]) {
    ndW2Dark.push(
      makeCyl(0.07, 0.12, 4.4, 6, 24.5, 2.2, lz),
      makeBox(1.1, 0.08, 0.08, 24.5, 4.35, lz)
    );
    ndW2Glow.push(
      new THREE.BoxGeometry(0.26, 0.26, 0.26).translate(23.95, 4.55, lz),
      new THREE.BoxGeometry(0.26, 0.26, 0.26).translate(25.05, 4.55, lz)
    );
  }
  ndW2Master.push(makeReliefBox(1.45, 1.85, 0.38, 'palaceRusticatedBase', -9.5, maryGroundRel + 0.92, maryZ - 14.5));
  ndW2Gold.push(makeBox(1.15, 0.75, 0.06, -9.5, maryGroundRel + 1.15, maryZ - 14.72));

  // ==========================================================================
  // WAVE 3 REAL-WORLD VISUAL QC UPGRADES (581–640) — Low-Poly, castShadow=false
  // ==========================================================================
  const ndW3Master: THREE.BufferGeometry[] = [];
  const ndW3Marble: THREE.BufferGeometry[] = [];
  const ndW3Gold: THREE.BufferGeometry[] = [];
  const ndW3Wood: THREE.BufferGeometry[] = [];
  const ndW3Dark: THREE.BufferGeometry[] = [];
  const ndW3Glow: THREE.BufferGeometry[] = [];
  const ndW3Foliage: THREE.BufferGeometry[] = [];

  // [581–604] SAIGON CENTRAL POST OFFICE (BƯU ĐIỆN TRUNG TÂM) — Vaulted Steel Ceiling Ribs, Antique Telephone Booths, Writing Desks, Maps, Pediment & Arcade
  // Vaulted open interior hall annex behind the East facade (x = poX + 8.5 .. poX + 20.5)
  const hallX = poX + 12.5;
  ndW3Master.push(
    makeReliefBox(14.0, 0.45, 34.0, 'cathedralTumblingTile', hallX, 0.02, poZ), // marble checkerboard hall floor grounded into terrain
    makeReliefBox(14.2, 0.45, 34.4, 'marseilleBrick', hallX, 12.4, poZ) // terracotta vaulted roof cap
  );
  // [581][582][583] Soaring vaulted steel-arch ceiling ribs, longitudinal iron purlins & cast-iron Corinthian columns reaching roof soffit (12.2m)
  for (let rib = -3; rib <= 3; rib++) {
    const rz = poZ + rib * 4.8;
    ndW3Dark.push(
      makeBox(13.2, 0.28, 0.24, hallX, 11.4, rz), // horizontal steel tie-beam
      makeBox(6.8, 0.24, 0.22, hallX - 3.2, 11.8, rz, 0, 0, 0.22), // sloped iron arch rib W
      makeBox(6.8, 0.24, 0.22, hallX + 3.2, 11.8, rz, 0, 0, -0.22), // sloped iron arch rib E
      // Grounded cast-iron hall columns (embedded -0.20m into floor up to 12.25m roof soffit)
      makeCyl(0.18, 0.22, 12.45, 6, hallX - 5.8, 6.02, rz),
      makeCyl(0.18, 0.22, 12.45, 6, hallX + 5.8, 6.02, rz)
    );
  }
  ndW3Dark.push(
    makeBox(0.18, 0.18, 32.0, hallX - 3.4, 11.2, poZ),
    makeBox(0.18, 0.18, 32.0, hallX + 3.4, 11.2, poZ)
  );
  // [584] 4 Iconic Antique Wooden Telephone Booths (Buồng Điện Thoại Cổ) with arched tops & brass world-time clock plaques
  for (let tb = 0; tb < 4; tb++) {
    const tz = poZ - 7.5 + tb * 5.0;
    ndW3Wood.push(
      makeBox(1.35, 2.55, 1.35, hallX - 4.4, 1.35, tz),
      makeBox(1.48, 0.22, 1.48, hallX - 4.4, 2.68, tz)
    );
    ndW3Gold.push(makeCyl(0.24, 0.24, 0.08, 6, hallX - 3.68, 2.95, tz, 0, Math.PI * 0.5));
  }
  // [585][586][587][588][589][594][600][601] Public teak writing desks, glue pots, teller counters, Uncle Hồ portrait, 2 colonial maps, vitrines & circular pier benches
  for (const dz of [poZ - 5.0, poZ + 5.0]) {
    ndW3Wood.push(makeBox(1.4, 0.92, 6.2, hallX, 0.56, dz)); // public writing desks
    ndW3Gold.push(makeCyl(0.08, 0.10, 0.18, 5, hallX, 1.12, dz)); // brass glue pot
  }
  ndW3Wood.push(
    makeBox(1.2, 1.05, 18.0, hallX + 4.4, 0.62, poZ), // colonial teller counter
    makeBox(2.2, 1.15, 0.85, hallX - 1.8, 0.68, poZ - 12.5), // philatelic vitrine
    makeBox(2.2, 1.15, 0.85, hallX + 1.8, 0.68, poZ + 12.5) // parcel sorting counter
  );
  ndW3Gold.push(
    makeBox(0.14, 3.6, 2.6, hallX + 6.4, 6.4, poZ), // Monumental framed Portrait of President Hồ Chí Minh
    makeBox(0.12, 3.4, 4.8, hallX - 6.2, 5.8, poZ - 8.5), // 1892 Saigon colonial wall map
    makeBox(0.12, 3.4, 4.8, hallX - 6.2, 5.8, poZ + 8.5) // Cochinchina telegraph wall map
  );
  // [590–599][602–604] Post Office exterior green-louvered shutters, pediment molding, colonnade porch, wall lamps, postcard cart, flagpole, signboards & potted ferns
  ndW3Master.push(
    makeReliefBox(1.4, 0.42, 10.6, 'creamLimestone', poX - 0.85, 13.7, poZ), // pediment molding seated flush on clock bay
    makeReliefBox(0.55, 2.2, 2.4, 'creamLimestone', poX - 1.15, 14.7, poZ), // clock wreath pediment crest seated flush on pediment
    makeReliefBox(1.6, 0.55, 7.6, 'palaceCrimsonBrocade', poX - 1.45, 8.8, poZ) // BƯU ĐIỆN TRUNG TÂM signboard
  );
  for (let bay = -3; bay <= 3; bay++) {
    const bz = poZ + bay * 4.4;
    ndW3Foliage.push(colorizeGeo(new THREE.BoxGeometry(0.16, 3.4, 1.85).translate(poX - 0.45, 8.2, bz), '#285e3c')); // green louvered shutters
    ndW3Glow.push(new THREE.BoxGeometry(0.22, 0.28, 0.22).translate(poX - 0.65, 5.8, bz + 2.2)); // exterior colonial wall-bracket lamps
  }
  // Post Office exterior postcard cart, flagpole & potted ferns
  ndW3Wood.push(makeBox(1.2, 0.88, 2.2, poX - 4.2, 0.55, poZ + 10.5));
  ndW3Marble.push(makeBox(1.5, 0.12, 2.5, poX - 4.2, 2.15, poZ + 10.5));
  ndW3Dark.push(
    makeCyl(0.03, 0.03, 1.25, 5, poX - 4.2, 1.52, poZ + 9.5),
    makeCyl(0.03, 0.03, 1.25, 5, poX - 4.2, 1.52, poZ + 11.5),
    makeCyl(0.06, 0.09, 9.2, 5, poX - 5.8, 4.45, poZ + 14.5) // Post Office flagpole
  );
  ndW3Gold.push(new THREE.ConeGeometry(0.15, 0.32, 5).translate(poX - 5.8, 9.15, poZ + 14.5));
  for (const fz of [poZ - 5.5, poZ + 5.5]) {
    ndW3Master.push(makeReliefBox(0.72, 0.55, 0.72, 'marseilleBrick', poX - 3.6, 0.40, fz));
    ndW3Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.45, 0.65, 5).translate(poX - 3.6, 0.92, fz), '#2f7c2e'));
  }

  // [605–622] NHÀ THỜ ĐỨC BÀ SÀI GÒN — Bell-Tower Gargoyles, Rose Hood, Side-Transept Oculi, Sanctuary Bishop's Throne, Tabernacle, Choir Stalls & Baptismal Font
  for (const sx of [-1, 1]) {
    const tx = sx * 11.2;
    const tz = -20.5;
    // Upper cornice gargoyle water-spouts on both 38m brick shafts
    ndW3Master.push(
      makeReliefBox(1.4, 0.28, 0.28, 'creamLimestone', tx + sx * 5.2, 37.8, tz - 4.4),
      makeReliefBox(1.4, 0.28, 0.28, 'creamLimestone', tx + sx * 5.2, 37.8, tz + 4.4),
      // Side-transept rose oculus windows above East/West projecting portals
      remapRelief(makeCyl(1.15, 1.15, 0.22, 8, sx * 17.55, 7.6, 18.0, 0, Math.PI * 0.5), 'roseWindowTracery')
    );
    // Interior side-aisle brass votive candle stands & choir stalls
    ndW3Gold.push(makeBox(1.4, 0.95, 0.48, sx * 11.4, 0.48, apseCenterZ - 5.5));
    ndW3Glow.push(new THREE.BoxGeometry(1.1, 0.14, 0.28).translate(sx * 11.4, 1.04, apseCenterZ - 5.5));
    ndW3Wood.push(makeBox(0.95, 1.05, 4.6, sx * 6.2, 0.65, apseCenterZ - 2.2)); // choir stalls
    // Exterior side-garden wrought-iron pedestrian gates
    ndW3Dark.push(makeBox(3.4, 1.85, 0.10, sx * 20.5, 0.92, -24.5));
  }
  // Interior Sanctuary Bishop's Cathedra, High Altar gilded tabernacle, suspended sanctuary lamp & West marble baptismal font
  ndW3Wood.push(makeBox(1.15, 1.85, 0.95, -4.4, 1.68, apseCenterZ + 1.8)); // Bishop's throne
  ndW3Gold.push(
    makeBox(0.85, 0.95, 0.65, 0, 2.85, apseCenterZ + 0.8), // High Altar gilded tabernacle
    makeCyl(0.025, 0.025, 12.0, 5, 0, 16.8, apseCenterZ - 2.4), // Sanctuary lamp chain
    makeCyl(0.22, 0.16, 0.42, 6, 0, 10.6, apseCenterZ - 2.4) // Sanctuary lamp body
  );
  ndW3Glow.push(new THREE.BoxGeometry(0.18, 0.22, 0.18).translate(0, 10.65, apseCenterZ - 2.4));
  ndW3Marble.push(makeCyl(0.55, 0.36, 1.15, 8, -11.4, 0.58, -15.5)); // Baptismal font
  ndW3Gold.push(new THREE.ConeGeometry(0.52, 0.48, 6).translate(-11.4, 1.38, -15.5));
  // Virgin Mary pedestal granite compass inlay & white-lily offering urns
  ndW3Master.push(remapRelief(makeCyl(5.6, 5.8, 0.12, 8, 0, maryGroundRel + 0.04, maryZ), 'creamLimestone'));
  for (const ux of [-1.8, 1.8]) {
    ndW3Marble.push(makeCyl(0.28, 0.22, 0.55, 6, ux, maryGroundRel + 0.48, maryZ - 3.6));
  }

  // [623–640] ĐƯỜNG SÁCH NGUYỄN VĂN BÌNH (PARIS COMMUNE BOOK STREET) & COLONIAL PLAZA KIOSKS
  // [623][624][625][626][627][628][629][638] 3 Boutique bookshop pavilions, outdoor shelves, Book Street archway, reading pergola, Book Café & festoon lights (NW plaza)
  for (let bs = 0; bs < 3; bs++) {
    const bsz = -40.0 - bs * 7.2;
    ndW3Wood.push(
      makeBox(4.2, 2.85, 5.2, -26.5, 1.42, bsz), // timber bookshop kiosk
      makeBox(0.65, 1.45, 3.8, -23.9, 0.72, bsz) // outdoor tiered book shelf
    );
    ndW3Dark.push(makeBox(4.8, 0.18, 5.8, -26.5, 2.94, bsz)); // dark steel canopy roof
    ndW3Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(-24.0, 2.75, bsz)); // festoon lights
  }
  // Book Street Entrance Archway ("ĐƯỜNG SÁCH TP. HỒ CHÍ MINH") grounded into plaza
  ndW3Dark.push(
    makeCyl(0.12, 0.14, 4.6, 5, -24.5, 2.15, -35.5),
    makeCyl(0.12, 0.14, 4.6, 5, -18.5, 2.15, -35.5),
    makeBox(6.8, 0.65, 0.24, -21.5, 4.35, -35.5)
  );
  ndW3Gold.push(makeBox(5.6, 0.38, 0.28, -21.5, 4.35, -35.5));
  // Book Street reading pergola & Book Café bistro tables + community book-box
  ndW3Wood.push(
    makeBox(3.4, 0.16, 6.2, -20.5, 2.75, -49.0),
    makeBox(0.65, 0.46, 5.2, -20.5, 0.24, -49.0), // communal reading bench
    makeBox(0.95, 2.15, 0.95, -20.5, 1.08, -56.5) // community book-exchange phone-box
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-2.8, 2.8]) {
      ndW3Dark.push(makeCyl(0.06, 0.08, 2.9, 5, -20.5 + ox, 1.35, -49.0 + oz));
    }
  }
  // [630–637][639][640] Colonial newsstand, Cà Phê Bệt stools, Morris cultural pillar, Wallace drinking fountain, heritage map easel, parked Xích Lô & tree-guard grilles
  ndW3Dark.push(
    makeCyl(0.75, 0.85, 3.6, 6, 19.5, 1.8, -42.5), // Parisian Morris cultural pillar
    makeCyl(0.28, 0.36, 1.85, 6, 22.5, 0.92, -22.0), // Wallace-style colonial drinking fountain
    // Colonial newsstand & flower kiosk (SW plaza)
    makeBox(3.2, 2.5, 2.2, -18.5, 1.25, -62.0),
    makeBox(3.8, 0.22, 2.8, -18.5, 2.62, -62.0)
  );
  ndW3Gold.push(new THREE.ConeGeometry(0.88, 0.65, 6).translate(19.5, 3.92, -42.5)); // Morris pillar dome
  // Saigon Cà Phê Bệt low wooden stools under shade trees & parked vintage Xích Lô
  for (let st = 0; st < 4; st++) {
    ndW3Wood.push(makeBox(0.36, 0.34, 0.36, -15.5 + st * 0.9, 0.18, -32.0 + (st % 2) * 0.8));
  }
  ndW3Wood.push(makeBox(1.05, 0.85, 1.35, 16.5, 0.65, -36.5)); // vintage Xích Lô cab
  ndW3Dark.push(
    makeCyl(0.32, 0.32, 0.08, 6, 15.9, 0.34, -36.5, 0, Math.PI * 0.5),
    makeCyl(0.32, 0.32, 0.08, 6, 17.1, 0.34, -36.5, 0, Math.PI * 0.5)
  );
  // Cast-iron tree-guard grilles around the 6 mature Saigon shade trees (matched to Phase 1 relocated tree coords!)
  for (const [tx, tz] of [[-42, -44], [26, -42], [-28, -12], [26, -34], [-28, 22], [28, 22]]) {
    ndW3Dark.push(makeBox(2.2, 0.08, 2.2, tx, 0.06, tz));
  }
  // Stone birdbath beside Virgin Mary flowerbeds
  ndW3Marble.push(makeCyl(0.45, 0.22, 0.78, 6, 6.8, maryGroundRel + 0.39, maryZ + 4.5));

  // ==========================================================================
  // WAVE 4 REAL-WORLD VISUAL QC UPGRADES (981–1040) — Low-Poly, castShadow=false
  // ==========================================================================
  const ndW4Master: THREE.BufferGeometry[] = [];
  const ndW4Marble: THREE.BufferGeometry[] = [];
  const ndW4Gold: THREE.BufferGeometry[] = [];
  const ndW4Wood: THREE.BufferGeometry[] = [];
  const ndW4Dark: THREE.BufferGeometry[] = [];
  const ndW4Glow: THREE.BufferGeometry[] = [];
  const ndW4Foliage: THREE.BufferGeometry[] = [];

  // [981–1000] ĐƯỜNG SÁCH NGUYỄN VĂN BÌNH EXPANSION — Main Book Stage, 3 West Publishing Pavilions, Vintage Book-Bus, Open-Book Monument & Artist Easels
  // Main Book Stage (-34, -57) with grounded steel columns & canopy
  ndW4Wood.push(
    makeBox(6.4, 0.55, 4.6, -34.0, 0.28, -57.0),
    makeBox(6.2, 2.6, 0.24, -34.0, 1.85, -59.1), // backdrop wall
    makeBox(5.6, 0.42, 1.6, -34.0, 0.21, -52.2) // audience bleachers
  );
  ndW4Dark.push(makeBox(6.8, 0.20, 5.2, -34.0, 3.25, -57.0));
  for (const ox of [-3.0, 3.0]) {
    for (const oz of [-2.1, 2.1]) {
      ndW4Dark.push(makeCyl(0.07, 0.08, 3.4, 5, -34.0 + ox, 1.55, -57.0 + oz));
    }
  }
  // 3 Additional West Publishing Pavilions (-35.5, -34/-41/-48) forming double-sided Book Street corridor
  for (let pv = 0; pv < 3; pv++) {
    const pvZ = -34.0 - pv * 7.0;
    ndW4Wood.push(
      makeBox(4.0, 2.8, 5.0, -35.5, 1.40, pvZ),
      makeBox(0.55, 1.35, 3.6, -33.2, 0.68, pvZ) // outdoor shelf
    );
    ndW4Dark.push(makeBox(4.6, 0.18, 5.6, -35.5, 2.88, pvZ)); // flush canopy roof
    ndW4Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(-33.1, 2.70, pvZ));
  }
  // Vintage Book-Bus (Xe Buýt Sách Cổ) at (-14, -64) + Open-Book Monument (-26, -62) + North Book Street Arch (-28, -64)
  ndW4Master.push(
    makeReliefBox(2.5, 2.2, 6.8, 'palaceCrimsonBrocade', -14.0, 1.45, -64.0),
    makeReliefBox(2.6, 0.22, 6.9, 'creamLimestone', -14.0, 2.65, -64.0),
    makeReliefBox(1.8, 0.95, 1.4, 'creamLimestone', -26.0, 0.48, -62.0) // monument plinth
  );
  ndW4Gold.push(makeBox(1.3, 0.65, 0.85, -26.0, 1.25, -62.0, 0, 0.35)); // bronze Open Book
  ndW4Dark.push(
    makeCyl(0.12, 0.14, 4.5, 5, -31.0, 2.1, -64.0),
    makeCyl(0.12, 0.14, 4.5, 5, -25.0, 2.1, -64.0),
    makeBox(6.8, 0.58, 0.24, -28.0, 4.30, -64.0)
  );
  // Street-artist easels along West cathedral walkway (-22, -26/-20/-14)
  for (const ez of [-26.0, -20.0, -14.0]) {
    ndW4Wood.push(makeBox(0.14, 1.45, 0.85, -22.0, 0.85, ez), makeBox(0.36, 0.36, 0.36, -21.2, 0.18, ez));
  }
  // [1001–1020] BƯU ĐIỆN TRUNG TÂM SOUTH & NORTH ANNEXES, VINTAGE MAIL-TRUCK, INTERIOR P.O. BOXES/CHANDELIERS & EAST TRAM-STOP
  for (const az of [poZ + 22.0, poZ - 24.0]) {
    ndW4Master.push(
      makeReliefBox(8.4, 8.6, 8.2, 'naveCreamVault', poX + 4.0, 4.3, az),
      makeReliefBox(9.0, 0.42, 8.8, 'creamLimestone', poX + 4.0, 8.75, az)
    );
    const axRoof = createGableRoofGeometry(9.2, 9.0, 2.1, 0.22, 'z');
    axRoof.translate(poX + 4.0, 8.92, az);
    ndW4Master.push(remapRelief(axRoof, 'marseilleBrick'));
    ndW4Foliage.push(colorizeGeo(new THREE.BoxGeometry(0.18, 2.6, 1.8).translate(poX - 0.25, 4.8, az), '#285e3c'));
  }
  // Vintage Saigon Postal Mail-Truck (poX - 5, poZ + 20) & East Square Colonial Tram-Stop Shelter (26, -54)
  ndW4Gold.push(makeBox(1.85, 1.45, 4.2, poX - 5.0, 1.05, poZ + 20.0));
  ndW4Dark.push(
    makeBox(1.9, 0.45, 4.3, poX - 5.0, 0.38, poZ + 20.0),
    makeBox(5.4, 0.18, 2.2, 26.0, 2.85, -54.0),
    makeCyl(0.06, 0.08, 3.0, 5, 23.6, 1.35, -54.0),
    makeCyl(0.06, 0.08, 3.0, 5, 28.4, 1.35, -54.0)
  );
  // Post Office interior brass P.O. Box cabinet, hanging chandeliers & rear delivery canopy
  ndW4Gold.push(makeBox(6.8, 2.4, 0.38, hallX, 1.45, poZ - 15.5));
  for (const cz of [poZ - 7.0, poZ + 7.0]) {
    ndW4Dark.push(makeCyl(0.03, 0.03, 3.6, 5, hallX, 9.6, cz));
    ndW4Glow.push(new THREE.BoxGeometry(0.45, 0.45, 0.45).translate(hallX, 7.6, cz));
  }
  ndW4Master.push(makeReliefBox(4.2, 0.22, 12.0, 'creamLimestone', hallX + 9.2, 3.6, poZ));
  for (const oz of [-5.2, 0, 5.2]) {
    ndW4Dark.push(makeCyl(0.08, 0.10, 3.75, 5, hallX + 11.0, 1.72, poZ + oz));
  }
  // [1021–1040] CATHEDRAL REAR MARIAN GROTTO (0, 54), CLOISTER BENCHES, PARISH OFFICE ANNEX (-26, 34) & INTERIOR ENRICHMENTS
  // Rear Marian Grotto (Hang Đá Đức Mẹ) behind apse (0, 54)
  ndW4Master.push(
    makeReliefBox(6.8, 4.4, 3.4, 'palaceRusticatedBase', 0, 2.2, 54.0),
    makeReliefBox(5.2, 0.42, 4.2, 'creamLimestone', 0, 0.21, 54.0)
  );
  ndW4Marble.push(makeCyl(0.32, 0.48, 2.1, 6, 0, 1.55, 53.2)); // Virgin Mary grotto statue
  ndW4Wood.push(makeBox(5.4, 0.48, 0.62, 0, 0.24, 59.0)); // prayer bench
  ndW4Glow.push(new THREE.BoxGeometry(0.85, 0.18, 0.22).translate(-2.2, 1.05, 53.2), new THREE.BoxGeometry(0.85, 0.18, 0.22).translate(2.2, 1.05, 53.2));
  // Cathedral West-garden colonial parish-office annex (-26, 34)
  ndW4Master.push(
    makeReliefBox(7.2, 5.4, 9.6, 'marseilleBrick', -26.0, 2.7, 34.0),
    makeReliefBox(7.8, 0.34, 10.2, 'creamLimestone', -26.0, 5.52, 34.0)
  );
  const poAnnexRoof = createGableRoofGeometry(8.0, 10.4, 1.85, 0.20, 'z');
  poAnnexRoof.translate(-26.0, 5.65, 34.0);
  ndW4Dark.push(poAnnexRoof);
  // Virgin Mary Square seating alcoves, cathedral parvis steles & interior sanctuary credenzas/fonts
  for (const sx of [-1, 1]) {
    ndW4Master.push(makeReliefBox(1.2, 1.65, 0.36, 'creamLimestone', sx * 8.5, 0.82, -27.5));
    ndW4Marble.push(makeBox(1.4, 1.05, 0.65, sx * 4.5, 0.52, apseCenterZ + 1.5)); // sanctuary credence pedestals
    ndW4Gold.push(makeCyl(0.14, 0.10, 0.32, 6, sx * 4.5, 1.22, apseCenterZ + 1.5)); // golden chalices
    ndW4Wood.push(makeBox(0.65, 0.48, 2.4, sx * 22.0, 0.24, 32.0)); // cloister prayer benches
  }
  ndW4Wood.push(makeBox(0.55, 0.34, 0.55, 16.0, 0.18, -58.0), makeBox(0.55, 0.34, 0.55, 17.2, 0.18, -57.4)); // Cà Phê Bệt SE park stools

  // ==========================================================================
  // WAVE 5 REAL-PHOTO VISUAL QC UPGRADES (1381–1440) — Low-Poly, castShadow=false
  // ==========================================================================
  const ndW5Master: THREE.BufferGeometry[] = [];
  const ndW5Marble: THREE.BufferGeometry[] = [];
  const ndW5Gold: THREE.BufferGeometry[] = [];
  const ndW5Wood: THREE.BufferGeometry[] = [];
  const ndW5Dark: THREE.BufferGeometry[] = [];
  const ndW5Glow: THREE.BufferGeometry[] = [];
  const ndW5Foliage: THREE.BufferGeometry[] = [];

  // [1381–1400] ĐƯỜNG SÁCH NGUYỄN VĂN BÌNH EAST BOOK KIOSKS (#7–#9), RARE-BOOK VITRINES, READING PERGOLA, ESPRESSO CART & LITERARY BUSTS
  for (let pv = 0; pv < 3; pv++) {
    const pvZ = -34.0 - pv * 7.0;
    ndW5Wood.push(
      makeBox(3.8, 2.8, 5.0, -21.5, 1.40, pvZ),
      makeBox(0.55, 1.35, 3.6, -23.6, 0.68, pvZ) // outdoor book display shelf
    );
    ndW5Dark.push(makeBox(4.4, 0.18, 5.6, -21.5, 2.88, pvZ)); // flush canopy roof
    ndW5Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(-23.6, 2.70, pvZ));
    // Median rare-book glass display vitrines (-28.5, -36/-43/-50)
    ndW5Master.push(makeReliefBox(1.1, 1.65, 1.6, 'creamLimestone', -28.5, 0.82, -36.0 - pv * 7.0));
  }
  // Shaded Reading-Bench Pergola (-28.5, -55) + Espresso Book-Café Cart (-25, -46) + Literary Bust Pedestals
  ndW5Dark.push(
    makeBox(4.4, 0.18, 3.2, -28.5, 2.85, -55.0),
    makeCyl(0.06, 0.08, 3.0, 5, -30.4, 1.35, -56.4),
    makeCyl(0.06, 0.08, 3.0, 5, -26.6, 1.35, -56.4),
    makeCyl(0.06, 0.08, 3.0, 5, -30.4, 1.35, -53.6),
    makeCyl(0.06, 0.08, 3.0, 5, -26.6, 1.35, -53.6)
  );
  ndW5Wood.push(
    makeBox(3.2, 0.46, 0.58, -28.5, 0.23, -55.0),
    makeBox(1.4, 0.92, 2.0, -25.0, 0.46, -46.0), // espresso cart
    makeBox(0.85, 0.45, 1.8, -11.8, 0.22, -64.0), // Book-Bus entry steps
    makeBox(2.2, 1.25, 0.28, -22.0, 0.72, -8.0), // calligraphy scroll rack
    makeBox(1.8, 0.46, 0.52, -22.0, 0.23, -2.0) // watercolorist bench
  );
  for (const bx of [-30.5, -21.5]) {
    ndW5Master.push(makeReliefBox(0.85, 1.15, 0.85, 'creamLimestone', bx, 0.58, -61.5));
    ndW5Gold.push(makeCyl(0.24, 0.28, 0.55, 6, bx, 1.42, -61.5)); // literary busts
  }
  ndW5Gold.push(makeBox(0.42, 1.45, 0.42, -28.0, 0.72, -29.5)); // Book Street South milestone

  // [1401–1420] BƯU ĐIỆN TRUNG TÂM PARISIAN CAFÉ TERRACE, MORRIS COLUMNS, FACADE TRIM & INTERIOR WRITING DESKS/BOOTHS
  // Parisian Sidewalk Café Terrace along East Công Xã Paris (22, -22/-17/-12)
  for (let tc = 0; tc < 3; tc++) {
    const tcz = -22.0 + tc * 5.0;
    ndW5Dark.push(makeCyl(0.04, 0.05, 2.45, 5, 22.0, 1.15, tcz), makeCyl(0.45, 0.45, 0.06, 6, 22.0, 0.74, tcz));
    ndW5Marble.push(makeCyl(0.08, 1.15, 0.36, 6, 22.0, 2.42, tcz)); // cream café parasols
  }
  // Twin Parisian Cast-Iron Morris Columns (22, -32) & (-16, -38) + Wallace Drinking Fountain (18, -42)
  for (const [mx, mz] of [[22.0, -32.0], [-16.0, -38.0]]) {
    ndW5Dark.push(
      makeCyl(0.58, 0.62, 3.2, 7, mx, 1.55, mz),
      makeCyl(0.08, 0.72, 0.65, 7, mx, 3.45, mz)
    );
  }
  ndW5Dark.push(makeCyl(0.32, 0.42, 1.85, 6, 18.0, 0.92, -42.0)); // Wallace drinking fountain
  // Post Office exterior facade trim, balcony rails, interior writing desks & antique phone booths
  ndW5Master.push(
    makeReliefBox(0.42, 1.1, 3.6, 'creamLimestone', poX - 0.5, 11.4, poZ), // clock-bay pediment keystone
    makeReliefBox(1.8, 0.16, 4.6, 'marseilleBrick', poX - 1.6, 3.8, poZ - 12.0), // ground awning N
    makeReliefBox(1.8, 0.16, 4.6, 'marseilleBrick', poX - 1.6, 3.8, poZ + 12.0) // ground awning S
  );
  for (const sz of [-1, 1]) {
    ndW5Dark.push(
      makeBox(0.12, 0.85, 7.6, poX - 0.4, 4.4, poZ + sz * 23.0), // Annex French balconies
      makeCyl(0.06, 0.09, 4.2, 5, 16.0, 2.0, -18.0 + sz * 10.0) // boulevard lamps
    );
    ndW5Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(16.0, 4.25, -18.0 + sz * 10.0));
    ndW5Wood.push(
      makeBox(1.2, 0.82, 2.8, hallX, 0.42, poZ + sz * 3.5), // interior mahogany postcard-writing desks
      makeBox(1.1, 2.2, 1.1, hallX - 4.2, 1.12, poZ + sz * 11.0) // antique telephone-booth hoods
    );
    ndW5Gold.push(makeCyl(0.45, 0.45, 0.10, 6, hallX, 11.6, poZ + sz * 5.0)); // vaulted ceiling rosettes
  }
  ndW5Master.push(
    makeReliefBox(1.4, 3.2, 1.4, 'creamLimestone', hallX + 12.5, 1.6, poZ - 4.0),
    makeReliefBox(1.4, 3.2, 1.4, 'creamLimestone', hallX + 12.5, 1.6, poZ + 4.0)
  );

  // [1421–1440] NHÀ THỜ ĐỨC BÀ EAST SACRISTY ANNEX (26, 34), ROSE-WINDOW & BELFRY TRIM, PARISIAN KIOSK & INTERIOR SANCTUARY RAIL/CONFESSIONALS
  ndW5Master.push(
    makeReliefBox(7.2, 5.4, 9.6, 'marseilleBrick', 26.0, 2.7, 34.0),
    makeReliefBox(7.8, 0.34, 10.2, 'creamLimestone', 26.0, 5.52, 34.0)
  );
  const sacRoof = createGableRoofGeometry(8.0, 10.4, 1.85, 0.20, 'z');
  sacRoof.translate(26.0, 5.65, 34.0);
  ndW5Dark.push(sacRoof);
  // Exterior rose-window limestone ring, bell-tower acoustic shutters, copper spire finials & lancet hood-moldings
  ndW5Master.push(makeReliefBox(4.2, 4.2, 0.32, 'creamLimestone', 0, 14.8, -21.2));
  for (const sx of [-1, 1]) {
    ndW5Wood.push(makeBox(2.2, 3.4, 0.24, sx * 7.2, 26.5, -21.2)); // belfry louvered shutters
    ndW5Gold.push(makeCyl(0.04, 0.14, 1.6, 5, sx * 7.2, 44.8, -19.5)); // copper spire lightning-rod tips
    ndW5Dark.push(makeCyl(0.08, 0.12, 4.6, 5, sx * 13.5, 2.2, -28.5)); // Parvis 5-globe lamp standards
    ndW5Glow.push(new THREE.BoxGeometry(0.45, 0.32, 0.45).translate(sx * 13.5, 4.65, -28.5));
    ndW5Master.push(
      makeReliefBox(0.32, 0.42, 2.2, 'creamLimestone', sx * 11.2, 13.2, 6.0), // clerestory hood-molding
      makeReliefBox(0.42, 3.8, 0.42, 'creamLimestone', sx * 6.5, 8.5, 44.5), // apse framing pilaster
      makeReliefBox(0.75, 0.85, 0.75, 'marseilleBrick', sx * 4.2, 0.42, 54.0) // rear grotto lily urns
    );
    // Interior sanctuary candelabra, nave confessional booths & choir-loft organ pipe towers
    ndW5Gold.push(
      makeCyl(0.08, 0.12, 1.55, 5, sx * 4.2, 0.95, apseCenterZ - 0.5),
      makeBox(1.8, 4.2, 0.85, sx * 4.5, 9.8, -18.5) // gilded organ-pipe casework
    );
    ndW5Wood.push(makeBox(1.8, 2.6, 2.8, sx * 10.2, 1.32, 4.0)); // mahogany confessional booths
  }
  // Virgin Mary Square Parisian newspaper/flower kiosk (-14, -50), interior Carrara altar rail & baptismal font
  ndW5Dark.push(
    makeBox(2.8, 2.5, 2.4, -14.0, 1.25, -50.0),
    makeCyl(0.08, 2.0, 0.72, 6, -14.0, 2.85, -50.0)
  );
  ndW5Marble.push(
    makeBox(9.6, 0.85, 0.34, 0, 0.42, apseCenterZ - 5.5), // Carrara-marble communion altar rail
    makeCyl(0.55, 0.38, 1.05, 8, 6.5, 0.52, -15.5) // narthex marble baptismal font
  );
  ndW5Wood.push(makeBox(2.2, 0.46, 0.58, 19.5, 0.23, -56.0)); // SE park heritage bench

  // ==========================================================================
  // WAVE 6 REAL-PHOTO VISUAL QC UPGRADES (1781–1840) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const ndW6Master: THREE.BufferGeometry[] = [];
  const ndW6Marble: THREE.BufferGeometry[] = [];
  const ndW6Gold: THREE.BufferGeometry[] = [];
  const ndW6Wood: THREE.BufferGeometry[] = [];
  const ndW6Dark: THREE.BufferGeometry[] = [];
  const ndW6Glow: THREE.BufferGeometry[] = [];
  const ndW6Foliage: THREE.BufferGeometry[] = [];

  // [1781–1800] Đường Sách North-End Book Kiosks #10 (-21.5, -55) & #11 (-35.5, -64), North Reading Gazebo (-28.5, -68) & Literary Art
  for (const [kx, kz, shOff] of [[-21.5, -55.0, -2.1], [-35.5, -64.0, 2.3]] as const) {
    ndW6Wood.push(
      makeBox(3.8, 2.8, 5.0, kx, 1.40, kz),
      makeBox(0.55, 1.35, 3.6, kx + shOff, 0.68, kz)
    );
    ndW6Dark.push(makeBox(4.4, 0.18, 5.6, kx, 2.88, kz)); // flush roof
    ndW6Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kx + shOff, 2.70, kz));
  }
  // North Cà Phê Sách Shaded Reading Gazebo (-28.5, -68) + Median Book-Swap Houses + Festoon Arches + Watercolor Awning
  ndW6Wood.push(
    makeBox(5.2, 0.18, 4.0, -28.5, 2.85, -68.0),
    makeBox(2.2, 0.72, 1.1, -28.5, 0.36, -68.0),
    makeBox(0.65, 0.75, 0.55, -28.5, 1.35, -39.5), // Book-Swap Mini-House #1
    makeBox(0.65, 0.75, 0.55, -28.5, 1.35, -46.5), // Book-Swap Mini-House #2
    makeBox(1.2, 1.15, 0.75, -34.0, 0.58, -54.5), // Book-launch podium
    makeBox(1.4, 0.72, 0.85, -24.0, 0.36, -68.0) // outdoor chess-reading table
  );
  for (const ox of [-2.2, 2.2]) {
    for (const oz of [-1.7, 1.7]) {
      ndW6Dark.push(makeCyl(0.06, 0.08, 3.0, 4, -28.5 + ox, 1.35, -68.0 + oz));
    }
  }
  for (const fz of [-40.0, -52.0]) {
    ndW6Dark.push(
      makeCyl(0.06, 0.08, 4.0, 4, -33.2, 1.85, fz),
      makeCyl(0.06, 0.08, 4.0, 4, -23.8, 1.85, fz),
      makeBox(9.6, 0.12, 0.12, -28.5, 3.85, fz)
    );
    ndW6Glow.push(new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(-28.5, 3.68, fz));
  }
  ndW6Dark.push(
    makeBox(2.4, 0.14, 4.2, -22.0, 2.55, -17.0), // Watercolorist awning
    makeCyl(0.05, 0.06, 2.7, 4, -22.0, 1.20, -18.8),
    makeCyl(0.05, 0.06, 2.7, 4, -22.0, 1.20, -15.2)
  );
  for (const mz of [-32.0, -58.0]) {
    ndW6Gold.push(makeBox(0.55, 1.65, 0.28, -24.5, 0.82, mz)); // Literary timeline monoliths
  }
  for (const px of [-32.0, -24.0]) {
    ndW6Master.push(makeReliefBox(2.4, 0.52, 0.85, 'creamLimestone', px, 0.26, -72.0));
    ndW6Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.45, 0.62, 5).translate(px, 0.82, -72.0), '#2d7a2d'));
  }

  // [1801–1820] Bưu Điện Trung Tâm Parisian Flower Kiosk (26, -34), Clock Pillar (14, -42), Plaza Benches & Interior Parcel Counter
  ndW6Dark.push(
    makeBox(2.8, 2.5, 2.4, 26.0, 1.25, -34.0),
    makeCyl(0.08, 2.0, 0.72, 5, 26.0, 2.85, -34.0), // domed kiosk cap
    makeCyl(0.10, 0.14, 3.8, 4, 14.0, 1.75, -42.0), // colonial street-clock pillar
    makeCyl(0.04, 0.05, 2.45, 4, 22.0, 1.15, -7.0) // café parasol #4 pole
  );
  ndW6Gold.push(
    makeBox(0.72, 0.72, 0.36, 14.0, 3.85, -42.0), // clock dial box
    makeBox(0.52, 1.25, 0.52, poX - 5.5, 0.62, poZ + 16.0), // yellow postal drop-box
    makeCyl(0.04, 0.10, 1.4, 4, hallX, 14.8, poZ - 8.0), // rooftop lightning spire N
    makeCyl(0.04, 0.10, 1.4, 4, hallX, 14.8, poZ + 8.0) // rooftop lightning spire S
  );
  ndW6Marble.push(makeCyl(0.08, 1.15, 0.36, 5, 22.0, 2.42, -7.0)); // café parasol #4
  for (const sz of [-1, 1]) {
    ndW6Wood.push(
      makeBox(2.2, 0.46, 0.58, 18.0, 0.23, -18.0 + sz * 8.0), // Parisian plaza benches
      makeBox(0.65, 0.48, 2.6, hallX - 3.5, 0.24, poZ + sz * 6.5) // Interior waiting benches
    );
    ndW6Master.push(
      makeReliefBox(0.36, 0.55, 2.8, 'creamLimestone', poX - 0.5, 8.6, poZ + sz * 14.0), // cornice dentils
      makeReliefBox(1.4, 0.16, 4.2, 'marseilleBrick', poX - 0.8, 3.6, poZ + sz * 23.0) // Annex window awnings
    );
    ndW6Gold.push(
      makeBox(0.95, 0.65, 0.08, hallX + 3.5, 1.15, poZ + sz * 10.0, 0, -0.35), // historical map lecterns
      makeCyl(0.42, 0.42, 0.10, 5, hallX, 11.8, poZ + sz * 11.0) // vault rib crown medallions
    );
    ndW6Dark.push(makeCyl(0.06, 0.09, 3.4, 4, poX - 4.2, 1.55, poZ + sz * 4.8));
    ndW6Glow.push(new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(poX - 4.2, 3.40, poZ + sz * 4.8));
  }
  ndW6Wood.push(
    makeBox(1.4, 0.88, 2.8, hallX, 0.44, poZ), // central nave parcel-weighing counter
    makeBox(2.4, 0.42, 4.2, hallX + 10.5, 0.21, poZ - 8.0) // rear mail-sack loading platform
  );
  ndW6Dark.push(makeBox(2.8, 0.65, 0.55, hallX + 10.5, 0.32, poZ + 8.0)); // rear bicycle-delivery rack

  // [1821–1840] Nhà Thờ Đức Bà Rear Cloister Meditation Gazebos (±18, 54), Gothic Pinnacle Finials & Interior Liturgical Details
  for (const sx of [-1, 1]) {
    const gzX = sx * 18.0;
    const gzZ = 54.0;
    ndW6Master.push(
      makeReliefBox(4.4, 0.36, 4.4, 'creamLimestone', gzX, 0.18, gzZ),
      // West-facade tower pinnacle finials & transept tympanum hood-moldings
      makeReliefBox(0.55, 1.65, 0.55, 'creamLimestone', sx * 11.2, 39.2, -24.2),
      makeReliefBox(0.36, 0.42, 3.2, 'creamLimestone', sx * 17.6, 5.8, 18.0),
      makeReliefBox(0.95, 1.35, 0.32, 'creamLimestone', sx * 11.5, 0.68, -26.5) // Parvis heritage plaque
    );
    for (const ox of [-1.8, 1.8]) {
      for (const oz of [-1.8, 1.8]) {
        ndW6Master.push(makeReliefBox(0.32, 3.0, 0.32, 'marseilleBrick', gzX + ox, 1.72, gzZ + oz));
      }
    }
    const clRoof = new THREE.ConeGeometry(3.4, 1.35, 4);
    clRoof.rotateY(Math.PI * 0.25);
    clRoof.translate(gzX, 3.85, gzZ);
    ndW6Dark.push(clRoof);
    ndW6Wood.push(
      makeBox(2.2, 0.46, 0.58, gzX, 0.42, gzZ), // cloister meditation bench
      makeBox(0.65, 0.46, 2.2, sx * 22.0, 0.23, 12.0), // side-garden bench
      makeBox(0.65, 1.65, 0.22, sx * 8.5, 0.82, -4.0) // interior hymn-board pedestal
    );
    ndW6Dark.push(
      makeCyl(0.06, 0.06, 12.0, 4, sx * 9.2, 5.85, 42.0), // apse copper downspouts
      makeCyl(0.06, 0.08, 1.05, 4, sx * 11.5, 0.45, maryZ - 6.0), // square chain posts
      makeCyl(0.06, 0.08, 1.05, 4, sx * 11.5, 0.45, maryZ + 6.0),
      makeBox(1.2, 0.95, 0.42, sx * 5.8, 0.48, 54.0) // grotto vigil-candle rack
    );
    ndW6Glow.push(new THREE.BoxGeometry(0.95, 0.14, 0.24).translate(sx * 5.8, 1.02, 54.0));
    ndW6Marble.push(makeCyl(0.32, 0.22, 0.95, 5, sx * 4.2, 0.48, -17.5)); // narthex holy-water stoups
  }
  ndW6Wood.push(
    makeBox(1.6, 2.2, 1.6, -7.5, 1.9, 16.0), // interior carved-oak pulpit
    makeBox(10.8, 0.95, 0.24, 0, 7.8, -15.8), // choir-loft oak balustrade
    makeBox(2.2, 0.46, 0.58, -18.0, 0.23, -54.0) // SW park bench
  );
  ndW6Gold.push(makeCyl(0.06, 0.12, 2.4, 4, 3.2, 1.2, 36.0)); // processional cross stand
  ndW6Dark.push(
    makeCyl(0.06, 0.09, 4.2, 4, 22.0, 1.95, -56.0), // SE park lamp standard
    makeBox(5.2, 0.18, 0.22, 0, 3.45, 48.5) // Rear grotto floral arch beam
  );
  ndW6Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(22.0, 4.15, -56.0));

  // ==========================================================================
  // WAVE 7 REAL-PHOTO VISUAL QC UPGRADES (2181–2240) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const ndW7Master: THREE.BufferGeometry[] = [];
  const ndW7Marble: THREE.BufferGeometry[] = [];
  const ndW7Gold: THREE.BufferGeometry[] = [];
  const ndW7Wood: THREE.BufferGeometry[] = [];
  const ndW7Dark: THREE.BufferGeometry[] = [];
  const ndW7Glow: THREE.BufferGeometry[] = [];
  const ndW7Foliage: THREE.BufferGeometry[] = [];

  // [2181–2200] Đường Sách Book Kiosks #12 (-21.5, -24.5) & #13 (-35.5, -71), South-Central Pergola, Scroll Bench & Exhibition Frames
  for (const [kx, kz, shOff] of [[-21.5, -24.5, -2.1], [-35.5, -71.0, 2.3]] as const) {
    ndW7Wood.push(
      makeBox(3.8, 2.8, 5.0, kx, 1.40, kz),
      makeBox(0.55, 1.35, 3.6, kx + shOff, 0.68, kz)
    );
    ndW7Dark.push(makeBox(4.4, 0.18, 5.6, kx, 2.88, kz));
    ndW7Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kx + shOff, 2.70, kz));
  }
  ndW7Wood.push(
    makeBox(4.8, 0.18, 3.6, -28.5, 2.85, -26.5), // South-Central Cà Phê Sách Pergola
    makeBox(1.8, 0.72, 1.0, -28.5, 0.36, -26.5),
    makeBox(3.2, 0.22, 4.2, -10.5, 0.12, -64.0), // Book-Bus outdoor timber café deck
    makeBox(0.14, 1.45, 0.85, -22.0, 0.85, -30.5), // Portrait easel #4
    makeBox(2.2, 0.65, 0.55, -19.5, 0.32, -70.0) // North bicycle rack #2
  );
  for (const ox of [-2.0, 2.0]) {
    for (const oz of [-1.5, 1.5]) {
      ndW7Dark.push(makeCyl(0.06, 0.08, 3.0, 4, -28.5 + ox, 1.35, -26.5 + oz));
    }
  }
  for (const fz of [-33.0, -59.5]) {
    ndW7Dark.push(makeBox(1.2, 1.85, 0.18, -28.5, 0.92, fz)); // Vintage book-cover exhibition frames
  }
  ndW7Dark.push(
    makeCyl(0.06, 0.08, 4.0, 4, -33.2, 1.85, -64.0),
    makeCyl(0.06, 0.08, 4.0, 4, -23.8, 1.85, -64.0),
    makeBox(9.6, 0.12, 0.12, -28.5, 3.85, -64.0)
  );
  ndW7Glow.push(new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(-28.5, 3.68, -64.0));
  ndW7Gold.push(
    makeBox(2.6, 0.85, 0.75, -28.5, 0.42, -75.0), // Bronze Open-Scroll Sculpture Bench
    makeBox(0.45, 1.55, 0.45, -20.5, 0.78, -21.5) // South wayfinding pylon
  );
  ndW7Master.push(makeReliefBox(2.6, 0.52, 0.95, 'creamLimestone', -28.5, 0.26, -22.5));
  ndW7Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.62, 5).translate(-28.5, 0.82, -22.5), '#2d7a2d'));

  // [2201–2220] Bưu Điện Trung Tâm Souvenir Kiosk #2 (26, -22), Morris Column #3 (22, 12), Café Parasols & Rear Mail-Sorting Shed
  ndW7Dark.push(
    makeBox(2.8, 2.5, 2.4, 26.0, 1.25, -22.0),
    makeCyl(0.08, 2.0, 0.72, 5, 26.0, 2.85, -22.0),
    makeCyl(0.56, 0.60, 3.2, 5, 22.0, 1.55, 12.0), // Morris Column #3
    makeCyl(0.08, 0.70, 0.65, 5, 22.0, 3.45, 12.0)
  );
  for (const cz of [-2.0, 3.0]) {
    ndW7Dark.push(makeCyl(0.04, 0.05, 2.45, 4, 22.0, 1.15, cz));
    ndW7Marble.push(makeCyl(0.08, 1.15, 0.36, 5, 22.0, 2.42, cz)); // Café parasols #5/#6
  }
  for (const sz of [-1, 1]) {
    ndW7Master.push(makeReliefBox(0.75, 0.85, 0.75, 'creamLimestone', poX - 3.6, 0.42, poZ + sz * 8.0));
    ndW7Wood.push(
      makeBox(0.85, 2.1, 2.4, hallX - 4.5, 1.05, poZ + sz * 14.0), // Stamp-collector display cabinets
      makeBox(0.65, 0.48, 2.4, hallX + 3.2, 0.24, poZ + sz * 4.0) // Interior oak writing benches
    );
    ndW7Gold.push(makeBox(0.24, 0.95, 3.6, hallX + 5.2, 4.8, poZ + sz * 6.0)); // World-clock frieze
    ndW7Dark.push(makeBox(0.14, 0.45, 7.6, poX + 4.0, 11.0, poZ + sz * 23.0)); // Annex rooftop cresting
  }
  ndW7Master.push(
    makeReliefBox(4.8, 3.2, 5.6, 'marseilleBrick', hallX + 12.5, 1.6, poZ + 14.0), // Rear mail-sorting shed
    makeReliefBox(0.52, 1.25, 0.52, 'palaceCrimsonBrocade', poX - 5.5, 0.62, poZ - 16.0) // Red airmail drop-box
  );
  const msRoof = createGableRoofGeometry(5.4, 6.2, 1.4, 0.16, 'z');
  msRoof.translate(hallX + 12.5, 3.22, poZ + 14.0);
  ndW7Dark.push(msRoof);
  for (const lz of [-2.0, 10.0]) {
    ndW7Dark.push(makeCyl(0.06, 0.09, 4.2, 4, 14.5, 1.95, lz));
    ndW7Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(14.5, 4.15, lz));
  }
  ndW7Wood.push(makeBox(2.2, 0.46, 0.58, 18.0, 0.23, 2.0));

  // [2221–2240] Nhà Thờ Đức Bà Rear Prayer Alcoves (±14, 60), Gothic String-Courses, Stations Steles & Sanctuary Furnishings
  for (const sx of [-1, 1]) {
    const paX = sx * 14.0;
    const paZ = 60.0;
    ndW7Master.push(
      makeReliefBox(4.0, 0.34, 4.0, 'creamLimestone', paX, 0.17, paZ),
      makeReliefBox(3.6, 0.35, 0.32, 'creamLimestone', sx * 7.2, 20.5, -21.2), // Tower string-course moldings
      makeReliefBox(0.85, 0.85, 1.8, 'creamLimestone', sx * 14.5, 14.5, 6.0), // Flying-buttress stone caps
      makeReliefBox(0.72, 0.85, 0.72, 'creamLimestone', sx * 12.5, 0.42, maryZ - 8.5), // Virgin Mary Sq corner urns
      makeReliefBox(0.72, 0.85, 0.72, 'creamLimestone', sx * 12.5, 0.42, maryZ + 8.5)
    );
    for (const ox of [-1.6, 1.6]) {
      for (const oz of [-1.6, 1.6]) {
        ndW7Master.push(makeReliefBox(0.28, 2.8, 0.28, 'marseilleBrick', paX + ox, 1.62, paZ + oz));
      }
    }
    const paRoof = new THREE.ConeGeometry(3.1, 1.25, 4);
    paRoof.rotateY(Math.PI * 0.25);
    paRoof.translate(paX, 3.62, paZ);
    ndW7Dark.push(paRoof);
    ndW7Wood.push(
      makeBox(2.0, 0.46, 0.56, paX, 0.40, paZ),
      makeBox(1.2, 1.15, 0.55, sx * 10.2, 0.58, 16.0) // Interior votive-candle shrines
    );
    ndW7Glow.push(new THREE.BoxGeometry(0.85, 0.14, 0.24).translate(sx * 10.2, 1.22, 16.0));
    ndW7Gold.push(
      makeBox(0.42, 1.55, 0.24, sx * 24.0, 0.78, 12.0), // Stations-of-the-Cross steles
      makeCyl(0.14, 0.18, 1.15, 4, sx * 5.5, 0.58, 36.0) // Altar flower pedestals
    );
    ndW7Marble.push(makeBox(1.4, 0.85, 0.65, sx * 3.8, 0.42, 56.5)); // Grotto floral offering tables
    ndW7Dark.push(makeBox(1.4, 1.85, 0.22, sx * 15.5, 0.92, -26.5)); // Parvis notice-board vitrines
  }
  ndW7Wood.push(
    makeBox(0.85, 1.35, 0.85, 5.5, 0.68, 24.0), // Interior Gospel lectern
    makeBox(1.4, 1.15, 0.55, -6.5, 0.58, -17.5), // Narthex bulletin console
    makeBox(1.6, 0.55, 1.0, -12.0, 0.28, -58.0) // SW park Cà Phê Bệt table #2
  );
  ndW7Dark.push(makeCyl(0.06, 0.09, 4.2, 4, -20.0, 1.95, -58.0));
  ndW7Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(-20.0, 4.15, -58.0));

  // ==========================================================================
  // WAVE 8 REAL-PHOTO VISUAL QC UPGRADES (2581–2640) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const ndW8Master: THREE.BufferGeometry[] = [];
  const ndW8Marble: THREE.BufferGeometry[] = [];
  const ndW8Gold: THREE.BufferGeometry[] = [];
  const ndW8Wood: THREE.BufferGeometry[] = [];
  const ndW8Dark: THREE.BufferGeometry[] = [];
  const ndW8Glow: THREE.BufferGeometry[] = [];
  const ndW8Foliage: THREE.BufferGeometry[] = [];

  // [2581–2600] Đường Sách Book Kiosks #14 (-21.5, -17.5) & #15 (-35.5, -78), North-Outer Pergola, Sculpture Bench & Exhibition Frames
  for (const [kx8, kz8, shOff8] of [[-21.5, -17.5, -2.1], [-35.5, -78.0, 2.3]] as const) {
    ndW8Wood.push(
      makeBox(3.8, 2.8, 5.0, kx8, 1.40, kz8),
      makeBox(0.55, 1.35, 3.6, kx8 + shOff8, 0.68, kz8)
    );
    ndW8Dark.push(makeBox(4.4, 0.18, 5.6, kx8, 2.88, kz8));
    ndW8Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kx8 + shOff8, 2.70, kz8));
  }
  ndW8Wood.push(
    makeBox(4.8, 0.18, 3.6, -28.5, 2.85, -78.5), // North-Outer Cà Phê Sách Pergola
    makeBox(1.8, 0.72, 1.0, -28.5, 0.36, -78.5),
    makeBox(2.4, 0.46, 0.58, -10.5, 0.23, -70.0), // Book-Bus rear reading bench
    makeBox(0.14, 1.45, 0.85, -22.0, 0.85, -20.5), // Portrait easel #5
    makeBox(2.2, 0.65, 0.55, -19.5, 0.32, -16.0) // South bicycle rack #3
  );
  for (const ox of [-2.0, 2.0]) {
    for (const oz of [-1.5, 1.5]) {
      ndW8Dark.push(makeCyl(0.06, 0.08, 3.0, 4, -28.5 + ox, 1.35, -78.5 + oz));
    }
  }
  for (const fz8 of [-20.0, -72.0]) {
    ndW8Dark.push(makeBox(1.2, 1.85, 0.18, -28.5, 0.92, fz8)); // Literary-history exhibition frames
  }
  ndW8Dark.push(
    makeCyl(0.06, 0.08, 4.0, 4, -33.2, 1.85, -76.0),
    makeCyl(0.06, 0.08, 4.0, 4, -23.8, 1.85, -76.0),
    makeBox(9.6, 0.12, 0.12, -28.5, 3.85, -76.0)
  );
  ndW8Glow.push(new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(-28.5, 3.68, -76.0));
  ndW8Gold.push(
    makeBox(2.6, 0.85, 0.75, -28.5, 0.42, -15.5), // South Plaza "Sách & Cà Phê" Sculpture Bench
    makeBox(0.45, 1.55, 0.45, -20.5, 0.78, -78.5) // North-Outer wayfinding pylon
  );
  ndW8Master.push(makeReliefBox(2.6, 0.52, 0.95, 'creamLimestone', -28.5, 0.26, -82.5));
  ndW8Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.48, 0.62, 5).translate(-28.5, 0.82, -82.5), '#2d7a2d'));

  // [2601–2620] Bưu Điện Trung Tâm Kiosk #3 (26, -10), Morris Column #4 (22, 22), Café Parasols & Rear Telegraph-Archive Annex
  ndW8Dark.push(
    makeBox(2.8, 2.5, 2.4, 26.0, 1.25, -10.0),
    makeCyl(0.08, 2.0, 0.72, 5, 26.0, 2.85, -10.0),
    makeCyl(0.56, 0.60, 3.2, 5, 22.0, 1.55, 22.0), // Morris Column #4
    makeCyl(0.08, 0.70, 0.65, 5, 22.0, 3.45, 22.0)
  );
  for (const cz8 of [8.0, 16.0]) {
    ndW8Dark.push(makeCyl(0.04, 0.05, 2.45, 4, 22.0, 1.15, cz8));
    ndW8Marble.push(makeCyl(0.08, 1.15, 0.36, 5, 22.0, 2.42, cz8)); // Café parasols #7/#8
  }
  for (const sz of [-1, 1]) {
    ndW8Gold.push(
      makeCyl(0.14, 0.18, 2.4, 4, poX - 3.6, 1.20, poZ + sz * 12.0), // Front steps lamp pedestals
      makeCyl(0.32, 0.32, 1.65, 5, hallX - 2.5, 0.82, poZ + sz * 12.0), // Postcard carousels
      makeBox(0.24, 0.95, 3.6, hallX - 5.2, 4.8, poZ + sz * 6.0) // West-Wall telegraph plaques
    );
    ndW8Wood.push(makeBox(0.65, 0.48, 2.4, hallX + 3.2, 0.24, poZ + sz * 10.0)); // Outer interior writing benches
  }
  ndW8Master.push(
    makeReliefBox(4.8, 3.2, 5.6, 'marseilleBrick', hallX + 12.5, 1.6, poZ - 14.0), // Rear Telegraph-Archive Annex
    makeReliefBox(0.52, 1.25, 0.52, 'creamLimestone', poX - 5.5, 0.62, poZ + 22.0) // Surface-mail drop-box
  );
  const taRoof = createGableRoofGeometry(5.4, 6.2, 1.4, 0.16, 'z');
  taRoof.translate(hallX + 12.5, 3.22, poZ - 14.0);
  ndW8Dark.push(taRoof);
  for (const lz8 of [-14.0, 20.0]) {
    ndW8Dark.push(makeCyl(0.06, 0.09, 4.2, 4, 14.5, 1.95, lz8));
    ndW8Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(14.5, 4.15, lz8));
  }
  ndW8Wood.push(makeBox(2.2, 0.46, 0.58, 18.0, 0.23, 14.0));

  // [2621–2640] Nhà Thờ Đức Bà Outer Rear Meditation Alcoves (±24, 60), Upper-Belfry Moldings & Sanctuary Furnishings
  for (const sx of [-1, 1]) {
    const maX = sx * 24.0;
    const maZ = 60.0;
    ndW8Master.push(
      makeReliefBox(4.0, 0.34, 4.0, 'creamLimestone', maX, 0.17, maZ),
      makeReliefBox(3.6, 0.35, 0.32, 'creamLimestone', sx * 7.2, 28.5, -21.2), // Upper-belfry hood-moldings
      makeReliefBox(0.85, 0.85, 1.8, 'creamLimestone', sx * 14.5, 14.5, -6.0), // Outer buttress stone caps
      makeReliefBox(0.72, 0.85, 0.72, 'creamLimestone', sx * 15.5, 0.42, maryZ - 8.5), // Outer Virgin Mary Sq urns
      makeReliefBox(0.72, 0.85, 0.72, 'creamLimestone', sx * 15.5, 0.42, maryZ + 8.5)
    );
    for (const ox of [-1.6, 1.6]) {
      for (const oz of [-1.6, 1.6]) {
        ndW8Master.push(makeReliefBox(0.28, 2.8, 0.28, 'marseilleBrick', maX + ox, 1.62, maZ + oz));
      }
    }
    const maRoof = new THREE.ConeGeometry(3.1, 1.25, 4);
    maRoof.rotateY(Math.PI * 0.25);
    maRoof.translate(maX, 3.62, maZ);
    ndW8Dark.push(maRoof);
    ndW8Wood.push(
      makeBox(2.0, 0.46, 0.56, maX, 0.40, maZ),
      makeBox(1.4, 2.2, 1.1, sx * 10.2, 1.10, 4.0), // Side-aisle confessional booths
      makeBox(1.2, 0.85, 3.6, sx * 4.5, 0.42, 28.0) // Nave choir-stall benches
    );
    ndW8Gold.push(
      makeBox(0.42, 1.55, 0.24, sx * 24.0, 0.78, -8.0), // Stations-of-the-Cross steles #2
      makeCyl(0.14, 0.18, 1.35, 4, sx * 7.5, 0.68, 36.0) // Sanctuary-lamp stands
    );
    ndW8Marble.push(makeCyl(0.32, 0.24, 1.05, 5, sx * 6.8, 0.52, 56.5)); // Grotto vigil-candle pedestals
    ndW8Dark.push(makeBox(1.2, 1.65, 0.22, sx * 19.5, 0.82, -26.5)); // Outer Parvis plaques
  }
  ndW8Wood.push(makeBox(1.6, 0.55, 1.0, -16.0, 0.28, -62.0)); // SW park Cà Phê Bệt table #3
  ndW8Dark.push(makeCyl(0.06, 0.09, 4.2, 4, 24.0, 1.95, -62.0));
  ndW8Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(24.0, 4.15, -62.0));

  // ==========================================================================
  // WAVE 9 REAL-PHOTO VISUAL QC UPGRADES (2981–3040) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const ndW9Master: THREE.BufferGeometry[] = [];
  const ndW9Marble: THREE.BufferGeometry[] = [];
  const ndW9Gold: THREE.BufferGeometry[] = [];
  const ndW9Wood: THREE.BufferGeometry[] = [];
  const ndW9Dark: THREE.BufferGeometry[] = [];
  const ndW9Glow: THREE.BufferGeometry[] = [];
  const ndW9Foliage: THREE.BufferGeometry[] = [];

  // [2981–3000] Đường Sách Book Kiosks #16 (-21.5, -82) & #17 (-35.5, -14), Literary-Talk Stage, Archway #5 & Street Art
  for (const [kx9, kz9, shOff9] of [[-21.5, -82.0, -2.1], [-35.5, -14.0, 2.3]] as const) {
    ndW9Wood.push(
      makeBox(3.8, 2.8, 5.0, kx9, 1.40, kz9),
      makeBox(0.55, 1.35, 3.6, kx9 + shOff9, 0.68, kz9)
    );
    ndW9Dark.push(makeBox(4.4, 0.18, 5.6, kx9, 2.88, kz9));
    ndW9Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kx9 + shOff9, 2.70, kz9));
  }
  ndW9Wood.push(
    makeBox(5.2, 0.36, 3.8, -28.5, 0.18, -85.5), // North-Plaza Literary-Talk Stage deck
    makeBox(5.2, 0.16, 3.8, -28.5, 3.05, -85.5), // Stage canopy
    makeBox(0.75, 1.15, 0.55, -28.5, 0.92, -85.5), // Stage lectern
    makeBox(2.4, 0.46, 0.58, -10.5, 0.23, -62.0), // Book-Bus front bench
    makeBox(0.14, 1.45, 0.85, -22.0, 0.85, -76.0), // Portrait easel #6
    makeBox(2.2, 0.65, 0.55, -19.5, 0.32, -84.0), // Bicycle rack #4
    makeBox(0.85, 1.45, 0.48, -33.2, 0.72, -11.0), // Tủ Sách Cộng Đồng book-swap cabinet
    makeBox(0.32, 1.55, 1.2, -22.0, 0.78, -86.0) // Calligraphy rack #3
  );
  for (const ox of [-2.2, 2.2]) {
    for (const oz of [-1.6, 1.6]) {
      ndW9Dark.push(makeCyl(0.06, 0.08, 3.2, 4, -28.5 + ox, 1.45, -85.5 + oz));
    }
  }
  for (const fz9 of [-14.0, -80.0]) {
    ndW9Dark.push(makeBox(1.2, 1.85, 0.18, -28.5, 0.92, fz9)); // Rare-book exhibition frames
  }
  ndW9Dark.push(
    makeCyl(0.06, 0.08, 4.0, 4, -33.2, 1.85, -18.0), // Archway #5
    makeCyl(0.06, 0.08, 4.0, 4, -23.8, 1.85, -18.0),
    makeBox(9.6, 0.12, 0.12, -28.5, 3.85, -18.0),
    makeCyl(0.05, 0.07, 3.2, 4, -33.0, 1.45, -18.0),
    makeCyl(0.05, 0.07, 3.2, 4, -33.0, 1.45, -74.0)
  );
  ndW9Glow.push(
    new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(-28.5, 3.68, -18.0),
    new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(-33.0, 3.15, -18.0),
    new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(-33.0, 3.15, -74.0)
  );
  ndW9Gold.push(
    makeBox(2.2, 1.05, 0.85, -28.5, 0.52, -89.5), // Trang Sách Mở open-book sculpture
    makeBox(0.45, 1.55, 0.45, -20.5, 0.78, -12.0) // South-Outer wayfinding pylon
  );
  ndW9Master.push(
    makeReliefBox(2.6, 0.52, 0.95, 'creamLimestone', -28.5, 0.26, -11.5),
    makeReliefBox(0.75, 1.45, 0.36, 'creamLimestone', -38.5, 0.72, -14.0)
  );
  ndW9Foliage.push(
    colorizeGeo(new THREE.ConeGeometry(0.48, 0.62, 5).translate(-28.5, 0.82, -11.5), '#2d7a2d'),
    colorizeGeo(new THREE.ConeGeometry(0.42, 0.58, 5).translate(-23.6, 0.82, -85.0), '#d83b7a'),
    colorizeGeo(new THREE.ConeGeometry(0.42, 0.58, 5).translate(-33.2, 0.82, -14.0), '#f0c422')
  );

  // [3001–3020] Bưu Điện Trung Tâm Philatelic Kiosk #4 (26, 10), Morris Column #5 (22, -22), Café Parasols & Rear Mail-Sorting Porch
  ndW9Dark.push(
    makeBox(2.8, 2.5, 2.4, 26.0, 1.25, 10.0),
    makeCyl(0.08, 2.0, 0.72, 5, 26.0, 2.85, 10.0),
    makeCyl(0.56, 0.60, 3.2, 5, 22.0, 1.55, -22.0), // Morris Column #5
    makeCyl(0.08, 0.70, 0.65, 5, 22.0, 3.45, -22.0)
  );
  for (const cz9 of [-14.0, -6.0]) {
    ndW9Dark.push(makeCyl(0.04, 0.05, 2.45, 4, 22.0, 1.15, cz9));
    ndW9Marble.push(makeCyl(0.08, 1.15, 0.36, 5, 22.0, 2.42, cz9)); // Café parasols #9/#10
  }
  for (const sz of [-1, 1]) {
    ndW9Gold.push(
      makeCyl(0.18, 0.22, 1.35, 5, poX - 3.6, 0.68, poZ + sz * 16.0), // Front steps bronze urns
      makeBox(1.4, 1.05, 0.75, hallX - 2.5, 0.52, poZ + sz * 16.0), // Telegram counters
      makeBox(0.24, 0.95, 3.6, hallX + 5.2, 4.8, poZ + sz * 6.0), // East-Wall map moldings
      makeCyl(0.12, 0.16, 1.85, 4, poX + 4.0, 12.4, poZ + sz * 6.0), // Central gable crest finials
      makeBox(0.24, 0.55, 0.55, hallX - 2.0, 11.4, poZ + sz * 8.0) // Vaulted-arch tie-rod medallions
    );
    ndW9Wood.push(makeBox(1.1, 2.4, 1.1, hallX - 4.2, 1.20, poZ + sz * 10.0)); // Vintage telephone-booth trims
    ndW9Master.push(makeReliefBox(0.45, 0.32, 1.4, 'creamLimestone', poX - 0.6, 2.8, poZ + sz * 20.0));
  }
  // Rear Courtyard Colonial Brick Mail-Sorting Porch (hallX + 12.5, poZ + 14)
  ndW9Master.push(
    makeReliefBox(5.4, 3.4, 4.6, 'marseilleBrick', hallX + 12.5, 1.70, poZ + 14.0),
    makeReliefBox(2.4, 0.52, 1.0, 'creamLimestone', 26.0, 0.26, 34.0) // SE corner planter curb
  );
  ndW9Dark.push(
    makeBox(6.0, 0.22, 5.2, hallX + 12.5, 3.45, poZ + 14.0),
    makeCyl(0.06, 0.09, 4.2, 4, 14.5, 1.95, -24.0),
    makeCyl(0.06, 0.09, 4.2, 4, 14.5, 1.95, 28.0),
    makeBox(0.55, 1.25, 0.55, poX - 5.5, 0.62, poZ - 22.0) // North-Forecourt airmail drop-box
  );
  ndW9Glow.push(
    new THREE.BoxGeometry(0.26, 0.28, 0.26).translate(14.5, 4.15, -24.0),
    new THREE.BoxGeometry(0.26, 0.28, 0.26).translate(14.5, 4.15, 28.0)
  );
  ndW9Wood.push(
    makeBox(2.2, 0.46, 0.58, 26.0, 0.23, -24.0), // Bus-stop bench #4
    makeBox(1.8, 0.95, 1.2, hallX + 10.5, 0.48, poZ + 6.0), // Parcel-crate stack
    makeBox(2.2, 0.46, 0.58, 18.0, 0.23, -16.0) // Plaza bench #5
  );
  ndW9Gold.push(
    makeCyl(0.26, 0.30, 1.35, 5, hallX + 1.5, 0.68, poZ), // Central Nave letter-box pillar
    makeBox(0.85, 1.15, 0.32, poX - 5.2, 0.58, poZ - 26.0) // North-Plaza heritage plaque
  );
  ndW9Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.65, 5).translate(26.0, 0.85, 34.0), '#2c782c'));

  // [3021–3040] Nhà Thờ Đức Bà Far-Outer Cloister Prayer Chapels (±32, +60), Belfry Pinnacles & Sanctuary
  for (const sx of [-1, 1]) {
    ndW9Master.push(
      makeReliefBox(4.8, 0.36, 4.2, 'creamLimestone', sx * 32.0, 0.18, 60.0),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 30.2, 1.75, 58.2),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 33.8, 1.75, 58.2),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 30.2, 1.75, 61.8),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 33.8, 1.75, 61.8),
      makeReliefBox(0.85, 1.25, 0.85, 'creamLimestone', sx * 7.2, 22.0, -21.2), // Mid-belfry corner pinnacles
      makeReliefBox(0.65, 0.45, 1.4, 'creamLimestone', sx * 14.5, 12.2, -6.0), // Gargoyle water-spouts S
      makeReliefBox(0.65, 0.45, 1.4, 'creamLimestone', sx * 14.5, 12.2, 18.0), // Gargoyle water-spouts N
      makeReliefBox(0.75, 0.85, 0.75, 'creamLimestone', sx * 19.5, 0.42, maryZ - 8.5), // Virgin Mary Square urns S
      makeReliefBox(0.75, 0.85, 0.75, 'creamLimestone', sx * 19.5, 0.42, maryZ + 8.5), // Virgin Mary Square urns N
      makeReliefBox(0.72, 0.72, 0.72, 'creamLimestone', sx * 30.0, 0.36, 46.0), // Annex rainwater basins
      makeReliefBox(0.32, 0.85, 0.32, 'creamLimestone', sx * 26.5, 0.42, -26.5) // Parvis far-outer bollards
    );
    const chR9 = createGableRoofGeometry(5.4, 4.8, 1.35, 0.22, 'x');
    chR9.translate(sx * 32.0, 3.35, 60.0);
    ndW9Dark.push(chR9);
    ndW9Wood.push(
      makeBox(2.2, 0.46, 0.56, sx * 32.0, 0.58, 60.0), // Prayer kneelers
      makeBox(2.6, 0.68, 0.65, sx * 8.5, 0.34, 28.0), // Side-aisle devotional benches
      makeBox(0.85, 1.05, 0.55, sx * 6.5, 0.52, -6.0) // Rear-aisle hymnal racks
    );
    ndW9Gold.push(
      makeBox(0.75, 1.15, 0.28, sx * 23.5, 0.58, -26.5), // Parvis timeline plaques
      makeBox(0.55, 1.45, 0.24, sx * 28.0, 0.72, -8.0), // Stations steles #3 S
      makeBox(0.55, 1.45, 0.24, sx * 28.0, 0.72, 30.0), // Stations steles #3 N
      makeBox(1.4, 1.05, 0.55, sx * 10.2, 0.52, 14.0), // Votive-candle stands
      makeCyl(0.10, 0.14, 2.2, 4, sx * 7.5, 1.10, 32.0) // Processional-cross stands
    );
    ndW9Marble.push(makeBox(1.4, 0.95, 0.55, sx * 9.8, 0.48, 56.5)); // Marian Grotto candle racks
    ndW9Dark.push(makeBox(0.14, 2.4, 2.2, sx * 24.5, 1.20, 54.0)); // Climbing-rose trellises
  }
  ndW9Marble.push(makeCyl(0.45, 0.32, 1.15, 5, -6.5, 0.58, -17.5)); // Narthex baptismal font
  ndW9Wood.push(makeBox(1.4, 0.65, 1.4, -24.0, 0.32, -62.0)); // Cà Phê Bệt table #4
  ndW9Dark.push(makeCyl(0.06, 0.09, 4.2, 4, 30.0, 1.95, -62.0));
  ndW9Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(30.0, 4.15, -62.0));

  // ==========================================================================
  // WAVE 10 REAL-PHOTO VISUAL QC UPGRADES (3381–3440) — Ultra-Lean, castShadow=false
  // ==========================================================================
  const ndW10Master: THREE.BufferGeometry[] = [];
  const ndW10Marble: THREE.BufferGeometry[] = [];
  const ndW10Gold: THREE.BufferGeometry[] = [];
  const ndW10Wood: THREE.BufferGeometry[] = [];
  const ndW10Dark: THREE.BufferGeometry[] = [];
  const ndW10Glow: THREE.BufferGeometry[] = [];
  const ndW10Foliage: THREE.BufferGeometry[] = [];

  // [3381–3400] Đường Sách Book Kiosks #18 (-21.5, -90) & #19 (-35.5, -6), Poetry Pergola, Archway #6 & Street Art
  for (const [kx10, kz10, shOff10] of [[-21.5, -90.0, -2.1], [-35.5, -6.0, 2.3]] as const) {
    ndW10Wood.push(
      makeBox(3.8, 2.8, 5.0, kx10, 1.40, kz10),
      makeBox(0.55, 1.35, 3.6, kx10 + shOff10, 0.68, kz10)
    );
    ndW10Dark.push(makeBox(4.4, 0.18, 5.6, kx10, 2.88, kz10));
    ndW10Glow.push(new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(kx10 + shOff10, 2.70, kz10));
  }
  ndW10Wood.push(
    makeBox(5.2, 0.18, 3.8, -28.5, 2.95, -6.5), // South-Plaza Poetry Pergola
    makeBox(2.4, 0.46, 0.58, -28.5, 0.23, -6.5),
    makeBox(2.4, 0.46, 0.58, -10.5, 0.23, -54.0),
    makeBox(0.14, 1.45, 0.85, -22.0, 0.85, -84.0),
    makeBox(2.2, 0.65, 0.55, -19.5, 0.32, -92.0),
    makeBox(0.85, 1.45, 0.48, -33.2, 0.72, -90.0),
    makeBox(0.32, 1.55, 1.2, -22.0, 0.78, -6.0),
    makeBox(1.2, 0.65, 1.2, -28.5, 0.32, -9.5),
    makeBox(2.2, 0.46, 0.58, -25.5, 0.23, -90.0)
  );
  for (const ox of [-2.2, 2.2]) {
    for (const oz of [-1.6, 1.6]) {
      ndW10Dark.push(makeCyl(0.06, 0.08, 3.1, 4, -28.5 + ox, 1.40, -6.5 + oz));
    }
  }
  for (const fz10 of [-8.0, -92.0]) {
    ndW10Dark.push(makeBox(1.2, 1.85, 0.18, -28.5, 0.92, fz10));
  }
  ndW10Dark.push(
    makeCyl(0.06, 0.08, 4.0, 4, -33.2, 1.85, -90.0),
    makeCyl(0.06, 0.08, 4.0, 4, -23.8, 1.85, -90.0),
    makeBox(9.6, 0.12, 0.12, -28.5, 3.85, -90.0),
    makeCyl(0.05, 0.07, 3.2, 4, -33.0, 1.45, -6.0),
    makeCyl(0.05, 0.07, 3.2, 4, -33.0, 1.45, -88.0)
  );
  ndW10Glow.push(
    new THREE.BoxGeometry(0.22, 0.22, 0.22).translate(-28.5, 3.68, -90.0),
    new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(-33.0, 3.15, -6.0),
    new THREE.BoxGeometry(0.18, 0.20, 0.18).translate(-33.0, 3.15, -88.0)
  );
  ndW10Gold.push(
    makeBox(2.2, 1.05, 0.85, -28.5, 0.52, -94.0),
    makeBox(0.45, 1.55, 0.45, -20.5, 0.78, -94.0),
    makeBox(0.85, 0.95, 0.28, -28.5, 0.48, -10.5)
  );
  ndW10Master.push(
    makeReliefBox(2.6, 0.52, 0.95, 'creamLimestone', -28.5, 0.26, -3.0),
    makeReliefBox(0.75, 1.45, 0.36, 'creamLimestone', -38.5, 0.72, -6.0)
  );
  ndW10Foliage.push(
    colorizeGeo(new THREE.ConeGeometry(0.48, 0.62, 5).translate(-28.5, 0.82, -3.0), '#2d7a2d'),
    colorizeGeo(new THREE.ConeGeometry(0.42, 0.58, 5).translate(-23.6, 0.82, -92.0), '#d83b7a'),
    colorizeGeo(new THREE.ConeGeometry(0.42, 0.58, 5).translate(-33.2, 0.82, -6.0), '#f0c422')
  );

  // [3401–3420] Bưu Điện Trung Tâm Philatelic Kiosk #5 (26, -18), Morris Column #6 (22, 30) & Rear Mail-Carriage Bay
  ndW10Dark.push(
    makeBox(2.8, 2.5, 2.4, 26.0, 1.25, -18.0),
    makeCyl(0.08, 2.0, 0.72, 5, 26.0, 2.85, -18.0),
    makeCyl(0.56, 0.60, 3.2, 5, 22.0, 1.55, 30.0),
    makeCyl(0.08, 0.70, 0.65, 5, 22.0, 3.45, 30.0)
  );
  for (const cz10 of [20.0, 26.0]) {
    ndW10Dark.push(makeCyl(0.04, 0.05, 2.45, 4, 22.0, 1.15, cz10));
    ndW10Marble.push(makeCyl(0.08, 1.15, 0.36, 5, 22.0, 2.42, cz10));
  }
  for (const sz of [-1, 1]) {
    ndW10Gold.push(
      makeCyl(0.18, 0.22, 1.35, 5, poX - 3.6, 0.68, poZ + sz * 20.0),
      makeBox(1.4, 1.05, 0.75, hallX - 2.5, 0.52, poZ + sz * 20.0),
      makeBox(0.24, 0.95, 3.6, hallX + 5.2, 4.8, poZ + sz * 12.0),
      makeCyl(0.12, 0.16, 1.85, 4, poX + 4.0, 12.4, poZ + sz * 10.0),
      makeBox(0.24, 0.55, 0.55, hallX - 2.0, 11.4, poZ + sz * 14.0)
    );
    ndW10Wood.push(makeBox(1.1, 2.4, 1.1, hallX - 4.2, 1.20, poZ + sz * 14.0));
    ndW10Master.push(makeReliefBox(0.45, 0.32, 1.4, 'creamLimestone', poX - 0.6, 2.8, poZ + sz * 24.0));
  }
  ndW10Master.push(
    makeReliefBox(5.4, 3.4, 4.6, 'marseilleBrick', hallX + 12.5, 1.70, poZ + 24.0),
    makeReliefBox(2.4, 0.52, 1.0, 'creamLimestone', 26.0, 0.26, -34.0)
  );
  ndW10Dark.push(
    makeBox(6.0, 0.22, 5.2, hallX + 12.5, 3.45, poZ + 24.0),
    makeCyl(0.06, 0.09, 4.2, 4, 14.5, 1.95, -32.0),
    makeCyl(0.06, 0.09, 4.2, 4, 14.5, 1.95, 34.0),
    makeBox(0.55, 1.25, 0.55, poX - 5.5, 0.62, poZ + 26.0),
    makeCyl(0.10, 0.12, 0.92, 4, poX - 5.5, 0.46, poZ - 26.0),
    makeCyl(0.10, 0.12, 0.92, 4, poX - 5.5, 0.46, poZ - 28.0)
  );
  ndW10Glow.push(
    new THREE.BoxGeometry(0.26, 0.28, 0.26).translate(14.5, 4.15, -32.0),
    new THREE.BoxGeometry(0.26, 0.28, 0.26).translate(14.5, 4.15, 34.0)
  );
  ndW10Wood.push(
    makeBox(2.2, 0.46, 0.58, 26.0, 0.23, 24.0),
    makeBox(1.8, 0.95, 1.2, hallX + 10.5, 0.48, poZ + 18.0),
    makeBox(2.2, 0.46, 0.58, 18.0, 0.23, 22.0)
  );
  ndW10Gold.push(
    makeCyl(0.26, 0.30, 1.35, 5, hallX + 1.5, 0.68, poZ + 6.0),
    makeBox(0.85, 1.15, 0.32, poX - 5.2, 0.58, poZ + 28.0)
  );
  ndW10Foliage.push(colorizeGeo(new THREE.ConeGeometry(0.55, 0.65, 5).translate(26.0, 0.85, -34.0), '#2c782c'));

  // [3421–3440] Nhà Thờ Đức Bà Far-Outer Cloister Chapels #2 (±40, +60), Upper-Belfry Finials & Sanctuary
  for (const sx of [-1, 1]) {
    ndW10Master.push(
      makeReliefBox(4.8, 0.36, 4.2, 'creamLimestone', sx * 40.0, 0.18, 60.0),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 38.2, 1.75, 58.2),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 41.8, 1.75, 58.2),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 38.2, 1.75, 61.8),
      makeReliefBox(0.45, 3.2, 0.45, 'marseilleBrick', sx * 41.8, 1.75, 61.8),
      makeReliefBox(0.85, 1.25, 0.85, 'creamLimestone', sx * 7.2, 26.0, -21.2),
      makeReliefBox(0.65, 0.45, 1.4, 'creamLimestone', sx * 14.5, 14.2, -12.0),
      makeReliefBox(0.65, 0.45, 1.4, 'creamLimestone', sx * 14.5, 14.2, 24.0),
      makeReliefBox(0.75, 0.85, 0.75, 'creamLimestone', sx * 23.5, 0.42, maryZ - 8.5),
      makeReliefBox(0.75, 0.85, 0.75, 'creamLimestone', sx * 23.5, 0.42, maryZ + 8.5),
      makeReliefBox(0.72, 0.72, 0.72, 'creamLimestone', sx * 36.0, 0.36, 46.0),
      makeReliefBox(0.32, 0.85, 0.32, 'creamLimestone', sx * 30.5, 0.42, -26.5)
    );
    const chR10 = createGableRoofGeometry(5.4, 4.8, 1.35, 0.22, 'x');
    chR10.translate(sx * 40.0, 3.35, 60.0);
    ndW10Dark.push(chR10);
    ndW10Wood.push(
      makeBox(2.2, 0.46, 0.56, sx * 40.0, 0.58, 60.0),
      makeBox(2.6, 0.68, 0.65, sx * 8.5, 0.34, 20.0),
      makeBox(0.85, 1.05, 0.55, sx * 6.5, 0.52, -12.0)
    );
    ndW10Gold.push(
      makeBox(0.75, 1.15, 0.28, sx * 27.5, 0.58, -26.5),
      makeBox(0.55, 1.45, 0.24, sx * 32.0, 0.72, -8.0),
      makeBox(0.55, 1.45, 0.24, sx * 32.0, 0.72, 30.0),
      makeBox(1.4, 1.05, 0.55, sx * 10.2, 0.52, 20.0),
      makeCyl(0.10, 0.14, 2.2, 4, sx * 7.5, 1.10, 26.0)
    );
    ndW10Marble.push(makeBox(1.4, 0.95, 0.55, sx * 12.8, 0.48, 56.5));
    ndW10Dark.push(
      makeBox(0.14, 2.4, 2.2, sx * 28.5, 1.20, 54.0),
      makeCyl(0.06, 0.09, 4.2, 4, sx * 36.0, 1.95, -62.0)
    );
    ndW10Glow.push(new THREE.BoxGeometry(0.28, 0.28, 0.28).translate(sx * 36.0, 4.15, -62.0));
  }
  ndW10Marble.push(makeCyl(0.45, 0.32, 1.15, 5, 6.5, 0.58, -17.5));
  ndW10Wood.push(makeBox(1.4, 0.65, 1.4, -28.0, 0.32, -62.0));

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
  // Wave 2 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave2Master', ndW2Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave2Marble', ndW2Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave2Gold', ndW2Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave2Wood', ndW2Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave2Dark', ndW2Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave2Glow', ndW2Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  // Wave 3 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave3Master', ndW3Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave3Marble', ndW3Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave3Gold', ndW3Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave3Wood', ndW3Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave3Dark', ndW3Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave3Glow', ndW3Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave3Foliage', ndW3Foliage, folMat, false, false);
  // Wave 4 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave4Master', ndW4Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave4Marble', ndW4Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave4Gold', ndW4Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave4Wood', ndW4Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave4Dark', ndW4Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave4Glow', ndW4Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave4Foliage', ndW4Foliage, folMat, false, false);
  // Wave 5 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave5Master', ndW5Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave5Marble', ndW5Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave5Gold', ndW5Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave5Wood', ndW5Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave5Dark', ndW5Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave5Glow', ndW5Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave5Foliage', ndW5Foliage, folMat, false, false);
  // Wave 6 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave6Master', ndW6Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave6Marble', ndW6Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave6Gold', ndW6Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave6Wood', ndW6Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave6Dark', ndW6Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave6Glow', ndW6Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave6Foliage', ndW6Foliage, folMat, false, false);
  // Wave 7 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave7Master', ndW7Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave7Marble', ndW7Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave7Gold', ndW7Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave7Wood', ndW7Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave7Dark', ndW7Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave7Glow', ndW7Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave7Foliage', ndW7Foliage, folMat, false, false);
  // Wave 8 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave8Master', ndW8Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave8Marble', ndW8Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave8Gold', ndW8Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave8Wood', ndW8Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave8Dark', ndW8Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave8Glow', ndW8Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave8Foliage', ndW8Foliage, folMat, false, false);
  // Wave 9 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave9Master', ndW9Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave9Marble', ndW9Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave9Gold', ndW9Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave9Wood', ndW9Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave9Dark', ndW9Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave9Glow', ndW9Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave9Foliage', ndW9Foliage, folMat, false, false);
  // Wave 10 merged meshes (castShadow = false, zero new materials!)
  addM('NotreDameWave10Master', ndW10Master, pack.saigonMasterAtlasMat, false, true);
  addM('NotreDameWave10Marble', ndW10Marble, ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  addM('NotreDameWave10Gold', ndW10Gold, ctx.materials.gold, false, false);
  addM('NotreDameWave10Wood', ndW10Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, false, true);
  addM('NotreDameWave10Dark', ndW10Dark, ctx.materials.darkVoid, false, true);
  addM('NotreDameWave10Glow', ndW10Glow, ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  addM('NotreDameWave10Foliage', ndW10Foliage, folMat, false, false);

  tagMotifIds(group, ['HV-H05', 'HV-I01', 'HV-I02']);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz + 6.0, r: 54.0 }, { x: cx, z: 144, r: 19.0 });
}
