import * as THREE from 'three';
import {
  VietnamBuilderContext,
  JunkBoatMotion,
  createArchedWallGeometry,
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
  mergeNormalized,
  mulberry32,
  noise2D,
  normalizeForMerge
} from './vietnamGeometryHelpers';

/**
 * Translates and rotates (YXZ) a BufferGeometry in-place.
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
  if (rotX !== 0) geo.rotateX(rotX);
  if (rotY !== 0) geo.rotateY(rotY);
  if (rotZ !== 0) geo.rotateZ(rotZ);
  geo.translate(x, y, z);
  return geo;
}

/**
 * Assigns a uniform RGB vertex color attribute to a normalized BufferGeometry for multi-color merging.
 */
function colorizeGeometry(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation
): THREE.BufferGeometry {
  const g = normalizeForMerge(geo);
  if (g.attributes.tangent) {
    g.deleteAttribute('tangent');
  }
  const count = g.attributes.position.count;
  const col = new THREE.Color(color);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function makeMergedMesh(
  name: string,
  parts: THREE.BufferGeometry[],
  material: THREE.Material,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const geo = mergeNormalized(parts);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
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
  parts.push(transformGeo(b, x, y, z, rotY, rotX, rotZ));
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
  const c = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  parts.push(transformGeo(c, x, y, z, rotY, rotX, rotZ));
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

// ============================================================================
// 1. Chợ Bến Thành — TP. Hồ Chí Minh (-108, 190), facing north -Z
//    True 1:1 78m wide × 46m deep market hall, 28.0m 3-faced clock tower
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

  const whiteMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

  // Grounded stone/cream stepped plinth (82m × 50m)
  addBox(trimParts, 82.0, 1.0, 50.0, 0, -0.1, 0);
  addBox(ochreParts, 78.8, 0.5, 46.8, 0, 0.55, 0);

  // Main 78m × 46m market hall massing split around an open walk-in North Clock Tower Concourse (x in [-14..14], z in [-21.5..-5.5])
  addBox(ochreParts, 76.0, 9.8, 27.0, 0, 5.7, 8.0); // main rear & center market massing (z in [-5.5..+21.5])
  for (const sx of [-1, 1]) {
    addBox(ochreParts, 24.0, 9.8, 16.0, sx * 26.0, 5.7, -13.5); // flanking East/West market wings
  }
  addBox(trimParts, 28.4, 0.45, 16.4, 0, 10.35, -13.5); // interior market concourse ceiling deck
  // Exposed colonial steel roof trusses & glowing overhead pendant market lamps inside North Concourse
  for (const tz of [-19.5, -15.5, -11.5, -7.5]) {
    addBox(voidParts, 27.5, 0.28, 0.24, 0, 9.65, tz);
    for (const lx of [-8.0, 0.0, 8.0]) {
      addCyl(voidParts, 0.03, 0.03, 1.6, 6, lx, 8.85, tz);
      lampCoreParts.push(new THREE.SphereGeometry(0.24, 8, 8).translate(lx, 7.95, tz));
    }
  }
  // 10 Bustling Bến Thành Interior Market Stalls (Áo Dài textiles, Vietnamese coffee, lacquerware & Phở/Hủ Tiếu counters)
  const awningPalette = ['#c82822', '#1d7a52', '#e09a1e', '#2663a8', '#b8326a'];
  for (let row = 0; row < 2; row++) {
    const sideX = row === 0 ? -1 : 1;
    for (let st = 0; st < 5; st++) {
      const sx = sideX * 7.8;
      const sz = -19.2 + st * 3.1;
      const awningCol = awningPalette[(st + row * 2) % awningPalette.length];
      // Wooden counter, brightly colored fabric awning & stacked merchandise crates
      addColoredBox(stallParts, '#6b4528', 4.6, 1.15, 2.2, sx, 1.38, sz);
      addColoredBox(stallParts, '#dfd6c2', 4.7, 0.14, 2.35, sx, 2.02, sz);
      addColoredBox(stallParts, awningCol, 4.9, 0.22, 2.55, sx, 3.85, sz, 0, 0, sideX * 0.16);
      for (const px of [-2.1, 2.1]) {
        addColoredBox(stallParts, '#47301e', 0.12, 2.6, 0.12, sx + px, 2.55, sz - 0.95);
        addColoredBox(stallParts, '#47301e', 0.12, 2.6, 0.12, sx + px, 2.55, sz + 0.95);
      }
      // Colorful folded silk bolts / coffee sacks / tropical fruit baskets on counter
      addColoredBox(stallParts, awningPalette[(st + 1) % awningPalette.length], 1.1, 0.42, 0.8, sx - 1.2, 2.30, sz);
      addColoredBox(stallParts, '#e5b32e', 0.9, 0.48, 0.85, sx + 0.1, 2.32, sz);
      addColoredBox(stallParts, '#2c8a4b', 1.0, 0.38, 0.75, sx + 1.3, 2.28, sz);
    }
  }
  // Central aisle welcoming lacquerware & tropical fruit island kiosk + warm interior PointLight
  addColoredBox(stallParts, '#7a3b20', 2.8, 1.05, 5.4, 0, 1.32, -13.2);
  addColoredBox(stallParts, '#e09a1e', 1.2, 0.48, 1.4, 0, 2.08, -14.6);
  addColoredBox(stallParts, '#c82822', 1.2, 0.48, 1.4, 0, 2.08, -13.2);
  addColoredBox(stallParts, '#2c8a4b', 1.2, 0.48, 1.4, 0, 2.08, -11.8);
  const marketConcourseLight = new THREE.PointLight('#ffd285', 2.6, 28, 1.3);
  marketConcourseLight.position.set(0, 6.8, -14.0);
  group.add(marketConcourseLight);

  // Clerestory central ventilation monitor hall rising above main eaves
  addBox(ochreParts, 64.0, 3.2, 18.0, 0, 12.1, 0);
  for (let x = -28; x <= 28; x += 7) {
    addBox(voidParts, 4.2, 1.8, 18.4, x, 12.2, 0);
  }

  // Broad stepped terracotta market roofs
  const lowerMarketRoof = createHippedRoofGeometry(78.6, 46.4, 65.0, 19.0, 4.4);
  lowerMarketRoof.translate(0, 10.5, 0);
  roofParts.push(lowerMarketRoof);

  const upperMonitorRoof = createHippedRoofGeometry(66.5, 20.5, 48.0, 1.2, 4.6);
  upperMonitorRoof.translate(0, 13.7, 0);
  roofParts.push(upperMonitorRoof);

  // Continuous horizontal cream cornice around main hall
  addBox(trimParts, 77.2, 0.55, 44.2, 0, 10.4, 0);

  // Four Corner Pavilions (East/West colonial corner anchors)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * 35.5;
      const pz = sz * 19.5;
      addBox(ochreParts, 8.6, 12.2, 8.6, px, 6.7, pz);
      addBox(trimParts, 9.2, 0.55, 9.2, px, 12.85, pz);
      addBox(trimParts, 9.0, 0.4, 9.0, px, 6.8, pz);
      // Corner pilaster strips
      for (const ox of [-3.9, 3.9]) {
        for (const oz of [-3.9, 3.9]) {
          addBox(trimParts, 0.65, 11.8, 0.65, px + ox, 6.7, pz + oz);
        }
      }
      // Corner arched windows
      addBox(voidParts, 3.2, 4.8, 8.85, px, 5.2, pz);
      addBox(voidParts, 8.85, 4.8, 3.2, px, 5.2, pz);

      const pavRoof = createHippedRoofGeometry(9.8, 9.8, 1.0, 1.0, 3.8);
      pavRoof.translate(px, 13.1, pz);
      roofParts.push(pavRoof);
      addCyl(goldParts, 0.12, 0.28, 1.2, 8, px, 17.4, pz);
    }
  }

  // North (-Z) & South (+Z) 7m-tall Arched Market Entrance Porticos + Flanking Arched Colonnade Bays
  for (const sideZ of [-1, 1]) {
    const faceZ = sideZ * 22.8;
    const rotY = sideZ < 0 ? Math.PI : 0;

    // Central 7m-tall arched entrance portico (15.5m wide × 9.6m tall wall with 7.0m arch)
    const centerPortico = createArchedWallGeometry(15.5, 9.8, 3.2, 7.6, 7.0);
    centerPortico.rotateY(rotY);
    centerPortico.translate(0, 0.8, faceZ + sideZ * 1.4);
    ochreParts.push(centerPortico);
    // Keep North (-Z) Clock Tower entrance OPEN into the interior market stalls concourse!
    if (sideZ > 0) {
      addBox(voidParts, 7.2, 6.8, 2.6, 0, 4.2, faceZ + sideZ * 0.1);
    } else {
      // Iconic "CHỢ BẾN THÀNH" green-and-gold colonial relief plaque & ceramic medallions above North arch
      addColoredBox(stallParts, '#1f6c47', 6.4, 1.05, 0.24, 0, 9.15, faceZ - 3.05);
      addBox(goldParts, 6.65, 1.24, 0.16, 0, 9.15, faceZ - 3.00);
      addColoredBox(stallParts, '#e09a1e', 1.15, 0.72, 0.22, -5.2, 9.15, faceZ - 3.04);
      addColoredBox(stallParts, '#e09a1e', 1.15, 0.72, 0.22, 5.2, 9.15, faceZ - 3.04);
    }
    addBox(trimParts, 16.4, 0.55, 3.8, 0, 10.65, faceZ + sideZ * 1.4);

    // Projecting entrance canopy roof on South (-Z uses Clock Tower)
    if (sideZ > 0) {
      const southPorticoGable = createHippedRoofGeometry(16.8, 5.2, 7.5, 0.6, 3.4);
      southPorticoGable.translate(0, 10.9, faceZ + 1.5);
      roofParts.push(southPorticoGable);
    } else {
      const northEave = createHippedRoofGeometry(17.2, 5.6, 10.5, 1.2, 2.2);
      northEave.translate(0, 10.9, faceZ - 1.5);
      roofParts.push(northEave);
    }

    // Flanking colonial arched bay facades + sloped Indochine rain awnings along North & South walls
    for (const sx of [-1, 1]) {
      for (let b = 0; b < 3; b++) {
        const bx = sx * (12.0 + b * 6.8);
        const bayWall = createArchedWallGeometry(6.6, 9.6, 1.8, 3.8, 6.2);
        bayWall.rotateY(rotY);
        bayWall.translate(bx, 0.8, faceZ);
        ochreParts.push(bayWall);
        addBox(voidParts, 3.5, 5.8, 1.2, bx, 3.7, faceZ - sideZ * 0.4);
        addBox(trimParts, 0.75, 9.6, 2.1, bx - 3.2, 5.6, faceZ);
        // Sloped colonial rain-shield awning above exterior vendor bays
        addColoredBox(stallParts, '#2d6c4e', 6.4, 0.16, 2.2, bx, 6.95, faceZ + sideZ * 1.45, 0, sideZ * 0.24, 0);
      }
      addBox(trimParts, 0.75, 9.6, 2.1, sx * 29.0, 5.6, faceZ);
    }
  }

  // East (+X) & West (-X) 7m-tall Market Entrance Porticos
  for (const sideX of [-1, 1]) {
    const faceX = sideX * 38.6;
    const rotY = sideX > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    const sidePortico = createArchedWallGeometry(14.5, 9.8, 2.8, 7.2, 7.0);
    sidePortico.rotateY(rotY);
    sidePortico.translate(faceX + sideX * 1.2, 0.8, 0);
    ochreParts.push(sidePortico);
    addBox(voidParts, 2.2, 6.8, 6.8, faceX - sideX * 0.2, 4.2, 0);
    addBox(trimParts, 3.4, 0.55, 15.2, faceX + sideX * 1.2, 10.65, 0);

    const sideEave = createHippedRoofGeometry(5.2, 15.8, 0.8, 8.2, 3.0);
    sideEave.translate(faceX + sideX * 1.3, 10.9, 0);
    roofParts.push(sideEave);
  }

  // Signature Central 28.0m-tall 3-Faced Clock Tower above North (-Z) Entrance Portico
  const towerZ = -24.2;
  // Lower & upper clock tower shaft (y = 10.8 .. 22.0m, 8.4m × 8.4m)
  addBox(ochreParts, 8.4, 11.2, 8.4, 0, 16.4, towerZ);
  addBox(trimParts, 9.1, 0.55, 9.1, 0, 11.1, towerZ);
  addBox(trimParts, 9.2, 0.65, 9.2, 0, 22.0, towerZ);

  // Corner pilasters & mid-height band on clock tower
  addBox(trimParts, 8.85, 0.4, 8.85, 0, 15.1, towerZ);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(trimParts, 0.85, 10.8, 0.85, sx * 4.0, 16.5, towerZ + sz * 4.0);
    }
  }
  // Louvered belfry arches below clock level (y = 12.2 .. 14.8m)
  addBox(voidParts, 4.2, 2.3, 8.6, 0, 13.4, towerZ);
  addBox(voidParts, 8.6, 2.3, 4.2, 0, 13.4, towerZ);

  // Indochine Stepped Terracotta Gable Roof (y = 22.2 .. 26.2m) + Spire Finial to 28.0m
  const towerRoofBase = createHippedRoofGeometry(9.8, 9.8, 6.2, 6.2, 1.5);
  towerRoofBase.translate(0, 22.2, towerZ);
  roofParts.push(towerRoofBase);

  addBox(ochreParts, 5.8, 0.9, 5.8, 0, 23.9, towerZ);
  addBox(trimParts, 6.2, 0.3, 6.2, 0, 24.35, towerZ);

  const towerRoofTop = createHippedRoofGeometry(6.6, 6.6, 0.8, 0.8, 2.0);
  towerRoofTop.translate(0, 24.45, towerZ);
  roofParts.push(towerRoofTop);

  // Spire base & finial rod reaching exactly 28.0m
  addCyl(goldParts, 0.35, 0.58, 0.65, 8, 0, 26.55, towerZ);
  addCyl(goldParts, 0.08, 0.20, 1.25, 8, 0, 27.38, towerZ);

  // Three Large White Circular Clock Faces (3.4m diameter => radius = 1.70m) on North, West, East faces
  const clockRadius = 1.7;
  const clockY = 18.4;
  addClockDial(trimParts, goldParts, voidParts, 0, clockY, towerZ - 4.26, clockRadius, Math.PI);
  addClockDial(trimParts, goldParts, voidParts, -4.26, clockY, towerZ, clockRadius, -Math.PI * 0.5);
  addClockDial(trimParts, goldParts, voidParts, 4.26, clockY, towerZ, clockRadius, Math.PI * 0.5);

  const stallVertexMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.05
  });
  ctx.extraMaterials.push(stallVertexMat);

  group.add(
    makeMergedMesh('BenThanhOchreWalls', ochreParts, ctx.materials.yellowOchrePlaster),
    makeMergedMesh('BenThanhTerracottaRoofs', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('BenThanhMarbleTrimAndDials', trimParts, whiteMat),
    makeMergedMesh('BenThanhVoidPortals', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('BenThanhGoldDetails', goldParts, ctx.materials.gold),
    makeMergedMesh('BenThanhMarketStalls', stallParts, stallVertexMat),
    makeMergedMesh(
      'BenThanhInteriorLamps',
      lampCoreParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    )
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 46.0 });
}

