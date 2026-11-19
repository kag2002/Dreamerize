import * as THREE from 'three';

export interface CypressUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uWindStrength: { value: number };
  uWindDirection: { value: THREE.Vector2 };
  uTreeHeight: { value: number };
  uBaseColor: { value: THREE.Color };
  uMidColor: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
}

export const cypressVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDirection;
  uniform float uTreeHeight;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeightRatio;

  void main() {
    vUv = uv;
    // World-space normal so 360° camera rotation preserves moonlit brushstroke rim lighting
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // Height ratio from trunk base (0.0) to flame crown (1.0), normalized cleanly for any tree height
    float hRatio = clamp(uv.y, 0.0, 1.0);
    vHeightRatio = hRatio;

    // Sculpt Van Gogh flame-like twisting cypress lobes safely without self-intersection
    float angle = atan(position.z, position.x);
    float flamePinch = sin(hRatio * 3.14159);
    float lobe = max(0.38,
      1.0 + 0.30 * sin(angle * 5.0 + hRatio * 9.0) * flamePinch
          + 0.16 * cos(angle * 7.0 - hRatio * 12.0) * flamePinch
          + 0.08 * sin(angle * 11.0 + hRatio * 18.0) * flamePinch
    );

    vec3 sculpted = position;
    sculpted.xz *= lobe;
    // Tip curves gracefully like a flickering candle flame without folding rings
    sculpted.x += pow(hRatio, 1.8) * 1.15 * sin(hRatio * 3.1);
    sculpted.z += pow(hRatio, 2.0) * 0.45 * cos(hRatio * 3.8);

    // Organic flame-shaped displacement undulating with (y / H)^1.5
    float flex = pow(hRatio, 1.5);

    vec2 windDir = normalize(uWindDirection);
    float t = uTime * 2.2;

    float swayPrimary = sin(t + position.y * 0.35);
    float flutter1 = sin(t * 1.8 + position.y * 0.8 + position.x * 1.2) * 0.45;
    float flutter2 = cos(t * 2.6 + position.y * 1.4 + position.z * 1.5) * 0.25;

    float totalSway = (swayPrimary + flutter1 + flutter2) * flex * uWindStrength;

    vec3 displacedPosition = sculpted;
    displacedPosition.x += windDir.x * totalSway;
    displacedPosition.z += windDir.y * totalSway * 0.8;

    float flamePuff = sin(t * 1.5 + position.y * 0.6) * flex * 0.12 * uWindStrength;
    displacedPosition.xz += normalize(position.xz + vec2(0.001)) * flamePuff;

    vec4 worldPos = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPos.xyz;

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const cypressFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uMidColor;
  uniform vec3 uRimColor;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeightRatio;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.34));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float strokeNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float flamePotential(vec2 p) {
    return strokeNoise(p) * 0.65 + strokeNoise(p * 2.13 + vec2(5.7, 3.1)) * 0.35;
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 moonDir = normalize(vec3(115.0, 125.0, -165.0));

    // Upward-spiraling Van Gogh curl-flow field across the cypress flame lobes
    vec2 uvFlow = vec2(vUv.x * 14.0, vUv.y * 5.2 - uTime * 0.05);
    float eps = 0.06;
    float p0 = flamePotential(uvFlow);
    float px = flamePotential(uvFlow + vec2(eps, 0.0)) - p0;
    float py = flamePotential(uvFlow + vec2(0.0, eps)) - p0;
    vec2 curl = normalize(vec2(py, -px) * 1.4 + vec2(0.28 * sin(vUv.y * 12.0 + vUv.x * 6.283), 1.35));
    vec2 perpCurl = vec2(-curl.y, curl.x);

    // Coordinates aligned along and across the spiraling brushstroke ribbons
    float along = dot(vec2(vUv.x * 24.0, vUv.y * 10.0), curl);
    float across = dot(vec2(vUv.x * 58.0, vUv.y * 16.0), perpCurl);
    float ribbonWave = sin(across + p0 * 5.5);
    float dashEnv = smoothstep(0.18, 0.86, strokeNoise(vec2(along * 0.72, across * 0.36)));
    float brushCrest = smoothstep(-0.28, 0.85, ribbonWave) * (0.38 + 0.62 * dashEnv);
    float brushGroove = smoothstep(0.35, -0.78, ribbonWave);

    // Rich Van Gogh nocturnal cypress palette in linear RGB:
    // deep midnight indigo grooves, Prussian folds, dark emerald/viridian flames, subtle cobalt moonlight
    vec3 indigoGroove = vec3(0.004, 0.009, 0.036);
    vec3 prussianFold = vec3(0.007, 0.024, 0.056);
    vec3 viridianFoliage = mix(vec3(0.010, 0.048, 0.032), clamp(uMidColor, vec3(0.008, 0.028, 0.018), vec3(0.030, 0.095, 0.068)), 0.55);
    vec3 cobaltHighlight = vec3(0.018, 0.052, 0.145);
    vec3 ochreFlecks = vec3(0.095, 0.068, 0.016);

    vec3 col = mix(uBaseColor * 0.85 + prussianFold * 0.48, viridianFoliage, smoothstep(0.05, 0.92, vHeightRatio));
    col = mix(col, indigoGroove, brushGroove * 0.68);
    col = mix(col, viridianFoliage * 1.24, brushCrest * 0.54);

    // Subtle dark burnt-umber bark/needle fissures in lower flame folds
    float siennaStreak = smoothstep(0.68, 0.94, strokeNoise(vec2(vUv.x * 36.0, vUv.y * 16.0)));
    col = mix(col, vec3(0.032, 0.014, 0.006), siennaStreak * (0.38 - 0.18 * vHeightRatio));

    // Subtle nocturnal hemisphere bounce + directional cobalt moonlight
    float hemiMix = N.y * 0.5 + 0.5;
    vec3 hemiLight = mix(vec3(0.005, 0.009, 0.028), vec3(0.015, 0.036, 0.102), hemiMix);
    float moonFace = clamp(dot(N, moonDir) * 0.6 + 0.4, 0.0, 1.0);
    col += hemiLight * (0.18 + 0.24 * brushCrest);
    col = mix(col, cobaltHighlight, moonFace * brushCrest * (0.20 + 0.24 * vHeightRatio));

    // Warm dark-ochre impasto highlights catching outer curling needle tufts
    float ochreMask = smoothstep(0.68, 0.95, brushCrest) * (0.28 + 0.72 * vHeightRatio) * (0.35 + 0.65 * moonFace);
    col = mix(col, ochreFlecks, ochreMask * 0.28);

    // Subtle cobalt moonlight rim light along outer flame silhouette (never pale ice-blue)
    float fresnel = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 2.85);
    float rimAccent = smoothstep(0.26, 0.92, fresnel) * (0.32 + 0.68 * vHeightRatio) * (0.45 + 0.55 * moonFace);
    vec3 moonRimCol = mix(uRimColor * 0.50, vec3(0.052, 0.122, 0.320), 0.55);
    col += moonRimCol * rimAccent * (0.30 + 0.28 * brushCrest);

    gl_FragColor = vec4(col, 1.0);

    #include <fog_fragment>
  }
