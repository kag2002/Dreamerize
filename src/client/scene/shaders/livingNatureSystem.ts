import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CLOUD_SHADOW_GLSL } from './volumetricCloudShader';

/* -------------------------------------------------------------------------- */
/* 1. Gust-Front Travelling Wave Grass Material                               */
/* -------------------------------------------------------------------------- */

export interface GustWindGrassOptions {
  bladeHeight?: number;
  swayStrength?: number;
  warmTip?: THREE.ColorRepresentation;
  coolRoot?: THREE.ColorRepresentation;
  sunDir?: THREE.Vector3;
  fadeStart?: number;
  fadeEnd?: number;
}

export const gustWindGrassVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  uniform float uBladeHeight;
  uniform float uSwayStrength;
  uniform vec2 uWindDir;
  uniform float uGustSpeed;
  uniform float uFadeStart;
  uniform float uFadeEnd;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vGustWave;
  varying float vBladeHash;
  varying float vPatchNoise;
  varying vec3 vInstanceColor;

  float _gwHash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float _gwNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(_gwHash21(i), _gwHash21(i + vec2(1.0, 0.0)), u.x),
      mix(_gwHash21(i + vec2(0.0, 1.0)), _gwHash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vUv = uv;
    vInstanceColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
    vInstanceColor = instanceColor;
    #endif

    vec3 localPos = position;

    #ifdef USE_INSTANCING
    vec3 rootWorld = vec3(instanceMatrix[3].xyz);
    #else
    vec3 rootWorld = vec3(modelMatrix[3].xyz);
    #endif

    // Optional GPU distance culling fade for large-scale maps (uFadeEnd <= 0.0 keeps full range)
    float distScale = 1.0;
    if (uFadeEnd > 0.0) {
      float camDist = length(rootWorld.xz - cameraPosition.xz);
      distScale = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
      localPos.xyz *= distScale;
    }

    // Deterministic per-blade & macro-patch hashes for height & tint variation
    float bladeHash = _gwHash21(floor(rootWorld.xz * 19.37) + rootWorld.xz * 0.73);
    float patchNoise = _gwNoise2D(rootWorld.xz * 0.085);
    vBladeHash = bladeHash;
    vPatchNoise = patchNoise;

    float hNorm = clamp(uv.y, 0.0, 1.0);
    float heightVar = mix(0.74, 1.30, bladeHash) * mix(0.88, 1.14, patchNoise);
    localPos.y *= heightVar;

    #ifdef USE_INSTANCING
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);
    #else
    vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
    #endif

    vec2 windDir = normalize(uWindDir);
    vec2 perpDir = vec2(-windDir.y, windDir.x);

    // Propagating gust-front travelling wave sweeping across world X/Z
    float frontNoise = _gwNoise2D(worldPos.xz * 0.045 - windDir * (uTime * uGustSpeed * 0.18));
    float gustPhase = dot(worldPos.xz, windDir) * 0.075 - uTime * uGustSpeed + frontNoise * 2.4;
    float gustFront = smoothstep(0.12, 0.88, sin(gustPhase) * 0.5 + 0.5);

    // Secondary ripple & high-frequency individual blade flutter
    float ripple = sin(dot(worldPos.xz, windDir) * 0.34 - uTime * (uGustSpeed * 1.9) + frontNoise * 3.1);
    float flutter = sin(dot(worldPos.xz, perpDir) * 0.62 - uTime * 4.2 + bladeHash * 6.2831);
    float combinedWind = (0.22 + gustFront * 0.95) + ripple * 0.24 * (0.4 + gustFront) + flutter * 0.12;
    vGustWave = gustFront;

    float flex = hNorm * hNorm;
    float swayAmp = uSwayStrength * max(uBladeHeight, 0.25) * 0.58;
    vec2 horizOffset = (windDir * combinedWind + perpDir * (flutter * 0.22)) * swayAmp * flex * distScale;
    worldPos.xz += horizOffset;

    // Preserve blade arc length as the tip bends downwind
    float horizLenSq = dot(horizOffset, horizOffset);
    worldPos.y -= horizLenSq * 0.42 * flex;

    vWorldPos = worldPos.xyz;

    #ifdef USE_INSTANCING
    vec3 nrm = (instanceMatrix * vec4(normal, 0.0)).xyz;
    #else
    vec3 nrm = (modelMatrix * vec4(normal, 0.0)).xyz;
    #endif
    nrm.xz += windDir * combinedWind * 0.55 * hNorm;
    vNormal = normalize(nrm);

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const gustWindGrassFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform vec3 uWarmTip;
  uniform vec3 uCoolRoot;
  uniform vec3 uSunDir;
  uniform float uCloudCoverage;
  uniform float uCloudShadowStrength;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vGustWave;
  varying float vBladeHash;
  varying float vPatchNoise;
  varying vec3 vInstanceColor;

  ${CLOUD_SHADOW_GLSL}

  void main() {
    float h = clamp(vUv.y, 0.0, 1.0);

    // Per-blade and macro-patch palette variation so meadow never looks uniform
    vec3 warmAlt = mix(uWarmTip, uWarmTip * vec3(1.10, 0.95, 0.72), vBladeHash);
    vec3 rootCol = mix(uCoolRoot * 0.85, uCoolRoot * 1.12, vPatchNoise);
    vec3 tipCol = mix(uWarmTip * 0.88, warmAlt, 0.55 + 0.45 * vPatchNoise);

    vec3 baseAlbedo = mix(rootCol, tipCol, smoothstep(0.05, 0.96, h)) * vInstanceColor;

    // Gust-front crest catchlight as blades lean into the sun
    baseAlbedo *= 1.0 + vGustWave * smoothstep(0.35, 1.0, h) * 0.16;

    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) {
      N = -N;
    }
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // Grounded root ambient occlusion
    float rootAO = mix(0.38, 1.0, smoothstep(0.0, 0.48, h));

    // Synchronized overhead cloud shadow modulation
    float cloudSun = mix(
      1.0,
      sampleCloudShadowAtXZ(vWorldPos.x, vWorldPos.z, uTime, uCloudCoverage, 1.0),
      uCloudShadowStrength
    );

    // Wrap diffuse for soft botanical shading
    float NdotL = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
    float diffuse = mix(0.42, 1.08, NdotL) * cloudSun;

    // Backlit subsurface scattering translucency through thin grass tips
    float backLit = pow(clamp(dot(-V, L), 0.0, 1.0), 2.6);
    float grazing = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 1.5);
    float sssMask = smoothstep(0.22, 1.0, h);
    vec3 sssGlow = uWarmTip * vec3(1.22, 1.18, 0.75) * (backLit * 0.58 + grazing * 0.14) * sssMask * cloudSun;

    vec3 color = baseAlbedo * diffuse * rootAO + sssGlow * rootAO;
    gl_FragColor = vec4(color, 1.0);

    #include <fog_fragment>
  }
