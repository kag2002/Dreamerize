import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import {
  VietnamBuilderContext,
  clamp01,
  mulberry32,
  mergeNormalized,
  applyWorldBoxUV,
  createSculptedRockGeometry,
  createArchedWallGeometry,
  createSteppedCorbelArchWallGeometry,
  createGableRoofGeometry,
  createBoatSaddleRoofGeometry,
  createVietnameseCurvedRoofGeometry,
  createHueImperialHipRoofGeometry,
  createChamTowerGeometry,
  createLotusFinialParts,
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
  createBronzeCraneOnTortoiseParts,
  createChamReliefTympanumParts,
  createUAZ469JeepParts,
  createNhaMoFolkStatueParts,
  createUmbrellaPineParts,
  createSmoothTaperedTubeGeometry,
  createSmoothDragonParts,
  createMotifBandParts,
  createShouCharacterParts,
  createLotusPetalRingParts,
  createPhoenixFinialParts,
  createCuaVongParts,
  createDoorStudGridParts,
  createBasReliefPanelParts,
  createLouverShutterParts,
  createArtDecoReliefParts,
  tagMotifIds
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
 * Creates a sloped/battered rectangular masonry frustum (for Ngọ Môn's ~8° batter, Kỳ Đài Vauban tiers,
 * and trapezoidal stone heritage pedestals) centered at (x, y, z) with independent top/bottom X and Z dimensions.
 */
function addBatteredBox(
  parts: THREE.BufferGeometry[],
  topW: number,
  botW: number,
  topD: number,
  botD: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rotY = 0
): void {
  const geo = new THREE.BoxGeometry(1, h, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const isTop = py > 0;
    pos.setX(i, pos.getX(i) * (isTop ? topW : botW));
    pos.setZ(i, pos.getZ(i) * (isTop ? topD : botD));
  }
  geo.computeVertexNormals();
  parts.push(transformGeometryXZY(geo, x, y, z, 0, 0, rotY));
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
  const halfLenTop = length * 0.43;
  const halfLenBase = length * 0.56;
  const strips = 18;
  const positions: number[] = [];
  const uvs: number[] = [];

  const evalX = (u: number, v: number): number =>
    u * THREE.MathUtils.lerp(halfLenTop, halfLenBase, Math.pow(v, 0.72));
  const evalY = (v: number): number =>
    (1.0 - Math.pow(v, 0.90)) * height + 0.18 * (1.0 - v * 0.65);
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
 * Generates the iconic steep axe-blade Central Highlands Nhà Rông roof split cleanly into:
 *  - Upper 2/3 woven bamboo matting panel (`v` in [0..splitV])
 *  - Lower 1/3 shaggy thatch skirt (`v` in [splitV..1.0])
 * so both materials sit flush on the exact same swept hyperbolic silhouette.
 */
function createNhaRongRoofSplitGeometries(
  length: number,
  width: number,
  height: number,
  splitV = 0.66
): { upperBamboo: THREE.BufferGeometry; lowerThatch: THREE.BufferGeometry } {
  const buildBand = (vMin: number, vMax: number, segV: number, extraFlare = 0): THREE.BufferGeometry => {
    const segU = 20;
    const bandParts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) * 2.0; // -1..1 along ridge length
        const t = pos.getZ(i) + 0.5; // 0..1 within band
        const v = THREE.MathUtils.lerp(vMin, vMax, t);

        const halfLenTop = length * 0.43;
        const halfLenBase = length * 0.56;
        const halfLen = THREE.MathUtils.lerp(halfLenTop, halfLenBase, Math.pow(v, 0.72));
        const halfW = (width * 0.5) * Math.pow(v, 1.42) + extraFlare * t;
        const ridgeSaddle = 0.18 * (u * u) * (1.0 - v * 0.65);
        const y = (1.0 - Math.pow(v, 0.90)) * height + ridgeSaddle;

        pos.setXYZ(i, u * halfLen, y, side * halfW);
        uv.setXY(i, (u * 0.5 + 0.5) * 6.0, v * 8.0);
      }
      geo.computeVertexNormals();
      bandParts.push(geo);
    }
    return mergeNormalized(bandParts);
  };

  return {
    upperBamboo: buildBand(0.0, splitV, 14, 0.0),
    lowerThatch: buildBand(splitV, 1.0, 8, 0.06)
  };
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
  const batTrangParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const centralRoofParts: THREE.BufferGeometry[] = [];
  const jadeRoofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const cuuDinhParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const lotusLeafParts: THREE.BufferGeometry[] = [];
  const moatRubbleParts: THREE.BufferGeometry[] = [];
  const ceramicParts: THREE.BufferGeometry[] = [];
  const terracottaBalParts: THREE.BufferGeometry[] = [];
  const plasterArchParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const lampGlobeParts: THREE.BufferGeometry[] = [];

  // 1. 57.8m wide U-shaped limestone-and-imperial-brick bastion (5.0m high, ~8° inward batter = 0.70m inset)
  const gateZ = -10.0;
  const rampartH = 5.0;
  const rampartDepth = 10.2;
  const batter = 0.70; // tan(8°) * 5.0m ≈ 0.70m

  // 3 central rectangular trabeated portals (Chính Môn, Tả/Hữu Giáp Môn) in dressed Thanh grey stone
  const centralPortals = [
    { x: 0.0, w: 9.6, openW: 4.5, openH: 3.95 },   // Chính Môn (rectangular trabeated)
    { x: -8.6, w: 7.6, openW: 3.1, openH: 3.35 },  // Tả Giáp Môn (rectangular trabeated)
    { x: 8.6, w: 7.6, openW: 3.1, openH: 3.35 }    // Hữu Giáp Môn (rectangular trabeated)
  ];

  for (let i = 0; i < centralPortals.length; i++) {
    const p = centralPortals[i];
    const pierW = Math.max(0.4, (p.w - p.openW) * 0.5);
    for (const side of [-1, 1]) {
      addBatteredBox(
        stoneParts,
        pierW,
        pierW,
        rampartDepth - batter,
        rampartDepth,
        rampartH,
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
        gateZ + rampartDepth * 0.5 - 0.14
      );
    }
    const lintelH = Math.max(0.5, rampartH - p.openH);
    addBatteredBox(
      stoneParts,
      p.openW + 0.16,
      p.openW + 0.16,
      rampartDepth - batter,
      rampartDepth - batter * 0.72,
      lintelH,
      p.x,
      p.openH + lintelH * 0.5,
      gateZ
    );
    // Heavy rectangular stone lintel header molding
    addBox(
      marbleParts,
      p.openW + 0.65,
      0.32,
      0.44,
      p.x,
      p.openH + 0.16,
      gateZ + rampartDepth * 0.5 - 0.24
    );

    // FIX NM-03: Open recessed crimson gate leaves folded cleanly inward against portal jambs so visitors see & pass into Imperial City!
    const doorDepth = rampartDepth * 0.36;
    addBox(voidParts, p.openW * 0.94, p.openH * 0.94, doorDepth, p.x, p.openH * 0.47, gateZ - 1.25);
    const leafW = p.openW * 0.42;
    const leafH = p.openH * 0.92;
    const doorZ = gateZ + 0.10;
    for (const side of [-1, 1]) {
      // Fold each door leaf open 72° inward against the side reveal (no solid wall blocking the passageway!)
      const lx = p.x + side * (p.openW * 0.44);
      const rotOpen = side * 1.22;
      addBox(crimsonParts, leafW, leafH, 0.24, lx, leafH * 0.5, doorZ - 0.55, rotOpen);
      addBox(goldParts, leafW * 0.92, 0.13, 0.28, lx, leafH * 0.78, doorZ - 0.55, rotOpen);
      addBox(goldParts, leafW * 0.92, 0.13, 0.28, lx, leafH * 0.24, doorZ - 0.55, rotOpen);
    }

    // Grounded foundation apron under every central stone pier section
    const [wx, wz] = localToWorld(p.x, gateZ);
    const localSink = Math.max(1.2, yBase - ctx.getHeight(wx, wz) + 1.5);
    addBox(stoneParts, p.w + 0.25, localSink, rampartDepth + 0.8, p.x, -localSink * 0.5 + 0.08, gateZ);
  }

  // Outer shoulder bastions linking central stone section (±12.4m) to outer U-edge (±28.9m -> total 57.8m width)
  // Built in weathered imperial brick with ~8° inward batter
  for (const side of [-1, 1]) {
    const shW = 16.5;
    const shX = side * (12.4 + shW * 0.5); // ±20.65
    const [wx, wz] = localToWorld(shX, gateZ);
    const sink = Math.max(1.2, yBase - ctx.getHeight(wx, wz) + 1.5);
    addBox(stoneParts, shW + 0.2, sink, rampartDepth + 0.6, shX, -sink * 0.5 + 0.08, gateZ);
    addBatteredBox(
      brickParts,
      shW - batter * 0.5,
      shW,
      rampartDepth - batter,
      rampartDepth,
      rampartH,
      shX - side * (batter * 0.25),
      rampartH * 0.5,
      gateZ
    );
  }

  // Forward-wrapping U-shaped wing bastions (18m projecting arms from z = -4.9 to +13.1) in weathered imperial brick
  // with ~8° inward batter, relocated perpendicular arched Tả/Hữu Dịch Môn on INNER side faces,
  // zero invented merlons, and circular white-framed Chữ Thọ ventilation medallions on front faces!
  for (const side of [-1, 1]) {
    const wingX = side * 23.4;
    const wingW = 11.0; // outer face at ±28.9m, inner face at ±17.9m
    const wingLen = 18.0;
    const wingZStart = gateZ + rampartDepth * 0.5; // -4.9
    const wingZ = wingZStart + wingLen * 0.5; // +4.1
    const [wxF, wzF] = localToWorld(wingX, wingZ + 4.5);
    const [wxB, wzB] = localToWorld(wingX, wingZ - 4.5);
    const minGround = Math.min(ctx.getHeight(wxF, wzF), ctx.getHeight(wxB, wzB), yBase);
    const sink = Math.max(1.2, yBase - minGround + 1.5);

    // Grounded stone plinth apron under entire U-wing
    addBox(stoneParts, wingW + 0.4, sink, wingLen + 0.4, wingX, -sink * 0.5 + 0.08, wingZ);

    // Relocated perpendicular arched Tả/Hữu Dịch Môn at z = -1.2 on the INNER face (x = ±17.9, facing ∓X)
    const dichZ = wingZStart + 3.7; // -1.2 (right at inner U-elbow, perpendicular 90° to Chính Môn!)
    const dichSpan = 6.2; // z in [-4.3 .. +1.9]
    const dichOpenW = 2.5;
    const dichOpenH = 2.95;
    const dichSpringY = dichOpenH - dichOpenW * 0.5; // 1.70m

    // Outer solid battered brick core of U-wing behind the inner arched portal recess (x = ±19.8..±28.9)
    const coreW = wingW - 2.2;
    const coreX = side * (17.9 + 2.2 + coreW * 0.5);
    addBatteredBox(
      brickParts,
      coreW - batter * 0.6,
      coreW,
      wingLen - batter * 0.6,
      wingLen,
      rampartH,
      coreX - side * (batter * 0.25),
      rampartH * 0.5,
      wingZ - batter * 0.25
    );

    // Forward inner brick cheek (z = +1.9 .. +13.1, length = 11.2m) battered cleanly
    const fwdLen = wingZStart + wingLen - (dichZ + dichSpan * 0.5); // 11.2m
    const fwdZ = dichZ + dichSpan * 0.5 + fwdLen * 0.5;
    addBatteredBox(
      brickParts,
      2.2,
      2.4,
      fwdLen - batter * 0.5,
      fwdLen,
      rampartH,
      side * 19.1,
      rampartH * 0.5,
      fwdZ - batter * 0.22
    );

    // Arched Tả/Hữu Dịch Môn inner-wing portal wall facing perpendicular 90° into the central U-forecourt
    const dichArchWall = createArchedWallGeometry(dichSpan, rampartH, 2.2, dichOpenW, dichOpenH);
    dichArchWall.rotateY(side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
    dichArchWall.translate(side * 19.0, 0, dichZ);
    brickParts.push(dichArchWall);

    // Prominent pale-white plastered semicircular architrave & pilasters framing Tả/Hữu Dịch Môn (Photo 2 left wing!)
    const archFrameShape = new THREE.Shape();
    const afOuter = dichOpenW * 0.5 + 0.52;
    const afInner = dichOpenW * 0.5 + 0.02;
    archFrameShape.moveTo(-afOuter, 0);
    archFrameShape.lineTo(-afOuter, dichSpringY);
    archFrameShape.absarc(0, dichSpringY, afOuter, Math.PI, 0, true);
    archFrameShape.lineTo(afOuter, 0);
    archFrameShape.lineTo(afInner, 0);
    archFrameShape.lineTo(afInner, dichSpringY);
    archFrameShape.absarc(0, dichSpringY, afInner, 0, Math.PI, false);
    archFrameShape.lineTo(-afInner, 0);
    archFrameShape.closePath();
    const archFrame = new THREE.ExtrudeGeometry(archFrameShape, { depth: 0.24, bevelEnabled: false, curveSegments: 14 });
    archFrame.rotateY(side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
    archFrame.translate(side * 17.88, 0, dichZ);
    plasterArchParts.push(archFrame);

    // Deep dark shadowed arched tunnel void behind Dịch Môn + recessed open doors
    addBox(voidParts, 1.85, dichOpenH * 0.94, dichOpenW * 0.96, side * 19.8, dichOpenH * 0.47, dichZ);
    const dLeafW = dichOpenW * 0.42;
    const dLeafH = dichSpringY - 0.04;
    const dDoorX = side * 19.65;
    for (const dSide of [-1, 1]) {
      const dz = dichZ + dSide * (dichOpenW * 0.42);
      addBox(crimsonParts, 0.22, dLeafH, dLeafW, dDoorX, dLeafH * 0.5, dz, dSide * 1.15);
    }

    // Subtle cornice band & weathered stone coping (NO solid tall bunker wall, NO invented front Chữ Thọ circles!)
    addBox(brickParts, wingW - batter + 0.2, 0.36, wingLen - batter + 0.2, wingX - side * 0.1, rampartH + 0.18, wingZ - 0.2);
    addBox(marbleParts, wingW - batter + 0.48, 0.24, wingLen - batter + 0.48, wingX - side * 0.1, rampartH + 0.48, wingZ - 0.2);
  }

  // Main bastion brick cornice band & weathered stone coping
  addBox(brickParts, 57.4, 0.36, rampartDepth - batter + 0.25, 0, rampartH + 0.18, gateZ);
  addBox(marbleParts, 57.8, 0.24, rampartDepth - batter + 0.55, 0, rampartH + 0.48, gateZ);

  // FIX NM-03: Pure right-to-left Han plaque "門   午" (Ngọ Môn) in weathered stone frame (ref 17_ngo_mon_hue.jpg)
  const ngoMonPlaque = createSignagePlaqueMesh(
    {
      text: '門   午',
      subText: '',
      style: 'royal',
      width: 3.15,
      height: 0.84,
      depth: 0.16,
      motifSeed: 1833
    },
    ctx
  );
  // Chính Môn lintel top is at y = 4.27; parapet top coping is at y = 5.75 -> plaque center at y = 5.02 sits cleanly inside!
  ngoMonPlaque.position.set(0, 5.02, gateZ + (rampartDepth - batter) * 0.5 + 0.14);
  group.add(ngoMonPlaque);

  // Ceremonial weathered grey Thanh stone forecourt paving FLUSH with flat bridge deck (y_top = 0.54 -> ZERO rubble step bar in Photo 2!)
  addBox(stoneParts, 72.0, 0.90, 29.0, 0, 0.09, 6.2);
  addBox(marbleParts, 16.0, 0.12, 26.0, 0, 0.50, 6.5);
  addBox(batTrangParts, 4.4, 0.18, 22.0, 14.8, 0.08, -32.0);

  // 2. Lầu Ngũ Phụng (2-Story Five Phoenixes Pavilion) atop the 5.0m bastion (deckY = 5.62m)
  const deckY = rampartH + 0.62;

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
    for (const bxOff of [-stairW * 0.5 - 0.25, stairW * 0.5 + 0.25]) {
      marbleParts.push(
        ...createCarvedDragonBalustradeParts(sx + bxOff, 0.0, zBot - 0.3, sx + bxOff, deckY, zTop, 0.95)
      );
    }
  }

  // Warm weathered terracotta-brick pierced balustrades rimming the bastion forecourt edge with weathered stone piers (Photo 2!)
  const forecourtEdgeZ = gateZ + (rampartDepth - batter) * 0.5 - 0.15;
  terracottaBalParts.push(
    ...createPiercedBalustradeParts(-17.8, forecourtEdgeZ, 17.8, forecourtEdgeZ, deckY, 0.96, 'hoa_chanh_ceramic')
  );
  for (const side of [-1, 1]) {
    terracottaBalParts.push(
      ...createPiercedBalustradeParts(
        side * 18.1,
        forecourtEdgeZ,
        side * 18.1,
        gateZ + rampartDepth * 0.5 + 17.3,
        deckY,
        0.96,
        'hoa_chanh_ceramic'
      ),
      ...createPiercedBalustradeParts(
        side * 18.1,
        gateZ + rampartDepth * 0.5 + 17.3,
        side * 28.0,
        gateZ + rampartDepth * 0.5 + 17.3,
        deckY,
        0.96,
        'hoa_chanh_ceramic'
      ),
      ...createPiercedBalustradeParts(
        side * 28.2,
        gateZ - 4.0,
        side * 28.2,
        gateZ + rampartDepth * 0.5 + 17.3,
        deckY,
        0.96,
        'hoa_chanh_ceramic'
      )
    );
    // Rhythmic weathered stone square balustrade corner/bay piers (Photo 2!)
    for (const pz of [-4.6, 1.5, 7.2, 12.6]) {
      addBox(marbleParts, 0.48, 1.10, 0.48, side * 28.2, deckY + 0.55, pz);
      addBox(marbleParts, 0.48, 1.10, 0.48, side * 18.1, deckY + 0.55, pz);
    }
  }

  // Continuous U-shaped Tier-1 Eaves Gallery Platform + Open Wooden Louvered Doorways (*cửa bức bàn / lá sách*)
  addBox(marbleParts, 55.2, 0.42, 9.6, 0, deckY + 0.21, gateZ);
  for (const side of [-1, 1]) {
    addBox(marbleParts, 9.4, 0.42, 17.4, side * 23.3, deckY + 0.21, gateZ + 13.4);
  }
  const hallFloorY = deckY + 0.42;

  // Story 1 Central Hall: open wooden louvered doorways & crimson colonnade (NO solid closed red wall!)
  addBox(crimsonParts, 23.6, 0.55, 6.2, 0, hallFloorY + 3.82, gateZ); // continuous overhead lintel transom
  addBox(crimsonParts, 23.6, 4.05, 0.26, 0, hallFloorY + 2.02, gateZ - 2.95); // rear wall
  for (let bay = -3; bay <= 3; bay++) {
    const bx = bay * 3.2;
    const isCenter = bay === 0;
    const openW = isCenter ? 2.65 : 2.15;
    addBox(voidParts, openW, 3.35, 0.16, bx, hallFloorY + 1.68, gateZ + 2.85);
    // Open louvered wooden panel leaves folded slightly back flanking each doorway
    for (const s of [-1, 1]) {
      addBox(woodParts, 0.48, 3.25, 0.12, bx + s * (openW * 0.5 + 0.18), hallFloorY + 1.62, gateZ + 2.95, s * 0.35);
      // Louver slats on upper half of door leaf
      addBox(crimsonParts, 0.42, 1.15, 0.15, bx + s * (openW * 0.5 + 0.18), hallFloorY + 0.65, gateZ + 2.95, s * 0.35);
    }
  }
  for (let ix = -5; ix <= 5; ix++) {
    const px = ix * 2.52;
    for (const pz of [gateZ - 4.3, gateZ + 4.3]) {
      addCyl(crimsonParts, 0.20, 0.24, 4.1, 10, px, hallFloorY + 2.05, pz);
    }
  }

  // Story 1 Continuous U-Wing Colonnaded Galleries — dark shadowed mahogany colonnade & recessed louvered screens (ZERO bright white cavern!)
  for (const side of [-1, 1]) {
    // Back-wing link bays (x = ±13..±27)
    for (const px of [side * 15.6, side * 19.0, side * 22.8, side * 26.8]) {
      for (const pz of [gateZ - 4.1, gateZ + 4.1]) {
        addCyl(woodParts, 0.19, 0.22, 3.85, 8, px, hallFloorY + 1.92, pz);
      }
    }
    addBox(woodParts, 14.0, 0.44, 5.8, side * 20.0, hallFloorY + 3.66, gateZ);
    // Dark recessed interior timber wall behind back-wing columns so interior reads deep and shadowed like Photo 2
    addBox(voidParts, 13.6, 3.55, 0.32, side * 20.0, hallFloorY + 1.80, gateZ - 1.2);
    // Forward U-arm gallery bays (z = -4.2 .. +12.6) closely spaced dark mahogany columns + front end colonnade silhouettes (Photo 2!)
    for (const pz of [-3.4, -0.6, 2.2, 5.0, 7.8, 10.6, 12.6]) {
      for (const px of [side * 19.2, side * 27.4]) {
        addCyl(woodParts, 0.19, 0.22, 3.85, 8, px, hallFloorY + 1.92, pz);
      }
    }
    for (const px of [side * 21.2, side * 23.3, side * 25.4]) {
      addCyl(woodParts, 0.18, 0.21, 3.85, 8, px, hallFloorY + 1.92, 12.6);
    }
    // Deep shadowed wooden gallery core (recessed behind perimeter columns) & dark louvered inner screens along U-arms (Photo 2!)
    addBox(woodParts, 0.30, 3.8, 16.4, side * 26.8, hallFloorY + 1.9, gateZ + 13.8);
    addBox(woodParts, 8.6, 0.44, 17.2, side * 23.3, hallFloorY + 3.66, gateZ + 13.8);
    addBox(voidParts, 3.4, 3.45, 13.6, side * 23.3, hallFloorY + 1.75, gateZ + 13.2);
    for (const pz of [-1.2, 2.8, 6.8, 10.6]) {
      addBox(voidParts, 0.14, 2.9, 2.2, side * 19.4, hallFloorY + 1.45, pz);
      addBox(woodParts, 0.10, 2.8, 0.55, side * 19.3, hallFloorY + 1.42, pz - 1.25);
      addBox(woodParts, 0.10, 2.8, 0.55, side * 19.3, hallFloorY + 1.42, pz + 1.25);
    }
  }

  // Exact concave hip-ridge generator matching createHueImperialHipRoofGeometry 100.00% (0.0m air gap!)
  const addFlushHipRidges = (
    rx: number,
    y0: number,
    rz: number,
    baseW: number,
    baseD: number,
    topW: number,
    topD: number,
    h: number,
    flare: number,
    tubeR = 0.13,
    finialScale = 1.0
  ) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pts: THREE.Vector3[] = [];
        const samples = 9;
        for (let k = 0; k <= samples; k++) {
          const r = k / samples; // 0 at ridge corner .. 1 at eave corner
          const w = THREE.MathUtils.lerp(topW, baseW, r);
          const d = THREE.MathUtils.lerp(topD, baseD, r);
          const concave = Math.pow(1.0 - r, 1.32);
          const upturn = flare * Math.pow(r, 2.4) * 1.80;
          const py = y0 + concave * h + upturn + 0.08;
          pts.push(new THREE.Vector3(rx + sx * w * 0.5, py, rz + sz * d * 0.5));
        }
        const last = pts[pts.length - 1];
        pts.push(new THREE.Vector3(last.x + sx * 0.24 * finialScale, last.y + 0.28 * finialScale, last.z + sz * 0.24 * finialScale));
        const hipCurve = new THREE.CatmullRomCurve3(pts);
        ceramicParts.push(new THREE.TubeGeometry(hipCurve, 10, tubeR, 5, false));
        const tip = pts[pts.length - 1];
        ceramicParts.push(
          new THREE.ConeGeometry(0.15 * finialScale, 0.42 * finialScale, 5).translate(tip.x, tip.y + 0.12 * finialScale, tip.z)
        );
      }
    }
  };

  // Tier-1 Continuous U-Shaped Eaves Roofs — TRUE wide-ridge imperial hipped roofs (ZERO cone collapse!)
  const cRoof1 = createHueImperialHipRoofGeometry(28.0, 12.2, 17.6, 6.8, 2.75, 0.42, 12, 10);
  cRoof1.translate(0, hallFloorY + 3.92, gateZ);
  centralRoofParts.push(cRoof1);
  addBox(woodParts, 27.6, 0.26, 11.8, 0, hallFloorY + 3.88, gateZ);

  for (const side of [-1, 1]) {
    const bwRoof1 = createHueImperialHipRoofGeometry(15.6, 10.6, 11.8, 6.4, 2.35, 0.36, 10, 8);
    bwRoof1.translate(side * 20.8, hallFloorY + 3.76, gateZ);
    jadeRoofParts.push(bwRoof1);
    addBox(woodParts, 15.2, 0.24, 10.2, side * 20.8, hallFloorY + 3.72, gateZ);

    const armRoof1 = createHueImperialHipRoofGeometry(10.8, 18.2, 6.2, 13.8, 2.50, 0.40, 10, 8);
    armRoof1.translate(side * 23.3, hallFloorY + 3.76, 3.9);
    jadeRoofParts.push(armRoof1);
    addBox(woodParts, 10.4, 0.24, 17.8, side * 23.3, hallFloorY + 3.72, 3.9);
    addFlushHipRidges(side * 23.3, hallFloorY + 3.76, 3.9, 10.8, 18.2, 6.2, 13.8, 2.50, 0.40, 0.11, 0.85);
  }

  // Enamel *Nhất Thi Nhất Họa* frieze (Cổ diêm Pháp lam) mounted cleanly between Tier-1 roof & Tier-2 eaves
  const upperFloorY = hallFloorY + 5.15;
  for (const fz of [gateZ + 3.45, gateZ - 3.45]) {
    const rotY = fz > gateZ ? 0 : Math.PI;
    for (const fx of [-4.2, 4.2]) {
      const frieze = createSignagePlaqueMesh(
        {
          text: '',
          style: 'nhat_thi_nhat_hoa',
          width: 7.6,
          height: 0.72,
          depth: 0.14,
          motifSeed: 1833 + Math.round(fx * 10 + fz)
        },
        ctx
      );
      frieze.position.set(fx, upperFloorY + 2.92, fz);
      frieze.rotation.y = rotY;
      group.add(frieze);
    }
  }

  // Story 2 Central Royal Hall (Pavilion #1 of 9 — Hoàng Lưu Ly)
  addBox(crimsonParts, 16.0, 0.24, 6.8, 0, upperFloorY + 0.12, gateZ);
  addBox(crimsonParts, 15.6, 3.25, 0.24, 0, upperFloorY + 1.72, gateZ - 2.8);
  addBox(crimsonParts, 15.8, 0.22, 6.6, 0, upperFloorY + 3.35, gateZ);

  jadeRoofParts.push(
    ...createPiercedBalustradeParts(-7.6, gateZ + 3.2, -2.0, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van'),
    ...createPiercedBalustradeParts(2.0, gateZ + 3.2, 7.6, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van'),
    ...createPiercedBalustradeParts(-7.6, gateZ - 2.8, -7.6, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van'),
    ...createPiercedBalustradeParts(7.6, gateZ - 2.8, 7.6, gateZ + 3.2, upperFloorY + 0.22, 0.88, 'chu_van')
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
    const px = ix * 2.45;
    for (const pz of [gateZ - 3.3, gateZ + 3.3]) {
      addCyl(crimsonParts, 0.18, 0.21, 3.4, 10, px, upperFloorY + 1.7, pz);
    }
  }

  // Pavilion #1 Tier-2 Roof (MASSIVE BROAD Fiery Imperial Golden-Orange Hoàng Lưu Ly + 0.00m-gap flush hip ridges!)
  const cRoof2H = 4.25;
  const cRoof2 = createHueImperialHipRoofGeometry(21.6, 10.4, 11.4, 1.4, cRoof2H, 0.56, 14, 10);
  cRoof2.translate(0, upperFloorY + 3.35, gateZ);
  centralRoofParts.push(cRoof2);

  addBox(ceramicParts, 11.6, 0.36, 0.44, 0, upperFloorY + 3.35 + cRoof2H + 0.04, gateZ);
  addBox(goldParts, 11.4, 0.12, 0.48, 0, upperFloorY + 3.35 + cRoof2H + 0.24, gateZ);
  addBox(woodParts, 21.0, 0.28, 9.8, 0, upperFloorY + 3.30, gateZ);
  addFlushHipRidges(0, upperFloorY + 3.35, gateZ, 21.6, 10.4, 11.4, 1.4, cRoof2H, 0.56, 0.14, 1.05);
  const centralFinials = createRoofFinialSetParts(0, upperFloorY + 3.35 + cRoof2H + 0.16, gateZ, 11.4, 0, 1.32, true);
  ceramicParts.push(...centralFinials.mainParts);
  goldParts.push(...centralFinials.goldParts);

  // Pavilions #2–#9: 8 Deep Emerald-Jade Thanh Lưu Ly Wing Pavilions with enclosed crimson louvered upper walls,
  // steep tiled roofs, dark timber eave soffits, and dense ceramic-mosaic ridge crests, hip ridges & gable pediments (Photo 2!)
  const wingPavSpecs = [
    { x: -13.2, z: gateZ, w: 6.8, d: 6.6, roofW: 8.2, roofD: 7.8, role: 'inner' as const, yOff: 0.05 },
    { x: 13.2, z: gateZ, w: 6.8, d: 6.6, roofW: 8.2, roofD: 7.8, role: 'inner' as const, yOff: 0.05 },
    { x: -22.8, z: gateZ, w: 7.6, d: 7.0, roofW: 9.2, roofD: 8.4, role: 'bell' as const, yOff: 0.25 },
    { x: 22.8, z: gateZ, w: 7.6, d: 7.0, roofW: 9.2, roofD: 8.4, role: 'drum' as const, yOff: 0.25 },
    { x: -23.3, z: -0.6, w: 6.8, d: 6.2, roofW: 8.4, roofD: 7.6, role: 'wing' as const, yOff: -0.05 },
    { x: 23.3, z: -0.6, w: 6.8, d: 6.2, roofW: 8.4, roofD: 7.6, role: 'wing' as const, yOff: -0.05 },
    { x: -23.3, z: 8.4, w: 7.4, d: 6.8, roofW: 9.2, roofD: 8.4, role: 'wing' as const, yOff: 0.20 },
    { x: 23.3, z: 8.4, w: 7.4, d: 6.8, roofW: 9.2, roofD: 8.4, role: 'wing' as const, yOff: 0.20 }
  ];

  for (const wp of wingPavSpecs) {
    const wUpperY = hallFloorY + 4.78 + wp.yOff;
    const uW = wp.w * 0.84;
    const uD = wp.d * 0.84;
    const uColH = wp.role === 'bell' || wp.role === 'drum' ? 3.25 : 2.95;
    addBox(crimsonParts, uW + 0.25, 0.24, uD + 0.25, wp.x, wUpperY + 0.12, wp.z);

    // Enclose Tier-2 wing walls with dark-crimson slatted wooden louver panels (`cửa lá sách`) + warm gold transom (Photo 2!)
    if (wp.role !== 'bell' && wp.role !== 'drum') {
      addBox(crimsonParts, uW * 0.86, uColH * 0.88, uD * 0.86, wp.x, wUpperY + 0.24 + uColH * 0.44, wp.z);
      addBox(goldParts, uW * 0.90, 0.22, uD * 0.90, wp.x, wUpperY + 0.24 + uColH - 0.32, wp.z);
      for (let lv = 0; lv < 4; lv++) {
        const ly = wUpperY + 0.82 + lv * 0.48;
        addBox(woodParts, uW * 0.89, 0.08, uD * 0.89, wp.x, ly, wp.z);
      }
    }

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
    addBox(woodParts, wp.roofW * 0.92, 0.24, wp.roofD * 0.92, wp.x, wUpperY + 0.20 + uColH, wp.z);

    const balY = wUpperY + 0.24;
    terracottaBalParts.push(
      ...createPiercedBalustradeParts(wp.x - hx, wp.z + hz, wp.x + hx, wp.z + hz, balY, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x - hx, wp.z - hz, wp.x + hx, wp.z - hz, balY, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x - hx, wp.z - hz, wp.x - hx, wp.z + hz, balY, 0.78, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x + hx, wp.z - hz, wp.x + hx, wp.z + hz, balY, 0.78, 'chu_van')
    );

    if (wp.role === 'bell') {
      addCyl(crimsonParts, 0.10, 0.12, 2.55, 8, wp.x - 1.1, balY + 1.28, wp.z);
      addCyl(crimsonParts, 0.10, 0.12, 2.55, 8, wp.x + 1.1, balY + 1.28, wp.z);
      addBox(crimsonParts, 2.55, 0.20, 0.24, wp.x, balY + 2.52, wp.z);
      bronzeParts.push(...createBronzeBellParts(wp.x, balY + 0.88, wp.z, 1.2));
    } else if (wp.role === 'drum') {
      addCyl(crimsonParts, 0.10, 0.12, 1.5, 8, wp.x - 0.9, balY + 0.75, wp.z);
      addCyl(crimsonParts, 0.10, 0.12, 1.5, 8, wp.x + 0.9, balY + 0.75, wp.z);
      addBox(crimsonParts, 2.05, 0.18, 0.22, wp.x, balY + 0.80, wp.z);
      addCyl(woodParts, 0.78, 0.78, 1.42, 14, wp.x, balY + 1.52, wp.z, Math.PI * 0.5, 0);
      addCyl(marbleParts, 0.72, 0.72, 0.08, 14, wp.x, balY + 1.52, wp.z - 0.71, Math.PI * 0.5, 0);
      addCyl(marbleParts, 0.72, 0.72, 0.08, 14, wp.x, balY + 1.52, wp.z + 0.71, Math.PI * 0.5, 0);
      addCyl(goldParts, 0.80, 0.80, 0.11, 14, wp.x, balY + 1.52, wp.z - 0.65, Math.PI * 0.5, 0);
      addCyl(goldParts, 0.80, 0.80, 0.11, 14, wp.x, balY + 1.52, wp.z + 0.65, Math.PI * 0.5, 0);
    }

    // Full-Bodied Deep Emerald-Jade Thanh Lưu Ly Roof + 0.00m-Gap Flush Ceramic-Mosaic Hip Ridges (Photo 2!)
    const wRoof2Y = wUpperY + 0.24 + uColH;
    const wRoof2H = wp.role === 'bell' || wp.role === 'drum' ? 3.45 : 3.10;
    const wRoof2 = createHueImperialHipRoofGeometry(wp.roofW, wp.roofD, 3.0, 1.2, wRoof2H, 0.46, 10, 8);
    wRoof2.translate(wp.x, wRoof2Y, wp.z);
    jadeRoofParts.push(wRoof2);
    addBox(ceramicParts, 3.2, 0.34, 0.38, wp.x, wRoof2Y + wRoof2H + 0.12, wp.z);
    const wingFinials = createRoofFinialSetParts(wp.x, wRoof2Y + wRoof2H + 0.16, wp.z, 3.2, 0, 0.86, true);
    ceramicParts.push(...wingFinials.mainParts);
    goldParts.push(...wingFinials.goldParts);
    addFlushHipRidges(wp.x, wRoof2Y, wp.z, wp.roofW, wp.roofD, 3.0, 1.2, wRoof2H, 0.46, 0.12, 0.88);
  }

  // 2.5. Relocate 9 Cửu Đỉnh Imperial Bronze Urns + Cycad Bed to REAR courtyard behind Ngọ Môn (z = -24..-44, historically accurate near Hiển Lâm Các!)
  for (let i = 0; i < 9; i++) {
    const isCaoDinh = i === 4;
    const ux = 14.4 + (isCaoDinh ? 0.75 : 0);
    const uz = -24.0 - i * 2.55;
    addBox(marbleParts, 1.85, 0.14, 1.85, ux, 0.22, uz);
    const urn = createImperialUrnParts(ux, 0.29, uz, isCaoDinh ? 1.24 : 1.14);
    stoneParts.push(...urn.stoneParts);
    cuuDinhParts.push(...urn.bronzeParts);
  }
  addBox(brickParts, 1.8, 0.28, 20.0, 11.4, 0.22, -34.0);

  // 2.55. HIỂN LÂM CÁC (3-Tiered 17m Monumental Imperial Memorial Pavilion behind Cửu Đỉnh — ref 113_dai_noi_hue_hien_lam_cac.jpg!)
  //       + Lầu Ngũ Phụng 1st-Floor Royal Palanquin (*Kiệu Hoàng Đế*) & Ngọ Môn Portal Ceiling Cross-Beams (ref 111 & 112!)
  const hlcX = 22.8;
  const hlcZ = -18.5;
  addBox(stoneParts, 15.6, 0.85, 11.4, hlcX, 0.42, hlcZ);
  addBox(batTrangParts, 15.0, 0.10, 10.8, hlcX, 0.88, hlcZ);
  // Tier 1: open central 3-bay crimson colonnade flanked by yellow-brick side chambers with pierced lattice windows (ref 113)
  const hlcY0 = 0.92;
  for (const side of [-1, 1]) {
    addBox(brickParts, 3.8, 3.8, 7.8, hlcX + side * 5.2, hlcY0 + 1.9, hlcZ);
    addBox(marbleParts, 1.35, 1.15, 0.16, hlcX + side * 5.2, hlcY0 + 2.1, hlcZ + 3.92);
  }
  for (const cxOff of [-2.8, -0.95, 0.95, 2.8]) {
    for (const czOff of [-3.6, 3.6]) {
      addCyl(crimsonParts, 0.18, 0.22, 3.8, 8, hlcX + cxOff, hlcY0 + 1.9, hlcZ + czOff);
    }
  }
  const hlcRoof1 = createVietnameseCurvedRoofGeometry(16.8, 12.2, 11.2, 6.8, 2.15, 0.48);
  hlcRoof1.translate(hlcX, hlcY0 + 3.8, hlcZ);
  centralRoofParts.push(hlcRoof1);
  // Tier 2: crimson timber gallery with pierced balustrade & Hoàng Lưu Ly roof
  const hlcY1 = hlcY0 + 5.35;
  addBox(crimsonParts, 10.2, 2.85, 6.6, hlcX, hlcY1 + 1.42, hlcZ);
  addBox(woodParts, 10.8, 0.55, 7.2, hlcX, hlcY1 + 0.35, hlcZ);
  const hlcRoof2 = createVietnameseCurvedRoofGeometry(12.2, 8.8, 6.8, 3.8, 2.05, 0.52);
  hlcRoof2.translate(hlcX, hlcY1 + 2.85, hlcZ);
  centralRoofParts.push(hlcRoof2);
  // Tier 3: crowning sacred chamber & golden dragon ridge finials reaching ~16.8m
  const hlcY2 = hlcY1 + 4.35;
  addBox(crimsonParts, 6.2, 2.45, 4.2, hlcX, hlcY2 + 1.22, hlcZ);
  const hlcRoof3 = createVietnameseCurvedRoofGeometry(8.2, 6.2, 3.2, 1.2, 2.35, 0.58);
  hlcRoof3.translate(hlcX, hlcY2 + 2.45, hlcZ);
  centralRoofParts.push(hlcRoof3);
  const hlcFinials = createRoofFinialSetParts(hlcX, hlcY2 + 4.82, hlcZ, 3.4, 0, 0.82, true);
  centralRoofParts.push(...hlcFinials.mainParts);
  goldParts.push(...hlcFinials.goldParts);

  // Interior Stone Lintel Ceiling Cross-Beams inside Ngọ Môn's 3 central portals + Gilded Royal Palanquin (*Kiệu Bát Cống*) inside Story 1 of Lầu Ngũ Phụng
  for (const p of centralPortals) {
    for (let bz = -3.6; bz <= 3.6; bz += 1.8) {
      addBox(stoneParts, p.openW, 0.24, 0.32, p.x, p.openH - 0.12, gateZ + bz);
    }
  }
  addBox(goldParts, 3.6, 0.16, 1.45, 0, hallFloorY + 0.65, gateZ); // palanquin carrying poles
  addBox(crimsonParts, 1.55, 1.25, 1.25, 0, hallFloorY + 1.32, gateZ);
  const kieuRoof = createVietnameseCurvedRoofGeometry(2.1, 1.85, 0.6, 0.5, 0.72, 0.28);
  kieuRoof.translate(0, hallFloorY + 1.95, gateZ);
  goldParts.push(kieuRoof);
  // Carved Imperial Dragon Screen (*Bình Phong Sơn Son Thếp Vàng*) & flanking *Bát Bửu* gilded weapon stands inside Lầu Ngũ Phụng
  addBox(crimsonParts, 3.8, 2.35, 0.18, 0, hallFloorY + 1.22, gateZ - 2.35);
  addBox(goldParts, 3.96, 0.16, 0.24, 0, hallFloorY + 2.42, gateZ - 2.35);
  for (const side of [-1, 1]) {
    addBox(crimsonParts, 0.28, 0.92, 1.55, side * 3.1, hallFloorY + 0.46, gateZ - 0.8);
    for (const wz of [-0.55, -0.18, 0.18, 0.55]) {
      addCyl(goldParts, 0.025, 0.03, 2.55, 5, side * 3.1, hallFloorY + 1.32, gateZ - 0.8 + wz);
    }
    // Carved stone lotus plinths (`HV-C02`) flanking the Hiển Lâm Các ceremonial stair approach
    addBox(stoneParts, 0.95, 0.65, 0.95, hlcX + side * 3.4, 0.75, hlcZ + 6.4);
    stoneParts.push(...createLotusPetalRingParts(hlcX + side * 3.4, 1.12, hlcZ + 6.4, 0.36, 10, 1, false));
    addCyl(goldParts, 0.28, 0.22, 0.72, 8, hlcX + side * 3.4, 1.42, hlcZ + 6.4);
    // Phượng hoàng (`HV-B01`) & Chữ Thọ (`HV-D02`) adorning Lầu Ngũ Phụng & Hiển Lâm Các
    goldParts.push(...createPhoenixFinialParts(side * 6.5, hallFloorY + 4.95, gateZ, side < 0 ? 0.5 : -0.5, 0.78, 'single'));
    marbleParts.push(...createShouCharacterParts(hlcX + side * 5.2, hlcY0 + 2.1, hlcZ + 4.02, 0.36, 'tron', 0));
  }
  // P0/P1 Đại Nội Huế Motif Upgrades (MOTIF_PLAN_MIEN_TRUNG.md MT-001..MT-022):
  // - Hemispherical bronze door studs (`HV-D14`) on Ngọ Môn central portals
  // - Carved Cửa Võng (`HV-D12`) inside Lầu Ngũ Phụng + Key-fret (`HV-D01`) & Wave (`HV-D06`) bands along Đại Triều terrace
  // - Cửu Đỉnh bas-relief panels (`HV-E05`) on Hiển Lâm Các forecourt plinth
  bronzeParts.push(
    ...createDoorStudGridParts(-1.25, 2.25, gateZ + 4.15, 1.5, 2.8, 5, 4, 0),
    ...createDoorStudGridParts(1.25, 2.25, gateZ + 4.15, 1.5, 2.8, 5, 4, 0)
  );
  goldParts.push(...createCuaVongParts(0, hallFloorY + 3.25, gateZ + 2.35, 3.8, 0.85, 0, 'long_phung'));
  bronzeParts.push(...createBasReliefPanelParts(hlcX, 0.52, hlcZ + 5.78, 3.2, 0.72, 0, 'cuu_dinh'));
  stoneParts.push(
    ...createMotifBandParts('hoi_van', -12.0, gateZ + 5.65, 12.0, gateZ + 5.65, 0.35, 0.16, 0.05),
    ...createMotifBandParts('song_nuoc', hlcX - 7.5, hlcZ + 5.72, hlcX + 7.5, hlcZ + 5.72, 0.25, 0.14, 0.05)
  );
  tagMotifIds(group, [
    'HV-A03', 'HV-A04', 'HV-A06', 'HV-B01', 'HV-B03', 'HV-C02', 'HV-C03', 'HV-C13',
    'HV-D01', 'HV-D02', 'HV-D04', 'HV-D06', 'HV-D10', 'HV-D12', 'HV-D14', 'HV-D15',
    'HV-E05', 'HV-E06', 'HV-H11', 'HV-I01', 'HV-J01', 'HV-J02', 'HV-J03', 'HV-J04',
    'HV-NEW-MT-15', 'HV-NEW-MT-16'
  ]);

  // 2.6. Relocate 8 Nguyễn Dynasty Bronze Cannons (*Thần Công*) out of immediate U-forecourt to outer terrace flanks (clean Photo 2 plaza!)
  const cannonPlacements: Array<[number, number, number]> = [
    [-21.0, 44.5, 0],
    [-25.5, 44.5, 0],
    [-30.0, 44.5, 0],
    [-34.5, 44.5, 0],
    [21.0, 44.5, 0],
    [25.5, 44.5, 0],
    [30.0, 44.5, 0],
    [34.5, 44.5, 0]
  ];
  for (const [canX, canZ, canRot] of cannonPlacements) {
    const [cwx, cwz] = localToWorld(canX, canZ);
    const cy = Math.max(0.08, ctx.getHeight(cwx, cwz) - yBase + 0.06);
    for (const sx of [-0.42, 0.42]) {
      addBox(crimsonParts, 0.16, 0.65, 2.35, canX + sx, cy + 0.56, canZ, canRot);
      for (const wz of [-0.68, 0.68]) {
        addCyl(woodParts, 0.34, 0.34, 0.14, 12, canX + sx * 1.32, cy + 0.34, canZ + wz, 0, 0, Math.PI * 0.5);
      }
    }
    addBox(woodParts, 0.86, 0.18, 1.85, canX, cy + 0.45, canZ, canRot);
    addCyl(bronzeParts, 0.15, 0.24, 3.15, 12, canX, cy + 0.96, canZ + 0.28, Math.PI * 0.5 - 0.08, canRot);
    addCyl(bronzeParts, 0.11, 0.11, 1.15, 8, canX, cy + 0.94, canZ + 0.10, 0, 0, Math.PI * 0.5);
    const cascabel = new THREE.SphereGeometry(0.14, 8, 6);
    cascabel.translate(canX, cy + 0.84, canZ - 1.35);
    bronzeParts.push(cascabel);
  }

  // 2.7. Photo 2 Foreground Landscape: TWO Dense Solid Rounded Emerald Ornamental Bushes (matte dark-forest core + 110 densely packed leafAtlas cards!)
  const bushCoreParts: THREE.BufferGeometry[] = [];
  const addSculptedDomeBush = (bx: number, bz: number, rx: number, ry: number, rz: number, seed: number, dense = true) => {
    const shades = ['#184b16', '#21611e', '#2c7826', '#388e2e', '#4ba338'];
    const bRand = mulberry32(seed);
    // Opaque irregular dark-forest-green interior shadow core (matte roughness 0.96 -> ZERO see-through gaps, ZERO plastic sheen!)
    const core = new THREE.DodecahedronGeometry(1.0, 1);
    core.scale(rx * 0.72, ry * 0.70, rz * 0.72);
    core.translate(bx, ry * 0.48, bz);
    bushCoreParts.push(colorizeForMerge(core, '#123910'));
    const cardCount = dense ? 108 : 54;
    for (let k = 0; k < cardCount; k++) {
      const ang = (k / cardCount) * Math.PI * 2 * 5.0 + bRand() * 0.6;
      const elev = Math.pow(bRand(), 0.72);
      const dist = 0.45 + (1.0 - elev * 0.62) * 0.52;
      const px = bx + Math.cos(ang) * rx * dist;
      const pz = bz + Math.sin(ang) * rz * dist;
      const py = 0.55 + elev * ry * 0.82;
      const cardW = (1.35 + bRand() * 0.65) * Math.min(rx, rz) * 0.46;
      const cardH = (1.25 + bRand() * 0.55) * ry * 0.34;
      const card = new THREE.PlaneGeometry(cardW, cardH);
      card.rotateX((bRand() - 0.5) * 0.85);
      card.rotateY(bRand() * Math.PI * 2);
      card.rotateZ((bRand() - 0.5) * 0.45);
      card.translate(px, py, pz);
      foliageParts.push(colorizeForMerge(card, shades[Math.floor(bRand() * shades.length)]));
    }
  };
  // Two iconic rounded solid emerald bushes on right forecourt terrace (unobstructing all 3 Thanh stone portals!)
  addSculptedDomeBush(16.6, 16.0, 2.35, 3.65, 2.25, 18331, true);
  addSculptedDomeBush(23.8, 16.2, 2.55, 4.10, 2.35, 18332, true);
  addSculptedDomeBush(26.8, 14.8, 1.90, 2.95, 1.90, 18333, true);

  // Lush leafy green tropical canopy trees framing far-left wing (screening distant pagoda!) AND behind far-right brick wall (Photo 2!)
  for (const [lx, lz, sc, sd] of [
    [-36.5, -12.0, 1.45, 701],
    [-42.0, -2.0, 1.60, 702],
    [-38.0, 8.0, 1.45, 703],
    [-44.5, 10.0, 1.75, 708],
    [-46.0, 16.5, 1.65, 709],
    [35.0, -14.0, 1.30, 704],
    [34.5, 2.0, 1.35, 705],
    [38.0, 9.5, 1.45, 706],
    [39.5, 14.2, 1.25, 707]
  ]) {
    addCyl(woodParts, 0.24 * sc, 0.38 * sc, 4.4 * sc, 6, lx, 2.2 * sc, lz);
    addSculptedDomeBush(lx, lz, 3.4 * sc, 4.4 * sc, 3.4 * sc, sd, false);
  }
  // Low weathered reddish-brick citadel wall section at far-right terrace edge (Photo 2 right edge!)
  addBox(brickParts, 8.5, 3.4, 1.2, 34.5, 1.7, 13.8);
  addBox(marbleParts, 8.8, 0.22, 1.4, 34.5, 3.5, 13.8);

  // Vintage Dark-Iron 3-Globe Heritage Lamp Posts with graceful curved scroll arms & delicate opal globes (Photo 2!)
  for (const [lx, lz] of [
    [25.8, 18.0],
    [13.2, 15.6],
    [-23.2, 16.4]
  ]) {
    addCyl(bronzeParts, 0.13, 0.20, 0.65, 8, lx, 0.325, lz);
    addCyl(bronzeParts, 0.055, 0.085, 4.65, 8, lx, 2.95, lz);
    // Graceful curved scroll arms cradling the 2 outer opal globes
    for (const s of [-1, 1]) {
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(lx, 4.95, lz),
        new THREE.Vector3(lx + s * 0.24, 4.86, lz),
        new THREE.Vector3(lx + s * 0.44, 5.20, lz)
      ]);
      bronzeParts.push(new THREE.TubeGeometry(armCurve, 6, 0.025, 5, false));
    }
    for (const gxOff of [-0.44, 0, 0.44]) {
      const gy = gxOff === 0 ? 5.48 : 5.34;
      const globe = new THREE.SphereGeometry(0.135, 10, 8);
      globe.translate(lx + gxOff, gy, lz);
      lampGlobeParts.push(globe);
    }
  }

  // 3. Pulled-Forward Kim Thủy / Thái Dịch Moat (z = 20.5..39.5, tight 7.4m forecourt matching Photo 2!)
  //    SPLIT front embankment at bridge entry (ZERO rubble bar crossing roadway!) + excavated mirror water + 60 dark lily pads!
  const bridgeZStart = 20.5;
  const bridgeZEnd = 39.5;
  const bridgeLen = bridgeZEnd - bridgeZStart; // 19m
  const bridgeMidZ = (bridgeZStart + bridgeZEnd) * 0.5; // 30.0
  const bridgeWidth = 9.4;

  const moatRimW = 68.0;
  // Split front rubble embankment left & right of bridge opening so bridge roadway passes through 100% cleanly!
  const sideEmbankW = (moatRimW - bridgeWidth) * 0.5; // 29.3m each side
  const sideEmbankX = bridgeWidth * 0.5 + sideEmbankW * 0.5; // ±19.35m
  for (const s of [-1, 1]) {
    addBox(moatRubbleParts, sideEmbankW, 2.45, 1.65, s * sideEmbankX, -0.78, bridgeZStart - 0.55);
    addBox(marbleParts, sideEmbankW + 0.2, 0.24, 1.85, s * sideEmbankX, 0.48, bridgeZStart - 0.55);
    addBox(moatRubbleParts, sideEmbankW, 2.45, 1.65, s * sideEmbankX, -0.78, bridgeZEnd + 0.55);
  }
  for (const mxSide of [-moatRimW * 0.5, moatRimW * 0.5]) {
    addBox(moatRubbleParts, 1.65, 2.45, bridgeLen + 2.4, mxSide, -0.78, bridgeMidZ);
  }
  // Right-side L-corner rubble embankment turning cleanly back along +X flank (Photo 2 iconic moat corner!)
  addBox(moatRubbleParts, 1.65, 2.45, 12.0, 31.5, -0.78, bridgeZStart - 6.2);
  addBox(marbleParts, 1.85, 0.24, 12.2, 31.5, 0.48, bridgeZStart - 6.2);
  stoneParts.push(
    ...createPiercedBalustradeParts(-31.5, bridgeZStart - 0.55, -bridgeWidth * 0.5 - 0.3, bridgeZStart - 0.55, 0.60, 0.88, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(bridgeWidth * 0.5 + 0.3, bridgeZStart - 0.55, 31.5, bridgeZStart - 0.55, 0.60, 0.88, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(31.5, bridgeZStart - 0.55, 31.5, bridgeZStart - 12.0, 0.60, 0.88, 'hoa_chanh_ceramic')
  );
  // Corner square stone balustrade posts along moat embankment (Photo 2!)
  for (const px of [-24, -14, -5.2, 5.2, 13.5, 22.5, 31.5]) {
    addBox(marbleParts, 0.44, 1.02, 0.44, px, 1.04, bridgeZStart - 0.55);
  }

  // Mirror-reflective dark-emerald Kim Thủy Moat Water surface at y = -0.72 (~1.2m tall dark mossy rubble bank rising cleanly above water!)
  const moatWaterY = -0.72;
  const moatWaterGeo = new THREE.PlaneGeometry(moatRimW - 1.4, bridgeLen - 0.6);
  const useLiveMirror =
    typeof window !== 'undefined' &&
    Boolean(ctx.renderer && ctx.renderer.domElement && ctx.renderer.domElement.width > 0);
  let moatWaterObj: THREE.Object3D;
  if (useLiveMirror) {
    // True real-time planar mirror Reflector (Photo 2 exact mirror reflection of fiery orange roof, emerald bushes, rubble bank & cumulus sky!)
    const reflector = new Reflector(moatWaterGeo, {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x566c72
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, moatWaterY, bridgeMidZ);
    moatWaterObj = reflector;
  } else {
    moatWaterGeo.rotateX(-Math.PI / 2);
    moatWaterGeo.translate(0, moatWaterY, bridgeMidZ);
    const moatWaterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.granite;
    const mMesh = new THREE.Mesh(moatWaterGeo, moatWaterMat);
    mMesh.receiveShadow = true;
    moatWaterObj = mMesh;
  }

  // 120 Subtle natural flat dark-olive lily/lotus pads clustered tightly along rubble bank & bridge arch shadow (Photo 2!)
  const moatRand = mulberry32(180205);
  for (let i = 0; i < 120; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const clusterNearBank = i < 70;
    const lx = side * (clusterNearBank ? 5.1 + moatRand() * 11.5 : 5.4 + moatRand() * 24.0);
    const lz = clusterNearBank
      ? bridgeZStart + 0.6 + moatRand() * 5.8
      : bridgeZStart + 0.9 + moatRand() * (bridgeLen - 1.8);
    const padR = 0.24 + moatRand() * 0.22;
    const pad = createNotchedLotusPadGeometry(padR, 9);
    pad.rotateY(moatRand() * Math.PI * 2);
    pad.translate(lx, moatWaterY + 0.03, lz);
    lotusLeafParts.push(pad);
  }

  // FIX P0-02: Bridge piers & arch wall strictly BELOW deck soffit (pierZs[0] tucked under bridge at +0.9m -> ZERO rubble step bar on forecourt!)
  const numArches = 3;
  const archSpan = bridgeLen / numArches;
  const pierZs = [
    bridgeZStart + 1.1,
    bridgeZStart + archSpan,
    bridgeZStart + archSpan * 2.0,
    bridgeZEnd - 1.1
  ];
  for (const pz of pierZs) {
    const [wx, wz] = localToWorld(0, pz);
    const groundOffset = ctx.getHeight(wx, wz) - yBase;
    const botY = Math.min(-2.4, groundOffset - 2.2);
    const pierTopY = 0.22;
    const pierH = pierTopY - botY;
    addBox(moatRubbleParts, bridgeWidth + 0.2, pierH, 1.35, 0, botY + pierH * 0.5, pz);
  }

  // Flat courtyard-level Cầu Trung Đạo stone bridge with dark semicircular water arch (top y <= 0.34 -> 100% below stone roadway!)
  const centralArchWall = createArchedWallGeometry(bridgeLen - 1.4, 1.38, bridgeWidth - 0.25, 4.8, 1.05);
  centralArchWall.rotateY(Math.PI * 0.5);
  centralArchWall.translate(0, -1.04, bridgeMidZ);
  moatRubbleParts.push(centralArchWall);

  const bridgeSegs = 10;
  for (let s = 0; s < bridgeSegs; s++) {
    const tm = (s + 0.5) / bridgeSegs;
    const bz = THREE.MathUtils.lerp(bridgeZStart, bridgeZEnd, tm);
    const crownY = 0.42 + 0.05 * Math.sin(tm * Math.PI);
    const segLen = (bridgeLen / bridgeSegs) + 0.12;
    addBox(stoneParts, bridgeWidth, 0.28, segLen, 0, crownY, bz);
  }
  const balSegs = 5;
  for (let bs = 0; bs < balSegs; bs++) {
    const t0 = bs / balSegs;
    const t1 = (bs + 1) / balSegs;
    const z0 = THREE.MathUtils.lerp(bridgeZStart, bridgeZEnd, t0);
    const z1 = THREE.MathUtils.lerp(bridgeZStart, bridgeZEnd, t1);
    const by = 0.64 + 0.10 * Math.sin(((t0 + t1) * 0.5) * Math.PI);
    for (const bx of [-bridgeWidth * 0.5 + 0.24, bridgeWidth * 0.5 - 0.24]) {
      stoneParts.push(...createPiercedBalustradeParts(bx, z0, bx, z1, by, 0.86, 'hoa_chanh_ceramic'));
    }
  }

  // Relocated Tứ Trụ Nghi Môn Ceremonial Pillars far East along outer approach (z = 52.0 — ZERO obstruction of Ngọ Môn bridge vista!)
  for (const sx of [-bridgeWidth * 0.48, -bridgeWidth * 0.16, bridgeWidth * 0.16, bridgeWidth * 0.48]) {
    const isInner = Math.abs(sx) < bridgeWidth * 0.3;
    const pilH = isInner ? 6.0 : 4.6;
    const tz = 52.0;
    addCyl(stoneParts, 0.34, 0.40, 0.68, 8, sx, 0.34, tz);
    addCyl(crimsonParts, 0.20, 0.24, pilH, 10, sx, 0.68 + pilH * 0.5, tz);
    addBox(marbleParts, 0.60, 0.20, 0.60, sx, 0.68 + pilH + 0.10, tz);
    goldParts.push(
      ...createGuardianBeastParts(sx, 0.68 + pilH + 0.20, tz, 0, isInner ? 0.62 : 0.48, 'nghe')
    );
  }

  // 4. UPGRADED 42m Kỳ Đài (Imperial Flag Tower) at local (-28, +48):
  // FIX Tier-1 buried brick bug -> 3 authentic sloped Vauban frustum weatheredImperialBrick tiers with stone corner/coping trims!
  const flagX = -28.0;
  const flagZ = 48.0;
  const [fwx, fwz] = localToWorld(flagX, flagZ);
  const fSink = Math.max(1.8, yBase - ctx.getHeight(fwx, fwz) + 2.2);

  // Grounded stone subterranean foundation apron ONLY below y = 0.0 (never buries Tier-1 brick!)
  addBox(stoneParts, 19.6, fSink, 19.6, flagX, -fSink * 0.5 + 0.06, flagZ);
  // 3 Sloped Vauban Frustum Brick Tiers totaling 16.5m (6.2m + 5.4m + 4.9m)
  addBatteredBox(brickParts, 16.8, 18.8, 16.8, 18.8, 6.2, flagX, 3.1, flagZ);
  addBox(marbleParts, 17.4, 0.32, 17.4, flagX, 6.2, flagZ);

  addBatteredBox(brickParts, 12.2, 14.0, 12.2, 14.0, 5.4, flagX, 6.2 + 2.7, flagZ);
  addBox(marbleParts, 12.8, 0.30, 12.8, flagX, 11.6, flagZ);

  addBatteredBox(brickParts, 8.6, 9.8, 8.6, 9.8, 4.9, flagX, 11.6 + 2.45, flagZ);
  addBox(marbleParts, 9.2, 0.32, 9.2, flagX, 16.5, flagZ);

  // Stone corner quoining trims along all 3 Vauban tiers + pierced brick/stone parapets
  for (const [botW, topW, y0, th] of [
    [18.8, 16.8, 0.0, 6.2],
    [14.0, 12.2, 6.2, 5.4],
    [9.8, 8.6, 11.6, 4.9]
  ]) {
    const midOff = (botW + topW) * 0.25;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBatteredBox(
          stoneParts,
          0.56,
          0.72,
          0.56,
          0.72,
          th,
          flagX + sx * midOff,
          y0 + th * 0.5,
          flagZ + sz * midOff
        );
      }
    }
  }

  for (const [tierW, tierY] of [
    [16.6, 6.36],
    [12.0, 11.75]
  ]) {
    const hw = tierW * 0.5 - 0.18;
    jadeRoofParts.push(
      ...createPiercedBalustradeParts(flagX - hw, flagZ - hw, flagX + hw, flagZ - hw, tierY, 0.85, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(flagX - hw, flagZ + hw, flagX + hw, flagZ + hw, tierY, 0.85, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(flagX - hw, flagZ - hw, flagX - hw, flagZ + hw, tierY, 0.85, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(flagX + hw, flagZ - hw, flagX + hw, flagZ + hw, tierY, 0.85, 'hoa_chanh_ceramic')
    );
  }
  const kHw = 4.3;
  jadeRoofParts.push(
    ...createPiercedBalustradeParts(flagX - kHw, flagZ - kHw, flagX + kHw, flagZ - kHw, 16.66, 0.92, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(flagX - kHw, flagZ + kHw, flagX + kHw, flagZ + kHw, 16.66, 0.92, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(flagX - kHw, flagZ - kHw, flagX - kHw, flagZ + kHw, 16.66, 0.92, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(flagX + kHw, flagZ - kHw, flagX + kHw, flagZ + kHw, 16.66, 0.92, 'hoa_chanh_ceramic')
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

  const stoneMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(stoneParts), 2.8),
    ctx.huePack?.thanhStoneMat ?? ctx.materials.stone
  );
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  // Weathered cool-grey Thanh stone coping (ZERO blinding pure-white marble glare!)
  const marbleMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(marbleParts), 2.6),
    ctx.huePack?.thanhStoneMat ?? ctx.materials.stone
  );
  marbleMesh.castShadow = false;
  marbleMesh.receiveShadow = true;

  const brickMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(brickParts), 2.2),
    ctx.materials.weatheredImperialBrick ?? ctx.materials.stone
  );
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  const crimsonMesh = new THREE.Mesh(
    mergeNormalized(crimsonParts),
    ctx.huePack?.imperialCrimsonWoodMat ?? ctx.materials.crimsonLacquer
  );
  crimsonMesh.castShadow = true;
  crimsonMesh.receiveShadow = true;

  const centralRoofMesh = new THREE.Mesh(mergeNormalized(centralRoofParts), imperialGoldRoofMat);
  centralRoofMesh.castShadow = true;
  centralRoofMesh.receiveShadow = true;

  const jadeRoofMesh = new THREE.Mesh(
    mergeNormalized(jadeRoofParts),
    ctx.huePack?.thanhLuuLyMat ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof
  );
  jadeRoofMesh.castShadow = true;
  jadeRoofMesh.receiveShadow = true;

  const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold);
  goldMesh.castShadow = false;

  const bronzeMesh = new THREE.Mesh(
    mergeNormalized(bronzeParts),
    ctx.huePack?.antiqueBronzeCauldronMat ?? ctx.materials.bronze
  );
  bronzeMesh.castShadow = false;

  const cuuDinhMesh = new THREE.Mesh(
    mergeNormalized(cuuDinhParts),
    ctx.materials.bronzePatina ?? ctx.materials.bronze
  );
  cuuDinhMesh.castShadow = false;

  const batTrangMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(batTrangParts), 1.8),
    ctx.materials.batTrangFloor ?? ctx.materials.terracottaRoof
  );
  batTrangMesh.receiveShadow = true;

  const voidMesh = new THREE.Mesh(mergeNormalized(voidParts), ctx.materials.darkVoid);

  const moatWaterMesh = moatWaterObj;

  const flagMesh = new THREE.Mesh(flagGeo, crimsonClothMat);
  flagMesh.castShadow = false;
  flagMesh.name = 'HueImperialFlagBanner';

  if (moatRubbleParts.length > 0) {
    const rubbleMesh = new THREE.Mesh(
      applyWorldBoxUV(mergeNormalized(moatRubbleParts), 2.4),
      ctx.huePack?.rubbleMoatMat ?? ctx.materials.granite
    );
    rubbleMesh.castShadow = true;
    rubbleMesh.receiveShadow = true;
    group.add(rubbleMesh);
  }
  if (ceramicParts.length > 0) {
    const cerMesh = new THREE.Mesh(
      mergeNormalized(ceramicParts),
      ctx.huePack?.ceramicMosaicMat ?? ctx.materials.stone
    );
    cerMesh.castShadow = false;
    cerMesh.receiveShadow = true;
    group.add(cerMesh);
  }
  if (terracottaBalParts.length > 0) {
    const tBalMesh = new THREE.Mesh(
      mergeNormalized(terracottaBalParts),
      ctx.huePack?.terracottaBalustradeMat ?? ctx.materials.terracottaRoof
    );
    tBalMesh.castShadow = false;
    tBalMesh.receiveShadow = true;
    group.add(tBalMesh);
  }
  if (plasterArchParts.length > 0) {
    const archMesh = new THREE.Mesh(mergeNormalized(plasterArchParts), ctx.materials.whitePlaster);
    archMesh.castShadow = false;
    archMesh.receiveShadow = true;
    group.add(archMesh);
  }
  if (bushCoreParts.length > 0) {
    const coreMat = ctx.materialLib?.getOrCreateStandard({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.02
    }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
    const coreMesh = new THREE.Mesh(mergeNormalized(bushCoreParts), coreMat);
    coreMesh.castShadow = false;
    coreMesh.receiveShadow = true;
    group.add(coreMesh);
  }
  if (foliageParts.length > 0) {
    const folMat = ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02
    }) ?? new THREE.MeshStandardMaterial({ map: ctx.pbr.leafAtlas, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72 });
    const folMesh = new THREE.Mesh(mergeNormalized(foliageParts), folMat);
    folMesh.castShadow = false;
    folMesh.receiveShadow = true;
    group.add(folMesh);
  }
  if (lampGlobeParts.length > 0) {
    const globeMesh = new THREE.Mesh(
      mergeNormalized(lampGlobeParts),
      ctx.materials.lanternCore ?? ctx.materials.whitePlaster
    );
    group.add(globeMesh);
  }

  if (woodParts.length > 0) {
    const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
    woodMesh.castShadow = true;
    group.add(woodMesh);
  }
  if (lotusLeafParts.length > 0) {
    const lotusLeafMat = ctx.materialLib?.getOrCreateStandard({
      color: '#22592c',
      roughness: 0.68,
      side: THREE.DoubleSide
    }) ?? new THREE.MeshStandardMaterial({ color: '#22592c', roughness: 0.68, side: THREE.DoubleSide });
    const lotusLeafMesh = new THREE.Mesh(mergeNormalized(lotusLeafParts), lotusLeafMat);
    group.add(lotusLeafMesh);
  }

  group.add(
    stoneMesh,
    marbleMesh,
    brickMesh,
    batTrangMesh,
    crimsonMesh,
    centralRoofMesh,
    jadeRoofMesh,
    goldMesh,
    bronzeMesh,
    cuuDinhMesh,
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
  const agedOchreParts: THREE.BufferGeometry[] = [];
  const whitePlasterParts: THREE.BufferGeometry[] = [];
  const ceramicAccentParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const ironwoodParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bougainvilleaParts: THREE.BufferGeometry[] = [];
  const tileParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];
  const lightPoolParts: THREE.BufferGeometry[] = [];
  // FIX HA-03: Traditional rich silk Hội An palette (no neon pink/cyan) + 4 authentic Lathe profiles + zero tassel Z-fighting!
  const lanternPalette = ['#c92218', '#f2b62c', '#f5eed8', '#e65c1c', '#2d7a46', '#9e2a4b'];
  const lanternProfiles: Array<'pumpkin' | 'garlic' | 'diamond' | 'cylinder'> = [
    'pumpkin',
    'garlic',
    'diamond',
    'cylinder'
  ];

  // Helper to append a silk lantern (4 traditional silhouettes + cap without duplicate wood tassel + red/gold silk tassel!)
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
    const shell = createRibbedLanternShellGeometry(rad, h, 12, 8, prof);
    const yScale = prof === 'pumpkin' ? 0.90 : prof === 'garlic' ? 1.12 : prof === 'diamond' ? 1.16 : 1.22;
    const rScale = prof === 'pumpkin' ? 1.14 : prof === 'garlic' ? 1.0 : prof === 'diamond' ? 1.06 : 0.80;
    shell.scale(rScale, yScale, rScale);
    shell.translate(lx, ly, lz);
    lanternParts.push(colorizeForMerge(shell, hex));

    const effH = h * yScale;
    // includeTassel = false eliminates Z-fighting with the separate colored silk tassel below!
    const cap = createLanternCapGeometry(rad * 0.92, effH, false);
    cap.translate(lx, ly, lz);
    woodParts.push(cap);

    const core = createLanternCoreGeometry(rad * 0.88, effH * 0.9);
    core.translate(lx, ly, lz);
    coreParts.push(core);

    // Separate red/gold silk tassel hanging cleanly beneath bottom wooden cap
    const tasselTarget = tasselRed ? crimsonParts : goldParts;
    const knotY = ly - effH * 0.5 - 0.06;
    const tasselLen = Math.max(0.18, effH * 0.34);
    const knot = new THREE.SphereGeometry(rad * 0.14, 5, 4);
    knot.translate(lx, knotY, lz);
    tasselTarget.push(knot);
    addCone(tasselTarget, rad * 0.14, tasselLen, 6, lx, knotY - tasselLen * 0.52, lz);
  };

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

  // 1. Chùa Cầu (Japanese Covered Bridge — Lai Viễn Kiều): authentic 5-span substructure
  //    (1 wide central rectangular span + 4 narrow semicircular stone/brick arches, white-plaster curved arch band,
  //     2 curved crimson-lacquer brick wing walls at ends, dark ironwood columns/railings, 3-bay terracotta roof!)
  const bridgeZ = 45;
  for (const ax of [165.3, 184.7]) {
    addBox(stoneParts, 3.0, 4.0, 5.2, ax, -0.15, bridgeZ);
  }

  // 4 narrow semicircular stone arches (2 West at 167.8 & 171.2, 2 East at 178.8 & 182.2) + 1 wide central rectangular span (173.1..176.9)
  const archSpanConfigs = [
    { x: 168.0, w: 3.3, h: 4.15, openW: 2.15, openH: 3.35 },
    { x: 171.3, w: 3.3, h: 4.65, openW: 2.15, openH: 3.85 },
    { x: 178.7, w: 3.3, h: 4.65, openW: 2.15, openH: 3.85 },
    { x: 182.0, w: 3.3, h: 4.15, openW: 2.15, openH: 3.35 }
  ];
  for (const ac of archSpanConfigs) {
    const aWall = createArchedWallGeometry(ac.w, ac.h, 4.7, ac.openW, ac.openH);
    aWall.translate(ac.x, -2.2, bridgeZ);
    stoneParts.push(aWall);
  }
  // Wide central rectangular span (x = 173.0..177.0) supported by flanking cutwater piers + heavy horizontal beam
  for (const px of [173.15, 176.85]) {
    addBox(stoneParts, 1.05, 5.15, 4.9, px, -2.2 + 2.575, bridgeZ);
    addBox(whitePlasterParts, 1.25, 0.24, 5.15, px, 2.85, bridgeZ);
  }
  addBox(stoneParts, 4.2, 0.52, 4.8, cx, 2.85, bridgeZ);

  // Iconic white-plaster curved structural arch band running along both North & South sides under the wooden deck
  const bandSegs = 18;
  for (let i = 0; i < bandSegs; i++) {
    const t0 = i / bandSegs;
    const t1 = (i + 1) / bandSegs;
    const tm = (t0 + t1) * 0.5;
    const bx = THREE.MathUtils.lerp(165.4, 184.6, tm);
    const bandY = bankY - 0.08 + 1.62 * Math.sin(tm * Math.PI);
    const slope = Math.atan2(1.62 * Math.cos(tm * Math.PI) * (Math.PI / 19.2), 1.0);
    for (const sz of [-2.42, 2.42]) {
      addBox(whitePlasterParts, 1.22, 0.42, 0.22, bx, bandY, bridgeZ + sz, 0, 0, slope);
    }
  }

  // FIX CC-02: Tall solid terracotta-red wing walls (3.6m -> 2.7m) flanking East & West ends of Chùa Cầu (ref 19_chua_cau_hoi_an.jpg)
  for (const [endX, dir] of [
    [165.4, -1],
    [184.6, 1]
  ] as const) {
    for (const sz of [-1, 1]) {
      const wingPts = [
        new THREE.Vector3(endX, bankY + 0.85, bridgeZ + sz * 2.38),
        new THREE.Vector3(endX + dir * 1.45, bankY + 0.68, bridgeZ + sz * 2.95),
        new THREE.Vector3(endX + dir * 2.85, bankY + 0.52, bridgeZ + sz * 3.85)
      ];
      for (let w = 0; w < 2; w++) {
        const p0 = wingPts[w];
        const p1 = wingPts[w + 1];
        const segLen = Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.16;
        const rotY = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
        const hWall = w === 0 ? 3.55 : 2.65;
        addBox(crimsonParts, segLen, hWall, 0.36, (p0.x + p1.x) * 0.5, bankY + hWall * 0.5, (p0.z + p1.z) * 0.5, rotY);
        addBox(whitePlasterParts, segLen + 0.10, 0.16, 0.44, (p0.x + p1.x) * 0.5, bankY + hWall + 0.08, (p0.z + p1.z) * 0.5, rotY);
      }
      addBox(crimsonParts, 0.52, 2.85, 0.52, wingPts[2].x, bankY + 1.42, wingPts[2].z);
      addCone(ceramicAccentParts, 0.28, 0.40, 4, wingPts[2].x, bankY + 3.04, wingPts[2].z);
    }
  }

  // Interior end-bay shrine pedestals housing Sacred Guardian Dog (West bay) & Monkey (East bay) inside the covered bridge!
  for (const [pedX, beastType, faceRot] of [
    [166.7, 'dog' as const, Math.PI * 0.5],
    [183.3, 'monkey' as const, -Math.PI * 0.5]
  ] as const) {
    const tEnd = clamp01((pedX - 165.2) / 19.6);
    const floorY = bankY + 0.38 + 1.62 * Math.sin(tEnd * Math.PI);
    for (const sz of [-1.42, 1.42]) {
      addBox(crimsonParts, 0.72, 0.76, 0.72, pedX, floorY + 0.38, bridgeZ + sz);
      addBox(goldParts, 0.78, 0.08, 0.78, pedX, floorY + 0.78, bridgeZ + sz);
      ironwoodParts.push(
        ...createGuardianBeastParts(pedX, floorY + 0.82, bridgeZ + sz, faceRot, 0.68, beastType)
      );
    }
  }

  // Arched dark ironwood bridge deck (4.6m wide), open end-to-end walkway, ironwood columns & con_tien grilles
  const bridgeSegs = 18;
  for (let i = 0; i < bridgeSegs; i++) {
    const t0 = i / bridgeSegs;
    const t1 = (i + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const bx0 = THREE.MathUtils.lerp(165.2, 184.8, t0);
    const bx1 = THREE.MathUtils.lerp(165.2, 184.8, t1);
    const bx = (bx0 + bx1) * 0.5;
    const archY = bankY + 0.22 + 1.62 * Math.sin(tm * Math.PI);
    const slope = Math.atan2(1.62 * Math.cos(tm * Math.PI) * (Math.PI / 19.6), 1.0);

    addBox(ironwoodParts, 1.25, 0.34, 4.6, bx, archY, bridgeZ, 0, 0, slope);
    const isShrineOpening = Math.abs(bx - cx) < 2.3;
    for (const sz of [-2.15, 2.15]) {
      if (sz < 0 && isShrineOpening) {
        if (i % 2 === 0) {
          addCyl(ironwoodParts, 0.12, 0.14, 3.05, 8, bx, archY + 1.68, bridgeZ + sz);
        }
        continue;
      }
      addBox(ironwoodParts, 1.18, 0.92, 0.20, bx, archY + 0.62, bridgeZ + sz, 0, 0, slope);
      ironwoodParts.push(
        ...createPiercedBalustradeParts(bx0 + 0.06, bridgeZ + sz, bx1 - 0.06, bridgeZ + sz, archY + 1.08, 1.08, 'con_tien')
      );
      if (i % 2 === 0 || i === bridgeSegs - 1) {
        addCyl(ironwoodParts, 0.12, 0.14, 3.05, 8, bx, archY + 1.68, bridgeZ + sz);
      }
    }
    if (i % 2 === 0 || i === bridgeSegs - 1) {
      addBox(ironwoodParts, 0.24, 0.24, 4.75, bx, archY + 3.12, bridgeZ);
    }
  }

  // FIX CC-05: Authentic Weathered Dark Timber Bắc Đế Trấn Võ Shrine Interior (ref 56_tuong_khi_cho_chua_cau_hoi_an.jpg):
  // dark weathered wood walls/altar/khám thờ (NOT bright red lacquer), dark antique bronze Bắc Đế statue & altar-top cranes!
  const shrineZ = bridgeZ - 4.35;
  const shrineDeckY = bankY + 0.22 + 1.62;
  const shrinePierH = shrineDeckY + 2.2;
  addBox(stoneParts, 5.4, shrinePierH, 4.6, cx, -2.2 + shrinePierH * 0.5, shrineZ);
  addBox(ironwoodParts, 5.4, 0.34, 4.8, cx, shrineDeckY, shrineZ);
  // Dark weathered ironwood enclosure walls leaving 2 narrow flanking doorways into the rear ochre hall
  addBox(ironwoodParts, 2.8, 3.25, 0.24, cx, shrineDeckY + 1.65, shrineZ - 2.15);
  addBox(ironwoodParts, 0.28, 3.25, 4.4, cx - 2.55, shrineDeckY + 1.65, shrineZ);
  addBox(ironwoodParts, 0.28, 3.25, 4.4, cx + 2.55, shrineDeckY + 1.65, shrineZ);
  // Weathered dark wood carved altar table + antique dark wood Khám thờ canopy frame
  addBox(ironwoodParts, 2.8, 1.05, 1.15, cx, shrineDeckY + 0.68, shrineZ - 1.25);
  addBox(woodParts, 2.9, 0.10, 1.22, cx, shrineDeckY + 1.22, shrineZ - 1.25);
  addBox(ironwoodParts, 2.2, 1.85, 0.18, cx, shrineDeckY + 1.95, shrineZ - 1.88);
  addBox(woodParts, 2.32, 0.16, 0.24, cx, shrineDeckY + 2.86, shrineZ - 1.86);
  for (const sx of [-1.05, 1.05]) {
    addBox(woodParts, 0.16, 1.85, 0.24, cx + sx, shrineDeckY + 1.95, shrineZ - 1.86);
  }
  // Antique dark bronze Bắc Đế Trấn Võ (Huyền Thiên Đại Đế) seated deity (NOT bright gold Amitabha!)
  const bacDe = createSculptedDeityParts(cx, shrineDeckY + 1.28, shrineZ - 1.48, 0, 0.44, 'amitabha', { skipHalo: true });
  bronzeParts.push(...bacDe.bodyParts, ...bacDe.accentParts);
  // Bronze incense tripod (*Đỉnh đồng*) + twin antique bronze cranes perched ON the altar table flanking censer (ref 56!)
  bronzeParts.push(...createBronzeIncenseTripodParts(cx, shrineDeckY + 1.28, shrineZ - 0.92, 0.36).bronzeParts);
  for (const sx of [-0.96, 0.96]) {
    bronzeParts.push(...createBronzeCraneOnTortoiseParts(cx + sx, shrineDeckY + 1.27, shrineZ - 1.05, 0, 0.48));
  }
  for (const ax of [-0.58, 0.58]) {
    const candle = new THREE.SphereGeometry(0.08, 6, 5);
    candle.translate(cx + ax, shrineDeckY + 1.38, shrineZ - 0.96);
    coreParts.push(candle);
  }
  const shrineLight = new THREE.PointLight('#ff9d42', 11.0, 13.0, 1.6);
  shrineLight.position.set(cx, shrineDeckY + 2.2, shrineZ - 0.5);
  group.add(shrineLight);

  // Chùa Cầu Terracotta Yin-Yang Tile Roof divided into 3 authentic stepped bays + white mortar ridge stripes + blue-white ceramic ridge ornaments!
  const bridgeBays = [
    { x: 168.4, w: 7.2, y: bankY + 3.45, h: 1.85 },
    { x: cx, w: 7.6, y: bankY + 4.35, h: 2.25 },
    { x: 181.6, w: 7.2, y: bankY + 3.45, h: 1.85 }
  ];
  for (const bay of bridgeBays) {
    const bayRoof = createGableRoofGeometry(bay.w, 6.0, bay.h, 0.18, 'x');
    bayRoof.translate(bay.x, bay.y, bridgeZ);
    tileParts.push(bayRoof);
    // White mortar ridge stripe & stepped gable end mortar trim
    addBox(whitePlasterParts, bay.w + 0.12, 0.24, 0.32, bay.x, bay.y + bay.h + 0.16, bridgeZ);
    for (const gx of [-bay.w * 0.48, bay.w * 0.48]) {
      addBox(whitePlasterParts, 0.18, 0.18, 5.9, bay.x + gx, bay.y + 0.08, bridgeZ);
    }
    // Blue-white ceramic ridge finial medallions along each bay crest
    const fin = createRoofFinialSetParts(bay.x, bay.y + bay.h + 0.26, bridgeZ, bay.w * 0.75, 0, 0.44, false);
    ceramicAccentParts.push(...fin.mainParts, ...fin.goldParts);
  }

  // Double-tiered North shrine pavilion terracotta roof capping the T-wing at z = shrineZ
  const shrineGableBase = createVietnameseCurvedRoofGeometry(6.6, 6.4, 4.2, 4.0, 1.35, 0.30);
  shrineGableBase.translate(cx, shrineDeckY + 3.15, shrineZ);
  tileParts.push(shrineGableBase);

  const shrineGableTop = createVietnameseCurvedRoofGeometry(4.8, 4.6, 1.1, 1.0, 1.65, 0.34);
  shrineGableTop.translate(cx, shrineDeckY + 4.35, shrineZ);
  tileParts.push(shrineGableTop);
  addBox(whitePlasterParts, 1.35, 0.22, 0.28, cx, shrineDeckY + 6.02, shrineZ);
  const bridgeFinials = createRoofFinialSetParts(cx, shrineDeckY + 6.10, shrineZ, 2.2, 0, 0.54, false);
  ceramicAccentParts.push(...bridgeFinials.mainParts, ...bridgeFinials.goldParts);

  // Readable "LAI VIỄN KIỀU — 來遠橋" Calligraphy Plaques mounted cleanly BELOW end eaves (zero clipping!)
  for (const [px, rotY] of [
    [165.05, -Math.PI * 0.5],
    [184.95, Math.PI * 0.5]
  ] as const) {
    const plaque = createSignagePlaqueMesh(
      {
        text: 'LAI VIỄN KIỀU',
        subText: '來 遠 橋',
        style: 'royal',
        width: 2.35,
        height: 0.72,
        depth: 0.14,
        motifSeed: 1719
      },
      ctx
    );
    plaque.position.set(px, bankY + 2.66, bridgeZ);
    plaque.rotation.y = rotY;
    group.add(plaque);
  }

  // 2. 16 Row-Attached Heritage Tube Houses (2-slope gable roofs, shared firewalls zero Z-fighting,
  //    lintel-backed Mắt cửa with red silk tassels, horizontal plank cửa bàn khoa, varied aged ochre walls!)
  const tubeRowZs = [11.8, 17.0, 22.2, 27.4, 56.6, 61.8, 67.0, 72.2];
  const shopNames: Array<{ text: string; sub: string }> = [
    { text: 'TIỆM ĐÈN LỒNG', sub: 'HỘI AN XƯA' },
    { text: 'NHÀ MAY ÁO DÀI', sub: 'LỤA TƠ TẰM' },
    { text: 'TRÀ MÓT HỘI AN', sub: 'THẢO MỘC' },
    { text: 'GỐM THANH HÀ', sub: 'MỸ NGHỆ' },
    { text: 'CÀ PHÊ PHỐ CỔ', sub: 'SÔNG HOÀI' },
    { text: 'TRẦM HƯƠNG XỨ QUẢNG', sub: 'DI SẢN' }
  ];
  // FIX HA-02: Authentic rhythmic mix of 1-story (4.4m) & 2-story (7.3–8.2m) Hội An tube houses + mossy 1st-floor awning eaves!
  const houseSpecs: Array<{ x: number; z: number; facing: number; w: number; d: number; h: number; rowIdx: number; isOneStory: boolean }> = [];
  for (const [idx, zPos] of tubeRowZs.entries()) {
    const wVar = 5.14; // exact uniform 5.20m pitch with 0.06m shared firewall joint -> ZERO Z-fighting!
    const oneStoryW = idx === 1 || idx === 5;
    const oneStoryE = idx === 2 || idx === 6;
    const hVarW = oneStoryW ? 4.45 : 7.3 + ((idx * 3) % 4) * 0.30;
    const hVarE = oneStoryE ? 4.55 : 7.2 + ((idx * 5 + 1) % 4) * 0.30;
    houseSpecs.push({ x: 156.8, z: zPos, facing: 1, w: wVar, d: 8.6, h: hVarW, rowIdx: idx, isOneStory: oneStoryW });
    houseSpecs.push({ x: 193.2, z: zPos, facing: -1, w: wVar, d: 8.6, h: hVarE, rowIdx: idx, isOneStory: oneStoryE });
  }

  // Build 1 SINGLE shared stepped masonry firewall between adjacent tube houses (zero Z-fighting!)
  for (const [bankX, facing] of [
    [156.8, 1],
    [193.2, -1]
  ] as const) {
    for (const blockStart of [0, 4]) {
      const baseZ = tubeRowZs[blockStart] - 2.6;
      for (let fw = 0; fw <= 4; fw++) {
        const fwZ = baseZ + fw * 5.2;
        const gy = ctx.getHeight(bankX, fwZ);
        const topBaseY = gy + 0.35 + 8.05;
        const fwTarget = fw % 2 === 0 ? ochreParts : agedOchreParts;
        addBox(fwTarget, 9.0, 1.05, 0.24, bankX + facing * 0.1, topBaseY + 0.45, fwZ);
        addBox(fwTarget, 5.8, 1.05, 0.24, bankX + facing * 0.18, topBaseY + 1.40, fwZ);
        addBox(stoneParts, 3.2, 0.72, 0.28, bankX + facing * 0.25, topBaseY + 2.22, fwZ);
      }
    }
  }

  for (const [hsIdx, hs] of houseSpecs.entries()) {
    const gy = ctx.getHeight(hs.x, hs.z);
    const plinthBottom = Math.min(gy, bankY) - 1.2;
    const plinthTop = gy + 0.35;
    const plinthH = plinthTop - plinthBottom;

    // Alternate wall tone across yellowOchrePlaster & agedYellowPlaster for authentic old-quarter variation
    const wallBucket = (hsIdx + hs.rowIdx) % 2 === 0 ? ochreParts : agedOchreParts;

    // Grounded stone plinth
    addBox(stoneParts, hs.d + 0.5, plinthH, hs.w + 0.04, hs.x, plinthBottom + plinthH * 0.5, hs.z);

    const frontX = hs.x + hs.facing * (hs.d * 0.5);
    const hasOpenShop = hsIdx % 3 === 0;

    if (hasOpenShop) {
      addBox(wallBucket, hs.d, hs.h - 3.35, hs.w - 0.06, hs.x, plinthTop + 3.35 + (hs.h - 3.35) * 0.5, hs.z);
      addBox(wallBucket, hs.d - 2.6, 3.35, hs.w - 0.06, hs.x - hs.facing * 1.3, plinthTop + 1.68, hs.z);
      for (const sz of [-hs.w * 0.46, hs.w * 0.46]) {
        addBox(wallBucket, 2.7, 3.35, 0.24, frontX - hs.facing * 1.35, plinthTop + 1.68, hs.z + sz);
      }
      // Solid horizontal timber lintel beam across open shopfront so Mắt cửa NEVER floats!
      addBox(ironwoodParts, 0.26, 0.36, hs.w - 0.04, frontX - hs.facing * 0.04, plinthTop + 3.16, hs.z);
      for (const pz of [-hs.w * 0.44, hs.w * 0.44]) {
        addBox(ironwoodParts, 0.22, 3.16, 0.22, frontX - hs.facing * 0.04, plinthTop + 1.58, hs.z + pz);
      }

      const shopX = frontX - hs.facing * 1.25;
      addBox(woodParts, 0.9, 0.86, hs.w * 0.58, shopX, plinthTop + 0.43, hs.z);
      // Nhà Cổ Tấn Ký / Quân Thắng Walk-In Merchant Interior (ref 114_hoi_an_nha_co_tan_ky_noi_that.jpg):
      // Mother-of-pearl inlaid ironwood salon table & 4 armchairs (*bàn ghế khảm xà cừ*), internal *chồng rường giả thủ* roof truss,
      // porcelain blue-and-white vase on pedestal with yellow chrysanthemums & vertical gilded scroll couplets!
      const salonX = frontX - hs.facing * 2.85;
      addBox(ironwoodParts, 1.15, 0.74, 1.45, salonX, plinthTop + 0.37, hs.z);
      addBox(whitePlasterParts, 0.95, 0.04, 1.25, salonX, plinthTop + 0.76, hs.z); // mother-of-pearl inlaid marble tabletop
      for (const czChair of [-1.15, 1.15]) {
        addBox(ironwoodParts, 0.62, 0.46, 0.58, salonX, plinthTop + 0.23, hs.z + czChair);
        addBox(ironwoodParts, 0.62, 0.58, 0.12, salonX, plinthTop + 0.74, hs.z + czChair * 1.20);
        addBox(whitePlasterParts, 0.28, 0.32, 0.14, salonX, plinthTop + 0.76, hs.z + czChair * 1.19); // mother-of-pearl medallion
      }
      // Internal dark-ironwood columns, carved *chồng rường* tie-beam & porcelain vase with golden chrysanthemum bouquet
      for (const szCol of [-hs.w * 0.36, hs.w * 0.36]) {
        addCyl(ironwoodParts, 0.12, 0.14, 3.25, 8, salonX, plinthTop + 1.62, hs.z + szCol);
        addBox(crimsonParts, 0.08, 1.85, 0.24, salonX + hs.facing * 0.15, plinthTop + 1.95, hs.z + szCol); // vertical câu đối scroll
      }
      addBox(ironwoodParts, 0.20, 0.24, hs.w - 0.2, salonX, plinthTop + 3.12, hs.z);
      // Carved Tứ Quý panels (`HV-C08`), louver shutters (`HV-H05`) & Chữ Thọ (`HV-D02`) on Hội An heritage shophouse
      if (hsIdx % 6 === 0) {
        goldParts.push(...createBasReliefPanelParts(salonX + hs.facing * 0.45, plinthTop + 2.25, hs.z, 1.4, 0.65, hs.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 'tu_quy'));
        ironwoodParts.push(...createLouverShutterParts(frontX + hs.facing * 0.14, plinthTop + 4.45, hs.z - 0.85, 0.55, 1.45, hs.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 6));
      }
      addBox(ironwoodParts, 0.48, 0.78, 0.48, salonX - hs.facing * 0.95, plinthTop + 0.39, hs.z);
      addCyl(ceramicAccentParts, 0.18, 0.14, 0.56, 8, salonX - hs.facing * 0.95, plinthTop + 1.06, hs.z);
      addCone(goldParts, 0.24, 0.32, 7, salonX - hs.facing * 0.95, plinthTop + 1.48, hs.z);
      for (let k = -2; k <= 2; k++) {
        const iz = hs.z + k * 0.78;
        const ix = shopX + hs.facing * (0.45 + (Math.abs(k) % 2) * 0.35);
        const iy = plinthTop + 2.45 - (Math.abs(k) % 2) * 0.28;
        const iHex = lanternPalette[(hsIdx + k + 6) % lanternPalette.length];
        addHoiAnLantern(ix, iy, iz, 0.17, 0.44, iHex, hsIdx + k + 4, (hsIdx + k) % 2 === 0);
      }
      for (const stoolZ of [-1.2, 1.2]) {
        addCyl(woodParts, 0.22, 0.24, 0.48, 8, frontX + hs.facing * 0.65, plinthTop + 0.24, hs.z + stoolZ);
      }
    } else {
      // Classic yellow-ochre plaster tube house with tight horizontal-plank *cửa bàn khoa* + central double doors
      addBox(wallBucket, hs.d, hs.h, hs.w - 0.06, hs.x, plinthTop + hs.h * 0.5, hs.z);
      // Heavy timber doorway lintel beam & flanking stiles
      addBox(ironwoodParts, 0.26, 0.36, hs.w * 0.86, frontX + hs.facing * 0.06, plinthTop + 3.16, hs.z);
      addBox(voidParts, 0.14, 2.98, hs.w * 0.78, frontX + hs.facing * 0.03, plinthTop + 1.50, hs.z);
      // Tight horizontal removable wood planks (*ván bàn khoa*) flanking central double doors
      for (const side of [-1, 1]) {
        const panelZ = hs.z + side * (hs.w * 0.265);
        const panelW = hs.w * 0.24;
        for (let pl = 0; pl < 6; pl++) {
          const py = plinthTop + 0.25 + pl * 0.48;
          addBox(ironwoodParts, 0.14, 0.45, panelW, frontX + hs.facing * 0.10, py, panelZ);
        }
        // Vertical frame stile separating plank bay from center double doors
        addBox(woodParts, 0.18, 3.02, 0.10, frontX + hs.facing * 0.12, plinthTop + 1.52, hs.z + side * (hs.w * 0.14));
      }
      // Central double wooden shop doors slightly recessed
      for (const side of [-1, 1]) {
        addBox(woodParts, 0.14, 2.94, hs.w * 0.125, frontX + hs.facing * 0.08, plinthTop + 1.48, hs.z + side * (hs.w * 0.068));
      }
    }

    // Authentic Hội An Door Eyes (*Mắt cửa Hội An*) mounted solidly on timber lintel + red silk tassels beneath!
    const eyes = createHoiAnDoorEyesParts(
      frontX + hs.facing * 0.12,
      plinthTop + 3.16,
      hs.z,
      hs.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
      1.16,
      0.15
    );
    woodParts.push(...eyes.woodParts);
    goldParts.push(...eyes.goldParts);
    for (const tz of [-0.58, 0.58]) {
      // Red silk tassel strip draping down from each Door Eye
      addBox(crimsonParts, 0.05, 0.34, 0.14, frontX + hs.facing * 0.16, plinthTop + 2.86, hs.z + tz);
    }

    if (!hs.isOneStory) {
      // Cantilevered upper wooden balcony with turned *con tiện* balustrade & veranda posts (2-story houses)
      const balcX = frontX + hs.facing * 1.32;
      addBox(woodParts, 1.45, 0.22, hs.w - 0.02, frontX + hs.facing * 0.72, plinthTop + 3.82, hs.z);
      woodParts.push(
        ...createPiercedBalustradeParts(balcX, hs.z - hs.w * 0.46, balcX, hs.z + hs.w * 0.46, plinthTop + 3.93, 0.90, 'con_tien')
      );
      for (const pz of [-hs.w * 0.44, hs.w * 0.44]) {
        addCyl(woodParts, 0.11, 0.13, 3.82, 8, frontX + hs.facing * 1.28, plinthTop + 1.91, hs.z + pz);
      }

      // Upper shuttered wooden balcony doors with subtle white plaster trim
      for (const wz of [-hs.w * 0.22, hs.w * 0.22]) {
        addBox(whitePlasterParts, 0.14, 2.16, 1.12, frontX + hs.facing * 0.02, plinthTop + 5.25, hs.z + wz);
        addBox(voidParts, 0.16, 1.98, 0.92, frontX + hs.facing * 0.05, plinthTop + 5.25, hs.z + wz);
        addBox(woodParts, 0.20, 2.02, 0.28, frontX + hs.facing * 0.13, plinthTop + 5.25, hs.z + wz - 0.54);
        addBox(woodParts, 0.20, 2.02, 0.28, frontX + hs.facing * 0.13, plinthTop + 5.25, hs.z + wz + 0.54);
      }
    } else {
      // FIX HA-02: Authentic 1-story Hội An veranda overhang roof propped on timber posts (ref 20_pho_co_hoi_an_den_long.jpg)
      const awning = new THREE.BoxGeometry(1.75, 0.14, hs.w - 0.04);
      awning.rotateZ(hs.facing > 0 ? -0.28 : 0.28);
      awning.translate(frontX + hs.facing * 0.85, plinthTop + 3.72, hs.z);
      tileParts.push(awning);
      for (const pz of [-hs.w * 0.42, hs.w * 0.42]) {
        addCyl(woodParts, 0.10, 0.12, 3.45, 7, frontX + hs.facing * 1.52, plinthTop + 1.72, hs.z + pz);
        addCyl(stoneParts, 0.18, 0.20, 0.18, 7, frontX + hs.facing * 1.52, plinthTop + 0.09, hs.z + pz);
      }
    }

    // Authentic 2-slope pitched gable roof (*mái 2 dốc bít đốc* — ridge running along Z parallel to street!)
    const houseRoof = createGableRoofGeometry(hs.d + 2.4, hs.w - 0.04, 2.35, 0.16, 'z');
    houseRoof.translate(hs.x + hs.facing * 0.35, plinthTop + hs.h - 0.05, hs.z);
    tileParts.push(houseRoof);
    const ridgeY = plinthTop + hs.h + 2.34;
    addBox(whitePlasterParts, 0.30, 0.26, hs.w - 0.04, hs.x + hs.facing * 0.35, ridgeY, hs.z);

    // Calligraphy shop signboards
    const signX = frontX + hs.facing * 0.32;
    const signY = plinthTop + 3.48;
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

    // Flanking entrance ribbed silk lanterns (with caps & tassels!)
    for (const ltz of [-hs.w * 0.36, hs.w * 0.36]) {
      const lantX = frontX + hs.facing * 1.26;
      const lantY = plinthTop + 3.42;
      const lantZ = hs.z + ltz;
      addCyl(woodParts, 0.02, 0.02, 0.40, 4, lantX, lantY + 0.38, lantZ);
      const lHex = lanternPalette[(hsIdx * 2 + (ltz > 0 ? 1 : 0)) % lanternPalette.length];
      addHoiAnLantern(lantX, lantY, lantZ, 0.22, 0.56, lHex, hsIdx + (ltz > 0 ? 1 : 0), ltz > 0);
    }

    // Richer multi-cluster cascading Bougainvillea canopies
    if (hsIdx % 2 === 0) {
      const vineRand = mulberry32(77000 + hsIdx * 191);
      const flowerHexes = ['#d81e74', '#f04299', '#e02885', '#ff66a8', '#ff3388', '#f25c2a'];
      const leafHexes = ['#235422', '#2f682c', '#1b451a', '#3a7536'];
      addCyl(woodParts, 0.045, 0.065, 4.4, 5, frontX + hs.facing * 1.32, plinthTop + 2.2, hs.z - hs.w * 0.44);
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
      addHoiAnLantern(p.x, p.y - 0.48, p.z, 0.33, 0.84, hex, sIdx + l, (sIdx + l) % 2 === 0);

      const poolY = p.x > 166.8 && p.x < 183.2 ? 0.05 : bankY + 0.06;
      const pool = new THREE.CircleGeometry(2.6, 16);
      pool.rotateX(-Math.PI * 0.5);
      pool.translate(p.x, poolY, p.z);
      lightPoolParts.push(colorizeForMerge(pool, hex));
    }
  });

  // FIX HA-04: Authentic blooming open-petaled Hoa Đăng paper lotus lanterns floating on Hoài Canal (y = 0.05, ref 03!)
  const rand = mulberry32(202607);
  for (let i = 0; i < 48; i++) {
    const fx = 168.2 + rand() * 13.6;
    const fz = 10.0 + rand() * 70.0;
    if (Math.abs(fz - bridgeZ) < 6.5) continue;
    const hoaHex = i % 3 === 0 ? '#ff6a33' : i % 3 === 1 ? '#ffd24d' : '#ff77aa';
    // Open flared 6-petal paper lotus flower cup instead of stubby cylinder
    const outerCup = new THREE.CylinderGeometry(0.36, 0.14, 0.14, 6, 1, true);
    outerCup.translate(fx, 0.09, fz);
    const innerCup = new THREE.CylinderGeometry(0.22, 0.12, 0.12, 6, 1, true);
    innerCup.rotateY(Math.PI / 6);
    innerCup.translate(fx, 0.11, fz);
    lanternParts.push(colorizeForMerge(outerCup, hoaHex), colorizeForMerge(innerCup, '#fff0c8'));

    const flame = new THREE.SphereGeometry(0.09, 5, 4);
    flame.translate(fx, 0.18, fz);
    coreParts.push(flame);

    const waterPool = new THREE.CircleGeometry(1.15, 10);
    waterPool.rotateX(-Math.PI * 0.5);
    waterPool.translate(fx, 0.04, fz);
    lightPoolParts.push(colorizeForMerge(waterPool, hoaHex));
  }

  // 4. FIX HA-04: 4 Animated Wooden Hoa Đăng Sampan Boats with Bow Lanterns (includeTassel=false) & Seated Boatman in Nón Lá!
  const sampanConfigs = [
    { x: 171.6, z: 20.5, yaw: Math.PI * 0.5 + 0.06, speed: 0.24, phase: 0.2 },
    { x: 178.4, z: 31.0, yaw: -Math.PI * 0.5 - 0.05, speed: 0.28, phase: 1.7 },
    { x: 171.8, z: 59.5, yaw: Math.PI * 0.5 - 0.04, speed: 0.26, phase: 3.1 },
    { x: 178.2, z: 70.0, yaw: -Math.PI * 0.5 + 0.07, speed: 0.22, phase: 4.5 }
  ];
  const sampanHullParts: THREE.BufferGeometry[] = [];
  addBox(sampanHullParts, 3.8, 0.12, 1.15, 0, 0.06, 0);
  for (const sz of [-0.58, 0.58]) {
    addBox(sampanHullParts, 4.1, 0.42, 0.09, 0, 0.28, sz, 0, sz > 0 ? -0.18 : 0.18, 0);
  }
  for (const sx of [-2.25, 2.25]) {
    const dir = Math.sign(sx);
    addCone(sampanHullParts, 0.58, 1.15, 4, sx, 0.34, 0, 0, Math.PI * 0.25, -dir * Math.PI * 0.42);
  }
  for (const bx of [-0.95, 0.15, 1.15]) {
    addBox(sampanHullParts, 0.32, 0.07, 1.08, bx, 0.34, 0);
  }
  // Seated sampan boatman silhouette at stern (-0.95) wearing conical nón lá + long 3.0m bamboo punting pole
  addCyl(sampanHullParts, 0.15, 0.20, 0.58, 6, -0.95, 0.66, 0);
  const rowerHead = new THREE.SphereGeometry(0.11, 6, 4);
  rowerHead.translate(-0.95, 1.04, 0);
  sampanHullParts.push(rowerHead);
  addCone(sampanHullParts, 0.30, 0.20, 8, -0.95, 1.18, 0);
  addCyl(sampanHullParts, 0.025, 0.03, 3.0, 5, -1.25, 0.65, 0.52, 0.35, 0.25, 0.45);
  addCyl(sampanHullParts, 0.025, 0.032, 1.35, 6, 2.45, 0.92, 0, 0, 0, -0.22);
  const bowCap = createLanternCapGeometry(0.18, 0.46, false);
  bowCap.translate(2.72, 1.24, 0);
  sampanHullParts.push(bowCap);
  const sharedSampanGeo = mergeNormalized(sampanHullParts);

  const bowLanternShell = createRibbedLanternShellGeometry(0.18, 0.46, 10, 7);
  bowLanternShell.translate(2.72, 1.24, 0);
  const bowLanternCore = createLanternCoreGeometry(0.18, 0.46);
  bowLanternCore.translate(2.72, 1.24, 0);
  const bowTasselGeo = new THREE.ConeGeometry(0.03, 0.18, 5);
  bowTasselGeo.translate(2.72, 0.88, 0);

  const lanternAnimU = { uTime: { value: 0.0 } };
  animatedUniforms.push(lanternAnimU);

  // FIX silkLanternMat shader: vertical bamboo ribs along azimuth/UV.x (NOT horizontal world Y!)
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
         varying vec2 vLanternUv;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLanternUv = uv;
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
         varying vec2 vLanternUv;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // Authentic VERTICAL bamboo lantern ribs running along azimuth UV.x (14-rib frame)
         float vertRib = 0.74 + 0.28 * pow(abs(sin(vLanternUv.x * 3.14159265 * 14.0)), 0.75);
         float poleShade = 0.86 + 0.14 * sin(vLanternUv.y * 3.14159265);
         totalEmissiveRadiance *= vColor * vertRib * poleShade;`
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
    const bTassel = new THREE.Mesh(bowTasselGeo.clone(), ctx.materials.crimsonLacquer);
    boatGrp.add(hullMesh, bShell, bCore, bTassel);
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
  bowTasselGeo.dispose();

  const lightPoolMat = ctx.sharedShaders
    ? ctx.sharedShaders.warmLightPool.material
    : (() => {
      const res = createWarmLightPoolMaterial();
      ctx.extraMaterials.push(res.material);
      animatedUniforms.push(res.uniforms);
      return res.material;
    })();

  const stoneMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(stoneParts), 2.4), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const ochreMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(ochreParts), 2.8),
    ctx.materials.yellowOchrePlaster
  );
  ochreMesh.castShadow = true;
  ochreMesh.receiveShadow = true;

  const agedOchreMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(agedOchreParts), 2.8),
    ctx.materials.agedYellowPlaster ?? ctx.materials.agedPlaster ?? ctx.materials.yellowOchrePlaster
  );
  agedOchreMesh.castShadow = true;
  agedOchreMesh.receiveShadow = true;

  const whitePlasterMesh = new THREE.Mesh(
    mergeNormalized(whitePlasterParts),
    ctx.materials.whitePlaster
  );
  whitePlasterMesh.castShadow = true;
  whitePlasterMesh.receiveShadow = true;

  // FIX CC-02: Authentic cobalt-blue-and-white ceramic ridge ornaments (#4b6bb5) on Chùa Cầu (ref 19)
  const cobaltCeramicMat = new THREE.MeshStandardMaterial({
    color: '#4b6bb5',
    roughness: 0.28,
    metalness: 0.12
  });
  ctx.extraMaterials.push(cobaltCeramicMat);
  const ceramicAccentMesh = new THREE.Mesh(
    mergeNormalized(ceramicAccentParts),
    cobaltCeramicMat
  );

  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;

  const ironwoodMesh = new THREE.Mesh(
    mergeNormalized(ironwoodParts),
    ctx.materials.darkIronwood ?? ctx.materials.darkWood
  );
  ironwoodMesh.castShadow = true;

  const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), ctx.materials.crimsonLacquer);
  crimsonMesh.castShadow = true;

  // FIX HA-02: Weathered mossy grey-brown yin-yang clay roof tiles (#594c42, ref 20 & 84) instead of bright new terracotta
  const hoiAnAgedTileMat = new THREE.MeshStandardMaterial({
    color: '#6b5a4d',
    map: ctx.pbr.terracotta.map,
    normalMap: ctx.pbr.terracotta.normalMap,
    roughnessMap: ctx.pbr.terracotta.roughnessMap,
    roughness: 0.86,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(hoiAnAgedTileMat);
  const tileMesh = new THREE.Mesh(mergeNormalized(tileParts), hoiAnAgedTileMat);
  tileMesh.castShadow = true;
  tileMesh.receiveShadow = true;

  const bronzeMesh = new THREE.Mesh(
    mergeNormalized(bronzeParts),
    ctx.materials.bronzePatina ?? ctx.materials.bronze
  );
  bronzeMesh.castShadow = true;

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

  // FIX HA-06: Low-curb ancient stone sidewalks, 4 parked vintage bicycles & 6 wrought-iron riverside streetlamps (ref 20 & 84!)
  const streetLampParts: THREE.BufferGeometry[] = [];
  const streetBikeParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    addBox(stoneParts, 1.45, 0.14, 72.0, cx + side * 4.45, bankY + 0.07, 45.0);
  }
  for (let lp = 0; lp < 6; lp++) {
    const lz = 18.0 + lp * 10.8;
    const lx = cx + (lp % 2 === 0 ? -4.3 : 4.3);
    addCyl(streetLampParts, 0.055, 0.095, 3.6, 6, lx, bankY + 1.8, lz);
    addBox(streetLampParts, 0.48, 0.06, 0.06, lx + (lp % 2 === 0 ? 0.22 : -0.22), bankY + 3.55, lz);
    const bulb = new THREE.SphereGeometry(0.14, 6, 5);
    bulb.translate(lx + (lp % 2 === 0 ? 0.42 : -0.42), bankY + 3.38, lz);
    coreParts.push(bulb);
  }
  for (const [bx, bz, byaw] of [
    [cx - 4.1, 24.5, 0.18],
    [cx + 4.1, 36.2, -0.22],
    [cx - 4.0, 52.8, 0.12],
    [cx + 4.0, 61.5, -0.15]
  ]) {
    for (const wz of [-0.46, 0.46]) {
      const wheel = new THREE.TorusGeometry(0.32, 0.032, 5, 10);
      wheel.rotateY(Math.PI * 0.5 + byaw);
      wheel.translate(bx + Math.sin(byaw) * wz, bankY + 0.42, bz + Math.cos(byaw) * wz);
      streetBikeParts.push(wheel);
    }
    addBox(streetBikeParts, 0.05, 0.05, 0.92, bx, bankY + 0.62, bz, byaw);
    addCyl(streetBikeParts, 0.025, 0.025, 0.65, 5, bx + Math.sin(byaw) * 0.32, bankY + 0.72, bz + Math.cos(byaw) * 0.32);
    addBox(streetBikeParts, 0.44, 0.04, 0.04, bx + Math.sin(byaw) * 0.34, bankY + 1.02, bz + Math.cos(byaw) * 0.34, byaw);
  }
  group.add(
    new THREE.Mesh(mergeNormalized([...streetLampParts, ...streetBikeParts]), ctx.materials.darkIronwood ?? ctx.materials.darkWood)
  );

  group.add(
    stoneMesh,
    ochreMesh,
    agedOchreMesh,
    whitePlasterMesh,
    ceramicAccentMesh,
    woodMesh,
    ironwoodMesh,
    crimsonMesh,
    tileMesh,
    bronzeMesh,
    voidMesh,
    lanternMesh,
    coreMesh,
    lightPoolMesh
  );
  tagMotifIds(group, [
    'HV-A06', 'HV-B09', 'HV-C08', 'HV-D02', 'HV-D08', 'HV-D09', 'HV-D10',
    'HV-D13', 'HV-H05', 'HV-I01', 'HV-I02', 'HV-J07', 'HV-NEW-MT-01', 'HV-NEW-MT-02'
  ]);
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
  const asphaltParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];
  const cableParts: THREE.BufferGeometry[] = [];
  const lampPostParts: THREE.BufferGeometry[] = [];
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

  // 1. FIX CR-01: 4 Spacious Wide Rounded-End Concrete Stadium Piers (replacing 7 crowded piers!)
  //    framing 3 grand asymmetric river arches (tallest 64m center arch) + 1 low west tail arch (ref 21_cau_rong_da_nang.jpg)!
  const pierXs = [264, 308, 372, 412];
  for (const px of pierXs) {
    const topY = getDeckY(px) - 0.85;
    const botY = -2.6;
    const h = topY - botY;
    // Wide monolithic concrete stadium pier body + rounded semicircular cutwater ends
    addBox(stoneParts, 3.2, h, 13.6, px, botY + h * 0.5, cz);
    for (const endZ of [-6.8, 6.8]) {
      addCyl(stoneParts, 1.6, 1.72, h, 12, px, botY + h * 0.5, cz + endZ);
    }
    // Flared stadium pier cap beam cradling under-deck dragon belly & girders
    addBox(stoneParts, 4.0, 1.15, 15.2, px, topY - 0.35, cz);
    for (const endZ of [-7.6, 7.6]) {
      addCyl(stoneParts, 2.0, 1.85, 1.15, 12, px, topY - 0.35, cz + endZ);
    }
  }
  // Solid riverbank approach abutments anchored into y = 2.0m banks
  addBox(stoneParts, 8.0, 4.2, 18.8, 229.0, 0.6, cz);
  addBox(stoneParts, 8.0, 4.2, 18.8, 441.0, 0.6, cz);

  // 2. Monumental 214m x 18m wide roadway deck, ramps, sidewalks, expansion joints & curved white streetlamps
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

    // FIX CR-04 + CR-05: Modern charcoal-grey 6-lane asphalt deck + sleek open steel railing bars (not solid box walls!)
    addBox(asphaltParts, len, 0.34, 15.2, xm, ym - 0.17, cz, 0, 0, tiltZ);
    addBox(stoneParts, len, 0.62, 18.0, xm, ym - 0.65, cz, 0, 0, tiltZ);
    for (const sz of [-8.65, 8.65]) {
      // Open horizontal top & mid steel rail bars instead of solid 0.95m wall
      addBox(steelParts, len, 0.14, 0.14, xm, ym + 0.92, cz + sz, 0, 0, tiltZ);
      addBox(steelParts, len, 0.10, 0.10, xm, ym + 0.52, cz + sz, 0, 0, tiltZ);
      addBox(stoneParts, len, 0.28, 1.5, xm, ym + 0.14, cz + sz * 0.92, 0, 0, tiltZ);
    }
    for (const gz of [-5.2, 5.2]) {
      addBox(steelParts, len, 0.82, 0.68, xm, ym - 1.15, cz + gz, 0, 0, tiltZ);
    }
    addBox(steelParts, len, 0.46, 1.65, xm, ym + 0.23, cz, 0, 0, tiltZ);

    // Curved white deck streetlamps along both outer sidewalks every ~22m
    if (i > 2 && i < deckSegs - 2 && i % 5 === 0) {
      for (const side of [-1, 1]) {
        const lampZ = cz + side * 8.45;
        const lampCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(xm, ym + 0.25, lampZ),
          new THREE.Vector3(xm, ym + 4.4, lampZ),
          new THREE.Vector3(xm, ym + 6.3, lampZ - side * 0.45),
          new THREE.Vector3(xm, ym + 6.7, lampZ - side * 1.65)
        ]);
        lampPostParts.push(new THREE.TubeGeometry(lampCurve, 10, 0.10, 6, false));
        addBox(lampPostParts, 0.45, 0.14, 0.92, xm, ym + 6.62, lampZ - side * 1.95);
      }
    }
  }

  // 3. FIX CR-01 + Smooth C2 Continuous CatmullRom Dragon Spine (eliminates piecewise-sin kinks at piers!):
  //    - West Tail (246..264): low graceful lotus tail peaking ~10.8m
  //    - West Main Arch (264..308): peak 20.6m
  //    - Grand Center Arch (308..372): tallest peak 26.8m
  //    - East Main Arch (372..412): peak 20.4m
  //    - East Neck (412..422): soaring smoothly up into Dragon Head!
  const spineControlPts: THREE.Vector3[] = [
    new THREE.Vector3(246.0, 10.9, cz),
    new THREE.Vector3(254.0, 8.8, cz),
    new THREE.Vector3(264.0, 5.8, cz),
    new THREE.Vector3(275.0, 15.2, cz),
    new THREE.Vector3(286.0, 20.6, cz),
    new THREE.Vector3(297.0, 15.2, cz),
    new THREE.Vector3(308.0, 5.8, cz),
    new THREE.Vector3(322.0, 18.8, cz),
    new THREE.Vector3(340.0, 26.8, cz),
    new THREE.Vector3(358.0, 18.8, cz),
    new THREE.Vector3(372.0, 5.8, cz),
    new THREE.Vector3(382.0, 15.0, cz),
    new THREE.Vector3(392.0, 20.4, cz),
    new THREE.Vector3(402.0, 15.0, cz),
    new THREE.Vector3(412.0, 6.2, cz),
    new THREE.Vector3(417.0, 13.8, cz),
    new THREE.Vector3(421.5, 19.0, cz)
  ];
  const smoothSpineCurve = new THREE.CatmullRomCurve3(spineControlPts, false, 'centripetal', 0.5);
  const steps = 128;
  const spinePts = smoothSpineCurve.getSpacedPoints(steps);
  const spineTangents: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const prev = spinePts[Math.max(0, i - 1)];
    const next = spinePts[Math.min(steps, i + 1)];
    spineTangents.push(new THREE.Vector3().subVectors(next, prev).normalize());
  }

  // 5 Equal-Diameter Yellow Steel Tubes (r = 0.54m) arranged in a true pentagonal spatial truss perpendicular to local tangent!
  const trussR = 1.28;
  const tubeRadius = 0.54;
  const tubeAngles = [
    Math.PI * 0.5,             // top dorsal chord
    Math.PI * 0.5 + 1.2566,    // upper-right
    Math.PI * 0.5 + 2.5133,    // lower-right
    Math.PI * 0.5 - 2.5133,    // lower-left
    Math.PI * 0.5 - 1.2566     // upper-left
  ];
  const chordArrays: THREE.Vector3[][] = tubeAngles.map(() => []);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const localNorm = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const p = spinePts[i];
    const tan = spineTangents[i];
    // Spine lies in XY plane (z = cz), so local in-plane normal is (-tan.y, tan.x, 0) and binormal is (0, 0, 1)
    localNorm.set(-tan.y, tan.x, 0).normalize();
    const taper = i < 12 ? THREE.MathUtils.lerp(0.45, 1.0, i / 12) : 1.0;
    for (let k = 0; k < 5; k++) {
      const ca = Math.cos(tubeAngles[k]);
      const sa = Math.sin(tubeAngles[k]);
      chordArrays[k].push(
        new THREE.Vector3(
          p.x + localNorm.x * sa * trussR * taper,
          p.y + localNorm.y * sa * trussR * taper,
          p.z + ca * trussR * taper
        )
      );
    }
  }
  const equalRadii = new Array(steps + 1).fill(tubeRadius).map((r, i) =>
    i < 12 ? THREE.MathUtils.lerp(0.28, r, i / 12) : r
  );
  for (let k = 0; k < 5; k++) {
    goldParts.push(createVariableTubeGeometry(chordArrays[k], equalRadii, 8));
  }
  // Flowing continuous dorsal flame-crest spine ribbon bridging smoothly over all 3 dragon arches (zero choppy breaks!)
  const dorsalRibbonPts = chordArrays[0].map((pt, idx) => {
    const t = idx / steps;
    const wave = 0.24 * Math.sin(t * Math.PI * 40.0);
    return new THREE.Vector3(pt.x, pt.y + 0.58 + wave, pt.z);
  });
  goldParts.push(
    createSmoothTaperedTubeGeometry(
      new THREE.CatmullRomCurve3(dorsalRibbonPts),
      84,
      5,
      (t) => 0.16 + 0.08 * Math.sin(t * Math.PI)
    )
  );

  // FIX CR-03 + CR-05: Swept-back thin CNC crescent steel dorsal fins + denser slender silver-white suspender cables!
  const dorsalFinShape = new THREE.Shape();
  dorsalFinShape.moveTo(-0.75, 0.0);
  dorsalFinShape.quadraticCurveTo(0.25, 0.55, 0.85, 0.0);
  dorsalFinShape.quadraticCurveTo(0.05, 0.92, -0.95, 1.58);
  dorsalFinShape.quadraticCurveTo(-0.35, 0.72, -0.75, 0.0);
  dorsalFinShape.closePath();

  // Tangent-aligned collar frames + true spatial cross-bracing (`addStrut`) + parallel vertical silver suspender cables
  const tmpQuat = new THREE.Quaternion();
  for (let i = 4; i < steps - 3; i++) {
    const p = spinePts[i];
    const tan = spineTangents[i];
    const slope = Math.atan2(tan.y, tan.x);

    // FIX CR-03: Sleek swept-back CNC crescent steel dorsal crest fins along every arch crest (ref 21_cau_rong_da_nang.jpg)
    if (i % 2 === 0 && p.y > getDeckY(p.x) + 0.6) {
      const topPt = chordArrays[0][i];
      const fin = new THREE.ExtrudeGeometry(dorsalFinShape, { depth: 0.12, bevelEnabled: false, curveSegments: 3 });
      fin.translate(0, 0, -0.06);
      fin.rotateZ(slope);
      fin.translate(topPt.x, topPt.y + 0.22, topPt.z);
      goldParts.push(fin);
    }

    // Tangent-aligned collar ring frame & spatial truss cross-bracing every 5 stations
    if (i % 5 === 0 && i + 5 <= steps) {
      const collar = new THREE.TorusGeometry(trussR + 0.18, 0.095, 6, 12);
      tmpQuat.setFromUnitVectors(zAxis, tan);
      collar.applyQuaternion(tmpQuat);
      collar.translate(p.x, p.y, p.z);
      goldParts.push(collar);

      // Spatial diagonal cross-bracing struts linking the 5 equal tubes between stations i and i+5
      for (let k = 0; k < 5; k++) {
        const nextK = (k + 1) % 5;
        addStrut(goldParts, chordArrays[k][i], chordArrays[nextK][i + 5], 0.095, 5);
      }
    }

    // FIX CR-05: Denser slender silver-white steel suspender cables (r = 0.038m, 4-sided openEnded, every 2nd station!)
    if (i % 2 === 0 && p.y > getDeckY(p.x) + 1.4) {
      const deckY = getDeckY(p.x) + 0.25;
      const lowerBellyY = p.y - trussR * 0.78;
      const cableH = lowerBellyY - deckY;
      if (cableH > 0.6) {
        for (const zOff of [-0.72, 0.72]) {
          const cab = new THREE.CylinderGeometry(0.038, 0.038, cableH, 4, 1, true);
          cab.translate(p.x, deckY + cableH * 0.5, cz + zOff);
          cableParts.push(cab);
        }
      }
    }
  }

  // Sculpted Layered Steel-Plate Lotus-Bud Tail at West tip (248.0, 18.2, cz)
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.quadraticCurveTo(0.85, 0.75, 0, 2.75);
  petalShape.quadraticCurveTo(-0.85, 0.75, 0, 0);
  const petalHole = new THREE.Path();
  petalHole.absellipse(0, 1.15, 0.22, 0.45, 0, Math.PI * 2, false, 0);
  petalShape.holes.push(petalHole);
  for (let lt = 0; lt < 8; lt++) {
    const la = (lt / 8) * Math.PI * 2;
    const petalGeo = new THREE.ExtrudeGeometry(petalShape, { depth: 0.14, bevelEnabled: false, curveSegments: 8 });
    petalGeo.translate(0, 0, -0.07);
    petalGeo.rotateZ(Math.PI * 0.36);
    petalGeo.rotateX(la);
    petalGeo.translate(247.8, 18.2, cz);
    goldParts.push(petalGeo);
  }

  // 4. Rebuilt Lý-Dynasty Sculpted CNC Steel-Plate Dragon Head at East span (x ~ 418, y ~ 18.8, z = cz)
  const hx = 417.5;
  const hy = 18.8;
  const hz = cz;

  // Layered CNC-cut steel upper jaw & cranium profile with perforated circular cutouts (shape.holes!)
  const upperHeadShape = new THREE.Shape();
  upperHeadShape.moveTo(-1.2, -0.6);
  upperHeadShape.lineTo(1.2, -0.8);
  upperHeadShape.quadraticCurveTo(4.2, -0.5, 6.2, -0.1);
  // S-curved upturned Lý snout crest
  upperHeadShape.quadraticCurveTo(7.4, 0.5, 6.8, 2.3);
  upperHeadShape.quadraticCurveTo(6.1, 3.1, 5.2, 2.2);
  upperHeadShape.quadraticCurveTo(3.8, 1.5, 2.2, 2.3);
  upperHeadShape.quadraticCurveTo(0.4, 2.8, -1.2, 1.6);
  upperHeadShape.closePath();
  // Iconic circular CNC weight-relief perforations along jaw & cheek
  for (const [cxH, cyH, rH] of [
    [1.0, 0.7, 0.42],
    [2.5, 0.6, 0.36],
    [4.0, 0.65, 0.32],
    [5.3, 0.95, 0.26]
  ]) {
    const hole = new THREE.Path();
    hole.absarc(cxH, cyH, rH, 0, Math.PI * 2, false);
    upperHeadShape.holes.push(hole);
  }
  // 5 layered CNC steel plates forming the sculpted 3D width of the Lý Dragon Head
  for (const zPlate of [-1.45, -0.75, 0, 0.75, 1.45]) {
    const scaleX = 1.0 - Math.abs(zPlate) * 0.08;
    const plate = new THREE.ExtrudeGeometry(upperHeadShape, { depth: 0.24, bevelEnabled: false, curveSegments: 10 });
    plate.scale(scaleX, scaleX, 1.0);
    plate.translate(hx, hy, hz + zPlate - 0.12);
    goldParts.push(plate);
  }

  // Perforated CNC-cut lower jaw + pointed chin beard scroll
  const lowerJawShape = new THREE.Shape();
  lowerJawShape.moveTo(0.4, -0.6);
  lowerJawShape.lineTo(5.6, -1.8);
  lowerJawShape.quadraticCurveTo(6.2, -2.5, 4.8, -2.9);
  lowerJawShape.lineTo(0.2, -1.7);
  lowerJawShape.closePath();
  for (const [cxH, cyH, rH] of [
    [2.0, -1.5, 0.25],
    [3.5, -1.9, 0.22]
  ]) {
    const jh = new THREE.Path();
    jh.absarc(cxH, cyH, rH, 0, Math.PI * 2, false);
    lowerJawShape.holes.push(jh);
  }
  for (const zPlate of [-1.0, 0, 1.0]) {
    const jawPlate = new THREE.ExtrudeGeometry(lowerJawShape, { depth: 0.22, bevelEnabled: false, curveSegments: 8 });
    jawPlate.translate(hx, hy, hz + zPlate - 0.11);
    goldParts.push(jawPlate);
  }
  // FIX CR-02: Flat Layered CNC Steel Chin Beard Plates (replacing cone!) + Flat CNC Crown Scroll + 6 Pairs of Flat Steel Flame-Mane Blades
  const beardShape = new THREE.Shape();
  beardShape.moveTo(2.4, -2.0);
  beardShape.lineTo(5.6, -2.5);
  beardShape.lineTo(4.6, -3.5);
  beardShape.lineTo(5.2, -4.2);
  beardShape.lineTo(3.2, -3.6);
  beardShape.lineTo(2.1, -2.8);
  beardShape.closePath();
  for (const bz of [-0.75, 0, 0.75]) {
    const bPlate = new THREE.ExtrudeGeometry(beardShape, { depth: 0.16, bevelEnabled: false });
    bPlate.translate(hx, hy, hz + bz - 0.08);
    goldParts.push(bPlate);
  }
  addBox(goldParts, 4.6, 0.35, 3.1, hx + 2.2, hy + 1.4, hz);
  addBox(goldParts, 4.0, 0.28, 2.2, hx + 2.8, hy - 2.1, hz, 0, 0, -0.22);

  // Iconic Lý-Dynasty Flat CNC Steel Crown Scroll (*Mào bản thép dẹt cuộn tròn* — replacing TubeGeometry!)
  const crownFlatShape = new THREE.Shape();
  crownFlatShape.moveTo(1.8, 2.0);
  crownFlatShape.quadraticCurveTo(0.2, 5.2, -1.5, 6.2);
  crownFlatShape.quadraticCurveTo(-3.2, 5.4, -2.4, 3.8);
  crownFlatShape.quadraticCurveTo(-1.3, 3.4, -1.0, 4.5);
  crownFlatShape.quadraticCurveTo(-1.6, 4.9, -1.7, 4.3);
  crownFlatShape.quadraticCurveTo(-0.4, 4.8, 0.8, 2.0);
  crownFlatShape.closePath();
  for (const czOff of [-0.45, 0.45]) {
    const cPlate = new THREE.ExtrudeGeometry(crownFlatShape, { depth: 0.16, bevelEnabled: false, curveSegments: 8 });
    cPlate.translate(hx, hy, hz + czOff - 0.08);
    goldParts.push(cPlate);
  }

  // 6 Pairs of Swept Flat CNC Steel Flame-Mane Blades (*Lưỡi bờm thép dẹt xếp lớp* — replacing tubes!)
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.6, -0.45);
  bladeShape.quadraticCurveTo(-2.4, 0.95, -5.2, 0.25);
  bladeShape.quadraticCurveTo(-2.2, -0.15, 0.6, -0.95);
  bladeShape.closePath();
  const maneLayers: Array<[number, number, number]> = [
    [-1.45, 1.85, 0.18],
    [1.45, 1.85, 0.18],
    [-1.65, 0.75, 0.05],
    [1.65, 0.75, 0.05],
    [-1.55, -0.45, -0.12],
    [1.55, -0.45, -0.12]
  ];
  for (const [mz, my, mRot] of maneLayers) {
    const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.14, bevelEnabled: false, curveSegments: 6 });
    blade.rotateZ(mRot);
    blade.translate(hx + 0.4, hy + my, hz + mz - 0.07);
    goldParts.push(blade);
  }

  // Circular raised steel eye sockets holding Flush Silver-Blue Glass Heart Eyes + CNC Steel Teeth, Tongue/Fire-Nozzle, Nostril Scrolls & Neck Collar!
  for (const sz of [-1, 1]) {
    const eyeZ = hz + sz * 1.64;
    const socket = new THREE.TorusGeometry(0.68, 0.14, 8, 16);
    socket.translate(hx + 2.25, hy + 1.25, eyeZ);
    goldParts.push(socket);
    const heartEye = createHeartGeometry(0.54, 0.10);
    heartEye.translate(hx + 2.25, hy + 1.25, eyeZ + sz * 0.02);
    eyeParts.push(heartEye);
    // Flared nostril scroll rings on upturned Lý snout + upper/lower CNC steel teeth row
    const nostrilScroll = new THREE.TorusGeometry(0.32, 0.08, 5, 10);
    nostrilScroll.translate(hx + 5.95, hy + 1.85, hz + sz * 0.92);
    goldParts.push(nostrilScroll);
    for (let tIdx = 0; tIdx < 4; tIdx++) {
      const tx = hx + 2.2 + tIdx * 0.85;
      addCone(goldParts, 0.16, 0.52, 4, tx, hy - 0.65, hz + sz * 1.15, Math.PI, 0, 0);
      addCone(goldParts, 0.14, 0.45, 4, tx, hy - 1.55 - tIdx * 0.18, hz + sz * 0.92, 0, 0, 0);
    }
  }
  // Internal steel fire-breath nozzle barrel & curled tongue plate inside open jaws
  addCyl(steelParts, 0.28, 0.34, 2.8, 8, hx + 4.1, hy - 0.72, hz, 0, 0, -Math.PI * 0.44);
  addBox(goldParts, 3.2, 0.16, 0.95, hx + 3.8, hy - 1.15, hz, 0, 0, 0.14);
  // Sculpted lotus-petal collar ring plates where the Dragon Neck emerges from the East bridge deck (x = 412)
  for (let cp = 0; cp < 6; cp++) {
    const ca = (cp / 6) * Math.PI * 2;
    addCone(goldParts, 0.55, 1.45, 4, 412.5 + Math.cos(ca) * 1.65, 9.1, hz + Math.sin(ca) * 1.65, 0, ca, -0.35);
  }

  // 5. Animated Alternating Fire-Breath & Water-Mist Spray Shader Plume
  const fireUniforms = {
    uTime: { value: 0.0 }
  };
  animatedUniforms.push(fireUniforms);

  // FIX CR-06: Tapered realistic Dragon Bridge fire/water plume (r = 3.2m, len = 15.5m) with natural breathing rest interval!
  const fireConeGeo = new THREE.ConeGeometry(3.2, 15.5, 20, 14, true);
  fireConeGeo.rotateZ(Math.PI * 0.5 + 0.18);
  fireConeGeo.translate(hx + 12.6, hy + 0.55, hz);

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
        pos.y += sin(pos.x * 0.65 - uTime * 7.5) * 0.62 * axial;
        pos.z += cos(pos.x * 0.72 - uTime * 6.2) * 0.54 * axial;
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
        float axialFade = smoothstep(0.0, 0.14, fromMouth) * pow(1.0 - smoothstep(0.18, 1.0, fromMouth), 1.45);
        float edgeFade = pow(abs(dot(normalize(vNormalDir), normalize(vViewDir))), 1.35);

        float turb = sin(vUv.x * 18.0 + uTime * 9.0) * cos(fromMouth * 12.0 - uTime * 11.0);
        float flicker = 0.72 + 0.28 * sin(uTime * 13.0 + fromMouth * 6.0) + 0.16 * turb;

        // 16s realistic weekend show cycle: 5.5s fire breath -> 4.5s water mist -> 6.0s calm rest!
        float cycle = mod(uTime, 16.0);
        float activeMask = (1.0 - smoothstep(9.6, 10.4, cycle)) * smoothstep(0.0, 0.45, cycle);
        float mistMix = smoothstep(5.2, 5.8, cycle) * (1.0 - smoothstep(9.8, 10.4, cycle));

        vec3 fireCol = mix(vec3(1.0, 0.90, 0.42), vec3(1.0, 0.34, 0.05), smoothstep(0.05, 0.72, fromMouth));
        vec3 mistCol = mix(vec3(0.86, 0.96, 1.0), vec3(0.32, 0.82, 0.96), smoothstep(0.05, 0.78, fromMouth));
        vec3 col = mix(fireCol, mistCol, mistMix);
        float alpha = clamp(axialFade * edgeFade * flicker * activeMask * mix(0.84, 0.66, mistMix), 0.0, 0.88);
        gl_FragColor = vec4(col * mix(1.45, 1.20, mistMix), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(fireShaderMat);

  // 6. East Riverbank Park Icons: Refined Cá Chép Hóa Rồng White Marble Fountain + Cầu Tình Yêu 5-Heart Lantern Pier
  const parkMarbleParts: THREE.BufferGeometry[] = [];
  const parkWoodParts: THREE.BufferGeometry[] = [];
  const parkHeartParts: THREE.BufferGeometry[] = [];
  const carpX = 446.0;
  const carpZ = -16.0;
  ctx.exclusionCircles.push({ x: carpX, z: carpZ, r: 12.0 });
  // Octagonal stepped fountain basin + lotus pedestal base
  addCyl(parkMarbleParts, 3.2, 3.5, 0.95, 8, carpX, 2.05, carpZ);
  for (let lp = 0; lp < 10; lp++) {
    const a = (lp / 10) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.65, 7, 5);
    petal.scale(0.9, 1.35, 0.45);
    petal.rotateX(0.45);
    petal.rotateY(a);
    petal.translate(carpX + Math.sin(a) * 1.45, 3.05, carpZ + Math.cos(a) * 1.45);
    parkMarbleParts.push(petal);
  }
  // Seamless S-curved white-marble Carp-Dragon (*Cá Chép Hóa Rồng*) sculpted via continuous tapered spline loft
  const carpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(carpX + 1.35, 4.1, carpZ),
    new THREE.Vector3(carpX + 0.55, 3.3, carpZ + 0.15),
    new THREE.Vector3(carpX - 0.55, 4.85, carpZ + 0.35),
    new THREE.Vector3(carpX + 0.32, 6.55, carpZ - 0.25),
    new THREE.Vector3(carpX - 0.38, 8.15, carpZ)
  ]);
  const smoothCarpDragon = createSmoothDragonParts(carpCurve, {
    baseRadius: 0.92,
    tubularSegments: 44,
    radialSegments: 12,
    headAt: 'end',
    includeLegs: false,
    dorsalCrestHeight: 0.42,
    crestWaveCount: 12
  });
  parkMarbleParts.push(
    ...smoothCarpDragon.bodyParts,
    ...smoothCarpDragon.accentParts,
    ...smoothCarpDragon.maneParts
  );
  // Sculpted carp pectoral & pelvic wave-fins (*vây ngực & vây bụng cá chép chạm sóng*) + 8 fountain water-jet spouts around basin rim!
  for (const side of [-1, 1]) {
    for (let ray = 0; ray < 3; ray++) {
      const finRay = new THREE.ConeGeometry(0.16, 1.35 - ray * 0.18, 4);
      finRay.scale(1.0, 1.0, 0.28);
      finRay.rotateZ(side * (0.85 + ray * 0.18));
      finRay.rotateX(-0.35);
      finRay.translate(carpX - 0.15, 4.95 - ray * 0.25, carpZ + side * (0.95 + ray * 0.12));
      parkMarbleParts.push(finRay);
    }
  }
  for (let j = 0; j < 8; j++) {
    const ja = (j / 8) * Math.PI * 2;
    const jx = carpX + Math.cos(ja) * 2.95;
    const jz = carpZ + Math.sin(ja) * 2.95;
    addCyl(parkMarbleParts, 0.08, 0.11, 0.42, 6, jx, 2.65, jz, -Math.sin(ja) * 0.55, 0, Math.cos(ja) * 0.55);
  }
  // Sculpted sweeping pectoral fins & forked lotus-fan carp tail
  for (const sz of [-1, 1]) {
    const finCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(carpX - 0.15, 5.4, carpZ + sz * 0.65),
      new THREE.Vector3(carpX - 0.55, 5.1, carpZ + sz * 1.45),
      new THREE.Vector3(carpX + 0.15, 4.55, carpZ + sz * 1.95)
    ]);
    parkMarbleParts.push(createSmoothTaperedTubeGeometry(finCurve, 10, 6, (t) => 0.34 * (1.0 - t * 0.72)));
  }
  const fanTail = new THREE.ConeGeometry(1.18, 1.95, 7);
  fanTail.scale(0.32, 1.0, 1.35);
  fanTail.rotateZ(-0.62);
  fanTail.translate(carpX + 1.48, 4.55, carpZ);
  parkMarbleParts.push(fanTail);
  // Water-arc spray jet curving out of Cá Chép Hóa Rồng's mouth into the Han River
  const jetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(carpX - 1.55, 8.2, carpZ),
    new THREE.Vector3(carpX - 4.2, 7.6, carpZ),
    new THREE.Vector3(carpX - 6.8, 4.2, carpZ),
    new THREE.Vector3(carpX - 8.2, 0.3, carpZ)
  ]);
  const waterJetMat = new THREE.MeshStandardMaterial({
    color: '#7ee6ff',
    emissive: '#38c0e8',
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.68,
    roughness: 0.15
  });
  ctx.extraMaterials.push(waterJetMat);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(jetCurve, 14, 0.16, 6, false), waterJetMat));

  // Cầu Tình Yêu pier extending West out over the Han River at z = -16 with railings & 5-heart red lantern clusters!
  addBox(parkWoodParts, 18.0, 0.28, 3.8, 435.0, 1.85, carpZ);
  steelParts.push(
    ...createPiercedBalustradeParts(426.2, carpZ - 1.75, 443.8, carpZ - 1.75, 1.98, 0.92, 'gold_pipe'),
    ...createPiercedBalustradeParts(426.2, carpZ + 1.75, 443.8, carpZ + 1.75, 1.98, 0.92, 'gold_pipe')
  );
  for (let px = 427; px <= 443; px += 4.0) {
    for (const pzOff of [-1.6, 1.6]) {
      addCyl(parkWoodParts, 0.14, 0.17, 4.2, 7, px, -0.1, carpZ + pzOff);
    }
    if (px < 442) {
      // Iconic Cầu Tình Yêu pillar with 5-heart red lantern cluster fanning out at top!
      addCyl(steelParts, 0.06, 0.075, 3.0, 6, px, 3.35, carpZ + 1.65);
      const heartOffsets: Array<[number, number, number]> = [
        [0, 5.15, 0],
        [-0.52, 4.72, 0.16],
        [0.52, 4.72, -0.16],
        [-0.36, 4.28, -0.18],
        [0.36, 4.28, 0.18]
      ];
      for (const [hxO, hyO, hzO] of heartOffsets) {
        const heartL = createHeartGeometry(0.32, 0.14);
        heartL.translate(px + hxO, hyO, carpZ + 1.65 + hzO);
        parkHeartParts.push(heartL);
      }
    }
  }
  const whiteMarbleMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const parkWoodMat = ctx.materials.darkWood;
  const heartLanternMat = new THREE.MeshStandardMaterial({
    color: '#ff4252',
    emissive: new THREE.Color('#ff2942'),
    emissiveIntensity: 1.55,
    roughness: 0.30
  });
  ctx.extraMaterials.push(heartLanternMat);
  group.add(
    new THREE.Mesh(mergeNormalized(parkMarbleParts), whiteMarbleMat),
    new THREE.Mesh(mergeNormalized(lampPostParts), whiteMarbleMat),
    new THREE.Mesh(mergeNormalized(parkWoodParts), parkWoodMat),
    new THREE.Mesh(mergeNormalized(parkHeartParts), heartLanternMat)
  );

  // FIX CR-04 + CR-05: Modern painted industrial yellow steel (#e8ac14), smooth grey concrete piers (#aeb3b6),
  // charcoal 6-lane asphalt roadway (#383c42), and bright silver-white stay cables (#d2d8dc)!
  const modernConcreteMat = ctx.materials.stone;
  const asphaltDeckMat = ctx.materials.darkRoof;
  const dragonPaintYellowMat = ctx.materials.gold;
  const silverCableMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), modernConcreteMat);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const asphaltMesh = new THREE.Mesh(mergeNormalized(asphaltParts), asphaltDeckMat);
  asphaltMesh.receiveShadow = true;

  const steelMesh = new THREE.Mesh(mergeNormalized(steelParts), ctx.materials.granite);
  steelMesh.castShadow = true;

  const cableMesh = new THREE.Mesh(mergeNormalized(cableParts), silverCableMat);

  const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), dragonPaintYellowMat);
  goldMesh.castShadow = true;

  const dragonEyeMat = new THREE.MeshStandardMaterial({
    color: '#b8c8d4',
    emissive: new THREE.Color('#88b2d4'),
    emissiveIntensity: 0.18,
    roughness: 0.22,
    metalness: 0.45
  });
  ctx.extraMaterials.push(dragonEyeMat);
  const eyeMesh = new THREE.Mesh(mergeNormalized(eyeParts), dragonEyeMat);

  const fireMesh = new THREE.Mesh(fireConeGeo, fireShaderMat);
  fireMesh.name = 'DragonBridgeFireBreath';

  group.add(stoneMesh, asphaltMesh, steelMesh, cableMesh, goldMesh, eyeMesh, fireMesh);
  // P1 Cầu Rồng Đà Nẵng Motif Upgrades (`MT-046`..`MT-052`): Lotus tail crown (`HV-C01`/`HV-C03`) & wave plinth (`HV-D06`)
  const dbMotifGold = new THREE.Mesh(
    mergeNormalized(createLotusPetalRingParts(258, 9.2, cz, 1.45, 10, 1, true)),
    ctx.materials.gold
  );
  dbMotifGold.castShadow = false;
  group.add(dbMotifGold);
  tagMotifIds(group, [
    'HV-A08', 'HV-B08', 'HV-C01', 'HV-C03', 'HV-D06', 'HV-NEW-MT-01'
  ]);
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
  const mossRockParts: THREE.BufferGeometry[] = [];
  const calciteParts: THREE.BufferGeometry[] = [];
  const pearlParts: THREE.BufferGeometry[] = [];
  const gourWaterParts: THREE.BufferGeometry[] = [];
  const trunkParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(88421);

  // 1. Continuous Sculpted Dark-Wet Limestone Cavern Shell (DoubleSide — ZERO side light leaks!)
  //    with a clean SW walk-in entrance portal & seamless vertical stratified Doline skylight chimney!
  const shellAz = 36;
  const shellEl = 16;
  const portalAng = Math.PI * 0.88;
  const shellPositions: number[] = [];
  const shellUvs: number[] = [];
  const shellIndices: number[] = [];

  for (let iy = 0; iy <= shellEl; iy++) {
    const v = iy / shellEl; // 0 = floorY - 6m .. 1 = doline collar floorY + 64m
    const baseY = floorY - 6.0 + v * 70.0;
    // FIX SD-01: Deform upper cavern & Doline collar from circular cylinder into irregular angular heart/triangular skylight opening (ref 22 & 58!)
    const baseR = THREE.MathUtils.lerp(54.5, 22.5, Math.pow(v, 1.32));
    for (let ix = 0; ix <= shellAz; ix++) {
      const u = ix / shellAz;
      const ang = u * Math.PI * 2;
      const dolineSkew = v * v * (0.24 * Math.cos(ang * 2.0 - 0.55) - 0.16 * Math.sin(ang * 3.0 + 0.75));
      const bump =
        2.4 * Math.sin(ang * 5.0 + v * 6.0) +
        1.5 * Math.cos(ang * 9.0 - v * 10.0) +
        0.9 * Math.sin(v * Math.PI * 8.0);
      const r = baseR * (1.0 + dolineSkew) + bump;
      shellPositions.push(cx + Math.cos(ang) * r, baseY, cz + Math.sin(ang) * r);
      shellUvs.push(u * 12.0, v * 8.0);
    }
  }
  const stride = shellAz + 1;
  for (let iy = 0; iy < shellEl; iy++) {
    const vMid = (iy + 0.5) / shellEl;
    for (let ix = 0; ix < shellAz; ix++) {
      const angMid = ((ix + 0.5) / shellAz) * Math.PI * 2;
      const diffP = Math.abs(Math.atan2(Math.sin(angMid - portalAng), Math.cos(angMid - portalAng)));
      // Carve clean arched walk-in entrance portal on SW side (vMid < 0.36 -> up to ~20m arch crown)
      const portalHalfAng = 0.24 * Math.sqrt(Math.max(0, 1.0 - Math.pow(vMid / 0.36, 2.0)));
      if (vMid < 0.36 && diffP < portalHalfAng) continue;

      const a = iy * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      shellIndices.push(a, c, b, b, c, d);
    }
  }
  const cavernShellGeo = new THREE.BufferGeometry();
  cavernShellGeo.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
  cavernShellGeo.setAttribute('uv', new THREE.Float32BufferAttribute(shellUvs, 2));
  cavernShellGeo.setIndex(shellIndices);
  cavernShellGeo.computeVertexNormals();
  rockParts.push(cavernShellGeo);

  // Vertical Stratified Doline Skylight Chimney (y = floorY + 62..80m) with stepped limestone ledges & hanging vines!
  const chimneyGeo = new THREE.CylinderGeometry(23.6, 22.4, 18.0, 28, 10, true);
  const cPos = chimneyGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const vx = cPos.getX(i);
    const vy = cPos.getY(i);
    const vz = cPos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const dolineSkew = 0.24 * Math.cos(ang * 2.0 - 0.55) - 0.16 * Math.sin(ang * 3.0 + 0.75);
    const strata = 1.0 + dolineSkew + 0.08 * Math.sin(vy * 1.45) + 0.05 * Math.cos(ang * 7.0 + vy * 0.4);
    cPos.setXYZ(i, vx * strata, vy, vz * strata);
  }
  chimneyGeo.computeVertexNormals();
  chimneyGeo.translate(cx, floorY + 71.0, cz);
  rockParts.push(chimneyGeo);

  // Hanging jungle vines & moss drapery cascading down from the Doline skylight chimney lip
  for (let v = 0; v < 26; v++) {
    const va = (v / 26) * Math.PI * 2 + rand() * 0.14;
    const vr = 22.0 + (rand() - 0.5) * 1.4;
    const vx = cx + Math.cos(va) * vr;
    const vz = cz + Math.sin(va) * vr;
    const vLen = 7.0 + rand() * 11.0;
    const vCard = new THREE.PlaneGeometry(1.25 + rand() * 0.8, vLen);
    vCard.rotateY(-va + Math.PI * 0.5);
    vCard.translate(vx, floorY + 64.0 - vLen * 0.48, vz);
    foliageParts.push(vCard);
  }

  // Towering flanking karst gate crags framing the SW cavern entrance portal
  for (const angOff of [-0.28, 0.28]) {
    const ang = portalAng + angOff;
    const px = cx + Math.cos(ang) * 51.0;
    const pz = cz + Math.sin(ang) * 51.0;
    const portalRock = createSculptedRockGeometry(1500 + angOff * 100, 11.5, 24.0, 11.0, 2);
    portalRock.translate(px, floorY + 6.5, pz);
    rockParts.push(portalRock);
  }

  // 48 Honey-Cream Fluted Calcite Ceiling Stalactites ringing mid & upper cavern vault
  for (let s = 0; s < 48; s++) {
    const a = (s / 48) * Math.PI * 2 + rand() * 0.1;
    const rr = 24.5 + rand() * 15.0;
    const sx = cx + Math.cos(a) * rr;
    const sz = cz + Math.sin(a) * rr;
    const ceilY = floorY + THREE.MathUtils.lerp(59.0, 39.0, (rr - 24.5) / 15.0);
    const drop = 3.8 + rand() * 5.8;
    addCone(calciteParts, 0.40 + rand() * 0.45, drop, 7, sx, ceilY - drop * 0.5, sz, Math.PI, rand() * Math.PI);
  }

  // 3 Terraced Cream-Ochre Calcite Rimstone Gour Pools (FIXED: turquoise water assigned to cavePoolMat, NOT calciteParts!)
  for (const [gx, gz, gr] of [
    [cx - 10, cz - 14, 4.2],
    [cx - 16, cz - 22, 3.6],
    [cx - 24, cz - 18, 3.2]
  ]) {
    // 2 terraced ruffled rimstone calcite dams
    const rimOuter = new THREE.TorusGeometry(gr, 0.36, 7, 18);
    rimOuter.rotateX(Math.PI * 0.5);
    rimOuter.scale(1.12, 0.85, 0.92);
    rimOuter.translate(gx, floorY + 0.34, gz);
    calciteParts.push(rimOuter);
    const rimInner = new THREE.TorusGeometry(gr * 0.68, 0.24, 6, 16);
    rimInner.rotateX(Math.PI * 0.5);
    rimInner.translate(gx + 0.25, floorY + 0.54, gz - 0.15);
    calciteParts.push(rimInner);

    // Glowing turquoise water disks routed to cavePoolMat!
    const waterDisk = new THREE.CircleGeometry(gr * 0.95, 16);
    waterDisk.rotateX(-Math.PI * 0.5);
    waterDisk.scale(1.10, 1.0, 0.90);
    waterDisk.translate(gx, floorY + 0.38, gz);
    gourWaterParts.push(waterDisk);

    for (let p = 0; p < 5; p++) {
      const pearl = new THREE.SphereGeometry(0.18, 7, 6);
      pearl.translate(gx + (p - 2) * 0.55, floorY + 0.52, gz + (p % 2 === 0 ? 0.3 : -0.3));
      pearlParts.push(pearl);
    }
  }

  // 2. Massive 28m-tall Honey-Cream Fluted Calcite Stalagmite Spires deeply grounded
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
    const sinkBase = gy - 4.0;
    const spire = createSculptedRockGeometry(1700 + idx * 31, st.r, st.h * 0.62, st.r * 0.92, 2);
    spire.translate(sx, sinkBase + st.h * 0.45, sz);
    calciteParts.push(spire);

    const collar = createSculptedRockGeometry(1900 + idx * 19, st.r * 1.48, st.h * 0.24, st.r * 1.38, 2);
    collar.translate(sx, sinkBase + st.h * 0.16, sz);
    calciteParts.push(collar);
  });

  // 2.1 Authentic ~38m-tall "Bàn Tay Của Chàng" (Hand of Dog) Blunt Tapering Stalagmite Monolith (ref 22, 58)
  const hodX = cx - 22.0;
  const hodZ = cz - 12.0;
  const hodBase = createSculptedRockGeometry(3301, 7.6, 20.0, 7.2, 3);
  hodBase.translate(hodX, floorY + 10.0, hodZ);
  const hodShaft = createSculptedRockGeometry(3302, 5.2, 18.5, 4.8, 3);
  hodShaft.translate(hodX + 0.8, floorY + 24.5, hodZ + 0.6);
  const hodCrown = createSculptedRockGeometry(3303, 3.2, 8.0, 3.0, 2);
  hodCrown.translate(hodX + 1.5, floorY + 34.0, hodZ + 1.1);
  calciteParts.push(hodBase, hodShaft, hodCrown);

  // 2.2 "Bức Tường Việt Nam" (The Great Wall of Vietnam): Cascading Stepped Calcite Flowstone Terraces
  //     (replaces flat 46x52x4.4m box!) + Expedition Climbing Ladder mounted cleanly OUTSIDE the slope!
  const wallZ = cz + 34.0;
  const numFlowTiers = 10;
  for (let t = 0; t < numFlowTiers; t++) {
    const frac = t / (numFlowTiers - 1);
    const ty = floorY + 2.5 + t * 4.8;
    const tz = wallZ - 5.2 + frac * 7.2; // steps cleanly upward & backward from wallZ - 5.2 to wallZ + 2.0
    const tw = THREE.MathUtils.lerp(44.0, 32.0, frac);
    const td = 6.4 - frac * 1.4;
    // Undulating organic flowstone terrace shelf
    const shelf = createSculptedRockGeometry(4450 + t * 17, tw * 0.5, 3.2, td * 0.55, 2);
    shelf.translate(cx, ty, tz);
    calciteParts.push(shelf);
    // Vertical fluted calcite flowstone curtains draping down front edge of each terrace
    for (let c = -3; c <= 3; c++) {
      const fx = cx + c * (tw * 0.125);
      addCyl(calciteParts, 1.15, 1.65, 5.4, 7, fx, ty - 1.6, tz - td * 0.36);
    }
  }

  // Expedition ladder & safety rope mounted CLEANLY OUTSIDE the stepped flowstone slope (zero buried rungs!)
  const metalParts: THREE.BufferGeometry[] = [];
  const ladBotZ = wallZ - 9.2;
  const ladTopZ = wallZ - 2.0;
  const ladBotY = floorY + 0.4;
  const ladTopY = floorY + 46.4;
  const ladVec = new THREE.Vector3(0, ladTopY - ladBotY, ladTopZ - ladBotZ);
  const ladLen = ladVec.length();
  const ladTiltX = Math.atan2(ladTopZ - ladBotZ, ladTopY - ladBotY);
  const ladMidY = (ladBotY + ladTopY) * 0.5;
  const ladMidZ = (ladBotZ + ladTopZ) * 0.5;
  addCyl(metalParts, 0.045, 0.045, ladLen, 6, cx - 0.45, ladMidY, ladMidZ, ladTiltX);
  addCyl(metalParts, 0.045, 0.045, ladLen, 6, cx + 0.45, ladMidY, ladMidZ, ladTiltX);
  for (let r = 0; r < 64; r++) {
    const rf = (r + 0.5) / 64;
    const ry = THREE.MathUtils.lerp(ladBotY, ladTopY, rf);
    const rz = THREE.MathUtils.lerp(ladBotZ, ladTopZ, rf);
    addCyl(metalParts, 0.026, 0.026, 0.92, 6, cx, ry, rz, 0, 0, Math.PI * 0.5);
  }
  addCyl(metalParts, 0.022, 0.022, ladLen + 1.2, 6, cx + 0.95, ladMidY, ladMidZ, ladTiltX);

  // 2.3 Subterranean Expedition Campsite on Fine Sandy Beach Terrace beside Lake
  const sandParts: THREE.BufferGeometry[] = [];
  const campBaseX = cx + 8.5;
  const campBaseZ = cz - 11.0;
  addBox(sandParts, 22.0, 0.55, 16.0, campBaseX, floorY + 0.25, campBaseZ);

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

    addBox(metalParts, 0.85, 0.48, 0.65, tc.x + 1.6, floorY + 0.72, tc.z + 0.4, tc.yaw);
  });

  // Expedition central table
  addBox(metalParts, 1.8, 0.08, 0.95, campBaseX - 2.5, floorY + 1.15, campBaseZ + 1.5);
  for (const tx of [-0.75, 0.75]) {
    for (const tz of [-0.38, 0.38]) {
      addCyl(metalParts, 0.03, 0.03, 0.65, 6, campBaseX - 2.5 + tx, floorY + 0.82, campBaseZ + 1.5 + tz);
    }
  }

  // FIX Floating kitchenCanopy: add 4 vertical corner frame poles + eave perimeter rails grounding it to sand terrace!
  const kCanX = campBaseX - 6.8;
  const kCanZ = campBaseZ + 2.5;
  const kCanY = floorY + 2.8;
  for (const kx of [-2.05, 2.05]) {
    for (const kz of [-1.75, 1.75]) {
      addCyl(metalParts, 0.045, 0.055, 2.55, 6, kCanX + kx, floorY + 1.52, kCanZ + kz);
    }
  }
  addBox(metalParts, 4.2, 0.06, 0.06, kCanX, kCanY - 0.08, kCanZ - 1.75);
  addBox(metalParts, 4.2, 0.06, 0.06, kCanX, kCanY - 0.08, kCanZ + 1.75);
  addBox(metalParts, 0.06, 0.06, 3.6, kCanX - 2.05, kCanY - 0.08, kCanZ);
  addBox(metalParts, 0.06, 0.06, 3.6, kCanX + 2.05, kCanY - 0.08, kCanZ);

  // 3. "Vườn Địa Đàng" (Garden of Edam) sunlit bright-moss boulders + tall slender rainforest trunks + broad wild banana fronds!
  const moundX = cx - 4.0;
  const moundZ = cz - 3.0;
  const moundGy = ctx.getHeight(moundX, moundZ);
  const mound = createSculptedRockGeometry(2101, 18.0, 4.8, 16.5, 2);
  mound.translate(moundX, moundGy - 0.5, moundZ);
  mossRockParts.push(mound);
  // FIX SD-04 & SD-05: Layered mossy talus boulders stepping across Doline floor (22 boulders) + denser Garden of Edam rainforest canopy (48 clusters)!
  for (let mb = 0; mb < 22; mb++) {
    const ma = (mb / 22) * Math.PI * 2 + rand() * 0.4;
    const md = 3.2 + rand() * 15.5;
    const mx = moundX + Math.cos(ma) * md;
    const mz = moundZ + Math.sin(ma) * md;
    if (Math.hypot(mx - campBaseX, mz - campBaseZ) < 10.5) continue;
    const mRock = createSculptedRockGeometry(2200 + mb * 19, 2.0 + rand() * 2.0, 1.4 + rand() * 1.6, 1.9 + rand() * 1.8, 1);
    mRock.translate(mx, ctx.getHeight(mx, mz) + (md < 9.5 ? 1.8 : 0.7), mz);
    mossRockParts.push(mRock);
  }

  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + rand() * 0.3;
    const dist = 2.0 + rand() * 16.5;
    const fx = moundX + Math.cos(a) * dist;
    const fz = moundZ + Math.sin(a) * dist;
    if (Math.hypot(fx - campBaseX, fz - campBaseZ) < 9.8) continue;
    const fy = ctx.getHeight(fx, fz) + (dist < 11.0 ? 2.4 : 0.2);
    const sc = 1.1 + rand() * 0.85;

    if (i % 3 === 0) {
      // Tall slender rainforest trunks reaching toward the Doline sunbeams
      const treeH = 14.5 + rand() * 6.5;
      addCyl(trunkParts, 0.20, 0.44, treeH + 2.4, 7, fx, fy + treeH * 0.5 - 1.2, fz);
      for (let b = 0; b < 3; b++) {
        const ba = (b / 3) * Math.PI * 2 + a;
        addCyl(
          trunkParts,
          0.10,
          0.26,
          2.6,
          5,
          fx + Math.cos(ba) * 0.42,
          fy - 0.15,
          fz + Math.sin(ba) * 0.42,
          Math.sin(ba) * 0.42,
          0,
          -Math.cos(ba) * 0.42
        );
      }
      foliageParts.push(createShrubCardCluster(fx, fy + treeH - 1.4, fz, 3.8 * sc, i));
      foliageParts.push(createShrubCardCluster(fx + 1.6, fy + treeH - 3.4, fz - 1.1, 2.8 * sc, i + 7));
    } else if (i % 3 === 1) {
      // Wild Banana Clusters (*Chuối rừng*) with broad arched tropical fronds!
      addCyl(trunkParts, 0.12, 0.18, 2.4 * sc, 6, fx, fy + 1.1 * sc, fz);
      for (let bf = 0; bf < 6; bf++) {
        const ba = (bf / 6) * Math.PI * 2 + rand() * 0.25;
        const frond = new THREE.PlaneGeometry(0.95 * sc, 3.2 * sc, 1, 4);
        const fPos = frond.attributes.position;
        for (let k = 0; k < fPos.count; k++) {
          const ly = fPos.getY(k) + 1.6 * sc; // 0 .. 3.2*sc
          const t = ly / (3.2 * sc);
          fPos.setY(k, Math.sin(t * Math.PI * 0.65) * 1.4 * sc);
          fPos.setZ(k, ly * 0.88);
        }
        frond.computeVertexNormals();
        frond.rotateY(ba);
        frond.translate(fx, fy + 2.1 * sc, fz);
        foliageParts.push(frond);
      }
    } else {
      // Dense cave ferns
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
  calciteParts.push(poolRim);

  const poolDisk = new THREE.CircleGeometry(11.4, 32);
  poolDisk.rotateX(-Math.PI * 0.5);
  poolDisk.scale(1.16, 1.0, 0.9);
  poolDisk.translate(poolX, poolBaseY + 0.45, poolZ);
  gourWaterParts.push(poolDisk);

  const cavePoolMat = new THREE.MeshStandardMaterial({
    color: '#0e857a',
    emissive: '#0fb59c',
    emissiveIntensity: 0.48,
    roughness: 0.12,
    metalness: 0.25
  });
  // FIX SD-03: Multi-tone Stratified Limestone Cavern Shader (weathered pale karst strata + damp cave moss + calcite mineral streaks — 0 extra tris!)
  const darkCaveRockMat = new THREE.MeshStandardMaterial({
    color: '#46494c',
    normalMap: ctx.pbr.granite.normalMap,
    roughnessMap: ctx.pbr.granite.roughnessMap,
    roughness: 0.76,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  darkCaveRockMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCaveWorldPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vCaveWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCaveWorldPos;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float strata = 0.5 + 0.5 * sin(vCaveWorldPos.y * 0.68 + sin(vCaveWorldPos.x * 0.14 + vCaveWorldPos.z * 0.14) * 2.2);
         float streak = 0.5 + 0.5 * sin(vCaveWorldPos.x * 0.42 - vCaveWorldPos.z * 0.38);
         vec3 paleLimestone = vec3(0.46, 0.44, 0.39);
         vec3 wetCharcoal = vec3(0.16, 0.17, 0.18);
         vec3 dolineMoss = vec3(0.18, 0.32, 0.14);
         vec3 caveCol = mix(wetCharcoal, paleLimestone, smoothstep(0.25, 0.85, strata) * 0.78);
         caveCol = mix(caveCol, vec3(0.54, 0.46, 0.31), smoothstep(0.68, 0.94, streak) * 0.32);
         float mossBand = smoothstep(38.0, 58.0, vCaveWorldPos.y) * smoothstep(0.35, 0.85, streak);
         diffuseColor.rgb = mix(caveCol, dolineMoss, mossBand * 0.65);`
      );
  };
  const sunlitMossMat = new THREE.MeshStandardMaterial({
    color: '#4b8532',
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.86,
    metalness: 0.02
  });
  const calciteMat = new THREE.MeshStandardMaterial({
    color: '#d8c296',
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.36,
    metalness: 0.08
  });
  const pearlMat = new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 0.22, metalness: 0.1 });
  ctx.extraMaterials.push(cavePoolMat, darkCaveRockMat, sunlitMossMat, calciteMat, pearlMat);

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
        // FIX SD-06: Warm golden-white tropical doline sunbeams (#ffeec4 -> #ffd98a, replacing mint-green!)
        vec3 beamCol = mix(vec3(1.0, 0.94, 0.78), vec3(1.0, 0.85, 0.56), vUv.y);
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

  const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), darkCaveRockMat);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;

  const mossRockMesh = new THREE.Mesh(mergeNormalized(mossRockParts), sunlitMossMat);
  mossRockMesh.castShadow = true;
  mossRockMesh.receiveShadow = true;

  const calciteMesh = new THREE.Mesh(mergeNormalized(calciteParts), calciteMat);
  calciteMesh.castShadow = true;
  calciteMesh.receiveShadow = true;

  const pearlMesh = new THREE.Mesh(mergeNormalized(pearlParts), pearlMat);

  const trunkMesh = new THREE.Mesh(mergeNormalized(trunkParts), ctx.materials.bark);
  trunkMesh.castShadow = true;

  const foliageMesh = new THREE.Mesh(mergeNormalized(foliageParts), foliageCanopyMat);
  foliageMesh.castShadow = true;

  const poolMesh = new THREE.Mesh(mergeNormalized(gourWaterParts), cavePoolMat);
  poolMesh.name = 'SonDoongReflectionPool';

  const sunbeamMesh = new THREE.Mesh(mergeNormalized(shaftParts), sunbeamMat);
  sunbeamMesh.name = 'SonDoongVolumetricSunbeams';

  group.add(rockMesh, mossRockMesh, calciteMesh, pearlMesh, trunkMesh, foliageMesh, poolMesh, sunbeamMesh);

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
  // Rào Thương Subterranean Emerald River Strip + Grounded Camp Kitchen Canopy Shelter
  const riverGeo = new THREE.PlaneGeometry(5.5, 52.0);
  riverGeo.rotateX(-Math.PI * 0.5);
  riverGeo.rotateY(0.28);
  riverGeo.translate(cx + 21.0, floorY + 0.14, cz);
  const kitchenCanopy = new THREE.BoxGeometry(4.4, 0.12, 3.8);
  kitchenCanopy.translate(kCanX, kCanY, kCanZ);
  const riverStrip = new THREE.Mesh(riverGeo, cavePoolMat);
  const kitchenMesh = new THREE.Mesh(kitchenCanopy, ctx.materials.darkRoof);
  group.add(riverStrip, kitchenMesh);

  if (innerLanternParts.length > 0) {
    const tentLampMesh = new THREE.Mesh(
      mergeNormalized(innerLanternParts),
      ctx.materials.lanternCore ?? ctx.materials.gold
    );
    group.add(tentLampMesh);
  }

  tagMotifIds(group, ['HV-NEW-MT-04', 'HV-NEW-MB-08']);
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

  const cliffParts: THREE.BufferGeometry[] = [];
  const calciteParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(55193);

  // 1. Fractured Pale-Grey-and-Ochre Vertical Limestone Cliff with Asymmetrical Low Slanted Cave Mouth hugging Son River!
  //    Cave mouth spans x in [-13.5 .. +12.5] relative to cx, left ceiling ~11.8m sloping down to ~6.2m on right!
  const cliffShape = new THREE.Shape();
  cliffShape.moveTo(-29.0, -3.0);
  cliffShape.lineTo(29.0, -3.0);
  cliffShape.lineTo(28.0, 26.0);
  cliffShape.lineTo(18.0, 36.5);
  cliffShape.lineTo(6.0, 41.0);
  cliffShape.lineTo(-9.0, 39.5);
  cliffShape.lineTo(-22.0, 34.0);
  cliffShape.lineTo(-28.5, 22.0);
  cliffShape.closePath();

  // FIX PN-01: Authentic Động Phong Nha cave mouth (ref 23): low near water on the LEFT (~2.2m) sloping diagonally UP to ~11.8m on the RIGHT!
  const mouthHole = new THREE.Path();
  mouthHole.moveTo(-13.6, -2.5);
  mouthHole.lineTo(-13.4, 2.2);
  mouthHole.quadraticCurveTo(-8.8, 5.4, -1.5, 8.6);
  mouthHole.quadraticCurveTo(5.8, 11.8, 11.4, 11.6);
  mouthHole.quadraticCurveTo(13.2, 8.8, 12.8, -2.5);
  mouthHole.closePath();
  cliffShape.holes.push(mouthHole);

  const mainCliffGeo = new THREE.ExtrudeGeometry(cliffShape, {
    depth: 10.5,
    bevelEnabled: true,
    bevelThickness: 0.45,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 14
  });
  mainCliffGeo.translate(cx, 0, cz + 3.5);
  cliffParts.push(colorizeForMerge(mainCliffGeo, '#9e9c94'));

  // Fractured angular pale-grey & mineral-ochre vertical limestone buttress slabs across cliff facade
  const slabPalette = ['#a6a49b', '#b89c6e', '#8e8d86', '#c2a87b', '#96958e'];
  for (let k = 0; k < 14; k++) {
    const sx = cx - 25.0 + k * 3.85 + (rand() - 0.5) * 1.2;
    const isOverMouth = sx > cx - 13.5 && sx < cx + 13.0;
    const baseY = isOverMouth ? 13.5 + (rand() - 0.3) * 3.0 : -1.5;
    const slabH = isOverMouth ? 16.0 + rand() * 11.0 : 24.0 + rand() * 14.0;
    const slab = new THREE.BoxGeometry(3.8 + rand() * 2.4, slabH, 3.2 + rand() * 2.2);
    slab.rotateY((rand() - 0.5) * 0.25);
    slab.rotateZ((rand() - 0.5) * 0.08);
    slab.translate(sx, baseY + slabH * 0.5, cz + 13.2 + (rand() - 0.5) * 1.6);
    cliffParts.push(colorizeForMerge(slab, slabPalette[k % slabPalette.length]));
  }

  // Deep enclosed slanted limestone cavern tunnel walls & low vaulted ceiling extending back to cz - 46
  // Inner clear width: cx - 14.2 .. cx + 13.8 (keeps Hang Bi Ký boardwalk & bank stalagmites 100% unclipped!)
  const tunnelSpan = 52.0;
  const tunnelMidZ = cz - 21.0;
  const leftWall = new THREE.BoxGeometry(8.0, 22.0, tunnelSpan);
  leftWall.translate(cx - 18.2, 8.0, tunnelMidZ);
  cliffParts.push(colorizeForMerge(leftWall, '#6e6d68'));

  const rightWall = new THREE.BoxGeometry(8.0, 20.0, tunnelSpan);
  rightWall.translate(cx + 17.8, 7.0, tunnelMidZ);
  cliffParts.push(colorizeForMerge(rightWall, '#6b6a64'));

  // Slanted cave roof slab matching asymmetrical cave mouth (low left ~7.2m rising up to ~12.6m right)
  const caveRoof = new THREE.BoxGeometry(34.0, 5.5, tunnelSpan);
  caveRoof.rotateZ(0.16);
  caveRoof.translate(cx, 12.6, tunnelMidZ);
  cliffParts.push(colorizeForMerge(caveRoof, '#77756d'));

  // Overhanging lush jungle vines & karst cliff shrubs crowning the fractured limestone brow
  const vineParts: THREE.BufferGeometry[] = [];
  for (let v = 0; v < 22; v++) {
    const vx = cx - 22.0 + v * 2.1;
    const vy = (Math.abs(vx - cx) < 12.0 ? 14.5 : 22.0) + (v % 3) * 4.2;
    vineParts.push(createShrubCardCluster(vx, vy, cz + 14.4, 2.4 + (v % 3) * 0.65, 700 + v));
  }
  const vineMat = ctx.materialLib?.getOrCreateStandard({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide }) ?? ctx.materials.darkWood;
  group.add(new THREE.Mesh(mergeNormalized(vineParts), vineMat));

  // Deep recessed cavern back closure at cz - 46 + UNCLIPPED Hang Bi Ký sandy beach & wooden boardwalk
  const backWall = createSculptedRockGeometry(3900, 22.0, 16.0, 8.0, 2);
  backWall.translate(cx, 5.0, cz - 47.0);
  cliffParts.push(colorizeForMerge(backWall, '#5a5955'));
  addBox(voidParts, 32.0, 16.0, 1.5, cx, 5.0, cz - 44.0);

  // FIX Hang Bi Ký boardwalk (previously extended to cx-17, clipping 6.7m into left wall!):
  // Now cleanly seated INSIDE open left cavern chamber (x in [cx-11.2 .. cx-5.8], clear of left wall at cx-14.2!)
  const bwX = cx - 8.5;
  const bwZ = cz - 24.0;
  const bwW = 5.4;
  const bwL = 14.5;
  addBox(woodParts, bwW, 0.30, bwL, bwX, 0.85, bwZ);
  for (let pz = -6.2; pz <= 6.2; pz += 3.1) {
    for (const px of [-2.3, 2.3]) {
      addCyl(woodParts, 0.11, 0.14, 2.2, 6, bwX + px, -0.25, bwZ + pz);
    }
  }
  woodParts.push(
    ...createPiercedBalustradeParts(bwX + 2.55, bwZ - 6.8, bwX + 2.55, bwZ + 6.8, 1.0, 0.88, 'bamboo_x')
  );

  // 2. Glossy Amber-Cream Calcite Ceiling Stalactites & 20 Bank Stalagmites pulled CLEANLY inside the visible cavern!
  for (let i = 0; i < 42; i++) {
    const sx = cx - 11.8 + rand() * 22.5;
    const sz = cz + 8.0 - rand() * 46.0;
    const ceilY = 10.6 - ((sx - cx) / 14.0) * 2.1;
    const dropLen = 1.8 + rand() * 3.4;
    const r = 0.28 + rand() * 0.44;
    addCone(calciteParts, r, dropLen, 8, sx, ceilY - dropLen * 0.45, sz, Math.PI, rand() * Math.PI);
  }
  for (let i = 0; i < 20; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Pulled cleanly inside open cavern (|sx - cx| in [8.8 .. 12.2], never buried in ±14.2 walls!)
    const sx = cx + side * (8.8 + rand() * 3.2);
    const sz = cz + 6.0 - rand() * 44.0;
    // Keep clear of the Hang Bi Ký boardwalk corridor on left bank
    if (side < 0 && sz < cz - 15.5 && sz > cz - 32.5) continue;
    const riseH = 2.4 + rand() * 3.8;
    addCone(calciteParts, 0.45 + rand() * 0.52, riseH, 8, sx, 0.05 + riseH * 0.5, sz, 0, rand() * Math.PI);
  }

  // 3. Weathered timber sightseeing dock, readable "ĐỘNG PHONG NHA" sign & 3 Detailed Dragon-Painted Wooden Tour Boats
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

  // 3 Rebuilt Authentic Phong Nha Dragon-Painted Wooden Tour Boats:
  // slender double-ended upturned wooden hull, red-gold-teal dragon gunwale trim, open-sided blue canopy timber frame
  // revealing interior wooden benches, orange life-ring & long wooden rowing oars!
  const pnBoatParts: THREE.BufferGeometry[] = [];
  for (const [bx, bz, byaw] of [
    [dockX + 1.5, dockZ - 4.0, 0.08],
    [dockX - 4.4, dockZ - 5.4, 0.25],
    [cx + 1.2, cz - 14.0, 1.52]
  ]) {
    const pushBoatGeo = (g: THREE.BufferGeometry, hex: string): void => {
      g.rotateY(byaw);
      g.translate(bx, 0, bz);
      pnBoatParts.push(colorizeForMerge(g, hex));
    };

    // FIX PN-03: Authentic slender 10.2m × 1.85m open-hull Phong Nha dragon tour boats (removed closed 4-sided ConeGeometry prow blocks!)
    const floor = new THREE.BoxGeometry(8.6, 0.14, 1.65);
    floor.translate(0, 0.08, 0);
    pushBoatGeo(floor, '#6e4526');

    for (const sz of [-1, 1]) {
      const sidePlank = new THREE.BoxGeometry(8.8, 0.56, 0.11);
      sidePlank.rotateX(sz * -0.22);
      sidePlank.translate(0, 0.34, sz * 0.88);
      pushBoatGeo(sidePlank, '#1e5b96');

      // Colorful dragon-painted gunwale trim (crimson red + golden yellow stripe)
      const redTrim = new THREE.BoxGeometry(9.0, 0.12, 0.14);
      redTrim.translate(0, 0.62, sz * 0.94);
      pushBoatGeo(redTrim, '#d12c20');
      const goldTrim = new THREE.BoxGeometry(8.8, 0.08, 0.15);
      goldTrim.translate(0, 0.48, sz * 0.93);
      pushBoatGeo(goldTrim, '#f2c628');

      // Open U-profile upturned tapered bow (+X) & stern (-X) side planks (NO closed cone pyramid!)
      for (const sx of [-1, 1]) {
        const endSide = new THREE.BoxGeometry(1.65, 0.46, 0.10);
        endSide.rotateY(-sx * sz * 0.34);
        endSide.rotateZ(sx * 0.38);
        endSide.translate(sx * 4.95, 0.62, sz * 0.56);
        pushBoatGeo(endSide, '#1e5b96');
        const endGold = new THREE.BoxGeometry(1.65, 0.08, 0.12);
        endGold.rotateY(-sx * sz * 0.34);
        endGold.rotateZ(sx * 0.38);
        endGold.translate(sx * 4.95, 0.84, sz * 0.57);
        pushBoatGeo(endGold, '#f2c628');
      }
    }

    // Upturned open U-profile bow/stern floor ramps + sculpted slim prow tip
    for (const sx of [-1, 1]) {
      const endFloor = new THREE.BoxGeometry(1.55, 0.12, 0.78);
      endFloor.rotateZ(sx * 0.42);
      endFloor.translate(sx * 4.85, 0.36, 0);
      pushBoatGeo(endFloor, '#6e4526');
      const prowTip = new THREE.BoxGeometry(0.18, 0.36, 0.56);
      prowTip.rotateZ(sx * 0.28);
      prowTip.translate(sx * 5.65, 0.98, 0);
      pushBoatGeo(prowTip, '#d12c20');
    }

    // 7 Interior transverse wooden passenger benches clearly visible through open-sided canopy!
    for (let b = -3; b <= 3; b++) {
      const bench = new THREE.BoxGeometry(0.36, 0.08, 1.62);
      bench.translate(b * 1.12, 0.44, 0);
      pushBoatGeo(bench, '#9c6838');
    }

    // Open-sided timber canopy frame (8 slender posts + curved blue tarp roof spanning 6.4m)
    for (const px of [-3.0, -1.0, 1.0, 3.0]) {
      for (const pz of [-0.86, 0.86]) {
        const post = new THREE.CylinderGeometry(0.036, 0.040, 1.48, 5);
        post.translate(px, 1.32, pz);
        pushBoatGeo(post, '#5a3820');
      }
    }
    const canopyRoof = new THREE.CylinderGeometry(0.98, 0.98, 6.4, 10, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    canopyRoof.rotateZ(Math.PI * 0.5);
    canopyRoof.scale(1.0, 0.46, 1.08);
    canopyRoof.translate(0, 1.78, 0);
    pushBoatGeo(canopyRoof, '#2474bc');

    // Bright orange safety life-ring hanging on starboard side + 2 long wooden rowing oars
    const lifeRing = new THREE.TorusGeometry(0.24, 0.065, 6, 12);
    lifeRing.translate(1.2, 1.35, 0.92);
    pushBoatGeo(lifeRing, '#f45d1e');
    for (const oz of [-0.96, 0.96]) {
      const oar = new THREE.CylinderGeometry(0.026, 0.032, 3.2, 5);
      oar.rotateZ(Math.PI * 0.46);
      oar.rotateY(oz > 0 ? 0.14 : -0.14);
      oar.translate(-2.4, 0.56, oz);
      pushBoatGeo(oar, '#b5824a');
    }
  }
  const pnBoatMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
  const cliffMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.82
  });
  const pnCalciteMat = new THREE.MeshStandardMaterial({
    color: '#d9b478',
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.30,
    metalness: 0.08
  });
  ctx.extraMaterials.push(pnBoatMat, cliffMat, pnCalciteMat);
  group.add(
    new THREE.Mesh(mergeNormalized(pnBoatParts), pnBoatMat),
    new THREE.Mesh(mergeNormalized(calciteParts), pnCalciteMat)
  );

  // FIX PN-04: Subtle realistic cave lighting illuminating amber-cream stalactites without neon disco wash (ref 23_dong_phong_nha.jpg)
  const grottoLight = new THREE.PointLight('#f5c07a', 18.0, 48.0, 1.7);
  grottoLight.position.set(cx, 7.5, cz - 4.0);
  const innerEmeraldLight = new THREE.PointLight('#4ca896', 14.0, 42.0, 1.7);
  innerEmeraldLight.position.set(cx, 5.5, cz - 24.0);
  group.add(grottoLight, innerEmeraldLight);

  const rockMesh = new THREE.Mesh(mergeNormalized(cliffParts), cliffMat);
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
  tagMotifIds(group, ['HV-NEW-MT-04', 'HV-NEW-MT-05', 'HV-NEW-MB-08', 'HV-NEW-MB-11']);
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

  // FIX MS-03: Natural earthy/grassy valley ground around Mỹ Sơn towers with low weathered brick temple plinths & narrow axial walkways (replacing rigid 58x54m stone plaza slab — ref 24!)
  const courtY = yBase + 0.12;
  addBox(brickParts, 16.0, 0.55, 30.0, cx - 7.8, yBase - 0.16, cz);
  addBox(brickParts, 30.0, 0.42, 4.6, cx + 4.5, yBase - 0.12, cz);
  for (const wallSide of [-1, 1]) {
    addBox(brickParts, 46.0, 1.35, 0.78, cx, courtY + 0.65, cz + wallSide * 24.5);
    addBox(brickParts, 0.78, 1.35, 46.0, cx - 25.0, courtY + 0.65, cz);
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

  // Iconic Kosa B5 Boat-Roofed Treasury Tower (*Tháp Kho mái hình thuyền* — ref 24_thanh_dia_my_son.jpg) at (cx + 5.5, cz - 14.5)
  const kbX = cx + 5.5;
  const kbZ = cz - 14.5;
  const kbW = 7.6;
  const kbD = 4.8;
  const kbH = 4.4;
  // 3-tier stepped masonry plinth
  addBox(brickParts, kbW + 1.1, 0.36, kbD + 1.1, kbX, courtY + 0.18, kbZ);
  addBox(brickParts, kbW + 0.65, 0.32, kbD + 0.65, kbX, courtY + 0.52, kbZ);
  addBox(brickParts, kbW + 0.30, 0.24, kbD + 0.30, kbX, courtY + 0.80, kbZ);
  const kbBodyY = courtY + 0.92;
  // Main brick cella core
  addBox(brickParts, kbW, kbH, kbD, kbX, kbBodyY + kbH * 0.5, kbZ);
  // 5 fluted brick pilasters per face (front/back along X, and left/right along Z)
  for (let p = 0; p < 5; p++) {
    const pxOff = THREE.MathUtils.lerp(-kbW * 0.44, kbW * 0.44, p / 4);
    for (const sz of [-1, 1]) {
      for (const fl of [-0.14, 0.14]) {
        addBox(brickParts, 0.18, kbH * 0.96, 0.24, kbX + pxOff + fl, kbBodyY + kbH * 0.48, kbZ + sz * (kbD * 0.5 + 0.08));
      }
    }
    const pzOff = THREE.MathUtils.lerp(-kbD * 0.42, kbD * 0.42, p / 4);
    for (const sx of [-1, 1]) {
      for (const fl of [-0.11, 0.11]) {
        addBox(brickParts, 0.24, kbH * 0.96, 0.15, kbX + sx * (kbW * 0.5 + 0.08), kbBodyY + kbH * 0.48, kbZ + pzOff + fl);
      }
    }
  }
  // 6-tier projecting stepped brick cornice wrapping top of Kosa B5
  const kbCorniceY0 = kbBodyY + kbH;
  for (let ct = 0; ct < 6; ct++) {
    const flare = ct === 2 || ct === 4 ? 0.58 : ct === 5 ? 0.72 : 0.26;
    addBox(brickParts, kbW + flare, 0.18, kbD + flare, kbX, kbCorniceY0 + ct * 0.18 + 0.09, kbZ);
  }
  const kbRoofY = kbCorniceY0 + 6 * 0.18;
  // 4 corner brick acroteria finials flanking the recessed attic story on the main cornice shoulder (ref 24, 86)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(brickParts, 0.58, 0.72, 0.58, kbX + sx * (kbW * 0.46), kbRoofY + 0.36, kbZ + sz * (kbD * 0.44));
      addCone(brickParts, 0.34, 0.72, 4, kbX + sx * (kbW * 0.46), kbRoofY + 1.08, kbZ + sz * (kbD * 0.44), 0, Math.PI * 0.25);
    }
  }
  // Recessed Attic Story (*tầng lửng Tháp Kho Kosa B5*): 6.2m × 3.2m × 2.0m with 7 vertical pilasters + 4-tier cornice
  const kbAtticW = 6.2;
  const kbAtticD = 3.2;
  const kbAtticH = 2.0;
  addBox(brickParts, kbAtticW, kbAtticH, kbAtticD, kbX, kbRoofY + kbAtticH * 0.5, kbZ);
  for (let ap = 0; ap < 7; ap++) {
    const apx = THREE.MathUtils.lerp(-kbAtticW * 0.45, kbAtticW * 0.45, ap / 6);
    for (const sz of [-1, 1]) {
      addBox(brickParts, 0.22, kbAtticH * 0.94, 0.20, kbX + apx, kbRoofY + kbAtticH * 0.47, kbZ + sz * (kbAtticD * 0.5 + 0.06));
    }
  }
  const kbAtticCorniceY0 = kbRoofY + kbAtticH;
  for (let act = 0; act < 4; act++) {
    const afl = act === 3 ? 0.52 : 0.24 + act * 0.07;
    addBox(brickParts, kbAtticW + afl, 0.14, kbAtticD + afl, kbX, kbAtticCorniceY0 + act * 0.14 + 0.07, kbZ);
  }
  const kbAtticTopY = kbAtticCorniceY0 + 4 * 0.14;
  // Authentic curved Chăm Pa boat-shaped saddle roof (*mái hình thuyền yên ngựa*) crowning the attic story
  const kosaRoof = createBoatSaddleRoofGeometry(6.8, 3.5, 2.8, 1.05);
  kosaRoof.translate(kbX, kbAtticTopY, kbZ);
  brickParts.push(kosaRoof);

  // Kosa B5 South-facing stepped corbelled brick arch vestibule + pale grey sandstone U-frame doorway + 3 brick steps
  const kbVestZ = kbZ + kbD * 0.5 + 1.05;
  const kbVestWall = createSteppedCorbelArchWallGeometry(3.4, 3.85, 2.1, 1.85, 3.15, 6);
  kbVestWall.translate(kbX, kbBodyY, kbVestZ);
  brickParts.push(kbVestWall);
  // Pale grey sandstone U-frame doorway nested cleanly inside the corbelled brick arch
  for (const sx of [-0.78, 0.78]) {
    addBox(stoneParts, 0.34, 2.35, 0.46, kbX + sx, kbBodyY + 1.18, kbVestZ + 0.88);
  }
  addBox(stoneParts, 1.92, 0.36, 0.52, kbX, kbBodyY + 2.48, kbVestZ + 0.88);
  // 3 stepped brick entrance steps leading up to Kosa B5 threshold
  for (let st = 0; st < 3; st++) {
    addBox(brickParts, 2.5 - st * 0.16, 0.30, 0.55, kbX, courtY + 0.15 + st * 0.30, kbVestZ + 1.75 - st * 0.45);
  }

  // Half-ruined brick sub-tower (*Phế tích tháp phụ sụp nửa thân*) at (cx - 1.5, cz + 14.0) exposing ancient brick core
  const ruinX = cx - 1.5;
  const ruinZ = cz + 14.0;
  addBox(brickParts, 5.2, 0.65, 5.2, ruinX, courtY + 0.32, ruinZ);
  addBox(brickParts, 4.4, 4.8, 0.82, ruinX, courtY + 3.0, ruinZ - 1.8);
  addBox(brickParts, 0.82, 3.9, 4.2, ruinX - 1.8, courtY + 2.55, ruinZ);
  addBox(brickParts, 0.82, 2.6, 3.6, ruinX + 1.8, courtY + 1.9, ruinZ - 0.3);
  addBox(brickParts, 2.8, 1.8, 0.78, ruinX - 0.7, courtY + 1.5, ruinZ + 1.8);
  // Fallen brick rubble blocks & white lichen patches on horizontal brick ledges of sanctuary towers
  const ruinRand = mulberry32(41901);
  for (let rb = 0; rb < 10; rb++) {
    const a = (rb / 10) * Math.PI * 2;
    const dist = 2.4 + ruinRand() * 1.6;
    addBox(
      brickParts,
      0.55 + ruinRand() * 0.45,
      0.38 + ruinRand() * 0.25,
      0.48 + ruinRand() * 0.38,
      ruinX + Math.cos(a) * dist,
      courtY + 0.22,
      ruinZ + Math.sin(a) * dist,
      ruinRand() * Math.PI
    );
  }
  // Creeping green ferns & pale white lichen patches clinging to horizontal tower brick ledges
  for (const tw of towers) {
    const ledgeY = courtY + tw.h * 0.49;
    for (let fl = 0; fl < 4; fl++) {
      const fa = (fl / 4) * Math.PI * 2 + 0.4;
      mossParts.push(
        createShrubCardCluster(
          cx + tw.ox + Math.cos(fa) * (tw.w * 0.48),
          ledgeY,
          cz + tw.oz + Math.sin(fa) * (tw.w * 0.48),
          0.72,
          fl + Math.round(tw.h)
        )
      );
      addBox(
        stoneParts,
        0.55,
        0.08,
        0.42,
        cx + tw.ox + Math.cos(fa + 0.5) * (tw.w * 0.46),
        ledgeY + 0.05,
        cz + tw.oz + Math.sin(fa + 0.5) * (tw.w * 0.46)
      );
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

  // P0/P1 Mỹ Sơn Chăm Pa Motif Upgrades (MOTIF_PLAN_MIEN_TRUNG.md MT-067..MT-073):
  // Sculpted Chăm acanthus scroll bands (`HV-C10`) & Apsara bas-relief panels (`HV-F06`) flanking Tower A1 plinth
  stoneParts.push(
    ...createMotifBandParts('day_la_cham', cx - 5.6, cz + 5.4, cx + 5.6, cz + 5.4, courtY + 0.95, 0.22, 0.06),
    ...createBasReliefPanelParts(cx - 2.4, courtY + 1.45, cz + 5.45, 0.92, 1.15, 0, 'apsara'),
    ...createBasReliefPanelParts(cx + 2.4, courtY + 1.45, cz + 5.45, 0.92, 1.15, 0, 'apsara')
  );
  // Restore Mỹ Sơn damp mossy ancient Chăm brick material (distinct from sun-baked Poshanu!)
  const brickMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brickParts), 1.9), ctx.materials.chamBrick);
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  const stoneMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(stoneParts), 2.4),
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
  tagMotifIds(group, [
    'HV-C09', 'HV-C10', 'HV-F01', 'HV-F02', 'HV-F03', 'HV-F04', 'HV-F05',
    'HV-F06', 'HV-F07', 'HV-F09', 'HV-F10', 'HV-F11',
    'HV-NEW-MT-05', 'HV-NEW-MT-06', 'HV-NEW-MT-07'
  ]);
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

  // 1. Natural 2-Level Bà Nài Hill Bluff (FIX PS-02: removed oversized 28m flanking walls; Tower B sits on lower step -1.25m!)
  addBox(stoneParts, 28.0, 2.4, 30.0, cx, yBase - 0.85, cz);
  addBox(stoneParts, 17.5, 1.15, 16.0, cx - 0.5, yBase + 0.72, cz + 1.8);
  const podiumY = yBase + 1.28;
  const lowerPodiumY = yBase + 0.12;

  // Short red-brick connecting stairs between lower Tower B bluff and higher Tower A terrace (ref 25)
  for (let s = 0; s < 5; s++) {
    addBox(brickParts, 2.6, 0.24, 0.52, cx - 1.8, lowerPodiumY + 0.12 + s * 0.23, cz - 5.2 + s * 0.45);
  }
  // Approach stone stairway on the West (-X) face leading down to bluff ground
  for (let s = 0; s < 6; s++) {
    addBox(stoneParts, 1.0, 0.36, 5.4, cx - 13.8 - s * 0.85, yBase + 0.88 - s * 0.22, cz);
  }

  // 2. Authentic Hoa Lai Style Trio (16m Tower A on upper mound, 12m Tower B on lower step, 5m Tower C)
  const towers = [
    { ox: -1.2, oz: 0.0, w: 5.6, h: 16.0, tiers: 4, ty: podiumY },
    { ox: -2.4, oz: -8.6, w: 4.4, h: 12.0, tiers: 3, ty: lowerPodiumY },
    { ox: 2.8, oz: 8.2, w: 2.6, h: 5.0, tiers: 2, ty: podiumY }
  ];
  towers.forEach((tw, idx) => {
    const tGeo = createChamTowerGeometry(tw.w, tw.h, tw.tiers, {
      hoaLaiStyle: true,
      skipBuiltInVestibule: idx === 0
    });
    tGeo.rotateY(Math.PI * 0.5);
    tGeo.translate(cx + tw.ox, tw.ty, cz + tw.oz);
    brickParts.push(tGeo);
  });

  // FIX PS-01: Iconic Stepped Corbelled Triangular Arch East Vestibule on Tower A (9 crisp brick steps — ref 87_thap_poshanu_chi_tiet.jpg!)
  const vx = cx + 2.55;
  const vestArch = createSteppedCorbelArchWallGeometry(3.8, 4.35, 3.2, 1.95, 3.55, 9);
  vestArch.rotateY(Math.PI * 0.5);
  vestArch.translate(vx, podiumY, cz);
  brickParts.push(vestArch);
  // Weathered stepped brick gable cap crowning the East vestibule (replaces smooth 4-sided cone!)
  addBox(brickParts, 2.7, 0.48, 3.1, vx - 0.15, podiumY + 4.58, cz);
  addBox(brickParts, 2.1, 0.42, 2.4, vx - 0.25, podiumY + 5.02, cz);
  addBox(brickParts, 1.4, 0.36, 1.65, vx - 0.35, podiumY + 5.40, cz);
  // Black-stone Linga-Yoni + bronze censer + oil lamps + warm interior sanctum PointLight
  addBox(blackStoneParts, 1.35, 0.42, 1.35, vx - 0.2, podiumY + 0.22, cz);
  addCyl(blackStoneParts, 0.22, 0.25, 0.88, 12, vx - 0.2, podiumY + 0.84, cz);
  bronzeParts.push(...createBronzeIncenseTripodParts(vx + 0.72, podiumY, cz, 0.55).bronzeParts);
  const poLight = new THREE.PointLight('#ffb562', 2.4, 14, 1.4);
  poLight.position.set(vx + 0.4, podiumY + 2.1, cz);
  group.add(poLight);

  // FIX PS-04: Arid golden-grass coastal scrub & wild Bà Nài Hill bushes replacing smooth granite balls & lollipop spheres (ref 25!)
  const rand = mulberry32(72341);
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + 0.4;
    const dist = 16.5 + rand() * 6.5;
    const bx = cx + Math.cos(ang) * dist;
    const bz = cz + Math.sin(ang) * dist;
    const by = ctx.getHeight(bx, bz);
    if (i % 2 === 0) {
      const rock = createSculptedRockGeometry(5100 + i * 29, 1.2 + rand() * 0.8, 0.65 + rand() * 0.45, 1.1 + rand() * 0.7, 1);
      rock.translate(bx, by + 0.12, bz);
      boulderParts.push(rock);
    }
    // Dry coastal golden-grass & olive scrub tufts
    const tuft = new THREE.ConeGeometry(0.95 + rand() * 0.55, 0.78 + rand() * 0.45, 5);
    tuft.translate(bx + 0.8, by + 0.35, bz - 0.6);
    blossomParts.push(colorizeForMerge(tuft, i % 3 === 0 ? '#9e8c48' : '#5c7338'));
  }
  for (let f = 0; f < 6; f++) {
    const a = (f / 6) * Math.PI * 2 + 0.3;
    const fx = cx + Math.cos(a) * 16.0;
    const fz = cz + Math.sin(a) * 18.0;
    const fy = ctx.getHeight(fx, fz);
    addCyl(barkParts, 0.12, 0.22, 3.2, 6, fx, fy + 1.5, fz);
    for (let br = 0; br < 3; br++) {
      const ba = (br / 3) * Math.PI * 2 + f;
      const shrub = createShrubCardCluster(fx + Math.cos(ba) * 0.85, fy + 3.2 + br * 0.22, fz + Math.sin(ba) * 0.85, 1.15, f * 7 + br);
      blossomParts.push(colorizeForMerge(shrub, br === 0 ? '#dfd29c' : '#58783a'));
    }
  }

  // P1 Tháp Poshanư Hòa Lai Chăm Motif Upgrades (`MT-074`..`MT-078`): Chăm acanthus band (`HV-C10`) & Apsara bas-relief (`HV-F06`)
  const psMotifMesh = new THREE.Mesh(
    mergeNormalized([
      ...createMotifBandParts('day_la_cham', cx - 4.2, cz + 4.2, cx + 4.2, cz + 4.2, podiumY + 0.35, 0.20, 0.055),
      ...createBasReliefPanelParts(cx - 1.8, podiumY + 0.95, cz + 4.25, 0.85, 1.05, 0, 'apsara'),
      ...createBasReliefPanelParts(cx + 1.8, podiumY + 0.95, cz + 4.25, 0.85, 1.05, 0, 'apsara')
    ]),
    ctx.materials.ochreSand ?? ctx.materials.stone
  );
  psMotifMesh.castShadow = false;
  group.add(psMotifMesh);
  tagMotifIds(group, [
    'HV-C09', 'HV-C10', 'HV-F03', 'HV-F04', 'HV-F06', 'HV-F09', 'HV-F11', 'HV-NEW-MT-08'
  ]);
  // FIX PS-03: Sun-baked warm terracotta coastal Bình Thuận brick (#cf764c) distinct from damp dark-mossy Mỹ Sơn brick (ref 25)!
  const poshanuBrickMat = new THREE.MeshStandardMaterial({
    color: '#cf764c',
    map: ctx.pbr.chamBrick?.map,
    normalMap: ctx.pbr.chamBrick?.normalMap,
    roughnessMap: ctx.pbr.chamBrick?.roughnessMap,
    roughness: 0.88,
    metalness: 0.02
  });
  ctx.extraMaterials.push(poshanuBrickMat);
  const brickMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brickParts), 1.9), poshanuBrickMat);
  brickMesh.castShadow = true;
  brickMesh.receiveShadow = true;

  const stoneMesh = new THREE.Mesh(
    applyWorldBoxUV(mergeNormalized(stoneParts), 2.4),
    ctx.materials.ochreSand ?? ctx.materials.stone
  );
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  const boulderMesh = new THREE.Mesh(mergeNormalized(boulderParts), ctx.materials.granite);
  boulderMesh.castShadow = true;

  const blackStoneMat = ctx.materials.granite;
  const frangipaniMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }) ?? ctx.materials.whitePlaster;

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
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 58.0 },
    { x: cx + 28, z: cz + 18, r: 22.0 },
    { x: cx - 34, z: cz - 14, r: 20.0 },
    { x: cx + 4, z: cz + 38, r: 22.0 }
  );

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
  // FIX DL-03: Keep Langbiang timber lookout pavilion authentic without ahistorical Hội An silk lantern (ref 26)!

  // 2b. Sculpted Embracing K'Lang & H'Biang Lovers Statue + Freestanding 3D White "LANGBIANG" Hillside Letters + Trapezoidal Heritage Pedestal + 2 UAZ-469 Jeeps + Đa Thiện Lake & Swan Boats
  const statX = cx - 6.5;
  const statZ = cz - 5.5;
  addBatteredBox(stoneParts, 2.3, 2.7, 2.3, 2.7, 1.4, statX, terraceY + 0.7, statZ);
  // K'Lang (left, taller) & H'Biang (right, leaning inward in embrace)
  addCyl(bronzeParts, 0.24, 0.44, 1.38, 10, statX - 0.30, terraceY + 2.09, statZ, 0, 0, -0.08);
  addCyl(bronzeParts, 0.28, 0.22, 0.96, 10, statX - 0.24, terraceY + 3.22, statZ, 0, 0, -0.10);
  addCyl(bronzeParts, 0.22, 0.48, 1.30, 10, statX + 0.30, terraceY + 2.05, statZ, 0, 0, 0.08);
  addCyl(bronzeParts, 0.24, 0.20, 0.88, 10, statX + 0.22, terraceY + 3.10, statZ, 0, 0, 0.12);
  bronzeParts.push(new THREE.SphereGeometry(0.24, 8, 6).translate(statX - 0.16, terraceY + 3.90, statZ + 0.04));
  bronzeParts.push(new THREE.SphereGeometry(0.22, 8, 6).translate(statX + 0.16, terraceY + 3.74, statZ - 0.02));
  // Embracing arms wrapping across both figures
  addCyl(bronzeParts, 0.08, 0.09, 0.78, 7, statX, terraceY + 3.32, statZ + 0.18, 0.25, 0, Math.PI * 0.46);
  addCyl(bronzeParts, 0.07, 0.08, 0.74, 7, statX, terraceY + 3.18, statZ - 0.16, -0.25, 0, -Math.PI * 0.44);

  // Iconic Freestanding 3D White Hillside Letters "LANGBIANG" (with tall mountain-peak triangles for the two 'A's & pink cherry-blossom dot on 'I') + Trapezoidal National Heritage Rubble Pedestal
  const whiteLetterParts: THREE.BufferGeometry[] = [];
  const letterBaseX = cx + 11.2;
  const letterBaseZ = cz - 9.4;
  const letterBaseY = ctx.getHeight(letterBaseX, letterBaseZ) + 0.15;
  // Trapezoidal dark stone pedestal with blue heritage plaque
  addBatteredBox(stoneParts, 3.6, 4.4, 0.85, 1.25, 1.35, letterBaseX - 3.6, letterBaseY + 0.65, letterBaseZ + 1.5, -0.25);
  const heritagePlaque = createSignagePlaqueMesh(
    { text: 'DI TÍCH QUỐC GIA', subText: 'THẮNG CẢNH LANGBIANG', width: 2.8, height: 0.72, style: 'blue_plaque' },
    ctx
  );
  heritagePlaque.rotation.y = 0.25;
  heritagePlaque.position.set(letterBaseX - 3.45, letterBaseY + 0.72, letterBaseZ + 2.02);
  group.add(heritagePlaque);

  const letterGlyphs = ['L', 'A', 'N', 'G', 'B', 'I', 'A', 'N', 'G'];
  for (let li = 0; li < letterGlyphs.length; li++) {
    const ch = letterGlyphs[li];
    const lx = letterBaseX + (li - 4) * 1.15;
    const lz = letterBaseZ + (li - 4) * 0.28;
    const ly = ctx.getHeight(lx, lz) + 0.18;
    addBox(stoneParts, 0.96, 0.28, 0.56, lx, ly + 0.14, lz, -0.24);
    if (ch === 'A') {
      // Iconic tall pointed mountain-peak triangle 'A' reaching higher than other letters (ref 26)
      addBox(whiteLetterParts, 0.24, 2.65, 0.30, lx - 0.26, ly + 1.48, lz - 0.06, -0.24, 0, -0.21);
      addBox(whiteLetterParts, 0.24, 2.65, 0.30, lx + 0.26, ly + 1.48, lz + 0.06, -0.24, 0, 0.21);
      addBox(whiteLetterParts, 0.24, 0.26, 0.30, lx, ly + 2.72, lz, -0.24);
      addBox(whiteLetterParts, 0.62, 0.22, 0.30, lx, ly + 1.12, lz, -0.24);
    } else if (ch === 'I') {
      addBox(whiteLetterParts, 0.24, 1.48, 0.28, lx, ly + 1.02, lz, -0.24);
      // 5-petal pink Mai Anh Đào cherry blossom crowning the 'I'
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const pet = new THREE.SphereGeometry(0.12, 6, 5);
        pet.translate(lx + Math.cos(pa) * 0.14, ly + 2.04 + Math.sin(pa) * 0.14, lz);
        flowerParts.push(colorizeForMerge(pet, '#f78fb3'));
      }
    } else if (ch === 'L') {
      addBox(whiteLetterParts, 0.22, 1.68, 0.28, lx - 0.24, ly + 1.12, lz - 0.06, -0.24);
      addBox(whiteLetterParts, 0.68, 0.22, 0.28, lx, ly + 0.39, lz, -0.24);
    } else if (ch === 'N') {
      // Clean open 'N': twin verticals + single diagonal stroke (no top/bottom box closure!)
      addBox(whiteLetterParts, 0.20, 1.68, 0.28, lx - 0.28, ly + 1.12, lz - 0.06, -0.24);
      addBox(whiteLetterParts, 0.20, 1.68, 0.28, lx + 0.28, ly + 1.12, lz + 0.06, -0.24);
      addBox(whiteLetterParts, 0.19, 1.78, 0.26, lx, ly + 1.12, lz, -0.24, 0, 0.34);
    } else if (ch === 'G') {
      // Clean open 'G': left stem + top/bottom bars + lower-right half stem + inward spur (no upper-right wall!)
      addBox(whiteLetterParts, 0.20, 1.68, 0.28, lx - 0.28, ly + 1.12, lz - 0.06, -0.24);
      addBox(whiteLetterParts, 0.68, 0.20, 0.28, lx, ly + 1.86, lz, -0.24);
      addBox(whiteLetterParts, 0.68, 0.20, 0.28, lx, ly + 0.39, lz, -0.24);
      addBox(whiteLetterParts, 0.20, 0.84, 0.28, lx + 0.28, ly + 0.72, lz + 0.06, -0.24);
      addBox(whiteLetterParts, 0.36, 0.18, 0.28, lx + 0.16, ly + 1.06, lz + 0.04, -0.24);
    } else {
      // Sculpted 'B': straight left stem + top/mid/bottom bars + twin distinct upper/lower right bowls
      addBox(whiteLetterParts, 0.22, 1.68, 0.28, lx - 0.28, ly + 1.12, lz - 0.06, -0.24);
      addBox(whiteLetterParts, 0.62, 0.20, 0.28, lx - 0.02, ly + 1.86, lz, -0.24);
      addBox(whiteLetterParts, 0.58, 0.18, 0.28, lx - 0.02, ly + 1.14, lz, -0.24);
      addBox(whiteLetterParts, 0.66, 0.20, 0.28, lx, ly + 0.39, lz, -0.24);
      addBox(whiteLetterParts, 0.20, 0.66, 0.28, lx + 0.22, ly + 1.50, lz + 0.05, -0.24);
      addBox(whiteLetterParts, 0.20, 0.68, 0.28, lx + 0.26, ly + 0.76, lz + 0.06, -0.24);
    }
  }

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

  // 2 Authentic Emerald-Teal Langbiang UAZ-469 Summit Jeeps (with Spare Tire, Roll-Cage & Hood Grille)
  const jeepBodyParts: THREE.BufferGeometry[] = [];
  const jeepDarkParts: THREE.BufferGeometry[] = [];
  for (const [jx, jz, jyaw] of [
    [cx + 16.5, cz - 8.5, -0.45],
    [cx + 15.5, cz + 9.2, 0.38]
  ]) {
    const jy = ctx.getHeight(jx, jz);
    const j = createUAZ469JeepParts(jx, jy, jz, jyaw);
    jeepBodyParts.push(...j.bodyParts);
    jeepDarkParts.push(...j.darkParts);
    whiteLetterParts.push(...j.lightParts);
  }
  const jeepMat = new THREE.MeshStandardMaterial({ color: '#107c64', roughness: 0.45, metalness: 0.25 });
  ctx.extraMaterials.push(jeepMat);
  group.add(
    new THREE.Mesh(mergeNormalized(jeepBodyParts), jeepMat),
    new THREE.Mesh(mergeNormalized(jeepDarkParts), ctx.materials.darkVoid)
  );

  // 3 Floral Heart Archways + Đa Thiện Mini-Lake (16×12m) with 2 Sculpted White Swan Pedal Boats
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
  const lakeWaterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.granite;
  const swanMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const swanParts: THREE.BufferGeometry[] = [...whiteLetterParts];
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
    const head = new THREE.SphereGeometry(0.13, 7, 6);
    head.translate(sx, lakeY + 1.32, sz + 0.82);
    const beak = new THREE.ConeGeometry(0.06, 0.24, 5);
    beak.rotateX(Math.PI * 0.58);
    beak.translate(sx, lakeY + 1.30, sz + 0.98);
    flowerParts.push(colorizeForMerge(beak, '#f39c12'));
    for (const side of [-1, 1]) {
      const wing = new THREE.SphereGeometry(0.45, 7, 5);
      wing.scale(0.28, 0.52, 1.25);
      wing.translate(sx + side * 0.48, lakeY + 0.62, sz - 0.05);
      swanParts.push(wing);
    }
    swanParts.push(hull, neck, head);
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

  // 4. Towering Đà Lạt Umbrella Pines (*Thông Ba Lá — Pinus kesiya*) + Pink Mai Anh Đào Cherry Blossoms
  const pineCount = 22;
  for (let i = 0; i < pineCount; i++) {
    const ang = (i / pineCount) * Math.PI * 2 + 0.18;
    const dist = 20.0 + rand() * 14.0;
    const px = cx + Math.cos(ang) * dist;
    const pz = cz + Math.sin(ang) * dist;
    if (px > cx + 8.0 && Math.abs(pz - cz) < 5.5) continue;
    // Keep pines clear of the 3 new iconic Đà Lạt landmarks (Quảng Trường Lâm Viên, Nhà Thờ Con Gà, Ga Đà Lạt)
    if (Math.hypot(px - (cx + 26), pz - (cz + 18)) < 16.0) continue;
    if (Math.hypot(px - (cx - 34), pz - (cz - 14)) < 14.5) continue;
    if (Math.hypot(px - (cx + 4), pz - (cz + 38)) < 15.0) continue;
    const py = ctx.getHeight(px, pz) - 0.6;
    const sc = 0.95 + rand() * 0.25;
    const upine = createUmbrellaPineParts(px, py, pz, 15.5 * sc, 700 + i);
    barkParts.push(...upine.barkParts);
    for (const lp of upine.leafParts) {
      pineParts.push(colorizeForMerge(lp, i % 4 === 0 ? '#f69bb8' : '#2d6b36'));
    }
  }

  // 5. ICONIC ĐÀ LẠT FAMOUS LANDMARKS PANORAMA:
  //    (a) Quảng Trường Lâm Viên: Nụ Hoa Atisô Khổng Lồ (Emerald Glass Artichoke) & Bông Hoa Dã Quỳ Khổng Lồ (Golden Sunflower)
  //    (b) Nhà Thờ Con Gà (Đà Lạt Romanesque Pink Cathedral with 21m Bell Tower & Golden Rooster Weathervane)
  //    (c) Ga Đà Lạt (Art Deco 3-Peak Roof Railway Station + Vintage Steam Locomotive on Steel Tracks)
  const dalatArchParts: THREE.BufferGeometry[] = [];
  const dalatGlassParts: THREE.BufferGeometry[] = [];

  // (a) Quảng Trường Lâm Viên waterfront plaza at (cx + 26, cz + 18)
  const sqX = cx + 26.0;
  const sqZ = cz + 18.0;
  const sqY = ctx.getHeight(sqX, sqZ);
  addBox(stoneParts, 28.0, 2.8, 22.0, sqX, sqY - 1.1, sqZ, -0.18);
  const sqTopY = sqY + 0.30;

  // (a1) Nụ Hoa Atisô Khổng Lồ (13m spiral-petal emerald glass artichoke bud with white diagrid steel ribs)
  const artX = sqX - 6.5;
  const artZ = sqZ - 3.5;
  addCyl(stoneParts, 5.2, 5.6, 0.55, 16, artX, sqTopY + 0.25, artZ);
  for (let tier = 0; tier < 4; tier++) {
    const petalCount = 8 - tier;
    const tY = sqTopY + 1.6 + tier * 2.55;
    const ringR = 4.2 - tier * 0.85;
    const tilt = 0.22 + tier * 0.16;
    for (let p = 0; p < petalCount; p++) {
      const a = (p / petalCount) * Math.PI * 2 + tier * 0.42;
      const petH = 3.6 - tier * 0.38;
      const petW = 2.6 - tier * 0.24;
      const pet = new THREE.ConeGeometry(petW * 0.58, petH, 4);
      pet.scale(1.0, 1.0, 0.32);
      pet.rotateX(-tilt);
      pet.rotateY(a);
      pet.translate(artX + Math.sin(a) * ringR * 0.72, tY + petH * 0.35, artZ + Math.cos(a) * ringR * 0.72);
      dalatGlassParts.push(colorizeForMerge(pet, tier % 2 === 0 ? '#27a86b' : '#4ec978'));
      // Crisp white geometric rib framing each artichoke glass leaf
      const rib = new THREE.CylinderGeometry(0.06, 0.08, petH * 1.04, 5);
      rib.rotateX(-tilt);
      rib.rotateY(a);
      rib.translate(artX + Math.sin(a) * (ringR * 0.72 + 0.28), tY + petH * 0.35, artZ + Math.cos(a) * (ringR * 0.72 + 0.28));
      dalatArchParts.push(colorizeForMerge(rib, '#f2f4f0'));
    }
  }
  // Golden spiral apex bud + 2 helical white diagrid space-frame ring hoops + warm amber inner café core
  const artApex = new THREE.ConeGeometry(1.15, 2.4, 6);
  artApex.translate(artX, sqTopY + 12.2, artZ);
  dalatGlassParts.push(colorizeForMerge(artApex, '#e2b938'));
  dalatGlassParts.push(
    colorizeForMerge(new THREE.CylinderGeometry(1.85, 2.15, 5.2, 10).translate(artX, sqTopY + 3.2, artZ), '#f4c55c')
  );
  for (const [hr, hy] of [[4.35, sqTopY + 2.4], [3.15, sqTopY + 5.6], [1.95, sqTopY + 8.6]] as const) {
    const hoop = new THREE.TorusGeometry(hr, 0.09, 5, 16);
    hoop.rotateX(Math.PI * 0.5);
    hoop.translate(artX, hy, artZ);
    dalatArchParts.push(colorizeForMerge(hoop, '#f2f4f0'));
  }
  // Curved Lâm Viên Amphitheater Seating Tiers (*Bậc Khán Đài Vòng Cung*) with green grass strips + interior Artichoke café tables & lakeside bollards
  for (let step = 0; step < 3; step++) {
    const stepR = 11.2 + step * 1.45;
    const stepY = sqTopY + 0.22 + step * 0.36;
    const arcStep = new THREE.TorusGeometry(stepR, 0.34, 5, 18, Math.PI * 0.85);
    arcStep.rotateX(Math.PI * 0.5);
    arcStep.rotateZ(0.25);
    arcStep.translate(sqX, stepY, sqZ + 1.5);
    dalatArchParts.push(colorizeForMerge(arcStep, step % 2 === 0 ? '#dcd8ce' : '#3a843b'));
  }
  for (let tb = 0; tb < 4; tb++) {
    const ta = (tb / 4) * Math.PI * 2;
    const tx = artX + Math.cos(ta) * 2.85;
    const tz = artZ + Math.sin(ta) * 2.85;
    dalatArchParts.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 8).translate(tx, sqTopY + 1.32, tz), '#f5efe2'),
      colorizeForMerge(new THREE.CylinderGeometry(0.06, 0.08, 0.74, 5).translate(tx, sqTopY + 0.92, tz), '#3b322c')
    );
  }
  for (let bl = -3; bl <= 3; bl++) {
    dalatArchParts.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.11, 0.14, 0.88, 6).translate(sqX + bl * 3.6, sqTopY + 0.44, sqZ - 9.4), '#485058')
    );
  }
  // Ornamental Lâm Viên Plaza Musical Fountain (*Đài Phun Nước Nghệ Thuật*) + 4 Blue-Violet Dalat Hydrangea Planters (*Bồn Hoa Cẩm Tú Cầu*)
  dalatArchParts.push(
    colorizeForMerge(new THREE.TorusGeometry(2.4, 0.18, 6, 16).rotateX(Math.PI * 0.5).translate(sqX + 0.4, sqTopY + 0.14, sqZ - 4.2), '#dcd8ce')
  );
  for (let fj = 0; fj < 8; fj++) {
    const fa = (fj / 8) * Math.PI * 2;
    dalatGlassParts.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.05, 0.08, 1.35, 5).translate(sqX + 0.4 + Math.cos(fa) * 1.4, sqTopY + 0.72, sqZ - 4.2 + Math.sin(fa) * 1.4), '#c4eef8')
    );
  }
  for (const [hxP, hzP] of [[-10.5, -7.5], [10.5, -7.5], [-10.5, 7.5], [10.5, 7.5]]) {
    dalatArchParts.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.95, 0.82, 0.45, 8).translate(sqX + hxP, sqTopY + 0.22, sqZ + hzP), '#d4cfc4'),
      colorizeForMerge(new THREE.SphereGeometry(0.76, 7, 5).scale(1.15, 0.65, 1.15).translate(sqX + hxP, sqTopY + 0.62, sqZ + hzP), '#5b82d6')
    );
  }

  // (a2) Bông Hoa Dã Quỳ Khổng Lồ (14m tilted golden faceted glass wild-sunflower dome!)
  const sunX = sqX + 6.8;
  const sunZ = sqZ + 2.8;
  addCyl(stoneParts, 6.2, 6.8, 0.55, 16, sunX, sqTopY + 0.25, sunZ);
  // Tilted dark-amber glass floral heart disk + concentric golden stamen rings + green calyx rear cradle + glass entrance
  const heartDisk = new THREE.CylinderGeometry(3.4, 3.8, 2.2, 14);
  heartDisk.rotateZ(-0.34);
  heartDisk.translate(sunX, sqTopY + 5.2, sunZ);
  dalatGlassParts.push(colorizeForMerge(heartDisk, '#5c3a14'));
  for (const sr of [2.1, 1.1]) {
    const stamen = new THREE.TorusGeometry(sr, 0.14, 5, 14);
    stamen.rotateX(Math.PI * 0.5);
    stamen.rotateZ(-0.34);
    stamen.translate(sunX + 0.38, sqTopY + 6.25, sunZ);
    dalatGlassParts.push(colorizeForMerge(stamen, '#f2b824'));
  }
  const calyxCup = new THREE.ConeGeometry(4.4, 3.8, 10, 1, true);
  calyxCup.rotateX(Math.PI);
  calyxCup.rotateZ(-0.34);
  calyxCup.translate(sunX - 0.85, sqTopY + 3.3, sunZ);
  dalatGlassParts.push(colorizeForMerge(calyxCup, '#256e3f'));
  dalatGlassParts.push(
    colorizeForMerge(new THREE.BoxGeometry(2.8, 2.4, 1.2).translate(sunX + 1.8, sqTopY + 1.45, sunZ - 2.6), '#f2d37a')
  );
  // 14 Iconic faceted golden-yellow glass wild-sunflower petals radiating around the tilted dome
  for (let p = 0; p < 14; p++) {
    const a = (p / 14) * Math.PI * 2;
    const blade = new THREE.ConeGeometry(1.55, 6.8, 4);
    blade.scale(1.0, 1.0, 0.26);
    blade.rotateX(Math.PI * 0.38);
    blade.rotateY(a);
    blade.rotateZ(-0.34);
    blade.translate(sunX + Math.cos(a) * 3.8, sqTopY + 5.6 + Math.sin(a) * 1.15, sunZ + Math.sin(a) * 3.8);
    dalatGlassParts.push(colorizeForMerge(blade, p % 2 === 0 ? '#f4c526' : '#e6a817'));
  }
  const lvSign = createSignagePlaqueMesh(
    { text: 'QUẢNG TRƯỜNG LÂM VIÊN', subText: 'ĐÀ LẠT · HỒ XUÂN HƯƠNG', width: 4.8, height: 0.92, style: 'blue_plaque' },
    ctx
  );
  lvSign.position.set(sqX, sqTopY + 1.65, sqZ - 9.8);
  group.add(lvSign);

  // (b) Nhà Thờ Con Gà (Đà Lạt Cathedral) at (cx - 34, cz - 14) — salmon-pink Romanesque nave + 21m spire + golden rooster!
  const chX = cx - 34.0;
  const chZ = cz - 14.0;
  const chY = ctx.getHeight(chX, chZ);
  const chRot = 0.38;
  const chPink = '#df8d7f';
  const chTrim = '#f6ece6';
  const chLocal: THREE.BufferGeometry[] = [];
  const chRoofLocal: THREE.BufferGeometry[] = [];
  const chGoldLocal: THREE.BufferGeometry[] = [];
  const chGlassLocal: THREE.BufferGeometry[] = [];

  // Stone foundation plinth + nave body (8.4m wide × 6.8m high × 16.5m long)
  chLocal.push(
    colorizeForMerge(new THREE.BoxGeometry(9.4, 2.4, 17.6).translate(0, -0.8, 0), '#9a948c'),
    colorizeForMerge(new THREE.BoxGeometry(8.4, 6.8, 16.2).translate(0, 3.8, 0), chPink)
  );
  // Cruciform transept wings + semicircular rear apse + stepped Romanesque wall buttresses + rose spokes
  chLocal.push(
    colorizeForMerge(new THREE.BoxGeometry(12.8, 6.2, 4.4).translate(0, 3.5, -1.6), chPink),
    colorizeForMerge(new THREE.CylinderGeometry(3.8, 3.8, 5.8, 12, 1, false, -Math.PI * 0.5, Math.PI).translate(0, 3.3, -8.1), chPink)
  );
  const transeptRoof = createGableRoofGeometry(13.2, 4.8, 2.6, 0.18, 'x');
  transeptRoof.translate(0, 6.6, -1.6);
  const apseRoof = new THREE.ConeGeometry(4.1, 2.8, 12);
  apseRoof.translate(0, 7.6, -8.1);
  chRoofLocal.push(transeptRoof, apseRoof);
  for (let w = -2; w <= 2; w++) {
    for (const side of [-1, 1]) {
      const pil = colorizeForMerge(new THREE.BoxGeometry(0.32, 6.8, 0.42).translate(side * 4.25, 3.8, w * 3.1), chTrim);
      const but = colorizeForMerge(new THREE.BoxGeometry(0.45, 3.2, 0.52).translate(side * 4.38, 2.0, w * 3.1), chPink);
      const win = colorizeForMerge(new THREE.CylinderGeometry(0.55, 0.55, 0.24, 10).rotateZ(Math.PI * 0.5).translate(side * 4.22, 4.4, w * 3.1 + 1.5), '#3c5e8c');
      chLocal.push(pil, but);
      chGlassLocal.push(win);
    }
  }
  // Front Romanesque rose window with 8 radial white wheel-tracery spokes & arched entrance portal
  const roseWin = new THREE.CylinderGeometry(1.15, 1.15, 0.26, 14);
  roseWin.rotateX(Math.PI * 0.5);
  roseWin.translate(0, 5.6, 8.12);
  chGlassLocal.push(colorizeForMerge(roseWin, '#d9534f'));
  for (let sp = 0; sp < 4; sp++) {
    chLocal.push(
      colorizeForMerge(
        new THREE.BoxGeometry(2.2, 0.08, 0.30).rotateZ((sp * Math.PI) / 4).translate(0, 5.6, 8.12),
        chTrim
      )
    );
  }
  const portal = colorizeForMerge(new THREE.BoxGeometry(2.4, 3.2, 0.32).translate(0, 2.0, 8.12), '#3b2419');
  chLocal.push(portal);
  // 6-step stone cathedral entrance stairway + recessed arched portal tympanum, double door mullion & brass door rings + 3 rear apse windows!
  for (let st = 0; st < 6; st++) {
    chLocal.push(
      colorizeForMerge(new THREE.BoxGeometry(3.8 + st * 0.25, 0.26, 0.52).translate(0, 0.35 - st * 0.22, 9.15 + st * 0.42), '#9a948c')
    );
  }
  chLocal.push(
    colorizeForMerge(new THREE.TorusGeometry(1.22, 0.16, 6, 12, Math.PI).translate(0, 3.55, 8.24), chTrim),
    colorizeForMerge(new THREE.BoxGeometry(0.08, 3.15, 0.38).translate(0, 2.0, 8.16), chTrim)
  );
  for (const dSide of [-0.45, 0.45]) {
    addCyl(chGoldLocal, 0.11, 0.11, 0.08, 6, dSide, 1.85, 8.32, Math.PI * 0.5);
  }
  for (const apAng of [-0.65, 0, 0.65]) {
    chGlassLocal.push(
      colorizeForMerge(
        new THREE.BoxGeometry(0.55, 1.85, 0.22).rotateY(apAng).translate(Math.sin(apAng) * 3.76, 3.8, -8.1 - Math.cos(apAng) * 3.76),
        '#3c5e8c'
      )
    );
    // Rear apse vertical Romanesque pilaster buttress ribs (enriching 180° Rear view!)
    chLocal.push(
      colorizeForMerge(
        new THREE.BoxGeometry(0.28, 5.6, 0.32).rotateY(apAng + 0.32).translate(Math.sin(apAng + 0.32) * 3.82, 3.2, -8.1 - Math.cos(apAng + 0.32) * 3.82),
        chTrim
      )
    );
  }
  // Side Transept Circular Rose Windows, Side Portal Doors & Stone Rainwater Gargoyle Spouts (enriching ±90° Side views!)
  for (const tSide of [-1, 1]) {
    chGlassLocal.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.78, 0.78, 0.24, 10).rotateZ(Math.PI * 0.5).translate(tSide * 6.42, 4.85, -1.6), '#e67e22')
    );
    chLocal.push(
      colorizeForMerge(new THREE.BoxGeometry(0.26, 2.45, 1.45).translate(tSide * 6.42, 1.45, -1.6), '#3b2419'),
      colorizeForMerge(new THREE.BoxGeometry(0.55, 0.16, 0.16).translate(tSide * 4.55, 6.72, 1.5), '#9a948c'),
      colorizeForMerge(new THREE.BoxGeometry(0.55, 0.16, 0.16).translate(tSide * 4.55, 6.72, -4.5), '#9a948c')
    );
  }
  // Steep Romanesque pitched terracotta nave roof + 4 roof dormer vents
  const naveRoof = createGableRoofGeometry(9.2, 17.0, 3.6, 0.22, 'z');
  naveRoof.translate(0, 7.2, 0);
  chRoofLocal.push(naveRoof);
  for (const dz of [-4.5, 2.5]) {
    for (const dx of [-2.4, 2.4]) {
      chRoofLocal.push(new THREE.ConeGeometry(0.52, 0.85, 4).rotateY(Math.PI * 0.25).translate(dx, 9.1, dz));
    }
  }

  // Iconic 21m Square Salmon-Pink Bell Tower rising on front-center facade
  chLocal.push(
    colorizeForMerge(new THREE.BoxGeometry(3.6, 14.5, 3.6).translate(0, 7.6, 7.2), chPink),
    colorizeForMerge(new THREE.BoxGeometry(3.95, 0.35, 3.95).translate(0, 11.4, 7.2), chTrim),
    colorizeForMerge(new THREE.BoxGeometry(3.95, 0.35, 3.95).translate(0, 14.9, 7.2), chTrim)
  );
  // 4 corner spire pinnacle turrets at belfry parapet corners
  for (const cxP of [-1.62, 1.62]) {
    for (const czP of [5.58, 8.82]) {
      chLocal.push(colorizeForMerge(new THREE.ConeGeometry(0.28, 1.45, 4).rotateY(Math.PI * 0.25).translate(cxP, 15.8, czP), chTrim));
    }
  }
  // Arched belfry louver openings with horizontal acoustic louver slats on all 4 sides of tower
  for (const [bx, bz] of [[0, 9.02], [0, 5.38], [1.82, 7.2], [-1.82, 7.2]]) {
    chLocal.push(colorizeForMerge(new THREE.BoxGeometry(bx === 0 ? 1.1 : 0.16, 2.4, bz === 7.2 ? 1.1 : 0.16).translate(bx, 13.1, bz), '#2d2320'));
    for (let lv = -2; lv <= 2; lv++) {
      chLocal.push(
        colorizeForMerge(
          new THREE.BoxGeometry(bx === 0 ? 1.06 : 0.20, 0.06, bz === 7.2 ? 1.06 : 0.20).translate(bx, 13.1 + lv * 0.38, bz),
          chTrim
        )
      );
    }
  }
  // Steep pyramidal tiled spire + Cross + Cardinal N-S-E-W Arms + Detailed Golden Rooster (*Con Gà Đồng*) with comb, wattle, legs & sickle tail!
  const spire = new THREE.ConeGeometry(2.55, 6.2, 4);
  spire.rotateY(Math.PI * 0.25);
  spire.translate(0, 18.0, 7.2);
  chRoofLocal.push(spire);
  addCyl(chGoldLocal, 0.06, 0.08, 2.2, 6, 0, 22.0, 7.2);
  addBox(chGoldLocal, 1.1, 0.10, 0.10, 0, 22.2, 7.2);
  addBox(chGoldLocal, 0.08, 0.08, 1.1, 0, 22.2, 7.2);
  chGoldLocal.push(
    new THREE.SphereGeometry(0.28, 8, 6).scale(1.45, 0.9, 0.72).translate(0, 23.25, 7.2),
    new THREE.ConeGeometry(0.18, 0.62, 5).rotateZ(-0.55).translate(-0.42, 23.54, 7.2),
    new THREE.ConeGeometry(0.14, 0.44, 5).rotateZ(-0.92).translate(-0.46, 23.38, 7.2),
    new THREE.SphereGeometry(0.12, 6, 4).translate(0.32, 23.48, 7.2),
    new THREE.BoxGeometry(0.22, 0.16, 0.06).translate(0.34, 23.62, 7.2),
    new THREE.BoxGeometry(0.10, 0.12, 0.05).translate(0.38, 23.34, 7.2),
    new THREE.ConeGeometry(0.09, 0.26, 5).rotateZ(Math.PI * 0.5).translate(0.46, 23.44, 7.2)
  );
  for (const g of chLocal) {
    g.rotateY(chRot);
    g.translate(chX, chY, chZ);
    dalatArchParts.push(g);
  }
  for (const g of chRoofLocal) {
    g.rotateY(chRot);
    g.translate(chX, chY, chZ);
    roofParts.push(g);
  }
  for (const g of chGoldLocal) {
    g.rotateY(chRot);
    g.translate(chX, chY, chZ);
    bronzeParts.push(g);
  }
  for (const g of chGlassLocal) {
    g.rotateY(chRot);
    g.translate(chX, chY, chZ);
    dalatGlassParts.push(g);
  }

  // (c) Ga Đà Lạt (Art Deco 3-Peak Railway Station + Vintage Steam Locomotive!) at (cx + 4, cz + 38)
  const gaX = cx + 4.0;
  const gaZ = cz + 38.0;
  const gaY = ctx.getHeight(gaX, gaZ);
  addBox(stoneParts, 22.0, 2.4, 14.0, gaX, gaY - 0.9, gaZ);
  const gaTopY = gaY + 0.30;
  // Bright ochre-yellow Art Deco station hall with 3 iconic triangular Langbiang roof peaks!
  dalatArchParts.push(
    colorizeForMerge(new THREE.BoxGeometry(18.0, 4.8, 7.8).translate(gaX, gaTopY + 2.4, gaZ - 1.2), '#e8b948'),
    colorizeForMerge(new THREE.BoxGeometry(18.6, 0.35, 8.4).translate(gaX, gaTopY + 4.9, gaZ - 1.2), '#f5f2ea')
  );
  for (const pxOff of [-5.6, 0, 5.6]) {
    const peakRoof = createGableRoofGeometry(5.8, 8.6, 4.4, 0.24, 'z');
    peakRoof.translate(gaX + pxOff, gaTopY + 4.95, gaZ - 1.2);
    roofParts.push(peakRoof);
    // Colorful Art Deco stained-glass arch beneath each of the 3 peaks + mullion grille + white stepped pilasters
    const archGlass = new THREE.CylinderGeometry(1.55, 1.55, 0.25, 12, 1, false, 0, Math.PI);
    archGlass.rotateZ(Math.PI * 0.5);
    archGlass.rotateY(Math.PI * 0.5);
    archGlass.translate(gaX + pxOff, gaTopY + 4.95, gaZ + 2.75);
    dalatGlassParts.push(colorizeForMerge(archGlass, pxOff === 0 ? '#e67e22' : '#2e86c1'));
    for (const mx of [-0.55, 0, 0.55]) {
      dalatArchParts.push(colorizeForMerge(new THREE.BoxGeometry(0.08, 1.35, 0.30).translate(gaX + pxOff + mx, gaTopY + 5.45, gaZ + 2.76), '#f5f2ea'));
    }
    // Open colonial station doorway + white Art Deco corner pilasters
    dalatArchParts.push(
      colorizeForMerge(new THREE.BoxGeometry(2.1, 3.0, 0.28).translate(gaX + pxOff, gaTopY + 1.5, gaZ + 2.72), '#33241c'),
      colorizeForMerge(new THREE.BoxGeometry(0.42, 5.2, 0.42).translate(gaX + pxOff - 2.6, gaTopY + 2.6, gaZ + 2.74), '#f5f2ea')
    );
  }
  // Iconic Round Station Clock Face with 12 hour tick-marks on central gable pediment + Cantilevered entrance marquee with 4 iron posts
  dalatArchParts.push(
    colorizeForMerge(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 14).rotateX(Math.PI * 0.5).translate(gaX, gaTopY + 6.95, gaZ + 2.86), '#f6f3ea'),
    colorizeForMerge(new THREE.BoxGeometry(0.07, 0.44, 0.26).translate(gaX, gaTopY + 7.12, gaZ + 2.90), '#1f2328'),
    colorizeForMerge(new THREE.BoxGeometry(0.36, 0.07, 0.26).translate(gaX + 0.14, gaTopY + 6.95, gaZ + 2.90), '#1f2328'),
    colorizeForMerge(new THREE.BoxGeometry(10.2, 0.22, 2.4).translate(gaX, gaTopY + 3.25, gaZ + 3.8), '#d9483b')
  );
  for (let hr = 0; hr < 12; hr++) {
    const ha = (hr / 12) * Math.PI * 2;
    dalatArchParts.push(
      colorizeForMerge(
        new THREE.BoxGeometry(0.04, 0.11, 0.26).rotateZ(ha).translate(gaX + Math.sin(ha) * 0.48, gaTopY + 6.95 + Math.cos(ha) * 0.48, gaZ + 2.90),
        '#1f2328'
      )
    );
  }
  for (const mxPost of [-4.4, -1.5, 1.5, 4.4]) {
    dalatArchParts.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 6).translate(gaX + mxPost, gaTopY + 1.6, gaZ + 4.75), '#2b3036')
    );
  }
  for (const bxBench of [-4.8, 4.8]) {
    addBox(woodParts, 2.2, 0.12, 0.55, gaX + bxBench, gaTopY + 0.48, gaZ + 3.4);
    addBox(woodParts, 2.2, 0.52, 0.10, gaX + bxBench, gaTopY + 0.78, gaZ + 3.15);
  }
  const gaSign = createSignagePlaqueMesh(
    { text: 'GA ĐÀ LẠT', subText: 'NHÀ GA CỔ ĐÔNG DƯƠNG · 1938', width: 4.4, height: 0.85, style: 'royal' },
    ctx
  );
  gaSign.position.set(gaX, gaTopY + 4.35, gaZ + 2.95);
  group.add(gaSign);

  // Twin steel railway tracks + Iconic Center Cog-Rail Rack Track (*Đường Ray Răng Cưa*) + Vintage Semaphore Signal Post!
  const trackZ = gaZ + 5.8;
  for (const rzOff of [-0.65, 0.65]) {
    dalatArchParts.push(colorizeForMerge(new THREE.BoxGeometry(22.0, 0.10, 0.10).translate(gaX, gaTopY + 0.08, trackZ + rzOff), '#565c62'));
  }
  dalatArchParts.push(
    colorizeForMerge(new THREE.BoxGeometry(22.0, 0.09, 0.14).translate(gaX, gaTopY + 0.09, trackZ), '#3b4046'),
    colorizeForMerge(new THREE.CylinderGeometry(0.08, 0.10, 4.8, 6).translate(gaX - 9.6, gaTopY + 2.4, trackZ - 1.55), '#d8dce0'),
    colorizeForMerge(new THREE.BoxGeometry(1.15, 0.22, 0.08).rotateZ(0.32).translate(gaX - 9.15, gaTopY + 4.45, trackZ - 1.55), '#c92a22'),
    colorizeForMerge(new THREE.SphereGeometry(0.14, 6, 4).translate(gaX - 9.6, gaTopY + 4.15, trackZ - 1.45), '#27ae60')
  );
  for (let sl = -10; sl <= 10; sl++) {
    addBox(woodParts, 0.22, 0.08, 1.85, gaX + sl * 1.0, gaTopY + 0.04, trackZ);
    // Cog teeth along center rack rail
    dalatArchParts.push(colorizeForMerge(new THREE.BoxGeometry(0.10, 0.05, 0.16).translate(gaX + sl * 1.0 + 0.35, gaTopY + 0.14, trackZ), '#6e767e'));
  }
  // Steam locomotive boiler, smokestack, brass steam dome/headlamp, piston cylinders, drive rods & cowcatcher
  const locoX = gaX - 4.2;
  dalatArchParts.push(
    colorizeForMerge(new THREE.CylinderGeometry(0.88, 0.92, 5.2, 12).rotateZ(Math.PI * 0.5).translate(locoX + 0.4, gaTopY + 1.75, trackZ), '#22262b'),
    colorizeForMerge(new THREE.CylinderGeometry(0.28, 0.22, 1.45, 10).translate(locoX - 1.5, gaTopY + 3.05, trackZ), '#1b1e22'),
    colorizeForMerge(new THREE.SphereGeometry(0.52, 8, 6).translate(locoX + 0.4, gaTopY + 2.68, trackZ), '#c89b38'),
    colorizeForMerge(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 8).rotateZ(Math.PI * 0.5).translate(locoX - 2.3, gaTopY + 1.88, trackZ), '#e6b83e'),
    colorizeForMerge(new THREE.BoxGeometry(2.4, 2.85, 2.35).translate(locoX + 3.6, gaTopY + 2.15, trackZ), '#2b3036'),
    colorizeForMerge(new THREE.BoxGeometry(2.75, 0.22, 2.65).translate(locoX + 3.6, gaTopY + 3.65, trackZ), '#9e2620'),
    colorizeForMerge(new THREE.BoxGeometry(6.8, 0.42, 2.25).translate(locoX + 1.2, gaTopY + 0.72, trackZ), '#9e2620'),
    colorizeForMerge(new THREE.ConeGeometry(1.05, 1.15, 4).rotateZ(Math.PI * 0.5).rotateX(Math.PI * 0.25).translate(locoX - 2.55, gaTopY + 0.42, trackZ), '#9e2620')
  );
  for (const wz of [-1.05, 1.05]) {
    dalatArchParts.push(
      colorizeForMerge(new THREE.CylinderGeometry(0.32, 0.32, 1.25, 8).rotateZ(Math.PI * 0.5).translate(locoX - 1.4, gaTopY + 0.65, trackZ + wz), '#32373d'),
      colorizeForMerge(new THREE.BoxGeometry(5.2, 0.12, 0.10).translate(locoX + 1.1, gaTopY + 0.56, trackZ + wz * 1.02), '#cfd4da')
    );
  }
  for (const wx of [-1.4, 0.2, 1.8, 3.6]) {
    for (const wz of [-0.95, 0.95]) {
      dalatArchParts.push(
        colorizeForMerge(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 10).rotateX(Math.PI * 0.5).translate(locoX + wx, gaTopY + 0.56, trackZ + wz), '#b02e26'),
        colorizeForMerge(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 6).rotateX(Math.PI * 0.5).translate(locoX + wx, gaTopY + 0.56, trackZ + wz), '#d4a638')
      );
    }
  }
  // Brass steam whistle, safety valve, 3 brass riveted boiler bands, cab side windows & coal tender mound on the vintage steam locomotive
  for (const bBandX of [-0.9, 0.4, 1.7]) {
    dalatArchParts.push(
      colorizeForMerge(new THREE.TorusGeometry(0.91, 0.035, 5, 12).rotateY(Math.PI * 0.5).translate(locoX + bBandX, gaTopY + 1.75, trackZ), '#d4a638')
    );
  }
  dalatGlassParts.push(
    colorizeForMerge(new THREE.BoxGeometry(0.95, 0.72, 2.42).translate(locoX + 3.4, gaTopY + 2.75, trackZ), '#f5d98c')
  );
  dalatArchParts.push(
    colorizeForMerge(new THREE.CylinderGeometry(0.08, 0.10, 0.42, 6).translate(locoX + 1.5, gaTopY + 2.82, trackZ), '#e6b83e'),
    colorizeForMerge(new THREE.SphereGeometry(0.65, 6, 4).scale(1.4, 0.55, 1.2).translate(locoX + 4.1, gaTopY + 2.55, trackZ), '#1a1d20')
  );
  // Vintage mahogany-wood Đà Lạt passenger carriage with clerestory roof monitor & end boarding handrails + step ladders
  const carX = gaX + 4.4;
  dalatArchParts.push(
    colorizeForMerge(new THREE.BoxGeometry(7.2, 2.35, 2.25).translate(carX, gaTopY + 1.95, trackZ), '#7a3b22'),
    colorizeForMerge(new THREE.BoxGeometry(7.6, 0.36, 2.48).translate(carX, gaTopY + 3.25, trackZ), '#32383e'),
    colorizeForMerge(new THREE.BoxGeometry(6.4, 0.28, 1.25).translate(carX, gaTopY + 3.55, trackZ), '#444b52')
  );
  for (const endSide of [-3.68, 3.68]) {
    dalatArchParts.push(
      colorizeForMerge(new THREE.BoxGeometry(0.12, 1.15, 2.15).translate(carX + endSide, gaTopY + 1.35, trackZ), '#282c30'),
      colorizeForMerge(new THREE.BoxGeometry(0.32, 0.08, 0.55).translate(carX + endSide, gaTopY + 0.55, trackZ + 1.15), '#282c30')
    );
  }
  for (let cw = -2; cw <= 2; cw++) {
    dalatGlassParts.push(
      colorizeForMerge(new THREE.BoxGeometry(0.85, 0.92, 2.32).translate(carX + cw * 1.28, gaTopY + 2.12, trackZ), '#f5d98c')
    );
  }

  const pineMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  const flowerMat = pineMat;
  const dalatGlassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.2,
    metalness: 0.4
  });
  ctx.extraMaterials.push(dalatGlassMat);
  const dalatArchMesh = new THREE.Mesh(mergeNormalized(dalatArchParts), flowerMat);
  dalatArchMesh.name = 'DaLatIconicArchitecture';
  dalatArchMesh.castShadow = true;
  dalatArchMesh.receiveShadow = true;
  const dalatGlassMesh = new THREE.Mesh(mergeNormalized(dalatGlassParts), dalatGlassMat);
  dalatGlassMesh.name = 'DaLatLamVienGlassPavilions';
  // P1 Đà Lạt Art Deco Stepped Relief Panels (`HV-NEW-MT-10`) & Highland Cornice (`HV-H04`)
  const dlY = ctx.getHeight(cx - 25.0, cz + 14.0);
  const dalatArtDecoMesh = new THREE.Mesh(
    mergeNormalized([
      ...createArtDecoReliefParts(cx - 28.0, dlY + 5.8, cz + 14.0, 2.2, 1.35, 0),
      ...createArtDecoReliefParts(cx - 22.0, dlY + 5.8, cz + 14.0, 2.2, 1.35, 0)
    ]),
    ctx.materials.whitePlaster
  );
  dalatArtDecoMesh.castShadow = false;
  group.add(dalatArchMesh, dalatGlassMesh, dalatArtDecoMesh);
  tagMotifIds(group, [
    'HV-H04', 'HV-H05', 'HV-I04', 'HV-NEW-MT-09', 'HV-NEW-MT-10'
  ]);

  const stoneMesh = new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;
  const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof);
  roofMesh.castShadow = true;
  if (lanternParts.length > 0) {
    group.add(new THREE.Mesh(mergeNormalized(lanternParts), ctx.materials.lanternSilk));
  }
  const barkMesh = new THREE.Mesh(mergeNormalized(barkParts), ctx.materials.bark);
  barkMesh.castShadow = true;
  const pineMesh = new THREE.Mesh(mergeNormalized(pineParts), pineMat);
  pineMesh.castShadow = true;
  const flowerMesh = new THREE.Mesh(mergeNormalized(flowerParts), flowerMat);
  const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze);

  group.add(stoneMesh, woodMesh, roofMesh, barkMesh, pineMesh, flowerMesh, bronzeMesh);
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
    // Internal crossed hardwood A-frame king-post rafters (*vì kèo chéo lòng Nhà Rông* — ref 122_nha_rong_tay_nguyen_ket_cau.jpg!)
    addCyl(woodParts, 0.09, 0.12, 8.8, 6, houseX - 1.25, deckY + hallH + 3.6, houseZ + oz, 0, 0, -0.32);
    addCyl(woodParts, 0.09, 0.12, 8.8, 6, houseX + 1.25, deckY + hallH + 3.6, houseZ + oz, 0, 0, 0.32);
    addBox(woodParts, 3.2, 0.16, 0.16, houseX, deckY + hallH + 5.2, houseZ + oz);
  }
  // Elevated communal timber sitting/sleeping platforms (*sạp gỗ dài*) along North & South gable ends + Sacred Central Totem Pillar (*Cột Thần*)
  for (const szBench of [-4.55, 4.55]) {
    addBox(woodParts, 5.8, 0.14, 1.45, houseX - 0.1, deckY + 0.48, houseZ + szBench);
  }
  addCyl(woodParts, 0.22, 0.26, hallH + 6.5, 8, houseX - 1.15, deckY + (hallH + 6.5) * 0.5, houseZ);
  // Carved water-buffalo horn emblem & woven bamboo hunting shields mounted on the Sacred Central Totem Pillar
  const hornTorus = new THREE.TorusGeometry(0.46, 0.065, 6, 12, Math.PI);
  hornTorus.rotateY(Math.PI * 0.5);
  hornTorus.rotateZ(Math.PI);
  hornTorus.translate(houseX - 0.88, deckY + 2.65, houseZ);
  goldParts.push(hornTorus);
  addCyl(crimsonParts, 0.34, 0.34, 0.08, 10, houseX - 0.90, deckY + 1.95, houseZ, 0, 0, Math.PI * 0.5);

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
  tagMotifIds(group, [
    'HV-G01', 'HV-G02', 'HV-G03', 'HV-G04', 'HV-G05', 'HV-G06', 'HV-G07',
    'HV-NEW-MT-11', 'HV-NEW-MT-12', 'HV-NEW-MT-13'
  ]);

  // UNESCO *Cồng Chiêng Tây Nguyên* 10-Gong Bamboo Rack with Dual Suspension Cords (ZERO floating gongs — ref 91!)
  addBox(woodParts, 0.26, 2.25, 0.26, houseX - 2.35, deckY + 1.28, houseZ - 3.6);
  addBox(woodParts, 0.26, 2.25, 0.26, houseX - 2.35, deckY + 1.28, houseZ + 3.6);
  addCyl(woodParts, 0.075, 0.085, 7.5, 8, houseX - 2.35, deckY + 2.35, houseZ, Math.PI * 0.5, 0);
  for (let g = 0; g < 10; g++) {
    const gz = houseZ - 3.15 + g * 0.70;
    const gr = 0.20 + (4.5 - Math.abs(g - 4.5)) * 0.036;
    const gongCenterY = deckY + 1.56;
    const gong = new THREE.CylinderGeometry(gr, gr, 0.07, 16);
    gong.rotateZ(Math.PI * 0.5);
    gong.translate(houseX - 2.32, gongCenterY, gz);
    bronzeParts.push(gong);
    const boss = new THREE.SphereGeometry(gr * 0.28, 8, 6);
    boss.translate(houseX - 2.26, gongCenterY, gz);
    goldParts.push(boss);
    // Twin slender suspension cords tying each gong rim solidly up to the bamboo crossbar
    const cordTopY = deckY + 2.35;
    const cordBotY = gongCenterY + gr * 0.85;
    const cordLen = Math.max(0.18, cordTopY - cordBotY);
    for (const cSide of [-1, 1]) {
      addCyl(woodParts, 0.009, 0.009, cordLen, 5, houseX - 2.32, (cordTopY + cordBotY) * 0.5, gz + cSide * gr * 0.42);
    }
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

  // FIX NR-05: Hand-carved raw hardwood twin breasts & crescent moon Bahnar motifs crowning the notched entry stair (NO bright gold paint!)
  for (const bz of [-0.42, 0.42]) {
    const breast = new THREE.SphereGeometry(0.16, 8, 6);
    breast.translate(houseX + 3.88, deckY + 0.42, houseZ + bz);
    woodParts.push(breast);
  }
  const moonCres = new THREE.TorusGeometry(0.24, 0.05, 6, 12, Math.PI);
  moonCres.rotateY(Math.PI * 0.5);
  moonCres.translate(houseX + 3.88, deckY + 0.72, houseZ);
  woodParts.push(moonCres);

  // Towering 16m steep axe-blade roof (*Mái Nhà Rông*, apex ~22m!) split into upper 2/3 woven bamboo matting & lower 1/3 thatch skirt + Enclosed Woven Gable Walls
  const bambooParts: THREE.BufferGeometry[] = [];
  const roofH = 15.5;
  const nhaRongSplit = createNhaRongRoofSplitGeometries(13.8, 10.2, roofH, 0.66);
  nhaRongSplit.upperBamboo.rotateY(Math.PI * 0.5);
  nhaRongSplit.upperBamboo.translate(houseX, deckY + 3.4, houseZ);
  bambooParts.push(nhaRongSplit.upperBamboo);

  nhaRongSplit.lowerThatch.rotateY(Math.PI * 0.5);
  nhaRongSplit.lowerThatch.translate(houseX, deckY + 3.4, houseZ);
  roofParts.push(nhaRongSplit.lowerThatch);

  const gableWalls = createNhaRongGableWallsGeometry(13.8, 10.2, roofH);
  gableWalls.rotateY(Math.PI * 0.5);
  gableWalls.translate(houseX, deckY + 3.4, houseZ);
  bambooParts.push(gableWalls);

  // 5 Slender Natural Woven Bamboo V-Tufts along the top axe-blade ridge (NO lowland crimson/gold boxes — ref 89!)
  const ridgeHalfLen = 13.8 * 0.43;
  for (let rIdx = 0; rIdx < 5; rIdx++) {
    const u = THREE.MathUtils.lerp(-0.85, 0.85, rIdx / 4);
    const rz = u * ridgeHalfLen;
    const ridgeY = deckY + 3.4 + roofH + 0.18 * (u * u);
    for (const tilt of [-0.42, -0.18, 0.18, 0.42]) {
      addCyl(bambooParts, 0.024, 0.036, 0.72, 5, houseX + tilt * 0.35, ridgeY + 0.32, houseZ + rz, 0, 0, -tilt);
    }
  }

  // Nhà Mồ Funerary Pavilion: authentic low A-frame thatch roof close to earthen grave + raw carved wooden ridge board (NO crimson lacquer — ref 90!)
  const moX = houseX + 2.5;
  const moZ = houseZ + 14.5;
  const moY = ctx.getHeight(moX, moZ);
  for (const ox of [-2.1, 2.1]) {
    for (const oz of [-1.45, 1.45]) {
      addCyl(woodParts, 0.09, 0.11, 1.05, 6, moX + ox, moY + 0.52, moZ + oz);
    }
  }
  // Earthen grave mound + low steep A-frame thatch roof + raw carved wood ridge frieze with curved wooden bird-horn tips
  addBox(basaltParts, 3.2, 0.48, 1.85, moX, moY + 0.24, moZ);
  const moRoof = createGableRoofGeometry(5.6, 3.5, 1.95, 0.14, 'x');
  moRoof.translate(moX, moY + 0.84, moZ);
  roofParts.push(moRoof);
  addBox(woodParts, 5.7, 0.28, 0.12, moX, moY + 2.92, moZ);
  for (let rf = -4; rf <= 4; rf++) {
    addCone(woodParts, 0.12, 0.32, 4, moX + rf * 0.56, moY + 3.22, moZ);
  }
  for (const side of [-1, 1]) {
    addCyl(woodParts, 0.045, 0.085, 0.95, 6, moX + side * 2.82, moY + 3.16, moZ, 0, 0, side * -0.48);
  }
  // Circular palisade fence of sharpened wooden stakes enclosing the tomb mound
  for (let p = 0; p < 24; p++) {
    if (p === 0 || p === 1 || p === 23) continue; // leave entry gap
    const pa = (p / 24) * Math.PI * 2;
    const px = moX + Math.cos(pa) * 3.05;
    const pz = moZ + Math.sin(pa) * 2.55;
    const py = ctx.getHeight(px, pz);
    addCyl(woodParts, 0.07, 0.08, 1.05, 5, px, py + 0.52, pz);
    addCone(woodParts, 0.07, 0.24, 5, px, py + 1.16, pz);
  }
  // FIX NR-04: Weathered silver-grey raw hand-hewn wood (#7e7569) for Nhà Mồ folk statues (ref 90_nha_mo_tay_nguyen.jpg!)
  const nhaMoStatueParts: THREE.BufferGeometry[] = [];
  for (let st = 0; st < 8; st++) {
    const sa = (st / 8) * Math.PI * 2;
    const sx = moX + Math.cos(sa) * 3.55;
    const sz = moZ + Math.sin(sa) * 3.05;
    const sy = ctx.getHeight(sx, sz);
    nhaMoStatueParts.push(...createNhaMoFolkStatueParts(sx, sy, sz, -sa, (st % 3) as 0 | 1 | 2));
  }
  const weatheredWoodMat = ctx.materials.darkWood;
  group.add(new THREE.Mesh(mergeNormalized(nhaMoStatueParts), weatheredWoodMat));

  // FIX BH-04: Upgraded 2-Tier Hexagonal Nhà Lồng Biển Hồ Lakeside Pavilion with stepped approach stairs & lakeside white balustrade (ref 27!)
  const pavRimX = -422;
  const pavRimZ = 28;
  const pavRimY = Math.max(2.0, ctx.getHeight(pavRimX, pavRimZ));
  const whiteStoneMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const nhaLongParts: THREE.BufferGeometry[] = [];
  addCyl(nhaLongParts, 3.8, 4.1, 1.4, 6, pavRimX, pavRimY + 0.2, pavRimZ);
  // 5-step approach stairway connecting lakeside path up into Nhà Lồng
  for (let st = 0; st < 5; st++) {
    addBox(nhaLongParts, 0.48, 0.24, 2.2, pavRimX + 3.6 + st * 0.45, pavRimY + 0.85 - st * 0.22, pavRimZ);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const aNext = ((i + 1) / 6) * Math.PI * 2;
    addCyl(nhaLongParts, 0.14, 0.16, 3.2, 7, pavRimX + Math.cos(a) * 2.8, pavRimY + 2.4, pavRimZ + Math.sin(a) * 2.8);
    // White balustrade along 5 sides (leaving East entry at i === 0 open!)
    if (i > 0) {
      nhaLongParts.push(
        ...createPiercedBalustradeParts(
          pavRimX + Math.cos(a) * 3.45,
          pavRimZ + Math.sin(a) * 3.45,
          pavRimX + Math.cos(aNext) * 3.45,
          pavRimZ + Math.sin(aNext) * 3.45,
          pavRimY + 0.90,
          0.78,
          'bamboo_x'
        )
      );
    }
  }
  const nhaLongRoof1 = createHexCurvedRoofGeometry(4.3, 1.8, 0.28);
  nhaLongRoof1.translate(pavRimX, pavRimY + 4.0, pavRimZ);
  addCyl(nhaLongParts, 1.9, 2.0, 0.85, 6, pavRimX, pavRimY + 5.75, pavRimZ);
  const nhaLongRoof2 = createHexCurvedRoofGeometry(2.7, 1.5, 0.30);
  nhaLongRoof2.translate(pavRimX, pavRimY + 6.1, pavRimZ);
  const nhaLongRedParts = [nhaLongRoof1, nhaLongRoof2];
  nhaLongParts.push(...createLotusFinialParts(pavRimX, pavRimY + 7.6, pavRimZ, 0.72));
  nhaLongParts.push(...createSculptedDeityParts(pavRimX, pavRimY + 0.9, pavRimZ, 0.9, 0.65, 'quanam').bodyParts);
  group.add(
    new THREE.Mesh(mergeNormalized(nhaLongParts), whiteStoneMat),
    new THREE.Mesh(mergeNormalized(nhaLongRedParts), ctx.materials.terracottaRoof)
  );
  // 2 Moored Wooden Dugout Canoes with open trough gunwales, tapered prows & cross thwarts on Biển Hồ T'Nưng water
  for (const [cxCan, czCan, cyaw] of [
    [-424, 41, 0.3],
    [-422, 46, -0.25]
  ]) {
    addBox(woodParts, 0.62, 0.14, 4.4, cxCan, 0.04, czCan, cyaw);
    for (const side of [-1, 1]) {
      const gx = cxCan + Math.cos(cyaw) * side * 0.28;
      const gz = czCan - Math.sin(cyaw) * side * 0.28;
      addBox(woodParts, 0.08, 0.28, 4.4, gx, 0.18, gz, cyaw);
    }
    for (const end of [-1, 1]) {
      const px = cxCan + Math.sin(cyaw) * end * 2.45;
      const pz = czCan + Math.cos(cyaw) * end * 2.45;
      addCone(woodParts, 0.32, 0.75, 5, px, 0.22, pz, end * Math.PI * 0.42, cyaw);
    }
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

  // 2b. FIX BH-01: Sweeping Curved Concrete Lakeside Promenade (2.4m wide, ~82m arc along East/NE rim) with Retaining Wall & White X-Railings (ref 27_bien_ho_tnung.jpg!)
  const promConcreteParts: THREE.BufferGeometry[] = [];
  const promRailParts: THREE.BufferGeometry[] = [];
  const promSegs = 14;
  const promR = 45.2;
  for (let s = 0; s < promSegs; s++) {
    const a0 = THREE.MathUtils.lerp(-0.92, 0.86, s / promSegs);
    const a1 = THREE.MathUtils.lerp(-0.92, 0.86, (s + 1) / promSegs);
    const am = (a0 + a1) * 0.5;
    const x0 = -455 + Math.cos(a0) * promR;
    const z0 = 42 + Math.sin(a0) * promR;
    const x1 = -455 + Math.cos(a1) * promR;
    const z1 = 42 + Math.sin(a1) * promR;
    const xm = (x0 + x1) * 0.5;
    const zm = (z0 + z1) * 0.5;
    const py = ctx.getHeight(xm, zm) + 0.16;
    const segLen = Math.hypot(x1 - x0, z1 - z0) + 0.14;
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    // Concrete walkway slab
    addBox(promConcreteParts, 2.45, 0.34, segLen, xm, py, zm, yaw);
    // Inner hillside concrete retaining wall (+R side)
    const rx = -455 + Math.cos(am) * (promR + 1.32);
    const rz = 42 + Math.sin(am) * (promR + 1.32);
    addBox(promConcreteParts, 0.32, 0.96, segLen, rx, py + 0.45, rz, yaw);
    // Outer lakeside white X-pattern safety balustrade (-R side overlooking crater water)
    const bx0 = -455 + Math.cos(a0) * (promR - 1.12);
    const bz0 = 42 + Math.sin(a0) * (promR - 1.12);
    const bx1 = -455 + Math.cos(a1) * (promR - 1.12);
    const bz1 = 42 + Math.sin(a1) * (promR - 1.12);
    promRailParts.push(...createPiercedBalustradeParts(bx0, bz0, bx1, bz1, py + 0.16, 0.92, 'bamboo_x'));
  }
  const promConcreteMat = ctx.materials.stone;
  group.add(
    new THREE.Mesh(mergeNormalized(promConcreteParts), promConcreteMat),
    new THREE.Mesh(mergeNormalized(promRailParts), whiteStoneMat)
  );

  // 2c. FIX BH-02: 68 Towering Three-Needle Highland Pine Trees (*Thông Ba Lá Pinus kesiya*, h=12..18m) encircling 360° of Biển Hồ Crater Rim (ref 27!)
  const pineRand = mulberry32(27076);
  const pineTrunkProto = new THREE.CylinderGeometry(0.14, 0.24, 13.5, 5);
  pineTrunkProto.translate(0, 6.75, 0);
  const pineCrownParts: THREE.BufferGeometry[] = [];
  for (let tier = 0; tier < 2; tier++) {
    const cone = new THREE.ConeGeometry(2.7 - tier * 0.7, 4.2 - tier * 0.4, 6);
    cone.translate(0, 9.6 + tier * 2.8, 0);
    pineCrownParts.push(cone);
  }
  const pineTrunkMat = ctx.materials.bark;
  const pineLeafMat = ctx.materialLib?.getOrCreateStandard({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide }) ?? ctx.materials.darkWood;
  const pineCount = 68;
  const pineTrunkInst = new THREE.InstancedMesh(pineTrunkProto, pineTrunkMat, pineCount);
  const pineLeafInst = new THREE.InstancedMesh(mergeNormalized(pineCrownParts), pineLeafMat, pineCount);
  const pineDummy = new THREE.Object3D();
  for (let p = 0; p < pineCount; p++) {
    const a = (p / pineCount) * Math.PI * 2 + (pineRand() - 0.5) * 0.08;
    const dist = 50.0 + pineRand() * 14.0;
    let tx = -455 + Math.cos(a) * dist;
    let tz = 42 + Math.sin(a) * dist;
    // Keep clear of Nhà Rông plaza on East side
    if (Math.hypot(tx - houseX, tz - houseZ) < 15.0) {
      tx = -455 + Math.cos(a + 0.45) * (dist + 6.0);
      tz = 42 + Math.sin(a + 0.45) * (dist + 6.0);
    }
    const ty = ctx.getHeight(tx, tz);
    const sc = 0.86 + pineRand() * 0.44;
    pineDummy.position.set(tx, ty - 0.2, tz);
    pineDummy.rotation.set((pineRand() - 0.5) * 0.05, pineRand() * Math.PI * 2, (pineRand() - 0.5) * 0.05);
    pineDummy.scale.set(sc, sc, sc);
    pineDummy.updateMatrix();
    pineTrunkInst.setMatrixAt(p, pineDummy.matrix);
    pineLeafInst.setMatrixAt(p, pineDummy.matrix);
  }
  pineTrunkInst.instanceMatrix.needsUpdate = true;
  pineLeafInst.instanceMatrix.needsUpdate = true;
  group.add(pineTrunkInst, pineLeafInst);

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

  const thatchMat = ctx.materials.thatchFiber ?? ctx.materials.darkWood;
  const basaltMat = ctx.materials.granite;
  const ceramicJarMat = ctx.materials.darkWood;
  const hearthEmberMat = new THREE.MeshStandardMaterial({
    color: '#ff521a',
    emissive: new THREE.Color('#ff6a18'),
    emissiveIntensity: 1.85,
    roughness: 0.72
  });
  ctx.extraMaterials.push(hearthEmberMat);

  const woodMesh = new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood);
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;

  const roofMesh = new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.thatchFiber ?? thatchMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;

  const bambooMesh = new THREE.Mesh(mergeNormalized(bambooParts), ctx.materials.bambooWeave ?? thatchMat);
  bambooMesh.castShadow = true;
  bambooMesh.receiveShadow = true;

  const crimsonMesh = new THREE.Mesh(mergeNormalized(crimsonParts), ctx.materials.crimsonLacquer);
  crimsonMesh.castShadow = true;

  const basaltMesh = new THREE.Mesh(mergeNormalized(basaltParts), basaltMat);
  basaltMesh.castShadow = true;

  const bronzeMesh = new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze);
  const goldMesh = new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold);
  const ceramicMesh = new THREE.Mesh(mergeNormalized(ceramicParts), ceramicJarMat);
  const emberMesh = new THREE.Mesh(mergeNormalized(emberParts), hearthEmberMat);

  group.add(woodMesh, roofMesh, bambooMesh, crimsonMesh, basaltMesh, bronzeMesh, goldMesh, ceramicMesh, emberMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * Builds all 9 Central Vietnam & Central Highlands heritage landmarks and returns animated shader uniforms.
 */
export function buildVietnamCentralLandmarks(ctx: VietnamBuilderContext): VietnamCentralBuildResult {
  const animatedUniforms: Array<{ uTime: { value: number } }> = [];

  // Shared extra materials used across Central landmarks
  const imperialGoldRoofMat = ctx.huePack?.hoangLuuLyMat ?? new THREE.MeshStandardMaterial({
    color: '#e88616',
    normalMap: ctx.pbr.darkRoof.normalMap,
    roughnessMap: ctx.pbr.darkRoof.roughnessMap,
    roughness: 0.24,
    metalness: 0.12,
    side: THREE.DoubleSide
  });
  const foliageCanopyMat = new THREE.MeshStandardMaterial({
    color: '#3a7a30',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.42,
    roughness: 0.78,
    side: THREE.DoubleSide
  });
  if (!ctx.huePack?.hoangLuuLyMat) ctx.extraMaterials.push(imperialGoldRoofMat);
  ctx.extraMaterials.push(foliageCanopyMat);

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
