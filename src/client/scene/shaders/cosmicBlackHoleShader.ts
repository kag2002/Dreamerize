import * as THREE from 'three';

export interface BasaltPbrTextureSet {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  aoMap: THREE.DataTexture;
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

function lerpJS(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash2i(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tileNoiseJS(u: number, v: number, period: number, seed: number): number {
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

  return lerpJS(lerpJS(n00, n10, sx), lerpJS(n01, n11, sx), sy);
}

function tileFbmJS(u: number, v: number, basePeriod: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoiseJS(u, v, period, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

function tileVoronoiEdge(u: number, v: number, cells: number, seed: number): { edge: number; cellId: number } {
  const gx = u * cells;
  const gy = v * cells;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;

  let d1 = 999;
  let d2 = 999;
  let cellId = 0;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ((ix + ox) % cells + cells) % cells;
      const cy = ((iy + oy) % cells + cells) % cells;
      const jx = 0.14 + 0.72 * hash2i(cx, cy, seed);
      const jy = 0.14 + 0.72 * hash2i(cx, cy, seed + 173);
      const dx = ox + jx - fx;
      const dy = oy + jy - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        cellId = hash2i(cx, cy, seed + 311);
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }
  return { edge: d2 - d1, cellId };
}

/**
 * Generates a seamless 512x512 volcanic basalt & conchoidal obsidian PBR texture set
 * (`map`, `normalMap`, `roughnessMap`, `aoMap`) using continuous multi-scale ridged multifractal
 * cooling fissures and wind-rippled volcanic mineral grain (zero regular Voronoi polygon grids!).
 */
export function createBasaltObsidianPbrTextures(
  renderer?: THREE.WebGLRenderer,
  size = 512,
  repeatX = 1,
  repeatY = 1
): BasaltPbrTextureSet {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const ao = new Float32Array(size * size);

  let anisotropy = 4;
  try {
    const cap = (renderer as unknown as { capabilities?: { getMaxAnisotropy?: () => number } })?.capabilities;
    if (cap?.getMaxAnisotropy) {
      anisotropy = Math.min(8, Math.max(1, cap.getMaxAnisotropy()));
    }
  } catch {
    // Headless mock safe
  }

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Multi-octave domain warp so cooling cracks branch organically without any grid cells
      const warpU = (tileFbmJS(u, v, 5, 4, 701) - 0.5) * 0.14;
      const warpV = (tileFbmJS(u + 0.41, v + 0.23, 5, 4, 811) - 0.5) * 0.14;
      const wu = (u + warpU + 1.0) % 1.0;
      const wv = (v + warpV + 1.0) % 1.0;

      // Branching natural cooling cracks via ridged multifractal zero-crossings
      const fA = tileFbmJS(wu, wv, 4, 3, 907) * 2.0 - 1.0;
      const fB = tileFbmJS((wu + 0.29) % 1.0, (wv + 0.57) % 1.0, 9, 3, 1201) * 2.0 - 1.0;
      const fC = tileNoiseJS(wu, wv, 22, 1373) * 2.0 - 1.0;
      const primaryCrack = Math.pow(Math.max(0.0, 1.0 - Math.abs(fA) * 5.2), 2.4);
      const secondaryCrack = Math.pow(Math.max(0.0, 1.0 - Math.abs(fB) * 6.8), 2.6);
      const hairCrack = Math.pow(Math.max(0.0, 1.0 - Math.abs(fC) * 9.0), 3.0);
      const crackMask = clamp01(primaryCrack * 0.72 + secondaryCrack * 0.48 + hairCrack * 0.28);

      // Conchoidal volcanic glass flow bands & fine volcanic sand/pumice mineral grain
      const flowBand = tileFbmJS(u, v, 6, 4, 1409);
      const ripple = tileFbmJS((u + flowBand * 0.12) % 1.0, v, 18, 3, 1523);
      const microGrain = tileNoiseJS(u, v, 64, 1613);
      const fineSpeck = tileNoiseJS(u, v, 128, 1777);

      const plateHeight = 0.58 + (flowBand - 0.5) * 0.22 + (ripple - 0.5) * 0.14 + (microGrain - 0.5) * 0.06;
      const h = clamp01(lerpJS(plateHeight, 0.14 + microGrain * 0.08, crackMask));

      // Deep volcanic obsidian & charcoal basalt tones with subtle iridescent mineral sheen
      const tone = 0.78 + flowBand * 0.36 + (ripple - 0.5) * 0.20 + (fineSpeck - 0.5) * 0.10;
      let rCol = 24 * tone;
      let gCol = 26 * tone;
      let bCol = 38 * tone;

      const mineralSheen = smoothstepJS(0.56, 0.88, flowBand * 0.6 + ripple * 0.4);
      rCol = lerpJS(rCol, 42 + ripple * 20, mineralSheen * 0.38);
      gCol = lerpJS(gCol, 48 + ripple * 18, mineralSheen * 0.36);
      bCol = lerpJS(bCol, 74 + ripple * 28, mineralSheen * 0.45);

      // Matte volcanic ash inside natural cooling cracks
      rCol = lerpJS(rCol, 11 + microGrain * 6, crackMask * 0.78);
      gCol = lerpJS(gCol, 12 + microGrain * 6, crackMask * 0.78);
      bCol = lerpJS(bCol, 17 + microGrain * 9, crackMask * 0.78);

      const pIdx = y * size + x;
      const cIdx = pIdx * 4;
      albedo[cIdx] = clampByte(rCol);
      albedo[cIdx + 1] = clampByte(gCol);
      albedo[cIdx + 2] = clampByte(bCol);
      albedo[cIdx + 3] = 255;

      height[pIdx] = h;
      rough[pIdx] = clamp01(lerpJS(0.14 + ripple * 0.22 + (1.0 - mineralSheen) * 0.18, 0.88, crackMask));
      ao[pIdx] = clamp01(lerpJS(0.86 + (ripple - 0.5) * 0.12, 0.28, crackMask));
    }
  }

  const initTex = (tex: THREE.DataTexture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = anisotropy;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    if (renderer && typeof (renderer as unknown as { initTexture?: (t: THREE.Texture) => void }).initTexture === 'function') {
      try {
        (renderer as unknown as { initTexture: (t: THREE.Texture) => void }).initTexture(tex);
      } catch {
        // Ignore in headless mock
      }
    }
    return tex;
  };

  // Sobel normal map
  const normalData = new Uint8Array(size * size * 4);
  const mask = size - 1;
  const isPow2 = (size & mask) === 0;
  const sampleH = (sx: number, sy: number) => {
    const wx = isPow2 ? sx & mask : ((sx % size) + size) % size;
    const wy = isPow2 ? sy & mask : ((sy % size) + size) % size;
    return height[wy * size + wx];
  };
  const strength = 3.2;
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

  const toGrayTex = (arr: Float32Array) => {
    const d = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const val = clampByte(arr[i] * 255);
      const idx = i * 4;
      d[idx] = val;
      d[idx + 1] = val;
      d[idx + 2] = val;
      d[idx + 3] = 255;
    }
    return initTex(new THREE.DataTexture(d, size, size, THREE.RGBAFormat), false);
  };

  return {
    map: initTex(new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat), true),
    normalMap: initTex(new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat), false),
    roughnessMap: toGrayTex(rough),
    aoMap: toGrayTex(ao)
  };
}

export function disposeBasaltPbrTextures(set: BasaltPbrTextureSet): void {
  set.map.dispose();
  set.normalMap.dispose();
  set.roughnessMap.dispose();
  set.aoMap.dispose();
}

const GLSL_NOISE_3D = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.04 + vec3(4.3, 9.1, 2.7);
      a *= 0.5;
    }
    return v;
  }
`;

const GLSL_NOISE_2D = /* glsl */ `
  float hash2(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 23.41);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
      mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm2(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p = p * 2.03 + vec2(13.7, 7.9);
      a *= 0.5;
    }
    return v;
  }
