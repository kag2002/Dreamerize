import * as THREE from 'three';
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
  onZoneLoaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;
  onZoneUnloaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;
}

/**
 * Coordinates proximity-based streaming & time-sliced building of modular 3D world zones
 * with hysteresis unload and deterministic ResourceScope disposal.
 */
export class ZoneStreamer<
  TRegion extends string = string,
  TShared = Record<string, THREE.Material>,
  TMover = unknown
> {
  private readonly mode: StreamingMode;
  private readonly loadRadius: number;
  private readonly unloadRadius: number;
  private readonly maxBuildMsPerFrame: number;
  private readonly onZoneLoaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;
  private readonly onZoneUnloaded?: (handle: ZoneHandle<TRegion, TShared, TMover>) => void;

  private readonly descriptors = new Map<string, ZoneDescriptor<TRegion, TShared, TMover>>();
  private readonly loaded = new Map<string, ZoneHandle<TRegion, TShared, TMover>>();

  constructor(options: ZoneStreamerOptions<TRegion, TShared, TMover>) {
    this.mode = options.mode;
    this.loadRadius = options.loadRadius;
    this.unloadRadius = Math.max(options.unloadRadius, options.loadRadius + 10);
    this.maxBuildMsPerFrame = options.maxBuildMsPerFrame ?? 4.0;
    this.onZoneLoaded = options.onZoneLoaded;
    this.onZoneUnloaded = options.onZoneUnloaded;
  }

  public register(descriptor: ZoneDescriptor<TRegion, TShared, TMover>): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  public registerAll(descriptors: ZoneDescriptor<TRegion, TShared, TMover>[]): void {
    for (const d of descriptors) {
      this.register(d);
    }
  }

  public getMode(): StreamingMode {
    return this.mode;
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
    makeCtx: (descriptor: ZoneDescriptor<TRegion, TShared, TMover>) => ZoneBuildContext<TShared>
  ): void {
    if (this.mode === 'all') {
      if (this.loaded.size < this.descriptors.size) {
        this.loadAllSync(makeCtx);
      }
      return;
    }

    // 1. Unload zones beyond hysteresis outer boundary
    for (const [id, handle] of this.loaded.entries()) {
      const d = handle.descriptor;
      const dist = Math.hypot(cameraPos.x - d.center.x, cameraPos.z - d.center.z);
      if (dist > this.unloadRadius + d.radius) {
        this.onZoneUnloaded?.(handle);
        handle.scope.dispose();
        this.loaded.delete(id);
      }
    }

    // 2. Collect missing zones inside load radius, ordered by priority then proximity
    const queue: Array<{
      desc: ZoneDescriptor<TRegion, TShared, TMover>;
      dist: number;
      prio: number;
    }> = [];
    for (const desc of this.descriptors.values()) {
      if (this.loaded.has(desc.id)) continue;
      const dist = Math.hypot(cameraPos.x - desc.center.x, cameraPos.z - desc.center.z);
      if (dist < this.loadRadius + desc.radius) {
        queue.push({ desc, dist, prio: desc.priority ?? 100 });
      }
    }

    if (queue.length === 0) return;
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

  public disposeAll(): void {
    for (const handle of this.loaded.values()) {
      this.onZoneUnloaded?.(handle);
      handle.scope.dispose();
    }
    this.loaded.clear();
  }
}
