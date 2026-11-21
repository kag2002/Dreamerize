import * as THREE from 'three';

export interface ChunkedTerrainBuildOptions {
  /** Group name for the returned THREE.Group (e.g. 'VietnamHeritageTerrain'). */
  groupName: string;
  /** Half-width and half-depth of the terrain domain in meters (full span = 2 * halfSpan). */
  halfSpan: number;
  /** Number of chunks along X and Z axes (default 4 -> 4x4 = 16 frustum-culled chunks). */
  chunksPerAxis?: number;
  /** Number of quad segments per chunk axis (default 50 -> 51x51 vertices per chunk). */
  chunkSegs?: number;
  /** Material shared across all terrain chunks. */
  material: THREE.Material;
  /** Analytical or procedural height evaluator h(x, z). */
  getHeight: (x: number, z: number) => number;
  /** Whether to apply center-weighted cubic coordinate warping (default true). */
  warp?: boolean;
  /** Linear core weight in [0.1, 1.0] for cubic warping (default 0.48). */
  warpLinearWeight?: number;
  /** Prefix for individual chunk mesh names (default 'TerrainChunk'). */
  chunkNamePrefix?: string;
  /** Whether terrain chunks receive shadows (default true). */
  receiveShadow?: boolean;
}

export interface WarpedWaterBuildOptions {
  /** Name for the returned water THREE.Mesh. */
  name: string;
  /** Half-width and half-depth of the water plane in meters. */
  halfSpan: number;
  /** Grid segments per axis (default 108 -> 23,328 triangles). */
  segments?: number;
  /** Constant Y elevation of the water surface (default 0). */
  waterLevel?: number;
  /** Water shader/standard material. */
  material: THREE.Material;
  /** Whether to apply center-weighted cubic coordinate warping (default true). */
  warp?: boolean;
  /** Linear core weight in [0.1, 1.0] for cubic warping (default 0.48). */
  warpLinearWeight?: number;
  /** Whether water mesh receives shadows (default true). */
  receiveShadow?: boolean;
}

/**
 * Monotonic odd center-weighted coordinate warp mapping u in [-1, 1] to [-halfSpan, halfSpan].
 * Concentrates vertex density in the playable central area while stretching smoothly to distant horizons
 * with exact shared chunk boundaries.
 */
export function warpMapCoord(u: number, halfSpan = 2400, linearWeight = 0.48): number {
  const cubicWeight = 1.0 - linearWeight;
  return halfSpan * (linearWeight * u + cubicWeight * u * u * u);
}

/**
 * Builds a watertight N×N frustum-culled terrain chunk group over [-halfSpan, halfSpan].
 * Evaluates the heightfield ONCE on a 1-ring padded grid so startup is fast and adjacent chunks
 * share bit-for-bit identical positions and central-difference normals along every seam.
 */
