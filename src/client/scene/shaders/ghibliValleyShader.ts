import * as THREE from 'three';
import { CLOUD_SHADOW_GLSL } from './volumetricCloudShader';

export const GHIBLI_SEA_LEVEL = -1.85;

/**
 * Analytical coastline curve z = coastZ(x) separating the walkable hillside from the turquoise bay.
 */
export function getCoastlineZ(x: number): number {
  return -31.0 + Math.sin(x * 0.028) * 3.2;
}

/**
 * Winding cobblestone village road centerline x = roadX(z).
 */
export function getGhibliRoadCenterX(z: number): number {
  return Math.sin(z * 0.068 + 0.5) * 4.2;
}

/**
 * Terraced hillside rill stream centerline x = rillX(z).
 * Routed cleanly east of the Windmill Bakery (12.5, -10.5) and west of eastern cottages (>= 5.9m clearance).
 */
export function getGhibliRillCenterX(z: number): number {
  return 19.2 - 6.8 * Math.tanh((z + 3.0) * 0.085) + Math.sin(z * 0.12) * 0.7;
}

/**
 * Continuous analytical terrain height function h(x, z) for Space 6 "Thế giới Ghibli".
 * Evaluates a sunlit walkable coastal hillside, terraced town knoll, Spirit Camphor hillock,
 * western lighthouse headland cape, hillside rill channel, and coastal shelf in O(1) time.
 */
export function getGhibliValleyHeight(x: number, z: number): number {
  const coastZ = getCoastlineZ(x);
  const distInland = z - coastZ;

  // Drop beneath sea level only offshore beyond the stone seawall (distInland < -1.2)
  const shelfDrop = -5.1 / (1.0 + Math.exp((distInland + 2.8) * 0.92));

  // Gentle coastal hill rising southward (+Z) from seaside promenade (~1.7m) up to scenic ridge (~7.8m)
  const hillRise = 3.85 * Math.tanh((z + 6.0) * 0.028) + 3.15;

  // Rolling sunlit meadow undulations across the expanded 440m valley
  const roll =
    0.85 * Math.cos(0.036 * x) * Math.cos(0.032 * z) +
    0.42 * Math.sin(0.055 * x + 0.35) +
    0.28 * Math.cos(0.048 * z - 0.45);

  // Spirit Camphor Knoll crowning the left hillside overlooking the village & bay
  const dxT = x + 16.5;
  const dzT = z + 10.5;
  const camphorKnoll = 1.85 * Math.exp(-(dxT * dxT + dzT * dzT) / 145.0);

  // Western Headland Cape Promontory at (-62, -26) supporting the Headland Lighthouse & Cliff Overlook
  const dxCape = x + 62.0;
  const dzCape = z + 26.0;
  const westernCape = 2.45 * Math.exp(-(dxCape * dxCape + dzCape * dzCape) / 260.0);

  // Gentle headland drop far beyond |x| > 79 on the coastal half so bay wraps cleanly around the cape
  const sideExcess = Math.max(0, x * x - 6241);
  const northCoastMask = z < 18 ? Math.min(1, (18 - z) / 28) : 0;
  const capeDrop = -0.00045 * sideExcess * northCoastMask;

  // Sculpted brook valley channel for the terraced hillside rill (wide enough for 2.2m terrain quads)
  let rillCarve = 0.0;
  if (z >= -24.0 && z <= 28.0) {
    const rx = getGhibliRillCenterX(z);
    const dr = Math.abs(x - rx);
    if (dr < 5.6) {
      const spanFade =
        Math.min(1.0, Math.max(0.0, (z + 24.0) / 4.0)) *
        Math.min(1.0, Math.max(0.0, (28.0 - z) / 4.0));
      rillCarve = -0.92 * Math.exp(-(dr * dr) / 6.2) * spanFade;
    }
  }

  return Math.max(-5.5, hillRise + roll + camphorKnoll + westernCape + shelfDrop + capeDrop + rillCarve);
}

/**
 * Evaluates analytical terrain surface normal via central finite differences in O(1) time.
 */
export function getGhibliValleyNormal(
  x: number,
  z: number,
  target = new THREE.Vector3()
): THREE.Vector3 {
  const eps = 0.08;
  const dhdx = (getGhibliValleyHeight(x + eps, z) - getGhibliValleyHeight(x - eps, z)) / (2 * eps);
  const dhdz = (getGhibliValleyHeight(x, z + eps) - getGhibliValleyHeight(x, z - eps)) / (2 * eps);
  return target.set(-dhdx, 1.0, -dhdz).normalize();
}

/**
 * Sky dome shader for "Thế giới Ghibli" (calibrated in linear RGB for CinematicPipeline + OutputPass).
 */
