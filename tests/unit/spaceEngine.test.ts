import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { SpaceEngine } from '../../src/client/scene/SpaceEngine';
import { ISpace } from '../../src/client/scene/ISpace';

function createMockRenderer() {
  const domElement = {
    parentElement: null as any
  };
  return {
    domElement,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    renderLists: {
      dispose: vi.fn()
    },
    forceContextLoss: vi.fn()
  } as unknown as THREE.WebGLRenderer;
}

function createMockSpace(id = 'test-space'): ISpace {
  return {
    id,
    name: 'Test Space',
    slug: 'test-space',
    init: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    render: vi.fn(),
    updateConfig: vi.fn(),
    dispose: vi.fn(),
    getGroundHeight: vi.fn().mockReturnValue(0),
    getSpawnPoint: vi.fn().mockReturnValue({
      position: new THREE.Vector3(1, 2, 3),
      lookAt: new THREE.Vector3(0, 0, 0)
    }),
    getWanderBounds: vi.fn().mockReturnValue({
      radius: 40,
      center: new THREE.Vector3(0, 0, 0)
    }),
    getPointsOfInterest: vi.fn().mockReturnValue([])
  };
}

describe('SpaceEngine', () => {
  let mockContainer: any;
  let originalWindow: any;

  beforeEach(() => {
    mockContainer = {
      clientWidth: 800,
      clientHeight: 600,
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces DPR clamping at max 1.75 to prevent 4K fillrate drops', () => {
    const mockRenderer = createMockRenderer();

    // Test with devicePixelRatio = 3.0 (e.g. high-end Retina / 4K)
    vi.stubGlobal('window', {
      devicePixelRatio: 3.0,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const engine = new SpaceEngine(mockContainer, {
      renderer: mockRenderer,
      maxPixelRatio: 1.75
    });

    expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(1.75);
    engine.dispose();
  });

  it('preserves native DPR if lower than clamping threshold', () => {
    const mockRenderer = createMockRenderer();

    // Test with devicePixelRatio = 1.25
    vi.stubGlobal('window', {
      devicePixelRatio: 1.25,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const engine = new SpaceEngine(mockContainer, {
      renderer: mockRenderer,
      maxPixelRatio: 1.75
    });

    expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    engine.dispose();
  });

  it('updates camera aspect ratio and renderer viewport on resize()', () => {
    const mockRenderer = createMockRenderer();
    const engine = new SpaceEngine(mockContainer, { renderer: mockRenderer });

    engine.resize(1200, 800);

    const camera = engine.getCamera();
    expect(camera.aspect).toBeCloseTo(1200 / 800);
    expect(mockRenderer.setSize).toHaveBeenCalledWith(1200, 800);
    engine.dispose();
  });

  it('mounts and initializes space, positioning camera at spawn point', async () => {
    const mockRenderer = createMockRenderer();
    const engine = new SpaceEngine(mockContainer, { renderer: mockRenderer });
    const space = createMockSpace('space-1');

    await engine.loadSpace(space);

    expect(space.init).toHaveBeenCalledWith(mockRenderer, engine.getCamera(), undefined);
    expect(engine.getActiveSpace()).toBe(space);

    const camera = engine.getCamera();
    expect(camera.position.x).toBe(1);
    expect(camera.position.y).toBe(2);
    expect(camera.position.z).toBe(3);

    engine.dispose();
  });

  it('guarantees deterministic disposal of previous space on transition', async () => {
    const mockRenderer = createMockRenderer();
    const engine = new SpaceEngine(mockContainer, { renderer: mockRenderer });

    const space1 = createMockSpace('space-1');
    const space2 = createMockSpace('space-2');

    await engine.loadSpace(space1);
    expect(engine.getActiveSpace()).toBe(space1);

    await engine.loadSpace(space2);
    expect(space1.dispose).toHaveBeenCalledTimes(1);
    expect(space2.init).toHaveBeenCalledTimes(1);
    expect(engine.getActiveSpace()).toBe(space2);

    engine.dispose();
    expect(space2.dispose).toHaveBeenCalledTimes(1);
  });

  it('toggles start and stop lifecycle state correctly', () => {
    const mockRenderer = createMockRenderer();
    const engine = new SpaceEngine(mockContainer, { renderer: mockRenderer });

    expect(engine.isRunning()).toBe(false);

    engine.start();
    expect(engine.isRunning()).toBe(true);

    engine.stop();
    expect(engine.isRunning()).toBe(false);

    engine.dispose();
  });

  it('throws error if loadSpace is passed null', async () => {
    const mockRenderer = createMockRenderer();
    const engine = new SpaceEngine(mockContainer, { renderer: mockRenderer });

    await expect(engine.loadSpace(null as any)).rejects.toThrow('Space cannot be null or undefined');
    engine.dispose();
  });
});