`;

/**
 * Creates a reusable instanced grass ShaderMaterial with propagating gust-front
 * travelling waves, per-blade color/height variation, and backlit subsurface scattering.
 */
export function createGustWindGrassMaterial(
  options?: GustWindGrassOptions
): THREE.ShaderMaterial {
  const bladeHeight = options?.bladeHeight ?? 0.85;
  const swayStrength = options?.swayStrength ?? 0.9;
  const warmTip = new THREE.Color(options?.warmTip ?? '#a6e34f');
  const coolRoot = new THREE.Color(options?.coolRoot ?? '#1e4d2b');
  const sunDir = (options?.sunDir ?? new THREE.Vector3(0.55, 0.68, 0.48))
    .clone()
    .normalize();

  const customUniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uBladeHeight: { value: bladeHeight },
    uSwayStrength: { value: swayStrength },
    uWindDir: { value: new THREE.Vector2(0.88, 0.47).normalize() },
    uGustSpeed: { value: 1.55 },
    uWarmTip: { value: warmTip },
    uCoolRoot: { value: coolRoot },
    uSunDir: { value: sunDir },
    uCloudCoverage: { value: 0.52 },
    uCloudShadowStrength: { value: 0.4 },
    uFadeStart: { value: options?.fadeStart ?? 0.0 },
    uFadeEnd: { value: options?.fadeEnd ?? 0.0 }
  };

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, customUniforms]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: gustWindGrassVertexShader,
    fragmentShader: gustWindGrassFragmentShader,
    side: THREE.DoubleSide,
    fog: true
  });
}

/* -------------------------------------------------------------------------- */
/* 2. Procedural Pine Cluster Geometry                                        */
/* -------------------------------------------------------------------------- */

export interface ProceduralPineClusterOptions {
  tiers?: number;
  radius?: number;
  height?: number;
  radialSegments?: number;
  droop?: number;
  seed?: number;
}

function deterministicHash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Generates an organic multi-tiered evergreen pine bough cluster BufferGeometry
 * with scalloped branch lobes, gravity droop, UVs, normals, and deep-to-tip vertex colors.
 */
export function createProceduralPineClusterGeometry(
  options?: ProceduralPineClusterOptions
): THREE.BufferGeometry {
  const tiers = Math.max(2, Math.floor(options?.tiers ?? 5));
  const baseRadius = Math.max(0.2, options?.radius ?? 1.8);
  const totalHeight = Math.max(0.5, options?.height ?? 4.2);
  const radialSegs = Math.max(8, Math.floor(options?.radialSegments ?? 14));
  const droop = options?.droop ?? 0.28;
  const seed = options?.seed ?? 1.0;

  const tierGeometries: THREE.BufferGeometry[] = [];
  const darkInner = new THREE.Color('#16311f');
  const outerNeedle = new THREE.Color('#3b6f38');
  const tipHighlight = new THREE.Color('#5a8f49');
  const workColor = new THREE.Color();

  for (let t = 0; t < tiers; t++) {
    const tierFrac = t / Math.max(tiers - 1, 1);
    const tierBottomY = totalHeight * (t / (tiers + 0.45)) * 0.86;
    const tierHeight = (totalHeight / tiers) * (1.35 - tierFrac * 0.25);
    const tierRadius = baseRadius * (1.0 - tierFrac * 0.68);
    const lobeCount = 5 + ((t + Math.floor(seed * 3)) % 3);
    const tierPhase = seed * 2.13 + t * 1.47;

    const cone = new THREE.ConeGeometry(tierRadius, tierHeight, radialSegs, 3, false);
    cone.translate(0, tierBottomY + tierHeight * 0.5, 0);

    const posAttr = cone.getAttribute('position') as THREE.BufferAttribute;
    const uvAttr = cone.getAttribute('uv') as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      let vx = posAttr.getX(i);
      let vy = posAttr.getY(i);
      let vz = posAttr.getZ(i);

      const radialDist = Math.hypot(vx, vz);
      const radialNorm = tierRadius > 1e-4 ? Math.min(1, radialDist / tierRadius) : 0;
      const angle = Math.atan2(vz, vx);

      if (radialNorm > 0.05) {
        const lobeWave = 0.82 + 0.26 * Math.sin(angle * lobeCount + tierPhase);
        const microJitter = 0.90 + 0.20 * deterministicHash(i * 1.37 + t * 19.1 + seed * 7.7);
        const scaleXZ = lobeWave * microJitter;
        vx *= scaleXZ;
        vz *= scaleXZ;

        // Branch tip droop + slight upward curl near crown apex
        const droopAmount = droop * Math.pow(radialNorm, 1.55) * (1.0 - tierFrac * 0.55);
        vy -= droopAmount * (0.75 + 0.5 * deterministicHash(i + t * 31.0));
      }

      posAttr.setXYZ(i, vx, vy, vz);

      const heightNorm = Math.max(0, Math.min(1, vy / totalHeight));
      uvAttr.setY(i, heightNorm);

      // Rich evergreen shading: dark shadowed underside, bright fresh outer tips
      workColor.copy(darkInner).lerp(outerNeedle, Math.pow(radialNorm, 0.75) * 0.78 + heightNorm * 0.22);
      if (heightNorm > 0.6) {
        workColor.lerp(tipHighlight, (heightNorm - 0.6) * 1.15);
      }
      colors[i * 3] = workColor.r;
      colors[i * 3 + 1] = workColor.g;
      colors[i * 3 + 2] = workColor.b;
    }

    cone.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const nonIndexed = cone.toNonIndexed();
    cone.dispose();
    tierGeometries.push(nonIndexed);
  }

  const merged = mergeGeometries(tierGeometries, false);
  for (const g of tierGeometries) {
    g.dispose();
  }

  if (!merged) {
    // Fallback safety if merge ever fails
    const fallback = new THREE.ConeGeometry(baseRadius, totalHeight, radialSegs, 2);
    fallback.translate(0, totalHeight * 0.5, 0);
    fallback.computeVertexNormals();
    return fallback;
  }

  merged.computeVertexNormals();
  return merged;
}

/* -------------------------------------------------------------------------- */
/* 3. GPU-Instanced Living Boids System                                       */
/* -------------------------------------------------------------------------- */

export type LivingBoidKind = 'bird' | 'butterfly' | 'firefly' | 'petal';

export interface LivingBoidsOptions {
  count: number;
  boundsRadius: number;
  minY: number;
  maxY: number;
  kind: LivingBoidKind;
  colorA?: number;
  colorB?: number;
}

export interface LivingBoidsHandle {
  mesh: THREE.InstancedMesh;
  update: (delta: number, elapsed: number, focusCenter?: THREE.Vector3) => void;
  dispose: () => void;
}

function buildBoidGeometry(kind: LivingBoidKind): THREE.BufferGeometry {
  if (kind === 'bird') {
    // Stylized V-wing bird silhouette: forward along +Z, wing span along +/-X
    const positions = new Float32Array([
      // Body spine diamond
      0.0, 0.02, 0.34, -0.06, 0.0, 0.0, 0.0, -0.02, -0.30,
      0.0, 0.02, 0.34, 0.0, -0.02, -0.30, 0.06, 0.0, 0.0,
      // Left inner wing
      -0.05, 0.0, 0.12, -0.36, 0.04, 0.02, -0.05, 0.0, -0.14,
      // Left outer wing
      -0.36, 0.04, 0.02, -0.74, 0.01, -0.18, -0.05, 0.0, -0.14,
      // Right inner wing
      0.05, 0.0, 0.12, 0.05, 0.0, -0.14, 0.36, 0.04, 0.02,
      // Right outer wing
      0.36, 0.04, 0.02, 0.05, 0.0, -0.14, 0.74, 0.01, -0.18
    ]);
    const uvs = new Float32Array([
      0.5, 1.0, 0.45, 0.5, 0.5, 0.0,
      0.5, 1.0, 0.5, 0.0, 0.55, 0.5,
      0.45, 0.7, 0.25, 0.5, 0.45, 0.3,
      0.25, 0.5, 0.0, 0.2, 0.45, 0.3,
      0.55, 0.7, 0.55, 0.3, 0.75, 0.5,
      0.75, 0.5, 0.55, 0.3, 1.0, 0.2
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  if (kind === 'butterfly') {
    const positions = new Float32Array([
      // Left forewing
      -0.01, 0.0, 0.14, -0.28, 0.02, 0.18, -0.22, 0.01, -0.02,
      -0.01, 0.0, 0.14, -0.22, 0.01, -0.02, -0.01, 0.0, -0.03,
      // Left hindwing
      -0.01, 0.0, -0.01, -0.20, 0.01, -0.04, -0.14, 0.0, -0.22,
      -0.01, 0.0, -0.01, -0.14, 0.0, -0.22, -0.01, 0.0, -0.16,
      // Right forewing
      0.01, 0.0, 0.14, 0.22, 0.01, -0.02, 0.28, 0.02, 0.18,
      0.01, 0.0, 0.14, 0.01, 0.0, -0.03, 0.22, 0.01, -0.02,
      // Right hindwing
      0.01, 0.0, -0.01, 0.14, 0.0, -0.22, 0.20, 0.01, -0.04,
      0.01, 0.0, -0.01, 0.01, 0.0, -0.16, 0.14, 0.0, -0.22
    ]);
    const uvs = new Float32Array([
      0.5, 0.9, 0.0, 1.0, 0.15, 0.5,
      0.5, 0.9, 0.15, 0.5, 0.5, 0.45,
      0.5, 0.48, 0.18, 0.4, 0.28, 0.0,
      0.5, 0.48, 0.28, 0.0, 0.5, 0.12,
      0.5, 0.9, 0.85, 0.5, 1.0, 1.0,
      0.5, 0.9, 0.5, 0.45, 0.85, 0.5,
      0.5, 0.48, 0.72, 0.0, 0.82, 0.4,
      0.5, 0.48, 0.5, 0.12, 0.72, 0.0
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  if (kind === 'firefly') {
    return new THREE.OctahedronGeometry(0.14, 1);
  }

  // 'petal': delicate ~0.10m x 0.14m curved notched sakura blossom petal with vertex colors
  const cols = 4;
  const rows = 5;
  const vertCount = (cols + 1) * (rows + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const colors = new Float32Array(vertCount * 3);
  const basePink = new THREE.Color('#f9a8d4');
  const tipBlush = new THREE.Color('#fff1f2');
  const workColor = new THREE.Color();

  let ptr = 0;
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const widthEnvelope = 0.05 * Math.sin(Math.pow(v, 0.65) * Math.PI * 0.82 + 0.14);
    const colorMix = Math.pow(v, 1.35);
    workColor.copy(basePink).lerp(tipBlush, colorMix);

    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * 2.0 - 1.0;
      const absU = Math.abs(u);
      const x = u * widthEnvelope;
      const lobeCurve = 0.016 * Math.sin(absU * Math.PI) - 0.022 * Math.exp(-absU * absU * 10.0);
      const z = (v - 0.5) * 0.13 + lobeCurve * (v * v);
      const y = 0.014 * (u * u) + 0.010 * Math.sin(v * Math.PI) - 0.006 * v;

      positions[ptr * 3] = x;
      positions[ptr * 3 + 1] = y;
      positions[ptr * 3 + 2] = z;

      uvs[ptr * 2] = u * 0.5 + 0.5;
      uvs[ptr * 2 + 1] = v;

      colors[ptr * 3] = workColor.r;
      colors[ptr * 3 + 1] = workColor.g;
      colors[ptr * 3 + 2] = workColor.b;
      ptr++;
    }
  }

  const indices: number[] = [];
  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const d = (r + 1) * stride + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function getBoidKindInt(kind: LivingBoidKind): number {
  switch (kind) {
    case 'bird':
      return 0;
    case 'butterfly':
      return 1;
    case 'firefly':
      return 2;
    case 'petal':
      return 3;
  }
}

const boidVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  attribute float aPhase;
  attribute float aVariant;

  uniform float uTime;
  uniform int uKind;

  varying vec2 vUv;
  varying float vPhase;
  varying float vVariant;
  varying vec3 vNormal;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vPhase = aPhase;
    vVariant = aVariant;
    #ifdef USE_COLOR
    vColor = color;
    #else
    vColor = vec3(1.0);
    #endif

    vec3 pos = position;
    vec3 nrm = normal;

    if (uKind == 0) {
      // Bird: articulated flapping + periodic soaring glide
      float span = abs(pos.x);
      float glideCycle = smoothstep(-0.35, 0.35, sin(uTime * 0.55 + aPhase));
      float flapFreq = 7.2 + aVariant * 2.2;
      float flap = sin(uTime * flapFreq + aPhase * 3.0) * (0.35 + 0.65 * glideCycle);
      pos.y += flap * pow(span * 1.35, 1.35) * 0.38;
      pos.z -= abs(flap) * span * 0.08;
    } else if (uKind == 1) {
      // Butterfly: brisk wing hinge flutter around X=0
      float wingDist = abs(pos.x);
      float flutter = sin(uTime * (13.0 + aVariant * 4.0) + aPhase * 5.0);
      float angle = flutter * 0.95;
      float signX = pos.x >= 0.0 ? 1.0 : -1.0;
      float c = cos(angle);
      float s = sin(angle);
      pos.x = signX * wingDist * c;
      pos.y += wingDist * s;
    } else if (uKind == 2) {
      // Firefly: gentle breathing glow pulse scale
      float pulse = 0.72 + 0.45 * pow(0.5 + 0.5 * sin(uTime * 2.6 + aPhase * 4.0), 2.0);
      pos *= pulse;
    } else {
      // Petal: gentle 3D tumbling flutter
      float t = uTime * (2.4 + aVariant * 1.6) + aPhase * 6.28;
      float c = cos(t);
      float s = sin(t);
      float nx = pos.x * c - pos.y * s;
      float ny = pos.x * s + pos.y * c;
      float tilt = sin(t * 0.75 + aVariant * 3.14) * 0.55;
      float ct = cos(tilt);
      float st = sin(tilt);
      float fy = ny * ct - pos.z * st;
      float fz = ny * st + pos.z * ct;
      pos.x = nx;
      pos.y = fy + sin(t * 1.7) * 0.02;
      pos.z = fz;
    }

    vec4 worldPos = vec4(pos, 1.0);
    #ifdef USE_INSTANCING
    worldPos = instanceMatrix * worldPos;
    vNormal = normalize((instanceMatrix * vec4(nrm, 0.0)).xyz);
    #else
    worldPos = modelMatrix * worldPos;
    vNormal = normalize((modelMatrix * vec4(nrm, 0.0)).xyz);
    #endif

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const boidFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform int uKind;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying vec2 vUv;
  varying float vPhase;
  varying float vVariant;
  varying vec3 vNormal;
  varying vec3 vColor;

  void main() {
    vec3 baseCol = mix(uColorA, uColorB, vVariant);

    if (uKind == 2) {
      // Bioluminescent firefly core pulse
      float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.6 + vPhase * 4.0), 2.4);
      vec3 glowCol = mix(baseCol * 0.55, baseCol * 1.65 + vec3(0.18, 0.22, 0.05), pulse);
      gl_FragColor = vec4(glowCol, 0.75 + 0.25 * pulse);
    } else if (uKind == 1) {
      // Butterfly iridescent edge-to-center gradient
      float edgeDist = abs(vUv.x - 0.5) * 2.0;
      vec3 wingCol = mix(uColorA, uColorB, clamp(edgeDist * 0.85 + vVariant * 0.25, 0.0, 1.0));
      float shade = 0.72 + 0.28 * abs(vNormal.y);
      gl_FragColor = vec4(wingCol * shade, 1.0);
    } else if (uKind == 3) {
      // Soft translucent cherry-blossom petal from vertex colors (#f9a8d4 base -> #fff1f2 tip)
      vec3 petalTint = mix(vec3(0.98, 0.88, 0.93), vec3(1.0, 0.96, 0.98), vVariant);
      vec3 petalCol = vColor * petalTint;
      float shade = 0.82 + 0.18 * abs(vNormal.y);
      gl_FragColor = vec4(petalCol * shade, 0.92);
    } else {
      // Bird soft sky-lit plumage shading
      float tipShade = mix(0.75, 1.05, smoothstep(0.0, 1.0, abs(vUv.x - 0.5) * 2.0));
      float topLit = 0.68 + 0.35 * clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(baseCol * tipShade * topLit, 1.0);
    }

    #include <fog_fragment>
  }
`;

