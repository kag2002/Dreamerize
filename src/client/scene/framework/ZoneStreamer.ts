import * as THREE from 'three';
import { SpatialHashGrid2D } from './SpatialHashGrid';
import type {
  StreamingMode,
  ZoneBuildContext,
  ZoneDescriptor,
  ZoneHandle
} from './types';

export interface ZoneStreamerOptions<
  TRegion extends string = string,
  TShared = Record<string, THREE.Material>,
  TMover = unknown
> {
  mode: StreamingMode;
  loadRadius: number;
  unloadRadius: number;
  maxBuildMsPerFrame?: number;
  /** Optional hard cap on concurrently loaded zones (evicts farthest zones beyond cap). */
  maxLoadedZones?: number;
  /** Predictive camera lookahead seconds for smooth streaming during high-speed travel (default 1.4s). */
  lookaheadSeconds?: number;
  /** Maximum lookahead projection distance in meters (default 180m). */
  maxLookaheadDistance?: number;
  onZoneLoaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;
  onZoneUnloaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;
}

/**
 * Coordinates O(k) spatially-indexed proximity streaming, velocity-predictive preloading,
 * bounded VRAM eviction, and time-sliced building of modular 3D world zones with deterministic disposal.
 */
export class ZoneStreamer<
  TRegion extends string = string,
  TShared = Record<string, THREE.Material>,
  TMover = unknown
