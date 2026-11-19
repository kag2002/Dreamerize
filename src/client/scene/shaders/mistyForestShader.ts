import * as THREE from 'three';

function resolveSunDir(sunDirection?: [number, number, number] | THREE.Vector3): THREE.Vector3 {
  if (sunDirection instanceof THREE.Vector3) {
    return sunDirection.clone().normalize();
  }
  if (Array.isArray(sunDirection)) {
    return new THREE.Vector3(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
  }
  return new THREE.Vector3(58, 30, -54).normalize();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
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

function hash2i(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

function tileFbm(u: number, v: number, basePeriod: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(u, v, period, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

function tileNoiseAniso(
  u: number,
  v: number,
  periodX: number,
  periodY: number,
  seed: number
): number {
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
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

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
    sum += amp * tileNoiseAniso(u, v, px, py, seed + o * 131);
    norm += amp;
    amp *= 0.5;
    px *= 2;
    py *= 2;
  }
  return sum / norm;
}

/**
 * Generates a seamless 512x512 furrowed conifer pine bark PBR texture set
 * (deep vertical resinous fissures, warm russet-cinnamon scaly bark plates,
 * subtle emerald lichen flecks, and crisp normal/roughness/AO maps).
 */
export function createPineBarkPbrTextures(options: {
  size?: number;
  seed?: number;
  renderer?: THREE.WebGLRenderer;
  repeatX?: number;
  repeatY?: number;
  normalStrength?: number;
} = {}): {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  aoMap: THREE.DataTexture;
} {
  const size = options.size ?? 512;
  const seed = options.seed ?? 6421;
  const repeatX = options.repeatX ?? 3;
  const repeatY = options.repeatY ?? 5;
  const normalStrength = options.normalStrength ?? 3.5;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughData = new Uint8Array(size * size * 4);
  const aoData = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = tileFbmAniso(u, v, 6, 3, 3, seed + 17) - 0.5;
      const furrowField = tileFbmAniso(u + warp * 0.06, v, 14, 3, 4, seed + 53);
      const plateDetail = tileFbmAniso(u + warp * 0.04, v, 24, 6, 3, seed + 149);
      const microGrain = tileNoiseAniso(u, v, 64, 24, seed + 283);

      // Deep vertical fissures between plated pine bark scales
      const groove = clamp01(1.0 - Math.abs(furrowField * 2.0 - 1.0) * 3.1);
      const scaleCrack = clamp01(1.0 - Math.abs(plateDetail * 2.0 - 1.0) * 3.8) * 0.55;
      const crevice = clamp01(groove * 0.78 + scaleCrack * 0.42);

      const h = clamp01(0.68 - crevice * 0.56 + (plateDetail - 0.5) * 0.22 + (microGrain - 0.5) * 0.10);

      // Warm russet-cinnamon pine bark plates -> dark resinous umber fissures
      const plateTone = 0.78 + plateDetail * 0.34 + (microGrain - 0.5) * 0.18;
      let r = 132 * plateTone * (1.0 - crevice * 0.66) + 26 * crevice;
      let g = 82 * plateTone * (1.0 - crevice * 0.68) + 18 * crevice;
      let b = 54 * plateTone * (1.0 - crevice * 0.70) + 14 * crevice;

      // Subtle forest moss/lichen flecks in shaded bark fissures
      const lichen = clamp01((tileFbm(u, v, 10, 3, seed + 509) - 0.56) * 2.6) * (0.25 + 0.75 * crevice);
      r = r * (1 - lichen * 0.42) + 64 * lichen * 0.42;
      g = g * (1 - lichen * 0.42) + 92 * lichen * 0.42;
      b = b * (1 - lichen * 0.42) + 46 * lichen * 0.42;

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      const rVal = clampByte(clamp01(0.78 + crevice * 0.16 + (1.0 - plateDetail) * 0.08) * 255);
      roughData[cIdx] = rVal;
      roughData[cIdx + 1] = rVal;
      roughData[cIdx + 2] = rVal;
      roughData[cIdx + 3] = 255;

      const aVal = clampByte(clamp01(0.32 + 0.68 * (1.0 - crevice * 0.85)) * 255);
      aoData[cIdx] = aVal;
      aoData[cIdx + 1] = aVal;
      aoData[cIdx + 2] = aVal;
      aoData[cIdx + 3] = 255;
    }
  }

  const normData = new Uint8Array(size * size * 4);
  const mask = size - 1;
  const sampleH = (xx: number, yy: number) => height[((yy & mask) * size) + (xx & mask)];
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
      let nx = -((tr + 2 * r + br) - (tl + 2 * l + bl)) * normalStrength;
      let ny = -((bl + 2 * b + br) - (tl + 2 * t + tr)) * normalStrength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const idx = (y * size + x) * 4;
      normData[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      normData[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normData[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;
    }
  }

  const makeTex = (buf: Uint8Array, isColor: boolean) => {
    const tex = new THREE.DataTexture(buf, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = anisotropy;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    initTextureSafe(options.renderer, tex);
    return tex;
  };

  return {
    map: makeTex(albedo, true),
    normalMap: makeTex(normData, false),
    roughnessMap: makeTex(roughData, false),
    aoMap: makeTex(aoData, false)
  };
}

/**
 * Generates a seamless 512x512 organic weathered mountain granite / river-boulder PBR texture set
 * (natural mineral grain, hairline rock fractures, subtle lichen/moss flecks — zero rectangular masonry grid).
 */
export function createRiverGranitePbrTextures(options: {
  size?: number;
  seed?: number;
  renderer?: THREE.WebGLRenderer;
  repeatX?: number;
  repeatY?: number;
  normalStrength?: number;
} = {}): {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  aoMap: THREE.DataTexture;
} {
  const size = options.size ?? 512;
  const seed = options.seed ?? 8123;
  const repeatX = options.repeatX ?? 4;
  const repeatY = options.repeatY ?? 4;
  const normalStrength = options.normalStrength ?? 3.1;
  const anisotropy = getSafeAnisotropy(options.renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughData = new Uint8Array(size * size * 4);
  const aoData = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = tileFbm(u, v, 6, 4, seed + 11);
      const strata = tileFbm(u * 0.8 + macro * 0.06, v * 1.4, 12, 3, seed + 73);
      const speck = tileFbm(u, v, 36, 3, seed + 193);
      const micro = tileNoise(u, v, 96, seed + 317);

      // Crisp hairline rock fractures
      const fRaw = tileFbm(u + macro * 0.05, v - macro * 0.05, 10, 3, seed + 421);
      const crack = Math.max(0, 1.0 - Math.abs(fRaw * 2.0 - 1.0) * 8.5);

      const h = clamp01(0.36 + macro * 0.28 + strata * 0.18 + (speck - 0.5) * 0.18 + (micro - 0.5) * 0.08 - crack * 0.30);

      // Natural mountain granite: cool grey + quartz/feldspar crystals + dark biotite speckles
      const quartz = speck > 0.60 ? (speck - 0.60) * 1.65 : 0;
      const biotite = speck < 0.36 ? (0.36 - speck) * 1.65 : 0;
      const tone = 0.74 + strata * 0.32 + (micro - 0.5) * 0.22 - crack * 0.42;

      let r = 132 * tone + quartz * 56 - biotite * 52;
      let g = 134 * tone + quartz * 54 - biotite * 50;
      let b = 128 * tone + quartz * 46 - biotite * 46;

      // Subtle high-frequency moss/lichen flecks in cracks
      const lichen = clamp01((tileFbm(u, v, 14, 3, seed + 613) - 0.58) * 2.8) * (0.35 + 0.65 * crack);
      r = r * (1 - lichen * 0.48) + 72 * lichen * 0.48;
      g = g * (1 - lichen * 0.48) + 94 * lichen * 0.48;
      b = b * (1 - lichen * 0.48) + 50 * lichen * 0.48;

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      const rVal = clampByte(clamp01(0.68 + crack * 0.24 + (1.0 - speck) * 0.14) * 255);
      roughData[cIdx] = rVal;
      roughData[cIdx + 1] = rVal;
      roughData[cIdx + 2] = rVal;
      roughData[cIdx + 3] = 255;

      const aVal = clampByte(clamp01(0.45 + 0.55 * (1.0 - crack) * (0.7 + 0.3 * macro)) * 255);
      aoData[cIdx] = aVal;
      aoData[cIdx + 1] = aVal;
      aoData[cIdx + 2] = aVal;
      aoData[cIdx + 3] = 255;
    }
  }

  const normData = new Uint8Array(size * size * 4);
  const mask = size - 1;
  const sampleH = (xx: number, yy: number) => height[((yy & mask) * size) + (xx & mask)];
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
      let nx = -((tr + 2 * r + br) - (tl + 2 * l + bl)) * normalStrength;
      let ny = -((bl + 2 * b + br) - (tl + 2 * t + tr)) * normalStrength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const idx = (y * size + x) * 4;
      normData[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      normData[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normData[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normData[idx + 3] = 255;
    }
  }

  const makeTex = (buf: Uint8Array, isColor: boolean) => {
    const tex = new THREE.DataTexture(buf, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = anisotropy;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    initTextureSafe(options.renderer, tex);
    return tex;
  };

  return {
    map: makeTex(albedo, true),
    normalMap: makeTex(normData, false),
    roughnessMap: makeTex(roughData, false),
    aoMap: makeTex(aoData, false)
  };
}

/**
 * Analytical woodland stepping-stone trail centerline x = trailX(z),
 * winding from the spawn clearing (-4, 14) to the Rustic Footbridge (z = -6)
 * and continuing across the far mossy glade.
 */
export function getMistyTrailCenterX(z: number): number {
  // Smooth blend from spawn (-4 at z=14) -> west bridge bank (~ -2.6 at z=-6) -> far glade
  const streamX = Math.sin(z * 0.055) * 8.0;
  const westApproach = -4.2 + Math.sin((z - 14.0) * 0.14) * 1.1;
  if (z >= -2.5) {
    const t = clamp01((z + 2.5) / 8.0);
    const bridgeWest = Math.sin(-6.0 * 0.055) * 8.0 - 4.8;
    return bridgeWest * (1.0 - t) + westApproach * t;
  }
  if (z <= -9.5) {
    const bridgeEast = Math.sin(-6.0 * 0.055) * 8.0 + 4.8;
    const t = clamp01((-9.5 - z) / 14.0);
    return bridgeEast + Math.sin(t * 1.4) * 2.4;
  }
  return streamX;
}

/**
 * Generates a crisp 512x512 alpha-tested botanical pine/spruce conifer bough card texture
 * with central woody twig, lateral sub-twigs, hundreds of fine radiating conifer needles,
 * and RGB alpha color-bleeding to prevent dark mipmap fringes.
 */
export function createConiferBoughAtlasTexture(
  renderer?: THREE.WebGLRenderer,
  size = 512
): THREE.Texture {
  const anisotropy = getSafeAnisotropy(renderer);

  if (typeof document === 'undefined') {
    const s = 64;
    const data = new Uint8Array(s * s * 4);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s - 0.5;
        const v = y / s;
        const width = Math.sin(Math.pow(v, 0.72) * Math.PI) * 0.44;
        const notch = 0.85 + 0.15 * Math.sin(v * 24.0);
        const inside = Math.abs(u) < width * notch && v > 0.04 && v < 0.96;
        const idx = (y * s + x) * 4;
        const tipT = clamp01(1.0 - v);
        data[idx] = clampByte(24 + tipT * 52);
        data[idx + 1] = clampByte(62 + tipT * 74);
        data[idx + 2] = clampByte(26 + tipT * 20);
        data[idx + 3] = inside ? 255 : 0;
      }
    }
    const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
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

  let seed = 41723;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Draw an airy, feathery conifer needle spray along a woody shoot with clear needle-tip silhouettes
  const drawNeedleShoot = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    needleCount: number,
    needleLen: number,
    coreDarkness: number,
    tipWarmth: number
  ) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const baseAngle = Math.atan2(dy, dx);

    // Woody twig spine
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = Math.max(1.6, size * 0.0082);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2516';
    ctx.stroke();

    for (let i = 0; i < needleCount; i++) {
      const t = i / Math.max(1, needleCount - 1);
      const sx = x0 + dx * t;
      const sy = y0 + dy * t;
      const side = i % 2 === 0 ? 1 : -1;
      const splay = (0.34 + rand() * 0.50) * side;
      const ang = baseAngle + splay + (rand() - 0.5) * 0.14;
      const taper = 0.56 + 0.52 * Math.sin(t * Math.PI * 0.88 + 0.15);
      const len = needleLen * taper * (0.78 + rand() * 0.40);

      const ex = sx + Math.cos(ang) * len;
      const ey = sy + Math.sin(ang) * len;
      const mx = sx + Math.cos(ang) * len * 0.55;
      const my = sy + Math.sin(ang) * len * 0.55 - len * 0.04;

      // Dark interior pine core -> rich spruce mid -> warm sunlit outer needle tips
      const outerT = clamp01(t * 0.65 + (1.0 - Math.abs(splay) * 0.25) * 0.35);
      const rBase = clampByte((16 + rand() * 10) * coreDarkness);
      const gBase = clampByte((44 + rand() * 14) * coreDarkness);
      const bBase = clampByte((20 + rand() * 10) * coreDarkness);
      const rTip = clampByte((54 + outerT * 62 * tipWarmth + rand() * 18));
      const gTip = clampByte((108 + outerT * 66 * tipWarmth + rand() * 20));
      const bTip = clampByte((32 + outerT * 20 + rand() * 10));

      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0.0, `rgb(${rBase}, ${gBase}, ${bBase})`);
      grad.addColorStop(
        0.58,
        `rgb(${clampByte((rBase + rTip) * 0.5)}, ${clampByte((gBase + gTip) * 0.5)}, ${clampByte((bBase + bTip) * 0.5)})`
      );
      grad.addColorStop(1.0, `rgb(${rTip}, ${gTip}, ${bTip})`);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.lineWidth = Math.max(1.25, size * (0.0036 + rand() * 0.0020));
      ctx.strokeStyle = grad;
      ctx.stroke();
    }
  };

  // Fan-shaped layered conifer bough shoots (open sky gaps between lateral sprays, tapering cleanly to tip)
  const shoots: Array<[number, number, number, number, number, number, number, number]> = [
    // Deep interior central woody spine + shaded inner lateral shoots
    [0.50, 0.96, 0.50, 0.07, 92, 0.145, 0.72, 0.85],
    [0.50, 0.86, 0.16, 0.64, 62, 0.120, 0.70, 0.82],
    [0.50, 0.85, 0.84, 0.62, 62, 0.120, 0.70, 0.82],
    [0.50, 0.70, 0.11, 0.42, 60, 0.115, 0.78, 0.92],
    [0.50, 0.68, 0.89, 0.40, 60, 0.115, 0.78, 0.92],
    [0.50, 0.52, 0.16, 0.24, 54, 0.105, 0.86, 1.00],
    [0.50, 0.50, 0.84, 0.22, 54, 0.105, 0.86, 1.00],
    [0.50, 0.34, 0.27, 0.12, 42, 0.095, 0.94, 1.08],
    [0.50, 0.32, 0.73, 0.12, 42, 0.095, 0.94, 1.08],
    // Secondary forked twiglets with clear airy separation
    [0.34, 0.76, 0.18, 0.78, 34, 0.090, 0.76, 0.86],
    [0.66, 0.74, 0.82, 0.76, 34, 0.090, 0.76, 0.86],
    [0.31, 0.57, 0.12, 0.56, 36, 0.092, 0.84, 0.96],
    [0.69, 0.55, 0.88, 0.54, 36, 0.092, 0.84, 0.96],
    [0.35, 0.39, 0.20, 0.32, 32, 0.088, 0.92, 1.04],
    [0.65, 0.37, 0.80, 0.30, 32, 0.088, 0.92, 1.04],
    // Sunlit upper crown needles
    [0.50, 0.88, 0.50, 0.05, 76, 0.132, 0.92, 1.15],
    [0.50, 0.64, 0.23, 0.34, 48, 0.105, 0.96, 1.16],
    [0.50, 0.62, 0.77, 0.32, 48, 0.105, 0.96, 1.16]
  ];

  for (const [x0, y0, x1, y1, cnt, len, coreDark, tipWarm] of shoots) {
    drawNeedleShoot(x0 * size, y0 * size, x1 * size, y1 * size, cnt, len * size, coreDark, tipWarm);
  }

  // RGB color-bleed into alpha=0 pixels so mipmaps never create dark halos
  const imgData = ctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 20) {
      px[i] = 32;
      px[i + 1] = 74;
      px[i + 2] = 30;
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
 * Generates a crisp 512x512 alpha-tested pinnate botanical fern frond texture.
 */
export function createFernFrondAtlasTexture(
  renderer?: THREE.WebGLRenderer,
  size = 512
): THREE.Texture {
  const anisotropy = getSafeAnisotropy(renderer);

  if (typeof document === 'undefined') {
    const s = 64;
    const data = new Uint8Array(s * s * 4);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = Math.abs(x / s - 0.5) * 2.0;
        const v = y / s;
        const taper = Math.sin(Math.pow(v, 0.7) * Math.PI);
        const inside = u < taper * 0.9 && v > 0.03;
        const idx = (y * s + x) * 4;
        data[idx] = 52;
        data[idx + 1] = 116;
        data[idx + 2] = 40;
        data[idx + 3] = inside ? 255 : 0;
      }
    }
    const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
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

  // Central rachis stem (bottom y=size*0.97 -> top y=size*0.03)
  const stemGrad = ctx.createLinearGradient(0, size * 0.97, 0, size * 0.03);
  stemGrad.addColorStop(0.0, '#3e5420');
  stemGrad.addColorStop(0.5, '#597f2c');
  stemGrad.addColorStop(1.0, '#80aa3a');
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.97);
  ctx.lineTo(size * 0.5, size * 0.03);
  ctx.lineWidth = Math.max(2.5, size * 0.013);
  ctx.lineCap = 'round';
  ctx.strokeStyle = stemGrad;
  ctx.stroke();

  const pairs = 20;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.6) / (pairs + 0.5); // 0 at base -> 1 at apex
    const yBase = size * (0.94 - t * 0.89);
    const envelope = Math.sin(Math.pow(t, 0.65) * Math.PI) * (0.42 + 0.58 * (1 - t * 0.42));
    const pinnaLen = size * 0.43 * envelope;
    const pinnaWidth = size * (0.014 * (1 - t * 0.45) + 0.0055);

    for (const side of [-1, 1]) {
      const yAnchor = yBase + (side > 0 ? -size * 0.011 : 0);
      // Fan outward and slightly upward toward frond apex (-Y in Canvas2D)
      const tilt = side * (1.22 - t * 0.42);

      ctx.save();
      ctx.translate(size * 0.5, yAnchor);
      ctx.rotate(tilt);

      // Tapered serrated pinna leaflet pointing along -Y in rotated frame
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const lobes = 5;
      for (let k = 1; k <= lobes; k++) {
        const kt = k / lobes;
        const w = pinnaWidth * Math.sin(kt * Math.PI * 0.90 + 0.14) * (1.0 + 0.18 * Math.sin(kt * lobes * Math.PI * 2));
        ctx.lineTo(-w, -pinnaLen * kt);
      }
      ctx.lineTo(0, -pinnaLen * 1.04);
      for (let k = lobes; k >= 1; k--) {
        const kt = k / lobes;
        const w = pinnaWidth * Math.sin(kt * Math.PI * 0.90 + 0.14) * (1.0 + 0.18 * Math.sin(kt * lobes * Math.PI * 2 + 0.8));
        ctx.lineTo(w, -pinnaLen * kt);
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, -pinnaLen);
      const gR = clampByte(42 + t * 44);
      const gG = clampByte(96 + t * 56);
      const gB = clampByte(24 + t * 20);
      const tR = clampByte(88 + t * 54);
      const tG = clampByte(152 + t * 48);
      const tB = clampByte(42 + t * 22);
      grad.addColorStop(0.0, `rgb(${gR}, ${gG}, ${gB})`);
      grad.addColorStop(1.0, `rgb(${tR}, ${tG}, ${tB})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle central leaflet vein
      ctx.beginPath();
      ctx.moveTo(0, -pinnaLen * 0.05);
      ctx.lineTo(0, -pinnaLen * 0.90);
      ctx.lineWidth = Math.max(0.9, size * 0.0025);
      ctx.strokeStyle = `rgba(${clampByte(tR * 1.15)}, ${clampByte(tG * 1.1)}, ${clampByte(tB * 1.1)}, 0.58)`;
      ctx.stroke();

      ctx.restore();
    }
  }

  // Color-bleed RGB into alpha=0 pixels
  const imgData = ctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 20) {
      px[i] = 48;
      px[i + 1] = 104;
      px[i + 2] = 36;
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
 * Generates a tileable 256x256 organic micro-detail DataTexture encoding pine needle litter,
 * damp earth grit, and moss tuft fibers (multi-octave tileable FBM with zero periodic striping).
 */
export function createForestFloorDetailTexture(
  renderer?: THREE.WebGLRenderer,
  size = 256
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = (y * size + x) * 4;
      const fbmA = tileFbm(u, v, 8, 3, 1901);
      const fbmB = tileFbm(u + 0.31, v + 0.67, 16, 3, 2837);
      const needleScatter = tileNoise(u + fbmA * 0.08, v * 0.6 + fbmB * 0.08, 32, 3917);
      const mossTuft = tileFbm(u, v, 12, 3, 5113);
      const grit = tileNoise(u, v, 64, 7211);

      const needleMask = clamp01(needleScatter * 0.55 + fbmB * 0.45);
      const mossMask = clamp01(mossTuft * 0.68 + grit * 0.32);
      const bump = clamp01(0.28 + fbmA * 0.30 + fbmB * 0.24 + grit * 0.18);

      data[idx] = clampByte(needleMask * 255);
      data[idx + 1] = clampByte(mossMask * 255);
      data[idx + 2] = clampByte(grit * 255);
      data[idx + 3] = clampByte(bump * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  initTextureSafe(renderer, tex);
  return tex;
}

/**
 * Upgraded Mountain Brook & Waterfall Plunge Pool shader:
 * - Multi-octave animated wave normals flowing downstream
 * - Fresnel sky + pine-canopy reflection & crisp golden sun glints
 * - Refracted stony riverbed pebble tint in shallow margins
 * - Whitewater foam collars wrapping around in-stream river boulders & waterfall plunge pool
 */
export function createForestWaterMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  horizonColor: string | THREE.Color;
  skyTopColor: string | THREE.Color;
  streamBoulders: THREE.Vector4[];
  riverIsland: THREE.Vector4;
}>): THREE.ShaderMaterial {
  const boulderSlots: THREE.Vector4[] = [];
  const provided = customUniforms?.streamBoulders ?? [];
  for (let i = 0; i < 16; i++) {
    boulderSlots.push(
      i < provided.length ? provided[i].clone() : new THREE.Vector4(9999, 9999, 0.0, 0.0)
    );
  }

  const custom = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uSkyTopColor: {
      value: customUniforms?.skyTopColor instanceof THREE.Color
        ? customUniforms.skyTopColor
        : new THREE.Color(customUniforms?.skyTopColor ?? '#3b82b6')
    },
    uHorizonColor: {
      value: customUniforms?.horizonColor instanceof THREE.Color
        ? customUniforms.horizonColor
        : new THREE.Color(customUniforms?.horizonColor ?? '#e6f2ec')
    },
    uRiverIsland: {
      value: customUniforms?.riverIsland
        ? customUniforms.riverIsland.clone()
        : new THREE.Vector4(9999, 9999, 1.0, 1.0)
    }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  uniforms.uStreamBoulders = { value: boulderSlots };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 p = position;
        float bankMask = 1.0 - smoothstep(0.52, 1.0, abs(uv.x - 0.5) * 2.0);
        p.y += (sin(p.x * 1.1 + p.z * 0.4 + uTime * 2.4) * 0.024
              + cos(p.z * 0.85 - uTime * 2.1) * 0.022) * (0.35 + 0.65 * bankMask);
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uSkyTopColor;
      uniform vec3 uHorizonColor;
      uniform vec4 uRiverIsland;
      uniform vec4 uStreamBoulders[16];
      varying vec3 vWorldPos;
      varying vec2 vUv;

      float wHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.31);
        return fract(p.x * p.y);
      }

      float wNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
          mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float wFbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * wNoise(p);
          p = p * 2.07 + vec2(7.3, 13.1);
          a *= 0.5;
        }
        return v;
      }

      float waterHeight(vec2 xz, float t) {
        float w1 = wFbm(xz * 0.85 + vec2(0.0, -t * 1.05));
        float w2 = wNoise(xz * 2.15 + vec2(t * 0.22, -t * 1.65));
        float w3 = wNoise(xz * 4.4 - vec2(t * 0.31, t * 2.15));
        return w1 * 0.52 + w2 * 0.32 + w3 * 0.16;
      }

      void main() {
        vec2 xz = vWorldPos.xz;
        float camDist = length(cameraPosition - vWorldPos);
        float nearAtten = 1.0 - smoothstep(22.0, 110.0, camDist);

        // Analytical finite-difference wave normal
        float eps = 0.09;
        float hC = waterHeight(xz, uTime);
        float hX = waterHeight(xz + vec2(eps, 0.0), uTime);
        float hZ = waterHeight(xz + vec2(0.0, eps), uTime);
        float nStrength = mix(0.28, 0.65, nearAtten);
        vec3 N = normalize(vec3((hC - hX) / eps * nStrength, 1.0, (hC - hZ) / eps * nStrength));

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDirection);

        float NdotV = max(dot(N, V), 0.0);
        float fresnel = 0.03 + 0.97 * pow(1.0 - NdotV, 4.2);

        float bankFactor = abs(vUv.x - 0.5) * 2.0;

        // Stony riverbed refraction look-up perturbed by wave normal
        vec2 refractXz = xz + N.xz * 0.32;
        float bedStones = wNoise(refractXz * 3.8) * 0.6 + wNoise(refractXz * 8.5) * 0.4;
        float bedCaustic = smoothstep(0.62, 0.90, wNoise(refractXz * 2.6 + vec2(uTime * 0.25, -uTime * 0.45)));
        vec3 stonyBed = mix(vec3(0.045, 0.075, 0.068), vec3(0.16, 0.20, 0.16), bedStones);
        stonyBed += vec3(0.14, 0.22, 0.16) * bedCaustic * nearAtten * 0.55;

        // Linear-calibrated mountain brook water absorption
        vec3 deepBrook = vec3(0.015, 0.105, 0.115);
        vec3 shallowEmerald = vec3(0.045, 0.22, 0.19);
        vec3 col = mix(deepBrook, shallowEmerald, hC * 0.65 + smoothstep(0.30, 0.85, bankFactor) * 0.45);
        float bedVis = smoothstep(0.32, 0.92, bankFactor) * 0.62 + (1.0 - smoothstep(0.0, 0.4, bankFactor)) * 0.22;
        col = mix(col, stonyBed, bedVis * 0.65);

        // Fresnel sky + dark pine canopy reflection
        vec3 reflDir = reflect(-V, N);
        float canopyMask = smoothstep(0.02, 0.34, reflDir.y);
        vec3 pineCanopyRefl = vec3(0.022, 0.065, 0.036);
        vec3 skyReflect = mix(uHorizonColor * 0.55, uSkyTopColor * 0.72, clamp(reflDir.y * 1.4, 0.0, 1.0));
        vec3 envRefl = mix(pineCanopyRefl, skyReflect, canopyMask);
        col = mix(col, envRefl, clamp(fresnel * 0.76, 0.0, 0.78));

        // Boulder wake & whitewater foam streaks trailing downstream around in-stream boulders
        float boulderFoam = 0.0;
        for (int i = 0; i < 16; i++) {
          vec4 b = uStreamBoulders[i];
          if (b.w > 0.5) {
            vec2 diff = xz - b.xy;
            float dsFactor = diff.y > 0.0 ? 0.34 : 1.25;
            vec2 wDiff = vec2(diff.x * 1.15, diff.y * dsFactor);
            float d = length(wDiff);
            float collar = (1.0 - smoothstep(b.z * 0.85, b.z * 1.65, d)) * smoothstep(b.z * 0.55, b.z * 0.88, d);
            float churn = smoothstep(0.36, 0.78, wNoise(xz * 5.2 + vec2(0.0, -uTime * 2.5)));
            boulderFoam = max(boulderFoam, collar * churn * 0.72);
          }
        }

        // Rocky island shoreline whitewater collar & downstream wake
        vec2 islDiff = (xz - uRiverIsland.xy) / max(uRiverIsland.zw, vec2(0.5));
        float islDist = length(islDiff);
        float islCollar = (1.0 - smoothstep(0.92, 1.38, islDist)) * smoothstep(0.75, 0.96, islDist);
        float islChurn = smoothstep(0.34, 0.76, wNoise(xz * 4.2 + vec2(0.0, -uTime * 2.1)));
        boulderFoam = max(boulderFoam, islCollar * islChurn * 0.82);

        float foamNoise = wFbm(xz * 1.9 + vec2(0.0, -uTime * 1.4));
        float plungeDist = smoothstep(-74.0, -94.0, vWorldPos.z);
        float plungeRipples = sin(length(xz - vec2(sin(-95.0 * 0.055) * 8.0, -95.0)) * 2.8 - uTime * 4.2) * 0.5 + 0.5;
        float plungeFoam = plungeDist * (0.65 + 0.35 * plungeRipples);
        float shoreFoam = smoothstep(0.64, 0.93, bankFactor + (foamNoise - 0.5) * 0.28);
        float riffle = smoothstep(0.66, 0.88, hC * 0.65 + foamNoise * 0.35);
        float foam = clamp(
          max(boulderFoam * 0.92, shoreFoam * 0.52 + plungeFoam * (0.55 + 0.45 * riffle) + riffle * shoreFoam * 0.40),
          0.0,
          0.96
        );
        col = mix(col, vec3(0.86, 0.94, 0.96), foam * 0.84);

        // Golden morning sun specular & crisp water sparkles
        vec3 H = normalize(L + V);
        float sunSpec = pow(max(dot(N, H), 0.0), 110.0) * 1.55 + pow(max(dot(N, H), 0.0), 20.0) * 0.16;
        float glint = smoothstep(0.82, 0.96, wNoise(xz * 3.5 + vec2(uTime * 0.7, -uTime * 1.1))) * nearAtten;
        col += vec3(1.15, 0.98, 0.72) * (sunSpec + glint * 0.32) * (1.0 - foam * 0.65);

        float alpha = (0.76 + foam * 0.22) * (1.0 - smoothstep(0.84, 1.0, bankFactor));
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    fog: true
  });
}

export interface PineTrunkWindUniforms {
  uTime: { value: number };
  uWindSpeed: { value: number };
  uWindStrength: { value: number };
  uAudioBass: { value: number };
}

/**
 * Injects Tier-1 harmonic trunk flex + subtle Tier-2 limb-tip bounce onto a PBR pine trunk material,
 * synchronized in world space with `createConiferBoughMaterial`.
 */
export function applyPineTrunkWindShader(
  material: THREE.MeshStandardMaterial,
  uniforms: PineTrunkWindUniforms,
  cacheKey = 'misty-pine-trunk-wind-v1'
): void {
  const prevCompile = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')
    ? material.onBeforeCompile.bind(material)
    : null;
  const prevCacheKey = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')
    ? material.customProgramCacheKey.bind(material)
    : null;

  material.customProgramCacheKey = () =>
    prevCacheKey ? `${prevCacheKey()}|${cacheKey}` : cacheKey;

  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) {
      prevCompile(shader, renderer);
    }

    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uAudioBass = uniforms.uAudioBass;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uWindStrength;
        uniform float uAudioBass;
        attribute vec4 aTreeData;
        attribute float aLimbFlex;`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 trunkLocal = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          trunkLocal = batchingMatrix * trunkLocal;
        #endif
        #ifdef USE_INSTANCING
          trunkLocal = instanceMatrix * trunkLocal;
        #endif
        vec4 trunkWorld = modelMatrix * trunkLocal;
        float tHNorm = clamp(position.y / 10.5, 0.0, 1.0);
        float tW1 = sin(uTime * (0.72 + uWindSpeed * 0.42) + aTreeData.w);
        float tW2 = cos(uTime * (0.46 + uWindSpeed * 0.24) + aTreeData.w * 1.37);
        float tAmp = (tHNorm * tHNorm) * 0.30 * uWindStrength * (1.0 + uAudioBass * 0.25) * (0.72 + 0.28 * aTreeData.z);
        trunkWorld.x += (tW1 * 0.82 + tW2 * 0.30) * tAmp;
        trunkWorld.z += (tW2 * 0.56 - tW1 * 0.22) * tAmp;
        float lWave = sin(uTime * (1.85 + uWindSpeed * 0.82) + aTreeData.w * 0.7 + position.x * 1.7 + position.z * 1.3);
        trunkWorld.y += lWave * 0.038 * uWindStrength * aLimbFlex * aLimbFlex;
        vec4 mvPosition = viewMatrix * trunkWorld;
        gl_Position = projectionMatrix * mvPosition;`
      );
  };
}

export interface ConiferBoughMaterialHandle {
  material: THREE.MeshStandardMaterial;
  depthMaterial: THREE.MeshDepthMaterial;
  uniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uWindStrength: { value: number };
    uAudioBass: { value: number };
    uAudioTreble: { value: number };
    uSunDirection: { value: THREE.Vector3 };
  };
}

/**
 * Alpha-tested Conifer Bough Card PBR material (`MeshStandardMaterial` + `onBeforeCompile`)
 * with 3-tier harmonic wind sway (trunk flex + bough bounce + needle flutter),
 * dark interior core -> warm sunlit outer needle tips, backlit SSS translucency,
 * and synchronized shadow-casting depth material.
 */
export function createConiferBoughMaterial(
  coniferAtlas: THREE.Texture,
  customUniforms?: Partial<{
    windSpeed: number;
    windStrength: number;
    sunDirection: [number, number, number] | THREE.Vector3;
  }>
): ConiferBoughMaterialHandle {
  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.8 },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.55 },
    uAudioBass: { value: 0.0 },
    uAudioTreble: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };

  const material = new THREE.MeshStandardMaterial({
    map: coniferAtlas,
    alphaTest: 0.44,
    side: THREE.DoubleSide,
    roughness: 0.76,
    metalness: 0.0
  });

  const windCommonDecl = /* glsl */ `
    uniform float uTime;
    uniform float uWindSpeed;
    uniform float uWindStrength;
    uniform float uAudioBass;
    uniform float uAudioTreble;
    attribute vec4 aTreeData;
    attribute vec4 aBoughData;
  `;

  const apply3TierSwayChunk = /* glsl */ `
    vec4 boughLocal = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      boughLocal = batchingMatrix * boughLocal;
    #endif
    #ifdef USE_INSTANCING
      boughLocal = instanceMatrix * boughLocal;
    #endif
    vec4 boughWorld = modelMatrix * boughLocal;

    #ifdef USE_UV
      vec2 bUv = uv;
    #else
      vec2 bUv = vec2(0.5, 0.5);
    #endif

    float bFlex = clamp(bUv.y, 0.0, 1.0);
    // Tier 1: Whole-tree trunk flex synchronized exactly with InstancedPineTrunks
    float bHNorm = clamp(aBoughData.x + bFlex * 0.05, 0.0, 1.0);
    float tW1 = sin(uTime * (0.72 + uWindSpeed * 0.42) + aTreeData.w);
    float tW2 = cos(uTime * (0.46 + uWindSpeed * 0.24) + aTreeData.w * 1.37);
    float tAmp = (bHNorm * bHNorm) * 0.30 * uWindStrength * (1.0 + uAudioBass * 0.25) * (0.72 + 0.28 * aTreeData.z);
    boughWorld.x += (tW1 * 0.82 + tW2 * 0.30) * tAmp;
    boughWorld.z += (tW2 * 0.56 - tW1 * 0.22) * tAmp;

    // Tier 2: Radial whorled bough bounce (vertical & lateral spring)
    float bWave = sin(uTime * (1.85 + uWindSpeed * 0.82) + aBoughData.w + aTreeData.w * 0.7);
    float bAmp = (0.042 + 0.068 * aBoughData.y) * uWindStrength * bFlex * bFlex;
    boughWorld.y += bWave * bAmp * 0.78;
    boughWorld.x += cos(uTime * (1.45 + uWindSpeed * 0.65) + aBoughData.w) * bAmp * 0.42;
    boughWorld.z += bWave * bAmp * 0.36;

    // Tier 3: High-frequency needle-tip flutter
    float nEdge = clamp(abs(bUv.x - 0.5) * 2.0, 0.0, 1.0);
    float nMask = smoothstep(0.28, 1.0, bFlex) * (0.40 + 0.60 * nEdge);
    float nFlut = sin(uTime * (4.6 + uWindSpeed * 2.05) + boughWorld.x * 2.9 + boughWorld.z * 2.5 + aBoughData.w * 2.1);
    boughWorld.xyz += vec3(nFlut * 0.52, cos(nFlut * 1.65) * 0.38, -nFlut * 0.42) * (0.024 * uWindStrength * (1.0 + uAudioTreble * 0.45) * nMask);

    vec4 mvPosition = viewMatrix * boughWorld;
    gl_Position = projectionMatrix * mvPosition;
  `;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uAudioBass = uniforms.uAudioBass;
    shader.uniforms.uAudioTreble = uniforms.uAudioTreble;
    shader.uniforms.uSunDirection = uniforms.uSunDirection;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        ${windCommonDecl}
        varying vec3 vBoughWorldPos;
        varying vec3 vBoughWorldNormal;
        varying float vTipMask;
        varying float vCoreReach;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        #ifdef USE_INSTANCING
          vBoughWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);
        #else
          vBoughWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
        #endif`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTipMask = clamp(uv.y, 0.0, 1.0);
        vCoreReach = clamp(aBoughData.y, 0.0, 1.0);`
      )
      .replace(
        '#include <project_vertex>',
        `${apply3TierSwayChunk}
        vBoughWorldPos = boughWorld.xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDirection;
        varying vec3 vBoughWorldPos;
        varying vec3 vBoughWorldNormal;
        varying float vTipMask;
        varying float vCoreReach;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Dark interior crown core -> warm sunlit outer needle tips
        float radialLit = clamp(vTipMask * 0.72 + vCoreReach * 0.28, 0.0, 1.0);
        float coreOcc = mix(0.46, 1.18, smoothstep(0.08, 0.90, radialLit));
        vec3 tipWarmth = mix(vec3(0.76, 0.90, 0.84), vec3(1.20, 1.10, 0.66), pow(vTipMask, 1.45));
        diffuseColor.rgb *= coreOcc * tipWarmth;`
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 bViewDir = normalize(cameraPosition - vBoughWorldPos);
        vec3 bSunDir = normalize(uSunDirection);
        float bBacklit = pow(clamp(dot(bViewDir, -bSunDir), 0.0, 1.0), 2.0);
        float bTopSun = clamp(dot(normalize(vBoughWorldNormal), bSunDir) * 0.5 + 0.5, 0.0, 1.0);
        // Backlit subsurface needle translucency (golden-emerald pine tip glow)
        outgoingLight += diffuseColor.rgb * (bBacklit * 0.85 + bTopSun * 0.22) * (0.28 + 0.72 * vTipMask) * vec3(1.22, 1.26, 0.52);
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => 'misty-conifer-bough-v2';

  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: coniferAtlas,
    alphaTest: 0.44,
    side: THREE.DoubleSide
  });
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uAudioBass = uniforms.uAudioBass;
    shader.uniforms.uAudioTreble = uniforms.uAudioTreble;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${windCommonDecl}`)
      .replace('#include <project_vertex>', apply3TierSwayChunk);
  };
  depthMaterial.customProgramCacheKey = () => 'misty-conifer-bough-depth-v2';

  return { material, depthMaterial, uniforms };
}

