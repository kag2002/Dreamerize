import * as THREE from 'three';
import {
  buildIndependencePalaceComplex,
  buildNotreDameSaigonComplex
} from './saigonHeritageBuilder';
import {
  buildBenThanhMarketComplex,
  buildCaiRangFloatingMarketComplex
} from './benThanhCaiRangBuilder';
import {
  VietnamBuilderContext,
  JunkBoatMotion,
  applyWorldBoxUV,
  createArchedWallGeometry,
  createBoatSaddleRoofGeometry,
  createChamTowerGeometry,
  createGothicSpireGeometry,
  createHueImperialHipRoofGeometry,
  createRoseWindowGeometry,
  createSculptedRockGeometry,
  createVietnameseCurvedRoofGeometry,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createLanternCapGeometry,
  createWarmLightPoolMaterial,
  createWavingSilkFlagMaterial,
  createBronzeIncenseTripodParts,
  createIncenseSmokeSystem,
  mergeNormalized,
  mulberry32,
  noise2D
} from './vietnamGeometryHelpers';
import {
  createSignagePlaqueMesh,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createSculptedDeityParts,
  createChamReliefTympanumParts,
  createHistoricalTankParts,
  createAngularTankParts,
  createUH1HelicopterParts,
  createMangroveTreeParts,
  createGuardianBeastParts,
  createSmoothTaperedTubeGeometry,
  createRealisticAncientBanyanParts,
  createMotifBandParts,
  createBasReliefPanelParts,
  createBambooBriseSoleilParts,
  createLouverShutterParts,
  createCuaVongParts,
  createAncientStoneLanternParts,
  createLotusPetalRingParts,
  createBoatEyeParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  colorizeGeometry,
  createMergedMesh,
  transformGeometryXYZ
} from '../vietnam/geometry/PartsBuilder';

/**
 * Translates and rotates (XYZ) a BufferGeometry in-place.
 */
function transformGeo(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  return transformGeometryXYZ(geo, x, y, z, rotY, rotX, rotZ);
}

function makeMergedMesh(
  name: string,
  parts: THREE.BufferGeometry[],
  material: THREE.Material,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  return createMergedMesh(name, parts, material, castShadow, receiveShadow);
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
  parts.push(transformGeometryXYZ(new THREE.BoxGeometry(w, h, d), x, y, z, rotY, rotX, rotZ));
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
  rotY = 0,
  rotX = 0,
  rotZ = 0
): void {
  parts.push(transformGeometryXYZ(new THREE.CylinderGeometry(rTop, rBot, h, segs), x, y, z, rotY, rotX, rotZ));
}

function addColoredBox(
  parts: THREE.BufferGeometry[],
  color: THREE.ColorRepresentation,
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
  transformGeo(b, x, y, z, rotY, rotX, rotZ);
  parts.push(colorizeGeometry(b, color));
}

function addColoredCylinder(
  parts: THREE.BufferGeometry[],
  color: THREE.ColorRepresentation,
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): void {
  const c = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  transformGeo(c, x, y, z, rotY, rotX, rotZ);
  parts.push(colorizeGeometry(c, color));
}

/**
 * Creates a pitched hipped roof prism (colonial French-Vietnamese style) using a tapered pyramid frustum.
 */
function createHippedRoofGeometry(
  baseW: number,
  baseD: number,
  topW: number,
  topD: number,
  height: number
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 4, 4);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i) * 2.0;
    const uz = pos.getZ(i) * 2.0;
    const radial = Math.max(Math.abs(ux), Math.abs(uz));
    const w = THREE.MathUtils.lerp(topWidthSafe(topW), baseW, radial);
    const d = THREE.MathUtils.lerp(topWidthSafe(topD), baseD, radial);
    pos.setXYZ(i, ux * w * 0.5, (1.0 - radial) * height, uz * d * 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

function topWidthSafe(v: number): number {
  return Math.max(0.05, v);
}

/**
 * Adds a circular colonial clock face with bezel, 12 hour markers, and 10:10 clock hands.
 * Normal faces +Z when rotY = 0, or -Z when rotY = Math.PI.
 */
function addClockDial(
  faceParts: THREE.BufferGeometry[],
  bezelParts: THREE.BufferGeometry[],
  handParts: THREE.BufferGeometry[],
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  rotY: number
): void {
  const face = new THREE.CylinderGeometry(radius, radius, 0.16, 28);
  face.rotateX(Math.PI * 0.5);
  face.rotateY(rotY);
  face.translate(cx, cy, cz);
  faceParts.push(face);

  const bezel = new THREE.TorusGeometry(radius * 1.03, Math.max(0.08, radius * 0.08), 10, 28);
  bezel.rotateY(rotY);
  bezel.translate(cx, cy, cz);
  bezelParts.push(bezel);

  const zOff = 0.11;
  const handLong = new THREE.BoxGeometry(radius * 0.075, radius * 0.72, 0.07);
  handLong.translate(0, radius * 0.30, zOff);
  handLong.rotateZ(-0.55);
  handLong.rotateY(rotY);
  handLong.translate(cx, cy, cz);
  handParts.push(handLong);

  const handShort = new THREE.BoxGeometry(radius * 0.09, radius * 0.50, 0.07);
  handShort.translate(0, radius * 0.20, zOff);
  handShort.rotateZ(0.85);
  handShort.rotateY(rotY);
  handShort.translate(cx, cy, cz);
  handParts.push(handShort);

  const hub = new THREE.CylinderGeometry(radius * 0.08, radius * 0.08, 0.09, 10);
  hub.rotateX(Math.PI * 0.5);
  hub.translate(0, 0, zOff);
  hub.rotateY(rotY);
  hub.translate(cx, cy, cz);
  bezelParts.push(hub);

  for (let h = 0; h < 12; h++) {
    const ang = (h / 12) * Math.PI * 2.0;
    const tick = new THREE.BoxGeometry(radius * 0.06, radius * 0.14, 0.05);
    tick.translate(0, radius * 0.82, zOff);
    tick.rotateZ(ang);
    tick.rotateY(rotY);
    tick.translate(cx, cy, cz);
    handParts.push(tick);
  }
}

function clampVal(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function addColoredSphere(
  parts: THREE.BufferGeometry[],
  color: THREE.ColorRepresentation,
  radius: number,
  wSeg: number,
  hSeg: number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1
): void {
  const g = new THREE.SphereGeometry(radius, wSeg, hSeg);
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  g.translate(x, y, z);
  parts.push(colorizeGeometry(g, color));
}

function addColoredCone(
  parts: THREE.BufferGeometry[],
  color: THREE.ColorRepresentation,
  radius: number,
  height: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): void {
  const g = new THREE.ConeGeometry(radius, height, segs);
  transformGeo(g, x, y, z, rotY, rotX, rotZ);
  parts.push(colorizeGeometry(g, color));
}

/**
 * Adds a French-colonial wrought-iron Parisian streetlamp (base pedestal, fluted shaft, ornate bracket, warm globe).
 */
function addHeritageStreetlampParts(
  ironParts: THREE.BufferGeometry[],
  glowParts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  height = 4.6,
  doubleGlobe = false
): void {
  addCyl(ironParts, 0.22, 0.30, 0.65, 8, x, y + 0.32, z);
  addCyl(ironParts, 0.08, 0.14, height - 0.8, 8, x, y + 0.65 + (height - 0.8) * 0.5, z);
  addCyl(ironParts, 0.16, 0.10, 0.22, 8, x, y + height - 0.15, z);
  if (doubleGlobe) {
    addBox(ironParts, 1.35, 0.08, 0.08, x, y + height - 0.12, z);
    for (const sx of [-0.62, 0.62]) {
      addCyl(ironParts, 0.12, 0.06, 0.16, 8, x + sx, y + height - 0.02, z);
      glowParts.push(new THREE.SphereGeometry(0.24, 9, 7).translate(x + sx, y + height + 0.20, z));
      addCyl(ironParts, 0.04, 0.16, 0.14, 8, x + sx, y + height + 0.44, z);
    }
  } else {
    glowParts.push(new THREE.SphereGeometry(0.26, 9, 7).translate(x, y + height + 0.14, z));
    addCyl(ironParts, 0.04, 0.18, 0.16, 8, x, y + height + 0.40, z);
  }
}

/**
 * Creates a shimmering animated water-jet ShaderMaterial for the Independence Palace fountain arcs.
 */
function createAnimatedFountainJetMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: { uTime: { value: number } };
} {
  const uniforms = { uTime: { value: 0.0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float flow = fract(vUv.x * 3.5 - uTime * 2.1);
        float streak = 0.58 + 0.42 * sin(flow * 6.28318);
        float edge = 1.0 - smoothstep(0.32, 0.5, abs(vUv.y - 0.5));
        vec3 col = mix(vec3(0.76, 0.93, 0.98), vec3(1.0, 1.0, 1.0), streak);
        float alpha = clamp(edge * (0.48 + 0.36 * streak), 0.15, 0.86);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  return { material, uniforms };
}

// ============================================================================
// 1. Chợ Bến Thành — TP. Hồ Chí Minh (-108, 190), facing north -Z
//    Expanded 98m × 66m cruciform open-portal market hall, 28.5m clock tower,
//    Biên Hòa ceramic reliefs, 24 bustling merchant stalls & heritage streetlamps
// ============================================================================
function buildIndependencePalace(ctx: VietnamBuilderContext): void {
  buildIndependencePalaceComplex(ctx);
}

function buildNotreDameSaigon(ctx: VietnamBuilderContext): void {
  buildNotreDameSaigonComplex(ctx);
}

// 4. Địa đạo Củ Chi & Đền Tưởng Niệm Bến Dược — TP. Hồ Chí Minh (-255, 270)
//    Authentic 0.55m trapdoors, 40m zigzag trench, cut-away command bunker,
//    wrecked M41 tank, Hoàng Cầm GPU smoke + cassava pot, 9-story 39m Bến Dược
//    octagonal tower with 4-sided stairs (Bug B16 fixed), Tam Quan & Memorial Hall
// ============================================================================
function buildCuChiTunnels(ctx: VietnamBuilderContext): void {
  const cx = -255;
  const cz = 270;
  const yCenter = ctx.getHeight(cx, cz);

  const group = new THREE.Group();
  group.name = 'CuChiTunnelsComplex';
  group.position.set(cx, yCenter, cz);

  const roofParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const creamParts: THREE.BufferGeometry[] = [];
  const ochrePierParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const natureParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const graniteParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const tankArmorParts: THREE.BufferGeometry[] = [];
  const tankDarkParts: THREE.BufferGeometry[] = [];

  const relY = (lx: number, lz: number) => ctx.getHeight(cx + lx, cz + lz) - yCenter;

  // 1. Authentic Flush 0.45m × 0.45m Secret Trapdoors (ref 67_ham_bi_mat_cu_chi_detail.jpg)
  // Removed tall red soil mounds; lids rest cleanly beside the flush ground openings with fixed rotateY/translate!
  const hatchCoords: Array<[number, number, number]> = [
    [-8.5, -9.0, 0.22],
    [1.5, -7.5, -0.35],
    [-3.5, -13.0, 0.08]
  ];
  const leafRand = mulberry32(67551);
  for (const [hx, hz, yaw] of hatchCoords) {
    const hy = relY(hx, hz);

    // FIX CC-04: Organic dry-leaf camouflage discs & fully flush sunken wooden collar (NO bright raised wood border — ref 67!)
    for (let lf = 0; lf < 14; lf++) {
      const la = leafRand() * Math.PI * 2;
      const lr = 0.24 + leafRand() * 0.82;
      const leafDisc = new THREE.CircleGeometry(0.11 + leafRand() * 0.08, 5);
      leafDisc.rotateX(-Math.PI * 0.5);
      leafDisc.rotateY(leafRand() * Math.PI);
      leafDisc.translate(hx + Math.cos(la) * lr, hy + 0.016 + (lf % 3) * 0.004, hz + Math.sin(la) * lr);
      natureParts.push(colorizeGeometry(leafDisc, lf % 2 === 0 ? '#5e4c28' : '#785e32'));
    }

    // Fully flush 0.45m × 0.45m timber collar sunken level with forest soil + dark drop shaft
    addBox(woodParts, 0.50, 0.06, 0.50, hx, hy - 0.015, hz, yaw);
    addBox(voidParts, 0.45, 0.52, 0.45, hx, hy - 0.22, hz, yaw);

    // Leaf-covered removable trapdoor lid resting flat/slightly tilted right beside the hole (fixed transform order!)
    const sideOff = 0.52;
    const lx = hx + Math.cos(yaw) * sideOff;
    const lz = hz - Math.sin(yaw) * sideOff;
    const lid = new THREE.BoxGeometry(0.47, 0.055, 0.47);
    lid.rotateX(0.08);
    lid.rotateY(yaw + 0.24);
    lid.translate(lx, hy + 0.05, lz);
    woodParts.push(lid);

    const leafCover = new THREE.BoxGeometry(0.49, 0.04, 0.49);
    leafCover.rotateX(0.08);
    leafCover.rotateY(yaw + 0.24);
    leafCover.translate(lx, hy + 0.095, lz);
    natureParts.push(colorizeGeometry(leafCover, '#6c5a30'));
  }

  // 1b. Iconic Varnished Wooden Củ Chi Welcome Board at Forest Entry (freestanding, NO fake roof cap — ref 31_dia_dao_cu_chi.jpg)
  const wbx = -3.0;
  const wbz = -22.2;
  const wby = relY(wbx, wbz);
  for (const sx of [-2.25, 2.25]) {
    addCyl(woodParts, 0.11, 0.13, 3.0, 7, wbx + sx, wby + 1.45, wbz);
  }
  const welcomeSign = createSignagePlaqueMesh(
    {
      text: 'Kính chào quý khách!',
      subText: 'WELCOME TO THE CU CHI TUNNELS!',
      style: 'cu_chi_welcome',
      width: 4.8,
      height: 1.72,
      depth: 0.18,
      motifSeed: 3101
    },
    ctx
  );
  welcomeSign.name = 'CuChiWelcomeBoard';
  // [091][092][098] Packed-laterite jungle footpaths, directional trail signposts & rest benches beside Welcome Board
  for (const [fx, fz, fw, fl, fyaw] of [
    [-3.0, -14.5, 1.8, 15.0, 0.0],
    [-11.0, -9.5, 1.6, 15.0, 1.15],
    [-16.5, 3.0, 1.6, 16.0, 0.35],
    [6.5, -13.5, 2.2, 22.0, 1.55]
  ]) {
    addColoredBox(natureParts, '#8f5232', fw, 0.06, fl, fx, relY(fx, fz) + 0.03, fz, fyaw);
  }
  for (const [sxP, szP] of [[-12.5, -12.0], [-4.5, 2.0], [5.5, -15.5]]) {
    const syP = relY(sxP, szP);
    addCyl(woodParts, 0.06, 0.07, 1.85, 6, sxP, syP + 0.92, szP);
    addBox(woodParts, 0.95, 0.24, 0.08, sxP + 0.25, syP + 1.65, szP, 0.25);
  }
  addBox(woodParts, 2.2, 0.42, 0.48, wbx + 4.2, wby + 0.22, wbz + 1.2);
  // [081][082] B-52 Bomb Craters (*Hố Bom*) & Cut-Away 3-Level Underground Tunnel Cross-Section Diorama
  for (const [crX, crZ, crR] of [[-26.0, 2.0, 3.2], [-14.0, 18.0, 2.8]]) {
    const crY = relY(crX, crZ);
    const rim = new THREE.TorusGeometry(crR, 0.48, 5, 12);
    rim.rotateX(Math.PI * 0.5);
    rim.translate(crX, crY + 0.12, crZ);
    natureParts.push(colorizeGeometry(rim, '#7c4528'));
    addColoredCylinder(natureParts, '#3a6658', crR * 0.85, crR * 0.85, 0.08, 10, crX, crY + 0.04, crZ);
  }
  const dioX = -3.5;
  const dioZ = -3.0;
  const dioY = relY(dioX, dioZ);
  addColoredBox(natureParts, '#7a4226', 4.6, 2.8, 1.4, dioX, dioY + 1.4, dioZ);
  for (let lv = 0; lv < 3; lv++) {
    addBox(voidParts, 3.6, 0.55, 0.85, dioX, dioY + 0.45 + lv * 0.85, dioZ - 0.35);
    addBox(woodParts, 3.8, 0.12, 1.0, dioX, dioY + 0.18 + lv * 0.85, dioZ - 0.3);
  }
  addCyl(woodParts, 0.08, 0.08, 3.2, 6, dioX + 1.6, dioY + 1.6, dioZ);

  // 2. Sculpted Organic Clay Termite-Mound Concealed Air Vents
  const ventCoords: Array<[number, number, number]> = [
    [-14.5, 1.5, 2.25],
    [4.5, -13.5, 2.05],
    [-4.5, 10.5, 2.3],
    [-20.0, -14.5, 2.15]
  ];
  for (let i = 0; i < ventCoords.length; i++) {
    const [vx, vz, vh] = ventCoords[i];
    const vy = relY(vx, vz);
    const baseMound = createSculptedRockGeometry(510 + i * 29, 0.95, vh * 0.42, 0.92, 2);
    baseMound.translate(vx, vy + vh * 0.32, vz);
    natureParts.push(colorizeGeometry(baseMound, '#a65d38'));
    const spireMound = createSculptedRockGeometry(610 + i * 23, 0.54, vh * 0.44, 0.50, 2);
    spireMound.translate(vx + 0.12, vy + vh * 0.72, vz - 0.08);
    natureParts.push(colorizeGeometry(spireMound, '#94502f'));
    const sideSpire = createSculptedRockGeometry(710 + i * 19, 0.44, vh * 0.30, 0.42, 1);
    sideSpire.translate(vx + 0.55, vy + vh * 0.26, vz + 0.38);
    natureParts.push(colorizeGeometry(sideSpire, '#884728'));
    addBox(voidParts, 0.22, 0.26, 0.28, vx - 0.52, vy + 0.32, vz - 0.42, 0.5);
  }

  // 3. 40m Sunken Zigzag Earthen Communication Trench (spanning west jungle sector)
  const trenchPts: Array<[number, number]> = [
    [-31.0, -17.0],
    [-23.5, -12.5],
    [-16.0, -17.5],
    [-8.0, -13.0],
    [-1.0, -17.5],
    [5.5, -13.5]
  ];
  for (let i = 0; i < trenchPts.length - 1; i++) {
    const [x0, z0] = trenchPts[i];
    const [x1, z1] = trenchPts[i + 1];
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const my = relY(mx, mz);
    const segLen = Math.hypot(x1 - x0, z1 - z0) + 0.45;
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    // Dark recessed laterite trench channel floor + duckboards
    addColoredBox(natureParts, '#593320', 1.35, 0.14, segLen, mx, my + 0.04, mz, yaw);
    // Raised flanking earthen laterite parapet berms & timber revetment logs
    for (const side of [-1, 1]) {
      const ox = Math.cos(yaw) * side * 1.15;
      const oz = -Math.sin(yaw) * side * 1.15;
      addColoredBox(natureParts, '#9c5634', 1.05, 0.78, segLen, mx + ox, my + 0.36, mz + oz, yaw);
      addBox(woodParts, 0.14, 0.65, segLen * 0.96, mx + ox * 0.62, my + 0.32, mz + oz * 0.62, yaw);
    }
  }

  // [087][097] Overhead bamboo camouflage netting & sandbagged trench corner nest
  for (let i = 0; i < trenchPts.length - 1; i += 2) {
    const [x0, z0] = trenchPts[i];
    const [x1, z1] = trenchPts[i + 1];
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const my = relY(mx, mz);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    addColoredBox(natureParts, '#4b722c', 2.4, 0.08, 3.2, mx, my + 0.85, mz, yaw);
  }
  addColoredBox(natureParts, '#bda878', 1.8, 0.55, 1.8, -23.5, relY(-23.5, -12.5) + 0.42, -12.5);

  // 4. Cut-Away Walk-In Underground Command Bunker at (-18.5, -5.0) with Timber/Sandbag Roof
  const bkx = -18.5;
  const bkz = -5.0;
  const bky = relY(bkx, bkz);
  // Excavated earth side walls (front -Z left cut-away open so visitors can see inside!)
  addColoredBox(natureParts, '#7a4226', 6.8, 0.24, 5.4, bkx, bky + 0.08, bkz); // packed-earth floor
  addColoredBox(natureParts, '#8f4f2f', 6.8, 2.3, 0.75, bkx, bky + 1.15, bkz + 2.45); // rear wall
  for (const sx of [-1, 1]) {
    addColoredBox(natureParts, '#8f4f2f', 0.75, 2.3, 5.2, bkx + sx * 3.15, bky + 1.15, bkz);
    for (let p = -2; p <= 2; p++) {
      addCyl(woodParts, 0.12, 0.14, 2.35, 7, bkx + sx * 2.65, bky + 1.18, bkz + p * 1.05);
    }
  }
  // Heavy log timber roof beams + stacked burlap sandbags + camouflaged earth mound atop bunker
  for (let lg = -3; lg <= 3; lg++) {
    addCyl(woodParts, 0.16, 0.16, 5.8, 7, bkx + lg * 0.95, bky + 2.42, bkz, 0, Math.PI * 0.5, 0);
  }
  for (let row = 0; row < 2; row++) {
    for (let sb = -3; sb <= 3; sb++) {
      addColoredBox(natureParts, '#bda878', 0.84, 0.28, 0.52, bkx + sb * 0.88, bky + 2.68 + row * 0.26, bkz - 2.35);
    }
  }
  const bunkerMound = createSculptedRockGeometry(412, 3.8, 0.72, 2.9, 2);
  bunkerMound.translate(bkx, bky + 2.92, bkz + 0.25);
  natureParts.push(colorizeGeometry(bunkerMound, '#4e752c'));
  // Command map table, field benches & campaign map inside cut-away bunker
  addBox(woodParts, 2.6, 0.14, 1.4, bkx, bky + 0.92, bkz + 0.2);
  addColoredBox(natureParts, '#e5d8b2', 1.85, 0.04, 1.05, bkx, bky + 1.01, bkz + 0.2);
  addBox(woodParts, 2.4, 0.45, 0.42, bkx, bky + 0.34, bkz + 1.25);

  // [086] Wrecked M41 Walker Bulldog Tank with road-wheels & muzzle brake at (-23.0, +11.5)
  const tkx = -23.0;
  const tkz = 11.5;
  const tky = relY(tkx, tkz);
  const { armorParts: m41Armor, darkParts: m41Dark } = createAngularTankParts(tkx, tky - 0.12, tkz, 0.72, 0.92, 0.12);
  tankArmorParts.push(...m41Armor);
  tankDarkParts.push(...m41Dark);
  for (let rw = -2; rw <= 2; rw++) {
    for (const side of [-1.05, 1.05]) {
      addCyl(tankDarkParts, 0.28, 0.28, 0.22, 8, tkx + side, tky + 0.28, tkz + rw * 0.72, 0, 0, Math.PI * 0.5);
    }
  }

  // [083][085] Guerrilla Weapon-Making Workshop & Additional Booby-Trap Exhibits at (-7.5, +15.0)
  const wmx = -15.5;
  const wmz = 15.5;
  const wmy = relY(wmx, wmz);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(woodParts, 0.09, 0.11, 2.8, 6, wmx + ox, wmy + 1.4, wmz + oz);
    }
  }
  const wmRoof = createHippedRoofGeometry(4.4, 3.8, 0.2, 2.8, 1.45);
  wmRoof.translate(wmx, wmy + 2.8, wmz);
  natureParts.push(colorizeGeometry(wmRoof, '#b88c4a'));
  addBox(tankDarkParts, 0.65, 0.55, 0.35, wmx - 0.4, wmy + 0.45, wmz);
  addBox(woodParts, 1.2, 0.14, 0.8, wmx + 0.6, wmy + 0.75, wmz);
  // 2 additional booby-trap frames (hầm chông xoay & chông cầu)
  addBox(woodParts, 1.4, 0.18, 1.4, -3.5, relY(-3.5, 15.0) + 0.12, 15.0);
  addColoredSphere(natureParts, '#8f6b3e', 0.32, 6, 5, -3.5, relY(-3.5, 15.0) + 0.45, 15.0);

  // 6. Booby-Trap Exhibit Shelter at (-7.5, +15.0)
  const btx = -7.5;
  const btz = 15.0;
  const bty = relY(btx, btz);
  for (const px of [-2.0, 2.0]) {
    for (const pz of [-1.6, 1.6]) {
      addCyl(woodParts, 0.10, 0.12, 3.2, 7, btx + px, bty + 1.4, btz + pz);
    }
  }
  const btRoof = createHippedRoofGeometry(5.2, 4.4, 0.2, 3.6, 1.65);
  btRoof.translate(btx, bty + 2.95, btz);
  natureParts.push(colorizeGeometry(btRoof, '#b88c4a'));
  // Display trap pit frame with bamboo spikes
  addBox(woodParts, 2.4, 0.22, 1.8, btx, bty + 0.15, btz);
  addBox(voidParts, 1.9, 0.35, 1.3, btx, bty + 0.10, btz);
  for (let sp = -3; sp <= 3; sp++) {
    addColoredCone(natureParts, '#cbb16a', 0.05, 0.55, 5, btx + sp * 0.24, bty + 0.32, btz - 0.25);
    addColoredCone(natureParts, '#cbb16a', 0.05, 0.55, 5, btx + sp * 0.24, bty + 0.32, btz + 0.25);
  }

  // 7. Timber Thatched Hoàng Cầm Field Hearth Pavilion + Steaming Cassava Pot + GPU Ground-Hugging Smoke!
  const sx = -10.5;
  const sz = 4.5;
  const sy = relY(sx, sz);
  for (const px of [-2.6, 0, 2.6]) {
    for (const pz of [-2.1, 2.1]) {
      const post = new THREE.CylinderGeometry(0.13, 0.16, 4.4, 8);
      post.translate(sx + px, sy + 1.1, sz + pz);
      woodParts.push(post);
    }
  }
  // Timber field table with steamed golden cassava (*khoai mì*) platter, sesame-salt bowl & green-tea kettle
  addBox(woodParts, 2.8, 0.14, 1.4, sx - 0.8, sy + 0.88, sz);
  addBox(woodParts, 0.14, 0.88, 1.1, sx - 1.9, sy + 0.44, sz);
  addBox(woodParts, 0.14, 0.88, 1.1, sx + 0.3, sy + 0.44, sz);
  addColoredCylinder(natureParts, '#c49d56', 0.46, 0.42, 0.08, 10, sx - 0.9, sy + 0.98, sz);
  for (let cv = -1; cv <= 1; cv++) {
    addColoredCylinder(natureParts, '#f0d878', 0.08, 0.09, 0.34, 7, sx - 0.9 + cv * 0.16, sy + 1.07, sz, 0.4, 0, Math.PI * 0.5);
  }
  addColoredCylinder(natureParts, '#3a6e4c', 0.14, 0.18, 0.26, 8, sx - 0.1, sy + 1.06, sz - 0.2);

  // Earthen Hoàng Cầm smoke-diffusing stove hearth + steaming cassava pot + underground flue vent pipes
  const stove = new THREE.BoxGeometry(1.45, 0.88, 1.45);
  stove.translate(sx + 1.6, sy + 0.36, sz + 0.4);
  natureParts.push(colorizeGeometry(stove, '#8f5233'));
  // Steaming iron cassava pot resting atop stove
  addColoredCylinder(natureParts, '#3a3d42', 0.38, 0.34, 0.42, 12, sx + 1.6, sy + 0.98, sz + 0.4);
  addColoredCylinder(natureParts, '#c2c7cc', 0.34, 0.36, 0.08, 12, sx + 1.6, sy + 1.22, sz + 0.4);
  // [084] Horizontal Hoàng Cầm smoke-dispersing earthen flues + clay water jar (*lu nước*) & firewood stack
  addColoredCylinder(natureParts, '#7a6345', 0.11, 0.11, 3.2, 7, sx + 3.4, sy + 0.16, sz + 0.4, 0, 0, Math.PI * 0.5);
  addColoredCylinder(natureParts, '#7a6345', 0.11, 0.11, 2.6, 7, sx + 2.8, sy + 0.16, sz - 0.9, 0.55, 0, Math.PI * 0.5);
  addColoredCylinder(natureParts, '#9a5232', 0.34, 0.24, 0.65, 8, sx + 1.8, sy + 0.34, sz - 1.3);
  addBox(woodParts, 0.85, 0.36, 0.55, sx + 0.4, sy + 0.20, sz + 1.4);

  const thatchRoof = createHippedRoofGeometry(6.8, 5.8, 0.2, 5.0, 2.2);
  thatchRoof.translate(sx, sy + 3.15, sz);
  natureParts.push(colorizeGeometry(thatchRoof, '#b88c4a'));

  // 8. Authentic Non-Tapering SQUARE 9-Story Bến Dược Commemorative Tower (~39.2m tall — ref 97_den_ben_duoc_cu_chi.jpg)
  //    2-story square cream base pavilion + 4 continuous massive ochre-brown corner piers running straight up all 9 floors
  //    + 7 projecting chamfered white concrete balconies with red terracotta skirts & green glazed trim
  //    + 2-tier square top roof with pale-blue lotus mosaic gables + pair of monumental dragon-coiled gate pillars!
  const bx = 18.0;
  const bz = 10.0;
  const by = relY(bx, bz);

  // FIX CC-05: Monumental 28m × 28m Two-Tone Alternating Light/Dark Grey Granite Checkerboard Plaza surrounding Bến Dược Tower (ref 97!)
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const isDark = (gx + gz) % 2 === 0;
      addColoredBox(
        natureParts,
        isDark ? '#70757a' : '#b8bcb9',
        3.94,
        0.16,
        3.94,
        bx + gx * 4.0,
        by + 0.04,
        bz + gz * 4.0
      );
    }
  }
  // Two-tier square granite plinth (grounded deep into soil up to +1.8m)
  addBox(graniteParts, 16.4, 2.2, 16.4, bx, by + 0.1, bz);
  addBox(graniteParts, 13.8, 0.85, 13.8, bx, by + 1.42, bz);

  // 4-Sided Granite Approach Stairs (N/S/E/W) climbing onto the 1.8m memorial plinth
  for (let dir = 0; dir < 4; dir++) {
    const a = (dir / 4) * Math.PI * 2;
    for (let st = 0; st < 6; st++) {
      const dist = 10.6 - st * 0.58;
      const stepH = 0.30 * (st + 1);
      const sxp = bx + Math.sin(a) * dist;
      const szp = bz + Math.cos(a) * dist;
      addBox(graniteParts, 3.8, stepH, 0.68, sxp, by + stepH * 0.5, szp, a);
    }
    for (const side of [-2.05, 2.05]) {
      const chDist = 9.15;
      const chX = bx + Math.sin(a) * chDist + Math.cos(a) * side;
      const chZ = bz + Math.cos(a) * chDist - Math.sin(a) * side;
      addBox(graniteParts, 0.34, 1.35, 3.8, chX, by + 0.92, chZ, a, 0.28, 0);
    }
  }

  // FIX CC-03: Monumental Ceramic Dragon Pillars tucked TIGHT against the 2 front base pavilion corners (bx ± 5.25, bz - 5.15) with arching dragons curving inward toward the tower axis (ref 97!)
  for (const side of [-1, 1]) {
    const px = bx + side * 5.25;
    const pz = bz - 5.15;
    const py = relY(px, pz);
    addBox(graniteParts, 1.55, 1.55, 1.55, px, py + 0.78, pz);
    addCyl(ochrePierParts, 0.44, 0.50, 7.6, 8, px, py + 5.25, pz);
    addBox(creamParts, 1.25, 0.48, 1.25, px, py + 9.25, pz);
    // Helical polychrome ceramic dragon coiling up corner pillar then arching gracefully INWARD toward tower axis!
    const coilPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const ang = t * Math.PI * 3.8 + (side > 0 ? 0 : Math.PI);
      coilPts.push(new THREE.Vector3(px + Math.cos(ang) * 0.54, py + 2.0 + t * 6.4, pz + Math.sin(ang) * 0.54));
    }
    // Arching dragon body sweeping inward toward tower center (y = 9.0 -> 12.6m)
    coilPts.push(
      new THREE.Vector3(bx + side * 4.1, py + 10.6, pz - 0.35),
      new THREE.Vector3(bx + side * 2.4, py + 12.1, pz - 0.45),
      new THREE.Vector3(bx + side * 1.15, py + 11.7, pz - 0.45)
    );
    const dragonTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 28, 0.16, 6, false);
    natureParts.push(colorizeGeometry(dragonTube, '#b8482c'));
    // Dragon head crest facing central tower axis + lotus crown finial
    addColoredSphere(natureParts, '#d9a438', 0.34, 7, 5, bx + side * 0.95, py + 11.7, pz - 0.48);
    addCyl(goldParts, 0.12, 0.34, 0.75, 8, px, py + 9.85, pz);
  }

  // Floors 1–2: Square 2-Story Cream Base Pavilion (10.6m × 10.6m, y = 1.8 .. 9.0m)
  const basePavY0 = by + 1.82;
  addBox(creamParts, 10.4, 3.6, 10.4, bx, basePavY0 + 1.8, bz);
  addBox(voidParts, 3.8, 2.9, 10.65, bx, basePavY0 + 1.45, bz);
  addBox(voidParts, 10.65, 2.9, 3.8, bx, basePavY0 + 1.45, bz);
  const baseRoof1 = createVietnameseCurvedRoofGeometry(13.2, 13.2, 9.8, 9.8, 1.35, 0.32);
  baseRoof1.translate(bx, basePavY0 + 3.55, bz);
  roofParts.push(baseRoof1);
  addColoredBox(natureParts, '#1f7a5c', 13.3, 0.14, 13.3, bx, basePavY0 + 3.52, bz);

  addBox(creamParts, 9.2, 3.4, 9.2, bx, basePavY0 + 5.5, bz);
  addBox(voidParts, 3.2, 2.4, 9.45, bx, basePavY0 + 5.45, bz);
  addBox(voidParts, 9.45, 2.4, 3.2, bx, basePavY0 + 5.45, bz);
  const baseRoof2 = createVietnameseCurvedRoofGeometry(11.8, 11.8, 8.2, 8.2, 1.25, 0.28);
  baseRoof2.translate(bx, basePavY0 + 7.15, bz);
  roofParts.push(baseRoof2);
  addColoredBox(natureParts, '#1f7a5c', 11.9, 0.14, 11.9, bx, basePavY0 + 7.12, bz);

  // Floors 3–9: NON-TAPERING SQUARE Tower Shaft (7.4m × 7.4m, y = 9.0 .. 31.4m)
  const shaftY0 = basePavY0 + 7.2;
  const numBalconyFloors = 7;
  const floorH = 3.18;
  const shaftTotalH = numBalconyFloors * floorH;

  // 4 Continuous Massive Ochre-Brown Corner Piers running straight up ALL 9 floors!
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(
        ochrePierParts,
        1.18,
        shaftTotalH + 7.4,
        1.18,
        bx + sx * 3.45,
        basePavY0 + (shaftTotalH + 7.4) * 0.5,
        bz + sz * 3.45
      );
    }
  }
  // Core white/cream plastered non-tapering square shaft inside the 4 ochre piers
  addBox(creamParts, 6.7, shaftTotalH, 6.7, bx, shaftY0 + shaftTotalH * 0.5, bz);

  // 7 Projecting Chamfered White Concrete Balconies skirted with Red Terracotta Tiles & Green Glazed Trim!
  for (let f = 0; f < numBalconyFloors; f++) {
    const fy = shaftY0 + f * floorH;
    // [088] Recessed dark doorway/window openings on all 4 faces + window lattice & eaves brackets
    addBox(voidParts, 2.6, 2.05, 6.95, bx, fy + 1.45, bz);
    addBox(voidParts, 6.95, 2.05, 2.6, bx, fy + 1.45, bz);
    addBox(goldParts, 2.2, 0.14, 7.02, bx, fy + 1.45, bz);
    addBox(goldParts, 7.02, 0.14, 2.2, bx, fy + 1.45, bz);

    // Projecting chamfered white concrete balcony slab & balustrade parapet
    const balcSlab = new THREE.CylinderGeometry(5.65, 5.65, 0.28, 8);
    balcSlab.rotateY(Math.PI / 8);
    balcSlab.translate(bx, fy + 0.14, bz);
    creamParts.push(balcSlab);

    for (const side of [-1, 1]) {
      addBox(creamParts, 7.6, 0.82, 0.22, bx, fy + 0.65, bz + side * 4.55);
      addBox(creamParts, 0.22, 0.82, 7.6, bx + side * 4.55, fy + 0.65, bz);
    }

    // Red terracotta tile skirt awning + green glazed ceramic trim band at every tier!
    const tierSkirt = createVietnameseCurvedRoofGeometry(9.8, 9.8, 7.2, 7.2, 0.92, 0.22);
    tierSkirt.translate(bx, fy + floorH - 0.55, bz);
    roofParts.push(tierSkirt);
    addColoredBox(natureParts, '#1f7a5c', 9.9, 0.12, 9.9, bx, fy + floorH - 0.58, bz);
  }

  // 2-Tier Square Top Roof Crown (y = 31.4 .. 39.2m) with Pale-Blue Lotus Mosaic Gables!
  const crownY0 = shaftY0 + shaftTotalH;
  const topRoof1 = createVietnameseCurvedRoofGeometry(11.4, 11.4, 7.0, 7.0, 2.35, 0.44);
  topRoof1.translate(bx, crownY0 - 0.15, bz);
  roofParts.push(topRoof1);
  addColoredBox(natureParts, '#1f7a5c', 11.5, 0.16, 11.5, bx, crownY0 - 0.18, bz);

  // Upper Lantern Pavilion & 4 Pale-Blue Lotus Mosaic Triangular Gables
  addBox(creamParts, 6.2, 2.15, 6.2, bx, crownY0 + 2.95, bz);
  for (let face = 0; face < 4; face++) {
    const rot = (face / 4) * Math.PI * 2;
    const gTri = new THREE.ConeGeometry(2.35, 1.95, 3);
    gTri.scale(1.0, 1.0, 0.14);
    gTri.translate(0, crownY0 + 3.05, 3.22);
    gTri.rotateY(rot);
    gTri.translate(bx, 0, bz);
    natureParts.push(colorizeGeometry(gTri, '#72b6de'));
    // Pink sculpted lotus bloom medallion centered inside each pale-blue mosaic gable
    const lBloom = new THREE.SphereGeometry(0.46, 8, 6);
    lBloom.scale(1.0, 0.85, 0.35);
    lBloom.translate(0, crownY0 + 2.85, 3.36);
    lBloom.rotateY(rot);
    lBloom.translate(bx, 0, bz);
    natureParts.push(colorizeGeometry(lBloom, '#e87ca0'));
  }

  const topRoof2 = createVietnameseCurvedRoofGeometry(7.8, 7.8, 0.65, 0.65, 2.65, 0.42);
  topRoof2.translate(bx, crownY0 + 3.95, bz);
  roofParts.push(topRoof2);
  addColoredBox(natureParts, '#1f7a5c', 7.9, 0.14, 7.9, bx, crownY0 + 3.92, bz);

  // Gilded Lotus Finial Spire crowning the 9-story square Bến Dược tower at ~39.2m!
  const finialY = crownY0 + 6.55;
  addCyl(goldParts, 0.18, 0.42, 0.85, 8, bx, finialY + 0.42, bz);
  addCyl(goldParts, 0.04, 0.18, 2.1, 8, bx, finialY + 1.85, bz);
  const towerOrb = new THREE.SphereGeometry(0.28, 10, 8);
  towerOrb.translate(bx, finialY + 1.0, bz);
  goldParts.push(towerOrb);

  // 9. Cổng Tam Quan Bến Dược (3-Bay Memorial Entrance Gate at (18.0, -14.0))
  const tqx = 18.0;
  const tqz = -14.0;
  const tqy = relY(tqx, tqz);
  addBox(graniteParts, 15.2, 0.8, 3.6, tqx, tqy + 0.2, tqz);
  const gateCols = [-6.4, -2.4, 2.4, 6.4];
  for (const gx of gateCols) {
    const isCenter = Math.abs(gx) < 3.0;
    const h = isCenter ? 6.4 : 4.6;
    addBox(graniteParts, 0.95, 0.6, 0.95, tqx + gx, tqy + 0.75, tqz);
    addCyl(crimsonParts, 0.28, 0.34, h, 10, tqx + gx, tqy + 0.8 + h * 0.5, tqz);
  }
  // Central & flanking curved terracotta roofs on Tam Quan
  const tqCenterRoof = createVietnameseCurvedRoofGeometry(7.2, 4.2, 2.2, 0.6, 2.4, 0.45);
  tqCenterRoof.translate(tqx, tqy + 7.1, tqz);
  roofParts.push(tqCenterRoof);
  for (const side of [-1, 1]) {
    const sideRoof = createVietnameseCurvedRoofGeometry(5.0, 3.6, 1.4, 0.5, 1.8, 0.35);
    sideRoof.translate(tqx + side * 4.5, tqy + 5.3, tqz);
    roofParts.push(sideRoof);
  }
  const tqPlaque = createSignagePlaqueMesh(
    {
      text: 'ĐỀN BẾN DƯỢC',
      subText: 'CỦ CHI ĐẤT THÉP',
      style: 'royal',
      width: 4.2,
      height: 0.95,
      depth: 0.16,
      motifSeed: 1995
    },
    ctx
  );
  tqPlaque.name = 'CuChiBenDuocGatePlaque';
  tqPlaque.position.set(tqx, tqy + 6.25, tqz - 0.45);
  tqPlaque.rotation.y = Math.PI;
  group.add(tqPlaque);

  // 10. Main Bến Dược Memorial Temple Hall (*Đền Tưởng Niệm*) at (18.0, +28.5)
  const mhx = 18.0;
  const mhz = 28.5;
  const mhy = relY(mhx, mhz);
  addBox(graniteParts, 20.4, 1.6, 13.6, mhx, mhy + 0.2, mhz);
  for (let st = 0; st < 4; st++) {
    addBox(graniteParts, 6.2, 0.28 * (st + 1), 0.75, mhx, mhy + 0.14 * (st + 1), mhz - 7.8 + st * 0.68);
  }
  for (let i = -3; i <= 3; i++) {
    addCyl(crimsonParts, 0.24, 0.28, 5.2, 8, mhx + i * 2.8, mhy + 3.6, mhz - 5.2);
    addCyl(crimsonParts, 0.24, 0.28, 5.2, 8, mhx + i * 2.8, mhy + 3.6, mhz + 5.2);
  }
  addBox(crimsonParts, 16.4, 4.8, 7.6, mhx, mhy + 3.4, mhz + 1.0);
  addBox(goldParts, 4.4, 1.4, 0.35, mhx, mhy + 2.6, mhz - 2.95);
  const hallRoof1 = createVietnameseCurvedRoofGeometry(21.6, 14.4, 14.2, 7.4, 3.2, 0.58);
  hallRoof1.translate(mhx, mhy + 6.1, mhz);
  const hallRoof2 = createHueImperialHipRoofGeometry(14.8, 7.8, 8.0, 0.8, 2.8, 0.45);
  hallRoof2.translate(mhx, mhy + 9.2, mhz);
  roofParts.push(hallRoof1, hallRoof2);
  const hallFinials = createRoofFinialSetParts(mhx, mhy + 11.98, mhz, 8.0, 0, 1.05, true);
  crimsonParts.push(...hallFinials.mainParts);
  goldParts.push(...hallFinials.goldParts);

  // [093][094][095][099][100] Twin Granite Flagpoles, Trống Đồng Pedestals, Stele Pavilion & Plaza Benches
  for (const side of [-1, 1]) {
    addBox(graniteParts, 1.2, 0.65, 1.2, bx + side * 12.0, by + 0.32, bz - 12.0);
    addCyl(goldParts, 0.06, 0.09, 10.5, 6, bx + side * 12.0, by + 5.8, bz - 12.0);
    addBox(graniteParts, 2.2, 0.45, 0.55, bx + side * 10.5, by + 0.26, bz);
    addCyl(bronzeParts, 0.55, 0.55, 0.58, 10, bx + side * 11.5, by + 0.68, bz + 8.0);
  }
  // Nhà Bia Ghi Danh Liệt Sĩ (Martyrs' Stele Pavilion) west of Memorial Hall
  const stX = bx - 14.5;
  const stZ = mhz - 6.0;
  const stY = relY(stX, stZ);
  addBox(graniteParts, 4.4, 0.5, 4.4, stX, stY + 0.25, stZ);
  for (const px of [-1.6, 1.6]) {
    for (const pz of [-1.6, 1.6]) {
      addCyl(crimsonParts, 0.14, 0.16, 3.2, 7, stX + px, stY + 1.85, stZ + pz);
    }
  }
  const stRoof = createVietnameseCurvedRoofGeometry(5.6, 5.6, 0.6, 0.6, 1.75, 0.32);
  stRoof.translate(stX, stY + 3.45, stZ);
  roofParts.push(stRoof);
  addBox(voidParts, 1.2, 1.8, 0.24, stX, stY + 1.35, stZ);

  // [089] Interior Wooden Altar Table & Golden Hoành Phi inside Memorial Hall
  addBox(woodParts, 4.6, 1.15, 1.25, mhx, mhy + 1.55, mhz - 2.4);
  addBox(goldParts, 3.2, 0.68, 0.14, mhx, mhy + 4.4, mhz - 2.8);

  // [096] Tropical understory ferns & wild banana palms around Củ Chi perimeter
  for (let f = 0; f < 16; f++) {
    const fa = (f / 16) * Math.PI * 2;
    const fx = Math.cos(fa) * 28.0 - 4.0;
    const fz = Math.sin(fa) * 24.0;
    if (fx > 4.0 && fz > -20.0 && fz < 38.0) continue;
    addColoredSphere(natureParts, '#3a7a28', 0.85, 5, 4, fx, relY(fx, fz) + 0.35, fz, 1.3, 0.5, 1.3);
  }

  // Bronze incense tripod in front of Bến Dược Memorial Hall
  const hallUrn = createBronzeIncenseTripodParts(mhx, mhy + 0.1, mhz - 10.6, 1.25);
  graniteParts.push(...hallUrn.limestoneParts);
  bronzeParts.push(...hallUrn.bronzeParts);
  goldParts.push(...hallUrn.goldParts);

  // GPU Rising Thin Ground-Hugging Hoàng Cầm Smoke Wisps + Cassava Steam + Memorial Hall Incense Smoke!
  // Note: createIncenseSmokeSystem uses world coordinates directly!
  const cuChiSmoke = createIncenseSmokeSystem(
    [
      { x: cx + sx + 4.9, y: yCenter + sy + 0.22, z: cz + sz + 0.4, scale: 0.52 },
      { x: cx + sx + 3.9, y: yCenter + sy + 0.22, z: cz + sz - 1.5, scale: 0.46 },
      { x: cx + sx + 1.6, y: yCenter + sy + 1.32, z: cz + sz + 0.4, scale: 0.34 },
      { x: cx + mhx, y: yCenter + hallUrn.smokeY, z: cz + mhz - 10.6, scale: 0.92 }
    ],
    ctx.sharedShaders?.incenseSmoke
  );
  cuChiSmoke.mesh.name = 'CuChiHoangCamAndIncenseSmoke';
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(cuChiSmoke.mesh.material as THREE.Material);
    ctx.animatedUniforms?.push(cuChiSmoke.uniforms);
  }
  ctx.scene.add(cuChiSmoke.mesh);

  // 11. Lush Perimeter Bamboo Grove with Feathery Drooping Bamboo Foliage Clusters (replacing solid cones!)
  const rand = mulberry32(44091);
  for (let b = 0; b < 78; b++) {
    const ang = THREE.MathUtils.lerp(-0.18 * Math.PI, 1.18 * Math.PI, b / 77);
    const rad = 32.0 + (b % 4) * 3.0 + rand() * 2.5;
    const tx = Math.cos(ang) * rad - 4.0;
    const tz = Math.sin(ang) * rad + 4.0;
    // Keep memorial plaza clear
    if (tx > 4.0 && tz > -20.0 && tz < 38.0) continue;
    const ty = relY(tx, tz);
    const h = 9.0 + rand() * 4.8;
    const leanX = (rand() - 0.5) * 0.18;
    const leanZ = (rand() - 0.5) * 0.18;

    addColoredCylinder(
      natureParts,
      b % 2 === 0 ? '#5b8f38' : '#4a7b2c',
      0.08,
      0.13,
      h,
      6,
      tx,
      ty + h * 0.45,
      tz,
      0,
      leanX,
      leanZ
    );

    // Feathery crossed drooping bamboo foliage blades at upper culm nodes
    const tipX = tx + leanX * h * 0.55;
    const tipZ = tz + leanZ * h * 0.55;
    for (let l = 0; l < 5; l++) {
      const la = (l / 5) * Math.PI * 2 + rand() * 0.5;
      const ly = ty + h - 0.4 - (l % 3) * 0.95;
      const blade = new THREE.BoxGeometry(0.42, 0.06, 2.35);
      blade.rotateX(0.45);
      blade.rotateY(la);
      blade.translate(tipX + Math.sin(la) * 0.95, ly, tipZ + Math.cos(la) * 0.95);
      natureParts.push(colorizeGeometry(blade, l % 2 === 0 ? '#3f7a2a' : '#589438'));
    }
  }

  const cuChiNatureMat =
    ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.84, metalness: 0.02 }) ??
    ctx.materials.stone;
  const m41RustedMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#52573d', roughness: 0.78, metalness: 0.24 }) ??
    ctx.materials.bronze;
  const m41CharredMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#242628', roughness: 0.42, metalness: 0.74 }) ??
    ctx.materials.darkWood;

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (281–300) — Low-Poly, castShadow=false
  // ==========================================================================
  const ccW2Roof: THREE.BufferGeometry[] = [];
  const ccW2Crimson: THREE.BufferGeometry[] = [];
  const ccW2Wood: THREE.BufferGeometry[] = [];
  const ccW2Nature: THREE.BufferGeometry[] = [];
  const ccW2Granite: THREE.BufferGeometry[] = [];
  const ccW2Bronze: THREE.BufferGeometry[] = [];
  const ccW2Gold: THREE.BufferGeometry[] = [];

  // [281] Hoàng Cầm Kitchen subterranean smoke-diffusing vent mound & bamboo-slat leaf filter screen
  addColoredCylinder(ccW2Nature, '#7d4d2c', 0.48, 0.85, 0.55, 6, sx + 5.0, relY(sx + 5.0, sz + 0.4) + 0.25, sz + 0.4);
  addBox(ccW2Wood, 0.95, 0.08, 0.95, sx + 5.0, relY(sx + 5.0, sz + 0.4) + 0.56, sz + 0.4);
  // [282] Củ Chi Historical Shooting Range (Trường Bắn Củ Chi) earthen safety berm, backstop posts, firing parapet & targets (far west edge)
  const srX = -32.0;
  const srZ = 6.0;
  const srY = relY(srX, srZ);
  addColoredBox(ccW2Nature, '#8c4c2b', 2.4, 2.2, 11.0, srX - 3.2, srY + 1.1, srZ);
  addColoredBox(ccW2Nature, '#bda878', 1.1, 0.85, 9.5, srX + 3.2, srY + 0.42, srZ);
  for (const tz of [-3.2, 0.0, 3.2]) {
    addCyl(ccW2Wood, 0.06, 0.07, 1.8, 5, srX - 1.6, srY + 0.9, srZ + tz);
    addColoredBox(ccW2Nature, '#e6dcc2', 0.08, 0.95, 0.72, srX - 1.52, srY + 1.25, srZ + tz);
  }
  // [283][284] Bến Dược Memorial Bronze Bell Pavilion (Lầu Chuông, East) & Drum Pavilion (Lầu Trống, West)
  for (const side of [-1, 1]) {
    const pvX = mhx + side * 14.5;
    const pvZ = mhz - 12.5;
    const pvY = relY(pvX, pvZ);
    addBox(ccW2Granite, 4.8, 0.55, 4.8, pvX, pvY + 0.28, pvZ);
    for (const ox of [-1.8, 1.8]) {
      for (const oz of [-1.8, 1.8]) {
        addCyl(ccW2Crimson, 0.14, 0.16, 3.6, 6, pvX + ox, pvY + 2.2, pvZ + oz);
      }
    }
    const pvRoof = createHippedRoofGeometry(5.8, 5.8, 1.0, 1.0, 1.75);
    pvRoof.translate(pvX, pvY + 4.0, pvZ);
    ccW2Roof.push(pvRoof);
    if (side > 0) {
      // Suspended giant bronze memorial bell
      addCyl(ccW2Bronze, 0.42, 0.68, 1.45, 6, pvX, pvY + 2.35, pvZ);
    } else {
      // Ceremonial lacquer drum on stand
      addCyl(ccW2Crimson, 0.62, 0.62, 1.15, 6, pvX, pvY + 1.85, pvZ, 0, Math.PI * 0.5, 0);
    }
  }
  // [285] Hoàng Cầm kitchen subterranean water-well & bamboo dipper bucket
  addCyl(ccW2Granite, 0.65, 0.72, 0.65, 6, sx - 2.2, sy + 0.32, sz + 3.4);
  addBox(ccW2Wood, 0.12, 1.4, 0.12, sx - 2.8, sy + 0.85, sz + 3.4);
  addBox(ccW2Wood, 0.12, 1.4, 0.12, sx - 1.6, sy + 0.85, sz + 3.4);
  addBox(ccW2Wood, 1.4, 0.10, 0.10, sx - 2.2, sy + 1.55, sz + 3.4);
  // [286] Underground tunnel ventilation shaft camouflaged under roots beside command bunker
  addCyl(ccW2Wood, 0.18, 0.22, 0.42, 6, bkx + 4.2, relY(bkx + 4.2, bkz - 1.2) + 0.20, bkz - 1.2);
  addColoredBox(ccW2Nature, '#4e752c', 0.52, 0.08, 0.52, bkx + 4.2, relY(bkx + 4.2, bkz - 1.2) + 0.44, bkz - 1.2);
  // [287] Guerrilla Dép Râu (Ho Chi Minh sandal) workbench inside workshop shelter
  addBox(ccW2Wood, 1.4, 0.72, 0.65, wmx + 0.6, wmy + 0.36, wmz - 0.85);
  addColoredBox(ccW2Nature, '#26282b', 0.45, 0.12, 0.24, wmx + 0.6, wmy + 0.78, wmz - 0.85);
  // [288] Wartime Field Medical Bunker (Hầm Quân Y) cut-away dugout with stretcher & medicine cabinet
  const medX = -16.5;
  const medZ = -12.0;
  const medY = relY(medX, medZ);
  addColoredBox(ccW2Nature, '#884c2c', 4.4, 1.8, 3.6, medX, medY + 0.9, medZ);
  addColoredBox(ccW2Nature, '#b88c4a', 5.0, 0.24, 4.2, medX, medY + 1.95, medZ);
  addBox(ccW2Wood, 1.85, 0.12, 0.72, medX, medY + 0.55, medZ - 0.4);
  // [289] Bamboo Cầu Khỉ footbridge crossing rainwater-filled B-52 bomb crater pond (with grounded bamboo posts)
  const cr2Y = relY(-26.0, 2.0);
  addBox(ccW2Wood, 6.2, 0.12, 0.34, -26.0, cr2Y + 0.48, 2.0, 0.35);
  addBox(ccW2Wood, 6.2, 0.06, 0.06, -26.0, cr2Y + 1.25, 2.35, 0.35);
  for (const off of [-2.4, 2.4]) {
    addCyl(ccW2Wood, 0.04, 0.05, 1.45, 5, -26.0 + Math.cos(0.35) * off, cr2Y + 0.55, 2.35 - Math.sin(0.35) * off);
  }
  // [290] M41 Walker Bulldog tank interpretive stone plaque & wooden safety rail (with 2 grounded end posts)
  const rlY = relY(tkx + 3.2, tkz);
  addBox(ccW2Granite, 1.15, 0.95, 0.28, tkx + 3.6, relY(tkx + 3.6, tkz - 2.8) + 0.48, tkz - 2.8, 0.45);
  addBox(ccW2Wood, 4.2, 0.08, 0.08, tkx + 3.2, rlY + 0.82, tkz, Math.PI * 0.5);
  addCyl(ccW2Wood, 0.05, 0.06, 0.92, 5, tkx + 3.2, rlY + 0.40, tkz - 2.0);
  addCyl(ccW2Wood, 0.05, 0.06, 0.92, 5, tkx + 3.2, rlY + 0.40, tkz + 2.0);
  // [291] Tunnel entrance visitor timber awning & 4 corner posts over tourist demo hatch
  const thY = relY(-8.5, -9.0);
  addBox(ccW2Wood, 1.8, 0.10, 1.8, -8.5, thY + 1.85, -9.0);
  for (const ox of [-0.75, 0.75]) {
    for (const oz of [-0.75, 0.75]) {
      addCyl(ccW2Wood, 0.05, 0.06, 1.85, 5, -8.5 + ox, thY + 0.92, -9.0 + oz);
    }
  }
  // [292] Bến Dược Memorial Hall carved granite Thềm Rồng (dragon-ramp steps)
  for (const side of [-3.35, 3.35]) {
    addBox(ccW2Granite, 0.42, 0.95, 2.9, mhx + side, mhy + 0.65, mhz - 6.8, 0, 0.32, 0);
  }
  // [293] Bến Dược Tower 4-corner bronze wind-bells under top-tier eaves
  for (const sxB of [-4.6, 4.6]) {
    for (const szB of [-4.6, 4.6]) {
      addCyl(ccW2Bronze, 0.08, 0.14, 0.32, 5, bx + sxB, crownY0 - 0.55, bz + szB);
    }
  }
  // [294] Memorial Plaza ceremonial stone flower-urns & cycad planters lining approach
  for (const side of [-1, 1]) {
    for (const pz of [-6.0, 2.0]) {
      addCyl(ccW2Granite, 0.48, 0.36, 0.65, 6, bx + side * 6.5, by + 0.35, bz + pz);
      addColoredCone(ccW2Nature, '#2c7028', 0.55, 0.65, 5, bx + side * 6.5, by + 0.95, bz + pz);
    }
  }
  // [295] Củ Chi Bamboo-and-Thatch Visitor Rest Hut (Chòi Nghỉ Chân) near Welcome Board
  const rhX = wbx - 6.8;
  const rhZ = wbz + 1.5;
  const rhY = relY(rhX, rhZ);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(ccW2Wood, 0.08, 0.10, 2.6, 5, rhX + ox, rhY + 1.3, rhZ + oz);
    }
  }
  const rhRoof = createHippedRoofGeometry(4.2, 3.6, 0.4, 2.4, 1.25);
  rhRoof.translate(rhX, rhY + 2.6, rhZ);
  ccW2Nature.push(colorizeGeometry(rhRoof, '#b88c4a'));
  addBox(ccW2Wood, 1.5, 0.72, 0.85, rhX, rhY + 0.36, rhZ);
  // [296] Guerrilla bicycle-generator & field telephone spool inside cut-away Command Bunker
  addCyl(ccW2Bronze, 0.28, 0.28, 0.08, 6, bkx - 1.6, bky + 0.42, bkz + 0.8, 0, 0, Math.PI * 0.5);
  addBox(ccW2Wood, 0.55, 0.38, 0.38, bkx + 1.6, bky + 0.32, bkz + 0.8);
  // [297] Additional wooden booby-trap showcase board beside booby-trap shelter
  addBox(ccW2Wood, 1.8, 1.25, 0.12, btx + 3.2, relY(btx + 3.2, btz) + 0.85, btz, -0.35);
  // [298] Bến Dược Memorial Hall rear lotus reflection pool with granite curb
  addBox(ccW2Granite, 11.2, 0.38, 5.2, mhx, relY(mhx, mhz + 11.2) + 0.19, mhz + 11.2);
  addColoredBox(ccW2Nature, '#2d6e66', 10.2, 0.12, 4.2, mhx, relY(mhx, mhz + 11.2) + 0.34, mhz + 11.2);
  // [299][300] Weathered trail map lectern at junction & granite perimeter bollards framing plaza
  addBox(ccW2Wood, 1.2, 1.15, 0.32, 4.5, relY(4.5, -10.5) + 0.58, -10.5);
  addBox(ccW2Gold, 0.95, 0.65, 0.06, 4.5, relY(4.5, -10.5) + 1.22, -10.5, 0, -0.4, 0);
  for (let pb = -2; pb <= 2; pb++) {
    addCyl(ccW2Granite, 0.14, 0.18, 0.72, 6, bx + pb * 5.2, by + 0.36, bz - 15.2);
  }

  group.add(
    makeMergedMesh('CuChiPagodaRoofs', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('CuChiPagodaColumns', crimsonParts, ctx.materials.crimsonLacquer),
    makeMergedMesh('CuChiBenDuocTowerCream', creamParts, ctx.materials.whitePlaster),
    makeMergedMesh('CuChiBenDuocTowerOchrePiers', ochrePierParts, ctx.materials.ochreSand ?? ctx.materials.yellowOchrePlaster),
    makeMergedMesh('CuChiTrapdoorsAndShelter', woodParts, ctx.materials.darkWood),
    makeMergedMesh('CuChiTunnelVoid', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('CuChiLateriteThatchBamboo', natureParts, cuChiNatureMat),
    makeMergedMesh('CuChiPagodaFinial', goldParts, ctx.materials.gold),
    makeMergedMesh('CuChiBenDuocGraniteStairs', graniteParts, ctx.materials.granite),
    makeMergedMesh('CuChiBenDuocBronzeUrn', bronzeParts, ctx.materials.bronze),
    makeMergedMesh('CuChiWreckedM41Armor', tankArmorParts, m41RustedMat),
    makeMergedMesh('CuChiWreckedM41Tracks', tankDarkParts, m41CharredMat),
    // Wave 2 merged meshes (castShadow = false, zero new materials!)
    makeMergedMesh('CuChiWave2Roof', ccW2Roof, ctx.materials.terracottaRoof, false, true),
    makeMergedMesh('CuChiWave2Crimson', ccW2Crimson, ctx.materials.crimsonLacquer, false, true),
    makeMergedMesh('CuChiWave2Wood', ccW2Wood, ctx.materials.darkWood, false, true),
    makeMergedMesh('CuChiWave2Nature', ccW2Nature, cuChiNatureMat, false, true),
    makeMergedMesh('CuChiWave2Granite', ccW2Granite, ctx.materials.granite, false, true),
    makeMergedMesh('CuChiWave2Bronze', ccW2Bronze, ctx.materials.bronze, false, true),
    makeMergedMesh('CuChiWave2Gold', ccW2Gold, ctx.materials.gold, false, false)
  );
  // P1 Địa Đạo Củ Chi & Đền Bến Dược Motif Upgrades (`MN-043`..`MN-052`) — seated directly on Bến Dược Tower plinth & Memorial Hall facade!
  const ccMotifStone = new THREE.Mesh(
    mergeNormalized([
      ...createAncientStoneLanternParts(bx - 6.2, by + 0.08, bz - 12.5, 0.95),
      ...createAncientStoneLanternParts(bx + 6.2, by + 0.08, bz - 12.5, 0.95),
      ...createMotifBandParts('hoi_van', bx - 6.8, bz - 8.22, bx + 6.8, bz - 8.22, by + 0.85, 0.16, 0.05)
    ]),
    ctx.materials.granite
  );
  ccMotifStone.castShadow = false;
  const ccMotifGold = new THREE.Mesh(
    mergeNormalized([
      ...createLotusPetalRingParts(bx, by + 1.85, bz, 2.8, 12, 1, true),
      ...createBasReliefPanelParts(mhx - 4.5, mhy + 2.6, mhz - 2.85, 1.85, 0.95, Math.PI, 'lich_su'),
      ...createBasReliefPanelParts(mhx + 4.5, mhy + 2.6, mhz - 2.85, 1.85, 0.95, Math.PI, 'lich_su')
    ]),
    ctx.materials.gold
  );
  ccMotifGold.castShadow = false;
  group.add(ccMotifStone, ccMotifGold);
  tagMotifIds(group, [
    'HV-A06', 'HV-C01', 'HV-D01', 'HV-D12', 'HV-E07', 'HV-I01',
    'HV-NEW-MB-10', 'HV-NEW-MB-12', 'HV-NEW-MN-11', 'HV-NEW-MN-12'
  ]);

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 52.0 });
}

