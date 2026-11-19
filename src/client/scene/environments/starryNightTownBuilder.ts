import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  PbrTextureSet,
  applyWorldSpaceWeathering,
  createCobblestonePbrTextures,
  createStoneMasonryPbrTextures,
  createTerracottaRoofPbrTextures,
  createOakBarkPbrTextures,
  createTimberBeamPbrTextures,
  createPlasterWallPbrTextures,
  createBotanicalLeafAtlasTexture
} from '../textures/pbrTextures';

export type HeightSampler = (x: number, z: number) => number;
export type NormalSampler = (x: number, z: number, target?: THREE.Vector3) => THREE.Vector3;

export interface StarryNightTownHandle {
  group: THREE.Group;
  windowMaterials: THREE.Material[];
  flickerLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number }>;
  chimneyPositions: Array<{ x: number; y: number; z: number }>;
  pbrSets: PbrTextureSet[];
  extraTextures: THREE.Texture[];
  extraMaterials: THREE.Material[];
  setAudioEnergy?: (bass: number, mid: number, treble: number) => void;
  update: (deltaTime: number, elapsedTime: number, windSpeed?: number, windDir?: [number, number]) => void;
}

interface TownhouseSpec {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rot: number;
  wallStyle: 'cream' | 'cobalt' | 'ochre';
  roofStyle: 'terracotta' | 'slate';
  roofType: 'gable' | 'hip';
  chimney: boolean;
  dormer?: boolean;
  flowerBox?: boolean;
  stories?: 1 | 2;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Matches the winding cobblestone road formula in starryGroundShader.ts.
 */
export function getTownRoadCenterX(z: number): number {
  return Math.sin(z * 0.07 + 0.6) * 6.0 + smoothstep(-25.0, -55.0, z) * 5.0;
}

/**
 * Winding Rhone / Provençal village stream centerline X(z).
 */
export function getStreamCenterX(z: number): number {
  return 15.5 + 3.5 * Math.sin(z * 0.065 + 0.5) + smoothstep(-20.0, -60.0, z) * 5.0;
}

/**
 * Exact metric distance to the cross-town cobblestone carriage boulevard ellipse,
 * matching starryGroundShader.ts `distToCarriageLane` so grass & wheat never clip into the road.
 */
export function getDistanceToCarriageLane(x: number, z: number): number {
  const ex = x / 27.0;
  const ez = (z + 35.5) / 4.2;
  const epLen = Math.max(Math.hypot(ex, ez), 0.0001);
  const epGradLen = Math.max(Math.hypot(ex / 27.0, ez / 4.2), 0.0001);
  return Math.abs(epLen - 1.0) / epGradLen;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapCoord(v: number, size: number): number {
  const m = v % size;
  return m < 0 ? m + size : m;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

interface StrokeSpec {
  count: number;
  minLen: number;
  maxLen: number;
  minW: number;
  maxW: number;
  baseAngle: number;
  angleSpread: number;
  palette: Array<[number, number, number]>;
  seed: number;
  ridgeStrength?: number;
}

/**
 * Generates a tileable Van Gogh directional impasto oil-painted DataTexture.
 */
function createOilStrokeTexture(
  size: number,
  bg: [number, number, number],
  spec: StrokeSpec,
  bumpOut?: Uint8Array
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    data[idx] = bg[0];
    data[idx + 1] = bg[1];
    data[idx + 2] = bg[2];
    data[idx + 3] = 255;
    if (bumpOut) {
      bumpOut[idx] = 110;
      bumpOut[idx + 1] = 110;
      bumpOut[idx + 2] = 110;
      bumpOut[idx + 3] = 255;
    }
  }

  const rand = mulberry32(spec.seed);
  const ridgeStrength = spec.ridgeStrength ?? 0.35;

  for (let s = 0; s < spec.count; s++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const len = spec.minLen + rand() * (spec.maxLen - spec.minLen);
    const width = spec.minW + rand() * (spec.maxW - spec.minW);
    const angle = spec.baseAngle + (rand() - 0.5) * spec.angleSpread;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const col = spec.palette[Math.floor(rand() * spec.palette.length)];
    const brightness = 0.86 + rand() * 0.28;
    const curveAmp = (rand() - 0.5) * width * 0.7;

    const halfL = len * 0.5;
    const halfW = width * 0.5;
    const bound = Math.ceil(halfL + halfW + 2);

    for (let dy = -bound; dy <= bound; dy++) {
      for (let dx = -bound; dx <= bound; dx++) {
        // Local stroke space
        const along = dx * ca + dy * sa;
        const tAlong = along / Math.max(halfL, 0.001);
        if (Math.abs(tAlong) > 1.0) continue;

        const across = -dx * sa + dy * ca - Math.sin(tAlong * Math.PI) * curveAmp;
        const tAcross = across / Math.max(halfW, 0.001);
        const distSq = tAlong * tAlong * 0.85 + tAcross * tAcross;
        if (distSq > 1.0) continue;

        const px = wrapCoord(Math.floor(cx + dx), size);
        const py = wrapCoord(Math.floor(cy + dy), size);
        const idx = (py * size + px) * 4;

        // Paint bristles + raised edge impasto ridge
        const bristle = Math.sin(tAcross * 9.0 + s * 1.7) * 0.09;
        const edgeRidge = Math.exp(-Math.pow((1.0 - Math.sqrt(distSq)) * 3.8, 2)) * ridgeStrength;
        const alpha = smoothstep(1.0, 0.45, distSq);
        const shade = brightness + bristle + edgeRidge * 0.45;

        const r = clampByte(col[0] * shade);
        const g = clampByte(col[1] * shade);
        const b = clampByte(col[2] * shade);

        data[idx] = clampByte(data[idx] * (1 - alpha) + r * alpha);
        data[idx + 1] = clampByte(data[idx + 1] * (1 - alpha) + g * alpha);
        data[idx + 2] = clampByte(data[idx + 2] * (1 - alpha) + b * alpha);

        if (bumpOut) {
          const bumpVal = clampByte(130 + (1 - distSq) * 80 + bristle * 140 + edgeRidge * 95);
          bumpOut[idx] = clampByte(bumpOut[idx] * (1 - alpha) + bumpVal * alpha);
          bumpOut[idx + 1] = bumpOut[idx];
          bumpOut[idx + 2] = bumpOut[idx];
        }
      }
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createImpastoBumpTexture(size: number): THREE.DataTexture {
  const bumpData = new Uint8Array(size * size * 4);
  createOilStrokeTexture(
    size,
    [118, 118, 118],
    {
      count: 680,
      minLen: 8,
      maxLen: 22,
      minW: 3,
      maxW: 7,
      baseAngle: 0.25,
      angleSpread: 1.6,
      palette: [
        [155, 155, 155],
        [185, 185, 185],
        [110, 110, 110]
      ],
      seed: 9173,
      ridgeStrength: 0.55
    },
    bumpData
  );
  const bumpTex = new THREE.DataTexture(bumpData, size, size, THREE.RGBAFormat);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.magFilter = THREE.LinearFilter;
  bumpTex.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTex.generateMipmaps = true;
  bumpTex.needsUpdate = true;
  return bumpTex;
}

function createTerracottaTileTexture(size: number): THREE.DataTexture {
  const tex = createOilStrokeTexture(size, [112, 44, 24], {
    count: 520,
    minLen: 10,
    maxLen: 24,
    minW: 4,
    maxW: 8,
    baseAngle: Math.PI * 0.5,
    angleSpread: 0.35,
    palette: [
      [186, 76, 40],
      [216, 106, 56],
      [134, 51, 27],
      [230, 145, 76],
      [158, 66, 42]
    ],
    seed: 3341,
    ridgeStrength: 0.42
  });

  // Overlay subtle Spanish barrel-tile courses
  const data = tex.image.data as Uint8Array;
  const cols = 8;
  const rows = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = (x / size) * cols;
      const v = (y / size) * rows;
      const tileCurve = Math.sin((u % 1.0) * Math.PI);
      const rowLip = smoothstep(0.86, 1.0, v % 1.0);
      const mult = 0.72 + tileCurve * 0.38 - rowLip * 0.32;
      data[idx] = clampByte(data[idx] * mult);
      data[idx + 1] = clampByte(data[idx + 1] * mult);
      data[idx + 2] = clampByte(data[idx + 2] * mult);
    }
  }
  tex.needsUpdate = true;
  return tex;
}

function createCobbleTexture(size: number): THREE.DataTexture {
  const tex = createOilStrokeTexture(size, [56, 72, 112], {
    count: 600,
    minLen: 8,
    maxLen: 16,
    minW: 4,
    maxW: 8,
    baseAngle: 0.1,
    angleSpread: Math.PI,
    palette: [
      [88, 110, 162],
      [112, 134, 184],
      [74, 92, 136],
      [152, 138, 112]
    ],
    seed: 5519
  });

  const data = tex.image.data as Uint8Array;
  const rows = 10;
  const cols = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const row = Math.floor((y / size) * rows);
      const u = ((x / size) * cols + (row % 2) * 0.5) % 1.0;
      const v = ((y / size) * rows) % 1.0;
      const edge = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
      const mortar = smoothstep(0.05, 0.16, edge);
      const crown = 0.86 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.24;
      const factor = (0.64 + 0.36 * mortar) * crown;
      data[idx] = clampByte(data[idx] * factor);
      data[idx + 1] = clampByte(data[idx + 1] * factor);
      data[idx + 2] = clampByte(data[idx + 2] * factor);
    }
  }
  tex.needsUpdate = true;
  return tex;
}

function createWindowPaneTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;

      // Recessed dark nocturnal glass frame + subtle interior curtain folds + warm hearth depth
      const outerBorder = u < 0.09 || u > 0.91 || v < 0.09 || v > 0.91;
      const vBar = Math.abs(u - 0.5) < 0.032;
      const hBar1 = Math.abs(v - 0.36) < 0.028;
      const hBar2 = Math.abs(v - 0.67) < 0.028;

