import * as THREE from 'three';
import { ISpace, IPointOfInterest, ISpawnPoint, IWanderBounds } from '../ISpace';
import { SpaceConfig } from '../../../shared/types/space';
import { ThreeResourceDisposer } from '../ThreeResourceDisposer';
import { ParsedGaussianCloud, parse3DGSPlyBuffer, parseSplatBuffer } from './splatParser';

export interface GaussianSplatSceneOptions {
  id?: string;
  slug?: string;
  name?: string;
  assetUrl?: string;
  assetFormat?: 'splat' | 'ply';
}

const SPLAT_VERTEX_SHADER = /* glsl */ `
precision highp float;
precision highp int;

in vec2 aQuadPos;
in float aSplatIndex;

uniform sampler2D uCenterTex;
uniform sampler2D uCovATex;
uniform sampler2D uCovBTex;
uniform sampler2D uColorTex;
uniform int uTexWidth;
uniform vec2 uViewport;
uniform float uSplatScale;

out vec4 vColor;
out vec3 vConic;
out vec2 vOffset;

void main() {
  int idx = int(aSplatIndex + 0.5);
  int tx = idx % uTexWidth;
  int ty = idx / uTexWidth;
  ivec2 coord = ivec2(tx, ty);

  vec3 center = texelFetch(uCenterTex, coord, 0).xyz;
  vec3 covA = texelFetch(uCovATex, coord, 0).xyz;
  vec3 covB = texelFetch(uCovBTex, coord, 0).xyz;
  vec4 color = texelFetch(uColorTex, coord, 0);

  vec4 camPos = viewMatrix * vec4(center, 1.0);
  // Cull splats behind or too close to near plane so near-lens splats never clip across viewport
  if (camPos.z > -0.35 || color.a < 0.004) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vColor = vec4(0.0);
    vConic = vec3(0.0);
    vOffset = vec2(0.0);
    return;
  }

  float nearFade = smoothstep(-0.35, -0.95, camPos.z);

  float z = -camPos.z;
  float proj00 = projectionMatrix[0][0];
  float proj11 = projectionMatrix[1][1];
  float fx = 0.5 * uViewport.x * proj00;
  float fy = 0.5 * uViewport.y * proj11;

  // Clamp normalized coordinates to prevent extreme off-frustum Jacobian blow-up
  float tanHalfFovX = 1.0 / max(proj00, 0.001);
  float tanHalfFovY = 1.0 / max(proj11, 0.001);
  float limX = 1.3 * tanHalfFovX;
  float limY = 1.3 * tanHalfFovY;
  float txClamped = clamp(camPos.x / z, -limX, limX) * z;
  float tyClamped = clamp(camPos.y / z, -limY, limY) * z;

  float scaleSq = uSplatScale * uSplatScale;
  mat3 Vrk = mat3(
    covA.x * scaleSq, covA.y * scaleSq, covA.z * scaleSq,
    covA.y * scaleSq, covB.x * scaleSq, covB.y * scaleSq,
    covA.z * scaleSq, covB.y * scaleSq, covB.z * scaleSq
  );

  mat3 W = mat3(viewMatrix);
  vec3 wRow0 = vec3(W[0][0], W[1][0], W[2][0]);
  vec3 wRow1 = vec3(W[0][1], W[1][1], W[2][1]);
  vec3 wRow2 = vec3(W[0][2], W[1][2], W[2][2]);

  float invZ = 1.0 / z;
  float invZ2 = invZ * invZ;
  vec3 r0 = (fx * invZ) * wRow0 + (fx * txClamped * invZ2) * wRow2;
  vec3 r1 = (fy * invZ) * wRow1 + (fy * tyClamped * invZ2) * wRow2;

  float a = dot(r0, Vrk * r0) + 0.3;
  float b = dot(r0, Vrk * r1);
  float c = dot(r1, Vrk * r1) + 0.3;

  float det = a * c - b * b;
  if (det <= 1e-6) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vColor = vec4(0.0);
    vConic = vec3(0.0);
    vOffset = vec2(0.0);
    return;
  }

  float invDet = 1.0 / det;
  vConic = vec3(c * invDet, -b * invDet, a * invDet);

  float mid = 0.5 * (a + c);
  float disc = sqrt(max(0.05, mid * mid - det));
  float lambda1 = mid + disc;
  float lambda2 = max(0.05, mid - disc);

  // Eigenvectors of 2x2 covariance for tight oriented bounding quad
  vec2 eig1;
  if (abs(b) > 1e-5) {
    eig1 = a >= c ? normalize(vec2(lambda1 - c, b)) : normalize(vec2(b, lambda1 - a));
  } else {
    eig1 = a >= c ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  }
  vec2 eig2 = vec2(-eig1.y, eig1.x);

  float rMax1 = 3.2 * sqrt(lambda1);
  float rMax2 = 3.2 * sqrt(lambda2);
  float maxExtent = max(rMax1, rMax2);
  float sizeFade = 1.0 - smoothstep(380.0, 620.0, maxExtent);
  float combinedAlpha = color.a * nearFade * sizeFade;
  if (combinedAlpha < 0.004) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vColor = vec4(0.0);
    vConic = vec3(0.0);
    vOffset = vec2(0.0);
    return;
  }

  vec2 deltaPx = aQuadPos.x * rMax1 * eig1 + aQuadPos.y * rMax2 * eig2;
  vec2 deltaNdc = vec2(2.0 * deltaPx.x / uViewport.x, 2.0 * deltaPx.y / uViewport.y);

  vec4 posClip = projectionMatrix * camPos;
  gl_Position = vec4(posClip.xy + deltaNdc * posClip.w, posClip.z, posClip.w);

  vColor = vec4(color.rgb, combinedAlpha);
  vOffset = deltaPx;
}
`;

