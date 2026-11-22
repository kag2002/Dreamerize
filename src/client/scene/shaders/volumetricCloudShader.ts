import * as THREE from 'three';

export interface VolumetricCloudDomeOptions {
  radius?: number;
  baseY?: number;
  topY?: number;
  coverage?: number;
  tint?: THREE.ColorRepresentation;
  sunDirection?: THREE.Vector3;
  ghibliToon?: boolean;
  speed?: number;
}

export interface VolumetricCloudDomeHandle {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  update: (
    time: number,
    sunDir?: THREE.Vector3,
    fogColor?: THREE.Color,
    coverage?: number
  ) => void;
  dispose: () => void;
}

export interface CloudShadowSampleOptions {
  coverage?: number;
  speed?: number;
}

const DEFAULT_WIND_DIR_X = 0.8516;
const DEFAULT_WIND_DIR_Z = 0.5241;
const MACRO_CLOUD_SCALE = 0.0075;
const MACRO_DRIFT_RATE = 0.028;

/**
 * Reusable GLSL chunk providing `sampleCloudShadowAtXZ` so terrain, grass, and water
 * shaders can match the moving overhead volumetric cloud layer.
 */
export const CLOUD_SHADOW_GLSL = /* glsl */ `
float _vcHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float _vcNoise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(_vcHash21(i), _vcHash21(i + vec2(1.0, 0.0)), u.x),
    mix(_vcHash21(i + vec2(0.0, 1.0)), _vcHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float _vcFbm2D(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * _vcNoise2D(p);
    p = p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

/**
 * Returns a sunlit factor in [0.32, 1.0] where lower values represent softer cloud
 * shadows drifting across the ground plane at (x, z).
 */
float sampleCloudShadowAtXZ(float x, float z, float time, float coverage, float speed) {
  vec2 wind = vec2(${DEFAULT_WIND_DIR_X}, ${DEFAULT_WIND_DIR_Z});
  vec2 uv = vec2(x, z) * ${MACRO_CLOUD_SCALE} - wind * (time * ${MACRO_DRIFT_RATE} * speed);
  float n = _vcFbm2D(uv);
  float threshold = 1.0 - clamp(coverage, 0.0, 1.0) * 0.85;
  float shadowMask = smoothstep(threshold - 0.12, threshold + 0.28, n);
  return mix(1.0, 0.34, shadowMask);
}

float sampleCloudShadowAtXZ(float x, float z, float time) {
  return sampleCloudShadowAtXZ(x, z, time, 0.52, 1.0);
}
`;

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash21TS(x: number, y: number): number {
  let p3x = fract(x * 0.1031);
  let p3y = fract(y * 0.1031);
  let p3z = fract(x * 0.1031);
  const d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x += d;
  p3y += d;
  p3z += d;
  return fract((p3x + p3y) * p3z);
}

