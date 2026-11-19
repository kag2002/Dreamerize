import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FPVController } from '../../src/client/scene/camera/FPVController';
import { WanderController } from '../../src/client/scene/camera/WanderController';
import {
  TransitionCoordinator,
  quinticSmootherstep,
  shortestAngleDifference
} from '../../src/client/scene/camera/TransitionCoordinator';
import { CameraController } from '../../src/client/scene/camera/CameraController';
import { ISpace } from '../../src/client/scene/ISpace';

function createMockSpace(groundHeightFn?: (x: number, z: number) => number): ISpace {
  return {
    id: 'mock-space',
    name: 'Mock Space',
    slug: 'mock-space',
    init: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    render: vi.fn(),
    updateConfig: vi.fn(),
    dispose: vi.fn(),
    getGroundHeight: groundHeightFn ?? vi.fn().mockImplementation((x: number, z: number) => {
      // Gentle slope
      return 0.1 * x;
    }),
    getSpawnPoint: vi.fn().mockReturnValue({
      position: new THREE.Vector3(0, 1.7, 0),
      lookAt: new THREE.Vector3(0, 1.7, -10)
    }),
    getWanderBounds: vi.fn().mockReturnValue({
      radius: 50,
      center: new THREE.Vector3(0, 0, 0)
    }),
    getPointsOfInterest: vi.fn().mockReturnValue([
      { name: 'POI 1', position: new THREE.Vector3(10, 5, -10), dwellTime: 0.1 },
      { name: 'POI 2', position: new THREE.Vector3(-15, 8, -20), dwellTime: 0.1 }
    ])
  };
}