`;

/**
 * Creates a full 360-degree deep cosmic nebula sky dome material featuring
 * subtle domain-warped Milky Way dust lanes, layered volumetric horizon nebula clouds,
 * and crisp pinpoint background stars (zero straight-line diagonal streaks).
 */
export function createCosmicNebulaSkyMaterial(customUniforms?: Partial<{
  swirlSpeed: number;
  topColor: string | THREE.Color;
  bottomColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const uniforms = {
    uTime: { value: 0.0 },
    uSwirlSpeed: { value: customUniforms?.swirlSpeed ?? 1.0 },
    uTopColor: {
      value: customUniforms?.topColor instanceof THREE.Color
        ? customUniforms.topColor
        : new THREE.Color(customUniforms?.topColor ?? '#03020b')
    },
    uBottomColor: {
      value: customUniforms?.bottomColor instanceof THREE.Color
        ? customUniforms.bottomColor
        : new THREE.Color(customUniforms?.bottomColor ?? '#1a0c38')
    },
    uHorizonColor: {
      value: customUniforms?.horizonColor instanceof THREE.Color
        ? customUniforms.horizonColor
        : new THREE.Color(customUniforms?.horizonColor ?? '#0c2342')
    },
    uBassEnergy: { value: 0.0 },
    uNebulaIntensity: { value: 1.0 },
    uStarBrightness: { value: 1.0 }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDirection;
      void main() {
        vWorldDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uHorizonColor;
      uniform float uBassEnergy;
      uniform float uNebulaIntensity;
      uniform float uStarBrightness;
      varying vec3 vWorldDirection;

      ${GLSL_NOISE_3D}

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      vec2 cubeSphereUv(vec3 d, out float faceId) {
        vec3 ad = abs(d);
        if (ad.x >= ad.y && ad.x >= ad.z) {
          faceId = d.x > 0.0 ? 0.0 : 1.0;
          return d.yz / max(ad.x, 1e-4);
        } else if (ad.y >= ad.x && ad.y >= ad.z) {
          faceId = d.y > 0.0 ? 2.0 : 3.0;
          return d.xz / max(ad.y, 1e-4);
        }
        faceId = d.z > 0.0 ? 4.0 : 5.0;
        return d.xy / max(ad.z, 1e-4);
      }

      vec3 pinpointStarLayer(vec2 uv, float faceId, float scale, float density, float time, float sizeMax) {
        vec2 gv = uv * scale + vec2(faceId * 37.0, faceId * 19.0);
        vec2 id = floor(gv);
        vec2 f = fract(gv);
        float rnd = hash21(id);
        if (rnd < density) return vec3(0.0);

        vec2 starPos = vec2(
          0.20 + 0.60 * hash21(id + vec2(11.3, 4.7)),
          0.20 + 0.60 * hash21(id + vec2(27.9, 13.1))
        );
        float dist = length(f - starPos);
        float mag = pow(fract(rnd * 31.7), 1.8);
        float size = mix(0.022, sizeMax, mag);
        // Crisp pinpoint core with subtle airy halo only on brightest stars
        float core = pow(smoothstep(size, 0.0, dist), 1.85);
        float twinkle = 0.68 + 0.32 * sin(time * (1.1 + fract(rnd * 17.3) * 2.4) + rnd * 62.8);

        float temp = fract(rnd * 73.1);
        vec3 starCol = mix(vec3(0.68, 0.86, 1.0), vec3(1.0, 0.97, 0.92), smoothstep(0.18, 0.62, temp));
        starCol = mix(starCol, vec3(1.0, 0.78, 0.56), smoothstep(0.72, 0.98, temp));
        return starCol * core * twinkle * (0.45 + 0.85 * mag);
      }

      void main() {
        vec3 dir = normalize(vWorldDirection);
        float t = uTime * 0.015 * uSwirlSpeed;

        // Deep-space vertical gradient (zenith obsidian -> twilight horizon -> nadir)
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonBand = exp(-pow(dir.y * 3.8, 2.0));
        vec3 base = mix(uBottomColor, uTopColor, smoothstep(0.24, 0.86, h));
        base = mix(base, uHorizonColor, horizonBand * 0.65);

        // Organic, domain-warped Milky Way dust lanes (subtle & curved, zero straight diagonal lines)
        vec3 galNormal = normalize(vec3(-0.34, 0.64, 0.69));
        float warpField = fbm3(dir * 2.1 + vec3(0.4, -0.3, 0.2));
        float galDist = dot(dir, galNormal) + (warpField - 0.5) * 0.34;
        float galBroad = exp(-galDist * galDist * 3.2);
        float galSpine = exp(-galDist * galDist * 8.5);

        vec3 pCloud = dir * 2.6 + vec3(t, -t * 0.45, t * 0.30);
        float n1 = fbm3(pCloud);
        float n2 = fbm3(pCloud * 1.85 + vec3(n1 * 1.9, -n1 * 1.2, n1 * 0.7));
        float n3 = fbm3(dir * 4.8 - vec3(t * 0.35, t * 0.25, -t * 0.18));

        // Dark interstellar dust lanes & rifts softly occluding the Milky Way glow
        float riftNoise = fbm3(dir * 3.8 + vec3(n1 * 1.6));
        float dustLane = smoothstep(0.38, 0.66, riftNoise);
        float milkyWay = (galSpine * (1.0 - 0.78 * dustLane) * 0.55 + galBroad * 0.28) * (0.45 + 0.55 * n1);

        vec3 deepViolet = vec3(0.32, 0.11, 0.56);
        vec3 cosmicTeal = vec3(0.05, 0.46, 0.48);
        vec3 sapphireMist = vec3(0.08, 0.24, 0.58);
        vec3 warmDust = vec3(0.72, 0.44, 0.22);

        vec3 mwCol = mix(sapphireMist, deepViolet, smoothstep(0.28, 0.72, n1));
        mwCol = mix(mwCol, cosmicTeal, smoothstep(0.48, 0.84, n3) * 0.55);
        mwCol = mix(mwCol, warmDust, smoothstep(0.56, 0.88, n2) * 0.40 * galSpine);

        // Layered volumetric nebula clouds hugging the horizon (3 parallax depth strata)
        float horizMask = smoothstep(-0.18, 0.04, dir.y) * smoothstep(0.46, 0.08, dir.y);
        float azimAngle = atan(dir.z, dir.x);
        vec3 hCoord1 = vec3(dir.x * 2.6 + t * 0.7, dir.y * 6.5, dir.z * 2.6 - t * 0.5);
        vec3 hCoord2 = vec3(dir.x * 4.8 - t * 1.1, dir.y * 10.5 + 1.3, dir.z * 4.8 + t * 0.8);
        float hWarp = fbm3(hCoord1 * 0.75);
        float nebLayerA = smoothstep(0.34, 0.78, fbm3(hCoord1 + vec3(hWarp * 1.4)));
        float nebLayerB = smoothstep(0.40, 0.82, fbm3(hCoord2 - vec3(hWarp * 1.1)));
        float nebLayerC = smoothstep(0.46, 0.86, fbm3(hCoord2 * 1.7 + vec3(0.0, t * 0.6, 0.0)));

        // Self-shadowed volumetric cloud density + warm/cool cosmic rim scattering
        float cloudDensity = clamp(nebLayerA * 0.58 + nebLayerB * 0.34 + nebLayerC * 0.22, 0.0, 1.0) * horizMask;
        float selfShadow = 1.0 - 0.52 * nebLayerB;
        float azimuthWarmth = 0.5 + 0.5 * cos(azimAngle + 1.85);
        vec3 hNebCool = mix(vec3(0.08, 0.22, 0.48), vec3(0.36, 0.14, 0.58), nebLayerA);
        vec3 hNebWarm = mix(vec3(0.68, 0.30, 0.22), vec3(0.88, 0.54, 0.28), nebLayerC);
        vec3 horizonNebula = mix(hNebCool, hNebWarm, azimuthWarmth * smoothstep(0.35, 0.85, nebLayerC) * 0.72) * selfShadow;

        float energyBoost = (1.0 + uBassEnergy * 0.24) * uNebulaIntensity;
        vec3 col = base;
        col += mwCol * milkyWay * 0.52 * energyBoost;
        col += horizonNebula * cloudDensity * 0.58 * energyBoost;
        // Soft dust-rift depth darkening inside dense horizon clouds
        col *= 1.0 - 0.24 * dustLane * galSpine * (1.0 - horizMask);

        // Crisp 360-degree pinch-free pinpoint background stars (3 magnitude strata)
        float faceId = 0.0;
        vec2 cUv = cubeSphereUv(dir, faceId);
        float bandBoost = 0.06 * galBroad;
        vec3 starsBright = pinpointStarLayer(cUv, faceId, 68.0, 0.935 - bandBoost * 0.35, uTime, 0.075);
        vec3 starsMed = pinpointStarLayer(cUv + vec2(0.41, 0.17), faceId, 132.0, 0.910 - bandBoost * 0.6, uTime * 0.85, 0.062);
        vec3 starsFine = pinpointStarLayer(cUv + vec2(0.19, 0.63), faceId, 240.0, 0.895 - bandBoost, uTime * 0.72, 0.052);
        float starOcclude = 1.0 - 0.45 * cloudDensity;
        col += (starsBright * 1.15 + starsMed * 0.75 + starsFine * (0.35 + 0.55 * galBroad)) * starOcclude * uStarBrightness;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });
}

/**
 * Creates an authentic 3D Schwarzschild geodesic raymarched Black Hole material.
 * Integrates the exact null geodesic equation (light bending proportional to b^2 / r^4,
 * weak-field deflection ~ b_crit^2 / r^2) around the pure #000000 Schwarzschild event horizon
 * (zero gray sphere lighting), producing:
 * - Pure #000000 shadow core inside the critical impact parameter b_crit = 3*sqrt(3)/2 * r_s
 * - Razor-bright thin Einstein Photon Ring hugging the shadow boundary
 * - Warped secondary image of the back accretion disk arching smoothly OVER the top and
 *   UNDER the bottom of the black hole (classic Interstellar Gargantua silhouette)
 * - Asymmetric Relativistic Doppler Beaming (approaching left/front side incandescent blue-white,
 *   receding right side deep amber-crimson).
 */
export function createSchwarzschildBlackHoleMaterial(bhScale = 6.8): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSwirlSpeed: { value: 1.0 },
      uBassEnergy: { value: 0.0 },
      uBhScale: { value: bhScale },
      uCamLocalPos: { value: new THREE.Vector3(7.6, -7.6, 26.2) },
      uDiskNormal: { value: new THREE.Vector3(-0.18, 0.86, 0.48).normalize() },
      uDiskTangent: { value: new THREE.Vector3(0.936, 0.0, 0.351).normalize() },
      uDiskBitangent: { value: new THREE.Vector3(0.302, -0.510, -0.805).normalize() }
    },
    vertexShader: /* glsl */ `
      uniform float uBhScale;
      varying vec3 vLocalUnitPos;
      varying vec3 vCamLocalUnitPos;
      void main() {
        float invScale = 1.0 / max(uBhScale, 1e-4);
        vec3 bhWorldCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vLocalUnitPos = position * invScale;
        vCamLocalUnitPos = (cameraPosition - bhWorldCenter) * invScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      uniform float uBassEnergy;
      uniform vec3 uDiskNormal;
      uniform vec3 uDiskTangent;
      uniform vec3 uDiskBitangent;
      varying vec3 vLocalUnitPos;
      varying vec3 vCamLocalUnitPos;

      ${GLSL_NOISE_3D}

      const float R_BOUND = 12.2;
      const float R_DISK_IN = 2.10;
      const float R_DISK_OUT = 11.2;
      const float B_CRIT = 2.5980762;

      vec4 sampleAccretionDisk(vec3 pHit, vec3 vRay, vec3 camPos) {
        float u = dot(pHit, uDiskTangent);
        float v = dot(pHit, uDiskBitangent);
        float r = length(vec2(u, v));
        float angle = atan(v, u);
        float safeR = max(r, 1.5);

        // Keplerian differential orbital shear (inner plasma orbits significantly faster)
        float omega = uTime * (0.48 + 3.4 / pow(safeR, 1.35)) * uSwirlSpeed;
        float spiral = angle - omega + 9.2 / safeR;

        // Seam-free 3D cylindrical noise along sheared plasma filaments
        vec3 cylA = vec3(cos(spiral) * r * 1.15, sin(spiral) * r * 1.15, r * 2.4 - uTime * 0.20 * uSwirlSpeed);
        vec3 cylB = vec3(cos(spiral * 2.0) * r * 2.1, sin(spiral * 2.0) * r * 2.1, r * 4.6 + uTime * 0.26 * uSwirlSpeed);
        vec3 cylC = vec3(cos(spiral * 3.0 + 1.1) * r * 3.4, sin(spiral * 3.0 + 1.1) * r * 3.4, r * 7.4 - uTime * 0.32 * uSwirlSpeed);
        float nA = fbm3(cylA);
        float nB = noise3(cylB);
        float nC = noise3(cylC);

        float rings1 = 0.5 + 0.5 * sin(r * 7.8 + nA * 3.8);
        float rings2 = 0.5 + 0.5 * sin(r * 16.5 - nB * 3.0 + nC * 1.6);
        float rings3 = 0.5 + 0.5 * sin(r * 30.0 + spiral * 2.0 + nC * 3.2);
        float filament = smoothstep(0.12, 0.88, nA * 0.42 + rings1 * 0.24 + rings2 * 0.20 + rings3 * 0.14);
        float dustGap = smoothstep(0.12, 0.82, rings1 * 0.48 + nB * 0.32 + nC * 0.20);

        float innerFade = smoothstep(R_DISK_IN, R_DISK_IN + 0.35, r);
        float outerFade = smoothstep(R_DISK_OUT, 5.0, r);
        float radialEnv = innerFade * outerFade;

        // Hot ISCO (Innermost Stable Circular Orbit) plasma crest
        float iscoDist = (r - 2.75) * 2.1;
        float iscoCrest = exp(-iscoDist * iscoDist) * 1.55;

        // Asymmetric Relativistic Doppler Beaming:
        // Approaching left/front side is incandescent blue-white & intense;
        // Receding right side is deep amber-crimson & dimmer.
        vec3 vOrb = normalize(cross(uDiskNormal, pHit));
        vec3 toCam = normalize(camPos - pHit);
        float muPhoton = dot(vOrb, -normalize(vRay));
        float muCam = dot(vOrb, toCam);
        float approach = clamp(mix(muPhoton, muCam, 0.48), -1.0, 1.0);

        float beta = 0.48;
        float relFactor = 1.0 / (0.877 * (1.0 - beta * approach));
        float doppler = clamp(pow(relFactor, 2.35), 0.28, 2.55);

        float blueShift = smoothstep(0.05, 0.88, approach);
        float redShift = smoothstep(0.05, 0.88, -approach);

        vec3 hotBlueWhite = vec3(0.88, 0.96, 1.32);
        vec3 hotGoldWhite = vec3(1.12, 0.95, 0.74);
        vec3 solarAmber = vec3(1.04, 0.56, 0.14);
        vec3 deepCrimson = vec3(0.80, 0.18, 0.05);
        vec3 burntRuby = vec3(0.36, 0.06, 0.04);

        vec3 innerCol = mix(hotGoldWhite, hotBlueWhite, blueShift * 0.92);
        vec3 midCol = mix(solarAmber, vec3(0.95, 0.88, 1.08), blueShift * 0.65);
        midCol = mix(midCol, deepCrimson, redShift * 0.68);
        vec3 outerCol = mix(deepCrimson, burntRuby, smoothstep(6.2, R_DISK_OUT, r));

        float rNorm = clamp((r - R_DISK_IN) / (R_DISK_OUT - R_DISK_IN), 0.0, 1.0);
        vec3 col = mix(innerCol, midCol, smoothstep(0.02, 0.36, rNorm));
        col = mix(col, outerCol, smoothstep(0.36, 0.92, rNorm));

        float brightness = (0.34 + filament * 0.86 + iscoCrest * 0.95) * doppler * (1.0 + uBassEnergy * 0.22);
        vec3 rgb = col * brightness * (0.40 + 0.70 * dustGap);
        float alpha = clamp((radialEnv * mix(0.56, 0.95, filament) + iscoCrest * 0.45 * radialEnv), 0.0, 0.96);
        return vec4(rgb, alpha);
      }

      void main() {
        vec3 ro = vCamLocalUnitPos;
        vec3 rd = normalize(vLocalUnitPos - ro);

        // Intersect ray with bounding sphere R_BOUND (works whether camera is outside or inside)
        float bSph = dot(ro, rd);
        float cSph = dot(ro, ro) - R_BOUND * R_BOUND;
        float disc = bSph * bSph - cSph;
        if (disc < 0.0) discard;
        float sqrtDisc = sqrt(disc);
        float tNear = max(0.0, -bSph - sqrtDisc);
        float tFar = -bSph + sqrtDisc;
        if (tFar <= 0.001) discard;

        vec3 p = ro + rd * tNear;
        vec3 v = rd;

        // Conserved angular momentum h = p x v (|h| = impact parameter b)
        // Schwarzschild bending force: a = -1.5 * r_s * b^2 / r^5 * p (deflection ~ b_crit^2 / r^2)
        vec3 hVec = cross(p, v);
        float h2 = dot(hVec, hVec);
        float bImpact = sqrt(h2);

        float minR = length(p);
        bool hitHorizon = false;
        vec3 accumCol = vec3(0.0);
        float accumAlpha = 0.0;

        for (int i = 0; i < 84; i++) {
          float r = length(p);
          minR = min(minR, r);

          if (r <= 1.03) {
            hitHorizon = true;
            break;
          }
          if (i > 3 && r > R_BOUND + 0.15 && dot(p, v) > 0.0) {
            break;
          }
          if (accumAlpha >= 0.985) {
            break;
          }

          float distToPlane = abs(dot(p, uDiskNormal));
          float dt = clamp(r * 0.075, 0.032, 0.48);
          if (distToPlane < 0.75 && r < 11.4) {
            dt = min(dt, 0.24);
          }

          // RK2 midpoint integration of the exact Schwarzschild null geodesic
          float rSafe = max(r, 0.55);
          float rInv5 = 1.0 / (rSafe * rSafe * rSafe * rSafe * rSafe);
          vec3 a0 = p * (-1.5 * h2 * rInv5);

          vec3 pMid = p + v * (0.5 * dt);
          vec3 vMid = v + a0 * (0.5 * dt);
          float rMid = max(length(pMid), 0.55);
          float rMidInv5 = 1.0 / (rMid * rMid * rMid * rMid * rMid);
          vec3 aMid = pMid * (-1.5 * h2 * rMidInv5);

          vec3 pNext = p + vMid * dt;
          vec3 vNext = v + aMid * dt;

          // Exact analytic segment-plane crossing against the equatorial accretion disk
          float d0 = dot(p, uDiskNormal);
          float d1 = dot(pNext, uDiskNormal);
          if (d0 * d1 <= 0.0) {
            float denom = abs(d0) + abs(d1);
            float frac = denom > 1e-6 ? abs(d0) / denom : 0.5;
            vec3 pHit = mix(p, pNext, frac);
            float rHit = length(pHit);
            if (rHit >= R_DISK_IN && rHit <= R_DISK_OUT) {
              vec4 diskSample = sampleAccretionDisk(pHit, vMid, ro);
              accumCol += (1.0 - accumAlpha) * diskSample.rgb * diskSample.a;
              accumAlpha += (1.0 - accumAlpha) * diskSample.a;
            }
          }

          p = pNext;
          v = vNext;
        }

        // Razor-bright thin Einstein Photon Ring hugging the exact critical geodesic boundary (b_crit)
        if (!hitHorizon && minR < 3.15) {
          float bExcess = max(bImpact - B_CRIT, 0.0);
          float photonProximity = smoothstep(3.15, 1.50, minR);
          float razorRing = exp(-pow(bExcess / 0.048, 2.0)) * 2.35 * photonProximity;
          float innerGlow = exp(-pow(bExcess / 0.19, 2.0)) * 0.48 * photonProximity;

          // Smooth 360-degree relativistic Doppler beaming around the photon ring
          vec3 impactVec = ro - dot(ro, rd) * rd;
          float impLen = length(impactVec);
          vec3 orbDirRaw = impLen > 1e-4 ? cross(uDiskNormal, impactVec / impLen) : vec3(0.0);
          float ringApproach = clamp(dot(orbDirRaw, normalize(ro)), -1.0, 1.0);
          float ringRel = 1.0 / (0.877 * (1.0 - 0.46 * ringApproach));
          float ringDoppler = clamp(pow(ringRel, 2.15), 0.36, 2.40);

          vec3 ringCol = mix(vec3(1.10, 0.80, 0.46), vec3(0.88, 0.98, 1.38), smoothstep(-0.12, 0.85, ringApproach));
          ringCol = mix(ringCol, vec3(0.95, 0.28, 0.07), smoothstep(0.12, 0.88, -ringApproach) * 0.72);

          float ringIntensity = (razorRing + innerGlow) * ringDoppler * (1.0 + uBassEnergy * 0.22);
          float ringAlpha = clamp(razorRing * 0.86 + innerGlow * 0.44, 0.0, 0.98);
          accumCol += (1.0 - accumAlpha) * ringCol * ringIntensity;
          accumAlpha = clamp(accumAlpha + (1.0 - accumAlpha) * ringAlpha, 0.0, 1.0);
        }

        if (hitHorizon) {
          // Pure #000000 event horizon core (front disk crossing in front remains visible; zero gray lighting)
          accumAlpha = 1.0;
        }

        if (accumAlpha < 0.004) discard;
        gl_FragColor = vec4(accumCol / max(accumAlpha, 1e-4), accumAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide
  });
}

