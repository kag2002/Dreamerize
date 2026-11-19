import * as THREE from 'three';

export interface PbrTextureSet {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  aoMap: THREE.DataTexture;
}

export interface PbrTextureOptions {
  size?: number;
  seed?: number;
  renderer?: THREE.WebGLRenderer;
  repeatX?: number;
  repeatY?: number;
  normalStrength?: number;
}

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

/**
 * Tileable 2D value noise with integer period so textures repeat seamlessly at edges.
 */
function tileNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const px0 = ((x0 % period) + period) % period;
  const py0 = ((y0 % period) + period) % period;
  const px1 = (px0 + 1) % period;
  const py1 = (py0 + 1) % period;

  const n00 = hash2i(px0, py0, seed);
  const n10 = hash2i(px1, py0, seed);
  const n01 = hash2i(px0, py1, seed);
  const n11 = hash2i(px1, py1, seed);

  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

/**
 * Tileable 2D value noise with independent integer X/Y periods for anisotropic textures (e.g. 8:1 bark & strata).
 */
function tileNoiseAniso(u: number, v: number, periodX: number, periodY: number, seed: number): number {
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
  const px1 = (px0 + 1) % periodX;
  const py1 = (py0 + 1) % periodY;

  const n00 = hash2i(px0, py0, seed);
  const n10 = hash2i(px1, py0, seed);
  const n01 = hash2i(px0, py1, seed);
  const n11 = hash2i(px1, py1, seed);

  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

/**
 * Tileable multi-octave anisotropic FBM in [0, 1] with independent integer X/Y base periods.
 */
function tileFbmAniso(
  u: number,
  v: number,
  basePeriodX: number,
  basePeriodY: number,
  octaves: number,
  seed: number
): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = basePeriodX;
  let py = basePeriodY;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoiseAniso(u, v, px, py, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    px *= 2;
    py *= 2;
  }
  return sum / norm;
}

/**
 * Tileable multi-octave FBM in [0, 1].
 */
function tileFbm(u: number, v: number, basePeriod: number, octaves: number, seed: number): number {
  return tileFbmAniso(u, v, basePeriod, basePeriod, octaves, seed);
}

function getSafeAnisotropy(renderer?: THREE.WebGLRenderer): number {
  if (!renderer) return 4;
  try {
    const cap = (renderer as unknown as { capabilities?: { getMaxAnisotropy?: () => number } }).capabilities;
    if (cap && typeof cap.getMaxAnisotropy === 'function') {
      return Math.min(8, Math.max(1, cap.getMaxAnisotropy()));
    }
  } catch {
    // Ignore in headless mock renderers
  }
  return 4;
}

function initTextureSafe(renderer: THREE.WebGLRenderer | undefined, tex: THREE.Texture): void {
  if (!renderer) return;
  const r = renderer as unknown as { initTexture?: (t: THREE.Texture) => void };
  if (typeof r.initTexture === 'function') {
    try {
      r.initTexture(tex);
    } catch {
      // Ignore in mock renderers
    }
  }
}

function finalizeDataTexture(
  data: Uint8Array,
  size: number,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  initTextureSafe(renderer, tex);
  return tex;
}

/**
 * Computes a tangent-space normal map from a tileable heightfield using a 3x3 Sobel filter.
 */
function buildSobelNormalTexture(
  heightfield: Float32Array,
  size: number,
  strength: number,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const normalData = new Uint8Array(size * size * 4);
  const mask = size - 1;
  const isPow2 = (size & mask) === 0;

  const sampleH = (x: number, y: number): number => {
    const wx = isPow2 ? x & mask : ((x % size) + size) % size;
    const wy = isPow2 ? y & mask : ((y % size) + size) % size;
    return heightfield[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      normalData[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      normalData[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normalData[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }

  return finalizeDataTexture(normalData, size, false, repeatX, repeatY, anisotropy, renderer);
}

function buildGrayscaleTexture(
  values: Float32Array,
  size: number,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const b = clampByte(values[i] * 255);
    const idx = i * 4;
    data[idx] = b;
    data[idx + 1] = b;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  }
  return finalizeDataTexture(data, size, false, repeatX, repeatY, anisotropy, renderer);
}

/**
 * Generates a 512x512 seamless weathered river-stone / flagstone PBR texture set:
 * rounded worn stones, soft sandy-loam mortar transitions (#5c564c), warm/cool granite & sandstone
 * variation, fine surface pitting, and soft height bevels without stark black borders.
 */
export function createCobblestonePbrTextures(options: PbrTextureOptions = {}): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 101;
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const cellsX = 7;
  const cellsY = 7;

  const stonePalette: Array<[number, number, number]> = [
    [168, 160, 146], // warm buff sandstone
    [148, 148, 144], // cool silver-grey granite
    [174, 162, 144], // weathered golden flagstone
    [138, 140, 136], // river slate grey
    [160, 150, 138], // warm taupe granite
    [144, 146, 134], // olive-grey fieldstone
    [156, 152, 142]  // neutral weathered limestone
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Gentle organic warp so flagstones have natural worn contours
      const warpX = (tileFbm(u, v, 6, 3, seed + 11) - 0.5) * 0.055;
      const warpY = (tileFbm(u + 0.37, v + 0.61, 6, 3, seed + 29) - 0.5) * 0.055;
      const gx = ((u + warpX + 1.0) % 1.0) * cellsX;
      const gy = ((v + warpY + 1.0) % 1.0) * cellsY;

      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;

      let d1 = 999;
      let d2 = 999;
      let d3 = 999;
      let cellId = 0;
      let cellWarmth = 0;
      let cellTiltX = 0;
      let cellTiltY = 0;
      let cellDx = 0;
      let cellDy = 0;

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = ((ix + ox) % cellsX + cellsX) % cellsX;
          const cy = ((iy + oy) % cellsY + cellsY) % cellsY;
          const jx = 0.18 + 0.64 * hash2i(cx, cy, seed);
          const jy = 0.18 + 0.64 * hash2i(cx, cy, seed + 131);
          const aspect = 0.88 + 0.24 * hash2i(cx, cy, seed + 193);
          const dx = (ox + jx - fx) * aspect;
          const dy = (oy + jy - fy) / aspect;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < d1) {
            d3 = d2;
            d2 = d1;
            d1 = dist;
            cellId = hash2i(cx, cy, seed + 277);
            cellWarmth = hash2i(cx, cy, seed + 349) - 0.5;
            cellTiltX = (hash2i(cx, cy, seed + 409) - 0.5) * 0.12;
            cellTiltY = (hash2i(cx, cy, seed + 521) - 0.5) * 0.12;
            cellDx = dx;
            cellDy = dy;
          } else if (dist < d2) {
            d3 = d2;
            d2 = dist;
          } else if (dist < d3) {
            d3 = dist;
          }
        }
      }

      // Round off 3-way polygon vertices so stones read as worn river-stones / dressed flagstones
      const rawEdge = d2 - d1;
      const cornerRounding = 0.068 * Math.exp(-9.5 * Math.max(0.0, d3 - d2));
      const edgeDist = Math.max(0.0, rawEdge - cornerRounding);

      // Soft, natural mortar-to-stone transition & worn pillowed stone crown
      const stoneMask = smoothstep(0.018, 0.135, edgeDist);
      const crown = smoothstep(0.03, 0.38, edgeDist);
      const bevelHighlight = smoothstep(0.04, 0.13, edgeDist) * (1.0 - smoothstep(0.13, 0.28, edgeDist));

      const grain = tileFbmAniso(u, v, 16, 24, 3, seed + 701);
      const mineralBand = tileFbmAniso(u + cellId * 0.3, v, 8, 16, 3, seed + 809);
      const microPit = tileNoise(u, v, 72, seed + 911);
      const finePit = tileNoise(u, v, 144, seed + 1237);
      const sandGrain = tileNoise(u, v, 192, seed + 1451);
      const mossNoise = tileFbm(u, v, 8, 3, seed + 1103);

      // Gentle worn heightfield: shallow sandy-loam mortar recess with soft stone bevels
      const pitCut = (microPit - 0.5) * 0.045 + (finePit < 0.16 ? -0.045 : 0.0);
      const stoneHeight =
        0.54 +
        0.24 * crown +
        bevelHighlight * 0.035 +
        (grain - 0.5) * 0.09 +
        pitCut +
        cellDx * cellTiltX +
        cellDy * cellTiltY;
      const mortarHeight = 0.38 + (grain - 0.5) * 0.05 + (sandGrain - 0.5) * 0.03;
      const h = lerp(mortarHeight, clamp01(stoneHeight), stoneMask);

      const baseCol = stonePalette[Math.floor(cellId * stonePalette.length) % stonePalette.length];
      const shade =
        0.88 +
        (grain - 0.5) * 0.18 +
        (mineralBand - 0.5) * 0.10 +
        (microPit - 0.5) * 0.07 +
        bevelHighlight * 0.05;
      let rCol = (baseCol[0] + cellWarmth * 14) * shade;
      let gCol = (baseCol[1] + cellWarmth * 6) * shade;
      let bCol = (baseCol[2] - cellWarmth * 10) * shade;

      // Fine crystalline granite/sandstone speckle on stone tops
      if (sandGrain > 0.84) {
        rCol += 10 * stoneMask;
        gCol += 9 * stoneMask;
        bCol += 8 * stoneMask;
      } else if (sandGrain < 0.14) {
        rCol -= 9 * stoneMask;
        gCol -= 9 * stoneMask;
        bCol -= 8 * stoneMask;
      }

      // Soft warm sandy-loam mortar (#5c564c perceptual target in lit sRGB->linear pipeline, never jet black)
      const mortarShade = 0.92 + (grain - 0.5) * 0.18 + (sandGrain - 0.5) * 0.12;
      const mR = 122 * mortarShade;
      const mG = 114 * mortarShade;
      const mB = 101 * mortarShade;

      rCol = lerp(mR, rCol, stoneMask);
      gCol = lerp(mG, gCol, stoneMask);
      bCol = lerp(mB, bCol, stoneMask);

      // Subtle warm olive-sage moss/earth tucked softly into occasional damp mortar pockets
      const jointZone = 1.0 - smoothstep(0.02, 0.16, edgeDist);
      const mossMask = clamp01((mossNoise - 0.56) * 2.2) * jointZone * 0.32;
      rCol = lerp(rCol, 102 + grain * 18, mossMask);
      gCol = lerp(gCol, 116 + grain * 22, mossMask);
      bCol = lerp(bCol, 78 + grain * 12, mossMask);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(rCol);
      albedo[cIdx + 1] = clampByte(gCol);
      albedo[cIdx + 2] = clampByte(bCol);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      rough[pIdx] = clamp01(
        lerp(0.90, 0.62 + (1.0 - crown) * 0.16 + (grain - 0.5) * 0.10, stoneMask) + mossMask * 0.06
      );
      // Soft AO (>= 0.72 in mortar) so mortar joints never multiply into black cartoon lines
      ao[pIdx] = clamp01(lerp(0.74, 0.90 + 0.10 * crown, stoneMask) * (1.0 - mossMask * 0.08));
    }
  }

  const effectiveNormalStrength = Math.min(options.normalStrength ?? 1.85, 2.15);

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      effectiveNormalStrength,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

