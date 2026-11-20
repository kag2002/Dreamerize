import * as THREE from 'three';
import type { IPointOfInterest, ISpace } from '../ISpace';
import type { PartsBuilder } from './PartsBuilder';

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export type StreamingMode = 'all' | 'proximity';

export interface QualitySettings {
  tier: QualityTier;
  shadowMapSize: number;
  shadowDistance: number;
  shadowFrustumHalfSize: number;
  shadowUpdateIntervalFrames: number;
  drawDistance: number;
  maxActivePointLights: number;
  foliageDensityScale: number;
  dprCap: number;
}

export interface ExclusionCircle {
  x: number;
  z: number;
  r: number;
}

export interface AnimatedTimeUniform {
  uTime: { value: number };
  uWindSpeed?: { value: number };
}

export interface ManagedPointLightSpec {
  id: string;
  worldPos: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
  decay: number;
  sourceParent: THREE.Object3D | null;
}

export interface PartsFactory {
  create(): PartsBuilder;
}

export interface ResourceScopeLike {
  trackObject<T extends THREE.Object3D>(obj: T): T;
  trackGeometry<T extends THREE.BufferGeometry>(geo: T): T;
  trackMaterial<T extends THREE.Material>(mat: T): T;
  trackTexture<T extends THREE.Texture>(tex: T): T;
  trackDisposable(fn: () => void): void;
  dispose(): void;
}

export interface MaterialLibraryLike<TShared = Record<string, THREE.Material>> {
  readonly shared: TShared;
  getOrCreateStandard(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
  dispose(): void;
}

export interface AnimationBusLike {
  register(uni: AnimatedTimeUniform): void;
  registerMany(list: AnimatedTimeUniform[]): void;
  update(elapsedTime: number): void;
  setWindSpeed(speed: number): void;
  clear(): void;
}

export interface ZoneBuildContext<TShared = Record<string, THREE.Material>> {
  scene: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  scope: ResourceScopeLike;
  parts: PartsFactory;
  materials: MaterialLibraryLike<TShared>;
  anim: AnimationBusLike;
  terrain: {
    height(x: number, z: number): number;
    normal(x: number, z: number, target?: THREE.Vector3): THREE.Vector3;
  };
  rng(seed: number): () => number;
}

export interface ZoneBuildOutput<TMover = unknown> {
  group: THREE.Group;
  movers?: TMover[];
  exclusions?: ExclusionCircle[];
  update?(t: number, dt: number): void;
}

export interface WorldTerrainFeatureSpec {
  kind: 'crater' | 'basin' | 'plateau' | 'ridge' | 'channel';
  x: number;
  z: number;
  radius: number;
  depthOrHeight: number;
}

export interface WorldPoiSpec<TRegion extends string = string> {
  name: string;
  region: TRegion;
  x: number;
  z: number;
  elevationOffset: number;
  minY?: number;
  lookAt: readonly [number, number, number];
  dwellTime: number;
}

export interface WorldLandmarkSpec<TRegion extends string = string> {
  id: string;
  groupName: string;
  region: TRegion;
  center: readonly [number, number];
  radius: number;
  exclusionRadius?: number;
}

export type WorldPoiEntry<TRegion extends string = string> = IPointOfInterest & {
  lookAt: THREE.Vector3;
  region: TRegion;
};

export interface ZoneDescriptor<
  TRegion extends string = string,
  TShared = Record<string, THREE.Material>,
  TMover = unknown
> {
  id: string;
  groupName: string;
  region: TRegion;
  center: { x: number; z: number };
  radius: number;
  priority?: number;
  terrain?: WorldTerrainFeatureSpec[];
  exclusions?: ExclusionCircle[];
  pois?: WorldPoiSpec[];
  references?: string[];
  dependsOn?: string[];
  build(ctx: ZoneBuildContext<TShared>): ZoneBuildOutput<TMover>;
}

export interface ZoneHandle<
  TRegion extends string = string,
  TShared = Record<string, THREE.Material>,
  TMover = unknown
> {
  descriptor: ZoneDescriptor<TRegion, TShared, TMover>;
  scope: ResourceScopeLike;
  output: ZoneBuildOutput<TMover>;
  loadedAtMs: number;
}

export interface WorldPerfMetrics {
  qualityTier: QualityTier;
  totalMeshes: number;
  instancedMeshes: number;
  totalInstances: number;
  totalTriangles: number;
  visibleTriangles: number;
  uniqueGeometries: number;
  uniqueMaterials: number;
  uniqueTextures: number;
  frustumCulledOffCount: number;
  managedPointLightsTotal: number;
  pooledPointLightsCount: number;
  activePointLightsCount: number;
  activeShadowCasters: number;
  activeShadowCasterTriangles: number;
  totalLandmarkGroups: number;
  visibleLandmarkGroups: number;
  deduplicatedMaterialsSaved: number;
  loadedZonesCount?: number;
}

export interface WorldCatalogEntry {
  id: string;
  slug: string;
  aliases: readonly string[];
  keywordMatches?: readonly string[];
  name: string;
  viewerTitle: string;
  viewerSubtitle: string;
  gallerySubtitle: string;
  description: string;
  accentColor: string;
  gradient: string;
  tags: readonly string[];
  tabLabel: string;
  tabTestId: string;
  syncFactory?: () => ISpace;
  loadFactory: () => Promise<ISpace>;
}