function noise2DTS(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a = hash21TS(ix, iy);
  const b = hash21TS(ix + 1, iy);
  const c = hash21TS(ix, iy + 1);
  const d = hash21TS(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2DTS(x: number, y: number): number {
  let v = 0.0;
  let a = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 3; i++) {
    v += a * noise2DTS(px, py);
    px = px * 2.03 + 17.1;
    py = py * 2.03 + 31.7;
    a *= 0.5;
  }
  return v;
}

function smoothstepTS(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * CPU-side twin of the GLSL `sampleCloudShadowAtXZ` helper.
 * Returns a ground illumination multiplier in `[0.34, 1.0]` synchronized with
 * the drifting volumetric cloud layer.
 */
export function sampleCloudShadowAtXZ(
  x: number,
  z: number,
  time: number,
  options?: CloudShadowSampleOptions
): number {
  const coverage = Math.max(0, Math.min(1, options?.coverage ?? 0.52));
  const speed = options?.speed ?? 1.0;
  const drift = time * MACRO_DRIFT_RATE * speed;
  const ux = x * MACRO_CLOUD_SCALE - DEFAULT_WIND_DIR_X * drift;
  const uz = z * MACRO_CLOUD_SCALE - DEFAULT_WIND_DIR_Z * drift;
  const n = fbm2DTS(ux, uz);
  const threshold = 1.0 - coverage * 0.85;
  const shadowMask = smoothstepTS(threshold - 0.12, threshold + 0.28, n);
  return 1.0 + (0.34 - 1.0) * shadowMask;
}

const CLOUD_NOISE_SIZE = 256;
let cachedCloudNoiseBuffer: Uint8Array | null = null;

function hashGrid2D(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function fillPeriodicFbm(
  out: Float32Array,
  periods: readonly number[],
  weights: readonly number[],
  seedBase: number
): void {
  const size = CLOUD_NOISE_SIZE;
  out.fill(0);

  for (let o = 0; o < periods.length; o++) {
    const period = periods[o];
    const weight = weights[o];
    const mask = period - 1;
    const grid = new Float32Array(period * period);
    const seed = seedBase + o * 97;

    for (let gy = 0; gy < period; gy++) {
      for (let gx = 0; gx < period; gx++) {
        grid[gy * period + gx] = hashGrid2D(gx, gy, seed);
      }
    }

    for (let y = 0; y < size; y++) {
      const sy = y * period;
      const iy0 = sy >> 8;
      const iy1 = (iy0 + 1) & mask;
      const fy = (sy & 255) / 256;
      const uy = fy * fy * (3 - 2 * fy);
      const row0 = iy0 * period;
      const row1 = iy1 * period;

      for (let x = 0; x < size; x++) {
        const sx = x * period;
        const ix0 = sx >> 8;
        const ix1 = (ix0 + 1) & mask;
        const fx = (sx & 255) / 256;
        const ux = fx * fx * (3 - 2 * fx);

        const a = grid[row0 + ix0];
        const b = grid[row0 + ix1];
        const c = grid[row1 + ix0];
        const d = grid[row1 + ix1];
        const val = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
        out[y * size + x] += val * weight;
      }
    }
  }
}

function fillPeriodicWorley(out: Float32Array, gridSize: number, seed: number, sampleSize = CLOUD_NOISE_SIZE): void {
  const size = CLOUD_NOISE_SIZE;
  const mask = gridSize - 1;
  const cellCount = gridSize * gridSize;
  const ptsX = new Float32Array(cellCount);
  const ptsY = new Float32Array(cellCount);

  for (let cy = 0; cy < gridSize; cy++) {
    for (let cx = 0; cx < gridSize; cx++) {
      const idx = cy * gridSize + cx;
      ptsX[idx] = 0.15 + 0.70 * hashGrid2D(cx, cy, seed);
      ptsY[idx] = 0.15 + 0.70 * hashGrid2D(cx, cy, seed + 53);
    }
  }

  const lowRes = sampleSize < size ? new Float32Array(sampleSize * sampleSize) : out;
  const invSize = gridSize / sampleSize;

  for (let y = 0; y < sampleSize; y++) {
    const gy = y * invSize;
    const cy = Math.floor(gy);
    const fy = gy - cy;

    for (let x = 0; x < sampleSize; x++) {
      const gx = x * invSize;
      const cx = Math.floor(gx);
      const fx = gx - cx;

      let minDistSq = 4.0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = (cy + dy) & mask;
        const rowOffset = ny * gridSize;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (cx + dx) & mask;
          const idx = rowOffset + nx;
          const vx = dx + ptsX[idx] - fx;
          const vy = dy + ptsY[idx] - fy;
          const d2 = vx * vx + vy * vy;
          if (d2 < minDistSq) {
            minDistSq = d2;
          }
        }
      }
      lowRes[y * sampleSize + x] = 1.0 - Math.min(1.0, Math.sqrt(minDistSq) * 1.15);
    }
  }

  if (sampleSize < size) {
    const sMask = sampleSize - 1;
    const scale = sampleSize / size;
    for (let y = 0; y < size; y++) {
      const sy = y * scale;
      const iy0 = Math.floor(sy) & sMask;
      const iy1 = (iy0 + 1) & sMask;
      const fy = sy - Math.floor(sy);
      const row0 = iy0 * sampleSize;
      const row1 = iy1 * sampleSize;

      for (let x = 0; x < size; x++) {
        const sx = x * scale;
        const ix0 = Math.floor(sx) & sMask;
        const ix1 = (ix0 + 1) & sMask;
        const fx = sx - Math.floor(sx);
        const top = lowRes[row0 + ix0] + (lowRes[row0 + ix1] - lowRes[row0 + ix0]) * fx;
        const bot = lowRes[row1 + ix0] + (lowRes[row1 + ix1] - lowRes[row1 + ix0]) * fx;
        out[y * size + x] = top + (bot - top) * fy;
      }
    }
  }
}

function normalizeChannel(arr: Float32Array): void {
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  const invSpan = 1.0 / Math.max(maxVal - minVal, 1e-5);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = (arr[i] - minVal) * invSpan;
  }
}

