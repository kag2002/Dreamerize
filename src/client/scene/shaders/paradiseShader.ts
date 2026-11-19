import * as THREE from 'three';
import { PbrTextureSet } from '../textures/pbrTextures';

function resolveSunDir(sunDirection?: [number, number, number] | THREE.Vector3): THREE.Vector3 {
  if (sunDirection instanceof THREE.Vector3) {
    return sunDirection.clone().normalize();
  }
  if (Array.isArray(sunDirection)) {
    return new THREE.Vector3(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
  }
  return new THREE.Vector3(38, 44, -90).normalize();
}

function toColor(val: string | THREE.Color | undefined, fallback: string): THREE.Color {
  if (val instanceof THREE.Color) return val.clone();
  return new THREE.Color(val ?? fallback);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
}

function smoothstepJS(e0: number, e1: number, x: number): number {
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

function getSafeAnisotropy(renderer?: THREE.WebGLRenderer): number {
  if (!renderer) return 4;
  try {
    const cap = (renderer as unknown as { capabilities?: { getMaxAnisotropy?: () => number } }).capabilities;
    if (cap && typeof cap.getMaxAnisotropy === 'function') {
      return Math.min(8, Math.max(1, cap.getMaxAnisotropy()));
    }
  } catch {
    // Safe fallback for mock renderers
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
      // Safe fallback for headless mock renderers
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

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

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
 * Generates a 512x512 veined Carrara / Ivory marble PBR texture set (`map`, `normalMap`, `roughnessMap`, `aoMap`).
 * Seamlessly tileable across columns, entablature, dome ribs, balustrades, pool coping, and sanctuary courtyards.
 */
export function createCarraraMarblePbrTextures(
  renderer?: THREE.WebGLRenderer,
  options?: { size?: number; seed?: number; repeatX?: number; repeatY?: number }
): PbrTextureSet {
  const size = options?.size ?? 512;
  const seed = options?.seed ?? 7721;
  const repeatX = options?.repeatX ?? 1;
  const repeatY = options?.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Domain-warped organic Carrara mineral flow
      const warpX = tileFbm(u, v, 4, 4, seed + 17) - 0.5;
      const warpY = tileFbm(u, v, 4, 4, seed + 53) - 0.5;
      const uW = (u + warpX * 0.24 + 1.0) % 1.0;
      const vW = (v + warpY * 0.24 + 1.0) % 1.0;

      const cloud = tileFbm(uW, vW, 3, 4, seed + 109);
      const fineCrystal = tileFbm(u, v, 16, 3, seed + 223);

      // Integer-periodic diagonal mineral veins (100% seamless wrap at u=0..1, v=0..1)
      const phase1 = (u * 2.0 + v * 1.0) * Math.PI * 2.0 + warpX * 7.8 + cloud * 4.2;
      const wave1 = Math.abs(Math.sin(phase1));
      const primaryVein = Math.pow(Math.max(0.0, 1.0 - wave1), 5.2);

      const phase2 = (u * 1.0 - v * 3.0) * Math.PI * 2.0 + warpY * 6.4 + fineCrystal * 3.1;
      const wave2 = Math.abs(Math.sin(phase2));
      const secondaryVein = Math.pow(Math.max(0.0, 1.0 - wave2), 7.5);

      const goldPhase = (u * 3.0 + v * 2.0) * Math.PI * 2.0 + warpX * 5.2 - warpY * 4.1;
      const goldThread = Math.pow(Math.max(0.0, 1.0 - Math.abs(Math.sin(goldPhase))), 14.0);

      // Honed ivory-travertine Carrara stone calibrated strictly below AgX/bloom blowout threshold
      const mineralShade = 0.92 + (cloud - 0.5) * 0.10 + (fineCrystal - 0.5) * 0.06;
      let r = 198 * mineralShade;
      let g = 192 * mineralShade;
      let b = 184 * mineralShade;

      // Crisp slate-taupe primary Carrara veins
      const veinStrength = clamp01(primaryVein * 0.80 + secondaryVein * 0.48);
      r = lerp(r, 98, veinStrength * 0.72);
      g = lerp(g, 102, veinStrength * 0.70);
      b = lerp(b, 114, veinStrength * 0.64);

      // Rich warm golden mineral inclusions (Calacatta Gold accent)
      r = lerp(r, 194, goldThread * 0.76);
      g = lerp(g, 146, goldThread * 0.68);
      b = lerp(b, 58, goldThread * 0.76);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      // Crisp mineral relief & honed matte-satin roughness (avoids grazing sun glare blowout)
      const h = clamp01(0.68 + (fineCrystal - 0.5) * 0.14 - veinStrength * 0.24 - goldThread * 0.10);
      height[pIdx] = h;
      rough[pIdx] = clamp01(0.52 + veinStrength * 0.22 + (1.0 - fineCrystal) * 0.14 - goldThread * 0.20);
      ao[pIdx] = clamp01(0.80 + 0.20 * h - veinStrength * 0.14);
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, renderer),
    normalMap: buildSobelNormalTexture(height, size, 2.15, repeatX, repeatY, anisotropy, renderer),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, renderer)
  };
}

/**
 * Generates a 512x512 lush celestial moss, clover, and meadow turf PBR texture set
 * (`map`, `normalMap`, `roughnessMap`, `aoMap`) with scattered sakura petal flecks.
 */
export function createCelestialTurfPbrTextures(
  renderer?: THREE.WebGLRenderer,
  options?: { size?: number; seed?: number; repeatX?: number; repeatY?: number }
): PbrTextureSet {
  const size = options?.size ?? 512;
  const seed = options?.seed ?? 3319;
  const repeatX = options?.repeatX ?? 1;
  const repeatY = options?.repeatY ?? 1;
  const anisotropy = getSafeAnisotropy(renderer);

  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      const macroMoss = tileFbm(u, v, 4, 4, seed + 11);
      const bladeTuft = tileFbm(u, v, 24, 3, seed + 47);
      const microGrain = tileNoise(u, v, 64, seed + 91);
      const cloverCluster = smoothstepJS(0.60, 0.80, tileFbm(u, v, 10, 3, seed + 173));
      const petalMask = smoothstepJS(0.81, 0.90, tileFbm(u, v, 14, 2, seed + 257));

      const turfH = clamp01(0.28 + bladeTuft * 0.45 + microGrain * 0.16 + cloverCluster * 0.15);

      // Deep emerald-moss shadow -> sunlit spring clover meadow
      let r = lerp(42, 86, turfH) * (0.86 + macroMoss * 0.28);
      let g = lerp(88, 152, turfH) * (0.88 + macroMoss * 0.24);
      let b = lerp(48, 72, turfH) * (0.88 + macroMoss * 0.20);

      // Lush clover highlights
      r = lerp(r, 114, cloverCluster * 0.45);
      g = lerp(g, 174, cloverCluster * 0.45);
      b = lerp(b, 86, cloverCluster * 0.35);

      // Delicate fallen sakura petal flecks nestled in moss
      r = lerp(r, 238, petalMask * 0.72);
      g = lerp(g, 174, petalMask * 0.72);
      b = lerp(b, 198, petalMask * 0.72);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(r);
      albedo[cIdx + 1] = clampByte(g);
      albedo[cIdx + 2] = clampByte(b);
      albedo[cIdx + 3] = 255;

      height[pIdx] = turfH;
      rough[pIdx] = clamp01(0.82 + (1.0 - turfH) * 0.12 - petalMask * 0.10);
      ao[pIdx] = clamp01(0.58 + 0.42 * turfH);
    }
  }

  return {
    map: finalizeDataTexture(albedo, size, true, repeatX, repeatY, anisotropy, renderer),
    normalMap: buildSobelNormalTexture(height, size, 2.2, repeatX, repeatY, anisotropy, renderer),
    roughnessMap: buildGrayscaleTexture(rough, size, repeatX, repeatY, anisotropy, renderer),
    aoMap: buildGrayscaleTexture(ao, size, repeatX, repeatY, anisotropy, renderer)
  };
}

/**
 * Generates a crisp 512x512 alpha-tested botanical cherry blossom (sakura) & spring leaf cluster atlas.
 * Uses a clean DataTexture fallback in headless Node environments where `document` is absent.
 */
