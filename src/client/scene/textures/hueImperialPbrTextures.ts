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
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
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
  renderer?: THREE.WebGLRenderer
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = rx > 1 || ry > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = rx > 1 || ry > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (rx > 1 || ry > 1) tex.repeat.set(rx, ry);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = getAniso(renderer);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 1. Hoàng Lưu Ly (Imperial Golden-Orange Glazed Tubular Roof Tiles) &
 *    Thanh Lưu Ly (Imperial Deep Emerald-Jade Glazed Tubular Roof Tiles)
 * Crisp parallel vertical cylindrical barrel ribs (`ngói ống`) + overlapping horizontal joints + specular glaze!
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

  // Authentic dense Huế tubular tiles: 14 vertical cylinders per UV tile, 8 overlapping courses down slope
  const numCols = 14;
  const numRows = 8;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * numRows;
    const rowIdx = Math.floor(rowF);
    const fv = rowF - rowIdx;
    // Overlapping tile step-down lip
    const courseLip = smoothstep(0.0, 0.14, fv);
    const courseShadow = lerp(0.56, 1.0, courseLip);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const colF = u * numCols;
      const colIdx = Math.floor(colF);
      const fu = colF - colIdx;

      // Cylindrical barrel crest: smooth dome in middle, deep shadow trough between tubes
      const arch = Math.sin(fu * Math.PI); // 0 at seams, 1 at cylinder crown
      const crest = Math.pow(arch, 0.72);
      const troughMask = smoothstep(0.03, 0.18, Math.min(fu, 1.0 - fu));

      const tileVar = hash2i(colIdx % numCols, rowIdx % numRows, seed);
      const glazeMottle = tileFbm(u, v, 10, 10, 3, seed + 37);
      const creviceMoss = (1.0 - troughMask) * smoothstep(0.55, 0.85, tileFbm(u, v, 6, 6, 2, seed + 91));

      let r: number;
      let g: number;
      let b: number;
      if (variant === 'hoang_luu_ly') {
        // Radiant Imperial Golden-Saffron Hoàng Lưu Ly (Photos 2 & 6): luminous golden-amber crest -> deep burnt-sienna trough
        const shade = (0.90 + (tileVar - 0.5) * 0.14 + (glazeMottle - 0.5) * 0.08) * courseShadow;
        r = lerp(136, 244, crest) * shade;
        g = lerp(64, 158, crest) * shade;
        b = lerp(6, 18, crest) * shade;
        r = lerp(r, 68, creviceMoss * 0.45);
        g = lerp(g, 52, creviceMoss * 0.45);
        b = lerp(b, 18, creviceMoss * 0.45);
      } else {
        // Deep Saturated Emerald-Jade Thanh Lưu Ly (Photo 2 wings): rich #146a3e crest -> deep pine-jade #062414 trough
        const shade = (0.86 + (tileVar - 0.5) * 0.16 + (glazeMottle - 0.5) * 0.10) * courseShadow;
        r = lerp(6, 20, crest) * shade;
        g = lerp(34, 108, crest) * shade;
        b = lerp(18, 62, crest) * shade;
        const blush = smoothstep(0.62, 0.90, tileVar) * crest * 0.22;
        g = lerp(g, 126, blush);
        b = lerp(b, 78, blush);
      }

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(0.14 + crest * 0.72 * courseLip + (glazeMottle - 0.5) * 0.04);
      rough[i] = clamp01(lerp(0.68, 0.18, crest * troughMask) + creviceMoss * 0.30);
      ao[i] = clamp01(lerp(0.42, 0.98, troughMask * courseLip));
    }
  }

  return buildSobelPbrSet(
    albedo,
    height,
    rough,
    ao,
    size,
    3.6,
    opts.repeatX ?? 1,
    opts.repeatY ?? 1,
    opts.renderer
  );
}

/**
 * 2. Blue-Grey Dressed Thanh Hóa Limestone Flagstones (Photo 6 Sân Đại Triều Nghi & Photo 2 Ngọ Môn Central Portals)
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

  const rows = 6;
  const cols = 3;
  const palette: Array<[number, number, number]> = [
    [146, 154, 162],
    [132, 140, 148],
    [158, 164, 170],
    [122, 130, 138],
    [150, 154, 158]
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const vv = v * rows;
      const row = Math.floor(vv);
      const fv = vv - row;
      const uu = ((u * cols + (row % 2) * 0.5) % cols + cols) % cols;
      const col = Math.floor(uu);
      const fu = uu - col;

      const eU = Math.min(fu, 1.0 - fu) * (rows / cols);
      const eV = Math.min(fv, 1.0 - fv);
      const slabMask = smoothstep(0.012, 0.048, Math.min(eU, eV));

      const bid = hash2i(col % cols, row % rows, seed);
      const grain = tileFbm(u, v, 16, 16, 3, seed + 29);
      const weather = tileFbm(u, v, 5, 5, 3, seed + 73);
      const base = palette[Math.floor(bid * palette.length) % palette.length];
      const shade = 0.90 + (bid - 0.5) * 0.14 + (grain - 0.5) * 0.10 - (weather - 0.5) * 0.10;

      // Soft weathered slate-grey mortar joints (Photo 6 calm sun-washed Thanh stone — NOT harsh black lines!)
      let r = lerp(94, base[0] * shade, slabMask);
      let g = lerp(99, base[1] * shade, slabMask);
      let b = lerp(104, base[2] * shade, slabMask);

      const lichen = (1.0 - slabMask) * smoothstep(0.55, 0.85, weather) * 0.25;
      r = lerp(r, 92, lichen);
      g = lerp(g, 98, lichen);
      b = lerp(b, 82, lichen);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.38, 0.68 + (grain - 0.5) * 0.10, slabMask));
      rough[i] = clamp01(lerp(0.90, 0.76 + (grain - 0.5) * 0.08, slabMask));
      ao[i] = clamp01(lerp(0.68, 0.96, slabMask));
    }
  }
  return buildSobelPbrSet(
    albedo,
    height,
    rough,
    ao,
    size,
    1.6,
    opts.repeatX ?? 1,
    opts.repeatY ?? 1,
    opts.renderer
  );
}

/**
 * 3. Dark Rough-Coursed Mossy Rubble/Fieldstone Embankment (Photo 2 Ngọ Môn Kim Thủy Moat Wall)
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

  const rows = 10;
  const cols = 7;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Organic warped rubble courses
      const warpU = (tileFbm(u, v, 8, 8, 2, seed + 11) - 0.5) * 0.06;
      const warpV = (tileFbm(u, v, 8, 8, 2, seed + 41) - 0.5) * 0.06;
      const vv = (((v + warpV) % 1 + 1) % 1) * rows;
      const row = Math.floor(vv);
      const fv = vv - row;
      const uu = (((u + warpU) * cols + (row % 2) * 0.45) % cols + cols) % cols;
      const col = Math.floor(uu);
      const fu = uu - col;

      const eU = Math.min(fu, 1.0 - fu) * (rows / cols);
      const eV = Math.min(fv, 1.0 - fv);
      const stoneMask = smoothstep(0.03, 0.16, Math.min(eU, eV));

      const bid = hash2i(col % cols, row % rows, seed);
      const grain = tileFbm(u, v, 20, 20, 3, seed + 79);
      const mossMacro = tileFbm(u, v, 5, 5, 2, seed + 131);

      // Photorealistic varied mossy fieldstone rubble cobbles (charcoal, olive-grey, weathered stone, ochre — NO cartoon B&W outlines!)
      const palettes: Array<[number, number, number]> = [
        [68, 70, 64],
        [98, 99, 92],
        [124, 122, 114],
        [82, 86, 74],
        [114, 104, 88]
      ];
      const baseC = palettes[Math.floor(bid * palettes.length) % palettes.length];
      const gShade = 0.85 + (grain - 0.5) * 0.30;
      let r = lerp(46, baseC[0] * gShade, stoneMask);
      let g = lerp(49, baseC[1] * gShade, stoneMask);
      let b = lerp(42, baseC[2] * gShade, stoneMask);

      const moss = (1.0 - stoneMask * 0.65) * smoothstep(0.42, 0.78, mossMacro) * 0.58;
      r = lerp(r, 48, moss);
      g = lerp(g, 64, moss);
      b = lerp(b, 36, moss);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.24, 0.74 + (grain - 0.5) * 0.18, stoneMask));
      rough[i] = clamp01(lerp(0.95, 0.82 + (grain - 0.5) * 0.10, stoneMask));
      ao[i] = clamp01(lerp(0.46, 0.96, stoneMask));
    }
  }
  return buildSobelPbrSet(
    albedo,
    height,
    rough,
    ao,
    size,
    3.4,
    opts.repeatX ?? 1,
    opts.repeatY ?? 1,
    opts.renderer
  );
}

/**
 * Helper to draw a rich ornate Nguyễn-Dynasty golden cloud scroll on a 2D canvas.
 */
function drawImperialCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  fill: string,
  stroke?: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.arc(-14, 4, 10, 0, Math.PI * 2);
  ctx.arc(14, 4, 10, 0, Math.PI * 2);
  ctx.arc(-24, 9, 6.5, 0, Math.PI * 2);
  ctx.arc(24, 9, 6.5, 0, Math.PI * 2);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 9, Math.PI * 0.2, Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-13, 4, 6, Math.PI * 0.3, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13, 4, 6, -Math.PI * 0.4, Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 4. 1024×1024 Glossy Royal Vermilion Lacquer + Coiling 24K Gold-Leaf Dragons & Auspicious Clouds
 *    (`Cột gỗ lim sơn son thếp vàng vẽ rồng mây` — Photos 1, 3, 5!)
 *    Returns `map`, `bumpMap`, `roughnessMap`, `metalnessMap` so the crimson lacquer gleams dark red
 *    while every dragon scale, spine, claw, and cloud scroll glints metallically in 24K gold!
 */
