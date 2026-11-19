import * as THREE from 'three';
import { ISpace } from '../ISpace';

export interface FPVControllerOptions {
  walkSpeed?: number;
  sprintMultiplier?: number;
  acceleration?: number;
  friction?: number;
  mouseSensitivity?: number;
  dragSensitivity?: number;
  touchLookSensitivity?: number;
  keyYawSpeed?: number;
  thumbstickRadius?: number;
  eyeHeight?: number;
  elevationLambda?: number;
  minPitch?: number; // radians, default -85 deg
  maxPitch?: number; // radians, default +85 deg
  minFov?: number; // degrees, default 35
  maxFov?: number; // degrees, default 90
}

export type LookInputSource = 'mouse' | 'drag' | 'touch' | 'key';

/**
 * First-Person View (FPV) Camera Controller.
 * Features:
 * - Damped kinematic physics (acceleration, friction, sprint multiplier)
 * - Unbounded 360° click-and-drag panorama look + optional Pointer Lock API + Q/E yaw keys + wheel FOV zoom
 * - Gimbal Lock prevention ('YXZ' Euler rotation)
 * - Dual-zone mobile touch controls (dynamic virtual thumbstick & swipe look)
 * - Dual-tier ground elevation clamping with exponential damping
 * - Soft-spring boundary perimeter constraint
 */