// ============================================================================
// 2. Dinh Độc Lập — TP. Hồ Chí Minh (0, 250), facing north -Z
//    92m wide × 36m deep × 26.0m high, 100m × 70m front lawn & 26m × 18m oval pond
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

  const whiteMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

  // 1. Sweeping Emerald 100m × 70m Front Palace Lawn (centered around z = -55 => world z = 195)
  const lawnCenterZ = -55.0;
  addColoredBox(groundParts, '#2d7d36', 100.0, 0.24, 70.0, 0, -0.04, lawnCenterZ);
  // Subtle lawn border curbs
  addColoredBox(groundParts, '#cfc8b6', 101.2, 0.26, 0.7, 0, -0.02, lawnCenterZ - 35.0);
  addColoredBox(groundParts, '#cfc8b6', 101.2, 0.26, 0.7, 0, -0.02, lawnCenterZ + 35.0);

  // Broad ceremonial stone driveway sweeping around the oval pond up to the Palace portico
  addColoredBox(groundParts, '#b8b09c', 16.0, 0.28, 72.0, 0, -0.01, lawnCenterZ);
  addColoredBox(groundParts, '#c4bca9', 46.0, 0.28, 12.0, 0, -0.01, -24.0);

  // 2. Iconic 26m × 18m Oval White Stone Fountain Pond at (0, 195) (local z = -55)
  const pondPlaza = new THREE.CylinderGeometry(16.2, 16.6, 0.30, 40);
  pondPlaza.scale(1.0, 1.0, 12.2 / 16.2);
  pondPlaza.translate(0, 0.01, lawnCenterZ);
  groundParts.push(colorizeGeometry(pondPlaza, '#c6beaa'));

  // Outer oval white stone basin rim: 26.0m wide (rx = 13.0) × 18.0m deep (rz = 9.0)
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

  // Turquoise reflective fountain water disc
  const pondWaterGeo = new THREE.CylinderGeometry(12.05, 12.05, 0.12, 44);
  pondWaterGeo.scale(1.0, 1.0, 9.0 / 13.0);
  pondWaterGeo.translate(0, 0.52, lawnCenterZ);
  const palaceWaterMat = new THREE.MeshStandardMaterial({
    color: '#2898a6',
    roughness: 0.14,
    metalness: 0.38
  });
  ctx.extraMaterials.push(palaceWaterMat);

  // 3. Main 1960s Modernist Palace Building: 92m wide × 36m deep × 26.0m high (centered at z = 0)
  // Ground podium (y = 0 .. 1.8m)
  addBox(whiteParts, 92.0, 2.4, 36.0, 0, 0.6, 0);

  // Ground floor colonnade + OPEN Grand Ceremonial Foyer & Banquet Hall visible through North Portico
  addBox(voidParts, 83.0, 6.0, 14.5, 0, 4.8, 7.0); // rear ground-floor block behind foyer (z in [-0.25..+14.25])
  for (const sx of [-1, 1]) {
    addBox(voidParts, 28.5, 6.0, 14.0, sx * 27.25, 4.8, -7.25); // flanking West/East dark glass wings
  }
  // Grand Ceremonial Lobby & State Banquet Hall interior (x in [-13..+13], z in [-14.2..0.0])
  addBox(whiteParts, 26.2, 0.26, 14.5, 0, 7.62, -7.2); // luminous modernist coffered lobby ceiling
  addBox(crimsonParts, 14.0, 4.6, 0.35, 0, 4.5, -0.35); // monumental Vietnamese *Sơn Mài* red-and-gold lacquer state mural
  addBox(goldParts, 14.4, 4.85, 0.24, 0, 4.5, -0.40);
  // Formal State Banquet Table with crimson velvet chairs & central floral centerpiece
  addBox(whiteParts, 11.2, 0.16, 2.8, 0, 2.75, -6.4);
  addBox(goldParts, 10.6, 0.85, 2.2, 0, 2.28, -6.4);
  for (let ch = -4; ch <= 4; ch++) {
    addBox(crimsonParts, 0.65, 1.05, 0.62, ch * 1.18, 2.38, -8.25);
    addBox(crimsonParts, 0.65, 1.05, 0.62, ch * 1.18, 2.38, -4.55);
  }
  // Twin modernist marble ceremonial staircases flanking lobby with flush crimson runner treads
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
    // Omit center front column at i=0 so the crimson carpet ceremonial axis enters unobstructed into the Grand Foyer
    if (i !== 0) {
      addBox(whiteParts, 0.85, 6.0, 0.95, px, 4.8, -16.8);
    }
    addBox(whiteParts, 0.85, 6.0, 0.95, px, 4.8, 16.8);
  }
  // Symmetrical recessed side wings ground colonnades (East/West)
  for (const sx of [-1, 1]) {
    for (let j = -2; j <= 2; j++) {
      addBox(whiteParts, 0.95, 6.0, 0.85, sx * 44.6, 4.8, j * 6.0);
    }
  }

  // Horizontal projecting white marble 2nd floor cantilever slab (y = 7.8 .. 8.8m)
  addBox(whiteParts, 92.0, 1.05, 36.0, 0, 8.3, 0);

  // Upper facade dark glass hall behind sun-screen (y = 8.8 .. 20.8m => 12.0m tall!)
  addBox(voidParts, 84.0, 12.0, 27.0, 0, 14.8, 0.8);

  // Signature Central 54m-wide × 12m-tall Vertical Geometric Bamboo-Motif `rèm hoa đá` Sun-Screen Louvers
  const louverZ = -16.8;
  const louverSpanW = 54.0;
  const numBlades = 41;
  const bladeSpacing = louverSpanW / (numBlades - 1);
  for (let i = 0; i < numBlades; i++) {
    const lx = -louverSpanW * 0.5 + i * bladeSpacing;
    // Vertical fluted concrete/marble blade (12.0m tall!)
    addBox(whiteParts, 0.34, 12.0, 0.95, lx, 14.8, louverZ);
    // Bamboo-node horizontal geometric crossbars creating the signature *Trúc* pattern
    if (i < numBlades - 1) {
      const segMid = lx + bladeSpacing * 0.5;
      const tierY1 = i % 2 === 0 ? 11.4 : 13.0;
      const tierY2 = i % 2 === 0 ? 16.6 : 18.2;
      addBox(whiteParts, bladeSpacing, 0.28, 0.55, segMid, tierY1, louverZ);
      addBox(whiteParts, bladeSpacing, 0.28, 0.55, segMid, 14.8, louverZ);
      addBox(whiteParts, bladeSpacing, 0.28, 0.55, segMid, tierY2, louverZ);
    }
  }

  // Recessed Symmetrical Side Wings flanking the 54m louver screen (x in [-46, -27] and [+27, +46])
  for (const sx of [-1, 1]) {
    // Wing setback front colonnade & horizontal slab framing
    addBox(whiteParts, 18.0, 0.8, 28.0, sx * 36.5, 14.8, 1.0);
    for (let k = 0; k < 4; k++) {
      const wx = sx * (29.5 + k * 4.8);
      addBox(whiteParts, 0.65, 12.0, 0.9, wx, 14.8, -12.6);
    }
    // East/West side elevation sun-breaker fins
    for (let j = -2; j <= 2; j++) {
      addBox(whiteParts, 0.9, 12.0, 0.55, sx * 44.8, 14.8, j * 5.8);
    }
  }

  // Cantilevered Upper Roof Slab (y = 20.8 .. 22.1m, 94m × 37m)
  addBox(whiteParts, 94.0, 1.3, 37.2, 0, 21.45, 0);
  // Rooftop Ceremonial Pavilion (*Tứ Phương Vô Sự*) rising to exactly 26.0m high!
  addBox(voidParts, 34.0, 2.7, 15.0, 0, 23.45, 1.5);
  for (let i = -3; i <= 3; i++) {
    addBox(whiteParts, 0.65, 2.8, 0.65, i * 5.4, 23.5, -6.2);
    addBox(whiteParts, 0.65, 2.8, 0.65, i * 5.4, 23.5, 9.2);
  }
  addBox(whiteParts, 39.0, 1.05, 18.5, 0, 25.47, 1.5);
  // Central axial flagpole completing Ngô Viết Thụ's ideogram "中" (Trung) + rooftop Helipad circle ("H")
  addCyl(whiteParts, 0.11, 0.18, 9.2, 8, 0, 30.6, -3.5);
  const topFinial = new THREE.SphereGeometry(0.24, 10, 8);
  topFinial.translate(0, 35.3, -3.5);
  goldParts.push(topFinial);
  const heliPadRing = new THREE.RingGeometry(4.4, 5.0, 28);
  heliPadRing.rotateX(-Math.PI * 0.5);
  heliPadRing.translate(0, 26.05, 3.8);
  goldParts.push(heliPadRing);
  addBox(goldParts, 0.55, 0.08, 4.2, -1.6, 26.05, 3.8);
  addBox(goldParts, 0.55, 0.08, 4.2, 1.6, 26.05, 3.8);
  addBox(goldParts, 3.4, 0.08, 0.55, 0, 26.05, 3.8);
  // Gold crest ornament above ceremonial portico axis
  addBox(goldParts, 4.2, 1.4, 0.45, 0, 23.6, -6.3);

  // 4. Red-Carpeted 6m-Tall Entrance Portico & Broad Ceremonial Staircase (-Z North Front)
  // Cantilevered Porte-Cochère Portico Canopy (y = 7.4m, supported by 6.0m tall white piers)
  addBox(whiteParts, 22.0, 0.95, 12.0, 0, 7.6, -23.5);
  for (const sx of [-9.2, 9.2]) {
    addBox(whiteParts, 0.95, 6.2, 0.95, sx, 4.2, -28.2);
    addBox(whiteParts, 0.95, 6.2, 0.95, sx, 4.2, -21.0);
  }
  // Broad ceremonial staircase (18m wide) + cheek walls
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
  // Red ceremonial carpet extending onto podium & front drive
  addBox(crimsonParts, 10.5, 0.08, 6.0, 0, 1.84, -18.0);
  addBox(crimsonParts, 9.8, 0.08, 14.0, 0, 0.16, -33.2);

  // 5. Twin 24m Flagpoles with Animated Waving Silk Vietnamese National Flags
  const { material: palaceFlagMat, uniforms: palaceFlagU } = createWavingSilkFlagMaterial({
    waveScale: 0.95,
    showStar: true
  });
  ctx.extraMaterials.push(palaceFlagMat);
  ctx.animatedUniforms?.push(palaceFlagU);
  const palaceFlagMeshes: THREE.Mesh[] = [];

  for (const sx of [-1, 1]) {
    const fx = sx * 34.0;
    const fz = lawnCenterZ;
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
  ctx.extraMaterials.push(palaceGroundMat, crimsonClothMat);

  const waterMesh = new THREE.Mesh(pondWaterGeo, palaceWaterMat);
  waterMesh.name = 'IndependencePalacePondWater';
  waterMesh.receiveShadow = true;

  group.add(
    makeMergedMesh('IndependencePalaceWhite', whiteParts, whiteMat),
    makeMergedMesh('IndependencePalaceCrimson', crimsonParts, crimsonClothMat),
    makeMergedMesh('IndependencePalaceGlass', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('IndependencePalaceGold', goldParts, ctx.materials.gold),
    makeMergedMesh('IndependencePalaceLawnAndDrive', groundParts, palaceGroundMat, false, true),
    waterMesh,
    ...palaceFlagMeshes
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 54.0 }, { x: 0, z: 195, r: 24.0 });
}

