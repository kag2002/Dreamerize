import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PbrTextureSet } from '../textures/pbrTextures';
import { clamp01, mulberry32, noise2D } from '../vietnam/geometry/math';
import type { MaterialLibraryLike } from '../vietnam/core/types';

export { clamp01, mulberry32, noise2D };

export interface SignageAtlasLike {
  createPlaqueMesh(opts: Record<string, any>): THREE.Mesh;
  getStats?(): {
    sheets: number;
    cachedPlaques: number;
    materials: number;
    reusedMaterials: number;
  };
  dispose(): void;
}

export interface VietnamSharedShaders {
  readonly warmLightPool: {
    material: THREE.ShaderMaterial;
    uniforms: { uTime: { value: number }; uIntensity: { value: number } };
  };
  readonly incenseSmoke: {
    material: THREE.ShaderMaterial;
    uniforms: {
      uTime: { value: number };
      uWindDir: { value: THREE.Vector2 };
      uWindSpeed: { value: number };
    };
  };
  getWavingFlag: (options?: {
    waveScale?: number;
    color?: THREE.ColorRepresentation;
    showStar?: boolean;
  }) => {
    material: THREE.ShaderMaterial;
    uniforms: { uTime: { value: number }; uWindSpeed: { value: number } };
  };
  allMaterials: THREE.Material[];
  allUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
  getReusedCount(): number;
  dispose: () => void;
}

export interface VietnamCachedTextures {
  dongSon?: {
    map: THREE.DataTexture;
    normalMap: THREE.DataTexture;
    roughnessMap: THREE.DataTexture;
  };
  redEmblemSail?: THREE.DataTexture;
  brocade?: THREE.DataTexture;
  filmstrip?: THREE.DataTexture;
}

export interface ExclusionCircle {
  x: number;
  z: number;
  r: number;
}

export interface JunkBoatMotion {
  group: THREE.Group;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
}

export interface VietnamPbrBundle {
  stone: PbrTextureSet;
  terracotta: PbrTextureSet;
  darkRoof: PbrTextureSet;
  timber: PbrTextureSet;
  plaster: PbrTextureSet;
  granite: PbrTextureSet;
  bark: PbrTextureSet;
  leafAtlas: THREE.Texture;
  chamBrick?: PbrTextureSet;
  marseilleBrick?: PbrTextureSet;
  imperialBrick?: PbrTextureSet;
  laterite?: PbrTextureSet;
  agedPlaster?: PbrTextureSet;
  batTrangFloor?: PbrTextureSet;
  thatch?: PbrTextureSet;
  bambooWeave?: PbrTextureSet;
  bronzePatina?: PbrTextureSet;
}

export interface VietnamSharedMaterials {
  stone: THREE.MeshStandardMaterial;
  whitePlaster: THREE.MeshStandardMaterial;
  yellowOchrePlaster: THREE.MeshStandardMaterial;
  crimsonLacquer: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  terracottaRoof: THREE.MeshStandardMaterial;
  darkRoof: THREE.MeshStandardMaterial;
  chamBrick: THREE.MeshStandardMaterial;
  granite: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  darkVoid: THREE.MeshStandardMaterial;
  lanternSilk: THREE.MeshStandardMaterial;
  lanternCore?: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  jadeRoof?: THREE.MeshStandardMaterial;
  whiteMarble?: THREE.MeshStandardMaterial;
  ochreSand?: THREE.MeshStandardMaterial;
  marseilleBrick?: THREE.MeshStandardMaterial;
  weatheredImperialBrick?: THREE.MeshStandardMaterial;
  lateriteHoneycomb?: THREE.MeshStandardMaterial;
  agedPlaster?: THREE.MeshStandardMaterial;
  agedYellowPlaster?: THREE.MeshStandardMaterial;
  mossyPlaster?: THREE.MeshStandardMaterial;
  batTrangFloor?: THREE.MeshStandardMaterial;
  thatchFiber?: THREE.MeshStandardMaterial;
  bambooWeave?: THREE.MeshStandardMaterial;
  bronzePatina?: THREE.MeshStandardMaterial;
  stainedGlass?: THREE.MeshStandardMaterial;
  darkIronwood?: THREE.MeshStandardMaterial;
}

export interface VietnamBuilderContext {
  scene: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  pbr: VietnamPbrBundle;
  materials: VietnamSharedMaterials;
  materialLib?: MaterialLibraryLike;
  signageAtlas?: SignageAtlasLike;
  sharedShaders?: VietnamSharedShaders;
  cachedTextures?: VietnamCachedTextures;
  exclusionCircles: ExclusionCircle[];
  junkBoats: JunkBoatMotion[];
  extraTextures: THREE.Texture[];
  extraMaterials: THREE.Material[];
  foliageWindUniforms: Array<{ uTime: { value: number }; uWindSpeed: { value: number } }>;
  animatedUniforms?: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
  getHeight: (x: number, z: number) => number;
  getNormal: (x: number, z: number, target?: THREE.Vector3) => THREE.Vector3;
}

/**
 * Ensures geometry is non-indexed with position, normal, and uv attributes so mergeGeometries succeeds cleanly.
 */
export function normalizeForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    const uvs = new Float32Array(count * 2);
    const pos = g.attributes.position;
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = (pos.getX(i) + pos.getZ(i)) * 0.25;
      uvs[i * 2 + 1] = pos.getY(i) * 0.25;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  if (g !== geo) geo.dispose();
  return g;
}

export function mergeNormalized(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    return new THREE.BufferGeometry();
  }
  const norm = parts.map((p) => normalizeForMerge(p));
  const merged = mergeGeometries(norm, false);
  for (const g of norm) g.dispose();
  if (!merged) {
    return new THREE.BufferGeometry();
  }
  return merged;
}

/**
 * Projects consistent world-scale triplanar box UVs onto any merged wall/brick BufferGeometry
 * so brick courses and stone blocks maintain uniform real-world scale across large & small walls.
 */
