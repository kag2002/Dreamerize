import * as THREE from 'three';
import { ICameraController, CameraMode } from '../../../shared/types/space';
import { ISpace } from '../ISpace';
import { FPVController, FPVControllerOptions } from './FPVController';
import { WanderController, WanderControllerOptions } from './WanderController';
import { TransitionCoordinator, CameraPose } from './TransitionCoordinator';

export interface CameraControllerOptions {
  initialMode?: CameraMode;
  transitionDuration?: number;
  fpvOptions?: FPVControllerOptions;
  wanderOptions?: WanderControllerOptions;
}

/**
 * Unified Camera Controller conforming to ICameraController.
 * Coordinates First-Person View and Autonomous Wander modes with seamless
 * 2.0s quintic smootherstep transitions.
 */
export class CameraController implements ICameraController<ISpace> {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement | null;

  private readonly fpvController: FPVController;
  private readonly wanderController: WanderController;
  private readonly transitionCoordinator: TransitionCoordinator;

  private currentMode: CameraMode;
  private targetMode: CameraMode | null = null;
  private autoPanActive: boolean = false;
  private cinematicMode: boolean = false;
  public readonly autoPanSpeed: number = 0.35;
  public defaultTransitionDuration: number;
  public onModeChange?: (mode: CameraMode) => void;
  public onLockChange?: (locked: boolean) => void;
  public onDragChange?: (dragging: boolean) => void;
  public onAutoPanChange?: (active: boolean) => void;
  public onCinematicModeChange?: (active: boolean) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement?: HTMLElement | null,
    options: CameraControllerOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement ?? null;
    this.currentMode = options.initialMode ?? 'first_person';
    this.defaultTransitionDuration = options.transitionDuration ?? 2.0;

    this.fpvController = new FPVController(camera, domElement, options.fpvOptions);
    this.wanderController = new WanderController(camera, options.wanderOptions);
    this.transitionCoordinator = new TransitionCoordinator();

    // Ensure camera rotation order prevents Gimbal Lock
    this.camera.rotation.order = 'YXZ';
    this.fpvController.touchFullZoneLook = this.currentMode === 'auto_wander';

    this.fpvController.onLookInput = (dx, dy, _source, sensitivity) => {
      if (this.transitionCoordinator.isActive()) {
        return true;
      }
      if (this.currentMode === 'auto_wander') {
        this.wanderController.applyLookDelta(dx, dy, sensitivity);
        return true;
      }
      return false;
    };

    this.fpvController.onManualLookStart = () => {
      if (this.autoPanActive) {
        this.setAutoPan360(false);
      }
    };

    this.fpvController.onLockChange = (locked) => {
      this.onLockChange?.(locked);
    };