function getDefaultBoidColors(kind: LivingBoidKind): [number, number] {
  switch (kind) {
    case 'bird':
      return [0xf2f4f8, 0x5c6d85];
    case 'butterfly':
      return [0xffbe55, 0x67d8ff];
    case 'firefly':
      return [0xd8ff66, 0x6dffb3];
    case 'petal':
      return [0xf9a8d4, 0xfff1f2];
  }
}

/**
 * Creates a single-draw-call GPU-instanced living boids / nature flock system
 * (`'bird' | 'butterfly' | 'firefly' | 'petal'`) with safe NaN-free steering and GPU animation.
 */
export function createLivingBoidsSystem(
  options: LivingBoidsOptions
): LivingBoidsHandle {
  const count = Math.max(1, Math.floor(options.count));
  const boundsRadius = Math.max(1.0, Number.isFinite(options.boundsRadius) ? options.boundsRadius : 30);
  const loY = Number.isFinite(options.minY) ? options.minY : 1;
  const hiY = Math.max(loY + 0.5, Number.isFinite(options.maxY) ? options.maxY : loY + 12);
  const kind = options.kind;

  const [defaultA, defaultB] = getDefaultBoidColors(kind);
  const colorA = new THREE.Color(options.colorA ?? defaultA);
  const colorB = new THREE.Color(options.colorB ?? defaultB);

  const geometry = buildBoidGeometry(kind);
  const phases = new Float32Array(count);
  const variants = new Float32Array(count);

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  const baseSpeed =
    kind === 'bird' ? 6.5 : kind === 'butterfly' ? 2.4 : kind === 'firefly' ? 1.1 : 1.3;

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(deterministicHash(i * 3.1 + 1.0)) * boundsRadius * 0.85;
    const theta = deterministicHash(i * 7.3 + 2.0) * Math.PI * 2.0;
    const yFrac = deterministicHash(i * 11.7 + 3.0);

    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = loY + (hiY - loY) * yFrac;
    positions[i * 3 + 2] = Math.sin(theta) * r;

    const dirTheta = theta + Math.PI * 0.5 + (deterministicHash(i * 5.9) - 0.5) * 0.8;
    velocities[i * 3] = Math.cos(dirTheta) * baseSpeed;
    velocities[i * 3 + 1] = kind === 'petal' ? -0.9 : (deterministicHash(i * 13.1) - 0.5) * 0.6;
    velocities[i * 3 + 2] = Math.sin(dirTheta) * baseSpeed;

    phases[i] = deterministicHash(i * 17.3 + 4.0) * Math.PI * 2.0;
    variants[i] = deterministicHash(i * 23.9 + 5.0);
  }

  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variants, 1));

  const customUniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uKind: { value: getBoidKindInt(kind) },
    uColorA: { value: colorA },
    uColorB: { value: colorB }
  };

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, customUniforms]),
    vertexShader: boidVertexShader,
    fragmentShader: boidFragmentShader,
    side: THREE.DoubleSide,
    transparent: kind === 'firefly' || kind === 'petal',
    depthWrite: kind !== 'firefly',
    vertexColors: kind === 'petal',
    fog: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = `LivingBoids_${kind}`;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const matElements = new Float32Array(16);
  const sepRadiusSq = kind === 'bird' ? 9.0 : 2.25;
  const neighborChecks = Math.min(count - 1, 14);
  const minSpeed = kind === 'petal' ? 0.5 : baseSpeed * 0.55;
  const maxSpeed = kind === 'petal' ? 3.2 : baseSpeed * 1.55;

  const writeSafeInstanceMatrix = (
    idx: number,
    px: number,
    py: number,
    pz: number,
    vx: number,
    vy: number,
    vz: number,
    scale: number
  ): void => {
    let fx = vx;
    let fy = vy;
    let fz = vz;
    let fLen = Math.hypot(fx, fy, fz);
    if (!Number.isFinite(fLen) || fLen < 1e-6) {
      fx = 0;
      fy = 0;
      fz = 1;
      fLen = 1;
    }
    fx /= fLen;
    fy /= fLen;
    fz /= fLen;

    // Choose safe reference up vector to avoid collinear cross product -> NaN
    const useAltUp = Math.abs(fy) > 0.96;
    const upRefX = useAltUp ? 1 : 0;
    const upRefY = useAltUp ? 0 : 1;
    const upRefZ = 0;

    // right = normalize(cross(upRef, forward))
    let rx = upRefY * fz - upRefZ * fy;
    let ry = upRefZ * fx - upRefX * fz;
    let rz = upRefX * fy - upRefY * fx;
    let rLen = Math.hypot(rx, ry, rz);
    if (!Number.isFinite(rLen) || rLen < 1e-6) {
      rx = 1;
      ry = 0;
      rz = 0;
      rLen = 1;
    }
    rx /= rLen;
    ry /= rLen;
    rz /= rLen;

    // trueUp = cross(forward, right)
    const ux = fy * rz - fz * ry;
    const uy = fz * rx - fx * rz;
    const uz = fx * ry - fy * rx;

    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const safePx = Number.isFinite(px) ? px : 0;
    const safePy = Number.isFinite(py) ? py : (loY + hiY) * 0.5;
    const safePz = Number.isFinite(pz) ? pz : 0;

    // Column-major 4x4 matrix
    matElements[0] = rx * s;
    matElements[1] = ry * s;
    matElements[2] = rz * s;
    matElements[3] = 0;

    matElements[4] = ux * s;
    matElements[5] = uy * s;
    matElements[6] = uz * s;
    matElements[7] = 0;

    matElements[8] = fx * s;
    matElements[9] = fy * s;
    matElements[10] = fz * s;
    matElements[11] = 0;

    matElements[12] = safePx;
    matElements[13] = safePy;
    matElements[14] = safePz;
    matElements[15] = 1;

    mesh.instanceMatrix.array.set(matElements, idx * 16);
  };

  // Initialize matrices immediately so first frame before update() is valid
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    writeSafeInstanceMatrix(
      i,
      positions[i3],
      positions[i3 + 1],
      positions[i3 + 2],
      velocities[i3],
      velocities[i3 + 1],
      velocities[i3 + 2],
      0.85 + variants[i] * 0.35
    );
  }
  mesh.instanceMatrix.needsUpdate = true;

  const update = (
    delta: number,
    elapsed: number,
    focusCenter?: THREE.Vector3
  ): void => {
    const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0.0001), 0.05) : 0.016;
    const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0;
    material.uniforms.uTime.value = safeElapsed;

    const cx = focusCenter && Number.isFinite(focusCenter.x) ? focusCenter.x : 0;
    const cz = focusCenter && Number.isFinite(focusCenter.z) ? focusCenter.z : 0;
    const midY = (loY + hiY) * 0.5;
    const cy =
      focusCenter && Number.isFinite(focusCenter.y)
        ? Math.max(loY, Math.min(hiY, focusCenter.y))
        : midY;

    const stride = count > 16 ? Math.max(1, Math.floor(count / 14)) : 1;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let px = positions[i3];
      let py = positions[i3 + 1];
      let pz = positions[i3 + 2];

      let vx = velocities[i3];
      let vy = velocities[i3 + 1];
      let vz = velocities[i3 + 2];

      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
        px = cx;
        py = midY;
        pz = cz;
      }
      if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) {
        vx = baseSpeed;
        vy = 0;
        vz = 0;
      }

      let ax = 0;
      let ay = 0;
      let az = 0;

      if (kind === 'petal') {
        // Gentle swirling breeze + steady downward drift
        const swirl = safeElapsed * 0.9 + phases[i];
        ax += Math.cos(swirl) * 1.35 + (cx - px) * 0.04;
        az += Math.sin(swirl * 0.83) * 1.35 + (cz - pz) * 0.04;
        ay += (-0.95 - vy) * 2.2;
      } else {
        // Sample local neighbor window for smooth O(N) cohesion, alignment & separation
        let sepX = 0;
        let sepY = 0;
        let sepZ = 0;
        let aliX = 0;
        let aliY = 0;
        let aliZ = 0;
        let cohX = 0;
        let cohY = 0;
        let cohZ = 0;
        let neighborCount = 0;

        for (let k = 1; k <= neighborChecks; k++) {
          const j = (i + k * stride) % count;
          if (j === i) continue;
          const j3 = j * 3;
          const dx = px - positions[j3];
          const dy = py - positions[j3 + 1];
          const dz = pz - positions[j3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq > 1e-6 && distSq < sepRadiusSq * 9.0) {
            neighborCount++;
            aliX += velocities[j3];
            aliY += velocities[j3 + 1];
            aliZ += velocities[j3 + 2];
            cohX += positions[j3];
            cohY += positions[j3 + 1];
            cohZ += positions[j3 + 2];

            if (distSq < sepRadiusSq) {
              const invDist = 1.0 / (distSq + 0.05);
              sepX += dx * invDist;
              sepY += dy * invDist;
              sepZ += dz * invDist;
            }
          }
        }

        if (neighborCount > 0) {
          const invN = 1.0 / neighborCount;
          ax += sepX * 3.8 + (aliX * invN - vx) * 0.65 + (cohX * invN - px) * 0.35;
          ay += sepY * 2.6 + (aliY * invN - vy) * 0.55 + (cohY * invN - py) * 0.25;
          az += sepZ * 3.8 + (aliZ * invN - vz) * 0.65 + (cohZ * invN - pz) * 0.35;
        }

        // Gentle orbital / wander curl around focusCenter
        const dxC = px - cx;
        const dzC = pz - cz;
        const horizDist = Math.hypot(dxC, dzC);
        if (kind === 'bird' && horizDist > 0.5) {
          // Tangential soaring pull so birds wheel majestically overhead
          ax += (-dzC / horizDist) * 1.25;
          az += (dxC / horizDist) * 1.25;
        } else {
          const wander = safeElapsed * 1.3 + phases[i] * 2.0;
          ax += Math.cos(wander) * 1.8;
          az += Math.sin(wander * 0.77) * 1.8;
        }

        // Soft radial containment inside boundsRadius
        if (horizDist > boundsRadius * 0.72) {
          const excess = (horizDist - boundsRadius * 0.72) / Math.max(boundsRadius * 0.28, 1.0);
          const pull = excess * 6.5;
          ax -= (dxC / Math.max(horizDist, 1e-4)) * pull;
          az -= (dzC / Math.max(horizDist, 1e-4)) * pull;
        }

        // Vertical ceiling / floor containment
        const yMargin = Math.max((hiY - loY) * 0.15, 0.4);
        if (py < loY + yMargin) {
          ay += ((loY + yMargin - py) / yMargin) * 8.0;
        } else if (py > hiY - yMargin) {
          ay -= ((py - (hiY - yMargin)) / yMargin) * 8.0;
        } else {
          ay += (cy - py) * 0.18 + Math.sin(safeElapsed * 1.4 + phases[i]) * 0.55;
        }
      }

      vx += ax * dt;
      vy += ay * dt;
      vz += az * dt;

      let speed = Math.hypot(vx, vy, vz);
      if (!Number.isFinite(speed) || speed < 1e-6) {
        vx = baseSpeed;
        vy = 0;
        vz = 0;
        speed = baseSpeed;
      } else if (speed < minSpeed || speed > maxSpeed) {
        const clamped = Math.max(minSpeed, Math.min(maxSpeed, speed));
        const ratio = clamped / speed;
        vx *= ratio;
        vy *= ratio;
        vz *= ratio;
      }

      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      if (kind === 'petal') {
        if (py < loY) {
          py = hiY - ((loY - py) % Math.max(hiY - loY, 1.0));
          const r = Math.sqrt(deterministicHash(i * 3.1 + safeElapsed * 0.01)) * boundsRadius * 0.85;
          const th = deterministicHash(i * 7.3 + py) * Math.PI * 2.0;
          px = cx + Math.cos(th) * r;
          pz = cz + Math.sin(th) * r;
        }
      } else {
        py = Math.max(loY - 1.0, Math.min(hiY + 1.0, py));
      }

      positions[i3] = px;
      positions[i3 + 1] = py;
      positions[i3 + 2] = pz;
      velocities[i3] = vx;
      velocities[i3 + 1] = vy;
      velocities[i3 + 2] = vz;

      const scale = 0.85 + variants[i] * 0.35;
      writeSafeInstanceMatrix(i, px, py, pz, vx, vy, vz, scale);
    }

    mesh.instanceMatrix.needsUpdate = true;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    update,
    dispose
  };
}

