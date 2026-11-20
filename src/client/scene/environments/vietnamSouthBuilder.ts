import * as THREE from 'three';
import {
  VietnamBuilderContext,
  JunkBoatMotion,
  createArchedWallGeometry,
  createPointedArchedWallGeometry,
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
  createNotchedLotusPadGeometry,
  mergeNormalized,
  mulberry32,
  noise2D,
  normalizeForMerge
} from './vietnamGeometryHelpers';
import {
  createSignagePlaqueMesh,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createSculptedDeityParts,
  createChamReliefTympanumParts,
  createHistoricalTankParts,
  createUH1HelicopterParts,
  createMangroveTreeParts,
  createGuardianBeastParts
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

  const whiteMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

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
  // Open cross-aisle ceiling decks (y = 10.35m)
  addBox(trimParts, 27.5, 0.42, 65.0, 0, 10.35, 0);
  addBox(trimParts, 97.0, 0.42, 23.0, 0, 10.35, 0);

  // Checkerboard floor strips along both N-S and E-W interior cross-aisles
  for (let zi = -15; zi <= 15; zi++) {
    for (let xi = -4; xi <= 4; xi++) {
      const col = (xi + zi) % 2 === 0 ? '#e6e0d2' : '#5e5b54';
      addColoredBox(stallParts, col, 2.4, 0.06, 2.0, xi * 2.4, 0.83, zi * 2.0);
    }
  }
  for (let xi = -20; xi <= 20; xi++) {
    if (Math.abs(xi) <= 4) continue;
    for (let zi = -3; zi <= 3; zi++) {
      const col = (xi + zi) % 2 === 0 ? '#e6e0d2' : '#5e5b54';
      addColoredBox(stallParts, col, 2.2, 0.06, 2.4, xi * 2.2, 0.83, zi * 2.4);
    }
  }

  // Exposed colonial steel roof trusses & glowing overhead pendant market lamps in N-S and E-W concourses
  for (let tz = -28; tz <= 28; tz += 7) {
    addBox(ironParts, 26.8, 0.30, 0.24, 0, 9.65, tz);
    addBox(ironParts, 26.8, 0.16, 0.16, 0, 8.95, tz);
    for (const bx of [-10, -5, 0, 5, 10]) {
      addBox(ironParts, 0.16, 0.72, 0.16, bx, 9.3, tz);
    }
    for (const lx of [-7.5, 0.0, 7.5]) {
      addCyl(ironParts, 0.03, 0.03, 1.45, 6, lx, 8.55, tz);
      lampCoreParts.push(new THREE.SphereGeometry(0.24, 8, 7).translate(lx, 7.75, tz));
    }
  }
  for (const tx of [-42, -34, -26, -18, 18, 26, 34, 42]) {
    addBox(ironParts, 0.24, 0.30, 22.4, tx, 9.65, 0);
    addBox(ironParts, 0.16, 0.16, 22.4, tx, 8.95, 0);
    for (const lz of [-5.5, 5.5]) {
      addCyl(ironParts, 0.03, 0.03, 1.45, 6, tx, 8.55, lz);
      lampCoreParts.push(new THREE.SphereGeometry(0.22, 8, 7).translate(tx, 7.75, lz));
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
    addColoredBox(localParts, '#f5e29e', 3.4, 0.24, 0.14, 0, 3.45, 0.96);
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

  // Central crossing welcoming flower & lacquerware island kiosk + warm interior PointLights
  addColoredBox(stallParts, '#7a3b20', 4.6, 1.05, 4.6, 0, 1.36, 0);
  addColoredBox(stallParts, '#e09a1e', 1.4, 0.52, 1.4, -1.1, 2.12, -1.1);
  addColoredBox(stallParts, '#c82822', 1.4, 0.52, 1.4, 1.1, 2.12, -1.1);
  addColoredBox(stallParts, '#2c8a4b', 1.4, 0.52, 1.4, -1.1, 2.12, 1.1);
  addColoredBox(stallParts, '#d9487a', 1.4, 0.52, 1.4, 1.1, 2.12, 1.1);

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

  // North (-Z) & South (+Z) OPEN 7m-Tall Arched Porticos + 8 Flanking Arched Colonnade Bays + Rain Awnings
  for (const sideZ of [-1, 1]) {
    const faceZ = sideZ * 33.0;
    const rotY = sideZ < 0 ? Math.PI : 0;

    // Central OPEN 7m-tall arched entrance portico (ZERO blocking void walls!)
    const centerPortico = createArchedWallGeometry(16.0, 9.8, 3.2, 8.0, 7.2);
    centerPortico.rotateY(rotY);
    centerPortico.translate(0, 0.8, faceZ + sideZ * 1.4);
    ochreParts.push(centerPortico);
    addBox(trimParts, 16.8, 0.55, 3.8, 0, 10.65, faceZ + sideZ * 1.4);

    if (sideZ > 0) {
      const southPorticoGable = createHippedRoofGeometry(17.4, 5.4, 8.0, 0.6, 3.5);
      southPorticoGable.translate(0, 10.9, faceZ + 1.5);
      roofParts.push(southPorticoGable);
    } else {
      const northEave = createHippedRoofGeometry(17.6, 5.8, 10.8, 1.2, 2.2);
      northEave.translate(0, 10.9, faceZ - 1.5);
      roofParts.push(northEave);
    }

    // 4 Flanking colonial arched colonnade bays per side along North & South walls
    for (const sx of [-1, 1]) {
      for (let b = 0; b < 4; b++) {
        const bx = sx * (12.2 + b * 7.2);
        const bayWall = createArchedWallGeometry(7.0, 9.6, 1.8, 4.0, 6.2);
        bayWall.rotateY(rotY);
        bayWall.translate(bx, 0.8, faceZ);
        ochreParts.push(bayWall);
        addBox(voidParts, 3.7, 5.8, 1.1, bx, 3.7, faceZ - sideZ * 0.45);
        addBox(trimParts, 0.78, 9.6, 2.1, bx - sx * 3.5, 5.6, faceZ);
        // Green Indochine rain-shield awning above exterior bays
        addColoredBox(stallParts, '#2d6c4e', 6.8, 0.16, 2.35, bx, 6.95, faceZ + sideZ * 1.5, 0, sideZ * 0.24, 0);
      }
      addBox(trimParts, 0.78, 9.6, 2.1, sx * 39.8, 5.6, faceZ);
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

  // Readable 3D "CHỢ BẾN THÀNH" Signage Plaque beneath Clock Face + 4 Biên Hòa Glazed Ceramic Reliefs
  const towerZ = -34.4;
  const mainSign = createSignagePlaqueMesh(
    {
      text: 'CHỢ BẾN THÀNH',
      subText: '1914 — SÀI GÒN',
      style: 'market',
      width: 6.8,
      height: 1.25,
      depth: 0.22,
      motifSeed: 2801
    },
    ctx
  );
  mainSign.name = 'BenThanhMainSignage';
  mainSign.position.set(0, 9.25, towerZ - 1.72);
  mainSign.rotation.y = Math.PI;
  group.add(mainSign);

  // 4 Biên Hòa Glazed Ceramic Bas-Relief Plaques crowning North, South, East, West gates
  const ceramicSpecs: Array<{
    name: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    subText: string;
    seed: number;
  }> = [
    { name: 'BenThanhCeramicNorth', x: 0, y: 12.15, z: towerZ - 4.38, rotY: Math.PI, subText: 'CỬA NAM — BÒ & VỊT', seed: 5901 },
    { name: 'BenThanhCeramicSouth', x: 0, y: 9.25, z: 36.15, rotY: 0, subText: 'CHUỐI & CÁ ĐUỐI', seed: 5902 },
    { name: 'BenThanhCeramicEast', x: 51.75, y: 9.25, z: 0, rotY: Math.PI * 0.5, subText: 'CÀ PHÊ & LÚA', seed: 5903 },
    { name: 'BenThanhCeramicWest', x: -51.75, y: 9.25, z: 0, rotY: -Math.PI * 0.5, subText: 'HOA SEN & CÁ', seed: 5904 }
  ];
  for (const cs of ceramicSpecs) {
    const plaque = createSignagePlaqueMesh(
      {
        text: '',
        subText: cs.subText,
        style: 'ceramic_relief',
        width: 4.4,
        height: 1.55,
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

  // Signature Central 28.5m-tall 3-Faced Clock Tower above North (-Z) Entrance Portico
  addBox(ochreParts, 8.6, 11.6, 8.6, 0, 16.6, towerZ);
  addBox(trimParts, 9.4, 0.55, 9.4, 0, 11.1, towerZ);
  addBox(trimParts, 9.6, 0.65, 9.6, 0, 22.4, towerZ);

  // Corner pilasters & mid-height band on clock tower
  addBox(trimParts, 9.05, 0.4, 9.05, 0, 15.3, towerZ);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(trimParts, 0.88, 11.2, 0.88, sx * 4.1, 16.7, towerZ + sz * 4.1);
    }
  }
  // Louvered belfry arches with sculpted angled slats on all 4 faces (y = 12.6 .. 15.0m)
  addBox(voidParts, 4.2, 2.3, 8.75, 0, 13.7, towerZ);
  addBox(voidParts, 8.75, 2.3, 4.2, 0, 13.7, towerZ);
  for (let l = -3; l <= 3; l++) {
    const ly = 13.7 + l * 0.28;
    addBox(ochreParts, 4.0, 0.10, 8.85, 0, ly, towerZ, 0, 0.28, 0);
    addBox(ochreParts, 8.85, 0.10, 4.0, 0, ly, towerZ, 0, 0, 0.28);
  }
  // Perimeter balustrade crowning the Clock Tower gallery cornice (y = 22.7m)
  const bOff = 4.65;
  trimParts.push(
    ...createPiercedBalustradeParts(-bOff, towerZ - bOff, bOff, towerZ - bOff, 22.65, 0.85, 'lotus_stone'),
    ...createPiercedBalustradeParts(bOff, towerZ - bOff, bOff, towerZ + bOff, 22.65, 0.85, 'lotus_stone'),
    ...createPiercedBalustradeParts(bOff, towerZ + bOff, -bOff, towerZ + bOff, 22.65, 0.85, 'lotus_stone'),
    ...createPiercedBalustradeParts(-bOff, towerZ + bOff, -bOff, towerZ - bOff, 22.65, 0.85, 'lotus_stone')
  );

  // Indochine Stepped Terracotta Gable Roof (y = 22.6 .. 26.8m) + Gold Spire Finial to 28.5m!
  const towerRoofBase = createHippedRoofGeometry(10.0, 10.0, 6.4, 6.4, 1.55);
  towerRoofBase.translate(0, 22.6, towerZ);
  roofParts.push(towerRoofBase);

  addBox(ochreParts, 6.0, 0.95, 6.0, 0, 24.35, towerZ);
  addBox(trimParts, 6.4, 0.3, 6.4, 0, 24.85, towerZ);

  const towerRoofTop = createHippedRoofGeometry(6.8, 6.8, 0.8, 0.8, 2.05);
  towerRoofTop.translate(0, 24.95, towerZ);
  roofParts.push(towerRoofTop);

  // Spire base & finial rod reaching 28.5m
  addCyl(goldParts, 0.35, 0.58, 0.65, 8, 0, 27.05, towerZ);
  addCyl(goldParts, 0.08, 0.20, 1.25, 8, 0, 27.88, towerZ);

  // Three Large White Circular Clock Faces (3.4m diameter => radius = 1.70m) on North, West, East faces
  const clockRadius = 1.7;
  const clockY = 18.8;
  addClockDial(trimParts, goldParts, voidParts, 0, clockY, towerZ - 4.36, clockRadius, Math.PI);
  addClockDial(trimParts, goldParts, voidParts, -4.36, clockY, towerZ, clockRadius, -Math.PI * 0.5);
  addClockDial(trimParts, goldParts, voidParts, 4.36, clockY, towerZ, clockRadius, Math.PI * 0.5);

  // 12 Perimeter Indochine Heritage Streetlamps surrounding the market & North forecourt
  const lampCoords: Array<[number, number]> = [
    [-22, -39.5], [-10, -39.5], [10, -39.5], [22, -39.5],
    [-46, -38.0], [46, -38.0],
    [-53.5, -18.0], [-53.5, 18.0],
    [53.5, -18.0], [53.5, 18.0],
    [-24, 38.5], [24, 38.5]
  ];
  for (const [lx, lz] of lampCoords) {
    addHeritageStreetlampParts(ironParts, lampCoreParts, lx, 0.0, lz, 4.8, Math.abs(lz + 39.5) < 0.5);
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

  group.add(
    makeMergedMesh('BenThanhOchreWalls', ochreParts, ctx.materials.yellowOchrePlaster),
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

  const whiteMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

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

  // 2. Iconic 26m × 18m Oval White Stone Fountain Pond at (0, 195) (local z = -55) + Animated Water Jets
  const pondPlaza = new THREE.CylinderGeometry(15.6, 16.0, 0.30, 40);
  pondPlaza.scale(1.0, 1.0, 11.6 / 15.6);
  pondPlaza.translate(0, 0.01, lawnCenterZ);
  groundParts.push(colorizeGeometry(pondPlaza, '#c6beaa'));

  const rimPts: THREE.Vector2[] = [
    new THREE.Vector2(11.9, 0.04),
    new THREE.Vector2(13.0, 0.04),
    new THREE.Vector2(13.0, 0.72),
    new THREE.Vector2(11.9, 0.72),
    new THREE.Vector2(11.9, 0.04)
  ];
  const pondRim = new THREE.LatheGeometry(rimPts, 48);
  pondRim.scale(1.0, 1.0, 9.0 / 13.0);
  pondRim.translate(0, 0.0, lawnCenterZ);
  whiteParts.push(pondRim);

  // Central multi-tiered white marble fountain pedestal & bowls
  addCyl(whiteParts, 1.15, 1.65, 1.8, 20, 0, 0.95, lawnCenterZ);
  addCyl(whiteParts, 3.2, 0.9, 0.55, 24, 0, 1.95, lawnCenterZ);
  addCyl(whiteParts, 0.6, 0.85, 1.35, 16, 0, 2.75, lawnCenterZ);
  addCyl(whiteParts, 1.8, 0.45, 0.42, 20, 0, 3.45, lawnCenterZ);

  // Sculpted & Animated Fountain Water Jets arcing from the central marble bowls
  const centerPlume = new THREE.CylinderGeometry(0.14, 0.34, 3.2, 10, 1, true);
  centerPlume.translate(0, 5.1, lawnCenterZ);
  jetParts.push(centerPlume);
  for (let j = 0; j < 12; j++) {
    const a = (j / 12) * Math.PI * 2;
    const rEnd = j % 2 === 0 ? 6.8 : 4.6;
    const hPeak = j % 2 === 0 ? 4.9 : 4.2;
    const startR = j % 2 === 0 ? 1.55 : 0.75;
    const startY = j % 2 === 0 ? 2.25 : 3.65;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * startR, startY, lawnCenterZ + Math.sin(a) * startR * 0.75),
      new THREE.Vector3(Math.cos(a) * (startR + rEnd) * 0.45, hPeak, lawnCenterZ + Math.sin(a) * (startR + rEnd) * 0.34),
      new THREE.Vector3(Math.cos(a) * rEnd, 0.58, lawnCenterZ + Math.sin(a) * rEnd * 0.72)
    ]);
    jetParts.push(new THREE.TubeGeometry(curve, 12, 0.075, 6, false));
  }

  // Turquoise reflective fountain water disc
  const pondWaterGeo = new THREE.CylinderGeometry(12.05, 12.05, 0.12, 44);
  pondWaterGeo.scale(1.0, 1.0, 9.0 / 13.0);
  pondWaterGeo.translate(0, 0.52, lawnCenterZ);
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

  // 2c. Two Historic Tanks — T-54B #843 & Type-59 #390 displayed on the emerald front lawn!
  const tankSpecs: Array<{ x: number; z: number; rotY: number; num: string; title: string }> = [
    { x: -34.0, z: -46.0, rotY: 0.28, num: '843', title: 'XE TĂNG T-54B SỐ 843' },
    { x: 34.0, z: -46.0, rotY: -0.28, num: '390', title: 'XE TĂNG TYPE-59 SỐ 390' }
  ];
  for (const tk of tankSpecs) {
    // Low concrete museum exhibition pad under each tank
    addColoredBox(groundParts, '#b7b09f', 5.4, 0.24, 8.2, tk.x, 0.08, tk.z, tk.rotY);
    const { armorParts: tArmor, darkParts: tDark } = createHistoricalTankParts(tk.x, 0.20, tk.z, tk.rotY, 1.0);
    armorParts.push(...tArmor);
    darkMetalParts.push(...tDark);
    // Readable historical plaque pedestal beside each tank
    const px = tk.x + (tk.x < 0 ? 3.8 : -3.8);
    const pz = tk.z - 2.6;
    addBox(whiteParts, 1.35, 1.15, 0.42, px, 0.58, pz);
    const tankPlaque = createSignagePlaqueMesh(
      {
        text: tk.num,
        subText: tk.title,
        style: 'bronze',
        width: 1.55,
        height: 0.85,
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
  addBox(whiteParts, 92.0, 2.4, 36.0, 0, 0.6, 0);

  // Ground floor colonnade + OPEN Grand Ceremonial Foyer & Banquet Hall visible through North Portico
  addBox(voidParts, 83.0, 6.0, 14.5, 0, 4.8, 7.0);
  for (const sx of [-1, 1]) {
    addBox(voidParts, 28.5, 6.0, 14.0, sx * 27.25, 4.8, -7.25);
  }
  addBox(whiteParts, 26.2, 0.26, 14.5, 0, 7.62, -7.2);
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

  // Formal State Banquet Table with crimson velvet chairs
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

  // Upgraded Central 54m × 12m *Rèm Hoa Đá* Sun-Screen with Sculpted Bamboo-Node Joints (*Đốt Trúc*)!
  const louverZ = -16.8;
  const louverSpanW = 54.0;
  const numBlades = 41;
  const bladeSpacing = louverSpanW / (numBlades - 1);
  const nodeYs = [10.8, 13.0, 15.2, 17.4, 19.6];
  for (let i = 0; i < numBlades; i++) {
    const lx = -louverSpanW * 0.5 + i * bladeSpacing;
    // Sculpted slender bamboo-stalk core blade
    addBox(whiteParts, 0.28, 12.0, 0.88, lx, 14.8, louverZ);
    // 5 Flared sculpted bamboo-node joints (*đốt trúc*) per vertical louver
    for (let n = 0; n < nodeYs.length; n++) {
      const ny = nodeYs[n] + (i % 2 === 0 ? 0.0 : 0.45);
      addBox(whiteParts, 0.44, 0.24, 1.04, lx, ny, louverZ);
      addBox(whiteParts, 0.36, 0.42, 0.96, lx, ny, louverZ);
    }
    // Alternating geometric horizontal tie-bars creating the classic *Trúc* lattice
    if (i < numBlades - 1) {
      const segMid = lx + bladeSpacing * 0.5;
      const tierY1 = i % 2 === 0 ? 11.4 : 13.0;
      const tierY2 = i % 2 === 0 ? 16.6 : 18.2;
      addBox(whiteParts, bladeSpacing, 0.26, 0.52, segMid, tierY1, louverZ);
      addBox(whiteParts, bladeSpacing, 0.26, 0.52, segMid, 14.8, louverZ);
      addBox(whiteParts, bladeSpacing, 0.26, 0.52, segMid, tierY2, louverZ);
    }
  }

  // Recessed Symmetrical Side Wings flanking the 54m louver screen
  for (const sx of [-1, 1]) {
    addBox(whiteParts, 18.0, 0.8, 28.0, sx * 36.5, 14.8, 1.0);
    for (let k = 0; k < 4; k++) {
      const wx = sx * (29.5 + k * 4.8);
      addBox(whiteParts, 0.65, 12.0, 0.9, wx, 14.8, -12.6);
    }
    for (let j = -2; j <= 2; j++) {
      addBox(whiteParts, 0.9, 12.0, 0.55, sx * 44.8, 14.8, j * 5.8);
    }
  }

  // Rear T-Wing Presidential Quarters Extension (+Z rear of main palace, z in [+18..+38])
  addBox(whiteParts, 30.0, 2.2, 22.0, 0, 0.7, 27.0);
  addBox(voidParts, 26.0, 18.4, 19.0, 0, 11.2, 27.0);
  addBox(whiteParts, 31.0, 0.95, 22.5, 0, 8.3, 27.0);
  addBox(whiteParts, 31.0, 0.85, 22.5, 0, 14.8, 27.0);
  addBox(whiteParts, 32.0, 1.2, 23.2, 0, 21.35, 27.0);
  for (const sx of [-1, 1]) {
    for (let tz = 20.0; tz <= 36.0; tz += 4.0) {
      addBox(whiteParts, 0.75, 18.8, 0.55, sx * 14.8, 11.2, tz);
    }
  }

  // Cantilevered Upper Roof Slab (y = 20.8 .. 22.1m, 94m × 37m)
  addBox(whiteParts, 94.0, 1.3, 37.2, 0, 21.45, 0);

  // Rooftop Potted Tropical Trees lining East/West roof terrace flanks
  for (const sx of [-1, 1]) {
    for (const tz of [-12.0, -4.0, 4.0, 12.0]) {
      const px = sx * 38.0;
      addBox(whiteParts, 2.4, 1.1, 2.4, px, 22.65, tz);
      addColoredCylinder(foliageParts, '#6a4d32', 0.16, 0.22, 2.1, 6, px, 23.9, tz);
      const canopy = createSculptedRockGeometry(300 + Math.round(px + tz), 1.65, 1.35, 1.65, 1);
      canopy.translate(px, 25.4, tz);
      foliageParts.push(colorizeGeometry(canopy, '#2e7d34'));
    }
  }

  // Two Red Concentric Bomb-Impact Marker Circles on Roof Deck (April 8, 1975 historical site!)
  for (const [bx, bz] of [[-28.0, 5.0], [26.5, -4.5]] as Array<[number, number]>) {
    const rOuter = new THREE.RingGeometry(1.75, 2.15, 24);
    rOuter.rotateX(-Math.PI * 0.5);
    rOuter.translate(bx, 22.16, bz);
    const rInner = new THREE.RingGeometry(0.65, 1.05, 20);
    rInner.rotateX(-Math.PI * 0.5);
    rInner.translate(bx, 22.16, bz);
    crimsonParts.push(rOuter, rInner);
  }

  // Rooftop Ceremonial Pavilion (*Tứ Phương Vô Sự*) rising to 26.0m
  addBox(voidParts, 34.0, 2.7, 15.0, 0, 23.45, 1.5);
  for (let i = -3; i <= 3; i++) {
    addBox(whiteParts, 0.65, 2.8, 0.65, i * 5.4, 23.5, -6.2);
    addBox(whiteParts, 0.65, 2.8, 0.65, i * 5.4, 23.5, 9.2);
  }
  addBox(whiteParts, 39.0, 1.05, 18.5, 0, 25.47, 1.5);
  // Central axial flagpole completing Ngô Viết Thụ's ideogram "中" (Trung) + Helipad circle ("H")
  addCyl(whiteParts, 0.11, 0.18, 9.2, 8, 0, 30.6, -5.2);
  const topFinial = new THREE.SphereGeometry(0.24, 10, 8);
  topFinial.translate(0, 35.3, -5.2);
  goldParts.push(topFinial);
  const heliPadRing = new THREE.RingGeometry(4.4, 5.0, 28);
  heliPadRing.rotateX(-Math.PI * 0.5);
  heliPadRing.translate(0, 26.05, 3.8);
  goldParts.push(heliPadRing);
  addBox(goldParts, 0.55, 0.08, 4.2, -1.6, 26.05, 3.8);
  addBox(goldParts, 0.55, 0.08, 4.2, 1.6, 26.05, 3.8);
  addBox(goldParts, 3.4, 0.08, 0.55, 0, 26.05, 3.8);
  addBox(goldParts, 4.2, 1.4, 0.45, 0, 23.6, -6.3);

  // Iconic UH-1 Iroquois (Huey) Helicopter parked right atop the rooftop Helipad (y = 26.05m)!
  const { bodyParts: heliBody, darkParts: heliDark } = createUH1HelicopterParts(0, 26.05, 3.8, 0.65, 0.96);
  armorParts.push(...heliBody);
  darkMetalParts.push(...heliDark);

  // 4. Red-Carpeted 6m-Tall Entrance Portico & Broad Ceremonial Staircase (-Z North Front)
  addBox(whiteParts, 22.0, 0.95, 12.0, 0, 7.6, -23.5);
  for (const sx of [-9.2, 9.2]) {
    addBox(whiteParts, 0.95, 6.2, 0.95, sx, 4.2, -28.2);
    addBox(whiteParts, 0.95, 6.2, 0.95, sx, 4.2, -21.0);
  }
  addBox(whiteParts, 19.6, 1.8, 6.2, 0, 0.9, -19.5);
  for (const sx of [-9.4, 9.4]) {
    addBox(whiteParts, 0.9, 1.8, 8.0, sx, 0.9, -22.5);
  }
  for (let s = 0; s < 6; s++) {
    const stepY = 0.15 + s * 0.28;
    const stepZ = -26.2 + s * 0.9;
    addBox(whiteParts, 17.6, 0.28, 1.0, 0, stepY, stepZ);
    addBox(crimsonParts, 10.5, 0.08, 1.04, 0, stepY + 0.15, stepZ);
  }
  addBox(crimsonParts, 10.5, 0.08, 6.0, 0, 1.84, -18.0);
  addBox(crimsonParts, 9.8, 0.08, 10.0, 0, 0.16, -31.2);

  // 5. Twin 24m Flagpoles with Animated Waving Silk Vietnamese National Flags
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
    roughness: 0.82,
    metalness: 0.03
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

  group.add(
    makeMergedMesh('IndependencePalaceWhite', whiteParts, whiteMat),
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

  // Upgraded Tượng Đức Mẹ Hòa Bình (*Our Lady of Peace*) atop Square Granite Pedestal with Inscribed Plaque
  for (const side of [-1, 1]) {
    addBox(marbleParts, 9.6, 0.38, 0.44, 0, maryGroundRel + 0.22, maryZ + side * 4.6);
    addBox(marbleParts, 0.44, 0.38, 9.6, side * 4.6, maryGroundRel + 0.22, maryZ);
  }
  addBox(stoneParts, 4.4, 0.38, 4.4, 0, maryGroundRel + 0.22, maryZ);
  addBox(stoneParts, 3.2, 0.38, 3.2, 0, maryGroundRel + 0.58, maryZ);
  // Square Inscribed Granite Pedestal (y = 0.77 .. 2.85m)
  addBox(stoneParts, 1.85, 0.38, 1.85, 0, maryGroundRel + 0.96, maryZ);
  addBox(stoneParts, 1.38, 1.55, 1.38, 0, maryGroundRel + 1.92, maryZ);
  addBox(marbleParts, 1.62, 0.26, 1.62, 0, maryGroundRel + 2.80, maryZ);

  const maryPlaque = createSignagePlaqueMesh(
    {
      text: 'REGINA PACIS',
      subText: 'ORA PRO NOBIS',
      style: 'stone',
      width: 1.18,
      height: 0.64,
      depth: 0.08,
      motifSeed: 1959
    },
    ctx
  );
  maryPlaque.name = 'NotreDameReginaPacisPlaque';
  maryPlaque.position.set(0, maryGroundRel + 1.92, maryZ - 0.72);
  maryPlaque.rotation.y = Math.PI;
  group.add(maryPlaque);

  // Sculpted White Marble Virgin Mary holding Globe & Cross via createSculptedDeityParts
  const { bodyParts: maryBody, accentParts: maryAccent } = createSculptedDeityParts(
    0,
    maryGroundRel + 2.93,
    maryZ,
    Math.PI,
    0.84,
    'virgin_mary'
  );
  marbleParts.push(...maryBody);
  goldParts.push(...maryAccent);

  // 2. Main Romanesque-Gothic Nave & Side Aisles extended to TRUE 1:1 92.0m length (z in [-33.5 .. +58.5])
  // Rear solid nave & crossing (z in [-2.0 .. +49.0]) while front nave (z in [-31.5 .. -2.0]) is HOLLOW walk-in sanctuary!
  addBox(brickParts, 19.5, 21.0, 51.0, 0, 10.7, 23.5);
  for (const sx of [-1, 1]) {
    addBox(brickParts, 0.9, 21.0, 29.5, sx * 9.3, 10.7, -16.75);
  }
  addBox(stoneParts, 19.4, 0.55, 29.8, 0, 20.85, -16.75);

  const stainedPalette = ['#3a78d8', '#e6a832', '#c83434', '#2e9e7a'];
  for (let bay = 0; bay < 6; bay++) {
    const bz = -28.0 + bay * 4.4;
    // Ribbed Groin Vault Arches inside the hollow walk-in nave ceiling!
    const transArch = new THREE.TorusGeometry(5.6, 0.24, 7, 18, Math.PI);
    transArch.scale(1.0, 0.62, 1.0);
    transArch.translate(0, 17.1, bz);
    stoneParts.push(transArch);

    if (bay < 5) {
      const bayMidZ = bz + 2.2;
      const diagSpan = Math.hypot(5.6, 2.2);
      for (const diagSign of [-1, 1]) {
        const rib = new THREE.TorusGeometry(diagSpan, 0.16, 6, 14, Math.PI);
        rib.scale(1.0, 0.56, 1.0);
        rib.rotateY(diagSign * Math.atan2(2.2, 5.6));
        rib.translate(0, 17.1, bayMidZ);
        stoneParts.push(rib);
      }
      // Vault boss keystone medallion at crossing of diagonal groin ribs
      const boss = new THREE.SphereGeometry(0.32, 8, 6);
      boss.translate(0, 20.38, bayMidZ);
      goldParts.push(boss);
    }

    for (const sx of [-1, 1]) {
      // 12 Apostles interior nave pillars (6 on each side)
      addBox(stoneParts, 1.15, 0.72, 1.15, sx * 5.6, 0.76, bz);
      addCyl(stoneParts, 0.42, 0.46, 16.4, 12, sx * 5.6, 9.3, bz);
      addBox(stoneParts, 1.18, 0.58, 1.18, sx * 5.6, 17.75, bz);
      // Interior Chartres stained-glass lancet windows
      addColoredBox(stainedParts, stainedPalette[bay % stainedPalette.length], 0.22, 5.4, 1.65, sx * 8.75, 9.2, bz);
      if (bay < 5) {
        addBox(woodParts, 3.6, 0.92, 0.65, sx * 3.1, 0.86, bz + 1.4);
        addBox(woodParts, 3.6, 0.14, 0.55, sx * 3.1, 0.68, bz + 1.05);
      }
    }
  }

  // Carved Monolithic White-Marble High Altar (*Bàn Thờ Đá Cẩm Thạch*), Golden Tabernacle, Cross & 6 Candles
  addBox(marbleParts, 9.2, 0.52, 5.4, 0, 0.66, -5.2);
  addBox(marbleParts, 7.6, 0.45, 4.0, 0, 1.14, -4.8);
  addBox(marbleParts, 4.4, 1.25, 1.45, 0, 1.98, -4.4);
  addBox(goldParts, 3.6, 0.68, 0.12, 0, 1.96, -5.14);
  addBox(goldParts, 0.95, 1.25, 0.85, 0, 3.22, -4.15);
  addBox(goldParts, 0.22, 3.2, 0.22, 0, 5.45, -3.55);
  addBox(goldParts, 1.85, 0.22, 0.22, 0, 6.25, -3.55);
  for (const cxOff of [-1.8, -1.25, -0.7, 0.7, 1.25, 1.8]) {
    addCyl(goldParts, 0.06, 0.10, 0.68, 8, cxOff, 2.94, -4.35);
    glowParts.push(new THREE.SphereGeometry(0.11, 8, 8).translate(cxOff, 3.38, -4.35));
  }
  const naveAltarLight = new THREE.PointLight('#ffdca0', 3.0, 36, 1.3);
  naveAltarLight.position.set(0, 7.2, -10.5);
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

  // 3. Front Facade (-Z at z = -33.5): Triple 9m-tall Romanesque Arched Portals with Carved Tympanums
  const frontZ = -33.5;
  const centerPortal = createArchedWallGeometry(12.2, 13.4, 3.2, 6.2, 9.0);
  centerPortal.rotateY(Math.PI);
  centerPortal.translate(0, 0.2, frontZ - 1.2);
  brickParts.push(centerPortal);
  // Carved Portal Tympanum Arch & Triangular Gable Pediment above Central Portal
  const centerTympArch = new THREE.TorusGeometry(3.25, 0.26, 8, 20, Math.PI);
  centerTympArch.translate(0, 6.1, frontZ - 2.86);
  const centerTympLintel = new THREE.BoxGeometry(6.6, 0.42, 0.42);
  centerTympLintel.translate(0, 6.1, frontZ - 2.84);
  const centerGableTri = new THREE.ConeGeometry(4.4, 2.8, 3);
  centerGableTri.scale(1.2, 1.0, 0.16);
  centerGableTri.translate(0, 10.6, frontZ - 2.82);
  stoneParts.push(centerTympArch, centerTympLintel, centerGableTri);
  // Open carved dark-oak cathedral double portal doors folded outward
  for (const sx of [-1, 1]) {
    addBox(woodParts, 2.2, 6.8, 0.24, sx * 2.85, 3.6, frontZ - 2.65, sx * 0.72);
  }

  addBox(brickParts, 12.6, 11.4, 2.8, 0, 19.1, frontZ - 0.8);
  const centerGable = new THREE.ConeGeometry(8.4, 6.4, 4);
  centerGable.rotateY(Math.PI * 0.25);
  centerGable.scale(1.06, 1.0, 0.35);
  centerGable.translate(0, 28.0, frontZ - 0.8);
  brickParts.push(centerGable);
  addBox(stoneParts, 13.2, 0.55, 3.2, 0, 13.6, frontZ - 0.8);

  // Facade Clock Dial below the Rose Window (y = 11.6m)
  addClockDial(marbleParts, goldParts, voidParts, 0, 11.6, frontZ - 2.85, 1.25, Math.PI);

  // Iconic 3.6m Radius Circular Rose Window under Central Gable (y = 19.6m)
  const roseY = 19.6;
  const roseZ = frontZ - 2.25;
  const roseBackGlow = new THREE.CylinderGeometry(3.45, 3.45, 0.22, 32);
  roseBackGlow.rotateX(Math.PI * 0.5);
  roseBackGlow.translate(0, roseY, roseZ + 0.15);
  glowParts.push(roseBackGlow);

  const roseTracery = createRoseWindowGeometry(3.6, 16, 0.45);
  roseTracery.translate(0, roseY, roseZ - 0.08);
  stoneParts.push(roseTracery);

  // 4. Twin Symmetrical Red-Brick Bell Towers (57.6m spires, 60.5m with gleaming brass crosses!)
  for (const sx of [-1, 1]) {
    const tx = sx * 10.4;
    const tz = frontZ - 0.6;

    // Lower tower 9.0m-tall Romanesque arched side portal + Carved Stone Tympanum
    const sidePortal = createArchedWallGeometry(8.6, 12.5, 2.8, 4.4, 9.0);
    sidePortal.rotateY(Math.PI);
    sidePortal.translate(tx, 0.2, tz - 2.4);
    brickParts.push(sidePortal);
    addBox(voidParts, 4.1, 8.6, 1.6, tx, 4.5, tz - 0.8);

    const sideTymp = new THREE.TorusGeometry(2.35, 0.22, 7, 18, Math.PI);
    sideTymp.translate(tx, 6.9, tz - 3.84);
    const sideLintel = new THREE.BoxGeometry(4.8, 0.36, 0.36);
    sideLintel.translate(tx, 6.9, tz - 3.82);
    stoneParts.push(sideTymp, sideLintel);

    // Main brick belfry tower shaft rising to y = 36.6m (7.6m × 7.6m)
    addBox(brickParts, 7.6, 36.4, 7.6, tx, 18.4, tz);

    for (const bx of [-3.6, 3.6]) {
      for (const bz of [-3.6, 3.6]) {
        addBox(brickParts, 1.15, 36.0, 1.15, tx + bx, 18.2, tz + bz);
      }
    }

    // Tiered stone cornice rings
    addBox(stoneParts, 8.4, 0.55, 8.4, tx, 12.6, tz);
    addBox(stoneParts, 8.4, 0.55, 8.4, tx, 24.0, tz);
    addBox(stoneParts, 8.8, 0.75, 8.8, tx, 36.5, tz);

    // Romanesque Arched *Bifora* Twin Bell-Tower Windows on all 4 faces (Tier 2 & Tier 3 belfry)
    for (const archY of [18.5, 30.2]) {
      const biforaBaseY = archY - 3.2;
      for (const faceRot of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
        // Outer white-stone Romanesque double-arch surround + central stone mullion colonnette
        const frame = createArchedWallGeometry(4.2, 6.4, 0.38, 3.2, 5.6);
        frame.translate(0, biforaBaseY, 3.92);
        frame.rotateY(faceRot);
        frame.translate(tx, 0, tz);
        stoneParts.push(frame);

        const mullion = new THREE.CylinderGeometry(0.14, 0.16, 4.8, 8);
        mullion.translate(0, biforaBaseY + 2.4, 3.96);
        mullion.rotateY(faceRot);
        mullion.translate(tx, 0, tz);
        stoneParts.push(mullion);
      }
      addBox(voidParts, 3.1, 5.8, 7.76, tx, archY - 0.15, tz);
      addBox(voidParts, 7.76, 5.8, 3.1, tx, archY - 0.15, tz);
      for (let l = -2; l <= 2; l++) {
        addBox(brickParts, 3.0, 0.20, 7.68, tx, archY + l * 0.92, tz);
        addBox(brickParts, 7.68, 0.20, 3.0, tx, archY + l * 0.92, tz);
      }
    }

    // FIX Bug B14: Pass { skipCross: true } so patina cross never overlaps separate brass cross!
    const spireGeo = createGothicSpireGeometry(7.6, 22.82, 8, { skipCross: true });
    spireGeo.translate(tx, 36.6, tz);
    patinaParts.push(spireGeo);

    // Open-work Iron Collar Filigree encircling the octagonal spire base (y = 36.9..38.8m)
    const collarRingLo = new THREE.TorusGeometry(4.18, 0.10, 6, 16);
    collarRingLo.rotateX(Math.PI * 0.5);
    collarRingLo.translate(tx, 37.1, tz);
    const collarRingHi = new THREE.TorusGeometry(4.02, 0.10, 6, 16);
    collarRingHi.rotateX(Math.PI * 0.5);
    collarRingHi.translate(tx, 38.6, tz);
    ironParts.push(collarRingLo, collarRingHi);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      addCyl(ironParts, 0.06, 0.06, 1.65, 6, tx + Math.cos(a) * 4.10, 37.85, tz + Math.sin(a) * 4.10);
    }

    // 4 Small Gabled Dormer Lucarnes projecting around the lower third of each spire (y = 41.2m)
    for (let d = 0; d < 4; d++) {
      const da = (d / 4) * Math.PI * 2;
      const dx = tx + Math.cos(da) * 2.95;
      const dz = tz + Math.sin(da) * 2.95;
      addBox(patinaParts, 1.05, 1.75, 1.35, dx, 41.2, dz, -da + Math.PI * 0.5);
      const lucRoof = new THREE.ConeGeometry(0.85, 1.45, 4);
      lucRoof.rotateY(Math.PI * 0.25 - da);
      lucRoof.translate(dx, 42.75, dz);
      patinaParts.push(lucRoof);
    }

    // Gleaming brass/gold cross rising cleanly from 57.6m spire tip to 60.5m!
    const apexOrb = new THREE.SphereGeometry(0.36, 10, 8);
    apexOrb.translate(tx, 57.62, tz);
    goldParts.push(apexOrb);
    addBox(goldParts, 0.22, 2.9, 0.22, tx, 59.05, tz);
    addBox(goldParts, 1.75, 0.22, 0.22, tx, 59.55, tz);
  }

  const emeraldPatinaMat = new THREE.MeshStandardMaterial({
    color: '#3f8f76',
    roughness: 0.40,
    metalness: 0.46
  });
  const stainedGlassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color('#ffdca4'),
    emissiveIntensity: 0.55,
    roughness: 0.24
  });
  const parisIronMat = new THREE.MeshStandardMaterial({
    color: '#20262a',
    roughness: 0.40,
    metalness: 0.78
  });
  const plazaDecorMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.80,
    metalness: 0.04
  });
  ctx.extraMaterials.push(emeraldPatinaMat, stainedGlassMat, parisIronMat, plazaDecorMat);

  group.add(
    makeMergedMesh('NotreDameBrickBody', brickParts, ctx.materials.chamBrick),
    makeMergedMesh('NotreDameSlateRoof', roofParts, ctx.materials.darkRoof),
    makeMergedMesh('NotreDamePatinaSpires', patinaParts, emeraldPatinaMat),
    makeMergedMesh('NotreDameGoldCrosses', goldParts, ctx.materials.gold),
    makeMergedMesh('NotreDameRoseWindowGlow', glowParts, ctx.materials.lanternSilk, false, false),
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
  const woodParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const natureParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const graniteParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const tankArmorParts: THREE.BufferGeometry[] = [];
  const tankDarkParts: THREE.BufferGeometry[] = [];

  const relY = (lx: number, lz: number) => ctx.getHeight(cx + lx, cz + lz) - yCenter;

  // 1. Authentic Compact 0.55m × 0.55m Camouflaged Wooden Trapdoor Hatches nestled in fallen dry leaves
  const hatchCoords: Array<[number, number, number]> = [
    [-8.5, -9.0, 0.22],
    [1.5, -7.5, -0.35],
    [-3.5, -13.0, 0.08]
  ];
  const leafRand = mulberry32(67551);
  for (const [hx, hz, yaw] of hatchCoords) {
    const hy = relY(hx, hz);
    // Low organic laterite soil ring + scattered dry leaves concealing edges
    const mound = createSculptedRockGeometry(Math.round(Math.abs(hx * 17 + hz * 31)), 1.05, 0.16, 1.05, 1);
    mound.translate(hx, hy + 0.02, hz);
    natureParts.push(colorizeGeometry(mound, '#945230'));

    for (let lf = 0; lf < 14; lf++) {
      const la = leafRand() * Math.PI * 2;
      const lr = 0.35 + leafRand() * 0.95;
      addColoredBox(
        natureParts,
        lf % 2 === 0 ? '#6e5c32' : '#856c3a',
        0.24,
        0.025,
        0.16,
        hx + Math.cos(la) * lr,
        hy + 0.08,
        hz + Math.sin(la) * lr,
        leafRand() * Math.PI
      );
    }

    // Authentic 0.55m × 0.55m compact timber collar frame & dark drop shaft
    addBox(woodParts, 0.64, 0.18, 0.64, hx, hy + 0.10, hz, yaw);
    addBox(voidParts, 0.50, 0.48, 0.50, hx, hy - 0.02, hz, yaw);
    // Compact 0.55m × 0.55m ajar camouflaged trapdoor lid
    const lid = new THREE.BoxGeometry(0.55, 0.06, 0.55);
    lid.translate(0, 0.03, 0.275);
    lid.rotateX(-0.72);
    lid.rotateY(yaw);
    lid.translate(hx, hy + 0.18, hz - 0.27);
    woodParts.push(lid);

    const leafCover = new THREE.BoxGeometry(0.56, 0.045, 0.56);
    leafCover.translate(0, 0.075, 0.275);
    leafCover.rotateX(-0.72);
    leafCover.rotateY(yaw);
    leafCover.translate(hx, hy + 0.18, hz - 0.27);
    natureParts.push(colorizeGeometry(leafCover, '#6c5a30'));
  }

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

  // 5. Wrecked M41 Tank resting in the forest clearing at (-23.0, +11.5)
  const tkx = -23.0;
  const tkz = 11.5;
  const tky = relY(tkx, tkz);
  const { armorParts: m41Armor, darkParts: m41Dark } = createHistoricalTankParts(tkx, tky - 0.12, tkz, 0.72, 0.92);
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

  // 8. FIX Bug B16: Authentic 9-Story Octagonal Bến Dược Commemorative Tower (39.0m tall!) with 4-Sided Granite Stairs
  const bx = 18.0;
  const bz = 10.0;
  const by = relY(bx, bz);

  // Two-tier octagonal granite plinth (grounded deep into soil up to +1.8m)
  addCyl(graniteParts, 8.6, 9.2, 2.2, 8, bx, by + 0.1, bz);
  addCyl(graniteParts, 6.8, 7.4, 0.85, 8, bx, by + 1.42, bz);

  // 4-Sided Granite Approach Stairs (N/S/E/W) climbing onto the 1.8m memorial plinth (FIXES Bug B16!)
  for (let dir = 0; dir < 4; dir++) {
    const a = (dir / 4) * Math.PI * 2;
    for (let st = 0; st < 6; st++) {
      const dist = 10.6 - st * 0.58;
      const stepH = 0.30 * (st + 1);
      const sxp = bx + Math.sin(a) * dist;
      const szp = bz + Math.cos(a) * dist;
      addBox(graniteParts, 3.8, stepH, 0.68, sxp, by + stepH * 0.5, szp, a);
    }
    // Flanking stone stair cheek balustrades
    for (const side of [-2.05, 2.05]) {
      const chDist = 9.15;
      const chX = bx + Math.sin(a) * chDist + Math.cos(a) * side;
      const chZ = bz + Math.cos(a) * chDist - Math.sin(a) * side;
      addBox(graniteParts, 0.34, 1.35, 3.8, chX, by + 0.92, chZ, a, 0.28, 0);
    }
  }

  // 9 Diminishing Octagonal Stories rising from y = 1.8m to y = 36.2m + Gilded Finial Spire to 39.0m!
  let tierY = by + 1.82;
  for (let t = 0; t < 9; t++) {
    const frac = t / 8;
    const bodyR = THREE.MathUtils.lerp(4.4, 1.65, frac);
    const tierH = THREE.MathUtils.lerp(4.65, 2.85, frac);
    const eaveR = bodyR * 1.48;
    const roofH = Math.max(0.85, tierH * 0.34);

    // Octagonal crimson-accented core + 8 perimeter corner columns
    addCyl(crimsonParts, bodyR * 0.86, bodyR * 0.90, tierH, 8, bx, tierY + tierH * 0.5, bz);
    for (let c = 0; c < 8; c++) {
      const ca = (c / 8) * Math.PI * 2 + Math.PI / 8;
      addCyl(
        crimsonParts,
        Math.max(0.10, 0.24 * (1 - frac * 0.55)),
        Math.max(0.12, 0.28 * (1 - frac * 0.55)),
        tierH,
        8,
        bx + Math.cos(ca) * bodyR * 0.96,
        tierY + tierH * 0.5,
        bz + Math.sin(ca) * bodyR * 0.96
      );
    }
    // Shaded arched sanctuary windows on cardinal faces
    addBox(voidParts, bodyR * 0.45, tierH * 0.52, bodyR * 1.82, bx, tierY + tierH * 0.48, bz);
    addBox(voidParts, bodyR * 1.82, tierH * 0.52, bodyR * 0.45, bx, tierY + tierH * 0.48, bz);

    // Sculpted Octagonal Upturned Curved Terracotta Eave Roof on EVERY tier!
    const topR = t === 8 ? 0.28 : bodyR * 0.84;
    const eaveProfile = [
      new THREE.Vector2(eaveR * 1.06, 0.24),
      new THREE.Vector2(eaveR, 0.0),
      new THREE.Vector2((eaveR + topR) * 0.52, roofH * 0.42),
      new THREE.Vector2(topR, roofH)
    ];
    const octRoof = new THREE.LatheGeometry(eaveProfile, 8);
    octRoof.rotateY(Math.PI / 8);
    octRoof.translate(bx, tierY + tierH - 0.15, bz);
    roofParts.push(octRoof);

    // Upturned corner ridge tips
    for (let c = 0; c < 8; c++) {
      const ca = (c / 8) * Math.PI * 2 + Math.PI / 8;
      const tip = new THREE.ConeGeometry(Math.max(0.08, 0.18 * (1 - frac * 0.45)), 0.48, 5);
      tip.rotateZ(-0.42);
      tip.rotateY(-ca);
      tip.translate(bx + Math.cos(ca) * eaveR * 1.02, tierY + tierH + 0.18, bz + Math.sin(ca) * eaveR * 1.02);
      goldParts.push(tip);
    }

    tierY += tierH + roofH * 0.45;
  }
  // Gilded Lotus Finial crowning the 9-story tower at ~39.0m!
  addCyl(goldParts, 0.18, 0.42, 0.85, 8, bx, tierY + 0.45, bz);
  addCyl(goldParts, 0.04, 0.18, 2.2, 8, bx, tierY + 1.95, bz);
  const towerOrb = new THREE.SphereGeometry(0.28, 10, 8);
  towerOrb.translate(bx, tierY + 1.05, bz);
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
  const mainKalan = createChamTowerGeometry(8.2, 23.0, 4, { skipBuiltInVestibule: true });
  mainKalan.rotateY(Math.PI);
  mainKalan.translate(0, 0.55, 1.5);
  brickParts.push(mainKalan);

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

  // 4th Northwest Tower (*Tháp Tây Bắc* — Iconic *mái hình thuyền* boat/saddle-roofed Cham Kosa tower, 9.5m tall!)
  const nwX = -11.4;
  const nwZ = 10.6;
  addBox(brickParts, 6.2, 0.75, 4.8, nwX, 0.92, nwZ);
  addBox(brickParts, 5.4, 4.3, 4.0, nwX, 3.45, nwZ);
  // Corner pilasters & false arch doorway on NW tower
  for (const px of [-2.4, 0, 2.4]) {
    addBox(brickParts, 0.52, 4.3, 4.24, nwX + px, 3.45, nwZ);
  }
  addBox(sandstoneParts, 1.85, 0.38, 0.42, nwX, 3.85, nwZ - 2.12);
  // Iconic Curved Saddle / Boat-Shaped Vaulted Brick Roof (*mái hình thuyền*, y = 5.6 .. 9.5m)
  const saddleSegs = 12;
  const saddleLen = 6.2;
  for (let s = 0; s < saddleSegs; s++) {
    const t = s / (saddleSegs - 1); // 0..1 along X
    const u = (t - 0.5) * 2.0; // -1..1
    const segX = nwX + u * (saddleLen * 0.5);
    // Saddle curve dips gently in middle and flares dramatically upward at both gable ends!
    const crestLift = 1.25 * Math.pow(Math.abs(u), 2.1);
    const tierH = 2.65 + crestLift;
    const archW = 3.9 - 0.35 * (1.0 - Math.abs(u));
    const slice = new THREE.CylinderGeometry(archW * 0.42, archW * 0.54, saddleLen / saddleSegs + 0.08, 8, 1, false, 0, Math.PI);
    slice.rotateZ(Math.PI * 0.5);
    slice.scale(1.0, tierH / (archW * 0.52), 1.0);
    slice.translate(segX, 5.55, nwZ);
    brickParts.push(slice);
  }
  // Gilded gable finials at both upturned saddle ends reaching 9.5m
  for (const sx of [-1, 1]) {
    addCyl(goldParts, 0.06, 0.16, 0.65, 6, nwX + sx * 3.1, 9.52, nwZ);
  }

  // 3. Lower Mandapa Meditation Terrace at world (250, 255) => local (0, y, -25.0)
  const mandapaZ = -25.0;
  const mandapaGroundY = relY(0, mandapaZ);
  const mandapaTopY = Math.max(mandapaGroundY + 0.75, -3.6);

  addBox(graniteParts, 22.0, 8.5, 18.0, 0, mandapaTopY - 4.25, mandapaZ);
  addBox(graniteParts, 23.0, 0.55, 18.8, 0, mandapaTopY, mandapaZ);

  // Authentic Mandapa Layout: 10 Tall Central Octagonal Columns (6.2m, 2 rows × 5) + 12 Shorter Outer Columns (4.0m, 2 rows × 6) = 22 TOTAL!
  for (const rowX of [-2.4, 2.4]) {
    for (let i = 0; i < 5; i++) {
      const pz = mandapaZ - 5.6 + i * 2.8;
      addBox(graniteParts, 1.48, 0.48, 1.48, rowX, mandapaTopY + 0.36, pz);
      addCyl(brickParts, 0.50, 0.56, 5.10, 8, rowX, mandapaTopY + 3.15, pz);
      addCyl(brickParts, 0.74, 0.50, 0.62, 8, rowX, mandapaTopY + 6.01, pz); // total 6.2m tall!
    }
  }
  for (const rowX of [-7.6, 7.6]) {
    for (let i = 0; i < 6; i++) {
      const pz = mandapaZ - 6.75 + i * 2.7;
      addBox(graniteParts, 1.18, 0.38, 1.18, rowX, mandapaTopY + 0.32, pz);
      addCyl(brickParts, 0.38, 0.44, 3.12, 8, rowX, mandapaTopY + 2.06, pz);
      addCyl(brickParts, 0.56, 0.38, 0.48, 8, rowX, mandapaTopY + 3.86, pz); // total 4.0m tall!
    }
  }

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

  group.add(
    makeMergedMesh('PoNagarBrickTowers', brickParts, ctx.materials.chamBrick),
    makeMergedMesh('PoNagarGraniteTerracesAndSteps', graniteParts, ctx.materials.granite),
    makeMergedMesh('PoNagarSandstoneReliefs', sandstoneParts, ctx.materials.ochreSand ?? ctx.materials.stone),
    makeMergedMesh('PoNagarGoddessBlackStone', blackStoneParts, blackStoneMat),
    makeMergedMesh('PoNagarGoldAccents', goldParts, ctx.materials.gold),
    makeMergedMesh('PoNagarCrimsonOfferings', crimsonParts, ctx.materials.crimsonLacquer),
    makeMergedMesh('PoNagarBronzeCensers', bronzeParts, ctx.materials.bronze),
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

  // Traditional Mekong boat eyes (*mắt thuyền*) + Bow registration plates + Black rubber tire fenders!
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

  // Corrugated Curved Canopy (*mui thuyền*) on Timber/Bamboo Arch Ribs over stern/midship
  const canopyLen = length * 0.44;
  const canopyZ = -length * 0.14;
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
    watermelon: '#287a2e',
    pumpkin: '#e8761a',
    cabbage: '#8bc45a',
    coconut: '#4c8e35',
    banana: '#f2cc26'
  };
  const cargoCol = produceColorMap[poleType];
  const holdZ = length * 0.18;
  for (let r = 0; r < 3; r++) {
    for (let c = -2; c <= 2; c++) {
      const px = c * beam * 0.13;
      const pz = holdZ + (r - 1) * 0.65;
      const py = 0.58 + (1.0 - Math.abs(c) * 0.25) * 0.36;
      addColoredSphere(parts, cargoCol, 0.24, 7, 5, px, py, pz, 1.0, 0.85, 1.05);
    }
  }
  addColoredCylinder(parts, '#b9935a', 0.56, 0.44, 0.48, 9, -beam * 0.18, 0.66, holdZ + 1.15);
  addColoredCylinder(parts, '#b9935a', 0.52, 0.42, 0.46, 9, beam * 0.18, 0.66, holdZ + 1.25);

  // 7m Tall *Cây Bẹo* Bamboo Produce Pole rising from bow with 6 Distinct Produce Varieties!
  const poleH = 6.8 + (seed % 3) * 0.45;
  const poleZ = length * 0.28;
  const poleTilt = -0.20;
  const poleGeo = new THREE.CylinderGeometry(0.055, 0.095, poleH, 8);
  poleGeo.translate(0, poleH * 0.5, 0);
  poleGeo.rotateX(poleTilt);
  poleGeo.translate(0, 0.55, poleZ);
  parts.push(colorizeGeometry(poleGeo, '#c4a65e'));

  const tipY = 0.55 + Math.cos(poleTilt) * (poleH - 0.35);
  const tipZ = poleZ + Math.sin(poleTilt) * (poleH - 0.35);
  addColoredBox(parts, '#b79750', 1.25, 0.08, 0.08, 0, tipY, tipZ);

  for (const hx of [-0.44, 0, 0.44]) {
    addColoredCylinder(parts, '#9c8349', 0.02, 0.02, 0.62, 5, hx, tipY - 0.30, tipZ);
    if (poleType === 'pineapple') {
      addColoredSphere(parts, '#e8a820', 0.22, 8, 6, hx, tipY - 0.72, tipZ, 0.82, 1.35, 0.82);
      addColoredCone(parts, '#3e8c33', 0.18, 0.30, 6, hx, tipY - 0.42, tipZ);
    } else if (poleType === 'watermelon') {
      addColoredSphere(parts, '#25752a', 0.26, 8, 6, hx, tipY - 0.72, tipZ, 0.95, 1.18, 0.95);
    } else if (poleType === 'pumpkin') {
      addColoredSphere(parts, '#e8761a', 0.26, 8, 6, hx, tipY - 0.70, tipZ, 1.18, 0.78, 1.18);
      addColoredCylinder(parts, '#4c6e2c', 0.04, 0.05, 0.14, 5, hx, tipY - 0.48, tipZ);
    } else if (poleType === 'cabbage') {
      addColoredSphere(parts, '#8ec95e', 0.25, 8, 6, hx, tipY - 0.70, tipZ, 1.05, 0.95, 1.05);
      addColoredSphere(parts, '#5fa33d', 0.22, 6, 5, hx + 0.06, tipY - 0.72, tipZ + 0.05);
    } else if (poleType === 'coconut') {
      addColoredSphere(parts, '#4c8e35', 0.18, 7, 5, hx - 0.10, tipY - 0.68, tipZ);
      addColoredSphere(parts, '#43822e', 0.18, 7, 5, hx + 0.10, tipY - 0.74, tipZ + 0.06);
      addColoredSphere(parts, '#549a3c', 0.17, 7, 5, hx, tipY - 0.84, tipZ - 0.08);
    } else {
      // banana bunch
      for (let bn = -1; bn <= 1; bn++) {
        addColoredCylinder(parts, '#f2cc26', 0.06, 0.05, 0.46, 6, hx + bn * 0.11, tipY - 0.72, tipZ, 0, 0.22, bn * 0.26);
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

  // 8 Wooden Riverside Stilt Shophouses along the North Bank (z = 326..334) flanking the wharf!
  const shophouseXs = [-116, -106, -96, -86, -56, -46, -36, -26];
  const wallPalette = ['#d4b483', '#a8c2b8', '#d9a072', '#b8c4cf', '#cbb792', '#9fb8a5', '#d2a684', '#c5b89e'];
  const roofPalette = ['#8f3929', '#386a85', '#7c4e32', '#4c7559'];
  for (let s = 0; s < shophouseXs.length; s++) {
    const hx = shophouseXs[s];
    const hz = 330.0 + (s % 2) * 1.8;
    const hy = Math.max(1.4, ctx.getHeight(hx, hz) + 0.3);
    const hw = 7.4;
    const hd = 6.2;
    const hh = 3.8 + (s % 3) * 0.45;
    // Wooden river stilts plunging into muddy bank (-2.2m)
    for (const px of [-3.2, 0, 3.2]) {
      for (const pz of [-2.6, 2.6]) {
        addCyl(dockParts, 0.13, 0.16, hy + 2.2, 7, hx + px, (hy - 2.2) * 0.5, hz + pz);
      }
    }
    // Timber balcony deck overlooking the floating market
    addBox(dockParts, hw + 0.8, 0.22, hd + 2.4, hx, hy, hz + 0.8);
    // Shophouse timber walls & open shuttered shopfront
    addColoredBox(wharfProduceParts, wallPalette[s % wallPalette.length], hw, hh, hd, hx, hy + hh * 0.5 + 0.1, hz);
    addColoredBox(wharfProduceParts, '#47301e', 2.4, 2.2, 0.18, hx - 1.2, hy + 1.2, hz + hd * 0.5 + 0.08);
    addColoredBox(wharfProduceParts, '#2d6c4e', 1.4, 1.3, 0.18, hx + 1.8, hy + 1.8, hz + hd * 0.5 + 0.08);
    // Pitched corrugated Delta tin roof
    const sRoof = createHippedRoofGeometry(hw + 1.4, hd + 2.2, hw + 0.4, 0.25, 1.85);
    sRoof.translate(hx, hy + hh + 0.1, hz + 0.35);
    shophouseRoofParts.push(colorizeGeometry(sRoof, roofPalette[s % roofPalette.length]));
    // Warm porch bulb
    wharfLampParts.push(new THREE.SphereGeometry(0.16, 7, 6).translate(hx, hy + hh - 0.45, hz + hd * 0.5 + 1.2));
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
      // Tileable fine duckweed leaves with tiny dark-water gaps
      const r = Math.round(THREE.MathUtils.lerp(42, 168, cluster));
      const g = Math.round(THREE.MathUtils.lerp(96, 224, cluster));
      const b = Math.round(THREE.MathUtils.lerp(44, 134, cluster));
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

  // Tucked wooden paddle inside boat
  addColoredCylinder(parts, '#b9935a', 0.025, 0.025, 2.2, 6, 0.22, 0.19, 0.15, 0.06, Math.PI * 0.5, 0);

  // Conical nón lá hat & woven basket of pink lotus / emerald greens
  const basket = new THREE.CylinderGeometry(0.24, 0.18, 0.22, 8);
  basket.translate(-0.08, 0.24, 0.45);
  parts.push(colorizeGeometry(basket, '#c49b56'));

  const nonLa = new THREE.ConeGeometry(0.25, 0.18, 12);
  nonLa.translate(0.05, 0.28, -0.82);
  parts.push(colorizeGeometry(nonLa, '#dec98a'));

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

  const c1 = new THREE.Color('#246e2b');
  const c2 = new THREE.Color('#3d9932');
  const c3 = new THREE.Color('#184f22');
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

      // Wide open emerald water boat lane (distChan < 4.5m)
      const distChan = Math.abs(mz - channelZ(mx));
      if (distChan < 4.5) continue;

      const n = noise2D(mx * 0.24, mz * 0.24, 31.7) * 0.5 + 0.5;
      const n2 = noise2D(mx * 0.65, mz * 0.65, 11.2) * 0.5 + 0.5;
      if (ellipseR > 0.86 && n < 0.36) continue;

      tmpCol.copy(c1).lerp(c2, clampVal(n * 0.75 + n2 * 0.35));
      if (distChan < 6.0) tmpCol.lerp(c3, 0.52);

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
  // 2 Thatched Hexagonal Rest Pavilions (*Chòi nghỉ chân*) along the bamboo footbridge
  for (const pavX of [cx - 18.0, cx + 18.0]) {
    const pavZ = bridgeZ(pavX);
    addColoredCylinder(bridgeParts, '#c4a462', 2.8, 2.8, 0.18, 6, pavX, 1.18, pavZ);
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      addColoredCylinder(bridgeParts, '#8f6b3e', 0.09, 0.11, 4.4, 6, pavX + Math.cos(a) * 2.4, 0.95, pavZ + Math.sin(a) * 2.4);
    }
    addColoredCone(bridgeParts, '#b58d46', 3.4, 1.85, 6, pavX, 4.05, pavZ);
  }
  // Arched Bamboo Entrance Gate & Readable "RỪNG TRÀM TRÀ SƯ" Plaque at East Entry
  const gateX = bridgeStartX + 1.5;
  const gateZ = bridgeZ(bridgeStartX);
  for (const sz of [-1.45, 1.45]) {
    addColoredCylinder(bridgeParts, '#b89852', 0.12, 0.14, 4.4, 6, gateX, 2.2, gateZ + sz);
  }
  addColoredCone(bridgeParts, '#b58d46', 2.4, 1.1, 4, gateX, 4.65, gateZ, Math.PI * 0.25);
  const traSuSign = createSignagePlaqueMesh(
    { text: 'RỪNG TRÀM TRÀ SƯ', subText: 'CẦU TRE VẠN BƯỚC', width: 4.4, height: 0.9, style: 'market' },
    ctx
  );
  traSuSign.rotation.y = Math.PI * 0.5;
  traSuSign.position.set(gateX, 3.85, gateZ);
  group.add(traSuSign);

  // 3b. Iconic 23m-Tall Observation Tower (*Đài Quan Sát*) rising high above the Melaleuca canopy at (cx - 16, cz - 22)
  const obsX = cx - 16.0;
  const obsZ = cz - 22.0;
  const towerSteelParts: THREE.BufferGeometry[] = [];
  for (const ox of [-2.4, 2.4]) {
    for (const oz of [-2.4, 2.4]) {
      addCyl(towerSteelParts, 0.14, 0.22, 20.8, 7, obsX + ox, 9.6, obsZ + oz);
    }
  }
  for (let tier = 0; tier < 5; tier++) {
    const ty = 3.2 + tier * 4.0;
    addBox(towerSteelParts, 5.1, 0.22, 5.1, obsX, ty, obsZ);
    if (tier === 4) {
      // Top observation deck + safety rails at y = 19.2m
      for (const s of [-2.5, 2.5]) {
        addBox(towerSteelParts, 5.2, 0.12, 0.12, obsX, ty + 1.15, obsZ + s);
        addBox(towerSteelParts, 0.12, 0.12, 5.2, obsX + s, ty + 1.15, obsZ);
      }
      addCyl(towerSteelParts, 0.85, 0.95, 19.2, 8, obsX, 9.4, obsZ); // central spiral staircase core
    }
  }
  const obsRoof = createVietnameseCurvedRoofGeometry(6.8, 6.8, 0.6, 0.6, 3.4, 0.35);
  obsRoof.translate(obsX, 20.6, obsZ);
  const obsRoofMat = ctx.materials.terracottaRoof;
  const obsTowerMat = new THREE.MeshStandardMaterial({ color: '#465866', metalness: 0.65, roughness: 0.38 });
  ctx.extraMaterials.push(obsTowerMat);
  group.add(
    new THREE.Mesh(mergeNormalized(towerSteelParts), obsTowerMat),
    new THREE.Mesh(obsRoof, obsRoofMat)
  );

  // 3c. Floating Purple Water Hyacinth (*Lục Bình*) & 20 Perched White Egrets (*Cò Trắng*) + Nests
  const wildlifeParts: THREE.BufferGeometry[] = [];
  const randWild = mulberry32(99512);
  for (let i = 0; i < 36; i++) {
    const hx = cx + (randWild() - 0.5) * 92;
    const hz = channelZ(hx) + (randWild() > 0.5 ? 1 : -1) * (3.2 + randWild() * 2.2);
    addColoredSphere(wildlifeParts, '#3a8832', 0.42, 6, 5, hx, 0.08, hz, 1.2, 0.45, 1.2);
    addColoredSphere(wildlifeParts, '#9a5de8', 0.18, 6, 5, hx, 0.28, hz);
  }
  for (let e = 0; e < 20; e++) {
    const ex = cx + (randWild() - 0.5) * 86;
    const ez = cz + (randWild() - 0.5) * 68;
    if (Math.abs(ez - channelZ(ex)) < 5.0) continue;
    const ey = 13.6 + randWild() * 2.4;
    addColoredCylinder(wildlifeParts, '#6b4c28', 0.48, 0.32, 0.22, 8, ex, ey - 0.25, ez); // twig nest
    addColoredSphere(wildlifeParts, '#f7f7f2', 0.22, 7, 5, ex, ey, ez, 0.85, 0.72, 1.45);
    addColoredCone(wildlifeParts, '#e09128', 0.06, 0.24, 5, ex, ey + 0.28, ez + 0.22, 0, Math.PI * 0.45, 0);
  }
  const wildlifeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68 });
  ctx.extraMaterials.push(wildlifeMat);
  group.add(new THREE.Mesh(mergeNormalized(wildlifeParts), wildlifeMat));

  const bridgeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.05
  });
  ctx.extraMaterials.push(bridgeMat);
  group.add(makeMergedMesh('TraSuBambooFootbridge', bridgeParts, bridgeMat));

  // 4. 300 Instanced 13–17m Tall Slender White-Barked Melaleuca (*cây tràm*) Trunks & Crowns
  const trunkParts: THREE.BufferGeometry[] = [];
  const mainStem = new THREE.CylinderGeometry(0.11, 0.21, 13.4, 7);
  mainStem.translate(0, 6.7, 0);
  trunkParts.push(mainStem);
  const forkA = new THREE.CylinderGeometry(0.065, 0.12, 5.2, 6);
  forkA.rotateZ(0.26);
  forkA.translate(-0.62, 10.6, 0.22);
  trunkParts.push(forkA);
  const forkB = new THREE.CylinderGeometry(0.06, 0.11, 4.8, 6);
  forkB.rotateZ(-0.24);
  forkB.rotateX(0.18);
  forkB.translate(0.58, 10.9, -0.32);
  trunkParts.push(forkB);
  const trunkGeo = mergeNormalized(trunkParts);

  const canopyParts: THREE.BufferGeometry[] = [];
  const cardOffsets: Array<[number, number, number, number]> = [
    [0, 12.8, 0, 5.2],
    [-1.15, 11.6, 0.55, 4.1],
    [1.15, 11.8, -0.55, 4.1],
    [0, 13.8, 0, 3.8]
  ];
  for (const [ox, oy, oz, sz] of cardOffsets) {
    for (let k = 0; k < 3; k++) {
      const card = new THREE.PlaneGeometry(sz, sz * 0.88);
      card.rotateY((k / 3) * Math.PI);
      card.translate(ox, oy, oz);
      canopyParts.push(card);
    }
  }
  const canopyGeo = mergeNormalized(canopyParts);

  const melaleucaBarkMat = new THREE.MeshStandardMaterial({
    color: '#ebe4d4',
    map: ctx.pbr.plaster.map,
    normalMap: ctx.pbr.bark.normalMap,
    roughness: 0.88
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

  const maxTrees = 300;
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

  for (let attempt = 0; attempt < 2000 && treeIdx < maxTrees; attempt++) {
    const rx = (rand() * 2 - 1) * 56.0;
    const rz = (rand() * 2 - 1) * 45.5;
    if (Math.hypot(rx / 56.0, rz / 45.5) > 0.96) continue;

    const wx = cx + rx;
    const wz = cz + rz;

    // Keep open boat canal, bamboo footbridge, pavilions & Observation Tower unobstructed
    if (Math.abs(wz - channelZ(wx)) < 6.0) continue;
    if (Math.abs(wz - bridgeZ(wx)) < 3.8) continue;
    if (Math.hypot(wx - obsX, wz - obsZ) < 6.5) continue;
    if (rx > 12.0 && Math.abs(wz - channelZ(wx)) < 11.5) continue;

    const wy = ctx.getHeight(wx, wz);
    const sc = 0.92 + rand() * 0.30; // ~13-17m tall!
    const leanX = (rand() - 0.5) * 0.14;
    const leanZ = (rand() - 0.5) * 0.14;

    dummy.compose(
      new THREE.Vector3(wx, Math.min(-0.1, wy - 0.2), wz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(leanX, rand() * Math.PI * 2, leanZ)),
      new THREE.Vector3(sc, sc * (0.94 + rand() * 0.22), sc)
    );
    trunkInst.setMatrixAt(treeIdx, dummy);
    canopyInst.setMatrixAt(treeIdx, dummy);

    col.setHSL(0.28 + (rand() - 0.5) * 0.04, 0.52, 0.38 + rand() * 0.14);
    canopyInst.setColorAt(treeIdx, col);
    treeIdx++;
  }

  trunkInst.count = treeIdx;
  canopyInst.count = treeIdx;
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;

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

  // 2. Authentic 4-Pointed Granite Star GPS 0001 Monument + Km 2436 Plaza Marker at (0, 465)
  const gpsZ = 465.0;
  addCyl(graniteParts, 4.6, 5.0, 0.45, 24, 0, deckY + 0.22, gpsZ);
  addBox(graniteParts, 4.8, 0.55, 1.65, 0, deckY + 0.72, gpsZ);
  addBox(graniteParts, 1.65, 0.55, 4.8, 0, deckY + 0.72, gpsZ);
  addBox(graniteParts, 1.45, 2.35, 1.45, 0, deckY + 1.85, gpsZ);
  addCyl(graniteParts, 0.12, 0.95, 0.65, 4, 0, deckY + 3.35, gpsZ, 0, Math.PI * 0.25);

  const gpsSign = createSignagePlaqueMesh(
    { text: 'GPS 0001 — KM 2436', subText: 'MŨI CÀ MAU — CỰC NAM', width: 2.2, height: 0.95, style: 'stone' },
    ctx
  );
  gpsSign.rotation.y = Math.PI;
  gpsSign.position.set(0, deckY + 1.85, gpsZ - 0.78);
  group.add(gpsSign);

  // 2b. Cột Cờ Hà Nội tại Mũi Cà Mau (36m-tall Red-Brick Replica at (20, 474))
  const fcx = 20.0;
  const fcz = 474.0;
  const fcy = ctx.getHeight(fcx, fcz);
  const brickFlagParts: THREE.BufferGeometry[] = [];
  addBox(brickFlagParts, 11.4, 3.2, 11.4, fcx, fcy + 1.1, fcz);
  addBox(brickFlagParts, 8.2, 2.8, 8.2, fcx, fcy + 4.1, fcz);
  addBox(brickFlagParts, 5.4, 2.4, 5.4, fcx, fcy + 6.7, fcz);
  addCyl(brickFlagParts, 1.85, 2.55, 16.5, 8, fcx, fcy + 16.1, fcz);
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
  group.add(makeMergedMesh('MuiCaMauHanoiFlagTower', brickFlagParts, ctx.materials.chamBrick));

  // 3. Iconic 18m-Long Con Tàu Mũi Cà Mau Prow & Sculpted White Concrete Sail Monument at (0, 491)
  const shipZ = 491.0;
  // Deep masonry pedestal grounded to y = -2.0m & boarding steps on North stern
  addColoredBox(shipParts, '#c6bfb0', 9.2, 4.4, 17.5, 0, 0.2, shipZ);
  for (let st = 0; st < 5; st++) {
    addColoredBox(shipParts, '#cfc8b8', 3.6, 0.45, 0.75, 0, deckY + 0.35 + st * 0.42, shipZ - 9.8 + st * 0.75);
  }

  // Crisp stone-white (#ebe6da) 18.0m-long sculptural ship hull & sweeping prow pointing +Z south
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
  shipParts.push(colorizeGeometry(hullGeo, '#ebe6da'));

  addColoredBox(shipParts, '#d99e36', 4.8, 0.55, 12.6, 0, deckY + 4.3, shipZ - 0.8);
  addColoredBox(shipParts, '#d99e36', 0.55, 3.2, 7.2, 0, deckY + 5.4, shipZ + 4.5, 0, -0.35, 0);

  // Authentic Sculpted White Concrete Sail Monument (#f2ede2) rising 16.5m above hull
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-3.8, 0);
  sailShape.quadraticCurveTo(-2.8, 8.8, -0.5, 16.4);
  sailShape.lineTo(1.0, 15.2);
  sailShape.quadraticCurveTo(4.8, 7.6, 4.4, 0);
  sailShape.closePath();

  const sailGeo = new THREE.ExtrudeGeometry(sailShape, {
    depth: 0.78,
    bevelEnabled: true,
    bevelSize: 0.10,
    bevelThickness: 0.10,
    bevelSegments: 2
  });
  sailGeo.translate(0, 0, -0.39);
  sailGeo.rotateY(Math.PI * 0.5);
  sailGeo.translate(0, deckY + 4.4, shipZ - 0.6);
  shipParts.push(colorizeGeometry(sailGeo, '#f2ede2'));

  // Gold mast rib + Waving Vietnam Flag atop Sail Peak + Readable "MŨI CÀ MAU" Plaque
  addColoredBox(shipParts, '#d99e36', 0.92, 15.2, 0.42, 0, deckY + 12.0, shipZ - 3.0);
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
  spFlagMesh.position.set(0, deckY + 21.8, shipZ - 0.6);
  group.add(spFlagMesh);

  const conTauSign = createSignagePlaqueMesh(
    { text: 'MŨI CÀ MAU', subText: '8°37\'30"N — 104°43\'E', width: 4.2, height: 1.5, style: 'stone', bgColor: '#ebe6da', textColor: '#a4221b', borderColor: '#d99e36' },
    ctx
  );
  conTauSign.rotation.y = Math.PI * 0.5;
  conTauSign.position.set(-0.46, deckY + 11.4, shipZ - 0.4);
  group.add(conTauSign);

  // 4. 64 Arching-Root Coastal Mangrove Trees (*Cây Đước*) + Concrete Wave Seawall + 2 Vỏ Lãi Boats
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
    mangCount++;
  }
  // Offshore coastal wave-breaker concrete seawall & 2 slender Vỏ Lãi boats
  for (let s = -4; s <= 4; s++) {
    addBox(graniteParts, 4.8, 1.35, 1.2, s * 6.2, 0.45, 512.0 + Math.abs(s) * 0.6);
  }
  for (const [vx, vz] of [
    [-22.0, 518.0],
    [24.0, 516.0]
  ]) {
    addColoredBox(shipParts, '#2980b9', 7.2, 0.45, 1.25, vx, 0.15, vz, 0.25);
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
  // Woven beach hammock slung between coastal palms & waterfront timber swing at (-344, 470)
  const hammock = new THREE.CylinderGeometry(0.42, 0.42, 3.2, 8, 1, true, 0, Math.PI);
  hammock.rotateZ(Math.PI * 0.5);
  hammock.translate(-356.0, ctx.getHeight(-356, 472) + 1.15, 472.5);
  organicParts.push(colorizeGeometry(hammock, '#e8dcc0'));
  for (const sx of [-345.2, -342.8]) {
    addCyl(woodParts, 0.09, 0.11, 3.2, 6, sx, 1.4, 469.5);
  }
  addCyl(woodParts, 0.08, 0.08, 2.8, 6, -344.0, 2.95, 469.5, 0, 0, Math.PI * 0.5);
  addBox(woodParts, 1.25, 0.10, 0.45, -344.0, 0.95, 469.5);

  // 2b. Iconic Mũi Dinh Cậu Cape Shrine & Dương Đông Lighthouse on NW Granite Headland (-372, 476)
  const dcX = -372.0;
  const dcZ = 476.0;
  const dcRock = createSculptedRockGeometry(905, 8.2, 4.8, 7.8, 2);
  dcRock.translate(dcX, 2.2, dcZ);
  boulderParts.push(dcRock);
  const dcDeckY = 4.95;
  const dcStoneParts: THREE.BufferGeometry[] = [];
  addBox(dcStoneParts, 8.8, 0.55, 8.2, dcX, dcDeckY, dcZ);
  for (let st = 0; st < 14; st++) {
    addBox(dcStoneParts, 2.8, 0.35, 0.72, dcX + 5.2 + st * 0.52, dcDeckY - st * 0.28, dcZ + 1.8);
  }
  // Red-tiled Miếu Dinh Cậu shrine + twin ridge dragons + readable "DINH CẬU" plaque
  for (const sx of [-2.2, 2.2]) {
    for (const sz of [-1.8, 1.8]) {
      const col = colorizeGeometry(new THREE.CylinderGeometry(0.14, 0.16, 2.8, 8).translate(dcX + sx, dcDeckY + 1.65, dcZ + sz), '#c89b32');
      organicParts.push(col);
    }
  }
  const dcShrineWall = colorizeGeometry(new THREE.BoxGeometry(4.8, 2.8, 3.6).translate(dcX - 0.3, dcDeckY + 1.65, dcZ), '#f0e7d6');
  const dcRoof = createVietnameseCurvedRoofGeometry(6.4, 5.2, 2.2, 0.4, 2.0, 0.36);
  dcRoof.translate(dcX, dcDeckY + 3.05, dcZ);
  organicParts.push(dcShrineWall, colorizeGeometry(dcRoof, '#a62c22'));
  const dcFinial = createRoofFinialSetParts(dcX, dcDeckY + 5.05, dcZ, 2.4, 0, 0.55);
  for (const fg of [...dcFinial.mainParts, ...dcFinial.goldParts]) {
    organicParts.push(colorizeGeometry(fg, '#e5b838'));
  }
  const dcSign = createSignagePlaqueMesh({ text: 'MIẾU DINH CẬU', subText: 'PHÚ QUỐC', width: 2.6, height: 0.65, style: 'royal' }, ctx);
  dcSign.rotation.y = Math.PI * 0.5;
  dcSign.position.set(dcX + 2.35, dcDeckY + 2.85, dcZ);
  group.add(dcSign);

  // 18m-tall Blue-and-White Striped Dương Đông Lighthouse beside Dinh Cậu
  const lhX = dcX - 4.2;
  const lhZ = dcZ - 2.4;
  for (let band = 0; band < 6; band++) {
    const seg = new THREE.CylinderGeometry(1.05 - band * 0.08, 1.15 - band * 0.08, 2.4, 12);
    seg.translate(lhX, dcDeckY + 1.2 + band * 2.4, lhZ);
    organicParts.push(colorizeGeometry(seg, band % 2 === 0 ? '#f2f2ef' : '#1b5f9e'));
  }
  const lhGallery = new THREE.CylinderGeometry(1.25, 1.05, 0.45, 12).translate(lhX, dcDeckY + 14.6, lhZ);
  const lhDome = new THREE.ConeGeometry(0.95, 1.35, 10).translate(lhX, dcDeckY + 16.5, lhZ);
  organicParts.push(colorizeGeometry(lhGallery, '#f2f2ef'), colorizeGeometry(lhDome, '#1b5f9e'));
  lanternCoreParts.push(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10).translate(lhX, dcDeckY + 15.4, lhZ));
  group.add(makeMergedMesh('PhuQuocDinhCauStone', dcStoneParts, ctx.materials.stone));

  // 2c. 3 Moored Blue-and-Red Phú Quốc Fishing Boats + 3 Round Basket Boats (*Thuyền Thúng*)
  for (const [bx, bz, byaw] of [
    [-327.0, 444.0, 0.12],
    [-343.0, 434.0, -0.15],
    [-324.0, 422.0, 0.25]
  ]) {
    const hull = new THREE.BoxGeometry(2.6, 1.15, 8.2);
    hull.rotateY(byaw);
    hull.translate(bx, 0.15, bz);
    const cabin = new THREE.BoxGeometry(1.9, 1.35, 3.4);
    cabin.rotateY(byaw);
    cabin.translate(bx, 1.25, bz);
    organicParts.push(colorizeGeometry(hull, '#1f5e9c'), colorizeGeometry(cabin, '#b83227'));
  }
  for (const [tx, tz] of [
    [-326.0, 474.0],
    [-323.5, 475.5],
    [-346.5, 473.5]
  ]) {
    const ty = ctx.getHeight(tx, tz);
    const thung = new THREE.CylinderGeometry(0.95, 0.65, 0.48, 12);
    thung.translate(tx, ty + 0.24, tz);
    organicParts.push(colorizeGeometry(thung, '#8b6331'));
  }

  // 3. 10–14m Tall Curved Coconut Palms (*dừa biển*) lining the sandy crescent cove
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
    const segs = 8;

    let curX = px;
    let curY = py;
    let curZ = pz;

    for (let s = 0; s < segs; s++) {
      const t = (s + 0.5) / segs;
      const segLen = palmH / segs;
      const dx = leanX * t * 0.72;
      const dz = leanZ * t * 0.72;
      const rBot = THREE.MathUtils.lerp(0.36, 0.17, s / segs);
      const rTop = THREE.MathUtils.lerp(0.36, 0.17, (s + 1) / segs);

      const segGeo = new THREE.CylinderGeometry(rTop, rBot, segLen * 1.12, 8);
      segGeo.rotateZ(-dx * 0.75);
      segGeo.rotateX(dz * 0.75);
      segGeo.translate(curX + dx * 0.5, curY + segLen * 0.5, curZ + dz * 0.5);
      organicParts.push(colorizeGeometry(segGeo, s % 2 === 0 ? '#8c7256' : '#7a6147'));

      curX += dx;
      curY += segLen * 0.94;
      curZ += dz;
    }

    for (let c = 0; c < 4; c++) {
      const ca = (c / 4) * Math.PI * 2;
      const nut = new THREE.SphereGeometry(0.24, 7, 6);
      nut.translate(curX + Math.cos(ca) * 0.34, curY - 0.25, curZ + Math.sin(ca) * 0.34);
      organicParts.push(colorizeGeometry(nut, '#6a4822'));
    }

    const numFronds = 9;
    for (let f = 0; f < numFronds; f++) {
      const ang = (f / numFronds) * Math.PI * 2 + p * 0.4;
      const frondLen = 3.8 + rand() * 0.9;
      const frondGeo = new THREE.PlaneGeometry(1.15, frondLen, 2, 6);
      const fPos = frondGeo.attributes.position;
      for (let vi = 0; vi < fPos.count; vi++) {
        const fx = fPos.getX(vi);
        const fy = fPos.getY(vi);
        const ft = (fy + frondLen * 0.5) / frondLen;
        const archY = Math.sin(ft * Math.PI * 0.65) * 1.15 - Math.pow(ft, 2.0) * 1.85;
        const archZ = ft * frondLen;
        const taperW = Math.sin(ft * Math.PI) * 1.15 + 0.15;
        fPos.setXYZ(vi, fx * taperW, archY, archZ);
      }
      frondGeo.computeVertexNormals();
      frondGeo.rotateY(ang);
      frondGeo.translate(curX, curY, curZ);
      organicParts.push(colorizeGeometry(frondGeo, f % 2 === 0 ? '#3a8c32' : '#4ea33b'));
    }
  }

  // 4. Granite Cove Boulders along beach points
  const boulderCoords: Array<[number, number, number, number, number]> = [
    [-372, 476, 4.4, 2.8, 3.8],
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
  const roofParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];

  const colonialStoneMat = ctx.materials.ochreSand ?? ctx.materials.yellowOchrePlaster;

  // 1. Dramatic 20m-Tall Coastal Granite Boulder Arches framing northwest turquoise cove (304, 465)
  const archX = 304.0;
  const archZ = 465.0;
  const archYaw = 0.55;

  // Twin massive granite pillars deeply grounded to y = -3.0m
  const pillarW = createSculptedRockGeometry(101, 5.4, 9.6, 5.0, 3);
  pillarW.translate(-8.4, 6.2, 0);
  pillarW.rotateY(archYaw);
  pillarW.translate(archX, 0, archZ);
  graniteParts.push(pillarW);

  const pillarE = createSculptedRockGeometry(202, 5.0, 9.2, 4.8, 3);
  pillarE.translate(8.4, 5.8, 0);
  pillarE.rotateY(archYaw);
  pillarE.translate(archX, 0, archZ);
  graniteParts.push(pillarE);

  // Rugged granite arch span overhead reaching 20.0m tall!
  const archSpan = createSculptedRockGeometry(303, 13.5, 4.2, 5.2, 3);
  archSpan.translate(0, 16.0, 0);
  archSpan.rotateY(archYaw);
  archSpan.translate(archX, 0, archZ);
  graniteParts.push(archSpan);

  // Coastal granite boulders sunken firmly into shore slopes
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

  // Arched masonry stone piers grounded down into seabed (y = -3.0m)
  for (let pz = 428.0; pz <= 464.0; pz += 6.0) {
    addBox(stoneParts, 6.0, 5.0, 2.0, pierX, pierDeckY - 2.6, pz);
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

  const porticoWall = createArchedWallGeometry(16.0, 7.6, 3.2, 5.4, 6.0);
  porticoWall.translate(pierX, porticoDeckY, portZ);
  ochreParts.push(porticoWall);
  for (const sx of [-1, 1]) {
    addBox(ochreParts, 3.0, 7.6, 3.8, pierX + sx * 6.4, porticoDeckY + 3.8, portZ);
    addBox(stoneParts, 3.4, 0.5, 4.2, pierX + sx * 6.4, porticoDeckY + 7.7, portZ);
    // Flanking French-colonial arched arcade wings (Dinh Chúa Đảo style)
    for (let b = 0; b < 2; b++) {
      const wx = pierX + sx * (10.5 + b * 4.4);
      const archBay = createArchedWallGeometry(4.4, 6.4, 4.2, 2.4, 4.6);
      archBay.translate(wx, porticoDeckY, portZ + 0.4);
      ochreParts.push(archBay);
      addBox(stoneParts, 4.6, 0.4, 4.6, wx, porticoDeckY + 6.5, portZ + 0.4);
    }
    const wingRoof = createHippedRoofGeometry(9.6, 5.4, 6.4, 0.4, 2.2);
    wingRoof.translate(pierX + sx * 12.7, porticoDeckY + 6.6, portZ + 0.4);
    roofParts.push(wingRoof);
  }
  const porticoRoof = createHippedRoofGeometry(17.8, 6.4, 10.2, 0.6, 3.1);
  porticoRoof.translate(pierX, porticoDeckY + 7.6, portZ);
  roofParts.push(porticoRoof);

  // Readable "DI TÍCH LỊCH SỬ CẦU TÀU 914" Stele Plaque + Cast-Iron Mooring Bollards + Heritage Streetlamps + 2 Boats
  const cdPierSign = createSignagePlaqueMesh(
    { text: 'CẦU TÀU 914', subText: 'DI TÍCH LỊCH SỬ CÔN ĐẢO', width: 3.8, height: 0.95, style: 'stone' },
    ctx
  );
  cdPierSign.rotation.y = Math.PI;
  cdPierSign.position.set(pierX + 4.4, porticoDeckY + 1.65, 461.5);
  group.add(cdPierSign);

  const ironLampParts: THREE.BufferGeometry[] = [];
  const candleGlowParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];

  for (let pz = 428; pz <= 456; pz += 7.0) {
    for (const sx of [-2.85, 2.85]) {
      addCyl(ironLampParts, 0.14, 0.19, 0.72, 8, pierX + sx, pierDeckY + 0.42, pz);
    }
    if (pz === 435 || pz === 449) {
      addHeritageStreetlampParts(ironLampParts, candleGlowParts, pierX - 2.9, pierDeckY + 0.85, pz, 3.6, false);
      addHeritageStreetlampParts(ironLampParts, candleGlowParts, pierX + 2.9, pierDeckY + 0.85, pz, 3.6, false);
    }
  }
  for (const [bx, bz, byaw] of [
    [pierX - 7.5, 438.0, 0.15],
    [pierX + 8.2, 444.0, -0.22]
  ]) {
    addBox(woodParts, 2.5, 0.95, 7.8, bx, 0.25, bz, byaw);
    addBox(woodParts, 1.8, 1.05, 3.0, bx, 1.15, bz, byaw);
  }

  // 3. Hàng Dương 21.6m Memorial Obelisk, Bronze Reliefs, Tam Quan Gate, Incense Tripod & Vigil Candles at (335, 510)
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

  const tqZ = cz - 16.5;
  const tqY = ctx.getHeight(cx, tqZ);
  for (const sx of [-5.5, -2.2, 2.2, 5.5]) {
    addBox(stoneParts, 0.95, 5.8, 0.95, cx + sx, tqY + 2.9, tqZ);
    addCyl(stoneParts, 0.02, 0.55, 0.95, 4, cx + sx, tqY + 6.2, tqZ, Math.PI * 0.25);
  }
  const tqRoof = createVietnameseCurvedRoofGeometry(7.2, 3.2, 4.2, 0.3, 1.6, 0.25);
  tqRoof.translate(cx, tqY + 5.8, tqZ);
  roofParts.push(tqRoof);

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

  for (let g = 0; g < 18; g++) {
    const side = g < 9 ? -1 : 1;
    const idx = g % 9;
    const gx = cx + side * (14.5 + (idx % 3) * 3.2);
    const gz = cz - 6.0 + Math.floor(idx / 3) * 4.5;
    const gy = ctx.getHeight(gx, gz);
    addBox(graniteParts, 1.35, 0.42, 2.1, gx, gy + 0.21, gz);
    addBox(stoneParts, 0.85, 0.72, 0.16, gx, gy + 0.65, gz - 0.85);
    candleGlowParts.push(new THREE.SphereGeometry(0.11, 6, 5).translate(gx, gy + 0.52, gz));
  }

  const randCd = mulberry32(91418);
  for (let t = 0; t < 14; t++) {
    const ta = (t / 14) * Math.PI * 2 + 0.3;
    const tr = 24.0 + randCd() * 14.0;
    const tx = cx + Math.cos(ta) * tr;
    const tz = cz + Math.sin(ta) * tr;
    if (Math.abs(tx - pierX) < 10.0 && tz < 476.0) continue;
    const ty = ctx.getHeight(tx, tz);
    addCyl(woodParts, 0.36, 0.58, 7.2, 8, tx, ty + 3.4, tz);
    for (let tier = 0; tier < 3; tier++) {
      const cPad = createSculptedRockGeometry(9200 + t * 17 + tier, 3.8 - tier * 0.7, 0.85, 3.8 - tier * 0.7, 1);
      cPad.translate(tx, ty + 6.4 + tier * 1.45, tz);
      leafParts.push(cPad);
    }
  }

  const ironMat = new THREE.MeshStandardMaterial({ color: '#2b2f35', metalness: 0.72, roughness: 0.42 });
  const bangLeafMat = new THREE.MeshStandardMaterial({ color: '#2e6b2d', roughness: 0.76 });
  ctx.extraMaterials.push(ironMat, bangLeafMat);

  group.add(
    makeMergedMesh('ConDaoGraniteArchesAndObelisk', graniteParts, ctx.materials.granite),
    makeMergedMesh('ConDaoColonialPortico', ochreParts, colonialStoneMat),
    makeMergedMesh('ConDaoPorticoRoof', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('ConDaoHistoricStonePier', stoneParts, ctx.materials.stone),
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