/**
 * Creates the Gargantua-style relativistic accretion disk material with
 * seam-free Keplerian spiral plasma filaments, dark dust gaps, inner ISCO
 * hot white-gold rim, and relativistic Doppler beaming.
 */
export function createAccretionDiskMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSwirlSpeed: { value: 1.0 },
      uBassEnergy: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      uniform float uBassEnergy;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      ${GLSL_NOISE_3D}

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        // Inner gap around the event horizon core + outer disk boundary
        if (r > 0.99 || r < 0.183) discard;

        float angle = atan(p.y, p.x);
        float safeR = max(r, 0.185);
        // Keplerian differential rotation (inner plasma orbits significantly faster)
        float omega = uTime * (0.64 + 1.25 / pow(safeR, 1.15)) * uSwirlSpeed;
        float spiral = angle + omega - 6.8 / safeR;

        // Seam-free 3D cylindrical noise sampling around multi-octave sheared spiral plasma arms
        vec3 cylA = vec3(cos(spiral) * r * 11.5, sin(spiral) * r * 11.5, r * 18.0 - uTime * 0.22 * uSwirlSpeed);
        vec3 cylB = vec3(cos(spiral * 2.0) * r * 20.0, sin(spiral * 2.0) * r * 20.0, r * 32.0 + uTime * 0.28 * uSwirlSpeed);
        vec3 cylC = vec3(cos(spiral * 3.0 + 1.2) * r * 32.0, sin(spiral * 3.0 + 1.2) * r * 32.0, r * 48.0 - uTime * 0.34 * uSwirlSpeed);
        vec3 cylD = vec3(cos(spiral * 5.0 - 0.7) * r * 48.0, sin(spiral * 5.0 - 0.7) * r * 48.0, r * 72.0 + uTime * 0.42 * uSwirlSpeed);
        float nA = fbm3(cylA);
        float nB = noise3(cylB);
        float nC = noise3(cylC);
        float nD = noise3(cylD);

        // Fine spiral plasma filaments, crisp sheared threads & magnetic Cassini-like dust gaps
        float ringPattern = 0.5 + 0.5 * sin(r * 48.0 + nA * 4.0);
        float fineRings = 0.5 + 0.5 * sin(r * 92.0 - nB * 3.2 + nC * 1.6);
        float microStreaks = 0.5 + 0.5 * sin(r * 164.0 + nC * 3.6 - nD * 2.4);
        float ultraFineThreads = pow(0.5 + 0.5 * sin(r * 240.0 + spiral * 4.0 + nD * 4.2), 1.8);
        float filament = smoothstep(0.14, 0.88, nA * 0.38 + ringPattern * 0.22 + fineRings * 0.18 + microStreaks * 0.12 + ultraFineThreads * 0.10);
        float dustLane = smoothstep(0.10, 0.80, ringPattern * 0.46 + nB * 0.28 + nC * 0.16 + nD * 0.10);

        float innerFade = smoothstep(0.183, 0.200, r);
        float outerFade = smoothstep(0.99, 0.40, r);
        float radialProfile = innerFade * outerFade;

        // Intense ISCO (Innermost Stable Circular Orbit) razor-hot plasma crest
        float iscoDist = (r - 0.202) * 48.0;
        float iscoCrest = exp(-iscoDist * iscoDist) * 1.75;

        // Relativistic Doppler beaming: approaching left limb blue-shifted & brighter,
        // receding right limb red-shifted to deep amber-crimson
        float approach = clamp(-p.x / safeR, -1.0, 1.0);
        float beta = 0.44;
        float relFactor = 1.0 / (0.898 * (1.0 - beta * approach));
        float doppler = clamp(pow(relFactor, 2.2), 0.34, 2.15);

        vec3 hotWhiteBlue = vec3(0.88, 0.96, 1.12);
        vec3 hotIscoGold = vec3(1.06, 0.95, 0.82);
        vec3 solarAmber = vec3(1.0, 0.62, 0.16);
        vec3 crimsonRecede = vec3(0.76, 0.16, 0.06);
        vec3 burntRubyEdge = vec3(0.32, 0.06, 0.08);

        // Temperature shift from approaching white-blue -> neutral gold -> receding amber-crimson
        float blueShift = smoothstep(0.05, 0.92, approach);
        float redShift = smoothstep(0.05, 0.92, -approach);

        vec3 innerCol = mix(hotIscoGold, hotWhiteBlue, blueShift * 0.88);
        vec3 midCol = mix(solarAmber, vec3(1.0, 0.82, 0.58), blueShift * 0.58);
        midCol = mix(midCol, crimsonRecede, redShift * 0.62);
        vec3 outerCol = mix(crimsonRecede, burntRubyEdge, smoothstep(0.62, 0.96, r));

        vec3 col = mix(innerCol, midCol, smoothstep(0.20, 0.46, r));
        col = mix(col, outerCol, smoothstep(0.46, 0.84, r));

        // Clean HDR core emission calibrated for AgXToneMapping + crisp bloom threshold (0.9)
        float coreBoost = 1.0 + iscoCrest * 0.85;
        float brightness = (0.28 + filament * 0.78 + iscoCrest * 0.82) * doppler * (1.0 + uBassEnergy * 0.22);
        vec3 finalRgb = col * brightness * (0.38 + 0.72 * dustLane) * mix(0.80, 1.08, coreBoost * 0.40);

        float density = radialProfile * mix(0.76, 0.99, filament) + iscoCrest * 0.62;
        float alpha = clamp(density, 0.0, 0.99);
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(finalRgb, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Creates the Gargantua gravitational lensing halo material featuring a razor-sharp
 * Einstein Photon Ring hugging the event horizon shadow and symmetric upper & lower
 * light-bent accretion arches aligned dynamically to the 3D disk plane.
 */
export function createLensingHaloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSwirlSpeed: { value: 1.0 },
      uBassEnergy: { value: 0.0 },
      uDiskUp2D: { value: new THREE.Vector2(0.0, 1.0) },
      uDiskInclination: { value: 0.2 },
      uShadowRadiusUv: { value: 10.0 / 43.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      uniform float uBassEnergy;
      uniform vec2 uDiskUp2D;
      uniform float uDiskInclination;
      uniform float uShadowRadiusUv;
      varying vec2 vUv;

      ${GLSL_NOISE_3D}

      float archFilaments(float archT, float phi, float speedDir, float timeScale) {
        float omega = uTime * timeScale * speedDir * (0.50 + 1.05 / pow(archT + 0.22, 0.88));
        float phase = phi * 3.0 + omega - archT * 5.2;
        vec3 samplePos = vec3(cos(phase) * 4.2, sin(phase) * 4.2, archT * 20.0);
        float n = fbm3(samplePos);
        float nFine = noise3(samplePos * 2.6 + vec3(1.7, 3.1, 0.9));
        float nUltra = noise3(samplePos * 5.4 - vec3(2.3, 0.8, 4.1));
        float rings = 0.5 + 0.5 * sin(archT * 54.0 + n * 4.6);
        float fineRings = 0.5 + 0.5 * sin(archT * 106.0 - nFine * 3.6 + nUltra * 1.8);
        return smoothstep(0.14, 0.90, n * 0.42 + rings * 0.34 + fineRings * 0.24);
      }

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float rPhoton = uShadowRadiusUv + 0.005;
        if (r > 0.99 || r < uShadowRadiusUv) discard;
        float eventHorizonClip = smoothstep(uShadowRadiusUv, uShadowRadiusUv + 0.006, r);

        float upLen = length(uDiskUp2D);
        vec2 upAxis = upLen > 1e-4 ? uDiskUp2D / upLen : vec2(0.0, 1.0);
        vec2 rightAxis = vec2(upAxis.y, -upAxis.x);

        float diskV = dot(p, upAxis);
        float diskU = dot(p, rightAxis);
        float safeR = max(r, 1e-4);

        // Relativistic Doppler beaming (left approaching limb brighter & blue-white, right receding amber-crimson)
        float approach = clamp(-diskU / safeR, -1.0, 1.0);
        float beta = 0.44;
        float relFactor = 1.0 / (0.898 * (1.0 - beta * approach));
        float doppler = clamp(pow(relFactor, 2.1), 0.36, 2.10);

        // 1. Razor-sharp Einstein Photon Ring & secondary lensed photon sub-ring hugging the shadow
        float dPhot1 = (r - rPhoton) * 225.0;
        float dPhot2 = (r - (rPhoton + 0.011)) * 124.0;
        float primaryPhoton = exp(-dPhot1 * dPhot1) * 1.82;
        float secondaryPhoton = exp(-dPhot2 * dPhot2) * 0.72;
        float photonAura = exp(-max(r - rPhoton, 0.0) * 28.0) * 0.18;

        // 2. Warped upper & lower lensed accretion arches (far side of disk bent by gravity)
        float vertFrac = clamp(abs(diskV) / safeR, 0.0001, 1.0);
        float inclFactor = clamp(1.0 - 0.42 * uDiskInclination, 0.48, 1.0);
        float upperWidth = mix(0.10, 0.36, pow(vertFrac, 0.78)) * inclFactor;
        float lowerWidth = mix(0.08, 0.24, pow(vertFrac, 0.85)) * inclFactor;

        float phi = atan(diskV, diskU);

        // Upper lensed arch (sweeps symmetrically over top of black hole shadow)
        float upperMask = smoothstep(-0.14, 0.22, diskV);
        float upperT = clamp((r - rPhoton) / max(upperWidth, 0.01), 0.0, 1.0);
        float upperInBounds = step(rPhoton - 0.004, r) * step(r, rPhoton + upperWidth);
        float upperStream = archFilaments(upperT, phi, 1.0, uSwirlSpeed);
        float upperEnv = smoothstep(0.0, 0.08, upperT) * pow(max(1.0 - upperT, 0.0001), 1.35);
        float upperArch = upperMask * upperInBounds * upperEnv * (0.42 + 0.96 * upperStream);

        // Lower lensed arch (underside of back disk bent around bottom of shadow)
        float lowerMask = smoothstep(0.12, -0.20, diskV);
        float lowerT = clamp((r - rPhoton) / max(lowerWidth, 0.01), 0.0, 1.0);
        float lowerInBounds = step(rPhoton - 0.004, r) * step(r, rPhoton + lowerWidth);
        float lowerStream = archFilaments(lowerT, -phi, 1.0, uSwirlSpeed);
        float lowerEnv = smoothstep(0.0, 0.08, lowerT) * pow(max(1.0 - lowerT, 0.0001), 1.45);
        float lowerArch = lowerMask * lowerInBounds * lowerEnv * (0.34 + 0.84 * lowerStream) * 0.74;

        // Soft outer gravitational bloom (zero polygon banding)
        float outerGlow = exp(-max(r - rPhoton, 0.0) * 7.2) * (0.14 + 0.22 * vertFrac) * smoothstep(0.99, 0.62, r);

        float blueShift = smoothstep(0.05, 0.90, approach);
        float redShift = smoothstep(0.05, 0.90, -approach);

        vec3 photonColor = mix(vec3(1.04, 0.92, 0.76), vec3(0.88, 0.96, 1.15), blueShift * 0.80);
        photonColor = mix(photonColor, vec3(1.02, 0.56, 0.24), redShift * 0.55);

        vec3 archInnerColor = mix(vec3(1.05, 0.84, 0.48), vec3(0.86, 0.94, 1.08), blueShift * 0.65);
        vec3 archMidColor = mix(vec3(1.0, 0.52, 0.14), vec3(0.82, 0.22, 0.08), redShift * 0.65);
        vec3 archOuterColor = vec3(0.56, 0.14, 0.28);

        float archRadialT = clamp((r - rPhoton) / max(max(upperWidth, lowerWidth), 0.01), 0.0, 1.0);
        vec3 archCol = mix(archInnerColor, archMidColor, smoothstep(0.06, 0.52, archRadialT));
        archCol = mix(archCol, archOuterColor, smoothstep(0.52, 0.98, archRadialT));

        float bassBoost = 1.0 + uBassEnergy * 0.22;
        vec3 col = photonColor * (primaryPhoton + secondaryPhoton) * doppler * bassBoost;
        col += archCol * (upperArch + lowerArch) * doppler * 0.88 * bassBoost;
        col += mix(archMidColor, vec3(0.45, 0.20, 0.65), 0.42) * (photonAura + outerGlow) * doppler * 0.68;

        float alpha = clamp((primaryPhoton * 0.96 + secondaryPhoton * 0.72 + upperArch + lowerArch + outerGlow + photonAura * 0.55) * smoothstep(0.99, 0.72, r) * eventHorizonClip, 0.0, 1.0);
        if (alpha < 0.008) discard;

        gl_FragColor = vec4(col * eventHorizonClip, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Creates the boiling surreal sun sphere material with animated multi-scale
 * churning solar granulation, erupting magnetic flare hotspots, and chromospheric rim.
 */
export function createSurrealSunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vLocalPos = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;
      varying vec3 vNormal;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;

      ${GLSL_NOISE_3D}

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = max(dot(N, V), 0.0);

        // Churning multi-scale convective solar granulation (advecting & boiling photosphere cells)
        vec3 driftA = vec3(uTime * 0.14, -uTime * 0.11, uTime * 0.12);
        vec3 driftB = vec3(-uTime * 0.19, uTime * 0.15, -uTime * 0.13);
        vec3 pMacro = vLocalPos * 5.6 + driftA;
        vec3 pMicro = vLocalPos * 14.8 + driftB;
        float warp = fbm3(pMacro * 0.85 + vec3(0.0, uTime * 0.08, 0.0));
        float cellsMacro = fbm3(pMacro + vec3(warp * 2.35));
        float cellsBoil = fbm3(vLocalPos * 9.2 - driftA * 1.4 + vec3(cellsMacro * 1.6));
        float ridgeMacro = 1.0 - abs(noise3(pMacro * 2.9 + vec3(warp * 2.5)) * 2.0 - 1.0);
        float ridgeMicro = 1.0 - abs(noise3(pMicro + vec3(cellsMacro * 1.7)) * 2.0 - 1.0);
        float granules = smoothstep(0.16, 0.88, cellsMacro * 0.36 + cellsBoil * 0.24 + ridgeMacro * 0.24 + ridgeMicro * 0.16);

        // Active magnetic sunspot clusters surrounded by churning white-hot flare faculae
        float spotField = fbm3(vLocalPos * 3.0 - driftA * 0.72);
        float sunspotMask = smoothstep(0.24, 0.13, spotField);
        float faculaeField = fbm3(vLocalPos * 3.8 + driftB * 1.15);
        float flarePulse = 0.75 + 0.25 * sin(uTime * 2.4 + spotField * 14.0);
        float faculaeMask = smoothstep(0.64, 0.90, faculaeField) * flarePulse;

        vec3 umbraCol = vec3(0.28, 0.04, 0.01);
        vec3 darkLane = vec3(0.72, 0.15, 0.02);
        vec3 moltenOrange = vec3(1.02, 0.46, 0.07);
        vec3 goldenDome = vec3(1.12, 0.86, 0.30);
        vec3 whiteHot = vec3(1.38, 1.22, 0.98);
        vec3 chromoRed = vec3(1.18, 0.34, 0.14);

        vec3 col = mix(darkLane, moltenOrange, smoothstep(0.14, 0.46, granules));
        col = mix(col, goldenDome, smoothstep(0.44, 0.76, granules));
        col = mix(col, whiteHot, smoothstep(0.74, 0.95, granules));
        col = mix(col, umbraCol, sunspotMask * 0.82);
        col += vec3(1.35, 1.12, 0.70) * faculaeMask * (0.78 + uBassEnergy * 0.42);

        // Authentic limb darkening paired with living H-alpha chromospheric rim
        float limbDark = mix(0.46, 1.14, pow(max(ndv, 0.0001), 0.50));
        float chromoRim = pow(max(1.0 - ndv, 0.0001), 3.2);
        col = col * limbDark + mix(vec3(1.22, 0.74, 0.22), chromoRed, 0.44) * chromoRim * (1.18 + uBassEnergy * 0.34);

        gl_FragColor = vec4(col * 1.08, 1.0);
      }
    `
  });
}

/**
 * Creates the volumetric solar corona & erupting CME magnetic prominence arc material.
 */
export function createSolarCoronaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 },
      uSunLimbUv: { value: 13.0 / 44.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uSunLimbUv;
      varying vec2 vUv;

      ${GLSL_NOISE_2D}

      float prominenceLoop(float r, float angle, float limbR, float centerAngle, float halfWidth, float height, float phase) {
        float da = mod(angle - centerAngle + 3.14159265, 6.2831853) - 3.14159265;
        if (abs(da) >= halfWidth) return 0.0;

        float normDa = da / halfWidth;
        float archCurve = limbR + height * sqrt(max(0.0, 1.0 - normDa * normDa));
        float distToArch = abs(r - archCurve);
        float plasmaFlow = 0.74 + 0.26 * sin(normDa * 9.0 - uTime * 2.8 + phase);
        float arcRibbon = exp(-distToArch * 52.0) * plasmaFlow * 1.35;
        float arcCore = exp(-distToArch * 125.0) * plasmaFlow * 1.05;
        float innerVeil = smoothstep(archCurve + 0.025, limbR, r) * step(limbR - 0.005, r) * 0.32 * plasmaFlow;
        float endFade = smoothstep(1.0, 0.14, abs(normDa));
        return (arcRibbon + arcCore + innerVeil) * endFade;
      }

      // Dynamic erupting Coronal Mass Ejection (CME) prominence arc rising and expanding from the limb
      float eruptingCmeArc(float r, float angle, float limbR, float baseAngle, float speed, float phase) {
        float cycle = fract(uTime * speed + phase);
        float lift = pow(cycle, 0.85) * 0.32;
        float halfW = mix(0.14, 0.36, cycle);
        float archH = mix(0.06, 0.28, sin(cycle * 3.14159265));
        float centerA = baseAngle + sin(uTime * 0.25 + phase * 6.28) * 0.08;
        float da = mod(angle - centerA + 3.14159265, 6.2831853) - 3.14159265;
        if (abs(da) >= halfW) return 0.0;

        float normDa = da / halfW;
        float archR = limbR + lift * 0.55 + archH * sqrt(max(0.0, 1.0 - normDa * normDa));
        float dist = abs(r - archR);
        float shimmer = 0.72 + 0.28 * sin(normDa * 11.0 - uTime * 3.6 + phase * 10.0);
        float envelope = sin(cycle * 3.14159265) * smoothstep(1.0, 0.12, abs(normDa));
        return (exp(-dist * 42.0) * 1.15 + exp(-dist * 110.0) * 0.95) * shimmer * envelope;
      }

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float limbR = uSunLimbUv;
        if (r > 0.99 || r < limbR - 0.015) discard;

        float angle = atan(p.y, p.x);
        vec2 dir = vec2(cos(angle), sin(angle));
        float radialDist = max(r - limbR, 0.0);

        // Outward-streaming radial coronal solar wind filaments
        float rayNoise1 = fbm2(dir * 4.6 + vec2(r * 1.4 - uTime * 0.24, uTime * 0.11));
        float rayNoise2 = fbm2(dir * 11.2 - vec2(r * 2.8 + uTime * 0.32, -uTime * 0.16));
        float fineField = 0.70 + 0.30 * sin(angle * 24.0 + rayNoise1 * 5.5 - uTime * 0.45);
        float streamers = mix(0.28, 1.38, rayNoise1 * 0.58 + rayNoise2 * 0.42) * fineField;

        float innerCorona = exp(-radialDist * 22.0) * 0.72;
        float midCorona = exp(-radialDist * 5.4) * streamers * 0.48;
        float outerAura = exp(-radialDist * 2.4) * 0.24;

        // 7 active magnetic coronal loops + 3 erupting CME prominence arcs
        float loops = 0.0;
        loops += prominenceLoop(r, angle, limbR, 0.52 + sin(uTime * 0.18) * 0.08, 0.24, 0.165 + 0.025 * sin(uTime * 0.9), 0.0);
        loops += prominenceLoop(r, angle, limbR, 1.82 - cos(uTime * 0.14) * 0.06, 0.21, 0.140 + 0.022 * cos(uTime * 1.1), 1.4);
        loops += prominenceLoop(r, angle, limbR, -0.72 + sin(uTime * 0.20) * 0.07, 0.27, 0.198 + 0.028 * sin(uTime * 0.8 + 2.0), 2.7);
        loops += prominenceLoop(r, angle, limbR, -2.18 + cos(uTime * 0.16) * 0.08, 0.22, 0.155 + 0.022 * cos(uTime * 1.0), 4.1);
        loops += prominenceLoop(r, angle, limbR, 2.92 + sin(uTime * 0.12) * 0.05, 0.19, 0.128 + 0.018 * sin(uTime * 1.2), 5.3);
        loops += prominenceLoop(r, angle, limbR, -1.44 + sin(uTime * 0.18) * 0.05, 0.17, 0.118 + 0.018 * cos(uTime * 1.15), 3.6);
        loops += prominenceLoop(r, angle, limbR, 1.12 + cos(uTime * 0.22) * 0.06, 0.16, 0.110 + 0.016 * sin(uTime * 1.25), 2.1);

        float cme = 0.0;
        cme += eruptingCmeArc(r, angle, limbR, 0.88, 0.09, 0.12);
        cme += eruptingCmeArc(r, angle, limbR, -1.78, 0.075, 0.48);
        cme += eruptingCmeArc(r, angle, limbR, 2.45, 0.085, 0.81);
        loops += cme * 1.15;

        float edgeFade = smoothstep(0.99, 0.48, r) * smoothstep(limbR - 0.012, limbR + 0.008, r);
        float bassBoost = 1.0 + uBassEnergy * 0.30;

        vec3 whiteGold = vec3(1.20, 1.06, 0.78);
        vec3 fieryAmber = vec3(1.08, 0.52, 0.12);
        vec3 prominenceRose = vec3(1.18, 0.26, 0.09);
        vec3 surrealViolet = vec3(0.56, 0.18, 0.52);

        vec3 coronaCol = mix(whiteGold, fieryAmber, smoothstep(0.0, 0.18, radialDist));
        coronaCol = mix(coronaCol, surrealViolet, smoothstep(0.24, 0.60, radialDist) * 0.52);

        vec3 col = coronaCol * (innerCorona + midCorona + outerAura) * bassBoost;
        col += mix(prominenceRose, vec3(1.30, 0.90, 0.38), clamp(loops * 0.52, 0.0, 1.0)) * loops * 1.32 * bassBoost;

        float alpha = clamp(((innerCorona + midCorona + outerAura) * 0.76 + loops * 1.08) * edgeFade, 0.0, 1.0);
        if (alpha < 0.005) discard;

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
 * Creates a 3D animated magnetic coronal prominence loop material for curved
 * plasma tubes anchored directly into the solar photosphere.
 */
export function createSolarProminenceArcMaterial(phaseOffset = 0.0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uBassEnergy: { value: 0.0 },
      uPhase: { value: phaseOffset }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBassEnergy;
      uniform float uPhase;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      ${GLSL_NOISE_2D}

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float core = pow(max(abs(dot(N, V)), 0.001), 0.75);
        float arcEnv = sin(vUv.x * 3.14159265);
        float cycle = 0.55 + 0.45 * sin(uTime * 0.85 + uPhase * 6.2831853);
        float flow = fbm2(vec2(vUv.x * 6.0 - uTime * 1.45 + uPhase * 3.1, vUv.y * 2.5));
        float plasma = smoothstep(0.18, 0.86, flow) * (0.65 + 0.35 * sin(vUv.x * 18.0 - uTime * 3.4 + uPhase));

        vec3 crimson = vec3(1.15, 0.22, 0.06);
        vec3 amber = vec3(1.38, 0.68, 0.16);
        vec3 whiteHot = vec3(1.55, 1.28, 0.76);
        vec3 col = mix(crimson, amber, smoothstep(0.2, 0.7, plasma));
        col = mix(col, whiteHot, smoothstep(0.72, 0.98, plasma));

        float alpha = clamp(core * arcEnv * (0.28 + 0.92 * plasma) * cycle, 0.0, 0.95);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * (1.15 + uBassEnergy * 0.35), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Creates the ringed iridescent gas giant planet material featuring turbulent
 * atmospheric jet bands, an iridescent eye storm, twilight Fresnel scatter,
 * and sculptural crescent-to-gibbous illumination.
 */
export function createGasGiantMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSwirlSpeed: { value: 1.0 },
      uLightDir: { value: new THREE.Vector3(0.65, 0.30, -0.69).normalize() },
      uBassEnergy: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vLocalPos = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      uniform vec3 uLightDir;
      uniform float uBassEnergy;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      ${GLSL_NOISE_3D}

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        float t = uTime * 0.045 * uSwirlSpeed;
        // Counter-flowing zonal atmospheric jet bands warped by Kelvin-Helmholtz chevron eddies
        vec3 bandCoord = vec3(vLocalPos.x * 2.8 + t, vLocalPos.y * 7.2, vLocalPos.z * 2.8 - t * 0.65);
        float turb = fbm3(bandCoord * 1.6);
        float shearDir = sin(vLocalPos.y * 18.0) * 0.32 * t;
        float fineTurb = fbm3(vec3(vLocalPos.x * 6.5 + shearDir, vLocalPos.y * 14.0, vLocalPos.z * 6.5 - shearDir));
        float chevron = sin((vLocalPos.x * 12.0 + vLocalPos.z * 12.0) * 1.1 + sin(vLocalPos.y * 34.0) * 2.2) * 0.018;
        float lat = vLocalPos.y + (turb - 0.5) * 0.15 + (fineTurb - 0.5) * 0.055 + chevron;
        float jet = 0.5 + 0.5 * sin(lat * 28.0 + turb * 4.8);
        float fineJet = 0.5 + 0.5 * cos(lat * 64.0 - fineTurb * 6.5);
        float microStreaks = 0.5 + 0.5 * sin(lat * 116.0 + fineTurb * 8.0);

        // Iridescent Great Storm Eye + anticyclonic collar vortex on the sunlit hemisphere
        vec3 stormDir = normalize(vec3(0.35, -0.18, -0.92));
        float stormDist = length(vLocalPos - stormDir);
        float stormMask = smoothstep(0.34, 0.04, stormDist);
        float stormCollar = exp(-pow((stormDist - 0.24) * 14.0, 2.0));
        float stormSwirl = fbm3(vLocalPos * 13.0 + vec3(uTime * 0.16, 0.0, 0.0));

        vec3 deepIndigo = vec3(0.07, 0.11, 0.32);
        vec3 tealBand = vec3(0.08, 0.56, 0.64);
        vec3 pearlOpal = vec3(0.78, 0.90, 0.98);
        vec3 orchidViolet = vec3(0.54, 0.24, 0.72);
        vec3 amberWisp = vec3(0.94, 0.70, 0.44);

        vec3 albedo = mix(deepIndigo, tealBand, smoothstep(0.18, 0.78, jet));
        albedo = mix(albedo, pearlOpal, smoothstep(0.58, 0.94, fineJet * 0.65 + microStreaks * 0.35));
        albedo = mix(albedo, orchidViolet, smoothstep(0.34, 0.78, turb) * 0.58);
        albedo = mix(albedo, vec3(0.62, 0.86, 0.96), stormCollar * 0.42);
        albedo = mix(albedo, mix(amberWisp, vec3(0.96, 0.56, 0.88), stormSwirl), stormMask * 0.86);

        // Sculptural day-night terminator + atmospheric wrap + Mie forward-scatter rim lighting
        float ndl = dot(N, L);
        float diffuse = smoothstep(-0.16, 0.78, ndl);
        float termDist = (ndl + 0.02) * 6.2;
        float terminatorGlow = exp(-termDist * termDist);
        float ndv = max(dot(N, V), 0.0);
        float fresnel = pow(max(1.0 - ndv, 0.0001), 3.0);
        float backScatter = pow(max(dot(-V, L), 0.0), 3.0) * fresnel;

        vec3 dayLight = albedo * (0.14 + 1.08 * diffuse) * vec3(1.0, 0.96, 0.90);
        // Subtle bioluminescent night-side atmospheric shimmer
        vec3 nightGlow = mix(vec3(0.03, 0.05, 0.13), vec3(0.10, 0.38, 0.48), stormMask + turb * 0.25) * (1.0 - diffuse) * 0.56;
        vec3 atmosRim = mix(vec3(0.22, 0.88, 0.98), vec3(0.76, 0.38, 1.02), 0.45 + 0.35 * sin(lat * 8.0)) * fresnel * (0.72 + 0.65 * diffuse + uBassEnergy * 0.25);
        atmosRim += vec3(0.45, 0.92, 1.15) * backScatter * 0.65;
        vec3 twilight = vec3(0.98, 0.52, 0.34) * terminatorGlow * 0.26;

        gl_FragColor = vec4(dayLight + nightGlow + atmosRim + twilight, 1.0);
      }
    `
  });
}