`;

export function createCypressMaterial(customUniforms?: Partial<{
  windStrength: number;
  windDirection: [number, number] | THREE.Vector2;
  treeHeight: number;
  baseColor: string | THREE.Color;
  midColor: string | THREE.Color;
  rimColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  let windDir: THREE.Vector2;
  if (customUniforms?.windDirection instanceof THREE.Vector2) {
    windDir = customUniforms.windDirection;
  } else if (Array.isArray(customUniforms?.windDirection)) {
    windDir = new THREE.Vector2(customUniforms.windDirection[0], customUniforms.windDirection[1]);
  } else {
    windDir = new THREE.Vector2(0.8, 0.4);
  }

  const custom: CypressUniforms = {
    uTime: { value: 0.0 },
    uWindStrength: { value: customUniforms?.windStrength ?? 0.45 },
    uWindDirection: { value: windDir },
    uTreeHeight: { value: customUniforms?.treeHeight ?? 22.0 },
    uBaseColor: {
      value: customUniforms?.baseColor instanceof THREE.Color
        ? customUniforms.baseColor
        : new THREE.Color(customUniforms?.baseColor ?? '#061214')
    },
    uMidColor: {
      value: customUniforms?.midColor instanceof THREE.Color
        ? customUniforms.midColor
        : new THREE.Color(customUniforms?.midColor ?? '#0f3328')
    },
    uRimColor: {
      value: customUniforms?.rimColor instanceof THREE.Color
        ? customUniforms.rimColor
        : new THREE.Color(customUniforms?.rimColor ?? '#365da8')
    }
  };

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: cypressVertexShader,
    fragmentShader: cypressFragmentShader,
    side: THREE.DoubleSide,
    fog: true
  });
}
