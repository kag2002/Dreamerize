import * as THREE from 'three';

export interface GhibliCloudUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uSunDirection: { value: THREE.Vector3 };
  uTopColor: { value: THREE.Color };
  uMidColor: { value: THREE.Color };
  uShadowColor: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  uShadowThreshold: { value: number };
  uHighlightThreshold: { value: number };
  uBandSoftness: { value: number };
  uRimPower: { value: number };
  uRimIntensity: { value: number };
  uCloudSpeed: { value: number };
  uDriftDirection: { value: THREE.Vector2 };
  uUndulationAmplitude: { value: number };
  uUndulationFrequency: { value: number };
}

export const ghibliCloudVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  uniform float uCloudSpeed;
  uniform vec2 uDriftDirection;
  uniform float uUndulationAmplitude;
  uniform float uUndulationFrequency;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  void main() {
    // World-space surface normal so 360° camera rotation keeps cloud lighting locked to the sun
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vLocalPosition = position;

    float t = uTime * uCloudSpeed;
    float wave1 = sin(t * 0.35 + position.x * uUndulationFrequency + position.y * (uUndulationFrequency * 1.2));
    float wave2 = cos(t * 0.28 + position.z * uUndulationFrequency + position.x * (uUndulationFrequency * 0.8));

    // Multi-frequency organic cauliflower cumulus puffs breaking up spherical symmetry
    float billowLobe =
      sin(position.x * 0.10 + position.y * 0.09) * cos(position.z * 0.10 - position.x * 0.06) * 3.2 +
      sin(position.y * 0.22 + position.z * 0.17 - position.x * 0.13) * 1.65 +
      cos(position.x * 0.34 - position.y * 0.28 + position.z * 0.25) * 0.75;

    float undulation = (wave1 + wave2) * 0.5 * uUndulationAmplitude + billowLobe;

    vec3 displaced = position + normal * undulation;

    vec2 driftDir = normalize(uDriftDirection);
    displaced.x += sin(t * 0.05) * driftDir.x * 5.0;
    displaced.z += cos(t * 0.04) * driftDir.y * 2.5;

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPos.xyz;

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const ghibliCloudFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uShadowColor;
  uniform vec3 uRimColor;
  uniform float uShadowThreshold;
  uniform float uHighlightThreshold;
  uniform float uBandSoftness;
  uniform float uRimPower;
  uniform float uRimIntensity;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  float cloudHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float cloudNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(cloudHash(i + vec3(0,0,0)), cloudHash(i + vec3(1,0,0)), f.x),
          mix(cloudHash(i + vec3(0,1,0)), cloudHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(cloudHash(i + vec3(0,0,1)), cloudHash(i + vec3(1,0,1)), f.x),
          mix(cloudHash(i + vec3(0,1,1)), cloudHash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float cloudFbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * cloudNoise(p);
      p = p * 2.04 + vec3(11.3, 7.1, 5.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 rawN = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    // Blend surface normals softly toward a unified cloud-dome upward vector so intersecting
    // billows merge seamlessly without round ball-intersection creases
    vec3 N = normalize(mix(rawN, normalize(vec3(0.0, 0.7, 0.3)), 0.56));

    // Multi-octave domain-warped 3D FBM for painterly Studio Ghibli cloud puffs & wispy ridges
    vec3 samplePos = vWorldPosition * 0.025 + vec3(uTime * 0.008, 0.0, -uTime * 0.005);
    float warp = cloudFbm(samplePos * 0.80);
    float puffMacro = cloudFbm(samplePos + vec3(warp * 1.45, warp * 0.75, -warp * 0.95));
    float puffMicro = cloudFbm(vWorldPosition * 0.082 - vec3(uTime * 0.014, 0.0, 0.0));
    float puffDetail = (puffMacro - 0.48) * 0.62 + (puffMicro - 0.50) * 0.24;

    // Combine soft dome-normal sunlight with global altitude light so overlapping spheres merge completely
    float altitudeLight = clamp((vWorldPosition.y - 16.0) / 76.0, 0.0, 1.0);
    // Half-Lambertian diffuse wrap: smooth remap of dot(N, L)
    float NdotL = dot(N, L) * 0.5 + 0.5;
    float cloudShade = mix(NdotL, 0.38 + altitudeLight * 0.62, 0.54) + puffDetail;

    // 3-tone stepped cel banding via smoothstep transitions
    float band1 = smoothstep(uShadowThreshold - uBandSoftness, uShadowThreshold + uBandSoftness, cloudShade);
    float band2 = smoothstep(uHighlightThreshold - uBandSoftness, uHighlightThreshold + uBandSoftness, cloudShade);

    vec3 color = mix(uShadowColor, uMidColor, band1);
    color = mix(color, uTopColor, band2);

    // Subtle cool sky-blue atmospheric bounce inside deep cloud shadow bellies
    color = mix(color, vec3(0.56, 0.72, 0.92), (1.0 - band1) * (1.0 - altitudeLight) * 0.35);

    // Warm cream subsurface scattering & luminous crest highlights where sunlight penetrates billow edges
    float NdotV = max(dot(N, V), 0.0);
    float sunForward = pow(clamp(dot(L, -V) * 0.5 + 0.5, 0.0, 1.0), 2.8);
    float subsurface = (1.0 - NdotV * 0.65) * sunForward * (0.35 + 0.65 * puffMacro);
    color = mix(color, vec3(1.0, 0.985, 0.93), clamp(altitudeLight * band2 * 0.38 + subsurface * 0.34, 0.0, 0.65));

    // Silver lining rim lighting along grazing viewing angles
    float rimFresnel = pow(1.0 - NdotV, uRimPower);
    float sunFacing = clamp(dot(L, -V) * 0.5 + 0.5, 0.28, 1.0);
    float rimWeight = rimFresnel * sunFacing * uRimIntensity * 0.68;

    color = mix(color, uRimColor, rimWeight);

    // Gentle atmospheric base softening near the lower horizon edge
    float baseHaze = smoothstep(28.0, 12.0, vWorldPosition.y);
    color = mix(color, vec3(0.84, 0.93, 0.99), baseHaze * 0.42);

    gl_FragColor = vec4(color, 1.0);

    #include <fog_fragment>
  }
`;

export function createGhibliCloudMaterial(customUniforms?: Partial<{
  sunDirection: [number, number, number] | THREE.Vector3;
  topColor: string | THREE.Color;
  midColor: string | THREE.Color;
  shadowColor: string | THREE.Color;
  rimColor: string | THREE.Color;
  shadowThreshold: number;
  highlightThreshold: number;
  bandSoftness: number;
  rimPower: number;
  rimIntensity: number;
  cloudSpeed: number;
  driftDirection: [number, number] | THREE.Vector2;
  undulationAmplitude: number;
  undulationFrequency: number;
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
    sunDir = new THREE.Vector3(40, 60, 30).normalize();
  }

  let drift: THREE.Vector2;
  if (customUniforms?.driftDirection instanceof THREE.Vector2) {
    drift = customUniforms.driftDirection.clone();
  } else if (Array.isArray(customUniforms?.driftDirection)) {
    drift = new THREE.Vector2(customUniforms.driftDirection[0], customUniforms.driftDirection[1]);
  } else {
    drift = new THREE.Vector2(1.0, 0.2);
  }

  const custom: GhibliCloudUniforms = {
    uTime: { value: 0.0 },
    uSunDirection: { value: sunDir },
    uTopColor: {
      value: customUniforms?.topColor instanceof THREE.Color
        ? customUniforms.topColor
        : new THREE.Color(customUniforms?.topColor ?? '#fffdf7')
    },
    uMidColor: {
      value: customUniforms?.midColor instanceof THREE.Color
        ? customUniforms.midColor
        : new THREE.Color(customUniforms?.midColor ?? '#b8d6f0')
    },
    uShadowColor: {
      value: customUniforms?.shadowColor instanceof THREE.Color
        ? customUniforms.shadowColor
        : new THREE.Color(customUniforms?.shadowColor ?? '#8c99b8')
    },
    uRimColor: {
      value: customUniforms?.rimColor instanceof THREE.Color
        ? customUniforms.rimColor
        : new THREE.Color(customUniforms?.rimColor ?? '#fff8e7')
    },
    uShadowThreshold: { value: customUniforms?.shadowThreshold ?? 0.35 },
    uHighlightThreshold: { value: customUniforms?.highlightThreshold ?? 0.65 },
    uBandSoftness: { value: customUniforms?.bandSoftness ?? 0.22 },
    uRimPower: { value: customUniforms?.rimPower ?? 3.2 },
    uRimIntensity: { value: customUniforms?.rimIntensity ?? 0.60 },
    uCloudSpeed: { value: customUniforms?.cloudSpeed ?? 0.75 },
    uDriftDirection: { value: drift },
    uUndulationAmplitude: { value: customUniforms?.undulationAmplitude ?? 0.9 },
    uUndulationFrequency: { value: customUniforms?.undulationFrequency ?? 0.04 }
  };

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, custom]);

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ghibliCloudVertexShader,
    fragmentShader: ghibliCloudFragmentShader,
    fog: true,
    side: THREE.FrontSide
  });
}