// ============================================================================
// 5. Tháp Bà Ponagar — Nha Trang (265, 275), Mandapa at (250, 255)
//    4 Cham Towers (23m Main Kalan + 15m + 11.5m + 9.5m NW saddle-roof tower),
//    22 Mandapa columns (10×6.2m + 12×4.0m), Durga tympanum, Po Nagar statue,
//    GPU incense smoke, Nandi bull, ruined brick wall & frangipani trees
// ============================================================================
function buildPoNagarNhaTrang(ctx: VietnamBuilderContext): void {
  const cx = 265;
  const cz = 275;
  const yHillTop = ctx.getHeight(cx, cz);

  // Rotate group so local -Z (0, 0, -25) lands exactly on Mandapa world coordinates (250, 255)
  const axisYaw = Math.atan2(15, 20);
  const cosA = Math.cos(axisYaw);
  const sinA = Math.sin(axisYaw);

  const group = new THREE.Group();
  group.name = 'PoNagarNhaTrangComplex';
  group.position.set(cx, yHillTop, cz);
  group.rotation.y = axisYaw;

  const brickParts: THREE.BufferGeometry[] = [];
  const graniteParts: THREE.BufferGeometry[] = [];
  const sandstoneParts: THREE.BufferGeometry[] = [];
  const blackStoneParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const lampCoreParts: THREE.BufferGeometry[] = [];
  const floraParts: THREE.BufferGeometry[] = [];

  const localToWorld = (lx: number, ly: number, lz: number): { x: number; y: number; z: number } => ({
    x: cx + lx * cosA + lz * sinA,
    y: yHillTop + ly,
    z: cz - lx * sinA + lz * cosA
  });

  const relY = (lx: number, lz: number): number => {
    const w = localToWorld(lx, 0, lz);
    return ctx.getHeight(w.x, w.z) - yHillTop;
  };

  // 1. Expanded Upper Sanctuary Stepped Granite Podium (accommodating all 4 Cham towers + ruined wall)
  addBox(graniteParts, 38.0, 5.8, 30.0, 0, -2.65, 3.0);
  addBox(graniteParts, 39.2, 0.65, 31.2, 0, 0.28, 3.0);

  // Ruined Ancient Cham Red-Brick Sanctuary Perimeter Wall around Upper Terrace
  const wallY = 0.6;
  // North front parapet segments flanking upper stair entry
  addBox(brickParts, 14.5, 1.45, 0.85, -11.5, wallY + 0.72, -11.6);
  addBox(brickParts, 14.5, 1.35, 0.85, 11.5, wallY + 0.68, -11.6);
  // West, East & South ruined perimeter brick wall segments with weathered stepped breaks
  addBox(brickParts, 0.85, 1.75, 14.0, -18.8, wallY + 0.88, -4.2);
  addBox(brickParts, 0.85, 1.15, 13.0, -18.8, wallY + 0.58, 11.0);
  addBox(brickParts, 0.85, 1.65, 16.0, 18.8, wallY + 0.82, -2.5);
  addBox(brickParts, 0.85, 1.25, 10.5, 18.8, wallY + 0.62, 12.2);
  addBox(brickParts, 18.0, 1.55, 0.85, -8.5, wallY + 0.78, 17.6);
  addBox(brickParts, 14.5, 1.25, 0.85, 10.8, wallY + 0.62, 17.6);

  // 2. Grand 23.0m Main Kalan (*Tháp Bắc*) + 15.0m South + 11.5m SE + 9.5m 4th NW Saddle-Roof Tower
  // FIX PN-06: 3-tier sculpted ogee leaf-arch false doors (via createChamTowerGeometry) + carved sandstone cornice moldings & corner flame pinnacles!
  const mainKalan = createChamTowerGeometry(8.2, 23.0, 4, { skipBuiltInVestibule: true });
  mainKalan.rotateY(Math.PI);
  mainKalan.translate(0, 0.55, 1.5);
  brickParts.push(mainKalan);
  // [101][102][103][104][105][106][107] Carved sandstone frieze, Somasutra spout, Dvarapala guardians, 5th NE shrine foundation & courtyard slabs
  addBox(sandstoneParts, 8.5, 0.28, 8.5, 0, 9.65, 1.5);
  addBox(sandstoneParts, 8.5, 0.24, 8.5, 0, 14.2, 1.5);
  addBox(sandstoneParts, 1.45, 0.26, 0.42, 4.45, 1.25, 1.5); // Somasutra north-wall drainage spout
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      sandstoneParts.push(new THREE.ConeGeometry(0.32, 0.85, 4).translate(sx * 3.85, 10.22, 1.5 + sz * 3.85));
    }
    // Dvarapala guardian pedestals flanking Main Kalan vestibule steps
    addBox(sandstoneParts, 0.72, 1.35, 0.72, sx * 2.45, 1.28, -5.2);
    addBox(crimsonParts, 0.95, 0.14, 0.95, sx * 1.15, 3.65, -3.72); // ceremonial brocade canopy
  }
  // 5th NE shrine brick foundation & weathered courtyard paving slabs
  addBox(brickParts, 4.2, 0.65, 4.2, 11.2, 0.92, 11.2);
  addBox(sandstoneParts, 1.6, 1.4, 0.35, 11.2, 1.65, 11.2);
  for (let pxS = -14; pxS <= 14; pxS += 7) {
    addBox(graniteParts, 6.6, 0.08, 12.0, pxS, 0.62, -4.5);
  }

  // Projecting *Tiền Sảnh* Vestibule + Upgraded Durga Relief Tympanum + Sculpted Goddess Po Nagar (*Thiên Y A Na*)
  addBox(brickParts, 4.6, 0.42, 3.4, 0, 0.76, -3.55);
  for (const side of [-1, 1]) {
    addBox(brickParts, 0.72, 4.45, 3.1, side * 1.88, 3.0, -3.55);
    addBox(sandstoneParts, 0.54, 4.35, 0.54, side * 1.38, 2.95, -4.92);
    addBox(sandstoneParts, 0.76, 0.34, 0.76, side * 1.38, 0.92, -4.92);
  }
  addBox(sandstoneParts, 4.6, 0.55, 0.78, 0, 5.32, -4.92);
  addBox(brickParts, 4.8, 0.62, 3.4, 0, 5.45, -3.45);
  // Sculpted Leaf-Arch Sandstone Dancing 4-Armed Durga Tympanum via createChamReliefTympanumParts
  sandstoneParts.push(...createChamReliefTympanumParts(0, 5.55, -5.06, Math.PI, 1.48, 'durga'));

  // Interior Sculpted Black-Sandstone Statue of Goddess Po Nagar (10 arms + Mukuta crown) via createSculptedDeityParts
  addBox(sandstoneParts, 2.25, 0.62, 1.65, 0, 1.28, -3.72);
  const { bodyParts: poBody, accentParts: poAccent } = createSculptedDeityParts(
    0,
    1.59,
    -3.70,
    Math.PI,
    0.72,
    'ponagar'
  );
  blackStoneParts.push(...poBody);
  goldParts.push(...poAccent);
  // Ceremonial crimson silk offering drape around lower pedestal
  addCyl(crimsonParts, 0.54, 0.66, 0.44, 12, 0, 2.02, -3.70);

  for (const side of [-1, 1]) {
    addCyl(bronzeParts, 0.10, 0.16, 0.72, 8, side * 0.92, 1.32, -4.42);
    lampCoreParts.push(new THREE.SphereGeometry(0.14, 8, 8).translate(side * 0.92, 1.78, -4.42));
  }
  // 4 Bronze Incense Censers (with GPU Incense Smoke wired in world coords!)
  const censer1 = createBronzeIncenseTripodParts(0, 0.60, -6.2, 0.95);
  graniteParts.push(...censer1.limestoneParts);
  bronzeParts.push(...censer1.bronzeParts);
  goldParts.push(...censer1.goldParts);

  const poNagarSanctumLight = new THREE.PointLight('#ffb85c', 2.4, 15, 1.4);
  poNagarSanctumLight.position.set(0, 3.25, -4.15);
  group.add(poNagarSanctumLight);

  // Carved Sandstone Sacred *Nandi* Bull resting on a pedestal before Main Kalan (-3.8, -7.8)
  const nandiX = -4.2;
  const nandiZ = -7.6;
  addBox(sandstoneParts, 2.2, 0.58, 1.45, nandiX, 0.88, nandiZ);
  sandstoneParts.push(...createGuardianBeastParts(nandiX, 1.18, nandiZ, Math.PI * 0.5, 0.92, 'nghe'));
  // Characteristic Nandi bull swept crescent horns & sacred hump
  addBox(sandstoneParts, 0.32, 0.24, 0.36, nandiX - 0.18, 1.88, nandiZ);
  for (const hs of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.055, 0.34, 6);
    horn.rotateZ(hs * 0.55);
    horn.translate(nandiX + 0.25, 2.15, nandiZ + hs * 0.20);
    sandstoneParts.push(horn);
  }

  // West/South Tower (*Tháp Trung / Nam*, 15.0m) with Carved Lintel & Open *Linga-Yoni* Shrine Niche
  const westTower = createChamTowerGeometry(5.6, 15.0, 3, { skipBuiltInVestibule: true });
  westTower.rotateY(Math.PI);
  westTower.translate(-11.2, 0.55, -0.5);
  brickParts.push(westTower);
  addBox(brickParts, 3.1, 0.35, 2.2, -11.2, 0.72, -3.8);
  for (const side of [-1, 1]) {
    addBox(brickParts, 0.54, 3.25, 2.1, -11.2 + side * 1.25, 2.35, -3.8);
  }
  addBox(sandstoneParts, 3.2, 0.52, 0.62, -11.2, 4.18, -4.82);
  addBox(sandstoneParts, 2.2, 0.48, 0.52, -11.2, 4.66, -4.76);
  addBox(brickParts, 3.2, 0.48, 2.3, -11.2, 4.15, -3.72);
  addBox(sandstoneParts, 1.15, 0.46, 1.15, -11.2, 1.12, -3.85);
  addBox(sandstoneParts, 0.34, 0.18, 0.56, -11.2 + 0.75, 1.22, -3.85);
  addCyl(sandstoneParts, 0.20, 0.24, 0.85, 12, -11.2, 1.72, -3.85);
  const censer2 = createBronzeIncenseTripodParts(-11.2, 0.60, -5.6, 0.78);
  graniteParts.push(...censer2.limestoneParts);
  bronzeParts.push(...censer2.bronzeParts);
  goldParts.push(...censer2.goldParts);

  // East Tower (*Tháp Đông Nam*, 11.5m) with Carved Lintel & Open *Linga-Yoni* Shrine Niche
  const eastTower = createChamTowerGeometry(4.6, 11.5, 3, { skipBuiltInVestibule: true });
  eastTower.rotateY(Math.PI);
  eastTower.translate(10.8, 0.55, 0.8);
  brickParts.push(eastTower);
  addBox(brickParts, 2.7, 0.32, 1.9, 10.8, 0.70, -2.0);
  for (const side of [-1, 1]) {
    addBox(brickParts, 0.48, 2.75, 1.8, 10.8 + side * 1.08, 2.08, -2.0);
  }
  addBox(sandstoneParts, 2.8, 0.46, 0.54, 10.8, 3.65, -2.86);
  addBox(brickParts, 2.8, 0.42, 1.9, 10.8, 3.62, -1.96);
  addBox(sandstoneParts, 0.98, 0.42, 0.98, 10.8, 1.06, -2.05);
  addCyl(sandstoneParts, 0.18, 0.22, 0.72, 10, 10.8, 1.60, -2.05);
  const censer3 = createBronzeIncenseTripodParts(10.8, 0.60, -3.8, 0.72);
  graniteParts.push(...censer3.limestoneParts);
  bronzeParts.push(...censer3.bronzeParts);
  goldParts.push(...censer3.goldParts);

  // 4th Northwest Tower (*Tháp Tây Bắc* — Smooth *mái hình thuyền* boat/saddle-roofed Cham Kosa tower — ref 32)
  const nwX = -11.4;
  const nwZ = 10.6;
  addBox(brickParts, 6.4, 0.75, 5.0, nwX, 0.92, nwZ);
  addBox(brickParts, 5.6, 4.3, 4.2, nwX, 3.45, nwZ);
  // Corner & intermediate fluted brick pilasters on NW tower
  for (const px of [-2.55, -0.95, 0.95, 2.55]) {
    addBox(brickParts, 0.44, 4.3, 4.42, nwX + px, 3.45, nwZ);
  }
  // 3-Tier projecting brick leaf-arch portal on -Z face of NW tower
  for (let tier = 0; tier < 3; tier++) {
    const f = 1.0 - tier * 0.24;
    addBox(brickParts, 2.35 * f, 2.85 * f, 0.28, nwX, 2.25 + tier * 0.48, nwZ - 2.18 - tier * 0.14);
    const leafPeak = new THREE.ConeGeometry(1.18 * f, 1.05 * f, 3);
    leafPeak.scale(1.0, 1.0, 0.22);
    leafPeak.translate(nwX, 3.65 + tier * 0.48, nwZ - 2.20 - tier * 0.14);
    brickParts.push(leafPeak);
  }
  addBox(sandstoneParts, 1.85, 0.38, 0.42, nwX, 3.85, nwZ - 2.22);
  // Lotus-petal eaves frieze wrapping the cornice of the NW boat-roof tower (y = 5.48m)
  for (let p = -5; p <= 5; p++) {
    addBox(brickParts, 0.34, 0.28, 4.55, nwX + p * 0.52, 5.48, nwZ);
  }
  for (let p = -3; p <= 3; p++) {
    addBox(brickParts, 5.95, 0.28, 0.34, nwX, 5.48, nwZ + p * 0.56);
  }
  // Smooth Curved Chăm Boat/Saddle Vaulted Brick Roof (*createBoatSaddleRoofGeometry* — NO jagged slices, NO gold finials!)
  const nwBoatRoof = createBoatSaddleRoofGeometry(6.3, 4.35, 3.35, 0.88);
  nwBoatRoof.translate(nwX, 5.58, nwZ);
  brickParts.push(nwBoatRoof);
  // 2 Miniature Brick Corner Turrets framing the boat-roof eaves
  for (const sx of [-1, 1]) {
    const txTur = nwX + sx * 2.45;
    const tzTur = nwZ - 1.78;
    addBox(brickParts, 0.78, 1.25, 0.78, txTur, 6.20, tzTur);
    const tCap = new THREE.ConeGeometry(0.46, 0.78, 4);
    tCap.rotateY(Math.PI * 0.25);
    tCap.translate(txTur, 7.20, tzTur);
    brickParts.push(tCap);
  }

  // 3. Lower Mandapa Meditation Terrace at world (250, 255) => local (0, y, -25.0)
  const mandapaZ = -25.0;
  const mandapaGroundY = relY(0, mandapaZ);
  const mandapaTopY = Math.max(mandapaGroundY + 0.75, -3.6);

  addBox(graniteParts, 22.0, 8.5, 18.0, 0, mandapaTopY - 4.25, mandapaZ);
  addBox(graniteParts, 23.0, 0.55, 18.8, 0, mandapaTopY, mandapaZ);

  // FIX PN-03: Authentic Stocky Monumental 22 Mandapa Octagonal Brick Columns (ref 98_ponagar_mandapa_cot.jpg):
  // 10 Massive Inner Columns (r = 0.82m, h = 5.5m) + 12 Stocky Outer Columns (r = 0.62m, h = 3.6m) with 3-tier octagonal stepped bases!
  for (const rowX of [-2.55, 2.55]) {
    for (let i = 0; i < 5; i++) {
      const pz = mandapaZ - 5.6 + i * 2.8;
      // 3-tier chamfered octagonal rubbed-brick base plinth
      addCyl(brickParts, 1.06, 1.18, 0.28, 8, rowX, mandapaTopY + 0.18, pz);
      addCyl(brickParts, 0.94, 1.06, 0.28, 8, rowX, mandapaTopY + 0.46, pz);
      addCyl(brickParts, 0.84, 0.94, 0.26, 8, rowX, mandapaTopY + 0.72, pz);
      // Monumental stocky octagonal rubbed-brick shaft (r = 0.82m)
      addCyl(brickParts, 0.80, 0.84, 3.72, 8, rowX, mandapaTopY + 2.71, pz);
      // 3-Tier Flared Octagonal Brick Capital crowning the column (up to +5.55m)
      addCyl(brickParts, 0.88, 0.80, 0.30, 8, rowX, mandapaTopY + 4.72, pz);
      addCyl(brickParts, 0.98, 0.88, 0.32, 8, rowX, mandapaTopY + 5.03, pz);
      addCyl(brickParts, 1.08, 0.98, 0.30, 8, rowX, mandapaTopY + 5.34, pz);
      // Recessed dark square mortise beam holes (*lỗ mộng xà gỗ*) near upper shaft!
      addBox(voidParts, 1.66, 0.32, 0.28, rowX, mandapaTopY + 4.02, pz);
      addBox(voidParts, 0.28, 0.32, 1.66, rowX, mandapaTopY + 4.02, pz);
    }
  }
  for (const rowX of [-7.6, 7.6]) {
    for (let i = 0; i < 6; i++) {
      const pz = mandapaZ - 6.75 + i * 2.7;
      // 3-tier chamfered octagonal rubbed-brick base plinth
      addCyl(brickParts, 0.82, 0.92, 0.22, 8, rowX, mandapaTopY + 0.15, pz);
      addCyl(brickParts, 0.72, 0.82, 0.22, 8, rowX, mandapaTopY + 0.37, pz);
      addCyl(brickParts, 0.64, 0.72, 0.20, 8, rowX, mandapaTopY + 0.58, pz);
      // Stocky octagonal outer column shaft (r = 0.62m)
      addCyl(brickParts, 0.60, 0.64, 2.34, 8, rowX, mandapaTopY + 1.85, pz);
      // 3-Tier Flared Octagonal Brick Capital (up to +3.65m)
      addCyl(brickParts, 0.68, 0.60, 0.22, 8, rowX, mandapaTopY + 3.13, pz);
      addCyl(brickParts, 0.76, 0.68, 0.22, 8, rowX, mandapaTopY + 3.35, pz);
      addCyl(brickParts, 0.84, 0.76, 0.22, 8, rowX, mandapaTopY + 3.57, pz);
      // Recessed dark square mortise beam holes on upper shaft
      addBox(voidParts, 1.26, 0.26, 0.24, rowX, mandapaTopY + 2.62, pz);
      addBox(voidParts, 0.24, 0.26, 1.26, rowX, mandapaTopY + 2.62, pz);
    }
  }

  // Natural Engraved Granite Boulder Plaque "THÁP BÀ PONAGAR — Nha Trang" flanking Mandapa entrance (ref 98)
  const bldX = 6.2;
  const bldZ = mandapaZ - 10.6;
  const bldY = relY(bldX, bldZ);
  const nameBoulder = createSculptedRockGeometry(9825, 1.95, 1.35, 1.15, 2);
  nameBoulder.translate(bldX, bldY + 0.85, bldZ);
  graniteParts.push(nameBoulder);
  const poNagarBoulderPlaque = createSignagePlaqueMesh(
    {
      text: 'THÁP BÀ PONAGAR',
      subText: 'Nha Trang',
      style: 'stone',
      width: 2.35,
      height: 0.92,
      depth: 0.14,
      motifSeed: 9801
    },
    ctx
  );
  poNagarBoulderPlaque.name = 'PoNagarEngravedBoulderPlaque';
  poNagarBoulderPlaque.position.set(bldX, bldY + 1.15, bldZ - 0.96);
  poNagarBoulderPlaque.rotation.y = Math.PI;
  group.add(poNagarBoulderPlaque);

  // [108][109][110][111][115][116][120] Mandapa offering bowls, Cham pottery/weaving pavilion, stone benches & marigold pots
  addBox(sandstoneParts, 2.2, 0.88, 1.45, 0, mandapaTopY + 0.68, mandapaZ);
  addCyl(bronzeParts, 0.24, 0.18, 0.18, 8, -0.65, mandapaTopY + 1.21, mandapaZ);
  addCyl(bronzeParts, 0.24, 0.18, 0.18, 8, 0.65, mandapaTopY + 1.21, mandapaZ);
  // Cham pottery & brocade weaving demonstration pavilion on west Mandapa flank
  for (const px of [-10.4, -7.6]) {
    for (const pz of [mandapaZ - 1.6, mandapaZ + 1.6]) {
      addCyl(brickParts, 0.10, 0.12, 2.6, 6, px, mandapaTopY + 1.3, pz);
    }
  }
  addBox(crimsonParts, 3.4, 0.16, 3.8, -9.0, mandapaTopY + 2.65, mandapaZ);
  addCyl(brickParts, 0.24, 0.18, 0.55, 8, -9.4, mandapaTopY + 0.55, mandapaZ);
  addCyl(brickParts, 0.22, 0.16, 0.48, 8, -8.6, mandapaTopY + 0.52, mandapaZ + 0.4);
  // Stone benches & terracotta marigold pots along Mandapa terrace
  for (const side of [-1, 1]) {
    addBox(graniteParts, 0.65, 0.46, 2.4, side * 9.8, mandapaTopY + 0.45, mandapaZ - 5.5);
    addCyl(brickParts, 0.26, 0.18, 0.38, 7, side * 10.6, mandapaTopY + 0.42, mandapaZ - 8.0);
  }
  // [112][113][114][118] Lower Cù Lao Hill entrance gate pillars, Cái River embankment & moored fishing sampans
  const lowerGateY = relY(0, -44.2) - 0.4;
  for (const sx of [-3.6, 3.6]) {
    addBox(graniteParts, 0.85, 2.4, 0.85, sx, lowerGateY + 1.2, -45.7);
  }
  for (const [rx, rz] of [[-12, -48], [12, -48]]) {
    const ry = relY(rx, rz);
    addBox(brickParts, 3.8, 0.48, 1.15, rx, ry + 0.24, rz, 0.35);
    addColoredSphere(floraParts, '#d43278', 0.68, 5, 4, rx * 0.8, ry + 0.72, rz + 2.5);
  }
  const censer4 = createBronzeIncenseTripodParts(0, mandapaTopY + 1.12, mandapaZ, 0.68);
  graniteParts.push(...censer4.limestoneParts);
  bronzeParts.push(...censer4.bronzeParts);
  goldParts.push(...censer4.goldParts);

  // Wire GPU Incense Smoke to all 4 Bronze Censers (transformed to WORLD coordinates!)
  const wC1 = localToWorld(0, censer1.smokeY, -6.2);
  const wC2 = localToWorld(-11.2, censer2.smokeY, -5.6);
  const wC3 = localToWorld(10.8, censer3.smokeY, -3.8);
  const wC4 = localToWorld(0, censer4.smokeY, mandapaZ);
  const poSmoke = createIncenseSmokeSystem(
    [
      { ...wC1, scale: 0.92 },
      { ...wC2, scale: 0.76 },
      { ...wC3, scale: 0.72 },
      { ...wC4, scale: 0.78 }
    ],
    ctx.sharedShaders?.incenseSmoke
  );
  poSmoke.mesh.name = 'PoNagarIncenseSmoke';
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(poSmoke.mesh.material as THREE.Material);
    ctx.animatedUniforms?.push(poSmoke.uniforms);
  }
  ctx.scene.add(poSmoke.mesh);

  addBox(sandstoneParts, 1.05, 1.85, 0.26, -5.2, mandapaTopY + 1.22, mandapaZ - 7.4);
  for (const side of [-1, 1]) {
    for (const lz of [mandapaZ - 8.4, mandapaZ + 8.4]) {
      addBox(graniteParts, 0.72, 0.52, 0.72, side * 4.4, mandapaTopY + 0.52, lz);
      addCyl(bronzeParts, 0.08, 0.11, 1.85, 8, side * 4.4, mandapaTopY + 1.70, lz);
      lampCoreParts.push(new THREE.SphereGeometry(0.22, 8, 8).translate(side * 4.4, mandapaTopY + 2.75, lz));
    }
  }

  // 4. Steep Carved Granite Pilgrim Stairways (Hill Base -> Mandapa -> Upper Sanctuary)
  const lowerSteps = 20;
  const startZ1 = -44.2;
  const endZ1 = mandapaZ - 9.0;
  const startY1 = relY(0, startZ1) - 0.4;
  for (let s = 0; s < lowerSteps; s++) {
    const t = s / (lowerSteps - 1);
    const sz = THREE.MathUtils.lerp(startZ1, endZ1, t);
    const sy = THREE.MathUtils.lerp(startY1, mandapaTopY, t);
    const groundY = relY(0, sz) - 1.6;
    const stepH = Math.max(1.2, sy - groundY);
    addBox(graniteParts, 6.2, stepH, 0.8, 0, sy - stepH * 0.5, sz);
  }
  for (const sx of [-3.4, 3.4]) {
    const midZ = (startZ1 + endZ1) * 0.5;
    const midY = (startY1 + mandapaTopY) * 0.5 + 0.55;
    const len = Math.hypot(endZ1 - startZ1, mandapaTopY - startY1);
    const pitch = Math.atan2(mandapaTopY - startY1, endZ1 - startZ1);
    addBox(graniteParts, 0.65, 1.25, len + 0.6, sx, midY, midZ, 0, -pitch, 0);
  }

  const upperSteps = 14;
  const startZ2 = mandapaZ + 9.0;
  const endZ2 = -12.0;
  for (let s = 0; s < upperSteps; s++) {
    const t = s / (upperSteps - 1);
    const sz = THREE.MathUtils.lerp(startZ2, endZ2, t);
    const sy = THREE.MathUtils.lerp(mandapaTopY, 0.4, t);
    const groundY = relY(0, sz) - 2.0;
    const stepH = Math.max(1.4, sy - groundY);
    addBox(graniteParts, 5.8, stepH, 0.72, 0, sy - stepH * 0.5, sz);
  }
  for (const sx of [-3.2, 3.2]) {
    const midZ = (startZ2 + endZ2) * 0.5;
    const midY = (mandapaTopY + 0.4) * 0.5 + 0.55;
    const len = Math.hypot(endZ2 - startZ2, 0.4 - mandapaTopY);
    const pitch = Math.atan2(0.4 - mandapaTopY, endZ2 - startZ2);
    addBox(graniteParts, 0.65, 1.25, len + 0.6, sx, midY, midZ, 0, -pitch, 0);
  }

  // 5. 12 Flowering Frangipani (*Hoa Sứ / Cây Đại*) Trees framing the Cù Lao hilltop & stairways!
  const frangCoords: Array<[number, number, number]> = [
    [-21.5, -8.0, 1.05], [-22.0, 4.0, 0.95], [-19.5, 16.5, 1.10],
    [21.5, -7.5, 1.00], [22.5, 5.5, 1.12], [19.0, 16.8, 0.96],
    [-14.0, -20.0, 0.92], [14.0, -20.5, 0.98],
    [-13.5, -31.5, 1.04], [13.5, -31.0, 0.94],
    [-8.5, -40.5, 0.95], [8.5, -40.0, 1.02]
  ];
  for (let f = 0; f < frangCoords.length; f++) {
    const [fx, fz, fs] = frangCoords[f];
    const fy = relY(fx, fz) - 0.35;
    // Gnarled branching pale grey-brown frangipani trunk & forks
    addColoredCylinder(floraParts, '#8a7f74', 0.16 * fs, 0.28 * fs, 2.4 * fs, 7, fx, fy + 1.2 * fs, fz);
    for (let br = 0; br < 4; br++) {
      const ba = (br / 4) * Math.PI * 2 + f * 0.7;
      const bx = fx + Math.cos(ba) * 1.15 * fs;
      const bz = fz + Math.sin(ba) * 1.15 * fs;
      const by = fy + 2.8 * fs + (br % 2) * 0.4 * fs;
      addColoredCylinder(
        floraParts,
        '#94897c',
        0.09 * fs,
        0.14 * fs,
        1.8 * fs,
        6,
        (fx + bx) * 0.5,
        fy + 2.3 * fs,
        (fz + bz) * 0.5,
        -ba,
        0,
        0.58
      );
      const leafPuff = createSculptedRockGeometry(920 + f * 13 + br, 1.25 * fs, 0.75 * fs, 1.25 * fs, 1);
      leafPuff.translate(bx, by + 0.45 * fs, bz);
      floraParts.push(colorizeGeometry(leafPuff, '#2f6e34'));
      // Creamy-white & golden-centered frangipani blossom clusters
      for (let bl = 0; bl < 3; bl++) {
        const bla = ba + bl * 1.1;
        addColoredSphere(
          floraParts,
          bl === 0 ? '#fff6d6' : '#f7f3e8',
          0.22 * fs,
          6,
          5,
          bx + Math.cos(bla) * 0.65 * fs,
          by + 0.95 * fs,
          bz + Math.sin(bla) * 0.65 * fs
        );
      }
    }
  }

  const blackStoneMat = new THREE.MeshStandardMaterial({
    color: '#25262b',
    roughness: 0.36,
    metalness: 0.14
  });
  const poFloraMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.80,
    metalness: 0.03
  });
  ctx.extraMaterials.push(blackStoneMat, poFloraMat);

  const poNagarBrickMat = ctx.materials.chamBrick;
  const poBrickMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brickParts), 1.9), poNagarBrickMat);
  poBrickMesh.name = 'PoNagarBrickTowers';
  poBrickMesh.castShadow = true;
  poBrickMesh.receiveShadow = true;

  // P0/P1 Tháp Bà Ponagar Chăm Kauthara Motif Upgrades (MOTIF_PLAN_MIEN_NAM.md MN-053..MN-062):
  // Chăm acanthus scroll band (`HV-C10`) & Apsara bas-relief panels (`HV-F06`) seated flush on Main Kalan rear wall (z = 5.62)!
  sandstoneParts.push(
    ...createMotifBandParts('day_la_cham', -4.0, 5.62, 4.0, 5.62, 2.25, 0.22, 0.06),
    ...createBasReliefPanelParts(-2.4, 2.85, 5.64, 0.95, 1.18, 0, 'apsara'),
    ...createBasReliefPanelParts(2.4, 2.85, 5.64, 0.95, 1.18, 0, 'apsara')
  );
  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (301–320) — Low-Poly, castShadow=false
  // ==========================================================================
  const pnW2Brick: THREE.BufferGeometry[] = [];
  const pnW2Granite: THREE.BufferGeometry[] = [];
  const pnW2Sandstone: THREE.BufferGeometry[] = [];
  const pnW2Gold: THREE.BufferGeometry[] = [];
  const pnW2Crimson: THREE.BufferGeometry[] = [];
  const pnW2Bronze: THREE.BufferGeometry[] = [];
  const pnW2Flora: THREE.BufferGeometry[] = [];

  // [301][305] Traditional Cham Múa Apsara Dance Pavilion (Sân Khấu Múa Chăm) with canopy roof & Ghinăng musician platform on east Mandapa terrace
  const stgX = 11.2;
  const stgZ = mandapaZ;
  addBox(pnW2Sandstone, 5.2, 0.55, 6.2, stgX, mandapaTopY + 0.28, stgZ);
  for (const ox of [-2.2, 2.2]) {
    for (const oz of [-2.6, 2.6]) {
      addCyl(pnW2Brick, 0.14, 0.16, 3.2, 6, stgX + ox, mandapaTopY + 2.1, stgZ + oz);
    }
  }
  addBox(pnW2Crimson, 5.4, 0.22, 6.4, stgX, mandapaTopY + 3.75, stgZ); // canopy roof connecting all 4 pavilion columns
  addBox(pnW2Crimson, 0.16, 2.4, 4.8, stgX + 2.35, mandapaTopY + 1.85, stgZ); // brocade backdrop banner
  addBox(pnW2Gold, 0.18, 0.24, 4.8, stgX + 2.35, mandapaTopY + 3.15, stgZ);
  addBox(pnW2Sandstone, 1.4, 0.42, 2.4, stgX - 1.2, mandapaTopY + 0.72, stgZ + 3.8); // musician bench
  addCyl(pnW2Crimson, 0.24, 0.24, 0.72, 6, stgX - 1.2, mandapaTopY + 1.15, stgZ + 3.4, 0, Math.PI * 0.5, 0); // Ghinăng drum

  // [302] Ornate Bronze & Ceramic Incense-Offering Stands (Bàn Cắm Nhang) flanking Mandapa & Main Kalan forecourt
  for (const [ix, iy, iz] of [[-2.6, 0.62, -6.2], [2.6, 0.62, -6.2], [-2.2, mandapaTopY + 0.3, mandapaZ - 3.6], [2.2, mandapaTopY + 0.3, mandapaZ - 3.6]]) {
    addBox(pnW2Sandstone, 1.25, 0.85, 0.65, ix, iy + 0.42, iz);
    addCyl(pnW2Bronze, 0.26, 0.20, 0.28, 6, ix, iy + 0.98, iz);
    addCyl(pnW2Crimson, 0.08, 0.06, 0.34, 5, ix, iy + 1.26, iz);
  }
  // [303] Main Kalan upper-story corner flame-finial sandstone sculptures (2nd & 3rd tiers)
  for (const [ty, tr] of [[14.55, 3.15], [18.4, 2.25]] as const) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        pnW2Sandstone.push(new THREE.ConeGeometry(0.24, 0.68, 4).translate(sx * tr, ty, 1.5 + sz * tr));
      }
    }
  }
  // [304] Sandstone Kala monster-mask relief plaques above West/South & East tower false-door arches
  addBox(pnW2Sandstone, 1.35, 0.65, 0.22, -11.2, 5.2, -4.85);
  addBox(pnW2Sandstone, 1.15, 0.55, 0.20, 10.8, 4.15, -2.92);
  // [306] Sacred frangipani prayer-ribbon altar & miniature stone shrine on upper sanctuary flank
  addBox(pnW2Sandstone, 1.4, 1.25, 0.95, 14.5, 1.22, -6.8);
  addBox(pnW2Crimson, 0.14, 1.45, 0.85, 14.5, 2.25, -6.8);
  // [307] Po Nagar Archaeological Exhibition Pavilion tucked along NW lower terrace
  const exX = -15.5;
  const exZ = mandapaZ - 4.0;
  const exY = relY(exX, exZ);
  addBox(pnW2Granite, 6.4, 0.55, 4.6, exX, exY + 0.28, exZ);
  addBox(pnW2Brick, 5.8, 2.8, 4.0, exX, exY + 1.9, exZ);
  const exRoof = createHippedRoofGeometry(6.8, 5.0, 4.2, 0.6, 1.35);
  exRoof.translate(exX, exY + 3.3, exZ);
  pnW2Crimson.push(exRoof);
  // [308] Weathered sandstone Yoni & Cham lintel lapidary display pedestals along stele gallery
  for (let lp = 0; lp < 3; lp++) {
    addBox(pnW2Sandstone, 0.85, 0.72, 0.85, -5.2 - lp * 1.4, mandapaTopY + 0.62, mandapaZ - 5.2);
    addCyl(pnW2Sandstone, 0.22, 0.26, 0.45, 6, -5.2 - lp * 1.4, mandapaTopY + 1.18, mandapaZ - 5.2);
  }
  // [309] Pilgrim incense & lotus-offering vendor kiosks flanking lower Cù Lao Hill entrance gate
  for (const sx of [-6.4, 6.4]) {
    const ky = relY(sx, -44.8);
    addBox(pnW2Brick, 2.6, 0.88, 1.6, sx, ky + 0.44, -44.8);
    addBox(pnW2Crimson, 3.0, 0.16, 2.0, sx, ky + 2.35, -44.8);
    addCyl(pnW2Bronze, 0.14, 0.14, 2.3, 5, sx - 1.1, ky + 1.15, -44.8);
    addCyl(pnW2Bronze, 0.14, 0.14, 2.3, 5, sx + 1.1, ky + 1.15, -44.8);
  }
  // [310] Carved sandstone Naga handrail terminations at foot of lower & upper pilgrim stairways
  for (const sx of [-3.4, 3.4]) {
    addBox(pnW2Sandstone, 0.85, 1.15, 0.95, sx, startY1 + 0.58, startZ1 - 0.6);
    addBox(pnW2Sandstone, 0.75, 1.05, 0.85, sx, mandapaTopY + 0.52, startZ2 - 0.4);
  }
  // [311] Mandapa brick-terrace rainwater drainage gargoyle spouts projecting from podium
  for (const sx of [-11.6, 11.6]) {
    addBox(pnW2Sandstone, 1.1, 0.24, 0.28, sx, mandapaTopY - 0.25, mandapaZ - 4.0);
    addBox(pnW2Sandstone, 1.1, 0.24, 0.28, sx, mandapaTopY - 0.25, mandapaZ + 4.0);
  }
  // [312] Ceremonial golden parasol (lọng vàng) stands flanking Goddess Po Nagar vestibule doorway
  for (const sx of [-1.75, 1.75]) {
    addCyl(pnW2Gold, 0.04, 0.05, 2.4, 5, sx, 1.95, -5.35);
    pnW2Gold.push(new THREE.ConeGeometry(0.58, 0.36, 6).translate(sx, 3.25, -5.35));
  }
  // [313] Upper sanctuary brick altar tables in front of South (15m) & SE (11.5m) towers
  addBox(pnW2Brick, 1.9, 0.85, 0.95, -11.2, 1.02, -6.8);
  addBox(pnW2Brick, 1.6, 0.82, 0.85, 10.8, 1.00, -4.9);
  addCyl(pnW2Gold, 0.26, 0.18, 0.14, 6, -11.2, 1.52, -6.8);
  addCyl(pnW2Gold, 0.24, 0.16, 0.14, 6, 10.8, 1.48, -4.9);
  // [314] Cái River wooden boat-landing jetty extending from foot of Cù Lao Hill
  const jetY = relY(0, -49.5);
  addBox(pnW2Granite, 3.2, 0.26, 6.5, 0, jetY + 0.25, -50.2);
  // [315][316] Traditional Cham brocade hanging display rack & Bàu Trúc pottery amphorae beside craft pavilion
  addBox(pnW2Crimson, 2.2, 1.45, 0.10, -9.0, mandapaTopY + 1.45, mandapaZ + 1.5);
  addBox(pnW2Gold, 2.3, 0.10, 0.14, -9.0, mandapaTopY + 2.22, mandapaZ + 1.5);
  for (let pt = 0; pt < 3; pt++) {
    addCyl(pnW2Brick, 0.18, 0.24, 0.52, 6, -10.8, mandapaTopY + 0.52, mandapaZ - 0.8 + pt * 0.8);
  }
  // [317] Granite directional heritage signpost & bilingual history lectern at top of lower stairway
  addBox(pnW2Granite, 1.1, 1.15, 0.38, 4.2, mandapaTopY + 0.58, mandapaZ - 8.2);
  addBox(pnW2Gold, 0.92, 0.62, 0.06, 4.2, mandapaTopY + 1.22, mandapaZ - 8.2, 0, -0.42, 0);
  // [318] Low mossy brick retaining garden walls enclosing frangipani beds
  for (const sx of [-13.5, 13.5]) {
    addBox(pnW2Brick, 0.45, 0.65, 10.5, sx, mandapaTopY + 0.32, mandapaZ - 1.0);
    addColoredSphere(pnW2Flora, '#d9387a', 0.45, 5, 4, sx, mandapaTopY + 0.85, mandapaZ - 3.0);
  }
  // [319] Bronze temple gong (chiêng đồng) suspended in grounded 2-post frame beside Mandapa altar
  addCyl(pnW2Bronze, 0.52, 0.52, 0.10, 6, 3.6, mandapaTopY + 1.45, mandapaZ, 0, Math.PI * 0.5, 0);
  addBox(pnW2Sandstone, 1.45, 0.12, 0.12, 3.6, mandapaTopY + 2.15, mandapaZ);
  addBox(pnW2Sandstone, 0.12, 2.0, 0.12, 3.6 - 0.66, mandapaTopY + 1.15, mandapaZ);
  addBox(pnW2Sandstone, 0.12, 2.0, 0.12, 3.6 + 0.66, mandapaTopY + 1.15, mandapaZ);
  // [320] Carved stone oil-lamp pillars flanking upper stairway landing into 4-tower sanctuary
  for (const sx of [-3.6, 3.6]) {
    addCyl(pnW2Sandstone, 0.22, 0.28, 1.65, 6, sx, 1.42, -11.4);
    addCyl(pnW2Bronze, 0.28, 0.18, 0.24, 6, sx, 2.35, -11.4);
  }

  // Weathered grey-brown mossy sandstone (ctx.materials.stone) for Durga tympanum & Chăm carvings (ref 66)
  group.add(
    poBrickMesh,
    makeMergedMesh('PoNagarGraniteTerracesAndSteps', graniteParts, ctx.materials.granite),
    makeMergedMesh('PoNagarSandstoneReliefs', sandstoneParts, ctx.materials.stone),
    makeMergedMesh('PoNagarGoddessBlackStone', blackStoneParts, blackStoneMat),
    makeMergedMesh('PoNagarGoldAccents', goldParts, ctx.materials.gold),
    makeMergedMesh('PoNagarCrimsonOfferings', crimsonParts, ctx.materials.crimsonLacquer),
    makeMergedMesh('PoNagarBronzeCensers', bronzeParts, ctx.materials.bronze),
    makeMergedMesh('PoNagarMortiseHoles', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('PoNagarFrangipaniTrees', floraParts, poFloraMat),
    makeMergedMesh(
      'PoNagarSanctuaryLamps',
      lampCoreParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    ),
    // Wave 2 merged meshes (castShadow = false, zero new materials!)
    makeMergedMesh('PoNagarWave2Brick', pnW2Brick, poNagarBrickMat, false, true),
    makeMergedMesh('PoNagarWave2Granite', pnW2Granite, ctx.materials.granite, false, true),
    makeMergedMesh('PoNagarWave2Sandstone', pnW2Sandstone, ctx.materials.stone, false, true),
    makeMergedMesh('PoNagarWave2Gold', pnW2Gold, ctx.materials.gold, false, false),
    makeMergedMesh('PoNagarWave2Crimson', pnW2Crimson, ctx.materials.crimsonLacquer, false, true),
    makeMergedMesh('PoNagarWave2Bronze', pnW2Bronze, ctx.materials.bronze, false, true),
    makeMergedMesh('PoNagarWave2Flora', pnW2Flora, poFloraMat, false, false)
  );
  tagMotifIds(group, [
    'HV-C09', 'HV-C10', 'HV-F01', 'HV-F03', 'HV-F04', 'HV-F06', 'HV-F08',
    'HV-F09', 'HV-F10', 'HV-F11', 'HV-NEW-MN-05', 'HV-NEW-MN-06', 'HV-NEW-MN-07', 'HV-NEW-MN-08'
  ]);

  ctx.scene.add(group);
  // Add missing exclusion circle for Mandapa & lower stairs at (250, 255)!
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34.0 }, { x: 250, z: 255, r: 24.0 });
}

