import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  SH_C0,
  SPLAT_RECORD_BYTE_LENGTH,
  parseSplatBuffer,
  parse3DGSPlyBuffer
} from '../../src/client/scene/loaders/splatParser';
import { GaussianSplatScene } from '../../src/client/scene/loaders/GaussianSplatScene';
import { ThreeResourceDisposer } from '../../src/client/scene/ThreeResourceDisposer';
import { detectGraphicsCapabilities } from '../../src/client/scene/capabilities/WebGPUCapability';
import * as THREE from 'three';

function makeSplatRecordBuffer(
  records: Array<{
    pos: [number, number, number];
    scale: [number, number, number];
    rgba: [number, number, number, number];
    rotBytes: [number, number, number, number];
  }>
): ArrayBuffer {
  const buf = new ArrayBuffer(records.length * SPLAT_RECORD_BYTE_LENGTH);
  const view = new DataView(buf);
  records.forEach((rec, i) => {
    const off = i * SPLAT_RECORD_BYTE_LENGTH;
    view.setFloat32(off, rec.pos[0], true);
    view.setFloat32(off + 4, rec.pos[1], true);
    view.setFloat32(off + 8, rec.pos[2], true);
    view.setFloat32(off + 12, rec.scale[0], true);
    view.setFloat32(off + 16, rec.scale[1], true);
    view.setFloat32(off + 20, rec.scale[2], true);
    view.setUint8(off + 24, rec.rgba[0]);
    view.setUint8(off + 25, rec.rgba[1]);
    view.setUint8(off + 26, rec.rgba[2]);
    view.setUint8(off + 27, rec.rgba[3]);
    view.setUint8(off + 28, rec.rotBytes[0]);
    view.setUint8(off + 29, rec.rotBytes[1]);
    view.setUint8(off + 30, rec.rotBytes[2]);
    view.setUint8(off + 31, rec.rotBytes[3]);
  });
  return buf;
}

function buildBinaryLittleEndianPly(
  vertices: Array<{
    x: number;
    y: number;
    z: number;
    f_dc_0: number;
    f_dc_1: number;
    f_dc_2: number;
    f_rest_0?: number;
    opacity: number;
    scale_0: number;
    scale_1: number;
    scale_2: number;
    rot_0: number;
    rot_1: number;
    rot_2: number;
    rot_3: number;
  }>
): ArrayBuffer {
  const header = [
    'ply',
    'format binary_little_endian 1.0',
    `element vertex ${vertices.length}`,
    'property float x',
    'property float y',
    'property float z',
    'property float f_dc_0',
    'property float f_dc_1',
    'property float f_dc_2',
    'property float f_rest_0',
    'property float opacity',
    'property float scale_0',
    'property float scale_1',
    'property float scale_2',
    'property float rot_0',
    'property float rot_1',
    'property float rot_2',
    'property float rot_3',
    'end_header\n'
  ].join('\n');

  const headerBytes = new TextEncoder().encode(header);
  const stride = 15 * 4;
  const buf = new ArrayBuffer(headerBytes.byteLength + vertices.length * stride);
  new Uint8Array(buf).set(headerBytes, 0);

  const view = new DataView(buf);
  vertices.forEach((v, i) => {
    const off = headerBytes.byteLength + i * stride;
    view.setFloat32(off + 0, v.x, true);
    view.setFloat32(off + 4, v.y, true);
    view.setFloat32(off + 8, v.z, true);
    view.setFloat32(off + 12, v.f_dc_0, true);
    view.setFloat32(off + 16, v.f_dc_1, true);
    view.setFloat32(off + 20, v.f_dc_2, true);
    view.setFloat32(off + 24, v.f_rest_0 ?? 0, true);
    view.setFloat32(off + 28, v.opacity, true);
    view.setFloat32(off + 32, v.scale_0, true);
    view.setFloat32(off + 36, v.scale_1, true);
    view.setFloat32(off + 40, v.scale_2, true);
    view.setFloat32(off + 44, v.rot_0, true);
    view.setFloat32(off + 48, v.rot_1, true);
    view.setFloat32(off + 52, v.rot_2, true);
    view.setFloat32(off + 56, v.rot_3, true);
  });

  return buf;
}