describe('Camera Navigation System', () => {
  describe('FPVController', () => {
    let camera: THREE.PerspectiveCamera;
    let mockSpace: ISpace;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(60, 1.33, 0.1, 1000);
      camera.position.set(0, 1.7, 0);
      mockSpace = createMockSpace();
    });

    it('enforces Euler rotation order YXZ to prevent Gimbal Lock', () => {
      const controller = new FPVController(camera);
      expect(camera.rotation.order).toBe('YXZ');
      controller.dispose();
    });

    it('accelerates forward from rest and clamps to walk speed', () => {
      const controller = new FPVController(camera);
      controller.setInputs({ forward: true });

      // Simulate 1.0 second of acceleration with dt = 0.05
      for (let i = 0; i < 20; i++) {
        controller.update(0.05, mockSpace);
      }

      const velocity = controller.getVelocity();
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);

      expect(horizontalSpeed).toBeGreaterThan(3.0);
      expect(horizontalSpeed).toBeLessThanOrEqual(controller.walkSpeed + 0.001);
      controller.dispose();
    });

    it('accelerates up to sprint speed (1.75x walk speed) when sprinting', () => {
      const controller = new FPVController(camera);
      controller.setInputs({ forward: true, sprint: true });

      for (let i = 0; i < 30; i++) {
        controller.update(0.05, mockSpace);
      }

      const velocity = controller.getVelocity();
      const speed = Math.hypot(velocity.x, velocity.z);

      expect(controller.sprintSpeed).toBeCloseTo(7.0, 1);
      expect(speed).toBeGreaterThan(controller.walkSpeed);
      expect(speed).toBeLessThanOrEqual(controller.sprintSpeed + 0.001);
      controller.dispose();
    });

    it('decelerates smoothly via friction when movement inputs are released', () => {
      const controller = new FPVController(camera);
      controller.setInputs({ forward: true });

      for (let i = 0; i < 20; i++) {
        controller.update(0.05, mockSpace);
      }
      const initialSpeed = Math.hypot(controller.getVelocity().x, controller.getVelocity().z);
      expect(initialSpeed).toBeGreaterThan(2.0);

      // Release inputs
      controller.setInputs({ forward: false });
      for (let i = 0; i < 15; i++) {
        controller.update(0.05, mockSpace);
      }

      const stoppedSpeed = Math.hypot(controller.getVelocity().x, controller.getVelocity().z);
      expect(stoppedSpeed).toBeLessThan(0.01);
      controller.dispose();
    });

    it('clamps pitch strictly within [-85 deg, +85 deg] ([-1.4835, 1.4835] rad)', () => {
      const controller = new FPVController(camera);

      // Apply extreme pitch upwards
      controller.applyMouseDelta(0, -50000);
      expect(controller.getPitch()).toBeLessThanOrEqual(controller.maxPitch);
      expect(controller.getPitch()).toBeCloseTo(controller.maxPitch, 4);

      // Apply extreme pitch downwards
      controller.applyMouseDelta(0, 100000);
      expect(controller.getPitch()).toBeGreaterThanOrEqual(controller.minPitch);
      expect(controller.getPitch()).toBeCloseTo(controller.minPitch, 4);

      controller.dispose();
    });

    it('handles mobile dual-zone touch controls (clamped thumbstick & swipe look)', () => {
      const controller = new FPVController(camera);

      // Thumbstick clamped to 45px radius
      controller.setTouchThumbstick(100, -100); // 45-degree angle displaced far
      controller.update(0.05, mockSpace);

      const vel = controller.getVelocity();
      expect(Math.hypot(vel.x, vel.z)).toBeGreaterThan(0.5);

      // Touch swipe look
      const initialYaw = controller.getYaw();
      controller.applyTouchSwipe(50, 20);
      expect(controller.getYaw()).not.toBe(initialYaw);

      controller.dispose();
    });

    it('clamps ground elevation to h(x, z) + 1.7m with exponential smoothing', () => {
      // Step terrain: h = 5.0m
      const stepSpace = createMockSpace(() => 5.0);
      camera.position.set(0, 1.7, 0); // Initially at y = 1.7

      const controller = new FPVController(camera);
      // Target elevation is 5.0 + 1.7 = 6.7m
      expect(camera.position.y).toBe(1.7);

      // Step forward with exponential damping lambda = 10.0
      controller.update(0.1, stepSpace);
      expect(camera.position.y).toBeGreaterThan(1.7);
      expect(camera.position.y).toBeLessThan(6.7);

      // Simulate settling
      for (let i = 0; i < 20; i++) {
        controller.update(0.1, stepSpace);
      }
      expect(camera.position.y).toBeCloseTo(6.7, 2);

      controller.dispose();
    });

    it('enforces circular perimeter soft-spring boundary constraint', () => {
      const controller = new FPVController(camera);
      // Place camera outside wander boundary (radius = 50)
      controller.setPosition(70, 1.7, 0);

      // Update frame
      controller.update(0.1, mockSpace);

      // Position should be pulled inward toward boundary radius 50
      expect(camera.position.x).toBeLessThan(70);
      expect(camera.position.x).toBeGreaterThanOrEqual(50);

      controller.dispose();
    });
  });

  describe('WanderController', () => {
    let camera: THREE.PerspectiveCamera;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(60, 1.33, 0.1, 1000);
      camera.position.set(0, 10, 0);
    });

    it('maintains steady cruising speed between 3.5 and 5.0 m/s', () => {
      const mockSpace = createMockSpace();
      const wander = new WanderController(camera, { cruiseSpeed: 4.2 });

      for (let i = 0; i < 30; i++) {
        wander.update(0.05, mockSpace);
        const vel = wander.getVelocity();
        const speed = Math.hypot(vel.x, vel.z);
        expect(speed).toBeCloseTo(4.2, 1);
      }

      wander.dispose();
    });

    it('guarantees terrain clearance >= 3.0m under steep elevation changes (zero clipping)', () => {
      // Steep hill peaking at y = 15m
      const hillSpace = createMockSpace((x, z) => {
        return Math.max(0, 15 - 0.05 * (x * x + z * z));
      });

      // Spawn at hill base
      camera.position.set(0, 5, 0); // hill height at 0,0 is 15m, camera starts lower!
      const wander = new WanderController(camera, { cruiseSpeed: 4.5, minClearance: 3.0 });

      // Update frame: should immediately apply lift impulse and enforce >= 3.0m clearance
      wander.update(0.05, hillSpace);

      const groundAtPos = hillSpace.getGroundHeight(camera.position.x, camera.position.z);
      const clearance = camera.position.y - groundAtPos;
      expect(clearance).toBeGreaterThanOrEqual(3.0);

      // Simulate sustained flight over 100 frames
      for (let i = 0; i < 100; i++) {
        wander.update(0.05, hillSpace);
        const h = hillSpace.getGroundHeight(camera.position.x, camera.position.z);
        expect(camera.position.y - h).toBeGreaterThanOrEqual(3.0 - 0.0001);
      }

      wander.dispose();
    });

    it('calculates aerodynamic banking roll proportional to yaw rate, clamped to [-0.12, 0.12] rad', () => {
      const mockSpace = createMockSpace();
      const wander = new WanderController(camera, { maxRoll: 0.12 });

      for (let i = 0; i < 50; i++) {
        wander.update(0.05, mockSpace);
        expect(Math.abs(wander.getRoll())).toBeLessThanOrEqual(0.12 + 0.001);
      }

      wander.dispose();
    });

    it('cycles through scenic Points of Interest (POIs)', () => {
      const mockSpace = createMockSpace();
      const wander = new WanderController(camera);

      expect(wander.getCurrentPoiIndex()).toBe(0);

      // Simulate flight time exceeding dwell duration (mock dwellTime = 0.1s)
      for (let i = 0; i < 10; i++) {
        wander.update(0.05, mockSpace);
      }

      expect(wander.getCurrentPoiIndex()).toBe(1);
      wander.dispose();
    });
  });

  describe('TransitionCoordinator & Quintic Smootherstep', () => {
    it('evaluates quintic smootherstep s(t) = 6t^5 - 15t^4 + 10t^3 with C2 continuity', () => {
      expect(quinticSmootherstep(0)).toBe(0);
      expect(quinticSmootherstep(1)).toBe(1);
      expect(quinticSmootherstep(0.5)).toBe(0.5);

      // Monotonically increasing
      let previous = -1;
      for (let t = 0; t <= 1.0; t += 0.05) {
        const val = quinticSmootherstep(t);
        expect(val).toBeGreaterThanOrEqual(previous);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
        previous = val;
      }

      // Clamping outside [0, 1]
      expect(quinticSmootherstep(-0.5)).toBe(0);
      expect(quinticSmootherstep(1.5)).toBe(1);
    });

    it('computes shortest angular difference correctly across wrap boundaries', () => {
      // Difference between +170 deg and -170 deg is +20 deg (0.349 rad), not 340 deg
      const deg170 = (170 * Math.PI) / 180;
      const degNeg170 = (-170 * Math.PI) / 180;

      const diff = shortestAngleDifference(deg170, degNeg170);
      expect(diff).toBeCloseTo((20 * Math.PI) / 180, 4);
    });

    it('smoothly coordinates 2.0s transition from pose A to pose B and fires onComplete', () => {
      const coordinator = new TransitionCoordinator();
      const onComplete = vi.fn();

      const fromPose = {
        position: new THREE.Vector3(0, 1.7, 0),
        yaw: 0,
        pitch: 0,
        roll: 0
      };

      const toPose = {
        position: new THREE.Vector3(10, 8, -20),
        yaw: Math.PI / 2,
        pitch: -0.2,
        roll: 0.1
      };

      coordinator.startTransition(fromPose, toPose, 2.0, onComplete);
      expect(coordinator.isActive()).toBe(true);
      expect(coordinator.getProgress()).toBe(0);

      // Midpoint update (t = 1.0s)
      const midPose = coordinator.update(1.0);
      expect(midPose).not.toBeNull();
      expect(midPose!.position.x).toBeCloseTo(5.0, 1);
      expect(coordinator.getProgress()).toBeCloseTo(0.5, 2);
      expect(onComplete).not.toHaveBeenCalled();

      // Completion update (t = 1.0s more)
      const endPose = coordinator.update(1.0);
      expect(endPose).not.toBeNull();
      expect(endPose!.position.x).toBeCloseTo(10.0, 2);
      expect(endPose!.position.y).toBeCloseTo(8.0, 2);
      expect(endPose!.position.z).toBeCloseTo(-20.0, 2);
      expect(coordinator.isActive()).toBe(false);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('CameraController (Unified)', () => {
    let camera: THREE.PerspectiveCamera;
    let mockSpace: ISpace;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(60, 1.33, 0.1, 1000);
      camera.position.set(0, 1.7, 0);
      mockSpace = createMockSpace();
    });

    it('initializes in first_person mode and exposes controllers', () => {
      const controller = new CameraController(camera, null);
      expect(controller.mode).toBe('first_person');
      expect(controller.getFPVController()).toBeDefined();
      expect(controller.getWanderController()).toBeDefined();
      expect(controller.getTransitionCoordinator()).toBeDefined();
      controller.dispose();
    });

    it('initiates seamless transition when switching mode to auto_wander', () => {
      const controller = new CameraController(camera, null);
      expect(controller.mode).toBe('first_person');

      controller.setMode('auto_wander', 2.0);
      expect(controller.getTransitionCoordinator().isActive()).toBe(true);

      // Update frame during transition
      controller.update(1.0, mockSpace);
      expect(controller.getTransitionCoordinator().isActive()).toBe(true);

      // Complete transition
      controller.update(1.05, mockSpace);
      expect(controller.getTransitionCoordinator().isActive()).toBe(false);
      expect(controller.mode).toBe('auto_wander');

      // Update in wander mode
      controller.update(0.05, mockSpace);
      expect(controller.mode).toBe('auto_wander');

      controller.dispose();
    });

    it('switches back to first_person with transition', () => {
      const controller = new CameraController(camera, null, { initialMode: 'auto_wander' });
      expect(controller.mode).toBe('auto_wander');

      controller.setMode('first_person', 1.0);
      expect(controller.getTransitionCoordinator().isActive()).toBe(true);

      controller.update(1.1, mockSpace);
      expect(controller.getTransitionCoordinator().isActive()).toBe(false);
      expect(controller.mode).toBe('first_person');

      controller.dispose();
    });

    it('supports immediate mode switch when duration is 0', () => {
      const controller = new CameraController(camera, null);
      expect(controller.mode).toBe('first_person');

      controller.setMode('auto_wander', 0);
      expect(controller.getTransitionCoordinator().isActive()).toBe(false);
      expect(controller.mode).toBe('auto_wander');

      controller.dispose();
    });
  });
});
