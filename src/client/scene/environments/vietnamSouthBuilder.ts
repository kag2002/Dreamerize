import * as THREE from 'three';
import {
  VietnamBuilderContext,
  JunkBoatMotion,
  applyWorldBoxUV,
  createArchedWallGeometry,
  createBoatSaddleRoofGeometry,
  createChamTowerGeometry,
  createGothicSpireGeometry,
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
  createRealisticAncientBanyanParts
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
function buildBenThanhMarket(ctx: VietnamBuilderContext): void {
  const cx = -108;
  const cz = 190;
  const yBase = ctx.getHeight(cx, cz);

  const group = new THREE.Group();
  group.name = 'BenThanhMarketComplex';
  group.position.set(cx, yBase, cz);

  const ochreParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const trimParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const stallParts: THREE.BufferGeometry[] = [];
  const lampCoreParts: THREE.BufferGeometry[] = [];
  const ironParts: THREE.BufferGeometry[] = [];

  // FIX DL-04: Authentic matte warm-ivory/concrete modernist plaster (#dfd9cc, roughness 0.74 — NOT glossy 0.34 marble!)
  const whiteMat = new THREE.MeshStandardMaterial({
    color: '#dfd9cc',
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.74,
    metalness: 0.02
  });
  ctx.extraMaterials.push(whiteMat);

  // Expanded grounded stone/cream stepped plinth (102m × 70m) & hall base (98m × 66m)
  addBox(trimParts, 102.0, 1.0, 70.0, 0, -0.1, 0);
  addBox(ochreParts, 98.8, 0.5, 66.8, 0, 0.55, 0);

  // 4 Quadrant Interior Hall Blocks leaving OPEN pass-through N-S (x in [-13..13]) & E-W (z in [-11..11]) cross-aisles!
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // Each quadrant spans x in [13.5..46.5] (33m wide) × z in [11.5..30.5] (19m deep)
      addBox(ochreParts, 33.0, 9.8, 19.0, sx * 30.0, 5.7, sz * 21.0);
    }
  }
  // Open Vaulted Interior Concrete Arch Ribs + Continuous Roof Skylight Slot (ref 93_cho_ben_thanh_ben_trong.jpg)
  for (const side of [-1, 1]) {
    // Side ceiling haunches framing the continuous open skylight slot down both concourses
    addBox(ochreParts, 9.2, 0.38, 64.0, side * 9.0, 10.35, 0);
    addBox(ochreParts, 96.0, 0.38, 7.6, 0, 10.35, side * 7.6);
    // Skylight louver coaming rails flanking central daylight slot
    addBox(trimParts, 0.32, 0.65, 62.0, side * 4.3, 10.75, 0);
    addBox(trimParts, 94.0, 0.65, 0.32, 0, 10.75, side * 3.7);
  }
  // FIX BT-05: Authentic Pitched Triangular Steel-Frame Roof Trusses (replacing curved Torus arches — ref 93_cho_ben_thanh_ben_trong.jpg!)
  for (let tz = -26; tz <= 26; tz += 6.5) {
    // 2 sloped pitched iron rafters + central king-post + 2 diagonal web struts spanning the N-S concourse
    addBox(ironParts, 13.4, 0.24, 0.22, -6.2, 9.15, tz, 0, 0, 0.25);
    addBox(ironParts, 13.4, 0.24, 0.22, 6.2, 9.15, tz, 0, 0, -0.25);
    addBox(ironParts, 0.18, 3.15, 0.18, 0, 9.10, tz);
    addBox(ironParts, 4.6, 0.14, 0.14, -3.4, 8.35, tz, 0, 0, -0.40);
    addBox(ironParts, 4.6, 0.14, 0.14, 3.4, 8.35, tz, 0, 0, 0.40);
    // Bright skylight louver slats across the central daylight slot
    addColoredBox(stallParts, '#f5f0dc', 8.2, 0.08, 0.42, 0, 11.08, tz);
  }
  for (const tx of [-42, -34, -26, -18, 18, 26, 34, 42]) {
    addBox(ironParts, 0.22, 0.24, 11.4, tx, 9.10, -5.2, 0, 0.26, 0);
    addBox(ironParts, 0.22, 0.24, 11.4, tx, 9.10, 5.2, 0, -0.26, 0);
    addBox(ironParts, 0.18, 3.05, 0.18, tx, 9.05, 0);
    addColoredBox(stallParts, '#f5f0dc', 0.42, 0.08, 7.0, tx, 11.08, 0);
  }

  // Warm beige 0.5m ceramic tile concourse floor along both N-S and E-W interior aisles
  addColoredBox(stallParts, '#d8c7a6', 26.8, 0.06, 65.0, 0, 0.83, 0);
  addColoredBox(stallParts, '#d8c7a6', 96.4, 0.06, 22.4, 0, 0.83, 0);
  for (let zi = -15; zi <= 15; zi++) {
    for (let xi = -4; xi <= 4; xi++) {
      if ((xi + zi) % 2 === 0) continue;
      addColoredBox(stallParts, '#ccb894', 2.4, 0.065, 2.0, xi * 2.4, 0.832, zi * 2.0);
    }
  }
  for (let xi = -20; xi <= 20; xi++) {
    if (Math.abs(xi) <= 4) continue;
    for (let zi = -3; zi <= 3; zi++) {
      if ((xi + zi) % 2 === 0) continue;
      addColoredBox(stallParts, '#ccb894', 2.2, 0.065, 2.4, xi * 2.2, 0.832, zi * 2.4);
    }
  }

  // Slender colonial tie-rods & glowing overhead pendant market lamps under curved concrete arch ribs
  for (let tz = -26; tz <= 26; tz += 6.5) {
    addBox(ironParts, 25.8, 0.14, 0.14, 0, 7.45, tz);
    for (const lx of [-7.5, 0.0, 7.5]) {
      addCyl(ironParts, 0.03, 0.03, 1.35, 6, lx, 8.15, tz);
      lampCoreParts.push(new THREE.SphereGeometry(0.22, 8, 7).translate(lx, 7.38, tz));
    }
  }
  for (const tx of [-42, -34, -26, -18, 18, 26, 34, 42]) {
    addBox(ironParts, 0.14, 0.14, 21.8, tx, 7.45, 0);
    for (const lz of [-5.5, 5.5]) {
      addCyl(ironParts, 0.03, 0.03, 1.35, 6, tx, 8.15, lz);
      lampCoreParts.push(new THREE.SphereGeometry(0.20, 8, 7).translate(tx, 7.38, lz));
    }
  }

  // Helper to build 1 of 4 richly detailed Bến Thành merchant stall archetypes
  const awningPalette = ['#c82822', '#1d7a52', '#e09a1e', '#2663a8', '#b8326a', '#c95c1e'];
  const buildMerchantStall = (sx: number, sz: number, yaw: number, idx: number): void => {
    const localParts: THREE.BufferGeometry[] = [];
    const awningCol = awningPalette[idx % awningPalette.length];
    const signCol = awningPalette[(idx + 2) % awningPalette.length];

    // Wooden merchant counter, tiled countertop, posts, sloped awning & colorful signboard
    addColoredBox(localParts, '#6b4528', 4.4, 1.05, 2.0, 0, 0.56, 0);
    addColoredBox(localParts, '#e3dac7', 4.55, 0.12, 2.15, 0, 1.14, 0);
    addColoredBox(localParts, awningCol, 4.7, 0.18, 2.45, 0, 3.05, 0.08, 0, 0.16, 0);
    addColoredBox(localParts, signCol, 3.8, 0.52, 0.12, 0, 3.45, 0.95);
    // FIX BT-06: Hanging colorful market banners, bamboo hand-fans & glowing aisle ceiling LED strips inside Chợ Bến Thành (ref 93!)
    addColoredBox(localParts, '#f5e29e', 3.4, 0.24, 0.14, 0, 3.45, 0.96);
    addColoredBox(localParts, awningCol, 0.92, 0.62, 0.05, -1.35, 2.75, 1.04);
    addColoredBox(localParts, signCol, 0.92, 0.62, 0.05, 1.35, 2.75, 1.04);
    lampCoreParts.push(new THREE.BoxGeometry(3.2, 0.08, 0.12).rotateY(yaw).translate(sx, 3.85, sz));
    for (const px of [-2.05, 2.05]) {
      addColoredBox(localParts, '#47301e', 0.12, 2.8, 0.12, px, 1.65, -0.88);
      addColoredBox(localParts, '#47301e', 0.12, 2.8, 0.12, px, 1.65, 0.88);
    }

    const kind = idx % 4;
    if (kind === 0) {
      // Áo Dài textile & hanging silk garment rack stall
      addColoredCylinder(localParts, '#b8b4aa', 0.03, 0.03, 3.8, 6, 0, 2.55, 0.35, 0, 0, Math.PI * 0.5);
      const silkCols = ['#d42648', '#228c68', '#e8b62a', '#356ec4', '#a83494'];
      for (let g = 0; g < 5; g++) {
        const gx = -1.4 + g * 0.7;
        addColoredBox(localParts, silkCols[g], 0.44, 1.08, 0.10, gx, 1.98, 0.35);
      }
      // Stacked folded silk fabric bolts on counter
      for (let b = 0; b < 3; b++) {
        addColoredBox(localParts, silkCols[(b + idx) % silkCols.length], 0.85, 0.34, 0.72, -1.2 + b * 1.2, 1.38, -0.35);
      }
    } else if (kind === 1) {
      // Stacked conical hats (*nón lá*) & woven bamboo handicrafts
      for (let st = 0; st < 3; st++) {
        const hx = -1.25 + st * 1.25;
        for (let c = 0; c < 4; c++) {
          addColoredCone(localParts, c % 2 === 0 ? '#e5cf8e' : '#d6bc76', 0.42, 0.24, 12, hx, 1.34 + c * 0.16, 0.1);
        }
      }
      addColoredCylinder(localParts, '#b6894b', 0.46, 0.36, 0.52, 10, 1.55, 1.44, -0.35);
      addColoredCylinder(localParts, '#9c6e38', 0.42, 0.34, 0.46, 10, -1.55, 1.41, -0.35);
    } else if (kind === 2) {
      // Tropical fruit pyramids (watermelons, pineapples, mangoes, dragon fruit)
      const fruitRows: Array<[number, string, number]> = [
        [-1.35, '#2b7d34', 0.22],
        [-0.45, '#e8a820', 0.18],
        [0.45, '#d9295c', 0.17],
        [1.35, '#f0821d', 0.18]
      ];
      for (const [fx, fcol, rad] of fruitRows) {
        addColoredBox(localParts, '#9a6b38', 0.82, 0.22, 1.15, fx, 1.30, 0.05);
        for (let k = 0; k < 3; k++) {
          addColoredSphere(localParts, fcol, rad, 7, 6, fx + (k - 1) * 0.22, 1.54, 0.22);
          addColoredSphere(localParts, fcol, rad, 7, 6, fx + (k - 1) * 0.22, 1.54, -0.18);
        }
        addColoredSphere(localParts, fcol, rad, 7, 6, fx, 1.78, 0.02);
      }
    } else {
      // Coffee burlap sacks & steaming Phở counter with colorful plastic stools!
      for (let s = 0; s < 3; s++) {
        addColoredCylinder(localParts, '#a88754', 0.36, 0.42, 0.72, 9, -1.55 + s * 0.76, 1.54, -0.25);
        addColoredSphere(localParts, '#4b2d18', 0.32, 7, 5, -1.55 + s * 0.76, 1.88, -0.25, 1, 0.45, 1);
      }
      // Large gleaming stainless steel Phở broth pot + white noodle bowls
      addColoredCylinder(localParts, '#cfd4da', 0.38, 0.36, 0.64, 12, 1.2, 1.52, 0.0);
      addColoredSphere(localParts, '#f5f2ea', 0.16, 7, 5, 0.35, 1.28, 0.35, 1, 0.55, 1);
      addColoredSphere(localParts, '#f5f2ea', 0.16, 7, 5, 0.72, 1.28, 0.45, 1, 0.55, 1);
      // 3 Red & Blue low Vietnamese plastic stools lined in front of the food counter
      for (let st = 0; st < 3; st++) {
        const stoolCol = st % 2 === 0 ? '#d62828' : '#2466b5';
        addColoredCylinder(localParts, stoolCol, 0.22, 0.26, 0.46, 8, -1.1 + st * 1.1, 0.26, 1.65);
      }
    }

    for (const p of localParts) {
      transformGeo(p, sx, 0.84, sz, yaw);
      stallParts.push(p);
    }
  };

  // Place 24 detailed merchant stalls: 12 along N-S aisle + 12 along E-W aisle
  let stallIdx = 0;
  // 12 stalls flanking N-S concourse (6 West, 6 East; split North/South of central crossing)
  const nsZs = [-25.5, -20.0, -14.5, 14.5, 20.0, 25.5];
  for (const sz of nsZs) {
    buildMerchantStall(-9.2, sz, Math.PI * 0.5, stallIdx++);
    buildMerchantStall(9.2, sz, -Math.PI * 0.5, stallIdx++);
  }
  // 12 stalls flanking E-W concourse (6 North, 6 South; split West/East of central crossing)
  const ewXs = [-38.5, -30.5, -22.5, 22.5, 30.5, 38.5];
  for (const sx of ewXs) {
    buildMerchantStall(sx, -7.8, 0, stallIdx++);
    buildMerchantStall(sx, 7.8, Math.PI, stallIdx++);
  }

  // Central crossing welcoming flower & lacquerware island kiosk + Iconic Bến Thành Rotunda Patron Ancestor Shrine (*Miếu Thờ Tổ Nghiệp Giữa Lòng Chợ*)
  // + Suspended Circular Conical-Hat (*Nón Lá*) Chandelier Rings & Warm Interior PointLights (ref 93_cho_ben_thanh_ben_trong.jpg!)
  addColoredBox(stallParts, '#7a3b20', 4.6, 1.05, 4.6, 0, 1.36, 0);
  addColoredBox(stallParts, '#e09a1e', 1.4, 0.52, 1.4, -1.1, 2.12, -1.1);
  addColoredBox(stallParts, '#c82822', 1.4, 0.52, 1.4, 1.1, 2.12, -1.1);
  addColoredBox(stallParts, '#2c8a4b', 1.4, 0.52, 1.4, -1.1, 2.12, 1.1);
  addColoredBox(stallParts, '#d9487a', 1.4, 0.52, 1.4, 1.1, 2.12, 1.1);
  // Central crimson-and-gold patron shrine canopy (*Khám thờ Tổ Nghiệp*) rising at the heart of the cruciform market
  for (const sx of [-0.95, 0.95]) {
    for (const sz of [-0.95, 0.95]) {
      addColoredCylinder(stallParts, '#b81d18', 0.08, 0.10, 2.15, 7, sx, 2.95, sz);
    }
  }
  const rotundaCanopy = createVietnameseCurvedRoofGeometry(2.8, 2.8, 0.8, 0.8, 0.95, 0.28);
  rotundaCanopy.translate(0, 4.02, 0);
  roofParts.push(rotundaCanopy);
  addCyl(goldParts, 0.24, 0.20, 0.34, 8, 0, 2.05, 0); // central bronze incense urn
  // Suspended circular bamboo & nón lá chandelier ring hovering at y = 6.2m over central crossing
  for (let nl = 0; nl < 8; nl++) {
    const na = (nl / 8) * Math.PI * 2;
    addColoredCone(stallParts, '#e6cf8e', 0.45, 0.25, 10, Math.cos(na) * 3.2, 6.25, Math.sin(na) * 3.2);
  }

  const marketConcourseLightN = new THREE.PointLight('#ffd285', 2.6, 36, 1.3);
  marketConcourseLightN.position.set(0, 7.0, -18.0);
  const marketConcourseLightC = new THREE.PointLight('#ffd285', 2.6, 40, 1.3);
  marketConcourseLightC.position.set(0, 7.2, 0.0);
  group.add(marketConcourseLightN, marketConcourseLightC);

  // Clerestory central ventilation monitor hall rising above main eaves
  addBox(ochreParts, 82.0, 3.2, 24.0, 0, 12.1, 0);
  for (let x = -35; x <= 35; x += 7) {
    addBox(voidParts, 4.2, 1.8, 24.4, x, 12.2, 0);
  }

  // Broad stepped terracotta market roofs covering expanded 98m × 66m hall
  const lowerMarketRoof = createHippedRoofGeometry(99.2, 66.8, 83.0, 25.0, 4.6);
  lowerMarketRoof.translate(0, 10.5, 0);
  roofParts.push(lowerMarketRoof);

  const upperMonitorRoof = createHippedRoofGeometry(84.5, 26.5, 62.0, 1.2, 4.8);
  upperMonitorRoof.translate(0, 13.7, 0);
  roofParts.push(upperMonitorRoof);

  // Continuous horizontal cream cornice around main hall
  addBox(trimParts, 98.4, 0.55, 66.4, 0, 10.4, 0);

  // Four Corner Pavilions (expanded to ±45.2, ±29.2)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * 45.2;
      const pz = sz * 29.2;
      addBox(ochreParts, 9.2, 12.4, 9.2, px, 6.8, pz);
      addBox(trimParts, 9.8, 0.55, 9.8, px, 13.05, pz);
      addBox(trimParts, 9.6, 0.4, 9.6, px, 6.9, pz);
      for (const ox of [-4.2, 4.2]) {
        for (const oz of [-4.2, 4.2]) {
          addBox(trimParts, 0.68, 12.0, 0.68, px + ox, 6.8, pz + oz);
        }
      }
      addBox(voidParts, 3.4, 4.8, 9.45, px, 5.2, pz);
      addBox(voidParts, 9.45, 4.8, 3.4, px, 5.2, pz);

      const pavRoof = createHippedRoofGeometry(10.4, 10.4, 1.0, 1.0, 4.0);
      pavRoof.translate(px, 13.3, pz);
      roofParts.push(pavRoof);
      addCyl(goldParts, 0.12, 0.28, 1.2, 8, px, 17.8, pz);
    }
  }

  // North (-Z, Saigon Cửa Nam main facade) & South (+Z, Cửa Bắc) OPEN 7m-Tall Arched Porticos + Flanking Arched Colonnade Bays
  const towerZ = -33.2; // Tower footprint (8.4m deep) spans z in [-37.4 .. -29.0], flush with main portal!
  for (const sideZ of [-1, 1]) {
    const faceZ = sideZ * 33.0;
    const rotY = sideZ < 0 ? Math.PI : 0;

    if (sideZ < 0) {
      // Main Clock-Tower Entrance Portico (Cửa Nam — 11.8m tall center block): deep grounded 8.2m block spanning z in [-37.4 .. -29.2]
      const centerPortico = createArchedWallGeometry(16.0, 11.0, 8.2, 8.0, 7.2);
      centerPortico.rotateY(rotY);
      centerPortico.translate(0, 0.8, -33.3);
      ochreParts.push(centerPortico);
      // Molded portal parapet & cornice cleanly supporting the clock tower base (NO wave vents cutting across main arch — BT-01!)
      addBox(trimParts, 16.8, 0.58, 8.8, 0, 11.85, -33.3);
      addBox(ochreParts, 16.2, 0.45, 0.65, 0, 12.25, -37.1);
    } else {
      // Rear (+Z, Cửa Bắc) OPEN arched entrance portico
      const centerPortico = createArchedWallGeometry(16.0, 9.8, 3.2, 8.0, 7.2);
      centerPortico.rotateY(rotY);
      centerPortico.translate(0, 0.8, faceZ + 1.4);
      ochreParts.push(centerPortico);
      addBox(trimParts, 16.8, 0.55, 3.8, 0, 10.65, faceZ + 1.4);
      const southPorticoGable = createHippedRoofGeometry(17.4, 5.4, 8.0, 0.6, 3.5);
      southPorticoGable.translate(0, 10.9, faceZ + 1.5);
      roofParts.push(southPorticoGable);
    }

    // FIX BT-01 & BT-03: Authentic 3-Stepped Cửa Nam Facade Hierarchy (ref 28 / 59):
    // Center portal (11.8m) -> 2 flat intermediate wings (8.8m, rectangular roller-shutter bay + 3 horizontal wave grilles)
    // -> 3 lower arched colonnade bays per side (5.6m tall)!
    for (const sx of [-1, 1]) {
      if (sideZ < 0) {
        // Intermediate flat wing (x = ±11.8m, width 7.6m, height 8.8m)
        const wx = sx * 11.8;
        addBox(ochreParts, 7.6, 8.8, 1.8, wx, 5.2, faceZ);
        addBox(trimParts, 7.9, 0.34, 2.05, wx, 9.65, faceZ);
        // Rectangular corrugated iron roller-shutter entrance bay (4.8m × 4.0m)
        addBox(voidParts, 4.8, 4.0, 0.55, wx, 2.8, faceZ - 0.72);
        for (let sl = 0; sl < 6; sl++) {
          addColoredBox(stallParts, '#8c9196', 4.65, 0.14, 0.12, wx, 1.35 + sl * 0.56, faceZ - 0.94);
        }
        // 3 Horizontal pierced wave-grille vents (*song gió sóng nước*) cleanly centered above the roller door!
        for (const gxOff of [-2.05, 0, 2.05]) {
          addBox(voidParts, 1.75, 0.84, 0.45, wx + gxOff, 6.15, faceZ - 0.78);
          addBox(trimParts, 1.88, 0.11, 0.52, wx + gxOff, 6.60, faceZ - 0.80);
          addBox(trimParts, 1.88, 0.11, 0.52, wx + gxOff, 5.70, faceZ - 0.80);
          for (let w = -1; w <= 1; w++) {
            addBox(trimParts, 1.65, 0.08, 0.10, wx + gxOff, 6.15 + w * 0.22, faceZ - 0.92);
          }
        }
        // 3 Lower exterior arched colonnade bays (height 5.6m, |x| > 15.6m)
        for (let b = 0; b < 3; b++) {
          const bx = sx * (19.2 + b * 7.2);
          const lowBay = createArchedWallGeometry(7.0, 5.6, 1.8, 4.0, 4.1);
          lowBay.rotateY(rotY);
          lowBay.translate(bx, 0.8, faceZ);
          ochreParts.push(lowBay);
          addBox(voidParts, 3.7, 3.8, 1.1, bx, 2.7, faceZ + 0.45);
          addBox(trimParts, 0.72, 5.6, 2.05, bx - sx * 3.5, 3.6, faceZ);
          addBox(trimParts, 7.2, 0.34, 2.1, bx, 6.52, faceZ);
        }
        addBox(trimParts, 0.78, 5.6, 2.1, sx * 37.2, 3.6, faceZ);
      } else {
        for (let b = 0; b < 4; b++) {
          const bx = sx * (12.2 + b * 7.2);
          const bayWall = createArchedWallGeometry(7.0, 9.6, 1.8, 4.0, 6.2);
          bayWall.rotateY(rotY);
          bayWall.translate(bx, 0.8, faceZ);
          ochreParts.push(bayWall);
          addBox(voidParts, 3.7, 5.8, 1.1, bx, 3.7, faceZ - sideZ * 0.45);
          addBox(trimParts, 0.78, 9.6, 2.1, bx - sx * 3.5, 5.6, faceZ);
          addColoredBox(stallParts, '#2d6c4e', 6.8, 0.16, 2.35, bx, 6.95, faceZ + sideZ * 1.5, 0, sideZ * 0.24, 0);
        }
        addBox(trimParts, 0.78, 9.6, 2.1, sx * 39.8, 5.6, faceZ);
      }
    }
  }

  // East (+X) & West (-X) OPEN 7m-Tall Porticos + Full Arched Colonnade Bays & Green Rain Awnings!
  for (const sideX of [-1, 1]) {
    const faceX = sideX * 49.0;
    const rotY = sideX > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    // Central OPEN East/West portal (NO darkVoid blocker — walks straight into E-W concourse!)
    const sidePortico = createArchedWallGeometry(15.2, 9.8, 2.8, 7.6, 7.2);
    sidePortico.rotateY(rotY);
    sidePortico.translate(faceX + sideX * 1.2, 0.8, 0);
    ochreParts.push(sidePortico);
    addBox(trimParts, 3.4, 0.55, 16.0, faceX + sideX * 1.2, 10.65, 0);

    const sideEave = createHippedRoofGeometry(5.4, 16.4, 0.8, 8.6, 3.2);
    sideEave.translate(faceX + sideX * 1.3, 10.9, 0);
    roofParts.push(sideEave);

    // 3 Flanking colonial arched colonnade bays per side along East & West walls + green rain awnings
    for (const sz of [-1, 1]) {
      for (let b = 0; b < 3; b++) {
        const bz = sz * (10.8 + b * 6.4);
        const bayWall = createArchedWallGeometry(6.2, 9.6, 1.8, 3.6, 6.2);
        bayWall.rotateY(rotY);
        bayWall.translate(faceX, 0.8, bz);
        ochreParts.push(bayWall);
        addBox(voidParts, 1.1, 5.8, 3.3, faceX - sideX * 0.45, 3.7, bz);
        addBox(trimParts, 2.1, 9.6, 0.75, faceX, 5.6, bz - sz * 3.1);
        addColoredBox(stallParts, '#2d6c4e', 2.35, 0.16, 6.0, faceX + sideX * 1.5, 6.95, bz, 0, 0, -sideX * 0.24);
      }
    }
  }

  // FIX BT-02: Authentic Freestanding Dark Moss-Green ("#1c3832") Cutout Lettering "CHỢ BẾN THÀNH"
  // standing directly against the open sky on slender iron supports along the Cửa Nam parapet (NO inverted dark rectangle!)
  for (const px of [-3.6, -1.8, 0, 1.8, 3.6]) {
    addBox(ironParts, 0.06, 0.34, 0.06, px, 12.56, -37.25);
  }
  let btSignTex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const btSignCanvas = document.createElement('canvas');
    btSignCanvas.width = 1024;
    btSignCanvas.height = 160;
    const btCtx = btSignCanvas.getContext('2d');
    if (btCtx) {
      btCtx.clearRect(0, 0, 1024, 160);
      btCtx.fillStyle = '#1c3832';
      btCtx.strokeStyle = '#132824';
      btCtx.lineWidth = 4;
      btCtx.font = '900 104px "Segoe UI", Arial, sans-serif';
      btCtx.textAlign = 'center';
      btCtx.textBaseline = 'middle';
      btCtx.fillText('CHỢ BẾN THÀNH', 512, 86);
      btCtx.strokeText('CHỢ BẾN THÀNH', 512, 86);
    }
    btSignTex = new THREE.CanvasTexture(btSignCanvas);
    btSignTex.colorSpace = THREE.SRGBColorSpace;
    ctx.extraTextures.push(btSignTex);
  }
  const btSignMat = new THREE.MeshStandardMaterial({
    color: btSignTex ? '#ffffff' : '#1c3832',
    ...(btSignTex ? { map: btSignTex } : {}),
    alphaTest: btSignTex ? 0.45 : 0,
    transparent: Boolean(btSignTex),
    roughness: 0.45,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(btSignMat);
  const mainSign = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.25), btSignMat);
  mainSign.name = 'BenThanhMainSignage';
  mainSign.position.set(0, 13.08, -37.26);
  mainSign.rotation.y = Math.PI;
  group.add(mainSign);

  // FIX BT-01: Relocate Biên Hòa Vertical Ox & Duck Ceramic Bas-Relief DOWN onto the South Gate arch crown (y = 9.45)
  // directly BELOW "CHỢ BẾN THÀNH" (NOT on the clock tower!), and place 2 flanking small ceramic reliefs on the 2 flat wings!
  const ceramicSpecs: Array<{
    name: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    w: number;
    h: number;
    subText: string;
    seed: number;
  }> = [
      { name: 'BenThanhCeramicSouthMain', x: 0, y: 9.65, z: -37.45, rotY: Math.PI, w: 1.95, h: 2.35, subText: 'BÒ & VỊT', seed: 0 },
      { name: 'BenThanhCeramicSouthFlankL', x: -11.8, y: 7.95, z: -33.98, rotY: Math.PI, w: 1.45, h: 1.45, subText: 'BIÊN HÒA', seed: 0 },
      { name: 'BenThanhCeramicSouthFlankR', x: 11.8, y: 7.95, z: -33.98, rotY: Math.PI, w: 1.45, h: 1.45, subText: 'BIÊN HÒA', seed: 0 },
      { name: 'BenThanhCeramicEast', x: 51.75, y: 9.25, z: 0, rotY: Math.PI * 0.5, w: 4.4, h: 1.65, subText: 'LÚA & CÀ PHÊ', seed: 1 },
      { name: 'BenThanhCeramicWest', x: -51.75, y: 9.25, z: 0, rotY: -Math.PI * 0.5, w: 4.4, h: 1.65, subText: 'HOA SEN & CÁ', seed: 2 },
      { name: 'BenThanhCeramicNorth', x: 0, y: 9.25, z: 36.15, rotY: 0, w: 4.4, h: 1.65, subText: 'CHUỐI & CÁ ĐUỐI', seed: 3 }
    ];
  for (const cs of ceramicSpecs) {
    const plaque = createSignagePlaqueMesh(
      {
        text: '',
        subText: cs.subText,
        style: 'ceramic_relief',
        width: cs.w,
        height: cs.h,
        depth: 0.22,
        motifSeed: cs.seed
      },
      ctx
    );
    plaque.name = cs.name;
    plaque.position.set(cs.x, cs.y, cs.z);
    plaque.rotation.y = cs.rotY;
    group.add(plaque);
  }

  // Authentic Central Clock Tower (flush on main portal, y = 11.4 .. 28.8m — ref 28_cho_ben_thanh.jpg & 59)
  // Clean warm-cream plastered tower body (NO louvered vents below clock, NO stone balustrade!)
  addBox(ochreParts, 8.4, 10.4, 8.4, 0, 16.8, towerZ);
  addBox(trimParts, 8.9, 0.42, 8.9, 0, 11.8, towerZ);
  // Subtle corner pilasters & vertical chamfer trims
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(trimParts, 0.72, 10.2, 0.72, sx * 3.98, 16.8, towerZ + sz * 3.98);
    }
  }

  // Dark Attic Ventilation Frieze directly beneath the flared eaves (y = 21.8 .. 22.65m)
  addBox(voidParts, 8.0, 0.85, 8.0, 0, 22.22, towerZ);
  for (const side of [-1, 1]) {
    for (let m = -3; m <= 3; m++) {
      addBox(trimParts, 0.16, 0.88, 0.22, m * 1.08, 22.22, towerZ + side * 4.02);
      addBox(trimParts, 0.22, 0.88, 0.16, side * 4.02, 22.22, towerZ + m * 1.08);
    }
  }
  addBox(trimParts, 8.85, 0.28, 8.85, 0, 21.75, towerZ);
  addBox(trimParts, 9.2, 0.28, 9.2, 0, 22.68, towerZ);

  // Sculpted Under-Eave Corbel Brackets supporting the wide flared terracotta eave skirt (y = 22.55m)
  for (const side of [-1, 1]) {
    for (let b = -3; b <= 3; b++) {
      addBox(trimParts, 0.26, 0.48, 0.95, b * 1.25, 22.52, towerZ + side * 4.45, 0, side * 0.22, 0);
      addBox(trimParts, 0.95, 0.48, 0.26, side * 4.45, 22.52, towerZ + b * 1.25, 0, 0, -side * 0.22);
    }
  }

  // SINGLE Wide Flared 4-Slope Terracotta Tower Roof (y = 22.7 .. 27.1m) + Slender Finial & Lightning Rod!
  const singleTowerRoof = createVietnameseCurvedRoofGeometry(11.6, 11.6, 0.45, 0.45, 4.4, 0.34);
  singleTowerRoof.translate(0, 22.72, towerZ);
  roofParts.push(singleTowerRoof);

  // Slender sculpted finial base + tall thin lightning rod reaching 29.5m
  addCyl(goldParts, 0.18, 0.38, 0.55, 8, 0, 27.25, towerZ);
  addCyl(ironParts, 0.04, 0.08, 2.15, 8, 0, 28.45, towerZ);

  // Three Large White Circular Clock Faces with Sky-Blue Numeral Ring & Chamfered White Surround (North/West/East)
  const clockRadius = 1.72;
  const clockY = 18.75;
  const clockSpecs: Array<[number, number, number]> = [
    [0, towerZ - 4.24, Math.PI],
    [-4.24, towerZ, -Math.PI * 0.5],
    [4.24, towerZ, Math.PI * 0.5]
  ];
  for (const [ckx, ckz, ckRot] of clockSpecs) {
    // FIX BT-04: Smooth circular molded white plaster clock surround (18-sided ring — NOT 8-sided octagon, ref 28 & 59!)
    const frame = new THREE.CylinderGeometry(clockRadius * 1.20, clockRadius * 1.24, 0.24, 18);
    frame.rotateX(Math.PI * 0.5);
    frame.rotateY(ckRot);
    frame.translate(ckx, clockY, ckz);
    trimParts.push(frame);
    // Sky-blue numeral ring (*vành số xanh dương nhạt* per ref 28/59)
    const blueRing = new THREE.RingGeometry(clockRadius * 0.72, clockRadius * 0.98, 28);
    blueRing.translate(0, 0, 0.095);
    blueRing.rotateY(ckRot);
    blueRing.translate(ckx, clockY, ckz);
    stallParts.push(colorizeGeometry(blueRing, '#5aa6d8'));
    // Crisp white dial, gold bezel & black ticks/hands
    addClockDial(trimParts, goldParts, voidParts, ckx, clockY, ckz, clockRadius, ckRot);
  }

  // 12 Perimeter Indochine Heritage Streetlamps surrounding the market & North forecourt
  const lampCoords: Array<[number, number]> = [
    [-22, -41.0], [-10, -41.0], [10, -41.0], [22, -41.0],
    [-46, -38.0], [46, -38.0],
    [-53.5, -18.0], [-53.5, 18.0],
    [53.5, -18.0], [53.5, 18.0],
    [-24, 38.5], [24, 38.5]
  ];
  for (const [lx, lz] of lampCoords) {
    addHeritageStreetlampParts(ironParts, lampCoreParts, lx, 0.0, lz, 4.8, Math.abs(lz + 41.0) < 0.5);
  }

  const stallVertexMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.05
  });
  const wroughtIronMat = new THREE.MeshStandardMaterial({
    color: '#25292d',
    roughness: 0.42,
    metalness: 0.72
  });
  ctx.extraMaterials.push(stallVertexMat, wroughtIronMat);

  const creamWallMat = ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster;
  const ochreMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(ochreParts), 3.0), creamWallMat);
  ochreMesh.name = 'BenThanhOchreWalls';
  ochreMesh.castShadow = true;
  ochreMesh.receiveShadow = true;

  group.add(
    ochreMesh,
    makeMergedMesh('BenThanhTerracottaRoofs', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('BenThanhMarbleTrimAndDials', trimParts, whiteMat),
    makeMergedMesh('BenThanhVoidPortals', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('BenThanhGoldDetails', goldParts, ctx.materials.gold),
    makeMergedMesh('BenThanhMarketStalls', stallParts, stallVertexMat),
    makeMergedMesh('BenThanhIronTrussesAndLamps', ironParts, wroughtIronMat),
    makeMergedMesh(
      'BenThanhInteriorLamps',
      lampCoreParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    )
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 58.0 });
}

