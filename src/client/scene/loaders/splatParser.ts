export const SH_C0 = 0.28209479177387814;
export const SPLAT_RECORD_BYTE_LENGTH = 32;

export interface ParsedGaussianCloud {
  count: number;
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array; // (w, x, y, z) normalized unit quaternions
  colors: Float32Array; // (r, g, b, a) normalized in [0, 1]
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  centroid: [number, number, number];
  groundY: number;
}

type PlyScalarType =
  | 'float'
  | 'float32'
  | 'double'
  | 'float64'
  | 'uchar'
  | 'uint8'
  | 'char'
  | 'int8'
  | 'ushort'
  | 'uint16'
  | 'short'
  | 'int16'
  | 'uint'
  | 'uint32'
  | 'int'
  | 'int32';

interface PlyPropertyDef {
  name: string;
  type: PlyScalarType;
  byteSize: number;
  byteOffset: number;
  index: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sigmoid(x: number): number {
  if (x >= 20) return 1;
  if (x <= -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

function safeExpScale(s: number): number {
  if (!Number.isFinite(s)) return 0.01;
  const clamped = Math.max(-14, Math.min(8, s));
  return Math.exp(clamped);
}

function normalizeQuaternion(
  w: number,
  x: number,
  y: number,
  z: number,
  out: Float32Array,
  offset: number
): void {
  const lenSq = w * w + x * x + y * y + z * z;
  if (!Number.isFinite(lenSq) || lenSq < 1e-12) {
    out[offset] = 1;
    out[offset + 1] = 0;
    out[offset + 2] = 0;
    out[offset + 3] = 0;
    return;
  }
  const invLen = 1 / Math.sqrt(lenSq);
  out[offset] = w * invLen;
  out[offset + 1] = x * invLen;
  out[offset + 2] = y * invLen;
  out[offset + 3] = z * invLen;
}

function computeCloudMetrics(
  positions: Float32Array,
  count: number
): {
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  centroid: [number, number, number];
  groundY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  const maxSample = 32768;
  const stride = count > maxSample ? Math.ceil(count / maxSample) : 1;
  const sampleCount = Math.ceil(count / stride);
  const ySamples = new Float32Array(sampleCount);
  let sIdx = 0;

  for (let i = 0; i < count; i++) {
    const base = i * 3;
    const x = positions[base];
    const y = positions[base + 1];
    const z = positions[base + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;

    sumX += x;
    sumY += y;
    sumZ += z;

    if (i % stride === 0 && sIdx < sampleCount) {
      ySamples[sIdx++] = y;
    }
  }

  const usedSamples = sIdx > 0 ? ySamples.subarray(0, sIdx) : ySamples;
  usedSamples.sort();

  const pIdx = 0.08 * (usedSamples.length - 1);
  const lo = Math.floor(pIdx);
  const hi = Math.min(usedSamples.length - 1, lo + 1);
  const frac = pIdx - lo;
  const groundY = usedSamples.length > 0 ? usedSamples[lo] * (1 - frac) + usedSamples[hi] * frac : 0;

  return {
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    },
    centroid: [sumX / count, sumY / count, sumZ / count],
    groundY
  };
}

/**
 * Parses a standard 32-byte-per-splat binary `.splat` buffer:
 * - bytes 0..11:  position[3] float32 LE
 * - bytes 12..23: scale[3] float32 LE
 * - bytes 24..27: rgba[4] uint8
 * - bytes 28..31: rot[4] uint8 mapped via (v - 128) / 128 and normalized (w, x, y, z)
 */
export function parseSplatBuffer(buffer: ArrayBuffer): ParsedGaussianCloud {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    throw new Error('Invalid .splat buffer: expected an ArrayBuffer');
  }
  if (buffer.byteLength === 0) {
    throw new Error('Invalid .splat buffer: buffer is empty');
  }
  if (buffer.byteLength % SPLAT_RECORD_BYTE_LENGTH !== 0) {
    throw new Error(
      `Invalid .splat buffer: byte length (${buffer.byteLength}) must be a multiple of ${SPLAT_RECORD_BYTE_LENGTH} bytes`
    );
  }

  const count = buffer.byteLength / SPLAT_RECORD_BYTE_LENGTH;
  const view = new DataView(buffer);

  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const byteOff = i * SPLAT_RECORD_BYTE_LENGTH;
    const px = view.getFloat32(byteOff, true);
    const py = view.getFloat32(byteOff + 4, true);
    const pz = view.getFloat32(byteOff + 8, true);

    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      throw new Error(`Invalid .splat buffer: non-finite position at splat index ${i}`);
    }

    const sx = view.getFloat32(byteOff + 12, true);
    const sy = view.getFloat32(byteOff + 16, true);
    const sz = view.getFloat32(byteOff + 20, true);

    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)) {
      throw new Error(`Invalid .splat buffer: non-finite scale at splat index ${i}`);
    }

    const p3 = i * 3;
    positions[p3] = px;
    positions[p3 + 1] = py;
    positions[p3 + 2] = pz;

    scales[p3] = sx > 1e-6 ? sx : 1e-6;
    scales[p3 + 1] = sy > 1e-6 ? sy : 1e-6;
    scales[p3 + 2] = sz > 1e-6 ? sz : 1e-6;

    const c4 = i * 4;
    colors[c4] = view.getUint8(byteOff + 24) / 255;
    colors[c4 + 1] = view.getUint8(byteOff + 25) / 255;
    colors[c4 + 2] = view.getUint8(byteOff + 26) / 255;
    colors[c4 + 3] = view.getUint8(byteOff + 27) / 255;

    const rw = (view.getUint8(byteOff + 28) - 128) / 128;
    const rx = (view.getUint8(byteOff + 29) - 128) / 128;
    const ry = (view.getUint8(byteOff + 30) - 128) / 128;
    const rz = (view.getUint8(byteOff + 31) - 128) / 128;
    normalizeQuaternion(rw, rx, ry, rz, rotations, c4);
  }

  const metrics = computeCloudMetrics(positions, count);
  return {
    count,
    positions,
    scales,
    rotations,
    colors,
    ...metrics
  };
}

