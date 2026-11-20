import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { RenderStyleMode } from '../../../shared/types/space';

export type CinematicQualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface RenderStatsSnapshot {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  postProcessing: boolean;
  timestamp: number;
}

export interface AtmosphereOverrides {
  sunScreenPos?: THREE.Vector2 | { x: number; y: number } | [number, number] | null;
  godRayStrength?: number | null;
  exposureBias?: number;
  letterbox?: number;
}

const AutoExposureShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tPrevExposure: { value: null as THREE.Texture | null },
    uAdaptRate: { value: 0.12 },
    uFirstFrame: { value: 1.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrevExposure;
    uniform float uAdaptRate;
    uniform float uFirstFrame;
    varying vec2 vUv;

    void main() {
      float sumLogLuma = 0.0;
      float totalWeight = 0.0;

      for (int iy = 0; iy < 4; iy++) {
        for (int ix = 0; ix < 4; ix++) {
          vec2 sampleUv = vec2(0.16 + float(ix) * 0.226, 0.16 + float(iy) * 0.226);
          vec3 col = max(texture2D(tDiffuse, sampleUv).rgb, vec3(0.0));
          float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
          // Weight horizon and central subject higher than top sky zenith
          float w = 1.0 - 0.35 * length(sampleUv - vec2(0.5, 0.45));
          sumLogLuma += log2(clamp(luma, 0.045, 3.5)) * w;
          totalWeight += w;
        }
      }

      float avgLuma = exp2(sumLogLuma / max(totalWeight, 0.001));
      // Conservative key curve so Paradise marble & sunlit skies never blow out
      float rawRatio = 0.38 / max(avgLuma, 0.10);
      float targetExp = clamp(pow(rawRatio, 0.32), 0.86, 1.14);

      vec2 prevRG = texture2D(tPrevExposure, vec2(0.5)).rg;
      float prevNorm = prevRG.r + prevRG.g / 255.0;
      float prevExp = mix(0.5, 1.5, clamp(prevNorm, 0.0, 1.0));
      if (uFirstFrame > 0.5) {
        prevExp = 1.0;
      }

      float adapted = mix(prevExp, targetExp, clamp(uAdaptRate, 0.01, 1.0));
      float norm = clamp(adapted - 0.5, 0.0, 1.0);
      float hi = floor(norm * 255.0) / 255.0;
      float lo = clamp((norm - hi) * 255.0, 0.0, 1.0);
      gl_FragColor = vec4(hi, lo, adapted * 0.5, 1.0);
    }
  `
};

const NaturalPhotorealShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    tAutoExposure: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 1000.0 },
    uStrength: { value: 1.0 },
    uSunScreenPos: { value: new THREE.Vector2(0.72, 0.78) },
    uGodRayStrength: { value: 0.14 },
    uAutoExposureStrength: { value: 1.0 },
    uExposureBias: { value: 1.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tAutoExposure;
    uniform vec2 uResolution;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform float uStrength;
    uniform vec2 uSunScreenPos;
    uniform float uGodRayStrength;
    uniform float uAutoExposureStrength;
    uniform float uExposureBias;
    varying vec2 vUv;

    float readLinearDepth(vec2 coord) {
      float fragCoordZ = texture2D(tDepth, clamp(coord, vec2(0.001), vec2(0.999))).x;
      float viewZ = perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
      return -viewZ;
    }

    float hdrLuma(vec3 c) {
      vec3 tm = max(c, vec3(0.0)) / (1.0 + max(c, vec3(0.0)));
      return dot(tm, vec3(0.299, 0.587, 0.114));
    }

    vec3 fastFxaa(vec2 uv, vec2 texel, vec3 centerRgb, out vec3 avgCorners) {
      vec3 rgbNW = texture2D(tDiffuse, clamp(uv + vec2(-1.0, -1.0) * texel, vec2(0.001), vec2(0.999))).rgb;
      vec3 rgbNE = texture2D(tDiffuse, clamp(uv + vec2( 1.0, -1.0) * texel, vec2(0.001), vec2(0.999))).rgb;
      vec3 rgbSW = texture2D(tDiffuse, clamp(uv + vec2(-1.0,  1.0) * texel, vec2(0.001), vec2(0.999))).rgb;
      vec3 rgbSE = texture2D(tDiffuse, clamp(uv + vec2( 1.0,  1.0) * texel, vec2(0.001), vec2(0.999))).rgb;
      avgCorners = (rgbNW + rgbNE + rgbSW + rgbSE) * 0.25;

      float lumaM  = hdrLuma(centerRgb);
      float lumaNW = hdrLuma(rgbNW);
      float lumaNE = hdrLuma(rgbNE);
      float lumaSW = hdrLuma(rgbSW);
      float lumaSE = hdrLuma(rgbSE);

      float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
      float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
      float lumaRange = lumaMax - lumaMin;

      if (lumaRange < max(0.028, lumaMax * 0.09)) {
        return centerRgb;
      }

      vec2 dir;
      dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
      dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

      float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.03125, 0.0078125);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcpDirMin, vec2(-6.0), vec2(6.0)) * texel;

      vec3 rgbA = 0.5 * (
        texture2D(tDiffuse, clamp(uv + dir * (1.0 / 3.0 - 0.5), vec2(0.001), vec2(0.999))).rgb +
        texture2D(tDiffuse, clamp(uv + dir * (2.0 / 3.0 - 0.5), vec2(0.001), vec2(0.999))).rgb
      );
      vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D(tDiffuse, clamp(uv + dir * -0.5, vec2(0.001), vec2(0.999))).rgb +
        texture2D(tDiffuse, clamp(uv + dir *  0.5, vec2(0.001), vec2(0.999))).rgb
      );

      float lumaB = hdrLuma(rgbB);
      if (lumaB < lumaMin || lumaB > lumaMax) {
        return rgbA;
      }
      return rgbB;
    }

    vec3 computeGodRays(vec2 uv, vec2 sunPos, float strength) {
      if (strength <= 0.001) return vec3(0.0);

      float offX = max(0.0, max(-sunPos.x, sunPos.x - 1.0));
      float offY = max(0.0, max(-sunPos.y, sunPos.y - 1.0));
      float sunVis = 1.0 - smoothstep(0.15, 0.65, length(vec2(offX, offY)));
      if (sunVis <= 0.001) return vec3(0.0);

      vec2 deltaTexCoord = uv - sunPos;
      float distToSun = length(deltaTexCoord);
      float radialAtten = 1.0 - smoothstep(0.05, 1.15, distToSun);
      if (radialAtten <= 0.001) return vec3(0.0);

      const int NUM_SAMPLES = 14;
      float density = 0.88;
      float weight = 0.14;
      float decay = 0.91;

      vec2 stepUv = deltaTexCoord * (density / float(NUM_SAMPLES));
      float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec2 coord = uv - stepUv * jitter;

      float illuminationDecay = 1.0;
      vec3 accum = vec3(0.0);
      for (int i = 0; i < NUM_SAMPLES; i++) {
        coord -= stepUv;
        vec2 cUv = clamp(coord, vec2(0.001), vec2(0.999));
        float d = texture2D(tDepth, cUv).x;
        float skyMask = smoothstep(0.992, 0.9995, d);
        vec3 sCol = max(texture2D(tDiffuse, cUv).rgb, vec3(0.0));
        float sLuma = dot(sCol, vec3(0.2126, 0.7152, 0.0722));
        float brightGate = smoothstep(0.45, 1.6, sLuma);
        vec3 raySample = min(sCol, vec3(2.2)) * skyMask * brightGate;
        accum += raySample * illuminationDecay * weight;
        illuminationDecay *= decay;
      }

      return accum * strength * sunVis * radialAtten * 0.35;
    }

    float computeTotalExposure() {
      float autoExposure = 1.0;
      if (uAutoExposureStrength > 0.001) {
        vec2 expRG = texture2D(tAutoExposure, vec2(0.5)).rg;
        float decoded = mix(0.5, 1.5, clamp(expRG.r + expRG.g / 255.0, 0.0, 1.0));
        autoExposure = mix(1.0, clamp(decoded, 0.86, 1.14), clamp(uAutoExposureStrength, 0.0, 1.0));
      }
      return autoExposure * clamp(uExposureBias, 0.4, 1.8);
    }

    void main() {
      vec4 baseCol = texture2D(tDiffuse, vUv);
      if (uStrength <= 0.001) {
        gl_FragColor = baseCol;
        return;
      }

      vec2 texel = 1.0 / max(uResolution, vec2(1.0));
      vec3 avgCorners;
      vec3 aaCol = fastFxaa(vUv, texel, baseCol.rgb, avgCorners);

      vec2 vigDelta = vUv - 0.5;
      float vignette = 1.0 - dot(vigDelta, vigDelta) * 0.12 * uStrength;

      vec3 godRays = computeGodRays(vUv, uSunScreenPos, uGodRayStrength * uStrength);
      float totalExposure = computeTotalExposure();

      float rawDepth = texture2D(tDepth, vUv).x;
      // Skip AO/contrast on sky & far background so distant clouds/sky remain crisp and unoccluded
      if (rawDepth >= 0.998) {
        vec3 skyFinal = max((aaCol * vignette + godRays) * totalExposure, vec3(0.0));
        gl_FragColor = vec4(skyFinal, baseCol.a);
        return;
      }

      float centerZ = -perspectiveDepthToViewZ(rawDepth, uCameraNear, uCameraFar);
      // Extended cavity AO distance so large 1:1 landmarks retain grounded depth cues
      float distFade = 1.0 - smoothstep(55.0, 220.0, centerZ);

      // 8-tap golden-angle Spiral Screen-Space Cavity AO (zero overrideMaterial, honors swaying grass & foliage)
      float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float baseAngle = ign * 6.2831853;
      float radiusPx = mix(5.8, 2.0, smoothstep(6.0, 95.0, centerZ));

      float occ = 0.0;
      for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float spiralR = sqrt((fi + 0.5) * 0.125) * radiusPx;
        float theta = baseAngle + fi * 2.39996323;
        vec2 offset = vec2(cos(theta), sin(theta)) * spiralR * texel;
        float sampleZ = readLinearDepth(vUv + offset);
        float dz = centerZ - sampleZ;
        float rangeMask = 1.0 - smoothstep(0.65, 2.6, abs(dz));
        occ += smoothstep(0.035, 0.48, dz) * rangeMask;
      }
      occ *= 0.125;

      // Smooth clamp AO to [0.78, 1.0] for natural contact grounding without darkening stone joints or foliage
      float aoLinear = clamp(1.0 - occ * 0.24 * uStrength * distFade, 0.78, 1.0);
      float ao = mix(0.78, 1.0, smoothstep(0.78, 1.0, aoLinear));

      // Subtle highlight-preserving micro-contrast on geometry surfaces
      float contrastWeight = 0.105 * uStrength * distFade / (1.0 + hdrLuma(aaCol) * 0.85);
      vec3 deltaDetail = clamp(aaCol - avgCorners, vec3(-0.35), vec3(0.35));
      vec3 contrasted = max(aaCol + deltaDetail * contrastWeight, vec3(0.0));

      vec3 litFinal = max((contrasted * ao * vignette + godRays) * totalExposure, vec3(0.0));
      gl_FragColor = vec4(litFinal, baseCol.a);
    }
  `
};

const LetterboxShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uLetterbox: { value: 0.0 }
  },
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
    uniform float uLetterbox;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float amount = clamp(uLetterbox, 0.0, 1.0);
      if (amount <= 0.001) {
        gl_FragColor = texel;
        return;
      }

      float aspect = max(uResolution.x, 1.0) / max(uResolution.y, 1.0);
      float targetBar = clamp(max(0.035, 0.5 * (1.0 - aspect / 2.39)), 0.0, 0.22);
      float barHeight = targetBar * amount;
      float aa = 1.5 / max(uResolution.y, 1.0);
      float distEdge = min(vUv.y, 1.0 - vUv.y);
      float mask = smoothstep(barHeight - aa, barHeight + aa, distEdge);

      gl_FragColor = vec4(texel.rgb * mask, texel.a);
    }
  `
};

export type EffectiveRenderStyle = 'impasto' | 'ghibli' | 'natural';

export interface CinematicPipelineOptions {
  renderStyle?: RenderStyleMode;
  defaultStyle?: EffectiveRenderStyle;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  kuwaharaEnabled?: boolean;
  kuwaharaRadius?: number;
  kuwaharaSharpness?: number;
  kuwaharaAnisotropy?: number;
  impastoRelief?: number;
  canvasGrain?: number;
  paintBlend?: number;
  ghibliStrength?: number;
}

const DEFAULT_OPTIONS: Required<CinematicPipelineOptions> = {
  renderStyle: 'natural',
  defaultStyle: 'natural',
  bloomStrength: 0.28,
  bloomRadius: 0.4,
  bloomThreshold: 0.9,
  kuwaharaEnabled: false,
  kuwaharaRadius: 3.0,
  kuwaharaSharpness: 7.0,
  kuwaharaAnisotropy: 1.1,
  impastoRelief: 0.0,
  canvasGrain: 0.0,
  paintBlend: 0.0,
  ghibliStrength: 0.0
};

function isPostProcessingSupported(renderer: THREE.WebGLRenderer | null | undefined): boolean {
  if (!renderer) return false;
  const r = renderer as unknown as Record<string, unknown>;
  if (typeof r.getContext !== 'function') return false;
  if (typeof r.setRenderTarget !== 'function') return false;
  if (typeof r.getRenderTarget !== 'function') return false;
  if (typeof r.getSize !== 'function') return false;
  if (typeof r.getPixelRatio !== 'function') return false;

  try {
    const gl = (r.getContext as () => unknown)();
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Reusable HDR WebGL post-processing pipeline for Dreamerize surreal spaces.
 *
 * Pass graph (HalfFloatType HDR intermediate targets):
 *   RenderPass -> NaturalPhotorealPass (Adaptive Exposure + God Rays + Cavity AO + FXAA)
 *   -> UnrealBloomPass -> OutputPass (AgXToneMapping + sRGB) -> LetterboxPass (2.39:1 Cinema)
 *
 * Automatically tracks viewport size/DPR, captures accurate scene RenderPass stats before
 * post passes overwrite renderer.info, falls back safely under mock/headless renderers,
 * and performs deterministic zero-leak GPU disposal.
 */
export class CinematicPipeline {
  private static readonly sceneRegistry = new WeakMap<THREE.Scene, CinematicPipeline>();

  public static getForScene(scene: THREE.Scene | null | undefined): CinematicPipeline | null {
    if (!scene) return null;
    return CinematicPipeline.sceneRegistry.get(scene) ?? null;
  }

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private options: Required<CinematicPipelineOptions>;

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private naturalPass: ShaderPass | null = null;
  private letterboxPass: ShaderPass | null = null;
  private depthTex1: THREE.DepthTexture | null = null;
  private depthTex2: THREE.DepthTexture | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private outputPass: OutputPass | null = null;

  private exposureTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private exposureMaterial: THREE.ShaderMaterial | null = null;
  private exposureQuad: FullScreenQuad | null = null;
  private exposureReadIdx = 0;
  private exposureInitialized = false;

  private readonly tempSize = new THREE.Vector2(1, 1);
  private readonly tempCamForward = new THREE.Vector3();
  private readonly tempSunDir = new THREE.Vector3();
  private readonly tempSunWorld = new THREE.Vector3();
  private readonly tempSunProjected = new THREE.Vector3();
  private cachedSunLight: THREE.DirectionalLight | null = null;

  private hasSunPosOverride = false;
  private hasGodRayStrengthOverride = false;
  private overrideSunScreenPos = new THREE.Vector2(0.72, 0.78);
  private overrideGodRayStrength = 0.14;
  private overrideExposureBias = 1.0;
  private overrideLetterbox = 0.0;

  private lastWidth = 0;
  private lastHeight = 0;
  private lastPixelRatio = 1;
  private qualityTier: CinematicQualityTier = 'high';
  private fallbackMode = false;
  private disposed = false;

  public getQualityTier(): CinematicQualityTier {
    return this.qualityTier;
  }

  public setQualityTier(tier: CinematicQualityTier): void {
    this.qualityTier = tier;
    this.syncEffectiveStyle();
    if (this.naturalPass?.uniforms?.uGodRayStrength && tier === 'low') {
      this.naturalPass.uniforms.uGodRayStrength.value = 0.0;
    }
  }

  public lastRenderStats: RenderStatsSnapshot = {
    calls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    geometries: 0,
    textures: 0,
    postProcessing: false,
    timestamp: 0
  };

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: CinematicPipelineOptions = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      defaultStyle: 'natural',
      renderStyle: 'natural',
      kuwaharaEnabled: false,
      bloomStrength: 0.28,
      bloomRadius: 0.4,
      bloomThreshold: 0.9
    };

    if (this.scene) {
      CinematicPipeline.sceneRegistry.set(this.scene, this);
    }

    if (!isPostProcessingSupported(renderer)) {
      this.fallbackMode = true;
      return;
    }

    try {
      this.initComposer();
    } catch {
      this.disposeInternal();
      this.fallbackMode = true;
    }
  }

  private captureRenderStats(targetRenderer: THREE.WebGLRenderer | null | undefined): void {
    const r = targetRenderer as unknown as {
      info?: {
        render?: { calls?: number; triangles?: number; points?: number; lines?: number };
        memory?: { geometries?: number; textures?: number };
      };
    } | null;

    const infoRender = r?.info?.render;
    const infoMemory = r?.info?.memory;
    const snapshot: RenderStatsSnapshot = {
      calls: typeof infoRender?.calls === 'number' ? infoRender.calls : 0,
      triangles: typeof infoRender?.triangles === 'number' ? infoRender.triangles : 0,
      points: typeof infoRender?.points === 'number' ? infoRender.points : 0,
      lines: typeof infoRender?.lines === 'number' ? infoRender.lines : 0,
      geometries: typeof infoMemory?.geometries === 'number' ? infoMemory.geometries : 0,
      textures: typeof infoMemory?.textures === 'number' ? infoMemory.textures : 0,
      postProcessing: this.isPostProcessingActive(),
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now()
    };

    this.lastRenderStats = snapshot;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__renderStats = { ...snapshot };
    }
  }

  private initComposer(): void {
    const dpr = Math.max(0.5, this.renderer.getPixelRatio() || 1);
    this.renderer.getSize(this.tempSize);
    const width = Math.max(1, Math.floor(this.tempSize.x));
    const height = Math.max(1, Math.floor(this.tempSize.y));
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    this.lastWidth = width;
    this.lastHeight = height;
    this.lastPixelRatio = dpr;

    this.depthTex1 = new THREE.DepthTexture(pixelWidth, pixelHeight, THREE.UnsignedIntType);
    const hdrTarget = new THREE.WebGLRenderTarget(pixelWidth, pixelHeight, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: this.depthTex1
    });
    hdrTarget.texture.name = 'CinematicPipeline.hdrTarget1';

    this.composer = new EffectComposer(this.renderer, hdrTarget);
    // Ensure renderTarget2 owns its own non-aliased DepthTexture so swapBuffers() never loses scene depth
    this.depthTex2 = new THREE.DepthTexture(pixelWidth, pixelHeight, THREE.UnsignedIntType);
    this.composer.renderTarget2.depthTexture = this.depthTex2;

    // EffectComposer initializes _width/_height from a passed renderTarget's pixel dimensions;
    // normalize immediately to CSS dimensions before adding passes so DPR isn't double-multiplied.
    this.composer.setSize(width, height);

    this.renderPass = new RenderPass(this.scene, this.camera);
    const origSceneRender = this.renderPass.render.bind(this.renderPass);
    this.renderPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      origSceneRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      this.captureRenderStats(renderer);
    };
    this.composer.addPass(this.renderPass);

    // 1x1 ping-pong targets for stall-free GPU adaptive auto-exposure
    const expRtOptions: THREE.RenderTargetOptions = {
      type: THREE.UnsignedByteType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false
    };
    this.exposureTargets = [
      new THREE.WebGLRenderTarget(1, 1, expRtOptions),
      new THREE.WebGLRenderTarget(1, 1, expRtOptions)
    ];
    this.exposureMaterial = new THREE.ShaderMaterial({
      name: 'CinematicPipeline.AutoExposure',
      uniforms: THREE.UniformsUtils.clone(AutoExposureShader.uniforms),
      vertexShader: AutoExposureShader.vertexShader,
      fragmentShader: AutoExposureShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    this.exposureQuad = new FullScreenQuad(this.exposureMaterial);

    this.naturalPass = new ShaderPass(NaturalPhotorealShader);
    const origNaturalRender = this.naturalPass.render.bind(this.naturalPass);
    this.naturalPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      if (this.exposureTargets && this.exposureMaterial && this.exposureQuad) {
        const writeIdx = 1 - this.exposureReadIdx;
        const dt = typeof deltaTime === 'number' && deltaTime > 0 ? Math.min(deltaTime, 0.1) : 0.016;
        this.exposureMaterial.uniforms.tDiffuse.value = readBuffer?.texture ?? null;
        this.exposureMaterial.uniforms.tPrevExposure.value =
          this.exposureTargets[this.exposureReadIdx].texture;
        this.exposureMaterial.uniforms.uAdaptRate.value = this.exposureInitialized
          ? Math.min(1.0, 1.0 - Math.exp(-dt * 1.8))
          : 1.0;
        this.exposureMaterial.uniforms.uFirstFrame.value = this.exposureInitialized ? 0.0 : 1.0;

        const prevTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(this.exposureTargets[writeIdx]);
        this.exposureQuad.render(renderer);
        renderer.setRenderTarget(prevTarget);

        this.exposureReadIdx = writeIdx;
        this.exposureInitialized = true;
        if (this.naturalPass?.uniforms?.tAutoExposure) {
          this.naturalPass.uniforms.tAutoExposure.value =
            this.exposureTargets[this.exposureReadIdx].texture;
        }
      }
      if (this.naturalPass?.uniforms?.tDepth) {
        this.naturalPass.uniforms.tDepth.value = readBuffer?.depthTexture ?? this.depthTex1;
      }
      origNaturalRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    };
    this.composer.addPass(this.naturalPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(pixelWidth, pixelHeight),
      0.28,
      0.4,
      0.9
    );
    this.bloomPass.enabled = true;
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.letterboxPass = new ShaderPass(LetterboxShader);
    this.letterboxPass.enabled = this.overrideLetterbox > 0.001;
    this.composer.addPass(this.letterboxPass);

    // Sync final pixel ratio & CSS viewport size cleanly after all passes are registered
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.syncShaderUniforms(pixelWidth, pixelHeight);
    this.applyAtmosphereUniforms();
  }

  public getEffectiveStyle(): EffectiveRenderStyle {
    return 'natural';
  }

  public getRenderStyle(): RenderStyleMode {
    return 'natural';
  }

  public setDefaultStyle(_style: EffectiveRenderStyle): void {
    if (this.disposed) return;
    this.options.defaultStyle = 'natural';
    this.syncEffectiveStyle();
  }

  public setRenderStyle(_style: RenderStyleMode): void {
    if (this.disposed) return;
    this.options.renderStyle = 'natural';
    this.syncEffectiveStyle();
  }

  public setAtmosphereOverrides(overrides: AtmosphereOverrides): void {
    if (this.disposed) return;

    if (overrides.sunScreenPos !== undefined) {
      if (overrides.sunScreenPos === null) {
        this.hasSunPosOverride = false;
      } else {
        this.hasSunPosOverride = true;
        if (Array.isArray(overrides.sunScreenPos)) {
          this.overrideSunScreenPos.set(overrides.sunScreenPos[0] ?? 0.5, overrides.sunScreenPos[1] ?? 0.5);
        } else {
          this.overrideSunScreenPos.set(overrides.sunScreenPos.x, overrides.sunScreenPos.y);
        }
      }
    }

    if (overrides.godRayStrength !== undefined) {
      if (overrides.godRayStrength === null) {
        this.hasGodRayStrengthOverride = false;
      } else {
        this.hasGodRayStrengthOverride = true;
        this.overrideGodRayStrength = Math.max(0, Math.min(2.0, overrides.godRayStrength));
      }
    }

    if (typeof overrides.exposureBias === 'number' && Number.isFinite(overrides.exposureBias)) {
      this.overrideExposureBias = Math.max(0.4, Math.min(1.8, overrides.exposureBias));
    }

    if (typeof overrides.letterbox === 'number' && Number.isFinite(overrides.letterbox)) {
      this.overrideLetterbox = Math.max(0, Math.min(1.0, overrides.letterbox));
    }

    this.applyAtmosphereUniforms();
  }

  private applyAtmosphereUniforms(): void {
    if (this.naturalPass?.uniforms) {
      const u = this.naturalPass.uniforms;
      if (u.uSunScreenPos?.value) {
        (u.uSunScreenPos.value as THREE.Vector2).copy(this.overrideSunScreenPos);
      }
      if (u.uGodRayStrength) {
        u.uGodRayStrength.value = this.overrideGodRayStrength;
      }
      if (u.uExposureBias) {
        u.uExposureBias.value = this.overrideExposureBias;
      }
    }

    if (this.letterboxPass?.uniforms?.uLetterbox) {
      this.letterboxPass.uniforms.uLetterbox.value = this.overrideLetterbox;
      this.letterboxPass.enabled = this.overrideLetterbox > 0.001;
    }
  }

  private findPrimarySunLight(): THREE.DirectionalLight | null {
    if (this.cachedSunLight && this.cachedSunLight.parent) {
      return this.cachedSunLight;
    }
    if (!this.scene || typeof this.scene.traverse !== 'function') {
      return null;
    }
    let best: THREE.DirectionalLight | null = null;
    this.scene.traverse((obj) => {
      if ((obj as THREE.DirectionalLight).isDirectionalLight) {
        const dl = obj as THREE.DirectionalLight;
        if (!best || dl.intensity > best.intensity) {
          best = dl;
        }
      }
    });
    this.cachedSunLight = best;
    return best;
  }

  private updateSunScreenPositionFromScene(): void {
    if (this.hasSunPosOverride && this.hasGodRayStrengthOverride) return;
    if (!this.naturalPass?.uniforms || !this.camera) return;

    const sunLight = this.findPrimarySunLight();
    if (!sunLight || sunLight.intensity <= 0.05) {
      if (!this.hasGodRayStrengthOverride && this.naturalPass.uniforms.uGodRayStrength) {
        this.naturalPass.uniforms.uGodRayStrength.value = 0.0;
      }
      return;
    }

    this.tempSunDir.copy(sunLight.position);
    if (sunLight.target) {
      this.tempSunDir.sub(sunLight.target.position);
    }
    if (this.tempSunDir.lengthSq() < 1e-6) return;
    this.tempSunDir.normalize();

    if (typeof (this.camera as THREE.PerspectiveCamera).getWorldDirection === 'function') {
      (this.camera as THREE.PerspectiveCamera).getWorldDirection(this.tempCamForward);
    } else {
      this.tempCamForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }

    const sunDot = this.tempCamForward.dot(this.tempSunDir);
    if (!this.hasSunPosOverride && this.naturalPass.uniforms.uSunScreenPos?.value) {
      if (sunDot > 0.02) {
        this.tempSunWorld
          .copy(this.camera.position)
          .addScaledVector(this.tempSunDir, 1000);
        this.tempSunProjected.copy(this.tempSunWorld).project(this.camera);
        const u = this.tempSunProjected.x * 0.5 + 0.5;
        const v = this.tempSunProjected.y * 0.5 + 0.5;
        if (Number.isFinite(u) && Number.isFinite(v)) {
          (this.naturalPass.uniforms.uSunScreenPos.value as THREE.Vector2).set(u, v);
        }
      } else {
        (this.naturalPass.uniforms.uSunScreenPos.value as THREE.Vector2).set(-2.0, -2.0);
      }
    }

    if (!this.hasGodRayStrengthOverride && this.naturalPass.uniforms.uGodRayStrength) {
      const tierScale =
        this.qualityTier === 'low' ? 0.0 : this.qualityTier === 'medium' ? 0.5 : 1.0;
      const elevationFactor = Math.max(0, Math.min(1, (this.tempSunDir.y + 0.1) * 2.0));
      const facingFactor = Math.max(0, Math.min(1, (sunDot - 0.15) / 0.75));
      const intensityFactor = Math.min(1.0, sunLight.intensity / 1.4);
      this.naturalPass.uniforms.uGodRayStrength.value =
        0.18 * elevationFactor * facingFactor * intensityFactor * tierScale;
    }
  }

  private syncEffectiveStyle(): void {
    this.options.defaultStyle = 'natural';
    this.options.renderStyle = 'natural';
    this.options.kuwaharaEnabled = false;

    if (this.renderer) {
      this.renderer.toneMapping = THREE.AgXToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    }

    if (this.naturalPass) {
      this.naturalPass.enabled = true;
      const persp = this.camera as THREE.PerspectiveCamera;
      if (this.naturalPass.uniforms.uCameraNear && typeof persp.near === 'number') {
        this.naturalPass.uniforms.uCameraNear.value = persp.near;
      }
      if (this.naturalPass.uniforms.uCameraFar && typeof persp.far === 'number') {
        this.naturalPass.uniforms.uCameraFar.value = persp.far;
      }
      if (this.naturalPass.uniforms.tDepth && this.depthTex1) {
        this.naturalPass.uniforms.tDepth.value = this.depthTex1;
      }
      if (this.naturalPass.uniforms.uStrength) {
        this.naturalPass.uniforms.uStrength.value =
          this.qualityTier === 'low' ? 0.0 : this.qualityTier === 'medium' ? 0.75 : 1.0;
      }
      if (this.qualityTier === 'low' && this.naturalPass.uniforms.uGodRayStrength) {
        this.naturalPass.uniforms.uGodRayStrength.value = 0.0;
      }
    }

    if (this.bloomPass) {
      if (this.qualityTier === 'low') {
        this.bloomPass.enabled = false;
      } else if (this.qualityTier === 'medium') {
        this.bloomPass.strength = 0.22;
        this.bloomPass.threshold = 0.92;
        this.bloomPass.radius = 0.35;
        this.bloomPass.enabled = true;
      } else {
        this.bloomPass.strength = 0.28;
        this.bloomPass.threshold = 0.9;
        this.bloomPass.radius = 0.4;
        this.bloomPass.enabled = true;
      }
    }
  }

  private syncShaderUniforms(pixelWidth: number, pixelHeight: number): void {
    if (this.naturalPass?.uniforms?.uResolution?.value) {
      (this.naturalPass.uniforms.uResolution.value as THREE.Vector2).set(pixelWidth, pixelHeight);
    }
    if (this.letterboxPass?.uniforms?.uResolution?.value) {
      (this.letterboxPass.uniforms.uResolution.value as THREE.Vector2).set(pixelWidth, pixelHeight);
    }

    this.syncEffectiveStyle();
  }

  private syncSizeFromRenderer(): void {
    if (!this.composer) return;

    const dpr = Math.max(0.5, this.renderer.getPixelRatio() || 1);
    this.renderer.getSize(this.tempSize);
    const width = Math.max(1, Math.floor(this.tempSize.x));
    const height = Math.max(1, Math.floor(this.tempSize.y));

    if (width === this.lastWidth && height === this.lastHeight && dpr === this.lastPixelRatio) {
      return;
    }

    if (dpr !== this.lastPixelRatio) {
      this.lastPixelRatio = dpr;
      this.composer.setPixelRatio(dpr);
    }
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.lastWidth = width;
      this.lastHeight = height;
      this.composer.setSize(width, height);
    }

    const effectiveW = Math.max(1, Math.round(width * dpr));
    const effectiveH = Math.max(1, Math.round(height * dpr));
    if (this.naturalPass?.uniforms?.uResolution?.value) {
      (this.naturalPass.uniforms.uResolution.value as THREE.Vector2).set(effectiveW, effectiveH);
    }
    if (this.letterboxPass?.uniforms?.uResolution?.value) {
      (this.letterboxPass.uniforms.uResolution.value as THREE.Vector2).set(effectiveW, effectiveH);
    }
  }

  public setSize(width: number, height: number, pixelRatio?: number): void {
    if (this.disposed || !this.composer) return;
    const safeW = Math.max(1, Math.floor(width));
    const safeH = Math.max(1, Math.floor(height));
    const safeDpr = Math.max(0.5, pixelRatio ?? this.lastPixelRatio);

    if (safeDpr !== this.lastPixelRatio) {
      this.lastPixelRatio = safeDpr;
      this.composer.setPixelRatio(safeDpr);
    }
    this.lastWidth = safeW;
    this.lastHeight = safeH;
    this.composer.setSize(safeW, safeH);

    const effectiveW = Math.max(1, Math.round(safeW * safeDpr));
    const effectiveH = Math.max(1, Math.round(safeH * safeDpr));
    if (this.naturalPass?.uniforms?.uResolution?.value) {
      (this.naturalPass.uniforms.uResolution.value as THREE.Vector2).set(effectiveW, effectiveH);
    }
    if (this.letterboxPass?.uniforms?.uResolution?.value) {
      (this.letterboxPass.uniforms.uResolution.value as THREE.Vector2).set(effectiveW, effectiveH);
    }
  }

  public setTime(_elapsedTime: number): void {
    // Natural photorealistic pipeline keeps shaders deterministic across elapsedTime.
  }

  public setCamera(camera: THREE.Camera): void {
    this.camera = camera;
    if (this.renderPass) {
      this.renderPass.camera = camera;
    }
    if (this.naturalPass) {
      const persp = camera as THREE.PerspectiveCamera;
      if (this.naturalPass.uniforms.uCameraNear && typeof persp.near === 'number') {
        this.naturalPass.uniforms.uCameraNear.value = persp.near;
      }
      if (this.naturalPass.uniforms.uCameraFar && typeof persp.far === 'number') {
        this.naturalPass.uniforms.uCameraFar.value = persp.far;
      }
    }
  }

  public setScene(scene: THREE.Scene): void {
    if (this.scene && CinematicPipeline.sceneRegistry.get(this.scene) === this) {
      CinematicPipeline.sceneRegistry.delete(this.scene);
    }
    this.scene = scene;
    this.cachedSunLight = null;
    if (this.scene) {
      CinematicPipeline.sceneRegistry.set(this.scene, this);
    }
    if (this.renderPass) {
      this.renderPass.scene = scene;
    }
  }

  public updateOptions(_nextOptions: Partial<CinematicPipelineOptions>): void {
    if (this.disposed) return;
    const effectiveW = Math.max(1, Math.round(this.lastWidth * this.lastPixelRatio));
    const effectiveH = Math.max(1, Math.round(this.lastHeight * this.lastPixelRatio));
    this.syncShaderUniforms(effectiveW, effectiveH);
  }

  public getOptions(): Required<CinematicPipelineOptions> {
    return { ...this.options };
  }

  public isPostProcessingActive(): boolean {
    return !this.disposed && !this.fallbackMode && this.composer !== null;
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Renders the active scene through the HDR post-processing composer,
   * or falls back safely to direct `renderer.render` under mock/headless renderers.
   */
  public render(deltaTime?: number, elapsedTime?: number): void {
    if (this.disposed) return;

    if (typeof elapsedTime === 'number') {
      this.setTime(elapsedTime);
    }

    if (this.fallbackMode || !this.composer) {
      const r = this.renderer as unknown as { render?: (s: THREE.Scene, c: THREE.Camera) => void };
      if (r && typeof r.render === 'function') {
        r.render(this.scene, this.camera);
        this.captureRenderStats(this.renderer);
      }
      return;
    }

    this.syncSizeFromRenderer();
    this.updateSunScreenPositionFromScene();
    this.composer.render(deltaTime);
  }

  /**
   * Convenience render entry point matching ISpace.render(renderer, camera) signatures.
   */
  public renderFrame(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    deltaTime?: number,
    elapsedTime?: number
  ): void {
    if (this.disposed) return;

    if (camera && camera !== this.camera) {
      this.setCamera(camera);
    }

    if (this.fallbackMode || !this.composer || renderer !== this.renderer) {
      const targetRenderer = renderer ?? this.renderer;
      if (isPostProcessingSupported(targetRenderer) && this.composer && renderer === this.renderer) {
        this.render(deltaTime, elapsedTime);
        return;
      }
      const r = targetRenderer as unknown as { render?: (s: THREE.Scene, c: THREE.Camera) => void };
      if (r && typeof r.render === 'function') {
        r.render(this.scene, this.camera);
        this.captureRenderStats(targetRenderer);
      }
      return;
    }

    this.render(deltaTime, elapsedTime);
  }

  private disposeInternal(): void {
    if (this.composer) {
      for (const pass of this.composer.passes) {
        const disposablePass = pass as unknown as { dispose?: () => void };
        disposablePass.dispose?.();
      }
    }

    // Explicitly dispose UnrealBloomPass.materialHighPassFilter (omitted by Three r173 UnrealBloomPass.dispose)
    const bloomInternal = this.bloomPass as unknown as {
      dispose?: () => void;
      materialHighPassFilter?: THREE.Material;
    } | null;
    if (bloomInternal) {
      bloomInternal.dispose?.();
      bloomInternal.materialHighPassFilter?.dispose?.();
    }

    this.exposureQuad?.dispose?.();
    this.exposureMaterial?.dispose?.();
    this.exposureTargets?.[0]?.dispose?.();
    this.exposureTargets?.[1]?.dispose?.();

    this.naturalPass?.dispose?.();
    this.letterboxPass?.dispose?.();
    this.depthTex1?.dispose?.();
    this.depthTex2?.dispose?.();
    this.outputPass?.dispose?.();
    (this.renderPass as unknown as { dispose?: () => void } | null)?.dispose?.();

    if (this.composer) {
      this.composer.renderTarget1?.dispose?.();
      this.composer.renderTarget2?.dispose?.();
      this.composer.dispose?.();
      this.composer.passes.length = 0;
    }

    if (this.scene && CinematicPipeline.sceneRegistry.get(this.scene) === this) {
      CinematicPipeline.sceneRegistry.delete(this.scene);
    }

    this.composer = null;
    this.renderPass = null;
    this.naturalPass = null;
    this.letterboxPass = null;
    this.depthTex1 = null;
    this.depthTex2 = null;
    this.bloomPass = null;
    this.outputPass = null;
    this.exposureQuad = null;
    this.exposureMaterial = null;
    this.exposureTargets = null;
    this.cachedSunLight = null;
  }

  /**
   * Synchronously disposes all EffectComposer render targets, passes, and shader materials
   * so zero GPU buffers or textures leak across space transitions.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeInternal();
  }
}