// ============================================================================
// 2. Dinh Độc Lập — TP. Hồ Chí Minh (0, 250), facing north -Z
//    92m × 36m × 26m palace + rear T-wing, 124m × 96m front park, curved oval
//    driveway, wrought-iron gates, T-54B #843 & Type-59 #390 tanks, UH-1 Huey
// ============================================================================
function buildIndependencePalace(ctx: VietnamBuilderContext): void {
  const cx = 0;
  const cz = 250;
  const yBase = ctx.getHeight(cx, cz);

  const group = new THREE.Group();
  group.name = 'IndependencePalaceComplex';
  group.position.set(cx, yBase, cz);

  const whiteParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const groundParts: THREE.BufferGeometry[] = [];
  const ironParts: THREE.BufferGeometry[] = [];
  const armorParts: THREE.BufferGeometry[] = [];
  const darkMetalParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const jetParts: THREE.BufferGeometry[] = [];

  // FIX DL-04: Authentic matte warm-ivory/concrete modernist plaster (#dfd9cc, roughness 0.74 — NOT glossy 0.34 marble!)
  const whiteMat = new THREE.MeshStandardMaterial({
    color: '#dfd9cc',
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.74,
    metalness: 0.02
  });
  ctx.extraMaterials.push(whiteMat);

  // 1. Expanded Sweeping Emerald 124m × 96m Front Park Lawn (local z in [-98 .. -2], centered at -50)
  const lawnCenterZ = -55.0; // Oval fountain pond stays anchored at world (0, 195)
  addColoredBox(groundParts, '#2d7d36', 124.0, 0.24, 96.0, 0, -0.05, -50.0);
  // Park border curbs
  addColoredBox(groundParts, '#cfc8b6', 125.2, 0.28, 0.8, 0, -0.02, -98.0);
  addColoredBox(groundParts, '#cfc8b6', 125.2, 0.28, 0.8, 0, -0.02, -2.0);
  addColoredBox(groundParts, '#cfc8b6', 0.8, 0.28, 96.8, -62.0, -0.02, -50.0);
  addColoredBox(groundParts, '#cfc8b6', 0.8, 0.28, 96.8, 62.0, -0.02, -50.0);

  // Authentic Curved Oval Driveway Loop wrapping gracefully around the Oval Fountain Pond!
  // (a) North Gate entry neck from z = -98 to z = -72 (stops cleanly outside oval pond!)
  addColoredBox(groundParts, '#b8b09c', 15.0, 0.28, 26.0, 0, -0.01, -85.0);
  // (b) South Ceremonial Forecourt apron in front of Porte-Cochère (z = -37 to -22)
  addColoredBox(groundParts, '#c4bca9', 52.0, 0.28, 15.5, 0, -0.01, -29.8);
  // (c) Smooth Elliptical Ring Driveway around the Oval Fountain Pond (inner rx=15.4/rz=11.4, outer rx=23.2/rz=18.2)
  const loopSegs = 40;
  for (let i = 0; i < loopSegs; i++) {
    const a0 = (i / loopSegs) * Math.PI * 2;
    const a1 = ((i + 1) / loopSegs) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    const rxMid = 19.3;
    const rzMid = 14.8;
    const x0 = Math.cos(a0) * rxMid;
    const z0 = lawnCenterZ + Math.sin(a0) * rzMid;
    const x1 = Math.cos(a1) * rxMid;
    const z1 = lawnCenterZ + Math.sin(a1) * rzMid;
    const segLen = Math.hypot(x1 - x0, z1 - z0) + 0.55;
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    addColoredBox(groundParts, '#bdb5a2', 7.8, 0.28, segLen, (x0 + x1) * 0.5, -0.01, (z0 + z1) * 0.5, yaw);
    // Subtle inner/outer white driveway curb stone ticks
    const ox = Math.cos(am) * 23.3;
    const oz = lawnCenterZ + Math.sin(am) * 18.8;
    addColoredBox(groundParts, '#d9d3c3', 0.45, 0.32, segLen * 0.95, ox, 0.01, oz, yaw);
  }

  // 2. FIX DL-01: Authentic Rounded-Rectangle Fountain Basin (22m × 10m) framed by Square-Clipped Green Hedge (#2b6124)
  //    & Dense Conical Multi-Ring Water Spray Plumes (matching ref 29_dinh_doc_lap.jpg!)
  addColoredBox(groundParts, '#c6beaa', 25.4, 0.28, 13.4, 0, 0.01, lawnCenterZ);
  // White stone rectangular basin rim & manicured square-clipped green hedge border around basin
  for (const sz of [-1, 1]) {
    addBox(whiteParts, 22.4, 0.68, 0.55, 0, 0.36, lawnCenterZ + sz * 5.0);
    addColoredBox(foliageParts, '#2b6124', 24.4, 0.92, 0.85, 0, 0.48, lawnCenterZ + sz * 6.0);
  }
  for (const sx of [-1, 1]) {
    addBox(whiteParts, 0.55, 0.68, 10.55, sx * 11.0, 0.36, lawnCenterZ);
    addColoredBox(foliageParts, '#2b6124', 0.85, 0.92, 12.8, sx * 12.0, 0.48, lawnCenterZ);
  }

  // Dense Conical Center Plume (8.5m tall) + 28 Vertical/Arcing Concentric Spray Jets (NO European stone bowls!)
  const centerCone = new THREE.CylinderGeometry(0.18, 1.35, 8.2, 12, 1, true);
  centerCone.translate(0, 4.55, lawnCenterZ);
  jetParts.push(centerCone);
  for (let j = 0; j < 24; j++) {
    const a = (j / 24) * Math.PI * 2;
    const isInner = j % 2 === 0;
    const rBase = isInner ? 1.85 : 4.2;
    const rZ = isInner ? 1.35 : 2.6;
    const jetH = isInner ? 5.2 : 3.4;
    const jet = new THREE.CylinderGeometry(0.05, 0.16, jetH, 6, 1, true);
    jet.rotateZ(-Math.cos(a) * 0.14);
    jet.rotateX(Math.sin(a) * 0.14);
    jet.translate(Math.cos(a) * rBase, 0.55 + jetH * 0.5, lawnCenterZ + Math.sin(a) * rZ);
    jetParts.push(jet);
  }

  // Turquoise reflective rectangular fountain water surface
  const pondWaterGeo = new THREE.BoxGeometry(21.4, 0.12, 9.4);
  pondWaterGeo.translate(0, 0.48, lawnCenterZ);
  const palaceWaterMat = new THREE.MeshStandardMaterial({
    color: '#2898a6',
    roughness: 0.14,
    metalness: 0.38
  });
  const { material: jetMat, uniforms: jetU } = createAnimatedFountainJetMaterial();
  ctx.extraMaterials.push(palaceWaterMat, jetMat);
  ctx.animatedUniforms?.push(jetU);

  // 2b. Iconic Wrought-Iron Heritage Fence + Main Iron Gates + 2 White Guardhouses at North boundary (local z = -98)
  const fenceZ = -98.0;
  // White concrete low wall & rhythmic concrete piers along West & East spans (leaving x in [-9..+9] open for Main Gate)
  for (const sx of [-1, 1]) {
    addBox(whiteParts, 53.0, 0.75, 0.55, sx * 35.5, 0.38, fenceZ);
    // Top & bottom wrought-iron horizontal rails
    addBox(ironParts, 52.8, 0.08, 0.08, sx * 35.5, 2.75, fenceZ);
    addBox(ironParts, 52.8, 0.08, 0.08, sx * 35.5, 1.05, fenceZ);
    for (let px = 9.0; px <= 62.0; px += 6.6) {
      addBox(whiteParts, 0.56, 3.1, 0.56, sx * px, 1.55, fenceZ);
      addBox(whiteParts, 0.72, 0.22, 0.72, sx * px, 3.16, fenceZ);
    }
    // Vertical wrought-iron fence pickets
    for (let ix = 9.8; ix < 61.6; ix += 0.95) {
      addBox(ironParts, 0.06, 2.15, 0.06, sx * ix, 1.85, fenceZ);
    }
    // Grand Main Gate Pier & Swung-Open Historic Iron Gate Leaf
    addBox(whiteParts, 1.25, 4.1, 1.25, sx * 9.0, 2.05, fenceZ);
    addBox(whiteParts, 1.5, 0.32, 1.5, sx * 9.0, 4.2, fenceZ);
    // Open iron gate leaf swinging inward (+Z)
    const leafW = 7.4;
    const leafYaw = sx * 0.46;
    const pivotX = sx * 8.4;
    const leafCenterX = pivotX - sx * Math.cos(Math.abs(leafYaw)) * (leafW * 0.5);
    const leafCenterZ = fenceZ + Math.sin(Math.abs(leafYaw)) * (leafW * 0.5);
    addBox(ironParts, leafW, 0.12, 0.12, leafCenterX, 3.15, leafCenterZ, leafYaw);
    addBox(ironParts, leafW, 0.12, 0.12, leafCenterX, 0.55, leafCenterZ, leafYaw);
    addBox(ironParts, leafW, 0.10, 0.10, leafCenterX, 1.85, leafCenterZ, leafYaw);
    for (let g = -3; g <= 3; g++) {
      const gx = leafCenterX + Math.cos(leafYaw) * (g * 1.02);
      const gz = leafCenterZ - Math.sin(leafYaw) * (g * 1.02);
      addBox(ironParts, 0.07, 2.7, 0.07, gx, 1.85, gz, leafYaw);
    }
    addBox(goldParts, 0.75, 0.75, 0.16, leafCenterX, 1.85, leafCenterZ, leafYaw);

    // 2 White Modernist Guardhouses flanking Main Iron Gates at (sx * 15.5, -95.2)
    const gx = sx * 15.5;
    const gz = -95.2;
    addBox(whiteParts, 4.6, 3.1, 3.8, gx, 1.55, gz);
    addBox(whiteParts, 5.6, 0.36, 4.8, gx, 3.28, gz); // modernist cantilevered roof slab
    addBox(voidParts, 3.6, 1.25, 3.92, gx, 2.05, gz); // corner glazed observation windows
    addBox(voidParts, 4.72, 1.25, 2.8, gx, 2.05, gz);
  }

  const graniteParts: THREE.BufferGeometry[] = [];

  // 2c. Two Historic Tanks — T-54B #843 & Type-59 #390 displayed on the emerald front lawn!
  const tankSpecs: Array<{ x: number; z: number; rotY: number; num: string; title: string }> = [
    { x: -34.0, z: -46.0, rotY: 0.28, num: '843', title: 'XE TĂNG T-54B SỐ 843' },
    { x: 34.0, z: -46.0, rotY: -0.28, num: '390', title: 'XE TĂNG TYPE-59 SỐ 390' }
  ];
  for (const tk of tankSpecs) {
    // Low concrete museum exhibition pad under each tank
    addColoredBox(groundParts, '#b7b09f', 5.6, 0.24, 8.6, tk.x, 0.08, tk.z, tk.rotY);
    const { armorParts: tArmor, darkParts: tDark } = createHistoricalTankParts(tk.x, 0.20, tk.z, tk.rotY, 1.0);
    armorParts.push(...tArmor);
    darkMetalParts.push(...tDark);

    // Authentic white-rimmed 5 roadwheels per side + roof DShK machine gun & whip antenna (ref 94_dinh_doc_lap_xe_tang.jpg)
    const cosR = Math.cos(tk.rotY);
    const sinR = Math.sin(tk.rotY);
    const toTankWorld = (lx: number, ly: number, lz: number): [number, number, number] => [
      tk.x + lx * cosR + lz * sinR,
      0.20 + ly,
      tk.z - lx * sinR + lz * cosR
    ];
    for (const sx of [-1, 1]) {
      for (let w = 0; w < 5; w++) {
        const rim = new THREE.TorusGeometry(0.32, 0.048, 6, 12);
        rim.rotateY(Math.PI * 0.5 + tk.rotY);
        const [rx, ry, rz] = toTankWorld(sx * 1.80, 0.44, -2.2 + w * 1.1);
        rim.translate(rx, ry, rz);
        whiteParts.push(rim);
      }
      // White turret numeral plate on both sides of turret
      const [nx, ny, nz] = toTankWorld(sx * 1.42, 1.88, 0.28);
      const numPlate = createSignagePlaqueMesh(
        {
          text: tk.num,
          style: 'bronze',
          bgColor: '#4b593c',
          borderColor: '#4b593c',
          textColor: '#ffffff',
          width: 1.05,
          height: 0.44,
          depth: 0.05,
          motifSeed: tk.num === '843' ? 8431 : 3901
        },
        ctx
      );
      numPlate.position.set(nx, ny, nz);
      numPlate.rotation.y = tk.rotY + (sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      group.add(numPlate);
    }
    // Roof DShK 12.7mm machine gun + rear slender whip antenna
    const [mgx, mgy, mgz] = toTankWorld(-0.42, 2.66, 0.45);
    addCyl(darkMetalParts, 0.032, 0.04, 1.25, 6, mgx, mgy, mgz, tk.rotY, Math.PI * 0.5 - 0.14, 0);
    addBox(darkMetalParts, 0.18, 0.22, 0.42, ...toTankWorld(-0.42, 2.62, -0.05), tk.rotY);
    addCyl(darkMetalParts, 0.015, 0.025, 2.6, 5, ...toTankWorld(0.65, 3.25, -0.75));

    // Red-and-gold museum perimeter chain stanchions around each tank pad
    for (const cxOff of [-2.95, 2.95]) {
      for (const czOff of [-4.2, 0, 4.2]) {
        const [pxPost, , pzPost] = toTankWorld(cxOff, 0, czOff);
        addCyl(crimsonParts, 0.05, 0.06, 0.92, 6, pxPost, 0.52, pzPost);
        addCyl(goldParts, 0.075, 0.075, 0.12, 6, pxPost, 1.00, pzPost);
      }
    }

    // Authentic Blue Metal Historical Info Plaque beside each tank (style: 'blue_plaque')
    const px = tk.x + (tk.x < 0 ? 4.2 : -4.2);
    const pz = tk.z - 2.6;
    addBox(whiteParts, 1.35, 1.15, 0.42, px, 0.58, pz);
    const tankPlaque = createSignagePlaqueMesh(
      {
        text: `XE TĂNG SỐ ${tk.num}`,
        subText: tk.title,
        style: 'blue_plaque',
        width: 1.65,
        height: 0.92,
        depth: 0.14,
        motifSeed: tk.num === '843' ? 843 : 390
      },
      ctx
    );
    tankPlaque.name = `IndependencePalaceTankPlaque_${tk.num}`;
    tankPlaque.position.set(px, 1.48, pz);
    tankPlaque.rotation.y = Math.PI;
    group.add(tankPlaque);
  }

  // 3. Main 1960s Modernist Palace Building: 92m wide × 36m deep × 26.0m high (centered at z = 0)
  // Clad Ground-Floor Plinth in Dark Split Grey-Brown Stone (graniteParts — ref 29_dinh_doc_lap.jpg)
  addBox(graniteParts, 92.4, 2.4, 36.4, 0, 0.6, 0);

  // Ground floor colonnade + 3 OPEN Walk-In Historical State Halls inside Dinh Độc Lập (refs 118 & 119):
  //   (1) Center: Đại Sảnh Khánh Tiết & Phòng Họp Nội Các
  //   (2) East Wing (+X): Phòng Đại Yến (State Banquet Hall — ref 118_dinh_doc_lap_phong_dai_yen.jpg)
  //   (3) West Wing (-X): Phòng Trình Quốc Thư (Credentials Presenting Room — ref 119_dinh_doc_lap_phong_trinh_quoc_thu.jpg) + Lối Vào Hầm Chỉ Huy!
  addBox(voidParts, 83.0, 6.0, 8.5, 0, 4.8, 10.0);
  addBox(whiteParts, 84.0, 0.26, 20.5, 0, 7.62, -4.2);
  // Real Painted Sơn Mài Lacquer Landscape Mural inside Gold Frame (replacing flat crimson slab)
  addBox(goldParts, 14.5, 4.95, 0.24, 0, 4.5, -0.42);
  const lacquerMural = createSignagePlaqueMesh(
    {
      text: '',
      style: 'lacquer_mural',
      width: 14.0,
      height: 4.6,
      depth: 0.22,
      motifSeed: 1966
    },
    ctx
  );
  lacquerMural.name = 'IndependencePalaceLacquerMural';
  lacquerMural.position.set(0, 4.5, -0.34);
  lacquerMural.rotation.y = Math.PI;
  group.add(lacquerMural);

  // (A) East Wing Walk-In PHÒNG ĐẠI YẾN (State Banquet Hall at x = +26.5, z = -6.5 — ref 118_dinh_doc_lap_phong_dai_yen.jpg!):
  //     Long mahogany banquet table for 16 delegates, tall golden-velvet floor-to-ceiling curtains, 2 tiered geometric square chandeliers & 4 porcelain vases on pedestals!
  const banquetX = 26.5;
  const banquetZ = -6.5;
  addColoredBox(groundParts, '#b89e5a', 26.0, 0.08, 13.5, banquetX, 1.84, banquetZ); // golden-olive banquet carpet
  addColoredBox(groundParts, '#4a2b18', 12.8, 0.16, 2.6, banquetX, 2.68, banquetZ); // mahogany banquet tabletop
  addColoredBox(groundParts, '#3a2010', 11.6, 0.78, 1.4, banquetX, 2.22, banquetZ);
  for (let ch = -5; ch <= 5; ch++) {
    for (const czSide of [-1.85, 1.85]) {
      addColoredBox(groundParts, '#5c3820', 0.62, 0.98, 0.58, banquetX + ch * 1.12, 2.32, banquetZ + czSide);
      // Individual white porcelain banquet place-setting charger plates
      addCyl(whiteParts, 0.22, 0.18, 0.04, 6, banquetX + ch * 1.12, 2.78, banquetZ + czSide * 0.48);
    }
  }
  // 3 Golden floral banquet table centerpieces & overhead coffered ceiling beams
  for (const cpX of [banquetX - 3.6, banquetX, banquetX + 3.6]) {
    addCyl(goldParts, 0.28, 0.16, 0.36, 8, cpX, 2.94, banquetZ);
  }
  for (const bX of [banquetX - 7.2, banquetX, banquetX + 7.2]) {
    addBox(whiteParts, 0.36, 0.38, 12.6, bX, 7.42, banquetZ);
  }
  // Tall golden-yellow velvet draperies (*rèm nhung vàng*) & porcelain vases on dark-wood pedestals along East Banquet Hall
  for (let dr = -2; dr <= 2; dr++) {
    const dx = banquetX + dr * 4.8;
    addBox(goldParts, 1.15, 5.4, 0.18, dx, 4.55, banquetZ + 5.8);
    addColoredBox(groundParts, '#3e2314', 0.68, 0.95, 0.68, dx + 2.2, 2.32, banquetZ + 5.3);
    addCyl(whiteParts, 0.22, 0.16, 0.62, 8, dx + 2.2, 3.12, banquetZ + 5.3);
  }
  // 2 Tiered Modernist Square Geometric Chandeliers suspended from Phòng Đại Yến ceiling (ref 118!)
  for (const chX of [banquetX - 4.2, banquetX + 4.2]) {
    addBox(whiteParts, 2.8, 0.22, 2.8, chX, 7.25, banquetZ);
    addBox(goldParts, 1.95, 0.28, 1.95, chX, 6.85, banquetZ);
    addBox(goldParts, 1.25, 0.24, 1.25, chX, 6.48, banquetZ);
  }

  // (B) West Wing Walk-In PHÒNG TRÌNH QUỐC THƯ (Credentials Presenting Room at x = -26.5, z = -6.5 — ref 119_dinh_doc_lap_phong_trinh_quoc_thu.jpg!):
  //     Monumental 40-panel golden Sơn Mài mural, gilded lacquer presidential reception desk & high-backed chair, 4 tall flared bronze vases & cream diplomatic sofas!
  const credX = -26.5;
  const credZ = -6.5;
  addColoredBox(groundParts, '#c8a962', 26.0, 0.08, 13.5, credX, 1.84, credZ); // warm amber wool carpet
  addBox(goldParts, 13.6, 4.6, 0.22, credX, 4.45, credZ + 5.85); // 40-panel golden Bình Ngô Đại Cáo sơn mài mural
  addBox(goldParts, 4.2, 0.92, 1.35, credX, 2.32, credZ + 3.4); // gilded lacquer presidential credentials table
  addBox(whiteParts, 0.95, 1.45, 0.85, credX, 2.62, credZ + 4.45); // high-backed credential throne chair
  for (const side of [-1, 1]) {
    // 4 Tall Flared Bronze Floor Vases (*lọ đồng loe*) on wooden stands + cream diplomatic armchairs & sofas (ref 119!)
    addColoredBox(groundParts, '#3a1f12', 0.65, 0.82, 0.65, credX + side * 5.2, 2.25, credZ + 4.8);
    addCyl(goldParts, 0.34, 0.22, 1.45, 10, credX + side * 5.2, 3.38, credZ + 4.8);
    addBox(whiteParts, 1.15, 0.95, 3.8, credX + side * 5.6, 2.32, credZ - 0.6); // cream velvet diplomatic sofa
    addBox(goldParts, 0.95, 0.48, 2.2, credX + side * 3.8, 2.08, credZ - 0.6); // gilded lacquer coffee table
  }
  // Cut-away West Plinth Portal & Interior Tactical Radio Console inside HẦM CHỈ HUY DINH ĐỘC LẬP (x = -46.2, z = -4.0)
  addBox(ironParts, 2.2, 2.35, 0.32, -46.15, 1.18, -4.0);
  addBox(goldParts, 0.42, 0.42, 0.38, -45.65, 1.18, -4.0);
  addBox(ironParts, 2.8, 1.25, 0.95, -42.5, 0.68, -4.0); // basement radio & teletype command console
  // Twin ceremonial diplomatic flagpoles flanking the Phòng Trình Quốc Thư presidential desk & gilded state lotus emblem above mural
  for (const side of [-1, 1]) {
    addCyl(goldParts, 0.04, 0.05, 3.6, 6, credX + side * 2.85, 3.65, credZ + 4.4);
    addBox(crimsonParts, 0.72, 1.15, 0.12, credX + side * 2.85, 4.72, credZ + 4.4);
  }
  addCyl(goldParts, 0.58, 0.58, 0.12, 10, credX, 6.95, credZ + 5.75);

  // (C) Center Ceremonial Foyer & State Reception Table with crimson velvet chairs
  addBox(whiteParts, 11.2, 0.16, 2.8, 0, 2.75, -6.4);
  addBox(goldParts, 10.6, 0.85, 2.2, 0, 2.28, -6.4);
  for (let ch = -4; ch <= 4; ch++) {
    addBox(crimsonParts, 0.65, 1.05, 0.62, ch * 1.18, 2.38, -8.25);
    addBox(crimsonParts, 0.65, 1.05, 0.62, ch * 1.18, 2.38, -4.55);
  }
  // Twin modernist marble ceremonial staircases flanking lobby
  for (const sx of [-1, 1]) {
    for (let st = 0; st < 8; st++) {
      const sy = 1.95 + st * 0.48;
      const sz = -11.5 + st * 1.15;
      addBox(whiteParts, 3.2, 0.35, 1.1, sx * 10.4, sy, sz);
      addBox(crimsonParts, 2.15, 0.06, 1.12, sx * 10.4, sy + 0.19, sz);
    }
  }
  const foyerLight = new THREE.PointLight('#ffe0a8', 2.8, 28, 1.3);
  foyerLight.position.set(0, 6.6, -7.8);
  group.add(foyerLight);
  for (let i = -8; i <= 8; i++) {
    const px = i * 5.2;
    if (i !== 0) {
      addBox(whiteParts, 0.85, 6.0, 0.95, px, 4.8, -16.8);
    }
    addBox(whiteParts, 0.85, 6.0, 0.95, px, 4.8, 16.8);
  }
  for (const sx of [-1, 1]) {
    for (let j = -2; j <= 2; j++) {
      addBox(whiteParts, 0.95, 6.0, 0.85, sx * 44.6, 4.8, j * 6.0);
    }
  }

  // Horizontal projecting white marble 2nd floor cantilever slab (y = 7.8 .. 8.8m)
  addBox(whiteParts, 92.0, 1.05, 36.0, 0, 8.3, 0);

  // Upper facade dark glass hall behind sun-screen (y = 8.8 .. 20.8m)
  addBox(voidParts, 84.0, 12.0, 27.0, 0, 14.8, 0.8);

  // FIX DL-01 & DL-02: Split *Rèm Hoa Đá Đốt Trúc* into Left & Right Wings (x ∈ [-28.5..-7.6] & [+7.6..+28.5]),
  // exposing the Projecting Central Ceremonial Balcony (14.8m wide) & Recessed Dark Attic Clerestory Window Band (y = 18.4..20.6m)!
  const louverZ = -16.8;
  const finShape = new THREE.Shape();
  const tierH = 3.13; // 3 crisp bamboo-node tiers × 3.13m = 9.4m (y = 8.8 .. 18.2m, leaving y=18.2..20.8m open for attic clerestory!)
  const wWide = 0.52;
  const wPinch = 0.13;
  finShape.moveTo(-wWide, 0);
  for (let t = 0; t < 3; t++) {
    const y0 = t * tierH;
    const ym = y0 + tierH * 0.5;
    const y1 = y0 + tierH;
    finShape.quadraticCurveTo(-wPinch * 1.15, y0 + tierH * 0.25, -wPinch, ym);
    finShape.quadraticCurveTo(-wPinch * 1.15, y0 + tierH * 0.75, -wWide, y1);
  }
  finShape.lineTo(wWide, tierH * 3);
  for (let t = 2; t >= 0; t--) {
    const y0 = t * tierH;
    const ym = y0 + tierH * 0.5;
    const y1 = y0 + tierH;
    finShape.quadraticCurveTo(wPinch * 1.15, y0 + tierH * 0.75, wPinch, ym);
    finShape.quadraticCurveTo(wPinch * 1.15, y0 + tierH * 0.25, wWide, y0);
  }
  finShape.closePath();
  const baseFinGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.95,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 1,
    curveSegments: 4
  });
  baseFinGeo.translate(0, 8.8, louverZ - 0.48);

  for (const sx of [-1, 1]) {
    const wingStart = 7.6;
    const wingEnd = 28.4;
    const bladesPerWing = 17;
    const step = (wingEnd - wingStart) / (bladesPerWing - 1);
    for (let i = 0; i < bladesPerWing; i++) {
      const lx = sx * (wingStart + i * step);
      const fin = baseFinGeo.clone();
      fin.translate(lx, 0, 0);
      whiteParts.push(fin);
      if (i % 4 === 0) {
        addBox(whiteParts, 0.42, 9.45, 1.18, lx, 13.52, louverZ);
      }
    }
  }
  baseFinGeo.dispose();

  // Horizontal cap cornice atop the 3-tier brise-soleil + Exposed Recessed Dark Attic Clerestory Strip (y = 18.4..20.8m)
  addBox(whiteParts, 58.0, 0.34, 1.35, 0, 18.36, louverZ);
  addBox(voidParts, 86.0, 2.25, 1.2, 0, 19.65, louverZ + 1.45);
  for (let mx = -40; mx <= 40; mx += 4.0) {
    addBox(whiteParts, 0.22, 2.25, 0.35, mx, 19.65, louverZ + 0.92);
  }

  // Iconic Projecting Central Ceremonial Balcony (*Ban công Hành Lễ Trung Tâm* — 14.8m wide, projecting to z = -20.8m!)
  addBox(whiteParts, 14.8, 0.48, 5.2, 0, 9.04, -18.8);
  addBox(whiteParts, 14.8, 1.15, 0.24, 0, 9.85, -21.25);
  for (const sx of [-1, 1]) {
    addBox(whiteParts, 0.24, 1.15, 4.6, sx * 7.28, 9.85, -19.0);
    addBox(whiteParts, 0.48, 6.2, 0.48, sx * 7.12, 12.2, -20.8);
  }
  // Sleek cantilevered ceremonial balcony roof canopy (y = 15.2m) & recessed dark glass hall behind
  addBox(whiteParts, 15.4, 0.46, 5.6, 0, 15.35, -18.8);
  addBox(voidParts, 13.8, 6.0, 0.6, 0, 12.1, -16.4);

  // Solid Cream Outer Front Wings with Recessed 3×2 Dark Window Grids & Carved Horizontal Relief Spandrels (ref 29)
  for (const sx of [-1, 1]) {
    const wingCenterX = sx * 36.2;
    // Solid cream front facade wall panel flanking the central brise-soleil
    addBox(whiteParts, 18.4, 12.0, 2.2, wingCenterX, 14.8, -13.2);
    // Solid cream outer flank walls & cornice bands
    addBox(whiteParts, 18.4, 0.85, 28.0, wingCenterX, 14.8, 1.0);
    // FIX DL-06: Narrower tall modernist vertical slit windows (2.45m x 4.05m) & crisp framed recessed spandrel relief (ref 29!)
    for (let col = 0; col < 3; col++) {
      const wx = sx * (30.2 + col * 5.6);
      for (const wy of [11.6, 17.6]) {
        addBox(voidParts, 2.45, 4.05, 0.45, wx, wy, -14.22);
        // Slim center mullion + recessed vertical jambs & horizontal sill
        addBox(whiteParts, 0.12, 4.05, 0.48, wx, wy, -14.25);
        addBox(whiteParts, 2.75, 0.20, 0.55, wx, wy - 2.12, -14.32);
        addBox(whiteParts, 2.75, 0.20, 0.55, wx, wy + 2.12, -14.32);
      }
      // Framed vertical modernist relief spandrel panel between 2nd & 3rd floor slits
      addBox(whiteParts, 2.65, 1.15, 0.28, wx, 14.6, -14.34);
      addBox(whiteParts, 0.16, 1.05, 0.34, wx - 0.65, 14.6, -14.38);
      addBox(whiteParts, 0.16, 1.05, 0.34, wx + 0.65, 14.6, -14.38);
    }
    for (let j = -2; j <= 2; j++) {
      addBox(whiteParts, 0.9, 12.0, 0.55, sx * 44.8, 14.8, j * 5.8);
    }
  }

  // Rear T-Wing Presidential Quarters Extension (+Z rear of main palace, z in [+18..+38])
  addBox(graniteParts, 30.4, 2.2, 22.4, 0, 0.7, 27.0);
  addBox(voidParts, 26.0, 18.4, 19.0, 0, 11.2, 27.0);
  addBox(whiteParts, 31.0, 0.95, 22.5, 0, 8.3, 27.0);
  addBox(whiteParts, 31.0, 0.85, 22.5, 0, 14.8, 27.0);
  // Rear T-Wing Main Roof Deck flush at y = 22.10m top (hosting the UH-1 Huey & 2 bomb-impact circles!)
  addBox(whiteParts, 32.0, 1.3, 23.2, 0, 21.45, 27.0);
  for (const sx of [-1, 1]) {
    for (let tz = 20.0; tz <= 36.0; tz += 4.0) {
      addBox(whiteParts, 0.75, 18.8, 0.55, sx * 14.8, 11.2, tz);
    }
  }

  // Cantilevered Upper Roof Slab (y = 20.8 .. 22.1m, 94m × 37m)
  addBox(whiteParts, 94.0, 1.3, 37.2, 0, 21.45, 0);

  // Rooftop Slender Ornamental Areca Palms (*Cau cảnh*) in Round White Pots lining East/West roof terrace flanks
  for (const sx of [-1, 1]) {
    for (const tz of [-12.0, -4.0, 4.0, 12.0]) {
      const px = sx * 38.0;
      addCyl(whiteParts, 0.95, 0.72, 1.05, 12, px, 22.62, tz);
      for (let st = -1; st <= 1; st++) {
        const ox = st * 0.24;
        const oz = (st === 0 ? 0.20 : -0.14);
        const hStem = 2.6 + (st === 0 ? 0.65 : 0);
        addColoredCylinder(foliageParts, '#6a7a4e', 0.06, 0.09, hStem, 6, px + ox, 23.15 + hStem * 0.5, tz + oz);
        for (let fr = 0; fr < 5; fr++) {
          const fa = (fr / 5) * Math.PI * 2 + st;
          const frond = new THREE.BoxGeometry(0.18, 0.05, 1.15);
          frond.rotateX(0.42);
          frond.rotateY(fa);
          frond.translate(px + ox + Math.sin(fa) * 0.48, 23.15 + hStem + 0.18, tz + oz + Math.cos(fa) * 0.48);
          foliageParts.push(colorizeGeometry(frond, fr % 2 === 0 ? '#2e7d34' : '#429642'));
        }
      }
    }
  }

  // FIX DL-03: Two Red Bomb-Impact Marker Rings (Ø3.2m, #c83c36) with Red Memorial Text Painted Directly INSIDE Each Ring
  // forward of the UH-1 Huey nose on the Rear T-Wing Rooftop Deck (ref 95_dinh_doc_lap_truc_thang.jpg)!
  const bombCoords: Array<[number, number, string]> = [
    [4.5, 24.5, '8/4/1975'],
    [8.5, 28.0, '8/4/1975']
  ];
  for (const [bx, bz, dateText] of bombCoords) {
    if (typeof document !== 'undefined') {
      const ringCanvas = document.createElement('canvas');
      ringCanvas.width = 256;
      ringCanvas.height = 256;
      const rCtx = ringCanvas.getContext('2d');
      if (rCtx) {
        rCtx.clearRect(0, 0, 256, 256);
        rCtx.strokeStyle = '#c83c36';
        rCtx.lineWidth = 18;
        rCtx.beginPath();
        rCtx.arc(128, 128, 108, 0, Math.PI * 2);
        rCtx.stroke();
        rCtx.fillStyle = '#c83c36';
        rCtx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
        rCtx.textAlign = 'center';
        rCtx.fillText('NƠI BOM NỔ', 128, 114);
        rCtx.fillText(dateText, 128, 152);
      }
      const rTex = new THREE.CanvasTexture(ringCanvas);
      rTex.colorSpace = THREE.SRGBColorSpace;
      const rMat = new THREE.MeshStandardMaterial({
        map: rTex,
        transparent: true,
        alphaTest: 0.25,
        roughness: 0.65
      });
      ctx.extraTextures.push(rTex);
      ctx.extraMaterials.push(rMat);
      const rDisc = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.3), rMat);
      rDisc.rotation.x = -Math.PI * 0.5;
      rDisc.position.set(bx, 22.14, bz);
      group.add(rDisc);
    } else {
      const rSingle = new THREE.RingGeometry(1.5, 1.85, 24);
      rSingle.rotateX(-Math.PI * 0.5);
      rSingle.translate(bx, 22.14, bz);
      crimsonParts.push(rSingle);
    }
  }

  // FIX DL-03: UH-1 Iroquois (Huey) Helicopter with Continuous Organic 3-Tone Military Camo Texture + Tail Number "445" + Standing Info Board!
  const heliX = -1.2;
  const heliY = 22.12;
  const heliZ = 27.2;
  const heliYaw = 0.65;
  const { bodyParts: heliBody, darkParts: heliDark } = createUH1HelicopterParts(heliX, heliY, heliZ, heliYaw, 0.96);
  let camoTex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const camoCanvas = document.createElement('canvas');
    camoCanvas.width = 256;
    camoCanvas.height = 256;
    const cCtx = camoCanvas.getContext('2d');
    if (cCtx) {
      cCtx.fillStyle = '#4a5337';
      cCtx.fillRect(0, 0, 256, 256);
      const blobs: Array<[number, number, number, number, string]> = [
        [42, 54, 66, 38, '#363d2b'],
        [175, 48, 72, 42, '#c8b48e'],
        [115, 138, 84, 48, '#363d2b'],
        [35, 198, 68, 40, '#c8b48e'],
        [205, 192, 64, 42, '#363d2b'],
        [126, 28, 52, 26, '#5c6643']
      ];
      for (const [x, y, rx, ry, col] of blobs) {
        cCtx.fillStyle = col;
        cCtx.beginPath();
        cCtx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2);
        cCtx.fill();
      }
      cCtx.fillStyle = '#f2f2ec';
      cCtx.font = 'bold 42px monospace';
      cCtx.fillText('445', 86, 136);
    }
    camoTex = new THREE.CanvasTexture(camoCanvas);
    camoTex.wrapS = THREE.RepeatWrapping;
    camoTex.wrapT = THREE.RepeatWrapping;
    camoTex.colorSpace = THREE.SRGBColorSpace;
    ctx.extraTextures.push(camoTex);
  }
  const camoMat = new THREE.MeshStandardMaterial({
    color: camoTex ? '#ffffff' : '#4a5337',
    ...(camoTex ? { map: camoTex } : {}),
    roughness: 0.74,
    metalness: 0.12
  });
  ctx.extraMaterials.push(camoMat);
  const heliMesh = new THREE.Mesh(mergeNormalized(heliBody), camoMat);
  heliMesh.name = 'DinhDocLapUH1Huey';
  heliMesh.castShadow = true;
  group.add(heliMesh);
  darkMetalParts.push(...heliDark);

  // Standing white museum info board beside starboard skid (ref 95)
  const heliBoard = createSignagePlaqueMesh(
    { text: 'MÁY BAY UH-1', subText: 'SỐ HIỆU 445', width: 1.25, height: 1.45, style: 'stone', motifSeed: 19753 },
    ctx
  );
  heliBoard.position.set(heliX + 3.2, heliY + 1.05, heliZ + 0.8);
  heliBoard.rotation.y = heliYaw + Math.PI * 0.5;
  group.add(heliBoard);

  // White visibility stripes at both main-rotor blade tips!
  for (const tipSign of [-1, 1]) {
    const tip = new THREE.BoxGeometry(0.85, 0.08, 0.44);
    tip.translate(tipSign * 5.05, 0, 0);
    tip.rotateY(0.42 + heliYaw);
    tip.translate(
      heliX + Math.sin(heliYaw) * 0.24,
      heliY + 3.60 * 0.96,
      heliZ + Math.cos(heliYaw) * 0.24
    );
    whiteParts.push(tip);
  }

  // Rooftop Ceremonial Pavilion (*Tứ Phương Vô Sự*) rising to 26.0m (NO yellow "H" helipad!)
  addBox(voidParts, 34.0, 2.7, 15.0, 0, 23.45, 1.5);
  for (let i = -3; i <= 3; i++) {
    addBox(whiteParts, 0.65, 2.8, 0.65, i * 5.4, 23.5, -6.2);
    addBox(whiteParts, 0.65, 2.8, 0.65, i * 5.4, 23.5, 9.2);
  }
  addBox(whiteParts, 39.0, 1.05, 18.5, 0, 25.47, 1.5);
  // Central axial flagpole completing Ngô Viết Thụ's ideogram "中" (Trung)
  addCyl(whiteParts, 0.11, 0.18, 9.2, 8, 0, 30.6, -5.2);
  const topFinial = new THREE.SphereGeometry(0.24, 10, 8);
  topFinial.translate(0, 35.3, -5.2);
  goldParts.push(topFinial);
  addBox(goldParts, 4.2, 1.4, 0.45, 0, 23.6, -6.3);

  // 4. Red-Carpeted 6m-Tall Entrance Portico, Broad Ceremonial Staircase & Sloped Polygonal Stone Retaining Walls (-Z Front)
  addBox(whiteParts, 22.0, 0.95, 12.0, 0, 7.6, -23.5);
  for (const sx of [-9.2, 9.2]) {
    addBox(whiteParts, 0.95, 6.2, 0.95, sx, 4.2, -28.2);
    addBox(whiteParts, 0.95, 6.2, 0.95, sx, 4.2, -21.0);
  }
  addBox(graniteParts, 19.6, 1.8, 6.2, 0, 0.9, -19.5);
  for (const sx of [-9.4, 9.4]) {
    addBox(graniteParts, 0.95, 1.8, 8.2, sx, 0.9, -22.5);
    // Sloped polygonal stone retaining walls flanking the entrance ramp (ref 29_dinh_doc_lap.jpg)
    addBox(graniteParts, 5.4, 1.55, 1.45, sx * 1.38, 0.78, -19.2, sx * -0.18, 0, sx * -0.12);
    addBox(graniteParts, 4.2, 1.15, 4.6, sx * 1.24, 0.58, -22.6, sx * -0.22);
    addBox(whiteParts, 5.5, 0.18, 1.55, sx * 1.38, 1.58, -19.2, sx * -0.18, 0, sx * -0.12);
  }
  for (let s = 0; s < 6; s++) {
    const stepY = 0.15 + s * 0.28;
    const stepZ = -26.2 + s * 0.9;
    addBox(whiteParts, 17.6, 0.28, 1.0, 0, stepY, stepZ);
    addBox(crimsonParts, 10.5, 0.08, 1.04, 0, stepY + 0.15, stepZ);
  }
  addBox(crimsonParts, 10.5, 0.08, 6.0, 0, 1.84, -18.0);
  addBox(crimsonParts, 9.8, 0.08, 10.0, 0, 0.16, -31.2);

  // 5. Twin 24m Front Flagpoles + Center Rooftop Flagpole with Animated Waving Silk Vietnamese National Flags!
  const palaceFlagMat = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 0.95, showStar: true }).material
    : (() => {
      const res = createWavingSilkFlagMaterial({
        waveScale: 0.95,
        showStar: true
      });
      ctx.extraMaterials.push(res.material);
      ctx.animatedUniforms?.push(res.uniforms);
      return res.material;
    })();
  const palaceFlagMeshes: THREE.Mesh[] = [];

  // Waving Red-and-Gold Vietnamese National Flag mounted onto the CENTER ROOFTOP FLAGPOLE (y = 33.4m, z = -5.2)!
  const centerRoofFlagGeo = new THREE.PlaneGeometry(4.6, 3.0, 22, 12);
  centerRoofFlagGeo.translate(2.3 + 0.12, 0, 0);
  const centerRoofFlagMesh = new THREE.Mesh(centerRoofFlagGeo, palaceFlagMat);
  centerRoofFlagMesh.name = 'IndependencePalaceCenterRoofFlag';
  centerRoofFlagMesh.position.set(0, 33.4, -5.2);
  centerRoofFlagMesh.castShadow = true;
  palaceFlagMeshes.push(centerRoofFlagMesh);

  for (const sx of [-1, 1]) {
    const fx = sx * 36.0;
    const fz = lawnCenterZ - 14.0;
    addBox(whiteParts, 2.4, 1.2, 2.4, fx, 0.5, fz);
    addBox(whiteParts, 1.5, 0.7, 1.5, fx, 1.35, fz);
    addCyl(whiteParts, 0.14, 0.28, 22.8, 12, fx, 12.6, fz);

    const finial = new THREE.SphereGeometry(0.32, 12, 10);
    finial.translate(fx, 24.15, fz);
    goldParts.push(finial);

    const flagGeo = new THREE.PlaneGeometry(5.4, 3.6, 26, 14);
    flagGeo.translate(2.7 + 0.14, 0, 0);
    const flagMesh = new THREE.Mesh(flagGeo, palaceFlagMat);
    flagMesh.name = sx < 0 ? 'IndependencePalaceFlagWest' : 'IndependencePalaceFlagEast';
    flagMesh.position.set(fx, 21.8, fz);
    if (sx > 0) flagMesh.rotation.y = Math.PI;
    flagMesh.castShadow = true;
    palaceFlagMeshes.push(flagMesh);
  }

  const palaceGroundMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04
  });
  const crimsonClothMat = new THREE.MeshStandardMaterial({
    color: '#c81d18',
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  const ironFenceMat = new THREE.MeshStandardMaterial({
    color: '#22262a',
    roughness: 0.44,
    metalness: 0.74
  });
  const militaryArmorMat = new THREE.MeshStandardMaterial({
    color: '#4b593c',
    roughness: 0.62,
    metalness: 0.28
  });
  const darkTreadMat = new THREE.MeshStandardMaterial({
    color: '#26282b',
    roughness: 0.78,
    metalness: 0.35
  });
  const roofFoliageMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.74,
    metalness: 0.06
  });
  ctx.extraMaterials.push(
    palaceGroundMat,
    crimsonClothMat,
    ironFenceMat,
    militaryArmorMat,
    darkTreadMat,
    roofFoliageMat
  );

  const waterMesh = new THREE.Mesh(pondWaterGeo, palaceWaterMat);
  waterMesh.name = 'IndependencePalacePondWater';
  waterMesh.receiveShadow = true;

  const stonePlinthMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(graniteParts), 2.2),
    ctx.materials.granite
  );
  stonePlinthMesh.name = 'IndependencePalaceStonePlinth';
  stonePlinthMesh.castShadow = true;
  stonePlinthMesh.receiveShadow = true;

  group.add(
    makeMergedMesh('IndependencePalaceWhite', whiteParts, whiteMat),
    stonePlinthMesh,
    makeMergedMesh('IndependencePalaceCrimson', crimsonParts, crimsonClothMat),
    makeMergedMesh('IndependencePalaceGlass', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('IndependencePalaceGold', goldParts, ctx.materials.gold),
    makeMergedMesh('IndependencePalaceLawnAndDrive', groundParts, palaceGroundMat, false, true),
    makeMergedMesh('IndependencePalaceIronGates', ironParts, ironFenceMat),
    makeMergedMesh('IndependencePalaceTanksAndHuey', armorParts, militaryArmorMat),
    makeMergedMesh('IndependencePalaceTankTreadsAndRotors', darkMetalParts, darkTreadMat),
    makeMergedMesh('IndependencePalaceRoofTrees', foliageParts, roofFoliageMat),
    makeMergedMesh('IndependencePalaceFountainJets', jetParts, jetMat, false, false),
    waterMesh,
    ...palaceFlagMeshes
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 62.0 }, { x: 0, z: 195, r: 58.0 });
}

