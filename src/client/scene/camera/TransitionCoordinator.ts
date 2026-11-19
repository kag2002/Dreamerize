import * as THREE from 'three';

export interface CameraPose {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Quintic smootherstep interpolation function:
 * s(t) = 6t^5 - 15t^4 + 10t^3
 * Yields C2 continuity: zero velocity and zero acceleration at t=0 and t=1.
 */
export function quinticSmootherstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Calculates the shortest signed angular difference between two angles in radians: [-PI, +PI].
 */
export function shortestAngleDifference(fromAngle: number, toAngle: number): number {
  return ((toAngle - fromAngle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/**
 * Coordinates seamless, C2-continuous 2.0s camera transitions between FPV and Auto Wander.
 */
export class TransitionCoordinator {
  private active: boolean = false;
  private duration: number = 2.0;
  private elapsed: number = 0;

  private startPose: CameraPose = {
    position: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    roll: 0
  };

  private targetPose: CameraPose = {
    position: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    roll: 0
  };

  private deltaYaw: number = 0;
  private deltaPitch: number = 0;
  private deltaRoll: number = 0;

  private onCompleteCallback: (() => void) | null = null;

  /**
   * Begins a smooth transition from startPose to targetPose.
   * @param from Starting camera pose
   * @param to Target camera pose
   * @param duration Transition duration in seconds (default 2.0s)
   * @param onComplete Optional callback fired when transition reaches 100%
   */
  public startTransition(
    from: CameraPose,
    to: CameraPose,
    duration: number = 2.0,
    onComplete?: () => void
  ): void {
    this.startPose = {
      position: from.position.clone(),
      yaw: from.yaw,
      pitch: from.pitch,
      roll: from.roll
    };

    this.targetPose = {
      position: to.position.clone(),
      yaw: to.yaw,
      pitch: to.pitch,
      roll: to.roll
    };

    this.duration = Math.max(0.001, duration);
    this.elapsed = 0;
    this.active = true;
    this.onCompleteCallback = onComplete ?? null;

    // Precalculate shortest angular displacements
    this.deltaYaw = shortestAngleDifference(from.yaw, to.yaw);
    this.deltaPitch = shortestAngleDifference(from.pitch, to.pitch);
    this.deltaRoll = shortestAngleDifference(from.roll, to.roll);
  }

  /**
   * Advances the transition by deltaTime and returns the interpolated pose.
   * Returns null if no transition is active.
   */
  public update(deltaTime: number): CameraPose | null {
    if (!this.active) return null;

    this.elapsed += Math.max(0, deltaTime);
    const normalizedTime = Math.min(1.0, this.elapsed / this.duration);
    const s = quinticSmootherstep(normalizedTime);

    // Interpolate position
    const currentPosition = new THREE.Vector3().lerpVectors(
      this.startPose.position,
      this.targetPose.position,
      s
    );

    // Interpolate orientation via shortest angular paths
    const currentYaw = this.startPose.yaw + this.deltaYaw * s;
    const currentPitch = this.startPose.pitch + this.deltaPitch * s;
    const currentRoll = this.startPose.roll + this.deltaRoll * s;

    if (normalizedTime >= 1.0) {
      this.active = false;
      const callback = this.onCompleteCallback;
      this.onCompleteCallback = null;
      if (callback) {
        callback();
      }
    }

    return {
      position: currentPosition,
      yaw: currentYaw,
      pitch: currentPitch,
      roll: currentRoll
    };
  }

  public isActive(): boolean {
    return this.active;
  }

  public getProgress(): number {
    if (!this.active) return 1.0;
    return Math.min(1.0, this.elapsed / this.duration);
  }

  public cancel(): void {
    this.active = false;
    this.onCompleteCallback = null;
  }
}
