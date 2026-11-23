import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AnimatedTimeUniform } from './types';

export type { AnimatedTimeUniform };

export interface PartRotationEuler {
  rx?: number;
  ry?: number;
  rz?: number;
}

/**
 * Ensures geometry is non-indexed with position, normal, and uv attributes so mergeGeometries succeeds cleanly.
 */
export function normalizeForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
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
  const keep = new Set(['position', 'normal', 'uv', 'color']);
  for (const key of Object.keys(g.attributes)) {
    if (!keep.has(key)) {
      g.deleteAttribute(key);
    }
  }
  if (geo.index) {
    geo.dispose();
  }
  return g;
}

/**
 * Merges an array of BufferGeometries after normalizing attributes and disposes the temporary inputs.
 */
export function mergeNormalized(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 0) return new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const normalized = geos.map(normalizeForMerge);
  const colored = normalized.find((g) => g.attributes.color);
  if (colored) {
    const itemSize = colored.attributes.color.itemSize;
    for (const g of normalized) {
      if (!g.attributes.color) {
        const count = g.attributes.position.count;
        const arr = new Float32Array(count * itemSize);
        arr.fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(arr, itemSize));
      }
    }
  }
  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();
  return merged ?? new THREE.BoxGeometry(0.01, 0.01, 0.01);
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
  if (rotX !== 0) geo.rotateX(rotX);
  if (rotY !== 0) geo.rotateY(rotY);
  if (rotZ !== 0) geo.rotateZ(rotZ);
  geo.translate(x, y, z);
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
  if (rotX !== 0) geo.rotateX(rotX);
  if (rotZ !== 0) geo.rotateZ(rotZ);
  if (rotY !== 0) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

/**
 * Normalizes a BufferGeometry for merging and fills a uniform RGB `color` vertex attribute.
 */
export function paintGeometryVertexColor(
  geo: THREE.BufferGeometry,
  hexColor: string | number | THREE.Color
): THREE.BufferGeometry {
  const g = normalizeForMerge(geo);
  const col = hexColor instanceof THREE.Color ? hexColor : new THREE.Color(hexColor);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
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
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (len < 0.01) return;
  const g = new THREE.CylinderGeometry(Math.max(0.005, rTop), Math.max(0.005, rBot), len, segs);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1)));
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
    const g = new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d));
    transformGeometryXYZ(g, x, y, z, rot?.ry ?? 0, rot?.rx ?? 0, rot?.rz ?? 0);
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
    const anyColored = this.parts.some((p) => Boolean(p.attributes.color));
    if (anyColored) {
      for (let i = 0; i < this.parts.length; i++) {
        if (!this.parts[i].attributes.color) {
          this.parts[i] = paintGeometryVertexColor(this.parts[i], 0xffffff);
        }
      }
    }
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