// ============================================================================
// 3. Nhà thờ Đức Bà Sài Gòn (108, 190), facing north -Z
//    True 1:1 35.5m × 92m nave, 60.5m twin spires (Bug B14 fixed), 14m crossing flèche,
//    groin vaults, bifora bell windows, Virgin Mary statue, Parisian lamps & 14 pigeons
// ============================================================================
function buildNotreDameSaigon(ctx: VietnamBuilderContext): void {
  const cx = 108;
  const cz = 190;
  const yBase = ctx.getHeight(cx, cz);

  const group = new THREE.Group();
  group.name = 'NotreDameSaigonComplex';
  group.position.set(cx, yBase, cz);

  const brickParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const patinaParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const glowParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const marbleParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const stainedParts: THREE.BufferGeometry[] = [];
  const ironParts: THREE.BufferGeometry[] = [];
  const plazaDecorParts: THREE.BufferGeometry[] = [];

  const whiteMarbleMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

  // 1. Expanded Stone Parvis Terrace (96m long) & Oval Paris Commune Square Front Plaza at (108, 144)
  addBox(stoneParts, 42.0, 0.9, 98.0, 0, -0.05, 11.0);
  const maryZ = -46.0;
  const maryGroundRel = ctx.getHeight(108, 144) - yBase;
  const ovalPlaza = new THREE.CylinderGeometry(16.5, 17.0, 0.52, 32);
  ovalPlaza.scale(1.12, 1.0, 0.92);
  ovalPlaza.translate(0, maryGroundRel - 0.14, maryZ);
  stoneParts.push(ovalPlaza);

  // 4 Quartered Flower Beds framing Paris Commune Square around Virgin Mary statue
  const flowerCols = ['#d92b4b', '#f2a922', '#e86898', '#f5e26b'];
  for (let q = 0; q < 4; q++) {
    const qa = (q / 4) * Math.PI * 2 + Math.PI * 0.25;
    const fx = Math.cos(qa) * 10.6;
    const fz = maryZ + Math.sin(qa) * 9.0;
    addBox(stoneParts, 4.6, 0.42, 2.8, fx, maryGroundRel + 0.18, fz, -qa);
    addColoredBox(plazaDecorParts, '#2f7a32', 4.2, 0.36, 2.4, fx, maryGroundRel + 0.38, fz, -qa);
    for (let fl = -1; fl <= 1; fl++) {
      addColoredSphere(
        plazaDecorParts,
        flowerCols[(q + fl + 4) % flowerCols.length],
        0.34,
        6,
        5,
        fx + Math.cos(-qa) * fl * 1.15,
        maryGroundRel + 0.68,
        fz - Math.sin(-qa) * fl * 1.15,
        1.1,
        0.7,
        1.1
      );
    }
  }

  // 8 Parisian Wrought-Iron Streetlamps + Wooden Park Benches surrounding the Front Plaza
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI * 0.125;
    const lx = Math.cos(a) * 14.8;
    const lz = maryZ + Math.sin(a) * 12.6;
    addHeritageStreetlampParts(ironParts, glowParts, lx, maryGroundRel + 0.12, lz, 4.4, false);
  }
  for (const sx of [-1, 1]) {
    addBox(woodParts, 0.65, 0.48, 2.6, sx * 12.2, maryGroundRel + 0.36, maryZ);
    addBox(woodParts, 0.14, 0.56, 2.6, sx * 12.5, maryGroundRel + 0.72, maryZ);
  }

  // 14 White Sculpted Pigeons gathering & pecking around the Virgin Mary plaza!
  const pigRand = mulberry32(30144);
  for (let p = 0; p < 14; p++) {
    const pa = (p / 14) * Math.PI * 2 + pigRand() * 0.35;
    const pr = 5.4 + pigRand() * 7.2;
    const px = Math.cos(pa) * pr;
    const pz = maryZ + Math.sin(pa) * pr * 0.85;
    const py = maryGroundRel + 0.24;
    const pyaw = pigRand() * Math.PI * 2;
    const pBody = new THREE.SphereGeometry(0.14, 7, 5);
    pBody.scale(0.85, 0.82, 1.45);
    transformGeo(pBody, px, py + 0.12, pz, pyaw);
    const pHead = new THREE.SphereGeometry(0.075, 6, 5);
    pHead.translate(0, 0.22, 0.15);
    transformGeo(pHead, px, py, pz, pyaw);
    const pTail = new THREE.ConeGeometry(0.06, 0.20, 5);
    pTail.rotateX(-1.15);
    pTail.translate(0, 0.12, -0.20);
    transformGeo(pTail, px, py, pz, pyaw);
    marbleParts.push(pBody, pHead, pTail);
  }

  // Upgraded Tượng Đức Mẹ Hòa Bình (*Our Lady of Peace* — ref 61_nha_tho_duc_ba_rose_window_statue.jpg)
  // Octagonal stone steps + Polished Red-Brown Circular Granite Column (#7a3426) + Verdigris Bronze Floral Collar + Curved Bronze Plaque
  for (const side of [-1, 1]) {
    addBox(marbleParts, 9.6, 0.38, 0.44, 0, maryGroundRel + 0.22, maryZ + side * 4.6);
    addBox(marbleParts, 0.44, 0.38, 9.6, side * 4.6, maryGroundRel + 0.22, maryZ);
  }
  // FIX ND-05: White Carrara marble octagonal base steps + globe & brass cross held in Virgin Mary's hands (ref 61!)
  addCyl(marbleParts, 2.55, 2.70, 0.36, 8, 0, maryGroundRel + 0.20, maryZ);
  addCyl(marbleParts, 1.92, 2.08, 0.36, 8, 0, maryGroundRel + 0.56, maryZ);
  // Polished Red-Brown Circular Granite Column Pedestal (y = 0.74 .. 2.86m)
  addColoredCylinder(plazaDecorParts, '#682b20', 0.96, 1.06, 0.26, 20, 0, maryGroundRel + 0.87, maryZ);
  addColoredCylinder(plazaDecorParts, '#7a3426', 0.74, 0.80, 1.68, 22, 0, maryGroundRel + 1.84, maryZ);
  // Verdigris bronze sculpted floral capital collar crowning the circular granite column
  addColoredCylinder(plazaDecorParts, '#3f7c6b', 0.88, 0.76, 0.26, 16, 0, maryGroundRel + 2.74, maryZ);
  addCyl(marbleParts, 0.94, 0.86, 0.16, 18, 0, maryGroundRel + 2.92, maryZ);

  const maryPlaque = createSignagePlaqueMesh(
    {
      text: 'REGINA PACIS',
      subText: 'ORA PRO NOBIS',
      style: 'bronze',
      width: 1.12,
      height: 0.58,
      depth: 0.08,
      motifSeed: 1959
    },
    ctx
  );
  maryPlaque.name = 'NotreDameReginaPacisPlaque';
  maryPlaque.position.set(0, maryGroundRel + 1.86, maryZ - 0.78);
  maryPlaque.rotation.y = Math.PI;
  group.add(maryPlaque);

  // Sculpted White Marble Virgin Mary holding Globe & Cross — skipHalo: true (no golden ring behind head!)
  const { bodyParts: maryBody, accentParts: maryAccent } = createSculptedDeityParts(
    0,
    maryGroundRel + 3.00,
    maryZ,
    Math.PI,
    0.84,
    'virgin_mary',
    { skipHalo: true }
  );
  marbleParts.push(...maryBody);
  // Sculpted Marble Globe of the World & Slender Upright Cross held cleanly in front of Our Lady of Peace (ND-05!)
  marbleParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(0, maryGroundRel + 4.22, maryZ - 0.38));
  goldParts.push(
    new THREE.BoxGeometry(0.045, 0.42, 0.045).translate(0, maryGroundRel + 4.62, maryZ - 0.38),
    new THREE.BoxGeometry(0.26, 0.045, 0.045).translate(0, maryGroundRel + 4.70, maryZ - 0.38)
  );
  goldParts.push(...maryAccent);

  // 2. Main Romanesque-Gothic Nave & Side Aisles extended to TRUE 1:1 92.0m length (z in [-33.5 .. +58.5])
  // EXPANDED HOLLOW WALK-IN CATHEDRAL NAVE (10 full bays, 50m deep walk-in sanctuary z in [-31.5 .. +18.5] — ref 120_nha_tho_duc_ba_long_giao_duong.jpg!)
  addBox(brickParts, 19.5, 21.0, 31.0, 0, 10.7, 33.5);
  for (const sx of [-1, 1]) {
    addBox(brickParts, 0.9, 21.0, 50.0, sx * 9.3, 10.7, -6.5);
    // 2nd-Story Triforium Upper Arcade Gallery Beam & Double-Arch Triforium Openings above Nave Piers (ref 120!)
    addBox(stoneParts, 0.75, 0.48, 48.0, sx * 5.6, 11.2, -6.5);
    addBox(stoneParts, 0.65, 0.42, 48.0, sx * 5.6, 15.8, -6.5);
  }
  addBox(stoneParts, 19.4, 0.55, 50.2, 0, 20.85, -6.5);
  // Geometric 3D Diamond/Cube-Patterned Tile Nave Central Aisle Runner (ref 120!)
  addBox(stoneParts, 4.4, 0.08, 48.0, 0, 0.44, -6.5);
  for (let tileZ = -28.0; tileZ <= 14.0; tileZ += 1.6) {
    addBox(marbleParts, 1.05, 0.09, 1.05, -0.85, 0.45, tileZ, Math.PI * 0.25);
    addBox(marbleParts, 1.05, 0.09, 1.05, 0.85, 0.45, tileZ, Math.PI * 0.25);
  }

  const stainedPalette = ['#3a78d8', '#e6a832', '#c83434', '#2e9e7a'];
  for (let bay = 0; bay < 10; bay++) {
    const bz = -28.0 + bay * 4.6;
    // Ribbed Groin Vault Arches inside the expanded 10-bay hollow walk-in nave ceiling (painted warm terracotta-brown ribs per ref 120!)
    const transArch = new THREE.TorusGeometry(5.6, 0.24, 7, 18, Math.PI);
    transArch.scale(1.0, 0.62, 1.0);
    transArch.translate(0, 17.1, bz);
    brickParts.push(transArch);

    if (bay < 9) {
      const bayMidZ = bz + 2.3;
      const diagSpan = Math.hypot(5.6, 2.3);
      for (const diagSign of [-1, 1]) {
        const rib = new THREE.TorusGeometry(diagSpan, 0.16, 6, 14, Math.PI);
        rib.scale(1.0, 0.56, 1.0);
        rib.rotateY(diagSign * Math.atan2(2.3, 5.6));
        rib.translate(0, 17.1, bayMidZ);
        brickParts.push(rib);
      }
      // Vault boss keystone medallion at crossing of diagonal groin ribs
      const boss = new THREE.SphereGeometry(0.32, 8, 6);
      boss.translate(0, 20.38, bayMidZ);
      goldParts.push(boss);
      // Lower Nave Arcade Arch + Upper Triforium Twin Colonnettes spanning between adjacent piers (ref 120!)
      for (const sx of [-1, 1]) {
        const arcadeArch = new THREE.TorusGeometry(2.15, 0.22, 6, 12, Math.PI);
        arcadeArch.rotateY(Math.PI * 0.5);
        arcadeArch.translate(sx * 5.6, 8.2, bayMidZ);
        stoneParts.push(arcadeArch);
        for (const tzOff of [-0.75, 0.75]) {
          addCyl(brickParts, 0.11, 0.13, 3.8, 7, sx * 5.6, 13.5, bayMidZ + tzOff);
        }
      }
    }

    for (const sx of [-1, 1]) {
      // White Romanesque nave piers + engaged brown-terracotta vaulting shafts climbing up to the groin vaults (ref 120!)
      addBox(stoneParts, 1.15, 0.72, 1.15, sx * 5.6, 0.76, bz);
      addCyl(stoneParts, 0.42, 0.46, 10.2, 12, sx * 5.6, 6.1, bz);
      addCyl(brickParts, 0.16, 0.18, 16.4, 8, sx * 5.12, 9.3, bz);
      addBox(stoneParts, 1.18, 0.58, 1.18, sx * 5.6, 17.75, bz);
      // Interior Chartres stained-glass lancet windows
      addColoredBox(stainedParts, stainedPalette[bay % stainedPalette.length], 0.22, 5.4, 1.65, sx * 8.75, 9.2, bz);
      if (bay < 8) {
        addBox(woodParts, 3.6, 0.92, 0.65, sx * 3.1, 0.86, bz + 1.4);
        addBox(woodParts, 3.6, 0.14, 0.55, sx * 3.1, 0.68, bz + 1.05);
      }
    }
  }

  // Carved Monolithic White-Marble High Altar (*Bàn Thờ Đá Cẩm Thạch*), Golden Tabernacle, Cross & 6 Candles (shifted cleanly to deep sanctuary z = +14.5!)
  const altarZ = 14.5;
  addBox(marbleParts, 9.2, 0.52, 5.4, 0, 0.66, altarZ);
  addBox(marbleParts, 7.6, 0.45, 4.0, 0, 1.14, altarZ + 0.4);
  addBox(marbleParts, 4.4, 1.25, 1.45, 0, 1.98, altarZ + 0.8);
  addBox(goldParts, 3.6, 0.68, 0.12, 0, 1.96, altarZ + 0.06);
  addBox(goldParts, 0.95, 1.25, 0.85, 0, 3.22, altarZ + 1.05);
  addBox(goldParts, 0.22, 3.2, 0.22, 0, 5.45, altarZ + 1.65);
  addBox(goldParts, 1.85, 0.22, 0.22, 0, 6.25, altarZ + 1.65);
  for (const cxOff of [-1.8, -1.25, -0.7, 0.7, 1.25, 1.8]) {
    addCyl(goldParts, 0.06, 0.10, 0.68, 8, cxOff, 2.94, altarZ + 0.85);
    glowParts.push(new THREE.SphereGeometry(0.11, 8, 8).translate(cxOff, 3.38, altarZ + 0.85));
  }
  // Carved Oak Pulpit (*Bục Giảng*) & Side Devotional Chapels with Votive Candle Stands (ref 120!)
  addCyl(woodParts, 0.65, 0.42, 1.65, 8, -4.8, 1.45, 6.5);
  addCyl(woodParts, 0.04, 0.85, 0.55, 8, -4.8, 3.65, 6.5);
  for (const sx of [-1, 1]) {
    addBox(marbleParts, 1.85, 1.15, 0.95, sx * 7.4, 0.98, 11.5);
    addCyl(marbleParts, 0.24, 0.28, 1.45, 8, sx * 7.4, 2.25, 11.5);
    // 14 Stations of the Cross (*Chặng Đàng Thánh Giá*) bronze relief frames along both nave side walls
    for (let st = 0; st < 7; st++) {
      const stZ = -24.5 + st * 5.8;
      addBox(goldParts, 0.14, 0.92, 0.72, sx * 8.45, 3.65, stZ);
    }
  }
  // Grand Pipe Organ Loft (*Đàn Đại Phong Cầm*) at South Gallery (z = -28.5, y = 9.5) + 4 Hanging Golden Sanctuary Lamps along Nave Axis
  addBox(woodParts, 9.6, 0.45, 4.2, 0, 9.2, -28.5);
  addBox(woodParts, 7.2, 3.4, 1.25, 0, 11.2, -29.6);
  for (let p = -5; p <= 5; p++) {
    const pipeH = 3.6 - Math.abs(p) * 0.22;
    addCyl(goldParts, 0.08, 0.08, pipeH, 6, p * 0.56, 11.6 + pipeH * 0.5, -28.9);
  }
  for (const lampZ of [-18.5, -8.5, 1.5, 9.5]) {
    addCyl(goldParts, 0.03, 0.03, 4.8, 5, 0, 14.8, lampZ);
    addCyl(goldParts, 0.42, 0.24, 0.55, 8, 0, 12.15, lampZ);
    glowParts.push(new THREE.SphereGeometry(0.18, 7, 6).translate(0, 11.85, lampZ));
  }
  const naveAltarLight = new THREE.PointLight('#ffdca0', 3.0, 36, 1.3);
  naveAltarLight.position.set(0, 7.2, 6.5);
  group.add(naveAltarLight);

  // Flanking side aisles extending cleanly along the 92m cathedral length (z in [-29..+45])
  for (const sx of [-1, 1]) {
    addBox(brickParts, 8.0, 13.6, 74.0, sx * 13.75, 7.0, 8.0);
    const aisleRoof = createHippedRoofGeometry(8.4, 75.0, 1.5, 69.0, 3.2);
    aisleRoof.translate(sx * 13.75, 13.8, 8.0);
    roofParts.push(aisleRoof);
  }
  // Transept crossing (41.0m wide × 20.5m tall × 15.0m deep at z = +24.0)
  const transeptZ = 24.0;
  addBox(brickParts, 41.0, 20.5, 15.0, 0, 10.45, transeptZ);
  // Polygonal Apse at rear (+Z, centered at z = +49.3, r = 9.2 => reaches z = +58.5 => exact 92.0m length!)
  addCyl(brickParts, 9.2, 9.2, 20.2, 8, 0, 10.3, 49.3);
  const apseRoof = new THREE.ConeGeometry(9.6, 6.8, 8);
  apseRoof.translate(0, 20.4 + 3.4, 49.3);
  roofParts.push(apseRoof);

  // Side Nave Buttresses & Arched Side Lancet Windows with White Stone Trim!
  for (const sx of [-1, 1]) {
    for (let z = -25.0; z <= 42.0; z += 7.4) {
      addBox(brickParts, 1.45, 19.6, 1.45, sx * 17.65, 9.95, z);
      addBox(stoneParts, 1.65, 0.35, 1.65, sx * 17.65, 13.8, z);
      if (z < 39.0) {
        const wz = z + 3.7;
        // Lower aisle arched lancet window with white stone frame & semicircular arch head
        const lowWinFrame = createArchedWallGeometry(3.4, 6.4, 0.45, 2.2, 5.6);
        lowWinFrame.rotateY(sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        lowWinFrame.translate(sx * 17.92, 4.8, wz);
        stoneParts.push(lowWinFrame);
        addBox(glowParts, 0.24, 5.1, 2.0, sx * 17.85, 7.45, wz);
        // Upper clerestory arched lancet window with white stone arch molding
        const hiWinFrame = createArchedWallGeometry(2.8, 4.6, 0.42, 1.8, 4.0);
        hiWinFrame.rotateY(sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        hiWinFrame.translate(sx * 9.95, 14.9, wz);
        stoneParts.push(hiWinFrame);
        addBox(glowParts, 0.24, 3.6, 1.65, sx * 9.88, 16.8, wz);
      }
    }
  }

  // Main Pitched Dark Slate Nave & Transept Roofs (above 21.0m vault up to 28.8m ridge)
  const naveRoof = createHippedRoofGeometry(20.8, 82.0, 0.6, 73.0, 7.8);
  naveRoof.translate(0, 21.2, 8.5);
  roofParts.push(naveRoof);

  const transeptRoof = createHippedRoofGeometry(42.0, 16.0, 34.0, 0.6, 6.8);
  transeptRoof.translate(0, 20.7, transeptZ);
  roofParts.push(transeptRoof);

  // Central Crossing Flèche Roof Turret (14.0m tall, rising from y = 28.4m to 42.4m above transept crossing!)
  const flecheBaseY = 28.4;
  addCyl(patinaParts, 1.75, 2.15, 2.2, 8, 0, flecheBaseY + 1.1, transeptZ);
  for (let i = 0; i < 8; i++) {
    const fa = (i / 8) * Math.PI * 2;
    addCyl(patinaParts, 0.14, 0.14, 3.2, 6, Math.cos(fa) * 1.45, flecheBaseY + 3.8, transeptZ + Math.sin(fa) * 1.45);
  }
  addCyl(glowParts, 1.05, 1.05, 2.8, 8, 0, flecheBaseY + 3.8, transeptZ);
  const flecheSpire = new THREE.ConeGeometry(1.72, 6.8, 8);
  flecheSpire.translate(0, flecheBaseY + 8.8, transeptZ);
  patinaParts.push(flecheSpire);
  // Golden cross atop flèche reaching 42.4m (14.0m above ridge!)
  addBox(goldParts, 0.16, 1.9, 0.16, 0, flecheBaseY + 13.05, transeptZ);
  addBox(goldParts, 1.15, 0.16, 0.16, 0, flecheBaseY + 13.38, transeptZ);

  // 3. Front Facade (-Z at z = -33.5): FIX ND-03 Ground-floor weathered yellow-brown sandstone portal + recessed closed dark-oak arched doors (ref 96)
  const frontZ = -33.5;
  const centerPortal = createArchedWallGeometry(12.2, 11.2, 3.2, 6.2, 9.0);
  centerPortal.rotateY(Math.PI);
  centerPortal.translate(0, 0.2, frontZ - 1.2);
  stoneParts.push(centerPortal);
  // Carved Portal Tympanum Arch & Lintel (DELETED clipping centerGableTri!)
  const centerTympArch = new THREE.TorusGeometry(3.25, 0.26, 8, 20, Math.PI);
  centerTympArch.translate(0, 6.1, frontZ - 2.86);
  const centerTympLintel = new THREE.BoxGeometry(6.6, 0.42, 0.42);
  centerTympLintel.translate(0, 6.1, frontZ - 2.84);
  stoneParts.push(centerTympArch, centerTympLintel);
  // Closed recessed dark-oak cathedral double portal doors nested cleanly inside the sandstone arch (ref 96)
  for (const sx of [-1, 1]) {
    addBox(woodParts, 2.85, 6.1, 0.24, sx * 1.48, 3.25, frontZ - 1.95);
  }

  // Central Upper Facade Wall (y = 11.4 .. 23.8m) + Clean Extruded Triangular Central Gable (y = 23.8 .. 30.2m)
  addBox(brickParts, 12.6, 12.6, 2.8, 0, 17.6, frontZ - 0.8);
  addBox(stoneParts, 13.2, 0.50, 3.3, 0, 11.35, frontZ - 0.9);
  addBox(stoneParts, 13.2, 0.45, 3.1, 0, 15.65, frontZ - 0.9);
  addBox(stoneParts, 13.2, 0.55, 3.2, 0, 23.85, frontZ - 0.9);

  // Extruded triangular central gable brick wall + white stone raking cornice edges
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-6.3, 0);
  gableShape.lineTo(6.3, 0);
  gableShape.lineTo(0, 6.4);
  gableShape.closePath();
  const centerGable = new THREE.ExtrudeGeometry(gableShape, { depth: 2.6, bevelEnabled: false });
  centerGable.translate(0, 23.85, frontZ - 2.1);
  brickParts.push(centerGable);
  // White stone gable raking cornice moldings & summit cross
  const rakeLen = Math.hypot(6.6, 6.6);
  const rakePitch = Math.atan2(6.4, 6.3);
  for (const sx of [-1, 1]) {
    addBox(stoneParts, rakeLen, 0.36, 3.05, sx * 3.2, 27.15, frontZ - 0.85, 0, 0, -sx * rakePitch);
  }
  // FIX ND-06: Ornate trefoil-ended central gable summit cross & dark wrought-iron bezel around gable facade clock (ref 30 & 96!)
  addBox(stoneParts, 0.24, 1.48, 0.24, 0, 30.92, frontZ - 0.85);
  addBox(stoneParts, 0.96, 0.22, 0.22, 0, 31.18, frontZ - 0.85);
  for (const [cxOff, cyOff] of [[0, 31.68], [-0.52, 31.18], [0.52, 31.18]]) {
    stoneParts.push(new THREE.SphereGeometry(0.15, 6, 5).translate(cxOff, cyOff, frontZ - 0.85));
  }
  const crossHalo = new THREE.TorusGeometry(0.32, 0.055, 5, 12);
  crossHalo.translate(0, 31.18, frontZ - 0.85);
  stoneParts.push(crossHalo);

  // 3 Narrow Romanesque Arched Windows directly below the Rose Window (y = 11.6 .. 15.3m — ref 96)
  for (const wx of [-2.85, 0, 2.85]) {
    const narrowFrame = createArchedWallGeometry(2.15, 3.6, 0.36, 1.35, 3.1);
    narrowFrame.rotateY(Math.PI);
    narrowFrame.translate(wx, 11.7, frontZ - 2.24);
    stoneParts.push(narrowFrame);
    addBox(glowParts, 1.25, 2.85, 0.22, wx, 13.15, frontZ - 2.12);
  }

  // Iconic Circular Rose Window (y = 19.6m) with Authentic Saigon Romanesque Tracery (1 center + 8 satellite circles!)
  const roseY = 19.65;
  const roseZ = frontZ - 2.26;
  const roseBackGlow = new THREE.CylinderGeometry(3.05, 3.05, 0.22, 28);
  roseBackGlow.rotateX(Math.PI * 0.5);
  roseBackGlow.translate(0, roseY, roseZ + 0.14);
  glowParts.push(roseBackGlow);

  const roseTracery = createRoseWindowGeometry(3.15, 8, 0.32, 'romanesque_8');
  roseTracery.translate(0, roseY, roseZ - 0.08);
  stoneParts.push(roseTracery);

  // Circular White Facade Clock in Triangular Central Gable Apex with authentic dark wrought-iron rim (ND-06!)
  addClockDial(marbleParts, ironParts, voidParts, 0, 25.55, frontZ - 2.22, 1.28, Math.PI);

  // 4. Twin Symmetrical 4-Tier Red-Brick Bell Towers (57.6m pale zinc spires, 60.5m with gleaming brass crosses!)
  for (const sx of [-1, 1]) {
    const tx = sx * 10.4;
    const tz = frontZ - 0.6;

    // Tier 1 (y = 0.2 .. 11.2m): Romanesque arched side portal + Carved Stone Tympanum
    const sidePortal = createArchedWallGeometry(8.6, 11.2, 2.8, 4.4, 8.8);
    sidePortal.rotateY(Math.PI);
    sidePortal.translate(tx, 0.2, tz - 2.4);
    brickParts.push(sidePortal);
    addBox(voidParts, 4.1, 8.4, 1.6, tx, 4.4, tz - 0.8);

    const sideTymp = new THREE.TorusGeometry(2.35, 0.22, 7, 18, Math.PI);
    sideTymp.translate(tx, 6.8, tz - 3.84);
    const sideLintel = new THREE.BoxGeometry(4.8, 0.36, 0.36);
    sideLintel.translate(tx, 6.8, tz - 3.82);
    stoneParts.push(sideTymp, sideLintel);

    // Main brick belfry tower shaft rising to y = 36.6m (7.6m × 7.6m)
    addBox(brickParts, 7.6, 36.4, 7.6, tx, 18.4, tz);

    for (const bx of [-3.6, 3.6]) {
      for (const bz of [-3.6, 3.6]) {
        addBox(brickParts, 1.15, 36.0, 1.15, tx + bx, 18.2, tz + bz);
      }
    }

    // 4-Tier Stone Cornice Rings (Tiers 1, 2, 3, 4 at y = 11.3, 19.5, 28.0, 36.5m)
    addBox(stoneParts, 8.4, 0.50, 8.4, tx, 11.3, tz);
    addBox(stoneParts, 8.4, 0.50, 8.4, tx, 19.5, tz);
    addBox(stoneParts, 8.5, 0.55, 8.5, tx, 28.0, tz);
    addBox(stoneParts, 8.8, 0.75, 8.8, tx, 36.5, tz);

    // Tier 2 (y = 11.6 .. 19.2m): Paired Narrow Romanesque Arched Windows on all 4 faces
    for (const faceRot of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
      for (const lx of [-1.25, 1.25]) {
        const t2Win = createArchedWallGeometry(2.0, 5.2, 0.34, 1.2, 4.4);
        t2Win.translate(lx, 12.6, 3.92);
        t2Win.rotateY(faceRot);
        t2Win.translate(tx, 0, tz);
        stoneParts.push(t2Win);
      }
    }
    addBox(voidParts, 3.6, 4.6, 7.72, tx, 15.0, tz);
    addBox(voidParts, 7.72, 4.6, 3.6, tx, 15.0, tz);

    // Tier 3 (y = 19.8 .. 27.6m): Twin Arches + Top Oculus nested under Cream Stone Relieving Arch (ref 30 & 96)
    for (const faceRot of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
      const relievingArch = createArchedWallGeometry(5.0, 6.8, 0.42, 3.8, 6.1);
      relievingArch.translate(0, 20.4, 3.92);
      relievingArch.rotateY(faceRot);
      relievingArch.translate(tx, 0, tz);
      stoneParts.push(relievingArch);

      // Central stone mullion colonnette dividing the twin arches
      const mullion = new THREE.CylinderGeometry(0.14, 0.16, 3.8, 8);
      mullion.translate(0, 22.3, 3.96);
      mullion.rotateY(faceRot);
      mullion.translate(tx, 0, tz);
      stoneParts.push(mullion);

      // Circular stone oculus medallion tucked in the spandrel above the twin arches
      const oculus = new THREE.TorusGeometry(0.56, 0.12, 6, 16);
      oculus.translate(0, 25.2, 3.98);
      oculus.rotateY(faceRot);
      oculus.translate(tx, 0, tz);
      stoneParts.push(oculus);
    }
    addBox(voidParts, 3.6, 5.6, 7.76, tx, 23.3, tz);
    addBox(voidParts, 7.76, 5.6, 3.6, tx, 23.3, tz);

    // FIX ND-04: Tier 4 Belfry (y = 28.4 .. 36.0m) — Authentic TWIN slender paired Romanesque lancets per face (ref 30, 96!)
    // separated by a central stone mullion pier (replacing the single overly-wide 3.5m arch!)
    for (const faceRot of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
      for (const sOff of [-1.22, 1.22]) {
        const lancet = createArchedWallGeometry(2.36, 6.8, 0.40, 1.48, 5.7);
        lancet.translate(sOff, 28.8, 3.92);
        lancet.rotateY(faceRot);
        lancet.translate(tx, 0, tz);
        stoneParts.push(lancet);
      }
      // Central slender sandstone mullion dividing the twin belfry arches
      const belfryMullion = new THREE.BoxGeometry(0.44, 6.8, 0.54);
      belfryMullion.translate(0, 32.2, 3.92);
      belfryMullion.rotateY(faceRot);
      belfryMullion.translate(tx, 0, tz);
      stoneParts.push(belfryMullion);
    }
    addBox(voidParts, 4.1, 6.0, 7.76, tx, 31.9, tz);
    addBox(voidParts, 7.76, 6.0, 4.1, tx, 31.9, tz);
    // 8 Dense angled dark-timber louver slats filling each twin Tier 4 belfry opening
    for (let l = -3; l <= 4; l++) {
      const ly = 31.55 + l * 0.68;
      addBox(woodParts, 4.05, 0.14, 7.82, tx, ly, tz, 0, 0.36, 0);
      addBox(woodParts, 7.82, 0.14, 4.05, tx, ly, tz, 0, 0, 0.36);
    }

    // Pale Zinc/Slate Silver-Grey 4-Sided Square Spire (facets = 4 rotated 45° — ref 30, 96!)
    const spireGeo = createGothicSpireGeometry(7.6, 22.82, 4, { skipCross: true, skipPinnacles: true });
    spireGeo.rotateY(Math.PI * 0.25);
    spireGeo.translate(tx, 36.6, tz);
    patinaParts.push(spireGeo);

    // 4 Larger Pointed Dormer Lucarnes lowered to sit FLUSH right at the spire base (y = 37.9m — ref 30)!
    for (let d = 0; d < 4; d++) {
      const da = (d / 4) * Math.PI * 2;
      const dx = tx + Math.cos(da) * 3.45;
      const dz = tz + Math.sin(da) * 3.45;
      addBox(patinaParts, 1.48, 2.55, 1.75, dx, 37.95, dz, -da + Math.PI * 0.5);
      addBox(voidParts, 0.88, 1.75, 1.82, dx, 37.85, dz, -da + Math.PI * 0.5);
      const lucRoof = new THREE.ConeGeometry(1.18, 2.25, 4);
      lucRoof.rotateY(Math.PI * 0.25 - da);
      lucRoof.translate(dx, 40.32, dz);
      patinaParts.push(lucRoof);
    }

    // Gleaming brass/gold cross rising cleanly from 57.6m spire tip to 60.5m!
    const apexOrb = new THREE.SphereGeometry(0.36, 10, 8);
    apexOrb.translate(tx, 57.62, tz);
    goldParts.push(apexOrb);
    addBox(goldParts, 0.22, 2.9, 0.22, tx, 59.05, tz);
    addBox(goldParts, 1.75, 0.22, 0.22, tx, 59.55, tz);
  }

  // Pale Zinc/Slate Silver-Grey (#b5bac0) for Saigon Notre-Dame's authentic twin spires (NO green copper patina!)
  const zincSpireMat = new THREE.MeshStandardMaterial({
    color: '#b5bac0',
    roughness: 0.42,
    metalness: 0.38
  });
  const stainedGlassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color('#384a68'),
    emissiveIntensity: 0.08,
    roughness: 0.24
  });
  const parisIronMat = new THREE.MeshStandardMaterial({
    color: '#20262a',
    roughness: 0.40,
    metalness: 0.78
  });
  const plazaDecorMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.08
  });
  ctx.extraMaterials.push(zincSpireMat, stainedGlassMat, parisIronMat, plazaDecorMat);

  const marseilleBrickMat = ctx.materials.marseilleBrick ?? ctx.materials.chamBrick;
  const brickMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brickParts), 2.4), marseilleBrickMat);
  brickMesh.name = 'NotreDameBrickBody';
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  // Static warm stained glass for Rose Window & side windows (ZERO lanternSilk wind sway!)
  const staticGlassMat = ctx.materials.stainedGlass ?? ctx.materials.gold;

  group.add(
    brickMesh,
    makeMergedMesh('NotreDameSlateRoof', roofParts, ctx.materials.darkRoof),
    makeMergedMesh('NotreDamePatinaSpires', patinaParts, zincSpireMat),
    makeMergedMesh('NotreDameGoldCrosses', goldParts, ctx.materials.gold),
    makeMergedMesh('NotreDameRoseWindowGlow', glowParts, staticGlassMat, false, false),
    makeMergedMesh('NotreDameStoneParvis', stoneParts, ctx.materials.stone),
    makeMergedMesh('NotreDameVirginMaryMarble', marbleParts, whiteMarbleMat),
    makeMergedMesh('NotreDameVoidPortals', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('NotreDameNaveWoodPews', woodParts, ctx.materials.darkWood),
    makeMergedMesh('NotreDameStainedGlass', stainedParts, stainedGlassMat, false, false),
    makeMergedMesh('NotreDameParisianIron', ironParts, parisIronMat),
    makeMergedMesh('NotreDamePlazaFlowerBeds', plazaDecorParts, plazaDecorMat)
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz + 6.0, r: 54.0 }, { x: 108, z: 146, r: 17.0 });
}