/**
 * Generates a 512x512 weathered coursed ashlar/rubble stone masonry PBR texture set
 * with soft recessed lime-mortar joints (#6e685f), aged stone patina, and natural micro-grain.
 */
export function createStoneMasonryPbrTextures(options: PbrTextureOptions = {}): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 202;
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const rows = 8;
  const cols = 5;

  const stoneTones: Array<[number, number, number]> = [
    [184, 176, 163],
    [170, 163, 151],
    [192, 184, 171],
    [160, 154, 145],
    [176, 168, 153]
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Subtle hand-dressed course undulation
      const wobbleU = (tileFbm(u, v, 10, 2, seed + 17) - 0.5) * 0.022;
      const wobbleV = (tileFbm(u + 0.5, v + 0.2, 10, 2, seed + 41) - 0.5) * 0.018;

      const vv = ((v + wobbleV + 1.0) % 1.0) * rows;
      const row = Math.floor(vv);
      const vCell = vv - row;

      const rowShift = (row % 2) * 0.48 + (hash2i(0, row, seed + 73) - 0.5) * 0.26;
      const uu = (((u + wobbleU + 1.0) % 1.0) * cols + rowShift + cols) % cols;
      const col = Math.floor(uu);
      const uCell = uu - col;

      // Vary effective block lengths by softening occasional vertical head joints into long ashlar stretchers
      const mergePrev = hash2i(col % cols, row % rows, seed + 113) > 0.72;
      const mergeNext = hash2i((col + 1) % cols, row % rows, seed + 113) > 0.72;
      const leftDist = mergePrev ? 0.5 : uCell;
      const rightDist = mergeNext ? 0.5 : 1.0 - uCell;
      const uEdge = Math.min(leftDist, rightDist);
      const vEdge = Math.min(vCell, 1.0 - vCell) * (cols / rows);

      // Softly round block corners so ashlar stones look weathered rather than sharp boxes
      const cornerRound = 0.042 * Math.max(0.0, 1.0 - (uEdge + vEdge) * 4.0);
      const distEdge = Math.max(0.0, Math.min(uEdge, vEdge) - cornerRound);

      const blockMask = smoothstep(0.020, 0.095, distEdge);
      const bevelEdge = smoothstep(0.04, 0.11, distEdge) * (1.0 - smoothstep(0.11, 0.22, distEdge));
      const effCol = mergePrev ? ((col - 1 + cols) % cols) : (col % cols);
      const blockId = hash2i(effCol, row % rows, seed + 199);
      const blockWarmth = hash2i(effCol, row % rows, seed + 257) - 0.5;

      // Sedimentary horizontal micro-bedding + fine dressed stone grain
      const strataGrain = tileFbmAniso(u, v, 8, 24, 3, seed + 307);
      const chisel = tileNoise(u, v, 64, seed + 433);
      const finePit = tileNoise(u, v, 128, seed + 547);
      const patinaMacro = tileFbm(u, v, 8, 3, seed + 613);

      const base = stoneTones[Math.floor(blockId * stoneTones.length) % stoneTones.length];
      const blockTint =
        0.90 +
        (blockId - 0.5) * 0.11 +
        (strataGrain - 0.5) * 0.16 +
        (chisel - 0.5) * 0.07 +
        bevelEdge * 0.04;
      let r = (base[0] + blockWarmth * 10) * blockTint;
      let g = (base[1] + blockWarmth * 5) * blockTint;
      let b = (base[2] - blockWarmth * 8) * blockTint;

      // Soft recessed lime-mortar joints (#6e685f perceptual target, warm buff-taupe mortar, never black)
      const mortarGrain = 0.94 + (strataGrain - 0.5) * 0.12 + (finePit - 0.5) * 0.08;
      const mR = 142 * mortarGrain;
      const mG = 135 * mortarGrain;
      const mB = 124 * mortarGrain;
      r = lerp(mR, r, blockMask);
      g = lerp(mG, g, blockMask);
      b = lerp(mB, b, blockMask);

      // Subtle aged warm-ochre & sage coastal patina along mortar shoulders
      const patinaWeight = clamp01((patinaMacro - 0.55) * 2.1) * (0.25 + 0.45 * (1.0 - blockMask));
      r = lerp(r, 152 + strataGrain * 18, patinaWeight * 0.32);
      g = lerp(g, 150 + strataGrain * 18, patinaWeight * 0.32);
      b = lerp(b, 130 + strataGrain * 14, patinaWeight * 0.32);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      const pitOffset = finePit < 0.14 ? -0.035 : 0.0;
      const blockH = 0.56 + (strataGrain - 0.5) * 0.14 + (chisel - 0.5) * 0.06 + bevelEdge * 0.03 + pitOffset;
      height[pIdx] = lerp(0.41 + strataGrain * 0.05, clamp01(blockH), blockMask);
      rough[pIdx] = clamp01(lerp(0.88, 0.68 + (strataGrain - 0.5) * 0.14, blockMask));
      // Soft recessed lime-mortar AO (>= 0.76) so mortar reads as natural lime plaster rather than dark lines
      ao[pIdx] = clamp01(lerp(0.76, 0.90 + 0.10 * smoothstep(0.04, 0.24, distEdge), blockMask));
    }
  }

  const effectiveNormalStrength = Math.min(options.normalStrength ?? 1.75, 2.05);

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      effectiveNormalStrength,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

