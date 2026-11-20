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
  createNotchedLotusPadGeometry,
  createBronzeIncenseTripodParts,
  createIncenseSmokeSystem,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createLanternCapGeometry,
  createWarmLightPoolMaterial,
  createWavingSilkFlagMaterial
} from './vietnamGeometryHelpers';
import {
  createSignagePlaqueMesh,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createCarvedDragonBalustradeParts,
  createGuardianBeastParts,
  createSculptedDeityParts,
  createHoiAnDoorEyesParts,
  createImperialUrnParts,
  createBronzeBellParts,
  createChamReliefTympanumParts,
  createVintageJeepParts,
  createUmbrellaPineParts
} from './vietnamMotifHelpers';
import {
  addStrut,
  colorizeGeometry,
  transformGeometryXZY
} from '../vietnam/geometry/PartsBuilder';

export interface VietnamCentralBuildResult {
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
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
  parts.push(transformGeometryXZY(new THREE.BoxGeometry(w, h, d), x, y, z, rotX, rotZ, rotY));
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
  parts.push(transformGeometryXZY(new THREE.CylinderGeometry(rTop, rBot, h, segs), x, y, z, rotX, rotZ, rotY));
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
  parts.push(transformGeometryXZY(new THREE.ConeGeometry(r, h, segs), x, y, z, rotX, rotZ, rotY));
}

/**
 * Creates a sculpted 3D extruded heart geometry centered near the origin in the XY plane.
 */
function createHeartGeometry(scale = 0.5, depth = 0.18): THREE.BufferGeometry {
  const s = Math.max(0.05, scale);
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.78 * s);
  shape.bezierCurveTo(0.88 * s, -0.22 * s, 1.02 * s, 0.52 * s, 0.48 * s, 0.78 * s);
  shape.bezierCurveTo(0.18 * s, 0.92 * s, 0.02 * s, 0.65 * s, 0, 0.42 * s);
  shape.bezierCurveTo(-0.02 * s, 0.65 * s, -0.18 * s, 0.92 * s, -0.48 * s, 0.78 * s);
  shape.bezierCurveTo(-1.02 * s, 0.52 * s, -0.88 * s, -0.22 * s, 0, -0.78 * s);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.04, depth),
    bevelEnabled: true,
    bevelThickness: Math.max(0.015, depth * 0.25),
    bevelSize: Math.max(0.015, s * 0.06),
    bevelSegments: 2,
    curveSegments: 10
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

/**
 * Generates a curved upturned hexagonal Vietnamese / highland pavilion tiled roof.
 */
