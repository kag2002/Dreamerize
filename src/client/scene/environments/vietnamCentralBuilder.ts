import * as THREE from 'three';
import {
  VietnamBuilderContext,
  clamp01,
  mulberry32,
  mergeNormalized,
  createSculptedRockGeometry,
  createArchedWallGeometry,
  createVietnameseCurvedRoofGeometry,
  createChamTowerGeometry,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createLanternCapGeometry,
  createWarmLightPoolMaterial,
  createWavingSilkFlagMaterial
} from './vietnamGeometryHelpers';

export interface VietnamCentralBuildResult {
  animatedUniforms: Array<{ uTime: { value: number } }>;
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
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX !== 0) g.rotateX(rotX);
  if (rotZ !== 0) g.rotateZ(rotZ);
  if (rotY !== 0) g.rotateY(rotY);
  g.translate(x, y, z);
  parts.push(g);
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
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rotX !== 0) g.rotateX(rotX);
  if (rotZ !== 0) g.rotateZ(rotZ);
  if (rotY !== 0) g.rotateY(rotY);
  g.translate(x, y, z);
  parts.push(g);
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
  const g = new THREE.ConeGeometry(r, h, segs);
  if (rotX !== 0) g.rotateX(rotX);
  if (rotZ !== 0) g.rotateZ(rotZ);
  if (rotY !== 0) g.rotateY(rotY);
  g.translate(x, y, z);
  parts.push(g);
}

/**
 * Converts geometry to non-indexed with normals, uvs, and uniform RGB vertex color so
 * multi-colored static props (lanterns, flower clusters, pines) merge into a single draw call.
 */
function colorizeForMerge(geo: THREE.BufferGeometry, hexColor: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    const uvs = new Float32Array(count * 2);
    const pos = g.attributes.position;
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = (pos.getX(i) + pos.getZ(i)) * 0.25;
      uvs[i * 2 + 1] = pos.getY(i) * 0.25;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  const col = new THREE.Color(hexColor);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (g !== geo) geo.dispose();
  return g;
}

/**
 * Creates a smooth tapered tube along 3D spine points with per-sample radius.
 */
function createVariableTubeGeometry(
  points: THREE.Vector3[],
  radii: number[],
  radialSegs = 12
): THREE.BufferGeometry {
  const nPts = points.length;
  const ringVerts = radialSegs + 1;
  const positions = new Float32Array(nPts * ringVerts * 3);
  const uvs = new Float32Array(nPts * ringVerts * 2);
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i < nPts; i++) {
    if (i === 0) {
      tangent.subVectors(points[1], points[0]).normalize();
    } else if (i === nPts - 1) {
      tangent.subVectors(points[i], points[i - 1]).normalize();
    } else {
      tangent.subVectors(points[i + 1], points[i - 1]).normalize();
    }

    if (Math.abs(tangent.dot(up)) > 0.96) {
      normal.set(1, 0, 0).cross(tangent).normalize();
    } else {
      normal.copy(up).cross(tangent).normalize();
    }
    binormal.crossVectors(tangent, normal).normalize();

    const r = Math.max(0.03, radii[i]);
    const vCoord = i / Math.max(1, nPts - 1);

    for (let j = 0; j <= radialSegs; j++) {
      const ang = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const idx = i * ringVerts + j;

      positions[idx * 3] = points[i].x + (normal.x * ca + binormal.x * sa) * r;
      positions[idx * 3 + 1] = points[i].y + (normal.y * ca + binormal.y * sa) * r;
      positions[idx * 3 + 2] = points[i].z + (normal.z * ca + binormal.z * sa) * r;

      uvs[idx * 2] = j / radialSegs;
      uvs[idx * 2 + 1] = vCoord * 8.0;
    }
  }

  for (let i = 0; i < nPts - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a crossed botanical leaf card cluster for shrubs, ferns, and undergrowth.
 */
function createShrubCardCluster(x: number, y: number, z: number, scale: number, seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const card = new THREE.PlaneGeometry(1.4 * scale, 1.2 * scale);
    card.translate(0, 0.48 * scale, 0);
    card.rotateX((i % 2 === 0 ? 1 : -1) * 0.28);
    card.rotateY((i / 4) * Math.PI + seed * 0.7);
    card.translate(x, y, z);
    parts.push(card);
  }
  return mergeNormalized(parts);
}

/**
 * Generates the iconic steep axe-blade Central Highlands Nhà Rông thatched roof.
 */