/**
 * Creates the translucent iridescent planetary ring material with Cassini-style
 * divisions, fine ice ringlets, diffraction shimmer, and planetary shadow casting.
 */
export function createPlanetaryRingMaterial(
  innerRadius: number,
  outerRadius: number,
  planetRadius: number,
  planetCenter: THREE.Vector3
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uPlanetRadius: { value: planetRadius },
      uPlanetCenter: { value: planetCenter.clone() },
      uLightDir: { value: new THREE.Vector3(0.65, 0.30, -0.69).normalize() }
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      void main() {
        vLocalPos = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      uniform float uPlanetRadius;
      uniform vec3 uPlanetCenter;
      uniform vec3 uLightDir;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;

      void main() {
        float r = length(vLocalPos.xy);
        float t = clamp((r - uInnerRadius) / max(uOuterRadius - uInnerRadius, 0.01), 0.0, 1.0);

        float edgeFade = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.91, t);
        // Razor-sharp Cassini, Encke & Maxwell radial ring divisions + bright B-ring shoulder
        float dCassini = (t - 0.58) * 50.0;
        float dEncke = (t - 0.84) * 68.0;
        float dMaxwell = (t - 0.31) * 58.0;
        float cassiniGap = 1.0 - 0.97 * exp(-dCassini * dCassini);
        float enckeGap = 1.0 - 0.88 * exp(-dEncke * dEncke);
        float maxwellGap = 1.0 - 0.74 * exp(-dMaxwell * dMaxwell);
        float bRingEdgeBoost = exp(-pow((t - 0.52) * 26.0, 2.0)) * 0.35;

        float ringlets = 0.52 + 0.18 * sin(t * 86.0) + 0.14 * cos(t * 168.0 + 1.2) + 0.10 * sin(t * 260.0) + bRingEdgeBoost;
        float angle = atan(vLocalPos.y, vLocalPos.x);
        float shimmer = 0.86 + 0.14 * sin(angle * 4.0 + uTime * 0.45 + t * 12.0);

        // Ray-sphere shadow cast by the planet onto the back side of the rings
        vec3 rel = vWorldPos - uPlanetCenter;
        vec3 L = normalize(uLightDir);
        float proj = dot(rel, L);
        float shadowFactor = 1.0;
        if (proj < 0.0) {
          float perpDist = length(rel - L * proj);
          shadowFactor = smoothstep(uPlanetRadius * 0.96, uPlanetRadius * 1.06, perpDist);
        }

        // Mother-of-pearl iridescent ring palette
        vec3 opalCyan = vec3(0.42, 0.86, 0.98);
        vec3 pearlGold = vec3(0.98, 0.86, 0.66);
        vec3 roseViolet = vec3(0.76, 0.44, 0.88);
        vec3 emeraldMint = vec3(0.28, 0.84, 0.68);

        vec3 ringCol = mix(opalCyan, pearlGold, smoothstep(0.15, 0.52, t));
        ringCol = mix(ringCol, roseViolet, smoothstep(0.55, 0.85, t));
        ringCol = mix(ringCol, emeraldMint, 0.25 * (0.5 + 0.5 * sin(t * 24.0 + angle * 2.0)));

        float density = edgeFade * cassiniGap * enckeGap * maxwellGap * ringlets;
        vec3 litCol = ringCol * shimmer * mix(0.10, 1.12, shadowFactor);
        float alpha = clamp(density * 0.82, 0.0, 0.88);
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(litCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Creates the icy cratered aurora moon material with polar aurora illumination.
 */
export function createAuroraMoonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uLightDir: { value: new THREE.Vector3(0.65, 0.30, -0.69).normalize() }
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vLocalPos = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLightDir;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      ${GLSL_NOISE_3D}

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uLightDir);

        float rock = fbm3(vLocalPos * 6.5);
        float craters = smoothstep(0.32, 0.72, noise3(vLocalPos * 14.0));
        float crystalVeins = exp(-abs(noise3(vLocalPos * 9.0) - 0.5) * 18.0);

        vec3 icySlate = vec3(0.24, 0.30, 0.44);
        vec3 frostSilver = vec3(0.78, 0.86, 0.96);
        vec3 albedo = mix(icySlate, frostSilver, rock * 0.75 + craters * 0.25);

        float ndl = smoothstep(-0.12, 0.80, dot(N, L));
        float polarMask = smoothstep(0.45, 0.88, abs(vLocalPos.y));
        float auroraPulse = 0.65 + 0.35 * sin(uTime * 1.4 + vLocalPos.x * 5.0 + vLocalPos.z * 5.0);
        vec3 auroraTint = mix(vec3(0.10, 0.92, 0.65), vec3(0.62, 0.32, 0.98), 0.5 + 0.5 * sin(vLocalPos.x * 4.0));

        float fresnel = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 2.8);
        vec3 col = albedo * (0.14 + 0.95 * ndl);
        col += vec3(0.28, 0.85, 0.92) * crystalVeins * 0.28;
        col += auroraTint * (polarMask * 0.48 + fresnel * 0.55) * auroraPulse;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

/**
 * Creates the shimmering additive aurora borealis corona shell wrapping the moon.
 */
export function createAuroraShellMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSwirlSpeed: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vLocalPos = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      ${GLSL_NOISE_3D}

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = abs(dot(N, V));
        // Fade smoothly to zero before outer shell silhouette (ndv = 0), peaking near moon limb (ndv ~ 0.53)
        float outerSoftFade = smoothstep(0.08, 0.54, ndv);
        float rim = outerSoftFade * pow(max(1.0 - ndv * 0.75, 0.0001), 1.4);

        float t = uTime * 0.35 * uSwirlSpeed;
        float ribbon = fbm3(vec3(vLocalPos.x * 4.5 + t, vLocalPos.y * 2.6, vLocalPos.z * 4.5 - t));
        float waves = 0.55 + 0.45 * sin(vLocalPos.x * 8.0 + vLocalPos.z * 8.0 + ribbon * 5.0 - t * 2.0);
        float curtain = smoothstep(0.28, 0.76, ribbon) * waves * (0.42 + 0.58 * smoothstep(0.18, 0.85, abs(vLocalPos.y)));

        vec3 emerald = vec3(0.08, 0.96, 0.66);
        vec3 violet = vec3(0.68, 0.28, 1.0);
        vec3 col = mix(emerald, violet, smoothstep(0.35, 0.75, ribbon));

        float alpha = clamp(rim * (0.28 + curtain * 1.15), 0.0, 0.85);
        if (alpha < 0.008) discard;

        gl_FragColor = vec4(col * 1.18, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide
  });
}

