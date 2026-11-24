import * as THREE from 'three';
import type { AnimatedTimeUniform } from './types';

export type { AnimatedTimeUniform };

export interface PartRotationEuler {
  rx?: number;
  ry?: number;
  rz?: number;
}

const KEEP_MERGE_ATTRS = new Set(['position', 'normal', 'uv', 'color']);
const _strutDir = new THREE.Vector3();
const _strutUp = new THREE.Vector3(0, 1, 0);
const _strutQuat = new THREE.Quaternion();
const _strutMid = new THREE.Vector3();
const _strutMat = new THREE.Matrix4();
const _strutOne = new THREE.Vector3(1, 1, 1);

function ensureBasicAttributes(g: THREE.BufferGeometry): void {
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const pos = g.attributes.position;
    const count = pos.count;
    const uvs = new Float32Array(count * 2);
    if (!(pos as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
      const pArr = pos.array;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const i2 = i * 2;
        uvs[i2] = (pArr[i3] + pArr[i3 + 2]) * 0.25;
        uvs[i2 + 1] = pArr[i3 + 1] * 0.25;
      }
    } else {
      for (let i = 0; i < count; i++) {
        uvs[i * 2] = (pos.getX(i) + pos.getZ(i)) * 0.25;
        uvs[i * 2 + 1] = pos.getY(i) * 0.25;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  for (const key in g.attributes) {
    if (!KEEP_MERGE_ATTRS.has(key)) {
      g.deleteAttribute(key);
    }
  }
}

/**
 * Ensures geometry is non-indexed with position, normal, and uv attributes so mergeGeometries succeeds cleanly.
 */
export function normalizeForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  ensureBasicAttributes(g);
  if (g !== geo) {
    geo.dispose();
  }
  return g;
}

/**
 * Merges an array of BufferGeometries in a single typed-array pass (avoiding per-part toNonIndexed allocations)
 * and disposes the temporary inputs.
 */
export function mergeNormalized(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const len = geos.length;
  if (len === 0) return new THREE.BoxGeometry(0.01, 0.01, 0.01);
  if (len === 1) {
    const g = geos[0];
    if (!g || !g.attributes.position) return new THREE.BoxGeometry(0.01, 0.01, 0.01);
    ensureBasicAttributes(g);
    return g;
  }

  let totalVerts = 0;
  let hasColor = false;
  let colorItemSize = 3;

  for (let i = 0; i < len; i++) {
    const g = geos[i];
    const pos = g?.attributes?.position;
    if (!pos || pos.count === 0) continue;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!hasColor && g.attributes.color) {
      hasColor = true;
      colorItemSize = g.attributes.color.itemSize;
    }
    totalVerts += g.index ? g.index.count : pos.count;
  }

  if (totalVerts === 0) {
    for (let i = 0; i < len; i++) geos[i]?.dispose();
    return new THREE.BoxGeometry(0.01, 0.01, 0.01);
  }

  const outPos = new Float32Array(totalVerts * 3);
  const outNorm = new Float32Array(totalVerts * 3);
  const outUv = new Float32Array(totalVerts * 2);
  const outCol = hasColor ? new Float32Array(totalVerts * colorItemSize) : null;

  let vOff = 0;
  for (let i = 0; i < len; i++) {
    const g = geos[i];
    const pos = g?.attributes?.position;
    if (!pos || pos.count === 0) {
      g?.dispose();
      continue;
    }
    const norm = g.attributes.normal;
    const uv = g.attributes.uv;
    const col = g.attributes.color;
    const idx = g.index;
    const posInterleaved = Boolean((pos as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute);

    if (!idx && !posInterleaved) {
      const vCount = pos.count;
      const pArr = pos.array as Float32Array;
      const nArr = norm.array as Float32Array;
      const dst3 = vOff * 3;
      const dst2 = vOff * 2;

      outPos.set(pArr.length === vCount * 3 ? pArr : pArr.subarray(0, vCount * 3), dst3);
      outNorm.set(nArr.length === vCount * 3 ? nArr : nArr.subarray(0, vCount * 3), dst3);

      if (uv && !(uv as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
        const uArr = uv.array as Float32Array;
        outUv.set(uArr.length === vCount * 2 ? uArr : uArr.subarray(0, vCount * 2), dst2);
      } else {
        for (let j = 0; j < vCount; j++) {
          const s3 = dst3 + j * 3;
          const d2 = dst2 + j * 2;
          outUv[d2] = (outPos[s3] + outPos[s3 + 2]) * 0.25;
          outUv[d2 + 1] = outPos[s3 + 1] * 0.25;
        }
      }

      if (outCol) {
        const dstC = vOff * colorItemSize;
        if (col && col.itemSize === colorItemSize && !(col as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) {
          const cArr = col.array as Float32Array;
          outCol.set(cArr.length === vCount * colorItemSize ? cArr : cArr.subarray(0, vCount * colorItemSize), dstC);
        } else {
          outCol.fill(1, dstC, dstC + vCount * colorItemSize);
        }
      }
      vOff += vCount;
    } else if (idx && !posInterleaved) {
      const idxArr = idx.array;
      const vCount = idx.count;
      const pArr = pos.array;
      const nArr = norm.array;
      const uArr = uv && !(uv as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? uv.array : null;
      const cArr = col && col.itemSize === colorItemSize && !(col as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute ? col.array : null;

      if (uArr) {
        for (let j = 0, d3 = vOff * 3, d2 = vOff * 2; j < vCount; j++, d3 += 3, d2 += 2) {
          const vi = idxArr[j];
          const vi3 = vi * 3;
          const vi2 = vi * 2;
          outPos[d3] = pArr[vi3];
          outPos[d3 + 1] = pArr[vi3 + 1];
          outPos[d3 + 2] = pArr[vi3 + 2];
          outNorm[d3] = nArr[vi3];
          outNorm[d3 + 1] = nArr[vi3 + 1];
          outNorm[d3 + 2] = nArr[vi3 + 2];
          outUv[d2] = uArr[vi2];
          outUv[d2 + 1] = uArr[vi2 + 1];
        }
      } else {
        for (let j = 0, d3 = vOff * 3, d2 = vOff * 2; j < vCount; j++, d3 += 3, d2 += 2) {
          const vi = idxArr[j];
          const vi3 = vi * 3;
          const px = pArr[vi3];
          const py = pArr[vi3 + 1];
          const pz = pArr[vi3 + 2];
          outPos[d3] = px;
          outPos[d3 + 1] = py;
          outPos[d3 + 2] = pz;
          outNorm[d3] = nArr[vi3];
          outNorm[d3 + 1] = nArr[vi3 + 1];
          outNorm[d3 + 2] = nArr[vi3 + 2];
          outUv[d2] = (px + pz) * 0.25;
          outUv[d2 + 1] = py * 0.25;
        }
      }

      if (outCol) {
        const dstC = vOff * colorItemSize;
        if (cArr) {
          if (colorItemSize === 3) {
            for (let j = 0; j < vCount; j++) {
              const vi3 = idxArr[j] * 3;
              const dc = dstC + j * 3;
              outCol[dc] = cArr[vi3];
              outCol[dc + 1] = cArr[vi3 + 1];
              outCol[dc + 2] = cArr[vi3 + 2];
            }
          } else {
            for (let j = 0; j < vCount; j++) {
              const src = idxArr[j] * colorItemSize;
              const dc = dstC + j * colorItemSize;
              for (let k = 0; k < colorItemSize; k++) {
                outCol[dc + k] = cArr[src + k];
              }
            }
          }
        } else {
          outCol.fill(1, dstC, dstC + vCount * colorItemSize);
        }
      }
      vOff += vCount;
    } else {
      // Fallback for interleaved attributes
      const vCount = idx ? idx.count : pos.count;
      for (let j = 0; j < vCount; j++) {
        const vi = idx ? idx.getX(j) : j;
        const d3 = (vOff + j) * 3;
        const px = pos.getX(vi);
        const py = pos.getY(vi);
        const pz = pos.getZ(vi);
        outPos[d3] = px;
        outPos[d3 + 1] = py;
        outPos[d3 + 2] = pz;
        outNorm[d3] = norm.getX(vi);
        outNorm[d3 + 1] = norm.getY(vi);
        outNorm[d3 + 2] = norm.getZ(vi);
        const d2 = (vOff + j) * 2;
        if (uv) {
          outUv[d2] = uv.getX(vi);
          outUv[d2 + 1] = uv.getY(vi);
        } else {
          outUv[d2] = (px + pz) * 0.25;
          outUv[d2 + 1] = py * 0.25;
        }
        if (outCol) {
          const dc = (vOff + j) * colorItemSize;
          if (col && col.itemSize >= 3) {
            outCol[dc] = col.getX(vi);
            outCol[dc + 1] = col.getY(vi);
            outCol[dc + 2] = col.getZ(vi);
          } else {
            for (let k = 0; k < colorItemSize; k++) outCol[dc + k] = 1;
          }
        }
      }
      vOff += vCount;
    }

    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(outNorm, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
  if (outCol) {
    merged.setAttribute('color', new THREE.BufferAttribute(outCol, colorItemSize));
  }
  return merged;
}

const _tEuler = new THREE.Euler();
const _tQuat = new THREE.Quaternion();
const _tPos = new THREE.Vector3();
const _tMat = new THREE.Matrix4();

let _unitBoxCache: { pos: Float32Array; norm: Float32Array; uv: Float32Array; index: Uint16Array } | null = null;
function getUnitBoxTemplate() {
  if (!_unitBoxCache) {
    const tmp = new THREE.BoxGeometry(1, 1, 1);
    _unitBoxCache = {
      pos: new Float32Array(tmp.attributes.position.array),
      norm: new Float32Array(tmp.attributes.normal.array),
      uv: new Float32Array(tmp.attributes.uv.array),
      index: new Uint16Array(tmp.index!.array)
    };
    tmp.dispose();
  }
  return _unitBoxCache;
}

/**
 * Rotates geometry around X -> Y -> Z axes, then translates to (x, y, z).
 */
export function transformGeometryXYZ(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotX = 0,
  rotZ = 0
): THREE.BufferGeometry {
  if (rotX === 0 && rotY === 0 && rotZ === 0) {
    if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
    return geo;
  }
  // Equivalent to rotateX(rotX) then rotateY(rotY) then rotateZ(rotZ) => ZYX intrinsic / XYZ extrinsic
  _tEuler.set(rotX, rotY, rotZ, 'ZYX');
  _tQuat.setFromEuler(_tEuler);
  _tPos.set(x, y, z);
  _tMat.compose(_tPos, _tQuat, _strutOne);
  geo.applyMatrix4(_tMat);
  return geo;
}

/**
 * Rotates geometry around X -> Z -> Y axes, then translates to (x, y, z).
 */
export function transformGeometryXZY(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotZ = 0,
  rotY = 0
): THREE.BufferGeometry {
  if (rotX === 0 && rotY === 0 && rotZ === 0) {
    if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
    return geo;
  }
  // Equivalent to rotateX(rotX) then rotateZ(rotZ) then rotateY(rotY) => YZX intrinsic
  _tEuler.set(rotX, rotY, rotZ, 'YZX');
  _tQuat.setFromEuler(_tEuler);
  _tPos.set(x, y, z);
  _tMat.compose(_tPos, _tQuat, _strutOne);
  geo.applyMatrix4(_tMat);
  return geo;
}

const _paintColor = new THREE.Color();

/**
 * Ensures basic attributes and fills a uniform RGB `color` vertex attribute without redundant toNonIndexed().
 */
export function paintGeometryVertexColor(
  geo: THREE.BufferGeometry,
  hexColor: string | number | THREE.Color
): THREE.BufferGeometry {
  ensureBasicAttributes(geo);
  const col = hexColor instanceof THREE.Color ? hexColor : _paintColor.set(hexColor);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const r = col.r;
  const g = col.g;
  const b = col.b;
  for (let i = 0, len = count * 3; i < len; i += 3) {
    colors[i] = r;
    colors[i + 1] = g;
    colors[i + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Backwards-compatible alias for `paintGeometryVertexColor`. */
export const colorizeGeometry = paintGeometryVertexColor;

/**
 * Appends a 3D cylindrical strut spanning from `p0` to `p1` with zero-length / zero-radius NaN protection.
 */
export function addStrut(
  parts: THREE.BufferGeometry[],
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  rTop: number,
  rBot = rTop,
  segs = 6
): void {
  _strutDir.subVectors(p1, p0);
  const len = _strutDir.length();
  if (len < 0.01) return;
  const g = new THREE.CylinderGeometry(Math.max(0.005, rTop), Math.max(0.005, rBot), len, segs);
  _strutQuat.setFromUnitVectors(_strutUp, _strutDir.divideScalar(len));
  _strutMid.addVectors(p0, p1).multiplyScalar(0.5);
  _strutMat.compose(_strutMid, _strutQuat, _strutOne);
  g.applyMatrix4(_strutMat);
  parts.push(g);
}

/**
 * Merges a collection of normalized BufferGeometries into a single named THREE.Mesh.
 */
export function createMergedMesh(
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

/**
 * Registers a shader time uniform object into target context lists cleanly.
 */
export function registerAnimatedUniform(
  targetList: AnimatedTimeUniform[] | undefined,
  fallbackList: AnimatedTimeUniform[],
  uni: AnimatedTimeUniform,
  pushBoth = false
): void {
  if (pushBoth) {
    fallbackList.push(uni);
    if (targetList && targetList !== fallbackList) {
      targetList.push(uni);
    }
    return;
  }
  if (targetList) {
    targetList.push(uni);
  } else {
    fallbackList.push(uni);
  }
}

/**
 * Fluent builder for accumulating procedural BufferGeometry parts belonging to a single material slot.
 */
export class PartsBuilder {
  private readonly parts: THREE.BufferGeometry[] = [];

  get length(): number {
    return this.parts.length;
  }

  public box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    rot?: PartRotationEuler
  ): this {
    const sw = Math.max(0.01, w);
    const sh = Math.max(0.01, h);
    const sd = Math.max(0.01, d);
    const tpl = getUnitBoxTemplate();
    const pos = new Float32Array(72);
    const srcP = tpl.pos;
    const rx = rot?.rx ?? 0;
    const ry = rot?.ry ?? 0;
    const rz = rot?.rz ?? 0;

    if (rx === 0 && ry === 0 && rz === 0) {
      for (let i = 0; i < 72; i += 3) {
        pos[i] = srcP[i] * sw + x;
        pos[i + 1] = srcP[i + 1] * sh + y;
        pos[i + 2] = srcP[i + 2] * sd + z;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(tpl.norm, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(tpl.uv, 2));
      g.setIndex(new THREE.BufferAttribute(tpl.index, 1));
      this.parts.push(g);
      return this;
    }

    const norm = new Float32Array(tpl.norm);
    for (let i = 0; i < 72; i += 3) {
      pos[i] = srcP[i] * sw;
      pos[i + 1] = srcP[i + 1] * sh;
      pos[i + 2] = srcP[i + 2] * sd;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(tpl.uv, 2));
    g.setIndex(new THREE.BufferAttribute(tpl.index, 1));
    _tEuler.set(rx, ry, rz, 'ZYX');
    _tQuat.setFromEuler(_tEuler);
    _tPos.set(x, y, z);
    _tMat.compose(_tPos, _tQuat, _strutOne);
    g.applyMatrix4(_tMat);
    this.parts.push(g);
    return this;
  }

  public cyl(
    rTop: number,
    rBot: number,
    h: number,
    segs: number,
    x: number,
    y: number,
    z: number,
    rot?: PartRotationEuler
  ): this {
    const g = new THREE.CylinderGeometry(
      Math.max(0.005, rTop),
      Math.max(0.005, rBot),
      Math.max(0.01, h),
      Math.max(3, segs)
    );
    transformGeometryXYZ(g, x, y, z, rot?.ry ?? 0, rot?.rx ?? 0, rot?.rz ?? 0);
    this.parts.push(g);
    return this;
  }

  public cone(
    r: number,
    h: number,
    segs: number,
    x: number,
    y: number,
    z: number,
    rot?: PartRotationEuler
  ): this {
    const g = new THREE.ConeGeometry(Math.max(0.005, r), Math.max(0.01, h), Math.max(3, segs));
    transformGeometryXYZ(g, x, y, z, rot?.ry ?? 0, rot?.rx ?? 0, rot?.rz ?? 0);
    this.parts.push(g);
    return this;
  }

  public sphere(
    r: number,
    wSeg: number,
    hSeg: number,
    x: number,
    y: number,
    z: number,
    scale?: [number, number, number]
  ): this {
    const g = new THREE.SphereGeometry(
      Math.max(0.005, r),
      Math.max(3, wSeg),
      Math.max(2, hSeg)
    );
    if (scale) {
      g.scale(scale[0], scale[1], scale[2]);
    }
    g.translate(x, y, z);
    this.parts.push(g);
    return this;
  }

  public strut(p0: THREE.Vector3, p1: THREE.Vector3, rTop: number, rBot = rTop, segs = 6): this {
    addStrut(this.parts, p0, p1, rTop, rBot, segs);
    return this;
  }

  public add(...geos: THREE.BufferGeometry[]): this {
    for (const g of geos) {
      if (g) this.parts.push(g);
    }
    return this;
  }

  public addColored(geo: THREE.BufferGeometry, color: string | number | THREE.Color): this {
    this.parts.push(paintGeometryVertexColor(geo, color));
    return this;
  }

  public rawParts(): THREE.BufferGeometry[] {
    return this.parts;
  }

  public buildGeometry(): THREE.BufferGeometry | null {
    if (this.parts.length === 0) return null;
    const merged = mergeNormalized(this.parts);
    this.parts.length = 0;
    return merged;
  }

  public buildMesh(
    name: string,
    material: THREE.Material,
    castShadow = true,
    receiveShadow = true
  ): THREE.Mesh | null {
    const geo = this.buildGeometry();
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }
}