/**
 * Legacy/fallback sculpted pine canopy shader (kept exported for compatibility;
 * linear-RGB calibrated and fog-compliant).
 */
export function createPineCanopyMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windStrength: number;
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.8 },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.55 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWindStrength;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying vec2 vUv;

      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        vUv = uv;
        vLocalPos = position;
        #ifdef USE_INSTANCING_COLOR
        vInstanceColor = instanceColor;
        #endif

        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * localPos;
        vec3 basePos = instanceMatrix[3].xyz;
        vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
        vec4 worldPos = modelMatrix * localPos;
        vec3 basePos = modelMatrix[3].xyz;
        vec3 worldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif

        float hFlex = clamp((position.y - 1.4) / 9.8, 0.0, 1.0);
        hFlex = hFlex * hFlex;
        float sway = sin(uTime * uWindSpeed + basePos.x * 0.14 + basePos.z * 0.11) * uWindStrength * hFlex * 0.40;
        float boughFlutter = sin(uTime * (uWindSpeed * 1.9) + worldPos.x * 0.72 + worldPos.z * 0.61) * uWindStrength * uv.x * (0.045 + 0.075 * hFlex);
        worldPos.x += sway + boughFlutter;
        worldPos.z += sway * 0.48 + boughFlutter * 0.5;
        worldPos.y += cos(uTime * uWindSpeed * 1.6 + worldPos.x * 0.45) * uWindStrength * uv.x * 0.028;

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(worldNormal);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying vec2 vUv;

      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      float pHash(vec3 p) {
        p = fract(p * vec3(127.1, 311.7, 74.7));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float pNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(
            mix(pHash(i), pHash(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(pHash(i + vec3(0.0, 1.0, 0.0)), pHash(i + vec3(1.0, 1.0, 0.0)), u.x),
            u.y
          ),
          mix(
            mix(pHash(i + vec3(0.0, 0.0, 1.0)), pHash(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(pHash(i + vec3(0.0, 1.0, 1.0)), pHash(i + vec3(1.0, 1.0, 1.0)), u.x),
            u.y
          ),
          u.z
        );
      }

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float nCluster = pNoise(vWorldPos * 3.2 + vLocalPos * 2.1);
        float nNeedle = pNoise(vWorldPos * 9.5 + vLocalPos * 5.0);
        float nMicro = pNoise(vWorldPos * 21.0);
        float needlePattern = nCluster * 0.44 + nNeedle * 0.36 + nMicro * 0.20;

        vec3 microJitter = vec3(nNeedle - 0.5, (nMicro - 0.5) * 0.7, nCluster - 0.5);
        vec3 N = normalize(baseN + microJitter * 0.62);

        float NdotL = clamp(dot(N, L) * 0.58 + 0.42, 0.0, 1.0);
        float tipExposure = clamp(vUv.x, 0.0, 1.0);
        float heightExposure = clamp(vUv.y, 0.0, 1.0);

        float underShade = smoothstep(-0.65, 0.35, baseN.y);
        float ao = mix(0.20, 1.0, smoothstep(0.08, 0.90, tipExposure))
                 * mix(0.48, 1.0, smoothstep(0.0, 0.85, heightExposure))
                 * mix(0.38, 1.0, underShade);

        vec3 deepShadowPine = vec3(0.015, 0.048, 0.032);
        vec3 midSpruceCol = vec3(0.032, 0.115, 0.055);
        vec3 sunlitNeedleCol = vec3(0.095, 0.22, 0.075);

        #ifdef USE_INSTANCING_COLOR
        deepShadowPine *= vInstanceColor;
        midSpruceCol *= vInstanceColor;
        sunlitNeedleCol *= vInstanceColor;
        #endif

        float sunMix = smoothstep(0.28, 0.88, NdotL * 0.65 + tipExposure * 0.28 + heightExposure * 0.20);
        vec3 col = mix(deepShadowPine, midSpruceCol, clamp(ao * 0.72 + needlePattern * 0.40, 0.0, 1.0));
        col = mix(col, sunlitNeedleCol, sunMix * (0.40 + 0.60 * tipExposure));
        col *= 0.70 + 0.58 * needlePattern;

        float backLight = pow(clamp(dot(-V, L), 0.0, 1.0), 2.3);
        float sss = backLight * (0.22 + 0.78 * tipExposure) * (0.45 + 0.55 * heightExposure);
        col += vec3(0.24, 0.38, 0.10) * sss * 0.55;

        float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col += vec3(0.20, 0.34, 0.30) * rim * 0.16;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

export function createPineBarkMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * localPos;
        vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
        vec4 worldPos = modelMatrix * localPos;
        vec3 worldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(worldNormal);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;

      float bkHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }

      float bkNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(bkHash(i), bkHash(i + vec2(1.0, 0.0)), u.x),
          mix(bkHash(i + vec2(0.0, 1.0)), bkHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);

        float ang = atan(vLocalPos.z, vLocalPos.x);
        float furrow = bkNoise(vec2(ang * 4.5, vLocalPos.y * 2.2));
        float plate = bkNoise(vec2(ang * 9.0 + furrow, vLocalPos.y * 5.0));

        vec3 N = normalize(baseN + vec3((plate - 0.5) * 0.35, 0.0, (furrow - 0.5) * 0.35));
        float NdotL = clamp(dot(N, L) * 0.55 + 0.45, 0.0, 1.0);

        vec3 darkCrevice = vec3(0.055, 0.032, 0.020);
        vec3 warmBark = vec3(0.165, 0.095, 0.055);
        vec3 barkCol = mix(darkCrevice, warmBark, furrow * 0.65 + plate * 0.35);

        float mossUp = (1.0 - smoothstep(0.0, 1.45, vLocalPos.y + (furrow - 0.5) * 0.65));
        vec3 mossCol = vec3(0.035, 0.105, 0.032);
        vec3 albedo = mix(barkCol, mossCol, clamp(mossUp * 0.78, 0.0, 1.0));

        vec3 col = albedo * (0.48 + 0.62 * NdotL);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

export function createAlpineRidgeMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  mistColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
  snowLine: number;
  treeLine: number;
}>): THREE.ShaderMaterial {
  const custom = {
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uMistColor: {
      value: customUniforms?.mistColor instanceof THREE.Color
        ? customUniforms.mistColor
        : new THREE.Color(customUniforms?.mistColor ?? '#cce5df')
    },
    uHorizonColor: {
      value: customUniforms?.horizonColor instanceof THREE.Color
        ? customUniforms.horizonColor
        : new THREE.Color(customUniforms?.horizonColor ?? '#e6f2ec')
    },
    uSnowLine: { value: customUniforms?.snowLine ?? 36.0 },
    uTreeLine: { value: customUniforms?.treeLine ?? 24.0 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        #ifdef USE_FOG
        vFogDepth *= mix(0.85, 0.22, smoothstep(14.0, 54.0, worldPos.y));
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;
      uniform vec3 uMistColor;
      uniform vec3 uHorizonColor;
      uniform float uSnowLine;
      uniform float uTreeLine;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      float aHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 31.17);
        return fract(p.x * p.y);
      }

      float aNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(aHash(i), aHash(i + vec2(1.0, 0.0)), u.x),
          mix(aHash(i + vec2(0.0, 1.0)), aHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float aFbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          val += amp * aNoise(p);
          p = p * 2.07 + vec2(13.1, 7.7);
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float nMacro = aFbm(vWorldPos.xz * 0.048);
        float nCrag = aFbm(vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y * 1.65) * 0.12);
        float nStrata = aNoise(vec2(vWorldPos.y * 0.42 + nMacro * 2.6, (vWorldPos.x - vWorldPos.z) * 0.07));
        float nFine = aNoise(vWorldPos.xz * 0.52 + vWorldPos.y * 0.30);

        vec3 cragPerturb = vec3(
          (nCrag - 0.5) * 0.58,
          (nStrata - 0.5) * 0.40,
          (nFine - 0.5) * 0.58
        );
        vec3 N = normalize(baseN + cragPerturb);

        float slope = 1.0 - clamp(N.y, 0.0, 1.0);
        float elev = vWorldPos.y;

        // 1. Textured granite & dark alpine slate crags (linear RGB calibrated for AgX)
        vec3 darkSlate = vec3(0.048, 0.062, 0.088);
        vec3 warmGranite = vec3(0.185, 0.165, 0.145);
        vec3 rockCol = mix(darkSlate, warmGranite, clamp(nCrag * 0.65 + nStrata * 0.45, 0.0, 1.0));
        rockCol *= 0.78 + 0.42 * nFine;

        // 2. Forested pine foothills below tree line
        float forestHeightMask = 1.0 - smoothstep(uTreeLine - 4.0, uTreeLine + 9.0, elev + (nMacro - 0.5) * 9.0);
        float forestSlopeMask = 1.0 - smoothstep(0.36, 0.68, slope);
        float forestMask = forestHeightMask * forestSlopeMask;
        float canopySpeckle = aNoise(vWorldPos.xz * 0.82 + nMacro * 3.0);
        vec3 forestDark = vec3(0.014, 0.048, 0.032);
        vec3 forestLit = vec3(0.038, 0.105, 0.048);
        vec3 forestCol = mix(forestDark, forestLit, canopySpeckle);

        vec3 albedo = mix(rockCol, forestCol, forestMask);

        // 3. Snow-dusted high alpine ridges & couloirs
        float snowElev = smoothstep(uSnowLine - 4.5, uSnowLine + 7.5, elev + (nMacro - 0.5) * 11.0);
        float snowSlope = smoothstep(0.16, 0.56, N.y + (nCrag - 0.5) * 0.30);
        float snowMask = clamp(snowElev * snowSlope * 1.18, 0.0, 1.0);
        vec3 snowCol = mix(vec3(0.56, 0.68, 0.84), vec3(0.95, 0.96, 0.98), nFine);

        float NdotL = max(dot(N, L), 0.0);
        float wrapDiff = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);
        vec3 sunLight = vec3(1.36, 0.96, 0.58) * pow(NdotL, 0.88) * 1.28;
        vec3 skyAmbient = mix(vec3(0.08, 0.14, 0.24), vec3(0.24, 0.30, 0.40), wrapDiff) * 0.52;

        float ridgeRim = pow(1.0 - max(dot(N, V), 0.0), 2.3) * max(dot(L, V) * -0.5 + 0.5, 0.28) * smoothstep(18.0, 52.0, elev);
        vec3 litRock = albedo * (skyAmbient + sunLight) + vec3(1.08, 0.78, 0.44) * ridgeRim * 0.32;
        vec3 litSnow = snowCol * mix(vec3(0.22, 0.32, 0.50), vec3(1.22, 1.04, 0.84), smoothstep(0.04, 0.68, NdotL));

        vec3 col = mix(litRock, litSnow, snowMask);

        // Warm morning valley mist hugging low folds while keeping snowy peaks sharp and clear
        float mistNoise = aFbm(vWorldPos.xz * 0.025);
        float valleyMist = exp(-max(elev - 6.0, 0.0) * 0.145) * (0.65 + 0.35 * mistNoise);
        vec3 mistHue = mix(uMistColor, uHorizonColor, 0.45);
        col = mix(col, mistHue, clamp(valleyMist * 0.76, 0.0, 0.80));

        float horizonBlend = smoothstep(0.0, 0.10, vUv.y);
        col = mix(mistHue, col, horizonBlend);

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