export function createHueDragonColumnPbrTextures(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
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
    const flat = finalizeDataTex(new Uint8Array([115, 16, 18, 255]), 1, true, 1, 1, 1, renderer);
    const flatLin = finalizeDataTex(new Uint8Array([80, 80, 80, 255]), 1, false, 1, 1, 1, renderer);
    return { map: flat, bumpMap: flatLin, roughnessMap: flatLin, metalnessMap: flatLin };
  }

  const c = colorC.ctx;
  const m = metalC.ctx;
  const r = roughC.ctx;
  const S = w / 1024;

  // Deep glossy blood-vermilion imperial lacquer base (#460407 -> #5f090c — rich, never pastel pink!)
  const bgGrad = c.createLinearGradient(0, 0, w, 0);
  bgGrad.addColorStop(0, '#460407');
  bgGrad.addColorStop(0.5, '#5f090c');
  bgGrad.addColorStop(1, '#460407');
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, w, h);

  // Metalness base: 0 (dielectric lacquer); Roughness base: glossy 0.22 (~56/255)
  m.fillStyle = '#080808';
  m.fillRect(0, 0, w, h);
  r.fillStyle = '#383838';
  r.fillRect(0, 0, w, h);

  // Helper drawing simultaneously to Color (gold), Metalness (bright metal), and Roughness (#484848 = 0.28 brushed gold!)
  const paintGold = (fn: (ctx: CanvasRenderingContext2D, isMask: boolean) => void) => {
    fn(c, false);
    fn(m, true);
  };

  // Top & Bottom Gilded Lotus-Petal & Key-Fret Collar Bands
  paintGold((ctx, isMask) => {
    ctx.fillStyle = isMask ? '#e8e8e8' : '#e8b93a';
    ctx.strokeStyle = isMask ? '#ffffff' : '#f7d568';
    for (const bandY of [28 * S, 968 * S]) {
      ctx.fillRect(0, bandY, w, 10 * S);
      ctx.fillRect(0, bandY + 26 * S, w, 7 * S);
      // Key-fret meander inside collar
      ctx.lineWidth = 4 * S;
      for (let kx = 0; kx < w; kx += 48 * S) {
        ctx.strokeRect(kx + 6 * S, bandY + 12 * S, 36 * S, 12 * S);
      }
    }
    // Lotus petals below top collar & above bottom collar
    for (let px = 0; px < w; px += 64 * S) {
      ctx.beginPath();
      ctx.moveTo(px + 6 * S, 64 * S);
      ctx.quadraticCurveTo(px + 32 * S, 118 * S, px + 58 * S, 64 * S);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(px + 6 * S, 964 * S);
      ctx.quadraticCurveTo(px + 32 * S, 902 * S, px + 58 * S, 964 * S);
      ctx.fill();
    }
  });

  // Three Intertwined Ascending Sinuous Imperial Dragons wrapping seamlessly (~55% gold leaf coverage matching Photos 1, 3, 5!)
  for (let dIdx = 0; dIdx < 3; dIdx++) {
    const phaseX = dIdx * 341;
    const numSegs = 68;
    const pts: Array<[number, number, number]> = [];
    for (let s = 0; s <= numSegs; s++) {
      const t = s / numSegs; // 0 = bottom tail, 1 = upper head
      const py = lerp(910, 110, t);
      const px = (phaseX + t * 980 + Math.sin(t * Math.PI * 4.2 + dIdx * 1.1) * 125) % 1024;
      const rad = (13 + Math.sin(t * Math.PI) * 30 + (t > 0.85 ? 9 : 0)) * S;
      pts.push([px * S, py * S, rad]);
    }

    // Draw scales, dorsal spines, flames, claws, and dragon head wrapped across seam
    for (const wrapOff of [-w, 0, w]) {
      paintGold((ctx, isMask) => {
        // Sinuous golden spine body with individual overlapping crescent scales!
        for (let s = 0; s < pts.length - 1; s++) {
          const [x0, y0, r0] = pts[s];
          const [x1, y1] = pts[s + 1];
          if (Math.abs(x1 - x0) > w * 0.4) continue;
          const bx = x0 + wrapOff;
          if (bx < -80 * S || bx > w + 80 * S) continue;

          // Warm antique gold body + darker bronze outline for 3D embossed depth
          ctx.fillStyle = isMask ? '#dcdcdc' : (s % 2 === 0 ? '#e6b432' : '#d29c20');
          ctx.beginPath();
          ctx.arc(bx, y0, r0, 0, Math.PI * 2);
          ctx.fill();

          if (!isMask) {
            ctx.strokeStyle = '#6f3e08';
            ctx.lineWidth = 2.0 * S;
            ctx.beginPath();
            ctx.arc(bx, y0, r0 * 0.78, 0.2, Math.PI * 1.15);
            ctx.stroke();

            // Bright gold highlight scales
            ctx.fillStyle = '#fae07a';
            ctx.beginPath();
            ctx.arc(bx - r0 * 0.25, y0 - r0 * 0.25, r0 * 0.34, 0, Math.PI * 2);
            ctx.fill();
          }

          // Sawtooth golden dorsal fin flames every 2nd segment
          if (s % 2 === 0) {
            ctx.fillStyle = isMask ? '#f5f5f5' : '#f4cf58';
            ctx.beginPath();
            ctx.moveTo(bx + r0 * 0.8, y0 - r0 * 0.4);
            ctx.lineTo(bx + r0 * 1.75, y0 - r0 * 0.95);
            ctx.lineTo(bx + r0 * 0.95, y0 + r0 * 0.35);
            ctx.closePath();
            ctx.fill();
          }

          // 5-clawed golden limbs at s = 18 & s = 44
          if (s === 18 || s === 44) {
            const side = s === 18 ? 1 : -1;
            ctx.strokeStyle = isMask ? '#f0f0f0' : '#f2c84b';
            ctx.lineWidth = 7 * S;
            ctx.beginPath();
            ctx.moveTo(bx, y0);
            ctx.quadraticCurveTo(bx + side * 46 * S, y0 - 14 * S, bx + side * 66 * S, y0 + 20 * S);
            ctx.stroke();
            ctx.lineWidth = 3.5 * S;
            for (let cl = -2; cl <= 2; cl++) {
              ctx.beginPath();
              ctx.moveTo(bx + side * 64 * S, y0 + 18 * S);
              ctx.lineTo(bx + side * (82 + Math.abs(cl) * 3) * S, y0 + (12 + cl * 8) * S);
              ctx.stroke();
            }
          }
        }

        // Fierce Dragon Head at top of coil (last point)
        const [hxRaw, hy, hr] = pts[pts.length - 1];
        const hx = hxRaw + wrapOff;
        if (hx > -120 * S && hx < w + 120 * S) {
          ctx.fillStyle = isMask ? '#ffffff' : '#f2c646';
          ctx.beginPath();
          ctx.ellipse(hx, hy, hr * 1.9, hr * 1.45, -0.25, 0, Math.PI * 2);
          ctx.fill();
          // Sweeping antlers & whiskers
          ctx.strokeStyle = isMask ? '#ffffff' : '#fae07c';
          ctx.lineWidth = 5 * S;
          ctx.beginPath();
          ctx.moveTo(hx - 12 * S, hy - 22 * S);
          ctx.quadraticCurveTo(hx - 48 * S, hy - 68 * S, hx - 18 * S, hy - 86 * S);
          ctx.moveTo(hx + 16 * S, hy - 22 * S);
          ctx.quadraticCurveTo(hx + 54 * S, hy - 64 * S, hx + 28 * S, hy - 84 * S);
          ctx.stroke();
          // Fiery pearl near dragon snout
          ctx.fillStyle = isMask ? '#ffffff' : '#ffea8a';
          ctx.beginPath();
          ctx.arc(hx + 72 * S, hy - 18 * S, 18 * S, 0, Math.PI * 2);
          ctx.fill();
          if (!isMask) {
            ctx.fillStyle = '#3a0608';
            ctx.beginPath();
            ctx.arc(hx - 14 * S, hy - 6 * S, 6 * S, 0, Math.PI * 2);
            ctx.arc(hx + 14 * S, hy - 6 * S, 6 * S, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }
  }

  // Dense Swirling Auspicious Golden Clouds (`Mây Ngũ Sắc / Long Vân`) filling space around dragons
  for (let i = 0; i < 56; i++) {
    const cxPos = hash2i(i, 1, 7711) * w;
    const cyPos = (95 + hash2i(i, 2, 7711) * 810) * S;
    const sc = (1.15 + hash2i(i, 3, 7711) * 1.25) * S;
    for (const wrapOff of [-w, 0, w]) {
      const px = cxPos + wrapOff;
      if (px < -70 * S || px > w + 70 * S) continue;
      paintGold((ctx, isMask) => {
        drawImperialCloud(
          ctx,
          px,
          cyPos,
          sc,
          isMask ? '#c8c8c8' : '#e0aa2c',
          isMask ? '#f0f0f0' : '#fae078'
        );
      });
    }
  }

  // Build true physical roughness map from metalness mask: glossy crimson lacquer = 0.24 (#3d3d3d), brushed 24K gold leaf = 0.28 (#484848)!
  r.fillStyle = '#3d3d3d';
  r.fillRect(0, 0, w, h);
  r.globalAlpha = 0.25;
  r.drawImage(metalC.canvas, 0, 0);
  r.globalAlpha = 1.0;
  const map = wrapCanvasTex(colorC.canvas, true, 1, 1, renderer);
  const metalnessMap = wrapCanvasTex(metalC.canvas, false, 1, 1, renderer);
  const bumpMap = metalnessMap; // Gold relief height matches gold mask cleanly -> zero extra texture upload!
  const roughnessMap = wrapCanvasTex(roughC.canvas, false, 1, 1, renderer);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  metalnessMap.wrapS = THREE.RepeatWrapping;
  metalnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap, roughnessMap, metalnessMap };
}

/**
 * 5. 1024×1024 Polychrome `Cửu Long Ẩn Vân` (Nine Dragons Hidden in Clouds) Bửu Tán Ceiling Painting
 *    Exact visual replica of Reference Photo 4!
 */
export function createHueCuuLongAnVanTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 1024;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([226, 168, 22, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = sz / 1024;

  // 1. Outer ornate gilded carved frame border
  const frameGrad = ctx.createLinearGradient(0, 0, sz, sz);
  frameGrad.addColorStop(0, '#c48d1b');
  frameGrad.addColorStop(0.5, '#f6d25a');
  frameGrad.addColorStop(1, '#a67212');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, sz, sz);

  // Outer crimson-and-gold field
  const mOuter = 36 * S;
  ctx.fillStyle = '#8b1014';
  ctx.fillRect(mOuter, mOuter, sz - mOuter * 2, sz - mOuter * 2);

  // 2. Four corner diagonal red-on-gold `Chữ Vạn` (key-fret) squares + circular blue/red `Chữ Thọ` medallions
  const cornerW = 192 * S;
  const corners: Array<[number, number]> = [
    [mOuter, mOuter],
    [sz - mOuter - cornerW, mOuter],
    [mOuter, sz - mOuter - cornerW],
    [sz - mOuter - cornerW, sz - mOuter - cornerW]
  ];
  for (const [cx0, cy0] of corners) {
    ctx.fillStyle = '#d98e1a';
    ctx.fillRect(cx0, cy0, cornerW, cornerW);
    // Diagonal red key-fret hatch lattice
    ctx.strokeStyle = '#8f1215';
    ctx.lineWidth = 7 * S;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx0 + 4 * S, cy0 + 4 * S, cornerW - 8 * S, cornerW - 8 * S);
    ctx.clip();
    for (let d = -cornerW; d < cornerW * 2; d += 26 * S) {
      ctx.beginPath();
      ctx.moveTo(cx0 + d, cy0);
      ctx.lineTo(cx0 + d - cornerW, cy0 + cornerW);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx0 + d, cy0);
      ctx.lineTo(cx0 + d + cornerW, cy0 + cornerW);
      ctx.stroke();
    }
    ctx.restore();
    // Circular blue-and-red Chữ Thọ medallion centered in corner
    const mx = cx0 + cornerW * 0.5;
    const my = cy0 + cornerW * 0.5;
    ctx.fillStyle = '#4e7ca8';
    ctx.beginPath();
    ctx.arc(mx, my, 46 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2d98c';
    ctx.lineWidth = 4 * S;
    ctx.stroke();
    ctx.strokeStyle = '#b41b22';
    ctx.lineWidth = 5 * S;
    ctx.beginPath();
    ctx.arc(mx, my, 32 * S, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 24 * S, my);
    ctx.lineTo(mx + 24 * S, my);
    ctx.moveTo(mx, my - 24 * S);
    ctx.lineTo(mx, my + 24 * S);
    ctx.strokeRect(mx - 14 * S, my - 14 * S, 28 * S, 28 * S);
    ctx.stroke();
  }

  // Helper to paint an authentic tapered sinuous Nguyễn-Dynasty polychrome dragon with spiked crests, horned head & 5-color clouds
  const drawPolychromeDragon = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    amp: number,
    scale: number,
    seed: number
  ) => {
    const cloudColors = ['#1f559c', '#187246', '#b81c20', '#efe3be'];
    const steps = 32;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wv = Math.sin(t * Math.PI * 2.6 + seed) * amp;
      const px = x0 + dx * t + nx * wv;
      const py = y0 + dy * t + ny * wv;
      // Taper cleanly from pointed tail (t=0) -> muscular mid-torso -> sleek neck -> fierce head (t=0.82)
      const rad = (2.5 + Math.sin(Math.pow(t, 0.78) * Math.PI) * 14.5) * scale;
      pts.push([px, py, rad]);
    }
    // Multicolor auspicious cloud swirls behind dragon
    for (let i = 3; i < steps - 2; i += 6) {
      const [px, py] = pts[i];
      const side = (i + seed) % 2 === 0 ? 1 : -1;
      drawImperialCloud(
        ctx,
        px + nx * side * 22 * scale,
        py + ny * side * 22 * scale,
        0.72 * scale,
        cloudColors[(i + seed) % cloudColors.length],
        '#f4e9c6'
      );
    }
    // Continuous tapered sinuous dragon spine + dorsal flame spikes + overlapping crescent scales
    for (let i = 0; i < steps; i++) {
      const [px, py, rad] = pts[i];
      if (i % 2 === 0 && i > 2 && i < steps - 2) {
        ctx.fillStyle = '#fae078';
        ctx.beginPath();
        ctx.moveTo(px + nx * rad * 0.7, py + ny * rad * 0.7);
        ctx.lineTo(px + nx * (rad * 2.05) - tx * 5 * scale, py + ny * (rad * 2.05) - ty * 5 * scale);
        ctx.lineTo(px + nx * rad * 0.5 + tx * 6 * scale, py + ny * rad * 0.5 + ty * 6 * scale);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = i % 2 === 0 ? '#bd7c16' : '#d69c24';
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#603206';
      ctx.lineWidth = 1.6 * scale;
      ctx.beginPath();
      ctx.arc(px, py, rad * 0.82, 0.2, Math.PI * 1.15);
      ctx.stroke();
    }
    // Sculpted fierce horned dragon head + crimson jaw + flowing whiskers at mid-arch
    const [hx, hy] = pts[Math.floor(steps * 0.52)];
    ctx.fillStyle = '#d4951a';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 18 * scale, 13 * scale, Math.atan2(dy, dx), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a2b04';
    ctx.lineWidth = 2.0 * scale;
    ctx.stroke();
    ctx.fillStyle = '#c41e24';
    ctx.beginPath();
    ctx.ellipse(hx + tx * 8 * scale, hy + ty * 8 * scale, 9 * scale, 6 * scale, Math.atan2(dy, dx), 0, Math.PI * 2);
    ctx.fill();
    // Antlers & sweeping whiskers
    ctx.strokeStyle = '#f6e4b4';
    ctx.lineWidth = 2.8 * scale;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - tx * 22 * scale + nx * 16 * scale, hy - ty * 22 * scale + ny * 16 * scale);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - tx * 22 * scale - nx * 16 * scale, hy - ty * 22 * scale - ny * 16 * scale);
    ctx.stroke();
  };

  // 3. Four Outer Crimson Cartouches (Top, Bottom, Left, Right) — 4 Outer Dragons!
  const drawCartouche = (rx: number, ry: number, rw: number, rh: number, horiz: boolean, seed: number) => {
    ctx.fillStyle = '#8b0e14';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#247244';
    ctx.lineWidth = 8 * S;
    ctx.strokeRect(rx + 4 * S, ry + 4 * S, rw - 8 * S, rh - 8 * S);
    if (horiz) {
      drawPolychromeDragon(rx + 44 * S, ry + rh * 0.5, rx + rw - 44 * S, ry + rh * 0.5, 28 * S, 1.05 * S, seed);
    } else {
      drawPolychromeDragon(rx + rw * 0.5, ry + 44 * S, rx + rw * 0.5, ry + rh - 44 * S, 28 * S, 1.05 * S, seed);
    }
  };
  const cartSpan = sz - (mOuter + cornerW) * 2;
  drawCartouche(mOuter + cornerW, mOuter, cartSpan, cornerW, true, 1);
  drawCartouche(mOuter + cornerW, sz - mOuter - cornerW, cartSpan, cornerW, true, 2);
  drawCartouche(mOuter, mOuter + cornerW, cornerW, cartSpan, false, 3);
  drawCartouche(sz - mOuter - cornerW, mOuter + cornerW, cornerW, cartSpan, false, 4);

  // 4. Central Deep Rich Imperial Saffron-Gold Field (`Nền Hoàng Bào Vàng Sậm` — ZERO pale white blowout! Photo 4!)
  const innerM = mOuter + cornerW;
  const innerW = sz - innerM * 2;
  const yelGrad = ctx.createRadialGradient(sz * 0.5, sz * 0.5, 36 * S, sz * 0.5, sz * 0.5, innerW * 0.72);
  yelGrad.addColorStop(0, '#df9e14');
  yelGrad.addColorStop(0.68, '#cc890c');
  yelGrad.addColorStop(1, '#b57308');
  ctx.fillStyle = yelGrad;
  ctx.fillRect(innerM, innerM, innerW, innerW);

  // Emerald-green pearl-dotted inner frame border
  ctx.strokeStyle = '#1b6d40';
  ctx.lineWidth = 14 * S;
  ctx.strokeRect(innerM + 7 * S, innerM + 7 * S, innerW - 14 * S, innerW - 14 * S);
  ctx.fillStyle = '#f6ecc4';
  for (let d = innerM + 20 * S; d <= sz - innerM - 20 * S; d += 22 * S) {
    for (const [px, py] of [
      [d, innerM + 7 * S],
      [d, sz - innerM - 7 * S],
      [innerM + 7 * S, d],
      [sz - innerM - 7 * S, d]
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, 3.5 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4 Corner Twisting Dragons inside the yellow field (Dragons #5-#8)
  const qOff = 68 * S;
  drawPolychromeDragon(innerM + qOff, innerM + qOff, innerM + qOff + 118 * S, innerM + qOff + 96 * S, 24 * S, 0.92 * S, 5);
  drawPolychromeDragon(sz - innerM - qOff, innerM + qOff, sz - innerM - qOff - 118 * S, innerM + qOff + 96 * S, 24 * S, 0.92 * S, 6);
  drawPolychromeDragon(innerM + qOff, sz - innerM - qOff, innerM + qOff + 118 * S, sz - innerM - qOff - 96 * S, 24 * S, 0.92 * S, 7);
  drawPolychromeDragon(sz - innerM - qOff, sz - innerM - qOff, sz - innerM - qOff - 118 * S, sz - innerM - qOff - 96 * S, 24 * S, 0.92 * S, 8);

  // 5. Grand Center Front-Facing Imperial Dragon (`Chính Long` — Dragon #9, authentic fierce Nguyễn Dynasty artistry matching Photo 4!)
  const mid = sz * 0.5;
  // Swirling polychrome 5-color auspicious clouds haloing the central dragon
  const haloClouds: Array<[number, number, string, number]> = [
    [-118, -112, '#1f559c', 1.48],
    [120, -104, '#187246', 1.48],
    [-148, 22, '#b81c20', 1.55],
    [148, 32, '#1f559c', 1.55],
    [-92, 134, '#187246', 1.50],
    [94, 128, '#b81c20', 1.50],
    [0, -168, '#2d68b2', 1.65],
    [0, 168, '#2d68b2', 1.55]
  ];
  for (const [ox, oy, col, sc] of haloClouds) {
    drawImperialCloud(ctx, mid + ox * S, mid + oy * S, sc * S, col, '#f4ebd0');
  }

  // Coiling golden scaled body behind central dragon head with spiky dorsal flames
  for (let a = 0; a < 96; a++) {
    const t = (a / 96) * Math.PI * 2;
    const rx = Math.sin(t) * 144 * S + Math.sin(t * 2) * 34 * S;
    const ry = Math.cos(t) * 116 * S;
    const segR = (20 + Math.sin(t * 3) * 6) * S;
    if (a % 3 === 0) {
      const ang = Math.atan2(ry, rx);
      ctx.fillStyle = '#fae078';
      ctx.beginPath();
      ctx.moveTo(mid + rx, mid + ry);
      ctx.lineTo(mid + rx + Math.cos(ang) * (segR + 24 * S), mid + ry + Math.sin(ang) * (segR + 24 * S));
      ctx.lineTo(mid + rx + Math.cos(ang + 0.3) * segR, mid + ry + Math.sin(ang + 0.3) * segR);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = a % 2 === 0 ? '#9c5e0e' : '#c48618';
    ctx.beginPath();
    ctx.arc(mid + rx, mid + ry, segR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#522904';
    ctx.lineWidth = 2.2 * S;
    ctx.stroke();
    ctx.fillStyle = '#f5d25c';
    ctx.beginPath();
    ctx.arc(mid + rx - segR * 0.22, mid + ry - segR * 0.22, segR * 0.30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radiating polychrome flame mane halo framing the fierce dragon head
  for (let m = 0; m < 16; m++) {
    const ang = (m / 16) * Math.PI * 2;
    ctx.fillStyle = m % 3 === 0 ? '#1f559c' : m % 3 === 1 ? '#187246' : '#c02026';
    ctx.beginPath();
    ctx.moveTo(mid + Math.cos(ang) * 52 * S, mid + Math.sin(ang) * 52 * S);
    ctx.quadraticCurveTo(
      mid + Math.cos(ang + 0.18) * 96 * S,
      mid + Math.sin(ang + 0.18) * 96 * S,
      mid + Math.cos(ang + 0.04) * 114 * S,
      mid + Math.sin(ang + 0.04) * 114 * S
    );
    ctx.lineTo(mid + Math.cos(ang - 0.16) * 56 * S, mid + Math.sin(ang - 0.16) * 56 * S);
    ctx.closePath();
    ctx.fill();
  }

  // Sculpted Ornate Nguyễn-Dynasty Front-Facing Imperial Dragon Head (`Chính Long` — rich layered cloud-scales, curling golden snout, fierce dragon eyes, flowing beard & 5-clawed limbs matching Photo 4!)
  // 2 Front 5-clawed golden dragon forelimbs emerging left & right of the head clutching auspicious clouds
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#d89618';
    ctx.lineWidth = 14 * S;
    ctx.beginPath();
    ctx.moveTo(mid + side * 46 * S, mid + 28 * S);
    ctx.quadraticCurveTo(mid + side * 98 * S, mid + 44 * S, mid + side * 116 * S, mid + 14 * S);
    ctx.stroke();
    ctx.strokeStyle = '#fae078';
    ctx.lineWidth = 4.5 * S;
    for (let cl = -2; cl <= 2; cl++) {
      ctx.beginPath();
      ctx.moveTo(mid + side * 116 * S, mid + 14 * S);
      ctx.lineTo(mid + side * (134 + Math.abs(cl) * 3) * S, mid + (6 + cl * 9) * S);
      ctx.stroke();
    }
    drawImperialCloud(ctx, mid + side * 118 * S, mid + 48 * S, 0.95 * S, side < 0 ? '#1f559c' : '#187246', '#f4ebd0');
  }

  // Multi-layered polychrome cloud-flame beard & mane radiating around dragon face (blue, emerald, vermilion, cream)
  const maneColors = ['#1f559c', '#187246', '#c41e24', '#f2e4bc'];
  for (let ring = 2; ring >= 0; ring--) {
    const baseR = (54 + ring * 20) * S;
    const petals = 18 + ring * 4;
    for (let m = 0; m < petals; m++) {
      const ang = (m / petals) * Math.PI * 2 + ring * 0.2;
      const col = maneColors[(m + ring) % maneColors.length];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(
        mid + Math.cos(ang) * baseR,
        mid + Math.sin(ang) * baseR * 0.92,
        18 * S,
        10 * S,
        ang,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.strokeStyle = '#f6e8c0';
      ctx.lineWidth = 1.8 * S;
      ctx.stroke();
    }
  }

  // Tiered golden-scaled cranium, cheekbones & cloud-scroll jowls
  for (const [ox, oy, rx, ry, col] of [
    [0, -6, 62, 54, '#b8740e'],
    [-34, 8, 28, 24, '#d49218'],
    [34, 8, 28, 24, '#d49218'],
    [0, -28, 44, 28, '#e2a824'],
    [0, 26, 42, 22, '#9e161a']
  ] as Array<[number, number, number, number, string]>) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(mid + ox * S, mid + oy * S, rx * S, ry * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a2804';
    ctx.lineWidth = 3 * S;
    ctx.stroke();
  }

  // Overlapping golden cranium scales on forehead
  for (let row = -2; row <= 0; row++) {
    for (let col = -2; col <= 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f6cf54' : '#d99a1c';
      ctx.beginPath();
      ctx.arc(mid + col * 13 * S, mid + (-34 + row * 10) * S, 8.5 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#683206';
      ctx.lineWidth = 1.6 * S;
      ctx.stroke();
    }
  }

  // Sculpted double-scroll golden nose bridge (`mũi rồng chạm vân mây`) & flaring crimson nostrils
  ctx.fillStyle = '#f2be34';
  ctx.beginPath();
  ctx.ellipse(mid, mid + 8 * S, 24 * S, 17 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c2804';
  ctx.lineWidth = 3 * S;
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#7a0c10';
    ctx.beginPath();
    ctx.arc(mid + side * 11 * S, mid + 12 * S, 6.5 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fae07c';
    ctx.lineWidth = 2.5 * S;
    ctx.stroke();
  }

  // Ornate upper lip scroll & curved white-ivory corner fangs + glowing flaming pearl in mouth
  ctx.strokeStyle = '#fae078';
  ctx.lineWidth = 4.5 * S;
  ctx.beginPath();
  ctx.moveTo(mid - 38 * S, mid + 24 * S);
  ctx.quadraticCurveTo(mid, mid + 14 * S, mid + 38 * S, mid + 24 * S);
  ctx.stroke();
  ctx.fillStyle = '#ffea88';
  ctx.beginPath();
  ctx.arc(mid, mid + 30 * S, 11 * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c41e24';
  ctx.lineWidth = 2.5 * S;
  ctx.stroke();

  // Fierce multi-ringed imperial dragon eyes, swirling cloud-flame eyebrows, branching antlers & flowing whiskers
  for (const side of [-1, 1]) {
    // Cloud-scroll golden eyebrow crest
    drawImperialCloud(ctx, mid + side * 30 * S, mid - 24 * S, 0.72 * S, '#f4c438', '#fff2a6');
    // Outer crimson eye socket + golden iris + blazing dark pupil + white glint
    ctx.fillStyle = '#b4161b';
    ctx.beginPath();
    ctx.ellipse(mid + side * 26 * S, mid - 8 * S, 14 * S, 10 * S, -side * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe898';
    ctx.beginPath();
    ctx.arc(mid + side * 26 * S, mid - 8 * S, 8.5 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120a06';
    ctx.beginPath();
    ctx.arc(mid + side * 26 * S, mid - 8 * S, 5.0 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mid + side * 24 * S, mid - 10 * S, 2.2 * S, 0, Math.PI * 2);
    ctx.fill();
    // Sweeping branching antlers
    ctx.strokeStyle = '#f2e0ba';
    ctx.lineWidth = 6.5 * S;
    ctx.beginPath();
    ctx.moveTo(mid + side * 22 * S, mid - 44 * S);
    ctx.quadraticCurveTo(mid + side * 84 * S, mid - 104 * S, mid + side * 126 * S, mid - 66 * S);
    ctx.moveTo(mid + side * 62 * S, mid - 78 * S);
    ctx.lineTo(mid + side * 78 * S, mid - 118 * S);
    ctx.stroke();
    // Flowing S-curved crimson & gold whiskers
    ctx.strokeStyle = '#c82024';
    ctx.lineWidth = 5 * S;
    ctx.beginPath();
    ctx.moveTo(mid + side * 34 * S, mid + 20 * S);
    ctx.bezierCurveTo(
      mid + side * 86 * S,
      mid + 4 * S,
      mid + side * 112 * S,
      mid + 64 * S,
      mid + side * 154 * S,
      mid + 38 * S
    );
    ctx.stroke();
  }

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 6. 1024×640 Grand Interior `"殿和太"` (Thái Hòa Điện) Hoành Phi Plaque Texture (Photos 1 & 3!)
 */
export function createHueHoanhPhiThaiHoaTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 256 : 1024;
  const h = headless ? 160 : 640;
  const cObj = makeCanvas(w, h);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([112, 16, 18, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = w / 1024;

  // Ornate gilded outer carved dragon-scrollwork border
  const borderGrad = ctx.createLinearGradient(0, 0, w, h);
  borderGrad.addColorStop(0, '#c89220');
  borderGrad.addColorStop(0.5, '#fae076');
  borderGrad.addColorStop(1, '#a87412');
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, 0, w, h);

  // Embossed scroll/dragon border relief pattern around perimeter
  ctx.strokeStyle = '#6e4208';
  ctx.lineWidth = 4 * S;
  for (let bx = 24 * S; bx < w - 24 * S; bx += 42 * S) {
    ctx.beginPath();
    ctx.arc(bx, 34 * S, 16 * S, 0, Math.PI * 2);
    ctx.arc(bx, h - 34 * S, 16 * S, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let by = 68 * S; by < h - 68 * S; by += 42 * S) {
    ctx.beginPath();
    ctx.arc(34 * S, by, 16 * S, 0, Math.PI * 2);
    ctx.arc(w - 34 * S, by, 16 * S, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Deep glossy vermilion lacquer field (#6d0e10)
  const pad = 74 * S;
  const fieldGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40 * S, w * 0.5, h * 0.5, w * 0.55);
  fieldGrad.addColorStop(0, '#821416');
  fieldGrad.addColorStop(1, '#580a0c');
  ctx.fillStyle = fieldGrad;
  ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);

  // Inner gilded key-fret frame border
  ctx.strokeStyle = '#f2ca52';
  ctx.lineWidth = 7 * S;
  ctx.strokeRect(pad + 12 * S, pad + 12 * S, w - (pad + 12 * S) * 2, h - (pad + 12 * S) * 2);
  ctx.lineWidth = 2.5 * S;
  ctx.strokeRect(pad + 26 * S, pad + 26 * S, w - (pad + 26 * S) * 2, h - (pad + 26 * S) * 2);

  // Bold sculpted golden right-to-left calligraphic characters "殿 和 太" (Photo 1 & Photo 3 exact order!)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(238 * S)}px "KaiTi", "STKaiti", "PMingLiU", "SimSun", Georgia, serif`;

  const chars = ['殿', '和', '太'];
  const xs = [w * 0.26, w * 0.50, w * 0.74];
  for (let i = 0; i < 3; i++) {
    // Deep relief shadow
    ctx.fillStyle = '#330606';
    ctx.fillText(chars[i], xs[i] + 6 * S, h * 0.52 + 8 * S);
    // Raised 24K gold-leaf body
    const gTxt = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.75);
    gTxt.addColorStop(0, '#fff0a4');
    gTxt.addColorStop(0.45, '#f0c240');
    gTxt.addColorStop(1, '#c48a18');
    ctx.fillStyle = gTxt;
    ctx.fillText(chars[i], xs[i], h * 0.52);
    ctx.strokeStyle = '#fff3b8';
    ctx.lineWidth = 2.2 * S;
    ctx.strokeText(chars[i], xs[i], h * 0.52);
  }

  // Authentic vertical golden reign inscriptions on right & left margins (Photo 1)
  ctx.font = `bold ${Math.round(22 * S)}px "SimSun", serif`;
  ctx.fillStyle = '#e8bf4c';
  const rightCols = ['明', '命', '十', '四', '年', '歲', '次', '癸', '巳', '吉', '日'];
  const leftCols = ['御', '製', '恭', '懸', '太', '和', '正', '殿'];
  for (let r = 0; r < rightCols.length; r++) {
    ctx.fillText(rightCols[r], w - pad - 48 * S, pad + 64 * S + r * 36 * S);
  }
  for (let l = 0; l < leftCols.length; l++) {
    ctx.fillText(leftCols[l], pad + 48 * S, pad + 88 * S + l * 40 * S);
  }

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 7. 1024×512 2-Tier Interior `Nhất Thi Nhất Họa` Frieze (Photos 1, 3, 5!)
 *    Upper narrow strip + lower alternating gold-on-vermilion vertical Han poetry squares & ornate carved golden oval relief medallions!
 */
export function createHueInteriorNhatThiTexture(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 256 : 1024;
  const h = headless ? 128 : 512;
  const cObj = makeCanvas(w, h);
  const bObj = makeCanvas(w, h);
  if (!cObj || !bObj) {
    const flat = finalizeDataTex(new Uint8Array([108, 16, 18, 255]), 1, true, 1, 1, 1, renderer);
    return { map: flat, bumpMap: flat };
  }
  const c = cObj.ctx;
  const b = bObj.ctx;
  const S = w / 1024;

  // Deep vermilion lacquer background
  c.fillStyle = '#680c0f';
  c.fillRect(0, 0, w, h);
  b.fillStyle = '#303030';
  b.fillRect(0, 0, w, h);

  // Horizontal gilded cornice divider beams separating upper & lower frieze registers
  const paintBar = (y0: number, bh: number) => {
    c.fillStyle = '#d9a42a';
    c.fillRect(0, y0, w, bh);
    b.fillStyle = '#dcdcdc';
    b.fillRect(0, y0, w, bh);
  };
  paintBar(6 * S, 12 * S);
  paintBar(148 * S, 16 * S);
  paintBar(492 * S, 14 * S);

  // UPPER REGISTER (y = 24..142): Alternating small Han inscription squares & horizontal golden oval floral reliefs
  const upperSlots = 6;
  const uW = w / upperSlots;
  for (let i = 0; i < upperSlots; i++) {
    const x0 = i * uW + 10 * S;
    const cw = uW - 20 * S;
    const isOval = i % 2 === 1;
    c.strokeStyle = '#e8bd42';
    c.lineWidth = 4 * S;
    c.strokeRect(x0, 26 * S, cw, 114 * S);
    b.strokeStyle = '#e0e0e0';
    b.lineWidth = 4 * S;
    b.strokeRect(x0, 26 * S, cw, 114 * S);

    if (isOval) {
      // Ornate golden carved oval relief cartouche
      c.fillStyle = '#e5b334';
      b.fillStyle = '#ffffff';
      for (const ctx of [c, b]) {
        ctx.beginPath();
        ctx.ellipse(x0 + cw * 0.5, 83 * S, cw * 0.36, 38 * S, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      c.strokeStyle = '#753e0a';
      c.lineWidth = 3 * S;
      c.beginPath();
      c.ellipse(x0 + cw * 0.5, 83 * S, cw * 0.24, 24 * S, 0, 0, Math.PI * 2);
      ctxDrawFloralDots(c, x0 + cw * 0.5, 83 * S, 24 * S);
      c.stroke();
    } else {
      c.fillStyle = '#f2cf62';
      c.font = `bold ${Math.round(20 * S)}px "SimSun", serif`;
      c.textAlign = 'center';
      const lines = ['大南', '皇朝', '萬壽'];
      for (let l = 0; l < 3; l++) {
        c.fillText(lines[l], x0 + cw * (0.28 + l * 0.22), 78 * S);
        c.fillText('無疆', x0 + cw * (0.28 + l * 0.22), 112 * S);
      }
    }
  }

  // LOWER MAIN REGISTER (y = 172..484): Exact Photo 3 rhythm — [Poem | Golden Oval Relief | Poem | Golden Oval Relief | Poem]
  const poemGlyphs = [
    ['天', '命', '維', '新', '國', '運', '昌'],
    ['山', '河', '萬', '里', '沐', '恩', '光'],
    ['文', '明', '禮', '樂', '昭', '千', '古'],
    ['太', '和', '瑞', '氣', '滿', '明', '堂']
  ];
  const lowerPanels = [
    { x: 14, w: 170, type: 'poem' },
    { x: 196, w: 222, type: 'oval' },
    { x: 430, w: 164, type: 'poem' },
    { x: 606, w: 222, type: 'oval' },
    { x: 840, w: 170, type: 'poem' }
  ];

  for (let p = 0; p < lowerPanels.length; p++) {
    const pan = lowerPanels[p];
    const px = pan.x * S;
    const pw = pan.w * S;
    const py = 178 * S;
    const ph = 300 * S;

    // Deep crimson inner recess + crisp double gilded frame
    c.fillStyle = '#5c090c';
    c.fillRect(px, py, pw, ph);
    for (const ctx of [c, b]) {
      ctx.strokeStyle = ctx === c ? '#f0c444' : '#f2f2f2';
      ctx.lineWidth = 6 * S;
      ctx.strokeRect(px, py, pw, ph);
      ctx.lineWidth = 2.5 * S;
      ctx.strokeRect(px + 12 * S, py + 12 * S, pw - 24 * S, ph - 24 * S);
    }

    if (pan.type === 'poem') {
      c.fillStyle = '#f6d66c';
      b.fillStyle = '#dedede';
      const fontSz = Math.round(25 * S);
      c.font = `bold ${fontSz}px "KaiTi", "SimSun", serif`;
      b.font = `bold ${fontSz}px "KaiTi", "SimSun", serif`;
      c.textAlign = 'center';
      b.textAlign = 'center';
      for (let col = 0; col < 4; col++) {
        const gx = px + pw - (30 + col * 36) * S;
        const glyphs = poemGlyphs[(col + p) % poemGlyphs.length];
        for (let row = 0; row < 7; row++) {
          const gy = py + (48 + row * 34) * S;
          c.fillText(glyphs[row], gx, gy);
          b.fillText(glyphs[row], gx, gy);
        }
      }
    } else {
      // Ornate carved golden oval bas-relief medallion (dragon/lotus/clouds) + 4 gilded corner spandrel scrolls!
      const cx = px + pw * 0.5;
      const cy = py + ph * 0.5;
      for (const ctx of [c, b]) {
        const isC = ctx === c;
        // 4 corner golden floral spandrels
        ctx.fillStyle = isC ? '#dfa92c' : '#d0d0d0';
        for (const [sx, sy] of [
          [px + 22 * S, py + 22 * S],
          [px + pw - 22 * S, py + 22 * S],
          [px + 22 * S, py + ph - 22 * S],
          [px + pw - 22 * S, py + ph - 22 * S]
        ]) {
          ctx.beginPath();
          ctx.arc(sx, sy, 14 * S, 0, Math.PI * 2);
          ctx.fill();
        }
        // Rich gilded oval medallion ring & dense sculpted floral/dragon scroll filigree
        ctx.fillStyle = isC ? '#eec03e' : '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx, cy, pw * 0.39, ph * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isC ? '#7c4308' : '#707070';
        ctx.lineWidth = 4 * S;
        ctx.stroke();

        // Carved interior filigree rings & lotus petals
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          ctx.fillStyle = isC ? '#fce282' : '#f0f0f0';
          ctx.beginPath();
          ctx.ellipse(
            cx + Math.cos(ang) * pw * 0.22,
            cy + Math.sin(ang) * ph * 0.21,
            18 * S,
            10 * S,
            ang,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = isC ? '#b57414' : '#b8b8b8';
        ctx.beginPath();
        ctx.arc(cx, cy, 24 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isC ? '#fff0a4' : '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 12 * S, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return {
    map: wrapCanvasTex(cObj.canvas, true, 1, 1, renderer),
    bumpMap: wrapCanvasTex(bObj.canvas, false, 1, 1, renderer)
  };
}

function ctxDrawFloralDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    ctx.moveTo(cx + Math.cos(ang) * r * 0.4, cy + Math.sin(ang) * r * 0.4);
    ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  }
}

/**
 * 8. 512×512 Glossy Patterned Imperial Encaustic Floor Tiles (`Nền gạch bông cung đình cổ` — Photos 1 & 5!)
 */
export function createHueEncausticFloorPbrTextures(
  renderer?: THREE.WebGLRenderer,
  repeatX = 28,
  repeatY = 20
): { map: THREE.Texture; bumpMap: THREE.Texture; roughnessMap: THREE.Texture } {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 512;
  const cObj = makeCanvas(sz, sz);
  const rObj = makeCanvas(sz, sz);
  if (!cObj || !rObj) {
    const flat = finalizeDataTex(new Uint8Array([146, 120, 76, 255]), 1, true, repeatX, repeatY, 1, renderer);
    return { map: flat, bumpMap: flat, roughnessMap: flat };
  }
  const c = cObj.ctx;
  const r = rObj.ctx;
  const tiles = 2;
  const tw = sz / tiles;

  // Warm antique golden-ochre/umber encaustic base (Photos 1 & 5!)
  c.fillStyle = '#8b7044';
  c.fillRect(0, 0, sz, sz);
  r.fillStyle = '#323232'; // Glossy polished royal floor reflection (~0.20 roughness)
  r.fillRect(0, 0, sz, sz);

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const ox = tx * tw;
      const oy = ty * tw;
      const cx = ox + tw * 0.5;
      const cy = oy + tw * 0.5;

      // Subtle warm golden-ochre parchment tile body
      const tileTone = (tx + ty) % 2 === 0 ? '#a28858' : '#967b4c';
      c.fillStyle = tileTone;
      c.fillRect(ox + 3, oy + 3, tw - 6, tw - 6);

      // Aged grout seam
      c.strokeStyle = '#624d2f';
      c.lineWidth = 4;
      c.strokeRect(ox + 2, oy + 2, tw - 4, tw - 4);
      r.strokeStyle = '#b8b8b8'; // Matte grout line
      r.lineWidth = 5;
      r.strokeRect(ox + 2, oy + 2, tw - 4, tw - 4);

      // Diagonal diamond frame & muted umber/ochre floral rosette medallion (Photo 1!)
      c.strokeStyle = '#735c39';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(cx, oy + 14);
      c.lineTo(ox + tw - 14, cy);
      c.lineTo(cx, oy + tw - 14);
      c.lineTo(ox + 14, cy);
      c.closePath();
      c.stroke();

      c.fillStyle = '#7c623d';
      for (let p = 0; p < 8; p++) {
        const ang = (p / 8) * Math.PI * 2;
        c.beginPath();
        c.ellipse(
          cx + Math.cos(ang) * tw * 0.17,
          cy + Math.sin(ang) * tw * 0.17,
          tw * 0.10,
          tw * 0.05,
          ang,
          0,
          Math.PI * 2
        );
        c.fill();
      }
      c.fillStyle = '#c2a978';
      c.beginPath();
      c.arc(cx, cy, tw * 0.09, 0, Math.PI * 2);
      c.fill();

      // Corner quarter-floral motifs that join across adjacent tiles
      c.fillStyle = '#6d5738';
      for (const [qx, qy] of [
        [ox, oy],
        [ox + tw, oy],
        [ox, oy + tw],
        [ox + tw, oy + tw]
      ]) {
        c.beginPath();
        c.arc(qx, qy, tw * 0.14, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // Subtle historical wear patina speckles
  c.fillStyle = 'rgba(72, 56, 36, 0.08)';
  for (let i = 0; i < 420; i++) {
    const px = hash2i(i, 1, 9012) * sz;
    const py = hash2i(i, 2, 9012) * sz;
    c.fillRect(px, py, 3 + hash2i(i, 3, 9012) * 8, 2 + hash2i(i, 4, 9012) * 6);
  }

  const map = wrapCanvasTex(cObj.canvas, true, repeatX, repeatY, renderer);
  const roughnessMap = wrapCanvasTex(rObj.canvas, false, repeatX, repeatY, renderer);
  return { map, bumpMap: roughnessMap, roughnessMap };
}

/**
 * 9. 512×512 Golden-Ochre Panelled Interior Walls (`Vách Đố Bản Sơn Vàng Viền Đỏ` — Photos 1, 3, 5!)
 */
export function createHueVachDoBanTexture(
  renderer?: THREE.WebGLRenderer,
  repeatX = 6,
  repeatY = 1
): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 512;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([196, 138, 36, 255]), 1, true, repeatX, repeatY, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = sz / 512;

  // Crimson-lacquered outer frame background
  ctx.fillStyle = '#6f1112';
  ctx.fillRect(0, 0, sz, sz);

  // Upper dark-crimson transom band with golden calligraphic/scroll cartouches
  ctx.fillStyle = '#5c0c0d';
  ctx.fillRect(0, 0, sz, 96 * S);
  ctx.strokeStyle = '#eab93c';
  ctx.lineWidth = 4 * S;
  ctx.strokeRect(8 * S, 8 * S, sz - 16 * S, 80 * S);
  for (let k = 0; k < 2; k++) {
    ctx.strokeRect((24 + k * 248) * S, 20 * S, 216 * S, 56 * S);
    ctx.fillStyle = '#e5b232';
    ctx.beginPath();
    ctx.ellipse((132 + k * 248) * S, 48 * S, 54 * S, 18 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4 Tall Narrow Vertical Golden-Ochre Lacquer Panels (`Vách Đố Bản`) separated by crimson stiles & gold trim
  const panelCount = 4;
  const colW = sz / panelCount;
  for (let i = 0; i < panelCount; i++) {
    const px = i * colW + 10 * S;
    const pw = colW - 20 * S;

    // Upper tall golden-amber panel
    const grad = ctx.createLinearGradient(px, 112 * S, px + pw, 400 * S);
    grad.addColorStop(0, '#c98e22');
    grad.addColorStop(0.5, '#dea430');
    grad.addColorStop(1, '#b37918');
    ctx.fillStyle = grad;
    ctx.fillRect(px, 112 * S, pw, 294 * S);
    ctx.strokeStyle = '#f4cf58';
    ctx.lineWidth = 3 * S;
    ctx.strokeRect(px + 4 * S, 116 * S, pw - 8 * S, 286 * S);

    // Lower golden-ochre wainscoting dado panel
    ctx.fillStyle = '#b77d1b';
    ctx.fillRect(px, 422 * S, pw, 74 * S);
    ctx.strokeRect(px + 4 * S, 426 * S, pw - 8 * S, 66 * S);
  }

  // Horizontal gilded cornice rails
  ctx.fillStyle = '#eab838';
  ctx.fillRect(0, 96 * S, sz, 8 * S);
  ctx.fillRect(0, 408 * S, sz, 8 * S);
  ctx.fillRect(0, 502 * S, sz, 10 * S);

  return wrapCanvasTex(canvas, true, repeatX, repeatY, renderer);
}

/**
 * 10. 512×512 Diamond-Weave Imperial Bamboo Sun-Blinds (`Mành Tre Quả Trám` — Photo 6 Điện Thái Hòa!)
 */
export function createHueBambooBlindTexture(
  renderer?: THREE.WebGLRenderer,
  repeatX = 3,
  repeatY = 2
): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 512;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([224, 206, 158, 255]), 1, true, repeatX, repeatY, 1, renderer);
  }
  const { canvas, ctx } = cObj;

  // Deep espresso veranda shadow backing
  ctx.fillStyle = '#241710';
  ctx.fillRect(0, 0, sz, sz);

  // Crisp ivory-cream diamond lozenge bamboo weave (Photo 6 iconic visual rhythm!)
  const cols = 4;
  const rows = 4;
  const cw = sz / cols;
  const ch = sz / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cw;
      const cy = (r + 0.5) * ch;
      ctx.fillStyle = '#f0e2ba';
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch * 0.44);
      ctx.lineTo(cx + cw * 0.36, cy);
      ctx.lineTo(cx, cy + ch * 0.44);
      ctx.lineTo(cx - cw * 0.36, cy);
      ctx.closePath();
      ctx.fill();

      // Subtle inner warm shadow border on each bamboo diamond
      ctx.strokeStyle = '#c8b27c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // Fine horizontal bamboo slat lines across the whole blind
  ctx.fillStyle = 'rgba(28, 16, 8, 0.22)';
  for (let y = 0; y < sz; y += 6) {
    ctx.fillRect(0, y, sz, 2);
  }

  return wrapCanvasTex(canvas, true, repeatX, repeatY, renderer);
}

/**
 * 11. 512×512 Imperial Blue-and-White Huế Porcelain (`Sứ Lam Huế` — Photos 1 & 6!)
 */
export function createHuePorcelainCobaltTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 512;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([232, 238, 248, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = sz / 512;

  // Glossy ivory-white porcelain glaze
  ctx.fillStyle = '#edf1f7';
  ctx.fillRect(0, 0, sz, sz);

  // Cobalt-blue rim & foot key-fret bands
  ctx.fillStyle = '#1b478a';
  ctx.fillRect(0, 18 * S, sz, 14 * S);
  ctx.fillRect(0, 472 * S, sz, 16 * S);
  ctx.strokeStyle = '#255aa6';
  ctx.lineWidth = 5 * S;
  for (let x = 0; x < sz; x += 48 * S) {
    ctx.strokeRect(x + 6 * S, 42 * S, 36 * S, 24 * S);
    // Lower lotus petal ring
    ctx.beginPath();
    ctx.moveTo(x + 4 * S, 466 * S);
    ctx.quadraticCurveTo(x + 24 * S, 386 * S, x + 44 * S, 466 * S);
    ctx.stroke();
  }

  // Cobalt-blue coiling dragon & lotus scrolls across belly
  ctx.strokeStyle = '#1d4c94';
  ctx.lineWidth = 10 * S;
  ctx.beginPath();
  for (let x = 0; x <= sz; x += 12 * S) {
    const y = (240 + Math.sin((x / sz) * Math.PI * 4) * 72) * S;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let k = 0; k < 6; k++) {
    const lx = (48 + k * 84) * S;
    const ly = (160 + (k % 2) * 140) * S;
    drawImperialCloud(ctx, lx, ly, 0.9 * S, '#2b63b0', '#163b73');
  }

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 11b. 512×256 Carved Golden Openwork `Cửa Võng` Dragon-Scrollwork Arch Texture (Photos 1 & 3 — ZERO polka-dots!)
 */
export function createHueCuaVongFiligreeTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 512;
  const h = headless ? 64 : 256;
  const cObj = makeCanvas(w, h);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([242, 198, 64, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const S = w / 512;
  ctx.clearRect(0, 0, w, h);

  // Carved top golden frieze beam & side borders (transparent openwork field!)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffe88a');
  g.addColorStop(0.5, '#e8b632');
  g.addColorStop(1, '#c48a18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, 18 * S);
  ctx.fillRect(0, 0, 22 * S, h * 0.94);
  ctx.fillRect(w - 22 * S, 0, 22 * S, h * 0.94);

  // Sweeping carved golden arch rib framing the central throne opening
  ctx.strokeStyle = g;
  ctx.lineWidth = 14 * S;
  ctx.beginPath();
  ctx.moveTo(14 * S, h * 0.94);
  ctx.quadraticCurveTo(w * 0.14, h * 0.36, w * 0.50, h * 0.42);
  ctx.quadraticCurveTo(w * 0.86, h * 0.36, w - 14 * S, h * 0.94);
  ctx.stroke();

  // Intricate openwork branching lotus vines, scrolling clouds & confronting dragons (`chạm lọng vàng`)!
  ctx.strokeStyle = '#f6cf52';
  ctx.lineWidth = 5.5 * S;
  for (let x = 34 * S; x < w - 34 * S; x += 28 * S) {
    const nx = Math.abs(x / w - 0.5) * 2.0;
    const maxY = nx > 0.72 ? h * 0.86 : h * (0.38 + nx * 0.06);
    for (let y = 30 * S; y < maxY; y += 26 * S) {
      ctx.beginPath();
      ctx.arc(x, y, 10 * S, 0, Math.PI * 1.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 12 * S, y + 8 * S, 6.5 * S, Math.PI * 0.4, Math.PI * 2.1);
      ctx.stroke();
    }
  }
  // Confronting golden dragons & auspicious clouds across upper valance
  for (let x = 44 * S; x < w - 44 * S; x += 48 * S) {
    drawImperialCloud(ctx, x, 46 * S, 0.62 * S, '#efc03a', '#fff0a4');
  }
  // Central radiant Flaming Pearl (`Lưỡng Long Chầu Nhật` centerpiece)
  ctx.fillStyle = '#fff2a8';
  ctx.beginPath();
  ctx.arc(w * 0.5, 58 * S, 18 * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8b5208';
  ctx.lineWidth = 3 * S;
  ctx.stroke();

  // Delicate scalloped golden tassel fringes hanging along arch curve
  ctx.fillStyle = '#f2c43e';
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const fx = t * w;
    const distC = Math.abs(t - 0.5) * 2.0;
    const fy = distC > 0.72 ? h * (0.48 + (distC - 0.72) * 1.45) : h * (0.41 + Math.sin(t * Math.PI * 2) * 0.015);
    ctx.beginPath();
    ctx.moveTo(fx - 6 * S, fy);
    ctx.lineTo(fx + 6 * S, fy);
    ctx.lineTo(fx, fy + 24 * S);
    ctx.closePath();
    ctx.fill();
  }

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 11c. 128×128 Additive 6-Ray Architectural Spotlight Starburst Flare Texture (Photos 1, 3, 5!)
 */
export function createHueStarburstFlareTexture(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 32 : 128;
  const cObj = makeCanvas(sz, sz);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([255, 240, 200, 255]), 1, true, 1, 1, 1, renderer);
  }
  const { canvas, ctx } = cObj;
  const mid = sz * 0.5;
  ctx.clearRect(0, 0, sz, sz);

  // Soft warm core glow
  const core = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.52);
  core.addColorStop(0, 'rgba(255, 255, 248, 1.0)');
  core.addColorStop(0.22, 'rgba(255, 242, 198, 0.85)');
  core.addColorStop(0.55, 'rgba(255, 210, 128, 0.24)');
  core.addColorStop(1, 'rgba(255, 190, 96, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, sz, sz);

  // Crisp 6-pointed lens diffraction spikes (exact camera starburst look in Photos 1, 3, 5!)
  ctx.save();
  ctx.translate(mid, mid);
  for (let r = 0; r < 6; r++) {
    ctx.rotate(Math.PI / 3);
    const ray = ctx.createLinearGradient(0, 0, mid * 0.96, 0);
    ray.addColorStop(0, 'rgba(255, 255, 245, 0.92)');
    ray.addColorStop(0.35, 'rgba(255, 238, 185, 0.42)');
    ray.addColorStop(1, 'rgba(255, 220, 140, 0.0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.022);
    ctx.lineTo(mid * 0.96, 0);
    ctx.lineTo(0, sz * 0.022);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  return wrapCanvasTex(canvas, true, 1, 1, renderer);
}

/**
 * 12. Dark Mirror-Reflective Moat Water Shader (Photo 2 Ngọ Môn Kim Thủy / Thái Dịch Moat!)
 *     Reflects azure sky, bright puffy clouds, dark rubble stone bank, lush green bushes,
 *     and glowing golden-orange Ngọ Môn roof silhouette with subtle calm ripples!
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

        // Deep vibrant azure tropical sky reflection (darkened properly at dusk/night, NEVER milky baby blue!)
        vec3 R = reflect(-V, N);
        float skyH = clamp(R.y, 0.0, 1.0);
        vec3 daySky = mix(vec3(0.24, 0.52, 0.88), vec3(0.08, 0.28, 0.68), smoothstep(0.0, 0.55, skyH));
        vec3 duskSky = mix(vec3(0.76, 0.46, 0.26), vec3(0.14, 0.24, 0.52), smoothstep(0.0, 0.55, skyH));
        vec3 nightSky = vec3(0.03, 0.06, 0.14);
        vec3 skyRefl = mix(mix(daySky, duskSky, uDuskAmount), nightSky, uNightAmount);
        float cl = noise2(R.xz / max(R.y + 0.18, 0.22) * 1.8 + vec2(0.25, 0.65));
        skyRefl = mix(skyRefl, mix(vec3(0.86, 0.90, 0.96), vec3(0.14, 0.18, 0.28), uNightAmount), smoothstep(0.58, 0.78, cl) * 0.55);

        // Deep emerald-black mirror water + dark rubble embankment shadow + bush/roof mirror reflection
        float edgeDist = min(vUv.y, 1.0 - vUv.y);
        float bankProx = 1.0 - smoothstep(0.0, 0.40, edgeDist);
        vec3 deepWater = vec3(0.018, 0.055, 0.068);
        vec3 bankRefl = vec3(0.08, 0.10, 0.09);
        vec3 reflCol = mix(skyRefl, bankRefl, bankProx * 0.82);

        vec3 col = mix(deepWater, reflCol, fresnel);
        col *= mix(1.0, 0.40, smoothstep(0.22, 0.0, edgeDist));

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
  dragonColumnMat: THREE.MeshPhysicalMaterial;
  cuuLongAnVanMat: THREE.MeshBasicMaterial;
  hoanhPhiThaiHoaMat: THREE.MeshStandardMaterial;
  interiorNhatThiMat: THREE.MeshStandardMaterial;
  encausticFloorMat: THREE.MeshStandardMaterial;
  vachDoBanMat: THREE.MeshStandardMaterial;
  thanhStoneMat: THREE.MeshStandardMaterial;
  rubbleMoatMat: THREE.MeshStandardMaterial;
  bambooBlindMat: THREE.MeshStandardMaterial;
  porcelainCobaltMat: THREE.MeshStandardMaterial;
  imperialCrimsonWoodMat: THREE.MeshPhysicalMaterial;
  brightBarrierRedMat: THREE.MeshStandardMaterial;
  antiqueBronzeCauldronMat: THREE.MeshStandardMaterial;
  ceramicMosaicMat: THREE.MeshStandardMaterial;
  terracottaBalustradeMat: THREE.MeshStandardMaterial;
  cuaVongFiligreeMat: THREE.MeshStandardMaterial;
  starburstFlareMat: THREE.SpriteMaterial;
  moatReflectiveWaterMat: THREE.ShaderMaterial;
  moatWaterUniforms: { uTime: { value: number }; uNightAmount: { value: number }; uDuskAmount: { value: number } };
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

/**
 * Builds ONE canonical shared Hue Imperial PBR Material Pack reused by Ngọ Môn (`HueImperialCitadelComplex`),
 * Core Điện Thái Hòa (`HueThaiHoaThroneHall`), and Macro Hoàng Cung Huế (`HueGrandImperialPalace`)
 * so zero duplicate materials/textures are ever created across zones!
 */
export function createHueImperialMaterialPack(
  renderer?: THREE.WebGLRenderer,
  bronzePatinaPbr?: PbrTextureSet,
  targetPbrSize?: number
): HueImperialMaterialPack {
  const headless = isHeadlessRenderer(renderer);
  const pbrSize = headless ? 128 : (targetPbrSize ?? 512);

  const hoangPbr = createHueGlazedRoofPbrTextures('hoang_luu_ly', { size: pbrSize, renderer });
  const thanhPbr = createHueGlazedRoofPbrTextures('thanh_luu_ly', { size: pbrSize, renderer });
  const thanhStonePbr = createHueThanhStonePbrTextures({ size: pbrSize, renderer });
  const rubblePbr = createHueRubbleMoatPbrTextures({ size: pbrSize, renderer });
  const dragonColTex = createHueDragonColumnPbrTextures(renderer);
  const cuuLongTex = createHueCuuLongAnVanTexture(renderer);
  const hoanhPhiTex = createHueHoanhPhiThaiHoaTexture(renderer);
  const nhatThiTex = createHueInteriorNhatThiTexture(renderer);
  const floorTex = createHueEncausticFloorPbrTextures(renderer, 1, 1);
  for (const t of [floorTex.map, floorTex.bumpMap, floorTex.roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  const vachTex = createHueVachDoBanTexture(renderer, 6, 1);
  const bambooTex = createHueBambooBlindTexture(renderer, 2, 2);
  const porcelainTex = createHuePorcelainCobaltTexture(renderer);
  const cuaVongTex = createHueCuaVongFiligreeTexture(renderer);
  const starburstTex = createHueStarburstFlareTexture(renderer);
  const moatWater = createHueReflectiveMoatMaterial();

  // PBR Roughness Calibration (QC-4): roughness = 1.0 whenever roughnessMap encodes true physical roughness!
  // FrontSide on createHueImperialHipRoofGeometry (outward CCW winding!) keeps exterior roofs 100% solid while preventing lower-tier eaves from bleeding into the interior hall ceiling!
  const hoangLuuLyMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: hoangPbr.map,
    normalMap: hoangPbr.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: hoangPbr.roughnessMap,
    aoMap: hoangPbr.aoMap,
    roughness: 1.0,
    metalness: 0.08,
    clearcoat: 0.56,
    clearcoatRoughness: 0.18,
    side: THREE.FrontSide
  });

  const thanhLuuLyMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: thanhPbr.map,
    normalMap: thanhPbr.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: thanhPbr.roughnessMap,
    aoMap: thanhPbr.aoMap,
    roughness: 1.0,
    metalness: 0.08,
    clearcoat: 0.50,
    clearcoatRoughness: 0.20,
    side: THREE.FrontSide
  });

  const dragonColumnMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: dragonColTex.map,
    bumpMap: dragonColTex.bumpMap,
    bumpScale: 0.038,
    roughnessMap: dragonColTex.roughnessMap,
    metalnessMap: dragonColTex.metalnessMap,
    roughness: 1.0,
    metalness: 0.88,
    clearcoat: 0.42,
    clearcoatRoughness: 0.18
  });

  // Unlit museum artwork material for Cửu Long Ẩn Vân so overhead sun/roof shadow-acne never bleaches the rich imperial yellow-gold!
  const cuuLongAnVanMat = new THREE.MeshBasicMaterial({
    color: '#ead6b8',
    map: cuuLongTex,
    side: THREE.DoubleSide
  });

  const hoanhPhiThaiHoaMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: hoanhPhiTex,
    emissiveMap: hoanhPhiTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.26,
    roughness: 0.30,
    metalness: 0.35
  });

  const interiorNhatThiMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: nhatThiTex.map,
    bumpMap: nhatThiTex.bumpMap,
    bumpScale: 0.03,
    emissiveMap: nhatThiTex.map,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.22,
    roughness: 0.32,
    metalness: 0.38
  });

  const encausticFloorMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.012,
    roughnessMap: floorTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.06
  });

  const vachDoBanMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: vachTex,
    emissiveMap: vachTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.16,
    roughness: 0.38,
    metalness: 0.18
  });

  const thanhStoneMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: thanhStonePbr.map,
    normalMap: thanhStonePbr.normalMap,
    roughnessMap: thanhStonePbr.roughnessMap,
    aoMap: thanhStonePbr.aoMap,
    roughness: 1.0,
    metalness: 0.04
  });

  const rubbleMoatMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: rubblePbr.map,
    normalMap: rubblePbr.normalMap,
    roughnessMap: rubblePbr.roughnessMap,
    aoMap: rubblePbr.aoMap,
    roughness: 1.0,
    metalness: 0.03
  });

  const bambooBlindMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: bambooTex,
    roughness: 0.72,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  const porcelainCobaltMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: porcelainTex,
    roughness: 0.18,
    metalness: 0.06
  });

  const imperialCrimsonWoodMat = new THREE.MeshPhysicalMaterial({
    color: '#480608',
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.35,
    clearcoatRoughness: 0.24
  });

  const brightBarrierRedMat = new THREE.MeshStandardMaterial({
    color: '#960b0f',
    roughness: 0.24,
    metalness: 0.06
  });

  const antiqueBronzeCauldronMat = new THREE.MeshStandardMaterial({
    color: '#343632',
    normalMap: bronzePatinaPbr?.normalMap,
    roughnessMap: bronzePatinaPbr?.roughnessMap,
    roughness: 0.42,
    metalness: 0.80
  });

  const ceramicMosaicMat = new THREE.MeshStandardMaterial({
    color: '#8a7966',
    normalMap: rubblePbr.normalMap,
    roughness: 0.56,
    metalness: 0.08
  });

  const terracottaBalustradeMat = new THREE.MeshStandardMaterial({
    color: '#965440',
    normalMap: thanhStonePbr.normalMap,
    roughness: 0.82,
    metalness: 0.04
  });

  const cuaVongFiligreeMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: cuaVongTex,
    emissiveMap: cuaVongTex,
    emissive: new THREE.Color('#ffbe3b'),
    emissiveIntensity: 0.28,
    alphaTest: 0.38,
    roughness: 0.24,
    metalness: 0.84,
    side: THREE.DoubleSide
  });

  const starburstFlareMat = new THREE.SpriteMaterial({
    map: starburstTex,
    color: '#fff2cc',
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.92
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
    bambooBlindMat,
    porcelainCobaltMat,
    imperialCrimsonWoodMat,
    brightBarrierRedMat,
    antiqueBronzeCauldronMat,
    ceramicMosaicMat,
    terracottaBalustradeMat,
    cuaVongFiligreeMat,
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
    dragonColTex.map, dragonColTex.roughnessMap, dragonColTex.metalnessMap,
    cuuLongTex,
    hoanhPhiTex,
    nhatThiTex.map, nhatThiTex.bumpMap,
    floorTex.map, floorTex.roughnessMap,
    vachTex,
    bambooTex,
    porcelainTex,
    cuaVongTex,
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
    bambooBlindMat,
    porcelainCobaltMat,
    imperialCrimsonWoodMat,
    brightBarrierRedMat,
    antiqueBronzeCauldronMat,
    ceramicMosaicMat,
    terracottaBalustradeMat,
    cuaVongFiligreeMat,
    starburstFlareMat,
    moatReflectiveWaterMat: moatWater.material,
    moatWaterUniforms: moatWater.uniforms,
    allMaterials,
    allTextures
  };
}