    this.fpvController.onDragChange = (dragging) => {
      this.onDragChange?.(dragging);
    };
  }

  public get mode(): CameraMode {
    return this.currentMode;
  }

  public getFPVController(): FPVController {
    return this.fpvController;
  }

  public getWanderController(): WanderController {
    return this.wanderController;
  }

  public getTransitionCoordinator(): TransitionCoordinator {
    return this.transitionCoordinator;
  }

  public lockPointer(): void {
    this.fpvController.lock();
  }

  public unlockPointer(): void {
    this.fpvController.unlock();
  }

  public isPointerLocked(): boolean {
    return this.fpvController.isPointerLocked();
  }

  public setAutoPan360(enabled: boolean): void {
    if (this.autoPanActive === enabled) return;
    this.autoPanActive = enabled;
    this.onAutoPanChange?.(enabled);
  }

  public isAutoPan360(): boolean {
    return this.autoPanActive;
  }

  public toggleAutoPan360(): boolean {
    this.setAutoPan360(!this.autoPanActive);
    return this.autoPanActive;
  }

  public setCinematicMode(enabled: boolean): void {
    if (this.cinematicMode === enabled) return;
    this.cinematicMode = enabled;
    this.wanderController.setCinematicMode(enabled);
    this.onCinematicModeChange?.(enabled);
  }

  public isCinematicMode(): boolean {
    return this.cinematicMode;
  }

  public resetWanderLook(): void {
    this.wanderController.resetLookOffset();
  }

  public onMouseMove(e: { movementX?: number; movementY?: number }): void {
    const dx = e.movementX ?? 0;
    const dy = e.movementY ?? 0;
    if (this.currentMode === 'auto_wander') {
      this.wanderController.applyLookDelta(dx, dy, this.fpvController.mouseSensitivity);
    } else {
      this.fpvController.applyMouseDelta(dx, dy);
    }
  }

  public setPitch(pitch: number): void {
    if (this.currentMode === 'auto_wander') {
      const clamped = Math.max(
        this.wanderController.minPitch,
        Math.min(this.wanderController.maxPitch, pitch)
      );
      this.wanderController.resetLookOffset();
      this.wanderController.setState({ pitch: clamped });
    } else {
      this.fpvController.setOrientation(this.fpvController.getYaw(), pitch);
    }
  }

  /**
   * Switches camera mode with a seamless quintic smootherstep transition.
   * @param targetMode 'first_person' | 'auto_wander'
   * @param duration Transition duration in seconds (default 2.0s)
   */
  public setMode(targetMode: CameraMode, duration: number = this.defaultTransitionDuration): void {
    if (targetMode === 'first_person' && this.cinematicMode) {
      this.setCinematicMode(false);
    }

    if (this.currentMode === targetMode && !this.transitionCoordinator.isActive()) {
      return;
    }

    this.fpvController.touchFullZoneLook = targetMode === 'auto_wander';

    if (duration <= 0) {
      // Immediate switch without transition
      this.transitionCoordinator.cancel();
      this.currentMode = targetMode;
      this.targetMode = null;
      this.wanderController.resetLookOffset();
      if (targetMode === 'first_person') {
        this.fpvController.syncFromCamera();
      } else {
        this.fpvController.unlock();
        this.wanderController.syncFromCamera();
      }
      this.onModeChange?.(targetMode);
      return;
    }

    this.currentMode = targetMode;
    this.targetMode = targetMode;
    this.onModeChange?.(targetMode);

    const fromPose: CameraPose = {
      position: this.camera.position.clone(),
      yaw: this.camera.rotation.y,
      pitch: this.camera.rotation.x,
      roll: this.camera.rotation.z
    };

    let toPose: CameraPose;

    if (targetMode === 'auto_wander') {
      // Transition from FPV -> Auto Wander
      this.fpvController.unlock();
      this.wanderController.resetLookOffset();

      // Raise camera to cruising altitude above ground and glide forward smoothly
      const currentX = this.camera.position.x;
      const currentZ = this.camera.position.z;
      const targetX = currentX - Math.sin(fromPose.yaw) * 4.5;
      const targetZ = currentZ - Math.cos(fromPose.yaw) * 4.5;
      const cruiseY = this.camera.position.y + 4.5; // Smooth lift into cruise

      toPose = {
        position: new THREE.Vector3(targetX, cruiseY, targetZ),
        yaw: fromPose.yaw,
        pitch: 0,
        roll: 0
      };

      this.wanderController.setState({
        position: toPose.position,
        yaw: toPose.yaw,
        pitch: 0,
        roll: 0
      });
    } else {
      // Transition from Auto Wander -> FPV
      this.wanderController.resetLookOffset();
      const currentX = this.camera.position.x;
      const currentZ = this.camera.position.z;

      toPose = {
        position: new THREE.Vector3(currentX, this.camera.position.y, currentZ),
        yaw: fromPose.yaw,
        pitch: 0,
        roll: 0
      };
    }

    this.transitionCoordinator.startTransition(fromPose, toPose, duration, () => {
      this.currentMode = targetMode;
      this.targetMode = null;
      this.wanderController.resetLookOffset();

      if (targetMode === 'first_person') {
        this.fpvController.syncFromCamera();
      } else {
        this.wanderController.syncFromCamera();
      }
    });
  }

  /**
   * Updates camera state for the current frame.
   */
  public update(deltaTime: number, space?: ISpace): void {
    if (this.transitionCoordinator.isActive()) {
      const interpolatedPose = this.transitionCoordinator.update(deltaTime);
      if (interpolatedPose) {
        this.camera.position.copy(interpolatedPose.position);
        this.camera.rotation.set(
          interpolatedPose.pitch,
          interpolatedPose.yaw,
          interpolatedPose.roll,
          'YXZ'
        );
      }
      return;
    }

    const dt = Math.min(deltaTime, 0.1);

    if (this.currentMode === 'first_person') {
      if (this.autoPanActive && dt > 0) {
        this.fpvController.applyYawDelta(-this.autoPanSpeed * dt);
      }
      this.fpvController.update(deltaTime, space);
    } else {
      this.fpvController.updateFov(deltaTime);
      const yawKeyInput =
        (this.fpvController.isYawLeftPressed() ? 1 : 0) -
        (this.fpvController.isYawRightPressed() ? 1 : 0);

      if (yawKeyInput !== 0 && dt > 0) {
        if (this.autoPanActive) {
          this.setAutoPan360(false);
        }
        this.wanderController.applyYawDelta(
          yawKeyInput * this.fpvController.keyYawSpeed * dt
        );
      } else if (this.autoPanActive && dt > 0) {
        this.wanderController.applyYawDelta(-this.autoPanSpeed * dt);
      }

      const userLooking =
        this.fpvController.isDraggingLook() ||
        this.fpvController.isPointerLocked() ||
        yawKeyInput !== 0 ||
        this.autoPanActive;
      this.wanderController.setUserLooking(userLooking);
      this.wanderController.update(deltaTime, space);
    }
  }

  /**
   * Tears down controllers and event listeners.
   */
  public dispose(): void {
    this.autoPanActive = false;
    this.cinematicMode = false;
    this.transitionCoordinator.cancel();
    this.onLockChange = undefined;
    this.onDragChange = undefined;
    this.onAutoPanChange = undefined;
    this.onCinematicModeChange = undefined;
    this.fpvController.dispose();
    this.wanderController.dispose();
  }
}