describe('splatParser (.splat & 3DGS .ply)', () => {
  it('parses valid 32-byte .splat buffer with exact positions, scales, RGBA, normalized quaternions, and metrics', () => {
    const buf = makeSplatRecordBuffer([
      {
        pos: [-2.0, 0.0, 4.0],
        scale: [0.5, 0.25, 0.125],
        rgba: [255, 128, 0, 204],
        rotBytes: [255, 128, 128, 128] // (127/128, 0, 0, 0) -> normalized [1,0,0,0]
      },
      {
        pos: [4.0, 2.0, -2.0],
        scale: [0.2, 0.4, 0.6],
        rgba: [51, 102, 153, 255],
        rotBytes: [128, 255, 255, 128] // (0, 127/128, 127/128, 0) -> normalized [0, ~0.7071, ~0.7071, 0]
      }
    ]);

    const cloud = parseSplatBuffer(buf);
    expect(cloud.count).toBe(2);

    expect(cloud.positions[0]).toBeCloseTo(-2.0, 5);
    expect(cloud.positions[1]).toBeCloseTo(0.0, 5);
    expect(cloud.positions[2]).toBeCloseTo(4.0, 5);
    expect(cloud.positions[3]).toBeCloseTo(4.0, 5);

    expect(cloud.scales[0]).toBeCloseTo(0.5, 5);
    expect(cloud.scales[1]).toBeCloseTo(0.25, 5);
    expect(cloud.scales[2]).toBeCloseTo(0.125, 5);

    expect(cloud.colors[0]).toBeCloseTo(1.0, 3);
    expect(cloud.colors[1]).toBeCloseTo(128 / 255, 3);
    expect(cloud.colors[2]).toBeCloseTo(0.0, 3);
    expect(cloud.colors[3]).toBeCloseTo(204 / 255, 3);

    // Quaternion 0 -> [1, 0, 0, 0]
    expect(cloud.rotations[0]).toBeCloseTo(1.0, 5);
    expect(cloud.rotations[1]).toBeCloseTo(0.0, 5);

    // Quaternion 1 -> unit length [0, 1/sqrt(2), 1/sqrt(2), 0]
    const q1Norm = Math.hypot(
      cloud.rotations[4],
      cloud.rotations[5],
      cloud.rotations[6],
      cloud.rotations[7]
    );
    expect(q1Norm).toBeCloseTo(1.0, 5);
    expect(cloud.rotations[5]).toBeCloseTo(Math.SQRT1_2, 3);
    expect(cloud.rotations[6]).toBeCloseTo(Math.SQRT1_2, 3);

    expect(cloud.boundingBox.min).toEqual([-2, 0, -2]);
    expect(cloud.boundingBox.max).toEqual([4, 2, 4]);
    expect(cloud.centroid[0]).toBeCloseTo(1.0, 5);
    expect(cloud.centroid[1]).toBeCloseTo(1.0, 5);
    expect(cloud.centroid[2]).toBeCloseTo(1.0, 5);
    expect(cloud.groundY).toBeGreaterThanOrEqual(0);
    expect(cloud.groundY).toBeLessThanOrEqual(2);
  });

  it('rejects malformed .splat buffers with descriptive errors', () => {
    expect(() => parseSplatBuffer(null as any)).toThrow(/ArrayBuffer/i);
    expect(() => parseSplatBuffer(new ArrayBuffer(0))).toThrow(/empty/i);
    expect(() => parseSplatBuffer(new ArrayBuffer(33))).toThrow(/multiple of 32/i);

    const nanBuf = makeSplatRecordBuffer([
      { pos: [NaN, 0, 0], scale: [1, 1, 1], rgba: [255, 255, 255, 255], rotBytes: [255, 128, 128, 128] }
    ]);
    expect(() => parseSplatBuffer(nanBuf)).toThrow(/non-finite position/i);

    const infScaleBuf = makeSplatRecordBuffer([
      { pos: [0, 0, 0], scale: [Infinity, 1, 1], rgba: [255, 255, 255, 255], rotBytes: [255, 128, 128, 128] }
    ]);
    expect(() => parseSplatBuffer(infScaleBuf)).toThrow(/non-finite scale/i);
  });

  it('parses binary_little_endian 3DGS .ply with SH C0 color, sigmoid opacity, exp scale, and normalized rotation', () => {
    const buf = buildBinaryLittleEndianPly([
      {
        x: 1.5,
        y: -0.5,
        z: 2.5,
        f_dc_0: 1.0, // 0.5 + 0.28209479... = 0.78209479...
        f_dc_1: 0.0, // 0.5
        f_dc_2: -1.0, // 0.5 - 0.28209479... = 0.2179052...
        opacity: 0.0, // sigmoid(0) = 0.5
        scale_0: Math.log(0.25),
        scale_1: Math.log(0.5),
        scale_2: Math.log(1.5),
        rot_0: 2.0,
        rot_1: 0.0,
        rot_2: 0.0,
        rot_3: 0.0
      },
      {
        x: -1.5,
        y: 3.5,
        z: -0.5,
        f_dc_0: 0.0,
        f_dc_1: 1.0,
        f_dc_2: 0.0,
        opacity: 2.0, // sigmoid(2) ~ 0.880797
        scale_0: 0.0, // exp(0) = 1
        scale_1: -2.0,
        scale_2: -1.0,
        rot_0: 1.0,
        rot_1: 1.0,
        rot_2: 1.0,
        rot_3: 1.0 // norm = 2 -> [0.5, 0.5, 0.5, 0.5]
      }
    ]);

    const cloud = parse3DGSPlyBuffer(buf);
    expect(cloud.count).toBe(2);

    expect(cloud.positions[0]).toBeCloseTo(1.5, 5);
    expect(cloud.positions[1]).toBeCloseTo(-0.5, 5);
    expect(cloud.positions[2]).toBeCloseTo(2.5, 5);

    expect(cloud.colors[0]).toBeCloseTo(0.5 + SH_C0 * 1.0, 5);
    expect(cloud.colors[1]).toBeCloseTo(0.5, 5);
    expect(cloud.colors[2]).toBeCloseTo(0.5 - SH_C0 * 1.0, 5);
    expect(cloud.colors[3]).toBeCloseTo(0.5, 5);

    expect(cloud.scales[0]).toBeCloseTo(0.25, 5);
    expect(cloud.scales[1]).toBeCloseTo(0.5, 5);
    expect(cloud.scales[2]).toBeCloseTo(1.5, 5);

    // Normalized quaternion [2,0,0,0] -> [1,0,0,0]
    expect(cloud.rotations[0]).toBeCloseTo(1.0, 5);
    // Second vertex [1,1,1,1] -> [0.5,0.5,0.5,0.5]
    expect(cloud.rotations[4]).toBeCloseTo(0.5, 5);
    expect(cloud.rotations[5]).toBeCloseTo(0.5, 5);
    expect(cloud.rotations[6]).toBeCloseTo(0.5, 5);
    expect(cloud.rotations[7]).toBeCloseTo(0.5, 5);

    expect(cloud.colors[7]).toBeCloseTo(1 / (1 + Math.exp(-2)), 5);
    expect(cloud.boundingBox.min).toEqual([-1.5, -0.5, -0.5]);
    expect(cloud.boundingBox.max).toEqual([1.5, 3.5, 2.5]);
  });

  it('parses ASCII 3DGS .ply buffer accurately', () => {
    const asciiPly = [
      'ply',
      'format ascii 1.0',
      'comment dream test',
      'element vertex 2',
      'property float x',
      'property float y',
      'property float z',
      'property float f_dc_0',
      'property float f_dc_1',
      'property float f_dc_2',
      'property float opacity',
      'property float scale_0',
      'property float scale_1',
      'property float scale_2',
      'property float rot_0',
      'property float rot_1',
      'property float rot_2',
      'property float rot_3',
      'end_header',
      '0.0 0.2 0.0 0.5 -0.5 0.0 1.0 -1.0 0.0 0.5 1.0 0.0 0.0 0.0',
      '2.0 2.2 -4.0 0.0 1.0 0.5 -1.0 0.0 0.0 0.0 0.0 3.0 4.0 0.0'
    ].join('\r\n');

    const buf = new TextEncoder().encode(asciiPly).buffer;
    const cloud = parse3DGSPlyBuffer(buf);

    expect(cloud.count).toBe(2);
    expect(cloud.colors[0]).toBeCloseTo(0.5 + SH_C0 * 0.5, 5);
    expect(cloud.colors[3]).toBeCloseTo(1 / (1 + Math.exp(-1)), 5);
    expect(cloud.scales[0]).toBeCloseTo(Math.exp(-1), 5);
    expect(cloud.scales[2]).toBeCloseTo(Math.exp(0.5), 5);
    expect(cloud.rotations[5]).toBeCloseTo(0.6, 5);
    expect(cloud.rotations[6]).toBeCloseTo(0.8, 5);
    expect(cloud.boundingBox.min[2]).toBeCloseTo(-4.0, 5);
    expect(cloud.boundingBox.max[1]).toBeCloseTo(2.2, 5);
  });

  it('rejects malformed 3DGS .ply inputs cleanly', () => {
    const badMagic = new TextEncoder().encode('notply\nformat ascii 1.0\nend_header\n').buffer;
    expect(() => parse3DGSPlyBuffer(badMagic)).toThrow(/magic/i);

    const noEndHeader = new TextEncoder().encode('ply\nformat ascii 1.0\nelement vertex 1\n').buffer;
    expect(() => parse3DGSPlyBuffer(noEndHeader)).toThrow(/end_header/i);

    const bigEndian = new TextEncoder().encode(
      'ply\nformat binary_big_endian 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n123456789012'
    ).buffer;
    expect(() => parse3DGSPlyBuffer(bigEndian)).toThrow(/Unsupported 3DGS .ply format/i);

    const missingZ = new TextEncoder().encode(
      'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nend_header\n1 2\n'
    ).buffer;
    expect(() => parse3DGSPlyBuffer(missingZ)).toThrow(/x, y, z/i);

    const truncatedBin = new TextEncoder().encode(
      'ply\nformat binary_little_endian 1.0\nelement vertex 10\nproperty float x\nproperty float y\nproperty float z\nend_header\n1234'
    ).buffer;
    expect(() => parse3DGSPlyBuffer(truncatedBin)).toThrow(/expected at least/i);
  });

  it('validates generated sample assets (coastal-garden.splat and stone-lantern.glb)', async () => {
    const splatPath = path.resolve(__dirname, '../../public/samples/coastal-garden.splat');
    const splatBytes = fs.readFileSync(splatPath);
    expect(splatBytes.byteLength).toBeLessThan(350 * 1024);

    const splatArrayBuf = splatBytes.buffer.slice(
      splatBytes.byteOffset,
      splatBytes.byteOffset + splatBytes.byteLength
    );
    const cloud = parseSplatBuffer(splatArrayBuf);
    expect(cloud.count).toBeGreaterThanOrEqual(8000);
    expect(cloud.count).toBeLessThanOrEqual(11000);
    expect(Number.isFinite(cloud.groundY)).toBe(true);
    expect(cloud.boundingBox.max[1]).toBeGreaterThan(cloud.boundingBox.min[1]);

    // Check unit quaternions across sample
    for (let i = 0; i < Math.min(200, cloud.count); i++) {
      const n = Math.hypot(
        cloud.rotations[i * 4],
        cloud.rotations[i * 4 + 1],
        cloud.rotations[i * 4 + 2],
        cloud.rotations[i * 4 + 3]
      );
      expect(n).toBeCloseTo(1.0, 4);
    }

    // Validate generated stone-lantern.glb via GLTFLoader.parse
    const glbPath = path.resolve(__dirname, '../../public/samples/stone-lantern.glb');
    const glbBytes = fs.readFileSync(glbPath);
    expect(glbBytes.byteLength).toBeLessThan(100 * 1024);
    expect(glbBytes.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'

    const glbArrayBuf = glbBytes.buffer.slice(
      glbBytes.byteOffset,
      glbBytes.byteOffset + glbBytes.byteLength
    );
    const loader = new GLTFLoader();
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.parse(glbArrayBuf, '', resolve, reject);
    });
    expect(gltf.scene).toBeTruthy();
    expect(gltf.animations.length).toBeGreaterThanOrEqual(1);
    let meshCount = 0;
    gltf.scene.traverse((obj: any) => {
      if (obj.isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThanOrEqual(5);
  });
});

describe('WebGPUCapability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gracefully falls back when navigator.gpu is absent', async () => {
    vi.stubGlobal('navigator', {});
    const caps = await detectGraphicsCapabilities();

    expect(caps.webgpuSupported).toBe(false);
    expect(caps.webgpuAdapterInfo).toBeNull();
    expect(caps.decoders).toEqual({
      draco: true,
      ktx2: true,
      meshopt: true,
      gaussianSplatting: true
    });
    expect(['webgl2', 'none']).toContain(caps.preferredBackend);
  });

  it('detects WebGPU adapter info when navigator.gpu.requestAdapter resolves', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({
          info: {
            vendor: 'apple',
            architecture: 'metal-3',
            device: 'Apple M-Series',
            description: 'Mock WebGPU Adapter'
          }
        })
      }
    });

    const caps = await detectGraphicsCapabilities();
    expect(caps.webgpuSupported).toBe(true);
    expect(caps.preferredBackend).toBe('webgpu');
    expect(caps.webgpuAdapterInfo?.vendor).toBe('apple');
    expect(caps.webgpuAdapterInfo?.architecture).toBe('metal-3');
  });

  it('handles navigator.gpu.requestAdapter rejection safely', async () => {
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockRejectedValue(new Error('GPU blocked'))
      }
    });

    const caps = await detectGraphicsCapabilities();
    expect(caps.webgpuSupported).toBe(false);
    expect(caps.webgpuAdapterInfo).toBeNull();
  });
});