// ============================================================================
// 3. Nhà thờ Đức Bà Sài Gòn (108, 190), facing north -Z
//    35.5m × 76m nave (21.0m vault), 57.6m twin spires (60.5m with brass crosses)
//    Front plaza (108, 144) with 4.6m white marble Virgin Mary statue
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

  const whiteMarbleMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

  // 1. Stone Parvis Terrace & Front Plaza extending to (108, 144) [local z = -46]
  addBox(stoneParts, 42.0, 0.9, 82.0, 0, -0.05, 3.0);
  addBox(stoneParts, 24.0, 0.55, 22.0, 0, -0.08, -44.0);

  // Virgin Mary (*Đức Mẹ Hòa Bình*) Monument & Square Marble Garden Curb at (108, 144) => local (0, y, -46)
  const maryZ = -46.0;
  const maryGroundRel = ctx.getHeight(108, 144) - yBase;
  for (const side of [-1, 1]) {
    addBox(marbleParts, 9.6, 0.36, 0.42, 0, maryGroundRel + 0.18, maryZ + side * 4.6);
    addBox(marbleParts, 0.42, 0.36, 9.6, side * 4.6, maryGroundRel + 0.18, maryZ);
  }
  addCyl(marbleParts, 3.6, 4.0, 0.45, 16, 0, maryGroundRel + 0.15, maryZ);
  addCyl(marbleParts, 2.4, 2.7, 0.45, 12, 0, maryGroundRel + 0.58, maryZ);
  // Column pedestal (y = 0.8 .. 2.7m)
  addBox(marbleParts, 1.75, 0.55, 1.75, 0, maryGroundRel + 1.0, maryZ);
  addCyl(marbleParts, 0.62, 0.72, 1.45, 12, 0, maryGroundRel + 1.95, maryZ);
  addBox(marbleParts, 1.35, 0.25, 1.35, 0, maryGroundRel + 2.75, maryZ);
  // Sculpted 4.6m total Virgin Mary statue (2.85 .. 4.6m)
  addCyl(marbleParts, 0.34, 0.52, 1.35, 12, 0, maryGroundRel + 3.55, maryZ);
  const maryHead = new THREE.SphereGeometry(0.24, 12, 10);
  maryHead.translate(0, maryGroundRel + 4.36, maryZ);
  marbleParts.push(maryHead);
  const halo = new THREE.TorusGeometry(0.32, 0.04, 8, 18);
  halo.translate(0, maryGroundRel + 4.42, maryZ + 0.08);
  goldParts.push(halo);

  // 2. Main Romanesque-Gothic Nave & Side Aisles (35.5m wide × 76m deep, 21.0m vault height)
  // Rear solid nave & crossing (z in [-2.0 .. +33.5]) while front nave (z in [-31.5 .. -2.0]) is HOLLOW walk-in sanctuary!
  addBox(brickParts, 19.5, 21.0, 35.5, 0, 10.7, 15.75);
  // Hollow front nave interior side walls, vaulted ceiling deck & 12 Apostles pillar rows (6 per side)
  for (const sx of [-1, 1]) {
    addBox(brickParts, 0.9, 21.0, 29.5, sx * 9.3, 10.7, -16.75);
  }
  addBox(stoneParts, 19.4, 0.55, 29.8, 0, 20.6, -16.75); // vaulted nave ceiling
  const stainedPalette = ['#3a78d8', '#e6a832', '#c83434', '#2e9e7a'];
  for (let bay = 0; bay < 6; bay++) {
    const bz = -28.0 + bay * 4.4;
    // Exposed Romanesque transverse ceiling arch rib
    addBox(woodParts, 18.2, 0.55, 0.52, 0, 19.8, bz);
    for (const sx of [-1, 1]) {
      // 12 Apostles interior nave pillars (6 on each side)
      addBox(stoneParts, 1.15, 0.72, 1.15, sx * 5.6, 0.76, bz);
      addCyl(stoneParts, 0.42, 0.46, 17.6, 12, sx * 5.6, 9.9, bz);
      addBox(stoneParts, 1.12, 0.55, 1.12, sx * 5.6, 18.95, bz);
      // Interior Chartres stained-glass lancet windows casting colorful light along nave walls
      addColoredBox(stainedParts, stainedPalette[bay % stainedPalette.length], 0.22, 5.4, 1.65, sx * 8.75, 9.2, bz);
      // Carved dark-teak cathedral wooden pew benches flanking the central stone aisle
      if (bay < 5) {
        addBox(woodParts, 3.6, 0.92, 0.65, sx * 3.1, 0.86, bz + 1.4);
        addBox(woodParts, 3.6, 0.14, 0.55, sx * 3.1, 0.68, bz + 1.05);
      }
    }
  }
  // Carved Monolithic White-Marble High Altar (*Bàn Thờ Đá Cẩm Thạch*), Golden Tabernacle, Cross & 6 Candles
  addBox(marbleParts, 9.2, 0.52, 5.4, 0, 0.66, -5.2); // stepped sanctuary chancel dais
  addBox(marbleParts, 7.6, 0.45, 4.0, 0, 1.14, -4.8);
  addBox(marbleParts, 4.4, 1.25, 1.45, 0, 1.98, -4.4); // monolithic carved white marble altar block
  addBox(goldParts, 3.6, 0.68, 0.12, 0, 1.96, -5.14); // sculpted golden 6-angel altar front relief panel
  addBox(goldParts, 0.95, 1.25, 0.85, 0, 3.22, -4.15); // golden Tabernacle
  addBox(goldParts, 0.22, 3.2, 0.22, 0, 5.45, -3.55); // Sanctuary golden processional Cross
  addBox(goldParts, 1.85, 0.22, 0.22, 0, 6.25, -3.55);
  for (const cxOff of [-1.8, -1.25, -0.7, 0.7, 1.25, 1.8]) {
    addCyl(goldParts, 0.06, 0.10, 0.68, 8, cxOff, 2.94, -4.35);
    glowParts.push(new THREE.SphereGeometry(0.11, 8, 8).translate(cxOff, 3.38, -4.35));
  }
  const naveAltarLight = new THREE.PointLight('#ffdca0', 3.0, 36, 1.3);
  naveAltarLight.position.set(0, 7.2, -10.5);
  group.add(naveAltarLight);
  // Flanking side aisles bringing full cathedral width to 35.5m (y = 0.2 .. 13.8m)
  for (const sx of [-1, 1]) {
    addBox(brickParts, 8.0, 13.6, 56.0, sx * 13.75, 7.0, 2.0);
    // Side aisle pitched slate roof
    const aisleRoof = createHippedRoofGeometry(8.4, 57.0, 1.5, 52.0, 3.2);
    aisleRoof.translate(sx * 13.75, 13.8, 2.0);
    roofParts.push(aisleRoof);
  }
  // Transept crossing (41.0m wide × 20.5m tall × 14.5m deep at z = +16)
  addBox(brickParts, 41.0, 20.5, 14.5, 0, 10.45, 16.0);
  // Polygonal Apse at rear (+Z, reaching z = +44.5 => 76m total length from z = -31.5)
  addCyl(brickParts, 9.2, 9.2, 20.2, 8, 0, 10.3, 35.3);
  const apseRoof = new THREE.ConeGeometry(9.6, 6.8, 8);
  apseRoof.translate(0, 20.4 + 3.4, 35.3);
  roofParts.push(apseRoof);

  // Side Nave Buttresses & Tall Romanesque Arched Lancet Windows
  for (const sx of [-1, 1]) {
    for (let z = -22.0; z <= 28.0; z += 7.0) {
      addBox(brickParts, 1.4, 19.5, 1.4, sx * 17.6, 9.9, z);
      if (z < 26.0) {
        addBox(glowParts, 0.3, 6.2, 2.2, sx * 17.85, 8.2, z + 3.5);
        addBox(glowParts, 0.3, 4.2, 1.8, sx * 9.85, 17.2, z + 3.5);
      }
    }
  }

  // Main Pitched Dark Slate Nave & Transept Roofs (above 21.0m vault up to 28.8m ridge)
  const naveRoof = createHippedRoofGeometry(20.8, 66.5, 0.6, 58.0, 7.8);
  naveRoof.translate(0, 21.2, 1.0);
  roofParts.push(naveRoof);

  const transeptRoof = createHippedRoofGeometry(42.0, 15.6, 34.0, 0.6, 6.8);
  transeptRoof.translate(0, 20.7, 16.0);
  roofParts.push(transeptRoof);

  // 3. Front Facade (-Z at z = -33.5): Triple 9m-tall Romanesque Arched Entry Portals
  const frontZ = -33.5;
  // Central grand portal (12.0m wide × 13.2m tall, OPEN 9.0m tall Romanesque arch leading into nave!)
  const centerPortal = createArchedWallGeometry(12.2, 13.4, 3.2, 6.2, 9.0);
  centerPortal.rotateY(Math.PI);
  centerPortal.translate(0, 0.2, frontZ - 1.2);
  brickParts.push(centerPortal);
  // Open carved dark-oak cathedral double portal doors folded outward
  for (const sx of [-1, 1]) {
    addBox(woodParts, 2.2, 6.8, 0.24, sx * 2.85, 3.6, frontZ - 2.65, sx * 0.72);
  }

  // Central upper facade wall holding the clock dial & 3.6m radius Rose Window
  addBox(brickParts, 12.6, 11.4, 2.8, 0, 19.1, frontZ - 0.8);
  // Central triangular brick gable above rose window (y = 24.8 .. 31.2m)
  const centerGable = new THREE.ConeGeometry(8.4, 6.4, 4);
  centerGable.rotateY(Math.PI * 0.25);
  centerGable.scale(1.06, 1.0, 0.35);
  centerGable.translate(0, 28.0, frontZ - 0.8);
  brickParts.push(centerGable);
  addBox(stoneParts, 13.2, 0.55, 3.2, 0, 13.6, frontZ - 0.8);

  // Facade Clock Dial below the Rose Window (y = 11.8m, 2.5m diameter)
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

  // 4. Twin Symmetrical Red-Brick Bell Towers (57.6m spires, 60.5m with brass crosses!)
  for (const sx of [-1, 1]) {
    const tx = sx * 10.4;
    const tz = frontZ - 0.6;

    // Lower tower 9.0m-tall Romanesque arched side portal
    const sidePortal = createArchedWallGeometry(8.6, 12.5, 2.8, 4.4, 9.0);
    sidePortal.rotateY(Math.PI);
    sidePortal.translate(tx, 0.2, tz - 2.4);
    brickParts.push(sidePortal);
    addBox(voidParts, 4.1, 8.6, 1.6, tx, 4.5, tz - 0.8);

    // Main brick belfry tower shaft rising to y = 36.6m (7.6m × 7.6m)
    addBox(brickParts, 7.6, 36.4, 7.6, tx, 18.4, tz);

    // Corner brick buttresses along tower shaft
    for (const bx of [-3.6, 3.6]) {
      for (const bz of [-3.6, 3.6]) {
        addBox(brickParts, 1.15, 36.0, 1.15, tx + bx, 18.2, tz + bz);
      }
    }

    // Tiered stone cornice rings
    addBox(stoneParts, 8.4, 0.55, 8.4, tx, 12.6, tz);
    addBox(stoneParts, 8.4, 0.55, 8.4, tx, 24.0, tz);
    addBox(stoneParts, 8.8, 0.75, 8.8, tx, 36.5, tz);

    // Multi-tier louvered Romanesque arches on all 4 faces (Tier 2 & Tier 3 belfry)
    for (const archY of [18.5, 30.2]) {
      addBox(voidParts, 3.0, 6.4, 7.85, tx, archY, tz);
      addBox(voidParts, 7.85, 6.4, 3.0, tx, archY, tz);
      // Horizontal Romanesque louver blades
      for (let l = -2; l <= 2; l++) {
        addBox(brickParts, 2.9, 0.22, 7.75, tx, archY + l * 0.95, tz);
        addBox(brickParts, 7.75, 0.22, 2.9, tx, archY + l * 0.95, tz);
      }
    }

    // Bronze-jade octagonal spire via createGothicSpireGeometry (36.6m -> 57.6m apex)
    const spireGeo = createGothicSpireGeometry(7.6, 22.82, 8);
    spireGeo.translate(tx, 36.6, tz);
    patinaParts.push(spireGeo);

    // Gleaming brass/gold cross rising from 57.6m spire tip to 60.5m!
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
  ctx.extraMaterials.push(emeraldPatinaMat, stainedGlassMat);

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
    makeMergedMesh('NotreDameStainedGlass', stainedParts, stainedGlassMat, false, false)
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 46.0 }, { x: 108, z: 146, r: 12.0 });
}