// ============================================================================
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
  welcomeSign.position.set(wbx, wby + 2.12, wbz);
  welcomeSign.rotation.y = Math.PI;
  group.add(welcomeSign);

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

  // 5. Wrecked M41 Walker Bulldog Tank resting in the forest clearing at (-23.0, +11.5) — angular turret distinct from T-54B!
  const tkx = -23.0;
  const tkz = 11.5;
  const tky = relY(tkx, tkz);
  const { armorParts: m41Armor, darkParts: m41Dark } = createAngularTankParts(tkx, tky - 0.12, tkz, 0.72, 0.92, 0.12);
  tankArmorParts.push(...m41Armor);
  tankDarkParts.push(...m41Dark);

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
  // Horizontal Hoàng Cầm smoke-dispersing earthen flues venting low to the ground
  addColoredCylinder(natureParts, '#7a6345', 0.11, 0.11, 3.2, 7, sx + 3.4, sy + 0.16, sz + 0.4, 0, 0, Math.PI * 0.5);
  addColoredCylinder(natureParts, '#7a6345', 0.11, 0.11, 2.6, 7, sx + 2.8, sy + 0.16, sz - 0.9, 0.55, 0, Math.PI * 0.5);

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
    // Recessed dark doorway/window openings on all 4 faces
    addBox(voidParts, 2.6, 2.05, 6.95, bx, fy + 1.45, bz);
    addBox(voidParts, 6.95, 2.05, 2.6, bx, fy + 1.45, bz);

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
  const hallRoof2 = createVietnameseCurvedRoofGeometry(14.8, 7.8, 8.0, 0.6, 2.8, 0.45);
  hallRoof2.translate(mhx, mhy + 9.2, mhz);
  roofParts.push(hallRoof1, hallRoof2);
  const hallFinials = createRoofFinialSetParts(mhx, mhy + 12.0, mhz, 8.0, 0, 1.05, true);
  crimsonParts.push(...hallFinials.mainParts);
  goldParts.push(...hallFinials.goldParts);

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

  const cuChiNatureMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.04
  });
  const m41RustedMat = new THREE.MeshStandardMaterial({
    color: '#52573d',
    roughness: 0.78,
    metalness: 0.24
  });
  const m41CharredMat = new THREE.MeshStandardMaterial({
    color: '#2b2623',
    roughness: 0.88,
    metalness: 0.22
  });
  ctx.extraMaterials.push(cuChiNatureMat, m41RustedMat, m41CharredMat);

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
    makeMergedMesh('CuChiWreckedM41Tracks', tankDarkParts, m41CharredMat)
  );

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
  // Carved pale sandstone horizontal frieze molding & 4 sandstone corner acroteria flanking main Kalan
  addBox(sandstoneParts, 8.5, 0.28, 8.5, 0, 9.65, 1.5);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      sandstoneParts.push(new THREE.ConeGeometry(0.32, 0.85, 4).translate(sx * 3.85, 10.22, 1.5 + sz * 3.85));
    }
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

  // Central Mandapa Ceremonial Offering Altar, 4th Bronze Censer, Cham Inscription Stele & Pilgrim Lanterns
  addBox(sandstoneParts, 2.2, 0.88, 1.45, 0, mandapaTopY + 0.68, mandapaZ);
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

  // FIX PN-05: Sun-weathered Nha Trang coastal burnt-terracotta Cham brick (#c26242) with crisp contrast on Mandapa & Kalan (ref 32, 98)
  const poNagarBrickMat = new THREE.MeshStandardMaterial({
    color: '#c26242',
    map: ctx.pbr.chamBrick?.map,
    normalMap: ctx.pbr.chamBrick?.normalMap,
    roughnessMap: ctx.pbr.chamBrick?.roughnessMap,
    roughness: 0.86,
    metalness: 0.02
  });
  ctx.extraMaterials.push(poNagarBrickMat);
  const poBrickMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brickParts), 1.9), poNagarBrickMat);
  poBrickMesh.name = 'PoNagarBrickTowers';
  poBrickMesh.castShadow = true;
  poBrickMesh.receiveShadow = true;

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
    )
  );

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
type CaiRangProduceType = 'pineapple' | 'watermelon' | 'pumpkin' | 'cabbage' | 'coconut' | 'banana';

