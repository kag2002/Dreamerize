import * as THREE from 'three';
import type { PbrTextureOptions, PbrTextureSet } from './pbrTextures';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash2i(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tileNoise(u: number, v: number, periodX: number, periodY: number, seed: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const px0 = ((x0 % periodX) + periodX) % periodX;
  const py0 = ((y0 % periodY) + periodY) % periodY;
  const px1 = px0 + 1 < periodX ? px0 + 1 : 0;
  const py1 = py0 + 1 < periodY ? py0 + 1 : 0;
  const n00 = hash2i(px0, py0, seed);
  const n10 = hash2i(px1, py0, seed);
  const n01 = hash2i(px0, py1, seed);
  const n11 = hash2i(px1, py1, seed);
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
      return Math.min(8, Math.max(1, cap.getMaxAnisotropy()));
    }
  } catch {
    // Headless fallback
  }
  return 4;
}

function finalizeTex(
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

function buildPbrSet(
  albedo: Uint8Array,
  height: Float32Array,
  rough: Float32Array,
  ao: Float32Array,
  size: number,
  normalStrength: number,
  opts: PbrTextureOptions
): PbrTextureSet {
  const rx = opts.repeatX ?? 1;
  const ry = opts.repeatY ?? 1;
  const aniso = getAniso(opts.renderer);

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
    map: finalizeTex(albedo, size, true, rx, ry, aniso, opts.renderer),
    normalMap: finalizeTex(normalData, size, false, rx, ry, aniso, opts.renderer),
    roughnessMap: finalizeTex(roughData, size, false, rx, ry, aniso, opts.renderer),
    aoMap: finalizeTex(aoData, size, false, rx, ry, aniso, opts.renderer)
  };
}

/**
 * 1. Rubbed mortarless Chăm Pa terracotta brick (*Gạch Chăm mài chập* — Mỹ Sơn, Poshanư, Ponagar):
 * Ultra-tight hair-thin joints, warm burnt-orange/terracotta clay courses with dark tropical rain-soot
 * weathering and olive-moss pockets along ledges.
 */
export function createChamRubbedBrickPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1103;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 14;
  const cols = 6;
  const palette: Array<[number, number, number]> = [
    [186, 88, 52],
    [172, 76, 44],
    [202, 108, 66],
    [152, 66, 40],
    [194, 96, 58]
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

      const brickId = hash2i(col % cols, row % rows, seed);
      const clayGrain = tileFbm(u, v, 16, 16, 3, seed + 23);
      const rainStreak = tileFbm(u, v, 8, 2, 3, seed + 61);
      const sootMacro = tileFbm(u, v, 4, 4, 3, seed + 109);

      // Hair-thin mortarless rubbed joint
      const eU = Math.min(fu, 1.0 - fu) * (rows / cols);
      const eV = Math.min(fv, 1.0 - fv);
      const edge = Math.min(eU, eV);
      const brickMask = smoothstep(0.012, 0.055, edge);

      const base = palette[Math.floor(brickId * palette.length) % palette.length];
      const shade = 0.86 + (brickId - 0.5) * 0.16 + (clayGrain - 0.5) * 0.16;
      let r = base[0] * shade;
      let g = base[1] * shade;
      let b = base[2] * shade;

      // Dark blackened monsoon weathering patches characteristic of ancient Chăm brick
      const sootMask = smoothstep(0.56, 0.84, sootMacro * 0.65 + rainStreak * 0.35) * 0.58;
      r = lerp(r, 56 + clayGrain * 18, sootMask);
      g = lerp(g, 42 + clayGrain * 14, sootMask);
      b = lerp(b, 36 + clayGrain * 12, sootMask);

      // Subtle green moss tucked into horizontal crevices
      const moss = (1.0 - brickMask) * smoothstep(0.54, 0.82, sootMacro) * 0.45;
      r = lerp(r, 64, moss);
      g = lerp(g, 88, moss);
      b = lerp(b, 42, moss);

      // Tight dark rubbed seam
      r = lerp(68, r, brickMask);
      g = lerp(38, g, brickMask);
      b = lerp(26, b, brickMask);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      const pit = tileNoise(u, v, 64, 64, seed + 211) < 0.14 ? -0.07 : 0;
      height[i] = clamp01(lerp(0.28, 0.64 + (clayGrain - 0.5) * 0.14 + pit - sootMask * 0.08, brickMask));
      rough[i] = clamp01(0.76 + (1.0 - brickMask) * 0.16 + sootMask * 0.12);
      ao[i] = clamp01(lerp(0.52, 0.94 - sootMask * 0.12, brickMask));
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 2.3, opts);
}