/* -------------------------------------------------------------------------- */
/* 4. Single-Draw-Call Seamless Weather Particles System                      */
/* -------------------------------------------------------------------------- */

export type WeatherMode = 'clear' | 'mist' | 'rain' | 'fireflies';

export interface WeatherParticlesOptions {
  count?: number;
  radius?: number;
}

export interface WeatherParticlesHandle {
  mesh: THREE.InstancedMesh;
  setMode: (mode: WeatherMode) => void;
  getMode: () => WeatherMode;
  update: (delta: number, elapsed: number, focusCenter?: THREE.Vector3) => void;
  dispose: () => void;
}

function weatherModeToInt(mode: WeatherMode): number {
  switch (mode) {
    case 'clear':
      return 0;
    case 'mist':
      return 1;
    case 'rain':
      return 2;
    case 'fireflies':
      return 3;
  }
}

const weatherVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  attribute vec4 aSeed;

  uniform float uTime;
  uniform float uRadius;
  uniform vec3 uFocusCenter;
  uniform int uMode;
  uniform float uModeWeight;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vPulse;
  varying vec4 vSeed;

  void main() {
    vUv = uv;
    vSeed = aSeed;

    if (uMode == 0 || uModeWeight <= 0.001) {
      vAlpha = 0.0;
      vPulse = 0.0;
      vec4 mvPosition = vec4(0.0, 0.0, 100.0, 1.0);
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      #include <fog_vertex>
    } else {
      float diam = max(uRadius * 2.0, 4.0);
      float heightSpan = max(uRadius * 0.72, 16.0);

      vec3 basePos = vec3(
        (aSeed.x - 0.5) * diam,
        aSeed.y * heightSpan,
        (aSeed.z - 0.5) * diam
      );

      vec3 vel = vec3(0.0);
      vec2 quadSize = vec2(1.0);
      float pulse = 1.0;

      if (uMode == 1) {
        // Mist: low drifting atmospheric wisps
        basePos.y = aSeed.y * (heightSpan * 0.42) + 0.6;
        vel = vec3(1.1 + aSeed.w * 0.8, 0.06, 0.45) * uTime;
        quadSize = vec2(5.0 + aSeed.w * 3.4, 2.8 + aSeed.x * 1.8);
      } else if (uMode == 2) {
        // Rain: crisp wind-slanted downpour streaks
        float speed = 22.0 + aSeed.w * 8.0;
        vel = vec3(-2.8, -speed, -0.9) * uTime;
        quadSize = vec2(0.024, 0.90 + aSeed.w * 0.45);
      } else {
        // Fireflies: floating bioluminescent night particles
        basePos.y = aSeed.y * (heightSpan * 0.38) + 0.5;
        float ph = aSeed.w * 6.2831;
        vel = vec3(
          sin(uTime * 0.65 + ph) * 1.6 + uTime * 0.18,
          sin(uTime * 1.15 + ph * 1.7) * 0.75,
          cos(uTime * 0.58 + ph * 1.3) * 1.6
        );
        pulse = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 2.5 + ph * 2.0), 2.2);
        quadSize = vec2(0.34 + 0.14 * pulse);
      }

      vec3 boxSize = vec3(diam, heightSpan, diam);
      vec3 rel = mod(basePos + vel - uFocusCenter + boxSize * 0.5, boxSize) - boxSize * 0.5;
      vec3 worldCenter = rel + uFocusCenter;

      // Soft wrap-volume boundary fade so particles never pop at uRadius
      float radialFrac = length(rel.xz) / max(uRadius, 1.0);
      float edgeFade = smoothstep(1.0, 0.70, radialFrac) *
        smoothstep(0.0, 0.12, (rel.y + boxSize.y * 0.5) / boxSize.y) *
        smoothstep(1.0, 0.86, (rel.y + boxSize.y * 0.5) / boxSize.y);

      vAlpha = edgeFade * uModeWeight;
      vPulse = pulse;

      vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

      vec3 worldPos;
      if (uMode == 2) {
        // Cylindrical Y-aligned streak billboard for rain
        vec3 toCam = cameraPosition - worldCenter;
        vec3 streakUp = normalize(vec3(-0.12, 1.0, -0.04));
        vec3 side = cross(streakUp, toCam);
        float sLen = length(side);
        side = sLen > 1e-4 ? side / sLen : camRight;
        worldPos = worldCenter + side * (position.x * quadSize.x) + streakUp * (position.y * quadSize.y);
      } else {
        worldPos = worldCenter + camRight * (position.x * quadSize.x) + camUp * (position.y * quadSize.y);
      }

      vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      #include <fog_vertex>
    }
  }