export interface ValleyTerrainMaterialHandle {
  material: THREE.MeshStandardMaterial;
  uniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uSunDirection: { value: THREE.Vector3 };
    uDetailTex: { value: THREE.DataTexture | null };
  };
}

/**
 * Upgraded Forest Floor PBR Terrain material (`MeshStandardMaterial` + `onBeforeCompile`):
 * - Receives real 2048x2048 PCFSoftShadowMap dappled shadows from pine boughs & footbridge
 * - Damp forest humus earth, lush velvet moss beds, russet pine needle litter
 * - Winding cobblestone stepping-stone trail & wet slate stream bank reflections
 * - World-space micro-detail from 256x256 DataTexture
 */
export function createValleyTerrainMaterial(customUniforms?: Partial<{
  windSpeed: number;
  sunDirection: [number, number, number] | THREE.Vector3;
  detailTex: THREE.DataTexture;
}>): ValleyTerrainMaterialHandle {
  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.8 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uDetailTex: { value: customUniforms?.detailTex ?? null }
  };

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uSunDirection = uniforms.uSunDirection;
    shader.uniforms.uDetailTex = uniforms.uDetailTex;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNormal;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vTerrainWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindSpeed;
        uniform vec3 uSunDirection;
        uniform sampler2D uDetailTex;
        varying vec3 vTerrainWorldPos;
        varying vec3 vTerrainWorldNormal;

        float tHash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 19.19);
          return fract(p.x * p.y);
        }

        float tNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x),
            mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float tFbm(vec2 p) {
          float val = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            val += amp * tNoise(p);
            p = p * 2.09 + vec2(5.2, 11.4);
            amp *= 0.5;
          }
          return val;
        }

        float mistyTrailX(float z) {
          float westApproach = -4.2 + sin((z - 14.0) * 0.14) * 1.1;
          float bridgeWest = sin(-6.0 * 0.055) * 8.0 - 4.8;
          float bridgeEast = sin(-6.0 * 0.055) * 8.0 + 4.8;
          if (z >= -2.5) {
            float t = clamp((z + 2.5) / 8.0, 0.0, 1.0);
            return mix(bridgeWest, westApproach, t);
          }
          float tEast = clamp((-9.5 - z) / 14.0, 0.0, 1.0);
          return bridgeEast + sin(tEast * 1.4) * 2.4;
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 wp = vTerrainWorldPos;
        float streamCenterX = sin(wp.z * 0.055) * 8.0;
        float distStream = abs(wp.x - streamCenterX);

        float nMacro = tFbm(wp.xz * 0.075);
        float nMid = tFbm(wp.xz * 0.34);
        float nMicro = tNoise(wp.xz * 2.4);
        float nFineSoil = tNoise(wp.xz * 7.2);
        float nFineClover = tNoise(wp.xz * 15.5);

        vec2 warpUv = vec2(nMid * 0.28, -nMacro * 0.28);
        vec4 detailA = texture2D(uDetailTex, wp.xz * 0.28 + warpUv);
        vec4 detailB = texture2D(uDetailTex, wp.xz * 0.86 + vec2(0.37, 0.61) - warpUv * 0.5);
        float needleStroke = detailA.r * 0.55 + detailB.r * 0.45;
        float mossTuft = detailA.g * 0.5 + detailB.g * 0.5;
        float microGrit = detailB.b * 0.55 + nFineSoil * 0.45;

        // 1. Lush forest moss beds & clover micro-variation (linear RGB calibrated for AgX)
        vec3 deepMoss = vec3(0.024, 0.078, 0.026);
        vec3 sunlitMoss = vec3(0.075, 0.165, 0.046);
        vec3 mossCol = mix(deepMoss, sunlitMoss, clamp(nMacro * 0.5 + mossTuft * 0.35 + nFineClover * 0.25, 0.0, 1.0));
        mossCol *= 0.82 + 0.36 * nFineSoil;

        // 2. Damp forest earth & russet pine needle litter under conifers
        vec3 dampHumus = vec3(0.055, 0.036, 0.022);
        vec3 pineNeedles = vec3(0.145, 0.082, 0.040);
        vec3 litterCol = mix(dampHumus, pineNeedles, clamp(needleStroke * 0.72 + nMid * 0.35, 0.0, 1.0));

        float forestRadial = smoothstep(5.5, 13.5, distStream);
        float litterPatch = smoothstep(0.42, 0.74, nMacro + (nMid - 0.5) * 0.30) * forestRadial;
        vec3 groundCol = mix(mossCol, litterCol, litterPatch * 0.78);

        // 3. Winding stepping-stone woodland trail approaching the footbridge
        float trailX = mistyTrailX(wp.z);
        float distTrail = abs(wp.x - trailX + (nMid - 0.5) * 0.45);
        float trailMask = (1.0 - smoothstep(0.55, 1.55, distTrail)) * smoothstep(-26.0, -21.0, wp.z) * smoothstep(19.0, 14.5, wp.z) * smoothstep(3.2, 4.6, distStream);
        vec3 wornEarth = mix(vec3(0.082, 0.064, 0.044), vec3(0.125, 0.115, 0.096), microGrit);
        groundCol = mix(groundCol, wornEarth, trailMask * 0.85);

        // 4. Wet slate & pebble stream bank margin
        float bankMix = 1.0 - smoothstep(2.4, 5.4, distStream + (nMid - 0.5) * 1.4);
        vec3 dryPebble = mix(vec3(0.105, 0.115, 0.105), vec3(0.21, 0.20, 0.175), microGrit);
        vec3 wetSlate = vec3(0.032, 0.045, 0.042);
        float wetness = 1.0 - smoothstep(2.2, 4.2, distStream + (nMicro - 0.5) * 0.6);
        vec3 shoreCol = mix(dryPebble, wetSlate, wetness * 0.88);
        groundCol = mix(groundCol, shoreCol, bankMix * 0.92);

        // Subtle animated canopy dapple highlights complementing real PCFSoftShadowMap
        vec2 dappleUv = wp.xz * 0.085 + vec2(uTime * 0.025 * uWindSpeed, uTime * 0.015 * uWindSpeed);
        float sunDapple = smoothstep(0.42, 0.72, tFbm(dappleUv));
        groundCol *= (0.84 + 0.30 * detailA.a) * (0.90 + 0.20 * sunDapple);

        diffuseColor.rgb = groundCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float rStreamX = sin(vTerrainWorldPos.z * 0.055) * 8.0;
        float rDistStream = abs(vTerrainWorldPos.x - rStreamX);
        float rWet = 1.0 - smoothstep(2.2, 4.3, rDistStream);
        roughnessFactor = mix(0.90, 0.18, rWet * 0.88);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec4 dNormSample = texture2D(uDetailTex, vTerrainWorldPos.xz * 0.65);
        vec3 worldPerturb = vec3((dNormSample.r - 0.5) * 0.24, 0.0, (dNormSample.g - 0.5) * 0.24);
        normal = normalize(normal + (viewMatrix * vec4(worldPerturb, 0.0)).xyz);`
      );
  };
  material.customProgramCacheKey = () => 'misty-forest-terrain-pbr-v1';

  return { material, uniforms };
}

export interface FernMaterialHandle {
  material: THREE.MeshStandardMaterial;
  uniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uWindStrength: { value: number };
    uSunDirection: { value: THREE.Vector3 };
  };
}

/**
 * Alpha-tested Botanical Fern Frond PBR material (`MeshStandardMaterial` + `onBeforeCompile`)
 * using pinnate fern frond atlas, wind sway, backlit SSS translucency, and shadow reception.
 */
export function createFernMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windStrength: number;
  sunDirection: [number, number, number] | THREE.Vector3;
  fernAtlas: THREE.Texture;
}>): FernMaterialHandle {
  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.8 },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.55 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };

  const material = new THREE.MeshStandardMaterial({
    map: customUniforms?.fernAtlas ?? null,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.58,
    metalness: 0.0
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uSunDirection = uniforms.uSunDirection;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uWindStrength;
        varying vec3 vFernWorldPos;
        varying vec3 vFernWorldNormal;
        varying vec2 vFernUv;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        #ifdef USE_INSTANCING
          vFernWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);
        #else
          vFernWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
        #endif`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFernUv = uv;
        float flex = uv.y * uv.y;
        #ifdef USE_INSTANCING
          vec3 fBase = vec3(instanceMatrix[3].xyz);
        #else
          vec3 fBase = vec3(0.0);
        #endif
        float fPhase = fBase.x * 0.45 + fBase.z * 0.35 + uTime * (uWindSpeed * 1.25);
        float fSway = sin(fPhase) * 0.11 * uWindStrength * flex;
        transformed.x += fSway;
        transformed.z += cos(fPhase * 0.85) * 0.08 * uWindStrength * flex;
        transformed.y -= abs(fSway) * 0.22 * flex;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vFernWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vFernWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDirection;
        varying vec3 vFernWorldPos;
        varying vec3 vFernWorldNormal;
        varying vec2 vFernUv;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Root contact AO at base of rosette so ferns stay grounded in moss
        float rootAo = mix(0.45, 1.0, smoothstep(0.0, 0.35, vFernUv.y));
        diffuseColor.rgb *= rootAo;`
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 fV = normalize(cameraPosition - vFernWorldPos);
        vec3 fL = normalize(uSunDirection);
        float fSss = pow(clamp(dot(fV, -fL), 0.0, 1.0), 1.9) * (0.38 + 0.62 * vFernUv.y);
        float fTopSun = clamp(dot(normalize(vFernWorldNormal), fL) * 0.5 + 0.5, 0.0, 1.0);
        outgoingLight += diffuseColor.rgb * (fSss * vec3(0.94, 1.22, 0.38) + fTopSun * 0.16 * vec3(0.75, 1.0, 0.42));
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => 'misty-fern-pbr-v1';

  return { material, uniforms };
}

export function createMossyBoulderMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vLocalY;

      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        vLocalY = position.y;
        #ifdef USE_INSTANCING_COLOR
        vInstanceColor = instanceColor;
        #endif

        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * localPos;
        vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
        vec4 worldPos = modelMatrix * localPos;
        vec3 worldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(worldNormal);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vLocalY;

      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      float bHash(vec3 p) {
        p = fract(p * vec3(127.1, 311.7, 74.7));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float bNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(
            mix(bHash(i), bHash(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(bHash(i + vec3(0.0, 1.0, 0.0)), bHash(i + vec3(1.0, 1.0, 0.0)), u.x),
            u.y
          ),
          mix(
            mix(bHash(i + vec3(0.0, 0.0, 1.0)), bHash(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(bHash(i + vec3(0.0, 1.0, 1.0)), bHash(i + vec3(1.0, 1.0, 1.0)), u.x),
            u.y
          ),
          u.z
        );
      }

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float nRock = bNoise(vWorldPos * 2.4);
        float nFine = bNoise(vWorldPos * 7.8);
        float nCrack = bNoise(vWorldPos * 15.0);
        vec3 N = normalize(baseN + vec3(nFine - 0.5, (nRock - 0.5) * 0.45, nCrack - 0.5) * 0.42);

        vec3 darkStone = vec3(0.055, 0.065, 0.072);
        vec3 granite = vec3(0.18, 0.18, 0.165);
        vec3 stoneCol = mix(darkStone, granite, nRock * 0.65 + nFine * 0.35);
        stoneCol *= 0.85 + 0.30 * nCrack;

        #ifdef USE_INSTANCING_COLOR
        stoneCol *= vInstanceColor;
        #endif

        float mossMask = smoothstep(0.28, 0.64, N.y + (nRock - 0.5) * 0.38);
        vec3 mossCol = mix(vec3(0.03, 0.095, 0.028), vec3(0.08, 0.185, 0.045), nFine);

        float wetMask = 1.0 - smoothstep(-0.15, 0.25, vLocalY + (nRock - 0.5) * 0.12);
        vec3 albedo = mix(stoneCol, mossCol, mossMask * (1.0 - wetMask * 0.65));
        albedo = mix(albedo, albedo * 0.52, wetMask * 0.75);

        float NdotL = clamp(dot(N, L) * 0.65 + 0.35, 0.0, 1.0);
        vec3 col = albedo * (0.45 + 0.68 * NdotL);

        float wetSpec = pow(max(dot(reflect(-V, N), L), 0.0), 32.0) * wetMask;
        col += vec3(0.90, 0.95, 0.92) * wetSpec * 0.45;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

/**
 * Enhances a Granite Cliff MeshStandardMaterial (built with non-Voronoi `createGraniteCliffPbrTextures`)
 * with world-space triplanar slate & granite strata ledges, wet dark vertical seepage streaks beside
 * the waterfall chute, upward-facing ledge moss, and zero Voronoi cellular artifacts.
 */
export function applyWaterfallCliffStrataShader(
  mat: THREE.MeshStandardMaterial,
  options: {
    waterfallCenterX: number;
    waterfallZ: number;
    cascadeHalfWidth?: number;
    cacheKey?: string;
  }
): void {
  const wfX = options.waterfallCenterX;
  const wfZ = options.waterfallZ;
  const halfW = options.cascadeHalfWidth ?? 4.2;
  const cacheKey = options.cacheKey ?? 'misty-waterfall-strata-v2';

  const prevCompile = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile')
    ? mat.onBeforeCompile.bind(mat)
    : null;
  const prevCacheKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey')
    ? mat.customProgramCacheKey.bind(mat)
    : null;

  mat.customProgramCacheKey = () => (prevCacheKey ? `${prevCacheKey()}|${cacheKey}` : cacheKey);

  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) {
      prevCompile(shader, renderer);
    }

    shader.uniforms.uWfCenter = { value: new THREE.Vector3(wfX, wfZ, halfW) };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCliffWorldPos;
        varying vec3 vCliffWorldNormal;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vCliffWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vCliffWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uWfCenter;
        varying vec3 vCliffWorldPos;
        varying vec3 vCliffWorldNormal;

        float cfHash2(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 19.31);
          return fract(p.x * p.y);
        }

        float cfNoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(cfHash2(i), cfHash2(i + vec2(1.0, 0.0)), u.x),
            mix(cfHash2(i + vec2(0.0, 1.0)), cfHash2(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float cfFbm2(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * cfNoise2(p);
            p = p * 2.07 + vec2(7.3, 13.7);
            a *= 0.5;
          }
          return v;
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 cw = vCliffWorldPos;
        vec3 cN = normalize(vCliffWorldNormal);

        // Tilted horizontal metamorphic slate & granite strata ledges (non-Voronoi!)
        float strataTilt = cw.x * 0.085 - cw.z * 0.065;
        float strataWarp = (cfFbm2(cw.xz * 0.09) - 0.5) * 1.4;
        float bedCoord = (cw.y + strataTilt + strataWarp) * 0.58;
        float bedFrac = fract(bedCoord);
        float ledgeCrevice = 1.0 - smoothstep(0.0, 0.14, bedFrac);
        float bedTone = 0.82 + 0.34 * cfNoise2(vec2(floor(bedCoord) * 1.73, cw.x * 0.08));

        // Vertical granite dihedral cleavage variation
        float vertRib = cfFbm2(vec2(cw.x * 0.32 + strataWarp * 0.4, cw.y * 0.08));
        vec3 slateShade = mix(vec3(0.42, 0.44, 0.48), vec3(0.76, 0.72, 0.66), vertRib * 0.65 + 0.25);
        diffuseColor.rgb = diffuseColor.rgb * slateShade * bedTone * (1.0 - ledgeCrevice * 0.42);

        // Wet dark vertical seepage streaks flanking the waterfall chute & splash shelves
        float dxWf = abs(cw.x - uWfCenter.x);
        float dzWf = abs(cw.z - uWfCenter.y);
        float flankBand = (1.0 - smoothstep(uWfCenter.z * 0.55, uWfCenter.z * 2.95, dxWf)) * smoothstep(28.0, 1.5, dzWf);
        float streakField = cfFbm2(vec2(cw.x * 1.15, cw.y * 0.09)) * 0.65 + cfNoise2(vec2(cw.x * 2.8, cw.y * 0.18)) * 0.35;
        float seepageStreak = smoothstep(0.36, 0.68, streakField) * flankBand * smoothstep(48.0, 14.0, cw.y);
        float lowerSplash = (1.0 - smoothstep(0.0, 10.5, dxWf - uWfCenter.z * 0.5)) * smoothstep(26.5, 17.5, cw.y) * smoothstep(22.0, 1.5, dzWf);
        float cliffWetness = clamp(max(seepageStreak, lowerSplash * 0.90), 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, 0.34, cliffWetness);

        // Lush upward-facing shelf moss clinging to horizontal ledges (suppressed inside waterfall core)
        float coreClear = smoothstep(uWfCenter.z * 0.65, uWfCenter.z * 1.35, dxWf);
        float shelfUp = smoothstep(0.32, 0.76, cN.y + (cfNoise2(cw.xz * 0.45) - 0.5) * 0.24);
        float ledgeMossMask = clamp(shelfUp * smoothstep(0.40, 0.76, cfFbm2(cw.xz * 0.36)) * (0.45 + 0.55 * coreClear), 0.0, 0.78);
        vec3 shelfMossCol = mix(vec3(0.04, 0.11, 0.03), vec3(0.09, 0.19, 0.045), cfNoise2(cw.xz * 1.4));
        diffuseColor.rgb = mix(diffuseColor.rgb, shelfMossCol, ledgeMossMask);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float rDxWf = abs(vCliffWorldPos.x - uWfCenter.x);
        float rDzWf = abs(vCliffWorldPos.z - uWfCenter.y);
        float rFlank = (1.0 - smoothstep(uWfCenter.z * 0.85, uWfCenter.z * 2.65, rDxWf)) * smoothstep(26.0, 2.0, rDzWf);
        float rStreak = smoothstep(0.42, 0.72, cfFbm2(vec2(vCliffWorldPos.x * 1.15, vCliffWorldPos.y * 0.09))) * rFlank;
        float rSplash = (1.0 - smoothstep(0.0, 9.0, rDxWf - uWfCenter.z * 0.6)) * smoothstep(26.0, 17.5, vCliffWorldPos.y) * smoothstep(20.0, 2.0, rDzWf);
        float rWet = clamp(max(rStreak, rSplash * 0.85), 0.0, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.18, rWet);`
      );
  };
}