/**
 * 2. Unplastered Marseille red-orange clay brickwork (*Gạch đỏ Marseille* — Nhà Thờ Đức Bà Sài Gòn):
 * Crisp running-bond coursed red-terracotta bricks with clean pale-grey recessed mortar lines.
 */
export function createMarseilleBrickPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1207;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 16;
  const cols = 8;
  const palette: Array<[number, number, number]> = [
    [186, 80, 54],
    [176, 72, 48],
    [198, 92, 62],
    [168, 68, 46]
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
      const brickMask = smoothstep(0.045, 0.105, Math.min(eU, eV));

      const bid = hash2i(col % cols, row % rows, seed);
      const grain = tileFbm(u, v, 16, 16, 2, seed + 37);
      const streak = tileFbm(u, v, 10, 2, 2, seed + 71);
      const base = palette[Math.floor(bid * palette.length) % palette.length];
      const shade = 0.90 + (bid - 0.5) * 0.12 + (grain - 0.5) * 0.10 - (streak - 0.5) * 0.08;

      const r = lerp(174 * (0.94 + (grain - 0.5) * 0.08), base[0] * shade, brickMask);
      const g = lerp(164 * (0.94 + (grain - 0.5) * 0.08), base[1] * shade, brickMask);
      const b = lerp(150 * (0.94 + (grain - 0.5) * 0.08), base[2] * shade, brickMask);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.36, 0.72 + (grain - 0.5) * 0.08, brickMask));
      rough[i] = clamp01(lerp(0.90, 0.72 + (grain - 0.5) * 0.08, brickMask));
      ao[i] = clamp01(lerp(0.72, 0.96, brickMask));
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 2.0, opts);
}

/**
 * 3. Aged Vietnamese Imperial Citadel brick (*Gạch vồ cổ rêu mốc* — Đoan Môn, Ngọ Môn Huế, Cột Cờ Hà Nội):
 * Weathered brownish-grey kiln-fired large bricks with vertical black monsoon runoff and muted moss.
 */
export function createImperialBrickPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1319;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 12;
  const cols = 6;
  const palette: Array<[number, number, number]> = [
    [118, 92, 76],
    [132, 98, 78],
    [104, 84, 72],
    [126, 86, 68],
    [96, 82, 74]
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
      const brickMask = smoothstep(0.04, 0.11, Math.min(eU, eV));

      const bid = hash2i(col % cols, row % rows, seed);
      const grain = tileFbm(u, v, 14, 14, 3, seed + 53);
      const streak = tileFbm(u, v, 12, 2, 3, seed + 89);
      const base = palette[Math.floor(bid * palette.length) % palette.length];
      const shade = 0.86 + (bid - 0.5) * 0.18 + (grain - 0.5) * 0.14;

      let r = lerp(112, base[0] * shade, brickMask);
      let g = lerp(106, base[1] * shade, brickMask);
      let b = lerp(98, base[2] * shade, brickMask);

      // Vertical monsoon charcoal staining
      const darkRunoff = smoothstep(0.52, 0.84, streak) * 0.42;
      r = lerp(r, 46, darkRunoff);
      g = lerp(g, 44, darkRunoff);
      b = lerp(b, 42, darkRunoff);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.32, 0.68 + (grain - 0.5) * 0.14, brickMask));
      rough[i] = clamp01(0.84 + (1.0 - brickMask) * 0.10);
      ao[i] = clamp01(lerp(0.62, 0.94 - darkRunoff * 0.16, brickMask));
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 2.2, opts);
}

/**
 * 4. Honeycomb vesicular laterite blocks (*Đá ong tổ ong* — Làng Cổ Đường Lâm, Đền Hùng):
 * Large rust-umber dressed blocks riddled with characteristic porous iron-oxide cavities & lime mortar.
 */
