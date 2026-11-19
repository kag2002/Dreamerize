import { Page } from '@playwright/test';

export interface WebGLContextInfo {
  hasContext: boolean;
  glVersion: string;
  vendor: string;
  renderer: string;
  isWebGL2: boolean;
}

export interface ThreeMemoryInfo {
  geometries: number;
  textures: number;
}

export interface ThreeRenderInfo {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  frame: number;
}

export interface AudioContextInfo {
  state: 'suspended' | 'running' | 'closed' | 'unavailable';
  sampleRate: number;
  volume?: number;
  isMuted?: boolean;
}

export interface FFTEnergyInfo {
  bass: number;
  mid: number;
  treble: number;
}

export interface CameraStateInfo {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  mode?: 'first_person' | 'auto_wander' | string;
}

/**
 * Checks whether the page canvas has initialized WebGL 2.0 (or WebGL)
 */
export async function checkWebGLContext(
  page: Page,
  canvasSelector = '#space-canvas, canvas'
): Promise<WebGLContextInfo> {
  return await page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector);
    if (!canvas) {
      return {
        hasContext: false,
        glVersion: '',
        vendor: '',
        renderer: '',
        isWebGL2: false,
      };
    }

    const gl2 = canvas.getContext('webgl2');
    const gl = (gl2 || canvas.getContext('webgl') || (canvas as any).getContext('experimental-webgl')) as (WebGLRenderingContext | WebGL2RenderingContext | null);

    if (!gl) {
      return {
        hasContext: false,
        glVersion: '',
        vendor: '',
        renderer: '',
        isWebGL2: false,
      };
    }

    const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbgRenderInfo ? gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbgRenderInfo ? gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const glVersion = gl.getParameter(gl.VERSION);

    return {
      hasContext: true,
      glVersion: String(glVersion),
      vendor: String(vendor),
      renderer: String(renderer),
      isWebGL2: !!gl2,
    };
  }, canvasSelector);
}

/**
 * Waits until the canvas is mounted and WebGL rendering context is initialized
 */
export async function waitForCanvasReady(
  page: Page,
  canvasSelector = '#space-canvas, canvas',
  timeout = 10000
): Promise<void> {
  await page.waitForSelector(canvasSelector, { state: 'visible', timeout });
  await page.waitForFunction(
    (selector) => {
      const c = document.querySelector<HTMLCanvasElement>(selector);
      if (!c) return false;
      const ctx = c.getContext('webgl2') || c.getContext('webgl');
      return !!ctx;
    },
    canvasSelector,
    { timeout }
  );
}

/**
 * Inspects Three.js memory allocations (geometries & textures)
 */
export async function getThreeMemoryInfo(page: Page): Promise<ThreeMemoryInfo> {
  return await page.evaluate(() => {
    const w = window as any;
    const renderer = w.__threeRenderer || w.spaceEngine?.renderer || w.__spaceEngine?.renderer;
    if (renderer?.info?.memory) {
      return {
        geometries: Number(renderer.info.memory.geometries || 0),
        textures: Number(renderer.info.memory.textures || 0),
      };
    }
    return { geometries: 0, textures: 0 };
  });
}

/**
 * Inspects Three.js render call statistics
 */
export async function getThreeRenderInfo(page: Page): Promise<ThreeRenderInfo> {
  return await page.evaluate(() => {
    const w = window as any;
    const renderer = w.__threeRenderer || w.spaceEngine?.renderer || w.__spaceEngine?.renderer;
    if (renderer?.info?.render) {
      return {
        calls: Number(renderer.info.render.calls || 0),
        triangles: Number(renderer.info.render.triangles || 0),
        points: Number(renderer.info.render.points || 0),
        lines: Number(renderer.info.render.lines || 0),
        frame: Number(renderer.info.render.frame || 0),
      };
    }
    return { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 };
  });
}

/**
 * Inspects Web Audio AudioContext state and volume info
 */
export async function getAudioContextState(page: Page): Promise<AudioContextInfo> {
  return await page.evaluate(() => {
    const w = window as any;
    const audioManager = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
    const ctx: AudioContext | undefined = audioManager?.audioContext || w.__audioContext;

    if (!ctx) {
      return {
        state: 'unavailable' as const,
        sampleRate: 0,
      };
    }

    return {
      state: ctx.state as 'suspended' | 'running' | 'closed',
      sampleRate: ctx.sampleRate,
      volume: audioManager?.getVolume ? audioManager.getVolume() : undefined,
      isMuted: audioManager?.isMuted ? audioManager.isMuted() : undefined,
    };
  });
}

/**
 * Retrieves real-time FFT energy spectrum breakdown
 */
export async function getAudioFFTEnergy(page: Page): Promise<FFTEnergyInfo> {
  return await page.evaluate(() => {
    const w = window as any;
    const audioManager = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
    if (audioManager?.getFFTEnergy) {
      return audioManager.getFFTEnergy();
    }
    return { bass: 0, mid: 0, treble: 0 };
  });
}

/**
 * Measures the average frames per second (FPS) over a given count of requestAnimationFrames
 */
