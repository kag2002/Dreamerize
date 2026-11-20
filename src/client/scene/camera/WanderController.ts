import * as THREE from 'three';
import { ISpace, IPointOfInterest } from '../ISpace';

export interface WanderControllerOptions {
  cruiseSpeed?: number; // 3.5 ~ 5.0 m/s
  wanderDistance?: number; // distance to projected circle, default 8.0m
  wanderRadius?: number; // radius of projected circle, default 3.5m
  wanderJitterRate?: number; // radians/s jitter rate, default 2.0
  lookAheadTime?: number; // seconds ahead for terrain probe, default 2.5s
  minClearance?: number; // minimum safe terrain clearance, default 3.0m
  cruiseClearance?: number; // desired flight altitude above terrain, default 7.0m
  maxRoll?: number; // max banking angle, default 0.12 rad
  rollFactor?: number; // roll multiplier, default 0.35
  minPitch?: number; // radians, default -85 deg
  maxPitch?: number; // radians, default +85 deg
  maxAltitudeOffset?: number;
  lookReturnDelay?: number; // seconds after user stops looking before gently recentering
  lookReturnRate?: number; // exponential return rate (s^-1) after lookReturnDelay
}

export interface WanderCameraState {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Autonomous Random Wander Camera Controller.
 * Features:
 * - Autonomous Reynolds wander steering
 * - Scenic Points of Interest (POIs) attraction sequencer with dwell cycles (20-40s)
 * - Forward look-ahead elevation probe (t_ahead = 2.5s) guaranteeing clearance >= 3.0m
 * - Quadratic lift repulsion impulse preventing any ground clipping
 * - Natural aerodynamic banking roll (-0.12 to +0.12 rad) proportional to yaw rate
 * - Additive 360° user free-look offset (drag/swipe/Q-E) while gliding
 */
export class WanderController {
  private readonly camera: THREE.PerspectiveCamera;

  // Flight parameters
  public readonly cruiseSpeed: number;
  public readonly wanderDistance: number;
  public readonly wanderRadius: number;
  public readonly wanderJitterRate: number;
  public readonly lookAheadTime: number;
  public readonly minClearance: number;
  public readonly cruiseClearance: number;
  public readonly maxRoll: number;
  public readonly rollFactor: number;
  public readonly minPitch: number;
  public readonly maxPitch: number;
  public readonly maxAltitudeOffset: number;
  public readonly lookReturnDelay: number;
  public readonly lookReturnRate: number;

  // Glider state
  private velocity: THREE.Vector3 = new THREE.Vector3(0, 0, -4.0);
  private yaw: number = 0;
  private pitch: number = 0;
  private roll: number = 0;
  private previousYaw: number = 0;

  // Additive 360° free-look offset while wandering
  private lookYawOffset: number = 0;
  private lookPitchOffset: number = 0;
  private lookIdleTimer: number = 0;
  private isUserLooking: boolean = false;

  private wanderAngle: number = 0;
  private currentPoiIndex: number = 0;
  private poiDwellTimer: number = 0;
  private currentDwellDuration: number = 25.0; // 20 - 40s
  private totalElapsedTime: number = 0;
  private altitudeOffset: number = 0;
  private cinematicMode: boolean = false;
  private cinematicLateralPhase: number = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    options: WanderControllerOptions = {}
  ) {
    this.camera = camera;

    this.cruiseSpeed = options.cruiseSpeed ?? 8.4; // 2x base cruise speed
    this.wanderDistance = options.wanderDistance ?? 8.0;
    this.wanderRadius = options.wanderRadius ?? 3.5;
    this.wanderJitterRate = options.wanderJitterRate ?? 2.0;
    this.lookAheadTime = options.lookAheadTime ?? 2.5; // 2.5s lookahead
    this.minClearance = options.minClearance ?? 3.0; // >= 3.0m safety clearance
    this.cruiseClearance = options.cruiseClearance ?? 7.0;
    this.maxRoll = options.maxRoll ?? 0.12; // rad (~6.9 deg)
    this.rollFactor = options.rollFactor ?? 0.35;

    const deg85Rad = (85 * Math.PI) / 180;
    this.minPitch = options.minPitch ?? -deg85Rad;
    this.maxPitch = options.maxPitch ?? deg85Rad;
    this.maxAltitudeOffset = options.maxAltitudeOffset ?? 180.0;
    this.lookReturnDelay = options.lookReturnDelay ?? 7.0;
    this.lookReturnRate = options.lookReturnRate ?? 0.35;

    this.syncFromCamera();
  }