export function createLateriteHoneycombPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1429;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 6;
  const cols = 4;

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
      const blockMask = smoothstep(0.035, 0.095, Math.min(eU, eV));

      const bid = hash2i(col % cols, row % rows, seed);
      const macro = tileFbm(u, v, 8, 8, 3, seed + 17);
      // Honeycomb pores: two scales of vesicular holes
      const p1 = tileNoise(u, v, 28, 28, seed + 101);
      const p2 = tileNoise(u, v, 56, 56, seed + 193);
      const pore = clamp01(smoothstep(0.72, 0.88, p1) * 0.85 + smoothstep(0.76, 0.90, p2) * 0.65) * blockMask;

      const shade = 0.82 + (bid - 0.5) * 0.22 + (macro - 0.5) * 0.22;
      let r = 134 * shade;
      let g = 82 * shade;
      let b = 52 * shade;

      // Dark cavernous pore interiors
      r = lerp(r, 38, pore * 0.82);
      g = lerp(g, 24, pore * 0.82);
      b = lerp(b, 18, pore * 0.82);

      // Aged grey-buff mortar & subtle moss
      r = lerp(128, r, blockMask);
      g = lerp(120, g, blockMask);
      b = lerp(108, b, blockMask);

      const moss = (1.0 - blockMask) * smoothstep(0.55, 0.82, macro) * 0.42;
      r = lerp(r, 68, moss);
      g = lerp(g, 92, moss);
      b = lerp(b, 46, moss);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.36, 0.74 + (macro - 0.5) * 0.12 - pore * 0.52, blockMask));
      rough[i] = clamp01(0.86 + pore * 0.12);
      ao[i] = clamp01(lerp(0.66, 0.95 - pore * 0.58, blockMask));
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 2.8, opts);
}

/**
 * 5. Aged tropical Vietnamese lime plaster (*Tường vôi cổ loang rêu mốc* — Hội An, Tháp Rùa, Chùa Một Cột, Lăng Vua Hùng):
 * Neutral high-value base (designed to multiply cleanly with material.color such as ochre or grey-white)
 * with realistic vertical monsoon runoff streaks, damp mottling, and subtle trowel texture.
 */
export function createAgedVietnamesePlasterPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1543;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = tileFbm(u, v, 4, 4, 3, seed + 13);
      const streak = tileFbm(u, v, 10, 2, 3, seed + 47);
      const trowel = tileFbm(u, v, 24, 24, 2, seed + 91);

      const stain = smoothstep(0.54, 0.86, streak * 0.7 + macro * 0.3);
      const baseVal = 0.94 + (macro - 0.5) * 0.10 + (trowel - 0.5) * 0.06 - stain * 0.24;

      // Slight warm-olive tint in damp streaks
      const r = clampByte(242 * baseVal);
      const g = clampByte(240 * baseVal + stain * 4);
      const b = clampByte(232 * baseVal - stain * 10);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = r;
      albedo[idx + 1] = g;
      albedo[idx + 2] = b;
      albedo[idx + 3] = 255;

      height[i] = clamp01(0.5 + (trowel - 0.5) * 0.32 + (macro - 0.5) * 0.16);
      rough[i] = clamp01(0.84 + stain * 0.10 + (1.0 - trowel) * 0.05);
      ao[i] = clamp01(0.88 - stain * 0.16 + (trowel - 0.5) * 0.08);
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 1.4, opts);
}

/**
 * 6. Traditional Bát Tràng red-brown terracotta courtyard paving (*Gạch lát sân Bát Tràng*):
 * Square hand-fired terracotta tiles with warm kiln-blush variation and sandy weathered joints.
 */
export function createBatTrangFloorPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1657;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const tiles = 6;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const gx = u * tiles;
      const gy = v * tiles;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;

      const edge = Math.min(Math.min(fx, 1.0 - fx), Math.min(fy, 1.0 - fy));
      const tileMask = smoothstep(0.025, 0.075, edge);
      const tid = hash2i(ix % tiles, iy % tiles, seed);
      const grain = tileFbm(u, v, 16, 16, 2, seed + 31);
      const wear = tileFbm(u, v, 6, 6, 2, seed + 83);

      const shade = 0.86 + (tid - 0.5) * 0.16 + (grain - 0.5) * 0.10 + (wear - 0.5) * 0.08;
      const r = lerp(128, 168 * shade, tileMask);
      const g = lerp(116, 86 * shade, tileMask);
      const b = lerp(104, 62 * shade, tileMask);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(lerp(0.36, 0.68 + (grain - 0.5) * 0.08, tileMask));
      rough[i] = clamp01(lerp(0.92, 0.72 + (1.0 - wear) * 0.12, tileMask));
      ao[i] = clamp01(lerp(0.68, 0.96, tileMask));
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 1.8, opts);
}

/**
 * 7a. Dense layered tropical thatch (*Mái cỏ tranh / lá cọ* — Nhà Rông, Nhà Sàn Thái, Chòi canh lúa):
 * Fine vertical straw fibers with horizontal stepped bundle tiers and sunlit golden-ochre to weathered umber variation.
 */