/**
 * Generates and caches a seamless periodic 256x256 RGBA cloud noise buffer once
 * at module level (<10ms):
 *  - R: macro cumulus islands
 *  - G: cauliflower Worley billow ridges
 *  - B: wispy fine detail
 *  - A: secondary morph offset
 */
function getCloudNoiseBuffer(): Uint8Array {
  if (cachedCloudNoiseBuffer) {
    return cachedCloudNoiseBuffer;
  }

  const count = CLOUD_NOISE_SIZE * CLOUD_NOISE_SIZE;
  const fbmMacro = new Float32Array(count);
  const worleyCoarse = new Float32Array(count);
  const worleyMid = new Float32Array(count);
  const worleyFine = new Float32Array(count);
  const fbmDetail = new Float32Array(count);
  const fbmMorph = new Float32Array(count);

  fillPeriodicFbm(fbmMacro, [4, 8, 16], [0.58, 0.28, 0.14], 11);
  fillPeriodicWorley(worleyCoarse, 4, 107, 64);
  fillPeriodicWorley(worleyMid, 8, 211, 128);
  fillPeriodicWorley(worleyFine, 16, 317, 256);
  fillPeriodicFbm(fbmDetail, [16, 32, 64], [0.54, 0.30, 0.16], 409);
  fillPeriodicFbm(fbmMorph, [4, 8, 16], [0.55, 0.30, 0.15], 503);

  const rChan = new Float32Array(count);
  const gChan = new Float32Array(count);
  const bChan = new Float32Array(count);
  const aChan = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    rChan[i] = fbmMacro[i] * 0.66 + worleyCoarse[i] * 0.34;
    gChan[i] = worleyMid[i] * 0.62 + worleyFine[i] * 0.38;
    bChan[i] = fbmDetail[i] * 0.56 + worleyFine[i] * 0.44;
    aChan[i] = fbmMorph[i] * 0.70 + worleyMid[i] * 0.30;
  }

  normalizeChannel(rChan);
  normalizeChannel(gChan);
  normalizeChannel(bChan);
  normalizeChannel(aChan);

  const rgba = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    rgba[o] = Math.max(0, Math.min(255, Math.round(rChan[i] * 255)));
    rgba[o + 1] = Math.max(0, Math.min(255, Math.round(gChan[i] * 255)));
    rgba[o + 2] = Math.max(0, Math.min(255, Math.round(bChan[i] * 255)));
    rgba[o + 3] = Math.max(0, Math.min(255, Math.round(aChan[i] * 255)));
  }

  cachedCloudNoiseBuffer = rgba;
  return rgba;
}