export async function measureAverageFPS(
  page: Page,
  targetFrames = 180,
  timeoutMs = 15000
): Promise<number> {
  return await page.evaluate(
    ({ targetFrames, timeoutMs }) => {
      return new Promise<number>((resolve, reject) => {
        let frameCount = 0;
        let startTime = performance.now();
        const timeout = setTimeout(() => {
          const elapsed = (performance.now() - startTime) / 1000;
          if (frameCount > 10) {
            resolve(frameCount / elapsed);
          } else {
            reject(new Error(`FPS measurement timed out: only recorded ${frameCount} frames in ${timeoutMs}ms`));
          }
        }, timeoutMs);

        function tick() {
          frameCount++;
          if (frameCount >= targetFrames) {
            clearTimeout(timeout);
            const elapsed = (performance.now() - startTime) / 1000;
            resolve(frameCount / elapsed);
          } else {
            requestAnimationFrame(tick);
          }
        }

        requestAnimationFrame(tick);
      });
    },
    { targetFrames, timeoutMs }
  );
}

/**
 * Simulates a WebGL context loss using WEBGL_lose_context extension
 */
export async function simulateLoseContext(
  page: Page,
  canvasSelector = '#space-canvas, canvas'
): Promise<boolean> {
  return await page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector);
    if (!canvas) return false;
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as (WebGLRenderingContext | WebGL2RenderingContext | null);
    if (!gl) return false;
    const loseContextExt = gl.getExtension('WEBGL_lose_context');
    if (!loseContextExt) return false;
    loseContextExt.loseContext();
    return true;
  }, canvasSelector);
}

/**
 * Restores a lost WebGL context using WEBGL_lose_context extension
 */
export async function simulateRestoreContext(
  page: Page,
  canvasSelector = '#space-canvas, canvas'
): Promise<boolean> {
  return await page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector);
    if (!canvas) return false;
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as (WebGLRenderingContext | WebGL2RenderingContext | null);
    if (!gl) return false;
    const loseContextExt = gl.getExtension('WEBGL_lose_context');
    if (!loseContextExt) return false;
    loseContextExt.restoreContext();
    return true;
  }, canvasSelector);
}

/**
 * Evaluates analytical terrain height function h(x, z) for the current space
 */
export async function getGroundHeightAt(page: Page, x: number, z: number): Promise<number> {
  return await page.evaluate(
    ({ x, z }) => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      if (space?.getGroundHeight) {
        return space.getGroundHeight(x, z);
      }
      return 0;
    },
    { x, z }
  );
}

/**
 * Reads the current 3D camera state (position, rotation, active mode)
 */
export async function getCameraState(page: Page): Promise<CameraStateInfo> {
  return await page.evaluate(() => {
    const w = window as any;
    const camera = w.__threeCamera || w.spaceEngine?.camera;
    const controller = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;

    const pos = camera?.position || { x: 0, y: 0, z: 0 };
    const rot = camera?.rotation || { x: 0, y: 0, z: 0 };

    return {
      position: { x: Number(pos.x || 0), y: Number(pos.y || 0), z: Number(pos.z || 0) },
      rotation: { x: Number(rot.x || 0), y: Number(rot.y || 0), z: Number(rot.z || 0) },
      mode: controller?.mode,
    };
  });
}

/**
 * Traverses the Three.js scene graph to count meshes, instanced meshes, and custom named elements
 */
export async function getSceneElementCounts(page: Page): Promise<{
  starHalos: number;
  hasCrescentMoon: boolean;
  hasCypressTree: boolean;
  instancedGrassCount: number;
  instancedFlowerCount: number;
  cloudsCount: number;
  totalMeshes: number;
}> {
  return await page.evaluate(() => {
    const w = window as any;
    const scene = w.__threeScene || w.spaceEngine?.scene || w.currentSpace?.scene;

    let starHalos = 0;
    let hasCrescentMoon = false;
    let hasCypressTree = false;
    let instancedGrassCount = 0;
    let instancedFlowerCount = 0;
    let cloudsCount = 0;
    let totalMeshes = 0;

    if (scene?.traverse) {
      scene.traverse((obj: any) => {
        if (obj.isMesh) {
          totalMeshes++;
          const name = (obj.name || '').toLowerCase();
          if (name.includes('star') || name.includes('halo')) {
            starHalos++;
          }
          if (name.includes('moon') || name.includes('crescent')) {
            hasCrescentMoon = true;
          }
          if (name.includes('cypress') || name.includes('tree')) {
            hasCypressTree = true;
          }
          if (name.includes('cloud')) {
            cloudsCount++;
          }
        }
        if (obj.isInstancedMesh) {
          const name = (obj.name || '').toLowerCase();
          if (name.includes('grass')) {
            instancedGrassCount += obj.count || 0;
          } else if (name.includes('flower') || name.includes('daisy') || name.includes('chamomile')) {
            instancedFlowerCount += obj.count || 0;
          }
        }
      });
    }

    return {
      starHalos,
      hasCrescentMoon,
      hasCypressTree,
      instancedGrassCount,
      instancedFlowerCount,
      cloudsCount,
      totalMeshes,
    };
  });
}
