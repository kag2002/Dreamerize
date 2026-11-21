import * as THREE from 'three';

export interface GrassSwayUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uWindSpeed: { value: number };
  uWindDirection: { value: THREE.Vector2 };
  uWindStrength: { value: number };
  uGustiness: { value: number };
  uBaseColor: { value: THREE.Color };
  uTipColor: { value: THREE.Color };
  uSunDirection: { value: THREE.Vector3 };
  uFadeStart: { value: number };
  uFadeEnd: { value: number };
}

export const grassSwayVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  uniform float uWindSpeed;
  uniform vec2 uWindDirection;
  uniform float uWindStrength;
  uniform float uGustiness;
  uniform float uFadeStart;
  uniform float uFadeEnd;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vGust;
  varying vec3 vInstanceColor;

  float gHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.56);
    return fract(p.x * p.y);
  }

  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
      mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vUv = uv;
    vInstanceColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
    vInstanceColor = instanceColor;
    #endif

    vec4 localPos = vec4(position, 1.0);

    #ifdef USE_INSTANCING
    vec3 baseWorldPos = vec3(instanceMatrix[3].xyz);
    #else
    vec3 baseWorldPos = vec3(modelMatrix[3].xyz);
    #endif

    // Optional GPU distance culling fade for large-scale maps (uFadeEnd <= 0.0 keeps full range)
    float distScale = 1.0;
    if (uFadeEnd > 0.0) {
      float camDist = length(baseWorldPos.xz - cameraPosition.xz);
      distScale = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
      localPos.xyz *= distScale;
    }

    #ifdef USE_INSTANCING
    vec4 worldPos = instanceMatrix * localPos;
    #else
    vec4 worldPos = modelMatrix * localPos;
    #endif

    vec2 windDir = normalize(uWindDirection);
    vec2 perpWindDir = vec2(-windDir.y, windDir.x);

    // Quadratic flex factor (uv.y * uv.y) anchored at root
    float flex = uv.y * uv.y;

    // Smooth Perlin-like turbulence field + propagating dual-frequency wind wave
    float turb = gNoise(baseWorldPos.xz * 0.16 - windDir * uTime * (uWindSpeed * 0.65));
    float phase1 = dot(worldPos.xz, windDir) * 0.28 - uTime * uWindSpeed;
    float wave1 = sin(phase1 + turb * 1.35);

    float phase2 = dot(worldPos.xz, windDir) * 0.58 - uTime * (uWindSpeed * 1.7) + 1.25;
    float wave2 = sin(phase2 + turb * 2.1);

    float phaseCross = dot(worldPos.xz, perpWindDir) * 0.45 - uTime * 2.8 + baseWorldPos.x * 0.1;
    float waveCross = sin(phaseCross) * 0.22;

    float gust = (wave1 * 0.58 + 0.36 * turb + 0.20) + uGustiness * wave2 + waveCross;
    vGust = gust;

    vec2 horizontalDisp = (windDir * gust + perpWindDir * waveCross * 0.45) * uWindStrength * 0.72 * flex * distScale;
    worldPos.xz += horizontalDisp;

    // Organic blade arch & tip droop preserving natural arc length
    float dispLenSq = dot(horizontalDisp, horizontalDisp);
    worldPos.y -= (dispLenSq * 0.34 + (0.04 + 0.04 * turb) * distScale) * flex;

    vWorldPosition = worldPos.xyz;

    #ifdef USE_INSTANCING
    vec3 bladeNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
    #else
    vec3 bladeNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    #endif
    bladeNormal.xz += windDir * gust * 0.52 * uv.y;
    vNormal = normalize(bladeNormal);

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const grassSwayFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vGust;
  varying vec3 vInstanceColor;

  float gfHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.56);
    return fract(p.x * p.y);
  }

  float gfNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(gfHash(i), gfHash(i + vec2(1.0, 0.0)), u.x),
      mix(gfHash(i + vec2(0.0, 1.0)), gfHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float gfFbm(vec2 p) {
    float v = 0.62 * gfNoise(p);
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    v += 0.38 * gfNoise(rot * p * 2.07 + vec2(13.7, 29.3));
    return v;
  }

  void main() {
    // World-space rotated FBM macro-patch variation: lush emerald hollows, sunlit chartreuse patches, & subtle golden dry stalks
    float macroPatch = gfFbm(vWorldPosition.xz * 0.075);
    float midPatch = gfFbm(vWorldPosition.xz * 0.28 + vec2(17.3, 9.1));
    float stalkDry = gfNoise(vWorldPosition.xz * 2.15 + vec2(4.7, 23.4));

    vec3 emeraldTint = vec3(0.84, 1.03, 0.88);
    vec3 chartreuseTint = vec3(1.10, 1.08, 0.78);
    vec3 patchTint = mix(emeraldTint, chartreuseTint, smoothstep(0.28, 0.76, macroPatch * 0.72 + midPatch * 0.28));

    vec3 baseCol = uBaseColor * vInstanceColor * mix(vec3(1.0), patchTint, 0.65);
    vec3 midCol = mix(baseCol, uTipColor * vInstanceColor * patchTint, 0.54) * vec3(0.96, 1.04, 0.88);
    vec3 tipCol = uTipColor * vInstanceColor * patchTint * vec3(1.06, 1.05, 0.86);

    // Subtle golden dry-grass stalks scattered organically across sunlit clumps
    float dryMask = smoothstep(0.68, 0.90, stalkDry * 0.68 + midPatch * 0.32) * smoothstep(0.25, 0.92, vUv.y);
    vec3 dryGoldTip = tipCol * vec3(1.24, 1.02, 0.62);

    // 3-stop botanical chlorophyll gradient (olive-emerald root -> rich meadow mid -> warm golden tip)
    vec3 col = mix(baseCol, midCol, smoothstep(0.0, 0.48, vUv.y));
    col = mix(col, tipCol, smoothstep(0.45, 0.96, vUv.y));
    col = mix(col, dryGoldTip, dryMask * 0.38);

    // Longitudinal blade venation / micro-ribbing + crisp central midrib highlight + edge taper
    float bladeEdge = abs(vUv.x - 0.5) * 2.0;
    float midribMask = exp(-pow((vUv.x - 0.5) * 6.8, 2.0));
    float rib = sin(vUv.x * 34.0) * 0.042 + midribMask * 0.11;
    float edgeTaper = 1.0 - smoothstep(0.76, 1.0, bladeEdge) * 0.15;
    col *= clamp((1.0 + rib) * edgeTaper, 0.74, 1.20);

    // Grounded soft root ambient occlusion (kept >= 0.72 so bases stay rich olive-green without dark banding)
    float rootAO = mix(0.72, 1.0, smoothstep(0.0, 0.34, vUv.y));

    // Directional sunlight + soft sky hemisphere fill + crisp anisotropic midrib specular sheen
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 H = normalize(L + V);

    float NdotL = clamp(abs(dot(N, L)), 0.0, 1.0);
    float diffuse = NdotL * 0.40 + 0.68;
    float specSheen = pow(max(dot(N, H), 0.0), 20.0) * (0.65 + 0.65 * midribMask) * vUv.y * 0.22;

    // Silky wind-crest highlight + warm backlit subsurface scattering (SSS)
    float windCrest = smoothstep(0.25, 1.25, vGust) * pow(vUv.y, 1.5) * 0.13;
    float sss = pow(clamp(-dot(V, L), 0.0, 1.0), 2.1) * pow(vUv.y, 0.85) * 0.56;
    vec3 sssTint = mix(tipCol, tipCol * vec3(1.16, 1.10, 0.74), 0.48);

    col = col * diffuse * rootAO + sssTint * (sss + windCrest) + tipCol * specSheen;

    gl_FragColor = vec4(col, 1.0);

    #include <fog_fragment>
  }
`;

export const wildflowerVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  uniform float uWindSpeed;
  uniform vec2 uWindDirection;
  uniform float uWindStrength;
  uniform float uGustiness;
  uniform float uFadeStart;
  uniform float uFadeEnd;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vInstanceColor;

  #ifdef USE_COLOR
  varying vec3 vColor;
  #endif

  void main() {
    vUv = uv;

    #ifdef USE_COLOR
    vColor = color;
    #endif

    vInstanceColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
    vInstanceColor = instanceColor;
    #endif

    vec4 localPos = vec4(position, 1.0);

    #ifdef USE_INSTANCING
    vec3 baseWorldPos = vec3(instanceMatrix[3].xyz);
    #else
    vec3 baseWorldPos = vec3(modelMatrix[3].xyz);
    #endif

    // Optional GPU distance culling fade for large-scale maps (uFadeEnd <= 0.0 keeps full range)
    float distScale = 1.0;
    if (uFadeEnd > 0.0) {
      float camDist = length(baseWorldPos.xz - cameraPosition.xz);
      distScale = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
      localPos.xyz *= distScale;
    }

    #ifdef USE_INSTANCING
    vec4 worldPos = instanceMatrix * localPos;
    #else
    vec4 worldPos = modelMatrix * localPos;
    #endif

    vec2 windDir = normalize(uWindDirection);
    vec2 perpWindDir = vec2(-windDir.y, windDir.x);

    // Stiff stem flex factor: pinned root, flexes up to head
    float flex = clamp(uv.y * uv.y, 0.0, 1.0);

    // Synchronized wind wave matching grass
    float phase1 = dot(worldPos.xz, windDir) * 0.28 - uTime * uWindSpeed;
    float wave1 = sin(phase1);

    float phase2 = dot(worldPos.xz, windDir) * 0.58 - uTime * (uWindSpeed * 1.7) + 1.25;
    float wave2 = sin(phase2);

    float phaseCross = dot(worldPos.xz, perpWindDir) * 0.45 - uTime * 2.8 + baseWorldPos.x * 0.1;
    float waveCross = sin(phaseCross) * 0.2;

    float gust = (wave1 * 0.65 + 0.35) + uGustiness * wave2 + waveCross;

    // Stems are firmer than grass (0.75 factor)
    vec2 horizontalDisp = (windDir * gust + perpWindDir * waveCross * 0.4) * (uWindStrength * 0.75) * flex * distScale;
    worldPos.xz += horizontalDisp;

    float dispLenSq = dot(horizontalDisp, horizontalDisp);
    worldPos.y -= dispLenSq * 0.3 * flex;

    vWorldPosition = worldPos.xyz;

    #ifdef USE_INSTANCING
    vec3 stemNormal = (instanceMatrix * vec4(normal, 0.0)).xyz;
    #else
    vec3 stemNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    #endif
    vNormal = normalize(stemNormal);

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const wildflowerFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vInstanceColor;

  #ifdef USE_COLOR
  varying vec3 vColor;
  #endif

  void main() {
    #ifdef USE_COLOR
    vec3 col = vColor;
    #else
    vec3 col = vec3(0.99, 0.99, 0.96);
    #endif

    // Apply per-instance blossom tint to petals while keeping green stems & golden center eyes crisp
    float instTintMask = smoothstep(0.985, 0.996, vUv.y);
    col *= mix(vec3(1.0), vInstanceColor, instTintMask);

    // Root stem AO so flower bases sit grounded in the grass
    float rootAO = mix(0.48, 1.0, smoothstep(0.0, 0.38, vUv.y));

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    float NdotL = clamp(abs(dot(N, L)), 0.0, 1.0);
    float diffuse = NdotL * 0.34 + 0.72;

    // Soft petal translucency when sunlit from behind
    float petalMask = smoothstep(0.75, 1.0, vUv.y);
    float sss = pow(clamp(-dot(V, L), 0.0, 1.0), 2.0) * petalMask * 0.25;
    col = col * diffuse * rootAO + col * sss;

    gl_FragColor = vec4(col, 1.0);

    #include <fog_fragment>
  }
`;

function resolveWindDirection(dir?: [number, number] | THREE.Vector2): THREE.Vector2 {
  if (dir instanceof THREE.Vector2) {
    return dir.clone().normalize();
  }
  if (Array.isArray(dir)) {
    return new THREE.Vector2(dir[0], dir[1]).normalize();
  }
  return new THREE.Vector2(1.0, 0.3).normalize();
}

function resolveSunDirection(dir?: [number, number, number] | THREE.Vector3): THREE.Vector3 {
  if (dir instanceof THREE.Vector3) {
    return dir.clone().normalize();
  }
  if (Array.isArray(dir)) {
    return new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
  }
  return new THREE.Vector3(40, 60, 30).normalize();
}

export function createGrassSwayMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windDirection: [number, number] | THREE.Vector2;
  windStrength: number;
  gustiness: number;
  baseColor: string | THREE.Color;
  tipColor: string | THREE.Color;
  sunDirection: [number, number, number] | THREE.Vector3;
  fadeStart: number;
  fadeEnd: number;
}>): THREE.ShaderMaterial {
  const windDir = resolveWindDirection(customUniforms?.windDirection);
  const sunDir = resolveSunDirection(customUniforms?.sunDirection);

  const custom: GrassSwayUniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 2.4 },
    uWindDirection: { value: windDir },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.9 },
    uGustiness: { value: customUniforms?.gustiness ?? 0.65 },
    uBaseColor: {
      value: customUniforms?.baseColor instanceof THREE.Color
        ? customUniforms.baseColor
        : new THREE.Color(customUniforms?.baseColor ?? '#286e2b')
    },
    uTipColor: {
      value: customUniforms?.tipColor instanceof THREE.Color
        ? customUniforms.tipColor
        : new THREE.Color(customUniforms?.tipColor ?? '#a6ef52')
    },
    uSunDirection: { value: sunDir },
    uFadeStart: { value: customUniforms?.fadeStart ?? 0.0 },
    uFadeEnd: { value: customUniforms?.fadeEnd ?? 0.0 }
  };

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: grassSwayVertexShader,
    fragmentShader: grassSwayFragmentShader,
    side: THREE.DoubleSide,
    fog: true
  });
}

export function createWildflowerMaterial(customUniforms?: Partial<{
  windSpeed: number;
  windDirection: [number, number] | THREE.Vector2;
  windStrength: number;
  gustiness: number;
  sunDirection: [number, number, number] | THREE.Vector3;
  fadeStart: number;
  fadeEnd: number;
}>): THREE.ShaderMaterial {
  const windDir = resolveWindDirection(customUniforms?.windDirection);
  const sunDir = resolveSunDirection(customUniforms?.sunDirection);

  const custom = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: customUniforms?.windSpeed ?? 2.4 },
    uWindDirection: { value: windDir },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.9 },
    uGustiness: { value: customUniforms?.gustiness ?? 0.65 },
    uSunDirection: { value: sunDir },
    uFadeStart: { value: customUniforms?.fadeStart ?? 0.0 },
    uFadeEnd: { value: customUniforms?.fadeEnd ?? 0.0 }
  };

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: wildflowerVertexShader,
    fragmentShader: wildflowerFragmentShader,
    side: THREE.DoubleSide,
    fog: true,
    vertexColors: true
  });
}
