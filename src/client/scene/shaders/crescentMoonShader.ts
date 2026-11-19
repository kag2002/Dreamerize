import * as THREE from 'three';

export interface CrescentMoonUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uGlowIntensity: { value: number };
  uAureoleSpeed: { value: number };
  uBassEnergy: { value: number };
  uMoonColor: { value: THREE.Color };
  uAureoleColor: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
}

export const crescentMoonVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const crescentMoonFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uGlowIntensity;
  uniform float uAureoleSpeed;
  uniform float uBassEnergy;
  uniform vec3 uMoonColor;
  uniform vec3 uAureoleColor;
  uniform vec3 uRimColor;

  varying vec2 vUv;

  void main() {
    // Center UV coordinates to [-1.0, 1.0]
    vec2 u = (vUv - 0.5) * 2.0;
    float r = length(u);

    if (r > 1.0) {
      discard;
    }

    // Procedural 2D circle-difference Signed Distance Field (SDF)
    // dist_crescent(u) = max(||u|| - R1, -(||u - delta|| - R2))
    float r1 = 0.48;
    vec2 delta = vec2(0.20, 0.14);
    float r2 = 0.44;

    float d1 = r - r1;
    float d2 = length(u - delta) - r2;
    float distCrescent = max(d1, -d2);

    // Sharp antialiased crescent silhouette
    float crescent = 1.0 - smoothstep(-0.02, 0.02, distCrescent);

    // Subtle surface gradient across the crescent
    float crescentGradient = clamp((u.x + 0.3) * 1.5, 0.0, 1.0);
    vec3 crescentBody = mix(uRimColor, uMoonColor, crescentGradient);

    // Concentric radiating aureole waves
    // aureole(r, t) = cos^2(k * r - omega * t) * exp(-r / sigma)
    float waveArg = 14.0 * r - uTime * uAureoleSpeed;
    float aureoleCos = cos(waveArg);
    float aureoleWave = (aureoleCos * aureoleCos) * exp(-r / 0.42);

    // Soft spherical aureole corona
    float diffuseAureole = exp(-r / 0.35) * 0.75;

    // Edge falloff at quad boundary
    float edgeFade = smoothstep(1.0, 0.72, r);

    // Composite aureole with subtle audio breath
    float audioBreath = 1.0 + clamp(uBassEnergy, 0.0, 1.5) * 0.16;
    float aureoleTotal = (aureoleWave * 0.65 + diffuseAureole) * edgeFade * uGlowIntensity * audioBreath;
    vec3 finalColor = crescentBody * crescent * 1.15 + uAureoleColor * aureoleTotal;

    float finalAlpha = clamp(crescent + aureoleTotal * 0.85, 0.0, 1.0);

    if (finalAlpha < 0.005) {
      discard;
    }

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function createCrescentMoonMaterial(customUniforms?: Partial<{
  glowIntensity: number;
  aureoleSpeed: number;
  moonColor: string | THREE.Color;
  aureoleColor: string | THREE.Color;
  rimColor: string | THREE.Color;
}>): THREE.ShaderMaterial {
  const uniforms: CrescentMoonUniforms = {
    uTime: { value: 0.0 },
    uGlowIntensity: { value: customUniforms?.glowIntensity ?? 1.1 },
    uAureoleSpeed: { value: customUniforms?.aureoleSpeed ?? 1.2 },
    uBassEnergy: { value: 0.0 },
    uMoonColor: {
      value: customUniforms?.moonColor instanceof THREE.Color
        ? customUniforms.moonColor
        : new THREE.Color(customUniforms?.moonColor ?? '#fff9d2')
    },
    uAureoleColor: {
      value: customUniforms?.aureoleColor instanceof THREE.Color
        ? customUniforms.aureoleColor
        : new THREE.Color(customUniforms?.aureoleColor ?? '#fca311')
    },
    uRimColor: {
      value: customUniforms?.rimColor instanceof THREE.Color
        ? customUniforms.rimColor
        : new THREE.Color(customUniforms?.rimColor ?? '#ffb703')
    }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: crescentMoonVertexShader,
    fragmentShader: crescentMoonFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