  private getEffectiveCruiseSpeed(): number {
    return this.cinematicMode ? this.cruiseSpeed * 0.55 : this.cruiseSpeed;
  }

  public setCinematicMode(enabled: boolean): void {
    if (this.cinematicMode === enabled) return;
    this.cinematicMode = enabled;
    this.cinematicLateralPhase = 0;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const targetSpeed = this.getEffectiveCruiseSpeed();
    if (speed > 0.001) {
      this.velocity.x = (this.velocity.x / speed) * targetSpeed;
      this.velocity.z = (this.velocity.z / speed) * targetSpeed;
    }
  }

  public isCinematicMode(): boolean {
    return this.cinematicMode;
  }

  /**
   * Synchronizes controller internal state from current camera position and rotation.
   */
  public syncFromCamera(): void {
    this.camera.rotation.order = 'YXZ';
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
    this.roll = this.camera.rotation.z;
    this.previousYaw = this.yaw;
    this.resetLookOffset();

    // Derive initial horizontal velocity from camera yaw
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const speed = this.getEffectiveCruiseSpeed();
    this.velocity.set(forwardX * speed, 0, forwardZ * speed);
  }

  public getState(): WanderCameraState {
    return {
      position: this.camera.position.clone(),
      yaw: this.yaw,
      pitch: this.pitch,
      roll: this.roll
    };
  }

  public setState(state: {
    position?: THREE.Vector3;
    yaw?: number;
    pitch?: number;
    roll?: number;
    velocity?: THREE.Vector3;
  }): void {
    if (state.position) this.camera.position.copy(state.position);
    if (state.yaw !== undefined) {
      this.yaw = state.yaw;
      this.previousYaw = state.yaw;
    }
    if (state.pitch !== undefined) this.pitch = state.pitch;
    if (state.roll !== undefined) this.roll = state.roll;

    if (state.velocity) {
      this.velocity.copy(state.velocity);
    } else {
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const speed = this.getEffectiveCruiseSpeed();
      this.velocity.set(forwardX * speed, 0, forwardZ * speed);
    }

    this.resetLookOffset();
    this.applyCameraOrientation();
  }

  public getLookOffset(): { yaw: number; pitch: number } {
    return { yaw: this.lookYawOffset, pitch: this.lookPitchOffset };
  }

  public resetLookOffset(): void {
    this.lookYawOffset = 0;
    this.lookPitchOffset = 0;
    this.lookIdleTimer = 0;
    this.isUserLooking = false;
  }

  public setUserLooking(looking: boolean): void {
    this.isUserLooking = looking;
    if (looking) {
      this.lookIdleTimer = 0;
    }
  }

  /**
   * Applies an additive 360° free-look offset while gliding in Auto Wander.
   */
  public applyLookDelta(
    deltaX: number,
    deltaY: number,
    sensitivity: number = 0.0045
  ): void {
    if (deltaX === 0 && deltaY === 0) return;
    this.lookYawOffset -= deltaX * sensitivity;
    this.lookPitchOffset -= deltaY * sensitivity;
    this.lookPitchOffset = Math.max(
      this.minPitch,
      Math.min(this.maxPitch, this.lookPitchOffset)
    );
    this.lookIdleTimer = 0;
    this.applyCameraOrientation();
  }

