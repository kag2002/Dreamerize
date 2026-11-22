import * as THREE from 'three';
import type { PbrTextureSet } from './pbrTextures';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function hash2i(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tileNoise(u: number, v: number, px: number, py: number, seed: number): number {
  const x = u * px;
  const y = v * py;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const p0x = ((x0 % px) + px) % px;
  const p0y = ((y0 % py) + py) % py;
  const p1x = p0x + 1 < px ? p0x + 1 : 0;
  const p1y = p0y + 1 < py ? p0y + 1 : 0;
  const n00 = hash2i(p0x, p0y, seed);
  const n10 = hash2i(p1x, p0y, seed);
  const n01 = hash2i(p0x, p1y, seed);
  const n11 = hash2i(p1x, p1y, seed);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

function tileFbm(u: number, v: number, px: number, py: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(u, v, px << o, py << o, seed + o * 97);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

function getAniso(renderer?: THREE.WebGLRenderer): number {
  try {
    const cap = (renderer as unknown as { capabilities?: { getMaxAnisotropy?: () => number } })?.capabilities;
    if (cap && typeof cap.getMaxAnisotropy === 'function') {
      return Math.min(16, Math.max(1, cap.getMaxAnisotropy()));
    }
  } catch {
    // Headless fallback
  }
  return 4;
}

export function isHeadlessRenderer(renderer?: THREE.WebGLRenderer): boolean {
  if (typeof document === 'undefined') return true;
  const r = renderer as unknown as { getContext?: () => unknown } | undefined;
  return !r || typeof r.getContext !== 'function';
}

function finalizeDataTex(
  data: Uint8Array,
  size: number,
  isColor: boolean,
  rx: number,
  ry: number,
  aniso: number,
  renderer?: THREE.WebGLRenderer,
  heightOverride?: number
): THREE.DataTexture {
  const h = heightOverride ?? size;
  const tex = new THREE.DataTexture(data, size, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = aniso;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  const r = renderer as unknown as { initTexture?: (t: THREE.Texture) => void } | undefined;
  if (r && typeof r.initTexture === 'function') {
    try {
      r.initTexture(tex);
    } catch {
      // Ignore in mock renderers
    }
  }
  return tex;
}

function buildSobelPbrSet(
  albedo: Uint8Array,
  height: Float32Array,
  rough: Float32Array,
  ao: Float32Array,
  size: number,
  normalStrength: number,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer
): PbrTextureSet {
  const aniso = getAniso(renderer);
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const aoData = new Uint8Array(size * size * 4);
  const mask = size - 1;
  const isPow2 = (size & mask) === 0;
  const sampleH = (x: number, y: number): number => {
    const wx = isPow2 ? x & mask : ((x % size) + size) % size;
    const wy = isPow2 ? y & mask : ((y % size) + size) % size;
    return height[wy * size + wx];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const idx = i * 4;
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);
      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dX * normalStrength;
      let ny = -dY * normalStrength;
      let nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
      normalData[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      normalData[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normalData[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;

      const rb = clampByte(rough[i] * 255);
      roughData[idx] = rb;
      roughData[idx + 1] = rb;
      roughData[idx + 2] = rb;
      roughData[idx + 3] = 255;

      const ab = clampByte(ao[i] * 255);
      aoData[idx] = ab;
      aoData[idx + 1] = ab;
      aoData[idx + 2] = ab;
      aoData[idx + 3] = 255;
    }
  }
  return {
    map: finalizeDataTex(albedo, size, true, rx, ry, aniso, renderer),
    normalMap: finalizeDataTex(normalData, size, false, rx, ry, aniso, renderer),
    roughnessMap: finalizeDataTex(roughData, size, false, rx, ry, aniso, renderer),
    aoMap: finalizeDataTex(aoData, size, false, rx, ry, aniso, renderer)
  };
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function wrapCanvasTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer,
  wrapMode?: THREE.Wrapping
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  const wMode = wrapMode ?? (rx > 1 || ry > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping);
  tex.wrapS = wMode;
  tex.wrapT = wMode;
  if (rx > 1 || ry > 1) tex.repeat.set(rx, ry);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = getAniso(renderer);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a real tangent-space Sobel normal map directly from a 2D height/mask canvas.
 */
function canvasToSobelNormal(
  canvas: HTMLCanvasElement,
  strength: number,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer,
  tileWrap = true
): THREE.DataTexture {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const aniso = getAniso(renderer);
  if (!ctx) {
    return finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, false, rx, ry, aniso, renderer);
  }
  const src = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    lum[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) * (src[o + 3] / 255) / 255;
  }
  const normalData = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number): number => {
    const wx = tileWrap ? ((x % w) + w) % w : Math.max(0, Math.min(w - 1, x));
    const wy = tileWrap ? ((y % h) + h) % h : Math.max(0, Math.min(h - 1, y));
    return lum[wy * w + wx];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);
      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      normalData[o] = clampByte((nx * 0.5 + 0.5) * 255);
      normalData[o + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normalData[o + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normalData[o + 3] = 255;
    }
  }
  const tex = finalizeDataTex(normalData, w, false, rx, ry, aniso, renderer, h);
  if (!tileWrap) {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  return tex;
}

/**
 * 1. Hoàng Lưu Ly (Fiery Imperial Saffron-Orange Glazed Tubular Roof Tiles) &
 *    Thanh Lưu Ly (Velvety Deep Emerald-Jade Glazed Tubular Roof Tiles) — NM-02, NM-03, EX-01
 */
export function createHueGlazedRoofPbrTextures(
  variant: 'hoang_luu_ly' | 'thanh_luu_ly',
  opts: { size?: number; renderer?: THREE.WebGLRenderer; repeatX?: number; repeatY?: number } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 128 : (opts.size ?? 512);
  const seed = variant === 'hoang_luu_ly' ? 4801 : 4903;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const numCols = 14;
  const numRows = 8;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * numRows;
    const rowIdx = Math.floor(rowF);
    const fv = rowF - rowIdx;
    const courseLip = smoothstep(0.0, 0.14, fv);
    const courseShadow = lerp(0.36, 1.0, courseLip);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const colF = u * numCols;
      const colIdx = Math.floor(colF);
      const fu = colF - colIdx;

      const arch = Math.sin(fu * Math.PI);
      const crest = Math.pow(arch, 0.72);
      const troughMask = smoothstep(0.03, 0.20, Math.min(fu, 1.0 - fu));

      const tileVar = hash2i(colIdx % numCols, rowIdx % numRows, seed);
      const glazeMottle = tileFbm(u, v, 10, 10, 3, seed + 37);
      const creviceMoss = (1.0 - troughMask) * smoothstep(0.50, 0.84, tileFbm(u, v, 6, 6, 2, seed + 91));

      let r: number;
      let g: number;
      let b: number;
      if (variant === 'hoang_luu_ly') {
        // Rich Imperial Saffron Golden-Amber Hoàng Lưu Ly (Photos 2 & 6 — rich golden yellow-amber, zero peach-pink!)
        const shade = (0.90 + (tileVar - 0.5) * 0.16 + (glazeMottle - 0.5) * 0.08) * courseShadow;
        r = lerp(146, 248, crest) * shade;
        g = lerp(74, 174, crest) * shade;
        b = lerp(0, 10, crest) * shade;
        r = lerp(r, 56, creviceMoss * 0.46);
        g = lerp(g, 46, creviceMoss * 0.46);
        b = lerp(b, 14, creviceMoss * 0.46);
      } else {
        // Deep Velvety Pine/Emerald-Jade Thanh Lưu Ly (Photo 2 — zero mint/teal!)
        const shade = (0.86 + (tileVar - 0.5) * 0.16 + (glazeMottle - 0.5) * 0.10) * courseShadow;
        r = lerp(3, 15, crest) * shade;
        g = lerp(20, 86, crest) * shade;
        b = lerp(9, 32, crest) * shade;
        const jadeVar = smoothstep(0.65, 0.92, tileVar) * crest * 0.18;
        g = lerp(g, 98, jadeVar);
        b = lerp(b, 38, jadeVar);
      }

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(0.10 + crest * 0.78 * courseLip + (glazeMottle - 0.5) * 0.04);
      rough[i] = clamp01(lerp(0.74, 0.22, crest * troughMask) + creviceMoss * 0.28);
      ao[i] = clamp01(lerp(0.28, 0.98, troughMask * courseLip));
    }
  }

  return buildSobelPbrSet(
    albedo,
    height,
    rough,
    ao,
    size,
    4.5,
    opts.repeatX ?? 1,
    opts.repeatY ?? 1,
    opts.renderer
  );
}

/**
 * 2. Irregular Multi-Tone Weathered Blue-Grey Thanh Hóa Limestone Flagstones — EX-11, NM-13, NM-21
 *    Zero uniform wallpaper grid moiré: 8 rows with varied ashlar block widths, vertical rain runoff & moss joints!
 */
export function createHueThanhStonePbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer; repeatX?: number; repeatY?: number } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 128 : (opts.size ?? 512);
  const seed = 5107;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 8;
  // Varied column counts per row eliminates mechanical vertical stripe moiré from aerial angles
  const rowCols = [4, 5, 3, 5, 4, 6, 4, 5];
  const palette: Array<[number, number, number]> = [
    [76, 86, 96],
    [94, 104, 114],
    [114, 122, 128],
    [64, 72, 80],
    [122, 120, 112],
    [86, 94, 100],
    [104, 110, 114]
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const vv = v * rows;
    const row = Math.floor(vv) % rows;
    const fv = vv - Math.floor(vv);
    const cols = rowCols[row];
    const rowOff = hash2i(row, 99, seed) * 0.7;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const chipWarp = (tileFbm(u, v, 24, 24, 2, seed + 5) - 0.5) * 0.018;
      const uu = (((u + chipWarp) * cols + rowOff) % cols + cols) % cols;
      const col = Math.floor(uu);
      const fu = uu - col;

      const eU = Math.min(fu, 1.0 - fu) * (rows / cols);
      const eV = Math.min(fv, 1.0 - fv);
      const slabMask = smoothstep(0.012, 0.052, Math.min(eU, eV));

      const bid = hash2i(col % cols, row, seed);
      const grain = tileFbm(u, v, 18, 18, 3, seed + 29);
      const macroDamp = tileFbm(u, v, 4, 4, 3, seed + 73);
      const rainStreak = tileFbm(u, v, 24, 3, 2, seed + 151);

      const base = palette[Math.floor(bid * palette.length) % palette.length];
      const rainDark = 1.0 - smoothstep(0.56, 0.86, rainStreak) * 0.22;
      const shade = (0.88 + (bid - 0.5) * 0.22 + (grain - 0.5) * 0.14 - (macroDamp - 0.5) * 0.14) * rainDark;

      let r = lerp(38, base[0] * shade, slabMask);
      let g = lerp(42, base[1] * shade, slabMask);
      let b = lerp(45, base[2] * shade, slabMask);

      // Subtle lichen / dark moss in damp crevices
      const lichen = (1.0 - slabMask * 0.8) * smoothstep(0.50, 0.84, macroDamp) * 0.42;
      r = lerp(r, 46, lichen);
      g = lerp(g, 56, lichen);
      b = lerp(b, 40, lichen);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.24, 0.72 + (grain - 0.5) * 0.14, slabMask));
      rough[i] = clamp01(lerp(0.94, 0.58 + (grain - 0.5) * 0.18 + (1.0 - rainDark) * 0.25, slabMask));
      ao[i] = clamp01(lerp(0.46, 0.96, slabMask));
    }
  }
  return buildSobelPbrSet(
    albedo,
    height,
    rough,
    ao,
    size,
    2.8,
    opts.repeatX ?? 1,
    opts.repeatY ?? 1,
    opts.renderer
  );
}

/**
 * 3. Craggy Multi-Scale Voronoi Rough-Coursed Mossy Fieldstone Embankment (Photo 2 Kim Thủy Moat) — NM-19
 */
export function createHueRubbleMoatPbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer; repeatX?: number; repeatY?: number } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 128 : (opts.size ?? 512);
  const seed = 5323;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const gx = 9;
  const gy = 11;
  const palettes: Array<[number, number, number]> = [
    [168, 166, 158],
    [134, 132, 124],
    [94, 96, 88],
    [54, 56, 52],
    [118, 110, 96],
    [76, 80, 70]
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const sx = u * gx;
      const sy = v * gy;
      const cx = Math.floor(sx);
      const cy = Math.floor(sy);

      let d1 = 99;
      let d2 = 99;
      let bestId = 0;

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = ((cx + ox) % gx + gx) % gx;
          const ny = ((cy + oy) % gy + gy) % gy;
          const px = cx + ox + 0.16 + hash2i(nx, ny, seed + 13) * 0.68;
          const py = cy + oy + 0.16 + hash2i(nx, ny, seed + 47) * 0.68;
          const dx = (sx - px) * 0.85; // slightly elongated horizontal fieldstones
          const dy = (sy - py) * 1.15;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            bestId = hash2i(nx, ny, seed + 89);
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }

      const edgeDist = d2 - d1;
      const stoneMask = smoothstep(0.035, 0.15, edgeDist);
      const grain = tileFbm(u, v, 24, 24, 3, seed + 79);
      const mossMacro = tileFbm(u, v, 6, 6, 2, seed + 131);

      const baseC = palettes[Math.floor(bestId * palettes.length) % palettes.length];
      const rockFacet = 0.78 + (grain - 0.5) * 0.42 + (1.0 - clamp01(d1)) * 0.18;
      let r = lerp(22, baseC[0] * rockFacet, stoneMask);
      let g = lerp(24, baseC[1] * rockFacet, stoneMask);
      let b = lerp(20, baseC[2] * rockFacet, stoneMask);

      // Deep mossy crevices & dark wet waterline algae near bottom (v > 0.72)
      const moss = (1.0 - stoneMask * 0.72) * smoothstep(0.36, 0.76, mossMacro) * 0.65;
      const waterline = smoothstep(0.68, 0.98, v) * 0.55;
      r = lerp(r, 34, moss);
      g = lerp(g, 52, moss);
      b = lerp(b, 26, moss);
      r = lerp(r, 20, waterline);
      g = lerp(g, 28, waterline);
      b = lerp(b, 18, waterline);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.10, 0.76 + (grain - 0.5) * 0.22 + (1.0 - clamp01(d1)) * 0.16, stoneMask));
      rough[i] = clamp01(lerp(0.96, 0.80 + (grain - 0.5) * 0.14 - waterline * 0.35, stoneMask));
      ao[i] = clamp01(lerp(0.24, 0.96, stoneMask));
    }
  }
  return buildSobelPbrSet(
    albedo,
    height,
    rough,
    ao,
    size,
    5.2,
    opts.repeatX ?? 1,
    opts.repeatY ?? 1,
    opts.renderer
  );
}

/**
 * 3b. Cool-Weathered Horizontally Coursed Ancient Huế Citadel Brick (`Gạch Vồ`) — NM-14
 */
export function createHueBastionBrickPbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer; repeatX?: number; repeatY?: number } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 128 : (opts.size ?? 512);
  const seed = 5509;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 18;
  const cols = 7;
  const brickPalette: Array<[number, number, number]> = [
    [118, 112, 102],
    [98, 94, 86],
    [130, 121, 108],
    [84, 82, 76],
    [110, 103, 94],
    [122, 114, 100]
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const vv = v * rows;
    const row = Math.floor(vv);
    const fv = vv - row;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const uu = ((u * cols + (row % 2) * 0.5) % cols + cols) % cols;
      const col = Math.floor(uu);
      const fu = uu - col;

      const eU = Math.min(fu, 1.0 - fu) * (rows / cols);
      const eV = Math.min(fv, 1.0 - fv);
      const brickMask = smoothstep(0.05, 0.14, Math.min(eU, eV));

      const bid = hash2i(col % cols, row % rows, seed);
      const grain = tileFbm(u, v, 24, 24, 3, seed + 17);
      const rainStreak = tileFbm(u, v, 20, 2, 3, seed + 61);
      const efflorescence = smoothstep(0.68, 0.90, tileFbm(u, v, 7, 7, 2, seed + 109));

      const base = brickPalette[Math.floor(bid * brickPalette.length) % brickPalette.length];
      const rainDark = 1.0 - smoothstep(0.50, 0.84, rainStreak) * 0.34;
      const shade = (0.88 + (bid - 0.5) * 0.22 + (grain - 0.5) * 0.14) * rainDark;

      // Pale weathered lime mortar vs cool weathered taupe-umber brick
      let r = lerp(146 * rainDark, base[0] * shade, brickMask);
      let g = lerp(142 * rainDark, base[1] * shade, brickMask);
      let b = lerp(132 * rainDark, base[2] * shade, brickMask);

      // Subtle lime efflorescence patches
      r = lerp(r, 158, efflorescence * 0.24);
      g = lerp(g, 154, efflorescence * 0.24);
      b = lerp(b, 144, efflorescence * 0.24);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.32, 0.72 + (grain - 0.5) * 0.16, brickMask));
      rough[i] = clamp01(lerp(0.95, 0.86 + (grain - 0.5) * 0.08, brickMask));
      ao[i] = clamp01(lerp(0.58, 0.96, brickMask));
    }
  }
  return buildSobelPbrSet(albedo, height, rough, ao, size, 2.8, opts.repeatX ?? 1, opts.repeatY ?? 1, opts.renderer);
}

/**
 * 3c. Polychrome `Khảm Sành Sứ` Glazed Porcelain-Shard Mosaic PBR (Roof Ridges & Dragons) — EX-04, NM-06
 */
export function createHueCeramicMosaicPbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 64 : (opts.size ?? 256);
  const seed = 6113;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const shards: Array<[number, number, number]> = [
    [186, 174, 152], // aged ivory porcelain
    [164, 92, 68],   // coral terracotta shard
    [72, 114, 146],  // cobalt porcelain shard
    [82, 128, 98],   // celadon shard
    [182, 142, 64],  // amber ochre shard
    [118, 108, 96]   // weathered antique stone mortar
  ];

  const cells = 14;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const sx = u * cells;
      const sy = v * cells;
      const cx = Math.floor(sx);
      const cy = Math.floor(sy);
      let d1 = 99;
      let d2 = 99;
      let sid = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = ((cx + ox) % cells + cells) % cells;
          const ny = ((cy + oy) % cells + cells) % cells;
          const px = cx + ox + 0.2 + hash2i(nx, ny, seed + 3) * 0.6;
          const py = cy + oy + 0.2 + hash2i(nx, ny, seed + 19) * 0.6;
          const dist = Math.hypot(sx - px, sy - py);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            sid = hash2i(nx, ny, seed + 41);
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }
      const shardMask = smoothstep(0.05, 0.14, d2 - d1);
      const col = shards[Math.floor(sid * shards.length) % shards.length];
      const grain = tileFbm(u, v, 16, 16, 2, seed + 71);
      const i = y * size + x;
      const o = i * 4;
      albedo[o] = clampByte(lerp(72, col[0] * (0.9 + (grain - 0.5) * 0.18), shardMask));
      albedo[o + 1] = clampByte(lerp(66, col[1] * (0.9 + (grain - 0.5) * 0.18), shardMask));
      albedo[o + 2] = clampByte(lerp(58, col[2] * (0.9 + (grain - 0.5) * 0.18), shardMask));
      albedo[o + 3] = 255;
      height[i] = clamp01(lerp(0.25, 0.80 + (grain - 0.5) * 0.10, shardMask));
      rough[i] = clamp01(lerp(0.92, 0.34 + (grain - 0.5) * 0.14, shardMask));
      ao[i] = clamp01(lerp(0.42, 0.98, shardMask));
    }
  }
  return buildSobelPbrSet(albedo, height, rough, ao, size, 3.2, 1, 1, opts.renderer);
}

/**
 * 3d. Antique Weathered Brick-Red Terracotta PBR (Bonsai Pedestals & Bastion Lattice) — EX-16, NM-11
 */
export function createHueAgedTerracottaPbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 64 : (opts.size ?? 256);
  const seed = 6217;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const clay = tileFbm(u, v, 12, 12, 3, seed);
      const streak = tileFbm(u, v, 18, 2, 2, seed + 31);
      const lime = smoothstep(0.64, 0.88, tileFbm(u, v, 6, 6, 2, seed + 77));
      const darkRain = 1.0 - smoothstep(0.52, 0.84, streak) * 0.34;
      const i = y * size + x;
      const o = i * 4;
      let r = (128 + (clay - 0.5) * 28) * darkRain;
      let g = (58 + (clay - 0.5) * 18) * darkRain;
      let b = (44 + (clay - 0.5) * 14) * darkRain;
      r = lerp(r, 152, lime * 0.28);
      g = lerp(g, 144, lime * 0.28);
      b = lerp(b, 134, lime * 0.28);
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(0.5 + (clay - 0.5) * 0.35);
      rough[i] = clamp01(0.84 + (clay - 0.5) * 0.12);
      ao[i] = clamp01(0.75 + darkRain * 0.22);
    }
  }
  return buildSobelPbrSet(albedo, height, rough, ao, size, 2.2, 1, 1, opts.renderer);
}

