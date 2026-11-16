export type SpaceSlug = 'starry-night' | 'breezy-meadow' | string;
export type SkyType = 'starry_night_flow' | 'procedural_clouds' | 'gradient';
export type FogType = 'linear' | 'exp2';
export type AudioType = 'audio_buffer' | 'procedural_synth';

export interface FogConfig {
  type: FogType;
  color: string;
  density: number;
  near?: number;
  far?: number;
}

export interface SkyConfig {
  type: SkyType;
  topColor: string;
  bottomColor: string;
  horizonColor: string;
  swirlSpeed: number;
  starDensity: number;
  cloudCoverage?: number;
  cloudSpeed?: number;
  moonGlow?: number;
}

export interface WindConfig {
  speed: number;
  direction: [number, number, number];
  gustiness: number;
  swayIntensity: number;
}

export interface LightingConfig {
  ambient: {
    color: string;
    intensity: number;
  };
  directional: {
    color: string;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
  };
  pointLights: Array<{
    color: string;
    intensity: number;
    distance: number;
    position: [number, number, number];
  }>;
}

export interface ShaderUniformsConfig {
  swirlFlow?: {
    frequency: number;
    amplitude: number;
    timeScale: number;
  };
  grassSway?: {
    stiffness: number;
    windInfluence: number;
    noiseScale?: number;
  };
  flowerFlutter?: {
    frequency: number;
    amplitude: number;
  };
}

export interface AudioConfig {
  trackId: string;
  name: string;
  sourceUrl: string;
  defaultVolume: number;
  loop: boolean;
  ambientType: AudioType;
  reverb?: {
    decay: number;
    wet: number;
  };
}

export interface CameraConfig {
  spawnPosition: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  moveSpeed: number;
  wanderSpeed: number;
  wanderRadius: number;
  wanderWaypoints: Array<[number, number, number]>;
  heightOffset: number;
}

export interface SpaceConfig {
  fog: FogConfig;
  sky: SkyConfig;
  wind: WindConfig;
  lighting: LightingConfig;
  shaders: ShaderUniformsConfig;
  audio: AudioConfig;
  camera: CameraConfig;
}

export interface SpaceEntity {
  id: string;
  slug: string;
  name: string;
  description: string;
  thumbnailUrl?: string;
  creatorId: string;
  isPublished: boolean;
  config: SpaceConfig;
  createdAt: string;
  updatedAt: string;
}