export function applyWorldBoxUV(
  geo: THREE.BufferGeometry,
  metersPerTile = 2.4
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const norm = geo.attributes.normal;
  const inv = 1.0 / Math.max(0.1, metersPerTile);
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * inv;
      uvs[i * 2 + 1] = z * inv;
    } else if (nx >= nz) {
      uvs[i * 2] = z * inv;
      uvs[i * 2 + 1] = y * inv;
    } else {
      uvs[i * 2] = x * inv;
      uvs[i * 2 + 1] = y * inv;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

/**
 * Sculpted angular weathered rock / boulder geometry with cleavage planes and FBM crags.
 */
export function createSculptedRockGeometry(
  seed: number,
  rx: number,
  ry: number,
  rz: number,
  detail = 3
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const n1 = noise2D(vx * 2.1 + vy * 1.3, vz * 2.1 - vy * 1.1, seed);
    const n2 = noise2D(vx * 4.8 - vz * 3.2, vy * 4.4 + vx * 1.9, seed + 11.4);
    const ridged = 1.0 - Math.abs(n1);
    const rad = 0.80 + ridged * 0.26 + n2 * 0.10;
    if (vy < -0.35) {
      vy = -0.35 + (vy + 0.35) * 0.35;
    }
    vx *= rad * rx;
    vy *= rad * ry;
    vz *= rad * rz;
    pos.setXYZ(i, vx, vy, vz);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an extruded wall panel with a semicircular arched portal cutout.
 */
export function createArchedWallGeometry(
  width: number,
  height: number,
  depth: number,
  archWidth: number,
  archHeight: number
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height);
  shape.lineTo(-hw, height);
  shape.closePath();

  const haw = Math.min(archWidth * 0.5, hw * 0.78);
  const springY = Math.max(0.15, archHeight - haw);
  const hole = new THREE.Path();
  hole.moveTo(-haw, 0);
  hole.lineTo(-haw, springY);
  hole.absarc(0, springY, haw, Math.PI, 0, true);
  hole.lineTo(haw, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 16
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

/**
 * Generates an extruded wall panel with a pointed Gothic / ogival arched portal cutout
 * (used for Tháp Rùa Hồ Hoàn Kiếm and Nhà Thờ Đức Bà Romanesque-Gothic arches).
 */
export function createPointedArchedWallGeometry(
  width: number,
  height: number,
  depth: number,
  archWidth: number,
  archHeight: number
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height);
  shape.lineTo(-hw, height);
  shape.closePath();

  const haw = Math.min(archWidth * 0.5, hw * 0.80);
  const peakY = Math.min(height - 0.08, Math.max(0.35, archHeight));
  const springY = Math.max(0.12, peakY - haw * 1.15);

  const hole = new THREE.Path();
  hole.moveTo(-haw, 0);
  hole.lineTo(-haw, springY);
  hole.quadraticCurveTo(-haw * 0.88, springY + (peakY - springY) * 0.72, 0, peakY);
  hole.quadraticCurveTo(haw * 0.88, springY + (peakY - springY) * 0.72, haw, springY);
  hole.lineTo(haw, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 14
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

/**
 * FIX HV02-1: Generates a botanically accurate peltate circular cupped Vietnamese Lotus leaf (*Nelumbo nucifera*)
 * with continuous wavy ruffled edge & central funnel depression (NO water-lily V-notch!).
 */
export function createNotchedLotusPadGeometry(radius = 0.48, segments = 16): THREE.BufferGeometry {
  const r = Math.max(0.05, radius);
  const geo = new THREE.CircleGeometry(r, segments);
  geo.rotateX(-Math.PI * 0.5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    const dist = Math.hypot(px, pz);
    const d = dist / r;
    const ang = Math.atan2(pz, px);
    const waveR = 1.0 + 0.045 * Math.sin(ang * 9.0) * d;
    // Peltate funnel depression at center (-0.06*r), cupped upward ruffled edge
    const cupY = 0.025 - (1.0 - d) * 0.055 * r + d * d * 0.065 * r + Math.sin(ang * 9.0) * 0.028 * r * d;
    pos.setXYZ(i, px * waveR, cupY, pz * waveR);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an extruded wall panel with a stepped corbelled brick triangular arch cutout
 * authentic to Chăm Pa sanctuaries (Tháp Poshanư, Mỹ Sơn vestibules).
 */
export function createSteppedCorbelArchWallGeometry(
  width: number,
  height: number,
  depth: number,
  archWidth: number,
  archHeight: number,
  steps = 6
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height);
  shape.lineTo(-hw, height);
  shape.closePath();

  const haw = Math.min(archWidth * 0.5, hw * 0.78);
  const peakY = Math.min(height - 0.12, Math.max(0.45, archHeight));
  const springY = Math.max(0.18, peakY * 0.52);
  const numSteps = Math.max(3, Math.floor(steps));
  const stepH = (peakY - springY) / numSteps;
  const stepW = haw / numSteps;

  const hole = new THREE.Path();
  hole.moveTo(-haw, 0);
  hole.lineTo(-haw, springY);
  for (let s = 0; s < numSteps; s++) {
    const curX = -haw + s * stepW;
    const nextX = Math.min(-0.02, curX + stepW);
    const curY = springY + s * stepH;
    hole.lineTo(nextX, curY);
    hole.lineTo(nextX, curY + stepH);
  }
  hole.lineTo(0, peakY);
  for (let s = numSteps - 1; s >= 0; s--) {
    const rightX = haw - s * stepW;
    const innerX = Math.max(0.02, rightX - stepW);
    const curY = springY + s * stepH;
    hole.lineTo(innerX, curY + stepH);
    hole.lineTo(innerX, curY);
  }
  hole.lineTo(haw, springY);
  hole.lineTo(haw, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 1
  });
  geo.translate(0, 0, -depth * 0.5);
  return applyWorldBoxUV(geo, 1.8);
}

/**
 * Generates an authentic Vietnamese 2-slope pitched gable roof (*mái 2 dốc bít đốc* —
 * Hội An shophouses, Cổng Làng Mông Phụ, Nhà Sàn Thái, Chòi canh lúa, Nhà Mồ)
 * with real eave thickness and slope-aligned tile UVs.
 */
export function createGableRoofGeometry(
  width: number,
  depth: number,
  height: number,
  thickness = 0.16,
  ridgeAxis: 'x' | 'z' = 'x'
): THREE.BufferGeometry {
  const span = ridgeAxis === 'x' ? depth : width;
  const len = ridgeAxis === 'x' ? width : depth;
  const halfSpan = span * 0.5;
  const slopeLen = Math.hypot(halfSpan, height);
  const pitch = Math.atan2(height, halfSpan);
  const parts: THREE.BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    const panel = new THREE.BoxGeometry(len, thickness, slopeLen + 0.08);
    panel.rotateX(side * pitch);
    panel.translate(0, height * 0.5, side * halfSpan * 0.5);
    parts.push(panel);
  }
  // Ridge cap tile course
  const ridge = new THREE.BoxGeometry(len + 0.06, thickness * 1.25, thickness * 1.6);
  ridge.translate(0, height + thickness * 0.2, 0);
  parts.push(ridge);

  const merged = mergeNormalized(parts);
  if (ridgeAxis === 'z') {
    merged.rotateY(Math.PI * 0.5);
  }
  return applyWorldBoxUV(merged, 2.2);
}

/**
 * Generates a curved Chăm Pa boat-shaped saddle roof (*mái hình thuyền yên ngựa* —
 * Mỹ Sơn Kosa B5 & Ponagar Northwest Tower) with upturned curved brick gables.
 */
export function createBoatSaddleRoofGeometry(
  length: number,
  width: number,
  height: number,
  gableRise = 0.65
): THREE.BufferGeometry {
  const segU = 18;
  const segV = 16;
  const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2.0; // -1..1 along length
    const v = pos.getZ(i) * 2.0; // -1..1 across width
    const av = Math.abs(v);
    // Barrel vault cross-section with slight concave flare at eaves & upward saddle sweep toward gable ends
    const arch = Math.pow(Math.max(0, 1.0 - av * av), 0.72);
    const saddle = gableRise * (u * u) * (0.45 + 0.55 * arch);
    const flare = 1.0 + 0.10 * (u * u) * (1.0 - av * 0.5);
    pos.setXYZ(i, u * length * 0.5 * flare, arch * height + saddle, v * width * 0.5);
  }
  geo.computeVertexNormals();
  // Add curved gable end walls closing both -X and +X ends
  const parts: THREE.BufferGeometry[] = [geo];
  for (const sx of [-1, 1]) {
    const gShape = new THREE.Shape();
    gShape.moveTo(-width * 0.48, 0);
    for (let k = -8; k <= 8; k++) {
      const vt = k / 8;
      const arch = Math.pow(Math.max(0, 1.0 - vt * vt), 0.72);
      const y = arch * height + gableRise * (0.45 + 0.55 * arch);
      gShape.lineTo(vt * width * 0.48, y);
    }
    gShape.lineTo(width * 0.48, 0);
    gShape.closePath();
    const gWall = new THREE.ExtrudeGeometry(gShape, { depth: 0.34, bevelEnabled: false });
    gWall.rotateY(Math.PI * 0.5);
    gWall.translate(sx * (length * 0.52) - 0.17, 0, 0);
    parts.push(gWall);
  }
  return applyWorldBoxUV(mergeNormalized(parts), 2.0);
}

/**
 * Generates a traditional Vietnamese curved upturned hipped roof (*mái đao cong 4 góc*)
 * with slope-aligned UVs and downward eave fascia lip so roof edges have architectural thickness.
 */
export function createVietnameseCurvedRoofGeometry(
  baseWidth: number,
  baseDepth: number,
  topWidth: number,
  topDepth: number,
  height: number,
  eaveFlare = 0.24
): THREE.BufferGeometry {
  const segX = 16;
  const segZ = 16;
  const geo = new THREE.PlaneGeometry(1, 1, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const tileRepeatX = Math.max(1.5, baseWidth / 2.2);
  const tileRepeatZ = Math.max(1.5, baseDepth / 2.2);
  const slopeRepeat = Math.max(1.2, Math.hypot(Math.max(baseWidth, baseDepth) * 0.5, height) / 2.0);

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i) * 2.0; // -1..1
    const uz = pos.getZ(i) * 2.0; // -1..1
    const radial = Math.max(Math.abs(ux), Math.abs(uz)); // 0 at ridge apex, 1 at eave edge
    const cornerDiag = Math.abs(ux) * Math.abs(uz); // strongest at 4 corners

    const w = THREE.MathUtils.lerp(topWidth, baseWidth, radial);
    const d = THREE.MathUtils.lerp(topDepth, baseDepth, radial);
    const x = ux * w * 0.5;
    const z = uz * d * 0.5;

    // Concave sagging sweep toward eaves + dramatic upturned dragon-tail corner eaves
    const concave = Math.pow(1.0 - radial, 1.45);
    const upturn = eaveFlare * Math.pow(radial, 2.4) * (0.35 + 1.45 * cornerDiag);
    const y = concave * height + upturn;
    pos.setXYZ(i, x, y, z);

    // Orient barrel-tile UVs down the true slope of each of the 4 roof faces
    if (Math.abs(ux) > Math.abs(uz)) {
      uv.setXY(i, (uz * 0.5 + 0.5) * tileRepeatZ, radial * slopeRepeat);
    } else {
      uv.setXY(i, (ux * 0.5 + 0.5) * tileRepeatX, radial * slopeRepeat);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a stratified Hạ Long Bay limestone karst pillar with tidal undercut notch
 * and varied natural limestone archetypes (pinnacle, twin-horn saddle, or table mesa).
 */
export function createHaLongKarstGeometry(
  seed: number,
  baseRadius: number,
  height: number,
  leanX = 0,
  leanZ = 0
): THREE.BufferGeometry {
  const radSegs = 28;
  const hSegs = 26;
  const geo = new THREE.CylinderGeometry(baseRadius * 0.72, baseRadius, height, radSegs, hSegs, false);
  geo.translate(0, height * 0.5, 0);

  const archType = Math.abs(Math.floor(seed)) % 3; // 0: pinnacle spire, 1: twin-peak saddle, 2: flat-top mesa
  const rotOffset = (seed * 1.73) % (Math.PI * 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    const t = clamp01(y / height);
    const ang = Math.atan2(z, x) + rotOffset;

    // Classic Hạ Long Bay tidal wave-cut notch right near water level (t in 0.04..0.16)
    const notchDepth = 0.20 + 0.08 * ((Math.abs(Math.sin(seed * 3.1)) + 0.2) * 0.8);
    const tidalNotch = 1.0 - notchDepth * Math.exp(-Math.pow((t - 0.085) / 0.055, 2.0));

    // Stratified limestone ledges + asymmetric domain-warped FBM fluting
    const strata =
      0.075 * Math.sin(y * (1.25 + (seed % 5) * 0.11) + seed) +
      0.045 * Math.cos(y * 2.85 - seed * 0.7) +
      0.03 * Math.max(-0.5, Math.sin(t * Math.PI * 6.0 + seed));

    const warpAng = ang + 0.42 * noise2D(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6 + t * 1.8, seed + 5.2);
    const angularFlute =
      0.19 * Math.sin(warpAng * 2.0 + seed * 1.3) +
      0.13 * Math.cos(warpAng * 3.0 - seed * 0.9) +
      0.08 * Math.sin(warpAng * 5.0 + seed * 2.1) +
      0.09 * noise2D(Math.cos(warpAng) * 2.4 + t * 2.2, Math.sin(warpAng) * 2.4 - t * 1.7, seed);

    // Archetype silhouette taper
    let summitTaper = 1.0;
    if (archType === 0) {
      // Sharp pinnacle / sea-stack karst
      summitTaper = 1.0 - 0.56 * Math.pow(Math.max(0, t - 0.45) / 0.55, 1.35);
    } else if (archType === 1) {
      // Twin-horned saddle karst
      const lobe = 0.5 + 0.5 * Math.cos(ang * 2.0);
      summitTaper = 1.0 - (0.28 + 0.22 * (1.0 - lobe)) * Math.pow(Math.max(0, t - 0.62) / 0.38, 1.4);
    } else {
      // Broad jungle-crowned table karst
      summitTaper = 1.0 - 0.26 * Math.pow(Math.max(0, t - 0.76) / 0.24, 1.6);
    }

    const scale = Math.max(0.24, (tidalNotch + strata + angularFlute) * summitTaper);

    x = x * scale + leanX * Math.pow(t, 1.25);
    const nz = z * scale + leanZ * Math.pow(t, 1.25);

    // Varied summit crest profile
    if (t > 0.88) {
      const crestWeight = (t - 0.88) / 0.12;
      if (archType === 0) {
        y += (Math.cos(ang * 2.0) * 0.5 + 0.5) * (height * 0.055) * crestWeight;
      } else if (archType === 1) {
        y += Math.cos(ang * 2.0) * (height * 0.065) * crestWeight;
      } else {
        y += Math.sin(ang * 4.0 + seed) * (height * 0.025) * crestWeight;
      }
    }

    pos.setXYZ(i, x, y, nz);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a tiered red-brick Chăm Pa sanctuary tower (*Tháp Chàm* — Mỹ Sơn / Ponagar / Poshanư)
 * with stepped plinth, fluted vertical pilasters, arched portal vestibule, diminishing upper stories
 * with corner flame acroteria, and a carved lotus-bud (*kalasa*) crown.
 */
export function createChamTowerGeometry(
  baseW: number,
  height: number,
  tiers = 4,
  options?: { skipBuiltInVestibule?: boolean; hoaLaiStyle?: boolean }
): THREE.BufferGeometry {
  const w = Math.max(0.5, baseW);
  const h = Math.max(1.2, height);
  const numTiers = Math.max(1, Math.min(8, Math.floor(tiers)));
  const skipVest = options?.skipBuiltInVestibule ?? false;
  const hoaLai = options?.hoaLaiStyle ?? false;
  const parts: THREE.BufferGeometry[] = [];

  // 1. Multi-stepped Chăm masonry plinth (4 carved horizontal molding bands)
  const plinth1H = h * 0.036;
  const plinth2H = h * 0.030;
  const plinth3H = h * 0.024;
  const p1 = new THREE.BoxGeometry(w * 1.18, plinth1H, w * 1.18);
  p1.translate(0, plinth1H * 0.5, 0);
  const p2 = new THREE.BoxGeometry(w * 1.10, plinth2H, w * 1.10);
  p2.translate(0, plinth1H + plinth2H * 0.5, 0);
  const p3 = new THREE.BoxGeometry(w * 1.03, plinth3H, w * 1.03);
  p3.translate(0, plinth1H + plinth2H + plinth3H * 0.5, 0);
  parts.push(p1, p2, p3);

  // 2. Main sanctuary cella body (*Thân tháp*) with fluted vertical pilasters (recessed grooves)
  const bodyY0 = plinth1H + plinth2H + plinth3H;
  const bodyH = h * 0.41;
  const coreW = w * 0.88;
  const bodyCore = new THREE.BoxGeometry(coreW, bodyH, coreW);
  bodyCore.translate(0, bodyY0 + bodyH * 0.5, 0);
  parts.push(bodyCore);

  // Fluted corner pilasters + 2 rhythmic intermediate fluted pilasters per facade
  const pilW = w * 0.13;
  const pilOff = coreW * 0.5 - pilW * 0.25;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerPil = new THREE.BoxGeometry(pilW, bodyH, pilW);
      cornerPil.translate(sx * pilOff, bodyY0 + bodyH * 0.5, sz * pilOff);
      // Stepped pilaster base & capital molding
      const cap = new THREE.BoxGeometry(pilW * 1.18, bodyH * 0.07, pilW * 1.18);
      cap.translate(sx * pilOff, bodyY0 + bodyH * 0.94, sz * pilOff);
      parts.push(cornerPil, cap);
    }
  }
  const fluteW = w * 0.055;
  const fluteDepth = w * 0.055;
  for (const side of [1, -1]) {
    for (const off of [-w * 0.26, w * 0.26]) {
      for (const rib of [-fluteW * 0.65, fluteW * 0.65]) {
        const pilZ = new THREE.BoxGeometry(fluteW * 0.8, bodyH * 0.96, fluteDepth);
        pilZ.translate(off + rib, bodyY0 + bodyH * 0.48, side * (coreW * 0.5 + fluteDepth * 0.35));
        const pilX = new THREE.BoxGeometry(fluteDepth, bodyH * 0.96, fluteW * 0.8);
        pilX.translate(side * (coreW * 0.5 + fluteDepth * 0.35), bodyY0 + bodyH * 0.48, off + rib);
        parts.push(pilZ, pilX);
      }
    }
  }

  // Front projecting entrance vestibule (*Tiền sảnh* on +Z) with stepped corbelled or arched portal
  if (!skipVest) {
    const vestW = w * 0.56;
    const vestH = bodyH * 0.78;
    const vestD = w * 0.26;
    const vestWall = hoaLai
      ? createSteppedCorbelArchWallGeometry(vestW, vestH, vestD, vestW * 0.54, vestH * 0.78, 6)
      : createArchedWallGeometry(vestW, vestH, vestD, vestW * 0.52, vestH * 0.72);
    vestWall.translate(0, bodyY0, coreW * 0.5 + vestD * 0.45);
    parts.push(vestWall);

    // 3-tier stepped corbelled entrance pediment
    for (let st = 0; st < 3; st++) {
      const f = 1.0 - st * 0.24;
      const band = new THREE.BoxGeometry(vestW * 1.08 * f, vestH * 0.11, vestD * 1.12 * f);
      band.translate(0, bodyY0 + vestH + vestH * (0.05 + st * 0.11), coreW * 0.5 + vestD * 0.45);
      parts.push(band);
    }
  }

  // FIX MS-02: 3-tier nested sculpted Chăm ogee leaf-arch false-door gables (*Cửa giả vòm lá đề giật cấp 3 tầng*) on -Z, +X, -X faces (ref 86b!)
  for (const [fx, fz, rotY] of [
    [0, -(coreW * 0.5 + w * 0.03), Math.PI],
    [coreW * 0.5 + w * 0.03, 0, Math.PI * 0.5],
    [-(coreW * 0.5 + w * 0.03), 0, -Math.PI * 0.5]
  ]) {
    for (let layer = 0; layer < 3; layer++) {
      const lf = 1.0 - layer * 0.23;
      const halfW = w * 0.21 * lf;
      const wallH = bodyH * (0.48 - layer * 0.08);
      const peakH = bodyH * (0.28 - layer * 0.04);
      const ogeeShape = new THREE.Shape();
      ogeeShape.moveTo(-halfW, 0);
      ogeeShape.lineTo(-halfW, wallH);
      ogeeShape.quadraticCurveTo(-halfW * 0.85, wallH + peakH * 0.62, 0, wallH + peakH);
      ogeeShape.quadraticCurveTo(halfW * 0.85, wallH + peakH * 0.62, halfW, wallH);
      ogeeShape.lineTo(halfW, 0);
      ogeeShape.closePath();
      const ogeeGable = new THREE.ExtrudeGeometry(ogeeShape, { depth: w * 0.052, bevelEnabled: false, curveSegments: 4 });
      ogeeGable.translate(0, bodyY0, layer * w * 0.030);
      ogeeGable.rotateY(rotY);
      ogeeGable.translate(fx, 0, fz);
      parts.push(ogeeGable);
    }
  }

  // Main upper multi-stepped cornice molding (3 projecting bands) above cella
  const corniceH = h * 0.050;
  for (let cb = 0; cb < 3; cb++) {
    const bw = w * (0.98 + (cb === 1 ? 0.08 : 0.02));
    const bh = corniceH / 3;
    const band = new THREE.BoxGeometry(bw, bh, bw);
    band.translate(0, bodyY0 + bodyH + bh * (cb + 0.5), 0);
    parts.push(band);
  }

  // 3. Diminishing upper roof stories (*Các tầng tháp*) with multi-tiered corner acroteria
  let curY = bodyY0 + bodyH + corniceH;
  const tiersBudgetH = h * 0.355;
  let weightSum = 0;
  for (let t = 0; t < numTiers; t++) {
    weightSum += Math.pow(0.82, t);
  }

  for (let t = 0; t < numTiers; t++) {
    const ratio = Math.pow(0.75, t + 1);
    const tierW = w * ratio;
    const tierH = (tiersBudgetH * Math.pow(0.82, t)) / weightSum;
    const tierBodyH = tierH * 0.68;
    const tierCorniceH = tierH * 0.32;

    const tierBody = new THREE.BoxGeometry(tierW * 0.90, tierBodyH, tierW * 0.90);
    tierBody.translate(0, curY + tierBodyH * 0.5, 0);
    parts.push(tierBody);

    // Double-stepped cornice per upper story
    const cLow = new THREE.BoxGeometry(tierW * 1.02, tierCorniceH * 0.52, tierW * 1.02);
    cLow.translate(0, curY + tierBodyH + tierCorniceH * 0.26, 0);
    const cHigh = new THREE.BoxGeometry(tierW * 1.08, tierCorniceH * 0.48, tierW * 1.08);
    cHigh.translate(0, curY + tierBodyH + tierCorniceH * 0.76, 0);
    parts.push(cLow, cHigh);

    // 4 sculpted 2-tier corner miniature tower acroteria (*Tháp góc thu nhỏ*)
    const acroW = Math.max(0.08, tierW * 0.16);
    const acroH = tierH * 0.58;
    const acroOff = tierW * 0.44;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const aBase = new THREE.BoxGeometry(acroW, acroH * 0.52, acroW);
        aBase.translate(sx * acroOff, curY + tierH + acroH * 0.26, sz * acroOff);
        const aTip = new THREE.ConeGeometry(acroW * 0.55, acroH * 0.55, 4);
        aTip.rotateY(Math.PI * 0.25);
        aTip.translate(sx * acroOff, curY + tierH + acroH * 0.76, sz * acroOff);
        parts.push(aBase, aTip);
      }
    }

    curY += tierH;
  }

  // 4. Lotus-bud *kalasa* crown (or weathered stepped Hòa Lai square cap for Poshanư)
  const crownBudget = Math.max(h * 0.08, h - curY);
  const topW = w * Math.pow(0.75, numTiers + 1);
  if (hoaLai) {
    const cap1 = new THREE.BoxGeometry(topW * 1.12, crownBudget * 0.48, topW * 1.12);
    cap1.translate(0, curY + crownBudget * 0.24, 0);
    const cap2 = new THREE.BoxGeometry(topW * 0.74, crownBudget * 0.38, topW * 0.74);
    cap2.translate(0, curY + crownBudget * 0.65, 0);
    parts.push(cap1, cap2);
  } else {
    const lotusBaseH = crownBudget * 0.34;
    const lotusBudH = crownBudget * 0.66;

    const lotusBase = new THREE.CylinderGeometry(topW * 0.48, topW * 0.62, lotusBaseH, 8);
    lotusBase.translate(0, curY + lotusBaseH * 0.5, 0);
    parts.push(lotusBase);

    const lotusBud = new THREE.ConeGeometry(topW * 0.40, lotusBudH, 8);
    lotusBud.translate(0, curY + lotusBaseH + lotusBudH * 0.5, 0);
    parts.push(lotusBud);
  }

  return applyWorldBoxUV(mergeNormalized(parts), 1.9);
}

/**
 * Generates a circular Gothic / Romanesque rose window tracery frame in the XY plane facing +Z
 * for Nhà thờ Đức Bà Saigon and heritage colonial facades.
 */
export function createRoseWindowGeometry(
  radius: number,
  spokes = 12,
  depth = 0.28,
  style: 'gothic' | 'romanesque_8' = 'gothic'
): THREE.BufferGeometry {
  const r = Math.max(0.4, radius);
  const ringThick = Math.max(0.04, r * 0.085);
  const parts: THREE.BufferGeometry[] = [];

  const outerRing = new THREE.TorusGeometry(r, ringThick, 10, 32);
  parts.push(outerRing);

  if (style === 'romanesque_8') {
    // Authentic Saigon Notre-Dame Romanesque plate tracery: 1 central medallion + 8 satellite circular oculus rings
    const centerRing = new THREE.TorusGeometry(r * 0.26, ringThick * 0.72, 8, 20);
    parts.push(centerRing);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2.0;
      const sat = new THREE.TorusGeometry(r * 0.24, ringThick * 0.64, 8, 18);
      sat.translate(Math.cos(ang) * r * 0.64, Math.sin(ang) * r * 0.64, 0);
      parts.push(sat);
    }
    return mergeNormalized(parts);
  }

  const numSpokes = Math.max(4, Math.min(24, Math.floor(spokes)));
  const midRing = new THREE.TorusGeometry(r * 0.64, ringThick * 0.52, 8, 24);
  parts.push(midRing);

  const hubRing = new THREE.TorusGeometry(r * 0.24, ringThick * 0.60, 8, 20);
  parts.push(hubRing);

  const barThick = Math.max(0.03, ringThick * 0.52);
  const barDepth = Math.max(0.08, depth * 0.65);
  for (let i = 0; i < numSpokes; i++) {
    const ang = (i / numSpokes) * Math.PI * 2.0;
    const len = r * 0.76;
    const spoke = new THREE.BoxGeometry(len, barThick, barDepth);
    spoke.translate(r * 0.24 + len * 0.5, 0, 0);
    spoke.rotateZ(ang);
    parts.push(spoke);
  }

  return mergeNormalized(parts);
}

/**
 * Generates a slender tapered octagonal Gothic bell-tower spire with optional corner pinnacle spirelets
 * and finial cross base (resting on y = 0 up to y = height) for Nhà thờ Đức Bà twin spires.
 */
export function createGothicSpireGeometry(
  baseWidth: number,
  height: number,
  facets = 8,
  options?: { skipCross?: boolean; skipPinnacles?: boolean }
): THREE.BufferGeometry {
  const rBase = Math.max(0.3, baseWidth * 0.5);
  const h = Math.max(2.0, height);
  const sides = Math.max(4, Math.floor(facets));
  const skipCross = options?.skipCross ?? false;
  const skipPinnacles = options?.skipPinnacles ?? false;
  const parts: THREE.BufferGeometry[] = [];

  const collarH = h * 0.08;
  const collar = new THREE.CylinderGeometry(rBase * 1.02, rBase * 1.12, collarH, sides);
  collar.translate(0, collarH * 0.5, 0);
  parts.push(collar);

  const shaftH = h * 0.84;
  const shaft = new THREE.ConeGeometry(rBase, shaftH, sides);
  shaft.translate(0, collarH + shaftH * 0.5, 0);
  parts.push(shaft);

  // Optional 4 corner crocketed pinnacle spirelets around the spire base
  if (!skipPinnacles) {
    const pinR = Math.max(0.08, rBase * 0.16);
    const pinH = h * 0.22;
    const pinOff = rBase * 0.95;
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2.0 + Math.PI * 0.25;
      const pin = new THREE.ConeGeometry(pinR, pinH, 4);
      pin.rotateY(Math.PI * 0.25);
      pin.translate(Math.cos(ang) * pinOff, collarH + pinH * 0.5, Math.sin(ang) * pinOff);
      parts.push(pin);
    }
  }

  // Finial orb & cross at summit (can be skipped when a separate brass cross is placed)
  if (!skipCross) {
    const apexY = collarH + shaftH;
    const orbR = Math.max(0.08, rBase * 0.12);
    const orb = new THREE.SphereGeometry(orbR, 8, 6);
    orb.translate(0, apexY, 0);
    parts.push(orb);

    const crossH = Math.max(0.5, h * 0.08);
    const crossV = new THREE.BoxGeometry(orbR * 0.45, crossH, orbR * 0.45);
    crossV.translate(0, apexY + crossH * 0.5, 0);
    parts.push(crossV);

    const crossBar = new THREE.BoxGeometry(crossH * 0.58, orbR * 0.40, orbR * 0.40);
    crossBar.translate(0, apexY + crossH * 0.65, 0);
    parts.push(crossBar);
  }

  return mergeNormalized(parts);
}