export const volumetricCloudVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const volumetricCloudFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDomeRadius;
  uniform float uEarthRadius;
  uniform float uBaseY;
  uniform float uTopY;
  uniform float uCoverage;
  uniform float uSpeed;
  uniform float uGhibliToon;
  uniform vec3 uTint;
  uniform vec3 uShadowColor;
  uniform vec3 uFogColor;
  uniform vec3 uSunDirection;
  uniform sampler2D uCloudNoiseTex;

  varying vec3 vWorldPosition;

  const float PI = 3.14159265359;
  const int PRIMARY_STEPS = 16;
  const float CLOUD_UV_SCALE = 0.0022;

  vec2 intersectSphere(vec3 ro, vec3 rd, vec3 center, float rad) {
    vec3 oc = ro - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - rad * rad;
    float disc = b * b - c;
    if (disc < 0.0) {
      return vec2(-1.0);
    }
    float s = sqrt(disc);
    return vec2(-b - s, -b + s);
  }

  float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    float denom = max(1.0 + g2 - 2.0 * g * cosTheta, 0.002);
    return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
  }

  float interleavedGradientNoise(vec2 fragCoord) {
    return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorldPosition - ro);

    if (rd.y <= 0.01) {
      discard;
    }

    float horizonFade = smoothstep(0.18, 0.42, rd.y);
    if (horizonFade <= 0.001) {
      discard;
    }

    vec3 earthCenter = vec3(0.0, -uEarthRadius, 0.0);
    float rBase = uEarthRadius + uBaseY;
    float rTop = uEarthRadius + max(uTopY, uBaseY + 12.0);
    float slabThickness = max(rTop - rBase, 1.0);
    float slabNorm = 90.0 / max(slabThickness, 50.0);

    vec2 hitBase = intersectSphere(ro, rd, earthCenter, rBase);
    vec2 hitTop = intersectSphere(ro, rd, earthCenter, rTop);
    if (hitTop.y <= 0.0) {
      discard;
    }

    float camR = length(ro - earthCenter);
    float tStart = 0.0;
    float tEnd = 0.0;

    if (camR < rBase) {
      tStart = max(0.0, hitBase.y);
      tEnd = hitTop.y;
    } else if (camR <= rTop) {
      tStart = 0.0;
      tEnd = (hitBase.x > 0.0) ? min(hitBase.x, hitTop.y) : hitTop.y;
    } else {
      tStart = max(0.0, hitTop.x);
      tEnd = (hitBase.x > 0.0) ? min(hitBase.x, hitTop.y) : hitTop.y;
    }

    float maxMarchEnd = tStart + min(uDomeRadius * 0.16, slabThickness * 1.45);
    tEnd = min(tEnd, maxMarchEnd);

    float marchLen = tEnd - tStart;
    if (marchLen <= 0.05) {
      discard;
    }

    float cov = clamp(uCoverage, 0.0, 1.0);
    float covMask = smoothstep(0.0, 0.06, cov);
    if (covMask <= 0.001) {
      discard;
    }

    // Calibrated threshold so scene coverage (0.62-0.65) yields ~38-48% dramatic cumulus
    // clusters separated by wide vivid sky gaps instead of a murky overcast blanket
    float covCurve = pow(smoothstep(0.03, 0.98, cov), 1.32);
    float threshold = mix(0.84, 0.36, covCurve);

    vec2 windUv = vec2(${DEFAULT_WIND_DIR_X}, ${DEFAULT_WIND_DIR_Z}) * (uTime * 0.0082 * uSpeed);
    vec3 sunDir = normalize(uSunDirection);
    vec2 sunHoriz = sunDir.xz / max(length(sunDir.xz), 0.001);
    float sunOffsetWorld = mix(24.0, 44.0, 1.0 - clamp(sunDir.y, 0.0, 1.0));
    vec2 sunShadowOffsetUv = sunHoriz * (sunOffsetWorld * CLOUD_UV_SCALE);

    float fogLum = dot(uFogColor, vec3(0.2126, 0.7152, 0.0722));
    float tintLum = dot(uTint, vec3(0.2126, 0.7152, 0.0722));
    float dayActivity = smoothstep(0.025, 0.18, min(fogLum, tintLum * 1.5));
    float nightFactor = 1.0 - dayActivity;

    float stepLen = marchLen / float(PRIMARY_STEPS);
    float ign = interleavedGradientNoise(gl_FragCoord.xy);
    float jitter = mix(0.15 + 0.70 * ign, 0.5, nightFactor * 0.65);

    float cosTheta = dot(rd, sunDir);
    float hgForward = henyeyGreenstein(cosTheta, 0.66);
    float hgBack = henyeyGreenstein(cosTheta, -0.24);
    float phase = mix(hgBack, hgForward, 0.64);

    float sunElev = clamp(sunDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 warmSun = mix(vec3(1.06, 0.86, 0.68), vec3(1.05, 1.03, 0.98), sunElev);
    vec3 litBase = max(uTint * warmSun, uTint * mix(1.0, 1.06, dayActivity));
    vec3 cleanShadowLift = mix(
      uShadowColor,
      max(uShadowColor * 1.42, vec3(0.24, 0.35, 0.62) * mix(vec3(1.0), normalize(uShadowColor + vec3(0.01)) * 1.55, 0.4)),
      dayActivity * 0.55
    );

    vec3 accumColor = vec3(0.0);
    float transmittance = 1.0;

    for (int i = 0; i < PRIMARY_STEPS; i++) {
      float t = tStart + (float(i) + jitter) * stepLen;
      vec3 samplePos = ro + rd * t;
      float r = length(samplePos - earthCenter);
      float h = clamp((r - rBase) / slabThickness, 0.0, 1.0);

      float baseFlat = smoothstep(0.0, 0.18, h);
      float topTaper = smoothstep(1.0, 0.36, h);
      float heightProfile = baseFlat * mix(0.62, 1.0, topTaper);
      if (heightProfile <= 0.005) {
        continue;
      }

      vec2 macroUv = samplePos.xz * CLOUD_UV_SCALE - windUv + vec2(h * 0.042, -h * 0.028);
      vec4 baseTex = texture2D(uCloudNoiseTex, macroUv);
      float macroShape = mix(baseTex.r, baseTex.r * 0.72 + baseTex.g * 0.28, 0.55);
      float heightErode = smoothstep(0.26, 0.96, h) * 0.14;
      float macroDensity = smoothstep(threshold - 0.03, threshold + 0.14, macroShape - heightErode) * heightProfile;
      if (macroDensity <= 0.01) {
        continue;
      }

      vec2 morphShift = (vec2(baseTex.a, 1.0 - baseTex.a) - 0.5) * 0.075;
      vec2 detailUv = macroUv * 2.15 + morphShift + vec2(h * 0.12, -uTime * 0.004 * uSpeed);
      vec4 detailTex = texture2D(uCloudNoiseTex, detailUv);
      float billow = detailTex.g * 0.66 + detailTex.b * 0.34;
      float erosion = (1.0 - billow) * 0.28 * (1.0 - macroDensity * 0.72);
      float density = smoothstep(0.015, 0.56, max(0.0, macroDensity - erosion)) * covMask * horizonFade;
      if (density <= 0.01) {
        continue;
      }

      // Single directional sun-offset shadow tap toward uSunDirection.xz
      vec4 shadowTex = texture2D(uCloudNoiseTex, macroUv + sunShadowOffsetUv);
      float shadowShape = mix(shadowTex.r, shadowTex.r * 0.72 + shadowTex.g * 0.28, 0.55);
      float shadowHeightErode = smoothstep(0.26, 0.96, min(1.0, h + 0.20)) * 0.14;
      float shadowDensity = smoothstep(threshold - 0.03, threshold + 0.16, shadowShape - shadowHeightErode);

      float opticalOcc = shadowDensity * (0.55 + 0.65 * (1.0 - h)) + density * 0.35 * (1.0 - h);
      float beer = exp(-opticalOcc * 1.45);
      float powder = 1.0 - exp(-density * 2.8);
      float heightLight = smoothstep(0.05, 0.78, h);

      float directEnergy = clamp(
        mix(beer, 1.0, 0.26 * heightLight) * mix(0.68, 1.0, powder) * (0.28 + 0.72 * heightLight),
        0.0,
        1.0
      );

      if (uGhibliToon > 0.5) {
        float celStep1 = smoothstep(0.18, 0.32, directEnergy);
        float celStep2 = smoothstep(0.50, 0.66, directEnergy);
        float celEnergy = mix(0.14, 0.62, celStep1);
        celEnergy = mix(celEnergy, 1.0, celStep2);
        directEnergy = mix(directEnergy, celEnergy, 0.68);
      }

      float silverLining = clamp(phase * beer * (1.35 - density * 0.48), 0.0, 1.6);
      vec3 litShade = litBase * (1.02 + 0.34 * silverLining);
      vec3 bellyShade = mix(cleanShadowLift * 0.94, cleanShadowLift * 1.12, 0.45 * h);
      vec3 sampleColor = mix(bellyShade, litShade, directEnergy);

      if (uGhibliToon > 0.5) {
        float edgeMask = smoothstep(0.05, 0.34, density) * (1.0 - smoothstep(0.45, 0.88, density));
        float sunBacklit = pow(clamp(cosTheta * 0.5 + 0.5, 0.0, 1.0), 2.2);
        float topRim = smoothstep(0.30, 0.84, h) * smoothstep(0.32, 0.78, directEnergy);
        float rimStrength = clamp(edgeMask * (0.40 + 0.70 * sunBacklit) + topRim * 0.34, 0.0, 1.0);
        vec3 silverCreamRim = mix(vec3(1.0, 0.985, 0.94), litBase * 1.15, 0.42);
        sampleColor = mix(sampleColor, silverCreamRim, rimStrength * 0.58 * dayActivity);
      }

      float stepExtinction = density * stepLen * 0.044 * slabNorm;
      float stepTrans = exp(-stepExtinction);
      float stepAlpha = 1.0 - stepTrans;

      float horizonBand = 1.0 - smoothstep(0.01, 0.07, abs(rd.y));
      float horizonDistFade = smoothstep(uDomeRadius * 0.25, uDomeRadius * 0.95, t * (0.35 + abs(rd.y) * 2.0));
      sampleColor = mix(sampleColor, uFogColor, clamp(horizonBand * horizonDistFade * 0.72, 0.0, 0.72));

      accumColor += transmittance * stepAlpha * sampleColor;
      transmittance *= stepTrans;

      if (transmittance < 0.02) {
        transmittance = 0.0;
        break;
      }
    }

    float rawCoverage = 1.0 - transmittance;
    float alpha = clamp(rawCoverage * horizonFade * mix(1.0, 0.52, nightFactor), 0.0, 1.0);
    if (alpha <= 0.002) {
      discard;
    }

    vec3 finalRgb = accumColor / max(rawCoverage, 0.001);
    gl_FragColor = vec4(finalRgb, alpha);
  }
