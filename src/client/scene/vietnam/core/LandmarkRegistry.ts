import type { ExclusionCircle } from '../../environments/vietnamGeometryHelpers';
import { WorldLandmarkRegistry } from '../../framework/WorldLandmarkRegistry';
import {
  VIETNAM_LANDMARK_SPECS,
  VIETNAM_PLAZA_EXCLUSION_HALOS,
  VIETNAM_POI_SPECS
} from '../data/landmarks';
import type { LandmarkSpec, PoiSpec, VietnamPoiRegionLabel, VietnamRegionKey } from './types';

/**
 * Single source of truth for Vietnam Heritage landmark coordinates, exclusion circles, and POIs,
 * built atop the project-wide `WorldLandmarkRegistry`.
 */
export class LandmarkRegistry extends WorldLandmarkRegistry<
  VietnamRegionKey,
  VietnamPoiRegionLabel
> {
  constructor(
    specs: readonly LandmarkSpec[] = VIETNAM_LANDMARK_SPECS,
    pois: readonly PoiSpec[] = VIETNAM_POI_SPECS,
    exclusions: readonly ExclusionCircle[] = VIETNAM_PLAZA_EXCLUSION_HALOS
  ) {
    super(specs, pois, exclusions);
  }
}

export const VIETNAM_LANDMARK_REGISTRY = new LandmarkRegistry();