function createNhaRongRoofGeometry(
  length: number,
  width: number,
  height: number
): THREE.BufferGeometry {
  const segU = 22;
  const segV = 24;
  const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2.0; // -1..1 along ridge length
    const vSigned = pos.getZ(i) * 2.0; // -1..1 across width (0 = apex ridge)
    const v = Math.abs(vSigned);
    const side = vSigned >= 0 ? 1 : -1;

    // Axe-blade flare: top ridge projects longer than the eaves, sweeping concave upward
    const halfLenTop = length * 0.70;
    const halfLenBase = length * 0.47;
    const halfLen = THREE.MathUtils.lerp(halfLenTop, halfLenBase, Math.pow(v, 0.72));

    // Steep concave thatched profile
    const halfW = (width * 0.5) * Math.pow(v, 1.42);
    const ridgeSaddle = 0.85 * (u * u) * (1.0 - v * 0.65);
    const y = (1.0 - Math.pow(v, 0.90)) * height + ridgeSaddle;

    pos.setXYZ(i, u * halfLen, y, side * halfW);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 1. Quần thể Di tích Cố đô Huế — Ngọ Môn (-185, 42, facing East +X):
 *    True 1:1 57.8m U-shaped bastion (5.0m high, 18m wing arms), 5 arched gateways,
 *    Lầu Ngũ Phụng with 56+ crimson columns, Imperial Yellow central roof + 8 Jade/Cyan wings,
 *    Cầu Trung Đạo 3-arch bridge (x = -148..-122, z = 42, 10m wide), and Kỳ Đài with solid crimson banner.
 */
function buildHueImperialCitadel(
  ctx: VietnamBuilderContext,
  imperialGoldRoofMat: THREE.MeshStandardMaterial,
  animatedUniforms: Array<{ uTime: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HueImperialCitadelComplex';

  const cx = -185;
  const cz = 42;
  const yBase = ctx.getHeight(cx, cz); // 1.55m
  ctx.exclusionCircles.push({ x: -185, z: 42, r: 38.0 }, { x: -136, z: 42, r: 16.0 });

  // Local coordinates: +Z faces East (+X world), +X points North (-Z world); rotated +PI/2 around Y.
  const localToWorld = (lx: number, lz: number): [number, number] => [cx + lz, cz - lx];

  const stoneParts: THREE.BufferGeometry[] = [];
  const marbleParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const centralRoofParts: THREE.BufferGeometry[] = [];
  const jadeRoofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];

  // 1. 57.8m wide U-shaped limestone-and-brick bastion (5.0m high)
  const gateZ = -10.0;
  const rampartH = 5.0;
  const rampartDepth = 10.2;

  // 5 true-scale arched gateways across central facade + flanking solid bastion shoulders out to ±28.9m
  const portals = [
    { x: 0.0, w: 9.6, archW: 4.6, archH: 4.15 },       // Chính Môn (giant central royal arch)
    { x: -8.6, w: 7.6, archW: 3.1, archH: 3.45 },      // Tả Giáp Môn
    { x: 8.6, w: 7.6, archW: 3.1, archH: 3.45 },       // Hữu Giáp Môn
    { x: -15.6, w: 6.4, archW: 2.5, archH: 2.95 },     // Tả Dịch Môn
    { x: 15.6, w: 6.4, archW: 2.5, archH: 2.95 }       // Hữu Dịch Môn
  ];

  for (let i = 0; i < portals.length; i++) {
    const p = portals[i];
    const wall = createArchedWallGeometry(p.w, rampartH, rampartDepth, p.archW, p.archH);
    wall.translate(p.x, 0, gateZ);
    stoneParts.push(wall);

    // Recessed crimson/gold wooden gate doors inside each archway
    const doorDepth = rampartDepth * 0.42;
    addBox(voidParts, p.archW * 0.94, p.archH * 0.92, doorDepth, p.x, p.archH * 0.46, gateZ - 0.5);
    addBox(crimsonParts, p.archW * 0.42, p.archH * 0.88, 0.35, p.x - p.archW * 0.23, p.archH * 0.44, gateZ + 0.4);
    addBox(crimsonParts, p.archW * 0.42, p.archH * 0.88, 0.35, p.x + p.archW * 0.23, p.archH * 0.44, gateZ + 0.4);
    if (i === 0) {
      // Gold bossed studs & imperial frame on Chính Môn
      addBox(goldParts, p.archW * 0.88, 0.24, 0.45, p.x, p.archH * 0.65, gateZ + 0.45);
      addBox(goldParts, p.archW * 0.88, 0.24, 0.45, p.x, p.archH * 0.28, gateZ + 0.45);
    }

    // Grounded foundation apron under every pier section (anchored below terrain/moat dips)
    const [wx, wz] = localToWorld(p.x, gateZ);
    const localSink = Math.max(1.2, yBase - ctx.getHeight(wx, wz) + 1.5);
    addBox(stoneParts, p.w + 0.25, localSink, rampartDepth + 0.8, p.x, -localSink * 0.5 + 0.08, gateZ);
  }

  // Outer shoulder bastions linking gateways (±18.8m) to outer U-edge (±28.9m -> total 57.8m width)
  for (const side of [-1, 1]) {
    const shX = side * 23.85;
    const shW = 10.1;
    const [wx, wz] = localToWorld(shX, gateZ);
    const sink = Math.max(1.2, yBase - ctx.getHeight(wx, wz) + 1.5);
    addBox(stoneParts, shW, rampartH + sink, rampartDepth, shX, (rampartH - sink) * 0.5, gateZ);
  }

  // Forward-wrapping U-shaped wing bastions (18m projecting arms from gateZ + 5.1 out to +13.1!)
  for (const side of [-1, 1]) {
    const wingX = side * 23.4;
    const wingW = 11.0; // outer face sits exactly at ±28.9m (57.8m total width)
    const wingLen = 18.0;
    const wingZ = gateZ + rampartDepth * 0.5 + wingLen * 0.5;
    const [wxF, wzF] = localToWorld(wingX, wingZ + 4.5);
    const [wxB, wzB] = localToWorld(wingX, wingZ - 4.5);
    const minGround = Math.min(ctx.getHeight(wxF, wzF), ctx.getHeight(wxB, wzB), yBase);
    const sink = Math.max(1.2, yBase - minGround + 1.5);

    addBox(stoneParts, wingW, rampartH + sink, wingLen, wingX, (rampartH - sink) * 0.5, wingZ);
    // Wing brick battlement parapet & marble coping trim
    addBox(brickParts, wingW + 0.3, 0.78, wingLen + 0.3, wingX, rampartH + 0.39, wingZ);
    addBox(marbleParts, wingW + 0.6, 0.26, wingLen + 0.6, wingX, rampartH + 0.90, wingZ);

    // Crenellated outer bastion merlons along wing outer rim
    for (let m = 0; m < 7; m++) {
      const mz = wingZ - wingLen * 0.44 + m * (wingLen * 0.145);
      addBox(brickParts, 0.45, 0.65, 1.35, side * 28.75, rampartH + 1.32, mz);
    }
  }

  // Main bastion brick battlement, white marble cornice & royal plaque
  addBox(brickParts, 58.1, 0.78, rampartDepth + 0.35, 0, rampartH + 0.39, gateZ);
  addBox(marbleParts, 58.6, 0.28, rampartDepth + 0.7, 0, rampartH + 0.90, gateZ);
  addBox(goldParts, 3.8, 1.45, 0.28, 0, 4.45, gateZ + rampartDepth * 0.5 + 0.12);

  // Ceremonial white marble stairways & forecourt paving between the 18m arms
  addBox(stoneParts, 36.0, 0.5, 21.0, 0, -0.15, 2.0);
  addBox(marbleParts, 16.0, 0.22, 18.0, 0, 0.14, 2.5);

  // 2. Lầu Ngũ Phụng (2-Story Five Phoenixes Pavilion) atop the 5.0m bastion (deckY = 6.04m)
  const deckY = rampartH + 1.04;

  // Central 2-story royal hall (32 + 18 = 50 crimson columns in central hall)
  addBox(marbleParts, 27.2, 0.42, 10.6, 0, deckY + 0.21, gateZ);
  const hallFloorY = deckY + 0.42;

  // Story 1 central hall walls & recessed bays
  addBox(crimsonParts, 22.8, 4.1, 6.2, 0, hallFloorY + 2.05, gateZ);
  addBox(voidParts, 4.4, 3.2, 6.32, 0, hallFloorY + 1.6, gateZ);
  for (const dx of [-5.8, 5.8]) {
    addBox(voidParts, 2.6, 2.8, 6.32, dx, hallFloorY + 1.4, gateZ);
  }
  // Dense perimeter crimson lacquer columns on Story 1 (11 front + 11 back + 4 side + 6 veranda = 32 columns)
  for (let ix = -5; ix <= 5; ix++) {
    const px = ix * 2.52;
    for (const pz of [gateZ - 4.4, gateZ + 4.4]) {
      addCyl(crimsonParts, 0.21, 0.25, 4.2, 10, px, hallFloorY + 2.1, pz);
    }
  }
  for (const px of [-12.6, 12.6]) {
    for (const pz of [gateZ - 2.2, gateZ + 2.2]) {
      addCyl(crimsonParts, 0.21, 0.25, 4.2, 10, px, hallFloorY + 2.1, pz);
    }
  }
  for (const px of [-3.6, 0, 3.6]) {
    for (const pz of [gateZ - 5.2, gateZ + 5.2]) {
      addCyl(crimsonParts, 0.19, 0.22, 4.2, 10, px, hallFloorY + 2.1, pz);
    }
  }

  // Story 2 central royal hall (colonnaded pavilion open toward forecourt)
  const upperFloorY = hallFloorY + 5.1;
  addBox(crimsonParts, 18.2, 0.22, 5.2, 0, upperFloorY + 0.11, gateZ);
  addBox(crimsonParts, 17.6, 3.15, 0.25, 0, upperFloorY + 1.68, gateZ - 2.3);
  addBox(crimsonParts, 0.25, 3.15, 4.6, -8.7, upperFloorY + 1.68, gateZ);
  addBox(crimsonParts, 0.25, 3.15, 4.6, 8.7, upperFloorY + 1.68, gateZ);
  addBox(crimsonParts, 18.0, 0.22, 5.0, 0, upperFloorY + 3.25, gateZ);
  addBox(crimsonParts, 7.2, 0.85, 0.15, -5.2, upperFloorY + 0.52, gateZ + 2.4);
  addBox(crimsonParts, 7.2, 0.85, 0.15, 5.2, upperFloorY + 0.52, gateZ + 2.4);

  // Photo-Authentic Imperial Interior of Lầu Ngũ Phụng:
  // 1. Imperial Dragon Throne Dais of Emperor Nguyen (Ngai Vàng Lầu Ngũ Phụng)
  addBox(crimsonParts, 2.4, 0.35, 2.4, 0, upperFloorY + 0.18, gateZ);
  addBox(goldParts, 2.0, 0.15, 2.0, 0, upperFloorY + 0.42, gateZ);
  addBox(goldParts, 0.95, 0.75, 0.85, 0, upperFloorY + 0.88, gateZ - 0.2);
  addBox(crimsonParts, 0.88, 0.12, 0.80, 0, upperFloorY + 0.92, gateZ - 0.2);
  addBox(goldParts, 0.95, 0.95, 0.15, 0, upperFloorY + 1.40, gateZ - 0.55);
  // Twin Imperial Yellow Parasols (Tàn lọng hoàng đế)
  for (const px of [-1.55, 1.55]) {
    addCyl(crimsonParts, 0.03, 0.03, 2.4, 6, px, upperFloorY + 1.2, gateZ - 0.35);
    addCone(goldParts, 0.72, 0.45, 12, px, upperFloorY + 2.45, gateZ - 0.35);
  }

  // 2. Đại Hồng Chung (Imperial Bronze Bell) in Left Wing Pavilion
  addCyl(crimsonParts, 0.14, 0.16, 3.2, 8, -18.2 - 1.1, upperFloorY + 1.6, gateZ);
  addCyl(crimsonParts, 0.14, 0.16, 3.2, 8, -18.2 + 1.1, upperFloorY + 1.6, gateZ);
  addBox(crimsonParts, 2.6, 0.24, 0.28, -18.2, upperFloorY + 3.1, gateZ);
  addCyl(goldParts, 0.45, 0.78, 1.65, 14, -18.2, upperFloorY + 1.9, gateZ);

  // 3. Trống Sấm (Imperial Great Drum) in Right Wing Pavilion
  addCyl(crimsonParts, 0.14, 0.16, 2.4, 8, 18.2 - 0.9, upperFloorY + 1.2, gateZ);
  addCyl(crimsonParts, 0.14, 0.16, 2.4, 8, 18.2 + 0.9, upperFloorY + 1.2, gateZ);
  addCyl(woodParts, 0.85, 0.85, 1.45, 16, 18.2, upperFloorY + 1.75, gateZ, Math.PI * 0.5, 0);
  addCyl(goldParts, 0.86, 0.86, 0.12, 16, 18.2, upperFloorY + 1.75, gateZ - 0.72, Math.PI * 0.5, 0);
  addCyl(goldParts, 0.86, 0.86, 0.12, 16, 18.2, upperFloorY + 1.75, gateZ + 0.72, Math.PI * 0.5, 0);

  for (let ix = -3; ix <= 3; ix++) {
    if (ix === 0) continue; // Gian giữa chính môn thông thủy mở rộng diện kiến ngai vàng
    const px = ix * 2.75;
    for (const pz of [gateZ - 3.3, gateZ + 3.3]) {
      addCyl(crimsonParts, 0.18, 0.21, 3.4, 10, px, upperFloorY + 1.7, pz);
    }
  }
  for (const px of [-8.25, 8.25]) {
    for (const pz of [gateZ - 1.1, gateZ + 1.1]) {
      addCyl(crimsonParts, 0.18, 0.21, 3.4, 10, px, upperFloorY + 1.7, pz);
    }
  }

  // CENTRAL ROYAL ROOF (2 tiers) in gleaming Imperial Yellow glazed tiles (#d99b1e)
  const cRoof1 = createVietnameseCurvedRoofGeometry(29.8, 12.2, 19.8, 6.8, 2.2, 0.65);
  cRoof1.translate(0, hallFloorY + 4.1, gateZ);
  centralRoofParts.push(cRoof1);

  const cRoof2 = createVietnameseCurvedRoofGeometry(21.6, 9.6, 8.8, 1.4, 3.1, 0.78);
  cRoof2.translate(0, upperFloorY + 3.32, gateZ);
  centralRoofParts.push(cRoof2);

  // Imperial gold ridge crest, dragon/phoenix acroteria & central sun-moon finial
  addBox(goldParts, 9.2, 0.36, 0.45, 0, upperFloorY + 6.52, gateZ);
  addCyl(goldParts, 0.18, 0.36, 1.1, 10, 0, upperFloorY + 7.1, gateZ);
  for (const sx of [-4.2, 4.2]) {
    addCone(goldParts, 0.34, 1.25, 6, sx, upperFloorY + 7.1, gateZ, 0, 0, -sx * 0.06);
  }

  // 4 Flanking Wing Pavilions (2 inner wings + 2 forward U-wing pavilions),
  // providing 32+ additional crimson columns (total 82 columns!) and 8 surrounding Jade/Cyan glazed roof wings!
  const wingPavSpecs = [
    { x: -18.2, z: gateZ, w: 8.6, d: 8.2 },
    { x: 18.2, z: gateZ, w: 8.6, d: 8.2 },
    { x: -23.4, z: gateZ + 14.5, w: 8.2, d: 9.2 },
    { x: 23.4, z: gateZ + 14.5, w: 8.2, d: 9.2 }
  ];

  for (const wp of wingPavSpecs) {
    addBox(marbleParts, wp.w + 1.0, 0.38, wp.d + 1.0, wp.x, deckY + 0.19, wp.z);
    // Lower wing tier chamber + 8 perimeter crimson lacquer columns
    addBox(crimsonParts, wp.w * 0.78, 3.6, wp.d * 0.76, wp.x, hallFloorY + 1.8, wp.z);
    addBox(voidParts, wp.w * 0.34, 2.5, wp.d * 0.78, wp.x, hallFloorY + 1.25, wp.z);

    for (const cxOff of [-wp.w * 0.46, 0, wp.w * 0.46]) {
      for (const czOff of [-wp.d * 0.46, wp.d * 0.46]) {
        addCyl(crimsonParts, 0.18, 0.21, 3.65, 8, wp.x + cxOff, hallFloorY + 1.82, wp.z + czOff);
      }
    }
    for (const cxOff of [-wp.w * 0.46, wp.w * 0.46]) {
      addCyl(crimsonParts, 0.18, 0.21, 3.65, 8, wp.x + cxOff, hallFloorY + 1.82, wp.z);
    }

    // Lower Jade/Cyan glazed roof wing (4 total)
    const wRoof1 = createVietnameseCurvedRoofGeometry(wp.w + 2.2, wp.d + 2.2, wp.w * 0.62, wp.d * 0.62, 1.75, 0.52);
    wRoof1.translate(wp.x, hallFloorY + 3.58, wp.z);
    jadeRoofParts.push(wRoof1);

    // Upper wing pavilion tier + Jade/Cyan glazed roof wing (4 total -> 8 Jade/Cyan wings!)
    const wUpperY = hallFloorY + 4.45;
    addBox(crimsonParts, wp.w * 0.56, 2.35, wp.d * 0.54, wp.x, wUpperY + 1.18, wp.z);
    const wRoof2 = createVietnameseCurvedRoofGeometry(wp.w * 0.86, wp.d * 0.86, 1.4, 1.4, 2.25, 0.58);
    wRoof2.translate(wp.x, wUpperY + 2.3, wp.z);
    jadeRoofParts.push(wRoof2);
    addCyl(goldParts, 0.12, 0.24, 0.75, 8, wp.x, wUpperY + 4.82, wp.z);
  }

  // 3. Cầu Trung Đạo 3-Arch Stone Moat Bridge spanning x = -148..-122, z = 42 (local z = 37..63, width = 10m)
  const bridgeZStart = 37.0; // world x = -148
  const bridgeZEnd = 63.0;   // world x = -122
  const bridgeLen = bridgeZEnd - bridgeZStart; // 26m
  const bridgeMidZ = (bridgeZStart + bridgeZEnd) * 0.5; // 50.0 (world x = -135)
  const bridgeWidth = 10.0;

  // Stone-lined Kim Thủy moat basin under Cầu Trung Đạo (local z in [37..63], local x in [-22..22])
  const moatRimW = 44.0;
  for (const mzSide of [bridgeZStart - 0.5, bridgeZEnd + 0.5]) {
    addBox(stoneParts, moatRimW, 1.8, 1.2, 0, -0.35, mzSide);
    addBox(marbleParts, moatRimW, 0.22, 1.4, 0, 0.62, mzSide);
  }
  for (const mxSide of [-moatRimW * 0.5, moatRimW * 0.5]) {
    addBox(stoneParts, 1.2, 1.8, bridgeLen + 2.2, mxSide, -0.35, bridgeMidZ);
  }
  const moatWaterGeo = new THREE.PlaneGeometry(moatRimW - 1.2, bridgeLen - 0.6);
  moatWaterGeo.rotateX(-Math.PI / 2);
  moatWaterGeo.translate(0, 0.08, bridgeMidZ);

  const moatWaterMat = new THREE.MeshStandardMaterial({
    color: '#175e5a',
    roughness: 0.14,
    metalness: 0.28
  });
  ctx.extraMaterials.push(moatWaterMat);

  // 4 bridge piers / abutments grounded down to -2.2m supporting 3 semicircular stone arches
  const numArches = 3;
  const archSpan = bridgeLen / numArches; // ~8.67m per arch
  const pierZs = [
    bridgeZStart,
    bridgeZStart + archSpan,
    bridgeZStart + archSpan * 2.0,
    bridgeZEnd
  ];
  for (const pz of pierZs) {
    const [wx, wz] = localToWorld(0, pz);
    const groundOffset = ctx.getHeight(wx, wz) - yBase;
    const botY = Math.min(-2.2, groundOffset - 2.2);
    const pierH = 1.65 - botY;
    addBox(stoneParts, bridgeWidth + 0.6, pierH, 1.55, 0, botY + pierH * 0.5, pz);
    addBox(marbleParts, bridgeWidth + 0.9, 0.28, 1.85, 0, 1.75, pz);
  }

  // 3 arched masonry deck & spandrel arches + carved marble balustrades across z = 37..63 (10m wide!)
  const bridgeSegs = 27;
  for (let s = 0; s < bridgeSegs; s++) {
    const t0 = s / bridgeSegs;
    const t1 = (s + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const bz = THREE.MathUtils.lerp(bridgeZStart, bridgeZEnd, tm);
    const [wx, wz] = localToWorld(0, bz);
    const endSlope = ctx.getHeight(wx, wz) - yBase;
    const crownY = Math.max(0.0, endSlope) + 0.18 + 2.15 * Math.sin(tm * Math.PI);
    const segLen = (bridgeLen / bridgeSegs) + 0.12;
    const slopeAng = Math.atan2(2.15 * Math.cos(tm * Math.PI) * (Math.PI / bridgeLen), 1.0);

    // Bridge roadbed slab (10m wide)
    addBox(stoneParts, bridgeWidth, 0.48, segLen, 0, crownY, bz, 0, -slopeAng, 0);

    // Arch rib & spandrel fill under each of the 3 arches
    const archIdx = Math.min(2, Math.floor(tm * 3.0));
    const localU = (tm * 3.0 - archIdx) * 2.0 - 1.0; // -1..1 within arch
    const archCurveY = 0.65 + 1.35 * Math.sqrt(Math.max(0, 1.0 - localU * localU * 0.85));
    const spandrelH = Math.max(0.25, crownY - archCurveY);
    addBox(stoneParts, bridgeWidth - 0.4, spandrelH, segLen, 0, archCurveY + spandrelH * 0.5, bz);

    // Left & right white marble balustrades + carved lotus pillars
    for (const bx of [-bridgeWidth * 0.5 + 0.25, bridgeWidth * 0.5 - 0.25]) {
      addBox(marbleParts, 0.34, 0.95, segLen, bx, crownY + 0.7, bz, 0, -slopeAng, 0);
      if (s % 3 === 0) {
        addBox(marbleParts, 0.46, 1.35, 0.46, bx, crownY + 0.9, bz);
        addCone(marbleParts, 0.24, 0.38, 6, bx, crownY + 1.72, bz);
      }
    }
  }

  // Approach stone ramps at both bridge ends meeting terrain cleanly
  for (const [endZ, dir] of [
    [bridgeZStart, -1],
    [bridgeZEnd, 1]
  ] as const) {
    for (let r = 0; r < 4; r++) {
      const rz = endZ + dir * (r * 0.9 + 0.45);
      const [wx, wz] = localToWorld(0, rz);
      const gy = ctx.getHeight(wx, wz) - yBase;
      const topY = THREE.MathUtils.lerp(0.32, gy + 0.04, (r + 1) / 4);
      addBox(stoneParts, bridgeWidth, Math.max(0.5, topY - gy + 0.8), 1.05, 0, (topY + gy - 0.8) * 0.5, rz);
    }
  }

  // 4 Monumental Ceremonial Tứ Trụ Nghi Môn Pillars flanking Cầu Trung Đạo approaches
  for (const bEnd of [bridgeZStart, bridgeZEnd]) {
    for (const sx of [-bridgeWidth * 0.48, -bridgeWidth * 0.16, bridgeWidth * 0.16, bridgeWidth * 0.48]) {
      const isInner = Math.abs(sx) < bridgeWidth * 0.3;
      const pilH = isInner ? 6.2 : 4.8;
      addCyl(stoneParts, 0.32, 0.38, 0.65, 8, sx, 0.45, bEnd);
      addCyl(crimsonParts, 0.20, 0.24, pilH, 10, sx, 0.78 + pilH * 0.5, bEnd);
      addCone(goldParts, 0.28, 0.65, 8, sx, 0.78 + pilH + 0.32, bEnd);
    }
  }

  // 4. Kỳ Đài (Imperial Flagstaff) on 3-tier stepped plinth at local (-22.0, +24.0) -> world (-161, 64)
  const flagX = -22.0;
  const flagZ = 24.0;
  const [fwx, fwz] = localToWorld(flagX, flagZ);
  const fSink = Math.max(1.0, yBase - ctx.getHeight(fwx, fwz) + 1.2);
  addBox(stoneParts, 11.5, 1.8 + fSink, 11.5, flagX, (1.8 - fSink) * 0.5, flagZ);
  addBox(brickParts, 8.6, 1.6, 8.6, flagX, 2.6, flagZ);
  addBox(brickParts, 5.8, 1.4, 5.8, flagX, 4.1, flagZ);
  addBox(marbleParts, 6.1, 0.24, 6.1, flagX, 4.92, flagZ);

  // Tall crimson-gold flagstaff pole (18.5m above upper plinth)
  addCyl(crimsonParts, 0.22, 0.38, 18.5, 12, flagX, 4.9 + 9.25, flagZ);
  addCyl(goldParts, 0.28, 0.44, 0.85, 10, flagX, 4.9 + 18.7, flagZ);

  // Waving crimson silk cloth banner (#c81d18, golden imperial star)
  const flagW = 6.2;
  const flagH = 3.6;
  const flagGeo = new THREE.PlaneGeometry(flagW, flagH, 28, 14);
  flagGeo.translate(flagW * 0.5 + 0.14, 0, 0);
  flagGeo.rotateY(-Math.PI * 0.5);
  flagGeo.translate(flagX, 21.1, flagZ);

  const { material: crimsonClothMat, uniforms: flagU } = createWavingSilkFlagMaterial({
    waveScale: 1.05,
    color: '#c81d18',
    showStar: true
  });
  ctx.extraMaterials.push(crimsonClothMat);
  animatedUniforms.push(flagU);

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const marbleMesh = new THREE.Mesh(
    mergeNormalized(marbleParts),
    ctx.materials.whiteMarble ?? ctx.materials.stone
  );
  marbleMesh.castShadow = true;
  marbleMesh.receiveShadow = true;

  const brickMesh = new THREE.Mesh(mergeNormalized(brickParts), ctx.materials.chamBrick);
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), ctx.materials.crimsonLacquer);
  crimsonMesh.castShadow = true;
  crimsonMesh.receiveShadow = true;

  const centralRoofMesh = new THREE.Mesh(mergeNormalized(centralRoofParts), imperialGoldRoofMat);
  centralRoofMesh.castShadow = true;
  centralRoofMesh.receiveShadow = true;

  const jadeRoofMesh = new THREE.Mesh(
    mergeNormalized(jadeRoofParts),
    ctx.materials.jadeRoof ?? ctx.materials.darkRoof
  );
  jadeRoofMesh.castShadow = true;
  jadeRoofMesh.receiveShadow = true;

  const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold);
  goldMesh.castShadow = true;

  const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), ctx.materials.darkVoid);

  const moatWaterMesh = new THREE.Mesh(moatWaterGeo, moatWaterMat);
  moatWaterMesh.receiveShadow = true;

  const flagMesh = new THREE.Mesh(flagGeo, crimsonClothMat);
  flagMesh.castShadow = true;
  flagMesh.name = 'HueImperialFlagBanner';

  if (woodParts.length > 0) {
    const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
    woodMesh.castShadow = true;
    group.add(woodMesh);
  }

  group.add(
    stoneMesh,
    marbleMesh,
    brickMesh,
    crimsonMesh,
    centralRoofMesh,
    jadeRoofMesh,
    goldMesh,
    voidMesh,
    moatWaterMesh,
    flagMesh
  );
  group.position.set(cx, yBase, cz);
  group.rotation.y = Math.PI * 0.5;
  ctx.scene.add(group);
  return group;
}

