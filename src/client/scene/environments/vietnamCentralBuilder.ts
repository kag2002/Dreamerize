import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { buildHoiAnAncientTownComplex } from './hoiAnAncientTownBuilder';
import {
  buildMySonSanctuaryComplex,
  buildBienHoTNungComplex
} from './mySonTayNguyenBuilder';
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
  const cz = 52;
  const yBase = ctx.getHeight(cx, cz); // 1.55m
  // Local (-28, +48) -> world (-137, +80)
  ctx.exclusionCircles.push(
    { x: -185, z: 52, r: 46.0 },
    { x: -136, z: 52, r: 20.0 },
    { x: -137, z: 80, r: 16.0 }
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

    // Stepped 3-tier weathered Huế bastion cornice + projecting stone base plinth (`chân tường đá`) wrapping the U-wings — NM-15, NM-27!
    addBox(brickParts, wingW - batter + 0.2, 0.36, wingLen - batter + 0.2, wingX - side * 0.1, rampartH + 0.18, wingZ - 0.2);
    addBox(stoneParts, wingW - batter + 0.56, 0.26, wingLen - batter + 0.56, wingX - side * 0.1, rampartH + 0.48, wingZ - 0.2);
    addBox(stoneParts, wingW + 0.44, 0.44, wingLen + 0.44, wingX, 0.72, wingZ);
    // Stone impost blocks & carved keystone on Tả/Hữu Dịch Môn semicircular archivolts — NM-16!
    addBox(stoneParts, 0.36, 0.24, 0.46, side * 17.84, dichSpringY, dichZ - afOuter + 0.22);
    addBox(stoneParts, 0.36, 0.24, 0.46, side * 17.84, dichSpringY, dichZ + afOuter - 0.22);
    addBox(stoneParts, 0.36, 0.42, 0.34, side * 17.84, dichSpringY + afOuter - 0.12, dichZ);
  }

  // Main bastion 3-step cornice + projecting stone base plinth + stepped carved stone frame around "門   午" plaque (NM-12, NM-15, NM-27)
  addBox(brickParts, 57.4, 0.36, rampartDepth - batter + 0.25, 0, rampartH + 0.18, gateZ);
  addBox(stoneParts, 57.9, 0.26, rampartDepth - batter + 0.62, 0, rampartH + 0.48, gateZ);
  addBox(stoneParts, 58.2, 0.44, rampartDepth + 0.44, 0, 0.72, gateZ);

  // Stepped carved weathered stone surround framing "門   午" royal plaque (NM-12!)
  addBox(stoneParts, 3.62, 1.18, 0.28, 0, 5.02, gateZ + (rampartDepth - batter) * 0.5 + 0.08);
  const ngoMonPlaque = createSignagePlaqueMesh(
    {
      text: '門   午',
      subText: '',
      style: 'royal',
      width: 3.18,
      height: 0.88,
      depth: 0.16,
      motifSeed: 1833
    },
    ctx
  );
  ngoMonPlaque.position.set(0, 5.02, gateZ + (rampartDepth - batter) * 0.5 + 0.16);
  group.add(ngoMonPlaque);

  // Ceremonial aged patinated Thanh stone forecourt paving FLUSH with flat bridge deck (NO blinding white central stripe — NM-21!)
  addBox(stoneParts, 72.0, 0.90, 29.0, 0, 0.09, 6.2);
  addBox(stoneParts, 16.0, 0.12, 26.0, 0, 0.50, 6.5);
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

  // Dense Weathered Terracotta-Brick Pierced Lattice (`Gạch Hoa Chanh`, 2×4 grid) + Aged Dark Stone Piers (NM-11!)
  const forecourtEdgeZ = gateZ + (rampartDepth - batter) * 0.5 - 0.15;
  terracottaBalParts.push(
    ...createPiercedBalustradeParts(-17.8, forecourtEdgeZ, 17.8, forecourtEdgeZ, deckY, 0.96, 'hue_terracotta_lattice')
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
        'hue_terracotta_lattice'
      ),
      ...createPiercedBalustradeParts(
        side * 18.1,
        gateZ + rampartDepth * 0.5 + 17.3,
        side * 28.0,
        gateZ + rampartDepth * 0.5 + 17.3,
        deckY,
        0.96,
        'hue_terracotta_lattice'
      ),
      ...createPiercedBalustradeParts(
        side * 28.2,
        gateZ - 4.0,
        side * 28.2,
        gateZ + rampartDepth * 0.5 + 17.3,
        deckY,
        0.96,
        'hue_terracotta_lattice'
      )
    );
    // Aged weathered stone square balustrade corner/bay piers (NO stark bright white blocks! NM-11)
    for (const pz of [-4.6, 1.5, 7.2, 12.6]) {
      addBox(stoneParts, 0.48, 1.10, 0.48, side * 28.2, deckY + 0.55, pz);
      addBox(stoneParts, 0.48, 1.10, 0.48, side * 18.1, deckY + 0.55, pz);
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

  // Story 1 Continuous U-Wing Colonnaded Galleries — slender crimson-mahogany pillars on stone bases + carved `con sơn` brackets (ZERO grey void cube! NM-09, NM-10, NM-28!)
  const addHueColWithBaseAndBracket = (px: number, y0: number, pz: number, colH: number) => {
    addBox(stoneParts, 0.44, 0.24, 0.44, px, y0 + 0.12, pz);
    addCyl(crimsonParts, 0.155, 0.175, colH, 8, px, y0 + 0.24 + colH * 0.5, pz);
    addBox(crimsonParts, 0.56, 0.14, 0.56, px, y0 + 0.24 + colH - 0.10, pz);
    addBox(woodParts, 0.74, 0.11, 0.22, px, y0 + 0.24 + colH - 0.22, pz);
  };

  for (const side of [-1, 1]) {
    for (const px of [side * 15.6, side * 19.0, side * 22.8, side * 26.8]) {
      for (const pz of [gateZ - 4.1, gateZ + 4.1]) {
        addHueColWithBaseAndBracket(px, hallFloorY, pz, 3.65);
      }
    }
    addBox(crimsonParts, 14.0, 0.40, 5.2, side * 20.0, hallFloorY + 3.68, gateZ);
    addBox(voidParts, 13.4, 3.50, 0.24, side * 20.0, hallFloorY + 1.78, gateZ - 1.4);
    for (const pz of [-3.4, -0.6, 2.2, 5.0, 7.8, 10.6, 12.6]) {
      for (const px of [side * 19.2, side * 27.4]) {
        addHueColWithBaseAndBracket(px, hallFloorY, pz, 3.65);
      }
      // Overhead transverse timber tie-beams connecting outer gallery columns (replaces giant grey cube! NM-09)
      addBox(crimsonParts, 8.2, 0.24, 0.24, side * 23.3, hallFloorY + 3.52, pz);
    }
    for (const px of [side * 21.2, side * 23.3, side * 25.4]) {
      addHueColWithBaseAndBracket(px, hallFloorY, 12.6, 3.65);
    }
    // Recessed dark-crimson paneled interior screen wall + dark rear shadow (ZERO giant flat grey block! NM-09!)
    addBox(crimsonParts, 0.26, 3.65, 15.6, side * 25.8, hallFloorY + 1.82, gateZ + 13.4);
    addBox(crimsonParts, 7.6, 0.40, 16.0, side * 23.3, hallFloorY + 3.68, gateZ + 13.4);
    for (const pz of [-1.2, 2.8, 6.8, 10.6]) {
      addBox(crimsonParts, 0.16, 3.2, 1.9, side * 21.8, hallFloorY + 1.60, pz);
    }
  }

  // Exact grounded concave hip-ridge generator matching updated createHueImperialHipRoofGeometry (1.38 pitch, 1.10 upturn — ZERO skinny tusks! NM-04, NM-06!)
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
          const r = k / samples;
          const w = THREE.MathUtils.lerp(topW, baseW, r);
          const d = THREE.MathUtils.lerp(topD, baseD, r);
          const concave = Math.pow(1.0 - r, 1.38);
          const upturn = flare * Math.pow(r, 2.55) * 1.10;
          const py = y0 + concave * h + upturn + 0.08;
          pts.push(new THREE.Vector3(rx + sx * w * 0.5, py, rz + sz * d * 0.5));
        }
        const hipCurve = new THREE.CatmullRomCurve3(pts);
        ceramicParts.push(new THREE.TubeGeometry(hipCurve, 6, tubeR, 4, false));
        const tip = pts[pts.length - 1];
        const volute = new THREE.TorusGeometry(0.20 * finialScale, 0.075 * finialScale, 4, 6, Math.PI * 1.45);
        volute.rotateY(Math.atan2(sx, sz));
        volute.translate(tip.x + sx * 0.08 * finialScale, tip.y + 0.16 * finialScale, tip.z + sz * 0.08 * finialScale);
        ceramicParts.push(volute);
        for (const cIdx of [3, 6]) {
          const cp = pts[cIdx];
          const conXo = new THREE.BoxGeometry(0.20 * finialScale, 0.28 * finialScale, 0.22 * finialScale);
          conXo.translate(cp.x, cp.y + 0.14 * finialScale, cp.z);
          ceramicParts.push(conXo);
        }
      }
    }
  };

  // Tier-1 Continuous U-Shaped Eaves Roofs — grounded Huế eaveFlare (0.20–0.24) + recessed soffits strictly INSIDE column perimeter (ZERO stretched grey slabs! NM-01, NM-04!)
  const cRoof1 = createHueImperialHipRoofGeometry(28.0, 12.2, 17.6, 6.8, 2.75, 0.24, 10, 7);
  cRoof1.translate(0, hallFloorY + 3.92, gateZ);
  centralRoofParts.push(cRoof1);
  addBox(woodParts, 23.2, 0.20, 7.6, 0, hallFloorY + 3.88, gateZ);

  for (const side of [-1, 1]) {
    const bwRoof1 = createHueImperialHipRoofGeometry(15.6, 10.6, 11.8, 6.4, 2.35, 0.20, 8, 6);
    bwRoof1.translate(side * 20.8, hallFloorY + 3.76, gateZ);
    jadeRoofParts.push(bwRoof1);
    addBox(woodParts, 11.6, 0.20, 6.8, side * 20.8, hallFloorY + 3.74, gateZ);

    const armRoof1 = createHueImperialHipRoofGeometry(10.8, 18.2, 6.2, 13.8, 2.50, 0.22, 8, 6);
    armRoof1.translate(side * 23.3, hallFloorY + 3.76, 3.9);
    jadeRoofParts.push(armRoof1);
    addBox(woodParts, 7.2, 0.20, 14.4, side * 23.3, hallFloorY + 3.74, 3.9);
    addFlushHipRidges(side * 23.3, hallFloorY + 3.76, 3.9, 10.8, 18.2, 6.2, 13.8, 2.50, 0.22, 0.12, 0.88);
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

  // Pavilion #1 Tier-2 Roof (MASSIVE BROAD Fiery Imperial Golden-Orange Hoàng Lưu Ly + Grounded Huế Eave Curves! NM-01, NM-02, NM-04!)
  const cRoof2H = 4.25;
  const cRoof2 = createHueImperialHipRoofGeometry(21.6, 10.4, 11.4, 1.4, cRoof2H, 0.28, 14, 10);
  cRoof2.translate(0, upperFloorY + 3.35, gateZ);
  centralRoofParts.push(cRoof2);

  addBox(ceramicParts, 11.6, 0.36, 0.44, 0, upperFloorY + 3.35 + cRoof2H + 0.04, gateZ);
  addBox(goldParts, 11.4, 0.12, 0.48, 0, upperFloorY + 3.35 + cRoof2H + 0.24, gateZ);
  addBox(woodParts, 15.4, 0.22, 6.2, 0, upperFloorY + 3.32, gateZ);
  addFlushHipRidges(0, upperFloorY + 3.35, gateZ, 21.6, 10.4, 11.4, 1.4, cRoof2H, 0.28, 0.14, 1.05);
  const centralFinials = createRoofFinialSetParts(0, upperFloorY + 3.35 + cRoof2H + 0.16, gateZ, 11.4, 0, 1.32, true);
  ceramicParts.push(...centralFinials.mainParts);
  goldParts.push(...centralFinials.goldParts);

  // Pavilions #2–#9: Tighter Monumental Interlocking 9-Roof Cascade (`Trùng Thiềm Điệp Ốc`, compact Tier-2 height, louvers & ZERO protruding grey ceiling slabs! NM-01, NM-04, NM-07, NM-08!)
  const wingPavSpecs = [
    { x: -13.2, z: gateZ, w: 7.2, d: 6.8, roofW: 9.4, roofD: 8.6, role: 'inner' as const, yOff: 0.05 },
    { x: 13.2, z: gateZ, w: 7.2, d: 6.8, roofW: 9.4, roofD: 8.6, role: 'inner' as const, yOff: 0.05 },
    { x: -22.8, z: gateZ, w: 7.8, d: 7.2, roofW: 10.2, roofD: 9.2, role: 'bell' as const, yOff: 0.22 },
    { x: 22.8, z: gateZ, w: 7.8, d: 7.2, roofW: 10.2, roofD: 9.2, role: 'drum' as const, yOff: 0.22 },
    { x: -23.3, z: -0.6, w: 7.2, d: 6.6, roofW: 9.6, roofD: 8.8, role: 'wing' as const, yOff: -0.05 },
    { x: 23.3, z: -0.6, w: 7.2, d: 6.6, roofW: 9.6, roofD: 8.8, role: 'wing' as const, yOff: -0.05 },
    { x: -23.3, z: 8.4, w: 7.6, d: 7.2, roofW: 10.2, roofD: 9.4, role: 'wing' as const, yOff: 0.16 },
    { x: 23.3, z: 8.4, w: 7.6, d: 7.2, roofW: 10.2, roofD: 9.4, role: 'wing' as const, yOff: 0.16 }
  ];

  for (const wp of wingPavSpecs) {
    const wUpperY = hallFloorY + 4.65 + wp.yOff;
    const uW = wp.w * 0.84;
    const uD = wp.d * 0.84;
    const uColH = wp.role === 'bell' || wp.role === 'drum' ? 2.55 : 2.30;
    addBox(crimsonParts, uW + 0.25, 0.24, uD + 0.25, wp.x, wUpperY + 0.12, wp.z);

    // Recessed dark-crimson multi-bay louvered shutters (`Cửa Lá Sách`) + subtle dark frieze (NO garish flat yellow stripe! NM-08!)
    if (wp.role !== 'bell' && wp.role !== 'drum') {
      addBox(voidParts, uW * 0.80, uColH * 0.86, uD * 0.80, wp.x, wUpperY + 0.24 + uColH * 0.43, wp.z);
      for (let lv = 0; lv < 5; lv++) {
        const ly = wUpperY + 0.62 + lv * 0.34;
        addBox(crimsonParts, uW * 0.86, 0.08, uD * 0.86, wp.x, ly, wp.z);
      }
      addBox(crimsonParts, uW * 0.88, 0.34, uD * 0.88, wp.x, wUpperY + 0.24 + uColH - 0.18, wp.z);
    }

    const hx = uW * 0.46;
    const hz = uD * 0.46;
    for (const ox of [-hx, 0, hx]) {
      for (const oz of [-hz, hz]) {
        addCyl(crimsonParts, 0.13, 0.16, uColH, 8, wp.x + ox, wUpperY + 0.24 + uColH * 0.5, wp.z + oz);
      }
    }
    for (const ox of [-hx, hx]) {
      addCyl(crimsonParts, 0.13, 0.16, uColH, 8, wp.x + ox, wUpperY + 0.24 + uColH * 0.5, wp.z);
    }
    // Ceiling cap STRICTLY inside column footprint so ZERO grey wood slab pokes under eaves! (NM-01!)
    addBox(crimsonParts, uW + 0.1, 0.20, uD + 0.1, wp.x, wUpperY + 0.20 + uColH, wp.z);

    const balY = wUpperY + 0.24;
    terracottaBalParts.push(
      ...createPiercedBalustradeParts(wp.x - hx, wp.z + hz, wp.x + hx, wp.z + hz, balY, 0.72, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x - hx, wp.z - hz, wp.x + hx, wp.z - hz, balY, 0.72, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x - hx, wp.z - hz, wp.x - hx, wp.z + hz, balY, 0.72, 'chu_van'),
      ...createPiercedBalustradeParts(wp.x + hx, wp.z - hz, wp.x + hx, wp.z + hz, balY, 0.72, 'chu_van')
    );

    if (wp.role === 'bell') {
      addCyl(crimsonParts, 0.10, 0.12, 2.15, 8, wp.x - 1.1, balY + 1.08, wp.z);
      addCyl(crimsonParts, 0.10, 0.12, 2.15, 8, wp.x + 1.1, balY + 1.08, wp.z);
      addBox(crimsonParts, 2.55, 0.20, 0.24, wp.x, balY + 2.15, wp.z);
      bronzeParts.push(...createBronzeBellParts(wp.x, balY + 0.72, wp.z, 1.1));
    } else if (wp.role === 'drum') {
      addCyl(crimsonParts, 0.10, 0.12, 1.35, 8, wp.x - 0.9, balY + 0.68, wp.z);
      addCyl(crimsonParts, 0.10, 0.12, 1.35, 8, wp.x + 0.9, balY + 0.68, wp.z);
      addBox(crimsonParts, 2.05, 0.18, 0.22, wp.x, balY + 0.72, wp.z);
      addCyl(woodParts, 0.72, 0.72, 1.36, 14, wp.x, balY + 1.38, wp.z, Math.PI * 0.5, 0);
      addCyl(marbleParts, 0.66, 0.66, 0.08, 14, wp.x, balY + 1.38, wp.z - 0.68, Math.PI * 0.5, 0);
      addCyl(marbleParts, 0.66, 0.66, 0.08, 14, wp.x, balY + 1.38, wp.z + 0.68, Math.PI * 0.5, 0);
      addCyl(goldParts, 0.74, 0.74, 0.10, 14, wp.x, balY + 1.38, wp.z - 0.62, Math.PI * 0.5, 0);
      addCyl(goldParts, 0.74, 0.74, 0.10, 14, wp.x, balY + 1.38, wp.z + 0.62, Math.PI * 0.5, 0);
    }

    // Velvety Deep Emerald-Jade Thanh Lưu Ly Roof + Grounded Flush Ceramic-Mosaic Hip Ridges & Con Xô! (NM-03, NM-04, NM-06!)
    const wRoof2Y = wUpperY + 0.24 + uColH;
    const wRoof2H = wp.role === 'bell' || wp.role === 'drum' ? 3.25 : 2.95;
    const wRoof2 = createHueImperialHipRoofGeometry(wp.roofW, wp.roofD, 3.2, 1.2, wRoof2H, 0.24, 8, 6);
    wRoof2.translate(wp.x, wRoof2Y, wp.z);
    jadeRoofParts.push(wRoof2);
    addBox(ceramicParts, 3.4, 0.34, 0.38, wp.x, wRoof2Y + wRoof2H + 0.12, wp.z);
    const wingFinials = createRoofFinialSetParts(wp.x, wRoof2Y + wRoof2H + 0.16, wp.z, 3.4, 0, 0.88, true);
    ceramicParts.push(...wingFinials.mainParts);
    goldParts.push(...wingFinials.goldParts);
    addFlushHipRidges(wp.x, wRoof2Y, wp.z, wp.roofW, wp.roofD, 3.2, 1.2, wRoof2H, 0.24, 0.12, 0.86);
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
  const hlcFinials = createRoofFinialSetParts(hlcX, hlcY2 + 4.75, hlcZ, 3.4, 0, 0.82, true);
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
    // Phượng hoàng (`HV-B01`) seated flush on Story-1 eave corners & Chữ Thọ (`HV-D02`) adorning Hiển Lâm Các
    goldParts.push(...createPhoenixFinialParts(side * 13.4, hallFloorY + 4.10, gateZ + 5.8, side < 0 ? 0.5 : -0.5, 0.78, 'single'));
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

  // 2.7. Photo 2 Foreground Landscape: TWO Velvety Dense Fibonacci-Distributed Emerald Ornamental Bushes (ZERO poking core! NM-23!)
  const bushCoreParts: THREE.BufferGeometry[] = [];
  const moatBalParts: THREE.BufferGeometry[] = [];
  const addSculptedDomeBush = (bx: number, bz: number, rx: number, ry: number, rz: number, seed: number, dense = true) => {
    const bRand = mulberry32(seed);
    // Deeply tucked dark-forest shadow core (`0.38x` radius -> NEVER pokes through outer foliage! NM-23)
    const core = new THREE.DodecahedronGeometry(1.0, 1);
    core.scale(rx * 0.38, ry * 0.38, rz * 0.38);
    core.translate(bx, ry * 0.42, bz);
    bushCoreParts.push(colorizeForMerge(core, '#0a2208'));

    const cardCount = dense ? 260 : 72;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const sunX = -0.55;
    const sunY = 0.72;
    const sunZ = 0.42;
    const cDark = new THREE.Color('#0c2c0a');
    const cMid = new THREE.Color('#286e18');
    const cLit = new THREE.Color('#5cb52e');
    const tmpCol = new THREE.Color();

    for (let k = 0; k < cardCount; k++) {
      // Uniform Fibonacci hemisphere spiral eliminates bald patches & spiky silhouette gaps!
      const frac = (k + 0.5) / cardCount;
      const ny = Math.pow(frac, 0.78); // 0..1 from base to crown
      const ringR = Math.sqrt(Math.max(0.02, 1.0 - ny * ny));
      const theta = k * goldenAngle + bRand() * 0.35;
      const nx = Math.cos(theta) * ringR;
      const nz = Math.sin(theta) * ringR;
      const jitterR = 0.86 + bRand() * 0.20;
      const px = bx + nx * rx * jitterR;
      const pz = bz + nz * rz * jitterR;
      const py = 0.48 + ny * ry * 0.90;

      const cardW = (0.30 + bRand() * 0.14) * Math.min(rx, rz) * 1.45;
      const cardH = cardW * (0.85 + bRand() * 0.25);
      const card = new THREE.PlaneGeometry(cardW, cardH);
      card.rotateX((bRand() - 0.5) * 0.95);
      card.rotateY(theta + (bRand() - 0.5) * 1.2);
      card.rotateZ((bRand() - 0.5) * 0.65);
      card.translate(px, py, pz);

      // Directional sun-to-shadow shading across dome (bright sunlit upper-left -> velvety dark forest base!)
      const sunDot = Math.max(0, Math.min(1, nx * sunX + ny * sunY + nz * sunZ + 0.35));
      if (sunDot < 0.5) {
        tmpCol.copy(cDark).lerp(cMid, sunDot * 2.0);
      } else {
        tmpCol.copy(cMid).lerp(cLit, (sunDot - 0.5) * 2.0);
      }
      foliageParts.push(colorizeForMerge(card, `#${tmpCol.getHexString()}`));
    }
  };
  addSculptedDomeBush(16.6, 16.0, 2.35, 3.65, 2.25, 18331, true);
  addSculptedDomeBush(23.8, 16.2, 2.55, 4.10, 2.35, 18332, true);
  addSculptedDomeBush(26.8, 14.8, 1.90, 2.95, 1.90, 18333, true);

  // Expanded Lush Tropical Park Canopy Screen blocking far-left distant pagoda & background skyline cliffs (NM-25!)
  for (const [lx, lz, sc, sd] of [
    [-36.5, -14.0, 1.85, 701],
    [-42.0, -4.0, 2.05, 702],
    [-38.5, 6.0, 1.85, 703],
    [-46.0, 9.5, 2.20, 708],
    [-48.0, 16.5, 2.15, 709],
    [-35.0, 16.0, 1.75, 710],
    [35.0, -14.0, 1.50, 704],
    [34.5, 2.0, 1.55, 705],
    [38.0, 9.5, 1.65, 706],
    [39.5, 14.2, 1.45, 707]
  ]) {
    addCyl(woodParts, 0.26 * sc, 0.42 * sc, 4.8 * sc, 6, lx, 2.4 * sc, lz);
    addSculptedDomeBush(lx, lz, 3.6 * sc, 4.8 * sc, 3.6 * sc, sd, false);
  }
  // Weathered citadel garden wall section at far-right terrace edge (Photo 2 right edge! NM-17)
  addBox(brickParts, 8.5, 3.4, 1.2, 34.5, 1.7, 13.8);
  addBox(stoneParts, 8.8, 0.24, 1.45, 34.5, 3.5, 13.8);

  // Vintage Dark-Iron 3-Globe Streetlamps with fluted base, wrought-iron scroll curls & dark iron cap finials (unlit frosted glass daytime! NM-24!)
  for (const [lx, lz] of [
    [25.8, 18.0],
    [13.2, 15.6],
    [-23.2, 16.4]
  ]) {
    addCyl(bronzeParts, 0.14, 0.24, 0.72, 10, lx, 0.36, lz);
    addCyl(bronzeParts, 0.055, 0.09, 4.65, 8, lx, 2.95, lz);
    for (const s of [-1, 1]) {
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(lx, 4.95, lz),
        new THREE.Vector3(lx + s * 0.24, 4.84, lz),
        new THREE.Vector3(lx + s * 0.44, 5.20, lz)
      ]);
      bronzeParts.push(new THREE.TubeGeometry(armCurve, 6, 0.024, 5, false));
      const curl = new THREE.TorusGeometry(0.10, 0.016, 4, 8, Math.PI * 1.4);
      curl.translate(lx + s * 0.22, 4.82, lz);
      bronzeParts.push(curl);
    }
    for (const gxOff of [-0.44, 0, 0.44]) {
      const gy = gxOff === 0 ? 5.48 : 5.34;
      const globe = new THREE.SphereGeometry(0.135, 10, 8);
      globe.translate(lx + gxOff, gy, lz);
      lampGlobeParts.push(globe);
      // Dark wrought-iron finial cap crowning each opal globe
      const cap = new THREE.ConeGeometry(0.065, 0.11, 6);
      cap.translate(lx + gxOff, gy + 0.145, lz);
      bronzeParts.push(cap);
    }
  }

  // 3. Kim Thủy Moat: Dark-Weathered Mossy Recessed-Panel Balustrades (`hue_moat_panel`, ZERO white wagon wheels! NM-18!),
  //    Deep Mirror Water (`0x32444d`), 5 Organic Dark-Olive Lily Drifts + Pink Lotus Buds (`NM-22`) & Flush Bridge Mouth (`NM-20`)!
  const bridgeZStart = 20.5;
  const bridgeZEnd = 39.5;
  const bridgeLen = bridgeZEnd - bridgeZStart;
  const bridgeMidZ = (bridgeZStart + bridgeZEnd) * 0.5;
  const bridgeWidth = 9.4;

  const moatRimW = 68.0;
  const sideEmbankW = (moatRimW - bridgeWidth) * 0.5;
  const sideEmbankX = bridgeWidth * 0.5 + sideEmbankW * 0.5;
  for (const s of [-1, 1]) {
    addBox(moatRubbleParts, sideEmbankW, 2.45, 1.65, s * sideEmbankX, -0.78, bridgeZStart - 0.55);
    addBox(moatBalParts, sideEmbankW + 0.2, 0.24, 1.85, s * sideEmbankX, 0.48, bridgeZStart - 0.55);
    addBox(moatRubbleParts, sideEmbankW, 2.45, 1.65, s * sideEmbankX, -0.78, bridgeZEnd + 0.55);
  }
  for (const mxSide of [-moatRimW * 0.5, moatRimW * 0.5]) {
    addBox(moatRubbleParts, 1.65, 2.45, bridgeLen + 2.4, mxSide, -0.78, bridgeMidZ);
  }
  addBox(moatRubbleParts, 1.65, 2.45, 12.0, 31.5, -0.78, bridgeZStart - 6.2);
  addBox(moatBalParts, 1.85, 0.24, 12.2, 31.5, 0.48, bridgeZStart - 6.2);
  moatBalParts.push(
    ...createPiercedBalustradeParts(-31.5, bridgeZStart - 0.55, -bridgeWidth * 0.5 - 0.3, bridgeZStart - 0.55, 0.60, 0.88, 'hue_moat_panel'),
    ...createPiercedBalustradeParts(bridgeWidth * 0.5 + 0.3, bridgeZStart - 0.55, 31.5, bridgeZStart - 0.55, 0.60, 0.88, 'hue_moat_panel'),
    ...createPiercedBalustradeParts(31.5, bridgeZStart - 0.55, 31.5, bridgeZStart - 12.0, 0.60, 0.88, 'hue_moat_panel')
  );

  // Mirror-reflective dark ink-emerald Kim Thủy Moat Water (`0x32444d` deep reflection absorption — NM-22!)
  const moatWaterY = -0.72;
  const moatWaterGeo = new THREE.PlaneGeometry(moatRimW - 1.4, bridgeLen - 0.6);
  const useLiveMirror =
    typeof window !== 'undefined' &&
    Boolean(ctx.renderer && ctx.renderer.domElement && ctx.renderer.domElement.width > 0);
  let moatWaterObj: THREE.Object3D;
  if (useLiveMirror) {
    const reflector = new Reflector(moatWaterGeo, {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x32444d
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

  // 5 Natural Organic Dark-Olive/Bronze Lily Pad Drifts hugging bridge shadow & rubble banks + 14 Pink Lotus Buds (NM-22!)
  const moatRand = mulberry32(180205);
  const driftCenters: Array<[number, number, number]> = [
    [9.2, bridgeZStart + 2.8, 3.8],
    [16.5, bridgeZStart + 4.4, 4.2],
    [24.0, bridgeZStart + 2.4, 3.2],
    [-9.5, bridgeZStart + 3.2, 4.0],
    [-19.0, bridgeZStart + 5.0, 4.5]
  ];
  const padTones = ['#23361a', '#353a1e', '#382a26', '#1e3018'];
  for (let i = 0; i < 120; i++) {
    const [dcx, dcz, dRad] = driftCenters[i % driftCenters.length];
    const ang = moatRand() * Math.PI * 2;
    const r = Math.sqrt(moatRand()) * dRad;
    const lx = dcx + Math.cos(ang) * r * 1.35;
    const lz = Math.max(bridgeZStart + 0.55, Math.min(bridgeZEnd - 0.6, dcz + Math.sin(ang) * r * 0.85));
    const padR = 0.16 + moatRand() * 0.18;
    const pad = createNotchedLotusPadGeometry(padR, 9);
    pad.rotateY(moatRand() * Math.PI * 2);
    pad.translate(lx, moatWaterY + 0.03, lz);
    lotusLeafParts.push(colorizeForMerge(pad, padTones[Math.floor(moatRand() * padTones.length)]));
    if (i < 14) {
      const bud = new THREE.ConeGeometry(0.065, 0.15, 6);
      bud.translate(lx, moatWaterY + 0.12, lz);
      lotusLeafParts.push(colorizeForMerge(bud, '#c85878'));
    }
  }

  // Bridge piers & arched spandrel STRICTLY BELOW stone roadway (pierTopY <= 0.16 -> ZERO rubble bar at bridge mouth! NM-20!)
  const numArches = 3;
  const archSpan = bridgeLen / numArches;
  const pierZs = [
    bridgeZStart + 1.4,
    bridgeZStart + archSpan,
    bridgeZStart + archSpan * 2.0,
    bridgeZEnd - 1.4
  ];
  for (const pz of pierZs) {
    const [wx, wz] = localToWorld(0, pz);
    const groundOffset = ctx.getHeight(wx, wz) - yBase;
    const botY = Math.min(-2.4, groundOffset - 2.2);
    const pierTopY = 0.14;
    const pierH = pierTopY - botY;
    addBox(moatRubbleParts, bridgeWidth + 0.15, pierH, 1.25, 0, botY + pierH * 0.5, pz);
  }

  // Properly proportioned submerged arched spandrel (`archWidth = 2.0 < height = 1.32` -> top at +0.16, strictly BELOW bridge deck 0.30..0.58! NM-20)
  const centralArchWall = createArchedWallGeometry(bridgeLen - 1.8, 1.32, bridgeWidth - 0.30, 2.0, 0.96);
  centralArchWall.rotateY(Math.PI * 0.5);
  centralArchWall.translate(0, -1.16, bridgeMidZ);
  moatRubbleParts.push(centralArchWall);

  // Continuous flush stone roadway extending seamlessly ±1.1m into forecourt & outer approach (0.0m rubble step bar! NM-20)
  const bridgeSegs = 10;
  const deckZ0 = bridgeZStart - 1.1;
  const deckZ1 = bridgeZEnd + 1.1;
  for (let s = 0; s < bridgeSegs; s++) {
    const tm = (s + 0.5) / bridgeSegs;
    const bz = THREE.MathUtils.lerp(deckZ0, deckZ1, tm);
    const crownY = 0.44 + 0.04 * Math.sin(tm * Math.PI);
    const segLen = (deckZ1 - deckZ0) / bridgeSegs + 0.14;
    addBox(stoneParts, bridgeWidth, 0.28, segLen, 0, crownY, bz);
  }
  const balSegs = 5;
  for (let bs = 0; bs < balSegs; bs++) {
    const t0 = bs / balSegs;
    const t1 = (bs + 1) / balSegs;
    const z0 = THREE.MathUtils.lerp(bridgeZStart, bridgeZEnd, t0);
    const z1 = THREE.MathUtils.lerp(bridgeZStart, bridgeZEnd, t1);
    const by = 0.62 + 0.04 * Math.sin(((t0 + t1) * 0.5) * Math.PI);
    for (const bx of [-bridgeWidth * 0.5 + 0.24, bridgeWidth * 0.5 - 0.24]) {
      moatBalParts.push(...createPiercedBalustradeParts(bx, z0, bx, z1, by, 0.86, 'hue_moat_panel'));
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
    ctx.huePack?.bastionBrickMat ?? ctx.materials.weatheredImperialBrick ?? ctx.materials.stone
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
    const archMesh = new THREE.Mesh(mergeNormalized(plasterArchParts), ctx.materials.agedPlaster ?? ctx.materials.whitePlaster);
    archMesh.castShadow = false;
    archMesh.receiveShadow = true;
    group.add(archMesh);
  }
  if (moatBalParts.length > 0) {
    const mbMesh = new THREE.Mesh(
      applyWorldBoxUV(mergeNormalized(moatBalParts), 1.8),
      ctx.huePack?.weatheredMoatBalustradeMat ?? ctx.materials.stone
    );
    mbMesh.castShadow = false;
    mbMesh.receiveShadow = true;
    group.add(mbMesh);
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
    // Unlit daytime frosted-opal glass globes reusing canonical whitePlaster (0 extra materials! NM-24)
    const globeMesh = new THREE.Mesh(mergeNormalized(lampGlobeParts), ctx.materials.whitePlaster);
    group.add(globeMesh);
  }

  if (woodParts.length > 0) {
    const woodMesh = new THREE.Mesh(applyWorldBoxUV(mergeNormalized(woodParts), 1.6), ctx.materials.darkWood);
    woodMesh.castShadow = true;
    group.add(woodMesh);
  }
  if (lotusLeafParts.length > 0) {
    const lotusLeafMat = ctx.materialLib?.getOrCreateStandard({
      vertexColors: true,
      roughness: 0.78,
      side: THREE.DoubleSide
    }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide });
    const lotusLeafMesh = new THREE.Mesh(mergeNormalized(lotusLeafParts), lotusLeafMat);
    group.add(lotusLeafMesh);
  }

  // Wave 2 Upgrades (Items 397–400): Kinh Thành Huế Core courtyard stone sundial (Nhật Quỹ),
  // ceremonial royal palanquin (Kiệu Rồng), Cửu Vị Thần Công gun-carriage wheels & Hồ Thái Dịch corner lanterns
  const w2HueStone: THREE.BufferGeometry[] = [];
  const w2HueGold: THREE.BufferGeometry[] = [];
  const w2HueCrimson: THREE.BufferGeometry[] = [];
  const w2HueWood: THREE.BufferGeometry[] = [];
  // 397: Imperial courtyard stone sundial & bronze/gold gnomon on forecourt inside Ngọ Môn
  addCyl(w2HueStone, 0.55, 0.68, 0.85, 6, 4.2, 0.45, gateZ + 12.5);
  addCyl(w2HueGold, 0.48, 0.48, 0.08, 6, 4.2, 0.92, gateZ + 12.5);
  addCyl(w2HueGold, 0.03, 0.04, 0.52, 5, 4.2, 1.18, gateZ + 12.5, 0.42);
  // 398: Ceremonial royal palanquin (Kiệu Rồng) with 4 corner canopy posts & flanking crimson parasols
  addBox(w2HueCrimson, 1.35, 0.24, 1.65, -4.2, 0.68, gateZ + 12.5);
  addBox(w2HueCrimson, 0.10, 0.10, 4.2, -4.85, 0.58, gateZ + 12.5);
  addBox(w2HueCrimson, 0.10, 0.10, 4.2, -3.55, 0.58, gateZ + 12.5);
  for (const px of [-0.58, 0.58]) {
    for (const pz of [-0.72, 0.72]) {
      addCyl(w2HueGold, 0.04, 0.045, 1.35, 5, -4.2 + px, 1.38, gateZ + 12.5 + pz);
    }
  }
  addBox(w2HueGold, 1.65, 0.38, 1.95, -4.2, 2.05, gateZ + 12.5);
  for (const s of [-1, 1]) {
    addCyl(w2HueCrimson, 0.04, 0.05, 2.45, 5, -4.2 + s * 1.45, 1.25, gateZ + 12.5);
    addCone(w2HueGold, 0.58, 0.36, 6, -4.2 + s * 1.45, 2.58, gateZ + 12.5);
    // 399: Cửu Vị Thần Công timber gun-carriage frames & awning beams
    addBox(w2HueWood, 1.45, 0.42, 6.2, s * 22.0, 0.55, 16.0);
    // 400: Hồ Thái Dịch stone lotus-pond corner lantern pedestals & footbridge trim
    addBox(w2HueStone, 0.48, 1.35, 0.48, s * 10.5, 0.68, 4.0);
    addBox(w2HueGold, 0.36, 0.36, 0.36, s * 10.5, 1.52, 4.0);
  }
  const w2HueStoneM = new THREE.Mesh(mergeNormalized(w2HueStone), ctx.materials.stone);
  w2HueStoneM.castShadow = false;
  const w2HueGoldM = new THREE.Mesh(mergeNormalized(w2HueGold), ctx.materials.gold);
  w2HueGoldM.castShadow = false;
  const w2HueCrimM = new THREE.Mesh(mergeNormalized(w2HueCrimson), ctx.materials.crimsonLacquer);
  w2HueCrimM.castShadow = false;
  const w2HueWoodM = new THREE.Mesh(mergeNormalized(w2HueWood), ctx.materials.darkWood);
  w2HueWoodM.castShadow = false;
  group.add(w2HueStoneM, w2HueGoldM, w2HueCrimM, w2HueWoodM);

  // Wave 3 Upgrades (Items 769–776): Kinh Thành Huế Core glazed dragon balustrades, Cầu Trung Đạo cheeks,
  // twin bronze Đỉnh, Tả/Hữu Vu colonnade posts, Cửu Đỉnh curb, Thái Bình Lâu lanterns & Ngọ Môn banners
  const w3HueStone: THREE.BufferGeometry[] = [];
  const w3HueGold: THREE.BufferGeometry[] = [];
  const w3HueCrimson: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // 769–770: Glazed dragon balustrades & Cầu Trung Đạo moat-bridge cheek walls with lotus posts
    addBox(w3HueStone, 0.36, 0.78, 6.2, s * 3.4, 0.42, gateZ + 6.5);
    addBox(w3HueGold, 0.42, 0.24, 6.3, s * 3.4, 0.90, gateZ + 6.5);
    addBox(w3HueStone, 0.36, 0.85, 7.2, s * 3.6, 0.48, 4.0);
    addCyl(w3HueGold, 0.16, 0.20, 0.42, 5, s * 3.6, 1.05, 0.6);
    addCyl(w3HueGold, 0.16, 0.20, 0.42, 5, s * 3.6, 1.05, 7.4);
    // 771–772: Twin bronze/gold Đỉnh cauldrons & Tả/Hữu Vu veranda colonnade posts
    addCyl(w3HueStone, 0.55, 0.62, 0.32, 6, s * 5.8, 0.16, gateZ + 18.5);
    addCyl(w3HueGold, 0.42, 0.32, 0.72, 6, s * 5.8, 0.68, gateZ + 18.5);
    addCyl(w3HueCrimson, 0.14, 0.16, 3.8, 6, s * 14.2, 1.90, gateZ + 22.0);
    // 774–776: Thái Bình Lâu stone lanterns, Ngọ Môn ceremonial banner standards & Hồ Thái Dịch coping
    addBox(w3HueStone, 0.48, 1.25, 0.48, s * 16.5, 0.62, -16.5);
    addCyl(w3HueCrimson, 0.06, 0.08, 3.2, 5, s * 7.8, 1.60, gateZ - 5.5);
    addBox(w3HueGold, 0.42, 0.85, 0.10, s * 7.8, 2.75, gateZ - 5.5);
    addBox(w3HueStone, 12.0, 0.24, 0.42, s * 11.0, 0.12, 8.2);
  }
  // 773: Cửu Đỉnh paved ceremonial terrace curb & central Cao Đỉnh dais
  addBox(w3HueStone, 18.0, 0.22, 2.4, 0, 0.11, -11.5);
  addBox(w3HueStone, 2.4, 0.38, 2.4, 0, 0.32, -11.5);
  const w3HueStoneM = new THREE.Mesh(mergeNormalized(w3HueStone), ctx.materials.stone);
  w3HueStoneM.castShadow = false;
  const w3HueGoldM = new THREE.Mesh(mergeNormalized(w3HueGold), ctx.materials.gold);
  w3HueGoldM.castShadow = false;
  const w3HueCrimM = new THREE.Mesh(mergeNormalized(w3HueCrimson), ctx.materials.crimsonLacquer);
  w3HueCrimM.castShadow = false;
  group.add(w3HueStoneM, w3HueGoldM, w3HueCrimM);

  // Wave 4 Upgrades (Items 1167–1174): Kinh Thành Huế Core Trụ Biểu obelisks, rear Bình Phong,
  // Hiển Lâm Các bronze Đỉnh, Kỳ Đài sentry boxes, Kim Thủy landing skiff & Cửu Đỉnh lanterns
  const w4HueStone: THREE.BufferGeometry[] = [];
  const w4HueGold: THREE.BufferGeometry[] = [];
  const w4HueWood: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    // 1167: Outer forecourt Trụ Biểu obelisks
    addBox(w4HueStone, 0.72, 4.4, 0.72, s * 11.5, 2.20, 42.5);
    addCone(w4HueGold, 0.42, 0.62, 5, s * 11.5, 4.72, 42.5);
    // 1169–1170: Hiển Lâm Các twin bronze/gold Đỉnh & Kỳ Đài base guardhouse sentry boxes
    addCyl(w4HueGold, 0.42, 0.34, 0.78, 6, hlcX + s * 4.2, 0.45, hlcZ + 8.5);
    addBox(w4HueStone, 2.2, 2.2, 2.2, flagX + s * 11.5, 1.10, flagZ - 8.5);
    // 1172–1174: Cửu Đỉnh corner lanterns & Ngọ Môn mounting blocks
    addBox(w4HueStone, 0.48, 1.35, 0.48, s * 9.5, 0.68, -11.5);
    addBox(w4HueGold, 0.36, 0.36, 0.36, s * 9.5, 1.52, -11.5);
    addBox(w4HueStone, 1.15, 0.52, 0.65, s * 5.2, 0.26, 44.0);
  }
  // 1168 & 1171: Rear courtyard Bình Phong spirit screen & Kim Thủy moat royal skiff
  addBox(w4HueStone, 4.8, 2.35, 0.48, 0, 1.18, -21.5);
  addBox(w4HueWood, 4.4, 0.42, 1.35, -14.0, -0.52, 30.0);
  const w4HueStoneM = new THREE.Mesh(mergeNormalized(w4HueStone), ctx.materials.stone);
  w4HueStoneM.castShadow = false;
  const w4HueGoldM = new THREE.Mesh(mergeNormalized(w4HueGold), ctx.materials.gold);
  w4HueGoldM.castShadow = false;
  const w4HueWoodM = new THREE.Mesh(mergeNormalized(w4HueWood), ctx.materials.darkWood);
  w4HueWoodM.castShadow = false;
  group.add(w4HueStoneM, w4HueGoldM, w4HueWoodM);

  // Wave 5 Upgrade (Item 1599): Kinh Thành Huế Core twin outer moat stone lantern piers & ceremonial cauldron
  const w5HueStone: THREE.BufferGeometry[] = [];
  const w5HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addBox(w5HueStone, 0.52, 1.55, 0.52, s * 14.5, 0.78, 34.0);
    addBox(w5HueGold, 0.36, 0.38, 0.36, s * 14.5, 1.72, 34.0);
  }
  addCyl(w5HueGold, 0.46, 0.36, 0.82, 6, 0, 0.45, 22.0);
  const w5HueStoneM = new THREE.Mesh(mergeNormalized(w5HueStone), ctx.materials.stone);
  w5HueStoneM.castShadow = false;
  const w5HueGoldM = new THREE.Mesh(mergeNormalized(w5HueGold), ctx.materials.gold);
  w5HueGoldM.castShadow = false;
  group.add(w5HueStoneM, w5HueGoldM);

  // Wave 6 Upgrade (Item 1999): Kinh Thành Huế Core twin outer moat ceremonial banner standards & bronze tripod
  const w6HueCrimson: THREE.BufferGeometry[] = [];
  const w6HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w6HueCrimson, 0.06, 0.08, 4.2, 4, s * 18.5, 2.1, 34.0);
    w6HueGold.push(new THREE.ConeGeometry(0.22, 0.48, 4).translate(s * 18.5, 4.42, 34.0));
  }
  addCyl(w6HueGold, 0.42, 0.32, 0.78, 5, 0, 0.42, 30.0);
  const w6HueCrimM = new THREE.Mesh(mergeNormalized(w6HueCrimson), ctx.materials.crimsonLacquer);
  w6HueCrimM.castShadow = false;
  const w6HueGoldM = new THREE.Mesh(mergeNormalized(w6HueGold), ctx.materials.gold);
  w6HueGoldM.castShadow = false;
  group.add(w6HueCrimM, w6HueGoldM);

  // Wave 7 Upgrade (Item 2399): Kinh Thành Huế Core twin outer-moat guard lantern stanchions & bronze incense tripod
  const w7HueCrimson: THREE.BufferGeometry[] = [];
  const w7HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w7HueCrimson, 0.06, 0.08, 4.2, 4, s * 24.5, 2.1, 34.0);
    w7HueGold.push(new THREE.ConeGeometry(0.22, 0.48, 4).translate(s * 24.5, 4.42, 34.0));
  }
  addCyl(w7HueGold, 0.42, 0.32, 0.78, 5, 0, 0.42, 34.5);
  const w7HueCrimM = new THREE.Mesh(mergeNormalized(w7HueCrimson), ctx.materials.crimsonLacquer);
  w7HueCrimM.castShadow = false;
  const w7HueGoldM = new THREE.Mesh(mergeNormalized(w7HueGold), ctx.materials.gold);
  w7HueGoldM.castShadow = false;
  group.add(w7HueCrimM, w7HueGoldM);

  // Wave 8 Upgrade (Item 2799): Kinh Thành Huế Core twin inner-moat guard lantern stanchions & bronze incense tripod
  const w8HueCrimson: THREE.BufferGeometry[] = [];
  const w8HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w8HueCrimson, 0.06, 0.08, 4.2, 4, s * 18.5, 2.1, 34.0);
    w8HueGold.push(new THREE.ConeGeometry(0.22, 0.48, 4).translate(s * 18.5, 4.42, 34.0));
  }
  addCyl(w8HueGold, 0.42, 0.32, 0.78, 5, 0, 0.42, 38.5);
  const w8HueCrimM = new THREE.Mesh(mergeNormalized(w8HueCrimson), ctx.materials.crimsonLacquer);
  w8HueCrimM.castShadow = false;
  const w8HueGoldM = new THREE.Mesh(mergeNormalized(w8HueGold), ctx.materials.gold);
  w8HueGoldM.castShadow = false;
  group.add(w8HueCrimM, w8HueGoldM);

  // Wave 9 Upgrade (Item 3199): Kinh Thành Huế Core twin outer-moat guard lantern stanchions & bronze incense tripod
  const w9HueCrimson: THREE.BufferGeometry[] = [];
  const w9HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w9HueCrimson, 0.06, 0.08, 4.2, 4, s * 22.5, 2.1, 34.0);
    w9HueGold.push(new THREE.ConeGeometry(0.22, 0.48, 4).translate(s * 22.5, 4.42, 34.0));
  }
  addCyl(w9HueGold, 0.42, 0.32, 0.78, 5, 0, 0.42, 42.5);
  const w9HueCrimM = new THREE.Mesh(mergeNormalized(w9HueCrimson), ctx.materials.crimsonLacquer);
  w9HueCrimM.castShadow = false;
  const w9HueGoldM = new THREE.Mesh(mergeNormalized(w9HueGold), ctx.materials.gold);
  w9HueGoldM.castShadow = false;
  group.add(w9HueCrimM, w9HueGoldM);

  // Wave 10 Upgrade (Item 3599): Kinh Thành Huế Core twin far-outer-moat guard lantern stanchions & bronze lotus tripod
  const w10HueCrimson: THREE.BufferGeometry[] = [];
  const w10HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w10HueCrimson, 0.06, 0.08, 4.2, 4, s * 26.5, 2.1, 34.0);
    w10HueGold.push(new THREE.ConeGeometry(0.22, 0.48, 4).translate(s * 26.5, 4.42, 34.0));
  }
  addCyl(w10HueGold, 0.42, 0.32, 0.78, 5, 0, 0.42, 46.5);
  const w10HueCrimM = new THREE.Mesh(mergeNormalized(w10HueCrimson), ctx.materials.crimsonLacquer);
  w10HueCrimM.castShadow = false;
  const w10HueGoldM = new THREE.Mesh(mergeNormalized(w10HueGold), ctx.materials.gold);
  w10HueGoldM.castShadow = false;
  group.add(w10HueCrimM, w10HueGoldM);

  // Wave 11 Upgrade (Item 3999): Kinh Thành Huế Core twin far-outer-south-moat guard lantern stanchions & bronze lotus tripod
  const w11HueCrimson: THREE.BufferGeometry[] = [];
  const w11HueGold: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    addCyl(w11HueCrimson, 0.06, 0.08, 4.2, 4, s * 31.0, 2.1, 34.0);
    w11HueGold.push(new THREE.ConeGeometry(0.22, 0.48, 4).translate(s * 31.0, 4.42, 34.0));
  }
  addCyl(w11HueGold, 0.42, 0.32, 0.78, 5, 0, 0.42, 50.5);
  const w11HueCrimM = new THREE.Mesh(mergeNormalized(w11HueCrimson), ctx.materials.crimsonLacquer);
  w11HueCrimM.castShadow = false;
  const w11HueGoldM = new THREE.Mesh(mergeNormalized(w11HueGold), ctx.materials.gold);
  w11HueGoldM.castShadow = false;
  group.add(w11HueCrimM, w11HueGoldM);

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
  return buildHoiAnAncientTownComplex(ctx, animatedUniforms);
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
    roughness: 0.22,
    metalness: 0.45
  });
  ctx.extraMaterials.push(dragonEyeMat);
  const eyeMesh = new THREE.Mesh(mergeNormalized(eyeParts), dragonEyeMat);

  const fireMesh = new THREE.Mesh(fireConeGeo, fireShaderMat);
  fireMesh.name = 'DragonBridgeFireBreath';

  group.add(stoneMesh, asphaltMesh, steelMesh, cableMesh, goldMesh, eyeMesh, fireMesh);
  // P1 Cầu Rồng Đà Nẵng Motif Upgrades (`MT-046`..`MT-052`): Lotus tail crown (`HV-C01`/`HV-C03`) & wave plinth (`HV-D06`)
  // + Items 157–168: Lý-Dynasty Đầu Rồng whiskers & Ngọc Minh Châu pearl, stylized Đuôi Rồng tail fin, 6-lane dashed markings,
  //   West bank Công Viên Bờ Tây Sông Hàn promenade, Du Thuyền Sông Hàn cruise boat, approach flagpoles, LED edge accents & embankment steps!
  const dbMotifGold = new THREE.Mesh(
    mergeNormalized([
      ...createLotusPetalRingParts(258, 9.2, cz, 1.45, 10, 1, true),
      // 157: Dragon whiskers (Râu Rồng) & glowing Ngọc Minh Châu pearl in front of dragon head
      new THREE.CylinderGeometry(0.06, 0.10, 3.2, 6).rotateZ(0.85).translate(425.5, 19.6, cz - 1.15),
      new THREE.CylinderGeometry(0.06, 0.10, 3.2, 6).rotateZ(0.85).translate(425.5, 19.6, cz + 1.15),
      new THREE.SphereGeometry(0.68, 10, 8).translate(427.4, 20.6, cz),
      // 158: Stylized lotus-flower Đuôi Rồng tail fin radiating at West end (x = 246)
      new THREE.ConeGeometry(1.15, 2.8, 5).rotateZ(0.92).translate(244.8, 11.4, cz),
      // 164: Decorative golden LED strip accents along bridge outer concrete edge beams
      new THREE.BoxGeometry(154.0, 0.18, 0.14).translate(335.0, 7.95, cz - 9.05),
      new THREE.BoxGeometry(154.0, 0.18, 0.14).translate(335.0, 7.95, cz + 9.05)
    ]),
    ctx.materials.gold
  );
  dbMotifGold.castShadow = false;
  group.add(dbMotifGold);

  // 159–161, 165–168: West bank Công Viên Bờ Tây Sông Hàn promenade, East bank Du Thuyền Sông Hàn cruise boat,
  // approach plaza flagpoles, embankment steps & 6-lane roadway dashed white lane markings!
  const dbExtraMarble: THREE.BufferGeometry[] = [];
  for (let lx = 262; lx <= 408; lx += 8.0) {
    for (const lz of [-4.8, -2.4, 2.4, 4.8]) {
      dbExtraMarble.push(new THREE.BoxGeometry(3.2, 0.04, 0.14).translate(lx, 8.53, cz + lz));
    }
  }
  // West bank landscaped riverside promenade & stone seawall (x = 216..228)
  dbExtraMarble.push(
    new THREE.BoxGeometry(10.5, 2.4, 38.0).translate(221.5, 0.85, cz),
    new THREE.BoxGeometry(1.4, 0.85, 38.0).translate(226.4, 2.15, cz),
    // Approach plaza flagpoles & stone embankment steps
    new THREE.CylinderGeometry(0.08, 0.12, 8.5, 6).translate(227.5, 6.2, cz - 11.0),
    new THREE.CylinderGeometry(0.08, 0.12, 8.5, 6).translate(442.5, 6.2, cz + 11.0),
    new THREE.BoxGeometry(3.6, 0.45, 5.5).translate(442.0, 0.95, cz - 14.0)
  );
  const dbExtraMesh = new THREE.Mesh(mergeNormalized(dbExtraMarble), whiteMarbleMat);
  dbExtraMesh.castShadow = false;
  dbExtraMesh.receiveShadow = true;
  group.add(dbExtraMesh);

  // 166: Illuminated Du Thuyền Sông Hàn river cruise boat moored along East promenade (x = 428, z = -12)
  const cruiseParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(12.5, 1.35, 3.6).translate(428.0, 0.68, cz + 22.0),
    new THREE.BoxGeometry(9.2, 1.45, 3.0).translate(428.0, 2.05, cz + 22.0)
  ];
  const cruiseMesh = new THREE.Mesh(mergeNormalized(cruiseParts), parkWoodMat);
  cruiseMesh.castShadow = false;
  group.add(cruiseMesh);

  // Wave 2 Upgrades (Items 361–370): Cá Chép Hóa Rồng 7.5m Marble Fountain, Cầu Tình Yêu Pier
  // with Heart Lantern Lamp-Posts & Golden Photo Arch, Bến Du Thuyền Kiosk, West Park & Bridge Planters
  const w2DbMarble: THREE.BufferGeometry[] = [];
  const w2DbGold: THREE.BufferGeometry[] = [];
  const w2DbCrimson: THREE.BufferGeometry[] = [];
  const w2DbWood: THREE.BufferGeometry[] = [];
  // 361–362: Tượng Cá Chép Hóa Rồng (7.5m white-marble Carp-Dragon fountain sculpture on stepped octagonal pedestal at 434, cz - 14.5)
  const ccX = 434.0;
  const ccZ = cz - 14.5;
  addCyl(w2DbMarble, 2.6, 2.9, 0.65, 6, ccX, 0.85, ccZ);
  addCyl(w2DbMarble, 1.5, 1.85, 1.15, 6, ccX, 1.72, ccZ);
  addCyl(w2DbMarble, 0.85, 1.15, 3.8, 6, ccX, 4.15, ccZ, 0, 0, 0.18);
  addCone(w2DbMarble, 1.15, 1.85, 5, ccX - 0.55, 6.55, ccZ, 0, 0, 0.55);
  addBox(w2DbMarble, 1.55, 1.15, 1.25, ccX - 0.85, 5.85, ccZ);
  // 363–365: Cầu Tình Yêu arched wooden Love Bridge pier (423.5, cz - 14.5) with grounded pilings, crimson heart lantern posts & golden heart arch
  addBox(w2DbWood, 16.5, 0.32, 3.8, 423.5, 1.25, ccZ);
  for (let lp = 0; lp < 4; lp++) {
    const lx = 417.0 + lp * 4.2;
    for (const s of [-1, 1]) {
      addCyl(w2DbWood, 0.13, 0.16, 3.3, 6, lx, -0.35, ccZ + s * 1.65);
      addCyl(w2DbGold, 0.05, 0.07, 2.8, 5, lx, 2.65, ccZ + s * 1.72);
      addBox(w2DbCrimson, 0.38, 0.42, 0.18, lx, 4.05, ccZ + s * 1.72, 0, 0, Math.PI * 0.25);
    }
  }
  addBox(w2DbGold, 0.16, 2.6, 0.16, 415.6, 2.55, ccZ - 1.4);
  addBox(w2DbGold, 0.16, 2.6, 0.16, 415.6, 2.55, ccZ + 1.4);
  addBox(w2DbGold, 0.18, 0.28, 3.1, 415.6, 3.85, ccZ);
  // 366–370: Bến Du Thuyền ticket kiosk, cruise sun-deck lanterns, West bank park pergola/benches, flat-span guardrail trim & approach Hoa Giấy planters
  addBox(w2DbWood, 3.2, 2.4, 2.6, 436.0, 2.15, cz + 22.0);
  addCone(w2DbCrimson, 1.65, 0.55, 6, 436.0, 3.60, cz + 22.0);
  addBox(w2DbGold, 8.8, 0.12, 2.8, 428.0, 3.15, cz + 22.0);
  for (const s of [-1, 1]) {
    // 368: West bank Công Viên Bờ Tây benches & grounded 4-post pergola frame
    addBox(w2DbMarble, 2.2, 0.48, 0.65, 222.0, 2.25, cz + s * 12.0);
    for (const px of [-1.6, 1.6]) {
      for (const pz of [-1.6, 1.6]) {
        addCyl(w2DbWood, 0.09, 0.11, 2.65, 6, 222.0 + px, 3.15, cz + s * 12.0 + pz);
      }
    }
    addBox(w2DbWood, 3.6, 0.16, 3.6, 222.0, 4.45, cz + s * 12.0);
    // 369–370: Flat-span golden top-rail accent (x = 266..280, y = 9.48 flush atop 8.5m deck railing!) & Hoa Giấy stone planters
    addBox(w2DbGold, 14.0, 0.12, 0.12, 273.0, 9.48, cz + s * 8.65);
    addBox(w2DbMarble, 1.45, 0.58, 1.45, 441.5, 2.15, cz + s * 7.5);
    addCone(w2DbCrimson, 0.68, 0.72, 5, 441.5, 2.82, cz + s * 7.5);
  }
  const w2DbMarbleM = new THREE.Mesh(mergeNormalized(w2DbMarble), whiteMarbleMat);
  w2DbMarbleM.castShadow = false;
  const w2DbGoldM = new THREE.Mesh(mergeNormalized(w2DbGold), ctx.materials.gold);
  w2DbGoldM.castShadow = false;
  const w2DbCrimM = new THREE.Mesh(mergeNormalized(w2DbCrimson), ctx.materials.crimsonLacquer);
  w2DbCrimM.castShadow = false;
  const w2DbWoodM = new THREE.Mesh(mergeNormalized(w2DbWood), parkWoodMat);
  w2DbWoodM.castShadow = false;
  group.add(w2DbMarbleM, w2DbGoldM, w2DbCrimM, w2DbWoodM);

  // Wave 3 Upgrades (Items 721–740): Đà Nẵng APEC Park Kite-Wing Dome, Dragon Bridge Fire-Water
  // Nozzle Manifold inside Dragon Jaw, Han River Promenades, Streetlamps, Pergola & Approach Gantries
  const w3DbMarble: THREE.BufferGeometry[] = [];
  const w3DbGold: THREE.BufferGeometry[] = [];
  const w3DbCrimson: THREE.BufferGeometry[] = [];
  const w3DbWood: THREE.BufferGeometry[] = [];

  // 721–725: Công Viên APEC Đà Nẵng (APEC Park) terraced plaza & iconic white arched kite-wing dome (224.0, cz + 26.0)
  const apX = 224.0;
  const apZ = cz + 26.0;
  const apY = Math.max(
    ctx.getHeight(apX, apZ),
    ctx.getHeight(apX - 8.0, apZ - 7.0),
    ctx.getHeight(apX + 8.0, apZ - 7.0),
    ctx.getHeight(apX - 8.0, apZ + 7.0),
    ctx.getHeight(apX + 8.0, apZ + 7.0)
  );
  // 721: Stepped stone plaza terrace with deep retaining skirt
  addBox(w3DbMarble, 17.5, 5.2, 15.0, apX, apY - 2.45, apZ);
  // 722–723: Iconic white arched kite-wing dome canopy (Mái Vòm Cánh Diều) & 4 grounded flared support columns
  addBox(w3DbMarble, 13.5, 0.42, 9.8, apX, apY + 5.45, apZ, 0, 0, 0.08);
  addBox(w3DbMarble, 11.2, 0.36, 7.6, apX, apY + 6.05, apZ, 0, 0, -0.06);
  for (const axO of [-5.2, 5.2]) {
    for (const azO of [-3.6, 3.6]) {
      addCyl(w3DbMarble, 0.38, 0.24, 5.65, 6, apX + axO, apY + 2.75, apZ + azO);
    }
  }
  // 724–725: Tiered amphitheater seating steps & sculptural modern white-marble APEC art totems
  addBox(w3DbMarble, 7.6, 0.45, 1.45, apX, apY + 0.38, apZ - 4.8);
  addBox(w3DbMarble, 7.6, 0.90, 1.25, apX, apY + 0.62, apZ - 6.0);
  addCyl(w3DbMarble, 0.28, 0.42, 2.45, 5, apX + 6.8, apY + 1.38, apZ + 5.2);
  addCyl(w3DbGold, 0.36, 0.36, 0.16, 6, apX + 6.8, apY + 2.75, apZ + 5.2, Math.PI * 0.5);

  // 726–728: Cầu Rồng authentic Fire-and-Water Nozzle Manifold inside Dragon's open jaw & fuel/water pressure pipes
  addCyl(w3DbGold, 0.28, 0.36, 1.45, 6, 415.6, 15.85, cz, 0, 0, Math.PI * 0.5);
  addCyl(w3DbCrimson, 0.18, 0.18, 0.65, 6, 416.3, 15.85, cz, 0, 0, Math.PI * 0.5);
  for (const s of [-1, 1]) {
    addCyl(w3DbGold, 0.09, 0.09, 3.2, 5, 413.4, 15.45, cz + s * 0.38, 0, 0, Math.PI * 0.46);
    addCone(w3DbGold, 0.16, 0.48, 4, 415.2, 16.35, cz + s * 0.52);
  }

  // 729–740: Bridge pier uplight housings, West & East Han River promenades, curved streetlamps, East pergola,
  // Cá Chép corner finials, floating finger-pier, cruise helm house, approach gantries & floral planters
  for (const px of [285, 325, 365, 405]) {
    addBox(w3DbGold, 0.55, 0.38, 0.55, px, 2.35, cz - 7.8);
    addBox(w3DbGold, 0.55, 0.38, 0.55, px, 2.35, cz + 7.8);
  }
  for (const s of [-1, 1]) {
    // 731–732: West Han River promenade viewing terrace, curved waterfront lamps & benches
    addBox(w3DbMarble, 2.8, 0.45, 8.5, 228.5, 1.95, cz + s * 16.0);
    addCyl(w3DbGold, 0.07, 0.10, 3.8, 5, 229.2, 3.85, cz + s * 14.0);
    addBox(w3DbWood, 0.58, 0.46, 2.0, 227.8, 2.38, cz + s * 16.0);
    // 733–736: East Han River viewing deck, Cầu Tình Yêu bollards & Cá Chép corner lotus posts
    addBox(w3DbMarble, 3.2, 0.42, 6.8, 438.0, 1.85, ccZ + s * 6.5);
    addCyl(w3DbMarble, 0.18, 0.22, 0.95, 5, ccX + 2.8, 1.65, ccZ + s * 2.8);
    addCyl(w3DbGold, 0.16, 0.20, 0.92, 5, 431.2, 1.72, ccZ + s * 2.2);
    // 739–740: Bridge East/West approach heritage gantry pillars & floral planter beds
    addCyl(w3DbGold, 0.22, 0.28, 5.2, 6, 444.0, 4.45, cz + s * 9.5);
    addBox(w3DbMarble, 1.45, 0.55, 2.4, 226.5, 2.15, cz + s * 21.0);
    addCone(w3DbCrimson, 0.65, 0.72, 5, 226.5, 2.80, cz + s * 21.0);
  }
  // 734 & 737–738: East promenade shaded timber pergola (with stone base deck & grounded columns!), floating boarding finger-pier & cruise helm house
  addBox(w3DbMarble, 4.4, 2.2, 4.4, 439.5, 0.55, ccZ);
  addBox(w3DbWood, 3.8, 0.16, 3.8, 439.5, 4.35, ccZ);
  for (const pxO of [-1.6, 1.6]) {
    for (const pzO of [-1.6, 1.6]) {
      addCyl(w3DbWood, 0.09, 0.11, 2.95, 5, 439.5 + pxO, 2.95, ccZ + pzO);
    }
  }
  addBox(w3DbWood, 6.2, 0.24, 1.85, 430.5, 0.52, cz + 17.5);
  addBox(w3DbMarble, 2.4, 1.35, 1.85, 424.5, 3.85, cz + 22.0);
  addBox(w3DbGold, 0.35, 0.42, 19.6, 444.0, 7.05, cz);

  const w3DbMarbleM = new THREE.Mesh(mergeNormalized(w3DbMarble), whiteMarbleMat);
  w3DbMarbleM.castShadow = false;
  const w3DbGoldM = new THREE.Mesh(mergeNormalized(w3DbGold), ctx.materials.gold);
  w3DbGoldM.castShadow = false;
  const w3DbCrimM = new THREE.Mesh(mergeNormalized(w3DbCrimson), ctx.materials.crimsonLacquer);
  w3DbCrimM.castShadow = false;
  const w3DbWoodM = new THREE.Mesh(mergeNormalized(w3DbWood), parkWoodMat);
  w3DbWoodM.castShadow = false;
  group.add(w3DbMarbleM, w3DbGoldM, w3DbCrimM, w3DbWoodM);

  // Wave 4 Upgrades (Items 1121–1140): Han River East Cultural Stage, Sơn Trà Night Market,
  // APEC Park Lotus Fountain, 2nd Han River Cruise Boat & Channel Beacon
  const w4DbMarble: THREE.BufferGeometry[] = [];
  const w4DbGold: THREE.BufferGeometry[] = [];
  const w4DbCrimson: THREE.BufferGeometry[] = [];
  const w4DbWood: THREE.BufferGeometry[] = [];
  // 1121–1123: Sân Khấu Bờ Đông Sông Hàn (Han River East Cultural Stage at 448, -56)
  const stgX = 448.0;
  const stgZ = -56.0;
  const stgY = Math.max(ctx.getHeight(stgX, stgZ), ctx.getHeight(stgX - 5.0, stgZ - 4.0), ctx.getHeight(stgX + 5.0, stgZ + 4.0));
  addBox(w4DbMarble, 10.6, 4.6, 8.6, stgX, stgY - 2.1, stgZ);
  addBox(w4DbWood, 8.6, 0.35, 5.2, stgX, stgY + 0.38, stgZ - 1.2);
  addBox(w4DbGold, 8.2, 3.4, 0.45, stgX, stgY + 2.25, stgZ - 3.6);
  for (let br = 0; br < 3; br++) {
    addBox(w4DbWood, 7.6, 0.45, 0.58, stgX, stgY + 0.45, stgZ + 1.6 + br * 1.15);
  }
  // 1124–1125: Chợ Đêm Sơn Trà (Sơn Trà Night Market 3 shaded booths at 454, -34)
  for (let mb = -1; mb <= 1; mb++) {
    const mz = -34.0 + mb * 4.4;
    addBox(w4DbWood, 2.8, 0.85, 3.4, 454.0, 2.35, mz);
    addBox(w4DbCrimson, 3.2, 0.20, 3.8, 454.0, 4.35, mz);
    for (const pxO of [-1.3, 1.3]) {
      for (const pzO of [-1.5, 1.5]) {
        addCyl(w4DbWood, 0.05, 0.06, 2.55, 5, 454.0 + pxO, 3.15, mz + pzO);
      }
    }
  }
  // 1126–1128: APEC Park lotus reflecting pool & benches
  addCyl(w4DbMarble, 2.4, 2.6, 0.42, 6, apX - 8.5, apY + 0.35, apZ + 8.5);
  addCone(w4DbGold, 0.85, 1.45, 6, apX - 8.5, apY + 1.25, apZ + 8.5);
  // 1129–1135, 1140: Love Bridge heart arch, 2nd Han River cruise boat (428, -4) & river navigation buoy
  addBox(w4DbGold, 0.16, 2.8, 3.4, 428.0, 3.45, carpZ);
  addBox(w4DbWood, 11.5, 1.25, 3.4, 428.0, 0.65, -4.0);
  addBox(w4DbMarble, 8.6, 1.35, 2.8, 428.0, 1.95, -4.0);
  addCyl(w4DbCrimson, 0.72, 0.85, 1.35, 6, 340.0, 0.65, -12.0);
  addCone(w4DbGold, 0.32, 0.55, 5, 340.0, 1.62, -12.0);

  const w4DbMarbleM = new THREE.Mesh(mergeNormalized(w4DbMarble), whiteMarbleMat);
  w4DbMarbleM.castShadow = false;
  const w4DbGoldM = new THREE.Mesh(mergeNormalized(w4DbGold), ctx.materials.gold);
  w4DbGoldM.castShadow = false;
  const w4DbCrimM = new THREE.Mesh(mergeNormalized(w4DbCrimson), ctx.materials.crimsonLacquer);
  w4DbCrimM.castShadow = false;
  const w4DbWoodM = new THREE.Mesh(mergeNormalized(w4DbWood), parkWoodMat);
  w4DbWoodM.castShadow = false;
  group.add(w4DbMarbleM, w4DbGoldM, w4DbCrimM, w4DbWoodM);

  // Wave 5 Upgrades (Items 1521–1545): Han River Promenade Light Pylons, Viewing Balcony,
  // Dragon Bridge Lighting & Spectator Plazas, APEC Park Sculpture Garden & 3rd Dinner-Cruise Vessel
  const w5DbMarble: THREE.BufferGeometry[] = [];
  const w5DbGold: THREE.BufferGeometry[] = [];
  const w5DbCrimson: THREE.BufferGeometry[] = [];
  const w5DbWood: THREE.BufferGeometry[] = [];

  // 1521–1526: 6 sculpted golden-arch Han River promenade light pylons
  for (const lz of [-44.0, -24.0, -4.0]) {
    addCyl(w5DbGold, 0.08, 0.12, 4.6, 5, 346.0, 3.6, lz);
    addCone(w5DbGold, 0.34, 0.45, 5, 346.0, 6.05, lz);
    addCyl(w5DbGold, 0.08, 0.12, 4.6, 5, 442.0, 3.6, lz);
    addCone(w5DbGold, 0.34, 0.45, 5, 442.0, 6.05, lz);
  }
  // 1527–1529: Cantilevered marble Han River viewing balcony (444, -22) & benches + compass medallion
  const vbX = 444.0;
  const vbZ = -22.0;
  const vbY = Math.max(ctx.getHeight(vbX, vbZ), ctx.getHeight(vbX - 3.0, vbZ - 3.5), ctx.getHeight(vbX + 3.0, vbZ + 3.5));
  addBox(w5DbMarble, 6.4, 5.6, 7.6, vbX, vbY - 2.65, vbZ);
  addBox(w5DbGold, 0.10, 0.10, 7.4, vbX - 3.1, vbY + 1.15, vbZ);
  for (const bzO of [-2.4, 2.4]) {
    addBox(w5DbWood, 0.58, 0.46, 2.0, vbX + 1.8, vbY + 0.38, vbZ + bzO);
    addBox(w5DbWood, 0.58, 0.46, 2.0, 348.5, 1.95, bzO - 16.0);
  }
  addCyl(w5DbGold, 1.25, 1.25, 0.08, 6, 436.0, 1.85, carpZ);

  // 1530–1536: Dragon Bridge uplight sconces, East/West spectator terraces, Sơn Trà festival archway & 2 kiosks
  for (const ax of [356.0, 434.0]) {
    addBox(w5DbGold, 0.32, 0.52, 0.32, ax, 4.2, -32.0);
    addBox(w5DbGold, 0.32, 0.52, 0.32, ax, 4.2, -16.0);
  }
  addBox(w5DbMarble, 7.2, 0.65, 4.8, 446.0, 2.15, -14.0);
  addBox(w5DbMarble, 6.2, 0.55, 4.2, 344.0, 2.05, -14.0);
  // 1534: Sơn Trà crimson-and-gold festival archway
  addCyl(w5DbCrimson, 0.12, 0.14, 4.2, 5, 452.0, 3.6, -42.5);
  addCyl(w5DbCrimson, 0.12, 0.14, 4.2, 5, 456.0, 3.6, -42.5);
  addBox(w5DbGold, 4.6, 0.42, 0.36, 454.0, 5.72, -42.5);
  for (const kz of [-48.0, -20.5]) {
    addBox(w5DbWood, 2.6, 0.82, 3.0, 454.0, 2.35, kz);
    addBox(w5DbCrimson, 3.0, 0.20, 3.4, 454.0, 4.35, kz);
    for (const ox of [-1.2, 1.2]) {
      for (const oz of [-1.35, 1.35]) {
        addCyl(w5DbWood, 0.05, 0.06, 2.55, 5, 454.0 + ox, 3.15, kz + oz);
      }
    }
  }

  // 1537–1545: APEC Park 4 sculpture monuments, curved garden bench, 4-post pergola & 3rd Han River dinner-cruise vessel
  for (const [sx, sz] of [[-12.0, -6.5], [-12.0, 14.0], [10.5, -6.5], [10.5, 14.0]] as const) {
    addBox(w5DbMarble, 1.45, 0.72, 1.45, apX + sx, apY + 0.45, apZ + sz);
    addCone(w5DbGold, 0.55, 1.45, 5, apX + sx, apY + 1.52, apZ + sz);
  }
  addBox(w5DbMarble, 5.8, 0.52, 0.75, apX - 8.5, apY + 0.38, apZ + 12.8);
  // 1542: APEC 4-post shaded timber pergola (apX + 9.5, apZ + 8.5)
  addBox(w5DbWood, 4.2, 0.18, 3.4, apX + 9.5, apY + 3.05, apZ + 8.5);
  for (const ox of [-1.8, 1.8]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w5DbWood, 0.08, 0.10, 3.05, 5, apX + 9.5 + ox, apY + 1.52, apZ + 8.5 + oz);
    }
  }
  // 1543–1545: 3rd Han River dinner-cruise vessel (422, 14) & twin channel spar-buoys
  addBox(w5DbWood, 12.0, 1.25, 3.6, 422.0, 0.65, 14.0);
  addBox(w5DbMarble, 8.8, 1.45, 2.8, 422.0, 1.98, 14.0);
  addBox(w5DbGold, 8.6, 0.18, 2.6, 422.0, 2.82, 14.0);
  addCyl(w5DbCrimson, 0.52, 0.65, 1.35, 5, 392.0, 0.65, 24.0);
  addCyl(w5DbGold, 0.52, 0.65, 1.35, 5, 412.0, 0.65, 24.0);

  const w5DbMarbleM = new THREE.Mesh(mergeNormalized(w5DbMarble), whiteMarbleMat);
  w5DbMarbleM.castShadow = false;
  const w5DbGoldM = new THREE.Mesh(mergeNormalized(w5DbGold), ctx.materials.gold);
  w5DbGoldM.castShadow = false;
  const w5DbCrimM = new THREE.Mesh(mergeNormalized(w5DbCrimson), ctx.materials.crimsonLacquer);
  w5DbCrimM.castShadow = false;
  const w5DbWoodM = new THREE.Mesh(mergeNormalized(w5DbWood), parkWoodMat);
  w5DbWoodM.castShadow = false;
  group.add(w5DbMarbleM, w5DbGoldM, w5DbCrimM, w5DbWoodM);

  // Wave 6 Upgrades (Items 1921–1945): West Han River Waterfront Park Plaza, Dragon Bridge Plazas,
  // Sơn Trà Night-Market Stalls, APEC Sculptures & 4th Han River Sightseeing Riverboat
  const w6DbMarble: THREE.BufferGeometry[] = [];
  const w6DbGold: THREE.BufferGeometry[] = [];
  const w6DbCrimson: THREE.BufferGeometry[] = [];
  const w6DbWood: THREE.BufferGeometry[] = [];

  // 1921–1926: Công Viên Bờ Tây Sông Hàn (West Han River Park Plaza at 342.0, -34.0)
  const wpX = 342.0;
  const wpZ = -34.0;
  const wpY = Math.max(ctx.getHeight(wpX, wpZ), ctx.getHeight(wpX - 3.5, wpZ - 4.0), ctx.getHeight(wpX + 3.5, wpZ + 4.0));
  addBox(w6DbMarble, 7.6, 5.6, 8.4, wpX, wpY - 2.65, wpZ);
  addBox(w6DbWood, 4.2, 0.18, 3.6, wpX - 0.8, wpY + 3.05, wpZ);
  for (const ox of [-2.6, 1.0]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w6DbWood, 0.08, 0.10, 3.05, 4, wpX + ox, wpY + 1.52, wpZ + oz);
    }
  }
  addBox(w6DbWood, 0.56, 0.46, 2.0, wpX - 0.8, wpY + 0.38, wpZ - 0.9);
  addBox(w6DbWood, 0.56, 0.46, 2.0, wpX - 0.8, wpY + 0.38, wpZ + 0.9);
  addBox(w6DbMarble, 1.35, 0.72, 1.35, wpX + 2.2, wpY + 0.48, wpZ);
  addCone(w6DbGold, 0.52, 1.65, 4, wpX + 2.2, wpY + 1.65, wpZ);
  for (const dz of [-3.6, 3.6]) {
    addCyl(w6DbGold, 0.08, 0.11, 4.4, 4, wpX + 3.2, wpY + 2.25, wpZ + dz);
    addCone(w6DbGold, 0.32, 0.42, 4, wpX + 3.2, wpY + 4.65, wpZ + dz);
  }

  // 1927–1932: Dragon Bridge gilded bollards, West dedication monolith & East riverside viewing landing
  for (const ax of [352.0, 438.0]) {
    addCyl(w6DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -28.0);
    addCyl(w6DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -20.0);
  }
  addBox(w6DbMarble, 1.15, 2.1, 0.52, 344.0, 2.85, -26.0);
  addBox(w6DbMarble, 6.2, 0.58, 4.6, 446.0, 2.08, -4.0);

  // 1933–1938: Chợ Đêm Sơn Trà 3 new shaded night-market stalls, east lantern arch & dining tables
  for (const [kx, kz] of [[454.0, -35.0], [460.0, -42.5], [460.0, -35.0]] as const) {
    addBox(w6DbWood, 2.4, 0.80, 2.8, kx, 2.32, kz);
    addBox(w6DbCrimson, 2.8, 0.18, 3.2, kx, 4.30, kz);
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.25, 1.25]) {
        addCyl(w6DbWood, 0.05, 0.06, 2.52, 4, kx + ox, 3.12, kz + oz);
      }
    }
  }
  addCyl(w6DbCrimson, 0.11, 0.13, 4.1, 4, 458.2, 3.55, -46.5);
  addCyl(w6DbCrimson, 0.11, 0.13, 4.1, 4, 461.8, 3.55, -46.5);
  addBox(w6DbGold, 4.2, 0.38, 0.32, 460.0, 5.62, -46.5);
  addBox(w6DbWood, 1.65, 0.72, 0.95, 460.0, 2.25, -29.5);

  // 1939–1945: APEC 2 extra sculptures, reflecting curb, 4th Han River cruise vessel & gangplank
  for (const sx of [-6.0, 6.0]) {
    addBox(w6DbMarble, 1.35, 0.68, 1.35, apX + sx, apY + 0.42, apZ - 10.5);
    addCone(w6DbGold, 0.50, 1.38, 4, apX + sx, apY + 1.45, apZ - 10.5);
  }
  addBox(w6DbMarble, 8.6, 0.38, 0.45, apX, apY + 0.25, apZ - 8.2);
  addBox(w6DbWood, 11.4, 1.20, 3.4, 422.0, 0.62, -4.0);
  addBox(w6DbMarble, 8.2, 1.40, 2.6, 422.0, 1.92, -4.0);
  addBox(w6DbGold, 8.0, 0.18, 2.4, 422.0, 2.75, -4.0);
  addBox(w6DbWood, 4.6, 0.20, 1.45, 434.0, 1.35, -4.0);

  const w6DbMarbleM = new THREE.Mesh(mergeNormalized(w6DbMarble), whiteMarbleMat);
  w6DbMarbleM.castShadow = false;
  const w6DbGoldM = new THREE.Mesh(mergeNormalized(w6DbGold), ctx.materials.gold);
  w6DbGoldM.castShadow = false;
  const w6DbCrimM = new THREE.Mesh(mergeNormalized(w6DbCrimson), ctx.materials.crimsonLacquer);
  w6DbCrimM.castShadow = false;
  const w6DbWoodM = new THREE.Mesh(mergeNormalized(w6DbWood), parkWoodMat);
  w6DbWoodM.castShadow = false;
  group.add(w6DbMarbleM, w6DbGoldM, w6DbCrimM, w6DbWoodM);

  // Wave 7 Upgrades (Items 2321–2345): East Han River Waterfront Park Plaza, Dragon Bridge Plazas,
  // Sơn Trà Night-Market Stalls, APEC Sculptures & 5th Han River Sightseeing Riverboat
  const w7DbMarble: THREE.BufferGeometry[] = [];
  const w7DbGold: THREE.BufferGeometry[] = [];
  const w7DbCrimson: THREE.BufferGeometry[] = [];
  const w7DbWood: THREE.BufferGeometry[] = [];

  // 2321–2326: Công Viên Bờ Đông Sông Hàn (East Han River Park Plaza at 446.0, -18.0)
  const epDX = 446.0;
  const epDZ = -18.0;
  const epDY = Math.max(ctx.getHeight(epDX, epDZ), ctx.getHeight(epDX - 3.5, epDZ - 4.0), ctx.getHeight(epDX + 3.5, epDZ + 4.0));
  addBox(w7DbMarble, 7.6, 5.6, 8.4, epDX, epDY - 2.65, epDZ);
  addBox(w7DbWood, 4.2, 0.18, 3.6, epDX + 0.8, epDY + 3.05, epDZ);
  for (const ox of [-1.0, 2.6]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w7DbWood, 0.08, 0.10, 3.05, 4, epDX + ox, epDY + 1.52, epDZ + oz);
    }
  }
  addBox(w7DbWood, 0.56, 0.46, 2.0, epDX + 0.8, epDY + 0.38, epDZ - 0.9);
  addBox(w7DbWood, 0.56, 0.46, 2.0, epDX + 0.8, epDY + 0.38, epDZ + 0.9);
  addBox(w7DbMarble, 1.35, 0.72, 1.35, epDX - 2.2, epDY + 0.48, epDZ);
  addCone(w7DbGold, 0.52, 1.65, 4, epDX - 2.2, epDY + 1.65, epDZ);
  for (const dz of [-3.6, 3.6]) {
    addCyl(w7DbGold, 0.08, 0.11, 4.4, 4, epDX - 3.2, epDY + 2.25, epDZ + dz);
    addCone(w7DbGold, 0.32, 0.42, 4, epDX - 3.2, epDY + 4.65, epDZ + dz);
  }

  // 2327–2332: Dragon Bridge approach bollards, East dedication stele & West riverfront viewing deck
  for (const ax of [352.0, 438.0]) {
    addCyl(w7DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -34.0);
    addCyl(w7DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -14.0);
  }
  addBox(w7DbMarble, 1.15, 2.1, 0.52, 444.0, 2.85, -26.0);
  addBox(w7DbMarble, 6.2, 0.58, 4.6, 342.0, 2.08, -16.0);

  // 2333–2338: Chợ Đêm Sơn Trà 3 new shaded stalls, south lantern arch & dining table
  for (const [kx, kz] of [[454.0, -27.5], [460.0, -27.5], [466.0, -35.0]] as const) {
    addBox(w7DbWood, 2.4, 0.80, 2.8, kx, 2.32, kz);
    addBox(w7DbCrimson, 2.8, 0.18, 3.2, kx, 4.30, kz);
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.25, 1.25]) {
        addCyl(w7DbWood, 0.05, 0.06, 2.52, 4, kx + ox, 3.12, kz + oz);
      }
    }
  }
  addCyl(w7DbCrimson, 0.11, 0.13, 4.1, 4, 458.2, 3.55, -23.5);
  addCyl(w7DbCrimson, 0.11, 0.13, 4.1, 4, 461.8, 3.55, -23.5);
  addBox(w7DbGold, 4.2, 0.38, 0.32, 460.0, 5.62, -23.5);
  addBox(w7DbWood, 1.65, 0.72, 0.95, 466.0, 2.25, -29.5);

  // 2339–2345: APEC 2 extra sculptures, waterfront photo arch, 5th Han River cruise vessel & gangplank
  for (const sx of [-9.5, 9.5]) {
    addBox(w7DbMarble, 1.35, 0.68, 1.35, apX + sx, apY + 0.42, apZ - 10.5);
    addCone(w7DbGold, 0.50, 1.38, 4, apX + sx, apY + 1.45, apZ - 10.5);
  }
  addBox(w7DbMarble, 0.35, 3.2, 0.35, apX - 2.2, apY + 1.65, apZ - 13.5);
  addBox(w7DbMarble, 0.35, 3.2, 0.35, apX + 2.2, apY + 1.65, apZ - 13.5);
  addBox(w7DbGold, 4.8, 0.34, 0.34, apX, apY + 3.25, apZ - 13.5);
  addBox(w7DbWood, 11.4, 1.20, 3.4, 422.0, 0.62, -16.0);
  addBox(w7DbMarble, 8.2, 1.40, 2.6, 422.0, 1.92, -16.0);
  addBox(w7DbGold, 8.0, 0.18, 2.4, 422.0, 2.75, -16.0);
  addBox(w7DbWood, 4.6, 0.20, 1.45, 434.0, 1.35, -16.0);

  const w7DbMarbleM = new THREE.Mesh(mergeNormalized(w7DbMarble), whiteMarbleMat);
  w7DbMarbleM.castShadow = false;
  const w7DbGoldM = new THREE.Mesh(mergeNormalized(w7DbGold), ctx.materials.gold);
  w7DbGoldM.castShadow = false;
  const w7DbCrimM = new THREE.Mesh(mergeNormalized(w7DbCrimson), ctx.materials.crimsonLacquer);
  w7DbCrimM.castShadow = false;
  const w7DbWoodM = new THREE.Mesh(mergeNormalized(w7DbWood), parkWoodMat);
  w7DbWoodM.castShadow = false;
  group.add(w7DbMarbleM, w7DbGoldM, w7DbCrimM, w7DbWoodM);

  // Wave 8 Upgrades (Items 2721–2745): West Han River Bạch Đằng Plaza, Dragon Bridge Outer Bollards,
  // Sơn Trà Night-Market North Stalls, APEC Sculptures & 6th Han River Excursion Cruise Vessel
  const w8DbMarble: THREE.BufferGeometry[] = [];
  const w8DbGold: THREE.BufferGeometry[] = [];
  const w8DbCrimson: THREE.BufferGeometry[] = [];
  const w8DbWood: THREE.BufferGeometry[] = [];

  // 2721–2726: Quảng Trường Bạch Đằng Bờ Tây Sông Hàn (West Han River Park Plaza at 338.0, -34.0)
  const wp8X = 338.0;
  const wp8Z = -34.0;
  const wp8Y = Math.max(ctx.getHeight(wp8X, wp8Z), ctx.getHeight(wp8X - 3.5, wp8Z - 4.0), ctx.getHeight(wp8X + 3.5, wp8Z + 4.0));
  addBox(w8DbMarble, 7.6, 5.6, 8.4, wp8X, wp8Y - 2.65, wp8Z);
  addBox(w8DbWood, 4.2, 0.18, 3.6, wp8X - 0.8, wp8Y + 3.05, wp8Z);
  for (const ox of [-2.6, 1.0]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w8DbWood, 0.08, 0.10, 3.05, 4, wp8X + ox, wp8Y + 1.52, wp8Z + oz);
    }
  }
  addBox(w8DbWood, 0.56, 0.46, 2.0, wp8X - 0.8, wp8Y + 0.38, wp8Z - 0.9);
  addBox(w8DbWood, 0.56, 0.46, 2.0, wp8X - 0.8, wp8Y + 0.38, wp8Z + 0.9);
  addBox(w8DbMarble, 1.35, 0.72, 1.35, wp8X + 2.2, wp8Y + 0.48, wp8Z);
  addCone(w8DbGold, 0.52, 1.65, 4, wp8X + 2.2, wp8Y + 1.65, wp8Z);
  for (const dz of [-3.6, 3.6]) {
    addCyl(w8DbGold, 0.08, 0.11, 4.4, 4, wp8X + 3.2, wp8Y + 2.25, wp8Z + dz);
    addCone(w8DbGold, 0.32, 0.42, 4, wp8X + 3.2, wp8Y + 4.65, wp8Z + dz);
  }

  // 2727–2732: Dragon Bridge outer-approach bollards, West dedication stele & East riverfront viewing deck
  for (const ax of [344.0, 446.0]) {
    addCyl(w8DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -34.0);
    addCyl(w8DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -14.0);
  }
  addBox(w8DbMarble, 1.15, 2.1, 0.52, 344.0, 2.85, -26.0);
  addBox(w8DbMarble, 6.2, 0.58, 4.6, 446.0, 2.08, -34.0);

  // 2733–2738: Chợ Đêm Sơn Trà 3 north shaded stalls, north lantern arch & dining table
  for (const [kx, kz] of [[454.0, -42.5], [460.0, -42.5], [466.0, -42.5]] as const) {
    addBox(w8DbWood, 2.4, 0.80, 2.8, kx, 2.32, kz);
    addBox(w8DbCrimson, 2.8, 0.18, 3.2, kx, 4.30, kz);
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.25, 1.25]) {
        addCyl(w8DbWood, 0.05, 0.06, 2.52, 4, kx + ox, 3.12, kz + oz);
      }
    }
  }
  addCyl(w8DbCrimson, 0.11, 0.13, 4.1, 4, 458.2, 3.55, -46.5);
  addCyl(w8DbCrimson, 0.11, 0.13, 4.1, 4, 461.8, 3.55, -46.5);
  addBox(w8DbGold, 4.2, 0.38, 0.32, 460.0, 5.62, -46.5);
  addBox(w8DbWood, 1.65, 0.72, 0.95, 466.0, 2.25, -46.5);

  // 2739–2745: APEC 2 extra sculptures, east photo arch, 6th Han River cruise vessel & gangplank
  for (const sx of [-9.5, 9.5]) {
    addBox(w8DbMarble, 1.35, 0.68, 1.35, apX + sx, apY + 0.42, apZ + 10.5);
    addCone(w8DbGold, 0.50, 1.38, 4, apX + sx, apY + 1.45, apZ + 10.5);
  }
  addBox(w8DbMarble, 0.35, 3.2, 0.35, apX + 13.5, apY + 1.65, apZ - 2.2);
  addBox(w8DbMarble, 0.35, 3.2, 0.35, apX + 13.5, apY + 1.65, apZ + 2.2);
  addBox(w8DbGold, 0.34, 0.34, 4.8, apX + 13.5, apY + 3.25, apZ);
  addBox(w8DbWood, 11.4, 1.20, 3.4, 408.0, 0.62, -16.0);
  addBox(w8DbMarble, 8.2, 1.40, 2.6, 408.0, 1.92, -16.0);
  addBox(w8DbGold, 8.0, 0.18, 2.4, 408.0, 2.75, -16.0);
  addBox(w8DbWood, 4.6, 0.20, 1.45, 396.0, 1.35, -16.0);

  const w8DbMarbleM = new THREE.Mesh(mergeNormalized(w8DbMarble), whiteMarbleMat);
  w8DbMarbleM.castShadow = false;
  const w8DbGoldM = new THREE.Mesh(mergeNormalized(w8DbGold), ctx.materials.gold);
  w8DbGoldM.castShadow = false;
  const w8DbCrimM = new THREE.Mesh(mergeNormalized(w8DbCrimson), ctx.materials.crimsonLacquer);
  w8DbCrimM.castShadow = false;
  const w8DbWoodM = new THREE.Mesh(mergeNormalized(w8DbWood), parkWoodMat);
  w8DbWoodM.castShadow = false;
  group.add(w8DbMarbleM, w8DbGoldM, w8DbCrimM, w8DbWoodM);

  // Wave 9 Upgrades (Items 3121–3145): East Han River Trần Hưng Đạo Plaza, Dragon Bridge Outer-South Bollards,
  // Sơn Trà Night-Market Far-North Stalls, APEC North Sculptures & 7th Han River Excursion Cruise Vessel
  const w9DbMarble: THREE.BufferGeometry[] = [];
  const w9DbGold: THREE.BufferGeometry[] = [];
  const w9DbCrimson: THREE.BufferGeometry[] = [];
  const w9DbWood: THREE.BufferGeometry[] = [];

  // 3121–3126: Quảng Trường Trần Hưng Đạo Bờ Đông Sông Hàn (East Han River Park Plaza at 452.0, -12.0)
  const ep9X = 452.0;
  const ep9Z = -12.0;
  const ep9Y = Math.max(ctx.getHeight(ep9X, ep9Z), ctx.getHeight(ep9X - 3.5, ep9Z - 4.0), ctx.getHeight(ep9X + 3.5, ep9Z + 4.0));
  addBox(w9DbMarble, 7.6, 5.6, 8.4, ep9X, ep9Y - 2.65, ep9Z);
  addBox(w9DbWood, 4.2, 0.18, 3.6, ep9X + 0.8, ep9Y + 3.05, ep9Z);
  for (const ox of [-1.0, 2.6]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w9DbWood, 0.08, 0.10, 3.05, 4, ep9X + ox, ep9Y + 1.52, ep9Z + oz);
    }
  }
  addBox(w9DbWood, 0.56, 0.46, 2.0, ep9X + 0.8, ep9Y + 0.38, ep9Z - 0.9);
  addBox(w9DbWood, 0.56, 0.46, 2.0, ep9X + 0.8, ep9Y + 0.38, ep9Z + 0.9);
  addBox(w9DbMarble, 1.35, 0.72, 1.35, ep9X - 2.2, ep9Y + 0.48, ep9Z);
  addCone(w9DbGold, 0.52, 1.65, 4, ep9X - 2.2, ep9Y + 1.65, ep9Z);
  for (const dz of [-3.6, 3.6]) {
    addCyl(w9DbGold, 0.08, 0.11, 4.4, 4, ep9X - 3.2, ep9Y + 2.25, ep9Z + dz);
    addCone(w9DbGold, 0.32, 0.42, 4, ep9X - 3.2, ep9Y + 4.65, ep9Z + dz);
  }

  // 3127–3132: Dragon Bridge outer-south bollards, East dedication stele & West riverfront viewing deck
  for (const ax of [344.0, 446.0]) {
    addCyl(w9DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -42.0);
    addCyl(w9DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -6.0);
  }
  addBox(w9DbMarble, 1.15, 2.1, 0.52, 446.0, 2.85, -26.0);
  addBox(w9DbMarble, 6.2, 0.58, 4.6, 344.0, 2.08, -14.0);

  // 3133–3138: Chợ Đêm Sơn Trà 3 far-north shaded stalls, north lantern arch & dining table
  for (const [kx, kz] of [[454.0, -50.5], [460.0, -50.5], [466.0, -50.5]] as const) {
    addBox(w9DbWood, 2.4, 0.80, 2.8, kx, 2.32, kz);
    addBox(w9DbCrimson, 2.8, 0.18, 3.2, kx, 4.30, kz);
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.25, 1.25]) {
        addCyl(w9DbWood, 0.05, 0.06, 2.52, 4, kx + ox, 3.12, kz + oz);
      }
    }
  }
  addCyl(w9DbCrimson, 0.11, 0.13, 4.1, 4, 458.2, 3.55, -54.5);
  addCyl(w9DbCrimson, 0.11, 0.13, 4.1, 4, 461.8, 3.55, -54.5);
  addBox(w9DbGold, 4.2, 0.38, 0.32, 460.0, 5.62, -54.5);
  addBox(w9DbWood, 1.65, 0.72, 0.95, 466.0, 2.25, -54.5);

  // 3139–3145: APEC 2 north sculptures, west photo arch, 7th Han River cruise vessel & gangplank
  for (const sx of [-9.5, 9.5]) {
    addBox(w9DbMarble, 1.35, 0.68, 1.35, apX + sx, apY + 0.42, apZ - 10.5);
    addCone(w9DbGold, 0.50, 1.38, 4, apX + sx, apY + 1.45, apZ - 10.5);
  }
  addBox(w9DbMarble, 0.35, 3.2, 0.35, apX - 13.5, apY + 1.65, apZ - 2.2);
  addBox(w9DbMarble, 0.35, 3.2, 0.35, apX - 13.5, apY + 1.65, apZ + 2.2);
  addBox(w9DbGold, 0.34, 0.34, 4.8, apX - 13.5, apY + 3.25, apZ);
  addBox(w9DbWood, 11.4, 1.20, 3.4, 386.0, 0.62, -34.0);
  addBox(w9DbMarble, 8.2, 1.40, 2.6, 386.0, 1.92, -34.0);
  addBox(w9DbGold, 8.0, 0.18, 2.4, 386.0, 2.75, -34.0);
  addBox(w9DbWood, 4.6, 0.20, 1.45, 374.0, 1.35, -34.0);

  const w9DbMarbleM = new THREE.Mesh(mergeNormalized(w9DbMarble), whiteMarbleMat);
  w9DbMarbleM.castShadow = false;
  const w9DbGoldM = new THREE.Mesh(mergeNormalized(w9DbGold), ctx.materials.gold);
  w9DbGoldM.castShadow = false;
  const w9DbCrimM = new THREE.Mesh(mergeNormalized(w9DbCrimson), ctx.materials.crimsonLacquer);
  w9DbCrimM.castShadow = false;
  const w9DbWoodM = new THREE.Mesh(mergeNormalized(w9DbWood), parkWoodMat);
  w9DbWoodM.castShadow = false;
  group.add(w9DbMarbleM, w9DbGoldM, w9DbCrimM, w9DbWoodM);

  // Wave 10 Upgrades (Items 3521–3545): West Han River Bạch Đằng Park Plaza, Dragon Bridge Outer-North Bollards,
  // Sơn Trà Night-Market South Stalls, APEC South Sculptures & 8th Han River Excursion Cruise Vessel
  const w10DbMarble: THREE.BufferGeometry[] = [];
  const w10DbGold: THREE.BufferGeometry[] = [];
  const w10DbCrimson: THREE.BufferGeometry[] = [];
  const w10DbWood: THREE.BufferGeometry[] = [];

  // 3521–3526: Công Viên Bạch Đằng Bờ Tây Sông Hàn (West Han River Park Plaza at 218.0, -10.0)
  const wp10X = 218.0;
  const wp10Z = -10.0;
  const wp10Y = Math.max(ctx.getHeight(wp10X, wp10Z), ctx.getHeight(wp10X - 3.5, wp10Z - 4.0), ctx.getHeight(wp10X + 3.5, wp10Z + 4.0));
  addBox(w10DbMarble, 7.6, 5.6, 8.4, wp10X, wp10Y - 2.65, wp10Z);
  addBox(w10DbWood, 4.2, 0.18, 3.6, wp10X - 0.8, wp10Y + 3.05, wp10Z);
  for (const ox of [-2.6, 1.0]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w10DbWood, 0.08, 0.10, 3.05, 4, wp10X + ox, wp10Y + 1.52, wp10Z + oz);
    }
  }
  addBox(w10DbWood, 0.56, 0.46, 2.0, wp10X - 0.8, wp10Y + 0.38, wp10Z - 0.9);
  addBox(w10DbWood, 0.56, 0.46, 2.0, wp10X - 0.8, wp10Y + 0.38, wp10Z + 0.9);
  addBox(w10DbMarble, 1.35, 0.72, 1.35, wp10X + 2.2, wp10Y + 0.48, wp10Z);
  addCone(w10DbGold, 0.52, 1.65, 4, wp10X + 2.2, wp10Y + 1.65, wp10Z);
  for (const dz of [-3.6, 3.6]) {
    addCyl(w10DbGold, 0.08, 0.11, 4.4, 4, wp10X + 3.2, wp10Y + 2.25, wp10Z + dz);
    addCone(w10DbGold, 0.32, 0.42, 4, wp10X + 3.2, wp10Y + 4.65, wp10Z + dz);
  }

  // 3527–3532: Dragon Bridge outer-north bollards, West dedication stele & East riverfront viewing deck
  for (const ax of [224.0, 344.0]) {
    addCyl(w10DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -28.0);
    addCyl(w10DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, -42.0);
  }
  addBox(w10DbMarble, 1.15, 2.1, 0.52, 224.0, 2.85, -26.0);
  addBox(w10DbMarble, 6.2, 0.58, 4.6, 446.0, 2.08, -14.0);

  // 3533–3538: Chợ Đêm Sơn Trà 3 south-extension shaded stalls, south lantern arch & dining table
  for (const [kx, kz] of [[454.0, -64.5], [460.0, -64.5], [466.0, -64.5]] as const) {
    addBox(w10DbWood, 2.4, 0.80, 2.8, kx, 2.32, kz);
    addBox(w10DbCrimson, 2.8, 0.18, 3.2, kx, 4.30, kz);
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.25, 1.25]) {
        addCyl(w10DbWood, 0.05, 0.06, 2.52, 4, kx + ox, 3.12, kz + oz);
      }
    }
  }
  addCyl(w10DbCrimson, 0.11, 0.13, 4.1, 4, 458.2, 3.55, -68.5);
  addCyl(w10DbCrimson, 0.11, 0.13, 4.1, 4, 461.8, 3.55, -68.5);
  addBox(w10DbGold, 4.2, 0.38, 0.32, 460.0, 5.62, -68.5);
  addBox(w10DbWood, 1.65, 0.72, 0.95, 466.0, 2.25, -68.5);

  // 3539–3545: APEC 2 south sculptures, east photo arch, 8th Han River cruise vessel & gangplank
  for (const sx of [-9.5, 9.5]) {
    addBox(w10DbMarble, 1.35, 0.68, 1.35, apX + sx, apY + 0.42, apZ + 11.5);
    addCone(w10DbGold, 0.50, 1.38, 4, apX + sx, apY + 1.45, apZ + 11.5);
  }
  addBox(w10DbMarble, 0.35, 3.2, 0.35, apX + 13.5, apY + 1.65, apZ - 2.2);
  addBox(w10DbMarble, 0.35, 3.2, 0.35, apX + 13.5, apY + 1.65, apZ + 2.2);
  addBox(w10DbGold, 0.34, 0.34, 4.8, apX + 13.5, apY + 3.25, apZ);
  addBox(w10DbWood, 11.4, 1.20, 3.4, 318.0, 0.62, -34.0);
  addBox(w10DbMarble, 8.2, 1.40, 2.6, 318.0, 1.92, -34.0);
  addBox(w10DbGold, 8.0, 0.18, 2.4, 318.0, 2.75, -34.0);
  addBox(w10DbWood, 4.6, 0.20, 1.45, 306.0, 1.35, -34.0);

  const w10DbMarbleM = new THREE.Mesh(mergeNormalized(w10DbMarble), whiteMarbleMat);
  w10DbMarbleM.castShadow = false;
  const w10DbGoldM = new THREE.Mesh(mergeNormalized(w10DbGold), ctx.materials.gold);
  w10DbGoldM.castShadow = false;
  const w10DbCrimM = new THREE.Mesh(mergeNormalized(w10DbCrimson), ctx.materials.crimsonLacquer);
  w10DbCrimM.castShadow = false;
  const w10DbWoodM = new THREE.Mesh(mergeNormalized(w10DbWood), parkWoodMat);
  w10DbWoodM.castShadow = false;
  group.add(w10DbMarbleM, w10DbGoldM, w10DbCrimM, w10DbWoodM);

  // Wave 11 Upgrades (Items 3921–3945): South Han River Bạch Đằng Lantern Plaza, Dragon Bridge Outer-South Bollards,
  // Sơn Trà Night-Market North Stalls, APEC North Sculptures & 9th Han River Excursion Cruise Vessel
  const w11DbMarble: THREE.BufferGeometry[] = [];
  const w11DbGold: THREE.BufferGeometry[] = [];
  const w11DbCrimson: THREE.BufferGeometry[] = [];
  const w11DbWood: THREE.BufferGeometry[] = [];

  // 3921–3926: Công Viên Bạch Đằng Nam — Quảng Trường Đèn Lồng Sông Hàn (South Han River Lantern Plaza at 218.0, 12.0)
  const sp11X = 218.0;
  const sp11Z = 12.0;
  const sp11Y = Math.max(ctx.getHeight(sp11X, sp11Z), ctx.getHeight(sp11X - 3.5, sp11Z - 4.0), ctx.getHeight(sp11X + 3.5, sp11Z + 4.0));
  addBox(w11DbMarble, 7.6, 5.6, 8.4, sp11X, sp11Y - 2.65, sp11Z);
  addBox(w11DbWood, 4.2, 0.18, 3.6, sp11X - 0.8, sp11Y + 3.05, sp11Z);
  for (const ox of [-2.6, 1.0]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w11DbWood, 0.08, 0.10, 3.05, 4, sp11X + ox, sp11Y + 1.52, sp11Z + oz);
    }
  }
  addBox(w11DbWood, 0.56, 0.46, 2.0, sp11X - 0.8, sp11Y + 0.38, sp11Z - 0.9);
  addBox(w11DbWood, 0.56, 0.46, 2.0, sp11X - 0.8, sp11Y + 0.38, sp11Z + 0.9);
  addBox(w11DbMarble, 1.35, 0.72, 1.35, sp11X + 2.2, sp11Y + 0.48, sp11Z);
  addCone(w11DbGold, 0.52, 1.65, 4, sp11X + 2.2, sp11Y + 1.65, sp11Z);
  for (const dz of [-3.6, 3.6]) {
    addCyl(w11DbGold, 0.08, 0.11, 4.4, 4, sp11X + 3.2, sp11Y + 2.25, sp11Z + dz);
    addCone(w11DbGold, 0.32, 0.42, 4, sp11X + 3.2, sp11Y + 4.65, sp11Z + dz);
  }

  // 3927–3932: Dragon Bridge outer-south bollards, East dedication stele & West riverfront viewing deck
  for (const ax of [224.0, 344.0]) {
    addCyl(w11DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, 28.0);
    addCyl(w11DbGold, 0.14, 0.18, 0.95, 4, ax, 2.35, 42.0);
  }
  addBox(w11DbMarble, 1.15, 2.1, 0.52, 446.0, 2.85, -26.0);
  addBox(w11DbMarble, 6.2, 0.58, 4.6, 224.0, 2.08, 22.0);

  // 3933–3938: Chợ Đêm Sơn Trà 3 north-extension shaded stalls, north lantern arch & dining table
  for (const [kx, kz] of [[454.0, -42.5], [460.0, -42.5], [466.0, -42.5]] as const) {
    addBox(w11DbWood, 2.4, 0.80, 2.8, kx, 2.32, kz);
    addBox(w11DbCrimson, 2.8, 0.18, 3.2, kx, 4.30, kz);
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.25, 1.25]) {
        addCyl(w11DbWood, 0.05, 0.06, 2.52, 4, kx + ox, 3.12, kz + oz);
      }
    }
  }
  addCyl(w11DbCrimson, 0.11, 0.13, 4.1, 4, 458.2, 3.55, -38.5);
  addCyl(w11DbCrimson, 0.11, 0.13, 4.1, 4, 461.8, 3.55, -38.5);
  addBox(w11DbGold, 4.2, 0.38, 0.32, 460.0, 5.62, -38.5);
  addBox(w11DbWood, 1.65, 0.72, 0.95, 466.0, 2.25, -38.5);

  // 3939–3945: APEC 2 north sculptures, west photo arch, 9th Han River cruise vessel & gangplank
  for (const sx of [-9.5, 9.5]) {
    addBox(w11DbMarble, 1.35, 0.68, 1.35, apX + sx, apY + 0.42, apZ - 11.5);
    addCone(w11DbGold, 0.50, 1.38, 4, apX + sx, apY + 1.45, apZ - 11.5);
  }
  addBox(w11DbMarble, 0.35, 3.2, 0.35, apX - 13.5, apY + 1.65, apZ - 2.2);
  addBox(w11DbMarble, 0.35, 3.2, 0.35, apX - 13.5, apY + 1.65, apZ + 2.2);
  addBox(w11DbGold, 0.34, 0.34, 4.8, apX - 13.5, apY + 3.25, apZ);
  addBox(w11DbWood, 11.4, 1.20, 3.4, 318.0, 0.62, 26.0);
  addBox(w11DbMarble, 8.2, 1.40, 2.6, 318.0, 1.92, 26.0);
  addBox(w11DbGold, 8.0, 0.18, 2.4, 318.0, 2.75, 26.0);
  addBox(w11DbWood, 4.6, 0.20, 1.45, 306.0, 1.35, 26.0);

  const w11DbMarbleM = new THREE.Mesh(mergeNormalized(w11DbMarble), whiteMarbleMat);
  w11DbMarbleM.castShadow = false;
  const w11DbGoldM = new THREE.Mesh(mergeNormalized(w11DbGold), ctx.materials.gold);
  w11DbGoldM.castShadow = false;
  const w11DbCrimM = new THREE.Mesh(mergeNormalized(w11DbCrimson), ctx.materials.crimsonLacquer);
  w11DbCrimM.castShadow = false;
  const w11DbWoodM = new THREE.Mesh(mergeNormalized(w11DbWood), parkWoodMat);
  w11DbWoodM.castShadow = false;
  group.add(w11DbMarbleM, w11DbGoldM, w11DbCrimM, w11DbWoodM);

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

  const cx = 395;
  const cz = -185;
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
    roughness: 0.12,
    metalness: 0.25
  });
  ctx.extraMaterials.push(cavePoolMat);
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
  const sunlitMossMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#4b8532', roughness: 0.86, metalness: 0.02 }) ??
    ctx.materials.granite;
  const calciteMat = ctx.materials.ochreSand ?? ctx.materials.stone;
  const pearlMat = ctx.materials.whitePlaster;
  ctx.extraMaterials.push(darkCaveRockMat);

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
  // + Items 169–175, 184: Vườn Địa Đàng extra jungle palms, Bức Tường Việt Nam stepped flowstone cliff wall & ladder,
  //   Hồ Nước Ngầm wet sandbar, Ngọc Động cave pearl nests, Thạch Nhũ drapery curtains & Doline mist pool!
  const riverGeo = new THREE.PlaneGeometry(5.5, 52.0);
  riverGeo.rotateX(-Math.PI * 0.5);
  riverGeo.rotateY(0.28);
  riverGeo.translate(cx + 21.0, floorY + 0.14, cz);
  const kitchenCanopy = new THREE.BoxGeometry(4.4, 0.12, 3.8);
  kitchenCanopy.translate(kCanX, kCanY, kCanZ);
  const riverStrip = new THREE.Mesh(riverGeo, cavePoolMat);
  const kitchenMesh = new THREE.Mesh(kitchenCanopy, ctx.materials.darkRoof);
  group.add(riverStrip, kitchenMesh);

  // Bức Tường Việt Nam (Great Wall of Vietnam) stepped flowstone cliff wall at far end of Sơn Đoòng (cz - 36)
  const greatWallParts: THREE.BufferGeometry[] = [];
  for (let tier = 0; tier < 4; tier++) {
    greatWallParts.push(
      new THREE.BoxGeometry(24.0 - tier * 2.5, 4.2, 6.0 - tier * 0.8).translate(cx, floorY + 2.1 + tier * 3.8, cz - 34.0 - tier * 1.4)
    );
  }
  // Fluted Thạch Nhũ drapery curtains along cavern walls & oversized Ngọc Động cave pearls
  for (const dx of [-34.0, 34.0]) {
    greatWallParts.push(new THREE.CylinderGeometry(1.1, 1.6, 16.0, 7).translate(cx + dx, floorY + 14.0, cz - 10.0));
  }
  const gwMesh = new THREE.Mesh(mergeNormalized(greatWallParts), calciteMat);
  gwMesh.castShadow = false;
  gwMesh.receiveShadow = true;
  group.add(gwMesh);

  // Vườn Địa Đàng extra subterranean fern/palm clusters inside Doline 1
  const sdExtraFoliage: THREE.BufferGeometry[] = [];
  for (const [fx, fz] of [[cx - 6.0, cz + 4.0], [cx + 5.0, cz - 3.0], [cx - 3.0, cz - 7.0]]) {
    sdExtraFoliage.push(new THREE.ConeGeometry(2.6, 2.2, 6).translate(fx, floorY + 1.1, fz));
  }
  const sdFoliageMesh = new THREE.Mesh(mergeNormalized(sdExtraFoliage), foliageCanopyMat);
  sdFoliageMesh.castShadow = false;
  group.add(sdFoliageMesh);

  if (innerLanternParts.length > 0) {
    const tentLampMesh = new THREE.Mesh(
      mergeNormalized(innerLanternParts),
      ctx.materials.lanternCore ?? ctx.materials.gold
    );
    group.add(tentLampMesh);
  }

  // Wave 2 Upgrades (Items 371–375): Sơn Đoòng Campsite 1 extra expedition dome tents,
  // mess-table & lanterns under kitchen canopy, Bức Tường Việt Nam rope climbing ladder,
  // safety traverse rope stakes & dry-bag gear packs
  const w2SdWood: THREE.BufferGeometry[] = [];
  const w2SdGold: THREE.BufferGeometry[] = [];
  const w2SdCrimson: THREE.BufferGeometry[] = [];
  // 371 & 375: 3 extra expedition tents + dry-bag packs on sandy terrace
  for (const [tx, tz] of [[cx - 11.0, cz + 16.5], [cx - 3.5, cz + 19.0], [cx + 6.5, cz + 17.5]] as const) {
    const ty = ctx.getHeight(tx, tz);
    addCone(w2SdCrimson, 1.35, 1.25, 5, tx, ty + 0.62, tz);
    addBox(w2SdWood, 0.55, 0.35, 0.42, tx + 1.55, ty + 0.18, tz);
  }
  // 372: Folding mess-table with grounded legs, stools & glowing solar lantern under kitchen canopy
  addBox(w2SdWood, 2.4, 0.10, 0.95, kCanX, floorY + 0.78, kCanZ);
  for (const lx of [-1.05, 1.05]) {
    for (const lz of [-0.38, 0.38]) {
      addCyl(w2SdWood, 0.035, 0.04, 0.55, 5, kCanX + lx, floorY + 0.50, kCanZ + lz);
    }
  }
  addBox(w2SdWood, 2.2, 0.42, 0.32, kCanX, floorY + 0.22, kCanZ + 0.85);
  addCyl(w2SdGold, 0.14, 0.14, 0.28, 5, kCanX, kCanY - 0.35, kCanZ);
  // 373: Bức Tường Việt Nam stainless-steel & braided-rope climbing ladder ascending flowstone cliff
  for (const lx of [-0.36, 0.36]) {
    addCyl(w2SdGold, 0.03, 0.03, 14.5, 5, cx + lx, floorY + 7.5, cz - 30.8, -0.22);
  }
  for (let rg = 0; rg < 10; rg++) {
    addBox(w2SdGold, 0.78, 0.05, 0.05, cx, floorY + 1.2 + rg * 1.35, cz - 29.4 - rg * 0.28);
  }
  // 374: Safety traverse rope-line & anchor stakes along rimstone gour-pool edge
  for (let st = 0; st < 4; st++) {
    addCyl(w2SdGold, 0.04, 0.05, 1.05, 5, cx + 10.5 + st * 2.8, floorY + 0.52, cz - 4.0 + st * 2.2);
  }
  const w2SdWoodM = new THREE.Mesh(mergeNormalized(w2SdWood), ctx.materials.darkWood);
  w2SdWoodM.castShadow = false;
  const w2SdGoldM = new THREE.Mesh(mergeNormalized(w2SdGold), ctx.materials.gold);
  w2SdGoldM.castShadow = false;
  const w2SdCrimM = new THREE.Mesh(mergeNormalized(w2SdCrimson), ctx.materials.crimsonLacquer);
  w2SdCrimM.castShadow = false;
  group.add(w2SdWoodM, w2SdGoldM, w2SdCrimM);

  // Wave 3 Upgrades (Items 741–750): "Watch Out for Dinosaurs" Doline 1 breakdown terrace & prehistoric ferns,
  // dry travertine cave-pearl nests, subterranean river-crossing stepping boulders & rope stakes, camp gear & organ-pipe columns
  const w3SdRock: THREE.BufferGeometry[] = [];
  const w3SdLeaf: THREE.BufferGeometry[] = [];
  const w3SdGold: THREE.BufferGeometry[] = [];
  const w3SdWood: THREE.BufferGeometry[] = [];

  // 741–743: "Watch Out for Dinosaurs" Doline 1 breakdown-boulder terrace, giant prehistoric ferns & overhang stalactites
  addBox(w3SdRock, 8.6, 1.45, 7.2, cx - 10.0, floorY + 0.65, cz - 4.0);
  addBox(w3SdRock, 5.4, 1.15, 4.8, cx - 10.8, floorY + 1.85, cz - 4.4);
  for (const [fx, fz] of [[cx - 12.2, cz - 6.0], [cx - 8.2, cz - 2.2], [cx - 11.4, cz - 2.6], [cx - 7.8, cz - 5.8]] as const) {
    const fern = new THREE.ConeGeometry(1.45, 2.4, 5).translate(fx, floorY + 2.45, fz);
    w3SdLeaf.push(fern);
  }
  addCone(w3SdRock, 0.38, 2.8, 5, cx - 13.5, floorY + 14.5, cz - 6.5, Math.PI);
  addCone(w3SdRock, 0.34, 2.4, 5, cx - 7.5, floorY + 14.8, cz - 6.8, Math.PI);

  // 744: Expanded dry travertine Ngọc Động (cave-pearl) rimstone nests at (cx + 12, cz + 6)
  addCyl(w3SdRock, 1.65, 1.85, 0.36, 6, cx + 12.0, floorY + 0.18, cz + 6.0);
  for (const [pxO, pzO] of [[-0.45, -0.35], [0.42, -0.25], [0, 0.45], [-0.25, 0.15]] as const) {
    addCyl(w3SdGold, 0.24, 0.24, 0.28, 6, cx + 12.0 + pxO, floorY + 0.48, cz + 6.0 + pzO);
  }

  // 745–746: Subterranean river crossing stepping boulders & stainless-steel safety handrail stakes
  for (let sb = 0; sb < 5; sb++) {
    const bx = cx - 9.0 + sb * 1.65;
    const bz = cz + 4.5 + Math.sin(sb * 0.7) * 0.65;
    addCyl(w3SdRock, 0.58, 0.68, 0.48, 6, bx, floorY + 0.18, bz);
    if (sb % 2 === 0) {
      addCyl(w3SdGold, 0.04, 0.05, 1.15, 5, bx, floorY + 0.85, bz + 0.72);
    }
  }
  addBox(w3SdGold, 6.8, 0.05, 0.05, cx - 5.7, floorY + 1.32, cz + 5.2);

  // 747–750: Campsite 1 expedition gear crates, solar camp-lantern posts, Great Wall belay boulders & organ-pipe flowstone columns
  addBox(w3SdWood, 0.85, 0.52, 0.62, cx - 7.5, floorY + 0.26, cz + 17.5);
  addBox(w3SdWood, 0.85, 0.52, 0.62, cx - 6.4, floorY + 0.26, cz + 17.5);
  for (const lx of [cx - 8.5, cx + 2.5]) {
    addCyl(w3SdWood, 0.04, 0.05, 1.95, 5, lx, floorY + 0.95, cz + 15.2);
    addCyl(w3SdGold, 0.12, 0.12, 0.24, 5, lx, floorY + 2.02, cz + 15.2);
  }
  addBox(w3SdRock, 2.8, 1.15, 2.2, cx, floorY + 0.55, cz - 27.8);
  addCyl(w3SdGold, 0.06, 0.07, 1.25, 5, cx + 1.1, floorY + 1.65, cz - 27.8);
  for (let op = 0; op < 3; op++) {
    addCyl(w3SdRock, 0.42, 0.65, 9.5 + op * 1.8, 6, cx + 22.0, floorY + 4.8 + op * 0.9, cz - 14.0 + op * 2.2);
  }

  const w3SdRockM = new THREE.Mesh(mergeNormalized(w3SdRock), ctx.materials.stone);
  w3SdRockM.castShadow = false;
  const w3SdLeafM = new THREE.Mesh(mergeNormalized(w3SdLeaf), foliageCanopyMat);
  w3SdLeafM.castShadow = false;
  const w3SdGoldM = new THREE.Mesh(mergeNormalized(w3SdGold), ctx.materials.gold);
  w3SdGoldM.castShadow = false;
  const w3SdWoodM = new THREE.Mesh(mergeNormalized(w3SdWood), ctx.materials.darkWood);
  w3SdWoodM.castShadow = false;
  group.add(w3SdRockM, w3SdLeafM, w3SdGoldM, w3SdWoodM);

  // Wave 4 Upgrades (Items 1141–1150): Sơn Đoòng Campsite 2 tents, Doline 2 observation deck,
  // joined calcite column, Rào Thương plank bridge & expedition briefing board
  const w4SdRock: THREE.BufferGeometry[] = [];
  const w4SdLeaf: THREE.BufferGeometry[] = [];
  const w4SdGold: THREE.BufferGeometry[] = [];
  const w4SdWood: THREE.BufferGeometry[] = [];
  // 1141: Campsite 2 sandy terrace & 2 expedition dome tents (cx + 16, cz - 2)
  addBox(w4SdRock, 6.8, 0.45, 5.2, cx + 16.0, floorY + 0.22, cz - 2.0);
  addCone(w4SdGold, 1.35, 1.25, 5, cx + 14.2, floorY + 1.05, cz - 2.2);
  addCone(w4SdGold, 1.35, 1.25, 5, cx + 17.8, floorY + 1.05, cz - 1.8);
  // 1142: Doline 2 sunlit timber observation platform (cx - 16, cz + 8) with 4 grounded stilts
  addBox(w4SdWood, 4.4, 0.24, 3.6, cx - 16.0, floorY + 1.65, cz + 8.0);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.5, 1.5]) {
      addCyl(w4SdWood, 0.09, 0.11, 1.85, 5, cx - 16.0 + ox, floorY + 0.85, cz + 8.0 + oz);
    }
  }
  // 1144–1148: Joined calcite column, Rào Thương plank footbridge & tree-fern cluster
  addCyl(w4SdRock, 1.15, 1.65, 22.0, 6, cx + 26.0, floorY + 11.0, cz + 12.0);
  addBox(w4SdWood, 6.2, 0.22, 1.65, cx + 21.0, floorY + 0.42, cz + 6.0);
  w4SdLeaf.push(new THREE.ConeGeometry(1.85, 2.8, 5).translate(cx - 5.0, floorY + 1.4, cz + 1.5));
  const w4SdRockM = new THREE.Mesh(mergeNormalized(w4SdRock), ctx.materials.stone);
  w4SdRockM.castShadow = false;
  const w4SdLeafM = new THREE.Mesh(mergeNormalized(w4SdLeaf), foliageCanopyMat);
  w4SdLeafM.castShadow = false;
  const w4SdGoldM = new THREE.Mesh(mergeNormalized(w4SdGold), ctx.materials.gold);
  w4SdGoldM.castShadow = false;
  const w4SdWoodM = new THREE.Mesh(mergeNormalized(w4SdWood), ctx.materials.darkWood);
  w4SdWoodM.castShadow = false;
  group.add(w4SdRockM, w4SdLeafM, w4SdGoldM, w4SdWoodM);

  // Wave 5 Upgrades (Items 1546–1555): Sơn Đoòng Campsite 2 mess-tent & dining table,
  // solar cave-lantern tripods, Great Wall rope stanchions, kayak rack, cave-pearls & ferns
  const w5SdRock: THREE.BufferGeometry[] = [];
  const w5SdLeaf: THREE.BufferGeometry[] = [];
  const w5SdGold: THREE.BufferGeometry[] = [];
  const w5SdWood: THREE.BufferGeometry[] = [];
  // 1546–1547: Campsite 2 4-post mess-tent canopy (cx + 16, cz - 8) & dining table + benches
  addBox(w5SdGold, 4.4, 0.18, 3.4, cx + 16.0, floorY + 2.65, cz - 8.0);
  for (const ox of [-1.9, 1.9]) {
    for (const oz of [-1.4, 1.4]) {
      addCyl(w5SdWood, 0.06, 0.07, 2.75, 5, cx + 16.0 + ox, floorY + 1.32, cz - 8.0 + oz);
    }
  }
  addBox(w5SdWood, 2.6, 0.78, 1.05, cx + 16.0, floorY + 0.45, cz - 8.0);
  addBox(w5SdWood, 2.4, 0.42, 0.38, cx + 16.0, floorY + 0.25, cz - 9.0);
  addBox(w5SdWood, 2.4, 0.42, 0.38, cx + 16.0, floorY + 0.25, cz - 7.0);
  // 1548–1553: 3 solar cave-lantern tripods, safety-rope stanchions, gear crates & kayak rack
  for (const [lx, lz] of [[-12.0, 4.5], [-4.0, 6.5], [8.5, 2.5]] as const) {
    addCyl(w5SdWood, 0.05, 0.07, 1.65, 5, cx + lx, floorY + 0.82, cz + lz);
    addBox(w5SdGold, 0.26, 0.32, 0.26, cx + lx, floorY + 1.75, cz + lz);
  }
  for (let rs = 0; rs < 3; rs++) {
    addCyl(w5SdGold, 0.05, 0.06, 1.45, 5, cx + 22.0 + rs * 2.2, floorY + 0.75 + rs * 0.45, cz + 14.0);
  }
  addBox(w5SdWood, 1.45, 0.65, 1.15, cx + 12.2, floorY + 0.45, cz - 5.2);
  addBox(w5SdGold, 3.2, 0.32, 0.78, cx + 18.5, floorY + 0.38, cz + 3.8);
  // 1554–1555: Giant cave-pearl calcite nest & Doline 2 fern/boulder borders
  for (const [px, pz] of [[4.2, -10.2], [5.1, -9.8], [4.6, -11.0]] as const) {
    addCyl(w5SdRock, 0.26, 0.26, 0.36, 6, cx + px, floorY + 0.28, cz + pz);
  }
  w5SdLeaf.push(
    new THREE.ConeGeometry(1.65, 2.4, 5).translate(cx - 12.5, floorY + 1.2, cz + 10.5),
    new THREE.ConeGeometry(1.45, 2.1, 5).translate(cx - 19.5, floorY + 1.1, cz + 5.5)
  );
  const w5SdRockM = new THREE.Mesh(mergeNormalized(w5SdRock), ctx.materials.stone);
  w5SdRockM.castShadow = false;
  const w5SdLeafM = new THREE.Mesh(mergeNormalized(w5SdLeaf), foliageCanopyMat);
  w5SdLeafM.castShadow = false;
  const w5SdGoldM = new THREE.Mesh(mergeNormalized(w5SdGold), ctx.materials.gold);
  w5SdGoldM.castShadow = false;
  const w5SdWoodM = new THREE.Mesh(mergeNormalized(w5SdWood), ctx.materials.darkWood);
  w5SdWoodM.castShadow = false;
  group.add(w5SdRockM, w5SdLeafM, w5SdGoldM, w5SdWoodM);

  // Wave 6 Upgrades (Items 1946–1955): Sơn Đoòng subterranean timber footbridge, Campsite 2 medical tent,
  // solar charging panels, cave-survey table, trail solar lanterns, gour-pool curbs & cave ferns
  const w6SdRock: THREE.BufferGeometry[] = [];
  const w6SdLeaf: THREE.BufferGeometry[] = [];
  const w6SdGold: THREE.BufferGeometry[] = [];
  const w6SdWood: THREE.BufferGeometry[] = [];
  // 1946–1947: Subterranean timber footbridge (Cầu Gỗ Rào Thương at cx + 6.0, cz + 12.0)
  addBox(w6SdWood, 7.6, 0.24, 1.85, cx + 6.0, floorY + 0.78, cz + 12.0);
  addBox(w6SdWood, 7.6, 0.10, 0.10, cx + 6.0, floorY + 1.65, cz + 11.15);
  addBox(w6SdWood, 7.6, 0.10, 0.10, cx + 6.0, floorY + 1.65, cz + 12.85);
  for (const bx of [-3.4, 0.0, 3.4]) {
    addCyl(w6SdWood, 0.08, 0.10, 1.45, 4, cx + 6.0 + bx, floorY + 0.35, cz + 11.2);
    addCyl(w6SdWood, 0.08, 0.10, 1.45, 4, cx + 6.0 + bx, floorY + 0.35, cz + 12.8);
  }
  // 1948–1950: Campsite 2 2nd 4-post equipment/medical tent (cx + 22.0, cz - 8.0), solar panels & survey table
  addBox(w6SdGold, 3.8, 0.18, 3.0, cx + 22.0, floorY + 2.55, cz - 8.0);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w6SdWood, 0.06, 0.07, 2.65, 4, cx + 22.0 + ox, floorY + 1.28, cz - 8.0 + oz);
    }
  }
  addBox(w6SdGold, 1.45, 0.08, 0.95, cx + 22.0, floorY + 0.95, cz - 5.2, 0.35);
  addBox(w6SdWood, 1.55, 0.78, 0.92, cx + 22.0, floorY + 0.42, cz - 8.0);
  // 1951–1955: 3 cave-trail solar lantern stakes, gour-pool limestone curbs & cave ferns
  for (const [lx, lz] of [[2.0, 10.5], [10.0, 10.5], [14.5, 4.5]] as const) {
    addCyl(w6SdWood, 0.05, 0.06, 1.55, 4, cx + lx, floorY + 0.78, cz + lz);
    addBox(w6SdGold, 0.24, 0.30, 0.24, cx + lx, floorY + 1.65, cz + lz);
  }
  addBox(w6SdRock, 3.6, 0.38, 0.42, cx + 4.5, floorY + 0.22, cz - 8.2);
  w6SdLeaf.push(
    new THREE.ConeGeometry(1.55, 2.2, 4).translate(cx + 1.2, floorY + 1.1, cz + 14.2),
    new THREE.ConeGeometry(1.45, 2.0, 4).translate(cx + 10.8, floorY + 1.0, cz + 14.2)
  );
  const w6SdRockM = new THREE.Mesh(mergeNormalized(w6SdRock), ctx.materials.stone);
  w6SdRockM.castShadow = false;
  const w6SdLeafM = new THREE.Mesh(mergeNormalized(w6SdLeaf), foliageCanopyMat);
  w6SdLeafM.castShadow = false;
  const w6SdGoldM = new THREE.Mesh(mergeNormalized(w6SdGold), ctx.materials.gold);
  w6SdGoldM.castShadow = false;
  const w6SdWoodM = new THREE.Mesh(mergeNormalized(w6SdWood), ctx.materials.darkWood);
  w6SdWoodM.castShadow = false;
  group.add(w6SdRockM, w6SdLeafM, w6SdGoldM, w6SdWoodM);

  // Wave 7 Upgrades (Items 2346–2355): Sơn Đoòng 2nd subterranean timber bridge, Campsite 1 mess-hall tent,
  // solar panel, dining table, trail solar lantern stakes, gour-pool curbs & subterranean cave ferns
  const w7SdRock: THREE.BufferGeometry[] = [];
  const w7SdLeaf: THREE.BufferGeometry[] = [];
  const w7SdGold: THREE.BufferGeometry[] = [];
  const w7SdWood: THREE.BufferGeometry[] = [];
  // 2346–2347: 2nd Subterranean timber footbridge (Cầu Gỗ Hang Én at cx - 10.0, cz + 14.0)
  addBox(w7SdWood, 7.6, 0.24, 1.85, cx - 10.0, floorY + 0.78, cz + 14.0);
  addBox(w7SdWood, 7.6, 0.10, 0.10, cx - 10.0, floorY + 1.65, cz + 13.15);
  addBox(w7SdWood, 7.6, 0.10, 0.10, cx - 10.0, floorY + 1.65, cz + 14.85);
  for (const bx of [-3.4, 0.0, 3.4]) {
    addCyl(w7SdWood, 0.08, 0.10, 1.45, 4, cx - 10.0 + bx, floorY + 0.35, cz + 13.2);
    addCyl(w7SdWood, 0.08, 0.10, 1.45, 4, cx - 10.0 + bx, floorY + 0.35, cz + 14.8);
  }
  // 2348–2350: Campsite 1 4-post expedition mess-hall tent (cx - 18.0, cz - 10.0), solar panel & dining table
  addBox(w7SdGold, 3.8, 0.18, 3.0, cx - 18.0, floorY + 2.55, cz - 10.0);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w7SdWood, 0.06, 0.07, 2.65, 4, cx - 18.0 + ox, floorY + 1.28, cz - 10.0 + oz);
    }
  }
  addBox(w7SdGold, 1.45, 0.08, 0.95, cx - 18.0, floorY + 0.95, cz - 7.2, 0.35);
  addBox(w7SdWood, 1.55, 0.78, 0.92, cx - 18.0, floorY + 0.42, cz - 10.0);
  // 2351–2355: 3 cave-trail lantern stakes, gour-pool curbs & cave ferns
  for (const [lx, lz] of [[-6.0, 12.0], [-14.0, 12.0], [-14.5, 2.5]] as const) {
    addCyl(w7SdWood, 0.05, 0.06, 1.55, 4, cx + lx, floorY + 0.78, cz + lz);
    addBox(w7SdGold, 0.24, 0.30, 0.24, cx + lx, floorY + 1.65, cz + lz);
  }
  addBox(w7SdRock, 3.6, 0.38, 0.42, cx - 5.5, floorY + 0.22, cz - 8.2);
  w7SdLeaf.push(
    new THREE.ConeGeometry(1.55, 2.2, 4).translate(cx - 6.2, floorY + 1.1, cz + 16.2),
    new THREE.ConeGeometry(1.45, 2.0, 4).translate(cx - 14.8, floorY + 1.0, cz + 16.2)
  );
  const w7SdRockM = new THREE.Mesh(mergeNormalized(w7SdRock), ctx.materials.stone);
  w7SdRockM.castShadow = false;
  const w7SdLeafM = new THREE.Mesh(mergeNormalized(w7SdLeaf), foliageCanopyMat);
  w7SdLeafM.castShadow = false;
  const w7SdGoldM = new THREE.Mesh(mergeNormalized(w7SdGold), ctx.materials.gold);
  w7SdGoldM.castShadow = false;
  const w7SdWoodM = new THREE.Mesh(mergeNormalized(w7SdWood), ctx.materials.darkWood);
  w7SdWoodM.castShadow = false;
  group.add(w7SdRockM, w7SdLeafM, w7SdGoldM, w7SdWoodM);

  // Wave 8 Upgrades (Items 2746–2755): Sơn Đoòng 3rd subterranean timber bridge, Campsite 2 gear-dry tent,
  // solar panel, dining table, trail solar lantern stakes, gour-pool curb & subterranean cave ferns
  const w8SdRock: THREE.BufferGeometry[] = [];
  const w8SdLeaf: THREE.BufferGeometry[] = [];
  const w8SdGold: THREE.BufferGeometry[] = [];
  const w8SdWood: THREE.BufferGeometry[] = [];
  // 2746–2747: 3rd Subterranean timber footbridge (Cầu Gỗ Vườn Địa Đàng at cx + 12.0, cz + 14.0)
  addBox(w8SdWood, 7.6, 0.24, 1.85, cx + 12.0, floorY + 0.78, cz + 14.0);
  addBox(w8SdWood, 7.6, 0.10, 0.10, cx + 12.0, floorY + 1.65, cz + 13.15);
  addBox(w8SdWood, 7.6, 0.10, 0.10, cx + 12.0, floorY + 1.65, cz + 14.85);
  for (const bx of [-3.4, 0.0, 3.4]) {
    addCyl(w8SdWood, 0.08, 0.10, 1.45, 4, cx + 12.0 + bx, floorY + 0.35, cz + 13.2);
    addCyl(w8SdWood, 0.08, 0.10, 1.45, 4, cx + 12.0 + bx, floorY + 0.35, cz + 14.8);
  }
  // 2748–2750: Campsite 2 4-post expedition gear-dry tent (cx + 18.0, cz - 10.0), solar panel & dining table
  addBox(w8SdGold, 3.8, 0.18, 3.0, cx + 18.0, floorY + 2.55, cz - 10.0);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w8SdWood, 0.06, 0.07, 2.65, 4, cx + 18.0 + ox, floorY + 1.28, cz - 10.0 + oz);
    }
  }
  addBox(w8SdGold, 1.45, 0.08, 0.95, cx + 18.0, floorY + 0.95, cz - 7.2, 0.35);
  addBox(w8SdWood, 1.55, 0.78, 0.92, cx + 18.0, floorY + 0.42, cz - 10.0);
  // 2751–2755: 3 cave-trail lantern stakes, gour-pool curb & cave ferns
  for (const [lx, lz] of [[8.0, 12.0], [16.0, 12.0], [14.5, 2.5]] as const) {
    addCyl(w8SdWood, 0.05, 0.06, 1.55, 4, cx + lx, floorY + 0.78, cz + lz);
    addBox(w8SdGold, 0.24, 0.30, 0.24, cx + lx, floorY + 1.65, cz + lz);
  }
  addBox(w8SdRock, 3.6, 0.38, 0.42, cx + 5.5, floorY + 0.22, cz - 8.2);
  w8SdLeaf.push(
    new THREE.ConeGeometry(1.55, 2.2, 4).translate(cx + 8.2, floorY + 1.1, cz + 16.2),
    new THREE.ConeGeometry(1.45, 2.0, 4).translate(cx + 16.8, floorY + 1.0, cz + 16.2)
  );
  const w8SdRockM = new THREE.Mesh(mergeNormalized(w8SdRock), ctx.materials.stone);
  w8SdRockM.castShadow = false;
  const w8SdLeafM = new THREE.Mesh(mergeNormalized(w8SdLeaf), foliageCanopyMat);
  w8SdLeafM.castShadow = false;
  const w8SdGoldM = new THREE.Mesh(mergeNormalized(w8SdGold), ctx.materials.gold);
  w8SdGoldM.castShadow = false;
  const w8SdWoodM = new THREE.Mesh(mergeNormalized(w8SdWood), ctx.materials.darkWood);
  w8SdWoodM.castShadow = false;
  group.add(w8SdRockM, w8SdLeafM, w8SdGoldM, w8SdWoodM);

  // Wave 9 Upgrades (Items 3146–3155): Sơn Đoòng 4th subterranean timber bridge, Campsite 3 weather tent,
  // solar panel, field table, trail solar lantern stakes, gour-pool curb & subterranean cave ferns
  const w9SdRock: THREE.BufferGeometry[] = [];
  const w9SdLeaf: THREE.BufferGeometry[] = [];
  const w9SdGold: THREE.BufferGeometry[] = [];
  const w9SdWood: THREE.BufferGeometry[] = [];
  // 3146–3147: 4th Subterranean timber footbridge (Cầu Gỗ Hố Sụt 2 at cx - 12.0, cz + 14.0)
  addBox(w9SdWood, 7.6, 0.24, 1.85, cx - 12.0, floorY + 0.78, cz + 14.0);
  addBox(w9SdWood, 7.6, 0.10, 0.10, cx - 12.0, floorY + 1.65, cz + 13.15);
  addBox(w9SdWood, 7.6, 0.10, 0.10, cx - 12.0, floorY + 1.65, cz + 14.85);
  for (const bx of [-3.4, 0.0, 3.4]) {
    addCyl(w9SdWood, 0.08, 0.10, 1.45, 4, cx - 12.0 + bx, floorY + 0.35, cz + 13.2);
    addCyl(w9SdWood, 0.08, 0.10, 1.45, 4, cx - 12.0 + bx, floorY + 0.35, cz + 14.8);
  }
  // 3148–3150: Campsite 3 4-post expedition weather-monitoring tent (cx - 18.0, cz - 10.0), solar panel & field table
  addBox(w9SdGold, 3.8, 0.18, 3.0, cx - 18.0, floorY + 2.55, cz - 10.0);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w9SdWood, 0.06, 0.07, 2.65, 4, cx - 18.0 + ox, floorY + 1.28, cz - 10.0 + oz);
    }
  }
  addBox(w9SdGold, 1.45, 0.08, 0.95, cx - 18.0, floorY + 0.95, cz - 7.2, 0.35);
  addBox(w9SdWood, 1.55, 0.78, 0.92, cx - 18.0, floorY + 0.42, cz - 10.0);
  // 3151–3155: 3 cave-trail lantern stakes, gour-pool curb & cave ferns
  for (const [lx, lz] of [[-8.0, 12.0], [-16.0, 12.0], [-14.5, 2.5]] as const) {
    addCyl(w9SdWood, 0.05, 0.06, 1.55, 4, cx + lx, floorY + 0.78, cz + lz);
    addBox(w9SdGold, 0.24, 0.30, 0.24, cx + lx, floorY + 1.65, cz + lz);
  }
  addBox(w9SdRock, 3.6, 0.38, 0.42, cx - 5.5, floorY + 0.22, cz - 8.2);
  w9SdLeaf.push(
    new THREE.ConeGeometry(1.55, 2.2, 4).translate(cx - 8.2, floorY + 1.1, cz + 16.2),
    new THREE.ConeGeometry(1.45, 2.0, 4).translate(cx - 16.8, floorY + 1.0, cz + 16.2)
  );
  const w9SdRockM = new THREE.Mesh(mergeNormalized(w9SdRock), ctx.materials.stone);
  w9SdRockM.castShadow = false;
  const w9SdLeafM = new THREE.Mesh(mergeNormalized(w9SdLeaf), foliageCanopyMat);
  w9SdLeafM.castShadow = false;
  const w9SdGoldM = new THREE.Mesh(mergeNormalized(w9SdGold), ctx.materials.gold);
  w9SdGoldM.castShadow = false;
  const w9SdWoodM = new THREE.Mesh(mergeNormalized(w9SdWood), ctx.materials.darkWood);
  w9SdWoodM.castShadow = false;
  group.add(w9SdRockM, w9SdLeafM, w9SdGoldM, w9SdWoodM);

  // Wave 10 Upgrades (Items 3546–3555): Sơn Đoòng 5th subterranean timber bridge, Campsite 4 shelter,
  // solar panel, field gear table, trail solar lantern stakes, gour-pool curb & subterranean cave ferns
  const w10SdRock: THREE.BufferGeometry[] = [];
  const w10SdLeaf: THREE.BufferGeometry[] = [];
  const w10SdGold: THREE.BufferGeometry[] = [];
  const w10SdWood: THREE.BufferGeometry[] = [];
  // 3546–3547: 5th Subterranean timber footbridge (Cầu Gỗ Hố Sụt 1 at cx + 14.0, cz + 14.0)
  addBox(w10SdWood, 7.6, 0.24, 1.85, cx + 14.0, floorY + 0.78, cz + 14.0);
  addBox(w10SdWood, 7.6, 0.10, 0.10, cx + 14.0, floorY + 1.65, cz + 13.15);
  addBox(w10SdWood, 7.6, 0.10, 0.10, cx + 14.0, floorY + 1.65, cz + 14.85);
  for (const bx of [-3.4, 0.0, 3.4]) {
    addCyl(w10SdWood, 0.08, 0.10, 1.45, 4, cx + 14.0 + bx, floorY + 0.35, cz + 13.2);
    addCyl(w10SdWood, 0.08, 0.10, 1.45, 4, cx + 14.0 + bx, floorY + 0.35, cz + 14.8);
  }
  // 3548–3550: Campsite 4 4-post expedition dome-canopy shelter (cx + 18.0, cz - 12.0), solar panel & gear table
  addBox(w10SdGold, 3.8, 0.18, 3.0, cx + 18.0, floorY + 2.55, cz - 12.0);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w10SdWood, 0.06, 0.07, 2.65, 4, cx + 18.0 + ox, floorY + 1.28, cz - 12.0 + oz);
    }
  }
  addBox(w10SdGold, 1.45, 0.08, 0.95, cx + 18.0, floorY + 0.95, cz - 9.2, 0.35);
  addBox(w10SdWood, 1.55, 0.78, 0.92, cx + 18.0, floorY + 0.42, cz - 12.0);
  // 3551–3555: 3 cave-trail lantern stakes, gour-pool curb & cave ferns
  for (const [lx, lz] of [[10.0, 12.0], [18.0, 12.0], [15.5, 2.5]] as const) {
    addCyl(w10SdWood, 0.05, 0.06, 1.55, 4, cx + lx, floorY + 0.78, cz + lz);
    addBox(w10SdGold, 0.24, 0.30, 0.24, cx + lx, floorY + 1.65, cz + lz);
  }
  addBox(w10SdRock, 3.6, 0.38, 0.42, cx + 6.5, floorY + 0.22, cz - 8.2);
  w10SdLeaf.push(
    new THREE.ConeGeometry(1.55, 2.2, 4).translate(cx + 10.2, floorY + 1.1, cz + 16.2),
    new THREE.ConeGeometry(1.45, 2.0, 4).translate(cx + 18.8, floorY + 1.0, cz + 16.2)
  );
  const w10SdRockM = new THREE.Mesh(mergeNormalized(w10SdRock), ctx.materials.stone);
  w10SdRockM.castShadow = false;
  const w10SdLeafM = new THREE.Mesh(mergeNormalized(w10SdLeaf), foliageCanopyMat);
  w10SdLeafM.castShadow = false;
  const w10SdGoldM = new THREE.Mesh(mergeNormalized(w10SdGold), ctx.materials.gold);
  w10SdGoldM.castShadow = false;
  const w10SdWoodM = new THREE.Mesh(mergeNormalized(w10SdWood), ctx.materials.darkWood);
  w10SdWoodM.castShadow = false;
  group.add(w10SdRockM, w10SdLeafM, w10SdGoldM, w10SdWoodM);

  // Wave 11 Upgrades (Items 3946–3955): Sơn Đoòng 6th subterranean timber bridge, Campsite 5 shelter,
  // solar panel, field gear table, trail solar lantern stakes, gour-pool curb & subterranean cave ferns
  const w11SdRock: THREE.BufferGeometry[] = [];
  const w11SdLeaf: THREE.BufferGeometry[] = [];
  const w11SdGold: THREE.BufferGeometry[] = [];
  const w11SdWood: THREE.BufferGeometry[] = [];
  // 3946–3947: 6th Subterranean timber footbridge (Cầu Gỗ Hố Sụt 2 at cx - 14.0, cz + 14.0)
  addBox(w11SdWood, 7.6, 0.24, 1.85, cx - 14.0, floorY + 0.78, cz + 14.0);
  addBox(w11SdWood, 7.6, 0.10, 0.10, cx - 14.0, floorY + 1.65, cz + 13.15);
  addBox(w11SdWood, 7.6, 0.10, 0.10, cx - 14.0, floorY + 1.65, cz + 14.85);
  for (const bx of [-3.4, 0.0, 3.4]) {
    addCyl(w11SdWood, 0.08, 0.10, 1.45, 4, cx - 14.0 + bx, floorY + 0.35, cz + 13.2);
    addCyl(w11SdWood, 0.08, 0.10, 1.45, 4, cx - 14.0 + bx, floorY + 0.35, cz + 14.8);
  }
  // 3948–3950: Campsite 5 4-post expedition dome-canopy shelter (cx - 18.0, cz - 12.0), solar panel & gear table
  addBox(w11SdGold, 3.8, 0.18, 3.0, cx - 18.0, floorY + 2.55, cz - 12.0);
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w11SdWood, 0.06, 0.07, 2.65, 4, cx - 18.0 + ox, floorY + 1.28, cz - 12.0 + oz);
    }
  }
  addBox(w11SdGold, 1.45, 0.08, 0.95, cx - 18.0, floorY + 0.95, cz - 9.2, 0.35);
  addBox(w11SdWood, 1.55, 0.78, 0.92, cx - 18.0, floorY + 0.42, cz - 12.0);
  // 3951–3955: 3 cave-trail lantern stakes, gour-pool curb & cave ferns
  for (const [lx, lz] of [[-10.0, 12.0], [-18.0, 12.0], [-15.5, 2.5]] as const) {
    addCyl(w11SdWood, 0.05, 0.06, 1.55, 4, cx + lx, floorY + 0.78, cz + lz);
    addBox(w11SdGold, 0.24, 0.30, 0.24, cx + lx, floorY + 1.65, cz + lz);
  }
  addBox(w11SdRock, 3.6, 0.38, 0.42, cx - 6.5, floorY + 0.22, cz - 8.2);
  w11SdLeaf.push(
    new THREE.ConeGeometry(1.55, 2.2, 4).translate(cx - 10.2, floorY + 1.1, cz + 16.2),
    new THREE.ConeGeometry(1.45, 2.0, 4).translate(cx - 18.8, floorY + 1.0, cz + 16.2)
  );
  const w11SdRockM = new THREE.Mesh(mergeNormalized(w11SdRock), ctx.materials.stone);
  w11SdRockM.castShadow = false;
  const w11SdLeafM = new THREE.Mesh(mergeNormalized(w11SdLeaf), foliageCanopyMat);
  w11SdLeafM.castShadow = false;
  const w11SdGoldM = new THREE.Mesh(mergeNormalized(w11SdGold), ctx.materials.gold);
  w11SdGoldM.castShadow = false;
  const w11SdWoodM = new THREE.Mesh(mergeNormalized(w11SdWood), ctx.materials.darkWood);
  w11SdWoodM.castShadow = false;
  group.add(w11SdRockM, w11SdLeafM, w11SdGoldM, w11SdWoodM);

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

  const cx = 292;
  const cz = -268;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 24.0 }, { x: 292, z: -236, r: 10.0 });

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
  const dockX = 292.0;
  const dockZ = -236.0;
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
  const cliffMat =
    ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.84, metalness: 0.02 }) ??
    ctx.materials.granite;
  const pnCalciteMat = ctx.materials.ochreSand ?? ctx.materials.stone;
  group.add(
    new THREE.Mesh(mergeNormalized(pnBoatParts), pnBoatMat),
    new THREE.Mesh(mergeNormalized(calciteParts), pnCalciteMat)
  );

  // FIX PN-04: Subtle realistic cave lighting illuminating amber-cream stalactites without neon disco wash (ref 23_dong_phong_nha.jpg)
  const grottoLight = new THREE.PointLight('#f5c07a', 18.0, 48.0, 1.7);
  grottoLight.position.set(cx, 7.5, cz - 4.0);
  const innerEmeraldLight = new THREE.PointLight('#4ca896', 14.0, 42.0, 1.7);
  innerEmeraldLight.position.set(cx, 5.5, cz - 24.0);
  const dockLanternLight = new THREE.PointLight('#ffbe66', 10.0, 36.0, 1.7);
  dockLanternLight.position.set(dockX - 4.0, 3.6, dockZ + 4.0);
  group.add(grottoLight, innerEmeraldLight, dockLanternLight);

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
  // Items 176–183: Động Phong Nha Hàm Rồng jagged karst teeth, Hang Bi Ký Chăm inscription tablet,
  // Sông Son karst riverbanks with bamboo clumps & limestone talus boulders, waiting pavilion beside dock & mooring bollards!
  const pnExtraStone: THREE.BufferGeometry[] = [];
  for (let t = -8; t <= 8; t += 4) {
    pnExtraStone.push(new THREE.ConeGeometry(0.45, 1.85, 5).rotateX(Math.PI).translate(cx + t, 9.8 + t * 0.18, cz + 13.4));
  }
  // Hang Bi Ký Chăm inscription tablet on interior left cliff wall
  pnExtraStone.push(new THREE.BoxGeometry(0.35, 1.85, 1.45).translate(cx - 13.8, 3.2, cz - 18.0));
  // Sông Son flanking limestone talus boulders & mooring bollards
  for (const sx of [cx - 26.0, cx + 26.0]) {
    pnExtraStone.push(createSculptedRockGeometry(2780 + Math.round(sx), 4.2, 2.8, 4.5, 1).translate(sx, 0.6, cz + 16.0));
  }
  for (const bx of [dockX - 4.8, dockX + 4.8]) {
    pnExtraStone.push(new THREE.CylinderGeometry(0.14, 0.16, 0.65, 6).translate(bx, 1.15, dockZ + 2.0));
  }
  const pnExtraMesh = new THREE.Mesh(mergeNormalized(pnExtraStone), ctx.materials.stone);
  pnExtraMesh.castShadow = false;
  pnExtraMesh.receiveShadow = true;
  group.add(pnExtraMesh);

  // Động Phong Nha thatched-tile waiting pavilion beside timber dock (dockX - 9.5, dockZ + 4.5) with grounded deck & pilings
  const pnPavParts: THREE.BufferGeometry[] = [];
  pnPavParts.push(new THREE.BoxGeometry(5.2, 0.24, 4.4).translate(dockX - 9.5, 0.72, dockZ + 4.5));
  for (const px of [-2.2, 2.2]) {
    for (const pz of [-1.8, 1.8]) {
      pnPavParts.push(
        new THREE.CylinderGeometry(0.12, 0.15, 2.4, 6).translate(dockX - 9.5 + px, -0.45, dockZ + 4.5 + pz),
        new THREE.CylinderGeometry(0.11, 0.13, 2.85, 6).translate(dockX - 9.5 + px, 2.12, dockZ + 4.5 + pz)
      );
    }
  }
  pnPavParts.push(new THREE.ConeGeometry(3.6, 1.65, 4).rotateY(Math.PI * 0.25).translate(dockX - 9.5, 4.3, dockZ + 4.5));
  const pnPavMesh = new THREE.Mesh(mergeNormalized(pnPavParts), ctx.materials.darkWood);
  pnPavMesh.castShadow = false;
  group.add(pnPavMesh);

  // Wave 2 Upgrades (Items 376–380): Động Phong Nha dry-cave tourist walkway (with pilings & posts!), interior stalagmite
  // shrine uplights, Bến Thuyền ticket booth & grounded umbrella, 2nd Thuyền Rồng tour boat & riverbank bamboo
  const w2PnWood: THREE.BufferGeometry[] = [];
  const w2PnStone: THREE.BufferGeometry[] = [];
  const w2PnGold: THREE.BufferGeometry[] = [];
  // 376: Dry-cave timber-and-stone tourist walkway with pilings & supported handrail on right cavern ledge
  addBox(w2PnWood, 1.85, 0.22, 16.0, cx + 12.5, 1.85, cz - 14.0);
  addBox(w2PnGold, 0.08, 0.08, 16.0, cx + 11.6, 2.75, cz - 14.0);
  for (let wp = 0; wp < 5; wp++) {
    const wz = cz - 21.2 + wp * 3.6;
    addCyl(w2PnWood, 0.09, 0.11, 3.4, 5, cx + 11.7, 0.2, wz);
    addCyl(w2PnWood, 0.09, 0.11, 3.4, 5, cx + 13.3, 0.2, wz);
    addCyl(w2PnGold, 0.04, 0.045, 0.96, 5, cx + 11.6, 2.30, wz);
  }
  // 377: Interior calcite Cung Đình stalagmite shrine cluster & uplight housings
  addCone(w2PnStone, 1.15, 3.8, 5, cx - 8.5, 2.1, cz - 22.0);
  addBox(w2PnGold, 0.35, 0.24, 0.35, cx - 7.0, 0.65, cz - 20.5);
  // 378: Ticket-counter booth, life-vest rack & grounded bamboo shade umbrella beside waiting pavilion
  addBox(w2PnWood, 2.2, 2.0, 1.4, dockX - 6.2, 1.65, dockZ + 5.2);
  addCyl(w2PnWood, 0.05, 0.06, 2.2, 6, dockX - 3.6, 1.75, dockZ + 4.8);
  addCone(w2PnGold, 1.25, 0.45, 6, dockX - 3.6, 2.85, dockZ + 4.8);
  // 379: 2nd Thuyền Rồng Phong Nha tour boat moored at dock (dockX + 5.8, dockZ - 2.5)
  addBox(w2PnWood, 1.85, 0.55, 6.2, dockX + 5.8, 0.38, dockZ - 2.5);
  addBox(w2PnGold, 1.72, 1.05, 4.2, dockX + 5.8, 1.18, dockZ - 2.5);
  // 380: Sông Son karst riverbank bamboo stalks & stepping-stones flanking cave mouth
  for (const sx of [cx - 21.5, cx + 21.5]) {
    for (let bm = 0; bm < 3; bm++) {
      addCyl(w2PnWood, 0.06, 0.08, 4.8, 5, sx + bm * 0.45, 2.6, cz + 14.5 + bm * 0.35);
    }
    addBox(w2PnStone, 1.45, 0.28, 1.25, sx, 0.35, cz + 17.5);
  }
  const w2PnWoodM = new THREE.Mesh(mergeNormalized(w2PnWood), ctx.materials.darkWood);
  w2PnWoodM.castShadow = false;
  const w2PnStoneM = new THREE.Mesh(mergeNormalized(w2PnStone), ctx.materials.stone);
  w2PnStoneM.castShadow = false;
  const w2PnGoldM = new THREE.Mesh(mergeNormalized(w2PnGold), ctx.materials.gold);
  w2PnGoldM.castShadow = false;
  group.add(w2PnWoodM, w2PnStoneM, w2PnGoldM);

  // Wave 3 Upgrades (Items 751–760): Động Phong Nha Hang Bi Ký ledge, Cung Đình spires, dry-cave viewing bump-out,
  // Bến Thuyền Sông Son fenders/cleats, waiting benches/lanterns, boarding gangplanks & western cliff solar beacon
  const w3PnWood: THREE.BufferGeometry[] = [];
  const w3PnStone: THREE.BufferGeometry[] = [];
  const w3PnGold: THREE.BufferGeometry[] = [];
  // 751–754: Interior Hang Bi Ký ledge & spotlight, Cung Đình spires, dry-cave viewing bump-out & waterline cave ledges
  addBox(w3PnStone, 2.4, 0.85, 1.85, cx - 10.5, 1.25, cz - 18.0);
  addBox(w3PnGold, 0.32, 0.22, 0.32, cx - 9.2, 1.78, cz - 17.5);
  addCone(w3PnStone, 0.85, 3.2, 5, cx - 6.5, 1.8, cz - 24.5);
  addBox(w3PnWood, 2.4, 0.22, 3.4, cx + 10.8, 1.85, cz - 14.0);
  addBox(w3PnStone, 3.2, 0.95, 2.4, cx - 16.5, 0.55, cz + 4.5);
  // 755–760: Bến Thuyền boat fenders/cleats, waiting pavilion benches & lanterns (inside waiting pavilion at dockX - 9.5, dockZ + 4.5!), gangplanks, UNESCO welcome stele & cliff solar beacon
  addBox(w3PnWood, 0.28, 0.32, 6.2, dockX + 4.6, 0.62, dockZ - 2.5);
  addCyl(w3PnGold, 0.10, 0.12, 0.32, 5, dockX + 4.2, 0.92, dockZ - 4.5);
  addBox(w3PnWood, 2.2, 0.45, 0.55, dockX - 9.5, 0.95, dockZ + 4.5);
  addBox(w3PnGold, 0.24, 0.32, 0.24, dockX - 9.5, 3.35, dockZ + 4.5);
  addBox(w3PnWood, 2.4, 0.14, 1.05, dockX + 3.6, 0.68, dockZ - 1.2, 0, 0, -0.15);
  addBox(w3PnStone, 1.25, 2.45, 0.35, dockX - 8.5, 1.05, dockZ + 6.5);
  addCyl(w3PnGold, 0.08, 0.10, 2.8, 5, cx - 19.5, 2.2, cz + 11.5);
  addCone(w3PnGold, 0.28, 0.42, 5, cx - 19.5, 3.75, cz + 11.5);
  const w3PnWoodM = new THREE.Mesh(mergeNormalized(w3PnWood), ctx.materials.darkWood);
  w3PnWoodM.castShadow = false;
  const w3PnStoneM = new THREE.Mesh(mergeNormalized(w3PnStone), ctx.materials.stone);
  w3PnStoneM.castShadow = false;
  const w3PnGoldM = new THREE.Mesh(mergeNormalized(w3PnGold), ctx.materials.gold);
  w3PnGoldM.castShadow = false;
  group.add(w3PnWoodM, w3PnStoneM, w3PnGoldM);

  // Wave 4 Upgrades (Items 1151–1160): Bến Phà Sông Son ferry wharf, shaded ticket pavilion,
  // 3rd Thuyền Rồng boat, Hang Bi Ký altar replica & Sông Son bamboo bench
  const w4PnWood: THREE.BufferGeometry[] = [];
  const w4PnStone: THREE.BufferGeometry[] = [];
  const w4PnGold: THREE.BufferGeometry[] = [];
  // 1151–1152: Bến Phà Sông Son ferry wharf (dockX + 12.5, dockZ + 2.0) & 4-post ticket pavilion
  addBox(w4PnWood, 7.6, 0.26, 4.2, dockX + 12.5, 0.72, dockZ + 2.0);
  addBox(w4PnWood, 3.8, 0.20, 3.0, dockX + 12.5, 3.55, dockZ + 2.0);
  for (const pxO of [-1.6, 1.6]) {
    for (const pzO of [-1.2, 1.2]) {
      addCyl(w4PnWood, 0.11, 0.13, 2.4, 5, dockX + 12.5 + pxO, -0.45, dockZ + 2.0 + pzO);
      addCyl(w4PnWood, 0.08, 0.10, 2.95, 5, dockX + 12.5 + pxO, 2.15, dockZ + 2.0 + pzO);
    }
  }
  // 1153–1160: 3rd Thuyền Rồng boat gliding toward mouth, Hang Bi Ký Cham altar & eastern bamboo grove
  addBox(w4PnWood, 1.85, 0.55, 6.2, cx - 2.0, 0.36, cz + 20.0);
  addBox(w4PnGold, 1.65, 0.95, 4.0, cx - 2.0, 1.12, cz + 20.0);
  addBox(w4PnStone, 1.45, 0.92, 1.15, cx - 10.5, 1.75, cz - 18.0);
  addBox(w4PnWood, 2.2, 0.45, 0.58, cx + 19.5, 0.55, cz + 18.0);
  const w4PnWoodM = new THREE.Mesh(mergeNormalized(w4PnWood), ctx.materials.darkWood);
  w4PnWoodM.castShadow = false;
  const w4PnStoneM = new THREE.Mesh(mergeNormalized(w4PnStone), ctx.materials.stone);
  w4PnStoneM.castShadow = false;
  const w4PnGoldM = new THREE.Mesh(mergeNormalized(w4PnGold), ctx.materials.gold);
  w4PnGoldM.castShadow = false;
  group.add(w4PnWoodM, w4PnStoneM, w4PnGoldM);

  // Wave 5 Upgrades (Items 1556–1565): Phong Nha cave-mouth uplight sconces, Sông Son balustrade,
  // 4th Thuyền Rồng boat, oar rack, karst viewing deck, UNESCO stele & depth-gauge buoy
  const w5PnWood: THREE.BufferGeometry[] = [];
  const w5PnStone: THREE.BufferGeometry[] = [];
  const w5PnGold: THREE.BufferGeometry[] = [];
  // 1556–1558: 3 warm amber cave-mouth uplight sconces on interior ledges
  for (const [ux, uy, uz] of [[-9.5, 2.4, -2.5], [8.5, 2.2, -3.5], [0.0, 2.8, -10.0]] as const) {
    addBox(w5PnStone, 0.55, 0.45, 0.55, cx + ux, uy, cz + uz);
    addBox(w5PnGold, 0.34, 0.34, 0.34, cx + ux, uy + 0.42, cz + uz);
  }
  // 1559–1565: Balustrade & solar lanterns, 4th Thuyền Rồng boat, oar rack, viewing deck & UNESCO stele
  addBox(w5PnStone, 8.2, 0.65, 0.36, dockX + 12.5, 1.05, dockZ + 4.4);
  for (const s of [-1, 1]) {
    addCyl(w5PnWood, 0.06, 0.08, 2.8, 5, dockX + 12.5 + s * 3.8, 2.1, dockZ + 4.4);
    addBox(w5PnGold, 0.28, 0.32, 0.28, dockX + 12.5 + s * 3.8, 3.62, dockZ + 4.4);
  }
  addBox(w5PnWood, 1.85, 0.55, 6.2, dockX + 12.5, 0.36, dockZ - 4.2);
  addBox(w5PnGold, 1.65, 0.95, 4.0, dockX + 12.5, 1.12, dockZ - 4.2);
  addBox(w5PnWood, 1.85, 1.25, 0.52, dockX + 15.2, 1.42, dockZ + 2.0);
  addBox(w5PnWood, 5.2, 0.26, 3.6, cx + 22.0, 0.72, cz + 24.0);
  addBox(w5PnWood, 2.0, 0.45, 0.55, cx + 22.0, 1.08, cz + 24.8);
  addBox(w5PnStone, 1.15, 2.1, 0.42, dockX + 5.8, 1.55, dockZ + 5.2);
  addCyl(w5PnGold, 0.34, 0.38, 1.15, 5, cx + 6.5, 0.52, cz + 12.0);
  const w5PnWoodM = new THREE.Mesh(mergeNormalized(w5PnWood), ctx.materials.darkWood);
  w5PnWoodM.castShadow = false;
  const w5PnStoneM = new THREE.Mesh(mergeNormalized(w5PnStone), ctx.materials.stone);
  w5PnStoneM.castShadow = false;
  const w5PnGoldM = new THREE.Mesh(mergeNormalized(w5PnGold), ctx.materials.gold);
  w5PnGoldM.castShadow = false;
  group.add(w5PnWoodM, w5PnStoneM, w5PnGoldM);

  // Wave 6 Upgrades (Items 1956–1965): Sông Son 4-post ticket pavilion, cantilevered photo jetty,
  // 5th Thuyền Rồng boat, extra cave uplights, channel buoys & limestone embarkation steps
  const w6PnWood: THREE.BufferGeometry[] = [];
  const w6PnStone: THREE.BufferGeometry[] = [];
  const w6PnGold: THREE.BufferGeometry[] = [];
  // 1956–1957: 4-post timber boat-ticket pavilion (dockX + 18.0, dockZ + 3.5) & benches
  addBox(w6PnWood, 4.0, 0.22, 3.2, dockX + 18.0, 3.45, dockZ + 3.5);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w6PnWood, 0.08, 0.10, 2.95, 4, dockX + 18.0 + ox, 2.02, dockZ + 3.5 + oz);
    }
  }
  addBox(w6PnWood, 2.2, 0.45, 0.55, dockX + 18.0, 0.95, dockZ + 4.2);
  addBox(w6PnWood, 1.85, 0.85, 0.72, dockX + 18.0, 1.15, dockZ + 2.8);
  // 1958–1959: Cantilevered photo jetty & 5th moored Thuyền Rồng sightseeing boat
  addBox(w6PnWood, 3.2, 0.22, 5.4, dockX + 20.5, 0.65, dockZ - 2.5);
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-2.2, 2.2]) {
      addCyl(w6PnWood, 0.08, 0.10, 2.0, 4, dockX + 20.5 + ox, -0.25, dockZ - 2.5 + oz);
    }
  }
  addBox(w6PnWood, 1.85, 0.55, 6.0, dockX + 18.5, 0.36, dockZ - 5.2);
  addBox(w6PnGold, 1.62, 0.92, 3.8, dockX + 18.5, 1.10, dockZ - 5.2);
  // 1960–1965: 2 extra cave-mouth uplights, channel buoys, riverbank steps & milepost
  for (const [ux, uy, uz] of [[-5.5, 2.6, -6.5], [5.5, 2.5, -6.5]] as const) {
    addBox(w6PnStone, 0.52, 0.42, 0.52, cx + ux, uy, cz + uz);
    addBox(w6PnGold, 0.32, 0.32, 0.32, cx + ux, uy + 0.40, cz + uz);
  }
  addCyl(w6PnGold, 0.30, 0.34, 1.10, 4, cx - 6.5, 0.50, cz + 12.0);
  addBox(w6PnStone, 2.6, 0.52, 2.2, cx + 26.5, 0.52, cz + 24.0);
  addBox(w6PnStone, 0.65, 1.65, 0.38, dockX + 14.0, 1.35, dockZ + 5.4);
  const w6PnWoodM = new THREE.Mesh(mergeNormalized(w6PnWood), ctx.materials.darkWood);
  w6PnWoodM.castShadow = false;
  const w6PnStoneM = new THREE.Mesh(mergeNormalized(w6PnStone), ctx.materials.stone);
  w6PnStoneM.castShadow = false;
  const w6PnGoldM = new THREE.Mesh(mergeNormalized(w6PnGold), ctx.materials.gold);
  w6PnGoldM.castShadow = false;
  group.add(w6PnWoodM, w6PnStoneM, w6PnGoldM);

  // Wave 7 Upgrades (Items 2356–2365): Sông Son 4-post boatman waiting shelter, 2nd boarding jetty,
  // 6th Thuyền Rồng boat, extra cave-arch uplights, channel marker buoy & UNESCO heritage milepost
  const w7PnWood: THREE.BufferGeometry[] = [];
  const w7PnStone: THREE.BufferGeometry[] = [];
  const w7PnGold: THREE.BufferGeometry[] = [];
  // 2356–2357: 4-post boatman waiting shelter (dockX + 10.0, dockZ + 3.5) & benches
  addBox(w7PnWood, 4.0, 0.22, 3.2, dockX + 10.0, 3.45, dockZ + 3.5);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w7PnWood, 0.08, 0.10, 2.95, 4, dockX + 10.0 + ox, 2.02, dockZ + 3.5 + oz);
    }
  }
  addBox(w7PnWood, 2.2, 0.45, 0.55, dockX + 10.0, 0.95, dockZ + 4.2);
  addBox(w7PnWood, 2.2, 0.45, 0.55, dockX + 10.0, 0.95, dockZ + 2.8);
  // 2358–2359: 2nd cantilevered boarding jetty & 6th moored Thuyền Rồng sightseeing boat
  addBox(w7PnWood, 3.2, 0.22, 5.4, dockX + 12.0, 0.65, dockZ - 2.5);
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-2.2, 2.2]) {
      addCyl(w7PnWood, 0.08, 0.10, 2.0, 4, dockX + 12.0 + ox, -0.25, dockZ - 2.5 + oz);
    }
  }
  addBox(w7PnWood, 1.85, 0.55, 6.0, dockX + 10.0, 0.36, dockZ - 5.2);
  addBox(w7PnGold, 1.62, 0.92, 3.8, dockX + 10.0, 1.10, dockZ - 5.2);
  // 2360–2365: 2 extra cave-arch uplights, channel buoy, riverbank steps & UNESCO milepost
  for (const [ux, uy, uz] of [[-8.5, 2.6, -4.5], [8.5, 2.5, -4.5]] as const) {
    addBox(w7PnStone, 0.52, 0.42, 0.52, cx + ux, uy, cz + uz);
    addBox(w7PnGold, 0.32, 0.32, 0.32, cx + ux, uy + 0.40, cz + uz);
  }
  addCyl(w7PnGold, 0.30, 0.34, 1.10, 4, cx + 6.5, 0.50, cz + 12.0);
  addBox(w7PnStone, 2.6, 0.52, 2.2, cx + 18.5, 0.52, cz + 24.0);
  addBox(w7PnStone, 0.65, 1.65, 0.38, dockX + 6.5, 1.35, dockZ + 5.4);
  const w7PnWoodM = new THREE.Mesh(mergeNormalized(w7PnWood), ctx.materials.darkWood);
  w7PnWoodM.castShadow = false;
  const w7PnStoneM = new THREE.Mesh(mergeNormalized(w7PnStone), ctx.materials.stone);
  w7PnStoneM.castShadow = false;
  const w7PnGoldM = new THREE.Mesh(mergeNormalized(w7PnGold), ctx.materials.gold);
  w7PnGoldM.castShadow = false;
  group.add(w7PnWoodM, w7PnStoneM, w7PnGoldM);

  // Wave 8 Upgrades (Items 2756–2765): Sông Son west 4-post ticket shelter, 3rd boarding jetty,
  // 7th Thuyền Rồng boat, extra cave-arch uplights, channel marker buoy & UNESCO heritage milepost
  const w8PnWood: THREE.BufferGeometry[] = [];
  const w8PnStone: THREE.BufferGeometry[] = [];
  const w8PnGold: THREE.BufferGeometry[] = [];
  // 2756–2757: West 4-post ticket & lifejacket shelter (dockX - 10.0, dockZ + 3.5) & benches
  addBox(w8PnWood, 4.0, 0.22, 3.2, dockX - 10.0, 3.45, dockZ + 3.5);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w8PnWood, 0.08, 0.10, 2.95, 4, dockX - 10.0 + ox, 2.02, dockZ + 3.5 + oz);
    }
  }
  addBox(w8PnWood, 2.2, 0.45, 0.55, dockX - 10.0, 0.95, dockZ + 4.2);
  addBox(w8PnWood, 2.2, 0.45, 0.55, dockX - 10.0, 0.95, dockZ + 2.8);
  // 2758–2759: 3rd cantilevered boarding jetty & 7th moored Thuyền Rồng sightseeing boat
  addBox(w8PnWood, 3.2, 0.22, 5.4, dockX - 12.0, 0.65, dockZ - 2.5);
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-2.2, 2.2]) {
      addCyl(w8PnWood, 0.08, 0.10, 2.0, 4, dockX - 12.0 + ox, -0.25, dockZ - 2.5 + oz);
    }
  }
  addBox(w8PnWood, 1.85, 0.55, 6.0, dockX - 10.0, 0.36, dockZ - 5.2);
  addBox(w8PnGold, 1.62, 0.92, 3.8, dockX - 10.0, 1.10, dockZ - 5.2);
  // 2760–2765: 2 extra cave-arch uplights, channel buoy, riverbank steps & UNESCO milepost
  for (const [ux, uy, uz] of [[-12.5, 2.6, -2.5], [12.5, 2.5, -2.5]] as const) {
    addBox(w8PnStone, 0.52, 0.42, 0.52, cx + ux, uy, cz + uz);
    addBox(w8PnGold, 0.32, 0.32, 0.32, cx + ux, uy + 0.40, cz + uz);
  }
  addCyl(w8PnGold, 0.30, 0.34, 1.10, 4, cx - 6.5, 0.50, cz + 12.0);
  addBox(w8PnStone, 2.6, 0.52, 2.2, cx - 18.5, 0.52, cz + 24.0);
  addBox(w8PnStone, 0.65, 1.65, 0.38, dockX - 6.5, 1.35, dockZ + 5.4);
  const w8PnWoodM = new THREE.Mesh(mergeNormalized(w8PnWood), ctx.materials.darkWood);
  w8PnWoodM.castShadow = false;
  const w8PnStoneM = new THREE.Mesh(mergeNormalized(w8PnStone), ctx.materials.stone);
  w8PnStoneM.castShadow = false;
  const w8PnGoldM = new THREE.Mesh(mergeNormalized(w8PnGold), ctx.materials.gold);
  w8PnGoldM.castShadow = false;
  group.add(w8PnWoodM, w8PnStoneM, w8PnGoldM);

  // Wave 9 Upgrades (Items 3156–3165): Sông Son east 4-post ticket shelter, 4th boarding jetty,
  // 8th Thuyền Rồng boat, extra cave-arch uplights, eastern channel buoy & UNESCO heritage milepost
  const w9PnWood: THREE.BufferGeometry[] = [];
  const w9PnStone: THREE.BufferGeometry[] = [];
  const w9PnGold: THREE.BufferGeometry[] = [];
  // 3156–3157: East 4-post ticket & lifejacket shelter (dockX + 10.0, dockZ + 3.5) & benches
  addBox(w9PnWood, 4.0, 0.22, 3.2, dockX + 10.0, 3.45, dockZ + 3.5);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w9PnWood, 0.08, 0.10, 2.95, 4, dockX + 10.0 + ox, 2.02, dockZ + 3.5 + oz);
    }
  }
  addBox(w9PnWood, 2.2, 0.45, 0.55, dockX + 10.0, 0.95, dockZ + 4.2);
  addBox(w9PnWood, 2.2, 0.45, 0.55, dockX + 10.0, 0.95, dockZ + 2.8);
  // 3158–3159: 4th cantilevered boarding jetty & 8th moored Thuyền Rồng sightseeing boat
  addBox(w9PnWood, 3.2, 0.22, 5.4, dockX + 12.0, 0.65, dockZ - 2.5);
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-2.2, 2.2]) {
      addCyl(w9PnWood, 0.08, 0.10, 2.0, 4, dockX + 12.0 + ox, -0.25, dockZ - 2.5 + oz);
    }
  }
  addBox(w9PnWood, 1.85, 0.55, 6.0, dockX + 10.0, 0.36, dockZ - 5.2);
  addBox(w9PnGold, 1.62, 0.92, 3.8, dockX + 10.0, 1.10, dockZ - 5.2);
  // 3160–3165: 2 extra cave-arch uplights, eastern channel buoy, riverbank steps & UNESCO milepost
  for (const [ux, uy, uz] of [[-15.5, 2.6, 1.5], [15.5, 2.5, 1.5]] as const) {
    addBox(w9PnStone, 0.52, 0.42, 0.52, cx + ux, uy, cz + uz);
    addBox(w9PnGold, 0.32, 0.32, 0.32, cx + ux, uy + 0.40, cz + uz);
  }
  addCyl(w9PnGold, 0.30, 0.34, 1.10, 4, cx + 6.5, 0.50, cz + 12.0);
  addBox(w9PnStone, 2.6, 0.52, 2.2, cx + 18.5, 0.52, cz + 24.0);
  addBox(w9PnStone, 0.65, 1.65, 0.38, dockX + 6.5, 1.35, dockZ + 5.4);
  const w9PnWoodM = new THREE.Mesh(mergeNormalized(w9PnWood), ctx.materials.darkWood);
  w9PnWoodM.castShadow = false;
  const w9PnStoneM = new THREE.Mesh(mergeNormalized(w9PnStone), ctx.materials.stone);
  w9PnStoneM.castShadow = false;
  const w9PnGoldM = new THREE.Mesh(mergeNormalized(w9PnGold), ctx.materials.gold);
  w9PnGoldM.castShadow = false;
  group.add(w9PnWoodM, w9PnStoneM, w9PnGoldM);

  // Wave 10 Upgrades (Items 3556–3565): Sông Son west 4-post ticket shelter, 5th boarding jetty,
  // 9th Thuyền Rồng boat, extra cave-arch uplights, western channel buoy & UNESCO geological stele
  const w10PnWood: THREE.BufferGeometry[] = [];
  const w10PnStone: THREE.BufferGeometry[] = [];
  const w10PnGold: THREE.BufferGeometry[] = [];
  // 3556–3557: West 4-post ticket & souvenir shelter (dockX - 11.0, dockZ + 3.5) & benches
  addBox(w10PnWood, 4.0, 0.22, 3.2, dockX - 11.0, 3.45, dockZ + 3.5);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w10PnWood, 0.08, 0.10, 2.95, 4, dockX - 11.0 + ox, 2.02, dockZ + 3.5 + oz);
    }
  }
  addBox(w10PnWood, 2.2, 0.45, 0.55, dockX - 11.0, 0.95, dockZ + 4.2);
  addBox(w10PnWood, 2.2, 0.45, 0.55, dockX - 11.0, 0.95, dockZ + 2.8);
  // 3558–3559: 5th cantilevered boarding jetty & 9th moored Thuyền Rồng sightseeing boat
  addBox(w10PnWood, 3.2, 0.22, 5.4, dockX - 12.5, 0.65, dockZ - 2.5);
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-2.2, 2.2]) {
      addCyl(w10PnWood, 0.08, 0.10, 2.0, 4, dockX - 12.5 + ox, -0.25, dockZ - 2.5 + oz);
    }
  }
  addBox(w10PnWood, 1.85, 0.55, 6.0, dockX - 10.5, 0.36, dockZ - 5.2);
  addBox(w10PnGold, 1.62, 0.92, 3.8, dockX - 10.5, 1.10, dockZ - 5.2);
  // 3560–3565: 2 extra cave-arch uplights, western channel buoy, riverbank steps & UNESCO geological stele
  for (const [ux, uy, uz] of [[-18.5, 2.6, 2.5], [18.5, 2.5, 2.5]] as const) {
    addBox(w10PnStone, 0.52, 0.42, 0.52, cx + ux, uy, cz + uz);
    addBox(w10PnGold, 0.32, 0.32, 0.32, cx + ux, uy + 0.40, cz + uz);
  }
  addCyl(w10PnGold, 0.30, 0.34, 1.10, 4, cx - 7.5, 0.50, cz + 12.0);
  addBox(w10PnStone, 2.6, 0.52, 2.2, cx - 18.5, 0.52, cz + 24.0);
  addBox(w10PnStone, 0.65, 1.65, 0.38, dockX - 7.0, 1.35, dockZ + 5.4);
  const w10PnWoodM = new THREE.Mesh(mergeNormalized(w10PnWood), ctx.materials.darkWood);
  w10PnWoodM.castShadow = false;
  const w10PnStoneM = new THREE.Mesh(mergeNormalized(w10PnStone), ctx.materials.stone);
  w10PnStoneM.castShadow = false;
  const w10PnGoldM = new THREE.Mesh(mergeNormalized(w10PnGold), ctx.materials.gold);
  w10PnGoldM.castShadow = false;
  group.add(w10PnWoodM, w10PnStoneM, w10PnGoldM);

  // Wave 11 Upgrades (Items 3956–3965): Sông Son east 4-post heritage guide shelter, 6th boarding jetty,
  // 10th Thuyền Rồng boat, extra cave-arch uplights, eastern channel buoy & UNESCO karst geology stele
  const w11PnWood: THREE.BufferGeometry[] = [];
  const w11PnStone: THREE.BufferGeometry[] = [];
  const w11PnGold: THREE.BufferGeometry[] = [];
  // 3956–3957: East 4-post heritage guide shelter (dockX + 12.5, dockZ + 3.5) & benches
  addBox(w11PnWood, 4.0, 0.22, 3.2, dockX + 12.5, 3.45, dockZ + 3.5);
  for (const ox of [-1.7, 1.7]) {
    for (const oz of [-1.3, 1.3]) {
      addCyl(w11PnWood, 0.08, 0.10, 2.95, 4, dockX + 12.5 + ox, 2.02, dockZ + 3.5 + oz);
    }
  }
  addBox(w11PnWood, 2.2, 0.45, 0.55, dockX + 12.5, 0.95, dockZ + 4.2);
  addBox(w11PnWood, 2.2, 0.45, 0.55, dockX + 12.5, 0.95, dockZ + 2.8);
  // 3958–3959: 6th cantilevered boarding jetty & 10th moored Thuyền Rồng sightseeing boat
  addBox(w11PnWood, 3.2, 0.22, 5.4, dockX + 13.5, 0.65, dockZ - 2.5);
  for (const ox of [-1.2, 1.2]) {
    for (const oz of [-2.2, 2.2]) {
      addCyl(w11PnWood, 0.08, 0.10, 2.0, 4, dockX + 13.5 + ox, -0.25, dockZ - 2.5 + oz);
    }
  }
  addBox(w11PnWood, 1.85, 0.55, 6.0, dockX + 11.5, 0.36, dockZ - 5.2);
  addBox(w11PnGold, 1.62, 0.92, 3.8, dockX + 11.5, 1.10, dockZ - 5.2);
  // 3960–3965: 2 extra cave-arch uplights, eastern channel buoy, riverbank steps & UNESCO karst geology stele
  for (const [ux, uy, uz] of [[-21.5, 2.6, 4.5], [21.5, 2.5, 4.5]] as const) {
    addBox(w11PnStone, 0.52, 0.42, 0.52, cx + ux, uy, cz + uz);
    addBox(w11PnGold, 0.32, 0.32, 0.32, cx + ux, uy + 0.40, cz + uz);
  }
  addCyl(w11PnGold, 0.30, 0.34, 1.10, 4, cx + 8.5, 0.50, cz + 13.5);
  addBox(w11PnStone, 2.6, 0.52, 2.2, cx + 19.5, 0.52, cz + 24.0);
  addBox(w11PnStone, 0.65, 1.65, 0.38, dockX + 8.5, 1.35, dockZ + 5.4);
  const w11PnWoodM = new THREE.Mesh(mergeNormalized(w11PnWood), ctx.materials.darkWood);
  w11PnWoodM.castShadow = false;
  const w11PnStoneM = new THREE.Mesh(mergeNormalized(w11PnStone), ctx.materials.stone);
  w11PnStoneM.castShadow = false;
  const w11PnGoldM = new THREE.Mesh(mergeNormalized(w11PnGold), ctx.materials.gold);
  w11PnGoldM.castShadow = false;
  group.add(w11PnWoodM, w11PnStoneM, w11PnGoldM);

  tagMotifIds(group, ['HV-NEW-MT-04', 'HV-NEW-MT-05', 'HV-NEW-MB-08', 'HV-NEW-MB-11']);
  ctx.scene.add(group);
  return group;
}

/**
 * 6. Thánh địa Mỹ Sơn (-320, -135): True 1:1 ancient Chăm Pa valley temple group:
 *    24m-tall Tower A1 Kalan + 15m & 11.5m flanking chamBrick towers, weathered sandstone
 *    lintels, central Mandapa pillar ruins & mossy jungle boulders.
 */
/**
 * 7. Tháp Chàm Poshanư (435, 95): Real Hoa Lai trio on coastal headland (y = 20m):
 *    16m Tower A, 12m Tower B, 5m Tower C (chamBrick) on stepped stone podiums.
 */
function buildPoshanuTowers(ctx: VietnamBuilderContext): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PoshanuTowerComplex';

  const cx = 435;
  const cz = 95;
  const yBase = Math.max(
    ctx.getHeight(cx, cz),
    ctx.getHeight(cx - 12, cz - 12),
    ctx.getHeight(cx + 12, cz - 12),
    ctx.getHeight(cx - 12, cz + 12),
    ctx.getHeight(cx + 12, cz + 12)
  );
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 30.0 });

  const brickParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const boulderParts: THREE.BufferGeometry[] = [];
  const blackStoneParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const blossomParts: THREE.BufferGeometry[] = [];

  // 1. Natural 2-Level Bà Nài Hill Bluff with deep retaining foundation skirt (never sinks or floats on headland!)
  addBox(stoneParts, 28.0, 7.0, 30.0, cx, yBase - 3.15, cz);
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
  // Items 185–188: Poshanư Hòa Lai sandstone Nandi offering table, Bà Nài Hill coastal sandstone cliff ledges,
  // stone heritage boundary wall, stepped laterite approach path & coastal Xương Rồng (prickly-pear cactus) clumps!
  addBox(stoneParts, 1.45, 0.55, 1.05, vx + 2.4, podiumY + 0.28, cz);
  addBox(brickParts, 14.0, 0.95, 0.55, cx, yBase + 0.45, cz + 15.2);
  addBox(stoneParts, 10.5, 0.22, 2.8, cx + 8.5, yBase + 0.12, cz);
  for (const [cxOff, czOff] of [[11.0, 10.5], [-11.5, -11.0], [12.5, -9.5]]) {
    const cactus = new THREE.CylinderGeometry(0.14, 0.18, 1.35, 6);
    cactus.translate(cx + cxOff, ctx.getHeight(cx + cxOff, cz + czOff) + 0.65, cz + czOff);
    blossomParts.push(colorizeForMerge(cactus, '#4e7a34'));
  }
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
  const poshanuBrickMat = ctx.materials.chamBrick;
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

  // Wave 2 Upgrades (Items 381–386): Po Sah Inư Katê offering altar, Cham culture pavilion,
  // Lầu Ông Hoàng ruin plinth & sea-view benches, Tam Quan brick pillars, Bàu Trúc jars & cliff walls
  const w2PsBrick: THREE.BufferGeometry[] = [];
  const w2PsStone: THREE.BufferGeometry[] = [];
  const w2PsWood: THREE.BufferGeometry[] = [];
  const w2PsCrim: THREE.BufferGeometry[] = [];
  // 381: Tower A exterior Katê festival offering altar & crimson brocade drape
  addBox(w2PsStone, 1.35, 0.72, 1.15, vx + 3.8, podiumY + 0.36, cz);
  addBox(w2PsCrim, 1.42, 0.16, 1.22, vx + 3.8, podiumY + 0.76, cz);
  // 382: Thatched Nhà Trưng Bày Văn Hóa Chăm display pavilion (cx + 13.5, cz + 8.5) with retaining skirt
  const cpY = Math.max(
    ctx.getHeight(cx + 13.5, cz + 8.5),
    ctx.getHeight(cx + 11.2, cz + 6.8),
    ctx.getHeight(cx + 15.8, cz + 10.2)
  );
  addBox(w2PsStone, 5.0, 3.2, 3.8, cx + 13.5, cpY - 1.6, cz + 8.5);
  addBox(w2PsWood, 4.6, 2.35, 3.4, cx + 13.5, cpY + 1.18, cz + 8.5);
  addCone(w2PsWood, 3.6, 1.45, 4, cx + 13.5, cpY + 3.05, cz + 8.5, 0, Math.PI * 0.25);
  // 383: Lầu Ông Hoàng coastal sandstone ruin plinth & panoramic Mui Ne benches (cx - 13.5, cz + 12.5)
  const lhY = Math.max(
    ctx.getHeight(cx - 13.5, cz + 12.5),
    ctx.getHeight(cx - 16.0, cz + 10.3),
    ctx.getHeight(cx - 11.0, cz + 14.7)
  );
  addBox(w2PsStone, 5.2, 3.6, 4.4, cx - 13.5, lhY - 0.95, cz + 12.5);
  addBox(w2PsStone, 1.85, 0.45, 0.55, cx - 13.5, lhY + 1.05, cz + 14.0);
  // 384–386: Carved brick Cổng Tam Quan pillars grounded locally, Bàu Trúc terracotta jars & cliff retaining wall
  for (const s of [-1, 1]) {
    const pilY = ctx.getHeight(cx + 14.0, cz + s * 2.2);
    addBox(w2PsBrick, 0.78, 3.7, 0.78, cx + 14.0, pilY + 1.35, cz + s * 2.2);
    addCone(w2PsBrick, 0.58, 0.68, 4, cx + 14.0, pilY + 3.55, cz + s * 2.2, 0, Math.PI * 0.25);
  }
  addCyl(w2PsBrick, 0.24, 0.18, 0.55, 6, cx + 4.5, yBase + 0.28, cz - 8.5);
  addBox(w2PsStone, 12.0, 0.72, 0.55, cx - 12.0, yBase + 0.36, cz - 14.5);

  const w2PsBrickM = new THREE.Mesh(mergeNormalized(w2PsBrick), poshanuBrickMat);
  w2PsBrickM.castShadow = false;
  const w2PsStoneM = new THREE.Mesh(mergeNormalized(w2PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w2PsStoneM.castShadow = false;
  const w2PsWoodM = new THREE.Mesh(mergeNormalized(w2PsWood), ctx.materials.darkWood);
  w2PsWoodM.castShadow = false;
  const w2PsCrimM = new THREE.Mesh(mergeNormalized(w2PsCrim), ctx.materials.crimsonLacquer);
  w2PsCrimM.castShadow = false;
  group.add(w2PsBrickM, w2PsStoneM, w2PsWoodM, w2PsCrimM);

  // Wave 3 Upgrades (Items 761–768): Po Sah Inư Hòa Lai sandstone lintel, Tower B/C steps, Katê Cây Nêu poles,
  // Bàu Trúc pottery display, Lầu Ông Hoàng ruin wall, Bà Nài Hill trail stairs, Xương Rồng rockery & Tam Quan paving
  const w3PsBrick: THREE.BufferGeometry[] = [];
  const w3PsStone: THREE.BufferGeometry[] = [];
  const w3PsWood: THREE.BufferGeometry[] = [];
  const w3PsCrim: THREE.BufferGeometry[] = [];
  // 761–763: Tower A Hòa Lai sandstone lintel, Tower B/C steps & Katê festival Cây Nêu banner poles
  addBox(w3PsStone, 0.58, 0.48, 2.4, vx + 1.6, podiumY + 3.45, cz);
  addBox(w3PsStone, 1.45, 0.42, 1.85, cx - 2.5, podiumY + 0.21, cz - 6.8);
  for (const s of [-1, 1]) {
    addCyl(w3PsWood, 0.05, 0.07, 4.6, 5, vx + 4.4, podiumY + 2.25, cz + s * 3.4);
    addBox(w3PsCrim, 0.14, 1.15, 0.42, vx + 4.4, podiumY + 3.85, cz + s * 3.4);
  }
  // 764–768: Bàu Trúc pottery stand, Lầu Ông Hoàng ruin corner wall, Bà Nài trail steps, Xương Rồng rockery & Tam Quan entry paving
  addBox(w3PsWood, 1.65, 0.78, 0.85, cx + 10.2, cpY + 0.40, cz + 8.5);
  addCyl(w3PsBrick, 0.22, 0.16, 0.48, 6, cx + 10.2, cpY + 1.02, cz + 8.5);
  addBox(w3PsStone, 2.8, 2.1, 0.55, cx - 13.5, lhY + 1.85, cz + 10.6);
  addBox(w3PsStone, 2.4, 0.32, 4.8, cx + 14.0, yBase + 0.16, cz);
  addBox(w3PsStone, 1.85, 0.65, 1.65, cx - 7.5, yBase + 0.32, cz + 10.5);
  addBox(w3PsStone, 0.72, 1.35, 0.32, cx + 15.8, yBase + 0.68, cz + 3.2);
  const w3PsBrickM = new THREE.Mesh(mergeNormalized(w3PsBrick), poshanuBrickMat);
  w3PsBrickM.castShadow = false;
  const w3PsStoneM = new THREE.Mesh(mergeNormalized(w3PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w3PsStoneM.castShadow = false;
  const w3PsWoodM = new THREE.Mesh(mergeNormalized(w3PsWood), ctx.materials.darkWood);
  w3PsWoodM.castShadow = false;
  const w3PsCrimM = new THREE.Mesh(mergeNormalized(w3PsCrim), ctx.materials.crimsonLacquer);
  w3PsCrimM.castShadow = false;
  group.add(w3PsBrickM, w3PsStoneM, w3PsWoodM, w3PsCrimM);

  // Wave 4 Upgrades (Items 1161–1166): Katê Festival Stage Terrace, Lầu Ông Hoàng brick archway,
  // Tower B/C offering tables, coastal lookout bench & Bàu Trúc pottery shelter
  const w4PsBrick: THREE.BufferGeometry[] = [];
  const w4PsStone: THREE.BufferGeometry[] = [];
  const w4PsWood: THREE.BufferGeometry[] = [];
  const w4PsCrim: THREE.BufferGeometry[] = [];
  const katX = cx + 16.5;
  const katZ = cz - 11.5;
  const katY = Math.max(ctx.getHeight(katX, katZ), ctx.getHeight(katX - 3.2, katZ - 2.6), ctx.getHeight(katX + 3.2, katZ + 2.6));
  addBox(w4PsStone, 6.8, 4.8, 5.6, katX, katY - 2.2, katZ);
  addBox(w4PsWood, 5.4, 0.20, 4.2, katX, katY + 3.05, katZ);
  for (const ox of [-2.4, 2.4]) {
    for (const oz of [-1.8, 1.8]) {
      addCyl(w4PsWood, 0.08, 0.10, 3.05, 5, katX + ox, katY + 1.55, katZ + oz);
    }
  }
  addBox(w4PsCrim, 2.2, 0.78, 0.65, katX, katY + 0.55, katZ);
  // 1163–1166: Lầu Ông Hoàng brick archway, Tower B/C tables & Bàu Trúc 4-post craft shelter
  addBox(w4PsBrick, 0.65, 2.8, 3.2, cx - 15.8, lhY + 2.2, cz + 12.5);
  addBox(w4PsStone, 1.25, 0.65, 0.95, cx + 0.8, lowerPodiumY + 0.35, cz - 8.6);
  addBox(w4PsWood, 3.6, 0.18, 3.0, cx + 13.5, cpY + 2.75, cz + 13.5);
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      addCyl(w4PsWood, 0.07, 0.08, 2.75, 5, cx + 13.5 + ox, cpY + 1.38, cz + 13.5 + oz);
    }
  }
  const w4PsBrickM = new THREE.Mesh(mergeNormalized(w4PsBrick), poshanuBrickMat);
  w4PsBrickM.castShadow = false;
  const w4PsStoneM = new THREE.Mesh(mergeNormalized(w4PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w4PsStoneM.castShadow = false;
  const w4PsWoodM = new THREE.Mesh(mergeNormalized(w4PsWood), ctx.materials.darkWood);
  w4PsWoodM.castShadow = false;
  const w4PsCrimM = new THREE.Mesh(mergeNormalized(w4PsCrim), ctx.materials.crimsonLacquer);
  w4PsCrimM.castShadow = false;
  group.add(w4PsBrickM, w4PsStoneM, w4PsWoodM, w4PsCrimM);

  // Wave 5 Upgrades (Items 1566–1575): Poshanư Coastal Headland Overlook Terrace,
  // Cham brick parapet, 4-post sun-shelter, Tower A lotus altar & Katê drum rack
  const w5PsBrick: THREE.BufferGeometry[] = [];
  const w5PsStone: THREE.BufferGeometry[] = [];
  const w5PsWood: THREE.BufferGeometry[] = [];
  const w5PsCrim: THREE.BufferGeometry[] = [];
  const coX = cx - 12.0;
  const coZ = cz - 14.5;
  const coY = Math.max(ctx.getHeight(coX, coZ), ctx.getHeight(coX - 3.6, coZ - 3.0), ctx.getHeight(coX + 3.6, coZ + 3.0));
  addBox(w5PsStone, 7.6, 6.8, 6.4, coX, coY - 3.25, coZ);
  addBox(w5PsBrick, 7.4, 0.85, 0.42, coX, coY + 0.55, coZ - 2.95);
  addBox(w5PsWood, 3.8, 0.20, 3.2, coX + 1.4, coY + 2.95, coZ + 0.6);
  for (const ox of [-0.3, 3.1]) {
    for (const oz of [-0.8, 2.0]) {
      addCyl(w5PsWood, 0.08, 0.10, 2.95, 5, coX + ox, coY + 1.48, coZ + oz);
    }
  }
  addBox(w5PsWood, 2.2, 0.46, 0.55, coX + 1.4, coY + 0.42, coZ + 0.6);
  addCyl(w5PsStone, 0.45, 0.52, 0.95, 6, coX - 2.2, coY + 0.62, coZ - 1.2);
  // 1570–1575: Tower A lotus altar, Bàu Trúc amphora pedestals, Lầu Ông Hoàng steps, Katê drum rack & plaque
  addBox(w5PsStone, 1.45, 0.72, 1.15, cx + 6.2, lowerPodiumY + 0.38, cz);
  addCyl(w5PsBrick, 0.28, 0.22, 0.68, 6, cx + 11.2, cpY + 0.42, cz + 13.5);
  addCyl(w5PsBrick, 0.28, 0.22, 0.68, 6, cx + 15.8, cpY + 0.42, cz + 13.5);
  addBox(w5PsStone, 2.4, 0.45, 3.6, cx - 13.5, lhY + 0.25, cz + 12.5);
  addCyl(w5PsCrim, 0.34, 0.34, 0.52, 6, katX + 2.2, katY + 0.72, katZ + 1.6, 0, 0, Math.PI * 0.5);
  addBox(w5PsStone, 1.05, 1.55, 0.36, cx + 11.5, lowerPodiumY + 0.78, cz - 6.2);
  const w5PsBrickM = new THREE.Mesh(mergeNormalized(w5PsBrick), poshanuBrickMat);
  w5PsBrickM.castShadow = false;
  const w5PsStoneM = new THREE.Mesh(mergeNormalized(w5PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w5PsStoneM.castShadow = false;
  const w5PsWoodM = new THREE.Mesh(mergeNormalized(w5PsWood), ctx.materials.darkWood);
  w5PsWoodM.castShadow = false;
  const w5PsCrimM = new THREE.Mesh(mergeNormalized(w5PsCrim), ctx.materials.crimsonLacquer);
  w5PsCrimM.castShadow = false;
  group.add(w5PsBrickM, w5PsStoneM, w5PsWoodM, w5PsCrimM);

  // Wave 6 Upgrades (Items 1966–1975): Poshanư SE Coastal Archaeological Ruin Terrace,
  // excavated brick wall courses, conservation shelter, Bàu Trúc kiln & Katê banner poles
  const w6PsBrick: THREE.BufferGeometry[] = [];
  const w6PsStone: THREE.BufferGeometry[] = [];
  const w6PsWood: THREE.BufferGeometry[] = [];
  const w6PsCrim: THREE.BufferGeometry[] = [];
  const seRX = cx + 16.0;
  const seRZ = cz - 12.5;
  const seRY = Math.max(ctx.getHeight(seRX, seRZ), ctx.getHeight(seRX - 3.6, seRZ - 3.0), ctx.getHeight(seRX + 3.6, seRZ + 3.0));
  addBox(w6PsStone, 7.6, 6.8, 6.4, seRX, seRY - 3.25, seRZ);
  addBox(w6PsBrick, 5.2, 0.95, 0.55, seRX - 0.6, seRY + 0.58, seRZ - 2.2);
  addBox(w6PsBrick, 0.55, 0.95, 3.6, seRX - 2.9, seRY + 0.58, seRZ - 0.6);
  addBox(w6PsStone, 1.15, 0.68, 0.55, seRX - 1.2, seRY + 0.45, seRZ + 1.2);
  addBox(w6PsStone, 1.15, 0.68, 0.55, seRX + 0.6, seRY + 0.45, seRZ + 1.2);
  addBox(w6PsWood, 3.6, 0.20, 3.0, seRX + 1.6, seRY + 2.95, seRZ - 0.4);
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-1.7, 0.9]) {
      addCyl(w6PsWood, 0.08, 0.10, 2.95, 4, seRX + ox, seRY + 1.48, seRZ + oz);
    }
  }
  addBox(w6PsWood, 2.0, 0.46, 0.54, seRX + 1.6, seRY + 0.42, seRZ + 2.2);
  // 1971–1975: Tower B altar, Bàu Trúc kiln dome, Lầu Ông Hoàng parapet & Katê banner poles
  addBox(w6PsStone, 1.35, 0.68, 1.05, cx + 6.2, lowerPodiumY + 0.36, cz + 8.5);
  addCyl(w6PsBrick, 0.85, 1.45, 1.45, 5, cx + 13.5, cpY + 0.72, cz + 16.5);
  addBox(w6PsStone, 5.2, 0.75, 0.42, cx - 15.5, lhY + 0.42, cz + 10.2);
  addCyl(w6PsCrim, 0.06, 0.08, 3.4, 4, katX - 2.6, katY + 1.72, katZ + 2.0);
  addCyl(w6PsCrim, 0.06, 0.08, 3.4, 4, katX + 2.6, katY + 1.72, katZ + 2.0);
  const w6PsBrickM = new THREE.Mesh(mergeNormalized(w6PsBrick), poshanuBrickMat);
  w6PsBrickM.castShadow = false;
  const w6PsStoneM = new THREE.Mesh(mergeNormalized(w6PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w6PsStoneM.castShadow = false;
  const w6PsWoodM = new THREE.Mesh(mergeNormalized(w6PsWood), ctx.materials.darkWood);
  w6PsWoodM.castShadow = false;
  const w6PsCrimM = new THREE.Mesh(mergeNormalized(w6PsCrim), ctx.materials.crimsonLacquer);
  w6PsCrimM.castShadow = false;
  group.add(w6PsBrickM, w6PsStoneM, w6PsWoodM, w6PsCrimM);

  // Wave 7 Upgrades (Items 2366–2375): Poshanư NW Coastal Archaeological Ruin Terrace,
  // excavated brick wall courses, conservation shelter, Tower A altar & Katê banner poles
  const w7PsBrick: THREE.BufferGeometry[] = [];
  const w7PsStone: THREE.BufferGeometry[] = [];
  const w7PsWood: THREE.BufferGeometry[] = [];
  const w7PsCrim: THREE.BufferGeometry[] = [];
  const nwRX = cx - 14.5;
  const nwRZ = cz - 12.5;
  const nwRY = Math.max(ctx.getHeight(nwRX, nwRZ), ctx.getHeight(nwRX - 3.6, nwRZ - 3.0), ctx.getHeight(nwRX + 3.6, nwRZ + 3.0));
  addBox(w7PsStone, 7.6, 6.8, 6.4, nwRX, nwRY - 3.25, nwRZ);
  addBox(w7PsBrick, 5.2, 0.95, 0.55, nwRX + 0.6, nwRY + 0.58, nwRZ - 2.2);
  addBox(w7PsBrick, 0.55, 0.95, 3.6, nwRX + 2.9, nwRY + 0.58, nwRZ - 0.6);
  addBox(w7PsStone, 1.15, 0.68, 0.55, nwRX + 1.2, nwRY + 0.45, nwRZ + 1.2);
  addBox(w7PsStone, 1.15, 0.68, 0.55, nwRX - 0.6, nwRY + 0.45, nwRZ + 1.2);
  addBox(w7PsWood, 3.6, 0.20, 3.0, nwRX - 1.6, nwRY + 2.95, nwRZ - 0.4);
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-1.7, 0.9]) {
      addCyl(w7PsWood, 0.08, 0.10, 2.95, 4, nwRX + ox, nwRY + 1.48, nwRZ + oz);
    }
  }
  addBox(w7PsWood, 2.0, 0.46, 0.54, nwRX - 1.6, nwRY + 0.42, nwRZ + 2.2);
  // 2371–2375: Tower A forecourt altar, Bàu Trúc pottery display table, Lầu Ông Hoàng bollard & Katê banner poles
  addBox(w7PsStone, 1.35, 0.68, 1.05, cx - 6.2, lowerPodiumY + 0.36, cz + 8.5);
  addBox(w7PsWood, 1.85, 0.78, 0.92, cx + 10.5, cpY + 0.45, cz + 16.5);
  addCyl(w7PsStone, 0.22, 0.28, 1.25, 4, cx - 15.5, lhY + 0.65, cz + 8.2);
  addCyl(w7PsCrim, 0.06, 0.08, 3.4, 4, katX - 4.4, katY + 1.72, katZ - 2.0);
  addCyl(w7PsCrim, 0.06, 0.08, 3.4, 4, katX + 4.4, katY + 1.72, katZ - 2.0);
  const w7PsBrickM = new THREE.Mesh(mergeNormalized(w7PsBrick), poshanuBrickMat);
  w7PsBrickM.castShadow = false;
  const w7PsStoneM = new THREE.Mesh(mergeNormalized(w7PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w7PsStoneM.castShadow = false;
  const w7PsWoodM = new THREE.Mesh(mergeNormalized(w7PsWood), ctx.materials.darkWood);
  w7PsWoodM.castShadow = false;
  const w7PsCrimM = new THREE.Mesh(mergeNormalized(w7PsCrim), ctx.materials.crimsonLacquer);
  w7PsCrimM.castShadow = false;
  group.add(w7PsBrickM, w7PsStoneM, w7PsWoodM, w7PsCrimM);

  // Wave 8 Upgrades (Items 2766–2775): Poshanư NE Coastal Archaeological Ruin Terrace,
  // excavated brick wall courses, conservation shelter, Tower B altar & Katê banner poles
  const w8PsBrick: THREE.BufferGeometry[] = [];
  const w8PsStone: THREE.BufferGeometry[] = [];
  const w8PsWood: THREE.BufferGeometry[] = [];
  const w8PsCrim: THREE.BufferGeometry[] = [];
  const neR8X = cx + 14.5;
  const neR8Z = cz - 12.5;
  const neR8Y = Math.max(ctx.getHeight(neR8X, neR8Z), ctx.getHeight(neR8X - 3.6, neR8Z - 3.0), ctx.getHeight(neR8X + 3.6, neR8Z + 3.0));
  addBox(w8PsStone, 7.6, 6.8, 6.4, neR8X, neR8Y - 3.25, neR8Z);
  addBox(w8PsBrick, 5.2, 0.95, 0.55, neR8X - 0.6, neR8Y + 0.58, neR8Z - 2.2);
  addBox(w8PsBrick, 0.55, 0.95, 3.6, neR8X - 2.9, neR8Y + 0.58, neR8Z - 0.6);
  addBox(w8PsStone, 1.15, 0.68, 0.55, neR8X - 1.2, neR8Y + 0.45, neR8Z + 1.2);
  addBox(w8PsStone, 1.15, 0.68, 0.55, neR8X + 0.6, neR8Y + 0.45, neR8Z + 1.2);
  addBox(w8PsWood, 3.6, 0.20, 3.0, neR8X + 1.6, neR8Y + 2.95, neR8Z - 0.4);
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-1.7, 0.9]) {
      addCyl(w8PsWood, 0.08, 0.10, 2.95, 4, neR8X + ox, neR8Y + 1.48, neR8Z + oz);
    }
  }
  addBox(w8PsWood, 2.0, 0.46, 0.54, neR8X + 1.6, neR8Y + 0.42, neR8Z + 2.2);
  // 2771–2775: Tower B forecourt altar, Mỹ Nghiệp brocade table, Lầu Ông Hoàng bollard & Katê banner poles
  addBox(w8PsStone, 1.35, 0.68, 1.05, cx + 6.2, lowerPodiumY + 0.36, cz + 8.5);
  addBox(w8PsWood, 1.85, 0.78, 0.92, cx - 10.5, cpY + 0.45, cz + 16.5);
  addCyl(w8PsStone, 0.22, 0.28, 1.25, 4, cx + 15.5, lhY + 0.65, cz + 8.2);
  addCyl(w8PsCrim, 0.06, 0.08, 3.4, 4, katX - 4.4, katY + 1.72, katZ + 2.0);
  addCyl(w8PsCrim, 0.06, 0.08, 3.4, 4, katX + 4.4, katY + 1.72, katZ + 2.0);
  const w8PsBrickM = new THREE.Mesh(mergeNormalized(w8PsBrick), poshanuBrickMat);
  w8PsBrickM.castShadow = false;
  const w8PsStoneM = new THREE.Mesh(mergeNormalized(w8PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w8PsStoneM.castShadow = false;
  const w8PsWoodM = new THREE.Mesh(mergeNormalized(w8PsWood), ctx.materials.darkWood);
  w8PsWoodM.castShadow = false;
  const w8PsCrimM = new THREE.Mesh(mergeNormalized(w8PsCrim), ctx.materials.crimsonLacquer);
  w8PsCrimM.castShadow = false;
  group.add(w8PsBrickM, w8PsStoneM, w8PsWoodM, w8PsCrimM);

  // Wave 9 Upgrades (Items 3166–3175): Poshanư NW Coastal Archaeological Ruin Terrace,
  // excavated brick wall courses, conservation shelter, Tower C altar & Katê banner poles
  const w9PsBrick: THREE.BufferGeometry[] = [];
  const w9PsStone: THREE.BufferGeometry[] = [];
  const w9PsWood: THREE.BufferGeometry[] = [];
  const w9PsCrim: THREE.BufferGeometry[] = [];
  const nwR9X = cx - 14.5;
  const nwR9Z = cz - 12.5;
  const nwR9Y = Math.max(ctx.getHeight(nwR9X, nwR9Z), ctx.getHeight(nwR9X - 3.6, nwR9Z - 3.0), ctx.getHeight(nwR9X + 3.6, nwR9Z + 3.0));
  addBox(w9PsStone, 7.6, 6.8, 6.4, nwR9X, nwR9Y - 3.25, nwR9Z);
  addBox(w9PsBrick, 5.2, 0.95, 0.55, nwR9X + 0.6, nwR9Y + 0.58, nwR9Z - 2.2);
  addBox(w9PsBrick, 0.55, 0.95, 3.6, nwR9X + 2.9, nwR9Y + 0.58, nwR9Z - 0.6);
  addBox(w9PsStone, 1.15, 0.68, 0.55, nwR9X + 1.2, nwR9Y + 0.45, nwR9Z + 1.2);
  addBox(w9PsStone, 1.15, 0.68, 0.55, nwR9X - 0.6, nwR9Y + 0.45, nwR9Z + 1.2);
  addBox(w9PsWood, 3.6, 0.20, 3.0, nwR9X - 1.6, nwR9Y + 2.95, nwR9Z - 0.4);
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-1.7, 0.9]) {
      addCyl(w9PsWood, 0.08, 0.10, 2.95, 4, nwR9X + ox, nwR9Y + 1.48, nwR9Z + oz);
    }
  }
  addBox(w9PsWood, 2.0, 0.46, 0.54, nwR9X - 1.6, nwR9Y + 0.42, nwR9Z + 2.2);
  // 3171–3175: Tower C forecourt altar, Mỹ Nghiệp pottery table, Lầu Ông Hoàng bollard & Katê banner poles
  addBox(w9PsStone, 1.35, 0.68, 1.05, cx - 6.2, lowerPodiumY + 0.36, cz + 8.5);
  addBox(w9PsWood, 1.85, 0.78, 0.92, cx + 10.5, cpY + 0.45, cz + 16.5);
  addCyl(w9PsStone, 0.22, 0.28, 1.25, 4, cx - 15.5, lhY + 0.65, cz + 8.2);
  addCyl(w9PsCrim, 0.06, 0.08, 3.4, 4, katX - 4.4, katY + 1.72, katZ - 2.0);
  addCyl(w9PsCrim, 0.06, 0.08, 3.4, 4, katX + 4.4, katY + 1.72, katZ - 2.0);
  const w9PsBrickM = new THREE.Mesh(mergeNormalized(w9PsBrick), poshanuBrickMat);
  w9PsBrickM.castShadow = false;
  const w9PsStoneM = new THREE.Mesh(mergeNormalized(w9PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w9PsStoneM.castShadow = false;
  const w9PsWoodM = new THREE.Mesh(mergeNormalized(w9PsWood), ctx.materials.darkWood);
  w9PsWoodM.castShadow = false;
  const w9PsCrimM = new THREE.Mesh(mergeNormalized(w9PsCrim), ctx.materials.crimsonLacquer);
  w9PsCrimM.castShadow = false;
  group.add(w9PsBrickM, w9PsStoneM, w9PsWoodM, w9PsCrimM);

  // Wave 10 Upgrades (Items 3566–3575): Poshanư NE Coastal Archaeological Ruin Terrace,
  // excavated brick wall courses, conservation shelter, Tower B altar & Katê banner poles
  const w10PsBrick: THREE.BufferGeometry[] = [];
  const w10PsStone: THREE.BufferGeometry[] = [];
  const w10PsWood: THREE.BufferGeometry[] = [];
  const w10PsCrim: THREE.BufferGeometry[] = [];
  const neR10X = cx + 15.5;
  const neR10Z = cz - 13.5;
  const neR10Y = Math.max(ctx.getHeight(neR10X, neR10Z), ctx.getHeight(neR10X - 3.6, neR10Z - 3.0), ctx.getHeight(neR10X + 3.6, neR10Z + 3.0));
  addBox(w10PsStone, 7.6, 6.8, 6.4, neR10X, neR10Y - 3.25, neR10Z);
  addBox(w10PsBrick, 5.2, 0.95, 0.55, neR10X - 0.6, neR10Y + 0.58, neR10Z - 2.2);
  addBox(w10PsBrick, 0.55, 0.95, 3.6, neR10X - 2.9, neR10Y + 0.58, neR10Z - 0.6);
  addBox(w10PsStone, 1.15, 0.68, 0.55, neR10X - 1.2, neR10Y + 0.45, neR10Z + 1.2);
  addBox(w10PsStone, 1.15, 0.68, 0.55, neR10X + 0.6, neR10Y + 0.45, neR10Z + 1.2);
  addBox(w10PsWood, 3.6, 0.20, 3.0, neR10X + 1.6, neR10Y + 2.95, neR10Z - 0.4);
  for (const ox of [0.0, 3.2]) {
    for (const oz of [-1.7, 0.9]) {
      addCyl(w10PsWood, 0.08, 0.10, 2.95, 4, neR10X + ox, neR10Y + 1.48, neR10Z + oz);
    }
  }
  addBox(w10PsWood, 2.0, 0.46, 0.54, neR10X + 1.6, neR10Y + 0.42, neR10Z + 2.2);
  // 3571–3575: Tower B forecourt altar, Chăm brocade display table, Lầu Ông Hoàng bollard & Katê banner poles
  addBox(w10PsStone, 1.35, 0.68, 1.05, cx + 6.8, lowerPodiumY + 0.36, cz + 8.5);
  addBox(w10PsWood, 1.85, 0.78, 0.92, cx - 10.5, cpY + 0.45, cz + 16.5);
  addCyl(w10PsStone, 0.22, 0.28, 1.25, 4, cx + 15.8, lhY + 0.65, cz + 8.2);
  addCyl(w10PsCrim, 0.06, 0.08, 3.4, 4, katX - 4.4, katY + 1.72, katZ + 2.4);
  addCyl(w10PsCrim, 0.06, 0.08, 3.4, 4, katX + 4.4, katY + 1.72, katZ + 2.4);
  const w10PsBrickM = new THREE.Mesh(mergeNormalized(w10PsBrick), poshanuBrickMat);
  w10PsBrickM.castShadow = false;
  const w10PsStoneM = new THREE.Mesh(mergeNormalized(w10PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w10PsStoneM.castShadow = false;
  const w10PsWoodM = new THREE.Mesh(mergeNormalized(w10PsWood), ctx.materials.darkWood);
  w10PsWoodM.castShadow = false;
  const w10PsCrimM = new THREE.Mesh(mergeNormalized(w10PsCrim), ctx.materials.crimsonLacquer);
  w10PsCrimM.castShadow = false;
  group.add(w10PsBrickM, w10PsStoneM, w10PsWoodM, w10PsCrimM);

  // Wave 11 Upgrades (Items 3966–3975): Poshanư NW Coastal Archaeological Ruin Terrace,
  // excavated brick wall courses, conservation shelter, Tower C altar & Katê banner poles
  const w11PsBrick: THREE.BufferGeometry[] = [];
  const w11PsStone: THREE.BufferGeometry[] = [];
  const w11PsWood: THREE.BufferGeometry[] = [];
  const w11PsCrim: THREE.BufferGeometry[] = [];
  const nwR11X = cx - 16.5;
  const nwR11Z = cz - 13.5;
  const nwR11Y = Math.max(ctx.getHeight(nwR11X, nwR11Z), ctx.getHeight(nwR11X - 3.6, nwR11Z - 3.0), ctx.getHeight(nwR11X + 3.6, nwR11Z + 3.0));
  addBox(w11PsStone, 7.6, 6.8, 6.4, nwR11X, nwR11Y - 3.25, nwR11Z);
  addBox(w11PsBrick, 5.2, 0.95, 0.55, nwR11X + 0.6, nwR11Y + 0.58, nwR11Z - 2.2);
  addBox(w11PsBrick, 0.55, 0.95, 3.6, nwR11X + 2.9, nwR11Y + 0.58, nwR11Z - 0.6);
  addBox(w11PsStone, 1.15, 0.68, 0.55, nwR11X + 1.2, nwR11Y + 0.45, nwR11Z + 1.2);
  addBox(w11PsStone, 1.15, 0.68, 0.55, nwR11X - 0.6, nwR11Y + 0.45, nwR11Z + 1.2);
  addBox(w11PsWood, 3.6, 0.20, 3.0, nwR11X - 1.6, nwR11Y + 2.95, nwR11Z - 0.4);
  for (const ox of [-3.2, 0.0]) {
    for (const oz of [-1.7, 0.9]) {
      addCyl(w11PsWood, 0.08, 0.10, 2.95, 4, nwR11X + ox, nwR11Y + 1.48, nwR11Z + oz);
    }
  }
  addBox(w11PsWood, 2.0, 0.46, 0.54, nwR11X - 1.6, nwR11Y + 0.42, nwR11Z + 2.2);
  // 3971–3975: Tower C forecourt altar, Chăm pottery display table, Lầu Ông Hoàng west bollard & Katê banner poles
  addBox(w11PsStone, 1.35, 0.68, 1.05, cx - 7.2, lowerPodiumY + 0.36, cz + 9.2);
  addBox(w11PsWood, 1.85, 0.78, 0.92, cx + 11.2, cpY + 0.45, cz + 16.5);
  addCyl(w11PsStone, 0.22, 0.28, 1.25, 4, cx - 16.2, lhY + 0.65, cz + 8.2);
  addCyl(w11PsCrim, 0.06, 0.08, 3.4, 4, katX - 6.2, katY + 1.72, katZ + 2.4);
  addCyl(w11PsCrim, 0.06, 0.08, 3.4, 4, katX + 6.2, katY + 1.72, katZ + 2.4);
  const w11PsBrickM = new THREE.Mesh(mergeNormalized(w11PsBrick), poshanuBrickMat);
  w11PsBrickM.castShadow = false;
  const w11PsStoneM = new THREE.Mesh(mergeNormalized(w11PsStone), ctx.materials.ochreSand ?? ctx.materials.stone);
  w11PsStoneM.castShadow = false;
  const w11PsWoodM = new THREE.Mesh(mergeNormalized(w11PsWood), ctx.materials.darkWood);
  w11PsWoodM.castShadow = false;
  const w11PsCrimM = new THREE.Mesh(mergeNormalized(w11PsCrim), ctx.materials.crimsonLacquer);
  w11PsCrimM.castShadow = false;
  group.add(w11PsBrickM, w11PsStoneM, w11PsWoodM, w11PsCrimM);

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
    addCyl(woodParts, 0.18, 0.22, 4.95, 8, px, pavY + 2.325, pz);
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
    addCyl(woodParts, 0.14, 0.16, 3.95, 7, cx + 13.8, terraceY + 1.825, cz + sz);
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
    // Keep pines clear of ALL Đà Lạt landmarks (Lâm Viên, Cathedral, Ga Đà Lạt, Hồ Đa Thiện, Crazy-House, Radar Hill, Hydrangea, K'Ho, French Villa)
    if (Math.hypot(px - (cx + 26), pz - (cz + 18)) < 16.0) continue;
    if (Math.hypot(px - (cx - 34), pz - (cz - 14)) < 14.5) continue;
    if (Math.hypot(px - (cx + 4), pz - (cz + 38)) < 15.0) continue;
    if (Math.hypot(px - (cx - 22), pz - (cz + 14)) < 11.5) continue;
    if (Math.hypot(px - (cx - 28), pz - (cz + 22)) < 10.5) continue;
    if (Math.hypot(px - (cx - 20.5), pz - (cz + 25.5)) < 9.5) continue;
    if (Math.hypot(px - (cx - 16), pz - (cz - 14)) < 10.5) continue;
    if (Math.hypot(px - (cx + 12), pz - (cz + 27.8)) < 10.5) continue;
    if (Math.hypot(px - (cx - 6), pz - (cz + 23)) < 9.5) continue;
    if (Math.hypot(px - (cx - 38), pz - (cz + 6)) < 11.0) continue;
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

  // (a) Quảng Trường Lâm Viên waterfront plaza at (cx + 26, cz + 18) with deep mountain retaining skirt
  const sqX = cx + 26.0;
  const sqZ = cz + 18.0;
  const sqY = Math.max(
    ctx.getHeight(sqX, sqZ),
    ctx.getHeight(sqX - 13.0, sqZ - 10.0),
    ctx.getHeight(sqX + 13.0, sqZ - 10.0),
    ctx.getHeight(sqX - 13.0, sqZ + 10.0),
    ctx.getHeight(sqX + 13.0, sqZ + 10.0)
  );
  addBox(stoneParts, 28.0, 8.0, 22.0, sqX, sqY - 3.7, sqZ, -0.18);
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
  const chY = Math.max(
    ctx.getHeight(chX, chZ),
    ctx.getHeight(chX - 6.0, chZ - 8.5),
    ctx.getHeight(chX + 6.0, chZ - 8.5),
    ctx.getHeight(chX - 6.0, chZ + 8.5),
    ctx.getHeight(chX + 6.0, chZ + 8.5)
  );
  const chRot = 0.38;
  const chPink = '#df8d7f';
  const chTrim = '#f6ece6';
  const chLocal: THREE.BufferGeometry[] = [];
  const chRoofLocal: THREE.BufferGeometry[] = [];
  const chGoldLocal: THREE.BufferGeometry[] = [];
  const chGlassLocal: THREE.BufferGeometry[] = [];

  // Deep stone retaining foundation plinth + nave body (8.4m wide × 6.8m high × 16.5m long)
  chLocal.push(
    colorizeForMerge(new THREE.BoxGeometry(9.4, 7.2, 17.6).translate(0, -3.2, 0), '#9a948c'),
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
  const gaY = Math.max(
    ctx.getHeight(gaX, gaZ),
    ctx.getHeight(gaX - 10.5, gaZ - 6.5),
    ctx.getHeight(gaX + 10.5, gaZ - 6.5),
    ctx.getHeight(gaX - 10.5, gaZ + 6.5),
    ctx.getHeight(gaX + 10.5, gaZ + 6.5)
  );
  addBox(stoneParts, 22.0, 8.0, 14.0, gaX, gaY - 3.7, gaZ);
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
      colorizeForMerge(new THREE.CylinderGeometry(0.07, 0.09, 3.35, 6).translate(gaX + mxPost, gaTopY + 1.525, gaZ + 4.75), '#2b3036')
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
  // P1 Đà Lạt Art Deco Stepped Relief Panels (`HV-NEW-MT-10`) mounted flush onto Ga Đà Lạt Art Deco facade (NOT floating over Hồ Đa Thiện!)
  const dalatArtDecoMesh = new THREE.Mesh(
    mergeNormalized([
      ...createArtDecoReliefParts(gaX - 5.6, gaTopY + 3.85, gaZ + 2.78, 2.2, 1.15, 0),
      ...createArtDecoReliefParts(gaX + 5.6, gaTopY + 3.85, gaZ + 2.78, 2.2, 1.15, 0)
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

  // Items 189–194 (Area Expansion): Đà Lạt Langbiang Nhà Sàn K'Ho stilt-house cultural pavilion (terrain-grounded stilts!),
  // terraced Vườn Hoa Cẩm Tú Cầu & Dã Quỳ flowerbeds, Hoa Mai Anh Đào cherry blossoms framing LANGBIANG letters,
  // Đồi Thông Ba Lá mossy trail steps & Hồ Đa Thiện wooden swan-boat pier (correctly at lakeX = cx - 22)!
  const dlExtraWood: THREE.BufferGeometry[] = [];
  // Relocated cleanly onto dry highland slope clear of Hồ Đa Thiện lake (cx-22, cz+14) & Ga Đà Lạt (cx+4, cz+38)!
  const khX = cx - 6.0;
  const khZ = cz + 23.0;
  const khY = Math.max(
    ctx.getHeight(khX, khZ),
    ctx.getHeight(khX - 2.4, khZ - 2.8),
    ctx.getHeight(khX + 2.4, khZ - 2.8),
    ctx.getHeight(khX - 2.4, khZ + 2.8),
    ctx.getHeight(khX + 2.4, khZ + 2.8)
  );
  for (const ox of [-2.4, 2.4]) {
    for (const oz of [-2.8, 2.8]) {
      const gy = ctx.getHeight(khX + ox, khZ + oz) - 0.5;
      const sh = Math.max(2.0, khY + 2.2 - gy);
      dlExtraWood.push(new THREE.CylinderGeometry(0.14, 0.16, sh, 6).translate(khX + ox, gy + sh * 0.5, khZ + oz));
    }
  }
  const dtPierX = lakeX + 5.8;
  const dtPierZ = lakeZ;
  dlExtraWood.push(
    new THREE.BoxGeometry(6.2, 0.24, 7.2).translate(khX, khY + 2.2, khZ),
    new THREE.BoxGeometry(5.2, 2.4, 6.0).translate(khX, khY + 3.4, khZ),
    // Hồ Đa Thiện wooden swan-boat pier seated cleanly on lake shore
    new THREE.BoxGeometry(5.2, 0.24, 2.2).translate(dtPierX, lakeY + 0.42, dtPierZ)
  );
  for (const pxOff of [-2.2, 0, 2.2]) {
    for (const pzOff of [-0.98, 0.98]) {
      dlExtraWood.push(new THREE.CylinderGeometry(0.08, 0.10, 2.2, 5).translate(dtPierX + pxOff, lakeY + 0.30, dtPierZ + pzOff));
    }
  }
  // Mossy wooden trail steps descending toward Thung Lũng Tình Yêu
  for (let st = 0; st < 6; st++) {
    dlExtraWood.push(new THREE.BoxGeometry(2.2, 0.18, 0.65).translate(cx + 15.5 + st * 0.9, terraceY - 0.35 - st * 0.22, cz));
  }
  const dlExtraWoodMesh = new THREE.Mesh(mergeNormalized(dlExtraWood), ctx.materials.darkWood);
  dlExtraWoodMesh.castShadow = false;
  group.add(dlExtraWoodMesh);

  // Terraced Vườn Hoa Cẩm Tú Cầu (hydrangea blue/purple) & Dã Quỳ (yellow) + Hoa Mai Anh Đào cherry blossoms
  const dlExtraFlower: THREE.BufferGeometry[] = [];
  const flowerCols = ['#5c88da', '#8e6bd6', '#f2c12e', '#f78fb3'];
  for (let fi = 0; fi < 12; fi++) {
    const fx = cx - 10.0 + (fi % 6) * 4.2;
    const fz = cz - 14.5 - Math.floor(fi / 6) * 3.5;
    const fy = ctx.getHeight(fx, fz);
    dlExtraFlower.push(
      colorizeForMerge(new THREE.SphereGeometry(0.72, 6, 5).scale(1.5, 0.65, 1.2).translate(fx, fy + 0.35, fz), flowerCols[fi % 4])
    );
  }
  const dlExtraFlowerMesh = new THREE.Mesh(mergeNormalized(dlExtraFlower), flowerMat);
  dlExtraFlowerMesh.castShadow = false;
  group.add(dlExtraFlowerMesh);

  // Wave 2 Upgrades (Items 387–396): 3 Đà Lạt Flower Greenhouses with grow troughs, Extended Wooden
  // Railway Trestle Track, Ga Đà Lạt Steam Water-Tower & Luggage Trolley, Nhà Sàn K'Ho Roof,
  // Hồ Đa Thiện Pier Railings, Lâm Viên Flower Carts, Cathedral Grotto & Langbiang Milestone
  const w2DlGlass: THREE.BufferGeometry[] = [];
  const w2DlWood: THREE.BufferGeometry[] = [];
  const w2DlStone: THREE.BufferGeometry[] = [];
  const w2DlArch: THREE.BufferGeometry[] = [];
  // 387–388 (Area Expansion): 3 arched-roof Đà Lạt translucent flower & strawberry greenhouses east of Ga Đà Lạt (clear NORTH of railway trestle trackZ = gaZ + 5.8!)
  for (let gh = 0; gh < 3; gh++) {
    const gx = gaX + 16.5;
    const gz = gaZ - 12.5 + gh * 6.5;
    const gy = Math.max(
      ctx.getHeight(gx, gz),
      ctx.getHeight(gx - 4.2, gz - 2.2),
      ctx.getHeight(gx + 4.2, gz - 2.2),
      ctx.getHeight(gx - 4.2, gz + 2.2),
      ctx.getHeight(gx + 4.2, gz + 2.2)
    );
    w2DlStone.push(new THREE.BoxGeometry(8.8, 4.4, 4.8).translate(gx, gy - 2.2, gz));
    w2DlGlass.push(
      colorizeForMerge(new THREE.BoxGeometry(8.4, 2.2, 4.4).translate(gx, gy + 1.1, gz), '#d8eef2'),
      colorizeForMerge(new THREE.CylinderGeometry(2.2, 2.2, 8.4, 6, 1, false, 0, Math.PI).rotateZ(Math.PI * 0.5).translate(gx, gy + 2.2, gz), '#e4f6fa')
    );
    // Interior raised strawberry/hydrangea troughs & warm grow-lamp bar
    w2DlWood.push(
      new THREE.BoxGeometry(7.2, 0.58, 0.95).translate(gx, gy + 0.35, gz - 1.1),
      new THREE.BoxGeometry(7.2, 0.58, 0.95).translate(gx, gy + 0.35, gz + 1.1)
    );
    w2DlArch.push(colorizeForMerge(new THREE.BoxGeometry(7.0, 0.12, 0.14).translate(gx, gy + 2.85, gz), '#ffda66'));
  }
  // 389 (Area Expansion): Extended timber-trestle wooden railway track east of Ga Đà Lạt (grounded piers & handrail posts!)
  w2DlWood.push(
    new THREE.BoxGeometry(14.0, 0.24, 2.2).translate(gaX + 18.0, gaTopY + 0.12, trackZ),
    new THREE.BoxGeometry(14.0, 0.10, 0.10).translate(gaX + 18.0, gaTopY + 0.95, trackZ - 1.05),
    new THREE.BoxGeometry(14.0, 0.10, 0.10).translate(gaX + 18.0, gaTopY + 0.95, trackZ + 1.05)
  );
  for (let tr = 0; tr < 4; tr++) {
    const tx = gaX + 13.0 + tr * 3.4;
    const tGy = ctx.getHeight(tx, trackZ) - 0.5;
    const pierH = Math.max(2.0, gaTopY - tGy);
    w2DlWood.push(
      new THREE.CylinderGeometry(0.14, 0.16, pierH, 5).translate(tx, tGy + pierH * 0.5, trackZ),
      new THREE.CylinderGeometry(0.05, 0.06, 0.92, 5).translate(tx, gaTopY + 0.52, trackZ - 1.05),
      new THREE.CylinderGeometry(0.05, 0.06, 0.92, 5).translate(tx, gaTopY + 0.52, trackZ + 1.05)
    );
  }
  // 390–391: Ga Đà Lạt steam water-tower tank & platform luggage trolley
  w2DlWood.push(
    new THREE.CylinderGeometry(0.14, 0.16, 3.8, 5).translate(gaX - 11.5, gaTopY + 1.9, trackZ - 3.5),
    new THREE.CylinderGeometry(1.15, 1.15, 1.85, 6).translate(gaX - 11.5, gaTopY + 4.45, trackZ - 3.5),
    new THREE.BoxGeometry(1.35, 0.55, 0.78).translate(gaX + 1.8, gaTopY + 0.45, gaZ + 3.8)
  );
  // 392–393: Nhà Sàn K'Ho pitched roof & notched ladder + Hồ Đa Thiện pier handrails
  w2DlWood.push(
    new THREE.ConeGeometry(4.6, 2.6, 4).rotateY(Math.PI * 0.25).translate(khX, khY + 5.85, khZ),
    new THREE.BoxGeometry(0.55, 2.4, 0.14).rotateZ(0.45).translate(khX + 3.4, khY + 1.15, khZ),
    new THREE.BoxGeometry(5.2, 0.10, 0.10).translate(dtPierX, lakeY + 1.38, dtPierZ - 0.98),
    new THREE.BoxGeometry(5.2, 0.10, 0.10).translate(dtPierX, lakeY + 1.38, dtPierZ + 0.98)
  );
  // 394–396: Lâm Viên flower-cart kiosk (with 4 canopy posts!), Nhà Thờ Con Gà stone grotto shrine & Langbiang hitching post (with 2 grounded legs!)
  w2DlArch.push(
    colorizeForMerge(new THREE.BoxGeometry(1.85, 0.95, 1.05).translate(sqX - 10.2, sqTopY + 0.55, sqZ + 2.5), '#d9534f'),
    colorizeForMerge(new THREE.BoxGeometry(1.95, 0.14, 1.25).translate(sqX - 10.2, sqTopY + 2.05, sqZ + 2.5), '#f4c526')
  );
  for (const cxO of [-0.85, 0.85]) {
    for (const czO of [-0.48, 0.48]) {
      w2DlWood.push(new THREE.CylinderGeometry(0.04, 0.045, 1.15, 5).translate(sqX - 10.2 + cxO, sqTopY + 1.50, sqZ + 2.5 + czO));
    }
  }
  w2DlStone.push(
    new THREE.ConeGeometry(1.65, 2.4, 5).translate(chX + 7.5, ctx.getHeight(chX + 7.5, chZ + 4.5) + 1.2, chZ + 4.5),
    new THREE.BoxGeometry(0.65, 1.45, 0.28).translate(cx + 12.2, terraceY + 0.72, cz - 7.5)
  );
  const hpY = ctx.getHeight(cx + 18.5, cz - 5.0);
  w2DlWood.push(
    new THREE.BoxGeometry(2.6, 0.12, 0.12).translate(cx + 18.5, hpY + 1.05, cz - 5.0),
    new THREE.CylinderGeometry(0.07, 0.08, 1.30, 5).translate(cx + 17.3, hpY + 0.45, cz - 5.0),
    new THREE.CylinderGeometry(0.07, 0.08, 1.30, 5).translate(cx + 19.7, hpY + 0.45, cz - 5.0)
  );

  const w2DlGlassM = new THREE.Mesh(mergeNormalized(w2DlGlass), dalatGlassMat);
  w2DlGlassM.castShadow = false;
  const w2DlWoodM = new THREE.Mesh(mergeNormalized(w2DlWood), ctx.materials.darkWood);
  w2DlWoodM.castShadow = false;
  const w2DlStoneM = new THREE.Mesh(mergeNormalized(w2DlStone), ctx.materials.stone);
  w2DlStoneM.castShadow = false;
  const w2DlArchM = new THREE.Mesh(mergeNormalized(w2DlArch), flowerMat);
  w2DlArchM.castShadow = false;
  group.add(w2DlGlassM, w2DlWoodM, w2DlStoneM, w2DlArchM);

  // Wave 3 Upgrades (Items 777–800): Đà Lạt Crazy-House Organic Pine Villas & Sky-Bridge,
  // Langbiang Radar Hill 1,929m Radome Bastion, Stepped Hydrangea Terraces, Ga Đà Lạt Semaphore & Lake Pergola
  const w3DlWood: THREE.BufferGeometry[] = [];
  const w3DlStone: THREE.BufferGeometry[] = [];
  const w3DlFlower: THREE.BufferGeometry[] = [];
  const w3DlPlaster: THREE.BufferGeometry[] = [];
  const w3DlGold: THREE.BufferGeometry[] = [];

  // 777–781: Crazy-House-inspired whimsical organic pine villas 1 & 2 linked by curved timber sky-bridge (cx - 28, cz + 22)
  const ch1X = cx - 28.0;
  const ch1Z = cz + 22.0;
  const ch1Y = Math.max(
    ctx.getHeight(ch1X, ch1Z),
    ctx.getHeight(ch1X - 3.2, ch1Z - 3.2),
    ctx.getHeight(ch1X + 3.2, ch1Z + 3.2)
  );
  const ch2X = cx - 20.5;
  const ch2Z = cz + 25.5;
  const ch2Y = Math.max(
    ctx.getHeight(ch2X, ch2Z),
    ctx.getHeight(ch2X - 2.6, ch2Z - 2.6),
    ctx.getHeight(ch2X + 2.6, ch2Z + 2.6)
  );
  // 777–778: Villa 1 deep retaining skirt (-3.2m), gnarled-bark cylindrical turret, tilted conical roof & round window frames
  w3DlStone.push(new THREE.BoxGeometry(6.8, 6.4, 6.8).translate(ch1X, ch1Y - 3.0, ch1Z));
  w3DlWood.push(
    new THREE.CylinderGeometry(2.15, 2.65, 5.2, 6).translate(ch1X, ch1Y + 2.6, ch1Z),
    new THREE.ConeGeometry(2.95, 3.4, 6).rotateZ(0.14).translate(ch1X + 0.18, ch1Y + 6.75, ch1Z)
  );
  w3DlGold.push(new THREE.CylinderGeometry(0.58, 0.58, 0.24, 6).rotateZ(Math.PI * 0.5).translate(ch1X + 2.35, ch1Y + 3.2, ch1Z));
  // 779–781: Villa 2 companion organic treehouse, elevated timber sky-bridge with grounded piers & stone mushroom stools
  const sbX = (ch1X + ch2X) * 0.5;
  const sbZ = (ch1Z + ch2Z) * 0.5;
  const sbTopY = Math.max(ch1Y, ch2Y) + 2.45;
  const sbGroundY = ctx.getHeight(sbX, sbZ) - 1.2;
  const sbPierH = Math.max(3.6, sbTopY - sbGroundY);
  w3DlStone.push(new THREE.BoxGeometry(5.4, 6.0, 5.4).translate(ch2X, ch2Y - 2.8, ch2Z));
  w3DlWood.push(
    new THREE.CylinderGeometry(1.75, 2.15, 4.4, 6).translate(ch2X, ch2Y + 2.2, ch2Z),
    new THREE.ConeGeometry(2.45, 2.8, 6).rotateZ(-0.12).translate(ch2X - 0.14, ch2Y + 5.65, ch2Z),
    // Elevated sky-bridge & deeply grounded mid-span support pier
    new THREE.BoxGeometry(8.4, 0.26, 1.45).rotateY(-0.42).translate(sbX, sbTopY, sbZ),
    new THREE.CylinderGeometry(0.18, 0.24, sbPierH, 5).translate(sbX, sbGroundY + sbPierH * 0.5, sbZ)
  );
  w3DlStone.push(
    new THREE.CylinderGeometry(0.45, 0.18, 0.58, 6).translate(ch1X + 3.6, ch1Y + 0.32, ch1Z - 2.4),
    new THREE.CylinderGeometry(0.45, 0.18, 0.58, 6).translate(ch1X + 4.8, ch1Y + 0.32, ch1Z - 1.6)
  );

  // 782–786: Đỉnh Radar Langbiang 1,929m octagonal concrete bastion, white radome cupola, steel antenna mast & viewing deck (cx - 16, cz - 14)
  const rdX = cx - 16.0;
  const rdZ = cz - 14.0;
  const rdY = Math.max(
    ctx.getHeight(rdX, rdZ),
    ctx.getHeight(rdX - 4.2, rdZ - 4.2),
    ctx.getHeight(rdX + 4.2, rdZ + 4.2),
    ctx.getHeight(rdX - 4.2, rdZ + 4.2),
    ctx.getHeight(rdX + 4.2, rdZ - 4.2)
  );
  w3DlStone.push(
    new THREE.CylinderGeometry(4.6, 5.0, 7.2, 6).translate(rdX, rdY - 3.3, rdZ),
    new THREE.CylinderGeometry(3.4, 3.6, 2.2, 6).translate(rdX, rdY + 1.35, rdZ),
    // 786: Stepped stone summit trail linking to overlook terrace
    new THREE.BoxGeometry(2.6, 0.45, 5.4).translate(rdX + 4.2, rdY - 0.15, rdZ + 4.2)
  );
  // 783: Iconic white cylindrical/geodesic radome cupola seated flush atop bastion
  w3DlPlaster.push(
    new THREE.CylinderGeometry(2.35, 2.55, 2.15, 6).translate(rdX, rdY + 3.45, rdZ),
    new THREE.ConeGeometry(2.35, 1.35, 6).translate(rdX, rdY + 5.15, rdZ)
  );
  // 784–785: Tall steel radar lattice antenna mast, twin parabolic dishes, timber viewing deck & brass elevation plaque
  w3DlGold.push(
    new THREE.CylinderGeometry(0.10, 0.24, 9.2, 5).translate(rdX - 3.2, rdY + 4.85, rdZ - 2.6),
    new THREE.CylinderGeometry(0.85, 0.18, 0.35, 6).rotateZ(Math.PI * 0.45).translate(rdX - 2.6, rdY + 7.2, rdZ - 2.6),
    new THREE.BoxGeometry(0.95, 0.55, 0.12).translate(rdX + 4.2, rdY + 1.35, rdZ)
  );
  w3DlWood.push(
    new THREE.BoxGeometry(3.4, 0.24, 5.2).translate(rdX + 4.4, rdY + 0.35, rdZ),
    new THREE.BoxGeometry(0.10, 0.95, 5.2).translate(rdX + 6.0, rdY + 0.88, rdZ)
  );

  // 787–790: 3 stepped stone-retained Vườn Hoa Cẩm Tú Cầu (Hydrangea) terraces, multi-tone blossoms, white photo arch & Hoa Dã Quỳ borders (cx + 12, cz + 26)
  const hyColors = ['#5fa8e6', '#8a7be0', '#e37ba8'];
  for (let tr = 0; tr < 3; tr++) {
    const tx = cx + 12.0;
    const tz = cz + 24.0 + tr * 3.8;
    const ty = Math.max(ctx.getHeight(tx, tz), ctx.getHeight(tx - 4.5, tz), ctx.getHeight(tx + 4.5, tz));
    w3DlStone.push(new THREE.BoxGeometry(9.6, 3.2, 3.2).translate(tx, ty - 1.4, tz));
    for (let fl = 0; fl < 5; fl++) {
      w3DlFlower.push(
        colorizeForMerge(new THREE.ConeGeometry(0.72, 0.65, 5).translate(tx - 3.6 + fl * 1.8, ty + 0.48, tz), hyColors[(tr + fl) % 3])
      );
    }
  }
  // 789: White photo-frame arch & stairs on hydrangea terrace
  const hyArchY = ctx.getHeight(cx + 12.0, cz + 27.8);
  w3DlPlaster.push(
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(cx + 10.6, hyArchY + 1.4, cz + 27.8),
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(cx + 13.4, hyArchY + 1.4, cz + 27.8),
    new THREE.BoxGeometry(3.1, 0.28, 0.28).translate(cx + 12.0, hyArchY + 2.85, cz + 27.8)
  );
  // 790: Hoa Dã Quỳ wild sunflower borders flanking Jeep apron
  for (let dq = 0; dq < 4; dq++) {
    const dqz = cz - 9.0 + dq * 2.2;
    w3DlFlower.push(
      colorizeForMerge(new THREE.ConeGeometry(0.55, 0.58, 5).translate(cx + 16.5, ctx.getHeight(cx + 16.5, dqz) + 0.35, dqz), '#f5c71a')
    );
  }

  // 791–800: Ga Đà Lạt semaphore signal & platform benches, greenhouse cisterns, Hồ Đa Thiện 4-post pergola & swan boat,
  // Lâm Viên artichoke lamps, Nhà Thờ Con Gà steps, Nhà Sàn K'Ho gong rack, K'Lang & H'Biang floral ring & pine clusters
  const dtPergX = lakeX + 5.8;
  const dtPergZ = lakeZ - 5.2;
  const dtPergY = Math.max(
    ctx.getHeight(dtPergX, dtPergZ),
    ctx.getHeight(dtPergX - 1.8, dtPergZ - 1.5),
    ctx.getHeight(dtPergX + 1.8, dtPergZ + 1.5)
  );
  w3DlStone.push(new THREE.BoxGeometry(4.4, 3.6, 3.6).translate(dtPergX, dtPergY - 1.7, dtPergZ));
  w3DlWood.push(
    // 791–792: Ga Đà Lạt semaphore signal post & platform benches
    new THREE.CylinderGeometry(0.08, 0.10, 4.6, 5).translate(gaX + 11.2, gaTopY + 2.3, trackZ - 1.8),
    new THREE.BoxGeometry(1.85, 0.45, 0.55).translate(gaX - 3.5, gaTopY + 0.35, gaZ + 4.2),
    new THREE.BoxGeometry(1.85, 0.45, 0.55).translate(gaX + 4.5, gaTopY + 0.35, gaZ + 4.2),
    // 793: Greenhouse rainwater cistern barrels
    new THREE.CylinderGeometry(0.42, 0.42, 1.15, 6).translate(gaX + 11.6, ctx.getHeight(gaX + 11.6, gaZ) + 0.58, gaZ),
    // 794: Hồ Đa Thiện lakeside 4-post timber pine pergola (seated cleanly on Hồ Đa Thiện shore at lakeX + 5.8, lakeZ - 5.2!)
    new THREE.BoxGeometry(4.2, 0.18, 3.4).translate(dtPergX, dtPergY + 2.85, dtPergZ),
    new THREE.CylinderGeometry(0.09, 0.11, 2.95, 5).translate(dtPergX - 1.8, dtPergY + 1.40, dtPergZ - 1.5),
    new THREE.CylinderGeometry(0.09, 0.11, 2.95, 5).translate(dtPergX + 1.8, dtPergY + 1.40, dtPergZ - 1.5),
    new THREE.CylinderGeometry(0.09, 0.11, 2.95, 5).translate(dtPergX - 1.8, dtPergY + 1.40, dtPergZ + 1.5),
    new THREE.CylinderGeometry(0.09, 0.11, 2.95, 5).translate(dtPergX + 1.8, dtPergY + 1.40, dtPergZ + 1.5),
    // 797–799: Nhà Thờ Con Gà benches, Nhà Sàn K'Ho outdoor gong rack & K'Lang/H'Biang totem posts
    new THREE.BoxGeometry(1.85, 0.45, 0.55).translate(chX + 5.2, ctx.getHeight(chX + 5.2, chZ + 6.5) + 0.25, chZ + 6.5),
    new THREE.CylinderGeometry(0.06, 0.07, 2.25, 5).translate(khX + 5.2, khY + 0.72, khZ - 1.2),
    new THREE.CylinderGeometry(0.06, 0.07, 2.25, 5).translate(khX + 5.2, khY + 0.72, khZ + 1.2),
    new THREE.BoxGeometry(0.08, 0.08, 2.6).translate(khX + 5.2, khY + 1.80, khZ)
  );
  // 791 semaphore blade, 795 white swan-boat silhouette on Hồ Đa Thiện, 796 Lâm Viên artichoke lamps & 798 K'Ho bronze gongs
  w3DlGold.push(
    new THREE.BoxGeometry(1.15, 0.24, 0.08).rotateZ(0.28).translate(gaX + 11.7, gaTopY + 4.25, trackZ - 1.8),
    new THREE.CylinderGeometry(0.28, 0.28, 0.06, 6).rotateZ(Math.PI * 0.5).translate(khX + 5.2, khY + 1.35, khZ - 0.55),
    new THREE.CylinderGeometry(0.28, 0.28, 0.06, 6).rotateZ(Math.PI * 0.5).translate(khX + 5.2, khY + 1.35, khZ + 0.55)
  );
  w3DlPlaster.push(
    new THREE.BoxGeometry(2.2, 0.58, 1.15).translate(dtPierX + 1.8, lakeY + 0.35, dtPierZ + 2.4),
    new THREE.CylinderGeometry(0.14, 0.22, 1.15, 5).translate(dtPierX + 2.6, lakeY + 0.95, dtPierZ + 2.4)
  );
  for (const s of [-1, 1]) {
    w3DlWood.push(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 5).translate(sqX + s * 8.5, sqTopY + 1.6, sqZ + 6.5));
    w3DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(0.45, 0.65, 5).translate(sqX + s * 8.5, sqTopY + 3.45, sqZ + 6.5), '#3ea862'));
  }
  // 800: Expanded Đồi Thông Ba Lá highland pine clusters framing Crazy-House villas & Radar Hill (deeply rooted -1.2m & >= 3.5m clear!)
  for (const [px, pz] of [[ch1X - 7.5, ch1Z - 4.5], [rdX - 8.5, rdZ + 4.5], [rdX + 8.5, rdZ - 6.5]] as const) {
    const py = ctx.getHeight(px, pz);
    w3DlWood.push(new THREE.CylinderGeometry(0.18, 0.26, 5.8, 5).translate(px, py + 1.8, pz));
    w3DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.4, 5.4, 5).translate(px, py + 6.2, pz), '#1d4f26'));
  }

  const w3DlWoodM = new THREE.Mesh(mergeNormalized(w3DlWood), ctx.materials.darkWood);
  w3DlWoodM.castShadow = false;
  const w3DlStoneM = new THREE.Mesh(mergeNormalized(w3DlStone), ctx.materials.stone);
  w3DlStoneM.castShadow = false;
  const w3DlFlowerM = new THREE.Mesh(mergeNormalized(w3DlFlower), flowerMat);
  w3DlFlowerM.castShadow = false;
  const w3DlPlasterM = new THREE.Mesh(mergeNormalized(w3DlPlaster), ctx.materials.whitePlaster);
  w3DlPlasterM.castShadow = false;
  const w3DlGoldM = new THREE.Mesh(mergeNormalized(w3DlGold), ctx.materials.gold);
  w3DlGoldM.castShadow = false;
  group.add(w3DlWoodM, w3DlStoneM, w3DlFlowerM, w3DlPlasterM, w3DlGoldM);

  // Wave 4 Upgrades (Items 1175–1200): French Colonial Pine Villa, Đồi Chè Cầu Đất Tea Sky-Deck
  // & Windmill, 4th Rose Greenhouse, Ga Đà Lạt 2nd Carriage, Stairway to Heaven & Đà Lạt Horse Carriage
  const w4DlWood: THREE.BufferGeometry[] = [];
  const w4DlStone: THREE.BufferGeometry[] = [];
  const w4DlFlower: THREE.BufferGeometry[] = [];
  const w4DlPlaster: THREE.BufferGeometry[] = [];
  const w4DlGold: THREE.BufferGeometry[] = [];
  const w4DlGlass: THREE.BufferGeometry[] = [];

  // 1175–1178: Biệt Thự Pháp Cổ Đà Lạt (French Colonial Pine Villa at cx - 38.0, cz + 6.0)
  const fvDlX = cx - 38.0;
  const fvDlZ = cz + 6.0;
  const fvDlY = Math.max(ctx.getHeight(fvDlX, fvDlZ), ctx.getHeight(fvDlX - 4.5, fvDlZ - 4.0), ctx.getHeight(fvDlX + 4.5, fvDlZ + 4.0));
  w4DlStone.push(new THREE.BoxGeometry(9.2, 6.8, 8.2).translate(fvDlX, fvDlY - 3.2, fvDlZ));
  w4DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(7.2, 5.4, 6.2).translate(fvDlX - 0.5, fvDlY + 2.85, fvDlZ), '#e6b85c'),
    colorizeForMerge(new THREE.ConeGeometry(5.6, 2.8, 4).rotateY(Math.PI * 0.25).translate(fvDlX - 0.5, fvDlY + 6.90, fvDlZ), '#b8422a')
  );
  w4DlPlaster.push(new THREE.BoxGeometry(0.95, 7.6, 0.95).translate(fvDlX - 3.6, fvDlY + 4.0, fvDlZ - 2.2));
  w4DlWood.push(new THREE.BoxGeometry(2.2, 0.22, 6.0).translate(fvDlX + 3.8, fvDlY + 3.25, fvDlZ));
  for (const pzO of [-2.6, -0.85, 0.85, 2.6]) {
    w4DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.25, 5).translate(fvDlX + 4.6, fvDlY + 1.65, fvDlZ + pzO));
  }

  // 1179–1181: Đồi Chè Cầu Đất (Cầu Đất Tea-Hill Wooden Sky-Deck, tea rows & iconic windmill at cx + 34.0, cz - 8.0)
  const cdX = cx + 34.0;
  const cdZ = cz - 8.0;
  const cdY = Math.max(ctx.getHeight(cdX, cdZ), ctx.getHeight(cdX - 5.0, cdZ - 4.0), ctx.getHeight(cdX + 5.0, cdZ + 4.0));
  w4DlStone.push(new THREE.BoxGeometry(9.6, 6.2, 7.6).translate(cdX, cdY - 2.9, cdZ));
  w4DlWood.push(
    new THREE.BoxGeometry(10.0, 0.26, 8.0).translate(cdX, cdY + 0.25, cdZ),
    new THREE.BoxGeometry(10.0, 0.10, 0.10).translate(cdX, cdY + 1.25, cdZ + 3.8),
    new THREE.BoxGeometry(3.6, 0.18, 3.2).translate(cdX - 2.2, cdY + 3.05, cdZ - 1.2)
  );
  for (const ox of [-3.8, -0.6]) {
    for (const oz of [-2.6, 0.2]) {
      w4DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.0, 5).translate(cdX + ox, cdY + 1.55, cdZ + oz));
    }
  }
  for (let tr = 0; tr < 4; tr++) {
    w4DlFlower.push(
      colorizeForMerge(new THREE.BoxGeometry(8.5, 0.65, 0.95).translate(cdX, cdY + 0.45, cdZ - 5.5 - tr * 1.8), '#2d7430')
    );
  }
  // 1181: Iconic white-and-gold highland wind-turbine / windmill tower
  w4DlPlaster.push(new THREE.CylinderGeometry(0.24, 0.48, 12.5, 6).translate(cdX + 4.2, cdY + 6.4, cdZ - 3.2));
  for (let bl = 0; bl < 3; bl++) {
    w4DlGold.push(new THREE.BoxGeometry(0.32, 4.2, 0.10).rotateZ((bl * Math.PI * 2) / 3).translate(cdX + 4.2, cdY + 12.6, cdZ - 2.8));
  }

  // 1182–1185: 4th Rose Greenhouse, Ga Đà Lạt switch-house, 2nd mahogany carriage & clock post
  const gh4X = gaX + 26.5;
  const gh4Z = gaZ - 6.0;
  const gh4Y = Math.max(ctx.getHeight(gh4X, gh4Z), ctx.getHeight(gh4X - 4.2, gh4Z - 2.2), ctx.getHeight(gh4X + 4.2, gh4Z + 2.2));
  w4DlStone.push(new THREE.BoxGeometry(8.8, 4.4, 4.8).translate(gh4X, gh4Y - 2.2, gh4Z));
  w4DlGlass.push(
    colorizeForMerge(new THREE.BoxGeometry(8.4, 2.2, 4.4).translate(gh4X, gh4Y + 1.1, gh4Z), '#f5d8e2'),
    colorizeForMerge(new THREE.CylinderGeometry(2.2, 2.2, 8.4, 6, 1, false, 0, Math.PI).rotateZ(Math.PI * 0.5).translate(gh4X, gh4Y + 2.2, gh4Z), '#fae6ee')
  );
  w4DlWood.push(
    new THREE.BoxGeometry(2.6, 2.4, 2.2).translate(gaX + 12.5, gaTopY + 1.2, trackZ + 3.2),
    new THREE.ConeGeometry(2.1, 1.05, 4).rotateY(Math.PI * 0.25).translate(gaX + 12.5, gaTopY + 2.88, trackZ + 3.2),
    new THREE.BoxGeometry(7.0, 2.35, 2.25).translate(gaX + 16.5, gaTopY + 1.45, trackZ)
  );

  // 1186–1200: Lâm Viên boardwalk, Crazy-House mushroom gazebo, Hồ Đa Thiện ticket booth & heart raft,
  // K'Ho Cây Nêu, Stairway to Heaven photo prop, Đà Lạt horse carriage & outer pines
  w4DlWood.push(
    new THREE.BoxGeometry(8.2, 0.24, 3.2).translate(sqX + 12.5, sqTopY + 0.15, sqZ - 9.5),
    // 1191: Crazy-House mushroom gazebo
    new THREE.CylinderGeometry(0.09, 0.11, 2.8, 5).translate(ch2X + 4.5, ch2Y + 1.4, ch2Z),
    // 1194: Hồ Đa Thiện pedalo ticket booth (4 grounded posts + roof)
    new THREE.BoxGeometry(2.6, 0.18, 2.2).translate(dtPierX + 1.8, lakeY + 2.65, dtPierZ - 2.4),
    new THREE.CylinderGeometry(0.06, 0.08, 2.75, 5).translate(dtPierX + 0.65, lakeY + 1.32, dtPierZ - 3.35),
    new THREE.CylinderGeometry(0.06, 0.08, 2.75, 5).translate(dtPierX + 2.95, lakeY + 1.32, dtPierZ - 3.35),
    new THREE.CylinderGeometry(0.06, 0.08, 2.75, 5).translate(dtPierX + 0.65, lakeY + 1.32, dtPierZ - 1.45),
    new THREE.CylinderGeometry(0.06, 0.08, 2.75, 5).translate(dtPierX + 2.95, lakeY + 1.32, dtPierZ - 1.45),
    // 1196: Nhà Sàn K'Ho outdoor Cây Nêu pole & fire-pit
    new THREE.CylinderGeometry(0.08, 0.12, 6.8, 5).translate(khX + 5.8, khY + 3.4, khZ + 3.2),
    // 1199: Đà Lạt wooden horse carriage (cx + 15.0, cz + 4.5)
    new THREE.BoxGeometry(2.4, 1.35, 1.45).translate(cx + 15.0, ctx.getHeight(cx + 15.0, cz + 4.5) + 1.15, cz + 4.5)
  );
  w4DlFlower.push(
    colorizeForMerge(new THREE.ConeGeometry(2.1, 1.25, 6).translate(ch2X + 4.5, ch2Y + 3.15, ch2Z), '#d9534f'),
    colorizeForMerge(new THREE.CylinderGeometry(1.85, 1.85, 0.24, 6).translate(lakeX, lakeY + 0.32, lakeZ), '#e84393')
  );
  // 1197: White "Stairway to Heaven" (Nấc Thang Lên Thiên Đường) photo-prop on Hydrangea Terraces
  for (let st = 0; st < 7; st++) {
    w4DlPlaster.push(new THREE.BoxGeometry(1.45, 0.18, 0.42).translate(cx + 18.5, ctx.getHeight(cx + 18.5, cz + 26.0) + 0.35 + st * 0.42, cz + 26.0 - st * 0.38));
  }
  w4DlGold.push(new THREE.ConeGeometry(0.32, 0.65, 5).translate(khX + 5.8, khY + 7.1, khZ + 3.2));
  // 1200: Scenic outer highland pine clusters (>= 7m clear of all villas, tea deck & greenhouses!)
  for (const [px, pz] of [[fvDlX - 9.0, fvDlZ + 5.5], [cdX + 10.0, cdZ + 6.5], [gh4X + 9.5, gh4Z - 4.5]] as const) {
    const py = ctx.getHeight(px, pz);
    w4DlWood.push(new THREE.CylinderGeometry(0.18, 0.26, 5.8, 5).translate(px, py + 1.8, pz));
    w4DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.4, 5.4, 5).translate(px, py + 6.2, pz), '#1d4f26'));
  }

  const w4DlWoodM = new THREE.Mesh(mergeNormalized(w4DlWood), ctx.materials.darkWood);
  w4DlWoodM.castShadow = false;
  const w4DlStoneM = new THREE.Mesh(mergeNormalized(w4DlStone), ctx.materials.stone);
  w4DlStoneM.castShadow = false;
  const w4DlFlowerM = new THREE.Mesh(mergeNormalized(w4DlFlower), flowerMat);
  w4DlFlowerM.castShadow = false;
  const w4DlPlasterM = new THREE.Mesh(mergeNormalized(w4DlPlaster), ctx.materials.whitePlaster);
  w4DlPlasterM.castShadow = false;
  const w4DlGoldM = new THREE.Mesh(mergeNormalized(w4DlGold), ctx.materials.gold);
  w4DlGoldM.castShadow = false;
  const w4DlGlassM = new THREE.Mesh(mergeNormalized(w4DlGlass), dalatGlassMat);
  w4DlGlassM.castShadow = false;
  group.add(w4DlWoodM, w4DlStoneM, w4DlFlowerM, w4DlPlasterM, w4DlGoldM, w4DlGlassM);

  // Wave 5 Upgrades (Items 1576–1598, 1600): 2nd French Colonial Pine Villa, Đà Lạt Flower Garden
  // Pergola & Seasonal Parterres, Ga Đà Lạt Steam Water-Tower Crane, Baggage Cart & Langbiang Coffee Kiosk
  const w5DlWood: THREE.BufferGeometry[] = [];
  const w5DlStone: THREE.BufferGeometry[] = [];
  const w5DlFlower: THREE.BufferGeometry[] = [];
  const w5DlPlaster: THREE.BufferGeometry[] = [];
  const w5DlGold: THREE.BufferGeometry[] = [];

  // 1576–1581: Biệt Thự Pháp Cổ #2 (2nd French Colonial Pine Villa at cx - 38.0, cz - 14.0)
  const fv2X = cx - 38.0;
  const fv2Z = cz - 14.0;
  const fv2Y = Math.max(ctx.getHeight(fv2X, fv2Z), ctx.getHeight(fv2X - 4.5, fv2Z - 4.0), ctx.getHeight(fv2X + 4.5, fv2Z + 4.0));
  w5DlStone.push(new THREE.BoxGeometry(9.2, 6.8, 8.2).translate(fv2X, fv2Y - 3.25, fv2Z));
  w5DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(7.0, 5.2, 6.0).translate(fv2X - 0.5, fv2Y + 2.75, fv2Z), '#eed6a0'),
    colorizeForMerge(new THREE.ConeGeometry(5.5, 2.7, 4).rotateY(Math.PI * 0.25).translate(fv2X - 0.5, fv2Y + 6.65, fv2Z), '#a93b28'),
    // 1581: Hydrangea & mimosa flowerbed borders
    colorizeForMerge(new THREE.BoxGeometry(5.8, 0.58, 1.15).translate(fv2X + 4.8, fv2Y + 0.42, fv2Z - 2.4), '#5c92e8'),
    colorizeForMerge(new THREE.BoxGeometry(5.8, 0.58, 1.15).translate(fv2X + 4.8, fv2Y + 0.42, fv2Z + 2.4), '#f4c430')
  );
  // 1578–1580: Dormer, stone chimney, 4-post covered veranda & stone gate pillars
  w5DlPlaster.push(
    new THREE.BoxGeometry(1.45, 1.25, 1.65).translate(fv2X + 1.8, fv2Y + 5.85, fv2Z),
    new THREE.BoxGeometry(0.95, 7.4, 0.95).translate(fv2X - 3.5, fv2Y + 3.9, fv2Z + 2.2)
  );
  w5DlWood.push(new THREE.BoxGeometry(2.2, 0.22, 5.8).translate(fv2X + 3.8, fv2Y + 3.18, fv2Z));
  for (const pzO of [-2.5, -0.85, 0.85, 2.5]) {
    w5DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.20, 5).translate(fv2X + 4.6, fv2Y + 1.60, fv2Z + pzO));
  }
  w5DlStone.push(
    new THREE.BoxGeometry(0.75, 2.1, 0.75).translate(fv2X + 6.8, fv2Y + 1.05, fv2Z - 1.8),
    new THREE.BoxGeometry(0.75, 2.1, 0.75).translate(fv2X + 6.8, fv2Y + 1.05, fv2Z + 1.8)
  );
  w5DlGold.push(new THREE.BoxGeometry(0.16, 0.28, 3.4).translate(fv2X + 6.8, fv2Y + 2.25, fv2Z));

  // 1582–1590: Vườn Hoa Thành Phố Đà Lạt (Flower Garden Terrace, Pergola & Seasonal Parterres at cx + 20.0, cz + 16.0)
  const fgX = cx + 20.0;
  const fgZ = cz + 16.0;
  const fgY = Math.max(ctx.getHeight(fgX, fgZ), ctx.getHeight(fgX - 4.8, fgZ - 4.2), ctx.getHeight(fgX + 4.8, fgZ + 4.2));
  w5DlStone.push(new THREE.BoxGeometry(10.0, 5.6, 8.8).translate(fgX, fgY - 2.65, fgZ));
  // 1583–1584: Whitewashed floral archway & 4-post hydrangea pergola
  w5DlPlaster.push(
    new THREE.CylinderGeometry(0.10, 0.12, 3.4, 5).translate(fgX - 4.6, fgY + 1.70, fgZ - 1.5),
    new THREE.CylinderGeometry(0.10, 0.12, 3.4, 5).translate(fgX - 4.6, fgY + 1.70, fgZ + 1.5),
    new THREE.BoxGeometry(0.28, 0.34, 3.4).translate(fgX - 4.6, fgY + 3.42, fgZ)
  );
  w5DlWood.push(
    new THREE.BoxGeometry(4.2, 0.18, 3.4).translate(fgX + 1.8, fgY + 3.05, fgZ),
    new THREE.BoxGeometry(2.2, 0.46, 0.56).translate(fgX + 1.8, fgY + 0.42, fgZ),
    new THREE.BoxGeometry(1.85, 0.46, 0.54).translate(fgX - 1.8, fgY + 0.42, fgZ + 3.2),
    // 1589: Decorative garden windmill ornament
    new THREE.CylinderGeometry(0.45, 0.72, 3.2, 6).translate(fgX - 1.8, fgY + 1.72, fgZ - 2.6)
  );
  for (const ox of [-0.1, 3.7]) {
    for (const oz of [-1.4, 1.4]) {
      w5DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 5).translate(fgX + ox, fgY + 1.52, fgZ + oz));
    }
  }
  for (let bl = 0; bl < 4; bl++) {
    w5DlGold.push(new THREE.BoxGeometry(0.22, 2.2, 0.08).rotateZ((bl * Math.PI) / 2).translate(fgX - 1.8, fgY + 3.25, fgZ - 2.0));
  }
  // 1585–1588: 4 stepped circular seasonal flowerbed parterres
  const parterreSpecs: Array<[number, number, string]> = [
    [-2.4, 0.6, '#5c92e8'],
    [-0.2, 2.6, '#f4c430'],
    [2.8, -2.8, '#f28db2'],
    [3.2, 2.8, '#8e6bd6']
  ];
  for (const [px, pz, col] of parterreSpecs) {
    w5DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.05, 1.25, 0.52, 6).translate(fgX + px, fgY + 0.42, fgZ + pz), col));
  }

  // 1591–1598, 1600: Ga Đà Lạt steam water-tower crane, baggage cart, clock-arch gantry, cog-rail buffer stop,
  // Hồ Đa Thiện 2nd swan-boat & floral heart-arch, Langbiang summit coffee kiosk, Lâm Viên artichoke bollards & outer pines
  w5DlWood.push(
    // 1591–1594: Steam water-tower crane, baggage handcart, clock-arch gantry & cog-rail buffer stop
    new THREE.CylinderGeometry(0.18, 0.24, 4.4, 6).translate(gaX + 18.5, gaTopY + 2.2, trackZ - 3.2),
    new THREE.BoxGeometry(1.85, 0.18, 0.18).translate(gaX + 18.5, gaTopY + 4.2, trackZ - 2.4),
    new THREE.BoxGeometry(1.35, 0.52, 0.85).translate(gaX + 1.2, gaTopY + 0.42, gaZ + 4.4),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 5).translate(gaX + 6.5, gaTopY + 1.9, gaZ + 4.2),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 5).translate(gaX + 10.5, gaTopY + 1.9, gaZ + 4.2),
    new THREE.BoxGeometry(4.4, 0.32, 0.24).translate(gaX + 8.5, gaTopY + 3.78, gaZ + 4.2),
    new THREE.BoxGeometry(0.55, 1.15, 2.2).translate(gaX + 21.5, gaTopY + 0.62, trackZ)
  );
  w5DlGold.push(new THREE.CylinderGeometry(0.38, 0.38, 0.16, 6).rotateX(Math.PI * 0.5).translate(gaX + 8.5, gaTopY + 4.18, gaZ + 4.2));
  // 1595–1596: Hồ Đa Thiện 2nd white swan-boat & lakeside floral heart-arch
  w5DlPlaster.push(
    new THREE.BoxGeometry(2.2, 0.58, 1.15).translate(dtPierX - 2.4, lakeY + 0.35, dtPierZ + 2.2),
    new THREE.CylinderGeometry(0.14, 0.22, 1.15, 5).translate(dtPierX - 1.6, lakeY + 0.95, dtPierZ + 2.2),
    new THREE.BoxGeometry(2.6, 2.8, 0.28).translate(dtPierX - 2.8, lakeY + 1.55, dtPierZ - 2.2)
  );
  // 1597–1598: Đỉnh Langbiang 4-post summit coffee kiosk & Lâm Viên artichoke bollards
  const lkX = cx - 10.5;
  const lkZ = cz - 14.5;
  const lkY = Math.max(ctx.getHeight(lkX, lkZ), ctx.getHeight(lkX - 2.0, lkZ - 1.8), ctx.getHeight(lkX + 2.0, lkZ + 1.8));
  w5DlStone.push(new THREE.BoxGeometry(4.4, 4.8, 3.8).translate(lkX, lkY - 2.25, lkZ));
  w5DlWood.push(
    new THREE.BoxGeometry(3.8, 0.20, 3.2).translate(lkX, lkY + 2.95, lkZ),
    new THREE.BoxGeometry(2.6, 0.88, 0.72).translate(lkX, lkY + 0.58, lkZ)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.3, 1.3]) {
      w5DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 2.95, 5).translate(lkX + ox, lkY + 1.48, lkZ + oz));
    }
  }
  for (const s of [-1, 1]) {
    w5DlGold.push(new THREE.CylinderGeometry(0.16, 0.22, 0.95, 6).translate(sqX + s * 11.5, sqTopY + 0.55, sqZ - 5.5));
    w5DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(0.32, 0.48, 5).translate(sqX + s * 11.5, sqTopY + 1.25, sqZ - 5.5), '#3ea862'));
  }
  // 1600: Distant outer highland pine clusters (>= 9m clear of all villas, flower garden & greenhouses!)
  for (const [px, pz] of [[fv2X - 9.5, fv2Z - 5.5], [fgX + 10.0, fgZ + 6.5], [cdX + 10.5, cdZ - 7.5]] as const) {
    const py = ctx.getHeight(px, pz);
    w5DlWood.push(new THREE.CylinderGeometry(0.18, 0.26, 5.8, 5).translate(px, py + 1.8, pz));
    w5DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.4, 5.4, 5).translate(px, py + 6.2, pz), '#1d4f26'));
  }

  const w5DlWoodM = new THREE.Mesh(mergeNormalized(w5DlWood), ctx.materials.darkWood);
  w5DlWoodM.castShadow = false;
  const w5DlStoneM = new THREE.Mesh(mergeNormalized(w5DlStone), ctx.materials.stone);
  w5DlStoneM.castShadow = false;
  const w5DlFlowerM = new THREE.Mesh(mergeNormalized(w5DlFlower), flowerMat);
  w5DlFlowerM.castShadow = false;
  const w5DlPlasterM = new THREE.Mesh(mergeNormalized(w5DlPlaster), ctx.materials.whitePlaster);
  w5DlPlasterM.castShadow = false;
  const w5DlGoldM = new THREE.Mesh(mergeNormalized(w5DlGold), ctx.materials.gold);
  w5DlGoldM.castShadow = false;
  group.add(w5DlWoodM, w5DlStoneM, w5DlFlowerM, w5DlPlasterM, w5DlGoldM);

  // Wave 6 Upgrades (Items 1976–1998, 2000): 3rd French Colonial Pine Villa, Đà Lạt Rose-Arbor
  // Gazebo Terrace, Ga Đà Lạt 3rd Vintage Coach & Crossing Gate, Hồ Đa Thiện Pergola & Outer Pines
  const w6DlWood: THREE.BufferGeometry[] = [];
  const w6DlStone: THREE.BufferGeometry[] = [];
  const w6DlFlower: THREE.BufferGeometry[] = [];
  const w6DlPlaster: THREE.BufferGeometry[] = [];
  const w6DlGold: THREE.BufferGeometry[] = [];

  // 1976–1982: Biệt Thự Pháp Cổ #3 (3rd French Colonial Hillside Pine Villa at cx - 38.0, cz + 24.0)
  const fv3X = cx - 38.0;
  const fv3Z = cz + 24.0;
  const fv3Y = Math.max(ctx.getHeight(fv3X, fv3Z), ctx.getHeight(fv3X - 4.4, fv3Z - 4.0), ctx.getHeight(fv3X + 4.4, fv3Z + 4.0));
  w6DlStone.push(new THREE.BoxGeometry(9.0, 6.8, 8.0).translate(fv3X, fv3Y - 3.25, fv3Z));
  w6DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(6.8, 5.1, 5.8).translate(fv3X - 0.5, fv3Y + 2.70, fv3Z), '#f0dfb4'),
    colorizeForMerge(new THREE.ConeGeometry(5.4, 2.6, 4).rotateY(Math.PI * 0.25).translate(fv3X - 0.5, fv3Y + 6.50, fv3Z), '#a53a28'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv3X + 4.6, fv3Y + 0.40, fv3Z - 2.3), '#5c92e8'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv3X + 4.6, fv3Y + 0.40, fv3Z + 2.3), '#d6456b')
  );
  w6DlPlaster.push(
    new THREE.BoxGeometry(1.40, 1.20, 1.60).translate(fv3X + 1.8, fv3Y + 5.75, fv3Z),
    new THREE.BoxGeometry(0.92, 7.2, 0.92).translate(fv3X - 3.4, fv3Y + 3.8, fv3Z - 2.1)
  );
  w6DlWood.push(new THREE.BoxGeometry(2.1, 0.22, 5.6).translate(fv3X + 3.7, fv3Y + 3.12, fv3Z));
  for (const pzO of [-2.4, -0.8, 0.8, 2.4]) {
    w6DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.15, 4).translate(fv3X + 4.5, fv3Y + 1.58, fv3Z + pzO));
  }
  w6DlStone.push(
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv3X + 6.6, fv3Y + 1.0, fv3Z - 1.7),
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv3X + 6.6, fv3Y + 1.0, fv3Z + 1.7)
  );
  w6DlGold.push(new THREE.BoxGeometry(0.16, 0.26, 3.2).translate(fv3X + 6.6, fv3Y + 2.18, fv3Z));

  // 1983–1989: Vườn Hồng & Cổng Hoa Đà Lạt (Rose-Arbor & Gazebo Terrace at cx + 34.0, cz + 16.0)
  const rgX = cx + 34.0;
  const rgZ = cz + 16.0;
  const rgY = Math.max(ctx.getHeight(rgX, rgZ), ctx.getHeight(rgX - 4.5, rgZ - 4.0), ctx.getHeight(rgX + 4.5, rgZ + 4.0));
  w6DlStone.push(new THREE.BoxGeometry(9.4, 6.0, 8.4).translate(rgX, rgY - 2.85, rgZ));
  w6DlPlaster.push(
    new THREE.BoxGeometry(3.8, 0.22, 3.4).translate(rgX, rgY + 3.05, rgZ),
    new THREE.ConeGeometry(2.8, 1.25, 4).rotateY(Math.PI * 0.25).translate(rgX, rgY + 3.75, rgZ),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(rgX - 4.3, rgY + 1.65, rgZ - 1.4),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(rgX - 4.3, rgY + 1.65, rgZ + 1.4),
    new THREE.BoxGeometry(0.26, 0.32, 3.2).translate(rgX - 4.3, rgY + 3.32, rgZ)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w6DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 4).translate(rgX + ox, rgY + 1.52, rgZ + oz));
    }
  }
  w6DlWood.push(
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(rgX, rgY + 0.42, rgZ),
    new THREE.BoxGeometry(1.85, 0.46, 0.52).translate(rgX + 2.8, rgY + 0.42, rgZ + 2.8)
  );
  for (const [px, pz, col] of [[-2.4, -2.4, '#d6456b'], [2.6, -2.4, '#8e6bd6'], [-2.4, 2.4, '#f4c430']] as const) {
    w6DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.0, 1.18, 0.48, 5).translate(rgX + px, rgY + 0.40, rgZ + pz), col));
  }

  // 1990–1998, 2000: Ga Đà Lạt 3rd vintage coach, crossing gate, ticket kiosk, coal bin,
  // Hồ Đa Thiện white photo pergola & 3rd swan-boat, Langbiang summit monument & outer pines
  w6DlWood.push(
    new THREE.BoxGeometry(6.8, 2.30, 2.20).translate(gaX + 24.5, gaTopY + 1.42, trackZ),
    new THREE.CylinderGeometry(0.08, 0.10, 3.6, 4).translate(gaX - 12.5, gaTopY + 1.80, trackZ + 2.4),
    new THREE.BoxGeometry(3.2, 0.14, 0.14).rotateZ(0.22).translate(gaX - 11.2, gaTopY + 1.85, trackZ + 2.4),
    // 1992: 4-post heritage station ticket kiosk (gaX - 8.5, gaZ + 4.5)
    new THREE.BoxGeometry(3.2, 0.20, 2.6).translate(gaX - 8.5, gaTopY + 2.95, gaZ + 4.5),
    new THREE.BoxGeometry(2.2, 0.85, 0.72).translate(gaX - 8.5, gaTopY + 0.55, gaZ + 4.5),
    // 1994: Coal-bunker bin
    new THREE.BoxGeometry(2.2, 1.15, 1.65).translate(gaX + 18.5, gaTopY + 0.62, trackZ - 5.2),
    // 1998: Langbiang summit bench
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(lkX - 5.5, lkY + 0.35, lkZ + 1.8)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w6DlWood.push(new THREE.CylinderGeometry(0.07, 0.08, 2.95, 4).translate(gaX - 8.5 + ox, gaTopY + 1.48, gaZ + 4.5 + oz));
    }
  }
  w6DlGold.push(
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(gaX - 3.5, gaTopY + 3.45, gaZ + 4.2),
    new THREE.BoxGeometry(0.24, 0.30, 0.24).translate(gaX + 4.5, gaTopY + 3.45, gaZ + 4.2),
    new THREE.BoxGeometry(0.85, 1.45, 0.28).translate(gaX - 12.0, gaTopY + 0.85, gaZ + 4.5),
    new THREE.ConeGeometry(0.38, 1.35, 4).translate(lkX - 5.5, lkY + 1.05, lkZ)
  );
  // 1996–1997: Hồ Đa Thiện 4-post whitewashed photo pergola & 3rd swan-boat pedalo
  w6DlPlaster.push(
    new THREE.BoxGeometry(3.6, 0.18, 3.0).translate(dtPierX - 6.5, lakeY + 2.85, dtPierZ - 2.0),
    new THREE.BoxGeometry(2.1, 0.56, 1.10).translate(dtPierX + 4.6, lakeY + 0.35, dtPierZ + 2.2),
    new THREE.CylinderGeometry(0.14, 0.20, 1.10, 4).translate(dtPierX + 5.4, lakeY + 0.92, dtPierZ + 2.2)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w6DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 2.85, 4).translate(dtPierX - 6.5 + ox, lakeY + 1.42, dtPierZ - 2.0 + oz));
    }
  }
  // 2000: Distant outer highland pine clusters (>= 10m clear of all villas, rose-arbor & greenhouses!)
  for (const [px, pz] of [[fv3X - 10.5, fv3Z + 6.0], [rgX + 10.5, rgZ + 6.5], [fv2X - 10.5, fv2Z - 12.0]] as const) {
    const py = ctx.getHeight(px, pz);
    w6DlWood.push(new THREE.CylinderGeometry(0.18, 0.25, 5.6, 4).translate(px, py + 1.8, pz));
    w6DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.3, 5.2, 4).translate(px, py + 6.0, pz), '#1d4f26'));
  }

  const w6DlWoodM = new THREE.Mesh(mergeNormalized(w6DlWood), ctx.materials.darkWood);
  w6DlWoodM.castShadow = false;
  const w6DlStoneM = new THREE.Mesh(mergeNormalized(w6DlStone), ctx.materials.stone);
  w6DlStoneM.castShadow = false;
  const w6DlFlowerM = new THREE.Mesh(mergeNormalized(w6DlFlower), flowerMat);
  w6DlFlowerM.castShadow = false;
  const w6DlPlasterM = new THREE.Mesh(mergeNormalized(w6DlPlaster), ctx.materials.whitePlaster);
  w6DlPlasterM.castShadow = false;
  const w6DlGoldM = new THREE.Mesh(mergeNormalized(w6DlGold), ctx.materials.gold);
  w6DlGoldM.castShadow = false;
  group.add(w6DlWoodM, w6DlStoneM, w6DlFlowerM, w6DlPlasterM, w6DlGoldM);

  // Wave 7 Upgrades (Items 2376–2398, 2400): 4th French Colonial Pine Villa, Đà Lạt Hydrangea
  // Gazebo Terrace, Ga Đà Lạt 4th Vintage Coach & Clock-Post, Hồ Đa Thiện Boathouse & Outer Pines
  const w7DlWood: THREE.BufferGeometry[] = [];
  const w7DlStone: THREE.BufferGeometry[] = [];
  const w7DlFlower: THREE.BufferGeometry[] = [];
  const w7DlPlaster: THREE.BufferGeometry[] = [];
  const w7DlGold: THREE.BufferGeometry[] = [];

  // 2376–2382: Biệt Thự Pháp Cổ #4 (4th French Colonial Hillside Pine Villa at cx - 38.0, cz - 12.0)
  const fv4X = cx - 38.0;
  const fv4Z = cz - 12.0;
  const fv4Y = Math.max(ctx.getHeight(fv4X, fv4Z), ctx.getHeight(fv4X - 4.4, fv4Z - 4.0), ctx.getHeight(fv4X + 4.4, fv4Z + 4.0));
  w7DlStone.push(new THREE.BoxGeometry(9.0, 6.8, 8.0).translate(fv4X, fv4Y - 3.25, fv4Z));
  w7DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(6.8, 5.1, 5.8).translate(fv4X - 0.5, fv4Y + 2.70, fv4Z), '#efe2b8'),
    colorizeForMerge(new THREE.ConeGeometry(5.4, 2.6, 4).rotateY(Math.PI * 0.25).translate(fv4X - 0.5, fv4Y + 6.50, fv4Z), '#b03e2a'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv4X + 4.6, fv4Y + 0.40, fv4Z - 2.3), '#6c8ee8'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv4X + 4.6, fv4Y + 0.40, fv4Z + 2.3), '#e6648b')
  );
  w7DlPlaster.push(
    new THREE.BoxGeometry(1.40, 1.20, 1.60).translate(fv4X + 1.8, fv4Y + 5.75, fv4Z),
    new THREE.BoxGeometry(0.92, 7.2, 0.92).translate(fv4X - 3.4, fv4Y + 3.8, fv4Z - 2.1)
  );
  w7DlWood.push(new THREE.BoxGeometry(2.1, 0.22, 5.6).translate(fv4X + 3.7, fv4Y + 3.12, fv4Z));
  for (const pzO of [-2.4, -0.8, 0.8, 2.4]) {
    w7DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.15, 4).translate(fv4X + 4.5, fv4Y + 1.58, fv4Z + pzO));
  }
  w7DlStone.push(
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv4X + 6.6, fv4Y + 1.0, fv4Z - 1.7),
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv4X + 6.6, fv4Y + 1.0, fv4Z + 1.7)
  );
  w7DlGold.push(new THREE.BoxGeometry(0.16, 0.26, 3.2).translate(fv4X + 6.6, fv4Y + 2.18, fv4Z));

  // 2383–2389: Vườn Hoa Cẩm Tú Cầu & Cổng Trời Đà Lạt (Floral Gazebo Terrace at cx + 34.0, cz + 2.0)
  const hgX = cx + 34.0;
  const hgZ = cz + 2.0;
  const hgY = Math.max(ctx.getHeight(hgX, hgZ), ctx.getHeight(hgX - 4.5, hgZ - 4.0), ctx.getHeight(hgX + 4.5, hgZ + 4.0));
  w7DlStone.push(new THREE.BoxGeometry(9.4, 6.0, 8.4).translate(hgX, hgY - 2.85, hgZ));
  w7DlPlaster.push(
    new THREE.BoxGeometry(3.8, 0.22, 3.4).translate(hgX, hgY + 3.05, hgZ),
    new THREE.ConeGeometry(2.8, 1.25, 4).rotateY(Math.PI * 0.25).translate(hgX, hgY + 3.75, hgZ),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(hgX - 4.3, hgY + 1.65, hgZ - 1.4),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(hgX - 4.3, hgY + 1.65, hgZ + 1.4),
    new THREE.BoxGeometry(0.26, 0.32, 3.2).translate(hgX - 4.3, hgY + 3.32, hgZ)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w7DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 4).translate(hgX + ox, hgY + 1.52, hgZ + oz));
    }
  }
  w7DlWood.push(
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(hgX, hgY + 0.42, hgZ),
    new THREE.BoxGeometry(1.85, 0.46, 0.52).translate(hgX + 2.8, hgY + 0.42, hgZ - 2.8)
  );
  for (const [px, pz, col] of [[-2.4, -2.4, '#5fa8e6'], [2.6, 2.4, '#9a7be0'], [-2.4, 2.4, '#e37ba8']] as const) {
    w7DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.0, 1.18, 0.48, 5).translate(hgX + px, hgY + 0.40, hgZ + pz), col));
  }

  // 2390–2398, 2400: Ga Đà Lạt 4th vintage rail coach, Art-Deco clock-post, baggage kiosk, water-crane,
  // Hồ Đa Thiện boathouse canopy & 4th swan-boat, Langbiang summit photo frame & outer highland pines
  w7DlWood.push(
    new THREE.BoxGeometry(6.8, 2.30, 2.20).translate(gaX + 32.0, gaTopY + 1.42, trackZ),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 4).translate(gaX + 8.5, gaTopY + 1.90, gaZ + 4.5),
    // 2392: 4-post heritage baggage-scale kiosk (gaX - 14.5, gaZ + 4.5)
    new THREE.BoxGeometry(3.2, 0.20, 2.6).translate(gaX - 14.5, gaTopY + 2.95, gaZ + 4.5),
    new THREE.BoxGeometry(2.2, 0.85, 0.72).translate(gaX - 14.5, gaTopY + 0.55, gaZ + 4.5),
    // 2394: Railway water-crane standpipe
    new THREE.CylinderGeometry(0.14, 0.18, 3.4, 4).translate(gaX + 24.5, gaTopY + 1.70, trackZ - 3.6),
    new THREE.BoxGeometry(1.65, 0.18, 0.18).translate(gaX + 24.5, gaTopY + 3.25, trackZ - 2.8),
    // 2398: Langbiang summit timber photo frame & viewing bench
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX + 4.2, lkY + 1.40, lkZ - 1.2),
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX + 4.2, lkY + 1.40, lkZ + 1.2),
    new THREE.BoxGeometry(0.26, 0.26, 2.8).translate(lkX + 4.2, lkY + 2.82, lkZ),
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(lkX + 4.2, lkY + 0.35, lkZ + 2.8)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w7DlWood.push(new THREE.CylinderGeometry(0.07, 0.08, 2.95, 4).translate(gaX - 14.5 + ox, gaTopY + 1.48, gaZ + 4.5 + oz));
    }
  }
  w7DlGold.push(
    new THREE.CylinderGeometry(0.38, 0.38, 0.16, 5).rotateX(Math.PI * 0.5).translate(gaX + 8.5, gaTopY + 3.85, gaZ + 4.5)
  );
  // 2395–2397: Hồ Đa Thiện 4-post lakeside pine boathouse canopy & 4th white swan-boat pedalo
  w7DlPlaster.push(
    new THREE.BoxGeometry(3.6, 0.18, 3.0).translate(dtPierX + 6.5, lakeY + 2.85, dtPierZ - 2.0),
    new THREE.BoxGeometry(2.1, 0.56, 1.10).translate(dtPierX - 2.2, lakeY + 0.35, dtPierZ + 2.6),
    new THREE.CylinderGeometry(0.14, 0.20, 1.10, 4).translate(dtPierX - 1.4, lakeY + 0.92, dtPierZ + 2.6)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w7DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 2.85, 4).translate(dtPierX + 6.5 + ox, lakeY + 1.42, dtPierZ - 2.0 + oz));
    }
  }
  // 2400: Distant outer highland pine clusters (>= 10m clear of Villa #4, Floral Terrace & greenhouses!)
  for (const [px, pz] of [[fv4X - 10.5, fv4Z - 6.0], [hgX + 10.5, hgZ - 4.5], [fv3X - 10.5, fv3Z + 14.0]] as const) {
    const py = ctx.getHeight(px, pz);
    w7DlWood.push(new THREE.CylinderGeometry(0.18, 0.25, 5.6, 4).translate(px, py + 1.8, pz));
    w7DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.3, 5.2, 4).translate(px, py + 6.0, pz), '#1d4f26'));
  }

  const w7DlWoodM = new THREE.Mesh(mergeNormalized(w7DlWood), ctx.materials.darkWood);
  w7DlWoodM.castShadow = false;
  const w7DlStoneM = new THREE.Mesh(mergeNormalized(w7DlStone), ctx.materials.stone);
  w7DlStoneM.castShadow = false;
  const w7DlFlowerM = new THREE.Mesh(mergeNormalized(w7DlFlower), flowerMat);
  w7DlFlowerM.castShadow = false;
  const w7DlPlasterM = new THREE.Mesh(mergeNormalized(w7DlPlaster), ctx.materials.whitePlaster);
  w7DlPlasterM.castShadow = false;
  const w7DlGoldM = new THREE.Mesh(mergeNormalized(w7DlGold), ctx.materials.gold);
  w7DlGoldM.castShadow = false;
  group.add(w7DlWoodM, w7DlStoneM, w7DlFlowerM, w7DlPlasterM, w7DlGoldM);

  // Wave 8 Upgrades (Items 2776–2798, 2800): 5th French Colonial Pine Villa, Đà Lạt Lavender
  // Pergola Terrace, Ga Đà Lạt 5th Vintage Coach & Semaphore Mast, Hồ Đa Thiện Boathouse & Outer Pines
  const w8DlWood: THREE.BufferGeometry[] = [];
  const w8DlStone: THREE.BufferGeometry[] = [];
  const w8DlFlower: THREE.BufferGeometry[] = [];
  const w8DlPlaster: THREE.BufferGeometry[] = [];
  const w8DlGold: THREE.BufferGeometry[] = [];

  // 2776–2782: Biệt Thự Pháp Cổ #5 (5th French Colonial Hillside Pine Villa at cx - 38.0, cz + 14.0)
  const fv5X = cx - 38.0;
  const fv5Z = cz + 14.0;
  const fv5Y = Math.max(ctx.getHeight(fv5X, fv5Z), ctx.getHeight(fv5X - 4.4, fv5Z - 4.0), ctx.getHeight(fv5X + 4.4, fv5Z + 4.0));
  w8DlStone.push(new THREE.BoxGeometry(9.0, 6.8, 8.0).translate(fv5X, fv5Y - 3.25, fv5Z));
  w8DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(6.8, 5.1, 5.8).translate(fv5X - 0.5, fv5Y + 2.70, fv5Z), '#f0dca8'),
    colorizeForMerge(new THREE.ConeGeometry(5.4, 2.6, 4).rotateY(Math.PI * 0.25).translate(fv5X - 0.5, fv5Y + 6.50, fv5Z), '#b03e2a'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv5X + 4.6, fv5Y + 0.40, fv5Z - 2.3), '#7b6ce8'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv5X + 4.6, fv5Y + 0.40, fv5Z + 2.3), '#6c8ee8')
  );
  w8DlPlaster.push(
    new THREE.BoxGeometry(1.40, 1.20, 1.60).translate(fv5X + 1.8, fv5Y + 5.75, fv5Z),
    new THREE.BoxGeometry(0.92, 7.2, 0.92).translate(fv5X - 3.4, fv5Y + 3.8, fv5Z + 2.1)
  );
  w8DlWood.push(new THREE.BoxGeometry(2.1, 0.22, 5.6).translate(fv5X + 3.7, fv5Y + 3.12, fv5Z));
  for (const pzO of [-2.4, -0.8, 0.8, 2.4]) {
    w8DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.15, 4).translate(fv5X + 4.5, fv5Y + 1.58, fv5Z + pzO));
  }
  w8DlStone.push(
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv5X + 6.6, fv5Y + 1.0, fv5Z - 1.7),
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv5X + 6.6, fv5Y + 1.0, fv5Z + 1.7)
  );
  w8DlGold.push(new THREE.BoxGeometry(0.16, 0.26, 3.2).translate(fv5X + 6.6, fv5Y + 2.18, fv5Z));

  // 2783–2789: Vườn Hoa Oải Hương & Vọng Lầu Đà Lạt (Lavender & Rose Pergola Terrace at cx + 34.0, cz - 14.0)
  const lv8X = cx + 34.0;
  const lv8Z = cz - 14.0;
  const lv8Y = Math.max(ctx.getHeight(lv8X, lv8Z), ctx.getHeight(lv8X - 4.5, lv8Z - 4.0), ctx.getHeight(lv8X + 4.5, lv8Z + 4.0));
  w8DlStone.push(new THREE.BoxGeometry(9.4, 6.0, 8.4).translate(lv8X, lv8Y - 2.85, lv8Z));
  w8DlPlaster.push(
    new THREE.BoxGeometry(3.8, 0.22, 3.4).translate(lv8X, lv8Y + 3.05, lv8Z),
    new THREE.ConeGeometry(2.8, 1.25, 4).rotateY(Math.PI * 0.25).translate(lv8X, lv8Y + 3.75, lv8Z),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(lv8X - 4.3, lv8Y + 1.65, lv8Z - 1.4),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(lv8X - 4.3, lv8Y + 1.65, lv8Z + 1.4),
    new THREE.BoxGeometry(0.26, 0.32, 3.2).translate(lv8X - 4.3, lv8Y + 3.32, lv8Z)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w8DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 4).translate(lv8X + ox, lv8Y + 1.52, lv8Z + oz));
    }
  }
  w8DlWood.push(
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(lv8X, lv8Y + 0.42, lv8Z),
    new THREE.BoxGeometry(1.85, 0.46, 0.52).translate(lv8X + 2.8, lv8Y + 0.42, lv8Z + 2.8)
  );
  for (const [px, pz, col] of [[-2.4, -2.4, '#8b6be6'], [2.6, 2.4, '#e37ba8'], [-2.4, 2.4, '#6aa2e6']] as const) {
    w8DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.0, 1.18, 0.48, 5).translate(lv8X + px, lv8Y + 0.40, lv8Z + pz), col));
  }

  // 2790–2798, 2800: Ga Đà Lạt 5th vintage rail coach, lamp-post, ticket kiosk, semaphore mast,
  // Hồ Đa Thiện west boathouse canopy & 5th swan-boat, Langbiang west photo frame & outer highland pines
  w8DlWood.push(
    new THREE.BoxGeometry(6.8, 2.30, 2.20).translate(gaX + 41.0, gaTopY + 1.42, trackZ),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 4).translate(gaX - 8.5, gaTopY + 1.90, gaZ + 4.5),
    // 2792: 4-post heritage ticket-and-coffee kiosk (gaX + 14.5, gaZ + 4.5)
    new THREE.BoxGeometry(3.2, 0.20, 2.6).translate(gaX + 14.5, gaTopY + 2.95, gaZ + 4.5),
    new THREE.BoxGeometry(2.2, 0.85, 0.72).translate(gaX + 14.5, gaTopY + 0.55, gaZ + 4.5),
    // 2794: Railway semaphore signal mast
    new THREE.CylinderGeometry(0.10, 0.14, 4.6, 4).translate(gaX + 35.5, gaTopY + 2.30, trackZ - 3.6),
    new THREE.BoxGeometry(1.45, 0.22, 0.14).translate(gaX + 35.5, gaTopY + 4.15, trackZ - 3.0),
    // 2798: Langbiang west summit timber photo frame & viewing bench
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX - 4.2, lkY + 1.40, lkZ - 1.2),
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX - 4.2, lkY + 1.40, lkZ + 1.2),
    new THREE.BoxGeometry(0.26, 0.26, 2.8).translate(lkX - 4.2, lkY + 2.82, lkZ),
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(lkX - 4.2, lkY + 0.35, lkZ + 2.8)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w8DlWood.push(new THREE.CylinderGeometry(0.07, 0.08, 2.95, 4).translate(gaX + 14.5 + ox, gaTopY + 1.48, gaZ + 4.5 + oz));
    }
  }
  w8DlGold.push(
    new THREE.BoxGeometry(0.28, 0.34, 0.28).translate(gaX - 8.5, gaTopY + 3.92, gaZ + 4.5)
  );
  // 2795–2797: Hồ Đa Thiện west 4-post lakeside pine boathouse canopy & 5th white swan-boat pedalo
  w8DlPlaster.push(
    new THREE.BoxGeometry(3.6, 0.18, 3.0).translate(dtPierX - 6.5, lakeY + 2.85, dtPierZ - 2.0),
    new THREE.BoxGeometry(2.1, 0.56, 1.10).translate(dtPierX + 2.2, lakeY + 0.35, dtPierZ + 2.6),
    new THREE.CylinderGeometry(0.14, 0.20, 1.10, 4).translate(dtPierX + 1.4, lakeY + 0.92, dtPierZ + 2.6)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w8DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 2.85, 4).translate(dtPierX - 6.5 + ox, lakeY + 1.42, dtPierZ - 2.0 + oz));
    }
  }
  // 2800: Distant outer highland pine clusters (>= 10m clear of Villa #5, Lavender Terrace & Villa #4!)
  for (const [px, pz] of [[fv5X - 10.5, fv5Z + 6.0], [lv8X + 10.5, lv8Z - 4.5], [fv4X - 10.5, fv4Z - 14.0]] as const) {
    const py = ctx.getHeight(px, pz);
    w8DlWood.push(new THREE.CylinderGeometry(0.18, 0.25, 5.6, 4).translate(px, py + 1.8, pz));
    w8DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.3, 5.2, 4).translate(px, py + 6.0, pz), '#1d4f26'));
  }

  const w8DlWoodM = new THREE.Mesh(mergeNormalized(w8DlWood), ctx.materials.darkWood);
  w8DlWoodM.castShadow = false;
  const w8DlStoneM = new THREE.Mesh(mergeNormalized(w8DlStone), ctx.materials.stone);
  w8DlStoneM.castShadow = false;
  const w8DlFlowerM = new THREE.Mesh(mergeNormalized(w8DlFlower), flowerMat);
  w8DlFlowerM.castShadow = false;
  const w8DlPlasterM = new THREE.Mesh(mergeNormalized(w8DlPlaster), ctx.materials.whitePlaster);
  w8DlPlasterM.castShadow = false;
  const w8DlGoldM = new THREE.Mesh(mergeNormalized(w8DlGold), ctx.materials.gold);
  w8DlGoldM.castShadow = false;
  group.add(w8DlWoodM, w8DlStoneM, w8DlFlowerM, w8DlPlasterM, w8DlGoldM);

  // Wave 9 Upgrades (Items 3176–3198, 3200): 6th French Colonial Pine Villa, Đà Lạt Cherry-Blossom
  // Pergola Terrace, Ga Đà Lạt 6th Vintage Coach & Crossing Signal, Hồ Đa Thiện Boathouse & Outer Pines
  const w9DlWood: THREE.BufferGeometry[] = [];
  const w9DlStone: THREE.BufferGeometry[] = [];
  const w9DlFlower: THREE.BufferGeometry[] = [];
  const w9DlPlaster: THREE.BufferGeometry[] = [];
  const w9DlGold: THREE.BufferGeometry[] = [];

  // 3176–3182: Biệt Thự Pháp Cổ #6 (6th French Colonial Hillside Pine Villa at cx - 52.0, cz + 2.0)
  const fv6X = cx - 52.0;
  const fv6Z = cz + 2.0;
  const fv6Y = Math.max(ctx.getHeight(fv6X, fv6Z), ctx.getHeight(fv6X - 4.4, fv6Z - 4.0), ctx.getHeight(fv6X + 4.4, fv6Z + 4.0));
  w9DlStone.push(new THREE.BoxGeometry(9.0, 6.8, 8.0).translate(fv6X, fv6Y - 3.25, fv6Z));
  w9DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(6.8, 5.1, 5.8).translate(fv6X - 0.5, fv6Y + 2.70, fv6Z), '#f3d8cc'),
    colorizeForMerge(new THREE.ConeGeometry(5.4, 2.6, 4).rotateY(Math.PI * 0.25).translate(fv6X - 0.5, fv6Y + 6.50, fv6Z), '#b03e2a'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv6X + 4.6, fv6Y + 0.40, fv6Z - 2.3), '#e67aa4'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv6X + 4.6, fv6Y + 0.40, fv6Z + 2.3), '#6c8ee8')
  );
  w9DlPlaster.push(
    new THREE.BoxGeometry(1.40, 1.20, 1.60).translate(fv6X + 1.8, fv6Y + 5.75, fv6Z),
    new THREE.BoxGeometry(0.92, 7.2, 0.92).translate(fv6X - 3.4, fv6Y + 3.8, fv6Z - 2.1)
  );
  w9DlWood.push(new THREE.BoxGeometry(2.1, 0.22, 5.6).translate(fv6X + 3.7, fv6Y + 3.12, fv6Z));
  for (const pzO of [-2.4, -0.8, 0.8, 2.4]) {
    w9DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.15, 4).translate(fv6X + 4.5, fv6Y + 1.58, fv6Z + pzO));
  }
  w9DlStone.push(
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv6X + 6.6, fv6Y + 1.0, fv6Z - 1.7),
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv6X + 6.6, fv6Y + 1.0, fv6Z + 1.7)
  );
  w9DlGold.push(new THREE.BoxGeometry(0.16, 0.26, 3.2).translate(fv6X + 6.6, fv6Y + 2.18, fv6Z));

  // 3183–3189: Vườn Hoa Anh Đào & Vọng Lầu Đà Lạt (Cherry-Blossom Pergola Terrace at cx + 48.0, cz + 14.0)
  const cb9X = cx + 48.0;
  const cb9Z = cz + 14.0;
  const cb9Y = Math.max(ctx.getHeight(cb9X, cb9Z), ctx.getHeight(cb9X - 4.5, cb9Z - 4.0), ctx.getHeight(cb9X + 4.5, cb9Z + 4.0));
  w9DlStone.push(new THREE.BoxGeometry(9.4, 6.0, 8.4).translate(cb9X, cb9Y - 2.85, cb9Z));
  w9DlPlaster.push(
    new THREE.BoxGeometry(3.8, 0.22, 3.4).translate(cb9X, cb9Y + 3.05, cb9Z),
    new THREE.ConeGeometry(2.8, 1.25, 4).rotateY(Math.PI * 0.25).translate(cb9X, cb9Y + 3.75, cb9Z),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(cb9X - 4.3, cb9Y + 1.65, cb9Z - 1.4),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(cb9X - 4.3, cb9Y + 1.65, cb9Z + 1.4),
    new THREE.BoxGeometry(0.26, 0.32, 3.2).translate(cb9X - 4.3, cb9Y + 3.32, cb9Z)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w9DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 4).translate(cb9X + ox, cb9Y + 1.52, cb9Z + oz));
    }
  }
  w9DlWood.push(
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(cb9X, cb9Y + 0.42, cb9Z),
    new THREE.BoxGeometry(1.85, 0.46, 0.52).translate(cb9X + 2.8, cb9Y + 0.42, cb9Z + 2.8)
  );
  for (const [px, pz, col] of [[-2.4, -2.4, '#f08db8'], [2.6, 2.4, '#e36a9a'], [-2.4, 2.4, '#9a7be0']] as const) {
    w9DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.0, 1.18, 0.48, 5).translate(cb9X + px, cb9Y + 0.40, cb9Z + pz), col));
  }

  // 3190–3198, 3200: Ga Đà Lạt 6th vintage rail coach, lamp-post, souvenir kiosk, crossing signal,
  // Hồ Đa Thiện north boathouse canopy & 6th swan-boat, Langbiang north photo frame & outer highland pines
  w9DlWood.push(
    new THREE.BoxGeometry(6.8, 2.30, 2.20).translate(gaX + 50.0, gaTopY + 1.42, trackZ),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 4).translate(gaX - 18.5, gaTopY + 1.90, gaZ + 4.5),
    // 3192: 4-post heritage souvenir-and-tea kiosk (gaX + 22.5, gaZ + 4.5)
    new THREE.BoxGeometry(3.2, 0.20, 2.6).translate(gaX + 22.5, gaTopY + 2.95, gaZ + 4.5),
    new THREE.BoxGeometry(2.2, 0.85, 0.72).translate(gaX + 22.5, gaTopY + 0.55, gaZ + 4.5),
    // 3194: Railway crossing signal mast
    new THREE.CylinderGeometry(0.10, 0.14, 4.6, 4).translate(gaX + 44.5, gaTopY + 2.30, trackZ - 3.6),
    new THREE.BoxGeometry(1.45, 0.22, 0.14).translate(gaX + 44.5, gaTopY + 4.15, trackZ - 3.0),
    // 3198: Langbiang north summit timber photo frame & viewing bench
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX - 1.2, lkY + 1.40, lkZ - 4.2),
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX + 1.2, lkY + 1.40, lkZ - 4.2),
    new THREE.BoxGeometry(2.8, 0.26, 0.26).translate(lkX, lkY + 2.82, lkZ - 4.2),
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(lkX + 2.8, lkY + 0.35, lkZ - 4.2)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w9DlWood.push(new THREE.CylinderGeometry(0.07, 0.08, 2.95, 4).translate(gaX + 22.5 + ox, gaTopY + 1.48, gaZ + 4.5 + oz));
    }
  }
  w9DlGold.push(
    new THREE.BoxGeometry(0.28, 0.34, 0.28).translate(gaX - 18.5, gaTopY + 3.92, gaZ + 4.5)
  );
  // 3195–3197: Hồ Đa Thiện north 4-post lakeside pine boathouse canopy & 6th white swan-boat pedalo
  w9DlPlaster.push(
    new THREE.BoxGeometry(3.6, 0.18, 3.0).translate(dtPierX, lakeY + 2.85, dtPierZ - 8.5),
    new THREE.BoxGeometry(2.1, 0.56, 1.10).translate(dtPierX, lakeY + 0.35, dtPierZ + 6.4),
    new THREE.CylinderGeometry(0.14, 0.20, 1.10, 4).translate(dtPierX + 0.8, lakeY + 0.92, dtPierZ + 6.4)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w9DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 2.85, 4).translate(dtPierX + ox, lakeY + 1.42, dtPierZ - 8.5 + oz));
    }
  }
  // 3200: Distant outer highland pine clusters (>= 11m clear of Villa #6, Cherry-Blossom Terrace & Villa #5!)
  for (const [px, pz] of [[fv6X - 11.5, fv6Z + 2.0], [cb9X + 11.5, cb9Z + 4.5], [fv5X - 11.5, fv5Z + 14.0]] as const) {
    const py = ctx.getHeight(px, pz);
    w9DlWood.push(new THREE.CylinderGeometry(0.18, 0.25, 5.6, 4).translate(px, py + 1.8, pz));
    w9DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.3, 5.2, 4).translate(px, py + 6.0, pz), '#1d4f26'));
  }

  const w9DlWoodM = new THREE.Mesh(mergeNormalized(w9DlWood), ctx.materials.darkWood);
  w9DlWoodM.castShadow = false;
  const w9DlStoneM = new THREE.Mesh(mergeNormalized(w9DlStone), ctx.materials.stone);
  w9DlStoneM.castShadow = false;
  const w9DlFlowerM = new THREE.Mesh(mergeNormalized(w9DlFlower), flowerMat);
  w9DlFlowerM.castShadow = false;
  const w9DlPlasterM = new THREE.Mesh(mergeNormalized(w9DlPlaster), ctx.materials.whitePlaster);
  w9DlPlasterM.castShadow = false;
  const w9DlGoldM = new THREE.Mesh(mergeNormalized(w9DlGold), ctx.materials.gold);
  w9DlGoldM.castShadow = false;
  group.add(w9DlWoodM, w9DlStoneM, w9DlFlowerM, w9DlPlasterM, w9DlGoldM);

  // Wave 10 Upgrades (Items 3576–3598, 3600): 7th French Colonial Pine Villa, Đà Lạt Hydrangea
  // Conservatory Pergola Terrace, Ga Đà Lạt 7th Vintage Coach & Semaphore Signal, Hồ Đa Thiện South Boathouse & Pines
  const w10DlWood: THREE.BufferGeometry[] = [];
  const w10DlStone: THREE.BufferGeometry[] = [];
  const w10DlFlower: THREE.BufferGeometry[] = [];
  const w10DlPlaster: THREE.BufferGeometry[] = [];
  const w10DlGold: THREE.BufferGeometry[] = [];

  // 3576–3582: Biệt Thự Pháp Cổ #7 (7th French Colonial Hillside Pine Villa at cx - 52.0, cz - 18.0)
  const fv7X = cx - 52.0;
  const fv7Z = cz - 18.0;
  const fv7Y = Math.max(ctx.getHeight(fv7X, fv7Z), ctx.getHeight(fv7X - 4.4, fv7Z - 4.0), ctx.getHeight(fv7X + 4.4, fv7Z + 4.0));
  w10DlStone.push(new THREE.BoxGeometry(9.0, 6.8, 8.0).translate(fv7X, fv7Y - 3.25, fv7Z));
  w10DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(6.8, 5.1, 5.8).translate(fv7X - 0.5, fv7Y + 2.70, fv7Z), '#f5e1b8'),
    colorizeForMerge(new THREE.ConeGeometry(5.4, 2.6, 4).rotateY(Math.PI * 0.25).translate(fv7X - 0.5, fv7Y + 6.50, fv7Z), '#b4422c'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv7X + 4.6, fv7Y + 0.40, fv7Z - 2.3), '#7d9af0'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv7X + 4.6, fv7Y + 0.40, fv7Z + 2.3), '#e67aa4')
  );
  w10DlPlaster.push(
    new THREE.BoxGeometry(1.40, 1.20, 1.60).translate(fv7X + 1.8, fv7Y + 5.75, fv7Z),
    new THREE.BoxGeometry(0.92, 7.2, 0.92).translate(fv7X - 3.4, fv7Y + 3.8, fv7Z - 2.1)
  );
  w10DlWood.push(new THREE.BoxGeometry(2.1, 0.22, 5.6).translate(fv7X + 3.7, fv7Y + 3.12, fv7Z));
  for (const pzO of [-2.4, -0.8, 0.8, 2.4]) {
    w10DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.15, 4).translate(fv7X + 4.5, fv7Y + 1.58, fv7Z + pzO));
  }
  w10DlStone.push(
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv7X + 6.6, fv7Y + 1.0, fv7Z - 1.7),
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv7X + 6.6, fv7Y + 1.0, fv7Z + 1.7)
  );
  w10DlGold.push(new THREE.BoxGeometry(0.16, 0.26, 3.2).translate(fv7X + 6.6, fv7Y + 2.18, fv7Z));

  // 3583–3589: Vườn Hoa Cẩm Tú Cầu & Nhà Kính Đà Lạt (Hydrangea Conservatory Pergola Terrace at cx + 48.0, cz - 14.0)
  const hc10X = cx + 48.0;
  const hc10Z = cz - 14.0;
  const hc10Y = Math.max(ctx.getHeight(hc10X, hc10Z), ctx.getHeight(hc10X - 4.5, hc10Z - 4.0), ctx.getHeight(hc10X + 4.5, hc10Z + 4.0));
  w10DlStone.push(new THREE.BoxGeometry(9.4, 6.0, 8.4).translate(hc10X, hc10Y - 2.85, hc10Z));
  w10DlPlaster.push(
    new THREE.BoxGeometry(3.8, 0.22, 3.4).translate(hc10X, hc10Y + 3.05, hc10Z),
    new THREE.ConeGeometry(2.8, 1.25, 4).rotateY(Math.PI * 0.25).translate(hc10X, hc10Y + 3.75, hc10Z),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(hc10X - 4.3, hc10Y + 1.65, hc10Z - 1.4),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(hc10X - 4.3, hc10Y + 1.65, hc10Z + 1.4),
    new THREE.BoxGeometry(0.26, 0.32, 3.2).translate(hc10X - 4.3, hc10Y + 3.32, hc10Z)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w10DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 4).translate(hc10X + ox, hc10Y + 1.52, hc10Z + oz));
    }
  }
  w10DlWood.push(
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(hc10X, hc10Y + 0.42, hc10Z),
    new THREE.BoxGeometry(1.85, 0.46, 0.52).translate(hc10X + 2.8, hc10Y + 0.42, hc10Z + 2.8)
  );
  for (const [px, pz, col] of [[-2.4, -2.4, '#6d8fe8'], [2.6, 2.4, '#9a7be0'], [-2.4, 2.4, '#e67aa4']] as const) {
    w10DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.0, 1.18, 0.48, 5).translate(hc10X + px, hc10Y + 0.40, hc10Z + pz), col));
  }

  // 3590–3598, 3600: Ga Đà Lạt 7th vintage rail coach, east lamp-post, west coffee kiosk, semaphore signal,
  // Hồ Đa Thiện south boathouse canopy & 7th swan-boat, Langbiang south photo frame & outer highland pines
  w10DlWood.push(
    new THREE.BoxGeometry(6.8, 2.30, 2.20).translate(gaX + 58.5, gaTopY + 1.42, trackZ),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 4).translate(gaX + 32.5, gaTopY + 1.90, gaZ + 4.5),
    // 3592: 4-post heritage railway coffee kiosk (gaX - 24.5, gaZ + 4.5)
    new THREE.BoxGeometry(3.2, 0.20, 2.6).translate(gaX - 24.5, gaTopY + 2.95, gaZ + 4.5),
    new THREE.BoxGeometry(2.2, 0.85, 0.72).translate(gaX - 24.5, gaTopY + 0.55, gaZ + 4.5),
    // 3594: East railway semaphore signal mast
    new THREE.CylinderGeometry(0.10, 0.14, 4.6, 4).translate(gaX + 53.5, gaTopY + 2.30, trackZ - 3.6),
    new THREE.BoxGeometry(1.45, 0.22, 0.14).translate(gaX + 53.5, gaTopY + 4.15, trackZ - 3.0),
    // 3598: Langbiang south summit timber photo frame & viewing bench
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX - 1.2, lkY + 1.40, lkZ + 4.6),
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX + 1.2, lkY + 1.40, lkZ + 4.6),
    new THREE.BoxGeometry(2.8, 0.26, 0.26).translate(lkX, lkY + 2.82, lkZ + 4.6),
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(lkX + 2.8, lkY + 0.35, lkZ + 4.6)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w10DlWood.push(new THREE.CylinderGeometry(0.07, 0.08, 2.95, 4).translate(gaX - 24.5 + ox, gaTopY + 1.48, gaZ + 4.5 + oz));
    }
  }
  w10DlGold.push(
    new THREE.BoxGeometry(0.28, 0.34, 0.28).translate(gaX + 32.5, gaTopY + 3.92, gaZ + 4.5)
  );
  // 3595–3597: Hồ Đa Thiện south 4-post lakeside pine boathouse canopy & 7th white swan-boat pedalo
  w10DlPlaster.push(
    new THREE.BoxGeometry(3.6, 0.18, 3.0).translate(dtPierX, lakeY + 2.85, dtPierZ + 9.2),
    new THREE.BoxGeometry(2.1, 0.56, 1.10).translate(dtPierX + 4.2, lakeY + 0.35, dtPierZ + 6.4),
    new THREE.CylinderGeometry(0.14, 0.20, 1.10, 4).translate(dtPierX + 5.0, lakeY + 0.92, dtPierZ + 6.4)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w10DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 2.85, 4).translate(dtPierX + ox, lakeY + 1.42, dtPierZ + 9.2 + oz));
    }
  }
  // 3600: Distant outer highland pine clusters (>= 12m clear of Villa #7, Hydrangea Terrace & Villa #6!)
  for (const [px, pz] of [[fv7X - 12.0, fv7Z - 2.0], [hc10X + 12.0, hc10Z - 4.5], [fv6X - 12.0, fv6Z + 14.0]] as const) {
    const py = ctx.getHeight(px, pz);
    w10DlWood.push(new THREE.CylinderGeometry(0.18, 0.25, 5.6, 4).translate(px, py + 1.8, pz));
    w10DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.3, 5.2, 4).translate(px, py + 6.0, pz), '#1d4f26'));
  }

  const w10DlWoodM = new THREE.Mesh(mergeNormalized(w10DlWood), ctx.materials.darkWood);
  w10DlWoodM.castShadow = false;
  const w10DlStoneM = new THREE.Mesh(mergeNormalized(w10DlStone), ctx.materials.stone);
  w10DlStoneM.castShadow = false;
  const w10DlFlowerM = new THREE.Mesh(mergeNormalized(w10DlFlower), flowerMat);
  w10DlFlowerM.castShadow = false;
  const w10DlPlasterM = new THREE.Mesh(mergeNormalized(w10DlPlaster), ctx.materials.whitePlaster);
  w10DlPlasterM.castShadow = false;
  const w10DlGoldM = new THREE.Mesh(mergeNormalized(w10DlGold), ctx.materials.gold);
  w10DlGoldM.castShadow = false;
  group.add(w10DlWoodM, w10DlStoneM, w10DlFlowerM, w10DlPlasterM, w10DlGoldM);

  // Wave 11 Upgrades (Items 3976–3998, 4000): 8th French Colonial Pine Villa, Đà Lạt Mimosa & Rose
  // Conservatory Pergola Terrace, Ga Đà Lạt 8th Vintage Coach & Semaphore Signal, Hồ Đa Thiện East Boathouse & Pines
  const w11DlWood: THREE.BufferGeometry[] = [];
  const w11DlStone: THREE.BufferGeometry[] = [];
  const w11DlFlower: THREE.BufferGeometry[] = [];
  const w11DlPlaster: THREE.BufferGeometry[] = [];
  const w11DlGold: THREE.BufferGeometry[] = [];

  // 3976–3982: Biệt Thự Pháp Cổ #8 (8th French Colonial Hillside Pine Villa at cx - 52.0, cz + 22.0)
  const fv8X = cx - 52.0;
  const fv8Z = cz + 22.0;
  const fv8Y = Math.max(ctx.getHeight(fv8X, fv8Z), ctx.getHeight(fv8X - 4.4, fv8Z - 4.0), ctx.getHeight(fv8X + 4.4, fv8Z + 4.0));
  w11DlStone.push(new THREE.BoxGeometry(9.0, 6.8, 8.0).translate(fv8X, fv8Y - 3.25, fv8Z));
  w11DlFlower.push(
    colorizeForMerge(new THREE.BoxGeometry(6.8, 5.1, 5.8).translate(fv8X - 0.5, fv8Y + 2.70, fv8Z), '#d8ece2'),
    colorizeForMerge(new THREE.ConeGeometry(5.4, 2.6, 4).rotateY(Math.PI * 0.25).translate(fv8X - 0.5, fv8Y + 6.50, fv8Z), '#a83c28'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv8X + 4.6, fv8Y + 0.40, fv8Z - 2.3), '#f0c84b'),
    colorizeForMerge(new THREE.BoxGeometry(5.4, 0.55, 1.10).translate(fv8X + 4.6, fv8Y + 0.40, fv8Z + 2.3), '#e67aa4')
  );
  w11DlPlaster.push(
    new THREE.BoxGeometry(1.40, 1.20, 1.60).translate(fv8X + 1.8, fv8Y + 5.75, fv8Z),
    new THREE.BoxGeometry(0.92, 7.2, 0.92).translate(fv8X - 3.4, fv8Y + 3.8, fv8Z - 2.1)
  );
  w11DlWood.push(new THREE.BoxGeometry(2.1, 0.22, 5.6).translate(fv8X + 3.7, fv8Y + 3.12, fv8Z));
  for (const pzO of [-2.4, -0.8, 0.8, 2.4]) {
    w11DlWood.push(new THREE.CylinderGeometry(0.08, 0.10, 3.15, 4).translate(fv8X + 4.5, fv8Y + 1.58, fv8Z + pzO));
  }
  w11DlStone.push(
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv8X + 6.6, fv8Y + 1.0, fv8Z - 1.7),
    new THREE.BoxGeometry(0.72, 2.0, 0.72).translate(fv8X + 6.6, fv8Y + 1.0, fv8Z + 1.7)
  );
  w11DlGold.push(new THREE.BoxGeometry(0.16, 0.26, 3.2).translate(fv8X + 6.6, fv8Y + 2.18, fv8Z));

  // 3983–3989: Vườn Hoa Mimosa & Nhà Kính Đà Lạt (Mimosa & Rose Conservatory Pergola Terrace at cx + 48.0, cz + 32.0)
  const mm11X = cx + 48.0;
  const mm11Z = cz + 32.0;
  const mm11Y = Math.max(ctx.getHeight(mm11X, mm11Z), ctx.getHeight(mm11X - 4.5, mm11Z - 4.0), ctx.getHeight(mm11X + 4.5, mm11Z + 4.0));
  w11DlStone.push(new THREE.BoxGeometry(9.4, 6.0, 8.4).translate(mm11X, mm11Y - 2.85, mm11Z));
  w11DlPlaster.push(
    new THREE.BoxGeometry(3.8, 0.22, 3.4).translate(mm11X, mm11Y + 3.05, mm11Z),
    new THREE.ConeGeometry(2.8, 1.25, 4).rotateY(Math.PI * 0.25).translate(mm11X, mm11Y + 3.75, mm11Z),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(mm11X - 4.3, mm11Y + 1.65, mm11Z - 1.4),
    new THREE.CylinderGeometry(0.09, 0.11, 3.3, 4).translate(mm11X - 4.3, mm11Y + 1.65, mm11Z + 1.4),
    new THREE.BoxGeometry(0.26, 0.32, 3.2).translate(mm11X - 4.3, mm11Y + 3.32, mm11Z)
  );
  for (const ox of [-1.6, 1.6]) {
    for (const oz of [-1.4, 1.4]) {
      w11DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 3.05, 4).translate(mm11X + ox, mm11Y + 1.52, mm11Z + oz));
    }
  }
  w11DlWood.push(
    new THREE.BoxGeometry(2.0, 0.46, 0.54).translate(mm11X, mm11Y + 0.42, mm11Z),
    new THREE.BoxGeometry(1.85, 0.46, 0.52).translate(mm11X + 2.8, mm11Y + 0.42, mm11Z + 2.8)
  );
  for (const [px, pz, col] of [[-2.4, -2.4, '#f0c84b'], [2.6, 2.4, '#e67aa4'], [-2.4, 2.4, '#9a7be0']] as const) {
    w11DlFlower.push(colorizeForMerge(new THREE.CylinderGeometry(1.0, 1.18, 0.48, 5).translate(mm11X + px, mm11Y + 0.40, mm11Z + pz), col));
  }

  // 3990–3998, 4000: Ga Đà Lạt 8th vintage rail coach, west lamp-post, east tea kiosk, semaphore signal,
  // Hồ Đa Thiện east boathouse canopy & 8th swan-boat, Langbiang east photo frame & outer highland pines
  w11DlWood.push(
    new THREE.BoxGeometry(6.8, 2.30, 2.20).translate(gaX + 67.0, gaTopY + 1.42, trackZ),
    new THREE.CylinderGeometry(0.08, 0.10, 3.8, 4).translate(gaX - 28.5, gaTopY + 1.90, gaZ + 4.5),
    // 3992: 4-post heritage railway flower-and-artichoke tea kiosk (gaX + 30.5, gaZ + 4.5)
    new THREE.BoxGeometry(3.2, 0.20, 2.6).translate(gaX + 30.5, gaTopY + 2.95, gaZ + 4.5),
    new THREE.BoxGeometry(2.2, 0.85, 0.72).translate(gaX + 30.5, gaTopY + 0.55, gaZ + 4.5),
    // 3994: East railway semaphore signal mast
    new THREE.CylinderGeometry(0.10, 0.14, 4.6, 4).translate(gaX + 62.0, gaTopY + 2.30, trackZ - 3.6),
    new THREE.BoxGeometry(1.45, 0.22, 0.14).translate(gaX + 62.0, gaTopY + 4.15, trackZ - 3.0),
    // 3998: Langbiang east summit timber photo frame & viewing bench
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX + 5.2, lkY + 1.40, lkZ - 1.2),
    new THREE.BoxGeometry(0.22, 2.8, 0.22).translate(lkX + 5.2, lkY + 1.40, lkZ + 1.2),
    new THREE.BoxGeometry(0.26, 0.26, 2.8).translate(lkX + 5.2, lkY + 2.82, lkZ),
    new THREE.BoxGeometry(0.54, 0.46, 2.0).translate(lkX + 5.2, lkY + 0.35, lkZ + 2.8)
  );
  for (const ox of [-1.4, 1.4]) {
    for (const oz of [-1.1, 1.1]) {
      w11DlWood.push(new THREE.CylinderGeometry(0.07, 0.08, 2.95, 4).translate(gaX + 30.5 + ox, gaTopY + 1.48, gaZ + 4.5 + oz));
    }
  }
  w11DlGold.push(
    new THREE.BoxGeometry(0.28, 0.34, 0.28).translate(gaX - 28.5, gaTopY + 3.92, gaZ + 4.5)
  );
  // 3995–3997: Hồ Đa Thiện east 4-post lakeside pine boathouse canopy & 8th white swan-boat pedalo
  w11DlPlaster.push(
    new THREE.BoxGeometry(3.6, 0.18, 3.0).translate(dtPierX + 8.5, lakeY + 2.85, dtPierZ),
    new THREE.BoxGeometry(2.1, 0.56, 1.10).translate(dtPierX - 4.2, lakeY + 0.35, dtPierZ + 6.4),
    new THREE.CylinderGeometry(0.14, 0.20, 1.10, 4).translate(dtPierX - 5.0, lakeY + 0.92, dtPierZ + 6.4)
  );
  for (const ox of [-1.5, 1.5]) {
    for (const oz of [-1.2, 1.2]) {
      w11DlPlaster.push(new THREE.CylinderGeometry(0.08, 0.10, 2.85, 4).translate(dtPierX + 8.5 + ox, lakeY + 1.42, dtPierZ + oz));
    }
  }
  // 4000: Distant outer highland pine clusters (>= 12m clear of Villa #8, Mimosa Terrace & Villa #7!)
  for (const [px, pz] of [[fv8X - 12.5, fv8Z + 4.0], [mm11X + 12.5, mm11Z + 4.5], [fv7X - 12.5, fv7Z - 14.0]] as const) {
    const py = ctx.getHeight(px, pz);
    w11DlWood.push(new THREE.CylinderGeometry(0.18, 0.25, 5.6, 4).translate(px, py + 1.8, pz));
    w11DlFlower.push(colorizeForMerge(new THREE.ConeGeometry(2.3, 5.2, 4).translate(px, py + 6.0, pz), '#1d4f26'));
  }

  const w11DlWoodM = new THREE.Mesh(mergeNormalized(w11DlWood), ctx.materials.darkWood);
  w11DlWoodM.castShadow = false;
  const w11DlStoneM = new THREE.Mesh(mergeNormalized(w11DlStone), ctx.materials.stone);
  w11DlStoneM.castShadow = false;
  const w11DlFlowerM = new THREE.Mesh(mergeNormalized(w11DlFlower), flowerMat);
  w11DlFlowerM.castShadow = false;
  const w11DlPlasterM = new THREE.Mesh(mergeNormalized(w11DlPlaster), ctx.materials.whitePlaster);
  w11DlPlasterM.castShadow = false;
  const w11DlGoldM = new THREE.Mesh(mergeNormalized(w11DlGold), ctx.materials.gold);
  w11DlGoldM.castShadow = false;
  group.add(w11DlWoodM, w11DlStoneM, w11DlFlowerM, w11DlPlasterM, w11DlGoldM);

  group.add(stoneMesh, woodMesh, roofMesh, barkMesh, pineMesh, flowerMesh, bronzeMesh);
  ctx.scene.add(group);
  return group;
}

/**
 * 9. Biển hồ T'Nưng (-455, 42 lake / -405, 42 rim): 18m-tall traditional Gia Lai Nhà Rông
 *    axe-blade thatched communal longhouse anchored at (-404, 42) (y = 14m rim) with timber deck,
 *    grounded staircase stringers + basalt rim boulders framing the 85m sapphire crater lake.
 */
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
  buildMySonSanctuaryComplex(ctx);
  buildPoshanuTowers(ctx);
  buildDaLatLangbiang(ctx);
  buildBienHoTNungComplex(ctx);

  return { animatedUniforms };
}