/**
 * FIX NM-01: Authentic aged mossy imperial *Thanh Lưu Ly* green glazed roof tile material (#3f5d3f)
 * for Huế Imperial Citadel halls (replacing neon cyan #1b7a74!).
 */
export function createJadeTileMaterial(darkRoof?: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#3f5d3f',
    normalMap: darkRoof?.normalMap ?? null,
    roughnessMap: darkRoof?.roughnessMap ?? null,
    roughness: 0.38,
    metalness: 0.10,
    side: THREE.DoubleSide
  });
}

/**
 * Polished white marble material for Saigon, Huế, and ceremonial architectural trims.
 */
export function createWhiteMarbleMaterial(pbr?: PbrTextureSet): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#ebe6dc',
    normalMap: pbr?.normalMap ?? null,
    roughnessMap: pbr?.roughnessMap ?? null,
    roughness: 0.34,
    metalness: 0.04
  });
}

/**
 * Warm coastal ochre sandstone material for Chăm Pa / colonial architectural trims.
 */
export function createOchreSandMaterial(pbr?: PbrTextureSet): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#c9945a',
    map: pbr?.map ?? null,
    normalMap: pbr?.normalMap ?? null,
    roughnessMap: pbr?.roughnessMap ?? null,
    roughness: 0.78,
    metalness: 0.03
  });
}