function getPlyTypeByteSize(type: string): number {
  switch (type) {
    case 'char':
    case 'int8':
    case 'uchar':
    case 'uint8':
      return 1;
    case 'short':
    case 'int16':
    case 'ushort':
    case 'uint16':
      return 2;
    case 'int':
    case 'int32':
    case 'uint':
    case 'uint32':
    case 'float':
    case 'float32':
      return 4;
    case 'double':
    case 'float64':
      return 8;
    default:
      return -1;
  }
}

function readPlyBinaryValue(view: DataView, offset: number, type: PlyScalarType): number {
  switch (type) {
    case 'float':
    case 'float32':
      return view.getFloat32(offset, true);
    case 'double':
    case 'float64':
      return view.getFloat64(offset, true);
    case 'uchar':
    case 'uint8':
      return view.getUint8(offset);
    case 'char':
    case 'int8':
      return view.getInt8(offset);
    case 'ushort':
    case 'uint16':
      return view.getUint16(offset, true);
    case 'short':
    case 'int16':
      return view.getInt16(offset, true);
    case 'uint':
    case 'uint32':
      return view.getUint32(offset, true);
    case 'int':
    case 'int32':
      return view.getInt32(offset, true);
  }
}

function findEndHeaderOffset(bytes: Uint8Array): { headerText: string; dataOffset: number } {
  const maxHeaderBytes = Math.min(bytes.byteLength, 65536);
  const decoder = new TextDecoder('ascii');
  const headStr = decoder.decode(bytes.subarray(0, maxHeaderBytes));

  const match = /\r?\nend_header\r?\n/.exec(headStr);
  if (!match) {
    if (headStr.startsWith('end_header\n') || headStr.startsWith('end_header\r\n')) {
      throw new Error('Invalid 3DGS .ply buffer: missing "ply" magic header');
    }
    throw new Error('Invalid 3DGS .ply buffer: missing "end_header" terminator');
  }

  const endIdx = match.index + match[0].length;
  return {
    headerText: headStr.slice(0, match.index),
    dataOffset: endIdx
  };
}