  /**
   * Applies a direct yaw offset increment (e.g., Q/E keys or 360° auto-pan).
   */
  public applyYawDelta(deltaYaw: number): void {
    if (deltaYaw === 0) return;
    this.lookYawOffset += deltaYaw;
    this.lookIdleTimer = 0;
    this.applyCameraOrientation();
  }

  private applyCameraOrientation(): void {
    const effectiveYaw = this.yaw + this.lookYawOffset;
    const effectivePitch = Math.max(
      this.minPitch,
      Math.min(this.maxPitch, this.pitch + this.lookPitchOffset)
    );
    this.camera.rotation.set(effectivePitch, effectiveYaw, this.roll, 'YXZ');
  }

  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public getRoll(): number {
    return this.roll;
  }

  public getCurrentPoiIndex(): number {
    return this.currentPoiIndex;
  }

  public getAltitudeOffset(): number {
    return this.altitudeOffset;
  }

  public setAltitudeOffset(offset: number): void {
    const minOffset = -(this.cruiseClearance - this.minClearance);
    this.altitudeOffset = Math.max(minOffset, Math.min(this.maxAltitudeOffset, offset));
  }

  public adjustAltitudeOffset(deltaMeters: number): void {
    this.setAltitudeOffset(this.altitudeOffset + deltaMeters);
  }

  public resetAltitudeOffset(): void {
    this.altitudeOffset = 0;
  }