export function createGhibliSkyMaterial(customUniforms?: Partial<{
  topColor: string | THREE.Color;
  bottomColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
  sunDirection: [number, number, number] | THREE.Vector3;
}>): THREE.ShaderMaterial {
  let sunDir: THREE.Vector3;
  if (customUniforms?.sunDirection instanceof THREE.Vector3) {
    sunDir = customUniforms.sunDirection.clone().normalize();
  } else if (Array.isArray(customUniforms?.sunDirection)) {
    sunDir = new THREE.Vector3(
      customUniforms.sunDirection[0],
      customUniforms.sunDirection[1],
      customUniforms.sunDirection[2]
    ).normalize();
  } else {
    sunDir = new THREE.Vector3(48, 66, 36).normalize();
  }

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uTopColor: {
        value: customUniforms?.topColor instanceof THREE.Color
          ? customUniforms.topColor
          : new THREE.Color(customUniforms?.topColor ?? '#1256cc')
      },
      uBottomColor: {
        value: customUniforms?.bottomColor instanceof THREE.Color
          ? customUniforms.bottomColor
          : new THREE.Color(customUniforms?.bottomColor ?? '#4da3f0')
      },
      uHorizonColor: {
        value: customUniforms?.horizonColor instanceof THREE.Color
          ? customUniforms.horizonColor
          : new THREE.Color(customUniforms?.horizonColor ?? '#bce4fc')
      },
      uSunDirection: { value: sunDir }
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDirection;
      void main() {
        vWorldDirection = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDirection;

      varying vec3 vWorldDirection;

      float sHash3(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float sNoise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(sHash3(i + vec3(0,0,0)), sHash3(i + vec3(1,0,0)), f.x),
              mix(sHash3(i + vec3(0,1,0)), sHash3(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(sHash3(i + vec3(0,0,1)), sHash3(i + vec3(1,0,1)), f.x),
              mix(sHash3(i + vec3(0,1,1)), sHash3(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float sFbm3(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * sNoise3(p);
          p = p * 2.03 + vec3(6.7, 10.3, 5.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDirection);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 sunDir = normalize(uSunDirection);
        float sunDot = max(dot(dir, sunDir), 0.0);

        // Rich physical-inspired azure sky gradient driven by uHorizonColor / uBottomColor / uTopColor
        vec3 zenithBlue = uTopColor;
        vec3 midAzure = uBottomColor;
        vec3 horizonCyan = uHorizonColor;
        vec3 sky = mix(horizonCyan, midAzure, smoothstep(0.0, 0.28, h));
        sky = mix(sky, zenithBlue, smoothstep(0.24, 0.90, h));

        // Subtle sunlit horizon scattering glow
        float horizonBand = exp(-abs(dir.y) * 6.2);
        vec2 dirXZ = normalize(vec2(dir.x, dir.z) + vec2(1e-4));
        vec2 sunXZ = normalize(vec2(sunDir.x, sunDir.z) + vec2(1e-4));
        float sunAzimuth = pow(max(dot(dirXZ, sunXZ) * 0.5 + 0.5, 0.0), 2.8);
        sky += vec3(0.96, 0.80, 0.54) * horizonBand * (0.02 + 0.065 * sunAzimuth);

        // Subtle high-altitude sunlit cirrus wisps (3D raymarched VolumetricCloudDome handles hero cumulonimbus towers)
        if (h > 0.04) {
          float planeT = 1.0 / max(h, 0.08);
          vec2 skyXZ = dir.xz * min(planeT, 10.0);
          vec2 cloudUv = skyXZ * 0.58 + vec2(uTime * 0.006, -uTime * 0.004);

          float nBase = sFbm3(vec3(cloudUv * 0.9, 1.3));
          float nWisp = sNoise3(vec3(cloudUv * 3.8 - vec2(uTime * 0.010, 0.0), 4.1));
          float wispDensity = nBase * 0.65 + nWisp * 0.35;
          float horizonFade = smoothstep(0.04, 0.18, h) * (1.0 - smoothstep(0.68, 0.96, h));
          float wispAlpha = smoothstep(0.56, 0.82, wispDensity) * horizonFade * 0.28;
          vec3 wispCol = mix(horizonCyan * 1.04, vec3(1.0, 0.99, 0.96), 0.72 + 0.28 * pow(sunDot, 2.0));
          sky = mix(sky, wispCol, wispAlpha);
        }

        // Crisp solar disc & atmospheric corona
        float sunDisc = smoothstep(0.9984, 0.9995, sunDot) * 1.45;
        float sunCorona = pow(sunDot, 52.0) * 0.38 + pow(sunDot, 9.0) * 0.08;
        sky += vec3(1.0, 0.94, 0.76) * (sunDisc + sunCorona);

        if (dir.y < 0.0) {
          sky = mix(sky, horizonCyan * 0.82, smoothstep(0.0, -0.24, dir.y));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });
}

/**
 * Linear-calibrated 3-tone Ghibli cumulus tower shader (fog-safe & seam-free).
 */
export function createGhibliValleyCloudMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  cloudSpeed: number;
}>): THREE.ShaderMaterial {
  let sunDir: THREE.Vector3;
  if (customUniforms?.sunDirection instanceof THREE.Vector3) {
    sunDir = customUniforms.sunDirection.clone().normalize();
  } else if (Array.isArray(customUniforms?.sunDirection)) {
    sunDir = new THREE.Vector3(
      customUniforms.sunDirection[0],
      customUniforms.sunDirection[1],
      customUniforms.sunDirection[2]
    ).normalize();
  } else {
    sunDir = new THREE.Vector3(48, 66, 36).normalize();
  }

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDir },
      uCloudSpeed: { value: customUniforms?.cloudSpeed ?? 0.65 },
      uTopColor: { value: new THREE.Color('#fbfbfa') },
      uMidColor: { value: new THREE.Color('#cde0f5') },
      uShadowColor: { value: new THREE.Color('#82a3cf') },
      uRimColor: { value: new THREE.Color('#fffdf6') }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>

      uniform float uTime;
      uniform float uCloudSpeed;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

        float t = uTime * uCloudSpeed;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        // Continuous world-space billowing displacement (never along raw normal so intersecting puffs stay seam-free!)
        float puffWave =
          sin(worldPos.x * 0.065 + worldPos.y * 0.075 + t * 0.25) * 1.35 +
          cos(worldPos.z * 0.072 - worldPos.x * 0.045 - t * 0.20) * 1.15;
        worldPos.y += puffWave;
        worldPos.x += sin(t * 0.045) * 4.5 + cos(worldPos.y * 0.09) * 0.65;
        worldPos.z += cos(t * 0.035) * 2.2;
        vWorldPosition = worldPos.xyz;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>

      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uShadowColor;
      uniform vec3 uRimColor;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      float cHash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float cNoise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(cHash(i + vec3(0,0,0)), cHash(i + vec3(1,0,0)), f.x),
              mix(cHash(i + vec3(0,1,0)), cHash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(cHash(i + vec3(0,0,1)), cHash(i + vec3(1,0,1)), f.x),
              mix(cHash(i + vec3(0,1,1)), cHash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float cFbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * cNoise(p);
          p = p * 2.05 + vec3(11.3, 7.1, 5.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 rawN = normalize(vNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        // Pure continuous upward/sunward volumetric normal eliminates all sphere-intersection seams
        vec3 baseN = normalize(mix(rawN, normalize(vec3(0.08, 0.90, 0.22)), 0.92));

        vec3 samplePos = vWorldPosition * 0.022 + vec3(uTime * 0.007, 0.0, -uTime * 0.005);
        float warp = cFbm(samplePos * 0.78);
        vec3 warpedPos = samplePos + vec3(warp * 1.65, warp * 0.85, -warp * 1.1);
        float puffMacro = cFbm(warpedPos);
        float puffMid = cFbm(vWorldPosition * 0.052 + vec3(warp * 0.8, -uTime * 0.006, 0.0));
        float puffMicro = cFbm(vWorldPosition * 0.11 - vec3(uTime * 0.014, 0.0, 0.0));
        float puffDetail = (puffMacro - 0.48) * 0.56 + (puffMid - 0.50) * 0.30 + (puffMicro - 0.50) * 0.14;

        // Continuous 3D FBM normal perturbation sculpts fluffy cumulus billows without mesh seams
        float eps = 1.6;
        float nDx = cFbm(warpedPos + vec3(eps * 0.022, 0.0, 0.0)) - puffMacro;
        float nDy = cFbm(warpedPos + vec3(0.0, eps * 0.022, 0.0)) - puffMacro;
        float nDz = cFbm(warpedPos + vec3(0.0, 0.0, eps * 0.022)) - puffMacro;
        vec3 N = normalize(baseN + vec3(-nDx, -nDy, -nDz) * 2.25);

        float altitudeLight = clamp((vWorldPosition.y - 16.0) / 68.0, 0.0, 1.0);
        float NdotL = dot(N, L) * 0.5 + 0.5;
        float shade = mix(NdotL, 0.28 + altitudeLight * 0.72, 0.56) + puffDetail * 0.85;

        float band1 = smoothstep(0.16, 0.52, shade);
        float band2 = smoothstep(0.46, 0.82, shade);

        vec3 col = mix(uShadowColor, uMidColor, band1);
        col = mix(col, uTopColor, band2);

        // Soft cool cerulean bounce on shaded undersides
        col = mix(col, vec3(0.44, 0.62, 0.86), (1.0 - band1) * (1.0 - altitudeLight) * 0.30);

        // Anisotropic forward Mie scattering ("silver lining")
        float NdotV = max(dot(N, V), 0.0);
        float cosTheta = dot(-V, L);
        float mie = pow(clamp(cosTheta * 0.5 + 0.5, 0.0, 1.0), 3.6);
        float rim = pow(1.0 - NdotV, 2.6) * (0.28 + 0.52 * mie);
        col = mix(col, uRimColor, clamp(rim * 0.44 + mie * 0.14 * band2, 0.0, 0.44));

        // Soft base horizon atmosphere blend
        float baseHaze = smoothstep(26.0, 6.0, vWorldPosition.y);
        col = mix(col, vec3(0.60, 0.80, 0.95), baseHaze * 0.25);

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Analytical CPU-side twin of the Gerstner swell field used by `createGhibliOceanWaterMaterial`
 * so sailboats heave, pitch, and roll synchronously on the coastal bay swells.
 */
export function getGhibliOceanWaveState(
  x: number,
  z: number,
  time: number
): { y: number; slopeX: number; slopeZ: number } {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z) ? z : 0;
  const safeT = Number.isFinite(time) ? time : 0;

  const coastZ = getCoastlineZ(safeX);
  const distOffshore = Math.max(0, coastZ - safeZ);
  const shoreT = Math.max(0, Math.min(1, distOffshore / 4.5));
  const shoreMask = shoreT * shoreT * (3 - 2 * shoreT);
  const distR = Math.hypot(safeX, safeZ);
  const farT = Math.max(0, Math.min(1, (distR - 140) / 180));
  const farMask = 1 - farT * farT * (3 - 2 * farT);
  const env = shoreMask * farMask;

  // 4 directional Gerstner waves matching vertexShader
  const waves: ReadonlyArray<[number, number, number, number, number]> = [
    [0.14, 0.99, 0.24, 0.24, 1.75],
    [-0.36, 0.93, 0.38, 0.14, 2.15],
    [0.52, 0.85, 0.56, 0.08, 2.55],
    [-0.18, 0.98, 0.88, 0.045, 3.1]
  ];

  let y = 0;
  let slopeX = 0;
  let slopeZ = 0;
  for (let i = 0; i < waves.length; i++) {
    const [dx, dz, k, amp, spd] = waves[i];
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    const phase = (safeX * nx + safeZ * nz) * k - safeT * spd;
    const a = amp * env;
    y += a * Math.sin(phase);
    const dCos = a * k * Math.cos(phase);
    slopeX += nx * dCos;
    slopeZ += nz * dCos;
  }

  return { y, slopeX, slopeZ };
}

/**
 * Sparkling Turquoise Coastal Bay shader (`GhibliOceanWater`) with rolling 3D Gerstner swells,
 * rhythmic white shoreline surf foam, backlit emerald SSS, and sunlit diamond sparkles.
 */
export function createGhibliOceanWaterMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  cloudCoverage: number;
}>): THREE.ShaderMaterial {
  let sunDir: THREE.Vector3;
  if (customUniforms?.sunDirection instanceof THREE.Vector3) {
    sunDir = customUniforms.sunDirection.clone().normalize();
  } else if (Array.isArray(customUniforms?.sunDirection)) {
    sunDir = new THREE.Vector3(
      customUniforms.sunDirection[0],
      customUniforms.sunDirection[1],
      customUniforms.sunDirection[2]
    ).normalize();
  } else {
    sunDir = new THREE.Vector3(48, 66, 36).normalize();
  }

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDir },
      uCloudCoverage: { value: customUniforms?.cloudCoverage ?? 0.62 },
      uAudioTreble: { value: 0.0 }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;

      varying vec3 vWorldPosition;
      varying float vWaveElevation;
      varying float vCrestFactor;

      vec3 evalGerstnerWave(vec2 pos, vec2 dir, float k, float amp, float spd, float steepness, inout float crestAccum) {
        vec2 d = normalize(dir);
        float phase = dot(pos, d) * k - uTime * spd;
        float s = sin(phase);
        float c = cos(phase);
        float q = steepness / max(k * amp, 0.001);
        crestAccum += max(0.0, s) * amp;
        return vec3(d.x * q * amp * c, amp * s, d.y * q * amp * c);
      }

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec2 p = worldPos.xz;

        float coastZ = -31.0 + sin(p.x * 0.028) * 3.2;
        float distOffshore = max(0.0, coastZ - p.y);
        float shoreAtten = smoothstep(0.0, 4.5, distOffshore);
        float farAtten = 1.0 - smoothstep(140.0, 320.0, length(p));
        float env = shoreAtten * farAtten;

        float crestAccum = 0.0;
        vec3 disp = vec3(0.0);
        disp += evalGerstnerWave(p, vec2(0.14, 0.99), 0.24, 0.24 * env, 1.75, 0.42, crestAccum);
        disp += evalGerstnerWave(p, vec2(-0.36, 0.93), 0.38, 0.14 * env, 2.15, 0.36, crestAccum);
        disp += evalGerstnerWave(p, vec2(0.52, 0.85), 0.56, 0.08 * env, 2.55, 0.30, crestAccum);
        disp += evalGerstnerWave(p, vec2(-0.18, 0.98), 0.88, 0.045 * env, 3.10, 0.25, crestAccum);

        worldPos.xyz += disp;

        vWorldPosition = worldPos.xyz;
        vWaveElevation = disp.y;
        vCrestFactor = clamp(crestAccum * 2.4, 0.0, 1.0);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>

      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform float uCloudCoverage;
      uniform float uAudioTreble;

      varying vec3 vWorldPosition;
      varying float vWaveElevation;
      varying float vCrestFactor;

      ${CLOUD_SHADOW_GLSL}

      float wHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 41.23);
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
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          v += a * wNoise(p);
          p = rot * p * 2.07 + vec2(13.7, 29.1);
          a *= 0.5;
        }
        return v;
      }

      float waveHeight(vec2 p, float t, float detailAtten) {
        // Synchronized rolling Gerstner swells + wind-driven capillary ripples
        float swellA = sin(dot(p, normalize(vec2(0.14, 0.99))) * 0.24 - t * 1.75) * 0.34;
        float swellB = sin(dot(p, normalize(vec2(-0.36, 0.93))) * 0.38 - t * 2.15) * 0.22;
        float swellC = sin(dot(p, normalize(vec2(0.52, 0.85))) * 0.56 - t * 2.55) * 0.14;
        float chop1 = wFbm(p * 0.30 + vec2(t * 0.32, t * 0.46)) * 0.48;
        float chop2 = wNoise(p * 1.05 + vec2(-t * 0.44, t * 0.62)) * 0.24 * detailAtten;
        return swellA + swellB + swellC + chop1 + chop2;
      }

      void main() {
        vec2 p = vWorldPosition.xz;
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        float camDist = length(cameraPosition - vWorldPosition);

        // Analytical coastline, viaduct, and distant bay island coordinates
        float coastZ = -31.0 + sin(p.x * 0.028) * 3.2;
        float distOffshore = max(0.0, coastZ - p.y);
        float viaductZ = coastZ - 7.2;
        float distToViaduct = abs(p.y - viaductZ);

        // Smooth distance attenuation prevents horizon shimmer/aliasing
        float nearAtten = 1.0 - smoothstep(32.0, 185.0, camDist);
        float microAtten = 1.0 - smoothstep(18.0, 105.0, camDist);

        // Finite-difference Gerstner/FBM surface normal
        float eps = mix(0.62, 0.20, nearAtten);
        float hC = waveHeight(p, uTime, microAtten);
        float hX = waveHeight(p + vec2(eps, 0.0), uTime, microAtten);
        float hZ = waveHeight(p + vec2(0.0, eps), uTime, microAtten);
        float normalStrength = mix(0.32, 0.82, nearAtten);
        vec3 waveN = normalize(vec3((hC - hX) / eps * normalStrength, 1.0, (hC - hZ) / eps * normalStrength));

        // Overhead drifting cloud shadow factor synced with VolumetricCloudDome
        float cloudSun = mix(1.0, sampleCloudShadowAtXZ(p.x, p.y, uTime, uCloudCoverage, 0.65), 0.38);

        // Realistic coastal emerald-turquoise depth absorption + deep sapphire-teal bay
        vec3 shallowEmerald = vec3(0.028, 0.59, 0.54);
        vec3 midTurquoise = vec3(0.008, 0.38, 0.50);
        vec3 deepOceanTeal = vec3(0.008, 0.19, 0.38);

        float depthMix1 = smoothstep(0.0, 26.0, distOffshore);
        float depthMix2 = smoothstep(26.0, 115.0, distOffshore);
        vec3 waterCol = mix(shallowEmerald, midTurquoise, depthMix1);
        waterCol = mix(waterCol, deepOceanTeal, depthMix2);

        // Emerald-turquoise subsurface scattering (SSS) glowing through backlit Gerstner wave crests
        float crestLift = smoothstep(-0.08, 0.72, hC * 0.55 + vWaveElevation * 2.4 + vCrestFactor * 0.45);
        vec3 sssDir = normalize(L - waveN * 0.55);
        float sssView = pow(max(dot(V, -sssDir), 0.0), 2.2);
        float sssGlow = crestLift * (0.36 + 0.64 * sssView) * (1.0 - depthMix2 * 0.42);
        waterCol += vec3(0.035, 0.52, 0.46) * sssGlow * 0.82 * cloudSun;

        // Shallow seabed caustic shimmer near the seawall
        float caustic = smoothstep(0.52, 0.84, wNoise(p * 0.58 + vec2(uTime * 0.26, -uTime * 0.20)));
        waterCol += vec3(0.035, 0.22, 0.19) * caustic * (1.0 - depthMix1) * nearAtten * cloudSun;

        // Capped Schlick Fresnel reflection so grazing coastal water stays vivid emerald-turquoise
        float NdotV = max(dot(waveN, V), 0.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 4.4);
        vec3 skyReflect = mix(vec3(0.10, 0.44, 0.78), vec3(0.30, 0.66, 0.90), clamp(1.0 - NdotV * 1.4, 0.0, 1.0));
        waterCol = mix(waterCol, skyReflect, clamp(fresnel * 0.34, 0.0, 0.32));
        waterCol *= mix(0.76, 1.04, cloudSun);

        // Breaking white sea-foam crests, rhythmic shoreline surf bands, viaduct pier wake & distant island reef lines
        float foamTex = wFbm(p * 0.78 + vec2(uTime * 0.26, uTime * 0.38));
        float foamFine = wNoise(p * 2.5 - vec2(uTime * 0.48, -uTime * 0.38));
        float lacyFoam = smoothstep(0.28, 0.66, foamTex * 0.68 + foamFine * 0.32);

        // 1. Rhythmic rolling shoreline surf bands surging onto seawall & boulders
        float seawallMask = 1.0 - smoothstep(56.0, 78.0, abs(p.x));
        float surfWave1 = sin(distOffshore * 1.18 + uTime * 2.35 + foamTex * 2.2);
        float surfWave2 = sin(distOffshore * 0.68 + uTime * 1.50 - foamFine * 1.6);
        float surfBand1 = smoothstep(10.5, 0.35, distOffshore) * smoothstep(0.22, 0.86, surfWave1 * 0.5 + 0.5 + lacyFoam * 0.32);
        float surfBand2 = smoothstep(6.2, 0.25, distOffshore) * smoothstep(0.30, 0.88, surfWave2 * 0.5 + 0.5 + lacyFoam * 0.28);
        float boulderWake = smoothstep(4.5, 0.45, distOffshore) * smoothstep(0.38, 0.76, wNoise(p * 0.72 + vec2(0.0, uTime * 0.32)));
        float shoreFoam = max(max(surfBand1, surfBand2 * 0.92), boulderWake * (0.52 + 0.48 * lacyFoam)) * seawallMask;
        float baseFoamEdge = smoothstep(1.85, 0.12, distOffshore) * (0.76 + 0.24 * lacyFoam) * seawallMask;

        // 2. Viaduct pier disturbance foam & wake
        float viaductFoam = smoothstep(2.6, 0.42, distToViaduct) * smoothstep(0.28, 0.74, foamTex + 0.24) * 0.84;

        // 3. Distant island reef surf lines (islands at (-165,-225), (-24,-260), (158,-232))
        float dIsl1 = length((p - vec2(-165.0, -225.0)) / vec2(74.0, 36.0));
        float dIsl2 = length((p - vec2(-24.0, -260.0)) / vec2(66.0, 32.0));
        float dIsl3 = length((p - vec2(158.0, -232.0)) / vec2(78.0, 38.0));
        float minIsl = min(dIsl1, min(dIsl2, dIsl3));
        float islandSurf = (1.0 - smoothstep(0.88, 1.36, minIsl)) * smoothstep(0.64, 0.95, minIsl)
                         * (0.58 + 0.42 * sin(minIsl * 24.0 - uTime * 2.2 + foamTex * 3.2))
                         * smoothstep(0.20, 0.66, lacyFoam + 0.32);

        // 4. Open-bay Gerstner crest whitecaps rolling shoreward
        float swellBand = sin(dot(p, normalize(vec2(0.14, 0.99))) * 0.24 - uTime * 1.75 + wNoise(p * 0.032) * 2.6);
        float waveBreak = smoothstep(0.36, 0.92, swellBand) * smoothstep(0.28, 0.76, vCrestFactor + hC * 0.35)
                        * smoothstep(0.26, 0.66, lacyFoam) * smoothstep(2.2, 14.0, distOffshore);
        float windWhitecaps = smoothstep(0.54, 0.84, hC * 0.65 + vCrestFactor * 0.35 + foamTex * 0.26) * nearAtten * 0.64;

        float totalFoam = clamp(
          max(
            max(shoreFoam, baseFoamEdge),
            max(max(viaductFoam, islandSurf * 0.94), max(waveBreak * 0.92, windWhitecaps))
          ),
          0.0,
          1.0
        );
        vec3 foamColor = vec3(0.94, 0.98, 1.0) * (0.86 + 0.16 * max(dot(waveN, L), 0.0)) * mix(0.84, 1.0, cloudSun);
        waterCol = mix(waterCol, foamColor, totalFoam * 0.92);

        // Crisp sun specular highlight & shimmering diamond solar glints
        vec3 H = normalize(L + V);
        float NdotH = max(dot(waveN, H), 0.0);
        float sunSpec = pow(NdotH, 155.0) * 1.65 + pow(NdotH, 30.0) * 0.16;
        float g1 = wNoise(p * 1.45 + vec2(uTime * 0.92, -uTime * 0.60));
        float g2 = wNoise(p * 2.35 - vec2(uTime * 0.70, uTime * 0.52));
        float sparkle = smoothstep(0.80, 0.95, g1) * smoothstep(0.76, 0.94, g2) * nearAtten;
        float sunCone = pow(clamp(dot(vec3(0.0, 1.0, 0.0), H), 0.0, 1.0), 3.0);
        float glintBoost = 1.0 + clamp(uAudioTreble, 0.0, 1.5) * 0.25;
        waterCol += vec3(1.22, 1.15, 0.95) * (sunSpec + sparkle * (0.35 + 1.35 * sunCone)) * glintBoost * cloudSun * (1.0 - totalFoam * 0.72);

        gl_FragColor = vec4(waterCol, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Crystal-clear animated turquoise hillside brook shader for the terraced rill under the Stone Arch Footbridge.
 */
export function createGhibliHillsideBrookMaterial(
  sunDirection: THREE.Vector3
): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDirection.clone().normalize() }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>

      uniform float uTime;
      uniform vec3 uSunDirection;

      varying vec3 vWorldPosition;
      varying vec2 vUv;

      float bHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 41.23);
        return fract(p.x * p.y);
      }

      float bNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(bHash(i), bHash(i + vec2(1.0, 0.0)), u.x),
          mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 p = vWorldPosition.xz;
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(cameraPosition - vWorldPosition);

        float edgeMask = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
        float flow = uTime * 1.45;
        float r1 = bNoise(vec2(p.x * 2.8, p.y * 2.2 + flow));
        float r2 = bNoise(vec2(p.x * 5.2 - flow * 0.2, p.y * 4.4 + flow * 1.35));
        float ripple = r1 * 0.6 + r2 * 0.4;

        float eps = 0.08;
        float rx = bNoise(vec2((p.x + eps) * 3.4, p.y * 2.6 + flow)) - r1;
        float rz = bNoise(vec2(p.x * 3.4, (p.y + eps) * 2.6 + flow)) - r1;
        vec3 N = normalize(vec3(-rx * 2.2, 1.0, -rz * 2.2));

        vec3 pebbleBed = vec3(0.075, 0.24, 0.21);
        vec3 clearAqua = vec3(0.035, 0.42, 0.46);
        vec3 deepBrook = vec3(0.018, 0.28, 0.38);
        vec3 col = mix(pebbleBed, mix(clearAqua, deepBrook, ripple * 0.55), edgeMask * 0.78 + 0.18);

        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = mix(col, vec3(0.32, 0.68, 0.90), fresnel * 0.42);

        // Subtle riffle foam streaks & sunlit diamond sparkles
        float riffle = smoothstep(0.70, 0.88, ripple) * edgeMask * 0.32;
        col = mix(col, vec3(0.86, 0.94, 0.96), riffle);

        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 96.0) * 1.25;
        col += vec3(1.0, 0.96, 0.84) * spec;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Hillside meadow, cobblestone village road & seawall promenade shader (linear RGB calibrated).
 */