describe('GaussianSplatScene lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes from coastal-garden.splat, frames spawn & POIs, sorts, and disposes cleanly', async () => {
    const splatPath = path.resolve(__dirname, '../../public/samples/coastal-garden.splat');
    const bytes = fs.readFileSync(splatPath);
    const arrayBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => arrayBuf
      })
    );

    const mockRenderer = {
      getDrawingBufferSize: (v: THREE.Vector2) => v.set(1280, 720),
      render: vi.fn()
    } as unknown as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);

    const space = new GaussianSplatScene();
    await space.init(mockRenderer, camera);

    expect(space.getSplatCount()).toBe(9600);
    const spawn = space.getSpawnPoint();
    expect(Number.isFinite(spawn.position.x)).toBe(true);
    expect(Number.isFinite(spawn.position.y)).toBe(true);
    expect(Number.isFinite(spawn.position.z)).toBe(true);

    const bounds = space.getWanderBounds();
    expect(bounds.radius).toBeGreaterThan(5);
    expect(space.getPointsOfInterest().length).toBeGreaterThanOrEqual(3);
    expect(Number.isFinite(space.getGroundHeight(0, 0))).toBe(true);

    camera.position.copy(spawn.position);
    camera.lookAt(spawn.lookAt);
    space.update(0.016, 1.0);
    space.render(mockRenderer, camera);
    expect((mockRenderer.render as any)).toHaveBeenCalledTimes(1);

    const disposeSpy = vi.spyOn(ThreeResourceDisposer, 'disposeHierarchy');
    space.dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(space.getSplatCount()).toBe(0);
    disposeSpy.mockRestore();
  });
});
