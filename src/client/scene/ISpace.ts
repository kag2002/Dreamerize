import * as THREE from 'three';
import { SpaceConfig } from '../../shared/types/space';

export interface IPointOfInterest {
  name: string;
  position: THREE.Vector3;
  lookAt?: THREE.Vector3;
  region?: string;
  dwellTime: number;
}

export interface ISpawnPoint {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export interface IWanderBounds {
  radius: number;
  center: THREE.Vector3;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
}

/**
 * Contract for surreal 3D spaces in Dreamerize.
 * All scenes ("The Starry Night", "Ngọn đồi gió thoảng", etc.) must conform to this interface.
 */
export interface ISpace {
  readonly id: string;
  readonly name: string;
  readonly slug: string;

  /**
   * Initializes the 3D scene graph, procedural geometry, shaders, and lighting.
   */
  init(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, config?: SpaceConfig): Promise<void>;

  /**
   * Updates animations, uniform time variables, and procedural dynamics.
   * @param deltaTime Elapsed seconds since last frame
   * @param elapsedTime Total elapsed seconds since engine start
   */
  update(deltaTime: number, elapsedTime: number): void;

  /**
   * Renders the scene to the current WebGL viewport.
   */
  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void;

  /**
   * Reactively updates scene parameters (e.g. swirl speed, fog, lighting)
   * in real time without destroying the scene graph or WebGL context.
   */
  updateConfig(newConfig: Partial<SpaceConfig>): void;

  /**
   * Performs complete, zero-leak disposal of all GPU assets in this scene.
   */
  dispose(): void;

  /**
   * Evaluates the analytical ground height function h(x, z) in O(1) time.
   */
  getGroundHeight(x: number, z: number): number;

  /**
   * Returns the initial spawn position and lookAt vector.
   */
  getSpawnPoint(): ISpawnPoint;

  /**
   * Returns the wander boundary circle / box for autonomous camera flight.
   */
  getWanderBounds(): IWanderBounds;

  /**
   * Returns designated scenic points of interest for cinematic dwell.
   */
  getPointsOfInterest(): IPointOfInterest[];
}