      if (outerBorder || vBar || hBar1 || hBar2) {
        data[idx] = 28;
        data[idx + 1] = 20;
        data[idx + 2] = 18;
        data[idx + 3] = 255;
      } else {
        // Interior curtain drape silhouettes on left/right jambs + warm receding room hearth center
        const curtainMask = smoothstep(0.24, 0.08, Math.min(u, 1.0 - u)) * (0.72 + 0.28 * Math.sin(u * 42.0 + v * 4.0));
        const dx = (u - 0.5) * 1.65;
        const dy = (v - 0.40) * 1.45;
        const roomDepthGlow = Math.exp(-(dx * dx + dy * dy) * 2.1);
        const upperGlassReflect = smoothstep(0.55, 0.92, v) * 0.45;

        let r = 138 + 117 * roomDepthGlow;
        let g = 88 + 118 * roomDepthGlow;
        let b = 34 + 58 * roomDepthGlow + 28 * upperGlassReflect;

        // Warm umber-crimson drawn interior curtains
        r = r * (1.0 - curtainMask * 0.62) + 96 * curtainMask * 0.62;
        g = g * (1.0 - curtainMask * 0.70) + 48 * curtainMask * 0.70;
        b = b * (1.0 - curtainMask * 0.75) + 28 * curtainMask * 0.75;

        data[idx] = clampByte(r);
        data[idx + 1] = clampByte(g);
        data[idx + 2] = clampByte(b);
        data[idx + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRoseWindowTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = (x / size - 0.5) * 2.0;
      const v = (y / size - 0.5) * 2.0;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);

      const spoke = Math.abs(Math.sin(a * 6.0));
      const ring1 = Math.abs(r - 0.36);
      const ring2 = Math.abs(r - 0.72);
      const outer = r > 0.88;

      if (outer || ring1 < 0.045 || ring2 < 0.045 || (spoke < 0.14 && r > 0.16)) {
        data[idx] = 28;
        data[idx + 1] = 35;
        data[idx + 2] = 58;
        data[idx + 3] = 255;
      } else {
        const petal = Math.sin(a * 12.0) * 0.5 + 0.5;
        const innerGlow = Math.exp(-r * r * 1.4);
        data[idx] = clampByte(215 + 40 * innerGlow);
        data[idx + 1] = clampByte(120 + 95 * innerGlow + 30 * petal);
        data[idx + 2] = clampByte(40 + 90 * (1 - petal) + 65 * innerGlow);
        data[idx + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function initTextureOnRenderer(renderer: THREE.WebGLRenderer | undefined, tex: THREE.Texture): void {
  if (renderer && typeof (renderer as any).initTexture === 'function') {
    try {
      (renderer as any).initTexture(tex);
    } catch {
      // Safe no-op on mock headless renderers
    }
  }
}

/**
 * Prepares any BufferGeometry for safe merging (non-indexed, position+normal+uv present).
 */
function prepareForMerge(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  uvTileX = 1,
  uvTileY = 1
): THREE.BufferGeometry {
  const geo = source.index ? source.toNonIndexed() : source.clone();
  geo.applyMatrix4(matrix);

  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  if (!geo.attributes.uv) {
    const count = geo.attributes.position.count;
    const uvs = new Float32Array(count * 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = (pos.getX(i) + pos.getZ(i)) * 0.25;
      uvs[i * 2 + 1] = pos.getY(i) * 0.25;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  } else if (uvTileX !== 1 || uvTileY !== 1) {
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setXY(i, uvAttr.getX(i) * uvTileX, uvAttr.getY(i) * uvTileY);
    }
  }

  // Keep only canonical attributes so mergeGeometries never mismatches
  for (const attrName of Object.keys(geo.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      geo.deleteAttribute(attrName);
    }
  }
  return geo;
}

class GeometryBucketBuilder {
  private buckets = new Map<string, THREE.BufferGeometry[]>();
  private tempVec = new THREE.Vector3();
  private tempQuat = new THREE.Quaternion();
  private tempScale = new THREE.Vector3(1, 1, 1);
  private tempMat = new THREE.Matrix4();

  public add(
    bucket: string,
    protoGeo: THREE.BufferGeometry,
    pos: [number, number, number],
    rotEuler?: [number, number, number],
    scale?: [number, number, number],
    uvTileX = 1,
    uvTileY = 1
  ): void {
    this.tempVec.set(pos[0], pos[1], pos[2]);
    if (rotEuler) {
      this.tempQuat.setFromEuler(new THREE.Euler(rotEuler[0], rotEuler[1], rotEuler[2], 'YXZ'));
    } else {
      this.tempQuat.identity();
    }
    if (scale) {
      this.tempScale.set(scale[0], scale[1], scale[2]);
    } else {
      this.tempScale.set(1, 1, 1);
    }
    this.tempMat.compose(this.tempVec, this.tempQuat, this.tempScale);
    const prepared = prepareForMerge(protoGeo, this.tempMat, uvTileX, uvTileY);

    let list = this.buckets.get(bucket);
    if (!list) {
      list = [];
      this.buckets.set(bucket, list);
    }
    list.push(prepared);
  }

  public addMatrix(
    bucket: string,
    protoGeo: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    uvTileX = 1,
    uvTileY = 1
  ): void {
    const prepared = prepareForMerge(protoGeo, matrix, uvTileX, uvTileY);
    let list = this.buckets.get(bucket);
    if (!list) {
      list = [];
      this.buckets.set(bucket, list);
    }
    list.push(prepared);
  }

  public buildMeshes(
    targetGroup: THREE.Group,
    materials: Record<string, THREE.Material>,
    meshPrefix: string
  ): void {
    for (const [bucketKey, geos] of this.buckets.entries()) {
      const mat = materials[bucketKey];
      if (!mat || geos.length === 0) {
        geos.forEach((g) => g.dispose());
        continue;
      }
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat);
        // Never use 'star' or 'halo' in mesh names (reserved for StarHalo_1..11)
        mesh.name = `${meshPrefix}_${bucketKey}`;
        const isEmissiveBucket =
          bucketKey === 'windowGlow' || bucketKey === 'roseWindow' || bucketKey === 'gildedAccent';
        mesh.castShadow = !isEmissiveBucket && bucketKey !== 'cobblePlaza';
        mesh.receiveShadow = !isEmissiveBucket;
        targetGroup.add(mesh);
      }
    }
    this.buckets.clear();
  }
}

/**
 * Generates a triangular prism geometry for gabled building walls.
 */
function createGablePrismGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a contoured plaza/terrace paving slab resting smoothly on terrain height.
 */
function createContouredPlazaGeometry(
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  segX: number,
  segZ: number,
  yOffset: number,
  getHeight: HeightSampler
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = centerX + pos.getX(i);
    const wz = centerZ + pos.getZ(i);
    const wy = getHeight(wx, wz) + yOffset;
    pos.setXYZ(i, wx, wy, wz);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a smooth spline railway viaduct curve across the valley north of the town.
 */
function createRailwayCurve(getHeight: HeightSampler): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = THREE.MathUtils.lerp(-104, 104, t);
    const z = -66.5 - 3.5 * Math.cos(x * 0.025);
    // Tall Provençal arched railway viaduct rising cleanly into town panorama sightlines
    const groundY = getHeight(x, z);
    const y = Math.max(groundY + 3.8, 2.35);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

/**
 * Evaluates a point and forward tangent along the cross-town cobblestone carriage loop.
 */
function getBridgeDeckElevation(x: number, z: number, getHeight: HeightSampler): number {
  const streamX = getStreamCenterX(z);
  const distToStream = Math.abs(x - streamX);
  const bridgeSpan = 3.4;
  if (distToStream >= bridgeSpan) return 0.0;
  // Smooth arch crown rising over the stone stream bridge at carriage crossings
  const u = 1.0 - distToStream / bridgeSpan;
  const archProfile = u * u * (3 - 2 * u);
  const waterY = Math.max(getHeight(streamX - 2.1, z), getHeight(streamX, z), getHeight(streamX + 2.1, z)) + 0.14;
  const deckY = waterY + 0.72 * archProfile + 0.18;
  return Math.max(0.0, deckY - getHeight(x, z));
}

function evaluateCarriageLoop(
  theta: number,
  getHeight: HeightSampler,
  outPos: THREE.Vector3,
  outDir: THREE.Vector3
): void {
  const rx = 26.5;
  const rz = 4.2;
  const cz = -35.5;
  const x = rx * Math.cos(theta);
  const z = cz + rz * Math.sin(theta);
  const y = getHeight(x, z) + getBridgeDeckElevation(x, z, getHeight);

  const dx = -rx * Math.sin(theta);
  const dz = rz * Math.cos(theta);
  const nextX = x + dx * 0.02;
  const nextZ = z + dz * 0.02;
  const nextY = getHeight(nextX, nextZ) + getBridgeDeckElevation(nextX, nextZ, getHeight);

  outPos.set(x, y, z);
  outDir.set(nextX - x, nextY - y, nextZ - z).normalize();
}

export function buildStarryNightTown(
  scene: THREE.Scene,
  getHeight: HeightSampler,
  getNormal: NormalSampler,
  renderer?: THREE.WebGLRenderer,
  sharedCobblePbr?: PbrTextureSet
): StarryNightTownHandle {
  const townRoot = new THREE.Group();
  townRoot.name = 'SleepingVillage';

  // 1. Procedural 512x512 PBR Texture Sets + Van Gogh Oil-Painted Brushstroke Maps
  const hasWebGLContext = Boolean(renderer && typeof (renderer as any).getContext === 'function');
  const pbrSize = hasWebGLContext ? 512 : 256;
  const ownCobblePbr = !sharedCobblePbr;
  const cobblePbr =
    sharedCobblePbr ??
    createCobblestonePbrTextures({ size: pbrSize, seed: 101, renderer, normalStrength: 3.4 });
  const stonePbr = createStoneMasonryPbrTextures({ size: pbrSize, seed: 202, renderer, normalStrength: 3.1 });
  const terracottaPbr = createTerracottaRoofPbrTextures({
    size: pbrSize,
    seed: 303,
    variant: 'terracotta',
    renderer,
    normalStrength: 3.3
  });
  const slatePbr = createTerracottaRoofPbrTextures({
    size: pbrSize,
    seed: 309,
    variant: 'teal',
    renderer,
    normalStrength: 3.0
  });
  const plasterPbr = createPlasterWallPbrTextures({ size: pbrSize, seed: 606, renderer, normalStrength: 1.75 });
  const timberPbr = createTimberBeamPbrTextures({ size: pbrSize, seed: 505, renderer, normalStrength: 2.2 });
  const oakBarkPbr = createOakBarkPbrTextures({ size: pbrSize, seed: 404, renderer, normalStrength: 3.4 });
  const leafAtlasTex = createBotanicalLeafAtlasTexture(renderer, pbrSize);

  const pbrSets: PbrTextureSet[] = [stonePbr, terracottaPbr, slatePbr, plasterPbr, timberPbr, oakBarkPbr];
  if (ownCobblePbr) {
    pbrSets.push(cobblePbr);
  }
  const extraTextures: THREE.Texture[] = [leafAtlasTex];
  const extraMaterials: THREE.Material[] = [];

  const impastoBumpTex = createImpastoBumpTexture(128);
  const creamPlasterTex = createOilStrokeTexture(256, [224, 206, 166], {
    count: 720,
    minLen: 10,
    maxLen: 26,
    minW: 4,
    maxW: 9,
    baseAngle: 0.12,
    angleSpread: 0.65,
    palette: [
      [242, 228, 192],
      [218, 194, 142],
      [168, 184, 214],
      [246, 236, 208],
      [196, 174, 132]
    ],
    seed: 1024
  });
  const cobaltWallTex = createOilStrokeTexture(256, [54, 82, 138], {
    count: 720,
    minLen: 10,
    maxLen: 24,
    minW: 4,
    maxW: 9,
    baseAngle: -0.08,
    angleSpread: 0.7,
    palette: [
      [74, 110, 176],
      [96, 136, 198],
      [44, 68, 118],
      [126, 152, 204],
      [165, 154, 128]
    ],
    seed: 2048
  });
  const windowPaneTex = createWindowPaneTexture(128);
  const roseWindowTex = createRoseWindowTexture(128);

  [
    impastoBumpTex,
    creamPlasterTex,
    cobaltWallTex,
    windowPaneTex,
    roseWindowTex
  ].forEach((tex) => initTextureOnRenderer(renderer, tex));

  // 2. Shared Painterly Impasto + 512x512 PBR Normal/Roughness/AO + World-Space Weathering Materials
  const materials: Record<string, THREE.Material> = {
    creamWall: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0xf4ebd6,
        map: creamPlasterTex,
        normalMap: plasterPbr.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: plasterPbr.roughnessMap,
        aoMap: plasterPbr.aoMap,
        aoMapIntensity: 0.62,
        roughness: 0.82,
        envMapIntensity: 1.15
      }),
      { macroScale: 0.22, mossHeight: -0.2, mossColor: '#22382b', dampRoughness: 0.48, dirtTint: '#3d3428' }
    ),
    cobaltWall: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0x93b6f4,
        map: cobaltWallTex,
        normalMap: plasterPbr.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: plasterPbr.roughnessMap,
        aoMap: plasterPbr.aoMap,
        aoMapIntensity: 0.66,
        roughness: 0.78,
        envMapIntensity: 1.20
      }),
      { macroScale: 0.20, mossHeight: -0.2, mossColor: '#1d323a', dampRoughness: 0.44, dirtTint: '#25324a' }
    ),
    ochreWall: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0xf2c66d,
        map: creamPlasterTex,
        normalMap: plasterPbr.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: plasterPbr.roughnessMap,
        aoMap: plasterPbr.aoMap,
        aoMapIntensity: 0.60,
        emissive: new THREE.Color(0x523108),
        emissiveIntensity: 0.45,
        roughness: 0.78,
        envMapIntensity: 1.15
      }),
      { macroScale: 0.22, mossHeight: -0.2, mossColor: '#2c3824', dampRoughness: 0.46, dirtTint: '#483822' }
    ),
    stonePlinth: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0x94addc,
        map: stonePbr.map,
        normalMap: stonePbr.normalMap,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: stonePbr.roughnessMap,
        aoMap: stonePbr.aoMap,
        aoMapIntensity: 0.82,
        roughness: 0.78,
        envMapIntensity: 1.25
      }),
      { macroScale: 0.24, mossHeight: 0.75, mossColor: '#25442b', dampRoughness: 0.34, dirtTint: '#2d3748' }
    ),
    cobblePlaza: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0x86a0d6,
        map: cobblePbr.map,
        normalMap: cobblePbr.normalMap,
        normalScale: new THREE.Vector2(1.75, 1.75),
        roughnessMap: cobblePbr.roughnessMap,
        aoMap: cobblePbr.aoMap,
        aoMapIntensity: 0.82,
        roughness: 0.32,
        metalness: 0.10,
        envMapIntensity: 1.85
      }),
      { macroScale: 0.18, mossHeight: 2.2, mossColor: '#1f362a', dampRoughness: 0.09, dirtTint: '#1a253b' }
    ),
    terracottaRoof: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0xe88654,
        map: terracottaPbr.map,
        normalMap: terracottaPbr.normalMap,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: terracottaPbr.roughnessMap,
        aoMap: terracottaPbr.aoMap,
        aoMapIntensity: 0.80,
        roughness: 0.74,
        envMapIntensity: 1.15
      }),
      { macroScale: 0.25, mossHeight: 0.0, mossColor: '#2d4628', dampRoughness: 0.42, dirtTint: '#462c22' }
    ),
    slateRoof: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0x6287d4,
        map: slatePbr.map,
        normalMap: slatePbr.normalMap,
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: slatePbr.roughnessMap,
        aoMap: slatePbr.aoMap,
        aoMapIntensity: 0.78,
        roughness: 0.62,
        envMapIntensity: 1.25
      }),
      { macroScale: 0.22, mossHeight: 0.0, mossColor: '#244038', dampRoughness: 0.32, dirtTint: '#202d48' }
    ),
    timberTrim: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0x465572,
        map: timberPbr.map,
        normalMap: timberPbr.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: timberPbr.roughnessMap,
        aoMap: timberPbr.aoMap,
        aoMapIntensity: 0.75,
        roughness: 0.74,
        envMapIntensity: 1.05
      }),
      { macroScale: 0.26, mossHeight: 0.3, mossColor: '#203828', dampRoughness: 0.42, dirtTint: '#282420' }
    ),
    chimneyBrick: applyWorldSpaceWeathering(
      new THREE.MeshStandardMaterial({
        color: 0xc46b4b,
        map: stonePbr.map,
        normalMap: stonePbr.normalMap,
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughnessMap: stonePbr.roughnessMap,
        aoMap: stonePbr.aoMap,
        aoMapIntensity: 0.80,
        roughness: 0.84
      }),
      { macroScale: 0.28, mossHeight: 0.0, mossColor: '#2a3c24', dampRoughness: 0.55, dirtTint: '#36221c' }
    ),
    windowGlow: new THREE.MeshStandardMaterial({
      color: 0xffe296,
      map: windowPaneTex,
      emissive: new THREE.Color(0xffb703),
      emissiveMap: windowPaneTex,
      emissiveIntensity: 2.35,
      roughness: 0.14,
      metalness: 0.12,
      envMapIntensity: 1.55
    }),
    windowGlass: new THREE.MeshPhysicalMaterial({
      color: 0x16243d,
      emissive: new THREE.Color(0x0c162b),
      emissiveIntensity: 0.16,
      roughness: 0.06,
      metalness: 0.10,
      transparent: true,
      opacity: 0.18,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.2
    }),
    curtainTrim: new THREE.MeshStandardMaterial({
      color: 0x7c4032,
      emissive: new THREE.Color(0x4a2214),
      emissiveIntensity: 0.40,
      roughness: 0.85
    }),
    cafeAwning: new THREE.MeshStandardMaterial({
      color: 0xf4b638,
      map: creamPlasterTex,
      normalMap: plasterPbr.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      emissive: new THREE.Color(0xc8720a),
      emissiveIntensity: 0.45,
      roughness: 0.72
    }),
    flowerFoliage: new THREE.MeshStandardMaterial({
      color: 0x2f6845,
      bumpMap: impastoBumpTex,
      bumpScale: 0.04,
      roughness: 0.86
    }),
    flowerBlossoms: new THREE.MeshStandardMaterial({
      color: 0xff7b39,
      emissive: new THREE.Color(0x9a3412),
      emissiveIntensity: 0.62,
      roughness: 0.65
    }),
    gildedAccent: new THREE.MeshStandardMaterial({
      color: 0xffeb9c,
      emissive: new THREE.Color(0xffbf1a),
      emissiveIntensity: 2.45,
      roughness: 0.24,
      metalness: 0.45
    }),
    roseWindow: new THREE.MeshStandardMaterial({
      color: 0xffe4a8,
      map: roseWindowTex,
      emissive: new THREE.Color(0xffc33a),
      emissiveMap: roseWindowTex,
      emissiveIntensity: 2.45,
      roughness: 0.28
    })
  };

  const windowMaterials: THREE.Material[] = [materials.windowGlow, materials.roseWindow, materials.gildedAccent];
  const flickerLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number }> = [];
  const chimneyPositions: Array<{ x: number; y: number; z: number }> = [];

  // Shared primitive unit geometries (disposed cleanly right after merging)
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const unitSphere = new THREE.SphereGeometry(0.5, 16, 12);
  const unitCone = new THREE.ConeGeometry(0.5, 1, 16);
  const unitOctCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  const unitCyl16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const unitArchHalf = new THREE.TorusGeometry(0.5, 0.14, 8, 16, Math.PI);

  // Beveled unit stone sill / coping / cornice block (1 x 1 x 1 normalized bounds)
  const bevelShape = new THREE.Shape();
  bevelShape.moveTo(-0.42, -0.35);
  bevelShape.lineTo(0.42, -0.35);
  bevelShape.lineTo(0.42, 0.35);
  bevelShape.lineTo(-0.42, 0.35);
  bevelShape.closePath();
  const unitBeveledStone = new THREE.ExtrudeGeometry(bevelShape, {
    depth: 0.70,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.08,
    bevelSegments: 2
  });
  unitBeveledStone.translate(0, 0, -0.35);
  unitBeveledStone.computeVertexNormals();

  // Paneled louvered wooden shutter prototype (1 x 1 x 1 normalized bounds)
  const shutterParts: THREE.BufferGeometry[] = [];
  const pushShutterBox = (px: number, py: number, pz: number, sx: number, sy: number, sz: number, rx = 0) => {
    const b = new THREE.BoxGeometry(sx, sy, sz);
    if (rx !== 0) b.rotateX(rx);
    b.translate(px, py, pz);
    shutterParts.push(b.toNonIndexed());
    b.dispose();
  };
  pushShutterBox(-0.40, 0, 0, 0.20, 1.0, 1.0); // left stile
  pushShutterBox(0.40, 0, 0, 0.20, 1.0, 1.0);  // right stile
  pushShutterBox(0, 0.43, 0, 0.62, 0.14, 1.0); // top rail
  pushShutterBox(0, 0.0, 0, 0.62, 0.10, 1.0);  // mid rail
  pushShutterBox(0, -0.43, 0, 0.62, 0.14, 1.0);// bottom rail
  for (let sl = -3; sl <= 3; sl++) {
    if (sl === 0) continue;
    pushShutterBox(0, sl * 0.11, 0.06, 0.58, 0.065, 0.65, 0.42);
  }
  const unitLouverShutter = mergeGeometries(shutterParts, false)!;
  shutterParts.forEach((p) => p.dispose());
  unitLouverShutter.computeVertexNormals();

  const builder = new GeometryBucketBuilder();
  const tempMat = new THREE.Matrix4();
  const tempGroup = new THREE.Object3D();

  // Helper to compose local-to-building matrix
  const addLocalBox = (
    parentPos: [number, number, number],
    parentRotY: number,
    bucket: string,
    localPos: [number, number, number],
    size: [number, number, number],
    localRot?: [number, number, number],
    uvTileX = 1,
    uvTileY = 1
  ) => {
    const pObj = new THREE.Object3D();
    pObj.position.set(parentPos[0], parentPos[1], parentPos[2]);
    pObj.rotation.set(0, parentRotY, 0);
    pObj.updateMatrix();

    tempGroup.position.set(localPos[0], localPos[1], localPos[2]);
    tempGroup.rotation.set(localRot?.[0] ?? 0, localRot?.[1] ?? 0, localRot?.[2] ?? 0, 'YXZ');
    tempGroup.scale.set(size[0], size[1], size[2]);
    tempGroup.updateMatrix();

    tempMat.multiplyMatrices(pObj.matrix, tempGroup.matrix);
    builder.addMatrix(bucket, unitBox, tempMat, uvTileX, uvTileY);
  };

  const addLocalMesh = (
    parentPos: [number, number, number],
    parentRotY: number,
    bucket: string,
    proto: THREE.BufferGeometry,
    localPos: [number, number, number],
    scale: [number, number, number],
    localRot?: [number, number, number],
    uvTileX = 1,
    uvTileY = 1
  ) => {
    const pObj = new THREE.Object3D();
    pObj.position.set(parentPos[0], parentPos[1], parentPos[2]);
    pObj.rotation.set(0, parentRotY, 0);
    pObj.updateMatrix();

    tempGroup.position.set(localPos[0], localPos[1], localPos[2]);
    tempGroup.rotation.set(localRot?.[0] ?? 0, localRot?.[1] ?? 0, localRot?.[2] ?? 0, 'YXZ');
    tempGroup.scale.set(scale[0], scale[1], scale[2]);
    tempGroup.updateMatrix();

    tempMat.multiplyMatrices(pObj.matrix, tempGroup.matrix);
    builder.addMatrix(bucket, proto, tempMat, uvTileX, uvTileY);
  };

  /**
   * Adds a recessed 3D architectural window assembly (deep interior warm room backing,
   * drawn side curtains, dark reflective glass pane, 3D vertical/horizontal muntin bars,
   * deep exterior timber casing, and beveled stone sill/lintel) so windows never read as flat yellow stickers!
   */
  const addDetailedWindow = (
    parentPos: [number, number, number],
    parentRotY: number,
    localCenter: [number, number, number],
    width: number,
    height: number,
    faceDir: 'front' | 'back' | 'left' | 'right',
    withShutters = false
  ) => {
    const isZ = faceDir === 'front' || faceDir === 'back';
    const sign = faceDir === 'front' || faceDir === 'right' ? 1 : -1;
    const rotY = isZ ? (sign > 0 ? 0 : Math.PI) : sign > 0 ? Math.PI / 2 : -Math.PI / 2;

    const pObj = new THREE.Object3D();
    pObj.position.set(parentPos[0], parentPos[1], parentPos[2]);
    pObj.rotation.set(0, parentRotY, 0);
    pObj.updateMatrix();

    const addWinBox = (
      bucket: string,
      lx: number,
      ly: number,
      lz: number,
      sx: number,
      sy: number,
      sz: number
    ) => {
      const localObj = new THREE.Object3D();
      localObj.position.set(localCenter[0], localCenter[1], localCenter[2]);
      localObj.rotation.set(0, rotY, 0);
      localObj.updateMatrix();

      const partObj = new THREE.Object3D();
      partObj.position.set(lx, ly, lz);
      partObj.scale.set(sx, sy, sz);
      partObj.updateMatrix();

      tempMat.multiplyMatrices(pObj.matrix, localObj.matrix).multiply(partObj.matrix);
      builder.addMatrix(bucket, unitBox, tempMat, 1, 1);
    };

    const addWinMesh = (
      bucket: string,
      proto: THREE.BufferGeometry,
      lx: number,
      ly: number,
      lz: number,
      sx: number,
      sy: number,
      sz: number
    ) => {
      const localObj = new THREE.Object3D();
      localObj.position.set(localCenter[0], localCenter[1], localCenter[2]);
      localObj.rotation.set(0, rotY, 0);
      localObj.updateMatrix();

      const partObj = new THREE.Object3D();
      partObj.position.set(lx, ly, lz);
      partObj.scale.set(sx, sy, sz);
      partObj.updateMatrix();

      tempMat.multiplyMatrices(pObj.matrix, localObj.matrix).multiply(partObj.matrix);
      builder.addMatrix(bucket, proto, tempMat, 1, 1);
    };

    // 1. Recessed warm glowing interior room plane (pushed cleanly ahead of solid masonry wall surface)
    addWinBox('windowGlow', 0, 0, 0.024, width * 0.88, height * 0.88, 0.024);
    // 2. Interior side curtains framing the warm room depth
    addWinBox('curtainTrim', -width * 0.34, 0, 0.042, width * 0.18, height * 0.86, 0.022);
    addWinBox('curtainTrim', width * 0.34, 0, 0.042, width * 0.18, height * 0.86, 0.022);
    // 3. Dark reflective nocturnal glass pane sitting ahead of interior curtains
    addWinBox('windowGlass', 0, 0, 0.058, width * 0.88, height * 0.88, 0.016);
    // 4. 3D exterior timber casing (left/right jambs + head + sill apron)
    const frameD = 0.12;
    const frameW = 0.065;
    addWinBox('timberTrim', -width * 0.47, 0, 0.064, frameW, height + frameW, frameD);
    addWinBox('timberTrim', width * 0.47, 0, 0.064, frameW, height + frameW, frameD);
    addWinBox('timberTrim', 0, height * 0.48, 0.064, width, frameW, frameD);
    addWinBox('timberTrim', 0, -height * 0.48, 0.064, width, frameW, frameD);
    // 5. 3D Muntin crossbars (1 vertical + 2 horizontal mullions)
    addWinBox('timberTrim', 0, 0, 0.076, 0.036, height * 0.90, 0.036);
    addWinBox('timberTrim', 0, height * 0.16, 0.076, width * 0.90, 0.032, 0.036);
    addWinBox('timberTrim', 0, -height * 0.16, 0.076, width * 0.90, 0.032, 0.036);
    // 6. Protruding beveled stone sill & lintel
    addWinMesh('stonePlinth', unitBeveledStone, 0, -height * 0.54, 0.10, width + 0.24, 0.11, 0.22);
    addWinMesh('stonePlinth', unitBeveledStone, 0, height * 0.54, 0.08, width + 0.16, 0.09, 0.16);

    if (withShutters) {
      addWinMesh('timberTrim', unitLouverShutter, -width * 0.68, 0, 0.08, width * 0.34, height, 0.07);
      addWinMesh('timberTrim', unitLouverShutter, width * 0.68, 0, 0.08, width * 0.34, height, 0.07);
    }
  };

  // =========================================================================
  // 3. Cobblestone Town Plaza Apron (extended cleanly under Café Terrace)
  // =========================================================================
  const plazaSlabGeo = createContouredPlazaGeometry(-2.5, -24.5, 27.5, 14.5, 14, 8, 0.03, getHeight);
  builder.addMatrix('cobblePlaza', plazaSlabGeo, new THREE.Matrix4(), 7.0, 3.8);
  plazaSlabGeo.dispose();

  // Café terrace elevated stone step
  const cafeX = -12.6;
  const cafeZ = -22.6;
  const cafeRotY = Math.PI * 0.42; // Faces East-Southeast toward plaza & spawn
  const cafeY = getHeight(cafeX, cafeZ);

  // =========================================================================
  // 4. Van Gogh's Iconic "Café Terrace at Night" Corner Building & Terrace
  // =========================================================================
  {
    const cw = 5.8;
    const ch = 6.2;
    const cd = 5.4;
    const base: [number, number, number] = [cafeX, cafeY, cafeZ];

    // Deep grounded foundation plinth (-1.5m into hill) + carved stone corner quoins
    addLocalBox(base, cafeRotY, 'stonePlinth', [0, -0.55, 0], [cw + 0.35, 1.5, cd + 0.35], undefined, 2, 1);
    for (const qx of [-cw * 0.49, cw * 0.49]) {
      for (const qz of [-cd * 0.49, cd * 0.49]) {
        addLocalBox(base, cafeRotY, 'stonePlinth', [qx, ch * 0.5, qz], [0.34, ch, 0.34], undefined, 0.5, 2.0);
      }
    }
    // Warm sunlit ochre lower café facade & upper cream facade + molded cornice band
    addLocalBox(base, cafeRotY, 'ochreWall', [0, 1.75, 0], [cw, 3.3, cd], undefined, 1.5, 1);
    addLocalBox(base, cafeRotY, 'stonePlinth', [0, 3.42, 0], [cw + 0.14, 0.16, cd + 0.14], undefined, 2, 0.25);
    addLocalBox(base, cafeRotY, 'creamWall', [0, 4.8, 0], [cw - 0.06, 2.8, cd - 0.06], undefined, 1.5, 1);

    // Terracotta hipped/gabled roof + overhanging eaves
    const roofH = 2.0;
    const gableGeo = createGablePrismGeometry(cw, roofH, cd);
    addLocalMesh(base, cafeRotY, 'creamWall', gableGeo, [0, ch, 0], [1, 1, 1], undefined, 0.25, 0.25);
    gableGeo.dispose();

    const slopeAngle = Math.atan2(roofH, cw * 0.5);
    const slopeLen = Math.hypot(cw * 0.5, roofH) + 0.45;
    addLocalBox(
      base,
      cafeRotY,
      'terracottaRoof',
      [-cw * 0.25 - 0.1, ch + roofH * 0.5, 0],
      [slopeLen, 0.18, cd + 0.65],
      [0, 0, slopeAngle],
      1.8,
      2.2
    );
    addLocalBox(
      base,
      cafeRotY,
      'terracottaRoof',
      [cw * 0.25 + 0.1, ch + roofH * 0.5, 0],
      [slopeLen, 0.18, cd + 0.65],
      [0, 0, -slopeAngle],
      1.8,
      2.2
    );
    // Chimney + beveled corbeled stone cap + twin terracotta pots & warm hearth ember glow
    addLocalBox(base, cafeRotY, 'chimneyBrick', [1.4, ch + 1.5, -1.2], [0.65, 2.0, 0.65], undefined, 0.6, 1);
    addLocalMesh(base, cafeRotY, 'stonePlinth', unitBeveledStone, [1.4, ch + 2.52, -1.2], [0.84, 0.18, 0.84], undefined, 0.5, 0.2);
    addLocalMesh(base, cafeRotY, 'chimneyBrick', unitCylinder, [1.26, ch + 2.74, -1.2], [0.22, 0.34, 0.22]);
    addLocalMesh(base, cafeRotY, 'chimneyBrick', unitCylinder, [1.54, ch + 2.74, -1.2], [0.22, 0.34, 0.22]);
    addLocalMesh(base, cafeRotY, 'gildedAccent', unitCylinder, [1.4, ch + 2.63, -1.2], [0.32, 0.08, 0.32]);
    const worldChim = new THREE.Vector3(1.4, ch + 2.75, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), cafeRotY);
    chimneyPositions.push({ x: cafeX + worldChim.x, y: cafeY + worldChim.y, z: cafeZ + worldChim.z });

    // Iconic Sloped Golden Saffron Café Awning projecting +3.4m toward plaza (+Z local) + timber ribs
    addLocalBox(
      base,
      cafeRotY,
      'cafeAwning',
      [0, 3.05, cd * 0.5 + 1.75],
      [cw + 0.5, 0.12, 3.65],
      [0.24, 0, 0],
      2.5,
      1.5
    );
    for (const rx of [-cw * 0.44, -cw * 0.15, cw * 0.15, cw * 0.44]) {
      addLocalBox(base, cafeRotY, 'timberTrim', [rx, 2.96, cd * 0.5 + 1.75], [0.08, 0.08, 3.60], [0.24, 0, 0]);
    }
    // Painted fascia lip on awning front edge
    addLocalBox(base, cafeRotY, 'timberTrim', [0, 2.58, cd * 0.5 + 3.52], [cw + 0.55, 0.14, 0.08]);
    // Wrought-iron awning support posts & beveled terrace stone curb
    addLocalBox(base, cafeRotY, 'timberTrim', [-cw * 0.46, 1.35, cd * 0.5 + 3.25], [0.1, 2.6, 0.1]);
    addLocalBox(base, cafeRotY, 'timberTrim', [cw * 0.46, 1.35, cd * 0.5 + 3.25], [0.1, 2.6, 0.1]);
    addLocalBox(base, cafeRotY, 'cobblePlaza', [0, -0.1, cd * 0.5 + 2.1], [cw + 0.9, 0.45, 4.3], undefined, 2.5, 2);
    addLocalMesh(base, cafeRotY, 'stonePlinth', unitBeveledStone, [0, 0.12, cd * 0.5 + 4.22], [cw + 1.0, 0.14, 0.28], undefined, 2.5, 0.3);

    // Bright recessed café French doors & windows + dark glass + 3D muntin bars + interior curtains + beveled stone sills
    for (const wx of [-1.7, 0, 1.7]) {
      // Ground-floor recessed glowing café window/doors with muntins & beveled stone lintels
      addDetailedWindow(base, cafeRotY, [wx, 1.55, cd * 0.5], 1.15, 2.05, 'front', false);
      // Upper-story recessed windows with dark glass, muntins, curtains & louvered shutters
      addDetailedWindow(base, cafeRotY, [wx, 4.75, cd * 0.5], 0.90, 1.25, 'front', true);
    }
    // Side windows
    addDetailedWindow(base, cafeRotY, [cw * 0.5, 4.75, 0.8], 0.95, 1.20, 'right', false);
    addDetailedWindow(base, cafeRotY, [cw * 0.5, 1.75, 0.8], 1.00, 1.40, 'right', false);

    // Glowing hanging terrace lantern under awning
    addLocalMesh(base, cafeRotY, 'gildedAccent', unitSphere, [0, 2.85, cd * 0.5 + 1.5], [0.32, 0.36, 0.32]);
    addLocalMesh(base, cafeRotY, 'gildedAccent', unitSphere, [-1.8, 2.72, cd * 0.5 + 2.4], [0.22, 0.24, 0.22]);
    addLocalMesh(base, cafeRotY, 'gildedAccent', unitSphere, [1.8, 2.72, cd * 0.5 + 2.4], [0.22, 0.24, 0.22]);

    // 5 Bistro Tables, Chairs & Candle Globes on the Outdoor Café Terrace
    const tableOffsets: Array<[number, number]> = [
      [-1.85, cd * 0.5 + 1.25],
      [0.05, cd * 0.5 + 1.45],
      [1.85, cd * 0.5 + 1.25],
      [-1.1, cd * 0.5 + 2.85],
      [1.25, cd * 0.5 + 2.85]
    ];
    for (const [tx, tz] of tableOffsets) {
      addLocalMesh(base, cafeRotY, 'timberTrim', unitCylinder, [tx, 0.46, tz], [0.07, 0.68, 0.07]);
      addLocalMesh(base, cafeRotY, 'creamWall', unitCylinder, [tx, 0.82, tz], [0.82, 0.06, 0.82]);
      addLocalMesh(base, cafeRotY, 'gildedAccent', unitCylinder, [tx, 0.93, tz], [0.12, 0.16, 0.12]);
      // Two bistro chairs per table
      for (const side of [-0.62, 0.62]) {
        addLocalMesh(base, cafeRotY, 'timberTrim', unitCylinder, [tx + side, 0.38, tz], [0.36, 0.05, 0.36]);
        addLocalBox(base, cafeRotY, 'timberTrim', [tx + side * 1.22, 0.64, tz], [0.06, 0.5, 0.34]);
        addLocalMesh(base, cafeRotY, 'timberTrim', unitCylinder, [tx + side, 0.2, tz], [0.05, 0.38, 0.05]);
      }
    }

    // Two organic layered floral terrace urns flanking the steps
    for (const ux of [-2.9, 2.9]) {
      addLocalMesh(base, cafeRotY, 'chimneyBrick', unitCylinder, [ux, 0.45, cd * 0.5 + 3.6], [0.55, 0.55, 0.55]);
      addLocalMesh(base, cafeRotY, 'stonePlinth', unitCylinder, [ux, 0.74, cd * 0.5 + 3.6], [0.64, 0.09, 0.64]);
      const sprigOffsets: Array<[number, number, number, number]> = [
        [0.0, 0.92, 0.0, 0.38],
        [-0.22, 0.86, 0.16, 0.30],
        [0.24, 0.88, -0.14, 0.32],
        [-0.16, 0.88, -0.20, 0.28],
        [0.18, 0.85, 0.20, 0.30]
      ];
      for (const [sx, sy, sz, ss] of sprigOffsets) {
        addLocalMesh(base, cafeRotY, 'flowerFoliage', unitSphere, [ux + sx, sy, cd * 0.5 + 3.6 + sz], [ss, ss * 0.85, ss]);
      }
      for (const [bx, by, bz] of [[-0.14, 1.06, 0.10], [0.16, 1.04, -0.08], [0.02, 1.12, 0.02]]) {
        addLocalMesh(base, cafeRotY, 'flowerBlossoms', unitSphere, [ux + bx, by, cd * 0.5 + 3.6 + bz], [0.16, 0.14, 0.16]);
      }
    }

    // Warm golden Café PointLight illuminating cobblestones & terrace
    const cafePos = new THREE.Vector3(0, 2.6, cd * 0.5 + 2.0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), cafeRotY)
      .add(new THREE.Vector3(cafeX, cafeY, cafeZ));
    const cafeLight = new THREE.PointLight(0xffb703, 3.8, 24.0, 1.5);
    cafeLight.position.copy(cafePos);
    townRoot.add(cafeLight);
    flickerLights.push({ light: cafeLight, baseIntensity: 3.8, phase: 0.4 });
  }

  // =========================================================================
  // 5. Central Stone Village Fountain (x = 1.2, z = -24.5)
  // =========================================================================
  const fountainX = 1.2;
  const fountainZ = -24.5;
  const fountainY = getHeight(fountainX, fountainZ);
  {
    const fBase: [number, number, number] = [fountainX, fountainY, fountainZ];
    // Stepped stone apron sinking -1.0m underground
    addLocalMesh(fBase, 0, 'stonePlinth', unitOctCyl, [0, -0.45, 0], [5.4, 1.1, 5.4], undefined, 3, 1);
    // Outer stone fountain rim (segmented 10-sided ring)
    const rimCount = 10;
    const basinR = 2.15;
    for (let i = 0; i < rimCount; i++) {
      const a = (i / rimCount) * Math.PI * 2;
      const sx = Math.cos(a) * basinR;
      const sz = Math.sin(a) * basinR;
      addLocalBox(fBase, 0, 'stonePlinth', [sx, 0.36, sz], [1.45, 0.62, 0.32], [0, -a + Math.PI / 2, 0], 1, 0.5);
    }
    // Central tiered pedestal & finial
    addLocalMesh(fBase, 0, 'stonePlinth', unitCylinder, [0, 0.72, 0], [0.75, 1.35, 0.75]);
    addLocalMesh(fBase, 0, 'stonePlinth', unitCylinder, [0, 1.28, 0], [1.45, 0.22, 1.45]);
    addLocalMesh(fBase, 0, 'stonePlinth', unitCylinder, [0, 1.72, 0], [0.38, 0.72, 0.38]);
    addLocalMesh(fBase, 0, 'stonePlinth', unitSphere, [0, 2.15, 0], [0.34, 0.34, 0.34]);

    // Soft fountain moonlight rim fill so carved stone basin & column read cleanly
    const fLight = new THREE.PointLight(0x88b8ff, 1.85, 18.0);
    fLight.position.set(fountainX - 0.5, fountainY + 2.8, fountainZ + 2.6);
    townRoot.add(fLight);
  }

  // Animated Moonlit Water Surface for Central Fountain (sky-sampled reflection + animated normal ripples)
  const fountainWaterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0.0 },
        uAudioEnergy: { value: 0.0 }
      }
    ]),
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uAudioEnergy;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      void main() {
        vec2 c = (vUv - 0.5) * 2.0;
        float r = length(c);
        float ripple1 = sin(r * 24.0 - uTime * 3.4 + sin(c.x * 7.0) * 1.1);
        float ripple2 = cos(c.x * 16.0 + c.y * 14.0 + uTime * 2.1);
        vec3 Nw = normalize(vec3(ripple1 * 0.14 + ripple2 * 0.08, 1.0, ripple2 * 0.14 - ripple1 * 0.08));
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 R = reflect(-V, Nw);
        R.y = abs(R.y);
        float fresnel = 0.12 + 0.88 * pow(max(1.0 - max(dot(Nw, V), 0.0), 0.0001), 3.6);
        vec3 moonDir = normalize(vec3(115.0, 125.0, -165.0));
        float moonGlint = pow(max(dot(R, moonDir), 0.0001), 42.0);
        float starRibbon = 0.5 + 0.5 * sin(R.x * 9.0 + R.z * 7.0 - uTime * 0.8);
        vec3 deepWater = vec3(0.014, 0.042, 0.145);
        vec3 skySample = mix(vec3(0.045, 0.125, 0.340), vec3(0.145, 0.310, 0.620), starRibbon);
        vec3 col = mix(deepWater, skySample, fresnel * 0.82);
        col += vec3(0.75, 0.56, 0.18) * (moonGlint * (0.75 + uAudioEnergy * 0.45) + smoothstep(0.45, 0.96, (ripple1 * 0.5 + 0.5) * (ripple2 * 0.5 + 0.5)) * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `
  });
  const fountainWaterGeo = new THREE.CircleGeometry(2.02, 24);
  fountainWaterGeo.rotateX(-Math.PI / 2);
  const fountainWaterMesh = new THREE.Mesh(fountainWaterGeo, fountainWaterMat);
  fountainWaterMesh.name = 'VillageFountainWater';
  fountainWaterMesh.position.set(fountainX, fountainY + 0.48, fountainZ);
  townRoot.add(fountainWaterMesh);

  // =========================================================================
  // 5b. Winding Starry-Sky Reflective Rhone/Village Stream + Embankments + Bridges
  // =========================================================================
  const streamSteps = 136;
  const streamZMin = -68.0;
  const streamZMax = 54.0;
  const streamHalfW = 2.15;
  const streamCols = 6;
  const streamPositions: number[] = [];
  const streamNormals: number[] = [];
  const streamUvs: number[] = [];
  const streamIndices: number[] = [];

  for (let iz = 0; iz <= streamSteps; iz++) {
    const tz = iz / streamSteps;
    const wz = THREE.MathUtils.lerp(streamZMax, streamZMin, tz);
    const cx = getStreamCenterX(wz);
    const nextZ = wz - 0.5;
    const dx = getStreamCenterX(nextZ) - cx;
    const tang = new THREE.Vector2(dx, -0.5).normalize();
    const perpX = -tang.y;
    const perpZ = tang.x;

    const waterY = Math.max(
      getHeight(cx - streamHalfW, wz),
      getHeight(cx, wz),
      getHeight(cx + streamHalfW, wz)
    ) + 0.14;

    for (let ix = 0; ix <= streamCols; ix++) {
      const tx = ix / streamCols;
      const offset = (tx - 0.5) * 2.0 * streamHalfW;
      const vx = cx + perpX * offset;
      const vz = wz + perpZ * offset;
      streamPositions.push(vx, waterY, vz);
      streamNormals.push(0, 1, 0);
      streamUvs.push(tx, tz * 22.0);
    }

    // Grounded stone embankment walls flanking both riverbanks (sunk -1.35m into hill)
    if (iz < streamSteps) {
      const ntz = (iz + 1) / streamSteps;
      const nwz = THREE.MathUtils.lerp(streamZMax, streamZMin, ntz);
      const ncx = getStreamCenterX(nwz);
      const midZ = (wz + nwz) * 0.5;
      const midX = (cx + ncx) * 0.5;
      const segAngle = Math.atan2(ncx - cx, nwz - wz);
      const segLen = Math.hypot(ncx - cx, nwz - wz) + 0.25;
      const bankY = waterY;
      for (const side of [-1, 1]) {
        const bx = midX + side * (streamHalfW + 0.28) * Math.cos(segAngle);
        const bz = midZ - side * (streamHalfW + 0.28) * Math.sin(segAngle);
        addLocalBox([bx, bankY - 0.52, bz], segAngle, 'stonePlinth', [0, 0, 0], [0.58, 1.48, segLen], undefined, 0.4, 0.8);
      }
    }
  }

  const streamStride = streamCols + 1;
  for (let iz = 0; iz < streamSteps; iz++) {
    for (let ix = 0; ix < streamCols; ix++) {
      const a = iz * streamStride + ix;
      const b = (iz + 1) * streamStride + ix;
      const c = (iz + 1) * streamStride + (ix + 1);
      const d = iz * streamStride + (ix + 1);
      streamIndices.push(a, b, d, b, c, d);
    }
  }

  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute('normal', new THREE.Float32BufferAttribute(streamNormals, 3));
  streamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(streamUvs, 2));
  streamGeo.setIndex(streamIndices);
  streamGeo.computeVertexNormals();
  streamGeo.computeBoundingSphere();

  const streamWaterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0.0 },
        uBassEnergy: { value: 0.0 },
        uTrebleEnergy: { value: 0.0 },
        uMoonDirection: { value: new THREE.Vector3(115, 125, -165).normalize() }
      }
    ]),
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uTrebleEnergy;
      uniform vec3 uMoonDirection;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      float wHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 41.23);
        return fract(p.x * p.y);
      }

      float wNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
          mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Sky-sampled Van Gogh swirling celestial reflection along reflected ray R
      vec3 sampleStarryReflection(vec3 R, float t) {
        vec3 d = normalize(vec3(R.x, max(R.y, 0.02), R.z));
        float swirlA = sin(d.x * 5.2 + d.z * 4.4 + t * 0.25) * cos(d.z * 3.8 - d.x * 2.9 - t * 0.18);
        float swirlB = wNoise(d.xz * 7.5 + vec2(t * 0.14, -t * 0.10));
        float ribbon = smoothstep(0.25, 0.85, swirlA * 0.45 + 0.45 + swirlB * 0.45);
        vec3 deepCobalt = vec3(0.020, 0.068, 0.245);
        vec3 cyanStream = vec3(0.115, 0.340, 0.680);
        vec3 ochreSwirl = vec3(0.620, 0.480, 0.140);
        vec3 skyCol = mix(deepCobalt, cyanStream, ribbon);
        skyCol = mix(skyCol, ochreSwirl, smoothstep(0.72, 0.96, swirlB * ribbon) * 0.55);
        // Star glints reflected across the sky dome
        float starCell = wNoise(d.xz * 28.0 + vec2(sin(t * 0.3) * 0.05));
        float starSpark = smoothstep(0.84, 0.98, starCell) * (0.65 + 0.35 * sin(t * 3.2 + d.x * 19.0));
        skyCol += vec3(1.0, 0.88, 0.48) * starSpark * 0.72;
        return skyCol;
      }

      void main() {
        float safeBass = clamp(uBassEnergy, 0.0, 1.5);
        float safeTreble = clamp(uTrebleEnergy, 0.0, 1.5);

        // Animated downstream flow & multi-octave normal ripples
        vec2 flowUv = vec2(vUv.x * 3.4, vUv.y * 1.4 - uTime * 0.58);
        float w1 = wNoise(flowUv * 2.6 + vec2(0.0, -uTime * 0.42));
        float w2 = wNoise(flowUv * 5.8 - vec2(uTime * 0.22, uTime * 0.75));
        float waveA = sin(vUv.y * 8.5 - uTime * 3.1 + vUv.x * 5.2 + w1 * 3.0);
        float waveB = cos(vUv.x * 11.0 + vUv.y * 5.4 - uTime * 2.4 + w2 * 2.5);

        float rippleAmp = 0.16 + safeBass * 0.05;
        vec3 Nw = normalize(vWorldNormal + vec3((waveA * 0.65 + (w1 - 0.5)) * rippleAmp, 0.0, (waveB * 0.65 + (w2 - 0.5)) * rippleAmp));
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 R = reflect(-V, Nw);

        float fresnel = clamp(0.10 + 0.90 * pow(max(1.0 - max(dot(Nw, V), 0.0), 0.0001), 3.4), 0.0, 1.0);
        vec3 skyRefl = sampleStarryReflection(R, uTime);

        // Crescent moon reflection column & audio-reactive shimmer glints
        vec3 L = normalize(uMoonDirection);
        vec3 H = normalize(L + V);
        float moonSpec = pow(max(dot(Nw, H), 0.0001), 58.0);
        float crestGlint = pow(max(waveA * 0.5 + 0.5, 0.0001), 6.0) * (0.4 + 0.6 * w2);
        float audioPulse = 1.0 + safeBass * 0.35 + safeTreble * 0.45;

        // Deep Prussian/viridian stream body + shoreline foam edge
        float bankEdge = 1.0 - smoothstep(0.0, 0.18, min(vUv.x, 1.0 - vUv.x));
        vec3 waterBody = mix(vec3(0.015, 0.055, 0.165), vec3(0.022, 0.115, 0.145), w1);
        vec3 col = mix(waterBody, skyRefl, fresnel * 0.88);
        col += vec3(0.95, 0.82, 0.42) * (moonSpec * 1.15 + crestGlint * 0.24) * audioPulse;
        col += vec3(0.18, 0.36, 0.72) * bankEdge * (0.35 + 0.25 * (waveA * 0.5 + 0.5));

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `
  });

  const streamMesh = new THREE.Mesh(streamGeo, streamWaterMat);
  streamMesh.name = 'RhoneVillageStream';
  townRoot.add(streamMesh);

  // Build 3 Arched Provençal Stone Bridges spanning the winding stream
  // (2 for the carriage boulevard crossings at z = -31.9 & -39.1, plus 1 village promenade footbridge at z = 4.0)
  const addStoneArchBridge = (bz: number, deckWidth: number) => {
    const bx = getStreamCenterX(bz);
    const waterY = Math.max(getHeight(bx - streamHalfW, bz), getHeight(bx, bz), getHeight(bx + streamHalfW, bz)) + 0.14;
    const bridgeBase: [number, number, number] = [bx, waterY, bz];
    const spanLen = 6.2;
    const archSteps = 9;
    for (let s = 0; s < archSteps; s++) {
      const t = (s + 0.5) / archSteps;
      const lx = (t - 0.5) * spanLen;
      const archH = Math.sin(t * Math.PI) * 0.72 + 0.18;
      const slope = Math.cos(t * Math.PI) * (0.72 * Math.PI / spanLen);
      const pitch = Math.atan(slope);
      addLocalBox(bridgeBase, 0, 'cobblePlaza', [lx, archH, 0], [spanLen / archSteps + 0.18, 0.24, deckWidth], [0, 0, pitch], 1, 1);
      // Low beveled stone parapet walls flanking the bridge deck
      for (const pz of [-deckWidth * 0.46, deckWidth * 0.46]) {
        addLocalBox(bridgeBase, 0, 'stonePlinth', [lx, archH + 0.42, pz], [spanLen / archSteps + 0.16, 0.65, 0.28], [0, 0, pitch], 0.8, 0.5);
        addLocalMesh(bridgeBase, 0, 'stonePlinth', unitBeveledStone, [lx, archH + 0.78, pz], [spanLen / archSteps + 0.20, 0.14, 0.36], [0, 0, pitch], 0.8, 0.2);
      }
    }
    // Bridge stone abutments & end piers sunk into riverbanks
    for (const side of [-1, 1]) {
      addLocalBox(bridgeBase, 0, 'stonePlinth', [side * 2.85, -0.35, 0], [1.1, 1.4, deckWidth + 0.4], undefined, 1.2, 0.8);
      for (const pz of [-deckWidth * 0.46, deckWidth * 0.46]) {
        addLocalBox(bridgeBase, 0, 'stonePlinth', [side * 3.1, 0.62, pz], [0.55, 1.15, 0.55]);
        addLocalMesh(bridgeBase, 0, 'stonePlinth', unitCone, [side * 3.1, 1.32, pz], [0.58, 0.32, 0.58], [0, Math.PI / 4, 0]);
      }
    }
  };
  addStoneArchBridge(-31.9, 3.2);
  addStoneArchBridge(-39.1, 3.2);
  addStoneArchBridge(4.0, 2.5);

  // =========================================================================
  // 6. Saint-Rémy Gothic Church & Tall Needle Spire (x = 9.0, z = -51.0)
  // =========================================================================
  const churchX = 9.0;
  const churchZ = -51.0;
  const churchY = getHeight(churchX, churchZ);
  {
    const cBase: [number, number, number] = [churchX, churchY, churchZ];
    const cRot = -0.14;

    // Stepped beveled stone foundation plinth (-1.8m into hill) + water-table molding
    addLocalBox(cBase, cRot, 'stonePlinth', [0, -0.7, 0.5], [7.8, 1.9, 13.8], undefined, 3, 1);
    addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [0, 0.28, 0.5], [8.05, 0.22, 14.05], undefined, 3, 0.3);
    // Nave sanctuary hall
    addLocalBox(cBase, cRot, 'cobaltWall', [0, 3.1, 0], [6.8, 6.2, 11.8], undefined, 2.4, 2.0);
    // 6 Two-tiered Gothic stone buttresses (3 left, 3 right) with sloped stone offsets & pinnacle finials
    for (const bz of [-3.8, 0.0, 3.8]) {
      for (const side of [-1, 1]) {
        addLocalBox(cBase, cRot, 'stonePlinth', [side * 3.82, 1.3, bz], [0.95, 2.6, 0.85], undefined, 0.6, 1.0);
        addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [side * 3.85, 2.65, bz], [1.04, 0.18, 0.94], undefined, 0.6, 0.2);
        addLocalBox(cBase, cRot, 'stonePlinth', [side * 3.65, 4.0, bz], [0.65, 2.7, 0.72], undefined, 0.5, 1.0);
        addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [side * 3.65, 5.42, bz], [0.76, 0.20, 0.84], undefined, 0.5, 0.3);
        addLocalMesh(cBase, cRot, 'stonePlinth', unitCone, [side * 3.65, 5.88, bz], [0.52, 0.72, 0.52], [0, Math.PI / 4, 0]);
      }
    }

    // Pitched slate sanctuary roof
    const chRoofH = 2.9;
    const chGable = createGablePrismGeometry(6.8, chRoofH, 11.8);
    addLocalMesh(cBase, cRot, 'cobaltWall', chGable, [0, 6.2, 0], [1, 1, 1], undefined, 0.25, 0.25);
    chGable.dispose();

    const chSlopeAng = Math.atan2(chRoofH, 3.4);
    const chSlopeLen = Math.hypot(3.4, chRoofH) + 0.45;
    addLocalBox(cBase, cRot, 'slateRoof', [-1.75, 6.2 + chRoofH * 0.5, 0], [chSlopeLen, 0.22, 12.4], [0, 0, chSlopeAng], 3, 2);
    addLocalBox(cBase, cRot, 'slateRoof', [1.75, 6.2 + chRoofH * 0.5, 0], [chSlopeLen, 0.22, 12.4], [0, 0, -chSlopeAng], 3, 2);

    // Tall Belfry Steeple Tower (front-center)
    addLocalBox(cBase, cRot, 'cobaltWall', [0, 6.8, 4.4], [3.5, 13.6, 3.5], undefined, 1.5, 4);
    // Corner pilasters, beveled belfry cornice & 4 Gothic corner spirelet pinnacles
    for (const px of [-1.72, 1.72]) {
      for (const pz of [2.68, 6.12]) {
        addLocalBox(cBase, cRot, 'stonePlinth', [px, 6.8, pz], [0.42, 13.6, 0.42]);
        addLocalBox(cBase, cRot, 'stonePlinth', [px, 14.3, pz], [0.36, 1.1, 0.36]);
        addLocalMesh(cBase, cRot, 'stonePlinth', unitCone, [px, 15.45, pz], [0.48, 1.35, 0.48]);
      }
    }
    addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [0, 13.65, 4.4], [4.15, 0.48, 4.15], undefined, 2, 0.4);
    addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [0, 9.65, 4.4], [3.84, 0.24, 3.84], undefined, 2, 0.3);

    // Iconic tall octagonal slate needle spire with stone rib bands & 4 lucarne spirelet dormers
    addLocalMesh(cBase, cRot, 'slateRoof', unitCone, [0, 22.1, 4.4], [3.5, 16.6, 3.5], undefined, 2, 3);
    addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [0, 18.2, 4.4], [2.45, 0.20, 2.45]);
    addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [0, 23.0, 4.4], [1.62, 0.16, 1.62]);
    // 4 Gabled Lucarne spire-dormers on lower spire
    const lucarneFaces: Array<[number, number, number]> = [
      [0, 5.46, 0],
      [0, 3.34, Math.PI],
      [-1.06, 4.4, -Math.PI / 2],
      [1.06, 4.4, Math.PI / 2]
    ];
    for (const [lx, lz, lRot] of lucarneFaces) {
      addLocalBox(cBase, cRot, 'stonePlinth', [lx, 15.6, lz], [0.68, 1.25, 0.68], [0, lRot, 0]);
      addLocalMesh(cBase, cRot, 'slateRoof', unitCone, [lx, 16.55, lz], [0.78, 0.72, 0.78], [0, lRot, 0]);
      addLocalBox(cBase, cRot, 'windowGlow', [lx * 1.04, 15.6, lz === 4.4 ? lz : lz + Math.cos(lRot) * 0.36], [lRot === 0 || lRot === Math.PI ? 0.26 : 0.08, 0.65, lRot === 0 || lRot === Math.PI ? 0.08 : 0.26]);
    }
    // Gilded weathervane cross finial
    addLocalBox(cBase, cRot, 'gildedAccent', [0, 31.1, 4.4], [0.14, 1.85, 0.14]);
    addLocalBox(cBase, cRot, 'gildedAccent', [0, 31.45, 4.4], [0.95, 0.14, 0.14]);

    // Front arched gothic portal (stepped stone archivolts + recessed oak doors) + Rose Window
    addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [0, 0.35, 6.6], [3.1, 0.38, 1.55]);
    addLocalBox(cBase, cRot, 'stonePlinth', [-1.05, 1.5, 6.18], [0.34, 2.5, 0.34]);
    addLocalBox(cBase, cRot, 'stonePlinth', [1.05, 1.5, 6.18], [0.34, 2.5, 0.34]);
    addLocalMesh(cBase, cRot, 'stonePlinth', unitArchHalf, [0, 2.65, 6.22], [1.95, 1.95, 1.3]);
    addLocalBox(cBase, cRot, 'timberTrim', [0, 1.65, 6.16], [1.65, 2.35, 0.14]);
    addLocalMesh(cBase, cRot, 'roseWindow', unitCylinder, [0, 5.15, 6.2], [2.35, 0.16, 2.35], [Math.PI / 2, 0, 0]);

    // 4 Rich Arched Belfry Windows (arched stone archivolt + vertical tracery mullion + glowing arched glass + beveled sill)
    const addArchedBelfryWindow = (wx: number, wz: number, faceAxis: 'z' | 'x') => {
      const rotY = faceAxis === 'z' ? 0 : Math.PI / 2;
      const sx = faceAxis === 'z' ? 1.15 : 0.09;
      const sz = faceAxis === 'z' ? 0.09 : 1.15;
      addLocalBox(cBase, cRot, 'windowGlow', [wx, 11.2, wz], [sx, 2.1, sz]);
      addLocalMesh(cBase, cRot, 'windowGlow', unitCylinder, [wx, 12.25, wz], [1.15, 0.09, 1.15], [Math.PI / 2, rotY, 0]);
      // Stone arch archivolt + side jambs + central stone mullion + beveled sill
      addLocalMesh(cBase, cRot, 'stonePlinth', unitArchHalf, [wx, 12.25, wz], [1.28, 1.28, 1.1], [0, rotY, 0]);
      addLocalBox(cBase, cRot, 'stonePlinth', [wx, 11.4, wz], [faceAxis === 'z' ? 0.14 : 0.18, 2.4, faceAxis === 'z' ? 0.18 : 0.14]);
      addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [wx, 10.12, wz], [faceAxis === 'z' ? 1.48 : 0.28, 0.16, faceAxis === 'z' ? 0.28 : 1.48]);
    };
    addArchedBelfryWindow(0, 6.2, 'z');
    addArchedBelfryWindow(0, 2.6, 'z');
    addArchedBelfryWindow(-1.8, 4.4, 'x');
    addArchedBelfryWindow(1.8, 4.4, 'x');

    // Nave arched side lancets with stone archivolts & beveled stone sills
    for (const nz of [-2.2, 1.6]) {
      for (const side of [-1, 1]) {
        addLocalBox(cBase, cRot, 'windowGlow', [side * 3.44, 3.05, nz], [0.06, 2.0, 0.9]);
        addLocalMesh(cBase, cRot, 'windowGlow', unitCylinder, [side * 3.44, 4.05, nz], [0.9, 0.06, 0.9], [Math.PI / 2, Math.PI / 2, 0]);
        addLocalMesh(cBase, cRot, 'stonePlinth', unitArchHalf, [side * 3.46, 4.05, nz], [1.02, 1.02, 0.9], [0, Math.PI / 2, 0]);
        addLocalMesh(cBase, cRot, 'stonePlinth', unitBeveledStone, [side * 3.48, 2.0, nz], [0.22, 0.14, 1.12]);
      }
    }

    const churchLight = new THREE.PointLight(0xffca57, 3.0, 32.0);
    churchLight.position.set(churchX - 0.6, churchY + 3.4, churchZ + 8.5);
    townRoot.add(churchLight);
    flickerLights.push({ light: churchLight, baseIntensity: 3.0, phase: 1.7 });

    const churchSpireMoon = new THREE.PointLight(0x7da4f8, 2.4, 30.0);
    churchSpireMoon.position.set(churchX - 2.0, churchY + 14.0, churchZ + 8.5);
    townRoot.add(churchSpireMoon);
  }

  // =========================================================================
  // 7. 19 Curated Detailed Provençal Cottages (+ Café Terrace = 20 buildings!)
  //    (All placed cleanly clear of road, plaza, cypress, carriage loop & stream!)
  // =========================================================================
  const townhouses: TownhouseSpec[] = [
    // Near West Town Quarter (framing Café Terrace & approach road)
    { x: -12.8, z: -15.5, w: 4.4, h: 4.2, d: 4.2, rot: 0.42, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, flowerBox: true, stories: 2 },
    { x: -18.5, z: -22.5, w: 4.8, h: 4.6, d: 4.4, rot: 0.25, wallStyle: 'cobalt', roofStyle: 'slate', roofType: 'hip', chimney: true, dormer: true, stories: 2 },
    { x: -16.2, z: -27.5, w: 4.2, h: 3.6, d: 4.0, rot: 0.65, wallStyle: 'ochre', roofStyle: 'terracotta', roofType: 'gable', chimney: true, flowerBox: true, stories: 1 },
    { x: -30.5, z: -25.0, w: 4.8, h: 4.2, d: 4.4, rot: 0.28, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, stories: 2 },
    // Central Plaza & Church West Quarter (safely west of stream x ~ 13..19)
    { x: 6.4, z: -18.5, w: 4.2, h: 4.2, d: 4.0, rot: -0.45, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, flowerBox: true, stories: 2 },
    { x: 6.2, z: -27.2, w: 4.5, h: 4.6, d: 4.2, rot: -0.62, wallStyle: 'cobalt', roofStyle: 'slate', roofType: 'gable', chimney: true, dormer: true, stories: 2 },
    { x: -13.5, z: -45.2, w: 4.8, h: 4.6, d: 4.4, rot: 0.08, wallStyle: 'cobalt', roofStyle: 'slate', roofType: 'gable', chimney: true, dormer: true, stories: 2 },
    { x: -8.5, z: -44.8, w: 4.4, h: 4.0, d: 4.2, rot: -0.05, wallStyle: 'ochre', roofStyle: 'terracotta', roofType: 'hip', chimney: true, flowerBox: true, stories: 2 },
    { x: -2.8, z: -45.2, w: 4.8, h: 4.5, d: 4.4, rot: 0.12, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, flowerBox: true, stories: 2 },
    { x: -33.0, z: -45.5, w: 4.8, h: 4.0, d: 4.2, rot: 0.22, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, stories: 2 },
    { x: -5.5, z: -53.5, w: 5.2, h: 4.8, d: 4.6, rot: 0.06, wallStyle: 'cream', roofStyle: 'slate', roofType: 'gable', chimney: true, dormer: true, stories: 2 },
    { x: 1.5, z: -56.0, w: 4.4, h: 3.7, d: 4.2, rot: 0.18, wallStyle: 'ochre', roofStyle: 'terracotta', roofType: 'gable', chimney: true, stories: 1 },
    { x: -12.0, z: -52.5, w: 4.4, h: 3.6, d: 4.0, rot: -0.12, wallStyle: 'cobalt', roofStyle: 'terracotta', roofType: 'gable', chimney: false, flowerBox: true, stories: 1 },
    // East Riverside Quarter (safely east of stream)
    { x: 20.5, z: -19.5, w: 4.6, h: 4.3, d: 4.2, rot: -0.42, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, flowerBox: true, stories: 2 },
    { x: 21.8, z: -26.8, w: 4.6, h: 4.0, d: 4.2, rot: -0.28, wallStyle: 'ochre', roofStyle: 'terracotta', roofType: 'hip', chimney: true, stories: 2 },
    { x: 24.5, z: -46.0, w: 4.8, h: 4.2, d: 4.2, rot: -0.25, wallStyle: 'cobalt', roofStyle: 'slate', roofType: 'hip', chimney: true, flowerBox: true, stories: 2 },
    { x: 28.5, z: -53.5, w: 5.0, h: 4.5, d: 4.4, rot: -0.35, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, dormer: true, stories: 2 },
    // Southern Countryside Cottages behind spawn
    { x: -13.5, z: 25.0, w: 4.4, h: 3.8, d: 4.0, rot: 2.55, wallStyle: 'cream', roofStyle: 'terracotta', roofType: 'gable', chimney: true, flowerBox: true, stories: 2 },
    { x: 27.5, z: 22.0, w: 4.6, h: 3.8, d: 4.2, rot: -2.15, wallStyle: 'ochre', roofStyle: 'terracotta', roofType: 'gable', chimney: true, stories: 1 }
  ];

  townhouses.forEach((hSpec, idx) => {
    const gy = getHeight(hSpec.x, hSpec.z);
    const base: [number, number, number] = [hSpec.x, gy, hSpec.z];
    const wallBucket = hSpec.wallStyle === 'cream' ? 'creamWall' : hSpec.wallStyle === 'ochre' ? 'ochreWall' : 'cobaltWall';
    const roofBucket = hSpec.roofStyle === 'terracotta' ? 'terracottaRoof' : 'slateRoof';
    const { w, h, d, rot } = hSpec;

    // 1. Grounded stone foundation plinth (-1.6m into sloped earth)
    addLocalBox(base, rot, 'stonePlinth', [0, -0.55, 0], [w + 0.3, 1.5, d + 0.3], undefined, 1.6, 0.8);

    // 2. Main townhouse body
    addLocalBox(base, rot, wallBucket, [0, h * 0.5, 0], [w, h, d], undefined, w / 3.5, h / 3.2);

    // 3. Roof (Real Gabled or Hipped roof with overhanging eaves)
    const roofH = hSpec.roofType === 'gable' ? 1.85 + (idx % 3) * 0.25 : 2.1;
    if (hSpec.roofType === 'gable') {
      const gable = createGablePrismGeometry(w, roofH, d);
      addLocalMesh(base, rot, wallBucket, gable, [0, h, 0], [1, 1, 1], undefined, 0.25, 0.25);
      gable.dispose();

      const slopeAng = Math.atan2(roofH, w * 0.5);
      const slopeLen = Math.hypot(w * 0.5, roofH) + 0.38;
      addLocalBox(base, rot, roofBucket, [-w * 0.25 - 0.08, h + roofH * 0.5, 0], [slopeLen, 0.16, d + 0.55], [0, 0, slopeAng], 1.6, 1.8);
      addLocalBox(base, rot, roofBucket, [w * 0.25 + 0.08, h + roofH * 0.5, 0], [slopeLen, 0.16, d + 0.55], [0, 0, -slopeAng], 1.6, 1.8);
      // Timber bargeboard eaves
      addLocalBox(base, rot, 'timberTrim', [0, h + roofH + 0.04, 0], [0.16, 0.12, d + 0.62]);
    } else {
      addLocalMesh(base, rot, roofBucket, unitCone, [0, h + roofH * 0.5, 0], [w * 1.48, roofH, d * 1.48], [0, Math.PI / 4, 0], 2, 1.5);
    }

    // 4. Rooftop dormer on larger townhouses
    if (hSpec.dormer) {
      addLocalBox(base, rot, wallBucket, [0, h + roofH * 0.42, d * 0.25], [1.1, 0.95, 1.1]);
      addLocalBox(base, rot, roofBucket, [0, h + roofH * 0.42 + 0.55, d * 0.25], [1.3, 0.18, 1.25]);
      addDetailedWindow(base, rot, [0, h + roofH * 0.42, d * 0.25 + 0.55], 0.62, 0.62, 'front', false);
    }

    // 5. Chimney + beveled corbeled stone crown + terracotta chimney pot + smoke origin
    if (hSpec.chimney) {
      const cx = w * 0.26;
      const cz = -d * 0.18;
      addLocalBox(base, rot, 'chimneyBrick', [cx, h + roofH * 0.72, cz], [0.58, 1.65, 0.58], undefined, 0.5, 1);
      addLocalMesh(base, rot, 'stonePlinth', unitBeveledStone, [cx, h + roofH * 0.72 + 0.85, cz], [0.76, 0.16, 0.76], undefined, 0.5, 0.2);
      addLocalMesh(base, rot, 'chimneyBrick', unitCylinder, [cx, h + roofH * 0.72 + 1.05, cz], [0.24, 0.30, 0.24]);
      const wc = new THREE.Vector3(cx, h + roofH * 0.72 + 1.15, cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      chimneyPositions.push({ x: hSpec.x + wc.x, y: gy + wc.y, z: hSpec.z + wc.z });
    }

    // 6. Recessed Doorway + Beveled Stone Step/Lintel + Recessed Glass/Muntin/Curtain Windows + Louvered Shutters + Flower Boxes
    addLocalBox(base, rot, 'timberTrim', [0, 0.95, d * 0.5 + 0.04], [0.92, 1.9, 0.08]);
    addLocalMesh(base, rot, 'stonePlinth', unitBeveledStone, [0, 1.96, d * 0.5 + 0.09], [1.14, 0.14, 0.18]);
    addLocalMesh(base, rot, 'stonePlinth', unitBeveledStone, [0, 0.1, d * 0.5 + 0.25], [1.28, 0.22, 0.50]);

    const winRowCount = hSpec.stories === 2 ? 2 : 1;
    const winPositionsX = w >= 4.7 ? [-w * 0.28, w * 0.28] : [idx % 2 === 0 ? -w * 0.25 : w * 0.25];
    for (let row = 0; row < winRowCount; row++) {
      const wy = row === 0 ? 1.45 : h * 0.72;
      for (const wx of winPositionsX) {
        if (row === 0 && Math.abs(wx) < 0.7) continue; // Don't overlap front door
        addDetailedWindow(base, rot, [wx, wy, d * 0.5], 0.80, 0.95, 'front', true);

        if (hSpec.flowerBox && row === 1) {
          addLocalBox(base, rot, 'timberTrim', [wx, wy - 0.62, d * 0.5 + 0.14], [0.92, 0.2, 0.22]);
          addLocalMesh(base, rot, 'flowerFoliage', unitSphere, [wx, wy - 0.46, d * 0.5 + 0.18], [0.85, 0.32, 0.32]);
          addLocalMesh(base, rot, 'flowerBlossoms', unitSphere, [wx + 0.15, wy - 0.38, d * 0.5 + 0.22], [0.22, 0.18, 0.22]);
        }
      }
    }

    // Side & rear recessed glass/muntin windows with beveled sills so 360° wandering around town stays rich on all sides
    addDetailedWindow(base, rot, [-w * 0.5, h * 0.58, 0], 0.80, 0.90, 'left', false);
    addDetailedWindow(base, rot, [w * 0.5, h * 0.58, 0], 0.80, 0.90, 'right', false);
    if (hSpec.stories === 2) {
      addDetailedWindow(base, rot, [0, h * 0.72, -d * 0.5], 0.85, 0.90, 'back', false);
    }
  });

  // Fine Provençal Dry-Stone Garden & Terraced Olive Grove Retaining Walls
  const gardenWalls: Array<[number, number, number, number]> = [
    [9.2, -23.0, 4.0, -0.35],
    [-14.5, -44.2, 5.2, 0.05],
    [13.2, -45.0, 3.6, -0.15],
    [-31.5, -45.0, 4.8, 0.18],
    [-9.5, 24.5, 4.6, 0.32],
    [10.2, 30.0, 4.5, -0.28],
    // Terraced dry-stone olive grove walls across East & West hillsides
    [22.5, -14.0, 11.0, 0.24],
    [28.5, -26.0, 13.5, 0.18],
    [-25.5, -16.0, 11.5, -0.28],
    [-32.5, -31.0, 13.0, -0.18],
    [25.5, 16.0, 10.0, -0.32],
    [-24.0, 18.0, 11.0, 0.34]
  ];
  for (const [gx, gz, len, rot] of gardenWalls) {
    const gy = getHeight(gx, gz);
    const wBase: [number, number, number] = [gx, gy, gz];
    // Stepped footing sunk into hillside + main masonry wall + overhanging beveled stone coping capstones
    addLocalBox(wBase, rot, 'stonePlinth', [0, -0.25, 0], [len + 0.25, 0.95, 0.62], undefined, 2.2, 0.5);
    addLocalBox(wBase, rot, 'stonePlinth', [0, 0.55, 0], [len, 0.85, 0.42], undefined, 2.2, 0.5);
    addLocalMesh(wBase, rot, 'stonePlinth', unitBeveledStone, [0, 1.04, 0], [len + 0.14, 0.16, 0.56], undefined, 2.2, 0.2);
    // Flanking gate piers with beveled pyramidal stone caps
    for (const side of [-1, 1]) {
      const px = side * (len * 0.5 + 0.16);
      addLocalBox(wBase, rot, 'stonePlinth', [px, 0.68, 0], [0.64, 1.48, 0.64], undefined, 0.6, 0.9);
      addLocalMesh(wBase, rot, 'stonePlinth', unitBeveledStone, [px, 1.48, 0], [0.76, 0.16, 0.76], undefined, 0.6, 0.2);
      addLocalMesh(wBase, rot, 'stonePlinth', unitCone, [px, 1.72, 0], [0.58, 0.34, 0.58], [0, Math.PI / 4, 0]);
    }
  }

  // =========================================================================
  // 8. 14 Ornate Smooth 16-Segment Wrought-Iron Streetlamps + Ground Light Pools
  // =========================================================================
  const lampLocations: Array<[number, number, number]> = [
    [getTownRoadCenterX(38) - 2.3, 38, 1],
    [getTownRoadCenterX(28) + 2.3, 28, -1],
    [getTownRoadCenterX(14) - 2.3, 14, 1],
    [getTownRoadCenterX(2) + 2.3, 2, -1],
    [getTownRoadCenterX(-12) - 2.3, -12, 1],
    [-7.2, -18.5, 1],
    [6.5, -19.0, -1],
    [-7.2, -28.4, 1],
    [6.5, -28.8, -1],
    [-5.0, -42.5, 1],
    [4.6, -42.6, -1],
    [12.2, -43.2, -1],
    [-13.5, -43.0, 1],
    [getTownRoadCenterX(44) + 2.3, 44, -1]
  ];

  const lampBloomPos: THREE.Vector3[] = [];
  const lampPoolGeos: THREE.BufferGeometry[] = [];
  for (let li = 0; li < lampLocations.length; li++) {
    const [lx, lz, armSign] = lampLocations[li];
    const ly = getHeight(lx, lz);
    const lBase: [number, number, number] = [lx, ly, lz];
    // Smooth 16-segment fluted plinth, tapered post, decorative collar, scrolled arm, lantern & globe
    addLocalMesh(lBase, 0, 'timberTrim', unitCyl16, [0, 0.25, 0], [0.36, 0.72, 0.36]);
    addLocalMesh(lBase, 0, 'timberTrim', unitCyl16, [0, 0.65, 0], [0.24, 0.16, 0.24]);
    addLocalMesh(lBase, 0, 'timberTrim', unitCyl16, [0, 1.62, 0], [0.13, 2.05, 0.13]);
    addLocalMesh(lBase, 0, 'timberTrim', unitCyl16, [0, 2.52, 0], [0.20, 0.12, 0.20]);
    addLocalBox(lBase, 0, 'timberTrim', [armSign * 0.22, 2.62, 0], [0.52, 0.08, 0.08]);
    addLocalMesh(lBase, 0, 'gildedAccent', unitSphere, [armSign * 0.38, 2.44, 0], [0.32, 0.36, 0.32]);
    addLocalMesh(lBase, 0, 'timberTrim', unitCone, [armSign * 0.38, 2.68, 0], [0.48, 0.22, 0.48]);
    lampBloomPos.push(new THREE.Vector3(lx + armSign * 0.38, ly + 2.44, lz));

    // Contoured radial ground light pool hugging terrain & grass around each streetlamp
    const poolGeo = createContouredPlazaGeometry(lx, lz, 7.6, 7.6, 8, 8, 0.045, getHeight);
    lampPoolGeos.push(prepareForMerge(poolGeo, new THREE.Matrix4()));
    poolGeo.dispose();

    // Real PointLights on foreground/midground roadside & plaza lamps for warm grass/wall illumination
    if (li === 2 || li === 3 || li === 4 || li === 5 || li === 6) {
      const lPoint = new THREE.PointLight(0xffb845, 2.1, 14.0, 1.5);
      lPoint.position.set(lx + armSign * 0.38, ly + 2.42, lz);
      townRoot.add(lPoint);
      flickerLights.push({ light: lPoint, baseIntensity: 2.1, phase: li * 1.1 });
    }
  }

  const lampPoolMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0.0 } }
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 c = (vUv - 0.5) * 2.0;
        float r = length(c);
        if (r > 1.0) discard;
        float pulse = 0.94 + 0.06 * sin(uTime * 3.6);
        float falloff = exp(-r * r * 3.6) * smoothstep(1.0, 0.35, r) * pulse;
        vec3 col = mix(vec3(0.88, 0.42, 0.06), vec3(1.0, 0.78, 0.28), exp(-r * r * 6.0));
        gl_FragColor = vec4(col * falloff * 0.48, falloff * 0.48);
        #include <fog_fragment>
      }
    `
  });
  const mergedLampPools = mergeGeometries(lampPoolGeos, false);
  lampPoolGeos.forEach((g) => g.dispose());
  if (mergedLampPools) {
    const lampPoolsMesh = new THREE.Mesh(mergedLampPools, lampPoolMat);
    lampPoolsMesh.name = 'StreetlampGroundPools';
    townRoot.add(lampPoolsMesh);
  }
  extraMaterials.push(lampPoolMat);

  // =========================================================================
  // 9. Sweeping Multi-Arch Stone Railway Viaduct, Sleepers & Twin Rails (z ~ -67)
  // =========================================================================
  const railCurve = createRailwayCurve(getHeight);
  const railSteps = 64;
  const pPrev = new THREE.Vector3();
  const pCurr = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let i = 0; i < railSteps; i++) {
    const u0 = i / railSteps;
    const u1 = (i + 1) / railSteps;
    railCurve.getPointAt(u0, pPrev);
    railCurve.getPointAt(u1, pCurr);
    const segLen = pPrev.distanceTo(pCurr) + 0.16;
    const mid = pPrev.clone().add(pCurr).multiplyScalar(0.5);
    tangent.subVectors(pCurr, pPrev).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);

    // Viaduct masonry deck + beveled coping + low stone parapet curbs (kept below rail crown so wheel trucks remain unobstructed)
    addLocalBox([mid.x, mid.y - 0.34, mid.z], yaw, 'stonePlinth', [0, 0, 0], [3.5, 0.72, segLen], undefined, 1.5, 0.8);
    addLocalMesh([mid.x, mid.y + 0.01, mid.z], yaw, 'stonePlinth', unitBeveledStone, [-1.64, 0, 0], [0.24, 0.20, segLen]);
    addLocalMesh([mid.x, mid.y + 0.01, mid.z], yaw, 'stonePlinth', unitBeveledStone, [1.64, 0, 0], [0.24, 0.20, segLen]);

    // Grounded viaduct stone piers + masonry spandrel arches between adjacent piers
    if (i % 3 === 0 && Math.abs(mid.x) < 92) {
      const groundAtPier = getHeight(mid.x, mid.z);
      const topY = mid.y - 0.65;
      const bottomY = groundAtPier - 2.2;
      const pierH = Math.max(1.2, topY - bottomY);
      addLocalBox(
        [mid.x, bottomY + pierH * 0.5, mid.z],
        yaw,
        'stonePlinth',
        [0, 0, 0],
        [3.2, pierH, 1.55],
        undefined,
        1.2,
        Math.max(1, pierH / 2.0)
      );
      addLocalMesh([mid.x, topY - 0.12, mid.z], yaw, 'stonePlinth', unitBeveledStone, [0, 0, 0], [3.55, 0.28, 1.85]);

      // Sculpted masonry arch voussoirs spanning toward next pier
      if (i + 3 < railSteps) {
        const nextMid = railCurve.getPointAt((i + 3.5) / railSteps);
        if (Math.abs(nextMid.x) < 92) {
          const archCenter = mid.clone().add(nextMid).multiplyScalar(0.5);
          const spanDist = mid.distanceTo(nextMid);
          const archTan = nextMid.clone().sub(mid).normalize();
          const archYaw = Math.atan2(archTan.x, archTan.z);
          for (let av = -3; av <= 3; av++) {
            const ang = (av / 3.5) * (Math.PI * 0.42);
            const localZ = Math.sin(ang) * (spanDist * 0.42);
            const localY = archCenter.y - 2.4 + Math.cos(ang) * 1.65;
            addLocalBox([archCenter.x, localY, archCenter.z], archYaw, 'stonePlinth', [0, 0, localZ], [3.1, 0.56, 1.15], [ang, 0, 0], 0.8, 0.4);
          }
        }
      }
    }

    // Timber sleepers + twin iron rails
    addLocalBox([mid.x, mid.y + 0.05, mid.z], yaw, 'timberTrim', [0, 0, -segLen * 0.25], [2.4, 0.1, 0.22]);
    addLocalBox([mid.x, mid.y + 0.05, mid.z], yaw, 'timberTrim', [0, 0, segLen * 0.25], [2.4, 0.1, 0.22]);
    addLocalBox([mid.x, mid.y + 0.14, mid.z], yaw, 'timberTrim', [-0.72, 0, 0], [0.1, 0.1, segLen]);
    addLocalBox([mid.x, mid.y + 0.14, mid.z], yaw, 'timberTrim', [0.72, 0, 0], [0.1, 0.1, segLen]);
  }

  // =========================================================================
  // 9b. Old Provençal Stone Windmill (Moulin) on the Eastern Hill (32.5, -10.5)
  // =========================================================================
  const moulinX = 32.5;
  const moulinZ = -10.5;
  const moulinY = getHeight(moulinX, moulinZ);
  const moulinRot = -0.68; // Faces toward Village Overlook & Spawn vista
  {
    const mBase: [number, number, number] = [moulinX, moulinY, moulinZ];
    // Grounded stepped stone terrace base (-1.6m into hill) + cylindrical tapered stone mill tower
    addLocalMesh(mBase, moulinRot, 'stonePlinth', unitOctCyl, [0, -0.3, 0], [5.8, 2.2, 5.8], undefined, 2.8, 1.0);
    addLocalMesh(mBase, moulinRot, 'stonePlinth', unitBeveledStone, [0, 0.85, 0], [6.1, 0.24, 6.1], undefined, 3.0, 0.3);
    addLocalMesh(mBase, moulinRot, 'creamWall', unitCylinder, [0, 4.4, 0], [4.2, 7.2, 4.2], undefined, 3.0, 2.5);
    addLocalMesh(mBase, moulinRot, 'stonePlinth', unitBeveledStone, [0, 8.05, 0], [4.6, 0.28, 4.6], undefined, 2.5, 0.3);
    // Conical Provençal slate roof cap + brass finial
    addLocalMesh(mBase, moulinRot, 'slateRoof', unitCone, [0, 9.75, 0], [4.95, 3.2, 4.95], undefined, 2.6, 1.8);
    addLocalMesh(mBase, moulinRot, 'gildedAccent', unitSphere, [0, 11.45, 0], [0.32, 0.32, 0.32]);
    // Recessed doorway & glowing windmill tower windows
    addLocalBox(mBase, moulinRot, 'timberTrim', [0, 1.85, 2.08], [1.1, 1.9, 0.14]);
    addLocalMesh(mBase, moulinRot, 'stonePlinth', unitBeveledStone, [0, 2.86, 2.12], [1.34, 0.16, 0.22]);
    addDetailedWindow(mBase, moulinRot, [0, 4.8, 2.05], 0.85, 1.05, 'front', true);
    addDetailedWindow(mBase, moulinRot, [-2.05, 4.8, 0], 0.80, 0.95, 'left', false);
    addDetailedWindow(mBase, moulinRot, [2.05, 4.8, 0], 0.80, 0.95, 'right', false);
  }

  // Stone railway tunnel portals at west & east mountain flanks (x ~ -78 and +78)
  for (const endU of [0.125, 0.875]) {
    const pt = railCurve.getPointAt(endU);
    const tg = railCurve.getTangentAt(endU);
    const yaw = Math.atan2(tg.x, tg.z);
    addLocalBox([pt.x, pt.y + 0.2, pt.z], yaw, 'stonePlinth', [-2.2, 0, 0], [1.6, 6.2, 2.8]);
    addLocalBox([pt.x, pt.y + 0.2, pt.z], yaw, 'stonePlinth', [2.2, 0, 0], [1.6, 6.2, 2.8]);
    addLocalBox([pt.x, pt.y + 3.6, pt.z], yaw, 'stonePlinth', [0, 0, 0], [6.0, 1.5, 3.0]);
  }

  // Build all batched static town meshes into SleepingVillage (15 draw calls total!)
  builder.buildMeshes(townRoot, materials, 'TownArchitecture');

  // Rotating 4-Sail Provençal Windmill Rotor attached to the Moulin tower
  const moulinRotorGroup = new THREE.Group();
  moulinRotorGroup.name = 'ProvencalMoulinSails';
  const rotorHubLocal = new THREE.Vector3(0, 7.25, 2.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), moulinRot);
  moulinRotorGroup.position.set(moulinX + rotorHubLocal.x, moulinY + rotorHubLocal.y, moulinZ + rotorHubLocal.z);
  moulinRotorGroup.rotation.y = moulinRot;
  {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 12), materials.timberTrim);
    hub.rotation.x = Math.PI / 2;
    moulinRotorGroup.add(hub);

    const sailMat = materials.creamWall;
    const sparGeo = new THREE.BoxGeometry(0.14, 5.2, 0.14);
    const latticeGeo = new THREE.BoxGeometry(0.92, 3.8, 0.04);
    for (let s = 0; s < 4; s++) {
      const arm = new THREE.Group();
      arm.rotation.z = (s * Math.PI) / 2;
      const spar = new THREE.Mesh(sparGeo, materials.timberTrim);
      spar.position.set(0, 2.6, 0);
      arm.add(spar);
      const canvas = new THREE.Mesh(latticeGeo, sailMat);
      canvas.position.set(0.50, 3.15, 0.04);
      canvas.rotation.y = 0.18;
      arm.add(canvas);
      moulinRotorGroup.add(arm);
    }
    const moulinLight = new THREE.PointLight(0xffca57, 2.2, 20.0);
    moulinLight.position.set(0, -1.8, 1.8);
    moulinRotorGroup.add(moulinLight);
    flickerLights.push({ light: moulinLight, baseIntensity: 2.2, phase: 2.4 });
  }
  townRoot.add(moulinRotorGroup);

  // Add soft warm radial light blooms around lanterns, Café Terrace & church rose window (NEVER use 'star' or 'halo'!)
  const softGlowMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0.0 } },
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
        vec2 u = (vUv - 0.5) * 2.0;
        float r = length(u);
        if (r > 1.0) discard;
        float glow = exp(-r * r * 4.5) * (0.90 + 0.10 * sin(uTime * 3.4));
        vec3 col = mix(vec3(0.95, 0.26, 0.015), vec3(1.15, 0.84, 0.24), exp(-r * r * 7.5));
        gl_FragColor = vec4(col, glow * 0.52);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const bloomGeos: THREE.BufferGeometry[] = [];
  const addCrossBloom = (pos: THREE.Vector3, scale: number) => {
    const m1 = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z).scale(new THREE.Vector3(scale, scale, 1));
    const m2 = new THREE.Matrix4()
      .makeTranslation(pos.x, pos.y, pos.z)
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))
      .scale(new THREE.Vector3(scale, scale, 1));
    bloomGeos.push(prepareForMerge(unitPlane, m1));
    bloomGeos.push(prepareForMerge(unitPlane, m2));
  };
  for (const pos of lampBloomPos) {
    addCrossBloom(pos, 2.2);
  }
  // Café Terrace main lantern bloom & Church rose window bloom
  const cafeLanternWorld = new THREE.Vector3(0, 2.85, 5.4 * 0.5 + 1.5)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cafeRotY)
    .add(new THREE.Vector3(cafeX, cafeY, cafeZ));
  addCrossBloom(cafeLanternWorld, 3.6);
  const roseWorld = new THREE.Vector3(0, 5.15, 6.25)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.14)
    .add(new THREE.Vector3(churchX, churchY, churchZ));
  addCrossBloom(roseWorld, 4.2);

  const mergedLampGlow = mergeGeometries(bloomGeos, false);
  bloomGeos.forEach((g) => g.dispose());
  if (mergedLampGlow) {
    const lampGlowMesh = new THREE.Mesh(mergedLampGlow, softGlowMat);
    lampGlowMesh.name = 'StreetlampWarmAureoles';
    townRoot.add(lampGlowMesh);
  }

  // Dispose temporary unit primitives
  unitBox.dispose();
  unitPlane.dispose();
  unitCylinder.dispose();
  unitSphere.dispose();
  unitCone.dispose();
  unitOctCyl.dispose();
  unitCyl16.dispose();
  unitArchHalf.dispose();
  unitBeveledStone.dispose();
  unitLouverShutter.dispose();

  // =========================================================================
  // 10. Furrowed Golden Wheat Fields & Sculpted Olive/Cypress Border Trees
  // =========================================================================
  const wheatUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uWindSpeed: { value: 1.5 },
      uWindDirection: { value: new THREE.Vector2(0.85, 0.45).normalize() }
    }
  ]);

  const wheatMat = new THREE.ShaderMaterial({
    uniforms: wheatUniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform vec2 uWindDirection;
      varying vec2 vUv;
      varying vec3 vInstanceColor;

      void main() {
        vUv = uv;
        vInstanceColor = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
        vInstanceColor = instanceColor;
        #endif

        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * localPos;
        #else
        vec4 worldPos = modelMatrix * localPos;
        #endif

        float flex = uv.y * uv.y;
        float wave = sin(dot(worldPos.xz, uWindDirection) * 0.25 - uTime * uWindSpeed * 1.45) * 0.7
                   + cos(worldPos.x * 0.4 - uTime * 2.1) * 0.3;
        worldPos.xz += uWindDirection * wave * 0.28 * flex;
        worldPos.y -= abs(wave) * 0.06 * flex;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec2 vUv;
      varying vec3 vInstanceColor;
      void main() {
        float rootAO = mix(0.32, 1.0, smoothstep(0.0, 0.48, vUv.y));
        vec3 stalkBase = vInstanceColor * vec3(0.32, 0.34, 0.14);
        vec3 stalkTip = vInstanceColor * vec3(1.15, 0.92, 0.44);
        vec3 col = mix(stalkBase, stalkTip, smoothstep(0.1, 0.95, vUv.y)) * rootAO;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `
  });

  // Tapered 6-blade golden wheat sheaf geometry (slender curved stalks tapering to wheat ear tip)
  const makeWheatBlade = (rotY: number, tiltX: number, h: number): THREE.BufferGeometry => {
    const w0 = 0.082;
    const w1 = 0.056;
    const w2 = 0.022;
    const pos = new Float32Array([
      -w0 / 2, 0.0, 0.0,
       w0 / 2, 0.0, 0.0,
      -w1 / 2, 0.45 * h, 0.03,
       w1 / 2, 0.45 * h, 0.03,
      -w2 / 2, 0.80 * h, 0.09,
       w2 / 2, 0.80 * h, 0.09,
       0.0, h, 0.16
    ]);
    const nrm = new Float32Array([
      0, 0.25, 0.96, 0, 0.25, 0.96,
      0, 0.35, 0.93, 0, 0.35, 0.93,
      0, 0.45, 0.89, 0, 0.45, 0.89,
      0, 0.6, 0.8
    ]);
    const uvs = new Float32Array([
      0, 0, 1, 0,
      0.1, 0.45, 0.9, 0.45,
      0.25, 0.80, 0.75, 0.80,
      0.5, 1.0
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
    g.rotateX(tiltX);
    g.rotateY(rotY);
    return g.toNonIndexed();
  };
  const stalkPlanes: THREE.BufferGeometry[] = [
    makeWheatBlade(0.0, 0.08, 0.88),
    makeWheatBlade(1.05, 0.14, 0.94),
    makeWheatBlade(2.1, -0.1, 0.82),
    makeWheatBlade(3.15, 0.12, 0.90),
    makeWheatBlade(4.2, -0.09, 0.85),
    makeWheatBlade(5.25, 0.11, 0.78)
  ];
  const wheatTuftGeo = mergeGeometries(stalkPlanes, false)!;
  stalkPlanes.forEach((g) => g.dispose());

  // Place up to 10,800 wheat clusters in unmistakable curved Van Gogh furrow rows (including rear countryside)
  const maxWheat = 10800;
  const wheatMesh = new THREE.InstancedMesh(wheatTuftGeo, wheatMat, maxWheat);
  wheatMesh.name = 'InstancedWheatFields';

  const isInsideBuilding = (x: number, z: number): boolean => {
    if (Math.hypot(x - churchX, z - churchZ) < 8.5) return true;
    if (Math.hypot(x - cafeX, z - cafeZ) < 6.0) return true;
    if (Math.hypot(x - fountainX, z - fountainZ) < 4.5) return true;
    for (const h of townhouses) {
      if (Math.hypot(x - h.x, z - h.z) < Math.max(h.w, h.d) * 0.72 + 1.4) return true;
    }
    return false;
  };

  const isOnRoadOrObstacle = (x: number, z: number): boolean => {
    if (Math.abs(x - getTownRoadCenterX(z)) < 3.4) return true;
    if (Math.abs(x - getStreamCenterX(z)) < 3.2) return true;
    if (x >= -16.5 && x <= 12.5 && z >= -32.8 && z <= -16.5) return true;
    // Exact metric carriage ellipse clearance
    if (getDistanceToCarriageLane(x, z) < 3.0) return true;
    // Monumental cypress clearance
    if (Math.hypot(x + 18, z + 12) < 5.5) return true;
    return isInsideBuilding(x, z);
  };

  const wheatRand = mulberry32(8421);
  const wDummy = new THREE.Matrix4();
  const wPos = new THREE.Vector3();
  const wNorm = new THREE.Vector3();
  const wUp = new THREE.Vector3(0, 1, 0);
  const wQuat = new THREE.Quaternion();
  const wYaw = new THREE.Quaternion();
  const wScale = new THREE.Vector3();
  const wCol = new THREE.Color();

  const fieldZones: Array<{ xMin: number; xMax: number; zMin: number; zMax: number; count: number }> = [
    { xMin: 10.5, xMax: 42, zMin: -14, zMax: 10, count: 2300 },
    { xMin: -46, xMax: -17, zMin: -61, zMax: -17, count: 3100 },
    { xMin: 17, xMax: 46, zMin: -60, zMax: -15, count: 2400 },
    { xMin: -48, xMax: 48, zMin: -64, zMax: -56, count: 1400 },
    { xMin: -38, xMax: -10, zMin: 18, zMax: 42, count: 800 },
    { xMin: 10, xMax: 38, zMin: 18, zMax: 42, count: 800 }
  ];

  let wIdx = 0;
  for (const zone of fieldZones) {
    let attempts = 0;
    let zonePlaced = 0;
    while (zonePlaced < zone.count && wIdx < maxWheat && attempts < zone.count * 4) {
      attempts++;
      const rx = zone.xMin + wheatRand() * (zone.xMax - zone.xMin);
      const rz = zone.zMin + wheatRand() * (zone.zMax - zone.zMin);

      // Snap along curved Van Gogh furrow stripes (period ~ 2.0m)
      const furrowVal = Math.sin((rx * 0.45 + rz * 0.89) * 3.1 + Math.sin(rx * 0.09) * 1.8);
      if (furrowVal < -0.15) continue;
      if (isOnRoadOrObstacle(rx, rz)) continue;

      const ry = getHeight(rx, rz);
      wPos.set(rx, ry - 0.04, rz);
      getNormal(rx, rz, wNorm);
      wQuat.setFromUnitVectors(wUp, wNorm);
      wYaw.setFromAxisAngle(wNorm, wheatRand() * Math.PI * 2);
      wQuat.multiplyQuaternions(wYaw, wQuat);

      const s = 0.78 + wheatRand() * 0.55;
      wScale.set(s * 1.15, s * (0.85 + furrowVal * 0.35), s * 1.15);
      wDummy.compose(wPos, wQuat, wScale);
      wheatMesh.setMatrixAt(wIdx, wDummy);

      const tint = wheatRand();
      if (tint < 0.55) {
        wCol.set('#d4a73c'); // burnished golden wheat
      } else if (tint < 0.82) {
        wCol.set('#b98c2c'); // deep ochre straw
      } else {
        wCol.set('#6f8236'); // olive crop contrast
      }
      wheatMesh.setColorAt(wIdx, wCol);
      wIdx++;
      zonePlaced++;
    }
  }
  wheatMesh.count = wIdx;
  wheatMesh.instanceMatrix.needsUpdate = true;
  if (wheatMesh.instanceColor) wheatMesh.instanceColor.needsUpdate = true;
  townRoot.add(wheatMesh);

  // Terraced Provençal Lavender Hillside Tufts flanking the foreground slopes
  const maxLav = 1400;
  const lavMesh = new THREE.InstancedMesh(wheatTuftGeo, wheatMat, maxLav);
  lavMesh.name = 'ProvencalLavenderHills';
  const lavZones: Array<{ xMin: number; xMax: number; zMin: number; zMax: number; count: number }> = [
    { xMin: 8.5, xMax: 30, zMin: 14, zMax: 37, count: 700 },
    { xMin: -28, xMax: -8.0, zMin: -4, zMax: 15, count: 700 }
  ];
  let lIdx = 0;
  for (const lz of lavZones) {
    let attempts = 0;
    let zonePlaced = 0;
    while (zonePlaced < lz.count && lIdx < maxLav && attempts < lz.count * 4) {
      attempts++;
      const rx = lz.xMin + wheatRand() * (lz.xMax - lz.xMin);
      const rz = lz.zMin + wheatRand() * (lz.zMax - lz.zMin);
      const rowWave = Math.sin((rx * 0.32 + rz * 0.94) * 2.8);
      if (rowWave < -0.1) continue;
      if (isOnRoadOrObstacle(rx, rz)) continue;
      const ry = getHeight(rx, rz);
      wPos.set(rx, ry - 0.03, rz);
      getNormal(rx, rz, wNorm);
      wQuat.setFromUnitVectors(wUp, wNorm);
      wYaw.setFromAxisAngle(wNorm, wheatRand() * Math.PI * 2);
      wQuat.multiplyQuaternions(wYaw, wQuat);
      const s = 0.62 + wheatRand() * 0.42;
      wScale.set(s * 1.25, s * 0.88, s * 1.25);
      wDummy.compose(wPos, wQuat, wScale);
      lavMesh.setMatrixAt(lIdx, wDummy);
      const tint = wheatRand();
      if (tint < 0.52) {
        wCol.set('#6d58b8'); // twilight Provençal lavender bloom
      } else if (tint < 0.82) {
        wCol.set('#544494'); // deep violet-indigo lavender
      } else {
        wCol.set('#4c6b58'); // moonlit sage foliage
      }
      lavMesh.setColorAt(lIdx, wCol);
      lIdx++;
      zonePlaced++;
    }
  }
  lavMesh.count = lIdx;
  lavMesh.instanceMatrix.needsUpdate = true;
  if (lavMesh.instanceColor) lavMesh.instanceColor.needsUpdate = true;
  townRoot.add(lavMesh);

  // =========================================================================
  // 11. Gnarled Sculpted Provençal Olive Orchard Trees + Alpha-Tested Leaf Cards
  //     (ZERO sphere-blobs: twisted CatmullRom trunks/limbs + botanical cards!)
  // =========================================================================
  const treeCoords: Array<[number, number, number]> = [
    [-25, -20, 1.15],
    [-29, -32, 1.3],
    [-29, -39, 1.1],
    [-38, -48, 1.25],
    [8.5, -13.5, 1.05],
    [22, -18, 1.2],
    [26, -30, 1.25],
    [29, -42, 1.15],
    [28, -59, 1.3],
    [-15, -60, 1.2],
    [-4, -39, 0.95],
    [7, -38, 0.95],
    [10, -39, 1.0],
    [-18, 29, 1.2],
    [24, 34, 1.25],
    [-11, 41, 1.1],
    [25, 44, 1.15]
  ];

  const createOliveBranchTube = (
    points: THREE.Vector3[],
    rStart: number,
    rEnd: number,
    radialSegs: number,
    tubularSegs: number,
    seed: number
  ): THREE.BufferGeometry => {
    const curve = new THREE.CatmullRomCurve3(points);
    const frames = curve.computeFrenetFrames(tubularSegs, false);
    const totalLen = Math.max(0.4, curve.getLength());
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const pt = new THREE.Vector3();
    const vertex = new THREE.Vector3();

    for (let i = 0; i <= tubularSegs; i++) {
      const t = i / tubularSegs;
      curve.getPointAt(t, pt);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const rootFlare = seed < 2.0 ? Math.pow(Math.max(0, 1 - t * 2.8), 2.0) * 0.35 : 0;
      const baseR = (rStart * (1 - t) + rEnd * t) * (1 + rootFlare);
      for (let j = 0; j <= radialSegs; j++) {
        const u = j / radialSegs;
        const theta = u * Math.PI * 2;
        const furrow = Math.sin(theta * 5.0 + t * 4.5 + seed) * 0.08 + Math.cos(theta * 3.0 + seed) * 0.05;
        const rad = Math.max(0.02, baseR * (1 + furrow));
        vertex.copy(pt).addScaledVector(N, Math.cos(theta) * rad).addScaledVector(B, Math.sin(theta) * rad);
        positions.push(vertex.x, vertex.y, vertex.z);
        uvs.push(u * 2.0, t * (totalLen / 1.8));
      }
    }
    const stride = radialSegs + 1;
    for (let i = 0; i < tubularSegs; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        indices.push(a, b, d, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  // Sculpted gnarled olive trunk + 5 forked spreading boughs
  const oliveParts: THREE.BufferGeometry[] = [];
  const pushOliveBranch = (pts: Array<[number, number, number]>, r0: number, r1: number, seed: number) => {
    const g = createOliveBranchTube(
      pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      r0,
      r1,
      7,
      7,
      seed
    );
    oliveParts.push(prepareForMerge(g, new THREE.Matrix4()));
    g.dispose();
  };
  pushOliveBranch([[0, -0.35, 0], [-0.08, 0.75, 0.06], [0.06, 1.55, -0.05], [0.0, 2.35, 0.02]], 0.34, 0.16, 1.1);
  const boughAnchors: Array<[number, number, number, number]> = [
    [-0.95, 3.05, 0.45, 1.05],
    [0.98, 3.12, -0.35, 1.05],
    [0.25, 3.35, 0.92, 0.98],
    [-0.38, 3.25, -0.88, 0.98],
    [0.05, 3.85, 0.05, 1.15]
  ];
  boughAnchors.forEach(([bx, by, bz, _rad], bIdx) => {
    const midX = bx * 0.48;
    const midY = 2.55;
    const midZ = bz * 0.48;
    const tipX = bx * 0.94;
    const tipY = by - 0.12;
    const tipZ = bz * 0.94;
    pushOliveBranch(
      [[0, 2.0, 0], [midX, midY, midZ], [tipX, tipY, tipZ]],
      0.14,
      0.045,
      3.0 + bIdx * 1.7
    );
    // Tertiary olive twigs for crisp silhouette & natural close-up branching
    const tAng = bIdx * 1.25 + 0.7;
    pushOliveBranch(
      [[midX, midY, midZ], [tipX + Math.cos(tAng) * 0.45, tipY + 0.28, tipZ + Math.sin(tAng) * 0.45]],
      0.052,
      0.018,
      6.0 + bIdx * 2.1
    );
  });
  const treeTrunkGeo = mergeGeometries(oliveParts, false)!;
  oliveParts.forEach((g) => g.dispose());

  const oliveBarkMat = applyWorldSpaceWeathering(
    new THREE.MeshStandardMaterial({
      color: 0x5c6878,
      map: oakBarkPbr.map,
      normalMap: oakBarkPbr.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: oakBarkPbr.roughnessMap,
      aoMap: oakBarkPbr.aoMap,
      aoMapIntensity: 0.85,
      roughness: 0.90
    }),
    { macroScale: 0.32, mossHeight: 0.35, mossColor: '#24402b', dampRoughness: 0.55, dirtTint: '#2b2824' }
  );

  const treeTrunks = new THREE.InstancedMesh(treeTrunkGeo, oliveBarkMat, treeCoords.length);
  treeTrunks.name = 'TownOrchardTrunks';
  treeTrunks.castShadow = true;
  treeTrunks.receiveShadow = true;

  // Crossed 3-plane botanical leaf-cluster card geometry (zero sphere blobs!)
  const cardParts: THREE.BufferGeometry[] = [];
  for (const [angY, tiltX] of [
    [0.0, 0.22],
    [Math.PI / 3, -0.20],
    [(2 * Math.PI) / 3, 0.18]
  ]) {
    const p = new THREE.PlaneGeometry(1.18, 1.18);
    p.rotateX(tiltX);
    p.rotateY(angY);
    cardParts.push(prepareForMerge(p, new THREE.Matrix4()));
    p.dispose();
  }
  const oliveLeafCardGeo = mergeGeometries(cardParts, false)!;
  cardParts.forEach((g) => g.dispose());

  const oliveWindTimeUniform = { value: 0.0 };
  const oliveWindSpeedUniform = { value: 1.5 };
  const oliveFoliageMat = new THREE.MeshStandardMaterial({
    map: leafAtlasTex,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.74,
    metalness: 0.0
  });
  oliveFoliageMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = oliveWindTimeUniform;
    shader.uniforms.uWindSpeed = oliveWindSpeedUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindSpeed;
        varying vec3 vOliveWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float leafMask = clamp(uv.y, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vec3 instOrg = vec3(instanceMatrix[3].xyz);
        #else
          vec3 instOrg = vec3(0.0);
        #endif
        float leafPh = instOrg.x * 0.6 + instOrg.z * 0.5 + instOrg.y * 0.4;
        float leafSway = sin(uTime * (1.3 + uWindSpeed * 0.45) + leafPh) * 0.055;
        transformed.x += leafSway * leafMask;
        transformed.z += cos(uTime * 1.1 + leafPh) * 0.032 * leafMask;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vOliveWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vOliveWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vOliveWorldPos;`
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 oView = normalize(cameraPosition - vOliveWorldPos);
        vec3 oMoonDir = normalize(vec3(115.0, 125.0, -165.0));
        float oBacklit = pow(clamp(dot(oView, -oMoonDir), 0.0, 1.0), 2.2);
        outgoingLight += diffuseColor.rgb * oBacklit * vec3(0.55, 0.78, 1.05) * 0.45;
        #include <opaque_fragment>`
      );
  };
  oliveFoliageMat.customProgramCacheKey = () => 'starry-olive-foliage-v2';

  const oliveDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafAtlasTex,
    alphaTest: 0.45,
    side: THREE.DoubleSide
  });
  extraMaterials.push(oliveDepthMat);

  const cardsPerTree = 92;
  const shrubPositions: Array<[number, number, number]> = [
    [8.8, -22.2, 0.82],
    [8.2, -23.8, 0.90],
    [-12.2, -43.5, 0.85],
    [-16.8, -43.8, 0.88],
    [12.0, -44.2, 0.85],
    [11.8, -47.5, 0.82],
    [-29.2, -44.2, 0.92],
    [-7.4, 24.0, 0.86],
    [-11.8, 25.0, 0.90],
    [8.8, 29.5, 0.84],
    [11.8, 30.6, 0.88],
    [-10.2, -16.2, 0.78],
    [9.4, -18.0, 0.80],
    [-15.2, -28.0, 0.85],
    [9.2, -29.0, 0.82],
    [-21.2, -14.5, 0.92],
    [-16.2, -10.5, 0.86],
    [19.5, -13.5, 0.84],
    [-19.5, 18.5, 0.88],
    [24.0, 22.0, 0.90]
  ];
  const cardsPerShrub = 18;
  const totalOliveCards = treeCoords.length * cardsPerTree + shrubPositions.length * cardsPerShrub;
  const treeCrowns = new THREE.InstancedMesh(oliveLeafCardGeo, oliveFoliageMat, totalOliveCards);
  treeCrowns.name = 'TownOrchardCanopies';
  treeCrowns.castShadow = true;
  treeCrowns.receiveShadow = true;
  treeCrowns.customDepthMaterial = oliveDepthMat;

  const olivePalette = [
    new THREE.Color('#476e57'),
    new THREE.Color('#5d8768'),
    new THREE.Color('#3b5d50'),
    new THREE.Color('#7b9662'),
    new THREE.Color('#578478'),
    new THREE.Color('#869a74')
  ];
  const oPos = new THREE.Vector3();
  const oQuat = new THREE.Quaternion();
  const oEuler = new THREE.Euler();
  const oScale = new THREE.Vector3();
  let cardIdx = 0;

  treeCoords.forEach(([tx, tz, sc], idx) => {
    const ty = getHeight(tx, tz) - 0.15;
    const treeYaw = idx * 1.3;
    const cosY = Math.cos(treeYaw);
    const sinY = Math.sin(treeYaw);
    wDummy.makeRotationY(treeYaw);
    wDummy.scale(new THREE.Vector3(sc, sc, sc));
    wDummy.setPosition(tx, ty, tz);
    treeTrunks.setMatrixAt(idx, wDummy);

    for (let c = 0; c < cardsPerTree; c++) {
      const [ax, ay, az, ar] = boughAnchors[c % boughAnchors.length];
      const u1 = wheatRand();
      const u2 = wheatRand();
      const u3 = wheatRand();
      const th = u1 * Math.PI * 2;
      const ph = Math.acos(2 * u2 - 1);
      const rad = ar * (0.24 + 0.76 * Math.cbrt(u3));
      const lx = (ax + rad * Math.sin(ph) * Math.cos(th)) * sc;
      const ly = (ay + rad * Math.cos(ph) * 0.72) * sc;
      const lz = (az + rad * Math.sin(ph) * Math.sin(th)) * sc;
      const wx = tx + lx * cosY + lz * sinY;
      const wz = tz - lx * sinY + lz * cosY;

      oPos.set(wx, ty + ly, wz);
      oEuler.set((wheatRand() - 0.5) * 1.2, wheatRand() * Math.PI * 2, (wheatRand() - 0.5) * 1.2);
      oQuat.setFromEuler(oEuler);
      const cs = sc * (0.64 + wheatRand() * 0.44);
      oScale.set(cs, cs, cs);
      wDummy.compose(oPos, oQuat, oScale);
      treeCrowns.setMatrixAt(cardIdx, wDummy);
      treeCrowns.setColorAt(cardIdx, olivePalette[(idx + c) % olivePalette.length]);
      cardIdx++;
    }
  });

  // Grounded Provençal olive/rosemary garden shrubs along stone walls & cottage lanes
  shrubPositions.forEach(([sx, sz, sc], sIdx) => {
    const sy = getHeight(sx, sz);
    for (let c = 0; c < cardsPerShrub; c++) {
      const u1 = wheatRand();
      const u2 = wheatRand();
      const ang = u1 * Math.PI * 2;
      const rad = (0.12 + u2 * 0.62) * sc;
      const wx = sx + Math.cos(ang) * rad;
      const wz = sz + Math.sin(ang) * rad;
      const wy = sy + (0.28 + wheatRand() * 0.52) * sc;
      oPos.set(wx, wy, wz);
      oEuler.set((wheatRand() - 0.5) * 0.9, wheatRand() * Math.PI * 2, (wheatRand() - 0.5) * 0.9);
      oQuat.setFromEuler(oEuler);
      const cs = sc * (0.56 + wheatRand() * 0.36);
      oScale.set(cs, cs, cs);
      wDummy.compose(oPos, oQuat, oScale);
      treeCrowns.setMatrixAt(cardIdx, wDummy);
      treeCrowns.setColorAt(cardIdx, olivePalette[(sIdx + c * 2) % olivePalette.length]);
      cardIdx++;
    }
  });

  treeTrunks.instanceMatrix.needsUpdate = true;
  treeCrowns.instanceMatrix.needsUpdate = true;
  if (treeCrowns.instanceColor) treeCrowns.instanceColor.needsUpdate = true;
  townRoot.add(treeTrunks);
  townRoot.add(treeCrowns);

  // =========================================================================
  // 12. Moving Vintage Steam Train + Headlight Beam + Painted Steam Plume
  // =========================================================================
  const trainGroup = new THREE.Group();
  trainGroup.name = 'VintageSteamTrain';

  const trainDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2c406e,
    normalMap: stonePbr.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.56,
    metalness: 0.32
  });
  const trainCoachMat = new THREE.MeshStandardMaterial({
    color: 0x436da8,
    map: cobaltWallTex,
    normalMap: timberPbr.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.68
  });
  const trainBrassMat = new THREE.MeshStandardMaterial({
    color: 0xf4c44e,
    emissive: new THREE.Color(0xd98a12),
    emissiveIntensity: 0.85,
    metalness: 0.6,
    roughness: 0.3
  });
  const trainBeamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying float vAxial;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;

      void main() {
        // After translate(0, -3.75, 0) & rotateX(-PI/2), cone spans z = 0 (apex) to z = 7.5 (open base)
        vAxial = clamp(position.z / 7.5, 0.0, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalDir = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAxial;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;

      void main() {
        float axialFade = pow(clamp(1.0 - vAxial, 0.0, 1.0), 1.8) * smoothstep(0.0, 0.06, vAxial);
        float edgeFade = pow(max(dot(normalize(vNormalDir), normalize(vViewDir)), 0.0), 1.8);
        float alpha = axialFade * edgeFade * 0.14;
        gl_FragColor = vec4(1.0, 0.86, 0.44, alpha);
      }
    `
  });

  // Helper to batch sub-parts of a moving vehicle into minimal draw calls
  const buildMergedSubParts = (
    parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; matKey: string }>,
    target: THREE.Group,
    namePrefix: string
  ) => {
    const grouped = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
    for (const p of parts) {
      let entry = grouped.get(p.matKey);
      if (!entry) {
        entry = { mat: p.mat, geos: [] };
        grouped.set(p.matKey, entry);
      }
      entry.geos.push(prepareForMerge(p.geo, new THREE.Matrix4()));
      p.geo.dispose();
    }
    for (const [key, entry] of grouped.entries()) {
      const merged = mergeGeometries(entry.geos, false);
      entry.geos.forEach((g) => g.dispose());
      if (merged) {
        const m = new THREE.Mesh(merged, entry.mat);
        m.name = `${namePrefix}_${key}`;
        target.add(m);
      }
    }
  };

  // Build Detailed Steam Locomotive (boiler bands, steam dome, sand dome, cowcatcher, recessed cab windows, brass headlamp, spoked drivers)
  const locoGroup = new THREE.Group();
  locoGroup.name = 'SteamLocomotive';
  {
    const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; matKey: string }> = [];
    const addLoco = (geo: THREE.BufferGeometry, mat: THREE.Material, matKey: string, pos: [number, number, number], rot?: [number, number, number]) => {
      if (rot) geo.rotateX(rot[0]), geo.rotateY(rot[1]), geo.rotateZ(rot[2]);
      geo.translate(pos[0], pos[1], pos[2]);
      parts.push({ geo, mat, matKey });
    };

    // Heavy iron chassis frame + front cowcatcher buffer beam + running boards
    addLoco(new THREE.BoxGeometry(1.52, 0.42, 5.4), trainDarkMat, 'dark', [0, 0.56, 0]);
    addLoco(new THREE.BoxGeometry(1.68, 0.08, 3.5), trainDarkMat, 'dark', [0, 0.88, 0.72]);
    addLoco(new THREE.ConeGeometry(0.95, 0.95, 4), trainDarkMat, 'dark', [0, 0.36, 2.85], [Math.PI / 2, Math.PI / 4, 0]);
    // Cylindrical pressure boiler + smokebox front + brass boiler bands
    addLoco(new THREE.CylinderGeometry(0.68, 0.68, 3.35, 18), trainDarkMat, 'dark', [0, 1.38, 0.72], [Math.PI / 2, 0, 0]);
    addLoco(new THREE.SphereGeometry(0.64, 14, 10), trainDarkMat, 'dark', [0, 1.38, 2.38]);
    for (const bz of [-0.6, 0.05, 0.7, 1.35, 1.98]) {
      addLoco(new THREE.TorusGeometry(0.69, 0.032, 8, 20), trainBrassMat, 'brass', [0, 1.38, bz]);
    }
    // Steam dome, sand dome & brass safety valve whistles
    addLoco(new THREE.CylinderGeometry(0.30, 0.34, 0.52, 12), trainDarkMat, 'dark', [0, 2.16, 0.35]);
    addLoco(new THREE.SphereGeometry(0.30, 12, 8), trainBrassMat, 'brass', [0, 2.42, 0.35]);
    addLoco(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 12), trainDarkMat, 'dark', [0, 2.10, 1.15]);
    // Flared chimney smokestack + brass crown rim
    addLoco(new THREE.CylinderGeometry(0.32, 0.20, 1.35, 14), trainDarkMat, 'dark', [0, 2.48, 1.88]);
    addLoco(new THREE.TorusGeometry(0.31, 0.045, 8, 16), trainBrassMat, 'brass', [0, 3.15, 1.88], [Math.PI / 2, 0, 0]);
    // Engineer cab with overhanging arched roof, side & front recessed glass cab windows + brass handrails
    addLoco(new THREE.BoxGeometry(1.72, 1.62, 1.75), trainDarkMat, 'dark', [0, 1.58, -1.68]);
    addLoco(new THREE.BoxGeometry(1.94, 0.14, 2.02), trainBrassMat, 'brass', [0, 2.42, -1.68]);
    for (const side of [-0.87, 0.87]) {
      addLoco(new THREE.BoxGeometry(0.04, 0.56, 0.74), materials.windowGlow, 'glow', [side, 1.78, -1.65]);
      addLoco(new THREE.BoxGeometry(0.06, 0.56, 0.74), materials.windowGlass, 'glass', [side * 1.02, 1.78, -1.65]);
      addLoco(new THREE.CylinderGeometry(0.025, 0.025, 3.2, 6), trainBrassMat, 'brass', [side * 0.88, 1.52, 0.65], [Math.PI / 2, 0, 0]);
    }
    addLoco(new THREE.BoxGeometry(1.22, 0.46, 0.05), materials.windowGlow, 'glow', [0, 1.86, -0.80]);
    // Brass headlamp housing + glowing lens at nose
    addLoco(new THREE.CylinderGeometry(0.22, 0.24, 0.34, 12), trainBrassMat, 'brass', [0, 2.04, 2.38], [Math.PI / 2, 0, 0]);
    addLoco(new THREE.SphereGeometry(0.18, 10, 8), materials.gildedAccent, 'lamp', [0, 2.04, 2.55]);
    // Detailed Spoked Driving Wheels + Coupling Side Rods
    for (const wz of [-1.75, -0.55, 0.65, 1.82]) {
      const rWheel = wz < 1.2 ? 0.42 : 0.30;
      for (const side of [-0.80, 0.80]) {
        addLoco(new THREE.TorusGeometry(rWheel, 0.055, 8, 16), trainBrassMat, 'brass', [side, rWheel, wz], [0, Math.PI / 2, 0]);
        addLoco(new THREE.CylinderGeometry(0.10, 0.10, 0.12, 8), trainDarkMat, 'dark', [side, rWheel, wz], [0, 0, Math.PI / 2]);
        for (let sp = 0; sp < 4; sp++) {
          addLoco(new THREE.BoxGeometry(0.04, rWheel * 1.85, 0.045), trainBrassMat, 'brass', [side, rWheel, wz], [(sp / 4) * Math.PI, 0, 0]);
        }
      }
    }
    for (const side of [-0.86, 0.86]) {
      addLoco(new THREE.BoxGeometry(0.05, 0.08, 2.65), trainBrassMat, 'brass', [side, 0.42, -0.55]);
    }
    buildMergedSubParts(parts, locoGroup, 'SteamLocomotive');

    const beamGeo = new THREE.ConeGeometry(2.1, 8.5, 18, 1, true);
    beamGeo.translate(0, -4.25, 0);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMesh = new THREE.Mesh(beamGeo, trainBeamMat);
    beamMesh.name = 'LocomotiveHeadlightBeam';
    beamMesh.position.set(0, 2.04, 2.55);
    locoGroup.add(beamMesh);

    const locoHeadLight = new THREE.PointLight(0xffd066, 3.2, 24.0);
    locoHeadLight.position.set(0, 2.05, 3.2);
    locoGroup.add(locoHeadLight);
  }
  locoGroup.scale.setScalar(1.25);
  trainGroup.add(locoGroup);

  // Tender + 4 Vintage Passenger Carriages with Clerestory Roofs, Recessed Glass/Muntin Windows & Spoked Bogie Trucks
  const trainCars: THREE.Group[] = [locoGroup];
  const carCount = 5; // 1 coal tender + 4 glowing passenger coaches
  for (let c = 0; c < carCount; c++) {
    const car = new THREE.Group();
    const isTender = c === 0;
    const len = isTender ? 3.2 : 4.8;
    const bodyH = isTender ? 1.15 : 1.58;
    const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; matKey: string }> = [];

    const addCarPart = (geo: THREE.BufferGeometry, mat: THREE.Material, matKey: string, pos: [number, number, number], rot?: [number, number, number]) => {
      if (rot) geo.rotateZ(rot[2]), geo.rotateY(rot[1]), geo.rotateX(rot[0]);
      geo.translate(pos[0], pos[1], pos[2]);
      parts.push({ geo, mat, matKey });
    };

    addCarPart(new THREE.BoxGeometry(1.52, 0.35, len), trainDarkMat, 'dark', [0, 0.42, 0]);
    addCarPart(
      new THREE.BoxGeometry(1.56, bodyH, len - 0.18),
      isTender ? trainDarkMat : trainCoachMat,
      isTender ? 'dark' : 'coach',
      [0, 0.6 + bodyH * 0.5, 0]
    );

    if (!isTender) {
      // Arched coach roof + raised clerestory monitor skylight + brass belt trim
      addCarPart(
        new THREE.CylinderGeometry(0.84, 0.84, len, 12, 1, false, 0, Math.PI),
        trainDarkMat,
        'dark',
        [0, 0.6 + bodyH, 0],
        [0, Math.PI / 2, Math.PI / 2]
      );
      addCarPart(new THREE.BoxGeometry(0.76, 0.24, len - 0.55), trainDarkMat, 'dark', [0, 0.6 + bodyH + 0.46, 0]);
      addCarPart(new THREE.BoxGeometry(1.62, 0.08, len - 0.12), trainBrassMat, 'brass', [0, 1.06, 0]);
      addCarPart(new THREE.BoxGeometry(1.62, 0.07, len - 0.12), trainBrassMat, 'brass', [0, 1.98, 0]);
      for (let w = -1.55; w <= 1.55; w += 0.78) {
        for (const side of [-1, 1]) {
          addCarPart(new THREE.BoxGeometry(0.04, 0.54, 0.48), materials.windowGlow, 'glow', [side * 0.79, 1.50, w]);
          addCarPart(new THREE.BoxGeometry(0.03, 0.54, 0.48), materials.windowGlass, 'glass', [side * 0.81, 1.50, w]);
          addCarPart(new THREE.BoxGeometry(0.06, 0.56, 0.05), trainBrassMat, 'brass', [side * 0.82, 1.50, w]);
        }
      }
    } else {
      // Mounded coal load inside tender + brass trim rail
      addCarPart(new THREE.SphereGeometry(0.68, 10, 8), trainDarkMat, 'dark', [0, 1.65, 0]);
      addCarPart(new THREE.BoxGeometry(1.64, 0.08, len - 0.14), trainBrassMat, 'brass', [0, 1.72, 0]);
    }

    // Spoked wheel bogie trucks & side frames
    for (const bogieZ of [-len * 0.30, len * 0.30]) {
      for (const side of [-0.76, 0.76]) {
        addCarPart(new THREE.BoxGeometry(0.08, 0.16, 1.05), trainDarkMat, 'dark', [side * 1.03, 0.32, bogieZ]);
        for (const ax of [-0.34, 0.34]) {
          addCarPart(new THREE.TorusGeometry(0.28, 0.045, 6, 12), trainBrassMat, 'brass', [side, 0.28, bogieZ + ax], [0, Math.PI / 2, 0]);
          addCarPart(new THREE.BoxGeometry(0.03, 0.52, 0.035), trainDarkMat, 'dark', [side, 0.28, bogieZ + ax]);
          addCarPart(new THREE.BoxGeometry(0.03, 0.035, 0.52), trainDarkMat, 'dark', [side, 0.28, bogieZ + ax]);
        }
      }
    }

    buildMergedSubParts(parts, car, `TrainCar_${c + 1}`);
    car.scale.setScalar(1.25);
    trainCars.push(car);
    trainGroup.add(car);
  }
  townRoot.add(trainGroup);

  // Animated Painted Steam Puffs behind moving train smokestack (airy billowing oil puffs, never a hose!)
  const steamCount = 135;
  const steamOffsets = new Float32Array(steamCount * 3);
  const steamPhases = new Float32Array(steamCount);
  for (let i = 0; i < steamCount; i++) {
    steamPhases[i] = i / steamCount;
    // Per-puff radial seed offsets so puffs scatter into volumetric billowing tufts as they rise
    const s1 = Math.sin(i * 12.9898 + 1.7);
    const s2 = Math.cos(i * 78.233 + 3.1);
    const s3 = Math.sin(i * 41.123 + 0.5);
    steamOffsets[i * 3] = s1;
    steamOffsets[i * 3 + 1] = s2;
    steamOffsets[i * 3 + 2] = s3;
  }
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamOffsets, 3));
  steamGeo.setAttribute('aPhase', new THREE.BufferAttribute(steamPhases, 1));

  const steamMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0.0 },
        uStackPos: { value: new THREE.Vector3(0, 0, -70) },
        uTrainDir: { value: new THREE.Vector3(1, 0, 0) }
      }
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform vec3 uStackPos;
      uniform vec3 uTrainDir;
      attribute float aPhase;
      varying float vLife;
      varying float vSeed;

      void main() {
        float life = fract(uTime * 0.22 + aPhase);
        vLife = life;
        vSeed = fract(sin(aPhase * 127.1) * 43758.5453);

        // Radial billowing spread growing naturally with plume age
        float spread = 0.3 + life * 3.8;
        vec3 p = uStackPos;
        p -= uTrainDir * (life * 22.0 + vSeed * 1.4);
        p.y += life * 13.5 + sin(uTime * 1.5 - life * 7.0 + vSeed * 6.28) * (0.25 + life * 1.3) + position.y * spread * 0.32;
        p.x += sin(uTime * 1.1 - life * 5.8 + vSeed * 9.4) * (0.3 + life * 1.9) + position.x * spread;
        p.z += cos(uTime * 0.9 - life * 5.0 + vSeed * 7.8) * (0.3 + life * 1.5) + position.z * spread;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float sizeVar = 0.72 + 0.65 * fract(vSeed * 7.13);
        gl_PointSize = clamp((1050.0 + life * 2400.0) * sizeVar / max(-mvPosition.z, 1.0), 12.0, 68.0);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vLife;
      varying float vSeed;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;

        // Soft painterly cloud breakup along edges so puffs feel airy and tufted
        float ang = atan(c.y, c.x) + vSeed * 6.283;
        float tuftWarp = 0.82 + 0.18 * sin(ang * 3.0 + vLife * 4.0) * cos(ang * 2.0 - vSeed * 5.0);
        float dMod = d / tuftWarp;
        float cloud = pow(clamp(1.0 - dMod * 2.0, 0.0, 1.0), 1.5);
        float grain = 0.72 + 0.28 * sin(c.x * 16.0 + vSeed * 19.0) * cos(c.y * 16.0 - vSeed * 11.0);
        float fade = sin(vLife * 3.14159);
        float puffAlpha = 0.55 + 0.45 * fract(vSeed * 13.7);

        // Warm locomotive firebox ember glow near smokestack mouth fading into moonlit silver-cobalt steam
        vec3 emberGlow = vec3(1.18, 0.56, 0.14);
        vec3 freshSteam = vec3(0.84, 0.88, 0.98);
        vec3 coolPlume = vec3(0.32, 0.50, 0.84);
        vec3 col = mix(emberGlow, freshSteam, smoothstep(0.0, 0.14, vLife));
        col = mix(col, coolPlume, smoothstep(0.14, 0.78, vLife));
        gl_FragColor = vec4(col, cloud * grain * fade * puffAlpha * 0.19);
        #include <fog_fragment>
      }
    `
  });
  const trainSteamPoints = new THREE.Points(steamGeo, steamMat);
  trainSteamPoints.name = 'TrainSteamPlume';
  trainSteamPoints.frustumCulled = false;
  townRoot.add(trainSteamPoints);

  // =========================================================================
  // 13. Moving Country Horse Carriage with Rotating Wheels & Swinging Lantern
  // =========================================================================
  const carriageGroup = new THREE.Group();
  carriageGroup.name = 'CountryCarriage';

  const carriageWoodMat = new THREE.MeshStandardMaterial({
    color: 0x4b352a,
    map: timberPbr.map,
    normalMap: timberPbr.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: timberPbr.roughnessMap,
    roughness: 0.74
  });
  const horseMat = new THREE.MeshStandardMaterial({
    color: 0x85593c,
    normalMap: plasterPbr.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.76
  });

  // Build merged Carriage Cab + Horse + 4 Merged Spoked Wheels
  const carriageParts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; matKey: string }> = [];
  const addCarr = (geo: THREE.BufferGeometry, mat: THREE.Material, matKey: string, pos: [number, number, number], rot?: [number, number, number]) => {
    if (rot) geo.rotateZ(rot[2]), geo.rotateY(rot[1]), geo.rotateX(rot[0]);
    geo.translate(pos[0], pos[1], pos[2]);
    carriageParts.push({ geo, mat, matKey });
  };
  addCarr(new THREE.BoxGeometry(1.28, 1.12, 1.85), carriageWoodMat, 'wood', [0, 1.08, -0.45]);
  addCarr(new THREE.CylinderGeometry(0.68, 0.68, 1.95, 8, 1, false, 0, Math.PI), trainDarkMat, 'roof', [0, 1.62, -0.45], [0, Math.PI / 2, Math.PI / 2]);
  addCarr(new THREE.BoxGeometry(0.04, 0.48, 0.75), materials.windowGlow, 'glow', [-0.66, 1.24, -0.45]);
  addCarr(new THREE.BoxGeometry(0.04, 0.48, 0.75), materials.windowGlow, 'glow', [0.66, 1.24, -0.45]);
  addCarr(new THREE.BoxGeometry(1.1, 0.25, 0.5), carriageWoodMat, 'wood', [0, 1.05, 0.68]);
  addCarr(new THREE.BoxGeometry(0.07, 0.07, 1.8), carriageWoodMat, 'wood', [-0.36, 0.72, 1.4]);
  addCarr(new THREE.BoxGeometry(0.07, 0.07, 1.8), carriageWoodMat, 'wood', [0.36, 0.72, 1.4]);
  buildMergedSubParts(carriageParts, carriageGroup, 'CarriageBody');

  // Horse silhouette pulling ahead (1 merged draw call!)
  const horseNode = new THREE.Group();
  horseNode.position.set(0, 0.92, 2.15);
  const horseParts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; matKey: string }> = [];
  const addHorse = (geo: THREE.BufferGeometry, pos: [number, number, number], rx = 0) => {
    if (rx !== 0) geo.rotateX(rx);
    geo.translate(pos[0], pos[1], pos[2]);
    horseParts.push({ geo, mat: horseMat, matKey: 'horse' });
  };
  addHorse(new THREE.BoxGeometry(0.54, 0.58, 1.25), [0, 0, 0]);
  addHorse(new THREE.BoxGeometry(0.28, 0.68, 0.34), [0, 0.42, 0.54], 0.42);
  addHorse(new THREE.BoxGeometry(0.24, 0.26, 0.48), [0, 0.66, 0.8], 0.35);
  for (const lx of [-0.18, 0.18]) {
    for (const lz of [-0.42, 0.42]) {
      addHorse(new THREE.CylinderGeometry(0.07, 0.055, 0.78, 6), [lx, -0.52, lz]);
    }
  }
  buildMergedSubParts(horseParts, horseNode, 'CarriageHorse');
  carriageGroup.add(horseNode);

  // 4 Rotating Spoked Wheels (1 merged geometry per wheel!)
  const makeWheelGeo = (r: number) => {
    const geos: THREE.BufferGeometry[] = [];
    const rim = new THREE.TorusGeometry(r, 0.045, 6, 12);
    rim.rotateY(Math.PI / 2);
    geos.push(prepareForMerge(rim, new THREE.Matrix4()));
    rim.dispose();
    for (let sp = 0; sp < 4; sp++) {
      const spoke = new THREE.BoxGeometry(0.04, r * 1.9, 0.04);
      spoke.rotateX((sp / 4) * Math.PI);
      geos.push(prepareForMerge(spoke, new THREE.Matrix4()));
      spoke.dispose();
    }
    const merged = mergeGeometries(geos, false)!;
    geos.forEach((g) => g.dispose());
    return merged;
  };
  const wheelLargeGeo = makeWheelGeo(0.48);
  const wheelSmallGeo = makeWheelGeo(0.38);

  const carriageWheels: Array<{ mesh: THREE.Object3D; radius: number }> = [];
  const wheelSpecs: Array<{ x: number; y: number; z: number; r: number; geo: THREE.BufferGeometry }> = [
    { x: -0.72, y: 0.48, z: -1.12, r: 0.48, geo: wheelLargeGeo },
    { x: 0.72, y: 0.48, z: -1.12, r: 0.48, geo: wheelLargeGeo },
    { x: -0.68, y: 0.38, z: 0.45, r: 0.38, geo: wheelSmallGeo },
    { x: 0.68, y: 0.38, z: 0.45, r: 0.38, geo: wheelSmallGeo }
  ];
  for (const ws of wheelSpecs) {
    const wMesh = new THREE.Mesh(ws.geo, carriageWoodMat);
    wMesh.name = 'CarriageWheel';
    wMesh.position.set(ws.x, ws.y, ws.z);
    carriageGroup.add(wMesh);
    carriageWheels.push({ mesh: wMesh, radius: ws.r });
  }

  // Swinging warm amber carriage lantern + soft point light
  const lanternPivot = new THREE.Group();
  lanternPivot.position.set(0.68, 1.38, 0.68);
  const lanternArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), carriageWoodMat);
  lanternArm.position.set(0.08, 0, 0);
  lanternPivot.add(lanternArm);
  const lanternBulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), materials.gildedAccent);
  lanternBulb.position.set(0.15, -0.14, 0);
  lanternPivot.add(lanternBulb);
  const carriageLight = new THREE.PointLight(0xffb703, 1.85, 14.0);
  carriageLight.position.set(0.15, -0.14, 0);
  lanternPivot.add(carriageLight);
  carriageGroup.add(lanternPivot);
  townRoot.add(carriageGroup);

  // =========================================================================
  // 13b. Animated Rising Cottage Chimney Smoke Puffs (Points)
  // =========================================================================
  const puffsPerChimney = 10;
  const smokeTotal = Math.max(1, chimneyPositions.length * puffsPerChimney);
  const smokeOrigins = new Float32Array(smokeTotal * 3);
  const smokePhases = new Float32Array(smokeTotal);
  const smokeSeeds = new Float32Array(smokeTotal);

  if (chimneyPositions.length > 0) {
    let idx = 0;
    for (let c = 0; c < chimneyPositions.length; c++) {
      const ch = chimneyPositions[c];
      for (let p = 0; p < puffsPerChimney; p++) {
        smokeOrigins[idx * 3] = ch.x;
        smokeOrigins[idx * 3 + 1] = ch.y;
        smokeOrigins[idx * 3 + 2] = ch.z;
        smokePhases[idx] = (p / puffsPerChimney + c * 0.17) % 1.0;
        smokeSeeds[idx] = ((c * 13 + p * 7) % 97) / 97;
        idx++;
      }
    }
  }

  const chimneySmokeGeo = new THREE.BufferGeometry();
  chimneySmokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeOrigins, 3));
  chimneySmokeGeo.setAttribute('aPhase', new THREE.BufferAttribute(smokePhases, 1));
  chimneySmokeGeo.setAttribute('aSeed', new THREE.BufferAttribute(smokeSeeds, 1));
  chimneySmokeGeo.computeBoundingSphere();

  const chimneySmokeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0.0 },
        uWindSpeed: { value: 1.5 },
        uWindDirection: { value: new THREE.Vector2(0.85, 0.45).normalize() }
      }
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform vec2 uWindDirection;
      attribute float aPhase;
      attribute float aSeed;
      varying float vLife;
      varying float vSeed;

      void main() {
        float life = fract(uTime * 0.14 + aPhase);
        vLife = life;
        vSeed = aSeed;

        vec3 p = position;
        float rise = life * 5.8;
        float drift = life * life * (1.8 + uWindSpeed * 0.9);
        float curlX = sin(uTime * 1.4 - life * 5.5 + aSeed * 12.0) * (0.18 + life * 0.55);
        float curlZ = cos(uTime * 1.2 - life * 4.8 + aSeed * 9.0) * (0.18 + life * 0.55);

        p.x += uWindDirection.x * drift + curlX;
        p.y += rise;
        p.z += uWindDirection.y * drift + curlZ;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((240.0 + life * 560.0) / max(-mvPosition.z, 1.0), 5.0, 28.0);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vLife;
      varying float vSeed;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;

        float soft = pow(clamp(1.0 - d * 2.0, 0.0001, 1.0), 1.6);
        float fade = sin(vLife * 3.14159);
        vec3 warmBase = vec3(0.68, 0.52, 0.34);
        vec3 coolWisp = vec3(0.38, 0.52, 0.78);
        vec3 col = mix(warmBase, coolWisp, smoothstep(0.0, 0.35, vLife));
        gl_FragColor = vec4(col, soft * fade * (0.20 + 0.08 * vSeed));
        #include <fog_fragment>
      }
    `
  });

  const chimneySmokePoints = new THREE.Points(chimneySmokeGeo, chimneySmokeMat);
  chimneySmokePoints.name = 'VillageChimneySmoke';
  chimneySmokePoints.frustumCulled = false;
  townRoot.add(chimneySmokePoints);

  scene.add(townRoot);

  // =========================================================================
  // 14. Per-Frame Town Animation Handle
  // =========================================================================
  const trainPos = new THREE.Vector3();
  const trainTan = new THREE.Vector3();
  const stackWorld = new THREE.Vector3();
  const cPos = new THREE.Vector3();
  const cDir = new THREE.Vector3();
  const cNorm = new THREE.Vector3();
  const cRight = new THREE.Vector3();
  const cUp = new THREE.Vector3();
  const cNegRight = new THREE.Vector3();
  const cRotMat = new THREE.Matrix4();
  const lastCarriagePos = new THREE.Vector3();
  let initializedMotion = false;

  const setAudioEnergy = (bass: number, mid: number, treble: number) => {
    const safeBass = Number.isFinite(bass) ? Math.max(0, Math.min(2, bass)) : 0;
    const safeMid = Number.isFinite(mid) ? Math.max(0, Math.min(2, mid)) : 0;
    const safeTreble = Number.isFinite(treble) ? Math.max(0, Math.min(2, treble)) : 0;

    streamWaterMat.uniforms.uBassEnergy.value = safeBass;
    streamWaterMat.uniforms.uTrebleEnergy.value = safeTreble;
    fountainWaterMat.uniforms.uAudioEnergy.value = safeBass * 0.5 + safeMid * 0.5;
  };

  const update = (
    deltaTime: number,
    elapsedTime: number,
    windSpeed = 1.5,
    windDir: [number, number] = [0.85, 0.45]
  ) => {
    const wx = Number.isFinite(windDir[0]) ? windDir[0] : 0.85;
    const wz = Number.isFinite(windDir[1]) ? windDir[1] : 0.45;
    const wLen = Math.hypot(wx, wz);
    const nwx = wLen > 0.0001 ? wx / wLen : 0.85;
    const nwz = wLen > 0.0001 ? wz / wLen : 0.45;

    fountainWaterMat.uniforms.uTime.value = elapsedTime;
    streamWaterMat.uniforms.uTime.value = elapsedTime;
    softGlowMat.uniforms.uTime.value = elapsedTime;
    lampPoolMat.uniforms.uTime.value = elapsedTime;

    chimneySmokeMat.uniforms.uTime.value = elapsedTime;
    chimneySmokeMat.uniforms.uWindSpeed.value = windSpeed;
    chimneySmokeMat.uniforms.uWindDirection.value.set(nwx, nwz);

    wheatMat.uniforms.uTime.value = elapsedTime;
    wheatMat.uniforms.uWindSpeed.value = windSpeed;
    wheatMat.uniforms.uWindDirection.value.set(nwx, nwz);
    oliveWindTimeUniform.value = elapsedTime;
    oliveWindSpeedUniform.value = windSpeed;

    // 1. Update Steam Train along valley viaduct spline (positions right in western/center valley vista)
    const trainSpeed = 0.018; // traverses valley smoothly
    const headU = 0.14 + ((elapsedTime * trainSpeed + 0.18) % 0.85);
    const carSpacingU = 0.024;

    trainCars.forEach((car, i) => {
      const u = Math.max(0.005, Math.min(0.995, headU - i * carSpacingU));
      railCurve.getPointAt(u, trainPos);
      railCurve.getTangentAt(u, trainTan);
      car.position.copy(trainPos);
      car.lookAt(trainPos.x + trainTan.x, trainPos.y + trainTan.y, trainPos.z + trainTan.z);
    });

    // Update billowing train steam origin at locomotive's smokestack
    locoGroup.updateMatrixWorld(true);
    railCurve.getPointAt(headU, trainPos);
    railCurve.getTangentAt(headU, trainTan);
    stackWorld.set(0, 3.1, 1.65);
    locoGroup.localToWorld(stackWorld);
    steamMat.uniforms.uTime.value = elapsedTime;
    steamMat.uniforms.uStackPos.value.copy(stackWorld);
    steamMat.uniforms.uTrainDir.value.copy(trainTan);

    // 2. Update Country Horse Carriage along the cross-town cobblestone ellipse (starts at plaza south edge)
    const carriageTheta = Math.PI * 0.42 + elapsedTime * 0.14;
    evaluateCarriageLoop(carriageTheta, getHeight, cPos, cDir);
    getNormal(cPos.x, cPos.z, cNorm);
    cRight.crossVectors(cDir, cNorm);
    if (cRight.lengthSq() < 0.0001) cRight.set(1, 0, 0);
    cRight.normalize();
    cUp.crossVectors(cRight, cDir).normalize();
    cNegRight.copy(cRight).negate();
    cRotMat.makeBasis(cNegRight, cUp, cDir);
    carriageGroup.position.copy(cPos);
    carriageGroup.quaternion.setFromRotationMatrix(cRotMat);

    // Spin wheels cleanly according to traveled distance + animate horse trot & swinging lantern
    const stepDist = initializedMotion ? cPos.distanceTo(lastCarriagePos) : deltaTime * 3.2;
    lastCarriagePos.copy(cPos);
    initializedMotion = true;

    for (const w of carriageWheels) {
      w.mesh.rotation.x += stepDist / w.radius;
    }
    horseNode.position.y = 0.92 + Math.abs(Math.sin(elapsedTime * 5.2)) * 0.05;
    lanternPivot.rotation.z = Math.sin(elapsedTime * 3.8) * 0.14;
    lanternPivot.rotation.x = Math.cos(elapsedTime * 2.9) * 0.08;

    // 3. Spin Old Provençal Windmill sails smoothly & flicker town warm lights subtly
    moulinRotorGroup.rotation.z = -elapsedTime * 0.42;
    for (let i = 0; i < flickerLights.length; i++) {
      const fl = flickerLights[i];
      const f = 1.0 + 0.09 * Math.sin(elapsedTime * 4.5 + fl.phase) + 0.04 * Math.cos(elapsedTime * 9.8 + i);
      fl.light.intensity = fl.baseIntensity * f;
    }
  };

  // Run one initial layout update at t=0 so train & carriage sit properly positioned on frame 0
  update(0, 0);

  return {
    group: townRoot,
    windowMaterials,
    flickerLights,
    chimneyPositions,
    pbrSets,
    extraTextures,
    extraMaterials,
    setAudioEnergy,
    update
  };
}