export function createThatchFiberPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1777;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const strand = tileFbm(u, v, 48, 6, 3, seed + 19);
      const fine = tileNoise(u, v, 96, 12, seed + 67);
      const macro = tileFbm(u, v, 6, 4, 2, seed + 113);

      // Horizontal overlapping thatch courses
      const courseV = (v * 7.0 + (strand - 0.5) * 0.35) % 1.0;
      const courseStep = smoothstep(0.0, 0.16, courseV);

      const h = clamp01((0.24 + strand * 0.46 + fine * 0.22) * (0.68 + 0.32 * courseStep));
      const shade = (0.76 + h * 0.38 + (macro - 0.5) * 0.16) * lerp(0.64, 1.0, courseStep);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(174 * shade);
      albedo[idx + 1] = clampByte(142 * shade);
      albedo[idx + 2] = clampByte(90 * shade);
      albedo[idx + 3] = 255;

      height[i] = h;
      rough[i] = clamp01(0.88 + (1.0 - h) * 0.10);
      ao[i] = clamp01(0.48 + 0.52 * h * courseStep);
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 2.8, opts);
}

/**
 * 7b. Woven split-bamboo lattice (*Phên nứa đan mắt cáo / xương cá* — Nhà Rông Kon Tum, vách nhà sàn):
 */
export function createBambooWeavePbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1889;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const strips = 16;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // 45-degree diagonal basketweave
      const du = ((u + v) * strips) % 2.0;
      const dv = ((u - v + 2.0) * strips) % 2.0;
      const iu = Math.floor(du);
      const iv = Math.floor(dv);
      const fu = du - iu;
      const fv = dv - iv;
      const overU = (iu + iv) % 2 === 0;

      const arch = overU ? Math.sin(fu * Math.PI) : Math.sin(fv * Math.PI);
      const across = overU ? Math.sin(fv * Math.PI) : Math.sin(fu * Math.PI);
      const fiber = tileNoise(u, v, 32, 32, seed + 41);
      const macro = tileFbm(u, v, 6, 6, 2, seed + 83);

      const h = clamp01(0.22 + arch * 0.48 + across * 0.22 + (fiber - 0.5) * 0.08);
      const shade = 0.72 + h * 0.42 + (macro - 0.5) * 0.16;

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(168 * shade);
      albedo[idx + 1] = clampByte(138 * shade);
      albedo[idx + 2] = clampByte(96 * shade);
      albedo[idx + 3] = 255;

      height[i] = h;
      rough[i] = clamp01(0.76 + (1.0 - h) * 0.16);
      ao[i] = clamp01(0.45 + 0.55 * h);
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 2.6, opts);
}

/**
 * 8. Cast imperial bronze with verdigris green patina (*Đồng cổ patina xanh ngọc* — Cửu Đỉnh, Fansipan, Đỉnh đồng):
 */
export function createBronzeVerdigrisPbrTextures(opts: PbrTextureOptions = {}): PbrTextureSet {
  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1997;
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const castGrain = tileFbm(u, v, 20, 20, 3, seed + 11);
      const patinaNoise = tileFbm(u, v, 6, 6, 3, seed + 59);
      const streak = tileFbm(u, v, 10, 3, 2, seed + 97);

      const verdigris = smoothstep(0.54, 0.80, patinaNoise * 0.68 + streak * 0.32) * 0.72;
      const shade = 0.85 + (castGrain - 0.5) * 0.20;

      // Dark antique bronze base transitioning to emerald-turquoise verdigris patina
      const r = lerp(74 * shade, 72 * shade, verdigris);
      const g = lerp(60 * shade, 136 * shade, verdigris);
      const b = lerp(42 * shade, 118 * shade, verdigris);

      const i = y * size + x;
      const idx = i * 4;
      albedo[idx] = clampByte(r);
      albedo[idx + 1] = clampByte(g);
      albedo[idx + 2] = clampByte(b);
      albedo[idx + 3] = 255;

      height[i] = clamp01(0.50 + (castGrain - 0.5) * 0.24 - verdigris * 0.08);
      rough[i] = clamp01(lerp(0.38, 0.78, verdigris) + (castGrain - 0.5) * 0.08);
      ao[i] = clamp01(0.82 + (castGrain - 0.5) * 0.16 - verdigris * 0.12);
    }
  }

  return buildPbrSet(albedo, height, rough, ao, size, opts.normalStrength ?? 1.5, opts);
}