function createMekongBoatGeometry(
  length: number,
  beam: number,
  trimColor: string,
  canopyColor: string,
  poleType: CaiRangProduceType,
  seed: number
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const hullH = 1.28;

  // Sculpted wooden Mekong *ghe thuyền* hull with HOLLOW sunken cargo hold amidships!
  const hullGeo = new THREE.BoxGeometry(beam, hullH, length, 6, 4, 16);
  const pos = hullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    const tz = Math.max(-1, Math.min(1, z / (length * 0.5)));
    const ty = Math.max(0, Math.min(1, (y + hullH * 0.5) / hullH));
    const planW = Math.pow(Math.max(0.08, 1.0 - Math.pow(Math.abs(tz), 1.85)), 0.55);
    const flare = 0.40 + 0.60 * Math.pow(ty, 0.55);
    const sheerLift = 0.72 * Math.pow(Math.abs(tz), 2.3) + (tz > 0 ? 0.34 * Math.pow(tz, 3.0) : 0);

    // Depress inner top vertices in the cargo hold (tz in [-0.08..+0.68], inner |x| < 0.74 * beam/2)
    let holdDrop = 0;
    if (ty > 0.75 && tz > -0.10 && tz < 0.72 && Math.abs(x) < beam * 0.36) {
      holdDrop = -0.54;
    }
    x *= planW * flare;
    y += sheerLift - 0.25 + holdDrop;
    pos.setXYZ(i, x, y, z);
  }
  hullGeo.computeVertexNormals();
  parts.push(colorizeGeometry(hullGeo, '#5c3922'));

  // Painted gunwale / bow trim bands
  const trimGeo = new THREE.BoxGeometry(beam * 1.04, 0.26, length * 0.94, 4, 2, 14);
  const tPos = trimGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    let x = tPos.getX(i);
    let y = tPos.getY(i);
    const z = tPos.getZ(i);
    const tz = z / (length * 0.5);
    const planW = Math.pow(Math.max(0.08, 1.0 - Math.pow(Math.abs(tz), 1.85)), 0.55);
    const sheerLift = 0.72 * Math.pow(Math.abs(tz), 2.3) + (tz > 0 ? 0.34 * Math.pow(tz, 3.0) : 0);
    x *= planW;
    y += sheerLift + hullH * 0.5 - 0.27;
    tPos.setXYZ(i, x, y, z);
  }
  trimGeo.computeVertexNormals();
  parts.push(colorizeGeometry(trimGeo, trimColor));

  // Traditional Mekong boat eyes (*mắt thuyền*) + Bow registration plates + Large Rubber Tire Lashed Directly to Prow!
  for (const sx of [-1, 1]) {
    addColoredSphere(parts, '#f5f2ea', 0.22, 8, 6, sx * beam * 0.27, 0.68, length * 0.36, 0.55, 0.7, 1.35);
    addColoredSphere(parts, '#1b1d22', 0.11, 6, 5, sx * beam * 0.29, 0.68, length * 0.37, 0.6, 0.8, 1.1);
    // Bow registration number plate (*CT-xxxx*)
    addColoredBox(parts, '#f0ecde', 0.08, 0.24, 0.72, sx * beam * 0.36, 0.72, length * 0.24);
    addColoredBox(parts, '#213a72', 0.10, 0.10, 0.58, sx * beam * 0.36, 0.72, length * 0.24);
    // 2 Black rubber tire fenders hung along gunwale
    for (const tzOff of [-0.08, 0.16]) {
      const tire = new THREE.TorusGeometry(0.24, 0.085, 6, 12);
      tire.rotateY(Math.PI * 0.5);
      tire.translate(sx * beam * 0.49, 0.36, length * tzOff);
      parts.push(colorizeGeometry(tire, '#1f2124'));
    }
  }
  // Large heavy black rubber truck tire lashed directly around the pointed boat prow (ref 64_ghe_bau_cay_beo_cai_rang.jpg)
  const prowTire = new THREE.TorusGeometry(0.32, 0.11, 7, 12);
  prowTire.rotateX(Math.PI * 0.32);
  prowTire.translate(0, 1.04, length * 0.485);
  parts.push(colorizeGeometry(prowTire, '#1c1e21'));

  const isWholesaleFlatTarp = poleType === 'watermelon' || seed % 3 === 0;
  const canopyLen = length * 0.46;
  const canopyZ = -length * 0.14;

  if (isWholesaleFlatTarp) {
    // Authentic Wholesale Melon Boat Variant: Flat Black-Charcoal Tarp stretched over Steel Pipe Frame (ref 99_cai_rang_cay_beo.jpg)
    const pipeH = 2.05;
    for (const sx of [-1, 1]) {
      for (const sz of [-0.46, 0.0, 0.46]) {
        addColoredCylinder(parts, '#8b949e', 0.032, 0.036, pipeH, 6, sx * beam * 0.45, 0.65 + pipeH * 0.5, canopyZ + sz * canopyLen);
      }
      addColoredCylinder(parts, '#8b949e', 0.032, 0.032, canopyLen, 6, sx * beam * 0.45, 0.65 + pipeH, canopyZ, 0, Math.PI * 0.5, 0);
    }
    for (const sz of [-0.46, 0.46]) {
      addColoredCylinder(parts, '#8b949e', 0.032, 0.032, beam * 0.92, 6, 0, 0.65 + pipeH, canopyZ + sz * canopyLen, 0, 0, Math.PI * 0.5);
    }
    // Flat taut black tarpaulin sheet with slight rain-shedding pitch
    addColoredBox(parts, '#212429', beam * 0.98, 0.06, canopyLen * 1.06, 0, 0.65 + pipeH + 0.04, canopyZ, 0, 0, 0.04);
  } else {
    // Corrugated Curved Canopy (*mui thuyền*) on Timber/Bamboo Arch Ribs over stern/midship
    const canopyGeo = new THREE.CylinderGeometry(
      beam * 0.50,
      beam * 0.52,
      canopyLen,
      12,
      1,
      true,
      -Math.PI * 0.5,
      Math.PI
    );
    canopyGeo.rotateZ(Math.PI * 0.5);
    canopyGeo.rotateY(Math.PI * 0.5);
    canopyGeo.translate(0, 0.96, canopyZ);
    parts.push(colorizeGeometry(canopyGeo, canopyColor));

    // Exposed arched bamboo/timber canopy ribs & longitudinal corrugation ridges
    for (let r = 0; r < 4; r++) {
      const rz = canopyZ - canopyLen * 0.46 + (r / 3) * canopyLen * 0.92;
      const rib = new THREE.TorusGeometry(beam * 0.48, 0.045, 5, 12, Math.PI);
      rib.translate(0, 0.96, rz);
      parts.push(colorizeGeometry(rib, '#6f4e2e'));
    }
    for (let cr = -2; cr <= 2; cr++) {
      const a = cr * 0.42;
      const rx = Math.sin(a) * beam * 0.52;
      const ry = 0.96 + Math.cos(a) * beam * 0.52;
      addColoredBox(parts, '#d8dce0', 0.06, 0.05, canopyLen * 0.98, rx, ry, canopyZ);
    }
  }

  // Long-tail *Máy Đuôi Tôm* Motor + Angled Propeller Shaft at Stern!
  const sternZ = -length * 0.44;
  addColoredBox(parts, '#4c5258', 0.52, 0.42, 0.62, 0.18, 0.88, sternZ);
  addColoredCylinder(parts, '#b6bcc2', 0.035, 0.035, 3.1, 6, 0.18, 0.42, sternZ - 1.38, 0, Math.PI * 0.5 + 0.34, 0);
  addColoredBox(parts, '#d4b44a', 0.28, 0.06, 0.10, 0.18, -0.05, sternZ - 2.82);

  // Conical-Hat (*Nón Lá*) Boat Vendor seated near stern/midship
  const vendorShirtPalette = ['#d64545', '#2c78a8', '#e5a92a', '#2e8b57', '#9c428e'];
  const shirtCol = vendorShirtPalette[seed % vendorShirtPalette.length];
  addColoredCylinder(parts, shirtCol, 0.20, 0.24, 0.68, 8, -0.22, 0.95, canopyZ + canopyLen * 0.52);
  addColoredSphere(parts, '#e8be96', 0.14, 7, 6, -0.22, 1.40, canopyZ + canopyLen * 0.52);
  addColoredCone(parts, '#e5cf8e', 0.34, 0.24, 12, -0.22, 1.56, canopyZ + canopyLen * 0.52);

  // Colorful Produce Mound Piled High inside the Sunken Cargo Hold!
  const produceColorMap: Record<CaiRangProduceType, string> = {
    pineapple: '#e8a820',
    watermelon: '#24742a',
    pumpkin: '#e8761a',
    cabbage: '#8bc45a',
    coconut: '#4c8e35',
    banana: '#f2cc26'
  };
  const cargoCol = produceColorMap[poleType];
  const holdZ = length * 0.18;
  const rows = isWholesaleFlatTarp ? 4 : 3;
  for (let r = 0; r < rows; r++) {
    for (let c = -2; c <= 2; c++) {
      const px = c * beam * 0.13;
      const pz = holdZ + (r - (rows - 1) * 0.5) * 0.62;
      const py = 0.62 + (1.0 - Math.abs(c) * 0.24) * (isWholesaleFlatTarp ? 0.54 : 0.36);
      const col = poleType === 'watermelon' && (r + c) % 2 === 0 ? '#3f9938' : cargoCol;
      addColoredSphere(parts, col, isWholesaleFlatTarp ? 0.26 : 0.24, 7, 5, px, py, pz, 1.0, 0.88, 1.12);
    }
  }
  addColoredCylinder(parts, '#b9935a', 0.56, 0.44, 0.48, 9, -beam * 0.18, 0.66, holdZ + 1.15);
  addColoredCylinder(parts, '#b9935a', 0.52, 0.42, 0.46, 9, beam * 0.18, 0.66, holdZ + 1.25);

  // 6.5m Slender Authentic *Cây Bẹo* Bamboo Produce Pole (realistic slender culm r=0.02..0.036m, near-vertical — ref 64, 99!)
  const poleH = 6.2 + (seed % 3) * 0.45;
  const poleZ = length * 0.28;
  const poleTilt = -0.07;
  const poleGeo = new THREE.CylinderGeometry(0.020, 0.036, poleH, 7);
  poleGeo.translate(0, poleH * 0.5, 0);
  poleGeo.rotateX(poleTilt);
  poleGeo.translate(0, 0.55, poleZ);
  parts.push(colorizeGeometry(poleGeo, '#b89c5a'));

  // Lash 4 produce clusters staggered VERTICALLY along the upper pole shaft (t = 0.66, 0.76, 0.86, 0.96)
  const verticalFracs = [0.66, 0.76, 0.86, 0.96];
  for (let vi = 0; vi < verticalFracs.length; vi++) {
    const dist = poleH * verticalFracs[vi];
    const py = 0.55 + Math.cos(poleTilt) * dist;
    const pz = poleZ + Math.sin(poleTilt) * dist;
    const sideAng = vi * 1.65 + seed * 0.7;
    const hx = Math.cos(sideAng) * 0.24;
    const hz = pz + Math.sin(sideAng) * 0.22;
    // Woven twine collar tying produce directly to the slender bamboo culm
    addColoredCylinder(parts, '#8e7442', 0.045, 0.045, 0.06, 6, 0, py, pz);
    if (poleType === 'pineapple') {
      addColoredSphere(parts, '#e8a820', 0.21, 7, 5, hx, py - 0.12, hz, 0.82, 1.35, 0.82);
      addColoredCone(parts, '#3e8c33', 0.16, 0.28, 6, hx, py + 0.16, hz);
    } else if (poleType === 'watermelon') {
      addColoredSphere(parts, vi % 2 === 0 ? '#24742a' : '#3f9938', 0.25, 8, 6, hx, py - 0.10, hz, 0.95, 1.18, 0.95);
    } else if (poleType === 'pumpkin') {
      addColoredSphere(parts, '#e8761a', 0.24, 7, 5, hx, py - 0.08, hz, 1.18, 0.78, 1.18);
      addColoredCylinder(parts, '#4c6e2c', 0.04, 0.05, 0.14, 5, hx, py + 0.12, hz);
    } else if (poleType === 'cabbage') {
      addColoredSphere(parts, '#8ec95e', 0.23, 7, 5, hx, py - 0.08, hz, 1.05, 0.95, 1.05);
      addColoredSphere(parts, '#5fa33d', 0.20, 6, 5, hx + 0.05, py - 0.10, hz + 0.04);
    } else if (poleType === 'coconut') {
      addColoredSphere(parts, '#4c8e35', 0.17, 7, 5, hx - 0.08, py - 0.08, hz);
      addColoredSphere(parts, '#43822e', 0.17, 7, 5, hx + 0.09, py - 0.12, hz + 0.05);
    } else {
      for (let bn = -1; bn <= 1; bn++) {
        addColoredCylinder(parts, '#f2cc26', 0.055, 0.048, 0.42, 6, hx + bn * 0.10, py - 0.12, hz, 0, 0.22, bn * 0.24);
      }
    }
  }

  return mergeNormalized(parts);
}