export class FPVController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement | null;

  // Kinematic parameters
  public readonly walkSpeed: number;
  public readonly sprintMultiplier: number;
  public readonly sprintSpeed: number;
  public readonly acceleration: number;
  public readonly friction: number;
  public readonly eyeHeight: number;
  public readonly elevationLambda: number;

  // Sensitivity & limits
  public readonly mouseSensitivity: number;
  public readonly dragSensitivity: number;
  public readonly touchLookSensitivity: number;
  public readonly keyYawSpeed: number;
  public readonly thumbstickRadius: number;
  public readonly minPitch: number;
  public readonly maxPitch: number;
  public readonly minFov: number;
  public readonly maxFov: number;

  // Integration hooks for CameraController
  public onLookInput?: (
    deltaX: number,
    deltaY: number,
    source: LookInputSource,
    sensitivity: number
  ) => boolean;
  public onManualLookStart?: () => void;
  public onLockChange?: (locked: boolean) => void;
  public onDragChange?: (dragging: boolean) => void;
  public touchFullZoneLook: boolean = false;

  // Internal state
  private velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private elevatedPerchY: number | null = null;
  private yaw: number = 0;
  private pitch: number = 0;
  private targetFov: number = 60;
  private isLocked: boolean = false;
  private isCanvasEngaged: boolean = false;
  private isDragging: boolean = false;
  private dragMoved: boolean = false;
  private dragStartPos: { x: number; y: number } | null = null;
  private suppressNextClick: boolean = false;
  private suppressClickTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMousePos: { x: number; y: number } | null = null;

  // Keyboard input states
  private moveForward: boolean = false;
  private moveBackward: boolean = false;
  private moveLeft: boolean = false;
  private moveRight: boolean = false;
  private yawLeft: boolean = false;
  private yawRight: boolean = false;
  private isSprinting: boolean = false;

  // Touch states
  private moveTouchId: number | null = null;
  private moveTouchOrigin: { x: number; y: number } | null = null;
  private moveTouchDelta: { x: number; y: number } = { x: 0, y: 0 };

  private lookTouchId: number | null = null;
  private lookTouchPrevious: { x: number; y: number } | null = null;

  // Bound event listeners for cleanup
  private onKeyDownBound: ((e: KeyboardEvent) => void) | null = null;
  private onKeyUpBound: ((e: KeyboardEvent) => void) | null = null;
  private onMouseDownBound: ((e: MouseEvent) => void) | null = null;
  private onDocMouseDownBound: ((e: MouseEvent) => void) | null = null;
  private onMouseMoveBound: ((e: MouseEvent) => void) | null = null;
  private onMouseUpBound: ((e: MouseEvent) => void) | null = null;
  private onWheelBound: ((e: WheelEvent) => void) | null = null;
  private onWindowBlurBound: (() => void) | null = null;
  private onPointerLockChangeBound: (() => void) | null = null;
  private onPointerLockErrorBound: (() => void) | null = null;
  private onTouchStartBound: ((e: TouchEvent) => void) | null = null;
  private onTouchMoveBound: ((e: TouchEvent) => void) | null = null;
  private onTouchEndBound: ((e: TouchEvent) => void) | null = null;
  private onDomClickBound: ((e: MouseEvent) => void) | null = null;
  private onDomDblClickBound: ((e: MouseEvent) => void) | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement?: HTMLElement | null,
    options: FPVControllerOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement ?? null;

    this.walkSpeed = options.walkSpeed ?? 4.0;
    this.sprintMultiplier = options.sprintMultiplier ?? 1.75;
    this.sprintSpeed = this.walkSpeed * this.sprintMultiplier; // 7.0 m/s
    this.acceleration = options.acceleration ?? 25.0; // m/s^2
    this.friction = options.friction ?? 8.0; // s^-1
    this.eyeHeight = options.eyeHeight ?? 1.7; // m
    this.elevationLambda = options.elevationLambda ?? 10.0;

    this.mouseSensitivity = options.mouseSensitivity ?? 0.002;
    this.dragSensitivity = options.dragSensitivity ?? 0.0045;
    this.touchLookSensitivity = options.touchLookSensitivity ?? 0.006;
    this.keyYawSpeed = options.keyYawSpeed ?? 1.8;
    this.thumbstickRadius = options.thumbstickRadius ?? 45.0; // px

    // Pitch clamped to [-85 deg, +85 deg]
    const deg85Rad = (85 * Math.PI) / 180; // ~1.4835 rad
    this.minPitch = options.minPitch ?? -deg85Rad;
    this.maxPitch = options.maxPitch ?? deg85Rad;
    this.minFov = options.minFov ?? 35;
    this.maxFov = options.maxFov ?? 90;
    this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, camera.fov || 60));

    // Set camera rotation order to 'YXZ' to prevent Gimbal Lock
    this.camera.rotation.order = 'YXZ';
    this.syncFromCamera();

    this.attachEventListeners();
  }

  /**
   * Synchronizes controller internal yaw/pitch from current camera rotation.
   */
  public syncFromCamera(): void {
    this.yaw = this.camera.rotation.y;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.camera.rotation.x));
    this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.camera.fov || 60));
  }

  /**
   * Sets the position directly and syncs ground elevation.
   */
  public setPosition(x: number, y: number, z: number): void {
    this.elevatedPerchY = null;
    this.camera.position.set(x, y, z);
  }

  /**
   * Preserves an elevated scenic vantage Y coordinate (e.g. after teleporting to a raised POI)
   * until the user actively moves via WASD/thumbstick or changes position.
   */
  public setElevatedPerch(y: number | null): void {
    this.elevatedPerchY = y;
    if (y !== null) {
      this.velocity.set(0, 0, 0);
    }
  }

  /**
   * Sets orientation angles directly (in radians).
   */
  public setOrientation(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  public isPointerLocked(): boolean {
    return this.isLocked;
  }

  public isDraggingLook(): boolean {
    return this.isDragging;
  }

  public isEngaged(): boolean {
    return this.isCanvasEngaged;
  }

  public isYawLeftPressed(): boolean {
    return this.yawLeft;
  }

  public isYawRightPressed(): boolean {
    return this.yawRight;
  }

  /**
   * Programmatic input helper for automated testing or headless control.
   */
  public setInputs(inputs: {
    forward?: boolean;
    backward?: boolean;
    left?: boolean;
    right?: boolean;
    yawLeft?: boolean;
    yawRight?: boolean;
    sprint?: boolean;
  }): void {
    if (inputs.forward !== undefined) this.moveForward = inputs.forward;
    if (inputs.backward !== undefined) this.moveBackward = inputs.backward;
    if (inputs.left !== undefined) this.moveLeft = inputs.left;
    if (inputs.right !== undefined) this.moveRight = inputs.right;
    if (inputs.yawLeft !== undefined) this.yawLeft = inputs.yawLeft;
    if (inputs.yawRight !== undefined) this.yawRight = inputs.yawRight;
    if (inputs.sprint !== undefined) this.isSprinting = inputs.sprint;
  }

  private emitLookDelta(
    deltaX: number,
    deltaY: number,
    source: LookInputSource,
    sensitivity: number
  ): void {
    if (deltaX === 0 && deltaY === 0) return;
    this.onManualLookStart?.();
    if (this.onLookInput && this.onLookInput(deltaX, deltaY, source, sensitivity)) {
      return;
    }
    this.yaw -= deltaX * sensitivity;
    this.pitch -= deltaY * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Programmatic mouse delta helper.
   */
  public applyMouseDelta(movementX: number, movementY: number): void {
    this.yaw -= movementX * this.mouseSensitivity;
    this.pitch -= movementY * this.mouseSensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Programmatic drag delta helper (unbounded 360° yaw).
   */
  public applyDragDelta(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.dragSensitivity;
    this.pitch -= deltaY * this.dragSensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Direct yaw increment (used by Q/E keys or 360° panorama sweep).
   */
  public applyYawDelta(deltaYaw: number): void {
    if (deltaYaw === 0) return;
    this.yaw += deltaYaw;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Programmatic virtual thumbstick displacement helper.
   */
  public setTouchThumbstick(deltaX: number, deltaY: number): void {
    const len = Math.hypot(deltaX, deltaY);
    if (len > this.thumbstickRadius) {
      const scale = this.thumbstickRadius / len;
      this.moveTouchDelta = { x: deltaX * scale, y: deltaY * scale };
    } else {
      this.moveTouchDelta = { x: deltaX, y: deltaY };
    }
    if (this.moveTouchId === null) {
      this.moveTouchId = 1;
    }
  }

  /**
   * Programmatic touch swipe look helper.
   */
  public applyTouchSwipe(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.touchLookSensitivity;
    this.pitch -= deltaY * this.touchLookSensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Smoothly updates FOV zoom interpolation (works in both FPV and Auto Wander).
   */
  public updateFov(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    if (dt <= 0) return;
    if (Math.abs(this.camera.fov - this.targetFov) > 0.02) {
      const fovLerp = 1 - Math.exp(-12.0 * dt);
      this.camera.fov += (this.targetFov - this.camera.fov) * fovLerp;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Requests desktop Pointer Lock.
   */
  public lock(): void {
    if (this.domElement && typeof this.domElement.requestPointerLock === 'function') {
      try {
        const result = this.domElement.requestPointerLock() as unknown;
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => {});
        }
      } catch (err) {
        console.warn('Pointer lock request error:', err);
      }
    }
  }

  /**
   * Exits desktop Pointer Lock and resets mouse engagement/drag state.
   */
  public unlock(): void {
    const wasLocked = this.isLocked;
    const wasDragging = this.isDragging;
    if (typeof document !== 'undefined' && typeof document.exitPointerLock === 'function') {
      try {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      } catch (err) {
        console.warn('Pointer lock exit error:', err);
      }
    }
    this.isLocked = false;
    this.isCanvasEngaged = false;
    this.isDragging = false;
    this.dragMoved = false;
    this.dragStartPos = null;
    this.lastMousePos = null;
    if (wasLocked) this.onLockChange?.(false);
    if (wasDragging) this.onDragChange?.(false);
  }

  private resetAllInputs(): void {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.yawLeft = false;
    this.yawRight = false;
    this.isSprinting = false;
    const wasDragging = this.isDragging;
    this.isDragging = false;
    this.dragMoved = false;
    this.dragStartPos = null;
    this.isCanvasEngaged = false;
    this.lastMousePos = null;
    if (wasDragging) this.onDragChange?.(false);
  }

  private attachEventListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Keyboard listeners
    this.onKeyDownBound = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = true;
          break;
        case 'KeyQ':
          this.yawLeft = true;
          this.onManualLookStart?.();
          break;
        case 'KeyE':
          this.yawRight = true;
          this.onManualLookStart?.();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = true;
          break;
        case 'Escape':
          this.isCanvasEngaged = false;
          this.lastMousePos = null;
          if (this.isDragging) {
            this.isDragging = false;
            this.dragMoved = false;
            this.dragStartPos = null;
            this.onDragChange?.(false);
          }
          break;
      }
    };

    this.onKeyUpBound = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveForward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveBackward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveRight = false;
          break;
        case 'KeyQ':
          this.yawLeft = false;
          break;
        case 'KeyE':
          this.yawRight = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
      }
    };

    this.onWindowBlurBound = () => {
      this.resetAllInputs();
    };

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onWindowBlurBound);

    // 2. Mouse Drag 360°, Canvas Click Engage, Wheel Zoom & Pointer Lock listeners
    this.onMouseDownBound = (e: MouseEvent) => {
      if (this.isLocked || e.button !== 0) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.suppressNextClick = false;
      this.dragStartPos = { x: e.clientX, y: e.clientY };
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.onDragChange?.(true);
    };

    this.onDocMouseDownBound = (e: MouseEvent) => {
      if (!this.domElement) return;
      const target = e.target as Node | null;
      if (target && !this.domElement.contains(target)) {
        this.isCanvasEngaged = false;
        this.lastMousePos = null;
      }
    };

    this.onDomClickBound = (e: MouseEvent) => {
      if (this.isLocked) return;
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
      this.isCanvasEngaged = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };

    this.onDomDblClickBound = () => {
      this.lock();
    };

    this.onPointerLockChangeBound = () => {
      const nextLocked = document.pointerLockElement === this.domElement;
      const changed = nextLocked !== this.isLocked;
      this.isLocked = nextLocked;
      if (!nextLocked) {
        this.isCanvasEngaged = false;
        this.lastMousePos = null;
      }
      if (changed) {
        this.onLockChange?.(nextLocked);
      }
    };

    this.onPointerLockErrorBound = () => {
      if (this.isLocked) {
        this.isLocked = false;
        this.onLockChange?.(false);
      }
    };

    this.onMouseMoveBound = (e: MouseEvent) => {
      if (this.isLocked) {
        const mvX = e.movementX || 0;
        const mvY = e.movementY || 0;
        if (mvX !== 0 || mvY !== 0) {
          this.emitLookDelta(mvX, mvY, 'mouse', this.mouseSensitivity);
        }
        return;
      }

      if (this.isDragging) {
        const dx = this.lastMousePos ? e.clientX - this.lastMousePos.x : (e.movementX ?? 0);
        const dy = this.lastMousePos ? e.clientY - this.lastMousePos.y : (e.movementY ?? 0);
        this.lastMousePos = { x: e.clientX, y: e.clientY };

        if (!this.dragMoved && this.dragStartPos) {
          const movedDist = Math.hypot(
            e.clientX - this.dragStartPos.x,
            e.clientY - this.dragStartPos.y
          );
          if (movedDist >= 4) {
            this.dragMoved = true;
            this.suppressNextClick = true;
          }
        }

        if (dx !== 0 || dy !== 0) {
          this.emitLookDelta(dx, dy, 'drag', this.dragSensitivity);
        }
        return;
      }

      if (this.isCanvasEngaged) {
        let dx = this.lastMousePos ? e.clientX - this.lastMousePos.x : (e.movementX ?? 0);
        let dy = this.lastMousePos ? e.clientY - this.lastMousePos.y : (e.movementY ?? 0);
        if (dx === 0 && dy === 0 && (e.movementX || e.movementY)) {
          dx = e.movementX ?? 0;
          dy = e.movementY ?? 0;
        }
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        if (dx !== 0 || dy !== 0) {
          this.emitLookDelta(dx, dy, 'mouse', this.mouseSensitivity);
        }
      }
    };

    this.onMouseUpBound = () => {
      if (!this.isDragging) return;
      const wasDrag = this.dragMoved;
      this.isDragging = false;
      this.dragStartPos = null;
      this.dragMoved = false;
      this.onDragChange?.(false);

      if (wasDrag) {
        // Release hover engagement after a drag so repositioning the cursor doesn't spin back
        this.isCanvasEngaged = false;
        this.lastMousePos = null;
        this.suppressNextClick = true;
        if (this.suppressClickTimer !== null) {
          clearTimeout(this.suppressClickTimer);
        }
        this.suppressClickTimer = setTimeout(() => {
          this.suppressNextClick = false;
          this.suppressClickTimer = null;
        }, 0);
      }
    };

    this.onWheelBound = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 0.01) return;
      e.preventDefault();
      this.targetFov = Math.max(
        this.minFov,
        Math.min(this.maxFov, this.targetFov + e.deltaY * 0.03)
      );
    };

    if (this.domElement) {
      this.domElement.addEventListener('mousedown', this.onMouseDownBound);
      this.domElement.addEventListener('click', this.onDomClickBound);
      this.domElement.addEventListener('dblclick', this.onDomDblClickBound);
      this.domElement.addEventListener('wheel', this.onWheelBound, { passive: false });
    }
    document.addEventListener('mousedown', this.onDocMouseDownBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.addEventListener('pointerlockerror', this.onPointerLockErrorBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mouseup', this.onMouseUpBound);

    // 3. Mobile Touch listeners
    const targetElement = this.domElement || window;

    this.onTouchStartBound = (e: TouchEvent) => {
      const rect = this.domElement
        ? this.domElement.getBoundingClientRect()
        : { left: 0, width: window.innerWidth };
      const halfWidth = rect.width / 2;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const localX = touch.clientX - rect.left;

        if (!this.touchFullZoneLook && localX < halfWidth) {
          // Left half in FPV: movement thumbstick
          if (this.moveTouchId === null) {
            this.moveTouchId = touch.identifier;
            this.moveTouchOrigin = { x: touch.clientX, y: touch.clientY };
            this.moveTouchDelta = { x: 0, y: 0 };
          }
        } else {
          // Right half (or anywhere in Auto Wander): 360° swipe look
          if (this.lookTouchId === null) {
            this.lookTouchId = touch.identifier;
            this.lookTouchPrevious = { x: touch.clientX, y: touch.clientY };
          }
        }
      }
    };

    this.onTouchMoveBound = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === this.moveTouchId && this.moveTouchOrigin) {
          const dx = touch.clientX - this.moveTouchOrigin.x;
          const dy = touch.clientY - this.moveTouchOrigin.y;
          this.setTouchThumbstick(dx, dy);
        } else if (touch.identifier === this.lookTouchId && this.lookTouchPrevious) {
          const dx = touch.clientX - this.lookTouchPrevious.x;
          const dy = touch.clientY - this.lookTouchPrevious.y;
          this.emitLookDelta(dx, dy, 'touch', this.touchLookSensitivity);
          this.lookTouchPrevious = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    this.onTouchEndBound = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.moveTouchId) {
          this.moveTouchId = null;
          this.moveTouchOrigin = null;
          this.moveTouchDelta = { x: 0, y: 0 };
        } else if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
          this.lookTouchPrevious = null;
        }
      }
    };

    targetElement.addEventListener('touchstart', this.onTouchStartBound as EventListener, { passive: true });
    window.addEventListener('touchmove', this.onTouchMoveBound as EventListener, { passive: true });
    window.addEventListener('touchend', this.onTouchEndBound as EventListener, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEndBound as EventListener, { passive: true });
  }

  /**
   * Updates kinematic physics, Q/E yaw rotation, FOV zoom, terrain clamping, and boundary limits.
   * @param deltaTime Elapsed seconds since last frame
   * @param space Active space conforming to ISpace
   */
  public update(deltaTime: number, space?: ISpace): void {
    // Clamp delta time to avoid large jumps on tab switch / lag
    const dt = Math.min(deltaTime, 0.1);
    if (dt <= 0) return;

    // 0. Smooth Q/E keyboard 360° yaw rotation & FOV zoom
    const yawInput = (this.yawLeft ? 1 : 0) - (this.yawRight ? 1 : 0);
    if (yawInput !== 0) {
      this.yaw += yawInput * this.keyYawSpeed * dt;
    }
    this.updateFov(dt);

    // 1. Gather input vector in local space
    let inputForward = (this.moveForward ? 1 : 0) - (this.moveBackward ? 1 : 0);
    let inputRight = (this.moveRight ? 1 : 0) - (this.moveLeft ? 1 : 0);

    // Merge mobile virtual thumbstick input
    if (this.moveTouchId !== null && this.thumbstickRadius > 0) {
      inputRight += this.moveTouchDelta.x / this.thumbstickRadius;
      inputForward += -this.moveTouchDelta.y / this.thumbstickRadius; // Negative Y on screen is up (forward)
    }

    // Normalize input vector if magnitude > 1.0
    const inputMagnitude = Math.hypot(inputRight, inputForward);
    if (inputMagnitude > 1.0) {
      inputRight /= inputMagnitude;
      inputForward /= inputMagnitude;
    }

    // 2. Transform local input to world direction based on camera yaw
    // In Three.js with 'YXZ' rotation, looking along -Z when yaw=0:
    // Forward direction in world XZ: (-sin(yaw), 0, -cos(yaw))
    // Right direction in world XZ: (cos(yaw), 0, -sin(yaw))
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    const worldForwardX = -sinY;
    const worldForwardZ = -cosY;
    const worldRightX = cosY;
    const worldRightZ = -sinY;

    const moveDirX = worldForwardX * inputForward + worldRightX * inputRight;
    const moveDirZ = worldForwardZ * inputForward + worldRightZ * inputRight;

    // 3. Damped Kinematic Motion Model
    const currentMaxSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

    if (inputMagnitude > 0) {
      this.elevatedPerchY = null;
      // Accelerate along desired movement direction
      this.velocity.x += moveDirX * this.acceleration * dt;
      this.velocity.z += moveDirZ * this.acceleration * dt;

      // Clamp horizontal velocity to currentMaxSpeed
      const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (currentSpeed > currentMaxSpeed) {
        const scale = currentMaxSpeed / currentSpeed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    } else {
      // Smooth coast-to-stop deceleration via friction coefficient (8.0 s^-1)
      const frictionFactor = Math.exp(-this.friction * dt);
      this.velocity.x *= frictionFactor;
      this.velocity.z *= frictionFactor;

      // Zero out tiny velocity jitter
      if (Math.hypot(this.velocity.x, this.velocity.z) < 0.001) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    // 4. Update horizontal position
    let posX = this.camera.position.x + this.velocity.x * dt;
    let posZ = this.camera.position.z + this.velocity.z * dt;

    // 5. Circular perimeter soft-spring boundary constraint
    if (space?.getWanderBounds) {
      const bounds = space.getWanderBounds();
      const centerX = bounds.center ? bounds.center.x : 0;
      const centerZ = bounds.center ? bounds.center.z : 0;
      const radius = bounds.radius > 0 ? bounds.radius : 50;

      const dx = posX - centerX;
      const dz = posZ - centerZ;
      const dist = Math.hypot(dx, dz);

      if (dist > radius) {
        const overflow = Math.min(dist - radius, 5.0);
        const nx = dx / dist;
        const nz = dz / dist;

        // Apply soft-spring boundary constraint
        posX = centerX + nx * radius + nx * overflow * Math.exp(-10.0 * dt);
        posZ = centerZ + nz * radius + nz * overflow * Math.exp(-10.0 * dt);

        // Cancel outward radial velocity
        const radialVel = this.velocity.x * nx + this.velocity.z * nz;
        if (radialVel > 0) {
          this.velocity.x -= radialVel * nx;
          this.velocity.z -= radialVel * nz;
        }
      }
    }

    // 6. Dual-tier Ground Elevation Clamping
    const groundHeight = space?.getGroundHeight ? space.getGroundHeight(posX, posZ) : 0;
    const baseElevation = groundHeight + this.eyeHeight;
    const targetElevation =
      this.elevatedPerchY !== null ? Math.max(this.elevatedPerchY, baseElevation) : baseElevation;
    const minEyeFloor = groundHeight + (this.eyeHeight - 0.1);

    // Exponential vertical smoothing: y(t+dt) = y(t) + (y_target - y(t)) * (1 - exp(-lambda * dt))
    const currentY = this.camera.position.y;
    const dampingFactor = 1 - Math.exp(-this.elevationLambda * dt);
    const posY = Math.max(minEyeFloor, currentY + (targetElevation - currentY) * dampingFactor);

    // Apply updated coordinates and rotation to camera
    this.camera.position.set(posX, posY, posZ);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Cleans up all event listeners and resets states.
   */
  public dispose(): void {
    this.unlock();
    if (this.suppressClickTimer !== null) {
      clearTimeout(this.suppressClickTimer);
      this.suppressClickTimer = null;
    }

    if (typeof window !== 'undefined') {
      if (this.onKeyDownBound) window.removeEventListener('keydown', this.onKeyDownBound);
      if (this.onKeyUpBound) window.removeEventListener('keyup', this.onKeyUpBound);
      if (this.onWindowBlurBound) window.removeEventListener('blur', this.onWindowBlurBound);
      if (this.onMouseUpBound) window.removeEventListener('mouseup', this.onMouseUpBound);
      if (this.onTouchMoveBound) window.removeEventListener('touchmove', this.onTouchMoveBound as EventListener);
      if (this.onTouchEndBound) window.removeEventListener('touchend', this.onTouchEndBound as EventListener);
      if (this.onTouchEndBound) window.removeEventListener('touchcancel', this.onTouchEndBound as EventListener);
    }

    if (typeof document !== 'undefined') {
      if (this.onDocMouseDownBound) document.removeEventListener('mousedown', this.onDocMouseDownBound);
      if (this.onPointerLockChangeBound) document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
      if (this.onPointerLockErrorBound) document.removeEventListener('pointerlockerror', this.onPointerLockErrorBound);
      if (this.onMouseMoveBound) document.removeEventListener('mousemove', this.onMouseMoveBound);
    }

    if (this.domElement) {
      if (this.onMouseDownBound) this.domElement.removeEventListener('mousedown', this.onMouseDownBound);
      if (this.onDomClickBound) this.domElement.removeEventListener('click', this.onDomClickBound);
      if (this.onDomDblClickBound) this.domElement.removeEventListener('dblclick', this.onDomDblClickBound);
      if (this.onWheelBound) this.domElement.removeEventListener('wheel', this.onWheelBound);
      if (this.onTouchStartBound) this.domElement.removeEventListener('touchstart', this.onTouchStartBound as EventListener);
    }

    this.onKeyDownBound = null;
    this.onKeyUpBound = null;
    this.onWindowBlurBound = null;
    this.onMouseDownBound = null;
    this.onDocMouseDownBound = null;
    this.onMouseMoveBound = null;
    this.onMouseUpBound = null;
    this.onWheelBound = null;
    this.onPointerLockChangeBound = null;
    this.onPointerLockErrorBound = null;
    this.onTouchStartBound = null;
    this.onTouchMoveBound = null;
    this.onTouchEndBound = null;
    this.onDomClickBound = null;
    this.onDomDblClickBound = null;
    this.touchFullZoneLook = false;
    this.onLookInput = undefined;
    this.onManualLookStart = undefined;
    this.onLockChange = undefined;
    this.onDragChange = undefined;
  }
}