export function createSakuraBlossomAtlasTexture(
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
        const inside = dx * dx + dy * dy < 0.72;
        const idx = (y * fallbackSize + x) * 4;
        data[idx] = 248;
        data[idx + 1] = 188;
        data[idx + 2] = 212;
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

  const drawSakuraLeaf = (cx: number, cy: number, angle: number, length: number, width: number, bright: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-width * 0.65, -length * 0.45, 0, -length);
    ctx.quadraticCurveTo(width * 0.65, -length * 0.45, 0, 0);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, -length);
    grad.addColorStop(0.0, `rgb(${clampByte(76 * bright)}, ${clampByte(126 * bright)}, ${clampByte(56 * bright)})`);
    grad.addColorStop(0.7, `rgb(${clampByte(124 * bright)}, ${clampByte(178 * bright)}, ${clampByte(82 * bright)})`);
    grad.addColorStop(1.0, `rgb(${clampByte(154 * bright)}, ${clampByte(198 * bright)}, ${clampByte(104 * bright)})`);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -length * 0.06);
    ctx.lineTo(0, -length * 0.90);
    ctx.lineWidth = Math.max(1.1, width * 0.06);
    ctx.strokeStyle = `rgba(182, 224, 134, 0.72)`;
    ctx.stroke();
    ctx.restore();
  };

  const drawBlossom = (cx: number, cy: number, radius: number, rot: number, pinkness: number, bright: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    for (let p = 0; p < 5; p++) {
      ctx.save();
      ctx.rotate((p * Math.PI * 2) / 5);

      // Authentic notched sakura petal silhouette
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-radius * 0.48, -radius * 0.34, -radius * 0.54, -radius * 0.88, -radius * 0.14, -radius * 0.98);
      ctx.lineTo(0, -radius * 0.85); // characteristic sakura petal notch
      ctx.lineTo(radius * 0.14, -radius * 0.98);
      ctx.bezierCurveTo(radius * 0.54, -radius * 0.88, radius * 0.48, -radius * 0.34, 0, 0);
      ctx.closePath();

      const grad = ctx.createRadialGradient(0, -radius * 0.12, radius * 0.05, 0, -radius * 0.5, radius * 0.95);
      const innerR = clampByte(lerp(245, 226, pinkness) * bright);
      const innerG = clampByte(lerp(168, 118, pinkness) * bright);
      const innerB = clampByte(lerp(194, 152, pinkness) * bright);
      const outerR = clampByte(lerp(255, 252, pinkness) * bright);
      const outerG = clampByte(lerp(244, 212, pinkness) * bright);
      const outerB = clampByte(lerp(248, 228, pinkness) * bright);

      grad.addColorStop(0.0, `rgb(${innerR}, ${innerG}, ${innerB})`);
      grad.addColorStop(0.58, `rgb(${clampByte(lerp(innerR, outerR, 0.65))}, ${clampByte(lerp(innerG, outerG, 0.65))}, ${clampByte(lerp(innerB, outerB, 0.65))})`);
      grad.addColorStop(1.0, `rgb(${outerR}, ${outerG}, ${outerB})`);

      ctx.fillStyle = grad;
      ctx.fill();

      ctx.lineWidth = Math.max(0.8, radius * 0.025);
      ctx.strokeStyle = `rgba(210, 128, 156, 0.42)`;
      ctx.stroke();
      ctx.restore();
    }

    // Crimson corolla eye & golden anthers
    const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.24);
    centerGrad.addColorStop(0.0, 'rgba(186, 46, 86, 0.95)');
    centerGrad.addColorStop(1.0, 'rgba(232, 118, 148, 0.0)');
    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();

    for (let s = 0; s < 10; s++) {
      const sa = (s / 10) * Math.PI * 2 + 0.2;
      const sr = radius * (0.14 + (s % 2) * 0.07);
      const sx = Math.cos(sa) * sr;
      const sy = Math.sin(sa) * sr;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sx, sy);
      ctx.lineWidth = Math.max(0.7, radius * 0.02);
      ctx.strokeStyle = 'rgba(246, 204, 154, 0.85)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.1, radius * 0.036), 0, Math.PI * 2);
      ctx.fillStyle = '#ffd468';
      ctx.fill();
    }

    ctx.restore();
  };

  // Prominent forked silver-cherry woody twigs with visible sky gaps between 3 airy blossom sub-clusters
  const drawBranchStroke = (wScale: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.016 * wScale;
    ctx.beginPath();
    // Main ascending cherry bough stem
    ctx.moveTo(size * 0.50, size * 0.94);
    ctx.quadraticCurveTo(size * 0.48, size * 0.64, size * 0.51, size * 0.24);
    // Left sweeping lateral bough fork (leaving open sky gap between left & center clusters)
    ctx.moveTo(size * 0.49, size * 0.72);
    ctx.quadraticCurveTo(size * 0.31, size * 0.62, size * 0.16, size * 0.46);
    ctx.moveTo(size * 0.28, size * 0.58);
    ctx.lineTo(size * 0.22, size * 0.36);
    // Right sweeping lateral bough fork (leaving open sky gap between right & center clusters)
    ctx.moveTo(size * 0.50, size * 0.66);
    ctx.quadraticCurveTo(size * 0.69, size * 0.56, size * 0.84, size * 0.42);
    ctx.moveTo(size * 0.71, size * 0.53);
    ctx.lineTo(size * 0.78, size * 0.32);
    ctx.stroke();
  };
  drawBranchStroke(1.0, '#4a3032');
  drawBranchStroke(0.45, '#7c5658');

  // Tender young spring leaves tucked near the 3 distinct bough forks
  const leaves: Array<[number, number, number, number, number, number]> = [
    [0.22, 0.56, -0.92, 0.16, 0.08, 0.88],
    [0.78, 0.52, 0.88, 0.16, 0.08, 0.90],
    [0.16, 0.40, -1.18, 0.14, 0.07, 0.94],
    [0.84, 0.38, 1.12, 0.14, 0.07, 0.94],
    [0.50, 0.28, 0.08, 0.16, 0.08, 1.0]
  ];
  for (const [lx, ly, ang, len, wid, br] of leaves) {
    drawSakuraLeaf(lx * size, ly * size, ang, len * size, wid * size, br);
  }

  // Back shadowed blossoms grouped into 3 distinct airy bough clusters (left sprig, right sprig, upper crown)
  // leaving clear open sky gaps & exposed dark cherry branches at (0.36, 0.54) and (0.64, 0.52)
  const backBlossoms: Array<[number, number, number, number, number, number]> = [
    // Left sprig cluster
    [0.18, 0.52, 0.095, 0.2, 0.82, 0.86],
    [0.26, 0.38, 0.090, 1.4, 0.85, 0.88],
    // Right sprig cluster
    [0.82, 0.48, 0.095, 0.9, 0.76, 0.86],
    [0.74, 0.34, 0.090, 2.1, 0.78, 0.88],
    // Upper crown sprig cluster
    [0.44, 0.24, 0.096, 1.1, 0.72, 0.90],
    [0.58, 0.24, 0.096, 2.4, 0.70, 0.90],
    // Lower stem accent blossom
    [0.50, 0.78, 0.088, 0.5, 0.88, 0.85]
  ];
  for (const [bx, by, rad, rot, pk, br] of backBlossoms) {
    drawBlossom(bx * size, by * size, rad * size, rot, pk, br);
  }

  // Front sunlit blossoms (3 airy, separated botanical clusters with open sky gaps between them)
  const frontBlossoms: Array<[number, number, number, number, number, number]> = [
    // Left bough cluster
    [0.16, 0.44, 0.105, 0.75, 0.58, 0.99],
    [0.24, 0.46, 0.096, 2.25, 0.48, 0.98],
    [0.20, 0.34, 0.088, 1.15, 0.62, 0.97],
    // Right bough cluster
    [0.84, 0.40, 0.105, 1.35, 0.48, 0.99],
    [0.76, 0.42, 0.096, 0.55, 0.56, 0.98],
    [0.80, 0.30, 0.088, 2.05, 0.60, 0.97],
    // Top center bough cluster
    [0.50, 0.20, 0.112, 0.42, 0.38, 1.02],
    [0.42, 0.18, 0.094, 1.85, 0.52, 1.00],
    [0.58, 0.18, 0.094, 0.92, 0.44, 1.01],
    // Delicate lower fork accent
    [0.49, 0.68, 0.092, 1.65, 0.54, 0.96]
  ];
  for (const [bx, by, rad, rot, pk, br] of frontBlossoms) {
    drawBlossom(bx * size, by * size, rad * size, rot, pk, br);
  }

  // Color-bleed RGB into alpha < 20 pixels to eliminate dark mipmap borders
  const imgData = ctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 20) {
      px[i] = 236;
      px[i + 1] = 178;
      px[i + 2] = 198;
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
 * Legacy helper retained for compatibility — delegates to 512x512 Carrara & Detail textures.
 */
export function createPearlescentMarbleTextures(renderer?: THREE.WebGLRenderer): {
  marbleMap: THREE.DataTexture;
  detailMap: THREE.DataTexture;
} {
  const set = createCarraraMarblePbrTextures(renderer, { size: 512 });
  return {
    marbleMap: set.map,
    detailMap: set.aoMap
  };
}

/**
 * 1. Luminous Golden-Rose-Azure Celestial Sky Dome with Solar Aura & Multi-Octave Cirrus
 */
export function createParadiseSkyMaterial(customUniforms?: Partial<{
  topColor: string | THREE.Color;
  bottomColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
  sunDirection: [number, number, number] | THREE.Vector3;
  sunGlow: number;
  cloudSpeed: number;
  swirlSpeed: number;
}>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uTopColor: { value: toColor(customUniforms?.topColor, '#1e64c8') },
      uBottomColor: { value: toColor(customUniforms?.bottomColor, '#d495b8') },
      uHorizonColor: { value: toColor(customUniforms?.horizonColor, '#f6d4a6') },
      uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
      uSunGlow: { value: customUniforms?.sunGlow ?? 0.85 },
      uCloudSpeed: { value: customUniforms?.cloudSpeed ?? 0.45 },
      uSwirlSpeed: { value: customUniforms?.swirlSpeed ?? 0.5 },
      uBassEnergy: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = position;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDirection;
      uniform float uSunGlow;
      uniform float uCloudSpeed;
      uniform float uSwirlSpeed;
      uniform float uBassEnergy;

      varying vec3 vWorldDir;

      float hash31(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.23, 0.17));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
              mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
              mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z
        );
      }

      float fbm3(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise3(p);
          p = p * 2.04 + vec3(11.3, 7.1, 17.9);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        vec3 sunDir = normalize(uSunDirection);

        float h = clamp(dir.y, -0.35, 1.0);
        float upperT = smoothstep(-0.02, 0.15, h);
        float zenithT = smoothstep(0.08, 0.48, h);

        vec3 horizonBase = uHorizonColor * 0.56;
        vec3 roseMid = uBottomColor * 0.50;
        vec3 azureZenith = uTopColor * 0.86;

        vec3 sky = mix(horizonBase, roseMid, upperT);
        sky = mix(sky, azureZenith, zenithT);

        // Warm golden-pearl horizon atmospheric glow
        float sunCos = max(dot(dir, sunDir), 0.0);
        float sunAzimuthScatter = pow(sunCos, 3.6) * smoothstep(0.48, -0.06, dir.y);
        sky += vec3(0.30, 0.18, 0.07) * sunAzimuthScatter;

        // Horizon cloud-bank atmospheric veil (seamless 360° golden-pearl horizon band)
        float horizonBand = exp(-abs(dir.y - 0.02) * 14.0);
        float hCloud = fbm3(vec3(dir.x * 5.2 + uTime * 0.008, dir.y * 12.0, dir.z * 5.2));
        vec3 pearlVeil = mix(vec3(0.68, 0.58, 0.56), vec3(0.92, 0.76, 0.58), pow(sunCos, 1.8));
        sky = mix(sky, pearlVeil, horizonBand * smoothstep(0.32, 0.78, hCloud) * 0.42);

        // Below horizon smoothly transitions to warm pearl-gold mist under the cloud sea
        if (dir.y < 0.0) {
          float belowT = smoothstep(0.0, -0.35, dir.y);
          sky = mix(sky, horizonBase * 0.88 + vec3(0.08, 0.07, 0.09), belowT);
        }

        // High-altitude iridescent pearl cirrus ribbons in 3D sphere coords (100% seam-free)
        if (dir.y > 0.02) {
          float drift = uTime * 0.018 * max(uCloudSpeed, 0.05);
          vec3 cCoord = dir * 3.6 + vec3(drift, -drift * 0.25, drift * 0.6);
          float wispA = fbm3(cCoord);
          float wispB = fbm3(cCoord * 2.35 - vec3(drift * 0.6, 0.0, drift * 0.4));
          float cirrus = smoothstep(0.48, 0.82, wispA * 0.62 + wispB * 0.38);
          float altFade = smoothstep(0.02, 0.20, dir.y) * smoothstep(0.99, 0.52, dir.y);
          vec3 cirrusCol = mix(vec3(0.56, 0.56, 0.66), vec3(0.84, 0.70, 0.54), pow(sunCos, 2.0));
          sky = mix(sky, cirrusCol, cirrus * altFade * 0.42);
        }

        // Radial solar tangent frame for delicate sky god-ray streaks
        vec3 worldUp = abs(sunDir.y) > 0.98 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
        vec3 sunRight = normalize(cross(worldUp, sunDir));
        vec3 sunUp = cross(sunDir, sunRight);
        vec2 sunPlane = vec2(dot(dir, sunRight), dot(dir, sunUp));
        float rayAngle = atan(sunPlane.y, sunPlane.x);

        float rayWave1 = sin(rayAngle * 14.0 + uTime * 0.18 * uSwirlSpeed) * 0.5 + 0.5;
        float rayWave2 = sin(rayAngle * 23.0 - uTime * 0.14 * uSwirlSpeed + 1.4) * 0.5 + 0.5;
        float rayNoise = fbm3(vec3(sunPlane * 4.5, uTime * 0.04));
        float skyRays = pow(rayWave1 * 0.55 + rayWave2 * 0.45, 2.4) * (0.55 + 0.45 * rayNoise) * exp(- acos(clamp(sunCos, 0.0, 1.0)) * 5.2);

        float sunAngle = acos(clamp(dot(dir, sunDir), -1.0, 1.0));
        // 22-degree atmospheric ice-crystal halo + subtle horizontal parhelia sundogs
        float halo22 = exp(-pow((sunAngle - 0.384) * 15.0, 2.0)) * 0.16;
        float sundogMask = exp(-pow(sunPlane.y * 12.0, 2.0)) * exp(-pow((abs(sunPlane.x) - 0.384) * 18.0, 2.0));
        vec3 haloTint = mix(vec3(0.95, 0.64, 0.42), vec3(0.52, 0.80, 1.0), smoothstep(0.32, 0.45, sunAngle));

        // Multi-exponential Mie atmospheric solar corona (replaces flat hard-edged disc)
        float glowBoost = max(0.2, uSunGlow) * (1.0 + uBassEnergy * 0.18);
        float solarCore = exp(-sunAngle * sunAngle * 4200.0) * 2.25 * glowBoost;
        float innerCorona = exp(-sunAngle * 24.0) * 0.78 * glowBoost;
        float mieAureole = exp(-sunAngle * 6.2) * 0.34 * glowBoost;
        float wideScatter = exp(-sunAngle * 2.2) * 0.12 * glowBoost;

        sky += vec3(1.0, 0.94, 0.78) * solarCore;
        sky += vec3(1.0, 0.86, 0.58) * (innerCorona + skyRays * 0.28 * glowBoost);
        sky += vec3(0.98, 0.74, 0.48) * (mieAureole + wideScatter);
        sky += haloTint * (halo22 + sundogMask * 0.24) * glowBoost;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });
}

/**
 * 2. Shimmering Celestial Rainbow & Aurora Halo Arch
 */