/**
 * Builds a sculpted tapered Mekong *Hủ Tiếu* breakfast sampan with curved sheer,
 * miniature glass noodle cabinet, steaming stainless broth pot, stools & striped umbrella!
 */
function addSculptedHuTieuSampanParts(
  parts: THREE.BufferGeometry[],
  lampParts: THREE.BufferGeometry[],
  sx: number,
  sz: number,
  umbrellaCol: string,
  yaw: number
): void {
  const local: THREE.BufferGeometry[] = [];
  const len = 6.6;
  const beam = 1.75;
  const hullH = 0.62;
  const hull = new THREE.BoxGeometry(beam, hullH, len, 6, 3, 12);
  const pos = hull.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const tz = Math.max(-1, Math.min(1, z / (len * 0.5)));
    const ty = Math.max(0, Math.min(1, (y + hullH * 0.5) / hullH));
    const planW = Math.pow(Math.max(0.05, 1.0 - Math.pow(Math.abs(tz), 1.85)), 0.58);
    const flare = 0.42 + 0.58 * Math.pow(ty, 0.55);
    const sheer = 0.34 * Math.pow(Math.abs(tz), 2.2);
    const holdDrop = ty > 0.7 && Math.abs(tz) < 0.72 && Math.abs(x) < beam * 0.35 ? -0.26 : 0;
    x *= planW * flare;
    y += sheer + 0.12 + holdDrop;
    pos.setXYZ(i, x, y, z);
  }
  hull.computeVertexNormals();
  local.push(colorizeGeometry(hull, '#5c3c22'));

  // Miniature Glass Noodle Cabinet (*tủ kính hủ tiếu*) with wooden frame & red-yellow trim
  addColoredBox(local, '#a9d6e5', 0.82, 0.78, 0.68, 0, 0.85, 0.78);
  addColoredBox(local, '#c83428', 0.88, 0.10, 0.74, 0, 1.26, 0.78);
  addColoredBox(local, '#7a4d28', 0.88, 0.10, 0.74, 0, 0.44, 0.78);
  // Steaming stainless steel *Hủ Tiếu* broth pot + charcoal brazier
  addColoredCylinder(local, '#3a3c40', 0.30, 0.28, 0.32, 10, 0, 0.42, -0.35);
  addColoredCylinder(local, '#d2d6dc', 0.34, 0.32, 0.52, 12, 0, 0.82, -0.35);
  // Conical-hat noodle chef + red plastic stools
  addColoredCylinder(local, '#28729e', 0.16, 0.20, 0.56, 8, -0.25, 0.78, -1.25);
  addColoredCone(local, '#e5cf8e', 0.30, 0.20, 10, -0.25, 1.22, -1.25);
  addColoredCylinder(local, '#d93826', 0.20, 0.18, 0.30, 8, 0.32, 0.44, 1.65);
  // Colorful Market Umbrella
  addColoredCylinder(local, '#c4a65e', 0.04, 0.05, 2.35, 6, 0, 1.48, 0.15);
  addColoredCone(local, umbrellaCol, 1.52, 0.56, 10, 0, 2.68, 0.15);
  addColoredCone(local, '#f5d442', 0.72, 0.28, 10, 0, 2.86, 0.15);

  for (const g of local) {
    transformGeo(g, sx, 0.02, sz, yaw);
    parts.push(g);
  }
  lampParts.push(new THREE.SphereGeometry(0.16, 8, 8).translate(sx, 2.18, sz));
}