/**
 * 3e. Dark Mossy Antique Stone PBR (Kim Thủy Moat & Bridge Balustrades) — NM-18
 */
export function createHueWeatheredMoatStonePbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 64 : (opts.size ?? 256);
  const seed = 6311;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const stone = tileFbm(u, v, 14, 14, 3, seed);
      const streak = tileFbm(u, v, 16, 2, 2, seed + 29);
      const moss = smoothstep(0.54, 0.84, tileFbm(u, v, 7, 7, 2, seed + 83));
      const darkRain = 1.0 - smoothstep(0.46, 0.82, streak) * 0.38;
      const i = y * size + x;
      const o = i * 4;
      let r = (108 + (stone - 0.5) * 30) * darkRain;
      let g = (106 + (stone - 0.5) * 28) * darkRain;
      let b = (98 + (stone - 0.5) * 26) * darkRain;
      r = lerp(r, 46, moss * 0.45);
      g = lerp(g, 58, moss * 0.45);
      b = lerp(b, 38, moss * 0.45);
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(0.48 + (stone - 0.5) * 0.36);
      rough[i] = clamp01(0.86 + (stone - 0.5) * 0.12);
      ao[i] = clamp01(0.64 + darkRain * 0.30);
    }
  }
  return buildSobelPbrSet(albedo, height, rough, ao, size, 2.6, 1, 1, opts.renderer);
}

/**
 * 3f. Deep Mirror-Gloss Blood-Ruby `Sơn Son` Lacquered Woodgrain PBR — AS-22, IN-02
 */
export function createHueCrimsonLacquerPbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 64 : (opts.size ?? 256);
  const seed = 6421;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const fiber = tileFbm(u, v, 4, 24, 3, seed);
      const lacquer = tileFbm(u, v, 8, 8, 2, seed + 43);
      const i = y * size + x;
      const o = i * 4;
      albedo[o] = clampByte(96 + (fiber - 0.5) * 24 + (lacquer - 0.5) * 14);
      albedo[o + 1] = clampByte(7 + (fiber - 0.5) * 4);
      albedo[o + 2] = clampByte(9 + (fiber - 0.5) * 5);
      albedo[o + 3] = 255;
      height[i] = clamp01(0.5 + (fiber - 0.5) * 0.24 + (lacquer - 0.5) * 0.10);
      rough[i] = clamp01(0.16 + (fiber - 0.5) * 0.08 + (lacquer - 0.5) * 0.06);
      ao[i] = clamp01(0.84 + (fiber - 0.5) * 0.16);
    }
  }
  return buildSobelPbrSet(albedo, height, rough, ao, size, 1.4, 1, 1, opts.renderer);
}

/**
 * 3g. High-Contrast Burnished 24K Carved-Gold Relief PBR (`Thếp Vàng Chạm Nổi`) — AS-23, CL-16
 *     Raised scroll crests gleam 24K gold (#f8cb46, rough 0.18), deep undercuts drop to dark burnt-amber (#4a1e04)!
 */
export function createHueCarvedGoldPbrTextures(
  opts: { size?: number; renderer?: THREE.WebGLRenderer } = {}
): PbrTextureSet {
  const headless = isHeadlessRenderer(opts.renderer);
  const size = headless ? 64 : (opts.size ?? 256);
  const seed = 6553;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Swirling baroque cloud-scroll relief ridges + fine hammered gold-leaf micro-texture
      const swirlA = Math.sin((u * 6 + Math.sin(v * Math.PI * 4) * 0.35) * Math.PI * 2);
      const swirlB = Math.cos((v * 6 + Math.sin(u * Math.PI * 4) * 0.35) * Math.PI * 2);
      const scrollRidge = smoothstep(-0.35, 0.72, swirlA * 0.55 + swirlB * 0.45);
      const hammer = tileFbm(u, v, 20, 20, 3, seed);
      const relief = clamp01(scrollRidge * 0.76 + hammer * 0.24);
      const i = y * size + x;
      const o = i * 4;
      albedo[o] = clampByte(lerp(82, 246, relief));
      albedo[o + 1] = clampByte(lerp(36, 198, relief));
      albedo[o + 2] = clampByte(lerp(6, 56, relief));
      albedo[o + 3] = 255;
      height[i] = relief;
      rough[i] = clamp01(lerp(0.54, 0.17, relief));
      ao[i] = clamp01(lerp(0.32, 1.0, relief));
    }
  }
  return buildSobelPbrSet(albedo, height, rough, ao, size, 3.6, 1, 1, opts.renderer);
}

/**
 * 3h. Embossed Antique Cast-Bronze Dragon-Cloud Relief PBR (`Bửu Đỉnh`) — IN-20
 */
export function createHueBuuDinhReliefPbrTextures(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const size = headless ? 64 : 512;
  const cObj = makeCanvas(size, size);
  const hObj = makeCanvas(size, size);
  if (!cObj || !hObj) {
    const flat = finalizeDataTex(new Uint8Array([42, 44, 40, 255]), 1, true, 1, 1, 1, renderer);
    const flatN = finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, false, 1, 1, 1, renderer);
    return { map: flat, normalMap: flatN, roughnessMap: flatN, aoMap: flatN };
  }
  const c = cObj.ctx;
  const h = hObj.ctx;
  const S = size / 512;

  // Dark charcoal-verdigris antique cast bronze base
  c.fillStyle = '#252824';
  c.fillRect(0, 0, size, size);
  h.fillStyle = '#3a3a3a';
  h.fillRect(0, 0, size, size);

  // Subtle bronze verdigris & rubbed patina mottling
  for (let i = 0; i < 420; i++) {
    const px = hash2i(i, 1, 701) * size;
    const py = hash2i(i, 2, 701) * size;
    const rad = (6 + hash2i(i, 3, 701) * 18) * S;
    c.fillStyle = i % 3 === 0 ? 'rgba(66, 60, 46, 0.14)' : 'rgba(32, 46, 38, 0.12)';
    c.beginPath();
    c.arc(px, py, rad, 0, Math.PI * 2);
    c.fill();
  }

  // Upper & lower equatorial key-fret (`Chữ Vạn` / `Hồi Văn`) & beaded casting bands
  const paintBand = (y0: number) => {
    for (const ctx of [c, h]) {
      const isC = ctx === c;
      ctx.strokeStyle = isC ? '#564c3a' : '#d8d8d8';
      ctx.lineWidth = 4 * S;
      ctx.strokeRect(0, y0, size, 32 * S);
      for (let bx = 8 * S; bx < size; bx += 36 * S) {
        ctx.strokeRect(bx, y0 + 6 * S, 24 * S, 20 * S);
        ctx.beginPath();
        ctx.moveTo(bx + 6 * S, y0 + 16 * S);
        ctx.lineTo(bx + 18 * S, y0 + 16 * S);
        ctx.stroke();
      }
    }
  };
  paintBand(76 * S);
  paintBand(404 * S);

  // Embossed swirling dragons & cloud reliefs across the spherical cauldron belly
  for (let d = 0; d < 2; d++) {
    const startX = d * 256 * S;
    for (const ctx of [c, h]) {
      const isC = ctx === c;
      ctx.strokeStyle = isC ? '#544a38' : '#e6e6e6';
      ctx.lineWidth = 14 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0; t <= 24; t++) {
        const f = t / 24;
        const px = startX + 24 * S + f * 208 * S;
        const py = (256 + Math.sin(f * Math.PI * 2.5 + d) * 78) * S;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Swirling relief clouds around dragons
      for (let k = 0; k < 5; k++) {
        drawCongButCloud(
          ctx,
          startX + (38 + k * 46) * S,
          (176 + (k % 2) * 158) * S,
          0.65 * S,
          isC ? '#4a4232' : '#c8c8c8',
          isC ? '#665b45' : '#f2f2f2',
          isC ? '#1c1e1b' : '#404040'
        );
      }
    }
  }

  // Build roughness map (darker crevices matte 0.72, rubbed relief crests smoother 0.46)
  const rObj = makeCanvas(size, size);
  let roughTex: THREE.Texture;
  if (rObj) {
    rObj.ctx.fillStyle = '#b4b4b4';
    rObj.ctx.fillRect(0, 0, size, size);
    rObj.ctx.globalCompositeOperation = 'difference';
    rObj.ctx.globalAlpha = 0.42;
    rObj.ctx.drawImage(hObj.canvas, 0, 0);
    roughTex = wrapCanvasTex(rObj.canvas, false, 1, 1, renderer, THREE.RepeatWrapping);
  } else {
    roughTex = finalizeDataTex(new Uint8Array([140, 140, 140, 255]), 1, false, 1, 1, 1, renderer);
  }

  const map = wrapCanvasTex(cObj.canvas, true, 1, 1, renderer, THREE.RepeatWrapping);
  const normalMap = canvasToSobelNormal(hObj.canvas, 3.0, 1, 1, renderer, true);
  return { map, normalMap, roughnessMap: roughTex, aoMap: roughTex };
}

/**
 * Helper: Authentic Nguyễn-Dynasty `Công Bút` (工筆) 3-Tone Swirling Auspicious Cloud (`Mây Ngũ Sắc / Mây Hóa Long`)
 * Replaces the crude 5-circle stamp with graceful ruyi cloud heads + tapered S-ribbon tails + white highlight rims! — CL-10, IN-23
 */
function drawCongButCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  coreColor: string,
  rimHighlight: string,
  inkOutline?: string,
  flipX = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flipX, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Swirling tapered S-ribbon cloud tail (`đuôi mây`)
  ctx.beginPath();
  ctx.moveTo(-22, 6);
  ctx.bezierCurveTo(-40, 12, -52, -4, -36, -12);
  ctx.bezierCurveTo(-26, -16, -24, -4, -14, -4);
  ctx.bezierCurveTo(-12, -18, 6, -22, 16, -12);
  ctx.bezierCurveTo(28, -14, 38, -2, 30, 8);
  ctx.bezierCurveTo(22, 16, 8, 12, 0, 10);
  ctx.bezierCurveTo(-8, 14, -16, 12, -22, 6);
  ctx.closePath();

  // Outer luminous highlight rim
  ctx.fillStyle = rimHighlight;
  ctx.fill();
  if (inkOutline) {
    ctx.strokeStyle = inkOutline;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Inner rich mineral pigment core
  ctx.save();
  ctx.scale(0.80, 0.78);
  ctx.fillStyle = coreColor;
  ctx.fill();
  ctx.restore();

  // Delicate internal ruyi spiral curls (`vân mây`)
  ctx.strokeStyle = rimHighlight;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(2, -5, 6.5, Math.PI * 0.2, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(17, 1, 5.0, -Math.PI * 0.5, Math.PI * 1.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-14, 2, 4.8, Math.PI * 0.4, Math.PI * 1.8);
  ctx.stroke();

  ctx.restore();
}

/**
 * Helper: Fine lacy gilded Nguyễn scrollwork arabesque inside an oval/cartouche — IN-12, CL-26
 * ZERO cartoon daisies: intricate overlapping golden S-scroll vines, cloud volutes & lotus filigree on crimson!
 */
function drawGildedFiligreeOval(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  S: number,
  isMask: boolean
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Scalloped double molded golden outer oval ring (leaving crimson negative space inside!)
  ctx.strokeStyle = isMask ? '#f0f0f0' : '#f2c646';
  ctx.lineWidth = 5.5 * S;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = isMask ? '#dcdcdc' : '#b87a14';
  ctx.lineWidth = 2.0 * S;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx - 7 * S, ry - 7 * S, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Symmetric swirling gilded cloud-dragon & lotus-vine S-scrolls (`hoa văn dây lá hóa long`)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      // Main sweeping S-vine
      ctx.strokeStyle = isMask ? '#e8e8e8' : '#e4b02c';
      ctx.lineWidth = 4.2 * S;
      ctx.beginPath();
      ctx.moveTo(sx * rx * 0.14, sy * ry * 0.08);
      ctx.bezierCurveTo(
        sx * rx * 0.48,
        sy * ry * 0.02,
        sx * rx * 0.78,
        sy * ry * 0.42,
        sx * rx * 0.52,
        sy * ry * 0.68
      );
      ctx.bezierCurveTo(
        sx * rx * 0.34,
        sy * ry * 0.80,
        sx * rx * 0.16,
        sy * ry * 0.58,
        sx * rx * 0.28,
        sy * ry * 0.42
      );
      ctx.stroke();

      // Secondary branching leaf-scroll curl
      ctx.strokeStyle = isMask ? '#ffffff' : '#fae078';
      ctx.lineWidth = 2.6 * S;
      ctx.beginPath();
      ctx.moveTo(sx * rx * 0.42, sy * ry * 0.26);
      ctx.bezierCurveTo(
        sx * rx * 0.72,
        sy * ry * 0.14,
        sx * rx * 0.86,
        sy * ry * 0.04,
        sx * rx * 0.76,
        -sy * ry * 0.14
      );
      ctx.stroke();

      // Small curled cloud volute buds along vine
      ctx.fillStyle = isMask ? '#f2f2f2' : '#f4cf58';
      for (const [bx, by, br] of [
        [0.58, 0.48, 5.5],
        [0.32, 0.56, 4.5],
        [0.72, 0.16, 4.8],
        [0.24, 0.28, 3.8]
      ]) {
        ctx.beginPath();
        ctx.arc(sx * rx * bx, sy * ry * by, br * S, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Central sculpted stylized imperial lotus / stylized bat-cloud medallion (`hoa sen / phúc`)
  ctx.fillStyle = isMask ? '#e8e8e8' : '#d6981c';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.22, ry * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isMask ? '#ffffff' : '#fff09c';
  ctx.lineWidth = 2.2 * S;
  ctx.stroke();
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rx * 0.08, Math.sin(a) * ry * 0.08);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.25) * rx * 0.22,
      Math.sin(a + 0.25) * ry * 0.22,
      Math.cos(a) * rx * 0.26,
      Math.sin(a) * ry * 0.26
    );
    ctx.stroke();
  }
  ctx.fillStyle = isMask ? '#ffffff' : '#fff0a4';
  ctx.beginPath();
  ctx.arc(0, 0, 5.5 * S, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 4. 1024×1024 Mirror-Gloss Ruby Lacquer + Fine-Scaled Sinuous 24K Gold Dragons & Clouds
 *    (`Cột gỗ lim sơn son thếp vàng vẽ rồng mây` — AS-14, CL-29, IN-23!)
 *    Now generates a TRUE Sobel `normalMap` from the gold-height relief canvas!
 */
export function createHueDragonColumnPbrTextures(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 1024;
  const h = headless ? 128 : 1024;
  const colorC = makeCanvas(w, h);
  const metalC = makeCanvas(w, h);
  const roughC = makeCanvas(w, h);

  if (!colorC || !metalC || !roughC) {
    const flat = finalizeDataTex(new Uint8Array([84, 8, 10, 255]), 1, true, 1, 1, 1, renderer);
    const flatLin = finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, false, 1, 1, 1, renderer);
    return { map: flat, normalMap: flatLin, roughnessMap: flatLin, metalnessMap: flatLin };
  }

  const c = colorC.ctx;
  const m = metalC.ctx;
  const r = roughC.ctx;
  const S = w / 1024;

  // Deep electric blood-ruby mirror lacquer (#420205 -> #620609)
  const bgGrad = c.createLinearGradient(0, 0, w, 0);
  bgGrad.addColorStop(0, '#400205');
  bgGrad.addColorStop(0.5, '#620609');
  bgGrad.addColorStop(1, '#400205');
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, w, h);

  // Subtle vertical wood-lacquer sheen streaks
  c.fillStyle = 'rgba(130, 12, 16, 0.14)';
  for (let vx = 0; vx < w; vx += 18 * S) {
    c.fillRect(vx, 0, 5 * S, h);
  }

  m.fillStyle = '#060606';
  m.fillRect(0, 0, w, h);

  const paintGold = (fn: (ctx: CanvasRenderingContext2D, isMask: boolean) => void) => {
    fn(c, false);
    fn(m, true);
  };

  // Sleek, refined compact top & bottom gilded collar bands (NO oversized cartoon yellow zigzag triangles! CL-29, IN-23)
  paintGold((ctx, isMask) => {
    ctx.fillStyle = isMask ? '#e8e8e8' : '#e6b22c';
    ctx.strokeStyle = isMask ? '#ffffff' : '#fae078';
    for (const bandY of [18 * S, 976 * S]) {
      ctx.fillRect(0, bandY, w, 6 * S);
      ctx.fillRect(0, bandY + 20 * S, w, 5 * S);
      ctx.lineWidth = 2.6 * S;
      for (let kx = 0; kx < w; kx += 36 * S) {
        ctx.strokeRect(kx + 4 * S, bandY + 8 * S, 26 * S, 10 * S);
      }
    }
    // Delicate refined slim lotus petals (compact 3.5% height)
    ctx.lineWidth = 2.2 * S;
    for (let px = 0; px < w; px += 44 * S) {
      ctx.beginPath();
      ctx.moveTo(px + 4 * S, 46 * S);
      ctx.quadraticCurveTo(px + 22 * S, 76 * S, px + 40 * S, 46 * S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + 4 * S, 972 * S);
      ctx.quadraticCurveTo(px + 22 * S, 942 * S, px + 40 * S, 972 * S);
      ctx.stroke();
    }
  });

  // Three Intertwined Slim, Finely Scaled Sinuous 24K Gold Dragons
  for (let dIdx = 0; dIdx < 3; dIdx++) {
    const phaseX = dIdx * 341;
    const numSegs = 92;
    const pts: Array<[number, number, number]> = [];
    for (let s = 0; s <= numSegs; s++) {
      const t = s / numSegs;
      const py = lerp(930, 86, t);
      const px = (phaseX + t * 980 + Math.sin(t * Math.PI * 4.4 + dIdx * 1.1) * 118) % 1024;
      // Slimmer, sleeker dragon silhouette (`0.72x` previous pancake width)
      const rad = (7 + Math.sin(t * Math.PI) * 21 + (t > 0.88 ? 6 : 0)) * S;
      pts.push([px * S, py * S, rad]);
    }

    for (const wrapOff of [-w, 0, w]) {
      paintGold((ctx, isMask) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let s = 0; s < pts.length - 1; s++) {
          const [x0, y0, r0] = pts[s];
          const [x1, y1] = pts[s + 1];
          if (Math.abs(x1 - x0) > w * 0.35) continue;
          const bx = x0 + wrapOff;
          if (bx < -70 * S || bx > w + 70 * S) continue;

          // Sinuous tapered dorsal flame wisps
          if (s % 3 === 0) {
            ctx.strokeStyle = isMask ? '#f5f5f5' : '#fae078';
            ctx.lineWidth = 2.8 * S;
            ctx.beginPath();
            ctx.moveTo(bx + r0 * 0.7, y0 - r0 * 0.2);
            ctx.quadraticCurveTo(bx + r0 * 1.5, y0 - r0 * 0.9, bx + r0 * 1.95, y0 - r0 * 0.55);
            ctx.stroke();
          }

          // Layered crescent gold scales (3 staggered imbricated arcs per segment instead of flat pancake circles!)
          ctx.fillStyle = isMask ? '#e2e2e2' : (s % 2 === 0 ? '#e8b630' : '#cf961c');
          ctx.beginPath();
          ctx.arc(bx, y0, r0, 0, Math.PI * 2);
          ctx.fill();

          if (!isMask) {
            // Fine dark sepia-bronze scale contours for museum embossed clarity
            ctx.strokeStyle = '#5a2c04';
            ctx.lineWidth = 1.4 * S;
            for (const oy of [-0.42, 0.0, 0.42]) {
              ctx.beginPath();
              ctx.arc(bx + oy * r0 * 0.55, y0 + oy * r0 * 0.28, r0 * 0.46, 0.15, Math.PI * 1.1);
              ctx.stroke();
            }
            // Bright 24K ridge specular highlight
            ctx.fillStyle = '#fff098';
            ctx.beginPath();
            ctx.arc(bx - r0 * 0.28, y0 - r0 * 0.24, r0 * 0.24, 0, Math.PI * 2);
            ctx.fill();
          }

          // Muscular 5-clawed golden limbs with wispy elbow flames at s = 24 & s = 60
          if (s === 24 || s === 60) {
            const side = s === 24 ? 1 : -1;
            ctx.strokeStyle = isMask ? '#f0f0f0' : '#f2c646';
            ctx.lineWidth = 5.5 * S;
            ctx.beginPath();
            ctx.moveTo(bx, y0);
            ctx.quadraticCurveTo(bx + side * 42 * S, y0 - 16 * S, bx + side * 62 * S, y0 + 14 * S);
            ctx.stroke();
            ctx.lineWidth = 2.6 * S;
            for (let cl = -2; cl <= 2; cl++) {
              ctx.beginPath();
              ctx.moveTo(bx + side * 60 * S, y0 + 13 * S);
              ctx.quadraticCurveTo(
                bx + side * 72 * S,
                y0 + (8 + cl * 5) * S,
                bx + side * (82 + Math.abs(cl) * 2) * S,
                y0 + (12 + cl * 7) * S
              );
              ctx.stroke();
            }
          }
        }

        // Sculpted Fierce Imperial Dragon Head at apex
        const [hxRaw, hy, hr] = pts[pts.length - 1];
        const hx = hxRaw + wrapOff;
        if (hx > -110 * S && hx < w + 110 * S) {
          ctx.fillStyle = isMask ? '#ffffff' : '#f4c848';
          ctx.beginPath();
          ctx.ellipse(hx, hy, hr * 2.0, hr * 1.4, -0.22, 0, Math.PI * 2);
          ctx.fill();
          if (!isMask) {
            ctx.strokeStyle = '#5a2c04';
            ctx.lineWidth = 2.0 * S;
            ctx.stroke();
          }
          // Delicate branching antlers & razor-thin sweeping whiskers
          ctx.strokeStyle = isMask ? '#ffffff' : '#fff098';
          ctx.lineWidth = 3.2 * S;
          ctx.beginPath();
          ctx.moveTo(hx - 10 * S, hy - 18 * S);
          ctx.quadraticCurveTo(hx - 42 * S, hy - 64 * S, hx - 14 * S, hy - 82 * S);
          ctx.moveTo(hx + 14 * S, hy - 18 * S);
          ctx.quadraticCurveTo(hx + 48 * S, hy - 60 * S, hx + 22 * S, hy - 78 * S);
          ctx.stroke();
          ctx.lineWidth = 2.0 * S;
          ctx.beginPath();
          ctx.moveTo(hx + 22 * S, hy + 8 * S);
          ctx.bezierCurveTo(hx + 52 * S, hy - 6 * S, hx + 68 * S, hy + 28 * S, hx + 94 * S, hy + 12 * S);
          ctx.stroke();
          // Flaming Sacred Pearl
          ctx.fillStyle = isMask ? '#ffffff' : '#fff2a4';
          ctx.beginPath();
          ctx.arc(hx + 66 * S, hy - 18 * S, 13 * S, 0, Math.PI * 2);
          ctx.fill();
          if (!isMask) {
            ctx.fillStyle = '#3a0406';
            ctx.beginPath();
            ctx.arc(hx - 10 * S, hy - 5 * S, 4.5 * S, 0, Math.PI * 2);
            ctx.arc(hx + 12 * S, hy - 5 * S, 4.5 * S, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }
  }

  // Graceful Swirling `Công Bút` Golden Auspicious Clouds (`Mây Hóa Long`) filling inter-coil space
  for (let i = 0; i < 62; i++) {
    const cxPos = hash2i(i, 1, 7711) * w;
    const cyPos = (84 + hash2i(i, 2, 7711) * 840) * S;
    const sc = (0.78 + hash2i(i, 3, 7711) * 0.85) * S;
    const flip = i % 2 === 0 ? 1 : -1;
    for (const wrapOff of [-w, 0, w]) {
      const px = cxPos + wrapOff;
      if (px < -70 * S || px > w + 70 * S) continue;
      paintGold((ctx, isMask) => {
        drawCongButCloud(
          ctx,
          px,
          cyPos,
          sc,
          isMask ? '#c8c8c8' : '#dea628',
          isMask ? '#f4f4f4' : '#fae07c',
          isMask ? undefined : '#643206',
          flip
        );
      });
    }
  }

  // Physical roughness map: mirror-gloss ruby lacquer = 0.16 (#292929), brushed 24K gold = 0.24 (#3d3d3d)
  r.fillStyle = '#292929';
  r.fillRect(0, 0, w, h);
  r.globalAlpha = 0.22;
  r.drawImage(metalC.canvas, 0, 0);
  r.globalAlpha = 1.0;

  const map = wrapCanvasTex(colorC.canvas, true, 1, 1, renderer);
  const metalnessMap = wrapCanvasTex(metalC.canvas, false, 1, 1, renderer);
  // Subtle relief normal (`0.95`) prevents bright sky-specular outline halos around gold coils!
  const normalMap = canvasToSobelNormal(metalC.canvas, 0.95, 1, 1, renderer, true);
  const roughnessMap = wrapCanvasTex(roughC.canvas, false, 1, 1, renderer);
  for (const t of [map, metalnessMap, normalMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }

  return { map, normalMap, roughnessMap, metalnessMap };
}

/**
 * 5. 2048×2048 Museum-Grade `Công Bút` (工筆) `Cửu Long Ẩn Vân` Bửu Tán Ceiling Painting — CL-01..CL-14!
 *    Authentic Nguyễn Dynasty court brushwork matching Reference Photo #4:
 *    - Radiant mottled imperial saffron-gold ground + fine craquelure
 *    - True 45° interlocking `Chữ Vạn` (卍) swastika meander corners + circular seal-script `Chữ Thọ Tròn` (團壽)
 *    - Scalloped `Khánh` crimson cartouches with properly headed S-coiled outer dragons (#1-#4)
 *    - 4 full-bodied agile corner dragons (#5-#8)
 *    - Fierce anatomical front-facing `Chính Long` (#9) weaving through 3-tone `Mây Ngũ Sắc` clouds,
 *      4 muscular 5-clawed limbs, branching lavender-ivory antlers, sweeping razor whiskers & 12-o'clock `Hỏa Châu`!
 */
export function createHueCuuLongAnVanTexture(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 2048;
  const cObj = makeCanvas(sz, sz);
  const bObj = makeCanvas(sz, sz);
  if (!cObj || !bObj) {
    const flat = finalizeDataTex(new Uint8Array([238, 174, 24, 255]), 1, true, 1, 1, 1, renderer);
    return { map: flat, bumpMap: flat };
  }
  const { canvas, ctx } = cObj;
  const bCtx = bObj.ctx;
  const S = sz / 2048;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  bCtx.fillStyle = '#404040';
  bCtx.fillRect(0, 0, sz, sz);

  // 1. Slim gilded inner coffer lip + double-piped emerald/ivory outer perimeter border (CL-13)
  const frameGrad = ctx.createLinearGradient(0, 0, sz, sz);
  frameGrad.addColorStop(0, '#c8921c');
  frameGrad.addColorStop(0.5, '#fae076');
  frameGrad.addColorStop(1, '#a87212');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, sz, sz);

  const mOuter = 36 * S;
  ctx.fillStyle = '#185c36';
  ctx.fillRect(mOuter - 12 * S, mOuter - 12 * S, sz - (mOuter - 12 * S) * 2, sz - (mOuter - 12 * S) * 2);
  ctx.strokeStyle = '#f4ebd0';
  ctx.lineWidth = 3 * S;
  ctx.strokeRect(mOuter - 6 * S, mOuter - 6 * S, sz - (mOuter - 6 * S) * 2, sz - (mOuter - 6 * S) * 2);

  // Base imperial saffron-gold ground across outer register (visible in the 4 Chữ Vạn corners)
  ctx.fillStyle = '#dc9416';
  ctx.fillRect(mOuter, mOuter, sz - mOuter * 2, sz - mOuter * 2);

  // 2. TRUE 45° Interlocking `Chữ Vạn` (卍) Swastika Meander Corners (CL-11 — ZERO X-waffles!)
  const cornerW = 368 * S;
  const drawChuVanCorner = (rx: number, ry: number, rw: number, rh: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.fillStyle = '#dc9216';
    ctx.fillRect(rx, ry, rw, rh);

    // Rotate 45° and tile true interlocking crimson right-angle swastika meanders
    ctx.translate(rx + rw * 0.5, ry + rh * 0.5);
    ctx.rotate(Math.PI * 0.25);
    const cell = 64 * S;
    const arm = cell * 0.44;
    ctx.strokeStyle = '#8e1014';
    ctx.lineWidth = 9.5 * S;
    ctx.lineCap = 'square';
    for (let gy = -4; gy <= 4; gy++) {
      for (let gx = -4; gx <= 4; gx++) {
        const x = gx * cell + (gy % 2) * (cell * 0.5);
        const y = gy * cell;
        // True 4-arm clockwise 卍 motif
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        // Hooked ends creating interlocking meander continuity
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x + arm * 0.68, y - arm);
        ctx.moveTo(x + arm, y);
        ctx.lineTo(x + arm, y + arm * 0.68);
        ctx.moveTo(x, y + arm);
        ctx.lineTo(x - arm * 0.68, y + arm);
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x - arm, y - arm * 0.68);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const corners: Array<[number, number]> = [
    [mOuter, mOuter],
    [sz - mOuter - cornerW, mOuter],
    [mOuter, sz - mOuter - cornerW],
    [sz - mOuter - cornerW, sz - mOuter - cornerW]
  ];
  for (const [cx0, cy0] of corners) {
    drawChuVanCorner(cx0, cy0, cornerW, cornerW);
  }

  // Helper: Authentic Circular Seal-Script `Chữ Thọ Tròn` (團壽) Medallion (CL-12 — ZERO first-aid bullseyes!)
  const drawChuThoTron = (mx: number, my: number, rad: number) => {
    ctx.save();
    ctx.translate(mx, my);
    // Mineral powder-blue ground + concentric cream/indigo/crimson trim
    ctx.fillStyle = '#7c9ec0';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f4ebd2';
    ctx.lineWidth = 5 * S;
    ctx.stroke();
    ctx.strokeStyle = '#2d4b73';
    ctx.lineWidth = 4 * S;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.91, 0, Math.PI * 2);
    ctx.stroke();

    // Intricate symmetrical crimson seal-script 團壽 labyrinth inside medallion
    ctx.strokeStyle = '#b41820';
    ctx.lineWidth = 5.2 * S;
    ctx.lineCap = 'square';
    // Outer segmented seal-arc ring
    for (let k = 0; k < 4; k++) {
      const a0 = k * Math.PI * 0.5 + 0.14;
      const a1 = (k + 1) * Math.PI * 0.5 - 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.74, a0, a1);
      ctx.stroke();
    }
    // Vertical spine + horizontal symmetrical seal bars + nested inner scrolls
    ctx.beginPath();
    ctx.moveTo(0, -rad * 0.72);
    ctx.lineTo(0, rad * 0.72);
    for (const fy of [-0.48, -0.22, 0.22, 0.48]) {
      const wSpan = rad * (Math.abs(fy) > 0.3 ? 0.46 : 0.62);
      ctx.moveTo(-wSpan, rad * fy);
      ctx.lineTo(wSpan, rad * fy);
    }
    // Paired symmetric side hooks (exact seal-script 壽 symmetry)
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * rad * 0.46, -rad * 0.48);
      ctx.lineTo(sx * rad * 0.46, -rad * 0.22);
      ctx.moveTo(sx * rad * 0.34, -rad * 0.22);
      ctx.lineTo(sx * rad * 0.34, rad * 0.22);
      ctx.moveTo(sx * rad * 0.54, rad * 0.02);
      ctx.lineTo(sx * rad * 0.54, rad * 0.48);
      ctx.moveTo(sx * rad * 0.22, rad * 0.22);
      ctx.lineTo(sx * rad * 0.22, rad * 0.62);
    }
    ctx.stroke();
    ctx.restore();
  };

  for (const [cx0, cy0] of corners) {
    drawChuThoTron(cx0 + cornerW * 0.5, cy0 + cornerW * 0.5, 92 * S);
  }

  // Helper: Draw a true `Công Bút` tapered sinuous profile dragon with shaded crescent scales,
  // ventral belly band, 5-clawed legs, bifurcated tail, fierce head at the NECK (NOT stomach!) & layered clouds — CL-08, CL-09
  const drawProfileImperialDragon = (
    ctrlPts: Array<[number, number]>,
    scale: number,
    seed: number,
    cloudPalette: string[]
  ) => {
    const samples = 58;
    const pts: Array<[number, number, number, number, number]> = [];
    // Smooth Catmull-Rom / quadratic chain through control points
    for (let i = 0; i <= samples; i++) {
      const u = (i / samples) * (ctrlPts.length - 1);
      const seg = Math.min(ctrlPts.length - 2, Math.floor(u));
      const f = u - seg;
      const p0 = ctrlPts[Math.max(0, seg - 1)];
      const p1 = ctrlPts[seg];
      const p2 = ctrlPts[seg + 1];
      const p3 = ctrlPts[Math.min(ctrlPts.length - 1, seg + 2)];
      const f2 = f * f;
      const f3 = f2 * f;
      const px =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * f +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3);
      const py =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * f +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3);
      pts.push([px, py, 0, 0, 0]);
    }
    for (let i = 0; i <= samples; i++) {
      const pA = pts[Math.max(0, i - 1)];
      const pB = pts[Math.min(samples, i + 1)];
      const dx = pB[0] - pA[0];
      const dy = pB[1] - pA[1];
      const len = Math.hypot(dx, dy) || 1;
      pts[i][2] = dx / len;
      pts[i][3] = dy / len;
      const t = i / samples; // t=0: pointed bifurcated tail, t=1: sleek neck/head
      pts[i][4] = (3.5 + Math.sin(Math.pow(t, 0.72) * Math.PI) * 18.5 + (t > 0.82 ? 3.5 : 0)) * scale;
    }

    // Back-layer 5-color auspicious ribbon clouds (behind dragon coils)
    for (let i = 6; i < samples - 6; i += 10) {
      const [px, py, tx, ty] = pts[i];
      const nx = -ty;
      const ny = tx;
      const side = (i + seed) % 2 === 0 ? 1 : -1;
      drawCongButCloud(
        ctx,
        px + nx * side * 34 * scale,
        py + ny * side * 34 * scale,
        0.92 * scale,
        cloudPalette[(i + seed) % cloudPalette.length],
        '#f7efd6',
        '#3d1a08',
        side
      );
    }

    // Bifurcated multi-forked curling flame tail at t = 0
    const [tailX, tailY, tailTx, tailTy] = pts[0];
    const tailNx = -tailTy;
    const tailNy = tailTx;
    for (const fork of [-1, 0, 1]) {
      ctx.strokeStyle = fork === 0 ? '#1d7a4a' : '#d89a1c';
      ctx.lineWidth = (fork === 0 ? 5.5 : 4.2) * scale;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.quadraticCurveTo(
        tailX - tailTx * 22 * scale + tailNx * fork * 18 * scale,
        tailY - tailTy * 22 * scale + tailNy * fork * 18 * scale,
        tailX - tailTx * 42 * scale + tailNx * fork * 28 * scale,
        tailY - tailTy * 42 * scale + tailNy * fork * 28 * scale
      );
      ctx.stroke();
    }

    // Tapered shaded scaled dragon body + cream ventral belly + dorsal flame licks
    for (let i = 1; i < samples - 1; i++) {
      const [px, py, tx, ty, rad] = pts[i];
      const nx = -ty;
      const ny = tx;

      // Sinuous dorsal flame crest licks
      if (i % 3 === 0) {
        ctx.strokeStyle = i % 6 === 0 ? '#c82026' : '#f8dc72';
        ctx.lineWidth = 3.0 * scale;
        ctx.beginPath();
        ctx.moveTo(px + nx * rad * 0.75, py + ny * rad * 0.75);
        ctx.quadraticCurveTo(
          px + nx * rad * 1.75 - tx * 8 * scale,
          py + ny * rad * 1.75 - ty * 8 * scale,
          px + nx * rad * 2.1 - tx * 16 * scale,
          py + ny * rad * 2.1 - ty * 16 * scale
        );
        ctx.stroke();
      }

      // Cylindrical shaded golden body
      const bodyGrad = ctx.createRadialGradient(
        px - nx * rad * 0.3,
        py - ny * rad * 0.3,
        rad * 0.1,
        px,
        py,
        rad
      );
      bodyGrad.addColorStop(0, '#fce078');
      bodyGrad.addColorStop(0.55, '#c88816');
      bodyGrad.addColorStop(1, '#6c3806');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();

      // Bump height contribution
      bCtx.fillStyle = '#c0c0c0';
      bCtx.beginPath();
      bCtx.arc(px, py, rad, 0, Math.PI * 2);
      bCtx.fill();

      // Ribbed cream ventral belly strip along inner curve
      ctx.fillStyle = '#f2e0a8';
      ctx.beginPath();
      ctx.arc(px - nx * rad * 0.48, py - ny * rad * 0.48, rad * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Crisp fine công bút sepia scale outline
      ctx.strokeStyle = '#421c04';
      ctx.lineWidth = 1.4 * scale;
      ctx.beginPath();
      ctx.arc(px, py, rad * 0.84, Math.atan2(ny, nx) - 0.9, Math.atan2(ny, nx) + 0.9);
      ctx.stroke();

      // Muscular 5-clawed limbs with emerald/crimson elbow flames at i = 18 & i = 40
      if (i === 18 || i === 40) {
        const side = i === 18 ? -1 : 1;
        const ex = px + nx * side * 26 * scale - tx * 8 * scale;
        const ey = py + ny * side * 26 * scale - ty * 8 * scale;
        const fx = ex + nx * side * 18 * scale + tx * 20 * scale;
        const fy = ey + ny * side * 18 * scale + ty * 20 * scale;
        ctx.strokeStyle = '#d49418';
        ctx.lineWidth = 6.5 * scale;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        ctx.strokeStyle = '#4a2004';
        ctx.lineWidth = 1.4 * scale;
        ctx.stroke();
        // Elbow flame tuft
        ctx.strokeStyle = i === 18 ? '#1c7848' : '#c62026';
        ctx.lineWidth = 3.2 * scale;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - tx * 22 * scale + nx * side * 8 * scale, ey - ty * 22 * scale + ny * side * 8 * scale);
        ctx.stroke();
        // 5 ivory talons
        ctx.strokeStyle = '#fff6dc';
        ctx.lineWidth = 2.2 * scale;
        for (let cl = -2; cl <= 2; cl++) {
          const ang = Math.atan2(fy - ey, fx - ex) + cl * 0.32;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + Math.cos(ang) * 14 * scale, fy + Math.sin(ang) * 14 * scale);
          ctx.stroke();
        }
      }
    }

    // Foreground overlapping cloud puff (true `Ẩn Vân` weaving!)
    const [midX, midY, midTx, midTy] = pts[Math.floor(samples * 0.45)];
    drawCongButCloud(
      ctx,
      midX - midTy * 8 * scale,
      midY + midTx * 8 * scale,
      0.86 * scale,
      cloudPalette[(seed + 1) % cloudPalette.length],
      '#fff4d6',
      '#3d1a08'
    );

    // Fierce Profile Nguyễn Dragon Head cleanly placed at the NECK APEX (t = 0.94, NOT stomach!)
    const [hx, hy, htx, hty, hrad] = pts[samples - 3];
    const hnx = -hty;
    const hny = htx;
    const headAng = Math.atan2(hty, htx);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(headAng);

    // Streaming polychrome flame mane behind head
    const maneCols = ['#1e58a4', '#197a49', '#c41c24', '#f5e8be'];
    for (let m = 0; m < 7; m++) {
      ctx.strokeStyle = maneCols[m % maneCols.length];
      ctx.lineWidth = 4.2 * scale;
      const my = (-18 + m * 6) * scale;
      ctx.beginPath();
      ctx.moveTo(-6 * scale, my * 0.5);
      ctx.quadraticCurveTo(-24 * scale, my * 1.4, -44 * scale, my * 1.1);
      ctx.stroke();
    }
    // Roaring crimson jaws + golden cranium + ivory teeth
    ctx.fillStyle = '#c21c22';
    ctx.beginPath();
    ctx.ellipse(10 * scale, 4 * scale, 18 * scale, 10 * scale, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#efc03c';
    ctx.beginPath();
    ctx.ellipse(2 * scale, -4 * scale, 22 * scale, 13 * scale, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#421c04';
    ctx.lineWidth = 2.0 * scale;
    ctx.stroke();
    // White fangs
    ctx.fillStyle = '#fff9ea';
    for (const fx of [12, 18, 23]) {
      ctx.fillRect(fx * scale, 1 * scale, 2.5 * scale, 5 * scale);
    }
    // Fierce gleaming eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6 * scale, -7 * scale, 5.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120804';
    ctx.beginPath();
    ctx.arc(7 * scale, -7 * scale, 2.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Branching pale lavender-ivory antler & razor-thin sweeping whisker
    ctx.strokeStyle = '#efe6f2';
    ctx.lineWidth = 3.8 * scale;
    ctx.beginPath();
    ctx.moveTo(-6 * scale, -12 * scale);
    ctx.quadraticCurveTo(-24 * scale, -34 * scale, -42 * scale, -24 * scale);
    ctx.moveTo(-22 * scale, -24 * scale);
    ctx.lineTo(-26 * scale, -40 * scale);
    ctx.stroke();
    ctx.strokeStyle = '#fff3d4';
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    ctx.moveTo(22 * scale, -2 * scale);
    ctx.bezierCurveTo(42 * scale, -16 * scale, 52 * scale, 18 * scale, 70 * scale, 6 * scale);
    ctx.stroke();

    ctx.restore();
    void hnx;
    void hny;
    void hrad;
  };

  const fiveColors = ['#1f58a8', '#1b7a4a', '#c41e24', '#e8e2ee', '#e8ae2c'];

  // 3. Four Scalloped `Khánh` Crimson Cartouches (Top, Bottom, Left, Right) — Outer 4 Dragons (#1-#4) — CL-09!
  const drawScallopedKhanhCartouche = (rx: number, ry: number, rw: number, rh: number, horiz: boolean, seed: number) => {
    const notch = 42 * S;
    ctx.save();
    ctx.beginPath();
    if (horiz) {
      // Scalloped trefoil ogee ends hugging the corner Chữ Vạn squares
      ctx.moveTo(rx + notch, ry);
      ctx.lineTo(rx + rw - notch, ry);
      ctx.quadraticCurveTo(rx + rw - notch * 0.2, ry + rh * 0.15, rx + rw, ry + rh * 0.5);
      ctx.quadraticCurveTo(rx + rw - notch * 0.2, ry + rh * 0.85, rx + rw - notch, ry + rh);
      ctx.lineTo(rx + notch, ry + rh);
      ctx.quadraticCurveTo(rx + notch * 0.2, ry + rh * 0.85, rx, ry + rh * 0.5);
      ctx.quadraticCurveTo(rx + notch * 0.2, ry + rh * 0.15, rx + notch, ry);
    } else {
      ctx.moveTo(rx, ry + notch);
      ctx.quadraticCurveTo(rx + rw * 0.15, ry + notch * 0.2, rx + rw * 0.5, ry);
      ctx.quadraticCurveTo(rx + rw * 0.85, ry + notch * 0.2, rx + rw, ry + notch);
      ctx.lineTo(rx + rw, ry + rh - notch);
      ctx.quadraticCurveTo(rx + rw * 0.85, ry + rh - notch * 0.2, rx + rw * 0.5, ry + rh);
      ctx.quadraticCurveTo(rx + rw * 0.15, ry + rh - notch * 0.2, rx, ry + rh - notch);
      ctx.closePath();
    }
    ctx.closePath();

    // Rich crimson lacquer cartouche fill + double emerald & cream border
    const cGrad = ctx.createRadialGradient(rx + rw * 0.5, ry + rh * 0.5, 20 * S, rx + rw * 0.5, ry + rh * 0.5, Math.max(rw, rh) * 0.58);
    cGrad.addColorStop(0, '#a41016');
    cGrad.addColorStop(1, '#6c080c');
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.strokeStyle = '#1b6d40';
    ctx.lineWidth = 13 * S;
    ctx.stroke();
    ctx.strokeStyle = '#f6ecc4';
    ctx.lineWidth = 3 * S;
    ctx.stroke();

    ctx.clip();
    if (horiz) {
      const cy = ry + rh * 0.5;
      drawProfileImperialDragon(
        [
          [rx + rw * 0.10, cy + 44 * S],
          [rx + rw * 0.28, cy - 58 * S],
          [rx + rw * 0.50, cy + 48 * S],
          [rx + rw * 0.72, cy - 42 * S],
          [rx + rw * 0.86, cy + 10 * S]
        ],
        1.48 * S,
        seed,
        fiveColors
      );
    } else {
      const cx = rx + rw * 0.5;
      drawProfileImperialDragon(
        [
          [cx + 44 * S, ry + rh * 0.90],
          [cx - 58 * S, ry + rh * 0.70],
          [cx + 50 * S, ry + rh * 0.48],
          [cx - 42 * S, ry + rh * 0.28],
          [cx + 10 * S, ry + rh * 0.14]
        ],
        1.48 * S,
        seed,
        fiveColors
      );
    }
    ctx.restore();
  };

  const cartSpan = sz - (mOuter + cornerW) * 2 + 56 * S;
  const cartStart = mOuter + cornerW - 28 * S;
  drawScallopedKhanhCartouche(cartStart, mOuter, cartSpan, cornerW, true, 1);
  drawScallopedKhanhCartouche(cartStart, sz - mOuter - cornerW, cartSpan, cornerW, true, 2);
  drawScallopedKhanhCartouche(mOuter, cartStart, cornerW, cartSpan, false, 3);
  drawScallopedKhanhCartouche(sz - mOuter - cornerW, cartStart, cornerW, cartSpan, false, 4);

  // 4. Central Radiant Imperial Saffron-Gold Field (`Nền Hoàng Bào Vàng Nghệ`) — CL-02!
  const innerM = mOuter + cornerW;
  const innerW = sz - innerM * 2;
  const yelGrad = ctx.createRadialGradient(sz * 0.5, sz * 0.5, 60 * S, sz * 0.5, sz * 0.5, innerW * 0.74);
  yelGrad.addColorStop(0, '#f4ba1a');
  yelGrad.addColorStop(0.65, '#e39f0c');
  yelGrad.addColorStop(1, '#c68008');
  ctx.fillStyle = yelGrad;
  ctx.fillRect(innerM, innerM, innerW, innerW);

  // Subtle hand-brushed mineral-gold pigment mottling across yellow ground
  for (let i = 0; i < 380; i++) {
    const px = innerM + hash2i(i, 1, 8821) * innerW;
    const py = innerM + hash2i(i, 2, 8821) * innerW;
    const rw = (36 + hash2i(i, 3, 8821) * 90) * S;
    const rh = (14 + hash2i(i, 4, 8821) * 32) * S;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 224, 108, 0.06)' : 'rgba(156, 86, 6, 0.05)';
    ctx.fillRect(px - rw * 0.5, py - rh * 0.5, rw, rh);
  }

  // Slim Double-Piped Emerald-Green Pearl Border (CL-13)
  ctx.strokeStyle = '#165a34';
  ctx.lineWidth = 20 * S;
  ctx.strokeRect(innerM + 10 * S, innerM + 10 * S, innerW - 20 * S, innerW - 20 * S);
  ctx.strokeStyle = '#f6d462';
  ctx.lineWidth = 3 * S;
  ctx.strokeRect(innerM + 1 * S, innerM + 1 * S, innerW - 2 * S, innerW - 2 * S);
  ctx.strokeRect(innerM + 20 * S, innerM + 20 * S, innerW - 40 * S, innerW - 40 * S);
  for (let d = innerM + 24 * S; d <= sz - innerM - 24 * S; d += 22 * S) {
    for (const [px, py] of [
      [d, innerM + 10 * S],
      [d, sz - innerM - 10 * S],
      [innerM + 10 * S, d],
      [sz - innerM - 10 * S, d]
    ]) {
      ctx.fillStyle = '#0e3c22';
      ctx.beginPath();
      ctx.arc(px + 1.5 * S, py + 1.5 * S, 4.2 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff5d4';
      ctx.beginPath();
      ctx.arc(px, py, 4.0 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4 Full-Bodied Agile Corner Dragons inside the Yellow Field (#5-#8) — CL-08!
  const mid = sz * 0.5;
  const iL = innerM + 58 * S;
  const iR = sz - innerM - 58 * S;
  const iT = innerM + 58 * S;
  const iB = sz - innerM - 58 * S;
  // Top-Left corner dragon curling inward toward central dragon
  drawProfileImperialDragon(
    [[iL + 16 * S, iT + 380 * S], [iL + 72 * S, iT + 260 * S], [iL + 24 * S, iT + 140 * S], [iL + 125 * S, iT + 66 * S], [iL + 245 * S, iT + 115 * S]],
    1.18 * S, 5, fiveColors
  );
  // Top-Right corner dragon
  drawProfileImperialDragon(
    [[iR - 16 * S, iT + 380 * S], [iR - 72 * S, iT + 260 * S], [iR - 24 * S, iT + 140 * S], [iR - 125 * S, iT + 66 * S], [iR - 245 * S, iT + 115 * S]],
    1.18 * S, 6, fiveColors
  );
  // Bottom-Left corner dragon
  drawProfileImperialDragon(
    [[iL + 16 * S, iB - 380 * S], [iL + 72 * S, iB - 260 * S], [iL + 24 * S, iB - 140 * S], [iL + 125 * S, iB - 66 * S], [iL + 245 * S, iB - 115 * S]],
    1.18 * S, 7, fiveColors
  );
  // Bottom-Right corner dragon
  drawProfileImperialDragon(
    [[iR - 16 * S, iB - 380 * S], [iR - 72 * S, iB - 260 * S], [iR - 24 * S, iB - 140 * S], [iR - 125 * S, iB - 66 * S], [iR - 245 * S, iB - 115 * S]],
    1.18 * S, 8, fiveColors
  );

  // 5. GRAND CENTER FRONT-FACING IMPERIAL DRAGON (`Chính Long` — #9) — CL-03..CL-07!
  // 5a. Back-layer 5-color billowing auspicious clouds
  const backClouds: Array<[number, number, string, number, number]> = [
    [-255, -245, '#1f58a8', 2.4, 1],
    [255, -230, '#1b7a4a', 2.4, -1],
    [-310, 40, '#c41e24', 2.5, 1],
    [310, 55, '#1f58a8', 2.5, -1],
    [-205, 295, '#1b7a4a', 2.4, 1],
    [215, 285, '#c41e24', 2.4, -1],
    [-40, 385, '#1f58a8', 2.3, 1],
    [130, 395, '#1b7a4a', 1.8, -1]
  ];
  for (const [ox, oy, col, sc, fl] of backClouds) {
    drawCongButCloud(ctx, mid + ox * S, mid + oy * S, sc * S, col, '#fff4d6', '#3d1a08', fl);
  }

  // 5b. Iconic 12-o'clock Blazing Crimson-Gold `Hỏa Châu` Flaming Sacred Pearl (CL-07!)
  const pearlY = mid - 468 * S;
  for (const [ang, len, col] of [
    [-0.45, 74, '#c41e24'],
    [0.0, 96, '#d92822'],
    [0.45, 74, '#c41e24'],
    [-0.22, 62, '#f8d24e'],
    [0.22, 62, '#f8d24e']
  ] as Array<[number, number, string]>) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 7 * S;
    ctx.beginPath();
    ctx.moveTo(mid, pearlY);
    ctx.quadraticCurveTo(
      mid + Math.sin(ang) * len * 0.7 * S,
      pearlY - len * 0.55 * S,
      mid + Math.sin(ang * 0.6) * len * S,
      pearlY - len * S
    );
    ctx.stroke();
  }
  const pGrad = ctx.createRadialGradient(mid - 8 * S, pearlY - 8 * S, 4 * S, mid, pearlY, 32 * S);
  pGrad.addColorStop(0, '#fff8c8');
  pGrad.addColorStop(0.45, '#f29818');
  pGrad.addColorStop(1, '#b8161c');
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(mid, pearlY, 30 * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff0a4';
  ctx.lineWidth = 3.5 * S;
  ctx.stroke();

  // 5c. Sweeping Figure-8 Muscular Coiled Body weaving *Hidden in Clouds* (`Ẩn Vân`) — CL-05!
  const bodyCtrl: Array<[number, number]> = [
    [mid + 24 * S, mid - 392 * S],   // raised curling tail under Hỏa Châu
    [mid - 115 * S, mid - 335 * S],
    [mid - 292 * S, mid - 195 * S],  // upper-left coil
    [mid - 256 * S, mid + 95 * S],   // lower-left coil
    [mid - 98 * S, mid + 258 * S],   // bottom arch
    [mid + 128 * S, mid + 248 * S],  // lower-right coil
    [mid + 286 * S, mid + 82 * S],   // mid-right coil
    [mid + 258 * S, mid - 176 * S],  // upper-right coil
    [mid + 86 * S, mid - 246 * S],   // upper neck arch
    [mid, mid - 88 * S]              // behind head
  ];
  const bodySamples = 140;
  const bodyPts: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i <= bodySamples; i++) {
    const u = (i / bodySamples) * (bodyCtrl.length - 1);
    const seg = Math.min(bodyCtrl.length - 2, Math.floor(u));
    const f = u - seg;
    const p0 = bodyCtrl[Math.max(0, seg - 1)];
    const p1 = bodyCtrl[seg];
    const p2 = bodyCtrl[seg + 1];
    const p3 = bodyCtrl[Math.min(bodyCtrl.length - 1, seg + 2)];
    const f2 = f * f;
    const f3 = f2 * f;
    const px = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * f + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3);
    const py = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * f + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3);
    const t = i / bodySamples;
    const rad = (10 + Math.sin(Math.pow(t, 0.58) * Math.PI * 0.92) * 38) * S;
    bodyPts.push([px, py, 0, 0, rad]);
  }
  for (let i = 0; i <= bodySamples; i++) {
    const pA = bodyPts[Math.max(0, i - 1)];
    const pB = bodyPts[Math.min(bodySamples, i + 1)];
    const len = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]) || 1;
    bodyPts[i][2] = (pB[0] - pA[0]) / len;
    bodyPts[i][3] = (pB[1] - pA[1]) / len;
  }

  for (let i = 0; i <= bodySamples; i++) {
    const [px, py, tx, ty, rad] = bodyPts[i];
    const nx = -ty;
    const ny = tx;

    // Interleaved foreground clouds hiding specific coil transitions (`Ẩn Vân`!)
    if (i === 28) {
      drawCongButCloud(ctx, mid - 260 * S, mid - 120 * S, 2.2 * S, '#1f58a8', '#fff4d6', '#3d1a08', 1);
    } else if (i === 76) {
      drawCongButCloud(ctx, mid + 215 * S, mid + 180 * S, 2.1 * S, '#1b7a4a', '#fff4d6', '#3d1a08', -1);
    }

    // Sinuous polychrome/gold dorsal flame-tendril fins
    if (i % 4 === 0 && i > 4) {
      ctx.strokeStyle = i % 8 === 0 ? '#1b7a4a' : '#fae078';
      ctx.lineWidth = 4.5 * S;
      ctx.beginPath();
      ctx.moveTo(px + nx * rad * 0.78, py + ny * rad * 0.78);
      ctx.quadraticCurveTo(
        px + nx * rad * 1.65 - tx * 16 * S,
        py + ny * rad * 1.65 - ty * 16 * S,
        px + nx * rad * 2.0 - tx * 30 * S,
        py + ny * rad * 2.0 - ty * 30 * S
      );
      ctx.stroke();
    }

    // 3D cylindrical shaded scaled body
    const bg = ctx.createRadialGradient(px - nx * rad * 0.25, py - ny * rad * 0.25, rad * 0.1, px, py, rad);
    bg.addColorStop(0, '#ffe478');
    bg.addColorStop(0.52, '#c88412');
    bg.addColorStop(1, '#5e2e04');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();

    bCtx.fillStyle = '#d4d4d4';
    bCtx.beginPath();
    bCtx.arc(px, py, rad, 0, Math.PI * 2);
    bCtx.fill();

    // Ribbed ventral cream belly band
    ctx.fillStyle = '#f4e4b2';
    ctx.beginPath();
    ctx.arc(px - nx * rad * 0.48, py - ny * rad * 0.48, rad * 0.40, 0, Math.PI * 2);
    ctx.fill();

    // 3 staggered crescent scale arcs with fine công bút ink contours
    ctx.strokeStyle = '#3d1806';
    ctx.lineWidth = 1.8 * S;
    for (const off of [-0.35, 0.08, 0.45]) {
      ctx.beginPath();
      ctx.arc(px + nx * rad * off * 0.55, py + ny * rad * off * 0.55, rad * 0.46, Math.atan2(ny, nx) - 0.95, Math.atan2(ny, nx) + 0.95);
      ctx.stroke();
    }
  }

  // 5d. Four Muscular 5-Clawed Imperial Limbs (`Ngũ Trảo`) with Elbow Flame Tufts — CL-06!
  const limbs: Array<[number, number, number, number, number, number, string]> = [
    [-195, -138, -285, -92, -338, -142, '#1f58a8'],  // upper-left
    [195, -128, 285, -82, 338, -136, '#1b7a4a'],     // upper-right
    [-175, 168, -268, 212, -315, 164, '#c41e24'],    // lower-left
    [175, 162, 268, 206, 315, 158, '#1f58a8']        // lower-right
  ];
  for (const [sx, sy, ex, ey, fx, fy, flameCol] of limbs) {
    ctx.strokeStyle = '#c88412';
    ctx.lineWidth = 24 * S;
    ctx.beginPath();
    ctx.moveTo(mid + sx * S, mid + sy * S);
    ctx.lineTo(mid + ex * S, mid + ey * S);
    ctx.lineTo(mid + fx * S, mid + fy * S);
    ctx.stroke();
    ctx.strokeStyle = '#481e04';
    ctx.lineWidth = 3 * S;
    ctx.stroke();
    // Sweeping elbow flame tufts
    for (let fl = -1; fl <= 1; fl++) {
      ctx.strokeStyle = fl === 0 ? '#fff2c2' : flameCol;
      ctx.lineWidth = 5.5 * S;
      ctx.beginPath();
      ctx.moveTo(mid + ex * S, mid + ey * S);
      ctx.quadraticCurveTo(
        mid + (ex + Math.sign(ex) * 32) * S,
        mid + (ey + 24 + fl * 18) * S,
        mid + (ex + Math.sign(ex) * 62) * S,
        mid + (ey + 48 + fl * 22) * S
      );
      ctx.stroke();
    }
    // 5 splayed ivory talons gripping clouds
    const baseAng = Math.atan2(fy - ey, fx - ex);
    for (let cl = -2; cl <= 2; cl++) {
      const a = baseAng + cl * 0.34;
      const tipX = mid + fx * S + Math.cos(a) * 40 * S;
      const tipY = mid + fy * S + Math.sin(a) * 40 * S;
      ctx.strokeStyle = '#3d1806';
      ctx.lineWidth = 8 * S;
      ctx.beginPath();
      ctx.moveTo(mid + fx * S, mid + fy * S);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = '#fff9e6';
      ctx.lineWidth = 4.5 * S;
      ctx.stroke();
    }
  }

  // 5e. Organic Wind-Swept Tapered Polychrome Flame-Mane & Beard Tufts (ZERO daisy petals! CL-04!)
  const flameLocks = 28;
  for (let m = 0; m < flameLocks; m++) {
    const ang = (m / flameLocks) * Math.PI * 2;
    const len = (148 + Math.sin(m * 2.7) * 36 + (Math.abs(Math.cos(ang)) > 0.6 ? 28 : 0)) * S;
    const curl = (m % 2 === 0 ? 1 : -1) * 0.28;
    const col = ['#1e58a4', '#197a49', '#c41c24', '#f4e6bc'][m % 4];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(mid + Math.cos(ang - 0.14) * 92 * S, mid + Math.sin(ang - 0.14) * 86 * S);
    ctx.quadraticCurveTo(
      mid + Math.cos(ang + curl) * (len * 0.85),
      mid + Math.sin(ang + curl) * (len * 0.80),
      mid + Math.cos(ang + curl * 0.45) * len,
      mid + Math.sin(ang + curl * 0.45) * (len * 0.92)
    );
    ctx.quadraticCurveTo(
      mid + Math.cos(ang - curl * 0.4) * (len * 0.68),
      mid + Math.sin(ang - curl * 0.4) * (len * 0.64),
      mid + Math.cos(ang + 0.14) * 92 * S,
      mid + Math.sin(ang + 0.14) * 86 * S
    );
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff6dc';
    ctx.lineWidth = 1.8 * S;
    ctx.stroke();
  }

  // 5f. Fierce Anatomical Front-Facing `Chính Long` Head (CL-03 — ZERO frog/owl corn-kernels!)
  // Domed tapered golden-scaled cranium shield
  const headGrad = ctx.createRadialGradient(mid, mid - 40 * S, 18 * S, mid, mid - 12 * S, 128 * S);
  headGrad.addColorStop(0, '#fae078');
  headGrad.addColorStop(0.6, '#d49018');
  headGrad.addColorStop(1, '#7a4208');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.moveTo(mid - 74 * S, mid - 98 * S);
  ctx.quadraticCurveTo(mid, mid - 146 * S, mid + 74 * S, mid - 98 * S);
  ctx.quadraticCurveTo(mid + 114 * S, mid - 16 * S, mid + 86 * S, mid + 78 * S);
  ctx.quadraticCurveTo(mid, mid + 128 * S, mid - 86 * S, mid + 78 * S);
  ctx.quadraticCurveTo(mid - 114 * S, mid - 16 * S, mid - 74 * S, mid - 98 * S);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3d1806';
  ctx.lineWidth = 4 * S;
  ctx.stroke();

  bCtx.fillStyle = '#ffffff';
  bCtx.beginPath();
  bCtx.arc(mid, mid - 10 * S, 108 * S, 0, Math.PI * 2);
  bCtx.fill();

  // Fine imbricated crescent gold scales across tapered forehead crown
  ctx.strokeStyle = '#5a2804';
  ctx.lineWidth = 2.2 * S;
  for (let row = 0; row < 5; row++) {
    const ry = mid - (108 - row * 16) * S;
    const count = 4 + (row < 3 ? row : 2);
    for (let k = -count; k <= count; k++) {
      const rx = mid + k * 14 * S + (row % 2) * 7 * S;
      ctx.fillStyle = (k + row) % 2 === 0 ? '#fae078' : '#d89618';
      ctx.beginPath();
      ctx.arc(rx, ry, 10.5 * S, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Scalloped emerald-blue-gold cloud crest crowning forehead
  drawCongButCloud(ctx, mid, mid - 134 * S, 1.35 * S, '#1b7a4a', '#fae078', '#3d1806');

  // Vivid crimson-vermilion furrowed face mask & flaring cloud-scroll cheeks
  ctx.fillStyle = '#c21c22';
  ctx.beginPath();
  ctx.moveTo(mid - 84 * S, mid - 28 * S);
  ctx.quadraticCurveTo(mid, mid - 46 * S, mid + 84 * S, mid - 28 * S);
  ctx.quadraticCurveTo(mid + 106 * S, mid + 24 * S, mid + 66 * S, mid + 64 * S);
  ctx.quadraticCurveTo(mid, mid + 82 * S, mid - 66 * S, mid + 64 * S);
  ctx.quadraticCurveTo(mid - 106 * S, mid + 24 * S, mid - 84 * S, mid - 28 * S);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a0a0c';
  ctx.lineWidth = 3 * S;
  ctx.stroke();

  // Flaring cloud-scroll snout & nostrils (`mũi mây`)
  ctx.fillStyle = '#e8aa24';
  ctx.beginPath();
  ctx.ellipse(mid, mid + 20 * S, 48 * S, 30 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d1806';
  ctx.lineWidth = 3 * S;
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#5c080c';
    ctx.beginPath();
    ctx.ellipse(mid + side * 22 * S, mid + 24 * S, 13 * S, 9 * S, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff0a4';
    ctx.lineWidth = 2.6 * S;
    ctx.stroke();
  }

  // Roaring open jaw with crisp rows of white teeth & 4 curved ivory corner fangs!
  ctx.fillStyle = '#4c0408';
  ctx.beginPath();
  ctx.ellipse(mid, mid + 68 * S, 64 * S, 30 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2c43e';
  ctx.lineWidth = 4.5 * S;
  ctx.stroke();
  // Upper & lower square white teeth
  ctx.fillStyle = '#fff9ea';
  ctx.strokeStyle = '#5a2a06';
  ctx.lineWidth = 1.6 * S;
  for (let t = -3; t <= 3; t++) {
    ctx.fillRect(mid + (t * 13 - 5) * S, mid + 46 * S, 10 * S, 13 * S);
    ctx.strokeRect(mid + (t * 13 - 5) * S, mid + 46 * S, 10 * S, 13 * S);
    ctx.fillRect(mid + (t * 11 - 4.5) * S, mid + 78 * S, 9 * S, 11 * S);
    ctx.strokeRect(mid + (t * 11 - 4.5) * S, mid + 78 * S, 9 * S, 11 * S);
  }
  // 4 curved ivory corner fangs
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(mid + side * 44 * S, mid + 46 * S);
    ctx.lineTo(mid + side * 52 * S, mid + 74 * S);
    ctx.lineTo(mid + side * 36 * S, mid + 48 * S);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Ornate emerald/gold beaded chin tuft
  drawCongButCloud(ctx, mid, mid + 114 * S, 1.1 * S, '#1b7a4a', '#fae078', '#3d1806');

  // Fierce bulging white sclera eyes, dark pupils, glowing glints, branching antlers & razor whiskers
  for (const side of [-1, 1]) {
    // Furrowed sweeping golden-emerald flame eyebrows
    ctx.strokeStyle = '#1b7a4a';
    ctx.lineWidth = 10 * S;
    ctx.beginPath();
    ctx.moveTo(mid + side * 20 * S, mid - 38 * S);
    ctx.quadraticCurveTo(mid + side * 66 * S, mid - 66 * S, mid + side * 112 * S, mid - 46 * S);
    ctx.stroke();
    ctx.strokeStyle = '#fae078';
    ctx.lineWidth = 4 * S;
    ctx.stroke();

    // Bulging fierce tilted white sclera eye
    ctx.fillStyle = '#68080c';
    ctx.beginPath();
    ctx.ellipse(mid + side * 52 * S, mid - 16 * S, 28 * S, 20 * S, -side * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffdf2';
    ctx.beginPath();
    ctx.ellipse(mid + side * 52 * S, mid - 16 * S, 21 * S, 15 * S, -side * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e0604';
    ctx.beginPath();
    ctx.arc(mid + side * 50 * S, mid - 16 * S, 10.5 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mid + side * 46 * S, mid - 20 * S, 4.2 * S, 0, Math.PI * 2);
    ctx.fill();

    // Organically tapering 3-tined pale lavender-ivory deer antlers
    ctx.strokeStyle = '#766882';
    ctx.lineWidth = 14 * S;
    ctx.beginPath();
    ctx.moveTo(mid + side * 44 * S, mid - 88 * S);
    ctx.quadraticCurveTo(mid + side * 155 * S, mid - 196 * S, mid + side * 244 * S, mid - 134 * S);
    ctx.moveTo(mid + side * 118 * S, mid - 152 * S);
    ctx.lineTo(mid + side * 144 * S, mid - 224 * S);
    ctx.moveTo(mid + side * 178 * S, mid - 160 * S);
    ctx.lineTo(mid + side * 212 * S, mid - 216 * S);
    ctx.stroke();
    ctx.strokeStyle = '#f2eaf6';
    ctx.lineWidth = 8.5 * S;
    ctx.stroke();

    // Razor-thin sweeping silver-white & pale-gold double-S whiskers (`râu rồng`)
    for (const [col, wLine, dyOff] of [
      ['#fff8e2', 4.2 * S, 0],
      ['#f2cc64', 2.4 * S, 10 * S]
    ] as Array<[string, number, number]>) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wLine;
      ctx.beginPath();
      ctx.moveTo(mid + side * 56 * S, mid + 32 * S + dyOff);
      ctx.bezierCurveTo(
        mid + side * 156 * S,
        mid - 16 * S + dyOff,
        mid + side * 224 * S,
        mid + 124 * S + dyOff,
        mid + side * 324 * S,
        mid + 54 * S + dyOff
      );
      ctx.stroke();
    }
  }

  // 6. Subtle Antique Imperial Lacquer Craquelure Patina (CL-14!)
  ctx.strokeStyle = 'rgba(54, 24, 4, 0.08)';
  ctx.lineWidth = 1.2 * S;
  for (let k = 0; k < 95; k++) {
    const x0 = hash2i(k, 1, 9311) * sz;
    const y0 = hash2i(k, 2, 9311) * sz;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (hash2i(k, 3, 9311) - 0.5) * 140 * S, y0 + (hash2i(k, 4, 9311) - 0.5) * 140 * S);
    ctx.stroke();
  }

  return {
    map: wrapCanvasTex(canvas, true, 1, 1, renderer),
    bumpMap: wrapCanvasTex(bObj.canvas, false, 1, 1, renderer)
  };
}

/**
 * 6. 1536×960 Monumental `"殿和太"` Hoành Phi Plaque with FULL PBR Relief/Metalness Maps — IN-06..IN-08, CL-27!
 *    Replaces `"dddd"` circle border with dense sculpted `Cửu Long` undulating gilded dragon-and-cloud relief,
 *    thick beveled 24K KaiShu calligraphy, crisp margin inscriptions & 2 authentic vermilion imperial seal stamps!
 */
export function createHueHoanhPhiThaiHoaTexture(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  roughnessMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 256 : 1536;
  const h = headless ? 160 : 960;
  const cObj = makeCanvas(w, h);
  const mObj = makeCanvas(w, h);
  const rObj = makeCanvas(w, h);
  if (!cObj || !mObj || !rObj) {
    const flat = finalizeDataTex(new Uint8Array([92, 10, 12, 255]), 1, true, 1, 1, 1, renderer);
    return { map: flat, bumpMap: flat, metalnessMap: flat, roughnessMap: flat };
  }
  const c = cObj.ctx;
  const m = mObj.ctx;
  const r = rObj.ctx;
  const S = w / 1536;

  // Recessed dark-crimson/burnt-umber carved frame trench
  c.fillStyle = '#3a0706';
  c.fillRect(0, 0, w, h);
  m.fillStyle = '#181818';
  m.fillRect(0, 0, w, h);

  const paintBoth = (fn: (ctx: CanvasRenderingContext2D, isMask: boolean) => void) => {
    fn(c, false);
    fn(m, true);
  };

  // Outer gilded beaded pearl molding + inner beveled gold rail framing the sculpted dragon border
  const pad = 114 * S;
  paintBoth((ctx, isMask) => {
    ctx.strokeStyle = isMask ? '#f0f0f0' : '#f2c84a';
    ctx.lineWidth = 14 * S;
    ctx.strokeRect(10 * S, 10 * S, w - 20 * S, h - 20 * S);
    ctx.lineWidth = 10 * S;
    ctx.strokeRect(pad - 6 * S, pad - 6 * S, w - (pad - 6 * S) * 2, h - (pad - 6 * S) * 2);

    // Dense sculpted undulating gilded dragon-and-cloud scrollwork along ALL 4 carved rails (ZERO circles!)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Top & Bottom rails: confronting sinuous dragons flanking central flaming pearl
    for (const railY of [58 * S, h - 58 * S]) {
      for (const side of [-1, 1]) {
        ctx.strokeStyle = isMask ? '#d8d8d8' : '#d6981c';
        ctx.lineWidth = 18 * S;
        ctx.beginPath();
        for (let k = 0; k <= 18; k++) {
          const f = k / 18;
          const px = w * 0.5 + side * (58 + f * (w * 0.44 - 58)) * S;
          const py = railY + Math.sin(f * Math.PI * 5.0) * 24 * S;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        // Bright 24K raised dorsal highlights & swirling clouds
        ctx.strokeStyle = isMask ? '#ffffff' : '#ffe882';
        ctx.lineWidth = 6 * S;
        ctx.stroke();
        for (let k = 1; k <= 7; k++) {
          const cx = w * 0.5 + side * (96 + k * 84) * S;
          drawCongButCloud(
            ctx,
            cx,
            railY + (k % 2 === 0 ? 14 : -14) * S,
            0.78 * S,
            isMask ? '#dcdcdc' : '#e6b22c',
            isMask ? '#ffffff' : '#fff09c',
            isMask ? undefined : '#4c2204',
            side
          );
        }
      }
      // Central Flaming Pearl
      ctx.fillStyle = isMask ? '#ffffff' : '#fff098';
      ctx.beginPath();
      ctx.arc(w * 0.5, railY, 22 * S, 0, Math.PI * 2);
      ctx.fill();
    }

    // Left & Right rails: ascending gilded dragons & cloud scrolls
    for (const railX of [58 * S, w - 58 * S]) {
      ctx.strokeStyle = isMask ? '#d8d8d8' : '#d6981c';
      ctx.lineWidth = 18 * S;
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const f = k / 14;
        const py = pad + f * (h - pad * 2);
        const px = railX + Math.sin(f * Math.PI * 4.0) * 22 * S;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.strokeStyle = isMask ? '#ffffff' : '#ffe882';
      ctx.lineWidth = 6 * S;
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        drawCongButCloud(
          ctx,
          railX,
          pad + (75 + k * 145) * S,
          0.74 * S,
          isMask ? '#dcdcdc' : '#e6b22c',
          isMask ? '#ffffff' : '#fff09c',
          isMask ? undefined : '#4c2204'
        );
      }
    }

    // Four sculpted gilded corner cloud-rosette bosses
    for (const [bx, by] of [
      [58 * S, 58 * S],
      [w - 58 * S, 58 * S],
      [58 * S, h - 58 * S],
      [w - 58 * S, h - 58 * S]
    ]) {
      ctx.fillStyle = isMask ? '#ffffff' : '#f4cb4c';
      ctx.beginPath();
      ctx.arc(bx, by, 30 * S, 0, Math.PI * 2);
      ctx.fill();
      if (!isMask) {
        ctx.strokeStyle = '#522404';
        ctx.lineWidth = 3 * S;
        ctx.stroke();
      }
    }
  });

  // Deep glossy blood-crimson imperial lacquer field (#68070a -> #3a0406)
  const fieldGrad = c.createRadialGradient(w * 0.5, h * 0.5, 60 * S, w * 0.5, h * 0.5, w * 0.55);
  fieldGrad.addColorStop(0, '#72090d');
  fieldGrad.addColorStop(0.7, '#540608');
  fieldGrad.addColorStop(1, '#360305');
  c.fillStyle = fieldGrad;
  c.fillRect(pad, pad, w - pad * 2, h - pad * 2);
  m.fillStyle = '#060606';
  m.fillRect(pad, pad, w - pad * 2, h - pad * 2);

  // Crisp double gilded hairline frame inside lacquer field
  paintBoth((ctx, isMask) => {
    ctx.strokeStyle = isMask ? '#f0f0f0' : '#f2ca52';
    ctx.lineWidth = 8 * S;
    ctx.strokeRect(pad + 14 * S, pad + 14 * S, w - (pad + 14 * S) * 2, h - (pad + 14 * S) * 2);
    ctx.lineWidth = 3 * S;
    ctx.strokeRect(pad + 30 * S, pad + 30 * S, w - (pad + 30 * S) * 2, h - (pad + 30 * S) * 2);
  });

  // Bold Beveled 24K Brushed KaiShu Calligraphic Characters "殿 和 太" (IN-06!)
  const chars = ['殿', '和', '太'];
  const xs = [w * 0.275, w * 0.50, w * 0.725];
  const fontSpec = `900 ${Math.round(355 * S)}px "KaiTi", "STKaiti", "BiauKai", "DFKai-SB", "SimSun", Georgia, serif`;
  paintBoth((ctx, isMask) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontSpec;
    for (let i = 0; i < 3; i++) {
      if (!isMask) {
        // Deep cast relief shadow onto crimson lacquer
        ctx.fillStyle = '#240203';
        ctx.fillText(chars[i], xs[i] + 10 * S, h * 0.525 + 12 * S);
        // Thick lower-right bronze bevel
        ctx.strokeStyle = '#7c4806';
        ctx.lineWidth = 10 * S;
        ctx.strokeText(chars[i], xs[i] + 4 * S, h * 0.525 + 4 * S);
      }
      const gTxt = isMask ? '#f2f2f2' : (() => {
        const g = ctx.createLinearGradient(0, h * 0.24, 0, h * 0.78);
        g.addColorStop(0, '#fff4a8');
        g.addColorStop(0.45, '#f2c23c');
        g.addColorStop(1, '#ba7c12');
        return g;
      })();
      ctx.fillStyle = gTxt;
      ctx.fillText(chars[i], xs[i], h * 0.525);
      if (!isMask) {
        // Crisp upper-left 24K specular bevel
        ctx.strokeStyle = '#fff5b8';
        ctx.lineWidth = 3.2 * S;
        ctx.strokeText(chars[i], xs[i] - 2 * S, h * 0.525 - 2 * S);
      }
    }
  });

  // Slender crisp vertical margin reign/date inscriptions + 2 Authentic Vermilion Imperial Seal Stamps (IN-07!)
  const marginFont = `bold ${Math.round(28 * S)}px "KaiTi", "SimSun", serif`;
  const rightCols = ['明', '命', '十', '四', '年', '歲', '次', '癸', '巳', '吉', '日'];
  const leftCols = ['御', '製', '恭', '懸', '太', '和', '正', '殿'];
  paintBoth((ctx, isMask) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = marginFont;
    ctx.fillStyle = isMask ? '#e2e2e2' : '#ebc24c';
    for (let k = 0; k < rightCols.length; k++) {
      ctx.fillText(rightCols[k], w - pad - 68 * S, pad + 88 * S + k * 52 * S);
    }
    for (let k = 0; k < leftCols.length; k++) {
      ctx.fillText(leftCols[k], pad + 68 * S, pad + 92 * S + k * 52 * S);
    }
  });
  // Two small square vermilion-red carved Imperial Seal Imprints (`Ấn Triện`) below left inscription!
  for (let sIdx = 0; sIdx < 2; sIdx++) {
    const sx = pad + 51 * S;
    const sy = pad + (536 + sIdx * 48) * S;
    c.fillStyle = '#c81c18';
    c.fillRect(sx, sy, 34 * S, 34 * S);
    c.strokeStyle = '#f4d68c';
    c.lineWidth = 1.8 * S;
    c.strokeRect(sx + 4 * S, sy + 4 * S, 26 * S, 26 * S);
    c.beginPath();
    c.moveTo(sx + 17 * S, sy + 6 * S);
    c.lineTo(sx + 17 * S, sy + 28 * S);
    c.moveTo(sx + 8 * S, sy + 14 * S);
    c.lineTo(sx + 26 * S, sy + 14 * S);
    c.moveTo(sx + 10 * S, sy + 22 * S);
    c.lineTo(sx + 24 * S, sy + 22 * S);
    c.stroke();
  }

  // Roughness map: glossy crimson lacquer = 0.18 (#2e2e2e), brushed metallic gold = 0.26 (#424242)
  r.fillStyle = '#2e2e2e';
  r.fillRect(0, 0, w, h);
  r.globalAlpha = 0.18;
  r.drawImage(mObj.canvas, 0, 0);
  r.globalAlpha = 1.0;

  const map = wrapCanvasTex(cObj.canvas, true, 1, 1, renderer);
  const metalnessMap = wrapCanvasTex(mObj.canvas, false, 1, 1, renderer);
  const roughnessMap = wrapCanvasTex(rObj.canvas, false, 1, 1, renderer);
  return { map, bumpMap: metalnessMap, metalnessMap, roughnessMap };
}

/**
 * 7. 1536×768 2-Tier Interior `Nhất Thi Nhất Họa` Frieze with FULL PBR Metalness/Roughness Separation — IN-12, IN-13, CL-26!
 *    ZERO cartoon yellow daisies: deep blood-crimson `#480507` oval recesses filled with lacy 24K gilded cloud-dragon
 *    & lotus-vine scrollwork + triangular gilded scroll spandrels (`góc lá lật`) + crisp classical poetry calligraphy!
 */
export function createHueInteriorNhatThiTexture(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  roughnessMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 256 : 1536;
  const h = headless ? 128 : 768;
  const cObj = makeCanvas(w, h);
  const mObj = makeCanvas(w, h);
  const rObj = makeCanvas(w, h);
  if (!cObj || !mObj || !rObj) {
    const flat = finalizeDataTex(new Uint8Array([84, 8, 10, 255]), 1, true, 1, 1, 1, renderer);
    return { map: flat, bumpMap: flat, metalnessMap: flat, roughnessMap: flat };
  }
  const c = cObj.ctx;
  const m = mObj.ctx;
  const r = rObj.ctx;
  const S = w / 1536;

  // Deep glossy blood-crimson lacquer field
  c.fillStyle = '#4e0508';
  c.fillRect(0, 0, w, h);
  m.fillStyle = '#060606';
  m.fillRect(0, 0, w, h);

  const paintBoth = (fn: (ctx: CanvasRenderingContext2D, isMask: boolean) => void) => {
    fn(c, false);
    fn(m, true);
  };

  // Horizontal gilded cornice divider moldings
  paintBoth((ctx, isMask) => {
    ctx.fillStyle = isMask ? '#e8e8e8' : '#e2ad2c';
    ctx.fillRect(0, 8 * S, w, 14 * S);
    ctx.fillRect(0, 218 * S, w, 20 * S);
    ctx.fillRect(0, 742 * S, w, 16 * S);
    if (!isMask) {
      ctx.fillStyle = '#fae078';
      ctx.fillRect(0, 218 * S, w, 4 * S);
      ctx.fillRect(0, 742 * S, w, 4 * S);
    }
  });

  // UPPER REGISTER (y = 32..210): Alternating crisp dark-crimson Han squares & lacy gilded filigree ovals
  const upperSlots = 6;
  const uW = w / upperSlots;
  const upperPoems = [
    ['大南', '皇朝', '萬壽'],
    ['太和', '正殿', '永昌'],
    ['乾坤', '清寧', '瑞氣']
  ];
  for (let i = 0; i < upperSlots; i++) {
    const x0 = i * uW + 14 * S;
    const cw = uW - 28 * S;
    const isOval = i % 2 === 1;
    c.fillStyle = '#400406';
    c.fillRect(x0, 36 * S, cw, 168 * S);
    paintBoth((ctx, isMask) => {
      ctx.strokeStyle = isMask ? '#f0f0f0' : '#ebc042';
      ctx.lineWidth = 5 * S;
      ctx.strokeRect(x0, 36 * S, cw, 168 * S);
      ctx.lineWidth = 2 * S;
      ctx.strokeRect(x0 + 10 * S, 46 * S, cw - 20 * S, 148 * S);
      if (isOval) {
        drawGildedFiligreeOval(ctx, x0 + cw * 0.5, 120 * S, cw * 0.40, 56 * S, S * 1.15, isMask);
      } else {
        ctx.fillStyle = isMask ? '#e4e4e4' : '#f2cd5c';
        ctx.font = `bold ${Math.round(28 * S)}px "KaiTi", "SimSun", serif`;
        ctx.textAlign = 'center';
        const lines = upperPoems[Math.floor(i / 2) % upperPoems.length];
        for (let l = 0; l < 3; l++) {
          ctx.fillText(lines[l], x0 + cw * (0.26 + l * 0.24), 108 * S);
          ctx.fillText('無疆', x0 + cw * (0.26 + l * 0.24), 156 * S);
        }
      }
    });
  }

  // LOWER MAIN REGISTER (y = 252..724): Exact Ref #3 rhythm [Poem | Lacy Filigree Oval | Poem | Lacy Filigree Oval | Poem]
  const poemGlyphs = [
    ['天', '命', '維', '新', '國', '運', '昌'],
    ['山', '河', '萬', '里', '沐', '恩', '光'],
    ['文', '明', '禮', '樂', '昭', '千', '古'],
    ['太', '和', '瑞', '氣', '滿', '明', '堂'],
    ['皇', '圖', '鞏', '固', '承', '天', '祐'],
    ['聖', '德', '光', '昭', '協', '萬', '邦']
  ];
  const lowerPanels = [
    { x: 20, w: 256, type: 'poem' },
    { x: 294, w: 334, type: 'oval' },
    { x: 646, w: 244, type: 'poem' },
    { x: 908, w: 334, type: 'oval' },
    { x: 1260, w: 256, type: 'poem' }
  ];

  for (let p = 0; p < lowerPanels.length; p++) {
    const pan = lowerPanels[p];
    const px = pan.x * S;
    const pw = pan.w * S;
    const py = 262 * S;
    const ph = 456 * S;

    c.fillStyle = '#440407';
    c.fillRect(px, py, pw, ph);

    paintBoth((ctx, isMask) => {
      // Double molded gold frame
      ctx.strokeStyle = isMask ? '#f2f2f2' : '#f0c444';
      ctx.lineWidth = 8 * S;
      ctx.strokeRect(px, py, pw, ph);
      ctx.strokeStyle = isMask ? '#dcdcdc' : '#fae07c';
      ctx.lineWidth = 3 * S;
      ctx.strokeRect(px + 16 * S, py + 16 * S, pw - 32 * S, ph - 32 * S);

      if (pan.type === 'poem') {
        ctx.fillStyle = isMask ? '#e8e8e8' : '#f6d66c';
        ctx.font = `bold ${Math.round(36 * S)}px "KaiTi", "STKaiti", "SimSun", serif`;
        ctx.textAlign = 'center';
        for (let col = 0; col < 4; col++) {
          const gx = px + pw - (46 + col * 52) * S;
          const glyphs = poemGlyphs[(col + p * 2) % poemGlyphs.length];
          for (let row = 0; row < 7; row++) {
            const gy = py + (72 + row * 52) * S;
            ctx.fillText(glyphs[row], gx, gy);
          }
        }
      } else {
        // 4 Sculpted Triangular Gilded Scroll Spandrels (`Góc Lá Lật`) — ZERO polka-dot circles!
        ctx.strokeStyle = isMask ? '#f0f0f0' : '#ebc042';
        ctx.fillStyle = isMask ? '#dcdcdc' : '#d69c22';
        ctx.lineWidth = 3.5 * S;
        const corners4: Array<[number, number, number, number]> = [
          [px + 22 * S, py + 22 * S, 1, 1],
          [px + pw - 22 * S, py + 22 * S, -1, 1],
          [px + 22 * S, py + ph - 22 * S, 1, -1],
          [px + pw - 22 * S, py + ph - 22 * S, -1, -1]
        ];
        for (const [cx0, cy0, sx, sy] of corners4) {
          ctx.beginPath();
          ctx.moveTo(cx0, cy0);
          ctx.lineTo(cx0 + sx * 48 * S, cy0);
          ctx.quadraticCurveTo(cx0 + sx * 22 * S, cy0 + sy * 22 * S, cx0, cy0 + sy * 48 * S);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Intricate lacy 24K gilded cloud-dragon-floral filigree on deep crimson oval!
        drawGildedFiligreeOval(ctx, px + pw * 0.5, py + ph * 0.5, pw * 0.41, ph * 0.40, S * 1.45, isMask);
      }
    });
  }

  r.fillStyle = '#282828';
  r.fillRect(0, 0, w, h);
  r.globalAlpha = 0.20;
  r.drawImage(mObj.canvas, 0, 0);
  r.globalAlpha = 1.0;

  const map = wrapCanvasTex(cObj.canvas, true, 1, 1, renderer);
  const metalnessMap = wrapCanvasTex(mObj.canvas, false, 1, 1, renderer);
  const roughnessMap = wrapCanvasTex(rObj.canvas, false, 1, 1, renderer);
  return { map, bumpMap: metalnessMap, metalnessMap, roughnessMap };
}

/**
 * 7b. 2048×256 Ornate Exterior Ceramic-Mosaic `Cổ Diêm` Frieze (`Khảm Sành Sứ Cổ Diêm`) — EX-03!
 *     16 alternating elongated poetry tablets (warm ochre/vermilion) & polychrome mosaic relief scenes!
 */
export function createHueCoDiemMosaicPbrTextures(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughnessMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 256 : 2048;
  const h = headless ? 64 : 256;
  const cObj = makeCanvas(w, h);
  const bObj = makeCanvas(w, h);
  if (!cObj || !bObj) {
    const flat = finalizeDataTex(new Uint8Array([148, 86, 42, 255]), 1, true, 1, 1, 1, renderer);
    return { map: flat, bumpMap: flat, roughnessMap: flat };
  }
  const c = cObj.ctx;
  const b = bObj.ctx;
  const S = h / 256;

  // Deep recessed weathered imperial crimson timber frame
  c.fillStyle = '#4e1210';
  c.fillRect(0, 0, w, h);
  b.fillStyle = '#383838';
  b.fillRect(0, 0, w, h);

  // Top & bottom molded ceramic-ochre cornice strips
  c.fillStyle = '#c88c28';
  c.fillRect(0, 4 * S, w, 16 * S);
  c.fillRect(0, h - 20 * S, w, 16 * S);
  b.fillStyle = '#e0e0e0';
  b.fillRect(0, 4 * S, w, 16 * S);
  b.fillRect(0, h - 20 * S, w, 16 * S);

  const panels = 16;
  const pw = w / panels;
  const sceneColors = ['#184f86', '#196440', '#8c1a1c', '#205c68'];
  const poems = ['太和', '皇朝', '萬壽', '山河', '瑞氣', '明堂', '文明', '天命'];

  for (let i = 0; i < panels; i++) {
    const x0 = i * pw + 8 * S;
    const cw = pw - 16 * S;
    const y0 = 28 * S;
    const ch = h - 56 * S;
    const isPoem = i % 2 === 0;

    // Molded gilded & pale-ceramic border
    c.strokeStyle = '#dfae3c';
    c.lineWidth = 6 * S;
    c.strokeRect(x0, y0, cw, ch);
    b.strokeStyle = '#e8e8e8';
    b.lineWidth = 6 * S;
    b.strokeRect(x0, y0, cw, ch);

    if (isPoem) {
      // Warm imperial ochre or vermilion poetry tablet (NOT stark white!)
      c.fillStyle = i % 4 === 0 ? '#741214' : '#b88228';
      c.fillRect(x0 + 6 * S, y0 + 6 * S, cw - 12 * S, ch - 12 * S);
      c.fillStyle = i % 4 === 0 ? '#f6d668' : '#3a1406';
      c.font = `bold ${Math.round(34 * S)}px "KaiTi", "SimSun", serif`;
      c.textAlign = 'center';
      const txt = poems[Math.floor(i / 2) % poems.length];
      c.fillText(txt[0], x0 + cw * 0.34, y0 + ch * 0.42);
      c.fillText(txt[1], x0 + cw * 0.34, y0 + ch * 0.78);
      c.fillText('吉', x0 + cw * 0.68, y0 + ch * 0.42);
      c.fillText('祥', x0 + cw * 0.68, y0 + ch * 0.78);
    } else {
      // Polychrome `Khảm Sành Sứ` mosaic relief scene (dragon/phoenix/floral vase/Bát Bửu)
      const bgCol = sceneColors[Math.floor(i / 2) % sceneColors.length];
      c.fillStyle = bgCol;
      c.fillRect(x0 + 6 * S, y0 + 6 * S, cw - 12 * S, ch - 12 * S);
      // Swirling polychrome dragon/floral porcelain mosaic relief
      drawCongButCloud(c, x0 + cw * 0.32, y0 + ch * 0.50, 0.85 * S, '#e8a828', '#f6ecc4', '#2a1408', 1);
      drawCongButCloud(c, x0 + cw * 0.68, y0 + ch * 0.50, 0.85 * S, '#d44830', '#f6ecc4', '#2a1408', -1);
      c.fillStyle = '#fae078';
      c.beginPath();
      c.arc(x0 + cw * 0.50, y0 + ch * 0.48, 18 * S, 0, Math.PI * 2);
      c.fill();
      b.fillStyle = '#ffffff';
      b.beginPath();
      b.ellipse(x0 + cw * 0.50, y0 + ch * 0.50, cw * 0.35, ch * 0.32, 0, 0, Math.PI * 2);
      b.fill();
    }
  }

  const map = wrapCanvasTex(cObj.canvas, true, 1, 1, renderer, THREE.RepeatWrapping);
  const bumpMap = wrapCanvasTex(bObj.canvas, false, 1, 1, renderer, THREE.RepeatWrapping);
  return { map, bumpMap, roughnessMap: bumpMap };
}

/**
 * 8. 1024×1024 Varnished Antique Huế Encaustic Floor Tiles with Sobel `normalMap` — AS-20, IN-25, CL-30!
 *    Smaller refined tile scale (`4×4` per tile), warm antique honey-ochre/umber patina, low-contrast historical
 *    Indochinese quatrefoil arabesques (ZERO cartoon daisies!) + micro-beveled grout normal map!
 */
export function createHueEncausticFloorPbrTextures(
  renderer?: THREE.WebGLRenderer,
  repeatX = 1,
  repeatY = 1
): { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture } {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 1024;
  const cObj = makeCanvas(sz, sz);
  const hObj = makeCanvas(sz, sz);
  const rObj = makeCanvas(sz, sz);
  if (!cObj || !hObj || !rObj) {
    const flat = finalizeDataTex(new Uint8Array([134, 108, 68, 255]), 1, true, repeatX, repeatY, 1, renderer);
    const flatN = finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, false, repeatX, repeatY, 1, renderer);
    return { map: flat, normalMap: flatN, roughnessMap: flatN };
  }
  const c = cObj.ctx;
  const h = hObj.ctx;
  const r = rObj.ctx;
  const tiles = 4;
  const tw = sz / tiles;
  const S = sz / 1024;

  c.fillStyle = '#5c472c';
  c.fillRect(0, 0, sz, sz);
  h.fillStyle = '#202020';
  h.fillRect(0, 0, sz, sz);
  r.fillStyle = '#c8c8c8'; // matte grout lines
  r.fillRect(0, 0, sz, sz);

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const ox = tx * tw;
      const oy = ty * tw;
      const cx = ox + tw * 0.5;
      const cy = oy + tw * 0.5;
      const tid = hash2i(tx, ty, 3307);

      // Rich warm aged antique amber-ochre / golden honey patina per tile (Photos 1 & 5 — ZERO pale blue-grey!)
      const rTone = clampByte(164 + (tid - 0.5) * 20);
      const gTone = clampByte(126 + (tid - 0.5) * 16);
      const bTone = clampByte(68 + (tid - 0.5) * 10);
      c.fillStyle = `rgb(${rTone},${gTone},${bTone})`;
      c.fillRect(ox + 3 * S, oy + 3 * S, tw - 6 * S, tw - 6 * S);

      // Slight per-tile height & micro-sheen variation (hand-laid antique floor reflection wobble!)
      const hVal = clampByte(195 + (tid - 0.5) * 28);
      h.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
      h.fillRect(ox + 4 * S, oy + 4 * S, tw - 8 * S, tw - 8 * S);

      const rVal = clampByte(46 + tid * 36); // polished 0.18..0.32 mottled foot-wear sheen
      r.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      r.fillRect(ox + 4 * S, oy + 4 * S, tw - 8 * S, tw - 8 * S);

      // Soft muted historical Indochinese interlocking quatrefoil arabesque (harmonious warm sepia/sage/terracotta)
      c.strokeStyle = 'rgba(98, 76, 48, 0.52)';
      c.lineWidth = 3.2 * S;
      c.strokeRect(ox + 14 * S, oy + 14 * S, tw - 28 * S, tw - 28 * S);

      // Interlocking diamond & curved quatrefoil vine
      c.beginPath();
      c.moveTo(cx, oy + 16 * S);
      c.quadraticCurveTo(cx + tw * 0.14, cy - tw * 0.14, ox + tw - 16 * S, cy);
      c.quadraticCurveTo(cx + tw * 0.14, cy + tw * 0.14, cx, oy + tw - 16 * S);
      c.quadraticCurveTo(cx - tw * 0.14, cy + tw * 0.14, ox + 16 * S, cy);
      c.quadraticCurveTo(cx - tw * 0.14, cy - tw * 0.14, cx, oy + 16 * S);
      c.closePath();
      c.fillStyle = 'rgba(116, 94, 62, 0.32)';
      c.fill();
      c.stroke();

      // Delicate muted sage-olive & antique terracotta corner quarter-rosettes joining across tiles
      for (const [qx, qy] of [
        [ox, oy],
        [ox + tw, oy],
        [ox, oy + tw],
        [ox + tw, oy + tw]
      ]) {
        c.fillStyle = 'rgba(104, 92, 62, 0.34)';
        c.beginPath();
        c.arc(qx, qy, tw * 0.17, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(136, 98, 62, 0.38)';
        c.lineWidth = 2.5 * S;
        c.beginPath();
        c.arc(qx, qy, tw * 0.11, 0, Math.PI * 2);
        c.stroke();
      }

      // Soft central filigree star
      c.strokeStyle = 'rgba(118, 90, 56, 0.45)';
      c.lineWidth = 2.4 * S;
      c.beginPath();
      c.arc(cx, cy, tw * 0.11, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(176, 150, 102, 0.42)';
      c.beginPath();
      c.arc(cx, cy, tw * 0.055, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Soft historical patina mottling
  for (let i = 0; i < 650; i++) {
    const px = hash2i(i, 1, 9012) * sz;
    const py = hash2i(i, 2, 9012) * sz;
    c.fillStyle = i % 2 === 0 ? 'rgba(68, 52, 32, 0.06)' : 'rgba(192, 166, 118, 0.05)';
    c.fillRect(px, py, (6 + hash2i(i, 3, 9012) * 16) * S, (4 + hash2i(i, 4, 9012) * 12) * S);
  }

  const map = wrapCanvasTex(cObj.canvas, true, repeatX, repeatY, renderer, THREE.RepeatWrapping);
  const normalMap = canvasToSobelNormal(hObj.canvas, 1.5, repeatX, repeatY, renderer, true);
  const roughnessMap = wrapCanvasTex(rObj.canvas, false, repeatX, repeatY, renderer, THREE.RepeatWrapping);
  return { map, normalMap, roughnessMap };
}

/**
 * 9. 1024×1024 Burnished Honey-Ochre `Vách Đố Bản` Panelled Walls with 2-Tier Transom & Normal Map — AS-18, IN-28!
 */
export function createHueVachDoBanTexture(
  renderer?: THREE.WebGLRenderer,
  repeatX = 6,
  repeatY = 1
): { map: THREE.Texture; normalMap: THREE.Texture } {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 1024;
  const cObj = makeCanvas(sz, sz);
  const hObj = makeCanvas(sz, sz);
  if (!cObj || !hObj) {
    const flat = finalizeDataTex(new Uint8Array([166, 110, 26, 255]), 1, true, repeatX, repeatY, 1, renderer);
    const flatN = finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, false, repeatX, repeatY, 1, renderer);
    return { map: flat, normalMap: flatN };
  }
  const c = cObj.ctx;
  const h = hObj.ctx;
  const S = sz / 1024;

  // Deep glossy dark-crimson structural frame background
  c.fillStyle = '#4e0608';
  c.fillRect(0, 0, sz, sz);
  h.fillStyle = '#909090';
  h.fillRect(0, 0, sz, sz);

  // Upper 2-row dark-crimson & 24K gilded oval filigree transom register (top 26%)
  c.fillStyle = '#3f0406';
  c.fillRect(0, 0, sz, 240 * S);
  for (const rowY of [16 * S, 128 * S]) {
    for (let k = 0; k < 2; k++) {
      const rx = (28 + k * 498) * S;
      const rw = 468 * S;
      const rh = 96 * S;
      c.strokeStyle = '#e8b83a';
      c.lineWidth = 6 * S;
      c.strokeRect(rx, rowY, rw, rh);
      h.strokeStyle = '#ececec';
      h.lineWidth = 6 * S;
      h.strokeRect(rx, rowY, rw, rh);
      drawGildedFiligreeOval(c, rx + rw * 0.5, rowY + rh * 0.5, 132 * S, 36 * S, S * 1.15, false);
      drawGildedFiligreeOval(h, rx + rw * 0.5, rowY + rh * 0.5, 132 * S, 36 * S, S * 1.15, true);
    }
  }

  // 4 Tall Narrow Deep Burnished Antique Honey-Amber Lacquered Wood Panels (`Vách Đố Bản`)
  const panelCount = 4;
  const colW = sz / panelCount;
  for (let i = 0; i < panelCount; i++) {
    const px = i * colW + 22 * S;
    const pw = colW - 44 * S;

    const grad = c.createLinearGradient(px, 266 * S, px + pw, 816 * S);
    grad.addColorStop(0, '#966214');
    grad.addColorStop(0.5, '#ba7e1e');
    grad.addColorStop(1, '#845410');
    c.fillStyle = grad;
    c.fillRect(px, 266 * S, pw, 548 * S);

    // Recessed panel height + fine woodgrain lacquer striations
    h.fillStyle = '#484848';
    h.fillRect(px, 266 * S, pw, 548 * S);
    c.fillStyle = 'rgba(92, 54, 8, 0.14)';
    for (let gx = px + 8 * S; gx < px + pw - 8 * S; gx += 14 * S) {
      c.fillRect(gx, 274 * S, 4 * S, 532 * S);
    }

    // Double golden molding + inner bevel shadow
    c.strokeStyle = '#f2c84c';
    c.lineWidth = 6 * S;
    c.strokeRect(px + 6 * S, 272 * S, pw - 12 * S, 536 * S);
    c.strokeStyle = '#5a2e06';
    c.lineWidth = 3 * S;
    c.strokeRect(px + 14 * S, 280 * S, pw - 28 * S, 520 * S);
    h.strokeStyle = '#e0e0e0';
    h.lineWidth = 6 * S;
    h.strokeRect(px + 6 * S, 272 * S, pw - 12 * S, 536 * S);

    // Lower wainscoting dado panel
    c.fillStyle = '#8b5812';
    c.fillRect(px, 846 * S, pw, 146 * S);
    c.strokeStyle = '#ebb838';
    c.lineWidth = 5 * S;
    c.strokeRect(px + 6 * S, 852 * S, pw - 12 * S, 134 * S);
    h.fillStyle = '#484848';
    h.fillRect(px, 846 * S, pw, 146 * S);
  }

  // Horizontal gilded cornice rails
  for (const ry of [240 * S, 820 * S, 1004 * S]) {
    c.fillStyle = '#e4af2c';
    c.fillRect(0, ry, sz, 16 * S);
    h.fillStyle = '#f2f2f2';
    h.fillRect(0, ry, sz, 16 * S);
  }

  const map = wrapCanvasTex(cObj.canvas, true, repeatX, repeatY, renderer, THREE.RepeatWrapping);
  const normalMap = canvasToSobelNormal(hObj.canvas, 2.0, repeatX, repeatY, renderer, true);
  return { map, normalMap };
}

/**
 * 10. 512×512 Crisp 3×7 Vertical Elongated Diamond Imperial Bamboo Blinds (`Mành Tre Quả Trám`) — EX-07!
 */
export function createHueBambooBlindTexture(
  renderer?: THREE.WebGLRenderer,
  repeatX = 1,
  repeatY = 1
): { map: THREE.Texture; bumpMap: THREE.Texture } {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 512;
  const cObj = makeCanvas(sz, sz);
  const bObj = makeCanvas(sz, sz);
  if (!cObj || !bObj) {
    const flat = finalizeDataTex(new Uint8Array([224, 206, 158, 255]), 1, true, repeatX, repeatY, 1, renderer);
    return { map: flat, bumpMap: flat };
  }
  const c = cObj.ctx;
  const b = bObj.ctx;
  const S = sz / 512;

  // Near-black espresso horizontal bamboo ground (Ref #6 high contrast!)
  c.fillStyle = '#140c07';
  c.fillRect(0, 0, sz, sz);
  b.fillStyle = '#505050';
  b.fillRect(0, 0, sz, sz);

  // Authentic 3 vertical columns × 7 stacked vertically-elongated pearl-drop ivory diamonds!
  const cols = 3;
  const rows = 7;
  const cw = sz / cols;
  const ch = sz / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * cw;
      const cy = (r + 0.5) * ch;
      c.fillStyle = '#f2e5c2';
      c.beginPath();
      c.moveTo(cx, cy - ch * 0.44);
      c.lineTo(cx + cw * 0.27, cy);
      c.lineTo(cx, cy + ch * 0.44);
      c.lineTo(cx - cw * 0.27, cy);
      c.closePath();
      c.fill();
      c.strokeStyle = '#c2ab74';
      c.lineWidth = 1.6 * S;
      c.stroke();

      b.fillStyle = '#c8c8c8';
      b.beginPath();
      b.moveTo(cx, cy - ch * 0.44);
      b.lineTo(cx + cw * 0.27, cy);
      b.lineTo(cx, cy + ch * 0.44);
      b.lineTo(cx - cw * 0.27, cy);
      b.closePath();
      b.fill();
    }
  }

  // Fine horizontal bamboo slat shadow grooves + vertical binding cords (`dây đan`)
  c.fillStyle = 'rgba(14, 8, 4, 0.34)';
  for (let y = 0; y < sz; y += 5 * S) {
    c.fillRect(0, y, sz, 1.8 * S);
    b.fillStyle = '#202020';
    b.fillRect(0, y, sz, 1.8 * S);
  }
  c.fillStyle = 'rgba(42, 28, 16, 0.55)';
  for (let col = 0; col <= cols; col++) {
    c.fillRect(col * cw - 2 * S, 0, 4 * S, sz);
  }
  // Dark woven top & bottom weight hem bars
  c.fillStyle = '#1e1008';
  c.fillRect(0, 0, sz, 14 * S);
  c.fillRect(0, sz - 14 * S, sz, 14 * S);

  return {
    map: wrapCanvasTex(cObj.canvas, true, repeatX, repeatY, renderer),
    bumpMap: wrapCanvasTex(bObj.canvas, false, repeatX, repeatY, renderer)
  };
}

/**
 * 11. 512×512 Rich Cobalt Blue-and-White Huế Porcelain (`Sứ Lam Huế` — ~60% Cobalt Coverage!) — EX-17, IN-27, CL-30!
 */
export function createHuePorcelainCobaltTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 512;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([220, 226, 236, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = sz / 512;

  // Calm antique ivory-porcelain glaze (never blows out to blinding white!)
  ctx.fillStyle = '#dce2ec';
  ctx.fillRect(0, 0, sz, sz);

  // Heavy cobalt-indigo rim band + cloud-collar lappets (`vân kiên`) + lotus foot petals
  ctx.fillStyle = '#13306b';
  ctx.fillRect(0, 0, sz, 28 * S);
  ctx.fillRect(0, 476 * S, sz, 36 * S);

  for (let x = 0; x < sz; x += 42.6 * S) {
    // Upper dense cobalt cloud-collar lappets
    ctx.fillStyle = '#1b4796';
    ctx.beginPath();
    ctx.moveTo(x, 28 * S);
    ctx.quadraticCurveTo(x + 21 * S, 108 * S, x + 42.6 * S, 28 * S);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e8edf5';
    ctx.lineWidth = 2.5 * S;
    ctx.stroke();

    // Lower cobalt lotus petal band
    ctx.fillStyle = '#183f88';
    ctx.beginPath();
    ctx.moveTo(x + 2 * S, 476 * S);
    ctx.quadraticCurveTo(x + 21 * S, 372 * S, x + 40.6 * S, 476 * S);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Dense Cobalt-Indigo Imperial Dragons, `Sơn Thủy` Mountains & Swirling Lotus Scrolls across belly (~60% coverage!)
  ctx.fillStyle = '#24529e';
  ctx.beginPath();
  ctx.moveTo(0, 368 * S);
  for (let x = 0; x <= sz; x += 24 * S) {
    const my = 310 * S - Math.abs(Math.sin((x / sz) * Math.PI * 3.0)) * 78 * S;
    ctx.lineTo(x, my);
  }
  ctx.lineTo(sz, 368 * S);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#102b60';
  ctx.lineWidth = 14 * S;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 0; x <= sz; x += 10 * S) {
    const y = (212 + Math.sin((x / sz) * Math.PI * 4) * 62) * S;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#4e7cc4';
  ctx.lineWidth = 4 * S;
  ctx.stroke();

  for (let k = 0; k < 8; k++) {
    const lx = (32 + k * 64) * S;
    const ly = (148 + (k % 2) * 142) * S;
    drawCongButCloud(ctx, lx, ly, 1.05 * S, '#18428c', '#c8d6ee', '#0e2452', k % 2 === 0 ? 1 : -1);
  }

  return wrapCanvasTex(canvas, true, 1, 1, renderer, THREE.RepeatWrapping);
}

/**
 * 11b. 1024×512 Lacy Filigree `Lưỡng Long Chầu Nguyệt` Openwork `Cửa Võng` Texture with PBR Normal/Roughness — CL-19, CL-20, IN-28!
 *      ZERO mechanical C-arcs or triangle teeth: sculpted confronting dragons, central flaming solar pearl,
 *      intricate organic chrysanthemum/lotus vines, dark burnt-amber carved crevice bevels & scalloped scroll pendants!
 */
export function createHueCuaVongFiligreeTexture(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 1024;
  const h = headless ? 64 : 512;
  const cObj = makeCanvas(w, h);
  const hObj = makeCanvas(w, h);
  if (!cObj || !hObj) {
    const flat = finalizeDataTex(new Uint8Array([228, 174, 42, 255]), 1, true, 1, 1, 1, renderer);
    const flatN = finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, false, 1, 1, 1, renderer);
    return { map: flat, normalMap: flatN, roughnessMap: flatN };
  }
  const c = cObj.ctx;
  const b = hObj.ctx;
  const S = w / 1024;
  c.clearRect(0, 0, w, h);
  b.fillStyle = '#000000';
  b.fillRect(0, 0, w, h);

  // Dual-pass helper: dark burnt-umber undercut bevel FIRST, then rich 24K burnished gold crest + white height!
  const strokeCarved = (pathFn: (ctx: CanvasRenderingContext2D) => void, widthPx: number, bright = false) => {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    b.lineCap = 'round';
    b.lineJoin = 'round';
    // Dark undercut shadow outline
    c.strokeStyle = '#4c2004';
    c.lineWidth = (widthPx + 5.5) * S;
    c.beginPath();
    pathFn(c);
    c.stroke();
    // Midtone burnished 24K gold
    c.strokeStyle = bright ? '#f6cf54' : '#dfa624';
    c.lineWidth = widthPx * S;
    c.beginPath();
    pathFn(c);
    c.stroke();
    // Raised specular crest highlight
    c.strokeStyle = '#fff09c';
    c.lineWidth = Math.max(1.8, widthPx * 0.34) * S;
    c.beginPath();
    pathFn(c);
    c.stroke();
    // Height relief buffer
    b.strokeStyle = bright ? '#ffffff' : '#d8d8d8';
    b.lineWidth = widthPx * S;
    b.beginPath();
    pathFn(b);
    b.stroke();
  };

  // 1. Upper Pierced Floral/Key-Fret Transom Frame & Outer Side Stiles
  const frameBars: Array<[number, number, number, number]> = [
    [0, 0, w, 24 * S],
    [0, 68 * S, w, 14 * S],
    [0, 0, 34 * S, h * 0.94],
    [w - 34 * S, 0, 34 * S, h * 0.94]
  ];
  for (const [rx, ry, rw, rh] of frameBars) {
    c.fillStyle = '#d4941a';
    c.fillRect(rx, ry, rw, rh);
    c.strokeStyle = '#4e2204';
    c.lineWidth = 3 * S;
    c.strokeRect(rx, ry, rw, rh);
    b.fillStyle = '#dcdcdc';
    b.fillRect(rx, ry, rw, rh);
  }
  // Key-fret lattice inside upper transom (y = 24..68)
  for (let x = 44 * S; x < w - 44 * S; x += 44 * S) {
    strokeCarved((ctx) => {
      ctx.rect(x, 30 * S, 30 * S, 30 * S);
      ctx.moveTo(x + 8 * S, 45 * S);
      ctx.lineTo(x + 22 * S, 45 * S);
    }, 4.5);
  }

  // 2. Multi-Lobed Cusped Ogee Inner Arch Rib framing the Golden Throne opening
  strokeCarved((ctx) => {
    ctx.moveTo(26 * S, h * 0.94);
    ctx.bezierCurveTo(64 * S, h * 0.62, 118 * S, h * 0.42, 224 * S, h * 0.44);
    ctx.bezierCurveTo(340 * S, h * 0.46, 420 * S, h * 0.36, 512 * S, h * 0.42);
    ctx.bezierCurveTo(604 * S, h * 0.36, 684 * S, h * 0.46, 800 * S, h * 0.44);
    ctx.bezierCurveTo(906 * S, h * 0.42, 960 * S, h * 0.62, w - 26 * S, h * 0.94);
  }, 15, true);

  // 3. Grand Symmetrical Confronting `Lưỡng Long Chầu Nhật` Carved Dragons + Central Flaming Solar Pearl!
  for (const side of [-1, 1]) {
    // Sweeping sinuous dragon spine confronting center pearl
    strokeCarved((ctx) => {
      ctx.moveTo(w * 0.5 + side * 66 * S, 136 * S);
      ctx.bezierCurveTo(
        w * 0.5 + side * 145 * S,
        92 * S,
        w * 0.5 + side * 235 * S,
        198 * S,
        w * 0.5 + side * 320 * S,
        134 * S
      );
      ctx.bezierCurveTo(
        w * 0.5 + side * 395 * S,
        88 * S,
        w * 0.5 + side * 445 * S,
        196 * S,
        w * 0.5 + side * 468 * S,
        340 * S
      );
    }, 15, true);

    // Secondary descending phoenix-and-vine wing drop (`Cánh Võng`)
    strokeCarved((ctx) => {
      ctx.moveTo(w * 0.5 + side * 395 * S, 195 * S);
      ctx.bezierCurveTo(
        w * 0.5 + side * 448 * S,
        245 * S,
        w * 0.5 + side * 425 * S,
        355 * S,
        w * 0.5 + side * 462 * S,
        452 * S
      );
    }, 10);

    // Organic swirling chrysanthemum & lotus-vine filigree filling upper valance & side wings
    for (let k = 0; k < 10; k++) {
      const fx = w * 0.5 + side * (95 + k * 39) * S;
      const fy = (104 + (k % 2) * 58 + (k > 7 ? (k - 7) * 54 : 0)) * S;
      strokeCarved((ctx) => {
        ctx.arc(fx, fy, (15 + (k % 3) * 4) * S, 0, Math.PI * 1.65);
      }, 5.5);
      // Swirling filigree cloud boss
      drawCongButCloud(c, fx, fy + 16 * S, 0.72 * S, '#e4ae28', '#fff098', '#4c2004', side);
      drawCongButCloud(b, fx, fy + 16 * S, 0.72 * S, '#d0d0d0', '#ffffff');
    }
    // Descending wing lotus curls
    for (let v = 0; v < 5; v++) {
      const wx = w * 0.5 + side * (432 + (v % 2) * 26) * S;
      const wy = (242 + v * 46) * S;
      strokeCarved((ctx) => {
        ctx.arc(wx, wy, 14 * S, 0, Math.PI * 1.7);
      }, 5.0);
    }
  }

  // Central Multi-Ringed Flaming Solar Pearl (`Châu Báu`)
  for (let ray = 0; ray < 12; ray++) {
    const a = (ray / 12) * Math.PI * 2;
    strokeCarved((ctx) => {
      ctx.moveTo(w * 0.5 + Math.cos(a) * 24 * S, 138 * S + Math.sin(a) * 24 * S);
      ctx.lineTo(w * 0.5 + Math.cos(a) * 48 * S, 138 * S + Math.sin(a) * 48 * S);
    }, 3.5, true);
  }
  c.fillStyle = '#fff098';
  c.beginPath();
  c.arc(w * 0.5, 138 * S, 24 * S, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#522204';
  c.lineWidth = 4 * S;
  c.stroke();
  b.fillStyle = '#ffffff';
  b.beginPath();
  b.arc(w * 0.5, 138 * S, 24 * S, 0, Math.PI * 2);
  b.fill();

  // 4. Delicate Curved Carved Scroll Pendants & Lotus-Bud Tassel Drops along Arch Contour
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    const fx = t * w;
    const distC = Math.abs(t - 0.5) * 2.0;
    const fy = distC > 0.74 ? h * (0.45 + (distC - 0.74) * 1.72) : h * (0.42 + Math.sin(t * Math.PI * 3) * 0.02);
    const dropLen = (26 + (i % 2) * 14) * S;
    strokeCarved((ctx) => {
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + dropLen);
    }, 4.0);
    c.fillStyle = '#fae078';
    c.beginPath();
    c.ellipse(fx, fy + dropLen + 8 * S, 6.5 * S, 9.5 * S, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#4c2004';
    c.lineWidth = 2 * S;
    c.stroke();
  }

  // Roughness map: raised gold crests 0.18, recessed bevels 0.56
  const rObj = makeCanvas(w, h);
  let roughTex: THREE.Texture;
  if (rObj) {
    rObj.ctx.fillStyle = '#929292';
    rObj.ctx.fillRect(0, 0, w, h);
    rObj.ctx.globalCompositeOperation = 'difference';
    rObj.ctx.globalAlpha = 0.62;
    rObj.ctx.drawImage(hObj.canvas, 0, 0);
    roughTex = wrapCanvasTex(rObj.canvas, false, 1, 1, renderer);
  } else {
    roughTex = finalizeDataTex(new Uint8Array([70, 70, 70, 255]), 1, false, 1, 1, 1, renderer);
  }

  const map = wrapCanvasTex(cObj.canvas, true, 1, 1, renderer);
  const normalMap = canvasToSobelNormal(hObj.canvas, 2.6, 1, 1, renderer, false);
  return { map, normalMap, roughnessMap: roughTex };
}

/**
 * 11c. 256×256 Pierced Openwork Triangular Golden `Kê Góc` Corner Spandrel Texture — IN-24, AS-28, CL-28!
 *      Replaces low-poly 4-sided pyramid cones at column-beam junctions with delicate carved golden lace!
 */
export function createHueKeGocFiligreeTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 256;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([240, 192, 56, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = sz / 256;
  ctx.clearRect(0, 0, sz, sz);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Upper-left right-triangle carved openwork bracket: top edge (y=0), left edge (x=0), sweeping concave ogee hypotenuse
  const strokeG = (fn: () => void, lw: number) => {
    ctx.strokeStyle = '#522404';
    ctx.lineWidth = (lw + 4) * S;
    ctx.beginPath();
    fn();
    ctx.stroke();
    ctx.strokeStyle = '#efc03c';
    ctx.lineWidth = lw * S;
    ctx.beginPath();
    fn();
    ctx.stroke();
    ctx.strokeStyle = '#fff09c';
    ctx.lineWidth = Math.max(1.5, lw * 0.35) * S;
    ctx.beginPath();
    fn();
    ctx.stroke();
  };

  strokeG(() => {
    ctx.moveTo(8 * S, 8 * S);
    ctx.lineTo(244 * S, 8 * S);
    ctx.quadraticCurveTo(148 * S, 42 * S, 86 * S, 112 * S);
    ctx.quadraticCurveTo(42 * S, 168 * S, 8 * S, 244 * S);
    ctx.closePath();
  }, 10);

  // Swirling inner dragon-cloud filigree curls inside the triangular bracket
  strokeG(() => {
    ctx.moveTo(22 * S, 22 * S);
    ctx.bezierCurveTo(104 * S, 18 * S, 142 * S, 52 * S, 96 * S, 82 * S);
    ctx.bezierCurveTo(56 * S, 108 * S, 24 * S, 146 * S, 26 * S, 198 * S);
  }, 7);
  for (const [cx, cy, rad] of [
    [54, 46, 20],
    [122, 34, 16],
    [42, 114, 18],
    [172, 22, 11]
  ]) {
    strokeG(() => {
      ctx.arc(cx * S, cy * S, rad * S, 0, Math.PI * 1.65);
    }, 5.5);
  }

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 11d. 512×768 Hammered 24K Gold-Leaf Rear Sanctuary Screen (`Bình Phong Dát Vàng Lá`) — CL-24, IN-28!
 */
export function createHueThroneScreenTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 64 : 512;
  const h = headless ? 96 : 768;
  const cObj = makeCanvas(w, h);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([242, 190, 56, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = w / 512;

  // Warm bottom-up radiant imperial gold-leaf backdrop
  const g = ctx.createRadialGradient(w * 0.5, h * 0.62, 24 * S, w * 0.5, h * 0.52, h * 0.58);
  g.addColorStop(0, '#ffe88a');
  g.addColorStop(0.55, '#eab22c');
  g.addColorStop(1, '#ba7e14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Hand-applied 24K gold-leaf square patchwork (`dát vàng lá`)
  const leaf = 64 * S;
  for (let ly = 0; ly < h; ly += leaf) {
    for (let lx = 0; lx < w; lx += leaf) {
      const v = hash2i(Math.round(lx), Math.round(ly), 4409);
      ctx.fillStyle = v > 0.5 ? 'rgba(255, 244, 178, 0.12)' : 'rgba(148, 86, 8, 0.08)';
      ctx.fillRect(lx, ly, leaf, leaf);
      ctx.strokeStyle = 'rgba(132, 76, 8, 0.16)';
      ctx.lineWidth = 1 * S;
      ctx.strokeRect(lx, ly, leaf, leaf);
    }
  }

  // Subtle embossed cloud-and-dragon watermark sheen
  ctx.globalAlpha = 0.22;
  for (let k = 0; k < 10; k++) {
    drawCongButCloud(
      ctx,
      (80 + (k % 3) * 176) * S,
      (110 + Math.floor(k / 3) * 175) * S,
      1.35 * S,
      '#c88210',
      '#fff4b8',
      undefined,
      k % 2 === 0 ? 1 : -1
    );
  }
  ctx.globalAlpha = 1.0;

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 11e. 256×256 Razor-Sharp 12-Ray Photographic Diffraction Spotlight Starburst — IN-04, AS-24!
 */
export function createHueStarburstFlareTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 32 : 256;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([255, 248, 224, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const mid = sz * 0.5;
  ctx.clearRect(0, 0, sz, sz);

  // Tight brilliant pure-white core + soft warm-amber bloom halo
  const core = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.36);
  core.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  core.addColorStop(0.16, 'rgba(255, 250, 226, 0.92)');
  core.addColorStop(0.48, 'rgba(255, 212, 128, 0.24)');
  core.addColorStop(1, 'rgba(255, 180, 72, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, sz, sz);

  // 6 ultra-thin long primary needle diffraction spikes + 6 intermediate secondary spikes (12-ray camera starburst!)
  ctx.save();
  ctx.translate(mid, mid);
  for (let r = 0; r < 12; r++) {
    const primary = r % 2 === 0;
    const len = mid * (primary ? 0.98 : 0.62);
    const halfW = sz * (primary ? 0.010 : 0.007);
    const ray = ctx.createLinearGradient(0, 0, len, 0);
    ray.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    ray.addColorStop(0.28, 'rgba(255, 244, 204, 0.46)');
    ray.addColorStop(1, 'rgba(255, 220, 140, 0.0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, -halfW);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, halfW);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(Math.PI / 6);
  }
  ctx.restore();

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 12. Dark Mirror-Reflective Moat Water Shader (Photo 2 Kim Thủy / Thái Dịch Moat)
 */
export function createHueReflectiveMoatMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: { uTime: { value: number }; uNightAmount: { value: number }; uDuskAmount: { value: number } };
} {
  const uniforms = {
    uTime: { value: 0.0 },
    uNightAmount: { value: 0.0 },
    uDuskAmount: { value: 0.0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNightAmount;
      uniform float uDuskAmount;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float w1 = noise2(vWorldPos.xz * 0.42 + vec2(uTime * 0.08, -uTime * 0.05));
        float w2 = noise2(vWorldPos.xz * 1.15 - vec2(uTime * 0.10, uTime * 0.07));
        vec3 N = normalize(vec3((w1 - 0.5) * 0.020, 1.0, (w2 - 0.5) * 0.020));

        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 2.2) * 0.62 + 0.16;

        vec3 R = reflect(-V, N);
        float skyH = clamp(R.y, 0.0, 1.0);
        vec3 daySky = mix(vec3(0.20, 0.50, 0.88), vec3(0.06, 0.24, 0.66), smoothstep(0.0, 0.55, skyH));
        vec3 duskSky = mix(vec3(0.76, 0.46, 0.26), vec3(0.14, 0.24, 0.52), smoothstep(0.0, 0.55, skyH));
        vec3 nightSky = vec3(0.03, 0.06, 0.14);
        vec3 skyRefl = mix(mix(daySky, duskSky, uDuskAmount), nightSky, uNightAmount);
        float cl = noise2(R.xz / max(R.y + 0.18, 0.22) * 1.8 + vec2(0.25, 0.65));
        skyRefl = mix(skyRefl, mix(vec3(0.88, 0.92, 0.97), vec3(0.14, 0.18, 0.28), uNightAmount), smoothstep(0.58, 0.78, cl) * 0.55);

        float edgeDist = min(vUv.y, 1.0 - vUv.y);
        float bankProx = 1.0 - smoothstep(0.0, 0.42, edgeDist);
        vec3 deepWater = vec3(0.012, 0.042, 0.052);
        vec3 bankRefl = vec3(0.05, 0.07, 0.06);
        vec3 reflCol = mix(skyRefl, bankRefl, bankProx * 0.84);

        vec3 col = mix(deepWater, reflCol, fresnel);
        col *= mix(1.0, 0.34, smoothstep(0.24, 0.0, edgeDist));

        float spec = pow(max(dot(R, normalize(vec3(0.45, 0.55, -0.68))), 0.0), 96.0) * 0.28 * (1.0 - uNightAmount);
        col += vec3(1.0, 0.95, 0.85) * spec;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  return { material, uniforms };
}

export interface HueImperialMaterialPack {
  hoangLuuLyMat: THREE.MeshPhysicalMaterial;
  thanhLuuLyMat: THREE.MeshPhysicalMaterial;
  dragonColumnMat: THREE.MeshStandardMaterial;
  cuuLongAnVanMat: THREE.MeshStandardMaterial;
  hoanhPhiThaiHoaMat: THREE.MeshStandardMaterial;
  interiorNhatThiMat: THREE.MeshStandardMaterial;
  encausticFloorMat: THREE.MeshStandardMaterial;
  vachDoBanMat: THREE.MeshStandardMaterial;
  thanhStoneMat: THREE.MeshStandardMaterial;
  rubbleMoatMat: THREE.MeshStandardMaterial;
  bastionBrickMat: THREE.MeshStandardMaterial;
  weatheredMoatBalustradeMat: THREE.MeshStandardMaterial;
  bambooBlindMat: THREE.MeshStandardMaterial;
  porcelainCobaltMat: THREE.MeshStandardMaterial;
  imperialCrimsonWoodMat: THREE.MeshStandardMaterial;
  imperialGoldLeafMat: THREE.MeshStandardMaterial;
  brightBarrierRedMat: THREE.MeshStandardMaterial;
  antiqueBronzeCauldronMat: THREE.MeshStandardMaterial;
  ceramicMosaicMat: THREE.MeshStandardMaterial;
  terracottaBalustradeMat: THREE.MeshStandardMaterial;
  coDiemMosaicMat: THREE.MeshStandardMaterial;
  cuaVongFiligreeMat: THREE.MeshStandardMaterial;
  keGocFiligreeMat: THREE.MeshStandardMaterial;
  throneScreenGoldMat: THREE.MeshStandardMaterial;
  starburstFlareMat: THREE.SpriteMaterial;
  moatReflectiveWaterMat: THREE.ShaderMaterial;
  moatWaterUniforms: { uTime: { value: number }; uNightAmount: { value: number }; uDuskAmount: { value: number } };
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

/**
 * Builds ONE canonical shared Hue Imperial PBR Material Pack reused across Ngọ Môn,
 * Core Điện Thái Hòa, and Macro Hoàng Cung Huế.
 * Every interior material has `fog: false` + suppressed cool sky IBL (`envMapIntensity`)
 * so Điện Thái Hòa glows in museum-grade deep blood-crimson lacquer & burnished 24K gold!
 */
export function createHueImperialMaterialPack(
  renderer?: THREE.WebGLRenderer,
  _bronzePatinaPbr?: PbrTextureSet,
  targetPbrSize?: number
): HueImperialMaterialPack {
  const headless = isHeadlessRenderer(renderer);
  const pbrSize = headless ? 128 : (targetPbrSize ?? 512);
  const medSize = headless ? 64 : Math.min(512, pbrSize);

  const hoangPbr = createHueGlazedRoofPbrTextures('hoang_luu_ly', { size: pbrSize, renderer });
  const thanhPbr = createHueGlazedRoofPbrTextures('thanh_luu_ly', { size: pbrSize, renderer });
  const thanhStonePbr = createHueThanhStonePbrTextures({ size: pbrSize, renderer });
  const rubblePbr = createHueRubbleMoatPbrTextures({ size: pbrSize, renderer });
  const bastionBrickPbr = createHueBastionBrickPbrTextures({ size: medSize, renderer });
  const ceramicMosaicPbr = createHueCeramicMosaicPbrTextures({ size: headless ? 64 : 256, renderer });
  const agedTerracottaPbr = createHueAgedTerracottaPbrTextures({ size: headless ? 64 : 256, renderer });
  const moatBalustradePbr = createHueWeatheredMoatStonePbrTextures({ size: headless ? 64 : 256, renderer });
  const crimsonLacquerPbr = createHueCrimsonLacquerPbrTextures({ size: headless ? 64 : 256, renderer });
  const carvedGoldPbr = createHueCarvedGoldPbrTextures({ size: headless ? 64 : 256, renderer });
  const buuDinhPbr = createHueBuuDinhReliefPbrTextures(renderer);
  const dragonColTex = createHueDragonColumnPbrTextures(renderer);
  const cuuLongTex = createHueCuuLongAnVanTexture(renderer);
  const hoanhPhiTex = createHueHoanhPhiThaiHoaTexture(renderer);
  const nhatThiTex = createHueInteriorNhatThiTexture(renderer);
  const coDiemTex = createHueCoDiemMosaicPbrTextures(renderer);
  const floorTex = createHueEncausticFloorPbrTextures(renderer, 1, 1);
  const vachTex = createHueVachDoBanTexture(renderer, 6, 1);
  const bambooTex = createHueBambooBlindTexture(renderer, 1, 1);
  const porcelainTex = createHuePorcelainCobaltTexture(renderer);
  const cuaVongTex = createHueCuaVongFiligreeTexture(renderer);
  const keGocTex = createHueKeGocFiligreeTexture(renderer);
  const throneScreenTex = createHueThroneScreenTexture(renderer);
  const starburstTex = createHueStarburstFlareTexture(renderer);
  const moatWater = createHueReflectiveMoatMaterial();

  const hoangLuuLyMat = new THREE.MeshPhysicalMaterial({
    color: '#ffdb6e',
    map: hoangPbr.map,
    normalMap: hoangPbr.normalMap,
    normalScale: new THREE.Vector2(1.9, 1.9),
    roughnessMap: hoangPbr.roughnessMap,
    aoMap: hoangPbr.aoMap,
    roughness: 1.0,
    metalness: 0.05,
    clearcoat: 0.14,
    clearcoatRoughness: 0.30,
    envMapIntensity: 0.18,
    side: THREE.FrontSide
  });

  const thanhLuuLyMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: thanhPbr.map,
    normalMap: thanhPbr.normalMap,
    normalScale: new THREE.Vector2(1.9, 1.9),
    roughnessMap: thanhPbr.roughnessMap,
    aoMap: thanhPbr.aoMap,
    roughness: 1.0,
    metalness: 0.06,
    clearcoat: 0.24,
    clearcoatRoughness: 0.26,
    envMapIntensity: 0.24,
    side: THREE.FrontSide
  });

  // Interior Lacquer & Gold Materials: NO sky-reflecting clearcoat! Keeps deep blood-ruby crimson & blazing 24K gold free of cool blue/pink washout!
  const dragonColumnMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: dragonColTex.map,
    normalMap: dragonColTex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: dragonColTex.roughnessMap,
    metalnessMap: dragonColTex.metalnessMap,
    emissiveMap: dragonColTex.map,
    emissive: new THREE.Color('#ffaa38'),
    emissiveIntensity: 0.08,
    roughness: 0.92,
    metalness: 0.86,
    envMapIntensity: 0.12,
    fog: false
  });

  // Un-tinted deep imperial saffron-gold & cinnabar museum painting (emissive 0.34 prevents ACES pastel washout! CL-02, CL-14)
  const cuuLongAnVanMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: cuuLongTex.map,
    bumpMap: cuuLongTex.bumpMap,
    bumpScale: 0.018,
    emissiveMap: cuuLongTex.map,
    emissive: new THREE.Color('#ffda8c'),
    emissiveIntensity: 0.34,
    roughness: 0.44,
    metalness: 0.08,
    envMapIntensity: 0.0,
    side: THREE.DoubleSide,
    fog: false
  });

  const hoanhPhiThaiHoaMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: hoanhPhiTex.map,
    bumpMap: hoanhPhiTex.bumpMap,
    bumpScale: 0.036,
    metalnessMap: hoanhPhiTex.metalnessMap,
    roughnessMap: hoanhPhiTex.roughnessMap,
    emissiveMap: hoanhPhiTex.map,
    emissive: new THREE.Color('#ffc868'),
    emissiveIntensity: 0.24,
    roughness: 0.96,
    metalness: 0.86,
    envMapIntensity: 0.22,
    fog: false
  });

  const interiorNhatThiMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: nhatThiTex.map,
    bumpMap: nhatThiTex.bumpMap,
    bumpScale: 0.032,
    metalnessMap: nhatThiTex.metalnessMap,
    roughnessMap: nhatThiTex.roughnessMap,
    emissiveMap: nhatThiTex.map,
    emissive: new THREE.Color('#ffc462'),
    emissiveIntensity: 0.20,
    roughness: 0.96,
    metalness: 0.84,
    envMapIntensity: 0.20,
    fog: false
  });

  // ZERO outdoor sky envMap grazing Fresnel on interior floor -> warm golden-amber patina all the way to the far wall!
  const encausticFloorMat = new THREE.MeshStandardMaterial({
    color: '#d8b47c',
    map: floorTex.map,
    normalMap: floorTex.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: floorTex.roughnessMap,
    emissiveMap: floorTex.map,
    emissive: new THREE.Color('#a07232'),
    emissiveIntensity: 0.16,
    roughness: 0.46,
    metalness: 0.04,
    envMapIntensity: 0.0,
    fog: false
  });

  const vachDoBanMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: vachTex.map,
    normalMap: vachTex.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    emissiveMap: vachTex.map,
    emissive: new THREE.Color('#ffba52'),
    emissiveIntensity: 0.14,
    roughness: 0.36,
    metalness: 0.14,
    envMapIntensity: 0.10,
    fog: false
  });

  const thanhStoneMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: thanhStonePbr.map,
    normalMap: thanhStonePbr.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: thanhStonePbr.roughnessMap,
    aoMap: thanhStonePbr.aoMap,
    roughness: 1.0,
    metalness: 0.04
  });

  const rubbleMoatMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: rubblePbr.map,
    normalMap: rubblePbr.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: rubblePbr.roughnessMap,
    aoMap: rubblePbr.aoMap,
    roughness: 1.0,
    metalness: 0.03
  });

  const bastionBrickMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: bastionBrickPbr.map,
    normalMap: bastionBrickPbr.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: bastionBrickPbr.roughnessMap,
    aoMap: bastionBrickPbr.aoMap,
    roughness: 1.0,
    metalness: 0.03
  });

  const weatheredMoatBalustradeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: moatBalustradePbr.map,
    normalMap: moatBalustradePbr.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: moatBalustradePbr.roughnessMap,
    aoMap: moatBalustradePbr.aoMap,
    roughness: 1.0,
    metalness: 0.03
  });

  const bambooBlindMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: bambooTex.map,
    bumpMap: bambooTex.bumpMap,
    bumpScale: 0.025,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  const porcelainCobaltMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: porcelainTex,
    roughness: 0.22,
    metalness: 0.05,
    envMapIntensity: 0.45,
    fog: false
  });

  const imperialCrimsonWoodMat = new THREE.MeshStandardMaterial({
    color: '#9e0e10',
    map: crimsonLacquerPbr.map,
    normalMap: crimsonLacquerPbr.normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: crimsonLacquerPbr.roughnessMap,
    roughness: 0.96,
    metalness: 0.05,
    envMapIntensity: 0.0,
    fog: false
  });

  const imperialGoldLeafMat = new THREE.MeshStandardMaterial({
    color: '#ffd248',
    map: carvedGoldPbr.map,
    normalMap: carvedGoldPbr.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: carvedGoldPbr.roughnessMap,
    aoMap: carvedGoldPbr.aoMap,
    roughness: 0.92,
    metalness: 0.84,
    emissive: new THREE.Color('#7a4204'),
    emissiveIntensity: 0.28,
    envMapIntensity: 0.45,
    fog: false
  });

  const brightBarrierRedMat = new THREE.MeshStandardMaterial({
    color: '#9e0408',
    emissive: new THREE.Color('#280102'),
    emissiveIntensity: 0.06,
    roughness: 0.30,
    metalness: 0.04,
    envMapIntensity: 0.0,
    fog: false
  });

  const antiqueBronzeCauldronMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: buuDinhPbr.map,
    normalMap: buuDinhPbr.normalMap,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughnessMap: buuDinhPbr.roughnessMap,
    roughness: 1.0,
    metalness: 0.72,
    envMapIntensity: 0.44,
    fog: false
  });

  const ceramicMosaicMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: ceramicMosaicPbr.map,
    normalMap: ceramicMosaicPbr.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: ceramicMosaicPbr.roughnessMap,
    aoMap: ceramicMosaicPbr.aoMap,
    roughness: 1.0,
    metalness: 0.08
  });

  const terracottaBalustradeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: agedTerracottaPbr.map,
    normalMap: agedTerracottaPbr.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: agedTerracottaPbr.roughnessMap,
    aoMap: agedTerracottaPbr.aoMap,
    roughness: 1.0,
    metalness: 0.03
  });

  const coDiemMosaicMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: coDiemTex.map,
    bumpMap: coDiemTex.bumpMap,
    bumpScale: 0.035,
    roughness: 0.44,
    metalness: 0.12
  });

  const cuaVongFiligreeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: cuaVongTex.map,
    normalMap: cuaVongTex.normalMap,
    normalScale: new THREE.Vector2(1.8, 1.8),
    roughnessMap: cuaVongTex.roughnessMap,
    emissiveMap: cuaVongTex.map,
    emissive: new THREE.Color('#c8760e'),
    emissiveIntensity: 0.09,
    alphaTest: 0.36,
    roughness: 1.0,
    metalness: 0.92,
    envMapIntensity: 0.95,
    side: THREE.DoubleSide,
    fog: false
  });

  const keGocFiligreeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: keGocTex,
    emissiveMap: keGocTex,
    emissive: new THREE.Color('#9c5a0a'),
    emissiveIntensity: 0.12,
    alphaTest: 0.36,
    roughness: 0.24,
    metalness: 0.88,
    envMapIntensity: 0.85,
    side: THREE.DoubleSide,
    fog: false
  });

  const throneScreenGoldMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: throneScreenTex,
    emissiveMap: throneScreenTex,
    emissive: new THREE.Color('#ffbe46'),
    emissiveIntensity: 0.36,
    roughness: 0.30,
    metalness: 0.76,
    envMapIntensity: 0.65,
    fog: false
  });

  const starburstFlareMat = new THREE.SpriteMaterial({
    map: starburstTex,
    color: '#fff6da',
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.96,
    fog: false
  });

  const allMaterials: THREE.Material[] = [
    hoangLuuLyMat,
    thanhLuuLyMat,
    dragonColumnMat,
    cuuLongAnVanMat,
    hoanhPhiThaiHoaMat,
    interiorNhatThiMat,
    encausticFloorMat,
    vachDoBanMat,
    thanhStoneMat,
    rubbleMoatMat,
    bastionBrickMat,
    weatheredMoatBalustradeMat,
    bambooBlindMat,
    porcelainCobaltMat,
    imperialCrimsonWoodMat,
    imperialGoldLeafMat,
    brightBarrierRedMat,
    antiqueBronzeCauldronMat,
    ceramicMosaicMat,
    terracottaBalustradeMat,
    coDiemMosaicMat,
    cuaVongFiligreeMat,
    keGocFiligreeMat,
    throneScreenGoldMat,
    starburstFlareMat,
    moatWater.material
  ];

  for (const mat of allMaterials) {
    mat.userData.sharedProtected = true;
  }

  const allTextures: THREE.Texture[] = [
    hoangPbr.map, hoangPbr.normalMap, hoangPbr.roughnessMap, hoangPbr.aoMap,
    thanhPbr.map, thanhPbr.normalMap, thanhPbr.roughnessMap, thanhPbr.aoMap,
    thanhStonePbr.map, thanhStonePbr.normalMap, thanhStonePbr.roughnessMap, thanhStonePbr.aoMap,
    rubblePbr.map, rubblePbr.normalMap, rubblePbr.roughnessMap, rubblePbr.aoMap,
    bastionBrickPbr.map, bastionBrickPbr.normalMap, bastionBrickPbr.roughnessMap, bastionBrickPbr.aoMap,
    ceramicMosaicPbr.map, ceramicMosaicPbr.normalMap, ceramicMosaicPbr.roughnessMap, ceramicMosaicPbr.aoMap,
    agedTerracottaPbr.map, agedTerracottaPbr.normalMap, agedTerracottaPbr.roughnessMap, agedTerracottaPbr.aoMap,
    moatBalustradePbr.map, moatBalustradePbr.normalMap, moatBalustradePbr.roughnessMap, moatBalustradePbr.aoMap,
    crimsonLacquerPbr.map, crimsonLacquerPbr.normalMap, crimsonLacquerPbr.roughnessMap, crimsonLacquerPbr.aoMap,
    carvedGoldPbr.map, carvedGoldPbr.normalMap, carvedGoldPbr.roughnessMap, carvedGoldPbr.aoMap,
    buuDinhPbr.map, buuDinhPbr.normalMap, buuDinhPbr.roughnessMap,
    dragonColTex.map, dragonColTex.normalMap, dragonColTex.roughnessMap, dragonColTex.metalnessMap,
    cuuLongTex.map, cuuLongTex.bumpMap,
    hoanhPhiTex.map, hoanhPhiTex.metalnessMap, hoanhPhiTex.roughnessMap,
    nhatThiTex.map, nhatThiTex.metalnessMap, nhatThiTex.roughnessMap,
    coDiemTex.map, coDiemTex.bumpMap,
    floorTex.map, floorTex.normalMap, floorTex.roughnessMap,
    vachTex.map, vachTex.normalMap,
    bambooTex.map, bambooTex.bumpMap,
    porcelainTex,
    cuaVongTex.map, cuaVongTex.normalMap, cuaVongTex.roughnessMap,
    keGocTex,
    throneScreenTex,
    starburstTex
  ];

  return {
    hoangLuuLyMat,
    thanhLuuLyMat,
    dragonColumnMat,
    cuuLongAnVanMat,
    hoanhPhiThaiHoaMat,
    interiorNhatThiMat,
    encausticFloorMat,
    vachDoBanMat,
    thanhStoneMat,
    rubbleMoatMat,
    bastionBrickMat,
    weatheredMoatBalustradeMat,
    bambooBlindMat,
    porcelainCobaltMat,
    imperialCrimsonWoodMat,
    imperialGoldLeafMat,
    brightBarrierRedMat,
    antiqueBronzeCauldronMat,
    ceramicMosaicMat,
    terracottaBalustradeMat,
    coDiemMosaicMat,
    cuaVongFiligreeMat,
    keGocFiligreeMat,
    throneScreenGoldMat,
    starburstFlareMat,
    moatReflectiveWaterMat: moatWater.material,
    moatWaterUniforms: moatWater.uniforms,
    allMaterials,
    allTextures
  };
}