export function createRainbowAuroraMaterial(customUniforms?: Partial<{
  radiance: number;
  swirlSpeed: number;
}>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uRadiance: { value: customUniforms?.radiance ?? 1.0 },
      uSwirlSpeed: { value: customUniforms?.swirlSpeed ?? 0.6 }
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
      uniform float uRadiance;
      uniform float uSwirlSpeed;
      varying vec2 vUv;
      varying vec3 vWorldPos;

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

      vec3 spectralRainbow(float s) {
        // Physically ordered atmospheric spectral dispersion (violet -> indigo -> cyan -> green -> gold -> crimson)
        vec3 cViolet = vec3(0.52, 0.24, 0.92);
        vec3 cBlue   = vec3(0.18, 0.56, 0.98);
        vec3 cMint   = vec3(0.20, 0.84, 0.54);
        vec3 cGold   = vec3(0.98, 0.72, 0.16);
        vec3 cRose   = vec3(0.94, 0.24, 0.30);

        vec3 col = mix(cViolet, cBlue, smoothstep(0.06, 0.28, s));
        col = mix(col, cMint, smoothstep(0.28, 0.50, s));
        col = mix(col, cGold, smoothstep(0.50, 0.72, s));
        col = mix(col, cRose, smoothstep(0.72, 0.94, s));
        return col;
      }

      void main() {
        float t = clamp(vUv.y, 0.0, 1.0);
        float archFade = smoothstep(0.0, 0.20, vUv.x) * smoothstep(1.0, 0.80, vUv.x);

        // Primary optical bow (inner violet -> outer red) + delicate supernumerary inner glow
        float pCoord = clamp((t - 0.16) / 0.36, 0.0, 1.0);
        float primaryEnv = exp(-pow((t - 0.34) / 0.135, 2.0));
        float supernumerary = exp(-pow((t - 0.15) / 0.05, 2.0)) * (0.5 + 0.5 * sin(t * 95.0)) * 0.22;
        vec3 primaryCol = spectralRainbow(pCoord);

        // Inverted secondary optical bow outside Alexander's dark band (red inner -> violet outer)
        float sCoord = clamp(1.0 - (t - 0.64) / 0.30, 0.0, 1.0);
        float secondaryEnv = exp(-pow((t - 0.79) / 0.115, 2.0)) * 0.42;
        vec3 secondaryCol = spectralRainbow(sCoord);

        float speed = max(uSwirlSpeed, 0.1);
        float curtain1 = aNoise(vec2(vUv.x * 14.0 - uTime * 0.14 * speed, t * 2.4 + uTime * 0.05));
        float curtain2 = aNoise(vec2(vUv.x * 28.0 + uTime * 0.10 * speed, t * 3.8));
        float mistMod = 0.62 + 0.38 * (curtain1 * 0.65 + curtain2 * 0.35);
        float shimmer = 0.90 + 0.10 * sin(vUv.x * 22.0 - uTime * 0.80 * speed);

        vec3 atmosphericGlow = primaryCol * (primaryEnv + supernumerary) + secondaryCol * secondaryEnv;
        vec3 col = atmosphericGlow * (0.72 + 0.32 * mistMod) * uRadiance;

        float totalEnv = clamp(primaryEnv + supernumerary + secondaryEnv, 0.0, 1.0);
        float alpha = archFade * totalEnv * shimmer * (0.28 + 0.24 * mistMod);
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/**
 * 3. Volumetric Heavenly God-Rays Descending from the Sun
 */
export function createHeavenlyGodRayMaterial(customUniforms?: Partial<{
  radiance: number;
}>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uRadiance: { value: customUniforms?.radiance ?? 1.0 }
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
      uniform float uRadiance;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float facing = pow(max(abs(dot(N, V)), 0.0001), 2.5);
        float streak = 0.70 + 0.30 * sin(vUv.x * 18.849556 + uTime * 0.35 + vWorldPos.x * 0.1);
        float vertFade = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.16, vUv.y);
        float shimmer = 0.82 + 0.18 * sin(uTime * 0.55 + vWorldPos.x * 0.14 + vWorldPos.z * 0.12);
        float camDist = length(cameraPosition - vWorldPos);
        float nearFade = smoothstep(12.0, 26.0, camDist);
        float farFade = smoothstep(170.0, 35.0, camDist);

        float alpha = facing * streak * vertFade * shimmer * nearFade * farFade * 0.048 * uRadiance;
        if (alpha < 0.002) discard;

        vec3 rayColor = mix(vec3(1.0, 0.85, 0.56), vec3(1.0, 0.95, 0.82), vUv.y);
        gl_FragColor = vec4(rayColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/**
 * 4. Infinite 360° Sea of Sunlit Multi-Octave FBM Volumetric Clouds beneath the Floating Sanctuary
 */
export function createCloudSeaMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  cloudSpeed: number;
  cloudTopColor: string | THREE.Color;
  cloudShadowColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uCloudSpeed: { value: customUniforms?.cloudSpeed ?? 0.45 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uCloudTopColor: { value: toColor(customUniforms?.cloudTopColor, '#fffaf0') },
    uCloudShadowColor: { value: toColor(customUniforms?.cloudShadowColor, '#9eb2da') },
    uHorizonColor: { value: toColor(customUniforms?.horizonColor, '#f6d4a6') }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uCloudSpeed;

      varying vec3 vWorldPos;
      varying float vBillowHeight;

      float csHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.31);
        return fract(p.x * p.y);
      }

      float csNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(csHash(i), csHash(i + vec2(1.0, 0.0)), u.x),
          mix(csHash(i + vec2(0.0, 1.0)), csHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 p = position;
        vec2 drift = vec2(uTime * 0.72 * max(uCloudSpeed, 0.05), uTime * 0.24 * max(uCloudSpeed, 0.05));
        float r = length(p.xz);
        float outerTaper = 1.0 - smoothstep(190.0, 320.0, r);

        float billow1 = csNoise(p.xz * 0.020 - drift * 0.04);
        float billow2 = csNoise(p.xz * 0.048 + drift * 0.06);
        float billow3 = csNoise(p.xz * 0.095 - drift * 0.09);
        float h = billow1 * 0.56 + billow2 * 0.30 + billow3 * 0.14;
        float swell = (h - 0.36) * 6.4 * outerTaper;

        p.y += swell;
        vBillowHeight = clamp(h, 0.0, 1.0);

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
      uniform float uCloudSpeed;
      uniform vec3 uSunDirection;
      uniform vec3 uCloudTopColor;
      uniform vec3 uCloudShadowColor;
      uniform vec3 uHorizonColor;

      varying vec3 vWorldPos;
      varying float vBillowHeight;

      float cfHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 31.17);
        return fract(p.x * p.y);
      }

      vec2 cfHash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123);
      }

      float cfNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(cfHash(i), cfHash(i + vec2(1.0, 0.0)), u.x),
          mix(cfHash(i + vec2(0.0, 1.0)), cfHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float cfWorley(vec2 p) {
        vec2 n = floor(p);
        vec2 f = fract(p);
        float md = 1.6;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = 0.5 + 0.42 * sin(cfHash2(n + g) * 6.2831);
            vec2 r = g + o - f;
            md = min(md, dot(r, r));
          }
        }
        return 1.0 - clamp(sqrt(md), 0.0, 1.0);
      }

      float cloudVolumetricDensity(vec2 xz, vec2 drift) {
        vec2 warp = vec2(
          cfNoise(xz * 0.015 + drift * 0.02),
          cfNoise(xz * 0.015 - drift * 0.02 + vec2(5.2, 1.3))
        );
        vec2 q = xz * 0.023 - drift * 0.032 + (warp - 0.5) * 0.85;
        float perlin = 0.0;
        float amp = 0.52;
        vec2 qp = q;
        for (int i = 0; i < 5; i++) {
          float n = cfNoise(qp);
          float billow = 1.0 - abs(n * 2.0 - 1.0);
          perlin += amp * mix(n, billow, 0.40);
          qp = qp * 2.04 + vec2(7.3, 13.1);
          amp *= 0.5;
        }
        float worleyA = cfWorley(q * 1.35 + vec2(uTime * 0.008, 0.0));
        float worleyB = cfWorley(q * 2.85 - vec2(0.0, uTime * 0.012));
        float cellular = worleyA * 0.65 + worleyB * 0.35;
        return clamp(mix(perlin, perlin * 0.55 + cellular * 0.55, 0.52), 0.0, 1.0);
      }

      float hgPhaseCloud(float cosTheta, float g) {
        float g2 = g * g;
        return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 0.004), 1.5));
      }

      void main() {
        vec2 drift = vec2(uTime * 0.72 * max(uCloudSpeed, 0.05), uTime * 0.24 * max(uCloudSpeed, 0.05));
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 viewDir = -V;

        // Multi-layer parallax volumetric marching beneath the undulating cloud sea surface
        vec2 sunStepXZ = L.xz * 2.4;
        float accumDensity = 0.0;
        float accumSunlit = 0.0;
        float transmittance = 1.0;

        float dCenter = cloudVolumetricDensity(vWorldPos.xz, drift);
        float dDx = cloudVolumetricDensity(vWorldPos.xz + vec2(2.0, 0.0), drift);
        float dDz = cloudVolumetricDensity(vWorldPos.xz + vec2(0.0, 2.0), drift);
        vec3 N = normalize(vec3((dCenter - dDx) * 3.4, 1.0, (dCenter - dDz) * 3.4));

        for (int layer = 0; layer < 4; layer++) {
          float lf = float(layer) / 3.0;
          vec2 sampleXZ = vWorldPos.xz + (viewDir.xz / max(abs(viewDir.y), 0.25)) * (lf * 7.5);
          float dLayer = cloudVolumetricDensity(sampleXZ + vec2(lf * 11.3, -lf * 7.7), drift * (1.0 - lf * 0.18));
          float dTowardSun = cloudVolumetricDensity(sampleXZ + sunStepXZ * (1.0 + lf * 0.6), drift);

          float layerMass = smoothstep(0.24, 0.84, dLayer * (1.0 - lf * 0.22));
          float sunShadow = exp(-max(0.0, dTowardSun - dLayer + 0.16) * 3.2);
          float stepAlpha = layerMass * (0.48 - lf * 0.08);
          accumSunlit += transmittance * stepAlpha * sunShadow * (1.0 - lf * 0.35);
          accumDensity += transmittance * stepAlpha;
          transmittance *= (1.0 - stepAlpha * 0.65);
        }

        float crest = smoothstep(0.28, 0.86, dCenter * 0.65 + vBillowHeight * 0.35);
        float NdotL = clamp(dot(N, L) * 0.60 + 0.42, 0.0, 1.0);
        float cosTheta = dot(viewDir, L);
        float hg = hgPhaseCloud(cosTheta, 0.56);
        float rimSilver = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 2.1) * (0.38 + 0.62 * NdotL);

        vec3 deepTroughCol = mix(vec3(0.22, 0.27, 0.44), uCloudShadowColor * 0.42, 0.55);
        vec3 midScatterCol = mix(uCloudShadowColor * 0.58, uCloudTopColor * 0.68, 0.48);
        vec3 sunlitCrestCol = uCloudTopColor * 0.78;
        vec3 warmSunsetRim = vec3(1.05, 0.74, 0.38);

        float litFactor = clamp(accumSunlit * 0.72 + crest * NdotL * 0.48, 0.0, 1.0);
        vec3 col = mix(deepTroughCol, midScatterCol, clamp(accumDensity * 1.15, 0.0, 1.0));
        col = mix(col, sunlitCrestCol, litFactor);
        col += warmSunsetRim * (hg * crest * 0.34 + rimSilver * 0.44 * (0.4 + 0.6 * crest));

        float radialDist = length(vWorldPos.xz);
        float horizonBlend = smoothstep(135.0, 290.0, radialDist);
        col = mix(col, uHorizonColor * 0.60, horizonBlend);

        float alpha = 1.0 - smoothstep(245.0, 325.0, radialDist);
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: true,
    fog: true
  });
}

/**
 * 5. Seamless Volumetric FBM-Dissolved Cloud Sea Billow Mounds (ZERO hard sphere edges!)
 */
export function createCloudBillowMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  cloudSpeed: number;
  horizonColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uCloudSpeed: { value: customUniforms?.cloudSpeed ?? 0.45 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uHorizonColor: { value: toColor(customUniforms?.horizonColor, '#f6d4a6') }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uCloudSpeed;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vLocalHeight;

      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      float cbHash(vec3 p) {
        p = fract(p * vec3(127.1, 311.7, 74.7));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float cbNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(cbHash(i), cbHash(i + vec3(1,0,0)), u.x),
              mix(cbHash(i + vec3(0,1,0)), cbHash(i + vec3(1,1,0)), u.x), u.y),
          mix(mix(cbHash(i + vec3(0,0,1)), cbHash(i + vec3(1,0,1)), u.x),
              mix(cbHash(i + vec3(0,1,1)), cbHash(i + vec3(1,1,1)), u.x), u.y),
          u.z
        );
      }

      void main() {
        #ifdef USE_INSTANCING_COLOR
        vInstanceColor = instanceColor;
        #endif

        vec3 p = position;
        float puff = cbNoise(position * 1.55 + vec3(uTime * 0.05 * max(uCloudSpeed, 0.05), 0.0, 0.0));
        float puff2 = cbNoise(position * 3.1 - vec3(0.0, uTime * 0.03, 0.0));
        p += normal * ((puff * 0.65 + puff2 * 0.35) - 0.38) * 0.52;
        vLocalHeight = clamp(position.y * 0.5 + 0.5, 0.0, 1.0);

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
      uniform float uTime;
      uniform float uCloudSpeed;
      uniform vec3 uSunDirection;
      uniform vec3 uHorizonColor;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vLocalHeight;

      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      float cbfHash(vec3 p) {
        p = fract(p * vec3(127.1, 311.7, 74.7));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float cbfNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(cbfHash(i), cbfHash(i + vec3(1,0,0)), u.x),
              mix(cbfHash(i + vec3(0,1,0)), cbfHash(i + vec3(1,1,0)), u.x), u.y),
          mix(mix(cbfHash(i + vec3(0,0,1)), cbfHash(i + vec3(1,0,1)), u.x),
              mix(cbfHash(i + vec3(0,1,1)), cbfHash(i + vec3(1,1,1)), u.x), u.y),
          u.z
        );
      }

      float cbfFbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * cbfNoise(p);
          p = p * 2.06 + vec3(5.3, 9.1, 3.7);
          a *= 0.5;
        }
        return v;
      }

      float cbfWorley(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        float md = 1.5;
        for (int z = -1; z <= 1; z++) {
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec3 nb = vec3(float(x), float(y), float(z));
              vec3 pt = nb + 0.5 + 0.38 * (cbfHash(i + nb) - 0.5);
              vec3 df = pt - f;
              md = min(md, dot(df, df));
            }
          }
        }
        return 1.0 - clamp(sqrt(md), 0.0, 1.0);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Multi-octave 3D Perlin + Worley cauliflower density & Fresnel feathering -> ZERO hard sphere edges
        vec3 windOff = vec3(uTime * 0.22 * max(uCloudSpeed, 0.05), 0.0, uTime * 0.08);
        vec3 sampleP = vWorldPos * 0.13 - windOff;
        float perlin = cbfFbm(sampleP);
        float worley = cbfWorley(sampleP * 1.45);
        float wisp = mix(perlin, worley * 0.65 + perlin * 0.35, 0.45);

        float facing = abs(dot(N, V));
        float silhouetteFeather = smoothstep(0.14, 0.70, facing + (wisp - 0.44) * 0.60);
        float baseFade = smoothstep(0.05, 0.36, vLocalHeight);
        float alpha = clamp(silhouetteFeather * baseFade * smoothstep(0.22, 0.72, wisp + 0.16) * 0.90, 0.0, 0.92);
        if (alpha < 0.015) discard;

        float NdotL = clamp(dot(N, L) * 0.58 + 0.42, 0.0, 1.0);
        float cosTheta = dot(-V, L);
        float forward = pow(max(cosTheta, 0.0001), 4.2) * 0.62;
        float silverEdge = pow(max(1.0 - facing, 0.0), 1.55) * (0.35 + 0.65 * wisp);
        float beerScatter = exp(- (1.0 - vLocalHeight) * 1.45) * (0.55 + 0.45 * wisp);

        vec3 shadowCol = vec3(0.24, 0.29, 0.45);
        vec3 litPearl = vec3(0.76, 0.70, 0.68);
        vec3 col = mix(shadowCol, litPearl, clamp(NdotL * beerScatter * 1.25, 0.0, 1.0));
        col += vec3(1.04, 0.78, 0.40) * (forward * 0.55 + silverEdge * 0.48);

        #ifdef USE_INSTANCING_COLOR
        col *= vInstanceColor;
        #endif

        float radialDist = length(vWorldPos.xz);
        col = mix(col, uHorizonColor * 0.58, smoothstep(125.0, 195.0, radialDist));

        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true
  });
}