/**
 * 2. Phố cổ Hội An (175, 45): Chùa Cầu (~18m long x 4.6m wide) +
 *    8 Detailed 2-Story Shophouses (4 west x = 152..161, 4 east x = 189..198, z = 16..74) +
 *    Hanging Silk Lantern Arcs + Floating Hoa Đăng
 */
function buildHoiAnAncientTown(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HoiAnAncientTownComplex';

  const cx = 175;
  const cz = 45;
  const bankY = ctx.getHeight(160, 45); // ~1.35m on both canal banks
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 36.0 });

  const stoneParts: THREE.BufferGeometry[] = [];
  const ochreParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bougainvilleaParts: THREE.BufferGeometry[] = [];
  const tileParts: THREE.BufferGeometry[] = [];
  const darkRoofParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];
  const lightPoolParts: THREE.BufferGeometry[] = [];
  const lanternPalette = ['#e8301e', '#f5b828', '#1ec492', '#f45e28', '#ff66a8', '#3acae8'];

  // Stone quay retaining walls lining both sides of Hoài Canal (x = 166.5 & x = 183.5, z = 10..80)
  for (const qx of [166.2, 183.8]) {
    addBox(stoneParts, 1.4, 3.1, 70.0, qx, 0.05, cz);
    addBox(stoneParts, 2.2, 0.3, 70.0, qx, bankY + 0.15, cz);
  }

  // 1. Chùa Cầu (Japanese Covered Bridge): ~18m covered bridge x 4.6m wide spanning x = 165..185 at z = 45
  const bridgeZ = 45;
  // Grounded heavy masonry abutments into canal banks & bed (-2.2m)
  for (const ax of [165.4, 184.6]) {
    addBox(stoneParts, 3.4, 4.1, 5.4, ax, -0.15, bridgeZ);
  }
  // Submerged arched canal piers rooted cleanly to y = -2.2m meeting bridge underside
  for (const px of [169.4, 173.1, 176.9, 180.6]) {
    const t = clamp01((px - 166.0) / 18.0);
    const deckUnderY = bankY + 0.25 + 1.65 * Math.sin(t * Math.PI);
    const botY = -2.2;
    const h = deckUnderY - botY;
    addBox(stoneParts, 1.15, h, 4.8, px, botY + h * 0.5, bridgeZ);
    addBox(stoneParts, 1.45, 0.36, 5.1, px, deckUnderY - 0.1, bridgeZ);
  }
  // Carved guardian dog (West) & monkey (East) stone plinths at bridge approaches
  for (const endX of [164.2, 185.8]) {
    for (const sz of [-1.95, 1.95]) {
      addBox(stoneParts, 0.78, 0.95, 0.78, endX, bankY + 0.48, bridgeZ + sz);
      addCyl(stoneParts, 0.22, 0.32, 0.72, 8, endX, bankY + 1.32, bridgeZ + sz);
    }
  }

  // Arched wooden bridge deck (4.6m wide), red lacquered gallery columns & railings (x = 165..185)
  const bridgeSegs = 18;
  for (let i = 0; i < bridgeSegs; i++) {
    const t0 = i / bridgeSegs;
    const t1 = (i + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const bx = THREE.MathUtils.lerp(165.2, 184.8, tm);
    const archY = bankY + 0.22 + 1.65 * Math.sin(tm * Math.PI);
    const slope = Math.atan2(1.65 * Math.cos(tm * Math.PI) * (Math.PI / 19.6), 1.0);

    addBox(woodParts, 1.25, 0.34, 4.6, bx, archY, bridgeZ, 0, 0, slope);
    for (const sz of [-2.15, 2.15]) {
      addBox(crimsonParts, 1.2, 1.05, 0.22, bx, archY + 0.68, bridgeZ + sz, 0, 0, slope);
      if (i % 2 === 0 || i === bridgeSegs - 1) {
        addCyl(crimsonParts, 0.12, 0.14, 3.15, 8, bx, archY + 1.72, bridgeZ + sz);
      }
    }
    // Red lacquered gallery rafters
    if (i % 2 === 0) {
      addBox(crimsonParts, 0.24, 0.26, 4.75, bx, archY + 3.25, bridgeZ);
    }
  }

  // Red lacquered gallery pavilion enclosure at bridge center
  addBox(crimsonParts, 5.2, 3.2, 4.9, cx, bankY + 3.1, bridgeZ);
  addBox(voidParts, 1.8, 2.2, 5.05, cx, bankY + 2.7, bridgeZ);

  // Curved yin-yang bridge-house roof over Chùa Cầu + center square Taoist shrine roof gable
  const bridgeRoof = createVietnameseCurvedRoofGeometry(20.4, 6.2, 14.5, 1.4, 2.3, 0.42);
  bridgeRoof.translate(cx, bankY + 4.45, bridgeZ);
  darkRoofParts.push(bridgeRoof);

  const shrineGableBase = createVietnameseCurvedRoofGeometry(6.6, 6.6, 4.2, 4.2, 1.3, 0.32);
  shrineGableBase.translate(cx, bankY + 5.75, bridgeZ);
  darkRoofParts.push(shrineGableBase);

  const shrineGableTop = createVietnameseCurvedRoofGeometry(4.8, 4.8, 1.0, 1.0, 1.65, 0.38);
  shrineGableTop.translate(cx, bankY + 6.9, bridgeZ);
  darkRoofParts.push(shrineGableTop);
  addCyl(crimsonParts, 0.1, 0.18, 0.65, 8, cx, bankY + 8.75, bridgeZ);

  // 2. 8 Detailed 2-Story Hội An Heritage Shophouses (4 west x = 152..161, 4 east x = 189..198, z = 16..74)
  const houseSpecs = [
    // West bank (facing East +X toward canal)
    { x: 156.5, z: 19.5, facing: 1, w: 9.2, d: 8.8, h: 7.8 },
    { x: 156.8, z: 31.0, facing: 1, w: 8.8, d: 8.4, h: 7.6 },
    { x: 156.5, z: 59.0, facing: 1, w: 9.4, d: 8.8, h: 7.9 },
    { x: 156.8, z: 70.5, facing: 1, w: 8.6, d: 8.4, h: 7.7 },
    // East bank (facing West -X toward canal)
    { x: 193.5, z: 19.5, facing: -1, w: 9.0, d: 8.8, h: 7.8 },
    { x: 193.2, z: 31.0, facing: -1, w: 8.8, d: 8.4, h: 7.5 },
    { x: 193.5, z: 59.0, facing: -1, w: 9.2, d: 8.8, h: 7.9 },
    { x: 193.2, z: 70.5, facing: -1, w: 8.8, d: 8.4, h: 7.7 }
  ];

  for (const [hsIdx, hs] of houseSpecs.entries()) {
    const gy = ctx.getHeight(hs.x, hs.z);
    const plinthBottom = Math.min(gy, bankY) - 1.2;
    const plinthTop = gy + 0.35;
    const plinthH = plinthTop - plinthBottom;

    // Grounded stone plinth
    addBox(stoneParts, hs.d + 0.6, plinthH, hs.w + 0.5, hs.x, plinthBottom + plinthH * 0.5, hs.z);

    // 7.8m tall yellow-ochre plaster shophouse walls
    addBox(ochreParts, hs.d, hs.h, hs.w, hs.x, plinthTop + hs.h * 0.5, hs.z);

    const frontX = hs.x + hs.facing * (hs.d * 0.5);
    // Dark recessed ground-floor shopfront opening + darkWood accordion shopfront doors
    addBox(voidParts, 0.18, 3.25, hs.w * 0.72, frontX + hs.facing * 0.04, plinthTop + 1.65, hs.z);
    for (let fold = -3; fold <= 3; fold++) {
      if (Math.abs(fold) <= 1) continue; // central entrance opening
      addBox(
        woodParts,
        0.22,
        3.15,
        hs.w * 0.095,
        frontX + hs.facing * 0.14,
        plinthTop + 1.6,
        hs.z + fold * (hs.w * 0.108)
      );
    }

    // Cantilevered upper wooden balcony & veranda posts
    addBox(woodParts, 1.55, 0.24, hs.w + 0.2, frontX + hs.facing * 0.75, plinthTop + 3.85, hs.z);
    addBox(woodParts, 0.18, 0.95, hs.w + 0.16, frontX + hs.facing * 1.45, plinthTop + 4.42, hs.z);
    for (const pz of [-hs.w * 0.44, 0, hs.w * 0.44]) {
      addCyl(woodParts, 0.12, 0.14, 3.85, 8, frontX + hs.facing * 1.38, plinthTop + 1.92, hs.z + pz);
    }

    // Upper shuttered balcony doors & wooden cornice eaves
    for (const wz of [-hs.w * 0.28, 0, hs.w * 0.28]) {
      addBox(voidParts, 0.16, 2.05, 1.15, frontX + hs.facing * 0.04, plinthTop + 5.35, hs.z + wz);
      addBox(woodParts, 0.22, 2.1, 0.34, frontX + hs.facing * 0.14, plinthTop + 5.35, hs.z + wz - 0.65);
      addBox(woodParts, 0.22, 2.1, 0.34, frontX + hs.facing * 0.14, plinthTop + 5.35, hs.z + wz + 0.65);
    }

    // Deep front eave awning over upper balcony + pitched terracotta roof
    const houseRoof = createVietnameseCurvedRoofGeometry(
      hs.d + 2.8,
      hs.w + 0.7,
      1.0,
      hs.w * 0.92,
      2.65,
      0.24
    );
    houseRoof.translate(hs.x + hs.facing * 0.45, plinthTop + hs.h - 0.1, hs.z);
    tileParts.push(houseRoof);

    // Photo-Authentic Hoi An Shophouse Details:
    // 2.1 Raised ornamental ridge cap beam (bờ nóc ngói âm dương) & end finials (kìm nóc / cuộn hoa lá)
    const ridgeY = plinthTop + hs.h + 2.55;
    addBox(stoneParts, 0.42, 0.38, hs.w + 1.1, hs.x + hs.facing * 0.45, ridgeY, hs.z);
    for (const rz of [-hs.w * 0.5 - 0.45, hs.w * 0.5 + 0.45]) {
      addBox(stoneParts, 0.40, 0.68, 0.40, hs.x + hs.facing * 0.45, ridgeY + 0.34, hs.z + rz);
      addCyl(crimsonParts, 0.08, 0.18, 0.52, 6, hs.x + hs.facing * 0.45, ridgeY + 0.78, hs.z + rz);
    }

    // 2.2 Antique Gold Signboard (Biển hiệu tiệm cổ chữ Nho mạ vàng) above entrance awning
    const signX = frontX + hs.facing * 0.28;
    const signY = plinthTop + 3.42;
    addBox(woodParts, 0.14, 0.76, 2.5, signX, signY, hs.z);
    addBox(goldParts, 0.18, 0.62, 2.32, signX + hs.facing * 0.03, signY, hs.z);
    addBox(crimsonParts, 0.20, 0.46, 2.08, signX + hs.facing * 0.05, signY, hs.z);

    // 2.3 Flanking entrance silk lanterns (đèn lồng quả trám / tỏi lụa truyền thống)
    for (const ltz of [-hs.w * 0.36, hs.w * 0.36]) {
      const lantX = frontX + hs.facing * 1.35;
      const lantY = plinthTop + 3.45;
      const lantZ = hs.z + ltz;
      addCyl(woodParts, 0.02, 0.02, 0.42, 4, lantX, lantY + 0.40, lantZ);
      const lHex = lanternPalette[(hsIdx * 2 + (ltz > 0 ? 1 : 0)) % lanternPalette.length];
      const sShell = createRibbedLanternShellGeometry(0.24, 0.65, 12, 8);
      sShell.translate(lantX, lantY, lantZ);
      lanternParts.push(colorizeForMerge(sShell, lHex));
      const sCore = createLanternCoreGeometry(0.24, 0.65);
      sCore.translate(lantX, lantY, lantZ);
      coreParts.push(sCore);
    }

    // 2.4 Cascading Bougainvillea / Giàn Hoa Giấy Hồng Tím & Xanh Thắm along upper balcony
    const vineRand = mulberry32(77000 + hsIdx * 191);
    const flowerHexes = ['#d81e74', '#f04299', '#e02885', '#ff66a8', '#ff3388'];
    const leafHexes = ['#235422', '#2f682c', '#1b451a', '#3a7536'];
    for (let f = 0; f < 22; f++) {
      const fz = hs.z - hs.w * 0.46 + (f / 21) * (hs.w * 0.92);
      const fx = frontX + hs.facing * (1.46 + (vineRand() - 0.5) * 0.25);
      const fy = plinthTop + 4.38 - vineRand() * 1.35;
      const rad = 0.20 + vineRand() * 0.28;
      const isFlower = vineRand() > 0.40;
      const geo = new THREE.DodecahedronGeometry(rad, 0);
      geo.translate(fx, fy, fz);
      const hex = isFlower
        ? flowerHexes[Math.floor(vineRand() * flowerHexes.length)]
        : leafHexes[Math.floor(vineRand() * leafHexes.length)];
      bougainvilleaParts.push(colorizeForMerge(geo, hex));
    }
  }

  // 3. Hanging Arcs of Multi-Color Ribbed Silk Lanterns across the canal & quays + Floating Hoa Đăng
  const stringZs = [20.5, 27.5, 34.5, 55.5, 62.5, 69.5];
  stringZs.forEach((sz, sIdx) => {
    const xStart = 161.2;
    const xEnd = 188.8;
    const sagPts: THREE.Vector3[] = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const lx = THREE.MathUtils.lerp(xStart, xEnd, t);
      const ly = bankY + 6.4 - 1.65 * Math.sin(t * Math.PI);
      sagPts.push(new THREE.Vector3(lx, ly, sz));
    }
    const cable = createVariableTubeGeometry(sagPts, new Array(sagPts.length).fill(0.03), 6);
    woodParts.push(cable);

    for (let l = 1; l < segs; l += 2) {
      const p = sagPts[l];
      const hex = lanternPalette[(sIdx * 3 + l) % lanternPalette.length];
      const lRad = 0.34;
      const lH = 0.88;
      const shell = createRibbedLanternShellGeometry(lRad, lH, 14, 10);
      shell.translate(p.x, p.y - 0.48, p.z);
      lanternParts.push(colorizeForMerge(shell, hex));

      const cap = createLanternCapGeometry(lRad, lH);
      cap.translate(p.x, p.y - 0.48, p.z);
      woodParts.push(cap);

      const core = createLanternCoreGeometry(lRad, lH);
      core.translate(p.x, p.y - 0.48, p.z);
      coreParts.push(core);

      // Soft warm light pool on water or stone quay beneath each lantern
      const poolY = p.x > 166.8 && p.x < 183.2 ? 0.05 : bankY + 0.06;
      const pool = new THREE.CircleGeometry(2.6, 16);
      pool.rotateX(-Math.PI * 0.5);
      pool.translate(p.x, poolY, p.z);
      lightPoolParts.push(colorizeForMerge(pool, hex));
    }
  });

  // Glowing Hoa Đăng paper lotus lanterns floating on Hoài Canal (y = 0.05)
  const rand = mulberry32(202607);
  for (let i = 0; i < 42; i++) {
    const fx = 168.0 + rand() * 14.0;
    const fz = 14.0 + rand() * 62.0;
    if (Math.abs(fz - bridgeZ) < 4.5) continue; // keep clear of Chùa Cầu piers
    const hoaHex = i % 3 === 0 ? '#ff6a33' : i % 3 === 1 ? '#ffd24d' : '#ff77aa';
    const petalBase = new THREE.CylinderGeometry(0.32, 0.18, 0.16, 6);
    petalBase.translate(fx, 0.08, fz);
    lanternParts.push(colorizeForMerge(petalBase, hoaHex));

    const flame = new THREE.SphereGeometry(0.11, 6, 6);
    flame.translate(fx, 0.20, fz);
    coreParts.push(flame);

    const waterPool = new THREE.CircleGeometry(1.15, 12);
    waterPool.rotateX(-Math.PI * 0.5);
    waterPool.translate(fx, 0.04, fz);
    lightPoolParts.push(colorizeForMerge(waterPool, hoaHex));
  }

  const lanternAnimU = { uTime: { value: 0.0 } };
  animatedUniforms.push(lanternAnimU);

  const silkLanternMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: '#ff9436',
    emissiveMap: null,
    emissiveIntensity: 2.15,
    roughness: 0.34
  });
  silkLanternMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = lanternAnimU.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vLanternY;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLanternY = position.y;
         if (position.y > 1.8) {
           float sway = sin(uTime * 1.45 + position.x * 0.37 + position.z * 0.29) * 0.055;
           transformed.x += sway;
           transformed.z += cos(uTime * 1.15 + position.z * 0.41) * 0.035;
         } else {
           transformed.y += sin(uTime * 1.8 + position.x * 0.7 + position.z * 0.5) * 0.025;
         }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vLanternY;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float ribBand = 0.80 + 0.24 * abs(sin(vLanternY * 18.0));
         totalEmissiveRadiance *= vColor * ribBand;`
      );
  };
  ctx.extraMaterials.push(silkLanternMat);

  const { material: lightPoolMat, uniforms: poolU } = createWarmLightPoolMaterial();
  ctx.extraMaterials.push(lightPoolMat);
  animatedUniforms.push(poolU);

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const ochreMesh = new THREE.Mesh(mergeNormalized(ochreParts), ctx.materials.yellowOchrePlaster);
  ochreMesh.castShadow = true;
  ochreMesh.receiveShadow = true;

  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;

  const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), ctx.materials.crimsonLacquer);
  crimsonMesh.castShadow = true;

  const tileMesh = new THREE.Mesh(mergeNormalized(tileParts), ctx.materials.terracottaRoof);
  tileMesh.castShadow = true;
  tileMesh.receiveShadow = true;

  const darkRoofMesh = new THREE.Mesh(mergeNormalized(darkRoofParts), ctx.materials.darkRoof);
  darkRoofMesh.castShadow = true;

  const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), ctx.materials.darkVoid);

  const lanternMesh = new THREE.Mesh(mergeNormalized(lanternParts), silkLanternMat);
  lanternMesh.name = 'HoiAnLanternsAndHoaDang';

  const coreMesh = new THREE.Mesh(
    mergeNormalized(coreParts),
    ctx.materials.lanternCore ?? silkLanternMat
  );
  coreMesh.name = 'HoiAnLanternCandleCores';

  const lightPoolMesh = new THREE.Mesh(mergeNormalized(lightPoolParts), lightPoolMat);
  lightPoolMesh.name = 'HoiAnLanternLightPools';

  if (goldParts.length > 0) {
    const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold);
    goldMesh.castShadow = true;
    group.add(goldMesh);
  }

  if (bougainvilleaParts.length > 0) {
    const bougainvilleaMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      side: THREE.DoubleSide
    });
    ctx.extraMaterials.push(bougainvilleaMat);
    const bougainvilleaMesh = new THREE.Mesh(mergeNormalized(bougainvilleaParts), bougainvilleaMat);
    bougainvilleaMesh.castShadow = true;
    bougainvilleaMesh.name = 'HoiAnBalconyBougainvillea';
    group.add(bougainvilleaMesh);
  }

  for (const lz of [27.5, 62.5]) {
    const hoiAnLight = new THREE.PointLight('#ff9c44', 28.0, 38.0, 1.5);
    hoiAnLight.position.set(cx, bankY + 4.8, lz);
    group.add(hoiAnLight);
  }

  group.add(
    stoneMesh,
    ochreMesh,
    woodMesh,
    crimsonMesh,
    tileMesh,
    darkRoofMesh,
    voidMesh,
    lanternMesh,
    coreMesh,
    lightPoolMesh
  );
  ctx.scene.add(group);
  return group;
}

/**
 * 3. Cầu Rồng Đà Nẵng (335, -35): Monumental 210m long x 18m wide steel-and-concrete bridge
 *    (x = 228..442, deck y = 8.5m, piers to -2.6m) + 26m-tall 5-wave Golden Dragon Spine +
 *    14m-tall Dragon Head at x ~ 418 + animated Fire-Breath / Water Mist Shader Plume.
 */
function buildDragonBridgeDaNang(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DragonBridgeDaNangComplex';

  const cz = -35;
  ctx.exclusionCircles.push({ x: 228, z: -35, r: 16.0 }, { x: 442, z: -35, r: 16.0 });

  const stoneParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const eyeParts: THREE.BufferGeometry[] = [];

  // Bridge elevation helper: flat y = 8.5m across [258..412], sloped ramps down to y = 2.0m banks at [228..258] & [412..442]
  const getDeckY = (x: number): number => {
    if (x <= 258) {
      const t = clamp01((x - 228) / 30);
      return THREE.MathUtils.lerp(2.0, 8.5, t);
    }
    if (x >= 412) {
      const t = clamp01((x - 412) / 30);
      return THREE.MathUtils.lerp(8.5, 2.0, t);
    }
    return 8.5;
  };

  // 1. Broad estuary piers grounded down to y = -2.6m & massive riverbank abutments
  const pierXs = [248, 276, 305, 335, 365, 395, 422];
  for (const px of pierXs) {
    const topY = getDeckY(px) - 0.8;
    const botY = -2.6;
    const h = topY - botY;
    for (const pzOff of [-5.8, 0.0, 5.8]) {
      addBox(stoneParts, 2.8, h, 2.4, px, botY + h * 0.5, cz + pzOff);
    }
    // Cross pier cap beam spanning full 18m width
    addBox(stoneParts, 3.4, 1.35, 17.2, px, topY - 0.25, cz);
  }
  // Solid riverbank approach abutments anchored into y = 2.0m banks
  addBox(stoneParts, 8.0, 4.2, 18.8, 229.0, 0.6, cz);
  addBox(stoneParts, 8.0, 4.2, 18.8, 441.0, 0.6, cz);

  // 2. Monumental 214m (210m main span) x 18m wide roadway deck, ramps, sidewalks & girders
  const deckSegs = 48;
  for (let i = 0; i < deckSegs; i++) {
    const x0 = 228 + (i / deckSegs) * 214;
    const x1 = 228 + ((i + 1) / deckSegs) * 214;
    const xm = (x0 + x1) * 0.5;
    const y0 = getDeckY(x0);
    const y1 = getDeckY(x1);
    const ym = (y0 + y1) * 0.5;
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.14;
    const tiltZ = Math.atan2(y1 - y0, x1 - x0);

    // 18m wide concrete roadway deck slab
    addBox(stoneParts, len, 0.95, 18.0, xm, ym - 0.45, cz, 0, 0, tiltZ);
    // Raised pedestrian sidewalks & outer steel railings
    for (const sz of [-8.65, 8.65]) {
      addBox(steelParts, len, 0.95, 0.42, xm, ym + 0.5, cz + sz, 0, 0, tiltZ);
      addBox(stoneParts, len, 0.28, 1.5, xm, ym + 0.14, cz + sz * 0.92, 0, 0, tiltZ);
    }
    // Twin under-deck steel box girders & central dragon spine median curb
    for (const gz of [-5.2, 5.2]) {
      addBox(steelParts, len, 0.85, 0.7, xm, ym - 1.15, cz + gz, 0, 0, tiltZ);
    }
    addBox(steelParts, len, 0.55, 1.8, xm, ym + 0.28, cz, 0, 0, tiltZ);
  }

  // 3. Lý-Dynasty Sinuous Golden Dragon Spine arching 26m high above water in 5 truss-supported waves
  const spinePts: THREE.Vector3[] = [];
  const spineRadii: number[] = [];
  const steps = 140;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = THREE.MathUtils.lerp(246.0, 417.5, t);
    let y: number;
    let r: number;

    if (t < 0.08) {
      // West dragon tail sweeping gracefully upward from median tail tip
      const lt = t / 0.08;
      y = THREE.MathUtils.lerp(18.5, 9.6, lt);
      r = THREE.MathUtils.lerp(0.28, 0.88, lt);
    } else if (t <= 0.91) {
      // 5 crisp sinusoidal arches peaking at 26.0m above water (y = 9.4m .. 26.0m)
      const wt = (t - 0.08) / 0.83;
      const wave = Math.pow(Math.abs(Math.sin(wt * Math.PI * 5.0)), 1.65);
      y = 9.4 + 16.6 * wave;
      r = 0.92 + 0.22 * Math.sin(wt * Math.PI);
    } else {
      // East neck rising cleanly into the 14m-tall Dragon Head at x ~ 418
      const nt = (t - 0.91) / 0.09;
      y = THREE.MathUtils.lerp(9.4, 18.8, Math.sin(nt * Math.PI * 0.5));
      r = THREE.MathUtils.lerp(1.05, 1.32, nt);
    }

    const zWeave = cz + 1.55 * Math.sin(t * Math.PI * 5.0);
    spinePts.push(new THREE.Vector3(x, y, zWeave));
    spineRadii.push(r);
  }

  const dragonTube = createVariableTubeGeometry(spinePts, spineRadii, 14);
  goldParts.push(dragonTube);

  // Secondary parallel golden tubular chords & crisp diagonal truss struts + vertical hangers
  for (let i = 4; i < steps - 3; i++) {
    const p = spinePts[i];
    const next = spinePts[i + 1];
    const slope = Math.atan2(next.y - p.y, next.x - p.x);

    // Dorsal golden crest spikes along spine
    if (i % 2 === 0) {
      addCone(goldParts, 0.34, 1.45, 4, p.x, p.y + spineRadii[i] + 0.55, p.z, 0, 0, slope - Math.PI * 0.1);
    }

    // Truss-supported steel hangers & V-struts down to deck median
    if (i % 3 === 0 && p.y > 9.8) {
      const deckY = getDeckY(p.x) + 0.35;
      const cableH = p.y - deckY;
      for (const zOff of [-0.65, 0.65]) {
        addCyl(steelParts, 0.08, 0.09, cableH, 6, p.x, deckY + cableH * 0.5, cz + zOff);
      }
      // Diagonal truss cross-brace
      if (i % 6 === 0 && i + 3 < steps) {
        const p2 = spinePts[i + 3];
        const midX = (p.x + p2.x) * 0.5;
        const midY = (p.y + deckY) * 0.5;
        const diagLen = Math.hypot(p2.x - p.x, p.y - deckY);
        const diagAng = Math.atan2(deckY - p.y, p2.x - p.x);
        addCyl(goldParts, 0.09, 0.09, diagLen, 6, midX, midY, cz, 0, 0, diagAng - Math.PI * 0.5);
      }
    }
  }

  // 4. Sculpted 14m-tall Golden Dragon Head at East span (x ~ 418, neck base ~11m up to horns ~25m)
  const hx = 418.0;
  const hy = 18.8;
  const hz = cz;
  // Cranium, cheeks, upper snout & nostrils
  addBox(goldParts, 5.4, 2.8, 3.6, hx + 1.2, hy + 0.4, hz, 0, 0, 0.08);
  addBox(goldParts, 4.2, 1.65, 2.6, hx + 4.4, hy + 0.6, hz, 0, 0, 0.06);
  addBox(goldParts, 1.4, 1.1, 2.9, hx + 5.8, hy + 0.95, hz, 0, 0, 0.12);
  // Open lower jaw & chin beard
  addBox(goldParts, 4.2, 1.1, 2.3, hx + 3.8, hy - 1.85, hz, 0, 0, -0.32);
  addCone(goldParts, 0.65, 2.6, 5, hx + 4.4, hy - 3.2, hz, Math.PI, 0, 0.25);

  // Swept horns (rising to ~25m), crown flame crest & curving whiskers
  for (const sz of [-1.25, 1.25]) {
    addCone(goldParts, 0.44, 5.2, 8, hx - 0.6, hy + 3.4, hz + sz, sz * 0.22, 0, 0.55);
    addCyl(goldParts, 0.12, 0.22, 4.6, 6, hx + 5.4, hy + 0.2, hz + sz * 1.15, sz * 0.42, 0, -0.42);
    // Glowing amber dragon eye
    const eye = new THREE.SphereGeometry(0.45, 10, 8);
    eye.translate(hx + 2.2, hy + 1.15, hz + sz * 1.45);
    eyeParts.push(eye);
  }
  addCone(goldParts, 0.72, 4.4, 6, hx + 0.6, hy + 3.6, hz, 0, 0, 0.38);

  // 5. Animated Amber Fire-Breath / Water Mist Shader Plume projecting East (+X)
  const fireUniforms = {
    uTime: { value: 0.0 }
  };
  animatedUniforms.push(fireUniforms);

  const fireConeGeo = new THREE.ConeGeometry(6.2, 22.0, 28, 20, true);
  fireConeGeo.rotateZ(Math.PI * 0.5);
  fireConeGeo.translate(hx + 15.2, hy - 0.6, hz);

  const fireShaderMat = new THREE.ShaderMaterial({
    uniforms: fireUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float axial = 1.0 - uv.y;
        pos.y += sin(pos.x * 0.55 - uTime * 7.5) * 0.95 * axial;
        pos.z += cos(pos.x * 0.65 - uTime * 6.2) * 0.85 * axial;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vNormalDir = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      uniform float uTime;
      void main() {
        float fromMouth = 1.0 - vUv.y;
        float axialFade = smoothstep(0.0, 0.12, fromMouth) * pow(1.0 - smoothstep(0.15, 1.0, fromMouth), 1.35);
        float edgeFade = pow(abs(dot(normalize(vNormalDir), normalize(vViewDir))), 1.2);

        float turb = sin(vUv.x * 18.0 + uTime * 9.0) * cos(fromMouth * 12.0 - uTime * 11.0);
        float flicker = 0.72 + 0.28 * sin(uTime * 13.0 + fromMouth * 6.0) + 0.16 * turb;

        vec3 coreCol = vec3(1.0, 0.86, 0.34);
        vec3 outerCol = vec3(1.0, 0.36, 0.05);
        vec3 col = mix(coreCol, outerCol, smoothstep(0.05, 0.72, fromMouth));
        float alpha = clamp(axialFade * edgeFade * flicker * 0.82, 0.0, 0.90);
        gl_FragColor = vec4(col * 1.45, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(fireShaderMat);

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const steelMesh = new THREE.Mesh(mergeNormalized(steelParts), ctx.materials.granite);
  steelMesh.castShadow = true;

  const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold);
  goldMesh.castShadow = true;

  const eyeMesh = new THREE.Mesh(mergeNormalized(eyeParts), ctx.materials.lanternSilk);

  const fireMesh = new THREE.Mesh(fireConeGeo, fireShaderMat);
  fireMesh.name = 'DragonBridgeFireBreath';

  group.add(stoneMesh, steelMesh, goldMesh, eyeMesh, fireMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 4. Hang Sơn Đoòng — Quảng Bình (365, -205): Cathedral-scale 115m wide x 65m tall vaulted
 *    limestone karst cavern dome breached by a collapsed Doline Skylight pouring bright
 *    Volumetric Sunbeams onto 14m cave jungle trees, 28m calcite stalagmite spires, and a turquoise cave lake.
 */
function buildSonDoongCave(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number } }>,
  foliageCanopyMat: THREE.MeshStandardMaterial
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SonDoongCaveComplex';

  const cx = 365;
  const cz = -205;
  const floorY = ctx.getHeight(cx, cz); // 3.0m
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 52.0 });

  const rockParts: THREE.BufferGeometry[] = [];
  const trunkParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(88421);

  // 1. Cathedral-scale 115m wide (radius ~57.5m) x 65m tall vaulted limestone karst cavern dome
  const numSectors = 22;
  for (let i = 0; i < numSectors; i++) {
    const ang = (i / numSectors) * Math.PI * 2;
    // Keep wide walkable cavern entrance portal on Southwest/West side (ang ~ 0.85 * PI)
    const diffPortal = Math.abs(Math.atan2(Math.sin(ang - Math.PI * 0.88), Math.cos(ang - Math.PI * 0.88)));
    const isPortal = diffPortal < 0.28;

    if (!isPortal) {
      // Lower karst cavern wall columns seated deeply below floorY - 5m so no green grass peeks under walls
      const rWall = 52.5 + (rand() - 0.5) * 3.5;
      const wx = cx + Math.cos(ang) * rWall;
      const wz = cz + Math.sin(ang) * rWall;
      const wallRy = 26.0 + rand() * 5.0;
      const wallGeo = createSculptedRockGeometry(900 + i * 17, 14.5, wallRy, 13.5, 2);
      wallGeo.translate(wx, floorY + 7.5, wz); // minY <= floorY - 7.5m
      rockParts.push(wallGeo);

      // Continuous grounded base karst skirt closing all lower wall gaps
      const skirtGeo = createSculptedRockGeometry(980 + i * 13, 12.5, 11.5, 12.0, 2);
      skirtGeo.translate(cx + Math.cos(ang) * 48.0, floorY + 1.2, cz + Math.sin(ang) * 48.0);
      rockParts.push(skirtGeo);
    }

    // Mid-vault arching limestone ribs curving inward (r ~ 40m, y ~ 40m)
    const midR = 40.5 + (rand() - 0.5) * 2.5;
    const mx = cx + Math.cos(ang) * midR;
    const mz = cz + Math.sin(ang) * midR;
    const midRib = createSculptedRockGeometry(1100 + i * 21, 13.5, 13.5, 12.0, 2);
    midRib.rotateZ(Math.cos(ang) * 0.42);
    midRib.rotateX(-Math.sin(ang) * 0.42);
    midRib.translate(mx, floorY + 38.5 + (rand() - 0.5) * 3.0, mz);
    rockParts.push(midRib);

    // Upper dome vault framing the massive collapsed Doline Skylight (skylight rim r ~ 20..24m, apex y ~ 65m above floor)
    const topR = 25.0 + (rand() - 0.5) * 2.2;
    const tx = cx + Math.cos(ang) * topR;
    const tz = cz + Math.sin(ang) * topR;
    const topArch = createSculptedRockGeometry(1300 + i * 29, 10.5, 8.0, 9.8, 2);
    topArch.rotateZ(Math.cos(ang) * 0.55);
    topArch.rotateX(-Math.sin(ang) * 0.55);
    topArch.translate(tx, floorY + 57.5 + (rand() - 0.5) * 2.5, tz);
    rockParts.push(topArch);
  }

  // Towering flanking karst gate crags deeply grounded at cavern entrance portal
  for (const angOff of [-0.34, 0.34]) {
    const ang = Math.PI * 0.88 + angOff;
    const px = cx + Math.cos(ang) * 49.5;
    const pz = cz + Math.sin(ang) * 49.5;
    const portalRock = createSculptedRockGeometry(1500 + angOff * 100, 12.5, 25.0, 12.0, 2);
    portalRock.translate(px, floorY + 6.5, pz);
    rockParts.push(portalRock);
  }

  // 2. Massive 28m-tall layered calcite stalagmite spires deeply grounded (minY < groundY - 2.0)
  const stalagmites = [
    { ox: -16.5, oz: -16.0, r: 4.0, h: 28.0 },
    { ox: 18.0, oz: -14.5, r: 4.4, h: 26.5 },
    { ox: 16.5, oz: 17.5, r: 3.8, h: 22.0 },
    { ox: -14.0, oz: 18.5, r: 3.5, h: 19.5 },
    { ox: 24.5, oz: 4.5, r: 3.4, h: 18.0 }
  ];
  stalagmites.forEach((st, idx) => {
    const sx = cx + st.ox;
    const sz = cz + st.oz;
    const gy = ctx.getHeight(sx, sz);
    const sinkBase = gy - 4.0; // guarantees minY < groundY - 2.0 even with rock bottom flattening
    const spire = createSculptedRockGeometry(1700 + idx * 31, st.r, st.h * 0.62, st.r * 0.92, 2);
    spire.translate(sx, sinkBase + st.h * 0.45, sz);
    rockParts.push(spire);

    // Layered secondary calcite skirt shelves around base
    const collar = createSculptedRockGeometry(1900 + idx * 19, st.r * 1.48, st.h * 0.24, st.r * 1.38, 2);
    collar.translate(sx, sinkBase + st.h * 0.16, sz);
    rockParts.push(collar);
  });

  // 3. "Vườn Địa Đàng" subterranean primary forest mound directly beneath Doline Skylight (14m jungle trees!)
  const moundX = cx - 4.0;
  const moundZ = cz - 3.0;
  const moundGy = ctx.getHeight(moundX, moundZ);
  const mound = createSculptedRockGeometry(2101, 18.0, 4.8, 16.5, 2);
  mound.translate(moundX, moundGy - 0.5, moundZ);
  rockParts.push(mound);

  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rand() * 0.3;
    const dist = 2.0 + rand() * 16.5;
    const fx = moundX + Math.cos(a) * dist;
    const fz = moundZ + Math.sin(a) * dist;
    const fy = ctx.getHeight(fx, fz) + (dist < 11.0 ? 2.4 : 0.2);
    const sc = 1.1 + rand() * 0.85;

    if (i % 3 === 0) {
      // Towering 14m subterranean cave jungle trees with organic tapered cylindrical root buttresses
      const treeH = 11.5 + rand() * 3.5; // ~11.5..15m tall
      addCyl(trunkParts, 0.34, 0.78, treeH + 2.8, 8, fx, fy + treeH * 0.5 - 1.4, fz);
      for (let b = 0; b < 4; b++) {
        const ba = (b / 4) * Math.PI * 2 + a;
        addCyl(
          trunkParts,
          0.14,
          0.38,
          3.2,
          6,
          fx + Math.cos(ba) * 0.55,
          fy - 0.15,
          fz + Math.sin(ba) * 0.55,
          Math.sin(ba) * 0.42,
          0,
          -Math.cos(ba) * 0.42
        );
      }
      foliageParts.push(createShrubCardCluster(fx, fy + treeH - 1.5, fz, 3.6 * sc, i));
      foliageParts.push(createShrubCardCluster(fx + 1.8, fy + treeH - 3.2, fz - 1.2, 2.7 * sc, i + 7));
    } else {
      // Dense cave ferns and understory palms
      foliageParts.push(createShrubCardCluster(fx, fy - 0.3, fz, 2.2 * sc, i));
    }
  }

  // 4. Glowing Turquoise Underground Cave Lake in sculpted stone basin
  const poolX = cx + 13.5;
  const poolZ = cz + 9.5;
  const poolBaseY = ctx.getHeight(poolX, poolZ);
  const poolRim = new THREE.TorusGeometry(11.5, 1.35, 8, 28);
  poolRim.rotateX(Math.PI * 0.5);
  poolRim.scale(1.18, 0.65, 0.92);
  poolRim.translate(poolX, poolBaseY + 0.25, poolZ);
  rockParts.push(poolRim);

  const poolDisk = new THREE.CircleGeometry(11.4, 32);
  poolDisk.rotateX(-Math.PI * 0.5);
  poolDisk.scale(1.16, 1.0, 0.9);
  poolDisk.translate(poolX, poolBaseY + 0.45, poolZ);

  const cavePoolMat = new THREE.MeshStandardMaterial({
    color: '#0e857a',
    emissive: '#0fb59c',
    emissiveIntensity: 0.48,
    roughness: 0.12,
    metalness: 0.25
  });
  ctx.extraMaterials.push(cavePoolMat);

  // 5. Dramatic 62m-tall Diagonal Volumetric Sunbeam Shafts pouring down through Doline Skylight
  const sunbeamUniforms = {
    uTime: { value: 0.0 }
  };
  animatedUniforms.push(sunbeamUniforms);

  const shaftParts: THREE.BufferGeometry[] = [];
  const shaftOffsets = [
    { ox: -2.0, oz: -1.5, rTop: 10.5, rBot: 18.5, h: 66.0 },
    { ox: 6.5, oz: 3.5, rTop: 7.5, rBot: 13.5, h: 63.0 },
    { ox: -8.5, oz: 4.5, rTop: 6.5, rBot: 11.5, h: 62.0 }
  ];
  for (const s of shaftOffsets) {
    const cyl = new THREE.CylinderGeometry(s.rTop, s.rBot, s.h, 28, 1, true);
    cyl.translate(0, s.h * 0.5, 0);
    cyl.rotateZ(-0.22);
    cyl.rotateX(0.12);
    cyl.translate(cx + s.ox, floorY + 0.4, cz + s.oz);
    shaftParts.push(cyl);
  }

  const sunbeamMat = new THREE.ShaderMaterial({
    uniforms: sunbeamUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalDir = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;
      uniform float uTime;
      void main() {
        float rim = pow(abs(dot(normalize(vNormalDir), normalize(vViewDir))), 1.75);
        float vertFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.76, 1.0, vUv.y));
        float shimmer = 0.82 + 0.18 * sin(vUv.x * 12.0 + vUv.y * 8.0 - uTime * 1.1);
        vec3 beamCol = mix(vec3(0.55, 0.95, 0.72), vec3(1.0, 0.88, 0.56), vUv.y);
        float alpha = clamp(rim * vertFade * shimmer * 0.24, 0.0, 0.36);
        gl_FragColor = vec4(beamCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(sunbeamMat);

  const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), ctx.materials.granite);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;

  const trunkMesh = new THREE.Mesh(mergeNormalized(trunkParts), ctx.materials.bark);
  trunkMesh.castShadow = true;

  const foliageMesh = new THREE.Mesh(mergeNormalized(foliageParts), foliageCanopyMat);
  foliageMesh.castShadow = true;

  const poolMesh = new THREE.Mesh(poolDisk, cavePoolMat);
  poolMesh.name = 'SonDoongReflectionPool';

  const sunbeamMesh = new THREE.Mesh(mergeNormalized(shaftParts), sunbeamMat);
  sunbeamMesh.name = 'SonDoongVolumetricSunbeams';

  group.add(rockMesh, trunkMesh, foliageMesh, poolMesh, sunbeamMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 5. Phong Nha - Kẻ Bàng (275, -255): Monumental 38m wide x 24m tall vaulted subterranean
 *    river cavern portal spanning the emerald water inlet (x in [255..295]), hung with 4-9m
 *    limestone stalactites, riverbank stalagmites, timber sightseeing dock (275, -225) & moored boat.
 */
function buildPhongNhaGrotto(ctx: VietnamBuilderContext): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PhongNhaGrottoComplex';

  const cx = 275;
  const cz = -255;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 24.0 }, { x: 275, z: -225, r: 10.0 });

  const rockParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(55193);

  // 1. Flanking cliff shoulders & grounded lower bank rock massifs (rooted down to -4.8m below river bed)
  for (const side of [-1, 1]) {
    const cliffX = cx + side * 20.5;
    for (let k = 0; k < 6; k++) {
      const kz = cz + 18.0 - k * 9.0;
      const wall = createSculptedRockGeometry(3100 + side * 50 + k, 9.5, 19.0, 9.2, 2);
      wall.translate(cliffX, 6.2, kz); // minY ~ -4.8m
      rockParts.push(wall);

      // Lower riverbank rock base closing all terrain gaps along waterline
      const bankRock = createSculptedRockGeometry(3250 + side * 40 + k, 8.2, 8.5, 8.6, 2);
      bankRock.translate(cx + side * 18.5, 2.0, kz); // minY ~ -2.9m
      rockParts.push(bankRock);
    }
    // Wide rocky waterline shelves inside cavern mouth for rising stalagmites (y = -2.6..+1.3m)
    addBox(rockParts, 7.6, 3.9, 44.0, cx + side * 17.5, -0.65, cz - 4.0);
  }

  // Monumental 38m wide (half-span 19m) x 24m tall vaulted limestone river cavern portal
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const ang = t * Math.PI;
    const ax = cx + Math.cos(ang) * 19.0;
    const ay = -1.0 + Math.sin(ang) * 25.0; // springs from -1.0m underwater, crowns at y = 24.0m
    for (let row = 0; row < 4; row++) {
      const az = cz + 12.0 - row * 10.5;
      const archBlock = createSculptedRockGeometry(3400 + i * 19 + row * 7, 5.6, 5.2, 6.8, 2);
      archBlock.translate(ax, ay, az);
      rockParts.push(archBlock);
    }
  }

  // Deep recessed cavern back closure at z = -286 grounded below river bed so sky/seams never leak through
  const backWall = createSculptedRockGeometry(3900, 26.0, 20.0, 9.0, 2);
  backWall.translate(cx, 6.0, cz - 30.0);
  rockParts.push(backWall);
  addBox(voidParts, 42.0, 28.0, 1.5, cx, 6.5, cz - 26.5);

  // 2. Dozens of sculpted faceted limestone stalactites (4-9m long) hanging from arch roof & riverbank stalagmites
  for (let i = 0; i < 42; i++) {
    const sx = cx - 14.5 + rand() * 29.0;
    const sz = cz + 11.5 - rand() * 34.0;
    const normX = Math.abs(sx - cx) / 19.0;
    const ceilY = -1.0 + 25.0 * Math.sqrt(Math.max(0.1, 1.0 - normX * normX)) - 1.2;
    const dropLen = 4.0 + rand() * 5.0; // 4..9m long
    const r = 0.45 + rand() * 0.72;
    addCone(rockParts, r, dropLen, 6, sx, ceilY - dropLen * 0.45, sz, Math.PI, rand() * Math.PI);
  }
  for (let i = 0; i < 20; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const sx = cx + side * (14.5 + rand() * 3.2);
    const sz = cz + 11.0 - rand() * 32.0;
    const riseH = 4.0 + rand() * 5.5;
    // Grounded deeply inside the y = 1.3m waterline rock shelf (base at y = 0.1m)
    addCone(rockParts, 0.65 + rand() * 0.72, riseH, 6, sx, 0.1 + riseH * 0.5, sz, 0, rand() * Math.PI);
  }

  // 3. Weathered timber sightseeing dock at (275, -225) & moored wooden river boat
  const dockX = 275.0;
  const dockZ = -225.0;
  addBox(woodParts, 10.5, 0.28, 4.2, dockX, 0.72, dockZ);
  addBox(woodParts, 3.6, 0.28, 8.5, dockX - 3.4, 0.72, dockZ + 5.8); // shore walkway gangplank
  for (let px = -4.5; px <= 4.5; px += 2.25) {
    for (const pzOff of [-1.8, 1.8]) {
      addCyl(woodParts, 0.14, 0.18, 3.6, 8, dockX + px, -0.8, dockZ + pzOff);
    }
  }
  // Dock lantern posts (ribbed silk lanterns + bright golden inner candle cores)
  const coreParts: THREE.BufferGeometry[] = [];
  for (const lx of [dockX - 4.4, dockX, dockX + 4.4]) {
    addCyl(woodParts, 0.08, 0.1, 2.2, 8, lx, 1.85, dockZ - 1.8);
    const lOrb = createRibbedLanternShellGeometry(0.28, 0.62, 12, 8);
    lOrb.translate(lx, 3.05, dockZ - 1.8);
    lanternParts.push(lOrb);

    const cap = createLanternCapGeometry(0.28, 0.62);
    cap.translate(lx, 3.05, dockZ - 1.8);
    woodParts.push(cap);

    const core = createLanternCoreGeometry(0.28, 0.62);
    core.translate(lx, 3.05, dockZ - 1.8);
    coreParts.push(core);
  }
  // Traditional moored wooden sightseeing river boat on water (y = 0.08)
  const boatX = dockX + 1.5;
  const boatZ = dockZ - 3.8;
  addBox(woodParts, 7.6, 0.52, 2.1, boatX, 0.14, boatZ, 0.08);
  addCone(woodParts, 0.9, 1.8, 4, boatX + 4.2, 0.35, boatZ - 0.32, 0, 0.08, -Math.PI * 0.5);
  addCone(woodParts, 0.85, 1.6, 4, boatX - 4.1, 0.32, boatZ + 0.32, 0, 0.08, Math.PI * 0.5);

  // Warm amber grotto bounce lights illuminating wet stalactites inside cavern mouth
  const grottoLight = new THREE.PointLight('#ffaa55', 65.0, 58.0, 1.6);
  grottoLight.position.set(cx, 7.5, cz - 4.0);
  group.add(grottoLight);

  const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), ctx.materials.granite);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;

  const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), ctx.materials.darkVoid);

  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;

  const lanternMesh = new THREE.Mesh(mergeNormalized(lanternParts), ctx.materials.lanternSilk);
  const coreMesh = new THREE.Mesh(
    mergeNormalized(coreParts),
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk
  );

  group.add(rockMesh, voidMesh, woodMesh, lanternMesh, coreMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 6. Thánh địa Mỹ Sơn (-320, -135): True 1:1 ancient Chăm Pa valley temple group:
 *    24m-tall Tower A1 Kalan + 15m & 11.5m flanking chamBrick towers, weathered sandstone
 *    lintels, central Mandapa pillar ruins & mossy jungle boulders.
 */
function buildMySonSanctuary(
  ctx: VietnamBuilderContext,
  foliageCanopyMat: THREE.MeshStandardMaterial
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'MySonSanctuaryComplex';

  const cx = -320;
  const cz = -135;
  const yBase = ctx.getHeight(cx, cz); // 4.0m
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 28.0 });

  const brickParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const rockParts: THREE.BufferGeometry[] = [];
  const mossParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lampCoreParts: THREE.BufferGeometry[] = [];

  // 1. Stepped weathered sandstone sanctuary terrace
  addBox(stoneParts, 38.0, 2.2, 38.0, cx, yBase - 0.85, cz);
  const courtY = yBase + 0.25;

  // 2. 24m-tall Tower A1 Kalan + 15m & 11.5m flanking chamBrick towers (facing East +X)
  const towers = [
    { ox: -6.5, oz: 0.0, w: 8.0, h: 24.0, tiers: 4 },   // Tower A1 Kalan (24m)
    { ox: -10.0, oz: -11.5, w: 5.2, h: 15.0, tiers: 3 }, // Flanking North Tower (15m)
    { ox: -9.5, oz: 11.2, w: 4.4, h: 11.5, tiers: 3 }    // Flanking South Tower (11.5m)
  ];
  for (const tw of towers) {
    const towerGeo = createChamTowerGeometry(tw.w, tw.h, tw.tiers);
    towerGeo.rotateY(Math.PI * 0.5);
    towerGeo.translate(cx + tw.ox, courtY, cz + tw.oz);
    brickParts.push(towerGeo);

    // Projecting East sandstone portal colonnettes, lintel & stepped Kala-Makara flame pediment
    const lintelX = cx + tw.ox + tw.w * 0.58;
    const lintelZ = cz + tw.oz;
    const portalH = tw.h * 0.28;
    addBox(stoneParts, 0.92, 0.72, tw.w * 0.64, lintelX, courtY + portalH + 0.36, lintelZ);
    // Stepped triangular Kala-Makara sandstone tympanum relief above lintel
    addBox(stoneParts, 0.68, 0.62, tw.w * 0.46, lintelX + 0.08, courtY + portalH + 0.98, lintelZ);
    addBox(stoneParts, 0.54, 0.56, tw.w * 0.28, lintelX + 0.12, courtY + portalH + 1.54, lintelZ);
    addCone(stoneParts, tw.w * 0.14, 0.75, 4, lintelX + 0.12, courtY + portalH + 2.15, lintelZ);
    for (const sz of [-tw.w * 0.25, tw.w * 0.25]) {
      addBox(stoneParts, 0.78, portalH, 0.56, lintelX, courtY + portalH * 0.5, lintelZ + sz);
      addBox(stoneParts, 0.96, 0.32, 0.76, lintelX, courtY + 0.16, lintelZ + sz);
    }
    // Sandstone corner *tháp góc* miniature pinnacles framing lower roof cornice
    for (const sx of [-tw.w * 0.44, tw.w * 0.44]) {
      for (const sz of [-tw.w * 0.44, tw.w * 0.44]) {
        addCone(stoneParts, 0.36, 1.15, 4, cx + tw.ox + sx, courtY + tw.h * 0.46, cz + tw.oz + sz);
      }
    }
  }

  // Open Vaulted East Sanctuary Vestibule (*Tiền Sảnh*) & Illuminated *Linga-Yoni* Garbhagriha of Tower A1
  const vestX = cx - 0.68;
  addBox(brickParts, 3.2, 0.48, 4.6, vestX, courtY + 0.24, cz);
  for (const side of [-1, 1]) {
    addBox(brickParts, 3.0, 4.4, 0.65, vestX, courtY + 2.45, cz + side * 1.95);
    addBox(stoneParts, 0.55, 4.4, 0.62, vestX + 1.48, courtY + 2.45, cz + side * 1.42);
  }
  addBox(brickParts, 3.3, 0.65, 4.7, vestX, courtY + 4.95, cz);
  addBox(brickParts, 2.6, 0.78, 3.6, vestX - 0.15, courtY + 5.65, cz);
  addCone(brickParts, 1.45, 1.55, 4, vestX - 0.25, courtY + 6.75, cz);
  // Sculpted Sandstone *Linga-Yoni* Altar inside Tower A1 East Sanctuary Chamber (clear of Kalan brick molding)
  const lyX = vestX + 0.10;
  addBox(stoneParts, 1.65, 0.58, 1.65, lyX, courtY + 0.77, cz); // stepped Yoni base
  addBox(stoneParts, 1.32, 0.32, 1.32, lyX, courtY + 1.22, cz); // Yoni trough basin
  addBox(stoneParts, 0.48, 0.22, 0.92, lyX, courtY + 1.24, cz - 1.02); // authentic North-facing Yoni spout (*somasutra*)
  addCyl(stoneParts, 0.28, 0.32, 1.15, 14, lyX, courtY + 1.95, cz); // central Linga shaft
  lampCoreParts.push(new THREE.SphereGeometry(0.14, 8, 8).translate(lyX + 0.88, courtY + 1.42, cz - 0.62));
  lampCoreParts.push(new THREE.SphereGeometry(0.14, 8, 8).translate(lyX + 0.88, courtY + 1.42, cz + 0.62));
  for (const side of [-1, 1]) {
    addCyl(bronzeParts, 0.10, 0.15, 0.78, 8, lyX + 0.88, courtY + 0.88, cz + side * 0.62);
  }
  addCyl(bronzeParts, 0.24, 0.18, 0.36, 12, lyX + 1.02, courtY + 0.66, cz); // bronze offering censer
  const mySonSanctumLight = new THREE.PointLight('#ffb156', 2.2, 13, 1.5);
  mySonSanctumLight.position.set(lyX + 0.75, courtY + 2.35, cz);
  group.add(mySonSanctumLight);

  // Central Mandapa hall platform, double rows of ruined brick/sandstone pillars & carved Apsara stelae
  const mandapaX = cx + 6.5;
  addBox(brickParts, 11.5, 0.85, 8.6, mandapaX, courtY + 0.42, cz);
  const mandapaY = courtY + 0.85;
  for (const pxOff of [-4.2, -1.4, 1.4, 4.2]) {
    for (const pzOff of [-3.1, 3.1]) {
      const brokenH = pxOff === -1.4 ? 3.8 : pxOff === 1.4 ? 2.6 : 3.2;
      addBox(brickParts, 0.85, brokenH, 0.85, mandapaX + pxOff, mandapaY + brokenH * 0.5, cz + pzOff);
      addBox(stoneParts, 1.05, 0.24, 1.05, mandapaX + pxOff, mandapaY + 0.12, cz + pzOff);
      addBox(stoneParts, 1.02, 0.20, 1.02, mandapaX + pxOff, mandapaY + brokenH + 0.10, cz + pzOff);
    }
  }
  // Carved sandstone Apsara / Shiva offering table in Mandapa center
  addBox(stoneParts, 2.2, 0.72, 1.35, mandapaX, mandapaY + 0.36, cz);
  addCyl(bronzeParts, 0.22, 0.16, 0.32, 10, mandapaX, mandapaY + 0.88, cz);

  // Eastern Gopura arched entrance portal crowned with miniature Cham pyramidal roof & Dvarapala pedestals
  const gopura = createArchedWallGeometry(7.8, 6.8, 1.8, 3.4, 4.8);
  gopura.rotateY(Math.PI * 0.5);
  gopura.translate(cx + 15.8, courtY, cz);
  stoneParts.push(gopura);
  addBox(stoneParts, 2.6, 0.68, 8.6, cx + 15.8, courtY + 7.1, cz);
  const gopuraCrest = createChamTowerGeometry(3.8, 4.6, 2);
  gopuraCrest.rotateY(Math.PI * 0.5);
  gopuraCrest.translate(cx + 15.8, courtY + 7.42, cz);
  brickParts.push(gopuraCrest);
  for (const side of [-1, 1]) {
    // Sculpted sandstone Dvarapala guardian plinths flanking East Gopura
    addBox(stoneParts, 1.15, 0.72, 1.15, cx + 17.6, courtY + 0.36, cz + side * 2.55);
    const guard = createSculptedRockGeometry(4190 + side, 0.38, 0.72, 0.38, 2);
    guard.translate(cx + 17.6, courtY + 1.32, cz + side * 2.55);
    stoneParts.push(guard);
  }

  // Twin flanking Courtyard Linga-Yoni Sandstone Altars (with North spouts)
  for (const [ax, az] of [
    [cx + 0.8, cz - 6.2],
    [cx + 0.8, cz + 6.2]
  ]) {
    addBox(stoneParts, 2.2, 0.85, 2.2, ax, courtY + 0.42, az);
    addBox(stoneParts, 0.44, 0.24, 0.75, ax, courtY + 0.72, az - 1.32);
    addCyl(stoneParts, 0.38, 0.46, 1.15, 12, ax, courtY + 1.40, az);
  }

  // 3. Creeping mossy jungle boulders & fallen brick ruins around sanctuary perimeter
  const rand = mulberry32(41092);
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2 + 0.2;
    const dist = 19.5 + rand() * 6.5;
    const rx = cx + Math.cos(ang) * dist;
    const rz = cz + Math.sin(ang) * dist;
    const ry = ctx.getHeight(rx, rz);
    const bGeo = createSculptedRockGeometry(4100 + i * 13, 1.6 + rand() * 1.2, 1.1 + rand() * 0.9, 1.5 + rand() * 1.1, 2);
    bGeo.translate(rx, ry + 0.25, rz);
    rockParts.push(bGeo);
    if (i % 2 === 0) {
      mossParts.push(createShrubCardCluster(rx, ry + 0.4, rz, 1.5 + rand() * 0.7, i));
    }
  }

  const brickMesh = new THREE.Mesh(mergeNormalized(brickParts), ctx.materials.chamBrick);
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  const stoneMesh = new THREE.Mesh(
    mergeNormalized(stoneParts),
    ctx.materials.ochreSand ?? ctx.materials.stone
  );
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), ctx.materials.granite);
  rockMesh.castShadow = true;

  const mossMesh = new THREE.Mesh(mergeNormalized(mossParts), foliageCanopyMat);
  mossMesh.castShadow = true;

  const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze);
  bronzeMesh.castShadow = true;

  const lampMesh = new THREE.Mesh(
    mergeNormalized(lampCoreParts),
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk
  );

  group.add(brickMesh, stoneMesh, rockMesh, mossMesh, bronzeMesh, lampMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 7. Tháp Chàm Poshanư (435, 95): Real Hoa Lai trio on coastal headland (y = 20m):
 *    16m Tower A, 12m Tower B, 5m Tower C (chamBrick) on stepped stone podiums.
 */
function buildPoshanuTowers(ctx: VietnamBuilderContext): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PoshanuTowerComplex';

  const cx = 435;
  const cz = 95;
  const yBase = ctx.getHeight(cx, cz); // 20.0m
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 22.0 });

  const brickParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const boulderParts: THREE.BufferGeometry[] = [];

  // 1. Stepped stone podium terraces deeply grounded into coastal bluff (y = 20.0m)
  addBox(stoneParts, 26.0, 2.8, 30.0, cx, yBase - 0.95, cz);
  addBox(stoneParts, 21.0, 0.85, 25.0, cx, yBase + 0.85, cz);
  const podiumY = yBase + 1.28;

  // Approach stone stairway on the West (-X) face leading down to bluff ground
  for (let s = 0; s < 6; s++) {
    addBox(stoneParts, 1.0, 0.36, 5.4, cx - 13.2 - s * 0.85, yBase + 1.08 - s * 0.24, cz);
  }

  // 2. Real Hoa Lai Trio (16m Tower A, 12m Tower B, 5m Tower C) facing East (+X)
  const towers = [
    { ox: 0.8, oz: 0.0, w: 5.6, h: 16.0, tiers: 4 },    // Tower A (16m)
    { ox: -1.4, oz: -8.6, w: 4.4, h: 12.0, tiers: 3 },  // Tower B (12m)
    { ox: 3.2, oz: 8.2, w: 2.6, h: 5.0, tiers: 2 }      // Tower C (5m)
  ];
  for (const tw of towers) {
    const tGeo = createChamTowerGeometry(tw.w, tw.h, tw.tiers);
    tGeo.rotateY(Math.PI * 0.5);
    tGeo.translate(cx + tw.ox, podiumY, cz + tw.oz);
    brickParts.push(tGeo);
  }

  // 3. Desert coastal sandstone boulders around headland bluff rim
  const rand = mulberry32(72341);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.4;
    const dist = 15.5 + rand() * 4.5;
    const bx = cx + Math.cos(ang) * dist;
    const bz = cz + Math.sin(ang) * dist;
    const by = ctx.getHeight(bx, bz);
    const rock = createSculptedRockGeometry(5100 + i * 29, 1.5 + rand() * 1.1, 1.1 + rand() * 0.8, 1.4 + rand() * 1.0, 2);
    rock.translate(bx, by + 0.18, bz);
    boulderParts.push(rock);
  }

  const brickMesh = new THREE.Mesh(mergeNormalized(brickParts), ctx.materials.chamBrick);
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  const stoneMesh = new THREE.Mesh(
    mergeNormalized(stoneParts),
    ctx.materials.ochreSand ?? ctx.materials.stone
  );
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const boulderMesh = new THREE.Mesh(mergeNormalized(boulderParts), ctx.materials.granite);
  boulderMesh.castShadow = true;

  group.add(brickMesh, stoneMesh, boulderMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 8. Thung lũng Tình Yêu / Đồi Langbiang (-375, 165): Real scale pine summit ridge (y = 34m)
 *    with 9.5m tall timber overlook gazebo pavilion, stone lookout terrace (clear East entrance),
 *    hydrangea/cosmos flowerbeds & 16m-tall highland pines.
 */
function buildDaLatLangbiang(ctx: VietnamBuilderContext): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DaLatLangbiangComplex';

  const cx = -375;
  const cz = 165;
  const yBase = ctx.getHeight(cx, cz); // 34.0m
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 24.0 });

  const stoneParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const pineParts: THREE.BufferGeometry[] = [];
  const flowerParts: THREE.BufferGeometry[] = [];

  // 1. Stone Lookout Terrace (r = 14.5m, grounded deeply) + Curved Overlook Parapet (clear East corridor!)
  addCyl(stoneParts, 14.2, 15.2, 2.2, 28, cx, yBase - 0.65, cz);
  const terraceY = yBase + 0.45;
  for (let i = -7; i <= 7; i++) {
    const ang = Math.PI * 0.22 + (i + 7) / 14 * Math.PI * 1.56; // leaves East (-0.22..+0.22 rad) clear!
    const px = cx + Math.cos(ang) * 13.5;
    const pz = cz + Math.sin(ang) * 13.5;
    addBox(stoneParts, 0.55, 1.15, 0.55, px, terraceY + 0.58, pz, -ang);
  }

  // 2. 9.5m-tall Timber Overlook Gazebo Pavilion
  addCyl(stoneParts, 5.8, 6.2, 0.55, 8, cx, terraceY + 0.275, cz);
  const pavY = terraceY + 0.55;
  const postR = 4.6;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(ang) * postR;
    const pz = cz + Math.sin(ang) * postR;
    addCyl(woodParts, 0.18, 0.22, 4.8, 8, px, pavY + 2.4, pz);
    // Wooden bench & railing between posts (leave front East entrance open at i=0 and i=5)
    if (i > 0 && i < 5) {
      const nAng = ((i + 1) / 6) * Math.PI * 2;
      const mx = cx + (Math.cos(ang) + Math.cos(nAng)) * 0.5 * postR;
      const mz = cz + (Math.sin(ang) + Math.sin(nAng)) * 0.5 * postR;
      addBox(woodParts, 4.4, 0.22, 0.24, mx, pavY + 1.15, mz, -ang - Math.PI / 6);
      addBox(woodParts, 4.4, 0.18, 0.65, mx, pavY + 0.58, mz, -ang - Math.PI / 6);
    }
  }
  // Steep 2-tier hexagonal terracotta shingle hip roof reaching ~9.5m above terrace + hanging lantern
  const gazeboRoof1 = new THREE.ConeGeometry(6.8, 2.8, 6);
  gazeboRoof1.translate(cx, pavY + 6.1, cz);
  roofParts.push(gazeboRoof1);

  const gazeboRoof2 = new THREE.ConeGeometry(4.2, 2.6, 6);
  gazeboRoof2.translate(cx, pavY + 7.85, cz);
  roofParts.push(gazeboRoof2);

  addCyl(woodParts, 0.12, 0.22, 0.75, 6, cx, pavY + 9.35, cz);

  const pavLantern = createRibbedLanternShellGeometry(0.42, 0.92, 14, 10);
  pavLantern.translate(cx, pavY + 4.35, cz);
  lanternParts.push(pavLantern);

  const pavCap = createLanternCapGeometry(0.42, 0.92);
  pavCap.translate(cx, pavY + 4.35, cz);
  woodParts.push(pavCap);

  const pavCore = createLanternCoreGeometry(0.42, 0.92);
  pavCore.translate(cx, pavY + 4.35, cz);

  // 3. Vibrant Purple / Magenta Hydrangea & Cosmos Flower Beds around the terrace (keeping East entrance clear!)
  const rand = mulberry32(99123);
  const flowerHexes = ['#9a4dff', '#d633a6', '#7b61ff', '#e85bc8', '#b469ff'];
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2 + rand() * 0.12;
    const dist = 6.8 + rand() * 5.2;
    const fx = cx + Math.cos(ang) * dist;
    const fz = cz + Math.sin(ang) * dist;
    // Keep front East entrance corridor wide clear
    if (Math.abs(fz - cz) < 3.4 && fx > cx + 2.5) continue;

    const fy = terraceY + 0.15;
    const bush = new THREE.DodecahedronGeometry(0.68 + rand() * 0.28, 0);
    bush.scale(1.25, 0.68, 1.25);
    bush.translate(fx, fy + 0.25, fz);
    pineParts.push(colorizeForMerge(bush, '#2e6b34'));

    for (let b = 0; b < 3; b++) {
      const bx = fx + (rand() - 0.5) * 0.95;
      const bz = fz + (rand() - 0.5) * 0.95;
      const bloom = new THREE.SphereGeometry(0.26 + rand() * 0.12, 7, 6);
      bloom.translate(bx, fy + 0.62 + rand() * 0.24, bz);
      flowerParts.push(colorizeForMerge(bloom, flowerHexes[(i + b) % flowerHexes.length]));
    }
  }

  // 4. Towering 16m-tall Đà Lạt Highland Pines (*Thông Đà Lạt*) grounded around plateau perimeter
  const pineCount = 18;
  for (let i = 0; i < pineCount; i++) {
    const ang = (i / pineCount) * Math.PI * 2 + 0.22;
    const dist = 16.5 + rand() * 5.5;
    const px = cx + Math.cos(ang) * dist;
    const pz = cz + Math.sin(ang) * dist;
    if (px > cx + 8.0 && Math.abs(pz - cz) < 5.5) continue; // keep East view corridor clear
    const py = ctx.getHeight(px, pz) - 0.9;
    const sc = 0.95 + rand() * 0.22; // ~15-18m tall highland pines
    const trunkH = 14.5 * sc;

    addCyl(barkParts, 0.24 * sc, 0.52 * sc, trunkH, 8, px, py + trunkH * 0.5, pz);

    for (let t = 0; t < 5; t++) {
      const coneR = (4.2 - t * 0.62) * sc;
      const coneH = (4.8 - t * 0.45) * sc;
      const coneY = py + (5.2 + t * 2.45) * sc;
      const whorl = new THREE.ConeGeometry(coneR, coneH, 9);
      whorl.rotateY(t * 0.45 + rand() * 0.4);
      whorl.translate(px, coneY, pz);
      pineParts.push(colorizeForMerge(whorl, t % 2 === 0 ? '#24592c' : '#2d6b36'));
    }
  }

  const pineMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82
  });
  const flowerMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62
  });
  ctx.extraMaterials.push(pineMat, flowerMat);

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;

  const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof);
  roofMesh.castShadow = true;

  const lanternMesh = new THREE.Mesh(mergeNormalized(lanternParts), ctx.materials.lanternSilk);
  const pavCoreMesh = new THREE.Mesh(
    pavCore,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk
  );

  const barkMesh = new THREE.Mesh(mergeNormalized(barkParts), ctx.materials.bark);
  barkMesh.castShadow = true;

  const pineMesh = new THREE.Mesh(mergeNormalized(pineParts), pineMat);
  pineMesh.castShadow = true;

  const flowerMesh = new THREE.Mesh(mergeNormalized(flowerParts), flowerMat);

  group.add(stoneMesh, woodMesh, roofMesh, lanternMesh, pavCoreMesh, barkMesh, pineMesh, flowerMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 9. Biển hồ T'Nưng (-455, 42 lake / -405, 42 rim): 18m-tall traditional Gia Lai Nhà Rông
 *    axe-blade thatched communal longhouse anchored at (-404, 42) (y = 14m rim) with timber deck,
 *    grounded staircase stringers + basalt rim boulders framing the 85m sapphire crater lake.
 */
function buildBienHoTNung(ctx: VietnamBuilderContext): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BienHoTNungComplex';

  const houseX = -404;
  const houseZ = 42;
  ctx.exclusionCircles.push({ x: houseX, z: houseZ, r: 18.0 });

  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const basaltParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const ceramicParts: THREE.BufferGeometry[] = [];
  const emberParts: THREE.BufferGeometry[] = [];

  const rimY = ctx.getHeight(houseX, houseZ); // ~14.0m
  const deckY = rimY + 2.4;

  // 1. Grounded hardwood stilt pillars supporting the 18m-tall Bahnar Nhà Rông longhouse floor
  for (const ox of [-3.4, 0.0, 3.4]) {
    for (const oz of [-5.8, -2.0, 2.0, 5.8]) {
      const px = houseX + ox;
      const pz = houseZ + oz;
      const gy = ctx.getHeight(px, pz) - 1.2;
      const h = deckY - gy;
      addCyl(woodParts, 0.22, 0.28, h, 8, px, gy + h * 0.5, pz);
    }
  }

  // Timber deck, open veranda railing & walk-in Bahnar communal hall (replacing closed solid box)
  addBox(woodParts, 8.6, 0.36, 13.8, houseX, deckY, houseZ);
  const hallH = 3.4;
  // Interior structural corner & wall hardwood pillars reaching up to the thatched roof frame
  for (const ox of [-3.1, 3.1]) {
    for (const oz of [-5.4, -1.8, 1.8, 5.4]) {
      addCyl(woodParts, 0.16, 0.20, hallH, 8, houseX + ox, deckY + hallH * 0.5, houseZ + oz);
    }
  }
  // Open-gallery woven plank walls (West back wall, North/South end walls, flanking East wings leaving wide central entry)
  addBox(woodParts, 0.24, hallH, 11.2, houseX - 3.15, deckY + hallH * 0.5, houseZ); // West rear wall
  addBox(woodParts, 6.4, hallH, 0.24, houseX, deckY + hallH * 0.5, houseZ - 5.5); // North gable wall
  addBox(woodParts, 6.4, hallH, 0.24, houseX, deckY + hallH * 0.5, houseZ + 5.5); // South gable wall
  for (const side of [-1, 1]) {
    // East front flanking walls + half-height veranda rail + swinging woven doors folded open
    addBox(woodParts, 0.22, hallH, 3.4, houseX + 3.15, deckY + hallH * 0.5, houseZ + side * 3.85);
    addBox(woodParts, 0.16, 2.45, 0.95, houseX + 3.55, deckY + 1.38, houseZ + side * 2.05, side * -0.45);
    addBox(woodParts, 0.16, 0.92, 4.8, houseX + 4.2, deckY + 0.62, houseZ + side * 4.2);
    // Bahnar geometric tribal crimson & gold frieze motifs along front eaves & gable lintels
    addBox(crimsonParts, 0.28, 0.42, 3.5, houseX + 3.22, deckY + hallH - 0.22, houseZ + side * 3.85);
    addBox(goldParts, 0.30, 0.12, 3.4, houseX + 3.24, deckY + hallH - 0.46, houseZ + side * 3.85);
  }
  // Carved East entrance header beam & Bahnar geometric diamond sun emblem
  addBox(crimsonParts, 0.28, 0.52, 4.4, houseX + 3.18, deckY + hallH - 0.26, houseZ);
  addBox(goldParts, 0.30, 0.12, 4.2, houseX + 3.20, deckY + hallH - 0.54, houseZ);
  for (const oz of [-1.2, 0.0, 1.2]) {
    addBox(goldParts, 0.10, 0.28, 0.28, houseX + 3.31, deckY + hallH - 0.26, houseZ + oz, 0, Math.PI * 0.25, 0);
  }
  // Exposed interior hardwood tie beams (*xà ngang Nhà Rông*) supporting steep roof
  for (const oz of [-3.6, -1.8, 1.8, 3.6]) {
    addBox(woodParts, 6.4, 0.22, 0.22, houseX, deckY + hallH - 0.15, houseZ + oz);
  }

  // Interior Sacred Central Fire Hearth (*Bếp Lửa Nhà Rông*) with basalt stones, charred logs & glowing embers
  addBox(basaltParts, 2.05, 0.28, 2.05, houseX + 0.1, deckY + 0.30, houseZ);
  addBox(emberParts, 1.38, 0.14, 1.38, houseX + 0.1, deckY + 0.45, houseZ);
  for (let lg = 0; lg < 4; lg++) {
    const a = (lg / 4) * Math.PI;
    addCyl(woodParts, 0.08, 0.10, 1.25, 6, houseX + 0.1, deckY + 0.58, houseZ, Math.PI * 0.5, a);
  }
  const hearthLight = new THREE.PointLight('#ff8f3a', 2.8, 15, 1.4);
  hearthLight.position.set(houseX + 0.25, deckY + 1.55, houseZ);
  group.add(hearthLight);

  // UNESCO *Cồng Chiêng Tây Nguyên* Bronze Gong Rack & *Trống Hơgơr* along Rear West Wall
  addBox(woodParts, 0.26, 2.25, 0.26, houseX - 2.35, deckY + 1.28, houseZ - 2.6);
  addBox(woodParts, 0.26, 2.25, 0.26, houseX - 2.35, deckY + 1.28, houseZ + 2.6);
  addBox(woodParts, 0.22, 0.18, 5.4, houseX - 2.35, deckY + 2.35, houseZ);
  for (let g = 0; g < 5; g++) {
    const gz = houseZ - 1.9 + g * 0.95;
    const gr = 0.28 + (2 - Math.abs(g - 2)) * 0.06;
    const gong = new THREE.CylinderGeometry(gr, gr, 0.08, 16);
    gong.rotateZ(Math.PI * 0.5);
    gong.translate(houseX - 2.32, deckY + 1.48, gz);
    bronzeParts.push(gong);
    const boss = new THREE.SphereGeometry(gr * 0.28, 8, 6);
    boss.translate(houseX - 2.26, deckY + 1.48, gz);
    goldParts.push(boss);
  }

  // Sacred *Chóe Rượu Cần* Ceramic Rice-Wine Jars with Curving Bamboo Drinking Straws
  const jarPositions: Array<[number, number, number]> = [
    [houseX - 1.05, houseZ, 1.25], // Hero ceremonial central wine jar beside hearth
    [houseX - 1.65, houseZ - 3.4, 0.95],
    [houseX - 1.65, houseZ - 2.3, 0.90],
    [houseX - 1.65, houseZ + 2.3, 0.90],
    [houseX - 1.65, houseZ + 3.4, 0.95],
    [houseX + 1.2, houseZ - 3.6, 0.88],
    [houseX + 1.2, houseZ + 3.6, 0.88]
  ];
  for (const [jx, jz, jScale] of jarPositions) {
    addCyl(ceramicParts, 0.20 * jScale, 0.26 * jScale, 0.34 * jScale, 10, jx, deckY + 0.35 * jScale, jz);
    addCyl(ceramicParts, 0.28 * jScale, 0.20 * jScale, 0.38 * jScale, 10, jx, deckY + 0.68 * jScale, jz);
    addCyl(ceramicParts, 0.16 * jScale, 0.26 * jScale, 0.18 * jScale, 10, jx, deckY + 0.94 * jScale, jz);
    // Bamboo drinking straws (*cần hút rượu*) emerging from jar mouth
    addCyl(goldParts, 0.02, 0.02, 0.95 * jScale, 5, jx + 0.18 * jScale, deckY + 1.25 * jScale, jz + 0.12 * jScale, 0.35, 0.4);
    addCyl(goldParts, 0.02, 0.02, 0.95 * jScale, 5, jx - 0.16 * jScale, deckY + 1.25 * jScale, jz - 0.12 * jScale, -0.35, -0.4);
  }

  // Tall Ceremonial *Cây Nêu* Cosmic Festival Pole outside East staircase entrance
  const neuX = houseX + 10.6;
  const neuZ = houseZ - 3.8;
  const neuY = ctx.getHeight(neuX, neuZ);
  addCyl(basaltParts, 1.45, 1.65, 0.38, 12, neuX, neuY + 0.16, neuZ);
  addCyl(woodParts, 0.10, 0.18, 11.4, 8, neuX, neuY + 5.7, neuZ);
  for (const tierY of [4.2, 6.4, 8.6]) {
    const span = tierY < 6 ? 2.4 : tierY < 8 ? 1.85 : 1.3;
    addBox(crimsonParts, span, 0.14, 0.14, neuX, neuY + tierY, neuZ);
    addBox(crimsonParts, 0.14, 0.14, span, neuX, neuY + tierY, neuZ);
    for (const side of [-1, 1]) {
      addBox(goldParts, 0.14, 0.95, 0.06, neuX + side * span * 0.45, neuY + tierY - 0.48, neuZ);
      addBox(crimsonParts, 0.06, 0.95, 0.14, neuX, neuY + tierY - 0.48, neuZ + side * span * 0.45);
    }
  }
  addCone(goldParts, 0.36, 0.95, 4, neuX, neuY + 11.75, neuZ);
  // Secondary ritual wine jar at base of *Cây Nêu*
  addCyl(ceramicParts, 0.24, 0.20, 0.68, 10, neuX + 0.62, neuY + 0.68, neuZ + 0.35);

  // Characteristic notched wooden ceremonial entry stair on East side (+X) with twin grounded stringer beams
  for (let s = 0; s < 8; s++) {
    addBox(woodParts, 0.58, 0.32, 2.1, houseX + 4.0 + s * 0.46, deckY - s * 0.31, houseZ);
  }
  const stX0 = houseX + 3.6;
  const stY0 = deckY + 0.14;
  const stX1 = houseX + 7.8;
  const stY1 = ctx.getHeight(stX1, houseZ) - 0.8;
  const stLen = Math.hypot(stX1 - stX0, stY1 - stY0);
  const stPitch = Math.atan2(stY1 - stY0, stX1 - stX0);
  for (const side of [-1, 1]) {
    addBox(
      woodParts,
      stLen,
      0.36,
      0.24,
      (stX0 + stX1) * 0.5,
      (stY0 + stY1) * 0.5,
      houseZ + side * 1.05,
      0,
      0,
      stPitch
    );
  }
  addBox(woodParts, 0.85, 0.9, 2.4, houseX + 7.5, ctx.getHeight(houseX + 7.5, houseZ) - 0.25, houseZ);

  // Towering 12.6m steep axe-blade thatched roof (*Mái Nhà Rông*, apex ~18.4m above rimY)
  const roofH = 12.6;
  const nhaRongRoof = createNhaRongRoofGeometry(13.8, 10.2, roofH);
  nhaRongRoof.rotateY(Math.PI * 0.5);
  nhaRongRoof.translate(houseX, deckY + 3.4, houseZ);
  roofParts.push(nhaRongRoof);

  // Carved crimson tribal ridge crests & finials at both flared gable tips
  for (const gz of [-9.4, 9.4]) {
    addCyl(crimsonParts, 0.09, 0.16, 2.2, 6, houseX, deckY + 3.4 + roofH + 0.85, houseZ + gz);
    addCone(crimsonParts, 0.42, 0.85, 4, houseX, deckY + 3.4 + roofH + 2.25, houseZ + gz);
  }

  // 2. Wooden Viewing Deck jutting West (-X) over the 85m sapphire crater lake rim
  const viewDeckX0 = -408.0;
  const viewDeckX1 = -417.5;
  const viewDeckMidX = (viewDeckX0 + viewDeckX1) * 0.5;
  const viewDeckY = rimY + 0.8;
  addBox(woodParts, viewDeckX0 - viewDeckX1, 0.32, 10.5, viewDeckMidX, viewDeckY, houseZ);
  addBox(woodParts, 0.22, 1.15, 10.5, viewDeckX1 + 0.12, viewDeckY + 0.65, houseZ);
  for (const rz of [houseZ - 5.14, houseZ + 5.14]) {
    addBox(woodParts, viewDeckX0 - viewDeckX1, 1.15, 0.22, viewDeckMidX, viewDeckY + 0.65, rz);
  }
  for (const px of [-408.5, -412.8, -417.0]) {
    for (const pz of [houseZ - 4.8, houseZ, houseZ + 4.8]) {
      const gy = ctx.getHeight(px, pz) - 1.6;
      const h = viewDeckY - gy;
      addCyl(woodParts, 0.16, 0.21, h, 8, px, gy + h * 0.5, pz);
    }
  }

  // 3. Dark volcanic basalt rim boulders framing the 85m sapphire crater lake (-455, 42)
  const rand = mulberry32(61804);
  for (let i = 0; i < 24; i++) {
    const ang = -0.85 + (i / 23) * 1.7; // sweeping eastern crater rim arc
    const dist = 45.5 + rand() * 8.5;
    const bx = -455 + Math.cos(ang) * dist;
    const bz = 42 + Math.sin(ang) * dist;
    if (Math.abs(bz - 42) < 7.2 && bx > -419 && bx < -400) continue;
    const by = ctx.getHeight(bx, bz);
    const rock = createSculptedRockGeometry(6200 + i * 23, 1.4 + rand() * 1.1, 1.0 + rand() * 0.8, 1.5 + rand() * 1.0, 2);
    rock.translate(bx, by + 0.15, bz);
    basaltParts.push(rock);
  }

  const thatchMat = new THREE.MeshStandardMaterial({
    color: '#9c7c46',
    roughness: 0.92,
    side: THREE.DoubleSide
  });
  const basaltMat = new THREE.MeshStandardMaterial({
    color: '#34363a',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughnessMap: ctx.pbr.granite.roughnessMap,
    roughness: 0.88
  });
  const ceramicJarMat = new THREE.MeshStandardMaterial({
    color: '#5a321d',
    roughness: 0.32,
    metalness: 0.08
  });
  const hearthEmberMat = new THREE.MeshStandardMaterial({
    color: '#ff521a',
    emissive: new THREE.Color('#ff6a18'),
    emissiveIntensity: 1.85,
    roughness: 0.72
  });
  ctx.extraMaterials.push(thatchMat, basaltMat, ceramicJarMat, hearthEmberMat);

  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;

  const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), thatchMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;

  const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), ctx.materials.crimsonLacquer);
  crimsonMesh.castShadow = true;

  const basaltMesh = new THREE.Mesh(mergeNormalized(basaltParts), basaltMat);
  basaltMesh.castShadow = true;

  const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze);
  const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold);
  const ceramicMesh = new THREE.Mesh(mergeNormalized(ceramicParts), ceramicJarMat);
  const emberMesh = new THREE.Mesh(mergeNormalized(emberParts), hearthEmberMat);

  group.add(woodMesh, roofMesh, crimsonMesh, basaltMesh, bronzeMesh, goldMesh, ceramicMesh, emberMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * Builds all 9 Central Vietnam & Central Highlands heritage landmarks and returns animated shader uniforms.
 */
export function buildVietnamCentralLandmarks(ctx: VietnamBuilderContext): VietnamCentralBuildResult {
  const animatedUniforms: Array<{ uTime: { value: number } }> = [];

  // Shared extra materials used across Central landmarks
  // Bright Imperial Yellow glazed tiles (Hoàng Lưu Ly) without terracotta red albedo multiplication
  const imperialGoldRoofMat = new THREE.MeshStandardMaterial({
    color: '#f0b928',
    normalMap: ctx.pbr.darkRoof.normalMap,
    roughnessMap: ctx.pbr.darkRoof.roughnessMap,
    roughness: 0.28,
    metalness: 0.16,
    side: THREE.DoubleSide
  });
  const foliageCanopyMat = new THREE.MeshStandardMaterial({
    color: '#3a7a30',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.42,
    roughness: 0.78,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(imperialGoldRoofMat, foliageCanopyMat);

  buildHueImperialCitadel(ctx, imperialGoldRoofMat, animatedUniforms);
  buildHoiAnAncientTown(ctx, animatedUniforms);
  buildDragonBridgeDaNang(ctx, animatedUniforms);
  buildSonDoongCave(ctx, animatedUniforms, foliageCanopyMat);
  buildPhongNhaGrotto(ctx);
  buildMySonSanctuary(ctx, foliageCanopyMat);
  buildPoshanuTowers(ctx);
  buildDaLatLangbiang(ctx);
  buildBienHoTNung(ctx);

  return { animatedUniforms };
}
