import * as THREE from 'three';

export interface StarHaloUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uIntensity: { value: number };
  uPulseSpeed: { value: number };
  uPulseIntensity: { value: number };
  uTrebleEnergy: { value: number };
  uCoreSigma: { value: number };
  uHaloSigma: { value: number };
  uWaveFreq: { value: number };
  uCoreColor: { value: THREE.Color };
  uHaloColor: { value: THREE.Color };
  uCoronaColor: { value: THREE.Color };
}

export const starHaloVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const starHaloFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPulseSpeed;
  uniform float uPulseIntensity;
  uniform float uTrebleEnergy;
  uniform float uCoreSigma;
  uniform float uHaloSigma;
  uniform float uWaveFreq;
  uniform vec3 uCoreColor;
  uniform vec3 uHaloColor;
  uniform vec3 uCoronaColor;

  varying vec2 vUv;

  void main() {
    // Center UVs to [-1.0, 1.0]
    vec2 u = (vUv - 0.5) * 2.0;
    float r = length(u);

    if (r > 1.0) {
      discard;
    }

    float pulseMod = clamp(uPulseIntensity, 0.5, 2.2);
    float trebleMod = 1.0 + clamp(uTrebleEnergy, 0.0, 1.5) * 0.28;
    float safeCoreSigma = max(uCoreSigma * (1.0 + (pulseMod - 1.0) * 0.14), 0.02);
    float safeHaloSigma = max(uHaloSigma * (1.0 + (pulseMod - 1.0) * 0.18), 0.05);

    // Radial exponential core + pulsating cosine wave equation
    // I(r, t) = I_core * exp(-r^2 / sigma_core^2) + I_halo * cos^2(k_r * r - omega * t) * exp(-r / sigma_halo)
    float core = exp(-(r * r) / (safeCoreSigma * safeCoreSigma));

    float waveArg = uWaveFreq * r - uPulseSpeed * uTime;
    float haloCos = cos(waveArg);
    float halo = (haloCos * haloCos) * exp(-r / safeHaloSigma) * pulseMod;

    // Soft celestial teal corona at the outer boundary
    float corona = exp(-r / (safeHaloSigma * 1.6)) * smoothstep(0.15, 0.65, r) * trebleMod;

    // Van Gogh signature multi-layer color blending
    vec3 color = uCoreColor * core * 1.45 * trebleMod + uHaloColor * halo * 1.25 + uCoronaColor * corona * 0.55;
    float alpha = clamp(core * 1.4 + halo * 1.1 + corona * 0.4, 0.0, 1.0) * uIntensity;

    // Edge falloff to prevent harsh quad borders
    float edgeFade = smoothstep(1.0, 0.75, r);
    alpha *= edgeFade;

    if (alpha < 0.003) {
      discard;
    }

    gl_FragColor = vec4(color * uIntensity, alpha);
  }
`;

export function createStarHaloMaterial(customUniforms?: Partial<{
  intensity: number;
  pulseSpeed: number;
  coreSigma: number;
  haloSigma: number;
  waveFreq: number;
  coreColor: string | THREE.Color;
  haloColor: string | THREE.Color;
  coronaColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const uniforms: StarHaloUniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: customUniforms?.intensity ?? 1.0 },
    uPulseSpeed: { value: customUniforms?.pulseSpeed ?? 1.5 },
    uPulseIntensity: { value: 1.0 },
    uTrebleEnergy: { value: 0.0 },
    uCoreSigma: { value: customUniforms?.coreSigma ?? 0.12 },
    uHaloSigma: { value: customUniforms?.haloSigma ?? 0.38 },
    uWaveFreq: { value: customUniforms?.waveFreq ?? 16.0 },
    uCoreColor: {
      value: customUniforms?.coreColor instanceof THREE.Color
        ? customUniforms.coreColor
        : new THREE.Color(customUniforms?.coreColor ?? '#fffff4')
    },
    uHaloColor: {
      value: customUniforms?.haloColor instanceof THREE.Color
        ? customUniforms.haloColor
        : new THREE.Color(customUniforms?.haloColor ?? '#fbc02d')
    },
    uCoronaColor: {
      value: customUniforms?.coronaColor instanceof THREE.Color
        ? customUniforms.coronaColor
        : new THREE.Color(customUniforms?.coronaColor ?? '#26a69a')
    }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: starHaloVertexShader,
    fragmentShader: starHaloFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