/**
 * 6. Floating Sanctuary Walkable PBR Terrain Material (`MeshStandardMaterial` + `onBeforeCompile`):
 *    Receives PCFSoftShadowMap shadows & PMREM IBL while blending 512x512 Carrara Marble PBR
 *    courtyard/paths, golden radial filigree, sapphire pool bed, and 512x512 Celestial Moss/Clover Turf PBR!
 */
export function createParadiseGroundPbrMaterial(
  marbleSet: PbrTextureSet,
  turfSet: PbrTextureSet
): {
  material: THREE.MeshStandardMaterial;
  uniforms: { uTime: { value: number } };
} {
  const uniforms = {
    uTime: { value: 0.0 }
  };

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 1.0,
    metalness: 0.02,
    envMapIntensity: 0.30
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uMarbleMap = { value: marbleSet.map };
    shader.uniforms.uMarbleNormal = { value: marbleSet.normalMap };
    shader.uniforms.uMarbleRoughness = { value: marbleSet.roughnessMap };
    shader.uniforms.uTurfMap = { value: turfSet.map };
    shader.uniforms.uTurfNormal = { value: turfSet.normalMap };
    shader.uniforms.uTurfRoughness = { value: turfSet.roughnessMap };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vGroundWorldPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vGroundWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform sampler2D uMarbleMap;
        uniform sampler2D uMarbleNormal;
        uniform sampler2D uMarbleRoughness;
        uniform sampler2D uTurfMap;
        uniform sampler2D uTurfNormal;
        uniform sampler2D uTurfRoughness;
        varying vec3 vGroundWorldPos;

        float pgDistToSegment(vec2 p, vec2 a, vec2 b) {
          vec2 pa = p - a;
          vec2 ba = b - a;
          float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
          return length(pa - ba * h);
        }

        float pgHash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float pgGoldenCaustic(vec2 xz, float t) {
          vec2 p1 = xz * 2.7 + vec2(t * 0.24, -t * 0.18);
          vec2 p2 = xz * 3.5 + vec2(-t * 0.19, t * 0.26);
          vec2 p3 = xz * 5.8 + vec2(t * 0.31, t * 0.21);
          float c1 = abs(sin(p1.x + sin(p1.y * 1.45)) * cos(p1.y + cos(p1.x * 1.35)));
          float c2 = abs(sin(p2.x * 1.2 - cos(p2.y * 1.1)) * cos(p2.y + sin(p2.x * 1.2)));
          float c3 = abs(sin(p3.x - sin(p3.y * 1.25)) * cos(p3.y + cos(p3.x * 1.15)));
          float netA = pow(clamp(1.0 - min(c1, c2), 0.0, 1.0), 5.5);
          float netB = pow(clamp(1.0 - min(c2, c3), 0.0, 1.0), 7.0);
          return netA * 0.76 + netB * 0.52;
        }

        void evalParadiseZones(vec2 xz, out float stoneMask, out float poolBedMask, out float filigreeMask, out float borderBand, out float dTemple, out float dPool) {
          dTemple = length(xz - vec2(0.0, -14.0));
          float daisMask = 1.0 - smoothstep(7.4, 9.8, dTemple);
          float courtyardMask = 1.0 - smoothstep(11.0, 13.8, length(xz - vec2(0.0, 1.5)));

          float dPromenade = pgDistToSegment(xz, vec2(0.0, 32.0), vec2(0.0, -14.0));
          float promenadeMask = 1.0 - smoothstep(2.5, 3.4, dPromenade);

          float dCliffPath = pgDistToSegment(xz, vec2(6.0, 1.5), vec2(31.5, -14.5));
          float cliffPathMask = 1.0 - smoothstep(1.8, 2.7, dCliffPath);

          float dBlossomPath = pgDistToSegment(xz, vec2(-5.5, 2.0), vec2(-23.0, 6.0));
          float blossomPathMask = 1.0 - smoothstep(1.8, 2.7, dBlossomPath);

          float dVistaPath = pgDistToSegment(xz, vec2(-3.0, 12.0), vec2(-14.5, 24.5));
          float vistaPathMask = 1.0 - smoothstep(1.8, 2.7, dVistaPath);

          // Curved Colonnade Wing avenues & Arched Footbridge approaches to East/West Outer Pavilions
          float dEastWing = pgDistToSegment(xz, vec2(8.0, -14.0), vec2(35.0, -10.0));
          float eastWingMask = 1.0 - smoothstep(2.4, 3.4, dEastWing);
          float dWestWing = pgDistToSegment(xz, vec2(-8.0, -14.0), vec2(-35.0, -10.0));
          float westWingMask = 1.0 - smoothstep(2.4, 3.4, dWestWing);

          float dEastPavilion = length(xz - vec2(48.0, -10.0));
          float dWestPavilion = length(xz - vec2(-48.0, -10.0));
          float outerPavilionMask = (1.0 - smoothstep(4.6, 6.0, dEastPavilion)) + (1.0 - smoothstep(4.6, 6.0, dWestPavilion));
          float dBridgePath = min(
            pgDistToSegment(xz, vec2(33.5, -10.0), vec2(48.0, -10.0)),
            pgDistToSegment(xz, vec2(-33.5, -10.0), vec2(-48.0, -10.0))
          );
          float bridgeApproachMask = 1.0 - smoothstep(2.1, 2.9, dBridgePath);

          float r = length(xz);
          // Keep marble balustrade rim walk strictly inside r=35.2..37.2 so cliff lip (r > 38.0) is natural mossy limestone
          float rimMask = smoothstep(35.0, 36.2, r) * (1.0 - smoothstep(37.2, 38.4, r));

          float wingAndOuter = max(max(eastWingMask, westWingMask), max(outerPavilionMask, bridgeApproachMask));
          stoneMask = clamp(
            max(max(max(daisMask, courtyardMask), max(promenadeMask, cliffPathMask)), max(max(blossomPathMask, vistaPathMask), max(rimMask, wingAndOuter))),
            0.0, 1.0
          );

          dPool = length(xz - vec2(0.0, 2.0));
          float dSouthPool = length(xz - vec2(0.0, 74.0));
          float dNorthPool = length(xz - vec2(0.0, -76.0));
          float mainPoolMask = 1.0 - smoothstep(4.7, 5.4, dPool);
          float southPoolMask = 1.0 - smoothstep(4.7, 5.4, dSouthPool);
          float northPoolMask = 1.0 - smoothstep(4.3, 5.0, dNorthPool);
          poolBedMask = clamp(max(mainPoolMask, max(southPoolMask, northPoolMask)), 0.0, 1.0);
          stoneMask = max(stoneMask, poolBedMask);

          float dAnyRotunda = min(dTemple, min(dEastPavilion * 1.4, dWestPavilion * 1.4));
          float radialRings = smoothstep(0.955, 0.99, cos(dAnyRotunda * 2.8)) * (1.0 - smoothstep(4.5, 7.6, dAnyRotunda));
          float angleTemple = atan(xz.y + 14.0, xz.x);
          float radialSpokes = smoothstep(0.96, 0.995, cos(angleTemple * 12.0)) * (1.0 - smoothstep(1.8, 7.2, dTemple)) * smoothstep(0.9, 1.8, dTemple);
          // Crisp golden courtyard border rings framing the fountain pool & central promenade
          float poolInlayRing = smoothstep(0.09, 0.02, abs(dPool - 6.35)) + smoothstep(0.11, 0.02, abs(dPool - 9.85));
          float anglePool = atan(xz.y - 2.0, xz.x);
          float poolSpokes = smoothstep(0.975, 0.996, cos(anglePool * 8.0)) * smoothstep(5.6, 6.2, dPool) * (1.0 - smoothstep(9.8, 10.4, dPool));
          filigreeMask = clamp(radialRings + radialSpokes + poolInlayRing + poolSpokes, 0.0, 1.0) * (1.0 - poolBedMask);

          borderBand = smoothstep(0.12, 0.48, stoneMask) * (1.0 - smoothstep(0.48, 0.88, stoneMask));
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 gxz = vGroundWorldPos.xz;
        float gStoneMask, gPoolBedMask, gFiligreeMask, gBorderBand, gDTemple, gDPool;
        evalParadiseZones(gxz, gStoneMask, gPoolBedMask, gFiligreeMask, gBorderBand, gDTemple, gDPool);

        // Multi-scale Carrara marble sampling calibrated below bloom blowout threshold
        vec2 mWarp = vec2(
          sin(gxz.x * 0.14 + gxz.y * 0.09),
          cos(gxz.y * 0.13 - gxz.x * 0.10)
        ) * 0.18;
        vec3 mFine = texture2D(uMarbleMap, gxz * 0.24 + mWarp * 0.08).rgb;
        vec3 mMacro = texture2D(uMarbleMap, gxz * 0.055 + vec2(0.31, 0.17)).rgb;
        vec3 gMarble = mix(mFine, mMacro, 0.38) * vec3(0.70, 0.67, 0.63);

        // Crisp carved running-bond ashlar pavers & radial temple flagstone bevel seams
        float paverScale = 0.48;
        float rowIdx = floor(gxz.y * paverScale);
        float staggerX = gxz.x * paverScale + mod(rowIdx, 2.0) * 0.5;
        vec2 paverCell = vec2(floor(staggerX), rowIdx);
        float paverVar = 0.92 + 0.14 * pgHash21(paverCell);
        float flagGridX = abs(fract(staggerX) - 0.5);
        float flagGridZ = abs(fract(gxz.y * paverScale) - 0.5);
        float flagSeam = smoothstep(0.455, 0.492, max(flagGridX, flagGridZ));
        float radialRingSeam = smoothstep(0.055, 0.015, abs(fract(gDTemple * 0.50) - 0.5));
        float angleRay = atan(gxz.y + 14.0, gxz.x);
        float radialRaySeam = smoothstep(0.986, 0.998, cos(angleRay * 16.0)) * (1.0 - smoothstep(8.0, 10.5, gDTemple));
        float seamFactor = mix(flagSeam, max(radialRingSeam, radialRaySeam), smoothstep(10.5, 7.5, gDTemple));
        float stoneJoint = clamp(1.0 - seamFactor, 0.0, 1.0);
        gMarble *= paverVar * mix(0.62, 1.0, stoneJoint);

        // Burnished golden-bronze inlaid veins across temple dais & courtyard rings
        gMarble = mix(gMarble, vec3(0.84, 0.60, 0.18), gFiligreeMask * 0.88);

        // Jewel sapphire-aquamarine pool floor mosaic with concentric golden inlay rings
        float poolRings = smoothstep(0.92, 0.99, cos(gDPool * 4.8));
        vec3 poolMosaic = mix(
          vec3(0.05, 0.24, 0.36),
          vec3(0.14, 0.42, 0.54),
          0.5 + 0.5 * sin(gDPool * 5.0 - uTime * 1.4)
        );
        poolMosaic = mix(poolMosaic, vec3(0.68, 0.50, 0.18), poolRings * 0.48);
        gMarble = mix(gMarble, poolMosaic, gPoolBedMask * 0.95);

        // Multi-scale moss & clover micro-turf with world-space anti-tiling variation
        vec3 tFine = texture2D(uTurfMap, gxz * 0.32).rgb;
        vec3 tMacro = texture2D(uTurfMap, gxz * 0.075 + vec2(0.42, 0.19)).rgb;
        vec3 tMicro = texture2D(uTurfMap, gxz * 0.92 + vec2(0.17, 0.63)).rgb;
        float cloverPatch = smoothstep(0.48, 0.82,
          sin(gxz.x * 0.36 + cos(gxz.y * 0.29) * 1.8) * 0.5 + 0.5
        );
        float microClover = smoothstep(0.54, 0.86,
          sin(gxz.x * 2.1 + gxz.y * 1.7) * cos(gxz.x * 1.3 - gxz.y * 2.4) * 0.5 + 0.5
        );
        vec3 gTurf = mix(tFine, tMacro, 0.36) * mix(vec3(0.92, 0.96, 0.90), vec3(1.06, 1.12, 0.96), cloverPatch * 0.65 + microClover * 0.35);
        gTurf = mix(gTurf, tMicro * vec3(0.96, 1.04, 0.92), 0.24);

        vec3 gAlbedo = mix(gTurf, gMarble, gStoneMask);
        // Lush damp moss hugging marble curb joints
        gAlbedo = mix(gAlbedo, vec3(0.12, 0.23, 0.11), gBorderBand * (0.36 + 0.22 * cloverPatch));
        // Natural ivory-gold limestone cliff lip transition at outer perimeter (r > 38.5)
        float outerLipBlend = smoothstep(38.5, 41.8, length(gxz)) * (1.0 - gStoneMask * 0.85);
        vec3 cliffLipStone = mix(vec3(0.56, 0.50, 0.40), vec3(0.24, 0.38, 0.20), cloverPatch * 0.55);
        gAlbedo = mix(gAlbedo, cliffLipStone, outerLipBlend * 0.78);

        diffuseColor.rgb = gAlbedo;`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.02, 0.88, gFiligreeMask);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float rStone = texture2D(uMarbleRoughness, gxz * 0.24).r;
        float rTurf = texture2D(uTurfRoughness, gxz * 0.32).r;
        float honedMarbleRough = clamp(0.56 + rStone * 0.24 + (1.0 - stoneJoint) * 0.18, 0.52, 0.92);
        float stoneRough = mix(honedMarbleRough, 0.28, gFiligreeMask * 0.85);
        roughnessFactor = clamp(mix(rTurf, stoneRough, gStoneMask), 0.26, 0.96);
        float microSheen = sin(gxz.x * 18.0 + cos(gxz.y * 16.0) * 2.2) * 0.03;
        roughnessFactor = clamp(roughnessFactor + microSheen * gStoneMask * (1.0 - gFiligreeMask), 0.26, 0.96);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 nMarble = texture2D(uMarbleNormal, gxz * 0.24).xyz * 2.0 - 1.0;
        vec3 nTurf = texture2D(uTurfNormal, gxz * 0.30).xyz * 2.0 - 1.0;
        vec2 bevelGrad = vec2(
          smoothstep(0.44, 0.49, flagGridX) * sign(fract(staggerX) - 0.5),
          smoothstep(0.44, 0.49, flagGridZ) * sign(fract(gxz.y * paverScale) - 0.5)
        ) * 0.32 * (1.0 - smoothstep(10.5, 7.5, gDTemple));
        vec2 nBlend = mix(nTurf.xy * 0.55, nMarble.xy * 0.52 + bevelGrad, gStoneMask);
        vec3 worldPerturb = vec3(nBlend.x, 0.0, nBlend.y);
        vec3 viewPerturb = (viewMatrix * vec4(worldPerturb, 0.0)).xyz;
        normal = normalize(normal + viewPerturb);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float stoneDielectric = gStoneMask * (1.0 - gFiligreeMask) * (1.0 - gPoolBedMask);
        float viewUp = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
        float fresnelDamp = mix(0.24, 0.56, viewUp);
        reflectedLight.directSpecular *= mix(1.0, fresnelDamp, stoneDielectric);
        reflectedLight.indirectSpecular *= mix(1.0, fresnelDamp * 0.72, stoneDielectric);`
      )
      .replace(
        '#include <opaque_fragment>',
        `float medallionGlow = exp(-gDTemple * gDTemple * 0.38) * (0.85 + 0.15 * sin(uTime * 1.6));
        outgoingLight += vec3(0.95, 0.68, 0.26) * medallionGlow * 0.12;
        // Animated golden water caustics dancing inside the marble fountain basin & lotus pools
        if (gPoolBedMask > 0.005) {
          float basinCaustic = pgGoldenCaustic(gxz, uTime);
          float centerPulse = 0.85 + 0.15 * sin(gDPool * 3.5 - uTime * 2.1);
          outgoingLight += vec3(1.18, 0.86, 0.34) * basinCaustic * centerPulse * gPoolBedMask * 0.92;
        }
        // Golden-aqua water-bounce caustics shimmering on the damp marble coping rim around the pool
        float shoreBand = smoothstep(4.65, 5.05, gDPool) * (1.0 - smoothstep(5.50, 6.45, gDPool));
        if (shoreBand > 0.005) {
          float angPool = atan(gxz.y - 2.0, gxz.x);
          float shC1 = abs(sin(angPool * 18.0 + uTime * 1.3 + sin(gDPool * 9.0) * 1.4));
          float shC2 = abs(cos(angPool * 27.0 - uTime * 1.6 + cos(gDPool * 12.0) * 1.2));
          float shoreCaustic = pow(clamp(1.0 - min(shC1, shC2), 0.0, 1.0), 5.5);
          outgoingLight += mix(vec3(0.46, 0.86, 0.98), vec3(1.05, 0.84, 0.38), 0.58) * shoreCaustic * shoreBand * 0.44;
        }
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => 'paradise-ground-pbr-v5';

  return { material, uniforms };
}

/**
 * Enhances a `MeshStandardMaterial` (after `applyWorldSpaceWeathering`) with 3D world-space
 * horizontal travertine & ivory-gold limestone canyon strata shelves, sedimentary bedding planes,
 * vertical erosion flutes, and lush rim moss — ensuring floating island undersides and rock
 * buttresses read as authentic layered limestone canyon cliffs with ZERO Voronoi circles or UV swirls!
 */
export function applyLimestoneCanyonStrata(
  material: THREE.MeshStandardMaterial
): THREE.MeshStandardMaterial {
  const prevCompile = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')
    ? material.onBeforeCompile.bind(material)
    : null;
  const prevCacheKey = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey')
    ? material.customProgramCacheKey.bind(material)
    : null;

  material.customProgramCacheKey = () =>
    prevCacheKey ? `${prevCacheKey()}|limestone-canyon-strata-v2` : 'limestone-canyon-strata-v2';

  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) {
      prevCompile(shader, renderer);
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        'diffuseColor.rgb = mix( diffuseColor.rgb, weatherMossShaded, weatherMossMask );',
        /* glsl */ `
        diffuseColor.rgb = mix( diffuseColor.rgb, weatherMossShaded, weatherMossMask );

        // 3D World-Space Horizontal Ivory-Gold Travertine & Fractured Limestone Canyon Strata
        vec3 lcPos = vWeatherWorldPos;
        vec3 lcNorm = normalize( vWeatherWorldNormal );
        float lcWarpA = weatherFbm3( lcPos * vec3( 0.085, 0.14, 0.085 ) );
        float lcWarpB = weatherFbm3( lcPos * vec3( 0.26, 0.44, 0.26 ) + vec3( 9.2, 4.7, 15.1 ) );
        float lcGrain = weatherNoise3( lcPos * vec3( 1.65, 2.85, 1.65 ) );
        float lcMicroGrain = weatherNoise3( lcPos * vec3( 5.2, 7.8, 5.2 ) );

        // Continuous horizontal sedimentary bedding elevation with natural tectonic tilt & fracture warp
        float strataY = lcPos.y * 1.75 + ( lcWarpA - 0.5 ) * 1.65 + ( lcWarpB - 0.5 ) * 0.52;
        float majorBed = sin( strataY * 3.14159265 );
        float mediumBed = sin( strataY * 9.424778 + lcWarpB * 2.4 );
        float fineLamina = sin( strataY * 22.0 + lcGrain * 1.9 );

        // Fractured vertical limestone cleavage fissures (breaks up horizontal banding organically)
        float fracCoord = lcPos.x * 0.42 - lcPos.z * 0.38 + ( lcWarpA - 0.5 ) * 3.2;
        float fracCoordB = lcPos.x * 0.31 + lcPos.z * 0.47 + ( lcWarpB - 0.5 ) * 2.4;
        float vertCrackA = 1.0 - smoothstep( 0.0, 0.14, abs( sin( fracCoord * 2.4 ) ) );
        float vertCrackB = 1.0 - smoothstep( 0.0, 0.11, abs( cos( fracCoordB * 3.7 ) ) );
        float fissureCrevice = clamp( vertCrackA * 0.65 + vertCrackB * 0.45, 0.0, 1.0 ) * smoothstep( 0.28, 0.72, lcWarpB );

        // Stepped horizontal travertine shelves & recessed dark bedding plane seams
        float shelfStep = fract( strataY * 0.82 );
        float shelfLedge = smoothstep( 0.06, 0.26, shelfStep ) * ( 1.0 - smoothstep( 0.80, 0.98, shelfStep ) );
        float beddingCrevice = 1.0 - smoothstep( 0.0, 0.16, abs( majorBed ) );
        float fineSeam = 1.0 - smoothstep( 0.0, 0.20, abs( mediumBed ) );

        // 100% world-space mineral palette (zero stretched UV swirls!)
        float triGrainA = weatherFbm3( lcPos * vec3( 0.52, 0.98, 0.52 ) + vec3( 4.3, 1.9, 8.7 ) );
        float triGrainB = weatherNoise3( lcPos * vec3( 3.1, 5.8, 3.1 ) );
        vec3 ivoryStrata = vec3( 0.82, 0.75, 0.62 );
        vec3 goldenTravertine = vec3( 0.69, 0.59, 0.45 );
        vec3 ochreSienna = vec3( 0.52, 0.43, 0.33 );
        vec3 coolSlateLimestone = vec3( 0.46, 0.46, 0.44 );
        vec3 deepSeamShadow = vec3( 0.19, 0.16, 0.12 );

        vec3 strataPalette = mix( ochreSienna, goldenTravertine, smoothstep( -0.58, 0.36, majorBed ) );
        strataPalette = mix( strataPalette, coolSlateLimestone, smoothstep( 0.44, 0.82, lcWarpA ) * 0.42 );
        strataPalette = mix( strataPalette, ivoryStrata, smoothstep( 0.20, 0.86, mediumBed * 0.62 + fineLamina * 0.38 ) );
        strataPalette *= 0.85 + 0.20 * shelfLedge + ( triGrainA - 0.5 ) * 0.18 + ( triGrainB - 0.5 ) * 0.10 + ( lcMicroGrain - 0.5 ) * 0.08;

        vec3 canyonRock = mix( strataPalette, deepSeamShadow, clamp( beddingCrevice * 0.58 + fineSeam * 0.28 + fissureCrevice * 0.55, 0.0, 0.82 ) );

        // Lush emerald moss & trailing ivy along upper island rim ledges (y > -3.2) and upward-facing shelves
        float rimMossZone = smoothstep( -3.4, -0.2, lcPos.y ) * smoothstep( 0.26, 0.74, lcWarpA * 0.58 + shelfLedge * 0.42 );
        float shelfTopMoss = smoothstep( 0.28, 0.80, lcNorm.y ) * smoothstep( -7.5, 1.5, lcPos.y ) * smoothstep( 0.36, 0.74, lcWarpB );
        float canyonMossMask = clamp( max( rimMossZone * 0.78, shelfTopMoss * 0.70 ), 0.0, 0.80 );
        vec3 lushRimMoss = mix( vec3( 0.14, 0.30, 0.12 ), vec3( 0.25, 0.45, 0.20 ), lcGrain );
        canyonRock = mix( canyonRock, lushRimMoss, canyonMossMask );

        diffuseColor.rgb = canyonRock;
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        // Bypass UV-mapped normalMap on cliffs; use pure 3D world-space limestone strata + fracture normals (zero curved UV swirls!)
        float strataPhase = vWeatherWorldPos.y * 1.75 + ( weatherFbm3( vWeatherWorldPos * vec3( 0.085, 0.14, 0.085 ) ) - 0.5 ) * 1.65;
        float dStrataDy = cos( strataPhase * 3.14159265 ) * 0.42
                        + cos( strataPhase * 9.424778 ) * 0.26;
        float dCrackDx = cos( ( vWeatherWorldPos.x * 0.42 - vWeatherWorldPos.z * 0.38 ) * 2.4 ) * 0.26;
        float dCrackDz = sin( ( vWeatherWorldPos.x * 0.31 + vWeatherWorldPos.z * 0.47 ) * 3.7 ) * 0.24;
        vec3 strataViewN = ( viewMatrix * vec4( dCrackDx, dStrataDy, dCrackDz, 0.0 ) ).xyz;
        normal = normalize( normal + strataViewN );
        `
      );
  };

  material.needsUpdate = true;
  return material;
}

/**
 * Legacy ground ShaderMaterial retained for backwards compatibility if referenced externally.
 */
export function createParadiseGroundMaterial(
  marbleTex: THREE.Texture,
  detailTex: THREE.Texture,
  sunDirection?: [number, number, number] | THREE.Vector3
): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  uniforms.uMarbleTex = { value: marbleTex };
  uniforms.uDetailTex = { value: detailTex };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform sampler2D uMarbleTex;
      uniform sampler2D uDetailTex;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 m = pow(max(texture2D(uMarbleTex, vWorldPos.xz * 0.16).rgb, vec3(0.001)), vec3(2.2)) * 0.44;
        float NdotL = clamp(dot(N, L), 0.0, 1.0);
        gl_FragColor = vec4(m * (0.45 + 0.65 * NdotL), 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

/**
 * 7. Floating Island Underside Cliff & Lush Moss-Capped Satellite Islets Shader
 */
export function createFloatingCliffMaterial(
  marbleTex: THREE.Texture,
  sunDirection?: [number, number, number] | THREE.Vector3,
  turfTex?: THREE.Texture
): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  uniforms.uMarbleTex = { value: marbleTex };
  uniforms.uTurfTex = { value: turfTex ?? marbleTex };
  uniforms.uHasTurfTex = { value: turfTex ? 1.0 : 0.0 };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform sampler2D uMarbleTex;
      uniform sampler2D uTurfTex;
      uniform float uHasTurfTex;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float fcHash(vec3 p) {
        p = fract(p * vec3(127.1, 311.7, 74.7));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float fcNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(fcHash(i), fcHash(i + vec3(1,0,0)), u.x),
              mix(fcHash(i + vec3(0,1,0)), fcHash(i + vec3(1,1,0)), u.x), u.y),
          mix(mix(fcHash(i + vec3(0,0,1)), fcHash(i + vec3(1,0,1)), u.x),
              mix(fcHash(i + vec3(0,1,1)), fcHash(i + vec3(1,1,1)), u.x), u.y),
          u.z
        );
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);

        // Triplanar Carrara marble/travertine stone sampling
        vec3 mXZ = texture2D(uMarbleTex, vWorldPos.xz * 0.11).rgb;
        vec3 mXY = texture2D(uMarbleTex, vWorldPos.xy * 0.12).rgb;
        vec3 mYZ = texture2D(uMarbleTex, vWorldPos.zy * 0.12).rgb;
        vec3 blend = abs(N);
        blend = blend / max(blend.x + blend.y + blend.z, 0.001);
        vec3 stoneLinear = mXZ * blend.y + mXY * blend.z + mYZ * blend.x;

        float strata = fcNoise(vec3(vWorldPos.x * 0.18, vWorldPos.y * 0.55, vWorldPos.z * 0.18));
        stoneLinear *= mix(0.56, 1.05, strata);

        // Luminous turquoise-gold crystal veins deep on the floating island roots
        float veinSignal = fcNoise(vWorldPos * 0.34 + vec3(0.0, uTime * 0.03, 0.0));
        float crystalVein = smoothstep(0.76, 0.90, veinSignal) * smoothstep(-1.5, -9.0, vWorldPos.y);

        // Lush emerald moss/clover turf cap on upward-facing satellite islet tops & rim overhang
        vec3 turfCol = uHasTurfTex > 0.5
          ? texture2D(uTurfTex, vWorldPos.xz * 0.25).rgb
          : vec3(0.11, 0.32, 0.15);
        float topUpMask = smoothstep(0.35, 0.82, N.y) * smoothstep(-1.2, 1.2, vWorldPos.y);
        float rimMoss = smoothstep(-2.4, -0.1, vWorldPos.y) * smoothstep(0.28, 0.78, strata) * 0.65;
        float mossBlend = clamp(max(topUpMask, rimMoss), 0.0, 1.0);
        stoneLinear = mix(stoneLinear, turfCol, mossBlend);

        float NdotL = clamp(dot(N, L) * 0.65 + 0.35, 0.0, 1.0);
        float cloudBounce = clamp(-N.y * 0.6 + 0.4, 0.0, 1.0);
        vec3 bounceCol = vec3(0.46, 0.36, 0.30) * cloudBounce;

        vec3 col = stoneLinear * (vec3(0.26, 0.30, 0.42) + vec3(0.96, 0.86, 0.68) * NdotL * 0.76 + bounceCol);
        col += vec3(0.45, 0.88, 0.96) * crystalVein * 0.68;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * 8. Classical Pearlescent Marble Architecture Material (Legacy ShaderMaterial fallback)
 */
export function createMarbleArchitectureMaterial(
  marbleTex: THREE.Texture,
  detailTex: THREE.Texture,
  sunDirection?: [number, number, number] | THREE.Vector3
): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  uniforms.uMarbleTex = { value: marbleTex };
  uniforms.uDetailTex = { value: detailTex };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform sampler2D uMarbleTex;
      uniform sampler2D uDetailTex;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);

        vec3 mXZ = texture2D(uMarbleTex, vWorldPos.xz * 0.22).rgb;
        vec3 mXY = texture2D(uMarbleTex, vWorldPos.xy * 0.22).rgb;
        vec3 mYZ = texture2D(uMarbleTex, vWorldPos.zy * 0.22).rgb;
        vec3 w = abs(N);
        w = w / max(w.x + w.y + w.z, 0.001);
        vec3 marbleSrgb = mXZ * w.y + mXY * w.z + mYZ * w.x;

        vec3 dXY = texture2D(uDetailTex, vWorldPos.xy * 0.35).rgb;
        marbleSrgb *= mix(vec3(1.0), dXY * 1.03, 0.16);

        vec3 albedo = marbleSrgb * 0.72;

        float NdotL = clamp(dot(N, L), 0.0, 1.0);
        float wrapLight = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float skyHemi = N.y * 0.5 + 0.5;
        vec3 ambientFill = mix(vec3(0.24, 0.26, 0.36), vec3(0.32, 0.42, 0.58), skyHemi);
        float sss = pow(clamp(dot(-V, L) * 0.5 + 0.5, 0.0001, 1.0), 3.0) * 0.16;

        vec3 lit = albedo * (ambientFill * 0.82 + vec3(1.0, 0.91, 0.76) * (NdotL * 0.72 + wrapLight * 0.14));
        lit += vec3(0.96, 0.82, 0.66) * albedo * sss;

        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0001), 48.0);
        lit += vec3(1.0, 0.94, 0.82) * spec * 0.26;

        gl_FragColor = vec4(lit, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

/**
 * 9. Burnished Celestial Gold Filigree Material (Legacy ShaderMaterial fallback)
 */
export function createCelestialGoldMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  emissiveBoost: number;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uEmissiveBoost: { value: customUniforms?.emissiveBoost ?? 0.08 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform float uEmissiveBoost;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);

        float NdotL = clamp(dot(N, L) * 0.65 + 0.35, 0.0, 1.0);
        float NdotV = max(dot(N, V), 0.0);
        float fresnel = pow(max(1.0 - NdotV, 0.0001), 3.0);
        float spec = pow(max(dot(N, H), 0.0001), 64.0);

        vec3 baseGold = vec3(0.76, 0.50, 0.14);
        vec3 brightGold = vec3(1.0, 0.82, 0.36);
        vec3 skyReflect = vec3(0.55, 0.72, 0.96);

        vec3 col = baseGold * (0.48 + 0.72 * NdotL);
        col += mix(brightGold, skyReflect, 0.28) * fresnel * 0.45;
        col += brightGold * spec * 1.15;
        col += vec3(0.95, 0.68, 0.24) * uEmissiveBoost;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

/**
 * 10. Animated Glowing Celestial Floor Medallion
 */
export function createCelestialMedallionMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uRadiance: { value: 1.0 }
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
      uniform float uRadiance;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        float angle = atan(p.y, p.x);
        float lotus = sin(angle * 8.0 + uTime * 0.22) * 0.08 + cos(angle * 16.0 - uTime * 0.18) * 0.04;
        float ring1 = smoothstep(0.05, 0.0, abs(r - 0.84 - lotus * 0.4));
        float ring2 = smoothstep(0.045, 0.0, abs(r - 0.54 + lotus * 0.5));
        float star = smoothstep(0.06, 0.0, abs(r - 0.26 - abs(sin(angle * 4.0 - uTime * 0.28)) * 0.14));
        float core = exp(-r * r * 14.0);

        float pulse = 0.85 + 0.15 * sin(uTime * 1.9);
        float glow = (ring1 * 0.85 + ring2 * 0.95 + star * 1.1 + core * 1.35) * pulse * uRadiance;

        vec3 marbleBase = vec3(0.46, 0.44, 0.45);
        vec3 goldGlow = vec3(1.0, 0.82, 0.36);
        vec3 aquaRune = vec3(0.54, 0.88, 0.98);
        vec3 col = marbleBase + mix(goldGlow, aquaRune, ring2 * 0.55) * glow * 0.82;

        float alpha = smoothstep(1.0, 0.88, r);
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    fog: true
  });
}

/**
 * 11. Crystal Reflecting Pool Water Shader:
 *     Micro-ripple normals, Schlick Fresnel reflections of golden temple & sky,
 *     diamond caustics on submerged marble bed, and coping-edge ripples.
 */
export function createCrystalWaterMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  skyTopColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) },
    uSkyTopColor: { value: toColor(customUniforms?.skyTopColor, '#1e64c8') },
    uHorizonColor: { value: toColor(customUniforms?.horizonColor, '#f6d4a6') }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

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
        float distCenter = length(uv - 0.5);
        float ripple = sin(distCenter * 24.0 - uTime * 2.1) * 0.012 * (1.0 - smoothstep(0.28, 0.5, distCenter));
        float edgeWave = sin(distCenter * 44.0 + uTime * 1.7) * 0.005 * smoothstep(0.35, 0.49, distCenter);
        p.y += ripple + edgeWave;
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

      varying vec3 vWorldPos;
      varying vec2 vUv;

      float cwHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.31);
        return fract(p.x * p.y);
      }

      float cwNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(cwHash(i), cwHash(i + vec2(1.0, 0.0)), u.x),
          mix(cwHash(i + vec2(0.0, 1.0)), cwHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Multi-octave micro-ripple heightfield for tangent-space normal perturbation
      float rippleHeight(vec2 xz, float r, vec2 centerDir) {
        float w1 = cwNoise(xz * 1.9 + vec2(uTime * 0.28, -uTime * 0.20));
        float w2 = cwNoise(xz * 4.4 - vec2(uTime * 0.22, uTime * 0.31));
        float w3 = cwNoise(xz * 9.8 + vec2(-uTime * 0.36, uTime * 0.16));
        float copingRipple = sin((1.0 - r) * 52.0 - uTime * 2.4) * smoothstep(0.68, 0.98, r) * 0.24;
        float centerRing = sin(r * 22.0 - uTime * 1.9) * (1.0 - smoothstep(0.0, 0.85, r)) * 0.16;
        return w1 * 0.45 + w2 * 0.35 + w3 * 0.20 + copingRipple + centerRing;
      }

      // Delicate dual-layer refractive diamond water caustics lattice
      float diamondCaustic(vec2 uv) {
        vec2 p1 = uv * 3.2 + vec2(uTime * 0.16, -uTime * 0.12);
        vec2 p2 = uv * 3.9 + vec2(-uTime * 0.13, uTime * 0.17);
        vec2 p3 = uv * 6.4 + vec2(uTime * 0.21, uTime * 0.14);
        float c1 = abs(sin(p1.x + sin(p1.y * 1.4)) * cos(p1.y + cos(p1.x * 1.3)));
        float c2 = abs(sin(p2.x * 1.2 - cos(p2.y)) * cos(p2.y * 1.1 + sin(p2.x)));
        float c3 = abs(sin(p3.x - sin(p3.y * 1.2)) * cos(p3.y + cos(p3.x * 1.1)));
        float net = 1.0 - min(c1, c2);
        float fineNet = 1.0 - min(c2, c3);
        return pow(clamp(net, 0.0, 1.0), 6.5) * 0.72 + pow(clamp(fineNet, 0.0, 1.0), 8.0) * 0.45;
      }

      void main() {
        vec2 p = vWorldPos.xz;
        vec2 uvCentered = vUv - 0.5;
        float r = length(uvCentered) * 2.0;
        if (r > 1.0) discard;

        vec2 cDir = normalize(uvCentered + vec2(0.0001));
        float eps = 0.045;
        float hC = rippleHeight(p, r, cDir);
        float hX = rippleHeight(p + vec2(eps, 0.0), r, cDir);
        float hZ = rippleHeight(p + vec2(0.0, eps), r, cDir);

        vec3 N = normalize(vec3((hC - hX) * 1.35, 1.0, (hC - hZ) * 1.35));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDirection);
        vec3 R = reflect(-V, N);

        // True Schlick Fresnel for clear water (F0 = 0.02) calibrated so golden basin caustics stay crystal-clear
        float NdotV = max(dot(N, V), 0.0);
        float fresnel = 0.02 + 0.98 * pow(max(1.0 - NdotV, 0.0), 4.6);
        float reflMix = clamp(0.14 + fresnel * 0.72, 0.14, 0.86);

        // Celestial sky reflection + distant rainbow arch shimmer
        float skyH = clamp(R.y, 0.0, 1.0);
        vec3 skyRefl = mix(uHorizonColor * 0.52, uSkyTopColor * 0.92, smoothstep(0.0, 0.44, skyH));
        float rainbowTint = smoothstep(0.16, 0.48, R.y) * smoothstep(0.82, 0.44, R.y);
        skyRefl += vec3(0.32, 0.36, 0.52) * rainbowTint * 0.24;

        // Analytical reflection of the Golden Marble Rotunda Temple at (0, y, -14)
        vec3 toTemple = vec3(0.0, 4.5, -14.0) - vWorldPos;
        float templeDist = length(toTemple.xz);
        vec2 templeDirXZ = normalize(toTemple.xz);
        vec2 reflXZ = normalize(R.xz + vec2(0.0001));
        float alignXZ = max(dot(reflXZ, templeDirXZ), 0.0);
        float elevTemple = clamp(R.y, 0.0, 1.0);
        float inDomeProfile = smoothstep(0.84, 0.96, alignXZ) * smoothstep(0.01, 0.12, elevTemple) * smoothstep(0.58, 0.20, elevTemple);
        float columnStripes = 0.5 + 0.5 * cos((atan(reflXZ.x, -reflXZ.y) * 32.0));
        float domeRib = smoothstep(0.34, 0.50, elevTemple) * (0.55 + 0.45 * cos(atan(reflXZ.x, -reflXZ.y) * 16.0));
        vec3 marbleReflCol = mix(vec3(0.92, 0.88, 0.82), vec3(1.05, 0.84, 0.40), smoothstep(0.18, 0.36, elevTemple));
        marbleReflCol *= 0.62 + 0.38 * columnStripes;
        marbleReflCol += vec3(1.05, 0.78, 0.28) * domeRib * 0.32;
        float lanternWarmRefl = exp(-pow((elevTemple - 0.16) * 14.0, 2.0)) * smoothstep(0.90, 0.98, alignXZ);
        marbleReflCol += vec3(1.15, 0.76, 0.26) * lanternWarmRefl * 0.45;
        float templeMask = inDomeProfile * clamp(19.0 / max(templeDist, 10.0), 0.35, 1.0);
        vec3 envRefl = mix(skyRefl, marbleReflCol, templeMask * 0.78);

        // Subtle sakura blossom canopy blush reflection on east/west water flanks
        float sakuraFlank = smoothstep(0.35, 0.85, abs(reflXZ.x)) * smoothstep(0.02, 0.16, R.y) * smoothstep(0.42, 0.16, R.y);
        envRefl = mix(envRefl, vec3(0.95, 0.68, 0.78), sakuraFlank * 0.28);

        // Crisp HDR sun specular glints + micro-sparkle
        float sunSpec = pow(max(dot(R, L), 0.0001), 160.0) * 2.15;
        float sunSoft = pow(max(dot(R, L), 0.0001), 24.0) * 0.28;

        // Refracted chromatic diamond caustics on submerged Carrara-mosaic pool floor
        vec3 refracted = refract(-V, N, 0.75);
        float depth = mix(0.48, 0.18, smoothstep(0.35, 0.98, r));
        vec2 floorXZ = p + refracted.xz * depth;
        float causticR = diamondCaustic(floorXZ + vec2(0.015, 0.0));
        float causticG = diamondCaustic(floorXZ);
        float causticB = diamondCaustic(floorXZ - vec2(0.015, 0.01));
        vec3 causticsRgb = vec3(causticR * 0.92, causticG * 1.04, causticB * 1.15);

        // Submerged sapphire-marble radial mosaic visibility + dancing golden solar caustics
        float floorR = length(floorXZ - vec2(0.0, 2.0));
        float mosaicRing = smoothstep(0.88, 0.99, cos(floorR * 4.2)) * (1.0 - smoothstep(4.2, 5.2, floorR));
        vec3 deepAqua = vec3(0.025, 0.22, 0.36);
        vec3 shallowPearl = vec3(0.14, 0.50, 0.60);
        vec3 waterBody = mix(deepAqua, shallowPearl, smoothstep(0.36, 0.96, r) * 0.70 + hC * 0.20);
        waterBody = mix(waterBody, vec3(0.56, 0.44, 0.22), mosaicRing * 0.36 * (1.0 - r * 0.35));
        vec3 goldenCaustic = vec3(1.18, 0.86, 0.34) * (causticsRgb.r * 0.45 + causticsRgb.g * 0.55);
        vec3 aquaCaustic = vec3(0.38, 0.90, 1.02) * causticsRgb;
        waterBody += mix(aquaCaustic, goldenCaustic, 0.68) * 0.88;

        vec3 col = mix(waterBody, envRefl, reflMix);
        col += vec3(1.0, 0.90, 0.64) * (sunSpec + sunSoft);

        // Coping-edge meniscus ripple, delicate golden-aqua shoreline caustics & gentle pearl foam highlight
        float shoreCausticBoost = smoothstep(0.70, 0.97, r) * (causticsRgb.g * 0.55 + causticsRgb.b * 0.45);
        col += mix(vec3(0.52, 0.92, 1.02), vec3(1.12, 0.86, 0.38), 0.62) * shoreCausticBoost * 0.58;
        float copingRipple = smoothstep(0.86, 0.99, r) * (0.20 + 0.16 * sin((1.0 - r) * 62.0 - uTime * 2.5));
        col = mix(col, vec3(0.88, 0.95, 0.98), clamp(copingRipple, 0.0, 0.44));

        float alpha = mix(0.68, 0.94, reflMix) * (1.0 - smoothstep(0.965, 1.0, r));
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    fog: true
  });
}

/**
 * 12. Cascading Heavenly Waterfall Shader
 */
export function createParadiseWaterfallMaterial(customUniforms?: Partial<{
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
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float pwHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.31);
        return fract(p.x * p.y);
      }

      float pwNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(pwHash(i), pwHash(i + vec2(1.0, 0.0)), u.x),
          mix(pwHash(i + vec2(0.0, 1.0)), pwHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 flow1 = vec2(vUv.x * 11.0 + sin(vUv.y * 9.0 + uTime * 1.2) * 0.25, vUv.y * 4.2 + uTime * 1.65);
        vec2 flow2 = vec2(vUv.x * 23.0 + 3.7, vUv.y * 7.2 + uTime * 2.55);
        vec2 flow3 = vec2(vUv.x * 42.0 - 1.9, vUv.y * 12.0 + uTime * 3.4);
        float streak1 = pwNoise(flow1);
        float streak2 = pwNoise(flow2);
        float streak3 = pwNoise(flow3);
        float cascade = streak1 * 0.46 + streak2 * 0.34 + streak3 * 0.20;

        // Organic FBM-feathered side edges & turbulent rock-split weir froth (zero straight tape edges!)
        float edgeJitter = (streak1 - 0.5) * 0.24 + (streak2 - 0.5) * 0.12;
        float sideFade = smoothstep(0.04, 0.26, vUv.x + edgeJitter) * smoothstep(0.96, 0.74, vUv.x + edgeJitter);
        float bottomDissolve = smoothstep(0.0, 0.34, vUv.y + (streak2 - 0.5) * 0.10);
        float headFade = smoothstep(1.0, 0.88, vUv.y + (streak1 - 0.5) * 0.06);
        float weirTurbulence = exp(-pow((vUv.y - 0.72 + (streak1 - 0.5) * 0.08) * 9.5, 2.0)) * (0.35 + 0.65 * streak2);
        float mistPlume = 1.0 - smoothstep(0.03, 0.40, vUv.y);

        vec3 celestialAqua = vec3(0.24, 0.74, 0.90);
        vec3 pearlFoam = vec3(1.02, 1.04, 1.06);
        float foamMask = smoothstep(0.30, 0.78, cascade + weirTurbulence * 0.48 + mistPlume * 0.58);

        vec3 col = mix(celestialAqua, pearlFoam, foamMask);
        float sunSparkle = pow(max(streak2 * streak3, 0.0001), 2.8) * 1.05;
        float crestHighlight = smoothstep(0.68, 0.92, vUv.y) * 0.28;
        col += vec3(1.04, 0.95, 0.76) * (sunSparkle + crestHighlight);

        float alpha = clamp((0.56 + 0.42 * foamMask) * sideFade * (0.30 + 0.70 * bottomDissolve) * (0.34 + 0.66 * headFade), 0.0, 0.95);
        if (alpha < 0.015) discard;

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
 * 13. Photorealistic Silver-Cherry Bark PBR Material (`MeshStandardMaterial` + synchronized sway)
 */
export function createSakuraBarkMaterial(
  barkSet: PbrTextureSet,
  windSpeed: number,
  windStrength: number
): {
  material: THREE.MeshStandardMaterial;
  uniforms: { uTime: { value: number }; uWindSpeed: { value: number }; uWindStrength: { value: number } };
} {
  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: windSpeed },
    uWindStrength: { value: windStrength }
  };

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8a8a8'), // tints oak bark to silver-cherry mahogany bark
    map: barkSet.map,
    normalMap: barkSet.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: barkSet.roughnessMap,
    roughness: 0.92,
    aoMap: barkSet.aoMap,
    aoMapIntensity: 0.85,
    envMapIntensity: 0.65
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uWindStrength;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float bFlex = clamp(position.y / 6.0, 0.0, 1.0);
        bFlex *= bFlex;
        #ifdef USE_INSTANCING
          vec3 barkOrigin = instanceMatrix[3].xyz;
        #else
          vec3 barkOrigin = vec3(0.0);
        #endif
        float bSway = sin(uTime * uWindSpeed * 0.78 + barkOrigin.x * 0.21 + barkOrigin.z * 0.17) * uWindStrength * bFlex * 0.16;
        transformed.x += bSway;
        transformed.z += bSway * 0.55;`
      );
  };
  material.customProgramCacheKey = () => 'paradise-sakura-bark-v1';

  return { material, uniforms };
}

