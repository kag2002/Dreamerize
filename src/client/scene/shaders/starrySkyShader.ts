import * as THREE from 'three';

export interface StarrySkyUniforms {
  [key: string]: THREE.IUniform;
  uTime: { value: number };
  uSwirlSpeed: { value: number };
  uTopColor: { value: THREE.Color };
  uBottomColor: { value: THREE.Color };
  uHorizonColor: { value: THREE.Color };
  uStreamColor: { value: THREE.Color };
  uHighlightColor: { value: THREE.Color };
  uImpastoStrength: { value: number };
  uAudioReactivity: { value: number };
  uBassEnergy: { value: number };
}

export const starrySkyVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normal;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const starrySkyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSwirlSpeed;
  uniform vec3 uTopColor;
  uniform vec3 uBottomColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uStreamColor;
  uniform vec3 uHighlightColor;
  uniform float uImpastoStrength;
  uniform float uBassEnergy;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.13, 0.27, 0.19));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }

  float snoise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * snoise3(p);
      p = p * 2.02 + vec3(13.7, 29.1, 19.3);
      a *= 0.5;
    }
    return v;
  }

  // Rodrigues rotation around a 3D unit axis: completely seam-free on the full 360° sphere
  vec3 rotateAxis(vec3 v, vec3 k, float a) {
    float c = cos(a);
    float s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
  }

  vec3 applyVortex3D(vec3 p, vec3 axis, float strength, float falloff, float timeShift) {
    vec3 diff = p - axis;
    float d2 = dot(diff, diff);
    float influence = exp(-d2 * falloff);
    float angle = strength * influence / (sqrt(d2) + 0.16) + timeShift * influence;
    return normalize(rotateAxis(p, axis, angle));
  }

  float sampleFlow(vec3 pDir, float t) {
    vec3 q = vec3(
      fbm3(pDir * 2.1 + vec3(0.05 * t, 0.03 * t, -0.04 * t)),
      fbm3(pDir * 2.1 + vec3(4.2, 9.1, 2.7) - 0.03 * t),
      fbm3(pDir * 2.1 + vec3(7.9, 1.4, 6.3) + 0.04 * t)
    );
    vec3 r = vec3(
      fbm3(pDir * 2.6 + 1.9 * q + vec3(0.06 * t, -0.03 * t, 0.04 * t)),
      fbm3(pDir * 2.6 + 1.9 * q + vec3(8.3, 2.8, 5.1) - 0.04 * t),
      fbm3(pDir * 2.6 + 1.9 * q + vec3(3.1, 6.7, 9.4) + 0.03 * t)
    );
    return fbm3(pDir * 2.9 + 2.1 * r);
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float t = uTime * 0.14 * uSwirlSpeed;

    // Four 3D unit-sphere vortex centers wrapping seamlessly across all 360° azimuths (no atan cut)
    vec3 v1 = normalize(vec3( 0.08, 0.38, -0.92)); // Great Central Starry Night Spiral (-Z)
    vec3 v2 = normalize(vec3(-0.44, 0.19, -0.88)); // Western Counter-Swirl (-X/-Z)
    vec3 v3 = normalize(vec3( 0.74, 0.28,  0.61)); // Eastern-Southern Swirl (+X/+Z)
    vec3 v4 = normalize(vec3(-0.58, 0.34,  0.74)); // Rear Milky Way Vortex (-X/+Z)

    vec3 pDir = dir;
    float pulse = 1.0 + 0.12 * sin(0.35 * uTime * uSwirlSpeed);
    pDir = applyVortex3D(pDir, v1,  1.25 * pulse, 2.4,  0.18 * t);
    pDir = applyVortex3D(pDir, v2, -0.95 * pulse, 2.8, -0.14 * t);
    pDir = applyVortex3D(pDir, v3,  1.05 * pulse, 2.5,  0.16 * t);
    pDir = applyVortex3D(pDir, v4, -1.00 * pulse, 2.6, -0.15 * t);

    float flow = sampleFlow(pDir, t);

    // Spherical-tangent finite-difference gradient for seam-free curved oil brushstrokes
    float eps = 0.035;
    float fx = sampleFlow(normalize(pDir + vec3(eps, 0.0, 0.0)), t) - flow;
    float fy = sampleFlow(normalize(pDir + vec3(0.0, eps, 0.0)), t) - flow;
    float fz = sampleFlow(normalize(pDir + vec3(0.0, 0.0, eps)), t) - flow;
    vec3 grad3 = vec3(fx, fy, fz);
    vec3 surfGrad = grad3 - pDir * dot(grad3, pDir);
    vec3 flowTangent = normalize(cross(pDir, surfGrad + vec3(0.0001, 0.0002, 0.0001)));

    // Anti-aliased painterly oil brushstroke ribbons flowing along the 3D curl stream
    float ribbonPhase = flow * 28.0 + snoise3(pDir * 10.5) * 3.6 - t * 1.4;
    float ribbonWave = sin(ribbonPhase);
    float dashEnvelope = smoothstep(0.16, 0.84, snoise3(pDir * 18.0 - flowTangent * (t * 1.45)));
    float impasto = smoothstep(-0.34, 0.84, ribbonWave) * (0.42 + 0.58 * dashEnvelope) * uImpastoStrength;

    // Rich Van Gogh nocturnal palette (linear RGB for HDR OutputPass ACESFilmic + sRGB)
    float heightFactor = clamp(dir.y * 1.15 + 0.12, 0.0, 1.0);
    vec3 baseSky = mix(uHorizonColor, mix(uBottomColor, uTopColor, heightFactor), smoothstep(0.0, 0.42, heightFactor));

    vec3 deepCobalt = vec3(0.008, 0.048, 0.34);
    baseSky = mix(baseSky, deepCobalt, smoothstep(0.22, 0.72, flow) * 0.72);

    float streamMask = smoothstep(0.35, 0.72, flow);
    vec3 skyColor = mix(baseSky, uStreamColor * 0.75, streamMask * 0.82);

    // Warm yellow-ochre luminous wind curls & moonlit cyan ribbons (kept below bloom threshold)
    float safeBass = clamp(uBassEnergy, 0.0, 1.5);
    float goldMask = smoothstep(0.58, 0.88, flow + impasto * 0.34);
    skyColor = mix(skyColor, uHighlightColor * 0.56, goldMask * (0.48 + safeBass * 0.14));

    // Thick impasto oil ridge sheen & dark Prussian groove contrast between brush strokes
    skyColor += (impasto - 0.38) * 0.14 * mix(uStreamColor * 0.78, uHighlightColor * 0.58, goldMask);
    // Subtle moonlit horizon lift so distant mountain silhouettes sit against luminous indigo-cobalt air
    float horizonGlow = exp(-abs(dir.y) * 7.5);
    skyColor += vec3(0.032, 0.072, 0.18) * horizonGlow;
    skyColor = clamp(skyColor, vec3(0.008), vec3(0.56));

    // 360° Distant Painted Starry Halos & Twinkling Micro-Stars across side/rear/zenith skies
    // Uses 3x3x3 neighbor cell traversal so no star glow is ever clipped at cubic grid boundaries
    if (dir.y > 0.03) {
      float elevFade = smoothstep(0.03, 0.16, dir.y);
      // Softly suppress shader macro-stars directly inside the front hero quad region so StarHalo_1..11 remain clean
      float heroZone = smoothstep(-0.15, -0.72, dir.z) * smoothstep(0.66, 0.18, dir.y);
      float surroundMask = mix(1.0, 0.18, heroZone);

      // Coarse painted Van Gogh star halos (3x3x3 Euclidean voxel traversal - 100% cut-free)
      vec3 g1 = dir * 12.0;
      vec3 cell1 = floor(g1);
      for (int dz = -1; dz <= 1; dz++) {
        for (int dy = -1; dy <= 1; dy++) {
          for (int dx = -1; dx <= 1; dx++) {
            vec3 nCell = cell1 + vec3(float(dx), float(dy), float(dz));
            vec3 rnd1 = hash33(nCell);
            if (rnd1.x > 0.93) {
              vec3 starCenter = nCell + 0.30 + 0.40 * rnd1;
              float angDist = length(g1 - starCenter);
              if (angDist < 0.78) {
                float twinkle = 0.84 + 0.16 * sin(uTime * (1.8 + rnd1.y * 2.2) + rnd1.z * 12.0);
                float edgeSmooth = smoothstep(0.78, 0.18, angDist);
                float starCore = exp(-(angDist * angDist) * 32.0);
                float haloRing = pow(cos(angDist * 13.0 - uTime * 1.3), 2.0) * exp(-angDist * 4.5) * edgeSmooth;
                vec3 starTint = mix(vec3(1.0, 0.90, 0.52), vec3(0.76, 0.92, 1.0), rnd1.y * 0.35);
                skyColor += (starCore * 1.15 + haloRing * 0.48) * starTint * twinkle * elevFade * surroundMask;
              }
            }
          }
        }
      }

      // Fine crisp background twinkling stars across all 360° (3x3x3 Euclidean voxel traversal)
      vec3 g2 = dir * 34.0;
      vec3 cell2 = floor(g2);
      for (int dz = -1; dz <= 1; dz++) {
        for (int dy = -1; dy <= 1; dy++) {
          for (int dx = -1; dx <= 1; dx++) {
            vec3 nCell2 = cell2 + vec3(float(dx), float(dy), float(dz));
            vec3 rnd2 = hash33(nCell2);
            if (rnd2.x > 0.945) {
              vec3 microCenter = nCell2 + 0.30 + 0.40 * rnd2;
              float dMicro = length(g2 - microCenter);
              if (dMicro < 0.45) {
                float microTwinkle = 0.68 + 0.32 * sin(uTime * (2.4 + rnd2.z * 3.0) + rnd2.y * 20.0);
                float microGlow = exp(-(dMicro * dMicro) * 26.0) * smoothstep(0.45, 0.10, dMicro);
                skyColor += vec3(1.0, 0.96, 0.80) * microGlow * microTwinkle * elevFade * 0.72;
              }
            }
          }
        }
      }
    }

    gl_FragColor = vec4(skyColor, 1.0);
  }
