import * as THREE from 'three';
import type { ManagedPointLightSpec } from './types';

function isHierarchyVisible(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

/**
 * Fixed-pool PointLight budget manager across all Dreamerize 3D worlds.
 * Replaces N static scene PointLights with a small constant pool of K scene-level PointLights
 * whose world positions/colors/intensities smoothly reassign to the K nearest visible fixtures.
 */
export class LightBudgetManager {
  private managedLights: ManagedPointLightSpec[] = [];
  private pooledLights: THREE.PointLight[] = [];
  private activeCount = 0;
  private nextAutoLightId = 0;
  private reservePoolWhenEmpty = true;
  private readonly lastUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private readonly tmpVec = new THREE.Vector3();

  private harvestLightsFromSubtree(root: THREE.Object3D): string[] {
    root.updateMatrixWorld(true);
    const toHarvest: THREE.PointLight[] = [];

    root.traverse((obj) => {
      const pl = obj as THREE.PointLight;
      if (pl.isPointLight && pl.userData?.isPooledLight !== true) {
        toHarvest.push(pl);
      }
    });

    const addedIds: string[] = [];
    for (let i = 0; i < toHarvest.length; i++) {
      const light = toHarvest[i];
      const worldPos = light.getWorldPosition(this.tmpVec.clone());
      const id = light.name
        ? `${light.name}_${this.nextAutoLightId++}`
        : `managed_point_light_${this.nextAutoLightId++}`;
      this.managedLights.push({
        id,
        worldPos,
        color: light.color.clone(),
        intensity: light.intensity,
        distance: light.distance,
        decay: light.decay,
        sourceParent: light.parent
      });
      addedIds.push(id);
      if (light.parent) {
        light.parent.remove(light);
      }
    }
    return addedIds;
  }

  public harvestFromScene(
    scene: THREE.Scene,
    maxPoolSize: number,
    reservePoolWhenEmpty = true
  ): void {
    this.managedLights = [];
    this.nextAutoLightId = 0;
    this.reservePoolWhenEmpty = reservePoolWhenEmpty;
    this.harvestLightsFromSubtree(scene);
    const effectivePool =
      !reservePoolWhenEmpty && this.managedLights.length === 0 ? 0 : maxPoolSize;
    this.setPoolSize(effectivePool, scene);
    this.lastUpdatePos.set(Infinity, Infinity, Infinity);
  }

  public harvestFromGroup(group: THREE.Object3D): string[] {
    const addedIds = this.harvestLightsFromSubtree(group);
    if (addedIds.length > 0) {
      this.lastUpdatePos.set(Infinity, Infinity, Infinity);
    }
    return addedIds;
  }

  public removeByIds(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    this.managedLights = this.managedLights.filter((m) => !idSet.has(m.id));
    this.lastUpdatePos.set(Infinity, Infinity, Infinity);
  }

  public setPoolSize(newMaxPoolSize: number, scene: THREE.Scene): void {
    const requested = Math.max(0, Math.floor(newMaxPoolSize));
    const targetSize =
      !this.reservePoolWhenEmpty && this.managedLights.length === 0 ? 0 : requested;

    while (this.pooledLights.length > targetSize) {
      const removed = this.pooledLights.pop()!;
      if (removed.parent) {
        removed.parent.remove(removed);
      } else {
        scene.remove(removed);
      }
    }

    while (this.pooledLights.length < targetSize) {
      const idx = this.pooledLights.length;
      const pl = new THREE.PointLight('#ffd285', 0, 1, 1.5);
      pl.name = `VietnamPooledLight_${idx}`;
      pl.userData = { isPooledLight: true };
      pl.visible = true;
      pl.intensity = 0;
      scene.add(pl);
      this.pooledLights.push(pl);
    }

    this.lastUpdatePos.set(Infinity, Infinity, Infinity);
  }

  public update(cameraPos: THREE.Vector3, force = false): void {
    if (!force && this.lastUpdatePos.distanceToSquared(cameraPos) < 4.0) {
      return;
    }
    this.lastUpdatePos.copy(cameraPos);

    if (this.pooledLights.length === 0) {
      this.activeCount = 0;
      return;
    }

    const candidates: Array<{ spec: ManagedPointLightSpec; distSq: number }> = [];
    for (let i = 0; i < this.managedLights.length; i++) {
      const spec = this.managedLights[i];
      if (!isHierarchyVisible(spec.sourceParent)) continue;
      const distSq = spec.worldPos.distanceToSquared(cameraPos);
      const maxRange = Math.max(spec.distance * 2.5, 110);
      if (distSq <= maxRange * maxRange) {
        candidates.push({ spec, distSq });
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);

    const activeLimit = Math.min(this.pooledLights.length, candidates.length);
    for (let i = 0; i < activeLimit; i++) {
      const target = this.pooledLights[i];
      const spec = candidates[i].spec;
      target.position.copy(spec.worldPos);
      target.color.copy(spec.color);
      target.intensity = spec.intensity;
      target.distance = spec.distance;
      target.decay = spec.decay;
      target.visible = true;
    }

    for (let i = activeLimit; i < this.pooledLights.length; i++) {
      const target = this.pooledLights[i];
      target.intensity = 0;
      target.visible = true;
    }

    this.activeCount = activeLimit;
  }

  public getStats(): { managedTotal: number; poolSize: number; activeCount: number } {
    return {
      managedTotal: this.managedLights.length,
      poolSize: this.pooledLights.length,
      activeCount: this.activeCount
    };
  }

  public dispose(): void {
    for (const pl of this.pooledLights) {
      if (pl.parent) {
        pl.parent.remove(pl);
      }
    }
    this.pooledLights = [];
    this.managedLights = [];
    this.activeCount = 0;
    this.lastUpdatePos.set(Infinity, Infinity, Infinity);
  }
}