/**
 * Creates a fog-aware glowing orbital stardust ribbon ring material.
 */
export function createStardustRibbonMaterial(colorHex: string): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSwirlSpeed: { value: 1.0 },
    uColor: { value: new THREE.Color(colorHex) }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
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
      uniform float uSwirlSpeed;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float core = 0.45 + 0.55 * pow(max(abs(dot(N, V)), 0.0001), 0.7);
        float pulseA = 0.55 + 0.45 * sin(vUv.x * 18.84955 - uTime * 0.9 * uSwirlSpeed);
        float pulseB = 0.65 + 0.35 * cos(vUv.x * 43.98229 + uTime * 0.55 * uSwirlSpeed);
        float alpha = clamp(core * pulseA * pulseB * 0.30, 0.0, 0.62);
        gl_FragColor = vec4(uColor * (0.85 + 0.45 * pulseA), alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true
  });
}

/**
 * Creates a fog-aware orbital stardust particle shader whose particles revolve
 * smoothly around the sanctuary in the vertex shader with zero CPU updates.
 */
export function createOrbitalMotesMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSwirlSpeed: { value: 1.0 },
    uBassEnergy: { value: 0.0 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uSwirlSpeed;
      uniform float uBassEnergy;
      attribute float aOrbitSpeed;
      attribute float aPhase;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vColor = aColor;
        float theta = uTime * aOrbitSpeed * uSwirlSpeed;
        float c = cos(theta);
        float s = sin(theta);
        vec3 rotated = vec3(
          position.x * c - position.z * s,
          position.y + 0.38 * sin(uTime * 0.85 + aPhase),
          position.x * s + position.z * c
        );

        vTwinkle = (0.52 + 0.48 * sin(uTime * 2.2 + aPhase)) * (1.0 + uBassEnergy * 0.28);
        vec4 worldPos = modelMatrix * vec4(rotated, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((36.0 / max(-mvPosition.z, 1.0)) * (1.2 + vTwinkle), 1.8, 6.4);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float core = pow(smoothstep(0.5, 0.02, d), 1.6);
        gl_FragColor = vec4(vColor * 1.32, core * vTwinkle);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true
  });
}