const SPLAT_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

in vec4 vColor;
in vec3 vConic;
in vec2 vOffset;

out vec4 fragColor;

void main() {
  float power = -0.5 * (
    vConic.x * vOffset.x * vOffset.x +
    2.0 * vConic.y * vOffset.x * vOffset.y +
    vConic.z * vOffset.y * vOffset.y
  );

  if (power > 0.0) power = 0.0;
  if (power < -4.5) discard;

  float weight = exp(power);
  float alpha = min(0.99, vColor.a * weight);
  if (alpha < 0.004) discard;

  fragColor = vec4(vColor.rgb, alpha);
}
`;

/**
 * GaussianSplatScene implements ISpace for 3D Gaussian Splatting (`.splat` and 3DGS `.ply`).
 * Projects 3D anisotropic Gaussian covariances via Jacobian into screen-space ellipses
 * with 16-bit counting back-to-front depth sorting.
 */
export class GaussianSplatScene implements ISpace {
  public readonly id: string;
  public readonly name: string;
  public readonly slug: string;

  private readonly defaultAssetUrl: string;
  private readonly defaultAssetFormat?: 'splat' | 'ply';

  private scene: THREE.Scene;
  private currentConfig: SpaceConfig | null = null;
  private isInitialized = false;

  // Splat cloud & GPU buffers
  private cloud: ParsedGaussianCloud | null = null;
  private splatMesh: THREE.Mesh | null = null;
  private splatMaterial: THREE.ShaderMaterial | null = null;
  private splatGeometry: THREE.InstancedBufferGeometry | null = null;
  private sortAttribute: THREE.InstancedBufferAttribute | null = null;

  // Back-to-front sort scratch buffers (zero per-frame allocations)
  private viewZBuffer: Float32Array | null = null;
  private bucketBuffer: Uint16Array | null = null;
  private countBuffer: Int32Array | null = null;
  private sortedIndicesFloat: Float32Array | null = null;
  private lastSortCamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastSortCamDir = new THREE.Vector3(0, 0, -1);
  private needsSort = true;

  // Backdrop
  private skyMesh: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private groundMaterial: THREE.ShaderMaterial | null = null;

  // Derived spatial framing
  private groundY = 0;
  private coreCenter = new THREE.Vector3(0, 1.5, 0);
  private coreRadius = 10;
  private spawnPoint: ISpawnPoint = {
    position: new THREE.Vector3(0, 1.7, 9),
    lookAt: new THREE.Vector3(0, 1.6, -2)
  };
  private pois: IPointOfInterest[] = [];
  private readonly viewportVec = new THREE.Vector2(1280, 720);
  private readonly tmpCamDir = new THREE.Vector3();

  public onConfigUpdate?: (config: SpaceConfig) => void;

  public get config(): SpaceConfig | null {
    return this.currentConfig;
  }

  constructor(options: GaussianSplatSceneOptions = {}) {
    this.id = options.id ?? 'space-3dgs-coastal-sanctuary';
    this.slug = options.slug ?? '3dgs-coastal-sanctuary';
    this.name = options.name ?? 'Thánh địa 3D Gaussian Splat';
    this.defaultAssetUrl = options.assetUrl ?? '/samples/coastal-garden.splat';
    this.defaultAssetFormat = options.assetFormat;
    this.scene = new THREE.Scene();
  }

  public async init(
    renderer: THREE.WebGLRenderer,
    _camera: THREE.PerspectiveCamera,
    config?: SpaceConfig
  ): Promise<void> {
    if (this.isInitialized) {
      this.dispose();
    }

    this.scene = new THREE.Scene();
    const cfgAny = config as any;
    const assetUrl: string = cfgAny?.assetUrl || this.defaultAssetUrl || '/samples/coastal-garden.splat';
    const rawFormat: string | undefined = cfgAny?.assetFormat || this.defaultAssetFormat;
    const assetFormat: 'splat' | 'ply' =
      rawFormat === 'ply' || (rawFormat !== 'splat' && assetUrl.toLowerCase().includes('.ply'))
        ? 'ply'
        : 'splat';

    this.currentConfig = {
      fog: {
        type: 'exp2',
        color: config?.fog?.color ?? '#dcecf7',
        density: config?.fog?.density ?? 0.004
      },
      sky: {
        type: config?.sky?.type ?? ('custom_asset' as any),
        topColor: config?.sky?.topColor ?? '#2864d8',
        bottomColor: config?.sky?.bottomColor ?? '#8cc4f8',
        horizonColor: config?.sky?.horizonColor ?? '#f3eadb',
        swirlSpeed: config?.sky?.swirlSpeed ?? 0,
        starDensity: config?.sky?.starDensity ?? 0,
        cloudCoverage: config?.sky?.cloudCoverage ?? 0.35,
        cloudSpeed: config?.sky?.cloudSpeed ?? 0.5
      },
      wind: config?.wind ?? { speed: 1.0, direction: [1, 0, 0.2], gustiness: 0.3, swayIntensity: 0.2 },
      lighting: config?.lighting ?? {
        ambient: { color: '#f8fafc', intensity: 0.9 },
        directional: { color: '#fff8e7', intensity: 1.2, position: [30, 50, 25], castShadow: false },
        pointLights: []
      },
      shaders: config?.shaders ?? {},
      audio: {
        trackId: config?.audio?.trackId ?? '3dgs-coastal-ambient',
        name: config?.audio?.name ?? 'Coastal Garden Breeze & Soft Piano',
        sourceUrl: config?.audio?.sourceUrl ?? '/audio/breezy-meadow-ambient.ogg',
        defaultVolume: config?.audio?.defaultVolume ?? 0.65,
        loop: config?.audio?.loop ?? true,
        ambientType: config?.audio?.ambientType ?? 'procedural_synth',
        reverb: config?.audio?.reverb ?? { decay: 2.0, wet: 0.25 }
      },
      camera: {
        spawnPosition: config?.camera?.spawnPosition ?? [0, 1.7, 9.5],
        lookAt: config?.camera?.lookAt ?? [0, 1.8, -2.5],
        fov: config?.camera?.fov ?? 60,
        moveSpeed: config?.camera?.moveSpeed ?? 4.0,
        wanderSpeed: config?.camera?.wanderSpeed ?? 1.2,
        wanderRadius: config?.camera?.wanderRadius ?? 20,
        wanderWaypoints: config?.camera?.wanderWaypoints ?? [
          [0, 2.2, 8],
          [7, 2.6, 2],
          [0, 2.4, -7],
          [-7, 2.6, 2]
        ],
        heightOffset: config?.camera?.heightOffset ?? 1.7
      },
      ...(cfgAny?.assetUrl ? { assetUrl } : {}),
      ...(cfgAny?.assetFormat ? { assetFormat: cfgAny.assetFormat } : {})
    } as SpaceConfig;

    // Fetch & parse Gaussian splat cloud
    const response = await fetch(assetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Gaussian splat asset (${response.status} ${response.statusText}): ${assetUrl}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const cloud = assetFormat === 'ply' ? parse3DGSPlyBuffer(arrayBuffer) : parseSplatBuffer(arrayBuffer);
    this.cloud = cloud;

    this.computeFramingFromCloud(cloud, config);
    this.buildSkyDome(config);
    this.buildAmbientGround();
    this.buildSplatMesh(cloud, renderer);

    this.needsSort = true;
    this.lastSortCamPos.set(Infinity, Infinity, Infinity);
    this.isInitialized = true;
  }

  private computeFramingFromCloud(cloud: ParsedGaussianCloud, config?: SpaceConfig): void {
    this.groundY = Number.isFinite(cloud.groundY) ? cloud.groundY : 0;

    // Compute core (12th..88th percentile) bounding box so distant horizon splats don't skew framing
    const n = cloud.count;
    const sampleMax = 8192;
    const stride = n > sampleMax ? Math.ceil(n / sampleMax) : 1;
    const sCount = Math.ceil(n / stride);
    const xs = new Float32Array(sCount);
    const ys = new Float32Array(sCount);
    const zs = new Float32Array(sCount);
    let idx = 0;
    for (let i = 0; i < n && idx < sCount; i += stride) {
      xs[idx] = cloud.positions[i * 3];
      ys[idx] = cloud.positions[i * 3 + 1];
      zs[idx] = cloud.positions[i * 3 + 2];
      idx++;
    }
    const xSub = xs.subarray(0, idx).sort();
    const ySub = ys.subarray(0, idx).sort();
    const zSub = zs.subarray(0, idx).sort();

    const lo = Math.floor(0.12 * (idx - 1));
    const hi = Math.min(idx - 1, Math.ceil(0.88 * (idx - 1)));
    const cx = 0.5 * (xSub[lo] + xSub[hi]);
    const cy = 0.5 * (ySub[lo] + ySub[hi]);
    const cz = 0.5 * (zSub[lo] + zSub[hi]);

    const spanX = Math.max(1.5, xSub[hi] - xSub[lo]);
    const spanY = Math.max(1.0, ySub[hi] - ySub[lo]);
    const spanZ = Math.max(1.5, zSub[hi] - zSub[lo]);

    this.coreCenter.set(cx, cy, cz);
    this.coreRadius = Math.max(3.5, 0.5 * Math.hypot(spanX, spanZ));

    const eyeOffset = config?.camera?.heightOffset ?? 1.7;
    const hasCustomSpawn = Boolean(config?.camera?.spawnPosition);
    const hasCustomLookAt = Boolean(config?.camera?.lookAt);

    if (hasCustomSpawn && hasCustomLookAt) {
      const sp = config!.camera!.spawnPosition!;
      const lk = config!.camera!.lookAt!;
      this.spawnPoint = {
        position: new THREE.Vector3(sp[0], Math.max(this.groundY + eyeOffset, sp[1]), sp[2]),
        lookAt: new THREE.Vector3(lk[0], lk[1], lk[2])
      };
    } else {
      const standDist = Math.min(18, Math.max(3.8, this.coreRadius * 0.92));
      const spawnY = Math.max(this.groundY + eyeOffset, cy + spanY * 0.08);
      this.spawnPoint = {
        position: new THREE.Vector3(cx, spawnY, cz + standDist),
        lookAt: new THREE.Vector3(cx, Math.max(this.groundY + 1.2, cy), cz)
      };
    }

    const poiR = Math.min(14, Math.max(2.6, this.coreRadius * 0.72));
    const poiY = Math.max(this.groundY + eyeOffset + 0.3, cy + spanY * 0.15);
    this.pois = [
      {
        name: 'Sanctuary Approach',
        position: new THREE.Vector3(cx, poiY, cz + poiR),
        dwellTime: 8.0
      },
      {
        name: 'Canopy & Arch Vista',
        position: new THREE.Vector3(cx + poiR * 0.85, poiY + 0.6, cz - poiR * 0.35),
        dwellTime: 9.0
      },
      {
        name: 'Reflecting Pond Overlook',
        position: new THREE.Vector3(cx - poiR * 0.85, poiY + 0.4, cz - poiR * 0.45),
        dwellTime: 9.0
      }
    ];
  }

  private buildSkyDome(config?: SpaceConfig): void {
    const skyGeo = new THREE.SphereGeometry(280, 48, 24);
    const topColor = new THREE.Color(config?.sky?.topColor ?? '#2864d8');
    const bottomColor = new THREE.Color(config?.sky?.bottomColor ?? '#8cc4f8');
    const horizonColor = new THREE.Color(config?.sky?.horizonColor ?? '#f3eadb');
    const dirPos = config?.lighting?.directional?.position ?? [30, 50, 25];
    const sunDir = new THREE.Vector3(dirPos[0], dirPos[1], dirPos[2]).normalize();

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTopColor: { value: topColor },
        uBottomColor: { value: bottomColor },
        uHorizonColor: { value: horizonColor },
        uSunDir: { value: sunDir }
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        varying vec3 vDir;

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uBottomColor, smoothstep(0.0, 0.25, h));
          col = mix(col, uTopColor, smoothstep(0.20, 0.92, h));

          float sunDot = max(dot(d, uSunDir), 0.0);
          col += vec3(1.0, 0.93, 0.78) * (pow(sunDot, 10.0) * 0.26 + smoothstep(0.997, 0.9995, sunDot) * 1.4);

          if (d.y < 0.0) {
            col = mix(col, uHorizonColor * 0.85, smoothstep(0.0, -0.25, d.y));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.name = 'SplatSkyDome';
    this.scene.add(this.skyMesh);
  }

  private buildAmbientGround(): void {
    const groundGeo = new THREE.CircleGeometry(180, 64);
    groundGeo.rotateX(-Math.PI / 2);

    this.groundMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uInnerColor: { value: new THREE.Color('#396331') },
        uMidColor: { value: new THREE.Color('#5a8668') },
        uOuterColor: { value: new THREE.Color(this.currentConfig?.sky?.horizonColor ?? '#f3eadb') }
      },
      vertexShader: /* glsl */ `
        varying vec2 vXZ;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vXZ = worldPos.xz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uInnerColor;
        uniform vec3 uMidColor;
        uniform vec3 uOuterColor;
        varying vec2 vXZ;
        void main() {
          float dist = length(vXZ);
          vec3 col = mix(uInnerColor, uMidColor, smoothstep(10.0, 38.0, dist));
          col = mix(col, uOuterColor, smoothstep(38.0, 145.0, dist));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: true,
      fog: false
    });

    this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
    this.groundMesh.name = 'SplatBackdropGround';
    this.groundMesh.position.set(this.coreCenter.x, this.groundY - 0.14, this.coreCenter.z);
    this.scene.add(this.groundMesh);
  }

  private buildSplatMesh(cloud: ParsedGaussianCloud, renderer: THREE.WebGLRenderer): void {
    const count = cloud.count;
    const texWidth = 1024;
    const texHeight = Math.max(1, Math.ceil(count / texWidth));
    const texLen = texWidth * texHeight * 4;

    const centerData = new Float32Array(texLen);
    const covAData = new Float32Array(texLen);
    const covBData = new Float32Array(texLen);
    const colorData = new Float32Array(texLen);

    for (let i = 0; i < count; i++) {
      const p3 = i * 3;
      const c4 = i * 4;

      centerData[c4] = cloud.positions[p3];
      centerData[c4 + 1] = cloud.positions[p3 + 1];
      centerData[c4 + 2] = cloud.positions[p3 + 2];
      centerData[c4 + 3] = 1.0;

      colorData[c4] = cloud.colors[c4];
      colorData[c4 + 1] = cloud.colors[c4 + 1];
      colorData[c4 + 2] = cloud.colors[c4 + 2];
      colorData[c4 + 3] = cloud.colors[c4 + 3];

      // Compute 3D covariance Sigma = R * S * S^T * R^T from unit quaternion (w, x, y, z) and scale (sx, sy, sz)
      const qw = cloud.rotations[c4];
      const qx = cloud.rotations[c4 + 1];
      const qy = cloud.rotations[c4 + 2];
      const qz = cloud.rotations[c4 + 3];

      const sx = cloud.scales[p3];
      const sy = cloud.scales[p3 + 1];
      const sz = cloud.scales[p3 + 2];

      const xx = qx * qx;
      const yy = qy * qy;
      const zz = qz * qz;
      const xy = qx * qy;
      const xz = qx * qz;
      const yz = qy * qz;
      const wx = qw * qx;
      const wy = qw * qy;
      const wz = qw * qz;

      const m00 = (1 - 2 * (yy + zz)) * sx;
      const m10 = 2 * (xy + wz) * sx;
      const m20 = 2 * (xz - wy) * sx;

      const m01 = 2 * (xy - wz) * sy;
      const m11 = (1 - 2 * (xx + zz)) * sy;
      const m21 = 2 * (yz + wx) * sy;

      const m02 = 2 * (xz + wy) * sz;
      const m12 = 2 * (yz - wx) * sz;
      const m22 = (1 - 2 * (xx + yy)) * sz;

      covAData[c4] = m00 * m00 + m01 * m01 + m02 * m02; // cxx
      covAData[c4 + 1] = m00 * m10 + m01 * m11 + m02 * m12; // cxy
      covAData[c4 + 2] = m00 * m20 + m01 * m21 + m02 * m22; // cxz

      covBData[c4] = m10 * m10 + m11 * m11 + m12 * m12; // cyy
      covBData[c4 + 1] = m10 * m20 + m11 * m21 + m12 * m22; // cyz
      covBData[c4 + 2] = m20 * m20 + m21 * m21 + m22 * m22; // czz
    }

    const createDataTex = (data: Float32Array): THREE.DataTexture => {
      const tex = new THREE.DataTexture(data, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.unpackAlignment = 1;
      tex.needsUpdate = true;
      return tex;
    };

    const uCenterTex = createDataTex(centerData);
    const uCovATex = createDataTex(covAData);
    const uCovBTex = createDataTex(covBData);
    const uColorTex = createDataTex(colorData);

    // Instanced quad geometry
    const geo = new THREE.InstancedBufferGeometry();
    const quadVerts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    const quadPositions = new Float32Array([
      -1, -1, 0,
       1, -1, 0,
       1,  1, 0,
      -1,  1, 0
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(quadPositions, 3));
    geo.setAttribute('aQuadPos', new THREE.BufferAttribute(quadVerts, 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);

    this.viewZBuffer = new Float32Array(count);
    this.bucketBuffer = new Uint16Array(count);
    this.countBuffer = new Int32Array(65536);
    this.sortedIndicesFloat = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.sortedIndicesFloat[i] = i;
    }

    this.sortAttribute = new THREE.InstancedBufferAttribute(this.sortedIndicesFloat, 1);
    this.sortAttribute.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSplatIndex', this.sortAttribute);
    geo.instanceCount = count;
    this.splatGeometry = geo;

    if (renderer && typeof renderer.getDrawingBufferSize === 'function') {
      renderer.getDrawingBufferSize(this.viewportVec);
    }
    if (this.viewportVec.x <= 0 || this.viewportVec.y <= 0) {
      this.viewportVec.set(1280, 720);
    }

    this.splatMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uCenterTex: { value: uCenterTex },
        uCovATex: { value: uCovATex },
        uCovBTex: { value: uCovBTex },
        uColorTex: { value: uColorTex },
        uTexWidth: { value: texWidth },
        uViewport: { value: this.viewportVec.clone() },
        uSplatScale: { value: 0.85 }
      },
      vertexShader: SPLAT_VERTEX_SHADER,
      fragmentShader: SPLAT_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    this.splatMesh = new THREE.Mesh(geo, this.splatMaterial);
    this.splatMesh.name = 'GaussianSplatCloud';
    this.splatMesh.frustumCulled = false;
    this.splatMesh.renderOrder = 2;
    this.scene.add(this.splatMesh);
  }

  private sortSplats(camera: THREE.PerspectiveCamera): void {
    if (
      !this.cloud ||
      !this.viewZBuffer ||
      !this.bucketBuffer ||
      !this.countBuffer ||
      !this.sortedIndicesFloat ||
      !this.sortAttribute
    ) {
      return;
    }

    camera.getWorldDirection(this.tmpCamDir);
    const posMovedSq = camera.position.distanceToSquared(this.lastSortCamPos);
    const dirDot = this.tmpCamDir.dot(this.lastSortCamDir);

    if (!this.needsSort && posMovedSq < 0.0009 && dirDot > 0.99985) {
      return;
    }

    this.needsSort = false;
    this.lastSortCamPos.copy(camera.position);
    this.lastSortCamDir.copy(this.tmpCamDir);

    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse.elements;
    const m2 = inv[2];
    const m6 = inv[6];
    const m10 = inv[10];
    const m14 = inv[14];

    const positions = this.cloud.positions;
    const count = this.cloud.count;
    const viewZ = this.viewZBuffer;

    let minVz = Infinity;
    let maxVz = -Infinity;

    for (let i = 0; i < count; i++) {
      const p3 = i * 3;
      const vz = m2 * positions[p3] + m6 * positions[p3 + 1] + m10 * positions[p3 + 2] + m14;
      viewZ[i] = vz;
      if (vz < minVz) minVz = vz;
      if (vz > maxVz) maxVz = vz;
    }

    const range = maxVz - minVz;
    const counts = this.countBuffer;
    counts.fill(0);

    if (range <= 1e-6) {
      for (let i = 0; i < count; i++) {
        this.sortedIndicesFloat[i] = i;
      }
      this.sortAttribute.needsUpdate = true;
      return;
    }

    const invRange = 65535 / range;
    const buckets = this.bucketBuffer;

    for (let i = 0; i < count; i++) {
      let b = ((viewZ[i] - minVz) * invRange) | 0;
      if (b < 0) b = 0;
      else if (b > 65535) b = 65535;
      buckets[i] = b;
      counts[b]++;
    }

    let acc = 0;
    for (let b = 0; b < 65536; b++) {
      const c = counts[b];
      counts[b] = acc;
      acc += c;
    }

    const sortedFloat = this.sortedIndicesFloat;
    for (let i = 0; i < count; i++) {
      const outPos = counts[buckets[i]]++;
      sortedFloat[outPos] = i;
    }

    this.sortAttribute.needsUpdate = true;
  }

  public update(_deltaTime: number, elapsedTime: number): void {
    if (!this.isInitialized) return;
    if (this.skyMaterial?.uniforms?.uTime) {
      this.skyMaterial.uniforms.uTime.value = elapsedTime;
    }
  }

  public render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void {
    if (!this.isInitialized) return;

    if (this.splatMaterial?.uniforms?.uViewport && typeof renderer.getDrawingBufferSize === 'function') {
      renderer.getDrawingBufferSize(this.viewportVec);
      if (this.viewportVec.x > 0 && this.viewportVec.y > 0) {
        this.splatMaterial.uniforms.uViewport.value.copy(this.viewportVec);
      }
    }

    this.sortSplats(camera);
    renderer.render(this.scene, camera);
  }

  public updateConfig(newConfig: Partial<SpaceConfig>): void {
    if (!this.isInitialized || !newConfig) return;

    if (newConfig.sky && this.skyMaterial) {
      if (newConfig.sky.topColor) {
        this.skyMaterial.uniforms.uTopColor.value.set(newConfig.sky.topColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.topColor = newConfig.sky.topColor;
      }
      if (newConfig.sky.bottomColor) {
        this.skyMaterial.uniforms.uBottomColor.value.set(newConfig.sky.bottomColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.bottomColor = newConfig.sky.bottomColor;
      }
      if (newConfig.sky.horizonColor) {
        this.skyMaterial.uniforms.uHorizonColor.value.set(newConfig.sky.horizonColor);
        if (this.currentConfig?.sky) this.currentConfig.sky.horizonColor = newConfig.sky.horizonColor;
      }
    }

    if (newConfig.audio && this.currentConfig?.audio) {
      if (typeof newConfig.audio.defaultVolume === 'number' && Number.isFinite(newConfig.audio.defaultVolume)) {
        this.currentConfig.audio.defaultVolume = newConfig.audio.defaultVolume;
      }
    }

    if (this.currentConfig && this.onConfigUpdate) {
      this.onConfigUpdate(this.currentConfig);
    }
  }

  public getGroundHeight(_x: number, _z: number): number {
    return this.groundY;
  }

  public getSpawnPoint(): ISpawnPoint {
    return {
      position: this.spawnPoint.position.clone(),
      lookAt: this.spawnPoint.lookAt.clone()
    };
  }

  public getWanderBounds(): IWanderBounds {
    const r = Math.max(12, Math.min(40, this.coreRadius * 1.5));
    return {
      radius: r,
      center: new THREE.Vector3(this.coreCenter.x, this.groundY, this.coreCenter.z),
      minX: this.coreCenter.x - r,
      maxX: this.coreCenter.x + r,
      minZ: this.coreCenter.z - r,
      maxZ: this.coreCenter.z + r
    };
  }

  public getPointsOfInterest(): IPointOfInterest[] {
    return this.pois.map((p) => ({
      name: p.name,
      position: p.position.clone(),
      dwellTime: p.dwellTime
    }));
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getSplatCount(): number {
    return this.cloud?.count ?? 0;
  }

  public dispose(): void {
    if (!this.isInitialized) return;

    ThreeResourceDisposer.disposeHierarchy(this.scene);

    this.splatMesh = null;
    this.splatMaterial = null;
    this.splatGeometry = null;
    this.sortAttribute = null;
    this.skyMesh = null;
    this.skyMaterial = null;
    this.groundMesh = null;
    this.groundMaterial = null;

    this.cloud = null;
    this.viewZBuffer = null;
    this.bucketBuffer = null;
    this.countBuffer = null;
    this.sortedIndicesFloat = null;

    this.isInitialized = false;
  }
}
