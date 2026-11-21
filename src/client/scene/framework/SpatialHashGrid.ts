interface SpatialEntry<T> {
  item: T;
  x: number;
  z: number;
  radius: number;
  minCx: number;
  maxCx: number;
  minCz: number;
  maxCz: number;
  stamp: number;
}

const CELL_BIAS = 32768;
const CELL_STRIDE = 65536;

function hashCell(cx: number, cz: number): number {
  return (cx + CELL_BIAS) * CELL_STRIDE + (cz + CELL_BIAS);
}

/**
 * Lightweight 2D spatial hash grid for O(1) average-case radius & containment queries
 * across large-scale 3D worlds (exclusion halos, pooled lights, shadow casters, streaming zones).
 * Uses monotonic query stamps so multi-cell items are never visited twice and queries allocate zero memory.
 */
export class SpatialHashGrid2D<T> {
  private readonly invCellSize: number;
  private readonly cells = new Map<number, SpatialEntry<T>[]>();
  private readonly entryByItem = new Map<T, SpatialEntry<T>>();
  private queryStamp = 0;

  constructor(cellSize = 128) {
    this.invCellSize = 1 / Math.max(1, cellSize);
  }

  public get size(): number {
    return this.entryByItem.size;
  }

  public insert(item: T, x: number, z: number, radius: number): void {
    if (this.entryByItem.has(item)) {
      this.remove(item);
    }
    const safeR = Math.max(0, Number.isFinite(radius) ? radius : 0);
    const minCx = Math.floor((x - safeR) * this.invCellSize);
    const maxCx = Math.floor((x + safeR) * this.invCellSize);
    const minCz = Math.floor((z - safeR) * this.invCellSize);
    const maxCz = Math.floor((z + safeR) * this.invCellSize);

    const entry: SpatialEntry<T> = {
      item,
      x,
      z,
      radius: safeR,
      minCx,
      maxCx,
      minCz,
      maxCz,
      stamp: 0
    };
    this.entryByItem.set(item, entry);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = hashCell(cx, cz);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(entry);
      }
    }
  }

  public remove(item: T): boolean {
    const entry = this.entryByItem.get(item);
    if (!entry) return false;
    this.entryByItem.delete(item);

    for (let cx = entry.minCx; cx <= entry.maxCx; cx++) {
      for (let cz = entry.minCz; cz <= entry.maxCz; cz++) {
        const key = hashCell(cx, cz);
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        const idx = bucket.indexOf(entry);
        if (idx >= 0) {
          const last = bucket.length - 1;
          if (idx !== last) {
            bucket[idx] = bucket[last];
          }
          bucket.pop();
          if (bucket.length === 0) {
            this.cells.delete(key);
          }
        }
      }
    }
    return true;
  }

  public clear(): void {
    this.cells.clear();
    this.entryByItem.clear();
    this.queryStamp = 0;
  }

  /**
   * Visits every unique item whose bounding circle intersects the query circle (x, z, queryRadius).
   */
  public queryRadius(
    x: number,
    z: number,
    queryRadius: number,
    visitor: (item: T, distSq: number) => void
  ): void {
    if (this.entryByItem.size === 0) return;
    const safeR = Math.max(0, queryRadius);
    const minCx = Math.floor((x - safeR) * this.invCellSize);
    const maxCx = Math.floor((x + safeR) * this.invCellSize);
    const minCz = Math.floor((z - safeR) * this.invCellSize);
    const maxCz = Math.floor((z + safeR) * this.invCellSize);

    const stamp = ++this.queryStamp;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(hashCell(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          if (entry.stamp === stamp) continue;
          entry.stamp = stamp;
          const dx = x - entry.x;
          const dz = z - entry.z;
          const distSq = dx * dx + dz * dz;
          const lim = safeR + entry.radius;
          if (distSq <= lim * lim) {
            visitor(entry.item, distSq);
          }
        }
      }
    }
  }

  /**
   * Fast O(1) point-in-circle check across all indexed circles with optional extra padding.
   */
  public containsPoint(x: number, z: number, extraPadding = 0): boolean {
    if (this.entryByItem.size === 0) return false;
    const pad = Math.max(0, extraPadding);
    const minCx = Math.floor((x - pad) * this.invCellSize);
    const maxCx = Math.floor((x + pad) * this.invCellSize);
    const minCz = Math.floor((z - pad) * this.invCellSize);
    const maxCz = Math.floor((z + pad) * this.invCellSize);

    const stamp = ++this.queryStamp;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(hashCell(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          if (entry.stamp === stamp) continue;
          entry.stamp = stamp;
          const dx = x - entry.x;
          const dz = z - entry.z;
          const lim = entry.radius + extraPadding;
          if (lim > 0 && dx * dx + dz * dz < lim * lim) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