`;

const weatherFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform int uMode;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vPulse;
  varying vec4 vSeed;

  void main() {
    if (uMode == 0 || vAlpha <= 0.002) {
      discard;
    }

    float d = length(vUv - 0.5) * 2.0;
    float soft = exp(-d * d * 4.5) * (1.0 - smoothstep(0.65, 1.0, d));
    vec3 col = vec3(1.0);
    float alpha = 0.0;

    if (uMode == 1) {
      // Mist: velvety soft cloud puff with smooth circular Gaussian falloff
      if (d >= 1.0) {
        discard;
      }
      col = mix(vec3(0.84, 0.90, 0.97), vec3(0.96, 0.98, 1.0), vSeed.w);
      alpha = soft * 0.18 * vAlpha;
    } else if (uMode == 2) {
      // Rain: thin vertical tapered streak with zero square corners
      float rx = abs(vUv.x - 0.5) * 2.0;
      float ry = abs(vUv.y - 0.5) * 2.0;
      float softX = exp(-rx * rx * 5.2) * (1.0 - smoothstep(0.65, 1.0, rx));
      float softY = exp(-ry * ry * 2.4) * (1.0 - smoothstep(0.65, 1.0, ry));
      float taper = clamp(1.0 - ry * ry, 0.0, 1.0);
      col = vec3(0.78, 0.88, 0.98);
      alpha = softX * softY * taper * 0.46 * vAlpha;
    } else {
      // Fireflies: soft glowing circular bokeh orb with zero square edges
      if (d >= 1.0) {
        discard;
      }
      float core = exp(-d * d * 13.5) * (1.0 - smoothstep(0.65, 1.0, d));
      col = mix(vec3(0.75, 1.0, 0.35), vec3(1.0, 0.95, 0.52), vPulse) * (1.05 + 0.55 * core);
      alpha = clamp((soft * 0.72 + core * 0.55) * vPulse * vAlpha, 0.0, 1.0);
    }

    if (alpha <= 0.002) {
      discard;
    }

    gl_FragColor = vec4(col, alpha);

    #include <fog_fragment>
  }
`;