// ============================================================================
// 4. Địa đạo Củ Chi — TP. Hồ Chí Minh (-255, 270)
//    1.2m trapdoors, 2.2m clay vents, 6m Hoàng Cầm hearth pavilion, 22m Bến Dược tower
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

  const relY = (lx: number, lz: number) => ctx.getHeight(cx + lx, cz + lz) - yCenter;

  // 1. Earthen Laterite Camouflaged Wooden Trapdoor Hatches (1.2m wide)
  const hatchCoords: Array<[number, number, number]> = [
    [-7.5, -8.0, 0.22],
    [6.5, -6.5, -0.35],
    [-2.0, -11.5, 0.08]
  ];
  for (const [hx, hz, yaw] of hatchCoords) {
    const hy = relY(hx, hz);
    const mound = new THREE.CylinderGeometry(1.5, 2.4, 0.55, 12);
    mound.translate(hx, hy - 0.04, hz);
    natureParts.push(colorizeGeometry(mound, '#9a5432'));

    // 1.2m wide timber collar frame
    addBox(woodParts, 1.36, 0.26, 1.36, hx, hy + 0.2, hz, yaw);
    addBox(voidParts, 1.06, 0.55, 1.06, hx, hy + 0.08, hz, yaw);
    for (let r = 0; r < 4; r++) {
      addBox(woodParts, 0.88, 0.08, 0.1, hx, hy - 0.08 + r * 0.14, hz - 0.26 + r * 0.17, yaw);
    }
    // 1.2m × 1.2m ajar wooden trapdoor lid camouflaged with leaves
    const lid = new THREE.BoxGeometry(1.2, 0.09, 1.2);
    lid.translate(0, 0.045, 0.6);
    lid.rotateX(-0.65);
    lid.rotateY(yaw);
    lid.translate(hx, hy + 0.30, hz - 0.58);
    woodParts.push(lid);

    const leafCover = new THREE.BoxGeometry(1.16, 0.07, 1.16);
    leafCover.translate(0, 0.10, 0.6);
    leafCover.rotateX(-0.65);
    leafCover.rotateY(yaw);
    leafCover.translate(hx, hy + 0.30, hz - 0.58);
    natureParts.push(colorizeGeometry(leafCover, '#6d5e34'));
  }

  // 2. 2.2m Tall Clay Termite-Mound Concealed Air Vents
  const ventCoords: Array<[number, number, number]> = [
    [-13.5, 1.5, 2.25],
    [11.0, -11.5, 2.1],
    [-4.5, 11.0, 2.3],
    [13.5, -2.5, 2.15]
  ];
  for (const [vx, vz, vh] of ventCoords) {
    const vy = relY(vx, vz);
    const mainCone = new THREE.ConeGeometry(1.05, vh, 10);
    mainCone.translate(vx, vy + vh * 0.44, vz);
    natureParts.push(colorizeGeometry(mainCone, '#a65e3a'));

    const lobe = new THREE.ConeGeometry(0.65, vh * 0.72, 8);
    lobe.translate(vx + 0.58, vy + vh * 0.32, vz + 0.38);
    natureParts.push(colorizeGeometry(lobe, '#955131'));

    addBox(voidParts, 0.28, 0.32, 0.34, vx - 0.55, vy + 0.35, vz - 0.45, 0.5);
  }

  // 3. Timber Thatched Hoàng Cầm Field Hearth Pavilion (6.0m wide) at (-10.0, +4.5)
  const sx = -10.0;
  const sz = 4.5;
  const sy = relY(sx, sz);
  for (const px of [-2.6, 0, 2.6]) {
    for (const pz of [-2.1, 2.1]) {
      const post = new THREE.CylinderGeometry(0.13, 0.16, 4.4, 8);
      post.translate(sx + px, sy + 1.1, sz + pz);
      woodParts.push(post);
    }
  }
  // Timber field table & subterranean Hoàng Cầm smoke-diffusing stove hearth
  addBox(woodParts, 2.8, 0.14, 1.4, sx - 0.8, sy + 0.88, sz);
  addBox(woodParts, 0.14, 0.88, 1.1, sx - 1.9, sy + 0.44, sz);
  addBox(woodParts, 0.14, 0.88, 1.1, sx + 0.3, sy + 0.44, sz);
  // Earthen stove hearth + horizontal smoke flue channels
  const stove = new THREE.BoxGeometry(1.4, 0.85, 1.4);
  stove.translate(sx + 1.6, sy + 0.35, sz + 0.4);
  natureParts.push(colorizeGeometry(stove, '#8f5233'));
  addColoredCylinder(natureParts, '#7a6345', 0.1, 0.1, 2.4, 7, sx + 2.6, sy + 0.18, sz + 0.4, 0, 0, Math.PI * 0.5);

  // Palm-thatch pitched A-frame roof (6.8m × 5.8m)
  const thatchRoof = createHippedRoofGeometry(6.8, 5.8, 0.2, 5.0, 2.2);
  thatchRoof.translate(sx, sy + 3.15, sz);
  natureParts.push(colorizeGeometry(thatchRoof, '#b88c4a'));

  // 4. 22m-Tall Multi-Tier Bến Dược Commemorative Pagoda Tower at (+9.5, +5.5)
  const bx = 9.5;
  const bz = 5.5;
  const by = relY(bx, bz);

  // Stepped stone plinth (grounded -1.2m into ground up to +1.8m)
  const plinth1 = new THREE.BoxGeometry(11.4, 2.2, 11.4);
  plinth1.translate(bx, by + 0.1, bz);
  natureParts.push(colorizeGeometry(plinth1, '#9c9688'));
  const plinth2 = new THREE.BoxGeometry(9.2, 0.85, 9.2);
  plinth2.translate(bx, by + 1.42, bz);
  natureParts.push(colorizeGeometry(plinth2, '#b0a899'));

  // Tier 1 Crimson Columns (y = 1.8 .. 7.4m) + Curved Terracotta Roof (y = 7.2 .. 9.8m)
  for (const cxOff of [-3.1, 3.1]) {
    for (const czOff of [-3.1, 3.1]) {
      addCyl(crimsonParts, 0.28, 0.34, 5.6, 12, bx + cxOff, by + 4.6, bz + czOff);
    }
  }
  addBox(crimsonParts, 3.2, 2.4, 3.2, bx, by + 3.0, bz);
  const pagRoof1 = createVietnameseCurvedRoofGeometry(11.2, 11.2, 6.4, 6.4, 2.8, 0.55);
  pagRoof1.translate(bx, by + 7.2, bz);
  roofParts.push(pagRoof1);

  // Tier 2 Pavilion (y = 9.6 .. 13.8m) + Curved Terracotta Roof (y = 13.6 .. 15.8m)
  for (const cxOff of [-2.3, 2.3]) {
    for (const czOff of [-2.3, 2.3]) {
      addCyl(crimsonParts, 0.22, 0.26, 4.2, 10, bx + cxOff, by + 11.7, bz + czOff);
    }
  }
  addBox(crimsonParts, 3.4, 3.8, 3.4, bx, by + 11.5, bz);
  const pagRoof2 = createVietnameseCurvedRoofGeometry(8.6, 8.6, 4.6, 4.6, 2.3, 0.48);
  pagRoof2.translate(bx, by + 13.6, bz);
  roofParts.push(pagRoof2);

  // Tier 3 Upper Shrine (y = 15.6 .. 18.6m) + Spire Cap up to 22.0m!
  for (const cxOff of [-1.5, 1.5]) {
    for (const czOff of [-1.5, 1.5]) {
      addCyl(crimsonParts, 0.18, 0.20, 3.0, 10, bx + cxOff, by + 17.1, bz + czOff);
    }
  }
  addBox(crimsonParts, 2.2, 2.6, 2.2, bx, by + 16.9, bz);
  const pagCap = createVietnameseCurvedRoofGeometry(5.6, 5.6, 0.6, 0.6, 2.6, 0.42);
  pagCap.translate(bx, by + 18.4, bz);
  roofParts.push(pagCap);
  addCyl(goldParts, 0.08, 0.28, 1.2, 10, bx, by + 21.4, bz);

  // 5. Monumental Lush Bamboo-Thicket Perimeter (open on north -Z side for visitor access)
  const rand = mulberry32(44091);
  for (let b = 0; b < 68; b++) {
    const ang = THREE.MathUtils.lerp(-0.22 * Math.PI, 1.22 * Math.PI, b / 67);
    const rad = 19.0 + (b % 4) * 2.2 + rand() * 1.8;
    const tx = Math.cos(ang) * rad;
    const tz = Math.sin(ang) * rad;
    const ty = relY(tx, tz);
    const h = 8.5 + rand() * 4.8;
    const leanX = (rand() - 0.5) * 0.14;
    const leanZ = (rand() - 0.5) * 0.14;

    addColoredCylinder(
      natureParts,
      b % 2 === 0 ? '#5b8f38' : '#4a7b2c',
      0.09,
      0.14,
      h,
      6,
      tx,
      ty + h * 0.45,
      tz,
      0,
      leanX,
      leanZ
    );

    for (let l = 0; l < 3; l++) {
      const leafCone = new THREE.ConeGeometry(1.45, 2.6, 6);
      leafCone.translate(
        tx + leanX * h * 0.5 + (l - 1) * 0.65,
        ty + h - 0.4 - l * 0.85,
        tz + leanZ * h * 0.5 + ((l % 2) - 0.5) * 0.55
      );
      natureParts.push(colorizeGeometry(leafCone, l === 0 ? '#3f7628' : '#538e34'));
    }
  }

  const cuChiNatureMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.04
  });
  ctx.extraMaterials.push(cuChiNatureMat);

  group.add(
    makeMergedMesh('CuChiPagodaRoofs', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('CuChiPagodaColumns', crimsonParts, ctx.materials.crimsonLacquer),
    makeMergedMesh('CuChiTrapdoorsAndShelter', woodParts, ctx.materials.darkWood),
    makeMergedMesh('CuChiTunnelVoid', voidParts, ctx.materials.darkVoid, false, false),
    makeMergedMesh('CuChiLateriteThatchBamboo', natureParts, cuChiNatureMat),
    makeMergedMesh('CuChiPagodaFinial', goldParts, ctx.materials.gold)
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 28.0 });
}