export function createWaterfallMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  layerMode: number;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uBassEnergy: { value: 0.0 },
    uLayerMode: { value: customUniforms?.layerMode ?? 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uLayerMode;
      uniform vec3 uSunDirection;

      varying vec2 vUv;
      varying vec3 vWorldPos;

      float wfHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.31);
        return fract(p.x * p.y);
      }

      float wfNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(wfHash(i), wfHash(i + vec2(1.0, 0.0)), u.x),
          mix(wfHash(i + vec2(0.0, 1.0)), wfHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        float speedBoost = 1.0 + uBassEnergy * 0.28 + uLayerMode * 0.25;
        float braidWave = sin(vUv.y * 8.5 + vUv.x * 5.2 + uLayerMode * 1.4) * 0.06;
        float xShifted = vUv.x + braidWave;

        vec2 flow1 = vec2(xShifted * 13.0, vUv.y * 3.8 + uTime * 2.15 * speedBoost);
        vec2 flow2 = vec2(xShifted * 26.0 + 3.1, vUv.y * 6.5 + uTime * 3.25 * speedBoost);
        vec2 flowFine = vec2(xShifted * 46.0 - 1.7, vUv.y * 11.2 + uTime * 4.45 * speedBoost);
        float streak1 = wfNoise(flow1);
        float streak2 = wfNoise(flow2);
        float streak3 = wfNoise(flowFine);
        float cascade = streak1 * 0.44 + streak2 * 0.34 + streak3 * 0.22;

        // Multi-tiered rocky cascade shelves breaking the water curtain into foaming leaps
        float shelf1 = exp(-pow((vUv.y - 0.78) * 13.5, 2.0));
        float shelf2 = exp(-pow((vUv.y - 0.52) * 11.5, 2.0));
        float shelf3 = exp(-pow((vUv.y - 0.26) * 10.5, 2.0));
        float shelfBurst = (shelf1 + shelf2 + shelf3) * (0.55 + 0.45 * streak2);

        // Exposed rock-outcrop notches splitting the fall into twin/triple braided plumes
        float rockSplit1 = exp(-pow((xShifted - 0.36) * 10.5, 2.0)) * exp(-pow((vUv.y - 0.62) * 7.5, 2.0));
        float rockSplit2 = exp(-pow((xShifted - 0.66) * 11.5, 2.0)) * exp(-pow((vUv.y - 0.38) * 7.0, 2.0));
        float rockHole = clamp((rockSplit1 + rockSplit2) * 1.15, 0.0, 0.92);

        // Feathered organic edge silhouette so waterfall borders are lacy spray, never straight lines
        float edgeJitter = (streak1 - 0.5) * 0.20 + (streak2 - 0.5) * 0.10;
        float edgeDist = abs(vUv.x - 0.5) * 2.0 + edgeJitter;
        float edgeFade = 1.0 - smoothstep(0.40, 0.95, edgeDist);
        float topFade = smoothstep(1.0, 0.84 + 0.04 * streak1, vUv.y);
        float bottomFade = smoothstep(0.0, 0.14 + 0.06 * streak2, vUv.y);
        float crestFoam = smoothstep(0.76, 0.96, vUv.y);
        float plungeSplash = 1.0 - smoothstep(0.0, 0.34, vUv.y);

        vec3 aquaCore = vec3(0.09, 0.36, 0.44);
        vec3 whiteFoam = vec3(0.96, 0.98, 0.98);
        float foamMask = smoothstep(0.24 - uLayerMode * 0.08, 0.74, cascade + crestFoam * 0.46 + plungeSplash * 0.66 + shelfBurst * 0.65);
        vec3 col = mix(aquaCore, whiteFoam, foamMask);

        // Golden-hour sun rim & droplet sparkles
        float sunRim = clamp(dot(normalize(cameraPosition - vWorldPos), -normalize(uSunDirection)) * 0.5 + 0.5, 0.0, 1.0);
        float sparkle = pow(streak3, 3.8) * (0.95 + 0.45 * sunRim);
        col += vec3(1.22, 1.02, 0.74) * sparkle;

        float ribbonGap = mix(0.54, 1.0, smoothstep(0.22, 0.70, cascade));
        float layerOpacity = uLayerMode > 0.5 ? 0.62 : 0.96;
        float alpha = clamp(
          (0.46 + 0.52 * foamMask) * edgeFade * ribbonGap * (0.14 + 0.86 * topFade) * bottomFade * (1.0 - rockHole * 0.86) * layerOpacity,
          0.0,
          0.96
        );
        if (alpha < 0.02) discard;

        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * Turbulent plunge-pool foam & boiling spray mist surface at the waterfall impact basin.
 */
export function createWaterfallPlungeFoamMaterial(customUniforms?: Partial<{
  mistColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 },
      uMistColor: {
        value: customUniforms?.mistColor instanceof THREE.Color
          ? customUniforms.mistColor
          : new THREE.Color(customUniforms?.mistColor ?? '#f2f7f4')
      }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uBassEnergy;
      uniform vec3 uMistColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float pfHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 31.17);
        return fract(p.x * p.y);
      }

      float pfNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(pfHash(i), pfHash(i + vec2(1.0, 0.0)), u.x),
          mix(pfHash(i + vec2(0.0, 1.0)), pfHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 centered = (vUv - 0.5) * 2.0;
        float r = length(centered);
        if (r > 1.0) discard;

        float angle = atan(centered.y, centered.x);
        float churnSpeed = 1.0 + uBassEnergy * 0.35;
        float ring1 = sin(r * 18.0 - uTime * 4.5 * churnSpeed + pfNoise(centered * 3.5) * 2.4) * 0.5 + 0.5;
        float ring2 = sin(r * 28.0 - uTime * 6.0 * churnSpeed - pfNoise(centered * 6.0) * 1.9) * 0.5 + 0.5;
        float churn = pfNoise(vec2(r * 8.0 - uTime * 1.8 * churnSpeed, angle * 4.0 + uTime * 0.8)) * 0.55
                    + pfNoise(vUv * 16.0 - vec2(0.0, uTime * 2.4 * churnSpeed)) * 0.45;
        float froth = smoothstep(0.34, 0.82, churn + ring2 * 0.28);
        float radialMask = (1.0 - smoothstep(0.24, 0.98, r)) * smoothstep(0.02, 0.14, r);
        float coreFoam = exp(-r * r * 4.2);
        float alpha = clamp((coreFoam * 0.84 + radialMask * (0.40 * ring1 + 0.65 * froth) * 0.78), 0.0, 0.94);
        if (alpha < 0.01) discard;

        vec3 col = mix(vec3(0.76, 0.90, 0.94), uMistColor, smoothstep(0.22, 0.80, froth + coreFoam * 0.48));
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * Rising animated waterfall mist & spray particle shader (`THREE.Points` with `aParticleData`).
 */
export function createWaterfallMistParticlesMaterial(customUniforms?: Partial<{
  mistColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 },
      uMistColor: {
        value: customUniforms?.mistColor instanceof THREE.Color
          ? customUniforms.mistColor
          : new THREE.Color(customUniforms?.mistColor ?? '#f6eedb')
      }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uBassEnergy;
      attribute vec4 aParticleData;
      varying float vAlpha;

      void main() {
        float life = fract(aParticleData.x + uTime * aParticleData.y * (1.0 + uBassEnergy * 0.25));
        vec3 p = position;
        p.x += aParticleData.z * life + sin(uTime * 0.9 + aParticleData.x * 12.0) * 0.65 * life;
        p.y += life * 10.5;
        p.z += aParticleData.w * life + cos(uTime * 0.7 + aParticleData.x * 9.0) * 0.45 * life;

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float sizeScale = (18.0 + life * 44.0) * (1.0 + uBassEnergy * 0.2);
        gl_PointSize = clamp(sizeScale * 14.0 / max(-mvPosition.z, 2.0), 3.0, 96.0);

        float fadeIn = smoothstep(0.0, 0.20, life);
        float fadeOut = 1.0 - smoothstep(0.45, 1.0, life);
        vAlpha = fadeIn * fadeOut * 0.34;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uMistColor;
      varying float vAlpha;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;
        float soft = pow(1.0 - r, 1.85);
        float alpha = soft * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uMistColor, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true
  });
}

