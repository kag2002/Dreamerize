import * as THREE from 'three';

export interface AnisotropicKuwaharaUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  tDiffuse: THREE.IUniform<THREE.Texture | null>;
  uResolution: THREE.IUniform<THREE.Vector2>;
  uRadius: THREE.IUniform<number>;
  uSharpness: THREE.IUniform<number>;
  uAnisotropy: THREE.IUniform<number>;
  uImpastoRelief: THREE.IUniform<number>;
  uCanvasGrain: THREE.IUniform<number>;
  uPaintBlend: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

/**
 * Structure-Tensor Anisotropic Kuwahara + Physical Impasto Oil Relief Shader.
 *
 * Designed for real-time HDR linear-buffer post-processing (prior to UnrealBloomPass & OutputPass):
 * 1. Derives local edge orientation phi and anisotropy A from a compact 3x3 smoothed structure tensor.
 * 2. Samples 8 directional sectors in a rotated anisotropic elliptical brushstroke frame using
 *    constant GLSL-ES-3.00-safe loop bounds (-4..4) and inverse perceptual-variance weighting.
 * 3. Preserves crisp luminous highlights (stars, glowing windows, lantern flames) while transforming
 *    architecture, hills, cobblestones, foliage, and swirling skies into curved oil brushstrokes.
 * 4. Synthesizes 3D impasto ridge highlights from painted luminance slopes plus woven linen grain.
 */