export function buildChunkedTerrainGroup(options: ChunkedTerrainBuildOptions): THREE.Group {
  const halfSpan = options.halfSpan;
  const chunksPerAxis = Math.max(1, Math.floor(options.chunksPerAxis ?? 4));
  const chunkSegs = Math.max(2, Math.floor(options.chunkSegs ?? 50));
  const useWarp = options.warp !== false;
  const linearWeight = options.warpLinearWeight ?? 0.48;
  const prefix = options.chunkNamePrefix ?? 'TerrainChunk';
  const receiveShadow = options.receiveShadow !== false;

  const totalSegs = chunksPerAxis * chunkSegs;
  const stride = totalSegs + 3; // 1-ring border on all sides for seamless central-diff normals

  const axisCoords = new Float32Array(stride);
  for (let p = 0; p < stride; p++) {
    const u = -1 + (2 * (p - 1)) / totalSegs;
    axisCoords[p] = useWarp ? warpMapCoord(u, halfSpan, linearWeight) : u * halfSpan;
  }

  const heights = new Float32Array(stride * stride);
  for (let pz = 0; pz < stride; pz++) {
    const z = axisCoords[pz];
    const rowOff = pz * stride;
    for (let px = 0; px < stride; px++) {
      heights[rowOff + px] = options.getHeight(axisCoords[px], z);
    }
  }

  const terrainGroup = new THREE.Group();
  terrainGroup.name = options.groupName;
  const invFullSpan = 1 / (halfSpan * 2);

  for (let cz = 0; cz < chunksPerAxis; cz++) {
    for (let cx = 0; cx < chunksPerAxis; cx++) {
      const geo = new THREE.PlaneGeometry(1, 1, chunkSegs, chunkSegs);
      geo.rotateX(-Math.PI / 2);

      const pos = geo.attributes.position as THREE.BufferAttribute;
      const norm = geo.attributes.normal as THREE.BufferAttribute;
      const uv = geo.attributes.uv as THREE.BufferAttribute;

      const baseGx = cx * chunkSegs;
      const baseGz = cz * chunkSegs;

      for (let i = 0; i < pos.count; i++) {
        const rx = Math.round((pos.getX(i) + 0.5) * chunkSegs);
        const rz = Math.round((pos.getZ(i) + 0.5) * chunkSegs);
        const px = baseGx + rx + 1;
        const pz = baseGz + rz + 1;

        const x = axisCoords[px];
        const z = axisCoords[pz];
        const y = heights[pz * stride + px];

        const dhdx =
          (heights[pz * stride + (px + 1)] - heights[pz * stride + (px - 1)]) /
          (axisCoords[px + 1] - axisCoords[px - 1]);
        const dhdz =
          (heights[(pz + 1) * stride + px] - heights[(pz - 1) * stride + px]) /
          (axisCoords[pz + 1] - axisCoords[pz - 1]);
        const nx = -dhdx;
        const nz = -dhdz;
        const invLen = 1 / Math.hypot(nx, 1.0, nz);

        pos.setXYZ(i, x, y, z);
        norm.setXYZ(i, nx * invLen, invLen, nz * invLen);
        uv.setXY(i, (x + halfSpan) * invFullSpan, 1 - (z + halfSpan) * invFullSpan);
      }

      pos.needsUpdate = true;
      norm.needsUpdate = true;
      uv.needsUpdate = true;
      geo.computeBoundingBox();
      geo.computeBoundingSphere();

      const chunkMesh = new THREE.Mesh(geo, options.material);
      chunkMesh.name = `${prefix}_${cx}_${cz}`;
      chunkMesh.receiveShadow = receiveShadow;
      chunkMesh.frustumCulled = true;
      terrainGroup.add(chunkMesh);
    }
  }

  return terrainGroup;
}

/**
 * Builds a single-draw-call center-weighted warped water surface mesh over [-halfSpan, halfSpan].
 */
export function buildWarpedWaterMesh(options: WarpedWaterBuildOptions): THREE.Mesh {
  const halfSpan = options.halfSpan;
  const segs = Math.max(4, Math.floor(options.segments ?? 108));
  const waterLevel = options.waterLevel ?? 0;
  const useWarp = options.warp !== false;
  const linearWeight = options.warpLinearWeight ?? 0.48;

  const geo = new THREE.PlaneGeometry(2, 2, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const invFullSpan = 1 / (halfSpan * 2);

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getZ(i);
    const x = useWarp ? warpMapCoord(u, halfSpan, linearWeight) : u * halfSpan;
    const z = useWarp ? warpMapCoord(v, halfSpan, linearWeight) : v * halfSpan;
    pos.setXYZ(i, x, waterLevel, z);
    uv.setXY(i, (x + halfSpan) * invFullSpan, 1 - (z + halfSpan) * invFullSpan);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const waterMesh = new THREE.Mesh(geo, options.material);
  waterMesh.name = options.name;
  waterMesh.receiveShadow = options.receiveShadow !== false;
  return waterMesh;
}