`;

/**
 * Creates a GPU-fast raymarched volumetric cloud dome mesh using a cached
 * periodic 256x256 RGBA cloud noise DataTexture, 6-step Earth-curved slab march,
 * single directional sun-offset shadow tap, Henyey-Greenstein silver-lining
 * scattering, and optional Ghibli backlit cel lift.
 */
export function createVolumetricCloudDome(
  options?: VolumetricCloudDomeOptions
): VolumetricCloudDomeHandle {
  const radius = options?.radius ?? 420;
  const baseY = options?.baseY ?? 58;
  const topY = options?.topY ?? 140;
  const coverage = options?.coverage ?? 0.52;
  const speed = options?.speed ?? 1.0;
  const ghibliToon = options?.ghibliToon ?? false;

  const tintColor = new THREE.Color(options?.tint ?? '#fff9eb');
  const shadowColor = new THREE.Color('#8ba6d6');
  const fogColor = new THREE.Color('#c8ddf0');
  const sunDirection = (options?.sunDirection ?? new THREE.Vector3(0.55, 0.68, 0.48))
    .clone()
    .normalize();

  const cloudNoiseTexture = new THREE.DataTexture(
    getCloudNoiseBuffer(),
    CLOUD_NOISE_SIZE,
    CLOUD_NOISE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  cloudNoiseTexture.wrapS = THREE.RepeatWrapping;
  cloudNoiseTexture.wrapT = THREE.RepeatWrapping;
  cloudNoiseTexture.magFilter = THREE.LinearFilter;
  cloudNoiseTexture.minFilter = THREE.LinearFilter;
  cloudNoiseTexture.generateMipmaps = false;
  cloudNoiseTexture.needsUpdate = true;

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uDomeRadius: { value: radius },
    uEarthRadius: { value: Math.max(radius * 5.0, 2000.0) },
    uBaseY: { value: baseY },
    uTopY: { value: topY },
    uCoverage: { value: coverage },
    uSpeed: { value: speed },
    uGhibliToon: { value: ghibliToon ? 1.0 : 0.0 },
    uTint: { value: tintColor },
    uShadowColor: { value: shadowColor },
    uFogColor: { value: fogColor },
    uSunDirection: { value: sunDirection },
    uCloudNoiseTex: { value: cloudNoiseTexture }
  };

  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: volumetricCloudVertexShader,
    fragmentShader: volumetricCloudFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
    fog: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'VolumetricCloudDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  const update = (
    time: number,
    sunDir?: THREE.Vector3,
    nextFogColor?: THREE.Color,
    nextCoverage?: number
  ): void => {
    uniforms.uTime.value = Number.isFinite(time) ? time : 0;

    if (sunDir) {
      const lenSq = sunDir.lengthSq();
      if (Number.isFinite(lenSq) && lenSq > 1e-8) {
        (uniforms.uSunDirection.value as THREE.Vector3).copy(sunDir).normalize();
      }
    }

    if (nextFogColor) {
      (uniforms.uFogColor.value as THREE.Color).copy(nextFogColor);
    }

    if (typeof nextCoverage === 'number' && Number.isFinite(nextCoverage)) {
      uniforms.uCoverage.value = Math.max(0, Math.min(1, nextCoverage));
    }
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
    cloudNoiseTexture.dispose();
  };

  return {
    mesh,
    uniforms,
    update,
    dispose
  };
}