// ============================================================================
// 5. Tháp Bà Ponagar — Nha Trang (265, 275), Mandapa at (250, 255)
//    23.0m Main Kalan + 15.0m & 11.5m towers + 4 rows × 5 (20) 5.5m octagonal columns
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

  const relY = (lx: number, lz: number): number => {
    const wx = cx + lx * cosA + lz * sinA;
    const wz = cz - lx * sinA + lz * cosA;
    return ctx.getHeight(wx, wz) - yHillTop;
  };

  // 1. Upper Sanctuary Stepped Granite Podium (grounded deep into Cù Lao hilltop)
  addBox(graniteParts, 34.0, 5.5, 24.0, 0, -2.55, 1.5);
  addBox(graniteParts, 35.2, 0.65, 25.2, 0, 0.28, 1.5);

  // 2. Grand 23.0m Main Kalan (*Tháp Bắc*) + 15.0m West & 11.5m East Cham Brick Towers
  const mainKalan = createChamTowerGeometry(8.2, 23.0, 4);
  mainKalan.rotateY(Math.PI); // face -Z toward Mandapa
  mainKalan.translate(0, 0.55, 1.5);
  brickParts.push(mainKalan);

  // Projecting *Tiền Sảnh* Vestibule + Trà Kiệu 4-Armed Durga Relief Tympanum + Open Sanctum housing Goddess Po Nagar (*Thiên Y A Na*)
  addBox(brickParts, 4.6, 0.42, 3.2, 0, 0.76, -3.55);
  for (const side of [-1, 1]) {
    addBox(brickParts, 0.72, 4.45, 3.0, side * 1.88, 3.0, -3.55);
    addBox(sandstoneParts, 0.54, 4.35, 0.54, side * 1.38, 2.95, -4.92);
    addBox(sandstoneParts, 0.76, 0.34, 0.76, side * 1.38, 0.92, -4.92);
  }
  // Carved Sandstone Lintel & Stepped Flame Tympanum with 4-Armed Durga Relief Silhouette
  addBox(sandstoneParts, 4.6, 0.68, 0.78, 0, 5.38, -4.92);
  addBox(sandstoneParts, 3.6, 0.65, 0.65, 0, 6.02, -4.85);
  addBox(sandstoneParts, 2.4, 0.65, 0.56, 0, 6.66, -4.78);
  const durgaPeak = new THREE.ConeGeometry(0.95, 1.15, 4);
  durgaPeak.translate(0, 7.52, -4.74);
  sandstoneParts.push(durgaPeak);
  addCyl(goldParts, 0.26, 0.34, 0.95, 10, 0, 6.28, -5.18); // Goddess Durga relief figure on tympanum
  for (const side of [-1, 1]) {
    addBox(goldParts, 0.65, 0.14, 0.14, side * 0.48, 6.45, -5.18, 0, 0, side * 0.35);
    addBox(goldParts, 0.58, 0.14, 0.14, side * 0.44, 6.18, -5.18, 0, 0, side * -0.25);
  }
  addBox(brickParts, 4.8, 0.62, 3.3, 0, 5.45, -3.45); // vestibule ceiling slab sealing interior
  // Interior 1.2m Black-Sandstone Statue of Goddess Po Nagar (*Thiên Y A Na*) seated on Lotus Pedestal & Leaf Aureole (clear of brick wall)
  addBox(sandstoneParts, 2.15, 0.62, 1.55, 0, 1.28, -3.72); // stepped sanctuary altar
  addCyl(sandstoneParts, 0.72, 0.84, 0.28, 12, 0, 1.72, -3.72); // carved lotus throne
  addBox(sandstoneParts, 1.48, 2.15, 0.18, 0, 2.62, -3.14); // leaf-shaped sandstone back aureole slab
  addCyl(blackStoneParts, 0.34, 0.52, 0.92, 12, 0, 2.32, -3.70); // black-sandstone seated torso & crossed legs
  const goddessHead = new THREE.SphereGeometry(0.24, 10, 8);
  goddessHead.translate(0, 2.98, -3.70);
  blackStoneParts.push(goddessHead);
  addCyl(goldParts, 0.10, 0.22, 0.44, 8, 0, 3.32, -3.70); // gilded Cham Mukuta crown
  addCyl(crimsonParts, 0.42, 0.58, 0.52, 12, 0, 2.12, -3.70); // pleated crimson silk ceremonial offering robe (zero z-fighting)
  // Multi-armed silhouette & flanking glowing sanctuary oil lamps + bronze incense burner
  for (const side of [-1, 1]) {
    addBox(blackStoneParts, 0.62, 0.12, 0.12, side * 0.44, 2.68, -3.68, 0, 0, side * 0.38);
    addBox(blackStoneParts, 0.58, 0.12, 0.12, side * 0.42, 2.46, -3.68, 0, 0, side * -0.18);
    addCyl(bronzeParts, 0.10, 0.16, 0.72, 8, side * 0.88, 1.32, -4.42);
    lampCoreParts.push(new THREE.SphereGeometry(0.14, 8, 8).translate(side * 0.88, 1.78, -4.42));
  }
  addCyl(bronzeParts, 0.28, 0.20, 0.42, 12, 0, 1.18, -4.55); // main brass incense urn
  const poNagarSanctumLight = new THREE.PointLight('#ffb85c', 2.4, 15, 1.4);
  poNagarSanctumLight.position.set(0, 3.25, -4.15);
  group.add(poNagarSanctumLight);

  // West Tower (*Tháp Trung / Nam*, 15.0m) with Carved Lintel & Open *Linga-Yoni* Shrine Niche
  const westTower = createChamTowerGeometry(5.6, 15.0, 3);
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
  // Sculpted Linga-Yoni dedicated to Shiva inside West Tower
  addBox(sandstoneParts, 1.15, 0.46, 1.15, -11.2, 1.12, -3.85);
  addBox(sandstoneParts, 0.34, 0.18, 0.56, -11.2 + 0.75, 1.22, -3.85);
  addCyl(sandstoneParts, 0.20, 0.24, 0.85, 12, -11.2, 1.72, -3.85);
  addCyl(bronzeParts, 0.18, 0.14, 0.30, 10, -11.2, 1.05, -4.55);

  // East Tower (*Tháp Đông Nam*, 11.5m) with Carved Lintel & Open *Linga-Yoni* Shrine Niche
  const eastTower = createChamTowerGeometry(4.6, 11.5, 3);
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
  addCyl(bronzeParts, 0.16, 0.12, 0.26, 10, 10.8, 1.02, -2.68);

  // 3. Lower Mandapa Meditation Terrace at world (250, 255) => local (0, y, -25.0)
  const mandapaZ = -25.0;
  const mandapaGroundY = relY(0, mandapaZ);
  const mandapaTopY = Math.max(mandapaGroundY + 0.75, -3.6);

  // Retaining granite terrace grounded deeply into Cù Lao slope
  addBox(graniteParts, 21.0, 8.5, 16.5, 0, mandapaTopY - 4.25, mandapaZ);
  addBox(graniteParts, 22.0, 0.55, 17.2, 0, mandapaTopY, mandapaZ);

  // 4 Rows of 20 Towering 5.5m Tall Octagonal chamBrick Mandapa Columns (4 × 5 = 20 columns)
  const rowXs = [-7.2, -2.4, 2.4, 7.2];
  for (const rowX of rowXs) {
    for (let i = 0; i < 5; i++) {
      const pz = mandapaZ - 5.6 + i * 2.8;
      // Stone plinth (0.45m)
      addBox(graniteParts, 1.4, 0.45, 1.4, rowX, mandapaTopY + 0.35, pz);
      // Octagonal chamBrick shaft (4.45m)
      addCyl(brickParts, 0.46, 0.52, 4.45, 8, rowX, mandapaTopY + 2.8, pz);
      // Octagonal chamBrick capital (0.60m => total 5.50m tall!)
      addCyl(brickParts, 0.68, 0.46, 0.60, 8, rowX, mandapaTopY + 5.32, pz);
    }
  }
  // Central Mandapa Ceremonial Offering Altar, Cham Inscription Stele & Glowing Pilgrim Stairway Lanterns
  addBox(sandstoneParts, 2.2, 0.88, 1.45, 0, mandapaTopY + 0.68, mandapaZ);
  addCyl(bronzeParts, 0.24, 0.18, 0.38, 10, 0, mandapaTopY + 1.32, mandapaZ);
  addBox(sandstoneParts, 1.05, 1.85, 0.26, -5.2, mandapaTopY + 1.22, mandapaZ - 6.6); // ancient Cham *Bia Ký* stele
  for (const side of [-1, 1]) {
    // Brass pilgrim lanterns flanking Mandapa upper & lower stair portals
    for (const lz of [mandapaZ - 7.8, mandapaZ + 7.8]) {
      addBox(graniteParts, 0.72, 0.52, 0.72, side * 4.4, mandapaTopY + 0.52, lz);
      addCyl(bronzeParts, 0.08, 0.11, 1.85, 8, side * 4.4, mandapaTopY + 1.70, lz);
      lampCoreParts.push(new THREE.SphereGeometry(0.22, 8, 8).translate(side * 4.4, mandapaTopY + 2.75, lz));
    }
  }

  // 4. Steep Carved Granite Pilgrim Stairways (Hill Base -> Mandapa -> Upper Sanctuary)
  // Lower stairway: lz = -43.5 (foot of hill) up to lz = -33.2 (Mandapa)
  const lowerSteps = 20;
  const startZ1 = -43.5;
  const endZ1 = mandapaZ - 8.2;
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

  // Upper stairway: lz = -16.8 (Mandapa) up to lz = -10.4 (Upper Sanctuary podium)
  const upperSteps = 14;
  const startZ2 = mandapaZ + 8.2;
  const endZ2 = -10.5;
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

  const blackStoneMat = new THREE.MeshStandardMaterial({
    color: '#25262b',
    roughness: 0.36,
    metalness: 0.14
  });
  ctx.extraMaterials.push(blackStoneMat);

  group.add(
    makeMergedMesh('PoNagarBrickTowers', brickParts, ctx.materials.chamBrick),
    makeMergedMesh('PoNagarGraniteTerracesAndSteps', graniteParts, ctx.materials.granite),
    makeMergedMesh('PoNagarSandstoneReliefs', sandstoneParts, ctx.materials.ochreSand ?? ctx.materials.stone),
    makeMergedMesh('PoNagarGoddessBlackStone', blackStoneParts, blackStoneMat),
    makeMergedMesh('PoNagarGoldAccents', goldParts, ctx.materials.gold),
    makeMergedMesh('PoNagarCrimsonOfferings', crimsonParts, ctx.materials.crimsonLacquer),
    makeMergedMesh('PoNagarBronzeCensers', bronzeParts, ctx.materials.bronze),
    makeMergedMesh(
      'PoNagarSanctuaryLamps',
      lampCoreParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    )
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 30.0 });
}

