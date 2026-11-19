import * as THREE from 'three';

export interface GhibliAnimeUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  tDiffuse: THREE.IUniform<THREE.Texture | null>;
  uResolution: THREE.IUniform<THREE.Vector2>;
  uStrength: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

/**
 * Studio Ghibli Hand-Painted Gouache & Warm-Ink Cel Post-Processing Shader.
 *
 * Designed for real-time HDR linear-buffer post-processing (prior to UnrealBloomPass & OutputPass)
 * at >= 30 FPS:
 * 1. Soft edge-preserving bilateral gouache smoothing (9-tap core + 4 outer painterly diamond taps)
 *    that blends hillsides, plaster walls, ocean gradients, and clouds into soft watercolor washes
 *    while keeping architectural silhouettes, window muntins, and crisp specular sparkles intact.
 * 2. Subtle warm-sepia/slate (#2c2438) Sobel contour emphasis on strong geometric boundaries
 *    (never harsh black ink, and softly gated off high-luminance sun/water sparkles).
 * 3. Joe Hisaishi / Makoto Shinkai sunny pastel color grading: soft teal-cobalt shadow lift,
 *    vibrant lush greens, warm sunlit cream highlights, subtle cold-press paper tooth, and gentle
 *    cel-film halation glow.
 */
export const GhibliAnimeShader = {
  name: 'GhibliAnimeShader',

  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uStrength: { value: 1.0 },
    uTime: { value: 0.0 }
  } as GhibliAnimeUniforms,

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
    uniform float uStrength;
    uniform float uTime;

    varying vec2 vUv;

    float ghibliLuma(vec3 c) {
      return max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0);
    }

    vec3 toPerceptual(vec3 c) {
      vec3 safe = max(c, vec3(0.0));
      return sqrt(safe / (vec3(0.18) + safe));
    }

    float toPerceptualLuma(vec3 c) {
      float l = ghibliLuma(c);
      return l / (0.24 + l);
    }

    vec3 sampleScene(vec2 uv) {
      return max(texture2D(tDiffuse, clamp(uv, vec2(0.0005), vec2(0.9995))).rgb, vec3(0.0));
    }

    void main() {
      vec3 centerColor = sampleScene(vUv);
      float strength = clamp(uStrength, 0.0, 1.0);
      if (strength <= 0.001) {
        gl_FragColor = vec4(centerColor, 1.0);
        return;
      }

      vec2 res = max(uResolution, vec2(1.0));
      float dprScale = clamp(min(res.x, res.y) / 840.0, 1.0, 1.75);
      vec2 px = dprScale / res;

      // 1. Compact 3x3 Neighborhood for Sobel Warm-Ink Edge Detection & Core Bilateral Smoothing
      vec2 ePx = px * 1.05;
      vec3 c00 = sampleScene(vUv + vec2(-1.0, -1.0) * ePx);
      vec3 c10 = sampleScene(vUv + vec2( 0.0, -1.0) * ePx);
      vec3 c20 = sampleScene(vUv + vec2( 1.0, -1.0) * ePx);
      vec3 c01 = sampleScene(vUv + vec2(-1.0,  0.0) * ePx);
      vec3 c21 = sampleScene(vUv + vec2( 1.0,  0.0) * ePx);
      vec3 c02 = sampleScene(vUv + vec2(-1.0,  1.0) * ePx);
      vec3 c12 = sampleScene(vUv + vec2( 0.0,  1.0) * ePx);
      vec3 c22 = sampleScene(vUv + vec2( 1.0,  1.0) * ePx);

      // 4 outer painterly diamond taps for soft gouache brush-wash smoothness
      vec3 o0 = sampleScene(vUv + vec2( 2.15,  0.90) * px);
      vec3 o1 = sampleScene(vUv + vec2(-0.90,  2.15) * px);
      vec3 o2 = sampleScene(vUv + vec2(-2.15, -0.90) * px);
      vec3 o3 = sampleScene(vUv + vec2( 0.90, -2.15) * px);

      // Edge-preserving bilateral weighting in perceptual space
      vec3 pCenter = toPerceptual(centerColor);
      float centerLum = ghibliLuma(centerColor);
      float highlightPreserve = smoothstep(0.62, 1.15, centerLum);

      vec3 accumColor = centerColor * 1.35;
      float accumWeight = 1.35;

      // Helper weighting: preserves crisp edges & window bars while smoothing flat surfaces
      vec3 diff;
      float dist2;
      float w;

      diff = toPerceptual(c10) - pCenter; dist2 = dot(diff, diff);
      w = 0.85 * exp(-dist2 * 52.0); accumColor += c10 * w; accumWeight += w;

      diff = toPerceptual(c01) - pCenter; dist2 = dot(diff, diff);
      w = 0.85 * exp(-dist2 * 52.0); accumColor += c01 * w; accumWeight += w;

      diff = toPerceptual(c21) - pCenter; dist2 = dot(diff, diff);
      w = 0.85 * exp(-dist2 * 52.0); accumColor += c21 * w; accumWeight += w;

      diff = toPerceptual(c12) - pCenter; dist2 = dot(diff, diff);
      w = 0.85 * exp(-dist2 * 52.0); accumColor += c12 * w; accumWeight += w;

      diff = toPerceptual(c00) - pCenter; dist2 = dot(diff, diff);
      w = 0.62 * exp(-dist2 * 56.0); accumColor += c00 * w; accumWeight += w;

      diff = toPerceptual(c20) - pCenter; dist2 = dot(diff, diff);
      w = 0.62 * exp(-dist2 * 56.0); accumColor += c20 * w; accumWeight += w;

      diff = toPerceptual(c02) - pCenter; dist2 = dot(diff, diff);
      w = 0.62 * exp(-dist2 * 56.0); accumColor += c02 * w; accumWeight += w;

      diff = toPerceptual(c22) - pCenter; dist2 = dot(diff, diff);
      w = 0.62 * exp(-dist2 * 56.0); accumColor += c22 * w; accumWeight += w;

      diff = toPerceptual(o0) - pCenter; dist2 = dot(diff, diff);
      w = 0.50 * exp(-dist2 * 64.0); accumColor += o0 * w; accumWeight += w;

      diff = toPerceptual(o1) - pCenter; dist2 = dot(diff, diff);
      w = 0.50 * exp(-dist2 * 64.0); accumColor += o1 * w; accumWeight += w;

      diff = toPerceptual(o2) - pCenter; dist2 = dot(diff, diff);
      w = 0.50 * exp(-dist2 * 64.0); accumColor += o2 * w; accumWeight += w;

      diff = toPerceptual(o3) - pCenter; dist2 = dot(diff, diff);
      w = 0.50 * exp(-dist2 * 64.0); accumColor += o3 * w; accumWeight += w;

      vec3 gouacheColor = accumColor / max(accumWeight, 1e-4);
      // Keep specular water glints & sun highlights razor crisp
      vec3 smoothed = mix(centerColor, gouacheColor, 0.88 * (1.0 - 0.78 * highlightPreserve));

      // 2. Subtle Warm-Ink Sobel Contour Emphasis (#2c2438 warm sepia/slate, never harsh black)
      float l00 = toPerceptualLuma(c00);
      float l10 = toPerceptualLuma(c10);
      float l20 = toPerceptualLuma(c20);
      float l01 = toPerceptualLuma(c01);
      float l21 = toPerceptualLuma(c21);
      float l02 = toPerceptualLuma(c02);
      float l12 = toPerceptualLuma(c12);
      float l22 = toPerceptualLuma(c22);

      float gxL = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
      float gyL = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
      float lumaEdge = sqrt(gxL * gxL + gyL * gyL) * 0.25;

      // Chromatic Sobel assists soft color boundaries (e.g., red roof against teal hills)
      vec3 gxC = (toPerceptual(c20) + 2.0 * toPerceptual(c21) + toPerceptual(c22))
               - (toPerceptual(c00) + 2.0 * toPerceptual(c01) + toPerceptual(c02));
      vec3 gyC = (toPerceptual(c02) + 2.0 * toPerceptual(c12) + toPerceptual(c22))
               - (toPerceptual(c00) + 2.0 * toPerceptual(c10) + toPerceptual(c20));
      float chromaEdge = sqrt(dot(gxC, gxC) + dot(gyC, gyC)) * 0.14;

      float rawEdge = max(lumaEdge, chromaEdge);
      float inkMask = smoothstep(0.085, 0.28, rawEdge) * (1.0 - 0.82 * highlightPreserve);
      // Warm sepia/slate #2c2438 converted to linear RGB
      vec3 warmInkColor = vec3(0.025, 0.017, 0.040);
      vec3 inkedColor = mix(smoothed, warmInkColor, clamp(inkMask * 0.34, 0.0, 0.36));

      // 3. Joe Hisaishi / Makoto Shinkai Sunny Pastel Color Grading
      float inkedLum = ghibliLuma(inkedColor);

      // Soft teal-cobalt shadow lift (keeps shadows luminous like hand-painted gouache)
      float shadowMask = 1.0 - smoothstep(0.02, 0.24, inkedLum);
      vec3 shadowTint = vec3(0.008, 0.018, 0.032);
      vec3 graded = inkedColor + shadowTint * shadowMask;

      // Warm sunlit cream highlight warmth
      float hiMask = smoothstep(0.28, 0.88, inkedLum);
      graded *= mix(vec3(0.985, 0.995, 1.02), vec3(1.035, 1.015, 0.965), hiMask);

      // Vibrant lush foliage greens & gentle overall pastel saturation boost
      float gLum = ghibliLuma(graded);
      float greenDominance = smoothstep(0.01, 0.14, graded.g - max(graded.r, graded.b));
      vec3 vib = mix(vec3(gLum), graded, 1.11 + greenDominance * 0.08);
      graded = max(vib, vec3(0.0));

      // Gentle cel-film halation glow reserved strictly for sunlit/HDR highlights
      vec3 haloSample = (o0 + o1 + o2 + o3) * 0.25;
      float haloLum = ghibliLuma(haloSample);
      float haloMask = smoothstep(0.78, 1.32, haloLum);
      graded += haloSample * vec3(1.05, 0.96, 0.88) * haloMask * 0.055;

      // Subtle cold-press watercolor paper tooth in midtones (prevents flat digital look)
      vec2 paperCoord = gl_FragCoord.xy * (0.72 / dprScale);
      float tooth = sin(paperCoord.x * 0.95 + sin(paperCoord.y * 0.45) * 1.4)
                  * cos(paperCoord.y * 0.90 - cos(paperCoord.x * 0.42) * 1.4);
      float midtoneMask = smoothstep(0.04, 0.18, inkedLum) * (1.0 - highlightPreserve * 0.85);
      float shimmer = 1.0 + 0.012 * tooth * midtoneMask * (0.97 + 0.03 * sin(uTime * 0.4));
      graded *= shimmer;

      vec3 finalColor = mix(centerColor, max(graded, vec3(0.0)), strength);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};