/**
 * Parses a 3D Gaussian Splatting `.ply` buffer (supports both `binary_little_endian 1.0`
 * and `ascii 1.0` formats).
 */
export function parse3DGSPlyBuffer(buffer: ArrayBuffer): ParsedGaussianCloud {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    throw new Error('Invalid 3DGS .ply buffer: expected an ArrayBuffer');
  }
  if (buffer.byteLength < 16) {
    throw new Error('Invalid 3DGS .ply buffer: file too small to contain PLY header');
  }

  const bytes = new Uint8Array(buffer);
  const { headerText, dataOffset } = findEndHeaderOffset(bytes);
  const lines = headerText.split(/\r?\n/);

  if (lines[0]?.trim() !== 'ply') {
    throw new Error('Invalid 3DGS .ply buffer: missing "ply" header magic');
  }

  let format: 'binary_little_endian' | 'ascii' | null = null;
  let vertexCount = -1;
  let currentElement: string | null = null;
  let vertexStride = 0;
  const vertexProps: PlyPropertyDef[] = [];
  const propMap = new Map<string, PlyPropertyDef>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('comment') || line.startsWith('obj_info')) continue;

    const parts = line.split(/\s+/);
    const kw = parts[0];

    if (kw === 'format') {
      const fmt = parts[1];
      if (fmt === 'binary_little_endian') {
        format = 'binary_little_endian';
      } else if (fmt === 'ascii') {
        format = 'ascii';
      } else {
        throw new Error(`Unsupported 3DGS .ply format: "${fmt}" (expected binary_little_endian or ascii)`);
      }
    } else if (kw === 'element') {
      currentElement = parts[1] ?? null;
      const count = Number(parts[2]);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Invalid 3DGS .ply header: invalid count for element "${currentElement}"`);
      }
      if (currentElement === 'vertex') {
        vertexCount = count;
      }
    } else if (kw === 'property' && currentElement === 'vertex') {
      if (parts[1] === 'list') {
        throw new Error('Invalid 3DGS .ply header: list properties are not supported on vertex elements');
      }
      const typeStr = parts[1] as PlyScalarType;
      const propName = parts[2];
      const byteSize = getPlyTypeByteSize(typeStr);
      if (byteSize <= 0 || !propName) {
        throw new Error(`Invalid 3DGS .ply header: unsupported vertex property "${line}"`);
      }
      const def: PlyPropertyDef = {
        name: propName,
        type: typeStr,
        byteSize,
        byteOffset: vertexStride,
        index: vertexProps.length
      };
      vertexProps.push(def);
      propMap.set(propName, def);
      vertexStride += byteSize;
    }
  }

  if (!format) {
    throw new Error('Invalid 3DGS .ply header: missing format declaration');
  }
  if (vertexCount <= 0) {
    throw new Error('Invalid 3DGS .ply header: vertex element missing or empty');
  }

  const pX = propMap.get('x');
  const pY = propMap.get('y');
  const pZ = propMap.get('z');
  if (!pX || !pY || !pZ) {
    throw new Error('Invalid 3DGS .ply header: missing required position properties (x, y, z)');
  }

  const pDc0 = propMap.get('f_dc_0');
  const pDc1 = propMap.get('f_dc_1');
  const pDc2 = propMap.get('f_dc_2');
  const pRed = propMap.get('red');
  const pGreen = propMap.get('green');
  const pBlue = propMap.get('blue');
  const pOpacity = propMap.get('opacity');
  const pAlpha = propMap.get('alpha');
  const pS0 = propMap.get('scale_0');
  const pS1 = propMap.get('scale_1');
  const pS2 = propMap.get('scale_2');
  const pR0 = propMap.get('rot_0');
  const pR1 = propMap.get('rot_1');
  const pR2 = propMap.get('rot_2');
  const pR3 = propMap.get('rot_3');

  const positions = new Float32Array(vertexCount * 3);
  const scales = new Float32Array(vertexCount * 3);
  const rotations = new Float32Array(vertexCount * 4);
  const colors = new Float32Array(vertexCount * 4);

  const hasSH = Boolean(pDc0 && pDc1 && pDc2);
  const hasRGB = Boolean(pRed && pGreen && pBlue);
  const hasScale = Boolean(pS0 && pS1 && pS2);
  const hasRot = Boolean(pR0 && pR1 && pR2 && pR3);

  if (format === 'binary_little_endian') {
    const requiredBytes = dataOffset + vertexCount * vertexStride;
    if (buffer.byteLength < requiredBytes) {
      throw new Error(
        `Invalid 3DGS .ply buffer: expected at least ${requiredBytes} bytes for ${vertexCount} vertices, got ${buffer.byteLength}`
      );
    }

    const view = new DataView(buffer);
    for (let i = 0; i < vertexCount; i++) {
      const base = dataOffset + i * vertexStride;
      const px = readPlyBinaryValue(view, base + pX.byteOffset, pX.type);
      const py = readPlyBinaryValue(view, base + pY.byteOffset, pY.type);
      const pz = readPlyBinaryValue(view, base + pZ.byteOffset, pZ.type);

      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
        throw new Error(`Invalid 3DGS .ply buffer: non-finite position at vertex ${i}`);
      }

      const p3 = i * 3;
      positions[p3] = px;
      positions[p3 + 1] = py;
      positions[p3 + 2] = pz;

      if (hasScale) {
        scales[p3] = safeExpScale(readPlyBinaryValue(view, base + pS0!.byteOffset, pS0!.type));
        scales[p3 + 1] = safeExpScale(readPlyBinaryValue(view, base + pS1!.byteOffset, pS1!.type));
        scales[p3 + 2] = safeExpScale(readPlyBinaryValue(view, base + pS2!.byteOffset, pS2!.type));
      } else {
        scales[p3] = 0.02;
        scales[p3 + 1] = 0.02;
        scales[p3 + 2] = 0.02;
      }

      const c4 = i * 4;
      if (hasSH) {
        colors[c4] = clamp01(0.5 + SH_C0 * readPlyBinaryValue(view, base + pDc0!.byteOffset, pDc0!.type));
        colors[c4 + 1] = clamp01(0.5 + SH_C0 * readPlyBinaryValue(view, base + pDc1!.byteOffset, pDc1!.type));
        colors[c4 + 2] = clamp01(0.5 + SH_C0 * readPlyBinaryValue(view, base + pDc2!.byteOffset, pDc2!.type));
      } else if (hasRGB) {
        const norm = pRed!.type === 'uchar' || pRed!.type === 'uint8' ? 1 / 255 : 1;
        colors[c4] = clamp01(readPlyBinaryValue(view, base + pRed!.byteOffset, pRed!.type) * norm);
        colors[c4 + 1] = clamp01(readPlyBinaryValue(view, base + pGreen!.byteOffset, pGreen!.type) * norm);
        colors[c4 + 2] = clamp01(readPlyBinaryValue(view, base + pBlue!.byteOffset, pBlue!.type) * norm);
      } else {
        colors[c4] = 0.7;
        colors[c4 + 1] = 0.7;
        colors[c4 + 2] = 0.7;
      }

      if (pOpacity) {
        colors[c4 + 3] = sigmoid(readPlyBinaryValue(view, base + pOpacity.byteOffset, pOpacity.type));
      } else if (pAlpha) {
        const aNorm = pAlpha.type === 'uchar' || pAlpha.type === 'uint8' ? 1 / 255 : 1;
        colors[c4 + 3] = clamp01(readPlyBinaryValue(view, base + pAlpha.byteOffset, pAlpha.type) * aNorm);
      } else {
        colors[c4 + 3] = 1.0;
      }

      if (hasRot) {
        const rw = readPlyBinaryValue(view, base + pR0!.byteOffset, pR0!.type);
        const rx = readPlyBinaryValue(view, base + pR1!.byteOffset, pR1!.type);
        const ry = readPlyBinaryValue(view, base + pR2!.byteOffset, pR2!.type);
        const rz = readPlyBinaryValue(view, base + pR3!.byteOffset, pR3!.type);
        normalizeQuaternion(rw, rx, ry, rz, rotations, c4);
      } else {
        rotations[c4] = 1;
        rotations[c4 + 1] = 0;
        rotations[c4 + 2] = 0;
        rotations[c4 + 3] = 0;
      }
    }
  } else {
    // ASCII 1.0
    const bodyText = new TextDecoder('utf-8').decode(bytes.subarray(dataOffset));
    const rows = bodyText.split(/\r?\n/);
    let parsedRows = 0;

    for (let r = 0; r < rows.length && parsedRows < vertexCount; r++) {
      const trimmed = rows[r].trim();
      if (!trimmed) continue;

      const tokens = trimmed.split(/\s+/);
      if (tokens.length < vertexProps.length) {
        throw new Error(
          `Invalid ASCII 3DGS .ply row at vertex ${parsedRows}: expected ${vertexProps.length} values, got ${tokens.length}`
        );
      }

      const px = Number(tokens[pX.index]);
      const py = Number(tokens[pY.index]);
      const pz = Number(tokens[pZ.index]);
      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
        throw new Error(`Invalid ASCII 3DGS .ply buffer: non-finite position at vertex ${parsedRows}`);
      }

      const p3 = parsedRows * 3;
      positions[p3] = px;
      positions[p3 + 1] = py;
      positions[p3 + 2] = pz;

      if (hasScale) {
        scales[p3] = safeExpScale(Number(tokens[pS0!.index]));
        scales[p3 + 1] = safeExpScale(Number(tokens[pS1!.index]));
        scales[p3 + 2] = safeExpScale(Number(tokens[pS2!.index]));
      } else {
        scales[p3] = 0.02;
        scales[p3 + 1] = 0.02;
        scales[p3 + 2] = 0.02;
      }

      const c4 = parsedRows * 4;
      if (hasSH) {
        colors[c4] = clamp01(0.5 + SH_C0 * Number(tokens[pDc0!.index]));
        colors[c4 + 1] = clamp01(0.5 + SH_C0 * Number(tokens[pDc1!.index]));
        colors[c4 + 2] = clamp01(0.5 + SH_C0 * Number(tokens[pDc2!.index]));
      } else if (hasRGB) {
        const norm = pRed!.type === 'uchar' || pRed!.type === 'uint8' ? 1 / 255 : 1;
        colors[c4] = clamp01(Number(tokens[pRed!.index]) * norm);
        colors[c4 + 1] = clamp01(Number(tokens[pGreen!.index]) * norm);
        colors[c4 + 2] = clamp01(Number(tokens[pBlue!.index]) * norm);
      } else {
        colors[c4] = 0.7;
        colors[c4 + 1] = 0.7;
        colors[c4 + 2] = 0.7;
      }

      if (pOpacity) {
        colors[c4 + 3] = sigmoid(Number(tokens[pOpacity.index]));
      } else if (pAlpha) {
        const aNorm = pAlpha.type === 'uchar' || pAlpha.type === 'uint8' ? 1 / 255 : 1;
        colors[c4 + 3] = clamp01(Number(tokens[pAlpha.index]) * aNorm);
      } else {
        colors[c4 + 3] = 1.0;
      }

      if (hasRot) {
        const rw = Number(tokens[pR0!.index]);
        const rx = Number(tokens[pR1!.index]);
        const ry = Number(tokens[pR2!.index]);
        const rz = Number(tokens[pR3!.index]);
        normalizeQuaternion(rw, rx, ry, rz, rotations, c4);
      } else {
        rotations[c4] = 1;
        rotations[c4 + 1] = 0;
        rotations[c4 + 2] = 0;
        rotations[c4 + 3] = 0;
      }

      parsedRows++;
    }

    if (parsedRows < vertexCount) {
      throw new Error(
        `Invalid ASCII 3DGS .ply buffer: expected ${vertexCount} vertex rows, found only ${parsedRows}`
      );
    }
  }

  const metrics = computeCloudMetrics(positions, vertexCount);
  return {
    count: vertexCount,
    positions,
    scales,
    rotations,
    colors,
    ...metrics
  };
}