/**
 * 14. Alpha-Tested Sakura Blossom & Leaf Cluster Card Material (`MeshStandardMaterial` + backlit SSS + wind flutter)
 */
export function createSakuraFoliageCardMaterial(
  atlasTex: THREE.Texture,
  sunDir: THREE.Vector3,
  windSpeed: number,
  windStrength: number
): {
  material: THREE.MeshStandardMaterial;
  depthMaterial: THREE.MeshDepthMaterial;
  uniforms: {
    uTime: { value: number };
    uWindSpeed: { value: number };
    uWindStrength: { value: number };
    uSunDirection: { value: THREE.Vector3 };
  };
} {
  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: windSpeed },
    uWindStrength: { value: windStrength },
    uSunDirection: { value: sunDir.clone().normalize() }
  };

  const material = new THREE.MeshStandardMaterial({
    map: atlasTex,
    alphaTest: 0.40,
    side: THREE.DoubleSide,
    roughness: 0.62,
    metalness: 0.0,
    envMapIntensity: 0.68
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
        varying vec3 vSakuraWorldPos;
        varying vec3 vSakuraWorldNormal;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        #ifdef USE_INSTANCING
          vSakuraWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);
        #else
          vSakuraWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
        #endif`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sMask = clamp(uv.y, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vec3 sOrigin = vec3(instanceMatrix[3].xyz);
        #else
          vec3 sOrigin = vec3(0.0);
        #endif
        float sPhase = sOrigin.x * 0.65 + sOrigin.z * 0.55 + sOrigin.y * 0.42;
        float branchSway = sin(uTime * uWindSpeed * 0.78 + sOrigin.x * 0.21 + sOrigin.z * 0.17) * uWindStrength * 0.12;
        float leafFlutter = (sin(uTime * (1.4 + uWindSpeed * 0.65) + sPhase) * 0.068
                           + cos(uTime * (2.6 + uWindSpeed * 0.85) + sPhase * 1.7) * 0.028) * max(uWindStrength, 0.15);
        transformed.x += branchSway + leafFlutter * sMask;
        transformed.y += leafFlutter * 0.36 * sMask;
        transformed.z += branchSway * 0.55;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vSakuraWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vSakuraWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDirection;
        varying vec3 vSakuraWorldPos;
        varying vec3 vSakuraWorldNormal;`
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 sViewDir = normalize(cameraPosition - vSakuraWorldPos);
        vec3 sSunDir = normalize(uSunDirection);
        vec3 sNorm = normalize(vSakuraWorldNormal);
        // Pink-ivory backlit subsurface scattering (SSS) + golden sun-kissed crown + soft blush shadow bounce
        float sBacklit = pow(clamp(dot(sViewDir, -sSunDir), 0.0, 1.0), 2.0);
        float sTopSun = clamp(dot(sNorm, sSunDir) * 0.5 + 0.5, 0.0, 1.0);
        float sRim = pow(clamp(1.0 - abs(dot(sNorm, sViewDir)), 0.0, 1.0), 2.2);
        vec3 sunlitCream = vec3(1.22, 1.02, 0.94);
        vec3 blushBounce = vec3(1.12, 0.78, 0.92);
        outgoingLight += diffuseColor.rgb * (
          sunlitCream * (sBacklit * 0.68 + sTopSun * 0.28) +
          blushBounce * (sRim * 0.24 + (1.0 - sTopSun) * 0.14)
        );
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => 'paradise-sakura-foliage-v1';

  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: atlasTex,
    alphaTest: 0.40,
    side: THREE.DoubleSide
  });

  return { material, depthMaterial, uniforms };
}

/**
 * Legacy blossom bark & crown exports retained for compatibility.
 */
export function createBlossomBarkMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windStrength: number;
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.6 },
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
      void main() {
        vec3 p = position;
        float hFlex = clamp(position.y / 6.0, 0.0, 1.0);
        hFlex *= hFlex;
        #ifdef USE_INSTANCING
        vec3 basePos = instanceMatrix[3].xyz;
        float sway = sin(uTime * uWindSpeed * 0.8 + basePos.x * 0.21 + basePos.z * 0.17) * uWindStrength * hFlex * 0.18;
        p.x += sway;
        vec4 worldPos = instanceMatrix * vec4(p, 1.0);
        vec3 worldNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
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
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        float NdotL = clamp(dot(N, L) * 0.65 + 0.35, 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.24, 0.18, 0.17) * (0.48 + 0.72 * NdotL), 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

export function createBlossomCrownMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windStrength: number;
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 1.6 },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.55 },
    uSunDirection: { value: resolveSunDir(customUniforms?.sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
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
      void main() {
        float NdotL = clamp(dot(normalize(vWorldNormal), normalize(uSunDirection)) * 0.6 + 0.4, 0.0, 1.0);
        gl_FragColor = vec4(vec3(0.84, 0.54, 0.66) * (0.45 + 0.65 * NdotL), 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

/**
 * 15. Soaring White Doves Material (InstancedMesh with harmonic wing flapping)
 */
export function createWhiteDoveMaterial(customUniforms?: Partial<{
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
      varying float vWingSpan;

      void main() {
        vec3 p = position;
        float span = abs(p.x);
        vWingSpan = span;

        #ifdef USE_INSTANCING
        vec3 basePos = instanceMatrix[3].xyz;
        float phase = basePos.x * 0.19 + basePos.z * 0.27;
        #else
        float phase = 0.0;
        #endif

        float glideCycle = sin(uTime * 0.55 + phase);
        float flapActive = smoothstep(-0.1, 0.65, glideCycle);
        float beat = sin(uTime * 7.8 + phase * 3.4) * flapActive;
        p.y += span * (beat * 0.36 + 0.10);

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
      varying float vWingSpan;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float NdotL = abs(dot(N, L)) * 0.45 + 0.55;
        float rim = pow(max(1.0 - abs(dot(N, V)), 0.0001), 2.5) * 0.45;

        vec3 bodyPearl = vec3(0.68, 0.70, 0.76);
        vec3 wingTipGlow = vec3(0.90, 0.86, 0.80);
        vec3 col = mix(bodyPearl, wingTipGlow, clamp(vWingSpan * 0.85, 0.0, 1.0)) * NdotL;
        col += vec3(1.0, 0.90, 0.68) * rim;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * 16. Drifting Glowing Blossom Petals (Points with curved rotated petal SDF)
 */
export function createBlossomPetalsMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.6 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;

      attribute float aPhase;
      attribute float aSize;
      attribute vec3 aColor;

      varying vec3 vColor;
      varying float vRot;
      varying float vAlpha;

      void main() {
        vColor = aColor;
        vRot = aPhase * 3.14 + uTime * (0.9 + mod(aPhase, 1.0) * 0.6);

        vec3 p = position;
        float speed = max(uWindSpeed, 0.4);
        float cycle = fract(aPhase * 0.17 + uTime * 0.032 * speed);
        p.y = mix(11.5, 0.35, cycle) + sin(uTime * 1.4 + aPhase * 2.1) * 0.42;
        p.x += sin(uTime * 0.52 * speed + aPhase) * 2.4 + (cycle - 0.5) * 4.5;
        p.z += cos(uTime * 0.46 * speed + aPhase * 1.3) * 2.4 + (cycle - 0.5) * 2.2;

        float edgeFade = smoothstep(0.0, 0.14, cycle) * smoothstep(1.0, 0.82, cycle);
        vAlpha = edgeFade * 0.92;

        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * (185.0 / max(-mvPosition.z, 1.5)), 2.5, 16.0);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec3 vColor;
      varying float vRot;
      varying float vAlpha;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float cs = cos(vRot);
        float sn = sin(vRot);
        vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);

        rc.x *= 1.65;
        rc.y += rc.x * rc.x * 0.42;
        float d = length(rc);
        if (d > 0.46) discard;

        float soft = smoothstep(0.46, 0.16, d);
        vec3 col = vColor * (0.86 + 0.24 * (1.0 - d * 2.0));
        gl_FragColor = vec4(col, soft * vAlpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true
  });
}

/**
 * 17. Golden Light Motes & Celestial Fireflies
 */
export function createGoldenLightMotesMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uRadiance: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aPhase;
      attribute float aSize;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.72 + aPhase) * 0.75;
        p.x += cos(uTime * 0.48 + aPhase * 1.4) * 0.65;
        p.z += sin(uTime * 0.54 + aPhase * 0.9) * 0.65;

        vAlpha = 0.42 + 0.58 * (0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 2.7));
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * (160.0 / max(-mvPosition.z, 1.5)), 2.2, 13.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRadiance;
      varying float vAlpha;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = exp(-d * d * 9.0) * smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.42) * (0.95 * uRadiance), glow * vAlpha * 0.72);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

/**
 * 18. Waterfall Spray & Mist Shimmer Plumes
 */
export function createWaterfallSprayMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      attribute float aPhase;
      attribute float aSize;
      varying float vAlpha;

      void main() {
        float life = fract(aPhase + uTime * 0.24);
        vec3 p = position;
        p.y += life * 6.4;
        p.x += sin(life * 5.0 + aPhase * 12.0) * (0.7 + life * 1.9);
        p.z += cos(life * 4.5 + aPhase * 9.0) * (0.7 + life * 1.9);

        vAlpha = smoothstep(0.0, 0.20, life) * smoothstep(1.0, 0.32, life) * 0.58;
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * (1.1 + life * 1.8) * (250.0 / max(-mvPosition.z, 2.0)), 7.0, 64.0);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vAlpha;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float puff = pow(max(1.0 - d * 2.0, 0.0001), 1.6);
        gl_FragColor = vec4(vec3(0.96, 0.97, 0.99), puff * vAlpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true
  });
}

/**
 * 19. Swirling Frothy Waterfall Plunge Mist Pool Shader
 */
export function createWaterfallMistPoolMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

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
        float r = length(uv - 0.5) * 2.0;
        p.y += sin(r * 10.0 - uTime * 2.4) * 0.14 * (1.0 - r * 0.5);
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
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float mpHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.31);
        return fract(p.x * p.y);
      }

      float mpNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mpHash(i), mpHash(i + vec2(1.0, 0.0)), u.x),
          mix(mpHash(i + vec2(0.0, 1.0)), mpHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;

        float ang = atan(c.y, c.x);
        float swirl = mpNoise(vec2(r * 5.0 - uTime * 0.75, ang * 2.2 + uTime * 0.18));
        float rings = 0.5 + 0.5 * sin(r * 18.0 - uTime * 2.8 + swirl * 2.4);
        float radialFade = smoothstep(1.0, 0.18, r);
        float foam = smoothstep(0.28, 0.82, swirl * 0.62 + rings * 0.38);

        vec3 aquaMist = vec3(0.48, 0.84, 0.94);
        vec3 sunFoam = vec3(1.02, 0.99, 0.95);
        vec3 col = mix(aquaMist, sunFoam, foam);
        float alpha = radialFade * (0.34 + 0.48 * foam);
        if (alpha < 0.01) discard;

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
 * 20. Hanging Island Trailing Vines & Blossom Tendrils Material
 */
export function createHangingVineMaterial(
  windSpeed = 1.6,
  windStrength = 0.55,
  sunDirection?: [number, number, number] | THREE.Vector3
): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: windSpeed },
    uWindStrength: { value: windStrength },
    uSunDirection: { value: resolveSunDir(sunDirection) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWindStrength;
      varying float vDropFrac;
      varying float vLeafZone;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        #ifdef USE_INSTANCING_COLOR
        vInstanceColor = instanceColor;
        #endif
        vec3 p = position;
        // local position hangs from y=0 down to y=-1.0
        float drop = clamp(-p.y, 0.0, 1.0);
        vDropFrac = drop;
        vLeafZone = uv.x;

        #ifdef USE_INSTANCING
        vec3 origin = instanceMatrix[3].xyz;
        #else
        vec3 origin = vec3(0.0);
        #endif

        float phase = origin.x * 0.27 + origin.z * 0.31;
        float sway = sin(uTime * uWindSpeed * 0.95 + phase + drop * 2.2) * uWindStrength * (drop * drop) * 0.34;
        float crossSway = cos(uTime * uWindSpeed * 0.72 + phase * 1.4 + drop * 1.7) * uWindStrength * (drop * drop) * 0.22;
        p.x += sway;
        p.z += crossSway;

        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * vec4(p, 1.0);
        vec3 wn = (instanceMatrix * vec4(normal, 0.0)).xyz;
        #else
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vec3 wn = (modelMatrix * vec4(normal, 0.0)).xyz;
        #endif

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(wn);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;
      varying float vDropFrac;
      varying float vLeafZone;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float NdotL = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float backlit = pow(clamp(dot(-V, L), 0.0, 1.0), 2.2) * 0.45;

        vec3 deepIvy = vec3(0.14, 0.34, 0.16);
        vec3 sunlitTip = vec3(0.42, 0.66, 0.28);
        vec3 blossomTip = vec3(0.98, 0.72, 0.82);

        vec3 baseCol = mix(deepIvy, sunlitTip, vDropFrac * 0.85);
        // Subtle cherry-pink blossom tips along trailing vine ends
        float budMask = smoothstep(0.68, 0.95, vLeafZone) * smoothstep(0.45, 0.90, vDropFrac);
        baseCol = mix(baseCol, blossomTip, budMask);

        #ifdef USE_INSTANCING_COLOR
        baseCol *= vInstanceColor;
        #endif

        vec3 col = baseCol * (0.45 + 0.70 * NdotL) + sunlitTip * backlit * vDropFrac;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true
  });
}

/**
 * 21. Floating Sakura Petals Resting & Drifting on Fountain Water (`InstancedMesh`)
 */
export function createFloatingWaterPetalsMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      attribute float aPhase;
      varying float vPhase;
      varying vec3 vNormal;
      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        vPhase = aPhase;
        #ifdef USE_INSTANCING_COLOR
        vInstanceColor = instanceColor;
        #endif

        vec3 p = position;

        // Gentle circular water-eddy drift & subtle wave bob on basin surface
        float driftAngle = uTime * 0.14 + aPhase * 6.2831;
        float eddyR = 0.22;
        vec3 worldOffset = vec3(
          cos(driftAngle) * eddyR,
          sin(uTime * 1.9 + aPhase * 12.0) * 0.008,
          sin(driftAngle) * eddyR
        );

        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * vec4(p, 1.0);
        worldPos.xyz += worldOffset;
        vNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);
        #else
        vec4 worldPos = modelMatrix * vec4(p, 1.0) + vec4(worldOffset, 0.0);
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        #endif

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vPhase;
      varying vec3 vNormal;
      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        vec3 col = vec3(0.98, 0.78, 0.86);
        #ifdef USE_INSTANCING_COLOR
        col *= vInstanceColor;
        #endif
        float topLit = 0.78 + 0.22 * abs(vNormal.y);
        gl_FragColor = vec4(col * topLit, 0.96);
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    fog: true
  });
}