export const AnisotropicKuwaharaShader = {
  name: 'AnisotropicKuwaharaShader',

  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uRadius: { value: 3.0 },
    uSharpness: { value: 7.0 },
    uAnisotropy: { value: 1.1 },
    uImpastoRelief: { value: 0.50 },
    uCanvasGrain: { value: 0.14 },
    uPaintBlend: { value: 0.74 },
    uTime: { value: 0.0 }
  } as AnisotropicKuwaharaUniforms,

  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uRadius;
    uniform float uSharpness;
    uniform float uAnisotropy;
    uniform float uImpastoRelief;
    uniform float uCanvasGrain;
    uniform float uPaintBlend;
    uniform float uTime;

    varying vec2 vUv;

    float calcLuma(vec3 c) {
      return max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0);
    }

    float calcPerceptualLuma(vec3 c) {
      float l = calcLuma(c);
      return l / (0.18 + l);
    }

    vec3 sampleHDR(vec2 uv) {
      return max(texture2D(tDiffuse, clamp(uv, vec2(0.0005), vec2(0.9995))).rgb, vec3(0.0));
    }

    void main() {
      vec2 res = max(uResolution, vec2(1.0));
      // Keep brushstroke size consistent across 1x and Retina/HiDPI render targets
      float dprScale = clamp(min(res.x, res.y) / 840.0, 1.0, 1.75);
      vec2 px = dprScale / res;

      vec3 centerColor = sampleHDR(vUv);

      // Early exit if painterly filtering & surface textures are disabled
      if (uRadius <= 0.5 && uPaintBlend <= 0.001 && uImpastoRelief <= 0.001 && uCanvasGrain <= 0.001) {
        gl_FragColor = vec4(centerColor, 1.0);
        return;
      }

      // 1. Compact 3x3 Structure Tensor Neighborhood (9 taps total including center)
      vec2 tPx = px * 1.15;
      vec3 c00 = sampleHDR(vUv + vec2(-1.0, -1.0) * tPx);
      vec3 c10 = sampleHDR(vUv + vec2( 0.0, -1.0) * tPx);
      vec3 c20 = sampleHDR(vUv + vec2( 1.0, -1.0) * tPx);
      vec3 c01 = sampleHDR(vUv + vec2(-1.0,  0.0) * tPx);
      vec3 c21 = sampleHDR(vUv + vec2( 1.0,  0.0) * tPx);
      vec3 c02 = sampleHDR(vUv + vec2(-1.0,  1.0) * tPx);
      vec3 c12 = sampleHDR(vUv + vec2( 0.0,  1.0) * tPx);
      vec3 c22 = sampleHDR(vUv + vec2( 1.0,  1.0) * tPx);

      float l00 = calcPerceptualLuma(c00);
      float l10 = calcPerceptualLuma(c10);
      float l20 = calcPerceptualLuma(c20);
      float l01 = calcPerceptualLuma(c01);
      float l11 = calcPerceptualLuma(centerColor);
      float l21 = calcPerceptualLuma(c21);
      float l02 = calcPerceptualLuma(c02);
      float l12 = calcPerceptualLuma(c12);
      float l22 = calcPerceptualLuma(c22);

      // Local raw mean luminance for crisp star/window/lantern highlight isolation
      float localMeanRawLum = (
        calcLuma(c00) + calcLuma(c10) + calcLuma(c20) +
        calcLuma(c01) + calcLuma(c21) +
        calcLuma(c02) + calcLuma(c12) + calcLuma(c22)
      ) * 0.125;

      // Sobel center gradient + 4 overlapping 2x2 sub-cell gradients smoothed across the 3x3 patch
      float gxCenter = ((l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02)) * 0.25;
      float gyCenter = ((l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20)) * 0.25;

      float gxA = (l10 + l11 - l00 - l01) * 0.5;
      float gyA = (l01 + l11 - l00 - l10) * 0.5;

      float gxB = (l20 + l21 - l10 - l11) * 0.5;
      float gyB = (l11 + l21 - l10 - l20) * 0.5;

      float gxC = (l11 + l12 - l01 - l02) * 0.5;
      float gyC = (l02 + l12 - l01 - l11) * 0.5;

      float gxD = (l21 + l22 - l11 - l12) * 0.5;
      float gyD = (l12 + l22 - l11 - l21) * 0.5;

      float Jxx = gxCenter * gxCenter * 0.4 + (gxA * gxA + gxB * gxB + gxC * gxC + gxD * gxD) * 0.15;
      float Jxy = gxCenter * gyCenter * 0.4 + (gxA * gyA + gxB * gyB + gxC * gyC + gxD * gyD) * 0.15;
      float Jyy = gyCenter * gyCenter * 0.4 + (gyA * gyA + gyB * gyB + gyC * gyC + gyD * gyD) * 0.15;

      // Eigenvalues of symmetric 2x2 tensor [[Jxx, Jxy], [Jxy, Jyy]]
      float trace = Jxx + Jyy;
      float diff = Jxx - Jyy;
      float disc = sqrt(max(diff * diff + 4.0 * Jxy * Jxy, 0.0));
      float lambda1 = 0.5 * (trace + disc);
      float lambda2 = 0.5 * (trace - disc);

      // Singularity-free gradient eigenvector -> tangent direction along contour
      vec2 gradCandidate = (Jxx >= Jyy) ? vec2(lambda1 - Jyy, Jxy) : vec2(Jxy, lambda1 - Jxx);
      float fallbackAngle = 0.52 + 0.03 * sin(uTime * 0.35);
      vec2 fallbackGrad = vec2(-sin(fallbackAngle), cos(fallbackAngle));
      vec2 gradDir = (dot(gradCandidate, gradCandidate) > 1e-9) ? normalize(gradCandidate) : fallbackGrad;
      vec2 tangent = vec2(-gradDir.y, gradDir.x);
      vec2 normal = gradDir;

      // Anisotropy A in [0, 1] -> stretch brush along tangent, narrow across normal
      float anisotropyFactor = (lambda1 + lambda2 > 1e-6) ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0.0;
      float anisoAmount = clamp(uAnisotropy, 0.0, 2.5);
      float scaleX = 1.0 + anisotropyFactor * anisoAmount;
      float scaleY = 1.0 / (1.0 + 0.65 * anisotropyFactor * anisoAmount);

      // 2. 8-Sector Rotated Anisotropic Kuwahara Filtering (constant GLSL-ES-3.00-safe loop bounds)
      vec3 m[8];
      vec3 s[8];
      float wSum[8];
      for (int k = 0; k < 8; k++) {
        m[k] = vec3(0.0);
        s[k] = vec3(0.0);
        wSum[k] = 0.0;
      }

      float maxR = clamp(uRadius, 1.0, 6.0);
      float latticeRadius = min(maxR, 4.0);
      float latticeR2 = latticeRadius * latticeRadius;
      float radiusStep = max(maxR / 4.0, 1.0);
      float invLatticeR = 1.0 / max(latticeRadius, 1.0);

      for (int j = -4; j <= 4; j++) {
        float fj = float(j);
        if (abs(fj) > latticeRadius) continue;

        for (int i = -4; i <= 4; i++) {
          float fi = float(i);
          if (abs(fi) > latticeRadius) continue;

          float r2 = fi * fi + fj * fj;
          if (r2 > latticeR2 || (i == 0 && j == 0)) continue;

          vec2 v = vec2(fi, fj) * invLatticeR;
          float g = exp(-3.125 * dot(v, v));

          vec2 offset = (tangent * (fi * scaleX) + normal * (fj * scaleY)) * radiusStep * px;
          vec3 c = sampleHDR(vUv + offset);
          // Perceptual gamma-2.0 color for variance: E[g^2] - E[g]^2 gives exact perceptual variance
          // while s[k] preserves exact linear HDR color averages.
          vec3 cGamma = sqrt(c);

          vec2 vr = 0.70710678 * vec2(v.x + v.y, -v.x + v.y);
          float zeta = 1.41421356;

          float z0 = max(0.0,  v.x  - zeta * v.y  * v.y);
          float z1 = max(0.0,  vr.x - zeta * vr.y * vr.y);
          float z2 = max(0.0,  v.y  - zeta * v.x  * v.x);
          float z3 = max(0.0,  vr.y - zeta * vr.x * vr.x);
          float z4 = max(0.0, -v.x  - zeta * v.y  * v.y);
          float z5 = max(0.0, -vr.x - zeta * vr.y * vr.y);
          float z6 = max(0.0, -v.y  - zeta * v.x  * v.x);
          float z7 = max(0.0, -vr.y - zeta * vr.x * vr.x);

          float sw0 = z0 * z0 * g;
          float sw1 = z1 * z1 * g;
          float sw2 = z2 * z2 * g;
          float sw3 = z3 * z3 * g;
          float sw4 = z4 * z4 * g;
          float sw5 = z5 * z5 * g;
          float sw6 = z6 * z6 * g;
          float sw7 = z7 * z7 * g;

          m[0] += cGamma * sw0; s[0] += c * sw0; wSum[0] += sw0;
          m[1] += cGamma * sw1; s[1] += c * sw1; wSum[1] += sw1;
          m[2] += cGamma * sw2; s[2] += c * sw2; wSum[2] += sw2;
          m[3] += cGamma * sw3; s[3] += c * sw3; wSum[3] += sw3;
          m[4] += cGamma * sw4; s[4] += c * sw4; wSum[4] += sw4;
          m[5] += cGamma * sw5; s[5] += c * sw5; wSum[5] += sw5;
          m[6] += cGamma * sw6; s[6] += c * sw6; wSum[6] += sw6;
          m[7] += cGamma * sw7; s[7] += c * sw7; wSum[7] += sw7;
        }
      }

      vec3 centerGamma = sqrt(centerColor);
      vec3 kuwaharaSum = vec3(0.0);
      float kuwaharaWeight = 0.0;
      float sLum[8];
      float sharp = clamp(uSharpness, 1.0, 14.0);

      for (int k = 0; k < 8; k++) {
        float invW = 1.0 / (wSum[k] + 0.08);
        vec3 meanGamma = (m[k] + centerGamma * 0.08) * invW;
        vec3 meanHDR = (s[k] + centerColor * 0.08) * invW;

        sLum[k] = dot(meanGamma, vec3(0.2126, 0.7152, 0.0722));

        vec3 varVec = max(meanHDR - meanGamma * meanGamma, vec3(0.0));
        float sigma2 = (varVec.r + varVec.g + varVec.b) * 0.333333;
        float sigma = sqrt(sigma2);

        float sectorWeight = max(pow(0.03 / (min(sigma, 1.5) + 0.03), sharp), 1e-5);
        kuwaharaSum += meanHDR * sectorWeight;
        kuwaharaWeight += sectorWeight;
      }

      vec3 kuwaharaColor = kuwaharaSum / max(kuwaharaWeight, 1e-5);

      // 3. Crisp Highlight Preservation (keep stars, glowing window panes, lantern flames sharp)
      float centerLum = calcLuma(centerColor);
      float highLumMask = smoothstep(0.46, 0.92, centerLum);
      float sparkMask = smoothstep(0.06, 0.24, centerLum - localMeanRawLum) * smoothstep(0.20, 0.52, centerLum);
      float highlightPreserve = clamp(max(highLumMask, sparkMask), 0.0, 1.0);

      float paintStrength = clamp(uPaintBlend * (1.0 - 0.88 * highlightPreserve), 0.0, 1.0);
      vec3 paintedColor = mix(centerColor, kuwaharaColor, paintStrength);

      // 4. Physical Impasto Relief from painted luminance slope + raking moonlight
      if (uImpastoRelief > 0.001) {
        float slopeT = (sLum[0] - sLum[4]) + 0.5 * (sLum[1] + sLum[7] - sLum[3] - sLum[5]);
        float slopeN = (sLum[2] - sLum[6]) + 0.5 * (sLum[1] + sLum[3] - sLum[5] - sLum[7]);
        vec2 macroSlope = tangent * slopeT + normal * slopeN;

        float paintedPercLum = calcPerceptualLuma(paintedColor);
        vec2 edgeSlope = clamp(vec2(dFdx(paintedPercLum), dFdy(paintedPercLum)), -0.14, 0.14);
        vec2 totalSlope = macroSlope * 0.85 + edgeSlope * 0.45;

        vec2 lightDir2D = normalize(vec2(0.62, 0.78));
        float rawRidge = dot(totalSlope, lightDir2D) * 1.8;
        float rakingLight = rawRidge / (1.0 + abs(rawRidge));

        float shadowGate = smoothstep(0.028, 0.14, centerLum) * (1.0 - 0.75 * highlightPreserve);
        float breathe = 0.96 + 0.04 * sin(uTime * 0.75);
        float reliefAmt = uImpastoRelief * shadowGate * breathe;

        paintedColor *= (1.0 + rakingLight * reliefAmt * 0.24);
        paintedColor += max(rakingLight, 0.0) * reliefAmt * (0.22 * paintedColor + vec3(0.003, 0.0035, 0.004));
      }

      // 5. Ultra-Subtle Fine Woven Linen Canvas Micro-Texture
      if (uCanvasGrain > 0.001) {
        vec2 canvasCoord = gl_FragCoord.xy * (1.05 / dprScale);
        vec2 cell = floor(canvasCoord * 0.5);
        float threadHash = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        float warp = sin(canvasCoord.x * 3.14159265 + threadHash * 0.45);
        float weft = sin(canvasCoord.y * 3.14159265 - threadHash * 0.45);
        float weave = (warp * 0.5 + weft * 0.5) * 0.65 + (threadHash - 0.5) * 0.35;
        float grainMask = (1.0 - 0.85 * highlightPreserve);
        paintedColor *= (1.0 + weave * uCanvasGrain * 0.11 * grainMask);
      }

      gl_FragColor = vec4(max(paintedColor, vec3(0.0)), 1.0);
    }
  `
};