  /**
   * Updates autonomous flight steering, POI sequencing, lookahead clearance, and aerodynamic banking.
   */
  public update(deltaTime: number, space?: ISpace): void {
    const dt = Math.min(deltaTime, 0.1);
    if (dt <= 0) return;

    this.totalElapsedTime += dt;

    const effectiveCruiseSpeed = this.getEffectiveCruiseSpeed();
    const posX = this.camera.position.x;
    let posY = this.camera.position.y;
    const posZ = this.camera.position.z;

    // 1. Calculate current horizontal heading
    let vx = this.velocity.x;
    let vz = this.velocity.z;
    const horizontalSpeed = Math.hypot(vx, vz);

    let headingX = 0;
    let headingZ = -1;
    if (horizontalSpeed > 0.001) {
      headingX = vx / horizontalSpeed;
      headingZ = vz / horizontalSpeed;
    }

    // Right vector relative to heading (heading rotated 90 deg clockwise in XZ)
    const rightX = -headingZ;
    const rightZ = headingX;

    // 2. Reynolds Wander Steering Force (smoother spline drift in Cinematic Tour)
    const jitterScale = this.cinematicMode ? 0.3 : 1.0;
    const radiusScale = this.cinematicMode ? 0.65 : 1.0;
    const wanderWeight = this.cinematicMode ? 0.95 : 1.5;

    this.wanderAngle += (Math.random() - 0.5) * this.wanderJitterRate * jitterScale * dt;

    // Projected circle center
    const circleCenterX = headingX * this.wanderDistance;
    const circleCenterZ = headingZ * this.wanderDistance;

    // Point on projected circle
    const effectiveRadius = this.wanderRadius * radiusScale;
    const circleOffsetX =
      Math.cos(this.wanderAngle) * effectiveRadius * rightX +
      Math.sin(this.wanderAngle) * effectiveRadius * headingX;
    const circleOffsetZ =
      Math.cos(this.wanderAngle) * effectiveRadius * rightZ +
      Math.sin(this.wanderAngle) * effectiveRadius * headingZ;

    const wanderTargetX = circleCenterX + circleOffsetX;
    const wanderTargetZ = circleCenterZ + circleOffsetZ;
    const wanderTargetDist = Math.hypot(wanderTargetX, wanderTargetZ);

    let steerWanderX = 0;
    let steerWanderZ = 0;
    if (wanderTargetDist > 0.001) {
      steerWanderX = (wanderTargetX / wanderTargetDist) * wanderWeight;
      steerWanderZ = (wanderTargetZ / wanderTargetDist) * wanderWeight;
    }

    // 3. Scenic Points of Interest (POIs) Attraction Sequencer
    let steerPoiX = 0;
    let steerPoiZ = 0;
    const pois: IPointOfInterest[] = space?.getPointsOfInterest ? space.getPointsOfInterest() : [];
    let activePoi: IPointOfInterest | null = null;
    let distToPoi = Infinity;

    if (pois.length > 0) {
      this.poiDwellTimer += dt;
      const targetPoi = pois[this.currentPoiIndex % pois.length];
      activePoi = targetPoi;
      const baseDwell = targetPoi.dwellTime > 0 ? targetPoi.dwellTime : this.currentDwellDuration;
      const poiTargetDuration = this.cinematicMode ? baseDwell + 2.5 : baseDwell;

      const toPoiX = targetPoi.position.x - posX;
      const toPoiZ = targetPoi.position.z - posZ;
      distToPoi = Math.hypot(toPoiX, toPoiZ);

      // Transition to next POI if dwell timer expires or close enough after linger
      const earlyAdvance = this.cinematicMode
        ? distToPoi < 10.0 && this.poiDwellTimer > Math.max(poiTargetDuration * 0.75, 14.5)
        : distToPoi < 8.0 && this.poiDwellTimer > 12.0;

      if (this.poiDwellTimer > poiTargetDuration || earlyAdvance) {
        this.currentPoiIndex = (this.currentPoiIndex + 1) % pois.length;
        this.poiDwellTimer = 0;
        // Randomize next dwell duration between 20s and 40s
        this.currentDwellDuration = 20.0 + Math.random() * 20.0;
      }

      if (distToPoi > 0.001) {
        if (this.cinematicMode && distToPoi < 18.0) {
          // Gentle orbital spline linger around POI vantage
          const tangentX = -toPoiZ / distToPoi;
          const tangentZ = toPoiX / distToPoi;
          const radialPull = ((distToPoi - 11.0) / 11.0) * 1.1;
          steerPoiX = (toPoiX / distToPoi) * radialPull + tangentX * 1.45;
          steerPoiZ = (toPoiZ / distToPoi) * radialPull + tangentZ * 1.45;
        } else {
          // Blend attraction force toward POI
          const poiWeight = this.cinematicMode ? 2.1 : 1.6;
          steerPoiX = (toPoiX / distToPoi) * poiWeight;
          steerPoiZ = (toPoiZ / distToPoi) * poiWeight;
        }
      }
    }

    // 4. Perimeter Boundary Steering
    let steerBoundX = 0;
    let steerBoundZ = 0;
    if (space?.getWanderBounds) {
      const bounds = space.getWanderBounds();
      const centerX = bounds.center ? bounds.center.x : 0;
      const centerZ = bounds.center ? bounds.center.z : 0;
      const radius = bounds.radius > 0 ? bounds.radius : 50;

      const distFromCenter = Math.hypot(posX - centerX, posZ - centerZ);
      const softThreshold = radius * 0.75;

      if (distFromCenter > softThreshold) {
        const penetration = (distFromCenter - softThreshold) / (radius - softThreshold);
        const toCenterX = (centerX - posX) / distFromCenter;
        const toCenterZ = (centerZ - posZ) / distFromCenter;
        const boundaryWeight = Math.min(penetration * 4.0, 5.0);
        steerBoundX = toCenterX * boundaryWeight;
        steerBoundZ = toCenterZ * boundaryWeight;
      }
    }

    // 5. Combine horizontal steering forces and normalize to desired cruising speed
    const totalSteerX = steerWanderX + steerPoiX + steerBoundX;
    const totalSteerZ = steerWanderZ + steerPoiZ + steerBoundZ;

    vx += totalSteerX * dt;
    vz += totalSteerZ * dt;

    const lingerFactor =
      this.cinematicMode && distToPoi < 16.0
        ? 0.45 + 0.55 * Math.min(1.0, Math.max(0.0, (distToPoi - 6.0) / 10.0))
        : 1.0;
    const desiredSpeed = effectiveCruiseSpeed * lingerFactor;

    const newSpeed = Math.hypot(vx, vz);
    if (newSpeed > 0.001) {
      vx = (vx / newSpeed) * desiredSpeed;
      vz = (vz / newSpeed) * desiredSpeed;
    }
    this.velocity.x = vx;
    this.velocity.z = vz;

    // 6. Forward Look-Ahead Elevation Probe & Vertical Clearance Guarantee
    // Probe point at t_ahead = 2.5s: P_probe = P + V * t_ahead
    const probeX = posX + vx * this.lookAheadTime;
    const probeZ = posZ + vz * this.lookAheadTime;

    const currentGroundHeight = space?.getGroundHeight ? space.getGroundHeight(posX, posZ) : 0;
    const probeGroundHeight = space?.getGroundHeight ? space.getGroundHeight(probeX, probeZ) : 0;

    const effectiveGroundHeight = Math.max(currentGroundHeight, probeGroundHeight);

    // Target cruising altitude with gentle harmonic undulation
    const waveOffset = this.cinematicMode
      ? Math.sin(this.totalElapsedTime * 0.14) * 0.9
      : Math.sin(this.totalElapsedTime * 0.2) * 1.5;
    const targetY = effectiveGroundHeight + this.cruiseClearance + this.altitudeOffset + waveOffset;

    // Smooth vertical acceleration toward cruising altitude
    const heightDiff = targetY - posY;
    this.velocity.y += heightDiff * 2.0 * dt;
    // Damping on vertical speed
    this.velocity.y *= Math.exp(-2.5 * dt);

    // Quadratic Lift Repulsion Impulse if clearance < minClearance (>= 3.0m > 1.6m)
    const minSafeClearance = Math.max(this.minClearance, 1.6);
    const currentClearance = posY - currentGroundHeight;
    if (currentClearance < minSafeClearance) {
      const penetration = minSafeClearance - currentClearance;
      // Quadratic lift impulse: F_lift = k * penetration^2 + damping
      const liftImpulse = 25.0 * (penetration * penetration) + 15.0 * penetration;
      this.velocity.y += liftImpulse * dt;

      // Stop downward descent immediately
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }

      // Hard safety floor: guarantee terrain clearance >= minSafeClearance
      if (posY < currentGroundHeight + minSafeClearance) {
        posY = currentGroundHeight + minSafeClearance;
      }
    }