export function createSunbeamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uIntensity: { value: 1.0 },
      uBassEnergy: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uBassEnergy;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float camDist = length(cameraPosition - vWorldPos);

        // Soft cylindrical Fresnel falloff + multi-ray canopy-filtered crepuscular striations
        float facing = pow(abs(dot(N, V)), 2.0);
        float vertFade = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.16, vUv.y);
        float ray1 = 0.55 + 0.45 * sin(vUv.x * 18.8495 + uTime * 0.28 + vWorldPos.x * 0.22);
        float ray2 = 0.62 + 0.38 * cos(vUv.x * 31.4159 - uTime * 0.42 + vWorldPos.z * 0.31);
        float rays = pow(clamp(ray1 * ray2, 0.0, 1.0), 0.75);

        float nearFade = smoothstep(3.5, 11.5, camDist);
        float distFade = smoothstep(145.0, 28.0, camDist);

        float alpha = facing * vertFade * rays * nearFade * distFade * 0.165 * uIntensity * (1.0 + uBassEnergy * 0.30);
        if (alpha < 0.002) discard;

        vec3 beamCol = vec3(1.28, 0.94, 0.48);
        gl_FragColor = vec4(beamCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

export function createBirdFlockMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vWingPos;

      void main() {
        vec3 p = position;
        float wingSpan = abs(p.x);
        vWingPos = wingSpan;

        #ifdef USE_INSTANCING
        vec3 basePos = instanceMatrix[3].xyz;
        float phase = basePos.x * 0.17 + basePos.z * 0.23;
        #else
        float phase = 0.0;
        #endif

        float glideCycle = sin(uTime * 0.42 + phase);
        float flapActive = smoothstep(0.15, 0.80, glideCycle);
        float wingBeat = sin(uTime * 7.2 + phase * 3.1) * flapActive;
        p.y += wingSpan * (wingBeat * 0.34 + 0.12);

        vec4 localPos = vec4(p, 1.0);
        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * localPos;
        vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
        vec4 worldPos = modelMatrix * localPos;
        vec3 worldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(worldNormal);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vWingPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float NdotL = abs(dot(N, L)) * 0.55 + 0.45;
        float sunRim = pow(1.0 - abs(dot(N, V)), 2.0) * clamp(dot(L, -V) * 0.5 + 0.5, 0.0, 1.0);

        vec3 bodyCol = vec3(0.042, 0.048, 0.062);
        vec3 wingTipCol = vec3(0.155, 0.145, 0.132);
        vec3 col = mix(bodyCol, wingTipCol, clamp(vWingPos * 0.9, 0.0, 1.0)) * NdotL;
        col += vec3(0.52, 0.38, 0.22) * sunRim * 0.35;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true
  });
}