/**
 * Generates a 512x512 sculpted overlapping barrel-tile clay roof PBR texture set
 * (supports warm aged 'terracotta' or glazed coastal 'teal' variants).
 */
export function createTerracottaRoofPbrTextures(
  options: PbrTextureOptions & { variant?: 'terracotta' | 'teal' } = {}
): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 303;
  const variant = options.variant ?? 'terracotta';
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  const cols = 12;
  const rows = 10;

  const palette: Array<[number, number, number]> =
    variant === 'teal'
      ? [
          [70, 122, 132],
          [86, 138, 146],
          [58, 104, 114],
          [94, 144, 148],
          [66, 114, 120]
        ]
      : [
          [192, 92, 58],
          [174, 76, 48],
          [208, 112, 72],
          [156, 68, 44],
          [184, 98, 64]
        ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      const uu = u * cols;
      const vv = v * rows;
      const colIdx = Math.floor(uu) % cols;
      const rowIdx = Math.floor(vv) % rows;
      const uTile = uu - Math.floor(uu);
      const vTile = vv - Math.floor(vv);

      // Barrel profile across each tile column + stepped overlap lip along course bottom (vTile near 0)
      const barrel = Math.sin(uTile * Math.PI);
      const lipRise = smoothstep(0.0, 0.14, vTile);
      const courseSlope = 0.25 + 0.75 * (1.0 - vTile * 0.55);

      const tileRand = hash2i(colIdx, rowIdx, seed);
      const grain = tileFbm(u, v, 24, 3, seed + 157);
      const microPit = tileNoise(u, v, 112, seed + 269);
      const striation = Math.sin((uTile * 18.0 + tileRand * 6.28 + (grain - 0.5) * 1.4) * Math.PI) * 0.5 + 0.5;
      const crazeCrack = smoothstep(0.89, 0.985, 1.0 - Math.abs(tileNoise(u, v, 42, seed + 491) * 2.0 - 1.0)) * lipRise;
      const grime = tileFbm(u, v, 8, 3, seed + 389);
      const lichenFleck = smoothstep(0.72, 0.91, tileNoise(u, v, 84, seed + 601)) * smoothstep(0.42, 0.70, grime) * lipRise;

      const tileCol = palette[Math.floor(tileRand * palette.length) % palette.length];
      const ridgeLight = 0.78 + 0.30 * barrel + (grain - 0.5) * 0.16 + (striation - 0.5) * 0.05 + (microPit - 0.5) * 0.05 - crazeCrack * 0.16;
      const lipShadow = lerp(0.46, 1.0, lipRise);
      const troughShadow = 0.72 + 0.28 * Math.pow(barrel, 0.55);

      let r = tileCol[0] * ridgeLight * lipShadow * troughShadow;
      let g = tileCol[1] * ridgeLight * lipShadow * troughShadow;
      let b = tileCol[2] * ridgeLight * lipShadow * troughShadow;

      // Subtle weathered moss/soot flecks in tile overlaps and troughs + pale lichen specks
      const crevice = (1.0 - barrel) * 0.68 + (1.0 - lipRise) * 0.80;
      const mossMask = clamp01((grime - 0.53) * 2.9) * clamp01(crevice);
      r = lerp(r, 72 + grain * 24, mossMask * 0.56);
      g = lerp(g, 94 + grain * 28, mossMask * 0.56);
      b = lerp(b, 44 + grain * 14, mossMask * 0.56);

      r = lerp(r, 174 + microPit * 22, lichenFleck * 0.42);
      g = lerp(g, 172 + microPit * 20, lichenFleck * 0.42);
      b = lerp(b, 128 + microPit * 16, lichenFleck * 0.42);

      const h = clamp01((0.16 + 0.56 * barrel * courseSlope) * lipRise + (grain - 0.5) * 0.05 + (striation - 0.5) * 0.02 - crazeCrack * 0.08);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      const baseRough = variant === 'teal' ? 0.48 : 0.60;
      height[pIdx] = h;
      rough[pIdx] = clamp01(baseRough + (1.0 - barrel) * 0.18 + grain * 0.11 + crazeCrack * 0.12 + mossMask * 0.16);
      ao[pIdx] = clamp01(lerp(0.18, 0.64 + 0.36 * barrel, lipRise) * (1.0 - mossMask * 0.20) * (1.0 - crazeCrack * 0.25));
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      options.normalStrength ?? 3.2,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

/**
 * Generates a 512x512 deep-furrowed gnarled oak/camphor tree bark PBR texture set
 * with anisotropic 8:1 vertically stretched anastomosing bark ridges, deep longitudinal furrows,
 * fine horizontal bark plates, grey-brown weathered outer ridges, warm umber inner fissures,
 * and subtle moss restricted strictly to deep vertical crevices (zero circular blotches).
 */
export function createOakBarkPbrTextures(options: PbrTextureOptions = {}): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 404;
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // 8:1 vertically stretched domain warp so longitudinal bark channels weave and anastomose
      const warp1 = (tileFbmAniso(u, v, 6, 1, 3, seed + 13) - 0.5) * 0.085;
      const warp2 = (tileFbmAniso(u + 0.41, v + 0.29, 16, 2, 3, seed + 37) - 0.5) * 0.042;
      const uWarpA = ((u + warp1 + Math.sin(v * Math.PI * 2.0) * 0.022) % 1.0 + 1.0) % 1.0;
      const uWarpB = ((u - warp1 * 0.55 + warp2 + Math.cos(v * Math.PI * 2.0 + 0.9) * 0.018) % 1.0 + 1.0) % 1.0;

      // Multi-scale 8:1 vertically stretched anastomosing bark ridges & longitudinal furrows
      const waveA = Math.cos((uWarpA * 11.0 + (tileNoiseAniso(uWarpA, v, 8, 1, seed + 43) - 0.5) * 0.65) * Math.PI * 2.0) * 0.5 + 0.5;
      const waveB = Math.cos((uWarpB * 15.0 + (tileNoiseAniso(uWarpB, v, 12, 2, seed + 53) - 0.5) * 0.55) * Math.PI * 2.0) * 0.5 + 0.5;

      const anisoRidge1 = tileFbmAniso(uWarpA, v, 16, 2, 4, seed + 59);
      const anisoRidge2 = tileFbmAniso(uWarpB, v, 32, 4, 4, seed + 107);
      const verticalFiber = tileFbmAniso(uWarpA, v, 64, 8, 3, seed + 173);
      const fineWoodGrain = tileNoiseAniso(uWarpA, v, 128, 16, seed + 229);
      const microWoodFiber = tileNoiseAniso(uWarpB, v, 256, 32, seed + 263);

      // Interweaving vertical ridges with organic varied widths and deep V-shaped furrows
      const braided = Math.max(waveA * 0.92, waveB * 0.88) * 0.46 + anisoRidge1 * 0.54;
      const ridgeProfile = smoothstep(0.18, 0.82, braided);

      // Crisp flaky bark ridge steps & sparse hairline horizontal plate fissures (never circular blobs)
      const scaleStepNoise = tileFbmAniso(uWarpA, v, 24, 6, 3, seed + 281);
      const plateLedge = smoothstep(0.25, 0.75, scaleStepNoise) * smoothstep(0.35, 0.78, ridgeProfile);
      const platePhase = Math.sin((v * 14.0 + u * 2.0 + (anisoRidge1 - 0.5) * 2.4) * Math.PI * 2.0);
      const plateGate = smoothstep(0.55, 0.78, tileNoiseAniso(uWarpA, v, 16, 4, seed + 317));
      const horizCheck = (1.0 - smoothstep(0.0, 0.14, Math.abs(platePhase))) * plateGate * smoothstep(0.52, 0.82, ridgeProfile);

      const barkH = clamp01(
        ridgeProfile * 0.58 +
          plateLedge * 0.14 +
          (anisoRidge2 - 0.5) * 0.18 +
          (verticalFiber - 0.5) * 0.12 +
          (fineWoodGrain - 0.5) * 0.08 +
          (microWoodFiber - 0.5) * 0.05 -
          horizCheck * 0.08
      );

      const deepFurrow = 1.0 - smoothstep(0.18, 0.44, barkH);
      const outerCrown = smoothstep(0.52, 0.84, barkH);

      // Warm umber inner fissures -> cinnamon-brown ridge flanks -> weathered grey-brown outer ridges
      const fiberShade =
        0.88 +
        (verticalFiber - 0.5) * 0.18 +
        (anisoRidge2 - 0.5) * 0.14 +
        (fineWoodGrain - 0.5) * 0.10 +
        (microWoodFiber - 0.5) * 0.06 -
        horizCheck * 0.09;
      let r = lerp(62, 132, smoothstep(0.14, 0.68, barkH));
      let g = lerp(47, 110, smoothstep(0.14, 0.68, barkH));
      let b = lerp(34, 86, smoothstep(0.14, 0.68, barkH));

      // Silvery grey-brown weathered outer bark plates
      r = lerp(r, 150, outerCrown * 0.62) * fiberShade;
      g = lerp(g, 134, outerCrown * 0.62) * fiberShade;
      b = lerp(b, 114, outerCrown * 0.62) * fiberShade;

      // Subtle moss strictly tucked inside deep vertical crevices (8:1 vertical streak mask, never circular spots)
      const mossStreak = tileFbmAniso(u, v, 16, 2, 3, seed + 509);
      const mossMask = deepFurrow * smoothstep(0.58, 0.84, mossStreak) * 0.32;
      r = lerp(r, 76 + verticalFiber * 24, mossMask);
      g = lerp(g, 104 + verticalFiber * 28, mossMask);
      b = lerp(b, 52 + verticalFiber * 14, mossMask);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      height[pIdx] = clamp01(barkH + mossMask * 0.03);
      rough[pIdx] = clamp01(0.80 + deepFurrow * 0.14 + (1.0 - verticalFiber) * 0.06);
      ao[pIdx] = clamp01(0.38 + 0.62 * smoothstep(0.12, 0.72, barkH) - horizCheck * 0.10);
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      options.normalStrength ?? 3.4,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

/**
 * Generates a 512x512 weathered walnut timber beam PBR texture set.
 */
export function createTimberBeamPbrTextures(options: PbrTextureOptions = {}): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 505;
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const grainWarp = (tileFbm(u, v, 8, 2, seed + 17) - 0.5) * 0.04;
      const fiber = Math.sin(((u + grainWarp) * 28.0 + tileFbm(u, v * 0.25, 12, 3, seed + 41) * 4.5) * Math.PI * 2) * 0.5 + 0.5;
      const fine = tileFbm(u, v, 32, 2, seed + 89);

      const h = clamp01(0.35 + fiber * 0.42 + (fine - 0.5) * 0.22);
      const tone = 0.76 + h * 0.36;

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(106 * tone);
      albedo[cIdx + 1] = clampByte(74 * tone);
      albedo[cIdx + 2] = clampByte(48 * tone);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      rough[pIdx] = clamp01(0.72 + (1.0 - fiber) * 0.16);
      ao[pIdx] = clamp01(0.55 + 0.45 * h);
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      options.normalStrength ?? 1.9,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

/**
 * Generates a 512x512 aged cream cottage plaster/stucco PBR texture set.
 */
export function createPlasterWallPbrTextures(options: PbrTextureOptions = {}): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 606;
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = tileFbm(u, v, 6, 3, seed + 19);
      const trowel = tileFbm(u, v, 24, 3, seed + 67);
      const sand = tileNoise(u, v, 96, seed + 149);

      const h = clamp01(0.4 + (trowel - 0.5) * 0.45 + (sand - 0.5) * 0.25);
      const shade = 0.90 + (macro - 0.5) * 0.12 + (trowel - 0.5) * 0.08;

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(236 * shade);
      albedo[cIdx + 1] = clampByte(228 * shade);
      albedo[cIdx + 2] = clampByte(210 * shade);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      rough[pIdx] = clamp01(0.84 + (1.0 - trowel) * 0.10);
      ao[pIdx] = clamp01(0.78 + 0.22 * h);
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      options.normalStrength ?? 1.25,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

/**
 * Generates a crisp 512x512 alpha-tested botanical oak/camphor leaf-cluster CanvasTexture:
 * an airy organic spray of 16 small overlapping serrated leaves on thin forked woody twigs
 * with ~40% open alpha sky gaps between twigs/leaflets so canopies look lacy and 3D.
 */
export function createBotanicalLeafAtlasTexture(
  renderer?: THREE.WebGLRenderer,
  size = 512
): THREE.Texture {
  const anisotropy = getSafeAnisotropy(renderer);

  if (typeof document === 'undefined') {
    const fallbackSize = 64;
    const data = new Uint8Array(fallbackSize * fallbackSize * 4);
    for (let y = 0; y < fallbackSize; y++) {
      for (let x = 0; x < fallbackSize; x++) {
        const dx = (x / fallbackSize - 0.5) * 2;
        const dy = (y / fallbackSize - 0.5) * 2;
        const r2 = dx * dx + dy * dy;
        const angle = Math.atan2(dy, dx);
        const lacyGap = Math.sin(angle * 5.0 + r2 * 6.0) > 0.28 && r2 > 0.08;
        const inside = r2 < 0.72 && !lacyGap;
        const idx = (y * fallbackSize + x) * 4;
        data[idx] = 68;
        data[idx + 1] = 128;
        data[idx + 2] = 44;
        data[idx + 3] = inside ? 255 : 0;
      }
    }
    const tex = new THREE.DataTexture(data, fallbackSize, fallbackSize, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    initTextureSafe(renderer, tex);
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const drawLeaf = (
    cx: number,
    cy: number,
    angle: number,
    length: number,
    width: number,
    hueShift: number,
    bright: number
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Slender serrated botanical leaf with acuminate tip and crisp marginal teeth
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const steps = 26;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const env = Math.sin(Math.pow(t, 0.74) * Math.PI);
      const lobe = 1.0 + 0.09 * Math.sin(t * Math.PI * 5.0);
      const serration = i < steps && i > 2 ? (i % 2 === 0 ? 1.12 : 0.90) : 1.0;
      const x = -width * 0.5 * env * lobe * serration * (1.0 - t * 0.14);
      const y = -length * t - (i % 2 === 0 ? length * 0.014 : 0);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(0, -length * 1.06);
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      const env = Math.sin(Math.pow(t, 0.74) * Math.PI);
      const lobe = 1.0 + 0.09 * Math.sin(t * Math.PI * 5.0 + 0.5);
      const serration = i < steps && i > 2 ? (i % 2 === 0 ? 1.12 : 0.90) : 1.0;
      const x = width * 0.5 * env * lobe * serration * (1.0 - t * 0.14);
      const y = -length * t - (i % 2 === 0 ? length * 0.014 : 0);
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, -length);
    const rBase = clampByte((42 + hueShift * 16) * bright);
    const gBase = clampByte((86 + hueShift * 20) * bright);
    const bBase = clampByte((24 + hueShift * 8) * bright);
    const rTip = clampByte((104 + hueShift * 28) * bright);
    const gTip = clampByte((164 + hueShift * 24) * bright);
    const bTip = clampByte((46 + hueShift * 12) * bright);

    grad.addColorStop(0.0, `rgb(${rBase}, ${gBase}, ${bBase})`);
    grad.addColorStop(
      0.56,
      `rgb(${clampByte(lerp(rBase, rTip, 0.56))}, ${clampByte(lerp(gBase, gTip, 0.56))}, ${clampByte(lerp(bBase, bTip, 0.56))})`
    );
    grad.addColorStop(1.0, `rgb(${rTip}, ${gTip}, ${bTip})`);

    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle botanical margin definition
    ctx.lineWidth = Math.max(1.0, size * 0.0022);
    ctx.strokeStyle = `rgba(${clampByte(rBase * 0.68)}, ${clampByte(gBase * 0.72)}, ${clampByte(bBase * 0.68)}, 0.82)`;
    ctx.stroke();

    // Slender woody petiole stem connecting leaf to twig
    ctx.beginPath();
    ctx.moveTo(0, length * 0.09);
    ctx.lineTo(0, -length * 0.02);
    ctx.lineWidth = Math.max(1.3, width * 0.052);
    ctx.strokeStyle = '#4e3824';
    ctx.stroke();

    // Translucent sunlit midrib + pinnate lateral veins
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.03);
    ctx.lineTo(0, -length * 0.93);
    ctx.lineWidth = Math.max(1.1, width * 0.038);
    ctx.strokeStyle = `rgba(${clampByte(rTip * 1.16)}, ${clampByte(gTip * 1.12)}, ${clampByte(bTip * 1.15)}, 0.76)`;
    ctx.stroke();

    ctx.lineWidth = Math.max(0.8, width * 0.020);
    ctx.strokeStyle = `rgba(${clampByte(rTip * 1.08)}, ${clampByte(gTip * 1.08)}, ${clampByte(bTip * 1.08)}, 0.52)`;
    for (let v = 1; v <= 5; v++) {
      const vt = v / 6.2;
      const vy = -length * vt;
      const span = width * 0.36 * Math.sin(vt * Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, vy);
      ctx.lineTo(-span, vy - length * 0.085);
      ctx.moveTo(0, vy - length * 0.025);
      ctx.lineTo(span, vy - length * 0.105);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Thin forked woody twigs with open sky windows between forks
  const drawBranchCurve = (
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    widthScale: number
  ) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2919';
    ctx.lineWidth = size * 0.011 * widthScale;
    ctx.beginPath();
    ctx.moveTo(x0 * size, y0 * size);
    ctx.quadraticCurveTo(cx * size, cy * size, x1 * size, y1 * size);
    ctx.stroke();

    ctx.strokeStyle = '#634830';
    ctx.lineWidth = size * 0.0045 * widthScale;
    ctx.beginPath();
    ctx.moveTo(x0 * size, y0 * size);
    ctx.quadraticCurveTo(cx * size, cy * size, x1 * size, y1 * size);
    ctx.stroke();
  };

  // Primary stem & 5 airy diverging sub-twigs leaving generous sky gaps between branches
  drawBranchCurve(0.50, 0.94, 0.49, 0.66, 0.50, 0.24, 1.05);
  drawBranchCurve(0.49, 0.78, 0.31, 0.68, 0.16, 0.52, 0.82);
  drawBranchCurve(0.50, 0.74, 0.69, 0.64, 0.84, 0.48, 0.82);
  drawBranchCurve(0.49, 0.54, 0.34, 0.42, 0.22, 0.24, 0.70);
  drawBranchCurve(0.50, 0.50, 0.66, 0.39, 0.78, 0.22, 0.70);

  // 7 back-layer dapple-shaded leaves spaced along outer and inner twigs
  const backLeaves: Array<[number, number, number, number, number, number, number]> = [
    [0.28, 0.68, -1.05, 0.19, 0.090, -0.22, 0.76],
    [0.72, 0.65, 1.02, 0.19, 0.090, -0.14, 0.78],
    [0.17, 0.54, -1.28, 0.18, 0.085, -0.05, 0.82],
    [0.83, 0.50, 1.24, 0.18, 0.085, 0.05, 0.82],
    [0.34, 0.43, -0.78, 0.20, 0.092, -0.12, 0.84],
    [0.66, 0.40, 0.76, 0.20, 0.092, 0.10, 0.84],
    [0.50, 0.58, 0.08, 0.19, 0.088, -0.18, 0.80]
  ];
  for (const [nx, ny, ang, l, w, h, br] of backLeaves) {
    drawLeaf(nx * size, ny * size, ang, l * size, w * size, h, br);
  }

  // Fine secondary twiglets
  drawBranchCurve(0.32, 0.66, 0.28, 0.56, 0.25, 0.46, 0.52);
  drawBranchCurve(0.68, 0.62, 0.72, 0.52, 0.75, 0.42, 0.52);

  // 9 front-layer sunlit leaves (16 leaves total) arranged in airy sub-clusters with 35-45% sky gaps
  const frontLeaves: Array<[number, number, number, number, number, number, number]> = [
    [0.38, 0.74, -0.62, 0.18, 0.086, 0.12, 0.94],
    [0.62, 0.71, 0.64, 0.18, 0.086, 0.18, 0.95],
    [0.24, 0.48, -0.88, 0.19, 0.088, 0.22, 0.98],
    [0.76, 0.44, 0.86, 0.19, 0.088, 0.26, 0.98],
    [0.22, 0.26, -0.68, 0.20, 0.092, 0.30, 1.04],
    [0.78, 0.24, 0.66, 0.20, 0.092, 0.34, 1.04],
    [0.32, 0.28, -0.24, 0.18, 0.084, 0.28, 1.02],
    [0.68, 0.26, 0.26, 0.18, 0.084, 0.32, 1.02],
    [0.50, 0.25, -0.04, 0.21, 0.096, 0.40, 1.08]
  ];
  for (const [nx, ny, ang, l, w, h, br] of frontLeaves) {
    drawLeaf(nx * size, ny * size, ang, l * size, w * size, h, br);
  }

  // Color-bleed RGB into alpha=0 pixels so mipmap filtering never creates dark halos around lacy gaps
  const imgData = ctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 24) {
      px[i] = 62;
      px[i + 1] = 112;
      px[i + 2] = 40;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  initTextureSafe(renderer, tex);
  return tex;
}

/**
 * Generates a 512x512 photorealistic stratified Alpine granite & sedimentary cliff PBR texture set:
 * continuous 6-octave ridged multifractal & directional horizontal/tilted bedding planes,
 * angular micro-stepped cleavage ledges (domain-warped FBM, zero Voronoi cells or circular rings),
 * fine quartz/mica/feldspar mineral speckle, subtle warm-slate / buff-grey / ochre mineral bands,
 * deep vertical hairline diaclase cracks, and crisp Sobel normals + roughness (0.58..0.94) + crevice AO.
 */
export function createGraniteCliffPbrTextures(options: PbrTextureOptions = {}): PbrTextureSet {
  const size = options.size ?? 512;
  const seed = options.seed ?? 707;
  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  // Subtle geological strata mineral palette: warm-slate, cool granite, buff-grey, ochre-grey, deep slate
  const strataPalette: Array<[number, number, number]> = [
    [136, 134, 130], // warm alpine slate
    [152, 146, 136], // buff-grey granite
    [124, 126, 128], // cool blue-grey gneiss
    [146, 137, 122], // weathered ochre-buff band
    [116, 118, 118], // dark hornblende slate
    [142, 139, 132]  // neutral feldspathic granite
  ];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Multi-scale anisotropic domain warp (stretched horizontally 1:2 to 1:3 along bedding strike)
      const warpMacro = tileFbmAniso(u, v, 2, 4, 3, seed + 17) - 0.5;
      const warpMid = tileFbmAniso(u + 0.31, v + 0.47, 4, 8, 3, seed + 43) - 0.5;
      const warpFine = tileFbmAniso(u + 0.67, v + 0.19, 8, 16, 2, seed + 79) - 0.5;

      // Continuous horizontal / gently tilted geological bedding coordinate (100% periodic in u and v)
      const dipTilt =
        Math.sin(u * Math.PI * 2.0 + 0.55) * 0.052 +
        Math.sin(u * Math.PI * 4.0 - 0.85) * 0.020;
      const vBed = v + dipTilt + warpMacro * 0.13 + warpMid * 0.052 + warpFine * 0.020;

      // Continuous 6-octave directional ridged multifractal (driven by sheared bedding waves so zero circular loops form)
      let ridgedSum = 0.0;
      let ridgedNorm = 0.0;
      let ridgedAmp = 0.5;
      let weight = 1.0;
      let prevSignal = 0.5;
      for (let o = 0; o < 6; o++) {
        const px = 2 * (1 << o);
        const py = 4 * (1 << o);
        const uOct = ((u + (prevSignal - 0.5) * 0.035 + warpMacro * 0.06) % 1.0 + 1.0) % 1.0;
        const vOct = ((vBed + (prevSignal - 0.5) * 0.020) % 1.0 + 1.0) % 1.0;
        const nVal = tileNoiseAniso(uOct, vOct, px, py, seed + 101 + o * 131);
        const dirWave =
          Math.sin(((u * (o % 2 === 0 ? 1 : -1) + vBed * 3.0 + (nVal - 0.5) * 0.45) * Math.min(px, 16)) * Math.PI * 2.0) *
            0.5 +
          0.5;
        const blended = lerp(dirWave, nVal, 0.52);
        let signal = 1.0 - Math.abs(blended * 2.0 - 1.0);
        signal = signal * signal * weight;
        weight = clamp01(signal * 1.65);
        prevSignal = signal;
        ridgedSum += signal * ridgedAmp;
        ridgedNorm += ridgedAmp;
        ridgedAmp *= 0.52;
      }
      const ridgedMultifractal = ridgedSum / ridgedNorm;

      // Angular micro-stepped sedimentary & granite cleavage ledges along vBed (strictly monotonic in v so zero loops form)
      const bedMacroPhase = ((vBed * 5.0) % 1.0 + 1.0) % 1.0;
      const bedMidPhase = ((vBed * 12.0 + warpMid * 0.32) % 1.0 + 1.0) % 1.0;
      const bedMicroPhase = ((vBed * 28.0 + warpFine * 0.35) % 1.0 + 1.0) % 1.0;

      const ledgeMacro = smoothstep(0.0, 0.15, bedMacroPhase) * (0.92 - 0.24 * bedMacroPhase);
      const ledgeMid = smoothstep(0.0, 0.18, bedMidPhase) * (0.90 - 0.28 * bedMidPhase);
      const ledgeMicro = smoothstep(0.0, 0.22, bedMicroPhase) * (0.88 - 0.30 * bedMicroPhase);
      const steppedLedges = ledgeMacro * 0.50 + ledgeMid * 0.32 + ledgeMicro * 0.18;

      // Horizontal bedding parting seams at strata boundaries (modulated horizontally so seams pinch and swell)
      const seamPinch1 = smoothstep(0.28, 0.76, tileFbmAniso(u, v, 4, 2, 2, seed + 311));
      const seamPinch2 = smoothstep(0.35, 0.80, tileFbmAniso(u + 0.4, v, 8, 4, 2, seed + 353));
      const horizSeam1 = (1.0 - smoothstep(0.015, 0.085, bedMacroPhase)) * seamPinch1;
      const horizSeam2 = (1.0 - smoothstep(0.020, 0.095, bedMidPhase)) * seamPinch2 * 0.72;
      const beddingParting = clamp01(Math.max(horizSeam1, horizSeam2));

      // Steep stepped diaclase hairline joints that jog across bedding strata (never ruler-straight lines or closed loops)
      const bedIndex = Math.floor((vBed + 10.0) * 5.0);
      const bedStepShift = (hash2i(bedIndex, 1, seed + 389) - 0.5) * 0.24;
      const uDiaclase1 = ((u * 3.0 + bedStepShift + warpMacro * 0.42 + warpMid * 0.18 + warpFine * 0.08) % 1.0 + 1.0) % 1.0;
      const uDiaclase2 = ((u * 6.0 - bedStepShift * 0.8 + warpMid * 0.38 + warpFine * 0.10) % 1.0 + 1.0) % 1.0;
      const diaclaseGate1 = smoothstep(0.54, 0.78, tileFbmAniso(u, v, 3, 4, 2, seed + 419)) * smoothstep(0.06, 0.22, bedMacroPhase);
      const diaclaseGate2 = smoothstep(0.60, 0.82, tileFbmAniso(u + 0.27, v + 0.61, 6, 6, 2, seed + 463)) * smoothstep(0.06, 0.24, bedMidPhase);
      const vertCrack1 = (1.0 - smoothstep(0.004, 0.022, Math.abs(uDiaclase1 - 0.5))) * diaclaseGate1;
      const vertCrack2 = (1.0 - smoothstep(0.005, 0.024, Math.abs(uDiaclase2 - 0.5))) * diaclaseGate2 * 0.72;
      const diaclaseCrack = clamp01(Math.max(vertCrack1, vertCrack2));

      const creviceMask = clamp01(Math.max(beddingParting * 0.88, diaclaseCrack * 0.92));

      // Fine quartz / feldspar / biotite mica crystalline mineral speckle
      const rockGrain = tileFbmAniso(u, v, 12, 24, 3, seed + 641);
      const crystal = tileNoise(u, v, 96, seed + 733);
      const fineSpeck = tileNoise(u, v, 192, seed + 827);
      const micaFlake = tileNoise(u, v, 256, seed + 919);

      const h = clamp01(
        0.22 +
          steppedLedges * 0.42 +
          ridgedMultifractal * 0.28 +
          (rockGrain - 0.5) * 0.11 +
          (crystal - 0.5) * 0.05 -
          beddingParting * 0.24 -
          diaclaseCrack * 0.28
      );

      // Continuous mineral band color interpolation along vBed
      const bandCoord = ((vBed * strataPalette.length + warpMid * 0.35) % strataPalette.length + strataPalette.length) % strataPalette.length;
      const bandIdx0 = Math.floor(bandCoord) % strataPalette.length;
      const bandIdx1 = (bandIdx0 + 1) % strataPalette.length;
      const bandFrac = smoothstep(0.15, 0.85, bandCoord - Math.floor(bandCoord));
      const col0 = strataPalette[bandIdx0];
      const col1 = strataPalette[bandIdx1];

      const baseR = lerp(col0[0], col1[0], bandFrac);
      const baseG = lerp(col0[1], col1[1], bandFrac);
      const baseB = lerp(col0[2], col1[2], bandFrac);

      let tone =
        0.84 +
        (ridgedMultifractal - 0.45) * 0.22 +
        (steppedLedges - 0.45) * 0.18 +
        (rockGrain - 0.5) * 0.16 -
        creviceMask * 0.34;

      // Quartz glints, warm feldspar grains & dark biotite mica speckle
      let r = baseR * tone;
      let g = baseG * tone;
      let b = baseB * tone;

      if (fineSpeck > 0.82) {
        // Crystalline quartz & pale feldspar fleck
        r += 18;
        g += 17;
        b += 15;
      } else if (fineSpeck < 0.15) {
        // Dark biotite / hornblende mineral grain
        r -= 16;
        g -= 15;
        b -= 14;
      }
      if (micaFlake > 0.86) {
        // Warm pink-ochre K-feldspar grain
        r += 11;
        g += 6;
        b += 2;
      }

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      // Calibrated roughness strictly in [0.58, 0.94]: cleaved quartz facets (0.58..0.72), weathered rock (0.74..0.85), crevices (0.88..0.94)
      const quartzGloss = fineSpeck > 0.80 ? -0.10 : 0.0;
      const rawRough =
        0.74 -
        (ridgedMultifractal - 0.5) * 0.14 -
        (steppedLedges - 0.5) * 0.08 +
        (1.0 - rockGrain) * 0.08 +
        quartzGloss +
        creviceMask * 0.18;
      rough[pIdx] = Math.min(0.94, Math.max(0.58, rawRough));
      ao[pIdx] = clamp01((0.32 + 0.68 * (1.0 - creviceMask * 0.72)) * (0.86 + 0.14 * steppedLedges));
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, options.renderer),
    normalMap: buildSobelNormalTexture(
      height,
      size,
      options.normalStrength ?? 3.5,
      repeatX,
      repeatY,
      anisotropy,
      options.renderer
    ),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, options.renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, options.renderer)
  };
}