function createHexCurvedRoofGeometry(
  radius: number,
  height: number,
  eaveFlare = 0.42,
  topRadius = 0.16
): THREE.BufferGeometry {
  const sides = 6;
  const ringSegs = 8;
  const rTop = Math.max(0.06, topRadius);
  const geo = new THREE.CylinderGeometry(rTop, radius, height, sides, ringSegs, false);
  geo.translate(0, height * 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const radial = clamp01(Math.hypot(x, z) / Math.max(0.1, radius));
    const concave = Math.pow(1.0 - radial, 1.45);
    const ang = Math.atan2(z, x);
    // Upturned dragon-tail corner eaves along the 6 hexagonal hip ridges
    const ridgeAlign = Math.pow(Math.abs(Math.cos(ang * 3.0)), 3.0);
    const upturn = eaveFlare * Math.pow(radial, 2.3) * (0.35 + 0.95 * ridgeAlign);
    const targetY = y > 0.001 ? concave * height + upturn : 0.0;
    pos.setY(i, targetY);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates closed triangular/concave woven gable end walls matching `createNhaRongRoofGeometry`
 * at both `u = -1` and `u = +1` so the steep axe-blade roof is 100% enclosed (Fixes Bug B11).
 */
function createNhaRongGableWallsGeometry(
  length: number,
  width: number,
  height: number
): THREE.BufferGeometry {
  const halfLenTop = length * 0.70;
  const halfLenBase = length * 0.47;
  const strips = 18;
  const positions: number[] = [];
  const uvs: number[] = [];

  const evalX = (u: number, v: number): number =>
    u * THREE.MathUtils.lerp(halfLenTop, halfLenBase, Math.pow(v, 0.72));
  const evalY = (v: number): number =>
    (1.0 - Math.pow(v, 0.90)) * height + 0.85 * (1.0 - v * 0.65);
  const evalHalfW = (v: number): number => (width * 0.5) * Math.pow(v, 1.42);

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    ua: [number, number],
    ub: [number, number],
    uc: [number, number]
  ): void => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };

  for (const u of [-1, 1]) {
    for (let i = 0; i < strips; i++) {
      const v0 = i / strips;
      const v1 = (i + 1) / strips;
      const x0 = evalX(u, v0);
      const y0 = evalY(v0);
      const w0 = evalHalfW(v0);
      const x1 = evalX(u, v1);
      const y1 = evalY(v1);
      const w1 = evalHalfW(v1);

      if (i === 0) {
        const apex: [number, number, number] = [x0, y0, 0];
        const bl: [number, number, number] = [x1, y1, -w1];
        const br: [number, number, number] = [x1, y1, w1];
        if (u > 0) {
          pushTri(apex, br, bl, [0.5, 1.0], [1.0, 1.0 - v1], [0.0, 1.0 - v1]);
        } else {
          pushTri(apex, bl, br, [0.5, 1.0], [0.0, 1.0 - v1], [1.0, 1.0 - v1]);
        }
      } else {
        const tl: [number, number, number] = [x0, y0, -w0];
        const tr: [number, number, number] = [x0, y0, w0];
        const bl: [number, number, number] = [x1, y1, -w1];
        const br: [number, number, number] = [x1, y1, w1];
        if (u > 0) {
          pushTri(tl, tr, br, [0.0, 1.0 - v0], [1.0, 1.0 - v0], [1.0, 1.0 - v1]);
          pushTri(tl, br, bl, [0.0, 1.0 - v0], [1.0, 1.0 - v1], [0.0, 1.0 - v1]);
        } else {
          pushTri(tr, tl, bl, [1.0, 1.0 - v0], [0.0, 1.0 - v0], [0.0, 1.0 - v1]);
          pushTri(tr, bl, br, [1.0, 1.0 - v0], [0.0, 1.0 - v1], [1.0, 1.0 - v1]);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a Node/Vitest-safe procedural straw/thatch Canvas bump texture for Nhà Rông roof.
 */
function createThatchBumpTexture(extraTextures: THREE.Texture[]): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c2d = canvas.getContext('2d');
  if (!c2d) return null;
  c2d.fillStyle = '#7e663d';
  c2d.fillRect(0, 0, 256, 256);
  const rand = mulberry32(81923);
  for (let i = 0; i < 1400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const len = 14 + rand() * 26;
    const shade = Math.floor(85 + rand() * 95);
    c2d.strokeStyle = `rgb(${shade + 25}, ${shade + 8}, ${Math.max(25, shade - 30)})`;
    c2d.lineWidth = 1 + rand() * 1.4;
    c2d.beginPath();
    c2d.moveTo(x, y);
    c2d.lineTo(x + (rand() - 0.5) * 4, y + len);
    c2d.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  extraTextures.push(tex);
  return tex;
}

/**
 * Converts geometry to non-indexed with normals, uvs, and uniform RGB vertex color so
 * multi-colored static props (lanterns, flower clusters, pines) merge into a single draw call.
 */
function colorizeForMerge(geo: THREE.BufferGeometry, hexColor: string): THREE.BufferGeometry {
  return colorizeGeometry(geo, hexColor);
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
 *    True 1:1 57.8m U-shaped bastion (5.0m high, 18m wing arms), 3 central rectangular trabeated portals
 *    with crimson studded doors + 2 outer arched Dịch Môn, rear dragon staircases, Lầu Ngũ Phụng with
 *    open colonnaded wing pavilions exposing Đại Hồng Chung & Trống Sấm (Fixes Bug B2), chu_van balustrades,
 *    dragon-phoenix roof finials, NGỌ MÔN plaque, 9 Cửu Đỉnh urns, 8 Nguyễn Dynasty cannons, lotus-filled
 *    Thái Dịch moat, Tứ Trụ Nghi Môn with Nghê finials, and 42m Kỳ Đài flag tower.
 */
function buildHueImperialCitadel(
  ctx: VietnamBuilderContext,
  imperialGoldRoofMat: THREE.MeshStandardMaterial,
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HueImperialCitadelComplex';

  const cx = -185;
  const cz = 42;
  const yBase = ctx.getHeight(cx, cz); // 1.55m
  // Local (-28, +48) -> world (-137, +70)
  ctx.exclusionCircles.push(
    { x: -185, z: 42, r: 46.0 },
    { x: -136, z: 42, r: 20.0 },
    { x: -137, z: 70, r: 16.0 }
  );

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
  const bronzeParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const lotusLeafParts: THREE.BufferGeometry[] = [];
  const lotusBloomParts: THREE.BufferGeometry[] = [];

  // 1. 57.8m wide U-shaped limestone-and-brick bastion (5.0m high)
  const gateZ = -10.0;
  const rampartH = 5.0;
  const rampartDepth = 10.2;

  // 3 central rectangular trabeated portals (Chính Môn, Tả/Hữu Giáp Môn) + 2 outer arched Dịch Môn
  const portals = [
    { x: 0.0, w: 9.6, openW: 4.5, openH: 3.95, arched: false },   // Chính Môn (rectangular trabeated)
    { x: -8.6, w: 7.6, openW: 3.1, openH: 3.35, arched: false },  // Tả Giáp Môn (rectangular trabeated)
    { x: 8.6, w: 7.6, openW: 3.1, openH: 3.35, arched: false },   // Hữu Giáp Môn (rectangular trabeated)
    { x: -15.6, w: 6.4, openW: 2.5, openH: 2.95, arched: true },  // Tả Dịch Môn (arched)
    { x: 15.6, w: 6.4, openW: 2.5, openH: 2.95, arched: true }    // Hữu Dịch Môn (arched)
  ];

  for (let i = 0; i < portals.length; i++) {
    const p = portals[i];
    if (p.arched) {
      const wall = createArchedWallGeometry(p.w, rampartH, rampartDepth, p.openW, p.openH);
      wall.translate(p.x, 0, gateZ);
      stoneParts.push(wall);
    } else {
      // Authentic Huế trabeated rectangular stone portal: twin flanking masonry piers + solid stone lintel
      const pierW = Math.max(0.4, (p.w - p.openW) * 0.5);
      for (const side of [-1, 1]) {
        addBox(
          stoneParts,
          pierW,
          rampartH,
          rampartDepth,
          p.x + side * (p.openW * 0.5 + pierW * 0.5),
          rampartH * 0.5,
          gateZ
        );
        // Carved granite door jamb stone moldings
        addBox(
          marbleParts,
          0.26,
          p.openH,
          0.42,
          p.x + side * (p.openW * 0.5 + 0.08),
          p.openH * 0.5,
          gateZ + rampartDepth * 0.5 + 0.04
        );
      }
      const lintelH = Math.max(0.5, rampartH - p.openH);
      addBox(stoneParts, p.openW + 0.16, lintelH, rampartDepth, p.x, p.openH + lintelH * 0.5, gateZ);
      // Heavy rectangular stone lintel header molding
      addBox(
        marbleParts,
        p.openW + 0.65,
        0.34,
        0.46,
        p.x,
        p.openH + 0.17,
        gateZ + rampartDepth * 0.5 + 0.06
      );
    }

    // Recessed dark void + twin crimson wooden gate leaves decorated with rows of golden bronze door studs (*đinh cửa*)
    const doorDepth = rampartDepth * 0.40;
    addBox(voidParts, p.openW * 0.94, p.openH * 0.94, doorDepth, p.x, p.openH * 0.47, gateZ - 0.55);
    const leafW = p.openW * 0.44;
    const leafH = p.openH * (p.arched ? 0.84 : 0.94);
    const doorZ = gateZ + 0.55;
    for (const side of [-1, 1]) {
      const lx = p.x + side * (p.openW * 0.24);
      addBox(crimsonParts, leafW, leafH, 0.34, lx, leafH * 0.5, doorZ);
      // Horizontal gilded timber bands & brass ring knocker
      addBox(goldParts, leafW * 0.94, 0.14, 0.40, lx, leafH * 0.78, doorZ + 0.04);
      addBox(goldParts, leafW * 0.94, 0.14, 0.40, lx, leafH * 0.24, doorZ + 0.04);
      const ring = new THREE.TorusGeometry(0.11, 0.025, 6, 12);
      ring.translate(p.x + side * 0.26, leafH * 0.52, doorZ + 0.22);
      goldParts.push(ring);

      // Authentic rows of golden bronze door studs (*đinh cửa hoàng cung*)
      const rows = i === 0 ? 5 : 4;
      const cols = i === 0 ? 4 : 3;
      for (let r = 0; r < rows; r++) {
        const sy = leafH * (0.14 + (r / Math.max(1, rows - 1)) * 0.74);
        for (let c = 0; c < cols; c++) {
          const sx = lx - leafW * 0.36 + (c / Math.max(1, cols - 1)) * (leafW * 0.72);
          const stud = new THREE.SphereGeometry(0.055, 6, 5);
          stud.scale(1.0, 1.0, 0.65);
          stud.translate(sx, sy, doorZ + 0.19);
          goldParts.push(stud);
        }
      }
    }

    // Grounded foundation apron under every pier section
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
    const wingW = 11.0; // outer face sits at ±28.9m (57.8m total width)
    const wingLen = 18.0;
    const wingZ = gateZ + rampartDepth * 0.5 + wingLen * 0.5;
    const [wxF, wzF] = localToWorld(wingX, wingZ + 4.5);
    const [wxB, wzB] = localToWorld(wingX, wingZ - 4.5);
    const minGround = Math.min(ctx.getHeight(wxF, wzF), ctx.getHeight(wxB, wzB), yBase);
    const sink = Math.max(1.2, yBase - minGround + 1.5);

    addBox(stoneParts, wingW, rampartH + sink, wingLen, wingX, (rampartH - sink) * 0.5, wingZ);
    addBox(brickParts, wingW + 0.3, 0.78, wingLen + 0.3, wingX, rampartH + 0.39, wingZ);
    addBox(marbleParts, wingW + 0.6, 0.26, wingLen + 0.6, wingX, rampartH + 0.90, wingZ);

    // Crenellated outer bastion merlons along wing outer rim
    for (let m = 0; m < 7; m++) {
      const mz = wingZ - wingLen * 0.44 + m * (wingLen * 0.145);
      addBox(brickParts, 0.45, 0.65, 1.35, side * 28.75, rampartH + 1.32, mz);
    }
  }

  // Main bastion brick battlement & white marble cornice
  addBox(brickParts, 58.1, 0.78, rampartDepth + 0.35, 0, rampartH + 0.39, gateZ);
  addBox(marbleParts, 58.6, 0.28, rampartDepth + 0.7, 0, rampartH + 0.90, gateZ);

  // Readable "NGỌ MÔN — 午門" Royal Calligraphy Plaque above Chính Môn
  const ngoMonPlaque = createSignagePlaqueMesh(
    {
      text: 'NGỌ MÔN',
      subText: '午 門',
      style: 'royal',
      width: 4.5,
      height: 1.55,
      depth: 0.24,
      motifSeed: 1833
    },
    ctx
  );
  ngoMonPlaque.position.set(0, 4.55, gateZ + rampartDepth * 0.5 + 0.18);
  group.add(ngoMonPlaque);

  // Ceremonial white marble & stone forecourt paving between the 18m U-arms
  addBox(stoneParts, 36.4, 0.5, 24.0, 0, -0.15, 3.2);
  addBox(marbleParts, 14.5, 0.22, 22.0, 0, 0.14, 3.5);

  // 2. Lầu Ngũ Phụng (2-Story Five Phoenixes Pavilion) atop the 5.0m bastion (deckY = 6.04m)
  const deckY = rampartH + 1.04;

  // Rear Stone Dragon Staircases behind the U-wings allowing visitors to climb onto Lầu Ngũ Phụng deck
  const rearWallZ = gateZ - rampartDepth * 0.5; // -15.1
  const stairLen = 9.4;
  const stairW = 4.2;
  for (const side of [-1, 1]) {
    const sx = side * 21.8;
    const zBot = rearWallZ - stairLen;
    const zTop = rearWallZ;
    const numSteps = 14;
    for (let st = 0; st < numSteps; st++) {
      const frac = (st + 0.5) / numSteps;
      const stepH = deckY * ((st + 1) / numSteps);
      const sz = THREE.MathUtils.lerp(zBot, zTop, frac);
      addBox(stoneParts, stairW, stepH + 0.6, stairLen / numSteps + 0.12, sx, (stepH - 0.6) * 0.5, sz);
    }
    // Flanking carved stone dragon balustrades climbing from ground up to Lầu Ngũ Phụng deck
    for (const bxOff of [-stairW * 0.5 - 0.25, stairW * 0.5 + 0.25]) {
      marbleParts.push(
        ...createCarvedDragonBalustradeParts(sx + bxOff, 0.0, zBot - 0.3, sx + bxOff, deckY, zTop, 0.95)
      );
    }
  }

  // Pierced Huế *chữ Vạn* ceramic-and-crimson balustrades rimming the bastion forecourt edge
  jadeRoofParts.push(
    ...createPiercedBalustradeParts(-17.8, gateZ + rampartDepth * 0.5 - 0.25, 17.8, gateZ + rampartDepth * 0.5 - 0.25, deckY, 0.95, 'chu_van')
  );
  for (const side of [-1, 1]) {
    jadeRoofParts.push(
      ...createPiercedBalustradeParts(
        side * 18.0,
        gateZ + rampartDepth * 0.5,
        side * 18.0,
        gateZ + rampartDepth * 0.5 + 17.6,
        deckY,
        0.95,
        'chu_van'
      ),
      ...createPiercedBalustradeParts(
        side * 18.0,
        gateZ + rampartDepth * 0.5 + 17.6,
        side * 28.4,
        gateZ + rampartDepth * 0.5 + 17.6,
        deckY,
        0.95,
        'chu_van'
      )
    );
  }

  // Central 2-story royal hall (50+ crimson columns)
  addBox(marbleParts, 27.2, 0.42, 10.6, 0, deckY + 0.21, gateZ);
  const hallFloorY = deckY + 0.42;

  // Story 1 central hall walls & open-bay portals
  addBox(crimsonParts, 22.8, 4.1, 6.2, 0, hallFloorY + 2.05, gateZ);
  addBox(voidParts, 4.4, 3.2, 6.32, 0, hallFloorY + 1.6, gateZ);
  for (const dx of [-5.8, 5.8]) {
    addBox(voidParts, 2.6, 2.8, 6.32, dx, hallFloorY + 1.4, gateZ);
  }
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

  // Story 2 central royal hall (open colonnaded imperial throne pavilion)
  const upperFloorY = hallFloorY + 5.1;
  addBox(crimsonParts, 18.2, 0.24, 6.8, 0, upperFloorY + 0.12, gateZ);
  addBox(crimsonParts, 17.6, 3.25, 0.24, 0, upperFloorY + 1.72, gateZ - 2.8);
  addBox(crimsonParts, 18.0, 0.22, 6.6, 0, upperFloorY + 3.35, gateZ);

  // Pierced *chữ Vạn* balustrades along Story 2 front & side veranda (leaving center imperial dais view open)
  jadeRoofParts.push(
    ...createPiercedBalustradeParts(-8.6, gateZ + 3.2, -2.2, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van'),
    ...createPiercedBalustradeParts(2.2, gateZ + 3.2, 8.6, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van'),
    ...createPiercedBalustradeParts(-8.6, gateZ - 2.8, -8.6, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van'),
    ...createPiercedBalustradeParts(8.6, gateZ - 2.8, 8.6, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van')
  );

  // Imperial Dragon Throne Dais (*Ngai Vàng Lầu Ngũ Phụng*) + Twin Imperial Parasols (*Tàn lọng hoàng đế*)
  addBox(crimsonParts, 2.4, 0.35, 2.4, 0, upperFloorY + 0.22, gateZ);
  addBox(goldParts, 2.0, 0.15, 2.0, 0, upperFloorY + 0.46, gateZ);
  addBox(goldParts, 0.95, 0.75, 0.85, 0, upperFloorY + 0.92, gateZ - 0.2);
  addBox(crimsonParts, 0.88, 0.12, 0.80, 0, upperFloorY + 0.96, gateZ - 0.2);
  addBox(goldParts, 0.95, 0.95, 0.15, 0, upperFloorY + 1.44, gateZ - 0.55);
  for (const px of [-1.55, 1.55]) {
    addCyl(crimsonParts, 0.035, 0.035, 2.45, 6, px, upperFloorY + 1.32, gateZ - 0.35);
    addCone(goldParts, 0.72, 0.45, 12, px, upperFloorY + 2.56, gateZ - 0.35);
    addCyl(goldParts, 0.06, 0.08, 0.24, 8, px, upperFloorY + 2.88, gateZ - 0.35);
  }

  for (let ix = -3; ix <= 3; ix++) {
    if (ix === 0) continue;
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

  // CENTRAL ROYAL ROOF (2 tiers) in Imperial Yellow glazed tiles (#f0b928) + Dragon-Phoenix Finials
  const cRoof1 = createVietnameseCurvedRoofGeometry(29.8, 12.2, 19.8, 6.8, 2.2, 0.65);
  cRoof1.translate(0, hallFloorY + 4.1, gateZ);
  centralRoofParts.push(cRoof1);

  const cRoof2 = createVietnameseCurvedRoofGeometry(21.8, 9.8, 9.2, 1.4, 3.2, 0.82);
  cRoof2.translate(0, upperFloorY + 3.38, gateZ);
  centralRoofParts.push(cRoof2);

  addBox(goldParts, 9.4, 0.34, 0.42, 0, upperFloorY + 6.62, gateZ);
  const centralFinials = createRoofFinialSetParts(0, upperFloorY + 6.75, gateZ, 9.6, 0, 1.25, true);
  jadeRoofParts.push(...centralFinials.mainParts);
  goldParts.push(...centralFinials.goldParts);

  // 4 Flanking Wing Pavilions (2 inner wings + 2 forward U-wing pavilions)
  // FIX Bug B2: Replace solid closed upper boxes with open colonnaded pavilions + chu_van balustrades
  // so Đại Hồng Chung (Left inner wing) & Trống Sấm (Right inner wing) are 100% visible & unobstructed!
  const wingPavSpecs = [
    { x: -18.2, z: gateZ, w: 8.6, d: 8.2, role: 'bell' as const },
    { x: 18.2, z: gateZ, w: 8.6, d: 8.2, role: 'drum' as const },
    { x: -23.4, z: gateZ + 14.5, w: 8.2, d: 9.2, role: 'wing' as const },
    { x: 23.4, z: gateZ + 14.5, w: 8.2, d: 9.2, role: 'wing' as const }
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

    // Lower Jade/Cyan glazed roof wing
    const wRoof1 = createVietnameseCurvedRoofGeometry(wp.w + 2.2, wp.d + 2.2, wp.w * 0.62, wp.d * 0.62, 1.75, 0.54);
    wRoof1.translate(wp.x, hallFloorY + 3.58, wp.z);
    jadeRoofParts.push(wRoof1);

    // Open colonnaded upper wing pavilion (floor deck + 8 crimson columns + eave beams + chu_van balustrades)
    const wUpperY = hallFloorY + 4.45;
    const uW = wp.w * 0.68;
    const uD = wp.d * 0.66;
    const uColH = 3.35;
    addBox(crimsonParts, uW + 0.3, 0.24, uD + 0.3, wp.x, wUpperY + 0.12, wp.z);

    const hx = uW * 0.46;
    const hz = uD * 0.46;
    for (const ox of [-hx, 0, hx]) {
      for (const oz of [-hz, hz]) {
        addCyl(crimsonParts, 0.14, 0.17, uColH, 8, wp.x + ox, wUpperY + 0.24 + uColH * 0.5, wp.z + oz);
      }
    }
    for (const ox of [-hx, hx]) {
      addCyl(crimsonParts, 0.14, 0.17, uColH, 8, wp.x + ox, wUpperY + 0.24 + uColH * 0.5, wp.z);
    }
    // Upper tie beams supporting the curved jade roof
    addBox(crimsonParts, uW + 0.2, 0.24, 0.24, wp.x, wUpperY + 0.24 + uColH - 0.12, wp.z + hz);
    addBox(crimsonParts, uW + 0.2, 0.24, 0.24, wp.x, wUpperY + 0.24 + uColH - 0.12, wp.z - hz);
    addBox(crimsonParts, 0.24, 0.24, uD + 0.2, wp.x - hx, wUpperY + 0.24 + uColH - 0.12, wp.z);
    addBox(crimsonParts, 0.24, 0.24, uD + 0.2, wp.x + hx, wUpperY + 0.24 + uColH - 0.12, wp.z);

    // Pierced *chữ Vạn* balustrades around the open upper pavilion deck
    const balY = wUpperY + 0.24;
    jadeRoofParts.push(
      ...createPiercedBalustradeParts(wp.x - hx, wp.z + hz, wp.x + hx, wp.z + hz, balY, 0.82, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x - hx, wp.z - hz, wp.x + hx, wp.z - hz, balY, 0.82, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x - hx, wp.z - hz, wp.x - hx, wp.z + hz, balY, 0.82, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x + hx, wp.z - hz, wp.x + hx, wp.z + hz, balY, 0.82, 'chu_van')
    );

    if (wp.role === 'bell') {
      // Đại Hồng Chung (Imperial Bronze Bell) cleanly framed & completely visible inside Left Inner Wing
      addCyl(crimsonParts, 0.11, 0.13, 2.65, 8, wp.x - 1.15, balY + 1.32, wp.z);
      addCyl(crimsonParts, 0.11, 0.13, 2.65, 8, wp.x + 1.15, balY + 1.32, wp.z);
      addBox(crimsonParts, 2.65, 0.22, 0.26, wp.x, balY + 2.62, wp.z);
      bronzeParts.push(...createBronzeBellParts(wp.x, balY + 0.92, wp.z, 1.25));
    } else if (wp.role === 'drum') {
      // Trống Sấm (Imperial Great Drum) cleanly cradled & completely visible inside Right Inner Wing
      addCyl(crimsonParts, 0.11, 0.13, 1.55, 8, wp.x - 0.95, balY + 0.78, wp.z);
      addCyl(crimsonParts, 0.11, 0.13, 1.55, 8, wp.x + 0.95, balY + 0.78, wp.z);
      addBox(crimsonParts, 2.15, 0.18, 0.24, wp.x, balY + 0.82, wp.z);
      addCyl(woodParts, 0.82, 0.82, 1.48, 16, wp.x, balY + 1.58, wp.z, Math.PI * 0.5, 0);
      addCyl(marbleParts, 0.76, 0.76, 0.08, 16, wp.x, balY + 1.58, wp.z - 0.74, Math.PI * 0.5, 0);
      addCyl(marbleParts, 0.76, 0.76, 0.08, 16, wp.x, balY + 1.58, wp.z + 0.74, Math.PI * 0.5, 0);
      addCyl(goldParts, 0.84, 0.84, 0.12, 16, wp.x, balY + 1.58, wp.z - 0.68, Math.PI * 0.5, 0);
      addCyl(goldParts, 0.84, 0.84, 0.12, 16, wp.x, balY + 1.58, wp.z + 0.68, Math.PI * 0.5, 0);
    }

    // Upper Jade/Cyan glazed roof wing + Phoenix Corner Roof Finials
    const wRoof2Y = wUpperY + 0.24 + uColH;
    const wRoof2 = createVietnameseCurvedRoofGeometry(wp.w * 0.94, wp.d * 0.92, 2.2, 1.2, 2.35, 0.62);
    wRoof2.translate(wp.x, wRoof2Y, wp.z);
    jadeRoofParts.push(wRoof2);
    const wingFinials = createRoofFinialSetParts(wp.x, wRoof2Y + 2.35, wp.z, 2.8, 0, 0.72, true);
    jadeRoofParts.push(...wingFinials.mainParts);
    goldParts.push(...wingFinials.goldParts);
  }

  // 2.5. Ceremonial 9 Cửu Đỉnh Imperial Bronze Urns lined along courtyard flank
  for (let i = 0; i < 9; i++) {
    const ux = 14.8;
    const uz = -2.0 + i * 2.55;
    const urn = createImperialUrnParts(ux, 0.10, uz, 0.88);
    stoneParts.push(...urn.stoneParts);
    bronzeParts.push(...urn.bronzeParts);
  }

  // 2.6. 8 Nguyễn Dynasty Bronze Cannons (*Thần Công*) on stepped timber carriages
  const cannonPlacements: Array<[number, number, number]> = [
    [-14.8, 3.0, 0],
    [-14.8, 7.2, 0],
    [-14.8, 11.4, 0],
    [-14.8, 15.6, 0],
    [-19.0, 31.5, 0],
    [-23.5, 31.5, 0],
    [-32.5, 31.5, 0],
    [-37.0, 31.5, 0]
  ];
  for (const [canX, canZ, canRot] of cannonPlacements) {
    const [cwx, cwz] = localToWorld(canX, canZ);
    const cy = Math.max(0.08, ctx.getHeight(cwx, cwz) - yBase + 0.06);
    // Stepped wooden carriage cheeks & cross-transoms
    for (const sx of [-0.42, 0.42]) {
      addBox(crimsonParts, 0.16, 0.65, 2.35, canX + sx, cy + 0.56, canZ, canRot);
      // 2 wooden wheels per side
      for (const wz of [-0.68, 0.68]) {
        addCyl(woodParts, 0.34, 0.34, 0.14, 12, canX + sx * 1.32, cy + 0.34, canZ + wz, 0, 0, Math.PI * 0.5);
      }
    }
    addBox(woodParts, 0.86, 0.18, 1.85, canX, cy + 0.45, canZ, canRot);
    // Tapered bronze cannon barrel pointing East (+Z local) with breech knob & reinforcing rings
    addCyl(bronzeParts, 0.15, 0.24, 3.15, 12, canX, cy + 0.96, canZ + 0.28, Math.PI * 0.5 - 0.08, canRot);
    addCyl(bronzeParts, 0.11, 0.11, 1.15, 8, canX, cy + 0.94, canZ + 0.10, 0, 0, Math.PI * 0.5); // trunnions
    const cascabel = new THREE.SphereGeometry(0.14, 8, 6);
    cascabel.translate(canX, cy + 0.84, canZ - 1.35);
    bronzeParts.push(cascabel);
  }

  // 3. Cầu Trung Đạo 3-Arch Stone Moat Bridge spanning x = -148..-122, z = 42 (local z = 37..63, width = 10m)
  const bridgeZStart = 37.0; // world x = -148
  const bridgeZEnd = 63.0;   // world x = -122
  const bridgeLen = bridgeZEnd - bridgeZStart; // 26m
  const bridgeMidZ = (bridgeZStart + bridgeZEnd) * 0.5; // 50.0
  const bridgeWidth = 10.0;

  // Stone-lined Thái Dịch / Kim Thủy moat basin under Cầu Trung Đạo
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

  // Notched lotus pads & pink blooms floating on the Thái Dịch moat on both flanks of Cầu Trung Đạo
  const moatRand = mulberry32(180205);
  for (let i = 0; i < 64; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const lx = side * (6.2 + moatRand() * 14.2);
    const lz = bridgeZStart + 1.8 + moatRand() * (bridgeLen - 3.6);
    const padR = 0.36 + moatRand() * 0.28;
    const pad = createNotchedLotusPadGeometry(padR, 12);
    pad.rotateY(moatRand() * Math.PI * 2);
    pad.translate(lx, 0.11, lz);
    lotusLeafParts.push(pad);

    if (i % 3 === 0) {
      // Multi-petal pink lotus blossom rising gently above pad
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2 + moatRand() * 0.4;
        const pet = new THREE.ConeGeometry(0.11, 0.26, 5);
        pet.rotateX(0.45);
        pet.rotateY(pa);
        pet.translate(lx + Math.sin(pa) * 0.08, 0.28, lz + Math.cos(pa) * 0.08);
        lotusBloomParts.push(pet);
      }
      const bud = new THREE.SphereGeometry(0.085, 6, 5);
      bud.translate(lx, 0.30, lz);
      goldParts.push(bud);
    }
  }

  // 4 bridge piers / abutments grounded down to -2.2m supporting 3 semicircular stone arches
  const numArches = 3;
  const archSpan = bridgeLen / numArches;
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

  // 3 arched masonry deck & spandrel arches + carved marble balustrades across z = 37..63 (10m wide)
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

    addBox(stoneParts, bridgeWidth, 0.48, segLen, 0, crownY, bz, 0, -slopeAng, 0);

    const archIdx = Math.min(2, Math.floor(tm * 3.0));
    const localU = (tm * 3.0 - archIdx) * 2.0 - 1.0;
    const archCurveY = 0.65 + 1.35 * Math.sqrt(Math.max(0, 1.0 - localU * localU * 0.85));
    const spandrelH = Math.max(0.25, crownY - archCurveY);
    addBox(stoneParts, bridgeWidth - 0.4, spandrelH, segLen, 0, archCurveY + spandrelH * 0.5, bz);

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

  // 4 Monumental Ceremonial Tứ Trụ Nghi Môn Pillars flanking Cầu Trung Đạo approaches topped with sculpted *Nghê* finials
  for (const bEnd of [bridgeZStart, bridgeZEnd]) {
    const faceRot = bEnd === bridgeZStart ? Math.PI : 0;
    for (const sx of [-bridgeWidth * 0.48, -bridgeWidth * 0.16, bridgeWidth * 0.16, bridgeWidth * 0.48]) {
      const isInner = Math.abs(sx) < bridgeWidth * 0.3;
      const pilH = isInner ? 6.4 : 4.9;
      addCyl(stoneParts, 0.34, 0.40, 0.68, 8, sx, 0.46, bEnd);
      addCyl(crimsonParts, 0.20, 0.24, pilH, 10, sx, 0.80 + pilH * 0.5, bEnd);
      // Huế enamel decorative collars
      addCyl(jadeRoofParts, 0.26, 0.26, 0.28, 10, sx, 0.80 + pilH - 0.35, bEnd);
      addBox(marbleParts, 0.64, 0.22, 0.64, sx, 0.80 + pilH + 0.11, bEnd);
      goldParts.push(
        ...createGuardianBeastParts(sx, 0.80 + pilH + 0.22, bEnd, faceRot, isInner ? 0.66 : 0.52, 'nghe')
      );
    }
  }

  // 4. UPGRADED 42m Kỳ Đài (Imperial Flag Tower) prominently positioned forward in plaza at local (-28, +48)
  const flagX = -28.0;
  const flagZ = 48.0;
  const [fwx, fwz] = localToWorld(flagX, flagZ);
  const fSink = Math.max(1.8, yBase - ctx.getHeight(fwx, fwz) + 2.2);

  // 3-tier brick citadel rampart totaling 16.5m height (6.2m + 5.4m + 4.9m = 16.5m)
  addBox(stoneParts, 18.2, 6.2 + fSink, 18.2, flagX, (6.2 - fSink) * 0.5, flagZ);
  addBox(brickParts, 17.8, 5.8, 17.8, flagX, 3.1, flagZ);
  addBox(marbleParts, 18.6, 0.32, 18.6, flagX, 6.2, flagZ);

  addBox(brickParts, 13.4, 5.4, 13.4, flagX, 6.2 + 2.7, flagZ);
  addBox(marbleParts, 14.0, 0.30, 14.0, flagX, 11.6, flagZ);

  addBox(brickParts, 9.2, 4.9, 9.2, flagX, 11.6 + 2.45, flagZ);
  addBox(marbleParts, 9.8, 0.32, 9.8, flagX, 16.5, flagZ);

  // Crenellated merlons on Tier 1 & Tier 2 and chu_van balustrade on Tier 3
  for (const [tierW, tierY] of [
    [18.0, 6.36],
    [13.6, 11.75]
  ]) {
    const hw = tierW * 0.5 - 0.25;
    for (let m = -3; m <= 3; m++) {
      const off = m * (tierW / 7.5);
      addBox(brickParts, 1.1, 0.65, 0.42, flagX + off, tierY + 0.32, flagZ + hw);
      addBox(brickParts, 1.1, 0.65, 0.42, flagX + off, tierY + 0.32, flagZ - hw);
      addBox(brickParts, 0.42, 0.65, 1.1, flagX + hw, tierY + 0.32, flagZ + off);
      addBox(brickParts, 0.42, 0.65, 1.1, flagX - hw, tierY + 0.32, flagZ + off);
    }
  }
  const kHw = 4.6;
  jadeRoofParts.push(
    ...createPiercedBalustradeParts(flagX - kHw, flagZ - kHw, flagX + kHw, flagZ - kHw, 16.66, 0.92, 'chu_van'),
    ...createPiercedBalustradeParts(flagX - kHw, flagZ + kHw, flagX + kHw, flagZ + kHw, 16.66, 0.92, 'chu_van'),
    ...createPiercedBalustradeParts(flagX - kHw, flagZ - kHw, flagX - kHw, flagZ + kHw, 16.66, 0.92, 'chu_van'),
    ...createPiercedBalustradeParts(flagX + kHw, flagZ - kHw, flagX + kHw, flagZ + kHw, 16.66, 0.92, 'chu_van')
  );

  // 25.5m Flagstaff Mast rising from y = 16.5m to 42.0m total height (with observation ring & cross-yardarm)
  addCyl(marbleParts, 0.44, 0.58, 12.5, 12, flagX, 16.5 + 6.25, flagZ);
  addCyl(crimsonParts, 0.24, 0.42, 13.0, 12, flagX, 29.0 + 6.5, flagZ);
  addCyl(goldParts, 0.95, 0.95, 0.22, 12, flagX, 29.0, flagZ); // mid-mast observation deck ring
  addBox(goldParts, 4.6, 0.16, 0.16, flagX, 34.8, flagZ);      // ceremonial cross-yardarm
  const mastFinial = new THREE.SphereGeometry(0.45, 10, 8);
  mastFinial.translate(flagX, 42.15, flagZ);
  goldParts.push(mastFinial);

  // Larger waving crimson silk national banner (9.6m x 5.8m) flying near the 42m peak
  const flagW = 9.6;
  const flagH = 5.8;
  const flagGeo = new THREE.PlaneGeometry(flagW, flagH, 30, 16);
  flagGeo.translate(flagW * 0.5 + 0.18, 0, 0);
  flagGeo.rotateY(-Math.PI * 0.5);
  flagGeo.translate(flagX, 38.6, flagZ);

  const crimsonClothMat = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 1.25, color: '#c81d18', showStar: true }).material
    : (() => {
        const res = createWavingSilkFlagMaterial({
          waveScale: 1.25,
          color: '#c81d18',
          showStar: true
        });
        ctx.extraMaterials.push(res.material);
        animatedUniforms.push(res.uniforms);
        return res.material;
      })();

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

  const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze);
  bronzeMesh.castShadow = true;

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
  if (lotusLeafParts.length > 0) {
    const lotusLeafMat = new THREE.MeshStandardMaterial({
      color: '#2b7a3d',
      roughness: 0.62,
      side: THREE.DoubleSide
    });
    ctx.extraMaterials.push(lotusLeafMat);
    const lotusLeafMesh = new THREE.Mesh(mergeNormalized(lotusLeafParts), lotusLeafMat);
    group.add(lotusLeafMesh);
  }
  if (lotusBloomParts.length > 0) {
    const lotusBloomMat = new THREE.MeshStandardMaterial({
      color: '#f472a4',
      emissive: '#5a1632',
      emissiveIntensity: 0.22,
      roughness: 0.45
    });
    ctx.extraMaterials.push(lotusBloomMat);
    const lotusBloomMesh = new THREE.Mesh(mergeNormalized(lotusBloomParts), lotusBloomMat);
    group.add(lotusBloomMesh);
  }

  group.add(
    stoneMesh,
    marbleMesh,
    brickMesh,
    crimsonMesh,
    centralRoofMesh,
    jadeRoofMesh,
    goldMesh,
    bronzeMesh,
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
 * 2. Phố cổ Hội An (175, 45): True T-shaped Chùa Cầu (~18m long x 4.6m wide, North Bắc Đế Trấn Võ
 *    shrine pavilion leaving walkway open end-to-end, arch-curved roof with zero air gap — Fixes Bug B8,
 *    sculpted Dog & Monkey guardians, LAI VIỄN KIỀU plaques, con_tien window grilles) +
 *    16 Row-Attached Heritage Tube Houses (5.2m frontage, stepped firewalls, Mắt cửa Hội An,
 *    calligraphy signboards, open ground-floor lantern/tailor/tea interiors, multi-cluster bougainvillea,
 *    stone quay stairs) + Hanging Silk Lantern Arcs + Floating Hoa Đăng + 4 Animated Sampan Boats.
 */
function buildHoiAnAncientTown(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HoiAnAncientTownComplex';

  const cx = 175;
  const cz = 45;
  const bankY = ctx.getHeight(160, 45); // ~1.35m on both canal banks
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 52.0 });

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

  // Stone quay retaining walls lining both sides of Hoài Canal (x = 166.2 & x = 183.8, z = 4..86)
  for (const qx of [166.2, 183.8]) {
    addBox(stoneParts, 1.4, 3.1, 82.0, qx, 0.05, cz);
    addBox(stoneParts, 2.2, 0.3, 82.0, qx, bankY + 0.15, cz);
  }
  // 4 Stone quay staircases descending cleanly down to Hoài Canal waterline
  for (const [qx, dir] of [
    [166.2, 1],
    [183.8, -1]
  ] as const) {
    for (const stZ of [25.5, 64.5]) {
      for (let st = 0; st < 5; st++) {
        const sy = bankY - st * 0.28;
        const sx = qx + dir * (0.95 + st * 0.44);
        addBox(stoneParts, 0.56, Math.max(0.45, sy + 1.4), 3.4, sx, (sy - 1.4) * 0.5, stZ);
      }
      for (const rz of [-1.75, 1.75]) {
        addBox(stoneParts, 2.2, 0.72, 0.24, qx + dir * 1.5, bankY * 0.55, stZ + rz);
      }
    }
  }

  // 1. Chùa Cầu (Japanese Covered Bridge — Lai Viễn Kiều): true T-shaped plan spanning x = 165.2..184.8 at z = 45
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

  // Sculpted Sacred Guardian Dog (West x = 164.2) & Monkey (East x = 185.8) statues on carved plinths
  for (const [endX, beastType, faceRot] of [
    [164.2, 'dog' as const, -Math.PI * 0.5],
    [185.8, 'monkey' as const, Math.PI * 0.5]
  ] as const) {
    for (const sz of [-1.95, 1.95]) {
      addBox(stoneParts, 0.88, 0.92, 0.88, endX, bankY + 0.46, bridgeZ + sz);
      woodParts.push(
        ...createGuardianBeastParts(endX, bankY + 0.92, bridgeZ + sz, faceRot, 0.86, beastType)
      );
    }
  }

  // Arched wooden bridge deck (4.6m wide), open end-to-end walkway, crimson gallery columns & wooden con_tien window grilles
  const bridgeSegs = 18;
  for (let i = 0; i < bridgeSegs; i++) {
    const t0 = i / bridgeSegs;
    const t1 = (i + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const bx0 = THREE.MathUtils.lerp(165.2, 184.8, t0);
    const bx1 = THREE.MathUtils.lerp(165.2, 184.8, t1);
    const bx = (bx0 + bx1) * 0.5;
    const archY = bankY + 0.22 + 1.65 * Math.sin(tm * Math.PI);
    const slope = Math.atan2(1.65 * Math.cos(tm * Math.PI) * (Math.PI / 19.6), 1.0);

    addBox(woodParts, 1.25, 0.34, 4.6, bx, archY, bridgeZ, 0, 0, slope);
    const isShrineOpening = Math.abs(bx - cx) < 2.2;
    for (const sz of [-2.15, 2.15]) {
      // Leave North wall open at bridge center so visitors look directly into the North Bắc Đế Trấn Võ shrine!
      if (sz < 0 && isShrineOpening) {
        if (i % 2 === 0) {
          addCyl(crimsonParts, 0.12, 0.14, 3.10, 8, bx, archY + 1.70, bridgeZ + sz);
        }
        continue;
      }
      // Lower wooden gallery bench & dado panel
      addBox(crimsonParts, 1.18, 0.92, 0.20, bx, archY + 0.62, bridgeZ + sz, 0, 0, slope);
      // Wooden *con tiện* window grille slats spanning upper gallery window bay
      woodParts.push(
        ...createPiercedBalustradeParts(bx0 + 0.06, bridgeZ + sz, bx1 - 0.06, bridgeZ + sz, archY + 1.08, 1.12, 'con_tien')
      );
      if (i % 2 === 0 || i === bridgeSegs - 1) {
        addCyl(crimsonParts, 0.12, 0.14, 3.10, 8, bx, archY + 1.70, bridgeZ + sz);
      }
    }
    // Red lacquered gallery cross-rafters sitting cleanly at archY + 3.18
    if (i % 2 === 0 || i === bridgeSegs - 1) {
      addBox(crimsonParts, 0.24, 0.24, 4.75, bx, archY + 3.18, bridgeZ);
    }
  }

  // FIX Bug B8: North-protruding Bắc Đế Trấn Võ Shrine Pavilion (true T-shaped plan, z = 40.65, walkway stays 100% open!)
  const shrineZ = bridgeZ - 4.35; // 40.65 (North side of Chùa Cầu)
  const shrineDeckY = bankY + 0.22 + 1.65; // matches crown height of bridge
  const shrinePierH = shrineDeckY + 2.2;
  addBox(stoneParts, 5.4, shrinePierH, 4.6, cx, -2.2 + shrinePierH * 0.5, shrineZ);
  addBox(woodParts, 5.4, 0.34, 4.8, cx, shrineDeckY, shrineZ);
  // 3 enclosed crimson walls (North, West, East) opening South (+Z) directly onto the open bridge walkway
  addBox(crimsonParts, 5.2, 3.25, 0.28, cx, shrineDeckY + 1.65, shrineZ - 2.15);
  addBox(crimsonParts, 0.28, 3.25, 4.4, cx - 2.55, shrineDeckY + 1.65, shrineZ);
  addBox(crimsonParts, 0.28, 3.25, 4.4, cx + 2.55, shrineDeckY + 1.65, shrineZ);
  // Interior Bắc Đế Trấn Võ shrine altar, gilded tablet & warm candle lamps
  addBox(crimsonParts, 2.4, 1.05, 1.1, cx, shrineDeckY + 0.68, shrineZ - 1.2);
  addBox(goldParts, 1.35, 1.25, 0.24, cx, shrineDeckY + 1.82, shrineZ - 1.55);
  for (const ax of [-0.75, 0.75]) {
    const candle = new THREE.SphereGeometry(0.11, 6, 5);
    candle.translate(cx + ax, shrineDeckY + 1.34, shrineZ - 1.05);
    coreParts.push(candle);
  }
  const shrineLight = new THREE.PointLight('#ff9d42', 14.0, 14.0, 1.6);
  shrineLight.position.set(cx, shrineDeckY + 2.2, shrineZ - 0.5);
  group.add(shrineLight);

  // FIX Bug B8: Curved Chùa Cầu main yin-yang roof following exact arch curve (ZERO air gap above end columns!)
  const bridgeRoof = createVietnameseCurvedRoofGeometry(20.6, 5.9, 15.6, 1.2, 2.15, 0.36);
  const brPos = bridgeRoof.attributes.position;
  for (let i = 0; i < brPos.count; i++) {
    const vx = brPos.getX(i);
    const vy = brPos.getY(i);
    const t = clamp01((vx + 10.0) / 20.0);
    const archLift = 1.65 * Math.sin(t * Math.PI);
    brPos.setY(i, vy + archLift);
  }
  bridgeRoof.computeVertexNormals();
  bridgeRoof.translate(cx, bankY + 3.16, bridgeZ);
  darkRoofParts.push(bridgeRoof);

  // Double-tiered North shrine pavilion roof capping the T-wing at z = shrineZ
  const shrineGableBase = createVietnameseCurvedRoofGeometry(6.6, 6.4, 4.2, 4.0, 1.35, 0.34);
  shrineGableBase.translate(cx, shrineDeckY + 3.15, shrineZ);
  darkRoofParts.push(shrineGableBase);

  const shrineGableTop = createVietnameseCurvedRoofGeometry(4.8, 4.6, 1.1, 1.0, 1.65, 0.38);
  shrineGableTop.translate(cx, shrineDeckY + 4.35, shrineZ);
  darkRoofParts.push(shrineGableTop);
  const bridgeFinials = createRoofFinialSetParts(cx, shrineDeckY + 6.0, shrineZ, 2.4, 0, 0.58, false);
  crimsonParts.push(...bridgeFinials.mainParts);
  goldParts.push(...bridgeFinials.goldParts);

  // Readable "LAI VIỄN KIỀU — 來遠橋" Calligraphy Plaques mounted at BOTH ends of Chùa Cầu
  for (const [px, rotY] of [
    [165.05, -Math.PI * 0.5],
    [184.95, Math.PI * 0.5]
  ] as const) {
    const plaque = createSignagePlaqueMesh(
      {
        text: 'LAI VIỄN KIỀU',
        subText: '來 遠 橋',
        style: 'royal',
        width: 2.85,
        height: 0.92,
        depth: 0.16,
        motifSeed: 1719
      },
      ctx
    );
    plaque.position.set(px, bankY + 3.55, bridgeZ);
    plaque.rotation.y = rotY;
    group.add(plaque);
  }

  // 2. EXPANDED 16 Narrower Row-Attached Heritage Tube Houses (5.0–5.5m frontage, stepped firewalls)
  const tubeRowZs = [11.8, 17.0, 22.2, 27.4, 56.6, 61.8, 67.0, 72.2];
  const shopNames: Array<{ text: string; sub: string }> = [
    { text: 'TIỆM ĐÈN LỒNG', sub: 'HỘI AN XƯA' },
    { text: 'NHÀ MAY ÁO DÀI', sub: 'LỤA TƠ TẰM' },
    { text: 'TRÀ MÓT HỘI AN', sub: 'THẢO MỘC' },
    { text: 'GỐM THANH HÀ', sub: 'MỸ NGHỆ' },
    { text: 'CÀ PHÊ PHỐ CỔ', sub: 'SÔNG HOÀI' },
    { text: 'TRẦM HƯƠNG XỨ QUẢNG', sub: 'DI SẢN' }
  ];
  const houseSpecs: Array<{ x: number; z: number; facing: number; w: number; d: number; h: number }> = [];
  for (const [idx, zPos] of tubeRowZs.entries()) {
    const wVar = 5.18 + (idx % 2 === 0 ? 0.04 : -0.02);
    const hVarW = 7.4 + ((idx * 3) % 4) * 0.28;
    const hVarE = 7.3 + ((idx * 5 + 1) % 4) * 0.28;
    houseSpecs.push({ x: 156.8, z: zPos, facing: 1, w: wVar, d: 8.6, h: hVarW });
    houseSpecs.push({ x: 193.2, z: zPos, facing: -1, w: wVar, d: 8.6, h: hVarE });
  }

  for (const [hsIdx, hs] of houseSpecs.entries()) {
    const gy = ctx.getHeight(hs.x, hs.z);
    const plinthBottom = Math.min(gy, bankY) - 1.2;
    const plinthTop = gy + 0.35;
    const plinthH = plinthTop - plinthBottom;

    // Grounded stone plinth
    addBox(stoneParts, hs.d + 0.5, plinthH, hs.w + 0.08, hs.x, plinthBottom + plinthH * 0.5, hs.z);

    const frontX = hs.x + hs.facing * (hs.d * 0.5);
    const hasOpenShop = hsIdx % 3 === 0; // 6 featured open ground-floor lantern/tailor/tea interiors

    if (hasOpenShop) {
      // Recessed warm ground-floor interior shop alcove (open front bay!) + upper ochre story
      addBox(ochreParts, hs.d, hs.h - 3.35, hs.w, hs.x, plinthTop + 3.35 + (hs.h - 3.35) * 0.5, hs.z);
      // Rear & side ground-floor walls leaving front 2.8m deep interior open to street
      addBox(ochreParts, hs.d - 2.6, 3.35, hs.w, hs.x - hs.facing * 1.3, plinthTop + 1.68, hs.z);
      for (const sz of [-hs.w * 0.47, hs.w * 0.47]) {
        addBox(ochreParts, 2.7, 3.35, 0.26, frontX - hs.facing * 1.35, plinthTop + 1.68, hs.z + sz);
      }
      // Interior wooden counter/table & hanging colorful silk lantern display inside shop
      const shopX = frontX - hs.facing * 1.25;
      addBox(woodParts, 0.9, 0.86, hs.w * 0.58, shopX, plinthTop + 0.43, hs.z);
      for (let k = -2; k <= 2; k++) {
        const iz = hs.z + k * 0.78;
        const ix = shopX + hs.facing * (0.45 + (Math.abs(k) % 2) * 0.35);
        const iy = plinthTop + 2.45 - (Math.abs(k) % 2) * 0.28;
        const iHex = lanternPalette[(hsIdx + k + 6) % lanternPalette.length];
        const iShell = createRibbedLanternShellGeometry(0.18, 0.46, 10, 7);
        iShell.translate(ix, iy, iz);
        lanternParts.push(colorizeForMerge(iShell, iHex));
        const iCore = createLanternCoreGeometry(0.18, 0.46);
        iCore.translate(ix, iy, iz);
        coreParts.push(iCore);
      }
      // Side tea stools or fabric bolts on shop counter
      for (const stoolZ of [-1.2, 1.2]) {
        addCyl(woodParts, 0.22, 0.24, 0.48, 8, frontX + hs.facing * 0.65, plinthTop + 0.24, hs.z + stoolZ);
      }
    } else {
      // Classic yellow-ochre plaster tube house with accordion wooden shopfront doors (*cửa bàn khoa*)
      addBox(ochreParts, hs.d, hs.h, hs.w, hs.x, plinthTop + hs.h * 0.5, hs.z);
      addBox(voidParts, 0.16, 3.15, hs.w * 0.74, frontX + hs.facing * 0.04, plinthTop + 1.60, hs.z);
      for (let fold = -2; fold <= 2; fold++) {
        if (fold === 0) continue;
        addBox(
          woodParts,
          0.20,
          3.05,
          hs.w * 0.145,
          frontX + hs.facing * 0.13,
          plinthTop + 1.56,
          hs.z + fold * (hs.w * 0.165)
        );
      }
    }

    // Authentic Hội An Door Eyes (*Mắt cửa Hội An*) mounted in pairs above ground doorway
    const eyes = createHoiAnDoorEyesParts(
      frontX + hs.facing * 0.08,
      plinthTop + 3.08,
      hs.z,
      hs.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
      1.18,
      0.15
    );
    woodParts.push(...eyes.woodParts);
    goldParts.push(...eyes.goldParts);

    // Cantilevered upper wooden balcony with turned *con tiện* balustrade & veranda posts
    const balcX = frontX + hs.facing * 1.32;
    addBox(woodParts, 1.45, 0.22, hs.w + 0.06, frontX + hs.facing * 0.72, plinthTop + 3.82, hs.z);
    woodParts.push(
      ...createPiercedBalustradeParts(balcX, hs.z - hs.w * 0.48, balcX, hs.z + hs.w * 0.48, plinthTop + 3.93, 0.90, 'con_tien')
    );
    for (const pz of [-hs.w * 0.45, hs.w * 0.45]) {
      addCyl(woodParts, 0.11, 0.13, 3.82, 8, frontX + hs.facing * 1.28, plinthTop + 1.91, hs.z + pz);
    }

    // Upper shuttered wooden balcony doors
    for (const wz of [-hs.w * 0.22, hs.w * 0.22]) {
      addBox(voidParts, 0.16, 1.98, 0.92, frontX + hs.facing * 0.04, plinthTop + 5.25, hs.z + wz);
      addBox(woodParts, 0.20, 2.02, 0.28, frontX + hs.facing * 0.13, plinthTop + 5.25, hs.z + wz - 0.54);
      addBox(woodParts, 0.20, 2.02, 0.28, frontX + hs.facing * 0.13, plinthTop + 5.25, hs.z + wz + 0.54);
    }

    // Pitched terracotta roof + stepped masonry side party firewalls (*tường hồi giật bậc*)
    const houseRoof = createVietnameseCurvedRoofGeometry(
      hs.d + 2.6,
      hs.w + 0.16,
      0.9,
      hs.w * 0.94,
      2.45,
      0.20
    );
    houseRoof.translate(hs.x + hs.facing * 0.42, plinthTop + hs.h - 0.1, hs.z);
    tileParts.push(houseRoof);

    // Stepped side firewalls rising slightly above roof slope separating row-attached tube houses
    for (const sideZ of [-hs.w * 0.5, hs.w * 0.5]) {
      addBox(ochreParts, hs.d + 0.35, 0.95, 0.24, hs.x + hs.facing * 0.1, plinthTop + hs.h + 0.45, hs.z + sideZ);
      addBox(ochreParts, hs.d * 0.62, 0.95, 0.24, hs.x + hs.facing * 0.22, plinthTop + hs.h + 1.35, hs.z + sideZ);
      addBox(stoneParts, hs.d * 0.34, 0.72, 0.28, hs.x + hs.facing * 0.35, plinthTop + hs.h + 2.15, hs.z + sideZ);
    }
    const ridgeY = plinthTop + hs.h + 2.38;
    addBox(stoneParts, 0.36, 0.32, hs.w + 0.18, hs.x + hs.facing * 0.42, ridgeY, hs.z);

    // Calligraphy shop signboards (6 readable Canvas calligraphy signboards + carved antique boards on remaining)
    const signX = frontX + hs.facing * 0.32;
    const signY = plinthTop + 3.45;
    if (hsIdx % 3 === 0) {
      const sInfo = shopNames[(hsIdx / 3) % shopNames.length];
      const shopSign = createSignagePlaqueMesh(
        {
          text: sInfo.text,
          subText: sInfo.sub,
          style: 'royal',
          bgColor: hsIdx % 2 === 0 ? '#241814' : '#6c1614',
          width: 2.35,
          height: 0.72,
          depth: 0.14,
          motifSeed: 400 + hsIdx
        },
        ctx
      );
      shopSign.position.set(signX + hs.facing * 0.08, signY, hs.z);
      shopSign.rotation.y = hs.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      group.add(shopSign);
    } else {
      addBox(woodParts, 0.14, 0.68, 2.25, signX, signY, hs.z);
      addBox(goldParts, 0.18, 0.54, 2.08, signX + hs.facing * 0.03, signY, hs.z);
      addBox(crimsonParts, 0.20, 0.40, 1.88, signX + hs.facing * 0.05, signY, hs.z);
    }

    // Flanking entrance ribbed silk lanterns
    for (const ltz of [-hs.w * 0.36, hs.w * 0.36]) {
      const lantX = frontX + hs.facing * 1.26;
      const lantY = plinthTop + 3.42;
      const lantZ = hs.z + ltz;
      addCyl(woodParts, 0.02, 0.02, 0.40, 4, lantX, lantY + 0.38, lantZ);
      const lHex = lanternPalette[(hsIdx * 2 + (ltz > 0 ? 1 : 0)) % lanternPalette.length];
      const sShell = createRibbedLanternShellGeometry(0.22, 0.58, 12, 8);
      sShell.translate(lantX, lantY, lantZ);
      lanternParts.push(colorizeForMerge(sShell, lHex));
      const sCore = createLanternCoreGeometry(0.22, 0.58);
      sCore.translate(lantX, lantY, lantZ);
      coreParts.push(sCore);
    }

    // Richer multi-cluster cascading Bougainvillea canopies (on alternating heritage facades)
    if (hsIdx % 2 === 0) {
      const vineRand = mulberry32(77000 + hsIdx * 191);
      const flowerHexes = ['#d81e74', '#f04299', '#e02885', '#ff66a8', '#ff3388', '#f25c2a'];
      const leafHexes = ['#235422', '#2f682c', '#1b451a', '#3a7536'];
      // Climbing vine trunk along corner post
      addCyl(woodParts, 0.045, 0.065, 4.4, 5, frontX + hs.facing * 1.32, plinthTop + 2.2, hs.z - hs.w * 0.44);
      // 3 cascading floral clusters draping across balcony & eave
      for (let c = 0; c < 3; c++) {
        const cz0 = hs.z - hs.w * 0.38 + c * (hs.w * 0.38);
        const cy0 = plinthTop + 4.45 + (c === 1 ? 0.35 : 0.0);
        for (let f = 0; f < 10; f++) {
          const fz = cz0 + (vineRand() - 0.5) * 1.55;
          const fx = frontX + hs.facing * (1.28 + (vineRand() - 0.35) * 0.65);
          const fy = cy0 - vineRand() * 1.45;
          const rad = 0.14 + vineRand() * 0.16;
          const isFlower = vineRand() > 0.34;
          const tuft = new THREE.IcosahedronGeometry(rad, 0);
          tuft.scale(1.15, 0.85, 1.15);
          tuft.translate(fx, fy, fz);
          const hex = isFlower
            ? flowerHexes[Math.floor(vineRand() * flowerHexes.length)]
            : leafHexes[Math.floor(vineRand() * leafHexes.length)];
          bougainvilleaParts.push(colorizeForMerge(tuft, hex));
        }
      }
    }
  }

  // 3. Hanging Arcs of Multi-Color Ribbed Silk Lanterns across Hoài Canal + Floating Hoa Đăng
  const stringZs = [16.0, 23.5, 31.5, 57.5, 65.0, 72.5];
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

      const poolY = p.x > 166.8 && p.x < 183.2 ? 0.05 : bankY + 0.06;
      const pool = new THREE.CircleGeometry(2.6, 16);
      pool.rotateX(-Math.PI * 0.5);
      pool.translate(p.x, poolY, p.z);
      lightPoolParts.push(colorizeForMerge(pool, hex));
    }
  });

  // Glowing Hoa Đăng paper lotus lanterns floating on Hoài Canal (y = 0.05)
  const rand = mulberry32(202607);
  for (let i = 0; i < 48; i++) {
    const fx = 168.0 + rand() * 14.0;
    const fz = 10.0 + rand() * 70.0;
    if (Math.abs(fz - bridgeZ) < 6.5) continue;
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

  // 4. 4 Animated Wooden Hoa Đăng Sampan Boats with Bow Lanterns gliding gently on Hoài Canal (ctx.junkBoats)
  const sampanConfigs = [
    { x: 171.6, z: 20.5, yaw: Math.PI * 0.5 + 0.06, speed: 0.24, phase: 0.2 },
    { x: 178.4, z: 31.0, yaw: -Math.PI * 0.5 - 0.05, speed: 0.28, phase: 1.7 },
    { x: 171.8, z: 59.5, yaw: Math.PI * 0.5 - 0.04, speed: 0.26, phase: 3.1 },
    { x: 178.2, z: 70.0, yaw: -Math.PI * 0.5 + 0.07, speed: 0.22, phase: 4.5 }
  ];
  const sampanHullParts: THREE.BufferGeometry[] = [];
  // Build shared double-ended hollow curved wooden sampan hull geometry (aligned along X)
  addBox(sampanHullParts, 3.8, 0.12, 1.15, 0, 0.06, 0); // flat planked bottom
  for (const sz of [-0.58, 0.58]) {
    addBox(sampanHullParts, 4.1, 0.42, 0.09, 0, 0.28, sz, 0, sz > 0 ? -0.18 : 0.18, 0);
  }
  for (const sx of [-2.25, 2.25]) {
    const dir = Math.sign(sx);
    addCone(sampanHullParts, 0.58, 1.15, 4, sx, 0.34, 0, 0, Math.PI * 0.25, -dir * Math.PI * 0.42);
  }
  for (const bx of [-0.95, 0.15, 1.15]) {
    addBox(sampanHullParts, 0.32, 0.07, 1.08, bx, 0.34, 0); // wooden passenger benches
  }
  // Bamboo oar & curved bow lantern pole
  addCyl(sampanHullParts, 0.025, 0.03, 2.35, 6, -1.25, 0.52, 0.55, 0.35, 0.25, 0.45);
  addCyl(sampanHullParts, 0.025, 0.032, 1.35, 6, 2.45, 0.92, 0, 0, 0, -0.22);
  const sharedSampanGeo = mergeNormalized(sampanHullParts);

  const bowLanternShell = createRibbedLanternShellGeometry(0.18, 0.46, 10, 7);
  bowLanternShell.translate(2.72, 1.24, 0);
  const bowLanternCore = createLanternCoreGeometry(0.18, 0.46);
  bowLanternCore.translate(2.72, 1.24, 0);

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

  sampanConfigs.forEach((sc, idx) => {
    const boatGrp = new THREE.Group();
    boatGrp.name = `HoiAnSampanBoat_${idx + 1}`;
    const hullMesh = new THREE.Mesh(sharedSampanGeo.clone(), ctx.materials.darkWood);
    hullMesh.castShadow = true;
    const bShell = new THREE.Mesh(
      colorizeForMerge(bowLanternShell.clone(), lanternPalette[idx % lanternPalette.length]),
      silkLanternMat
    );
    const bCore = new THREE.Mesh(
      bowLanternCore.clone(),
      ctx.materials.lanternCore ?? silkLanternMat
    );
    boatGrp.add(hullMesh, bShell, bCore);
    boatGrp.position.set(sc.x, 0.04, sc.z);
    boatGrp.rotation.y = sc.yaw;
    group.add(boatGrp);
    ctx.junkBoats.push({
      group: boatGrp,
      centerX: sc.x,
      centerZ: sc.z,
      radiusX: 0.7,
      radiusZ: 2.3,
      speed: sc.speed,
      phase: sc.phase
    });
  });
  sharedSampanGeo.dispose();
  bowLanternShell.dispose();
  bowLanternCore.dispose();

  const lightPoolMat = ctx.sharedShaders
    ? ctx.sharedShaders.warmLightPool.material
    : (() => {
        const res = createWarmLightPoolMaterial();
        ctx.extraMaterials.push(res.material);
        animatedUniforms.push(res.uniforms);
        return res.material;
      })();

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

  for (const lz of [25.5, 64.5]) {
    const hoiAnLight = new THREE.PointLight('#ff9c44', 28.0, 42.0, 1.5);
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

  // 4 parallel secondary golden tubular space-frame arch chords & ring collars along the 5 arches
  const archPts = spinePts.slice(10, steps - 10);
  const archRadii = archPts.map(() => 0.24);
  for (const [oy, oz] of [
    [0.88, 0.78],
    [0.88, -0.78],
    [-0.88, 0.78],
    [-0.88, -0.78]
  ]) {
    const chordPts = archPts.map((pt) => new THREE.Vector3(pt.x, pt.y + oy, pt.z + oz));
    goldParts.push(createVariableTubeGeometry(chordPts, archRadii, 8));
  }
  for (let i = 14; i < steps - 14; i += 8) {
    const p = spinePts[i];
    const collar = new THREE.TorusGeometry(1.38, 0.085, 6, 12);
    collar.rotateY(Math.PI * 0.5);
    collar.translate(p.x, p.y, p.z);
    goldParts.push(collar);
  }

  // Stylized Lotus-Blossom Tail radiating at West tail tip (245.5, 18.6, cz)
  for (let lt = 0; lt < 12; lt++) {
    const la = (lt / 12) * Math.PI * 2;
    const petal = new THREE.ConeGeometry(0.32, 1.85, 5);
    petal.rotateX(la);
    petal.rotateZ(0.55);
    petal.translate(245.5 - Math.cos(la) * 0.25, 18.6 + Math.sin(la) * 1.15, cz + Math.cos(la) * 1.15);
    goldParts.push(petal);
  }

  // Diagonal truss struts & vertical hangers tracking exact undulating z(t) (Fixes Bug B9)
  for (let i = 4; i < steps - 3; i++) {
    const p = spinePts[i];
    const next = spinePts[i + 1];
    const slope = Math.atan2(next.y - p.y, next.x - p.x);

    // Dorsal golden crest spikes along spine
    if (i % 2 === 0) {
      addCone(goldParts, 0.34, 1.45, 4, p.x, p.y + spineRadii[i] + 0.55, p.z, 0, 0, slope - Math.PI * 0.1);
    }

    // Truss-supported steel hangers & V-struts down from undulating p.z to deck median
    if (i % 3 === 0 && p.y > 9.8) {
      const deckY = getDeckY(p.x) + 0.35;
      const cableH = p.y - deckY;
      for (const zOff of [-0.65, 0.65]) {
        addCyl(steelParts, 0.08, 0.09, cableH, 6, p.x, deckY + cableH * 0.5, p.z + zOff);
      }
      if (i % 6 === 0 && i + 3 < steps) {
        const p2 = spinePts[i + 3];
        const midX = (p.x + p2.x) * 0.5;
        const midY = (p.y + deckY) * 0.5;
        const midZ = (p.z + p2.z) * 0.5;
        const diagLen = Math.hypot(p2.x - p.x, p.y - deckY);
        const diagAng = Math.atan2(deckY - p.y, p2.x - p.x);
        addCyl(goldParts, 0.09, 0.09, diagLen, 6, midX, midY, midZ, 0, 0, diagAng - Math.PI * 0.5);
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

  // Swept horns (rising to ~25m), crown flame crest, whiskers & sculpted Heart-Shaped LED Eyes
  for (const sz of [-1.25, 1.25]) {
    addCone(goldParts, 0.44, 5.2, 8, hx - 0.6, hy + 3.4, hz + sz, sz * 0.22, 0, 0.55);
    addCyl(goldParts, 0.12, 0.22, 4.6, 6, hx + 5.4, hy + 0.2, hz + sz * 1.15, sz * 0.42, 0, -0.42);
    const heartEye = createHeartGeometry(0.55, 0.22);
    heartEye.translate(hx + 2.2, hy + 1.15, hz + sz * 1.46);
    eyeParts.push(heartEye);
  }
  addCone(goldParts, 0.72, 4.4, 6, hx + 0.6, hy + 3.6, hz, 0, 0, 0.38);

  // 5. Animated Alternating Fire-Breath & Water-Mist Spray Shader Plume + LED Spine Accent
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

        float cycle = mod(uTime, 16.0);
        float mistMix = smoothstep(9.5, 10.5, cycle) * (1.0 - smoothstep(15.2, 16.0, cycle));

        vec3 fireCol = mix(vec3(1.0, 0.86, 0.34), vec3(1.0, 0.36, 0.05), smoothstep(0.05, 0.72, fromMouth));
        vec3 mistCol = mix(vec3(0.86, 0.96, 1.0), vec3(0.32, 0.82, 0.96), smoothstep(0.05, 0.78, fromMouth));
        vec3 col = mix(fireCol, mistCol, mistMix);
        float alpha = clamp(axialFade * edgeFade * flicker * mix(0.82, 0.68, mistMix), 0.0, 0.90);
        gl_FragColor = vec4(col * mix(1.45, 1.20, mistMix), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(fireShaderMat);

  // 6. East Riverbank Park Icons: Cá Chép Hóa Rồng White Marble Fountain + Cầu Tình Yêu Heart-Lantern Pier
  const parkMarbleParts: THREE.BufferGeometry[] = [];
  const parkWoodParts: THREE.BufferGeometry[] = [];
  const parkHeartParts: THREE.BufferGeometry[] = [];
  const carpX = 446.0;
  const carpZ = -16.0;
  ctx.exclusionCircles.push({ x: carpX, z: carpZ, r: 12.0 });
  addBox(parkMarbleParts, 4.6, 1.2, 4.6, carpX, 2.2, carpZ);
  addCyl(parkMarbleParts, 1.6, 2.1, 1.4, 12, carpX, 3.5, carpZ);
  // Sweeping S-curved marble Carp-Dragon body rising to y = 8.4m
  const carpPts = [
    new THREE.Vector3(carpX, 3.8, carpZ),
    new THREE.Vector3(carpX - 0.6, 5.4, carpZ + 0.4),
    new THREE.Vector3(carpX + 0.4, 6.8, carpZ - 0.3),
    new THREE.Vector3(carpX - 0.2, 8.2, carpZ)
  ];
  parkMarbleParts.push(createVariableTubeGeometry(carpPts, [1.05, 0.85, 0.68, 0.54], 10));

  // Cầu Tình Yêu pier extending West out over the Han River at z = -16
  addBox(parkWoodParts, 18.0, 0.28, 3.6, 435.0, 1.85, carpZ);
  for (let px = 427; px <= 443; px += 4.0) {
    for (const pzOff of [-1.5, 1.5]) {
      addCyl(parkWoodParts, 0.14, 0.17, 4.2, 7, px, -0.1, carpZ + pzOff);
    }
    if (px < 442) {
      addCyl(steelParts, 0.06, 0.07, 2.8, 6, px, 3.25, carpZ + 1.55);
      const heartL = createHeartGeometry(0.45, 0.16);
      heartL.translate(px, 4.45, carpZ + 1.55);
      parkHeartParts.push(heartL);
    }
  }
  const whiteMarbleMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const parkWoodMat = ctx.materials.darkWood;
  const heartLanternMat = new THREE.MeshStandardMaterial({
    color: '#ff4252',
    emissive: new THREE.Color('#ff2942'),
    emissiveIntensity: 1.45,
    roughness: 0.32
  });
  ctx.extraMaterials.push(heartLanternMat);
  group.add(
    new THREE.Mesh(mergeNormalized(parkMarbleParts), whiteMarbleMat),
    new THREE.Mesh(mergeNormalized(parkWoodParts), parkWoodMat),
    new THREE.Mesh(mergeNormalized(parkHeartParts), heartLanternMat)
  );

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

    // Upper dome vault framing the massive collapsed Doline Skylight (raised to +66m so Great Wall stays fully inside!)
    const topR = 25.0 + (rand() - 0.5) * 2.2;
    const tx = cx + Math.cos(ang) * topR;
    const tz = cz + Math.sin(ang) * topR;
    const topArch = createSculptedRockGeometry(1300 + i * 29, 10.5, 8.5, 9.8, 2);
    topArch.rotateZ(Math.cos(ang) * 0.55);
    topArch.rotateX(-Math.sin(ang) * 0.55);
    topArch.translate(tx, floorY + 66.0 + (rand() - 0.5) * 2.5, tz);
    rockParts.push(topArch);
  }

  // 48 Hanging Ceiling Calcite Stalactites ringing mid & upper vault
  for (let s = 0; s < 48; s++) {
    const a = (s / 48) * Math.PI * 2 + rand() * 0.1;
    const rr = 26.0 + rand() * 14.0;
    const sx = cx + Math.cos(a) * rr;
    const sz = cz + Math.sin(a) * rr;
    const ceilY = floorY + THREE.MathUtils.lerp(56.0, 38.0, (rr - 26.0) / 14.0);
    const drop = 3.5 + rand() * 5.5;
    addCone(rockParts, 0.38 + rand() * 0.45, drop, 7, sx, ceilY - drop * 0.5, sz, Math.PI, rand() * Math.PI);
  }

  // 3 Terraced Cream-Ochre Calcite Rimstone Gour Pools & Glossy White Cave Pearls near Hand of Dog
  const calciteParts: THREE.BufferGeometry[] = [];
  const pearlParts: THREE.BufferGeometry[] = [];
  for (const [gx, gz, gr] of [
    [cx - 10, cz - 14, 4.2],
    [cx - 16, cz - 22, 3.6],
    [cx - 24, cz - 18, 3.2]
  ]) {
    const rim = new THREE.TorusGeometry(gr, 0.36, 7, 18);
    rim.rotateX(Math.PI * 0.5);
    rim.translate(gx, floorY + 0.35, gz);
    calciteParts.push(rim);
    const waterDisk = new THREE.CircleGeometry(gr * 0.92, 16);
    waterDisk.rotateX(-Math.PI * 0.5);
    waterDisk.translate(gx, floorY + 0.32, gz);
    calciteParts.push(waterDisk);
    for (let p = 0; p < 5; p++) {
      const pearl = new THREE.SphereGeometry(0.18, 7, 6);
      pearl.translate(gx + (p - 2) * 0.55, floorY + 0.48, gz + (p % 2 === 0 ? 0.3 : -0.3));
      pearlParts.push(pearl);
    }
  }
  const calciteMat = new THREE.MeshStandardMaterial({ color: '#d8c296', roughness: 0.36, metalness: 0.08 });
  const pearlMat = new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 0.22, metalness: 0.1 });
  ctx.extraMaterials.push(calciteMat, pearlMat);
  group.add(
    new THREE.Mesh(mergeNormalized(calciteParts), calciteMat),
    new THREE.Mesh(mergeNormalized(pearlParts), pearlMat)
  );

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

  // 2.1 Colossal 56m-tall "Bàn Tay Của Chàng" (Hand of Dog) Stalagmite near Doline 1
  const hodX = cx - 22.0;
  const hodZ = cz - 12.0;
  const hodBase = createSculptedRockGeometry(3301, 8.2, 28.0, 7.8, 3);
  hodBase.translate(hodX, floorY + 14.0, hodZ);
  const hodShaft = createSculptedRockGeometry(3302, 6.4, 26.0, 5.8, 3);
  hodShaft.translate(hodX, floorY + 36.0, hodZ);
  rockParts.push(hodBase, hodShaft);
  // Knuckle-shaped crest crags of the "Hand of Dog" paw summit (y up to floorY + 54m)
  for (let k = 0; k < 4; k++) {
    const kx = hodX - 1.8 + k * 1.2;
    const kz = hodZ + (k % 2 === 0 ? 0.7 : -0.7);
    const knuckle = createSculptedRockGeometry(3310 + k, 1.6, 6.2, 1.8, 2);
    knuckle.translate(kx, floorY + 49.0 + k * 0.45, kz);
    rockParts.push(knuckle);
  }

  // 2.2 "Bức Tường Việt Nam" (The Great Wall of Vietnam) tucked cleanly INSIDE cavern vault at wallZ = cz + 34 (Fixes Bug B3!)
  const wallZ = cz + 34.0;
  for (const wxOff of [-19.5, -6.5, 6.5, 19.5]) {
    const col = createSculptedRockGeometry(4400 + wxOff * 10, 7.6, 52.0, 4.8, 2);
    col.translate(cx + wxOff, floorY + 25.0, wallZ);
    rockParts.push(col);
  }
  addBox(rockParts, 46.0, 52.0, 4.4, cx, floorY + 25.0, wallZ);

  // Expedition ladder & ascent safety ropes scaling the Great Wall of Vietnam
  const metalParts: THREE.BufferGeometry[] = [];
  addCyl(metalParts, 0.04, 0.04, 46.0, 6, cx - 0.45, floorY + 23.0, wallZ - 2.6);
  addCyl(metalParts, 0.04, 0.04, 46.0, 6, cx + 0.45, floorY + 23.0, wallZ - 2.6);
  for (let r = 0; r < 66; r++) {
    addCyl(metalParts, 0.025, 0.025, 0.90, 6, cx, floorY + 1.2 + r * 0.68, wallZ - 2.6, 0, 0, Math.PI * 0.5);
  }
  addCyl(metalParts, 0.02, 0.02, 48.0, 6, cx + 0.95, floorY + 24.0, wallZ - 2.5);

  // 2.3 Subterranean Expedition Campsite on Fine Sandy Beach Terrace beside Lake
  const sandParts: THREE.BufferGeometry[] = [];
  const campBaseX = cx + 8.5;
  const campBaseZ = cz - 11.0;
  addBox(sandParts, 22.0, 0.55, 16.0, campBaseX, floorY + 0.25, campBaseZ);

  // 4 Colorful Expedition Dome Tents (Oxalis Orange, Trekker Navy, Sunburst Yellow, Alpine Green)
  const tentTops: Array<{ parts: THREE.BufferGeometry[]; color: string }> = [
    { parts: [], color: '#f26522' },
    { parts: [], color: '#1e3d59' },
    { parts: [], color: '#f5b041' },
    { parts: [], color: '#27ae60' }
  ];
  const tentConfigs = [
    { x: campBaseX - 5.5, z: campBaseZ - 3.5, yaw: 0.2 },
    { x: campBaseX + 0.5, z: campBaseZ - 4.2, yaw: -0.15 },
    { x: campBaseX + 6.2, z: campBaseZ - 3.2, yaw: 0.35 },
    { x: campBaseX + 0.8, z: campBaseZ + 3.2, yaw: Math.PI * 0.95 }
  ];
  const innerLanternParts: THREE.BufferGeometry[] = [];
  tentConfigs.forEach((tc, idx) => {
    const dome = new THREE.SphereGeometry(1.4, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    dome.scale(1.25, 1.05, 1.45);
    dome.rotateY(tc.yaw);
    dome.translate(tc.x, floorY + 0.5, tc.z);
    tentTops[idx].parts.push(dome);

    const innerLamp = new THREE.SphereGeometry(0.14, 8, 6);
    innerLamp.translate(tc.x, floorY + 0.85, tc.z);
    innerLanternParts.push(innerLamp);

    // Trekker aluminum gear crate
    addBox(metalParts, 0.85, 0.48, 0.65, tc.x + 1.6, floorY + 0.72, tc.z + 0.4, tc.yaw);
  });

  // Expedition central table
  addBox(metalParts, 1.8, 0.08, 0.95, campBaseX - 2.5, floorY + 1.15, campBaseZ + 1.5);
  for (const tx of [-0.75, 0.75]) {
    for (const tz of [-0.38, 0.38]) {
      addCyl(metalParts, 0.03, 0.03, 0.65, 6, campBaseX - 2.5 + tx, floorY + 0.82, campBaseZ + 1.5 + tz);
    }
  }

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
    if (Math.hypot(fx - campBaseX, fz - campBaseZ) < 9.5) continue; // Keep campsite clear of overlapping shrubs
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

  if (sandParts.length > 0) {
    const sandMat = new THREE.MeshStandardMaterial({
      color: '#c8ad7f',
      roughness: 0.94,
      metalness: 0.05
    });
    ctx.extraMaterials.push(sandMat);
    const sandMesh = new THREE.Mesh(mergeNormalized(sandParts), sandMat);
    sandMesh.receiveShadow = true;
    group.add(sandMesh);
  }

  if (metalParts.length > 0) {
    const metalMat = new THREE.MeshStandardMaterial({
      color: '#cfd8dc',
      metalness: 0.88,
      roughness: 0.24
    });
    ctx.extraMaterials.push(metalMat);
    const metalMesh = new THREE.Mesh(mergeNormalized(metalParts), metalMat);
    metalMesh.castShadow = true;
    group.add(metalMesh);
  }

  for (const tt of tentTops) {
    if (tt.parts.length > 0) {
      const tentMat = new THREE.MeshStandardMaterial({
        color: tt.color,
        transparent: true,
        opacity: 0.78,
        roughness: 0.48,
        metalness: 0.06,
        side: THREE.DoubleSide
      });
      ctx.extraMaterials.push(tentMat);
      const tentMesh = new THREE.Mesh(mergeNormalized(tt.parts), tentMat);
      tentMesh.castShadow = true;
      group.add(tentMesh);
    }
  }
  // Rào Thương Subterranean Emerald River Strip + Camp Kitchen Canopy Shelter
  const riverGeo = new THREE.PlaneGeometry(5.5, 52.0);
  riverGeo.rotateX(-Math.PI * 0.5);
  riverGeo.rotateY(0.28);
  riverGeo.translate(cx + 21.0, floorY + 0.14, cz);
  const kitchenCanopy = new THREE.BoxGeometry(4.4, 0.12, 3.8);
  kitchenCanopy.translate(campBaseX - 6.8, floorY + 2.8, campBaseZ + 2.5);
  const riverStrip = new THREE.Mesh(riverGeo, cavePoolMat);
  const kitchenMesh = new THREE.Mesh(kitchenCanopy, ctx.materials.darkRoof);
  group.add(riverStrip, kitchenMesh);

  if (innerLanternParts.length > 0) {
    const tentLampMat = new THREE.MeshStandardMaterial({
      color: '#ffea75',
      emissive: new THREE.Color('#ffa726'),
      emissiveIntensity: 2.4,
      roughness: 0.3
    });
    ctx.extraMaterials.push(tentLampMat);
    const tentLampMesh = new THREE.Mesh(mergeNormalized(innerLanternParts), tentLampMat);
    group.add(tentLampMesh);
  }

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

  // 1. Flanking cliff shoulders & deep karst cavern walls (extended to z = cz - 46)
  for (const side of [-1, 1]) {
    const cliffX = cx + side * 20.5;
    for (let k = 0; k < 8; k++) {
      const kz = cz + 18.0 - k * 8.8;
      const wall = createSculptedRockGeometry(3100 + side * 50 + k, 9.5, 22.0, 9.2, 2);
      wall.translate(cliffX, 8.2, kz);
      rockParts.push(wall);

      const bankRock = createSculptedRockGeometry(3250 + side * 40 + k, 8.2, 8.5, 8.6, 2);
      bankRock.translate(cx + side * 18.5, 2.0, kz);
      rockParts.push(bankRock);
    }
    addBox(rockParts, 7.6, 3.9, 64.0, cx + side * 17.5, -0.65, cz - 14.0);
  }

  // Towering 50m Karst Cliff Brow draped with overhanging jungle vines above portal
  const upperBrow = createSculptedRockGeometry(3390, 24.0, 14.0, 12.0, 2);
  upperBrow.translate(cx, 38.0, cz + 6.0);
  rockParts.push(upperBrow);
  const vineParts: THREE.BufferGeometry[] = [];
  for (let v = 0; v < 18; v++) {
    const vx = cx - 16.0 + v * 1.9;
    vineParts.push(createShrubCardCluster(vx, 25.0 + (v % 3) * 3.5, cz + 12.5, 2.4 + (v % 3) * 0.6, 700 + v));
  }
  const vineMat = new THREE.MeshStandardMaterial({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide });
  ctx.extraMaterials.push(vineMat);
  group.add(new THREE.Mesh(mergeNormalized(vineParts), vineMat));

  // Monumental 38m wide (half-span 19m) x 24m tall vaulted limestone river cavern portal (6 deep rows)
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const ang = t * Math.PI;
    const ax = cx + Math.cos(ang) * 19.0;
    const ay = -1.0 + Math.sin(ang) * 25.0;
    for (let row = 0; row < 6; row++) {
      const az = cz + 12.0 - row * 9.5;
      const archBlock = createSculptedRockGeometry(3400 + i * 19 + row * 7, 5.6, 5.2, 6.8, 2);
      archBlock.translate(ax, ay, az);
      rockParts.push(archBlock);
    }
  }

  // Deep recessed cavern back closure at cz - 46 + interior sandy cave beach (*Hang Bi Ký*)
  const backWall = createSculptedRockGeometry(3900, 26.0, 20.0, 9.0, 2);
  backWall.translate(cx + 2.0, 6.0, cz - 46.0);
  rockParts.push(backWall);
  addBox(voidParts, 42.0, 28.0, 1.5, cx + 2.0, 6.5, cz - 42.5);
  addBox(woodParts, 16.0, 0.35, 6.5, cx - 9.0, 0.9, cz - 26.0); // Hang Bi Ký wooden boardwalk

  // 2. Sculpted organic limestone stalactites & stalagmites with emerald/amber uplight bounce
  for (let i = 0; i < 42; i++) {
    const sx = cx - 14.5 + rand() * 29.0;
    const sz = cz + 11.5 - rand() * 50.0;
    const normX = Math.abs(sx - cx) / 19.0;
    const ceilY = -1.0 + 25.0 * Math.sqrt(Math.max(0.1, 1.0 - normX * normX)) - 1.2;
    const dropLen = 4.0 + rand() * 5.0;
    const r = 0.45 + rand() * 0.72;
    addCone(rockParts, r, dropLen, 8, sx, ceilY - dropLen * 0.45, sz, Math.PI, rand() * Math.PI);
  }
  for (let i = 0; i < 20; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const sx = cx + side * (14.5 + rand() * 3.2);
    const sz = cz + 11.0 - rand() * 48.0;
    const riseH = 4.0 + rand() * 5.5;
    addCone(rockParts, 0.65 + rand() * 0.72, riseH, 8, sx, 0.1 + riseH * 0.5, sz, 0, rand() * Math.PI);
  }

  // 3. Weathered timber sightseeing dock, readable "ĐỘNG PHONG NHA" sign & 3 blue/white tourist boats
  const dockX = 275.0;
  const dockZ = -225.0;
  addBox(woodParts, 10.5, 0.28, 4.2, dockX, 0.72, dockZ);
  addBox(woodParts, 3.6, 0.28, 8.5, dockX - 3.4, 0.72, dockZ + 5.8);
  for (let px = -4.5; px <= 4.5; px += 2.25) {
    for (const pzOff of [-1.8, 1.8]) {
      addCyl(woodParts, 0.14, 0.18, 3.6, 8, dockX + px, -0.8, dockZ + pzOff);
    }
  }
  const pnSign = createSignagePlaqueMesh(
    { text: 'ĐỘNG PHONG NHA', subText: 'KẺ BÀNG — QUẢNG BÌNH', width: 4.8, height: 0.95, style: 'market' },
    ctx
  );
  pnSign.position.set(dockX - 3.4, 2.85, dockZ + 5.8);
  group.add(pnSign);

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
  // 3 Painted Blue & White Phong Nha Sightseeing Boats with Arched Canopies & Benches
  const pnBoatParts: THREE.BufferGeometry[] = [];
  for (const [bx, bz, byaw] of [
    [dockX + 1.5, dockZ - 3.8, 0.08],
    [dockX - 4.2, dockZ - 5.2, 0.25],
    [cx + 1.5, cz - 14.0, 1.52]
  ]) {
    const hull = new THREE.BoxGeometry(8.4, 0.65, 2.2);
    hull.rotateY(byaw);
    hull.translate(bx, 0.18, bz);
    pnBoatParts.push(colorizeForMerge(hull, '#1f5e9c'));
    const rim = new THREE.BoxGeometry(8.6, 0.14, 2.3);
    rim.rotateY(byaw);
    rim.translate(bx, 0.56, bz);
    pnBoatParts.push(colorizeForMerge(rim, '#f2f2f0'));
    const canopy = new THREE.CylinderGeometry(1.12, 1.12, 4.2, 10, 1, true, 0, Math.PI);
    canopy.rotateZ(Math.PI * 0.5);
    canopy.rotateY(byaw);
    canopy.translate(bx, 0.82, bz);
    pnBoatParts.push(colorizeForMerge(canopy, '#2972b6'));
  }
  const pnBoatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, side: THREE.DoubleSide });
  ctx.extraMaterials.push(pnBoatMat);
  group.add(new THREE.Mesh(mergeNormalized(pnBoatParts), pnBoatMat));

  // Warm amber + emerald grotto bounce lights illuminating stalactites deeper inside cavern
  const grottoLight = new THREE.PointLight('#ffaa55', 65.0, 58.0, 1.6);
  grottoLight.position.set(cx, 7.5, cz - 4.0);
  const innerEmeraldLight = new THREE.PointLight('#3ad6a8', 42.0, 48.0, 1.5);
  innerEmeraldLight.position.set(cx, 5.5, cz - 24.0);
  group.add(grottoLight, innerEmeraldLight);

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
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 42.0 });

  const brickParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const rockParts: THREE.BufferGeometry[] = [];
  const mossParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lampCoreParts: THREE.BufferGeometry[] = [];

  // 1. Expanded Stepped Weathered Sandstone Sanctuary Terrace + Ruined Brick Perimeter Wall
  addBox(stoneParts, 58.0, 2.2, 54.0, cx, yBase - 0.85, cz);
  const courtY = yBase + 0.25;
  for (const wallSide of [-1, 1]) {
    addBox(brickParts, 52.0, 1.45, 0.85, cx, courtY + 0.72, cz + wallSide * 25.0);
    addBox(brickParts, 0.85, 1.45, 48.0, cx - 26.0, courtY + 0.72, cz);
  }

  // 2. 24m-tall Tower A1 Kalan + 15m & 11.5m flanking chamBrick towers (Bug B10 fixed: skipBuiltInVestibule on A1!)
  const towers = [
    { ox: -6.5, oz: 0.0, w: 8.0, h: 24.0, tiers: 4 },
    { ox: -10.0, oz: -11.5, w: 5.2, h: 15.0, tiers: 3 },
    { ox: -9.5, oz: 11.2, w: 4.4, h: 11.5, tiers: 3 }
  ];
  towers.forEach((tw, idx) => {
    const towerGeo = createChamTowerGeometry(tw.w, tw.h, tw.tiers, { skipBuiltInVestibule: idx === 0 });
    towerGeo.rotateY(Math.PI * 0.5);
    towerGeo.translate(cx + tw.ox, courtY, cz + tw.oz);
    brickParts.push(towerGeo);

    // Projecting East sandstone portal colonnettes & sculpted Kala-Makara tympanum
    const lintelX = idx === 0 ? cx + 0.92 : cx + tw.ox + tw.w * 0.58;
    const lintelZ = cz + tw.oz;
    const portalH = idx === 0 ? 4.4 : tw.h * 0.28;
    addBox(stoneParts, 0.92, 0.72, tw.w * 0.64, lintelX, courtY + portalH + 0.36, lintelZ);
    stoneParts.push(
      ...createChamReliefTympanumParts(
        lintelX + 0.18,
        courtY + portalH + 0.72,
        lintelZ,
        Math.PI * 0.5,
        tw.w * 0.14,
        'kala_makara'
      )
    );
    for (const sz of [-tw.w * 0.25, tw.w * 0.25]) {
      addBox(stoneParts, 0.78, portalH, 0.56, lintelX, courtY + portalH * 0.5, lintelZ + sz);
      addBox(stoneParts, 0.96, 0.32, 0.76, lintelX, courtY + 0.16, lintelZ + sz);
    }
    for (const sx of [-tw.w * 0.44, tw.w * 0.44]) {
      for (const sz of [-tw.w * 0.44, tw.w * 0.44]) {
        addCone(stoneParts, 0.36, 1.15, 4, cx + tw.ox + sx, courtY + tw.h * 0.46, cz + tw.oz + sz);
      }
    }
  });

  // Iconic Kosa B5 Boat-Roofed Treasury Tower (*Tháp Kho mái hình thuyền*) at (cx + 5.5, cz - 14.5)
  addBox(brickParts, 7.6, 4.2, 4.8, cx + 5.5, courtY + 2.1, cz - 14.5);
  const kosaRoof = createVietnameseCurvedRoofGeometry(8.6, 5.8, 7.2, 0.35, 3.2, 0.42);
  kosaRoof.translate(cx + 5.5, courtY + 4.2, cz - 14.5);
  brickParts.push(kosaRoof);

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
    // Sculpted sandstone Dvarapala guardian statues flanking East Gopura
    addBox(stoneParts, 1.15, 0.72, 1.15, cx + 17.6, courtY + 0.36, cz + side * 2.55);
    stoneParts.push(...createGuardianBeastParts(cx + 17.6, courtY + 0.72, cz + side * 2.55, Math.PI * 0.5, 1.05, 'dvarapala'));
  }

  // GPU Incense Smoke rising gently from Tower A1's bronze offering censer
  const mySonSmoke = createIncenseSmokeSystem(
    [{ x: lyX + 1.02, y: courtY + 0.95, z: cz, scale: 0.75 }],
    ctx.sharedShaders?.incenseSmoke
  );
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(mySonSmoke.mesh.material as THREE.Material);
    ctx.animatedUniforms?.push(mySonSmoke.uniforms);
  }
  group.add(mySonSmoke.mesh);

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
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 30.0 });

  const brickParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const boulderParts: THREE.BufferGeometry[] = [];
  const blackStoneParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const blossomParts: THREE.BufferGeometry[] = [];

  // 1. Expanded Stepped Brick & Stone Podium Terraces + Retaining Wall
  addBox(stoneParts, 34.0, 2.8, 38.0, cx, yBase - 0.95, cz);
  addBox(stoneParts, 27.0, 0.85, 31.0, cx, yBase + 0.85, cz);
  const podiumY = yBase + 1.28;
  addBox(brickParts, 28.0, 0.95, 0.75, cx, podiumY + 0.45, cz - 14.5);
  addBox(brickParts, 28.0, 0.95, 0.75, cx, podiumY + 0.45, cz + 14.5);

  // Approach stone stairway on the West (-X) face leading down to bluff ground
  for (let s = 0; s < 6; s++) {
    addBox(stoneParts, 1.0, 0.36, 5.4, cx - 15.2 - s * 0.85, yBase + 1.08 - s * 0.24, cz);
  }

  // 2. Authentic Hoa Lai Style Trio (16m Tower A, 12m Tower B, 5m Tower C) + Open East Vestibule on Tower A
  const towers = [
    { ox: -1.2, oz: 0.0, w: 5.6, h: 16.0, tiers: 4 },
    { ox: -2.4, oz: -8.6, w: 4.4, h: 12.0, tiers: 3 },
    { ox: 2.8, oz: 8.2, w: 2.6, h: 5.0, tiers: 2 }
  ];
  towers.forEach((tw, idx) => {
    const tGeo = createChamTowerGeometry(tw.w, tw.h, tw.tiers, {
      hoaLaiStyle: true,
      skipBuiltInVestibule: idx === 0
    });
    tGeo.rotateY(Math.PI * 0.5);
    tGeo.translate(cx + tw.ox, podiumY, cz + tw.oz);
    brickParts.push(tGeo);
  });

  // Open Arched East Vestibule & Black-Stone Linga-Yoni Altar inside Tower A
  const vx = cx + 2.4;
  for (const sz of [-1.25, 1.25]) {
    addBox(brickParts, 2.8, 3.6, 0.55, vx, podiumY + 1.8, cz + sz);
  }
  addBox(brickParts, 3.0, 0.55, 3.1, vx, podiumY + 3.8, cz);
  addCone(brickParts, 1.2, 1.4, 4, vx - 0.1, podiumY + 4.75, cz);
  // Black-stone Linga-Yoni + bronze censer + oil lamps + warm interior sanctum PointLight
  addBox(blackStoneParts, 1.35, 0.42, 1.35, vx - 0.2, podiumY + 0.22, cz);
  addCyl(blackStoneParts, 0.22, 0.25, 0.88, 12, vx - 0.2, podiumY + 0.84, cz);
  bronzeParts.push(...createBronzeIncenseTripodParts(vx + 0.72, podiumY, cz, 0.55).bronzeParts);
  const poLight = new THREE.PointLight('#ffb562', 2.4, 14, 1.4);
  poLight.position.set(vx + 0.4, podiumY + 2.1, cz);
  group.add(poLight);

  // 3. Desert coastal sandstone boulders & 6 Frangipani (*Hoa Sứ*) trees around headland bluff rim
  const rand = mulberry32(72341);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.4;
    const dist = 17.5 + rand() * 5.5;
    const bx = cx + Math.cos(ang) * dist;
    const bz = cz + Math.sin(ang) * dist;
    const by = ctx.getHeight(bx, bz);
    const rock = createSculptedRockGeometry(5100 + i * 29, 1.5 + rand() * 1.1, 1.1 + rand() * 0.8, 1.4 + rand() * 1.0, 2);
    rock.translate(bx, by + 0.18, bz);
    boulderParts.push(rock);
  }
  for (let f = 0; f < 6; f++) {
    const a = (f / 6) * Math.PI * 2 + 0.3;
    const fx = cx + Math.cos(a) * 16.0;
    const fz = cz + Math.sin(a) * 18.0;
    const fy = ctx.getHeight(fx, fz);
    addCyl(barkParts, 0.16, 0.28, 3.8, 7, fx, fy + 1.8, fz);
    for (let br = 0; br < 3; br++) {
      const ba = (br / 3) * Math.PI * 2 + f;
      const puff = createSculptedRockGeometry(7300 + f * 11 + br, 1.25, 0.72, 1.25, 1);
      puff.translate(fx + Math.cos(ba) * 0.9, fy + 3.8 + br * 0.25, fz + Math.sin(ba) * 0.9);
      blossomParts.push(colorizeForMerge(puff, br === 0 ? '#f5efe2' : '#4a7c38'));
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

  const boulderMesh = new THREE.Mesh(mergeNormalized(boulderParts), ctx.materials.granite);
  boulderMesh.castShadow = true;

  const blackStoneMat = new THREE.MeshStandardMaterial({ color: '#26282e', roughness: 0.42, metalness: 0.14 });
  const frangipaniMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  ctx.extraMaterials.push(blackStoneMat, frangipaniMat);

  group.add(
    brickMesh,
    stoneMesh,
    boulderMesh,
    new THREE.Mesh(mergeNormalized(blackStoneParts), blackStoneMat),
    new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(barkParts), ctx.materials.bark),
    new THREE.Mesh(mergeNormalized(blossomParts), frangipaniMat)
  );
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
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 36.0 });

  const stoneParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const pineParts: THREE.BufferGeometry[] = [];
  const flowerParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];

  // 1. Stone Lookout Terrace (r = 14.5m, grounded deeply) + Connected Overlook Balustrade (clear East corridor!)
  addCyl(stoneParts, 14.2, 15.2, 2.2, 28, cx, yBase - 0.65, cz);
  const terraceY = yBase + 0.45;
  let prevPx: number | null = null;
  let prevPz: number | null = null;
  for (let i = -7; i <= 7; i++) {
    const ang = Math.PI * 0.22 + ((i + 7) / 14) * Math.PI * 1.56;
    const px = cx + Math.cos(ang) * 13.5;
    const pz = cz + Math.sin(ang) * 13.5;
    addBox(stoneParts, 0.55, 1.15, 0.55, px, terraceY + 0.58, pz, -ang);
    if (prevPx !== null && prevPz !== null) {
      stoneParts.push(...createPiercedBalustradeParts(prevPx, prevPz, px, pz, terraceY, 0.96, 'lotus_stone'));
    }
    prevPx = px;
    prevPz = pz;
  }

  // 2. 9.5m-tall Timber Overlook Gazebo Pavilion with Curved Upturned Hexagonal Roofs
  addCyl(stoneParts, 5.8, 6.2, 0.55, 8, cx, terraceY + 0.275, cz);
  const pavY = terraceY + 0.55;
  const postR = 4.6;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(ang) * postR;
    const pz = cz + Math.sin(ang) * postR;
    addCyl(woodParts, 0.18, 0.22, 4.8, 8, px, pavY + 2.4, pz);
    if (i > 0 && i < 5) {
      const nAng = ((i + 1) / 6) * Math.PI * 2;
      const mx = cx + (Math.cos(ang) + Math.cos(nAng)) * 0.5 * postR;
      const mz = cz + (Math.sin(ang) + Math.sin(nAng)) * 0.5 * postR;
      addBox(woodParts, 4.4, 0.22, 0.24, mx, pavY + 1.15, mz, -ang - Math.PI / 6);
      addBox(woodParts, 4.4, 0.18, 0.65, mx, pavY + 0.58, mz, -ang - Math.PI / 6);
    }
  }
  const gazeboRoof1 = createHexCurvedRoofGeometry(6.8, 2.8, 0.35);
  gazeboRoof1.translate(cx, pavY + 4.75, cz);
  roofParts.push(gazeboRoof1);

  const gazeboRoof2 = createHexCurvedRoofGeometry(4.2, 2.6, 0.32);
  gazeboRoof2.translate(cx, pavY + 6.65, cz);
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

  // 2b. K'Lang & H'Biang Lovers Statue + "LANGBIANG 1.929m" Signboard + 2 Vintage Jeeps + Đa Thiện Lake & Swan Boats
  const statX = cx - 6.5;
  const statZ = cz - 5.5;
  addBox(stoneParts, 2.6, 1.4, 2.6, statX, terraceY + 0.7, statZ);
  addCyl(bronzeParts, 0.36, 0.48, 2.35, 10, statX - 0.38, terraceY + 2.55, statZ);
  addCyl(bronzeParts, 0.32, 0.44, 2.15, 10, statX + 0.38, terraceY + 2.45, statZ);
  bronzeParts.push(new THREE.SphereGeometry(0.28, 8, 6).translate(statX - 0.38, terraceY + 3.92, statZ));
  bronzeParts.push(new THREE.SphereGeometry(0.26, 8, 6).translate(statX + 0.38, terraceY + 3.72, statZ));

  // "LANGBIANG 1.929m" Welcome Archway on East entrance
  for (const sz of [-2.4, 2.4]) {
    addCyl(woodParts, 0.14, 0.16, 3.8, 7, cx + 13.8, terraceY + 1.9, cz + sz);
  }
  const lbSign = createSignagePlaqueMesh(
    { text: 'LANGBIANG 1.929m', subText: 'ĐÀ LẠT — THUNG LŨNG TÌNH YÊU', width: 5.2, height: 1.0, style: 'market' },
    ctx
  );
  lbSign.rotation.y = Math.PI * 0.5;
  lbSign.position.set(cx + 13.8, terraceY + 3.75, cz);
  group.add(lbSign);

  // 2 Vintage Olive-Green Langbiang Summit Jeeps
  const jeepBodyParts: THREE.BufferGeometry[] = [];
  const jeepDarkParts: THREE.BufferGeometry[] = [];
  for (const [jx, jz, jyaw] of [
    [cx + 16.5, cz - 8.5, -0.45],
    [cx + 15.5, cz + 9.2, 0.38]
  ]) {
    const jy = ctx.getHeight(jx, jz);
    const j = createVintageJeepParts(jx, jy, jz, jyaw);
    jeepBodyParts.push(...j.bodyParts);
    jeepDarkParts.push(...j.darkParts);
  }
  const jeepMat = new THREE.MeshStandardMaterial({ color: '#425937', roughness: 0.55, metalness: 0.25 });
  ctx.extraMaterials.push(jeepMat);
  group.add(
    new THREE.Mesh(mergeNormalized(jeepBodyParts), jeepMat),
    new THREE.Mesh(mergeNormalized(jeepDarkParts), ctx.materials.darkVoid)
  );

  // 3 Floral Heart Archways + Đa Thiện Mini-Lake (16×12m) with 2 White Swan Pedal Boats
  for (const [hx, hz, hyaw] of [
    [cx + 9.5, cz - 6.8, 0.5],
    [cx + 9.5, cz + 6.8, -0.5],
    [cx - 16.0, cz + 9.5, 0.8]
  ]) {
    const hy = ctx.getHeight(hx, hz);
    const hArch = createHeartGeometry(2.1, 0.24);
    hArch.rotateY(hyaw);
    hArch.translate(hx, hy + 2.1, hz);
    flowerParts.push(colorizeForMerge(hArch, '#e84393'));
  }
  const lakeX = cx - 22.0;
  const lakeZ = cz + 14.0;
  const lakeY = ctx.getHeight(lakeX, lakeZ);
  const lakeRim = new THREE.TorusGeometry(7.2, 0.55, 7, 22);
  lakeRim.rotateX(Math.PI * 0.5);
  lakeRim.scale(1.15, 1.0, 0.85);
  lakeRim.translate(lakeX, lakeY + 0.18, lakeZ);
  stoneParts.push(lakeRim);
  const lakeWater = new THREE.CircleGeometry(7.0, 22);
  lakeWater.rotateX(-Math.PI * 0.5);
  lakeWater.scale(1.15, 1.0, 0.85);
  lakeWater.translate(lakeX, lakeY + 0.24, lakeZ);
  const lakeWaterMat = new THREE.MeshStandardMaterial({ color: '#1b6d78', roughness: 0.18, metalness: 0.22 });
  const swanMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  ctx.extraMaterials.push(lakeWaterMat);
  const swanParts: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [
    [lakeX - 2.2, lakeZ - 1.0],
    [lakeX + 2.0, lakeZ + 1.2]
  ]) {
    const hull = new THREE.SphereGeometry(0.65, 8, 6);
    hull.scale(0.85, 0.55, 1.45);
    hull.translate(sx, lakeY + 0.42, sz);
    const neck = new THREE.CylinderGeometry(0.08, 0.12, 0.85, 6);
    neck.rotateX(0.32);
    neck.translate(sx, lakeY + 0.92, sz + 0.65);
    swanParts.push(hull, neck);
  }
  group.add(
    new THREE.Mesh(lakeWater, lakeWaterMat),
    new THREE.Mesh(mergeNormalized(swanParts), swanMat)
  );

  // 3. Vibrant Purple Hydrangea, Cherry Blossom (*Mai Anh Đào*) & Wild Sunflower (*Dã Quỳ*) Beds
  const rand = mulberry32(99123);
  const flowerHexes = ['#9a4dff', '#d633a6', '#7b61ff', '#f78fb3', '#f5cd2f'];
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2 + rand() * 0.12;
    const dist = 6.8 + rand() * 5.2;
    const fx = cx + Math.cos(ang) * dist;
    const fz = cz + Math.sin(ang) * dist;
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

  // 4. Towering Đà Lạt Umbrella Pines (*Thông Ba Lá — Pinus kesiya*) + Pink Mai Anh Đào Trees
  const pineCount = 22;
  for (let i = 0; i < pineCount; i++) {
    const ang = (i / pineCount) * Math.PI * 2 + 0.22;
    const dist = 17.5 + rand() * 8.5;
    const px = cx + Math.cos(ang) * dist;
    const pz = cz + Math.sin(ang) * dist;
    if (px > cx + 8.0 && Math.abs(pz - cz) < 5.5) continue;
    const py = ctx.getHeight(px, pz) - 0.6;
    const sc = 0.95 + rand() * 0.22;
    const upine = createUmbrellaPineParts(px, py, pz, 15.0 * sc, 700 + i);
    barkParts.push(...upine.barkParts);
    for (const lp of upine.leafParts) {
      pineParts.push(colorizeForMerge(lp, i % 5 === 0 ? '#f29eb8' : '#2d6b36'));
    }
  }

  const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
  ctx.extraMaterials.push(pineMat, flowerMat);

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;
  const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof);
  roofMesh.castShadow = true;
  const lanternMesh = new THREE.Mesh(mergeNormalized(lanternParts), ctx.materials.lanternSilk);
  const pavCoreMesh = new THREE.Mesh(pavCore, ctx.materials.lanternCore ?? ctx.materials.lanternSilk);
  const barkMesh = new THREE.Mesh(mergeNormalized(barkParts), ctx.materials.bark);
  barkMesh.castShadow = true;
  const pineMesh = new THREE.Mesh(mergeNormalized(pineParts), pineMat);
  pineMesh.castShadow = true;
  const flowerMesh = new THREE.Mesh(mergeNormalized(flowerParts), flowerMat);
  const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze);

  group.add(stoneMesh, woodMesh, roofMesh, lanternMesh, pavCoreMesh, barkMesh, pineMesh, flowerMesh, bronzeMesh);
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

  // UNESCO *Cồng Chiêng Tây Nguyên* 10-Gong Rack & Missing *Trống Hơgơr* Buffalo-Skin Drum!
  addBox(woodParts, 0.26, 2.25, 0.26, houseX - 2.35, deckY + 1.28, houseZ - 3.6);
  addBox(woodParts, 0.26, 2.25, 0.26, houseX - 2.35, deckY + 1.28, houseZ + 3.6);
  addBox(woodParts, 0.22, 0.18, 7.4, houseX - 2.35, deckY + 2.35, houseZ);
  for (let g = 0; g < 10; g++) {
    const gz = houseZ - 3.15 + g * 0.70;
    const gr = 0.20 + (4.5 - Math.abs(g - 4.5)) * 0.036;
    const gong = new THREE.CylinderGeometry(gr, gr, 0.07, 16);
    gong.rotateZ(Math.PI * 0.5);
    gong.translate(houseX - 2.32, deckY + 1.52, gz);
    bronzeParts.push(gong);
    const boss = new THREE.SphereGeometry(gr * 0.28, 8, 6);
    boss.translate(houseX - 2.26, deckY + 1.52, gz);
    goldParts.push(boss);
  }
  // Ceremonial *Trống Hơgơr* buffalo-skin drum on wooden A-frame stand
  const drumX = houseX - 1.9;
  const drumZ = houseZ + 4.1;
  addCyl(woodParts, 0.52, 0.52, 1.15, 14, drumX, deckY + 1.18, drumZ, Math.PI * 0.5, 0);
  addBox(woodParts, 0.16, 1.15, 0.16, drumX - 0.35, deckY + 0.65, drumZ);
  addBox(woodParts, 0.16, 1.15, 0.16, drumX + 0.35, deckY + 0.65, drumZ);

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

  // Carved twin breasts & crescent moon Bahnar motifs crowning the notched entry stair
  for (const bz of [-0.42, 0.42]) {
    const breast = new THREE.SphereGeometry(0.16, 8, 6);
    breast.translate(houseX + 3.88, deckY + 0.42, houseZ + bz);
    woodParts.push(breast);
  }
  const moonCres = new THREE.TorusGeometry(0.24, 0.05, 6, 12, Math.PI);
  moonCres.rotateY(Math.PI * 0.5);
  moonCres.translate(houseX + 3.88, deckY + 0.72, houseZ);
  goldParts.push(moonCres);

  // Towering 16m steep axe-blade thatched roof (*Mái Nhà Rông*, apex ~22m!) + Enclosed Woven Gable Walls (Fixes Bug B11!)
  const roofH = 15.5;
  const nhaRongRoof = createNhaRongRoofGeometry(13.8, 10.2, roofH);
  nhaRongRoof.rotateY(Math.PI * 0.5);
  nhaRongRoof.translate(houseX, deckY + 3.4, houseZ);
  roofParts.push(nhaRongRoof);

  const gableWalls = createNhaRongGableWallsGeometry(13.8, 10.2, roofH);
  gableWalls.rotateY(Math.PI * 0.5);
  gableWalls.translate(houseX, deckY + 3.4, houseZ);
  woodParts.push(gableWalls);

  // Carved crimson tribal ridge crests & finials at both flared gable tips
  for (const gz of [-9.4, 9.4]) {
    addCyl(crimsonParts, 0.09, 0.16, 2.2, 6, houseX, deckY + 3.4 + roofH + 0.85, houseZ + gz);
    addCone(crimsonParts, 0.42, 0.85, 4, houseX, deckY + 3.4 + roofH + 2.25, houseZ + gz);
  }

  // Nhà Mồ Funerary Pavilion surrounded by 8 Carved Wooden Folk Statues (*Tượng Nhà Mồ*)
  const moX = houseX + 2.5;
  const moZ = houseZ + 14.5;
  const moY = ctx.getHeight(moX, moZ);
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(woodParts, 0.10, 0.12, 2.4, 6, moX + ox, moY + 1.1, moZ + oz);
    }
  }
  const moRoof = createVietnameseCurvedRoofGeometry(4.8, 3.8, 3.6, 0.25, 2.1, 0.18);
  moRoof.translate(moX, moY + 2.2, moZ);
  roofParts.push(moRoof);
  for (let st = 0; st < 8; st++) {
    const sa = (st / 8) * Math.PI * 2;
    const sx = moX + Math.cos(sa) * 3.4;
    const sz = moZ + Math.sin(sa) * 2.9;
    const sy = ctx.getHeight(sx, sz);
    addCyl(woodParts, 0.16, 0.18, 1.45, 7, sx, sy + 0.72, sz);
    woodParts.push(new THREE.SphereGeometry(0.18, 7, 6).translate(sx, sy + 1.62, sz));
  }

  // White Hexagonal Nhà Lồng Biển Hồ Lakeside Pavilion + White Quan Âm + 2 Dugout Canoes (*Thuyền Độc Mộc*)
  const pavRimX = -422;
  const pavRimZ = 28;
  const pavRimY = Math.max(2.0, ctx.getHeight(pavRimX, pavRimZ));
  const whiteStoneMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const nhaLongParts: THREE.BufferGeometry[] = [];
  addCyl(nhaLongParts, 3.6, 3.8, 1.4, 6, pavRimX, pavRimY + 0.2, pavRimZ);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addCyl(nhaLongParts, 0.14, 0.16, 3.2, 7, pavRimX + Math.cos(a) * 2.8, pavRimY + 2.4, pavRimZ + Math.sin(a) * 2.8);
  }
  const nhaLongRoof = createHexCurvedRoofGeometry(4.2, 2.2, 0.28);
  nhaLongRoof.translate(pavRimX, pavRimY + 4.0, pavRimZ);
  const nhaLongRedParts = [nhaLongRoof];
  nhaLongParts.push(...createSculptedDeityParts(pavRimX, pavRimY + 0.9, pavRimZ, 0.9, 0.65, 'quanam').bodyParts);
  group.add(
    new THREE.Mesh(mergeNormalized(nhaLongParts), whiteStoneMat),
    new THREE.Mesh(mergeNormalized(nhaLongRedParts), ctx.materials.terracottaRoof)
  );
  // 2 Moored Wooden Dugout Canoes on Biển Hồ T'Nưng water
  for (const [cxCan, czCan, cyaw] of [
    [-424, 41, 0.3],
    [-422, 46, -0.25]
  ]) {
    const canoe = new THREE.CylinderGeometry(0.32, 0.28, 5.2, 7);
    canoe.scale(1.0, 0.65, 1.0);
    canoe.rotateX(Math.PI * 0.5);
    canoe.rotateY(cyaw);
    canoe.translate(cxCan, 0.08, czCan);
    woodParts.push(canoe);
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

  const thatchBumpTex = createThatchBumpTexture(ctx.extraTextures);
  const thatchMat = new THREE.MeshStandardMaterial({
    color: '#9c7c46',
    bumpMap: thatchBumpTex,
    bumpScale: thatchBumpTex ? 0.08 : 0.0,
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
