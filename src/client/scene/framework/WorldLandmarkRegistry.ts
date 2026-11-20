import * as THREE from 'three';
import type {
  ExclusionCircle,
  WorldLandmarkSpec,
  WorldPoiEntry,
  WorldPoiSpec
} from './types';

/**
 * Reusable landmark, exclusion-circle, and POI registry for any Dreamerize 3D world.
 */
export class WorldLandmarkRegistry<
  TRegion extends string = string,
  TPoiRegion extends string = string
> {
  private readonly specs: readonly WorldLandmarkSpec<TRegion>[];
  private readonly pois: readonly WorldPoiSpec<TPoiRegion>[];
  private readonly exclusions: readonly ExclusionCircle[];
  private readonly byIdMap = new Map<string, WorldLandmarkSpec<TRegion>>();
  private readonly byGroupMap = new Map<string, WorldLandmarkSpec<TRegion>>();

  constructor(
    specs: readonly WorldLandmarkSpec<TRegion>[] = [],
    pois: readonly WorldPoiSpec<TPoiRegion>[] = [],
    exclusions: readonly ExclusionCircle[] = []
  ) {
    this.specs = specs;
    this.pois = pois;
    this.exclusions = exclusions;
    for (const spec of specs) {
      this.byIdMap.set(spec.id, spec);
      this.byGroupMap.set(spec.groupName, spec);
    }
  }

  public all(): readonly WorldLandmarkSpec<TRegion>[] {
    return this.specs;
  }

  public byId(id: string): WorldLandmarkSpec<TRegion> | undefined {
    return this.byIdMap.get(id);
  }

  public byGroupName(groupName: string): WorldLandmarkSpec<TRegion> | undefined {
    return this.byGroupMap.get(groupName);
  }

  public byRegion(region: TRegion): WorldLandmarkSpec<TRegion>[] {
    return this.specs.filter((s) => s.region === region);
  }

  public getExclusions(): ExclusionCircle[] {
    return this.exclusions.map((e) => ({ ...e }));
  }

  public getPoiSpecs(): readonly WorldPoiSpec<TPoiRegion>[] {
    return this.pois;
  }

  public buildPointsOfInterest(
    getHeight: (x: number, z: number) => number,
    waterLevel = -Infinity
  ): WorldPoiEntry<TPoiRegion>[] {
    return this.pois.map((spec) => {
      const groundOrWater = Math.max(waterLevel, getHeight(spec.x, spec.z));
      const rawY = groundOrWater + spec.elevationOffset;
      const y = spec.minY !== undefined ? Math.max(rawY, spec.minY) : rawY;
      return {
        name: spec.name,
        region: spec.region,
        position: new THREE.Vector3(spec.x, y, spec.z),
        lookAt: new THREE.Vector3(spec.lookAt[0], spec.lookAt[1], spec.lookAt[2]),
        dwellTime: spec.dwellTime
      };
    });
  }
}
