import type * as THREE from 'three';
import type {
  ExclusionCircle,
  JunkBoatMotion,
  VietnamSharedMaterials
} from '../../environments/vietnamGeometryHelpers';
import type {
  AnimatedTimeUniform,
  AnimationBusLike,
  ManagedPointLightSpec,
  MaterialLibraryLike as FrameworkMaterialLibraryLike,
  PartsFactory,
  QualitySettings,
  QualityTier,
  ResourceScopeLike,
  StreamingMode,
  WorldLandmarkSpec,
  WorldPerfMetrics,
  WorldPoiEntry,
  WorldPoiSpec,
  WorldTerrainFeatureSpec,
  ZoneBuildContext as FrameworkZoneBuildContext,
  ZoneBuildOutput as FrameworkZoneBuildOutput,
  ZoneDescriptor as FrameworkZoneDescriptor,
  ZoneHandle as FrameworkZoneHandle
} from '../../framework/types';

export type VietnamQualityTier = QualityTier;
export type VietnamStreamingMode = StreamingMode;
export type VietnamRegionKey = 'core' | 'north' | 'central' | 'south' | 'macro';
export type VietnamPoiRegionLabel =
  | 'I. Miền Bắc'
  | 'II. Miền Trung & Tây Nguyên'
  | 'III. Miền Nam & Hải Đảo';

export type VietnamQualitySettings = QualitySettings;
export type TerrainFeatureSpec = WorldTerrainFeatureSpec;
export type PoiSpec = WorldPoiSpec<VietnamPoiRegionLabel>;
export type LandmarkSpec = WorldLandmarkSpec<VietnamRegionKey>;
export type VietnamPerfMetrics = WorldPerfMetrics;
export type VietnamPoiEntry = WorldPoiEntry<VietnamPoiRegionLabel>;

export type {
  AnimatedTimeUniform,
  AnimationBusLike,
  ExclusionCircle,
  ManagedPointLightSpec,
  PartsFactory,
  ResourceScopeLike
};

export type MaterialLibraryLike = FrameworkMaterialLibraryLike<VietnamSharedMaterials>;
export type ZoneBuildContext = FrameworkZoneBuildContext<VietnamSharedMaterials>;
export type ZoneBuildOutput = FrameworkZoneBuildOutput<JunkBoatMotion>;
export type ZoneDescriptor = FrameworkZoneDescriptor<
  VietnamRegionKey,
  VietnamSharedMaterials,
  JunkBoatMotion
>;
export type ZoneHandle = FrameworkZoneHandle<
  VietnamRegionKey,
  VietnamSharedMaterials,
  JunkBoatMotion
>;