export function createGhibliValleyTerrainMaterial(
  sunDirection: THREE.Vector3,
  windDirection: THREE.Vector2,
  windSpeed: number,
  gustiness: number,
  detailTex: THREE.DataTexture
): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uSunDirection: { value: sunDirection.clone().normalize() },
      uWindDirection: { value: windDirection.clone().normalize() },
      uWindSpeed: { value: windSpeed },
      uGustiness: { value: gustiness },
      uCloudCoverage: { value: 0.62 }
    }
  ]);
  uniforms.uDetailTex = { value: detailTex };

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexColors: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vVertexColor;

      void main() {
        #ifdef USE_COLOR
        vVertexColor = color;
        #else
        vVertexColor = vec3(0.14, 0.42, 0.08);
        #endif

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
      uniform vec2 uWindDirection;
      uniform float uWindSpeed;
      uniform float uGustiness;
      uniform float uCloudCoverage;
      uniform sampler2D uDetailTex;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vVertexColor;

      ${CLOUD_SHADOW_GLSL}

      float tHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 41.23);
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

      // Multi-octave organic FBM for natural gravel, sandy loam & clover verge blending (zero Voronoi cells)
      float tFbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          v += a * tNoise(p);
          p = rot * p * 2.04 + vec2(11.3, 23.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 p = vWorldPosition.xz;
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        vec2 windDir = normalize(uWindDirection);
        vec2 perpDir = vec2(-windDir.y, windDir.x);

        float camDist = length(cameraPosition - vWorldPosition);
        float nearDetail = 1.0 - smoothstep(28.0, 96.0, camDist);

        // Decode procedural sRGB DataTexture into linear RGB modulation + high-frequency micro-turf fibers
        vec3 texA = pow(max(texture2D(uDetailTex, p * 0.42).rgb, vec3(0.0)), vec3(2.2));
        vec3 texB = pow(max(texture2D(uDetailTex, p * 0.11 + vec2(0.31, 0.67)).rgb, vec3(0.0)), vec3(2.2));
        float fiberMed = tNoise(p * 14.0);
        float fiberFine = tNoise(p * 42.0 + vec2(3.1, 7.7));
        float thatchAO = smoothstep(0.18, 0.82, fiberMed * 0.6 + fiberFine * 0.4);
        vec3 detailMod = mix(vec3(0.88), mix(texA, texB, 0.45), 0.50 + 0.50 * nearDetail);
        detailMod *= mix(vec3(0.84, 0.82, 0.72), vec3(1.12, 1.15, 0.96), mix(0.5, thatchAO, nearDetail));

        // Synchronized gust-front wind wave matching createGustWindGrassMaterial across the coastal slopes
        float gustSpeed = max(0.4, uWindSpeed * 0.70);
        float frontNoise = tNoise(p * 0.045 - windDir * (uTime * gustSpeed * 0.18));
        float gustPhase = dot(p, windDir) * 0.075 - uTime * gustSpeed + frontNoise * 2.4;
        float gustFront = smoothstep(0.12, 0.88, sin(gustPhase) * 0.5 + 0.5);
        float crossRipple = cos(dot(p, perpDir) * 0.16 - uTime * (gustSpeed * 0.55));
        float windShadow = clamp(gustFront * 0.78 + (crossRipple * 0.5 + 0.5) * 0.22 * uGustiness, 0.0, 1.0);

        float NdotL = clamp(dot(N, L), 0.0, 1.0);
        float cloudSun = mix(1.0, sampleCloudShadowAtXZ(p.x, p.y, uTime, uCloudCoverage, 0.65), 0.40);
        float diffuse = (NdotL * 0.48 + 0.54) * cloudSun;

        // Rich Perlin/FBM clover carpets, sunlit spring meadow, wild-thyme hollows, and organic earth/loam mottling
        vec3 baseMeadow = vVertexColor * detailMod;
        float farMottle = tFbm(p * 0.085 + vec2(3.7, 1.9));
        float cloverMacro = tFbm(p * 0.22 + vec2(5.1, 11.3));
        float cloverMicro = tNoise(p * 18.5 + vec2(2.4, 9.8));
        float earthMottle = smoothstep(0.66, 0.90, tFbm(p * 0.17 + vec2(19.7, 3.4)));
        float wheatPatch = smoothstep(0.58, 0.84, tNoise(p * 0.14 + vec2(8.3, 4.1)));

        vec3 cloverDark = vec3(0.048, 0.175, 0.042);
        vec3 cloverLush = vec3(0.11, 0.29, 0.068);
        vec3 cloverCol = mix(cloverDark, cloverLush, smoothstep(0.25, 0.78, cloverMicro));
        vec3 wheatOlive = vec3(0.32, 0.35, 0.105);
        vec3 organicLoam = mix(vec3(0.15, 0.12, 0.075), vec3(0.24, 0.19, 0.12), fiberMed);

        vec3 naturalMeadow = mix(
          baseMeadow * vec3(0.74, 0.88, 0.68),
          baseMeadow * vec3(1.08, 1.06, 0.80),
          smoothstep(0.22, 0.78, farMottle)
        );
        naturalMeadow = mix(naturalMeadow, cloverCol, smoothstep(0.38, 0.76, cloverMacro) * 0.52);
        naturalMeadow = mix(naturalMeadow, wheatOlive, wheatPatch * 0.20);
        naturalMeadow = mix(naturalMeadow, organicLoam, earthMottle * (0.24 + 0.14 * (1.0 - N.y)));

        vec3 shadedMeadow = mix(naturalMeadow * vec3(0.78, 0.90, 0.80), naturalMeadow * vec3(1.10, 1.07, 0.88), windShadow);
        vec3 skyBounce = vec3(0.032, 0.095, 0.075) * (1.0 - NdotL) * 0.35;
        vec3 grassCol = shadedMeadow * diffuse + skyBounce;

        // Organic domain-warped road, plaza, promenade & hillside rill verges
        float coastZ = -31.0 + sin(p.x * 0.028) * 3.2;
        float roadCenterX = sin(p.y * 0.068 + 0.5) * 4.2;
        float edgeWarp = (tFbm(p * 0.92) - 0.5) * 0.68 + (tNoise(p * 3.4) - 0.5) * 0.24;
        float distToRoad = abs(p.x - roadCenterX) + edgeWarp * 0.45;
        float roadHalfW = mix(1.95, 2.35, smoothstep(-10.0, 22.0, p.y));
        float roadSpan = smoothstep(coastZ + 0.8, coastZ + 2.4, p.y) * (1.0 - smoothstep(42.0, 50.0, p.y));
        float roadMask = (1.0 - smoothstep(roadHalfW - 0.55, roadHalfW + 0.35, distToRoad)) * roadSpan;

        // Bakery cobblestone terrace plaza around (-4.5..9.5, -19..-8)
        float plazaX = smoothstep(-6.2, -3.6, p.x + edgeWarp * 0.35) * (1.0 - smoothstep(8.2, 10.6, p.x + edgeWarp * 0.35));
        float plazaZ = smoothstep(-19.8, -17.4, p.y + edgeWarp * 0.35) * (1.0 - smoothstep(-8.8, -6.8, p.y + edgeWarp * 0.35));
        float plazaMask = plazaX * plazaZ;

        // Seaside stone promenade hugging the seawall (coastZ + 1.0 .. coastZ + 4.4)
        float promMask = smoothstep(coastZ + 0.7, coastZ + 1.5, p.y)
                       * (1.0 - smoothstep(coastZ + 3.5, coastZ + 5.0, p.y + edgeWarp * 0.35))
                       * (1.0 - smoothstep(46.0, 56.0, abs(p.x)));

        float pathMask = clamp(max(max(roadMask, plazaMask), promMask), 0.0, 1.0);

        // Crushed river-gravel & sandy-loam bedding under the 3D cobblestone mesh
        float gravelMacro = tFbm(p * 2.2);
        float pebbleGrain = tNoise(p * 18.0) * 0.6 + tNoise(p * 52.0) * 0.4;
        float pebbleSpeck = smoothstep(0.66, 0.90, tNoise(p * 34.0 + vec2(1.7, 5.3)));
        vec3 loamBase = mix(vec3(0.20, 0.17, 0.13), vec3(0.31, 0.27, 0.22), gravelMacro);
        vec3 crushedGravel = mix(loamBase, vec3(0.38, 0.35, 0.30), smoothstep(0.35, 0.78, pebbleGrain));
        crushedGravel = mix(crushedGravel, vec3(0.46, 0.43, 0.38), pebbleSpeck * 0.35);
        vec3 roadBedCol = crushedGravel * (0.62 + 0.40 * NdotL);

        // Wide, irregular gravel / clover / fallen oak-leaf / sandy-loam road-verge transition
        float innerVerge = smoothstep(roadHalfW - 0.85, roadHalfW - 0.05, distToRoad)
                         * (1.0 - smoothstep(roadHalfW - 0.05, roadHalfW + 0.85, distToRoad))
                         * roadSpan;
        float outerVerge = smoothstep(roadHalfW - 0.25, roadHalfW + 0.45, distToRoad)
                         * (1.0 - smoothstep(roadHalfW + 0.45, roadHalfW + 1.95, distToRoad))
                         * roadSpan;
        float vergeCloverMask = smoothstep(0.34, 0.72, tFbm(p * 1.95 + vec2(4.2, 9.1)));
        float cloverLeafCluster = smoothstep(0.58, 0.84, tNoise(p * 14.5 + vec2(2.1, 6.7)));
        float oakLeafFleck = smoothstep(0.74, 0.92, tNoise(p * 19.0 + vec2(8.4, 3.3))) * nearDetail;
        vec3 sandyLoamCol = mix(vec3(0.22, 0.18, 0.13), vec3(0.34, 0.29, 0.22), pebbleGrain) * (0.60 + 0.42 * NdotL);
        sandyLoamCol = mix(sandyLoamCol, vec3(0.42, 0.39, 0.34), pebbleSpeck * 0.42 * (0.60 + 0.42 * NdotL));
        vec3 vergeCloverCol = mix(vec3(0.055, 0.165, 0.042), vec3(0.145, 0.30, 0.078), mix(fiberFine, cloverLeafCluster, 0.55)) * (0.62 + 0.42 * NdotL);
        vec3 vergeBlendCol = mix(sandyLoamCol, vergeCloverCol, vergeCloverMask * 0.72);
        vec3 oakLeafCol = mix(vec3(0.32, 0.19, 0.08), vec3(0.46, 0.28, 0.11), tNoise(p * 37.0)) * (0.62 + 0.40 * NdotL);
        vergeBlendCol = mix(vergeBlendCol, oakLeafCol, oakLeafFleck * 0.72);

        vec3 finalCol = mix(grassCol, roadBedCol, pathMask * 0.88);
        finalCol = mix(finalCol, sandyLoamCol, innerVerge * 0.76);
        finalCol = mix(finalCol, vergeBlendCol, outerVerge * 0.72);

        // Terraced hillside rill stream-bank pebble & mossy loam shading synced with getGhibliRillCenterX(z)
        float rillCenterX = 19.2 - 6.8 * tanh((p.y + 3.0) * 0.085) + sin(p.y * 0.12) * 0.7;
        float rillSpan = smoothstep(-24.0, -19.0, p.y) * (1.0 - smoothstep(23.0, 28.0, p.y));
        float distRill = abs(p.x - rillCenterX) + edgeWarp * 0.28;
        float rillBank = (1.0 - smoothstep(0.65, 2.15, distRill)) * rillSpan;
        vec3 bankMossStone = mix(vec3(0.11, 0.16, 0.09), vec3(0.22, 0.21, 0.17), pebbleGrain) * (0.60 + 0.40 * NdotL);
        finalCol = mix(finalCol, bankMossStone, rillBank * 0.78);

        // Coastal rocky sandstone/granite cliff face near seawall dropoff & western cape
        float cliffBand = smoothstep(coastZ + 1.4, coastZ - 2.0, p.y);
        float capeBand = smoothstep(52.0, 66.0, -p.x) * smoothstep(-14.0, -28.0, p.y);
        float cliffStrata = tNoise(vec2(p.x * 0.65, vWorldPosition.y * 2.4 + tNoise(p * 0.4) * 1.5));
        vec3 cliffStone = mix(vec3(0.18, 0.17, 0.15), vec3(0.32, 0.29, 0.25), cliffStrata) * (0.68 + 0.42 * NdotL);
        finalCol = mix(finalCol, cliffStone, clamp(max(cliffBand * 0.90, capeBand * 0.55), 0.0, 0.92));

        gl_FragColor = vec4(finalCol, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Layered pastel distant coastal islands & inland hillside ridges (linear RGB calibrated).
 */
export function createGhibliDistantHillMaterial(
  baseColorHex: string,
  crestColorHex: string,
  mistColorHex: string,
  sunDirection: THREE.Vector3,
  seed: number,
  isCoastalIsland = false
): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uBaseColor: { value: new THREE.Color(baseColorHex) },
      uCrestColor: { value: new THREE.Color(crestColorHex) },
      uMistColor: { value: new THREE.Color(mistColorHex) },
      uSunDirection: { value: sunDirection.clone().normalize() },
      uSeed: { value: seed },
      uIsCoastalIsland: { value: isCoastalIsland ? 1.0 : 0.0 }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aYRatio;
      varying float vYRatio;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vYRatio = aYRatio;
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
      uniform vec3 uBaseColor;
      uniform vec3 uCrestColor;
      uniform vec3 uMistColor;
      uniform vec3 uSunDirection;
      uniform float uSeed;
      uniform float uIsCoastalIsland;

      varying float vYRatio;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      float hHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.12);
        return fract(p.x * p.y);
      }

      float hNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hHash(i), hHash(i + vec2(1.0, 0.0)), u.x),
          mix(hHash(i + vec2(0.0, 1.0)), hHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float hFbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * hNoise(p);
          p = p * 2.04 + vec2(13.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      float hRidged(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          float n = 1.0 - abs(hNoise(p) * 2.0 - 1.0);
          v += a * (n * n);
          p = rot * p * 2.12 + vec2(19.3, 7.7);
          a *= 0.5;
        }
        return v;
      }

      float cliffRelief(vec3 wp, float seed) {
        float bigRidge = hRidged(wp.xz * 0.09 + vec2(seed * 2.3, wp.y * 0.06));
        float medCrag = hRidged(wp.xz * 0.28 + vec2(wp.y * 0.32, seed * 5.1));
        float fineLedge = hNoise(vec2(wp.x * 0.45 + wp.z * 0.35, wp.y * 1.15));
        return bigRidge * 0.52 + medCrag * 0.34 + fineLedge * 0.14;
      }

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 L = normalize(uSunDirection);
        float camDist = length(cameraPosition - vWorldPosition);

        // 3D finite-difference rock crag normal perturbation for razor-sharp sunlit facets & couloirs
        float eps = 0.42;
        float rC = cliffRelief(vWorldPosition, uSeed);
        float rX = cliffRelief(vWorldPosition + vec3(eps, 0.0, 0.0), uSeed);
        float rY = cliffRelief(vWorldPosition + vec3(0.0, eps, 0.0), uSeed);
        float rZ = cliffRelief(vWorldPosition + vec3(0.0, 0.0, eps), uSeed);
        vec3 grad = vec3(rC - rX, rC - rY, rC - rZ) / eps;

        float macroFbm = hFbm(vWorldPosition.xz * 0.065 + vec2(uSeed * 3.1));
        float strataWave = hNoise(vec2(vWorldPosition.x * 0.14 + vWorldPosition.z * 0.12, vWorldPosition.y * 0.78 + macroFbm * 2.6));
        float strataCrack = smoothstep(0.76, 0.96, 1.0 - abs(strataWave * 2.0 - 1.0));
        float crossFissure = smoothstep(0.80, 0.97, 1.0 - abs(hNoise(vWorldPosition.xz * 0.52 + vec2(vWorldPosition.y * 0.68, uSeed)) * 2.0 - 1.0));
        float creviceAO = clamp(1.0 - (strataCrack * 0.48 + crossFissure * 0.34 + (1.0 - rC) * 0.26), 0.28, 1.0);

        float slopeSteepness = clamp(1.0 - abs(baseN.y), 0.0, 1.0);
        float mountainRock = smoothstep(0.28, 0.64, vYRatio + (rC - 0.48) * 0.42 + (slopeSteepness - 0.52) * 0.45);
        float islandRock = smoothstep(0.22, 0.54, slopeSteepness * 0.65 + (rC - 0.45) * 0.45 + smoothstep(0.48, 0.88, vYRatio) * 0.35);
        float seaCliffBand = uIsCoastalIsland > 0.5 ? (1.0 - smoothstep(0.06, 0.38, vYRatio)) : 0.0;
        float rockMask = uIsCoastalIsland > 0.5
          ? clamp(max(islandRock, seaCliffBand * 0.94), 0.0, 1.0)
          : clamp(mountainRock, 0.0, 1.0);

        // Apply stronger micro-normal perturbation on rocky cliffs, subtler on grassy/forested slopes
        vec3 pertN = normalize(baseN + grad * mix(0.75, 1.45, rockMask));
        float NdotL = clamp(dot(pertN, L), 0.0, 1.0);

        // Crisp evergreen conifer tree-crown stippling (eliminates blurry low-freq green smudges)
        float pineCanopyMacro = hFbm(vWorldPosition.xz * 0.16 + vec2(uSeed * 7.3, vYRatio * 1.4));
        float pineCluster = hNoise(vWorldPosition.xz * 0.95 + vec2(vYRatio * 2.4, uSeed));
        float pineCrown = hNoise(vWorldPosition.xz * 2.65 + vec2(vYRatio * 4.2));
        float pineMask = smoothstep(0.32, 0.58, pineCanopyMacro + (pineCluster - 0.5) * 0.28)
                       * (1.0 - smoothstep(0.58, 0.84, vYRatio))
                       * (1.0 - rockMask * 0.78);
        float pineCrownShade = smoothstep(0.20, 0.82, pineCluster * 0.55 + pineCrown * 0.45);
        vec3 pineDark = vec3(0.016, 0.062, 0.024);
        vec3 pineLit = vec3(0.064, 0.175, 0.056);
        vec3 pineCol = mix(pineDark, pineLit, pineCrownShade);

        float detailNoise = hNoise(vWorldPosition.xz * 1.45 + vec2(vYRatio * 8.0));
        vec3 pastureCol = mix(uBaseColor * 0.82, uCrestColor, smoothstep(0.22, 0.82, macroFbm * 0.55 + detailNoise * 0.45));

        // High-contrast fractured granite rock with stratified ledges, mineral speckling & dark crevices
        float strataLedge = smoothstep(0.25, 0.78, strataWave);
        float quartzGrain = hNoise(vWorldPosition.xz * 2.2 + vec2(vYRatio * 6.5));
        vec3 rockDark = vec3(0.11, 0.12, 0.14);
        vec3 rockLit = vec3(0.42, 0.40, 0.36);
        vec3 rockCol = mix(rockDark, rockLit, clamp(strataLedge * 0.55 + rC * 0.35 + quartzGrain * 0.18, 0.0, 1.0));
        if (uIsCoastalIsland > 0.5) {
          float wetBase = 1.0 - smoothstep(0.0, 0.14, vYRatio);
          rockCol *= mix(1.0, 0.48, wetBase);
        }

        vec3 hill = mix(pastureCol, pineCol, pineMask * 0.88);
        hill = mix(hill, rockCol, rockMask * 0.94);
        hill *= creviceAO;

        // Crisp sunlight & cool cerulean sky shadow contrast
        vec3 sunLit = vec3(1.04, 1.01, 0.95) * (0.36 + 0.84 * NdotL);
        vec3 skyShadow = vec3(0.045, 0.085, 0.145) * (1.0 - NdotL);
        hill = hill * sunLit + skyShadow * (0.35 + 0.65 * rockMask);

        // Breaking whitewater surf spray along the coastal island cliff waterline
        if (uIsCoastalIsland > 0.5) {
          float sprayNoise = hFbm(vWorldPosition.xz * 0.48 + vec2(uTime * 0.25, -uTime * 0.18));
          float splashPulse = 0.68 + 0.32 * sin(uTime * 2.1 + vWorldPosition.x * 0.28 + sprayNoise * 3.0);
          float surfLine = (1.0 - smoothstep(0.015, 0.10, vYRatio)) * smoothstep(0.22, 0.66, sprayNoise + 0.20) * splashPulse;
          vec3 sprayWhite = vec3(0.92, 0.96, 0.99);
          hill = mix(hill, sprayWhite, clamp(surfLine * 0.94, 0.0, 0.94));
        }

        // Subtle crisp atmospheric perspective (kept restrained so crags & foliage stay sharp)
        float distHaze = smoothstep(130.0, 290.0, camDist) * (uIsCoastalIsland > 0.5 ? 0.16 : 0.22);
        float baseMist = (1.0 - smoothstep(0.0, 0.15, vYRatio)) * (uIsCoastalIsland > 0.5 ? 0.18 : 0.42);
        vec3 aerialColor = mix(uMistColor, vec3(0.60, 0.80, 0.96), 0.48);
        hill = mix(hill, aerialColor, clamp(baseMist * 0.22 + distHaze, 0.0, 0.34));

        gl_FragColor = vec4(hill, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Animated fluttering coastal laundry clothesline shader (fog-safe).
 */
export function createGhibliClothMaterial(): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uWindSpeed: { value: 2.2 },
      uSunDirection: { value: new THREE.Vector3(48, 66, 36).normalize() }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexColors: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWindSpeed;

      varying vec3 vColor;
      varying vec3 vNormal;

      void main() {
        #ifdef USE_COLOR
        vColor = color;
        #else
        vColor = vec3(0.92, 0.88, 0.80);
        #endif

        // uv.y = 1.0 at top edge pinned to rope, 0.0 at bottom hem
        float flutterWeight = 1.0 - uv.y;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);

        float wave1 = sin(uTime * (uWindSpeed * 1.8) + worldPos.x * 1.4 + uv.x * 4.5);
        float wave2 = cos(uTime * (uWindSpeed * 2.7) + worldPos.z * 1.7 + uv.y * 3.0);
        float gust = 0.65 + 0.35 * sin(uTime * 0.9 + worldPos.x * 0.4);

        worldPos.z += (wave1 * 0.22 + wave2 * 0.11) * flutterWeight * gust;
        worldPos.x += wave2 * 0.08 * flutterWeight * gust;
        worldPos.y += abs(wave1) * 0.06 * flutterWeight;

        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;

      varying vec3 vColor;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDirection);
        float light = clamp(abs(dot(N, L)), 0.0, 1.0) * 0.38 + 0.72;
        gl_FragColor = vec4(vColor * light, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Instanced soaring white seagulls shader (fog-safe, wing-flap driven by uv.x).
 */
export function createGhibliSeagullMaterial(): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uSunDirection: { value: new THREE.Vector3(48, 66, 36).normalize() }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;

      varying float vWingSpan;
      varying vec3 vNormal;

      void main() {
        vWingSpan = abs(uv.x - 0.5) * 2.0;

        vec3 anchor = vec3(0.0);
        #ifdef USE_INSTANCING
        anchor = vec3(instanceMatrix[3].xyz);
        #endif
        float phase = fract(sin(dot(anchor.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.28318;

        // Smooth natural gull wingbeats interspersed with brief gliding pauses
        float glideMask = smoothstep(-0.35, 0.35, sin(uTime * 0.55 + phase * 2.0));
        float flap = sin(uTime * 6.2 + phase * 4.0) * (0.35 + 0.65 * glideMask);

        vec3 p = position;
        p.y += vWingSpan * flap * 0.28;

        #ifdef USE_INSTANCING
        vec4 worldPos = instanceMatrix * vec4(p, 1.0);
        vNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);
        #else
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        #endif

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;

      varying float vWingSpan;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDirection);
        float diffuse = clamp(dot(N, L) * 0.5 + 0.5, 0.45, 1.0);

        // Crisp sunlit white gulls with soft slate-grey wingtips (linear RGB)
        vec3 gullWhite = vec3(0.92, 0.91, 0.88);
        vec3 gullTip = vec3(0.24, 0.28, 0.34);
        vec3 col = mix(gullWhite, gullTip, smoothstep(0.76, 1.0, vWingSpan)) * diffuse;

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `
  });
}

/**
 * Soft gouache chimney smoke puffs rising gently from the bakery & hillside cottages.
 */
export function createGhibliChimneySmokeMaterial(windDir: THREE.Vector2): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0.0 },
      uWindDirection: { value: windDir.clone().normalize() }
    }
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform vec2 uWindDirection;
      attribute float aPhase;
      varying float vLife;

      void main() {
        float life = fract(uTime * 0.11 + aPhase);
        vLife = life;

        vec3 p = position;
        p.y += life * 8.2;
        float wave = sin(uTime * 0.8 - life * 4.8 + position.x * 0.35);
        p.x += uWindDirection.x * life * 4.2 + wave * (0.2 + life * 0.7);
        p.z += uWindDirection.y * life * 4.2 + cos(uTime * 0.65 - life * 4.2 + position.z * 0.35) * (0.18 + life * 0.55);

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((460.0 + life * 820.0) / max(-mvPosition.z, 1.0), 10.0, 48.0);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vLife;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float soft = pow(max(0.0, 1.0 - d * 2.0), 1.65);
        float fade = sin(vLife * 3.14159);
        vec3 col = mix(vec3(0.88, 0.85, 0.80), vec3(0.94, 0.96, 0.98), smoothstep(0.1, 0.5, vLife));
        gl_FragColor = vec4(col, soft * fade * 0.24);
        #include <fog_fragment>
      }
    `
  });
}