/**
 * Generates a traditional Vietnamese ribbed silk lantern shell (*Đèn lồng Hội An*)
 * centered at the origin with tapered top/bottom collars and bamboo-rib indentations.
 */
export function createRibbedLanternShellGeometry(
  radius: number,
  height: number,
  radialSegs = 14,
  heightSegs = 10
): THREE.BufferGeometry {
  const r = Math.max(0.06, radius);
  const h = Math.max(0.10, height);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= heightSegs; i++) {
    const t = i / heightSegs; // 0 bottom .. 1 top
    const y = (t - 0.5) * h;
    // Bulging traditional lantern silhouette with subtle bamboo-rib ripples
    const bell = Math.sin(Math.PI * (0.12 + t * 0.76));
    const rib = 1.0 - 0.065 * Math.pow(Math.abs(Math.sin(t * Math.PI * 5.0)), 1.4);
    const collarTaper = t < 0.08 || t > 0.92 ? 0.52 : 1.0;
    const rad = Math.max(0.02, r * bell * rib * collarTaper);
    pts.push(new THREE.Vector2(rad, y));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a bright inner candle core geometry for silk lanterns.
 */
export function createLanternCoreGeometry(radius: number, height: number): THREE.BufferGeometry {
  const r = Math.max(0.03, radius * 0.44);
  const h = Math.max(0.06, height * 0.46);
  const geo = new THREE.SphereGeometry(r, 8, 6);
  geo.scale(1.0, h / Math.max(r * 2.0, 0.01), 1.0);
  return geo;
}

/**
 * Generates top & bottom lacquered wooden collars plus bottom hanging silk tassel for a lantern.
 */
export function createLanternCapGeometry(radius: number, height: number): THREE.BufferGeometry {
  const r = Math.max(0.05, radius);
  const h = Math.max(0.10, height);
  const topRing = new THREE.CylinderGeometry(r * 0.42, r * 0.54, h * 0.12, 10);
  topRing.translate(0, h * 0.48, 0);

  const botRing = new THREE.CylinderGeometry(r * 0.52, r * 0.38, h * 0.12, 10);
  botRing.translate(0, -h * 0.48, 0);

  const tassel = new THREE.ConeGeometry(r * 0.16, h * 0.34, 6);
  tassel.rotateX(Math.PI);
  tassel.translate(0, -h * 0.68, 0);

  return mergeNormalized([topRing, botRing, tassel]);
}

/**
 * Creates an additive warm radial amber-gold light pool ShaderMaterial for placing on
 * ground tiles or water beneath glowing lanterns.
 */
export function createWarmLightPoolMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: { uTime: { value: number }; uIntensity: { value: number } };
} {
  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vColor = vec3(1.0, 0.68, 0.28);
        #ifdef USE_COLOR
        vColor = color;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r2 = dot(d, d);
        if (r2 > 1.0) discard;
        float falloff = exp(-r2 * 4.2) * (1.0 - smoothstep(0.55, 1.0, r2));
        float flicker = 0.90 + 0.10 * sin(uTime * 3.1 + vColor.r * 9.0);
        gl_FragColor = vec4(vColor * uIntensity * flicker * 0.42, falloff * 0.55 * min(uIntensity, 1.8));
      }
    `
  });
  return { material, uniforms };
}

/**
 * Creates a reusable animated waving silk flag ShaderMaterial (optionally with the golden 5-pointed star).
 */
export function createWavingSilkFlagMaterial(options?: {
  waveScale?: number;
  color?: THREE.ColorRepresentation;
  showStar?: boolean;
}): {
  material: THREE.ShaderMaterial;
  uniforms: { uTime: { value: number }; uWindSpeed: { value: number } };
} {
  const waveScale = options?.waveScale ?? 1.0;
  const col = new THREE.Color(options?.color ?? '#d91619');
  const showStar = options?.showStar ?? true;

  const uniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 2.0 },
    uWaveScale: { value: waveScale },
    uFlagColor: { value: col },
    uShowStar: { value: showStar ? 1.0 : 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWaveScale;
      varying vec2 vUv;
      varying float vWaveSlope;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float hoist = clamp(uv.x, 0.0, 1.0);
        float windMul = 0.75 + 0.25 * clamp(uWindSpeed, 0.2, 4.0);
        float amp = pow(hoist, 0.85) * uWaveScale * windMul;
        float t = uTime * (0.85 + 0.22 * clamp(uWindSpeed, 0.2, 4.0));
        float phase = hoist * 7.2 - t * 3.6 + uv.y * 1.6;
        float wave1 = sin(phase) * 0.30;
        float wave2 = sin(hoist * 13.5 - t * 6.2 - uv.y * 2.4) * 0.10;
        pos.z += (wave1 + wave2) * amp;
        pos.y -= 0.14 * hoist * hoist * uWaveScale * (0.72 + 0.28 * sin(t * 1.7 + hoist * 2.6));
        pos.x -= 0.08 * hoist * hoist * uWaveScale;

        vWaveSlope = cos(phase) * 0.85 * pow(hoist, 0.85);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFlagColor;
      uniform float uShowStar;
      varying vec2 vUv;
      varying float vWaveSlope;

      float sdStar5Flag(vec2 p, float r, float rf) {
        const vec2 k1 = vec2(0.809016994375, -0.587785252292);
        const vec2 k2 = vec2(-k1.x, k1.y);
        p.x = abs(p.x);
        p -= 2.0 * max(dot(k1, p), 0.0) * k1;
        p -= 2.0 * max(dot(k2, p), 0.0) * k2;
        p.x = abs(p.x);
        p.y -= r;
        vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
        float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
        return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
      }

      void main() {
        vec3 baseCol = uFlagColor;
        if (uShowStar > 0.5) {
          vec2 p = vec2((vUv.x - 0.5) * 1.5, vUv.y - 0.5);
          float dStar = sdStar5Flag(p, 0.28, 0.381966);
          float starMask = 1.0 - smoothstep(-0.008, 0.008, dStar);
          vec3 goldStar = vec3(0.995, 0.845, 0.125);
          baseCol = mix(baseCol, goldStar, starMask);
        }
        float sheen = 0.86 + 0.22 * vWaveSlope + 0.03 * sin(vUv.y * 80.0);
        gl_FragColor = vec4(baseCol * sheen, 1.0);
      }
    `
  });
  material.customProgramCacheKey = () => 'vietnam-waving-silk-flag';
  return { material, uniforms };
}

