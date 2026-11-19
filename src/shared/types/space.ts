export type SpaceSlug =
  | 'starry-night'
  | 'breezy-meadow'
  | 'cosmic-blackhole'
  | 'misty-forest'
  | 'paradise-sanctuary'
  | 'ghibli-valley'
  | 'vietnam-heritage'
  | '3dgs-coastal-sanctuary'
  | string;
export type SkyType =
  | 'starry_night_flow'
  | 'procedural_clouds'
  | 'gradient'
  | 'cosmic_nebula'
  | 'misty_mountain'
  | 'paradise_sky'
  | 'ghibli_coastal'
  | 'vietnam_heritage'
  | 'custom_asset';
export type SpaceAssetFormat = 'procedural' | 'splat' | 'ply' | 'glb';
export type RenderStyleMode = 'default' | 'impasto' | 'ghibli' | 'natural';
export type FogType = 'linear' | 'exp2';
export type AudioType = 'audio_buffer' | 'procedural_synth';
export type MusicGenre = 'auto' | 'jazz' | 'classical' | 'chamber' | 'acoustic';
export type MusicTrackId =
  | 'auto'
  | 'jazz-midnight-cafe'
  | 'jazz-velvet-swing'
  | 'classical-clair-nocturne'
  | 'classical-pastoral-adagio'
  | 'chamber-salon-provence'
  | 'chamber-sanctuary-vespers'
  | 'acoustic-coastal-waltz'
  | 'zen-forest-flute'
  | 'vietnam-lotus-serenade';

export interface MusicTrackMeta {
  id: MusicTrackId;
  genre: MusicGenre;
  genreLabel: string;
  title: string;
  subtitle: string;
  bpm?: number;
  instruments: string[];
}

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

export type CameraMode = 'first_person' | 'auto_wander';

export interface ICameraController<TSpace = any> {
  readonly mode: CameraMode;
  setMode(mode: CameraMode, duration?: number): void;
  update(deltaTime: number, space: TSpace): void;
  dispose(): void;
}

export interface IAudioManager {
  loadAndPlay(config: AudioConfig): Promise<void>;
  setVolume(volume: number): void;
  setMute(mute: boolean): void;
  isMuted(): boolean;
  getVolume(): number;
  setMusicTrack?(trackId: MusicTrackId): void;
  getMusicTrack?(): MusicTrackId;
  getFFTEnergy(): { bass: number; mid: number; treble: number };
  dispose(): void;
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
  assetUrl?: string;
  assetFormat?: SpaceAssetFormat;
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