export interface WorldSpaceWeatheringOptions {
  macroScale?: number;
  mossHeight?: number;
  mossColor?: string | THREE.Color;
  dampRoughness?: number;
  dirtTint?: string | THREE.Color;
}

interface WeatheringUniformState {
  uWeatherMacroScale: { value: number };
  uWeatherMossHeight: { value: number };
  uWeatherMossColor: { value: THREE.Color };
  uWeatherDampRoughness: { value: number };
  uWeatherDirtTint: { value: THREE.Color };
}

function toLinearColor(input: string | THREE.Color | undefined, fallbackHex: string): THREE.Color {
  if (input instanceof THREE.Color) {
    return input.clone();
  }
  return new THREE.Color(input ?? fallbackHex);
}

/**
 * Injects deterministic world-space multi-scale mineral strata & vertical rain-streak
 * weathering, localized basal dampness near `mossHeight`, and moisture-gloss roughness
 * variation into any `THREE.MeshStandardMaterial` without dark circular blotches.
 */
export function applyWorldSpaceWeathering(
  material: THREE.MeshStandardMaterial,
  opts: WorldSpaceWeatheringOptions = {}
): THREE.MeshStandardMaterial {
  const existing = material.userData.__weathering as WeatheringUniformState | undefined;
  const macroScale = opts.macroScale ?? 0.18;
  const mossHeight = opts.mossHeight ?? 0.35;
  const mossColor = toLinearColor(opts.mossColor, '#3b5c28');
  const dampRoughness = opts.dampRoughness ?? 0.36;
  const dirtTint = toLinearColor(opts.dirtTint, '#4a3b2c');

  if (existing) {
    existing.uWeatherMacroScale.value = macroScale;
    existing.uWeatherMossHeight.value = mossHeight;
    existing.uWeatherMossColor.value.copy(mossColor);
    existing.uWeatherDampRoughness.value = dampRoughness;
    existing.uWeatherDirtTint.value.copy(dirtTint);
    return material;
  }

  const state: WeatheringUniformState = {
    uWeatherMacroScale: { value: macroScale },
    uWeatherMossHeight: { value: mossHeight },
    uWeatherMossColor: { value: mossColor },
    uWeatherDampRoughness: { value: dampRoughness },
    uWeatherDirtTint: { value: dirtTint }
  };
  material.userData.__weathering = state;

  const prevCompile = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')
    ? material.onBeforeCompile.bind(material)
    : null;
  const prevCacheKey = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')
    ? material.customProgramCacheKey.bind(material)
    : null;

  material.customProgramCacheKey = () =>
    prevCacheKey ? `${prevCacheKey()}|world-space-weathering-v2` : 'world-space-weathering-v2';

  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) {
      prevCompile(shader, renderer);
    }

    shader.uniforms.uWeatherMacroScale = state.uWeatherMacroScale;
    shader.uniforms.uWeatherMossHeight = state.uWeatherMossHeight;
    shader.uniforms.uWeatherMossColor = state.uWeatherMossColor;
    shader.uniforms.uWeatherDampRoughness = state.uWeatherDampRoughness;
    shader.uniforms.uWeatherDirtTint = state.uWeatherDirtTint;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying vec3 vWeatherWorldPos;
        varying vec3 vWeatherWorldNormal;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vec4 weatherWPos = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          weatherWPos = batchingMatrix * weatherWPos;
        #endif
        #ifdef USE_INSTANCING
          weatherWPos = instanceMatrix * weatherWPos;
        #endif
        weatherWPos = modelMatrix * weatherWPos;
        vWeatherWorldPos = weatherWPos.xyz;

        vec3 weatherWNorm = objectNormal;
        #ifdef USE_BATCHING
          weatherWNorm = mat3( batchingMatrix ) * weatherWNorm;
        #endif
        #ifdef USE_INSTANCING
          weatherWNorm = mat3( instanceMatrix ) * weatherWNorm;
        #endif
        weatherWNorm = mat3( modelMatrix ) * weatherWNorm;
        vWeatherWorldNormal = length( weatherWNorm ) > 1e-5 ? normalize( weatherWNorm ) : vec3( 0.0, 1.0, 0.0 );
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uWeatherMacroScale;
        uniform float uWeatherMossHeight;
        uniform vec3 uWeatherMossColor;
        uniform float uWeatherDampRoughness;
        uniform vec3 uWeatherDirtTint;
        varying vec3 vWeatherWorldPos;
        varying vec3 vWeatherWorldNormal;

        float weatherHash3( vec3 p ) {
          p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) );
          p += dot( p, p.yxz + 33.33 );
          return fract( ( p.x + p.y ) * p.z );
        }

        float weatherNoise3( vec3 p ) {
          vec3 i = floor( p );
          vec3 f = fract( p );
          vec3 u = f * f * ( 3.0 - 2.0 * f );
          return mix(
            mix(
              mix( weatherHash3( i + vec3( 0.0, 0.0, 0.0 ) ), weatherHash3( i + vec3( 1.0, 0.0, 0.0 ) ), u.x ),
              mix( weatherHash3( i + vec3( 0.0, 1.0, 0.0 ) ), weatherHash3( i + vec3( 1.0, 1.0, 0.0 ) ), u.x ),
              u.y
            ),
            mix(
              mix( weatherHash3( i + vec3( 0.0, 0.0, 1.0 ) ), weatherHash3( i + vec3( 1.0, 0.0, 1.0 ) ), u.x ),
              mix( weatherHash3( i + vec3( 0.0, 1.0, 1.0 ) ), weatherHash3( i + vec3( 1.0, 1.0, 1.0 ) ), u.x ),
              u.y
            ),
            u.z
          );
        }

        float weatherFbm3( vec3 p ) {
          float sum = 0.0;
          float amp = 0.5;
          sum += amp * weatherNoise3( p );
          p = p * 2.03 + vec3( 17.1, 31.7, 11.3 );
          amp *= 0.5;
          sum += amp * weatherNoise3( p );
          p = p * 2.05 + vec3( 23.9, 7.3, 19.7 );
          amp *= 0.5;
          sum += amp * weatherNoise3( p );
          return sum / 0.875;
        }
        `
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        // Anisotropic horizontal mineral strata + vertical gravity rain-streak coordinates (zero circular blobs)
        vec3 weatherStrataPos = vec3( vWeatherWorldPos.x * 0.38, vWeatherWorldPos.y * 1.65, vWeatherWorldPos.z * 0.38 ) * uWeatherMacroScale;
        float weatherStrata = weatherFbm3( weatherStrataPos );

        vec3 weatherStreakPos = vec3( vWeatherWorldPos.x * 2.35, vWeatherWorldPos.y * 0.26, vWeatherWorldPos.z * 2.35 ) * uWeatherMacroScale + vec3( weatherStrata * 0.55, 0.0, weatherStrata * 0.55 );
        float weatherRainStreak = weatherFbm3( weatherStreakPos );
        float weatherMicro = weatherNoise3( vWeatherWorldPos * ( uWeatherMacroScale * 10.5 ) + vec3( 3.1, 7.7, 11.9 ) );

        // Multi-scale mineral strata & rain-runoff modulation without circular spots
        float weatherVerticalFace = 1.0 - clamp( abs( vWeatherWorldNormal.y ), 0.0, 1.0 );
        float weatherAlbedoVar = 0.90 + weatherStrata * 0.16 + ( weatherRainStreak - 0.5 ) * 0.08 * weatherVerticalFace + ( weatherMicro - 0.5 ) * 0.04;
        diffuseColor.rgb *= weatherAlbedoVar;

        float weatherStreakPatina = smoothstep( 0.48, 0.82, weatherRainStreak ) * weatherVerticalFace * 0.16;
        diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * ( uWeatherDirtTint * 1.40 + vec3( 0.26 ) ), weatherStreakPatina );

        // Localized basal dampness & moss band near uWeatherMossHeight (never smearing deep undersides)
        float weatherUpBias = smoothstep( 0.05, 0.68, vWeatherWorldNormal.y );
        float weatherSideOrUp = smoothstep( -0.35, 0.25, vWeatherWorldNormal.y );
        float weatherHeightDelta = vWeatherWorldPos.y - uWeatherMossHeight;
        float weatherBandWindow = ( 1.0 - smoothstep( -0.15, 0.95, weatherHeightDelta + ( weatherStrata - 0.5 ) * 0.45 ) ) * smoothstep( -2.2, -0.25, weatherHeightDelta );
        float weatherDampMask = weatherBandWindow * weatherSideOrUp * mix( 0.60, 0.95, weatherRainStreak );

        diffuseColor.rgb *= mix( 1.0, 0.82, weatherDampMask );
        diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * ( uWeatherDirtTint * 1.35 + vec3( 0.16 ) ), weatherDampMask * 0.24 );

        float weatherMossBand = ( 1.0 - smoothstep( -0.10, 1.05, weatherHeightDelta + ( weatherStrata - 0.5 ) * 0.55 ) ) * smoothstep( -1.5, -0.15, weatherHeightDelta );
        float weatherMossMask = clamp( weatherMossBand * weatherUpBias * smoothstep( 0.42, 0.74, weatherStrata * 0.65 + weatherMicro * 0.35 ) * 0.48, 0.0, 0.44 );

        vec3 weatherMossShaded = uWeatherMossColor * ( 0.86 + 0.28 * weatherMicro );
        diffuseColor.rgb = mix( diffuseColor.rgb, weatherMossShaded, weatherMossMask );
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor += ( weatherStrata - 0.5 ) * 0.10 + ( weatherRainStreak - 0.5 ) * 0.06;
        float weatherWetPocket = weatherDampMask * smoothstep( 0.38, 0.74, weatherRainStreak ) * ( 1.0 - weatherMossMask * 0.85 );
        roughnessFactor = mix( roughnessFactor, min( roughnessFactor, uWeatherDampRoughness ), weatherWetPocket * 0.78 );
        roughnessFactor = mix( roughnessFactor, max( roughnessFactor, 0.88 ), weatherMossMask * 0.55 );
        roughnessFactor = clamp( roughnessFactor, 0.18, 0.98 );
        `
      );
  };

  material.needsUpdate = true;
  return material;
}

export function disposePbrTextureSet(set: PbrTextureSet): void {
  set.map.dispose();
  set.normalMap.dispose();
  set.roughnessMap.dispose();
  set.aoMap.dispose();
}