export function createValleyMistMaterial(customUniforms?: Partial<{
  mistColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uIntensity: { value: 1.0 },
      uMistColor: {
        value: customUniforms?.mistColor instanceof THREE.Color
          ? customUniforms.mistColor
          : new THREE.Color(customUniforms?.mistColor ?? '#ebdec6')
      }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uMistColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float mHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 31.17);
        return fract(p.x * p.y);
      }

      float mNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mHash(i), mHash(i + vec2(1.0, 0.0)), u.x),
          mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 uv = vUv;
        float drift = uTime * 0.036;
        float rise = uTime * 0.042;
        float n = mNoise(uv * 3.4 + vec2(drift, -rise)) * 0.56
                + mNoise(uv * 7.2 - vec2(drift * 0.75, rise * 0.85)) * 0.30
                + mNoise(uv * 14.0 + vec2(0.0, -rise * 1.2)) * 0.14;

        vec2 centered = (uv - 0.5) * 2.0;
        float radialFade = 1.0 - smoothstep(0.32, 1.0, length(centered));
        float edgeFade = smoothstep(0.0, 0.30, uv.x) * smoothstep(1.0, 0.70, uv.x)
                       * smoothstep(0.0, 0.28, uv.y) * smoothstep(1.0, 0.66, uv.y);

        float alpha = smoothstep(0.30, 0.82, n) * edgeFade * radialFade * 0.22 * uIntensity;
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(uMistColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Drifting animated low-lying stream fog ribbon shader hugging the mountain brook & mossy banks
 * with downstream flow, golden-hour Mie forward scatter, and soft feathered edges.
 */
export function createStreamFogRibbonMaterial(customUniforms?: Partial<{
  mistColor: string | THREE.Color;
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uIntensity: { value: 1.0 },
      uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
      uMistColor: {
        value: customUniforms?.mistColor instanceof THREE.Color
          ? customUniforms.mistColor
          : new THREE.Color(customUniforms?.mistColor ?? '#f2e8d4')
      }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec3 p = position;
        float edgeNorm = abs(uv.x - 0.5) * 2.0;
        p.y += sin(p.z * 0.14 - uTime * 0.55 + p.x * 0.25) * 0.14 * (1.0 - edgeNorm * 0.5);
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uSunDirection;
      uniform vec3 uMistColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float sfHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 31.17);
        return fract(p.x * p.y);
      }

      float sfNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(sfHash(i), sfHash(i + vec2(1.0, 0.0)), u.x),
          mix(sfHash(i + vec2(0.0, 1.0)), sfHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float sfFbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * sfNoise(p);
          p = p * 2.04 + vec2(9.1, 5.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 flowA = vec2(vWorldPos.x * 0.16 + sin(uTime * 0.12) * 0.4, vWorldPos.z * 0.09 - uTime * 0.24);
        vec2 flowB = vec2(vWorldPos.x * 0.34 - uTime * 0.06, vWorldPos.z * 0.19 - uTime * 0.36);
        float wisp = sfFbm(flowA) * 0.62 + sfFbm(flowB) * 0.38;

        float acrossFade = 1.0 - smoothstep(0.18, 0.98, abs(vUv.x - 0.5) * 2.0);
        float lengthFade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        float camDist = length(cameraPosition - vWorldPos);
        float nearFade = smoothstep(2.8, 9.0, camDist);

        float alpha = smoothstep(0.32, 0.78, wisp) * acrossFade * lengthFade * nearFade * 0.36 * uIntensity;
        if (alpha < 0.004) discard;

        vec3 V = normalize(vWorldPos - cameraPosition);
        float sunForward = pow(max(dot(V, normalize(uSunDirection)), 0.0), 3.0);
        vec3 col = mix(uMistColor, vec3(1.18, 0.94, 0.62), sunForward * 0.48);

        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * Instanced Wild Forest Blossoms material with synchronized wind sway, vertex color stems/petals,
 * and gentle golden-hour petal translucency.
 */
export function createWildflowerMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windStrength: number;
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.8 },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.55 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWindStrength;
      attribute float aPetalMask;

      varying vec3 vColor;
      varying float vPetalMask;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        #ifdef USE_COLOR
          vColor = color;
        #else
          vColor = vec3(1.0);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor *= mix(vec3(1.0), instanceColor, aPetalMask);
        #endif
        vPetalMask = aPetalMask;

        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          vec4 worldPos = instanceMatrix * localPos;
          vec3 basePos = instanceMatrix[3].xyz;
          vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
          vec4 worldPos = modelMatrix * localPos;
          vec3 basePos = modelMatrix[3].xyz;
          vec3 worldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif

        float hFlex = clamp(position.y / 0.42, 0.0, 1.0);
        hFlex *= hFlex;
        float sway = sin(uTime * (uWindSpeed * 1.15) + basePos.x * 0.35 + basePos.z * 0.28) * 0.14 * uWindStrength * hFlex;
        float crossSway = cos(uTime * (uWindSpeed * 1.65) + basePos.z * 0.42) * 0.09 * uWindStrength * hFlex;
        worldPos.x += sway;
        worldPos.z += crossSway;
        worldPos.y -= (sway * sway + crossSway * crossSway) * 0.35;

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(worldNormal);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;
      varying vec3 vColor;
      varying float vPetalMask;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float NdotL = clamp(dot(N, L) * 0.55 + 0.45, 0.0, 1.0);
        float sss = pow(clamp(dot(V, -L), 0.0, 1.0), 2.0) * vPetalMask;
        vec3 col = vColor * (0.55 + 0.65 * NdotL) + vColor * sss * 0.48;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    vertexColors: true,
    fog: true
  });
}