// ============================================================================
// 6. Chợ nổi Cái Răng — Cần Thơ (-72, 365)
//    16 colorful Mekong boats (11–14m long) + 7m cây bẹo poles + wharf at (-72, 336)
// ============================================================================
function createMekongBoatGeometry(
  length: number,
  beam: number,
  trimColor: string,
  canopyColor: string,
  poleType: 'pineapple' | 'watermelon',
  seed: number
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const hullH = 1.28;

  // Watertight sculpted wooden Mekong *ghe thuyền* hull (11–14m long)
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
    x *= planW * flare;
    y += sheerLift - 0.25;
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

  // Traditional Mekong boat eyes (*mắt thuyền*) on bow
  for (const sx of [-1, 1]) {
    const eyeWhite = new THREE.SphereGeometry(0.22, 8, 6);
    eyeWhite.scale(0.55, 0.7, 1.35);
    eyeWhite.translate(sx * beam * 0.27, 0.68, length * 0.36);
    parts.push(colorizeGeometry(eyeWhite, '#f5f2ea'));

    const eyePupil = new THREE.SphereGeometry(0.11, 6, 5);
    eyePupil.scale(0.6, 0.8, 1.1);
    eyePupil.translate(sx * beam * 0.29, 0.68, length * 0.37);
    parts.push(colorizeGeometry(eyePupil, '#1b1d22'));
  }

  // Curved arched boat canopy (*mui thuyền*) over stern/midship
  const canopyLen = length * 0.44;
  const canopyGeo = new THREE.CylinderGeometry(
    beam * 0.52,
    beam * 0.54,
    canopyLen,
    12,
    1,
    false,
    -Math.PI * 0.5,
    Math.PI
  );
  canopyGeo.rotateZ(Math.PI * 0.5);
  canopyGeo.rotateY(Math.PI * 0.5);
  canopyGeo.translate(0, 0.96, -length * 0.14);
  parts.push(colorizeGeometry(canopyGeo, canopyColor));

  // Deck cargo baskets of fresh delta produce
  const basketZ = length * 0.17;
  addColoredCylinder(parts, '#b9935a', 0.62, 0.48, 0.55, 10, -beam * 0.20, 0.68, basketZ);
  addColoredCylinder(parts, '#b9935a', 0.58, 0.44, 0.52, 10, beam * 0.20, 0.66, basketZ + 0.35);

  for (let p = 0; p < 4; p++) {
    const melon = new THREE.SphereGeometry(0.24, 8, 6);
    melon.translate(-beam * 0.20 + (p - 1.5) * 0.22, 1.0, basketZ + (p % 2) * 0.22);
    parts.push(colorizeGeometry(melon, '#2e7d32'));

    const pine = new THREE.CylinderGeometry(0.16, 0.18, 0.36, 7);
    pine.translate(beam * 0.20 + (p - 1.5) * 0.18, 0.98, basketZ + 0.35);
    parts.push(colorizeGeometry(pine, '#e2a322'));
  }

  // 7m Tall *Cây Bẹo* Bamboo Produce Pole rising from bow
  const poleH = 6.8 + (seed % 3) * 0.45;
  const poleZ = length * 0.28;
  const poleTilt = -0.20;
  const poleGeo = new THREE.CylinderGeometry(0.055, 0.095, poleH, 8);
  poleGeo.translate(0, poleH * 0.5, 0);
  poleGeo.rotateX(poleTilt);
  poleGeo.translate(0, 0.55, poleZ);
  parts.push(colorizeGeometry(poleGeo, '#c4a65e'));

  // Crossbar & suspended golden pineapples / green watermelons at pole tip
  const tipY = 0.55 + Math.cos(poleTilt) * (poleH - 0.35);
  const tipZ = poleZ + Math.sin(poleTilt) * (poleH - 0.35);
  addColoredBox(parts, '#b79750', 1.15, 0.08, 0.08, 0, tipY, tipZ);

  for (const hx of [-0.42, 0, 0.42]) {
    addColoredCylinder(parts, '#9c8349', 0.02, 0.02, 0.62, 5, hx, tipY - 0.30, tipZ);
    if (poleType === 'pineapple') {
      const pineBody = new THREE.SphereGeometry(0.22, 8, 6);
      pineBody.scale(0.82, 1.35, 0.82);
      pineBody.translate(hx, tipY - 0.72, tipZ);
      parts.push(colorizeGeometry(pineBody, '#e8a820'));

      const pineCrown = new THREE.ConeGeometry(0.18, 0.30, 6);
      pineCrown.translate(hx, tipY - 0.42, tipZ);
      parts.push(colorizeGeometry(pineCrown, '#3e8c33'));
    } else {
      const wm = new THREE.SphereGeometry(0.26, 8, 6);
      wm.scale(0.95, 1.15, 0.95);
      wm.translate(hx, tipY - 0.72, tipZ);
      parts.push(colorizeGeometry(wm, '#2a7b2f'));
    }
  }

  return mergeNormalized(parts);
}