// ============================================================================
// 6. Chợ nổi Cái Răng — Cần Thơ (-72, 365)
//    28 animated Mekong merchant boats spanning 125m, hollow cargo holds,
//    6 produce cây bẹo varieties, long-tail motors, sculpted Hủ Tiếu sampans,
//    readable wharf archway + pitched roof, & 8 riverside wooden stilt shophouses
// ============================================================================
function createDuckweedTexture(renderer?: THREE.WebGLRenderer): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const rand = mulberry32(77315);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n = noise2D(x * 0.28, y * 0.28, 19.3) * 0.5 + 0.5;
      const speck = rand();
      const cluster = n * 0.65 + speck * 0.35;
      // Vibrant lime-emerald fine duckweed leaves with subtle organic depth (ref 34 & 100)
      const r = Math.round(THREE.MathUtils.lerp(116, 206, cluster));
      const g = Math.round(THREE.MathUtils.lerp(178, 242, cluster));
      const b = Math.round(THREE.MathUtils.lerp(56, 118, cluster));
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (renderer?.capabilities?.getMaxAnisotropy) {
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  tex.needsUpdate = true;
  return tex;
}

function createXuongBaLaSampanGeometry(seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const len = 5.4;
  const beam = 1.05;
  const hullH = 0.48;

  const hullGeo = new THREE.BoxGeometry(beam, hullH, len, 6, 3, 12);
  const pos = hullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const tz = Math.max(-1, Math.min(1, z / (len * 0.5)));
    const ty = Math.max(0, Math.min(1, (y + hullH * 0.5) / hullH));
    const planW = Math.pow(Math.max(0.06, 1.0 - Math.pow(Math.abs(tz), 1.9)), 0.6);
    const flare = 0.42 + 0.58 * Math.pow(ty, 0.55);
    const sheerLift = 0.28 * Math.pow(Math.abs(tz), 2.2);
    x *= planW * flare;
    y += sheerLift - 0.14;
    pos.setXYZ(i, x, y, z);
  }
  hullGeo.computeVertexNormals();
  parts.push(colorizeGeometry(hullGeo, '#5b3921'));

  // Gunwale trim & 3 wooden thwarts
  addColoredBox(parts, '#7b5231', beam * 0.72, 0.05, 0.24, 0, 0.14, -0.85);
  addColoredBox(parts, '#7b5231', beam * 0.84, 0.05, 0.24, 0, 0.14, 0.0);
  addColoredBox(parts, '#7b5231', beam * 0.72, 0.05, 0.24, 0, 0.14, 0.85);

  // FIX TS-05: Seated Mekong boatwoman wearing traditional áo bà ba & conical nón lá actively rowing each Trà Sư xuồng ba lá (ref 34!)
  const áoColor = seed % 2 === 0 ? '#5c3468' : '#2a6b54';
  const rowerTorso = new THREE.CylinderGeometry(0.14, 0.19, 0.62, 6);
  rowerTorso.rotateX(0.12);
  rowerTorso.translate(0.0, 0.48, -0.78);
  parts.push(colorizeGeometry(rowerTorso, áoColor));
  const rowerHead = new THREE.SphereGeometry(0.12, 6, 5);
  rowerHead.translate(0.0, 0.86, -0.76);
  parts.push(colorizeGeometry(rowerHead, '#dfb48e'));
  const nonLa = new THREE.ConeGeometry(0.30, 0.18, 10);
  nonLa.translate(0.0, 0.99, -0.76);
  parts.push(colorizeGeometry(nonLa, '#dec98a'));
  // Angled wooden rowing oar dipping into the emerald duckweed channel
  addColoredCylinder(parts, '#b9935a', 0.024, 0.026, 2.35, 5, 0.42, 0.42, -0.58, 0.25, 0.62, -0.45);
  addColoredBox(parts, '#9c733d', 0.14, 0.03, 0.46, 0.82, 0.04, -0.25, 0.35);

  // Woven basket of pink lotus / emerald greens at bow
  const basket = new THREE.CylinderGeometry(0.24, 0.18, 0.22, 8);
  basket.translate(-0.08, 0.24, 0.45);
  parts.push(colorizeGeometry(basket, '#c49b56'));

  if (seed % 2 === 0) {
    const lotus = new THREE.SphereGeometry(0.11, 7, 6);
    lotus.translate(-0.08, 0.37, 0.45);
    parts.push(colorizeGeometry(lotus, '#df6e8c'));
  }

  return mergeNormalized(parts);
}