> {
  private readonly mode: StreamingMode;
  private loadRadius: number;
  private unloadRadius: number;
  private readonly maxBuildMsPerFrame: number;
  private maxLoadedZones: number;
  private readonly lookaheadSeconds: number;
  private readonly maxLookaheadDistance: number;
  private readonly onZoneLoaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;
  private readonly onZoneUnloaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;

  private readonly descriptors = new Map<string, ZoneDescriptor<TRegion, TShared, TMover>>();
  private readonly descriptorGrid = new SpatialHashGrid2D<ZoneDescriptor<TRegion, TShared, TMover>>(320);
  private readonly loaded = new Map<string, ZoneHandle<TRegion, TShared, TMover>>();
  private readonly prevCamPos = new THREE.Vector3();
  private hasPrevCamPos = false;

  constructor(options: ZoneStreamerOptions<TRegion, TShared, TMover>) {
    this.mode = options.mode;
    this.loadRadius = options.loadRadius;
    this.unloadRadius = Math.max(options.unloadRadius, options.loadRadius + 10);
    this.maxBuildMsPerFrame = options.maxBuildMsPerFrame ?? 4.0;
    this.maxLoadedZones = options.maxLoadedZones ?? Infinity;
    this.lookaheadSeconds = options.lookaheadSeconds ?? 1.4;
    this.maxLookaheadDistance = options.maxLookaheadDistance ?? 180;
    this.onZoneLoaded = options.onZoneLoaded;
    this.onZoneUnloaded = options.onZoneUnloaded;
  }

  public register(descriptor: ZoneDescriptor<TRegion, TShared, TMover>): void {
    const existing = this.descriptors.get(descriptor.id);
    if (existing) {
      this.descriptorGrid.remove(existing);
    }
    this.descriptors.set(descriptor.id, descriptor);
    this.descriptorGrid.insert(descriptor, descriptor.center.x, descriptor.center.z, descriptor.radius);
  }

  public registerAll(descriptors: ZoneDescriptor<TRegion, TShared, TMover>[]): void {
    for (const d of descriptors) {
      this.register(d);
    }
  }

  public getMode(): StreamingMode {
    return this.mode;
  }

  public setRadii(loadRadius: number, unloadRadius: number): void {
    this.loadRadius = Math.max(20, loadRadius);
    this.unloadRadius = Math.max(unloadRadius, this.loadRadius + 10);
  }

  public setMaxLoadedZones(cap: number): void {
    this.maxLoadedZones = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : Infinity;
  }

  public getLoadedZoneIds(): string[] {
    return [...this.loaded.keys()];
  }

  public getZoneHandle(id: string): ZoneHandle<TRegion, TShared, TMover> | undefined {
    return this.loaded.get(id);
  }

  private buildZone(
    desc: ZoneDescriptor<TRegion, TShared, TMover>,
    makeCtx: (d: ZoneDescriptor<TRegion, TShared, TMover>) => ZoneBuildContext<TShared>
  ): void {
    if (this.loaded.has(desc.id)) return;
    const ctx = makeCtx(desc);
    const output = desc.build(ctx);
    ctx.scope.trackObject(output.group);
    if (!output.group.parent) {
      ctx.scene.add(output.group);
    }
    const handle: ZoneHandle<TRegion, TShared, TMover> = {
      descriptor: desc,
      scope: ctx.scope,
      output,
      loadedAtMs: typeof performance !== 'undefined' ? performance.now() : Date.now()
    };
    this.loaded.set(desc.id, handle);
    this.onZoneLoaded?.(handle);
  }

  private unloadZone(id: string, handle: ZoneHandle<TRegion, TShared, TMover>): void {
    this.onZoneUnloaded?.(handle);
    handle.scope.dispose();
    this.loaded.delete(id);
  }

  public loadAllSync(
    makeCtx: (descriptor: ZoneDescriptor<TRegion, TShared, TMover>) => ZoneBuildContext<TShared>
  ): void {
    const ordered = [...this.descriptors.values()].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );
    for (const desc of ordered) {
      this.buildZone(desc, makeCtx);
    }
  }

  public update(
    cameraPos: THREE.Vector3,
    makeCtx: (descriptor: ZoneDescriptor<TRegion, TShared, TMover>) => ZoneBuildContext<TShared>,
    deltaSeconds?: number
  ): void {
    if (this.mode === 'all') {
      if (this.loaded.size < this.descriptors.size) {
        this.loadAllSync(makeCtx);
      }
      return;
    }

    // Compute optional velocity-predicted lookahead focus point for proactive preloading
    let focusX = cameraPos.x;
    let focusZ = cameraPos.z;
    if (
      this.hasPrevCamPos &&
      typeof deltaSeconds === 'number' &&
      deltaSeconds > 0.001 &&
      deltaSeconds < 2.0 &&
      this.lookaheadSeconds > 0 &&
      this.maxLookaheadDistance > 0
    ) {
      const dx = cameraPos.x - this.prevCamPos.x;
      const dz = cameraPos.z - this.prevCamPos.z;
      const stepDist = Math.hypot(dx, dz);
      // Ignore instantaneous teleports (> 240m in a single update window)
      if (stepDist > 0.5 && stepDist < 240) {
        const speed = stepDist / deltaSeconds;
        const lead = Math.min(this.maxLookaheadDistance, speed * this.lookaheadSeconds);
        focusX += (dx / stepDist) * lead;
        focusZ += (dz / stepDist) * lead;
      }
    }
    this.prevCamPos.copy(cameraPos);
    this.hasPrevCamPos = true;

    // 1. Unload zones beyond hysteresis outer boundary (strictly relative to actual cameraPos)
    for (const [id, handle] of this.loaded.entries()) {
      const d = handle.descriptor;
      const dist = Math.hypot(cameraPos.x - d.center.x, cameraPos.z - d.center.z);
      if (dist > this.unloadRadius + d.radius) {
        this.unloadZone(id, handle);
      }
    }

    // 2. O(k) spatial query for missing zones inside loadRadius of camera OR lookahead focus
    const queue: Array<{
      desc: ZoneDescriptor<TRegion, TShared, TMover>;
      dist: number;
      prio: number;
    }> = [];
    const queuedIds = new Set<string>();
    const enqueueNear = (qx: number, qz: number) => {
      this.descriptorGrid.queryRadius(qx, qz, this.loadRadius, (desc) => {
        if (this.loaded.has(desc.id) || queuedIds.has(desc.id)) return;
        const dist = Math.hypot(qx - desc.center.x, qz - desc.center.z);
        if (dist < this.loadRadius + desc.radius) {
          queuedIds.add(desc.id);
          queue.push({ desc, dist, prio: desc.priority ?? 100 });
        }
      });
    };

    enqueueNear(cameraPos.x, cameraPos.z);
    if (focusX !== cameraPos.x || focusZ !== cameraPos.z) {
      enqueueNear(focusX, focusZ);
    }

    if (queue.length > 0) {
      queue.sort((a, b) => a.prio - b.prio || a.dist - b.dist);

      // 3. Time-sliced build respecting maxBuildMsPerFrame
      const nowFn =
        typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
      const startMs = nowFn();
      for (let i = 0; i < queue.length; i++) {
        if (i > 0 && nowFn() - startMs >= this.maxBuildMsPerFrame) {
          break;
        }
        this.buildZone(queue[i].desc, makeCtx);
      }
    }

    // 4. Enforce hard VRAM zone cap by evicting farthest loaded zones beyond maxLoadedZones
    if (this.loaded.size > this.maxLoadedZones) {
      const ranked = [...this.loaded.entries()].map(([id, handle]) => {
        const d = handle.descriptor;
        return {
          id,
          handle,
          edgeDist: Math.hypot(cameraPos.x - d.center.x, cameraPos.z - d.center.z) - d.radius
        };
      });
      ranked.sort((a, b) => b.edgeDist - a.edgeDist);
      const excess = this.loaded.size - this.maxLoadedZones;
      for (let i = 0; i < excess; i++) {
        this.unloadZone(ranked[i].id, ranked[i].handle);
      }
    }
  }

  public disposeAll(): void {
    for (const handle of this.loaded.values()) {
      this.onZoneUnloaded?.(handle);
      handle.scope.dispose();
    }
    this.loaded.clear();
    this.hasPrevCamPos = false;
  }
}