    // Update vertical position
    posY += this.velocity.y * dt;

    // Final safety clamp: ensure clearance >= minSafeClearance at all times (zero clipping)
    if (posY < currentGroundHeight + minSafeClearance) {
      posY = currentGroundHeight + minSafeClearance;
    }

    // 7. Update coordinates
    let newPosX = posX + vx * dt;
    let newPosZ = posZ + vz * dt;

    if (space?.getWanderBounds) {
      const bounds = space.getWanderBounds();
      const centerX = bounds.center ? bounds.center.x : 0;
      const centerZ = bounds.center ? bounds.center.z : 0;
      const maxAllowedRadius = (bounds.radius > 0 ? bounds.radius : 50) + 3.5;
      const dx = newPosX - centerX;
      const dz = newPosZ - centerZ;
      const dist = Math.hypot(dx, dz);
      if (dist > maxAllowedRadius) {
        newPosX = centerX + (dx / dist) * maxAllowedRadius;
        newPosZ = centerZ + (dz / dist) * maxAllowedRadius;
      }
    }

    // 8. Natural Aerodynamic Banking Roll & Orientation
    // Standard camera orientation: forward is -Z when yaw=0
    const flightYaw = Math.atan2(-vx, -vz);
    const flightPitch = -Math.max(
      -0.35,
      Math.min(0.35, (this.velocity.y / Math.max(effectiveCruiseSpeed, 0.5)) * 0.45)
    );

    let targetYaw = flightYaw;
    let targetPitch = flightPitch;