// ============================================================================
// 7. Rừng tràm Trà Sư — An Giang (-245, 395)
//    88m emerald/mossy duckweed mat (y = 0.028m), 55m bamboo footbridge, 220+ 13-17m tràm trees
// ============================================================================
function buildTraSuMelaleucaForest(ctx: VietnamBuilderContext): JunkBoatMotion[] {
  const cx = -245;
  const cz = 395;

  const group = new THREE.Group();
  group.name = 'TraSuMelaleucaForestComplex';

  const channelZ = (wx: number) => cz + 5.4 * Math.sin((wx - cx) * 0.055);
  const bridgeZ = (wx: number) => cz + 0.42 * (cx - wx) * 0.42 + 4.2 * Math.sin((wx - cx) * 0.085);

  // 1. Expanded 116m × 94m Emerald Duckweed Carpet (`bèo cám`) at y = 0.028m
  const segX = 84;
  const segZ = 68;
  const spanX = 116.0;
  const spanZ = 94.0;
  const duckPositions: number[] = [];
  const duckColors: number[] = [];
  const duckNormals: number[] = [];
  const duckUvs: number[] = [];

  const c1 = new THREE.Color('#74b838');
  const c2 = new THREE.Color('#a6d654');
  const c3 = new THREE.Color('#427c28');
  const tmpCol = new THREE.Color();

  for (let ix = 0; ix < segX; ix++) {
    for (let iz = 0; iz < segZ; iz++) {
      const u0 = ix / segX;
      const u1 = (ix + 1) / segX;
      const v0 = iz / segZ;
      const v1 = (iz + 1) / segZ;

      const x0 = cx - spanX * 0.5 + u0 * spanX;
      const x1 = cx - spanX * 0.5 + u1 * spanX;
      const z0 = cz - spanZ * 0.5 + v0 * spanZ;
      const z1 = cz - spanZ * 0.5 + v1 * spanZ;

      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;

      const ellipseR = Math.hypot((mx - cx) / 56.0, (mz - cz) / 45.5);
      if (ellipseR > 1.0) continue;

      const n = noise2D(mx * 0.24, mz * 0.24, 31.7) * 0.5 + 0.5;
      const n2 = noise2D(mx * 0.65, mz * 0.65, 11.2) * 0.5 + 0.5;

      // Softer organic meandering boat-channel margin (ref 100_tra_su_cau_tre_rung_tram.jpg)
      const distChan = Math.abs(mz - channelZ(mx));
      const chanMargin = 2.85 + 0.85 * n2;
      if (distChan < chanMargin) continue;
      if (distChan < chanMargin + 1.1 && n < 0.42) continue;

      if (ellipseR > 0.86 && n < 0.36) continue;

      tmpCol.copy(c1).lerp(c2, clampVal(n * 0.72 + n2 * 0.35));
      if (distChan < chanMargin + 1.8) tmpCol.lerp(c3, 0.38);

      const yMat = 0.028;
      const verts: Array<[number, number, number, number, number]> = [
        [x0, yMat, z0, u0, v0],
        [x0, yMat, z1, u0, v1],
        [x1, yMat, z0, u1, v0],
        [x1, yMat, z0, u1, v0],
        [x0, yMat, z1, u0, v1],
        [x1, yMat, z1, u1, v1]
      ];
      for (const [vx, vy, vz, vu, vv] of verts) {
        duckPositions.push(vx, vy, vz);
        duckNormals.push(0, 1, 0);
        duckUvs.push(vu, vv);
        duckColors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      }
    }
  }

  const duckGeo = new THREE.BufferGeometry();
  duckGeo.setAttribute('position', new THREE.Float32BufferAttribute(duckPositions, 3));
  duckGeo.setAttribute('normal', new THREE.Float32BufferAttribute(duckNormals, 3));
  duckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(duckUvs, 2));
  duckGeo.setAttribute('color', new THREE.Float32BufferAttribute(duckColors, 3));

  const duckweedTex = createDuckweedTexture(ctx.renderer);
  ctx.extraTextures.push(duckweedTex);

  const duckweedMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: duckweedTex,
    roughness: 0.84,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  ctx.extraMaterials.push(duckweedMat);

  const duckMesh = new THREE.Mesh(duckGeo, duckweedMat);
  duckMesh.name = 'TraSuDuckweedCarpet';
  duckMesh.receiveShadow = true;
  group.add(duckMesh);

  // 2. Two Traditional *Xuồng Ba Lá* Wooden Sampans in the Open Boat Canal
  const sampanMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.74,
    metalness: 0.05
  });
  ctx.extraMaterials.push(sampanMat);

  const traSuBoats: JunkBoatMotion[] = [];
  const sampanSpecs: Array<{ x: number; zOff: number; yaw: number; seed: number }> = [
    { x: cx + 10.5, zOff: -1.1, yaw: 1.52, seed: 1 },
    { x: cx - 7.5, zOff: 1.2, yaw: -1.48, seed: 2 },
    { x: cx + 28.0, zOff: 0.9, yaw: 1.44, seed: 3 },
    { x: cx - 26.5, zOff: -0.9, yaw: -1.55, seed: 4 }
  ];
  for (let i = 0; i < sampanSpecs.length; i++) {
    const sp = sampanSpecs[i];
    const bz = channelZ(sp.x) + sp.zOff;
    const boatGroup = new THREE.Group();
    boatGroup.name = `TraSuSampan_${i + 1}`;
    boatGroup.position.set(sp.x, 0.02, bz);
    boatGroup.rotation.y = sp.yaw;

    const sampanMesh = new THREE.Mesh(createXuongBaLaSampanGeometry(sp.seed), sampanMat);
    sampanMesh.castShadow = true;
    sampanMesh.receiveShadow = true;
    boatGroup.add(sampanMesh);

    group.add(boatGroup);
    traSuBoats.push({
      group: boatGroup,
      centerX: sp.x,
      centerZ: bz,
      radiusX: 0.45,
      radiusZ: 0.25,
      speed: 0.22 + i * 0.05,
      phase: i * 1.4
    });
  }

  // 3. Winding Elevated 86m Long Bamboo Footbridge (*Cầu Tre Vạn Bước*) with Woven X-Brace Railings, 2 Rest Pavilions & Entrance Gate
  const bridgeParts: THREE.BufferGeometry[] = [];
  const bridgeStartX = cx + 41.0;
  const bridgeEndX = cx - 41.0;
  const bridgeSteps = 92;

  for (let i = 0; i < bridgeSteps; i++) {
    const t0 = i / bridgeSteps;
    const t1 = (i + 1) / bridgeSteps;
    const x0 = THREE.MathUtils.lerp(bridgeStartX, bridgeEndX, t0);
    const x1 = THREE.MathUtils.lerp(bridgeStartX, bridgeEndX, t1);
    const z0 = bridgeZ(x0);
    const z1 = bridgeZ(x1);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    const segLen = Math.hypot(x1 - x0, z1 - z0);

    const distChan = Math.abs(mz - channelZ(mx));
    const archLift = 0.85 * Math.exp(-Math.pow(distChan / 5.5, 2.0));
    const deckY = 1.05 + archLift;

    addColoredBox(bridgeParts, '#c4a462', 2.2, 0.14, segLen * 1.06, mx, deckY, mz, yaw);
    for (const side of [-1.02, 1.02]) {
      const rx = mx + Math.cos(yaw) * side;
      const rz = mz - Math.sin(yaw) * side;
      addColoredBox(bridgeParts, '#d1b574', 0.10, 0.10, segLen * 1.08, rx, deckY + 1.05, rz, yaw);
      // Woven X-brace bamboo railing struts
      addColoredCylinder(bridgeParts, '#b89852', 0.032, 0.032, Math.hypot(segLen, 1.0), 5, rx, deckY + 0.52, rz, yaw, 0.68, 0);
      addColoredCylinder(bridgeParts, '#b89852', 0.032, 0.032, Math.hypot(segLen, 1.0), 5, rx, deckY + 0.52, rz, yaw, -0.68, 0);
      if (i % 3 === 0) {
        addColoredCylinder(bridgeParts, '#6a4c2d', 0.08, 0.10, deckY + 1.65, 6, rx, (deckY - 1.25) * 0.5, rz);
        addColoredCylinder(bridgeParts, '#bfa05c', 0.05, 0.06, 1.1, 6, rx, deckY + 0.55, rz);
      }
    }
  }
  // [121][123][128][130] 2 Thatched Hexagonal Rest Pavilions (*Chòi nghỉ chân*) + Red Lanterns, Benches & East Entry Steps
  const pavThatchParts: THREE.BufferGeometry[] = [];
  for (const pavX of [cx - 18.0, cx + 18.0]) {
    const pavZ = bridgeZ(pavX);
    addColoredCylinder(bridgeParts, '#c4a462', 2.8, 2.8, 0.18, 6, pavX, 1.18, pavZ);
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      addColoredCylinder(bridgeParts, '#8f6b3e', 0.09, 0.11, 4.4, 6, pavX + Math.cos(a) * 2.4, 0.95, pavZ + Math.sin(a) * 2.4);
    }
    const pavRoof = new THREE.ConeGeometry(3.45, 1.92, 6);
    pavRoof.translate(pavX, 4.08, pavZ);
    pavThatchParts.push(pavRoof);
    addColoredBox(bridgeParts, '#9e743f', 1.8, 0.42, 0.48, pavX, 1.46, pavZ - 1.4);
    addColoredSphere(pavThatchParts, '#d93228', 0.22, 6, 5, pavX, 3.15, pavZ);
  }
  // [131][132][133][134][135][138][139][140] Bến Xuồng Boat-Landing Pier, 2 Tắc Ráng Tour Boats, Bird-Watching Hide & Channel Markers
  const pierTsX = cx + 22.0;
  const pierTsZ = channelZ(pierTsX) - 3.6;
  addColoredBox(bridgeParts, '#8f6b3e', 7.5, 0.22, 3.2, pierTsX, 0.85, pierTsZ);
  for (const px of [-3.2, 0, 3.2]) {
    addColoredCylinder(bridgeParts, '#6a4c2d', 0.11, 0.13, 2.2, 6, pierTsX + px, 0.15, pierTsZ + 1.2);
  }
  // 2 Tắc Ráng tour boats moored at Bến Xuồng
  for (const bxOff of [-2.2, 2.2]) {
    addColoredBox(bridgeParts, '#5c3b22', 0.95, 0.36, 5.4, pierTsX + bxOff, 0.16, pierTsZ + 3.2, 0.15);
    addColoredCylinder(bridgeParts, '#9aa4ad', 0.025, 0.025, 1.9, 5, pierTsX + bxOff - 0.2, 0.38, pierTsZ + 5.8, 0.15, Math.PI * 0.42, 0);
  }
  // Wooden Bird-Watching Hide (Chòi ngắm chim) grounded on 4 wetland stilts
  const hideX = cx - 4.0;
  const hideZ = cz + 18.0;
  for (const hxOff of [-1.4, 1.4]) {
    for (const hzOff of [-1.2, 1.2]) {
      addColoredCylinder(bridgeParts, '#6a4c2d', 0.10, 0.12, 2.1, 6, hideX + hxOff, -0.25, hideZ + hzOff);
    }
  }
  addColoredBox(bridgeParts, '#7a5832', 3.2, 2.4, 2.8, hideX, 1.8, hideZ);
  const hideRoof = new THREE.ConeGeometry(2.6, 1.35, 4);
  hideRoof.rotateY(Math.PI * 0.25);
  hideRoof.translate(hideX, 3.65, hideZ);
  pavThatchParts.push(hideRoof);
  for (let m = 0; m < 8; m++) {
    const mx = cx - 32 + m * 9.0;
    addColoredCylinder(bridgeParts, '#b89852', 0.04, 0.05, 1.65, 5, mx, 0.45, channelZ(mx) + 2.6);
  }
  // Arched Bamboo Entrance Gate & Readable "RỪNG TRÀM TRÀ SƯ" Plaque at East Entry
  const gateX = bridgeStartX + 1.5;
  const gateZ = bridgeZ(bridgeStartX);
  for (const sz of [-1.45, 1.45]) {
    addColoredCylinder(bridgeParts, '#b89852', 0.12, 0.14, 4.4, 6, gateX, 2.2, gateZ + sz);
  }
  const gateRoof = new THREE.ConeGeometry(2.45, 1.15, 4);
  gateRoof.rotateY(Math.PI * 0.25);
  gateRoof.translate(gateX, 4.65, gateZ);
  pavThatchParts.push(gateRoof);
  const traSuSign = createSignagePlaqueMesh(
    { text: 'RỪNG TRÀM TRÀ SƯ', subText: 'CẦU TRE VẠN BƯỚC', width: 4.4, height: 0.9, style: 'market' },
    ctx
  );
  traSuSign.rotation.y = Math.PI * 0.5;
  traSuSign.position.set(gateX, 3.85, gateZ);
  group.add(traSuSign);

  // 3b. Iconic 23m-Tall Observation Tower (*Đài Quan Sát*) with X-Bracing Struts rising above Melaleuca canopy at (cx - 16, cz - 22)
  const obsX = cx - 16.0;
  const obsZ = cz - 22.0;
  const towerSteelParts: THREE.BufferGeometry[] = [];
  for (const ox of [-2.4, 2.4]) {
    for (const oz of [-2.4, 2.4]) {
      addCyl(towerSteelParts, 0.14, 0.22, 20.8, 7, obsX + ox, 9.6, obsZ + oz);
    }
  }
  const braceDiag = Math.hypot(4.8, 4.0);
  const braceTilt = Math.atan2(4.8, 4.0);
  for (let tier = 0; tier < 5; tier++) {
    const ty = 3.2 + tier * 4.0;
    addBox(towerSteelParts, 5.1, 0.22, 5.1, obsX, ty, obsZ);
    // Crossed diagonal steel X-bracing struts on all 4 bay faces!
    const bayMidY = ty - 2.0;
    for (const side of [-2.4, 2.4]) {
      for (const diagSign of [-1, 1]) {
        addCyl(towerSteelParts, 0.055, 0.055, braceDiag, 5, obsX, bayMidY, obsZ + side, 0, 0, diagSign * braceTilt);
        addCyl(towerSteelParts, 0.055, 0.055, braceDiag, 5, obsX + side, bayMidY, obsZ, 0, diagSign * braceTilt, 0);
      }
    }
    if (tier === 4) {
      // [122][137] Top observation deck + safety rails + brass binoculars + ground rest benches at y = 19.2m
      for (const s of [-2.5, 2.5]) {
        addBox(towerSteelParts, 5.2, 0.12, 0.12, obsX, ty + 1.15, obsZ + s);
        addBox(towerSteelParts, 0.12, 0.12, 5.2, obsX + s, ty + 1.15, obsZ);
      }
      addCyl(towerSteelParts, 0.85, 0.95, 19.2, 8, obsX, 9.4, obsZ); // central spiral staircase core
      addCyl(towerSteelParts, 0.06, 0.08, 1.25, 6, obsX + 1.8, ty + 0.65, obsZ + 1.8);
      addBox(towerSteelParts, 0.22, 0.14, 0.36, obsX + 1.8, ty + 1.32, obsZ + 1.8);
      addBox(towerSteelParts, 2.0, 0.45, 0.55, obsX - 1.2, 0.45, obsZ + 2.8);
    }
  }
  // FIX TS-04: Eco-park green corrugated steel hipped roof (flat non-pagoda eaves, #2e573e)
  const obsRoof = createVietnameseCurvedRoofGeometry(6.8, 6.8, 0.6, 0.6, 2.2, 0.02);
  obsRoof.translate(obsX, 20.6, obsZ);
  const obsRoofMat = new THREE.MeshStandardMaterial({ color: '#2e573e', roughness: 0.46, metalness: 0.38 });
  const obsTowerMat = new THREE.MeshStandardMaterial({ color: '#465866', metalness: 0.65, roughness: 0.38 });
  ctx.extraMaterials.push(obsRoofMat, obsTowerMat);
  group.add(
    new THREE.Mesh(mergeNormalized(towerSteelParts), obsTowerMat),
    new THREE.Mesh(obsRoof, obsRoofMat)
  );

  // FIX TS-03: Apply woven bamboo PBR texture to Cầu Tre Vạn Bước & fibrous thatch to rest pavilions!
  const bridgeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: ctx.pbr.bambooWeave?.map,
    normalMap: ctx.pbr.bambooWeave?.normalMap,
    roughnessMap: ctx.pbr.bambooWeave?.roughnessMap,
    roughness: 0.80,
    metalness: 0.04
  });
  ctx.extraMaterials.push(bridgeMat);
  group.add(
    makeMergedMesh('TraSuBambooFootbridge', bridgeParts, bridgeMat),
    makeMergedMesh('TraSuPavilionThatchRoofs', pavThatchParts, ctx.materials.thatchFiber ?? bridgeMat)
  );

  // 4. Dense Instanced 13–17m Tall Organic Melaleuca (*cây tràm*) Trunks & Crowns (openEnded 5-sided cylinders for high density within triangle budget!)
  const trunkParts: THREE.BufferGeometry[] = [];
  const lowerStem = new THREE.CylinderGeometry(0.16, 0.24, 2.8, 5, 1, true);
  lowerStem.translate(0, 1.4, 0);
  const midStem = new THREE.CylinderGeometry(0.13, 0.16, 5.4, 5, 1, true);
  midStem.rotateZ(0.065);
  midStem.translate(-0.18, 5.4, 0.06);
  const upperStem = new THREE.CylinderGeometry(0.09, 0.13, 5.8, 5, 1, true);
  upperStem.rotateZ(-0.07);
  upperStem.rotateX(0.04);
  upperStem.translate(-0.16, 10.7, 0.12);
  const forkA = new THREE.CylinderGeometry(0.06, 0.11, 5.2, 4, 1, true);
  forkA.rotateZ(0.29);
  forkA.translate(-0.82, 10.6, 0.25);
  const forkB = new THREE.CylinderGeometry(0.055, 0.105, 4.9, 4, 1, true);
  forkB.rotateZ(-0.26);
  forkB.rotateX(0.20);
  forkB.translate(0.58, 10.9, -0.32);
  trunkParts.push(lowerStem, midStem, upperStem, forkA, forkB);

  const trunkGeo = mergeNormalized(trunkParts);
  // FIX TS-01: Authentic mossy grey-brown Melaleuca paperbark gradient (#242d1b wet base -> #696448 moss-bark -> #8f8872 weathered upper, NO bright birch-white!)
  const tPos = trunkGeo.attributes.position;
  const tColors = new Float32Array(tPos.count * 3);
  const mossBaseCol = new THREE.Color('#242d1b');
  const midBarkCol = new THREE.Color('#5f623d');
  const paleBarkCol = new THREE.Color('#8f8872');
  const gradCol = new THREE.Color();
  for (let i = 0; i < tPos.count; i++) {
    const py = tPos.getY(i);
    if (py < 1.8) {
      gradCol.copy(mossBaseCol).lerp(midBarkCol, clampVal(py / 1.8));
    } else if (py < 4.5) {
      gradCol.copy(midBarkCol).lerp(paleBarkCol, clampVal((py - 1.8) / 2.7));
    } else {
      gradCol.copy(paleBarkCol);
    }
    tColors[i * 3] = gradCol.r;
    tColors[i * 3 + 1] = gradCol.g;
    tColors[i * 3 + 2] = gradCol.b;
  }
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));

  const canopyParts: THREE.BufferGeometry[] = [];
  const cardOffsets: Array<[number, number, number, number]> = [
    [0, 13.0, 0, 5.6],
    [-1.15, 11.7, 0.55, 4.4],
    [1.15, 11.9, -0.55, 4.4]
  ];
  for (const [ox, oy, oz, sz] of cardOffsets) {
    for (let k = 0; k < 2; k++) {
      const card = new THREE.PlaneGeometry(sz, sz * 0.88);
      card.rotateY((k / 2) * Math.PI + 0.4);
      card.translate(ox, oy, oz);
      canopyParts.push(card);
    }
  }
  const canopyGeo = mergeNormalized(canopyParts);

  const melaleucaBarkMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    normalMap: ctx.pbr.bark.normalMap,
    roughness: 0.90
  });

  const windUniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 2.0 }
  };
  ctx.foliageWindUniforms.push(windUniforms);

  const melaleucaLeafMat = new THREE.MeshStandardMaterial({
    color: '#3f8432',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.4,
    roughness: 0.74,
    side: THREE.DoubleSide
  });
  melaleucaLeafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindSpeed = windUniforms.uWindSpeed;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWindSpeed;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float swayH = clamp((position.y - 8.5) / 6.0, 0.0, 1.0);
         vec3 instOrigin = vec3(0.0);
         #ifdef USE_INSTANCING
         instOrigin = vec3(instanceMatrix[3].xyz);
         #endif
         float ph = dot(instOrigin.xz, vec2(0.14, 0.12)) - uTime * (uWindSpeed * 0.85);
         transformed.x += sin(ph) * 0.35 * swayH;
         transformed.z += cos(ph * 0.8) * 0.28 * swayH;`
      );
  };

  ctx.extraMaterials.push(melaleucaBarkMat, melaleucaLeafMat);

  // FIX TS-01: Dense immersive Trà Sư Melaleuca forest (480 closely spaced trees + narrower 3.8m intimate boat canal — ref 34, 100!)
  const maxTrees = 480;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, melaleucaBarkMat, maxTrees);
  trunkInst.name = 'TraSuMelaleucaTrunks';
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;
  trunkInst.frustumCulled = false;

  const canopyInst = new THREE.InstancedMesh(canopyGeo, melaleucaLeafMat, maxTrees);
  canopyInst.name = 'TraSuMelaleucaCanopies';
  canopyInst.castShadow = true;
  canopyInst.frustumCulled = false;

  const rand = mulberry32(92146);
  const dummy = new THREE.Matrix4();
  const col = new THREE.Color();
  let treeIdx = 0;
  // Record actual placed Melaleuca crown coordinates so ALL 20 egret nests anchor directly onto real tree crowns!
  const placedTreeCrowns: Array<{ wx: number; wz: number; crownY: number }> = [];

  for (let attempt = 0; attempt < 4800 && treeIdx < maxTrees; attempt++) {
    const rx = (rand() * 2 - 1) * 56.0;
    const rz = (rand() * 2 - 1) * 45.5;
    if (Math.hypot(rx / 56.0, rz / 45.5) > 0.96) continue;

    const wx = cx + rx;
    const wz = cz + rz;

    // Keep narrow 3.8m intimate boat canal, bamboo footbridge, pavilions & Observation Tower unobstructed
    if (Math.abs(wz - channelZ(wx)) < 3.8) continue;
    if (Math.abs(wz - bridgeZ(wx)) < 3.2) continue;
    if (Math.hypot(wx - obsX, wz - obsZ) < 6.2) continue;
    if (rx > 16.0 && Math.abs(wz - channelZ(wx)) < 8.5) continue;

    const wy = ctx.getHeight(wx, wz);
    const baseY = Math.min(-0.1, wy - 0.2);
    const sc = 0.92 + rand() * 0.30; // ~13-17m tall!
    const syScale = sc * (0.94 + rand() * 0.22);
    const leanX = (rand() - 0.5) * 0.16;
    const leanZ = (rand() - 0.5) * 0.16;

    dummy.compose(
      new THREE.Vector3(wx, baseY, wz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(leanX, rand() * Math.PI * 2, leanZ)),
      new THREE.Vector3(sc, syScale, sc)
    );
    trunkInst.setMatrixAt(treeIdx, dummy);
    canopyInst.setMatrixAt(treeIdx, dummy);

    placedTreeCrowns.push({
      wx: wx + Math.sin(leanZ) * 12.2 * syScale,
      wz: wz - Math.sin(leanX) * 12.2 * syScale,
      crownY: baseY + 12.6 * syScale
    });

    col.setHSL(0.28 + (rand() - 0.5) * 0.04, 0.52, 0.38 + rand() * 0.14);
    canopyInst.setColorAt(treeIdx, col);
    treeIdx++;
  }

  trunkInst.count = treeIdx;
  canopyInst.count = treeIdx;
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;

  // [124][125][126][136] Floating Purple Water Hyacinth (*Lục Bình*), Blooming Lotus, Tall Reeds & Flying White Egrets
  const wildlifeParts: THREE.BufferGeometry[] = [];
  const randWild = mulberry32(99512);
  for (let i = 0; i < 36; i++) {
    const hx = cx + (randWild() - 0.5) * 92;
    const hz = channelZ(hx) + (randWild() > 0.5 ? 1 : -1) * (2.6 + randWild() * 2.0);
    addColoredSphere(wildlifeParts, '#3a8832', 0.42, 6, 5, hx, 0.08, hz, 1.2, 0.45, 1.2);
    addColoredSphere(wildlifeParts, '#9a5de8', 0.18, 6, 5, hx, 0.28, hz);
    if (i % 3 === 0) {
      addColoredCylinder(wildlifeParts, '#2d752a', 0.36, 0.36, 0.04, 7, hx + 0.8, 0.06, hz);
      addColoredSphere(wildlifeParts, '#ec6d94', 0.14, 5, 4, hx + 0.8, 0.16, hz);
    }
    if (i % 4 === 0) {
      addColoredCylinder(wildlifeParts, '#5c7c32', 0.03, 0.05, 1.45, 4, hx - 0.7, 0.72, hz);
    }
  }
  for (let fe = 0; fe < 6; fe++) {
    const fx = cx - 22 + fe * 9.0;
    const fz = cz - 8 + (fe % 2) * 14.0;
    const fy = 16.5 + (fe % 3) * 1.6;
    addColoredSphere(wildlifeParts, '#f8f8f4', 0.20, 6, 4, fx, fy, fz, 0.8, 0.6, 1.6);
    addColoredBox(wildlifeParts, '#f8f8f4', 1.45, 0.05, 0.32, fx, fy + 0.06, fz, 0.2);
  }
  const nestCount = Math.min(20, placedTreeCrowns.length);
  const nestStride = Math.max(1, Math.floor(placedTreeCrowns.length / Math.max(1, nestCount)));
  for (let e = 0; e < nestCount; e++) {
    const crown = placedTreeCrowns[(e * nestStride + 3) % placedTreeCrowns.length];
    const ex = crown.wx;
    const ez = crown.wz;
    const ey = crown.crownY;
    const eYaw = randWild() * Math.PI * 2;
    // Woven twig nest nestled directly inside real Melaleuca crown fork
    addColoredCylinder(wildlifeParts, '#6b4c28', 0.52, 0.34, 0.24, 8, ex, ey - 0.12, ez);
    // Perched white egret: sculpted oval body, slender S-neck, head & golden beak
    addColoredSphere(wildlifeParts, '#f8f8f4', 0.22, 7, 5, ex, ey + 0.16, ez, 0.85, 0.72, 1.45);
    addColoredCylinder(wildlifeParts, '#f8f8f4', 0.045, 0.06, 0.38, 6, ex + Math.sin(eYaw) * 0.16, ey + 0.40, ez + Math.cos(eYaw) * 0.16);
    addColoredSphere(wildlifeParts, '#f8f8f4', 0.085, 6, 5, ex + Math.sin(eYaw) * 0.18, ey + 0.60, ez + Math.cos(eYaw) * 0.18);
    addColoredCone(wildlifeParts, '#e09128', 0.045, 0.24, 5, ex + Math.sin(eYaw) * 0.34, ey + 0.58, ez + Math.cos(eYaw) * 0.34, eYaw, Math.PI * 0.48, 0);
  }
  const wildlifeMat =
    ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.78, metalness: 0.04 }) ??
    ctx.materials.stone;
  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (321–340) — Low-Poly, castShadow=false
  // ==========================================================================
  const tsW2Bamboo: THREE.BufferGeometry[] = [];
  const tsW2Thatch: THREE.BufferGeometry[] = [];
  const tsW2Steel: THREE.BufferGeometry[] = [];
  const tsW2Wild: THREE.BufferGeometry[] = [];

  // [321] 3 Iconic Woven-Bamboo Tunnel Arches (Cổng Vòm Tre Vạn Bước) along 86m footbridge
  for (const ax of [cx - 28.0, cx, cx + 28.0]) {
    const az = bridgeZ(ax);
    const ay = 1.15 + 0.85 * Math.exp(-Math.pow(Math.abs(az - channelZ(ax)) / 5.5, 2.0));
    for (const side of [-1.15, 1.15]) {
      addColoredCylinder(tsW2Bamboo, '#c4a462', 0.08, 0.10, 2.9, 5, ax, ay + 1.45, az + side);
    }
    addColoredBox(tsW2Bamboo, '#d1b574', 0.22, 0.18, 2.6, ax, ay + 2.95, az);
    addColoredBox(tsW2Bamboo, '#b89852', 0.22, 0.14, 1.8, ax, ay + 3.22, az);
  }
  // [322][330] Floating Wooden Lotus-Viewing Dock (Bến Sen Trà Sư) with pilings extending up to handrail & Expanded Lotus Lagoon clusters
  const lotX = cx - 10.0;
  const lotZ = channelZ(lotX) + 4.2;
  addColoredBox(tsW2Bamboo, '#8f6b3e', 5.2, 0.20, 3.6, lotX, 0.72, lotZ);
  for (const ox of [-2.4, 2.4]) {
    addColoredCylinder(tsW2Bamboo, '#6a4c2d', 0.09, 0.11, 2.9, 5, lotX + ox, 0.25, lotZ + 1.6);
  }
  addColoredBox(tsW2Bamboo, '#c4a462', 5.2, 0.08, 0.08, lotX, 1.65, lotZ + 1.65);
  for (let l = 0; l < 6; l++) {
    const la = (l / 6) * Math.PI * 2;
    const lx = lotX + Math.cos(la) * 3.8;
    const lz = lotZ + 2.4 + Math.sin(la) * 2.2;
    addColoredCylinder(tsW2Wild, '#2d752a', 0.42, 0.42, 0.04, 6, lx, 0.06, lz);
    addColoredCone(tsW2Wild, l % 2 === 0 ? '#ee6e96' : '#f7f2ea', 0.16, 0.22, 5, lx, 0.18, lz);
  }
  // [323] Heart-shaped Bamboo Photo Frame on scenic bridge bend
  const pfX = cx + 8.0;
  const pfZ = bridgeZ(pfX) - 1.3;
  addColoredBox(tsW2Bamboo, '#d8b468', 2.2, 0.14, 0.14, pfX, 3.45, pfZ);
  addColoredBox(tsW2Bamboo, '#d8b468', 0.14, 2.2, 0.14, pfX - 1.05, 2.35, pfZ);
  addColoredBox(tsW2Bamboo, '#d8b468', 0.14, 2.2, 0.14, pfX + 1.05, 2.35, pfZ);
  // [324][325][335] Thatched Bến Xuồng Ticket & Waiting Pavilion, water-gauge marker & bamboo mooring cleats
  addColoredBox(tsW2Bamboo, '#9e743f', 2.2, 0.92, 1.1, pierTsX - 1.8, 1.38, pierTsZ - 0.6);
  const bqRoof = new THREE.ConeGeometry(3.4, 1.45, 4);
  bqRoof.rotateY(Math.PI * 0.25);
  bqRoof.translate(pierTsX, 3.45, pierTsZ - 0.4);
  tsW2Thatch.push(bqRoof);
  for (const ox of [-2.2, 2.2]) {
    addColoredCylinder(tsW2Bamboo, '#8f6b3e', 0.08, 0.10, 2.6, 5, pierTsX + ox, 2.1, pierTsZ - 0.4);
  }
  addColoredBox(tsW2Wild, '#f2efe6', 0.14, 1.8, 0.14, pierTsX + 4.1, 0.9, pierTsZ + 1.2); // water gauge
  addColoredCylinder(tsW2Bamboo, '#c8a662', 0.18, 0.20, 0.18, 6, pierTsX - 2.6, 1.02, pierTsZ + 1.3); // rope coil
  // [326] Floating wooden duckweed-skimming maintenance raft moored near canal bend
  addColoredBox(tsW2Bamboo, '#7a5630', 2.4, 0.18, 3.6, cx - 22.0, 0.12, channelZ(cx - 22.0) - 2.4, 0.35);
  // [327][328] Observation Tower ground-level eco-park info boards, covered rest kiosk & intermediate deck benches
  addBox(tsW2Steel, 2.2, 1.4, 0.14, obsX + 2.6, 1.4, obsZ + 2.8);
  addBox(tsW2Steel, 1.8, 0.42, 0.48, obsX, 11.4, obsZ + 2.1);
  addBox(tsW2Steel, 1.2, 0.35, 0.12, obsX - 1.8, 19.8, obsZ - 2.45);
  // [329][332][336] Traditional fish-trap (Lờ/Lợp) display, perched wetland storks & bird-species boards at bird hide
  addColoredCylinder(tsW2Bamboo, '#c4a462', 0.22, 0.28, 1.15, 6, hideX + 2.4, 0.45, hideZ - 1.2, 0.4, Math.PI * 0.5, 0);
  addColoredBox(tsW2Bamboo, '#d8c598', 1.4, 0.72, 0.08, hideX, 2.1, hideZ - 1.45);
  for (let st = 0; st < 3; st++) {
    addColoredCylinder(tsW2Wild, '#f4f4ee', 0.10, 0.14, 0.55, 5, hideX - 2.6 - st * 1.1, 0.48, hideZ + 1.2);
  }
  // [331] Hanging bamboo lanterns & Nón Lá garland on East Entrance Gate
  for (const lz of [-0.9, 0.0, 0.9]) {
    addColoredCone(tsW2Bamboo, '#dec98a', 0.26, 0.16, 6, gateX, 3.35, gateZ + lz);
  }
  // [333][334][338] Melaleuca honey tasting eco-stall, raised timber walkway spur & grounded 4-post bamboo arrival pergola
  addColoredBox(tsW2Bamboo, '#9c723e', 2.4, 0.88, 1.2, gateX + 4.8, 0.52, gateZ - 2.8);
  addColoredCylinder(tsW2Wild, '#e8a822', 0.12, 0.12, 0.26, 5, gateX + 4.4, 1.10, gateZ - 2.8);
  addColoredBox(tsW2Bamboo, '#8f6b3e', 1.8, 0.16, 14.0, obsX + 4.5, 0.85, obsZ + 10.5, 0.42);
  addColoredBox(tsW2Bamboo, '#c4a462', 3.4, 0.12, 3.4, gateX + 4.8, 2.65, gateZ);
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.5, 1.5]) {
      addColoredCylinder(tsW2Bamboo, '#8f6b3e', 0.07, 0.09, 2.85, 5, gateX + 4.8 + ox, 1.22, gateZ + oz);
    }
  }
  // [337][339][340] Mossy fallen-log bridges, solar canal beacons & woven bamboo waste bins + rest stools
  addColoredCylinder(tsW2Bamboo, '#5c4228', 0.22, 0.26, 4.2, 5, cx + 12.0, 0.18, cz + 14.0, 0.6, Math.PI * 0.5, 0);
  for (const bxM of [cx + 34.0, cx + 42.0]) {
    addColoredCylinder(tsW2Wild, '#d83828', 0.12, 0.16, 1.2, 5, bxM, 0.55, channelZ(bxM) + 2.8);
  }
  for (const pavX of [cx - 18.0, cx + 18.0]) {
    const pavZ = bridgeZ(pavX);
    addColoredCylinder(tsW2Bamboo, '#8a6838', 0.22, 0.18, 0.52, 6, pavX + 1.5, 1.52, pavZ + 1.2);
    addColoredBox(tsW2Bamboo, '#9e743f', 0.45, 0.42, 0.45, pavX - 1.2, 1.48, pavZ + 1.0);
  }

  group.add(
    new THREE.Mesh(mergeNormalized(wildlifeParts), wildlifeMat),
    // Wave 2 merged meshes (castShadow = false, zero new materials!)
    makeMergedMesh('TraSuWave2Bamboo', tsW2Bamboo, bridgeMat, false, true),
    makeMergedMesh('TraSuWave2Thatch', tsW2Thatch, ctx.materials.thatchFiber ?? bridgeMat, false, true),
    makeMergedMesh('TraSuWave2Steel', tsW2Steel, obsTowerMat, false, true),
    makeMergedMesh('TraSuWave2Wildlife', tsW2Wild, wildlifeMat, false, false)
  );

  group.add(trunkInst, canopyInst);
  tagMotifIds(group, ['HV-C04', 'HV-C06', 'HV-NEW-MN-11']);
  ctx.scene.add(group);
  return traSuBoats;
}

// ============================================================================
// 8. Mũi Cà Mau (0, 485)
//    Mangrove boardwalk (z = 445..502), 19m Km 2436 / GPS 0001 stela, 18m Con Tàu prow & sail
// ============================================================================
function buildMuiCaMau(ctx: VietnamBuilderContext): void {
  const cx = 0;
  const cz = 485;
  const yBase = ctx.getHeight(cx, cz);

  const group = new THREE.Group();
  group.name = 'MuiCaMauComplex';

  const woodParts: THREE.BufferGeometry[] = [];
  const graniteParts: THREE.BufferGeometry[] = [];
  const shipParts: THREE.BufferGeometry[] = [];

  // 1. Elevated Coastal Concrete/Timber Mangrove Boardwalk (z = 445..502, pilings to y = -3.0m)
  const deckY = 1.85;
  addBox(woodParts, 8.2, 0.28, 36.0, 0, deckY, 463.0);
  // Broad southern viewing terrace at cape tip (z = 480..502)
  addBox(woodParts, 22.0, 0.32, 22.0, 0, deckY, 491.0);

  // Smooth north approach ramp meeting embankment ground at z = 443..445
  const rampGroundY = ctx.getHeight(0, 442.5);
  const rampMidY = (deckY + rampGroundY) * 0.5;
  const rampPitch = Math.atan2(deckY - rampGroundY, 3.0);
  addBox(woodParts, 8.2, 0.32, 3.4, 0, rampMidY, 444.0, 0, -rampPitch, 0);
  addBox(woodParts, 8.0, 1.8, 2.0, 0, rampGroundY - 0.3, 442.8);

  // Deep pilings grounded down to y = -3.0m (4.85m long)
  for (let pz = 446; pz <= 501; pz += 4.5) {
    const xs = pz >= 480 ? [-10.2, -4.0, 4.0, 10.2] : [-3.8, 3.8];
    for (const px of xs) {
      addCyl(woodParts, 0.18, 0.22, deckY + 3.0, 8, px, (deckY - 3.0) * 0.5, pz);
    }
  }

  // Boardwalk & 22×22m Viewing Terrace complete connected safety railings (Fixes Bug B15!)
  addBox(woodParts, 0.14, 0.12, 35.0, -3.95, deckY + 1.05, 462.5);
  addBox(woodParts, 0.14, 0.12, 35.0, 3.95, deckY + 1.05, 462.5);
  for (let pz = 446; pz <= 501; pz += 3.5) {
    const rx = pz >= 480 ? 10.8 : 3.95;
    addBox(woodParts, 0.16, 1.15, 0.16, -rx, deckY + 0.58, pz);
    addBox(woodParts, 0.16, 1.15, 0.16, rx, deckY + 0.58, pz);
  }
  for (const hOff of [0.55, 1.08]) {
    addBox(woodParts, 0.14, 0.10, 22.0, -10.8, deckY + hOff, 491.0);
    addBox(woodParts, 0.14, 0.10, 22.0, 10.8, deckY + hOff, 491.0);
    addBox(woodParts, 21.8, 0.10, 0.14, 0, deckY + hOff, 501.8);
    addBox(woodParts, 6.8, 0.10, 0.14, -7.4, deckY + hOff, 480.2);
    addBox(woodParts, 6.8, 0.10, 0.14, 7.4, deckY + hOff, 480.2);
  }

  // 2. FIX CM-03: Authentic Flat Beveled 4-Point Granite Compass-Star Plinth (ExtrudeGeometry — NO spiky horizontal cones!) + GPS 0001 Stele
  const gpsZ = 465.0;
  addCyl(graniteParts, 4.8, 5.1, 0.36, 24, 0, deckY + 0.18, gpsZ);
  const starShape = new THREE.Shape();
  const rOuter = 3.85;
  const rInner = 1.25;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? rOuter : rInner;
    const sx = Math.sin(a) * rad;
    const sy = Math.cos(a) * rad;
    if (i === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();
  const starPlinth = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2
  });
  starPlinth.rotateX(-Math.PI * 0.5);
  starPlinth.translate(0, deckY + 0.36, gpsZ);
  graniteParts.push(starPlinth);
  // Crisp tapered granite GPS 0001 stele rising cleanly from compass-star center
  addCyl(graniteParts, 0.78, 1.02, 2.75, 4, 0, deckY + 2.15, gpsZ, Math.PI * 0.25, 0, 0);
  addCyl(graniteParts, 0.08, 0.80, 0.58, 4, 0, deckY + 3.80, gpsZ, Math.PI * 0.25, 0, 0);

  const gpsSign = createSignagePlaqueMesh(
    { text: 'GPS 0001 — KM 2436', subText: 'MŨI CÀ MAU — CỰC NAM', width: 2.2, height: 0.95, style: 'stone' },
    ctx
  );
  gpsSign.rotation.y = Math.PI;
  gpsSign.position.set(0, deckY + 1.85, gpsZ - 0.78);
  group.add(gpsSign);

  // Km 2436 — Điểm cuối Đường Hồ Chí Minh stone milestone beside GPS 0001
  addBox(graniteParts, 0.92, 1.65, 0.36, -3.1, deckY + 0.95, gpsZ - 0.4);
  const kmSign = createSignagePlaqueMesh(
    { text: 'KM 2436', subText: 'ĐƯỜNG HỒ CHÍ MINH', width: 1.05, height: 0.68, style: 'stone', motifSeed: 2436 },
    ctx
  );
  kmSign.rotation.y = Math.PI;
  kmSign.position.set(-3.1, deckY + 1.15, gpsZ - 0.60);
  group.add(kmSign);

  // [146][147][154] Boardwalk viewing benches, solar coastal lampposts & mangrove Cầu Khỉ spur trail
  for (let bz = 450; bz <= 474; bz += 8) {
    for (const side of [-1, 1]) {
      addBox(woodParts, 0.55, 0.44, 1.8, side * 3.3, deckY + 0.22, bz);
      addCyl(graniteParts, 0.05, 0.07, 3.2, 6, side * 3.85, deckY + 1.6, bz);
      addColoredBox(shipParts, '#234a78', 0.45, 0.05, 0.35, side * 3.85, deckY + 3.25, bz);
    }
  }
  // Mangrove Cầu Khỉ observation spur trail branching west into Cây Đước roots
  for (let sp = 0; sp < 5; sp++) {
    addBox(woodParts, 2.2, 0.14, 1.2, -5.0 - sp * 2.2, deckY - 0.1, 458.0);
    addCyl(woodParts, 0.10, 0.12, 3.8, 6, -5.0 - sp * 2.2, 0.1, 458.0);
  }
  // [141][148] GPS 0001 corner granite bollards & Km 2436 protective curb
  for (const bxS of [-4.2, 4.2]) {
    for (const bzS of [-4.2, 4.2]) {
      addCyl(graniteParts, 0.16, 0.20, 0.85, 6, bxS, deckY + 0.42, gpsZ + bzS);
    }
  }
  addBox(graniteParts, 1.45, 0.24, 0.85, -3.1, deckY + 0.12, gpsZ - 0.4);

  // [143][144] Cột Cờ Hà Nội tại Mũi Cà Mau entrance stairs & bronze relief panels (36m-tall at (20, 474))
  addBox(graniteParts, 4.4, 1.1, 2.2, 20.0, ctx.getHeight(20.0, 474.0) + 0.55, 467.8);
  addColoredBox(shipParts, '#7a5228', 2.4, 1.2, 0.14, 20.0, ctx.getHeight(20.0, 474.0) + 1.6, 468.25);
  const fcx = 20.0;
  const fcz = 474.0;
  const fcy = ctx.getHeight(fcx, fcz);
  const brickFlagParts: THREE.BufferGeometry[] = [];
  const flagVoidParts: THREE.BufferGeometry[] = [];
  const tierSpecs: Array<[number, number, number]> = [
    [11.4, 3.2, fcy + 1.1],
    [8.2, 2.8, fcy + 4.1],
    [5.4, 2.4, fcy + 6.7]
  ];
  for (let t = 0; t < tierSpecs.length; t++) {
    const [tw, th, ty] = tierSpecs[t];
    addBox(brickFlagParts, tw, th, tw, fcx, ty, fcz);
    // Low brick parapet framing each stepped terrace deck
    const topY = ty + th * 0.5 + 0.32;
    const half = tw * 0.5 - 0.16;
    for (const s of [-1, 1]) {
      addBox(brickFlagParts, tw, 0.62, 0.30, fcx, topY, fcz + s * half);
      addBox(brickFlagParts, 0.30, 0.62, tw, fcx + s * half, topY, fcz);
    }
    // Arched masonry portal on cardinal front/side faces of each base tier!
    const archW = Math.max(1.4, tw * 0.24);
    const archH = th * 0.72;
    const portalWall = createArchedWallGeometry(archW + 1.2, th * 0.88, 0.45, archW, archH);
    portalWall.translate(fcx, ty - th * 0.48, fcz - tw * 0.5 - 0.18);
    brickFlagParts.push(portalWall);
    addBox(flagVoidParts, archW * 0.86, archH * 0.84, 0.42, fcx, ty - th * 0.48 + archH * 0.42, fcz - tw * 0.5 - 0.04);
  }
  // Octagonal brick shaft + rosette ventilation windows + top octagonal watch-lantern!
  addCyl(brickFlagParts, 1.85, 2.55, 16.5, 8, fcx, fcy + 16.1, fcz);
  for (let rv = 0; rv < 5; rv++) {
    const ry = fcy + 10.2 + rv * 2.65;
    const ra = rv * (Math.PI * 0.5);
    const rDist = THREE.MathUtils.lerp(2.35, 1.90, rv / 4);
    const rx = fcx + Math.cos(ra) * rDist;
    const rz = fcz + Math.sin(ra) * rDist;
    const ring = new THREE.TorusGeometry(0.32, 0.07, 6, 12);
    ring.rotateY(-ra + Math.PI * 0.5);
    ring.translate(rx, ry, rz);
    graniteParts.push(ring);
    const hole = new THREE.CylinderGeometry(0.26, 0.26, 0.35, 8);
    hole.rotateZ(Math.PI * 0.5);
    hole.rotateY(-ra);
    hole.translate(rx, ry, rz);
    flagVoidParts.push(hole);
  }
  addCyl(brickFlagParts, 2.35, 2.35, 1.8, 8, fcx, fcy + 25.1, fcz);
  addCyl(graniteParts, 0.14, 0.22, 10.2, 8, fcx, fcy + 31.0, fcz);
  const cmFlagMaterial = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 0.45, showStar: true }).material
    : (() => {
      const res = createWavingSilkFlagMaterial({ waveScale: 0.45, showStar: true });
      ctx.extraMaterials.push(res.material);
      ctx.foliageWindUniforms.push(res.uniforms);
      return res.material;
    })();
  const cmFlagGeo = new THREE.PlaneGeometry(5.2, 3.4, 22, 12);
  cmFlagGeo.translate(2.6, 0, 0);
  const cmFlagMesh = new THREE.Mesh(cmFlagGeo, cmFlagMaterial);
  cmFlagMesh.position.set(fcx, fcy + 34.4, fcz);
  group.add(cmFlagMesh);

  const cmFlagBrickMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(brickFlagParts), 2.2),
    ctx.materials.weatheredImperialBrick ?? ctx.materials.chamBrick
  );
  cmFlagBrickMesh.name = 'MuiCaMauHanoiFlagTower';
  cmFlagBrickMesh.castShadow = true;
  cmFlagBrickMesh.receiveShadow = true;
  group.add(
    cmFlagBrickMesh,
    makeMergedMesh('MuiCaMauFlagTowerVoids', flagVoidParts, ctx.materials.darkVoid, false, false)
  );

  // 3. Iconic 18m-Long Con Tàu Mũi Cà Mau Prow & Sculpted White Concrete Sail Monument at (0, 491) (ref 35 & 101)
  const shipZ = 491.0;
  // FIX CM-05: Bright granite paving plaza & red-brick-curbed manicured tropical garden beds flanking Con Tàu Mũi Cà Mau (ref 35 & 101!)
  addBox(graniteParts, 20.5, 0.16, 20.5, 0, deckY + 0.08, shipZ);
  for (const sx of [-7.6, 7.6]) {
    addColoredBox(shipParts, '#a44634', 2.4, 0.38, 13.5, sx, deckY + 0.28, shipZ);
    addColoredBox(shipParts, '#387832', 2.0, 0.52, 13.0, sx, deckY + 0.56, shipZ);
    for (let fl = -2; fl <= 2; fl++) {
      addColoredSphere(shipParts, fl % 2 === 0 ? '#e64242' : '#f2c230', 0.36, 5, 4, sx, deckY + 0.92, shipZ + fl * 2.4);
    }
  }
  // Deep masonry pedestal with sky-blue wave trim grounded to y = -2.0m & boarding steps on North stern
  addColoredBox(shipParts, '#c6bfb0', 9.2, 4.0, 17.5, 0, 0.0, shipZ);
  addColoredBox(shipParts, '#5fa8c9', 9.6, 0.58, 18.0, 0, 2.08, shipZ);
  for (let st = 0; st < 5; st++) {
    addColoredBox(shipParts, '#cfc8b8', 3.6, 0.45, 0.75, 0, deckY + 0.35 + st * 0.42, shipZ - 9.8 + st * 0.75);
  }

  // Burnt Terracotta-Orange (#a85a3b) 18.0m-long sculptural ship hull & sweeping prow pointing +Z south
  const hullGeo = new THREE.BoxGeometry(7.6, 3.8, 18.0, 8, 4, 16);
  const hPos = hullGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    const z = hPos.getZ(i);
    const tz = Math.max(-1, Math.min(1, z / 9.0));
    const ty = Math.max(0, Math.min(1, (y + 1.9) / 3.8));
    const prowTaper = tz > 0 ? Math.max(0.05, 1.0 - Math.pow(tz, 1.45)) : 0.82 + 0.18 * (1.0 + tz);
    const flare = 0.55 + 0.45 * ty;
    const prowLift = tz > 0 ? 3.2 * Math.pow(tz, 2.05) : 0.0;
    x *= prowTaper * flare;
    y += prowLift + deckY + 2.1;
    hPos.setXYZ(i, x, y, z + shipZ);
  }
  hullGeo.computeVertexNormals();
  shipParts.push(colorizeGeometry(hullGeo, '#a85a3b'));

  // Sky-Blue (#5fa8c9) Sculpted Gunwale Rim & Sweeping Wave Trim along both sides of hull!
  const gunwaleGeo = new THREE.BoxGeometry(7.85, 0.38, 18.1, 4, 2, 16);
  const gPos = gunwaleGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    let x = gPos.getX(i);
    let y = gPos.getY(i);
    const z = gPos.getZ(i);
    const tz = Math.max(-1, Math.min(1, z / 9.0));
    const prowTaper = tz > 0 ? Math.max(0.05, 1.0 - Math.pow(tz, 1.45)) : 0.82 + 0.18 * (1.0 + tz);
    const prowLift = tz > 0 ? 3.2 * Math.pow(tz, 2.05) : 0.0;
    x *= prowTaper;
    y += prowLift + deckY + 4.05;
    gPos.setXYZ(i, x, y, z + shipZ);
  }
  gunwaleGeo.computeVertexNormals();
  shipParts.push(colorizeGeometry(gunwaleGeo, '#5fa8c9'));

  // [142][149][150] Sculpted anchor, ship's wheel & wave-deflector coping on Con Tàu Mũi Cà Mau
  addBox(graniteParts, 0.45, 1.15, 0.22, -2.2, deckY + 3.4, shipZ + 6.2); // starboard anchor
  addBox(graniteParts, 0.95, 0.22, 0.22, -2.2, deckY + 2.9, shipZ + 6.2);
  addColoredCylinder(shipParts, '#d4a638', 0.45, 0.45, 0.12, 8, 0, deckY + 5.2, shipZ - 3.6, 0, Math.PI * 0.5, 0); // helm wheel

  // [151][152][153][159][160] Giant Terracotta Ca Mau Mud Crab Monument, Đền Thờ Lạc Long Quân, Đất Mũi Stilt Restaurant & Hòn Khoai Finder
  // Giant sculpted Ca Mau Crab (*Biểu tượng Cua Cà Mau*) on east plaza (15.5, 492) — granite pier grounded to seabed (-2.5m) + walkway link!
  const crabX = 15.5;
  const crabZ = 492.0;
  addBox(graniteParts, 5.2, deckY + 2.8, 5.2, crabX, (deckY + 0.55 - 2.25) * 0.5, crabZ);
  addBox(woodParts, 4.2, 0.28, 3.6, 12.2, deckY, crabZ);
  addColoredSphere(shipParts, '#c43e22', 1.55, 10, 6, crabX, deckY + 1.35, crabZ, 1.25, 0.55, 0.95);
  for (const side of [-1, 1]) {
    addColoredSphere(shipParts, '#d64c2a', 0.58, 7, 5, crabX + side * 1.65, deckY + 1.65, crabZ - 1.15, 1.3, 0.75, 0.85);
    for (let leg = 0; leg < 3; leg++) {
      addColoredCylinder(shipParts, '#b8381e', 0.10, 0.14, 1.45, 5, crabX + side * 1.75, deckY + 0.95, crabZ - 0.15 + leg * 0.55, 0, 0, side * 0.65);
    }
  }
  // Đền Thờ Lạc Long Quân & Tượng Mẹ Âu Cơ curved-roof coastal pavilion (-16.5, 492) — grounded deep to seabed (-2.5m) + walkway link!
  const llqX = -16.5;
  const llqZ = 492.0;
  addBox(graniteParts, 7.2, deckY + 2.9, 6.6, llqX, (deckY + 0.65 - 2.25) * 0.5, llqZ);
  addBox(woodParts, 4.4, 0.28, 3.8, -12.4, deckY, llqZ);
  for (const px of [-2.4, 2.4]) {
    for (const pz of [-2.2, 2.2]) {
      addColoredCylinder(shipParts, '#9c241c', 0.16, 0.18, 3.2, 7, llqX + px, deckY + 2.2, llqZ + pz);
    }
  }
  const llqRoof = createVietnameseCurvedRoofGeometry(7.6, 7.0, 2.4, 0.5, 1.85, 0.34);
  llqRoof.translate(llqX, deckY + 3.8, llqZ);
  shipParts.push(colorizeGeometry(llqRoof, '#a83628'));
  // Đất Mũi stilt-house seafood restaurant (*nhà hàng thủy tạ*) at (-16.5, 474) with 6 full-height timber stilts from seabed (-2.5m) to roof eaves!
  addBox(woodParts, 8.6, 0.24, 6.8, -16.5, deckY + 0.1, 474.0);
  for (const rxOff of [-3.8, 0, 3.8]) {
    for (const rzOff of [-2.9, 2.9]) {
      addCyl(woodParts, 0.14, 0.18, deckY + 5.4, 6, -16.5 + rxOff, (deckY + 2.9 - 2.5) * 0.5, 474.0 + rzOff);
    }
  }
  const restCmRoof = createHippedRoofGeometry(9.4, 7.6, 6.8, 0.4, 1.6);
  restCmRoof.translate(-16.5, deckY + 2.8, 474.0);
  shipParts.push(colorizeGeometry(restCmRoof, '#2b6a8a'));
  // Hòn Khoai granite direction-finder plinth at south terrace edge
  addCyl(graniteParts, 0.48, 0.55, 1.15, 8, 6.5, deckY + 0.58, 500.5);

  // Authentic Sharp Swept Triangular White Concrete Sail Monument (#f2ede2) with Deep Concave Cutout Arch at Stern Foot!
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-4.8, 0);
  sailShape.quadraticCurveTo(-3.4, 8.6, 0.2, 16.8); // sharp swept leading edge to high apex
  sailShape.lineTo(1.2, 15.8);
  sailShape.quadraticCurveTo(3.8, 8.4, 4.9, 1.8); // sweeping trailing edge toward stern
  // Deep concave cutout arch at the stern foot (ref 101_mui_ca_mau_con_tau_gps0001.jpg)
  sailShape.quadraticCurveTo(2.4, 3.6, 0.4, 0.0);
  sailShape.closePath();

  const sailGeo = new THREE.ExtrudeGeometry(sailShape, {
    depth: 0.72,
    bevelEnabled: true,
    bevelSize: 0.08,
    bevelThickness: 0.08,
    bevelSegments: 2
  });
  sailGeo.translate(0, 0, -0.36);
  sailGeo.rotateY(Math.PI * 0.5);
  sailGeo.translate(0, deckY + 4.4, shipZ - 0.6);
  shipParts.push(colorizeGeometry(sailGeo, '#f2ede2'));

  // 4 Shortened Raised Horizontal White Relief Tabs toward trailing edge of concrete sail (NEVER cutting across "MŨI CÀ MAU" text — ref 35, 101!)
  const ribSpecs: Array<[number, number, number]> = [
    [deckY + 7.4, 1.85, shipZ - 2.15],
    [deckY + 10.2, 1.65, shipZ - 2.05],
    [deckY + 13.0, 1.40, shipZ - 1.95],
    [deckY + 15.8, 1.15, shipZ - 1.85]
  ];
  for (const [ry, rLen, rz] of ribSpecs) {
    addColoredBox(shipParts, '#fbf8f0', 0.96, 0.24, rLen, 0, ry, rz);
  }

  // Waving Vietnam Flag atop Sail Peak + Readable Red "MŨI CÀ MAU" Plaques Facing Outward on BOTH Sides of Sail!
  const sailPeakFlagMat = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 0.25, showStar: true }).material
    : (() => {
      const res = createWavingSilkFlagMaterial({ waveScale: 0.25, showStar: true });
      ctx.extraMaterials.push(res.material);
      ctx.foliageWindUniforms.push(res.uniforms);
      return res.material;
    })();
  const spFlagGeo = new THREE.PlaneGeometry(3.0, 2.0, 16, 8);
  spFlagGeo.translate(1.5, 0, 0);
  const spFlagMesh = new THREE.Mesh(spFlagGeo, sailPeakFlagMat);
  spFlagMesh.position.set(0, deckY + 22.0, shipZ - 0.6);
  group.add(spFlagMesh);

  // FIXED P0: Mount red "MŨI CÀ MAU" lettering correctly facing OUTWARD on BOTH West (-X) and East (+X) sail faces!
  for (const sx of [-1, 1]) {
    const conTauSign = createSignagePlaqueMesh(
      {
        text: 'MŨI CÀ MAU',
        subText: '8°37\'30" Bắc 104°43\' Đông',
        width: 4.3,
        height: 1.55,
        style: 'stone',
        bgColor: '#f2ede2',
        textColor: '#b82018',
        borderColor: '#f2ede2',
        motifSeed: 1010
      },
      ctx
    );
    conTauSign.name = sx < 0 ? 'MuiCaMauSailSignWest' : 'MuiCaMauSailSignEast';
    conTauSign.rotation.y = sx < 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    conTauSign.position.set(sx * 0.48, deckY + 11.6, shipZ - 0.5);
    group.add(conTauSign);
  }

  // 4. 64 Arching-Root Coastal Mangrove Trees (*Cây Đước*) + Dark Tidal Mudflats & Pneumatophore Breathing Roots (*Rễ Thở*)!
  const mangBarkParts: THREE.BufferGeometry[] = [];
  const mangLeafParts: THREE.BufferGeometry[] = [];
  const randMang = mulberry32(44109);
  let mangCount = 0;
  for (let a = 0; a < 140 && mangCount < 64; a++) {
    const side = a % 2 === 0 ? -1 : 1;
    const mx = side * (6.8 + randMang() * 22.0);
    const mz = 445.0 + randMang() * 58.0;
    if (Math.hypot(mx - fcx, mz - fcz) < 10.0) continue;
    if (Math.hypot(mx, mz - 491.0) < 12.0) continue;
    const m = createMangroveTreeParts(mx, 0.25, mz, 0.85 + randMang() * 0.45, 300 + a);
    mangBarkParts.push(...m.barkParts);
    mangLeafParts.push(...m.leafParts);
    // Dark alluvial tidal mudflat mound + spiky pneumatophore breathing roots (*rễ thở*) poking through mud (ref 102)
    if (mangCount % 2 === 0) {
      const mud = new THREE.CylinderGeometry(1.75 + randMang() * 0.9, 2.35 + randMang() * 1.1, 0.36, 9);
      mud.translate(mx, -0.04, mz);
      shipParts.push(colorizeGeometry(mud, '#463d34'));
      for (let br = 0; br < 6; br++) {
        const ba = (br / 6) * Math.PI * 2 + randMang() * 0.5;
        const bd = 0.85 + randMang() * 1.15;
        addCyl(mangBarkParts, 0.018, 0.036, 0.55 + randMang() * 0.35, 5, mx + Math.cos(ba) * bd, 0.24, mz + Math.sin(ba) * bd);
      }
    }
    mangCount++;
  }
  // [155][156][157] Offshore coastal tetrapod wave-breakers, crab-trap stakes & 2 additional thatched-canopy Vỏ Lãi boats
  for (let s = -4; s <= 4; s++) {
    addBox(graniteParts, 4.8, 1.35, 1.2, s * 6.2, 0.45, 512.0 + Math.abs(s) * 0.6);
    addCyl(graniteParts, 0.25, 0.42, 0.95, 4, s * 6.2 + 1.8, 0.62, 513.4);
  }
  for (const [tx, tz] of [[-13, 466], [-11, 468], [13, 464], [15, 467]]) {
    addCyl(woodParts, 0.04, 0.05, 1.8, 4, tx, 0.5, tz);
  }
  for (const [vx, vz, vyaw] of [
    [-22.0, 518.0, 0.32],
    [24.0, 516.0, -0.38]
  ]) {
    const vlLen = 8.4;
    const vlBeam = 1.45;
    const vlHull = new THREE.BoxGeometry(vlBeam, 0.52, vlLen, 4, 2, 12);
    const vp = vlHull.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      let x = vp.getX(i);
      let y = vp.getY(i);
      const z = vp.getZ(i);
      const tz = z / (vlLen * 0.5);
      const planW = Math.pow(Math.max(0.05, 1.0 - Math.pow(Math.abs(tz), 1.75)), 0.62);
      const sheer = 0.32 * Math.pow(Math.abs(tz), 2.1);
      x *= planW;
      y += sheer + 0.16;
      vp.setXYZ(i, x, y, z);
    }
    vlHull.computeVertexNormals();
    vlHull.rotateY(vyaw);
    vlHull.translate(vx, 0.04, vz);
    shipParts.push(colorizeGeometry(vlHull, '#2972a6'));
    // Wooden gunwale benches & long-tail motor shaft on each Vỏ Lãi
    addColoredBox(shipParts, '#7a4d28', 0.95, 0.08, 0.32, vx, 0.46, vz, vyaw);
    addColoredCylinder(shipParts, '#b8bec4', 0.028, 0.028, 2.6, 5, vx - Math.sin(vyaw) * 4.5, 0.36, vz - Math.cos(vyaw) * 4.5, vyaw, Math.PI * 0.5 + 0.22, 0);
  }
  const mangLeafMat = new THREE.MeshStandardMaterial({ color: '#2b6a2c', roughness: 0.62 });
  ctx.extraMaterials.push(mangLeafMat);
  group.add(
    makeMergedMesh('MuiCaMauMangroveRootsAndTrunks', mangBarkParts, ctx.materials.bark),
    makeMergedMesh('MuiCaMauMangroveCanopies', mangLeafParts, mangLeafMat)
  );

  const conTauMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.64,
    metalness: 0.08
  });
  ctx.extraMaterials.push(conTauMat);

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (341–360) — Low-Poly, castShadow=false
  // ==========================================================================
  const cmW2Wood: THREE.BufferGeometry[] = [];
  const cmW2Granite: THREE.BufferGeometry[] = [];
  const cmW2Ship: THREE.BufferGeometry[] = [];

  // [341] Mũi Cà Mau Mangrove Ecology Museum (Nhà Trưng Bày Sinh Thái Rừng Ngập Mặn) flanking boardwalk entry
  const musX = 11.5;
  const musZ = 452.0;
  addBox(cmW2Wood, 9.2, 0.26, 7.2, musX, deckY, musZ);
  for (const ox of [-4.0, 4.0]) {
    for (const oz of [-3.0, 3.0]) {
      addCyl(cmW2Wood, 0.16, 0.18, 4.2, 6, musX + ox, 0.1, musZ + oz);
    }
  }
  addColoredBox(cmW2Ship, '#e6dfd0', 8.2, 3.2, 6.2, musX, deckY + 1.72, musZ);
  addColoredBox(cmW2Ship, '#243a4d', 6.4, 1.6, 0.18, musX - 4.15, deckY + 1.85, musZ);
  const musRoof = createHippedRoofGeometry(10.2, 8.2, 6.4, 0.6, 1.85);
  musRoof.translate(musX, deckY + 3.32, musZ);
  cmW2Ship.push(colorizeGeometry(musRoof, '#2b6a8a'));

  // [342] Coastal Wooden Mangrove Watchtower (Đài Quan Sát Đất Mũi) — posts grounded to mudflat (-1.8m) & reaching roof eave (13.8m)!
  const wtX = -15.0;
  const wtZ = 458.0;
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.8, 1.8]) {
      addCyl(cmW2Wood, 0.14, 0.18, 15.6, 6, wtX + ox, 6.0, wtZ + oz);
    }
  }
  for (const ty of [4.2, 8.2, 12.2]) {
    addBox(cmW2Wood, 4.2, 0.22, 4.2, wtX, ty, wtZ);
  }
  const cmWtRoof = createHippedRoofGeometry(5.2, 5.2, 0.4, 0.4, 1.55);
  cmWtRoof.translate(wtX, 13.8, wtZ);
  cmW2Ship.push(colorizeGeometry(cmWtRoof, '#9c3628'));

  // [343] GPS 0001 Monument perimeter bronze chain-railings linking 4 corner bollards
  for (const s of [-4.2, 4.2]) {
    addColoredBox(cmW2Ship, '#8c6828', 8.4, 0.06, 0.06, 0, deckY + 0.68, gpsZ + s);
    addColoredBox(cmW2Ship, '#8c6828', 0.06, 0.06, 8.4, s, deckY + 0.68, gpsZ);
  }
  // [344] Hanoi Flag Tower bronze plaque gallery & ceremonial red-carpet entrance steps
  addColoredBox(cmW2Ship, '#a8241e', 2.4, 0.06, 2.6, fcx, fcy + 1.14, 467.8);
  for (const sx of [-3.2, 3.2]) {
    addColoredBox(cmW2Ship, '#7a5228', 1.4, 0.85, 0.12, fcx + sx, fcy + 1.4, 468.25);
  }
  // [345][346] Đền Thờ Lạc Long Quân interior altar + bronze drums & Monumental Tượng Mẹ Âu Cơ sculpture
  addBox(cmW2Wood, 2.4, 0.92, 0.95, llqX, deckY + 1.12, llqZ + 1.2);
  addColoredCylinder(cmW2Ship, '#7a5426', 0.36, 0.36, 0.55, 6, llqX - 1.8, deckY + 0.95, llqZ + 0.8);
  addColoredCylinder(cmW2Ship, '#7a5426', 0.36, 0.36, 0.55, 6, llqX + 1.8, deckY + 0.95, llqZ + 0.8);
  // Tượng Mẹ Âu Cơ granite-pedestal sculpture beside Đền Thờ Lạc Long Quân (foundation grounded to seabed!)
  addBox(cmW2Granite, 2.4, deckY + 3.6, 2.4, llqX, (deckY + 1.35 - 2.25) * 0.5, llqZ - 5.2);
  addCyl(cmW2Granite, 0.42, 0.62, 2.65, 6, llqX, deckY + 2.68, llqZ - 5.2);
  // [347] Ca Mau Mud Crab Monument perimeter stone bench ring & bilingual info plaque
  for (const side of [-3.2, 3.2]) {
    addBox(cmW2Granite, 0.55, 0.45, 2.2, crabX + side, deckY + 0.24, crabZ);
  }
  addBox(cmW2Granite, 1.1, 1.05, 0.28, crabX, deckY + 0.52, crabZ - 3.2);
  // [348][349][358] Stilt-House Seafood Restaurant tables/stools, live-crab holding cages & mudflat boat-landing steps
  for (const tx of [-18.5, -14.5]) {
    addBox(cmW2Wood, 1.5, 0.76, 1.0, tx, deckY + 0.58, 474.0);
    addColoredBox(cmW2Ship, '#2678b5', 0.38, 0.42, 0.38, tx, deckY + 0.40, 475.1);
  }
  addBox(cmW2Wood, 1.4, 0.65, 1.4, -20.5, 0.35, 474.0); // crab holding cage
  addBox(cmW2Wood, 1.6, 0.18, 3.2, -16.5, 1.1, 479.0, 0, 0.38, 0); // boat-landing steps
  // [350] Mangrove ecology spur trail end viewing platform (grounded on 4 pilings)
  addBox(cmW2Wood, 3.6, 0.20, 3.6, -16.5, deckY - 0.1, 458.0);
  addBox(cmW2Wood, 0.12, 0.95, 3.6, -18.2, deckY + 0.42, 458.0);
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(cmW2Wood, 0.10, 0.12, deckY + 2.0, 5, -16.5 + ox, (deckY - 2.1) * 0.5, 458.0 + oz);
    }
  }
  // [351][352] Seaward concrete embankment breakwater promenade & tidal-gauge wind-vane mast
  addBox(cmW2Granite, 26.0, 0.45, 2.6, 0, 1.25, 510.2);
  addCyl(cmW2Granite, 0.08, 0.12, 6.2, 5, 26.0, 3.4, 512.0);
  addColoredBox(cmW2Ship, '#e64232', 0.95, 0.18, 0.08, 26.0, 6.3, 512.0);
  // [353][354] Con Tàu Mũi Cà Mau gangway handrails, life-ring buoys & bow-wave white foam crest
  for (const sx of [-1.85, 1.85]) {
    addBox(cmW2Wood, 0.10, 0.85, 3.6, sx, deckY + 1.45, shipZ - 8.2);
    addColoredCylinder(cmW2Ship, '#e85a24', 0.32, 0.32, 0.12, 6, sx * 1.9, deckY + 3.8, shipZ - 2.0, 0, 0, Math.PI * 0.5);
  }
  addColoredCone(cmW2Ship, '#f4f6f8', 2.4, 1.2, 6, 0, deckY + 1.8, shipZ + 9.2);
  // [355] Southern viewing terrace brass coastal binoculars overlooking Hòn Khoai Island
  for (const bxB of [-4.5, 4.5]) {
    addCyl(cmW2Granite, 0.07, 0.10, 1.35, 5, bxB, deckY + 0.68, 501.2);
    addColoredBox(cmW2Ship, '#d4a638', 0.26, 0.16, 0.42, bxB, deckY + 1.42, 501.2);
  }
  // [356] Traditional Cà Mau Đáy Hàng Khơi tidal stake-net fishing rig in western mudflat
  for (const ox of [-26.0, -22.0]) {
    addCyl(cmW2Wood, 0.06, 0.08, 3.4, 5, ox, 1.4, 488.0);
  }
  addBox(cmW2Wood, 4.2, 0.08, 0.08, -24.0, 2.8, 488.0);
  // [357] Boardwalk Entry Welcome Archway at z = 444
  for (const sx of [-4.1, 4.1]) {
    addCyl(cmW2Wood, 0.18, 0.22, 4.8, 6, sx, deckY + 2.2, 445.2);
  }
  addColoredBox(cmW2Ship, '#b82820', 8.8, 0.85, 0.32, 0, deckY + 4.45, 445.2);
  // [359][360] Granite coastal km marker, solar weather station & coastal flower planter boxes near Flag Tower
  addBox(cmW2Granite, 0.72, 1.15, 0.32, fcx - 8.5, fcy + 0.58, 468.0);
  addCyl(cmW2Granite, 0.05, 0.07, 2.6, 5, fcx + 8.5, fcy + 1.3, 468.0);
  addColoredBox(cmW2Ship, '#234a78', 0.65, 0.06, 0.45, fcx + 8.5, fcy + 2.65, 468.0);
  for (const sx of [-4.2, 4.2]) {
    addBox(cmW2Granite, 1.8, 0.48, 0.85, fcx + sx, fcy + 0.24, 464.5);
    addColoredCone(cmW2Ship, '#d83878', 0.45, 0.55, 5, fcx + sx, fcy + 0.72, 464.5);
  }

  group.add(
    makeMergedMesh('MuiCaMauMangroveBoardwalk', woodParts, ctx.materials.darkWood),
    makeMergedMesh('MuiCaMauGPS0001Granite', graniteParts, ctx.materials.granite),
    makeMergedMesh('MuiCaMauConTauSculpture', shipParts, conTauMat),
    // Wave 2 merged meshes (castShadow = false, zero new materials!)
    makeMergedMesh('MuiCaMauWave2Wood', cmW2Wood, ctx.materials.darkWood, false, true),
    makeMergedMesh('MuiCaMauWave2Granite', cmW2Granite, ctx.materials.granite, false, true),
    makeMergedMesh('MuiCaMauWave2Sculpture', cmW2Ship, conTauMat, false, true)
  );
  // P1 Đất Mũi Cà Mau Motif Upgrades (`MN-083`..`MN-090`): Key-fret (`HV-D01`) & wave crest (`HV-D06`) seated cleanly around GPS 0001 plinth (gpsZ = 465.0)
  const cmMotifMesh = new THREE.Mesh(
    mergeNormalized([
      ...createMotifBandParts('hoi_van', cx - 3.8, gpsZ + 4.2, cx + 3.8, gpsZ + 4.2, deckY + 0.26, 0.16, 0.05),
      ...createMotifBandParts('song_nuoc', cx - 3.8, gpsZ - 4.2, cx + 3.8, gpsZ - 4.2, deckY + 0.26, 0.15, 0.05),
      ...createLotusPetalRingParts(cx, deckY + 0.78, gpsZ, 1.35, 10, 1, true)
    ]),
    ctx.materials.granite
  );
  cmMotifMesh.castShadow = false;
  group.add(cmMotifMesh);
  tagMotifIds(group, [
    'HV-C01', 'HV-C13', 'HV-D01', 'HV-D06', 'HV-I04', 'HV-NEW-MN-12'
  ]);

  void yBase;
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: 475, r: 34.0 });
}

// ============================================================================
// 9. Phú Quốc — Đảo Ngọc (-335, 515)
//    60m Sunset Pier (z = 472..412), 3 thatched beach pavilions, 10–14m coconut palms
// ============================================================================
function buildPhuQuocIsland(ctx: VietnamBuilderContext): void {
  const cx = -335;
  const cz = 515;

  const group = new THREE.Group();
  group.name = 'PhuQuocIslandComplex';

  const woodParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const lightPoolParts: THREE.BufferGeometry[] = [];
  const boulderParts: THREE.BufferGeometry[] = [];
  const organicParts: THREE.BufferGeometry[] = [];

  // 1. 24m Long Wooden Sunset Pier (*Cầu cảng Hoàng hôn*) extending z = 472 .. 448 in the Southern Sea
  const pierX = -335;
  const pierDeckY = 1.65;
  addBox(woodParts, 4.4, 0.24, 24.0, pierX, pierDeckY, 460.0);
  // Sunset viewing deck head at z = 450
  addBox(woodParts, 9.6, 0.28, 7.6, pierX, pierDeckY, 450.0);
  // Beach entry ramp meeting sand at z = 472..476
  const beachY = ctx.getHeight(pierX, 476.0);
  const rampPitch = Math.atan2(pierDeckY - beachY, 4.5);
  addBox(woodParts, 4.4, 0.24, 5.2, pierX, (pierDeckY + beachY) * 0.5, 474.2, 0, -rampPitch, 0);

  // Deep timber pilings down into seabed (y = -3.0m)
  for (let pz = 448.0; pz <= 472.0; pz += 4.8) {
    const halfW = pz < 454.0 ? 4.3 : 1.95;
    for (const sx of [-halfW, halfW]) {
      addCyl(woodParts, 0.16, 0.20, pierDeckY + 3.0, 8, pierX + sx, (pierDeckY - 3.0) * 0.5, pz);
    }
  }
  // Pier railings & warm glowing Sunset Lanterns along the pier
  for (const sx of [-2.05, 2.05]) {
    addBox(woodParts, 0.12, 0.12, 22.0, pierX + sx, pierDeckY + 1.0, 461.0);
    for (let pz = 450.0; pz <= 470.0; pz += 5.0) {
      const isLanternPost = pz <= 466.0;
      const postH = isLanternPost ? 2.85 : 1.05;
      addBox(woodParts, 0.14, postH, 0.14, pierX + sx, pierDeckY + postH * 0.5, pz);
      if (isLanternPost) {
        addBox(woodParts, 0.45, 0.10, 0.10, pierX + sx * 0.88, pierDeckY + 2.8, pz);
        const lx = pierX + sx * 0.78;
        const ly = pierDeckY + 2.42;
        const lantern = createRibbedLanternShellGeometry(0.28, 0.64, 12, 8);
        lantern.translate(lx, ly, pz);
        lanternParts.push(lantern);

        const cap = createLanternCapGeometry(0.28, 0.64);
        cap.translate(lx, ly, pz);
        woodParts.push(cap);

        const core = createLanternCoreGeometry(0.28, 0.64);
        core.translate(lx, ly, pz);
        lanternCoreParts.push(core);

        const pool = new THREE.CircleGeometry(1.9, 14);
        pool.rotateX(-Math.PI * 0.5);
        pool.translate(lx, pierDeckY + 0.14, pz);
        lightPoolParts.push(pool);
      }
    }
  }

  // [161][162] Pier T-head safety perimeter railings + Cầu Hôn (Kiss Bridge) inspired sunset viewing arch & mooring cleats (z = 446.4..453.6)
  addBox(woodParts, 9.6, 0.12, 0.12, pierX, pierDeckY + 1.0, 446.4);
  const kissArch = new THREE.TorusGeometry(1.65, 0.12, 6, 14, Math.PI);
  kissArch.translate(pierX, pierDeckY + 1.15, 446.6);
  organicParts.push(colorizeGeometry(kissArch, '#d84e3a'));
  for (const sx of [-4.65, 4.65]) {
    addBox(woodParts, 0.12, 0.12, 7.6, pierX + sx, pierDeckY + 1.0, 450.0);
    addBox(woodParts, 2.7, 0.12, 0.12, pierX + sx * 0.72, pierDeckY + 1.0, 453.6);
    addBox(woodParts, 0.14, 1.05, 0.14, pierX + sx, pierDeckY + 0.52, 446.4);
    addBox(woodParts, 0.14, 1.05, 0.14, pierX + sx, pierDeckY + 0.52, 453.6);
    const ring = new THREE.TorusGeometry(0.28, 0.07, 5, 10);
    ring.translate(pierX + sx * 0.92, pierDeckY + 0.85, 450.0);
    organicParts.push(colorizeGeometry(ring, '#e85a24'));
  }

  // 2. Three Grounded Thatched Beach Resort Pavilions Furnished with Sun Loungers, Coconuts & Waterfront Beach Swing!
  const pavilions: Array<[number, number, number]> = [
    [-351.0, 477.5, 0.30],
    [-319.0, 478.0, -0.28],
    [-364.0, 489.0, 0.55]
  ];
  for (const [px, pz, pyaw] of pavilions) {
    const py = ctx.getHeight(px, pz);
    for (const ox of [-2.4, 2.4]) {
      for (const oz of [-2.2, 2.2]) {
        const post = new THREE.CylinderGeometry(0.14, 0.17, 6.2, 8);
        post.translate(ox, 0.75, oz);
        post.rotateY(pyaw);
        post.translate(px, py, pz);
        woodParts.push(post);
      }
    }
    addBox(woodParts, 5.8, 2.6, 5.4, px, py - 0.9, pz, pyaw);
    // Sun loungers + white cushions + low table with green coconuts
    for (const lxOff of [-1.25, 1.25]) {
      const lFrame = new THREE.BoxGeometry(0.95, 0.22, 2.2);
      lFrame.translate(lxOff, 0.52, 0);
      lFrame.rotateY(pyaw);
      lFrame.translate(px, py, pz);
      woodParts.push(lFrame);
      const cushion = new THREE.BoxGeometry(0.86, 0.12, 2.0);
      cushion.translate(lxOff, 0.68, 0);
      cushion.rotateY(pyaw);
      cushion.translate(px, py, pz);
      organicParts.push(colorizeGeometry(cushion, '#f5f2ea'));
    }
    const coco = new THREE.SphereGeometry(0.14, 7, 5);
    coco.translate(px, py + 0.72, pz);
    organicParts.push(colorizeGeometry(coco, '#4f8c30'));

    const thatch = createVietnameseCurvedRoofGeometry(7.6, 7.0, 0.4, 0.4, 2.6, 0.28);
    thatch.rotateY(pyaw);
    thatch.translate(px, py + 3.6, pz);
    organicParts.push(colorizeGeometry(thatch, '#c49b52'));
  }
  // FIX PQ-05: Beachfront dark-red tin-roofed seafood pavilion & 6 colorful beach umbrellas with loungers along Phú Quốc Bãi Sao (ref 36!)
  const restX = -318.0;
  const restZ = 492.0;
  const restY = ctx.getHeight(restX, restZ);
  for (const ox of [-5.2, 0, 5.2]) {
    for (const oz of [-2.4, 2.4]) {
      addCyl(woodParts, 0.10, 0.12, 3.0, 6, restX + ox, restY + 1.5, restZ + oz);
    }
  }
  const restRoof = createHippedRoofGeometry(12.2, 6.2, 10.2, 0.4, 1.55);
  restRoof.translate(restX, restY + 3.0, restZ);
  organicParts.push(colorizeGeometry(restRoof, '#7d221c'));
  const umbCols = ['#d92e2e', '#1e74b8', '#e6a822', '#269458', '#d92e2e', '#1e74b8'];
  for (let u = 0; u < 6; u++) {
    const ux = -352.0 + u * 6.8;
    const uz = 478.0 + (u % 2) * 2.2;
    const uy = ctx.getHeight(ux, uz);
    addColoredCylinder(organicParts, '#d4d0c5', 0.03, 0.035, 2.15, 5, ux, uy + 1.05, uz);
    const canopy = new THREE.ConeGeometry(1.18, 0.42, 7);
    canopy.translate(ux, uy + 2.18, uz);
    organicParts.push(colorizeGeometry(canopy, umbCols[u]));
    addColoredBox(organicParts, '#ebe6da', 0.72, 0.24, 1.75, ux + 0.55, uy + 0.22, uz + 0.3);
  }
  // Woven beach hammock slung between 2 sturdy wooden posts & waterfront timber swing with 2 vertical ropes at (-344, 470)
  const hamY = ctx.getHeight(-356, 472);
  for (const hxPost of [-357.75, -354.25]) {
    addCyl(woodParts, 0.10, 0.13, 2.35, 7, hxPost, hamY + 0.95, 472.5);
  }
  const hammock = new THREE.CylinderGeometry(0.42, 0.42, 3.2, 8, 1, true, 0, Math.PI);
  hammock.rotateZ(Math.PI * 0.5);
  hammock.translate(-356.0, hamY + 1.15, 472.5);
  organicParts.push(colorizeGeometry(hammock, '#e8dcc0'));
  for (const sx of [-345.2, -342.8]) {
    addCyl(woodParts, 0.09, 0.11, 3.2, 6, sx, 1.4, 469.5);
  }
  addCyl(woodParts, 0.08, 0.08, 2.8, 6, -344.0, 2.95, 469.5, 0, 0, Math.PI * 0.5);
  // 2 Vertical braided hanging ropes connecting crossbar (y=2.95) down to wooden swing seat (y=0.95)!
  for (const rx of [-344.52, -343.48]) {
    addColoredCylinder(organicParts, '#cbb682', 0.024, 0.024, 2.02, 5, rx, 1.95, 469.5);
  }
  addBox(woodParts, 1.25, 0.10, 0.45, -344.0, 0.95, 469.5);

  // 2b. Authentic Mũi Dinh Cậu Cape Shrine & Dương Đông Lighthouse on NW Granite Headland (-372, 476) (ref 103)
  const dcX = -372.0;
  const dcZ = 476.0;
  // FIXED P0: Lower dcRock top cleanly below dcDeckY = 4.95m so it NEVER clips through Miếu Dinh Cậu!
  const dcRock = createSculptedRockGeometry(905, 8.2, 2.45, 7.6, 2);
  dcRock.translate(dcX, 1.35, dcZ);
  boulderParts.push(dcRock);
  // Iconic sea-stack crag jutting off the western headland tip
  const seaStack = createSculptedRockGeometry(909, 3.2, 3.6, 2.9, 2);
  seaStack.translate(dcX - 8.5, 1.95, dcZ - 4.2);
  boulderParts.push(seaStack);

  const dcDeckY = 4.95;
  const dcStoneParts: THREE.BufferGeometry[] = [];
  // White/weathered-concrete shrine terrace deck supported on 2-STORY EXPOSED GRID COLUMNS & MID-HEIGHT TIE-BEAMS (PQ-02 — ref 103!)
  addColoredBox(organicParts, '#f2efe6', 9.4, 0.48, 8.6, dcX, dcDeckY, dcZ);
  for (const cxOff of [-4.2, -1.4, 1.4, 4.2]) {
    for (const czOff of [-3.8, 0.0, 3.8]) {
      addColoredBox(organicParts, '#c7bbb0', 0.46, 3.9, 0.46, dcX + cxOff, dcDeckY - 2.15, dcZ + czOff);
    }
    // Top & mid-height longitudinal concrete tie-beams
    addColoredBox(organicParts, '#c7bbb0', 0.38, 0.42, 8.0, dcX + cxOff, dcDeckY - 0.45, dcZ);
    addColoredBox(organicParts, '#c7bbb0', 0.38, 0.42, 8.0, dcX + cxOff, dcDeckY - 2.20, dcZ);
  }
  for (const czOff of [-3.8, 3.8]) {
    // Top & mid-height transverse concrete tie-beams forming the iconic 2-story open concrete grid frame!
    addColoredBox(organicParts, '#c7bbb0', 8.8, 0.42, 0.38, dcX, dcDeckY - 0.45, dcZ + czOff);
    addColoredBox(organicParts, '#c7bbb0', 8.8, 0.42, 0.38, dcX, dcDeckY - 2.20, dcZ + czOff);
  }
  // White baluster railing ('con_tien') with bright red top rail framing the Dinh Cậu terrace!
  const balRailingParts: THREE.BufferGeometry[] = [
    ...createPiercedBalustradeParts(dcX - 4.5, dcZ - 4.1, dcX + 4.5, dcZ - 4.1, dcDeckY + 0.24, 0.92, 'con_tien'),
    ...createPiercedBalustradeParts(dcX - 4.5, dcZ + 4.1, dcX + 4.5, dcZ + 4.1, dcDeckY + 0.24, 0.92, 'con_tien'),
    ...createPiercedBalustradeParts(dcX - 4.5, dcZ - 4.1, dcX - 4.5, dcZ + 4.1, dcDeckY + 0.24, 0.92, 'con_tien'),
    ...createPiercedBalustradeParts(dcX + 4.5, dcZ - 4.1, dcX + 4.5, dcZ - 1.2, dcDeckY + 0.24, 0.92, 'con_tien')
  ];
  for (const bp of balRailingParts) {
    organicParts.push(colorizeGeometry(bp, '#f4f2eb'));
  }
  // Bright red top cap rail along Dinh Cậu balustrade
  addColoredBox(organicParts, '#c42822', 9.2, 0.12, 0.18, dcX, dcDeckY + 1.20, dcZ - 4.1);
  addColoredBox(organicParts, '#c42822', 9.2, 0.12, 0.18, dcX, dcDeckY + 1.20, dcZ + 4.1);
  addColoredBox(organicParts, '#c42822', 0.18, 0.12, 8.35, dcX - 4.5, dcDeckY + 1.20, dcZ);
  addColoredBox(organicParts, '#c42822', 0.18, 0.12, 3.05, dcX + 4.5, dcDeckY + 1.20, dcZ - 2.65);

  // FIX PQ-04: Beveled Trapezoidal Sloped Concrete Breakwater Causeway (*Con đê chắn sóng bê tông vát*) leading straight into Dinh Cậu!
  const trapShape = new THREE.Shape();
  trapShape.moveTo(-2.7, 0);
  trapShape.lineTo(2.7, 0);
  trapShape.lineTo(1.75, 1.85);
  trapShape.lineTo(-1.75, 1.85);
  trapShape.closePath();
  const causewayGeo = new THREE.ExtrudeGeometry(trapShape, { depth: 17.5, bevelEnabled: false });
  causewayGeo.rotateY(Math.PI * 0.5 - 0.34);
  causewayGeo.translate(dcX + 4.4, 0.10, dcZ + 1.8);
  dcStoneParts.push(causewayGeo);
  // Low concrete curb parapet edges along both sides of causeway promenade
  for (let st = 0; st < 14; st++) {
    addBox(dcStoneParts, 2.8, 0.35, 0.72, dcX + 5.0 + st * 0.50, dcDeckY - st * 0.28, dcZ + 1.8);
  }
  // Seaward Stone Breakwater Arm (*Đê chắn sóng cảng Dương Đông*) extending West-Northwest with Red-and-White Navigation Beacon
  addBox(dcStoneParts, 22.0, 1.65, 3.4, dcX - 15.5, 0.95, dcZ - 5.5, 0.25);
  addCyl(dcStoneParts, 2.4, 2.9, 1.9, 8, dcX - 25.8, 1.05, dcZ - 8.2);
  addColoredCylinder(organicParts, '#d62828', 0.52, 0.65, 3.6, 8, dcX - 25.8, 3.6, dcZ - 8.2);
  addColoredCylinder(organicParts, '#f4f4f0', 0.68, 0.68, 0.25, 8, dcX - 25.8, 5.45, dcZ - 8.2);
  lanternCoreParts.push(new THREE.SphereGeometry(0.28, 7, 6).translate(dcX - 25.8, 5.82, dcZ - 8.2));

  // Authentic Red-and-White Trimmed Miếu Dinh Cậu Shrine + Twin Gold Dragon Porch Columns + Incense Censer + Stepped Stone Approach
  for (const sx of [-2.2, 2.2]) {
    for (const sz of [-1.8, 1.8]) {
      organicParts.push(
        colorizeGeometry(new THREE.CylinderGeometry(0.14, 0.16, 2.8, 8).translate(dcX + sx, dcDeckY + 1.65, dcZ + sz), '#c89b32')
      );
    }
    // Dragon relief spiral ring wrapping front porch columns
    const dragonWrap = new THREE.TorusGeometry(0.22, 0.045, 5, 10);
    dragonWrap.rotateX(Math.PI * 0.42);
    dragonWrap.translate(dcX + 2.2, dcDeckY + 1.85, dcZ + (sx > 0 ? 1.8 : -1.8));
    organicParts.push(colorizeGeometry(dragonWrap, '#e5b838'));
  }
  addColoredCylinder(organicParts, '#8c867a', 0.28, 0.34, 0.72, 8, dcX + 3.35, dcDeckY + 0.62, dcZ);
  // Incense sticks & fruit offering tray at Miếu Dinh Cậu censer + stone guardrail posts along the rock-cut stairs
  for (const incZ of [-0.08, 0, 0.08]) {
    addColoredCylinder(organicParts, '#d92820', 0.015, 0.015, 0.36, 4, dcX + 3.35, dcDeckY + 1.12, dcZ + incZ);
  }
  addColoredSphere(organicParts, '#e6b828', 0.14, 5, 4, dcX + 2.85, dcDeckY + 0.36, dcZ);
  for (let st = 0; st < 7; st++) {
    addBox(dcStoneParts, 3.2, 0.36, 0.75, dcX + 4.8 + st * 0.58, dcDeckY - st * 0.30, dcZ + 1.45);
    if (st % 2 === 0) {
      addBox(dcStoneParts, 0.22, 0.75, 0.22, dcX + 4.8 + st * 0.58, dcDeckY - st * 0.30 + 0.45, dcZ + 0.15);
      addBox(dcStoneParts, 0.22, 0.75, 0.22, dcX + 4.8 + st * 0.58, dcDeckY - st * 0.30 + 0.45, dcZ + 2.75);
    }
  }
  const dcShrineWall = colorizeGeometry(new THREE.BoxGeometry(4.8, 2.8, 3.6).translate(dcX - 0.3, dcDeckY + 1.65, dcZ), '#f5f1e6');
  const dcRoof = createHueImperialHipRoofGeometry(6.5, 5.3, 2.6, 1.2, 1.65, 0.16);
  dcRoof.translate(dcX, dcDeckY + 3.05, dcZ);
  organicParts.push(dcShrineWall, colorizeGeometry(dcRoof, '#b82820'));
  const dcFinial = createRoofFinialSetParts(dcX, dcDeckY + 4.68, dcZ, 2.6, 0, 0.55, true);
  for (const fp of [...dcFinial.mainParts, ...dcFinial.goldParts]) {
    organicParts.push(colorizeGeometry(fp, '#e5b838'));
  }
  // White molded trim fascia skirting the red shrine roof eaves
  addColoredBox(organicParts, '#f5f4ef', 6.55, 0.14, 5.35, dcX, dcDeckY + 3.06, dcZ);
  // Iconic Slender Octagonal White-and-Red Cupola Pavilion (*Tháp nóc bát giác*, r=0.62m — PQ-03!) crowning Miếu Dinh Cậu!
  addColoredCylinder(organicParts, '#f5f3ec', 0.58, 0.62, 1.05, 8, dcX, dcDeckY + 5.05, dcZ);
  addColoredCylinder(organicParts, '#b82820', 0.12, 0.72, 0.95, 8, dcX, dcDeckY + 6.00, dcZ);
  addColoredCylinder(organicParts, '#f5f3ec', 0.76, 0.76, 0.10, 8, dcX, dcDeckY + 5.56, dcZ);
  addColoredSphere(organicParts, '#2d7a4f', 0.18, 7, 5, dcX, dcDeckY + 6.58, dcZ);

  const dcSign = createSignagePlaqueMesh({ text: 'MIẾU DINH CẬU', subText: 'PHÚ QUỐC', width: 2.6, height: 0.65, style: 'royal' }, ctx);
  dcSign.rotation.y = Math.PI * 0.5;
  dcSign.position.set(dcX + 2.35, dcDeckY + 2.85, dcZ);
  group.add(dcSign);

  // Authentic Dương Đông Lighthouse: 5 Alternating Deep Maritime-Blue (#3988b0) & White (#eff1f2) Bands (PQ-02 — ref 103!)
  const lhX = dcX - 4.0;
  const lhZ = dcZ - 2.3;
  for (let band = 0; band < 5; band++) {
    const rTop = 1.04 - band * 0.03;
    const rBot = 1.07 - band * 0.03;
    const seg = new THREE.CylinderGeometry(rTop, rBot, 2.65, 14);
    seg.translate(lhX, dcDeckY + 1.32 + band * 2.65, lhZ);
    organicParts.push(colorizeGeometry(seg, band % 2 === 0 ? '#eff1f2' : '#3988b0'));
  }
  const lhDeckY = dcDeckY + 13.45;
  const lhGallery = new THREE.CylinderGeometry(1.36, 1.12, 0.42, 14).translate(lhX, lhDeckY, lhZ);
  organicParts.push(colorizeGeometry(lhGallery, '#f4f4f0'));
  // Black iron gallery railing encircling the top lighthouse deck
  const railRing = new THREE.TorusGeometry(1.30, 0.04, 6, 16);
  railRing.rotateX(Math.PI * 0.5);
  railRing.translate(lhX, lhDeckY + 0.92, lhZ);
  organicParts.push(colorizeGeometry(railRing, '#1e2226'));
  for (let p = 0; p < 10; p++) {
    const a = (p / 10) * Math.PI * 2;
    addColoredCylinder(organicParts, '#1e2226', 0.03, 0.03, 0.88, 5, lhX + Math.cos(a) * 1.28, lhDeckY + 0.52, lhZ + Math.sin(a) * 1.28);
  }
  // Flat-roofed cylindrical lantern room + slender lightning rod + solar beacon panels & wind anemometer vane!
  lanternCoreParts.push(new THREE.CylinderGeometry(0.68, 0.68, 1.25, 12).translate(lhX, lhDeckY + 0.85, lhZ));
  addColoredCylinder(organicParts, '#f4f4f0', 0.82, 0.82, 0.24, 14, lhX, lhDeckY + 1.58, lhZ);
  addColoredCylinder(organicParts, '#2a2e33', 0.025, 0.045, 2.2, 6, lhX, lhDeckY + 2.80, lhZ);
  addColoredBox(organicParts, '#1c3b64', 0.58, 0.06, 0.42, lhX + 0.95, lhDeckY + 1.05, lhZ, 0.35);
  addColoredBox(organicParts, '#d4a638', 0.48, 0.06, 0.04, lhX, lhDeckY + 3.45, lhZ);

  // Red-and-Gold Entrance Arch Gate (*Cổng Tam Quan Miếu Dinh Cậu*) at the foot of the rock-cut stairs + 3 Phú Quốc Fish-Sauce Wooden Vats (*Nhà Thùng Nước Mắm*)
  const gateFootX = dcX + 8.6;
  const gateFootZ = dcZ + 1.45;
  const gateFootY = dcDeckY - 2.1;
  for (const gzOff of [-1.45, 1.45]) {
    addColoredCylinder(organicParts, '#b82820', 0.16, 0.18, 3.2, 7, gateFootX, gateFootY + 1.6, gateFootZ + gzOff);
  }
  addColoredBox(organicParts, '#e5b838', 0.38, 0.34, 3.4, gateFootX, gateFootY + 3.25, gateFootZ);
  const dcGateRoof = createVietnameseCurvedRoofGeometry(1.4, 3.9, 0.6, 2.2, 0.85, 0.22);
  dcGateRoof.translate(gateFootX, gateFootY + 3.42, gateFootZ);
  organicParts.push(colorizeGeometry(dcGateRoof, '#b82820'));

  // 3 Iconic Braided-Hooped Phú Quốc Fish-Sauce Wooden Vats (*Thùng Gỗ Bời Lời Ủ Nước Mắm Phú Quốc*) on coastal terrace (-356, 488)
  const vatBaseY = ctx.getHeight(-356, 488);
  for (let vIdx = 0; vIdx < 3; vIdx++) {
    const vx = -358.5 + vIdx * 2.4;
    const vz = 488.0;
    addColoredCylinder(organicParts, '#6b3e22', 0.92, 0.84, 2.15, 10, vx, vatBaseY + 1.08, vz);
    for (const hoopY of [0.45, 1.08, 1.72]) {
      const vHoop = new THREE.TorusGeometry(0.90, 0.045, 5, 10);
      vHoop.rotateX(Math.PI * 0.5);
      vHoop.translate(vx, vatBaseY + hoopY, vz);
      organicParts.push(colorizeGeometry(vHoop, '#c89e52'));
    }
  }

  // [171][172][173][174][175][177][180] Phú Quốc Night Market Stalls, Pepper Farm (Vườn Tiêu), Fish-Sauce Shed, Beach Bar & Swim Raft
  // Nhà Thùng Nước Mắm (Fish-Sauce Barrel House) open-sided timber shed sheltering the 3 giant vats
  for (const vxPost of [-359.5, -356.1, -352.7]) {
    for (const vzPost of [486.4, 489.6]) {
      addCyl(woodParts, 0.10, 0.12, 3.4, 6, vxPost, vatBaseY + 1.7, vzPost);
    }
  }
  const vatShedRoof = createHippedRoofGeometry(8.6, 4.4, 6.8, 0.4, 1.35);
  vatShedRoof.translate(-356.1, vatBaseY + 3.4, 488.0);
  organicParts.push(colorizeGeometry(vatShedRoof, '#7d221c'));

  // Vườn Tiêu Phú Quốc (Phu Quoc Pepper Farm) — 12 tall cylindrical green peppercorn vine poles on inland slope
  for (let pr = 0; pr < 3; pr++) {
    for (let pc = 0; pc < 4; pc++) {
      const ptx = -346.0 + pc * 2.2;
      const ptz = 502.0 + pr * 2.4;
      const pty = ctx.getHeight(ptx, ptz);
      addColoredCylinder(organicParts, '#2d6e26', 0.28, 0.34, 2.85, 7, ptx, pty + 1.42, ptz);
    }
  }
  // Chợ Đêm Phú Quốc (Night Market) coastal stalls behind Bãi Sao (with grounded corner posts supporting canopies!) + Beach Bar & Surfboards + Swim Platform
  for (let nm = 0; nm < 4; nm++) {
    const nmx = -345.0 + nm * 5.2;
    const nmz = 493.5;
    const nmy = ctx.getHeight(nmx, nmz);
    addBox(woodParts, 2.8, 0.92, 1.4, nmx, nmy + 0.46, nmz);
    for (const sxP of [-1.35, 1.35]) {
      addCyl(woodParts, 0.04, 0.05, 2.25, 5, nmx + sxP, nmy + 1.12, nmz);
    }
    addColoredBox(organicParts, nm % 2 === 0 ? '#d93829' : '#2678b5', 3.2, 0.12, 1.8, nmx, nmy + 2.25, nmz);
    lanternCoreParts.push(new THREE.SphereGeometry(0.11, 5, 4).translate(nmx, nmy + 2.12, nmz));
  }
  addColoredBox(organicParts, '#e64228', 0.48, 1.85, 0.12, -329.0, beachY + 0.92, 474.0, 0.25); // surfboard
  addColoredBox(organicParts, '#1e88c4', 0.48, 1.85, 0.12, -328.2, beachY + 0.92, 474.2, 0.18);
  addBox(woodParts, 4.2, 0.24, 4.2, -326.0, 0.16, 444.0); // floating swim platform raft

  group.add(makeMergedMesh('PhuQuocDinhCauStone', dcStoneParts, ctx.materials.stone));

  // 2c. 3 Sculpted Pointed-Prow Blue-and-Red Phú Quốc Fishing Boats with Cabins & Squid-Fishing Booms + 3 Basket Boats!
  for (const [bx, bz, byaw] of [
    [-324.0, 460.0, 0.12],
    [-346.0, 456.0, -0.15],
    [-320.0, 452.0, 0.25]
  ]) {
    const fLen = 9.2;
    const fBeam = 2.75;
    const fHull = new THREE.BoxGeometry(fBeam, 1.18, fLen, 6, 3, 12);
    const fp = fHull.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      let x = fp.getX(i);
      let y = fp.getY(i);
      const z = fp.getZ(i);
      const tz = z / (fLen * 0.5);
      const ty = (y + 0.59) / 1.18;
      const planW = tz > 0 ? Math.pow(Math.max(0.06, 1.0 - Math.pow(tz, 1.65)), 0.55) : 0.78 + 0.22 * (1.0 + tz);
      const sheer = 0.52 * Math.pow(Math.abs(tz), 2.1) + (tz > 0 ? 0.36 * tz * tz : 0);
      x *= planW * (0.52 + 0.48 * ty);
      y += sheer + 0.16;
      fp.setXYZ(i, x, y, z);
    }
    fHull.computeVertexNormals();
    fHull.rotateY(byaw);
    fHull.translate(bx, 0.05, bz);
    organicParts.push(colorizeGeometry(fHull, '#1f5e9c'));
    // Red upper gunwale & wheelhouse cabin with dark glazed pilot windows
    addColoredBox(organicParts, '#b83227', 1.85, 1.38, 3.25, bx, 1.28, bz - 0.5, byaw);
    addColoredBox(organicParts, '#f2efe6', 1.98, 0.16, 3.55, bx, 2.02, bz - 0.5, byaw);
    addColoredBox(organicParts, '#1c242b', 1.52, 0.52, 0.12, bx + Math.sin(byaw) * 1.15, 1.48, bz - 0.5 + Math.cos(byaw) * 1.15, byaw);
    // Outrigger squid-fishing lamp booms (*cần câu mực*) extending port & starboard + glowing lamp row, boat eyes & lifebuoy
    addColoredCylinder(organicParts, '#cfd4da', 0.035, 0.045, 3.8, 6, bx, 2.75, bz - 0.4, byaw);
    addColoredCylinder(organicParts, '#cfd4da', 0.025, 0.025, 5.4, 5, bx, 3.85, bz - 0.4, byaw, 0, Math.PI * 0.5);
    for (const side of [-1, 1]) {
      const eyeX = bx + Math.sin(byaw) * 3.1 + Math.cos(byaw) * side * 0.52;
      const eyeZ = bz + Math.cos(byaw) * 3.1 - Math.sin(byaw) * side * 0.52;
      addColoredSphere(organicParts, '#e63228', 0.16, 6, 4, eyeX, 0.92, eyeZ);
      for (const bOff of [-2.0, -1.2, 1.2, 2.0]) {
        const bulb = new THREE.SphereGeometry(0.12, 5, 4);
        bulb.translate(bx + Math.cos(byaw) * bOff, 3.68, bz - 0.4 - Math.sin(byaw) * bOff);
        lanternCoreParts.push(bulb);
      }
    }
    const buoy = new THREE.TorusGeometry(0.28, 0.075, 5, 10);
    buoy.rotateY(byaw + Math.PI * 0.5);
    buoy.translate(bx + Math.cos(byaw) * 0.98, 1.48, bz - 0.5 - Math.sin(byaw) * 0.98);
    organicParts.push(colorizeGeometry(buoy, '#e8681c'));
    // Bow anchor winch, coiled mooring rope, cabin radar mast & stern net reel on Phú Quốc squid boats
    addColoredCylinder(organicParts, '#3a4046', 0.18, 0.18, 0.55, 6, bx + Math.sin(byaw) * 2.4, 0.95, bz + Math.cos(byaw) * 2.4, 0, byaw, Math.PI * 0.5);
    addColoredCylinder(organicParts, '#d8c394', 0.28, 0.32, 0.16, 7, bx + Math.sin(byaw) * 1.85, 0.84, bz + Math.cos(byaw) * 1.85);
    addColoredCylinder(organicParts, '#dde2e6', 0.025, 0.035, 1.45, 5, bx, 2.78, bz - 0.5);
    addColoredBox(organicParts, '#eef2f5', 0.65, 0.08, 0.14, bx, 3.48, bz - 0.5, byaw + 0.4);
  }
  for (const [tx, tz] of [
    [-326.0, 474.0],
    [-323.5, 475.5],
    [-346.5, 473.5]
  ]) {
    const ty = ctx.getHeight(tx, tz);
    const thung = new THREE.CylinderGeometry(0.95, 0.65, 0.48, 12);
    thung.translate(tx, ty + 0.24, tz);
    const thungRim = new THREE.TorusGeometry(0.95, 0.055, 5, 12);
    thungRim.rotateX(Math.PI * 0.5);
    thungRim.translate(tx, ty + 0.48, tz);
    const paddle = new THREE.BoxGeometry(0.14, 0.04, 1.65);
    paddle.rotateY(0.45);
    paddle.translate(tx + 0.15, ty + 0.52, tz);
    organicParts.push(
      colorizeGeometry(thung, '#8b6331'),
      colorizeGeometry(thungRim, '#b5894c'),
      colorizeGeometry(paddle, '#6e4b26')
    );
  }

  // 3. 10–14m Tall Smooth Curved Coconut Palms (*dừa biển nghiêng bãi cát*) — seamless tapered spline trunks + 11 arching feathered fronds!
  const rand = mulberry32(124188);
  const palmSpecs: Array<[number, number, number, number]> = [
    [-358, 474, -0.35, -0.55],
    [-354, 471, -0.25, -0.62],
    [-345, 471, -0.15, -0.58],
    [-325, 471, 0.18, -0.60],
    [-316, 474, 0.35, -0.52],
    [-308, 479, 0.55, -0.35],
    [-364, 480, -0.55, -0.25],
    [-371, 492, -0.60, 0.05],
    [-301, 491, 0.58, 0.08],
    [-366, 505, -0.45, 0.35],
    [-304, 506, 0.42, 0.35],
    [-356, 524, -0.40, 0.45],
    [-314, 525, 0.40, 0.45],
    [-335, 536, 0.05, 0.55],
    [-342, 488, -0.20, -0.30],
    [-328, 489, 0.22, -0.28],
    [-349, 498, -0.30, -0.12],
    [-320, 499, 0.28, -0.15],
    [-339, 508, -0.12, 0.15],
    [-330, 512, 0.15, 0.20]
  ];
  for (let p = 0; p < palmSpecs.length; p++) {
    const [px, pz, leanX, leanZ] = palmSpecs[p];
    const py = ctx.getHeight(px, pz) - 0.65;
    const palmH = 10.2 + rand() * 3.8; // 10-14m tall!

    const p0 = new THREE.Vector3(px, py, pz);
    const p1 = new THREE.Vector3(px + leanX * 0.9, py + palmH * 0.34, pz + leanZ * 0.9);
    const p2 = new THREE.Vector3(px + leanX * 2.5, py + palmH * 0.68, pz + leanZ * 2.5);
    const p3 = new THREE.Vector3(px + leanX * 4.4, py + palmH * 0.96, pz + leanZ * 4.4);
    const palmCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const trunkGeo = createSmoothTaperedTubeGeometry(
      palmCurve,
      10,
      6,
      (t) => THREE.MathUtils.lerp(0.38, 0.16, t) * (1.0 + 0.05 * Math.sin(t * Math.PI * 14.0))
    );
    organicParts.push(colorizeGeometry(trunkGeo, p % 2 === 0 ? '#8a7054' : '#7b6248'));

    const curX = p3.x;
    const curY = p3.y;
    const curZ = p3.z;

    for (let c = 0; c < 3; c++) {
      const ca = (c / 3) * Math.PI * 2;
      const nut = new THREE.SphereGeometry(0.24, 6, 4);
      nut.translate(curX + Math.cos(ca) * 0.34, curY - 0.25, curZ + Math.sin(ca) * 0.34);
      organicParts.push(colorizeGeometry(nut, c % 2 === 0 ? '#5c8c2a' : '#6a4822'));
    }

    const numFronds = 9;
    for (let f = 0; f < numFronds; f++) {
      const ang = (f / numFronds) * Math.PI * 2 + p * 0.4;
      const frondLen = 4.0 + rand() * 1.0;
      const frondGeo = new THREE.PlaneGeometry(1.22, frondLen, 1, 4);
      const fPos = frondGeo.attributes.position;
      for (let vi = 0; vi < fPos.count; vi++) {
        const fx = fPos.getX(vi);
        const fy = fPos.getY(vi);
        const ft = (fy + frondLen * 0.5) / frondLen;
        const archY = Math.sin(ft * Math.PI * 0.65) * 1.25 - Math.pow(ft, 2.0) * 1.95;
        const archZ = ft * frondLen;
        const taperW = Math.sin(ft * Math.PI) * 1.18 + 0.14;
        fPos.setXYZ(vi, fx * taperW, archY, archZ);
      }
      frondGeo.computeVertexNormals();
      frondGeo.rotateY(ang);
      frondGeo.translate(curX, curY, curZ);
      organicParts.push(colorizeGeometry(frondGeo, f % 2 === 0 ? '#368a30' : '#4ea63c'));
    }
  }

  // 3b. Hòn Thơm Sea-Crossing Cable Car (*Cáp Treo Hòn Thơm*) & White-Sand Shallow Turquoise Coral Sandbar!
  const htBaseX = -296.0;
  const htBaseZ = 516.0;
  const htBaseY = ctx.getHeight(htBaseX, htBaseZ);
  // Iconic soaring white-concrete coastal A-frame cable car pylon (26m tall) on SE headland
  addColoredBox(organicParts, '#dcdad2', 5.4, 2.2, 4.4, htBaseX, htBaseY + 0.8, htBaseZ);
  addColoredCylinder(organicParts, '#eceae2', 0.52, 0.95, 24.5, 8, htBaseX - 1.4, htBaseY + 13.0, htBaseZ, 0, 0, -0.07);
  addColoredCylinder(organicParts, '#eceae2', 0.52, 0.95, 24.5, 8, htBaseX + 1.4, htBaseY + 13.0, htBaseZ, 0, 0, 0.07);
  addColoredBox(organicParts, '#c42e28', 6.8, 0.65, 1.15, htBaseX, htBaseY + 24.8, htBaseZ);
  addColoredBox(organicParts, '#eceae2', 3.6, 0.55, 0.85, htBaseX, htBaseY + 15.2, htBaseZ);
  for (const braceY of [htBaseY + 6.5, htBaseY + 11.2, htBaseY + 20.0]) {
    addColoredBox(organicParts, '#eceae2', 4.2, 0.42, 0.68, htBaseX, braceY, htBaseZ);
  }
  // Offshore secondary cable tower rising from rocky shoal at (-282, 456) + pulley wheels
  const htSeaX = -282.0;
  const htSeaZ = 456.0;
  addColoredCylinder(organicParts, '#c9c6be', 1.8, 2.4, 3.8, 8, htSeaX, 0.8, htSeaZ);
  addColoredCylinder(organicParts, '#eceae2', 0.48, 0.82, 22.0, 8, htSeaX, 12.6, htSeaZ);
  addColoredBox(organicParts, '#c42e28', 6.4, 0.58, 1.05, htSeaX, 23.4, htSeaZ);
  for (const cOff of [-2.4, 2.4]) {
    const pw = new THREE.CylinderGeometry(0.45, 0.45, 0.22, 8);
    pw.rotateZ(Math.PI * 0.5);
    pw.translate(htSeaX + cOff, 23.5, htSeaZ);
    organicParts.push(colorizeGeometry(pw, '#3b4248'));
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(htBaseX + cOff, htBaseY + 24.8, htBaseZ),
      new THREE.Vector3((htBaseX + htSeaX) * 0.5 + cOff, (htBaseY + 24.8 + 23.4) * 0.5 - 2.6, (htBaseZ + htSeaZ) * 0.5),
      new THREE.Vector3(htSeaX + cOff, 23.4, htSeaZ)
    ]);
    organicParts.push(colorizeGeometry(createSmoothTaperedTubeGeometry(cableCurve, 18, 4, () => 0.065), '#464e56'));
    const gPt = cableCurve.getPoint(cOff < 0 ? 0.36 : 0.64);
    addColoredCylinder(organicParts, '#464e56', 0.06, 0.06, 2.4, 5, gPt.x, gPt.y - 1.2, gPt.z);
    addColoredBox(organicParts, '#464e56', 0.48, 0.28, 0.32, gPt.x, gPt.y, gPt.z);
    addColoredBox(organicParts, cOff < 0 ? '#d93228' : '#1b72b5', 2.4, 1.85, 3.4, gPt.x, gPt.y - 3.1, gPt.z);
    addColoredBox(organicParts, '#9ad8ee', 2.48, 0.72, 2.6, gPt.x, gPt.y - 2.95, gPt.z);
  }
  // Curved white-sand & shallow turquoise coral sandbar shelf framing Bãi Sao beach cove
  const sandShelf = new THREE.CylinderGeometry(36.0, 40.0, 0.35, 24);
  sandShelf.scale(1.15, 1.0, 0.52);
  sandShelf.translate(-335.0, -0.02, 474.0);
  organicParts.push(colorizeGeometry(sandShelf, '#e6d8b4'));
  // Lush emerald coastal jungle backdrop domes behind Phú Quốc crescent hills
  const pqHillSpots: Array<[number, number, number]> = [
    [-358, 526, 7.5],
    [-335, 540, 8.8],
    [-312, 530, 7.8],
    [-374, 512, 6.8]
  ];
  for (let h = 0; h < pqHillSpots.length; h++) {
    const [hx, hz, hr] = pqHillSpots[h];
    const hy = ctx.getHeight(hx, hz);
    const canopy = createSculptedRockGeometry(960 + h * 13, hr, hr * 0.56, hr * 0.92, 1);
    canopy.translate(hx, hy + hr * 0.32, hz);
    organicParts.push(colorizeGeometry(canopy, h % 2 === 0 ? '#28642d' : '#357834'));
  }

  // 4. Granite Cove Boulders along beach points (DELETED duplicate boulder at [-372, 476] clipping Dinh Cậu!)
  const boulderCoords: Array<[number, number, number, number, number]> = [
    [-378, 486, 3.6, 2.4, 3.2],
    [-366, 470, 2.8, 1.9, 2.6],
    [-298, 478, 4.2, 2.7, 3.6],
    [-292, 488, 3.4, 2.2, 3.0],
    [-304, 471, 2.6, 1.8, 2.4],
    [-360, 464, 3.5, 2.2, 3.1]
  ];
  for (let i = 0; i < boulderCoords.length; i++) {
    const [bx, bz, rx, ry, rz] = boulderCoords[i];
    const by = ctx.getHeight(bx, bz);
    const rock = createSculptedRockGeometry(820 + i * 19, rx, ry, rz, 2);
    rock.translate(bx, by + ry * 0.1, bz);
    boulderParts.push(rock);
  }

  const phuQuocOrganicMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide
  });
  const pierPoolMat = ctx.sharedShaders
    ? ctx.sharedShaders.warmLightPool.material
    : (() => {
      const res = createWarmLightPoolMaterial();
      ctx.extraMaterials.push(res.material);
      ctx.animatedUniforms?.push(res.uniforms);
      return res.material;
    })();
  ctx.extraMaterials.push(phuQuocOrganicMat);

  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (361–380) — Low-Poly, castShadow=false
  // ==========================================================================
  const pqW2Wood: THREE.BufferGeometry[] = [];
  const pqW2Stone: THREE.BufferGeometry[] = [];
  const pqW2Org: THREE.BufferGeometry[] = [];
  const pqW2Glow: THREE.BufferGeometry[] = [];

  // [361][362] Miếu Dinh Cậu interior gilded altar + red silk curtains & sacred headland ancient shade tree
  addColoredBox(pqW2Org, '#d8a428', 0.95, 0.92, 1.8, dcX + 1.4, dcDeckY + 0.72, dcZ);
  addColoredBox(pqW2Org, '#b82018', 0.12, 1.85, 2.2, dcX + 2.12, dcDeckY + 1.85, dcZ);
  addCyl(pqW2Wood, 0.24, 0.36, 3.6, 6, dcX - 3.6, dcDeckY + 1.8, dcZ + 3.2);
  addColoredCone(pqW2Org, '#2d6e2c', 2.4, 2.1, 6, dcX - 3.6, dcDeckY + 4.2, dcZ + 3.2);
  // [363][364] Dương Đông Lighthouse exterior iron maintenance ladder + steel hatch & Lighthouse Keeper's White Cottage
  addColoredBox(pqW2Org, '#262b30', 0.45, 12.6, 0.14, lhX + 1.12, dcDeckY + 6.5, lhZ);
  addColoredBox(pqW2Org, '#3a424a', 0.65, 1.35, 0.16, lhX, dcDeckY + 0.72, lhZ + 1.12);
  const kcX = dcX + 2.8;
  const kcZ = dcZ + 9.2;
  const kcY = ctx.getHeight(kcX, kcZ);
  addColoredBox(pqW2Org, '#f4f1e8', 5.2, 2.8, 3.8, kcX, kcY + 1.4, kcZ);
  const kcRoof = createHippedRoofGeometry(5.8, 4.4, 3.4, 0.4, 1.25);
  kcRoof.translate(kcX, kcY + 2.8, kcZ);
  pqW2Org.push(colorizeGeometry(kcRoof, '#b82c22'));
  // [365] 2 Additional Offshore Phú Quốc Squid-Fishing Fleet Trawlers anchored off Dinh Cậu breakwater
  for (const [fx, fz, fyaw] of [[-386.0, 456.0, 0.35], [-368.0, 448.0, -0.22]]) {
    addColoredBox(pqW2Org, '#1f5e9c', 2.4, 1.05, 8.2, fx, 0.52, fz, fyaw);
    addColoredBox(pqW2Org, '#b83227', 1.65, 1.25, 2.8, fx, 1.55, fz - 0.4, fyaw);
    addColoredCylinder(pqW2Org, '#cfd4da', 0.03, 0.04, 3.4, 5, fx, 2.6, fz - 0.4, fyaw);
    addColoredCylinder(pqW2Org, '#cfd4da', 0.025, 0.025, 4.8, 5, fx, 3.6, fz - 0.4, fyaw, 0, Math.PI * 0.5);
    pqW2Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(fx - 1.5, 3.5, fz - 0.4));
    pqW2Glow.push(new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(fx + 1.5, 3.5, fz - 0.4));
  }
  // [366] Dương Đông Breakwater concrete fish-unloading jetty with blue fish crates & ice boxes
  addBox(pqW2Stone, 5.4, 0.55, 2.8, dcX - 14.0, 1.85, dcZ - 3.6, 0.25);
  for (let cr = 0; cr < 3; cr++) {
    addColoredBox(pqW2Org, cr % 2 === 0 ? '#1e74b8' : '#e8e6de', 0.72, 0.45, 0.55, dcX - 15.2 + cr * 1.1, 2.35, dcZ - 3.6);
  }
  // [367] Hòn Thơm Cable Car Base Station Mediterranean-style arched arcade & ticket booth
  addColoredBox(pqW2Org, '#e8cfa6', 9.2, 3.6, 4.2, htBaseX, htBaseY + 1.8, htBaseZ + 4.8);
  addColoredBox(pqW2Org, '#b83828', 9.8, 0.45, 4.8, htBaseX, htBaseY + 3.78, htBaseZ + 4.8);
  for (let a = -1; a <= 1; a++) {
    addColoredBox(pqW2Org, '#2a343d', 1.8, 2.4, 0.22, htBaseX + a * 2.8, htBaseY + 1.2, htBaseZ + 2.65);
  }
  // [368] Bãi Sao wooden kayak & paddleboard rental rack with colorful kayaks
  const kyY = ctx.getHeight(-322.0, 474.5);
  addBox(pqW2Wood, 2.6, 1.45, 0.45, -322.0, kyY + 0.72, 474.5);
  addColoredBox(pqW2Org, '#f2b824', 0.65, 0.26, 3.2, -322.6, kyY + 0.42, 474.2, 0.15);
  addColoredBox(pqW2Org, '#229668', 0.65, 0.26, 3.2, -321.4, kyY + 0.92, 474.2, 0.15);
  // [369] Phú Quốc Night Market glowing entrance archway & pearl-jewelry display cases
  const nmArchY = ctx.getHeight(-337.0, 490.2);
  addCyl(pqW2Wood, 0.14, 0.16, 3.6, 6, -340.5, nmArchY + 1.8, 490.2);
  addCyl(pqW2Wood, 0.14, 0.16, 3.6, 6, -333.5, nmArchY + 1.8, 490.2);
  addColoredBox(pqW2Org, '#d93829', 7.6, 0.68, 0.26, -337.0, nmArchY + 3.65, 490.2);
  pqW2Glow.push(
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(-339.0, nmArchY + 3.25, 490.2),
    new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(-335.0, nmArchY + 3.25, 490.2)
  );
  // [370] Phú Quốc Pepper Farm wooden harvest ladder & sun-drying peppercorn mats
  const pfY = ctx.getHeight(-344.0, 500.0);
  addBox(pqW2Wood, 0.55, 2.6, 0.10, -346.5, pfY + 1.25, 501.4, 0, -0.25, 0);
  addColoredBox(pqW2Org, '#4a3522', 2.4, 0.06, 1.8, -341.0, pfY + 0.05, 500.2);
  // [371] Fish-Sauce Barrel House wooden catwalk ladder & clay bottling jars
  addBox(pqW2Wood, 0.55, 2.2, 0.10, -354.5, vatBaseY + 1.1, 486.8, 0, 0.28, 0);
  for (let jr = 0; jr < 3; jr++) {
    addColoredCylinder(pqW2Org, '#8c4e28', 0.20, 0.16, 0.45, 6, -352.0, vatBaseY + 0.24, 487.2 + jr * 0.7);
  }
  // [372] Bãi Sao beachfront seafood pavilion dining tables, chairs & charcoal grill counter
  for (const tx of [-321.5, -314.5]) {
    addBox(pqW2Wood, 1.6, 0.78, 1.1, tx, restY + 0.42, restZ);
  }
  addColoredBox(pqW2Org, '#42484f', 1.4, 0.85, 0.72, restX, restY + 0.44, restZ - 1.6);
  // [373][379] Sunset Pier timber benches, coiled hawsers & T-Head photo bench under Cầu Hôn arch
  for (const pz of [456.0, 464.0]) {
    addBox(pqW2Wood, 0.52, 0.45, 1.8, pierX - 1.55, pierDeckY + 0.35, pz);
  }
  addBox(pqW2Wood, 2.2, 0.48, 0.58, pierX, pierDeckY + 0.36, 447.6);
  // [374] Floating swim-platform boarding ladder & beach umbrella
  addBox(pqW2Wood, 0.62, 1.1, 0.12, -326.0, 0.12, 446.2);
  addColoredCylinder(pqW2Org, '#d4d0c5', 0.03, 0.03, 2.1, 5, -326.0, 1.25, 444.0);
  addColoredCone(pqW2Org, '#e6a822', 1.15, 0.42, 6, -326.0, 2.35, 444.0);
  // [375][376] Coral-reef conservation signboard & Dinh Cậu breakwater iron safety chain bollards
  addBox(pqW2Wood, 1.4, 1.2, 0.12, -330.0, beachY + 0.95, 471.5);
  for (let b = 0; b < 4; b++) {
    addColoredCylinder(pqW2Org, '#2a2e33', 0.07, 0.09, 0.78, 5, dcX + 7.2 + b * 3.2, 2.2, dcZ + 2.6 + b * 0.9);
  }
  // [377][378][380] Coconut-drink beach kiosk (with 2 roof support posts!), additional Thuyền Thúng basket boat & hibiscus stone planters at Dinh Cậu gate
  const ckY = ctx.getHeight(-348.0, 472.5);
  addBox(pqW2Wood, 2.2, 0.92, 1.2, -348.0, ckY + 0.46, 472.5);
  addCyl(pqW2Wood, 0.05, 0.06, 2.15, 5, -349.0, ckY + 1.08, 472.5);
  addCyl(pqW2Wood, 0.05, 0.06, 2.15, 5, -347.0, ckY + 1.08, 472.5);
  addColoredCone(pqW2Org, '#c49b52', 1.75, 0.88, 5, -348.0, ckY + 2.45, 472.5);
  addColoredCylinder(pqW2Org, '#8b6331', 0.92, 0.62, 0.46, 8, -350.5, ctx.getHeight(-350.5, 473.0) + 0.24, 473.0);
  for (const gz of [-2.2, 2.2]) {
    addBox(pqW2Stone, 0.72, 0.55, 0.72, gateFootX + 0.8, gateFootY + 0.28, gateFootZ + gz);
    addColoredCone(pqW2Org, '#d93268', 0.42, 0.52, 5, gateFootX + 0.8, gateFootY + 0.78, gateFootZ + gz);
  }

  group.add(
    makeMergedMesh('PhuQuocSunsetPierAndPosts', woodParts, ctx.materials.darkWood),
    makeMergedMesh('PhuQuocPierLanterns', lanternParts, ctx.materials.lanternSilk, false, false),
    makeMergedMesh(
      'PhuQuocPierLanternCores',
      lanternCoreParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    ),
    makeMergedMesh('PhuQuocPierLightPools', lightPoolParts, pierPoolMat, false, false),
    makeMergedMesh('PhuQuocShoreBoulders', boulderParts, ctx.materials.granite),
    makeMergedMesh('PhuQuocPalmsAndThatch', organicParts, phuQuocOrganicMat),
    // Wave 2 merged meshes (castShadow = false, zero new materials!)
    makeMergedMesh('PhuQuocWave2Wood', pqW2Wood, ctx.materials.darkWood, false, true),
    makeMergedMesh('PhuQuocWave2Stone', pqW2Stone, ctx.materials.stone, false, true),
    makeMergedMesh('PhuQuocWave2Organic', pqW2Org, phuQuocOrganicMat, false, true),
    makeMergedMesh('PhuQuocWave2Glow', pqW2Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false)
  );
  // P1 Phú Quốc Mũi Dinh Cậu Motif Upgrades (`MN-091`..`MN-095`): Mounted directly on Miếu Dinh Cậu front porch & terrace!
  const pqMotifGold = new THREE.Mesh(
    mergeNormalized(createCuaVongParts(dcX + 2.18, dcDeckY + 2.65, dcZ, 2.4, 0.62, Math.PI * 0.5, 'long_phung')),
    ctx.materials.gold
  );
  pqMotifGold.castShadow = false;
  const pqMotifStone = new THREE.Mesh(
    mergeNormalized([
      ...createAncientStoneLanternParts(dcX + 3.6, dcDeckY + 0.24, dcZ - 2.8, 0.9),
      ...createAncientStoneLanternParts(dcX + 3.6, dcDeckY + 0.24, dcZ + 2.8, 0.9)
    ]),
    ctx.materials.granite
  );
  pqMotifStone.castShadow = false;
  group.add(pqMotifGold, pqMotifStone);
  tagMotifIds(group, [
    'HV-A04', 'HV-C03', 'HV-D06', 'HV-D12', 'HV-I01', 'HV-NEW-MB-12', 'HV-NEW-MN-01'
  ]);

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 48.0 });
}

// ============================================================================
// 10. Côn Đảo (335, 510)
//     20m-tall coastal granite boulder arches, Cầu Tàu 914 colonial pier portico, 18m Hàng Dương Obelisk
// ============================================================================
function buildConDaoIsland(ctx: VietnamBuilderContext): void {
  const cx = 335;
  const cz = 510;

  const group = new THREE.Group();
  group.name = 'ConDaoIslandComplex';

  const graniteParts: THREE.BufferGeometry[] = [];
  const ochreParts: THREE.BufferGeometry[] = [];
  const whiteParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];

  const colonialStoneMat = ctx.materials.ochreSand ?? ctx.materials.yellowOchrePlaster;

  // 1. Coastal granite boulders sunken firmly into shore slopes (fictional 20m boulder arch removed — ref 37, 104, 105!)
  const rockCluster: Array<[number, number, number, number, number]> = [
    [292, 476, 5.4, 4.0, 4.8],
    [297, 488, 6.0, 4.5, 5.2],
    [364, 470, 5.8, 4.2, 5.0],
    [374, 484, 6.4, 4.8, 5.5],
    [378, 502, 5.6, 4.0, 4.8],
    [289, 465, 3.8, 2.6, 3.4],
    [354, 462, 4.0, 2.8, 3.6]
  ];
  for (let i = 0; i < rockCluster.length; i++) {
    const [rxp, rzp, rx, ry, rz] = rockCluster[i];
    const ryp = ctx.getHeight(rxp, rzp);
    const boulder = createSculptedRockGeometry(410 + i * 29, rx, ry, rz, 2);
    boulder.translate(rxp, ryp - ry * 0.25, rzp);
    graniteParts.push(boulder);
  }

  // 2. Historic Weathered Cream-Stone Cầu Tàu 914 & Arched Colonial Pier Portico
  const pierX = 335.0;
  const pierDeckY = 1.85;
  // Stone pier extending from landward gatehouse (z = 466) out over turquoise cove (z = 426)
  addBox(stoneParts, 6.4, 0.7, 40.0, pierX, pierDeckY - 0.25, 446.0);
  addBox(stoneParts, 10.5, 0.8, 7.6, pierX, pierDeckY - 0.25, 427.5);

  // Arched masonry stone piers grounded down into seabed (y = -3.0m) + embossed granite coping blocks & iron mooring rings
  for (let pz = 428.0; pz <= 464.0; pz += 6.0) {
    addBox(stoneParts, 6.0, 5.0, 2.0, pierX, pierDeckY - 2.6, pz);
    for (const sx of [-3.15, 3.15]) {
      addBox(graniteParts, 0.42, 0.55, 1.8, pierX + sx, pierDeckY - 0.15, pz);
    }
  }
  // Low stone parapet curbs along Cầu Tàu 914
  addBox(stoneParts, 0.45, 0.85, 36.0, pierX - 2.95, pierDeckY + 0.42, 446.0);
  addBox(stoneParts, 0.45, 0.85, 36.0, pierX + 2.95, pierDeckY + 0.42, 446.0);

  // Arched Colonial Pier Portico + Expanded 36m French-Colonial Arcade Quarter + Cầu Tàu 914 Plaques, Bollards & Boats
  const portZ = 466.0;
  const portBaseY = ctx.getHeight(pierX, portZ);
  const porticoDeckY = Math.max(portBaseY, pierDeckY);
  const porticoBaseH = Math.max(2.0, porticoDeckY - pierDeckY + 2.2);
  addBox(stoneParts, 36.0, porticoBaseH, 9.2, pierX, porticoDeckY - porticoBaseH * 0.5 + 0.1, portZ);

  for (let s = 0; s < 5; s++) {
    const t = s / 4;
    const sy = THREE.MathUtils.lerp(pierDeckY, porticoDeckY, t);
    const sz = THREE.MathUtils.lerp(459.0, 462.4, t);
    addBox(stoneParts, 6.0, Math.max(0.6, sy - pierDeckY + 0.5), 0.9, pierX, (sy + pierDeckY) * 0.5, sz);
  }

  const ironLampParts: THREE.BufferGeometry[] = [];
  const candleGlowParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  // Arched Colonial Pier Portico + Closed French-Colonial Arcade Wings with Recessed Rear Walls,
  // French Green Louvered Shutters, Barred Prison Windows, White Cornices & Sloped Red-Tile Veranda Roofs (ref 105)!
  const porticoWall = createArchedWallGeometry(16.0, 7.6, 3.2, 5.4, 6.0);
  porticoWall.translate(pierX, porticoDeckY, portZ);
  ochreParts.push(porticoWall);
  addBox(whiteParts, 16.6, 0.36, 3.6, pierX, porticoDeckY + 7.65, portZ);
  for (const sx of [-1, 1]) {
    addBox(ochreParts, 3.0, 7.6, 3.8, pierX + sx * 6.4, porticoDeckY + 3.8, portZ);
    addBox(whiteParts, 3.5, 0.45, 4.3, pierX + sx * 6.4, porticoDeckY + 7.72, portZ);
    // Recessed solid rear & side closure walls for each colonial arcade wing (NO hollow see-through boxes!)
    addBox(ochreParts, 9.2, 6.4, 0.75, pierX + sx * 12.7, porticoDeckY + 3.2, portZ + 2.35);
    addBox(ochreParts, 0.65, 6.4, 4.4, pierX + sx * 17.2, porticoDeckY + 3.2, portZ + 0.4);
    // Flanking French-colonial arched arcade bays with green louvered shutters & iron barred windows
    for (let b = 0; b < 2; b++) {
      const wx = pierX + sx * (10.5 + b * 4.4);
      const archBay = createArchedWallGeometry(4.4, 6.4, 0.95, 2.4, 4.6);
      archBay.translate(wx, porticoDeckY, portZ - 1.35);
      ochreParts.push(archBay);
      // Crisp white molded cornice above each bay
      addBox(whiteParts, 4.65, 0.38, 4.85, wx, porticoDeckY + 6.52, portZ + 0.4);
      // Recessed dark window/doorway opening + French green louvered timber shutters on rear wall!
      addBox(voidParts, 1.55, 2.85, 0.32, wx, porticoDeckY + 2.55, portZ + 1.92);
      for (const shSide of [-0.95, 0.95]) {
        addColoredBox(leafParts, '#2b6646', 0.68, 2.75, 0.12, wx + shSide, porticoDeckY + 2.55, portZ + 1.88);
      }
      // Dark iron colonial prison window bars inside each recessed opening
      for (let bar = -2; bar <= 2; bar++) {
        addCyl(ironLampParts, 0.025, 0.025, 2.75, 5, wx + bar * 0.28, porticoDeckY + 2.55, portZ + 1.82);
      }
      // Square white colonial veranda column standing along front edge
      addBox(whiteParts, 0.48, 4.4, 0.48, wx + sx * 2.1, porticoDeckY + 2.2, portZ - 3.15);
    }
    addBox(whiteParts, 0.48, 4.4, 0.48, pierX + sx * 8.4, porticoDeckY + 2.2, portZ - 3.15);
    addBox(whiteParts, 9.4, 0.34, 0.46, pierX + sx * 12.7, porticoDeckY + 4.45, portZ - 3.15);
    // Sloped Red-Tile Veranda Lean-To Roof projecting over the colonial front veranda!
    const verRoof = new THREE.BoxGeometry(9.6, 0.16, 2.55);
    verRoof.rotateX(0.32);
    verRoof.translate(pierX + sx * 12.7, porticoDeckY + 4.88, portZ - 2.35);
    roofParts.push(verRoof);

    const wingRoof = createHippedRoofGeometry(9.8, 5.4, 6.4, 0.4, 2.2);
    wingRoof.translate(pierX + sx * 12.7, porticoDeckY + 6.72, portZ + 0.4);
    roofParts.push(wingRoof);
  }
  const porticoRoof = createHippedRoofGeometry(17.8, 6.4, 10.2, 0.6, 3.1);
  porticoRoof.translate(pierX, porticoDeckY + 7.75, portZ);
  roofParts.push(porticoRoof);

  // Readable "DI TÍCH LỊCH SỬ CẦU TÀU 914" Stele Plaque + Twin Historic Stone Gate Obelisks + Cast-Iron Mooring Bollards + Pedestal-Anchored Lamps
  for (const sx of [-3.35, 3.35]) {
    addBox(graniteParts, 1.15, 2.65, 1.15, pierX + sx, porticoDeckY + 1.32, 461.2);
    addBox(whiteParts, 1.32, 0.24, 1.32, pierX + sx, porticoDeckY + 2.75, 461.2);
    addCyl(goldParts, 0.18, 0.28, 0.45, 6, pierX + sx, porticoDeckY + 3.08, 461.2);
  }
  const cdPierSign = createSignagePlaqueMesh(
    { text: 'CẦU TÀU 914', subText: 'DI TÍCH LỊCH SỬ CÔN ĐẢO', width: 3.8, height: 0.95, style: 'stone' },
    ctx
  );
  cdPierSign.rotation.y = Math.PI;
  cdPierSign.position.set(pierX + 4.4, porticoDeckY + 1.65, 461.5);
  group.add(cdPierSign);
  // [183][184] Carved Stone Memorial Monument of 914 Prisoners (*Bia Tưởng Niệm 914 Chiến Sĩ*) + Stacked Historic Stone Blocks + Portico Clock
  addBox(graniteParts, 1.85, 0.42, 1.45, pierX - 4.4, porticoDeckY + 0.21, 461.5);
  addBox(graniteParts, 1.35, 2.15, 0.48, pierX - 4.4, porticoDeckY + 1.48, 461.5);
  const wreathRing = new THREE.TorusGeometry(0.42, 0.09, 6, 12);
  wreathRing.translate(pierX - 4.4, porticoDeckY + 1.55, 461.22);
  goldParts.push(wreathRing);
  addCyl(bronzeParts, 0.22, 0.18, 0.34, 8, pierX - 4.4, porticoDeckY + 0.58, 460.6);
  addBox(graniteParts, 0.85, 0.55, 0.75, pierX - 6.0, porticoDeckY + 0.28, 461.5);
  addBox(graniteParts, 0.75, 0.45, 0.65, pierX - 5.9, porticoDeckY + 0.78, 461.5);
  addCyl(whiteParts, 0.65, 0.65, 0.18, 12, pierX, porticoDeckY + 6.75, portZ - 1.65, 0, Math.PI * 0.5, 0);

  // 2b. FIX CD-02: Historic Côn Đảo Prison Complex (*Trại Giam Côn Đảo*, 32m × 20m at (306, 488) — ref 105_cau_tau_914_con_dao.jpg!)
  // Central gravel yard flanked by low mossy solitary cellblock (left) & 2-story white-columned prison wing with red-tile veranda roof (right)
  const prisX = 306.0;
  const prisZ = 488.0;
  const prisY = Math.max(ctx.getHeight(prisX, prisZ), 1.4);
  addBox(stoneParts, 19.5, 2.2, 33.0, prisX, prisY - 1.0, prisZ); // gravel yard foundation
  // Left wing: low mossy ochre solitary cellblock (32m long × 3.4m tall) with 8 iron-barred cell doors
  addBox(ochreParts, 4.6, 3.4, 31.5, prisX - 7.4, prisY + 1.7, prisZ);
  addBox(roofParts, 5.2, 0.32, 32.0, prisX - 7.4, prisY + 3.55, prisZ);
  for (let c = 0; c < 8; c++) {
    const czCell = prisZ - 13.0 + c * 3.7;
    addBox(voidParts, 0.24, 2.2, 1.25, prisX - 5.08, prisY + 1.18, czCell);
    addBox(stoneParts, 0.55, 0.22, 1.45, prisX - 4.85, prisY + 0.12, czCell);
    for (let br = -2; br <= 2; br++) {
      addCyl(ironLampParts, 0.02, 0.02, 2.15, 4, prisX - 5.02, prisY + 1.18, czCell + br * 0.22);
    }
  }
  // Right wing: 2-story white colonial prison block (32m long × 7.0m tall) with 10 square veranda columns + sloped terracotta tile veranda roof
  addBox(whiteParts, 5.2, 7.0, 31.5, prisX + 7.8, prisY + 3.5, prisZ);
  const prisMainRoof = createHippedRoofGeometry(6.4, 32.6, 1.6, 26.5, 2.2);
  prisMainRoof.translate(prisX + 7.8, prisY + 7.05, prisZ);
  roofParts.push(prisMainRoof);
  // Veranda colonnade (10 square white columns) + sloped red-tile veranda canopy along yard edge
  for (let col = 0; col < 10; col++) {
    const czCol = prisZ - 14.4 + col * 3.2;
    addBox(whiteParts, 0.44, 3.3, 0.44, prisX + 3.6, prisY + 1.65, czCol);
    if (col < 8) {
      // Upper floor barred square prison windows
      addBox(voidParts, 0.24, 1.25, 1.25, prisX + 5.18, prisY + 5.25, czCol + 1.6);
    }
  }
  const prisVerRoof = new THREE.BoxGeometry(2.35, 0.16, 31.8);
  prisVerRoof.rotateZ(0.28);
  prisVerRoof.translate(prisX + 4.35, prisY + 3.65, prisZ);
  roofParts.push(prisVerRoof);
  // [181][182][188] Rear stone perimeter enclosure wall + Prison Yard Water Well, Watchtower (*Tháp Canh*) & "Chuồng Cọp" Tiger Cages Catwalk
  addBox(stoneParts, 19.6, 3.2, 0.65, prisX, prisY + 1.6, prisZ + 16.0);
  // Central stone water well in prison yard
  addCyl(stoneParts, 0.85, 0.95, 0.82, 10, prisX, prisY + 0.41, prisZ - 2.0);
  // Corner prison watchtower (*Tháp Canh*) at NW corner
  addBox(ochreParts, 2.4, 7.8, 2.4, prisX - 8.6, prisY + 3.9, prisZ - 14.8);
  const wtRoof = createHippedRoofGeometry(3.2, 3.2, 0.4, 0.4, 1.15);
  wtRoof.translate(prisX - 8.6, prisY + 7.8, prisZ - 14.8);
  roofParts.push(wtRoof);
  // "Chuồng Cọp" (Tiger Cages) open-air iron-grate overhead catwalk & cell partitions
  for (let tc = 0; tc < 4; tc++) {
    const tcZ = prisZ + 4.5 + tc * 2.2;
    addBox(stoneParts, 3.8, 2.4, 0.22, prisX - 1.5, prisY + 1.2, tcZ);
    for (let bar = -3; bar <= 3; bar++) {
      addCyl(ironLampParts, 0.02, 0.02, 2.1, 4, prisX - 1.5 + bar * 0.45, prisY + 2.45, tcZ - 1.1, 0, Math.PI * 0.5, 0);
    }
  }

  for (let pz = 428; pz <= 456; pz += 7.0) {
    for (const sx of [-2.85, 2.85]) {
      addCyl(ironLampParts, 0.14, 0.19, 0.72, 8, pierX + sx, pierDeckY + 0.42, pz);
      // Wrought-iron mooring ring bolted into outer stone pier face
      const mRing = new THREE.TorusGeometry(0.18, 0.035, 5, 8);
      mRing.rotateY(Math.PI * 0.5);
      mRing.translate(pierX + (sx > 0 ? 3.25 : -3.25), pierDeckY - 0.35, pz);
      ironLampParts.push(mRing);
    }
    if (pz === 435 || pz === 449) {
      // Anchor all 4 pier streetlamps solidly on corner stone pedestals integrated with pier parapet!
      for (const lxOff of [-2.95, 2.95]) {
        addBox(stoneParts, 0.78, 0.98, 0.78, pierX + lxOff, pierDeckY + 0.49, pz);
        addBox(stoneParts, 0.88, 0.14, 0.88, pierX + lxOff, pierDeckY + 1.02, pz);
        addHeritageStreetlampParts(ironLampParts, candleGlowParts, pierX + lxOff, pierDeckY + 1.08, pz, 3.55, false);
      }
    }
  }
  // 2 Sculpted Tapered Curved Wooden Boats moored beside Cầu Tàu 914 (replacing boxy blocks!)
  for (const [bx, bz, byaw] of [
    [pierX - 7.8, 438.0, 0.15],
    [pierX + 8.4, 444.0, -0.22]
  ]) {
    const bLen = 8.6;
    const bBeam = 2.55;
    const bHull = new THREE.BoxGeometry(bBeam, 1.05, bLen, 6, 3, 12);
    const bp = bHull.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      let x = bp.getX(i);
      let y = bp.getY(i);
      const z = bp.getZ(i);
      const tz = z / (bLen * 0.5);
      const ty = (y + 0.525) / 1.05;
      const planW = tz > 0 ? Math.pow(Math.max(0.06, 1.0 - Math.pow(tz, 1.65)), 0.55) : 0.78 + 0.22 * (1.0 + tz);
      const sheer = 0.44 * Math.pow(Math.abs(tz), 2.1) + (tz > 0 ? 0.30 * tz * tz : 0);
      x *= planW * (0.50 + 0.50 * ty);
      y += sheer + 0.16;
      bp.setXYZ(i, x, y, z);
    }
    bHull.computeVertexNormals();
    bHull.rotateY(byaw);
    bHull.translate(bx, 0.04, bz);
    woodParts.push(bHull);
    // Wooden pilot cabin & white cabin roof cap
    addBox(woodParts, 1.75, 1.12, 2.85, bx, 1.15, bz - 0.35, byaw);
    addBox(whiteParts, 1.92, 0.14, 3.15, bx, 1.78, bz - 0.35, byaw);
  }

  // 3. Hàng Dương 21.6m Memorial Obelisk, Bronze Reliefs, Authentic 4-Pillar Tứ Trụ + Pure-White 3-Arch Tam Quan Gate at (335, 510)
  const memY = ctx.getHeight(cx, cz);
  addCyl(stoneParts, 11.2, 12.6, 4.2, 8, cx, memY - 1.5, cz);
  addCyl(stoneParts, 7.6, 8.4, 1.1, 8, cx, memY + 0.95, cz);

  for (let s = 0; s < 6; s++) {
    addBox(stoneParts, 6.4, 0.75, 1.1, cx, memY - 0.2 + s * 0.3, cz - 12.2 + s * 1.0);
  }

  // [185][191][192][200] Bronze relief panels on Obelisk base, Đền Thờ Côn Đảo Pavilion, Stone Lantern Avenue & Flower Urns
  addBox(graniteParts, 4.6, 2.8, 4.6, cx, memY + 2.8, cz);
  addBox(bronzeParts, 4.78, 1.35, 4.78, cx, memY + 3.1, cz);
  // Đền Thờ Côn Đảo curved-roof memorial temple flanking Hàng Dương (+X east side)
  const dtX = cx + 22.0;
  const dtZ = cz + 6.0;
  const dtY = ctx.getHeight(dtX, dtZ);
  addBox(graniteParts, 7.6, 0.75, 6.4, dtX, dtY + 0.38, dtZ);
  for (const px of [-2.8, 2.8]) {
    for (const pz of [-2.2, 2.2]) {
      addBox(whiteParts, 0.38, 3.4, 0.38, dtX + px, dtY + 2.45, dtZ + pz);
    }
  }
  const dtRoof = createVietnameseCurvedRoofGeometry(8.8, 7.4, 2.8, 0.6, 2.1, 0.38);
  dtRoof.translate(dtX, dtY + 4.15, dtZ);
  roofParts.push(dtRoof);
  // Carved stone lantern avenue & terracotta flower urns along Hàng Dương central approach
  for (const lz of [cz - 18.0, cz - 12.0, cz - 6.0]) {
    for (const lxS of [-3.4, 3.4]) {
      graniteParts.push(...createAncientStoneLanternParts(cx + lxS, memY + 0.1, lz, 0.72));
    }
  }
  const obShaft = new THREE.CylinderGeometry(0.88, 1.75, 14.8, 4);
  obShaft.rotateY(Math.PI * 0.25);
  obShaft.translate(cx, memY + 11.4, cz);
  graniteParts.push(obShaft);

  const obPyramid = new THREE.ConeGeometry(1.22, 2.8, 4);
  obPyramid.rotateY(Math.PI * 0.25);
  obPyramid.translate(cx, memY + 20.1, cz);
  graniteParts.push(obPyramid);
  addCyl(goldParts, 0.14, 0.24, 1.4, 8, cx, memY + 21.8, cz);
  goldParts.push(new THREE.SphereGeometry(0.38, 10, 8).translate(cx, memY + 22.65, cz));

  const memPlaque = createSignagePlaqueMesh(
    { text: 'ĐÀI TƯỞNG NIỆM', subText: 'NGHĨA TRANG HÀNG DƯƠNG', width: 3.4, height: 1.05, style: 'bronze', motifSeed: 1042 },
    ctx
  );
  memPlaque.rotation.y = Math.PI;
  memPlaque.position.set(cx, memY + 3.1, cz - 2.46);
  group.add(memPlaque);

  // Authentic Hàng Dương Cemetery Gate (ref 104_nghia_trang_hang_duong.jpg):
  // (a) 4 Freestanding Grey Granite *Tứ Trụ* Obelisk Pillars standing in front of the Tam Quan Gate (z = tqZ - 3.8):
  //     2 taller inner pillars (x = ±2.8, H=6.8m) crowned with sculpted lotus buds,
  //     2 shorter outer pillars (x = ±6.4, H=4.9m) crowned with sculpted guardian *Nghê*!
  const tqZ = cz - 16.5;
  const tqY = ctx.getHeight(cx, tqZ);
  const tuTruZ = tqZ - 3.8;
  const tuTruY = ctx.getHeight(cx, tuTruZ);
  const tuTruSpecs: Array<{ ox: number; h: number; isInner: boolean }> = [
    { ox: -6.4, h: 4.9, isInner: false },
    { ox: -2.8, h: 6.8, isInner: true },
    { ox: 2.8, h: 6.8, isInner: true },
    { ox: 6.4, h: 4.9, isInner: false }
  ];
  for (const tp of tuTruSpecs) {
    const px = cx + tp.ox;
    addBox(graniteParts, 1.38, 0.72, 1.38, px, tuTruY + 0.36, tuTruZ);
    addBox(graniteParts, 0.92, tp.h, 0.92, px, tuTruY + 0.72 + tp.h * 0.5, tuTruZ);
    addBox(graniteParts, 1.24, 0.32, 1.24, px, tuTruY + 0.72 + tp.h + 0.16, tuTruZ);
    if (tp.isInner) {
      // Sculpted granite lotus-bud finial crowning the 2 tall inner pillars
      addCyl(graniteParts, 0.44, 0.32, 0.36, 8, px, tuTruY + 0.72 + tp.h + 0.50, tuTruZ);
      addCyl(graniteParts, 0.04, 0.34, 0.95, 8, px, tuTruY + 0.72 + tp.h + 1.15, tuTruZ);
    } else {
      // Sculpted granite guardian *Nghê* crowning the 2 outer pillars
      graniteParts.push(...createGuardianBeastParts(px, tuTruY + 0.72 + tp.h + 0.32, tuTruZ, Math.PI, 0.68, 'nghe'));
    }
  }

  // (b) Pure-White 3-Arch Tam Quan Gate with Molded Cornices, Dark Wooden Arch Doors,
  //     2-Tier Red Terracotta Roofs & White *Lưỡng Long Chầu Nguyệt*!
  const centerBay = createArchedWallGeometry(6.6, 6.4, 1.8, 3.8, 5.0);
  centerBay.translate(cx, tqY, tqZ);
  whiteParts.push(centerBay);
  addBox(whiteParts, 7.2, 0.42, 2.25, cx, tqY + 6.45, tqZ);
  // Dark wooden arched double gate doors partially opened inside center arch
  for (const ds of [-1, 1]) {
    addBox(woodParts, 1.55, 4.1, 0.18, cx + ds * 1.65, tqY + 2.05, tqZ + 0.65, ds * 0.55);
  }
  // 2-Tier Red Terracotta Curved Roofs over Central Tam Quan Bay (true wide-ridge hip roof so tqFinial seats with 0.0m air gap!)
  const tqRoofLo = createVietnameseCurvedRoofGeometry(8.6, 3.8, 5.2, 1.8, 1.75, 0.34);
  tqRoofLo.translate(cx, tqY + 6.62, tqZ);
  addBox(whiteParts, 4.8, 1.15, 1.55, cx, tqY + 8.65, tqZ);
  const tqRoofHi = createHueImperialHipRoofGeometry(6.4, 3.0, 3.6, 0.45, 1.55, 0.32);
  tqRoofHi.translate(cx, tqY + 9.18, tqZ);
  roofParts.push(tqRoofLo, tqRoofHi);
  // White *Lưỡng Long Chầu Nguyệt* rooftop ridge ornament crowning Tam Quan!
  const tqFinial = createRoofFinialSetParts(cx, tqY + 10.70, tqZ, 3.6, 0, 0.62, true);
  whiteParts.push(...tqFinial.mainParts, ...tqFinial.goldParts);

  // Flanking Pure-White Arched Side Bays upgraded to 2-Tier Red Terracotta Curved Roofs + White Ridge Ornaments (NO red wooden plaque — ref 104!)
  for (const sx of [-1, 1]) {
    const sbx = cx + sx * 5.3;
    const sideBay = createArchedWallGeometry(4.0, 4.7, 1.5, 2.2, 3.6);
    sideBay.translate(sbx, tqY, tqZ);
    whiteParts.push(sideBay);
    addBox(whiteParts, 4.45, 0.34, 1.85, sbx, tqY + 4.75, tqZ);
    addBox(woodParts, 1.95, 3.15, 0.16, sbx, tqY + 1.58, tqZ + 0.12);
    // Lower tier red terracotta roof
    const sideRoofLo = createVietnameseCurvedRoofGeometry(5.2, 2.8, 3.2, 1.3, 1.25, 0.28);
    sideRoofLo.translate(sbx, tqY + 4.92, tqZ);
    // White clerestory drum between lower and upper side roofs
    addBox(whiteParts, 3.0, 0.86, 1.25, sbx, tqY + 6.45, tqZ);
    // Upper tier red terracotta roof (wide-ridge hip roof so sideFinial seats with 0.0m air gap!)
    const sideRoofHi = createHueImperialHipRoofGeometry(4.2, 2.3, 2.4, 0.36, 1.15, 0.26);
    sideRoofHi.translate(sbx, tqY + 6.84, tqZ);
    roofParts.push(sideRoofLo, sideRoofHi);
    const sideFinial = createRoofFinialSetParts(sbx, tqY + 7.97, tqZ, 2.4, 0, 0.44, true);
    whiteParts.push(...sideFinial.mainParts, ...sideFinial.goldParts);
  }

  // Coastal Casuarina (*Phi Lao*) Grove lining Côn Đảo's bay shoreline (ref 37_con_dao_vinh_con_son.jpg)
  const randPhiLao = mulberry32(37104);
  for (let p = 0; p < 24; p++) {
    const tFrac = p / 23;
    const px = THREE.MathUtils.lerp(292.0, 378.0, tFrac) + (randPhiLao() - 0.5) * 4.5;
    const pz = 468.0 + Math.sin(tFrac * Math.PI) * 8.0 + (randPhiLao() - 0.5) * 5.0;
    if (Math.abs(px - pierX) < 12.0) continue;
    const py = ctx.getHeight(px, pz);
    if (py < 0.25) continue;
    const ph = 10.5 + randPhiLao() * 5.0;
    addCyl(woodParts, 0.12, 0.22, ph * 0.72, 6, px, py + ph * 0.36, pz);
    for (let cTier = 0; cTier < 3; cTier++) {
      const cr = (2.1 - cTier * 0.42) * (0.9 + randPhiLao() * 0.2);
      const ch = 3.2 - cTier * 0.4;
      const cone = new THREE.ConeGeometry(cr, ch, 7);
      cone.translate(px, py + ph * 0.52 + cTier * 1.9, pz);
      leafParts.push(colorizeGeometry(cone, cTier % 2 === 0 ? '#4a6b42' : '#3d5c37'));
    }
  }

  const cdUrn = createBronzeIncenseTripodParts(cx, memY + 1.5, cz - 7.5, 0.95);
  stoneParts.push(...cdUrn.limestoneParts);
  bronzeParts.push(...cdUrn.bronzeParts);
  goldParts.push(...cdUrn.goldParts);
  const cdSmoke = createIncenseSmokeSystem(
    [{ x: cx, y: cdUrn.smokeY, z: cz - 7.5, scale: 0.85 }],
    ctx.sharedShaders?.incenseSmoke
  );
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(cdSmoke.mesh.material as THREE.Material);
    ctx.animatedUniforms?.push(cdSmoke.uniforms);
  }
  group.add(cdSmoke.mesh);

  // FIX CD-04: Solemn Hàng Dương Martyrs' Cemetery — 96 orderly instanced granite tombs & headstones
  // arranged in 6 neat rows flanking the central paved avenue (ref 104_nghia_trang_hang_duong.jpg)!
  addBox(stoneParts, 5.6, 0.22, 22.0, cx, memY + 0.10, cz - 14.0);
  const tombBaseGeo = new THREE.BoxGeometry(1.18, 0.36, 1.92);
  tombBaseGeo.translate(0, 0.18, 0);
  const tombSteleGeo = new THREE.BoxGeometry(0.76, 0.68, 0.14);
  tombSteleGeo.translate(0, 0.62, -0.78);
  const tombUnitGeo = mergeNormalized([tombBaseGeo, tombSteleGeo]);
  const tombInst = new THREE.InstancedMesh(tombUnitGeo, ctx.materials.granite, 96);
  tombInst.name = 'ConDaoHangDuongTombs';
  tombInst.receiveShadow = true;
  const tombDummy = new THREE.Matrix4();
  let tIdx = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        const gx = cx + side * (11.8 + col * 2.35);
        const gz = cz - 11.5 + row * 3.45;
        const gy = ctx.getHeight(gx, gz);
        tombDummy.makeTranslation(gx, gy, gz);
        tombInst.setMatrixAt(tIdx++, tombDummy);
        if (row < 3 && col < 3) {
          candleGlowParts.push(new THREE.SphereGeometry(0.10, 5, 4).translate(gx, gy + 0.48, gz));
        }
      }
    }
  }
  tombInst.count = tIdx;
  tombInst.instanceMatrix.needsUpdate = true;
  group.add(tombInst);

  // Sacred Heroine Võ Thị Sáu Memorial Shrine Table along Hàng Dương Central Avenue (white *hoa lê ki ma* blossom branch, conical nón lá, stone censer & vigil candles)
  const vtsX = cx - 4.8;
  const vtsZ = cz - 9.2;
  const vtsY = ctx.getHeight(vtsX, vtsZ);
  addBox(graniteParts, 1.85, 0.45, 2.65, vtsX, vtsY + 0.22, vtsZ);
  addBox(whiteParts, 1.15, 1.35, 0.24, vtsX, vtsY + 1.05, vtsZ - 1.05);
  addBox(stoneParts, 1.25, 0.65, 0.75, vtsX, vtsY + 0.32, vtsZ + 1.85);
  addCyl(bronzeParts, 0.18, 0.15, 0.24, 8, vtsX, vtsY + 0.76, vtsZ + 1.85);
  goldParts.push(new THREE.ConeGeometry(0.28, 0.18, 8).translate(vtsX - 0.38, vtsY + 0.74, vtsZ + 1.85));
  for (let lk = 0; lk < 4; lk++) {
    whiteParts.push(new THREE.SphereGeometry(0.09, 5, 4).translate(vtsX + 0.32 + lk * 0.08, vtsY + 0.72, vtsZ + 1.82));
  }
  // [187][193][194][195][197][198] White Hoa Lê Ki Ma Blossom Tree at Võ Thị Sáu Shrine, Waterfront Promenade, Secondary Fishing Pier & Benches
  candleGlowParts.push(
    new THREE.SphereGeometry(0.11, 5, 4).translate(vtsX - 0.45, vtsY + 0.75, vtsZ + 2.08),
    new THREE.SphereGeometry(0.11, 5, 4).translate(vtsX + 0.45, vtsY + 0.75, vtsZ + 2.08)
  );
  addCyl(woodParts, 0.12, 0.16, 2.8, 6, vtsX - 1.8, vtsY + 1.4, vtsZ);
  const lkCrown = createSculptedRockGeometry(91488, 1.45, 0.95, 1.45, 1);
  lkCrown.translate(vtsX - 1.8, vtsY + 3.1, vtsZ);
  leafParts.push(colorizeGeometry(lkCrown, '#e9ebe6'));
  // Secondary timber fishing pier & 2 blue-hulled Côn Đảo wooden boats in eastern cove (358, 444)
  addBox(woodParts, 3.6, 0.22, 16.0, 358.0, 1.45, 448.0);
  for (let pz = 442; pz <= 454; pz += 4) {
    for (const sx of [-1.5, 1.5]) {
      addCyl(woodParts, 0.12, 0.15, 4.2, 6, 358.0 + sx, -0.4, pz);
    }
  }
  // Coastal stone promenade balustrade & benches under Cây Bàng Cổ Thụ
  addBox(stoneParts, 34.0, 0.65, 0.35, 354.0, 1.65, 468.0);
  for (const bxS of [321.0, 352.0]) {
    const byS = ctx.getHeight(bxS, 474.0);
    addBox(woodParts, 1.85, 0.44, 0.55, bxS, byS + 0.22, 476.5);
  }
  // Wooden directional signpost at Cầu Tàu 914 landward plaza
  addCyl(woodParts, 0.06, 0.08, 2.1, 6, pierX + 7.5, porticoDeckY + 1.05, 462.5);
  addBox(woodParts, 1.15, 0.28, 0.08, pierX + 7.9, porticoDeckY + 1.85, 462.5, 0.2);

  const randCd = mulberry32(91418);
  // 4. Historic Ancient Côn Đảo *Cây Bàng Cổ Thụ* (Heritage Coastal Tropical Almond Trees) with gnarled spreading boughs
  //    & warm russet/emerald seasonal foliage shading Cầu Tàu 914 & Hàng Dương avenue + Côn Đảo Headland White Lighthouse!
  const heritageBangCoords: Array<[number, number, number]> = [
    [321, 474, 0.85],
    [352, 476, 0.88],
    [354, 516, 0.86]
  ];
  for (let b = 0; b < heritageBangCoords.length; b++) {
    const [bx, bz, bs] = heritageBangCoords[b];
    const by = ctx.getHeight(bx, bz);
    const bang = createRealisticAncientBanyanParts(bx, by, bz, bs, 91450 + b * 73, {
      boughCount: 4,
      propRootCount: 2,
      danglingRootCount: 0,
      canopyDensity: 0.7,
      getHeight: ctx.getHeight
    });
    woodParts.push(...bang.barkParts);
    leafParts.push(...bang.canopyParts);
  }
  for (let t = 0; t < 10; t++) {
    const ta = (t / 10) * Math.PI * 2 + 0.35;
    const tr = 28.0 + randCd() * 14.0;
    const tx = cx + Math.cos(ta) * tr;
    const tz = cz + Math.sin(ta) * tr;
    if (Math.abs(tx - pierX) < 10.0 && tz < 476.0) continue;
    const ty = ctx.getHeight(tx, tz);
    addCyl(woodParts, 0.36, 0.58, 7.2, 8, tx, ty + 3.4, tz);
    for (let tier = 0; tier < 3; tier++) {
      const cPad = createSculptedRockGeometry(9200 + t * 17 + tier, 3.8 - tier * 0.7, 0.85, 3.8 - tier * 0.7, 1);
      cPad.translate(tx, ty + 6.4 + tier * 1.45, tz);
      leafParts.push(colorizeGeometry(cPad, tier === 2 && t % 3 === 0 ? '#a85124' : tier % 2 === 0 ? '#2e6b2d' : '#3a7d34'));
    }
  }

  // Iconic Hòn Bảy Cạnh / Côn Đảo White Colonial Lighthouse perched on Eastern Granite Headland (374, 484)
  // Complete with black iron gallery railing, vertical arched tower windows, brass Fresnel lens ribs & weathered courtyard wall!
  const cdLhX = 374.0;
  const cdLhZ = 484.0;
  const cdLhY = ctx.getHeight(cdLhX, cdLhZ) + 2.8;
  addBox(stoneParts, 5.2, 2.2, 5.2, cdLhX, cdLhY + 0.9, cdLhZ);
  addBox(stoneParts, 8.8, 1.4, 0.55, cdLhX - 2.0, cdLhY + 0.7, cdLhZ - 2.4);
  // Retaining stone foundation under keeper's cottage extending down into coastal boulder slope
  addBox(stoneParts, 5.0, 3.6, 4.2, cdLhX - 3.6, cdLhY - 1.5, cdLhZ + 1.2);
  addBox(ochreParts, 4.6, 2.8, 3.8, cdLhX - 3.6, cdLhY + 1.6, cdLhZ + 1.2);
  const lhKeeperRoof = createHippedRoofGeometry(5.2, 4.4, 2.6, 0.4, 1.35);
  lhKeeperRoof.translate(cdLhX - 3.6, cdLhY + 3.0, cdLhZ + 1.2);
  roofParts.push(lhKeeperRoof);
  addCyl(whiteParts, 1.15, 1.55, 11.8, 12, cdLhX, cdLhY + 7.8, cdLhZ);
  addCyl(whiteParts, 1.65, 1.45, 0.42, 12, cdLhX, cdLhY + 13.8, cdLhZ);
  // 3 vertical arched window recesses along white lighthouse tower shaft
  for (let w = 0; w < 3; w++) {
    addBox(voidParts, 0.42, 0.95, 0.24, cdLhX, cdLhY + 4.2 + w * 3.2, cdLhZ - 1.32);
  }
  // Black iron gallery railing encircling the lighthouse watch deck
  const cdRailRing = new THREE.TorusGeometry(1.56, 0.045, 5, 14);
  cdRailRing.rotateX(Math.PI * 0.5);
  cdRailRing.translate(cdLhX, cdLhY + 14.85, cdLhZ);
  ironLampParts.push(cdRailRing);
  for (let p = 0; p < 8; p++) {
    const pa = (p / 8) * Math.PI * 2;
    addCyl(ironLampParts, 0.03, 0.035, 0.92, 5, cdLhX + Math.cos(pa) * 1.54, cdLhY + 14.42, cdLhZ + Math.sin(pa) * 1.54);
  }
  candleGlowParts.push(new THREE.CylinderGeometry(0.76, 0.76, 1.35, 10).translate(cdLhX, cdLhY + 14.7, cdLhZ));
  for (let fr = 0; fr < 4; fr++) {
    addCyl(goldParts, 0.025, 0.025, 1.38, 4, cdLhX + Math.cos((fr / 4) * Math.PI * 2) * 0.80, cdLhY + 14.7, cdLhZ + Math.sin((fr / 4) * Math.PI * 2) * 0.80);
  }
  const lhDome = new THREE.ConeGeometry(1.12, 1.25, 10);
  lhDome.translate(cdLhX, cdLhY + 16.0, cdLhZ);
  roofParts.push(lhDome);
  // Lush verdant granite island hill backdrop behind Côn Đảo cove
  for (const [hx, hz, hr] of [[304, 536, 9.5], [338, 544, 10.5], [368, 530, 9.2]]) {
    const hy = ctx.getHeight(hx, hz);
    const hillBush = createSculptedRockGeometry(9400 + Math.round(hx), hr, hr * 0.52, hr * 0.88, 1);
    hillBush.translate(hx, hy + hr * 0.28, hz);
    leafParts.push(colorizeGeometry(hillBush, '#265c29'));
  }

  const ironMat = new THREE.MeshStandardMaterial({ color: '#2b2f35', metalness: 0.72, roughness: 0.42 });
  const bangLeafMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8
  });
  ctx.extraMaterials.push(ironMat, bangLeafMat);

  // P1 Côn Đảo Colonial Louver Shutters (`HV-H05`) mounted flush on Prison east wall & Hàng Dương Stone Lanterns (`HV-NEW-MB-12`)
  const cdBaseY = ctx.getHeight(cx, cz);
  woodParts.push(
    ...createLouverShutterParts(prisX + 10.42, prisY + 4.8, prisZ - 3.5, 0.72, 2.2, Math.PI * 0.5, 7),
    ...createLouverShutterParts(prisX + 10.42, prisY + 4.8, prisZ + 3.5, 0.72, 2.2, Math.PI * 0.5, 7)
  );
  graniteParts.push(
    ...createAncientStoneLanternParts(cx - 6.2, cdBaseY + 0.3, cz + 8.5, 0.95),
    ...createAncientStoneLanternParts(cx + 6.2, cdBaseY + 0.3, cz + 8.5, 0.95)
  );
  // ==========================================================================
  // WAVE 2 REAL-WORLD VISUAL QC UPGRADES (381–400) — Low-Poly, castShadow=false
  // ==========================================================================
  const cdW2Granite: THREE.BufferGeometry[] = [];
  const cdW2Ochre: THREE.BufferGeometry[] = [];
  const cdW2White: THREE.BufferGeometry[] = [];
  const cdW2Roof: THREE.BufferGeometry[] = [];
  const cdW2Stone: THREE.BufferGeometry[] = [];
  const cdW2Iron: THREE.BufferGeometry[] = [];
  const cdW2Glow: THREE.BufferGeometry[] = [];
  const cdW2Bronze: THREE.BufferGeometry[] = [];
  const cdW2Gold: THREE.BufferGeometry[] = [];
  const cdW2Wood: THREE.BufferGeometry[] = [];
  const cdW2Leaf: THREE.BufferGeometry[] = [];

  // [381] Cầu Tàu 914 Memorial Bronze Relief Wall & Granite Offering Altar
  addBox(cdW2Granite, 3.6, 1.85, 0.36, pierX - 4.4, porticoDeckY + 0.92, 463.2);
  addBox(cdW2Bronze, 2.8, 1.15, 0.10, pierX - 4.4, porticoDeckY + 1.05, 462.98);
  addBox(cdW2Granite, 1.6, 0.78, 0.72, pierX - 4.4, porticoDeckY + 0.39, 459.4);
  // [382] Bến Đầm / Côn Sơn Coastal Breakwater Red-and-White Beacon Lighthouse on western granite shoal (290, 458)
  const bdX = 290.0;
  const bdZ = 458.0;
  addCyl(cdW2Stone, 2.4, 3.0, 2.2, 6, bdX, 0.8, bdZ);
  addCyl(cdW2White, 0.68, 0.88, 3.2, 6, bdX, 3.5, bdZ);
  addCyl(cdW2Roof, 0.58, 0.68, 3.0, 6, bdX, 6.6, bdZ);
  addCyl(cdW2White, 0.52, 0.58, 2.4, 6, bdX, 9.3, bdZ);
  cdW2Glow.push(new THREE.CylinderGeometry(0.38, 0.38, 0.85, 6).translate(bdX, 10.95, bdZ));
  // [383] Côn Đảo Prison (Trại Giam Phú Hải) Iconic Yellow-Ochre Arched Main Entrance Archway
  const paX = prisX;
  const paZ = prisZ - 16.5;
  const paWall = createArchedWallGeometry(9.6, 5.8, 1.4, 3.8, 4.4);
  paWall.translate(paX, prisY, paZ);
  cdW2Ochre.push(paWall);
  addBox(cdW2White, 10.2, 0.38, 1.75, paX, prisY + 5.9, paZ);
  addBox(cdW2Roof, 10.6, 0.32, 2.0, paX, prisY + 6.22, paZ);
  for (let b = -3; b <= 3; b++) {
    addCyl(cdW2Iron, 0.025, 0.025, 3.8, 4, paX + b * 0.52, prisY + 1.9, paZ);
  }
  // [384][385] Côn Đảo Prison Chuồng Cọp overhead guard catwalk & yard sentry box + iron bell post
  addBox(cdW2Stone, 1.35, 0.14, 9.2, prisX - 1.5, prisY + 2.62, prisZ + 7.8);
  addBox(cdW2Iron, 0.06, 0.85, 9.2, prisX - 2.15, prisY + 3.05, prisZ + 7.8);
  addBox(cdW2Iron, 0.06, 0.85, 9.2, prisX - 0.85, prisY + 3.05, prisZ + 7.8);
  addBox(cdW2Wood, 1.4, 2.4, 1.4, prisX + 3.8, prisY + 1.2, paZ + 2.2);
  addCyl(cdW2Iron, 0.05, 0.06, 2.4, 5, prisX - 3.8, prisY + 1.2, paZ + 2.2);
  addCyl(cdW2Bronze, 0.16, 0.24, 0.36, 6, prisX - 3.8, prisY + 2.1, paZ + 2.2);
  // [386][387] Hòn Bảy Cạnh Lighthouse cliffside carved granite steps, solar-panel array & rainwater cistern
  for (let st = 0; st < 6; st++) {
    addBox(cdW2Granite, 2.2, 0.35, 0.72, cdLhX - 6.8 + st * 0.72, cdLhY - 2.2 + st * 0.42, cdLhZ - 4.2 + st * 0.35);
  }
  addBox(cdW2Iron, 2.2, 0.08, 1.4, cdLhX + 3.4, cdLhY + 1.15, cdLhZ + 2.2, 0, 0.35, 0);
  addCyl(cdW2Stone, 0.95, 0.95, 1.35, 6, cdLhX - 6.4, cdLhY + 0.68, cdLhZ + 1.2);
  // [388][389] Cầu Tàu 914 portico museum display boards/benches & boat timber gangways + net racks
  for (const sx of [-2.4, 2.4]) {
    addBox(cdW2Wood, 0.14, 1.45, 1.8, pierX + sx, porticoDeckY + 1.6, portZ);
    addBox(cdW2Wood, 1.6, 0.46, 0.52, pierX + sx * 1.4, porticoDeckY + 0.24, portZ - 1.2);
  }
  addBox(cdW2Wood, 4.4, 0.12, 0.65, pierX - 5.2, pierDeckY - 0.15, 438.0, 0, 0, -0.22);
  addBox(cdW2Wood, 4.4, 0.12, 0.65, pierX + 5.6, pierDeckY - 0.15, 444.0, 0, 0, 0.22);
  // [390] Secondary Eastern Cove Fishing Pier 2 blue-hulled Côn Đảo wooden fishing boats (358, 444)
  for (const [bx, bz, byaw] of [[353.5, 444.0, 0.18], [362.5, 448.0, -0.15]]) {
    addColoredBox(cdW2Leaf, '#1e5b96', 2.2, 0.92, 7.6, bx, 0.46, bz, byaw);
    addBox(cdW2Wood, 1.45, 1.05, 2.4, bx, 1.42, bz - 0.3, byaw);
    addBox(cdW2White, 1.62, 0.14, 2.6, bx, 2.0, bz - 0.3, byaw);
  }
  // [391] Colonial Yellow-Ochre Waterfront Customs House east of Cầu Tàu 914 arcade
  const chX = pierX + 24.5;
  const chZ = portZ + 2.0;
  const chY = ctx.getHeight(chX, chZ);
  addBox(cdW2Ochre, 8.6, 5.2, 6.2, chX, chY + 2.6, chZ);
  const chRoof = createHippedRoofGeometry(9.6, 7.2, 5.6, 0.5, 1.95);
  chRoof.translate(chX, chY + 5.2, chZ);
  cdW2Roof.push(chRoof);
  for (const wx of [-2.4, 2.4]) {
    addColoredBox(cdW2Leaf, '#2b6646', 1.2, 2.0, 0.16, chX + wx, chY + 2.4, chZ - 3.16);
  }
  // [392] Hàng Dương Cemetery Tam Quan wrought-iron perimeter gate grilles & stone wall wings
  for (const side of [-1, 1]) {
    addBox(cdW2Stone, 12.0, 1.25, 0.48, cx + side * 13.4, tqY + 0.62, tqZ);
    for (let g = 0; g < 6; g++) {
      addCyl(cdW2Iron, 0.025, 0.025, 1.4, 4, cx + side * (8.4 + g * 1.9), tqY + 1.85, tqZ);
    }
  }
  // [393] Hàng Dương Obelisk 4-corner carved granite flower urns & bronze wreath stands
  for (const sx of [-3.4, 3.4]) {
    for (const sz of [-3.4, 3.4]) {
      addCyl(cdW2Granite, 0.38, 0.28, 0.72, 6, cx + sx, memY + 1.85, cz + sz);
    }
  }
  addCyl(cdW2Bronze, 0.42, 0.42, 0.10, 6, cx - 2.6, memY + 1.95, cz - 4.2, 0, Math.PI * 0.5, 0);
  // [394] Đền Thờ Côn Đảo interior lacquered altar, incense tripod & golden Hoành Phi plaque
  addBox(cdW2Wood, 3.2, 1.05, 1.1, dtX, dtY + 1.28, dtZ + 1.2);
  addCyl(cdW2Bronze, 0.26, 0.22, 0.36, 6, dtX, dtY + 1.95, dtZ + 1.0);
  addBox(cdW2Gold, 2.6, 0.58, 0.10, dtX, dtY + 3.45, dtZ + 1.1);
  // [395] Heroine Võ Thị Sáu Shrine white marble offering bench & additional vigil candle racks
  addBox(cdW2White, 1.8, 0.45, 0.52, vtsX + 1.8, vtsY + 0.24, vtsZ + 0.6);
  addBox(cdW2Iron, 1.2, 0.72, 0.32, vtsX - 1.2, vtsY + 0.36, vtsZ + 1.85);
  cdW2Glow.push(
    new THREE.BoxGeometry(0.10, 0.10, 0.10).translate(vtsX - 1.4, vtsY + 0.78, vtsZ + 1.85),
    new THREE.BoxGeometry(0.10, 0.10, 0.10).translate(vtsX - 1.0, vtsY + 0.78, vtsZ + 1.85)
  );
  // [396] Ancient Cây Bàng Cổ Thụ circular granite tree-wells
  for (const [bx, bz] of heritageBangCoords) {
    const by = ctx.getHeight(bx, bz);
    addCyl(cdW2Granite, 1.65, 1.75, 0.48, 8, bx, by + 0.24, bz);
  }
  // [397] Hàng Dương Cemetery granite rest benches & incense-lighting tables along tomb rows
  for (const side of [-1, 1]) {
    addBox(cdW2Granite, 0.55, 0.45, 2.0, cx + side * 8.2, memY + 0.24, cz - 8.0);
    addBox(cdW2Granite, 1.2, 0.78, 0.65, cx + side * 8.2, memY + 0.40, cz - 3.5);
  }
  // [398] Colonial 2-Story Prison Wing shuttered roof dormer vents & iron rainwater downspouts
  for (const dz of [-8.0, 0.0, 8.0]) {
    addBox(cdW2White, 1.2, 1.05, 1.4, prisX + 6.2, prisY + 7.65, prisZ + dz);
    addCyl(cdW2Iron, 0.05, 0.05, 6.8, 5, prisX + 5.15, prisY + 3.4, prisZ + dz);
  }
  // [399][400] Western bay curve Phi Lao windbreak + stone seawall coping & Hàng Dương marigold/chrysanthemum urns
  addBox(cdW2Stone, 18.0, 0.55, 0.48, 298.0, 1.45, 467.5);
  for (const px of [289.0, 294.0, 300.0]) {
    const py = ctx.getHeight(px, 470.5);
    addCyl(cdW2Wood, 0.12, 0.18, 6.5, 5, px, py + 3.2, 470.5);
    addColoredCone(cdW2Leaf, '#3d5c37', 1.8, 3.6, 5, px, py + 6.8, 470.5);
  }
  for (const lz of [cz - 15.0, cz - 9.0, cz - 3.0]) {
    for (const sx of [-2.4, 2.4]) {
      addCyl(cdW2Roof, 0.24, 0.18, 0.38, 6, cx + sx, memY + 0.22, lz);
      addColoredCone(cdW2Leaf, lz % 2 === 0 ? '#f0c428' : '#f4f4ee', 0.26, 0.32, 5, cx + sx, memY + 0.52, lz);
    }
  }

  group.add(
    makeMergedMesh('ConDaoGraniteArchesAndObelisk', graniteParts, ctx.materials.granite),
    makeMergedMesh('ConDaoColonialPortico', ochreParts, colonialStoneMat),
    makeMergedMesh('ConDaoTamQuanPureWhite', whiteParts, ctx.materials.whitePlaster),
    makeMergedMesh('ConDaoPorticoRoof', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('ConDaoHistoricStonePier', stoneParts, ctx.materials.stone),
    makeMergedMesh('ConDaoWindowVoids', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('ConDaoPierBollardsAndLamps', ironLampParts, ironMat),
    makeMergedMesh('ConDaoVigilCandlesAndGlobes', candleGlowParts, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false),
    makeMergedMesh('ConDaoMemorialBronzes', bronzeParts, ctx.materials.bronze),
    makeMergedMesh('ConDaoMemorialGold', goldParts, ctx.materials.gold),
    makeMergedMesh('ConDaoBoatsAndTrunks', woodParts, ctx.materials.darkWood),
    makeMergedMesh('ConDaoAncientSeaAlmonds', leafParts, bangLeafMat),
    // Wave 2 merged meshes (castShadow = false, zero new materials!)
    makeMergedMesh('ConDaoWave2Granite', cdW2Granite, ctx.materials.granite, false, true),
    makeMergedMesh('ConDaoWave2Ochre', cdW2Ochre, colonialStoneMat, false, true),
    makeMergedMesh('ConDaoWave2White', cdW2White, ctx.materials.whitePlaster, false, true),
    makeMergedMesh('ConDaoWave2Roof', cdW2Roof, ctx.materials.terracottaRoof, false, true),
    makeMergedMesh('ConDaoWave2Stone', cdW2Stone, ctx.materials.stone, false, true),
    makeMergedMesh('ConDaoWave2Iron', cdW2Iron, ironMat, false, true),
    makeMergedMesh('ConDaoWave2Glow', cdW2Glow, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false),
    makeMergedMesh('ConDaoWave2Bronze', cdW2Bronze, ctx.materials.bronze, false, true),
    makeMergedMesh('ConDaoWave2Gold', cdW2Gold, ctx.materials.gold, false, false),
    makeMergedMesh('ConDaoWave2Wood', cdW2Wood, ctx.materials.darkWood, false, true),
    makeMergedMesh('ConDaoWave2Leaf', cdW2Leaf, bangLeafMat, false, false)
  );
  tagMotifIds(group, [
    'HV-H04', 'HV-H05', 'HV-I04', 'HV-NEW-MB-12', 'HV-NEW-MN-12'
  ]);

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 48.0 });
}

// ============================================================================
// Master Entry Point: All 10 Southern Vietnam & Islands Landmarks
// ============================================================================
export function buildVietnamSouthLandmarks(
  ctx: VietnamBuilderContext
): { southernBoats: JunkBoatMotion[] } {
  buildBenThanhMarketComplex(ctx);
  buildIndependencePalace(ctx);
  buildNotreDameSaigon(ctx);
  buildCuChiTunnels(ctx);
  buildPoNagarNhaTrang(ctx);
  const southernBoats = buildCaiRangFloatingMarketComplex(ctx);
  southernBoats.push(...buildTraSuMelaleucaForest(ctx));
  buildMuiCaMau(ctx);
  buildPhuQuocIsland(ctx);
  buildConDaoIsland(ctx);

  return { southernBoats };
}