function buildCaiRangFloatingMarket(ctx: VietnamBuilderContext): JunkBoatMotion[] {
  const cx = -72;

  const group = new THREE.Group();
  group.name = 'CaiRangFloatingMarketComplex';

  // 1. Broad Wooden River Wharf at (-72, 336) extending out into Mekong River channel
  const dockParts: THREE.BufferGeometry[] = [];
  const wharfProduceParts: THREE.BufferGeometry[] = [];
  const wharfLampParts: THREE.BufferGeometry[] = [];
  const shophouseRoofParts: THREE.BufferGeometry[] = [];

  const bankY = ctx.getHeight(cx, 334.0);
  const dockDeckY = Math.max(1.25, bankY + 0.35);
  addBox(dockParts, 7.6, 0.28, 13.5, cx, dockDeckY, 339.5);
  addBox(dockParts, 18.0, 0.32, 6.0, cx, dockDeckY, 346.5);
  for (const px of [cx - 3.4, cx, cx + 3.4]) {
    for (const pz of [333.5, 338.0, 342.5, 346.5]) {
      addCyl(dockParts, 0.18, 0.22, dockDeckY + 2.4, 8, px, (dockDeckY - 2.2) * 0.5, pz);
    }
  }
  for (const px of [cx - 8.2, cx - 5.2, cx + 5.2, cx + 8.2]) {
    for (const pz of [344.2, 348.8]) {
      addCyl(dockParts, 0.18, 0.22, dockDeckY + 2.4, 8, px, (dockDeckY - 2.2) * 0.5, pz);
    }
  }
  for (const bx of [cx - 8.0, cx - 3.5, cx + 3.5, cx + 8.0]) {
    addBox(dockParts, 0.38, 0.95, 0.38, bx, dockDeckY + 0.45, 349.1);
  }
  for (let s = 0; s < 3; s++) {
    addBox(dockParts, 4.2, 0.24, 0.85, cx, dockDeckY - 0.25 - s * 0.26, 349.8 + s * 0.72);
  }

  // Wharf timber posts + Pitched Corrugated A-Frame Wharf Roof (replacing flat board!)
  for (const px of [cx - 7.2, cx - 2.4, cx + 2.4, cx + 7.2]) {
    for (const pz of [344.2, 348.6]) {
      addCyl(dockParts, 0.12, 0.15, 3.3, 8, px, dockDeckY + 1.65, pz);
    }
  }
  const wharfRoof = createHippedRoofGeometry(16.6, 6.2, 13.5, 0.2, 2.2);
  wharfRoof.translate(cx, dockDeckY + 3.25, 346.4);
  shophouseRoofParts.push(colorizeGeometry(wharfRoof, '#3a6e8c'));

  // Traditional Riverside Archway + Readable "CHỢ NỔI CÁI RĂNG" Signboard at Wharf Entrance
  for (const side of [-1, 1]) {
    addCyl(dockParts, 0.16, 0.20, 4.5, 8, cx + side * 3.6, dockDeckY + 2.25, 334.6);
  }
  const caiRangSign = createSignagePlaqueMesh(
    {
      text: 'CHỢ NỔI CÁI RĂNG',
      subText: 'CẦN THƠ — MIỀN TÂY',
      style: 'market',
      width: 7.4,
      height: 1.2,
      depth: 0.22,
      motifSeed: 3301
    },
    ctx
  );
  caiRangSign.name = 'CaiRangWharfArchSignage';
  caiRangSign.position.set(cx, dockDeckY + 4.15, 334.6);
  caiRangSign.rotation.y = Math.PI;
  group.add(caiRangSign);

  // Overflowing woven bamboo wholesale fruit baskets on the wharf deck
  const wharfBaskets: Array<[number, number, string]> = [
    [cx - 5.4, 345.6, '#e8a820'],
    [cx - 4.2, 346.2, '#2a7b2f'],
    [cx - 3.0, 345.4, '#d92e54'],
    [cx + 3.2, 345.5, '#e8781e'],
    [cx + 4.5, 346.2, '#e8a820'],
    [cx + 5.7, 345.6, '#2a7b2f']
  ];
  for (const [bx, bz, fruitCol] of wharfBaskets) {
    addColoredCylinder(wharfProduceParts, '#b9935a', 0.62, 0.46, 0.56, 10, bx, dockDeckY + 0.42, bz);
    for (let f = 0; f < 4; f++) {
      addColoredSphere(
        wharfProduceParts,
        fruitCol,
        0.22,
        8,
        6,
        bx + (f % 2 - 0.5) * 0.34,
        dockDeckY + 0.78 + (f > 1 ? 0.14 : 0),
        bz + (f > 1 ? 0.16 : -0.16)
      );
    }
  }
  for (let l = -5; l <= 5; l += 2) {
    wharfLampParts.push(new THREE.SphereGeometry(0.18, 8, 8).translate(cx + l * 1.25, dockDeckY + 2.95, 348.2));
  }

  // 2 Sculpted Tapered *Hủ Tiếu* Breakfast Sampans docked beside the wharf!
  addSculptedHuTieuSampanParts(wharfProduceParts, wharfLampParts, cx - 6.6, 352.2, '#d62828', 1.48);
  addSculptedHuTieuSampanParts(wharfProduceParts, wharfLampParts, cx + 6.9, 351.8, '#1d7a9e', -1.52);

  // FIX CR-05: 12 Tightly-Packed Varied Mekong Riverfront Stilt Shophouses with Sloped Corrugated Tin Roofs along the North Bank (ref 33!)
  const shophouseXs = [-122, -115.2, -108.6, -102.0, -95.2, -88.6, -56.4, -49.8, -43.2, -36.6, -30.0, -23.4];
  const wallPalette = ['#d4b483', '#a8c2b8', '#d9a072', '#b8c4cf', '#cbb792', '#9fb8a5', '#d2a684', '#c5b89e'];
  const roofPalette = ['#6c767e', '#864838', '#3c6780', '#5a6b5c'];
  for (let s = 0; s < shophouseXs.length; s++) {
    const hx = shophouseXs[s];
    const hz = 330.8 + (s % 2) * 1.1;
    const hy = Math.max(1.4, ctx.getHeight(hx, hz) + 0.3);
    const hw = 6.2 + (s % 2) * 0.35;
    const hd = 6.0;
    const hh = 3.5 + (s % 3) * 0.72;
    // Wooden river stilts plunging into muddy bank (-2.2m)
    for (const px of [-2.7, 2.7]) {
      for (const pz of [-2.4, 2.4]) {
        addCyl(dockParts, 0.12, 0.15, hy + 2.2, 6, hx + px, (hy - 2.2) * 0.5, hz + pz);
      }
    }
    // Timber balcony deck overhanging the floating market water
    addBox(dockParts, hw + 0.5, 0.22, hd + 2.6, hx, hy, hz + 0.9);
    // Shophouse timber/plaster walls & dark open shopfront
    addColoredBox(wharfProduceParts, wallPalette[s % wallPalette.length], hw, hh, hd, hx, hy + hh * 0.5 + 0.1, hz);
    addColoredBox(wharfProduceParts, '#47301e', 2.2, 2.1, 0.18, hx - 1.0, hy + 1.15, hz + hd * 0.5 + 0.08);
    addColoredBox(wharfProduceParts, '#2d6c4e', 1.3, 1.25, 0.18, hx + 1.6, hy + 1.75, hz + hd * 0.5 + 0.08);
    // Sloped corrugated Delta galvanized/painted tin lean-to roof overhanging river balcony!
    const tinRoof = new THREE.BoxGeometry(hw + 0.45, 0.14, hd + 3.0);
    tinRoof.rotateX(0.24);
    tinRoof.translate(hx, hy + hh + 0.42, hz + 0.55);
    shophouseRoofParts.push(colorizeGeometry(tinRoof, roofPalette[s % roofPalette.length]));
    // Warm porch bulb
    wharfLampParts.push(new THREE.SphereGeometry(0.15, 6, 5).translate(hx, hy + hh - 0.45, hz + hd * 0.5 + 1.2));
  }

  const wharfProduceMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.70,
    metalness: 0.08
  });
  const corrugatedRoofMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.32
  });
  ctx.extraMaterials.push(wharfProduceMat, corrugatedRoofMat);

  group.add(
    makeMergedMesh('CaiRangMekongWharf', dockParts, ctx.materials.darkWood),
    makeMergedMesh('CaiRangWharfProduceAndSampans', wharfProduceParts, wharfProduceMat),
    makeMergedMesh('CaiRangStiltShophouseRoofs', shophouseRoofParts, corrugatedRoofMat),
    makeMergedMesh(
      'CaiRangWharfLamps',
      wharfLampParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    )
  );

  // 2. Expanded Fleet of 28 Colorful Animated Mekong Merchant Boats spanning 125m (x in [-134..-9])!
  // IMPORTANT: Index 0 (CaiRangMarketBoat_1) retains exact yaw=1.48 & motion params tested in vietnamHeritageScene.test.ts!
  const boatVertexMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.06
  });
  ctx.extraMaterials.push(boatVertexMat);

  const boatConfigs: Array<{
    x: number;
    zOff: number;
    len: number;
    beam: number;
    yaw: number;
    trim: string;
    canopy: string;
    produce: CaiRangProduceType;
  }> = [
      // Boat 1 (preserves tested yaw ~1.45 at t=12.5!)
      { x: -114, zOff: -9.0, len: 12.6, beam: 3.1, yaw: 1.48, trim: '#2998a8', canopy: '#cbb079', produce: 'pineapple' },
      { x: -134, zOff: -3.5, len: 12.2, beam: 2.95, yaw: 1.54, trim: '#c73a2c', canopy: '#3d7994', produce: 'watermelon' },
      { x: -129, zOff: 8.5, len: 11.8, beam: 2.85, yaw: -1.58, trim: '#e09d2c', canopy: '#cbb079', produce: 'pumpkin' },
      { x: -123, zOff: -10.5, len: 13.0, beam: 3.05, yaw: 1.42, trim: '#2aa68d', canopy: '#8496a0', produce: 'cabbage' },
      { x: -119, zOff: 4.5, len: 11.6, beam: 2.8, yaw: -1.46, trim: '#d67c2a', canopy: '#407c98', produce: 'coconut' },
      { x: -109, zOff: 7.5, len: 11.4, beam: 2.8, yaw: -1.62, trim: '#d67c2a', canopy: '#3d7994', produce: 'watermelon' },
      { x: -103, zOff: -4.0, len: 13.5, beam: 3.2, yaw: 1.32, trim: '#c73a2c', canopy: '#c8ac72', produce: 'banana' },
      { x: -97, zOff: 10.5, len: 11.2, beam: 2.7, yaw: 1.75, trim: '#2aa68d', canopy: '#8496a0', produce: 'pineapple' },
      { x: -92, zOff: -10.5, len: 13.2, beam: 3.1, yaw: -1.38, trim: '#e09d2c', canopy: '#3b738c', produce: 'pumpkin' },
      { x: -87, zOff: 3.0, len: 12.0, beam: 2.9, yaw: 1.55, trim: '#2998a8', canopy: '#cbb079', produce: 'watermelon' },
      { x: -81, zOff: -6.5, len: 14.0, beam: 3.3, yaw: -1.52, trim: '#c73a2c', canopy: '#407c98', produce: 'cabbage' },
      { x: -76, zOff: 9.5, len: 11.8, beam: 2.8, yaw: 1.72, trim: '#d67c2a', canopy: '#c4a86e', produce: 'coconut' },
      { x: -71, zOff: -2.0, len: 12.8, beam: 3.0, yaw: -1.68, trim: '#2aa68d', canopy: '#3a728a', produce: 'pineapple' },
      { x: -66, zOff: 11.0, len: 11.6, beam: 2.8, yaw: 1.25, trim: '#e09d2c', canopy: '#cbb079', produce: 'banana' },
      { x: -60, zOff: -9.5, len: 13.4, beam: 3.2, yaw: 1.44, trim: '#2998a8', canopy: '#407c98', produce: 'watermelon' },
      { x: -55, zOff: 4.5, len: 12.2, beam: 2.9, yaw: -1.48, trim: '#c73a2c', canopy: '#cbb079', produce: 'pumpkin' },
      { x: -50, zOff: -5.5, len: 11.5, beam: 2.75, yaw: 1.62, trim: '#d67c2a', canopy: '#3d7994', produce: 'pineapple' },
      { x: -45, zOff: 8.5, len: 13.0, beam: 3.05, yaw: -1.65, trim: '#2aa68d', canopy: '#c4a86e', produce: 'cabbage' },
      { x: -40, zOff: -8.5, len: 12.4, beam: 2.95, yaw: 1.38, trim: '#e09d2c', canopy: '#3a728a', produce: 'coconut' },
      { x: -36, zOff: 2.5, len: 11.8, beam: 2.85, yaw: -1.55, trim: '#2998a8', canopy: '#cbb079', produce: 'banana' },
      { x: -31, zOff: -10.0, len: 13.2, beam: 3.1, yaw: 1.50, trim: '#c73a2c', canopy: '#407c98', produce: 'watermelon' },
      { x: -27, zOff: 9.0, len: 11.6, beam: 2.8, yaw: -1.60, trim: '#d67c2a', canopy: '#cbb079', produce: 'pineapple' },
      { x: -23, zOff: -3.0, len: 12.6, beam: 3.0, yaw: 1.46, trim: '#2aa68d', canopy: '#3d7994', produce: 'pumpkin' },
      { x: -19, zOff: 6.5, len: 11.4, beam: 2.75, yaw: -1.44, trim: '#e09d2c', canopy: '#8496a0', produce: 'cabbage' },
      { x: -15, zOff: -8.5, len: 12.8, beam: 3.05, yaw: 1.58, trim: '#2998a8', canopy: '#c8ac72', produce: 'coconut' },
      { x: -12, zOff: 3.5, len: 11.8, beam: 2.85, yaw: -1.52, trim: '#c73a2c', canopy: '#3a728a', produce: 'banana' },
      { x: -9, zOff: -4.5, len: 12.4, beam: 2.95, yaw: 1.40, trim: '#d67c2a', canopy: '#cbb079', produce: 'pineapple' },
      { x: -64, zOff: 1.0, len: 11.2, beam: 2.7, yaw: 1.64, trim: '#2aa68d', canopy: '#407c98', produce: 'watermelon' }
    ];

  const southernBoats: JunkBoatMotion[] = [];
  for (let i = 0; i < boatConfigs.length; i++) {
    const cfg = boatConfigs[i];
    const zChannelCenter = 365.0 + 7.0 * Math.sin((cfg.x + 72.0) * 0.025);
    const bz = THREE.MathUtils.clamp(zChannelCenter + cfg.zOff, 347.0, 384.0);

    const boatGroup = new THREE.Group();
    boatGroup.name = `CaiRangMarketBoat_${i + 1}`;
    boatGroup.position.set(cfg.x, 0.02, bz);
    boatGroup.rotation.y = cfg.yaw;

    const boatGeo = createMekongBoatGeometry(
      cfg.len,
      cfg.beam,
      cfg.trim,
      cfg.canopy,
      cfg.produce,
      i + 1
    );
    const boatMesh = new THREE.Mesh(boatGeo, boatVertexMat);
    boatMesh.castShadow = true;
    boatMesh.receiveShadow = true;
    boatGroup.add(boatMesh);

    group.add(boatGroup);
    southernBoats.push({
      group: boatGroup,
      centerX: cfg.x,
      centerZ: bz,
      radiusX: 1.15 + (i % 3) * 0.35,
      radiusZ: 0.85 + (i % 2) * 0.35,
      speed: 0.16 + (i % 4) * 0.03,
      phase: i * 0.68
    });
  }

  // 3. Six Agile Retail Sampans (*Xuồng bán lẻ* — Hủ tiếu, Cà phê, Dứa gọt, Nước dừa) weaving among the 28 large boats!
  const retailConfigs: Array<[number, number, string, number]> = [
    [-117.5, -1.5, '#d62828', 0.85],
    [-99.5, 2.5, '#e89b1e', -1.12],
    [-83.0, 5.5, '#1d7a9e', 1.25],
    [-57.5, -2.8, '#2e8b57', -0.92],
    [-41.5, 4.2, '#c83a62', 1.08],
    [-24.5, 1.8, '#d66824', -1.35]
  ];
  for (let r = 0; r < retailConfigs.length; r++) {
    const [rx, rzOff, uCol, rYaw] = retailConfigs[r];
    const zChan = 365.0 + 7.0 * Math.sin((rx + 72.0) * 0.025);
    const rbz = THREE.MathUtils.clamp(zChan + rzOff, 349.0, 381.0);
    const localSampanParts: THREE.BufferGeometry[] = [];
    const dummyLampParts: THREE.BufferGeometry[] = [];
    addSculptedHuTieuSampanParts(localSampanParts, dummyLampParts, 0, 0, uCol, 0);
    for (const lp of dummyLampParts) lp.dispose();

    const retailGroup = new THREE.Group();
    retailGroup.name = `CaiRangRetailSampan_${r + 1}`;
    retailGroup.position.set(rx, 0.02, rbz);
    retailGroup.rotation.y = rYaw;
    const retailMesh = new THREE.Mesh(mergeNormalized(localSampanParts), boatVertexMat);
    retailMesh.castShadow = true;
    retailMesh.receiveShadow = true;
    retailGroup.add(retailMesh);
    group.add(retailGroup);
    southernBoats.push({
      group: retailGroup,
      centerX: rx,
      centerZ: rbz,
      radiusX: 1.85,
      radiusZ: 1.35,
      speed: 0.28 + (r % 3) * 0.05,
      phase: r * 1.15
    });
  }

  ctx.scene.add(group);
  return southernBoats;
}

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
  // 2 Thatched Hexagonal Rest Pavilions (*Chòi nghỉ chân*) along the bamboo footbridge (TS-03: dedicated thatchFiber roofs!)
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
      // Top observation deck + safety rails at y = 19.2m
      for (const s of [-2.5, 2.5]) {
        addBox(towerSteelParts, 5.2, 0.12, 0.12, obsX, ty + 1.15, obsZ + s);
        addBox(towerSteelParts, 0.12, 0.12, 5.2, obsX + s, ty + 1.15, obsZ);
      }
      addCyl(towerSteelParts, 0.85, 0.95, 19.2, 8, obsX, 9.4, obsZ); // central spiral staircase core
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

  // 4b. Floating Purple Water Hyacinth (*Lục Bình*) & 20 Egret Nests Anchored Directly Onto Real Melaleuca Crowns (P0 Fixed!)
  const wildlifeParts: THREE.BufferGeometry[] = [];
  const randWild = mulberry32(99512);
  for (let i = 0; i < 36; i++) {
    const hx = cx + (randWild() - 0.5) * 92;
    const hz = channelZ(hx) + (randWild() > 0.5 ? 1 : -1) * (2.6 + randWild() * 2.0);
    addColoredSphere(wildlifeParts, '#3a8832', 0.42, 6, 5, hx, 0.08, hz, 1.2, 0.45, 1.2);
    addColoredSphere(wildlifeParts, '#9a5de8', 0.18, 6, 5, hx, 0.28, hz);
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
  const wildlifeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68 });
  ctx.extraMaterials.push(wildlifeMat);
  group.add(new THREE.Mesh(mergeNormalized(wildlifeParts), wildlifeMat));

  group.add(trunkInst, canopyInst);
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

  // 2b. Cột Cờ Hà Nội tại Mũi Cà Mau (36m-tall Weathered Imperial Brick Replica at (20, 474))
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

  addColoredBox(shipParts, '#a85a3b', 4.8, 0.45, 12.6, 0, deckY + 4.25, shipZ - 0.8);

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
  // Offshore coastal wave-breaker concrete seawall & 2 Sculpted Tapered Wooden *Vỏ Lãi* Boats!
  for (let s = -4; s <= 4; s++) {
    addBox(graniteParts, 4.8, 1.35, 1.2, s * 6.2, 0.45, 512.0 + Math.abs(s) * 0.6);
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

  group.add(
    makeMergedMesh('MuiCaMauMangroveBoardwalk', woodParts, ctx.materials.darkWood),
    makeMergedMesh('MuiCaMauGPS0001Granite', graniteParts, ctx.materials.granite),
    makeMergedMesh('MuiCaMauConTauSculpture', shipParts, conTauMat)
  );

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

  // 1. 60m Long Wooden Sunset Pier (*Cầu cảng Hoàng hôn*) extending z = 472 .. 412
  const pierX = -335;
  const pierDeckY = 1.65;
  addBox(woodParts, 4.4, 0.24, 60.0, pierX, pierDeckY, 442.0);
  // Sunset viewing deck head at z = 412
  addBox(woodParts, 9.6, 0.28, 7.6, pierX, pierDeckY, 412.0);
  // Beach entry ramp meeting sand at z = 472..476
  const beachY = ctx.getHeight(pierX, 476.0);
  const rampPitch = Math.atan2(pierDeckY - beachY, 4.5);
  addBox(woodParts, 4.4, 0.24, 5.2, pierX, (pierDeckY + beachY) * 0.5, 474.2, 0, -rampPitch, 0);

  // Deep timber pilings down into seabed (y = -3.0m)
  for (let pz = 410.0; pz <= 472.0; pz += 5.0) {
    const halfW = pz < 416.5 ? 4.3 : 1.95;
    for (const sx of [-halfW, halfW]) {
      addCyl(woodParts, 0.16, 0.20, pierDeckY + 3.0, 8, pierX + sx, (pierDeckY - 3.0) * 0.5, pz);
    }
  }
  // Pier railings & warm glowing Sunset Lanterns along the 60m pier
  for (const sx of [-2.05, 2.05]) {
    addBox(woodParts, 0.12, 0.12, 56.0, pierX + sx, pierDeckY + 1.0, 443.0);
    for (let pz = 412.0; pz <= 470.0; pz += 7.25) {
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

  // Pier T-head safety perimeter railings (z = 408.2..415.8)
  addBox(woodParts, 9.6, 0.12, 0.12, pierX, pierDeckY + 1.0, 408.4);
  for (const sx of [-4.65, 4.65]) {
    addBox(woodParts, 0.12, 0.12, 7.6, pierX + sx, pierDeckY + 1.0, 412.0);
    addBox(woodParts, 2.7, 0.12, 0.12, pierX + sx * 0.72, pierDeckY + 1.0, 415.6);
    addBox(woodParts, 0.14, 1.05, 0.14, pierX + sx, pierDeckY + 0.52, 408.4);
    addBox(woodParts, 0.14, 1.05, 0.14, pierX + sx, pierDeckY + 0.52, 415.6);
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
  const dcRoof = createVietnameseCurvedRoofGeometry(6.5, 5.3, 2.6, 1.4, 1.65, 0.14);
  dcRoof.translate(dcX, dcDeckY + 3.05, dcZ);
  organicParts.push(dcShrineWall, colorizeGeometry(dcRoof, '#b82820'));
  const dcFinial = createRoofFinialSetParts(dcX, dcDeckY + 4.72, dcZ, 2.6, 0, 0.55, true);
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

  group.add(makeMergedMesh('PhuQuocDinhCauStone', dcStoneParts, ctx.materials.stone));

  // 2c. 3 Sculpted Pointed-Prow Blue-and-Red Phú Quốc Fishing Boats with Cabins & Squid-Fishing Booms + 3 Basket Boats!
  for (const [bx, bz, byaw] of [
    [-327.0, 444.0, 0.12],
    [-343.0, 434.0, -0.15],
    [-324.0, 422.0, 0.25]
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
    makeMergedMesh('PhuQuocPalmsAndThatch', organicParts, phuQuocOrganicMat)
  );

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
  // Carved Stone Memorial Monument of 914 Prisoners (*Bia Tưởng Niệm 914 Chiến Sĩ*) with Stone Flame Wreath & Incense Brazier beside Pier Head
  addBox(graniteParts, 1.85, 0.42, 1.45, pierX - 4.4, porticoDeckY + 0.21, 461.5);
  addBox(graniteParts, 1.35, 2.15, 0.48, pierX - 4.4, porticoDeckY + 1.48, 461.5);
  const wreathRing = new THREE.TorusGeometry(0.42, 0.09, 6, 12);
  wreathRing.translate(pierX - 4.4, porticoDeckY + 1.55, 461.22);
  goldParts.push(wreathRing);
  addCyl(bronzeParts, 0.22, 0.18, 0.34, 8, pierX - 4.4, porticoDeckY + 0.58, 460.6);

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
  // Rear stone perimeter enclosure wall closing the prison yard
  addBox(stoneParts, 19.6, 3.2, 0.65, prisX, prisY + 1.6, prisZ + 16.0);

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

  addBox(graniteParts, 4.6, 2.8, 4.6, cx, memY + 2.8, cz);
  addBox(bronzeParts, 4.78, 1.35, 4.78, cx, memY + 3.1, cz);
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
  // 2-Tier Red Terracotta Curved Roofs over Central Tam Quan Bay
  const tqRoofLo = createVietnameseCurvedRoofGeometry(8.6, 3.8, 5.2, 1.8, 1.75, 0.34);
  tqRoofLo.translate(cx, tqY + 6.62, tqZ);
  addBox(whiteParts, 4.8, 1.15, 1.55, cx, tqY + 8.65, tqZ);
  const tqRoofHi = createVietnameseCurvedRoofGeometry(6.4, 3.0, 3.6, 0.35, 1.55, 0.32);
  tqRoofHi.translate(cx, tqY + 9.18, tqZ);
  roofParts.push(tqRoofLo, tqRoofHi);
  // White *Lưỡng Long Chầu Nguyệt* rooftop ridge ornament crowning Tam Quan!
  const tqFinial = createRoofFinialSetParts(cx, tqY + 10.75, tqZ, 3.6, 0, 0.62, true);
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
    // Upper tier red terracotta roof + white *Lưỡng Long Chầu Nguyệt* ridge finial
    const sideRoofHi = createVietnameseCurvedRoofGeometry(4.2, 2.3, 2.4, 0.28, 1.15, 0.26);
    sideRoofHi.translate(sbx, tqY + 6.84, tqZ);
    roofParts.push(sideRoofLo, sideRoofHi);
    const sideFinial = createRoofFinialSetParts(sbx, tqY + 8.02, tqZ, 2.4, 0, 0.44, true);
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
  candleGlowParts.push(
    new THREE.SphereGeometry(0.11, 5, 4).translate(vtsX - 0.45, vtsY + 0.75, vtsZ + 2.08),
    new THREE.SphereGeometry(0.11, 5, 4).translate(vtsX + 0.45, vtsY + 0.75, vtsZ + 2.08)
  );

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
    makeMergedMesh('ConDaoAncientSeaAlmonds', leafParts, bangLeafMat)
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 48.0 });
}

// ============================================================================
// Master Entry Point: All 10 Southern Vietnam & Islands Landmarks
// ============================================================================
export function buildVietnamSouthLandmarks(
  ctx: VietnamBuilderContext
): { southernBoats: JunkBoatMotion[] } {
  buildBenThanhMarket(ctx);
  buildIndependencePalace(ctx);
  buildNotreDameSaigon(ctx);
  buildCuChiTunnels(ctx);
  buildPoNagarNhaTrang(ctx);
  const southernBoats = buildCaiRangFloatingMarket(ctx);
  southernBoats.push(...buildTraSuMelaleucaForest(ctx));
  buildMuiCaMau(ctx);
  buildPhuQuocIsland(ctx);
  buildConDaoIsland(ctx);

  return { southernBoats };
}