export interface IncenseSmokeHandle {
  mesh: THREE.InstancedMesh;
  uniforms: {
    uTime: { value: number };
    uWindDir: { value: THREE.Vector2 };
    uWindSpeed: { value: number };
  };
  dispose: () => void;
}

/**
 * Creates the reusable ShaderMaterial + uniform block for curling incense smoke tendrils.
 */
export function createIncenseSmokeMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: {
    uTime: { value: number };
    uWindDir: { value: THREE.Vector2 };
    uWindSpeed: { value: number };
  };
} {
  const uniforms = {
    uTime: { value: 0.0 },
    uWindDir: { value: new THREE.Vector2(0.85, 0.45).normalize() },
    uWindSpeed: { value: 2.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aOrigin;
      attribute vec2 aSeed;

      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindSpeed;

      varying vec2 vUv;
      varying float vAlpha;

      void main() {
        vUv = uv;
        float life = fract(aSeed.x + uTime * 0.11);
        float riseH = (4.2 + 1.2 * sin(aSeed.y)) * aOrigin.w;
        float y = aOrigin.y + life * riseH;

        float driftAmt = pow(life, 1.35) * (0.95 + 0.35 * clamp(uWindSpeed, 0.2, 4.0)) * aOrigin.w;
        float curlX = sin(life * 7.5 + uTime * 1.4 + aSeed.y) * 0.24 * (0.3 + life) * aOrigin.w;
        float curlZ = cos(life * 6.2 + uTime * 1.15 + aSeed.y * 1.3) * 0.24 * (0.3 + life) * aOrigin.w;

        vec3 center = vec3(
          aOrigin.x + uWindDir.x * driftAmt + curlX,
          y,
          aOrigin.z + uWindDir.y * driftAmt + curlZ
        );

        float puffSize = (0.28 + life * 0.92) * aOrigin.w;
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 worldPos = center + (camRight * position.x + camUp * position.y) * puffSize;

        vAlpha = smoothstep(0.0, 0.16, life) * (1.0 - smoothstep(0.45, 1.0, life));
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vAlpha;

      void main() {
        vec2 c = (vUv - 0.5) * 2.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        float wisp = exp(-r2 * 3.4) * (1.0 - smoothstep(0.45, 1.0, r2));
        vec3 smokeCol = vec3(0.95, 0.92, 0.87);
        float a = wisp * vAlpha * 0.30;
        if (a <= 0.002) discard;
        gl_FragColor = vec4(smokeCol, a);
      }
    `
  });

  return { material, uniforms };
}

/**
 * Creates a shared cache of animated ShaderMaterials (warm light pools, incense smoke, waving silk flags)
 * so landmarks and streamed zones reuse identical WebGL shader programs and materials.
 */
export function createVietnamSharedShaders(): VietnamSharedShaders {
  const warmLightPool = createWarmLightPoolMaterial();
  const incenseSmoke = createIncenseSmokeMaterial();
  warmLightPool.material.userData.sharedProtected = true;
  incenseSmoke.material.userData.sharedProtected = true;
  const flagCache = new Map<
    string,
    {
      material: THREE.ShaderMaterial;
      uniforms: { uTime: { value: number }; uWindSpeed: { value: number } };
    }
  >();
  const allMaterials: THREE.Material[] = [warmLightPool.material, incenseSmoke.material];
  const allUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [
    warmLightPool.uniforms,
    incenseSmoke.uniforms
  ];
  let warmPoolAccessed = false;
  let smokeAccessed = false;
  let reusedCount = 0;

  const getWavingFlag: VietnamSharedShaders['getWavingFlag'] = (options) => {
    const waveScale = options?.waveScale ?? 1.0;
    const col = new THREE.Color(options?.color ?? '#d91619');
    const showStar = options?.showStar ?? true;
    const bucketScale = Math.max(0.25, Math.round(waveScale * 2) / 2);
    const key = `${col.getHexString()}_${showStar ? 1 : 0}_${bucketScale.toFixed(2)}`;
    const existing = flagCache.get(key);
    if (existing) {
      reusedCount++;
      return existing;
    }
    const created = createWavingSilkFlagMaterial({
      waveScale: bucketScale,
      color: col,
      showStar
    });
    created.material.userData.sharedProtected = true;
    flagCache.set(key, created);
    allMaterials.push(created.material);
    allUniforms.push(created.uniforms);
    return created;
  };

  const dispose = (): void => {
    for (const mat of allMaterials) {
      mat.dispose();
    }
    flagCache.clear();
  };

  return {
    get warmLightPool() {
      if (warmPoolAccessed) reusedCount++;
      warmPoolAccessed = true;
      return warmLightPool;
    },
    get incenseSmoke() {
      if (smokeAccessed) reusedCount++;
      smokeAccessed = true;
      return incenseSmoke;
    },
    getWavingFlag,
    allMaterials,
    allUniforms,
    getReusedCount: () => reusedCount,
    dispose
  };
}

/**
 * Creates a single-draw-call GPU-animated curling incense smoke tendrils system
 * rising gently from bronze temple/pagoda censers.
 */
export function createIncenseSmokeSystem(
  sources: Array<{ x: number; y: number; z: number; scale?: number }>,
  shared?: {
    material: THREE.ShaderMaterial;
    uniforms: {
      uTime: { value: number };
      uWindDir: { value: THREE.Vector2 };
      uWindSpeed: { value: number };
    };
  }
): IncenseSmokeHandle {
  const puffsPerSource = 14;
  const count = Math.max(1, sources.length * puffsPerSource);
  const geometry = new THREE.PlaneGeometry(1, 1);

  const origins = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 2);

  let idx = 0;
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s];
    const sc = src.scale ?? 1.0;
    for (let p = 0; p < puffsPerSource; p++) {
      origins[idx * 4] = src.x;
      origins[idx * 4 + 1] = src.y;
      origins[idx * 4 + 2] = src.z;
      origins[idx * 4 + 3] = sc;
      seeds[idx * 2] = p / puffsPerSource;
      seeds[idx * 2 + 1] = ((s * 0.37 + p * 0.19) % 1.0) * 6.28318;
      idx++;
    }
  }

  geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 4));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 2));

  const ownsMaterial = !shared;
  const { material, uniforms } = shared ?? createIncenseSmokeMaterial();

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'VietnameseIncenseSmoke';
  mesh.frustumCulled = false;
  const id = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, id);
  }
  mesh.instanceMatrix.needsUpdate = true;

  const dispose = (): void => {
    geometry.dispose();
    if (ownsMaterial) {
      material.dispose();
    }
  };

  return { mesh, uniforms, dispose };
}

/**
 * Builds geometry parts for a smooth carved cream-limestone lotus-bud finial (*Đài sen*)
 * crowning Vietnamese stone balustrade newels and stair cheeks.
 */
export function createLotusFinialParts(
  x: number,
  y: number,
  z: number,
  scale = 1.0
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const s = scale;

  const plinth = new THREE.CylinderGeometry(0.24 * s, 0.29 * s, 0.12 * s, 8);
  plinth.translate(x, y + 0.06 * s, z);
  parts.push(plinth);

  const waist = new THREE.CylinderGeometry(0.15 * s, 0.21 * s, 0.09 * s, 12);
  waist.translate(x, y + 0.165 * s, z);
  parts.push(waist);

  const calyx = new THREE.CylinderGeometry(0.25 * s, 0.15 * s, 0.14 * s, 12);
  calyx.translate(x, y + 0.27 * s, z);
  parts.push(calyx);

  // Ring of 8 sculpted upturned limestone lotus petals around the calyx
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.072 * s, 7, 5);
    petal.scale(0.85, 1.45, 0.55);
    petal.rotateX(0.38);
    petal.rotateY(ang);
    petal.translate(
      x + Math.sin(ang) * 0.21 * s,
      y + 0.30 * s,
      z + Math.cos(ang) * 0.21 * s
    );
    parts.push(petal);
  }

  // Smooth rounded lotus-bud (*Nụ sen*) crown with non-zero tip radius for clean normals
  const budProfile = [
    new THREE.Vector2(0.13 * s, 0.0),
    new THREE.Vector2(0.185 * s, 0.10 * s),
    new THREE.Vector2(0.195 * s, 0.20 * s),
    new THREE.Vector2(0.155 * s, 0.31 * s),
    new THREE.Vector2(0.085 * s, 0.40 * s),
    new THREE.Vector2(0.022 * s, 0.46 * s),
    new THREE.Vector2(0.008 * s, 0.48 * s)
  ];
  const bud = new THREE.LatheGeometry(budProfile, 14);
  bud.translate(x, y + 0.32 * s, z);
  parts.push(bud);

  return parts;
}

/**
 * Builds a traditional Vietnamese bronze incense tripod (*Đỉnh đồng ba chân*)
 * resting on a two-tier octagonal carved limestone pedestal.
 */
export function createBronzeIncenseTripodParts(
  x: number,
  y: number,
  z: number,
  scale = 1.0
): {
  limestoneParts: THREE.BufferGeometry[];
  bronzeParts: THREE.BufferGeometry[];
  goldParts: THREE.BufferGeometry[];
  smokeY: number;
} {
  const s = scale;
  const limestoneParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];

  // Two-tier octagonal carved limestone pedestal
  const pedLower = new THREE.CylinderGeometry(0.66 * s, 0.76 * s, 0.24 * s, 8);
  pedLower.translate(x, y + 0.12 * s, z);
  limestoneParts.push(pedLower);

  const pedUpper = new THREE.CylinderGeometry(0.54 * s, 0.62 * s, 0.20 * s, 8);
  pedUpper.translate(x, y + 0.34 * s, z);
  limestoneParts.push(pedUpper);

  const pedTopY = y + 0.44 * s;

  // Three curved bronze tripod legs (*Chân vạc*)
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI * 0.5;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + ca * 0.36 * s, pedTopY + 0.02 * s, z + sa * 0.36 * s),
      new THREE.Vector3(x + ca * 0.42 * s, pedTopY + 0.20 * s, z + sa * 0.42 * s),
      new THREE.Vector3(x + ca * 0.28 * s, pedTopY + 0.44 * s, z + sa * 0.28 * s)
    ]);
    const leg = new THREE.TubeGeometry(legCurve, 10, 0.068 * s, 8, false);
    bronzeParts.push(leg);

    const footPad = new THREE.CylinderGeometry(0.08 * s, 0.10 * s, 0.06 * s, 8);
    footPad.translate(x + ca * 0.36 * s, pedTopY + 0.03 * s, z + sa * 0.36 * s);
    bronzeParts.push(footPad);
  }

  // Sculpted cauldron belly, neck, and flared lip rim via LatheGeometry
  const cauldronProfile = [
    new THREE.Vector2(0.01 * s, 0.30 * s),
    new THREE.Vector2(0.28 * s, 0.33 * s),
    new THREE.Vector2(0.45 * s, 0.48 * s),
    new THREE.Vector2(0.47 * s, 0.64 * s),
    new THREE.Vector2(0.36 * s, 0.78 * s),
    new THREE.Vector2(0.46 * s, 0.87 * s),
    new THREE.Vector2(0.43 * s, 0.91 * s),
    new THREE.Vector2(0.34 * s, 0.89 * s)
  ];
  const cauldron = new THREE.LatheGeometry(cauldronProfile, 18);
  cauldron.translate(x, pedTopY, z);
  bronzeParts.push(cauldron);

  // Twin curved cloud-scroll handles (*Tai mây*)
  for (const sEar of [-1, 1]) {
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + sEar * 0.42 * s, pedTopY + 0.62 * s, z),
      new THREE.Vector3(x + sEar * 0.58 * s, pedTopY + 0.78 * s, z),
      new THREE.Vector3(x + sEar * 0.54 * s, pedTopY + 1.02 * s, z),
      new THREE.Vector3(x + sEar * 0.41 * s, pedTopY + 0.90 * s, z)
    ]);
    const handle = new THREE.TubeGeometry(handleCurve, 12, 0.045 * s, 7, false);
    bronzeParts.push(handle);
  }

  // Domed pierced cover
  const lidProfile = [
    new THREE.Vector2(0.35 * s, 0.89 * s),
    new THREE.Vector2(0.31 * s, 1.01 * s),
    new THREE.Vector2(0.20 * s, 1.11 * s),
    new THREE.Vector2(0.07 * s, 1.16 * s),
    new THREE.Vector2(0.02 * s, 1.17 * s)
  ];
  const lid = new THREE.LatheGeometry(lidProfile, 16);
  lid.translate(x, pedTopY, z);
  bronzeParts.push(lid);

  // Gilded lotus finial crown (*Núm đỉnh*)
  const crownBase = new THREE.CylinderGeometry(0.07 * s, 0.10 * s, 0.07 * s, 10);
  crownBase.translate(x, pedTopY + 1.19 * s, z);
  goldParts.push(crownBase);

  const crownBud = new THREE.ConeGeometry(0.075 * s, 0.18 * s, 10);
  crownBud.translate(x, pedTopY + 1.31 * s, z);
  goldParts.push(crownBud);

  return {
    limestoneParts,
    bronzeParts,
    goldParts,
    smokeY: pedTopY + 1.42 * s
  };
}

/**
 * Builds a multi-petal blooming pink lotus flower with golden stamen core and green stem
 * for close-up foreground lotus basins.
 */
export function createForegroundLotusFlowerParts(
  x: number,
  waterY: number,
  z: number,
  stemH: number,
  scale = 1.0,
  openness = 1.0,
  phase = 0.0
): {
  stemParts: THREE.BufferGeometry[];
  petalParts: THREE.BufferGeometry[];
  coreParts: THREE.BufferGeometry[];
} {
  const stemParts: THREE.BufferGeometry[] = [];
  const petalParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];

  const topY = waterY + stemH;
  const stem = new THREE.CylinderGeometry(0.013 * scale, 0.017 * scale, stemH + 0.12, 6);
  stem.translate(x, waterY + (stemH - 0.12) * 0.5, z);
  stemParts.push(stem);

  // Outer whorl: 6 spreading cupped pink petals
  const outerTilt = 0.45 + 0.48 * openness;
  for (let i = 0; i < 6; i++) {
    const ang = phase + (i / 6) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.076 * scale, 6, 5);
    petal.scale(0.68, 1.48, 0.34);
    petal.translate(0, 0.068 * scale, 0);
    petal.rotateX(outerTilt);
    petal.rotateY(ang);
    petal.translate(x, topY, z);
    petalParts.push(petal);
  }

  // Inner whorl: 5 upright cupped petals
  const innerTilt = 0.18 + 0.28 * openness;
  for (let i = 0; i < 5; i++) {
    const ang = phase + 0.32 + (i / 5) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.060 * scale, 6, 5);
    petal.scale(0.64, 1.42, 0.34);
    petal.translate(0, 0.056 * scale, 0);
    petal.rotateX(innerTilt);
    petal.rotateY(ang);
    petal.translate(x, topY + 0.015 * scale, z);
    petalParts.push(petal);
  }

  // Golden lotus seedpod center
  const core = new THREE.CylinderGeometry(0.044 * scale, 0.024 * scale, 0.042 * scale, 8);
  core.translate(x, topY + 0.045 * scale, z);
  coreParts.push(core);

  return { stemParts, petalParts, coreParts };
}