    if (this.cinematicMode && activePoi) {
      const focusPoint = activePoi.lookAt ?? activePoi.position;
      const lookDx = focusPoint.x - newPosX;
      const lookDy = focusPoint.y - posY;
      const lookDz = focusPoint.z - newPosZ;
      const horizLookDist = Math.hypot(lookDx, lookDz);

      if (horizLookDist > 0.5) {
        const poiYaw = Math.atan2(-lookDx, -lookDz);
        const poiPitch = Math.max(-0.55, Math.min(0.55, Math.atan2(lookDy, horizLookDist)));
        this.cinematicLateralPhase += dt * 0.42;
        const breathingPan = Math.sin(this.cinematicLateralPhase) * 0.095;
        const breathingTilt = Math.sin(this.cinematicLateralPhase * 0.65) * 0.025;
        const focusWeight = activePoi.lookAt
          ? Math.min(1.0, Math.max(0.4, 1.0 - Math.max(0, distToPoi - 14.0) / 85.0))
          : Math.min(0.9, Math.max(0.25, 1.0 - Math.max(0, distToPoi - 14.0) / 65.0));

        const yawToPoi =
          ((poiYaw + breathingPan - flightYaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        targetYaw = flightYaw + yawToPoi * focusWeight;
        targetPitch = flightPitch + (poiPitch + breathingTilt - flightPitch) * focusWeight;
      }
    }

    // Shortest angular difference between targetYaw and current yaw
    const deltaYaw = ((targetYaw - this.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

    // Yaw angular rate
    const yawRate = deltaYaw / dt;

    // Aerodynamic Banking Roll (softer Steadicam gimbal damping in cinematicMode)
    const effectiveRollFactor = this.cinematicMode ? this.rollFactor * 0.45 : this.rollFactor;
    const effectiveMaxRoll = this.cinematicMode ? this.maxRoll * 0.5 : this.maxRoll;
    const targetRoll = -Math.max(
      -effectiveMaxRoll,
      Math.min(effectiveMaxRoll, yawRate * effectiveRollFactor)
    );

    // Smooth yaw, pitch, and roll
    const yawSmoothing = 1 - Math.exp(-(this.cinematicMode ? 2.2 : 3.5) * dt);
    this.yaw += deltaYaw * yawSmoothing;

    const pitchSmoothing = 1 - Math.exp(-(this.cinematicMode ? 2.0 : 3.0) * dt);
    this.pitch += (targetPitch - this.pitch) * pitchSmoothing;

    const rollSmoothing = 1 - Math.exp(-4.5 * dt);
    this.roll += (targetRoll - this.roll) * rollSmoothing;

    this.previousYaw = this.yaw;

    // 9. Gently decay additive 360° free-look offset only after idle pause
    if (this.isUserLooking) {
      this.lookIdleTimer = 0;
    } else if (this.lookYawOffset !== 0 || this.lookPitchOffset !== 0) {
      this.lookIdleTimer += dt;
      if (this.lookIdleTimer > this.lookReturnDelay) {
        const twoPi = Math.PI * 2;
        this.lookYawOffset =
          (((this.lookYawOffset % twoPi) + 3 * Math.PI) % twoPi) - Math.PI;
        const decay = Math.exp(-this.lookReturnRate * dt);
        this.lookYawOffset *= decay;
        this.lookPitchOffset *= decay;
        if (Math.abs(this.lookYawOffset) < 0.0005) this.lookYawOffset = 0;
        if (Math.abs(this.lookPitchOffset) < 0.0005) this.lookPitchOffset = 0;
      }
    }

    // Apply to camera (with additive 360° user free-look offset)
    this.camera.position.set(newPosX, posY, newPosZ);
    this.applyCameraOrientation();
  }

  public dispose(): void {
    // Reset velocities and states
    this.cinematicMode = false;
    this.cinematicLateralPhase = 0;
    this.altitudeOffset = 0;
    this.velocity.set(0, 0, 0);
    this.resetLookOffset();
  }
}