/**
 * Creates a GPU-animated shooting meteor streak material.
 * Each meteor ribbon stretches along its instantaneous velocity vector, faces the camera,
 * and cycles cleanly across the celestial vault with an incandescent head and ionized tail.
 */
export function createShootingMeteorsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSwirlSpeed: { value: 1.0 }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSwirlSpeed;
      attribute vec3 aOrigin;
      attribute vec3 aVelocity;
      attribute vec4 aTiming; // x: phase, y: period, z: activeFrac, w: lengthScale
      attribute vec3 aColor;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vLifeAlpha;

      void main() {
        vUv = uv;
        vColor = aColor;

        float phase = aTiming.x;
        float period = max(aTiming.y, 1.0);
        float activeFrac = clamp(aTiming.z, 0.05, 0.95);
        float lenScale = aTiming.w;

        float cycle = fract((uTime * (0.65 + 0.35 * uSwirlSpeed) + phase) / period);
        if (cycle > activeFrac) {
          vLifeAlpha = 0.0;
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }

        float normT = cycle / activeFrac;
        float travelT = normT * period * activeFrac;
        vLifeAlpha = sin(normT * 3.14159265);

        vec3 headPos = aOrigin + aVelocity * travelT + vec3(0.0, -1.8 * travelT * travelT, 0.0);
        vec3 instVel = aVelocity + vec3(0.0, -3.6 * travelT, 0.0);
        float vLen = length(instVel);
        vec3 fwd = vLen > 1e-4 ? instVel / vLen : vec3(1.0, 0.0, 0.0);

        vec3 toCam = normalize(cameraPosition - headPos);
        vec3 side = cross(fwd, toCam);
        float sLen = length(side);
        side = sLen > 1e-4 ? side / sLen : vec3(0.0, 1.0, 0.0);

        float tailLength = (14.0 + 18.0 * lenScale) * (0.35 + 0.65 * vLifeAlpha);
        float halfWidth = 0.24 + 0.18 * lenScale;
        // uv.x = 0 at tail end, 1 at bright meteor head; uv.y in [0, 1] across width
        vec3 worldPos = headPos - fwd * ((1.0 - uv.x) * tailLength) + side * ((uv.y - 0.5) * 2.0 * halfWidth);

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vLifeAlpha;

      void main() {
        if (vLifeAlpha <= 0.005) discard;
        float crossDist = abs(vUv.y - 0.5) * 2.0;
        float coreProfile = exp(-crossDist * crossDist * 5.2);
        float tailGrad = pow(clamp(vUv.x, 0.0, 1.0), 1.65);
        float headFlare = exp(-pow((1.0 - vUv.x) * 14.0, 2.0)) * 1.85;

        vec3 col = mix(vColor, vec3(1.15, 1.20, 1.35), clamp(headFlare * 0.75 + pow(vUv.x, 4.0) * 0.6, 0.0, 1.0));
        float alpha = clamp((tailGrad + headFlare) * coreProfile * vLifeAlpha, 0.0, 1.0);
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(col * (1.25 + headFlare), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Creates the AAA PBR basalt obsidian canyon & mirror salt-flat terrain material
 * featuring 512x512 cracked basalt normal/roughness/albedo maps, liquid-obsidian
 * mirror flats, capillary ripple perturbation, and crisp specular/Fresnel reflections
 * of the warped Gargantua Black Hole, living Solar Plasma, Ringed Gas Giant & Nebula.
 */
export function createObsidianTerrainMaterial(pbrSet?: BasaltPbrTextureSet): THREE.ShaderMaterial {
  const custom: Record<string, THREE.IUniform> = {
    uTime: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3(88, 62, -175).normalize() },
    uBlackHoleDirection: { value: new THREE.Vector3(-52, 54, -162).normalize() },
    uPlanetDirection: { value: new THREE.Vector3(-58, 56, 194).normalize() },
    uBassEnergy: { value: 0.0 }
  };
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);
  // Attach DataTextures AFTER UniformsUtils.merge so Texture references stay identical to renderer.initTexture()
  if (pbrSet) {
    uniforms.uBasaltMap = { value: pbrSet.map };
    uniforms.uBasaltNormalMap = { value: pbrSet.normalMap };
    uniforms.uBasaltRoughnessMap = { value: pbrSet.roughnessMap };
  }

  return new THREE.ShaderMaterial({
    uniforms,
    defines: pbrSet ? { USE_BASALT_PBR: 1 } : undefined,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
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
      uniform vec3 uBlackHoleDirection;
      uniform vec3 uPlanetDirection;
      uniform float uBassEnergy;
      #ifdef USE_BASALT_PBR
      uniform sampler2D uBasaltMap;
      uniform sampler2D uBasaltNormalMap;
      uniform sampler2D uBasaltRoughnessMap;
      #endif
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      ${GLSL_NOISE_2D}

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec2 p = vWorldPosition.xz;
        float dist = length(p);
        float camDist = length(vWorldPosition - cameraPosition);
        float nearDetail = 1.0 - smoothstep(28.0, 96.0, camDist);

        // Winding Lava-Lit Obsidian Mirror River meandering across the valley floor toward Gargantua
        float riverCenterX = sin(p.y * 0.042 - 0.35) * 14.5 + cos(p.y * 0.019 + 0.8) * 7.5 - 6.0;
        float distToRiver = abs(p.x - riverCenterX);
        float riverWidth = 5.8 + 2.4 * sin(p.y * 0.075 + 1.2);
        float riverMask = (1.0 - smoothstep(riverWidth * 0.58, riverWidth, distToRiver)) * smoothstep(2.0, 14.0, dist);
        float riverBankGlow = exp(-pow((distToRiver - riverWidth * 0.78) * 0.75, 2.0)) * smoothstep(2.0, 14.0, dist);

        // Dark cosmic mirror lake basin & tide-pools in foreground/midground + wind-rippled obsidian sand dunes
        float flatBlend = smoothstep(16.0, 56.0, dist);
        float slopeSteep = clamp(1.0 - baseN.y, 0.0, 1.0);
        float puddleFbm = fbm2(p * 0.090 + vec2(3.1, -1.7)) * 0.72 + fbm2(p * 0.24 - vec2(1.9, 4.2)) * 0.28;
        float poolCore = smoothstep(0.44, 0.52, puddleFbm) * (1.0 - smoothstep(0.05, 0.18, slopeSteep)) * (1.0 - smoothstep(48.0, 120.0, dist) * 0.45);
        float wetPoolMask = clamp(max(poolCore + (1.0 - flatBlend) * 0.72, riverMask), 0.0, 1.0);
        float wetCollar = smoothstep(0.39, 0.46, puddleFbm) * (1.0 - wetPoolMask) * (1.0 - slopeSteep);
        float duneWeight = clamp((1.0 - wetPoolMask) * (0.46 + 0.54 * flatBlend + slopeSteep * 0.9), 0.04, 1.0);

        // Asymmetric aeolian wind-rippled black volcanic obsidian sand dunes
        float windWarp = fbm2(p * 0.065 + vec2(1.4, -2.8)) * 3.8;
        float pMacro = p.x * 0.44 + p.y * 0.25 + windWarp;
        float pMed = p.x * 1.95 + p.y * 1.12 + windWarp * 1.6;
        float pFine = p.x * 7.8 + p.y * 4.4 + fbm2(p * 0.45) * 3.6;

        float duneWaveA = sin(pMacro + 0.36 * sin(pMacro));
        float duneSlopeA = cos(pMacro + 0.36 * sin(pMacro)) * (1.0 + 0.36 * cos(pMacro));
        float duneSlopeB = cos(pMed + 0.40 * sin(pMed)) * (1.0 + 0.40 * cos(pMed));
        float duneFineRipple = sin(pFine + 0.42 * sin(pFine));
        float duneSlopeFine = cos(pFine + 0.42 * sin(pFine)) * (1.0 + 0.42 * cos(pFine));
        float duneSlope = (duneSlopeA * 0.34 + duneSlopeB * 0.24 + duneSlopeFine * 0.18 * nearDetail) * duneWeight;
        float obsidianSparkle = pow(max(noise2(p * 18.0 + vec2(uTime * 0.02)), 0.0001), 14.0) * duneWeight * nearDetail;

        // Fine natural branching cooling cracks
        vec2 cWarp = vec2(fbm2(p * 0.075), fbm2(p * 0.075 + vec2(7.3, 4.1))) * 3.4;
        float crackA = 1.0 - abs(noise2(p * 0.18 + cWarp) * 2.0 - 1.0);
        float crackB = 1.0 - abs(noise2(p * 0.52 - cWarp * 0.8) * 2.0 - 1.0);
        float naturalCoolingCrack = clamp(pow(clamp(crackA, 0.0, 1.0), 14.0) * 0.8 + pow(clamp(crackB, 0.0, 1.0), 18.0) * 0.45, 0.0, 1.0) * (1.0 - wetPoolMask * 0.85);

        vec3 basaltAlbedo = vec3(0.012, 0.014, 0.024);
        float roughness = mix(0.016, 0.64, duneWeight);
        vec3 pbrNormalOffset = vec3(duneSlope * 0.34, 0.0, duneSlope * 0.19);

        #ifdef USE_BASALT_PBR
        vec2 pbrUv = p * 0.042 + cWarp * 0.035;
        vec2 pbrUvMacro = p * 0.015 + vec2(0.37, 0.19);
        vec3 texAlbedo = mix(texture2D(uBasaltMap, pbrUv).rgb, texture2D(uBasaltMap, pbrUvMacro).rgb, 0.48);
        vec3 texN = texture2D(uBasaltNormalMap, pbrUv).xyz * 2.0 - 1.0;
        float texR = mix(texture2D(uBasaltRoughnessMap, pbrUv).r, texture2D(uBasaltRoughnessMap, pbrUvMacro).r, 0.45);

        vec3 volcanicSandTint = mix(vec3(0.014, 0.015, 0.024), vec3(0.042, 0.040, 0.056), 0.5 + 0.5 * duneWaveA) * (0.84 + 0.16 * duneFineRipple * nearDetail);
        basaltAlbedo = mix(vec3(0.0012, 0.0016, 0.0035), mix(texAlbedo * 0.22, volcanicSandTint, 0.62), duneWeight);
        basaltAlbedo *= mix(1.0, 0.52, wetCollar);
        float baseRough = mix(0.025 + texR * 0.07, clamp(0.46 + texR * 0.44, 0.32, 0.90), duneWeight);
        baseRough = mix(baseRough, 0.14, wetCollar);
        roughness = mix(baseRough, 0.010 + texR * 0.014, wetPoolMask);
        float nStrength = mix(0.015, 0.44, duneWeight) * (0.28 + 0.72 * nearDetail);
        pbrNormalOffset += vec3(texN.x * nStrength, 0.0, texN.y * nStrength);
        #endif

        // Delicate high-frequency liquid-obsidian capillary micro-ripples across dark cosmic lake & river
        float rippleFade = wetPoolMask * (0.35 + 0.65 * nearDetail);
        float r1 = sin(p.x * 3.1 + p.y * 1.9 - uTime * 1.35);
        float r2 = cos(p.x * 2.4 - p.y * 3.7 + uTime * 1.05);
        float r3 = sin(p.x * 6.8 + p.y * 5.2 - uTime * 1.85) * 0.55;
        float r4 = sin(dist * 1.65 - uTime * 1.45) * exp(-dist * 0.022) * 0.65;
        float micro = (noise2(p * 4.8 + vec2(uTime * 0.18, -uTime * 0.14)) - 0.5) * 2.0;

        vec3 rippleOffset = vec3(
          (r1 * 0.0042 + r2 * 0.0034 + r3 * 0.0024 + micro * 0.0032) * rippleFade,
          0.0,
          (r2 * 0.0042 - r4 * 0.0048 + r3 * 0.0024 + micro * 0.0032) * rippleFade
        );
        vec3 N = normalize(baseN + pbrNormalOffset + rippleOffset);
        vec3 R = reflect(-V, N);
        R.y = max(R.y, 0.004);
        R = normalize(R);

        float ndv = max(dot(N, V), 0.0);
        float fresnel = mix(0.02, 0.08, wetPoolMask) + mix(0.45, 0.96, wetPoolMask) * pow(max(1.0 - ndv, 0.0001), mix(4.0, 2.5, wetPoolMask));
        float mirrorGloss = clamp(1.0 - roughness, 0.10, 0.99);
        float specTightness = mix(40.0, 760.0, mirrorGloss * mirrorGloss);

        // Diffuse cosmic fill on wind-rippled volcanic sand dunes & basalt outcrops
        vec3 sunDir = normalize(uSunDirection);
        vec3 bhDir = normalize(uBlackHoleDirection);
        vec3 plDir = normalize(uPlanetDirection);
        float sunDiff = max(dot(N, sunDir), 0.0);
        float bhDiff = max(dot(N, bhDir), 0.0);
        float plDiff = max(dot(N, plDir), 0.0);
        vec3 cliffLit = basaltAlbedo * (
          0.16 +
          sunDiff * vec3(1.05, 0.68, 0.34) * 0.64 +
          bhDiff * vec3(0.68, 0.36, 0.98) * 0.56 +
          plDiff * vec3(0.24, 0.72, 0.92) * 0.42
        );
        cliffLit += vec3(0.95, 0.78, 0.55) * obsidianSparkle * (0.28 + 0.72 * sunDiff);
        cliffLit *= 1.0 - naturalCoolingCrack * 0.55;

        // 1. Crisp Mirrored Living Solar Plasma (churning granulation disc + erupting coronal/CME prominence arcs)
        vec3 sunReflUp = normalize(vec3(0.0, 1.0, 0.0) - sunDir * sunDir.y);
        vec3 sunReflRight = normalize(cross(sunDir, sunReflUp));
        vec3 sunDelta = R - sunDir * dot(R, sunDir);
        float sunCos = max(dot(R, sunDir), 0.0001);
        float sunAngle = acos(clamp(sunCos, -1.0, 1.0));
        vec2 sunLocal2D = vec2(dot(sunDelta, sunReflRight), dot(sunDelta, sunReflUp));
        float sunGranA = noise2(sunLocal2D * 46.0 + vec2(uTime * 0.35, -uTime * 0.28));
        float sunGranB = noise2(sunLocal2D * 92.0 - vec2(uTime * 0.48, uTime * 0.31));
        float sunGran = 0.76 + 0.38 * (sunGranA * 0.6 + sunGranB * 0.4);
        float sunDisc = smoothstep(0.112, 0.088, sunAngle) * sunGran * (0.78 + 1.15 * mirrorGloss);

        // Reflected Solar Magnetic Prominence Loops & erupting CME arcs
        float sunLimbAng = atan(sunLocal2D.y, sunLocal2D.x);
        float promArch = pow(max(0.0, sin(sunLimbAng * 5.0 + uTime * 0.55)), 2.2) +
                         0.65 * pow(max(0.0, cos(sunLimbAng * 3.0 - uTime * 0.42)), 3.0);
        float promShell = exp(-pow((sunAngle - (0.106 + promArch * 0.032)) * mix(48.0, 118.0, mirrorGloss), 2.0)) * smoothstep(0.085, 0.105, sunAngle);
        float sunCore = pow(sunCos, specTightness);
        float sunGlitter = pow(sunCos, mix(46.0, 145.0, mirrorGloss));
        vec3 sunRefl = vec3(1.65, 1.24, 0.68) * (sunCore + sunDisc * 1.08) * (0.85 + 1.25 * mirrorGloss) +
                       vec3(1.75, 0.56, 0.14) * promShell * (0.65 + 1.35 * mirrorGloss) +
                       vec3(1.18, 0.50, 0.12) * sunGlitter * 0.34;

        // 2. Crisp Mirrored Warped Gargantua Black Hole (pure black core + razor photon ring + upper/lower warped Einstein arches + Doppler disk)
        vec3 bhReflUp = normalize(vec3(0.0, 1.0, 0.0) - bhDir * bhDir.y);
        vec3 bhReflRight = normalize(cross(bhDir, bhReflUp));
        float bx = dot(R, bhReflRight);
        float by = dot(R, bhReflUp);
        float bhR = length(vec2(bx, by));
        float bhCos = max(dot(R, bhDir), 0.0001);
        float bhAngle = acos(clamp(bhCos, -1.0, 1.0));

        // Pure #000000 event horizon shadow core (masks sky/background behind it)
        float bhShadowMask = smoothstep(0.082, 0.094, bhR);
        // Razor-bright thin Einstein Photon Ring right outside shadow edge
        float bhRingD = (bhR - 0.095) * mix(65.0, 210.0, mirrorGloss);
        float bhPhotonRing = exp(-bhRingD * bhRingD);

        // Warped secondary image of back accretion disk arching smoothly OVER top and UNDER bottom of shadow
        float archUpper = exp(-pow((bhR - (0.118 + 0.022 * smoothstep(0.0, 0.11, by))) * mix(34.0, 108.0, mirrorGloss), 2.0)) * smoothstep(-0.015, 0.045, by);
        float archLower = exp(-pow((bhR - (0.114 + 0.018 * smoothstep(0.0, 0.11, -by))) * mix(38.0, 112.0, mirrorGloss), 2.0)) * smoothstep(0.015, -0.045, by);

        // Tilted front equatorial accretion disk sweeping across the front of the black hole
        float tiltY = by * 0.94 - bx * 0.34;
        float tiltX = bx * 0.94 + by * 0.34;
        float diskBand = exp(-pow(tiltY * mix(38.0, 118.0, mirrorGloss), 2.0)) * smoothstep(0.36, 0.10, abs(tiltX)) * smoothstep(0.070, 0.105, bhR);
        // Front disk partially crosses IN FRONT of the lower edge of the shadow
        float frontDiskOverlay = exp(-pow((tiltY + 0.016) * mix(42.0, 130.0, mirrorGloss), 2.0)) * smoothstep(0.18, 0.04, abs(tiltX));

        float bhSwirl = 0.72 + 0.28 * sin(abs(tiltX) * 58.0 - uTime * 2.2);
        // Relativistic Doppler beaming: approaching left side incandescent blue-white, receding right side deep amber-crimson
        float bhApproach = clamp(-bx / max(bhR, 0.02), -1.0, 1.0);
        float bhDoppler = clamp(1.0 / (0.88 * (1.0 - 0.45 * bhApproach)), 0.36, 2.35);

        vec3 bhCoolBlue = vec3(0.88, 0.98, 1.38);
        vec3 bhGold = vec3(1.18, 0.88, 0.52);
        vec3 bhAmberCrimson = vec3(0.92, 0.24, 0.06);
        vec3 bhTint = mix(bhGold, bhCoolBlue, smoothstep(0.05, 0.85, bhApproach));
        bhTint = mix(bhTint, bhAmberCrimson, smoothstep(0.05, 0.85, -bhApproach));

        vec3 bhEmissions = bhTint * (bhPhotonRing * (1.25 + 1.65 * mirrorGloss) +
                                     (archUpper * 0.95 + archLower * 0.78) * (0.75 + 1.05 * mirrorGloss) +
                                     (diskBand + frontDiskOverlay * 0.65) * bhSwirl * (0.85 + 1.10 * mirrorGloss)) * bhDoppler;

        // 3. Reflected Ringed Iridescent Gas Giant (+Z hemisphere)
        float plCos = max(dot(R, plDir), 0.0001);
        float plGlow = pow(plCos, mix(28.0, 88.0, mirrorGloss));
        vec3 plRefl = vec3(0.24, 0.84, 0.98) * plGlow * (0.52 + 0.72 * mirrorGloss);

        // Subtle deep cosmic nebula & twinkling liquid starlight glints
        float nebReflNoise = noise2(R.xz * 4.5 + vec2(uTime * 0.02));
        vec3 nebRefl = mix(vec3(0.004, 0.002, 0.014), vec3(0.002, 0.012, 0.020), nebReflNoise) * (0.30 + 0.65 * fresnel);
        float starGlint = pow(max(noise2(R.xz * 58.0 + vec2(uTime * 0.15)), 0.0001), 24.0) * mirrorGloss;

        // Magmatic amber-crimson fissures in outer volcanic cooling cracks & lava-lit obsidian riverbanks
        float magmaPulse = 0.78 + 0.22 * sin(uTime * 1.4 + p.x * 0.18 + p.y * 0.14);
        float outerMagmaZone = smoothstep(28.0, 75.0, dist);
        vec3 magmaGlow = mix(vec3(0.85, 0.12, 0.02), vec3(1.42, 0.54, 0.08), crackA) *
                         (naturalCoolingCrack * outerMagmaZone * 0.95 + riverBankGlow * 0.68) * magmaPulse * (1.0 + uBassEnergy * 0.24);

        // Flowing ember veins along the winding obsidian river surface
        float riverCurrent = sin(p.y * 0.55 - uTime * 1.1 + fbm2(p * 0.18) * 4.0) * 0.5 + 0.5;
        vec3 riverEmber = vec3(0.95, 0.34, 0.05) * riverMask * pow(riverCurrent, 6.0) * 0.28;

        // Delicate concentric gravitational wave hairlines near center
        float ringDistA = abs(mod(dist - uTime * 0.55 + 7.5, 15.0) - 7.5);
        float ringDistB = abs(mod(dist + uTime * 0.35 + 4.5, 9.0) - 4.5);
        float sanctuaryRingA = exp(-ringDistA * ringDistA * 22.0);
        float sanctuaryRingB = exp(-ringDistB * ringDistB * 38.0);
        float ringFade = exp(-dist * 0.032) * smoothstep(2.0, 6.0, dist);
        vec3 veins = (vec3(0.22, 0.68, 0.92) * sanctuaryRingA + vec3(0.68, 0.38, 0.92) * sanctuaryRingB * 0.65) * ringFade * (0.14 + uBassEnergy * 0.14);

        vec3 skyAndSunRefl = (sunRefl + plRefl + nebRefl + vec3(0.92, 0.96, 1.05) * starGlint * 1.45) * mix(0.02, 1.0, bhShadowMask);
        vec3 reflections = (skyAndSunRefl + bhEmissions) * fresnel * (0.30 + 0.98 * mirrorGloss);
        reflections *= 1.0 + max(riverMask * 0.48, wetPoolMask * 0.24);

        vec3 col = cliffLit + reflections + veins + magmaGlow + riverEmber;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true
  });
}

/**
 * Creates a fog-aware translucent iridescent crystalline monolith material
 * with multi-celestial specular highlights, sky reflections, and glowing edges.
 */
export function createCrystalMonolithMaterial(): THREE.ShaderMaterial {
  const custom = {
    uTime: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3(48, 34, -95).normalize() },
    uBlackHoleDirection: { value: new THREE.Vector3(-28, 30, -88).normalize() },
    uPlanetDirection: { value: new THREE.Vector3(-32, 31, 106).normalize() },
    uBassEnergy: { value: 0.0 }
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
        vWorldNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);
        #else
        vec4 worldPos = modelMatrix * localPos;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        #endif

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
      uniform vec3 uBlackHoleDirection;
      uniform vec3 uPlanetDirection;
      uniform float uBassEnergy;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vLocalY;
      #ifdef USE_INSTANCING_COLOR
      varying vec3 vInstanceColor;
      #endif

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 R = reflect(-V, N);

        #ifdef USE_INSTANCING_COLOR
        vec3 tint = vInstanceColor;
        #else
        vec3 tint = vec3(0.45, 0.80, 1.0);
        #endif

        float ndv = max(dot(N, V), 0.0);
        float fresnel = pow(max(1.0 - ndv, 0.0001), 2.3);

        // Multi-celestial metallic facet speculars
        vec3 sunH = normalize(normalize(uSunDirection) + V);
        vec3 bhH = normalize(normalize(uBlackHoleDirection) + V);
        vec3 plH = normalize(normalize(uPlanetDirection) + V);

        float sunSpec = pow(max(dot(N, sunH), 0.0001), 42.0);
        float bhSpec = pow(max(dot(N, bhH), 0.0001), 32.0);
        float plSpec = pow(max(dot(N, plH), 0.0001), 32.0);

        float sunDiff = max(dot(N, normalize(uSunDirection)), 0.0);
        float bhDiff = max(dot(N, normalize(uBlackHoleDirection)), 0.0);
        float plDiff = max(dot(N, normalize(uPlanetDirection)), 0.0);

        // Subtle sky-dome reflection & deep cosmic crystal core gradient
        vec3 skyEnv = mix(vec3(0.03, 0.02, 0.10), vec3(0.08, 0.20, 0.36), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
        float pulse = 0.82 + 0.18 * sin(uTime * 1.4 + vWorldPos.x * 0.25 + vWorldPos.z * 0.25);
        float tipGlow = smoothstep(-0.8, 1.8, vLocalY);

        vec3 coreColor = tint * (0.12 + 0.22 * tipGlow) * pulse;
        coreColor += tint * (sunDiff * 0.28 + bhDiff * 0.22 + plDiff * 0.20);
        coreColor += skyEnv * (0.18 + 0.45 * fresnel);
        coreColor += mix(tint, vec3(0.88, 0.96, 1.0), 0.45) * fresnel * (0.85 + uBassEnergy * 0.30);
        coreColor += vec3(1.15, 0.92, 0.52) * sunSpec * 1.45;
        coreColor += vec3(0.76, 0.44, 1.08) * bhSpec * 1.25;
        coreColor += vec3(0.32, 0.90, 0.98) * plSpec * 1.15;

        float alpha = clamp(0.68 + 0.30 * fresnel + 0.12 * tipGlow, 0.0, 0.96);
        gl_FragColor = vec4(coreColor, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: true,
    fog: true
  });
}
