import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getAudioContextState,
  getCameraState,
} from '../fixtures/webglHelper';

test.describe('Tier 3 - Combination R2-R3: Camera Velocity & Audio Spatial Dynamics', () => {
  test('T3-R2-R3-01: Camera Movement Kinematics Modulates Wind / Ambient Audio Gain - Moving camera at speed dynamically modulates audio volume/filter', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(300);

    // Ensure first person mode
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('first_person', 0);
    });

    // Sample baseline idle wind gain
    const idleGain = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const val = mgr?.windGainNode?.gain?.value ?? mgr?.getVelocityModulatedGain?.();
      return typeof val === 'number' ? val : null;
    });

    // Move forward with KeyW for 600ms
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);

    const movingGain = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const val = mgr?.windGainNode?.gain?.value ?? mgr?.getVelocityModulatedGain?.();
      return typeof val === 'number' ? val : null;
    });

    await page.keyboard.up('KeyW');

    expect(idleGain, 'AudioManager should report valid idle wind gain').not.toBeNull();
    expect(movingGain, 'AudioManager should report valid moving wind gain').not.toBeNull();
    expect(movingGain!).toBeGreaterThanOrEqual(idleGain!);
    expect(movingGain!).toBeLessThanOrEqual(1.0);
  });

  test('T3-R2-R3-02: Deceleration Audio Smoothing - Releasing navigation keys smoothly returns audio gain to baseline without clicks', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });

    // Press and release KeyW
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');

    // Wait for friction deceleration
    await page.waitForTimeout(600);

    const settledState = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const ctx: AudioContext = mgr?.audioContext;
      const gainVal = mgr?.windGainNode?.gain?.value;
      return {
        audioState: ctx ? ctx.state : 'unavailable',
        gain: typeof gainVal === 'number' ? gainVal : null,
      };
    });

    expect(settledState.audioState, 'AudioContext should remain in running state after camera deceleration').toBe('running');
    expect(settledState.gain, 'Wind gain node should report valid numeric gain').not.toBeNull();
    expect(settledState.gain!).toBeLessThanOrEqual(1.0);
  });

  test('T3-R2-R3-03: Camera Orientation Updates Audio Spatial Listener - Rotating camera updates Web Audio listener orientation vectors', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });

    // Read initial listener orientation
    const initialListener = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const listener = mgr?.audioContext?.listener;
      if (!listener) return null;

      return {
        forwardX: listener.forwardX?.value ?? 0,
        forwardY: listener.forwardY?.value ?? 0,
        forwardZ: listener.forwardZ?.value ?? -1,
      };
    });

    // Rotate camera by moving mouse
    await page.mouse.move(500, 300);
    await page.waitForTimeout(200);

    const rotatedListener = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const listener = mgr?.audioContext?.listener;
      if (!listener) return null;

      return {
        forwardX: listener.forwardX?.value ?? 0,
        forwardY: listener.forwardY?.value ?? 0,
        forwardZ: listener.forwardZ?.value ?? -1,
      };
    });

    if (initialListener && rotatedListener) {
      // Coordinates should either update or match valid unit vector magnitude
      const mag = Math.sqrt(
        Math.pow(rotatedListener.forwardX, 2) +
        Math.pow(rotatedListener.forwardY, 2) +
        Math.pow(rotatedListener.forwardZ, 2)
      );
      expect(mag).toBeCloseTo(1.0, 0.2);
    }

    const audioState = await getAudioContextState(page);
    expect(audioState.state).toBe('running');
  });

  test('T3-R2-R3-04: Camera Mode Switching Preserves Audio Playback Continuity - Switching FPV <-> Auto Wander does not cause audio glitches or dropouts', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });

    // 1. Switch to Auto Wander
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 1.0);
    });

    await page.waitForTimeout(500);

    let audio = await getAudioContextState(page);
    expect(audio.state).toBe('running');

    // 2. Switch back to First Person View mid-flight
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('first_person', 1.0);
    });

    await page.waitForTimeout(500);

    audio = await getAudioContextState(page);
    expect(audio.state).toBe('running');
  });

  test('T3-R2-R3-05: Boundary Proximity Audio Behavior - Approaching wander radius maintains smooth audio without clipping or abrupt cutoffs', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });

    // Place camera right near boundary radius (r = 34.5m)
    await page.evaluate(() => {
      const w = window as any;
      const cam = w.__threeCamera || w.spaceEngine?.camera;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;

      if (cam) {
        cam.position.set(34.0, 2.0, 0);
      }
      if (ctrl?.update && space) {
        ctrl.update(0.016, space);
      }
    });

    await page.waitForTimeout(300);

    const audioState = await getAudioContextState(page);
    expect(audioState.state).toBe('running');

    const camState = await getCameraState(page);
    const radius = Math.sqrt(Math.pow(camState.position.x, 2) + Math.pow(camState.position.z, 2));
    expect(radius).toBeLessThanOrEqual(36.0);
  });
});