/**
 * Sleek iridescent Brook Trout material with subtle body/tail swim oscillation.
 */
export function createTroutMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        #ifdef USE_COLOR
          vColor = color;
        #else
          vColor = vec3(0.45, 0.55, 0.58);
        #endif
        vec3 p = position;
        float tailT = clamp((-p.z + 0.22) / 0.48, 0.0, 1.0);
        p.x += sin(uTime * 14.0 - p.z * 11.0) * 0.028 * tailT * tailT;

        vec4 localPos = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          vec4 worldPos = instanceMatrix * localPos;
          vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
          vec4 worldPos = modelMatrix * localPos;
          vec3 worldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(worldNormal);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);
        float NdotL = clamp(dot(N, L) * 0.65 + 0.35, 0.0, 1.0);
        float wetSpec = pow(max(dot(N, H), 0.0), 42.0) * 0.95;
        vec3 col = vColor * (0.45 + 0.75 * NdotL) + vec3(1.05, 0.96, 0.76) * wetSpec;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    vertexColors: true,
    fog: true
  });
}

/**
 * Expanding concentric water ripple rings on the stream surface synced with jumping trout.
 */
export function createTroutRippleMaterial(): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aRippleAge;
      varying vec2 vUv;
      varying float vAge;

      void main() {
        vUv = uv;
        vAge = aRippleAge;
        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          vec4 worldPos = instanceMatrix * localPos;
        #else
          vec4 worldPos = modelMatrix * localPos;
        #endif
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec2 vUv;
      varying float vAge;

      void main() {
        if (vAge <= 0.001 || vAge >= 1.0) discard;
        float r = length((vUv - 0.5) * 2.0);
        if (r > 1.0) discard;

        float ringRadius = 0.14 + vAge * 0.78;
        float ring1 = exp(-pow((r - ringRadius) * 18.0, 2.0));
        float ring2 = exp(-pow((r - max(0.05, ringRadius - 0.18)) * 22.0, 2.0)) * 0.65;
        float fade = (1.0 - smoothstep(0.35, 1.0, vAge)) * smoothstep(0.0, 0.08, vAge);
        float alpha = (ring1 + ring2) * fade * 0.72;
        if (alpha < 0.01) discard;

        vec3 col = vec3(0.88, 0.96, 0.96);
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * Dual-mode softly drifting forest fireflies (chartreuse-amber pulse) & sunlit golden pollen motes.
 */
export function createForestMotesMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 },
      uTrebleEnergy: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uTrebleEnergy;
      attribute float aPhase;
      attribute float aKind;
      varying float vGlow;
      varying float vKind;

      void main() {
        vKind = aKind;
        vec3 p = position;
        float speed = mix(0.45, 0.78, aKind);
        p.x += sin(uTime * speed + aPhase) * (0.95 + aKind * 0.55);
        p.y += sin(uTime * (speed * 1.45) + aPhase * 1.4) * (0.38 + aKind * 0.25);
        p.z += cos(uTime * (speed * 0.9) + aPhase * 1.2) * (0.95 + aKind * 0.55);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float basePt = mix(22.0, 32.0, aKind) * (1.0 + uTrebleEnergy * 0.35 + uBassEnergy * 0.15);
        gl_PointSize = clamp(basePt / max(-mvPosition.z, 1.0), 2.0, 8.5);
        float pulse = aKind > 0.5
          ? pow(0.5 + 0.5 * sin(uTime * 2.4 + aPhase * 2.3), 1.8)
          : 0.55 + 0.45 * sin(uTime * 1.3 + aPhase * 1.7);
        vGlow = pulse * (1.0 + uTrebleEnergy * 0.45);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      varying float vKind;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.04, d);
        float a = core * core * vGlow;
        vec3 pollenCol = vec3(1.12, 0.94, 0.52);
        vec3 fireflyCol = vec3(0.88, 1.18, 0.36);
        vec3 col = mix(pollenCol, fireflyCol, vKind);
        gl_FragColor = vec4(col, a * 0.88);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}