function buildCaiRangFloatingMarket(ctx: VietnamBuilderContext): JunkBoatMotion[] {
  const cx = -72;

  const group = new THREE.Group();
  group.name = 'CaiRangFloatingMarketComplex';

  // 1. Broad Wooden River Wharf at (-72, 336) extending out into Mekong River channel
  const dockParts: THREE.BufferGeometry[] = [];
  const bankY = ctx.getHeight(cx, 334.0);
  const dockDeckY = Math.max(1.25, bankY + 0.35);
  // Main walkway from z = 333 .. 346
  addBox(dockParts, 7.6, 0.28, 13.5, cx, dockDeckY, 339.5);
  // Broad T-head riverside platform at z = 346.5
  addBox(dockParts, 18.0, 0.32, 6.0, cx, dockDeckY, 346.5);
  // Timber pilings grounded deeply into river bank & Mekong bed (-2.2m)
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
  // Mooring bollards & riverside boarding stairs
  for (const bx of [cx - 8.0, cx - 3.5, cx + 3.5, cx + 8.0]) {
    addBox(dockParts, 0.38, 0.95, 0.38, bx, dockDeckY + 0.45, 349.1);
  }
  for (let s = 0; s < 3; s++) {
    addBox(dockParts, 4.2, 0.24, 0.85, cx, dockDeckY - 0.25 - s * 0.26, 349.8 + s * 0.72);
  }
  // Wharf market timber awning posts, traditional riverside archway signboard & overflowing fruit baskets
  const wharfProduceParts: THREE.BufferGeometry[] = [];
  const wharfLampParts: THREE.BufferGeometry[] = [];
  for (const px of [cx - 6.8, cx + 6.8]) {
    for (const pz of [344.4, 348.4]) {
      addCyl(dockParts, 0.12, 0.14, 3.2, 8, px, dockDeckY + 1.6, pz);
    }
  }
  addBox(dockParts, 15.2, 0.18, 5.2, cx, dockDeckY + 3.2, 346.4);
  // Traditional riverside "CHỢ NỔI CÁI RĂNG" entrance gate arch & gold/crimson signboard at wharf approach
  for (const side of [-1, 1]) {
    addCyl(dockParts, 0.15, 0.18, 4.2, 8, cx + side * 3.4, dockDeckY + 2.1, 334.6);
  }
  addColoredBox(wharfProduceParts, '#a8221b', 7.4, 0.95, 0.28, cx, dockDeckY + 4.0, 334.6);
  addColoredBox(wharfProduceParts, '#e5b832', 6.8, 0.62, 0.32, cx, dockDeckY + 4.0, 334.6);
  // Overflowing woven bamboo wholesale fruit baskets on the wharf deck (pineapples, watermelons, dragon-fruit, pumpkins)
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
      const fruit = new THREE.SphereGeometry(0.22, 8, 6);
      fruit.translate(bx + (f % 2 - 0.5) * 0.34, dockDeckY + 0.78 + (f > 1 ? 0.14 : 0), bz + (f > 1 ? 0.16 : -0.16));
      wharfProduceParts.push(colorizeGeometry(fruit, fruitCol));
    }
  }
  // Glowing warm morning wharf market string lamps under timber awning
  for (let l = -5; l <= 5; l += 2) {
    wharfLampParts.push(new THREE.SphereGeometry(0.18, 8, 8).translate(cx + l * 1.25, dockDeckY + 2.88, 348.2));
  }
  // 2 Authentic Floating *Hủ Tiếu / Cà Phê* Breakfast Sampans docked beside the wharf with steaming broth pots & parasols
  for (const [sx, sz, umbrellaCol] of [
    [cx - 6.5, 351.8, '#d62828'],
    [cx + 6.8, 351.4, '#1d7a9e']
  ] as Array<[number, number, string]>) {
    // Low wooden sampan hull + noodle broth pot + steaming brazier + colorful market umbrella
    addColoredBox(wharfProduceParts, '#5c3c22', 6.4, 0.55, 1.9, sx, 0.22, sz);
    addColoredCylinder(wharfProduceParts, '#c4c7cc', 0.34, 0.32, 0.52, 12, sx - 0.8, 0.76, sz); // stainless *Hủ Tiếu* broth pot
    addColoredCylinder(wharfProduceParts, '#d95326', 0.24, 0.20, 0.32, 10, sx + 0.4, 0.66, sz); // red plastic stool/bucket
    addColoredCylinder(wharfProduceParts, '#c4a65e', 0.04, 0.05, 2.35, 6, sx, 1.48, sz); // umbrella pole
    const umb = new THREE.ConeGeometry(1.45, 0.55, 10);
    umb.translate(sx, 2.68, sz);
    wharfProduceParts.push(colorizeGeometry(umb, umbrellaCol));
    wharfLampParts.push(new THREE.SphereGeometry(0.16, 8, 8).translate(sx - 0.55, 2.15, sz));
  }

  const wharfProduceMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.70,
    metalness: 0.08
  });
  ctx.extraMaterials.push(wharfProduceMat);

  group.add(
    makeMergedMesh('CaiRangMekongWharf', dockParts, ctx.materials.darkWood),
    makeMergedMesh('CaiRangWharfProduceAndSampans', wharfProduceParts, wharfProduceMat),
    makeMergedMesh(
      'CaiRangWharfLamps',
      wharfLampParts,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      false,
      false
    )
  );

  // 2. 16 Colorful Mekong *ghe thuyền* Boats (11–14m long!) across x in [-115..-35], z in [348..382]
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
    produce: 'pineapple' | 'watermelon';
  }> = [
    { x: -114, zOff: -9.0, len: 12.6, beam: 3.1, yaw: 1.48, trim: '#2998a8', canopy: '#cbb079', produce: 'pineapple' },
    { x: -109, zOff: 7.5, len: 11.4, beam: 2.8, yaw: -1.62, trim: '#d67c2a', canopy: '#3d7994', produce: 'watermelon' },
    { x: -103, zOff: -4.0, len: 13.5, beam: 3.2, yaw: 1.32, trim: '#c73a2c', canopy: '#c8ac72', produce: 'pineapple' },
    { x: -97, zOff: 10.5, len: 11.2, beam: 2.7, yaw: 1.75, trim: '#2aa68d', canopy: '#8496a0', produce: 'watermelon' },
    { x: -92, zOff: -10.5, len: 13.2, beam: 3.1, yaw: -1.38, trim: '#e09d2c', canopy: '#3b738c', produce: 'pineapple' },
    { x: -87, zOff: 3.0, len: 12.0, beam: 2.9, yaw: 1.55, trim: '#2998a8', canopy: '#cbb079', produce: 'watermelon' },
    { x: -81, zOff: -6.5, len: 14.0, beam: 3.3, yaw: -1.52, trim: '#c73a2c', canopy: '#407c98', produce: 'pineapple' },
    { x: -76, zOff: 9.5, len: 11.8, beam: 2.8, yaw: 1.72, trim: '#d67c2a', canopy: '#c4a86e', produce: 'watermelon' },
    { x: -71, zOff: -2.0, len: 12.8, beam: 3.0, yaw: -1.68, trim: '#2aa68d', canopy: '#3a728a', produce: 'pineapple' },
    { x: -66, zOff: 11.0, len: 11.6, beam: 2.8, yaw: 1.25, trim: '#e09d2c', canopy: '#cbb079', produce: 'watermelon' },
    { x: -60, zOff: -9.5, len: 13.4, beam: 3.2, yaw: 1.44, trim: '#2998a8', canopy: '#407c98', produce: 'pineapple' },
    { x: -55, zOff: 4.5, len: 12.2, beam: 2.9, yaw: -1.48, trim: '#c73a2c', canopy: '#cbb079', produce: 'watermelon' },
    { x: -50, zOff: -5.5, len: 11.5, beam: 2.75, yaw: 1.62, trim: '#d67c2a', canopy: '#3d7994', produce: 'pineapple' },
    { x: -45, zOff: 8.5, len: 13.0, beam: 3.05, yaw: -1.65, trim: '#2aa68d', canopy: '#c4a86e', produce: 'watermelon' },
    { x: -40, zOff: -8.5, len: 12.4, beam: 2.95, yaw: 1.38, trim: '#e09d2c', canopy: '#3a728a', produce: 'pineapple' },
    { x: -36, zOff: 2.5, len: 11.8, beam: 2.85, yaw: -1.55, trim: '#2998a8', canopy: '#cbb079', produce: 'watermelon' }
  ];

  const southernBoats: JunkBoatMotion[] = [];
  for (let i = 0; i < boatConfigs.length; i++) {
    const cfg = boatConfigs[i];
    // Match exact Mekong channel centerline from vietnamHeritageShader.ts
    const zChannelCenter = 365.0 + 7.0 * Math.sin((cfg.x + 72.0) * 0.025);
    const bz = THREE.MathUtils.clamp(zChannelCenter + cfg.zOff, 348.0, 382.0);

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

  // 1. Sprawling 88m Rich Natural Emerald/Mossy Duckweed Carpet (`bèo cám`) at y = 0.028m
  const segX = 72;
  const segZ = 58;
  const spanX = 88.0;
  const spanZ = 74.0;
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

      const ellipseR = Math.hypot((mx - cx) / 44.0, (mz - cz) / 36.5);
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
    { x: cx - 7.5, zOff: 1.2, yaw: -1.48, seed: 2 }
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

  // 3. Winding Elevated 55m Long Bamboo Footbridge (*Cầu Tre Vạn Bước*)
  const bridgeParts: THREE.BufferGeometry[] = [];
  const bridgeStartX = cx + 26.5;
  const bridgeEndX = cx - 26.5;
  const bridgeSteps = 64;

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
      if (i % 3 === 0) {
        addColoredCylinder(bridgeParts, '#6a4c2d', 0.08, 0.10, deckY + 1.65, 6, rx, (deckY - 1.25) * 0.5, rz);
        addColoredCylinder(bridgeParts, '#bfa05c', 0.05, 0.06, 1.1, 6, rx, deckY + 0.55, rz);
      }
    }
  }

  const bridgeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.05
  });
  ctx.extraMaterials.push(bridgeMat);
  group.add(makeMergedMesh('TraSuBambooFootbridge', bridgeParts, bridgeMat));

  // 4. 220+ Instanced 13–17m Tall Slender White-Barked Melaleuca (*cây tràm*) Trunks & Crowns
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

  const maxTrees = 240;
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

  for (let attempt = 0; attempt < 1600 && treeIdx < maxTrees; attempt++) {
    const rx = (rand() * 2 - 1) * 44.5;
    const rz = (rand() * 2 - 1) * 37.5;
    if (Math.hypot(rx / 44.5, rz / 37.5) > 0.96) continue;

    const wx = cx + rx;
    const wz = cz + rz;

    // Keep open boat canal & bamboo footbridge unobstructed
    if (Math.abs(wz - channelZ(wx)) < 6.0) continue;
    if (Math.abs(wz - bridgeZ(wx)) < 3.6) continue;
    // Preserve clean sightline corridor from the East approach
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

  // Boardwalk safety railings
  addBox(woodParts, 0.14, 0.12, 35.0, -3.95, deckY + 1.05, 462.5);
  addBox(woodParts, 0.14, 0.12, 35.0, 3.95, deckY + 1.05, 462.5);
  for (let pz = 446; pz <= 501; pz += 3.5) {
    const rx = pz >= 480 ? 10.8 : 3.95;
    addBox(woodParts, 0.16, 1.15, 0.16, -rx, deckY + 0.58, pz);
    addBox(woodParts, 0.16, 1.15, 0.16, rx, deckY + 0.58, pz);
  }

  // 2. 19m-Tall Km 2436 / GPS 0001 Ho Chi Minh Road Milestone Stela at (0, 465)
  const gpsZ = 465.0;
  addCyl(graniteParts, 4.4, 4.8, 1.2, 6, 0, deckY + 0.5, gpsZ);
  addCyl(graniteParts, 3.2, 3.6, 1.1, 6, 0, deckY + 1.65, gpsZ);
  addCyl(graniteParts, 1.2, 1.9, 14.5, 6, 0, deckY + 9.45, gpsZ);
  addCyl(graniteParts, 0.18, 1.35, 2.3, 6, 0, deckY + 17.85, gpsZ); // reaches 19.0m above deck!

  // Gold & crimson milestone relief plaques on north & south faces
  addColoredBox(shipParts, '#b3241c', 1.65, 2.4, 0.25, 0, deckY + 8.5, gpsZ - 1.55);
  addColoredBox(shipParts, '#efc138', 1.3, 1.9, 0.28, 0, deckY + 8.5, gpsZ - 1.58);
  addColoredBox(shipParts, '#b3241c', 1.65, 2.4, 0.25, 0, deckY + 8.5, gpsZ + 1.55);
  addColoredBox(shipParts, '#efc138', 1.3, 1.9, 0.28, 0, deckY + 8.5, gpsZ + 1.58);

  // 3. Iconic 18m-Long Con Tàu Mũi Cà Mau Prow & Hoisted Sail Monument at (0, 491)
  const shipZ = 491.0;
  // Deep masonry pedestal grounded to y = -2.0m
  addColoredBox(shipParts, '#c6bfb0', 9.2, 4.4, 17.5, 0, 0.2, shipZ);

  // Crisp stone-white (#d8d0c2) 18.0m-long sculptural ship hull & sweeping prow pointing +Z south
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
  shipParts.push(colorizeGeometry(hullGeo, '#d8d0c2'));

  // Warm gold/ochre deck trim & prow fin
  addColoredBox(shipParts, '#d99e36', 4.8, 0.55, 12.6, 0, deckY + 4.3, shipZ - 0.8);
  addColoredBox(shipParts, '#d99e36', 0.55, 3.2, 7.2, 0, deckY + 5.4, shipZ + 4.5, 0, -0.35, 0);

  // Hoisted Crimson & Gold Sail Monument rising 16.5m above hull
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
  shipParts.push(colorizeGeometry(sailGeo, '#b3241c'));

  // Gold mast rib & star emblem on hoisted sail
  addColoredBox(shipParts, '#efc138', 0.92, 15.2, 0.42, 0, deckY + 12.0, shipZ - 3.0);
  const emblem = new THREE.CylinderGeometry(1.1, 1.1, 0.95, 5);
  emblem.rotateZ(Math.PI * 0.5);
  emblem.translate(0, deckY + 12.2, shipZ + 0.3);
  shipParts.push(colorizeGeometry(emblem, '#efc138'));

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
  ctx.exclusionCircles.push({ x: cx, z: 475, r: 22.0 });
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

  // 2. Three Grounded Thatched Beach Resort Pavilions (posts deeply rooted into beach slope!)
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
        post.translate(ox, 0.75, oz); // extends -2.35m below py into beach slope
        post.rotateY(pyaw);
        post.translate(px, py, pz);
        woodParts.push(post);
      }
    }
    // Deep grounded wooden deck skirt & platform so downhill edge never hovers
    addBox(woodParts, 5.8, 2.6, 5.4, px, py - 0.9, pz, pyaw);
    const thatch = createVietnameseCurvedRoofGeometry(7.6, 7.0, 0.4, 0.4, 2.6, 0.28);
    thatch.rotateY(pyaw);
    thatch.translate(px, py + 3.6, pz);
    organicParts.push(colorizeGeometry(thatch, '#c49b52'));
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
  const { material: pierPoolMat, uniforms: pierPoolU } = createWarmLightPoolMaterial();
  ctx.extraMaterials.push(phuQuocOrganicMat, pierPoolMat);
  ctx.animatedUniforms?.push(pierPoolU);

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
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34.0 });
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

  // Arched Colonial Pier Portico Monument at landward pier head (335, 466)
  const portZ = 466.0;
  const portBaseY = ctx.getHeight(pierX, portZ);
  const porticoDeckY = Math.max(portBaseY, pierDeckY);
  const porticoBaseH = Math.max(2.0, porticoDeckY - pierDeckY + 2.2);
  addBox(stoneParts, 18.0, porticoBaseH, 8.2, pierX, porticoDeckY - porticoBaseH * 0.5 + 0.1, portZ);

  // Carved stone steps descending from portico terrace to Cầu Tàu 914 pier deck
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
  }
  const porticoRoof = createHippedRoofGeometry(17.8, 6.4, 10.2, 0.6, 3.1);
  porticoRoof.translate(pierX, porticoDeckY + 7.6, portZ);
  roofParts.push(porticoRoof);

  // 3. Hàng Dương Granite Memorial Obelisk (18m tall) overlooking turquoise ocean waters at (335, 510)
  const memY = ctx.getHeight(cx, cz);
  addCyl(stoneParts, 11.2, 12.6, 4.2, 8, cx, memY - 1.5, cz);
  addCyl(stoneParts, 7.6, 8.4, 1.1, 8, cx, memY + 0.95, cz);

  // Stone approach steps on north side facing Cầu Tàu 914
  for (let s = 0; s < 6; s++) {
    addBox(stoneParts, 6.4, 0.75, 1.1, cx, memY - 0.2 + s * 0.3, cz - 12.2 + s * 1.0);
  }

  // 18.0m Tall Tapered Granite Memorial Obelisk (from y = memY + 1.5 up to memY + 19.5m)
  addBox(graniteParts, 4.4, 2.4, 4.4, cx, memY + 2.6, cz);
  const obShaft = new THREE.CylinderGeometry(0.82, 1.65, 13.0, 4);
  obShaft.rotateY(Math.PI * 0.25);
  obShaft.translate(cx, memY + 10.3, cz);
  graniteParts.push(obShaft);

  const obPyramid = new THREE.ConeGeometry(1.16, 2.6, 4);
  obPyramid.rotateY(Math.PI * 0.25);
  obPyramid.translate(cx, memY + 18.1, cz);
  graniteParts.push(obPyramid);

  group.add(
    makeMergedMesh('ConDaoGraniteArchesAndObelisk', graniteParts, ctx.materials.granite),
    makeMergedMesh('ConDaoColonialPortico', ochreParts, colonialStoneMat),
    makeMergedMesh('ConDaoPorticoRoof', roofParts, ctx.materials.terracottaRoof),
    makeMergedMesh('ConDaoHistoricStonePier', stoneParts, ctx.materials.stone)
  );

  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34.0 });
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