/**
 * Creates a single-draw-call GPU weather particle system supporting seamless
 * crossfading between `'clear' | 'mist' | 'rain' | 'fireflies'`.
 */
export function createWeatherParticlesSystem(
  options?: WeatherParticlesOptions
): WeatherParticlesHandle {
  const count = Math.max(1, Math.floor(options?.count ?? 900));
  const radius = Math.max(4, options?.radius ?? 52);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = deterministicHash(i * 1.13 + 0.7);
    seeds[i * 4 + 1] = deterministicHash(i * 2.71 + 1.9);
    seeds[i * 4 + 2] = deterministicHash(i * 4.33 + 3.1);
    seeds[i * 4 + 3] = deterministicHash(i * 6.91 + 5.3);
  }
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));

  let activeMode: WeatherMode = 'clear';
  let targetMode: WeatherMode = 'clear';
  let modeWeight = 0;

  const customUniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uRadius: { value: radius },
    uFocusCenter: { value: new THREE.Vector3(0, 0, 0) },
    uMode: { value: weatherModeToInt(activeMode) },
    uModeWeight: { value: modeWeight }
  };

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, customUniforms]),
    vertexShader: weatherVertexShader,
    fragmentShader: weatherFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'WeatherParticlesSystem';
  mesh.frustumCulled = false;
  mesh.visible = false;

  const identity = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, identity);
  }
  mesh.instanceMatrix.needsUpdate = true;

  const setMode = (mode: WeatherMode): void => {
    targetMode = mode;
    if (activeMode === 'clear' && mode !== 'clear' && modeWeight <= 0.001) {
      activeMode = mode;
      material.uniforms.uMode.value = weatherModeToInt(activeMode);
    }
  };

  const getMode = (): WeatherMode => targetMode;

  const update = (
    delta: number,
    elapsed: number,
    focusCenter?: THREE.Vector3
  ): void => {
    const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0.0001), 0.1) : 0.016;
    const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0;
    material.uniforms.uTime.value = safeElapsed;

    if (focusCenter) {
      const targetVec = material.uniforms.uFocusCenter.value as THREE.Vector3;
      targetVec.set(
        Number.isFinite(focusCenter.x) ? focusCenter.x : 0,
        Number.isFinite(focusCenter.y) ? focusCenter.y : 0,
        Number.isFinite(focusCenter.z) ? focusCenter.z : 0
      );
    }

    const fadeRate = 3.2 * dt;
    if (activeMode !== targetMode) {
      modeWeight = Math.max(0, modeWeight - fadeRate);
      if (modeWeight <= 0.001) {
        activeMode = targetMode;
        material.uniforms.uMode.value = weatherModeToInt(activeMode);
      }
    } else if (activeMode !== 'clear') {
      modeWeight = Math.min(1, modeWeight + fadeRate);
    } else {
      modeWeight = Math.max(0, modeWeight - fadeRate);
    }

    material.uniforms.uModeWeight.value = modeWeight;
    mesh.visible = activeMode !== 'clear' && modeWeight > 0.001;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    setMode,
    getMode,
    update,
    dispose
  };
}