`;

export function createStarrySkyMaterial(customUniforms?: Partial<{
  swirlSpeed: number;
  topColor: string | THREE.Color;
  bottomColor: string | THREE.Color;
  horizonColor: string | THREE.Color;
  streamColor: string | THREE.Color;
  highlightColor: string | THREE.Color;
  impastoStrength: number;
}>): THREE.ShaderMaterial {
  const uniforms: StarrySkyUniforms = {
    uTime: { value: 0.0 },
    uSwirlSpeed: { value: customUniforms?.swirlSpeed ?? 1.2 },
    uTopColor: {
      value: customUniforms?.topColor instanceof THREE.Color
        ? customUniforms.topColor
        : new THREE.Color(customUniforms?.topColor ?? '#081542')
    },
    uBottomColor: {
      value: customUniforms?.bottomColor instanceof THREE.Color
        ? customUniforms.bottomColor
        : new THREE.Color(customUniforms?.bottomColor ?? '#1f3e78')
    },
    uHorizonColor: {
      value: customUniforms?.horizonColor instanceof THREE.Color
        ? customUniforms.horizonColor
        : new THREE.Color(customUniforms?.horizonColor ?? '#285249')
    },
    uStreamColor: {
      value: customUniforms?.streamColor instanceof THREE.Color
        ? customUniforms.streamColor
        : new THREE.Color(customUniforms?.streamColor ?? '#6bc5ea')
    },
    uHighlightColor: {
      value: customUniforms?.highlightColor instanceof THREE.Color
        ? customUniforms.highlightColor
        : new THREE.Color(customUniforms?.highlightColor ?? '#f6db6b')
    },
    uImpastoStrength: { value: customUniforms?.impastoStrength ?? 0.72 },
    uAudioReactivity: { value: 1.0 },
    uBassEnergy: { value: 0.0 }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: starrySkyVertexShader,
    fragmentShader: starrySkyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false
  });
}
