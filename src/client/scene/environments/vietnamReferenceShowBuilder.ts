import * as THREE from 'three';
import {
  createDongSonBronzeTextures,
  createRedEmblemSailTexture,
  VIETNAM_WATER_LEVEL
} from '../shaders/vietnamHeritageShader';
import {
  VietnamBuilderContext,
  ExclusionCircle,
  JunkBoatMotion,
  clamp01,
  mulberry32,
  noise2D,
  mergeNormalized,
  applyWorldBoxUV,
  createSculptedRockGeometry,
  createArchedWallGeometry,
  createGableRoofGeometry,
  createHueImperialHipRoofGeometry,
  createNotchedLotusPadGeometry,
  createVietnameseCurvedRoofGeometry,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createWarmLightPoolMaterial,
  createWavingSilkFlagMaterial,
  createBronzeIncenseTripodParts,
  createForegroundLotusFlowerParts
} from './vietnamGeometryHelpers';
import {
  createSignagePlaqueMesh,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createCarvedDragonBalustradeParts,
  createGuardianBeastParts,
  createHoiAnDoorEyesParts,
  createImperialUrnParts,
  createDongSonDrum3DParts,
  createAngularTankParts,
  createMonumentalLotusParts,
  createSmoothTaperedTubeGeometry,
  createSmoothDragonParts,
  createRealisticAncientBanyanParts,
  createMotifBandParts,
  createShouCharacterParts,
  createLotusPetalRingParts,
  createCuaVongParts,
  createBasReliefPanelParts,
  createAncientStoneLanternParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  buildDienThaiHoaHeroHall,
  buildHoangCungHueMasterCompound,
  addRoyalGardenTree
} from './hueImperialPalaceBuilder';
import {
  registerAnimatedUniform,
  transformGeometryXYZ
} from '../vietnam/geometry/PartsBuilder';
import { VIETNAM_LANDMARK_REGISTRY } from '../vietnam/core/LandmarkRegistry';
import type {
  ResourceScopeLike,
  ZoneBuildContext,
  ZoneBuildOutput,
  ZoneDescriptor
} from '../vietnam/core/types';

function registerAnimUniform(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>,
  uni: { uTime: { value: number }; uWindSpeed?: { value: number } }
): void {
  registerAnimatedUniform(ctx.animatedUniforms, animList, uni, true);
}

const radialAlphaCache = new WeakMap<VietnamBuilderContext, Map<number, THREE.DataTexture>>();

function createSoftRadialAlphaTexture(ctx: VietnamBuilderContext, size = 64): THREE.DataTexture {
  let bySize = radialAlphaCache.get(ctx);
  if (!bySize) {
    bySize = new Map();
    radialAlphaCache.set(ctx, bySize);
  }
  const cached = bySize.get(size);
  if (cached) return cached;
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      const falloff = r2 >= 1.0 ? 0.0 : Math.pow(1.0 - r2, 2.2);
      const val = clampByte(falloff * 255);
      const idx = (py * size + px) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  ctx.extraTextures.push(tex);
  bySize.set(size, tex);
  return tex;
}

export interface VietnamReferenceShowAtmosphereState {
  timeOfDay: number;
  weather: string;
  nightAmount: number;
  duskAmount: number;
}

export interface VietnamReferenceShowController {
  update: (elapsedTime: number, cameraPos?: THREE.Vector3) => void;
  setAtmosphere: (state: VietnamReferenceShowAtmosphereState) => void;
  macroZones?: ZoneDescriptor[];
}

const MAX_ANISO = (renderer?: THREE.WebGLRenderer): number => {
  const caps = renderer && (renderer as unknown as { capabilities?: { getMaxAnisotropy?: () => number } }).capabilities;
  return caps && typeof caps.getMaxAnisotropy === 'function' ? Math.min(8, caps.getMaxAnisotropy()) : 1;
};

const clampByte = (v: number): number => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);

function addBoxPart(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  rz = 0
): void {
  parts.push(transformGeometryXYZ(new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx, rz));
}

function addCylPart(
  parts: THREE.BufferGeometry[],
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  rz = 0
): void {
  parts.push(transformGeometryXYZ(new THREE.CylinderGeometry(rTop, rBot, h, segs), x, y, z, 0, rx, rz));
}

function addConePart(
  parts: THREE.BufferGeometry[],
  r: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  rz = 0
): void {
  parts.push(transformGeometryXYZ(new THREE.ConeGeometry(r, h, segs), x, y, z, ry, rx, rz));
}

// --- Wave 3 Zero-Bug Grounded Architectural Helpers (Items 401–800) ---
function addWave3Mesh(
  group: THREE.Group,
  parts: THREE.BufferGeometry[],
  material: THREE.Material
): void {
  if (parts.length === 0) return;
  const mesh = new THREE.Mesh(mergeNormalized(parts), material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
}

/** Grounded cylindrical column embedded -0.20m into ground/plinth and rising flush to topY. */
function addW3GroundedCol(
  parts: THREE.BufferGeometry[],
  rTop: number,
  rBot: number,
  topY: number,
  groundY: number,
  segs: number,
  x: number,
  z: number
): void {
  const botY = groundY - 0.2;
  const h = Math.max(0.25, topY - botY);
  addCylPart(parts, rTop, rBot, h, segs, x, botY + h * 0.5, z);
}

/** Grounded rectangular post embedded -0.20m into ground/plinth and rising flush to topY. */
function addW3GroundedPost(
  parts: THREE.BufferGeometry[],
  w: number,
  d: number,
  topY: number,
  groundY: number,
  x: number,
  z: number,
  ry = 0
): void {
  const botY = groundY - 0.2;
  const h = Math.max(0.25, topY - botY);
  addBoxPart(parts, w, h, d, x, botY + h * 0.5, z, ry);
}

/** Deep stone retaining plinth extending -1.20m below groundY so slopes never expose air. */
function addW3Plinth(
  parts: THREE.BufferGeometry[],
  w: number,
  d: number,
  topY: number,
  groundY: number,
  x: number,
  z: number,
  ry = 0
): void {
  const botY = groundY - 3.2;
  const h = Math.max(0.6, topY - botY);
  addBoxPart(parts, w, h, d, x, botY + h * 0.5, z, ry);
}

/** Low-poly flat-ridge curved Vietnamese hip roof with optional flush-seated finial (ridgeTopY - 0.05). */
function addW3HipRoof(
  roofParts: THREE.BufferGeometry[],
  finialParts: THREE.BufferGeometry[] | null,
  w: number,
  d: number,
  eaveY: number,
  ridgeH: number,
  x: number,
  z: number,
  ry = 0
): void {
  const topW = Math.max(0.35, w * 0.45);
  const topD = Math.max(0.22, d * 0.14);
  const roof = createHueImperialHipRoofGeometry(w, d, topW, topD, ridgeH, 0.22, 4, 2, true);
  if (ry !== 0) roof.rotateY(ry);
  roof.translate(x, eaveY, z);
  roofParts.push(roof);
  if (finialParts) {
    const ridgeTopY = eaveY + ridgeH;
    addBoxPart(finialParts, topW + 0.18, 0.14, 0.14, x, ridgeTopY - 0.02, z, ry);
    addConePart(finialParts, 0.16, 0.34, 4, x, ridgeTopY + 0.12, z, ry);
  }
}

function addThaiHoaInteriorDetails(
  crimsonParts: THREE.BufferGeometry[],
  goldParts: THREE.BufferGeometry[],
  throneX: number,
  floorY: number,
  centerZ: number,
  canopyY: number,
  ceilY: number,
  runnerLen: number,
  runnerCenterX: number
): void {
  // 1. Ceremonial imperial crimson-and-gold woven carpet runner along central nave axis
  addBoxPart(crimsonParts, runnerLen, 0.04, 3.6, runnerCenterX, floorY + 0.03, centerZ);
  for (const s of [-1, 1]) {
    addBoxPart(goldParts, runnerLen, 0.045, 0.22, runnerCenterX, floorY + 0.032, centerZ + s * 1.72);
  }

  // 2. Authentic Square Gilded Openwork Bửu Tán Canopy Box with Scalloped Fringe & 4 Corner Tassels
  // Inner crimson lacquer coffered ceiling panel + gilded central Thọ medallion
  addBoxPart(crimsonParts, 3.1, 0.14, 3.1, throneX, canopyY + 0.42, centerZ);
  addCylPart(goldParts, 0.52, 0.52, 0.12, 14, throneX, canopyY + 0.28, centerZ);
  // 4 Openwork gilded perimeter fascia walls with stepped cornice & scalloped valance teeth
  for (const s of [-1, 1]) {
    // North/South gilded box walls + cornice crown
    addBoxPart(goldParts, 3.45, 0.48, 0.14, throneX, canopyY + 0.48, centerZ + s * 1.65);
    addBoxPart(goldParts, 3.68, 0.14, 0.22, throneX, canopyY + 0.78, centerZ + s * 1.72);
    // East/West gilded box walls + cornice crown
    addBoxPart(goldParts, 0.14, 0.48, 3.45, throneX + s * 1.65, canopyY + 0.48, centerZ);
    addBoxPart(goldParts, 0.22, 0.14, 3.68, throneX + s * 1.72, canopyY + 0.78, centerZ);
    // Scalloped golden fringe lappets along all 4 sides (6 scallops per side)
    for (let k = -2; k <= 2; k++) {
      const off = k * 0.58;
      const sc1 = new THREE.ConeGeometry(0.18, 0.34, 4);
      sc1.rotateX(Math.PI);
      sc1.translate(throneX + off, canopyY + 0.08, centerZ + s * 1.65);
      goldParts.push(sc1);
      const sc2 = new THREE.ConeGeometry(0.18, 0.34, 4);
      sc2.rotateX(Math.PI);
      sc2.translate(throneX + s * 1.65, canopyY + 0.08, centerZ + off);
      goldParts.push(sc2);
    }
  }
  // 4 Corner ascending dragon-head finials & hanging crimson-and-gold corner tassels (*tua rủ*)
  for (const sx of [-1.68, 1.68]) {
    for (const sz of [-1.68, 1.68]) {
      addBoxPart(goldParts, 0.30, 0.36, 0.30, throneX + sx, canopyY + 0.84, centerZ + sz);
      addCylPart(goldParts, 0.11, 0.05, 0.92, 7, throneX + sx * 0.95, canopyY - 0.32, centerZ + sz * 0.95);
      addCylPart(crimsonParts, 0.08, 0.15, 0.78, 7, throneX + sx * 0.95, canopyY - 0.82, centerZ + sz * 0.95);
    }
  }

  // 3. Coffered crimson-and-gold ceiling beams (*Trần gỗ chia ô hộc & Thơ Văn trên kiến trúc*)
  const baySpan = runnerLen * 0.85;
  const xStart = runnerCenterX - baySpan * 0.5;
  for (let b = 0; b <= 5; b++) {
    const bx = xStart + (b / 5) * baySpan;
    addBoxPart(crimsonParts, 0.28, 0.34, 24.0, bx, ceilY, centerZ);
    if (b < 5) {
      addBoxPart(goldParts, (baySpan / 5) * 0.65, 0.16, 1.2, bx + baySpan / 10, ceilY - 0.14, centerZ);
    }
  }
  for (const lz of [-8.0, -3.2, 3.2, 8.0]) {
    addBoxPart(crimsonParts, baySpan, 0.30, 0.26, runnerCenterX, ceilY + 0.12, centerZ + lz);
  }
}

function addHuePhamSonMandarinStones(
  stoneParts: THREE.BufferGeometry[],
  goldParts: THREE.BufferGeometry[],
  baseX: number,
  groundY: number,
  centerZ: number
): void {
  // 18 Carved stone Phẩm Sơn mandarin rank markers (9 Civil Văn north/left, 9 Military Võ south/right)
  for (const side of [-1, 1]) {
    for (let rank = 0; rank < 9; rank++) {
      const rx = baseX + (rank % 5) * 4.4 + (rank >= 5 ? 2.2 : 0);
      const rz = centerZ + side * (6.2 + Math.floor(rank / 5) * 3.8);
      addBoxPart(stoneParts, 0.85, 0.32, 0.85, rx, groundY + 0.16, rz);
      addBoxPart(stoneParts, 0.42, 0.92, 0.24, rx, groundY + 0.78, rz);
      addBoxPart(goldParts, 0.28, 0.26, 0.26, rx, groundY + 0.96, rz);
    }
  }
}

function addChuaCauInteriorAndGuardians(
  crimsonParts: THREE.BufferGeometry[],
  goldParts: THREE.BufferGeometry[],
  woodParts: THREE.BufferGeometry[],
  stoneParts: THREE.BufferGeometry[],
  lanternParts: THREE.BufferGeometry[],
  cx: number,
  deckY: number,
  cz: number,
  spanX: number,
  axis: 'x' | 'z',
  group?: THREE.Group,
  ctx?: VietnamBuilderContext
): void {
  // 1. Gilded "Lai Viễn Kiều" (來遠橋) entrance plaques & sculpted Sacred Dog / Monkey guardian statues
  const half = spanX * 0.5;
  for (const endSign of [-1, 1]) {
    const beastType: 'dog' | 'monkey' = endSign < 0 ? 'dog' : 'monkey';
    if (axis === 'x') {
      if (group && ctx) {
        const plaque = createSignagePlaqueMesh(
          {
            text: 'LAI VIỄN KIỀU',
            subText: '來 遠 橋',
            width: 2.15,
            height: 0.62,
            depth: 0.14,
            style: 'royal'
          },
          ctx
        );
        plaque.rotation.y = endSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        plaque.position.set(cx + endSign * (half - 0.18), deckY + 2.68, cz);
        group.add(plaque);
      } else {
        addBoxPart(goldParts, 0.16, 0.56, 1.95, cx + endSign * (half - 0.2), deckY + 2.65, cz);
      }
      // Guardian pedestals & sculpted Sacred Dog (-X) / Sacred Monkey (+X)
      for (const sz of [-1.95, 1.95]) {
        const gx = cx + endSign * (half + 1.0);
        const gz = cz + sz;
        addBoxPart(stoneParts, 0.88, 0.68, 0.88, gx, deckY - 0.12, gz);
        const faceRotY = endSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        stoneParts.push(...createGuardianBeastParts(gx, deckY + 0.22, gz, faceRotY, 0.92, beastType));
      }
    } else {
      if (group && ctx) {
        const plaque = createSignagePlaqueMesh(
          {
            text: 'LAI VIỄN KIỀU',
            subText: '來 遠 橋',
            width: 2.15,
            height: 0.62,
            depth: 0.14,
            style: 'royal'
          },
          ctx
        );
        plaque.rotation.y = endSign > 0 ? 0 : Math.PI;
        plaque.position.set(cx, deckY + 2.68, cz + endSign * (half - 0.18));
        group.add(plaque);
      } else {
        addBoxPart(goldParts, 1.95, 0.56, 0.16, cx, deckY + 2.65, cz + endSign * (half - 0.2));
      }
      for (const sx of [-1.95, 1.95]) {
        const gx = cx + sx;
        const gz = cz + endSign * (half + 1.0);
        addBoxPart(stoneParts, 0.88, 0.68, 0.88, gx, deckY - 0.12, gz);
        const faceRotY = endSign > 0 ? 0 : Math.PI;
        stoneParts.push(...createGuardianBeastParts(gx, deckY + 0.22, gz, faceRotY, 0.92, beastType));
      }
    }
  }

  // 2. Interior interlocking timber roof truss rafters along bridge corridor
  for (let r = -3; r <= 3; r++) {
    if (axis === 'x') {
      addBoxPart(woodParts, 0.22, 0.24, 4.3, cx + r * (spanX / 7), deckY + 3.05, cz);
    } else {
      addBoxPart(woodParts, 4.3, 0.24, 0.22, cx, deckY + 3.05, cz + r * (spanX / 7));
    }
  }

  // 3. Interior Bắc Đế Trấn Võ crimson-and-gold shrine alcove & altar lanterns at bridge center
  const shrineZ = axis === 'x' ? cz - 1.55 : cz;
  const shrineX = axis === 'x' ? cx : cx - 1.55;
  addBoxPart(crimsonParts, 1.65, 1.15, 0.85, shrineX, deckY + 0.75, shrineZ);
  addBoxPart(crimsonParts, 1.95, 2.25, 0.24, shrineX, deckY + 1.45, shrineZ - (axis === 'x' ? 0.48 : 0));
  addCylPart(goldParts, 0.18, 0.26, 0.68, 10, shrineX, deckY + 1.68, shrineZ); // Bắc Đế Trấn Võ statue
  addCylPart(goldParts, 0.14, 0.14, 0.28, 10, shrineX, deckY + 2.15, shrineZ);
  for (const s of [-0.58, 0.58]) {
    const lGeo = createLanternCoreGeometry(0.14, 0.34);
    lGeo.translate(shrineX + (axis === 'x' ? s : 0), deckY + 1.55, shrineZ + (axis === 'x' ? 0 : s));
    lanternParts.push(lGeo);
  }
}

function setInstanceMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  sx: number,
  sy: number,
  sz: number
): void {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  mesh.setMatrixAt(index, m);
}

/**
 * Assigns a uniform RGB vertex color attribute onto a non-indexed BufferGeometry so multi-colored
 * subparts can be merged cleanly into a single draw call with `vertexColors: true`.
 */
function paintGeometryVertexColor(
  geo: THREE.BufferGeometry,
  hex: string
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const count = g.attributes.position.count;
  const c = new THREE.Color(hex);
  const cols = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

/**
 * Builds a 2-tier blooming Hội An paper lotus lantern (*hoa đăng*) with cupped outer/inner petals
 * and a bright warm candle core encoded in vertex colors (single draw call for InstancedMesh!).
 */
function createBloomingHoaDangGeometry(scale = 1.0): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Floating paper saucer base
  const base = new THREE.CylinderGeometry(0.16 * scale, 0.13 * scale, 0.03 * scale, 6);
  base.translate(0, 0.015 * scale, 0);
  parts.push(paintGeometryVertexColor(base, '#e05842'));

  // Outer tier: 5 wide spreading cupped lotus petals
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const p = new THREE.SphereGeometry(0.088 * scale, 4, 3);
    p.scale(0.88, 1.45, 0.28);
    p.translate(0, 0.075 * scale, 0);
    p.rotateX(0.92);
    p.rotateY(ang);
    p.translate(Math.sin(ang) * 0.06 * scale, 0.02 * scale, Math.cos(ang) * 0.06 * scale);
    parts.push(paintGeometryVertexColor(p, i % 2 === 0 ? '#ff6c8a' : '#ff8c64'));
  }
  // Inner tier: 4 upright cupped petals glowing warmer toward center
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const p = new THREE.SphereGeometry(0.070 * scale, 4, 3);
    p.scale(0.82, 1.38, 0.28);
    p.translate(0, 0.062 * scale, 0);
    p.rotateX(0.46);
    p.rotateY(ang);
    p.translate(Math.sin(ang) * 0.035 * scale, 0.03 * scale, Math.cos(ang) * 0.035 * scale);
    parts.push(paintGeometryVertexColor(p, '#ffc288'));
  }
  // Bright warm glowing wax candle & flame core at center
  const flame = new THREE.ConeGeometry(0.034 * scale, 0.13 * scale, 5);
  flame.translate(0, 0.085 * scale, 0);
  parts.push(paintGeometryVertexColor(flame, '#fff6d6'));
  return mergeNormalized(parts);
}

/**
 * Builds an authentic tapered Vietnamese wooden sampan hull (*đò nan / thuyền gỗ*)
 * with curved planked floor, swept gunwales, pointed upturned bow & stern, and seating thwarts.
 */
function createTaperedSampanHullParts(
  len: number,
  beam: number,
  depth = 0.46
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const segs = 10;
  const halfLen = len * 0.5;
  const halfBeam = beam * 0.5;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const tm = (t0 + t1) * 0.5;
    const u = tm * 2 - 1; // -1..1 from stern to bow
    const x0 = -halfLen + t0 * len;
    const x1 = -halfLen + t1 * len;
    const xm = (x0 + x1) * 0.5;
    const segLen = x1 - x0 + 0.06;
    // Taper beam smoothly toward pointed bow and stern
    const taper = Math.pow(Math.max(0.14, 1.0 - u * u), 0.62);
    const wSeg = beam * taper;
    const sheerY = u * u * depth * 0.72;
    const pitchZ = u * 0.28;
    // Hull bottom plank
    addBoxPart(parts, segLen, 0.08, Math.max(0.22, wSeg * 0.76), xm, 0.05 + sheerY * 0.75, 0, 0, 0, pitchZ);
    // Port & starboard flared hull side planks
    for (const side of [-1, 1]) {
      const gunwaleZ = side * (wSeg * 0.44);
      addBoxPart(
        parts,
        segLen,
        depth * (0.78 + 0.22 * taper),
        0.07,
        xm,
        0.05 + depth * 0.42 + sheerY,
        gunwaleZ,
        0,
        side * 0.26,
        pitchZ
      );
    }
  }
  // Swept pointed bow & stern stem posts
  for (const endSign of [-1, 1]) {
    addBoxPart(
      parts,
      0.24,
      depth * 1.15,
      0.16,
      endSign * (halfLen + 0.04),
      depth * 0.92,
      0,
      0,
      0,
      -endSign * 0.45
    );
  }
  // 2 interior wooden seating thwarts
  addBoxPart(parts, 0.34, 0.07, halfBeam * 1.56, -len * 0.24, depth * 0.68, 0);
  addBoxPart(parts, 0.34, 0.07, halfBeam * 1.56, len * 0.22, depth * 0.68, 0);
  return parts;
}

// ---------------------------------------------------------------------------
// Procedural Texture Generators (registered into ctx.extraTextures)
// ---------------------------------------------------------------------------

function createBrocadeTexture(renderer?: THREE.WebGLRenderer): THREE.DataTexture {
  // FIX HV05-2: High-res 512×512 authentic Central Highlands woven brocade with nested diamonds, 8-pointed stars & twin serrated borders (ref 09, 42!)
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const cu = ((u * 4.0) % 1.0) - 0.5;
      const cv = ((v * 8.0) % 1.0) - 0.5;
      const manhattan = Math.abs(cu) + Math.abs(cv);
      const outerDiamond = manhattan < 0.42 && manhattan > 0.30;
      const innerDiamond = manhattan < 0.24 && manhattan > 0.14;
      // Crisp 8-pointed Central Highlands star motif centered inside each diamond
      const starAxis = (Math.abs(cu) < 0.032 && Math.abs(cv) < 0.13) || (Math.abs(cv) < 0.032 && Math.abs(cu) < 0.13);
      const starDiag =
        (Math.abs(cu - cv) < 0.036 || Math.abs(cu + cv) < 0.036) && Math.hypot(cu, cv) < 0.12;
      const star8 = starAxis || starDiag;
      const borderStripe = u < 0.08 || u > 0.92;
      const zigzag = Math.abs(((v * 24.0 + Math.abs(((u * 8.0) % 1.0) - 0.5) * 1.4) % 1.0) - 0.5) < 0.13;
      const band = Math.floor(v * 8.0) % 4;
      const weave = 0.91 + 0.09 * Math.sin(u * 320.0) * Math.cos(v * 320.0);

      let r = 27;
      let g = 26;
      let b = 31; // #1b1a1f indigo-black handwoven base
      if (borderStripe) {
        r = 194;
        g = 34;
        b = 32; // #c22220 crimson outer edge band
      } else if (band === 1) {
        r = 186;
        g = 34;
        b = 30; // #ba221e highland crimson band
      } else if (band === 3) {
        r = 218;
        g = 98;
        b = 28; // #da621c earthy terracotta-orange band
      }
      if (star8) {
        r = 248;
        g = 238;
        b = 204; // #f8eecc bright ivory-gold 8-pointed star
      } else if (innerDiamond) {
        r = 228;
        g = 172;
        b = 48; // #e4ac30 ochre-gold inner diamond
      } else if (outerDiamond) {
        r = 234;
        g = 226;
        b = 210; // #eae2d2 woven ivory outer diamond
      } else if (zigzag) {
        r = 224;
        g = 168;
        b = 46; // #e0a82e serrated zigzag weave
      }
      const idx = (py * size + px) * 4;
      data[idx] = clampByte(r * weave);
      data[idx + 1] = clampByte(g * weave);
      data[idx + 2] = clampByte(b * weave);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = MAX_ANISO(renderer);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createFilmstripArchivalTexture(
  renderer?: THREE.WebGLRenderer,
  variant = 0
): THREE.DataTexture {
  const w = 256;
  const h = 1024;
  const data = new Uint8Array(w * h * 4);
  // FIX HV07-2: Crisp high-contrast silver-gelatin BLACK & WHITE documentary photographs framed inside glowing fiery red-orange 35mm sprocket rails (ref 11!)
  const tones: Array<[number, number, number]> = [
    [242, 244, 248],
    [234, 236, 240],
    [246, 246, 246],
    [230, 234, 238]
  ];
  const [tr, tg, tb] = tones[Math.abs(variant) % tones.length];

  for (let py = 0; py < h; py++) {
    const v = py / h;
    const frameFloat = v * 5.0;
    const frameIdx = Math.floor(frameFloat);
    const fv = frameFloat - frameIdx;
    const isFrameBar = fv < 0.055 || fv > 0.945;
    const isInnerBorder = (fv >= 0.055 && fv < 0.072) || (fv <= 0.945 && fv > 0.928);
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const inMargin = u < 0.15 || u > 0.85;
      const inOuterGlowRim = u < 0.028 || u > 0.972 || (u > 0.132 && u < 0.15) || (u > 0.85 && u < 0.868);
      const sprockU = (u > 0.042 && u < 0.118) || (u > 0.882 && u < 0.958);
      const sprockV = ((fv * 4.0) % 1.0) > 0.24 && ((fv * 4.0) % 1.0) < 0.74;
      const sprocket = sprockU && sprockV;
      const idx = (py * w + px) * 4;

      if (sprocket) {
        // Crisp black rectangular 35mm sprocket perforation holes
        data[idx] = 14;
        data[idx + 1] = 10;
        data[idx + 2] = 8;
        data[idx + 3] = 255;
      } else if (inOuterGlowRim || isInnerBorder) {
        // Glowing vibrant amber-orange 35mm filmstrip rail borders (ref 11_historical_filmstrip.jpg)
        data[idx] = 252;
        data[idx + 1] = 148;
        data[idx + 2] = 46;
        data[idx + 3] = 255;
      } else if (isFrameBar) {
        data[idx] = 28;
        data[idx + 1] = 19;
        data[idx + 2] = 13;
        data[idx + 3] = 255;
      } else if (inMargin) {
        // Warm luminous orange-amber sprocket track strip
        data[idx] = 216;
        data[idx + 1] = 104;
        data[idx + 2] = 32;
        data[idx + 3] = 255;
      } else {
        // Distinct high-contrast archival documentary scenes per variant
        const fu = (u - 0.15) / 0.70;
        const grain = 0.035 * Math.sin(px * 2.7 + py * 1.9 + variant * 5.3);
        let lum = 0.88 + grain;
        const vMode = Math.abs(variant) % 4;
        if (vMode === 0) {
          // Variant 0: Northern karst & marching soldiers with rifles & flag
          const horizon = 0.34 + 0.08 * Math.sin(fu * 7.0 + frameIdx * 1.9);
          const ridge = horizon + 0.20 * Math.exp(-Math.pow((fu - 0.5) * 2.8, 2.0));
          const soldier1 = Math.abs(fu - 0.34 - (frameIdx % 2) * 0.08) < 0.055 && fv < 0.68 && fv > 0.14;
          const head1 = Math.hypot((fu - 0.34 - (frameIdx % 2) * 0.08) * 1.6, fv - 0.71) < 0.045;
          const soldier2 = Math.abs(fu - 0.58) < 0.05 && fv < 0.62 && fv > 0.14;
          const head2 = Math.hypot((fu - 0.58) * 1.6, fv - 0.65) < 0.042;
          const flag = fu > 0.60 && fu < 0.84 && fv > 0.68 && fv < 0.84;
          const pole = Math.abs(fu - 0.60) < 0.015 && fv > 0.18 && fv < 0.86;
          lum = soldier1 || head1 || soldier2 || head2 || pole ? 0.14 : flag ? 0.34 : fv < horizon ? 0.30 : fv < ridge ? 0.50 : 0.90 + grain;
        } else if (vMode === 1) {
          // Variant 1: Imperial citadel arches, multi-tier pagoda roofs & banner
          const roof1 = fv > 0.56 && fv < 0.68 && Math.abs(fu - 0.5) < 0.38 - (fv - 0.56) * 1.75;
          const roof2 = fv >= 0.68 && fv < 0.80 && Math.abs(fu - 0.5) < 0.25 - (fv - 0.68) * 1.55;
          const finial = Math.abs(fu - 0.5) < 0.02 && fv >= 0.80 && fv < 0.88;
          const wall = fv > 0.18 && fv <= 0.56 && Math.abs(fu - 0.5) < 0.33;
          const archVoid =
            fv > 0.18 && fv < 0.45 && Math.hypot((fu - 0.5) * 2.1, (fv - 0.20) * 1.55) < 0.23;
          lum = archVoid ? 0.12 : roof1 || roof2 || finial ? 0.22 : wall ? 0.48 : fv <= 0.18 ? 0.34 : 0.90 + grain;
        } else if (vMode === 2) {
          // Variant 2: Historic river bridge, sampans & karst peaks reflection
          const waterLine = 0.42;
          const arch = Math.abs(fv - (waterLine + 0.19 * Math.sin(fu * Math.PI))) < 0.042;
          const truss = fv > waterLine && fv < waterLine + 0.19 * Math.sin(fu * Math.PI) && Math.abs(((fu * 8.0) % 1.0) - 0.5) < 0.08;
          const sampan = fv > 0.23 && fv < 0.31 && Math.abs(fu - 0.34 - (frameIdx % 2) * 0.30) < 0.19;
          const karst = fv >= waterLine && fv < waterLine + 0.32 * Math.exp(-Math.pow((fu - 0.78) * 4.5, 2.0));
          const ripple = fv < waterLine ? 0.06 * Math.sin(fv * 70.0 + fu * 14.0) : 0.0;
          lum = arch || truss ? 0.16 : sampan ? 0.15 : karst ? 0.40 : fv < waterLine ? 0.50 + ripple : 0.88 + grain;
        } else {
          // Variant 3: Celebration flags, radiant sunbeams & heritage crowd
          const sunDist = Math.hypot(fu - 0.5, fv - 0.68);
          const rays = Math.sin(Math.atan2(fv - 0.68, fu - 0.5) * 14.0 + frameIdx) > 0.22;
          const flag = fv > 0.46 && fv < 0.76 && fu > 0.24 && fu < 0.58;
          const pole = Math.abs(fu - 0.24) < 0.02 && fv > 0.15 && fv < 0.82;
          const crowd = fv < 0.32 + 0.065 * Math.sin(fu * 22.0 + frameIdx);
          lum = pole ? 0.14 : crowd ? 0.20 : flag ? 0.34 : sunDist < 0.13 ? 0.98 : rays ? 0.80 : 0.64 + grain;
        }
        data[idx] = clampByte(tr * lum);
        data[idx + 1] = clampByte(tg * lum);
        data[idx + 2] = clampByte(tb * lum);
        data[idx + 3] = 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO(renderer);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Spec 01: Tràng An Golden Rice & Domed Karst Sunset (120, -110)
// ---------------------------------------------------------------------------

function buildTrangAnGoldenRiceKarst(
  ctx: VietnamBuilderContext,
  windAnimList: Array<{ uTime: { value: number } }>
): THREE.MeshStandardMaterial {
  const cx = 135;
  const cz = -72;
  const baseY = ctx.getHeight(cx, cz);
  const group = new THREE.Group();
  group.name = 'TrangAnGoldenRiceKarst';
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34 });

  // 1. 9 Domed Tràng An limestone towers in 3 depth layers (52–85m tall)
  const karstRockParts: THREE.BufferGeometry[] = [];
  const karstCapParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(10101);
  const towerSpecs = [
    [-22, -10, 11, 52],
    [0, -14, 13, 64],
    [22, -10, 11, 54],
    [-26, -20, 13, 74],
    [12, -22, 14, 82],
    [28, -18, 12, 60],
    [-12, -28, 14, 85],
    [20, -28, 13, 72],
    [-24, -28, 12, 62]
  ];
  // FIX TA-03: Steep 85° Stratified Limestone Karst Towers (replacing spherical Icosahedron "potatoes") + 4 Overhanging Riverside Weeping Banyans (ref 11 & 12!)
  const makeStratifiedKarstTower = (rad: number, h: number, seed: number): THREE.BufferGeometry => {
    const tower = new THREE.CylinderGeometry(rad * 0.70, rad * 1.04, h * 0.78, 10, 6);
    const pos = tower.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      const ang = Math.atan2(vz, vx);
      const yn = (vy + h * 0.39) / (h * 0.78); // 0..1
      const cliffFlute = 0.88 + 0.16 * Math.sin(ang * 4.0 + seed * 1.7) + 0.08 * Math.cos(ang * 7.0 - seed);
      const strataLedge = 1.0 + 0.06 * Math.sin(yn * Math.PI * 7.0 + seed);
      const crownPinch = yn > 0.82 ? 1.0 - (yn - 0.82) * 1.25 : 1.0;
      pos.setXYZ(v, vx * cliffFlute * strataLedge * crownPinch, vy + h * 0.39, vz * cliffFlute * strataLedge * crownPinch);
    }
    tower.computeVertexNormals();
    return tower;
  };
  for (let i = 0; i < towerSpecs.length; i++) {
    const [dx, dz, rad, h] = towerSpecs[i];
    const gx = cx + dx;
    const gz = cz + dz;
    const ty = ctx.getHeight(gx, gz) - 2.0;

    const dome = makeStratifiedKarstTower(rad, h, i + 7);
    dome.translate(gx, ty, gz);
    karstRockParts.push(dome);

    const cap = createSculptedRockGeometry(200 + i, rad * 0.78, h * 0.22, rad * 0.78, 1);
    cap.translate(gx, ty + h * 0.72, gz);
    karstCapParts.push(cap);
  }
  // 4 Overhanging Riverside Weeping Banyan Trees with dangling aerial roots along Tràng An canal
  const bankWoodParts: THREE.BufferGeometry[] = [];
  for (const [bx, bz, lean] of [[-18, 12, 0.42], [20, 14, -0.38], [-24, -6, 0.35], [26, -4, -0.40]]) {
    const wx = cx + bx;
    const wz = cz + bz;
    const wy = ctx.getHeight(wx, wz);
    addCylPart(bankWoodParts, 0.22, 0.34, 4.8, 5, wx, wy + 2.2, wz, 0, lean);
    for (let rt = 0; rt < 3; rt++) {
      addCylPart(bankWoodParts, 0.025, 0.03, 3.4, 4, wx - Math.sign(lean) * (1.2 + rt * 0.6), wy + 2.4, wz + (rt - 1) * 0.5);
    }
    const canopy = createSculptedRockGeometry(930 + Math.abs(bx), 3.4, 1.5, 3.0, 1);
    canopy.translate(wx - Math.sign(lean) * 1.4, wy + 4.4, wz);
    karstCapParts.push(canopy);
  }
  group.add(new THREE.Mesh(mergeNormalized(bankWoodParts), ctx.materials.darkWood));

  const karstMat = new THREE.MeshStandardMaterial({
    color: '#6b6a62',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.88
  });
  ctx.extraMaterials.push(karstMat);
  const karstMesh = new THREE.Mesh(mergeNormalized(karstRockParts), karstMat);
  karstMesh.castShadow = true;
  karstMesh.receiveShadow = true;
  group.add(karstMesh);

  const karstMossMat = new THREE.MeshStandardMaterial({
    color: '#3e5a3a',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.35,
    roughness: 0.82
  });
  ctx.extraMaterials.push(karstMossMat);
  const mossMesh = new THREE.Mesh(mergeNormalized(karstCapParts), karstMossMat);
  mossMesh.receiveShadow = true;
  group.add(mossMesh);

  // 2. Backlit Ripening Golden Rice Clumps (2,400 instances) with sculpted drooping grain panicle (*bông lúa trĩu hạt*)
  const stalkParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.PlaneGeometry(0.11, 0.92, 1, 3);
    const bp = blade.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const yv = bp.getY(v) + 0.46;
      const t = clamp01(yv / 0.92);
      bp.setX(v, bp.getX(v) * (1.0 - t * 0.75));
      bp.setY(v, yv * (1.0 - t * t * 0.14));
      bp.setZ(v, t * t * 0.28);
    }
    blade.computeVertexNormals();
    blade.rotateY((b / 4) * Math.PI * 2 + 0.25);
    stalkParts.push(blade);
  }
  const trPanicle = new THREE.PlaneGeometry(0.085, 0.36, 1, 2);
  const trPPos = trPanicle.attributes.position;
  for (let v = 0; v < trPPos.count; v++) {
    const yv = trPPos.getY(v) + 0.18;
    const t = clamp01(yv / 0.36);
    const archY = 0.72 + Math.sin(t * Math.PI * 0.85) * 0.16 - t * t * 0.14;
    const archZ = 0.08 + t * 0.30;
    const wMod = 0.55 + 0.65 * Math.sin(t * Math.PI);
    trPPos.setXYZ(v, trPPos.getX(v) * wMod, archY, archZ);
  }
  trPanicle.computeVertexNormals();
  trPanicle.rotateY(0.55);
  stalkParts.push(trPanicle);
  const riceClumpGeo = mergeNormalized(stalkParts);
  const riceUni = { uTime: { value: 0.0 } };
  windAnimList.push(riceUni);

  const riceMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.65,
    side: THREE.DoubleSide
  });
  riceMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = riceUni.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 instPos = vec3(0.0);
       #ifdef USE_INSTANCING
       instPos = vec3(instanceMatrix[3].xyz);
       #endif
       float ht = clamp(position.y / 0.92, 0.0, 1.0);
       float wave = sin(uTime * 1.9 + instPos.x * 0.18 + instPos.z * 0.14);
       transformed.x += wave * ht * ht * 0.14;
       transformed.z += cos(uTime * 1.5 + instPos.z * 0.2) * ht * ht * 0.09;`
    );
  };
  ctx.extraMaterials.push(riceMat);

  const riceCount = 2400;
  const riceMesh = new THREE.InstancedMesh(riceClumpGeo, riceMat, riceCount);
  riceMesh.name = 'TrangAnGoldenRiceClumps';
  riceMesh.receiveShadow = true;
  const paddyPalette = [
    new THREE.Color('#6aa83a'),
    new THREE.Color('#a8c43e'),
    new THREE.Color('#d9a441'),
    new THREE.Color('#e8be4a')
  ];
  let ricePlaced = 0;
  for (let i = 0; i < riceCount * 2 && ricePlaced < riceCount; i++) {
    const rx = cx + (rand() - 0.5) * 56;
    const rz = cz + (rand() - 0.5) * 34 + 4;
    // Keep miniature Sào Khê canal & Thủy Đình water basin clear of rice stalks
    if (Math.abs(rx - (cx + 12)) < 21.5 && Math.abs(rz - (cz - 4)) < 7.8) continue;
    const ry = ctx.getHeight(rx, rz);
    const sc = 0.85 + rand() * 0.45;
    setInstanceMatrix(riceMesh, ricePlaced, rx, ry, rz, 0, rand() * Math.PI * 2, 0, sc, sc, sc);
    const parcel = clamp01(0.5 + 0.5 * noise2D(rx * 0.06, rz * 0.06, 404));
    const colIdx = Math.min(paddyPalette.length - 1, Math.floor(parcel * paddyPalette.length));
    riceMesh.setColorAt(ricePlaced, paddyPalette[colIdx]);
    ricePlaced++;
  }
  riceMesh.count = ricePlaced;
  riceMesh.instanceMatrix.needsUpdate = true;
  if (riceMesh.instanceColor) riceMesh.instanceColor.needsUpdate = true;
  riceMesh.computeBoundingBox();
  group.add(riceMesh);

  // 2.5 Thủy Đình Tràng An (2-tier curved-roof water pavilion) + Miniature Canal & Sampan
  const canalCx = cx + 12;
  const canalCz = cz - 4;
  const canalY = baseY + 0.08;
  const tdWaterMat = new THREE.MeshStandardMaterial({
    color: '#256c6a',
    roughness: 0.14,
    metalness: 0.22,
    transparent: true,
    opacity: 0.90
  });
  ctx.extraMaterials.push(tdWaterMat);
  const canalPlane = new THREE.Mesh(new THREE.PlaneGeometry(42, 14), tdWaterMat);
  canalPlane.rotation.x = -Math.PI * 0.5;
  canalPlane.position.set(canalCx, canalY, canalCz);
  group.add(canalPlane);

  const tdStoneParts: THREE.BufferGeometry[] = [];
  const tdCrimsonParts: THREE.BufferGeometry[] = [];
  const tdWoodParts: THREE.BufferGeometry[] = [];
  const tdRoofParts: THREE.BufferGeometry[] = [];
  const tdGoldParts: THREE.BufferGeometry[] = [];
  const tdX = cx + 16;
  const tdZ = cz - 4;

  // Stone canal embankments & Thủy Đình octagonal-square pier
  addBoxPart(tdStoneParts, 43.0, 0.35, 0.75, canalCx, canalY - 0.02, canalCz - 7.1);
  addBoxPart(tdStoneParts, 43.0, 0.35, 0.75, canalCx, canalY - 0.02, canalCz + 7.1);
  addBoxPart(tdStoneParts, 6.8, 0.85, 6.8, tdX, canalY + 0.25, tdZ);
  addBoxPart(tdStoneParts, 5.8, 0.25, 5.8, tdX, canalY + 0.78, tdZ);
  // Access wooden footbridge from south bank to Thủy Đình
  addBoxPart(tdWoodParts, 2.2, 0.22, 4.4, tdX, canalY + 0.82, tdZ + 5.1);
  tdWoodParts.push(
    ...createPiercedBalustradeParts(tdX - 1.0, tdZ + 3.2, tdX - 1.0, tdZ + 7.0, canalY + 0.92, 0.78, 'con_tien'),
    ...createPiercedBalustradeParts(tdX + 1.0, tdZ + 3.2, tdX + 1.0, tdZ + 7.0, canalY + 0.92, 0.78, 'con_tien')
  );
  // 8 crimson lacquered columns + upper attic posts + pierced balustrade around water pavilion
  const colPts: Array<[number, number]> = [
    [-2.4, -2.4], [0, -2.4], [2.4, -2.4],
    [-2.4, 0], [2.4, 0],
    [-2.4, 2.4], [2.4, 2.4]
  ];
  for (const [ox, oz] of colPts) {
    addCylPart(tdCrimsonParts, 0.14, 0.16, 3.2, 8, tdX + ox, canalY + 2.45, tdZ + oz);
  }
  for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    addCylPart(tdCrimsonParts, 0.12, 0.14, 2.2, 8, tdX + ox, canalY + 5.1, tdZ + oz);
  }
  tdWoodParts.push(
    ...createPiercedBalustradeParts(tdX - 2.6, tdZ - 2.6, tdX + 2.6, tdZ - 2.6, canalY + 0.92, 0.76, 'con_tien'),
    ...createPiercedBalustradeParts(tdX - 2.6, tdZ - 2.6, tdX - 2.6, tdZ + 2.6, canalY + 0.92, 0.76, 'con_tien'),
    ...createPiercedBalustradeParts(tdX + 2.6, tdZ - 2.6, tdX + 2.6, tdZ + 2.6, canalY + 0.92, 0.76, 'con_tien')
  );
  // 2-tier Vietnamese curved roofs + dragon ridge finial set (wide-ridge hip roof so tdFinial seats with 0.0m air gap!)
  const tdRoof1 = createVietnameseCurvedRoofGeometry(8.6, 8.6, 4.6, 4.6, 1.9, 0.72);
  tdRoof1.translate(tdX, canalY + 3.95, tdZ);
  const tdRoof2 = createHueImperialHipRoofGeometry(5.8, 5.8, 1.8, 1.0, 2.1, 0.85);
  tdRoof2.translate(tdX, canalY + 6.1, tdZ);
  tdRoofParts.push(tdRoof1, tdRoof2);
  const tdFinial = createRoofFinialSetParts(tdX, canalY + 8.16, tdZ, 1.6, 0, 0.62, true);
  tdRoofParts.push(...tdFinial.mainParts);
  tdGoldParts.push(...tdFinial.goldParts);

  const tdPlaque = createSignagePlaqueMesh(
    { text: 'THỦY ĐÌNH', subText: 'TRÀNG AN', width: 2.0, height: 0.56, depth: 0.12, style: 'royal' },
    ctx
  );
  tdPlaque.position.set(tdX, canalY + 3.65, tdZ + 2.55);
  group.add(tdPlaque);

  // FIX TA-02: Authentic Open-Top Tràng An Canal Sampan (NO high bamboo awning!) with conical-hat rower & orange-lifejacket tourists!
  const miniSampan = new THREE.Group();
  const msWood: THREE.BufferGeometry[] = createTaperedSampanHullParts(5.2, 1.15, 0.40);
  const msCanopy: THREE.BufferGeometry[] = [];
  const msVestParts: THREE.BufferGeometry[] = [];
  // Conical-hat boatwoman rower at stern
  addCylPart(msWood, 0.16, 0.22, 0.62, 7, -1.65, 0.65, 0);
  const rowerHat = new THREE.ConeGeometry(0.32, 0.22, 10);
  rowerHat.translate(-1.65, 1.16, 0);
  msCanopy.push(rowerHat);
  // 2 Seated passengers wearing iconic bright orange Tràng An lifejackets (#eb6b2d) + bow orange life-ring
  for (const px of [-0.35, 0.65]) {
    addBoxPart(msVestParts, 0.42, 0.46, 0.54, px, 0.62, 0);
    const pHead = new THREE.SphereGeometry(0.14, 7, 5);
    pHead.translate(px, 0.96, 0);
    msCanopy.push(pHead);
  }
  const lifeRing = new THREE.TorusGeometry(0.24, 0.06, 6, 12);
  lifeRing.rotateX(Math.PI * 0.5);
  lifeRing.translate(1.85, 0.46, 0);
  msVestParts.push(lifeRing);
  addCylPart(msWood, 0.025, 0.035, 2.4, 5, -1.5, 0.42, 0.72, 0.35, 0.45);
  const lifeVestMat = ctx.materialLib?.getOrCreateStandard({ color: '#e85a1c', roughness: 0.72 }) ?? new THREE.MeshStandardMaterial({ color: '#e85a1c', roughness: 0.72 });
  miniSampan.add(
    new THREE.Mesh(mergeNormalized(msWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(msCanopy), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(msVestParts), lifeVestMat)
  );
  miniSampan.position.set(cx + 8, canalY + 0.06, canalCz + 0.4);
  group.add(miniSampan);
  ctx.junkBoats.push({
    group: miniSampan,
    centerX: cx + 8,
    centerZ: canalCz + 0.4,
    radiusX: 5.5,
    radiusZ: 1.1,
    speed: 0.22,
    phase: 0.7
  });

  group.add(
    new THREE.Mesh(mergeNormalized(tdStoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(tdCrimsonParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(tdWoodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(tdRoofParts), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(tdGoldParts), ctx.materials.gold)
  );

  // 3. Earthen bunds, 7 Conical Straw Stacks (đống rơm), and 1 Stilt Field Watch-Hut (chòi canh)
  const strawParts: THREE.BufferGeometry[] = [];
  const hutParts: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 7; s++) {
    const sx = cx - 22 + (s % 4) * 12 + (rand() - 0.5) * 3;
    const sz = cz + 12 - Math.floor(s / 4) * 14;
    const sy = ctx.getHeight(sx, sz);
    const cone = new THREE.ConeGeometry(1.55, 3.3, 14);
    cone.translate(sx, sy + 1.55, sz);
    strawParts.push(cone);
    addCylPart(hutParts, 0.06, 0.08, 4.0, 6, sx, sy + 2.0, sz);
  }
  // Field watch hut on left side matching Ref 01
  const hx = cx - 20;
  const hz = cz + 12;
  const hy = ctx.getHeight(hx, hz);
  for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    addCylPart(hutParts, 0.09, 0.11, 2.8, 6, hx + ox, hy + 1.4, hz + oz);
  }
  addBoxPart(hutParts, 2.7, 0.14, 2.7, hx, hy + 1.45, hz);
  const hutRoof = new THREE.ConeGeometry(2.3, 1.85, 4);
  hutRoof.rotateY(Math.PI * 0.25);
  hutRoof.translate(hx, hy + 3.45, hz);
  strawParts.push(hutRoof);

  // Bunds grid strips
  addBoxPart(hutParts, 58, 0.25, 0.45, cx, baseY + 0.08, cz + 10);
  addBoxPart(hutParts, 58, 0.25, 0.45, cx, baseY + 0.08, cz - 8);
  addBoxPart(hutParts, 0.45, 0.25, 36, cx - 14, baseY + 0.08, cz + 4);
  addBoxPart(hutParts, 0.45, 0.25, 36, cx + 14, baseY + 0.08, cz + 4);

  const strawMat = ctx.materials.thatchFiber ?? ctx.materials.darkWood;
  const strawMesh = new THREE.Mesh(mergeNormalized(strawParts), strawMat);
  strawMesh.castShadow = true;
  group.add(strawMesh);

  const hutMat = ctx.materials.bark;
  group.add(new THREE.Mesh(mergeNormalized(hutParts), hutMat));

  // Warm oil-lamp glow inside field hut at sunset
  const lampCoreMat = new THREE.MeshStandardMaterial({
    color: '#ffb347',
    emissive: new THREE.Color('#ff8a2a'),
    emissiveIntensity: 1.8
  });
  lampCoreMat.userData.noDedupe = true;
  ctx.extraMaterials.push(lampCoreMat);
  const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), lampCoreMat);
  lampMesh.position.set(hx, hy + 2.1, hz);
  group.add(lampMesh);

  ctx.scene.add(group);
  return lampCoreMat;
}

// ---------------------------------------------------------------------------
// Spec 02: Hội An Lantern Night & Hoài River Flower Lanterns (175, 45)
// ---------------------------------------------------------------------------

function buildHoiAnLanternUpgrades(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): {
  silkGlowMats: THREE.MeshStandardMaterial[];
  skyMat: THREE.MeshStandardMaterial;
  flowerMat: THREE.MeshStandardMaterial;
} {
  const cx = 175;
  const cz = 45;
  const groundY = ctx.getHeight(cx, cz);

  // FIX CC-01 & HA-01:
  // 1. Relocate the 2 ceremonial Hội An pavilion gates to open North/South street approaches (z = 4.0 & z = 84.0)
  //    and move the lantern tower onto the East riverside embankment (x = 186.5, z = 72) — ZERO house/river collisions!
  // 2. REMOVED duplicate `addChuaCauInteriorAndGuardians` at (175, 45) (previously blocked Chùa Cầu pedestrian path!).
  // 3. REMOVED cableless floating `HoiAnLanternCanopy` (central builder already renders catenary-strung lanterns!).
  const gatesGroup = new THREE.Group();
  gatesGroup.name = 'HoiAnPavilionGates';
  const colParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];

  // Keep North/South ceremonial pavilion gates cleanly clear of Tam Quan Hội Quán Phúc Kiến at (156.2, 79.8)!
  for (const pz of [cz - 40.0, cz + 48.0]) {
    const px = cx - 15.5;
    const py = ctx.getHeight(px, pz);
    for (const [ox, oz] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) {
      addCylPart(colParts, 0.20, 0.22, 6.8, 10, px + ox, py + 3.4, pz + oz);
    }
    const r1 = createVietnameseCurvedRoofGeometry(6.4, 4.6, 3.2, 2.0, 2.0, 0.65);
    r1.translate(px, py + 3.9, pz);
    roofParts.push(r1);
    const r2 = createVietnameseCurvedRoofGeometry(5.2, 3.6, 1.4, 0.7, 2.1, 0.78);
    r2.translate(px, py + 6.7, pz);
    roofParts.push(r2);
    addBoxPart(goldParts, 3.4, 0.32, 0.22, px, py + 3.7, pz + 1.6);
  }
  // Stacked red/gold ceremonial lantern tower positioned cleanly on East embankment promenade (OUTSIDE river channel!)
  const towerX = cx + 12.2;
  const towerZ = cz + 28.0;
  const towerY = ctx.getHeight(towerX, towerZ);
  for (let tier = 0; tier < 6; tier++) {
    const rad = 0.82 - tier * 0.08;
    addCylPart(colParts, rad * 0.92, rad, 0.85, 12, towerX, towerY + 0.9 + tier * 0.95, towerZ);
    addCylPart(goldParts, rad * 1.05, rad * 1.05, 0.12, 12, towerX, towerY + 1.35 + tier * 0.95, towerZ);
  }

  gatesGroup.add(new THREE.Mesh(mergeNormalized(colParts), ctx.materials.crimsonLacquer));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold));
  ctx.scene.add(gatesGroup);

  const uTimeObj = { uTime: { value: 0 } };
  animList.push(uTimeObj);
  const silkMat = ctx.materials.lanternCore ?? ctx.materials.gold;
  const rand = mulberry32(20202);

  // Preserve `HoiAnLanternCanopy` group for promenade warm lantern light pools (cableless floating lanterns REMOVED per HA-01!)
  const canopyGroup = new THREE.Group();
  canopyGroup.name = 'HoiAnLanternCanopy';
  const poolMat = ctx.sharedShaders
    ? ctx.sharedShaders.warmLightPool.material
    : (() => {
      const poolHelper = createWarmLightPoolMaterial();
      animList.push(poolHelper.uniforms);
      ctx.extraMaterials.push(poolHelper.material);
      return poolHelper.material;
    })();
  const poolGeo = new THREE.PlaneGeometry(5.5, 5.5);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, 8);
  for (let p = 0; p < 8; p++) {
    const px = cx + (p % 2 === 0 ? -12.0 : 12.0);
    const pz = cz - 24 + Math.floor(p / 2) * 16;
    setInstanceMatrix(poolMesh, p, px, ctx.getHeight(px, pz) + 0.08, pz, 0, 0, 0, 1, 1, 1);
  }
  poolMesh.instanceMatrix.needsUpdate = true;
  canopyGroup.add(poolMesh);
  ctx.scene.add(canopyGroup);

  // 3. Sky Lanterns (`HoiAnSkyLanterns`) — 180 continuously drifting embers
  const skyGroup = new THREE.Group();
  skyGroup.name = 'HoiAnSkyLanterns';
  const skyLanternGeo = createLanternCoreGeometry(0.42, 0.72);
  const skyMat = new THREE.MeshStandardMaterial({
    color: '#ff9040',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.45,
    roughness: 0.6
  });
  skyMat.userData.noDedupe = true;
  skyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeObj.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 sPos = vec3(0.0);
       #ifdef USE_INSTANCING
       sPos = vec3(instanceMatrix[3].xyz);
       #endif
       float cycle = mod(uTime * 0.85 + sPos.x * 1.7 + sPos.z * 2.3, 85.0);
       transformed.y += cycle;
       transformed.x += sin(uTime * 0.4 + sPos.z) * 1.6;`
    );
  };
  ctx.extraMaterials.push(skyMat);
  const skyInst = new THREE.InstancedMesh(skyLanternGeo, skyMat, 180);
  for (let i = 0; i < 180; i++) {
    const sx = cx + (rand() - 0.5) * 95;
    const sz = cz + (rand() - 0.5) * 95;
    const sy = 9.0 + rand() * 8.0;
    setInstanceMatrix(skyInst, i, sx, sy, sz, 0, rand() * 3.14, 0, 1, 1, 1);
  }
  skyInst.instanceMatrix.needsUpdate = true;
  skyGroup.add(skyInst);
  ctx.scene.add(skyGroup);

  // 4. Floating Hoài River Flower Lanterns (`HoaiRiverFlowerLanterns`) — 220 multi-petal hoa đăng
  const riverGroup = new THREE.Group();
  riverGroup.name = 'HoaiRiverFlowerLanterns';
  const flowerLotusGeo = createBloomingHoaDangGeometry(1.0);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#ff8844'),
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide
  });
  flowerMat.userData.noDedupe = true;
  flowerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeObj.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 fPos = vec3(0.0);
       #ifdef USE_INSTANCING
       fPos = vec3(instanceMatrix[3].xyz);
       #endif
       transformed.y += sin(uTime * 2.1 + fPos.x * 0.8 + fPos.z) * 0.04;
       transformed.z += mod(uTime * 0.18 + fPos.x, 12.0) - 6.0;`
    );
  };
  ctx.extraMaterials.push(flowerMat);
  // FIX HA-01: Clamp all 220 floating flower lanterns strictly INSIDE the Hoài River water channel (x ∈ [168.5..181.5])
  // and outside the Chùa Cầu bridge deck footprint (|z - 45| >= 5.8m) -> ZERO lanterns on dry pavement!
  const flowerMesh = new THREE.InstancedMesh(flowerLotusGeo, flowerMat, 220);
  for (let i = 0; i < 220; i++) {
    const fx = cx + (rand() - 0.5) * 12.6; // strictly inside [168.7..181.3] water channel!
    let fz = cz + (rand() - 0.5) * 64.0;
    if (Math.abs(fz - cz) < 6.0) {
      fz = cz + (fz >= cz ? 6.5 : -6.5) + (rand() - 0.5) * 4.0;
    }
    setInstanceMatrix(flowerMesh, i, fx, VIETNAM_WATER_LEVEL + 0.06, fz, 0, rand() * Math.PI * 2, 0, 1, 1, 1);
  }
  flowerMesh.instanceMatrix.needsUpdate = true;
  riverGroup.add(flowerMesh);
  ctx.scene.add(riverGroup);

  return { silkGlowMats: [silkMat], skyMat, flowerMat };
}

// ---------------------------------------------------------------------------
// Spec 03: Huế Thái Hòa Throne Hall (-235, 42) & Plaza Sacred Lotus (0, 34)
// ---------------------------------------------------------------------------

function buildImperialCourtAndLotus(ctx: VietnamBuilderContext): {
  palaceLanternMat: THREE.MeshStandardMaterial;
  daiSenMat: THREE.MeshStandardMaterial;
} {
  // 1. Core Điện Thái Hòa Throne Hall (`HueThaiHoaThroneHall` behind Ngọ Môn at -238, 52)
  //    Full parity museum-grade exterior & interior matching Photos 1, 3, 4, 5, 6!
  const hcx = -238;
  const hcz = 52;
  const hy = ctx.getHeight(hcx, hcz);
  ctx.exclusionCircles.push({ x: hcx, z: hcz, r: 30 });

  const hallGroup = new THREE.Group();
  hallGroup.name = 'HueThaiHoaThroneHall';

  if (ctx.huePack) {
    buildDienThaiHoaHeroHall(ctx, hallGroup, {
      hallCenterX: hcx,
      baseY: hy,
      centerZ: hcz,
      widthZ: 34.0,
      depthX: 24.0,
      plinthH: 0.90,
      colH: 5.0,
      fullHeroInterior: false
    });
    // Clean dressed Thanh stone forecourt apron connecting Core Điện Thái Hòa to Ngọ Môn rear plaza
    const courtGeo = applyWorldBoxUV(new THREE.BoxGeometry(20.0, 0.44, 38.0), 2.8);
    courtGeo.translate(hcx + 21.5, hy + 0.22, hcz);
    const courtMesh = new THREE.Mesh(courtGeo, ctx.huePack.thanhStoneMat);
    courtMesh.receiveShadow = true;
    hallGroup.add(courtMesh);
    // 6 lush leafy palace trees framing Core Điện Thái Hòa flanks cleanly (masks hillside in Photo 6 parity shot!)
    const coreTrunks: THREE.BufferGeometry[] = [];
    const coreLeaves: THREE.BufferGeometry[] = [];
    for (const [tx, tz, sc, sd] of [
      [hcx + 2, hcz - 24, 1.45, 91],
      [hcx - 12, hcz - 25, 1.55, 92],
      [hcx - 2, hcz - 19, 1.60, 95],
      [hcx + 2, hcz + 24, 1.45, 93],
      [hcx - 12, hcz + 25, 1.55, 94],
      [hcx - 2, hcz + 19, 1.60, 96]
    ]) {
      addRoyalGardenTree(coreTrunks, coreLeaves, tx, hy, tz, sc, sd);
    }
    const coreLeafMat = ctx.materialLib?.getOrCreateStandard({
      map: ctx.pbr.leafAtlas,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02
    }) ?? ctx.materials.darkWood;
    hallGroup.add(
      new THREE.Mesh(mergeNormalized(coreTrunks), ctx.materials.darkWood),
      new THREE.Mesh(mergeNormalized(coreLeaves), coreLeafMat)
    );
  }
  ctx.scene.add(hallGroup);

  // Palace Eave Lanterns (`HuePalaceLanterns` — mounted gracefully under outer veranda eaves, NEVER blocking nave!)
  const palGroup = new THREE.Group();
  palGroup.name = 'HuePalaceLanterns';
  const hexGeo = new THREE.CylinderGeometry(0.24, 0.20, 0.56, 6);
  const palaceLanternMat = ctx.materials.lanternCore ?? new THREE.MeshStandardMaterial({
    color: '#ffcf80',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.4,
    roughness: 0.45
  });
  const palInst = new THREE.InstancedMesh(hexGeo, palaceLanternMat, 10);
  const capParts: THREE.BufferGeometry[] = [
    new THREE.ConeGeometry(0.30, 0.16, 6).translate(0, 0.34, 0),
    new THREE.CylinderGeometry(0.24, 0.24, 0.07, 6).translate(0, -0.30, 0),
    new THREE.CylinderGeometry(0.03, 0.06, 0.30, 5).translate(0, -0.48, 0)
  ];
  const palCapInst = new THREE.InstancedMesh(
    mergeNormalized(capParts),
    ctx.huePack?.imperialCrimsonWoodMat ?? ctx.materials.crimsonLacquer,
    10
  );
  for (let i = 0; i < 10; i++) {
    const lz = hcz - 13.5 + i * 3.0;
    setInstanceMatrix(palInst, i, hcx + 12.6, hy + 5.15, lz, 0, 0, 0, 1, 1, 1);
    setInstanceMatrix(palCapInst, i, hcx + 12.6, hy + 5.15, lz, 0, 0, 0, 1, 1, 1);
  }
  palInst.instanceMatrix.needsUpdate = true;
  palCapInst.instanceMatrix.needsUpdate = true;
  palGroup.add(palInst, palCapInst);
  ctx.scene.add(palGroup);

  // 2. Plaza Sacred Lotus (`PlazaSacredLotus`) — Giant Đài Sen + Lotus Column Arcade (`LotusColumnArcade`)
  const lotusGroup = new THREE.Group();
  lotusGroup.name = 'PlazaSacredLotus';
  const daiSenMat = new THREE.MeshStandardMaterial({
    color: '#e8749a',
    emissive: new THREE.Color('#ff6699'),
    emissiveIntensity: 0.35,
    roughness: 0.48,
    side: THREE.DoubleSide
  });
  daiSenMat.userData.noDedupe = true;
  ctx.extraMaterials.push(daiSenMat);
  const pedestalParts: THREE.BufferGeometry[] = [];
  const petalParts: THREE.BufferGeometry[] = [];
  const coreParts: THREE.BufferGeometry[] = [];
  for (const px of [-22, 22]) {
    const pz = 78;
    const py = Math.max(ctx.getHeight(px, pz), VIETNAM_WATER_LEVEL + 0.15);
    addCylPart(pedestalParts, 1.35, 1.65, 0.75, 16, px, py + 0.35, pz);
    const flower = createForegroundLotusFlowerParts(px, py + 0.72, pz, 0.08, 12.0, 1.0, 0.0);
    for (const st of flower.stemParts) st.dispose();
    petalParts.push(...flower.petalParts);
    coreParts.push(...flower.coreParts);
  }
  lotusGroup.add(new THREE.Mesh(mergeNormalized(pedestalParts), ctx.materials.whitePlaster));
  lotusGroup.add(new THREE.Mesh(mergeNormalized(petalParts), daiSenMat));
  lotusGroup.add(new THREE.Mesh(mergeNormalized(coreParts), ctx.materials.gold));
  ctx.scene.add(lotusGroup);

  const arcadeGroup = new THREE.Group();
  arcadeGroup.name = 'LotusColumnArcade';
  const arcadeCols = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.20, 0.22, 4.4, 12), ctx.materials.crimsonLacquer, 8);
  const arcadeBases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.40, 0.45, 12), ctx.materials.whitePlaster, 8);
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    // Framed cleanly around the South Entrance Esplanade outside Văn Miếu Môn (|x| <= 24, z in [74, 82]),
    // keeping Văn Miếu, Chùa Một Cột & Hồ Hoàn Kiếm 100% clear!
    const ax = side * (16.0 + (k % 2) * 5.0);
    const az = 74.0 + Math.floor(k / 2) * 8.0;
    const ay = Math.max(ctx.getHeight(ax, az), VIETNAM_WATER_LEVEL + 0.1);
    setInstanceMatrix(arcadeCols, i, ax, ay + 2.2, az, 0, 0, 0, 1, 1, 1);
    setInstanceMatrix(arcadeBases, i, ax, ay + 0.22, az, 0, 0, 0, 1, 1, 1);
  }
  arcadeCols.instanceMatrix.needsUpdate = true;
  arcadeBases.instanceMatrix.needsUpdate = true;
  arcadeCols.computeBoundingBox();
  arcadeBases.computeBoundingBox();
  arcadeGroup.add(arcadeCols, arcadeBases);
  ctx.scene.add(arcadeGroup);

  return { palaceLanternMat, daiSenMat };
}

// ---------------------------------------------------------------------------
// Spec 04: Northern Banyan Village Night (-85, 95)
// ---------------------------------------------------------------------------

function buildNorthernBanyanVillage(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
  const cx = -85;
  const cz = 95;
  const by = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 24 });

  const villageGroup = new THREE.Group();
  villageGroup.name = 'LangCoBanyanVillage';

  // 1. Realistic Ancient Village Banyans (*Cây Đa Cổ Thụ Làng Cổ*) with gnarled fluted buttress trunks,
  //    sinuous surface roots, sweeping curved boughs, anchored pillar prop roots & dangling aerial root curtains,
  //    lush multi-tone 3D dome canopies, plus mossy brick Miếu Thổ Địa shrine & stone bench under the shade!
  const heroGroup = new THREE.Group();
  heroGroup.name = 'LangCoBanyanHero';
  const trunkParts: THREE.BufferGeometry[] = [];
  const banyanCanopyParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(40404);
  const treeAnchors: Array<[number, number, number]> = [
    [cx, cz - 14, 1.12],
    [cx - 18, cz + 14, 0.92],
    [cx + 18, cz + 14, 0.92]
  ];
  const canopyCenters: Array<[number, number, number, number]> = [];

  for (let ti = 0; ti < treeAnchors.length; ti++) {
    const [tx, tz, sc] = treeAnchors[ti];
    const ty = ctx.getHeight(tx, tz);
    const banyan = createRealisticAncientBanyanParts(tx, ty, tz, sc, 40404 + ti * 131, {
      boughCount: ti === 0 ? 6 : 5,
      propRootCount: ti === 0 ? 7 : 5,
      danglingRootCount: ti === 0 ? 18 : 12,
      canopyDensity: 0.85,
      getHeight: ctx.getHeight
    });
    trunkParts.push(...banyan.barkParts);
    banyanCanopyParts.push(...banyan.canopyParts);
    canopyCenters.push(...banyan.canopyCenters);
  }
  const barkMesh = new THREE.Mesh(mergeNormalized(trunkParts), ctx.materials.bark);
  barkMesh.castShadow = true;
  barkMesh.receiveShadow = true;
  heroGroup.add(barkMesh);

  const banyanDomeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8
  });
  ctx.extraMaterials.push(banyanDomeMat);
  const banyanDomeMesh = new THREE.Mesh(mergeNormalized(banyanCanopyParts), banyanDomeMat);
  banyanDomeMesh.name = 'LangCoBanyanLushCanopy';
  banyanDomeMesh.castShadow = true;
  banyanDomeMesh.receiveShadow = true;
  heroGroup.add(banyanDomeMesh);

  // Mossy ancient brick Miếu Thổ Địa shrine (with recessed altar niche, golden bát hương incense bowl & prayer sash)
  // & weathered stone village bench nestled at the central Banyan root base
  const shX = cx + 2.8;
  const shZ = cz - 11.4;
  const shY = ctx.getHeight(shX, shZ);
  const shrineParts: THREE.BufferGeometry[] = [];
  addBoxPart(shrineParts, 1.6, 0.55, 1.4, shX, shY + 0.27, shZ);
  addBoxPart(shrineParts, 1.15, 1.25, 1.0, shX, shY + 1.15, shZ);
  // Village stone resting bench under the ancient banyan canopy + stone stepping path leading to Miếu Thổ Địa
  const benchY = ctx.getHeight(cx - 3.4, cz - 11.2);
  addBoxPart(shrineParts, 2.6, 0.16, 0.65, cx - 3.4, benchY + 0.48, cz - 11.2, 0.22);
  addBoxPart(shrineParts, 0.26, 0.48, 0.55, cx - 4.3, ctx.getHeight(cx - 4.3, cz - 11.0) + 0.24, cz - 11.0, 0.22);
  addBoxPart(shrineParts, 0.26, 0.48, 0.55, cx - 2.5, ctx.getHeight(cx - 2.5, cz - 11.4) + 0.24, cz - 11.4, 0.22);
  for (let sp = 0; sp < 5; sp++) {
    const sx = shX - 0.15 * sp;
    const sz = shZ + 1.15 + sp * 0.72;
    addBoxPart(shrineParts, 0.62, 0.08, 0.44, sx, ctx.getHeight(sx, sz) + 0.04, sz, sp * 0.08);
  }
  // Micro-vignette on stone bench (*Quán Nước Chè Xanh Dưới Gốc Đa*): celadon teapot, 3 tea cups & roof ridge *kìm nóc* scrolls
  shrineParts.push(
    new THREE.CylinderGeometry(0.08, 0.10, 0.14, 7).translate(cx - 3.1, benchY + 0.63, cz - 11.2),
    new THREE.CylinderGeometry(0.035, 0.025, 0.06, 6).translate(cx - 3.35, benchY + 0.59, cz - 11.15),
    new THREE.CylinderGeometry(0.035, 0.025, 0.06, 6).translate(cx - 3.48, benchY + 0.59, cz - 11.24),
    new THREE.CylinderGeometry(0.035, 0.025, 0.06, 6).translate(cx - 3.32, benchY + 0.59, cz - 11.30),
    new THREE.TorusGeometry(0.11, 0.03, 4, 8, Math.PI * 1.3).translate(shX - 0.54, shY + 2.56, shZ),
    new THREE.TorusGeometry(0.11, 0.03, 4, 8, Math.PI * 1.3).translate(shX + 0.54, shY + 2.56, shZ)
  );
  heroGroup.add(new THREE.Mesh(mergeNormalized(shrineParts), ctx.materials.stone));
  const shrineRoof = createVietnameseCurvedRoofGeometry(2.05, 1.75, 1.15, 0.45, 0.78, 0.22);
  shrineRoof.translate(shX, shY + 1.78, shZ);
  heroGroup.add(new THREE.Mesh(shrineRoof, ctx.materials.terracottaRoof));
  heroGroup.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.14).translate(shX, shY + 1.02, shZ + 0.48), ctx.materials.darkVoid),
    new THREE.Mesh(
      mergeNormalized([
        new THREE.CylinderGeometry(0.14, 0.11, 0.16, 8).translate(shX, shY + 0.72, shZ + 0.56),
        new THREE.CylinderGeometry(0.20, 0.20, 0.04, 8).translate(shX + 0.22, shY + 0.66, shZ + 0.56),
        // Miniature golden horizontal *hoành phi* plaque above shrine niche + 2 flanking golden lotus vases + conical nón lá & bamboo điếu cày on bench
        new THREE.BoxGeometry(0.58, 0.15, 0.06).translate(shX, shY + 1.52, shZ + 0.52),
        new THREE.CylinderGeometry(0.05, 0.065, 0.22, 6).translate(shX - 0.34, shY + 0.75, shZ + 0.56),
        new THREE.CylinderGeometry(0.05, 0.065, 0.22, 6).translate(shX + 0.34, shY + 0.75, shZ + 0.56),
        new THREE.ConeGeometry(0.24, 0.16, 8).translate(cx - 3.9, benchY + 0.64, cz - 11.15),
        new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5).rotateZ(0.38).translate(cx - 2.65, benchY + 0.68, cz - 11.25)
      ]),
      ctx.materials.gold
    ),
    new THREE.Mesh(
      mergeNormalized([
        new THREE.CylinderGeometry(0.014, 0.014, 0.28, 4).translate(shX - 0.04, shY + 0.88, shZ + 0.56),
        new THREE.CylinderGeometry(0.014, 0.014, 0.28, 4).translate(shX, shY + 0.88, shZ + 0.56),
        new THREE.CylinderGeometry(0.014, 0.014, 0.28, 4).translate(shX + 0.04, shY + 0.88, shZ + 0.56),
        // Ceremonial red silk prayer ribbon tied around the ancient central Banyan trunk + 4 hanging red wooden prayer plaques (*thẻ gỗ cầu an*)
        new THREE.TorusGeometry(1.18, 0.075, 5, 14).rotateX(Math.PI * 0.5).translate(cx, by + 2.25, cz - 14),
        new THREE.BoxGeometry(0.14, 0.36, 0.03).translate(cx - 2.2, by + 3.45, cz - 11.8),
        new THREE.BoxGeometry(0.14, 0.36, 0.03).translate(cx + 2.4, by + 3.55, cz - 12.1),
        new THREE.BoxGeometry(0.14, 0.36, 0.03).translate(cx - 1.6, by + 3.65, cz - 15.8),
        new THREE.BoxGeometry(0.14, 0.36, 0.03).translate(cx + 1.9, by + 3.40, cz - 15.6)
      ]),
      ctx.materials.crimsonLacquer
    ),
    // Bamboo carrying pole with pair of woven market baskets (*đòn gánh đôi quang gánh tre*) beside the banyan stone bench
    new THREE.Mesh(
      mergeNormalized([
        new THREE.CylinderGeometry(0.025, 0.025, 1.85, 5).rotateZ(Math.PI * 0.48).translate(cx - 4.85, benchY + 0.54, cz - 11.2),
        new THREE.CylinderGeometry(0.32, 0.22, 0.24, 7).translate(cx - 5.55, benchY + 0.14, cz - 11.2),
        new THREE.CylinderGeometry(0.32, 0.22, 0.24, 7).translate(cx - 4.15, benchY + 0.14, cz - 11.2)
      ]),
      ctx.materials.darkWood
    )
  );

  const leafGeo = new THREE.PlaneGeometry(1.15, 1.15);
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2f5a2a',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.68
  });
  ctx.extraMaterials.push(leafMat);
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, 900);
  for (let i = 0; i < 900; i++) {
    const cc = canopyCenters[i % canopyCenters.length];
    const u = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const rad = cc[3] * (0.55 + 0.50 * Math.pow(rand(), 0.4));
    setInstanceMatrix(
      leafInst,
      i,
      cc[0] + rad * Math.sin(phi) * Math.cos(u),
      cc[1] + rad * Math.cos(phi) * 0.46,
      cc[2] + rad * Math.sin(phi) * Math.sin(u),
      (rand() - 0.5) * 1.4,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 1.4,
      1,
      1,
      1
    );
  }
  leafInst.instanceMatrix.needsUpdate = true;
  heroGroup.add(leafInst);
  ctx.scene.add(heroGroup);

  // 2. Laterite (đá ong tổ ong) Walls & Hollow Village Well (`LangCoLateriteWalls`)
  const wallGroup = new THREE.Group();
  wallGroup.name = 'LangCoLateriteWalls';
  const latParts: THREE.BufferGeometry[] = [];
  for (const sx of [-12.5, 12.5]) {
    addBoxPart(latParts, 0.45, 1.85, 18.0, cx + sx, ctx.getHeight(cx + sx, cz) + 0.9, cz);
  }
  // Hollow Giếng làng round laterite well wall with recessed dark water inside
  const wx = cx + 6.5;
  const wz = cz - 2.0;
  const wy = ctx.getHeight(wx, wz);
  const wellRingShape = new THREE.Shape();
  wellRingShape.absarc(0, 0, 1.24, 0, Math.PI * 2, false);
  const wellHole = new THREE.Path();
  wellHole.absarc(0, 0, 0.92, 0, Math.PI * 2, true);
  wellRingShape.holes.push(wellHole);
  const wellWallGeo = new THREE.ExtrudeGeometry(wellRingShape, { depth: 0.72, bevelEnabled: false, curveSegments: 16 });
  wellWallGeo.rotateX(-Math.PI * 0.5);
  wellWallGeo.translate(wx, wy, wz);
  latParts.push(wellWallGeo);
  const wellWater = new THREE.Mesh(
    new THREE.CircleGeometry(0.92, 16).rotateX(-Math.PI * 0.5),
    ctx.materials.darkVoid
  );
  wellWater.position.set(wx, wy + 0.16, wz);
  wallGroup.add(wellWater);

  const lateriteMat = ctx.materials.lateriteHoneycomb ?? ctx.materials.stone;
  wallGroup.add(new THREE.Mesh(applyWorldBoxUV(mergeNormalized(latParts), 2.2), lateriteMat));
  ctx.scene.add(wallGroup);

  // 3. Folk Village Gate & 3 Traditional Laterite Houses (`LangCoVillageGate`)
  const gateGroup = new THREE.Group();
  gateGroup.name = 'LangCoVillageGate';
  const gateBodyParts: THREE.BufferGeometry[] = [];
  const houseRoofParts: THREE.BufferGeometry[] = [];
  const warmWinParts: THREE.BufferGeometry[] = [];

  for (const side of [-1.6, 1.6]) {
    addBoxPart(gateBodyParts, 0.85, 3.4, 0.85, cx + side, by + 1.7, cz + 8);
  }
  addBoxPart(gateBodyParts, 4.1, 0.65, 0.9, cx, by + 3.2, cz + 8);
  const gRoof = createGableRoofGeometry(5.2, 2.4, 1.35, 0.14, 'x');
  gRoof.translate(cx, by + 3.45, cz + 8);
  houseRoofParts.push(gRoof);

  // FIX HV03-4: Upgrade 3 Core LangCoVillageGate ancient laterite houses with recessed 3-bay timber verandas, 4 wooden porch columns & wooden cửa bức bàn panels!
  const porchWoodParts: THREE.BufferGeometry[] = [];
  for (const [hx, hz, ry] of [[cx - 9.5, cz - 7, 0.35], [cx + 9.5, cz - 8, -0.35], [cx - 11.5, cz + 4, 1.2]] as Array<[number, number, number]>) {
    const hgy = ctx.getHeight(hx, hz);
    const body = new THREE.BoxGeometry(6.4, 2.8, 3.2);
    body.translate(0, 1.4, -0.5);
    body.rotateY(ry);
    body.translate(hx, hgy, hz);
    gateBodyParts.push(body);
    for (const vx of [-2.8, -0.95, 0.95, 2.8]) {
      const pCol = new THREE.CylinderGeometry(0.09, 0.11, 2.75, 6);
      pCol.translate(vx, 1.38, 1.85);
      pCol.rotateY(ry);
      pCol.translate(hx, hgy, hz);
      porchWoodParts.push(pCol);
    }
    const hRoof = createGableRoofGeometry(7.2, 4.9, 1.85, 0.14, 'x');
    hRoof.rotateY(ry);
    hRoof.translate(hx, hgy + 2.8, hz);
    houseRoofParts.push(hRoof);
    for (const dx of [-1.85, 0, 1.85]) {
      const shutter = new THREE.BoxGeometry(1.42, 1.85, 0.10);
      shutter.translate(dx, 1.0, 1.12);
      shutter.rotateY(ry);
      shutter.translate(hx, hgy, hz);
      porchWoodParts.push(shutter);
    }
    const win = new THREE.BoxGeometry(0.85, 0.65, 0.10);
    win.translate(0, 1.45, 1.18);
    win.rotateY(ry);
    win.translate(hx, hgy, hz);
    warmWinParts.push(win);
  }
  gateGroup.add(new THREE.Mesh(mergeNormalized(porchWoodParts), ctx.materials.darkWood));

  gateGroup.add(new THREE.Mesh(applyWorldBoxUV(mergeNormalized(gateBodyParts), 2.2), lateriteMat));
  gateGroup.add(new THREE.Mesh(mergeNormalized(houseRoofParts), ctx.materials.terracottaRoof));
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: '#ff9a4a',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.45
  });
  warmGlowMat.userData.noDedupe = true;
  ctx.extraMaterials.push(warmGlowMat);
  gateGroup.add(new THREE.Mesh(mergeNormalized(warmWinParts), warmGlowMat));
  ctx.scene.add(gateGroup);
  ctx.scene.add(villageGroup);
  return warmGlowMat;
}

// ---------------------------------------------------------------------------
// Spec 05: Lacquer Garden, Dragon Show, Tường Vân, Nón Quai Thao & Thổ Cẩm
// ---------------------------------------------------------------------------

function buildFestivalArtAndBrocade(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): {
  festivalGroupRefs: THREE.Object3D[];
  fireShowMesh: THREE.Mesh;
} {
  const festTime = { uTime: { value: 0 } };
  animList.push(festTime);
  const festivalGroupRefs: THREE.Object3D[] = [];

  // 1. Lacquer Karst Garden (`LacquerKarstGarden` at (335, 32))
  const lacGroup = new THREE.Group();
  lacGroup.name = 'LacquerKarstGarden';
  const peakParts: THREE.BufferGeometry[] = [];
  const jadeParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const px = 318 + i * 5.6;
    const pz = 32 + Math.sin(i * 1.4) * 5;
    const h = 6.5 + (i % 3) * 3.8;
    const peak = createSculptedRockGeometry(505 + i, 2.4, h * 0.55, 2.2, 2);
    peak.translate(px, ctx.getHeight(px, pz) + h * 0.35, pz);
    peakParts.push(peak);
    if (i < 5) {
      const jc = new THREE.SphereGeometry(1.75, 10, 8);
      jc.scale(1.8, 0.75, 1.1);
      jc.translate(px + 1.5, ctx.getHeight(px, pz) + 3.2 + (i % 2) * 1.8, pz + 3.0);
      jadeParts.push(jc);
    }
  }
  const lacquerPeakMat = new THREE.MeshPhysicalMaterial({
    color: '#a4221b',
    roughness: 0.22,
    clearcoat: 0.8,
    clearcoatRoughness: 0.16
  });
  lacquerPeakMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNorm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNorm;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 wBlend = abs(normalize(vWorldNorm));
         wBlend = pow(wBlend, vec3(3.0));
         wBlend /= max(wBlend.x + wBlend.y + wBlend.z, 0.0001);
         float waveY = sin(vWorldPos.x * 0.22 + vWorldPos.z * 0.19) * 0.45;
         float bandY = fract((vWorldPos.y + waveY) * 0.42);
         float bandXZ = fract((vWorldPos.x * 0.18 + vWorldPos.z * 0.18 + vWorldPos.y * 0.35));
         float lineY = 1.0 - smoothstep(0.0, 0.065, abs(bandY - 0.5) - 0.435);
         float lineXZ = 1.0 - smoothstep(0.0, 0.055, abs(bandXZ - 0.5) - 0.445);
         float goldLine = clamp(lineY * (0.72 + 0.28 * wBlend.y) + lineXZ * 0.45 * (1.0 - wBlend.y), 0.0, 1.0);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.64, 0.23), goldLine * 0.85);`
      );
  };
  ctx.extraMaterials.push(lacquerPeakMat);
  lacGroup.add(new THREE.Mesh(mergeNormalized(peakParts), lacquerPeakMat));

  const jadeCloudMat = new THREE.MeshStandardMaterial({
    color: '#5bbf6a',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.25,
    roughness: 0.28
  });
  ctx.extraMaterials.push(jadeCloudMat);
  lacGroup.add(new THREE.Mesh(mergeNormalized(jadeParts), jadeCloudMat));
  ctx.scene.add(lacGroup);

  // 2. Dragon Bridge Fire Show (`DragonBridgeFireShow` at (335, -35))
  const dragonShowGroup = new THREE.Group();
  dragonShowGroup.name = 'DragonBridgeFireShow';
  const dbY = Math.max(ctx.getHeight(335, -35), VIETNAM_WATER_LEVEL) + 18.0;
  const fireCone = new THREE.ConeGeometry(3.2, 16.0, 12, 1, true);
  fireCone.rotateZ(-Math.PI * 0.5);
  const fireMat = new THREE.MeshBasicMaterial({
    color: '#ff7a2a',
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(fireMat);
  const fireMesh = new THREE.Mesh(fireCone, fireMat);
  fireMesh.position.set(348, dbY, -35);
  dragonShowGroup.add(fireMesh);

  const haloMesh = new THREE.Mesh(new THREE.RingGeometry(11.5, 13.5, 36), ctx.materials.gold);
  haloMesh.position.set(335, dbY + 4.0, -48);
  dragonShowGroup.add(haloMesh);
  ctx.scene.add(dragonShowGroup);

  // 3. Floating Kinh Bắc Nón Quai Thao (`FestivalNonQuaiThaoDrift`) — flat-crown wide hats with radial ribs & red silk ribbons (HV04-2)
  const nonGroup = new THREE.Group();
  nonGroup.name = 'FestivalNonQuaiThaoDrift';
  const coreHatParts: THREE.BufferGeometry[] = [];
  const hatTop = new THREE.CylinderGeometry(0.68, 0.72, 0.08, 12);
  const hatFlatCrown = new THREE.CylinderGeometry(0.24, 0.26, 0.05, 10);
  hatFlatCrown.translate(0, 0.06, 0);
  const hatRim = new THREE.CylinderGeometry(0.72, 0.68, 0.16, 12, 1, true);
  hatRim.translate(0, -0.09, 0);
  coreHatParts.push(
    paintGeometryVertexColor(hatTop, '#f2d99b'),
    paintGeometryVertexColor(hatFlatCrown, '#e5c172'),
    paintGeometryVertexColor(hatRim, '#d9b568')
  );
  for (let rb = 0; rb < 8; rb++) {
    const a = (rb / 8) * Math.PI;
    const rib = new THREE.BoxGeometry(0.022, 0.018, 1.38);
    rib.rotateY(a);
    rib.translate(0, -0.05, 0);
    coreHatParts.push(paintGeometryVertexColor(rib, '#f7d88a'));
  }
  const coreSling = new THREE.TorusGeometry(0.46, 0.032, 3, 8, Math.PI);
  coreSling.rotateZ(Math.PI);
  coreSling.translate(0, -0.10, 0);
  coreHatParts.push(paintGeometryVertexColor(coreSling, '#dc182c'));
  for (const side of [-1, 1]) {
    const rCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.44, -0.12, 0),
      new THREE.Vector3(side * 0.54, -0.75, 0.14),
      new THREE.Vector3(side * 0.36, -1.55, -0.12),
      new THREE.Vector3(side * 0.48, -2.25, 0.08)
    ]);
    const rGeo = new THREE.TubeGeometry(rCurve, 4, 0.044, 3, false);
    rGeo.scale(1.0, 1.0, 0.35);
    coreHatParts.push(paintGeometryVertexColor(rGeo, '#e01828'));
  }
  const hatGeo = mergeNormalized(coreHatParts);
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#ffe0a0'),
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide
  });
  nonMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = festTime.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 nPos = vec3(0.0);
       #ifdef USE_INSTANCING
       nPos = vec3(instanceMatrix[3].xyz);
       #endif
       transformed.y += sin(uTime * 0.9 + nPos.x * 0.2 + nPos.z * 0.2) * 1.1;`
    );
  };
  ctx.extraMaterials.push(nonMat);
  const nonInst = new THREE.InstancedMesh(hatGeo, nonMat, 36);
  const rand = mulberry32(50505);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const rad = 28 + rand() * 44;
    setInstanceMatrix(
      nonInst,
      i,
      335 + Math.cos(a) * rad,
      24 + rand() * 24,
      -35 + Math.sin(a) * rad,
      0.28,
      a,
      0.18,
      1.6,
      1.6,
      1.6
    );
  }
  nonInst.instanceMatrix.needsUpdate = true;
  nonGroup.add(nonInst);
  ctx.scene.add(nonGroup);

  // 4. Sculpted Multi-Scroll Tường Vân Cloud Motifs & Giant Tilted Nón Lá (`FestivalTuongVanClouds`)
  const tvGroup = new THREE.Group();
  tvGroup.name = 'FestivalTuongVanClouds';
  const tvParts: THREE.BufferGeometry[] = [];
  for (const [ox, oy, rad] of [[-1.6, 0.0, 1.4], [0.0, 0.55, 1.8], [1.6, -0.05, 1.35]] as Array<[number, number, number]>) {
    const puff = new THREE.SphereGeometry(rad, 12, 8);
    puff.scale(1.45, 0.52, 0.42);
    puff.translate(ox, oy, 0);
    tvParts.push(puff);
  }
  const scrollGeo = mergeNormalized(tvParts);
  const tvMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.45,
    roughness: 0.45
  });
  ctx.extraMaterials.push(tvMat);
  const tvInst = new THREE.InstancedMesh(scrollGeo, tvMat, 28);
  const tvColors = [new THREE.Color('#2bb3b1'), new THREE.Color('#c8102e'), new THREE.Color('#d4a43a')];
  for (let i = 0; i < 28; i++) {
    const onEastBridge = i < 14;
    const anchorX = onEastBridge ? 335 : -405;
    const anchorZ = onEastBridge ? -35 : 42;
    const ang = (i / 14) * Math.PI * 2;
    const dist = 24 + (i % 4) * 16;
    setInstanceMatrix(
      tvInst,
      i,
      anchorX + Math.cos(ang) * dist,
      28 + (i % 5) * 6.5,
      anchorZ + Math.sin(ang) * dist,
      0,
      -ang,
      0,
      1.6,
      1.2,
      1.0
    );
    tvInst.setColorAt(i, tvColors[i % tvColors.length]);
  }
  tvInst.instanceMatrix.needsUpdate = true;
  if (tvInst.instanceColor) tvInst.instanceColor.needsUpdate = true;
  tvGroup.add(tvInst);

  // Tilted Giant Conical Nón Lá centerpiece near Tây Nguyên plaza (authentic h = 0.90*r ratio — HV05-1)
  const coreNonLaMat = new THREE.MeshStandardMaterial({
    color: '#ebe3d2',
    map: ctx.pbr.bambooWeave?.map ?? ctx.pbr.timber.map,
    roughness: 0.68,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(coreNonLaMat);
  const giantNon = new THREE.Mesh(
    new THREE.ConeGeometry(4.2, 3.8, 28, 1, true),
    coreNonLaMat
  );
  giantNon.position.set(-405, ctx.getHeight(-405, 42) + 12.6, 42);
  giantNon.rotation.set(0.42, 0.3, 0.15);
  tvGroup.add(giantNon);
  ctx.scene.add(tvGroup);
  festivalGroupRefs.push(nonGroup, tvGroup);

  // 5. Tây Nguyên Thổ Cẩm Brocade Banners & Cột Nêu (`TayNguyenBrocadeBanners` at (-405, 42))
  const brocGroup = new THREE.Group();
  brocGroup.name = 'TayNguyenBrocadeBanners';
  const brocTex =
    ctx.cachedTextures?.brocade ??
    (() => {
      const t = createBrocadeTexture(ctx.renderer);
      ctx.extraTextures.push(t);
      return t;
    })();
  const brocMat = new THREE.MeshStandardMaterial({
    map: brocTex,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(brocMat);
  // FIX HV05-5: Grounded twin wooden support poles & horizontal hanging crossbars + gentle wind-ripple contour on all 14 TayNguyenBrocadeBanners!
  const bannerGeo = new THREE.PlaneGeometry(0.95, 6.2, 2, 10);
  const bp = bannerGeo.attributes.position;
  for (let vi = 0; vi < bp.count; vi++) {
    const yv = (bp.getY(vi) + 3.1) / 6.2;
    bp.setZ(vi, Math.sin(yv * Math.PI * 2.5) * 0.14 * (1.0 - yv * 0.5));
  }
  bannerGeo.computeVertexNormals();
  const bannerInst = new THREE.InstancedMesh(bannerGeo, brocMat, 14);
  const bannerFrameParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const bx = -405 + Math.cos(a) * 18;
    const bz = 42 + Math.sin(a) * 18;
    const by = ctx.getHeight(bx, bz);
    const yaw = -a + Math.PI * 0.5;
    setInstanceMatrix(bannerInst, i, bx, by + 4.2, bz, 0, yaw, 0, 1, 1, 1);
    // Horizontal top & bottom wooden dowel crossbars + grounded upright pole
    const topBar = new THREE.CylinderGeometry(0.04, 0.04, 1.25, 5);
    topBar.rotateZ(Math.PI * 0.5);
    topBar.rotateY(yaw);
    topBar.translate(bx, by + 7.35, bz);
    const botBar = new THREE.CylinderGeometry(0.035, 0.035, 1.15, 5);
    botBar.rotateZ(Math.PI * 0.5);
    botBar.rotateY(yaw);
    botBar.translate(bx, by + 1.08, bz);
    const pole = new THREE.CylinderGeometry(0.055, 0.07, 7.6, 5);
    pole.translate(bx - Math.sin(yaw) * 0.14, by + 3.8, bz - Math.cos(yaw) * 0.14);
    bannerFrameParts.push(topBar, botBar, pole);
  }
  bannerInst.instanceMatrix.needsUpdate = true;
  brocGroup.add(bannerInst, new THREE.Mesh(mergeNormalized(bannerFrameParts), ctx.materials.darkWood));

  // 12m Cột nêu ceremonial pole
  const nx = -396;
  const nz = 42;
  const ny = ctx.getHeight(nx, nz);
  const cotNeu = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 12.0, 10), ctx.materials.darkWood);
  cotNeu.position.set(nx, ny + 6.0, nz);
  brocGroup.add(cotNeu);
  ctx.scene.add(brocGroup);

  return { festivalGroupRefs, fireShowMesh: fireMesh };
}

// ---------------------------------------------------------------------------
// Spec 06: 1:1 Đông Sơn Drum Replica (17, 16) & Mekong Banana Garden (-95, 320)
// ---------------------------------------------------------------------------

function buildDongSonReplicaAndMekongGarden(ctx: VietnamBuilderContext): void {
  // 1. 1:1 Ngọc Lũ Drum Replica (`DongSonDrumReplica`) at (34, 72)
  const dx = 34.0;
  const dz = 72.0;
  const dy = ctx.getHeight(dx, dz);
  const drumGroup = new THREE.Group();
  drumGroup.name = 'DongSonDrumReplica';

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 1.25), ctx.materials.stone);
  plinth.position.set(dx, dy + 0.45, dz);
  drumGroup.add(plinth);

  const profile = [
    new THREE.Vector2(0.40, 0.0),
    new THREE.Vector2(0.32, 0.30),
    new THREE.Vector2(0.43, 0.50),
    new THREE.Vector2(0.395, 0.63)
  ];
  const bodyGeo = new THREE.LatheGeometry(profile, 32);
  const bodyMesh = new THREE.Mesh(bodyGeo, ctx.materials.bronze);
  bodyMesh.position.set(dx, dy + 0.9, dz);
  drumGroup.add(bodyMesh);

  const drumTex =
    ctx.cachedTextures?.dongSon ??
    (() => {
      const t = createDongSonBronzeTextures(512, ctx.renderer);
      ctx.extraTextures.push(t.map, t.normalMap, t.roughnessMap);
      return t;
    })();
  const faceMat = new THREE.MeshStandardMaterial({
    map: drumTex.map,
    normalMap: drumTex.normalMap,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughnessMap: drumTex.roughnessMap,
    roughness: 0.45,
    metalness: 0.85
  });
  ctx.extraMaterials.push(faceMat);
  const faceMesh = new THREE.Mesh(new THREE.CircleGeometry(0.395, 32), faceMat);
  faceMesh.rotation.x = -Math.PI / 2;
  faceMesh.position.set(dx, dy + 1.535, dz);
  drumGroup.add(faceMesh);
  ctx.scene.add(drumGroup);

  // 2. Mekong Banana Garden (`MekongBananaGarden`) & Nipa Thatch Pavilion (`NipaThatchPavilion`) at (-175, 340)
  const mx = -175;
  const mz = 340;
  ctx.exclusionCircles.push({ x: mx, z: mz, r: 18 });

  const bananaGroup = new THREE.Group();
  bananaGroup.name = 'MekongBananaGarden';
  const bananaParts: THREE.BufferGeometry[] = [];
  for (let l = 0; l < 8; l++) {
    const leaf = new THREE.PlaneGeometry(0.46, 2.1, 2, 5);
    const bp = leaf.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const t = clamp01((bp.getY(v) + 1.05) / 2.1);
      bp.setZ(v, t * t * 0.85);
      bp.setY(v, (bp.getY(v) + 1.05) * 0.82);
    }
    leaf.computeVertexNormals();
    leaf.rotateX(0.42);
    leaf.rotateY((l / 8) * Math.PI * 2);
    leaf.translate(0, 2.7, 0);
    bananaParts.push(leaf);
  }
  const stem = new THREE.CylinderGeometry(0.11, 0.15, 2.8, 7);
  stem.translate(0, 1.4, 0);
  bananaParts.push(stem);
  const bananaGeo = mergeNormalized(bananaParts);
  const bananaMat = new THREE.MeshStandardMaterial({
    color: '#4c7a3a',
    roughness: 0.62,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(bananaMat);
  const bananaInst = new THREE.InstancedMesh(bananaGeo, bananaMat, 36);
  const rand = mulberry32(60606);
  for (let i = 0; i < 36; i++) {
    const bx = mx + (rand() - 0.5) * 26;
    const bz = mz + (rand() - 0.5) * 22;
    const by = Math.max(ctx.getHeight(bx, bz), VIETNAM_WATER_LEVEL + 0.15);
    const sc = 0.85 + rand() * 0.45;
    setInstanceMatrix(bananaInst, i, bx, by, bz, 0, rand() * 6.28, 0, sc, sc, sc);
  }
  bananaInst.instanceMatrix.needsUpdate = true;
  bananaGroup.add(bananaInst);

  // Green banana bunches & purple banana flowers
  const bunchGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.72, 8);
  const bunchMat = ctx.materialLib?.getOrCreateStandard({ color: '#3f7236', roughness: 0.58, side: THREE.DoubleSide }) ?? ctx.materials.darkWood;
  const flowerMat = ctx.materials.crimsonLacquer;
  const bunchInst = new THREE.InstancedMesh(bunchGeo, bunchMat, 18);
  const bFlowerInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.30, 8), flowerMat, 18);
  for (let i = 0; i < 18; i++) {
    const bx = mx + (rand() - 0.5) * 22;
    const bz = mz + (rand() - 0.5) * 18;
    const by = Math.max(ctx.getHeight(bx, bz), VIETNAM_WATER_LEVEL + 0.15) + 2.2;
    setInstanceMatrix(bunchInst, i, bx + 0.25, by, bz, 0, 0, 0, 1, 1, 1);
    setInstanceMatrix(bFlowerInst, i, bx + 0.25, by - 0.48, bz, Math.PI, 0, 0, 1, 1, 1);
  }
  bunchInst.instanceMatrix.needsUpdate = true;
  bFlowerInst.instanceMatrix.needsUpdate = true;
  bananaGroup.add(bunchInst, bFlowerInst);
  ctx.scene.add(bananaGroup);

  // 3. Nipa Thatch Pavilion with 14 concentric ring-shingle ceiling layers (`NipaThatchPavilion`)
  const pavGroup = new THREE.Group();
  pavGroup.name = 'NipaThatchPavilion';
  const px = mx + 6;
  const pz = mz + 6;
  const py = Math.max(ctx.getHeight(px, pz), VIETNAM_WATER_LEVEL + 0.2);
  const pavPosts: THREE.BufferGeometry[] = [];
  const pavThatch: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addCylPart(pavPosts, 0.10, 0.12, 3.0, 7, px + Math.cos(a) * 3.8, py + 1.5, pz + Math.sin(a) * 3.8);
  }
  for (let r = 0; r < 14; r++) {
    const radOuter = 4.6 - r * 0.28;
    const radInner = Math.max(0.15, radOuter - 0.32);
    const ringY = py + 2.9 + r * 0.18;
    const cone = new THREE.CylinderGeometry(radInner, radOuter, 0.22, 18, 1, true);
    cone.translate(px, ringY, pz);
    pavThatch.push(cone);
  }
  const thatchMat = ctx.materials.thatchFiber ?? ctx.materials.darkWood;
  pavGroup.add(new THREE.Mesh(mergeNormalized(pavPosts), ctx.materials.darkWood));
  pavGroup.add(new THREE.Mesh(mergeNormalized(pavThatch), thatchMat));
  ctx.scene.add(pavGroup);
}

// ---------------------------------------------------------------------------
// Spec 07: Heroic Cliff Relief (-195, -210) & Memory Gallery (0, -92)
// ---------------------------------------------------------------------------

function buildHeroicReliefAndMemoryGallery(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
  // 1. Đền Hùng Heroic Cliff Bas-Relief (`DenHungHeroicCliffRelief`)
  const rx = -195;
  const rz = -226;
  const ry = ctx.getHeight(rx, rz) - 1.5;
  const reliefGroup = new THREE.Group();
  reliefGroup.name = 'DenHungHeroicCliffRelief';

  const wallGeo = new THREE.PlaneGeometry(38, 16, 48, 22);
  const wPos = wallGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const ux = wPos.getX(i) / 38 + 0.5; // 0..1
    const uy = wPos.getY(i) / 16 + 0.5;
    const figWave = Math.max(0, Math.sin(ux * Math.PI * 7.0)) * (uy > 0.2 && uy < 0.78 ? 1.0 : 0.2);
    const strata = noise2D(ux * 10.0, uy * 6.0, 707);
    const dz = figWave * 0.75 + strata * 0.55;
    wPos.setZ(i, dz);
  }
  wallGeo.computeVertexNormals();
  wallGeo.translate(rx, ry + 8.0, rz);
  const reliefMat = new THREE.MeshStandardMaterial({
    color: '#7a5d42',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    normalScale: new THREE.Vector2(2.2, 2.2),
    roughness: 0.72,
    metalness: 0.25
  });
  ctx.extraMaterials.push(reliefMat);
  reliefGroup.add(new THREE.Mesh(wallGeo, reliefMat));

  // Suspended bronze conical nón lá 16-rib open lattice crest above relief
  const crestParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = new THREE.CylinderGeometry(0.03, 0.04, 2.9, 5);
    rib.rotateZ(0.88);
    rib.rotateY(a);
    rib.translate(rx + Math.cos(a) * 1.15, ry + 15.2, rz + 2.6 + Math.sin(a) * 1.15);
    crestParts.push(rib);
  }
  reliefGroup.add(new THREE.Mesh(mergeNormalized(crestParts), ctx.materials.gold));
  ctx.scene.add(reliefGroup);

  // 2. Historical Memory Gallery (`HoangThanhMemoryGallery`) behind Đoan Môn at (0, -92)
  const galGroup = new THREE.Group();
  galGroup.name = 'HoangThanhMemoryGallery';
  const filmTex =
    ctx.cachedTextures?.filmstrip ??
    (() => {
      const t = createFilmstripArchivalTexture(ctx.renderer);
      ctx.extraTextures.push(t);
      return t;
    })();
  const filmMat = new THREE.MeshStandardMaterial({
    map: filmTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: filmTex,
    emissiveIntensity: 0.45,
    roughness: 0.35
  });
  filmMat.userData.noDedupe = true;
  ctx.extraMaterials.push(filmMat);

  const steleFrame = new THREE.InstancedMesh(new THREE.BoxGeometry(1.48, 7.6, 0.16), ctx.materials.darkWood, 8);
  const stelePanel = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.36, 7.2), filmMat, 8);
  // FIX HT-01: Relocate HoangThanhMemoryGallery cleanly to flat West Heritage Park ground (-72, -74) so it sits on level terrain clear of mountain bluffs!
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const sx = -72.0 + side * (5.5 + k * 2.0);
    const sz = -72.0 - k * 3.5;
    const sy = ctx.getHeight(sx, sz);
    const yaw = side * -0.22;
    setInstanceMatrix(steleFrame, i, sx, sy + 3.8, sz, 0, yaw, 0, 1, 1, 1);
    setInstanceMatrix(stelePanel, i, sx + Math.sin(yaw) * 0.09, sy + 3.8, sz + Math.cos(yaw) * 0.09, 0, yaw, 0, 1, 1, 1);
  }
  steleFrame.instanceMatrix.needsUpdate = true;
  stelePanel.instanceMatrix.needsUpdate = true;
  steleFrame.computeBoundingBox();
  stelePanel.computeBoundingBox();
  galGroup.add(steleFrame, stelePanel);
  ctx.scene.add(galGroup);

  return filmMat;
}

// ---------------------------------------------------------------------------
// Spec 08: Festival Volumetric Beams & Tropical Monsoon Rain System
// ---------------------------------------------------------------------------

function buildAtmosphereEffects(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): {
  beamsMat: THREE.ShaderMaterial;
  beamsGroup: THREE.Group;
  rainMat: THREE.ShaderMaterial;
  rainGroup: THREE.Group;
} {
  const fxTime = { uTime: { value: 0 } };
  animList.push(fxTime);

  // 1. Crossed Cobalt & Crimson Volumetric Festival Beams (`VietnamFestivalLightBeams`, physically flaring upward from 0.42m pedestal lens — HV08-1)
  const beamsGroup = new THREE.Group();
  beamsGroup.name = 'VietnamFestivalLightBeams';
  const beamGeo = new THREE.CylinderGeometry(4.8, 0.42, 38.0, 24, 1, true);
  beamGeo.translate(0, 19.0, 0);
  const beamsMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: fxTime.uTime,
      uIntensity: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormV;
      varying vec3 vViewP;
      varying vec3 vInstCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
        vInstCol = instanceColor;
        #else
        vInstCol = vec3(0.12, 0.36, 1.0);
        #endif
        vec4 mvPos = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
        mvPos = instanceMatrix * mvPos;
        n = mat3(instanceMatrix) * n;
        #endif
        mvPos = modelViewMatrix * mvPos;
        vNormV = normalize(normalMatrix * n);
        vViewP = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormV;
      varying vec3 vViewP;
      varying vec3 vInstCol;
      void main() {
        if (uIntensity <= 0.01) discard;
        vec3 vDir = normalize(vViewP + vec3(0.0, 0.0, 0.0001));
        float edgeFade = pow(clamp(abs(dot(normalize(vNormV), vDir)), 0.0, 1.0), 2.2);
        float vertFade = smoothstep(0.0, 0.14, vUv.y) * pow(smoothstep(1.0, 0.08, vUv.y), 1.35);
        float shimmer = 0.85 + 0.15 * sin(vUv.y * 16.0 - uTime * 0.9);
        float alpha = edgeFade * vertFade * shimmer * clamp(uIntensity, 0.0, 1.5) * 0.32;
        gl_FragColor = vec4(vInstCol * uIntensity * edgeFade * vertFade, alpha);
      }
    `
  });
  ctx.extraMaterials.push(beamsMat);
  const beamSlots: Array<[number, number, number]> = [
    [-16, -4, 0.38],
    [16, -4, -0.38],
    [-22, -68, 0.42],
    [22, -68, -0.42],
    [-10, -76, -0.32],
    [10, -76, 0.32],
    // Removed [165, 45] & [185, 45] sci-fi spotlights over Hội An Chùa Cầu (CC-30 & HA-29!)
    // Outer Grand Cultural Sanctuaries (Ref 12 global festival uplight shafts)
    [-660, 56, 0.36],
    [-660, 104, -0.36],
    [624, 140, 0.38],
    [656, 140, -0.38],
    [-34, -560, 0.40],
    [34, -560, -0.40],
    [802, -80, 0.36],
    [838, -80, -0.36],
    [-862, 120, 0.34],
    [-818, 120, -0.34],
    [-698, 420, 0.38],
    [-662, 420, -0.38],
    [-26, -308, 0.34],
    [26, -308, -0.34],
    [-660, -180, 0.35],
    [-620, -180, -0.35]
  ];
  const beamInst = new THREE.InstancedMesh(beamGeo, beamsMat, beamSlots.length);
  const pedGeo = new THREE.CylinderGeometry(0.48, 0.62, 0.45, 10);
  const pedInst = new THREE.InstancedMesh(pedGeo, ctx.materials.bronze, beamSlots.length);
  // FIX HV08-4: Glowing bright spotlight emitter lens cores seated atop all 24 festival stage beam projectors (24-segment cones + bright emitter orbs!)
  const lensGeo = new THREE.SphereGeometry(0.32, 6, 4);
  lensGeo.scale(1.0, 0.55, 1.0);
  const lensInst = new THREE.InstancedMesh(lensGeo, ctx.materials.lanternCore ?? ctx.materials.gold, beamSlots.length);
  const blueCol = new THREE.Color('#1e5bff');
  const redCol = new THREE.Color('#e02424');
  for (let i = 0; i < beamSlots.length; i++) {
    const [bx, bz, tiltZ] = beamSlots[i];
    const by = Math.max(ctx.getHeight(bx, bz), VIETNAM_WATER_LEVEL + 0.15);
    setInstanceMatrix(beamInst, i, bx, by + 0.45, bz, 0, (i % 4) * 0.25, tiltZ, 1, 1.18, 1);
    setInstanceMatrix(pedInst, i, bx, by + 0.22, bz, 0, 0, 0, 1, 1, 1);
    setInstanceMatrix(lensInst, i, bx, by + 0.46, bz, 0, 0, 0, 1, 1, 1);
    beamInst.setColorAt(i, i % 2 === 0 ? blueCol : redCol);
  }
  beamInst.instanceMatrix.needsUpdate = true;
  pedInst.instanceMatrix.needsUpdate = true;
  lensInst.instanceMatrix.needsUpdate = true;
  if (beamInst.instanceColor) beamInst.instanceColor.needsUpdate = true;
  beamsGroup.add(lensInst);

  // FIX HV08-2: Layered volumetric crimson-cobalt stage haze billboards + warm floor light-bounce discs at focal festival plazas (ref 12!)
  const stageHazeAlpha = createSoftRadialAlphaTexture(ctx, 64);
  const stageHazeMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    alphaMap: stageHazeAlpha,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(stageHazeMat);
  const hazeAnchors: Array<[number, number, string]> = [
    [0, -4, '#ff3a66'],
    [-8, -68, '#2868ff'],
    [8, -68, '#ff2848'],
    [175, 45, '#ff4872'],
    [-680, 420, '#ff3c4e'],
    [-660, 80, '#2a6eff'],
    [640, 140, '#ff4c82'],
    [0, -308, '#2466ff'],
    [-840, 120, '#ff3242'],
    [820, -80, '#2872ff'],
    [-640, -180, '#ff5238'],
    [0, -560, '#2e6dff']
  ];
  const hazeInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(18, 10), stageHazeMat, hazeAnchors.length);
  const bounceDiscGeo = new THREE.CircleGeometry(9.0, 20);
  bounceDiscGeo.rotateX(-Math.PI * 0.5);
  const bounceInst = new THREE.InstancedMesh(bounceDiscGeo, stageHazeMat, hazeAnchors.length);
  for (let i = 0; i < hazeAnchors.length; i++) {
    const [hx, hz, hHex] = hazeAnchors[i];
    const hy = Math.max(ctx.getHeight(hx, hz), VIETNAM_WATER_LEVEL + 0.12);
    setInstanceMatrix(hazeInst, i, hx, hy + 5.2, hz, 0, (i % 4) * 0.78, 0, 1, 1, 1);
    setInstanceMatrix(bounceInst, i, hx, hy + 0.08, hz, 0, 0, 0, 1, 1, 1);
    hazeInst.setColorAt(i, new THREE.Color(hHex));
    bounceInst.setColorAt(i, new THREE.Color('#ffe0ec'));
  }
  hazeInst.instanceMatrix.needsUpdate = true;
  bounceInst.instanceMatrix.needsUpdate = true;
  if (hazeInst.instanceColor) hazeInst.instanceColor.needsUpdate = true;
  if (bounceInst.instanceColor) bounceInst.instanceColor.needsUpdate = true;

  beamsGroup.add(beamInst, pedInst, hazeInst, bounceInst);
  ctx.scene.add(beamsGroup);

  // 2. Tropical Monsoon Slanted Rain System (`VietnamMonsoonRainSystem`, 3,500 camera-wrapped streaks)
  const rainGroup = new THREE.Group();
  rainGroup.name = 'VietnamMonsoonRainSystem';
  const rainQuad = new THREE.PlaneGeometry(0.030, 0.78);
  const rainMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: fxTime.uTime,
      uCamPos: { value: new THREE.Vector3(0, 2.2, 58) },
      uRainAlpha: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCamPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 base = vec3(0.0);
        #ifdef USE_INSTANCING
        base = vec3(instanceMatrix[3].xyz);
        #endif
        vec3 wrapped = mod(base - uCamPos + vec3(32.0, 18.0, 32.0), vec3(64.0, 36.0, 64.0)) - vec3(32.0, 18.0, 32.0);
        float drop = mod(uTime * 11.5 + base.x * 0.7 + base.z * 0.5, 36.0);
        wrapped.y = mod(wrapped.y - drop + 18.0, 36.0) - 18.0;
        // 20.8-degree monsoon wind slant
        vec3 worldCenter = uCamPos + wrapped;
        vec3 offset = position;
        offset.x += offset.y * 0.38;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldCenter + offset, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRainAlpha;
      varying vec2 vUv;
      void main() {
        if (uRainAlpha <= 0.01) discard;
        vec2 p = vUv - vec2(0.5, clamp(vUv.y, 0.15, 0.85));
        float dist = length(p * vec2(2.0, 1.0));
        float soft = smoothstep(0.5, 0.05, dist);
        if (soft <= 0.01) discard;
        gl_FragColor = vec4(vec3(0.86, 0.93, 1.0), soft * uRainAlpha * 0.42);
      }
    `
  });
  ctx.extraMaterials.push(rainMat);
  const rainCount = 3500;
  const rainInst = new THREE.InstancedMesh(rainQuad, rainMat, rainCount);
  const rand = mulberry32(80808);
  for (let i = 0; i < rainCount; i++) {
    setInstanceMatrix(rainInst, i, rand() * 64, rand() * 36, rand() * 64, 0, rand() * 3.14, 0, 1, 1, 1);
  }
  rainInst.instanceMatrix.needsUpdate = true;
  rainGroup.add(rainInst);
  ctx.scene.add(rainGroup);

  return { beamsMat, beamsGroup, rainMat, rainGroup };
}

// ---------------------------------------------------------------------------
// Spec 09: Điện Biên Mountain Bastion (-300, -255) & Bạch Đằng Estuary (-120, -400)
// ---------------------------------------------------------------------------

function buildDienBienAndBachDang(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
  // 1. Điện Biên Highland Bastion (`DienBienMountainBastion`) at (-300, -255)
  const dbx = -300;
  const dbz = -255;
  ctx.exclusionCircles.push({ x: dbx, z: dbz, r: 28 });

  const dbGroup = new THREE.Group();
  dbGroup.name = 'DienBienMountainBastion';
  const cragParts: THREE.BufferGeometry[] = [];
  const timberParts: THREE.BufferGeometry[] = [];
  const cragOffsets: Array<[number, number, number]> = [
    [-22, -22, 34],
    [0, -32, 42],
    [24, -20, 32],
    [-34, -8, 26],
    [32, -8, 28]
  ];
  for (let i = 0; i < cragOffsets.length; i++) {
    const [dx, dz, h] = cragOffsets[i];
    const gx = dbx + dx;
    const gz = dbz + dz;
    const rock = createSculptedRockGeometry(900 + i, 14, h * 0.65, 13, 2);
    rock.translate(gx, ctx.getHeight(gx, gz) + h * 0.25, gz);
    cragParts.push(rock);
  }
  // FIX DBP-03: Authentic Northwest red-basalt highland earth-rock (#6b533e) instead of sci-fi navy blue #253658!
  const cragMat = new THREE.MeshStandardMaterial({
    color: '#6b533e',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.90
  });
  ctx.extraMaterials.push(cragMat);
  dbGroup.add(new THREE.Mesh(mergeNormalized(cragParts), cragMat));

  // 2 Timber log-crib command bunkers
  for (const [bx, bz] of [[dbx - 7, dbz - 4], [dbx + 8, dbz - 6]]) {
    const by = ctx.getHeight(bx, bz);
    addBoxPart(timberParts, 5.2, 1.8, 3.8, bx, by + 0.9, bz);
    addBoxPart(timberParts, 5.8, 0.55, 4.4, bx, by + 2.05, bz);
  }
  dbGroup.add(new THREE.Mesh(mergeNormalized(timberParts), ctx.materials.darkWood));

  // FIX DBP-04: Rounded pillow-shaped burlap sandbags along core Điện Biên crescent parapet (replacing sharp bricks!)
  const bagGeo = new THREE.SphereGeometry(0.28, 5, 3);
  bagGeo.scale(1.15, 0.42, 0.72);
  const bagMat = ctx.materials.ochreSand ?? ctx.materials.stone;
  const bagInst = new THREE.InstancedMesh(bagGeo, bagMat, 180);
  const rand = mulberry32(90909);
  for (let i = 0; i < 180; i++) {
    const layer = Math.floor(i / 45);
    const slot = i % 45;
    const ang = -0.95 + (slot / 44) * 1.9;
    const rad = 16.5;
    const sx = dbx + Math.sin(ang) * rad;
    const sz = dbz + Math.cos(ang) * rad;
    const sy = ctx.getHeight(sx, sz) + 0.12 + layer * 0.17;
    setInstanceMatrix(bagInst, i, sx, sy, sz, 0, -ang + (rand() - 0.5) * 0.1, 0, 1, 1, 1);
  }
  bagInst.instanceMatrix.needsUpdate = true;
  dbGroup.add(bagInst);

  // Crimson flare glow marker
  const flareMat = new THREE.MeshStandardMaterial({
    color: '#ff3b2f',
    emissive: new THREE.Color('#ff3b2f'),
    emissiveIntensity: 0.8
  });
  flareMat.userData.noDedupe = true;
  ctx.extraMaterials.push(flareMat);
  const flareOrb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), flareMat);
  flareOrb.position.set(dbx, ctx.getHeight(dbx, dbz) + 1.4, dbz + 6);
  dbGroup.add(flareOrb);
  ctx.scene.add(dbGroup);

  // 2. Bạch Đằng Naval Estuary & War Junks (`BachDangNavalFleet`) at (-120, -400)
  const bdx = -120;
  const bdz = -400;
  const bdGroup = new THREE.Group();
  bdGroup.name = 'BachDangNavalFleet';

  const redSailTex =
    ctx.cachedTextures?.redEmblemSail ??
    (() => {
      const t = createRedEmblemSailTexture(256, ctx.renderer);
      ctx.extraTextures.push(t);
      return t;
    })();
  const redSailMat = new THREE.MeshStandardMaterial({
    map: redSailTex,
    roughness: 0.80,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(redSailMat);

  const shipOffsets: Array<[number, number, number]> = [
    [0, 0, 1.25], // Hero Flagship War Junk
    [-26, -12, 0.92],
    [28, -14, 0.92],
    [-44, -28, 0.82],
    [46, -26, 0.82]
  ];

  for (let s = 0; s < shipOffsets.length; s++) {
    const [ox, oz, scale] = shipOffsets[s];
    const ship = new THREE.Group();
    const hullParts: THREE.BufferGeometry[] = [];
    // FIX BD-02: Sleek tapered pointed-bow & upswept-stern Đại Việt war junk hull (replacing rectangular brick box!)
    const hullLen = 20 * scale;
    const beam = 4.8 * scale;
    const wHull = new THREE.BoxGeometry(hullLen, 1.85 * scale, beam, 10, 2, 4);
    const wp = wHull.attributes.position;
    for (let vi = 0; vi < wp.count; vi++) {
      const vx = wp.getX(vi);
      const vy = wp.getY(vi);
      const vz = wp.getZ(vi);
      const u = vx / (hullLen * 0.5); // -1 stern .. +1 bow
      const widthPinch = u > 0 ? Math.pow(1.0 - u * 0.92, 0.72) : Math.pow(1.0 + u * 0.55, 0.80);
      const sheerLift = Math.pow(Math.abs(u), 2.1) * (u > 0 ? 1.45 : 1.15) * scale;
      const keelTaper = vy < 0 ? 0.62 : 1.0;
      wp.setXYZ(vi, vx, vy + sheerLift, vz * widthPinch * keelTaper);
    }
    wHull.computeVertexNormals();
    wHull.translate(0, 0.42 * scale, 0);
    hullParts.push(wHull);
    addBoxPart(hullParts, 5.2 * scale, 2.2 * scale, beam * 0.84, -hullLen * 0.28, 2.1 * scale, 0);
    // Curved dragon prow at bow (+X)
    const prowNeck = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hullLen * 0.44, 1.1 * scale, 0),
      new THREE.Vector3(hullLen * 0.54, 2.2 * scale, 0),
      new THREE.Vector3(hullLen * 0.59, 3.3 * scale, 0)
    ]);
    hullParts.push(new THREE.TubeGeometry(prowNeck, 8, 0.36 * scale, 7, false));
    addBoxPart(hullParts, 1.1 * scale, 0.72 * scale, 0.76 * scale, hullLen * 0.62, 3.45 * scale, 0);
    // 2–3 masts (Hero flagship gets 3 masts; escorts get 2 masts)
    const mastDefs: Array<[number, number, number]> =
      s === 0
        ? [
          [-hullLen * 0.22, 11.2 * scale, 0.72],
          [1.0 * scale, 14.8 * scale, 1.0],
          [hullLen * 0.28, 10.6 * scale, 0.68]
        ]
        : [
          [-hullLen * 0.16, 10.5 * scale, 0.72],
          [2.0 * scale, 13.8 * scale, 0.96]
        ];
    for (const [mx, mh, sScale] of mastDefs) {
      addCylPart(hullParts, 0.14 * scale, 0.21 * scale, mh, 8, mx, mh * 0.52, 0);
      // Horizontal bamboo sail battens (5 battens per sail)
      const sailW = 7.6 * scale * sScale;
      const sailH = mh * 0.74;
      for (let bt = 0; bt < 5; bt++) {
        const by = mh * 0.28 + (bt / 4) * sailH;
        addCylPart(hullParts, 0.045 * scale, 0.055 * scale, sailW * 1.06, 5, mx + 0.26 * scale, by, 0, Math.PI * 0.5, 0);
      }
      // FIX BD-02: Wind-billowed curved warship sail (replacing flat PlaneGeometry!)
      const bSailGeo = new THREE.PlaneGeometry(sailW, sailH, 6, 6);
      const bsp = bSailGeo.attributes.position;
      for (let vi = 0; vi < bsp.count; vi++) {
        const xu = bsp.getX(vi) / (sailW * 0.5);
        const yv = bsp.getY(vi) / (sailH * 0.5);
        const puff = Math.cos(xu * Math.PI * 0.5) * Math.cos(yv * Math.PI * 0.5) * 1.15 * scale;
        bsp.setZ(vi, puff);
      }
      bSailGeo.computeVertexNormals();
      const sail = new THREE.Mesh(bSailGeo, redSailMat);
      sail.position.set(mx + 0.32 * scale, mh * 0.28 + sailH * 0.5, 0);
      sail.rotation.y = Math.PI * 0.5;
      ship.add(sail);
    }
    ship.add(new THREE.Mesh(mergeNormalized(hullParts), ctx.materials.darkWood));

    // FIX BD-03: Iron fire-basket + multi-tongue flame plume at bow (replacing static red sphere!)
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.24 * scale, 0.36 * scale, 7), ctx.materials.bronze);
    basket.position.set(hullLen * 0.48, 1.48 * scale, 0);
    const flameTongues: THREE.BufferGeometry[] = [];
    for (let ft = 0; ft < 3; ft++) {
      const a = (ft / 3) * Math.PI * 2;
      const cone = new THREE.ConeGeometry(0.28 * scale, (0.95 + ft * 0.18) * scale, 5);
      cone.rotateZ((ft - 1) * 0.14);
      cone.translate(Math.cos(a) * 0.10 * scale, (0.45 + ft * 0.08) * scale, Math.sin(a) * 0.10 * scale);
      flameTongues.push(paintGeometryVertexColor(cone, ft === 0 ? '#fff0a0' : ft === 1 ? '#ff7b1a' : '#c92212'));
    }
    const flameMatShip = new THREE.MeshBasicMaterial({ vertexColors: true });
    ctx.extraMaterials.push(flameMatShip);
    const brazier = new THREE.Mesh(mergeNormalized(flameTongues), flameMatShip);
    brazier.position.set(hullLen * 0.48, 1.62 * scale, 0);
    ship.add(basket, brazier);

    ship.position.set(bdx + ox, VIETNAM_WATER_LEVEL, bdz + oz);
    ship.rotation.y = Math.PI * 0.5;
    bdGroup.add(ship);

    ctx.junkBoats.push({
      group: ship,
      centerX: bdx + ox,
      centerZ: bdz + oz,
      radiusX: 1.6,
      radiusZ: 1.4,
      speed: 0.22,
      phase: s * 1.3
    });
  }

  // FIX BD-01: 140 Authentic Hand-Hewn Bạch Đằng Ironwood Stakes (*cọc gỗ lim đẽo vát nhọn 0.95m*, matte mud-stained bark, staggered zigzag heights & angles — ref 15!)
  const logPart = new THREE.CylinderGeometry(0.145, 0.21, 3.6, 5, 1, true);
  const bevelTip = new THREE.ConeGeometry(0.145, 0.96, 5);
  // Asymmetrical hand-adzed spear bevel offset slightly off-center
  const tipPos = bevelTip.attributes.position;
  for (let ti = 0; ti < tipPos.count; ti++) {
    if (tipPos.getY(ti) > 0.3) {
      tipPos.setX(ti, tipPos.getX(ti) + 0.06);
    }
  }
  bevelTip.computeVertexNormals();
  bevelTip.translate(0, 2.28, 0);
  const stakeGeo = mergeNormalized([logPart, bevelTip]);
  const stakeMat = ctx.materials.bark;
  const stakeCount = 140;
  const stakeInst = new THREE.InstancedMesh(stakeGeo, stakeMat, stakeCount);

  const foamGeo = new THREE.RingGeometry(0.24, 0.56, 8);
  foamGeo.rotateX(-Math.PI / 2);
  const foamMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  ctx.extraMaterials.push(foamMat);
  const foamInst = new THREE.InstancedMesh(foamGeo, foamMat, stakeCount);

  for (let i = 0; i < stakeCount; i++) {
    const cluster = i % 5;
    const t = i / stakeCount;
    const zigzagZ = Math.sin(t * Math.PI * 5.0) * 6.5;
    const sx = bdx - 52 + t * 104 + (rand() - 0.5) * 5.5;
    const sz = bdz + 18 + cluster * 4.8 + zigzagZ + (rand() - 0.5) * 3.8;
    const tilt = 0.30 + rand() * 0.28; // 18..34 degrees lean against incoming fleet!
    const yVar = -0.35 + rand() * 1.45; // varied tide protrusion heights (0.35m..1.85m above water)
    const scR = 0.84 + rand() * 0.34;
    setInstanceMatrix(stakeInst, i, sx, VIETNAM_WATER_LEVEL + yVar, sz, tilt, (rand() - 0.5) * 0.35, (rand() - 0.5) * 0.14, scR, 1.0, scR);
    setInstanceMatrix(foamInst, i, sx, VIETNAM_WATER_LEVEL + 0.05, sz, 0, 0, 0, scR, 1, scR);
  }
  stakeInst.instanceMatrix.needsUpdate = true;
  foamInst.instanceMatrix.needsUpdate = true;
  bdGroup.add(stakeInst, foamInst);

  ctx.scene.add(bdGroup);
  return flareMat;
}

// ---------------------------------------------------------------------------
// Macro Expansion Builders (4800m × 4800m Outer Cultural Sanctuary Ring)
// ---------------------------------------------------------------------------

function createNonLaLatticeGeometry(radius: number, height: number, ribs = 16, rings = 5): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const slantLen = Math.hypot(radius, height);
  const tilt = Math.atan2(radius, height);
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const rib = new THREE.CylinderGeometry(0.035, 0.05, slantLen, 5);
    rib.translate(0, -slantLen * 0.5, 0);
    rib.rotateZ(tilt);
    rib.rotateY(a);
    rib.translate(0, height, 0);
    parts.push(rib);
  }
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const ring = new THREE.TorusGeometry(radius * t, 0.04, 6, ribs * 2);
    ring.rotateX(Math.PI * 0.5);
    ring.translate(0, height * (1.0 - t), 0);
    parts.push(ring);
  }
  return mergeNormalized(parts);
}

function createTuongVanScrollGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // FIX HV05-3: Multi-color Tường Vân cloud scrolls (fiery crimson-orange -> emerald-cobalt gradient + bright golden #ffd64a scroll borders — ref 09!)
  const puffs: Array<[number, number, number, string]> = [
    [-2.4, -0.1, 1.35, '#ff3b1a'],
    [-0.9, 0.35, 1.65, '#ff9a24'],
    [0.7, 0.72, 1.9, '#12c2dc'],
    [2.1, 0.15, 1.5, '#1b48b8'],
    [3.3, -0.25, 1.05, '#1b48b8']
  ];
  for (const [ox, oy, rad, colHex] of puffs) {
    const puff = new THREE.SphereGeometry(rad, 7, 5);
    puff.scale(1.45, 0.50, 0.38);
    puff.translate(ox, oy, 0);
    parts.push(paintGeometryVertexColor(puff, colHex));
  }
  // Carved golden spiral Tường Vân scroll curls (*viền chỉ vàng xoắn ốc*) & tapering cloud tail
  for (const [sx, sy, sr, rot] of [
    [-3.1, -0.15, 0.72, 0.4],
    [0.55, 0.92, 0.88, -0.2],
    [3.85, -0.35, 0.62, 2.4]
  ] as Array<[number, number, number, number]>) {
    const spiralOuter = new THREE.TorusGeometry(sr, 0.14, 4, 9, Math.PI * 1.45);
    spiralOuter.rotateZ(rot);
    spiralOuter.translate(sx, sy, 0.22);
    const spiralInner = new THREE.TorusGeometry(sr * 0.52, 0.10, 4, 7, Math.PI * 1.35);
    spiralInner.rotateZ(rot + 1.1);
    spiralInner.translate(sx, sy, 0.24);
    parts.push(
      paintGeometryVertexColor(spiralOuter, '#ffd64a'),
      paintGeometryVertexColor(spiralInner, '#ffe878')
    );
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.6, -0.35, 0),
    new THREE.Vector3(-4.8, -0.15, 0),
    new THREE.Vector3(-5.8, -0.52, 0)
  ]);
  parts.push(paintGeometryVertexColor(new THREE.TubeGeometry(tailCurve, 5, 0.18, 4, false), '#ff6822'));
  return mergeNormalized(parts);
}

function createWarJunkHullGeometry(scale: number, mastCount = 3): THREE.BufferGeometry {
  const hullParts: THREE.BufferGeometry[] = [];
  const len = 22 * scale;
  const beam = 5.2 * scale;
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-len * 0.52, 0.4 * scale);
  hullShape.quadraticCurveTo(-len * 0.25, -1.0 * scale, 0, -1.1 * scale);
  hullShape.quadraticCurveTo(len * 0.32, -0.95 * scale, len * 0.54, 0.95 * scale);
  hullShape.lineTo(len * 0.46, 1.55 * scale);
  hullShape.quadraticCurveTo(0, 0.75 * scale, -len * 0.44, 1.35 * scale);
  hullShape.closePath();
  const hull = new THREE.ExtrudeGeometry(hullShape, {
    depth: beam,
    bevelEnabled: true,
    bevelThickness: 0.18 * scale,
    bevelSize: 0.15 * scale,
    bevelSegments: 2
  });
  hull.translate(0, 0.4 * scale, -beam * 0.5);
  hullParts.push(hull);
  // Stern command castle & steering rudder
  addBoxPart(hullParts, 5.8 * scale, 2.2 * scale, beam * 0.86, -len * 0.26, 2.2 * scale, 0);
  addBoxPart(hullParts, 1.8 * scale, 3.2 * scale, 0.24 * scale, -len * 0.52, 0.2 * scale, 0);
  // Swept carved Dragon Prow (*Đầu Rồng mũi chiến thuyền*)
  const dragonNeck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(len * 0.46, 1.55 * scale, 0),
    new THREE.Vector3(len * 0.56, 2.85 * scale, 0),
    new THREE.Vector3(len * 0.62, 4.15 * scale, 0)
  ]);
  hullParts.push(new THREE.TubeGeometry(dragonNeck, 10, 0.42 * scale, 8, false));
  addBoxPart(hullParts, 1.35 * scale, 0.88 * scale, 0.92 * scale, len * 0.65, 4.35 * scale, 0);
  addBoxPart(hullParts, 0.95 * scale, 0.32 * scale, 0.72 * scale, len * 0.69, 3.82 * scale, 0, 0, 0, -0.22);
  for (const s of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.11 * scale, 0.95 * scale, 5);
    horn.rotateZ(0.65);
    horn.translate(len * 0.61, 4.95 * scale, s * 0.32 * scale);
    hullParts.push(horn);
  }
  // 2–3 Masts with upper yardarms & bamboo batten spars
  const mastSpecs: Array<[number, number, number]> =
    mastCount >= 3
      ? [
        [-len * 0.22, 11.8 * scale, 6.8 * scale],
        [1.2 * scale, 16.2 * scale, 10.2 * scale],
        [len * 0.29, 11.4 * scale, 6.4 * scale]
      ]
      : [
        [-len * 0.16, 11.5 * scale, 7.2 * scale],
        [2.0 * scale, 15.2 * scale, 9.6 * scale]
      ];
  for (const [mx, mh, yardW] of mastSpecs) {
    addCylPart(hullParts, 0.16 * scale, 0.25 * scale, mh, 8, mx, mh * 0.52, 0);
    // 6 horizontal bamboo battens spanning the sail width cleanly centered at z = 0
    for (let bt = 0; bt < 6; bt++) {
      const by = mh * 0.25 + (bt / 5) * (mh * 0.68);
      addCylPart(hullParts, 0.055 * scale, 0.065 * scale, yardW, 6, mx + 0.32 * scale, by, 0, Math.PI * 0.5, 0);
    }
    // Mast rigging ropes: port & starboard shrouds anchoring masthead to hull gunwales
    for (const side of [-1, 1]) {
      for (const zOff of [-0.65 * scale, 0.65 * scale]) {
        const shroudCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(mx, mh * 0.90, 0),
          new THREE.Vector3(mx + zOff * 0.45, mh * 0.52, side * beam * 0.32),
          new THREE.Vector3(mx + zOff, 1.45 * scale, side * beam * 0.48)
        ]);
        hullParts.push(new THREE.TubeGeometry(shroudCurve, 4, 0.032 * scale, 4, false));
      }
    }
  }
  // Longitudinal fore-stay & inter-mast backstays linking all masts down to bow & stern
  const stayPts: THREE.Vector3[] = [new THREE.Vector3(len * 0.46, 1.65 * scale, 0)];
  for (let m = mastSpecs.length - 1; m >= 0; m--) {
    stayPts.push(new THREE.Vector3(mastSpecs[m][0], mastSpecs[m][1] * 0.92, 0));
  }
  stayPts.push(new THREE.Vector3(-len * 0.42, 2.8 * scale, 0));
  for (let i = 0; i < stayPts.length - 1; i++) {
    hullParts.push(
      new THREE.TubeGeometry(new THREE.LineCurve3(stayPts[i], stayPts[i + 1]), 2, 0.038 * scale, 4, false)
    );
  }
  // Raised horizontal hull plank strakes along port & starboard flanks
  for (const side of [-1, 1]) {
    for (const py of [0.35, 0.95]) {
      addBoxPart(hullParts, len * 0.84, 0.14 * scale, 0.10 * scale, 0, py * scale, side * (beam * 0.51));
    }
  }
  // Side wooden battle shields & protruding war oars
  for (const side of [-1, 1]) {
    for (let s = 0; s < 5; s++) {
      addBoxPart(
        hullParts,
        1.1 * scale,
        0.95 * scale,
        0.14 * scale,
        (-2.5 + s * 2.1) * scale,
        1.65 * scale,
        side * (beam * 0.52)
      );
      addCylPart(
        hullParts,
        0.045 * scale,
        0.065 * scale,
        4.6 * scale,
        5,
        (-2.5 + s * 2.1) * scale,
        0.65 * scale,
        side * (beam * 0.5 + 1.45 * scale),
        side * 1.15,
        0
      );
    }
  }
  return mergeNormalized(hullParts);
}

function buildTamCocMacroValley(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): { group: THREE.Group; lampMat: THREE.MeshStandardMaterial } {
  const cx = 680;
  const cz = -320;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 165 });
  const group = new THREE.Group();
  group.name = 'TamCocMacroKarstValley';
  const rand = mulberry32(11011);

  // 1. 19 Three-layer Domed Tam Cốc / Tràng An Karst Towers (55–165m)
  const rockParts: THREE.BufferGeometry[] = [];
  const capParts: THREE.BufferGeometry[] = [];
  const towerDefs: Array<[number, number, number, number]> = [
    [-125, -45, 24, 62], [-48, -58, 28, 76], [42, -52, 26, 72], [132, -40, 25, 65],
    [-165, -92, 30, 88], [-88, -104, 34, 102], [4, -108, 36, 114], [92, -102, 32, 96], [172, -88, 28, 82],
    [-188, -148, 34, 118], [-115, -162, 38, 134], [-35, -172, 42, 152], [48, -168, 40, 145], [128, -158, 36, 126], [192, -142, 32, 108],
    [-148, 25, 22, 58], [154, 28, 24, 64], [-178, -22, 26, 72], [182, -18, 26, 74]
  ];
  // FIX TA-03 (Macro): Steep 85° Stratified Limestone Karst Towers (replacing spherical Icosahedrons!) + 4 Riverside Banyans
  for (let i = 0; i < towerDefs.length; i++) {
    const [dx, dz, rad, h] = towerDefs[i];
    const gx = cx + dx;
    const gz = cz + dz;
    const ty = ctx.getHeight(gx, gz) - 3.0;
    const tower = new THREE.CylinderGeometry(rad * 0.68, rad * 1.05, h * 0.78, 10, 6);
    const pos = tower.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      const ang = Math.atan2(vz, vx);
      const yn = (vy + h * 0.39) / (h * 0.78);
      const cliffFlute = 0.88 + 0.16 * Math.sin(ang * 4.0 + i * 1.9) + 0.08 * Math.cos(ang * 7.0 - i);
      const strataLedge = 1.0 + 0.06 * Math.sin(yn * Math.PI * 7.0 + i);
      const crownPinch = yn > 0.82 ? 1.0 - (yn - 0.82) * 1.25 : 1.0;
      pos.setXYZ(v, vx * cliffFlute * strataLedge * crownPinch, vy + h * 0.39, vz * cliffFlute * strataLedge * crownPinch);
    }
    tower.computeVertexNormals();
    tower.translate(gx, ty, gz);
    rockParts.push(tower);
    const cap = createSculptedRockGeometry(1200 + i, rad * 0.78, h * 0.22, rad * 0.78, 1);
    cap.translate(gx, ty + h * 0.72, gz);
    capParts.push(cap);
  }
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#6b6a62',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.88
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: '#3e5a3a',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.35,
    roughness: 0.82
  });
  ctx.extraMaterials.push(rockMat, mossMat);
  const rockMesh = new THREE.Mesh(mergeNormalized(rockParts), rockMat);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh, new THREE.Mesh(mergeNormalized(capParts), mossMat));

  // 2. 5,800 Backlit Golden Rice Clumps with Drooping Grain Panicles (*bông lúa vàng trĩu hạt*) across wide Tam Cốc plain
  const bladeParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.PlaneGeometry(0.12, 0.96, 1, 2);
    const bp = blade.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const yv = bp.getY(v) + 0.48;
      const t = clamp01(yv / 0.96);
      bp.setX(v, bp.getX(v) * (1.0 - t * 0.74));
      bp.setY(v, yv * (1.0 - t * t * 0.14));
      bp.setZ(v, t * t * 0.30);
    }
    blade.computeVertexNormals();
    blade.rotateY((b / 4) * Math.PI * 2 + 0.2);
    bladeParts.push(blade);
  }
  const tcPanicle = new THREE.PlaneGeometry(0.09, 0.38, 1, 2);
  const tcPPos = tcPanicle.attributes.position;
  for (let v = 0; v < tcPPos.count; v++) {
    const yv = tcPPos.getY(v) + 0.19;
    const t = clamp01(yv / 0.38);
    const archY = 0.74 + Math.sin(t * Math.PI * 0.85) * 0.17 - t * t * 0.15;
    const archZ = 0.08 + t * 0.32;
    const wMod = 0.55 + 0.65 * Math.sin(t * Math.PI);
    tcPPos.setXYZ(v, tcPPos.getX(v) * wMod, archY, archZ);
  }
  tcPanicle.computeVertexNormals();
  tcPanicle.rotateY(0.6);
  bladeParts.push(tcPanicle);
  const riceGeo = mergeNormalized(bladeParts);
  const riceUniform = { uTime: { value: 0 } };
  animList.push(riceUniform);
  const riceMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.64,
    side: THREE.DoubleSide
  });
  riceMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = riceUniform.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 ip = vec3(0.0);
       #ifdef USE_INSTANCING
       ip = vec3(instanceMatrix[3].xyz);
       #endif
       float ht = clamp(position.y / 0.96, 0.0, 1.0);
       transformed.x += sin(uTime * 1.8 + ip.x * 0.14 + ip.z * 0.12) * ht * ht * 0.15;
       transformed.z += cos(uTime * 1.4 + ip.z * 0.16) * ht * ht * 0.09;`
    );
  };
  ctx.extraMaterials.push(riceMat);
  const riceCount = 5800;
  const riceInst = new THREE.InstancedMesh(riceGeo, riceMat, riceCount);
  const tamCocPaddyPalette = [
    new THREE.Color('#469434'), // lush young emerald paddy
    new THREE.Color('#8ec13c'), // chartreuse maturing band
    new THREE.Color('#dea438'), // rich golden harvest paddy
    new THREE.Color('#f0c84a')  // sunlit amber ripe rice
  ];
  const isInsideKarst = (x: number, z: number): boolean => {
    for (const [dx, dz, rad] of towerDefs) {
      if (Math.hypot(x - (cx + dx), z - (cz + dz)) < rad * 1.12) return true;
    }
    return false;
  };
  let placed = 0;
  for (let i = 0; i < riceCount * 2 && placed < riceCount; i++) {
    const rx = cx + (rand() - 0.5) * 280;
    const rz = cz + 15 + (rand() - 0.5) * 165;
    const canalZ = -308.0 + 18.0 * Math.sin((rx - cx) * 0.016);
    if (Math.abs(rz - canalZ) < 13.5) continue;
    if (isInsideKarst(rx, rz)) continue;
    // Leave crisp narrow mud-bund lanes every 36m (Z) and 40m (X) for authentic patchwork paddy geometry!
    const localCellX = ((rx - (cx - 140)) % 40 + 40) % 40;
    const localCellZ = ((rz - (cz - 72)) % 36 + 36) % 36;
    if (localCellX < 1.1 || localCellX > 38.9 || localCellZ < 1.1 || localCellZ > 34.9) continue;
    const ry = ctx.getHeight(rx, rz);
    if (ry < 0.4) continue;
    // Natural multi-tone Tam Cốc patchwork harvest plots (emerald + chartreuse + golden harvest bands)
    const plotX = Math.floor((rx - (cx - 140)) / 40);
    const plotZ = Math.floor((rz - (cz - 72)) / 36);
    const plotHash = clamp01(0.5 + 0.5 * Math.sin(plotX * 2.17 + plotZ * 3.41 + 0.6));
    const bandIdx = Math.min(tamCocPaddyPalette.length - 1, Math.floor(plotHash * tamCocPaddyPalette.length));
    const pCol = tamCocPaddyPalette[bandIdx].clone().offsetHSL((rand() - 0.5) * 0.025, 0, (rand() - 0.5) * 0.06);
    // Riper golden plots grow slightly fuller & heavier than young emerald plots
    const ripenessBoost = 0.90 + bandIdx * 0.09;
    const sc = (1.22 + rand() * 0.66) * ripenessBoost;
    setInstanceMatrix(riceInst, placed, rx, ry, rz, (rand() - 0.5) * 0.12, rand() * 6.28, (rand() - 0.5) * 0.12, sc, sc * 0.88, sc);
    riceInst.setColorAt(placed, pCol);
    placed++;
  }
  riceInst.count = placed;
  riceInst.instanceMatrix.needsUpdate = true;
  if (riceInst.instanceColor) riceInst.instanceColor.needsUpdate = true;
  group.add(riceInst);

  // 3. FIX TA-04 + TA-05: 11 Rounded Bell-Shaped Straw Stacks (đống rơm), Grassy Earthen Bunds & 2 Gable-Thatched Watch Huts!
  const strawParts: THREE.BufferGeometry[] = [];
  const timberParts: THREE.BufferGeometry[] = [];
  const bundEarthParts: THREE.BufferGeometry[] = [];
  const strawCoords: Array<[number, number]> = [
    [cx - 98, cz + 65], [cx - 88, cz + 72], [cx - 72, cz + 62], [cx - 114, cz + 48],
    [cx - 64, cz + 42], [cx + 88, cz + 68], [cx + 102, cz + 56], [cx + 118, cz + 74],
    [cx + 76, cz + 42], [cx - 42, cz + 82], [cx + 46, cz + 84]
  ];
  const hayProfile = [
    new THREE.Vector2(1.38, 0.0),
    new THREE.Vector2(1.72, 0.95),
    new THREE.Vector2(1.64, 1.85),
    new THREE.Vector2(1.18, 2.75),
    new THREE.Vector2(0.45, 3.45),
    new THREE.Vector2(0.06, 3.72)
  ];
  for (const [sx, sz] of strawCoords) {
    const sy = Math.max(1.2, ctx.getHeight(sx, sz));
    const haystack = new THREE.LatheGeometry(hayProfile, 10);
    haystack.translate(sx, sy, sz);
    strawParts.push(haystack);
    addCylPart(timberParts, 0.07, 0.09, 4.5, 6, sx, sy + 2.25, sz);
  }
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#ffb347',
    emissive: new THREE.Color('#ff8a2a'),
    emissiveIntensity: 1.8
  });
  lampMat.userData.noDedupe = true;
  ctx.extraMaterials.push(lampMat);
  for (const [hx, hz] of [[cx - 92, cz + 76], [cx + 96, cz + 62]] as Array<[number, number]>) {
    const hy = Math.max(1.2, ctx.getHeight(hx, hz));
    for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
      addCylPart(timberParts, 0.10, 0.12, 3.2, 6, hx + ox, hy + 1.6, hz + oz);
    }
    addBoxPart(timberParts, 3.0, 0.16, 3.0, hx, hy + 1.65, hz);
    // Authentic 2-slope thatched gable roof instead of 4-sided pyramid cone (TA-05!)
    const roof = createGableRoofGeometry(3.8, 3.4, 1.45, 0.16, 'x');
    roof.translate(hx, hy + 3.05, hz);
    strawParts.push(roof);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMat);
    lamp.position.set(hx, hy + 2.35, hz);
    group.add(lamp);
  }
  // FIX TA-04 + Bug B18: Grassy earthen rice bunds (#4d5c2b) in authentic E-W & N-S patchwork grid following terrain height & clipped cleanly at Ngô Đồng banks!
  const canalCenterZ = (x: number): number => -308.0 + 18.0 * Math.sin((x - cx) * 0.016);
  for (let b = -2; b <= 2; b++) {
    const bundZ = cz + b * 36;
    const xMin = cx - 130;
    const xMax = cx + 130;
    const stepX = 4.0;
    let segStart: number | null = null;
    for (let x = xMin; x <= xMax + 0.01; x += stepX) {
      const inCanal = Math.abs(bundZ - canalCenterZ(x)) < 15.0 || ctx.getHeight(x, bundZ) < 0.45 || isInsideKarst(x, bundZ);
      const atEnd = x >= xMax - 0.01;
      if (!inCanal && segStart === null) {
        segStart = x;
      } else if ((inCanal || atEnd) && segStart !== null) {
        const segEnd = inCanal ? x - stepX : xMax;
        const segLen = segEnd - segStart;
        if (segLen >= 3.0) {
          const midX = (segStart + segEnd) * 0.5;
          const bY = Math.max(0.85, ctx.getHeight(midX, bundZ));
          addBoxPart(bundEarthParts, segLen, 0.36, 0.72, midX, bY + 0.12, bundZ);
        }
        segStart = null;
      }
    }
  }
  // Transverse N-S raised mud bunds dividing Tam Cốc paddies into realistic rectangular plots
  for (let bx = -3; bx <= 3; bx++) {
    const bundX = cx - 120 + (bx + 3) * 40;
    const zMin = cz - 72;
    const zMax = cz + 72;
    const stepZ = 4.0;
    let segStartZ: number | null = null;
    for (let z = zMin; z <= zMax + 0.01; z += stepZ) {
      const inCanal = Math.abs(z - canalCenterZ(bundX)) < 15.0 || ctx.getHeight(bundX, z) < 0.45 || isInsideKarst(bundX, z);
      const atEnd = z >= zMax - 0.01;
      if (!inCanal && segStartZ === null) {
        segStartZ = z;
      } else if ((inCanal || atEnd) && segStartZ !== null) {
        const segEndZ = inCanal ? z - stepZ : zMax;
        const segLenZ = segEndZ - segStartZ;
        if (segLenZ >= 3.0) {
          const midZ = (segStartZ + segEndZ) * 0.5;
          const bY = Math.max(0.85, ctx.getHeight(bundX, midZ));
          addBoxPart(bundEarthParts, 0.68, 0.36, segLenZ, bundX, bY + 0.12, midZ);
        }
        segStartZ = null;
      }
    }
  }
  if (bundEarthParts.length > 0) {
    const bundGrassMat = new THREE.MeshStandardMaterial({ color: '#4d5c2b', roughness: 0.90 });
    ctx.extraMaterials.push(bundGrassMat);
    group.add(new THREE.Mesh(mergeNormalized(bundEarthParts), bundGrassMat));
  }

  // FIX Bug B1: Build Bến Đò Tam Cốc landing pier BEFORE mergeNormalized(timberParts) & place stairs in stone!
  const pierStoneParts: THREE.BufferGeometry[] = [];
  const pierX = cx - 115;
  const pierZ = -316.0;
  addBoxPart(timberParts, 9.2, 0.30, 4.4, pierX, 0.42, pierZ);
  for (const [px, pz] of [[-4.0, -1.9], [0, -1.9], [4.0, -1.9], [-4.0, 1.9], [0, 1.9], [4.0, 1.9]]) {
    addCylPart(timberParts, 0.13, 0.15, 2.3, 6, pierX + px, 0.35, pierZ + pz);
  }
  timberParts.push(
    ...createPiercedBalustradeParts(pierX - 4.2, pierZ - 2.0, pierX + 4.2, pierZ - 2.0, 0.56, 0.88, 'bamboo_x')
  );
  for (let st = 0; st < 3; st++) {
    addBoxPart(pierStoneParts, 7.6 - st * 0.4, 0.22, 0.95, pierX, 0.26 - st * 0.16, pierZ + 2.45 + st * 0.75);
  }
  const benDoPlaque = createSignagePlaqueMesh(
    { text: 'BẾN ĐÒ TAM CỐC', subText: 'NINH BÌNH', width: 3.0, height: 0.78, depth: 0.14, style: 'royal' },
    ctx
  );
  benDoPlaque.position.set(pierX, 2.45, pierZ - 2.05);
  group.add(benDoPlaque);
  addCylPart(timberParts, 0.11, 0.13, 2.5, 6, pierX - 1.4, 1.25, pierZ - 2.05);
  addCylPart(timberParts, 0.11, 0.13, 2.5, 6, pierX + 1.4, 1.25, pierZ - 2.05);

  const strawMat = new THREE.MeshStandardMaterial({
    color: '#b98a4a',
    map: ctx.pbr.timber.map,
    roughness: 0.90
  });
  ctx.extraMaterials.push(strawMat);
  group.add(
    new THREE.Mesh(mergeNormalized(strawParts), strawMat),
    new THREE.Mesh(mergeNormalized(timberParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(pierStoneParts), ctx.materials.stone)
  );

  // 4. Hang Cả Xuyên Thủy Tam Cốc (Organic Sculpted 50m Limestone Tunnel + Stalactites) & Foot-Oar Sampans
  const caveParts: THREE.BufferGeometry[] = [];
  const stalactiteParts: THREE.BufferGeometry[] = [];

  // 4.1 Organic 50m-long sculpted limestone arched tunnel over Ngô Đồng canal at (cx + 14, -308)
  const caveX = cx + 14;
  const caveZ = -308.0;
  const tunnelLen = 50.0;
  const tunnelOuterHalfW = 24.0;
  const tunnelOuterH = 22.5;
  const archHalfW = 10.6;
  const archCrownY = 11.4;
  const tunnelShape = new THREE.Shape();
  tunnelShape.moveTo(-tunnelOuterHalfW, -1.5);
  tunnelShape.lineTo(tunnelOuterHalfW, -1.5);
  tunnelShape.lineTo(tunnelOuterHalfW * 0.86, tunnelOuterH * 0.65);
  tunnelShape.quadraticCurveTo(tunnelOuterHalfW * 0.45, tunnelOuterH * 1.12, 0, tunnelOuterH);
  tunnelShape.quadraticCurveTo(-tunnelOuterHalfW * 0.45, tunnelOuterH * 1.12, -tunnelOuterHalfW * 0.86, tunnelOuterH * 0.65);
  tunnelShape.closePath();

  const tunnelHole = new THREE.Path();
  tunnelHole.moveTo(-archHalfW, -1.5);
  tunnelHole.lineTo(-archHalfW, 4.2);
  tunnelHole.absarc(0, 4.2, archHalfW, Math.PI, 0, true);
  tunnelHole.lineTo(archHalfW, -1.5);
  tunnelHole.closePath();
  tunnelShape.holes.push(tunnelHole);

  const tunnelGeo = new THREE.ExtrudeGeometry(tunnelShape, {
    depth: tunnelLen,
    steps: 14,
    bevelEnabled: false,
    curveSegments: 18
  });
  tunnelGeo.translate(0, 0, -tunnelLen * 0.5);
  tunnelGeo.rotateY(Math.PI * 0.5); // span 50m along X, arch opening along Z
  // Organically sculpt outer limestone rock walls & craggy arch ceiling while keeping river channel navigable
  const tPos = tunnelGeo.attributes.position;
  for (let v = 0; v < tPos.count; v++) {
    let vx = tPos.getX(v);
    let vy = tPos.getY(v);
    let vz = tPos.getZ(v);
    const distFromCenter = Math.hypot(vz, Math.max(0, vy - 4.2));
    const n1 = noise2D(vx * 0.14 + vy * 0.11, vz * 0.16, 8801);
    const n2 = noise2D(vx * 0.34, vy * 0.28 + vz * 0.22, 8819);
    const isInnerWall = distFromCenter < archHalfW + 1.8 && vy < archCrownY + 2.2;
    const amp = isInnerWall ? 0.65 : 2.35;
    vx += n2 * 0.85;
    vz += n1 * amp;
    if (vy > 2.0) {
      vy += (n1 * 0.7 + n2 * 0.35) * amp;
    }
    tPos.setXYZ(v, vx, vy, vz);
  }
  tunnelGeo.computeVertexNormals();
  tunnelGeo.translate(caveX, 0, caveZ);
  caveParts.push(tunnelGeo);

  // Rugged flanking karst buttresses & jungle moss crown atop the 50m Hang Cả tunnel
  const caveMossParts: THREE.BufferGeometry[] = [];
  for (let k = -2; k <= 2; k++) {
    const bx = caveX + k * 10.5;
    const topCap = createSculptedRockGeometry(8830 + k, 11.5, 5.2, 16.5, 2);
    topCap.translate(bx, 21.5 + Math.abs(k % 2) * 1.4, caveZ);
    caveMossParts.push(topCap);
    for (const sz of [-1, 1]) {
      const flank = createSculptedRockGeometry(8860 + k * 2 + sz, 9.5, 11.0, 9.0, 2);
      flank.translate(bx, 7.5, caveZ + sz * 21.5);
      caveParts.push(flank);
    }
  }
  group.add(new THREE.Mesh(mergeNormalized(caveMossParts), mossMat));

  // 36 Clustered Tiered Limestone Speleothems (nhũ đá phân tầng rủ theo cụm) + 10 Warm-Amber Cave Ceiling Lanterns inside Hang Cả
  const randStal = mulberry32(88001);
  const caveLanternOrbParts: THREE.BufferGeometry[] = [];
  const caveLanternCordParts: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 36; s++) {
    const sx = caveX - 22.0 + randStal() * 44.0;
    const sz = caveZ - 6.8 + randStal() * 13.6;
    const sLen = 1.8 + randStal() * 2.8;
    const radRatio = clamp01(1.0 - Math.abs(sz - caveZ) / archHalfW);
    const ceilY = 4.2 + Math.sqrt(Math.max(0.05, 1.0 - Math.pow((sz - caveZ) / archHalfW, 2))) * archHalfW;
    const topY = ceilY - (1.0 - radRatio) * 0.25;
    // Upper calcite flowstone collar + primary tiered stalactite + 2 flanking icicles
    addCylPart(stalactiteParts, 0.36 + randStal() * 0.20, 0.20, 0.55, 6, sx, topY - 0.15, sz);
    addCylPart(stalactiteParts, 0.22 + randStal() * 0.12, 0.04, sLen, 6, sx, topY - sLen * 0.5, sz);
    for (let sub = 0; sub < 2; sub++) {
      const ang = randStal() * Math.PI * 2;
      const dist = 0.28 + randStal() * 0.35;
      const subLen = sLen * (0.45 + randStal() * 0.35);
      addCylPart(
        stalactiteParts,
        0.13 + randStal() * 0.06,
        0.025,
        subLen,
        5,
        sx + Math.cos(ang) * dist,
        topY - subLen * 0.5,
        sz + Math.sin(ang) * dist
      );
    }
  }
  // 10 Warm-Amber Ceiling Lanterns hung along the 50m Hang Cả tunnel vault illuminating speleothems
  for (let cl = 0; cl < 10; cl++) {
    const lx = caveX - 20.0 + cl * 4.45;
    const lz = caveZ + (cl % 2 === 0 ? -2.2 : 2.2);
    const ceilY = 4.2 + Math.sqrt(Math.max(0.1, 1.0 - Math.pow((lz - caveZ) / archHalfW, 2))) * archHalfW;
    const hangY = ceilY - 1.45;
    addCylPart(caveLanternCordParts, 0.03, 0.03, 1.35, 5, lx, ceilY - 0.65, lz);
    addCylPart(caveLanternCordParts, 0.26, 0.22, 0.10, 6, lx, hangY + 0.26, lz);
    const lOrb = createLanternCoreGeometry(0.24, 0.42);
    lOrb.translate(lx, hangY, lz);
    caveLanternOrbParts.push(lOrb);
  }
  if (caveLanternCordParts.length > 0) {
    group.add(new THREE.Mesh(mergeNormalized(caveLanternCordParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood));
  }
  if (caveLanternOrbParts.length > 0) {
    group.add(new THREE.Mesh(mergeNormalized(caveLanternOrbParts), lampMat));
  }

  // 4.2 4 Photo-Authentic Tapered Tam Cốc Sampans cruising longer stretches (radiusX = 16m) with conical-hat rowers
  const bambooCanopyMat = ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone;
  const rowerCoatMat = ctx.materials.darkRoof;
  const vestMat = ctx.materialLib?.getOrCreateStandard({ color: '#e85a1c', roughness: 0.72 }) ?? new THREE.MeshStandardMaterial({ color: '#e85a1c', roughness: 0.72 });

  for (let s = 0; s < 4; s++) {
    const sx = cx - 90 + s * 62;
    const sz = canalCenterZ(sx);
    const boat = new THREE.Group();
    const bParts: THREE.BufferGeometry[] = createTaperedSampanHullParts(6.9, 1.45, 0.48);
    const bBamboo: THREE.BufferGeometry[] = [];
    const bRower: THREE.BufferGeometry[] = [];
    const bVest: THREE.BufferGeometry[] = [];

    // Arched woven bamboo roof awning (mui thuyền đan tre)
    const muiRoof = new THREE.CylinderGeometry(0.82, 0.82, 2.5, 12, 1, true, 0, Math.PI);
    muiRoof.rotateZ(Math.PI * 0.5);
    muiRoof.translate(0.15, 0.88, 0);
    bBamboo.push(muiRoof);

    // Conical-hat foot-oar rower seated at stern + passenger in orange life-vest
    addCylPart(bRower, 0.18, 0.24, 0.68, 7, -1.85, 0.88, 0);
    const rowerHead = new THREE.SphereGeometry(0.14, 7, 5);
    rowerHead.translate(-1.85, 1.32, 0);
    bRower.push(rowerHead);
    const rowerNonLa = new THREE.ConeGeometry(0.36, 0.22, 12);
    rowerNonLa.translate(-1.85, 1.48, 0);
    bBamboo.push(rowerNonLa);

    // Passenger seated forward wearing orange vest & conical hat
    addCylPart(bVest, 0.19, 0.22, 0.62, 7, 1.55, 0.86, 0);
    const passNonLa = new THREE.ConeGeometry(0.34, 0.20, 12);
    passNonLa.translate(1.55, 1.44, 0);
    bBamboo.push(passNonLa);

    // Signature Pair of Tam Cốc Foot-Oars (cặp mái chèo chân Ninh Bình)
    for (const os of [-0.85, 0.85]) {
      addCylPart(bParts, 0.03, 0.03, 0.35, 4, -2.4, 0.65, os);
      addCylPart(bParts, 0.035, 0.055, 3.2, 5, -3.6, 0.32, os * 1.35, os * 0.25, 0.55);
      addBoxPart(bParts, 0.75, 0.04, 0.22, -4.9, 0.04, os * 1.7, 0, os * 0.2, 0.45);
    }

    boat.add(
      new THREE.Mesh(mergeNormalized(bParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood),
      new THREE.Mesh(mergeNormalized(bBamboo), bambooCanopyMat),
      new THREE.Mesh(mergeNormalized(bRower), rowerCoatMat),
      new THREE.Mesh(mergeNormalized(bVest), vestMat)
    );
    boat.position.set(sx, VIETNAM_WATER_LEVEL + 0.05, sz);
    group.add(boat);
    ctx.junkBoats.push({
      group: boat,
      centerX: sx,
      centerZ: sz,
      radiusX: 16.0,
      radiusZ: 1.8,
      speed: 0.14,
      phase: s * 1.4
    });
  }

  // 4.3 Chùa Bích Động Pagoda Complex on eastern limestone flank (788, -328)
  const bdX = 788;
  const bdZ = -328;
  const bdY = Math.max(1.2, ctx.getHeight(bdX, bdZ));
  ctx.exclusionCircles.push({ x: bdX, z: bdZ, r: 34 });

  const bdStoneParts: THREE.BufferGeometry[] = [];
  const bdRoofParts: THREE.BufferGeometry[] = [];
  const bdIronwoodParts: THREE.BufferGeometry[] = [];
  const bdWhitePlasterParts: THREE.BufferGeometry[] = [];
  const bdPolychromeParts: THREE.BufferGeometry[] = [];
  const bdGoldParts: THREE.BufferGeometry[] = [];
  const bdPadParts: THREE.BufferGeometry[] = [];
  const bdLotusPetalParts: THREE.BufferGeometry[] = [];

  // Lotus Pond fronting Chùa Bích Động
  const bdPondX = bdX - 11.5;
  const bdPondZ = bdZ + 12.0;
  const bdWaterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.granite;
  const bdPadMat = ctx.materialLib?.getOrCreateStandard({ color: '#3f7236', roughness: 0.58, side: THREE.DoubleSide }) ?? new THREE.MeshStandardMaterial({ color: '#3f7236', roughness: 0.58, side: THREE.DoubleSide });
  const bdLotusMat = new THREE.MeshStandardMaterial({
    color: '#eb79a0',
    emissive: new THREE.Color('#ff6699'),
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(bdLotusMat);
  const bdPond = new THREE.Mesh(new THREE.CircleGeometry(12.5, 24), bdWaterMat);
  bdPond.rotation.x = -Math.PI * 0.5;
  bdPond.position.set(bdPondX, bdY + 0.06, bdPondZ);
  group.add(bdPond);

  const randBd = mulberry32(6363);
  for (let lp = 0; lp < 28; lp++) {
    const a = randBd() * Math.PI * 2;
    const rad = 3.0 + randBd() * 8.2;
    const px = bdPondX + Math.cos(a) * rad;
    const pz = bdPondZ + Math.sin(a) * rad;
    if (Math.abs(px - bdPondX) < 2.6 && Math.abs(pz - bdPondZ) < 8.5) continue; // keep bridge clear
    const pad = createNotchedLotusPadGeometry(0.45 + randBd() * 0.22, 12);
    pad.rotateY(randBd() * Math.PI * 2);
    pad.translate(px, bdY + 0.09, pz);
    bdPadParts.push(pad);
    if (lp % 3 === 0) {
      const fl = createForegroundLotusFlowerParts(px, bdY + 0.08, pz, 0.22, 1.5, 0.9, randBd() * 6.28);
      for (const st of fl.stemParts) st.dispose();
      for (const c of fl.coreParts) c.dispose();
      bdLotusPetalParts.push(...fl.petalParts);
    }
  }

  // 3-Arch Stone Bridge across the lotus pond leading to Tam Quan gate
  const brLen = 16.5;
  const brW = 3.4;
  for (const s of [-1, 1]) {
    for (let aIdx = -1; aIdx <= 1; aIdx++) {
      const archWall = createArchedWallGeometry(5.5, 2.3, 0.42, 3.6, 1.65);
      archWall.rotateY(Math.PI * 0.5);
      archWall.translate(bdPondX + s * (brW * 0.44), bdY - 0.1, bdPondZ + aIdx * 5.4);
      bdStoneParts.push(archWall);
    }
  }
  addBoxPart(bdStoneParts, brW, 0.32, brLen, bdPondX, bdY + 2.18, bdPondZ);
  bdStoneParts.push(
    ...createPiercedBalustradeParts(bdPondX - brW * 0.46, bdPondZ - brLen * 0.48, bdPondX - brW * 0.46, bdPondZ + brLen * 0.48, bdY + 2.34, 0.82, 'lotus_stone'),
    ...createPiercedBalustradeParts(bdPondX + brW * 0.46, bdPondZ - brLen * 0.48, bdPondX + brW * 0.46, bdPondZ + brLen * 0.48, bdY + 2.34, 0.82, 'lotus_stone')
  );
  // Entry stone ramps at both bridge ends
  for (let st = 0; st < 6; st++) {
    addBoxPart(bdStoneParts, brW, 0.36, 0.85, bdPondX, bdY + 0.18 + st * 0.34, bdPondZ + brLen * 0.5 + (5 - st) * 0.72);
    addBoxPart(bdStoneParts, brW, 0.36, 0.85, bdPondX, bdY + 0.18 + st * 0.34, bdPondZ - brLen * 0.5 - (5 - st) * 0.72);
  }

  // Mossy Ancient Tam Quan Gate of Chùa Bích Động (aligned on x = tqX = 776.5)
  const tqX = bdPondX;
  const tqZ = bdZ - 1.5;
  const tqArchCenter = createArchedWallGeometry(4.4, 4.8, 1.4, 2.6, 3.3);
  tqArchCenter.translate(tqX, bdY, tqZ);
  const tqArchLeft = createArchedWallGeometry(2.8, 3.6, 1.2, 1.5, 2.4);
  tqArchLeft.translate(tqX - 3.6, bdY, tqZ);
  const tqArchRight = createArchedWallGeometry(2.8, 3.6, 1.2, 1.5, 2.4);
  tqArchRight.translate(tqX + 3.6, bdY, tqZ);
  bdStoneParts.push(tqArchCenter, tqArchLeft, tqArchRight);

  const tqRoof1 = createVietnameseCurvedRoofGeometry(5.6, 4.2, 3.8, 1.4, 1.85, 0.65);
  tqRoof1.translate(tqX, bdY + 4.72, tqZ);
  const tqRoofLeft = createVietnameseCurvedRoofGeometry(3.8, 3.8, 2.2, 1.2, 1.25, 0.42);
  tqRoofLeft.translate(tqX - 3.6, bdY + 3.55, tqZ);
  const tqRoofRight = createVietnameseCurvedRoofGeometry(3.8, 3.8, 2.2, 1.2, 1.25, 0.42);
  tqRoofRight.translate(tqX + 3.6, bdY + 3.55, tqZ);
  const tqRoof2 = createHueImperialHipRoofGeometry(6.6, 3.4, 3.6, 0.8, 1.95, 0.78);
  tqRoof2.translate(tqX, bdY + 6.50, tqZ);
  bdRoofParts.push(tqRoof1, tqRoofLeft, tqRoofRight, tqRoof2);
  const tqFinial = createRoofFinialSetParts(tqX, bdY + 8.48, tqZ, 3.6, 0, 0.72, true);
  bdWhitePlasterParts.push(...tqFinial.mainParts);
  bdPolychromeParts.push(...tqFinial.goldParts);

  const bdPlaque = createSignagePlaqueMesh(
    { text: 'CHÙA BÍCH ĐỘNG', subText: 'NAM THIÊN ĐỆ NHỊ ĐỘNG', width: 2.9, height: 0.76, depth: 0.14, style: 'stone' },
    ctx
  );
  bdPlaque.position.set(tqX, bdY + 4.15, tqZ + 0.78);
  group.add(bdPlaque);

  // FIX R31: Cave-nestled Chùa Trung aligned DIRECTLY behind Tam Quan along x = tqX (776.5) — zero X-offset!
  const ctX = tqX;
  const ctZ = tqZ - 14.5;
  const ctY = bdY + 5.4;
  // 12-Step Stone Stairway climbing directly along the central Tam Quan -> Chùa Trung axis
  for (let st = 0; st < 12; st++) {
    const frac = st / 11;
    const stepZ = tqZ - 1.6 - frac * 8.6;
    const stepH = 0.45 + frac * 4.95;
    addBoxPart(bdStoneParts, 3.6, stepH, 0.88, ctX, bdY + stepH * 0.5, stepZ);
    // Low stone stair cheek curbing flanking both sides of the staircase
    for (const side of [-1, 1]) {
      addBoxPart(bdStoneParts, 0.34, stepH + 0.55, 0.88, ctX + side * 1.95, bdY + (stepH + 0.55) * 0.5, stepZ);
    }
  }
  // Stone terrace & solid retaining plinth under Chùa Trung
  addBoxPart(bdStoneParts, 14.8, 5.4, 9.2, ctX, bdY + 2.7, ctZ);
  // Carved blue-stone threshold (*bậu đá xanh chạm nổi*) running cleanly across Chùa Trung facade
  addBoxPart(bdStoneParts, 12.2, 0.34, 0.85, ctX, ctY + 0.17, ctZ + 2.15);

  // Overhanging Warm-Ochre / Grey Limestone Karst Cavern Arch directly cradling the roof of Chùa Trung (ref 63)
  const cavernOchreParts: THREE.BufferGeometry[] = [];
  // Massive rear cliff massif pulled cleanly behind Chùa Thượng so Chùa Thượng never buries inside rock!
  const ctCliffBack = createSculptedRockGeometry(6391, 16.5, 17.5, 8.5, 2);
  ctCliffBack.translate(ctX, ctY + 9.5, ctZ - 14.5);
  cavernOchreParts.push(ctCliffBack);
  // FIX TA-01: Lower overhanging limestone cave roof hood snugly onto ctY + 9.4m (hugging right over Chùa Trung roof — ref 63!)
  const ctOverhangArch = createSculptedRockGeometry(6392, 15.5, 4.4, 8.8, 2);
  ctOverhangArch.translate(ctX, ctY + 9.4, ctZ - 0.8);
  cavernOchreParts.push(ctOverhangArch);
  const ctOverhangLip = createSculptedRockGeometry(6393, 12.8, 2.4, 4.6, 2);
  ctOverhangLip.translate(ctX, ctY + 8.6, ctZ + 3.2);
  cavernOchreParts.push(ctOverhangLip);
  // Flanking left & right cavern limestone cheek walls embracing the sanctuary
  for (const side of [-1, 1]) {
    const cheek = createSculptedRockGeometry(6395 + side, 5.4, 11.5, 7.8, 2);
    cheek.translate(ctX + side * 10.2, ctY + 4.8, ctZ - 1.5);
    cavernOchreParts.push(cheek);
  }
  const cavernOchreMat = ctx.materials.ochreSand ?? ctx.materials.stone;
  group.add(new THREE.Mesh(mergeNormalized(cavernOchreParts), cavernOchreMat));

  // Authentic Chùa Trung Sanctuary in RAW DARK IRONWOOD + 3 bays of 4-leaf *cửa bức bàn* doors + square Hán stone columns topped with polychrome Nghê (ref 63b)
  addBoxPart(bdStoneParts, 11.6, 4.0, 4.8, ctX, ctY + 2.0, ctZ - 1.4);
  // Heavy raw dark-ironwood columns & carved front fascia beam
  for (const ox of [-4.8, -1.65, 1.65, 4.8]) {
    addCylPart(bdIronwoodParts, 0.20, 0.22, 4.0, 8, ctX + ox, ctY + 2.0, ctZ + 1.95);
    addCylPart(bdStoneParts, 0.30, 0.36, 0.24, 8, ctX + ox, ctY + 0.12, ctZ + 1.95);
  }
  addBoxPart(bdIronwoodParts, 10.4, 0.34, 0.34, ctX, ctY + 3.85, ctZ + 1.95);
  // 3 bays × 4-leaf wooden *cửa bức bàn* doors (lower solid wood panels + upper vertical *song con tiện* bars)
  for (const bayX of [-3.22, 0, 3.22]) {
    for (let leaf = 0; leaf < 4; leaf++) {
      const lx = ctX + bayX - 1.08 + leaf * 0.72;
      // Lower wooden panel (*pano dưới*)
      addBoxPart(bdIronwoodParts, 0.64, 1.45, 0.12, lx, ctY + 1.05, ctZ + 1.92);
      // Upper lattice frame + 3 vertical spindles (*song con tiện trên*)
      addBoxPart(bdIronwoodParts, 0.64, 0.10, 0.12, lx, ctY + 1.82, ctZ + 1.92);
      addBoxPart(bdIronwoodParts, 0.64, 0.10, 0.12, lx, ctY + 3.45, ctZ + 1.92);
      for (const sp of [-0.20, 0, 0.20]) {
        addCylPart(bdIronwoodParts, 0.025, 0.025, 1.62, 5, lx + sp, ctY + 2.64, ctZ + 1.92);
      }
    }
  }
  // 4 Square Stone Hán-Character Columns (*cột đá vuông khắc Hán tự*) fronting terrace, topped with polychrome Nghê statues
  for (const [colOff, colH] of [[-5.6, 3.1], [-2.5, 3.6], [2.5, 3.6], [5.6, 3.1]] as Array<[number, number]>) {
    const px = ctX + colOff;
    const pz = ctZ + 4.05;
    addBoxPart(bdStoneParts, 0.72, 0.35, 0.72, px, ctY + 0.18, pz);
    addBoxPart(bdStoneParts, 0.46, colH, 0.46, px, ctY + 0.35 + colH * 0.5, pz);
    addBoxPart(bdStoneParts, 0.64, 0.20, 0.64, px, ctY + 0.35 + colH + 0.10, pz);
    // Polychrome sculpted Nghê perched atop each square Hán column
    bdPolychromeParts.push(...createGuardianBeastParts(px, ctY + 0.35 + colH + 0.20, pz, 0, 0.58, 'nghe'));
  }

  // Upturned double curved mossy tile roofs (wide-ridge hip roof on upper tier so ctFinial seats with 0.0m air gap!)
  const ctRoof1 = createVietnameseCurvedRoofGeometry(13.6, 7.6, 9.0, 2.2, 2.25, 0.85);
  ctRoof1.translate(ctX, ctY + 4.05, ctZ + 0.1);
  const ctRoof2 = createHueImperialHipRoofGeometry(9.4, 5.2, 4.8, 1.0, 2.05, 0.92);
  ctRoof2.translate(ctX, ctY + 6.15, ctZ + 0.1);
  bdRoofParts.push(ctRoof1, ctRoof2);
  // FIX TA-01: Hollow coiled dragon-cloud *đầu đao* arches (replacing solid cones) + white pierced *Chữ Thọ* lattice wall & left side annex bay (ref 63, 63b!)
  addBoxPart(bdWhitePlasterParts, 5.0, 0.28, 0.32, ctX, ctY + 8.16, ctZ + 0.1);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const daoArch = new THREE.TorusGeometry(0.46, 0.11, 5, 10, Math.PI * 1.45);
      daoArch.rotateY(sx * sz > 0 ? 0.65 : -0.65);
      daoArch.translate(ctX + sx * 6.45, ctY + 4.72, ctZ + 0.1 + sz * 3.55);
      bdWhitePlasterParts.push(daoArch);
      const daoScroll = new THREE.TorusGeometry(0.24, 0.08, 4, 8, Math.PI * 1.5);
      daoScroll.translate(ctX + sx * 6.82, ctY + 5.10, ctZ + 0.1 + sz * 3.75);
      bdPolychromeParts.push(daoScroll);
    }
  }
  // White plaster *Chữ Thọ* pierced screen wall & low curved-roof left annex tucked against cavern wall
  addBoxPart(bdWhitePlasterParts, 1.55, 2.85, 0.32, ctX - 6.65, ctY + 1.45, ctZ + 1.85);
  const thoRing = new THREE.TorusGeometry(0.42, 0.08, 5, 12);
  thoRing.translate(ctX - 6.65, ctY + 1.65, ctZ + 2.02);
  bdWhitePlasterParts.push(thoRing);
  addBoxPart(bdIronwoodParts, 4.2, 2.75, 3.4, ctX - 8.8, ctY + 1.38, ctZ + 0.35);
  const annexRoof = createVietnameseCurvedRoofGeometry(5.2, 4.4, 2.6, 1.2, 1.35, 0.45);
  annexRoof.translate(ctX - 8.8, ctY + 2.75, ctZ + 0.35);
  bdRoofParts.push(annexRoof);
  const ctFinial = createRoofFinialSetParts(ctX, ctY + 8.18, ctZ + 0.1, 4.8, 0, 0.82, true);
  bdWhitePlasterParts.push(...ctFinial.mainParts);
  bdPolychromeParts.push(...ctFinial.goldParts);

  // Incense tripod in Chùa Trung courtyard
  const bdTripod = createBronzeIncenseTripodParts(ctX, ctY, ctZ + 3.1, 0.82);
  bdStoneParts.push(...bdTripod.limestoneParts);
  bdGoldParts.push(...bdTripod.goldParts);
  if (bdTripod.bronzeParts.length > 0) {
    group.add(new THREE.Mesh(mergeNormalized(bdTripod.bronzeParts), ctx.materials.bronzePatina ?? ctx.materials.bronze));
  }
  const ctLamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat);
  ctLamp.position.set(ctX, ctY + 2.45, ctZ + 2.35);
  group.add(ctLamp);

  const mossyRoofMat = ctx.materials.terracottaRoof;
  group.add(
    new THREE.Mesh(applyWorldBoxUV(mergeNormalized(bdStoneParts), 2.2), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(bdRoofParts), mossyRoofMat),
    new THREE.Mesh(mergeNormalized(bdIronwoodParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bdWhitePlasterParts), ctx.materials.agedPlaster ?? ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(bdPolychromeParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(bdGoldParts), ctx.materials.gold)
  );
  if (bdPadParts.length > 0) group.add(new THREE.Mesh(mergeNormalized(bdPadParts), bdPadMat));
  if (bdLotusPetalParts.length > 0) group.add(new THREE.Mesh(mergeNormalized(bdLotusPetalParts), bdLotusMat));

  // --- 200-Item Macro Visual QC & Expansion (001–015): Tam Cốc Valley & Bích Động ---
  const tcExpStone: THREE.BufferGeometry[] = [];
  const tcExpWood: THREE.BufferGeometry[] = [];
  const tcExpRoof: THREE.BufferGeometry[] = [];
  const tcExpGold: THREE.BufferGeometry[] = [];
  const tcExpStraw: THREE.BufferGeometry[] = [];
  const tcExpMoss: THREE.BufferGeometry[] = [];

  // 001: Hang Hai & Hang Ba secondary limestone cave arches along Ngô Đồng river
  for (const [hx, hLen, hRad] of [[cx - 64, 22.0, 9.2], [cx + 88, 18.0, 8.6]] as Array<[number, number, number]>) {
    const hz = canalCenterZ(hx);
    const archShell = new THREE.CylinderGeometry(hRad + 5.5, hRad + 7.5, hLen, 12, 1, true, 0, Math.PI);
    archShell.rotateZ(Math.PI * 0.5);
    archShell.translate(hx, 3.6, hz);
    tcExpStone.push(archShell);
    const hCap = createSculptedRockGeometry(1290 + Math.round(hx), hLen * 0.55, 6.2, hRad + 5.2, 1);
    hCap.translate(hx, 12.2, hz);
    tcExpMoss.push(hCap);
  }
  // 002 & 003: Bến Đò Văn Lâm ticket/waiting pavilion, mooring bollards & bamboo gangplanks
  const pavX = pierX - 6.8;
  const pavZ = pierZ - 6.2;
  const pavY = Math.max(0.8, ctx.getHeight(pavX, pavZ));
  addBoxPart(tcExpStone, 6.4, 0.36, 4.4, pavX, pavY + 0.18, pavZ);
  for (const [pxOff, pzOff] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]]) {
    addCylPart(tcExpWood, 0.11, 0.13, 3.0, 6, pavX + pxOff, pavY + 1.65, pavZ + pzOff);
  }
  const pavRoof = createGableRoofGeometry(7.2, 5.2, 1.8, 0.14, 'x');
  pavRoof.translate(pavX, pavY + 3.15, pavZ);
  tcExpRoof.push(pavRoof);
  for (const bxOff of [-3.6, -1.2, 1.2, 3.6]) {
    addCylPart(tcExpWood, 0.14, 0.16, 0.95, 6, pierX + bxOff, 0.85, pierZ + 1.85);
  }
  for (const gxOff of [-2.4, 2.4]) {
    addBoxPart(tcExpWood, 1.15, 0.08, 3.2, pierX + gxOff, 0.25, pierZ + 3.6, 0, -0.14, 0);
  }
  // 004 & 005: 60 riverside reed clumps & 32 floating water-hyacinth pads along Ngô Đồng eddies
  const tcReedGeo = new THREE.ConeGeometry(0.18, 1.45, 4);
  tcReedGeo.translate(0, 0.72, 0);
  const tcReedInst = new THREE.InstancedMesh(tcReedGeo, mossMat, 60);
  for (let i = 0; i < 60; i++) {
    const rx = cx - 125 + (i / 59) * 250;
    const bankSide = i % 2 === 0 ? -1 : 1;
    const rz = canalCenterZ(rx) + bankSide * (10.5 + rand() * 2.5);
    setInstanceMatrix(tcReedInst, i, rx, VIETNAM_WATER_LEVEL + 0.02, rz, (rand() - 0.5) * 0.2, rand() * 6.28, (rand() - 0.5) * 0.2, 0.8 + rand() * 0.6, 0.8 + rand() * 0.7, 0.8 + rand() * 0.6);
  }
  tcReedInst.instanceMatrix.needsUpdate = true;
  tcReedInst.computeBoundingSphere();
  group.add(tcReedInst);
  const tcLilyInst = new THREE.InstancedMesh(createNotchedLotusPadGeometry(0.36, 8), bdPadMat, 32);
  for (let i = 0; i < 32; i++) {
    const lx = cx - 95 + rand() * 190;
    const lz = canalCenterZ(lx) + (i % 2 === 0 ? -1 : 1) * (7.2 + rand() * 2.8);
    setInstanceMatrix(tcLilyInst, i, lx, VIETNAM_WATER_LEVEL + 0.04, lz, 0, rand() * 6.28, 0, 0.8 + rand() * 0.5, 1, 0.8 + rand() * 0.5);
  }
  tcLilyInst.instanceMatrix.needsUpdate = true;
  tcLilyInst.computeBoundingSphere();
  group.add(tcLilyInst);

  // 006, 007, 008, 009, 010: Chùa Hạ, Chùa Thượng, winding Ngũ Nhạc mountain steps, Bia Đá stele & bridgehead lanterns
  const chuaHaX = tqX + 10.5;
  const chuaHaZ = tqZ - 3.5;
  addBoxPart(tcExpStone, 7.6, 0.45, 5.2, chuaHaX, bdY + 0.22, chuaHaZ);
  for (const ox of [-3.2, 0, 3.2]) {
    addCylPart(tcExpWood, 0.14, 0.16, 3.1, 6, chuaHaX + ox, bdY + 1.95, chuaHaZ + 2.0);
  }
  addBoxPart(tcExpStone, 6.8, 2.8, 3.8, chuaHaX, bdY + 1.85, chuaHaZ - 0.4);
  const haRoof = createVietnameseCurvedRoofGeometry(8.8, 6.2, 4.8, 1.4, 1.65, 0.55);
  haRoof.translate(chuaHaX, bdY + 3.22, chuaHaZ - 0.2);
  tcExpRoof.push(haRoof);
  const chuaThuongY = ctY + 12.2;
  const chuaThuongZ = ctZ - 8.5;
  addBoxPart(tcExpStone, 7.2, 2.2, 5.6, ctX, chuaThuongY - 1.1, chuaThuongZ);
  addBoxPart(tcExpStone, 5.4, 2.5, 3.8, ctX, chuaThuongY + 1.25, chuaThuongZ);
  const thuongRoof = createVietnameseCurvedRoofGeometry(7.0, 5.0, 3.8, 1.1, 1.5, 0.55);
  thuongRoof.translate(ctX, chuaThuongY + 2.48, chuaThuongZ);
  tcExpRoof.push(thuongRoof);
  for (let st = 0; st < 10; st++) {
    const f = st / 9;
    addBoxPart(tcExpStone, 2.2, 0.5, 0.9, ctX + 7.2 - f * 3.5, ctY + 0.6 + f * 11.2, ctZ - 2.0 - f * 6.5);
  }
  // 009: Bia đá tortoise stele beside Tam Quan
  addBoxPart(tcExpStone, 1.35, 0.45, 1.65, tqX - 7.5, bdY + 0.22, tqZ + 2.8);
  addBoxPart(tcExpStone, 0.92, 1.75, 0.24, tqX - 7.5, bdY + 1.32, tqZ + 2.8);
  // 010: Bridgehead lanterns
  for (const s of [-1, 1]) {
    addCylPart(tcExpWood, 0.08, 0.10, 2.2, 6, bdPondX + s * 2.2, bdY + 1.1, bdPondZ + brLen * 0.5 + 3.8);
    group.add(new THREE.Mesh(createLanternCoreGeometry(0.22, 0.38).translate(bdPondX + s * 2.2, bdY + 2.25, bdPondZ + brLen * 0.5 + 3.8), lampMat));
  }

  // 011, 012, 013, 014, 015: Scarecrows, irrigation waterwheels, bund footbridges & outer karst foothills
  for (const [scx, scz] of [[cx - 56, cz + 48], [cx - 18, cz + 66], [cx + 48, cz + 52], [cx + 92, cz + 38]] as Array<[number, number]>) {
    const scy = Math.max(1.2, ctx.getHeight(scx, scz));
    addCylPart(tcExpWood, 0.05, 0.06, 2.1, 5, scx, scy + 1.05, scz);
    addBoxPart(tcExpWood, 1.35, 0.07, 0.07, scx, scy + 1.45, scz);
    addCylPart(tcExpStraw, 0.22, 0.34, 0.85, 6, scx, scy + 1.15, scz);
    tcExpStraw.push(new THREE.ConeGeometry(0.36, 0.22, 8).translate(scx, scy + 1.92, scz));
  }
  for (const [wx, wz] of [[cx - 78, cz + 28], [cx + 68, cz + 30]] as Array<[number, number]>) {
    const wy = Math.max(0.8, ctx.getHeight(wx, wz));
    addCylPart(tcExpWood, 0.08, 0.10, 2.4, 6, wx, wy + 1.1, wz);
    const wheelRim = new THREE.TorusGeometry(1.45, 0.07, 5, 14);
    wheelRim.translate(wx, wy + 1.65, wz);
    tcExpWood.push(wheelRim);
  }
  for (let fb = -2; fb <= 2; fb++) {
    const fbx = cx + fb * 46;
    const fbz = cz + 36;
    if (Math.abs(fbz - canalCenterZ(fbx)) > 15) {
      addBoxPart(tcExpWood, 2.2, 0.12, 1.4, fbx, 1.48, fbz);
    }
  }
  for (let fh = 0; fh < 8; fh++) {
    const ang = (fh / 8) * Math.PI * 2;
    const fx = cx + Math.cos(ang) * 198;
    const fz = cz + Math.sin(ang) * 145;
    const hill = createSculptedRockGeometry(1410 + fh, 18 + (fh % 3) * 5, 22 + (fh % 2) * 10, 18, 1);
    hill.translate(fx, ctx.getHeight(fx, fz) + 8.0, fz);
    tcExpStone.push(hill);
  }

  // --- Wave 2 Macro Visual QC & Expansion (201–215): Tam Cốc Đền Thái Vi & River Shrines ---
  // 201–205: Đền Thái Vi pulled cleanly outside karst tower [-48, -58, 28, 76] into open valley with deep stone retaining plinth!
  const tvX = cx - 42;
  const tvZ = cz - 24;
  const tvY = Math.max(1.2, ctx.getHeight(tvX, tvZ), ctx.getHeight(tvX - 4, tvZ), ctx.getHeight(tvX + 4, tvZ));
  addBoxPart(tcExpStone, 9.6, 2.55, 6.6, tvX, tvY - 0.72, tvZ);
  addBoxPart(tcExpStone, 7.6, 2.6, 4.4, tvX, tvY + 1.85, tvZ - 0.3);
  for (const ox of [-3.2, -1.1, 1.1, 3.2]) {
    addCylPart(tcExpStone, 0.14, 0.16, 2.7, 5, tvX + ox, tvY + 1.9, tvZ + 2.3);
  }
  addConePart(tcExpRoof, 6.2, 2.1, 4, tvX, tvY + 4.2, tvZ, Math.PI * 0.25);
  // 202: Đền Thái Vi Tam Quan gate
  for (const gx of [-2.8, -1.0, 1.0, 2.8]) {
    addBoxPart(tcExpStone, 0.45, 3.2, 0.45, tvX + gx, tvY + 1.6, tvZ + 8.5);
  }
  addBoxPart(tcExpRoof, 6.8, 0.45, 1.4, tvX, tvY + 3.4, tvZ + 8.5);
  addConePart(tcExpRoof, 2.2, 1.1, 4, tvX, tvY + 4.2, tvZ + 8.5, Math.PI * 0.25);
  // 203: Giếng Ngọc courtyard well
  addBoxPart(tcExpStone, 2.4, 0.65, 2.4, tvX - 6.2, tvY + 0.32, tvZ + 4.8);
  // 204: Twin Lầu Chuông & Lầu Trống pavilions
  for (const side of [-1, 1]) {
    addBoxPart(tcExpStone, 2.4, 0.4, 2.4, tvX + side * 7.8, tvY + 0.2, tvZ + 2.0);
    addBoxPart(tcExpWood, 2.0, 2.2, 2.0, tvX + side * 7.8, tvY + 1.5, tvZ + 2.0);
    addConePart(tcExpRoof, 2.1, 1.15, 4, tvX + side * 7.8, tvY + 3.15, tvZ + 2.0, Math.PI * 0.25);
    addCylPart(tcExpGold, 0.26, 0.32, 0.55, 5, tvX + side * 7.8, tvY + 1.65, tvZ + 2.0);
  }
  // 205: Cây Hương Đá monolithic incense altar
  addCylPart(tcExpStone, 0.16, 0.22, 1.3, 5, tvX, tvY + 0.65, tvZ + 5.2);
  addBoxPart(tcExpStone, 0.72, 0.55, 0.72, tvX, tvY + 1.55, tvZ + 5.2);
  addCylPart(tcExpGold, 0.14, 0.12, 0.22, 5, tvX, tvY + 1.92, tvZ + 5.2);
  // 206: 3 Authentic foot-rowing sampans (Thuyền Chèo Chân) moored along Văn Lâm edge
  for (let s = 0; s < 3; s++) {
    const sx = pierX + 8.5 + s * 6.2;
    const sz = canalCenterZ(sx) - 6.4;
    addBoxPart(tcExpWood, 4.4, 0.34, 1.05, sx, VIETNAM_WATER_LEVEL + 0.18, sz, 0.18);
    addCylPart(tcExpWood, 0.04, 0.04, 2.4, 5, sx - 1.4, VIETNAM_WATER_LEVEL + 0.45, sz + 0.48, 0.55, 0.35);
    addConePart(tcExpStraw, 0.26, 0.18, 5, sx - 1.3, VIETNAM_WATER_LEVEL + 1.15, sz);
  }
  // 207 & 208: Miếu Hang Cả & Miếu Hang Hai cave-mouth limestone guardian shrines
  for (const [mx, mz] of [[cx - 14, canalCenterZ(cx - 14) - 10.5], [cx - 56, canalCenterZ(cx - 56) - 11.0]] as Array<[number, number]>) {
    addBoxPart(tcExpStone, 1.6, 1.4, 1.2, mx, 1.8, mz);
    addConePart(tcExpRoof, 1.35, 0.65, 4, mx, 2.82, mz, Math.PI * 0.25);
    addCylPart(tcExpGold, 0.15, 0.12, 0.24, 5, mx, 2.15, mz + 0.45);
  }
  // 209: Bến Thuyền Văn Lâm ticket booth & grounded queue barrier rails
  addBoxPart(tcExpWood, 2.4, 2.2, 1.6, pavX + 4.8, pavY + 1.1, pavZ + 1.2);
  addConePart(tcExpRoof, 2.0, 0.75, 4, pavX + 4.8, pavY + 2.55, pavZ + 1.2, Math.PI * 0.25);
  addBoxPart(tcExpWood, 4.8, 0.08, 0.08, pierX - 2.2, pavY + 0.9, pierZ - 2.2);
  addCylPart(tcExpWood, 0.04, 0.05, 0.95, 5, pierX - 4.5, pavY + 0.45, pierZ - 2.2);
  addCylPart(tcExpWood, 0.04, 0.05, 0.95, 5, pierX + 0.1, pavY + 0.45, pierZ - 2.2);
  // 210: 3 Narrow bamboo-and-timber irrigation footbridges with grounded handrail posts
  for (const [bx, bz] of [[cx - 32, cz + 46], [cx + 12, cz + 56], [cx + 58, cz + 44]] as Array<[number, number]>) {
    addBoxPart(tcExpWood, 3.2, 0.10, 0.95, bx, 1.52, bz);
    addBoxPart(tcExpWood, 3.2, 0.06, 0.06, bx, 2.25, bz + 0.45);
    addCylPart(tcExpWood, 0.04, 0.05, 1.2, 5, bx - 1.5, 1.72, bz + 0.45);
    addCylPart(tcExpWood, 0.04, 0.05, 1.2, 5, bx + 1.5, 1.72, bz + 0.45);
  }
  // 211: 2 Elevated bamboo harvest watch-huts (Lều Canh Lúa)
  for (const [lx, lz] of [[cx - 72, cz + 52], [cx + 76, cz + 48]] as Array<[number, number]>) {
    const ly = Math.max(1.2, ctx.getHeight(lx, lz));
    addBoxPart(tcExpWood, 1.8, 0.14, 1.8, lx, ly + 1.6, lz);
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      addCylPart(tcExpWood, 0.05, 0.06, 2.8, 5, lx + ox, ly + 1.4, lz + oz);
    }
    addConePart(tcExpStraw, 1.65, 1.1, 4, lx, ly + 3.25, lz, Math.PI * 0.25);
  }
  // 212: 4 Conical harvested rice-straw ricks (Đống Rơm Gặt Mùa)
  for (const [rx, rz] of [[cx - 48, cz + 62], [cx - 42, cz + 64], [cx + 38, cz + 60], [cx + 44, cz + 62]] as Array<[number, number]>) {
    const ry = Math.max(1.2, ctx.getHeight(rx, rz));
    addCylPart(tcExpStraw, 1.1, 1.35, 1.2, 6, rx, ry + 0.6, rz);
    addConePart(tcExpStraw, 1.25, 1.3, 6, rx, ry + 1.8, rz);
  }
  // 213–215: Heritage trailhead stele, southern stepped stone landing & 8 slanted bamboo mooring stakes
  addBoxPart(tcExpStone, 1.2, 1.8, 0.28, pavX - 4.4, pavY + 0.9, pavZ + 2.6);
  for (let st = 0; st < 3; st++) {
    addBoxPart(tcExpStone, 4.6, 0.26, 0.8, pierX + 2.0, VIETNAM_WATER_LEVEL + 0.2 + st * 0.25, canalCenterZ(pierX + 2.0) + 9.2 + st * 0.7);
  }
  for (let k = 0; k < 8; k++) {
    const kx = cx - 36 + k * 9.5;
    addCylPart(tcExpWood, 0.05, 0.06, 1.85, 5, kx, VIETNAM_WATER_LEVEL + 0.75, canalCenterZ(kx) + (k % 2 === 0 ? -8.2 : 8.2), 0, 0.14);
  }

  // --- Wave 3 Macro Visual QC & Expansion (401–429): Hang Múa Dragon Steps, Đền Thái Vi Courtyard & Ngô Đồng Docks ---
  const w3TcStone: THREE.BufferGeometry[] = [];
  const w3TcWood: THREE.BufferGeometry[] = [];
  const w3TcRoof: THREE.BufferGeometry[] = [];
  const w3TcStraw: THREE.BufferGeometry[] = [];
  const w3TcGold: THREE.BufferGeometry[] = [];
  const w3TcCrimson: THREE.BufferGeometry[] = [];
  // 401–405: Hang Múa overlook zigzag stone steps, Ngọa Long stone dragon crest, Quan Âm shrine, summit bell tower & mid-climb rest landing (cleanly on open SE slope outside karst radii)
  const hmBaseX = cx + 86;
  const hmBaseZ = cz + 26;
  const hmBaseY = Math.max(1.4, ctx.getHeight(hmBaseX, hmBaseZ));
  for (let st = 0; st < 12; st++) {
    const sx = hmBaseX + st * 1.45;
    const sz = hmBaseZ - Math.sin(st * 0.55) * 2.4;
    const sy = hmBaseY + st * 0.55;
    addW3Plinth(w3TcStone, 2.2, 3.0, sy + 0.35, hmBaseY, sx, sz);
    addBoxPart(w3TcStone, 1.8, 0.52, 0.24, sx, sy + 0.62, sz - 1.38);
    addBoxPart(w3TcStone, 1.8, 0.52, 0.24, sx, sy + 0.62, sz + 1.38);
  }
  // 405: Mid-climb rest landing & bench
  const hmMidX = hmBaseX + 8.5;
  const hmMidZ = hmBaseZ + 3.2;
  const hmMidY = hmBaseY + 3.6;
  addW3Plinth(w3TcStone, 4.4, 3.4, hmMidY, hmBaseY, hmMidX, hmMidZ);
  addBoxPart(w3TcStone, 1.8, 0.45, 0.55, hmMidX, hmMidY + 0.22, hmMidZ + 1.1);
  addCylPart(w3TcGold, 0.14, 0.12, 0.28, 5, hmMidX - 1.4, hmMidY + 0.35, hmMidZ);
  // 402–404: Summit ridge plinth, Ngọa Long winding stone dragon crest, Quan Âm shrine & Tháp Ngọa Long stupa
  const hmTopX = hmBaseX + 19.5;
  const hmTopZ = hmBaseZ - 1.2;
  const hmTopY = hmBaseY + 6.9;
  addW3Plinth(w3TcStone, 11.0, 7.6, hmTopY, hmBaseY, hmTopX, hmTopZ);
  for (let seg = 0; seg < 7; seg++) {
    const dx = hmTopX - 4.2 + seg * 1.35;
    const dz = hmTopZ - 2.2 + Math.sin(seg * 0.9) * 0.95;
    const dh = 0.72 + Math.sin(seg * 0.8) * 0.28;
    addBoxPart(w3TcStone, 1.25, dh, 0.68, dx, hmTopY + dh * 0.5, dz, Math.cos(seg * 0.9) * 0.35);
    addConePart(w3TcGold, 0.14, 0.28, 4, dx, hmTopY + dh + 0.12, dz);
  }
  addBoxPart(w3TcStone, 0.95, 0.85, 0.82, hmTopX + 4.8, hmTopY + 1.05, hmTopZ - 2.1); // Dragon head
  // 403: Quan Âm overlook shrine
  addCylPart(w3TcStone, 0.95, 1.15, 0.65, 6, hmTopX - 2.6, hmTopY + 0.32, hmTopZ + 1.8);
  addCylPart(w3TcGold, 0.28, 0.42, 1.55, 6, hmTopX - 2.6, hmTopY + 1.42, hmTopZ + 1.8);
  // 404: Tháp Ngọa Long bell-tower stupa
  addBoxPart(w3TcStone, 2.6, 2.2, 2.6, hmTopX + 2.8, hmTopY + 1.1, hmTopZ + 1.8);
  addW3HipRoof(w3TcRoof, w3TcGold, 3.3, 3.3, hmTopY + 2.2, 1.05, hmTopX + 2.8, hmTopZ + 1.8);
  // 406–411: Đền Thái Vi blue-stone dragon courtyard, twin steles, bronze bell frame, Tả/Hữu Mạc waiting houses, Ngũ Đại Môn pillars & lacquered screen
  addBoxPart(w3TcStone, 12.6, 0.22, 6.2, tvX, tvY + 0.11, tvZ + 5.2);
  for (const side of [-1, 1]) {
    // 407: Courtyard steles on tortoise plinths
    addBoxPart(w3TcStone, 1.1, 0.42, 0.85, tvX + side * 4.4, tvY + 0.21, tvZ + 6.4);
    addBoxPart(w3TcStone, 0.72, 1.45, 0.22, tvX + side * 4.4, tvY + 1.12, tvZ + 6.4);
    // 409: Tả/Hữu Mạc waiting houses
    const mx = tvX + side * 11.4;
    const mz = tvZ + 5.6;
    const my = Math.max(1.2, ctx.getHeight(mx, mz));
    addW3Plinth(w3TcStone, 3.6, 5.4, my + 0.35, my, mx, mz);
    for (const [cxOff, czOff] of [[-1.3, -2.1], [1.3, -2.1], [-1.3, 2.1], [1.3, 2.1]]) {
      addW3GroundedCol(w3TcWood, 0.10, 0.12, my + 2.55, my + 0.35, 5, mx + cxOff, mz + czOff);
    }
    addW3HipRoof(w3TcRoof, w3TcGold, 4.2, 6.0, my + 2.55, 1.05, mx, mz);
  }
  // 408: Ancient bronze bell A-frame & striker inside eastern bell house
  addW3GroundedPost(w3TcWood, 0.12, 0.12, tvY + 2.3, tvY + 0.4, tvX + 7.2, tvZ + 2.0);
  addW3GroundedPost(w3TcWood, 0.12, 0.12, tvY + 2.3, tvY + 0.4, tvX + 8.4, tvZ + 2.0);
  addBoxPart(w3TcWood, 1.5, 0.14, 0.14, tvX + 7.8, tvY + 2.25, tvZ + 2.0);
  addCylPart(w3TcWood, 0.06, 0.06, 1.25, 5, tvX + 7.8, tvY + 1.55, tvZ + 2.75, Math.PI * 0.5, 0);
  // 410 & 411: Ngũ Đại Môn 5 stone pillars & lacquered altar lintel board
  for (let p = -2; p <= 2; p++) {
    addW3GroundedPost(w3TcStone, 0.28, 0.28, tvY + 2.55, tvY + 0.2, tvX + p * 1.45, tvZ + 3.2);
    addConePart(w3TcGold, 0.14, 0.24, 4, tvX + p * 1.45, tvY + 2.68, tvZ + 3.2);
  }
  addBoxPart(w3TcCrimson, 3.2, 0.52, 0.16, tvX, tvY + 3.15, tvZ + 2.35);
  addBoxPart(w3TcGold, 2.8, 0.32, 0.18, tvX, tvY + 3.15, tvZ + 2.38);
  // 412–415: Ngô Đồng boat-dock sun awnings, Văn Lâm embroidery stall, 6 berth posts & oar rack
  for (let a = 0; a < 3; a++) {
    const ax = pierX - 2.6 + a * 3.8;
    const az = pierZ - 3.6;
    const ay = Math.max(0.8, ctx.getHeight(ax, az));
    addW3GroundedCol(w3TcWood, 0.07, 0.08, ay + 2.45, ay, 5, ax - 1.4, az - 1.1);
    addW3GroundedCol(w3TcWood, 0.07, 0.08, ay + 2.45, ay, 5, ax + 1.4, az - 1.1);
    addW3GroundedCol(w3TcWood, 0.07, 0.08, ay + 2.15, ay, 5, ax - 1.4, az + 1.1);
    addW3GroundedCol(w3TcWood, 0.07, 0.08, ay + 2.15, ay, 5, ax + 1.4, az + 1.1);
    addBoxPart(w3TcStraw, 3.3, 0.14, 2.5, ax, ay + 2.35, az, 0, 0.12, 0);
  }
  // 413: Văn Lâm embroidery craft stall
  const embX = pavX - 5.2;
  const embZ = pavZ - 0.8;
  const embY = Math.max(0.8, ctx.getHeight(embX, embZ));
  addBoxPart(w3TcWood, 2.8, 0.82, 1.2, embX, embY + 0.41, embZ);
  addBoxPart(w3TcCrimson, 0.85, 0.65, 0.10, embX - 0.6, embY + 1.15, embZ);
  addBoxPart(w3TcGold, 0.85, 0.65, 0.10, embX + 0.6, embY + 1.15, embZ);
  // 414 & 415: 6 Berth marker posts & oar/cushion rack
  for (let b = 0; b < 6; b++) {
    const bx = pierX + 5.8 + b * 4.2;
    const bz = canalCenterZ(bx) - 8.4;
    addW3GroundedCol(w3TcWood, 0.09, 0.11, VIETNAM_WATER_LEVEL + 1.45, VIETNAM_WATER_LEVEL - 0.4, 5, bx, bz);
    addCylPart(w3TcCrimson, 0.11, 0.11, 0.24, 5, bx, VIETNAM_WATER_LEVEL + 1.38, bz);
  }
  addBoxPart(w3TcWood, 2.4, 1.35, 0.45, pavX + 7.2, pavY + 0.68, pavZ + 1.2);
  addBoxPart(w3TcStraw, 0.9, 0.55, 0.48, pavX + 7.2, pavY + 0.55, pavZ + 1.55);
  // 416–419: Hang Ba shrine niche, Miếu Sơn Thần, Bích Động lotus boardwalk & stone drum stand
  const hbX = cx + 38;
  const hbZ = canalCenterZ(hbX) - 11.2;
  const hbY = Math.max(1.2, ctx.getHeight(hbX, hbZ));
  addW3Plinth(w3TcStone, 1.8, 1.4, hbY + 1.1, hbY, hbX, hbZ);
  addW3HipRoof(w3TcRoof, w3TcGold, 2.1, 1.7, hbY + 1.1, 0.65, hbX, hbZ);
  const stX = cx + 10;
  const stZ = cz - 36;
  const stY = Math.max(1.4, ctx.getHeight(stX, stZ));
  addW3Plinth(w3TcStone, 2.4, 2.2, stY + 1.25, stY, stX, stZ);
  addW3HipRoof(w3TcRoof, w3TcGold, 2.9, 2.6, stY + 1.25, 0.85, stX, stZ);
  const bdWlkX = cx + 52;
  const bdWlkZ = cz - 14;
  addBoxPart(w3TcWood, 12.0, 0.16, 1.8, bdWlkX, VIETNAM_WATER_LEVEL + 0.62, bdWlkZ);
  for (let p = -2; p <= 2; p++) {
    addW3GroundedCol(w3TcWood, 0.08, 0.10, VIETNAM_WATER_LEVEL + 0.58, VIETNAM_WATER_LEVEL - 0.6, 5, bdWlkX + p * 2.6, bdWlkZ - 0.78);
    addW3GroundedCol(w3TcWood, 0.08, 0.10, VIETNAM_WATER_LEVEL + 0.58, VIETNAM_WATER_LEVEL - 0.6, 5, bdWlkX + p * 2.6, bdWlkZ + 0.78);
  }
  const drStX = cx + 76;
  const drStZ = cz - 18;
  const drStY = Math.max(1.2, ctx.getHeight(drStX, drStZ));
  addW3Plinth(w3TcStone, 1.2, 0.9, drStY + 0.65, drStY, drStX, drStZ);
  addCylPart(w3TcCrimson, 0.42, 0.42, 0.65, 6, drStX, drStY + 0.92, drStZ, 0, Math.PI * 0.5);
  // 420–429: Sluice gate, threshing sled, conical-hat rack, buffalo-cart shed, riverbank steps, panorama deck, signpost, water trough, pier lanterns & bamboo village arch
  addBoxPart(w3TcStone, 2.2, 1.1, 0.55, cx - 18, 1.4, cz + 46);
  addBoxPart(w3TcWood, 1.1, 1.5, 0.14, cx - 18, 1.75, cz + 46);
  const thY = Math.max(1.2, ctx.getHeight(cx + 18, cz + 52));
  addBoxPart(w3TcWood, 1.8, 0.85, 1.3, cx + 18, thY + 0.42, cz + 52);
  addBoxPart(w3TcStraw, 3.2, 0.08, 2.4, cx + 21, thY + 0.04, cz + 52);
  const hatY = Math.max(1.2, ctx.getHeight(pavX - 9.5, pavZ + 2.2));
  addW3GroundedPost(w3TcWood, 0.08, 0.08, hatY + 1.8, hatY, pavX - 10.6, pavZ + 2.2);
  addW3GroundedPost(w3TcWood, 0.08, 0.08, hatY + 1.8, hatY, pavX - 8.4, pavZ + 2.2);
  addBoxPart(w3TcWood, 2.4, 0.08, 0.08, pavX - 9.5, hatY + 1.75, pavZ + 2.2);
  for (const hxOff of [-0.6, 0, 0.6]) addConePart(w3TcStraw, 0.24, 0.18, 5, pavX - 9.5 + hxOff, hatY + 1.52, pavZ + 2.2);
  const bcX = cx - 64;
  const bcZ = cz + 38;
  const bcY = Math.max(1.2, ctx.getHeight(bcX, bcZ));
  for (const [ox, oz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) {
    addW3GroundedCol(w3TcWood, 0.08, 0.09, bcY + 2.2, bcY, 5, bcX + ox, bcZ + oz);
  }
  addBoxPart(w3TcStraw, 3.8, 0.18, 3.0, bcX, bcY + 2.28, bcZ, 0, 0.15, 0);
  addCylPart(w3TcWood, 0.46, 0.46, 0.10, 6, bcX, bcY + 0.48, bcZ - 0.72, 0, Math.PI * 0.5);
  addCylPart(w3TcWood, 0.46, 0.46, 0.10, 6, bcX, bcY + 0.48, bcZ + 0.72, 0, Math.PI * 0.5);
  for (let rs = 0; rs < 4; rs++) {
    addBoxPart(w3TcStone, 5.2, 0.24, 0.75, tvX + 18, VIETNAM_WATER_LEVEL + 0.2 + rs * 0.22, canalCenterZ(tvX + 18) - 9.4 - rs * 0.65);
  }
  const dkX = cx + 4;
  const dkZ = cz + 38;
  const dkY = Math.max(1.2, ctx.getHeight(dkX, dkZ));
  addW3Plinth(w3TcStone, 5.8, 4.2, dkY + 0.55, dkY, dkX, dkZ);
  addBoxPart(w3TcWood, 5.6, 0.14, 4.0, dkX, dkY + 0.62, dkZ);
  addBoxPart(w3TcWood, 5.6, 0.10, 0.10, dkX, dkY + 1.52, dkZ + 1.9);
  addW3GroundedPost(w3TcWood, 0.10, 0.10, dkY + 1.55, dkY + 0.55, dkX - 2.6, dkZ + 1.9);
  addW3GroundedPost(w3TcWood, 0.10, 0.10, dkY + 1.55, dkY + 0.55, dkX + 2.6, dkZ + 1.9);
  addW3GroundedPost(w3TcWood, 0.12, 0.12, pavY + 2.4, pavY, pavX + 1.2, pavZ + 4.8);
  addBoxPart(w3TcWood, 1.35, 0.28, 0.08, pavX + 1.8, pavY + 2.15, pavZ + 4.8);
  addBoxPart(w3TcStone, 1.8, 0.55, 0.85, cx + 64, Math.max(1.2, ctx.getHeight(cx + 64, cz + 36)) + 0.28, cz + 36);
  for (const lxOff of [-3.6, 3.6]) {
    addW3GroundedPost(w3TcStone, 0.34, 0.34, 1.85, 0.4, pierX + lxOff, pierZ + 2.1);
    addConePart(w3TcGold, 0.26, 0.32, 4, pierX + lxOff, 2.02, pierZ + 2.1);
  }
  const arX = pavX - 11.5;
  const arZ = pavZ - 5.0;
  const arY = Math.max(0.9, ctx.getHeight(arX, arZ));
  addW3GroundedCol(w3TcWood, 0.12, 0.14, arY + 3.6, arY, 5, arX - 2.2, arZ);
  addW3GroundedCol(w3TcWood, 0.12, 0.14, arY + 3.6, arY, 5, arX + 2.2, arZ);
  addBoxPart(w3TcWood, 5.2, 0.24, 0.32, arX, arY + 3.55, arZ);
  addW3HipRoof(w3TcRoof, null, 5.6, 1.25, arY + 3.65, 0.65, arX, arZ);

  addWave3Mesh(group, w3TcStone, ctx.materials.granite);
  addWave3Mesh(group, w3TcWood, ctx.materials.darkWood);
  addWave3Mesh(group, w3TcRoof, mossyRoofMat);
  addWave3Mesh(group, w3TcStraw, strawMat);
  addWave3Mesh(group, w3TcGold, ctx.materials.gold);
  addWave3Mesh(group, w3TcCrimson, ctx.materials.crimsonLacquer);

  // --- Wave 4 Macro Visual QC & Outer Expansion (801–829): Hang Múa Lotus Walk, Limestone Kiln, Văn Lâm Crafts & Outer Rice Berms ---
  const w4TcStone: THREE.BufferGeometry[] = [];
  const w4TcWood: THREE.BufferGeometry[] = [];
  const w4TcRoof: THREE.BufferGeometry[] = [];
  const w4TcStraw: THREE.BufferGeometry[] = [];
  const w4TcGold: THREE.BufferGeometry[] = [];
  const w4TcCrimson: THREE.BufferGeometry[] = [];
  // 801 & 802: Hang Múa outer lotus-pond zigzag footbridge & octagonal thatched viewing hut
  const hmLPx = cx + 82;
  const hmLPz = cz + 14;
  const hmLPy = Math.max(VIETNAM_WATER_LEVEL + 0.55, ctx.getHeight(hmLPx, hmLPz));
  for (let s = 0; s < 3; s++) {
    const sx = hmLPx + s * 5.2;
    const sz = hmLPz + (s % 2 === 0 ? -1.4 : 1.4);
    addBoxPart(w4TcWood, 5.4, 0.14, 1.5, sx, hmLPy, sz, s % 2 === 0 ? 0.28 : -0.28);
    addW3GroundedCol(w4TcWood, 0.08, 0.10, hmLPy, hmLPy - 1.2, 5, sx - 2.2, sz);
    addW3GroundedCol(w4TcWood, 0.08, 0.10, hmLPy, hmLPy - 1.2, 5, sx + 2.2, sz);
  }
  const vhX = hmLPx + 15.5;
  const vhZ = hmLPz + 2.8;
  const vhY = Math.max(1.0, ctx.getHeight(vhX, vhZ), ctx.getHeight(vhX + 2, vhZ));
  addW3Plinth(w4TcStone, 3.8, 3.8, vhY + 0.32, vhY, vhX, vhZ);
  for (let c = 0; c < 4; c++) {
    const ca = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
    addW3GroundedCol(w4TcWood, 0.08, 0.10, vhY + 2.55, vhY + 0.32, 5, vhX + Math.cos(ca) * 1.4, vhZ + Math.sin(ca) * 1.4);
  }
  addConePart(w4TcStraw, 2.6, 1.25, 6, vhX, vhY + 3.15, vhZ);
  // 803 & 804: Ninh Bình mountain-goat herding pen & traditional limestone lime-kiln ruin (Lò Vôi Cổ)
  const gpX = cx + 114;
  const gpZ = cz + 28;
  const gpY = Math.max(1.2, ctx.getHeight(gpX, gpZ));
  for (const [ox, oz, w, d] of [[0, -2.6, 6.2, 0.35], [0, 2.6, 6.2, 0.35], [-3.0, 0, 0.35, 5.2], [3.0, 0, 0.35, 5.2]] as Array<[number, number, number, number]>) {
    addBoxPart(w4TcStone, w, 0.95, d, gpX + ox, gpY + 0.48, gpZ + oz);
  }
  const lkX = cx + 22;
  const lkZ = cz - 52;
  const lkY = Math.max(1.5, ctx.getHeight(lkX, lkZ));
  addCylPart(w4TcStone, 1.55, 2.05, 4.2, 6, lkX, lkY + 2.1, lkZ);
  addBoxPart(w4TcStone, 1.2, 1.35, 0.9, lkX, lkY + 0.68, lkZ + 1.85);
  // 805 & 806: Paddy bird-scarer bamboo clapper line & 5 harvest rice-sheaf drying stacks (Cây Rơm Vàng)
  for (let p = 0; p < 4; p++) {
    const px = cx - 84 + p * 8.5;
    const pz = cz + 72;
    const py = Math.max(1.0, ctx.getHeight(px, pz));
    addW3GroundedCol(w4TcWood, 0.05, 0.06, py + 2.6, py, 5, px, pz);
    addBoxPart(w4TcStraw, 0.65, 0.14, 0.14, px, py + 2.35, pz);
  }
  for (let r = 0; r < 5; r++) {
    const rx = cx + 52 + r * 6.2;
    const rz = cz + 76;
    const ry = Math.max(1.0, ctx.getHeight(rx, rz));
    addCylPart(w4TcStraw, 1.15, 1.35, 1.25, 6, rx, ry + 0.62, rz);
    addConePart(w4TcStraw, 1.28, 1.35, 6, rx, ry + 1.9, rz);
  }
  // 807–812: River mile-markers, Bích Động lantern niches, Văn Lâm silk rack, stone culvert bridge, mooring bollards & sketcher bench
  for (let m = 0; m < 3; m++) {
    const mx = cx - 95 + m * 95;
    const mz = canalCenterZ(mx) + 12.2;
    addW3GroundedPost(w4TcStone, 0.42, 0.32, Math.max(1.0, ctx.getHeight(mx, mz)) + 1.35, Math.max(1.0, ctx.getHeight(mx, mz)), mx, mz);
  }
  for (const s of [-1, 1]) {
    addW3GroundedPost(w4TcStone, 0.45, 0.45, bdY + 1.65, bdY, tqX + s * 6.8, tqZ + 5.5);
    addConePart(w4TcGold, 0.32, 0.35, 4, tqX + s * 6.8, bdY + 1.82, tqZ + 5.5);
  }
  const dyX = pavX - 18.5;
  const dyZ = pavZ - 4.0;
  const dyY = Math.max(1.0, ctx.getHeight(dyX, dyZ));
  for (const ox of [-1.8, 1.8]) addW3GroundedPost(w4TcWood, 0.09, 0.09, dyY + 2.35, dyY, dyX + ox, dyZ);
  addBoxPart(w4TcCrimson, 3.4, 1.45, 0.08, dyX, dyY + 1.55, dyZ);
  addBoxPart(w4TcStone, 3.6, 0.32, 1.85, cx + 88, Math.max(1.0, ctx.getHeight(cx + 88, cz + 44)) + 0.25, cz + 44);
  for (let b = 0; b < 4; b++) addW3GroundedCol(w4TcStone, 0.18, 0.22, VIETNAM_WATER_LEVEL + 1.25, VIETNAM_WATER_LEVEL - 0.5, 5, pierX - 12 - b * 3.2, pierZ + 1.8);
  const skY = Math.max(1.2, ctx.getHeight(cx - 28, cz + 78));
  addBoxPart(w4TcStone, 2.2, 0.52, 0.68, cx - 28, skY + 0.26, cz + 78);
  addBoxPart(w4TcWood, 0.9, 1.35, 0.14, cx - 26.2, skY + 0.68, cz + 77.6, -0.35);
  // 813–820: Lotus-seed mats, sedge-mat weaving lean-to, village stone well, gầu sòng tripod, Đền Thái Vi spirit screen & flagpoles, Hang Múa kiosk & fountain
  for (let t = 0; t < 3; t++) addCylPart(w4TcStraw, 0.68, 0.68, 0.08, 6, hmLPx - 4.5 + t * 1.8, hmLPy + 0.45, hmLPz + 4.5);
  const smX = pavX - 24;
  const smZ = pavZ - 12;
  const smY = Math.max(1.0, ctx.getHeight(smX, smZ), ctx.getHeight(smX + 2, smZ));
  addW3Plinth(w4TcStone, 4.4, 3.2, smY + 0.25, smY, smX, smZ);
  for (const [ox, oz] of [[-1.8, -1.2], [1.8, -1.2], [-1.8, 1.2], [1.8, 1.2]]) addW3GroundedCol(w4TcWood, 0.08, 0.10, smY + 2.35, smY + 0.25, 5, smX + ox, smZ + oz);
  addBoxPart(w4TcStraw, 4.8, 0.18, 3.6, smX, smY + 2.42, smZ, 0, 0.16, 0);
  addCylPart(w4TcStone, 0.92, 0.98, 0.78, 6, pavX - 16, dyY + 0.39, pavZ - 14);
  for (let g = 0; g < 3; g++) {
    const ga = (g / 3) * Math.PI * 2;
    addCylPart(w4TcWood, 0.04, 0.05, 2.2, 4, cx + 14 + Math.cos(ga) * 0.45, Math.max(1.0, ctx.getHeight(cx + 14, cz + 68)) + 0.95, cz + 68 + Math.sin(ga) * 0.45, 0.25, ga);
  }
  addBoxPart(w4TcStone, 4.2, 2.1, 0.42, tvX, tvY + 1.05, tvZ + 12.8);
  for (const s of [-1, 1]) {
    addW3GroundedCol(w4TcWood, 0.06, 0.08, tvY + 5.8, tvY, 5, tvX + s * 6.5, tvZ + 12.2);
    addBoxPart(w4TcCrimson, 1.2, 0.78, 0.06, tvX + s * 6.5 + 0.6, tvY + 5.1, tvZ + 12.2);
  }
  const hkX = cx + 98;
  const hkZ = cz - 14;
  const hkY = Math.max(1.4, ctx.getHeight(hkX, hkZ), ctx.getHeight(hkX + 2, hkZ));
  addW3Plinth(w4TcStone, 3.6, 2.8, hkY + 0.32, hkY, hkX, hkZ);
  addBoxPart(w4TcWood, 3.0, 2.1, 2.2, hkX, hkY + 1.37, hkZ);
  addW3HipRoof(w4TcRoof, w4TcGold, 3.8, 3.0, hkY + 2.42, 0.85, hkX, hkZ);
  addCylPart(w4TcStone, 0.68, 0.52, 0.78, 6, hkX - 3.6, hkY + 0.39, hkZ + 1.2);
  // 821–829: Fish-trap stack, rain-cape stand, 4 direction bollards, plough display, bronze gong cradle, riverbank fascine, notice shelter, Miếu Thổ Công & outer lookout tower
  for (let f = 0; f < 3; f++) addConePart(w4TcStraw, 0.32, 0.95, 5, pierX - 18 + f * 0.8, VIETNAM_WATER_LEVEL + 1.15, pierZ - 2.2, 0, 1.3, 0);
  addW3GroundedPost(w4TcWood, 0.10, 0.10, pavY + 1.85, pavY, pavX + 4.8, pavZ - 2.4);
  for (let d = 0; d < 4; d++) addW3GroundedPost(w4TcStone, 0.28, 0.28, Math.max(1.0, ctx.getHeight(cx + 30 + d * 18, cz + 18)) + 0.95, Math.max(1.0, ctx.getHeight(cx + 30 + d * 18, cz + 18)), cx + 30 + d * 18, cz + 18);
  addBoxPart(w4TcWood, 1.9, 0.42, 0.22, cx - 54, Math.max(1.0, ctx.getHeight(cx - 54, cz + 72)) + 0.35, cz + 72, 0.35);
  addW3GroundedPost(w4TcWood, 0.10, 0.10, bdY + 2.2, bdY, tqX - 8.5, tqZ - 2.0);
  addCylPart(w4TcGold, 0.48, 0.48, 0.12, 6, tqX - 8.5, bdY + 1.55, tqZ - 2.0, Math.PI * 0.5, 0);
  addBoxPart(w4TcWood, 14.0, 0.55, 0.45, cx + 108, VIETNAM_WATER_LEVEL + 0.35, canalCenterZ(cx + 108) - 10.2);
  const ntY = Math.max(1.0, ctx.getHeight(pavX - 14, pavZ - 10));
  addW3GroundedPost(w4TcWood, 0.12, 0.12, ntY + 2.2, ntY, pavX - 14, pavZ - 10);
  addBoxPart(w4TcWood, 1.8, 1.1, 0.16, pavX - 14, ntY + 1.55, pavZ - 10);
  addW3HipRoof(w4TcRoof, null, 2.2, 1.1, ntY + 2.2, 0.45, pavX - 14, pavZ - 10);
  const tcMtY = Math.max(1.0, ctx.getHeight(cx - 6, cz + 78));
  addW3Plinth(w4TcStone, 1.1, 1.1, tcMtY + 1.25, tcMtY, cx - 6, cz + 78);
  addW3HipRoof(w4TcRoof, null, 1.4, 1.4, tcMtY + 1.25, 0.42, cx - 6, cz + 78);
  const ltX = cx + 18;
  const ltZ = cz + 86;
  const ltY = Math.max(1.2, ctx.getHeight(ltX, ltZ), ctx.getHeight(ltX + 2, ltZ));
  addW3Plinth(w4TcStone, 4.2, 4.2, ltY + 0.35, ltY, ltX, ltZ);
  for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) addW3GroundedCol(w4TcWood, 0.11, 0.13, ltY + 5.4, ltY + 0.35, 5, ltX + ox, ltZ + oz);
  addBoxPart(w4TcWood, 3.6, 0.22, 3.6, ltX, ltY + 3.2, ltZ);
  addW3HipRoof(w4TcRoof, w4TcGold, 4.4, 4.4, ltY + 5.4, 1.15, ltX, ltZ);

  addWave3Mesh(group, w4TcStone, ctx.materials.granite);
  addWave3Mesh(group, w4TcWood, ctx.materials.darkWood);
  addWave3Mesh(group, w4TcRoof, mossyRoofMat);
  addWave3Mesh(group, w4TcStraw, strawMat);
  addWave3Mesh(group, w4TcGold, ctx.materials.gold);
  addWave3Mesh(group, w4TcCrimson, ctx.materials.crimsonLacquer);

  // --- Wave 5 Macro Visual QC & Heritage Details (1201–1229): Đền Thái Vi Bell-Tower, Stele House, Văn Lâm Crafts & Karst Trail ---
  const w5TcStone: THREE.BufferGeometry[] = [];
  const w5TcWood: THREE.BufferGeometry[] = [];
  const w5TcRoof: THREE.BufferGeometry[] = [];
  const w5TcStraw: THREE.BufferGeometry[] = [];
  const w5TcGold: THREE.BufferGeometry[] = [];
  const w5TcCrimson: THREE.BufferGeometry[] = [];
  // 1201 & 1202: Đền Thái Vi Blue-Stone Bell-Tower Pavilion & Dragon-Carved Stone Stele House
  const tvBtX = tvX - 10.5;
  const tvBtZ = tvZ + 8.5;
  const tvBtY = Math.max(1.0, ctx.getHeight(tvBtX, tvBtZ), ctx.getHeight(tvBtX + 2, tvBtZ));
  addW3Plinth(w5TcStone, 4.2, 4.2, tvBtY + 0.38, tvBtY, tvBtX, tvBtZ);
  for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    addW3GroundedCol(w5TcWood, 0.10, 0.12, tvBtY + 3.05, tvBtY + 0.38, 5, tvBtX + ox, tvBtZ + oz);
  }
  addCylPart(w5TcGold, 0.38, 0.50, 0.92, 6, tvBtX, tvBtY + 2.05, tvBtZ);
  addW3HipRoof(w5TcRoof, w5TcGold, 5.0, 5.0, tvBtY + 3.05, 1.15, tvBtX, tvBtZ);
  const tvStX = tvX + 10.5;
  const tvStZ = tvZ + 8.5;
  const tvStY = Math.max(1.0, ctx.getHeight(tvStX, tvStZ), ctx.getHeight(tvStX - 2, tvStZ));
  addW3Plinth(w5TcStone, 3.6, 3.6, tvStY + 0.35, tvStY, tvStX, tvStZ);
  for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
    addW3GroundedCol(w5TcWood, 0.09, 0.11, tvStY + 2.75, tvStY + 0.35, 5, tvStX + ox, tvStZ + oz);
  }
  addBoxPart(w5TcStone, 0.95, 1.65, 0.28, tvStX, tvStY + 1.18, tvStZ);
  addW3HipRoof(w5TcRoof, w5TcGold, 4.4, 4.4, tvStY + 2.75, 0.95, tvStX, tvStZ);
  // 1203–1210: Bích Động incense court wall, sampan maintenance pier, 3 lace-embroidery frames, 4 Hang Múa benches, paddy sluice, goat trough, lotus baskets & quarry block-stack
  for (const s of [-1, 1]) addBoxPart(w5TcStone, 5.2, 0.92, 0.38, tqX + s * 9.5, bdY + 0.46, tqZ + 8.2);
  addBoxPart(w5TcWood, 6.4, 0.22, 2.2, pierX - 24, VIETNAM_WATER_LEVEL + 0.68, pierZ + 2.8);
  for (const ox of [-2.4, 2.4]) addW3GroundedCol(w5TcWood, 0.09, 0.11, VIETNAM_WATER_LEVEL + 0.68, VIETNAM_WATER_LEVEL - 0.8, 5, pierX - 24 + ox, pierZ + 2.8);
  for (let f = 0; f < 3; f++) {
    const fx = dyX - 5.2 - f * 2.8;
    const fy = Math.max(1.0, ctx.getHeight(fx, dyZ + 4.5));
    addBoxPart(w5TcWood, 1.85, 1.35, 0.16, fx, fy + 0.72, dyZ + 4.5);
    addBoxPart(w5TcStraw, 1.55, 0.95, 0.20, fx, fy + 0.78, dyZ + 4.5);
  }
  for (let b = 0; b < 4; b++) {
    const bx = hkX - 10 + b * 4.5;
    const bz = hkZ + 6.5;
    addBoxPart(w5TcStone, 1.9, 0.48, 0.58, bx, Math.max(1.2, ctx.getHeight(bx, bz)) + 0.24, bz);
  }
  addBoxPart(w5TcWood, 2.6, 0.95, 0.85, cx + 6, Math.max(1.0, ctx.getHeight(cx + 6, cz + 72)) + 0.48, cz + 72);
  addBoxPart(w5TcStone, 1.85, 0.55, 0.72, gpX - 4.8, gpY + 0.28, gpZ);
  for (let lb = 0; lb < 3; lb++) addCylPart(w5TcStraw, 0.42, 0.34, 0.32, 6, hmLPx - 2.2 + lb * 0.95, hmLPy + 0.24, hmLPz - 3.2);
  for (let q = 0; q < 3; q++) addBoxPart(w5TcStone, 1.25, 0.65, 0.85, lkX + 4.8 + q * 1.45, lkY + 0.32, lkZ);
  // 1211–1220: Bích Động alms-bowl pedestal, 3 rainwater jars, 3 scarecrow frames, Đền Thái Vi dragon-steps balustrades, 5 river buoys, Hang Múa milepost, spool rack, oar stand, rice-sack cart & 6 cave stepping pavers
  addW3GroundedPost(w5TcStone, 0.42, 0.42, bdY + 1.05, bdY, tqX + 4.2, tqZ + 9.2);
  addCylPart(w5TcGold, 0.24, 0.18, 0.22, 5, tqX + 4.2, bdY + 1.16, tqZ + 9.2);
  for (let j = 0; j < 3; j++) addCylPart(w5TcRoof, 0.32, 0.26, 0.68, 6, smX + 4.2 + j * 0.85, smY + 0.34, smZ);
  for (let sc = 0; sc < 3; sc++) {
    const scx = cx - 42 + sc * 14;
    const scz = cz + 82;
    const scy = Math.max(1.0, ctx.getHeight(scx, scz));
    addW3GroundedCol(w5TcWood, 0.05, 0.06, scy + 1.95, scy, 4, scx, scz);
    addBoxPart(w5TcWood, 1.25, 0.08, 0.08, scx, scy + 1.45, scz);
    addConePart(w5TcStraw, 0.32, 0.26, 5, scx, scy + 2.05, scz);
  }
  for (const s of [-1, 1]) addBoxPart(w5TcStone, 0.48, 0.72, 4.6, tvX + s * 3.4, tvY + 0.36, tvZ + 16.2);
  for (let rb = 0; rb < 5; rb++) {
    const rbx = cx + 48 + rb * 16;
    const rbz = canalCenterZ(rbx) - 8.5;
    addW3GroundedCol(w5TcWood, 0.05, 0.06, VIETNAM_WATER_LEVEL + 1.35, VIETNAM_WATER_LEVEL - 0.8, 4, rbx, rbz);
  }
  addW3GroundedPost(w5TcStone, 0.44, 0.44, hkY + 1.75, hkY, hkX + 5.8, hkZ + 4.2);
  addConePart(w5TcGold, 0.26, 0.32, 4, hkX + 5.8, hkY + 1.92, hkZ + 4.2);
  addBoxPart(w5TcWood, 1.45, 1.15, 0.48, dyX + 4.2, dyY + 0.58, dyZ);
  addBoxPart(w5TcWood, 2.2, 1.25, 0.52, pierX - 15, VIETNAM_WATER_LEVEL + 1.25, pierZ - 4.5);
  addBoxPart(w5TcWood, 2.0, 0.62, 1.15, cx + 44, Math.max(1.0, ctx.getHeight(cx + 44, cz + 78)) + 0.45, cz + 78);
  for (let sp = 0; sp < 6; sp++) addBoxPart(w5TcStone, 1.65, 0.14, 0.95, tqX, bdY + 0.07, tqZ + 8.5 + sp * 1.45);
  // 1221–1229: Đền Thái Vi bronze table, 3 crane-perch pillars, Văn Lâm wicket gate, winnowing trestle, boat-painter bench, panorama plaque, 2 stone urns, broom tripod & outer welcome arch
  addBoxPart(w5TcStone, 1.85, 0.88, 0.92, tvX, tvY + 0.44, tvZ + 14.8);
  addCylPart(w5TcGold, 0.28, 0.22, 0.34, 5, tvX, tvY + 1.05, tvZ + 14.8);
  for (let cp = 0; cp < 3; cp++) addW3GroundedCol(w5TcStone, 0.16, 0.20, VIETNAM_WATER_LEVEL + 1.65 + cp * 0.25, VIETNAM_WATER_LEVEL - 0.8, 5, hmLPx + 4 + cp * 4.2, hmLPz - 4.5);
  for (const s of [-1, 1]) addW3GroundedPost(w5TcWood, 0.14, 0.14, dyY + 2.25, dyY, dyX - 14 + s * 1.6, dyZ - 6.5);
  addBoxPart(w5TcWood, 3.6, 0.18, 0.18, dyX - 14, dyY + 2.15, dyZ - 6.5);
  addBoxPart(w5TcWood, 2.2, 0.82, 1.15, ltX - 5.5, ltY + 0.41, ltZ);
  addBoxPart(w5TcWood, 1.85, 0.48, 0.58, pierX - 28, VIETNAM_WATER_LEVEL + 0.92, pierZ + 4.8);
  addBoxPart(w5TcStone, 1.15, 0.95, 0.65, ltX + 5.8, ltY + 0.48, ltZ);
  addBoxPart(w5TcGold, 0.92, 0.10, 0.48, ltX + 5.8, ltY + 1.0, ltZ, 0, 0.32, 0);
  for (const s of [-1, 1]) addCylPart(w5TcStone, 0.42, 0.32, 0.78, 6, tqX + s * 4.8, bdY + 0.39, tqZ + 12.2);
  addConePart(w5TcStraw, 0.52, 1.25, 5, smX - 4.5, smY + 0.62, smZ + 2.5);
  const waX = cx - 18;
  const waZ = cz + 92;
  const waY = Math.max(1.0, ctx.getHeight(waX, waZ));
  for (const s of [-1, 1]) addW3GroundedCol(w5TcWood, 0.14, 0.18, waY + 3.85, waY, 5, waX + s * 3.2, waZ);
  addBoxPart(w5TcCrimson, 7.2, 0.42, 0.35, waX, waY + 3.72, waZ);
  addW3HipRoof(w5TcRoof, w5TcGold, 7.8, 1.6, waY + 3.92, 0.72, waX, waZ);

  addWave3Mesh(group, w5TcStone, ctx.materials.granite);
  addWave3Mesh(group, w5TcWood, ctx.materials.darkWood);
  addWave3Mesh(group, w5TcRoof, mossyRoofMat);
  addWave3Mesh(group, w5TcStraw, strawMat);
  addWave3Mesh(group, w5TcGold, ctx.materials.gold);
  addWave3Mesh(group, w5TcCrimson, ctx.materials.crimsonLacquer);

  if (tcExpStone.length > 0) group.add(new THREE.Mesh(mergeNormalized(tcExpStone), ctx.materials.granite));
  if (tcExpWood.length > 0) group.add(new THREE.Mesh(mergeNormalized(tcExpWood), ctx.materials.darkWood));
  if (tcExpRoof.length > 0) group.add(new THREE.Mesh(mergeNormalized(tcExpRoof), mossyRoofMat));
  if (tcExpStraw.length > 0) group.add(new THREE.Mesh(mergeNormalized(tcExpStraw), strawMat));
  if (tcExpMoss.length > 0) group.add(new THREE.Mesh(mergeNormalized(tcExpMoss), mossMat));
  if (tcExpGold.length > 0) group.add(new THREE.Mesh(mergeNormalized(tcExpGold), ctx.materials.gold));

  const caveMat = ctx.materials.granite;
  const stalMat = ctx.materials.stone;
  group.add(
    new THREE.Mesh(mergeNormalized(caveParts), caveMat),
    new THREE.Mesh(mergeNormalized(stalactiteParts), stalMat)
  );
  tagMotifIds(group, [
    'HV-A06', 'HV-B02', 'HV-C04', 'HV-D15', 'HV-NEW-MB-08', 'HV-NEW-MB-11', 'HV-NEW-MB-12'
  ]);

  ctx.scene.add(group);
  return { group, lampMat };
}

const HOI_AN_LANTERN_PALETTE = [
  new THREE.Color('#ffb347'),
  new THREE.Color('#ffe08a'),
  new THREE.Color('#c8102e'),
  new THREE.Color('#ff7a3c'),
  new THREE.Color('#e8749a')
];

function createHoiAnMacroSilkMat(uTimeObj: { uTime: { value: number } }): THREE.MeshStandardMaterial {
  const silkMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.45,
    roughness: 0.52
  });
  silkMat.userData.noDedupe = true;
  silkMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeObj.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 lp = vec3(0.0);
       #ifdef USE_INSTANCING
       lp = vec3(instanceMatrix[3].xyz);
       #endif
       transformed.x += sin(uTime * 1.35 + lp.x * 0.4 + lp.z * 0.35) * 0.06 * (0.5 - position.y);`
    );
  };
  return silkMat;
}

function buildHoiAnGrandLanternQuarterMacro(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): { group: THREE.Group; silkMat: THREE.MeshStandardMaterial } {
  const uTimeObj = { uTime: { value: 0 } };
  animList.push(uTimeObj);

  // --- M2: HoiAnGrandLanternQuarter (640, 140) ---
  const qx = 640;
  const qz = 140;
  ctx.exclusionCircles.push({ x: qx, z: qz - 10, r: 118 });
  const qGroup = new THREE.Group();
  qGroup.name = 'HoiAnGrandLanternQuarter';
  const qY = ctx.getHeight(qx, qz);

  const colParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const wallParts: THREE.BufferGeometry[] = [];
  const winParts: THREE.BufferGeometry[] = [];

  // Twin monumental 2-tier Hội Quán pavilions (Left & Right) + Walk-in Hội Quán Phúc Kiến Interior Assembly Hall (ref 115_hoi_an_hoi_quan_phuc_kien_noi_that.jpg)
  for (const side of [-1, 1]) {
    const px = qx + side * 26;
    const pz = qz + 18;
    const py = ctx.getHeight(px, pz);
    for (const [ox, oz] of [[-4.2, -3.2], [4.2, -3.2], [-4.2, 3.2], [4.2, 3.2]]) {
      addCylPart(colParts, 0.30, 0.34, 9.0, 12, px + ox, py + 4.5, pz + oz);
    }
    addBoxPart(woodParts, 10.6, 0.35, 8.2, px, py + 5.2, pz); // upper balcony deck
    addBoxPart(woodParts, 10.8, 0.95, 0.25, px, py + 5.85, pz + 4.0);
    addBoxPart(woodParts, 10.8, 0.95, 0.25, px, py + 5.85, pz - 4.0);
    const r1 = createVietnameseCurvedRoofGeometry(13.0, 10.2, 6.4, 4.4, 2.8, 0.85);
    r1.translate(px, py + 5.1, pz);
    roofParts.push(r1);
    // Upper-story crimson clerestory walls so r2 seats flush with zero detached air gap
    addBoxPart(colParts, 7.4, 1.9, 5.4, px, py + 7.95, pz);
    const r2 = createVietnameseCurvedRoofGeometry(9.6, 7.2, 2.2, 1.0, 3.0, 1.05);
    r2.translate(px, py + 8.88, pz);
    roofParts.push(r2);
    addBoxPart(goldParts, 4.8, 0.45, 0.3, px, py + 4.7, pz + 3.2);
    // Ground-floor Hội Quán Phúc Kiến assembly hall sanctuary interior (ref 115):
    // Stepped stone-wood floor podium, ornate triple-gateway screen, Thiên Hậu Thánh Mẫu gilded shrine, model junk ship offering & hanging spiral incense coils (*nhang vòng*)
    addBoxPart(woodParts, 9.8, 0.26, 7.6, px, py + 0.13, pz);
    addBoxPart(colParts, 8.8, 3.8, 0.24, px, py + 2.0, pz + 3.45); // rear crimson sanctuary screen wall
    addBoxPart(goldParts, 3.6, 1.35, 1.15, px, py + 0.88, pz + 2.55); // Thiên Hậu gilded altar table
    addBoxPart(colParts, 2.4, 2.35, 0.85, px, py + 2.45, pz + 2.75); // ornate red-gold khám thờ alcove
    addCylPart(goldParts, 0.28, 0.38, 1.15, 8, px, py + 2.15, pz + 2.65); // seated Thiên Hậu Thánh Mẫu figure
    for (const gx of [-1.45, 1.45]) {
      addCylPart(colParts, 0.22, 0.26, 1.25, 7, px + gx, py + 0.88, pz + 2.55); // Thiên Lý Nhãn & Thuận Phong Nhĩ guardians
    }
    // Ceremonial wooden model Chinese merchant junk ship (*thuyền buồm Phúc Kiến*) on side offering stand
    addBoxPart(woodParts, 1.65, 0.36, 0.52, px - side * 2.4, py + 1.15, pz + 0.6);
    addCylPart(goldParts, 0.04, 0.05, 1.25, 5, px - side * 2.4, py + 1.85, pz + 0.6);
    addBoxPart(goldParts, 0.75, 0.62, 0.06, px - side * 2.4, py + 1.92, pz + 0.6);
    // 6 Conical spiral incense coils (*nhang vòng Hội Quán*) suspended beneath the ground-floor ceiling deck + Carved Cửa Võng (`HV-D12`) & Tứ Quý (`HV-C08`)
    for (const [cxOff, czOff] of [[-2.2, -1.2], [0, -1.2], [2.2, -1.2], [-1.6, 0.6], [0, 0.6], [1.6, 0.6]]) {
      const coilCone = new THREE.ConeGeometry(0.46, 0.72, 8, 1, true);
      coilCone.translate(px + cxOff, py + 4.35, pz + czOff);
      goldParts.push(coilCone);
    }
    goldParts.push(
      ...createCuaVongParts(px, py + 4.05, pz + 1.45, 3.6, 0.85, 0, 'long_phung'),
      ...createBasReliefPanelParts(px + side * 2.8, py + 2.1, pz + 3.3, 1.8, 0.85, 0, 'tu_quy')
    );
    // Side access staircase climbing cleanly to upper Hội Quán balcony
    const stairX = px + side * 6.2;
    for (let st = 0; st < 10; st++) {
      const f = st / 9;
      addBoxPart(woodParts, 1.9, 0.24, 0.65, stairX, py + 0.35 + f * 4.85, pz + 4.2 - f * 6.4);
    }
    colParts.push(...createPiercedBalustradeParts(stairX + side * 0.92, pz + 4.2, stairX + side * 0.92, pz - 2.2, py + 2.8, 0.85, 'con_tien'));
  }
  tagMotifIds(qGroup, [
    'HV-A04', 'HV-A06', 'HV-B10', 'HV-C08', 'HV-D08', 'HV-D10', 'HV-D12',
    'HV-D15', 'HV-I01', 'HV-J01', 'HV-J04', 'HV-NEW-MT-01', 'HV-NEW-MT-14'
  ]);

  // FIX R32: Illuminated 7-Tier Crimson Lattice Lantern Tower packed with glowing red/gold/cyan lanterns + red railing base (ref 02)
  const towerZ = qz - 42;
  const towerY = ctx.getHeight(qx, towerZ);
  const macroBridgeStone: THREE.BufferGeometry[] = [];
  addBoxPart(macroBridgeStone, 4.4, 0.75, 4.4, qx, towerY + 0.38, towerZ);
  // Crimson perimeter railing base around the 7-tier lantern tower
  colParts.push(
    ...createPiercedBalustradeParts(qx - 2.1, towerZ - 2.1, qx + 2.1, towerZ - 2.1, towerY + 0.75, 0.88, 'con_tien'),
    ...createPiercedBalustradeParts(qx - 2.1, towerZ + 2.1, qx + 2.1, towerZ + 2.1, towerY + 0.75, 0.88, 'con_tien'),
    ...createPiercedBalustradeParts(qx - 2.1, towerZ - 2.1, qx - 2.1, towerZ + 2.1, towerY + 0.75, 0.88, 'con_tien'),
    ...createPiercedBalustradeParts(qx + 2.1, towerZ - 2.1, qx + 2.1, towerZ + 2.1, towerY + 0.75, 0.88, 'con_tien')
  );
  const towerLanternCoords: Array<{ x: number; y: number; z: number; sc: number; col: THREE.Color }> = [];
  const towerTierColors = [
    new THREE.Color('#ff3628'), // crimson red
    new THREE.Color('#ffe07a'), // warm gold
    new THREE.Color('#2bb3b1')  // Hội An lantern cyan
  ];
  for (let t = 0; t < 7; t++) {
    const r = 1.48 - t * 0.13;
    const tierBaseY = towerY + 0.80 + t * 1.24;
    // 4 Crimson corner lattice posts per tier (open frame so glowing lanterns shine through!)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addCylPart(colParts, 0.08, 0.09, 1.24, 6, qx + sx * r * 0.82, tierBaseY + 0.62, towerZ + sz * r * 0.82);
      }
    }
    // Tiered upturned crimson pagoda eave cornice & golden trim ring
    const tierEave = createVietnameseCurvedRoofGeometry(r * 2.55, r * 2.55, r * 1.65, r * 1.65, 0.42, 0.22);
    tierEave.translate(qx, tierBaseY + 1.08, towerZ);
    roofParts.push(tierEave);
    addBoxPart(goldParts, r * 1.85, 0.10, r * 1.85, qx, tierBaseY + 1.04, towerZ);
    // Glowing central lantern core + 4 perimeter glowing lanterns per tier (red / gold / cyan)
    const tierCol = towerTierColors[t % 3];
    towerLanternCoords.push({ x: qx, y: tierBaseY + 0.58, z: towerZ, sc: Math.max(0.75, 1.35 - t * 0.09), col: tierCol });
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
      towerLanternCoords.push({
        x: qx + Math.cos(a) * (r * 0.92),
        y: tierBaseY + 0.56,
        z: towerZ + Math.sin(a) * (r * 0.92),
        sc: 0.72,
        col: towerTierColors[(t + c) % 3]
      });
    }
  }
  // Golden pagoda finial crowning the 7th tier
  addCylPart(goldParts, 0.04, 0.14, 1.15, 8, qx, towerY + 10.1, towerZ);

  // FIX R32: Grounded Macro Chùa Cầu with full rows of crimson/ironwood columns supporting macroBridgeRoof cleanly down to deck!
  const brCenterZ = qz - 26;
  const brDeckY = towerY + 0.85;
  addBoxPart(colParts, 14.4, 0.55, 5.4, qx, brDeckY, brCenterZ);
  // Grounded stone & timber bridge piers supporting deck from below
  for (const pxOff of [-6.4, -3.2, 0, 3.2, 6.4]) {
    const pierH = Math.max(1.8, brDeckY - (ctx.getHeight(qx + pxOff, brCenterZ) - 0.8));
    for (const s of [-1, 1]) {
      addBoxPart(macroBridgeStone, 0.72, pierH, 0.72, qx + pxOff, brDeckY - 0.25 - pierH * 0.5, brCenterZ + s * 2.15);
    }
  }
  for (const s of [-1, 1]) {
    addBoxPart(colParts, 14.0, 1.05, 0.25, qx, brDeckY + 0.70, brCenterZ + s * 2.55);
    // Longitudinal crimson eave tie-beams directly beneath macroBridgeRoof eave
    addBoxPart(colParts, 14.4, 0.26, 0.26, qx, towerY + 4.35, brCenterZ + s * 2.48);
    // 6 Full-height crimson & ironwood roof support columns per side (zero air gap!)
    for (let c = 0; c < 6; c++) {
      const colX = qx - 6.4 + c * 2.56;
      const colH = 3.35; // spans cleanly from deck top (towerY + 1.10) to roof eave (towerY + 4.45)
      addCylPart(colParts, 0.17, 0.19, colH, 8, colX, towerY + 1.10 + colH * 0.5, brCenterZ + s * 2.48);
      addCylPart(macroBridgeStone, 0.24, 0.28, 0.20, 8, colX, towerY + 1.18, brCenterZ + s * 2.48);
    }
  }
  // Covered Chùa Cầu roof, Lai Viễn Kiều plaque, Bắc Đế Trấn Võ shrine & Dog/Monkey guardians on macro bridge
  const macroBridgeRoof = createVietnameseCurvedRoofGeometry(15.2, 6.2, 10.6, 1.6, 2.1, 0.42);
  macroBridgeRoof.translate(qx, towerY + 4.35, brCenterZ);
  roofParts.push(macroBridgeRoof);
  const macroBridgeLanterns: THREE.BufferGeometry[] = [];
  addChuaCauInteriorAndGuardians(
    colParts,
    goldParts,
    woodParts,
    macroBridgeStone,
    macroBridgeLanterns,
    qx,
    towerY + 1.15,
    brCenterZ,
    14.0,
    'x',
    qGroup,
    ctx
  );
  if (macroBridgeStone.length > 0) {
    qGroup.add(new THREE.Mesh(mergeNormalized(macroBridgeStone), ctx.materials.stone));
  }
  if (macroBridgeLanterns.length > 0) {
    qGroup.add(new THREE.Mesh(mergeNormalized(macroBridgeLanterns), ctx.materials.lanternCore ?? ctx.materials.gold));
  }

  // 12 Colonnaded Ochre Shophouses along both flanks with Mắt cửa Hội An, shuttered windows, doors & awnings
  for (const side of [-1, 1]) {
    const faceRotY = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    for (let i = 0; i < 6; i++) {
      const sx = qx + side * 28;
      const sz = qz - 48 + i * 18;
      const sy = ctx.getHeight(sx, sz);
      const frontX = sx - side * 4.55;
      addBoxPart(wallParts, 9.0, 5.2, 14.0, sx, sy + 2.6, sz);
      // Traditional paneled wooden sliding doors (*cửa bàn khoa*) & frame
      addBoxPart(woodParts, 0.35, 3.2, 10.4, frontX, sy + 1.6, sz);
      for (const doorOff of [-3.4, 0, 3.4]) {
        addBoxPart(woodParts, 0.16, 2.75, 2.3, frontX - side * 0.14, sy + 1.4, sz + doorOff);
      }
      // Iconic Hội An Door Eyes (*Mắt cửa Hội An*) mounted above main doorway
      const eyes = createHoiAnDoorEyesParts(frontX - side * 0.18, sy + 3.05, sz, faceRotY, 1.35, 0.18);
      woodParts.push(...eyes.woodParts);
      goldParts.push(...eyes.goldParts);
      // Sloped wooden street-front rain awning (*mái hiên gỗ*) + timber support struts
      addBoxPart(woodParts, 2.2, 0.14, 13.4, frontX - side * 1.0, sy + 3.18, sz, 0, 0, side * 0.24);
      for (const stZ of [-5.4, 0, 5.4]) {
        addCylPart(woodParts, 0.08, 0.09, 3.1, 6, frontX - side * 1.9, sy + 1.55, sz + stZ);
      }
      // Upper glowing windows framed by pairs of louvered wooden shutters
      for (const wz of [-2.8, 2.8]) {
        addBoxPart(winParts, 0.18, 1.4, 2.2, frontX - side * 0.08, sy + 4.05, sz + wz);
        addBoxPart(woodParts, 0.12, 1.45, 0.52, frontX - side * 0.16, sy + 4.05, sz + wz - 1.32);
        addBoxPart(woodParts, 0.12, 1.45, 0.52, frontX - side * 0.16, sy + 4.05, sz + wz + 1.32);
        addBoxPart(woodParts, 0.22, 0.12, 2.8, frontX - side * 0.16, sy + 3.28, sz + wz);
      }
      const sRoof = createVietnameseCurvedRoofGeometry(11.4, 15.6, 2.4, 10.8, 2.5, 0.32);
      sRoof.translate(sx, sy + 5.2, sz);
      roofParts.push(sRoof);
    }
  }

  const silkMat = createHoiAnMacroSilkMat(uTimeObj);
  ctx.extraMaterials.push(silkMat);

  // Street lantern shell upgraded with upper/lower caps + hanging tassel cone
  const shellMain = createRibbedLanternShellGeometry(0.28, 0.48, 7, 4);
  const topCap = new THREE.CylinderGeometry(0.11, 0.12, 0.07, 5);
  topCap.translate(0, 0.27, 0);
  const botCap = new THREE.CylinderGeometry(0.10, 0.08, 0.06, 5);
  botCap.translate(0, -0.26, 0);
  const tassel = new THREE.ConeGeometry(0.055, 0.26, 4);
  tassel.translate(0, -0.42, 0);
  const lanternGeo = mergeNormalized([shellMain, topCap, botCap, tassel]);

  // Glowing lanterns packed inside the 7-tier Lantern Tower
  const towerLanternInst = new THREE.InstancedMesh(lanternGeo, silkMat, towerLanternCoords.length);
  for (let i = 0; i < towerLanternCoords.length; i++) {
    const lc = towerLanternCoords[i];
    setInstanceMatrix(towerLanternInst, i, lc.x, lc.y, lc.z, 0, i * 0.5, 0, lc.sc, lc.sc, lc.sc);
    towerLanternInst.setColorAt(i, lc.col);
  }
  towerLanternInst.instanceMatrix.needsUpdate = true;
  if (towerLanternInst.instanceColor) towerLanternInst.instanceColor.needsUpdate = true;
  qGroup.add(towerLanternInst);

  const canopyInst = new THREE.InstancedMesh(lanternGeo, silkMat, 640);
  const rand = mulberry32(22022);
  const cols = HOI_AN_LANTERN_PALETTE;
  let idx = 0;
  for (let row = 0; row < 20; row++) {
    const rz = qz - 40 + row * 4.6;
    const rowLift = (row % 2) * 0.4;
    // Catenary hanging cable spanning cleanly across street above every row of lanterns
    const wirePts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const wx = qx - 23.0 + t * 46.0;
      const sag = 0.72 * 4.0 * t * (1.0 - t);
      wirePts.push(new THREE.Vector3(wx, qY + 5.52 - sag + rowLift, rz));
    }
    woodParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 10, 0.025, 4, false));

    for (let col = 0; col < 32 && idx < 640; col++) {
      const t = col / 31;
      const rx = qx - 21.5 + t * 43.0;
      const sag = 0.72 * 4.0 * t * (1.0 - t);
      const ry = qY + 5.2 - sag + rowLift;
      const sc = 0.9 + rand() * 0.35;
      setInstanceMatrix(canopyInst, idx, rx, ry, rz, 0, rand() * 3.14, 0, sc, sc, sc);
      canopyInst.setColorAt(idx, cols[Math.floor(rand() * cols.length)]);
      idx++;
    }
  }
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;

  // 96 Vertical crimson pillar lantern strings
  const cylGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.56, 10);
  const pillarLanterns = new THREE.InstancedMesh(cylGeo, silkMat, 96);
  let pIdx = 0;
  for (const side of [-1, 1]) {
    const px = qx + side * 26;
    for (const [ox, oz] of [[-4.2, -3.2], [4.2, -3.2], [-4.2, 3.2], [4.2, 3.2]]) {
      for (let k = 0; k < 12 && pIdx < 96; k++) {
        setInstanceMatrix(pillarLanterns, pIdx, px + ox * 1.08, qY + 1.2 + k * 0.68, qz + 18 + oz, 0, 0, 0, 1, 1, 1);
        pillarLanterns.setColorAt(pIdx, cols[2]);
        pIdx++;
      }
    }
  }
  pillarLanterns.instanceMatrix.needsUpdate = true;
  if (pillarLanterns.instanceColor) pillarLanterns.instanceColor.needsUpdate = true;

  const poolMat = ctx.sharedShaders
    ? ctx.sharedShaders.warmLightPool.material
    : (() => {
      const poolHelper = createWarmLightPoolMaterial();
      animList.push(poolHelper.uniforms);
      ctx.extraMaterials.push(poolHelper.material);
      return poolHelper.material;
    })();
  const poolGeo = new THREE.PlaneGeometry(7.2, 7.2);
  poolGeo.rotateX(-Math.PI / 2);
  const poolInst = new THREE.InstancedMesh(poolGeo, poolMat, 16);
  for (let i = 0; i < 16; i++) {
    const px = qx - 16 + (i % 4) * 10.5;
    const pz = qz - 32 + Math.floor(i / 4) * 24;
    setInstanceMatrix(poolInst, i, px, ctx.getHeight(px, pz) + 0.08, pz, 0, 0, 0, 1, 1, 1);
  }
  poolInst.instanceMatrix.needsUpdate = true;

  // --- 200-Item Macro Visual QC & Expansion (016–030): Phố Đèn Lồng Hội An ---
  const haExpStone: THREE.BufferGeometry[] = [];
  const haExpWood: THREE.BufferGeometry[] = [];
  const haExpWall: THREE.BufferGeometry[] = [];
  const haExpRoof: THREE.BufferGeometry[] = [];
  const haExpGold: THREE.BufferGeometry[] = [];
  const haExpLeaf: THREE.BufferGeometry[] = [];
  const haExpLantern: THREE.BufferGeometry[] = [];

  // 016 & 017: 4 additional 2-story ochre merchant shophouses extending the alleys + stepped fire-walls
  for (const [ex, ez, side] of [[qx - 28, qz - 66, -1], [qx + 28, qz - 66, 1], [qx - 28, qz + 60, -1], [qx + 28, qz + 60, 1]] as Array<[number, number, number]>) {
    const ey = ctx.getHeight(ex, ez);
    addBoxPart(haExpWall, 9.0, 5.2, 13.0, ex, ey + 2.6, ez);
    addBoxPart(haExpWall, 9.4, 5.8, 0.35, ex, ey + 2.9, ez - 6.6);
    addBoxPart(haExpWall, 9.4, 5.8, 0.35, ex, ey + 2.9, ez + 6.6);
    const er = createVietnameseCurvedRoofGeometry(11.2, 14.6, 2.4, 10.2, 2.4, 0.32);
    er.translate(ex, ey + 5.2, ez);
    haExpRoof.push(er);
    addBoxPart(haExpWood, 0.3, 3.0, 9.6, ex - side * 4.55, ey + 1.5, ez);
  }
  // 018, 019, 028, 030: Hanging carved shop signboards, bougainvillea trellises, display counters & doorway step-lanterns
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const sx = qx + side * 28;
      const sz = qz - 48 + i * 18;
      const sy = ctx.getHeight(sx, sz);
      const frontX = sx - side * 4.75;
      // 018: Hanging carved signboard
      addBoxPart(haExpWood, 0.14, 0.65, 2.2, frontX - side * 1.4, sy + 2.65, sz);
      addBoxPart(haExpGold, 0.16, 0.45, 1.9, frontX - side * 1.4, sy + 2.65, sz);
      // 019: Bougainvillea trellis pot on upper balcony
      addBoxPart(haExpRoof, 0.65, 0.48, 1.4, frontX - side * 0.3, sy + 3.45, sz);
      haExpLeaf.push(createSculptedRockGeometry(2100 + i * 2 + (side > 0 ? 1 : 0), 0.72, 0.55, 0.95, 1).translate(frontX - side * 0.35, sy + 4.15, sz));
      // 028: Sidewalk wooden display counter
      addBoxPart(haExpWood, 0.95, 0.85, 2.6, frontX - side * 0.75, sy + 0.42, sz + 3.2);
      // 030: Ground-level doorway step-lanterns
      const stepLan = createLanternCoreGeometry(0.18, 0.34);
      stepLan.translate(frontX - side * 0.45, sy + 0.35, sz - 2.2);
      haExpLantern.push(stepLan);
    }
  }
  // 020: Street-vendor bamboo shoulder-pole stalls & low wooden stools
  for (const [vx, vz] of [[qx - 18, qz - 12], [qx + 17, qz + 8], [qx - 16, qz + 24]] as Array<[number, number]>) {
    const vy = ctx.getHeight(vx, vz);
    addBoxPart(haExpWood, 1.45, 0.08, 0.08, vx, vy + 0.72, vz);
    for (const sOff of [-0.55, 0.55]) {
      addCylPart(haExpRoof, 0.28, 0.22, 0.32, 7, vx + sOff, vy + 0.22, vz);
      addBoxPart(haExpWood, 0.38, 0.26, 0.38, vx + sOff * 1.6, vy + 0.13, vz + 0.65);
    }
  }
  // 021 & 022: Lantern street posts, mossy stone curbs & carved stone bollards
  for (let p = 0; p < 10; p++) {
    const pz = qz - 42 + p * 10.5;
    for (const side of [-1, 1]) {
      const px = qx + side * 19.5;
      const py = ctx.getHeight(px, pz);
      addCylPart(haExpWood, 0.09, 0.11, 3.6, 6, px, py + 1.8, pz);
      addBoxPart(haExpWood, 0.65, 0.08, 0.08, px - side * 0.32, py + 3.45, pz);
      haExpLantern.push(createLanternCoreGeometry(0.18, 0.32).translate(px - side * 0.55, py + 3.15, pz));
    }
  }
  for (const bz of [qz - 54, qz + 52]) {
    for (const bx of [qx - 10, qx - 4, qx + 4, qx + 10]) {
      addCylPart(haExpStone, 0.22, 0.26, 0.85, 6, bx, ctx.getHeight(bx, bz) + 0.42, bz);
    }
  }
  // 023 & 024: Hội Quán Phúc Kiến guardian pedestals & bonsai planters
  for (const side of [-1, 1]) {
    const hx = qx + side * 26;
    const hz = qz + 18;
    const hy = ctx.getHeight(hx, hz);
    for (const gz of [hz - 4.8, hz + 4.8]) {
      addBoxPart(haExpStone, 0.95, 0.72, 0.95, hx - side * 5.8, hy + 0.36, gz);
      haExpStone.push(...createGuardianBeastParts(hx - side * 5.8, hy + 0.72, gz, side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5, 0.62, 'nghe'));
      addCylPart(haExpRoof, 0.48, 0.36, 0.55, 8, hx - side * 6.4, hy + 0.28, gz + (gz > hz ? 2.2 : -2.2));
      addCylPart(haExpLeaf, 0.62, 0.25, 1.35, 6, hx - side * 6.4, hy + 1.15, gz + (gz > hz ? 2.2 : -2.2));
    }
  }
  // 025 & 026: Chùa Cầu interior Bắc Đế Trấn Võ altar table & wooden bench seating
  addBoxPart(haExpGold, 1.8, 0.92, 0.85, qx, towerY + 1.62, brCenterZ - 1.2);
  addCylPart(haExpGold, 0.22, 0.16, 0.36, 8, qx, towerY + 2.26, brCenterZ - 1.2);
  for (const s of [-1, 1]) {
    addBoxPart(haExpWood, 9.6, 0.12, 0.55, qx, towerY + 1.62, brCenterZ + s * 1.95);
  }
  // 027: 3 crisscrossing overhead silk lantern garland strings in expanded alleys
  for (const gz of [qz - 62, qz + 56, qz + 64]) {
    for (let k = -6; k <= 6; k++) {
      haExpLantern.push(createLanternCoreGeometry(0.20, 0.36).translate(qx + k * 3.2, qY + 5.1 - Math.cos(k * 0.22) * 0.4, gz));
    }
  }
  // 029: Giếng Bá Lễ square mossy brick well in eastern side alley
  const wellHx = qx + 36;
  const wellHz = qz - 28;
  const wellHy = ctx.getHeight(wellHx, wellHz);
  addBoxPart(haExpStone, 2.2, 0.85, 2.2, wellHx, wellHy + 0.42, wellHz);
  addBoxPart(haExpWood, 0.12, 2.2, 0.12, wellHx - 0.9, wellHy + 1.5, wellHz);
  addBoxPart(haExpWood, 0.12, 2.2, 0.12, wellHx + 0.9, wellHy + 1.5, wellHz);
  addBoxPart(haExpWood, 2.0, 0.12, 0.12, wellHx, wellHy + 2.55, wellHz);

  // --- Wave 2 Macro Visual QC & Expansion (216–230): Hội An Silk Tailors, Wooden Canal Bridge & Alley Craft ---
  // 216, 217, 220: 2 Silk-tailor storefronts (Tiệm May Áo Dài), outdoor garment racks & vertical glowing lantern signs
  for (const [tx, tz, side] of [[qx - 28, qz - 22, -1], [qx + 28, qz - 4, 1]] as Array<[number, number, number]>) {
    const ty = ctx.getHeight(tx, tz);
    const fx = tx - side * 4.85;
    addBoxPart(haExpWood, 0.45, 2.4, 4.2, fx, ty + 1.2, tz);
    addBoxPart(haExpGold, 0.22, 1.45, 0.45, fx - side * 0.35, ty + 1.15, tz - 1.1);
    addBoxPart(haExpRoof, 0.22, 1.45, 0.45, fx - side * 0.35, ty + 1.15, tz + 1.1);
    addBoxPart(haExpWood, 0.08, 1.8, 2.4, fx - side * 1.1, ty + 0.9, tz);
    addCylPart(haExpLantern, 0.18, 0.18, 0.95, 5, fx - side * 1.35, ty + 2.45, tz - 2.4);
  }
  // 218: Humped dark-timber pedestrian canal footbridge (Cầu Gỗ Nhỏ Qua Kênh Phố Cổ)
  const wbrX = qx + 40;
  const wbrZ = qz + 6;
  const wbrY = ctx.getHeight(wbrX, wbrZ);
  addBoxPart(haExpWood, 8.6, 0.24, 2.8, wbrX, wbrY + 0.85, wbrZ);
  for (const s of [-1.32, 1.32]) {
    addBoxPart(haExpWood, 8.6, 0.12, 0.12, wbrX, wbrY + 1.75, wbrZ + s);
    for (const pxOff of [-3.8, 0, 3.8]) {
      addBoxPart(haExpWood, 0.14, 1.0, 0.14, wbrX + pxOff, wbrY + 1.3, wbrZ + s);
    }
  }
  // 219, 223, 228, 229: Cantilevered awning brackets, louvered shutter frames, downspouts & stone column bases
  for (const [ex, ez, side] of [[qx - 28, qz - 66, -1], [qx + 28, qz - 66, 1], [qx - 28, qz + 60, -1], [qx + 28, qz + 60, 1]] as Array<[number, number, number]>) {
    const ey = ctx.getHeight(ex, ez);
    const fx = ex - side * 4.6;
    addBoxPart(haExpWood, 1.8, 0.16, 10.4, fx - side * 0.9, ey + 3.1, ez);
    addBoxPart(haExpWood, 0.22, 1.6, 1.4, fx - side * 0.05, ey + 4.1, ez);
    addCylPart(haExpStone, 0.06, 0.06, 5.0, 5, fx, ey + 2.5, ez + 6.4);
    addBoxPart(haExpStone, 0.42, 0.35, 0.42, fx - side * 1.4, ey + 0.18, ez - 3.8);
    addBoxPart(haExpStone, 0.42, 0.35, 0.42, fx - side * 1.4, ey + 0.18, ez + 3.8);
  }
  // 221 & 222: 4 Sidewalk heritage tea tables & 3 vintage bicycle silhouettes
  for (const [tx, tz] of [[qx - 21, qz - 32], [qx + 21, qz - 16], [qx - 21, qz + 12], [qx + 21, qz + 28]] as Array<[number, number]>) {
    const ty = ctx.getHeight(tx, tz);
    addBoxPart(haExpWood, 0.85, 0.52, 0.85, tx, ty + 0.26, tz);
    addCylPart(haExpRoof, 0.12, 0.14, 0.16, 5, tx, ty + 0.6, tz);
  }
  for (const [bx, bz] of [[qx - 23.2, qz - 40], [qx + 23.2, qz + 4], [qx - 23.2, qz + 36]] as Array<[number, number]>) {
    const by = ctx.getHeight(bx, bz);
    addCylPart(haExpWood, 0.32, 0.32, 0.08, 6, bx, by + 0.34, bz - 0.52, 0, Math.PI * 0.5);
    addCylPart(haExpWood, 0.32, 0.32, 0.08, 6, bx, by + 0.34, bz + 0.52, 0, Math.PI * 0.5);
    addBoxPart(haExpWood, 0.08, 0.12, 1.1, bx, by + 0.68, bz);
  }
  // 224, 225, 230: Thanh Hà ceramic stall, ochre side-alley archway & Nước Mót herbal tea kiosk
  addBoxPart(haExpWood, 2.4, 0.78, 1.1, qx + 18, ctx.getHeight(qx + 18, qz - 34) + 0.39, qz - 34);
  for (const vxOff of [-0.6, 0, 0.6]) {
    addCylPart(haExpRoof, 0.14, 0.18, 0.36, 5, qx + 18 + vxOff, ctx.getHeight(qx + 18, qz - 34) + 0.96, qz - 34);
  }
  const archAx = qx + 34;
  const archAz = qz - 14;
  const archAy = ctx.getHeight(archAx, archAz);
  addBoxPart(haExpWall, 0.75, 3.8, 0.75, archAx, archAy + 1.9, archAz - 2.2);
  addBoxPart(haExpWall, 0.75, 3.8, 0.75, archAx, archAy + 1.9, archAz + 2.2);
  addBoxPart(haExpWall, 0.85, 0.95, 5.2, archAx, archAy + 4.1, archAz);
  addBoxPart(haExpRoof, 1.25, 0.35, 5.6, archAx, archAy + 4.75, archAz);
  const motX = qx - 19;
  const motZ = qz + 4;
  const motY = ctx.getHeight(motX, motZ);
  addBoxPart(haExpWood, 1.2, 0.92, 2.6, motX, motY + 0.46, motZ);
  addBoxPart(haExpLeaf, 0.4, 0.65, 2.2, motX, motY + 1.25, motZ);
  addConePart(haExpLantern, 0.22, 0.36, 5, motX, motY + 1.78, motZ);
  // 226 & 227: 6 Alternating diamond/garlic silk lanterns near Chùa Cầu & 4 corner terracotta planters
  for (let i = 0; i < 6; i++) {
    const lx = qx - 10 + i * 4.0;
    addConePart(haExpLantern, 0.22, 0.38, 5, lx, qY + 4.4, brCenterZ + (i % 2 === 0 ? -4.2 : 4.2));
  }
  for (const [px, pz] of [[qx - 21, qz - 50], [qx + 21, qz - 50], [qx - 21, qz + 48], [qx + 21, qz + 48]] as Array<[number, number]>) {
    const py = ctx.getHeight(px, pz);
    addBoxPart(haExpRoof, 1.1, 0.55, 1.1, px, py + 0.28, pz);
    addConePart(haExpLeaf, 0.72, 1.15, 5, px, py + 1.05, pz);
  }

  // --- Wave 3 Macro Visual QC & Expansion (430–458): Assembly Hall Inner Courtyard, Tailors, Lantern Workshops & Rooftops ---
  const w3HaCrimson: THREE.BufferGeometry[] = [];
  const w3HaRoof: THREE.BufferGeometry[] = [];
  const w3HaGold: THREE.BufferGeometry[] = [];
  const w3HaWood: THREE.BufferGeometry[] = [];
  const w3HaWall: THREE.BufferGeometry[] = [];
  const w3HaStone: THREE.BufferGeometry[] = [];
  const w3HaLeaf: THREE.BufferGeometry[] = [];
  const w3HaLantern: THREE.BufferGeometry[] = [];
  const leafMatHa = ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone;
  // 430–434: Phúc Kiến Assembly Hall inner courtyard pond/rockery, spiral incense rack, model dragon-boat altar, ancestor tablet pavilion & stone dragon screen
  const fkX = qx;
  const fkZ = qz - 62;
  const fkY = ctx.getHeight(fkX, fkZ);
  addW3Plinth(w3HaStone, 5.2, 4.2, fkY + 0.52, fkY, fkX, fkZ + 6.5);
  addConePart(w3HaStone, 1.35, 1.95, 5, fkX, fkY + 1.48, fkZ + 6.5);
  // 431: Spiral incense rack
  for (const ixOff of [-1.8, 1.8]) addW3GroundedCol(w3HaWood, 0.08, 0.10, fkY + 2.85, fkY, 5, fkX + ixOff, fkZ + 2.2);
  addBoxPart(w3HaWood, 4.0, 0.12, 0.14, fkX, fkY + 2.82, fkZ + 2.2);
  for (const sxOff of [-1.1, 0, 1.1]) addConePart(w3HaGold, 0.26, 0.52, 5, fkX + sxOff, fkY + 2.42, fkZ + 2.2);
  // 432: Model dragon-boat altar
  addBoxPart(w3HaStone, 2.2, 0.78, 0.95, fkX - 5.4, fkY + 0.39, fkZ + 4.8);
  addBoxPart(w3HaCrimson, 1.85, 0.42, 0.52, fkX - 5.4, fkY + 0.98, fkZ + 4.8);
  addConePart(w3HaGold, 0.18, 0.45, 4, fkX - 6.3, fkY + 1.25, fkZ + 4.8);
  // 433: Ancestor tablet side pavilion
  const apX = fkX + 6.8;
  const apZ = fkZ + 4.2;
  const apY = ctx.getHeight(apX, apZ);
  addW3Plinth(w3HaStone, 3.8, 3.4, apY + 0.38, apY, apX, apZ);
  for (const [ox, oz] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) {
    addW3GroundedCol(w3HaCrimson, 0.10, 0.12, apY + 2.75, apY + 0.38, 5, apX + ox, apZ + oz);
  }
  addW3HipRoof(w3HaRoof, w3HaGold, 4.5, 4.1, apY + 2.75, 1.05, apX, apZ);
  // 434: Stone dragon screen
  addBoxPart(w3HaStone, 4.2, 2.1, 0.36, fkX, fkY + 1.05, fkZ + 10.6);
  addBoxPart(w3HaGold, 3.6, 0.22, 0.42, fkX, fkY + 2.15, fkZ + 10.6);
  // 435–437: Tailor shop Áo Dài mannequins, fabric swatch shelves & fitting mirror/stool
  for (const [tx, tz, side] of [[qx - 28, qz - 22, -1], [qx + 28, qz - 4, 1]] as Array<[number, number, number]>) {
    const ty = ctx.getHeight(tx, tz);
    const fx = tx - side * 5.8;
    // 435: Mannequin pair
    addW3GroundedCol(w3HaWood, 0.04, 0.06, ty + 1.35, ty, 5, fx, tz - 1.6);
    addConePart(w3HaCrimson, 0.24, 0.92, 5, fx, ty + 1.15, tz - 1.6);
    addW3GroundedCol(w3HaWood, 0.04, 0.06, ty + 1.35, ty, 5, fx, tz + 1.6);
    addConePart(w3HaGold, 0.24, 0.92, 5, fx, ty + 1.15, tz + 1.6);
    // 436: Fabric swatch shelving
    addBoxPart(w3HaWood, 0.48, 1.95, 1.85, fx + side * 0.45, ty + 0.98, tz + 3.2);
    addBoxPart(w3HaCrimson, 0.38, 0.32, 1.55, fx + side * 0.42, ty + 1.35, tz + 3.2);
    // 437: Standing mirror & fitting stool
    addBoxPart(w3HaWood, 0.14, 1.65, 0.72, fx - side * 0.35, ty + 0.82, tz - 3.2);
    addCylPart(w3HaWood, 0.32, 0.34, 0.32, 6, fx - side * 0.95, ty + 0.16, tz - 3.2);
  }
  // 438–440: Lantern workshop bamboo-rib bench, silk dye vats & overhead drying pole
  const lwX = qx + 20;
  const lwZ = qz + 18;
  const lwY = ctx.getHeight(lwX, lwZ);
  addBoxPart(w3HaWood, 2.6, 0.82, 1.15, lwX, lwY + 0.41, lwZ);
  addConePart(w3HaLantern, 0.24, 0.36, 5, lwX - 0.6, lwY + 1.02, lwZ);
  addConePart(w3HaGold, 0.22, 0.34, 5, lwX + 0.6, lwY + 1.0, lwZ);
  for (const dzOff of [-0.95, 0.95]) {
    addCylPart(w3HaRoof, 0.38, 0.32, 0.68, 6, lwX + 2.2, lwY + 0.34, lwZ + dzOff);
  }
  addW3GroundedPost(w3HaWood, 0.10, 0.10, lwY + 2.65, lwY, lwX - 1.8, lwZ + 2.2);
  addW3GroundedPost(w3HaWood, 0.10, 0.10, lwY + 2.65, lwY, lwX + 1.8, lwZ + 2.2);
  addBoxPart(w3HaWood, 3.8, 0.08, 0.08, lwX, lwY + 2.62, lwZ + 2.2);
  for (const lxOff of [-1.0, 0, 1.0]) addConePart(w3HaLantern, 0.20, 0.36, 5, lwX + lxOff, lwY + 2.32, lwZ + 2.2);
  // 441–444: Ochre alleyway arched shutter bays, mossy brick drain, heritage plaque/door-eyes & wall shrine niche
  for (const [ax, az, side] of [[qx - 28, qz - 42, -1], [qx + 28, qz - 42, 1], [qx - 28, qz + 34, -1], [qx + 28, qz + 34, 1]] as Array<[number, number, number]>) {
    const ay = ctx.getHeight(ax, az);
    const fx = ax - side * 4.75;
    addBoxPart(w3HaWood, 0.18, 1.35, 1.15, fx, ay + 4.2, az);
    addBoxPart(w3HaRoof, 0.55, 0.16, 1.35, fx - side * 0.22, ay + 4.95, az);
    addBoxPart(w3HaStone, 0.55, 0.14, 9.5, fx - side * 1.65, ay + 0.07, az);
    addBoxPart(w3HaGold, 0.14, 0.42, 1.65, fx - side * 0.1, ay + 2.95, az);
  }
  const nchY = ctx.getHeight(qx + 34, qz - 22);
  addBoxPart(w3HaWall, 0.65, 1.1, 0.65, qx + 34, nchY + 1.4, qz - 22);
  addW3HipRoof(w3HaRoof, null, 0.95, 0.95, nchY + 1.95, 0.35, qx + 34, qz - 22);
  // 445–447: Rooftop café terrace deck, parasols/tables & terracotta chimney/dormer
  const rtX = qx - 28;
  const rtZ = qz - 66;
  const rtY = ctx.getHeight(rtX, rtZ) + 5.65;
  addBoxPart(w3HaWood, 6.4, 0.18, 7.6, rtX, rtY, rtZ);
  addBoxPart(w3HaWood, 6.4, 0.10, 0.10, rtX, rtY + 0.95, rtZ + 3.7);
  addBoxPart(w3HaWood, 0.10, 0.10, 7.6, rtX + 3.1, rtY + 0.95, rtZ);
  for (const pzOff of [-1.8, 1.8]) {
    addW3GroundedCol(w3HaWood, 0.04, 0.05, rtY + 2.25, rtY, 5, rtX + 0.8, rtZ + pzOff);
    addConePart(w3HaCrimson, 1.15, 0.45, 6, rtX + 0.8, rtY + 2.38, rtZ + pzOff);
    addBoxPart(w3HaWood, 0.85, 0.55, 0.85, rtX + 0.8, rtY + 0.32, rtZ + pzOff);
  }
  addBoxPart(w3HaRoof, 0.65, 1.25, 0.65, qx + 28, ctx.getHeight(qx + 28, qz - 66) + 6.4, qz - 66);
  // 448–458: Chùa Cầu approach steps, cyclo, calligraphy stall, leather counter, rainwater jar, balcony rails, alley tie-beams, well bucket, street-food cart, UNESCO bollard & tassel banners
  for (let st = 0; st < 3; st++) {
    addBoxPart(w3HaStone, 1.0, 0.22, 4.4, qx - 12.2 - st * 0.72, qY + 0.12 + (2 - st) * 0.18, brCenterZ);
  }
  const cycY = ctx.getHeight(qx - 18, qz - 12);
  addBoxPart(w3HaWood, 0.95, 0.65, 1.65, qx - 18, cycY + 0.52, qz - 12);
  addCylPart(w3HaWood, 0.32, 0.32, 0.08, 6, qx - 18.52, cycY + 0.34, qz - 11.4, 0, Math.PI * 0.5);
  addCylPart(w3HaWood, 0.32, 0.32, 0.08, 6, qx - 17.48, cycY + 0.34, qz - 11.4, 0, Math.PI * 0.5);
  const calY = ctx.getHeight(qx + 18, qz + 32);
  addBoxPart(w3HaWood, 2.2, 0.78, 0.95, qx + 18, calY + 0.39, qz + 32);
  addBoxPart(w3HaCrimson, 0.32, 1.15, 0.06, qx + 17.5, calY + 1.35, qz + 32);
  addBoxPart(w3HaGold, 0.32, 1.15, 0.06, qx + 18.5, calY + 1.35, qz + 32);
  const lthY = ctx.getHeight(qx - 21, qz + 24);
  addBoxPart(w3HaWood, 1.9, 0.85, 0.85, qx - 21, lthY + 0.42, qz + 24);
  addCylPart(w3HaRoof, 0.42, 0.34, 0.78, 6, qx - 22.8, ctx.getHeight(qx - 22.8, qz - 56) + 0.39, qz - 56);
  addBoxPart(w3HaWood, 0.12, 0.85, 8.4, qx - 23.2, ctx.getHeight(qx - 23.2, qz + 60) + 4.1, qz + 60);
  addBoxPart(w3HaWood, 5.2, 0.16, 0.16, qx + 34, archAy + 3.6, archAz - 5.5);
  addConePart(w3HaLantern, 0.20, 0.36, 5, qx + 34, archAy + 3.25, archAz - 5.5);
  addCylPart(w3HaWood, 0.22, 0.18, 0.34, 5, wellHx + 1.4, wellHy + 0.18, wellHz + 0.8);
  addBoxPart(w3HaStone, 1.2, 0.16, 0.95, wellHx - 1.5, wellHy + 0.08, wellHz + 1.1);
  const fcY = ctx.getHeight(qx - 17, qz + 42);
  addBoxPart(w3HaWood, 1.65, 1.15, 0.95, qx - 17, fcY + 0.65, qz + 42);
  addConePart(w3HaLantern, 0.20, 0.32, 5, qx - 17, fcY + 1.55, qz + 42);
  addW3GroundedPost(w3HaStone, 0.42, 0.42, qY + 1.35, qY, qx - 15.5, qz - 48);
  for (let b = 0; b < 4; b++) {
    addBoxPart(w3HaCrimson, 0.10, 0.68, 0.42, qx - 19.5, qY + 3.15, qz - 28 + b * 14);
  }

  addWave3Mesh(qGroup, w3HaCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(qGroup, w3HaRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(qGroup, w3HaGold, ctx.materials.gold);
  addWave3Mesh(qGroup, w3HaWood, ctx.materials.darkWood);
  addWave3Mesh(qGroup, w3HaWall, ctx.materials.yellowOchrePlaster);
  addWave3Mesh(qGroup, w3HaStone, ctx.materials.stone);
  addWave3Mesh(qGroup, w3HaLeaf, leafMatHa);
  addWave3Mesh(qGroup, w3HaLantern, silkMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (830–858): Quảng Đông Gatehouse, Silk Loom Bay, Nước Mót & Outer Old Town ---
  const w4HaCrimson: THREE.BufferGeometry[] = [];
  const w4HaRoof: THREE.BufferGeometry[] = [];
  const w4HaGold: THREE.BufferGeometry[] = [];
  const w4HaWood: THREE.BufferGeometry[] = [];
  const w4HaWall: THREE.BufferGeometry[] = [];
  const w4HaStone: THREE.BufferGeometry[] = [];
  const w4HaLeaf: THREE.BufferGeometry[] = [];
  const w4HaLantern: THREE.BufferGeometry[] = [];
  // 830 & 831: Quảng Đông Assembly Hall outer gatehouse & octagonal dragon-fountain basin (outer south qz + 82!)
  const qdX = qx;
  const qdZ = qz + 82;
  const qdY = Math.max(ctx.getHeight(qdX, qdZ), ctx.getHeight(qdX - 4, qdZ), ctx.getHeight(qdX + 4, qdZ));
  addW3Plinth(w4HaStone, 10.6, 5.2, qdY + 0.45, qdY, qdX, qdZ);
  for (const ox of [-4.2, -1.6, 1.6, 4.2]) {
    addW3GroundedCol(w4HaCrimson, 0.14, 0.16, qdY + 3.65, qdY + 0.45, 5, qdX + ox, qdZ - 1.6);
    addW3GroundedCol(w4HaCrimson, 0.14, 0.16, qdY + 3.65, qdY + 0.45, 5, qdX + ox, qdZ + 1.6);
  }
  addW3HipRoof(w4HaRoof, w4HaGold, 11.4, 6.0, qdY + 3.65, 1.45, qdX, qdZ);
  addCylPart(w4HaStone, 2.2, 2.4, 0.62, 6, qdX, qdY + 0.31, qdZ + 6.8);
  addCylPart(w4HaGold, 0.24, 0.34, 1.35, 5, qdX, qdY + 1.15, qdZ + 6.8);
  // 832–835: Tấn Ký courtyard terrace, silk-weaving loom bay, porcelain shopfront & Thanh Hà tile-kiln shed
  const tkHaX = qx;
  const tkHaZ = qz - 84;
  const tkHaY = ctx.getHeight(tkHaX, tkHaZ);
  addW3Plinth(w4HaStone, 9.6, 5.8, tkHaY + 0.38, tkHaY, tkHaX, tkHaZ);
  const loomX = qx + 44;
  const loomZ = qz - 48;
  const loomY = Math.max(ctx.getHeight(loomX, loomZ), ctx.getHeight(loomX + 2, loomZ));
  addW3Plinth(w4HaStone, 5.2, 4.0, loomY + 0.32, loomY, loomX, loomZ);
  for (const [ox, oz] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]]) addW3GroundedCol(w4HaWood, 0.09, 0.11, loomY + 2.75, loomY + 0.32, 5, loomX + ox, loomZ + oz);
  addW3HipRoof(w4HaRoof, null, 5.8, 4.6, loomY + 2.75, 1.05, loomX, loomZ);
  addBoxPart(w4HaWood, 2.2, 1.25, 1.05, loomX, loomY + 0.95, loomZ);
  const pcX = qx - 44;
  const pcZ = qz - 48;
  const pcY = ctx.getHeight(pcX, pcZ);
  addBoxPart(w4HaWall, 5.4, 3.2, 4.2, pcX, pcY + 1.6, pcZ);
  addW3HipRoof(w4HaRoof, null, 6.2, 4.8, pcY + 3.2, 1.15, pcX, pcZ);
  const klX = qx + 48;
  const klZ = qz + 44;
  const klY = ctx.getHeight(klX, klZ);
  addBoxPart(w4HaWall, 4.4, 2.4, 3.6, klX, klY + 1.2, klZ);
  addW3HipRoof(w4HaRoof, null, 5.0, 4.2, klY + 2.4, 0.95, klX, klZ);
  // 836–842: Nước Mót tea kiosk, watchmaker sign, lion gargoyle, yellow alley arch, cyclo canopy, lantern drying loft & paper-mask table
  const nmX = qx - 16;
  const nmZ = qz + 72;
  const nmY = ctx.getHeight(nmX, nmZ);
  addBoxPart(w4HaWood, 3.2, 0.88, 1.4, nmX, nmY + 0.44, nmZ);
  for (const ox of [-1.4, 1.4]) addW3GroundedCol(w4HaWood, 0.07, 0.08, nmY + 2.45, nmY, 5, nmX + ox, nmZ);
  addW3HipRoof(w4HaRoof, null, 3.8, 2.2, nmY + 2.45, 0.68, nmX, nmZ);
  addW3GroundedPost(w4HaWood, 0.10, 0.10, nmY + 2.8, nmY, nmX + 5.2, nmZ);
  addBoxPart(w4HaGold, 0.95, 0.48, 0.12, nmX + 5.7, nmY + 2.45, nmZ);
  addW3GroundedPost(w4HaStone, 0.42, 0.42, tkHaY + 1.6, tkHaY, qx - 16, qz - 76);
  for (const s of [-1, 1]) addW3GroundedPost(w4HaWall, 0.72, 0.72, tkHaY + 3.4, tkHaY, qx + s * 3.2, qz - 76);
  addBoxPart(w4HaWall, 7.2, 0.65, 0.85, qx, tkHaY + 3.4, qz - 76);
  addW3HipRoof(w4HaRoof, null, 7.8, 1.5, tkHaY + 3.72, 0.65, qx, qz - 76);
  const cyX = qx + 44;
  const cyZ = qz + 18;
  const cyY = ctx.getHeight(cyX, cyZ);
  for (const [ox, oz] of [[-2.4, -1.2], [2.4, -1.2], [-2.4, 1.2], [2.4, 1.2]]) addW3GroundedCol(w4HaWood, 0.08, 0.10, cyY + 2.5, cyY, 5, cyX + ox, cyZ + oz);
  addW3HipRoof(w4HaRoof, null, 5.4, 3.0, cyY + 2.5, 0.82, cyX, cyZ);
  addBoxPart(w4HaWood, 2.8, 1.85, 0.75, loomX, loomY + 1.25, loomZ + 4.2);
  addBoxPart(w4HaWood, 2.4, 0.82, 0.95, qx + 16, nmY + 0.41, qz + 72);
  for (let m = -1; m <= 1; m++) addConePart(w4HaLantern, 0.16, 0.28, 5, qx + 16 + m * 0.65, nmY + 1.0, qz + 72);
  // 843–858: 6 bougainvillea planters, 4 balcony brackets, stone well, Bàn Thờ Thiên, bamboo blinds, woodblock stand, bronze map, coffee cart, outer catenary span, 4 bonsai pedestals, tea-chest counter, flood-mark pillar, 4 benches, tassel stools, rain-chain & festival drum
  for (let p = 0; p < 6; p++) {
    const px = qx + (p < 3 ? -36 : 36);
    const pz = qz - 62 + (p % 3) * 44;
    addBoxPart(w4HaWall, 1.15, 0.58, 0.72, px, ctx.getHeight(px, pz) + 0.29, pz);
    addBoxPart(w4HaLeaf, 0.95, 0.65, 0.55, px, ctx.getHeight(px, pz) + 0.82, pz);
  }
  for (let b = 0; b < 4; b++) {
    const bx = qx + (b < 2 ? -34 : 34);
    const bz = qz + (b % 2 === 0 ? -52 : 52);
    addConePart(w4HaLantern, 0.18, 0.34, 5, bx, ctx.getHeight(bx, bz) + 3.6, bz);
  }
  addCylPart(w4HaStone, 0.95, 1.05, 0.75, 6, qx + 44, ctx.getHeight(qx + 44, qz - 18) + 0.38, qz - 18);
  addW3GroundedPost(w4HaWall, 0.32, 0.32, qdY + 1.65, qdY, qx - 36, qz + 76);
  addW3HipRoof(w4HaRoof, null, 0.78, 0.78, qdY + 1.65, 0.28, qx - 36, qz + 76);
  addBoxPart(w4HaLeaf, 4.2, 0.12, 1.1, pcX + 3.2, pcY + 2.4, pcZ, 0, 0.35, 0);
  addBoxPart(w4HaWood, 1.8, 0.82, 0.92, pcX, pcY + 0.41, pcZ + 4.2);
  addBoxPart(w4HaStone, 0.75, 0.95, 0.55, qx, tkHaY + 0.48, qz - 70);
  addBoxPart(w4HaGold, 0.78, 0.12, 0.58, qx, tkHaY + 1.02, qz - 70, 0, 0.35, 0);
  addBoxPart(w4HaWood, 1.6, 0.82, 0.85, qx + 22, nmY + 0.41, qz + 64);
  for (const s of [-1, 1]) addW3GroundedCol(w4HaCrimson, 0.08, 0.10, qdY + 4.4, qdY, 5, qx + s * 10.5, qz + 74);
  for (let l = -2; l <= 2; l++) addConePart(w4HaLantern, 0.20, 0.36, 5, qx + l * 3.8, qdY + 4.05, qz + 74);
  for (const [bx, bz] of [[-5.2, 5.2], [5.2, 5.2], [-5.2, 8.6], [5.2, 8.6]]) {
    addBoxPart(w4HaStone, 0.65, 0.72, 0.65, qdX + bx, qdY + 0.36, qdZ + bz);
    addConePart(w4HaLeaf, 0.42, 0.68, 5, qdX + bx, qdY + 1.05, qdZ + bz);
  }
  addBoxPart(w4HaWood, 2.2, 0.78, 0.85, pcX - 4.2, pcY + 0.39, pcZ);
  addW3GroundedPost(w4HaStone, 0.38, 0.38, qdY + 1.95, qdY, qx + 36, qz + 76);
  for (let b = 0; b < 4; b++) addBoxPart(w4HaWood, 1.85, 0.48, 0.55, qx + (b < 2 ? -12 : 12), qdY + 0.24, qz + 68 + (b % 2) * 5.0);
  for (let s = 0; s < 3; s++) addCylPart(w4HaWood, 0.22, 0.22, 0.36, 5, loomX - 3.6 + s * 0.75, loomY + 0.18, loomZ + 3.2);
  addCylPart(w4HaGold, 0.04, 0.04, 2.8, 4, pcX + 2.8, pcY + 1.4, pcZ + 2.2);
  addBoxPart(w4HaCrimson, 1.35, 0.85, 0.95, qdX, qdY + 0.88, qdZ - 3.8);
  addCylPart(w4HaGold, 0.42, 0.42, 0.65, 6, qdX, qdY + 1.15, qdZ - 3.8, 0, Math.PI * 0.5);

  addWave3Mesh(qGroup, w4HaCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(qGroup, w4HaRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(qGroup, w4HaGold, ctx.materials.gold);
  addWave3Mesh(qGroup, w4HaWood, ctx.materials.darkWood);
  addWave3Mesh(qGroup, w4HaWall, ctx.materials.yellowOchrePlaster);
  addWave3Mesh(qGroup, w4HaStone, ctx.materials.stone);
  addWave3Mesh(qGroup, w4HaLeaf, leafMatHa);
  addWave3Mesh(qGroup, w4HaLantern, silkMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1230–1258): Phúc Kiến Side-Gate, Outer Arcade, Cao Lầu Stall & Craft Vignettes ---
  const w5HaCrimson: THREE.BufferGeometry[] = [];
  const w5HaRoof: THREE.BufferGeometry[] = [];
  const w5HaGold: THREE.BufferGeometry[] = [];
  const w5HaWood: THREE.BufferGeometry[] = [];
  const w5HaWall: THREE.BufferGeometry[] = [];
  const w5HaStone: THREE.BufferGeometry[] = [];
  const w5HaLeaf: THREE.BufferGeometry[] = [];
  const w5HaLantern: THREE.BufferGeometry[] = [];
  // 1230 & 1231: Phúc Kiến Heritage Side-Gate Pavilion (outer west qx - 52, qz + 18) & Outer East Shophouse Arcade Bay (qx + 54, qz - 2)
  const pkX = qx - 52;
  const pkZ = qz + 18;
  const pkY = Math.max(ctx.getHeight(pkX, pkZ), ctx.getHeight(pkX - 3, pkZ));
  addW3Plinth(w5HaStone, 6.8, 3.8, pkY + 0.38, pkY, pkX, pkZ);
  for (const ox of [-2.6, -0.9, 0.9, 2.6]) addW3GroundedCol(w5HaCrimson, 0.12, 0.14, pkY + 3.45, pkY + 0.38, 5, pkX + ox, pkZ);
  addW3HipRoof(w5HaRoof, w5HaGold, 7.6, 4.4, pkY + 3.45, 1.15, pkX, pkZ);
  const shX = qx + 54;
  const shZ = qz - 2;
  const shY = Math.max(ctx.getHeight(shX, shZ), ctx.getHeight(shX + 3, shZ));
  addW3Plinth(w5HaStone, 6.4, 4.8, shY + 0.35, shY, shX, shZ);
  addBoxPart(w5HaWall, 5.4, 3.1, 3.8, shX, shY + 1.9, shZ);
  addW3HipRoof(w5HaRoof, null, 6.6, 5.0, shY + 3.45, 1.15, shX, shZ);
  // 1232–1238: Quảng Đông twin guardian pedestals, lantern-frame bench, Cao Lầu stall, Thanh Hà pottery shelf, woodcarver log yard, Khám Thờ Tường niche & silk-bolt cart
  for (const s of [-1, 1]) {
    addBoxPart(w5HaStone, 1.05, 1.15, 1.05, qdX + s * 6.4, qdY + 0.58, qdZ + 2.8);
    addConePart(w5HaGold, 0.32, 0.48, 4, qdX + s * 6.4, qdY + 1.38, qdZ + 2.8);
  }
  addBoxPart(w5HaWood, 2.8, 0.84, 0.98, loomX + 5.2, loomY + 0.42, loomZ);
  const clX = qx - 28;
  const clZ = qz + 72;
  const clY = ctx.getHeight(clX, clZ);
  addBoxPart(w5HaWood, 3.2, 0.85, 1.35, clX, clY + 0.42, clZ);
  for (const ox of [-1.4, 1.4]) addW3GroundedCol(w5HaWood, 0.07, 0.08, clY + 2.45, clY, 5, clX + ox, clZ);
  addW3HipRoof(w5HaRoof, null, 3.8, 2.1, clY + 2.45, 0.65, clX, clZ);
  addConePart(w5HaLantern, 0.18, 0.32, 5, clX, clY + 2.15, clZ + 0.9);
  addBoxPart(w5HaWood, 2.4, 1.35, 0.65, klX - 4.8, klY + 0.68, klZ);
  addBoxPart(w5HaWood, 3.6, 0.68, 1.25, nmX + 9.2, nmY + 0.34, nmZ - 3.2);
  addBoxPart(w5HaWall, 1.65, 1.85, 0.48, qx - 36, qdY + 0.92, qz + 64);
  addW3HipRoof(w5HaRoof, null, 2.0, 0.92, qdY + 1.85, 0.36, qx - 36, qz + 64);
  addBoxPart(w5HaWood, 1.85, 0.92, 0.85, shX - 4.8, shY + 0.46, shZ + 3.2);
  addCylPart(w5HaCrimson, 0.14, 0.14, 0.95, 5, shX - 4.8, shY + 1.05, shZ + 3.2, 0, Math.PI * 0.5);
  // 1239–1248: 4 drainage grates, Gánh Hàng Rong stand, lattice screen, postbox pillar, incense-coil tripod, 4 lamp standards, clay-kneading slab, calligraphy table, 4 step stoops & birdcage rack
  for (let g = 0; g < 4; g++) addBoxPart(w5HaStone, 1.15, 0.12, 0.65, qx - 18 + g * 12, qdY + 0.06, qz + 62);
  addBoxPart(w5HaWood, 1.65, 0.08, 0.08, nmX - 3.6, nmY + 0.72, nmZ + 1.4);
  for (const s of [-1, 1]) addCylPart(w5HaLeaf, 0.28, 0.22, 0.34, 5, nmX - 3.6 + s * 0.65, nmY + 0.24, nmZ + 1.4);
  addBoxPart(w5HaWood, 3.4, 1.85, 0.16, tkHaX + 6.4, tkHaY + 0.92, tkHaZ);
  addW3GroundedPost(w5HaWall, 0.42, 0.42, tkHaY + 1.45, tkHaY, qx + 14, qz - 76);
  addBoxPart(w5HaCrimson, 0.46, 0.42, 0.46, qx + 14, tkHaY + 1.25, qz - 76);
  addW3GroundedCol(w5HaGold, 0.08, 0.10, qdY + 1.75, qdY, 5, qdX + 4.8, qdZ + 6.8);
  for (let l = 0; l < 4; l++) {
    const lz = qz - 32 + l * 22;
    const ly = ctx.getHeight(qx + 42, lz);
    addW3GroundedCol(w5HaWood, 0.06, 0.08, ly + 3.25, ly, 5, qx + 42, lz);
    addConePart(w5HaLantern, 0.18, 0.34, 5, qx + 42, ly + 3.35, lz);
  }
  addBoxPart(w5HaStone, 1.45, 0.42, 1.15, klX + 4.6, klY + 0.21, klZ);
  addBoxPart(w5HaWood, 2.2, 0.82, 0.95, pcX, pcY + 0.41, pcZ - 4.4);
  for (let st = 0; st < 4; st++) addBoxPart(w5HaStone, 1.65, 0.28, 0.72, qx + (st < 2 ? -40 : 40), ctx.getHeight(qx + (st < 2 ? -40 : 40), qz - 16 + (st % 2) * 32) + 0.14, qz - 16 + (st % 2) * 32);
  addW3GroundedPost(w5HaWood, 0.08, 0.08, cyY + 2.35, cyY, cyX - 4.8, cyZ);
  for (let bc = -1; bc <= 1; bc++) addConePart(w5HaLeaf, 0.16, 0.28, 5, cyX - 4.8 + bc * 0.55, cyY + 2.05, cyZ);
  // 1249–1258: Yin-yang tile stack, stone koi-trough, apothecary cabinet, twin southern lantern arches, clog-maker bench, bronze fire-bell, stone tea table, glue-pot stand, 6 bollards & UNESCO stele
  addBoxPart(w5HaRoof, 2.0, 0.78, 1.15, klX, klY + 0.39, klZ + 4.2);
  addBoxPart(w5HaStone, 2.4, 0.65, 1.25, tkHaX - 6.8, tkHaY + 0.32, tkHaZ);
  addBoxPart(w5HaWood, 1.65, 1.45, 0.65, shX - 4.8, shY + 0.72, shZ - 2.6);
  for (const s of [-1, 1]) {
    addW3GroundedCol(w5HaCrimson, 0.10, 0.12, qdY + 4.1, qdY, 5, qx + s * 6.5, qz + 90);
    addConePart(w5HaLantern, 0.20, 0.36, 5, qx + s * 3.0, qdY + 3.85, qz + 90);
  }
  addBoxPart(w5HaCrimson, 13.6, 0.22, 0.22, qx, qdY + 4.05, qz + 90);
  addBoxPart(w5HaWood, 1.65, 0.76, 0.82, pkX + 5.2, pkY + 0.38, pkZ);
  addW3GroundedCol(w5HaWood, 0.07, 0.09, qdY + 2.65, qdY, 5, qx + 28, qz + 76);
  addCylPart(w5HaGold, 0.18, 0.24, 0.32, 5, qx + 28, qdY + 2.35, qz + 76);
  addCylPart(w5HaStone, 0.78, 0.62, 0.72, 6, pkX, pkY + 0.36, pkZ + 5.2);
  addBoxPart(w5HaWood, 1.15, 0.78, 0.68, loomX - 4.8, loomY + 0.39, loomZ);
  for (let b = 0; b < 6; b++) addW3GroundedPost(w5HaStone, 0.32, 0.32, tkHaY + 1.05, tkHaY, qx - 10 + b * 4.0, qz - 90);
  addBoxPart(w5HaStone, 1.45, 2.25, 0.38, qx, qdY + 1.12, qz + 95);
  addBoxPart(w5HaGold, 1.05, 1.45, 0.42, qx, qdY + 1.25, qz + 95);

  addWave3Mesh(qGroup, w5HaCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(qGroup, w5HaRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(qGroup, w5HaGold, ctx.materials.gold);
  addWave3Mesh(qGroup, w5HaWood, ctx.materials.darkWood);
  addWave3Mesh(qGroup, w5HaWall, ctx.materials.yellowOchrePlaster);
  addWave3Mesh(qGroup, w5HaStone, ctx.materials.stone);
  addWave3Mesh(qGroup, w5HaLeaf, leafMatHa);
  addWave3Mesh(qGroup, w5HaLantern, silkMat);

  qGroup.add(
    new THREE.Mesh(mergeNormalized(colParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized([...roofParts, ...haExpRoof]), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized([...goldParts, ...haExpGold]), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized([...woodParts, ...haExpWood]), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized([...wallParts, ...haExpWall]), ctx.materials.yellowOchrePlaster),
    new THREE.Mesh(mergeNormalized(winParts), silkMat),
    new THREE.Mesh(mergeNormalized(haExpStone), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(haExpLeaf), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(haExpLantern), silkMat),
    canopyInst,
    pillarLanterns,
    poolInst
  );
  ctx.scene.add(qGroup);
  return { group: qGroup, silkMat };
}

function buildHoaiRiverNightPromenadeMacro(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): {
  group: THREE.Group;
  silkMat: THREE.MeshStandardMaterial;
  skyMat: THREE.MeshStandardMaterial;
  flowerMat: THREE.MeshStandardMaterial;
} {
  const uTimeObj = { uTime: { value: 0 } };
  animList.push(uTimeObj);
  const silkMat = createHoiAnMacroSilkMat(uTimeObj);
  ctx.extraMaterials.push(silkMat);
  const cylGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.56, 10);
  const cols = HOI_AN_LANTERN_PALETTE;
  const rand = mulberry32(22023);

  // --- M3: HoaiRiverNightPromenade (760, 260) ---
  const rx = 760;
  const rz = 260;
  ctx.exclusionCircles.push({ x: rx, z: rz, r: 135 });
  const rGroup = new THREE.Group();
  rGroup.name = 'HoaiRiverNightPromenade';
  const brCrimsonParts: THREE.BufferGeometry[] = [];
  const brStoneParts: THREE.BufferGeometry[] = [];
  const bankWoodParts: THREE.BufferGeometry[] = [];
  const bankShopParts: THREE.BufferGeometry[] = [];
  const bankRoofParts: THREE.BufferGeometry[] = [];
  const bankGoldParts: THREE.BufferGeometry[] = [];
  const bankWinParts: THREE.BufferGeometry[] = [];

  // FIX R32: Gently Arched 92m CRIMSON-LACQUER Balustrade Bridge over Hoài River (z = 236..328) + Grounded Approach Staircases & Stone Abutments at BOTH ends!
  const brStartZ = rz - 24;
  const brSpanZ = 92.0;
  const brSegs = 24;
  const brArchY = (t: number): number => VIETNAM_WATER_LEVEL + 2.1 + Math.sin(clamp01(t) * Math.PI) * 2.35;
  for (let p = 0; p < brSegs; p++) {
    const t0 = p / brSegs;
    const t1 = (p + 1) / brSegs;
    const tm = (t0 + t1) * 0.5;
    const z0 = brStartZ + t0 * brSpanZ;
    const z1 = brStartZ + t1 * brSpanZ;
    const zm = (z0 + z1) * 0.5;
    const y0 = brArchY(t0);
    const y1 = brArchY(t1);
    const ym = brArchY(tm);
    const dz = z1 - z0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dz, dy) + 0.08;
    const pitch = -Math.atan2(dy, dz);
    addBoxPart(brCrimsonParts, 4.8, 0.36, segLen, rx, ym, zm, 0, pitch, 0);
    for (const s of [-1, 1]) {
      addBoxPart(brCrimsonParts, 0.16, 0.14, segLen, rx + s * 2.1, ym + 1.12, zm, 0, pitch, 0);
      addBoxPart(brCrimsonParts, 0.12, 0.10, segLen, rx + s * 2.1, ym + 0.55, zm, 0, pitch, 0);
    }
  }
  for (let p = 0; p <= brSegs; p++) {
    const t = p / brSegs;
    const pz = brStartZ + t * brSpanZ;
    const py = brArchY(t);
    const pierH = Math.max(2.6, py - (VIETNAM_WATER_LEVEL - 1.6));
    for (const s of [-1, 1]) {
      addCylPart(brCrimsonParts, 0.14, 0.18, pierH, 8, rx + s * 2.1, py - pierH * 0.5, pz);
      addBoxPart(brCrimsonParts, 0.14, 1.05, 0.14, rx + s * 2.1, py + 0.65, pz);
      addBoxPart(brCrimsonParts, 0.09, 2.35, 0.09, rx + s * 2.1, py + 1.72, pz);
    }
    addBoxPart(brCrimsonParts, 4.6, 0.12, 0.12, rx, py + 2.85, pz);
  }
  // Grounded stepped stone abutments & approach staircases connecting BOTH ends of the 92m bridge cleanly into terrain
  const endDeckY = brArchY(0);
  for (const [endZ, dir] of [
    [brStartZ, -1],
    [brStartZ + brSpanZ, 1]
  ] as Array<[number, number]>) {
    const groundAtFoot = Math.min(VIETNAM_WATER_LEVEL - 0.2, ctx.getHeight(rx, endZ + dir * 7.5) - 0.35);
    const abutH = Math.max(2.8, endDeckY - groundAtFoot);
    // Solid stone abutment pier beneath bridge end
    addBoxPart(brStoneParts, 5.4, abutH, 2.4, rx, endDeckY - abutH * 0.5 - 0.12, endZ + dir * 0.8);
    // 8 descending stone-and-crimson approach steps from bridge deck down into bank terrain
    const steps = 8;
    for (let st = 0; st < steps; st++) {
      const f = st / (steps - 1);
      const sz = endZ + dir * (1.8 + st * 0.88);
      const topY = endDeckY - 0.14 - f * (endDeckY - Math.max(groundAtFoot + 0.2, ctx.getHeight(rx, sz) - 0.1));
      const blockH = Math.max(0.55, topY - (groundAtFoot - 0.4));
      addBoxPart(brStoneParts, 4.8, blockH, 0.96, rx, topY - blockH * 0.5, sz);
      // Crimson handrails stepping down both cheeks of approach stairs
      for (const s of [-1, 1]) {
        addBoxPart(brStoneParts, 0.36, blockH + 0.45, 0.96, rx + s * 2.25, topY - blockH * 0.5 + 0.22, sz);
        addBoxPart(brCrimsonParts, 0.14, 0.95, 0.14, rx + s * 2.15, topY + 0.55, sz);
      }
    }
  }

  // 10 riverside ochre shophouses along northern bank (z = 218) with Mắt cửa, doors, shutters & wooden awnings
  for (let i = 0; i < 10; i++) {
    const sx = rx - 110 + i * 24;
    const sz = 218;
    const sy = ctx.getHeight(sx, sz);
    const frontZ = sz + 5.05;
    addBoxPart(bankShopParts, 16, 4.8, 10, sx, sy + 2.4, sz);
    addBoxPart(bankWoodParts, 10.6, 2.9, 0.30, sx, sy + 1.45, frontZ);
    const eyes = createHoiAnDoorEyesParts(sx, sy + 2.85, frontZ + 0.14, 0, 1.35, 0.18);
    bankWoodParts.push(...eyes.woodParts);
    bankGoldParts.push(...eyes.goldParts);
    // Wooden awning projecting toward riverfront
    addBoxPart(bankWoodParts, 14.8, 0.14, 2.1, sx, sy + 2.95, frontZ + 0.95, 0, 0.24, 0);
    for (const ax of [-6.0, 0, 6.0]) {
      addCylPart(bankWoodParts, 0.08, 0.09, 2.85, 6, sx + ax, sy + 1.42, frontZ + 1.85);
    }
    // Upper shuttered windows facing Hoài River
    for (const wx of [-4.2, 4.2]) {
      addBoxPart(bankWinParts, 2.1, 1.25, 0.16, sx + wx, sy + 3.75, frontZ + 0.06);
      addBoxPart(bankWoodParts, 0.48, 1.32, 0.12, sx + wx - 1.28, sy + 3.75, frontZ + 0.12);
      addBoxPart(bankWoodParts, 0.48, 1.32, 0.12, sx + wx + 1.28, sy + 3.75, frontZ + 0.12);
    }
    const rf = createVietnameseCurvedRoofGeometry(17.5, 11.4, 12.0, 2.2, 2.4, 0.3);
    rf.translate(sx, sy + 4.8, sz);
    bankRoofParts.push(rf);
  }
  rGroup.add(
    new THREE.Mesh(mergeNormalized(brCrimsonParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brStoneParts), 2.2), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(bankWoodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bankShopParts), ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster),
    new THREE.Mesh(mergeNormalized(bankRoofParts), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(bankGoldParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(bankWinParts), silkMat)
  );

  // 140 Bridge Rail & Overhead Lanterns following the arched bridge profile
  const brLanterns = new THREE.InstancedMesh(cylGeo, silkMat, 140);
  for (let i = 0; i < 140; i++) {
    const slot = i % 70;
    const t = slot / 69;
    const lz = brStartZ + t * brSpanZ;
    const lx = rx + (i < 70 ? -2.05 : 2.05);
    setInstanceMatrix(brLanterns, i, lx, brArchY(t) + 2.52, lz, 0, 0, 0, 0.85, 0.85, 0.85);
    brLanterns.setColorAt(i, cols[i % 2]);
  }
  brLanterns.instanceMatrix.needsUpdate = true;
  if (brLanterns.instanceColor) brLanterns.instanceColor.needsUpdate = true;
  rGroup.add(brLanterns);

  // 450 Animated Bobbing & Drifting Multi-Petal Blooming Hoa Đăng + 260 Sky Lanterns
  const flowerGeo = createBloomingHoaDangGeometry(1.18);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#ff8844'),
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide
  });
  flowerMat.userData.noDedupe = true;
  flowerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeObj.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 fPos = vec3(0.0);
       #ifdef USE_INSTANCING
       fPos = vec3(instanceMatrix[3].xyz);
       #endif
       transformed.y += sin(uTime * 2.1 + fPos.x * 0.55 + fPos.z * 0.72) * 0.055;
       transformed.x += mod(uTime * 0.24 + fPos.z * 1.35 + fPos.x * 0.35, 16.0) - 8.0;`
    );
  };
  ctx.extraMaterials.push(flowerMat);
  const flowerInst = new THREE.InstancedMesh(flowerGeo, flowerMat, 450);
  for (let i = 0; i < 450; i++) {
    const fx = rx + (rand() - 0.5) * 235;
    const fz = 248 + rand() * 72;
    setInstanceMatrix(flowerInst, i, fx, VIETNAM_WATER_LEVEL + 0.06, fz, 0, rand() * 6.28, 0, 1, 1, 1);
  }
  flowerInst.instanceMatrix.needsUpdate = true;

  const skyMat = new THREE.MeshStandardMaterial({
    color: '#ff9040',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.45,
    roughness: 0.6
  });
  skyMat.userData.noDedupe = true;
  skyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeObj.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 sp = vec3(0.0);
       #ifdef USE_INSTANCING
       sp = vec3(instanceMatrix[3].xyz);
       #endif
       transformed.y += mod(uTime * 0.85 + sp.x * 1.1 + sp.z * 1.7, 95.0);
       transformed.x += sin(uTime * 0.4 + sp.z) * 1.8;`
    );
  };
  ctx.extraMaterials.push(skyMat);
  const skyInst = new THREE.InstancedMesh(createLanternCoreGeometry(0.45, 0.78), skyMat, 260);
  for (let i = 0; i < 260; i++) {
    setInstanceMatrix(
      skyInst,
      i,
      rx + (rand() - 0.5) * 240,
      10 + rand() * 14,
      rz + (rand() - 0.5) * 180,
      0,
      rand() * 3.14,
      0,
      1,
      1,
      1
    );
  }
  skyInst.instanceMatrix.needsUpdate = true;

  // 6 Tapered Wooden River Sampans carrying lanterns along Hoài River
  for (let b = 0; b < 6; b++) {
    const bx = rx - 95 + b * 38;
    const bz = 268 + (b % 2) * 26;
    const sampan = new THREE.Group();
    const sParts: THREE.BufferGeometry[] = createTaperedSampanHullParts(6.6, 1.55, 0.52);
    addCylPart(sParts, 0.045, 0.055, 2.25, 6, 2.75, 1.22, 0);
    addCylPart(sParts, 0.04, 0.04, 0.75, 5, 2.45, 2.25, 0, 0, Math.PI * 0.5);
    sampan.add(new THREE.Mesh(mergeNormalized(sParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood));
    const bowLantern = new THREE.Mesh(cylGeo, silkMat);
    bowLantern.position.set(2.15, 2.02, 0);
    sampan.add(bowLantern);
    sampan.position.set(bx, VIETNAM_WATER_LEVEL + 0.04, bz);
    rGroup.add(sampan);
    ctx.junkBoats.push({
      group: sampan,
      centerX: bx,
      centerZ: bz,
      radiusX: 2.2,
      radiusZ: 1.4,
      speed: 0.20,
      phase: b * 1.1
    });
  }

  // --- 200-Item Macro Visual QC & Expansion (031–044): Sông Hoài Promenade & Chợ Đêm An Hội ---
  const hrExpStone: THREE.BufferGeometry[] = [];
  const hrExpWood: THREE.BufferGeometry[] = [];
  const hrExpCrimson: THREE.BufferGeometry[] = [];
  const hrExpGold: THREE.BufferGeometry[] = [];
  const hrExpLantern: THREE.BufferGeometry[] = [];
  const hrExpLeaf: THREE.BufferGeometry[] = [];

  // 031 & 032: Continuous stone riverfront embankment wall & 3 stepped boat-landing stairs
  addBoxPart(hrExpStone, 232.0, 2.2, 2.4, rx, VIETNAM_WATER_LEVEL + 0.55, 231.0);
  for (const lsx of [rx - 64, rx - 18, rx + 54]) {
    for (let st = 0; st < 5; st++) {
      addBoxPart(hrExpStone, 5.2, 0.28, 0.72, lsx, VIETNAM_WATER_LEVEL + 0.18 + st * 0.26, 234.6 - st * 0.65);
    }
    // 037: Bamboo hoa đăng vendor baskets on landing steps
    addCylPart(hrExpGold, 0.42, 0.32, 0.28, 7, lsx + 1.8, VIETNAM_WATER_LEVEL + 0.95, 232.8);
  }
  // 033 & 034: 6 An Hội Night Market stalls on southern bank with fabric canopies & lantern racks
  for (let m = 0; m < 6; m++) {
    const mx = rx - 65 + m * 26;
    if (Math.abs(mx - rx) < 8) continue;
    const mz = 336.0;
    const my = Math.max(VIETNAM_WATER_LEVEL + 1.2, ctx.getHeight(mx, mz));
    for (const [ox, oz] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) {
      addCylPart(hrExpWood, 0.06, 0.07, 2.8, 5, mx + ox, my + 1.4, mz + oz);
    }
    const canopy = createGableRoofGeometry(5.6, 4.0, 1.15, 0.12, 'x');
    canopy.translate(mx, my + 2.8, mz);
    hrExpCrimson.push(canopy);
    addBoxPart(hrExpWood, 4.4, 0.78, 1.2, mx, my + 0.39, mz);
    for (let lk = -2; lk <= 2; lk++) {
      hrExpLantern.push(createLanternCoreGeometry(0.16, 0.30).translate(mx + lk * 0.9, my + 2.35, mz - 1.55));
    }
  }
  // 035 & 036: 8 riverside café tables & carved stone balustrades + streetlamps along northern quay
  for (let c = 0; c < 8; c++) {
    const cxTab = rx - 92 + c * 26;
    const czTab = 226.5;
    const cyTab = ctx.getHeight(cxTab, czTab);
    addCylPart(hrExpWood, 0.55, 0.55, 0.08, 8, cxTab, cyTab + 0.72, czTab);
    addCylPart(hrExpWood, 0.08, 0.12, 0.72, 6, cxTab, cyTab + 0.36, czTab);
    hrExpLantern.push(createLanternCoreGeometry(0.12, 0.22).translate(cxTab, cyTab + 0.88, czTab));
    // Heritage streetlamp
    addCylPart(hrExpWood, 0.08, 0.12, 3.8, 6, cxTab + 6.0, cyTab + 1.9, 229.6);
    hrExpLantern.push(createLanternCoreGeometry(0.22, 0.38).translate(cxTab + 6.0, cyTab + 3.95, 229.6));
  }
  hrExpStone.push(...createPiercedBalustradeParts(rx - 112, 229.8, rx - 4, 229.8, VIETNAM_WATER_LEVEL + 1.65, 0.82, 'lotus_stone'));
  hrExpStone.push(...createPiercedBalustradeParts(rx + 4, 229.8, rx + 112, 229.8, VIETNAM_WATER_LEVEL + 1.65, 0.82, 'lotus_stone'));
  // 038: 6 weeping riverside trees framing open promenade margins (>= 4.5m clear of all shophouses & stalls!)
  const hoaiTreeCoords: Array<[number, number]> = [
    [rx - 126, 225.5], [rx + 126, 225.5], [rx - 94, 328.0],
    [rx - 34, 328.0], [rx + 44, 328.0], [rx + 94, 328.0]
  ];
  for (let t = 0; t < hoaiTreeCoords.length; t++) {
    const [tx, tz] = hoaiTreeCoords[t];
    const ty = Math.max(VIETNAM_WATER_LEVEL + 1.0, ctx.getHeight(tx, tz));
    addCylPart(hrExpWood, 0.22, 0.32, 3.8, 6, tx, ty + 1.9, tz);
    hrExpLeaf.push(createSculptedRockGeometry(2400 + t, 3.4, 2.6, 3.4, 1).translate(tx, ty + 4.8, tz));
  }
  // 040 & 041 & 043: An Hội welcome archway at southern bridge end, mooring posts & timber viewing deck
  const archSz = brStartZ + brSpanZ + 2.0;
  const archSy = ctx.getHeight(rx, archSz);
  addCylPart(hrExpCrimson, 0.24, 0.28, 5.2, 7, rx - 3.0, archSy + 2.6, archSz);
  addCylPart(hrExpCrimson, 0.24, 0.28, 5.2, 7, rx + 3.0, archSy + 2.6, archSz);
  const anHoiRoof = createVietnameseCurvedRoofGeometry(7.8, 3.2, 4.6, 1.1, 1.4, 0.45);
  anHoiRoof.translate(rx, archSy + 5.1, archSz);
  hrExpCrimson.push(anHoiRoof);
  for (let mp = -4; mp <= 4; mp++) {
    addCylPart(hrExpStone, 0.18, 0.22, 0.9, 6, rx + mp * 24, VIETNAM_WATER_LEVEL + 1.1, 232.6);
  }
  addBoxPart(hrExpWood, 12.0, 0.24, 4.8, rx + 34, VIETNAM_WATER_LEVEL + 1.55, 232.2);

  // --- Wave 2 Macro Visual QC & Expansion (231–244): Sông Hoài Floating Shrine & Bài Chòi Music Stage ---
  // 231: Đài Hoa Đăng Nổi Sông Hoài floating lotus-lantern shrine platform mid-channel
  const flShrineX = rx - 28;
  const flShrineZ = 278.0;
  addCylPart(hrExpWood, 3.8, 4.2, 0.45, 6, flShrineX, VIETNAM_WATER_LEVEL + 0.16, flShrineZ);
  addCylPart(hrExpGold, 2.4, 3.2, 0.4, 6, flShrineX, VIETNAM_WATER_LEVEL + 0.55, flShrineZ);
  for (let c = 0; c < 4; c++) {
    const ca = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
    addCylPart(hrExpCrimson, 0.12, 0.14, 2.8, 5, flShrineX + Math.cos(ca) * 1.9, VIETNAM_WATER_LEVEL + 2.1, flShrineZ + Math.sin(ca) * 1.9);
  }
  addConePart(hrExpCrimson, 3.2, 1.65, 6, flShrineX, VIETNAM_WATER_LEVEL + 4.2, flShrineZ);
  addConePart(hrExpLantern, 0.65, 1.1, 5, flShrineX, VIETNAM_WATER_LEVEL + 2.1, flShrineZ);
  // 232 & 233: Sân Khấu Bài Chòi riverside folk-music stage & 3 bamboo calling-huts (shifted cleanly west of shophouses to rx - 134!)
  const stgX = rx - 134;
  const stgZ = 224.0;
  const stgY = ctx.getHeight(stgX, stgZ);
  addBoxPart(hrExpWood, 8.8, 0.65, 5.4, stgX, stgY + 0.32, stgZ);
  addBoxPart(hrExpCrimson, 8.4, 3.2, 0.25, stgX, stgY + 2.2, stgZ - 2.6);
  addBoxPart(hrExpGold, 4.6, 0.72, 0.18, stgX, stgY + 3.2, stgZ - 2.42);
  for (const cxOff of [-7.5, 0, 7.5]) {
    const chX = stgX + cxOff;
    const chZ = stgZ - 6.8;
    const chY = ctx.getHeight(chX, chZ);
    addBoxPart(hrExpWood, 1.8, 0.14, 1.8, chX, chY + 1.35, chZ);
    addCylPart(hrExpWood, 0.06, 0.07, 2.5, 5, chX - 0.75, chY + 1.25, chZ - 0.75);
    addCylPart(hrExpWood, 0.06, 0.07, 2.5, 5, chX + 0.75, chY + 1.25, chZ + 0.75);
    addConePart(hrExpLeaf, 1.55, 1.0, 4, chX, chY + 2.95, chZ, Math.PI * 0.25);
  }
  // 234 & 235: Southern An Hội boat-landing stairs & Night Market entrance archway
  for (let st = 0; st < 4; st++) {
    addBoxPart(hrExpStone, 4.8, 0.26, 0.7, rx + 26, VIETNAM_WATER_LEVEL + 0.2 + st * 0.25, 326.5 + st * 0.68);
  }
  const nmAx = rx - 82;
  const nmAz = 336.0;
  const nmAy = Math.max(VIETNAM_WATER_LEVEL + 1.2, ctx.getHeight(nmAx, nmAz));
  addCylPart(hrExpCrimson, 0.2, 0.24, 4.4, 6, nmAx, nmAy + 2.2, nmAz - 2.8);
  addCylPart(hrExpCrimson, 0.2, 0.24, 4.4, 6, nmAx, nmAy + 2.2, nmAz + 2.8);
  addBoxPart(hrExpCrimson, 0.45, 0.65, 6.4, nmAx, nmAy + 4.3, nmAz);
  addBoxPart(hrExpGold, 0.52, 0.42, 3.8, nmAx, nmAy + 4.3, nmAz);
  // 236, 237, 240: Lantern craftsman stall (shifted clear of Night Market stall m=4), floating timber pontoon dock & flower-lantern releasing pole stall
  addBoxPart(hrExpWood, 3.6, 0.78, 1.2, rx + 78, ctx.getHeight(rx + 78, 336.0) + 0.39, 336.0);
  for (let k = -1; k <= 1; k++) {
    addConePart(hrExpLantern, 0.22, 0.38, 5, rx + 78 + k * 1.1, ctx.getHeight(rx + 78, 336.0) + 1.85, 336.0);
  }
  addBoxPart(hrExpWood, 6.8, 0.22, 2.6, rx + 58, VIETNAM_WATER_LEVEL + 0.14, 236.5);
  addBoxPart(hrExpWood, 2.2, 0.75, 0.9, rx - 14, VIETNAM_WATER_LEVEL + 1.5, 231.2);
  addCylPart(hrExpGold, 0.04, 0.04, 3.2, 5, rx - 13.5, VIETNAM_WATER_LEVEL + 2.2, 231.5, 0.4, 0.2);
  // 238 & 239: 6 Southern embankment lantern posts & 6 carved granite riverside benches along Bạch Đằng
  for (let i = 0; i < 6; i++) {
    const px = rx - 75 + i * 30;
    const sy = Math.max(VIETNAM_WATER_LEVEL + 1.2, ctx.getHeight(px, 331.5));
    addCylPart(hrExpWood, 0.08, 0.10, 3.2, 5, px, sy + 1.6, 331.5);
    addConePart(hrExpLantern, 0.20, 0.34, 5, px, sy + 3.25, 331.5);
    addBoxPart(hrExpStone, 2.2, 0.48, 0.65, px, ctx.getHeight(px, 228.4) + 0.24, 228.4);
  }
  // 241–244: Moored sampan bow-lantern poles, carp-dragon plinth, acoustic musician dais & bridge lantern pendants
  for (const bx of [rx - 52, rx - 22, rx + 44]) {
    addCylPart(hrExpWood, 0.04, 0.05, 1.4, 5, bx, VIETNAM_WATER_LEVEL + 0.85, 238.5);
    addConePart(hrExpLantern, 0.14, 0.26, 5, bx, VIETNAM_WATER_LEVEL + 1.6, 238.5);
  }
  addBoxPart(hrExpStone, 1.2, 0.9, 1.2, rx + 5.2, archSy + 0.45, archSz + 1.5);
  addConePart(hrExpGold, 0.45, 1.1, 5, rx + 5.2, archSy + 1.45, archSz + 1.5);
  addBoxPart(hrExpWood, 3.6, 0.35, 2.4, rx + 34, VIETNAM_WATER_LEVEL + 1.82, 232.2);
  addCylPart(hrExpCrimson, 0.32, 0.32, 0.55, 6, rx + 34, VIETNAM_WATER_LEVEL + 2.25, 232.2);
  for (let k = 0; k < 8; k++) {
    const side = k < 4 ? -1 : 1;
    const kz = brStartZ + 12 + (k % 4) * 20;
    addConePart(hrExpLantern, 0.18, 0.34, 5, rx + side * 3.1, VIETNAM_WATER_LEVEL + 4.4, kz);
  }

  // --- Wave 3 Macro Visual QC & Expansion (459–486): Sông Hoài Bridges, Floating Music Stage & Night-Market Stalls ---
  const w3HrStone: THREE.BufferGeometry[] = [];
  const w3HrWood: THREE.BufferGeometry[] = [];
  const w3HrCrimson: THREE.BufferGeometry[] = [];
  const w3HrGold: THREE.BufferGeometry[] = [];
  const w3HrLantern: THREE.BufferGeometry[] = [];
  const w3HrLeaf: THREE.BufferGeometry[] = [];
  const hrLeafMat = ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone;
  // 459 & 460: Western arched timber footbridge & eastern stone-pier canal footbridge
  const wbX = rx - 78;
  const wbZ = 235.5;
  addBoxPart(w3HrWood, 12.0, 0.24, 2.8, wbX, VIETNAM_WATER_LEVEL + 1.65, wbZ);
  for (const sx of [-5.4, 0, 5.4]) {
    addW3GroundedCol(w3HrWood, 0.12, 0.14, VIETNAM_WATER_LEVEL + 1.6, VIETNAM_WATER_LEVEL - 1.2, 5, wbX + sx, wbZ - 1.2);
    addW3GroundedCol(w3HrWood, 0.12, 0.14, VIETNAM_WATER_LEVEL + 1.6, VIETNAM_WATER_LEVEL - 1.2, 5, wbX + sx, wbZ + 1.2);
    addW3GroundedPost(w3HrCrimson, 0.12, 0.12, VIETNAM_WATER_LEVEL + 2.55, VIETNAM_WATER_LEVEL + 1.65, wbX + sx, wbZ - 1.28);
    addW3GroundedPost(w3HrCrimson, 0.12, 0.12, VIETNAM_WATER_LEVEL + 2.55, VIETNAM_WATER_LEVEL + 1.65, wbX + sx, wbZ + 1.28);
  }
  addBoxPart(w3HrCrimson, 12.0, 0.12, 0.12, wbX, VIETNAM_WATER_LEVEL + 2.55, wbZ - 1.28);
  addBoxPart(w3HrCrimson, 12.0, 0.12, 0.12, wbX, VIETNAM_WATER_LEVEL + 2.55, wbZ + 1.28);
  const ebX = rx + 76;
  const ebZ = 324.0;
  addW3Plinth(w3HrStone, 2.2, 3.0, VIETNAM_WATER_LEVEL + 1.4, VIETNAM_WATER_LEVEL - 0.5, ebX - 4.5, ebZ);
  addW3Plinth(w3HrStone, 2.2, 3.0, VIETNAM_WATER_LEVEL + 1.4, VIETNAM_WATER_LEVEL - 0.5, ebX + 4.5, ebZ);
  addBoxPart(w3HrWood, 10.6, 0.24, 2.6, ebX, VIETNAM_WATER_LEVEL + 1.52, ebZ);
  // 461 & 462: Floating traditional music stage barge & curved lantern canopy
  const fmX = rx + 36;
  const fmZ = 282.0;
  addBoxPart(w3HrWood, 10.4, 0.45, 6.2, fmX, VIETNAM_WATER_LEVEL + 0.22, fmZ);
  addBoxPart(w3HrCrimson, 9.6, 2.8, 0.22, fmX, VIETNAM_WATER_LEVEL + 1.85, fmZ - 2.85);
  addBoxPart(w3HrGold, 5.4, 0.55, 0.26, fmX, VIETNAM_WATER_LEVEL + 2.75, fmZ - 2.75);
  for (const [ox, oz] of [[-4.6, -2.6], [4.6, -2.6], [-4.6, 2.6], [4.6, 2.6]]) {
    addW3GroundedCol(w3HrCrimson, 0.10, 0.12, VIETNAM_WATER_LEVEL + 3.45, VIETNAM_WATER_LEVEL + 0.4, 5, fmX + ox, fmZ + oz);
  }
  addW3HipRoof(w3HrCrimson, w3HrGold, 10.8, 6.6, VIETNAM_WATER_LEVEL + 3.45, 1.25, fmX, fmZ);
  for (const lxOff of [-3.2, 0, 3.2]) addConePart(w3HrLantern, 0.22, 0.38, 5, fmX + lxOff, VIETNAM_WATER_LEVEL + 3.1, fmZ + 2.6);
  // 463–467: Night-market Cao Lầu stall, grilled skewer brazier, Chè dessert cart, Bánh Xèo kiosk & silk-fan stand
  const stallConfigs: Array<[number, number, boolean]> = [
    [rx - 74, 336.5, true],
    [rx - 48, 336.5, false],
    [rx - 22, 336.5, true],
    [rx + 24, 336.5, false],
    [rx + 52, 336.5, true]
  ];
  for (let i = 0; i < stallConfigs.length; i++) {
    const [sx, sz, hasHip] = stallConfigs[i];
    const sy = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(sx, sz));
    addBoxPart(w3HrWood, 3.8, 0.85, 1.45, sx, sy + 0.42, sz);
    for (const [ox, oz] of [[-1.7, -0.65], [1.7, -0.65], [-1.7, 0.65], [1.7, 0.65]]) {
      addW3GroundedCol(w3HrWood, 0.07, 0.08, sy + 2.55, sy, 5, sx + ox, sz + oz);
    }
    if (hasHip) {
      addW3HipRoof(w3HrCrimson, null, 4.4, 2.2, sy + 2.55, 0.72, sx, sz);
    } else {
      addBoxPart(w3HrLeaf, 4.4, 0.14, 2.2, sx, sy + 2.6, sz, 0, 0.12, 0);
    }
    addCylPart(i === 1 ? w3HrLantern : w3HrGold, 0.28, 0.24, 0.42, 6, sx - 0.8, sy + 1.05, sz);
    addConePart(w3HrLantern, 0.18, 0.34, 5, sx + 1.1, sy + 2.25, sz + 0.55);
  }
  // 468–470: Wooden boat-pier ticket booth, extended timber jetty & southern boat-repair slipway
  const tkX = rx - 28;
  const tkZ = 229.5;
  const tkY = Math.max(VIETNAM_WATER_LEVEL + 1.2, ctx.getHeight(tkX, tkZ));
  addBoxPart(w3HrWood, 2.8, 2.25, 2.2, tkX, tkY + 1.12, tkZ);
  addW3HipRoof(w3HrCrimson, w3HrGold, 3.4, 2.8, tkY + 2.25, 0.85, tkX, tkZ);
  addBoxPart(w3HrWood, 3.2, 0.22, 11.5, rx - 28, VIETNAM_WATER_LEVEL + 0.65, 240.5);
  for (let p = 0; p < 4; p++) {
    addW3GroundedCol(w3HrWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 1.15, VIETNAM_WATER_LEVEL - 0.7, 5, rx - 29.4, 236.0 + p * 3.2);
    addW3GroundedCol(w3HrWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 1.15, VIETNAM_WATER_LEVEL - 0.7, 5, rx - 26.6, 236.0 + p * 3.2);
  }
  addBoxPart(w3HrWood, 4.8, 0.52, 1.35, rx - 66, VIETNAM_WATER_LEVEL + 0.45, 325.0, 0.25, Math.PI, 0); // Upturned sampan hull
  // 471: 4-bay riverside lantern pergola tunnel along Bạch Đằng walkway
  for (let b = 0; b < 5; b++) {
    const px = rx + 6 + b * 4.4;
    const py = Math.max(VIETNAM_WATER_LEVEL + 1.2, ctx.getHeight(px, 226.5));
    addW3GroundedCol(w3HrWood, 0.09, 0.11, py + 3.1, py, 5, px, 224.8);
    addW3GroundedCol(w3HrWood, 0.09, 0.11, py + 3.1, py, 5, px, 228.2);
    addBoxPart(w3HrWood, 0.16, 0.16, 3.8, px, py + 3.05, 226.5);
    if (b < 4) addConePart(w3HrLantern, 0.22, 0.38, 5, px + 2.2, py + 2.72, 226.5);
  }
  addBoxPart(w3HrWood, 18.0, 0.14, 0.16, rx + 14.8, VIETNAM_WATER_LEVEL + 4.35, 224.8);
  addBoxPart(w3HrWood, 18.0, 0.14, 0.16, rx + 14.8, VIETNAM_WATER_LEVEL + 4.35, 228.2);
  // 472–486: River-gauge pillar, acoustic instrument stand, 6 mooring bollards, hoa đăng supply barge, 4 dining clusters, drain scuppers, bridge balconies, pottery stall, waste/hook posts, willow curbs, oar bundle, festival map board, 6 reed lanterns, stair cheeks & crimson entry banners
  addW3GroundedPost(w3HrStone, 0.45, 0.45, VIETNAM_WATER_LEVEL + 3.4, VIETNAM_WATER_LEVEL - 0.5, rx - 8, 231.5);
  addBoxPart(w3HrGold, 0.48, 0.14, 0.48, rx - 8, VIETNAM_WATER_LEVEL + 2.4, 231.5);
  addBoxPart(w3HrWood, 1.6, 0.72, 0.55, stgX + 2.4, stgY + 1.0, stgZ);
  for (let i = 0; i < 6; i++) {
    const bx = rx - 60 + i * 24;
    addW3GroundedCol(w3HrStone, 0.18, 0.22, VIETNAM_WATER_LEVEL + 2.05, VIETNAM_WATER_LEVEL + 1.0, 5, bx, 230.8);
    addCylPart(w3HrLantern, 0.10, 0.12, 1.35, 5, bx + 4.0, VIETNAM_WATER_LEVEL + 0.65, 233.2);
  }
  addBoxPart(w3HrWood, 5.2, 0.38, 1.65, rx + 12, VIETNAM_WATER_LEVEL + 0.18, 239.0);
  addBoxPart(w3HrLantern, 2.8, 0.45, 1.15, rx + 12, VIETNAM_WATER_LEVEL + 0.58, 239.0);
  for (let t = 0; t < 4; t++) {
    const tx = rx - 52 + t * 28;
    const ty = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(tx, 342.0));
    addBoxPart(w3HrWood, 1.25, 0.62, 0.95, tx, ty + 0.31, 342.0);
    addBoxPart(w3HrWood, 0.35, 0.34, 0.35, tx - 0.85, ty + 0.17, 342.0);
    addBoxPart(w3HrWood, 0.35, 0.34, 0.35, tx + 0.85, ty + 0.17, 342.0);
  }
  for (const dx of [rx - 40, rx + 18, rx + 50]) {
    addBoxPart(w3HrStone, 0.55, 0.48, 0.75, dx, VIETNAM_WATER_LEVEL + 0.95, 231.4);
  }
  for (const side of [-1, 1]) {
    addBoxPart(w3HrWood, 2.2, 0.22, 4.6, rx + side * 4.2, VIETNAM_WATER_LEVEL + 3.45, brStartZ + 46);
    addBoxPart(w3HrCrimson, 0.12, 0.92, 4.6, rx + side * 5.2, VIETNAM_WATER_LEVEL + 3.95, brStartZ + 46);
  }
  const potY = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(rx + 68, 336.5));
  addBoxPart(w3HrWood, 2.4, 0.78, 1.05, rx + 68, potY + 0.39, 336.5);
  addCylPart(w3HrLeaf, 0.28, 0.24, 0.65, 6, rx - 32, ctx.getHeight(rx - 32, 227.5) + 0.32, 227.5);
  for (const wx of [rx - 38, rx + 38]) {
    addCylPart(w3HrStone, 1.45, 1.55, 0.42, 6, wx, Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(wx, 332.0)) + 0.21, 332.0);
  }
  addBoxPart(w3HrWood, 3.6, 0.22, 0.45, rx + 58, VIETNAM_WATER_LEVEL + 0.42, 236.5);
  const mpY = Math.max(VIETNAM_WATER_LEVEL + 1.2, ctx.getHeight(rx - 2, 225.5));
  addW3GroundedPost(w3HrWood, 0.12, 0.12, mpY + 2.4, mpY, rx - 3.2, 225.5);
  addW3GroundedPost(w3HrWood, 0.12, 0.12, mpY + 2.4, mpY, rx - 0.8, 225.5);
  addBoxPart(w3HrGold, 2.2, 1.15, 0.14, rx - 2.0, mpY + 1.72, 225.5);
  addBoxPart(w3HrStone, 0.38, 0.85, 2.8, rx + 23.4, VIETNAM_WATER_LEVEL + 0.72, 327.8);
  addBoxPart(w3HrStone, 0.38, 0.85, 2.8, rx + 28.6, VIETNAM_WATER_LEVEL + 0.72, 327.8);
  for (const szOff of [-2.4, 2.4]) {
    const by = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(rx + 82, 336.0 + szOff));
    addW3GroundedCol(w3HrCrimson, 0.08, 0.10, by + 4.6, by, 5, rx + 82, 336.0 + szOff);
    addBoxPart(w3HrGold, 0.08, 1.65, 0.55, rx + 82, by + 3.6, 336.0 + szOff);
  }

  addWave3Mesh(rGroup, w3HrStone, ctx.materials.stone);
  addWave3Mesh(rGroup, w3HrWood, ctx.materials.darkWood);
  addWave3Mesh(rGroup, w3HrCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(rGroup, w3HrGold, ctx.materials.gold);
  addWave3Mesh(rGroup, w3HrLantern, silkMat);
  addWave3Mesh(rGroup, w3HrLeaf, hrLeafMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (859–886): Cồn An Hội Gazebos, Boatyard Cradle, Dip-Net & Waterfront Crafts ---
  const w4HrStone: THREE.BufferGeometry[] = [];
  const w4HrWood: THREE.BufferGeometry[] = [];
  const w4HrCrimson: THREE.BufferGeometry[] = [];
  const w4HrGold: THREE.BufferGeometry[] = [];
  const w4HrLantern: THREE.BufferGeometry[] = [];
  const w4HrLeaf: THREE.BufferGeometry[] = [];
  // 859 & 860: Western & Eastern Cồn An Hội waterfront park gazebos (outside night-market lane!)
  for (const gx of [rx - 108, rx + 108]) {
    const gz = 330.5;
    const gy = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(gx, gz));
    addW3Plinth(w4HrStone, 4.8, 4.8, gy + 0.35, gy, gx, gz);
    for (const [ox, oz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) addW3GroundedCol(w4HrCrimson, 0.10, 0.12, gy + 2.85, gy + 0.35, 5, gx + ox, gz + oz);
    addW3HipRoof(w4HrCrimson, w4HrGold, 5.4, 5.4, gy + 2.85, 1.15, gx, gz);
  }
  // 861 & 862: Sampan boatbuilding cradle (far west shore) & bamboo fish-trap weir (east shallows)
  const byX = rx - 122;
  const byZ = 324.0;
  const byY = Math.max(VIETNAM_WATER_LEVEL + 0.5, ctx.getHeight(byX, byZ));
  for (const ox of [-1.8, 0, 1.8]) addBoxPart(w4HrWood, 0.35, 0.55, 1.6, byX + ox, byY + 0.28, byZ);
  addBoxPart(w4HrWood, 5.6, 0.45, 1.35, byX, byY + 0.72, byZ);
  for (let w = 0; w < 6; w++) {
    const wa = (w / 5) * 1.4 - 0.7;
    addW3GroundedCol(w4HrWood, 0.05, 0.06, VIETNAM_WATER_LEVEL + 1.15, VIETNAM_WATER_LEVEL - 0.8, 4, rx + 118 + Math.cos(wa) * 4.5, 298 + Math.sin(wa) * 5.2);
  }
  // 863–870: Wish kiosk, Bài Chòi prize-flag, floating candle tray, 6 mooring posts, Chè pushcart, footbridge lantern arches, spice stall & busker platform
  const wkX = rx + 96;
  const wkZ = 336.5;
  const wkY = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(wkX, wkZ));
  addBoxPart(w4HrWood, 3.2, 0.82, 1.35, wkX, wkY + 0.41, wkZ);
  for (const [ox, oz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) addW3GroundedCol(w4HrWood, 0.07, 0.08, wkY + 2.45, wkY, 5, wkX + ox, wkZ + oz);
  addW3HipRoof(w4HrCrimson, w4HrGold, 3.8, 2.0, wkY + 2.45, 0.68, wkX, wkZ);
  addW3GroundedCol(w4HrCrimson, 0.07, 0.09, stgY + 5.2, stgY, 5, stgX + 6.4, stgZ);
  addBoxPart(w4HrGold, 1.35, 0.85, 0.06, stgX + 7.1, stgY + 4.6, stgZ);
  addCylPart(w4HrWood, 1.15, 1.15, 0.14, 6, rx + 72, VIETNAM_WATER_LEVEL + 0.08, 266);
  for (let c = 0; c < 6; c++) {
    const ca = (c / 6) * Math.PI * 2;
    addConePart(w4HrLantern, 0.12, 0.24, 4, rx + 72 + Math.cos(ca) * 0.72, VIETNAM_WATER_LEVEL + 0.24, 266 + Math.sin(ca) * 0.72);
  }
  for (let m = 0; m < 6; m++) addW3GroundedCol(w4HrStone, 0.16, 0.20, VIETNAM_WATER_LEVEL + 1.35, VIETNAM_WATER_LEVEL - 0.4, 5, rx + (m < 3 ? -120 + m * 8 : 114 + (m - 3) * 8), 230.2);
  addBoxPart(w4HrWood, 1.85, 0.85, 0.92, rx - 94, wkY + 0.42, 336.5);
  addConePart(w4HrLantern, 0.18, 0.34, 5, rx - 94, wkY + 1.85, 336.5);
  for (const s of [-1, 1]) addW3GroundedCol(w4HrCrimson, 0.09, 0.11, VIETNAM_WATER_LEVEL + 3.8, VIETNAM_WATER_LEVEL + 1.0, 5, rx + 96 + s * 2.2, 232.0);
  addBoxPart(w4HrCrimson, 4.8, 0.24, 0.24, rx + 96, VIETNAM_WATER_LEVEL + 3.75, 232.0);
  addBoxPart(w4HrWood, 3.4, 0.82, 1.25, rx + 112, wkY + 0.41, 336.5);
  addBoxPart(w4HrWood, 4.2, 0.42, 2.8, rx + 82, Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(rx + 82, 226.5)) + 0.21, 226.5);
  // 871–886: Riprap steps, oar pontoon, bronze compass rose, corn brazier, birdcage corner, 8 bollards, dip-net derrick, photo-frame arch, foot-wash basin, 4 planters, pole rack, channel buoy, tea stand, 4 benches, drainage arch & welcome drum
  for (let st = 0; st < 3; st++) addBoxPart(w4HrStone, 3.8, 0.28, 0.65, rx - 102, VIETNAM_WATER_LEVEL + 0.25 + st * 0.28, 323.5 + st * 0.65);
  addBoxPart(w4HrWood, 3.8, 0.18, 1.85, rx - 82, VIETNAM_WATER_LEVEL + 0.12, 240.0);
  addCylPart(w4HrGold, 1.25, 1.25, 0.08, 6, rx - 118, Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(rx - 118, 226.5)) + 0.05, 226.5);
  addBoxPart(w4HrStone, 1.4, 0.68, 0.85, rx - 86, wkY + 0.34, 336.5);
  addW3GroundedCol(w4HrWood, 0.07, 0.09, wkY + 2.6, wkY, 5, rx - 116, 332.5);
  for (let b = 0; b < 8; b++) addW3GroundedPost(w4HrStone, 0.26, 0.26, VIETNAM_WATER_LEVEL + 1.95, VIETNAM_WATER_LEVEL + 1.0, rx + (b < 4 ? -136 + b * 4.2 : 122 + (b - 4) * 4.2), 229.8);
  addCylPart(w4HrWood, 0.06, 0.08, 5.2, 5, rx + 124, VIETNAM_WATER_LEVEL + 2.2, 244.0, 0.45, 0.35);
  for (const s of [-1, 1]) addW3GroundedCol(w4HrCrimson, 0.08, 0.10, wkY + 2.95, wkY, 5, rx + 88 + s * 1.4, 332.0);
  addBoxPart(w4HrGold, 3.2, 0.18, 0.18, rx + 88, wkY + 2.92, 332.0);
  addCylPart(w4HrStone, 0.55, 0.48, 0.45, 6, rx + 30, wkY + 0.22, 330.0);
  for (let p = 0; p < 4; p++) {
    const px = rx + (p < 2 ? -128 + p * 8 : 118 + (p - 2) * 8);
    addBoxPart(w4HrStone, 1.15, 0.55, 1.15, px, VIETNAM_WATER_LEVEL + 1.45, 226.5);
    addConePart(w4HrLeaf, 0.65, 0.88, 5, px, VIETNAM_WATER_LEVEL + 2.15, 226.5);
  }
  addBoxPart(w4HrWood, 1.8, 1.35, 0.45, rx - 34, VIETNAM_WATER_LEVEL + 1.85, 231.2);
  addCylPart(w4HrWood, 0.48, 0.58, 0.55, 6, rx + 84, VIETNAM_WATER_LEVEL + 0.22, 282.0);
  addConePart(w4HrLantern, 0.22, 0.42, 5, rx + 84, VIETNAM_WATER_LEVEL + 0.72, 282.0);
  addBoxPart(w4HrWood, 1.65, 0.78, 0.85, rx - 102, wkY + 0.39, 336.5);
  for (let b = 0; b < 4; b++) addBoxPart(w4HrWood, 1.95, 0.48, 0.55, rx - 124 + b * 78, VIETNAM_WATER_LEVEL + 1.45, 227.5);
  addBoxPart(w4HrStone, 2.2, 1.45, 0.65, rx - 134, VIETNAM_WATER_LEVEL + 0.65, 230.8);
  addBoxPart(w4HrCrimson, 1.25, 0.85, 0.85, rx + 102, wkY + 0.42, 332.5);
  addCylPart(w4HrGold, 0.38, 0.38, 0.58, 6, rx + 102, wkY + 1.05, 332.5, 0, Math.PI * 0.5);

  addWave3Mesh(rGroup, w4HrStone, ctx.materials.stone);
  addWave3Mesh(rGroup, w4HrWood, ctx.materials.darkWood);
  addWave3Mesh(rGroup, w4HrCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(rGroup, w4HrGold, ctx.materials.gold);
  addWave3Mesh(rGroup, w4HrLantern, silkMat);
  addWave3Mesh(rGroup, w4HrLeaf, hrLeafMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1259–1286): Outer Wharf Pavilion, Folk Canopy, Sampan Pair & Lantern Promenade ---
  const w5HrStone: THREE.BufferGeometry[] = [];
  const w5HrWood: THREE.BufferGeometry[] = [];
  const w5HrCrimson: THREE.BufferGeometry[] = [];
  const w5HrGold: THREE.BufferGeometry[] = [];
  const w5HrLantern: THREE.BufferGeometry[] = [];
  const w5HrLeaf: THREE.BufferGeometry[] = [];
  // 1259 & 1260: Outer Western Bạch Đằng Wharf Pavilion (rx - 144, 224.0) & Eastern Cồn An Hội Folk-Music Stage Canopy (rx + 124, 332.0)
  const wpX = rx - 144;
  const wpZ = 224.0;
  const wpY = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(wpX, wpZ));
  addW3Plinth(w5HrStone, 5.0, 4.4, wpY + 0.35, wpY, wpX, wpZ);
  for (const [ox, oz] of [[-1.9, -1.6], [1.9, -1.6], [-1.9, 1.6], [1.9, 1.6]]) addW3GroundedCol(w5HrCrimson, 0.10, 0.12, wpY + 2.95, wpY + 0.35, 5, wpX + ox, wpZ + oz);
  addW3HipRoof(w5HrCrimson, w5HrGold, 5.8, 5.2, wpY + 2.95, 1.15, wpX, wpZ);
  const fcX = rx + 124;
  const fcZ = 332.0;
  const fcY = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(fcX, fcZ));
  addW3Plinth(w5HrStone, 5.2, 4.2, fcY + 0.35, fcY, fcX, fcZ);
  for (const [ox, oz] of [[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]]) addW3GroundedCol(w5HrWood, 0.10, 0.12, fcY + 2.85, fcY + 0.35, 5, fcX + ox, fcZ + oz);
  addW3HipRoof(w5HrCrimson, w5HrGold, 6.0, 4.8, fcY + 2.85, 1.10, fcX, fcZ);
  // 1261–1268: Moored sampan twin pair, Bánh Mì skewer cart, 6 lamp standards, balustrade extension, pitch brazier, bamboo lotus catch-boom, silk-scarf stall & tide-gauge pillar
  for (let sp = 0; sp < 2; sp++) {
    const spx = rx + 106 + sp * 7.5;
    addBoxPart(w5HrWood, 4.4, 0.36, 1.25, spx, VIETNAM_WATER_LEVEL + 0.16, 248.0, 0.18);
    addConePart(w5HrLantern, 0.16, 0.30, 5, spx + 1.8, VIETNAM_WATER_LEVEL + 0.65, 248.0);
  }
  addBoxPart(w5HrWood, 2.2, 0.88, 1.05, rx - 114, wkY + 0.44, 338.0);
  addBoxPart(w5HrCrimson, 2.4, 0.18, 1.25, rx - 114, wkY + 2.05, 338.0);
  for (let l = 0; l < 6; l++) {
    const lx = rx + (l < 3 ? -142 + l * 10 : 114 + (l - 3) * 10);
    const lz = l < 3 ? 228.5 : 326.5;
    const ly = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(lx, lz));
    addW3GroundedCol(w5HrWood, 0.06, 0.08, ly + 3.25, ly, 5, lx, lz);
    addConePart(w5HrLantern, 0.18, 0.34, 5, lx, ly + 3.35, lz);
  }
  addBoxPart(w5HrStone, 14.0, 0.78, 0.42, rx + 128, VIETNAM_WATER_LEVEL + 1.52, 323.2);
  addBoxPart(w5HrStone, 1.25, 0.65, 0.95, byX - 4.8, byY + 0.32, byZ);
  for (let fb = 0; fb < 4; fb++) addCylPart(w5HrWood, 0.10, 0.10, 3.2, 4, rx + 96 + fb * 3.6, VIETNAM_WATER_LEVEL + 0.08, 286.0, 0, Math.PI * 0.5);
  addBoxPart(w5HrWood, 2.8, 1.45, 0.85, rx + 118, wkY + 0.72, 338.5);
  addBoxPart(w5HrCrimson, 2.2, 0.65, 0.14, rx + 118, wkY + 1.15, 338.1);
  addW3GroundedPost(w5HrStone, 0.32, 0.32, VIETNAM_WATER_LEVEL + 2.45, VIETNAM_WATER_LEVEL - 0.5, rx - 108, 322.5);
  // 1269–1277: Wind-chime arch, life-ring rack, sugarcane stand, 4 north benches, floating duck-house, Bài Chòi card-rack, Miếu Hà Bá altar, ceramic cart & 6 mooring cleats
  for (const s of [-1, 1]) addW3GroundedCol(w5HrCrimson, 0.08, 0.10, wpY + 3.1, wpY, 5, wpX + 7.5 + s * 1.6, wpZ);
  addBoxPart(w5HrGold, 3.6, 0.18, 0.18, wpX + 7.5, wpY + 3.05, wpZ);
  addW3GroundedPost(w5HrWood, 0.12, 0.12, VIETNAM_WATER_LEVEL + 2.35, VIETNAM_WATER_LEVEL + 1.0, rx + 106, 231.0);
  addBoxPart(w5HrWood, 2.0, 0.85, 0.95, rx - 122, wkY + 0.42, 338.0);
  for (let b = 0; b < 4; b++) addBoxPart(w5HrWood, 1.9, 0.48, 0.55, rx + (b < 2 ? -148 + b * 6 : 126 + (b - 2) * 6), VIETNAM_WATER_LEVEL + 1.45, 227.0);
  addBoxPart(w5HrWood, 2.2, 0.75, 1.65, rx - 126, VIETNAM_WATER_LEVEL + 0.38, 252.0);
  addBoxPart(w5HrWood, 1.65, 1.25, 0.45, stgX - 5.2, stgY + 0.62, stgZ);
  const hbY = Math.max(VIETNAM_WATER_LEVEL + 1.1, ctx.getHeight(rx + 134, 226.5));
  addW3Plinth(w5HrStone, 1.45, 1.45, hbY + 1.35, hbY, rx + 134, 226.5);
  addW3HipRoof(w5HrCrimson, w5HrGold, 1.85, 1.85, hbY + 1.35, 0.55, rx + 134, 226.5);
  addBoxPart(w5HrWood, 1.85, 0.82, 0.88, rx + 130, wkY + 0.41, 338.5);
  for (let mc = 0; mc < 6; mc++) addBoxPart(w5HrStone, 0.38, 0.28, 0.38, rx + (mc < 3 ? -120 + mc * 6 : 108 + (mc - 3) * 6), VIETNAM_WATER_LEVEL + 1.25, 323.5);
  // 1278–1286: Hoa đăng step-dock, eastern lantern catenary, fish-vendor stall, 2 lantern planters, origami table, eastern culvert wall, 3 trash casks, photo-boat display & welcome stele
  addBoxPart(w5HrWood, 3.8, 0.18, 2.2, rx - 94, VIETNAM_WATER_LEVEL + 0.32, 320.5);
  for (const s of [-1, 1]) addW3GroundedCol(w5HrCrimson, 0.08, 0.10, fcY + 4.2, fcY, 5, fcX - 4.5, fcZ + s * 4.2);
  for (let l = -2; l <= 2; l++) addConePart(w5HrLantern, 0.18, 0.32, 5, fcX - 4.5, fcY + 3.85, fcZ + l * 1.6);
  addBoxPart(w5HrWood, 2.4, 0.78, 0.95, rx - 138, VIETNAM_WATER_LEVEL + 1.55, 228.5);
  for (const s of [-1, 1]) {
    addBoxPart(w5HrStone, 1.15, 0.62, 1.15, fcX + s * 4.5, fcY + 0.31, fcZ - 3.6);
    addConePart(w5HrLeaf, 0.58, 0.78, 5, fcX + s * 4.5, fcY + 0.98, fcZ - 3.6);
  }
  addBoxPart(w5HrWood, 2.0, 0.82, 0.92, rx + 136, wkY + 0.41, 334.0);
  addBoxPart(w5HrStone, 4.2, 1.35, 0.65, rx + 138, VIETNAM_WATER_LEVEL + 0.65, 231.0);
  for (let tc = 0; tc < 3; tc++) addCylPart(w5HrWood, 0.28, 0.24, 0.68, 6, rx - 98 + tc * 98, wkY + 0.34, 334.5);
  addBoxPart(w5HrWood, 4.8, 0.55, 1.45, rx + 134, fcY + 0.28, 328.5, 0.32);
  addConePart(w5HrLantern, 0.20, 0.36, 5, rx + 134, fcY + 0.92, 328.5);
  addBoxPart(w5HrStone, 1.45, 2.25, 0.38, rx + 142, fcY + 1.12, 332.0);
  addBoxPart(w5HrGold, 1.05, 1.45, 0.42, rx + 142, fcY + 1.25, 332.0);

  addWave3Mesh(rGroup, w5HrStone, ctx.materials.stone);
  addWave3Mesh(rGroup, w5HrWood, ctx.materials.darkWood);
  addWave3Mesh(rGroup, w5HrCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(rGroup, w5HrGold, ctx.materials.gold);
  addWave3Mesh(rGroup, w5HrLantern, silkMat);
  addWave3Mesh(rGroup, w5HrLeaf, hrLeafMat);

  rGroup.add(
    new THREE.Mesh(mergeNormalized(hrExpStone), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(hrExpWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(hrExpCrimson), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(hrExpGold), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(hrExpLantern), silkMat),
    new THREE.Mesh(mergeNormalized(hrExpLeaf), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone),
    flowerInst,
    skyInst
  );
  ctx.scene.add(rGroup);
  return { group: rGroup, silkMat, skyMat, flowerMat };
}

function buildHueGrandImperialPalaceMacro(ctx: VietnamBuilderContext): {
  group: THREE.Group;
  palMat: THREE.MeshStandardMaterial;
} {
  const res = buildHoangCungHueMasterCompound(ctx);
  // --- 200-Item Macro Visual QC & Expansion (045–059): Đại Nội Huế & Kinh Thành ---
  const hx = -660;
  const hz = 80;
  const hy = ctx.getHeight(hx, hz);
  const hueStone: THREE.BufferGeometry[] = [];
  const hueWood: THREE.BufferGeometry[] = [];
  const hueRoof: THREE.BufferGeometry[] = [];
  const hueGold: THREE.BufferGeometry[] = [];
  const hueCrimson: THREE.BufferGeometry[] = [];
  const hueBronze: THREE.BufferGeometry[] = [];
  const hueLeaf: THREE.BufferGeometry[] = [];

  // 045 & 046: 2 Flanking Cửu Vị Thần Công (Nine Holy Cannons) pavilions & 9 bronze cannon barrels
  for (const side of [-1, 1]) {
    const px = hx + side * 38;
    const pz = hz + 44;
    const py = ctx.getHeight(px, pz);
    addBoxPart(hueStone, 14.0, 0.55, 5.6, px, py + 0.28, pz);
    for (let c = 0; c < 4; c++) {
      addCylPart(hueCrimson, 0.16, 0.18, 3.4, 6, px - 5.4 + c * 3.6, py + 2.2, pz + 2.2);
      addCylPart(hueCrimson, 0.16, 0.18, 3.4, 6, px - 5.4 + c * 3.6, py + 2.2, pz - 2.2);
    }
    const cRoof = createVietnameseCurvedRoofGeometry(15.4, 6.8, 10.2, 1.8, 1.9, 0.45);
    cRoof.translate(px, py + 3.9, pz);
    hueRoof.push(cRoof);
    const cannons = side < 0 ? 4 : 5;
    for (let k = 0; k < cannons; k++) {
      const cxOff = px - (cannons - 1) * 1.2 + k * 2.4;
      addBoxPart(hueWood, 0.72, 0.62, 1.65, cxOff, py + 0.86, pz);
      addCylPart(hueBronze, 0.14, 0.20, 2.8, 7, cxOff, py + 1.32, pz + 0.45, 1.42, 0);
    }
  }
  // 047 & 048: Cửu Đỉnh (Nine Dynastic Bronze Urns) & Phẩm Sơn mandarin rank markers
  for (let u = 0; u < 9; u++) {
    const ux = hx - 16 + u * 4.0;
    const uz = hz - 18;
    addBoxPart(hueStone, 1.25, 0.55, 1.25, ux, hy + 0.28, uz);
    const urn = createImperialUrnParts(ux, hy + 0.55, uz, 0.72);
    hueBronze.push(...urn.bronzeParts);
    hueStone.push(...urn.stoneParts);
  }
  addHuePhamSonMandarinStones(hueStone, hueGold, hx - 18, hy, hz + 8);
  // 049, 052, 055, 056: Monumental bronze incense tripods, Ngọ Môn drum/bell stands, dragon stairways & stone lanterns
  for (const side of [-1, 1]) {
    const tri = createBronzeIncenseTripodParts(hx + side * 9.5, hy, hz + 26, 0.95);
    hueStone.push(...tri.limestoneParts);
    hueBronze.push(...tri.bronzeParts);
    hueGold.push(...tri.goldParts);
    addBoxPart(hueWood, 1.6, 1.2, 1.6, hx + side * 14.0, hy + 5.8, hz + 18);
    addCylPart(hueBronze, 0.55, 0.55, 0.85, 8, hx + side * 14.0, hy + 6.9, hz + 18);
    addBoxPart(hueStone, 2.6, 0.65, 5.2, hx + side * 2.2, hy + 0.35, hz + 34);
  }
  for (let l = 0; l < 8; l++) {
    const side = l < 4 ? -1 : 1;
    const rank = l % 4;
    hueStone.push(...createAncientStoneLanternParts(hx + side * 7.5, hy, hz + 28 + rank * 7.5, 0.95));
  }
  // 050, 051, 054: 4 Corner Vọng Lâu bastion watchtowers, moat retaining curbs & Tả/Hữu Vu porticos
  for (const [wx, wz] of [[-58, -46], [58, -46], [-58, 48], [58, 48]] as Array<[number, number]>) {
    const wpx = hx + wx;
    const wpz = hz + wz;
    const wpy = ctx.getHeight(wpx, wpz);
    addBoxPart(hueStone, 6.4, 3.2, 6.4, wpx, wpy + 1.6, wpz);
    const wr = createVietnameseCurvedRoofGeometry(7.8, 7.8, 4.2, 1.4, 1.8, 0.55);
    wr.translate(wpx, wpy + 3.2, wpz);
    hueRoof.push(wr);
  }
  addBoxPart(hueStone, 116.0, 1.2, 1.8, hx, VIETNAM_WATER_LEVEL + 0.4, hz + 56);
  for (const side of [-1, 1]) {
    addBoxPart(hueCrimson, 4.4, 3.2, 18.0, hx + side * 24, hy + 1.6, hz + 6);
    const tvR = createVietnameseCurvedRoofGeometry(6.2, 20.0, 2.6, 14.0, 1.6, 0.4);
    tvR.translate(hx + side * 24, hy + 3.2, hz + 6);
    hueRoof.push(tvR);
  }
  // 053, 057, 058, 059: Imperial garden pines (outer garden avenue >= 5.5m clear of all pavilions & pergolas!), Núi Ngự Bình feng-shui screen hillock, 5-color banners & Bình Phong spirit screen
  for (let t = 0; t < 12; t++) {
    const side = t < 6 ? -1 : 1;
    const tx = hx + side * 49.5;
    const tz = hz - 34 + (t % 6) * 11.4;
    const ty = ctx.getHeight(tx, tz);
    addBoxPart(hueStone, 1.8, 0.55, 1.8, tx, ty + 0.28, tz);
    addCylPart(hueWood, 0.14, 0.20, 2.8, 6, tx, ty + 1.65, tz);
    hueLeaf.push(new THREE.ConeGeometry(1.45, 2.6, 7).translate(tx, ty + 3.6, tz));
  }
  const nguBinh = createSculptedRockGeometry(4100, 22.0, 6.5, 10.0, 2);
  nguBinh.translate(hx, ctx.getHeight(hx, hz + 82) + 2.8, hz + 82);
  hueLeaf.push(nguBinh);
  for (const fx of [-8.0, 8.0]) {
    addCylPart(hueGold, 0.08, 0.11, 7.5, 6, hx + fx, hy + 3.75, hz + 52);
    addBoxPart(hueCrimson, 0.08, 2.6, 1.1, hx + fx + 0.55, hy + 6.2, hz + 52);
  }
  addBoxPart(hueStone, 6.2, 3.4, 0.65, hx, hy + 1.7, hz + 58);

  // --- Wave 2 Macro Visual QC & Expansion (245–259): Đại Nội Huế Tứ Phương Vô Sự, Palanquin & Gardens ---
  // 245 & 246: Lầu Tứ Phương Vô Sự two-story pavilion on northern Khuyết Đài bastion + twin stone stairs
  const tpX = hx;
  const tpZ = hz - 44;
  const tpY = ctx.getHeight(tpX, tpZ);
  addBoxPart(hueStone, 14.0, 2.8, 9.6, tpX, tpY + 1.4, tpZ);
  addBoxPart(hueCrimson, 9.2, 2.8, 6.4, tpX, tpY + 4.2, tpZ);
  addBoxPart(hueGold, 9.8, 0.22, 7.0, tpX, tpY + 5.65, tpZ);
  addBoxPart(hueCrimson, 7.2, 2.4, 4.8, tpX, tpY + 6.95, tpZ);
  addConePart(hueRoof, 6.4, 2.2, 4, tpX, tpY + 9.25, tpZ, Math.PI * 0.25);
  for (const side of [-1, 1]) {
    addBoxPart(hueStone, 2.4, 1.4, 4.2, tpX + side * 4.5, tpY + 0.7, tpZ + 6.4);
  }
  // 247 & 248: Kiệu Hoàng Đế (Imperial Palanquin seated on trestle stands) & 4 Lọng Vàng ceremonial parasols
  const palX = hx + 11.5;
  const palZ = hz + 14.0;
  addBoxPart(hueWood, 2.1, 0.72, 0.24, palX, hy + 0.36, palZ - 1.4);
  addBoxPart(hueWood, 2.1, 0.72, 0.24, palX, hy + 0.36, palZ + 1.4);
  addBoxPart(hueCrimson, 1.6, 1.5, 1.4, palX, hy + 1.2, palZ);
  addBoxPart(hueGold, 0.12, 0.12, 5.2, palX - 0.95, hy + 0.75, palZ);
  addBoxPart(hueGold, 0.12, 0.12, 5.2, palX + 0.95, hy + 0.75, palZ);
  addConePart(hueGold, 1.35, 0.85, 4, palX, hy + 2.35, palZ, Math.PI * 0.25);
  for (const [px, pz] of [[hx - 5.2, hz + 14], [hx + 5.2, hz + 14], [hx - 5.2, hz + 22], [hx + 5.2, hz + 22]] as Array<[number, number]>) {
    addCylPart(hueGold, 0.05, 0.06, 3.8, 5, px, hy + 1.9, pz);
    addConePart(hueCrimson, 0.95, 0.55, 6, px, hy + 3.85, pz);
  }
  // 249, 250, 251: Vườn Cơ Hạ rockery & arched garden footbridge (east) + Ngự Uyển hexagonal tea gazebo (west)
  addBoxPart(hueStone, 5.6, 0.45, 4.4, hx + 40, hy + 0.22, hz - 6);
  addConePart(hueStone, 1.8, 2.6, 5, hx + 40, hy + 1.7, hz - 6);
  addBoxPart(hueStone, 6.2, 0.32, 2.0, hx + 40, hy + 0.75, hz + 2.5);
  const gzX = hx - 40;
  const gzZ = hz - 6;
  addCylPart(hueStone, 2.8, 3.1, 0.45, 6, gzX, hy + 0.22, gzZ);
  for (let c = 0; c < 6; c++) {
    const ca = (c / 6) * Math.PI * 2;
    addCylPart(hueCrimson, 0.10, 0.12, 2.8, 5, gzX + Math.cos(ca) * 2.2, hy + 1.8, gzZ + Math.sin(ca) * 2.2);
  }
  addConePart(hueRoof, 3.5, 1.6, 6, gzX, hy + 3.95, gzZ);
  // 252 & 258: Hành Lang Trường Lang covered connecting corridors & Tả/Hữu Vu stone landings
  for (const side of [-1, 1]) {
    addBoxPart(hueCrimson, 3.2, 2.8, 16.0, hx + side * 24, hy + 1.4, hz - 14);
    addBoxPart(hueRoof, 4.2, 0.55, 16.8, hx + side * 24, hy + 3.05, hz - 14);
    addBoxPart(hueStone, 3.8, 0.45, 3.2, hx + side * 20.5, hy + 0.22, hz + 6);
  }
  // 253–257 & 259: 2 Bronze royal cauldrons, 4 Ngọ Môn banner poles, 6 octagonal planters, 2 side gates, spirit screen & 4 bronze lanterns
  for (const side of [-1, 1]) {
    addBoxPart(hueStone, 1.8, 0.5, 1.8, hx + side * 12, hy + 0.25, hz - 8);
    addCylPart(hueBronze, 0.92, 0.65, 1.15, 6, hx + side * 12, hy + 1.05, hz - 8);
    addBoxPart(hueStone, 1.8, 4.2, 8.6, hx + side * 56, hy + 2.1, hz + 4);
    addConePart(hueRoof, 3.2, 1.5, 4, hx + side * 56, hy + 4.95, hz + 4, Math.PI * 0.25);
  }
  for (const [bx, bz] of [[hx - 3.6, hz + 40], [hx + 3.6, hz + 40], [hx - 3.6, hz + 48], [hx + 3.6, hz + 48]] as Array<[number, number]>) {
    addCylPart(hueGold, 0.05, 0.07, 5.2, 5, bx, hy + 2.6, bz);
  }
  for (let p = 0; p < 6; p++) {
    const px = hx - 15 + p * 6.0;
    addCylPart(hueStone, 0.72, 0.62, 0.55, 6, px, hy + 0.28, hz + 31);
    addConePart(hueLeaf, 0.55, 0.85, 5, px, hy + 0.95, hz + 31);
  }
  addBoxPart(hueCrimson, 4.8, 2.4, 0.45, tpX, tpY + 1.2, tpZ + 11.5);
  addBoxPart(hueGold, 5.1, 0.24, 0.55, tpX, tpY + 2.48, tpZ + 11.5);
  for (const lx of [hx - 18, hx - 6, hx + 6, hx + 18]) {
    addCylPart(hueBronze, 0.12, 0.16, 2.2, 5, lx, hy + 1.1, hz - 14);
    addConePart(hueGold, 0.34, 0.45, 5, lx, hy + 2.4, hz - 14);
  }

  // --- Wave 3 Macro Visual QC & Expansion (487–515): Hiển Lâm Các, Thái Hòa Dais, Cửu Đỉnh Plaques & Moat Gates ---
  const w3HueStone: THREE.BufferGeometry[] = [];
  const w3HueWood: THREE.BufferGeometry[] = [];
  const w3HueRoof: THREE.BufferGeometry[] = [];
  const w3HueGold: THREE.BufferGeometry[] = [];
  const w3HueCrimson: THREE.BufferGeometry[] = [];
  const w3HueBronze: THREE.BufferGeometry[] = [];
  const w3HueLeaf: THREE.BufferGeometry[] = [];
  const hueBronzeMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  const hueLeafMat = ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone;
  // 487 & 488: Thái Hòa Ceremonial Throne Dais Forecourt Replica & Gilded Dragon Screen
  const tdX = hx;
  const tdZ = hz + 10.5;
  addBoxPart(w3HueCrimson, 5.2, 0.42, 3.8, tdX, hy + 0.21, tdZ);
  addBoxPart(w3HueGold, 3.8, 0.42, 2.8, tdX, hy + 0.62, tdZ);
  addBoxPart(w3HueGold, 1.5, 1.35, 1.15, tdX, hy + 1.48, tdZ - 0.2);
  addBoxPart(w3HueCrimson, 4.4, 2.45, 0.26, tdX, hy + 1.65, tdZ - 1.65);
  addBoxPart(w3HueGold, 4.65, 0.22, 0.32, tdX, hy + 2.92, tdZ - 1.65);
  // 489 & 490: Cửu Đỉnh 9 inscribed bronze name plaques & continuous carved stone terrace curb
  for (let u = 0; u < 9; u++) {
    const ux = hx - 16.0 + u * 4.0;
    addBoxPart(w3HueStone, 0.62, 0.72, 0.32, ux, hy + 0.36, hz - 16.5);
    addBoxPart(w3HueBronze, 0.56, 0.08, 0.38, ux, hy + 0.76, hz - 16.5, 0, 0.38, 0);
  }
  addBoxPart(w3HueStone, 38.0, 0.38, 0.38, hx, hy + 0.19, hz - 17.6);
  // 491 & 492: Hiển Lâm Các 3-story memorial pavilion (opposite Cửu Đỉnh) & twin stone stairways
  const hlX = hx - 34;
  const hlZ = hz - 32;
  const hlY = ctx.getHeight(hlX, hlZ);
  addW3Plinth(w3HueStone, 11.4, 8.6, hlY + 1.35, hlY, hlX, hlZ);
  addBoxPart(w3HueCrimson, 8.8, 2.8, 6.2, hlX, hlY + 2.75, hlZ);
  addW3HipRoof(w3HueRoof, null, 10.6, 7.8, hlY + 4.15, 1.15, hlX, hlZ);
  addBoxPart(w3HueCrimson, 6.6, 2.2, 4.6, hlX, hlY + 6.2, hlZ);
  addW3HipRoof(w3HueRoof, null, 8.2, 6.0, hlY + 7.3, 1.05, hlX, hlZ);
  addBoxPart(w3HueCrimson, 4.6, 1.9, 3.2, hlX, hlY + 9.15, hlZ);
  addW3HipRoof(w3HueRoof, w3HueGold, 6.2, 4.6, hlY + 10.1, 1.35, hlX, hlZ);
  for (const s of [-1, 1]) {
    addBoxPart(w3HueStone, 3.4, 0.95, 2.8, hlX, hlY + 0.52, hlZ + s * 5.4);
  }
  // 493: Thế Tổ Miếu forecourt ceremonial screen
  addBoxPart(w3HueStone, 7.4, 2.8, 0.55, hx, hy + 1.4, hz - 24.0);
  addBoxPart(w3HueCrimson, 6.4, 2.1, 0.62, hx, hy + 1.45, hz - 24.0);
  // 494–497: Thiệu Phương lotus basin, frangipani pergola, rockery arch & stone chess table
  addCylPart(w3HueStone, 2.6, 2.8, 0.58, 6, hx - 42, hy + 0.29, hz + 10);
  addCylPart(w3HueBronze, 0.72, 0.48, 0.85, 6, hx - 42, hy + 0.95, hz + 10);
  for (let p = 0; p < 4; p++) {
    const px = hx + 36 + p * 3.2;
    addW3GroundedCol(w3HueCrimson, 0.10, 0.12, hy + 2.95, hy, 5, px, hz + 10.5);
    addW3GroundedCol(w3HueCrimson, 0.10, 0.12, hy + 2.95, hy, 5, px, hz + 13.5);
    addBoxPart(w3HueWood, 0.16, 0.16, 3.4, px, hy + 2.92, hz + 12.0);
  }
  addBoxPart(w3HueWood, 10.4, 0.14, 0.16, hx + 40.8, hy + 3.05, hz + 10.5);
  addBoxPart(w3HueWood, 10.4, 0.14, 0.16, hx + 40.8, hy + 3.05, hz + 13.5);
  addBoxPart(w3HueStone, 1.2, 2.6, 1.2, hx + 42, hy + 1.3, hz - 14.5);
  addBoxPart(w3HueStone, 1.2, 2.6, 1.2, hx + 46, hy + 1.3, hz - 14.5);
  addBoxPart(w3HueStone, 5.6, 0.95, 1.4, hx + 44, hy + 2.9, hz - 14.5);
  addCylPart(w3HueStone, 0.68, 0.55, 0.72, 6, gzX, hy + 0.82, gzZ);
  for (let s = 0; s < 4; s++) {
    const sa = (s / 4) * Math.PI * 2;
    addCylPart(w3HueStone, 0.24, 0.24, 0.44, 5, gzX + Math.cos(sa) * 1.15, hy + 0.68, gzZ + Math.sin(sa) * 1.15);
  }
  // 498 & 499: Moat gates — Cửa Thể Nhơn (east) & Cửa Quảng Đức (west)
  for (const side of [-1, 1]) {
    const gx = hx + side * 42;
    const gz = hz + 56;
    const gy = ctx.getHeight(gx, gz);
    addW3Plinth(w3HueStone, 9.6, 4.8, gy + 3.2, gy, gx, gz);
    addBoxPart(w3HueCrimson, 5.4, 2.2, 3.2, gx, gy + 4.3, gz);
    addW3HipRoof(w3HueRoof, w3HueGold, 7.2, 4.4, gy + 5.4, 1.35, gx, gz);
  }
  // 500–515: Moat bridge piers, guard boxes, fire-water vats, Kỳ Đài winch, cannonball pyramids, mounting stones, Ngự Đạo curbs, Tả/Hữu Vu censers, Tàng Thư Lâu, garden culvert, battlements, Duyệt Thị Đường stand, phoenix lanterns, elephant bollards, bastion bell & Ngự Bình stele
  for (let b = 0; b < 6; b++) {
    addW3GroundedPost(w3HueStone, 0.36, 0.36, hy + 1.35, hy, hx + (b < 3 ? -4.2 : 4.2), hz + 34 + (b % 3) * 4.5);
    addConePart(w3HueGold, 0.22, 0.28, 4, hx + (b < 3 ? -4.2 : 4.2), hy + 1.48, hz + 34 + (b % 3) * 4.5);
  }
  for (const side of [-1, 1]) {
    addBoxPart(w3HueCrimson, 1.4, 2.4, 1.4, hx + side * 12.2, hy + 1.2, hz + 26);
    addW3HipRoof(w3HueRoof, w3HueGold, 1.9, 1.9, hy + 2.4, 0.55, hx + side * 12.2, hz + 26);
    addCylPart(w3HueBronze, 0.72, 0.56, 0.85, 6, hx + side * 26, hy + 0.42, hz + 22);
    addCylPart(w3HueBronze, 0.72, 0.56, 0.85, 6, hx + side * 26, hy + 0.42, hz - 22);
    addConePart(w3HueBronze, 0.58, 0.65, 4, hx + side * 28, hy + 0.32, hz + 56);
    addBoxPart(w3HueStone, 1.1, 0.62, 0.75, hx + side * 7.8, hy + 0.31, hz + 34);
    addBoxPart(w3HueStone, 0.35, 0.22, 34.0, hx + side * 3.8, hy + 0.11, hz + 22);
    addCylPart(w3HueBronze, 0.48, 0.36, 0.92, 6, hx + side * 19.5, hy + 0.46, hz + 10);
    addBoxPart(w3HueStone, 14.0, 1.25, 0.65, hx + side * 24, hy + 0.62, hz + 56);
    addW3GroundedPost(w3HueStone, 0.48, 0.48, hy + 1.45, hy, hx + side * 18.5, hz + 54);
  }
  addBoxPart(w3HueStone, 3.6, 0.85, 1.8, hx, hy + 0.42, hz + 54);
  const ttlX = hx + 52;
  const ttlZ = hz + 34;
  const ttlY = ctx.getHeight(ttlX, ttlZ);
  addW3Plinth(w3HueStone, 5.4, 4.2, ttlY + 0.65, ttlY, ttlX, ttlZ);
  addBoxPart(w3HueCrimson, 4.4, 3.2, 3.2, ttlX, ttlY + 2.25, ttlZ);
  addW3HipRoof(w3HueRoof, w3HueGold, 5.4, 4.2, ttlY + 3.85, 1.15, ttlX, ttlZ);
  addBoxPart(w3HueStone, 1.6, 0.75, 1.2, hx + 46, hy + 0.38, hz + 4);
  addBoxPart(w3HueCrimson, 2.8, 1.85, 0.42, hx + 32, hy + 0.92, hz + 16);
  for (let l = 0; l < 6; l++) {
    const lx = hx + (l < 3 ? -21.5 : 21.5);
    const lz = hz - 20 + (l % 3) * 7.0;
    addW3GroundedCol(w3HueCrimson, 0.08, 0.10, hy + 2.65, hy, 5, lx, lz);
    addConePart(w3HueGold, 0.26, 0.38, 5, lx, hy + 2.82, lz);
  }
  addW3GroundedCol(w3HueCrimson, 0.10, 0.12, tpY + 3.4, tpY + 1.4, 5, tpX + 9.2, tpZ);
  addCylPart(w3HueBronze, 0.36, 0.44, 0.68, 6, tpX + 9.2, tpY + 2.55, tpZ);
  addBoxPart(w3HueStone, 1.4, 2.2, 0.38, hx, hy + 1.1, hz + 66);

  addWave3Mesh(res.group, w3HueStone, ctx.materials.stone);
  addWave3Mesh(res.group, w3HueWood, ctx.materials.darkWood);
  addWave3Mesh(res.group, w3HueRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(res.group, w3HueGold, ctx.materials.gold);
  addWave3Mesh(res.group, w3HueCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(res.group, w3HueBronze, hueBronzeMat);
  addWave3Mesh(res.group, w3HueLeaf, hueLeafMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (887–915): Thái Bình Lâu, Duyệt Thị Đường, Phu Văn Lâu & Nghênh Lương Đình ---
  const w4HueStone: THREE.BufferGeometry[] = [];
  const w4HueWood: THREE.BufferGeometry[] = [];
  const w4HueRoof: THREE.BufferGeometry[] = [];
  const w4HueGold: THREE.BufferGeometry[] = [];
  const w4HueCrimson: THREE.BufferGeometry[] = [];
  const w4HueBronze: THREE.BufferGeometry[] = [];
  const w4HueLeaf: THREE.BufferGeometry[] = [];
  // 887: Thái Bình Lâu 2-story royal reading pavilion (hx + 40, hz - 38, flush double hip roofs!)
  const tblX = hx + 40;
  const tblZ = hz - 38;
  const tblY = Math.max(ctx.getHeight(tblX, tblZ), ctx.getHeight(tblX - 4, tblZ), ctx.getHeight(tblX + 4, tblZ));
  addW3Plinth(w4HueStone, 10.2, 7.6, tblY + 0.95, tblY, tblX, tblZ);
  addBoxPart(w4HueCrimson, 8.0, 2.6, 5.4, tblX, tblY + 2.25, tblZ);
  addW3HipRoof(w4HueRoof, null, 9.6, 6.8, tblY + 3.55, 1.05, tblX, tblZ);
  addBoxPart(w4HueCrimson, 5.8, 2.0, 3.8, tblX, tblY + 5.45, tblZ);
  addW3HipRoof(w4HueRoof, w4HueGold, 7.2, 5.0, tblY + 6.45, 1.25, tblX, tblZ);
  // 888: Duyệt Thị Đường royal opera theatre portico (hx + 38, hz - 22)
  const dtdX = hx + 38;
  const dtdZ = hz - 22;
  const dtdY = Math.max(ctx.getHeight(dtdX, dtdZ), ctx.getHeight(dtdX - 3, dtdZ));
  addW3Plinth(w4HueStone, 8.8, 6.4, dtdY + 0.55, dtdY, dtdX, dtdZ);
  addBoxPart(w4HueCrimson, 7.2, 2.8, 4.8, dtdX, dtdY + 1.95, dtdZ);
  addW3HipRoof(w4HueRoof, w4HueGold, 8.6, 6.0, dtdY + 3.35, 1.25, dtdX, dtdZ);
  // 889 & 890 & 891: Phu Văn Lâu (hx, hz + 74), Nghênh Lương Đình (hx, hz + 92) & twin Khuynh Cái Hạ Mã steles
  const pvlX = hx;
  const pvlZ = hz + 74;
  const pvlY = Math.max(ctx.getHeight(pvlX, pvlZ), ctx.getHeight(pvlX - 3, pvlZ));
  addW3Plinth(w4HueStone, 9.2, 6.8, pvlY + 0.75, pvlY, pvlX, pvlZ);
  addBoxPart(w4HueCrimson, 6.8, 2.5, 4.6, pvlX, pvlY + 2.0, pvlZ);
  addW3HipRoof(w4HueRoof, null, 8.4, 6.0, pvlY + 3.25, 0.95, pvlX, pvlZ);
  addBoxPart(w4HueCrimson, 4.8, 1.9, 3.2, pvlX, pvlY + 5.0, pvlZ);
  addW3HipRoof(w4HueRoof, w4HueGold, 6.2, 4.4, pvlY + 5.95, 1.15, pvlX, pvlZ);
  const nldX = hx;
  const nldZ = hz + 92;
  const nldY = Math.max(ctx.getHeight(nldX, nldZ), ctx.getHeight(nldX - 3, nldZ));
  addW3Plinth(w4HueStone, 8.4, 5.6, nldY + 0.55, nldY, nldX, nldZ);
  for (const [ox, oz] of [[-3.2, -2.0], [3.2, -2.0], [-3.2, 2.0], [3.2, 2.0]]) addW3GroundedCol(w4HueCrimson, 0.13, 0.15, nldY + 3.25, nldY + 0.55, 5, nldX + ox, nldZ + oz);
  addW3HipRoof(w4HueRoof, w4HueGold, 9.2, 6.4, nldY + 3.25, 1.25, nldX, nldZ);
  for (const s of [-1, 1]) {
    addBoxPart(w4HueStone, 0.85, 2.2, 0.32, pvlX + s * 6.8, pvlY + 1.1, pvlZ + 2.2);
    addBoxPart(w4HueGold, 0.95, 0.18, 0.38, pvlX + s * 6.8, pvlY + 2.25, pvlZ + 2.2);
  }
  // 892–899: Bell-tower frame, 4 elephant tethering pillars, outer guardhouse, Lục Bộ screen, Thái Bình Lâu pond, palanquin shelter, Ngự Hà bridge & 2 bronze cauldrons
  for (const ox of [-1.2, 1.2]) addW3GroundedCol(w4HueCrimson, 0.11, 0.13, dtdY + 3.1, dtdY, 5, dtdX - 7.5 + ox, dtdZ);
  addBoxPart(w4HueCrimson, 3.0, 0.22, 0.24, dtdX - 7.5, dtdY + 3.05, dtdZ);
  addCylPart(w4HueBronze, 0.38, 0.52, 0.88, 6, dtdX - 7.5, dtdY + 2.1, dtdZ);
  for (let e = 0; e < 4; e++) addW3GroundedPost(w4HueStone, 0.48, 0.48, hy + 1.65, hy, hx - 68, hz - 12 + e * 6.5);
  const ghX = hx - 66;
  const ghZ = hz + 24;
  const ghY = ctx.getHeight(ghX, ghZ);
  addW3Plinth(w4HueStone, 4.4, 3.8, ghY + 0.42, ghY, ghX, ghZ);
  addBoxPart(w4HueCrimson, 3.4, 2.35, 2.8, ghX, ghY + 1.6, ghZ);
  addW3HipRoof(w4HueRoof, w4HueGold, 4.4, 3.6, ghY + 2.78, 0.88, ghX, ghZ);
  addBoxPart(w4HueStone, 5.2, 2.4, 0.48, hx + 64, hy + 1.2, hz + 8);
  addCylPart(w4HueStone, 2.8, 3.0, 0.55, 6, tblX, tblY + 0.28, tblZ + 7.2);
  const psX = hx - 66;
  const psZ = hz - 30;
  const psY = ctx.getHeight(psX, psZ);
  for (const [ox, oz] of [[-2.0, -1.3], [2.0, -1.3], [-2.0, 1.3], [2.0, 1.3]]) addW3GroundedCol(w4HueCrimson, 0.10, 0.12, psY + 2.65, psY, 5, psX + ox, psZ + oz);
  addW3HipRoof(w4HueRoof, null, 4.8, 3.4, psY + 2.65, 0.88, psX, psZ);
  addBoxPart(w4HueStone, 5.8, 0.35, 2.2, hx - 64, hy + 0.45, hz + 6);
  for (const s of [-1, 1]) addCylPart(w4HueBronze, 0.85, 0.62, 1.1, 6, pvlX + s * 9.5, pvlY + 0.55, pvlZ - 4.5);
  // 900–915: Salute cannons, chess table, 4 bastion braziers, theatre drum, moat steps, tile bench, milestone, 6 lamp posts, moon-window wall, archery target, herb terrace, 4 mooring bollards, culvert, hitching rail, 4 banner poles & 6 stone lanterns
  for (const s of [-1, 1]) {
    addBoxPart(w4HueWood, 0.72, 0.58, 1.5, hx + s * 14, pvlY + 0.29, hz + 64);
    addCylPart(w4HueBronze, 0.13, 0.18, 2.4, 6, hx + s * 14, pvlY + 0.75, hz + 64.4, 1.4, 0);
  }
  addCylPart(w4HueStone, 0.72, 0.58, 0.72, 6, tblX - 7.8, tblY + 0.36, tblZ);
  for (const [bx, bz] of [[-58, -46], [58, -46], [-58, 48], [58, 48]]) addCylPart(w4HueBronze, 0.42, 0.28, 0.95, 5, hx + bx, ctx.getHeight(hx + bx, hz + bz) + 3.65, hz + bz);
  addBoxPart(w4HueCrimson, 1.4, 0.85, 0.85, dtdX, dtdY + 0.98, dtdZ + 4.8);
  addBoxPart(w4HueStone, 5.4, 0.85, 2.2, hx, VIETNAM_WATER_LEVEL + 0.45, hz + 60.5);
  addBoxPart(w4HueStone, 2.4, 0.55, 0.92, hx + 64, hy + 0.28, hz - 12);
  addW3GroundedPost(w4HueStone, 0.45, 0.45, pvlY + 1.85, pvlY, hx + 12.5, hz + 82);
  for (let l = 0; l < 6; l++) addW3GroundedCol(w4HueBronze, 0.06, 0.08, pvlY + 3.2, pvlY, 5, hx + (l < 3 ? -6.2 : 6.2), hz + 70 + (l % 3) * 8.5);
  addBoxPart(w4HueStone, 5.4, 2.4, 0.42, hx - 58, hy + 1.2, hz - 6);
  addBoxPart(w4HueWood, 1.6, 1.8, 0.22, hx - 68, hy + 0.9, hz - 22);
  addBoxPart(w4HueStone, 4.6, 0.52, 2.8, hx + 64, hy + 0.26, hz - 24);
  for (const ox of [-3.6, -1.2, 1.2, 3.6]) addW3GroundedPost(w4HueStone, 0.32, 0.32, nldY + 1.25, nldY, nldX + ox, nldZ + 3.8);
  addBoxPart(w4HueStone, 2.4, 1.25, 0.55, hx - 16, VIETNAM_WATER_LEVEL + 0.45, hz + 56.5);
  addBoxPart(w4HueStone, 3.4, 0.18, 0.18, hx + 52, hy + 0.95, hz + 56);
  for (const [fx, fz] of [[-5.6, -3.5], [5.6, -3.5], [-5.6, 3.5], [5.6, 3.5]]) {
    addW3GroundedCol(w4HueGold, 0.05, 0.07, pvlY + 6.4, pvlY, 5, pvlX + fx, pvlZ + fz);
    addBoxPart(w4HueCrimson, 0.08, 1.8, 0.92, pvlX + fx, pvlY + 5.3, pvlZ + fz + 0.45);
  }
  for (let s = 0; s < 6; s++) addW3GroundedPost(w4HueStone, 0.34, 0.34, hy + 1.55, hy, hx + (s < 3 ? -62 : 62), hz - 26 + (s % 3) * 26);

  addWave3Mesh(res.group, w4HueStone, ctx.materials.stone);
  addWave3Mesh(res.group, w4HueWood, ctx.materials.darkWood);
  addWave3Mesh(res.group, w4HueRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(res.group, w4HueGold, ctx.materials.gold);
  addWave3Mesh(res.group, w4HueCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(res.group, w4HueBronze, hueBronzeMat);
  addWave3Mesh(res.group, w4HueLeaf, hueLeafMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1287–1315): Thế Miếu Side-Gate, Hiển Lâm Các Pavilion, Cửu Đỉnh Tribute & Royal Court ---
  const w5HueStone: THREE.BufferGeometry[] = [];
  const w5HueWood: THREE.BufferGeometry[] = [];
  const w5HueRoof: THREE.BufferGeometry[] = [];
  const w5HueGold: THREE.BufferGeometry[] = [];
  const w5HueCrimson: THREE.BufferGeometry[] = [];
  const w5HueBronze: THREE.BufferGeometry[] = [];
  const w5HueLeaf: THREE.BufferGeometry[] = [];
  // 1287 & 1288: Thế Miếu Outer Side-Gate (hx - 74, hz - 6) & Hiển Lâm Các Outer Terrace Pavilion (hx - 72, hz + 44)
  const tmX = hx - 74;
  const tmZ = hz - 6;
  const tmY = Math.max(ctx.getHeight(tmX, tmZ), ctx.getHeight(tmX - 2, tmZ));
  addW3Plinth(w5HueStone, 7.2, 3.8, tmY + 0.45, tmY, tmX, tmZ);
  for (const ox of [-2.8, -1.0, 1.0, 2.8]) addW3GroundedCol(w5HueCrimson, 0.12, 0.14, tmY + 3.45, tmY + 0.45, 5, tmX + ox, tmZ);
  addW3HipRoof(w5HueRoof, w5HueGold, 8.0, 4.4, tmY + 3.45, 1.15, tmX, tmZ);
  const hlW5X = hx - 72;
  const hlW5Z = hz + 44;
  const hlW5Y = Math.max(ctx.getHeight(hlW5X, hlW5Z), ctx.getHeight(hlW5X - 2, hlW5Z));
  addW3Plinth(w5HueStone, 6.2, 5.2, hlW5Y + 0.45, hlW5Y, hlW5X, hlW5Z);
  for (const [ox, oz] of [[-2.3, -1.9], [2.3, -1.9], [-2.3, 1.9], [2.3, 1.9]]) addW3GroundedCol(w5HueCrimson, 0.12, 0.14, hlW5Y + 3.25, hlW5Y + 0.45, 5, hlW5X + ox, hlW5Z + oz);
  addW3HipRoof(w5HueRoof, w5HueGold, 7.2, 6.0, hlW5Y + 3.25, 1.25, hlW5X, hlW5Z);
  // 1289–1296: Cửu Đỉnh tribute pedestals, Kỳ Đài stone watch-bastion, Thái Bình Lâu porcelain screen, Duyệt Thị Đường prop pavilion, Nghênh Lương Đình barge pier, 4 bronze vats, 6 dragon boundary posts & Phu Văn Lâu edict board
  for (const s of [-1, 1]) {
    addBoxPart(w5HueStone, 1.65, 0.65, 1.65, tmX + 6.5, tmY + 0.32, tmZ + s * 4.5);
    addCylPart(w5HueBronze, 0.62, 0.48, 0.95, 6, tmX + 6.5, tmY + 1.12, tmZ + s * 4.5);
  }
  addBoxPart(w5HueStone, 6.8, 1.85, 3.6, pvlX - 18, pvlY + 0.92, pvlZ - 6);
  addBoxPart(w5HueStone, 5.6, 2.35, 0.45, tblX, tblY + 1.18, tblZ - 7.8);
  addBoxPart(w5HueGold, 4.8, 0.22, 0.52, tblX, tblY + 2.42, tblZ - 7.8);
  const dpX = dtdX + 10.5;
  const dpZ = dtdZ;
  const dpY = Math.max(ctx.getHeight(dpX, dpZ), ctx.getHeight(dpX + 2, dpZ));
  addW3Plinth(w5HueStone, 4.6, 3.8, dpY + 0.35, dpY, dpX, dpZ);
  for (const [ox, oz] of [[-1.7, -1.3], [1.7, -1.3], [-1.7, 1.3], [1.7, 1.3]]) addW3GroundedCol(w5HueCrimson, 0.09, 0.11, dpY + 2.75, dpY + 0.35, 5, dpX + ox, dpZ + oz);
  addW3HipRoof(w5HueRoof, null, 5.4, 4.4, dpY + 2.75, 0.92, dpX, dpZ);
  addBoxPart(w5HueWood, 3.6, 0.22, 8.8, nldX, nldY + 0.35, nldZ + 7.4);
  for (const [vx, vz] of [[-64, -42], [64, -42], [-64, 42], [64, 42]]) addCylPart(w5HueBronze, 0.72, 0.56, 0.88, 6, hx + vx, ctx.getHeight(hx + vx, hz + vz) + 0.44, hz + vz);
  for (let p = 0; p < 6; p++) {
    const px = hx - 20 + p * 8;
    addW3GroundedPost(w5HueStone, 0.34, 0.34, pvlY + 1.35, pvlY, px, pvlZ + 10.5);
    addConePart(w5HueGold, 0.22, 0.28, 4, px, pvlY + 1.48, pvlZ + 10.5);
  }
  addBoxPart(w5HueCrimson, 2.8, 1.85, 0.22, pvlX + 10.5, pvlY + 1.35, pvlZ + 4.5);
  // 1297–1306: Eastern water-gate arch, Thiệu Phương rockery terrace, 2 halberd racks, royal tea table, 2 cannonball stacks, sundial pedestal, Ngự Hà stairs, silk-embroidery frame, 4 bronze censers & 2 corner sentry-boxes
  addBoxPart(w5HueStone, 3.4, 1.65, 0.72, hx + 58, VIETNAM_WATER_LEVEL + 0.65, hz + 56.5);
  addBoxPart(w5HueStone, 4.6, 0.65, 3.4, hx - 66, hy + 0.32, hz - 16);
  addConePart(w5HueLeaf, 1.15, 1.65, 5, hx - 66, hy + 1.45, hz - 16);
  for (const s of [-1, 1]) addBoxPart(w5HueCrimson, 1.35, 1.65, 0.38, ghX + s * 3.6, ghY + 0.82, ghZ + 2.4);
  addCylPart(w5HueStone, 0.72, 0.58, 0.72, 6, tblX + 7.8, tblY + 0.36, tblZ);
  addCylPart(w5HueBronze, 0.22, 0.26, 0.32, 5, tblX + 7.8, tblY + 0.88, tblZ);
  for (const s of [-1, 1]) addConePart(w5HueBronze, 0.52, 0.48, 4, hx + s * 16.5, pvlY + 0.24, hz + 64);
  addW3GroundedPost(w5HueStone, 0.55, 0.55, pvlY + 1.15, pvlY, pvlX - 11.5, pvlZ + 5.5);
  addCylPart(w5HueBronze, 0.42, 0.42, 0.08, 6, pvlX - 11.5, pvlY + 1.25, pvlZ + 5.5, 0.35, 0);
  addBoxPart(w5HueStone, 3.8, 0.75, 2.2, hx - 68, hy + 0.38, hz + 12);
  addBoxPart(w5HueCrimson, 2.6, 1.75, 0.16, hx + 68, hy + 0.92, hz + 12);
  addBoxPart(w5HueGold, 2.1, 1.25, 0.20, hx + 68, hy + 0.98, hz + 12);
  for (let c = 0; c < 4; c++) addCylPart(w5HueBronze, 0.42, 0.32, 0.85, 6, nldX + (c < 2 ? -6.5 : 6.5), nldY + 0.42, nldZ - 5.5 + (c % 2) * 8.0);
  for (const s of [-1, 1]) {
    const sbX = hx + s * 68;
    const sbZ = hz - 46;
    const sbY = ctx.getHeight(sbX, sbZ);
    addBoxPart(w5HueStone, 2.2, 2.25, 2.2, sbX, sbY + 1.12, sbZ);
    addW3HipRoof(w5HueRoof, null, 2.8, 2.8, sbY + 2.25, 0.68, sbX, sbZ);
  }
  // 1307–1315: 4 curved stone benches, Nhã Nhạc chime-frame, moat punt, tile-kiln display, 6 crimson lantern standards, elephant trough, 4 lion-spouts, Phu Văn Lâu gong & UNESCO monolith
  for (let b = 0; b < 4; b++) addBoxPart(w5HueStone, 2.3, 0.50, 0.65, hx + (b < 2 ? -18 + b * 8 : 10 + (b - 2) * 8), pvlY + 0.25, hz + 68);
  addBoxPart(w5HueCrimson, 2.8, 1.95, 0.22, dtdX - 4.8, dtdY + 0.98, dtdZ + 6.2);
  for (let ch = -2; ch <= 2; ch++) addCylPart(w5HueGold, 0.12, 0.14, 0.28, 5, dtdX - 4.8 + ch * 0.48, dtdY + 1.35, dtdZ + 6.2);
  addBoxPart(w5HueWood, 3.8, 0.38, 1.15, hx + 12, VIETNAM_WATER_LEVEL + 0.16, hz + 59.5, 0.22);
  addBoxPart(w5HueStone, 2.4, 0.65, 1.15, hx + 70, hy + 0.32, hz - 12);
  for (let l = 0; l < 6; l++) {
    const lz = hz - 32 + l * 13;
    addW3GroundedCol(w5HueCrimson, 0.07, 0.09, hy + 3.4, hy, 5, hx + 72, lz);
    addConePart(w5HueGold, 0.20, 0.32, 4, hx + 72, hy + 3.55, lz);
  }
  addBoxPart(w5HueStone, 2.6, 0.68, 0.95, hx - 74, hy + 0.34, hz - 4);
  for (let sp = 0; sp < 4; sp++) addBoxPart(w5HueStone, 0.55, 0.48, 0.85, hx - 30 + sp * 20, pvlY + 1.65, hz + 58);
  addBoxPart(w5HueCrimson, 2.2, 2.1, 0.24, pvlX + 14, pvlY + 1.05, pvlZ);
  addCylPart(w5HueGold, 0.48, 0.48, 0.12, 6, pvlX + 14, pvlY + 1.25, pvlZ, Math.PI * 0.5, 0);
  addBoxPart(w5HueStone, 1.75, 2.85, 0.44, hx, nldY + 1.42, nldZ + 14.5);
  addBoxPart(w5HueGold, 1.25, 1.85, 0.48, hx, nldY + 1.55, nldZ + 14.5);

  addWave3Mesh(res.group, w5HueStone, ctx.materials.stone);
  addWave3Mesh(res.group, w5HueWood, ctx.materials.darkWood);
  addWave3Mesh(res.group, w5HueRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(res.group, w5HueGold, ctx.materials.gold);
  addWave3Mesh(res.group, w5HueCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(res.group, w5HueBronze, hueBronzeMat);
  addWave3Mesh(res.group, w5HueLeaf, hueLeafMat);

  res.group.add(
    new THREE.Mesh(mergeNormalized(hueStone), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(hueWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(hueRoof), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(hueGold), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(hueCrimson), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(hueBronze), ctx.materials.bronzePatina ?? ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(hueLeaf), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone)
  );
  return res;
}

function buildDaiLienHoaLotusSanctuaryMacro(ctx: VietnamBuilderContext): {
  group: THREE.Group;
  daiSenMat: THREE.MeshStandardMaterial;
} {
  const cx = 0;
  const cz = -560;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 108 });
  const group = new THREE.Group();
  group.name = 'DaiLienHoaLotusSanctuary';

  const daiSenMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#ff8fb3'),
    emissiveIntensity: 0.18,
    roughness: 0.40,
    side: THREE.DoubleSide
  });
  daiSenMat.userData.noDedupe = true;
  const cloudTealMat = new THREE.MeshStandardMaterial({
    color: '#2bb3b1',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.45,
    roughness: 0.42
  });
  const padMat = ctx.materialLib?.getOrCreateStandard({ color: '#3f7236', roughness: 0.58, side: THREE.DoubleSide }) ?? new THREE.MeshStandardMaterial({ color: '#3f7236', roughness: 0.58, side: THREE.DoubleSide });
  ctx.extraMaterials.push(daiSenMat, cloudTealMat);

  // Helper to apply authentic Vietnamese lotus-petal gradient vertex colors (HV02-2: pure creamy-white lower body -> vivid rose-pink outer 30% tips + fine longitudinal veins)
  const applyLotusGradientColors = (geo: THREE.BufferGeometry, minY: number, maxY: number, centerX: number, centerZ: number, maxR: number): THREE.BufferGeometry => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cBase = new THREE.Color('#fbf7f2');
    const cMid = new THREE.Color('#f7e2eb');
    const cTip = new THREE.Color('#e03c86');
    const tmp = new THREE.Color();
    const spanY = Math.max(0.1, maxY - minY);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const tY = clamp01((py - minY) / spanY);
      const rDist = clamp01(Math.hypot(px - centerX, pz - centerZ) / Math.max(0.1, maxR));
      const grad = clamp01(Math.max(tY * 0.92, rDist * 0.88));
      const vein = 0.045 * Math.sin(Math.atan2(pz - centerZ, px - centerX) * 64.0);
      const gVal = clamp01(grad + vein);
      if (gVal < 0.56) {
        tmp.copy(cBase).lerp(cMid, gVal / 0.56);
      } else {
        tmp.copy(cMid).lerp(cTip, Math.pow((gVal - 0.56) / 0.44, 0.85));
      }
      cols[i * 3] = tmp.r;
      cols[i * 3 + 1] = tmp.g;
      cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  };

  // 1. Monumental 32-petal ~10.2m Đài Sen Hero Centerpiece on 3-tier White-Jade Pedestal
  const pedParts: THREE.BufferGeometry[] = [];
  const baseY = Math.max(0.0, VIETNAM_WATER_LEVEL);
  addCylPart(pedParts, 7.6, 8.2, 0.52, 28, cx, baseY + 0.26, cz); // walkable circular terrace ring
  addCylPart(pedParts, 5.4, 6.4, 0.72, 24, cx, baseY + 0.86, cz);
  addCylPart(pedParts, 4.2, 5.0, 0.65, 24, cx, baseY + 1.48, cz);
  const heroFlower = createMonumentalLotusParts(cx, baseY + 1.65, cz, 2.35);
  const heroPetalGeo = applyLotusGradientColors(mergeNormalized(heroFlower.petalParts), baseY + 2.0, baseY + 9.2, cx, cz, 8.8);

  // Walkable white-marble arched causeway bridge with lotus_stone balustrades connecting Tam Quan archway to central Đài Sen
  const bridgeStartZ = cz - 41.2;
  const bridgeEndZ = cz - 7.4;
  const bridgeLen = bridgeEndZ - bridgeStartZ; // ~33.8m
  const bridgeW = 4.4;
  const bridgeSegs = 12;
  const bridgeArchY = (t: number): number => baseY + 0.56 + Math.sin(clamp01(t) * Math.PI) * 1.45;
  for (let i = 0; i < bridgeSegs; i++) {
    const t0 = i / bridgeSegs;
    const t1 = (i + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const z0 = bridgeStartZ + t0 * bridgeLen;
    const z1 = bridgeStartZ + t1 * bridgeLen;
    const zm = (z0 + z1) * 0.5;
    const y0 = bridgeArchY(t0);
    const y1 = bridgeArchY(t1);
    const ym = bridgeArchY(tm);
    const dz = z1 - z0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dz, dy) + 0.08;
    const pitch = -Math.atan2(dy, dz);
    addBoxPart(pedParts, bridgeW, 0.34, segLen, cx, ym, zm, 0, pitch, 0);
    for (const side of [-1, 1]) {
      pedParts.push(
        ...createPiercedBalustradeParts(
          cx + side * (bridgeW * 0.46),
          z0,
          cx + side * (bridgeW * 0.46),
          z1,
          ym + 0.16,
          0.92,
          'lotus_stone'
        )
      );
      if (i % 2 === 0 && i > 0) {
        const pierH = Math.max(1.2, y0 - (baseY - 1.2));
        addCylPart(pedParts, 0.32, 0.42, pierH, 10, cx + side * (bridgeW * 0.42), y0 - pierH * 0.5, z0);
      }
    }
  }
  // White-marble balustrade ring enclosing the central Đài Sen terrace (leaving entry opening toward Tam Quan)
  const terraceRingSegs = 12;
  for (let i = 0; i < terraceRingSegs; i++) {
    const a0 = (i / terraceRingSegs) * Math.PI * 2;
    const a1 = ((i + 1) / terraceRingSegs) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    // Leave opening around -Z (angle ~ 1.5*PI) where arched causeway arrives
    if (Math.sin(am) < -0.82) continue;
    const rr = 7.4;
    pedParts.push(
      ...createPiercedBalustradeParts(
        cx + Math.cos(a0) * rr,
        cz + Math.sin(a0) * rr,
        cx + Math.cos(a1) * rr,
        cz + Math.sin(a1) * rr,
        baseY + 0.52,
        0.88,
        'lotus_stone'
      )
    );
  }

  // Sweeping Carved Lotus-Scroll Tam Quan Archway & Curved Roof behind lake + Deep Grounded Column Footings & 5 Relief Lotus Blooms (HV02-3)
  const archParts: THREE.BufferGeometry[] = [];
  const archGoldParts: THREE.BufferGeometry[] = [...heroFlower.coreParts];
  const friezeLotusParts: THREE.BufferGeometry[] = [];
  addBoxPart(archParts, 46, 2.5, 1.4, cx, 10.65, cz - 42);
  // Gilded lotus-scroll floral frieze & 5 3D relief lotus-and-cloud medallions running along Tam Quan architrave
  addBoxPart(archGoldParts, 45.6, 0.26, 1.58, cx, 9.48, cz - 42);
  addBoxPart(archGoldParts, 45.6, 0.26, 1.58, cx, 11.78, cz - 42);
  for (const fm of [-18.0, -9.8, 0.0, 9.8, 18.0]) {
    const outerRing = new THREE.TorusGeometry(0.88, 0.09, 6, 16);
    outerRing.translate(cx + fm, 10.65, cz - 41.22);
    archGoldParts.push(outerRing);
    if (Math.abs(fm) > 3.5) {
      // Sculpted 8-petal relief lotus bloom flanking the central plaque
      for (let lp = 0; lp < 8; lp++) {
        const la = (lp / 8) * Math.PI * 2;
        const pet = new THREE.SphereGeometry(0.32, 6, 5);
        pet.scale(0.65, 1.35, 0.35);
        pet.rotateZ(la);
        pet.translate(cx + fm + Math.sin(-la) * 0.52, 10.65 + Math.cos(la) * 0.52, cz - 41.15);
        friezeLotusParts.push(pet);
      }
      // Connecting gilded cloud scroll bars flanking each relief lotus
      for (const sDir of [-1, 1]) {
        const scCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(cx + fm + sDir * 1.15, 10.65, cz - 41.20),
          new THREE.Vector3(cx + fm + sDir * 2.15, 11.12, cz - 41.18),
          new THREE.Vector3(cx + fm + sDir * 3.15, 10.35, cz - 41.20)
        ]);
        archGoldParts.push(new THREE.TubeGeometry(scCurve, 8, 0.085, 5, false));
      }
    }
  }
  const friezeLotusGeo = applyLotusGradientColors(mergeNormalized(friezeLotusParts), 9.6, 11.6, cx, cz - 41.15, 22.0);
  for (const sx of [-21.5, -10.5, 10.5, 21.5]) {
    addCylPart(archParts, 0.42, 0.48, 9.6, 12, cx + sx, 5.1, cz - 42);
    // Deep submerged white-jade masonry foundation pier reaching y = -1.65m below lake bed (ZERO floating columns!)
    addCylPart(pedParts, 1.04, 1.24, 1.75, 12, cx + sx, -0.78, cz - 42);
    // Carved multi-tier white-jade lotus column base (*chân tảng cánh sen*)
    addCylPart(pedParts, 0.84, 1.04, 0.48, 12, cx + sx, 0.28, cz - 42);
    addCylPart(pedParts, 0.68, 0.88, 0.45, 12, cx + sx, 0.72, cz - 42);
    addCylPart(archGoldParts, 0.54, 0.62, 0.22, 12, cx + sx, 1.02, cz - 42);
  }
  const archRoofGeo = createVietnameseCurvedRoofGeometry(48.5, 4.8, 36.0, 1.4, 2.4, 0.48);
  archRoofGeo.translate(cx, 11.65, cz - 42);
  const archRoofMat = ctx.materials.terracottaRoof;
  const archPlaque = createSignagePlaqueMesh(
    { text: 'LIÊN HOA BẠCH NGỌC ĐÀI', subText: 'ĐẠI SEN HỒNG', width: 5.4, height: 1.25, depth: 0.20, style: 'royal' },
    ctx
  );
  archPlaque.position.set(cx, 10.65, cz - 41.18);
  group.add(archPlaque);
  group.add(
    new THREE.Mesh(mergeNormalized(pedParts), ctx.materials.whiteMarble ?? ctx.materials.whitePlaster),
    new THREE.Mesh(heroPetalGeo, daiSenMat),
    new THREE.Mesh(friezeLotusGeo, daiSenMat),
    new THREE.Mesh(mergeNormalized(archGoldParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(archParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(archRoofGeo, archRoofMat)
  );

  // 2. 16 Tall Lotus-Etched Red Lacquer Columns on Deep Submerged White-Jade Bases with Flared Lotus Capitals
  const lotusColMat = ctx.huePack?.dragonColumnMat ?? ctx.materials.crimsonLacquer;
  const lotusColGeo = mergeNormalized([
    new THREE.CylinderGeometry(0.36, 0.40, 8.8, 16),
    new THREE.CylinderGeometry(0.68, 0.40, 0.48, 12).translate(0, 4.62, 0),
    new THREE.ConeGeometry(0.46, 0.75, 10).translate(0, 5.22, 0)
  ]);
  const colInst = new THREE.InstancedMesh(lotusColGeo, lotusColMat, 16);
  const carvedBaseParts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.84, 0.96, 1.8, 12).translate(0, -1.0, 0),
    new THREE.CylinderGeometry(0.68, 0.84, 0.42, 12),
    (() => { const c = new THREE.CylinderGeometry(0.52, 0.72, 0.36, 12); c.translate(0, 0.36, 0); return c; })()
  ];
  const baseInst = new THREE.InstancedMesh(
    mergeNormalized(carvedBaseParts),
    ctx.materials.whiteMarble ?? ctx.materials.whitePlaster,
    16
  );
  // FIX HV02-4: Arrange 8 ceremonial lotus columns in 2 grand flanking rows along the white marble bridge approach,
  // and 8 columns framing the inner sanctuary circle (r = 46m) instead of scattered far away at 58–70m!
  const bridgeColZ = [-42, -31, -20, -9];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const ax = cx + side * 6.8;
    const az = cz + bridgeColZ[i % 4];
    const ay = VIETNAM_WATER_LEVEL - 0.15;
    setInstanceMatrix(colInst, i, ax, ay + 5.1, az, 0, side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5, 0, 1, 1, 1);
    setInstanceMatrix(baseInst, i, ax, ay + 0.22, az, 0, 0, 0, 1, 1, 1);
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const rad = 46;
    const ax = cx + Math.cos(a) * rad;
    const az = cz + Math.sin(a) * rad;
    const ay = Math.max(ctx.getHeight(ax, az), 1.4);
    setInstanceMatrix(colInst, 8 + i, ax, ay + 5.1, az, 0, -a, 0, 1, 1, 1);
    setInstanceMatrix(baseInst, 8 + i, ax, ay + 0.22, az, 0, -a, 0, 1, 1, 1);
  }
  colInst.instanceMatrix.needsUpdate = true;
  baseInst.instanceMatrix.needsUpdate = true;

  // 3. 18 3D Cyan-Cobalt Tường Vân Auspicious Clouds flanking Sanctuary
  const tvInst = new THREE.InstancedMesh(createTuongVanScrollGeometry(), cloudTealMat, 18);
  for (let i = 0; i < 18; i++) {
    const side = i < 9 ? -1 : 1;
    const k = i % 9;
    setInstanceMatrix(tvInst, i, cx + side * (36 + (k % 3) * 14), 5.5 + (k % 4) * 2.4, cz - 36 + k * 9, 0, side * 0.25, 0, 1.5, 1.2, 1.0);
  }
  tvInst.instanceMatrix.needsUpdate = true;

  // 4. 600 Living Sacred Lotus Flowers + 720 Floating & Raised Lotus Pads (STRICTLY excluding white marble bridge corridor!)
  const rand = mulberry32(55055);
  const instPetalParts: THREE.BufferGeometry[] = [];
  const fScale = 2.2;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.076 * fScale, 4, 3);
    petal.scale(0.68, 1.48, 0.34);
    petal.translate(0, 0.068 * fScale, 0);
    petal.rotateX(0.86);
    petal.rotateY(ang);
    petal.translate(0, 0.4, 0);
    instPetalParts.push(petal);
  }
  for (let i = 0; i < 5; i++) {
    const ang = 0.32 + (i / 5) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.060 * fScale, 4, 3);
    petal.scale(0.64, 1.42, 0.34);
    petal.translate(0, 0.056 * fScale, 0);
    petal.rotateX(0.42);
    petal.rotateY(ang);
    petal.translate(0, 0.4 + 0.015 * fScale, 0);
    instPetalParts.push(petal);
  }
  const petalGeo = applyLotusGradientColors(mergeNormalized(instPetalParts), 0.35, 0.88, 0, 0, 0.35);
  const flowerInst = new THREE.InstancedMesh(petalGeo, daiSenMat, 600);
  const padGeo = createNotchedLotusPadGeometry(0.52, 12);
  const padInst = new THREE.InstancedMesh(padGeo, padMat, 720);
  const isInBridgeCorridor = (px: number, pz: number): boolean =>
    Math.abs(px - cx) < 3.6 && pz >= cz - 43.0 && pz <= cz - 5.5;

  for (let i = 0; i < 600; i++) {
    let fx = cx;
    let fz = cz;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = rand() * Math.PI * 2;
      const r = 10 + Math.sqrt(rand()) * 38;
      fx = cx + Math.cos(a) * r;
      fz = cz + Math.sin(a) * r;
      if (!isInBridgeCorridor(fx, fz)) break;
    }
    const sc = 0.75 + rand() * 0.55;
    setInstanceMatrix(flowerInst, i, fx, VIETNAM_WATER_LEVEL + 0.35 + rand() * 0.5, fz, 0, rand() * 6.28, 0, sc, sc, sc);
  }
  for (let i = 0; i < 720; i++) {
    let px = cx;
    let pz = cz;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = rand() * Math.PI * 2;
      const r = 8.5 + Math.sqrt(rand()) * 41.5;
      px = cx + Math.cos(a) * r;
      pz = cz + Math.sin(a) * r;
      if (!isInBridgeCorridor(px, pz)) break;
    }
    const sc = 0.7 + rand() * 0.75;
    setInstanceMatrix(padInst, i, px, VIETNAM_WATER_LEVEL + 0.04 + (rand() > 0.65 ? rand() * 0.45 : 0), pz, 0, rand() * 6.28, 0, sc, 1, sc);
  }
  flowerInst.instanceMatrix.needsUpdate = true;
  padInst.instanceMatrix.needsUpdate = true;

  // --- 200-Item Macro Visual QC & Expansion (060–073): Đại Liên Hoa Sanctuary ---
  const dlExpMarble: THREE.BufferGeometry[] = [];
  const dlExpRoof: THREE.BufferGeometry[] = [];
  const dlExpCrimson: THREE.BufferGeometry[] = [];
  const dlExpGold: THREE.BufferGeometry[] = [];
  const dlExpBronze: THREE.BufferGeometry[] = [];
  const dlExpOrb: THREE.BufferGeometry[] = [];
  const dlExpStem: THREE.BufferGeometry[] = [];

  // 060 & 065 & 069: Outer circular white-marble promenade ring, stepped shore ghats & viewing benches
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    const pr = 52.0;
    const px = cx + Math.cos(am) * pr;
    const pz = cz + Math.sin(am) * pr;
    addBoxPart(dlExpMarble, 14.2, 0.36, 3.6, px, baseY + 0.18, pz, -am + Math.PI * 0.5);
    if (i % 4 === 0) {
      addBoxPart(dlExpCrimson, 2.8, 0.42, 0.72, px, baseY + 0.52, pz, -am + Math.PI * 0.5);
    }
  }
  for (let st = 0; st < 4; st++) {
    addBoxPart(dlExpMarble, 16.0, 0.24, 1.1, cx, baseY + 0.12 - st * 0.18, cz + 50.0 - st * 0.9);
  }
  // 061: 4 Octagonal Lầu Vọng Nguyệt meditation pavilions at NE, NW, SE, SW lake corners
  for (const [vx, vz] of [[-38, -38], [38, -38], [-38, 38], [38, 38]] as Array<[number, number]>) {
    const px = cx + vx;
    const pz = cz + vz;
    addCylPart(dlExpMarble, 4.4, 4.8, 0.9, 8, px, baseY + 0.25, pz);
    for (let c = 0; c < 8; c++) {
      const ca = (c / 8) * Math.PI * 2;
      addCylPart(dlExpCrimson, 0.14, 0.16, 3.6, 6, px + Math.cos(ca) * 3.4, baseY + 2.5, pz + Math.sin(ca) * 3.4);
    }
    const pRoof = createVietnameseCurvedRoofGeometry(9.2, 9.2, 2.2, 2.2, 2.4, 0.85);
    pRoof.translate(px, baseY + 4.3, pz);
    dlExpRoof.push(pRoof);
    addCylPart(dlExpGold, 0.06, 0.22, 1.1, 6, px, baseY + 7.2, pz);
  }
  // 062 & 073: 8 Stone lotus-lantern pillars flanking the marble causeway with glowing pink orbs
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const lz = bridgeStartZ + 4.5 + (i % 4) * 7.8;
    const lx = cx + side * 2.55;
    const ly = bridgeArchY((lz - bridgeStartZ) / bridgeLen);
    dlExpMarble.push(...createAncientStoneLanternParts(lx, ly + 0.16, lz, 0.72));
    dlExpOrb.push(new THREE.SphereGeometry(0.18, 6, 5).translate(lx, ly + 1.48, lz));
  }
  // 063: Golden Dharma-wheel / lotus-stamen halo crown above central Đài Sen
  const haloWheel = new THREE.TorusGeometry(3.4, 0.16, 6, 20);
  haloWheel.translate(cx, baseY + 12.6, cz);
  dlExpGold.push(haloWheel);
  for (let sp = 0; sp < 8; sp++) {
    const sa = (sp / 8) * Math.PI * 2;
    const spoke = new THREE.CylinderGeometry(0.06, 0.06, 6.6, 5);
    spoke.rotateZ(sa);
    spoke.translate(cx, baseY + 12.6, cz);
    dlExpGold.push(spoke);
  }
  // 064, 067, 068, 071: Bridgehead bronze censers, dragon spouts, Bia Công Đức steles & flagpoles
  for (const side of [-1, 1]) {
    const tri = createBronzeIncenseTripodParts(cx + side * 3.6, baseY + 0.35, bridgeStartZ - 1.5, 0.78);
    dlExpMarble.push(...tri.limestoneParts);
    dlExpBronze.push(...tri.bronzeParts);
    dlExpGold.push(...tri.goldParts);
    addBoxPart(dlExpMarble, 2.2, 0.45, 2.2, cx + side * 14.5, baseY + 0.22, cz - 46);
    addBoxPart(dlExpMarble, 1.1, 2.4, 0.26, cx + side * 14.5, baseY + 1.6, cz - 46);
    addCylPart(dlExpMarble, 0.12, 0.16, 8.2, 6, cx + side * 26.0, baseY + 4.1, cz - 44);
    addCylPart(dlExpGold, 0.16, 0.05, 0.65, 6, cx + side * 26.0, baseY + 8.4, cz - 44);
  }
  for (let d = 0; d < 8; d++) {
    const da = (d / 8) * Math.PI * 2;
    addCylPart(dlExpMarble, 0.14, 0.22, 0.9, 6, cx + Math.cos(da) * 8.1, baseY + 0.55, cz + Math.sin(da) * 8.1, 0, Math.PI * 0.42);
  }
  // 066: 48 Tall emergent lotus-bud stems around central pedestal
  for (let s = 0; s < 48; s++) {
    const sa = (s / 48) * Math.PI * 2;
    const sr = 9.2 + (s % 4) * 3.8;
    const sx = cx + Math.cos(sa) * sr;
    const sz = cz + Math.sin(sa) * sr;
    addCylPart(dlExpStem, 0.03, 0.04, 1.35, 5, sx, VIETNAM_WATER_LEVEL + 0.65, sz);
    dlExpOrb.push(new THREE.ConeGeometry(0.14, 0.34, 6).translate(sx, VIETNAM_WATER_LEVEL + 1.42, sz));
  }

  // --- Wave 2 Macro Visual QC & Expansion (260–273): Đại Liên Hoa Meditation Bridges & Sutra Pillars ---
  // 260 & 262: 2 White-marble meditation bridges (Cầu Thiền) & 2 octagonal chanting platforms (Đài Tụng Kinh)
  for (const side of [-1, 1]) {
    const mx = cx + side * 34;
    addBoxPart(dlExpMarble, 18.0, 0.32, 2.8, mx, baseY + 0.65, cz);
    addBoxPart(dlExpMarble, 18.0, 0.16, 0.16, mx, baseY + 1.45, cz - 1.3);
    addBoxPart(dlExpMarble, 18.0, 0.16, 0.16, mx, baseY + 1.45, cz + 1.3);
    addCylPart(dlExpMarble, 4.2, 4.6, 0.65, 6, cx + side * 23, baseY + 0.32, cz);
    addCylPart(dlExpGold, 0.95, 1.15, 0.22, 6, cx + side * 23, baseY + 0.75, cz);
  }
  // 261: 4 Hexagonal Buddhist Sutra Pillars (Kinh Tràng Đá) at cardinal axes
  for (const [kx, kz] of [[cx - 46, cz], [cx + 46, cz], [cx, cz - 46], [cx, cz + 46]] as Array<[number, number]>) {
    addCylPart(dlExpMarble, 0.72, 0.85, 0.55, 6, kx, baseY + 0.28, kz);
    addCylPart(dlExpMarble, 0.36, 0.42, 4.4, 6, kx, baseY + 2.75, kz);
    addConePart(dlExpGold, 0.48, 0.95, 6, kx, baseY + 5.4, kz);
  }
  // 263 & 264: Tháp Chuông Sen (NE bell tower) & Tháp Trống Bát Nhã (NW drum pavilion)
  for (const side of [-1, 1]) {
    const tx = cx + side * 22;
    const tz = cz - 44;
    addBoxPart(dlExpMarble, 4.2, 0.55, 4.2, tx, baseY + 0.28, tz);
    for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      addCylPart(dlExpCrimson, 0.12, 0.14, 3.6, 5, tx + ox, baseY + 2.35, tz + oz);
    }
    addConePart(dlExpRoof, 3.4, 1.65, 4, tx, baseY + 4.95, tz, Math.PI * 0.25);
    addCylPart(side > 0 ? dlExpBronze : dlExpCrimson, 0.48, 0.58, 0.85, 6, tx, baseY + 2.4, tz);
  }
  // 265, 268: 8 Marble lotus meditation stools & 8 outer promenade lantern pillars with glowing pink orbs
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const sx = cx + Math.cos(a) * 50.2;
    const sz = cz + Math.sin(a) * 50.2;
    addCylPart(dlExpMarble, 0.52, 0.48, 0.36, 6, sx, baseY + 0.45, sz);
    const lx = cx + Math.cos(a) * 54.0;
    const lz = cz + Math.sin(a) * 54.0;
    addCylPart(dlExpMarble, 0.14, 0.18, 2.4, 5, lx, baseY + 1.2, lz);
    addConePart(dlExpOrb, 0.24, 0.42, 5, lx, baseY + 2.6, lz);
  }
  // 266, 267, 269, 270, 271, 272, 273: Side portals, purification basin, stepping stones, wind-chime arches, sutra tablet, incense burners & ghat curbs
  for (const side of [-1, 1]) {
    addBoxPart(dlExpMarble, 0.75, 4.6, 0.75, cx + side * 52, baseY + 2.3, cz - 2.6);
    addBoxPart(dlExpMarble, 0.75, 4.6, 0.75, cx + side * 52, baseY + 2.3, cz + 2.6);
    addBoxPart(dlExpMarble, 0.95, 0.65, 6.4, cx + side * 52, baseY + 4.8, cz);
    addCylPart(dlExpGold, 0.55, 0.55, 0.16, 6, cx + side * 52, baseY + 5.5, cz, 0, Math.PI * 0.5);
  }
  addCylPart(dlExpMarble, 1.15, 0.85, 0.72, 6, cx, baseY + 0.36, cz - 46.5);
  for (let k = 0; k < 6; k++) {
    addCylPart(dlExpMarble, 0.68, 0.72, 0.12, 6, cx + (k < 3 ? -1 : 1) * (17 + (k % 3) * 1.8), baseY + 0.08, cz + 4.2);
  }
  for (const [vx, vz] of [[-38, -38], [38, -38], [-38, 38], [38, 38]] as Array<[number, number]>) {
    addBoxPart(dlExpGold, 1.8, 0.08, 0.08, cx + vx, baseY + 3.2, cz + vz + 4.4);
    addCylPart(dlExpBronze, 0.28, 0.22, 0.55, 5, cx + vx, baseY + 0.65, cz + vz + 4.6);
  }
  addBoxPart(dlExpMarble, 16.0, 0.42, 0.28, cx, baseY + 0.35, cz + 50.8);

  // --- Wave 3 Macro Visual QC & Expansion (516–543): Meditation Cloisters, Dharma Towers & Lotus Causeway ---
  const w3DlMarble: THREE.BufferGeometry[] = [];
  const w3DlRoof: THREE.BufferGeometry[] = [];
  const w3DlCrimson: THREE.BufferGeometry[] = [];
  const w3DlGold: THREE.BufferGeometry[] = [];
  const w3DlBronze: THREE.BufferGeometry[] = [];
  const w3DlOrb: THREE.BufferGeometry[] = [];
  const w3DlWood: THREE.BufferGeometry[] = [];
  const dlMarbleMat = ctx.materials.whiteMarble ?? ctx.materials.whitePlaster;
  const dlBronzeMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  // 516–518: Eastern & western 3-bay curved meditation cloisters + 12 suspended lotus-petal lanterns
  for (const side of [-1, 1]) {
    for (let b = -1; b <= 1; b++) {
      const a = (side > 0 ? 0 : Math.PI) + b * 0.24;
      const mx = cx + Math.cos(a) * 51.2;
      const mz = cz + Math.sin(a) * 51.2;
      const ry = -a + Math.PI * 0.5;
      addW3Plinth(w3DlMarble, 9.6, 3.6, baseY + 0.42, baseY, mx, mz, ry);
      for (const lxOff of [-3.6, 0, 3.6]) {
        const px = mx + Math.cos(ry) * lxOff;
        const pz = mz - Math.sin(ry) * lxOff;
        addW3GroundedCol(w3DlCrimson, 0.11, 0.13, baseY + 3.45, baseY + 0.42, 5, px, pz);
      }
      addW3HipRoof(w3DlRoof, w3DlGold, 10.4, 4.4, baseY + 3.45, 1.05, mx, mz, ry);
      addConePart(w3DlOrb, 0.20, 0.36, 5, mx - Math.cos(a) * 1.4, baseY + 3.1, mz - Math.sin(a) * 1.4);
      addConePart(w3DlOrb, 0.20, 0.36, 5, mx + Math.cos(a) * 1.4, baseY + 3.1, mz + Math.sin(a) * 1.4);
      // 530: Timber sutra benches inside cloisters
      addBoxPart(w3DlWood, 2.2, 0.46, 0.58, mx, baseY + 0.65, mz, ry);
    }
  }
  // 519–521: Dharma bell & drum tower marble staircases + wooden bell striker log
  for (const side of [-1, 1]) {
    const tx = cx + side * 22;
    const tz = cz - 44;
    for (let st = 0; st < 3; st++) {
      addBoxPart(w3DlMarble, 2.6, 0.22, 0.68, tx, baseY + 0.11 + st * 0.18, tz + 2.4 + (2 - st) * 0.62);
    }
  }
  addCylPart(w3DlWood, 0.08, 0.08, 1.55, 5, cx + 22, baseY + 2.35, cz - 42.9, Math.PI * 0.5, 0);
  // 522–525: Causeway mid-span lotus lanterns, side-bridge marble balusters, 4 prayer-wheel alcoves & sandalwood offering tables
  for (const [lx, lz] of [[-2.4, cz - 28], [2.4, cz - 28], [-2.4, cz - 16], [2.4, cz - 16]] as Array<[number, number]>) {
    const lArchY = bridgeArchY((lz - bridgeStartZ) / bridgeLen);
    addW3GroundedCol(w3DlMarble, 0.14, 0.18, lArchY + 2.2, lArchY - 0.1, 5, cx + lx, lz);
    addConePart(w3DlOrb, 0.24, 0.42, 5, cx + lx, lArchY + 2.42, lz);
  }
  for (const side of [-1, 1]) {
    for (let p = 0; p < 5; p++) {
      const px = cx + side * (26.5 + p * 3.8);
      addW3GroundedPost(w3DlMarble, 0.16, 0.16, baseY + 1.45, baseY + 0.6, px, cz - 1.3);
      addW3GroundedPost(w3DlMarble, 0.16, 0.16, baseY + 1.45, baseY + 0.6, px, cz + 1.3);
    }
    // 525: Sandalwood offering tables seated cleanly on central Đài Sen terrace ring (r = 5.8m)
    addW3Plinth(w3DlMarble, 2.2, 1.1, baseY + 1.18, baseY, cx + side * 5.8, cz - 2.2);
    addBoxPart(w3DlGold, 2.3, 0.10, 1.18, cx + side * 5.8, baseY + 1.22, cz - 2.2);
  }
  for (const [px, pz] of [[-32, -40], [32, -40], [-32, 40], [32, 40]] as Array<[number, number]>) {
    addW3Plinth(w3DlMarble, 2.2, 1.4, baseY + 0.35, baseY, cx + px, cz + pz);
    for (const [ox, oz] of [[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.45], [0.85, 0.45]]) {
      addW3GroundedCol(w3DlCrimson, 0.08, 0.10, baseY + 1.85, baseY + 0.35, 5, cx + px + ox, cz + pz + oz);
    }
    addCylPart(w3DlGold, 0.38, 0.38, 0.95, 6, cx + px, baseY + 1.05, cz + pz);
    addW3HipRoof(w3DlRoof, null, 2.5, 1.7, baseY + 1.85, 0.55, cx + px, cz + pz);
  }
  // 526–529, 531–543: Koi curbs, bronze ash cauldrons, 8 Eightfold Path medallions, Tam Quan lotus plinths, floating alms-bowls, eaves wind-bells, drinking fountain, Dharma wheel monument, incense pillars, northern viewing balconies, 8 ceramic lotus urns, sutra canopy, bridgehead posts, island tea tables, northern moon-gate, 6 beacon stalks & scuppers
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addCylPart(w3DlGold, 0.95, 0.95, 0.08, 6, cx + Math.cos(a) * 51.5, baseY + 0.38, cz + Math.sin(a) * 51.5);
    if (i < 6) {
      const ba = (i / 6) * Math.PI * 2 + 0.3;
      addW3GroundedCol(w3DlGold, 0.07, 0.09, baseY + 1.75, baseY - 0.3, 5, cx + Math.cos(ba) * 28.0, cz + Math.sin(ba) * 28.0);
      addConePart(w3DlOrb, 0.16, 0.32, 5, cx + Math.cos(ba) * 28.0, baseY + 1.92, cz + Math.sin(ba) * 28.0);
    }
  }
  for (const side of [-1, 1]) {
    addBoxPart(w3DlMarble, 8.5, 0.35, 0.35, cx + side * 14, baseY + 0.18, cz + 50.2);
    addCylPart(w3DlBronze, 0.62, 0.48, 0.95, 6, cx + side * 8.5, baseY + 0.48, cz - 42);
    addCylPart(w3DlMarble, 0.85, 1.05, 0.92, 6, cx + side * 5.2, baseY + 0.46, cz - 44);
    addCylPart(w3DlMarble, 3.6, 3.8, 0.38, 6, cx + side * 14, baseY + 0.32, cz - 48);
    // 539 & 540: Causeway bridgehead piers & island marble tea-tables
    addW3GroundedPost(w3DlMarble, 0.65, 0.65, baseY + 1.95, baseY, cx + side * 3.8, cz + 50.0);
    addConePart(w3DlGold, 0.32, 0.45, 5, cx + side * 3.8, baseY + 2.18, cz + 50.0);
    addCylPart(w3DlMarble, 0.65, 0.55, 0.62, 6, cx + side * 23, baseY + 0.95, cz + 2.2);
    for (const uz of [-4.2, -1.8, 1.8, 4.2]) {
      addCylPart(w3DlMarble, 0.42, 0.32, 0.65, 6, cx + side * 50.5, baseY + 0.32, cz + uz);
    }
  }
  for (const [fx, fz] of [[-18, -18], [18, -18], [-18, 18], [18, 18]] as Array<[number, number]>) {
    addCylPart(w3DlMarble, 0.95, 1.1, 0.55, 6, cx + fx, baseY + 0.28, cz + fz);
    addCylPart(w3DlGold, 0.68, 0.48, 0.45, 6, cx + fx, baseY + 0.78, cz + fz);
  }
  for (const [vx, vz] of [[-38, -38], [38, -38], [-38, 38], [38, 38]] as Array<[number, number]>) {
    addConePart(w3DlGold, 0.14, 0.32, 4, cx + vx + 2.2, baseY + 3.3, cz + vz + 2.2);
  }
  // 533, 534, 538, 541: Cam Lồ fountain, Dharma wheel monument, sutra tablet canopy & northern moon-gate
  addW3Plinth(w3DlMarble, 2.2, 2.2, baseY + 0.35, baseY, cx + 6.5, cz - 46.5);
  addCylPart(w3DlMarble, 0.95, 0.72, 0.85, 6, cx + 6.5, baseY + 0.76, cz - 46.5);
  addCylPart(w3DlGold, 0.18, 0.14, 0.42, 5, cx + 6.5, baseY + 1.36, cz - 46.5);
  addBoxPart(w3DlMarble, 2.4, 0.85, 1.4, cx, baseY + 0.42, cz - 52);
  addCylPart(w3DlGold, 1.15, 1.15, 0.18, 6, cx, baseY + 2.05, cz - 52, Math.PI * 0.5, 0);
  addW3Plinth(w3DlMarble, 3.2, 2.2, baseY + 0.35, baseY, cx, cz - 44.5);
  addBoxPart(w3DlMarble, 1.6, 2.2, 0.28, cx, baseY + 1.45, cz - 44.5);
  for (const ox of [-1.0, 1.0]) addW3GroundedCol(w3DlMarble, 0.10, 0.12, baseY + 2.85, baseY + 0.35, 5, cx + ox, cz - 44.5);
  addW3HipRoof(w3DlRoof, w3DlGold, 2.8, 1.8, baseY + 2.85, 0.68, cx, cz - 44.5);
  for (const ox of [-2.4, 2.4]) addW3GroundedPost(w3DlMarble, 0.75, 0.75, baseY + 4.4, baseY, cx + ox, cz - 55.5);
  addBoxPart(w3DlMarble, 5.8, 0.75, 0.85, cx, baseY + 4.55, cz - 55.5);
  for (const [ix, iz] of [[-51, 2], [51, 2], [2, -51], [2, 51]] as Array<[number, number]>) {
    addW3GroundedCol(w3DlMarble, 0.14, 0.18, baseY + 1.25, baseY, 5, cx + ix, cz + iz);
    addCylPart(w3DlBronze, 0.18, 0.14, 0.25, 5, cx + ix, baseY + 1.38, cz + iz);
  }
  addBoxPart(w3DlMarble, 2.4, 0.24, 0.65, cx, baseY + 0.12, cz + 54.2);

  addWave3Mesh(group, w3DlMarble, dlMarbleMat);
  addWave3Mesh(group, w3DlRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w3DlCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(group, w3DlGold, ctx.materials.gold);
  addWave3Mesh(group, w3DlBronze, dlBronzeMat);
  addWave3Mesh(group, w3DlOrb, daiSenMat);
  addWave3Mesh(group, w3DlWood, ctx.materials.darkWood);

  // --- Wave 4 Macro Visual QC & Outer Expansion (916–944): Outer Bodhi Gates, Singing Bowls, Prayer Pillars & Lotus-Tea Pavilion ---
  const w4DlMarble: THREE.BufferGeometry[] = [];
  const w4DlRoof: THREE.BufferGeometry[] = [];
  const w4DlCrimson: THREE.BufferGeometry[] = [];
  const w4DlGold: THREE.BufferGeometry[] = [];
  const w4DlBronze: THREE.BufferGeometry[] = [];
  const w4DlOrb: THREE.BufferGeometry[] = [];
  const w4DlWood: THREE.BufferGeometry[] = [];
  // 916 & 917: Northern & Southern Bodhi-Leaf Lantern Archways (cz ± 62)
  for (const s of [-1, 1]) {
    const az = cz + s * 62;
    const ay = Math.max(baseY, ctx.getHeight(cx, az));
    for (const ox of [-3.4, 3.4]) addW3GroundedPost(w4DlMarble, 0.62, 0.62, ay + 4.4, ay, cx + ox, az);
    addBoxPart(w4DlMarble, 7.8, 0.58, 0.72, cx, ay + 4.4, az);
    addW3HipRoof(w4DlRoof, w4DlGold, 8.4, 2.0, ay + 4.68, 0.92, cx, az);
  }
  // 918–922: Twin outer lakeside meditation decks, 4 singing-bowl pedestals, 8 sutra prayer pillars, 12 floating candle-lotus rings & zen water-clapper
  for (const s of [-1, 1]) {
    addBoxPart(w4DlMarble, 5.4, 0.35, 8.6, cx + s * 57.5, baseY + 0.32, cz);
    addBoxPart(w4DlWood, 4.6, 0.14, 7.8, cx + s * 57.5, baseY + 0.56, cz);
  }
  for (const [dx, dz] of [[-44, -44], [44, -44], [-44, 44], [44, 44]]) {
    addW3GroundedCol(w4DlMarble, 0.24, 0.30, baseY + 1.15, baseY, 6, cx + dx, cz + dz);
    addCylPart(w4DlGold, 0.36, 0.22, 0.28, 6, cx + dx, baseY + 1.28, cz + dz);
  }
  for (let p = 0; p < 8; p++) {
    const pa = (p / 8) * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(pa) * 63.0;
    const pz = cz + Math.sin(pa) * 63.0;
    addW3GroundedCol(w4DlMarble, 0.22, 0.26, baseY + 3.2, baseY, 6, px, pz);
    addConePart(w4DlGold, 0.28, 0.42, 5, px, baseY + 3.42, pz);
  }
  for (let f = 0; f < 12; f++) {
    const fa = (f / 12) * Math.PI * 2;
    addConePart(w4DlOrb, 0.24, 0.32, 5, cx + Math.cos(fa) * 34.0, VIETNAM_WATER_LEVEL + 0.18, cz + Math.sin(fa) * 34.0);
  }
  addCylPart(w4DlMarble, 0.68, 0.75, 0.55, 6, cx + 61, baseY + 0.28, cz + 12);
  addCylPart(w4DlWood, 0.06, 0.07, 1.25, 5, cx + 61, baseY + 0.82, cz + 12, 0.45, 0);
  // 923–928: Lotus-Tea Ceremony Pavilion (west lawn), 4 white-jade incense burners, 4 shoe-rack benches, 8 lotus-bud bollards, bell pavilion (east lawn) & Bodhi shrine ring
  const tpX = cx - 64;
  const tpZ = cz + 14;
  const tpY = Math.max(baseY, ctx.getHeight(tpX, tpZ));
  addW3Plinth(w4DlMarble, 5.2, 4.6, tpY + 0.42, tpY, tpX, tpZ);
  for (const [ox, oz] of [[-2.0, -1.7], [2.0, -1.7], [-2.0, 1.7], [2.0, 1.7]]) addW3GroundedCol(w4DlCrimson, 0.10, 0.12, tpY + 2.95, tpY + 0.42, 5, tpX + ox, tpZ + oz);
  addW3HipRoof(w4DlRoof, w4DlGold, 6.0, 5.4, tpY + 2.95, 1.15, tpX, tpZ);
  for (const [ix, iz] of [[-5.5, -58], [5.5, -58], [-5.5, 58], [5.5, 58]]) addBoxPart(w4DlMarble, 0.92, 0.85, 0.92, cx + ix, baseY + 0.42, cz + iz);
  for (let b = 0; b < 4; b++) addBoxPart(w4DlWood, 2.2, 0.48, 0.62, cx + (b < 2 ? -56 : 56), baseY + 0.24, cz + (b % 2 === 0 ? -14 : 14));
  for (let b = 0; b < 8; b++) {
    const ba = (b / 8) * Math.PI * 2;
    addW3GroundedPost(w4DlMarble, 0.28, 0.28, baseY + 1.05, baseY, cx + Math.cos(ba) * 66, cz + Math.sin(ba) * 66);
    addConePart(w4DlGold, 0.18, 0.26, 4, cx + Math.cos(ba) * 66, baseY + 1.18, cz + Math.sin(ba) * 66);
  }
  const bpX = cx + 64;
  const bpZ = cz - 14;
  const bpY = Math.max(baseY, ctx.getHeight(bpX, bpZ));
  addW3Plinth(w4DlMarble, 4.2, 4.2, bpY + 0.42, bpY, bpX, bpZ);
  for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) addW3GroundedCol(w4DlCrimson, 0.10, 0.12, bpY + 3.1, bpY + 0.42, 5, bpX + ox, bpZ + oz);
  addCylPart(w4DlBronze, 0.42, 0.56, 1.05, 6, bpX, bpY + 2.05, bpZ);
  addW3HipRoof(w4DlRoof, w4DlGold, 5.0, 5.0, bpY + 3.1, 1.15, bpX, bpZ);
  addCylPart(w4DlMarble, 2.4, 2.6, 0.48, 6, cx, baseY + 0.24, cz - 68);
  // 929–944: 12 stepping stones, 6 floating oil-lamps, sutra desk, koi balcony, Dharma podium, lotus fountain, 2 alms chests, 4 wind-chime standards, 2 sutra steles, labyrinth curb, lotus skiff, 4 ash urns, 8 lanterns, 4 benches, mõ gỗ stand & bronze signpost
  for (let s = 0; s < 12; s++) addCylPart(w4DlMarble, 0.48, 0.52, 0.10, 5, tpX + 3.5 + s * 1.1, baseY + 0.05, tpZ - s * 0.8);
  for (let o = 0; o < 6; o++) {
    const oa = (o / 6) * Math.PI * 2 + 0.3;
    addW3GroundedCol(w4DlBronze, 0.06, 0.08, VIETNAM_WATER_LEVEL + 1.05, VIETNAM_WATER_LEVEL - 0.5, 5, cx + Math.cos(oa) * 28, cz + Math.sin(oa) * 28);
    addConePart(w4DlOrb, 0.18, 0.28, 4, cx + Math.cos(oa) * 28, VIETNAM_WATER_LEVEL + 1.18, cz + Math.sin(oa) * 28);
  }
  addBoxPart(w4DlWood, 1.6, 0.76, 0.72, tpX, tpY + 0.8, tpZ);
  addBoxPart(w4DlMarble, 3.6, 0.35, 2.8, cx - 48, baseY + 0.32, cz + 38);
  addCylPart(w4DlMarble, 2.6, 2.8, 0.42, 6, cx + 64, baseY + 0.21, cz + 26);
  addCylPart(w4DlGold, 1.6, 1.6, 0.08, 6, cx + 64, baseY + 0.46, cz + 26);
  addCylPart(w4DlMarble, 1.1, 0.85, 0.88, 6, cx - 8.5, baseY + 0.44, cz + 64);
  for (const s of [-1, 1]) addBoxPart(w4DlCrimson, 0.95, 0.82, 0.65, cx + s * 4.2, baseY + 0.41, cz + 56);
  for (const [wx, wz] of [[-58, -28], [58, -28], [-58, 28], [58, 28]]) addW3GroundedCol(w4DlCrimson, 0.06, 0.08, baseY + 3.4, baseY, 5, cx + wx, cz + wz);
  for (const s of [-1, 1]) addBoxPart(w4DlMarble, 1.15, 2.1, 0.28, cx + s * 6.8, baseY + 1.05, cz - 62);
  addCylPart(w4DlMarble, 3.4, 3.4, 0.14, 6, cx + 48, baseY + 0.07, cz + 48);
  addBoxPart(w4DlWood, 3.6, 0.38, 1.15, cx - 32, VIETNAM_WATER_LEVEL + 0.16, cz + 26, 0.4);
  for (let u = 0; u < 4; u++) addCylPart(w4DlBronze, 0.22, 0.18, 0.58, 5, cx + (u < 2 ? -10 : 10), baseY + 0.29, cz + (u % 2 === 0 ? -56 : 56));
  for (let l = 0; l < 8; l++) {
    const la = (l / 8) * Math.PI * 2 + 0.2;
    addW3GroundedPost(w4DlMarble, 0.26, 0.26, baseY + 1.25, baseY, cx + Math.cos(la) * 58.5, cz + Math.sin(la) * 58.5);
  }
  for (let b = 0; b < 4; b++) {
    const ba = (b / 4) * Math.PI * 2 + Math.PI * 0.25;
    addBoxPart(w4DlMarble, 2.4, 0.48, 0.68, cx + Math.cos(ba) * 60, baseY + 0.24, cz + Math.sin(ba) * 60, -ba);
  }
  addBoxPart(w4DlCrimson, 0.95, 0.72, 0.58, bpX - 3.6, bpY + 0.36, bpZ);
  addW3GroundedPost(w4DlGold, 0.22, 0.22, baseY + 2.2, baseY, cx + 8.5, cz + 66);

  addWave3Mesh(group, w4DlMarble, dlMarbleMat);
  addWave3Mesh(group, w4DlRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w4DlCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(group, w4DlGold, ctx.materials.gold);
  addWave3Mesh(group, w4DlBronze, dlBronzeMat);
  addWave3Mesh(group, w4DlOrb, daiSenMat);
  addWave3Mesh(group, w4DlWood, ctx.materials.darkWood);

  // --- Wave 5 Macro Visual QC & Heritage Details (1316–1344): E/W Bodhi Arches, 4 Outer Gazebos, Drum Pavilion & Outer Ring ---
  const w5DlMarble: THREE.BufferGeometry[] = [];
  const w5DlRoof: THREE.BufferGeometry[] = [];
  const w5DlCrimson: THREE.BufferGeometry[] = [];
  const w5DlGold: THREE.BufferGeometry[] = [];
  const w5DlBronze: THREE.BufferGeometry[] = [];
  const w5DlOrb: THREE.BufferGeometry[] = [];
  const w5DlWood: THREE.BufferGeometry[] = [];
  // 1316 & 1317: Eastern & Western Bodhi-Leaf Lantern Archways (cx ± 70, cz)
  for (const s of [-1, 1]) {
    const ax = cx + s * 70;
    const ay = Math.max(baseY, ctx.getHeight(ax, cz));
    for (const oz of [-3.4, 3.4]) addW3GroundedPost(w5DlMarble, 0.62, 0.62, ay + 4.4, ay, ax, cz + oz);
    addBoxPart(w5DlMarble, 0.72, 0.58, 7.8, ax, ay + 4.4, cz);
    addW3HipRoof(w5DlRoof, w5DlGold, 2.0, 8.4, ay + 4.68, 0.92, ax, cz);
  }
  // 1318: Four Outer-Ring Lotus Meditation Gazebos (NE/NW/SE/SW at r = 72m)
  for (const [gx, gz] of [[-51, -51], [51, -51], [-51, 51], [51, 51]]) {
    const gy = Math.max(baseY, ctx.getHeight(cx + gx, cz + gz));
    addW3Plinth(w5DlMarble, 4.4, 4.4, gy + 0.38, gy, cx + gx, cz + gz);
    for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) addW3GroundedCol(w5DlCrimson, 0.09, 0.11, gy + 2.85, gy + 0.38, 5, cx + gx + ox, cz + gz + oz);
    addW3HipRoof(w5DlRoof, w5DlGold, 5.2, 5.2, gy + 2.85, 1.05, cx + gx, cz + gz);
  }
  // 1319–1328: 12 boundary stanchions, 7-tier prayer-lamp tree, Dharma-wheel stele, SE timber bridge, ablution basin, 8 floating orbs, sutra cabinet, 4 marble vases, Zen gravel curb & Bronze Temple-Drum Pavilion
  for (let st = 0; st < 12; st++) {
    const sa = (st / 12) * Math.PI * 2 + 0.14;
    const sx = cx + Math.cos(sa) * 73.5;
    const sz = cz + Math.sin(sa) * 73.5;
    addW3GroundedPost(w5DlMarble, 0.24, 0.24, baseY + 1.15, baseY, sx, sz);
    addConePart(w5DlGold, 0.16, 0.24, 4, sx, baseY + 1.28, sz);
  }
  addBoxPart(w5DlMarble, 1.85, 0.55, 1.85, cx, baseY + 0.28, cz - 74);
  addW3GroundedCol(w5DlBronze, 0.10, 0.18, baseY + 3.4, baseY + 0.55, 5, cx, cz - 74);
  addConePart(w5DlOrb, 0.34, 0.48, 5, cx, baseY + 3.65, cz - 74);
  addCylPart(w5DlMarble, 1.35, 1.35, 0.28, 6, cx + 12, baseY + 1.55, cz - 68, Math.PI * 0.5, 0);
  addBoxPart(w5DlWood, 5.8, 0.22, 2.2, cx + 38, baseY + 0.42, cz + 56, -0.55);
  addBoxPart(w5DlMarble, 2.2, 0.68, 0.95, cx - 10, baseY + 0.34, cz + 70);
  for (let fo = 0; fo < 8; fo++) {
    const fa = (fo / 8) * Math.PI * 2 + 0.4;
    addConePart(w5DlOrb, 0.22, 0.34, 4, cx + Math.cos(fa) * 38.5, VIETNAM_WATER_LEVEL + 0.22, cz + Math.sin(fa) * 38.5);
  }
  addBoxPart(w5DlCrimson, 1.45, 1.65, 0.65, tpX - 4.8, tpY + 0.82, tpZ);
  for (const [vx, vz] of [[-66, -6.5], [-66, 6.5], [66, -6.5], [66, 6.5]]) addCylPart(w5DlMarble, 0.36, 0.28, 0.95, 6, cx + vx, baseY + 0.48, cz + vz);
  addBoxPart(w5DlMarble, 5.2, 0.22, 3.6, cx - 38, baseY + 0.11, cz - 56);
  const dpDlX = cx - 64;
  const dpDlZ = cz - 14;
  const dpDlY = Math.max(baseY, ctx.getHeight(dpDlX, dpDlZ));
  addW3Plinth(w5DlMarble, 4.2, 4.2, dpDlY + 0.42, dpDlY, dpDlX, dpDlZ);
  for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) addW3GroundedCol(w5DlCrimson, 0.10, 0.12, dpDlY + 3.1, dpDlY + 0.42, 5, dpDlX + ox, dpDlZ + oz);
  addCylPart(w5DlCrimson, 0.52, 0.52, 0.82, 6, dpDlX, dpDlY + 1.95, dpDlZ, 0, Math.PI * 0.5);
  addW3HipRoof(w5DlRoof, w5DlGold, 5.0, 5.0, dpDlY + 3.1, 1.15, dpDlX, dpDlZ);
  // 1329–1344: Parasol rack, 4 rainwater basins, 6 prayer-scroll standards, merit stele, tea table, koi steps, wind-bell pergola, 8 stone lanterns, meditation deck, 4 offering pedestals, 4 bridge bollards, cymbal stand, compass medallion, 4 wood benches, 4 cardinal finials & outer monolith
  addBoxPart(w5DlWood, 2.2, 1.05, 0.55, cx - 10, baseY + 0.52, cz - 64);
  for (const [rx, rz] of [[-42, -56], [42, -56], [-42, 56], [42, 56]]) addCylPart(w5DlMarble, 0.65, 0.48, 0.42, 6, cx + rx, baseY + 0.21, cz + rz);
  for (let ps = 0; ps < 6; ps++) {
    const pa = (ps / 6) * Math.PI * 2 + 0.5;
    const px = cx + Math.cos(pa) * 68;
    const pz = cz + Math.sin(pa) * 68;
    addW3GroundedCol(w5DlCrimson, 0.06, 0.08, baseY + 3.8, baseY, 5, px, pz);
    addBoxPart(w5DlGold, 0.55, 1.45, 0.08, px, baseY + 2.85, pz);
  }
  addBoxPart(w5DlMarble, 1.25, 2.05, 0.34, cx - 12, baseY + 1.02, cz - 68);
  addBoxPart(w5DlWood, 1.35, 0.68, 0.85, tpX + 4.8, tpY + 0.34, tpZ);
  addBoxPart(w5DlMarble, 4.2, 0.45, 2.4, cx + 48, baseY + 0.22, cz - 38);
  for (let pg = 0; pg < 4; pg++) addW3GroundedCol(w5DlCrimson, 0.09, 0.11, baseY + 3.1, baseY, 5, cx + 10.5, cz + 64 + pg * 3.0);
  addBoxPart(w5DlGold, 0.35, 0.22, 9.8, cx + 10.5, baseY + 3.1, cz + 68.5);
  for (let l = 0; l < 8; l++) {
    const la = (l / 8) * Math.PI * 2 + 0.38;
    addW3GroundedPost(w5DlMarble, 0.28, 0.28, baseY + 1.65, baseY, cx + Math.cos(la) * 69.5, cz + Math.sin(la) * 69.5);
  }
  addBoxPart(w5DlWood, 4.2, 0.26, 3.2, cx + 68, baseY + 0.13, cz + 14);
  for (let op = 0; op < 4; op++) addW3GroundedCol(w5DlBronze, 0.14, 0.18, baseY + 1.15, baseY, 5, cx - 7.5 + op * 5.0, cz - 70);
  for (let bb = 0; bb < 4; bb++) addW3GroundedPost(w5DlMarble, 0.26, 0.26, baseY + 0.95, baseY, cx + 35 + (bb % 2) * 6.0, cz + 54 + Math.floor(bb / 2) * 4.0);
  addBoxPart(w5DlCrimson, 1.15, 0.78, 0.65, bpX + 4.2, bpY + 0.39, bpZ);
  addCylPart(w5DlMarble, 2.4, 2.4, 0.08, 6, cx, baseY + 0.04, cz + 69);
  for (let wb = 0; wb < 4; wb++) {
    const wa = (wb / 4) * Math.PI * 2 + 0.35;
    addBoxPart(w5DlWood, 2.2, 0.48, 0.62, cx + Math.cos(wa) * 65, baseY + 0.24, cz + Math.sin(wa) * 65, -wa);
  }
  for (const [fx, fz] of [[0, -78], [0, 78], [-78, 0], [78, 0]]) {
    addW3GroundedCol(w5DlGold, 0.08, 0.10, baseY + 4.2, baseY, 5, cx + fx, cz + fz);
    addConePart(w5DlOrb, 0.26, 0.42, 4, cx + fx, baseY + 4.45, cz + fz);
  }
  addBoxPart(w5DlMarble, 1.65, 2.65, 0.42, cx, baseY + 1.32, cz + 74);
  addBoxPart(w5DlGold, 1.15, 1.65, 0.46, cx, baseY + 1.42, cz + 74);

  addWave3Mesh(group, w5DlMarble, dlMarbleMat);
  addWave3Mesh(group, w5DlRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w5DlCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(group, w5DlGold, ctx.materials.gold);
  addWave3Mesh(group, w5DlBronze, dlBronzeMat);
  addWave3Mesh(group, w5DlOrb, daiSenMat);
  addWave3Mesh(group, w5DlWood, ctx.materials.darkWood);

  group.add(
    new THREE.Mesh(mergeNormalized(dlExpMarble), ctx.materials.whiteMarble ?? ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(dlExpRoof), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(dlExpCrimson), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(dlExpGold), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(dlExpBronze), ctx.materials.bronzePatina ?? ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(dlExpOrb), daiSenMat),
    new THREE.Mesh(mergeNormalized(dlExpStem), padMat),
    colInst,
    baseInst,
    tvInst,
    flowerInst,
    padInst
  );
  tagMotifIds(group, ['HV-C01', 'HV-C04', 'HV-C05', 'HV-D01']);
  ctx.scene.add(group);
  return { group, daiSenMat };
}

function buildDuongLamVillageMacro(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): { group: THREE.Group; warmDoorMat: THREE.MeshStandardMaterial } {
  const cx = -640;
  const cz = -180;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 140 });
  const group = new THREE.Group();
  group.name = 'DuongLamAncientVillageMacro';
  const rand = mulberry32(66066);

  // 1. Central 26m Banyan + 2 Framing Foreground Uplit Banyan Trunks + Stone Root Steps
  const trunkParts: THREE.BufferGeometry[] = [];
  const stepParts: THREE.BufferGeometry[] = [];
  const canopyCenters: Array<[number, number, number, number]> = [];
  const anchors: Array<[number, number, number]> = [
    [cx, cz - 32, 1.45],
    [cx - 38, cz + 38, 1.25],
    [cx + 38, cz + 38, 1.25]
  ];
  for (let idx = 0; idx < anchors.length; idx++) {
    const [tx, tz, sc] = anchors[idx];
    const ty = ctx.getHeight(tx, tz);
    // FIX HV03-1: Organic flaring buttress roots + continuous CatmullRomCurve3 arching limbs & 100% attached hanging aerial roots!
    for (let t = 0; t < 8; t++) {
      const ang = (t / 8) * Math.PI * 2;
      const buttressCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(tx + Math.cos(ang) * 3.4 * sc, ty - 0.35, tz + Math.sin(ang) * 3.4 * sc),
        new THREE.Vector3(tx + Math.cos(ang) * 1.4 * sc, ty + 3.8 * sc, tz + Math.sin(ang) * 1.4 * sc),
        new THREE.Vector3(tx + Math.cos(ang) * 0.75 * sc, ty + 9.8 * sc, tz + Math.sin(ang) * 0.75 * sc)
      ]);
      trunkParts.push(new THREE.TubeGeometry(buttressCurve, 7, 0.44 * sc, 6, false));
    }
    for (let b = 0; b < 7; b++) {
      const ba = (b / 7) * Math.PI * 2 + rand() * 0.35;
      const reach = (11.5 + rand() * 4.5) * sc;
      const p0 = new THREE.Vector3(tx + Math.cos(ba) * 0.65 * sc, ty + 9.2 * sc, tz + Math.sin(ba) * 0.65 * sc);
      const p1 = new THREE.Vector3(tx + Math.cos(ba) * reach * 0.52, ty + 12.2 * sc, tz + Math.sin(ba) * reach * 0.52);
      const p2 = new THREE.Vector3(tx + Math.cos(ba) * reach, ty + 11.4 * sc, tz + Math.sin(ba) * reach);
      const limbCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      trunkParts.push(new THREE.TubeGeometry(limbCurve, 8, 0.32 * sc, 6, false));
      canopyCenters.push([p2.x, p2.y + 1.4 * sc, p2.z, 7.2 * sc]);
      // 4 Curved hanging aerial roots anchored EXACTLY onto limbCurve.getPoint(rt) and plunging -0.35m into terrain!
      for (let r = 0; r < 4; r++) {
        const rt = 0.28 + (r / 4) * 0.58 + rand() * 0.08;
        const topPt = limbCurve.getPoint(rt);
        const groundY = ctx.getHeight(topPt.x, topPt.z) - 0.35;
        const midPt = new THREE.Vector3(
          topPt.x + (rand() - 0.5) * 0.75,
          (topPt.y + groundY) * 0.5,
          topPt.z + (rand() - 0.5) * 0.75
        );
        const botPt = new THREE.Vector3(topPt.x + (rand() - 0.5) * 0.5, groundY, topPt.z + (rand() - 0.5) * 0.5);
        trunkParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([topPt, midPt, botPt]), 6, 0.052 * sc, 4, false));
      }
    }
    canopyCenters.push([tx, ty + 14.5 * sc, tz, 8.8 * sc]);
  }
  // Carved stone steps wrapping right foreground banyan base
  const rightY = ctx.getHeight(cx + 38, cz + 38);
  for (let s = 0; s < 7; s++) {
    addBoxPart(stepParts, 5.2 - s * 0.2, 0.36, 1.1, cx + 34, rightY + 0.18 + s * 0.36, cz + 38 - s * 0.75);
  }
  // FIX DL-02: Authentic weathered ash-grey ancient banyan bark (#6d6a62) — REMOVED unrealistic glowing orange fire emissive!
  const uplitBarkMat = new THREE.MeshStandardMaterial({
    color: '#6d6a62',
    map: ctx.pbr.bark.map,
    normalMap: ctx.pbr.bark.normalMap,
    roughness: 0.92
  });
  ctx.extraMaterials.push(uplitBarkMat);

  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2f5a2a',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.68
  });
  ctx.extraMaterials.push(leafMat);
  // FIX HV03-5: Multi-tone foliage depth variation on Banyan canopy (sunlit emerald / deep olive / fresh chartreuse — 0 extra tris!) + courtyard drying trays & jars
  const leafInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 1.5), leafMat, 4500);
  const banyanPalette = [new THREE.Color('#3e7a34'), new THREE.Color('#274c24'), new THREE.Color('#5a8c3c')];
  for (let i = 0; i < 4500; i++) {
    const cc = canopyCenters[i % canopyCenters.length];
    const u = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const rad = cc[3] * (0.4 + 0.6 * Math.pow(rand(), 0.4));
    const ly = cc[1] + rad * Math.cos(phi) * 0.46;
    setInstanceMatrix(
      leafInst,
      i,
      cc[0] + rad * Math.sin(phi) * Math.cos(u),
      ly,
      cc[2] + rad * Math.sin(phi) * Math.sin(u),
      (rand() - 0.5) * 1.4,
      rand() * 6.28,
      (rand() - 0.5) * 1.4,
      1,
      1,
      1
    );
    leafInst.setColorAt(i, banyanPalette[ly > cc[1] + 1.2 ? 2 : i % 3 === 0 ? 0 : 1]);
  }
  leafInst.instanceMatrix.needsUpdate = true;
  if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;

  // 2. Laterite (Đá Ong Tổ Ong) Compound Walls, Authentic Folk Cổng Làng Mông Phụ, Sân Đình Bát Tràng, Hollow Giếng Cổ & Chum Tương
  const latParts: THREE.BufferGeometry[] = [];
  const plasterParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const winParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const urnParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const baseY = ctx.getHeight(cx, cz);

  for (const sx of [-42, 42]) {
    addBoxPart(latParts, 0.6, 2.2, 68, cx + sx, baseY + 1.1, cz);
    // Side Cổng Làng Gateway with wooden grill bars & folk gable roof
    addBoxPart(latParts, 1.2, 4.0, 1.2, cx + sx, baseY + 2.0, cz + 26);
    addBoxPart(latParts, 1.2, 4.0, 1.2, cx + sx, baseY + 2.0, cz + 31);
    for (let bar = 0; bar < 5; bar++) {
      addCylPart(woodParts, 0.06, 0.06, 3.0, 6, cx + sx, baseY + 1.6, cz + 27 + bar * 0.75);
    }
    const gr = createGableRoofGeometry(2.8, 6.8, 1.55, 0.14, 'z');
    gr.translate(cx + sx, baseY + 4.0, cz + 28.5);
    roofParts.push(gr);
  }

  // FIX R34: Cổng Làng Mông Phụ matching 13_lang_co_duong_lam.jpg — single-tier folk 2-slope pitched roof flanked by 2 stepped mossy grey-plaster gable walls (*bít đốc*) — NO 2-tier palace roof or golden dragons!
  const gateZ = cz + 34;
  const gateY = ctx.getHeight(cx, gateZ);
  // Arched laterite folk portal (8.4m wide × 4.6m tall)
  const gatePortalArch = createArchedWallGeometry(8.4, 4.6, 1.85, 3.4, 3.45);
  gatePortalArch.translate(cx, gateY, gateZ);
  latParts.push(gatePortalArch);
  // Two heavy weathered wooden entrance doors slightly ajar + horizontal locking bar
  addBoxPart(woodParts, 1.55, 3.35, 0.20, cx - 1.52, gateY + 1.68, gateZ - 0.18, 0.24);
  addBoxPart(woodParts, 1.55, 3.35, 0.20, cx + 1.52, gateY + 1.68, gateZ - 0.18, -0.24);
  addBoxPart(woodParts, 3.4, 0.20, 0.16, cx, gateY + 1.85, gateZ + 0.18);
  // Single-tier folk 2-slope pitched gable roof (*mái 2 dốc ngói mũi hài rêu*)
  const gateFolkRoof = createGableRoofGeometry(9.0, 4.8, 2.35, 0.18, 'x');
  gateFolkRoof.translate(cx, gateY + 4.58, gateZ);
  roofParts.push(gateFolkRoof);
  // 2 Stepped mossy grey-plaster gable walls (*tường hồi bít đốc*) flanking left & right ends of the pitched roof
  for (const endSide of [-1, 1]) {
    const gx = cx + endSide * 4.45;
    addBoxPart(plasterParts, 0.42, 0.95, 5.2, gx, gateY + 4.95, gateZ);
    addBoxPart(plasterParts, 0.42, 0.95, 3.7, gx, gateY + 5.75, gateZ);
    addBoxPart(plasterParts, 0.42, 0.85, 2.2, gx, gateY + 6.45, gateZ);
    addBoxPart(plasterParts, 0.44, 0.48, 0.95, gx, gateY + 7.02, gateZ);
    // Mossy plaster capping ledges on each step
    addBoxPart(plasterParts, 0.56, 0.12, 5.4, gx, gateY + 5.42, gateZ);
    addBoxPart(plasterParts, 0.56, 0.12, 3.9, gx, gateY + 6.22, gateZ);
  }
  // Weathered stone "MÔNG PHỤ" plaque above arch
  const mongPhuPlaque = createSignagePlaqueMesh(
    { text: 'MÔNG PHỤ', subText: 'LÀNG CỔ ĐƯỜNG LÂM', width: 2.6, height: 0.72, depth: 0.14, style: 'stone' },
    ctx
  );
  mongPhuPlaque.position.set(cx, gateY + 4.02, gateZ + 0.96);
  group.add(mongPhuPlaque);

  // 2.15 FIX DL-03: Crescent Village Pond (*Ao Làng*) shifted cleanly to the East flank (cx + 22)
  //      leaving the brick-paved village road running unobstructed straight through Cổng Làng Mông Phụ!
  const pondX = cx + 22.0;
  const pondZ = gateZ + 14.5;
  const pondY = ctx.getHeight(pondX, pondZ) + 0.05;
  const crescentShape = new THREE.Shape();
  crescentShape.absarc(0, 0, 14.5, -0.15, Math.PI + 0.15, false);
  crescentShape.quadraticCurveTo(0, 3.6, 14.5 * Math.cos(-0.15), 14.5 * Math.sin(-0.15));
  const pondGeo = new THREE.ShapeGeometry(crescentShape, 20);
  pondGeo.rotateX(-Math.PI * 0.5);
  const pondMat = new THREE.MeshStandardMaterial({
    color: '#255a4e',
    roughness: 0.16,
    metalness: 0.22,
    transparent: true,
    opacity: 0.90
  });
  const pondPadMat = new THREE.MeshStandardMaterial({ color: '#3f7236', roughness: 0.6, side: THREE.DoubleSide });
  ctx.extraMaterials.push(pondMat, pondPadMat);
  const pondMesh = new THREE.Mesh(pondGeo, pondMat);
  pondMesh.position.set(pondX, pondY, pondZ + 6.5);
  group.add(pondMesh);
  // Laterite pond rim curb stones & floating peltate lotus pads
  const aoPadParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    const rx = pondX + Math.cos(a) * 14.8;
    const rz = pondZ + 6.5 - Math.sin(a) * 14.8;
    addBoxPart(latParts, 2.2, 0.42, 0.72, rx, pondY + 0.14, rz, a - Math.PI * 0.5);
  }
  for (let lp = 0; lp < 16; lp++) {
    const a = 0.2 + rand() * (Math.PI - 0.4);
    const rr = 5.5 + rand() * 7.2;
    const pad = createNotchedLotusPadGeometry(0.42 + rand() * 0.2, 12);
    pad.rotateY(rand() * Math.PI * 2);
    pad.translate(pondX + Math.cos(a) * rr, pondY + 0.04, pondZ + 6.5 - Math.sin(a) * rr);
    aoPadParts.push(pad);
  }
  if (aoPadParts.length > 0) group.add(new THREE.Mesh(mergeNormalized(aoPadParts), pondPadMat));
  // Unobstructed village approach road & low laterite root curb flanking the entrance to Cổng Làng Mông Phụ
  addBoxPart(brickParts, 5.4, 0.14, 24.0, cx, gateY + 0.06, gateZ + 12.0);
  addBoxPart(latParts, 0.36, 0.48, 18.0, cx - 3.1, gateY + 0.24, gateZ + 11.0);

  // 2.18 Đình Mông Phụ (1684) facing Bát Tràng brick courtyard at (-640, -206): 5-bay elevated timber communal house + Authentic Nghi Môn + Tả/Hữu Mạc
  const dinhX = -640;
  const dinhZ = -206;
  const dinhY = ctx.getHeight(dinhX, dinhZ);
  // Stepped brick & laterite foundation platform + front staircase facing +Z courtyard
  addBoxPart(brickParts, 25.4, 0.95, 15.4, dinhX, dinhY + 0.48, dinhZ);
  addBoxPart(latParts, 24.4, 0.45, 14.4, dinhX, dinhY + 1.15, dinhZ);
  for (let st = 0; st < 5; st++) {
    addBoxPart(stepParts, 5.4, 0.28, 0.72, dinhX, dinhY + 0.14 + st * 0.26, dinhZ + 7.6 + (4 - st) * 0.62);
  }
  // Elevated stilt-timber floor deck (iconic 1684 Đình Mông Phụ wooden floor) & perimeter verandah balustrade
  const dinhFloorY = dinhY + 2.05;
  addBoxPart(woodParts, 24.0, 0.32, 14.0, dinhX, dinhFloorY, dinhZ);
  for (let ix = -5; ix <= 5; ix++) {
    for (const iz of [-6.2, -2.2, 2.2, 6.2]) {
      addCylPart(woodParts, 0.18, 0.22, 0.85, 8, dinhX + ix * 2.25, dinhY + 1.62, dinhZ + iz);
    }
  }
  // Open wooden front colonnade (5 bays = 6 column rows × 4 depth rows) — TRIMMED cleanly below roof slope so ZERO columns pierce roof!
  for (let ix = 0; ix < 6; ix++) {
    const colX = dinhX - 10.5 + ix * 4.2;
    for (let iz = 0; iz < 4; iz++) {
      const colZ = dinhZ - 5.4 + iz * 3.6;
      const isMain = iz === 1 || iz === 2;
      // Outer columns 3.55m, inner main columns 4.25m (cleanly inside roof envelope starting at dinhFloorY + 3.82!)
      const colH = isMain ? 4.25 : 3.55;
      const colR = isMain ? 0.28 : 0.21;
      addCylPart(woodParts, colR * 0.92, colR, colH, 10, colX, dinhFloorY + colH * 0.5, colZ);
      addCylPart(stepParts, colR * 1.45, colR * 1.65, 0.22, 8, colX, dinhFloorY + 0.22, colZ);
    }
    // Transverse carved tie beams (*xà ngang / kẻ truyền*)
    addBoxPart(woodParts, 0.26, 0.32, 11.4, colX, dinhFloorY + 3.62, dinhZ);
  }
  // Rear & side timber plank walls + central recessed warm sanctuary altar (*khám thờ*)
  addBoxPart(woodParts, 23.6, 3.65, 0.28, dinhX, dinhFloorY + 1.85, dinhZ - 6.6);
  addBoxPart(woodParts, 0.28, 3.65, 11.2, dinhX - 11.8, dinhFloorY + 1.85, dinhZ - 1.0);
  addBoxPart(woodParts, 0.28, 3.65, 11.2, dinhX + 11.8, dinhFloorY + 1.85, dinhZ - 1.0);
  addBoxPart(goldParts, 4.6, 1.35, 1.4, dinhX, dinhFloorY + 0.85, dinhZ - 4.8);
  addBoxPart(winParts, 2.2, 1.25, 0.18, dinhX, dinhFloorY + 2.35, dinhZ - 5.2);
  // EXPANSION (ref 116_dinh_co_bac_bo_ket_cau_vi_keo.jpg):
  // Walk-in Đình Mông Phụ interior timber truss brackets (*kẻ hiên, bẩy hậu, đầu dư chạm rồng*), elevated communal sitting platforms (*sập đình*), gilded Kiệu Bát Cống palanquin & Trống Đình
  for (let ix = 0; ix < 6; ix++) {
    const colX = dinhX - 10.5 + ix * 4.2;
    // Upper king-post tie beam (*câu đầu & trụ trốn*) + dragon-head corbels (*đầu dư*)
    addBoxPart(woodParts, 0.28, 0.34, 5.2, colX, dinhFloorY + 4.15, dinhZ);
    addCylPart(woodParts, 0.16, 0.18, 1.15, 8, colX, dinhFloorY + 4.75, dinhZ);
    addBoxPart(goldParts, 0.32, 0.28, 0.65, colX, dinhFloorY + 3.45, dinhZ + 1.55);
    addBoxPart(goldParts, 0.32, 0.28, 0.65, colX, dinhFloorY + 3.45, dinhZ - 1.55);
  }
  // Left & right elevated wooden communal sitting platforms (*sập gỗ gian bên*)
  for (const side of [-1, 1]) {
    addBoxPart(woodParts, 7.2, 0.42, 4.6, dinhX + side * 6.8, dinhFloorY + 0.38, dinhZ - 0.6);
  }
  // Gilded Kiệu Bát Cống ceremonial palanquin & pair of golden altar cranes (*Hạc thờ*) + communal Trống Đình drum
  addBoxPart(goldParts, 3.6, 0.14, 1.35, dinhX - 4.2, dinhFloorY + 0.72, dinhZ + 2.2);
  addBoxPart(goldParts, 1.35, 1.25, 1.15, dinhX - 4.2, dinhFloorY + 1.42, dinhZ + 2.2);
  for (const hx of [-2.6, 2.6]) {
    addCylPart(goldParts, 0.08, 0.16, 1.75, 7, dinhX + hx, dinhFloorY + 1.05, dinhZ - 3.6);
  }
  const dinhDrum = new THREE.CylinderGeometry(0.58, 0.48, 1.05, 10);
  dinhDrum.rotateZ(Math.PI * 0.5);
  dinhDrum.translate(dinhX + 4.2, dinhFloorY + 1.25, dinhZ + 2.2);
  woodParts.push(dinhDrum);
  addBoxPart(woodParts, 1.35, 0.85, 0.95, dinhX + 4.2, dinhFloorY + 0.58, dinhZ + 2.2);
  // Verandah balustrade on open front wings
  woodParts.push(
    ...createPiercedBalustradeParts(dinhX - 11.6, dinhZ + 6.7, dinhX - 2.9, dinhZ + 6.7, dinhFloorY + 0.16, 0.82, 'con_tien'),
    ...createPiercedBalustradeParts(dinhX + 2.9, dinhZ + 6.7, dinhX + 11.6, dinhZ + 6.7, dinhFloorY + 0.16, 0.82, 'con_tien')
  );
  // Sweeping 4-corner curved Vietnamese communal house roof (true wide-ridge hip roof so 14.4m dinhFinial seats with 0.0m air gap!)
  const dinhRoof = createHueImperialHipRoofGeometry(27.8, 17.8, 14.8, 1.8, 4.65, 1.08);
  dinhRoof.translate(dinhX, dinhFloorY + 3.82, dinhZ);
  roofParts.push(dinhRoof);
  const dinhFinial = createRoofFinialSetParts(dinhX, dinhFloorY + 8.43, dinhZ, 14.4, 0, 1.05, true);
  plasterParts.push(...dinhFinial.mainParts, ...dinhFinial.goldParts);
  const dinhPlaque = createSignagePlaqueMesh(
    { text: 'ĐÌNH MÔNG PHỤ', subText: '1684 · XỨ ĐOÀI', width: 3.6, height: 0.92, depth: 0.18, style: 'royal' },
    ctx
  );
  dinhPlaque.position.set(dinhX, dinhFloorY + 3.35, dinhZ + 6.45);
  group.add(dinhPlaque);
  // P0/P1 Đình Mông Phụ Motif Upgrades (`HV-D12`, `HV-A07`, `HV-NEW-MB-05`, `HV-NEW-MB-12`)
  goldParts.push(...createCuaVongParts(dinhX, dinhFloorY + 3.25, dinhZ - 2.6, 3.8, 0.86, 0, 'long_phung'));
  stepParts.push(
    ...createAncientStoneLanternParts(dinhX - 4.2, dinhY, dinhZ + 12.2, 0.92),
    ...createAncientStoneLanternParts(dinhX + 4.2, dinhY, dinhZ + 12.2, 0.92)
  );
  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-A07', 'HV-B04', 'HV-B06', 'HV-C03', 'HV-C11',
    'HV-D10', 'HV-D12', 'HV-D13', 'HV-I01', 'HV-NEW-MB-02', 'HV-NEW-MB-03',
    'HV-NEW-MB-05', 'HV-NEW-MB-12'
  ]);

  // 2 Low Flanking *Tả Mạc / Hữu Mạc* Courtyard Pavilions framing the Bát Tràng brick courtyard
  for (const side of [-1, 1]) {
    const macX = dinhX + side * 19.2;
    const macZ = dinhZ + 9.5;
    const macY = ctx.getHeight(macX, macZ);
    addBoxPart(brickParts, 5.2, 0.42, 13.8, macX, macY + 0.21, macZ);
    // Laterite back wall + gable end walls
    addBoxPart(latParts, 0.36, 2.85, 13.0, macX + side * 2.15, macY + 1.82, macZ);
    addBoxPart(latParts, 4.6, 2.85, 0.36, macX, macY + 1.82, macZ - 6.4);
    addBoxPart(latParts, 4.6, 2.85, 0.36, macX, macY + 1.82, macZ + 6.4);
    // Open courtyard-facing dark ironwood colonnade (4 bays)
    for (let c = 0; c < 5; c++) {
      addCylPart(woodParts, 0.13, 0.15, 2.85, 7, macX - side * 2.05, macY + 1.82, macZ - 6.0 + c * 3.0);
    }
    const macRoof = createGableRoofGeometry(5.6, 14.4, 1.75, 0.14, 'z');
    macRoof.translate(macX, macY + 3.22, macZ);
    roofParts.push(macRoof);
  }

  // FIX R34: Authentic Nghi Môn Đình Mông Phụ (ref 69_nha_co_duong_lam_da_ong.jpg): mossy grey-white plaster, Nghê ONLY on 2 taller inner pillars, open 4-sided lantern boxes + lotus buds on 2 shorter outer pillars, 2 lintel side portals (*cổng nách*) + pierced laterite screen walls!
  const nghiMonZ = dinhZ + 16.5;
  const nghiMonBaseY = ctx.getHeight(dinhX, nghiMonZ);
  for (const [nxOff, nh, isInner] of [
    [-7.2, 3.85, false],
    [-3.1, 5.05, true],
    [3.1, 5.05, true],
    [7.2, 3.85, false]
  ] as Array<[number, number, boolean]>) {
    const px = dinhX + nxOff;
    const py = nghiMonBaseY;
    addBoxPart(plasterParts, 1.28, 0.45, 1.28, px, py + 0.22, nghiMonZ);
    addBoxPart(plasterParts, 0.82, nh, 0.82, px, py + 0.45 + nh * 0.5, nghiMonZ);
    addBoxPart(plasterParts, 1.12, 0.24, 1.12, px, py + 0.45 + nh + 0.12, nghiMonZ);
    const capTopY = py + 0.45 + nh + 0.24;
    if (isInner) {
      // Sculpted Nghê guardian beast ONLY on the 2 taller inner pillars!
      plasterParts.push(...createGuardianBeastParts(px, capTopY, nghiMonZ, 0, 0.82, 'nghe'));
    } else {
      // Open 4-sided lantern box (*ô lồng đèn rỗng 4 mặt*) + sculpted lotus bud (*búp sen*) on the 2 shorter outer pillars!
      const boxH = 0.72;
      for (const sx of [-0.30, 0.30]) {
        for (const sz of [-0.30, 0.30]) {
          addBoxPart(plasterParts, 0.11, boxH, 0.11, px + sx, capTopY + boxH * 0.5, nghiMonZ + sz);
        }
      }
      addBoxPart(plasterParts, 0.96, 0.18, 0.96, px, capTopY + boxH + 0.09, nghiMonZ);
      // Lotus bud crown (*búp sen*)
      const budBase = new THREE.CylinderGeometry(0.28, 0.36, 0.22, 8);
      budBase.translate(px, capTopY + boxH + 0.28, nghiMonZ);
      const budTip = new THREE.ConeGeometry(0.24, 0.58, 8);
      budTip.translate(px, capTopY + boxH + 0.66, nghiMonZ);
      plasterParts.push(budBase, budTip);
    }
  }
  // FIX DL-04: Flat mossy plaster side-portal lintels (NO pitched roofs on side portals — ref 69!),
  // lower pierced laterite lattice walls (1.25m) & 2 dark-green cypresses (*cây tùng tháp*, 5.5m) flanking Nghi Môn!
  const cypressParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const midX = dinhX + side * 5.15;
    // Flat stepped weathered plaster cornice over each side gate (*trán cổng nách phẳng*)
    addBoxPart(plasterParts, 3.6, 0.72, 0.76, midX, nghiMonBaseY + 3.15, nghiMonZ);
    addBoxPart(plasterParts, 3.85, 0.16, 0.94, midX, nghiMonBaseY + 3.58, nghiMonZ);
    addBoxPart(plasterParts, 3.45, 0.14, 0.84, midX, nghiMonBaseY + 3.72, nghiMonZ);
    // Lower pierced laterite screen wall (1.25m tall) extending outside each outer pillar
    const wallStartX = dinhX + side * 7.8;
    const wallEndX = dinhX + side * 14.8;
    latParts.push(
      ...createPiercedBalustradeParts(wallStartX, nghiMonZ, wallEndX, nghiMonZ, nghiMonBaseY, 1.25, 'lotus_stone')
    );
    // Flanking conical cypress tree (*cây tùng tháp*) standing directly behind each laterite wing wall (ref 69)
    const cyX = dinhX + side * 9.6;
    const cyZ = nghiMonZ - 1.65;
    addCylPart(woodParts, 0.14, 0.22, 1.8, 6, cyX, nghiMonBaseY + 0.9, cyZ);
    for (let t = 0; t < 4; t++) {
      const cone = new THREE.ConeGeometry(1.18 - t * 0.22, 1.85, 8);
      cone.translate(cyX, nghiMonBaseY + 2.0 + t * 1.15, cyZ);
      cypressParts.push(cone);
    }
  }
  const cypressMat = new THREE.MeshStandardMaterial({ color: '#1e4a1f', roughness: 0.82 });
  ctx.extraMaterials.push(cypressMat);
  group.add(new THREE.Mesh(mergeNormalized(cypressParts), cypressMat));

  // 2.2 Sân Đình Mông Phụ Lát Gạch Nghiêng Bát Tràng (Traditional Herringbone Red Brick Courtyard)
  addBoxPart(brickParts, 46.0, 0.18, 44.0, cx, baseY + 0.09, cz - 10);

  // Tea-stall bamboo bench (*chõng tre quán nước chè xanh*) beneath the hero banyan
  const teaX = cx - 8.5;
  const teaZ = cz - 23.5;
  const teaY = ctx.getHeight(teaX, teaZ);
  addBoxPart(woodParts, 2.6, 0.12, 1.25, teaX, teaY + 0.56, teaZ, 0.18);
  for (const [bx, bz] of [[-1.1, -0.48], [1.1, -0.48], [-1.1, 0.48], [1.1, 0.48]]) {
    addCylPart(woodParts, 0.045, 0.055, 0.56, 6, teaX + bx, teaY + 0.28, teaZ + bz);
  }
  addCylPart(urnParts, 0.14, 0.18, 0.26, 8, teaX - 0.3, teaY + 0.75, teaZ); // clay teapot
  addCylPart(urnParts, 0.07, 0.05, 0.09, 7, teaX + 0.15, teaY + 0.66, teaZ + 0.12); // tea bowl
  addCylPart(urnParts, 0.07, 0.05, 0.09, 7, teaX + 0.42, teaY + 0.66, teaZ - 0.08); // tea bowl
  addCylPart(woodParts, 0.05, 0.06, 2.35, 6, teaX - 1.35, teaY + 1.18, teaZ - 0.72);
  addCylPart(woodParts, 0.05, 0.06, 2.15, 6, teaX + 1.35, teaY + 1.08, teaZ - 0.72);
  addBoxPart(woodParts, 3.4, 0.08, 2.2, teaX, teaY + 2.25, teaZ - 0.1, 0.18, 0.22, 0);

  // 2.3 Hollow Giếng Cổ Đá Ong Đường Lâm (Hollow Laterite Masonry Ring + Dark Reflective Water Inside + Pulley Rope & Wooden Bucket)
  const wellX = cx + 14;
  const wellZ = cz - 4;
  const wellY = ctx.getHeight(wellX, wellZ);
  const wellOuterShape = new THREE.Shape();
  wellOuterShape.absarc(0, 0, 1.62, 0, Math.PI * 2, false);
  const wellInnerHole = new THREE.Path();
  wellInnerHole.absarc(0, 0, 1.18, 0, Math.PI * 2, true);
  wellOuterShape.holes.push(wellInnerHole);
  const wellRingGeo = new THREE.ExtrudeGeometry(wellOuterShape, { depth: 0.96, bevelEnabled: false, curveSegments: 18 });
  wellRingGeo.rotateX(-Math.PI * 0.5);
  wellRingGeo.translate(wellX, wellY, wellZ);
  latParts.push(wellRingGeo);
  // Dark reflective water surface sunken inside the hollow well
  const wellWaterMat = new THREE.MeshStandardMaterial({
    color: '#102826',
    roughness: 0.08,
    metalness: 0.45
  });
  ctx.extraMaterials.push(wellWaterMat);
  const wellWaterDisc = new THREE.Mesh(new THREE.CircleGeometry(1.18, 18).rotateX(-Math.PI * 0.5), wellWaterMat);
  wellWaterDisc.position.set(wellX, wellY + 0.24, wellZ);
  group.add(wellWaterDisc);

  addCylPart(brickParts, 2.65, 2.75, 0.18, 8, wellX, wellY + 0.09, wellZ);
  addCylPart(woodParts, 0.08, 0.08, 2.6, 6, wellX - 1.1, wellY + 1.3, wellZ);
  addCylPart(woodParts, 0.08, 0.08, 2.6, 6, wellX + 1.1, wellY + 1.3, wellZ);
  addBoxPart(woodParts, 2.4, 0.14, 0.14, wellX, wellY + 2.55, wellZ);
  addCylPart(woodParts, 0.16, 0.16, 0.12, 10, wellX, wellY + 2.35, wellZ);
  // Hanging pulley rope & wooden water bucket suspended over the hollow well
  addCylPart(woodParts, 0.022, 0.022, 1.38, 5, wellX, wellY + 1.62, wellZ);
  addCylPart(woodParts, 0.24, 0.19, 0.36, 10, wellX, wellY + 0.96, wellZ);

  // 2.4 Dãy Chum Gốm Phơi Tương Nếp Đường Lâm (Glazed Earthenware Jars Curing Soy Sauce)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 12; c++) {
      const jx = cx - 14.5 + r * 2.2;
      const jz = cz - 26 + c * 2.4;
      const jy = ctx.getHeight(jx, jz) + 0.12;
      addCylPart(urnParts, 0.38, 0.28, 0.82, 10, jx, jy + 0.41, jz);
      addCylPart(urnParts, 0.14, 0.36, 0.16, 10, jx, jy + 0.90, jz);
    }
  }

  // Grounded Bamboo Resting Frame (*chõng tre*) + FIX HV03-5: woven bamboo rice-drying trays (*nong phơi*) & ceramic courtyard jars under banyan!
  const restX = cx - 18;
  const restZ = cz + 4;
  const restY = ctx.getHeight(restX, restZ);
  addBoxPart(woodParts, 6.4, 0.14, 4.2, restX, restY + 1.15, restZ);
  for (const [tx, tz] of [[cx - 10, cz + 12], [cx - 7.5, cz + 13.5], [cx + 12, cz + 14]]) {
    const ty = ctx.getHeight(tx, tz);
    addCylPart(goldParts, 1.05, 1.02, 0.08, 10, tx, ty + 0.16, tz);
    addCylPart(woodParts, 0.85, 0.85, 0.14, 8, tx, ty + 0.07, tz);
  }
  for (const lx of [-2.95, 0.0, 2.95]) {
    for (const lz of [-1.85, 1.85]) {
      addCylPart(woodParts, 0.06, 0.07, 1.22, 6, restX + lx, restY + 0.56, restZ + lz);
    }
  }
  addBoxPart(woodParts, 6.0, 0.09, 0.09, restX, restY + 0.42, restZ - 1.85);
  addBoxPart(woodParts, 6.0, 0.09, 0.09, restX, restY + 0.42, restZ + 1.85);

  // 8 Ancient Laterite Đường Lâm Houses with Folk 2-Slope Gable Roofs (*bít đốc*) & Wooden Verandah Eaves
  const houseCoords: Array<[number, number, number]> = [
    [cx - 26, cz - 14, 0.3], [cx - 28, cz + 8, 1.2], [cx + 26, cz - 14, -0.3], [cx + 28, cz + 8, -1.2],
    [cx - 32, cz - 38, 0.15], [cx + 32, cz - 38, -0.15], [cx - 18, cz - 52, 0.0], [cx + 18, cz - 52, 0.0]
  ];
  // FIX DL-01: 8 Authentic 3-Bay Laterite Đường Lâm Ancient Houses with Triangular *Bít Đốc* Gables (ZERO roof clipping!),
  // Recessed Veranda with 4 Wooden Columns & Dark-Wood *Cửa Bức Bàn* Doors (NO neon orange daytime boxes!)
  const houseGableShape = new THREE.Shape();
  houseGableShape.moveTo(-2.85, 0);
  houseGableShape.lineTo(2.85, 0);
  houseGableShape.lineTo(0, 2.22);
  houseGableShape.closePath();
  for (const [hx, hz, ry] of houseCoords) {
    const hy = ctx.getHeight(hx, hz);
    const body = new THREE.BoxGeometry(10.5, 3.4, 4.4);
    body.translate(0, 1.7, -0.6);
    body.rotateY(ry);
    body.translate(hx, hy, hz);
    latParts.push(body);
    // 4 Timber verandah columns framing recessed front porch (embedded -0.08m into ground, flush into roof eave!)
    for (const vx of [-4.4, -1.6, 1.6, 4.4]) {
      const col = new THREE.CylinderGeometry(0.13, 0.15, 3.45, 7);
      col.translate(vx, 1.65, 2.55);
      col.rotateY(ry);
      col.translate(hx, hy, hz);
      woodParts.push(col);
    }
    const hr = createGableRoofGeometry(11.4, 6.8, 2.35, 0.16, 'x');
    hr.rotateY(ry);
    hr.translate(hx, hy + 3.30, hz);
    roofParts.push(hr);
    // True triangular plaster gable infill fitting cleanly inside the sloped roof (ZERO rectangular corners piercing roof!)
    for (const endS of [-1, 1]) {
      const gTri = new THREE.ExtrudeGeometry(houseGableShape, { depth: 0.24, bevelEnabled: false });
      gTri.rotateY(Math.PI * 0.5);
      gTri.translate(endS * 5.22 - 0.12, 3.38, 0);
      gTri.rotateY(ry);
      gTri.translate(hx, hy, hz);
      plasterParts.push(gTri);
    }
    // 3-Bay traditional wooden *Cửa Bức Bàn* panels recessed under the porch (center bay ajar to reveal interior *Bàn thờ gia tiên & Sập gụ tủ chè*)
    for (const dx of [-3.0, 3.0]) {
      const door = new THREE.BoxGeometry(2.1, 2.25, 0.14);
      door.translate(dx, 1.15, 1.64);
      door.rotateY(ry);
      door.translate(hx, hy, hz);
      winParts.push(door);
    }
    const altar = new THREE.BoxGeometry(1.95, 1.18, 0.78);
    altar.translate(0, 0.65, -1.25);
    altar.rotateY(ry);
    altar.translate(hx, hy, hz);
    goldParts.push(altar);
    const sapGu = new THREE.BoxGeometry(2.2, 0.52, 1.45);
    sapGu.translate(-2.4, 0.32, -0.25);
    sapGu.rotateY(ry);
    sapGu.translate(hx, hy, hz);
    woodParts.push(sapGu);
  }

  // Reuse shared PBR lateriteHoneycomb, batTrangFloor & agedPlaster materials (with applyWorldBoxUV!)
  const lateriteMat = ctx.materials.lateriteHoneycomb ?? ctx.materials.stone;
  const plasterMat = ctx.materials.agedPlaster ?? ctx.materials.mossyPlaster ?? ctx.materials.whitePlaster;
  const brickMat = ctx.materials.batTrangFloor ?? ctx.materials.terracottaRoof;
  const warmDoorMat = new THREE.MeshStandardMaterial({
    color: '#4c3222',
    emissive: new THREE.Color('#3a1c0a'),
    emissiveIntensity: 0.15,
    roughness: 0.84
  });
  warmDoorMat.userData.noDedupe = true;
  const urnMat = new THREE.MeshStandardMaterial({
    color: '#4a2713',
    roughness: 0.34,
    metalness: 0.08
  });
  ctx.extraMaterials.push(warmDoorMat, urnMat);

  // 450 Animated Floating & Blinking Nocturnal Fireflies
  const ffUni = { uTime: { value: 0.0 } };
  registerAnimUniform(ctx, animList, ffUni);
  const ffMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ffUni.uTime
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vBlink;
      void main() {
        vec3 instPos = vec3(0.0);
        #ifdef USE_INSTANCING
        instPos = vec3(instanceMatrix[3].xyz);
        #endif
        float phase = instPos.x * 0.37 + instPos.z * 0.53 + instPos.y * 1.17;
        vec3 drift = vec3(
          sin(uTime * 0.85 + phase) * 0.68,
          sin(uTime * 1.25 + phase * 1.7) * 0.48,
          cos(uTime * 0.78 + phase * 1.3) * 0.68
        );
        float pulse = 0.5 + 0.5 * sin(uTime * 2.8 + phase * 3.1);
        vBlink = 0.18 + 0.82 * pulse * pulse;
        vec3 localPos = position * (0.7 + 0.55 * vBlink);
        vec4 mvPos = vec4(localPos, 1.0);
        #ifdef USE_INSTANCING
        mvPos = instanceMatrix * mvPos;
        #endif
        mvPos.xyz += drift;
        gl_Position = projectionMatrix * modelViewMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vBlink;
      void main() {
        vec3 col = mix(vec3(0.68, 0.92, 0.28), vec3(0.96, 1.0, 0.58), vBlink);
        gl_FragColor = vec4(col * (0.75 + 0.85 * vBlink), 0.25 + 0.75 * vBlink);
      }
    `
  });
  ctx.extraMaterials.push(ffMat);
  const ffInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 5, 4), ffMat, 450);
  for (let i = 0; i < 450; i++) {
    setInstanceMatrix(ffInst, i, cx + (rand() - 0.5) * 95, baseY + 0.8 + rand() * 11.0, cz + (rand() - 0.5) * 95, 0, 0, 0, 1, 1, 1);
  }
  ffInst.instanceMatrix.needsUpdate = true;

  // --- 200-Item Macro Visual QC & Expansion (074–088): Làng Cổ Đường Lâm ---
  // 074 & 082 & 087: 4 additional 3-bay laterite houses (cleanly outside cx ± 42 village wall!), mossy ridge caps & brick-paved side alleys
  for (const [hx, hz, ry] of [
    [cx - 50, cz - 18, 0.25], [cx + 50, cz - 18, -0.25],
    [cx - 44, cz - 46, 0.1], [cx + 44, cz - 46, -0.1]
  ] as Array<[number, number, number]>) {
    const hy = ctx.getHeight(hx, hz);
    const body = new THREE.BoxGeometry(10.2, 3.3, 4.2);
    body.translate(0, 1.65, -0.5);
    body.rotateY(ry);
    body.translate(hx, hy, hz);
    latParts.push(body);
    const hr = createGableRoofGeometry(11.0, 6.4, 2.25, 0.16, 'x');
    hr.rotateY(ry);
    hr.translate(hx, hy + 3.28, hz);
    roofParts.push(hr);
    addBoxPart(plasterParts, 10.4, 0.22, 0.28, hx, hy + 5.48, hz, ry);
  }
  addBoxPart(brickParts, 28.0, 0.14, 3.6, cx - 28, baseY + 0.07, cz - 24);
  addBoxPart(brickParts, 28.0, 0.14, 3.6, cx + 28, baseY + 0.07, cz - 24);
  // 075: Lũy Tre Làng (outer village perimeter bamboo hedge clumps — 100% clear of Đình, houses & Chùa Mía!)
  const dlBambooParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 28; b++) {
    const bx = b < 14 ? cx - 54 + b * 8.2 : (b < 21 ? cx - 60 : cx + 60);
    const bz = b < 14 ? cz - 72 : cz - 48 + (b < 21 ? (b - 14) : (b - 21)) * 11.0;
    const by = ctx.getHeight(bx, bz);
    for (let c = 0; c < 3; c++) {
      addCylPart(dlBambooParts, 0.06, 0.09, 6.2 + (c % 2) * 1.4, 5, bx + (c - 1) * 0.55, by + 3.1, bz + (c % 2) * 0.4);
    }
    dlBambooParts.push(createSculptedRockGeometry(6700 + b, 2.4, 2.2, 2.2, 1).translate(bx, by + 6.4, bz));
  }
  group.add(new THREE.Mesh(mergeNormalized(dlBambooParts), leafMat));
  // 076, 077, 078: Miếu Cây Đa root shrine, Bến Nước Ao Làng pond dock & Cối Giã Gạo rice mortar
  const by0 = ctx.getHeight(cx, cz - 32);
  addBoxPart(latParts, 1.35, 1.45, 1.15, cx + 3.2, by0 + 0.72, cz - 28.5);
  addCylPart(urnParts, 0.16, 0.14, 0.22, 7, cx + 3.2, by0 + 1.56, cz - 28.5);
  addBoxPart(woodParts, 3.2, 0.18, 6.2, pondX - 5.5, pondY + 0.28, pondZ + 2.5);
  for (const pxOff of [-1.2, 1.2]) {
    addCylPart(woodParts, 0.09, 0.10, 1.2, 5, pondX - 5.5 + pxOff, pondY - 0.1, pondZ + 4.8);
  }
  addCylPart(stepParts, 0.42, 0.36, 0.58, 8, teaX + 2.6, teaY + 0.29, teaZ + 1.4);
  addCylPart(woodParts, 0.05, 0.06, 1.4, 5, teaX + 2.6, teaY + 0.92, teaZ + 1.4, 0.35, 0);
  // 079, 080, 081, 088: Nhà Bia stele pavilion, Cột Cờ Sân Đình flagpole, 4 Cây Hương altars & Đình verandah lanterns
  addBoxPart(brickParts, 3.2, 0.35, 3.2, dinhX - 13.5, dinhY + 0.18, dinhZ + 12.0);
  for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    addCylPart(woodParts, 0.09, 0.10, 2.4, 6, dinhX - 13.5 + ox, dinhY + 1.4, dinhZ + 12.0 + oz);
  }
  const biaRoof = createGableRoofGeometry(3.8, 3.8, 1.3, 0.12, 'x');
  biaRoof.translate(dinhX - 13.5, dinhY + 2.6, dinhZ + 12.0);
  roofParts.push(biaRoof);
  addBoxPart(stepParts, 0.85, 1.45, 0.22, dinhX - 13.5, dinhY + 1.05, dinhZ + 12.0);
  addCylPart(woodParts, 0.08, 0.12, 9.6, 6, dinhX + 12.5, dinhY + 4.8, dinhZ + 13.5);
  addBoxPart(goldParts, 1.8, 1.1, 0.06, dinhX + 13.4, dinhY + 8.8, dinhZ + 13.5);
  for (const [ax, az] of [[cx - 20, cz + 14], [cx + 20, cz + 14], [cx - 24, cz - 26], [cx + 24, cz - 26]] as Array<[number, number]>) {
    const ay = ctx.getHeight(ax, az);
    addCylPart(latParts, 0.16, 0.22, 1.25, 6, ax, ay + 0.62, az);
    addBoxPart(latParts, 0.62, 0.55, 0.55, ax, ay + 1.45, az);
  }
  for (let lx = -8.4; lx <= 8.4; lx += 4.2) {
    goldParts.push(createLanternCoreGeometry(0.20, 0.36).translate(dinhX + lx, dinhFloorY + 3.15, dinhZ + 6.9));
  }
  // 083, 084, 085, 086: Firewood/ladders, wheelbarrows, bamboo chicken coops & laterite benches
  for (const [wx, wz] of [[cx - 17, cz - 18], [cx - 12, cz - 24]] as Array<[number, number]>) {
    const wy = ctx.getHeight(wx, wz);
    addBoxPart(woodParts, 1.35, 0.35, 0.78, wx, wy + 0.42, wz);
    addCylPart(woodParts, 0.28, 0.28, 0.10, 8, wx + 0.65, wy + 0.28, wz, Math.PI * 0.5, 0);
  }
  for (const [bx, bz] of [[cx - 35, cz + 35], [cx + 35, cz + 35]] as Array<[number, number]>) {
    const by = ctx.getHeight(bx, bz);
    addBoxPart(latParts, 2.2, 0.46, 0.68, bx, by + 0.23, bz);
    addCylPart(urnParts, 0.38, 0.45, 0.45, 7, bx + 2.4, by + 0.22, bz);
  }

  // --- Wave 2 Macro Visual QC & Expansion (274–288): Đường Lâm Mông Phụ Yard, Straw Ricks & Stone Well Shrine ---
  // 274 & 285: Sân Đình Mông Phụ stone seating curbs & wide carved laterite ceremonial porch steps
  for (const side of [-1, 1]) {
    addBoxPart(latParts, 0.65, 0.48, 12.0, dinhX + side * 11.5, dinhY + 0.24, dinhZ + 11.5);
  }
  for (let st = 0; st < 3; st++) {
    addBoxPart(latParts, 8.4, 0.22, 0.75, dinhX, dinhY + 0.12 + st * 0.2, dinhZ + 8.4 - st * 0.65);
  }
  // 275: 5 Authentic conical golden-straw ricks (Đống Rơm Vàng Làng Cổ)
  for (const [rx, rz] of [[cx - 38, cz - 12], [cx - 34, cz - 14], [cx + 38, cz - 12], [cx - 36, cz - 42], [cx + 36, cz - 42]] as Array<[number, number]>) {
    const ry = ctx.getHeight(rx, rz);
    addCylPart(goldParts, 1.05, 1.35, 1.25, 6, rx, ry + 0.62, rz);
    addConePart(goldParts, 1.2, 1.35, 6, rx, ry + 1.88, rz);
    addCylPart(woodParts, 0.05, 0.06, 2.9, 5, rx, ry + 1.45, rz);
  }
  // 276: Miếu Giếng Cổ Đá Ong (laterite stone village well + pulley frame + Thần Giếng shrine niche)
  const gwX = cx + 16;
  const gwZ = cz - 12;
  const gwY = ctx.getHeight(gwX, gwZ);
  addCylPart(latParts, 1.25, 1.35, 0.78, 6, gwX, gwY + 0.39, gwZ);
  addCylPart(woodParts, 0.07, 0.08, 2.1, 5, gwX - 1.0, gwY + 1.4, gwZ);
  addCylPart(woodParts, 0.07, 0.08, 2.1, 5, gwX + 1.0, gwY + 1.4, gwZ);
  addBoxPart(woodParts, 2.2, 0.10, 0.10, gwX, gwY + 2.4, gwZ);
  addBoxPart(latParts, 0.95, 1.1, 0.75, gwX + 2.1, gwY + 0.55, gwZ);
  addConePart(roofParts, 0.85, 0.52, 4, gwX + 2.1, gwY + 1.35, gwZ, Math.PI * 0.25);
  // 277: 3 Traditional laterite-and-tile private compound gates (Cổng Nhà Cổ Đá Ong)
  for (const [gx, gz] of [[cx - 36, cz - 18], [cx + 36, cz - 18], [cx - 34, cz - 46]] as Array<[number, number]>) {
    const gy = ctx.getHeight(gx, gz);
    addBoxPart(latParts, 0.55, 2.6, 0.55, gx - 1.2, gy + 1.3, gz);
    addBoxPart(latParts, 0.55, 2.6, 0.55, gx + 1.2, gy + 1.3, gz);
    addBoxPart(woodParts, 1.8, 2.1, 0.14, gx, gy + 1.05, gz);
    addConePart(roofParts, 2.2, 0.95, 4, gx, gy + 3.05, gz, Math.PI * 0.25);
  }
  // 278 & 279: 2 Soy-sauce jar drying racks (Chum Tương) & Bát Tràng grain-drying yard
  for (let j = 0; j < 10; j++) {
    const jx = cx - 26 + (j % 5) * 1.1;
    const jz = cz + 6 + Math.floor(j / 5) * 1.4;
    addCylPart(urnParts, 0.24, 0.18, 0.55, 5, jx, ctx.getHeight(jx, jz) + 0.28, jz);
  }
  addBoxPart(brickParts, 8.2, 0.12, 6.2, cx + 22, ctx.getHeight(cx + 22, cz + 6) + 0.06, cz + 6);
  addCylPart(goldParts, 0.65, 0.65, 0.10, 6, cx + 22, ctx.getHeight(cx + 22, cz + 6) + 0.16, cz + 6);
  // 280: 6 Slender areca palms (Cây Cau) in front of house verandas
  for (let p = 0; p < 6; p++) {
    const px = cx + (p < 3 ? -28 : 28) + (p % 3) * 2.2;
    const pz = cz - 28;
    const py = ctx.getHeight(px, pz);
    addCylPart(woodParts, 0.09, 0.12, 5.4, 5, px, py + 2.7, pz);
    addConePart(plasterParts, 0.95, 0.65, 5, px, py + 5.5, pz);
  }
  // 281, 282, 283, 284, 286, 287, 288: Banyan tea bench, village boundary stele, northern laterite walls, buffalo lean-to, gourd trellis, lanterns & Hai Vua plaque
  addBoxPart(woodParts, 1.6, 0.42, 0.55, teaX - 2.2, teaY + 0.21, teaZ + 1.2);
  addCylPart(urnParts, 0.14, 0.16, 0.22, 5, teaX - 2.2, teaY + 0.52, teaZ + 1.2);
  addBoxPart(latParts, 0.85, 1.9, 0.36, cx - 5.2, baseY + 0.95, cz + 38);
  addBoxPart(latParts, 34.0, 1.55, 0.45, cx, baseY + 0.78, cz - 54);
  const bfX = cx - 48;
  const bfZ = cz - 32;
  const bfY = ctx.getHeight(bfX, bfZ);
  addCylPart(woodParts, 0.08, 0.10, 2.2, 5, bfX - 1.6, bfY + 1.1, bfZ - 1.2);
  addCylPart(woodParts, 0.08, 0.10, 2.2, 5, bfX + 1.6, bfY + 1.1, bfZ + 1.2);
  addBoxPart(roofParts, 3.8, 0.18, 2.8, bfX, bfY + 2.25, bfZ, 0, 0.22, 0);
  addBoxPart(woodParts, 3.6, 0.10, 2.4, cx + 28, ctx.getHeight(cx + 28, cz - 8) + 2.2, cz - 8);
  for (const lx of [dinhX - 6.2, dinhX + 6.2, cx - 36, cx + 36]) {
    addConePart(goldParts, 0.18, 0.34, 5, lx, dinhY + 2.75, dinhZ + 9.2);
  }
  addBoxPart(stepParts, 1.2, 1.6, 0.24, dinhX - 10.2, dinhY + 0.85, dinhZ + 12.0);

  // --- Wave 3 Macro Visual QC & Expansion (544–572): Chùa Mía, Mông Phụ Well Canopy, Laterite Alleys & Soy-Sauce Courtyard ---
  const w3DlLat: THREE.BufferGeometry[] = [];
  const w3DlRoof: THREE.BufferGeometry[] = [];
  const w3DlWood: THREE.BufferGeometry[] = [];
  const w3DlBrick: THREE.BufferGeometry[] = [];
  const w3DlUrn: THREE.BufferGeometry[] = [];
  const w3DlGold: THREE.BufferGeometry[] = [];
  const w3DlStone: THREE.BufferGeometry[] = [];
  const dlWoodMat = ctx.materials.darkIronwood ?? ctx.materials.darkWood;
  // 544–547: Chùa Mía (Sùng Nghiêm Tự) main hall, Cửu Phẩm Liên Hoa tower, Tam Quan bell gate & courtyard stone incense altar (shifted cleanly away from house at cx+32, cz-38!)
  const cmX = cx + 28;
  const cmZ = cz - 58;
  const cmY = ctx.getHeight(cmX, cmZ);
  addW3Plinth(w3DlLat, 10.4, 6.8, cmY + 0.55, cmY, cmX, cmZ);
  addBoxPart(w3DlLat, 8.6, 2.75, 4.8, cmX, cmY + 1.92, cmZ - 0.3);
  for (const ox of [-3.4, -1.1, 1.1, 3.4]) {
    addW3GroundedCol(w3DlWood, 0.11, 0.13, cmY + 3.25, cmY + 0.55, 5, cmX + ox, cmZ + 2.55);
  }
  addW3HipRoof(w3DlRoof, w3DlGold, 10.6, 7.2, cmY + 3.25, 1.55, cmX, cmZ);
  // 545: Tháp Cửu Phẩm Liên Hoa 4-tier octagonal pagoda stupa
  const tpCmX = cmX + 8.6;
  const tpCmZ = cmZ + 1.2;
  const tpCmY = ctx.getHeight(tpCmX, tpCmZ);
  addW3Plinth(w3DlBrick, 3.2, 3.2, tpCmY + 0.45, tpCmY, tpCmX, tpCmZ);
  for (let tier = 0; tier < 4; tier++) {
    const r = 1.15 - tier * 0.18;
    const ty = tpCmY + 0.45 + tier * 1.35;
    addCylPart(w3DlBrick, r * 0.9, r, 1.15, 6, tpCmX, ty + 0.58, tpCmZ);
    addConePart(w3DlRoof, r * 1.35, 0.42, 6, tpCmX, ty + 1.25, tpCmZ);
  }
  addConePart(w3DlGold, 0.18, 0.52, 4, tpCmX, tpCmY + 6.05, tpCmZ);
  // 546 & 547: Chùa Mía Tam Quan bell gate & courtyard stone incense altar
  for (const gxOff of [-2.4, -0.9, 0.9, 2.4]) {
    addW3GroundedPost(w3DlLat, 0.42, 0.42, cmY + 2.85, cmY, cmX + gxOff, cmZ + 8.8);
  }
  addW3HipRoof(w3DlRoof, w3DlGold, 6.2, 1.9, cmY + 2.85, 0.95, cmX, cmZ + 8.8);
  addW3GroundedCol(w3DlStone, 0.15, 0.20, cmY + 1.45, cmY, 5, cmX, cmZ + 5.2);
  addBoxPart(w3DlStone, 0.65, 0.45, 0.65, cmX, cmY + 1.62, cmZ + 5.2);
  // 548–551: Mông Phụ well timber canopy, washing apron/bucket, banyan tea-stall awning & chè lam counter
  for (const [ox, oz] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) {
    addW3GroundedCol(w3DlWood, 0.09, 0.11, gwY + 2.65, gwY, 5, gwX + ox, gwZ + oz);
  }
  addW3HipRoof(w3DlRoof, w3DlGold, 3.6, 3.6, gwY + 2.65, 0.95, gwX, gwZ);
  addCylPart(w3DlLat, 2.25, 2.35, 0.14, 6, gwX, gwY + 0.07, gwZ);
  addCylPart(w3DlWood, 0.22, 0.18, 0.34, 5, gwX - 1.5, gwY + 0.28, gwZ + 0.8);
  for (const [ox, oz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
    addW3GroundedCol(w3DlWood, 0.07, 0.08, teaY + 2.25, teaY, 5, teaX - 2.2 + ox, teaZ + 1.2 + oz);
  }
  addBoxPart(w3DlGold, 3.5, 0.14, 2.6, teaX - 2.2, teaY + 2.32, teaZ + 1.2, 0, 0.14, 0);
  addBoxPart(w3DlWood, 1.5, 0.72, 0.55, teaX + 0.6, teaY + 0.36, teaZ + 1.4);
  for (const jxOff of [-0.45, 0, 0.45]) addCylPart(w3DlUrn, 0.12, 0.14, 0.28, 5, teaX + 0.6 + jxOff, teaY + 0.86, teaZ + 1.4);
  // 552–556: Laterite alley brick drains, wall lamp niches, soy-sauce raised sun-terrace, bamboo jar covers & bottling table
  for (const side of [-1, 1]) {
    addBoxPart(w3DlBrick, 0.55, 0.12, 26.0, cx + side * 6.8, baseY + 0.06, cz + 12.0);
    for (const nz of [cz + 4.0, cz + 18.0]) {
      addBoxPart(w3DlLat, 0.52, 0.68, 0.48, cx + side * 8.2, baseY + 1.25, nz);
      addConePart(w3DlGold, 0.14, 0.24, 4, cx + side * 8.0, baseY + 1.28, nz);
    }
  }
  const ssX = cx - 24;
  const ssZ = cz + 6.5;
  const ssY = ctx.getHeight(ssX, ssZ);
  addW3Plinth(w3DlBrick, 7.2, 4.4, ssY + 0.28, ssY, ssX, ssZ);
  for (let j = 0; j < 10; j++) {
    const jx = cx - 26 + (j % 5) * 1.1;
    const jz = cz + 6 + Math.floor(j / 5) * 1.4;
    addConePart(w3DlGold, 0.28, 0.18, 5, jx, ctx.getHeight(jx, jz) + 0.62, jz);
  }
  addBoxPart(w3DlWood, 1.8, 0.78, 0.85, ssX + 4.8, ssY + 0.39, ssZ);
  addCylPart(w3DlUrn, 0.16, 0.18, 0.32, 5, ssX + 4.5, ssY + 0.94, ssZ);
  // 557–572: Rice-husking mill, weaving shed, Đình flagstone walkway, drum/gong rack, hitching posts, pond duck-coop, harvest drying poles, gate plaque, ox-cart, blacksmith lean-to, tile repair stack, rainwater cistern, bonsai bench, northern dike footpath, fire-watch tower & heritage stele
  addCylPart(w3DlLat, 0.48, 0.52, 0.72, 6, cx - 30, ctx.getHeight(cx - 30, cz - 24) + 0.36, cz - 24);
  const wvX = cx + 38;
  const wvZ = cz - 26;
  const wvY = ctx.getHeight(wvX, wvZ);
  for (const [ox, oz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) {
    addW3GroundedCol(w3DlWood, 0.08, 0.10, wvY + 2.35, wvY, 5, wvX + ox, wvZ + oz);
  }
  addW3HipRoof(w3DlRoof, null, 4.0, 3.2, wvY + 2.35, 0.85, wvX, wvZ);
  addBoxPart(w3DlWood, 1.8, 1.1, 0.95, wvX, wvY + 0.55, wvZ);
  addBoxPart(w3DlStone, 3.2, 0.14, 14.0, dinhX, dinhY + 0.07, dinhZ + 14.0);
  addBoxPart(w3DlWood, 1.8, 1.35, 0.45, dinhX + 5.2, dinhY + 0.68, dinhZ + 7.2);
  addCylPart(w3DlGold, 0.34, 0.34, 0.52, 6, dinhX + 5.2, dinhY + 0.85, dinhZ + 7.2, 0, Math.PI * 0.5);
  for (const side of [-1, 1]) addW3GroundedPost(w3DlLat, 0.36, 0.36, dinhY + 1.35, dinhY, dinhX + side * 4.8, dinhZ + 9.2);
  addBoxPart(w3DlWood, 2.8, 0.65, 2.2, cx + 14, baseY + 0.32, cz + 26);
  for (const pxOff of [-1.4, 1.4]) addW3GroundedPost(w3DlWood, 0.08, 0.08, baseY + 1.85, baseY, cx + 24 + pxOff, cz - 18);
  addBoxPart(w3DlGold, 3.0, 0.24, 0.24, cx + 24, baseY + 1.75, cz - 18);
  addBoxPart(w3DlGold, 2.4, 0.48, 0.14, cx, baseY + 3.45, cz + 36);
  const oxY = ctx.getHeight(cx - 36, cz - 14);
  addBoxPart(w3DlWood, 2.2, 0.65, 1.35, cx - 36, oxY + 0.72, cz - 14);
  addCylPart(w3DlWood, 0.48, 0.48, 0.10, 6, cx - 36, oxY + 0.48, cz - 14.8, 0, Math.PI * 0.5);
  addCylPart(w3DlWood, 0.48, 0.48, 0.10, 6, cx - 36, oxY + 0.48, cz - 13.2, 0, Math.PI * 0.5);
  const bsY = ctx.getHeight(cx - 26, cz + 24);
  addBoxPart(w3DlLat, 1.8, 0.92, 1.4, cx - 26, bsY + 0.46, cz + 24);
  addBoxPart(w3DlRoof, 1.4, 0.65, 0.85, cx + 32, ctx.getHeight(cx + 32, cz - 16) + 0.32, cz - 16);
  addBoxPart(w3DlLat, 1.8, 1.15, 1.8, cx - 32, ctx.getHeight(cx - 32, cz - 30) + 0.58, cz - 30);
  addBoxPart(w3DlLat, 2.2, 0.52, 0.65, cx + 18, ctx.getHeight(cx + 18, cz - 24) + 0.26, cz - 24);
  addBoxPart(w3DlLat, 22.0, 0.24, 2.2, cx + 12, baseY + 0.12, cz - 51);
  const fwX = cx - 50;
  const fwZ = cz - 54;
  const fwY = ctx.getHeight(fwX, fwZ);
  for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    addW3GroundedCol(w3DlWood, 0.08, 0.10, fwY + 4.4, fwY, 5, fwX + ox, fwZ + oz);
  }
  addBoxPart(w3DlWood, 2.6, 0.18, 2.6, fwX, fwY + 3.4, fwZ);
  addW3HipRoof(w3DlRoof, null, 3.0, 3.0, fwY + 4.4, 0.85, fwX, fwZ);
  addBoxPart(w3DlLat, 1.35, 1.75, 0.28, cx + 5.4, baseY + 0.88, cz + 32);

  addWave3Mesh(group, w3DlLat, lateriteMat);
  addWave3Mesh(group, w3DlRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w3DlWood, dlWoodMat);
  addWave3Mesh(group, w3DlBrick, brickMat);
  addWave3Mesh(group, w3DlUrn, urnMat);
  addWave3Mesh(group, w3DlGold, ctx.materials.gold);
  addWave3Mesh(group, w3DlStone, ctx.materials.stone);

  // --- Wave 4 Macro Visual QC & Outer Expansion (945–973): Đền Phùng Hưng Gate, Lăng Ngô Quyền Pillars, Threshing Floor & Outer Hamlet ---
  const w4DlLat: THREE.BufferGeometry[] = [];
  const w4DlRoof: THREE.BufferGeometry[] = [];
  const w4DlWood: THREE.BufferGeometry[] = [];
  const w4DlBrick: THREE.BufferGeometry[] = [];
  const w4DlUrn: THREE.BufferGeometry[] = [];
  const w4DlGold: THREE.BufferGeometry[] = [];
  const w4DlStone: THREE.BufferGeometry[] = [];
  // 945 & 946: Đền Phùng Hưng outer shrine gatehouse & offering altar/stele (cx - 58, cz - 36 — clear of houses & bamboo!)
  const phX = cx - 58;
  const phZ = cz - 36;
  const phY = Math.max(ctx.getHeight(phX, phZ), ctx.getHeight(phX - 2, phZ));
  addW3Plinth(w4DlLat, 6.2, 2.4, phY + 0.35, phY, phX, phZ);
  for (const ox of [-2.4, -0.9, 0.9, 2.4]) addW3GroundedPost(w4DlLat, 0.42, 0.42, phY + 3.0, phY + 0.35, phX + ox, phZ);
  addW3HipRoof(w4DlRoof, w4DlGold, 6.8, 2.2, phY + 3.0, 0.95, phX, phZ);
  addBoxPart(w4DlLat, 1.4, 0.95, 0.85, phX, phY + 0.48, phZ - 4.2);
  addBoxPart(w4DlStone, 0.78, 1.55, 0.24, phX + 2.4, phY + 0.78, phZ - 4.2);
  // 947–951: Lăng Ngô Quyền ceremonial pillars (cx + 58, cz - 36), southern threshing floor, kẹo lạc stall, sugarcane press & drying rack
  const nqDlX = cx + 58;
  const nqDlZ = cz - 36;
  const nqDlY = ctx.getHeight(nqDlX, nqDlZ);
  for (const ox of [-3.6, -1.4, 1.4, 3.6]) {
    addW3GroundedPost(w4DlLat, 0.48, 0.48, nqDlY + 3.6, nqDlY, nqDlX + ox, nqDlZ);
    addConePart(w4DlGold, 0.28, 0.42, 4, nqDlX + ox, nqDlY + 3.82, nqDlZ);
  }
  const tfX = cx - 18;
  const tfZ = cz + 52;
  const tfY = ctx.getHeight(tfX, tfZ);
  addBoxPart(w4DlBrick, 11.2, 0.18, 7.6, tfX, tfY + 0.09, tfZ);
  for (let r = -2; r <= 2; r++) addBoxPart(w4DlGold, 8.6, 0.10, 0.45, tfX, tfY + 0.22, tfZ + r * 1.15);
  const klDlX = cx + 18;
  const klDlZ = cz + 50;
  const klDlY = Math.max(ctx.getHeight(klDlX, klDlZ), ctx.getHeight(klDlX + 2, klDlZ));
  addW3Plinth(w4DlLat, 4.2, 3.0, klDlY + 0.28, klDlY, klDlX, klDlZ);
  for (const [ox, oz] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) addW3GroundedCol(w4DlWood, 0.08, 0.10, klDlY + 2.45, klDlY + 0.28, 5, klDlX + ox, klDlZ + oz);
  addW3HipRoof(w4DlRoof, null, 4.8, 3.6, klDlY + 2.45, 0.85, klDlX, klDlZ);
  for (const ox of [-0.4, 0.4]) addCylPart(w4DlWood, 0.24, 0.26, 1.35, 6, cx + 52, ctx.getHeight(cx + 52, cz + 6) + 0.68, cz + 6 + ox);
  addBoxPart(w4DlWood, 3.2, 0.14, 0.14, cx + 52, ctx.getHeight(cx + 52, cz + 6) + 1.38, cz + 6);
  addBoxPart(w4DlWood, 2.2, 1.25, 0.72, cx - 52, ctx.getHeight(cx - 52, cz + 4) + 0.62, cz + 4);
  // 952–961: 4 boundary markers, well yoke, 4 straw haystacks, roadside shrine, winnowing fan, 4 laterite benches, sawhorse stack, jar-washing basin, 3 chicken coops & culvert bridge
  for (const [bx, bz] of [[-58, 42], [58, 42], [-58, -62], [58, -62]]) addW3GroundedPost(w4DlLat, 0.45, 0.45, ctx.getHeight(cx + bx, cz + bz) + 1.25, ctx.getHeight(cx + bx, cz + bz), cx + bx, cz + bz);
  addBoxPart(w4DlStone, 1.4, 0.48, 0.75, cx - 26, tfY + 0.24, cz + 46);
  for (let h = 0; h < 4; h++) {
    const hx = cx - 52;
    const hz = cz + 12 + h * 5.2;
    const hy = ctx.getHeight(hx, hz);
    addCylPart(w4DlGold, 1.05, 1.22, 1.15, 6, hx, hy + 0.58, hz);
    addConePart(w4DlGold, 1.18, 1.25, 6, hx, hy + 1.78, hz);
  }
  addW3GroundedPost(w4DlLat, 0.42, 0.42, tfY + 1.35, tfY, cx + 8, cz + 48);
  addW3HipRoof(w4DlRoof, null, 0.95, 0.95, tfY + 1.35, 0.35, cx + 8, cz + 48);
  addBoxPart(w4DlWood, 1.5, 1.25, 0.85, tfX + 7.2, tfY + 0.62, tfZ);
  for (let b = 0; b < 4; b++) addBoxPart(w4DlLat, 1.9, 0.48, 0.58, cx + (b < 2 ? -10 : 10), tfY + 0.24, cz + 42 + (b % 2) * 5.5);
  addBoxPart(w4DlWood, 3.6, 0.75, 1.1, cx + 52, ctx.getHeight(cx + 52, cz + 18) + 0.38, cz + 18);
  addCylPart(w4DlBrick, 1.35, 1.45, 0.52, 6, cx - 32, ctx.getHeight(cx - 32, cz + 14) + 0.26, cz + 14);
  for (let c = 0; c < 3; c++) addConePart(w4DlGold, 0.42, 0.55, 5, cx + 52 + c * 1.1, ctx.getHeight(cx + 52, cz - 6) + 0.28, cz - 6);
  addBoxPart(w4DlLat, 2.8, 0.28, 1.8, cx, tfY + 0.16, cz + 46);
  // 962–973: 6 festival banners, stone hand-mill, bamboo ladder, hitching post, Chùa Mía belfry, wheelbarrow, betel trellis, coping wall, tea set, southern rest pavilion, foot-mill & heritage monolith
  for (let f = 0; f < 6; f++) addW3GroundedCol(w4DlWood, 0.05, 0.07, tfY + 4.8, tfY, 4, cx + (f < 3 ? -12 + f * 3.5 : 5 + (f - 3) * 3.5), cz + 40);
  addCylPart(w4DlStone, 0.32, 0.34, 0.42, 6, tfX - 6.8, tfY + 0.48, tfZ);
  addBoxPart(w4DlWood, 0.55, 3.4, 0.12, cx - 48, ctx.getHeight(cx - 48, cz - 14) + 1.65, cz - 14, 0, 0, 0.22);
  addW3GroundedPost(w4DlLat, 0.26, 0.26, tfY + 1.15, tfY, tfX - 8.2, tfZ + 3.5);
  const cmBfX = cmX - 9.2;
  const cmBfZ = cmZ + 1.5;
  const cmBfY = ctx.getHeight(cmBfX, cmBfZ);
  for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) addW3GroundedCol(w4DlWood, 0.09, 0.11, cmBfY + 2.85, cmBfY, 5, cmBfX + ox, cmBfZ + oz);
  addW3HipRoof(w4DlRoof, w4DlGold, 3.0, 3.0, cmBfY + 2.85, 0.85, cmBfX, cmBfZ);
  addBoxPart(w4DlWood, 1.35, 0.52, 0.72, cx + 48, ctx.getHeight(cx + 48, cz + 24) + 0.38, cz + 24);
  for (const ox of [-1.2, 1.2]) addW3GroundedPost(w4DlWood, 0.07, 0.07, klDlY + 2.1, klDlY, klDlX + 4.8 + ox, klDlZ);
  addBoxPart(w4DlRoof, 6.2, 0.22, 0.52, phX, phY + 1.85, phZ - 7.2);
  addBoxPart(w4DlWood, 1.1, 0.45, 0.65, klDlX, klDlY + 0.52, klDlZ + 2.6);
  const rpX = cx;
  const rpZ = cz + 64;
  const rpY = Math.max(ctx.getHeight(rpX, rpZ), ctx.getHeight(rpX + 2, rpZ));
  addW3Plinth(w4DlLat, 4.8, 3.8, rpY + 0.35, rpY, rpX, rpZ);
  for (const [ox, oz] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) addW3GroundedCol(w4DlWood, 0.09, 0.11, rpY + 2.75, rpY + 0.35, 5, rpX + ox, rpZ + oz);
  addW3HipRoof(w4DlRoof, w4DlGold, 5.4, 4.4, rpY + 2.75, 1.05, rpX, rpZ);
  addBoxPart(w4DlWood, 2.2, 0.18, 0.24, tfX + 6.8, tfY + 0.48, tfZ - 3.2, 0, 0, 0.18);
  addBoxPart(w4DlStone, 1.5, 2.25, 0.36, cx + 7.2, rpY + 1.12, cz + 60);

  addWave3Mesh(group, w4DlLat, lateriteMat);
  addWave3Mesh(group, w4DlRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w4DlWood, dlWoodMat);
  addWave3Mesh(group, w4DlBrick, brickMat);
  addWave3Mesh(group, w4DlUrn, urnMat);
  addWave3Mesh(group, w4DlGold, ctx.materials.gold);
  addWave3Mesh(group, w4DlStone, ctx.materials.stone);

  // --- Wave 5 Macro Visual QC & Heritage Details (1345–1373): Đền Phùng Hưng Belfry, Rice-Husking Shed, Soy-Sauce Terrace & Laterite Crafts ---
  const w5DlLat: THREE.BufferGeometry[] = [];
  const w5DlRoof: THREE.BufferGeometry[] = [];
  const w5DlWood: THREE.BufferGeometry[] = [];
  const w5DlBrick: THREE.BufferGeometry[] = [];
  const w5DlUrn: THREE.BufferGeometry[] = [];
  const w5DlGold: THREE.BufferGeometry[] = [];
  const w5DlStone: THREE.BufferGeometry[] = [];
  // 1345 & 1346: Đền Phùng Hưng courtyard bell-shelter & Lăng Ngô Quyền stone altar/screen
  const phBfX = phX - 6.8;
  const phBfZ = phZ - 2.0;
  const phBfY = Math.max(ctx.getHeight(phBfX, phBfZ), ctx.getHeight(phBfX - 2, phBfZ));
  addW3Plinth(w5DlLat, 3.6, 3.6, phBfY + 0.32, phBfY, phBfX, phBfZ);
  for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) addW3GroundedCol(w5DlWood, 0.09, 0.11, phBfY + 2.75, phBfY + 0.32, 5, phBfX + ox, phBfZ + oz);
  addW3HipRoof(w5DlRoof, w5DlGold, 4.4, 4.4, phBfY + 2.75, 0.95, phBfX, phBfZ);
  addBoxPart(w5DlLat, 4.2, 1.95, 0.42, nqDlX, nqDlY + 0.98, nqDlZ - 4.8);
  addBoxPart(w5DlStone, 1.45, 0.88, 0.82, nqDlX, nqDlY + 0.44, nqDlZ - 2.4);
  // 1347–1350: Laterite village well-house, rice-husking shed (cx - 32, cz + 60), laterite brick-cutting yard & soy-sauce fermentation terrace
  const whX = cx - 60;
  const whZ = cz + 22;
  const whY = ctx.getHeight(whX, whZ);
  addCylPart(w5DlLat, 1.05, 1.15, 0.82, 6, whX, whY + 0.41, whZ);
  for (const s of [-1, 1]) addW3GroundedPost(w5DlWood, 0.10, 0.10, whY + 2.15, whY, whX + s * 0.95, whZ);
  addBoxPart(w5DlWood, 2.2, 0.12, 0.12, whX, whY + 1.95, whZ);
  const hsX = cx - 32;
  const hsZ = cz + 60;
  const hsY = Math.max(ctx.getHeight(hsX, hsZ), ctx.getHeight(hsX - 2, hsZ));
  addW3Plinth(w5DlLat, 5.2, 4.0, hsY + 0.28, hsY, hsX, hsZ);
  for (const [ox, oz] of [[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]]) addW3GroundedCol(w5DlWood, 0.09, 0.11, hsY + 2.65, hsY + 0.28, 5, hsX + ox, hsZ + oz);
  addW3HipRoof(w5DlRoof, null, 6.0, 4.6, hsY + 2.65, 1.05, hsX, hsZ);
  for (let b = 0; b < 4; b++) addBoxPart(w5DlLat, 1.15, 0.55, 0.72, cx + 56, ctx.getHeight(cx + 56, cz + 14 + b * 1.4) + 0.28, cz + 14 + b * 1.4);
  const ssW5X = cx + 32;
  const ssW5Z = cz + 56;
  const ssW5Y = ctx.getHeight(ssW5X, ssW5Z);
  addBoxPart(w5DlBrick, 6.4, 0.22, 4.2, ssW5X, ssW5Y + 0.11, ssW5Z);
  for (let j = 0; j < 8; j++) addCylPart(w5DlUrn, 0.28, 0.22, 0.68, 5, ssW5X - 2.1 + (j % 4) * 1.4, ssW5Y + 0.56, ssW5Z - 0.9 + Math.floor(j / 4) * 1.8);
  // 1351–1361: Notice-board shelter, ox-yoke harrow, brick drainage channel, 4 hitching bollards, Chùa Mía lanterns, fish-drying rack, ceramic water cooler, Miếu Thổ Địa, rice bushel, rain trough & basket weaver bench
  addW3GroundedPost(w5DlWood, 0.10, 0.10, rpY + 2.15, rpY, rpX - 5.2, rpZ);
  addBoxPart(w5DlWood, 1.85, 1.05, 0.16, rpX - 5.2, rpY + 1.48, rpZ);
  addW3HipRoof(w5DlRoof, null, 2.2, 1.0, rpY + 2.15, 0.42, rpX - 5.2, rpZ);
  addBoxPart(w5DlWood, 1.65, 0.95, 0.22, cx - 48, ctx.getHeight(cx - 48, cz + 36) + 0.48, cz + 36, 0.25);
  addBoxPart(w5DlBrick, 11.6, 0.16, 0.65, tfX, tfY + 0.08, tfZ + 4.4);
  for (let hb = 0; hb < 4; hb++) addW3GroundedPost(w5DlLat, 0.32, 0.32, rpY + 1.05, rpY, cx - 12 + hb * 8, cz + 58);
  for (const s of [-1, 1]) addW3GroundedPost(w5DlStone, 0.34, 0.34, cmBfY + 1.55, cmBfY, cmBfX + s * 3.2, cmBfZ + 2.6);
  addBoxPart(w5DlWood, 2.2, 1.15, 0.65, whX, whY + 0.58, whZ + 4.2);
  addCylPart(w5DlUrn, 0.28, 0.22, 0.62, 5, klDlX - 3.6, klDlY + 0.42, klDlZ + 1.4);
  const tdY = ctx.getHeight(cx + 56, cz + 32);
  addW3Plinth(w5DlLat, 1.25, 1.25, tdY + 1.25, tdY, cx + 56, cz + 32);
  addW3HipRoof(w5DlRoof, null, 1.65, 1.65, tdY + 1.25, 0.45, cx + 56, cz + 32);
  addBoxPart(w5DlWood, 0.78, 0.65, 0.78, tfX - 4.5, tfY + 0.32, tfZ + 3.2);
  addBoxPart(w5DlStone, 1.25, 0.45, 0.78, hsX + 3.6, hsY + 0.22, hsZ - 2.2);
  addBoxPart(w5DlWood, 1.85, 0.68, 0.85, cx + 56, ctx.getHeight(cx + 56, cz + 24) + 0.34, cz + 24);
  // 1362–1373: West laterite archway, buffalo-bell post, Chùa Mía censer, corn-drying A-frame, laterite steps, roof-finial bench, 2 bamboo flagpoles, Sơn Tây milepost, 3 cassava mats, 4 oil-lamp niches, village drum & outer welcome stele
  for (const s of [-1, 1]) addW3GroundedPost(w5DlLat, 0.58, 0.58, whY + 3.1, whY, cx - 60, cz + 32 + s * 2.2);
  addBoxPart(w5DlRoof, 0.95, 0.32, 5.4, cx - 60, whY + 3.22, cz + 32);
  addW3GroundedPost(w5DlWood, 0.12, 0.12, tfY + 1.65, tfY, cx - 56, cz + 26);
  addBoxPart(w5DlStone, 0.95, 0.85, 0.95, cmBfX, cmBfY + 0.42, cmBfZ + 3.6);
  addBoxPart(w5DlWood, 2.2, 1.45, 0.45, hsX - 4.2, hsY + 0.72, hsZ);
  addBoxPart(w5DlGold, 1.85, 0.75, 0.22, hsX - 4.2, hsY + 1.02, hsZ);
  addBoxPart(w5DlLat, 4.8, 0.45, 2.2, rpX, rpY + 0.22, rpZ + 3.8);
  addBoxPart(w5DlWood, 1.95, 0.68, 0.85, cx + 56, ctx.getHeight(cx + 56, cz + 4) + 0.34, cz + 4);
  for (const s of [-1, 1]) {
    addW3GroundedCol(w5DlWood, 0.06, 0.08, rpY + 5.6, rpY, 5, rpX + s * 6.5, rpZ + 4.5);
    addConePart(w5DlGold, 0.20, 0.32, 4, rpX + s * 6.5, rpY + 5.75, rpZ + 4.5);
  }
  addW3GroundedPost(w5DlStone, 0.38, 0.38, rpY + 1.45, rpY, cx - 14, cz + 68);
  for (let cm = 0; cm < 3; cm++) addCylPart(w5DlGold, 0.68, 0.68, 0.08, 6, tfX - 2.4 + cm * 2.4, tfY + 0.24, tfZ - 4.8);
  for (let ln = 0; ln < 4; ln++) addW3GroundedPost(w5DlLat, 0.34, 0.34, rpY + 1.15, rpY, cx - 15 + ln * 10, cz + 62);
  addBoxPart(w5DlWood, 1.15, 0.82, 0.78, rpX + 5.2, rpY + 0.41, rpZ);
  addCylPart(w5DlUrn, 0.36, 0.36, 0.58, 6, rpX + 5.2, rpY + 0.98, rpZ, 0, Math.PI * 0.5);
  addBoxPart(w5DlStone, 1.55, 2.35, 0.38, cx, rpY + 1.18, cz + 72);
  addBoxPart(w5DlGold, 1.05, 1.55, 0.42, cx, rpY + 1.28, cz + 72);

  addWave3Mesh(group, w5DlLat, lateriteMat);
  addWave3Mesh(group, w5DlRoof, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w5DlWood, dlWoodMat);
  addWave3Mesh(group, w5DlBrick, brickMat);
  addWave3Mesh(group, w5DlUrn, urnMat);
  addWave3Mesh(group, w5DlGold, ctx.materials.gold);
  addWave3Mesh(group, w5DlStone, ctx.materials.stone);

  group.add(
    new THREE.Mesh(mergeNormalized(trunkParts), uplitBarkMat),
    new THREE.Mesh(mergeNormalized(stepParts), ctx.materials.stone),
    leafInst,
    new THREE.Mesh(applyWorldBoxUV(mergeNormalized(latParts), 2.4), lateriteMat),
    new THREE.Mesh(applyWorldBoxUV(mergeNormalized(plasterParts), 2.4), plasterMat),
    new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(winParts), warmDoorMat),
    new THREE.Mesh(applyWorldBoxUV(mergeNormalized(brickParts), 2.0), brickMat),
    new THREE.Mesh(mergeNormalized(urnParts), urnMat),
    new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold),
    ffInst
  );
  ctx.scene.add(group);
  return { group, warmDoorMat };
}

function buildLongVanLacquerValleyMacro(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): THREE.Group {
  const cx = 820;
  const cz = -80;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 145 });
  const group = new THREE.Group();
  group.name = 'LongVanLacquerValleyMacro';
  const baseY = ctx.getHeight(cx, cz);

  // 1. Monumental 35m Seamless Sculpted Coiling Vietnamese Dragon (smooth tapered parallel-transport body,
  //    continuous integrated dorsal ridge, sculpted lofted head, antlers, whiskers, cloud mane & 4 curved clawed legs!)
  const dragonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 22, baseY + 1.2, cz - 12),
    new THREE.Vector3(cx - 11, baseY + 7.4, cz - 21),
    new THREE.Vector3(cx + 10, baseY + 13.8, cz - 15),
    new THREE.Vector3(cx - 8, baseY + 21.4, cz - 25),
    new THREE.Vector3(cx + 5, baseY + 28.6, cz - 29),
    new THREE.Vector3(cx, baseY + 34.4, cz - 23.2),
    new THREE.Vector3(cx, baseY + 34.8, cz - 21.6)
  ]);
  const sculptedDragon = createSmoothDragonParts(dragonCurve, {
    baseRadius: 1.72,
    tubularSegments: 64,
    radialSegments: 10,
    headAt: 'end',
    includeLegs: true,
    dorsalCrestHeight: 0.48,
    crestWaveCount: 22
  });
  const dragonParts: THREE.BufferGeometry[] = [...sculptedDragon.bodyParts];
  const maneParts: THREE.BufferGeometry[] = [...sculptedDragon.maneParts];
  const goldAccentParts: THREE.BufferGeometry[] = [...sculptedDragon.accentParts];

  // Glowing Amber Dragon Eyes + Radiant Flaming Pearl (*Châu Lửa*) in front of jaws
  const pearlGlowMat = new THREE.MeshStandardMaterial({
    color: '#ffe07a',
    emissive: new THREE.Color('#ff8c1a'),
    emissiveIntensity: 2.2,
    roughness: 0.18
  });
  ctx.extraMaterials.push(pearlGlowMat);
  const eyeAndPearlParts: THREE.BufferGeometry[] = [];
  for (const ep of sculptedDragon.eyePositions) {
    const eye = new THREE.SphereGeometry(0.42, 10, 8);
    eye.translate(ep.x, ep.y, ep.z);
    eyeAndPearlParts.push(eye);
  }
  const headY = baseY + 34.8;
  const headZ = cz - 21.6;
  const pearlX = cx;
  const pearlY = headY - 0.55;
  const pearlZ = headZ + 7.2;
  const pearlSphere = new THREE.SphereGeometry(1.55, 16, 12);
  pearlSphere.translate(pearlX, pearlY, pearlZ);
  eyeAndPearlParts.push(pearlSphere);
  // Swirling golden flame rings around the Flaming Pearl
  for (let fr = 0; fr < 2; fr++) {
    const ring = new THREE.TorusGeometry(2.25 + fr * 0.48, 0.14, 7, 24);
    ring.rotateX(fr === 0 ? 0.55 : -0.65);
    ring.rotateY(fr === 0 ? 0.42 : -0.42);
    ring.translate(pearlX, pearlY, pearlZ);
    goldAccentParts.push(ring);
  }
  for (let fl = 0; fl < 8; fl++) {
    const a = (fl / 8) * Math.PI * 2;
    const tongue = new THREE.ConeGeometry(0.24, 1.35, 5);
    tongue.rotateZ(a - Math.PI * 0.5);
    tongue.translate(pearlX + Math.cos(a) * 2.15, pearlY + Math.sin(a) * 2.15, pearlZ);
    goldAccentParts.push(tongue);
  }

  // Reflecting Lacquer Mirror Pool (*Hồ Sơn Mài Phản Chiếu*) & Low Curved Viewing Bridge (SEPARATED from dragonParts!)
  const mirrorPoolMat = new THREE.MeshPhysicalMaterial({
    color: '#1b080a',
    roughness: 0.05,
    metalness: 0.42,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });
  ctx.extraMaterials.push(mirrorPoolMat);
  const mirrorPoolGeo = new THREE.CircleGeometry(28.0, 36);
  mirrorPoolGeo.scale(1.22, 0.74, 1.0);
  mirrorPoolGeo.rotateX(-Math.PI * 0.5);
  const mirrorPool = new THREE.Mesh(mirrorPoolGeo, mirrorPoolMat);
  mirrorPool.position.set(cx, baseY + 0.09, cz - 14);
  group.add(mirrorPool);
  // Gilded lacquer pool rim & foreground viewing bridge with proper dark-ironwood & crimson-lacquer decking
  const bridgeDeckParts: THREE.BufferGeometry[] = [];
  const bridgeTrimParts: THREE.BufferGeometry[] = [];
  const poolRim = new THREE.TorusGeometry(28.2, 0.38, 8, 48);
  poolRim.rotateX(Math.PI * 0.5);
  poolRim.scale(1.22, 1.0, 0.74);
  poolRim.translate(cx, baseY + 0.18, cz - 14);
  goldAccentParts.push(poolRim);
  for (let seg = 0; seg < 10; seg++) {
    const t0 = seg / 10;
    const t1 = (seg + 1) / 10;
    const bx0 = cx - 22 + t0 * 44;
    const bx1 = cx - 22 + t1 * 44;
    const by0 = baseY + 0.35 + Math.sin(t0 * Math.PI) * 1.65;
    const by1 = baseY + 0.35 + Math.sin(t1 * Math.PI) * 1.65;
    const bym = (by0 + by1) * 0.5;
    const segL = Math.hypot(bx1 - bx0, by1 - by0) + 0.12;
    const tiltZ = Math.atan2(by1 - by0, bx1 - bx0);
    // FIX R38: Dedicated dark-ironwood deck & crimson lacquer edge fascia — NO dragon-scale shader on bridge!
    addBoxPart(bridgeDeckParts, segL, 0.28, 3.2, (bx0 + bx1) * 0.5, bym, cz + 6.5, 0, 0, tiltZ);
    for (const sz of [-1.66, 1.66]) {
      addBoxPart(bridgeTrimParts, segL, 0.32, 0.18, (bx0 + bx1) * 0.5, bym, cz + 6.5 + sz, 0, 0, tiltZ);
      goldAccentParts.push(...createPiercedBalustradeParts(bx0, cz + 6.5 + sz * 0.94, bx1, cz + 6.5 + sz * 0.94, bym + 0.14, 0.85, 'gold_pipe'));
    }
  }
  // 4 Carved Golden Dragon-Cloud Bridge End Finials + 2 Lacquer Incense Burner Pedestals + 6 Floating Golden Lotus Offerings on Mirror Pool
  for (const endX of [cx - 22, cx + 22]) {
    for (const sz of [-1.66, 1.66]) {
      addBoxPart(bridgeTrimParts, 0.55, 1.18, 0.55, endX, baseY + 0.65, cz + 6.5 + sz);
      goldAccentParts.push(
        new THREE.SphereGeometry(0.22, 7, 5).translate(endX, baseY + 1.38, cz + 6.5 + sz),
        new THREE.TorusGeometry(0.28, 0.055, 5, 10).translate(endX, baseY + 1.38, cz + 6.5 + sz)
      );
    }
    addCylPart(bridgeTrimParts, 0.48, 0.58, 1.15, 8, endX + (endX < cx ? -2.4 : 2.4), baseY + 0.58, cz + 6.5);
    goldAccentParts.push(
      new THREE.CylinderGeometry(0.36, 0.28, 0.38, 8).translate(endX + (endX < cx ? -2.4 : 2.4), baseY + 1.32, cz + 6.5)
    );
  }
  for (let fl = 0; fl < 6; fl++) {
    const la = (fl / 6) * Math.PI * 2 + 0.35;
    const lx = cx + Math.cos(la) * 14.5;
    const lz = cz - 14 + Math.sin(la) * 9.5;
    goldAccentParts.push(
      new THREE.CylinderGeometry(0.45, 0.22, 0.14, 7).translate(lx, baseY + 0.16, lz),
      new THREE.SphereGeometry(0.16, 6, 4).translate(lx, baseY + 0.26, lz)
    );
  }

  // Upgraded Sơn Mài Dragon Shader: UV-mapped overlapping scalloped scales + segmented cyan-gold ventral belly plates
  const dragonMat = new THREE.MeshPhysicalMaterial({
    color: '#c8102e',
    roughness: 0.24,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15
  });
  dragonMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;\nvarying vec3 vDNorm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vDUv = uv;
         vDNorm = normalize(normal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDUv;\nvarying vec3 vDNorm;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // UV-mapped overlapping scalloped dragon scales along body
         float row = floor(vDUv.x * 46.0);
         vec2 scUv = vec2(fract(vDUv.x * 46.0), fract(vDUv.y * 14.0 + mod(row, 2.0) * 0.5));
         float dSc = length((scUv - vec2(0.5, 0.35)) * vec2(1.0, 1.28));
         float scaleRim = smoothstep(0.42, 0.54, dSc) * (1.0 - smoothstep(0.54, 0.62, dSc));
         float scaleShade = mix(0.74, 1.08, 1.0 - clamp(dSc * 1.4, 0.0, 1.0));
         // Segmented ROYAL COBALT BLUE ventral belly plates with pale ivory-blue cross ribs (ref 07 — HV04-1!)
         float bellyMask = smoothstep(-0.18, -0.58, vDNorm.y);
         float bellyRib = smoothstep(0.76, 0.92, abs(sin(vDUv.x * 46.0 * 3.14159)));
         vec3 bellyCol = mix(vec3(0.13, 0.27, 0.71), vec3(0.75, 0.85, 0.98), bellyRib * 0.78);
         vec3 scaledCol = mix(diffuseColor.rgb * scaleShade, vec3(0.92, 0.72, 0.26), scaleRim * 0.85);
         diffuseColor.rgb = mix(scaledCol, bellyCol, bellyMask * 0.85);`
      );
  };
  ctx.extraMaterials.push(dragonMat);

  // FIX HV04-5: Unified sacred Long Vân golden aureole — 3 concentric rings linked by 16 radiating sun-rays & 8 cloud-scroll bridges (ref 07!)
  const haloParts: THREE.BufferGeometry[] = [...goldAccentParts];
  const haloCy = baseY + 24.0;
  const haloCz = cz - 42;
  for (const r of [14.0, 11.2, 8.6]) {
    const ring = new THREE.TorusGeometry(r, 0.35, 7, 42);
    ring.translate(cx, haloCy, haloCz);
    haloParts.push(ring);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const ray = new THREE.BoxGeometry(0.18, 6.2, 0.18);
    ray.rotateZ(a - Math.PI * 0.5);
    ray.translate(cx + Math.cos(a) * 11.3, haloCy + Math.sin(a) * 11.3, haloCz);
    haloParts.push(ray);
    if (i % 2 === 0) {
      const cloudFiligree = new THREE.TorusGeometry(1.15, 0.16, 5, 10, Math.PI);
      cloudFiligree.rotateZ(a - Math.PI * 0.5);
      cloudFiligree.translate(cx + Math.cos(a) * 14.3, haloCy + Math.sin(a) * 14.3, haloCz);
      haloParts.push(cloudFiligree);
    }
  }
  group.add(
    new THREE.Mesh(mergeNormalized(dragonParts), dragonMat),
    new THREE.Mesh(mergeNormalized(bridgeDeckParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bridgeTrimParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(maneParts), ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(haloParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(eyeAndPearlParts), pearlGlowMat)
  );

  // 2. FIX HV04-3 + HV04-4: 18 Tall Sharp Multi-Peak Sơn Mài Lacquer Karst Peaks & Organic Multi-Puff Emerald Jade Cloud Clusters!
  const peakParts: THREE.BufferGeometry[] = [];
  const jadeParts: THREE.BufferGeometry[] = [];
  const lvRand = mulberry32(40477);
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI * 0.92 + (i / 17) * Math.PI * 0.84;
    const dist = 44 + (i % 3) * 30;
    const px = cx + Math.cos(a) * dist * 1.35;
    const pz = cz - 16 + Math.sin(a) * dist * 0.85;
    const h = 16.5 + (i % 4) * 6.5;
    const py = ctx.getHeight(px, pz);
    // Sharp tapered primary karst spire + lower shoulder crag (lacquer painting mountain silhouette)
    const spire = createSculptedRockGeometry(7700 + i, 4.6 + (i % 3) * 1.6, h * 0.68, 4.4, 2);
    const spPos = spire.attributes.position;
    for (let vi = 0; vi < spPos.count; vi++) {
      const sy = spPos.getY(vi);
      const tH = clamp01((sy + h * 0.68) / (h * 1.36));
      const pinch = Math.pow(1.0 - tH * 0.72, 0.85);
      spPos.setX(vi, spPos.getX(vi) * pinch);
      spPos.setZ(vi, spPos.getZ(vi) * pinch);
    }
    spire.computeVertexNormals();
    spire.translate(px, py + h * 0.42, pz);
    peakParts.push(spire);
    // Flanking secondary shoulder peak
    const sh = h * 0.56;
    const subPeak = createSculptedRockGeometry(7750 + i, 3.6, sh * 0.6, 3.4, 1);
    subPeak.translate(px + (i % 2 === 0 ? 4.8 : -4.8), py + sh * 0.36, pz + 2.4);
    peakParts.push(subPeak);
  }
  // Organic clustered emerald jade clouds (replacing rigid 8×3 rectangular grid!)
  for (let i = 0; i < 20; i++) {
    const ca = (i / 20) * Math.PI * 1.6 - Math.PI * 0.8 + (lvRand() - 0.5) * 0.22;
    const cr = 26 + lvRand() * 68;
    const jx = cx + Math.cos(ca) * cr * 1.25;
    const jz = cz - 14 + Math.sin(ca) * cr * 0.82;
    const jy = baseY + 3.2 + lvRand() * 6.2;
    const mainR = 3.2 + lvRand() * 2.2;
    for (const [ox, oy, oz, sc] of [
      [0, 0, 0, 1.0],
      [mainR * 1.05, -0.35, 0.4, 0.68],
      [-mainR * 0.95, -0.25, -0.35, 0.72]
    ] as const) {
      const puff = new THREE.SphereGeometry(mainR * sc, 7, 5);
      puff.scale(1.65, 0.58, 1.08);
      puff.translate(jx + ox, jy + oy, jz + oz);
      jadeParts.push(puff);
    }
  }
  const lacquerPeakMat = new THREE.MeshPhysicalMaterial({
    color: '#a4221b',
    roughness: 0.20,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14
  });
  // FIX Bug B17: World-space vWorldPos.y + triplanar contour lines so gold lacquer contours stay locked on peaks!
  lacquerPeakMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNorm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNorm;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 wBlend = abs(normalize(vWorldNorm));
         wBlend = pow(wBlend, vec3(3.0));
         wBlend /= max(wBlend.x + wBlend.y + wBlend.z, 0.0001);
         float strataWave = sin(vWorldPos.x * 0.16 + vWorldPos.z * 0.14) * 0.55;
         float bandY = fract((vWorldPos.y + strataWave) * 0.30);
         float bandTri = fract(vWorldPos.x * 0.11 + vWorldPos.z * 0.11 + vWorldPos.y * 0.24);
         float lineY = 1.0 - smoothstep(0.0, 0.06, abs(bandY - 0.5) - 0.44);
         float lineTri = 1.0 - smoothstep(0.0, 0.055, abs(bandTri - 0.5) - 0.445);
         float goldLine = clamp(lineY * (0.76 + 0.24 * wBlend.y) + lineTri * 0.42 * (1.0 - wBlend.y), 0.0, 1.0);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.64, 0.23), goldLine * 0.90);`
      );
  };
  const jadeMat = new THREE.MeshStandardMaterial({
    color: '#5bbf6a',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.28,
    roughness: 0.28
  });
  ctx.extraMaterials.push(lacquerPeakMat, jadeMat);

  // 3. 48 Floating Kinh Bắc Nón Quai Thao Lantern Hats — FLAT drum crown, 24 glowing radial bamboo ribs & flowing 3.2m crimson silk ribbons (ref 07 — HV04-2!)
  const hatParts: THREE.BufferGeometry[] = [];
  const hatTop = new THREE.CylinderGeometry(0.84, 0.88, 0.10, 18);
  const hatFlatCrown = new THREE.CylinderGeometry(0.32, 0.34, 0.06, 14);
  hatFlatCrown.translate(0, 0.08, 0);
  const hatRim = new THREE.CylinderGeometry(0.88, 0.84, 0.20, 18, 1, true);
  hatRim.translate(0, -0.10, 0);
  hatParts.push(
    paintGeometryVertexColor(hatTop, '#f2d99b'),
    paintGeometryVertexColor(hatFlatCrown, '#e8c474'),
    paintGeometryVertexColor(hatRim, '#d9b568')
  );
  // 24 Dense glowing radial bamboo ribs beneath brim (12 full-diameter spokes)
  for (let rb = 0; rb < 12; rb++) {
    const a = (rb / 12) * Math.PI;
    const rib = new THREE.BoxGeometry(0.024, 0.022, 1.72);
    rib.rotateY(a);
    rib.translate(0, -0.06, 0);
    hatParts.push(paintGeometryVertexColor(rib, '#f7d88a'));
  }
  // Curved red silk chin-sling + long 3.2m flowing twin crimson silk ribbons (*quai thao dải lụa đỏ*)
  const slingLoop = new THREE.TorusGeometry(0.52, 0.036, 4, 10, Math.PI);
  slingLoop.rotateZ(Math.PI);
  slingLoop.translate(0, -0.10, 0);
  hatParts.push(paintGeometryVertexColor(slingLoop, '#e01828'));
  for (const side of [-1, 1]) {
    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.50, -0.12, 0),
      new THREE.Vector3(side * 0.64, -0.95, 0.18),
      new THREE.Vector3(side * 0.40, -2.05, -0.16),
      new THREE.Vector3(side * 0.56, -3.20, 0.14)
    ]);
    const ribTube = new THREE.TubeGeometry(ribCurve, 7, 0.056, 4, false);
    ribTube.scale(1.0, 1.0, 0.28);
    hatParts.push(paintGeometryVertexColor(ribTube, '#e01828'));
    const knot = new THREE.SphereGeometry(0.08, 5, 4);
    knot.translate(side * 0.50, -0.12, 0);
    hatParts.push(paintGeometryVertexColor(knot, '#f0b840'));
  }
  const hatGeo = mergeNormalized(hatParts);
  const nonTime = { uTime: { value: 0 } };
  animList.push(nonTime);
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#ffe0a0'),
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide
  });
  nonMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = nonTime.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 np = vec3(0.0);
       #ifdef USE_INSTANCING
       np = vec3(instanceMatrix[3].xyz);
       #endif
       transformed.y += sin(uTime * 0.85 + np.x * 0.15 + np.z * 0.15) * 1.25;`
    );
  };
  ctx.extraMaterials.push(nonMat);
  const nonInst = new THREE.InstancedMesh(hatGeo, nonMat, 48);
  const rand = mulberry32(77077);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rad = 28 + rand() * 88;
    setInstanceMatrix(nonInst, i, cx + Math.cos(a) * rad, baseY + 6.5 + rand() * 11.5, cz + Math.sin(a) * rad, 0.24, a, 0.14, 1.75, 1.75, 1.75);
  }
  nonInst.instanceMatrix.needsUpdate = true;

  // --- 200-Item Macro Visual QC & Expansion (089–102): Thung Lũng Sơn Mài Long Vân ---
  const lvExpCrimson: THREE.BufferGeometry[] = [];
  const lvExpGold: THREE.BufferGeometry[] = [];
  const lvExpWood: THREE.BufferGeometry[] = [];
  const lvExpStone: THREE.BufferGeometry[] = [];
  const lvExpJade: THREE.BufferGeometry[] = [];
  const lvExpOrb: THREE.BufferGeometry[] = [];

  // 089 & 100: 4 Monumental Bình Phong Sơn Mài curved folding screens with golden cloud-scroll finials
  for (const [sx, sz, sry] of [[cx - 28, cz - 4, 0.45], [cx + 28, cz - 4, -0.45], [cx - 32, cz - 24, 0.72], [cx + 32, cz - 24, -0.72]] as Array<[number, number, number]>) {
    const sy = ctx.getHeight(sx, sz);
    addBoxPart(lvExpStone, 7.6, 0.65, 1.45, sx, sy + 0.32, sz, sry);
    addBoxPart(lvExpCrimson, 6.8, 5.4, 0.32, sx, sy + 3.35, sz, sry);
    addBoxPart(lvExpGold, 7.2, 0.26, 0.42, sx, sy + 6.12, sz, sry);
    addCylPart(lvExpGold, 0.85, 0.85, 0.38, 12, sx, sy + 3.35, sz, Math.PI * 0.5, 0);
  }
  // 090 & 096 & 099: Lầu Thưởng Trà Sơn Mài open-air pavilion, nameplate stele & bonsai planters
  const teaPavZ = cz + 22;
  const teaPavY = ctx.getHeight(cx, teaPavZ);
  addBoxPart(lvExpStone, 10.4, 0.55, 7.4, cx, teaPavY + 0.28, teaPavZ);
  for (const [pxOff, pzOff] of [[-4.2, -2.8], [4.2, -2.8], [-4.2, 2.8], [4.2, 2.8]]) {
    addCylPart(lvExpCrimson, 0.20, 0.24, 4.2, 7, cx + pxOff, teaPavY + 2.6, teaPavZ + pzOff);
  }
  const lvPavRoof = createVietnameseCurvedRoofGeometry(12.2, 9.2, 6.4, 2.2, 2.2, 0.65);
  lvPavRoof.translate(cx, teaPavY + 4.7, teaPavZ);
  lvExpCrimson.push(lvPavRoof);
  addBoxPart(lvExpGold, 4.2, 1.6, 0.32, cx - 14.0, teaPavY + 1.1, teaPavZ + 2.0);
  for (const [bx, bz] of [[-12, 14], [12, 14], [-18, 18], [18, 18]] as Array<[number, number]>) {
    addBoxPart(lvExpCrimson, 1.4, 0.65, 1.4, cx + bx, baseY + 0.32, cz + bz);
    lvExpJade.push(new THREE.ConeGeometry(0.95, 1.85, 7).translate(cx + bx, baseY + 1.55, cz + bz));
  }
  // 091: 2 Golden Hạc Cưỡi Rùa cranes on tortoises flanking bridge ends
  for (const side of [-1, 1]) {
    const cxCrane = cx + side * 23.8;
    addCylPart(lvExpGold, 0.65, 0.78, 0.45, 8, cxCrane, baseY + 0.22, cz + 9.2);
    addCylPart(lvExpGold, 0.08, 0.14, 2.1, 6, cxCrane, baseY + 1.45, cz + 9.2);
    lvExpGold.push(new THREE.SphereGeometry(0.24, 6, 5).translate(cxCrane, baseY + 2.55, cz + 9.2));
  }
  // 092, 093, 095, 102: Terraced crimson retaining walls, mother-of-pearl stepping stones & pedestal lanterns
  for (let i = 0; i < 12; i++) {
    const a = (i / 11) * Math.PI - Math.PI;
    const rx = cx + Math.cos(a) * 42.0;
    const rz = cz - 14 + Math.sin(a) * 28.0;
    addBoxPart(lvExpCrimson, 11.5, 1.45, 0.85, rx, baseY + 0.72, rz, -a + Math.PI * 0.5);
  }
  for (let st = 0; st < 8; st++) {
    addCylPart(lvExpJade, 0.68, 0.72, 0.14, 8, cx + (st % 2 === 0 ? -0.8 : 0.8), baseY + 0.08, cz + 11.5 + st * 1.35);
    const lx = cx - 18 + st * 5.2;
    addCylPart(lvExpCrimson, 0.16, 0.20, 2.2, 6, lx, baseY + 1.1, cz + 12.2);
    lvExpOrb.push(createLanternCoreGeometry(0.22, 0.36).translate(lx, baseY + 2.38, cz + 12.2));
  }
  // 094, 097, 101: 12 Golden-lacquered bamboo clusters, extra lotus pads & rear cascade plinth
  for (let bm = 0; bm < 12; bm++) {
    const ba = (bm / 12) * Math.PI * 2;
    const bx = cx + Math.cos(ba) * 48.0;
    const bz = cz - 10 + Math.sin(ba) * 34.0;
    const by = ctx.getHeight(bx, bz);
    for (let k = 0; k < 3; k++) {
      addCylPart(lvExpGold, 0.06, 0.08, 5.4, 5, bx + (k - 1) * 0.45, by + 2.7, bz);
    }
  }
  addBoxPart(lvExpStone, 18.0, 4.5, 4.2, cx, baseY + 2.25, cz - 46);

  // --- Wave 2 Macro Visual QC & Expansion (289–302): Long Vân Lacquer Craft Workshop & Display Easels ---
  // 289, 291, 292, 300, 302: Hạ Thái lacquer craft workshop pavilion, grinding workbenches, vóc drying rack, sap barrels & hanging lanterns
  const wsX = cx + 32;
  const wsZ = cz + 14;
  const wsY = ctx.getHeight(wsX, wsZ);
  addBoxPart(lvExpStone, 10.4, 0.42, 6.8, wsX, wsY + 0.21, wsZ);
  for (const [ox, oz] of [[-4.4, -2.6], [4.4, -2.6], [-4.4, 2.6], [4.4, 2.6]]) {
    addCylPart(lvExpCrimson, 0.16, 0.18, 3.4, 5, wsX + ox, wsY + 2.1, wsZ + oz);
  }
  addConePart(lvExpCrimson, 7.6, 2.1, 4, wsX, wsY + 4.85, wsZ, Math.PI * 0.25);
  for (const bxOff of [-2.2, 2.2]) {
    addBoxPart(lvExpWood, 2.4, 0.82, 1.1, wsX + bxOff, wsY + 0.82, wsZ);
    addBoxPart(lvExpStone, 0.9, 0.26, 0.65, wsX + bxOff, wsY + 1.35, wsZ);
  }
  addBoxPart(lvExpWood, 2.6, 1.85, 0.65, wsX + 6.4, wsY + 0.92, wsZ);
  for (let k = 0; k < 4; k++) {
    addCylPart(lvExpWood, 0.34, 0.38, 0.78, 6, wsX + 6.6 + (k % 2) * 0.9, wsY + 0.39, wsZ + 2.6 + Math.floor(k / 2) * 0.9);
  }
  for (const lxOff of [-3.2, -1.1, 1.1, 3.2]) {
    addConePart(lvExpOrb, 0.28, 0.24, 5, wsX + lxOff, wsY + 3.45, wsZ + 2.8);
  }
  // 290: 6 Angled dark-wood lacquer display easels in semicircular outdoor gallery
  for (let e = 0; e < 6; e++) {
    const ea = -Math.PI * 0.35 + (e / 5) * Math.PI * 0.7;
    const ex = cx - 22 + Math.cos(ea) * 9.5;
    const ez = cz + 14 + Math.sin(ea) * 7.5;
    const ey = ctx.getHeight(ex, ez);
    addBoxPart(lvExpWood, 0.12, 2.2, 0.12, ex - 0.55, ey + 1.1, ez, -ea);
    addBoxPart(lvExpWood, 0.12, 2.2, 0.12, ex + 0.55, ey + 1.1, ez, -ea);
    addBoxPart(lvExpCrimson, 1.65, 1.25, 0.10, ex, ey + 1.45, ez, -ea, -0.18, 0);
    addBoxPart(lvExpGold, 1.42, 1.02, 0.12, ex, ey + 1.45, ez, -ea, -0.18, 0);
  }
  // 293 & 294: 4 Lacquer vase pedestals & mother-of-pearl inlay relief wall
  for (const [vx, vz] of [[-14, 22], [-10, 22], [10, 22], [14, 22]] as Array<[number, number]>) {
    addBoxPart(lvExpCrimson, 0.95, 1.1, 0.95, cx + vx, baseY + 0.55, cz + vz);
    addCylPart(lvExpGold, 0.22, 0.34, 0.85, 6, cx + vx, baseY + 1.52, cz + vz);
  }
  addBoxPart(lvExpStone, 10.2, 3.2, 0.55, cx - 34, ctx.getHeight(cx - 34, cz + 14) + 1.6, cz + 14, 0.35);
  addBoxPart(lvExpJade, 9.2, 2.4, 0.62, cx - 34, ctx.getHeight(cx - 34, cz + 14) + 1.65, cz + 14, 0.35);
  // 295–299 & 301: Southern lacquer gateway arch, artisan tea table, secondary footbridge, 6 jade bollards, sap planters & 3 process lecterns
  addCylPart(lvExpCrimson, 0.22, 0.26, 4.8, 6, cx - 3.6, teaPavY + 2.4, teaPavZ + 11.5);
  addCylPart(lvExpCrimson, 0.22, 0.26, 4.8, 6, cx + 3.6, teaPavY + 2.4, teaPavZ + 11.5);
  addBoxPart(lvExpCrimson, 8.6, 0.65, 0.95, cx, teaPavY + 4.9, teaPavZ + 11.5);
  addBoxPart(lvExpGold, 8.8, 0.20, 1.05, cx, teaPavY + 5.32, teaPavZ + 11.5);
  addBoxPart(lvExpCrimson, 2.2, 0.65, 1.4, cx, teaPavY + 0.88, teaPavZ);
  addBoxPart(lvExpCrimson, 9.2, 0.22, 2.4, cx + 22, baseY + 0.45, cz + 10.5, 0.25);
  for (let b = 0; b < 6; b++) {
    const bx = cx - 26 + b * 3.8;
    addCylPart(lvExpJade, 0.12, 0.14, 1.15, 5, bx, baseY + 0.58, cz + 23.5);
    addConePart(lvExpOrb, 0.14, 0.26, 5, bx, baseY + 1.28, cz + 23.5);
  }
  for (const [px, pz] of [[wsX - 5.5, wsZ + 4.2], [wsX + 5.5, wsZ + 4.2], [wsX - 5.5, wsZ - 4.2], [wsX + 5.5, wsZ - 4.2]] as Array<[number, number]>) {
    addBoxPart(lvExpStone, 1.1, 0.52, 1.1, px, wsY + 0.26, pz);
    addConePart(lvExpGold, 0.65, 1.25, 5, px, wsY + 1.1, pz);
  }
  for (const lx of [cx - 6, cx, cx + 6]) {
    addBoxPart(lvExpWood, 0.85, 0.95, 0.45, lx, teaPavY + 0.48, teaPavZ + 7.2);
    addBoxPart(lvExpGold, 0.82, 0.08, 0.52, lx, teaPavY + 0.98, teaPavZ + 7.2, 0, 0.35, 0);
  }

  // --- Wave 3 Macro Visual QC & Expansion (573–600): Lacquerware Gallery Pavilions, Gilded Screens & Bonsai Rockeries ---
  const w3LvCrimson: THREE.BufferGeometry[] = [];
  const w3LvGold: THREE.BufferGeometry[] = [];
  const w3LvWood: THREE.BufferGeometry[] = [];
  const w3LvStone: THREE.BufferGeometry[] = [];
  const w3LvJade: THREE.BufferGeometry[] = [];
  const w3LvOrb: THREE.BufferGeometry[] = [];
  // 573 & 574: Western Lacquerware Gallery Pavilion & Northern Masterpiece Gallery Pavilion (outside mirrorPool and screen 089!)
  const wgX = cx - 36;
  const wgZ = cz + 6;
  const wgY = ctx.getHeight(wgX, wgZ);
  addW3Plinth(w3LvStone, 9.8, 6.4, wgY + 0.48, wgY, wgX, wgZ);
  for (const [ox, oz] of [[-4.0, -2.4], [4.0, -2.4], [-4.0, 2.4], [4.0, 2.4]]) {
    addW3GroundedCol(w3LvCrimson, 0.14, 0.16, wgY + 3.55, wgY + 0.48, 5, wgX + ox, wgZ + oz);
  }
  addW3HipRoof(w3LvCrimson, w3LvGold, 10.8, 7.4, wgY + 3.55, 1.55, wgX, wgZ);
  // 589: 8 Suspended gallery lanterns along western pavilion eaves
  for (let l = 0; l < 4; l++) {
    addConePart(w3LvOrb, 0.18, 0.32, 5, wgX - 3.0 + l * 2.0, wgY + 3.2, wgZ + 2.8);
    addConePart(w3LvOrb, 0.18, 0.32, 5, wgX - 3.0 + l * 2.0, wgY + 3.2, wgZ - 2.8);
  }
  const ngX = cx + 24;
  const ngZ = cz - 36;
  const ngY = ctx.getHeight(ngX, ngZ);
  addW3Plinth(w3LvStone, 8.2, 5.8, ngY + 0.55, ngY, ngX, ngZ);
  for (const [ox, oz] of [[-3.2, -2.1], [3.2, -2.1], [-3.2, 2.1], [3.2, 2.1]]) {
    addW3GroundedCol(w3LvCrimson, 0.13, 0.15, ngY + 3.45, ngY + 0.55, 5, ngX + ox, ngZ + oz);
  }
  addW3HipRoof(w3LvJade, w3LvGold, 9.2, 6.8, ngY + 3.45, 1.45, ngX, ngZ);
  // 575 & 576: Pair of zigzagging 4-panel gilded folding screens & 4 cloud-scroll lacquer pedestals
  for (const side of [-1, 1]) {
    for (let p = 0; p < 4; p++) {
      const px = wgX + side * 6.8 + p * 0.85 * side;
      const pz = wgZ + 4.8 + (p % 2 === 0 ? -0.25 : 0.25);
      addBoxPart(w3LvCrimson, 0.92, 2.15, 0.10, px, wgY + 1.08, pz, p % 2 === 0 ? 0.35 : -0.35);
      addBoxPart(w3LvGold, 0.72, 1.75, 0.12, px, wgY + 1.08, pz, p % 2 === 0 ? 0.35 : -0.35);
    }
    for (const pzOff of [-1.2, 1.2]) {
      addBoxPart(w3LvCrimson, 0.92, 1.05, 0.92, wgX + side * 2.2, wgY + 1.0, wgZ + pzOff);
      addCylPart(w3LvGold, 0.22, 0.32, 0.78, 6, wgX + side * 2.2, wgY + 1.92, wgZ + pzOff);
    }
  }
  // 577: 6 Mother-of-pearl inlay viewing benches facing the mirror pool
  for (let b = 0; b < 6; b++) {
    const bx = cx - 18 + b * 7.2;
    const bz = cz + 25.5;
    const by = ctx.getHeight(bx, bz);
    addBoxPart(w3LvWood, 2.2, 0.45, 0.62, bx, by + 0.22, bz);
    addBoxPart(w3LvJade, 2.0, 0.08, 0.48, bx, by + 0.48, bz);
  }
  // 578 & 579: Eastern & western sculpted bonsai rockery basins
  for (const [rx, rz] of [[cx + 18, cz + 20], [cx - 18, cz + 20]] as Array<[number, number]>) {
    const ry = ctx.getHeight(rx, rz);
    addCylPart(w3LvStone, 2.4, 2.6, 0.62, 6, rx, ry + 0.31, rz);
    addConePart(w3LvStone, 1.25, 2.1, 5, rx, ry + 1.55, rz);
    addConePart(w3LvGold, 0.72, 0.95, 5, rx + 0.45, ry + 2.25, rz);
  }
  // 580–582, 588, 594, 597: Gold-leaf table, shell-cutting station, eggshell cabinet, pigment mortars, brush rack & polishing cistern
  addBoxPart(w3LvWood, 2.2, 0.82, 1.05, wsX, wsY + 0.83, wsZ - 1.6);
  addBoxPart(w3LvGold, 1.6, 0.08, 0.75, wsX, wsY + 1.28, wsZ - 1.6);
  addBoxPart(w3LvWood, 2.0, 0.82, 1.0, wsX - 6.2, wsY + 0.41, wsZ + 1.8);
  addBoxPart(w3LvJade, 1.2, 0.14, 0.65, wsX - 6.2, wsY + 0.88, wsZ + 1.8);
  addBoxPart(w3LvCrimson, 1.8, 1.95, 0.68, wsX - 6.2, wsY + 0.98, wsZ - 1.6);
  for (let m = 0; m < 3; m++) addCylPart(w3LvStone, 0.24, 0.20, 0.38, 6, wsX + 4.8, wsY + 0.55, wsZ - 1.8 + m * 1.1);
  addBoxPart(w3LvWood, 1.1, 1.25, 0.32, wsX + 4.8, wsY + 0.85, wsZ + 2.2);
  addBoxPart(w3LvStone, 2.6, 0.75, 1.4, wsX + 2.2, wsY + 0.38, wsZ - 5.2);
  // 583–587, 590–593, 595–596, 598–600: 6 floating lantern piers, 4 scroll steles, moon-gate, bridge dragon finials, 6 jade stepping-stones, bonsai shelves, cascade water-spouts, entrance guardian plinths, dragon-boat sculpture, terrace balustrades, compass medallion, 4 bamboo planters, stone chime stand & valley lantern signpost
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addW3GroundedCol(w3LvStone, 0.32, 0.38, baseY + 0.95, baseY - 0.5, 5, cx + Math.cos(a) * 14.5, cz - 14.0 + Math.sin(a) * 10.5);
    addConePart(w3LvOrb, 0.22, 0.38, 5, cx + Math.cos(a) * 14.5, baseY + 1.15, cz - 14.0 + Math.sin(a) * 10.5);
    addBoxPart(w3LvJade, 1.15, 0.12, 1.15, cx + 17.5, baseY + 0.12, cz + 7.5 + i * 2.2);
  }
  for (let s = 0; s < 4; s++) {
    addW3GroundedPost(w3LvCrimson, 0.85, 0.28, baseY + 2.65, baseY, cx - 35.5, cz - 16 + s * 5.2);
    addBoxPart(w3LvGold, 0.62, 1.85, 0.32, cx - 35.5, baseY + 1.55, cz - 16 + s * 5.2);
    addBoxPart(w3LvStone, 2.6, 0.48, 0.85, cx - 32 + s * 2.4, baseY + 0.24, cz + 18.5);
  }
  // 585: Crimson moon-gate portal
  for (const ox of [-2.1, 2.1]) addW3GroundedPost(w3LvCrimson, 0.55, 0.55, teaPavY + 3.8, teaPavY, cx + 16 + ox, teaPavZ + 2.0);
  addBoxPart(w3LvCrimson, 5.2, 0.55, 0.62, cx + 16, teaPavY + 3.95, teaPavZ + 2.0);
  addBoxPart(w3LvGold, 5.4, 0.16, 0.68, cx + 16, teaPavY + 4.3, teaPavZ + 2.0);
  // 586, 590–593, 595–596, 599–600
  for (const side of [-1, 1]) {
    addW3GroundedPost(w3LvGold, 0.35, 0.35, baseY + 1.85, baseY, cx + side * 4.5, cz + 16.0);
    addBoxPart(w3LvCrimson, 1.8, 1.1, 0.65, cx + side * 8.5, teaPavY + 0.55, teaPavZ + 4.2);
    addCylPart(w3LvGold, 0.14, 0.18, 1.45, 5, cx + side * 4.2, baseY + 3.4, cz - 43.8, Math.PI * 0.5, 0);
    addBoxPart(w3LvCrimson, 1.35, 1.45, 1.35, cx + side * 6.2, teaPavY + 0.72, teaPavZ + 11.5);
    addConePart(w3LvOrb, 0.38, 0.55, 5, cx + side * 6.2, teaPavY + 1.72, teaPavZ + 11.5);
    addBoxPart(w3LvCrimson, 12.0, 0.14, 0.14, cx + side * 12.0, teaPavY + 0.92, teaPavZ + 9.2);
  }
  addBoxPart(w3LvStone, 3.2, 0.75, 1.25, cx - 10.5, teaPavY + 0.38, teaPavZ + 4.2);
  addBoxPart(w3LvCrimson, 2.6, 0.55, 0.65, cx - 10.5, teaPavY + 1.02, teaPavZ + 4.2);
  addCylPart(w3LvJade, 2.4, 2.4, 0.08, 6, cx, teaPavY + 0.06, teaPavZ + 4.5);
  addW3GroundedPost(w3LvCrimson, 0.10, 0.10, baseY + 2.25, baseY, cx + 11.5, cz + 14.5);
  addW3GroundedPost(w3LvCrimson, 0.10, 0.10, baseY + 2.25, baseY, cx + 13.5, cz + 14.5);
  addBoxPart(w3LvCrimson, 2.4, 0.12, 0.12, cx + 12.5, baseY + 2.22, cz + 14.5);
  for (const jxOff of [-0.55, 0, 0.55]) addBoxPart(w3LvJade, 0.24, 0.85, 0.08, cx + 12.5 + jxOff, baseY + 1.65, cz + 14.5);
  addW3GroundedCol(w3LvCrimson, 0.10, 0.12, teaPavY + 3.4, teaPavY, 5, cx + 8.5, teaPavZ + 13.5);
  addConePart(w3LvOrb, 0.24, 0.42, 5, cx + 8.5, teaPavY + 3.65, teaPavZ + 13.5);

  addWave3Mesh(group, w3LvCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(group, w3LvGold, ctx.materials.gold);
  addWave3Mesh(group, w3LvWood, ctx.materials.darkWood);
  addWave3Mesh(group, w3LvStone, ctx.materials.stone);
  addWave3Mesh(group, w3LvJade, jadeMat);
  addWave3Mesh(group, w3LvOrb, pearlGlowMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (974–1001): Sơn Mài Sap Grove, Eggshell Pavilion, Curing Chamber & Dragon Fountain ---
  const w4LvCrimson: THREE.BufferGeometry[] = [];
  const w4LvGold: THREE.BufferGeometry[] = [];
  const w4LvWood: THREE.BufferGeometry[] = [];
  const w4LvStone: THREE.BufferGeometry[] = [];
  const w4LvJade: THREE.BufferGeometry[] = [];
  const w4LvOrb: THREE.BufferGeometry[] = [];
  // 974 & 975: Lacquer-tree sap-tapping grove & eggshell-inlay artisan pavilion (cx + 42, cz + 14)
  for (let t = 0; t < 3; t++) {
    const tx = cx + 52;
    const tz = cz - 4 + t * 5.2;
    const ty = ctx.getHeight(tx, tz);
    addW3GroundedCol(w4LvWood, 0.16, 0.22, ty + 2.8, ty, 5, tx, tz);
    addCylPart(w4LvJade, 0.14, 0.12, 0.22, 5, tx - 0.24, ty + 1.15, tz);
  }
  const egX = cx + 42;
  const egZ = cz + 14;
  const egY = Math.max(ctx.getHeight(egX, egZ), ctx.getHeight(egX + 3, egZ));
  addW3Plinth(w4LvStone, 7.6, 5.2, egY + 0.42, egY, egX, egZ);
  for (const [ox, oz] of [[-3.1, -1.9], [3.1, -1.9], [-3.1, 1.9], [3.1, 1.9]]) addW3GroundedCol(w4LvCrimson, 0.12, 0.14, egY + 3.15, egY + 0.42, 5, egX + ox, egZ + oz);
  addW3HipRoof(w4LvCrimson, w4LvGold, 8.4, 6.0, egY + 3.15, 1.25, egX, egZ);
  // 976–982: Polishing table, cinnabar mortar, dragon-head fountain, lacquer-curing hut (cx - 46, cz - 14), 4 easels, jade bridge & phoenix pillars
  addBoxPart(w4LvWood, 2.4, 0.85, 1.15, egX, egY + 0.85, egZ);
  addCylPart(w4LvStone, 0.34, 0.28, 0.45, 6, egX - 2.4, egY + 0.65, egZ + 1.2);
  addCylPart(w4LvJade, 2.2, 2.4, 0.55, 6, cx + 36, ctx.getHeight(cx + 36, cz + 28) + 0.28, cz + 28);
  addCylPart(w4LvGold, 0.24, 0.34, 1.45, 5, cx + 36, ctx.getHeight(cx + 36, cz + 28) + 1.15, cz + 28);
  const cuX = cx - 46;
  const cuZ = cz - 14;
  const cuY = Math.max(ctx.getHeight(cuX, cuZ), ctx.getHeight(cuX - 2, cuZ));
  addW3Plinth(w4LvStone, 4.8, 3.8, cuY + 0.35, cuY, cuX, cuZ);
  addBoxPart(w4LvWood, 3.8, 2.45, 2.8, cuX, cuY + 1.58, cuZ);
  addW3HipRoof(w4LvJade, w4LvGold, 4.8, 3.8, cuY + 2.8, 0.95, cuX, cuZ);
  for (let e = 0; e < 4; e++) {
    const ex = cx - 22 + e * 14.5;
    const ez = cz + 38;
    const ey = ctx.getHeight(ex, ez);
    addBoxPart(w4LvCrimson, 1.4, 1.9, 0.14, ex, ey + 1.15, ez, 0, -0.18, 0);
    addBoxPart(w4LvGold, 1.1, 1.4, 0.18, ex, ey + 1.18, ez + 0.04, 0, -0.18, 0);
  }
  addBoxPart(w4LvWood, 6.2, 0.24, 2.1, cx + 34, ctx.getHeight(cx + 34, cz - 16) + 0.48, cz - 16);
  for (const s of [-1, 1]) {
    addW3GroundedCol(w4LvCrimson, 0.22, 0.26, egY + 4.2, egY, 6, egX - 6.8, egZ + s * 3.2);
    addConePart(w4LvGold, 0.32, 0.55, 4, egX - 6.8, egY + 4.48, egZ + s * 3.2);
  }
  // 983–1001: 4 vase plinths, brush rack, 6 lanterns, gong arch, drying horse, 4 stone benches, 2 flagpoles, bronze lectern, 4 jade urns, resin brazier, scroll pergola, carp finial, panel stack, water steps, incense altar, 6 bollards, tea set, dragon vane & welcome stele
  for (let v = 0; v < 4; v++) {
    const vx = cx + (v < 2 ? -42 : 42);
    const vz = cz + (v % 2 === 0 ? -32 : 34);
    addBoxPart(w4LvCrimson, 0.92, 1.15, 0.92, vx, ctx.getHeight(vx, vz) + 0.58, vz);
    addCylPart(w4LvGold, 0.24, 0.18, 0.55, 6, vx, ctx.getHeight(vx, vz) + 1.42, vz);
  }
  addBoxPart(w4LvWood, 1.4, 1.15, 0.42, egX + 5.2, egY + 0.58, egZ);
  for (let l = 0; l < 6; l++) {
    const lx = cx - 30 + l * 12;
    const lz = cz + 44;
    addW3GroundedPost(w4LvJade, 0.28, 0.28, ctx.getHeight(lx, lz) + 1.45, ctx.getHeight(lx, lz), lx, lz);
    addConePart(w4LvOrb, 0.22, 0.34, 4, lx, ctx.getHeight(lx, lz) + 1.62, lz);
  }
  for (const ox of [-1.2, 1.2]) addW3GroundedCol(w4LvCrimson, 0.10, 0.12, baseY + 2.8, baseY, 5, cx - 24 + ox, cz + 32);
  addCylPart(w4LvGold, 0.55, 0.55, 0.12, 6, cx - 24, baseY + 1.85, cz + 32, Math.PI * 0.5, 0);
  addBoxPart(w4LvWood, 2.2, 1.45, 0.65, cuX + 4.8, cuY + 0.72, cuZ);
  for (let b = 0; b < 4; b++) addBoxPart(w4LvStone, 2.1, 0.48, 0.62, cx + (b < 2 ? -28 : 28), baseY + 0.24, cz + 26 + (b % 2) * 8);
  for (const s of [-1, 1]) addW3GroundedCol(w4LvGold, 0.06, 0.08, baseY + 6.2, baseY, 5, cx + s * 16, cz + 46);
  addBoxPart(w4LvStone, 0.85, 0.95, 0.55, cx, baseY + 0.48, cz + 48);
  for (let u = 0; u < 4; u++) addCylPart(w4LvJade, 0.34, 0.26, 0.78, 6, cx + (u < 2 ? -18 : 18), baseY + 0.39, cz - 42 + (u % 2) * 8);
  addCylPart(w4LvStone, 0.55, 0.62, 0.58, 6, cuX - 4.2, cuY + 0.29, cuZ);
  for (let p = 0; p < 4; p++) addW3GroundedCol(w4LvCrimson, 0.09, 0.11, baseY + 3.0, baseY, 5, cx - 44, cz + 20 + p * 3.2);
  addBoxPart(w4LvGold, 0.35, 0.22, 10.2, cx - 44, baseY + 3.0, cz + 24.8);
  addBoxPart(w4LvJade, 1.25, 0.95, 1.25, cx, baseY + 0.48, cz - 48);
  addConePart(w4LvGold, 0.45, 1.45, 5, cx, baseY + 1.65, cz - 48);
  addBoxPart(w4LvWood, 2.6, 0.65, 1.25, cuX, cuY + 0.32, cuZ + 4.4);
  addBoxPart(w4LvStone, 12.0, 0.35, 2.2, cx, baseY + 0.18, cz - 44);
  addBoxPart(w4LvCrimson, 1.85, 0.95, 0.88, ngX, ngY + 0.48, ngZ + 5.2);
  for (let b = 0; b < 6; b++) addW3GroundedPost(w4LvCrimson, 0.24, 0.24, baseY + 1.05, baseY, cx - 25 + b * 10, cz + 50);
  addBoxPart(w4LvCrimson, 1.35, 0.52, 0.92, egX, egY + 0.68, egZ + 4.2);
  addW3GroundedCol(w4LvGold, 0.05, 0.07, baseY + 5.8, baseY, 5, cx + 48, cz - 28);
  addBoxPart(w4LvStone, 1.65, 2.45, 0.42, cx, baseY + 1.22, cz + 54);

  addWave3Mesh(group, w4LvCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(group, w4LvGold, ctx.materials.gold);
  addWave3Mesh(group, w4LvWood, ctx.materials.darkWood);
  addWave3Mesh(group, w4LvStone, ctx.materials.stone);
  addWave3Mesh(group, w4LvJade, jadeMat);
  addWave3Mesh(group, w4LvOrb, pearlGlowMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1374–1401): Hạ Thái Gallery Pavilion, Sơn Mài Craft Stations & Moon Gate ---
  const w5LvCrimson: THREE.BufferGeometry[] = [];
  const w5LvGold: THREE.BufferGeometry[] = [];
  const w5LvWood: THREE.BufferGeometry[] = [];
  const w5LvStone: THREE.BufferGeometry[] = [];
  const w5LvJade: THREE.BufferGeometry[] = [];
  const w5LvOrb: THREE.BufferGeometry[] = [];
  // 1374 & 1375: Hạ Thái Master Lacquer Gallery Pavilion (cx - 46, cz + 14) & Gold-Leaf Workbench
  const htX = cx - 46;
  const htZ = cz + 14;
  const htY = Math.max(ctx.getHeight(htX, htZ), ctx.getHeight(htX - 3, htZ));
  addW3Plinth(w5LvStone, 7.2, 5.0, htY + 0.42, htY, htX, htZ);
  for (const [ox, oz] of [[-2.9, -1.8], [2.9, -1.8], [-2.9, 1.8], [2.9, 1.8]]) addW3GroundedCol(w5LvCrimson, 0.12, 0.14, htY + 3.15, htY + 0.42, 5, htX + ox, htZ + oz);
  addW3HipRoof(w5LvCrimson, w5LvGold, 8.0, 5.8, htY + 3.15, 1.25, htX, htZ);
  addBoxPart(w5LvWood, 2.2, 0.85, 1.05, htX, htY + 0.85, htZ);
  addBoxPart(w5LvGold, 0.72, 0.18, 0.55, htX, htY + 1.36, htZ);
  // 1376–1383: 3 raw-lacquer vats, water-sanding stone basin, cotton-gauze frame, northern moon gate, 4 sculpture plinths, charcoal mill, 6 jade pool lanterns & 4 masterpiece vitrines
  for (let v = 0; v < 3; v++) addCylPart(w5LvJade, 0.34, 0.28, 0.72, 6, cuX - 3.6 + v * 1.1, cuY + 0.36, cuZ - 4.2);
  addBoxPart(w5LvStone, 2.6, 0.72, 1.15, egX, egY + 0.36, egZ - 4.8);
  addBoxPart(w5LvWood, 1.85, 1.65, 0.22, cuX + 5.2, cuY + 0.82, cuZ - 3.8);
  for (const s of [-1, 1]) addW3GroundedPost(w5LvCrimson, 0.65, 0.65, baseY + 4.4, baseY, cx + s * 3.6, cz - 54);
  addBoxPart(w5LvCrimson, 8.6, 0.58, 0.72, cx, baseY + 4.4, cz - 54);
  addW3HipRoof(w5LvJade, w5LvGold, 9.2, 1.8, baseY + 4.68, 0.88, cx, cz - 54);
  for (const [sx, sz] of [[-34, -42], [34, -42], [-34, 44], [34, 44]]) {
    const sy = ctx.getHeight(cx + sx, cz + sz);
    addBoxPart(w5LvJade, 1.15, 1.15, 1.15, cx + sx, sy + 0.58, cz + sz);
    addConePart(w5LvGold, 0.38, 0.75, 4, cx + sx, sy + 1.52, cz + sz);
  }
  addCylPart(w5LvStone, 0.36, 0.38, 0.48, 6, cuX - 5.2, cuY + 0.24, cuZ + 2.8);
  for (let l = 0; l < 6; l++) {
    const lx = cx - 25 + l * 10;
    addW3GroundedPost(w5LvJade, 0.26, 0.26, baseY + 1.55, baseY, lx, cz - 48);
    addConePart(w5LvOrb, 0.20, 0.32, 4, lx, baseY + 1.72, cz - 48);
  }
  for (let mv = 0; mv < 4; mv++) {
    const vz = cz - 24 + mv * 16;
    const vy = ctx.getHeight(cx + 52, vz);
    addBoxPart(w5LvCrimson, 0.42, 2.1, 1.45, cx + 52, vy + 1.05, vz);
    addBoxPart(w5LvGold, 0.48, 1.55, 1.05, cx + 52, vy + 1.12, vz);
  }
  // 1384–1392: Phoenix garden arch, straining tripod, 8 jade stepping stones, pigment shelf, lotus fountain, 4 curved benches, eggshell mortar, 2 incense cauldrons & 4 balustrade segments
  for (const s of [-1, 1]) addW3GroundedCol(w5LvCrimson, 0.11, 0.13, egY + 3.6, egY, 5, egX - 8.5, egZ + s * 2.2);
  addBoxPart(w5LvGold, 0.28, 0.28, 5.0, egX - 8.5, egY + 3.55, egZ);
  addConePart(w5LvWood, 0.48, 1.25, 4, cuX + 4.8, cuY + 0.62, cuZ + 3.2);
  for (let st = 0; st < 8; st++) addBoxPart(w5LvJade, 1.15, 0.10, 0.85, htX + 6 + st * 1.8, baseY + 0.05, htZ - st * 2.4);
  addBoxPart(w5LvWood, 1.65, 1.25, 0.48, htX - 5.2, htY + 0.62, htZ);
  addCylPart(w5LvJade, 1.65, 1.85, 0.55, 6, htX, htY + 0.28, htZ + 6.8);
  addConePart(w5LvGold, 0.36, 0.72, 5, htX, htY + 0.92, htZ + 6.8);
  for (let b = 0; b < 4; b++) addBoxPart(w5LvStone, 2.2, 0.48, 0.62, cx + (b < 2 ? -18 : 18), baseY + 0.24, cz - 36 + (b % 2) * 8);
  addBoxPart(w5LvWood, 1.45, 0.78, 0.78, egX + 5.8, egY + 0.39, egZ + 3.2);
  for (const s of [-1, 1]) addCylPart(w5LvGold, 0.45, 0.35, 0.82, 6, cx + s * 6.5, baseY + 0.41, cz - 52);
  for (let bs = 0; bs < 4; bs++) addBoxPart(w5LvCrimson, 4.2, 0.82, 0.24, cx + (bs < 2 ? -22 + bs * 8 : 14 + (bs - 2) * 8), baseY + 0.41, cz + 56);
  // 1393–1401: Sap-bucket rack, 6 pearl-glow lamps, folding screen, drying cabinet, 4 crane posts, 3 timeline lecterns, jade drum cradle, rain-chain basin & outer southern arch stele
  addBoxPart(w5LvWood, 1.45, 1.05, 0.48, cx + 56, ctx.getHeight(cx + 56, cz + 2) + 0.52, cz + 2);
  for (let pl = 0; pl < 6; pl++) {
    const lx = cx - 30 + pl * 12;
    addW3GroundedCol(w5LvStone, 0.14, 0.18, baseY + 1.85, baseY, 5, lx, cz + 58);
    addConePart(w5LvOrb, 0.22, 0.34, 4, lx, baseY + 2.02, cz + 58);
  }
  addBoxPart(w5LvCrimson, 3.4, 2.05, 0.22, htX + 6.2, htY + 1.02, htZ + 3.2);
  addBoxPart(w5LvGold, 2.8, 1.55, 0.26, htX + 6.2, htY + 1.08, htZ + 3.2);
  addBoxPart(w5LvWood, 1.85, 1.55, 0.72, cuX - 4.8, cuY + 0.78, cuZ + 3.2);
  for (const [cxP, czP] of [[-54, -48], [54, -48], [-54, 52], [54, 52]]) {
    const py = ctx.getHeight(cx + cxP, cz + czP);
    addW3GroundedCol(w5LvCrimson, 0.10, 0.12, py + 3.6, py, 5, cx + cxP, cz + czP);
    addConePart(w5LvGold, 0.24, 0.42, 4, cx + cxP, py + 3.82, cz + czP);
  }
  for (let tl = 0; tl < 3; tl++) addBoxPart(w5LvStone, 0.92, 1.02, 0.52, cx - 8 + tl * 8, baseY + 0.51, cz + 52);
  addBoxPart(w5LvCrimson, 1.35, 0.85, 0.85, ngX - 6.2, ngY + 0.42, ngZ + 5.2);
  addCylPart(w5LvGold, 0.38, 0.38, 0.62, 6, ngX - 6.2, ngY + 1.05, ngZ + 5.2, 0, Math.PI * 0.5);
  addCylPart(w5LvGold, 0.04, 0.04, 2.8, 4, htX - 3.6, htY + 1.4, htZ + 2.4);
  addBoxPart(w5LvStone, 2.2, 3.2, 0.48, cx, baseY + 1.6, cz + 62);
  addBoxPart(w5LvGold, 1.55, 2.2, 0.52, cx, baseY + 1.72, cz + 62);

  addWave3Mesh(group, w5LvCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(group, w5LvGold, ctx.materials.gold);
  addWave3Mesh(group, w5LvWood, ctx.materials.darkWood);
  addWave3Mesh(group, w5LvStone, ctx.materials.stone);
  addWave3Mesh(group, w5LvJade, jadeMat);
  addWave3Mesh(group, w5LvOrb, pearlGlowMat);

  group.add(
    new THREE.Mesh(mergeNormalized(lvExpCrimson), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(lvExpGold), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(lvExpWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(lvExpStone), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(lvExpJade), jadeMat),
    new THREE.Mesh(mergeNormalized(lvExpOrb), pearlGlowMat),
    new THREE.Mesh(mergeNormalized(peakParts), lacquerPeakMat),
    new THREE.Mesh(mergeNormalized(jadeParts), jadeMat),
    nonInst
  );
  tagMotifIds(group, ['HV-A01', 'HV-A03', 'HV-D05', 'HV-J05']);
  ctx.scene.add(group);
  return group;
}

function buildDongSonSunSanctuaryMacro(
  ctx: VietnamBuilderContext,
  dongSonTex: { map: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture }
): { group: THREE.Group; drumFaceMat: THREE.MeshStandardMaterial } {
  const cx = -680;
  const cz = 420;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 150 });
  const group = new THREE.Group();
  group.name = 'DongSonSunSanctuaryMacro';
  const baseY = ctx.getHeight(cx, cz);

  // 1. Colossal Upright 22m Radiant Đông Sơn Bronze Drum Sun Monument + Full 3D Waisted Ngọc Lũ Drum Centerpiece
  const drumFaceMat = new THREE.MeshStandardMaterial({
    map: dongSonTex.map,
    normalMap: dongSonTex.normalMap,
    normalScale: new THREE.Vector2(1.8, 1.8),
    roughnessMap: dongSonTex.roughnessMap,
    emissive: new THREE.Color('#ff6a2b'),
    emissiveMap: dongSonTex.map,
    emissiveIntensity: 0.65,
    roughness: 0.38,
    metalness: 0.72
  });
  drumFaceMat.userData.noDedupe = true;
  ctx.extraMaterials.push(drumFaceMat);
  const bronzeDrumMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  // FIX HV01-2: Rising half-sun Đông Sơn Drum monument emerging directly from the plaza floor (r=12.2m, center at baseY+3.2m) — NO floating disc!
  const giantDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(12.2, 12.2, 1.2, 64),
    [bronzeDrumMat, drumFaceMat, drumFaceMat]
  );
  giantDrum.rotation.x = Math.PI * 0.5;
  giantDrum.position.set(cx, baseY + 3.2, cz - 46);
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(13.1, 0.65, 10, 64), ctx.materials.crimsonLacquer);
  haloRing.position.set(cx, baseY + 3.2, cz - 46);

  // Full 3D Waisted Ngọc Lũ Bronze Drum placed cleanly OFF-AXIS at (cx + 15.5, cz - 18) so the central drum-sun view stays 100% unobstructed!
  const drum3dRadius = 3.8;
  const drum3dX = cx + 15.5;
  const drum3dY = baseY + 1.45;
  const drum3dZ = cz - 18;
  const drum3dParts = createDongSonDrum3DParts(drum3dX, drum3dY, drum3dZ, drum3dRadius);
  const uprightWaist = createDongSonDrum3DParts(0, 0, 0, 11.6);
  const uprightDepth = 11.6 * 1.56 * 0.50;
  for (const g of uprightWaist) {
    g.rotateX(Math.PI * 0.5);
    g.scale(1.0, 1.0, 0.50);
    g.translate(cx, baseY + 3.2, cz - 46.2 - uprightDepth);
  }
  drum3dParts.push(...uprightWaist);
  const drumPlinthParts: THREE.BufferGeometry[] = [];
  addCylPart(drumPlinthParts, 5.2, 5.8, 0.75, 24, drum3dX, baseY + 0.38, drum3dZ);
  addCylPart(drumPlinthParts, 4.4, 4.9, 0.70, 24, drum3dX, baseY + 1.10, drum3dZ);
  const topTympanum = new THREE.Mesh(new THREE.CircleGeometry(drum3dRadius * 0.96, 36), drumFaceMat);
  topTympanum.rotation.x = -Math.PI * 0.5;
  topTympanum.position.set(drum3dX, drum3dY + drum3dRadius * 1.56 + 0.04, drum3dZ);

  // Glowing Woven Bamboo Nơm Pyramid Centerpiece at (cx, baseY, cz - 10) + 2 Flanking Red-Gold Ceremonial Pyramids (ref 08 — HV01-2!)
  const nomPyramidParts: THREE.BufferGeometry[] = [];
  const nomCenterZ = cz - 10.0;
  for (let tier = 0; tier < 4; tier++) {
    const t0 = tier / 4;
    const t1 = (tier + 1) / 4;
    const w0 = THREE.MathUtils.lerp(7.4, 0.9, t0);
    const w1 = THREE.MathUtils.lerp(7.4, 0.9, t1);
    const y0 = baseY + t0 * 4.2;
    const y1 = baseY + t1 * 4.2;
    // Horizontal bamboo square frame at each tier
    for (const s of [-1, 1]) {
      addBoxPart(nomPyramidParts, w0, 0.11, 0.11, cx, y0 + 0.08, nomCenterZ + s * w0 * 0.5);
      addBoxPart(nomPyramidParts, 0.11, 0.11, w0, cx + s * w0 * 0.5, y0 + 0.08, nomCenterZ);
    }
    // 16 Interwoven bamboo slats sloping up each pyramid face
    for (let sl = -2; sl <= 2; sl++) {
      const f = sl / 2.4;
      for (const face of [0, 1, 2, 3]) {
        const p0 =
          face === 0 ? new THREE.Vector3(cx + f * w0 * 0.5, y0, nomCenterZ + w0 * 0.5)
            : face === 1 ? new THREE.Vector3(cx + f * w0 * 0.5, y0, nomCenterZ - w0 * 0.5)
              : face === 2 ? new THREE.Vector3(cx + w0 * 0.5, y0, nomCenterZ + f * w0 * 0.5)
                : new THREE.Vector3(cx - w0 * 0.5, y0, nomCenterZ + f * w0 * 0.5);
        const p1 =
          face === 0 ? new THREE.Vector3(cx + f * w1 * 0.5, y1, nomCenterZ + w1 * 0.5)
            : face === 1 ? new THREE.Vector3(cx + f * w1 * 0.5, y1, nomCenterZ - w1 * 0.5)
              : face === 2 ? new THREE.Vector3(cx + w1 * 0.5, y1, nomCenterZ + f * w1 * 0.5)
                : new THREE.Vector3(cx - w1 * 0.5, y1, nomCenterZ + f * w1 * 0.5);
        nomPyramidParts.push(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 1, 0.045, 5, false));
      }
    }
  }
  const nomPyramidMat = new THREE.MeshStandardMaterial({
    color: '#c8f04a',
    emissive: new THREE.Color('#8cd926'),
    emissiveIntensity: 0.95,
    roughness: 0.45
  });
  ctx.extraMaterials.push(nomPyramidMat);
  const sidePyramids: THREE.BufferGeometry[] = [];
  for (const dx of [-16.0, 16.0]) {
    const pyr = new THREE.ConeGeometry(3.8, 3.6, 4);
    pyr.rotateY(Math.PI * 0.25);
    pyr.translate(cx + dx, baseY + 1.8, cz - 14.0);
    sidePyramids.push(pyr);
  }

  group.add(
    giantDrum,
    haloRing,
    new THREE.Mesh(mergeNormalized(drumPlinthParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(drum3dParts), bronzeDrumMat),
    new THREE.Mesh(mergeNormalized(nomPyramidParts), nomPyramidMat),
    new THREE.Mesh(mergeNormalized(sidePyramids), ctx.materials.crimsonLacquer),
    topTympanum
  );

  // 2. Overarching 5-Tier Wide Radiant Đông Sơn Ribbon Bands (HV01-3: open conical bands with glowing bronze-red motif, replacing thin torus tubes!)
  const canopyParts: THREE.BufferGeometry[] = [];
  const canopyRibbonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const thatchParts: THREE.BufferGeometry[] = [];
  const pavLanternParts: THREE.BufferGeometry[] = [];
  const canopyTilt = 0.12;
  for (let r = 0; r < 5; r++) {
    const rad = 13.5 + r * 4.8;
    const band = new THREE.CylinderGeometry(rad, rad + 0.85, 2.15, 56, 1, true);
    band.rotateX(canopyTilt);
    band.translate(cx, baseY + 17.8 + r * 1.65, cz - 6);
    canopyRibbonParts.push(band);
  }
  const canopyRibbonMat = new THREE.MeshStandardMaterial({
    color: '#d4421a',
    map: dongSonTex.map,
    emissive: new THREE.Color('#e84a18'),
    emissiveMap: dongSonTex.map,
    emissiveIntensity: 1.25,
    roughness: 0.35,
    metalness: 0.42,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(canopyRibbonMat);
  group.add(new THREE.Mesh(mergeNormalized(canopyRibbonParts), canopyRibbonMat));
  // Extend all 8 wooden support posts cleanly up to touch the outer ring & link ALL 5 golden rings with radial tie-beams!
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const outerR = 30.0;
    const innerR = 12.0;
    const postX = cx + cosA * outerR;
    const postZ = cz - 6 + sinA * outerR * Math.cos(canopyTilt);
    const outerRingY = baseY + 17.5 + 4 * 1.4 - sinA * outerR * Math.sin(canopyTilt);
    const innerRingY = baseY + 17.5 - sinA * innerR * Math.sin(canopyTilt);
    const postBaseY = ctx.getHeight(postX, postZ);
    const postH = Math.max(16.0, outerRingY - postBaseY + 0.35);
    addCylPart(woodParts, 0.24, 0.32, postH, 8, postX, postBaseY + postH * 0.5, postZ);
    // Radial timber-and-gold roof spoke connecting post directly across all 5 concentric golden canopy rings
    const spokeCurve = new THREE.LineCurve3(
      new THREE.Vector3(cx + cosA * innerR, innerRingY, cz - 6 + sinA * innerR * Math.cos(canopyTilt)),
      new THREE.Vector3(postX, outerRingY, postZ)
    );
    canopyParts.push(new THREE.TubeGeometry(spokeCurve, 4, 0.18, 6, false));
  }
  // Open Ceremonial Approach Axis (*Thảm Đá Hoàng Kim & Đôi Trụ Đuốc Trống Đồng*) leading unobstructed to the Ngọc Lũ Bronze Drum
  addBoxPart(drumPlinthParts, 5.4, 0.14, 34.0, cx, baseY + 0.18, cz + 12.0);
  addBoxPart(canopyParts, 3.8, 0.16, 33.6, cx, baseY + 0.20, cz + 12.0);
  for (const sx of [-5.2, 5.2]) {
    addCylPart(drumPlinthParts, 0.65, 0.82, 1.2, 8, cx + sx, baseY + 0.60, cz + 4.0);
    addCylPart(woodParts, 0.22, 0.28, 4.2, 8, cx + sx, baseY + 3.2, cz + 4.0);
    addCylPart(canopyParts, 0.68, 0.52, 0.55, 10, cx + sx, baseY + 5.45, cz + 4.0);
    const flame = createLanternCoreGeometry(0.32, 0.56);
    flame.translate(cx + sx, baseY + 5.95, cz + 4.0);
    pavLanternParts.push(flame);
  }
  // 4 Upgraded 8-Post Thatch Pavilions with wooden benches & hanging warm lanterns
  for (const [tx, tz] of [[-28, -28], [28, -28], [-34, 18], [34, 18]]) {
    const px = cx + tx;
    const pz = cz + tz;
    const py = ctx.getHeight(px, pz);
    const pavR = 4.2;
    addCylPart(woodParts, pavR + 0.4, pavR + 0.5, 0.24, 16, px, py + 0.12, pz); // raised wooden floor deck
    for (let post = 0; post < 8; post++) {
      const a = (post / 8) * Math.PI * 2;
      const ox = Math.cos(a) * pavR;
      const oz = Math.sin(a) * pavR;
      addCylPart(woodParts, 0.11, 0.14, 3.8, 7, px + ox, py + 2.0, pz + oz);
      // Wooden benches between alternating perimeter bays
      if (post % 2 === 0) {
        const ba = a + Math.PI / 8;
        const bx = px + Math.cos(ba) * (pavR - 0.65);
        const bz = pz + Math.sin(ba) * (pavR - 0.65);
        addBoxPart(woodParts, 2.2, 0.12, 0.55, bx, py + 0.68, bz, -ba + Math.PI * 0.5);
        addBoxPart(woodParts, 0.12, 0.46, 0.48, bx, py + 0.42, bz, -ba + Math.PI * 0.5);
      }
      // Hanging warm eave lanterns on 4 cardinal posts
      if (post % 2 === 0) {
        const lan = createLanternCoreGeometry(0.22, 0.42);
        lan.translate(px + ox * 0.86, py + 3.35, pz + oz * 0.86);
        pavLanternParts.push(lan);
      }
    }
    // Circular eave ring beam & tiered conical thatch roof
    const ringBeam = new THREE.TorusGeometry(pavR, 0.14, 6, 16);
    ringBeam.rotateX(Math.PI * 0.5);
    ringBeam.translate(px, py + 3.85, pz);
    woodParts.push(ringBeam);
    for (let layer = 0; layer < 4; layer++) {
      const rOut = 5.6 - layer * 1.15;
      const rIn = Math.max(0.18, rOut - 1.25);
      const skirt = new THREE.CylinderGeometry(rIn, rOut, 0.72, 16, 1, true);
      skirt.translate(px, py + 4.1 + layer * 0.65, pz);
      thatchParts.push(skirt);
    }
  }
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#d99a3a',
    emissive: new THREE.Color('#ff8a2a'),
    emissiveIntensity: 0.35,
    roughness: 0.7
  });
  const thatchMat = new THREE.MeshStandardMaterial({ color: '#b98a4a', roughness: 0.88, side: THREE.DoubleSide });
  const pavLanternMat = new THREE.MeshStandardMaterial({
    color: '#ffd68a',
    emissive: new THREE.Color('#ff9428'),
    emissiveIntensity: 1.6
  });
  ctx.extraMaterials.push(ringMat, thatchMat, pavLanternMat);
  group.add(
    new THREE.Mesh(mergeNormalized(canopyParts), ringMat),
    new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(thatchParts), thatchMat),
    new THREE.Mesh(mergeNormalized(pavLanternParts), pavLanternMat)
  );

  // 3. 110 Tropical Banana Plants with 64 Green Bunches & Purple Flowers
  const bParts: THREE.BufferGeometry[] = [];
  for (let l = 0; l < 8; l++) {
    const leaf = new THREE.PlaneGeometry(0.50, 2.3, 2, 5);
    const bp = leaf.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const t = clamp01((bp.getY(v) + 1.15) / 2.3);
      bp.setZ(v, t * t * 0.9);
      bp.setY(v, (bp.getY(v) + 1.15) * 0.82);
    }
    leaf.computeVertexNormals();
    leaf.rotateX(0.42);
    leaf.rotateY((l / 8) * Math.PI * 2);
    leaf.translate(0, 2.9, 0);
    bParts.push(leaf);
  }
  const stem = new THREE.CylinderGeometry(0.12, 0.17, 3.0, 7);
  stem.translate(0, 1.5, 0);
  bParts.push(stem);
  const bMat = new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.60, side: THREE.DoubleSide });
  const bunchMat = new THREE.MeshStandardMaterial({ color: '#7fa43a', roughness: 0.52 });
  const flMat = new THREE.MeshStandardMaterial({ color: '#7a1f3d', roughness: 0.5 });
  ctx.extraMaterials.push(bMat, bunchMat, flMat);
  const bInst = new THREE.InstancedMesh(mergeNormalized(bParts), bMat, 110);
  const bunchInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.19, 0.14, 0.85, 8), bunchMat, 64);
  const flInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.34, 8), flMat, 64);
  const rand = mulberry32(88088);
  for (let i = 0; i < 110; i++) {
    const side = i < 55 ? -1 : 1;
    const bx = cx + side * (22 + rand() * 34);
    const bz = cz - 38 + rand() * 88;
    const by = ctx.getHeight(bx, bz);
    const sc = 0.9 + rand() * 0.5;
    setInstanceMatrix(bInst, i, bx, by, bz, 0, rand() * 6.28, 0, sc, sc, sc);
    if (i < 64) {
      setInstanceMatrix(bunchInst, i, bx + 0.3, by + 2.4 * sc, bz, 0, 0, 0, 1, 1, 1);
      setInstanceMatrix(flInst, i, bx + 0.3, by + 1.85 * sc, bz, Math.PI, 0, 0, 1, 1, 1);
    }
  }
  bInst.instanceMatrix.needsUpdate = true;
  bunchInst.instanceMatrix.needsUpdate = true;
  flInst.instanceMatrix.needsUpdate = true;
  // --- 200-Item Macro Visual QC & Expansion (103–116): Quảng Trường Trống Đồng Đông Sơn ---
  const dsExpStone: THREE.BufferGeometry[] = [];
  const dsExpBronze: THREE.BufferGeometry[] = [];
  const dsExpGold: THREE.BufferGeometry[] = [];
  const dsExpWood: THREE.BufferGeometry[] = [];
  const dsExpThatch: THREE.BufferGeometry[] = [];
  const dsExpOrb: THREE.BufferGeometry[] = [];

  // 103 & 108: Outer ring of 12 Trụ Biểu Chim Lạc totem steles & circular amphitheater curb
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sx = cx + Math.cos(a) * 44.0;
    const sz = cz - 6 + Math.sin(a) * 44.0;
    const sy = ctx.getHeight(sx, sz);
    addBoxPart(dsExpStone, 1.65, 0.85, 1.65, sx, sy + 0.42, sz);
    addCylPart(dsExpBronze, 0.34, 0.42, 6.2, 8, sx, sy + 3.9, sz);
    const birdCrest = new THREE.ConeGeometry(0.65, 1.45, 4);
    birdCrest.rotateZ(Math.PI * 0.28);
    birdCrest.translate(sx, sy + 7.45, sz);
    dsExpGold.push(birdCrest);
    addBoxPart(dsExpStone, 14.5, 0.65, 1.45, cx + Math.cos(a) * 49.0, baseY + 0.32, cz - 6 + Math.sin(a) * 49.0, -a + Math.PI * 0.5);
  }
  // 104 & 109: 2 Nhà Sàn Đông Sơn stilt pavilions & 4 rice-pounding mortar vignettes
  for (const side of [-1, 1]) {
    const nx = cx + side * 38.0;
    const nz = cz - 36.0;
    const ny = ctx.getHeight(nx, nz);
    for (const [ox, oz] of [[-3.2, -2.2], [3.2, -2.2], [-3.2, 2.2], [3.2, 2.2]]) {
      addCylPart(dsExpWood, 0.14, 0.16, 4.4, 6, nx + ox, ny + 2.2, nz + oz);
    }
    addBoxPart(dsExpWood, 7.6, 0.24, 5.4, nx, ny + 1.85, nz);
    const sRoof = createGableRoofGeometry(9.2, 6.8, 2.6, 0.16, 'x');
    sRoof.translate(nx, ny + 4.35, nz);
    dsExpThatch.push(sRoof);
    // 109: Rice-pounding mortar
    addCylPart(dsExpStone, 0.45, 0.38, 0.62, 8, nx, ny + 0.31, nz + 4.2);
    addCylPart(dsExpWood, 0.05, 0.06, 1.5, 5, nx, ny + 0.95, nz + 4.2, 0.3, 0);
  }
  // 105, 106, 111, 112: 4 Bronze Thạp Đồng vessels, halberd racks, Lạc Long Quân/Âu Cơ steles & tripod braziers
  for (const [tx, tz] of [[-7.5, -14], [7.5, -14], [-7.5, -22], [7.5, -22]] as Array<[number, number]>) {
    addBoxPart(dsExpStone, 1.35, 0.55, 1.35, cx + tx, baseY + 0.28, cz + tz);
    addCylPart(dsExpBronze, 0.55, 0.48, 1.15, 10, cx + tx, baseY + 1.12, cz + tz);
    dsExpOrb.push(new THREE.SphereGeometry(0.32, 6, 5).translate(cx + tx, baseY + 1.82, cz + tz));
  }
  for (const side of [-1, 1]) {
    addBoxPart(dsExpWood, 2.2, 0.24, 0.45, cx + side * 8.2, baseY + 0.12, cz + 4.0);
    for (let h = -1; h <= 1; h++) {
      addCylPart(dsExpBronze, 0.04, 0.05, 2.8, 5, cx + side * 8.2 + h * 0.65, baseY + 1.5, cz + 4.0);
    }
    addBoxPart(dsExpStone, 1.4, 2.6, 0.38, cx + side * 6.5, baseY + 1.3, cz + 28.0);
  }
  // 107 & 110 & 116: Radial stone sun-ray paving inlays, bamboo palisade fence & drum plinth steps
  for (let r = 0; r < 12; r++) {
    const ra = (r / 12) * Math.PI * 2;
    addBoxPart(dsExpGold, 0.45, 0.06, 14.0, cx + Math.sin(ra) * 18, baseY + 0.12, cz - 10 + Math.cos(ra) * 18, ra);
  }
  for (let st = 0; st < 3; st++) {
    addBoxPart(dsExpStone, 6.4, 0.28, 0.85, drum3dX, baseY + 0.14 + st * 0.26, drum3dZ + 5.8 - st * 0.72);
  }

  // --- Wave 2 Macro Visual QC & Expansion (303–316): Đông Sơn Bronze-Casting Kilns & Ceremonial Barges ---
  // 303, 304, 307, 313, 316: 2 Domed bronze-casting kilns, clay drum molds, charcoal hearth, fuel stack & foundry thatch shelter
  const kilnBaseX = cx - 34;
  const kilnBaseZ = cz + 12;
  const kilnY = ctx.getHeight(kilnBaseX, kilnBaseZ);
  for (const kzOff of [-4.2, 4.2]) {
    addCylPart(dsExpStone, 1.4, 1.9, 1.5, 6, kilnBaseX, kilnY + 0.75, kilnBaseZ + kzOff);
    addConePart(dsExpStone, 1.45, 1.25, 6, kilnBaseX, kilnY + 2.1, kilnBaseZ + kzOff);
    addCylPart(dsExpOrb, 0.42, 0.45, 0.45, 5, kilnBaseX + 1.45, kilnY + 0.45, kilnBaseZ + kzOff);
    addCylPart(dsExpBronze, 0.72, 0.78, 0.65, 6, kilnBaseX + 3.2, kilnY + 0.32, kilnBaseZ + kzOff);
  }
  addCylPart(dsExpStone, 1.15, 1.25, 0.42, 6, kilnBaseX + 1.5, kilnY + 0.21, kilnBaseZ);
  addCylPart(dsExpBronze, 0.48, 0.35, 0.55, 6, kilnBaseX + 1.5, kilnY + 0.65, kilnBaseZ);
  addBoxPart(dsExpWood, 2.8, 0.85, 1.4, kilnBaseX - 3.6, kilnY + 0.42, kilnBaseZ);
  for (const [ox, oz] of [[-2.6, -2.4], [2.6, -2.4], [-2.6, 2.4], [2.6, 2.4]]) {
    addCylPart(dsExpWood, 0.10, 0.12, 3.2, 5, kilnBaseX + 4.8 + ox, kilnY + 1.6, kilnBaseZ + oz);
  }
  addConePart(dsExpThatch, 4.4, 1.55, 4, kilnBaseX + 4.8, kilnY + 3.9, kilnBaseZ, Math.PI * 0.25);
  // 305: 2 Sculpted Lạc Việt curved-prow bronze-and-timber ceremonial barges (Thuyền Nghi Lễ Đông Sơn)
  for (const side of [-1, 1]) {
    const bx = cx + side * 26;
    const bz = cz + 14;
    const by = ctx.getHeight(bx, bz);
    addBoxPart(dsExpStone, 9.6, 0.45, 2.2, bx, by + 0.22, bz);
    addBoxPart(dsExpWood, 8.8, 0.75, 1.55, bx, by + 0.85, bz);
    addConePart(dsExpBronze, 0.55, 2.4, 5, bx - 4.8, by + 1.65, bz, 0, 0, 0.68);
    addConePart(dsExpBronze, 0.55, 2.4, 5, bx + 4.8, by + 1.65, bz, 0, 0, -0.68);
  }
  // 306, 308, 309, 310, 311, 312, 314, 315: Axe/halberd plinths, Lạc-bird entry pylons, drumming deck, drum racks, banner poles, viewing steps, oil lamps & sun-motif stele
  for (const side of [-1, 1]) {
    addBoxPart(dsExpStone, 1.4, 0.95, 1.1, cx + side * 14, baseY + 0.48, cz + 18);
    addBoxPart(dsExpBronze, 0.72, 0.35, 0.14, cx + side * 14, baseY + 1.15, cz + 18);
    // 308: Entrance pylons
    addBoxPart(dsExpStone, 1.8, 5.4, 1.8, cx + side * 9.5, baseY + 2.7, cz + 36);
    addConePart(dsExpGold, 1.1, 1.6, 4, cx + side * 9.5, baseY + 6.1, cz + 36, Math.PI * 0.25);
    // 310: Auxiliary drum A-frame racks
    addBoxPart(dsExpWood, 0.14, 2.4, 2.2, cx + side * 16, baseY + 1.2, cz - 14);
    addCylPart(dsExpBronze, 0.65, 0.55, 0.82, 6, cx + side * 16, baseY + 1.35, cz - 14, 0, Math.PI * 0.5);
  }
  addBoxPart(dsExpWood, 12.0, 0.32, 4.4, cx, baseY + 0.16, cz + 8.5);
  for (const [fx, fz] of [[-24, -24], [24, -24], [-24, 24], [24, 24]] as Array<[number, number]>) {
    addCylPart(dsExpWood, 0.08, 0.11, 7.2, 5, cx + fx, baseY + 3.6, cz + fz);
    addCylPart(dsExpGold, 0.55, 0.55, 0.10, 6, cx + fx, baseY + 7.4, cz + fz, Math.PI * 0.5, 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addBoxPart(dsExpStone, 11.0, 0.38, 1.2, cx + Math.cos(a) * 35.0, baseY + 0.19, cz - 6 + Math.sin(a) * 35.0, -a + Math.PI * 0.5);
    const lx = cx + (i < 3 ? -4.8 : 4.8);
    const lz = cz + 20 + (i % 3) * 5.2;
    addCylPart(dsExpBronze, 0.14, 0.18, 0.95, 5, lx, baseY + 0.48, lz);
    addConePart(dsExpOrb, 0.16, 0.28, 5, lx, baseY + 1.1, lz);
  }
  addBoxPart(dsExpStone, 2.2, 2.8, 0.42, cx, baseY + 1.4, cz - 38);
  addCylPart(dsExpGold, 0.78, 0.78, 0.12, 6, cx, baseY + 1.6, cz - 37.72, Math.PI * 0.5, 0);

  // --- Wave 3 Macro Visual QC & Expansion (601–629): Lạc Việt Stilt Village, Bronze Foundry & Sun-Ray Plaza ---
  const w3DsStone: THREE.BufferGeometry[] = [];
  const w3DsBronze: THREE.BufferGeometry[] = [];
  const w3DsGold: THREE.BufferGeometry[] = [];
  const w3DsWood: THREE.BufferGeometry[] = [];
  const w3DsThatch: THREE.BufferGeometry[] = [];
  const w3DsOrb: THREE.BufferGeometry[] = [];
  // 601–604: Eastern & western Lạc Việt saddle-roof stilt houses, notched-log ladders & veranda looms/pottery (shifted cleanly away from thatch pavilions at ±28,-28 & houses 104 at ±38,-36!)
  for (const side of [-1, 1]) {
    const sx = cx + side * 42;
    const sz = cz - 14;
    const sy = Math.max(ctx.getHeight(sx, sz), ctx.getHeight(sx - 3.4, sz), ctx.getHeight(sx + 3.4, sz));
    for (const [ox, oz] of [[-3.4, -2.0], [0, -2.0], [3.4, -2.0], [-3.4, 2.0], [0, 2.0], [3.4, 2.0]]) {
      addW3GroundedCol(w3DsWood, 0.11, 0.13, sy + 2.2, ctx.getHeight(sx + ox, sz + oz) - 0.6, 5, sx + ox, sz + oz);
    }
    addBoxPart(w3DsWood, 7.6, 0.22, 4.8, sx, sy + 2.2, sz);
    addBoxPart(w3DsThatch, 6.8, 1.85, 3.8, sx, sy + 3.22, sz);
    addW3HipRoof(w3DsThatch, w3DsGold, 8.8, 5.4, sy + 4.15, 2.15, sx, sz);
    // 603: Notched-log entry ladder
    addBoxPart(w3DsWood, 0.62, 2.65, 0.18, sx, sy + 1.15, sz + 3.1, 0, -0.52, 0);
    // 604: Veranda loom & pottery jars
    addBoxPart(w3DsWood, 1.6, 1.05, 0.72, sx - side * 2.2, sy + 0.52, sz);
    addCylPart(w3DsBronze, 0.26, 0.22, 0.55, 5, sx + side * 2.2, sy + 0.28, sz);
  }
  // 605–607, 623: Double-piston bamboo bellows, slag pit/ingots, wax-carving workbench & clay pottery kiln
  for (const kzOff of [-4.2, 4.2]) {
    addW3GroundedCol(w3DsWood, 0.16, 0.18, kilnY + 1.65, kilnY, 5, kilnBaseX - 2.2, kilnBaseZ + kzOff - 0.3);
    addW3GroundedCol(w3DsWood, 0.16, 0.18, kilnY + 1.65, kilnY, 5, kilnBaseX - 2.2, kilnBaseZ + kzOff + 0.3);
  }
  addBoxPart(w3DsStone, 2.4, 0.42, 1.6, kilnBaseX + 2.4, kilnY + 0.21, kilnBaseZ + 7.2);
  addBoxPart(w3DsBronze, 1.6, 0.22, 0.65, kilnBaseX + 2.4, kilnY + 0.52, kilnBaseZ + 7.2);
  addBoxPart(w3DsWood, 2.4, 0.85, 1.1, kilnBaseX + 4.8, kilnY + 0.42, kilnBaseZ);
  addCylPart(w3DsStone, 0.45, 0.48, 0.65, 6, kilnBaseX + 4.8, kilnY + 1.18, kilnBaseZ);
  addCylPart(w3DsStone, 1.25, 1.55, 1.15, 6, kilnBaseX - 5.2, kilnY + 0.58, kilnBaseZ + 5.8);
  addConePart(w3DsStone, 1.28, 0.95, 6, kilnBaseX - 5.2, kilnY + 1.62, kilnBaseZ + 5.8);
  // 608–610, 628: War-canoe prow crests/decks, timber oar racks & stone mooring bollards
  for (const side of [-1, 1]) {
    const bx = cx + side * 26;
    const bz = cz + 14;
    const by = ctx.getHeight(bx, bz);
    addBoxPart(w3DsBronze, 2.4, 0.95, 1.25, bx, by + 1.55, bz);
    addConePart(w3DsGold, 0.42, 1.25, 4, bx - 5.4, by + 2.75, bz);
    addConePart(w3DsGold, 0.42, 1.25, 4, bx + 5.4, by + 2.75, bz);
    addBoxPart(w3DsWood, 2.6, 1.15, 0.42, bx, by + 0.58, bz + 2.6);
    addW3GroundedCol(w3DsStone, 0.28, 0.34, by + 1.15, by, 5, bx - 5.2, bz + 2.2);
  }
  // 611–612: 14-Ray bronze sun inlays & 4 cardinal solstice obelisks
  for (let r = 0; r < 14; r++) {
    const a = (r / 14) * Math.PI * 2;
    addBoxPart(w3DsBronze, 0.42, 0.10, 5.2, cx + Math.cos(a) * 16.5, baseY + 0.06, cz - 6 + Math.sin(a) * 16.5, -a + Math.PI * 0.5);
  }
  for (const [ox, oz] of [[0, -32], [0, 26], [-32, -6], [32, -6]] as Array<[number, number]>) {
    addW3GroundedPost(w3DsStone, 0.85, 0.85, baseY + 3.8, baseY, cx + ox, cz + oz);
    addConePart(w3DsBronze, 0.55, 0.95, 4, cx + ox, baseY + 4.25, cz + oz, Math.PI * 0.25);
  }
  // 613–629: Lạc-bird entry lintel, 4 situla pedestals, 4 feather-banner stands, stone rice conduit, fishing-trap rack, weapon display altar, mallet stands, amphitheater stair cheeks, Hùng King braziers, village granary, grinding quern, bronze bell-chime frame, palisade watch-platform, 6 perimeter torch posts & heritage bronze map
  addBoxPart(w3DsBronze, 20.6, 0.95, 1.45, cx, baseY + 5.65, cz + 36);
  addCylPart(w3DsGold, 1.15, 1.15, 0.18, 6, cx, baseY + 6.95, cz + 36, Math.PI * 0.5, 0);
  for (const side of [-1, 1]) {
    for (const pzOff of [5.5, 11.5]) {
      addBoxPart(w3DsStone, 1.1, 0.85, 1.1, cx + side * 7.8, baseY + 0.42, cz + pzOff);
      addCylPart(w3DsBronze, 0.36, 0.28, 0.68, 6, cx + side * 7.8, baseY + 1.18, cz + pzOff);
    }
    addW3GroundedCol(w3DsBronze, 0.06, 0.08, baseY + 4.4, baseY, 5, cx + side * 20, cz - 20);
    addConePart(w3DsGold, 0.42, 0.85, 4, cx + side * 20, baseY + 4.75, cz - 20);
    addW3GroundedCol(w3DsBronze, 0.06, 0.08, baseY + 4.4, baseY, 5, cx + side * 20, cz + 18);
    addConePart(w3DsGold, 0.42, 0.85, 4, cx + side * 20, baseY + 4.75, cz + 18);
    addBoxPart(w3DsWood, 1.2, 0.95, 0.38, cx + side * 5.2, baseY + 0.48, cz + 8.5);
    addBoxPart(w3DsStone, 1.1, 1.25, 5.4, cx + side * 6.8, baseY + 0.62, cz + 32.0);
    addCylPart(w3DsBronze, 0.55, 0.42, 1.15, 6, cx + side * 3.8, baseY + 0.58, cz - 35.5);
    addConePart(w3DsOrb, 0.34, 0.55, 5, cx + side * 3.8, baseY + 1.42, cz - 35.5);
  }
  addBoxPart(w3DsStone, 14.0, 0.35, 0.72, cx, baseY + 0.18, cz + 29.0);
  addBoxPart(w3DsWood, 2.8, 1.25, 0.45, cx + 22, baseY + 0.62, cz - 32);
  for (const fxOff of [-0.7, 0, 0.7]) addConePart(w3DsThatch, 0.28, 0.68, 5, cx + 22 + fxOff, baseY + 0.92, cz - 31.6);
  addBoxPart(w3DsStone, 2.4, 0.85, 1.2, cx, baseY + 0.42, cz + 14.5);
  addBoxPart(w3DsBronze, 1.8, 0.18, 0.45, cx, baseY + 0.95, cz + 14.5);
  const grX = cx - 42;
  const grZ = cz - 24;
  const grY = Math.max(ctx.getHeight(grX, grZ), ctx.getHeight(grX - 1.1, grZ), ctx.getHeight(grX + 1.1, grZ));
  for (const [ox, oz] of [[-1.1, -1.0], [1.1, -1.0], [-1.1, 1.0], [1.1, 1.0]]) {
    addW3GroundedCol(w3DsWood, 0.08, 0.10, grY + 1.65, ctx.getHeight(grX + ox, grZ + oz) - 0.6, 5, grX + ox, grZ + oz);
  }
  addBoxPart(w3DsWood, 2.6, 1.45, 2.2, grX, grY + 2.35, grZ);
  addW3HipRoof(w3DsThatch, null, 3.2, 2.8, grY + 3.08, 0.95, grX, grZ);
  addBoxPart(w3DsStone, 1.1, 0.32, 0.75, cx - 22, baseY + 0.16, cz - 30);
  addW3GroundedPost(w3DsWood, 0.12, 0.12, baseY + 2.45, baseY, cx + 12.2, cz - 28);
  addW3GroundedPost(w3DsWood, 0.12, 0.12, baseY + 2.45, baseY, cx + 15.8, cz - 28);
  addBoxPart(w3DsWood, 4.0, 0.14, 0.14, cx + 14.0, baseY + 2.42, cz - 28);
  for (let b = 0; b < 4; b++) addCylPart(w3DsBronze, 0.16, 0.24, 0.52, 5, cx + 12.8 + b * 0.8, baseY + 1.95, cz - 28);
  for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    addW3GroundedCol(w3DsWood, 0.09, 0.11, baseY + 3.6, baseY, 5, cx + ox, cz - 38 + oz);
  }
  addBoxPart(w3DsWood, 2.8, 0.22, 2.8, cx, baseY + 3.55, cz - 38);
  for (let t = 0; t < 6; t++) {
    const a = (t / 6) * Math.PI * 2 + 0.5;
    addW3GroundedCol(w3DsBronze, 0.10, 0.14, baseY + 1.65, baseY, 5, cx + Math.cos(a) * 37.5, cz - 6 + Math.sin(a) * 37.5);
    addConePart(w3DsOrb, 0.16, 0.32, 5, cx + Math.cos(a) * 37.5, baseY + 1.85, cz - 6 + Math.sin(a) * 37.5);
  }
  addBoxPart(w3DsStone, 1.8, 0.92, 1.1, cx, baseY + 0.46, cz + 40.5);
  addBoxPart(w3DsBronze, 1.6, 0.08, 0.95, cx, baseY + 0.96, cz + 40.5, 0, 0.3, 0);

  addWave3Mesh(group, w3DsStone, ctx.materials.stone);
  addWave3Mesh(group, w3DsBronze, bronzeDrumMat);
  addWave3Mesh(group, w3DsGold, ctx.materials.gold);
  addWave3Mesh(group, w3DsWood, ctx.materials.darkWood);
  addWave3Mesh(group, w3DsThatch, thatchMat);
  addWave3Mesh(group, w3DsOrb, pavLanternMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1002–1030): Lost-Wax Casting Pit, Bellows Hut, War-Canoe Slipway & Elder Pavilion ---
  const w4DsStone: THREE.BufferGeometry[] = [];
  const w4DsBronze: THREE.BufferGeometry[] = [];
  const w4DsGold: THREE.BufferGeometry[] = [];
  const w4DsWood: THREE.BufferGeometry[] = [];
  const w4DsThatch: THREE.BufferGeometry[] = [];
  const w4DsOrb: THREE.BufferGeometry[] = [];
  // 1002–1004: Lost-wax casting pit, twin-piston bamboo bellows hut (cx + 46, cz + 14) & charcoal earth kiln
  const cpX = cx + 46;
  const cpZ = cz + 14;
  const cpY = Math.max(ctx.getHeight(cpX, cpZ), ctx.getHeight(cpX + 3, cpZ));
  addCylPart(w4DsStone, 2.2, 2.4, 0.45, 6, cpX, cpY + 0.22, cpZ);
  addCylPart(w4DsBronze, 0.95, 1.05, 0.85, 6, cpX, cpY + 0.65, cpZ);
  const bhX = cpX + 8.5;
  const bhZ = cpZ;
  const bhY = Math.max(ctx.getHeight(bhX, bhZ), ctx.getHeight(bhX + 2, bhZ));
  addW3Plinth(w4DsStone, 4.6, 3.8, bhY + 0.28, bhY, bhX, bhZ);
  for (const [ox, oz] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) addW3GroundedCol(w4DsWood, 0.09, 0.11, bhY + 2.65, bhY + 0.28, 5, bhX + ox, bhZ + oz);
  addW3HipRoof(w4DsThatch, null, 5.4, 4.4, bhY + 2.65, 1.15, bhX, bhZ);
  for (const ox of [-0.45, 0.45]) addCylPart(w4DsWood, 0.16, 0.18, 1.45, 5, bhX + ox, bhY + 1.0, bhZ);
  addConePart(w4DsStone, 2.2, 1.85, 6, bhX + 6.5, bhY + 0.92, bhZ);
  // 1005–1011: Dugout war-canoe slipway, deer-antler rack, dagger forge anvil, 4 fish traps, hearth circle, 6 Lạc-bird standards & grinding slab
  const cnX = cx - 44;
  const cnZ = cz + 26;
  const cnY = ctx.getHeight(cnX, cnZ);
  addBoxPart(w4DsWood, 6.8, 0.42, 1.15, cnX, cnY + 0.48, cnZ, 0.22);
  addBoxPart(w4DsWood, 1.8, 1.45, 0.35, cnX + 6.2, cnY + 0.72, cnZ);
  addBoxPart(w4DsStone, 0.85, 0.68, 0.65, cpX - 4.2, cpY + 0.34, cpZ + 2.2);
  for (let f = 0; f < 4; f++) addConePart(w4DsThatch, 0.28, 0.82, 5, cnX - 4.5 + f * 0.9, cnY + 0.42, cnZ + 2.8, 0, 1.2, 0);
  for (let h = 0; h < 6; h++) {
    const ha = (h / 6) * Math.PI * 2;
    addBoxPart(w4DsStone, 0.55, 0.42, 0.55, cx - 34 + Math.cos(ha) * 1.8, baseY + 0.21, cz + 34 + Math.sin(ha) * 1.8);
  }
  addConePart(w4DsOrb, 0.45, 0.65, 5, cx - 34, baseY + 0.42, cz + 34);
  for (let l = 0; l < 6; l++) {
    const la = (l / 6) * Math.PI * 2 + 0.4;
    const lx = cx + Math.cos(la) * 48;
    const lz = cz + Math.sin(la) * 44;
    const ly = ctx.getHeight(lx, lz);
    addW3GroundedCol(w4DsWood, 0.08, 0.10, ly + 4.4, ly, 5, lx, lz);
    addConePart(w4DsGold, 0.32, 0.45, 4, lx, ly + 4.62, lz);
  }
  addBoxPart(w4DsStone, 1.4, 0.42, 0.95, cpX, cpY + 0.21, cpZ - 4.5);
  // 1012–1020: Water-jar rack, ploughshare stand, sun-wheel stele, elder council pavilion (cx, cz - 46), situla pair, signal-drum cradle, 4 palisade posts, pottery hearth & spear rack
  addBoxPart(w4DsWood, 2.2, 0.85, 0.85, cx - 44, baseY + 0.42, cz + 4);
  for (let j = -1; j <= 1; j++) addCylPart(w4DsBronze, 0.22, 0.18, 0.48, 5, cx - 44 + j * 0.65, baseY + 1.05, cz + 4);
  addBoxPart(w4DsWood, 1.8, 1.15, 0.55, cx + 32, baseY + 0.58, cz + 32);
  addCylPart(w4DsStone, 1.35, 1.35, 0.32, 6, cx - 50, ctx.getHeight(cx - 50, cz - 4) + 1.45, cz - 4, Math.PI * 0.5, 0);
  const epX = cx;
  const epZ = cz - 48;
  const epY = Math.max(ctx.getHeight(epX, epZ), ctx.getHeight(epX - 3, epZ), ctx.getHeight(epX + 3, epZ));
  addW3Plinth(w4DsStone, 7.6, 5.2, epY + 0.38, epY, epX, epZ);
  for (const [ox, oz] of [[-3.0, -1.9], [3.0, -1.9], [-3.0, 1.9], [3.0, 1.9]]) addW3GroundedCol(w4DsWood, 0.11, 0.13, epY + 3.05, epY + 0.38, 5, epX + ox, epZ + oz);
  addW3HipRoof(w4DsThatch, w4DsGold, 8.6, 6.0, epY + 3.05, 1.45, epX, epZ);
  for (const s of [-1, 1]) {
    addBoxPart(w4DsStone, 0.95, 0.65, 0.95, epX + s * 6.5, epY + 0.32, epZ + 2.5);
    addCylPart(w4DsBronze, 0.34, 0.30, 0.68, 6, epX + s * 6.5, epY + 0.98, epZ + 2.5);
  }
  addCylPart(w4DsWood, 0.35, 0.35, 2.2, 6, cx + 22, baseY + 1.05, cz + 38, 0, Math.PI * 0.5);
  for (const ox of [-6, -2.5, 2.5, 6]) addW3GroundedCol(w4DsWood, 0.16, 0.20, baseY + 3.2, baseY, 5, cx + ox, cz + 46);
  addCylPart(w4DsStone, 1.45, 1.55, 0.35, 6, cx + 38, baseY + 0.18, cz + 26);
  addBoxPart(w4DsWood, 2.2, 1.45, 0.45, cx - 22, baseY + 0.72, cz + 40);
  // 1021–1030: 3-tier stone amphitheater, bell-chime frame, 3 winnowing baskets, 6 torch tripods, boat-prow stone, hemp frame, trap model, ingot stack, 4 cairns & heritage monolith
  for (let t = 0; t < 3; t++) addBoxPart(w4DsStone, 14.0 - t * 1.4, 0.45, 1.15, cx, baseY + 0.22 + t * 0.45, cz + 49 + t * 1.25);
  addBoxPart(w4DsWood, 2.4, 1.85, 0.22, cx + 12, baseY + 0.92, cz + 42);
  for (let w = 0; w < 3; w++) addCylPart(w4DsThatch, 0.55, 0.55, 0.08, 6, cx - 12 + w * 1.4, baseY + 0.45, cz + 42);
  for (let t = 0; t < 6; t++) {
    const tx = cx + 44;
    const tz = cz - 28 + t * 10;
    addW3GroundedCol(w4DsBronze, 0.08, 0.12, ctx.getHeight(tx, tz) + 1.65, ctx.getHeight(tx, tz), 5, tx, tz);
    addConePart(w4DsOrb, 0.22, 0.36, 4, tx, ctx.getHeight(tx, tz) + 1.85, tz);
  }
  addBoxPart(w4DsStone, 1.25, 2.4, 0.65, cnX - 5.2, cnY + 1.2, cnZ, 0.25);
  addBoxPart(w4DsWood, 1.8, 1.65, 0.18, cx - 38, baseY + 0.82, cz + 14);
  addBoxPart(w4DsWood, 1.4, 1.15, 1.15, cx + 38, baseY + 0.58, cz + 36);
  addBoxPart(w4DsBronze, 1.4, 0.52, 0.85, cpX + 4.2, cpY + 0.26, cpZ + 2.8);
  for (const [bx, bz] of [[-52, -38], [52, -38], [-52, 42], [52, 42]]) addConePart(w4DsStone, 0.95, 1.25, 5, cx + bx, ctx.getHeight(cx + bx, cz + bz) + 0.62, cz + bz);
  addBoxPart(w4DsStone, 1.65, 2.55, 0.42, cx, baseY + 1.28, cz + 55);

  addWave3Mesh(group, w4DsStone, ctx.materials.stone);
  addWave3Mesh(group, w4DsBronze, bronzeDrumMat);
  addWave3Mesh(group, w4DsGold, ctx.materials.gold);
  addWave3Mesh(group, w4DsWood, ctx.materials.darkWood);
  addWave3Mesh(group, w4DsThatch, thatchMat);
  addWave3Mesh(group, w4DsOrb, pavLanternMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1402–1430): Ngọc Lũ Drum Pavilion, Clay Blast Furnace, Warrior Totems & Sun-Disc ---
  const w5DsStone: THREE.BufferGeometry[] = [];
  const w5DsBronze: THREE.BufferGeometry[] = [];
  const w5DsGold: THREE.BufferGeometry[] = [];
  const w5DsWood: THREE.BufferGeometry[] = [];
  const w5DsThatch: THREE.BufferGeometry[] = [];
  const w5DsOrb: THREE.BufferGeometry[] = [];
  // 1402–1404: Ngọc Lũ bronze-drum replica pavilion (cx - 46, cz - 26), clay blast furnace & copper-ore crushing anvil
  const nlX = cx - 46;
  const nlZ = cz - 26;
  const nlY = Math.max(ctx.getHeight(nlX, nlZ), ctx.getHeight(nlX - 2, nlZ));
  addW3Plinth(w5DsStone, 5.2, 5.2, nlY + 0.38, nlY, nlX, nlZ);
  for (const [ox, oz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) addW3GroundedCol(w5DsWood, 0.10, 0.12, nlY + 2.95, nlY + 0.38, 5, nlX + ox, nlZ + oz);
  addCylPart(w5DsBronze, 0.85, 0.72, 0.78, 6, nlX, nlY + 0.78, nlZ);
  addW3HipRoof(w5DsThatch, w5DsGold, 6.0, 6.0, nlY + 2.95, 1.25, nlX, nlZ);
  addCylPart(w5DsStone, 0.95, 1.45, 3.2, 6, cpX + 4.8, cpY + 1.6, cpZ - 5.2);
  addBoxPart(w5DsStone, 1.35, 0.72, 1.15, bhX, bhY + 0.36, bhZ + 4.8);
  // 1405–1412: Twin warrior totems, concentric-sun disc, canoe oar stand, pediform-axe rack, 3-tier ritual altar, clay-mold shelf, 4 frog bollards & panpipe cradle
  for (const s of [-1, 1]) {
    addW3GroundedCol(w5DsWood, 0.16, 0.20, baseY + 4.4, baseY, 5, cx + s * 8.5, cz + 54);
    addConePart(w5DsGold, 0.38, 0.65, 4, cx + s * 8.5, baseY + 4.72, cz + 54);
  }
  addCylPart(w5DsStone, 1.45, 1.45, 0.32, 6, cx + 52, ctx.getHeight(cx + 52, cz - 14) + 1.55, cz - 14, Math.PI * 0.5, 0);
  addBoxPart(w5DsWood, 2.2, 1.35, 0.48, cnX, cnY + 0.68, cnZ - 4.2);
  addBoxPart(w5DsWood, 1.85, 1.05, 0.52, cx + 26, baseY + 0.52, cz + 38);
  for (let t = 0; t < 3; t++) addBoxPart(w5DsStone, 5.2 - t * 0.9, 0.32, 2.6 - t * 0.4, epX, epY + 0.16 + t * 0.32, epZ + 5.8);
  addBoxPart(w5DsWood, 2.4, 1.25, 0.65, cpX - 4.8, cpY + 0.62, cpZ - 3.6);
  for (const [bx, bz] of [[-42, -32], [42, -32], [-42, 42], [42, 42]]) {
    const by = ctx.getHeight(cx + bx, cz + bz);
    addW3GroundedPost(w5DsStone, 0.42, 0.42, by + 1.15, by, cx + bx, cz + bz);
    addConePart(w5DsBronze, 0.24, 0.28, 4, cx + bx, by + 1.28, cz + bz);
  }
  addBoxPart(w5DsWood, 1.45, 0.88, 0.52, epX - 6.8, epY + 0.44, epZ);
  // 1413–1421: Western watch-platform, rice-pounding log mortar, crucible rack, palisade watch-gate, fishing-spear bench, stag-antler altar, 6 north fire-bowls, loom-weight bench & bell-cluster arch
  const wpDsX = cx - 54;
  const wpDsZ = cz + 10;
  const wpDsY = Math.max(ctx.getHeight(wpDsX, wpDsZ), ctx.getHeight(wpDsX - 2, wpDsZ));
  for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) addW3GroundedCol(w5DsWood, 0.10, 0.12, wpDsY + 3.4, wpDsY, 5, wpDsX + ox, wpDsZ + oz);
  addBoxPart(w5DsWood, 3.2, 0.22, 3.2, wpDsX, wpDsY + 2.85, wpDsZ);
  addCylPart(w5DsWood, 0.45, 0.38, 0.72, 6, cx - 28, baseY + 0.36, cz + 38);
  addBoxPart(w5DsStone, 1.65, 0.65, 0.85, cpX + 4.5, cpY + 0.32, cpZ + 5.8);
  for (const s of [-1, 1]) addW3GroundedCol(w5DsWood, 0.16, 0.20, baseY + 3.85, baseY, 5, cx + s * 3.8, cz + 52);
  addBoxPart(w5DsWood, 8.6, 0.28, 0.28, cx, baseY + 3.78, cz + 52);
  addBoxPart(w5DsWood, 1.85, 0.72, 0.75, cnX - 5.2, cnY + 0.36, cnZ + 4.8);
  addBoxPart(w5DsStone, 2.2, 0.88, 1.05, nlX, nlY + 0.44, nlZ + 5.8);
  for (let fb = 0; fb < 6; fb++) {
    const fx = cx - 25 + fb * 10;
    const fy = ctx.getHeight(fx, cz - 54);
    addCylPart(w5DsStone, 0.42, 0.34, 0.78, 6, fx, fy + 0.39, cz - 54);
    addConePart(w5DsOrb, 0.24, 0.38, 4, fx, fy + 0.96, cz - 54);
  }
  addBoxPart(w5DsWood, 1.65, 0.72, 0.72, cx - 38, baseY + 0.36, cz + 18);
  for (const s of [-1, 1]) addW3GroundedCol(w5DsWood, 0.08, 0.10, baseY + 2.65, baseY, 5, cx + 16 + s * 1.4, cz + 44);
  addBoxPart(w5DsGold, 3.2, 0.16, 0.16, cx + 16, baseY + 2.58, cz + 44);
  // 1422–1430: Amphitheater access stairs, dugout grain-trough, 4 egret pillars, clay soaking pit, 4 clan benches, shield-boss post, solar sighting stones, torch-brazier arch & Hùng Vương timeline stele
  addBoxPart(w5DsStone, 3.2, 0.95, 3.8, cx, baseY + 0.48, cz + 52.5);
  addBoxPart(w5DsWood, 2.4, 0.78, 1.15, epX + 7.2, epY + 0.39, epZ);
  for (const [ex, ez] of [[-48, -46], [48, -46], [-48, 48], [48, 48]]) {
    const ey = ctx.getHeight(cx + ex, cz + ez);
    addW3GroundedPost(w5DsStone, 0.34, 0.34, ey + 2.25, ey, cx + ex, cz + ez);
    addConePart(w5DsGold, 0.24, 0.38, 4, cx + ex, ey + 2.45, cz + ez);
  }
  addCylPart(w5DsStone, 1.35, 1.45, 0.38, 6, cx + 42, baseY + 0.19, cz + 26);
  for (let cb = 0; cb < 4; cb++) addBoxPart(w5DsWood, 2.6, 0.48, 0.62, cx + (cb < 2 ? -18 + cb * 6 : 12 + (cb - 2) * 6), baseY + 0.24, cz + 45);
  addW3GroundedCol(w5DsWood, 0.10, 0.12, baseY + 2.45, baseY, 5, cx - 22, cz + 44);
  for (const s of [-1, 1]) addBoxPart(w5DsStone, 0.68, 2.1, 0.42, cx + 52, ctx.getHeight(cx + 52, cz - 2 + s * 3.5) + 1.05, cz - 2 + s * 3.5);
  for (const s of [-1, 1]) {
    addW3GroundedCol(w5DsWood, 0.10, 0.12, baseY + 3.4, baseY, 5, cx + s * 5.5, cz + 58);
    addConePart(w5DsOrb, 0.26, 0.42, 4, cx + s * 5.5, baseY + 3.62, cz + 58);
  }
  addBoxPart(w5DsStone, 1.85, 2.85, 0.44, cx, baseY + 1.42, cz + 62);
  addBoxPart(w5DsGold, 1.25, 1.85, 0.48, cx, baseY + 1.52, cz + 62);

  addWave3Mesh(group, w5DsStone, ctx.materials.stone);
  addWave3Mesh(group, w5DsBronze, bronzeDrumMat);
  addWave3Mesh(group, w5DsGold, ctx.materials.gold);
  addWave3Mesh(group, w5DsWood, ctx.materials.darkWood);
  addWave3Mesh(group, w5DsThatch, thatchMat);
  addWave3Mesh(group, w5DsOrb, pavLanternMat);

  group.add(
    new THREE.Mesh(mergeNormalized(dsExpStone), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(dsExpBronze), bronzeDrumMat),
    new THREE.Mesh(mergeNormalized(dsExpGold), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(dsExpWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(dsExpThatch), thatchMat),
    new THREE.Mesh(mergeNormalized(dsExpOrb), pavLanternMat),
    bInst,
    bunchInst,
    flInst
  );
  tagMotifIds(group, ['HV-B07', 'HV-D01', 'HV-E01', 'HV-E02', 'HV-E03', 'HV-E04']);

  ctx.scene.add(group);
  return { group, drumFaceMat };
}

function buildTayNguyenBrocadeSanctuaryMacro(
  ctx: VietnamBuilderContext,
  brocTex: THREE.DataTexture
): THREE.Group {
  const cx = -1160;
  const cz = 480;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 125 });
  const group = new THREE.Group();
  group.name = 'TayNguyenBrocadeSanctuaryMacro';
  const baseY = ctx.getHeight(cx, cz);

  // 1. 16 Towering Thổ Cẩm Brocade Totem Pillars with Scroll Bases
  const brocMat = new THREE.MeshStandardMaterial({ map: brocTex, roughness: 0.68 });
  ctx.extraMaterials.push(brocMat);
  // FIX HV05-4: Sculpted flared rolled-textile double-scroll pedestals cradling all 16 Thổ Cẩm brocade totem columns (ref 09!)
  const pillarGeo = new THREE.BoxGeometry(1.8, 13.5, 0.55);
  const scrollParts: THREE.BufferGeometry[] = [];
  const scrollBase = new THREE.BoxGeometry(2.35, 0.42, 1.35);
  scrollBase.translate(0, -0.35, 0);
  scrollParts.push(scrollBase);
  for (const sx of [-0.95, 0.95]) {
    const endRoll = new THREE.CylinderGeometry(0.46, 0.46, 1.25, 7);
    endRoll.rotateX(Math.PI * 0.5);
    endRoll.translate(sx, 0.15, 0);
    const innerCoil = new THREE.TorusGeometry(0.28, 0.08, 4, 7);
    innerCoil.translate(sx, 0.15, 0.64);
    scrollParts.push(endRoll, innerCoil);
  }
  const scrollGeo = mergeNormalized(scrollParts);
  const pilInst = new THREE.InstancedMesh(pillarGeo, brocMat, 16);
  const baseInst = new THREE.InstancedMesh(scrollGeo, ctx.materials.crimsonLacquer, 16);
  for (let i = 0; i < 16; i++) {
    const side = i < 8 ? -1 : 1;
    const k = i % 8;
    const px = cx + side * (16 + (k % 2) * 14);
    const pz = cz - 38 + k * 12;
    const py = ctx.getHeight(px, pz);
    setInstanceMatrix(pilInst, i, px, py + 7.2, pz, 0, side * 0.2, 0, 1, 1, 1);
    setInstanceMatrix(baseInst, i, px, py + 0.65, pz, 0, side * 0.2, 0, 1.4, 1.4, 1.4);
  }
  pilInst.instanceMatrix.needsUpdate = true;
  baseInst.instanceMatrix.needsUpdate = true;

  // 2. Central Tilted Giant 14m Conical Nón Lá Dome (with synced inner lattice truss + large flowing red silk ribbon + 4 columns) + Smooth Continuous 21m Nhà Rông + Bronze Gong Circle + Campfire + Decorated Cột Nêu
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#ebe3d2',
    map: ctx.pbr.bambooWeave?.map ?? ctx.pbr.timber.map,
    normalMap: ctx.pbr.bambooWeave?.normalMap ?? null,
    emissive: new THREE.Color('#6b3c1c'),
    emissiveIntensity: 0.14,
    roughness: 0.68,
    side: THREE.DoubleSide
  });
  const rosetteMat = new THREE.MeshStandardMaterial({
    color: '#c828c2',
    map: brocTex,
    emissive: new THREE.Color('#7a1c78'),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(nonMat, rosetteMat);
  // FIX HV05-1: Authentic Nón Lá h = 0.90*r ratio (r=7.0m -> h=6.3m), 16 concentric bamboo rings, ZERO columns piercing through hat, plus smaller golden wireframe crown above!
  const giantNon = new THREE.Mesh(new THREE.ConeGeometry(7.0, 6.3, 36, 1, true), nonMat);
  giantNon.position.set(cx, baseY + 14.8, cz - 14);
  giantNon.rotation.set(0.42, 0.2, 0.14);
  const trussGeo = createNonLaLatticeGeometry(6.85, 6.15, 16, 16);
  trussGeo.translate(0, -3.08, 0);
  const truss = new THREE.Mesh(trussGeo, ctx.materials.gold);
  truss.position.copy(giantNon.position);
  truss.rotation.copy(giantNon.rotation);
  // Suspended Golden Wireframe Nón Lá Crown floating above the main tilted Nón Lá peak (ref 09)
  const smallCrown = new THREE.Mesh(createNonLaLatticeGeometry(2.4, 2.15, 16, 8), ctx.materials.gold);
  smallCrown.position.set(cx + 0.6, baseY + 21.8, cz - 12.6);
  smallCrown.rotation.set(0.12, 0.2, 0.06);
  group.add(smallCrown);

  // Large flowing red silk ribbon (*dải lụa đỏ*) cascading gracefully from the tilted Nón Lá rim (ref 09)
  const ribbonParts: THREE.BufferGeometry[] = [];
  for (const rSide of [-1, 1]) {
    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + rSide * 4.4, baseY + 12.2, cz - 14 + rSide * 0.6),
      new THREE.Vector3(cx + rSide * 5.8, baseY + 9.2, cz - 12.4),
      new THREE.Vector3(cx + rSide * 4.2, baseY + 6.4, cz - 10.6),
      new THREE.Vector3(cx + rSide * 6.4, baseY + 3.6, cz - 8.2)
    ]);
    const ribGeo = new THREE.TubeGeometry(ribCurve, 14, 0.34, 5, false);
    ribGeo.scale(1.0, 1.0, 0.32);
    ribbonParts.push(ribGeo);
  }
  const nonChinRibbon = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx - 4.4, baseY + 12.2, cz - 14.4),
      new THREE.Vector3(cx, baseY + 9.6, cz - 12.2),
      new THREE.Vector3(cx + 4.4, baseY + 12.2, cz - 13.6)
    ]),
    14,
    0.26,
    6,
    false
  );
  ribbonParts.push(nonChinRibbon);
  group.add(new THREE.Mesh(mergeNormalized(ribbonParts), ctx.materials.crimsonLacquer));

  // 4 Slender Outer Tension Suspension Anchors touching ONLY the outer rim underside (ZERO columns piercing through Nón Lá surface!)
  const supportTimberParts: THREE.BufferGeometry[] = [];
  const supportGoldParts: THREE.BufferGeometry[] = [];
  const supportStoneParts: THREE.BufferGeometry[] = [];
  for (const [ox, oz] of [[-7.2, -5.8], [7.2, -5.8], [-7.2, 5.8], [7.2, 5.8]]) {
    const sx = cx + ox;
    const sz = cz - 14 + oz;
    const sy = ctx.getHeight(sx, sz);
    addCylPart(supportStoneParts, 0.42, 0.54, 0.55, 10, sx, sy + 0.28, sz);
    const cableCurve = new THREE.LineCurve3(
      new THREE.Vector3(sx, sy + 0.55, sz),
      new THREE.Vector3(cx + ox * 0.72, baseY + 11.4 + oz * Math.sin(0.42) * 0.42, cz - 14 + oz * 0.72)
    );
    supportGoldParts.push(new THREE.TubeGeometry(cableCurve, 2, 0.045, 5, false));
  }

  // Authentic 21m-Tall Tây Nguyên Nhà Rông Centerpiece at (cx, nrY, cz - 46) — sample max terrain height & extend stilts deep into slope!
  const nrX = cx;
  const nrZ = cz - 46;
  const nrY = Math.max(
    ctx.getHeight(nrX, nrZ),
    ctx.getHeight(nrX - 7.2, nrZ - 3.4),
    ctx.getHeight(nrX + 7.2, nrZ - 3.4),
    ctx.getHeight(nrX - 7.2, nrZ + 3.4),
    ctx.getHeight(nrX + 7.2, nrZ + 3.4)
  );
  const nrThatchParts: THREE.BufferGeometry[] = [];
  const nrWovenParts: THREE.BufferGeometry[] = [];
  const deckH = 2.5;
  const nrDeckY = nrY + deckH;
  // 15 Elevated timber stilt posts grounded deep below local terrain (-0.8m) so downhill stilts never float!
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const pxS = nrX + ix * 3.6;
      const pzS = nrZ + iz * 3.4;
      const footY = ctx.getHeight(pxS, pzS) - 0.8;
      const postH = Math.max(deckH + 0.8, nrDeckY - footY);
      addCylPart(supportTimberParts, 0.18, 0.22, postH, 8, pxS, footY + postH * 0.5, pzS);
    }
  }
  addBoxPart(supportTimberParts, 16.4, 0.34, 8.8, nrX, nrDeckY, nrZ); // elevated floor deck
  addBoxPart(supportTimberParts, 16.0, 0.28, 2.4, nrX, nrDeckY, nrZ + 5.2); // front verandah landing
  // Twin notched-log ceremonial staircases leading up to the Nhà Rông verandah
  for (const stSide of [-2.4, 2.4]) {
    addCylPart(supportTimberParts, 0.22, 0.26, 3.9, 8, nrX + stSide, nrY + 1.35, nrZ + 7.6, 0.82, 0);
    for (let k = 0; k < 6; k++) {
      addBoxPart(supportTimberParts, 0.72, 0.14, 0.35, nrX + stSide, nrY + 0.35 + k * 0.38, nrZ + 8.8 - k * 0.46);
    }
  }
  // Woven bamboo perimeter walls + Smooth Continuous 18.5m Axe-Blade Roof (lower thatchFiber skirt + upper bambooWeave panels — ZERO stepped slices!)
  addBoxPart(nrWovenParts, 15.2, 2.35, 7.6, nrX, nrDeckY + 1.25, nrZ - 0.2);
  const roofH = 18.5;
  const roofBaseW = 18.6;
  const roofTopW = 14.2;
  const roofBaseD = 10.6;
  const roofBaseY = nrDeckY + 2.15;
  const buildSmoothAxeBladeBand = (vStart: number, vEnd: number): THREE.BufferGeometry => {
    const segU = 20;
    const segV = 10;
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) * 2.0; // -1..1 along length X
        const vNorm = pos.getY(i) + 0.5; // 0..1 within band
        const v = vStart + vNorm * (vEnd - vStart); // 0 at eave .. 1 at ridge
        // Classic Ba Na / Kon Tum axe-blade taper: narrows smoothly near top while flaring up slightly at gables
        const halfW = (roofBaseW * 0.5) * (1.0 - 0.18 * Math.pow(v, 1.35));
        const halfZ = (roofBaseD * 0.5) * Math.pow(1.0 - v, 1.22) + 0.22;
        const gableSweep = Math.pow(Math.abs(u), 2.1) * 1.15 * v;
        const px = nrX + u * halfW;
        const py = roofBaseY + v * roofH + gableSweep;
        const pz = nrZ + side * halfZ;
        pos.setXYZ(i, px, py, pz);
      }
      geo.computeVertexNormals();
      parts.push(geo);
    }
    return applyWorldBoxUV(mergeNormalized(parts), 2.8);
  };
  // Lower 1/3 skirt in thick fibrous thatch + upper 2/3 steep blade in woven bamboo lattice
  nrThatchParts.push(buildSmoothAxeBladeBand(0.0, 0.36));
  nrWovenParts.push(buildSmoothAxeBladeBand(0.35, 1.0));

  // Solid woven bamboo triangular gable end-walls closing both ends of the smooth axe-blade roof
  const roofGableShape = new THREE.Shape();
  roofGableShape.moveTo(-roofBaseD * 0.5, 0);
  for (let k = 1; k <= 10; k++) {
    const v = k / 10;
    const halfZ = (roofBaseD * 0.5) * Math.pow(1.0 - v, 1.22) + 0.22;
    roofGableShape.lineTo(-halfZ, v * roofH + 1.15 * v);
  }
  for (let k = 10; k >= 0; k--) {
    const v = k / 10;
    const halfZ = (roofBaseD * 0.5) * Math.pow(1.0 - v, 1.22) + 0.22;
    roofGableShape.lineTo(halfZ, v * roofH + 1.15 * v);
  }
  roofGableShape.closePath();
  for (const endSide of [-1, 1]) {
    const endWall = new THREE.ShapeGeometry(roofGableShape, 10);
    endWall.rotateY(endSide > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
    endWall.translate(nrX + endSide * (roofBaseW * 0.44), roofBaseY, nrZ);
    nrWovenParts.push(endWall);
    // Carved wooden buffalo-horn & sun crest finial atop gable peaks
    addCylPart(supportGoldParts, 0.08, 0.14, 2.2, 6, nrX + endSide * (roofTopW * 0.5 + 0.6), roofBaseY + roofH + 1.45, nrZ, 0, -endSide * 0.42);
  }
  addBoxPart(supportTimberParts, roofTopW + 2.4, 0.34, 0.48, nrX, roofBaseY + roofH + 0.55, nrZ); // timber ridge beam

  const nrThatchMat = ctx.materials.thatchFiber ?? ctx.materials.ochreSand ?? ctx.materials.darkWood;
  const nrWovenMat = ctx.materials.bambooWeave ?? ctx.materials.darkWood;

  // Bronze Gong Circle (10 hanging bossed bronze gongs on wooden frames) + Glowing Ceremonial Campfire
  const fireX = cx;
  const fireZ = cz + 14;
  const fireY = ctx.getHeight(fireX, fireZ);
  const gongBronzeParts: THREE.BufferGeometry[] = [];
  const fireFlameParts: THREE.BufferGeometry[] = [];
  for (let gIdx = 0; gIdx < 10; gIdx++) {
    const a = -Math.PI * 0.82 + (gIdx / 9) * Math.PI * 1.64;
    const gx = fireX + Math.cos(a) * 11.5;
    const gz = fireZ + Math.sin(a) * 11.5;
    const gy = ctx.getHeight(gx, gz);
    const faceY = -a - Math.PI * 0.5;
    // Timber gong suspension frame
    for (const s of [-0.95, 0.95]) {
      addCylPart(supportTimberParts, 0.06, 0.08, 2.4, 6, gx + Math.cos(faceY) * s, gy + 1.2, gz - Math.sin(faceY) * s);
    }
    addBoxPart(supportTimberParts, 2.2, 0.12, 0.12, gx, gy + 2.35, gz, faceY);
    // Hammered bronze gong disc + raised central sound boss (*núm cồng*)
    const gongR = 0.58 - (gIdx % 3) * 0.08;
    const disc = new THREE.CylinderGeometry(gongR, gongR, 0.08, 16);
    disc.rotateX(Math.PI * 0.5);
    disc.rotateY(faceY);
    disc.translate(gx, gy + 1.45, gz);
    const boss = new THREE.SphereGeometry(gongR * 0.34, 8, 6);
    boss.translate(gx + Math.sin(faceY) * 0.08, gy + 1.45, gz + Math.cos(faceY) * 0.08);
    gongBronzeParts.push(disc, boss);
  }
  // Campfire stone ring, crossed firewood logs & layered glowing flame cones
  for (let st = 0; st < 12; st++) {
    const a = (st / 12) * Math.PI * 2;
    const rock = createSculptedRockGeometry(9200 + st, 0.42, 0.28, 0.38, 1);
    rock.translate(fireX + Math.cos(a) * 2.1, fireY + 0.18, fireZ + Math.sin(a) * 2.1);
    supportStoneParts.push(rock);
  }
  for (let lg = 0; lg < 6; lg++) {
    const a = (lg / 6) * Math.PI * 2;
    addCylPart(supportTimberParts, 0.12, 0.15, 2.6, 6, fireX + Math.cos(a) * 0.45, fireY + 0.55, fireZ + Math.sin(a) * 0.45, 0.95, a);
  }
  for (const [ox, oz, rad, fh] of [[0, 0, 0.95, 2.9], [-0.45, 0.32, 0.62, 2.0], [0.48, -0.25, 0.68, 2.2], [0.15, 0.45, 0.55, 1.8]] as Array<[number, number, number, number]>) {
    const cone = new THREE.ConeGeometry(rad, fh, 8);
    cone.translate(fireX + ox, fireY + 0.35 + fh * 0.5, fireZ + oz);
    fireFlameParts.push(cone);
  }
  const campFlameMat = new THREE.MeshStandardMaterial({
    color: '#ff9632',
    emissive: new THREE.Color('#ff5a14'),
    emissiveIntensity: 2.2,
    roughness: 0.35
  });
  ctx.extraMaterials.push(campFlameMat);
  const campLight = new THREE.PointLight('#ff8432', 2.4, 34, 1.6);
  campLight.position.set(fireX, fireY + 2.8, fireZ);

  // 3 Concentric Brocade Rosette Discs with Gilded Rings & 8-Point Central Star Motifs (ref 09)
  const rosetteParts: THREE.BufferGeometry[] = [];
  for (const [ox, oz, rad] of [[-12, -26, 3.6], [0, -28, 4.4], [12, -26, 3.6]]) {
    const rx = cx + ox;
    const ry = baseY + 6.5;
    const rz = cz + oz;
    const disc = new THREE.CircleGeometry(rad, 24);
    disc.translate(rx, ry, rz);
    rosetteParts.push(disc);
    // Concentric gilded rosette rings & 8-point brocade star rays
    for (const frac of [0.96, 0.68, 0.36]) {
      const rRing = new THREE.TorusGeometry(rad * frac, 0.14, 6, 24);
      rRing.translate(rx, ry, rz + 0.08);
      supportGoldParts.push(rRing);
    }
    for (let st = 0; st < 8; st++) {
      const a = (st / 8) * Math.PI * 2;
      const ray = new THREE.ConeGeometry(rad * 0.12, rad * 0.62, 4);
      ray.rotateZ(a - Math.PI * 0.5);
      ray.translate(rx + Math.cos(a) * rad * 0.34, ry + Math.sin(a) * rad * 0.34, rz + 0.10);
      supportGoldParts.push(ray);
    }
  }
  const archBackdrop = new THREE.Mesh(new THREE.TorusGeometry(13.0, 0.9, 8, 32, Math.PI), ctx.materials.crimsonLacquer);
  archBackdrop.position.set(cx, baseY + 1.0, cz - 24);

  // Decorated Cột Nêu with crown bamboo fronds, sun-bird apex & hanging chimes
  const neuX = cx + 22;
  const neuZ = cz + 4;
  const neuY = ctx.getHeight(neuX, neuZ);
  const cotNeu = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 15.5, 10), ctx.materials.darkWood);
  cotNeu.position.set(neuX, neuY + 7.75, neuZ);
  // 8 Arching crown bamboo fronds + hanging chime pendants + golden sun-bird apex
  for (let fr = 0; fr < 8; fr++) {
    const a = (fr / 8) * Math.PI * 2;
    const frondCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(neuX, neuY + 14.2, neuZ),
      new THREE.Vector3(neuX + Math.cos(a) * 1.9, neuY + 15.2, neuZ + Math.sin(a) * 1.9),
      new THREE.Vector3(neuX + Math.cos(a) * 3.2, neuY + 13.6, neuZ + Math.sin(a) * 3.2)
    ]);
    supportGoldParts.push(new THREE.TubeGeometry(frondCurve, 8, 0.055, 5, false));
    // Hanging tubular bamboo/bronze chimes dangling from each frond tip
    const chimeX = neuX + Math.cos(a) * 2.85;
    const chimeZ = neuZ + Math.sin(a) * 2.85;
    addCylPart(gongBronzeParts, 0.05, 0.05, 1.35, 6, chimeX, neuY + 12.9, chimeZ);
    const chimeCone = new THREE.ConeGeometry(0.18, 0.42, 6);
    chimeCone.translate(chimeX, neuY + 12.15, chimeZ);
    supportGoldParts.push(chimeCone);
  }
  // Cross-arms & brocade spirit-ring halfway up Cột Nêu
  const neuRing = new THREE.TorusGeometry(1.15, 0.08, 6, 16);
  neuRing.rotateX(Math.PI * 0.5);
  neuRing.translate(neuX, neuY + 10.6, neuZ);
  supportGoldParts.push(neuRing);
  const sunBird = new THREE.ConeGeometry(0.42, 1.45, 6);
  sunBird.translate(neuX, neuY + 16.2, neuZ);
  supportGoldParts.push(sunBird);

  // 3. FIX HV05-3: 48 Multi-Colored 3D Tường Vân Auspicious Clouds preserving true bi-polar crimson-to-cobalt & golden border vertex colors!
  const tvMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#28201e'),
    emissiveIntensity: 0.25,
    roughness: 0.38
  });
  ctx.extraMaterials.push(tvMat);
  const tvInst = new THREE.InstancedMesh(createTuongVanScrollGeometry(), tvMat, 48);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rad = 26 + (i % 5) * 16;
    setInstanceMatrix(tvInst, i, cx + Math.cos(a) * rad, baseY + 12 + (i % 6) * 3.8, cz + Math.sin(a) * rad, 0, -a, 0, 1.5, 1.2, 1.0);
  }
  tvInst.instanceMatrix.needsUpdate = true;

  // --- 200-Item Macro Visual QC & Expansion (117–130): Tây Nguyên Thổ Cẩm ---
  const tnExpWood: THREE.BufferGeometry[] = [];
  const tnExpThatch: THREE.BufferGeometry[] = [];
  const tnExpWoven: THREE.BufferGeometry[] = [];
  const tnExpStone: THREE.BufferGeometry[] = [];
  const tnExpUrn: THREE.BufferGeometry[] = [];
  const tnExpBroc: THREE.BufferGeometry[] = [];

  // 117 & 128: 2 Flanking Nhà Dài Ê Đê longhouses on stilts (extended 1.8m deeper into sloped highland terrain!)
  for (const side of [-1, 1]) {
    const lx = cx + side * 34.0;
    const lz = cz - 24.0;
    const ly = Math.max(ctx.getHeight(lx, lz), ctx.getHeight(lx - 6, lz), ctx.getHeight(lx + 6, lz));
    for (let pxOff = -6; pxOff <= 6; pxOff += 3) {
      for (const pzOff of [-2.4, 2.4]) {
        addCylPart(tnExpWood, 0.14, 0.16, 4.0, 6, lx + pxOff, ly + 0.2, lz + pzOff);
      }
    }
    addBoxPart(tnExpWood, 15.2, 0.26, 6.2, lx, ly + 2.2, lz);
    addBoxPart(tnExpWoven, 14.0, 2.2, 5.2, lx, ly + 3.4, lz);
    const lRoof = createGableRoofGeometry(16.4, 7.2, 3.2, 0.18, 'x');
    lRoof.translate(lx, ly + 4.5, lz);
    tnExpThatch.push(lRoof);
    addBoxPart(tnExpWood, 4.6, 0.45, 0.72, lx, ly + 2.55, lz + 3.6); // Kpan bench
  }
  // 118 & 122: 6 Carved wooden Tượng Nhà Mồ sculptures & buffalo-horn totems
  for (let t = 0; t < 6; t++) {
    const ta = -Math.PI * 0.75 + (t / 5) * Math.PI * 1.5;
    const tx = cx + Math.cos(ta) * 32.0;
    const tz = cz + 6.0 + Math.sin(ta) * 26.0;
    const ty = ctx.getHeight(tx, tz);
    addCylPart(tnExpWood, 0.22, 0.26, 2.2, 6, tx, ty + 1.1, tz);
    tnExpWood.push(new THREE.SphereGeometry(0.28, 6, 5).translate(tx, ty + 2.45, tz));
    addBoxPart(tnExpWood, 1.35, 0.14, 0.14, tx, ty + 2.78, tz);
  }
  // 119: 2 Khung Cửi Dệt Thổ Cẩm weaving looms & brocade drying racks
  for (const side of [-1, 1]) {
    const wx = cx + side * 20.0;
    const wz = cz + 22.0;
    const wy = ctx.getHeight(wx, wz);
    addCylPart(tnExpWood, 0.08, 0.09, 2.6, 5, wx - 1.2, wy + 1.3, wz);
    addCylPart(tnExpWood, 0.08, 0.09, 2.6, 5, wx + 1.2, wy + 1.3, wz);
    addBoxPart(tnExpWood, 2.8, 0.12, 0.12, wx, wy + 2.55, wz);
    addBoxPart(tnExpBroc, 2.2, 1.85, 0.08, wx, wy + 1.55, wz);
  }
  // 120 & 123: 12 Ché Rượu Cần rice-wine jars & stone gong festival dance floor
  addCylPart(tnExpStone, 10.5, 11.2, 0.16, 24, fireX, fireY + 0.08, fireZ);
  for (let j = 0; j < 12; j++) {
    const ja = (j / 12) * Math.PI * 2;
    const jx = fireX + Math.cos(ja) * 7.8;
    const jz = fireZ + Math.sin(ja) * 7.8;
    const jy = ctx.getHeight(jx, jz);
    addCylPart(tnExpUrn, 0.26, 0.20, 0.68, 8, jx, jy + 0.34, jz);
  }
  // 121 & 124 & 127: Máng Nước Giọt bamboo water-trough, basalt boulders & 2 Chòi Canh Rẫy watch-huts
  addBoxPart(tnExpStone, 3.2, 0.55, 2.4, cx - 28, baseY + 0.28, cz + 14);
  addCylPart(tnExpWoven, 0.12, 0.14, 4.2, 6, cx - 29.5, baseY + 1.45, cz + 14, 0, 0.28);
  for (const [hx, hz] of [[-44, 18], [44, 18]] as Array<[number, number]>) {
    const hy = ctx.getHeight(cx + hx, cz + hz);
    for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      addCylPart(tnExpWood, 0.09, 0.11, 4.2, 5, cx + hx + ox, hy + 2.1, cz + hz + oz);
    }
    const hRoof = createGableRoofGeometry(3.4, 3.4, 1.6, 0.12, 'x');
    hRoof.translate(cx + hx, hy + 4.2, cz + hz);
    tnExpThatch.push(hRoof);
  }

  // --- Wave 2 Macro Visual QC & Expansion (317–330): Tây Nguyên Buffalo-Post, Coffee Terrace & Highland Craft ---
  // 317: Cột Đâm Trâu / Cây Nêu Lễ Hội (Ceremonial Buffalo-Post) in the gong plaza
  const bpX = fireX + 6.5;
  const bpZ = fireZ - 5.5;
  const bpY = ctx.getHeight(bpX, bpZ);
  addCylPart(tnExpWood, 0.14, 0.22, 6.8, 6, bpX, bpY + 3.4, bpZ);
  addBoxPart(tnExpWood, 2.4, 0.18, 0.18, bpX, bpY + 4.6, bpZ);
  addConePart(tnExpBroc, 0.85, 0.95, 5, bpX, bpY + 6.2, bpZ);
  addConePart(tnExpWoven, 0.55, 0.65, 5, bpX, bpY + 7.1, bpZ);
  // 318, 319, 330: Vườn Cà Phê Bậc Thang (3 stepped coffee terraces with deep retaining walls), sun-drying bean platform & grounded shade hut!
  const cfX = cx + 38;
  const cfZ = cz + 6;
  const cfY = ctx.getHeight(cfX, cfZ);
  for (let tier = 0; tier < 3; tier++) {
    const tx = cfX + tier * 3.8;
    const ty = cfY + tier * 0.75;
    addBoxPart(tnExpStone, 3.4, 2.72, 14.0, tx, ty - 0.64, cfZ);
    for (let s = -2; s <= 2; s++) {
      addConePart(tnExpWoven, 0.58, 0.95, 5, tx, ty + 1.15, cfZ + s * 2.6);
    }
  }
  addBoxPart(tnExpWood, 5.2, 0.22, 4.2, cfX - 5.5, cfY + 0.22, cfZ + 8.5);
  addBoxPart(tnExpUrn, 4.4, 0.10, 3.4, cfX - 5.5, cfY + 0.38, cfZ + 8.5);
  const shY = ctx.getHeight(cfX + 7.5, cfZ - 8.5);
  for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    addCylPart(tnExpWood, 0.06, 0.08, 2.8, 5, cfX + 7.5 + ox, shY + 1.0, cfZ - 8.5 + oz);
  }
  addConePart(tnExpThatch, 2.2, 1.25, 4, cfX + 7.5, shY + 2.95, cfZ - 8.5, Math.PI * 0.25);
  // 320, 321, 325, 327: Notched log stairs on Nhà Dài, 2 elevated rice granaries (Chòi Lúa), maize racks & basket/shield stands
  for (const side of [-1, 1]) {
    const lx = cx + side * 34.0;
    const lz = cz - 24.0;
    const ly = ctx.getHeight(lx, lz);
    addBoxPart(tnExpWood, 0.65, 2.8, 0.24, lx, ly + 1.15, lz + 4.4, 0, -0.58, 0);
    // 321: Elevated rice granary
    const gx = cx + side * 42.0;
    const gz = cz - 8.0;
    const gy = ctx.getHeight(gx, gz);
    addBoxPart(tnExpWoven, 3.4, 2.0, 2.8, gx, gy + 2.6, gz);
    addConePart(tnExpThatch, 2.9, 1.5, 4, gx, gy + 4.3, gz, Math.PI * 0.25);
    for (const [ox, oz] of [[-1.3, -1.0], [1.3, -1.0], [-1.3, 1.0], [1.3, 1.0]]) {
      addCylPart(tnExpWood, 0.08, 0.10, 1.6, 5, gx + ox, gy + 0.8, gz + oz);
    }
    // 325 & 327: Maize-drying rack & rattan basket/shield stand
    addBoxPart(tnExpWood, 2.4, 1.4, 0.12, lx - side * 8.5, ly + 0.7, lz + 2.5);
    addBoxPart(tnExpWoven, 1.8, 1.1, 0.25, lx - side * 8.5, ly + 1.1, lz - 2.5);
  }
  // 322, 323, 324, 326, 328, 329: T'rưng & lithophone racks, H'gơr giant drum, village entrance arch, water-spring basin, 4 boundary stones & 6 fire-circle log seats
  for (const side of [-1, 1]) {
    addBoxPart(tnExpWood, 1.8, 1.4, 0.35, fireX + side * 9.5, fireY + 0.7, fireZ - 4.2);
  }
  addCylPart(tnExpWood, 0.58, 0.58, 2.2, 6, fireX - 6.8, fireY + 0.85, fireZ + 4.5, 0, Math.PI * 0.5);
  const gateZ = cz + 34;
  const gateY = ctx.getHeight(cx, gateZ);
  addCylPart(tnExpWood, 0.18, 0.22, 5.2, 6, cx - 3.8, gateY + 2.6, gateZ);
  addCylPart(tnExpWood, 0.18, 0.22, 5.2, 6, cx + 3.8, gateY + 2.6, gateZ);
  addBoxPart(tnExpWood, 8.8, 0.35, 0.35, cx, gateY + 5.1, gateZ);
  addBoxPart(tnExpBroc, 5.4, 0.95, 0.10, cx, gateY + 4.45, gateZ);
  addBoxPart(tnExpStone, 2.2, 0.22, 1.6, cx - 26.5, baseY + 0.11, cz + 16.5);
  for (let i = 0; i < 6; i++) {
    const sa = (i / 6) * Math.PI * 2;
    addBoxPart(tnExpWood, 1.65, 0.38, 0.48, fireX + Math.cos(sa) * 5.2, fireY + 0.19, fireZ + Math.sin(sa) * 5.2, -sa + Math.PI * 0.5);
  }
  for (const [bx, bz] of [[-18, 30], [18, 30], [-28, -4], [28, -4]] as Array<[number, number]>) {
    addCylPart(tnExpStone, 0.26, 0.32, 1.25, 5, cx + bx, ctx.getHeight(cx + bx, cz + bz) + 0.62, cz + bz);
  }

  // --- Wave 3 Macro Visual QC & Expansion (630–658): Brocade Weaving Courtyard, Nhà Dài Gong Gallery & Totem Avenue ---
  const w3TnWood: THREE.BufferGeometry[] = [];
  const w3TnThatch: THREE.BufferGeometry[] = [];
  const w3TnWoven: THREE.BufferGeometry[] = [];
  const w3TnStone: THREE.BufferGeometry[] = [];
  const w3TnUrn: THREE.BufferGeometry[] = [];
  const w3TnBroc: THREE.BufferGeometry[] = [];
  const w3TnBronze: THREE.BufferGeometry[] = [];
  const w3TnFlame: THREE.BufferGeometry[] = [];
  // 630–633: Brocade weaving courtyard pergola, 4 indigo dye vats, spinning wheel/skein rack & 3 textile display frames
  const wcX = cx - 34;
  const wcZ = cz + 6;
  const wcY = Math.max(ctx.getHeight(wcX, wcZ), ctx.getHeight(wcX - 4.6, wcZ), ctx.getHeight(wcX + 4.6, wcZ));
  addW3Plinth(w3TnStone, 9.2, 6.4, wcY + 0.28, wcY, wcX, wcZ);
  for (const [ox, oz] of [[-3.8, -2.4], [3.8, -2.4], [-3.8, 2.4], [3.8, 2.4]]) {
    addW3GroundedCol(w3TnWood, 0.10, 0.12, wcY + 3.05, wcY + 0.28, 5, wcX + ox, wcZ + oz);
  }
  addW3HipRoof(w3TnThatch, null, 10.0, 7.2, wcY + 3.05, 1.45, wcX, wcZ);
  for (let d = 0; d < 4; d++) {
    addCylPart(w3TnUrn, 0.36, 0.30, 0.68, 6, wcX - 5.8, wcY + 0.34, wcZ - 2.2 + d * 1.45);
  }
  addBoxPart(w3TnWood, 1.8, 1.25, 0.55, wcX + 2.4, wcY + 0.9, wcZ - 1.2);
  addCylPart(w3TnWood, 0.48, 0.48, 0.10, 6, wcX + 2.4, wcY + 1.25, wcZ - 1.2, 0, Math.PI * 0.5);
  for (let f = 0; f < 3; f++) {
    const fx = wcX - 2.6 + f * 2.6;
    addW3GroundedPost(w3TnWood, 0.08, 0.08, wcY + 2.35, wcY + 0.28, fx - 0.85, wcZ + 4.4);
    addW3GroundedPost(w3TnWood, 0.08, 0.08, wcY + 2.35, wcY + 0.28, fx + 0.85, wcZ + 4.4);
    addBoxPart(w3TnBroc, 1.6, 1.45, 0.08, fx, wcY + 1.45, wcZ + 4.4);
  }
  // 634–637: Nhà Dài ceremonial hearth, 6-gong gallery rack, carved Kpan bench dais & 6 ancestral rượu cần jars (on deep stone terrace!)
  const ndX = cx + 34;
  const ndZ = cz - 14;
  const ndY = Math.max(ctx.getHeight(ndX, ndZ), ctx.getHeight(ndX - 4, ndZ), ctx.getHeight(ndX + 4, ndZ));
  addW3Plinth(w3TnStone, 14.2, 11.2, ndY + 0.08, ndY, ndX - 1.2, ndZ + 3.4);
  addBoxPart(w3TnStone, 1.8, 0.45, 1.6, ndX - 6.2, ndY + 0.22, ndZ);
  addConePart(w3TnFlame, 0.32, 0.58, 5, ndX - 6.2, ndY + 0.72, ndZ);
  addW3GroundedPost(w3TnWood, 0.12, 0.12, ndY + 2.45, ndY, ndX - 3.6, ndZ + 2.8);
  addW3GroundedPost(w3TnWood, 0.12, 0.12, ndY + 2.45, ndY, ndX + 3.6, ndZ + 2.8);
  addBoxPart(w3TnWood, 7.6, 0.16, 0.16, ndX, ndY + 2.42, ndZ + 2.8);
  for (let g = 0; g < 6; g++) {
    const gr = 0.28 + (5 - g) * 0.04;
    addCylPart(w3TnBronze, gr, gr, 0.14, 6, ndX - 2.5 + g * 1.0, ndY + 1.65, ndZ + 2.8, Math.PI * 0.5, 0);
  }
  addBoxPart(w3TnWood, 5.8, 0.42, 1.45, ndX, ndY + 0.21, ndZ + 5.2);
  addBoxPart(w3TnWood, 4.8, 0.38, 0.65, ndX, ndY + 0.62, ndZ + 5.2);
  for (let j = 0; j < 6; j++) {
    addCylPart(w3TnUrn, 0.22, 0.18, 0.65, 5, ndX - 2.5 + j * 1.0, ndY + 0.32, ndZ + 6.8);
  }
  // 638–641, 655, 658: 3 coffee parchment drying beds, pulping trough, shade pergola, rattan harvest baskets, pepper rack & basalt retaining walls
  for (let b = 0; b < 3; b++) {
    const bx = cfX - 11.5;
    const bz = cfZ + 2.0 + b * 3.4;
    const by = ctx.getHeight(bx, bz);
    addW3Plinth(w3TnStone, 4.4, 2.6, by + 0.12, by, bx, bz);
    addBoxPart(w3TnWood, 4.2, 0.65, 2.4, bx, by + 0.38, bz);
    addBoxPart(w3TnWoven, 3.8, 0.10, 2.1, bx, by + 0.76, bz);
  }
  const cfShedY = Math.max(cfY, ctx.getHeight(cfX + 12.0, cfZ + 10.0));
  addW3Plinth(w3TnStone, 5.2, 4.2, cfShedY + 0.18, cfShedY, cfX + 12.0, cfZ + 10.0);
  addBoxPart(w3TnWood, 2.4, 0.72, 0.95, cfX - 4.2, cfY + 0.36, cfZ + 13.0);
  addBoxPart(w3TnStone, 1.4, 0.55, 1.2, cfX - 1.8, cfY + 0.28, cfZ + 13.0);
  for (const [ox, oz] of [[-2.0, -1.6], [2.0, -1.6], [-2.0, 1.6], [2.0, 1.6]]) {
    addW3GroundedCol(w3TnWood, 0.07, 0.08, cfShedY + 2.52, cfShedY + 0.18, 5, cfX + 12.0 + ox, cfZ + 10.0 + oz);
  }
  addBoxPart(w3TnWoven, 4.6, 0.12, 3.6, cfX + 12.0, cfShedY + 2.55, cfZ + 10.0);
  for (let k = 0; k < 4; k++) addConePart(w3TnWoven, 0.34, 0.68, 5, cfX - 8.5 + k * 0.72, cfY + 0.34, cfZ + 11.2);
  addBoxPart(w3TnWoven, 2.8, 0.65, 1.4, cfX + 4.5, cfY + 0.32, cfZ + 13.5);
  addW3Plinth(w3TnStone, 1.2, 16.0, cfY + 2.4, cfY, cfX + 13.5, cfZ);
  // 642–645: Carved totem avenue (elephant posts, hornbill posts, fertility/drum statues & basalt curbs)
  for (const side of [-1, 1]) {
    for (let t = 0; t < 3; t++) {
      const tx = cx + side * 6.2;
      const tz = cz + 18 + t * 5.2;
      const ty = ctx.getHeight(tx, tz);
      addW3GroundedCol(w3TnWood, 0.22, 0.28, ty + 3.4, ty, 5, tx, tz);
      addBoxPart(t === 1 ? w3TnBroc : w3TnWood, 1.25, 0.35, 0.35, tx, ty + 3.05, tz);
      addConePart(w3TnWood, 0.32, 0.65, 4, tx, ty + 3.72, tz);
    }
    addBoxPart(w3TnStone, 0.55, 0.32, 15.0, cx + side * 5.2, baseY + 0.16, cz + 23.0);
  }
  // 646–654, 656–657: Nhà Rông landing, bamboo water-tube rack, crossbow display, wind-organ stand, radial fire-ring, offering tray, 6 resin torches, basalt gate boulders, buffalo-horn gables, rice-pounding shed & welcome totem
  addBoxPart(w3TnWood, 6.4, 0.45, 3.2, cx, baseY + 0.22, cz - 8.5);
  addBoxPart(w3TnWood, 2.2, 1.4, 0.55, cx - 28.5, baseY + 0.7, cz + 16.5);
  addBoxPart(w3TnWood, 1.8, 1.1, 0.22, cx + 34, ctx.getHeight(cx + 34, cz - 24) + 1.4, cz - 20.5);
  addBoxPart(w3TnWood, 1.6, 0.78, 0.85, fireX + 9.5, fireY + 0.39, fireZ + 3.5);
  addCylPart(w3TnStone, 2.8, 3.1, 0.36, 6, fireX, fireY + 0.18, fireZ);
  addBoxPart(w3TnWoven, 1.4, 0.62, 1.1, bpX, bpY + 0.31, bpZ + 1.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const tx = fireX + Math.cos(a) * 11.5;
    const tz = fireZ + Math.sin(a) * 11.5;
    const ty = ctx.getHeight(tx, tz);
    addW3GroundedCol(w3TnWood, 0.06, 0.08, ty + 2.45, ty, 5, tx, tz);
    addConePart(w3TnFlame, 0.18, 0.38, 5, tx, ty + 2.68, tz);
  }
  for (const side of [-1, 1]) {
    addConePart(w3TnStone, 1.15, 1.65, 5, cx + side * 5.6, gateY + 0.82, gateZ);
    const lx = cx + side * 34.0;
    const lz = cz - 24.0;
    const ly = ctx.getHeight(lx, lz);
    addBoxPart(w3TnWood, 1.6, 0.14, 0.14, lx, ly + 5.6, lz - 3.6, 0, 0, 0.45);
    addBoxPart(w3TnWood, 1.6, 0.14, 0.14, lx, ly + 5.6, lz - 3.6, 0, 0, -0.45);
  }
  const mpX = cx - 44;
  const mpZ = cz + 25;
  const mpY = Math.max(ctx.getHeight(mpX, mpZ), ctx.getHeight(mpX - 1.5, mpZ), ctx.getHeight(mpX + 1.5, mpZ));
  addW3Plinth(w3TnStone, 3.6, 3.0, mpY + 0.18, mpY, mpX, mpZ);
  for (const [ox, oz] of [[-1.3, -1.0], [1.3, -1.0], [-1.3, 1.0], [1.3, 1.0]]) {
    addW3GroundedCol(w3TnWood, 0.08, 0.09, mpY + 2.42, mpY + 0.18, 5, mpX + ox, mpZ + oz);
  }
  addW3HipRoof(w3TnThatch, null, 3.4, 2.8, mpY + 2.42, 0.95, mpX, mpZ);
  addBoxPart(w3TnWood, 1.8, 0.55, 0.55, mpX, mpY + 0.45, mpZ);
  addW3GroundedCol(w3TnWood, 0.14, 0.18, gateY + 3.2, gateY, 5, cx + 6.8, gateZ + 3.5);
  addBoxPart(w3TnBroc, 1.25, 0.42, 0.12, cx + 7.4, gateY + 2.65, gateZ + 3.5);

  addWave3Mesh(group, w3TnWood, ctx.materials.darkWood);
  addWave3Mesh(group, w3TnThatch, nrThatchMat);
  addWave3Mesh(group, w3TnWoven, nrWovenMat);
  addWave3Mesh(group, w3TnStone, ctx.materials.stone);
  addWave3Mesh(group, w3TnUrn, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w3TnBroc, brocMat);
  addWave3Mesh(group, w3TnBronze, ctx.materials.bronze);
  addWave3Mesh(group, w3TnFlame, campFlameMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1031–1059): Coffee Drying Terrace, Bahnar Rice-Granary, Elephant Platform & T'rưng Pavilion ---
  const w4TnWood: THREE.BufferGeometry[] = [];
  const w4TnThatch: THREE.BufferGeometry[] = [];
  const w4TnWoven: THREE.BufferGeometry[] = [];
  const w4TnStone: THREE.BufferGeometry[] = [];
  const w4TnUrn: THREE.BufferGeometry[] = [];
  const w4TnBroc: THREE.BufferGeometry[] = [];
  const w4TnBronze: THREE.BufferGeometry[] = [];
  const w4TnFlame: THREE.BufferGeometry[] = [];
  // 1031–1034: Coffee-bean drying terrace, stone gong-tuning bench, Bahnar stilt rice-granary (cx + 48, cz - 6) & elephant-mounting platform (cx - 50, cz - 8)
  const cfW4X = cx + 48;
  const cfW4Z = cz + 12;
  const cfW4Y = Math.max(ctx.getHeight(cfW4X, cfW4Z), ctx.getHeight(cfW4X + 3, cfW4Z));
  addW3Plinth(w4TnStone, 9.2, 6.2, cfW4Y + 0.35, cfW4Y, cfW4X, cfW4Z);
  for (let r = -2; r <= 2; r++) addBoxPart(w4TnWood, 7.6, 0.12, 0.55, cfW4X, cfW4Y + 0.42, cfW4Z + r * 1.05);
  addBoxPart(w4TnWood, 4.2, 0.52, 0.72, cx + 22, baseY + 0.26, cz + 30);
  addCylPart(w4TnBronze, 0.45, 0.45, 0.10, 6, cx + 22, baseY + 0.95, cz + 28.5, Math.PI * 0.5, 0);
  const grTnX = cx + 48;
  const grTnZ = cz - 8;
  const grTnY = Math.max(ctx.getHeight(grTnX, grTnZ), ctx.getHeight(grTnX + 2, grTnZ));
  for (const [ox, oz] of [[-1.6, -1.3], [1.6, -1.3], [-1.6, 1.3], [1.6, 1.3]]) addW3GroundedCol(w4TnWood, 0.10, 0.12, grTnY + 1.65, grTnY - 0.5, 5, grTnX + ox, grTnZ + oz);
  addBoxPart(w4TnWoven, 3.8, 1.75, 3.0, grTnX, grTnY + 2.52, grTnZ);
  addW3HipRoof(w4TnThatch, null, 4.8, 4.0, grTnY + 3.4, 1.35, grTnX, grTnZ);
  addBoxPart(w4TnWood, 0.55, 2.2, 0.16, grTnX, grTnY + 0.95, grTnZ + 2.0, 0, -0.45, 0);
  const elX = cx - 50;
  const elZ = cz - 8;
  const elY = Math.max(ctx.getHeight(elX, elZ), ctx.getHeight(elX - 2, elZ));
  for (const [ox, oz] of [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.2], [1.5, 1.2]]) addW3GroundedCol(w4TnWood, 0.12, 0.14, elY + 2.2, elY, 5, elX + ox, elZ + oz);
  addBoxPart(w4TnWood, 3.6, 0.22, 2.8, elX, elY + 2.25, elZ);
  // 1035–1042: Crossbow archery range, T'rưng pavilion (cx - 18, cz + 38), buffalo-skull gate, cơm lam hearth, gùi basket stall, Đàn Đá lithophone, rượu cần shed & Nhà Mồ canopy
  for (const s of [-1, 1]) addCylPart(w4TnWoven, 0.68, 0.68, 0.18, 6, cx + s * 4.5, ctx.getHeight(cx, cz - 46) + 1.25, cz - 46, Math.PI * 0.5, 0);
  const trX = cx - 18;
  const trZ = cz + 38;
  const trY = Math.max(ctx.getHeight(trX, trZ), ctx.getHeight(trX - 2, trZ));
  addW3Plinth(w4TnStone, 5.2, 4.2, trY + 0.28, trY, trX, trZ);
  for (const [ox, oz] of [[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]]) addW3GroundedCol(w4TnWood, 0.09, 0.11, trY + 2.75, trY + 0.28, 5, trX + ox, trZ + oz);
  addW3HipRoof(w4TnThatch, null, 6.0, 4.8, trY + 2.75, 1.15, trX, trZ);
  addBoxPart(w4TnWoven, 1.8, 1.15, 0.55, trX, trY + 0.85, trZ);
  for (const s of [-1, 1]) addW3GroundedCol(w4TnWood, 0.16, 0.20, gateY + 3.8, gateY, 5, cx + s * 4.2, gateZ + 8.0);
  addBoxPart(w4TnWood, 9.2, 0.26, 0.28, cx, gateY + 3.75, gateZ + 8.0);
  addCylPart(w4TnStone, 1.15, 1.25, 0.35, 6, cx + 18, baseY + 0.18, cz + 38);
  addConePart(w4TnFlame, 0.38, 0.58, 5, cx + 18, baseY + 0.58, cz + 38);
  addBoxPart(w4TnWood, 2.8, 1.35, 0.85, cx + 28, baseY + 0.68, cz + 34);
  addBoxPart(w4TnWood, 2.2, 0.85, 0.65, trX + 5.2, trY + 0.42, trZ);
  for (let d = 0; d < 5; d++) addBoxPart(w4TnStone, 0.28, 0.12, 0.65, trX + 4.4 + d * 0.38, trY + 0.92, trZ);
  const rcX = cx + 36;
  const rcZ = cz + 26;
  const rcY = ctx.getHeight(rcX, rcZ);
  for (const [ox, oz] of [[-1.6, -1.0], [1.6, -1.0], [-1.6, 1.0], [1.6, 1.0]]) addW3GroundedCol(w4TnWood, 0.08, 0.10, rcY + 2.15, rcY, 5, rcX + ox, rcZ + oz);
  addW3HipRoof(w4TnThatch, null, 4.0, 2.8, rcY + 2.15, 0.82, rcX, rcZ);
  for (let j = -1; j <= 1; j++) addCylPart(w4TnUrn, 0.24, 0.18, 0.62, 5, rcX + j * 0.9, rcY + 0.31, rcZ);
  const nmTnX = cx - 48;
  const nmTnZ = cz - 28;
  const nmTnY = ctx.getHeight(nmTnX, nmTnZ);
  for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) addW3GroundedCol(w4TnWood, 0.10, 0.12, nmTnY + 2.45, nmTnY, 5, nmTnX + ox, nmTnZ + oz);
  addW3HipRoof(w4TnThatch, null, 3.6, 3.6, nmTnY + 2.45, 1.25, nmTnX, nmTnZ);
  // 1043–1059: 6 pepper poles, indigo trough, coffee mortar, bamboo aqueduct, 6 torch standards, elder bench, 4 brocade masts, 8 campfire stones, đing năm stand, ox-cart, perimeter fence, coffee roaster, 4 bird-totems, yarn line, spring niche, directional totem & UNESCO stele
  for (let p = 0; p < 6; p++) addW3GroundedCol(w4TnWood, 0.08, 0.10, cfW4Y + 2.4, cfW4Y, 4, cfW4X - 3.5 + (p % 3) * 3.5, cfW4Z + 6.5 + Math.floor(p / 3) * 3.2);
  addBoxPart(w4TnWood, 2.4, 0.58, 0.85, wcX + 6.5, wcY + 0.29, wcZ);
  addCylPart(w4TnWood, 0.42, 0.36, 0.72, 6, cfW4X - 6.2, cfW4Y + 0.36, cfW4Z);
  addBoxPart(w4TnWoven, 8.4, 0.16, 0.24, cx - 36, baseY + 1.45, cz + 22);
  for (let t = 0; t < 6; t++) {
    const ta = (t / 6) * Math.PI * 2 + 0.25;
    const tx = cx + Math.cos(ta) * 44;
    const tz = cz + Math.sin(ta) * 36;
    addW3GroundedCol(w4TnWood, 0.07, 0.09, ctx.getHeight(tx, tz) + 2.6, ctx.getHeight(tx, tz), 4, tx, tz);
    addConePart(w4TnFlame, 0.20, 0.38, 4, tx, ctx.getHeight(tx, tz) + 2.8, tz);
  }
  addBoxPart(w4TnWood, 3.2, 0.48, 0.65, cx, baseY + 0.24, cz + 36);
  for (let m = 0; m < 4; m++) {
    const mx = cx + (m < 2 ? -14 + m * 6 : 8 + (m - 2) * 6);
    addW3GroundedCol(w4TnWood, 0.06, 0.08, gateY + 5.2, gateY, 5, mx, gateZ + 6.0);
    addBoxPart(w4TnBroc, 0.68, 1.85, 0.08, mx, gateY + 4.1, gateZ + 6.0);
  }
  for (let s = 0; s < 8; s++) {
    const sa = (s / 8) * Math.PI * 2;
    addBoxPart(w4TnStone, 0.58, 0.38, 0.48, cx + 18 + Math.cos(sa) * 2.6, baseY + 0.19, cz + 38 + Math.sin(sa) * 2.6);
  }
  addBoxPart(w4TnWood, 1.4, 0.95, 0.42, trX - 4.2, trY + 0.48, trZ);
  addBoxPart(w4TnWood, 2.2, 0.58, 1.25, grTnX + 5.2, grTnY + 0.62, grTnZ);
  addBoxPart(w4TnWoven, 0.24, 1.45, 16.0, cx + 56, baseY + 0.72, cz + 4);
  addCylPart(w4TnBronze, 0.55, 0.42, 0.45, 6, cfW4X + 6.2, cfW4Y + 0.45, cfW4Z);
  for (const [tx, tz] of [[-54, -36], [54, -36], [-54, 38], [54, 38]]) addW3GroundedCol(w4TnWood, 0.14, 0.18, ctx.getHeight(cx + tx, cz + tz) + 3.2, ctx.getHeight(cx + tx, cz + tz), 5, cx + tx, cz + tz);
  addBoxPart(w4TnBroc, 3.6, 0.95, 0.10, wcX, wcY + 1.45, wcZ + 5.5);
  addBoxPart(w4TnStone, 0.85, 0.95, 0.65, cx - 42, baseY + 0.48, cz + 22);
  addW3GroundedCol(w4TnWood, 0.12, 0.16, gateY + 2.8, gateY, 5, cx - 8.5, gateZ + 6.5);
  addBoxPart(w4TnStone, 1.55, 2.35, 0.38, cx, gateY + 1.18, gateZ + 12.0);

  addWave3Mesh(group, w4TnWood, ctx.materials.darkWood);
  addWave3Mesh(group, w4TnThatch, nrThatchMat);
  addWave3Mesh(group, w4TnWoven, nrWovenMat);
  addWave3Mesh(group, w4TnStone, ctx.materials.stone);
  addWave3Mesh(group, w4TnUrn, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w4TnBroc, brocMat);
  addWave3Mesh(group, w4TnBronze, ctx.materials.bronze);
  addWave3Mesh(group, w4TnFlame, campFlameMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1431–1459): Ede Brocade Porch, Backstrap Loom, Cây Nêu Trio & Gong Frame ---
  const w5TnWood: THREE.BufferGeometry[] = [];
  const w5TnThatch: THREE.BufferGeometry[] = [];
  const w5TnWoven: THREE.BufferGeometry[] = [];
  const w5TnStone: THREE.BufferGeometry[] = [];
  const w5TnUrn: THREE.BufferGeometry[] = [];
  const w5TnBroc: THREE.BufferGeometry[] = [];
  const w5TnBronze: THREE.BufferGeometry[] = [];
  const w5TnFlame: THREE.BufferGeometry[] = [];
  // 1431–1433: Ede Longhouse-style brocade exhibition porch (cx - 48, cz + 18), backstrap loom bench & dye-boiling hearth
  const edX = cx - 48;
  const edZ = cz + 18;
  const edY = Math.max(ctx.getHeight(edX, edZ), ctx.getHeight(edX - 2, edZ));
  for (const [ox, oz] of [[-2.2, -1.5], [2.2, -1.5], [-2.2, 1.5], [2.2, 1.5]]) addW3GroundedCol(w5TnWood, 0.11, 0.13, edY + 3.4, edY - 0.3, 5, edX + ox, edZ + oz);
  addBoxPart(w5TnWood, 5.2, 0.22, 3.6, edX, edY + 1.15, edZ);
  addW3HipRoof(w5TnThatch, null, 6.2, 4.6, edY + 3.4, 1.45, edX, edZ);
  addBoxPart(w5TnWood, 2.0, 0.65, 0.95, edX, edY + 1.58, edZ);
  addBoxPart(w5TnBroc, 1.65, 0.14, 0.72, edX, edY + 1.98, edZ);
  addCylPart(w5TnStone, 0.95, 1.05, 0.35, 6, wcX + 10.2, wcY + 0.18, wcZ);
  addCylPart(w5TnBronze, 0.45, 0.36, 0.48, 6, wcX + 10.2, wcY + 0.58, wcZ);
  // 1434–1442: 3 Cây Nêu festival poles, woodcarver yard, bamboo water-tube rack, 5-gong frame, coffee pulping trough, Ede twin-staircase, rattan bench, Bến Nước spring basin & rượu cần straw stand
  for (let cn = -1; cn <= 1; cn++) {
    const cnx = cx + cn * 14;
    const cny = ctx.getHeight(cnx, gateZ + 10.5);
    addW3GroundedCol(w5TnWood, 0.08, 0.11, cny + 6.4, cny, 5, cnx, gateZ + 10.5);
    addBoxPart(w5TnBroc, 0.75, 1.95, 0.08, cnx, cny + 5.1, gateZ + 10.5);
  }
  addBoxPart(w5TnWood, 2.8, 0.78, 1.15, nmTnX + 4.8, nmTnY + 0.39, nmTnZ);
  addBoxPart(w5TnWoven, 2.0, 1.25, 0.48, cx - 36, baseY + 0.62, cz + 26);
  for (const s of [-1, 1]) addW3GroundedCol(w5TnWood, 0.09, 0.11, trY + 2.45, trY, 5, trX + 9.5 + s * 1.8, trZ);
  addBoxPart(w5TnWood, 4.0, 0.16, 0.16, trX + 9.5, trY + 2.38, trZ);
  for (let g = -2; g <= 2; g++) addCylPart(w5TnBronze, 0.24, 0.24, 0.08, 6, trX + 9.5 + g * 0.68, trY + 1.65, trZ, Math.PI * 0.5, 0);
  addBoxPart(w5TnWood, 3.2, 0.65, 1.05, cfW4X, cfW4Y + 0.32, cfW4Z - 5.2);
  addBoxPart(w5TnWood, 1.15, 2.2, 0.24, edX, edY + 0.95, edZ + 2.6, 0, -0.45, 0);
  addBoxPart(w5TnWood, 2.0, 0.72, 0.85, cx + 28, baseY + 0.36, cz + 38);
  addBoxPart(w5TnStone, 2.2, 0.85, 1.25, cx - 44, baseY + 0.42, cz + 28);
  addBoxPart(w5TnWoven, 1.45, 1.15, 0.42, rcX - 4.2, rcY + 0.58, rcZ);
  // 1443–1451: Wind-organ frame, eastern watch-shelter (cx + 58, cz - 14), cinnamon drying table, buffalo-tethering totem, 6 southern fire-braziers, spear/crossbow rack, brocade stamp bench, cattle trough & cotton-gin stand
  addBoxPart(w5TnWoven, 1.65, 2.6, 0.28, cx + 10, ctx.getHeight(cx + 10, cz - 46) + 1.3, cz - 46);
  const wsTnX = cx + 58;
  const wsTnZ = cz - 14;
  const wsTnY = Math.max(ctx.getHeight(wsTnX, wsTnZ), ctx.getHeight(wsTnX + 2, wsTnZ));
  for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) addW3GroundedCol(w5TnWood, 0.10, 0.12, wsTnY + 3.2, wsTnY, 5, wsTnX + ox, wsTnZ + oz);
  addW3HipRoof(w5TnThatch, null, 3.8, 3.8, wsTnY + 3.2, 1.15, wsTnX, wsTnZ);
  addBoxPart(w5TnWoven, 2.6, 0.85, 1.15, cfW4X + 7.2, cfW4Y + 0.42, cfW4Z + 4.5);
  addW3GroundedCol(w5TnWood, 0.16, 0.22, baseY + 4.6, baseY, 5, cx + 14, cz + 44);
  for (let fb = 0; fb < 6; fb++) {
    const fx = cx - 20 + fb * 8;
    addCylPart(w5TnStone, 0.38, 0.32, 0.72, 6, fx, gateY + 0.36, gateZ + 14.5);
    addConePart(w5TnFlame, 0.22, 0.38, 4, fx, gateY + 0.92, gateZ + 14.5);
  }
  addBoxPart(w5TnWood, 2.0, 1.35, 0.45, cx - 10, ctx.getHeight(cx - 10, cz - 46) + 0.68, cz - 46);
  addBoxPart(w5TnWood, 1.85, 0.72, 0.82, edX + 5.2, edY + 0.36, edZ);
  addBoxPart(w5TnWood, 2.4, 0.62, 0.85, grTnX + 5.2, grTnY + 0.31, grTnZ + 3.8);
  addBoxPart(w5TnWood, 1.45, 1.05, 0.72, edX - 5.2, edY + 0.52, edZ);
  // 1452–1459: H'gơr festival drum cradle, basalt retaining curb, smoking-torch rack, 4 story-benches, brocade entry arch, basalt mile-cairn, gong medallion plinth & welcome totem stele
  addCylPart(w5TnWood, 0.52, 0.52, 1.45, 6, trX - 5.2, trY + 0.92, trZ + 4.2, 0, Math.PI * 0.5);
  addBoxPart(w5TnStone, 0.85, 0.65, 14.0, cx + 62, baseY + 0.32, cz + 8);
  addBoxPart(w5TnWood, 1.45, 1.15, 0.42, cx + 22, baseY + 0.58, cz + 42);
  for (let sb = 0; sb < 4; sb++) addBoxPart(w5TnWood, 2.8, 0.48, 0.62, cx + (sb < 2 ? -10 : 10), baseY + 0.24, cz + 30 + (sb % 2) * 5.0);
  for (const s of [-1, 1]) addW3GroundedCol(w5TnWood, 0.14, 0.18, baseY + 3.8, baseY, 5, cx + 58, cz + 22 + s * 2.4);
  addBoxPart(w5TnBroc, 0.24, 0.95, 5.4, cx + 58, baseY + 3.45, cz + 22);
  addConePart(w5TnStone, 0.85, 1.35, 5, cx - 18, gateY + 0.68, gateZ + 14.0);
  addBoxPart(w5TnStone, 1.35, 0.95, 1.35, cx + 18, gateY + 0.48, gateZ + 14.0);
  addCylPart(w5TnBronze, 0.55, 0.55, 0.12, 6, cx + 18, gateY + 1.05, gateZ + 14.0);
  addBoxPart(w5TnStone, 1.75, 2.75, 0.42, cx, gateY + 1.38, gateZ + 18.0);

  addWave3Mesh(group, w5TnWood, ctx.materials.darkWood);
  addWave3Mesh(group, w5TnThatch, nrThatchMat);
  addWave3Mesh(group, w5TnWoven, nrWovenMat);
  addWave3Mesh(group, w5TnStone, ctx.materials.stone);
  addWave3Mesh(group, w5TnUrn, ctx.materials.terracottaRoof);
  addWave3Mesh(group, w5TnBroc, brocMat);
  addWave3Mesh(group, w5TnBronze, ctx.materials.bronze);
  addWave3Mesh(group, w5TnFlame, campFlameMat);

  group.add(
    new THREE.Mesh(mergeNormalized(tnExpWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(tnExpThatch), nrThatchMat),
    new THREE.Mesh(mergeNormalized(tnExpWoven), nrWovenMat),
    new THREE.Mesh(mergeNormalized(tnExpStone), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(tnExpUrn), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(tnExpBroc), brocMat),
    pilInst,
    baseInst,
    giantNon,
    truss,
    new THREE.Mesh(mergeNormalized(supportTimberParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(supportGoldParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(supportStoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(nrThatchParts), nrThatchMat),
    new THREE.Mesh(mergeNormalized(nrWovenParts), nrWovenMat),
    new THREE.Mesh(mergeNormalized(gongBronzeParts), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(fireFlameParts), campFlameMat),
    campLight,
    new THREE.Mesh(mergeNormalized(rosetteParts), rosetteMat),
    archBackdrop,
    cotNeu,
    tvInst
  );
  tagMotifIds(group, [
    'HV-G01', 'HV-G02', 'HV-G03', 'HV-G05', 'HV-G07', 'HV-NEW-MT-12', 'HV-NEW-MT-13'
  ]);
  ctx.scene.add(group);
  return group;
}

function buildDatNuocHeroicCanyonMacro(
  ctx: VietnamBuilderContext,
  dongSonTex: { map: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture }
): THREE.Group {
  // --- M10: DatNuocHeroicCanyonMacro (-560, -640) ---
  const cx = -560;
  const cz = -640;
  ctx.exclusionCircles.push({ x: cx, z: cz + 25, r: 128 });
  const cGroup = new THREE.Group();
  cGroup.name = 'DatNuocHeroicCanyonMacro';
  const floorY = ctx.getHeight(cx, cz + 40);

  // FIX HV06-2: Angular Ridged Multifractal Fractured Rock Canyon Wall with dark plum crevices (#1c141a) & rose-copper beveled facets (#d98d74) (ref 10!)
  const cliffGeo = new THREE.PlaneGeometry(132, 29, 76, 26);
  const cp = cliffGeo.attributes.position;
  const cliffCols = new Float32Array(cp.count * 3);
  const cCrevice = new THREE.Color('#1c141a');
  const cMidRock = new THREE.Color('#6a4542');
  const cCopperEdge = new THREE.Color('#d98d74');
  const cTmp = new THREE.Color();
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const ux = x / 132 + 0.5;
    const uy = y / 29 + 0.5;
    const curveZ = Math.pow(ux - 0.5, 2.0) * 48.0; // deep 180-degree horseshoe rock embrace
    const ridge1 = 1.0 - Math.abs(noise2D(ux * 16.0, uy * 7.5, 1010) * 2.0 - 1.0);
    const ridge2 = 1.0 - Math.abs(noise2D(ux * 34.0, uy * 15.0, 2020) * 2.0 - 1.0);
    const facetZ = Math.pow(ridge1, 1.6) * 2.8 + Math.pow(ridge2, 1.8) * 1.1;
    const heroWaves = Math.max(0, Math.sin(ux * Math.PI * 11.0)) * (uy > 0.15 && uy < 0.80 ? 1.1 : 0.2);
    cp.setXYZ(i, x, y + 14.5, curveZ + heroWaves + facetZ);
    const edgeFactor = clamp01(ridge1 * 0.65 + ridge2 * 0.35);
    if (edgeFactor < 0.45) {
      cTmp.copy(cCrevice).lerp(cMidRock, edgeFactor / 0.45);
    } else {
      cTmp.copy(cMidRock).lerp(cCopperEdge, (edgeFactor - 0.45) / 0.55);
    }
    cliffCols[i * 3] = cTmp.r;
    cliffCols[i * 3 + 1] = cTmp.g;
    cliffCols[i * 3 + 2] = cTmp.b;
  }
  cliffGeo.setAttribute('color', new THREE.BufferAttribute(cliffCols, 3));
  cliffGeo.computeVertexNormals();
  cliffGeo.translate(cx, floorY - 1.5, cz - 46);
  const reliefMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    normalScale: new THREE.Vector2(3.0, 3.0),
    roughness: 0.68,
    metalness: 0.30
  });
  ctx.extraMaterials.push(reliefMat);

  // Embedded Central Đông Sơn Drum Medallion + Twin 36m Sculpted Lạc Bird & Dragon Wings + Heroic Monument Statue + Granite Plaza
  const emblemParts: THREE.BufferGeometry[] = [];
  const goldAccentParts: THREE.BufferGeometry[] = [];
  const plazaStoneParts: THREE.BufferGeometry[] = [];

  // Stepped Monumental Granite Plaza & Ceremonial Staircase
  addBoxPart(plazaStoneParts, 68.0, 0.85, 28.0, cx, floorY + 0.25, cz - 18.0);
  for (let st = 0; st < 5; st++) {
    addBoxPart(plazaStoneParts, 26.0, 0.28, 1.4, cx, floorY - 0.1 + st * 0.18, cz - 3.5 - st * 1.1);
  }
  const drum = new THREE.CylinderGeometry(3.2, 3.4, 0.7, 32);
  drum.rotateX(Math.PI * 0.5);
  drum.translate(cx, floorY + 10.5, cz - 44.5);
  emblemParts.push(drum);

  // Twin sweeping 36m Curved Sculpted Lạc Bird & Dragon Wings flanking the Đông Sơn Medallion (replacing boxy bars!)
  for (const side of [-1, 1]) {
    // Swept main curved wing spar arch
    const sparCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + side * 3.4, floorY + 10.6, cz - 43.8),
      new THREE.Vector3(cx + side * 12.2, floorY + 13.8, cz - 42.2),
      new THREE.Vector3(cx + side * 21.5, floorY + 17.5, cz - 39.2)
    ]);
    goldAccentParts.push(new THREE.TubeGeometry(sparCurve, 14, 0.42, 7, false));
    for (let f = 0; f < 7; f++) {
      const t = f / 6;
      const anchorX = cx + side * (4.6 + f * 2.45);
      const anchorY = floorY + 10.2 + f * 1.15;
      const anchorZ = cz - 43.2 + Math.pow(t, 1.45) * 4.2;
      const fLen = 11.2 - f * 1.05;
      // Gracefully arching sculpted wing feather curve + gilded tip
      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(anchorX, anchorY, anchorZ),
        new THREE.Vector3(anchorX + side * fLen * 0.48, anchorY + 1.25 - f * 0.08, anchorZ + 0.65),
        new THREE.Vector3(anchorX + side * fLen, anchorY + 0.45 - f * 0.14, anchorZ + 1.55)
      ]);
      const feather = new THREE.TubeGeometry(fCurve, 8, 0.34 - f * 0.025, 6, false);
      feather.scale(1.0, 1.45, 0.55);
      // FIX HV06-4: Place wing feathers in goldAccentParts (bronzePatina), NOT emblemParts (drumMat with concentric drum texture!)
      goldAccentParts.push(feather);
      const goldTip = new THREE.ConeGeometry(0.32, 1.9, 5);
      goldTip.rotateZ(-side * (1.28 - f * 0.06));
      goldTip.translate(anchorX + side * (fLen + 0.6), anchorY + 0.45 - f * 0.14, anchorZ + 1.55);
      goldAccentParts.push(goldTip);
    }
  }

  // FIX HV06-1: Keep central dx=0 axis 100% clear for the Đông Sơn Drum! Flank symmetrically with Âu Cơ (-11m) & Lạc Long Quân (+11m)!
  const reliefFigParts: THREE.BufferGeometry[] = [];
  const heroClusterSpecs: Array<{ dx: number; h: number; type: 'king' | 'general' | 'soldier' }> = [
    { dx: -44, h: 10.2, type: 'soldier' },
    { dx: -30, h: 11.4, type: 'general' },
    { dx: -11, h: 12.2, type: 'king' },
    { dx: 11, h: 12.2, type: 'king' },
    { dx: 24, h: 11.8, type: 'general' },
    { dx: 36, h: 11.0, type: 'soldier' },
    { dx: 46, h: 10.0, type: 'soldier' }
  ];
  for (let c = 0; c < heroClusterSpecs.length; c++) {
    const spec = heroClusterSpecs[c];
    const ux = spec.dx / 114 + 0.5;
    const wallZ = cz - 46 + Math.pow(ux - 0.5, 2.0) * 38.0 + 1.45;
    const fx = cx + spec.dx;
    const figBaseY = floorY + 1.6;
    const s = spec.h / 10.5;
    const faceYaw = -(ux - 0.5) * 1.15;

    // 2 Heroic sculpted figures per cluster (primary leader + flanking comrade) emerging in high 3D relief
    for (const sub of [0, 1]) {
      const subScale = sub === 0 ? s : s * 0.84;
      const sx = fx + (sub === 0 ? 0 : (c % 2 === 0 ? 2.6 : -2.6));
      const sz = wallZ + (sub === 0 ? 0.65 : 0.15);
      // Draped lower robe / heroic stride
      const lowerBody = new THREE.CylinderGeometry(1.15 * subScale, 1.55 * subScale, 4.4 * subScale, 8);
      lowerBody.scale(1.0, 1.0, 0.62);
      lowerBody.rotateY(faceYaw);
      lowerBody.translate(sx, figBaseY + 2.2 * subScale, sz);
      // Broad sculpted heroic chest & billowing cloak mantle
      const torso = new THREE.CylinderGeometry(1.52 * subScale, 1.12 * subScale, 3.1 * subScale, 8);
      torso.scale(1.0, 1.0, 0.58);
      torso.rotateY(faceYaw);
      torso.translate(sx, figBaseY + 5.75 * subScale, sz);
      const cloak = new THREE.ConeGeometry(2.15 * subScale, 5.8 * subScale, 6, 1, true);
      cloak.scale(1.0, 1.0, 0.35);
      cloak.rotateY(faceYaw);
      cloak.translate(sx, figBaseY + 4.4 * subScale, sz - 0.55);
      // Sculpted head
      const head = new THREE.SphereGeometry(0.86 * subScale, 10, 8);
      head.translate(sx, figBaseY + 8.15 * subScale, sz + 0.15);
      reliefFigParts.push(lowerBody, torso, cloak, head);

      // Era-specific headgear & heroic weapons/banners projecting boldly in relief
      if (spec.type === 'king') {
        // Lacquered Đông Sơn bird-feather crown (*mũ lông chim Lạc*)
        for (let ft = -2; ft <= 2; ft++) {
          const plume = new THREE.ConeGeometry(0.18 * subScale, 1.85 * subScale, 5);
          plume.rotateZ(ft * 0.24);
          plume.translate(sx + ft * 0.36 * subScale, figBaseY + 9.45 * subScale, sz + 0.1);
          goldAccentParts.push(plume);
        }
        // Ceremonial bronze halberd / spear held high
        addCylPart(goldAccentParts, 0.09 * subScale, 0.11 * subScale, 9.6 * subScale, 6, sx + 1.55 * subScale, figBaseY + 5.8 * subScale, sz + 0.45, 0, -0.14);
      } else if (spec.type === 'general') {
        // War helmet crest + raised sword / pointing arm + round bronze shield
        const crest = new THREE.ConeGeometry(0.55 * subScale, 1.35 * subScale, 6);
        crest.translate(sx, figBaseY + 9.25 * subScale, sz + 0.15);
        reliefFigParts.push(crest);
        addCylPart(reliefFigParts, 0.28 * subScale, 0.34 * subScale, 2.8 * subScale, 7, sx - 1.35 * subScale, figBaseY + 7.45 * subScale, sz + 0.55, 0.35, 0.65);
        const shield = new THREE.CylinderGeometry(1.15 * subScale, 1.15 * subScale, 0.28 * subScale, 10);
        shield.rotateX(Math.PI * 0.5);
        shield.rotateY(faceYaw);
        shield.translate(sx + 1.35 * subScale, figBaseY + 5.2 * subScale, sz + 0.72);
        goldAccentParts.push(shield);
      } else {
        // Iconic 20th-century soldier pith helmet (*mũ cối*) + raised rifle / victory banner
        const helmet = new THREE.SphereGeometry(0.95 * subScale, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
        helmet.scale(1.12, 0.82, 1.16);
        helmet.translate(sx, figBaseY + 8.38 * subScale, sz + 0.18);
        reliefFigParts.push(helmet);
        addCylPart(goldAccentParts, 0.08 * subScale, 0.10 * subScale, 4.6 * subScale, 6, sx + 1.25 * subScale, figBaseY + 8.6 * subScale, sz + 0.48, 0.15, -0.32);
      }
    }
  }

  // FIX HV06-3: Elevate monumental "ĐẤT NƯỚC" lettering onto the central cliff crown (y = floorY + 19.2m) directly beneath the suspended Nón Lá crown, clearing the central plaza!
  const datNuocPlaque = createSignagePlaqueMesh(
    { text: 'ĐẤT NƯỚC', subText: 'THIÊN HÙNG CA NGÀN NĂM VĂN HIẾN', width: 17.5, height: 3.4, depth: 0.34, style: 'royal' },
    ctx
  );
  datNuocPlaque.position.set(cx, floorY + 19.2, cz - 42.5);
  cGroup.add(datNuocPlaque);

  // FIX HV06-5: Sculpted Two-Legged Heroic Leader Monument Statue pulled cleanly forward of horseshoe cliff face (cz - 31.0)!
  const statX = cx + 44;
  const statZ = cz - 31;
  addBoxPart(plazaStoneParts, 6.2, 1.2, 6.2, statX, floorY + 0.6, statZ);
  addBoxPart(plazaStoneParts, 4.8, 2.4, 4.8, statX, floorY + 2.4, statZ);
  const statBaseY = floorY + 3.6;
  // Two standing striding legs + tailored military coat torso + broad shoulders + sculpted head + high raised waving right arm
  addCylPart(reliefFigParts, 0.36, 0.42, 3.2, 8, statX - 0.48, statBaseY + 1.6, statZ + 0.14, 0.08, 0);
  addCylPart(reliefFigParts, 0.36, 0.42, 3.2, 8, statX + 0.48, statBaseY + 1.6, statZ - 0.14, -0.06, 0);
  // Coat flaps draping cleanly around hips without merging into a single solid skirt cylinder
  addBoxPart(reliefFigParts, 1.65, 1.65, 0.92, statX, statBaseY + 3.35, statZ - 0.10);
  const sChest = new THREE.CylinderGeometry(1.06, 0.84, 2.45, 10);
  sChest.scale(1.14, 1.0, 0.68);
  sChest.translate(statX, statBaseY + 5.15, statZ);
  const sShoulders = new THREE.SphereGeometry(1.14, 10, 7);
  sShoulders.scale(1.18, 0.50, 0.66);
  sShoulders.translate(statX, statBaseY + 6.18, statZ);
  const sHead = new THREE.SphereGeometry(0.62, 10, 8);
  sHead.translate(statX, statBaseY + 7.12, statZ);
  reliefFigParts.push(sChest, sShoulders, sHead);
  // High raised right waving arm & lowered left guiding arm
  addCylPart(reliefFigParts, 0.22, 0.29, 3.25, 7, statX - 1.38, statBaseY + 7.15, statZ + 0.35, 0.28, 0.56);
  addCylPart(reliefFigParts, 0.20, 0.27, 2.45, 7, statX + 1.18, statBaseY + 4.95, statZ + 0.12, 0.08, -0.22);

  const drumMat = new THREE.MeshStandardMaterial({
    map: dongSonTex.map,
    normalMap: dongSonTex.normalMap,
    emissive: new THREE.Color('#ff8a3a'),
    emissiveIntensity: 0.4,
    roughness: 0.4,
    metalness: 0.75
  });
  ctx.extraMaterials.push(drumMat);

  // Suspended 9.6m Bronze Nón Lá Lattice Crown with 4 Tension Suspension Cables anchored into Canyon Cliff Crest + 6 Incense Braziers
  const nonCrown = new THREE.Mesh(createNonLaLatticeGeometry(4.8, 2.4, 16, 6), ctx.materials.gold);
  nonCrown.position.set(cx, floorY + 23.0, cz - 40);
  for (const [ax, az, tx, tz] of [
    [-4.2, -39.5, -18.0, -43.5],
    [4.2, -39.5, 18.0, -43.5],
    [-2.8, -42.5, -10.5, -45.5],
    [2.8, -42.5, 10.5, -45.5]
  ]) {
    goldAccentParts.push(
      new THREE.TubeGeometry(
        new THREE.LineCurve3(
          new THREE.Vector3(cx + ax, floorY + 23.4, cz + az),
          new THREE.Vector3(cx + tx, floorY + 24.4, cz + tz)
        ),
        2,
        0.075,
        5,
        false
      )
    );
  }
  const brazierParts: THREE.BufferGeometry[] = [];
  const emberParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 6; b++) {
    const bx = cx - 38 + b * 15.2;
    const bz = cz + 12;
    addCylPart(brazierParts, 0.75, 0.55, 1.1, 10, bx, floorY + 0.55, bz);
    const e = new THREE.SphereGeometry(0.45, 8, 6);
    e.translate(bx, floorY + 1.15, bz);
    emberParts.push(e);
  }
  const emberMat = new THREE.MeshStandardMaterial({
    color: '#ffb347',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 1.4
  });
  ctx.extraMaterials.push(emberMat);
  // --- 200-Item Macro Visual QC & Expansion (131–144): Đại Tượng Đài Đất Nước ---
  const dnExpStone: THREE.BufferGeometry[] = [];
  const dnExpBronze: THREE.BufferGeometry[] = [];
  const dnExpEmber: THREE.BufferGeometry[] = [];
  const dnExpLeaf: THREE.BufferGeometry[] = [];

  // 131 & 137 & 144: 8 Heroic Trụ Chiến Công victory pillars with bronze relief plaques + entrance gateposts
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const rank = i % 4;
    const px = cx + side * 24.0;
    const pz = cz - 2.0 + rank * 11.5;
    const py = ctx.getHeight(px, pz);
    addBoxPart(dnExpStone, 1.85, 0.85, 1.85, px, py + 0.42, pz);
    addBoxPart(dnExpStone, 1.25, 6.2, 1.25, px, py + 3.9, pz);
    addBoxPart(dnExpBronze, 1.32, 2.2, 0.16, px, py + 3.8, pz + 0.62);
    dnExpEmber.push(new THREE.ConeGeometry(0.32, 0.85, 6).translate(px, py + 7.45, pz));
  }
  for (const side of [-1, 1]) {
    addBoxPart(dnExpStone, 2.6, 5.2, 2.6, cx + side * 14.0, floorY + 2.6, cz + 38.0);
    addBoxPart(dnExpBronze, 2.8, 0.45, 2.8, cx + side * 14.0, floorY + 5.35, cz + 38.0);
  }
  // 132 & 138 & 141: Central Đài Lửa Thiêng eternal flame altar, wreath pedestals & dragon/cloud curbs
  addBoxPart(dnExpStone, 4.4, 0.85, 4.4, cx, floorY + 0.42, cz + 4.5);
  addCylPart(dnExpBronze, 1.15, 0.85, 1.35, 10, cx, floorY + 1.52, cz + 4.5);
  dnExpEmber.push(new THREE.ConeGeometry(0.75, 2.2, 7).translate(cx, floorY + 3.1, cz + 4.5));
  for (const wx of [-8.5, -4.5, 4.5, 8.5]) {
    addBoxPart(dnExpStone, 1.2, 0.65, 1.2, cx + wx, floorY + 0.32, cz + 1.5);
  }
  // 133 & 135 & 139: Stepped stone Khán Đài amphitheater tiers & balustrades flanking granite plaza
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      addBoxPart(dnExpStone, 4.2, 0.65 + tier * 0.65, 26.0, cx + side * (36.5 + tier * 3.6), floorY + (0.65 + tier * 0.65) * 0.5, cz - 18.0);
    }
    dnExpStone.push(...createPiercedBalustradeParts(cx + side * 33.5, cz - 31.0, cx + side * 33.5, cz - 5.0, floorY + 0.68, 0.88, 'lotus_stone'));
  }
  // 134: 2 Bronze Cờ Tổ Quốc / Chim Lạc standards flanking Heroic Leader statue
  for (const sx of [statX - 3.6, statX + 3.6]) {
    addCylPart(dnExpBronze, 0.08, 0.11, 8.5, 6, sx, floorY + 4.25, statZ - 1.5);
    addBoxPart(dnExpBronze, 1.8, 1.1, 0.08, sx + 0.9, floorY + 7.8, statZ - 1.5);
  }
  // 136 & 142: 16 Highland pine & cycad clusters + fractured basalt boulders at cliff base
  for (let p = 0; p < 16; p++) {
    const side = p < 8 ? -1 : 1;
    const px = cx + side * (46 + (p % 3) * 8);
    const pz = cz - 36 + (p % 8) * 9.5;
    const py = ctx.getHeight(px, pz);
    addCylPart(dnExpStone, 0.16, 0.24, 3.2, 6, px, py + 1.6, pz);
    dnExpLeaf.push(new THREE.ConeGeometry(1.85, 3.8, 7).translate(px, py + 4.4, pz));
  }

  // --- Wave 2 Macro Visual QC & Expansion (331–344): Đất Nước Hero Relief Walls & Flame Colonnade ---
  // 331, 338, 344: 2 Sweeping Hero Relief Walls (Tường Phù Điêu Anh Hùng), 8 uplights & angular granite cliff anchors
  for (const side of [-1, 1]) {
    const wx = cx + side * 26.0;
    const wz = cz - 28.0;
    addBoxPart(dnExpStone, 16.0, 5.2, 1.6, wx, floorY + 2.6, wz, side * 0.28);
    addBoxPart(dnExpBronze, 13.5, 3.4, 0.22, wx, floorY + 2.75, wz + 0.85, side * 0.28);
    addBoxPart(dnExpStone, 4.6, 2.8, 3.6, wx + side * 9.2, floorY + 1.4, wz - 1.5, side * 0.4);
    for (let u = 0; u < 4; u++) {
      const ux = wx - 5.2 + u * 3.4;
      addBoxPart(dnExpBronze, 0.45, 0.35, 0.45, ux, floorY + 0.18, wz + 2.8);
      addConePart(dnExpEmber, 0.18, 0.28, 5, ux, floorY + 0.48, wz + 2.8);
    }
  }
  // 332: 8 Monumental Flame Colonnade piers (Hàng Cột Lửa Thiêng) lining grand approach
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const rank = i % 4;
    const px = cx + side * 15.5;
    const pz = cz + 6.0 + rank * 8.2;
    addBoxPart(dnExpStone, 1.45, 4.6, 1.45, px, floorY + 2.3, pz);
    addCylPart(dnExpBronze, 0.62, 0.45, 0.72, 6, px, floorY + 4.95, pz);
    addConePart(dnExpEmber, 0.44, 1.15, 5, px, floorY + 5.85, pz);
  }
  // 333 & 334: Đài Chuông Hòa Bình (east peace bell pavilion) & Đài Trống Đồng Tổ Quốc (west drum plinth)
  const bellX = cx + 30.0;
  const bellZ = cz + 14.0;
  addBoxPart(dnExpStone, 5.2, 0.65, 5.2, bellX, floorY + 0.32, bellZ);
  for (const [ox, oz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
    addBoxPart(dnExpStone, 0.38, 4.2, 0.38, bellX + ox, floorY + 2.75, bellZ + oz);
  }
  addConePart(dnExpBronze, 3.8, 1.5, 4, bellX, floorY + 5.55, bellZ, Math.PI * 0.25);
  addCylPart(dnExpBronze, 0.65, 0.92, 1.65, 6, bellX, floorY + 2.85, bellZ);
  const drX = cx - 30.0;
  addBoxPart(dnExpStone, 5.2, 0.85, 5.2, drX, floorY + 0.42, bellZ);
  addCylPart(dnExpBronze, 1.45, 1.25, 1.35, 6, drX, floorY + 1.55, bellZ, 0.25, 0);
  // 335–337 & 339–343: Central flagpole, 2 inscription monoliths, ceremony aprons, 2 incense vessels, 4 flowerbeds, 6 bollards, overlook & twin-beam portal
  addCylPart(dnExpBronze, 0.14, 0.22, 16.0, 6, cx, floorY + 8.0, cz - 34.0);
  addBoxPart(dnExpEmber, 3.6, 2.2, 0.10, cx + 1.85, floorY + 14.6, cz - 34.0);
  for (const side of [-1, 1]) {
    addBoxPart(dnExpStone, 2.4, 3.6, 0.55, cx + side * 6.8, floorY + 1.8, cz + 4.5, side * 0.25);
    addBoxPart(dnExpBronze, 1.9, 2.6, 0.62, cx + side * 6.8, floorY + 1.85, cz + 4.5, side * 0.25);
    addCylPart(dnExpBronze, 0.58, 0.42, 0.95, 6, cx + side * 22.0, floorY + 0.48, cz - 18.0);
    for (const fz of [cz + 14.0, cz + 26.0]) {
      addBoxPart(dnExpStone, 2.2, 0.48, 8.2, cx + side * 10.2, floorY + 0.24, fz);
      addBoxPart(dnExpBronze, 2.32, 0.10, 8.32, cx + side * 10.2, floorY + 0.52, fz);
    }
  }
  addBoxPart(dnExpStone, 22.0, 0.26, 6.2, cx, floorY + 0.13, cz - 4.5);
  for (let b = 0; b < 6; b++) {
    addCylPart(dnExpStone, 0.22, 0.26, 0.95, 5, cx - 10.0 + b * 4.0, floorY + 0.48, cz + 42.0);
  }
  addBoxPart(dnExpStone, 14.0, 0.42, 4.8, cx, floorY + 0.21, cz + 46.5);
  addBoxPart(dnExpStone, 28.0, 0.95, 1.8, cx, floorY + 5.75, cz + 38.0);

  // --- Wave 3 Macro Visual QC & Expansion (659–686): Victory Colonnade, Bronze Relief Alcoves & Pine Terraces ---
  const w3DnStone: THREE.BufferGeometry[] = [];
  const w3DnBronze: THREE.BufferGeometry[] = [];
  const w3DnEmber: THREE.BufferGeometry[] = [];
  const w3DnLeaf: THREE.BufferGeometry[] = [];
  const dnBronzeMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  const dnLeafMat = ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone;
  // 659–663: Eastern & western Victory Colonnade wings, recessed bronze relief alcoves & floor uplight grates (shifted cleanly outside Trụ Chiến Công pillars at ±24 and Khán Đài at ±36.5!)
  for (const side of [-1, 1]) {
    const colX = cx + side * 21.2;
    for (let p = 0; p < 4; p++) {
      const pz = cz - 2.0 + p * 8.2;
      addW3GroundedPost(w3DnStone, 1.35, 1.35, floorY + 6.4, floorY, colX, pz);
      addBoxPart(w3DnBronze, 1.52, 0.22, 1.52, colX, floorY + 6.1, pz);
    }
    addBoxPart(w3DnStone, 1.65, 0.95, 27.0, colX, floorY + 6.85, cz + 10.3);
    addBoxPart(w3DnBronze, 1.78, 0.18, 27.2, colX, floorY + 7.38, cz + 10.3);
    // 661 & 662: Recessed bronze relief alcoves
    const alX = cx + side * 30.5;
    const alZ = cz - 14.0;
    addW3Plinth(w3DnStone, 2.2, 9.6, floorY + 4.8, floorY, alX, alZ);
    addBoxPart(w3DnBronze, 0.28, 3.2, 7.6, alX - side * 1.15, floorY + 2.6, alZ);
    addBoxPart(w3DnStone, 2.8, 0.55, 10.2, alX - side * 0.3, floorY + 5.05, alZ);
    // 663: 6 Floor uplight grates
    for (let u = -1; u <= 1; u++) {
      addBoxPart(w3DnBronze, 0.55, 0.16, 0.55, alX - side * 2.2, floorY + 0.08, alZ + u * 2.8);
      addConePart(w3DnEmber, 0.18, 0.24, 4, alX - side * 2.2, floorY + 0.24, alZ + u * 2.8);
    }
  }
  // 664–666: Ceremonial stair balustrades (upper & lower flights) + mid-landing dragon-cloud relief curbs
  for (const side of [-1, 1]) {
    addBoxPart(w3DnStone, 0.95, 1.45, 10.5, cx + side * 11.2, floorY + 0.72, cz - 10.5);
    addBoxPart(w3DnBronze, 1.05, 0.16, 10.6, cx + side * 11.2, floorY + 1.5, cz - 10.5);
    addBoxPart(w3DnStone, 0.95, 1.15, 8.2, cx + side * 11.2, floorY + 0.58, cz + 2.0);
    addConePart(w3DnBronze, 0.36, 0.58, 5, cx + side * 11.2, floorY + 1.45, cz + 6.0);
    addBoxPart(w3DnStone, 5.4, 0.52, 0.48, cx + side * 6.8, floorY + 0.26, cz - 4.5);
  }
  // 667–669: Eastern & western 2-tier granite pine terraces + 6 monolithic granite benches (shifted to cz+22 clear of Khán Đài!)
  for (const side of [-1, 1]) {
    for (let t = 0; t < 2; t++) {
      const tx = cx + side * (36.5 + t * 4.5);
      const tz = cz + 22.0;
      const ty = floorY + t * 1.1;
      addW3Plinth(w3DnStone, 4.2, 18.0, ty + 0.85, floorY, tx, tz);
      for (let p = -1; p <= 1; p++) {
        addW3GroundedCol(w3DnStone, 0.18, 0.22, ty + 2.4, ty + 0.85, 5, tx, tz + p * 5.5);
        addConePart(w3DnLeaf, 1.45, 2.8, 5, tx, ty + 3.4, tz + p * 5.5);
      }
    }
    for (let b = -1; b <= 1; b++) {
      addBoxPart(w3DnStone, 0.72, 0.52, 2.4, cx + side * 32.8, floorY + 0.26, cz + 22.0 + b * 5.2);
    }
  }
  // 670–686: Honor-guard podiums, 4 bronze scroll plaques, bell & drum approach stairs, portal pylons & star medallions, Eternal Flame compass ring, overlook pierced parapet, flag-court plinth, seating cheek-walls, 6 banner masts, wreath tables, 8 lantern bollards, chronology pillars, drainage curbs, 4 planters & orientation stele
  for (const side of [-1, 1]) {
    addBoxPart(w3DnStone, 2.4, 0.65, 2.4, cx + side * 4.8, floorY + 0.32, cz + 8.5);
    addBoxPart(w3DnBronze, 2.52, 0.10, 2.52, cx + side * 4.8, floorY + 0.68, cz + 8.5);
    // 671: Scroll plaques
    for (const pz of [cz + 4.0, cz + 16.0]) {
      addBoxPart(w3DnStone, 1.1, 1.15, 0.55, cx + side * 21.5, floorY + 0.58, pz);
      addBoxPart(w3DnBronze, 0.95, 0.08, 0.62, cx + side * 21.5, floorY + 1.2, pz, 0, 0.35, 0);
    }
    // 672 & 673: Bell & drum pavilion steps
    addBoxPart(w3DnStone, 3.6, 0.36, 2.2, cx + side * 30.0, floorY + 0.18, cz + 17.5);
    // 674 & 675: Grounded portal pylons anchoring Cổng Khải Hoàn lintel + bronze star medallions
    addW3GroundedPost(w3DnStone, 2.4, 2.2, floorY + 5.35, floorY, cx + side * 12.2, cz + 38.0);
    addBoxPart(w3DnBronze, 2.55, 0.28, 2.35, cx + side * 12.2, floorY + 4.95, cz + 38.0);
    addCylPart(w3DnBronze, 0.72, 0.72, 0.16, 5, cx + side * 12.2, floorY + 3.2, cz + 39.15, Math.PI * 0.5, 0);
    // 679, 681, 683, 684: Seating cheek-walls, wreath tables, chronology pillars & drainage curbs
    addBoxPart(w3DnStone, 1.1, 2.2, 4.8, cx + side * 18.5, floorY + 1.1, cz + 28.0);
    addBoxPart(w3DnStone, 2.8, 0.82, 1.2, cx + side * 24.0, floorY + 0.41, cz - 23.0);
    addW3GroundedCol(w3DnBronze, 0.26, 0.32, floorY + 3.6, floorY, 6, cx + side * 17.5, cz - 24.0);
    addBoxPart(w3DnStone, 0.42, 0.14, 38.0, cx + side * 13.8, floorY + 0.07, cz + 18.0);
    for (const pz of [cz + 34.0, cz + 42.0]) {
      addBoxPart(w3DnStone, 2.4, 0.75, 2.4, cx + side * 16.5, floorY + 0.38, pz);
      addConePart(w3DnLeaf, 0.95, 1.45, 5, cx + side * 16.5, floorY + 1.35, pz);
    }
  }
  addCylPart(w3DnStone, 5.6, 5.8, 0.16, 6, cx, floorY + 0.08, cz + 8.5);
  addCylPart(w3DnBronze, 4.8, 4.8, 0.18, 6, cx, floorY + 0.10, cz + 8.5);
  addBoxPart(w3DnStone, 14.0, 0.95, 0.32, cx, floorY + 0.88, cz + 48.7);
  addCylPart(w3DnStone, 2.8, 3.2, 0.85, 6, cx, floorY + 0.42, cz - 34.0);
  for (let m = 0; m < 6; m++) {
    const mx = cx + (m < 3 ? -19.5 : 19.5);
    const mz = cz + 12.0 + (m % 3) * 9.5;
    addW3GroundedCol(w3DnBronze, 0.07, 0.09, floorY + 6.2, floorY, 5, mx, mz);
  }
  for (let l = 0; l < 8; l++) {
    const lx = cx + (l < 4 ? -8.5 : 8.5);
    const lz = cz + 26.0 + (l % 4) * 5.2;
    addBoxPart(w3DnStone, 0.42, 0.95, 0.42, lx, floorY + 0.48, lz);
    addConePart(w3DnEmber, 0.16, 0.26, 4, lx, floorY + 1.08, lz);
  }
  addBoxPart(w3DnStone, 2.2, 2.4, 0.45, cx, floorY + 1.2, cz + 44.5);
  addBoxPart(w3DnBronze, 1.8, 1.6, 0.52, cx, floorY + 1.3, cz + 44.5);

  addWave3Mesh(cGroup, w3DnStone, ctx.materials.stone);
  addWave3Mesh(cGroup, w3DnBronze, dnBronzeMat);
  addWave3Mesh(cGroup, w3DnEmber, emberMat);
  addWave3Mesh(cGroup, w3DnLeaf, dnLeafMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1060–1087): Victory Archways, 4 Regional Plinths, Amphitheater Tiers & Flag Podium ---
  const w4DnStone: THREE.BufferGeometry[] = [];
  const w4DnBronze: THREE.BufferGeometry[] = [];
  const w4DnEmber: THREE.BufferGeometry[] = [];
  const w4DnLeaf: THREE.BufferGeometry[] = [];
  // 1060 & 1061: Northern & Southern Granite Victory Archways
  for (const az of [cz - 52, cz + 52]) {
    for (const s of [-1, 1]) addW3GroundedPost(w4DnStone, 1.45, 1.45, floorY + 5.8, floorY, cx + s * 5.2, az);
    addBoxPart(w4DnStone, 12.6, 1.15, 1.65, cx, floorY + 5.8, az);
    addBoxPart(w4DnBronze, 8.4, 0.42, 1.75, cx, floorY + 5.8, az);
  }
  // 1062–1065: 4 Regional Heritage Bronze Relief Plinths (Bắc, Trung, Nam, Biển Đảo)
  for (const [rx, rz] of [[-26, 36], [26, 36], [-26, 46], [26, 46]]) {
    addBoxPart(w4DnStone, 2.4, 1.45, 1.25, cx + rx, floorY + 0.72, cz + rz);
    addBoxPart(w4DnBronze, 1.65, 1.05, 0.22, cx + rx, floorY + 1.15, cz + rz + 0.62);
  }
  // 1066–1072: 4 wreath stands, Vietnam map lectern, 4 veteran bench alcoves, 2 mirror basins, 3 amphitheater tiers, flag-salute podium & 2 eternal-flame braziers
  for (const [wx, wz] of [[-12, 26], [12, 26], [-12, 34], [12, 34]]) addBoxPart(w4DnBronze, 0.72, 1.15, 0.45, cx + wx, floorY + 0.58, cz + wz, 0, -0.25, 0);
  addBoxPart(w4DnStone, 1.45, 0.95, 1.15, cx, floorY + 0.48, cz + 48);
  addBoxPart(w4DnBronze, 1.15, 0.12, 0.88, cx, floorY + 1.02, cz + 48, 0, 0.32, 0);
  for (let b = 0; b < 4; b++) addBoxPart(w4DnStone, 2.6, 0.52, 0.72, cx + (b < 2 ? -20 : 20), floorY + 0.26, cz + 26 + (b % 2) * 14);
  for (const s of [-1, 1]) addBoxPart(w4DnStone, 5.2, 0.38, 2.4, cx + s * 11.5, floorY + 0.19, cz + 46);
  for (let t = 0; t < 3; t++) addBoxPart(w4DnStone, 14.0 - t * 1.6, 0.52, 1.25, cx - 38 - t * 1.4, floorY + 0.26 + t * 0.52, cz + 12, Math.PI * 0.5);
  addBoxPart(w4DnStone, 4.8, 0.65, 3.2, cx, floorY + 0.32, cz + 38);
  addBoxPart(w4DnBronze, 0.95, 1.15, 0.65, cx, floorY + 1.22, cz + 38);
  for (const s of [-1, 1]) {
    addBoxPart(w4DnStone, 1.35, 3.2, 1.35, cx + s * 10.5, floorY + 1.6, cz + 52);
    addCylPart(w4DnBronze, 0.68, 0.45, 0.65, 6, cx + s * 10.5, floorY + 3.52, cz + 52);
    addConePart(w4DnEmber, 0.48, 1.15, 5, cx + s * 10.5, floorY + 4.35, cz + 52);
  }
  // 1073–1087: 4 poetry steles, 8 bollards, bugle/drum pedestal, retaining curbs, echo parapet, 6 flagstaffs, incense altar, visitor canopy, 4 star medallions, drainage channels, 2 lion shields, binocular sight, 6 uplight pillars, steps & epic monolith
  for (let p = 0; p < 4; p++) addBoxPart(w4DnStone, 1.25, 2.25, 0.35, cx + (p < 2 ? -18 : 18), floorY + 1.12, cz + 34 + (p % 2) * 10);
  for (let b = 0; b < 8; b++) addW3GroundedPost(w4DnStone, 0.34, 0.34, floorY + 1.05, floorY, cx - 28 + b * 8, cz + 56);
  addBoxPart(w4DnStone, 1.4, 0.95, 1.4, cx + 38, floorY + 0.48, cz + 14);
  addCylPart(w4DnBronze, 0.45, 0.45, 0.55, 6, cx + 38, floorY + 1.25, cz + 14);
  for (const s of [-1, 1]) addBoxPart(w4DnStone, 1.2, 1.15, 16.0, cx + s * 42, floorY + 0.58, cz + 26);
  addBoxPart(w4DnStone, 1.1, 1.25, 14.0, cx + 44, floorY + 0.62, cz - 8);
  for (let f = 0; f < 6; f++) addW3GroundedCol(w4DnBronze, 0.06, 0.08, floorY + 6.4, floorY, 5, cx + (f < 3 ? -14 - f * 4.5 : 14 + (f - 3) * 4.5), cz + 54);
  addBoxPart(w4DnStone, 2.8, 0.95, 1.25, cx, floorY + 0.48, cz + 32);
  addCylPart(w4DnBronze, 0.42, 0.32, 0.55, 6, cx, floorY + 1.22, cz + 32);
  const vsX = cx + 36;
  const vsZ = cz + 34;
  addW3Plinth(w4DnStone, 4.4, 3.6, floorY + 0.35, floorY, vsX, vsZ);
  for (const [ox, oz] of [[-1.7, -1.3], [1.7, -1.3], [-1.7, 1.3], [1.7, 1.3]]) addW3GroundedCol(w4DnBronze, 0.09, 0.11, floorY + 2.85, floorY + 0.35, 5, vsX + ox, vsZ + oz);
  addBoxPart(w4DnStone, 4.8, 0.24, 4.0, vsX, floorY + 2.92, vsZ);
  for (let m = 0; m < 4; m++) addCylPart(w4DnBronze, 0.65, 0.65, 0.06, 5, cx, floorY + 0.04, cz + 36 + m * 4.5);
  for (const s of [-1, 1]) addBoxPart(w4DnStone, 0.65, 0.18, 12.0, cx + s * 6.2, floorY + 0.09, cz + 52);
  for (const s of [-1, 1]) addBoxPart(w4DnStone, 1.15, 1.45, 1.15, cx + s * 7.2, floorY + 0.72, cz + 55);
  addW3GroundedCol(w4DnBronze, 0.08, 0.10, floorY + 1.35, floorY, 5, cx + 38, cz - 14);
  for (let l = 0; l < 6; l++) {
    const lx = cx + (l < 3 ? -32 : 32);
    const lz = cz + 22 + (l % 3) * 14;
    addW3GroundedPost(w4DnStone, 0.32, 0.32, floorY + 1.65, floorY, lx, lz);
    addConePart(w4DnEmber, 0.20, 0.32, 4, lx, floorY + 1.82, lz);
  }
  addBoxPart(w4DnStone, 8.8, 0.45, 3.6, cx, floorY + 0.22, cz + 56.5);
  addBoxPart(w4DnStone, 1.8, 5.2, 1.8, cx, floorY + 2.6, cz + 62);
  addConePart(w4DnBronze, 1.15, 1.45, 4, cx, floorY + 5.9, cz + 62);

  addWave3Mesh(cGroup, w4DnStone, ctx.materials.stone);
  addWave3Mesh(cGroup, w4DnBronze, dnBronzeMat);
  addWave3Mesh(cGroup, w4DnEmber, emberMat);
  addWave3Mesh(cGroup, w4DnLeaf, dnLeafMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1460–1487): E/W Guard Pavilions, 4 Dynasty Steles, Peace Bell & Triumphal Stele ---
  const w5DnStone: THREE.BufferGeometry[] = [];
  const w5DnBronze: THREE.BufferGeometry[] = [];
  const w5DnEmber: THREE.BufferGeometry[] = [];
  const w5DnLeaf: THREE.BufferGeometry[] = [];
  // 1460 & 1461: Eastern & Western Canyon Granite Guard-Pavilions (cx ± 46, cz + 38)
  for (const s of [-1, 1]) {
    const gx = cx + s * 46;
    const gz = cz + 38;
    addW3Plinth(w5DnStone, 5.2, 4.4, floorY + 0.38, floorY, gx, gz);
    for (const [ox, oz] of [[-2.0, -1.6], [2.0, -1.6], [-2.0, 1.6], [2.0, 1.6]]) addW3GroundedCol(w5DnBronze, 0.11, 0.13, floorY + 3.25, floorY + 0.38, 5, gx + ox, gz + oz);
    addBoxPart(w5DnStone, 5.8, 0.32, 5.0, gx, floorY + 3.35, gz);
  }
  // 1462–1468: 4 Dynasty shield-steles, bronze drum-podium, flag-honor wall, 12 flame-sconce bollards, Heroic Mother niche, eastern observation balcony & northern torch-bearer pedestals
  for (let d = 0; d < 4; d++) {
    const dx = cx + (d < 2 ? -32 : 32);
    const dz = cz + 26 + (d % 2) * 16;
    addBoxPart(w5DnStone, 1.45, 2.65, 0.42, dx, floorY + 1.32, dz);
    addBoxPart(w5DnBronze, 0.95, 1.35, 0.46, dx, floorY + 1.52, dz);
  }
  addCylPart(w5DnStone, 2.4, 2.6, 0.55, 6, cx, floorY + 0.28, cz + 22);
  addCylPart(w5DnBronze, 1.15, 0.95, 0.88, 6, cx, floorY + 0.98, cz + 22);
  addBoxPart(w5DnStone, 11.2, 2.6, 0.65, cx, floorY + 1.3, cz + 42);
  for (let b = 0; b < 12; b++) {
    const bx = cx + (b < 6 ? -24 + b * 4.0 : 4 + (b - 6) * 4.0);
    addW3GroundedPost(w5DnStone, 0.32, 0.32, floorY + 1.15, floorY, bx, cz + 60);
    addConePart(w5DnEmber, 0.18, 0.28, 4, bx, floorY + 1.32, cz + 60);
  }
  addBoxPart(w5DnStone, 2.6, 1.85, 1.25, cx - 36, floorY + 0.92, cz + 30);
  addCylPart(w5DnBronze, 0.38, 0.28, 0.65, 6, cx - 36, floorY + 2.15, cz + 30);
  addBoxPart(w5DnStone, 4.8, 0.38, 7.6, cx + 48, floorY + 0.35, cz + 2);
  for (const s of [-1, 1]) {
    addBoxPart(w5DnStone, 1.25, 3.2, 1.25, cx + s * 9.5, floorY + 1.6, cz - 52);
    addConePart(w5DnEmber, 0.45, 0.95, 5, cx + s * 9.5, floorY + 3.65, cz - 52);
  }
  // 1469–1478: Tiến Quân Ca tablet, 2 water-rills, 4 laurel columns, semicircular veteran bench, 6 acoustic fins, Peace Bell frame, 4 planter cubes, 6 arrival bollards, northern star medallion & candle-lighting terrace
  addBoxPart(w5DnStone, 3.2, 1.15, 0.85, cx, floorY + 0.58, cz + 35);
  for (const s of [-1, 1]) addBoxPart(w5DnStone, 1.15, 0.24, 11.0, cx + s * 8.2, floorY + 0.12, cz + 56);
  for (const [lx, lz] of [[-8.5, 48], [8.5, 48], [-8.5, 56], [8.5, 56]]) addW3GroundedCol(w5DnStone, 0.32, 0.38, floorY + 4.6, floorY, 6, cx + lx, cz + lz);
  addBoxPart(w5DnStone, 6.2, 0.52, 0.85, cx - 32, floorY + 0.26, cz + 12, Math.PI * 0.5);
  for (let f = 0; f < 6; f++) addBoxPart(w5DnStone, 0.42, 3.4, 1.15, cx + 48, floorY + 1.7, cz - 18 + f * 4.5);
  for (const s of [-1, 1]) addW3GroundedPost(w5DnStone, 0.48, 0.48, floorY + 3.8, floorY, cx - 32 + s * 1.6, cz + 46);
  addBoxPart(w5DnStone, 4.2, 0.38, 0.55, cx - 32, floorY + 3.8, cz + 46);
  addCylPart(w5DnBronze, 0.45, 0.58, 1.05, 6, cx - 32, floorY + 2.55, cz + 46);
  for (const [px, pz] of [[-26, 32], [26, 32], [-26, 50], [26, 50]]) {
    addBoxPart(w5DnStone, 1.25, 0.65, 1.25, cx + px, floorY + 0.32, cz + pz);
    addConePart(w5DnLeaf, 0.55, 0.78, 5, cx + px, floorY + 1.02, cz + pz);
  }
  for (let gb = 0; gb < 6; gb++) addW3GroundedPost(w5DnStone, 0.36, 0.36, floorY + 1.05, floorY, cx - 15 + gb * 6, cz + 65);
  addBoxPart(w5DnStone, 2.2, 0.95, 2.2, cx, floorY + 0.48, cz - 46);
  addConePart(w5DnBronze, 0.85, 1.15, 5, cx, floorY + 1.52, cz - 46);
  addBoxPart(w5DnStone, 6.8, 0.85, 0.95, cx, floorY + 0.42, cz + 28);
  for (let c = 0; c < 6; c++) addConePart(w5DnEmber, 0.14, 0.28, 4, cx - 2.5 + c * 1.0, floorY + 0.98, cz + 28);
  // 1479–1487: 2 culvert bridges, 4 victory-date mile-blocks, 3 retaining buttresses, sword-shield plinth, 4 wayfinding pylons, 2 flower troughs, 2 north benches, 6 halyard posts & outer southern triumphal stele
  for (const s of [-1, 1]) addBoxPart(w5DnStone, 2.2, 0.24, 1.85, cx + s * 6.2, floorY + 0.18, cz + 54);
  for (let m = 0; m < 4; m++) addBoxPart(w5DnStone, 0.72, 1.35, 0.72, cx + (m < 2 ? -10 : 10), floorY + 0.68, cz + 38 + (m % 2) * 8);
  for (let rb = 0; rb < 3; rb++) addBoxPart(w5DnStone, 1.65, 2.2, 2.4, cx - 44, floorY + 1.1, cz + 2 + rb * 8);
  addBoxPart(w5DnStone, 1.45, 1.15, 1.45, vsX - 5.2, floorY + 0.58, vsZ);
  addConePart(w5DnBronze, 0.42, 0.95, 4, vsX - 5.2, floorY + 1.62, vsZ);
  for (let wp = 0; wp < 4; wp++) {
    const wx = cx + (wp < 2 ? -16 : 16);
    const wz = cz + 48 + (wp % 2) * 12;
    addW3GroundedPost(w5DnStone, 0.34, 0.34, floorY + 2.25, floorY, wx, wz);
    addConePart(w5DnEmber, 0.18, 0.32, 4, wx, floorY + 2.42, wz);
  }
  for (const s of [-1, 1]) addBoxPart(w5DnStone, 1.85, 0.55, 0.78, cx + s * 3.4, floorY + 0.28, cz + 32);
  for (const s of [-1, 1]) addBoxPart(w5DnStone, 2.6, 0.52, 0.72, cx + s * 10, floorY + 0.26, cz - 46);
  for (let hp = 0; hp < 6; hp++) addW3GroundedCol(w5DnBronze, 0.08, 0.10, floorY + 0.95, floorY, 4, cx + (hp < 3 ? -14 - hp * 4.5 : 14 + (hp - 3) * 4.5), cz + 56.5);
  addBoxPart(w5DnStone, 3.6, 4.8, 0.78, cx, floorY + 2.4, cz + 68);
  addBoxPart(w5DnBronze, 2.4, 3.2, 0.84, cx, floorY + 2.55, cz + 68);

  addWave3Mesh(cGroup, w5DnStone, ctx.materials.stone);
  addWave3Mesh(cGroup, w5DnBronze, dnBronzeMat);
  addWave3Mesh(cGroup, w5DnEmber, emberMat);
  addWave3Mesh(cGroup, w5DnLeaf, dnLeafMat);

  cGroup.add(
    new THREE.Mesh(cliffGeo, reliefMat),
    new THREE.Mesh(mergeNormalized(reliefFigParts), reliefMat),
    new THREE.Mesh(mergeNormalized([...plazaStoneParts, ...dnExpStone]), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(emblemParts), drumMat),
    new THREE.Mesh(mergeNormalized([...goldAccentParts, ...dnExpBronze]), ctx.materials.bronzePatina ?? ctx.materials.bronze),
    nonCrown,
    new THREE.Mesh(mergeNormalized(brazierParts), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized([...emberParts, ...dnExpEmber]), emberMat),
    new THREE.Mesh(mergeNormalized(dnExpLeaf), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone)
  );
  tagMotifIds(cGroup, ['HV-E02', 'HV-NEW-MB-10', 'HV-NEW-MN-12']);
  ctx.scene.add(cGroup);
  return cGroup;
}

function buildHistoricalMemoryColonnadeMacro(
  ctx: VietnamBuilderContext,
  filmTex: THREE.DataTexture
): { group: THREE.Group; filmMat: THREE.MeshStandardMaterial; filmMats: THREE.MeshStandardMaterial[] } {
  // --- M11: HistoricalMemoryColonnadeMacro (0, -320) ---
  const mx = 0;
  const mz = -315;
  ctx.exclusionCircles.push({ x: mx, z: mz, r: 108 });
  const mGroup = new THREE.Group();
  mGroup.name = 'HistoricalMemoryColonnadeMacro';
  const filmMat = new THREE.MeshStandardMaterial({
    map: filmTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: filmTex,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    side: THREE.DoubleSide
  });
  filmMat.userData.noDedupe = true;
  const solarMat = new THREE.MeshStandardMaterial({
    color: '#e85a24',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 1.5,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(filmMat, solarMat);

  // 4 distinct archival documentary filmstrip textures distributed across ALL 16 steles + 3 foreground hero frames (all synced in setAtmosphere!)
  const variantTexes = [0, 1, 2, 3].map((v) => {
    if (v === 0) return filmTex;
    const t = createFilmstripArchivalTexture(ctx.renderer, v);
    ctx.extraTextures.push(t);
    return t;
  });
  const variantMats = variantTexes.map((vt, vIdx) => {
    if (vIdx === 0) return filmMat;
    const m = new THREE.MeshStandardMaterial({
      map: vt,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: vt,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    m.userData.noDedupe = true;
    ctx.extraMaterials.push(m);
    return m;
  });

  const steleFrame = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 11.5, 0.28), ctx.materials.darkWood, 16);
  const plinthInst = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.85, 0.9), ctx.materials.stone, 16);
  const panelGeo = new THREE.PlaneGeometry(2.1, 11.0);
  const stelePanels = variantMats.map((vm) => new THREE.InstancedMesh(panelGeo, vm, 4));
  const panelCounts = [0, 0, 0, 0];

  for (let i = 0; i < 16; i++) {
    const side = i < 8 ? -1 : 1;
    const rank = i % 8;
    const sx = side * (24 + (rank % 3) * 14);
    const sz = -282 - rank * 7.2;
    const sy = Math.max(ctx.getHeight(sx, sz), 1.4);
    const yaw = side * -0.22;
    const hScale = 0.85 + (rank % 3) * 0.16;
    setInstanceMatrix(plinthInst, i, sx, sy + 0.42, sz, 0, yaw, 0, 1, 1, 1);
    setInstanceMatrix(steleFrame, i, sx, sy + 0.82 + 5.75 * hScale, sz, 0, yaw, 0, 1, hScale, 1);
    const vIdx = i % 4;
    const pSlot = panelCounts[vIdx]++;
    setInstanceMatrix(
      stelePanels[vIdx],
      pSlot,
      sx + Math.sin(yaw) * 0.16,
      sy + 0.82 + 5.75 * hScale,
      sz + Math.cos(yaw) * 0.16,
      0,
      yaw,
      0,
      1,
      hScale,
      1
    );
  }
  plinthInst.instanceMatrix.needsUpdate = true;
  steleFrame.instanceMatrix.needsUpdate = true;
  for (const sp of stelePanels) sp.instanceMatrix.needsUpdate = true;

  // FIX HV07-3: Elevate Radiant Red Sun Disc (r=6.6m) to y=16.5m ABOVE central film frames & suspend Nón Lá Crown by slender tension cables (ZERO blocking scaffold poles!)
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(6.6, 32), solarMat);
  sunDisc.position.set(0, 16.5, -336);
  const memCrown = new THREE.Mesh(createNonLaLatticeGeometry(3.6, 3.2, 16, 12), ctx.materials.gold);
  memCrown.position.set(0, 17.5, -325);

  const memSupportParts: THREE.BufferGeometry[] = [];
  const fgStoneParts: THREE.BufferGeometry[] = [];
  for (const [cxOff, czOff, tx, tz] of [
    [-3.2, -325, -18.0, -322],
    [3.2, -325, 18.0, -322],
    [-2.4, -327.5, -16.0, -332],
    [2.4, -327.5, 16.0, -332]
  ]) {
    memSupportParts.push(
      new THREE.TubeGeometry(
        new THREE.LineCurve3(
          new THREE.Vector3(cxOff, 17.6, czOff),
          new THREE.Vector3(tx, 16.2, tz)
        ),
        2,
        0.035,
        5,
        false
      )
    );
  }
  // FIX HV07-4: Monumental Exhibition Scale Hierarchy (2 tall foreground film towers + wide central hero frame) + Dark Reflective Basalt Gallery Floor!
  const galleryFloorY = Math.max(ctx.getHeight(0, -308), 1.45);
  const darkFloorMat = new THREE.MeshStandardMaterial({
    color: '#14171c',
    roughness: 0.14,
    metalness: 0.36
  });
  ctx.extraMaterials.push(darkFloorMat);
  const galleryFloor = new THREE.Mesh(new THREE.PlaneGeometry(58, 68), darkFloorMat);
  galleryFloor.rotation.x = -Math.PI * 0.5;
  galleryFloor.position.set(0, galleryFloorY + 0.08, -308);
  galleryFloor.receiveShadow = true;
  mGroup.add(galleryFloor);

  // 2 Monumental Foreground Filmstrip Towers (4.4m × 14.5m) framing the exhibition entry + 3 staggered central hero frames!
  const fgFrames: Array<[number, number, number, number, number, number]> = [
    [-14.5, -296.0, 4.4, 14.2, 0.24, 3],
    [14.5, -296.0, 4.4, 14.2, -0.24, 1],
    [-6.6, -327.0, 2.6, 8.6, 0.14, 1],
    [0.0, -330.5, 6.4, 9.8, 0.0, 0],
    [6.6, -327.0, 2.6, 8.6, -0.14, 2]
  ];
  for (const [fx, fz, fw, fh, fYaw, vIdx] of fgFrames) {
    const fy = Math.max(ctx.getHeight(fx, fz), galleryFloorY);
    addBoxPart(fgStoneParts, fw + 0.85, 0.72, 1.05, fx, fy + 0.36, fz, fYaw);
    addBoxPart(memSupportParts, fw + 0.28, fh + 0.3, 0.24, fx, fy + 0.72 + fh * 0.5, fz, fYaw);
    const fgPanel = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), variantMats[vIdx]);
    fgPanel.rotation.y = fYaw;
    fgPanel.position.set(fx + Math.sin(fYaw) * 0.15, fy + 0.72 + fh * 0.5, fz + Math.cos(fYaw) * 0.15);
    mGroup.add(fgPanel);
  }

  // --- 200-Item Macro Visual QC & Expansion (145–158): Quảng Trường Ký Ức Lịch Sử 35mm ---
  const hmExpStone: THREE.BufferGeometry[] = [];
  const hmExpBronze: THREE.BufferGeometry[] = [];
  const hmExpWood: THREE.BufferGeometry[] = [];
  const hmExpGlow: THREE.BufferGeometry[] = [];

  // 145 & 152: Overhead colonnade portico beams supported on 4 bronze columns per side & Ceremonial Cổng Vòm Ký Ức architrave
  for (const side of [-1, 1]) {
    addBoxPart(hmExpBronze, 0.36, 0.42, 54.0, side * 24.0, galleryFloorY + 10.55, -307.0);
    for (const colZ of [-280.0, -298.0, -316.0, -334.0]) {
      addCylPart(hmExpBronze, 0.18, 0.22, 10.55, 6, side * 24.0, galleryFloorY + 5.28, colZ);
    }
  }
  const archSpan = new THREE.TorusGeometry(14.5, 0.45, 6, 28, Math.PI);
  archSpan.translate(0, galleryFloorY + 13.5, -296.0);
  hmExpBronze.push(archSpan);
  // 146: 2 Sculpted vintage 35mm cinema projector & film-reel monuments at gallery entrance
  for (const side of [-1, 1]) {
    const px = side * 9.5;
    const pz = -282.0;
    addBoxPart(hmExpStone, 2.4, 1.15, 2.4, px, galleryFloorY + 0.58, pz);
    addBoxPart(hmExpBronze, 1.15, 0.95, 1.45, px, galleryFloorY + 1.65, pz);
    for (const rz of [-0.45, 0.45]) {
      const reel = new THREE.CylinderGeometry(0.68, 0.68, 0.18, 12);
      reel.rotateZ(Math.PI * 0.5);
      reel.translate(px, galleryFloorY + 2.55, pz + rz);
      hmExpBronze.push(reel);
    }
    addCylPart(hmExpBronze, 0.14, 0.22, 0.65, 8, px, galleryFloorY + 1.75, pz - 0.95, Math.PI * 0.5, 0);
  }
  // 147 & 150: 2 Dark reflective basalt water channels & 4 minimalist stone museum benches
  for (const side of [-1, 1]) {
    const poolStrip = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 46.0).rotateX(-Math.PI * 0.5), darkFloorMat);
    poolStrip.position.set(side * 10.5, galleryFloorY + 0.12, -304.0);
    mGroup.add(poolStrip);
    addBoxPart(hmExpStone, 4.6, 0.26, 46.4, side * 10.5, galleryFloorY + 0.13, -304.0);
    for (const bz of [-294.0, -314.0]) {
      addBoxPart(hmExpStone, 0.85, 0.48, 2.8, side * 7.2, galleryFloorY + 0.24, bz);
    }
  }
  // 148 & 149 & 153 & 156: 12 Gallery bollard lights, 6 timeline podium plaques, 4 wreath stands & curved viewing step
  for (let i = 0; i < 6; i++) {
    const pz = -284.0 - i * 8.0;
    for (const side of [-1, 1]) {
      addCylPart(hmExpBronze, 0.10, 0.12, 0.85, 6, side * 5.2, galleryFloorY + 0.42, pz);
      hmExpGlow.push(new THREE.SphereGeometry(0.12, 6, 4).translate(side * 5.2, galleryFloorY + 0.92, pz));
      if (i % 2 === 1) {
        addBoxPart(hmExpStone, 0.95, 0.95, 0.55, side * 6.8, galleryFloorY + 0.48, pz);
        addBoxPart(hmExpBronze, 0.88, 0.08, 0.52, side * 6.8, galleryFloorY + 0.98, pz, 0, 0.35, 0);
      }
    }
  }
  for (const wx of [-4.2, -1.8, 1.8, 4.2]) {
    addCylPart(hmExpWood, 0.05, 0.08, 1.35, 5, wx, galleryFloorY + 0.68, -323.5);
    hmExpGlow.push(new THREE.TorusGeometry(0.42, 0.08, 5, 10).translate(wx, galleryFloorY + 1.05, -323.4));
  }
  addBoxPart(hmExpStone, 28.0, 0.32, 2.4, 0, galleryFloorY + 0.16, -274.5);

  // --- Wave 2 Macro Visual QC & Expansion (345–358): Ký Ức 35mm Photo-Exhibition Kiosks & Film-Strip Arches ---
  // 345 & 358: 4 Illuminated 35mm photo-exhibition kiosks & 4 timber-slatted stone museum benches
  for (const side of [-1, 1]) {
    for (const kz of [-290.0, -312.0]) {
      const kx = side * 16.5;
      addBoxPart(hmExpStone, 2.8, 0.45, 1.2, kx, galleryFloorY + 0.22, kz);
      addBoxPart(hmExpBronze, 2.6, 2.6, 0.32, kx, galleryFloorY + 1.75, kz);
      addBoxPart(hmExpGlow, 2.2, 1.85, 0.38, kx, galleryFloorY + 1.8, kz);
      addBoxPart(hmExpWood, 2.4, 0.12, 0.68, kx - side * 2.2, galleryFloorY + 0.48, kz);
      addBoxPart(hmExpStone, 2.2, 0.42, 0.58, kx - side * 2.2, galleryFloorY + 0.21, kz);
    }
  }
  // 346: 3 Sequential bronze ribbed 35mm Film-Strip Portal Arches spanning central walkway
  for (const az of [-288.0, -304.0, -318.0]) {
    for (const side of [-1, 1]) {
      addBoxPart(hmExpBronze, 0.48, 7.6, 0.95, side * 5.6, galleryFloorY + 3.8, az);
      addBoxPart(hmExpGlow, 0.14, 6.4, 0.22, side * 5.32, galleryFloorY + 3.8, az);
    }
    addBoxPart(hmExpBronze, 11.8, 0.65, 1.05, 0, galleryFloorY + 7.75, az);
  }
  // 347 & 348: 2 Archival film light-tables & oversized vintage 35mm rangefinder camera monument
  for (const side of [-1, 1]) {
    addBoxPart(hmExpBronze, 1.6, 0.92, 3.2, side * 3.8, galleryFloorY + 0.46, -300.0);
    addBoxPart(hmExpGlow, 1.32, 0.08, 2.8, side * 3.8, galleryFloorY + 0.95, -300.0);
  }
  addBoxPart(hmExpStone, 3.2, 1.1, 2.4, 0, galleryFloorY + 0.55, -334.0);
  addBoxPart(hmExpBronze, 2.4, 1.35, 1.15, 0, galleryFloorY + 1.78, -334.0);
  addCylPart(hmExpBronze, 0.52, 0.58, 0.85, 6, 0, galleryFloorY + 1.78, -333.1, Math.PI * 0.5, 0);
  // 349–357: 8 Gallery track-light masts, 4 pool stepping-bridges, 4 reading desks, 2 canister stacks, floor beacon strip, viewfinder frame, 4 bamboo planters, pool rails & 1945–2025 monoliths
  for (let i = 0; i < 4; i++) {
    const mz = -286.0 - i * 10.5;
    for (const side of [-1, 1]) {
      addCylPart(hmExpBronze, 0.07, 0.09, 4.4, 5, side * 14.0, galleryFloorY + 2.2, mz);
      addConePart(hmExpGlow, 0.16, 0.24, 5, side * 14.0, galleryFloorY + 4.45, mz);
    }
  }
  for (const side of [-1, 1]) {
    for (const bz of [-290.0, -312.0]) {
      addBoxPart(hmExpStone, 4.8, 0.22, 1.8, side * 10.5, galleryFloorY + 0.18, bz);
    }
    addBoxPart(hmExpStone, 1.1, 0.95, 0.65, side * 4.4, galleryFloorY + 0.48, -320.5);
    addBoxPart(hmExpStone, 1.1, 0.95, 0.65, side * 4.4, galleryFloorY + 0.48, -326.5);
    // 352: Film canister stacks
    addCylPart(hmExpBronze, 0.58, 0.58, 0.45, 6, side * 12.2, galleryFloorY + 0.22, -282.0);
    addCylPart(hmExpBronze, 0.52, 0.52, 0.45, 6, side * 12.2, galleryFloorY + 0.68, -282.0);
    // 355 & 356 & 357: Bamboo planters, pool handrail & 1945–2025 monoliths
    addBoxPart(hmExpStone, 2.2, 0.58, 2.2, side * 19.5, galleryFloorY + 0.29, -278.0);
    addBoxPart(hmExpStone, 2.2, 0.58, 2.2, side * 19.5, galleryFloorY + 0.29, -328.0);
    addBoxPart(hmExpBronze, 0.08, 0.08, 46.0, side * 12.8, galleryFloorY + 0.85, -304.0);
    for (let rp = 0; rp < 6; rp++) {
      addCylPart(hmExpBronze, 0.04, 0.04, 0.85, 5, side * 12.8, galleryFloorY + 0.42, -282.0 - rp * 8.8);
    }
    addBoxPart(hmExpStone, 1.25, 3.6, 0.45, side * 14.5, galleryFloorY + 1.8, -296.0);
  }
  for (let d = 0; d < 6; d++) {
    addBoxPart(hmExpGlow, 0.24, 0.04, 3.2, 0, galleryFloorY + 0.04, -279.0 - d * 7.2);
  }
  // 354: Standing 3:2 35mm camera-viewfinder photo-op frame
  addBoxPart(hmExpBronze, 0.22, 3.2, 0.22, -2.4, galleryFloorY + 1.6, -276.5);
  addBoxPart(hmExpBronze, 0.22, 3.2, 0.22, 2.4, galleryFloorY + 1.6, -276.5);
  addBoxPart(hmExpBronze, 5.0, 0.22, 0.22, 0, galleryFloorY + 3.2, -276.5);

  // --- Wave 3 Macro Visual QC & Expansion (687–714): Open-Air 35mm Cinema, Film-Archive Pavilions & Bronze Cameras ---
  const w3HmStone: THREE.BufferGeometry[] = [];
  const w3HmBronze: THREE.BufferGeometry[] = [];
  const w3HmWood: THREE.BufferGeometry[] = [];
  const w3HmGlow: THREE.BufferGeometry[] = [];
  // 687–689: Open-air 35mm cinema screen monument, projection booth tower & 4 rows of tiered basalt seating
  const scrX = 0;
  const scrZ = -346.0;
  addW3Plinth(w3HmStone, 15.0, 2.2, galleryFloorY + 0.95, galleryFloorY, scrX, scrZ);
  addW3GroundedPost(w3HmBronze, 0.72, 0.72, galleryFloorY + 8.6, galleryFloorY + 0.9, scrX - 6.8, scrZ);
  addW3GroundedPost(w3HmBronze, 0.72, 0.72, galleryFloorY + 8.6, galleryFloorY + 0.9, scrX + 6.8, scrZ);
  addBoxPart(w3HmBronze, 14.4, 0.65, 0.75, scrX, galleryFloorY + 8.65, scrZ);
  addBoxPart(w3HmStone, 12.8, 6.4, 0.28, scrX, galleryFloorY + 4.95, scrZ);
  addBoxPart(w3HmGlow, 12.2, 5.8, 0.34, scrX, galleryFloorY + 4.95, scrZ);
  // 688: Projection booth tower
  addBoxPart(w3HmStone, 3.6, 4.4, 3.2, 0, galleryFloorY + 2.2, -338.5);
  addBoxPart(w3HmBronze, 3.85, 0.35, 3.45, 0, galleryFloorY + 4.5, -338.5);
  addCylPart(w3HmGlow, 0.28, 0.28, 0.35, 6, -0.55, galleryFloorY + 3.4, -340.15, Math.PI * 0.5, 0);
  addCylPart(w3HmGlow, 0.28, 0.28, 0.35, 6, 0.55, galleryFloorY + 3.4, -340.15, Math.PI * 0.5, 0);
  // 689: 4 rows of tiered basalt seating facing cinema screen
  for (let r = 0; r < 4; r++) {
    addBoxPart(w3HmStone, 11.4 + r * 1.4, 0.45 + r * 0.14, 0.85, 0, galleryFloorY + 0.22 + r * 0.07, -341.2 + r * 1.5);
  }
  // 690–692, 706, 709: Eastern & western film-archive pavilions (shifted to side * 31.5 clear of stele row at ±24!), 4 illuminated reel cabinets, film-splicing table & 4 bamboo planters
  for (const side of [-1, 1]) {
    const px = side * 31.5;
    const pz = -302.0;
    addW3Plinth(w3HmStone, 6.4, 12.6, galleryFloorY + 0.42, galleryFloorY, px, pz);
    for (const oz of [-5.2, 0, 5.2]) {
      addW3GroundedPost(w3HmBronze, 0.32, 0.32, galleryFloorY + 4.2, galleryFloorY + 0.42, px - 2.6, pz + oz);
      addW3GroundedPost(w3HmBronze, 0.32, 0.32, galleryFloorY + 4.2, galleryFloorY + 0.42, px + 2.6, pz + oz);
    }
    addBoxPart(w3HmStone, 7.2, 0.48, 13.4, px, galleryFloorY + 4.45, pz);
    addBoxPart(w3HmBronze, 7.35, 0.14, 13.55, px, galleryFloorY + 4.74, pz);
    // 692: 2 Illuminated reel cabinets per pavilion
    for (const czOff of [-2.8, 2.8]) {
      addBoxPart(w3HmBronze, 1.4, 2.2, 0.72, px, galleryFloorY + 1.52, pz + czOff);
      addCylPart(w3HmGlow, 0.34, 0.34, 0.78, 6, px, galleryFloorY + 1.85, pz + czOff, Math.PI * 0.5, 0);
    }
    // 709: 2 Architectural bamboo planters per pavilion
    for (const bzOff of [-7.6, 7.6]) {
      addBoxPart(w3HmStone, 2.4, 0.65, 1.4, px, galleryFloorY + 0.32, pz + bzOff);
      for (const ox of [-0.6, 0, 0.6]) addW3GroundedCol(w3HmWood, 0.06, 0.07, galleryFloorY + 3.2, galleryFloorY + 0.6, 5, px + ox, pz + bzOff);
    }
  }
  addBoxPart(w3HmBronze, 2.2, 0.92, 0.95, 31.5, galleryFloorY + 0.88, -302.0);
  // 693–696: Bronze cinema camera & tripod (east), telephoto camera & tripod (west), track-dolly sculpture & clapperboard monument
  for (const side of [-1, 1]) {
    const cxCam = side * 7.8;
    const czCam = -282.5;
    addBoxPart(w3HmStone, 1.6, 0.45, 1.6, cxCam, galleryFloorY + 0.22, czCam);
    for (let l = 0; l < 3; l++) {
      const la = (l / 3) * Math.PI * 2;
      addCylPart(w3HmBronze, 0.04, 0.05, 1.55, 5, cxCam + Math.cos(la) * 0.32, galleryFloorY + 1.15, czCam + Math.sin(la) * 0.32, Math.sin(la) * 0.28, -Math.cos(la) * 0.28);
    }
    addBoxPart(w3HmBronze, 0.85, 0.58, 0.62, cxCam, galleryFloorY + 2.05, czCam);
    addCylPart(w3HmBronze, 0.16, 0.22, side > 0 ? 0.55 : 0.95, 6, cxCam, galleryFloorY + 2.05, czCam - 0.52, Math.PI * 0.5, 0);
    if (side > 0) {
      addCylPart(w3HmBronze, 0.26, 0.26, 0.14, 6, cxCam - 0.22, galleryFloorY + 2.52, czCam, 0, Math.PI * 0.5);
      addCylPart(w3HmBronze, 0.26, 0.26, 0.14, 6, cxCam + 0.22, galleryFloorY + 2.52, czCam, 0, Math.PI * 0.5);
    }
  }
  // 695 & 696: Track-dolly sculpture & clapperboard monument
  addBoxPart(w3HmBronze, 4.6, 0.08, 0.12, -9.5, galleryFloorY + 0.06, -342.0);
  addBoxPart(w3HmBronze, 4.6, 0.08, 0.12, -9.5, galleryFloorY + 0.06, -343.2);
  addBoxPart(w3HmBronze, 1.4, 0.62, 1.25, -9.5, galleryFloorY + 0.42, -342.6);
  addBoxPart(w3HmStone, 1.8, 0.72, 0.95, 9.5, galleryFloorY + 0.36, -342.6);
  addBoxPart(w3HmBronze, 1.45, 1.15, 0.14, 9.5, galleryFloorY + 1.28, -342.6);
  addBoxPart(w3HmGlow, 1.45, 0.22, 0.16, 9.5, galleryFloorY + 1.98, -342.6, 0, 0, 0.22);
  // 697–705, 707–708, 710–714: Pool spillways, 8 submerged uplights, 6 floating pads, 4 display vitrines, sprocket screen walls, portico louvers, 4 audio-guide lecterns, ticket kiosk, carbon-arc spotlights, wreath rings, 8 curb lights, quote monoliths, amphitheater handrails, hero-frame buttresses, wayfinding totems & filmstrip ground inlays
  for (const side of [-1, 1]) {
    addBoxPart(w3HmStone, 4.4, 0.55, 1.4, side * 10.5, galleryFloorY + 0.28, -327.0);
    for (let u = 0; u < 4; u++) {
      addBoxPart(w3HmBronze, 0.42, 0.22, 0.42, side * 10.5, galleryFloorY + 0.12, -284.0 - u * 12.0);
      addBoxPart(w3HmGlow, 0.32, 0.08, 0.32, side * 10.5, galleryFloorY + 0.25, -284.0 - u * 12.0);
      addBoxPart(w3HmGlow, 0.18, 0.14, 2.2, side * 19.2, galleryFloorY + 0.07, -284.0 - u * 12.0);
    }
    for (let p = 0; p < 3; p++) {
      addBoxPart(w3HmStone, 1.25, 0.18, 1.25, side * 10.5, galleryFloorY + 0.12, -278.5 - p * 2.2);
    }
    for (const vz of [-295.0, -308.0]) {
      addBoxPart(w3HmBronze, 1.6, 0.95, 0.85, side * 5.2, galleryFloorY + 0.48, vz);
      addBoxPart(w3HmGlow, 1.42, 0.12, 0.68, side * 5.2, galleryFloorY + 0.98, vz);
      addW3GroundedCol(w3HmBronze, 0.06, 0.08, galleryFloorY + 1.25, galleryFloorY, 5, side * 3.4, vz);
    }
    addBoxPart(w3HmBronze, 3.2, 3.2, 0.18, side * 4.8, galleryFloorY + 1.6, -334.0);
    addBoxPart(w3HmBronze, 3.6, 0.14, 34.0, side * 16.5, galleryFloorY + 5.65, -302.0);
    for (const lz of [-318.0, -302.0, -286.0]) {
      addW3GroundedCol(w3HmBronze, 0.12, 0.14, galleryFloorY + 5.65, galleryFloorY, 5, side * 16.5, lz);
    }
    addW3GroundedCol(w3HmBronze, 0.08, 0.10, galleryFloorY + 3.2, galleryFloorY, 5, side * 8.2, -345.0);
    addConePart(w3HmGlow, 0.32, 0.55, 5, side * 8.2, galleryFloorY + 3.35, -345.0, 0, Math.PI * 0.4, 0);
    addCylPart(w3HmBronze, 0.45, 0.45, 0.12, 6, side * 2.2, galleryFloorY + 0.85, -323.0, Math.PI * 0.5, 0);
    addCylPart(w3HmBronze, 0.45, 0.45, 0.12, 6, side * 4.2, galleryFloorY + 0.85, -323.0, Math.PI * 0.5, 0);
    addBoxPart(w3HmStone, 1.6, 2.1, 0.35, side * 6.8, galleryFloorY + 1.05, -296.0);
    addBoxPart(w3HmBronze, 0.10, 0.95, 2.4, side * 1.4, galleryFloorY + 0.62, -274.5);
    addBoxPart(w3HmStone, 2.2, 1.45, 2.8, side * 6.2, galleryFloorY + 0.72, -329.5);
    addW3GroundedPost(w3HmBronze, 0.38, 0.24, galleryFloorY + 2.8, galleryFloorY, side * 12.8, -301.0);
    addBoxPart(w3HmBronze, 0.36, 0.06, 42.0, side * 2.6, galleryFloorY + 0.04, -301.0);
  }
  addBoxPart(w3HmWood, 2.6, 1.05, 1.15, -6.8, galleryFloorY + 0.52, -274.5);
  addBoxPart(w3HmBronze, 2.75, 0.12, 1.25, -6.8, galleryFloorY + 1.08, -274.5);

  addWave3Mesh(mGroup, w3HmStone, ctx.materials.stone);
  addWave3Mesh(mGroup, w3HmBronze, ctx.materials.bronze);
  addWave3Mesh(mGroup, w3HmWood, ctx.materials.darkWood);
  addWave3Mesh(mGroup, w3HmGlow, solarMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1088–1115): Open-Air 35mm Projection Booth, Reel Monument, Ticket Kiosk & Cinema Bleachers ---
  const w4HmStone: THREE.BufferGeometry[] = [];
  const w4HmBronze: THREE.BufferGeometry[] = [];
  const w4HmWood: THREE.BufferGeometry[] = [];
  const w4HmGlow: THREE.BufferGeometry[] = [];
  // 1088–1092: Open-air 35mm projection booth (mx, mz + 48), giant reel sculpture, darkroom bench, 4 lightboxes & retro ticket booth
  const pbX = mx;
  const pbZ = mz + 48;
  addW3Plinth(w4HmStone, 5.4, 4.2, galleryFloorY + 0.35, galleryFloorY, pbX, pbZ);
  addBoxPart(w4HmBronze, 4.4, 2.75, 3.2, pbX, galleryFloorY + 1.72, pbZ);
  addBoxPart(w4HmStone, 5.0, 0.24, 3.8, pbX, galleryFloorY + 3.12, pbZ);
  addBoxPart(w4HmGlow, 1.4, 0.45, 0.12, pbX, galleryFloorY + 2.25, pbZ - 1.62);
  addBoxPart(w4HmStone, 2.4, 0.72, 1.4, mx - 16, galleryFloorY + 0.36, mz + 44);
  addCylPart(w4HmBronze, 1.35, 1.35, 0.35, 6, mx - 16, galleryFloorY + 1.95, mz + 44, Math.PI * 0.5, 0);
  addBoxPart(w4HmWood, 3.4, 0.88, 1.15, mx - 28, galleryFloorY + 0.44, mz + 34);
  for (let t = -1; t <= 1; t++) addBoxPart(w4HmGlow, 0.78, 0.14, 0.65, mx - 28 + t * 1.05, galleryFloorY + 0.95, mz + 34);
  for (let k = 0; k < 4; k++) {
    const kx = mx + (k < 2 ? -18 + k * 7 : 11 + (k - 2) * 7);
    addBoxPart(w4HmBronze, 1.25, 2.25, 0.32, kx, galleryFloorY + 1.12, mz + 38);
    addBoxPart(w4HmGlow, 0.98, 1.65, 0.36, kx, galleryFloorY + 1.18, mz + 38);
  }
  const tbX = mx + 18;
  const tbZ = mz + 46;
  addCylPart(w4HmBronze, 1.25, 1.32, 2.45, 6, tbX, galleryFloorY + 1.22, tbZ);
  addConePart(w4HmStone, 1.65, 0.65, 6, tbX, galleryFloorY + 2.75, tbZ);
  addBoxPart(w4HmGlow, 0.85, 0.65, 0.12, tbX, galleryFloorY + 1.55, tbZ + 1.18);
  // 1093–1101: 6 acoustic fins, 8 pool spotlights, 4 timeline benches, camera tripod sculpture, negative light-table, 4 poster vitrines, sprocket screen, 3 bleachers & tape console
  for (let f = 0; f < 6; f++) addBoxPart(w4HmWood, 0.22, 3.4, 1.15, mx + (f < 3 ? -34 : 34), galleryFloorY + 1.7, mz + 16 + (f % 3) * 8);
  for (let s = 0; s < 8; s++) addCylPart(w4HmGlow, 0.16, 0.20, 0.18, 5, mx + (s < 4 ? -12 : 12), galleryFloorY + 0.10, mz - 24 + (s % 4) * 16);
  for (let b = 0; b < 4; b++) addBoxPart(w4HmWood, 2.6, 0.48, 0.68, mx + (b < 2 ? -12 : 12), galleryFloorY + 0.24, mz + 42 + (b % 2) * 6);
  addBoxPart(w4HmStone, 1.1, 0.65, 1.1, mx + 26, galleryFloorY + 0.32, mz + 36);
  addBoxPart(w4HmBronze, 0.72, 0.58, 1.15, mx + 26, galleryFloorY + 1.45, mz + 36);
  addBoxPart(w4HmWood, 1.8, 0.92, 0.95, mx - 32, galleryFloorY + 0.46, mz + 22);
  addBoxPart(w4HmGlow, 1.55, 0.08, 0.72, mx - 32, galleryFloorY + 0.96, mz + 22, 0, 0.22, 0);
  for (let p = 0; p < 4; p++) addBoxPart(w4HmBronze, 1.1, 2.1, 0.22, mx - 18 + p * 12, galleryFloorY + 1.05, mz + 54);
  addBoxPart(w4HmBronze, 8.2, 2.45, 0.24, mx - 28, galleryFloorY + 1.22, mz + 44);
  for (let bl = 0; bl < 3; bl++) addBoxPart(w4HmWood, 9.6, 0.42, 0.95, mx, galleryFloorY + 0.21 + bl * 0.42, mz + 38 + bl * 1.1);
  addBoxPart(w4HmBronze, 1.35, 0.92, 0.75, mx + 32, galleryFloorY + 0.46, mz + 22);
  // 1102–1115: 4 decade bollards, track-light arch, 2 vault cabinets, 4 planter cubes, clapperboard plinth, 6 floor strips, mobile cinema cart, 2 speaker columns, map stand, 2 wind-screens, film-can stack, 4 reed planters, 6 lanterns & title pylon
  for (let d = 0; d < 4; d++) addW3GroundedPost(w4HmBronze, 0.36, 0.36, galleryFloorY + 1.25, galleryFloorY, mx - 9 + d * 6, mz + 58);
  for (const s of [-1, 1]) addW3GroundedCol(w4HmBronze, 0.12, 0.14, galleryFloorY + 4.4, galleryFloorY, 5, mx + s * 6.5, mz + 44);
  addBoxPart(w4HmBronze, 13.8, 0.22, 0.28, mx, galleryFloorY + 4.4, mz + 44);
  for (const s of [-1, 1]) addBoxPart(w4HmBronze, 1.25, 1.95, 0.85, mx + s * 32, galleryFloorY + 0.98, mz + 10);
  for (const [px, pz] of [[-24, 52], [24, 52], [-24, -46], [24, -46]]) addBoxPart(w4HmStone, 1.25, 0.65, 1.25, mx + px, galleryFloorY + 0.32, mz + pz);
  addBoxPart(w4HmStone, 0.85, 0.95, 0.85, mx - 8, galleryFloorY + 0.48, mz + 52);
  addBoxPart(w4HmBronze, 0.65, 0.55, 0.12, mx - 8, galleryFloorY + 1.25, mz + 52);
  for (let f = 0; f < 6; f++) addBoxPart(w4HmGlow, 0.22, 0.06, 2.2, mx + (f < 3 ? -4.5 : 4.5), galleryFloorY + 0.04, mz + 44 + (f % 3) * 5.0);
  addBoxPart(w4HmWood, 1.65, 0.82, 0.95, tbX + 4.2, galleryFloorY + 0.52, tbZ);
  for (const s of [-1, 1]) addW3GroundedCol(w4HmBronze, 0.10, 0.12, galleryFloorY + 3.6, galleryFloorY, 5, mx + s * 8.2, mz + 36);
  addBoxPart(w4HmBronze, 0.82, 1.05, 0.48, mx + 6.5, galleryFloorY + 0.52, mz + 58);
  for (const s of [-1, 1]) addBoxPart(w4HmStone, 0.18, 2.2, 3.8, mx + 36, galleryFloorY + 1.1, mz + s * 14);
  for (let c = 0; c < 5; c++) addCylPart(w4HmBronze, 0.38, 0.38, 0.14, 6, mx - 12, galleryFloorY + 0.15 + c * 0.16, mz + 50);
  for (let p = 0; p < 4; p++) addBoxPart(w4HmStone, 0.85, 0.55, 2.8, mx - 36, galleryFloorY + 0.28, mz - 12 + p * 8);
  for (let l = 0; l < 6; l++) {
    const lx = mx + (l < 3 ? -22 : 22);
    const lz = mz + 30 + (l % 3) * 10;
    addW3GroundedCol(w4HmBronze, 0.06, 0.08, galleryFloorY + 2.8, galleryFloorY, 5, lx, lz);
    addBoxPart(w4HmGlow, 0.28, 0.45, 0.28, lx, galleryFloorY + 2.75, lz);
  }
  addBoxPart(w4HmBronze, 1.45, 4.6, 0.45, mx, galleryFloorY + 2.3, mz + 62);
  addBoxPart(w4HmGlow, 1.15, 3.8, 0.48, mx, galleryFloorY + 2.3, mz + 62);

  addWave3Mesh(mGroup, w4HmStone, ctx.materials.stone);
  addWave3Mesh(mGroup, w4HmBronze, ctx.materials.bronze);
  addWave3Mesh(mGroup, w4HmWood, ctx.materials.darkWood);
  addWave3Mesh(mGroup, w4HmGlow, solarMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1488–1515): E/W Archive Pavilions, 35mm Ribbon Arch, Projector Plinth & Gateway ---
  const w5HmStone: THREE.BufferGeometry[] = [];
  const w5HmBronze: THREE.BufferGeometry[] = [];
  const w5HmWood: THREE.BufferGeometry[] = [];
  const w5HmGlow: THREE.BufferGeometry[] = [];
  // 1488 & 1489: Outer Western Archive Pavilion & Outer Eastern Audio-Gallery Pavilion (mx ± 34, mz + 46)
  for (const s of [-1, 1]) {
    const px = mx + s * 34;
    const pz = mz + 46;
    addW3Plinth(w5HmStone, 5.4, 4.2, galleryFloorY + 0.32, galleryFloorY, px, pz);
    for (const [ox, oz] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]]) addW3GroundedCol(w5HmBronze, 0.10, 0.12, galleryFloorY + 3.05, galleryFloorY + 0.32, 5, px + ox, pz + oz);
    addBoxPart(w5HmStone, 5.8, 0.26, 4.6, px, galleryFloorY + 3.12, pz);
    addBoxPart(w5HmGlow, 4.8, 0.16, 0.14, px, galleryFloorY + 2.88, pz + 2.15);
  }
  // 1490–1497: 35mm Film-Strip Ribbon Arch, carbon-arc projector plinth, editing bench, 6 documentary-year pylons, 6 queue stanchions, bleacher acoustic hood, press-camera sculpture & microfilm desk
  for (const s of [-1, 1]) addW3GroundedPost(w5HmBronze, 0.65, 0.65, galleryFloorY + 4.8, galleryFloorY, mx + s * 5.8, mz + 56);
  addBoxPart(w5HmBronze, 13.0, 0.85, 0.68, mx, galleryFloorY + 4.8, mz + 56);
  addBoxPart(w5HmGlow, 10.6, 0.32, 0.74, mx, galleryFloorY + 4.8, mz + 56);
  addBoxPart(w5HmStone, 1.35, 0.85, 1.35, pbX - 6.2, galleryFloorY + 0.42, pbZ);
  addBoxPart(w5HmBronze, 0.85, 0.72, 1.05, pbX - 6.2, galleryFloorY + 1.22, pbZ);
  addBoxPart(w5HmWood, 3.2, 0.88, 1.05, mx - 34, galleryFloorY + 0.44, mz + 36);
  for (const s of [-1, 1]) addBoxPart(w5HmGlow, 0.75, 0.10, 0.62, mx - 34 + s * 0.82, galleryFloorY + 0.94, mz + 36);
  for (let p = 0; p < 6; p++) {
    const px = mx + (p < 3 ? -26 : 26);
    const pz = mz + 38 + (p % 3) * 10;
    addBoxPart(w5HmBronze, 0.48, 2.65, 0.48, px, galleryFloorY + 1.32, pz);
    addBoxPart(w5HmGlow, 0.52, 0.24, 0.52, px, galleryFloorY + 2.25, pz);
  }
  for (let q = 0; q < 6; q++) addW3GroundedCol(w5HmBronze, 0.05, 0.07, galleryFloorY + 1.05, galleryFloorY, 4, tbX - 3.6 + q * 1.4, tbZ + 3.2);
  addBoxPart(w5HmWood, 10.2, 0.22, 3.4, mx, galleryFloorY + 3.15, mz + 39.5, 0, -0.18, 0);
  addBoxPart(w5HmStone, 1.05, 0.82, 1.05, mx + 26, galleryFloorY + 0.41, mz + 48);
  addBoxPart(w5HmBronze, 0.68, 0.62, 0.78, mx + 26, galleryFloorY + 1.15, mz + 48);
  addBoxPart(w5HmBronze, 1.45, 0.95, 0.85, mx + 34, galleryFloorY + 0.48, mz + 36);
  addBoxPart(w5HmGlow, 0.78, 0.58, 0.12, mx + 34, galleryFloorY + 1.25, mz + 36);
  // 1498–1506: 6 stepping blocks, marquee sign, darkroom enlarger, 4 gallery benches, radio-desk plinth, 3 film trunks, 2 amber coping walls, Golden-Lotus trophy vitrine & dynamo stand
  for (let sb = 0; sb < 6; sb++) addBoxPart(w5HmStone, 1.45, 0.14, 0.95, mx - 20 + sb * 8, galleryFloorY + 0.07, mz + 60);
  addBoxPart(w5HmBronze, 2.8, 1.65, 0.34, tbX, galleryFloorY + 1.55, tbZ + 5.8);
  addBoxPart(w5HmGlow, 2.4, 1.15, 0.38, tbX, galleryFloorY + 1.55, tbZ + 5.8);
  addW3GroundedCol(w5HmBronze, 0.06, 0.08, galleryFloorY + 1.95, galleryFloorY + 0.88, 5, mx - 28, mz + 36.2);
  for (let gb = 0; gb < 4; gb++) addBoxPart(w5HmWood, 2.6, 0.48, 0.68, mx + (gb < 2 ? -14 : 14), galleryFloorY + 0.24, mz + 50 + (gb % 2) * 6);
  addBoxPart(w5HmWood, 1.45, 0.88, 0.82, mx + 34, galleryFloorY + 0.44, mz + 46);
  for (let tr = 0; tr < 3; tr++) addBoxPart(w5HmBronze, 0.95, 0.42, 0.68, pbX + 4.8, galleryFloorY + 0.21 + tr * 0.44, pbZ);
  for (const s of [-1, 1]) {
    addBoxPart(w5HmStone, 0.55, 0.72, 12.0, mx + s * 16, galleryFloorY + 0.36, mz + 62);
    addBoxPart(w5HmGlow, 0.58, 0.14, 11.4, mx + s * 16, galleryFloorY + 0.72, mz + 62);
  }
  addBoxPart(w5HmStone, 0.95, 1.05, 0.95, mx + 10, galleryFloorY + 0.52, mz + 54);
  addConePart(w5HmGlow, 0.28, 0.52, 5, mx + 10, galleryFloorY + 1.32, mz + 54);
  addBoxPart(w5HmBronze, 0.85, 0.95, 0.65, tbX + 6.4, galleryFloorY + 0.48, tbZ);
  // 1507–1515: Acoustic louver screen, contact-sheet table, 6 bollard uplights, concession cart, 2 pool weirs, 3 tripod easels, cinema-seat sculpture, 2 wayfinding totems & outer southern gateway frame
  addBoxPart(w5HmWood, 0.24, 2.45, 7.2, mx + 40, galleryFloorY + 1.22, mz + 46);
  addBoxPart(w5HmWood, 1.85, 0.88, 1.05, mx - 34, galleryFloorY + 0.44, mz + 46);
  addBoxPart(w5HmGlow, 1.45, 0.08, 0.78, mx - 34, galleryFloorY + 0.92, mz + 46);
  for (let bu = 0; bu < 6; bu++) {
    const bx = mx - 12.5 + bu * 5.0;
    addW3GroundedPost(w5HmBronze, 0.26, 0.26, galleryFloorY + 0.95, galleryFloorY, bx, mz + 65);
    addBoxPart(w5HmGlow, 0.28, 0.14, 0.28, bx, galleryFloorY + 0.98, mz + 65);
  }
  addBoxPart(w5HmWood, 1.65, 0.92, 0.88, tbX - 4.8, galleryFloorY + 0.46, tbZ);
  for (const s of [-1, 1]) addBoxPart(w5HmBronze, 1.85, 0.28, 0.42, mx + s * 12, galleryFloorY + 0.18, mz + 28);
  for (let te = 0; te < 3; te++) {
    const ex = mx - 24 + te * 3.8;
    addBoxPart(w5HmWood, 1.15, 1.65, 0.14, ex, galleryFloorY + 0.95, mz + 56, 0, -0.18, 0);
    addBoxPart(w5HmGlow, 0.88, 1.15, 0.18, ex, galleryFloorY + 1.02, mz + 56, 0, -0.18, 0);
  }
  addBoxPart(w5HmStone, 2.4, 0.42, 1.15, mx - 10, galleryFloorY + 0.21, mz + 56);
  for (let cs = -1; cs <= 1; cs++) addBoxPart(w5HmBronze, 0.58, 0.78, 0.58, mx - 10 + cs * 0.72, galleryFloorY + 0.81, mz + 56);
  for (const s of [-1, 1]) addBoxPart(w5HmBronze, 0.52, 2.85, 0.28, mx + s * 6.5, galleryFloorY + 1.42, mz + 63);
  for (const s of [-1, 1]) addW3GroundedPost(w5HmBronze, 0.85, 0.85, galleryFloorY + 5.2, galleryFloorY, mx + s * 6.8, mz + 68);
  addBoxPart(w5HmBronze, 15.2, 0.95, 0.92, mx, galleryFloorY + 5.2, mz + 68);
  addBoxPart(w5HmGlow, 12.8, 0.36, 0.96, mx, galleryFloorY + 5.2, mz + 68);

  addWave3Mesh(mGroup, w5HmStone, ctx.materials.stone);
  addWave3Mesh(mGroup, w5HmBronze, ctx.materials.bronze);
  addWave3Mesh(mGroup, w5HmWood, ctx.materials.darkWood);
  addWave3Mesh(mGroup, w5HmGlow, solarMat);

  mGroup.add(
    plinthInst,
    steleFrame,
    ...stelePanels,
    new THREE.Mesh(mergeNormalized([...fgStoneParts, ...hmExpStone]), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized([...memSupportParts, ...hmExpBronze]), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(hmExpWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(hmExpGlow), solarMat),
    sunDisc,
    memCrown
  );
  tagMotifIds(mGroup, ['HV-I04', 'HV-NEW-MB-10', 'HV-NEW-MN-12']);
  ctx.scene.add(mGroup);
  return { group: mGroup, filmMat, filmMats: variantMats };
}

function buildTruongSonMonsoonGorgeMacro(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): THREE.Group {
  const cx = 740;
  const cz = -560;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 165 });
  const group = new THREE.Group();
  group.name = 'TruongSonMonsoonJungleGorge';

  // 1. 14 Towering Wet Limestone Gorge Cliffs + FIX R37: 3-Tier Stepped Wet Limestone Cliff Backdrop directly behind all 4 Waterfalls (z = cz - 82) + Emerald Plunge Pool & Stream!
  const rockParts: THREE.BufferGeometry[] = [];
  const waterParts: THREE.BufferGeometry[] = [];
  const foamParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const side = i < 7 ? -1 : 1;
    const k = i % 7;
    const kx = cx + side * (74 + (k % 2) * 32);
    const kz = cz - 110 + k * 34;
    const h = 38 + (k % 3) * 18;
    const cliff = createSculptedRockGeometry(1300 + i, 22, h * 0.55, 22, 2);
    cliff.translate(kx, ctx.getHeight(kx, kz) + h * 0.25, kz);
    rockParts.push(cliff);
  }
  // 3-Tier Stepped Wet Limestone Headwall Cliff Backdrop spanning behind all 4 waterfalls (x = cx - 48 .. cx + 48, z = cz - 82 .. cz - 98)
  const headwallBaseY = ctx.getHeight(cx, cz - 82);
  for (let tier = 0; tier < 3; tier++) {
    const tierZ = cz - 83.5 - tier * 6.5;
    const tierH = 12.0 + tier * 10.5;
    for (let seg = -3; seg <= 3; seg++) {
      const rx = cx + seg * 14.5;
      const ledge = createSculptedRockGeometry(1340 + tier * 10 + seg, 12.8, tierH * 0.62, 8.2, 2);
      ledge.translate(rx, headwallBaseY + tierH * 0.42, tierZ);
      rockParts.push(ledge);
    }
  }
  // Emerald Plunge Pool & Gorge Stream flowing forward from the 4 waterfall bases under the suspension bridge!
  const poolBaseY = Math.max(VIETNAM_WATER_LEVEL + 0.12, ctx.getHeight(cx, cz - 70) + 0.16);
  const plungePoolMat = new THREE.MeshStandardMaterial({
    color: '#1b6d65',
    emissive: new THREE.Color('#0c3b38'),
    emissiveIntensity: 0.25,
    roughness: 0.12,
    metalness: 0.28,
    transparent: true,
    opacity: 0.90
  });
  ctx.extraMaterials.push(plungePoolMat);
  const plungePool = new THREE.Mesh(
    new THREE.CircleGeometry(28.0, 28).scale(1.15, 0.72, 1.0).rotateX(-Math.PI * 0.5),
    plungePoolMat
  );
  plungePool.position.set(cx, poolBaseY, cz - 64);
  const gorgeStream = new THREE.Mesh(
    new THREE.PlaneGeometry(18.0, 96.0).rotateX(-Math.PI * 0.5),
    plungePoolMat
  );
  gorgeStream.position.set(cx, poolBaseY - 0.04, cz - 24);
  group.add(plungePool, gorgeStream);

  // FIX HV09-1: Flip waterfall pitch (-0.22 rad) & shift to cz - 80.2 so cliff-top water emerges solidly from rock ledge and cascades forward into splash pool!
  for (let w = 0; w < 4; w++) {
    const wx = cx - 18 + w * 12;
    const wfPlane = new THREE.PlaneGeometry(8.5, 22.0, 2, 10);
    wfPlane.rotateX(-0.22);
    wfPlane.translate(wx, 13.0, cz - 80.2);
    waterParts.push(wfPlane);

    const wy = Math.max(poolBaseY, ctx.getHeight(wx, cz - 76.5));
    const splash = new THREE.CylinderGeometry(3.8, 5.2, 0.55, 14);
    splash.translate(wx, wy + 0.35, cz - 76.5);
    foamParts.push(splash);
  }
  const wetKarstMat = new THREE.MeshStandardMaterial({
    color: '#2c3a3f',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.28
  });

  const wfUniforms = { uTime: { value: 0.0 } };
  registerAnimUniform(ctx, animList, wfUniforms);
  const cascadeMat = new THREE.MeshStandardMaterial({
    color: '#dce6ee',
    emissive: new THREE.Color('#6a98b8'),
    emissiveIntensity: 0.42,
    transparent: true,
    opacity: 0.80,
    roughness: 0.14,
    side: THREE.DoubleSide
  });
  cascadeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wfUniforms.uTime;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec2 vWfUv;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float stream1 = sin(vWfUv.x * 24.0 + vWfUv.y * 10.0 + uTime * 7.5);
         float stream2 = cos(vWfUv.x * 38.0 - vWfUv.y * 16.0 - uTime * 9.5);
         float streak = clamp(0.45 + 0.35 * stream1 + 0.25 * stream2, 0.0, 1.0);
         totalEmissiveRadiance += vec3(0.45, 0.72, 0.88) * streak;`
      );
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vWfUv;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvWfUv = uv;`);
  };
  const foamMat = new THREE.MeshStandardMaterial({
    color: '#eaf4fa',
    emissive: new THREE.Color('#7eb8d6'),
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.72,
    roughness: 0.35
  });
  ctx.extraMaterials.push(wetKarstMat, cascadeMat, foamMat);

  // FIX R37: Trường Sơn Bamboo & Cable Suspension Bridge anchored into BOTH gorge cliffs with Rock Abutments, Twin Timber-and-Steel Cable Pylons, Backstay Anchor Cables & Side Rope Netting!
  const bridgeWoodParts: THREE.BufferGeometry[] = [];
  const bridgeCableParts: THREE.BufferGeometry[] = [];
  const brZ = cz - 28;
  const brSpan = 116.0;
  const brSegs = 28;
  const brEndY = 14.5;
  for (let b = 0; b < brSegs; b++) {
    const t = (b + 0.5) / brSegs;
    const bx = cx - 58 + t * brSpan;
    const sag = -1.4 * Math.sin(t * Math.PI);
    const by = brEndY + sag;
    addBoxPart(bridgeWoodParts, 3.9, 0.16, 2.4, bx, by, brZ);
    // Vertical suspender hangers + diagonal X rope-netting cross-lacing along both bridge sides
    for (const sz of [-1.25, 1.25]) {
      if (b % 2 === 0) {
        addCylPart(bridgeCableParts, 0.035, 0.035, 1.65, 5, bx, by + 0.82, brZ + sz);
      }
      // Side safety rope netting diagonal cross-strands
      addCylPart(bridgeCableParts, 0.02, 0.02, 1.95, 4, bx, by + 0.72, brZ + sz, 0, 0.78);
      addCylPart(bridgeCableParts, 0.02, 0.02, 1.95, 4, bx, by + 0.72, brZ + sz, 0, -0.78);
    }
  }
  // Upper suspension cables + lower safety handrail cables spanning pylon-to-pylon
  for (const sz of [-1.25, 1.25]) {
    const mainCablePts: THREE.Vector3[] = [];
    const midRailPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const sx = cx - 58 + t * brSpan;
      // Main suspension cable dips smoothly from pylon crest (brEndY + 7.2) down to mid-span handrail (brEndY + 1.4)
      const mainY = brEndY + 1.6 + 5.6 * Math.pow(2.0 * t - 1.0, 2.0);
      mainCablePts.push(new THREE.Vector3(sx, mainY, brZ + sz));
      midRailPts.push(new THREE.Vector3(sx, brEndY + 1.35 - 1.4 * Math.sin(t * Math.PI), brZ + sz));
    }
    bridgeCableParts.push(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mainCablePts), 20, 0.085, 6, false),
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(midRailPts), 18, 0.045, 5, false)
    );
  }
  // Massive Grounded Wet-Limestone Rock Abutments, Stepped Approach Decks, Twin Timber-and-Steel Cable Pylons & Backstay Anchors at BOTH Cliffs!
  for (const endSide of [-1, 1]) {
    const pylonX = cx + endSide * 58.0;
    const cliffX = cx + endSide * 72.0;
    const groundAtEnd = ctx.getHeight(pylonX, brZ);
    // Solid wet-limestone rock cliff abutment bridging the 16m gap cleanly into the gorge cliffs!
    const rockAbut = createSculptedRockGeometry(1380 + endSide, 14.5, brEndY * 0.78, 10.5, 2);
    rockAbut.translate(cx + endSide * 66.5, brEndY * 0.48, brZ);
    rockParts.push(rockAbut);
    // Approach timber walkway deck anchoring bridge head solidly onto the rock abutment
    addBoxPart(bridgeWoodParts, 16.0, 0.34, 2.6, cx + endSide * 66.0, brEndY, brZ);
    // Heavy stone-and-timber abutment pier foundation down to ground
    const pierH = Math.max(6.0, brEndY - groundAtEnd + 1.2);
    addBoxPart(rockParts, 4.6, pierH, 4.2, pylonX, brEndY - pierH * 0.5, brZ);
    // Twin Timber-and-Steel Cable Pylons (7.5m tall above deck) + upper & lower cross-girders
    const pylonTopY = brEndY + 7.2;
    for (const sz of [-1.42, 1.42]) {
      addCylPart(bridgeWoodParts, 0.24, 0.30, 7.6, 8, pylonX, brEndY + 3.6, brZ + sz);
      // Steel cable saddle bracket on pylon top
      addBoxPart(bridgeCableParts, 0.55, 0.35, 0.55, pylonX, pylonTopY + 0.15, brZ + sz);
      // Tensioned backstay anchor cable plunging diagonally into rock anchor block on cliff
      const anchorX = cliffX + endSide * 3.5;
      const anchorY = brEndY + 0.35;
      bridgeCableParts.push(
        new THREE.TubeGeometry(
          new THREE.LineCurve3(
            new THREE.Vector3(pylonX, pylonTopY, brZ + sz),
            new THREE.Vector3(anchorX, anchorY, brZ + sz * 1.15)
          ),
          2,
          0.085,
          6,
          false
        )
      );
      addBoxPart(rockParts, 1.8, 1.4, 1.4, anchorX, anchorY, brZ + sz * 1.15);
    }
    // Pylon portal crossbeams
    addBoxPart(bridgeWoodParts, 0.32, 0.38, 3.4, pylonX, pylonTopY - 0.35, brZ);
    addBoxPart(bridgeCableParts, 0.24, 0.24, 3.2, pylonX, brEndY + 4.4, brZ);
  }
  const cableMat = new THREE.MeshStandardMaterial({ color: '#475059', metalness: 0.72, roughness: 0.38 });
  ctx.extraMaterials.push(cableMat);

  // 3. 96 Wet Jungle Palms (curved arching fronds, strictly excluded from gorge stream, plunge pool & bridge corridor — HV09-3!)
  const palmParts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.14, 0.24, 6.2, 6)];
  palmParts[0].translate(0, 3.1, 0);
  for (let f = 0; f < 9; f++) {
    const frond = new THREE.PlaneGeometry(0.68, 3.1, 1, 6);
    const fPos = frond.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const t = (fPos.getY(vi) + 1.55) / 3.1; // 0..1 from stem to tip
      const droop = -t * t * 1.15;
      const taper = Math.sin(Math.max(0.05, t) * Math.PI * 0.92);
      fPos.setX(vi, fPos.getX(vi) * (0.28 + 0.72 * taper));
      fPos.setY(vi, t * 2.8);
      fPos.setZ(vi, droop);
    }
    frond.computeVertexNormals();
    frond.rotateX(0.58 + (f % 2) * 0.16);
    frond.rotateY((f / 9) * Math.PI * 2);
    frond.translate(0, 6.1, 0);
    palmParts.push(frond);
  }
  const palmMat = new THREE.MeshStandardMaterial({ color: '#215434', roughness: 0.26, side: THREE.DoubleSide });
  const gorgeMistAlpha = createSoftRadialAlphaTexture(ctx, 64);
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    alphaMap: gorgeMistAlpha,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  // FIX HV09-4: Soft Fresnel-faded volumetric storm light shafts (no hard cylinder borders!)
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        float vFade = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float edge = pow(abs(dot(normalize(vNorm), normalize(vView))), 1.75);
        gl_FragColor = vec4(0.68, 0.80, 1.0, vFade * edge * 0.24);
      }
    `
  });
  ctx.extraMaterials.push(palmMat, mistMat, shaftMat);

  // FIX HV09-4: Iconic Trường Sơn 105mm Artillery Hauling Vignette on wet right gorge incline (ref 13_stormy_rain_jungle.jpg)
  const artRockParts: THREE.BufferGeometry[] = [];
  const artBronzeParts: THREE.BufferGeometry[] = [];
  const artX = cx + 26;
  const artZ = cz + 6;
  const artBaseY = ctx.getHeight(artX, artZ);
  // Wet stepped stone incline slope
  for (let st = 0; st < 5; st++) {
    addBoxPart(artRockParts, 7.2, 0.8 + st * 0.65, 2.4, artX, artBaseY + (0.8 + st * 0.65) * 0.5 - 0.3, artZ - st * 1.9);
  }
  const gunY = artBaseY + 2.5;
  const gunZ = artZ - 3.6;
  // 105mm field howitzer carriage, twin spoked wheels, gun shield & inclined barrel
  addCylPart(artBronzeParts, 0.14, 0.20, 4.4, 8, artX, gunY + 1.15, gunZ - 0.8, 1.25, 0);
  addBoxPart(artBronzeParts, 2.2, 1.15, 0.16, artX, gunY + 0.95, gunZ - 0.2, 0, -0.25, 0);
  for (const side of [-1, 1]) {
    const wheel = new THREE.TorusGeometry(0.68, 0.11, 6, 12);
    wheel.rotateY(Math.PI * 0.5);
    wheel.translate(artX + side * 1.15, gunY + 0.68, gunZ);
    artBronzeParts.push(wheel);
    // Split trail legs
    addCylPart(artBronzeParts, 0.08, 0.10, 2.8, 6, artX + side * 0.52, gunY + 0.35, gunZ + 1.2, 1.32, side * 0.22);
    // Haul ropes & 2 straining soldiers leaning uphill on each side
    for (let s = 0; s < 2; s++) {
      const sx = artX + side * (1.55 + s * 0.45);
      const sz = gunZ - 2.1 - s * 1.75;
      const sy = gunY + 0.55 + s * 0.55;
      addCylPart(artBronzeParts, 0.16, 0.22, 1.05, 6, sx, sy + 0.72, sz, -0.35, 0);
      addCylPart(artBronzeParts, 0.09, 0.11, 0.75, 5, sx - 0.12, sy + 0.28, sz + 0.2, 0.22, 0);
      addCylPart(artBronzeParts, 0.09, 0.11, 0.75, 5, sx + 0.12, sy + 0.28, sz - 0.15, -0.25, 0);
      const sh = new THREE.SphereGeometry(0.18, 6, 5);
      sh.translate(sx, sy + 1.38, sz - 0.22);
      artBronzeParts.push(sh);
    }
  }
  const wetSlopeMat = new THREE.MeshStandardMaterial({ color: '#3b433c', roughness: 0.34, metalness: 0.12 });
  ctx.extraMaterials.push(wetSlopeMat);
  group.add(
    new THREE.Mesh(mergeNormalized(artRockParts), wetSlopeMat),
    new THREE.Mesh(mergeNormalized(artBronzeParts), ctx.materials.bronzePatina ?? ctx.materials.bronze)
  );

  const palmInst = new THREE.InstancedMesh(mergeNormalized(palmParts), palmMat, 96);
  const mistInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(46, 12), mistMat, 28);
  const shaftInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 7.5, 65, 12, 1, true), shaftMat, 6);
  const rand = mulberry32(13013);
  for (let i = 0; i < 96; i++) {
    let px = cx + (rand() - 0.5) * 190;
    let pz = cz + (rand() - 0.5) * 185;
    // Strictly keep jungle palms out of gorge stream, plunge pool, suspension bridge, bunkers, medical tent & convoy shelter!
    for (let tries = 0; tries < 20; tries++) {
      const inStream = Math.abs(px - cx) < 13.5 && pz < cz + 26 && pz > cz - 76;
      const inPool = Math.hypot(px - cx, pz - (cz - 64)) < 31.5;
      const onBridge = Math.abs(pz - (cz - 10)) < 6.5 && Math.abs(px - cx) < 36;
      const nearBunker = Math.hypot(px - (cx - 12), pz - (cz + 38)) < 8.5 || Math.hypot(px - (cx - 20.5), pz - (cz + 33.5)) < 8.0;
      const nearMed = Math.hypot(px - (cx + 18), pz - (cz + 37.5)) < 9.5;
      const nearConvoy = Math.hypot(px - (cx - 26), pz - (cz + 18)) < 10.5 || Math.hypot(px - (cx + 16), pz - (cz - 36)) < 9.5;
      if (!inStream && !inPool && !onBridge && !nearBunker && !nearMed && !nearConvoy) break;
      px = cx + (rand() < 0.5 ? -1 : 1) * (24 + rand() * 72);
      pz = cz + (rand() - 0.5) * 180;
    }
    const py = ctx.getHeight(px, pz);
    const sc = 0.85 + rand() * 0.65;
    setInstanceMatrix(palmInst, i, px, py, pz, (rand() - 0.5) * 0.14, rand() * 6.28, 0.16, sc, sc, sc);
  }
  for (let i = 0; i < 28; i++) {
    setInstanceMatrix(mistInst, i, cx + (rand() - 0.5) * 140, 6 + rand() * 16, cz + (rand() - 0.5) * 150, 0, (rand() - 0.5) * 0.4, 0, 1, 1, 1);
  }
  for (let i = 0; i < 6; i++) {
    setInstanceMatrix(shaftInst, i, cx - 35 + i * 14, 34, cz - 42, 0.25, 0, -0.34, 1, 1, 1);
  }
  palmInst.instanceMatrix.needsUpdate = true;
  mistInst.instanceMatrix.needsUpdate = true;
  shaftInst.instanceMatrix.needsUpdate = true;

  // FIX HV09-2: Always-On Permanent Local Monsoon Rain Curtain (1,200 slanted 21° rain streaks) dedicated to TruongSonMonsoonJungleGorge (ref 13!)
  const localRainUni = { uTime: { value: 0.0 } };
  registerAnimUniform(ctx, animList, localRainUni);
  const localRainGeo = new THREE.PlaneGeometry(0.045, 2.15);
  const localRainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: localRainUni.uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 instPos = vec3(0.0);
        #ifdef USE_INSTANCING
        instPos = vec3(instanceMatrix[3].xyz);
        #endif
        float fall = mod(uTime * 16.5 + instPos.x * 0.43 + instPos.z * 0.37, 34.0);
        vec3 p = position;
        p.x += p.y * 0.38; // 21-degree monsoon wind slant
        vec3 worldP = instPos + p + vec3(0.0, 34.0 - fall, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        gl_FragColor = vec4(0.83, 0.93, 1.0, fade * 0.55);
      }
    `
  });
  ctx.extraMaterials.push(localRainMat);
  const localRainCount = 1200;
  const localRainInst = new THREE.InstancedMesh(localRainGeo, localRainMat, localRainCount);
  for (let i = 0; i < localRainCount; i++) {
    setInstanceMatrix(
      localRainInst,
      i,
      cx + (rand() - 0.5) * 160,
      poolBaseY,
      cz + (rand() - 0.5) * 160,
      0,
      rand() * Math.PI,
      0,
      1,
      1,
      1
    );
  }
  localRainInst.instanceMatrix.needsUpdate = true;

  // 4. MAJOR ĐƯỜNG TRƯỜNG SƠN (HỒ CHÍ MINH TRAIL) SCENIC OVERHAUL:
  //    (a) Winding red-basalt highland supply road (*Đường Trường Sơn*) with log retaining cribbing (*kè gỗ taluy*) & red-white mileposts (*cọc tiêu*)
  //    (b) 2 Camouflaged *Xe Tải Trường Sơn (Zil-157 / Giải Phóng)* covered in leafy jungle camouflage branches!
  //    (c) A-Frame Timber Bunker & Field Radio Comm Shelter (*Hầm Chữ A / Lán Trại Bộ Đội*) with oil-lamp glow & sandbags
  //    (d) Iconic Historical Signboard ("XẺ DỌC TRƯỜNG SƠN ĐI CỨU NƯỚC" + Cột Mốc Km0)
  //    (e) Giant Tropical Rainforest Ferns & Hanging Liana Vines draping across cliffs & road edges
  const trailColoredParts: THREE.BufferGeometry[] = [];
  const trailRoadPts: THREE.Vector3[] = [
    new THREE.Vector3(cx - 72, ctx.getHeight(cx - 72, cz + 68) + 0.25, cz + 68),
    new THREE.Vector3(cx - 46, ctx.getHeight(cx - 46, cz + 46) + 0.28, cz + 46),
    new THREE.Vector3(cx - 24, ctx.getHeight(cx - 24, cz + 26) + 0.30, cz + 26),
    new THREE.Vector3(cx + 6, ctx.getHeight(cx + 6, cz + 30) + 0.30, cz + 30),
    new THREE.Vector3(cx + 38, ctx.getHeight(cx + 38, cz + 20) + 0.32, cz + 20),
    new THREE.Vector3(cx + 66, ctx.getHeight(cx + 66, cz - 10) + 0.35, cz - 10)
  ];
  const trailCurve = new THREE.CatmullRomCurve3(trailRoadPts);
  const roadSamples = 36;
  const roadPoints = trailCurve.getSpacedPoints(roadSamples);
  for (let i = 0; i < roadSamples; i++) {
    const p0 = roadPoints[i];
    const p1 = roadPoints[i + 1];
    const mid = p0.clone().lerp(p1, 0.5);
    const segLen = p0.distanceTo(p1) + 0.65;
    const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    // Red-basalt highland dirt roadbed + dark muddy wheel ruts
    const slab = new THREE.BoxGeometry(6.8, 0.52, segLen);
    slab.rotateY(yaw);
    slab.translate(mid.x, mid.y - 0.12, mid.z);
    trailColoredParts.push(paintGeometryVertexColor(slab, i % 2 === 0 ? '#7e3c24' : '#73351f'));

    for (const rOff of [-1.45, 1.45]) {
      const rut = new THREE.BoxGeometry(0.95, 0.08, segLen);
      rut.translate(rOff, 0.16, 0);
      rut.rotateY(yaw);
      rut.translate(mid.x, mid.y, mid.z);
      trailColoredParts.push(paintGeometryVertexColor(rut, '#4d2515'));
    }

    // Wooden retaining cribbing logs (*kè gỗ taluy*) & white-red mileposts (*cọc tiêu Trường Sơn*) every 3 segments
    if (i % 3 === 0) {
      const perpX = Math.cos(yaw);
      const perpZ = -Math.sin(yaw);
      const postX = mid.x + perpX * 3.65;
      const postZ = mid.z + perpZ * 3.65;
      const postY = mid.y + 0.15;
      addCylPart(bridgeWoodParts, 0.11, 0.13, 1.85, 6, postX, postY - 0.35, postZ);
      trailColoredParts.push(
        paintGeometryVertexColor(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 6).translate(postX, postY + 0.55, postZ), '#f0efe8'),
        paintGeometryVertexColor(new THREE.CylinderGeometry(0.082, 0.082, 0.28, 6).translate(postX, postY + 0.88, postZ), '#c92a22')
      );
      // Horizontal retaining log braced on slope side
      const log = new THREE.CylinderGeometry(0.14, 0.16, 4.2, 6);
      log.rotateX(Math.PI * 0.5);
      log.rotateY(yaw);
      log.translate(postX, postY - 0.25, postZ);
      bridgeWoodParts.push(log);
    }
  }

  // 2 Camouflaged *Xe Tải Trường Sơn (Zil-157 / Giải Phóng)* Military Supply Trucks climbing the red-basalt trail!
  const truckTs = [0.34, 0.68];
  for (let ti = 0; ti < truckTs.length; ti++) {
    const tp = trailCurve.getPoint(truckTs[ti]);
    const tt = trailCurve.getTangent(truckTs[ti]).normalize();
    const tyaw = Math.atan2(tt.x, tt.z);
    const tParts: THREE.BufferGeometry[] = [];
    const olive = '#3c4f2e';
    const canvas = '#4e5b3a';
    const tire = '#1d2022';
    // Chassis, rounded engine hood, 7-slat radiator grille, armored bumper, blackout lights, side mirrors & hooped cargo bed
    tParts.push(
      paintGeometryVertexColor(new THREE.BoxGeometry(2.35, 0.45, 6.6).translate(0, 0.78, 0), '#2b3622'),
      paintGeometryVertexColor(new THREE.BoxGeometry(2.42, 0.26, 0.28).translate(0, 0.84, 3.24), '#222628'),
      paintGeometryVertexColor(new THREE.BoxGeometry(1.75, 1.05, 1.85).translate(0, 1.48, 2.15), olive),
      paintGeometryVertexColor(new THREE.BoxGeometry(2.22, 1.55, 1.55).translate(0, 1.78, 0.65), olive),
      paintGeometryVertexColor(new THREE.BoxGeometry(1.88, 0.58, 0.12).translate(0, 2.02, 1.42), '#98b4c2'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.06, 0.62, 0.14).translate(0, 2.02, 1.43), olive),
      paintGeometryVertexColor(new THREE.BoxGeometry(2.38, 1.85, 3.65).translate(0, 2.02, -1.55), canvas),
      paintGeometryVertexColor(new THREE.CylinderGeometry(1.18, 1.18, 3.65, 10, 1, false, 0, Math.PI).rotateZ(Math.PI * 0.5).rotateY(Math.PI * 0.5).translate(0, 2.88, -1.55), canvas)
    );
    // 7-slat radiator grille + hooded blackout headlights + cab door red star + side mirrors + wooden cargo slats
    for (let g = -3; g <= 3; g++) {
      tParts.push(paintGeometryVertexColor(new THREE.BoxGeometry(0.08, 0.74, 0.10).translate(g * 0.20, 1.48, 3.08), '#1c2219'));
    }
    for (const sx of [-1, 1]) {
      tParts.push(
        paintGeometryVertexColor(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 7).rotateX(Math.PI * 0.5).translate(sx * 0.88, 1.38, 3.06), '#2a3324'),
        paintGeometryVertexColor(new THREE.BoxGeometry(0.30, 0.14, 0.20).translate(sx * 0.88, 1.46, 3.12), olive),
        paintGeometryVertexColor(new THREE.BoxGeometry(0.42, 0.06, 0.06).translate(sx * 1.24, 1.98, 1.12), '#2b3236'),
        paintGeometryVertexColor(new THREE.BoxGeometry(0.10, 0.24, 0.16).translate(sx * 1.42, 2.02, 1.12), '#d0d6dc'),
        paintGeometryVertexColor(new THREE.BoxGeometry(0.32, 0.10, 0.75).translate(sx * 1.22, 0.82, 0.68), '#343a3e'),
        paintGeometryVertexColor(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8).rotateZ(Math.PI * 0.5).translate(sx * 1.12, 1.46, 0.65), '#c92a22'),
        // Wooden slatted lower cargo-bed side planks + canvas tie-down rope ribs + side jerrycan fuel tank & tool box
        paintGeometryVertexColor(new THREE.BoxGeometry(0.08, 0.42, 3.55).translate(sx * 1.21, 1.32, -1.55), '#5b4228'),
        paintGeometryVertexColor(new THREE.BoxGeometry(0.45, 0.36, 0.72).translate(sx * 0.96, 0.74, -0.15), '#2e3b23')
      );
      for (const ribZ of [-0.25, -1.15, -2.05, -2.95]) {
        tParts.push(
          paintGeometryVertexColor(new THREE.BoxGeometry(0.05, 1.55, 0.06).translate(sx * 1.21, 2.02, ribZ), '#353e28')
        );
      }
    }
    // Vertical exhaust pipe stack behind cab + under-chassis spare tire + front winch drum + windshield wipers + rear tail lamps & supply crates
    tParts.push(
      paintGeometryVertexColor(new THREE.CylinderGeometry(0.055, 0.065, 2.15, 6).translate(-1.16, 2.15, -0.05), '#262b2e'),
      paintGeometryVertexColor(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 7).rotateZ(Math.PI * 0.5).translate(0, 0.88, 3.38), '#2c3236'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.03, 0.34, 0.03).rotateZ(0.28).translate(-0.48, 2.02, 1.49), '#1b1f22'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.03, 0.34, 0.03).rotateZ(0.28).translate(0.48, 2.02, 1.49), '#1b1f22'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.18, 0.10, 0.06).translate(-0.98, 0.92, -3.35), '#d92820'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.18, 0.10, 0.06).translate(0.98, 0.92, -3.35), '#d92820'),
      paintGeometryVertexColor(new THREE.CylinderGeometry(0.50, 0.50, 0.30, 8).translate(0, 0.58, -3.15), tire),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.92, 0.68, 0.85).translate(-0.52, 1.45, -2.85), '#8c6b3f'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.88, 0.62, 0.82).translate(0.52, 1.42, -2.88), '#7a5c34')
    );
    // 6 Heavy off-road military tires (front axle + dual rear axles) with raised steel wheel hubcaps & lug rings
    for (const wz of [2.15, -1.05, -2.35]) {
      for (const wx of [-1.18, 1.18]) {
        tParts.push(
          paintGeometryVertexColor(new THREE.CylinderGeometry(0.54, 0.54, 0.34, 10).rotateZ(Math.PI * 0.5).translate(wx, 0.54, wz), tire),
          paintGeometryVertexColor(new THREE.CylinderGeometry(0.24, 0.24, 0.38, 8).rotateZ(Math.PI * 0.5).translate(wx, 0.54, wz), '#48523c')
        );
      }
    }
    // Iconic leafy jungle camouflage branches (*ngụy trang lá rừng Trường Sơn*) tied across cab roof & cargo hoops!
    for (let cf = 0; cf < 6; cf++) {
      const camLeaf = createSculptedRockGeometry(1420 + ti * 20 + cf, 0.82, 0.44, 0.92, 1);
      camLeaf.translate((cf % 2 === 0 ? -0.68 : 0.68), 3.35 + (cf % 3) * 0.22, 1.1 - cf * 0.78);
      tParts.push(paintGeometryVertexColor(camLeaf, cf % 2 === 0 ? '#2b5e29' : '#3d7832'));
    }
    for (const p of tParts) {
      p.rotateY(tyaw);
      p.translate(tp.x, tp.y + 0.15, tp.z);
      trailColoredParts.push(p);
    }
  }

  // A-Frame Timber Bunker & Field Comm Post (*Hầm Chữ A / Lán Trại Trường Sơn*) beside trail at (cx - 12, cz + 38)
  const bnkX = cx - 12.0;
  const bnkZ = cz + 38.0;
  const bnkY = ctx.getHeight(bnkX, bnkZ);
  for (let r = -3; r <= 3; r++) {
    const rz = bnkZ + r * 1.1;
    addCylPart(bridgeWoodParts, 0.14, 0.16, 4.4, 6, bnkX - 1.35, bnkY + 1.65, rz, 0, -0.58);
    addCylPart(bridgeWoodParts, 0.14, 0.16, 4.4, 6, bnkX + 1.35, bnkY + 1.65, rz, 0, 0.58);
  }
  const bnkRoof = createGableRoofGeometry(5.6, 8.0, 2.8, 0.25, 'z');
  bnkRoof.translate(bnkX, bnkY + 0.85, bnkZ);
  trailColoredParts.push(paintGeometryVertexColor(bnkRoof, '#5d6b34'));
  // Stacked sandbag parapet + olive ammo crates + slender radio whip antenna
  for (let sb = 0; sb < 10; sb++) {
    const bag = new THREE.SphereGeometry(0.42, 6, 5);
    bag.scale(1.4, 0.55, 0.85);
    bag.translate(bnkX - 2.4 + (sb % 5) * 1.2, bnkY + 0.35 + Math.floor(sb / 5) * 0.42, bnkZ - 4.4);
    trailColoredParts.push(paintGeometryVertexColor(bag, '#9b8d68'));
  }
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.BoxGeometry(1.1, 0.65, 0.72).translate(bnkX + 2.8, bnkY + 0.35, bnkZ - 2.4), '#3d4c2c'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.025, 0.035, 6.2, 5).translate(bnkX + 2.4, bnkY + 3.2, bnkZ + 2.5), '#3c4248'),
    // Woven bamboo bunker blast-screen & suspended glowing hurricane oil lamp (*đèn bão Trường Sơn*)
    paintGeometryVertexColor(new THREE.BoxGeometry(1.85, 1.45, 0.12).translate(bnkX + 0.55, bnkY + 0.75, bnkZ - 3.95), '#9b7b46'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 7).translate(bnkX, bnkY + 1.82, bnkZ - 3.55), '#ffae38'),
    // Smokeless Bếp Hoàng Cầm field stove mound + copper kettle + radiating smoke-dissipation earth trenches + field radio transceiver + 3 steel fuel drums
    paintGeometryVertexColor(new THREE.BoxGeometry(1.35, 0.55, 1.65).translate(bnkX - 3.4, bnkY + 0.28, bnkZ - 1.2), '#695238'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.24, 0.28, 0.28, 8).translate(bnkX - 3.4, bnkY + 0.68, bnkZ - 1.2), '#2e3236'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.95, 0.18, 0.26).rotateY(0.42).translate(bnkX - 4.4, bnkY + 0.10, bnkZ - 1.6), '#543f29'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.95, 0.18, 0.26).rotateY(-0.38).translate(bnkX - 4.3, bnkY + 0.10, bnkZ - 0.7), '#543f29'),
    paintGeometryVertexColor(new THREE.BoxGeometry(0.48, 0.34, 0.36).translate(bnkX + 2.8, bnkY + 0.84, bnkZ - 2.4), '#2d3824'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 6).rotateX(Math.PI * 0.5).translate(bnkX + 2.68, bnkY + 0.86, bnkZ - 2.2), '#cfd4da'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.36, 0.36, 0.92, 8).translate(bnkX + 3.2, bnkY + 0.46, bnkZ - 0.8), '#3b522c'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.36, 0.36, 0.92, 8).translate(bnkX + 3.95, bnkY + 0.46, bnkZ - 1.1), '#445a30'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.36, 0.36, 0.92, 8).translate(bnkX + 3.5, bnkY + 0.46, bnkZ - 1.85), '#2e4226'),
    // Iconic Trường Sơn Defused Bomb-Casing Air-Raid Warning Gong (*Kẻng Báo Động Vỏ Bom*) on Timber Tripod + Stacked Rice Sacks (*Bao Gạo Quân Lương*)
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.045, 0.055, 2.35, 5).rotateZ(0.24).translate(bnkX - 2.9, bnkY + 1.12, bnkZ - 3.2), '#5c4328'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.045, 0.055, 2.35, 5).rotateZ(-0.24).translate(bnkX - 2.0, bnkY + 1.12, bnkZ - 3.2), '#5c4328'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.14, 0.11, 0.95, 7).translate(bnkX - 2.45, bnkY + 1.35, bnkZ - 3.2), '#3b4238'),
    paintGeometryVertexColor(new THREE.SphereGeometry(0.38, 6, 4).scale(1.3, 0.55, 0.85).translate(bnkX + 1.2, bnkY + 0.35, bnkZ - 1.8), '#d6c8a4'),
    paintGeometryVertexColor(new THREE.SphereGeometry(0.38, 6, 4).scale(1.3, 0.55, 0.85).translate(bnkX + 1.2, bnkY + 0.72, bnkZ - 1.8), '#dfd2b0')
  );
  // 3 Marching Trường Sơn Liberation Soldiers (with pith helmets *mũ cối*, backpacks *ba lô con cóc* & walking sticks) crossing the bamboo suspension bridge!
  for (const sFrac of [0.35, 0.50, 0.65]) {
    const sx = cx - 58 + sFrac * brSpan;
    const sy = brEndY - 1.4 * Math.sin(sFrac * Math.PI) + 0.08;
    trailColoredParts.push(
      paintGeometryVertexColor(new THREE.CylinderGeometry(0.16, 0.20, 1.18, 6).translate(sx, sy + 0.62, brZ), '#3b522e'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.28, 0.44, 0.32).translate(sx - 0.18, sy + 0.82, brZ), '#4d5d36'),
      paintGeometryVertexColor(new THREE.SphereGeometry(0.13, 6, 4).translate(sx, sy + 1.32, brZ), '#d8b094'),
      paintGeometryVertexColor(new THREE.ConeGeometry(0.24, 0.15, 7).translate(sx, sy + 1.45, brZ), '#4e6338'),
      paintGeometryVertexColor(new THREE.CylinderGeometry(0.02, 0.02, 1.32, 4).rotateZ(-0.18).translate(sx + 0.22, sy + 0.66, brZ + 0.22), '#6e4e2e')
    );
  }

  // Iconic Trường Sơn Km0 Milestone & Historical Wooden Signboard + Pointed Directional Arrows
  const kmX = cx - 26.0;
  const kmZ = cz + 34.0;
  const kmY = ctx.getHeight(kmX, kmZ);
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.BoxGeometry(0.75, 1.65, 0.42).translate(kmX, kmY + 0.82, kmZ), '#f0eee6'),
    paintGeometryVertexColor(new THREE.BoxGeometry(0.77, 0.45, 0.44).translate(kmX, kmY + 1.52, kmZ), '#c82820'),
    // Pointed East/West Truong Son Trail route directional arrows
    paintGeometryVertexColor(new THREE.BoxGeometry(1.35, 0.26, 0.08).rotateY(0.18).translate(kmX + 0.68, kmY + 1.15, kmZ), '#f0eee6'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.35, 0.26, 0.08).rotateY(-0.22).translate(kmX - 0.68, kmY + 0.86, kmZ), '#c82820')
  );
  for (const sx of [-2.2, 2.2]) {
    addCylPart(bridgeWoodParts, 0.11, 0.13, 3.6, 6, kmX + 4.5 + sx, kmY + 1.8, kmZ + 0.4);
  }
  const tsSign = createSignagePlaqueMesh(
    { text: 'ĐƯỜNG TRƯỜNG SƠN', subText: 'XẺ DỌC TRƯỜNG SƠN ĐI CỨU NƯỚC', width: 4.8, height: 1.05, style: 'royal' },
    ctx
  );
  tsSign.position.set(kmX + 4.5, kmY + 3.1, kmZ + 0.4);
  group.add(tsSign);

  // Giant Tropical Rainforest Ferns & Hanging Liana Vines draping along wet Trường Sơn roadbanks & gorge cliffs
  for (let f = 0; f < 36; f++) {
    const ft = (f + 0.5) / 36;
    const fp = trailCurve.getPoint(ft);
    const side = f % 2 === 0 ? -1 : 1;
    const fx = fp.x + side * (4.6 + (f % 3) * 2.2);
    const fz = fp.z + (f % 2 === 0 ? 1.8 : -1.8);
    const fy = ctx.getHeight(fx, fz);
    for (let fr = 0; fr < 5; fr++) {
      const fa = (fr / 5) * Math.PI * 2 + f;
      const frond = new THREE.ConeGeometry(0.42, 2.1, 4);
      frond.scale(1.0, 1.0, 0.22);
      frond.rotateX(1.05);
      frond.rotateY(fa);
      frond.translate(fx + Math.sin(fa) * 0.72, fy + 0.58, fz + Math.cos(fa) * 0.72);
      trailColoredParts.push(paintGeometryVertexColor(frond, fr % 2 === 0 ? '#2b6a2e' : '#3e8438'));
    }
  }
  for (let v = 0; v < 12; v++) {
    const vx = cx - 44 + v * 8.0;
    const vz = cz - 28 + (v % 2 === 0 ? -1.4 : 1.4);
    const lCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(vx, brEndY + 1.2, vz),
      new THREE.Vector3(vx + (v % 2 === 0 ? 0.65 : -0.65), brEndY - 3.2, vz + 0.4),
      new THREE.Vector3(vx, brEndY - 7.8, vz - 0.3)
    ]);
    trailColoredParts.push(
      paintGeometryVertexColor(createSmoothTaperedTubeGeometry(lCurve, 8, 4, (t) => 0.08 * (1.0 - t * 0.55)), '#295726')
    );
  }

  // --- 200-Item Macro Visual QC & Expansion (159–172): Hẻm Núi Trường Sơn ---
  // 159: 3 Xe Đạp Thồ Trường Sơn reinforced pack-bicycles loaded with rice sacks & ammo crates
  for (let b = 0; b < 3; b++) {
    const bx = bnkX + 4.8 + b * 2.1;
    const bz = bnkZ + 2.2 + (b % 2) * 1.4;
    const by = ctx.getHeight(bx, bz);
    for (const wz of [-0.55, 0.55]) {
      const wheel = new THREE.TorusGeometry(0.36, 0.05, 5, 10);
      wheel.rotateY(Math.PI * 0.5);
      wheel.translate(bx, by + 0.36, bz + wz);
      trailColoredParts.push(paintGeometryVertexColor(wheel, '#1f2326'));
    }
    trailColoredParts.push(
      paintGeometryVertexColor(new THREE.BoxGeometry(0.18, 0.38, 1.35).translate(bx, by + 0.68, bz), '#3d4f2e'),
      paintGeometryVertexColor(new THREE.SphereGeometry(0.38, 6, 4).scale(1.4, 0.75, 1.1).translate(bx, by + 1.05, bz), '#d6c8a4')
    );
  }
  // 160 & 162 & 167: Lán Quân Y / Thông Tin camouflaged medical tent, ammo crates & bamboo lean-tos
  const medX = cx + 18.0;
  const medZ = cz + 40.0;
  const medY = ctx.getHeight(medX, medZ);
  for (const [ox, oz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) {
    addCylPart(bridgeWoodParts, 0.08, 0.09, 2.4, 5, medX + ox, medY + 1.2, medZ + oz);
  }
  const medRoof = createGableRoofGeometry(5.2, 4.0, 1.4, 0.14, 'x');
  medRoof.translate(medX, medY + 2.4, medZ);
  trailColoredParts.push(
    paintGeometryVertexColor(medRoof, '#4b5b34'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.1, 0.72, 0.82).translate(medX + 1.4, medY + 0.36, medZ + 2.4), '#d8dcd8'),
    paintGeometryVertexColor(new THREE.BoxGeometry(0.45, 0.12, 0.06).translate(medX + 1.4, medY + 0.42, medZ + 2.84), '#c92a22'),
    paintGeometryVertexColor(new THREE.BoxGeometry(0.12, 0.45, 0.06).translate(medX + 1.4, medY + 0.42, medZ + 2.84), '#c92a22')
  );
  // 161 & 169: Đường Lát Gỗ Chống Lầy corduroy log causeway & timber road guardrails
  for (let l = 0; l < 14; l++) {
    const lp = trailCurve.getPoint(0.74 + l * 0.016);
    const log = new THREE.CylinderGeometry(0.14, 0.15, 6.4, 5);
    log.rotateZ(Math.PI * 0.5);
    log.translate(lp.x, lp.y + 0.14, lp.z);
    bridgeWoodParts.push(log);
  }
  // 163: Bia Tưởng Niệm Thanh Niên Xung Phong stone memorial stele beside Km0
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.BoxGeometry(1.4, 2.4, 0.38).translate(kmX - 3.6, kmY + 1.2, kmZ), '#7b7c74'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.8, 0.45, 0.95).translate(kmX - 3.6, kmY + 0.22, kmZ), '#5a5b54')
  );
  // 164 & 165 & 171: 24 Mossy gorge boulders, cliff ferns & secondary side-rill waterfall
  for (let b = 0; b < 24; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    const bx = cx + side * (12 + (b % 4) * 3.5);
    const bz = cz - 62 + b * 3.2;
    const rock = createSculptedRockGeometry(1490 + b, 1.4 + (b % 3) * 0.5, 1.0, 1.3, 1);
    rock.translate(bx, poolBaseY + 0.35, bz);
    rockParts.push(rock);
  }
  const sideWf = new THREE.PlaneGeometry(3.8, 18.0, 1, 6);
  sideWf.rotateX(-0.22);
  sideWf.translate(cx + 32, 11.5, cz - 78.0);
  waterParts.push(sideWf);

  // --- Wave 2 Macro Visual QC & Expansion (359–372): Trường Sơn Ammo Depot, Rope Bridge & Milestones ---
  // 359: Kho Đạn Ngụy Trang (Camouflaged Ammo Depot dugout bunker & stacked ammo crates)
  const depX = bnkX - 8.5;
  const depZ = bnkZ - 4.5;
  const depY = ctx.getHeight(depX, depZ);
  addBoxPart(bridgeWoodParts, 5.4, 2.2, 3.8, depX, depY + 1.1, depZ);
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.BoxGeometry(6.4, 0.38, 4.6).translate(depX, depY + 2.35, depZ), '#3d522c'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.4, 0.72, 0.95).translate(depX + 3.4, depY + 0.36, depZ + 1.2), '#485a32'),
    paintGeometryVertexColor(new THREE.BoxGeometry(1.4, 0.72, 0.95).translate(depX + 3.4, depY + 1.08, depZ + 1.2), '#52643a')
  );
  // 360: Cầu Treo Dây Thép Phụ (Secondary Jungle Suspension Rope Bridge with 4 end posts grounded down into gorge banks!)
  const rbrX = cx + 16;
  const rbrZ = cz - 36;
  const rbrY = poolBaseY + 3.6;
  addBoxPart(bridgeWoodParts, 14.0, 0.16, 1.45, rbrX, rbrY, rbrZ);
  for (const sx of [-7.0, 7.0]) {
    addCylPart(bridgeWoodParts, 0.12, 0.16, 6.2, 5, rbrX + sx, rbrY - 1.1, rbrZ - 0.85);
    addCylPart(bridgeWoodParts, 0.12, 0.16, 6.2, 5, rbrX + sx, rbrY - 1.1, rbrZ + 0.85);
  }
  for (const sz of [-0.85, 0.85]) {
    addBoxPart(bridgeCableParts, 14.2, 0.06, 0.06, rbrX, rbrY + 1.45, rbrZ + sz);
  }
  // 361: 4 Authentic White-and-Red Trường Sơn Kilometer Milestone Markers (Km 0, Km 12, Km 25, Km 40)
  for (let m = 0; m < 4; m++) {
    const mp = trailCurve.getPoint(0.18 + m * 0.22);
    trailColoredParts.push(
      paintGeometryVertexColor(new THREE.BoxGeometry(0.48, 0.92, 0.24).translate(mp.x + 3.4, mp.y + 0.46, mp.z), '#e6e4dc'),
      paintGeometryVertexColor(new THREE.BoxGeometry(0.50, 0.26, 0.26).translate(mp.x + 3.4, mp.y + 0.98, mp.z), '#c42b22')
    );
  }
  // 362, 363, 364, 365: Trail signpost, Bếp Hoàng Cầm smokeless kitchen, 6 fuel drums & field radio antenna
  addCylPart(bridgeWoodParts, 0.08, 0.09, 2.8, 5, kmX + 3.2, kmY + 1.4, kmZ + 2.4);
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.BoxGeometry(1.4, 0.32, 0.08).translate(kmX + 3.8, kmY + 2.35, kmZ + 2.4), '#d8d2bc'),
    // 363: Bếp Hoàng Cầm earthen stove & smoke trench
    paintGeometryVertexColor(new THREE.BoxGeometry(2.8, 0.55, 1.4).translate(medX - 4.2, medY + 0.28, medZ + 2.6), '#6b533b'),
    paintGeometryVertexColor(new THREE.CylinderGeometry(0.32, 0.28, 0.36, 6).translate(medX - 4.8, medY + 0.72, medZ + 2.6), '#2a2c2e')
  );
  for (let d = 0; d < 6; d++) {
    trailColoredParts.push(
      paintGeometryVertexColor(
        new THREE.CylinderGeometry(0.28, 0.28, 0.85, 6).translate(depX - 3.6 + (d % 3) * 0.68, depY + 0.42, depZ + 2.8 + Math.floor(d / 3) * 0.68),
        '#465436'
      )
    );
  }
  addCylPart(bridgeCableParts, 0.04, 0.06, 7.6, 5, medX + 3.6, medY + 3.8, medZ - 1.8);
  // 366–372: 2 A-frame shelters, 2 hammock posts, submerged log ford, AA watch-pit, warning signs, timber retaining wall & 4 storm lanterns
  for (let s = 0; s < 2; s++) {
    const sp = trailCurve.getPoint(0.35 + s * 0.3);
    addBoxPart(bridgeWoodParts, 2.2, 1.5, 2.4, sp.x - 4.4, sp.y + 0.75, sp.z, 0, 0, 0.25);
    addCylPart(bridgeWoodParts, 0.07, 0.08, 2.2, 5, medX - 4.2 + s * 2.8, medY + 1.1, medZ - 3.2);
  }
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.BoxGeometry(2.6, 0.16, 0.85).translate(medX - 2.8, medY + 0.95, medZ - 3.2), '#4e5d38')
  );
  addBoxPart(bridgeWoodParts, 6.2, 0.18, 2.6, cx - 2.0, poolBaseY + 0.12, cz - 14.0);
  addCylPart(rockParts, 2.8, 3.2, 0.85, 6, depX - 6.0, depY + 0.42, depZ - 6.0);
  for (let k = 0; k < 4; k++) {
    const lp = trailCurve.getPoint(0.68 + k * 0.06);
    addBoxPart(bridgeWoodParts, 4.8, 1.1, 0.35, lp.x - 3.8, lp.y + 0.55, lp.z);
    addCylPart(bridgeWoodParts, 0.04, 0.05, 1.25, 4, lp.x + 2.8, lp.y + 0.62, lp.z);
    trailColoredParts.push(
      paintGeometryVertexColor(new THREE.ConeGeometry(0.14, 0.28, 5).translate(lp.x + 2.8, lp.y + 1.25, lp.z), '#ffaa44')
    );
  }
  addCylPart(bridgeWoodParts, 0.04, 0.05, 1.25, 4, kmX + 5.2, kmY + 0.62, kmZ - 2.2);
  trailColoredParts.push(
    paintGeometryVertexColor(new THREE.ConeGeometry(0.35, 0.55, 3).translate(kmX + 5.2, kmY + 1.4, kmZ - 2.2), '#c42b22')
  );

  const trailMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8
  });
  ctx.extraMaterials.push(trailMat);

  // --- Wave 3 Macro Visual QC & Expansion (715–743): Convoy Truck Shelter, Field Hospital Dugout & Bamboo Bridges ---
  const w3TsWood: THREE.BufferGeometry[] = [];
  const w3TsRock: THREE.BufferGeometry[] = [];
  const w3TsCable: THREE.BufferGeometry[] = [];
  const w3TsColored: THREE.BufferGeometry[] = [];
  const pushTsColorBox = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string, ry = 0, rx = 0, rz = 0): void => {
    w3TsColored.push(paintGeometryVertexColor(transformGeometryXYZ(new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx, rz), hex));
  };
  const pushTsColorCyl = (rt: number, rb: number, h: number, segs: number, x: number, y: number, z: number, hex: string, rx = 0, rz = 0): void => {
    w3TsColored.push(paintGeometryVertexColor(transformGeometryXYZ(new THREE.CylinderGeometry(rt, rb, h, segs), x, y, z, 0, rx, rz), hex));
  };
  // 715–717: Trường Sơn truck convoy shelter, Zil-130 supply truck silhouette & spare-tire rack (grounded on deep stone-and-earth plinth!)
  const cvP = trailCurve.getPoint(0.52);
  const cvX = cvP.x - 6.8;
  const cvZ = cvP.z + 2.2;
  const cvY = Math.max(ctx.getHeight(cvX, cvZ), ctx.getHeight(cvX - 3.4, cvZ), ctx.getHeight(cvX + 3.4, cvZ));
  addW3Plinth(w3TsRock, 8.4, 5.8, cvY + 0.12, cvY, cvX, cvZ);
  for (const [ox, oz] of [[-3.4, -2.2], [3.4, -2.2], [-3.4, 2.2], [3.4, 2.2]]) {
    addW3GroundedCol(w3TsWood, 0.14, 0.16, cvY + 3.45, cvY + 0.12, 5, cvX + ox, cvZ + oz);
  }
  addBoxPart(w3TsWood, 7.6, 0.24, 5.2, cvX, cvY + 3.45, cvZ);
  pushTsColorBox(8.2, 0.28, 5.8, cvX, cvY + 3.7, cvZ, '#3c512b');
  // 716: Zil-130 supply truck inside convoy shelter
  pushTsColorBox(2.2, 1.45, 2.1, cvX - 1.6, cvY + 1.25, cvZ, '#4a5a34');
  pushTsColorBox(3.6, 1.85, 2.25, cvX + 1.2, cvY + 1.55, cvZ, '#56643c');
  for (const wxOff of [-2.1, 0.6, 2.1]) {
    pushTsColorCyl(0.45, 0.45, 0.26, 6, cvX + wxOff, cvY + 0.45, cvZ - 1.12, '#222424', Math.PI * 0.5, 0);
    pushTsColorCyl(0.45, 0.45, 0.26, 6, cvX + wxOff, cvY + 0.45, cvZ + 1.12, '#222424', Math.PI * 0.5, 0);
  }
  // 717: Spare-tire & maintenance rack
  addBoxPart(w3TsWood, 2.2, 1.1, 0.65, cvX + 5.2, cvY + 0.55, cvZ);
  pushTsColorCyl(0.42, 0.42, 0.26, 6, cvX + 5.2, cvY + 0.45, cvZ + 0.48, '#242626', Math.PI * 0.5, 0);
  // 718–721, 730, 732, 741: Field hospital dugout annex, bamboo triage beds, red-cross chest, surgical lantern gallows, smoke-diffusion flue, rain-catcher & radio desk
  const medAnnexY = Math.max(medY, ctx.getHeight(medX, medZ - 5.2));
  addW3Plinth(w3TsRock, 5.0, 4.0, medAnnexY + 0.12, medAnnexY, medX, medZ - 5.2);
  addBoxPart(w3TsWood, 4.4, 2.0, 3.4, medX, medAnnexY + 1.12, medZ - 5.2);
  pushTsColorBox(5.2, 0.35, 4.2, medX, medAnnexY + 2.25, medZ - 5.2, '#415430');
  for (const bxOff of [-1.2, 1.2]) addBoxPart(w3TsWood, 0.85, 0.52, 2.1, medX + bxOff, medY + 0.26, medZ + 1.4);
  pushTsColorBox(0.95, 0.62, 0.65, medX + 2.8, medY + 0.31, medZ + 1.2, '#e2e0d6');
  pushTsColorBox(0.42, 0.14, 0.68, medX + 2.8, medY + 0.36, medZ + 1.2, '#c82820');
  addW3GroundedPost(w3TsWood, 0.08, 0.08, medY + 2.6, medY, medX - 2.6, medZ + 2.4);
  addBoxPart(w3TsWood, 0.85, 0.08, 0.08, medX - 2.2, medY + 2.55, medZ + 2.4);
  pushTsColorCyl(0.14, 0.16, 0.32, 5, medX - 1.85, medY + 2.32, medZ + 2.4, '#ffaa44');
  pushTsColorBox(4.8, 0.35, 0.65, medX - 7.8, medY + 0.18, medZ + 2.6, '#5c4632');
  for (const [ox, oz] of [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]]) {
    addW3GroundedCol(w3TsWood, 0.06, 0.07, medY + 1.85, medY, 4, medX + 4.4 + ox, medZ + 2.4 + oz);
  }
  pushTsColorBox(2.2, 0.12, 1.8, medX + 4.4, medY + 1.85, medZ + 2.4, '#4c5e36', 0, 0.22, 0);
  addCylPart(w3TsWood, 0.38, 0.42, 0.85, 6, medX + 4.4, medY + 0.42, medZ + 3.4);
  addBoxPart(w3TsWood, 1.4, 0.82, 0.85, medX + 3.6, medY + 0.41, medZ - 0.5);
  pushTsColorBox(0.55, 0.42, 0.38, medX + 3.6, medY + 1.02, medZ - 0.5, '#3b4534');
  // 722–723: Upper gorge lashed-bamboo monkey bridge & lower stream stepping-log bridge (centered across gorgeStream x=cx and grounded into stream bed!)
  const mbX = cx;
  const mbZ = cz - 20;
  const mbY = poolBaseY + 1.85;
  addBoxPart(w3TsWood, 16.4, 0.18, 0.48, mbX, mbY, mbZ);
  addBoxPart(w3TsWood, 16.4, 0.08, 0.08, mbX, mbY + 1.05, mbZ + 0.35);
  for (const sx of [-7.6, -3.8, 0, 3.8, 7.6]) {
    addW3GroundedCol(w3TsWood, 0.07, 0.09, mbY + 1.1, poolBaseY - 0.6, 5, mbX + sx, mbZ + 0.35);
    addW3GroundedCol(w3TsWood, 0.07, 0.09, mbY, poolBaseY - 0.6, 5, mbX + sx, mbZ - 0.35);
  }
  addBoxPart(w3TsWood, 16.0, 0.24, 1.1, cx, poolBaseY + 0.52, cz - 16.0);
  for (const sx of [-7.2, -2.4, 2.4, 7.2]) {
    addW3GroundedCol(w3TsWood, 0.10, 0.12, poolBaseY + 0.52, poolBaseY - 0.6, 5, cx + sx, cz - 16.0);
  }
  // 724–729, 731, 733–740, 742–743: 4 milestone cairns, road-roller/tool rack, fuel hand-pump, jungle tree-blind, crater planks, bicycle repair bench, wire-spool cart, cliff ammo stack, TNXP incense shelf, wheel-track rut-boards, bridge anchor logs, canteen rest-rack, AA rangefinder tripod, fingerpost cluster, bamboo fish-weir, culvert logs & 6 white-painted night-convoy guide rocks
  for (let c = 0; c < 4; c++) {
    const cp = trailCurve.getPoint(0.12 + c * 0.24);
    addConePart(w3TsRock, 0.65, 1.05, 5, cp.x - 3.6, cp.y + 0.52, cp.z);
  }
  const rrP = trailCurve.getPoint(0.28);
  addCylPart(w3TsRock, 0.52, 0.52, 1.45, 6, rrP.x + 4.2, rrP.y + 0.52, rrP.z, Math.PI * 0.5, 0);
  addBoxPart(w3TsWood, 1.8, 0.12, 1.55, rrP.x + 4.2, rrP.y + 0.58, rrP.z);
  pushTsColorBox(0.85, 1.25, 0.65, depX - 1.2, depY + 0.62, depZ + 3.4, '#445234');
  // 727: Jungle observation tree-blind
  const tbX = cx + 26;
  const tbZ = cz - 18;
  const tbY = ctx.getHeight(tbX, tbZ);
  for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    addW3GroundedCol(w3TsWood, 0.09, 0.11, tbY + 4.2, tbY, 5, tbX + ox, tbZ + oz);
  }
  addBoxPart(w3TsWood, 2.6, 0.22, 2.6, tbX, tbY + 3.4, tbZ);
  pushTsColorBox(3.2, 0.25, 3.2, tbX, tbY + 4.3, tbZ, '#3a4f28');
  const crP = trailCurve.getPoint(0.44);
  addBoxPart(w3TsWood, 4.4, 0.14, 1.8, crP.x, crP.y + 0.08, crP.z);
  addBoxPart(w3TsWood, 1.9, 0.78, 0.85, kmX - 4.2, kmY + 0.39, kmZ + 2.4);
  addBoxPart(w3TsWood, 1.1, 0.55, 0.95, medX + 5.2, medY + 0.42, medZ - 2.2);
  pushTsColorBox(2.2, 1.15, 1.4, bnkX + 4.8, ctx.getHeight(bnkX + 4.8, bnkZ) + 0.58, bnkZ, '#4a5c32');
  addBoxPart(w3TsRock, 1.2, 0.48, 0.65, kmX, kmY + 0.24, kmZ + 1.4);
  const rtP = trailCurve.getPoint(0.62);
  addBoxPart(w3TsWood, 5.4, 0.10, 0.52, rtP.x - 0.8, rtP.y + 0.05, rtP.z);
  addBoxPart(w3TsWood, 5.4, 0.10, 0.52, rtP.x + 0.8, rtP.y + 0.05, rtP.z);
  for (const sx of [-8.2, 8.2]) addCylPart(w3TsWood, 0.24, 0.26, 2.8, 5, rbrX + sx, rbrY - 1.2, rbrZ, Math.PI * 0.5, 0);
  addBoxPart(w3TsWood, 2.2, 0.45, 0.55, kmX - 2.2, kmY + 0.22, kmZ - 3.2);
  addW3GroundedCol(w3TsCable, 0.05, 0.07, depY + 1.85, depY + 0.4, 5, depX - 6.0, depZ - 6.0);
  addW3GroundedPost(w3TsWood, 0.10, 0.10, kmY + 2.8, kmY, kmX + 4.2, kmZ - 3.6);
  pushTsColorBox(1.6, 0.28, 0.08, kmX + 4.8, kmY + 2.5, kmZ - 3.6, '#dfd8c0');
  pushTsColorBox(1.6, 0.28, 0.08, kmX + 3.6, kmY + 2.1, kmZ - 3.6, '#dfd8c0', 0.4);
  addBoxPart(w3TsWood, 3.6, 0.65, 0.14, cx + 3.2, poolBaseY + 0.25, cz - 12.5);
  addCylPart(w3TsWood, 0.26, 0.28, 3.8, 5, crP.x, crP.y - 0.15, crP.z + 3.5, 0, Math.PI * 0.5);
  for (let g = 0; g < 6; g++) {
    const gp = trailCurve.getPoint(0.15 + g * 0.14);
    pushTsColorBox(0.45, 0.38, 0.45, gp.x + 3.2, gp.y + 0.19, gp.z, '#eceae2');
  }

  addWave3Mesh(group, w3TsWood, ctx.materials.darkWood);
  addWave3Mesh(group, w3TsRock, wetKarstMat);
  addWave3Mesh(group, w3TsCable, cableMat);
  addWave3Mesh(group, w3TsColored, trailMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1116–1144): Fuel-Pipeline Pump Station, Bicycle-Pack Depot, Field Bakery & Binh Trạm Gate ---
  const w4TsWood: THREE.BufferGeometry[] = [];
  const w4TsRock: THREE.BufferGeometry[] = [];
  const w4TsCable: THREE.BufferGeometry[] = [];
  const w4TsColored: THREE.BufferGeometry[] = [];
  const pushW4TsBox = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string, ry = 0, rx = 0, rz = 0): void => {
    w4TsColored.push(paintGeometryVertexColor(transformGeometryXYZ(new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx, rz), hex));
  };
  // 1116 & 1117: Fuel-pipeline booster pump station (cx - 34, cz + 46) & elevated steel pipeline trestles
  const fpX = cx - 34;
  const fpZ = cz + 46;
  const fpY = Math.max(ctx.getHeight(fpX, fpZ), ctx.getHeight(fpX - 2, fpZ), ctx.getHeight(fpX + 2, fpZ));
  addW3Plinth(w4TsRock, 5.2, 4.0, fpY + 0.25, fpY, fpX, fpZ);
  for (const [ox, oz] of [[-2.0, -1.4], [2.0, -1.4], [-2.0, 1.4], [2.0, 1.4]]) addW3GroundedCol(w4TsWood, 0.10, 0.12, fpY + 2.65, fpY + 0.25, 5, fpX + ox, fpZ + oz);
  pushW4TsBox(5.6, 0.22, 4.4, fpX, fpY + 2.72, fpZ, '#4a5a34');
  addCylPart(w4TsCable, 0.32, 0.32, 1.8, 6, fpX, fpY + 0.85, fpZ, 0, Math.PI * 0.5);
  for (let t = 0; t < 3; t++) {
    const tx = fpX + 4.5 + t * 5.2;
    const ty = ctx.getHeight(tx, fpZ);
    addW3GroundedCol(w4TsWood, 0.08, 0.10, ty + 1.35, ty, 4, tx, fpZ);
  }
  addCylPart(w4TsCable, 0.12, 0.12, 16.0, 5, fpX + 9.5, fpY + 1.38, fpZ, 0, Math.PI * 0.5);
  // 1118–1125: Bicycle-pack depot (cx + 30, cz + 46), pontoon stack, field bakery, 5 telegraph poles, crater well, sapper tool-crib, poncho line & sign-tree
  const bpTsX = cx + 30;
  const bpTsZ = cz + 46;
  const bpTsY = Math.max(ctx.getHeight(bpTsX, bpTsZ), ctx.getHeight(bpTsX + 2, bpTsZ));
  addW3Plinth(w4TsRock, 5.4, 3.6, bpTsY + 0.22, bpTsY, bpTsX, bpTsZ);
  for (const [ox, oz] of [[-2.2, -1.3], [2.2, -1.3], [-2.2, 1.3], [2.2, 1.3]]) addW3GroundedCol(w4TsWood, 0.09, 0.11, bpTsY + 2.35, bpTsY + 0.22, 5, bpTsX + ox, bpTsZ + oz);
  pushW4TsBox(5.8, 0.20, 4.0, bpTsX, bpTsY + 2.42, bpTsZ, '#4e5d38', 0, 0.12, 0);
  for (let b = -1; b <= 1; b++) pushW4TsBox(1.4, 0.88, 0.52, bpTsX + b * 1.45, bpTsY + 0.68, bpTsZ, '#6e6448');
  for (let p = 0; p < 3; p++) addBoxPart(w4TsWood, 4.2, 0.48, 1.25, cx + 16, ctx.getHeight(cx + 16, cz + 26) + 0.24 + p * 0.5, cz + 26);
  const bkX = cx - 26;
  const bkZ = cz + 56;
  const bkY = ctx.getHeight(bkX, bkZ);
  addBoxPart(w4TsRock, 3.2, 1.65, 2.4, bkX, bkY + 0.82, bkZ);
  addCylPart(w4TsRock, 0.24, 0.30, 2.2, 5, bkX + 1.0, bkY + 1.85, bkZ);
  for (let p = 0; p < 5; p++) {
    const px = cx - 18 + p * 9.5;
    const pz = cz + 52;
    addW3GroundedCol(w4TsWood, 0.06, 0.08, ctx.getHeight(px, pz) + 4.4, ctx.getHeight(px, pz), 4, px, pz);
  }
  addCylPart(w4TsRock, 1.85, 2.15, 0.55, 6, fpX - 6.5, fpY + 0.28, fpZ + 4.0);
  addBoxPart(w4TsWood, 2.0, 1.25, 0.55, bpTsX - 4.8, bpTsY + 0.62, bpTsZ);
  for (const ox of [-1.8, 1.8]) addW3GroundedCol(w4TsWood, 0.06, 0.08, medY + 2.0, medY, 4, medX + 8.2 + ox, medZ);
  pushW4TsBox(3.2, 0.95, 0.08, medX + 8.2, medY + 1.45, medZ, '#4a5a34');
  addW3GroundedCol(w4TsWood, 0.09, 0.11, bpTsY + 3.2, bpTsY, 5, cx + 6, cz + 56);
  // 1126–1144: AA watch-tower (cx + 38, cz + 26), axle rack, log stockpile, mail-box, hammock canopy, depth-gauge, campfire, ammo pallet, drum bench, water trough, wheelbarrow, stretcher rack, air-raid gong, 6 guard-posts, culvert, battery crate, mud-grate, shrine & Binh Trạm gate
  const aaX = cx + 38;
  const aaZ = cz + 26;
  const aaY = Math.max(ctx.getHeight(aaX, aaZ), ctx.getHeight(aaX + 2, aaZ));
  for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) addW3GroundedCol(w4TsWood, 0.11, 0.13, aaY + 4.2, aaY, 5, aaX + ox, aaZ + oz);
  addBoxPart(w4TsWood, 3.4, 0.22, 3.4, aaX, aaY + 3.6, aaZ);
  pushW4TsBox(3.4, 0.72, 0.35, aaX, aaY + 4.05, aaZ + 1.55, '#8a7e5c');
  addBoxPart(w4TsWood, 2.2, 0.95, 0.75, fpX + 4.5, fpY + 0.48, fpZ + 5.2);
  addBoxPart(w4TsWood, 3.6, 0.78, 1.65, cx - 16, ctx.getHeight(cx - 16, cz + 58) + 0.39, cz + 58);
  addW3GroundedPost(w4TsWood, 0.09, 0.09, bpTsY + 1.45, bpTsY, cx + 10, cz + 54);
  pushW4TsBox(0.55, 0.42, 0.38, cx + 10, bpTsY + 1.45, cz + 54, '#4d6038');
  for (const [ox, oz] of [[-1.5, -1.0], [1.5, -1.0], [-1.5, 1.0], [1.5, 1.0]]) addW3GroundedCol(w4TsWood, 0.06, 0.07, medY + 2.1, medY, 4, medX + 9.0 + ox, medZ + 6.0 + oz);
  pushW4TsBox(3.4, 0.12, 2.4, medX + 9.0, medY + 2.12, medZ + 6.0, '#465632');
  addW3GroundedCol(w4TsWood, 0.06, 0.08, poolBaseY + 2.1, poolBaseY - 0.6, 4, cx + 8.5, cz + 4);
  addBoxPart(w4TsRock, 0.95, 0.35, 0.95, bkX + 4.2, bkY + 0.18, bkZ);
  pushW4TsBox(1.8, 0.85, 1.15, fpX - 4.8, fpY + 0.42, fpZ - 3.5, '#556338');
  addBoxPart(w4TsWood, 2.2, 0.14, 0.85, fpX + 4.8, fpY + 0.92, fpZ - 2.8);
  addBoxPart(w4TsWood, 2.6, 0.35, 0.42, medX + 6.5, medY + 0.85, medZ - 4.2);
  addBoxPart(w4TsWood, 1.35, 0.52, 0.68, cx - 8, ctx.getHeight(cx - 8, cz + 58) + 0.35, cz + 58);
  addBoxPart(w4TsWood, 2.1, 0.65, 0.72, medX - 4.8, medY + 0.32, medZ - 4.5);
  addW3GroundedCol(w4TsWood, 0.08, 0.10, aaY + 2.6, aaY, 5, aaX - 4.2, aaZ);
  for (let g = 0; g < 6; g++) pushW4TsBox(0.16, 0.95, 0.16, cx - 12 + g * 5.2, ctx.getHeight(cx - 12 + g * 5.2, cz + 62) + 0.48, cz + 62, '#e6e4dc');
  addBoxPart(w4TsWood, 3.8, 0.28, 2.2, cx + 4, ctx.getHeight(cx + 4, cz + 62) + 0.18, cz + 62);
  pushW4TsBox(0.95, 0.65, 0.62, bnkX + 4.8, bnkY + 0.32, bnkZ + 4.2, '#4d5d38');
  addBoxPart(w4TsWood, 2.2, 0.12, 1.25, medX, medY + 0.06, medZ + 3.4);
  addW3GroundedPost(w4TsWood, 0.22, 0.22, bpTsY + 1.35, bpTsY, cx - 4, cz + 54);
  for (const s of [-1, 1]) addW3GroundedCol(w4TsWood, 0.14, 0.18, ctx.getHeight(cx, cz + 66) + 4.2, ctx.getHeight(cx, cz + 66), 5, cx + s * 3.6, cz + 66);
  pushW4TsBox(8.2, 0.78, 0.26, cx, ctx.getHeight(cx, cz + 66) + 3.95, cz + 66, '#b82a20');

  addWave3Mesh(group, w4TsWood, ctx.materials.darkWood);
  addWave3Mesh(group, w4TsRock, wetKarstMat);
  addWave3Mesh(group, w4TsCable, cableMat);
  addWave3Mesh(group, w4TsColored, trailMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1516–1544): Radio-Relay Hut, TNXP Rest Shelter, Km-14 Milestone & Commemorative Arch ---
  const w5TsWood: THREE.BufferGeometry[] = [];
  const w5TsRock: THREE.BufferGeometry[] = [];
  const w5TsCable: THREE.BufferGeometry[] = [];
  const w5TsColored: THREE.BufferGeometry[] = [];
  const pushW5TsBox = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string, ry = 0, rx = 0, rz = 0): void => {
    w5TsColored.push(paintGeometryVertexColor(transformGeometryXYZ(new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx, rz), hex));
  };
  // 1516 & 1517: Radio-Relay Hut (cx - 42, cz + 36) & TNXP Road-Crew Rest Shelter (cx + 42, cz + 46)
  const rrX = cx - 42;
  const rrZ = cz + 36;
  const rrY = Math.max(ctx.getHeight(rrX, rrZ), ctx.getHeight(rrX - 2, rrZ));
  addW3Plinth(w5TsRock, 4.6, 3.6, rrY + 0.25, rrY, rrX, rrZ);
  for (const [ox, oz] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) addW3GroundedCol(w5TsWood, 0.09, 0.11, rrY + 2.55, rrY + 0.25, 5, rrX + ox, rrZ + oz);
  pushW5TsBox(5.0, 0.20, 4.0, rrX, rrY + 2.62, rrZ, '#4a5a34');
  addW3GroundedCol(w5TsCable, 0.04, 0.06, rrY + 5.8, rrY + 2.6, 4, rrX + 1.8, rrZ - 1.2);
  const tnX = cx + 42;
  const tnZ = cz + 46;
  const tnY = Math.max(ctx.getHeight(tnX, tnZ), ctx.getHeight(tnX + 2, tnZ));
  addW3Plinth(w5TsRock, 5.2, 3.8, tnY + 0.25, tnY, tnX, tnZ);
  for (const [ox, oz] of [[-2.0, -1.4], [2.0, -1.4], [-2.0, 1.4], [2.0, 1.4]]) addW3GroundedCol(w5TsWood, 0.09, 0.11, tnY + 2.55, tnY + 0.25, 5, tnX + ox, tnZ + oz);
  pushW5TsBox(5.6, 0.20, 4.2, tnX, tnY + 2.62, tnZ, '#4e5d38', 0, 0.12, 0);
  // 1518–1525: Pipeline valve manifold, spare-tire/jerrycan rack, rope-bridge anchor-crib, hospital sterilizer hearth, Km-14 milestone, sapper sandbag shield, bicycle cargo-frame rack & telegraph cable-spool horse
  addBoxPart(w5TsWood, 2.2, 0.85, 1.25, fpX + 6.5, fpY + 0.42, fpZ + 3.2);
  addCylPart(w5TsCable, 0.18, 0.18, 1.45, 5, fpX + 6.5, fpY + 1.05, fpZ + 3.2);
  pushW5TsBox(2.2, 1.05, 0.85, fpX - 5.2, fpY + 0.52, fpZ + 4.2, '#556338');
  addBoxPart(w5TsRock, 2.4, 1.15, 2.2, cx + 18, ctx.getHeight(cx + 18, cz + 18) + 0.58, cz + 18);
  addBoxPart(w5TsRock, 1.35, 0.72, 1.05, medX - 5.2, medY + 0.36, medZ + 3.2);
  pushW5TsBox(0.45, 1.25, 0.32, cx - 6.5, ctx.getHeight(cx - 6.5, cz + 64) + 0.62, cz + 64, '#e6e4dc');
  pushW5TsBox(0.48, 0.28, 0.34, cx - 6.5, ctx.getHeight(cx - 6.5, cz + 64) + 1.18, cz + 64, '#b82a20');
  pushW5TsBox(2.8, 1.15, 0.85, bpTsX - 8.2, bpTsY + 0.58, bpTsZ, '#8a7e5c');
  addBoxPart(w5TsWood, 2.2, 1.35, 0.65, bpTsX + 5.2, bpTsY + 0.68, bpTsZ);
  addBoxPart(w5TsWood, 1.85, 0.95, 0.78, rrX + 4.8, rrY + 0.48, rrZ);
  // 1526–1535: Corduroy repair deck, jungle observation blind, log rest-bench, bakery firewood stack, AA rangefinder tripod, cable-ferry winch, herb-drying frame, 4 red-lantern guide posts, gravel stockpile & ration-sack platform
  addBoxPart(w5TsWood, 4.8, 0.22, 3.2, cx - 10, ctx.getHeight(cx - 10, cz + 64) + 0.14, cz + 64);
  pushW5TsBox(2.8, 1.35, 2.2, rrX - 5.8, rrY + 0.68, rrZ + 4.2, '#4a5a34');
  addBoxPart(w5TsWood, 2.4, 0.48, 0.55, tnX, tnY + 0.24, tnZ + 3.8);
  addBoxPart(w5TsWood, 2.2, 0.85, 1.15, bkX - 4.2, bkY + 0.42, bkZ);
  addW3GroundedCol(w5TsWood, 0.06, 0.08, aaY + 1.55, aaY, 4, aaX + 4.5, aaZ);
  addW3GroundedCol(w5TsWood, 0.16, 0.20, poolBaseY + 1.65, poolBaseY - 0.5, 5, cx - 9.5, cz + 6);
  addBoxPart(w5TsWood, 2.0, 1.25, 0.48, medX + 5.2, medY + 0.62, medZ + 4.2);
  for (let rl = 0; rl < 4; rl++) {
    const rx = cx + 10 + rl * 6.5;
    const ry = ctx.getHeight(rx, cz + 66);
    addW3GroundedPost(w5TsWood, 0.12, 0.12, ry + 1.35, ry, rx, cz + 66);
    pushW5TsBox(0.24, 0.28, 0.24, rx, ry + 1.42, cz + 66, '#c82820');
  }
  addConePart(w5TsRock, 1.45, 0.95, 5, cx - 12, ctx.getHeight(cx - 12, cz + 60) + 0.48, cz + 60);
  addBoxPart(w5TsWood, 2.8, 0.42, 1.85, tnX - 5.2, tnY + 0.21, tnZ + 4.5);
  pushW5TsBox(2.2, 0.72, 1.35, tnX - 5.2, tnY + 0.78, tnZ + 4.5, '#c8b88c');
  // 1536–1544: Bamboo handrail, vehicle-inspection ramp, 3 campfire logs, air-raid trench entrance, rainwater gutter drum, red-star guideboard, semaphore stand, fallen-drivers stele & Đường Hồ Chí Minh outer southern arch
  addBoxPart(w5TsWood, 10.0, 0.14, 0.14, tnX + 5.2, tnY + 1.05, tnZ, Math.PI * 0.5);
  for (const s of [-1, 1]) addBoxPart(w5TsWood, 3.6, 0.52, 0.58, fpX + 8.5, fpY + 0.26, fpZ + 6.2 + s * 0.9, 0, 0, 0.18);
  for (let cl = 0; cl < 3; cl++) addCylPart(w5TsWood, 0.22, 0.22, 1.85, 5, bkX + 4.2 + (cl - 1) * 1.6, bkY + 0.22, bkZ + 2.8, 0, Math.PI * 0.5);
  pushW5TsBox(2.6, 1.45, 2.2, bnkX - 5.5, bnkY + 0.72, bnkZ + 5.2, '#625642');
  addCylPart(w5TsCable, 0.34, 0.34, 0.92, 6, fpX - 3.6, fpY + 0.46, fpZ + 2.6);
  addW3GroundedPost(w5TsWood, 0.10, 0.10, bpTsY + 2.25, bpTsY, cx + 14, cz + 62);
  pushW5TsBox(1.85, 0.85, 0.14, cx + 14, bpTsY + 1.95, cz + 62, '#b82a20');
  addBoxPart(w5TsWood, 1.35, 1.15, 0.42, aaX + 4.8, aaY + 0.58, aaZ + 3.8);
  addBoxPart(w5TsRock, 1.15, 1.85, 0.36, cx - 7.5, bpTsY + 0.92, cz + 56);
  const haTsY = ctx.getHeight(cx, cz + 72);
  for (const s of [-1, 1]) addW3GroundedCol(w5TsWood, 0.16, 0.20, haTsY + 4.4, haTsY, 5, cx + s * 4.2, cz + 72);
  pushW5TsBox(9.6, 0.92, 0.32, cx, haTsY + 4.15, cz + 72, '#b82a20');

  addWave3Mesh(group, w5TsWood, ctx.materials.darkWood);
  addWave3Mesh(group, w5TsRock, wetKarstMat);
  addWave3Mesh(group, w5TsCable, cableMat);
  addWave3Mesh(group, w5TsColored, trailMat);

  group.add(
    new THREE.Mesh(mergeNormalized(rockParts), wetKarstMat),
    new THREE.Mesh(mergeNormalized(waterParts), cascadeMat),
    new THREE.Mesh(mergeNormalized(foamParts), foamMat),
    new THREE.Mesh(mergeNormalized(bridgeWoodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bridgeCableParts), cableMat),
    new THREE.Mesh(mergeNormalized(trailColoredParts), trailMat),
    palmInst,
    mistInst,
    shaftInst,
    localRainInst
  );
  ctx.scene.add(group);
  return group;
}

function buildDienBienHighlandCitadelMacro(
  ctx: VietnamBuilderContext
): { group: THREE.Group; flareMat: THREE.MeshStandardMaterial } {
  // --- M14: DienBienHighlandCitadelMacro (-820, -520) ---
  const dbx = -820;
  const dbz = -520;
  ctx.exclusionCircles.push({ x: dbx, z: dbz + 35, r: 148 });
  const dbGroup = new THREE.Group();
  dbGroup.name = 'DienBienHighlandCitadelMacro';
  const rand = mulberry32(14014);

  const cragParts: THREE.BufferGeometry[] = [];
  const timberParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const metalParts: THREE.BufferGeometry[] = [];
  const tankParts: THREE.BufferGeometry[] = [];
  const craterParts: THREE.BufferGeometry[] = [];
  // FIX HV10-5 & HV10-1: Sharpen 14 Điện Biên circular ridge mountains into craggy tapered Northwest highland peaks + curved fortified crest rampart berm!
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + (i / 13) * Math.PI;
    const rad = 105 + (i % 3) * 28;
    const gx = dbx + Math.cos(a) * rad * 1.25;
    const gz = dbz - 20 + Math.sin(a) * rad * 0.82;
    const h = 42 + (i % 4) * 16;
    const rock = createSculptedRockGeometry(1400 + i, 24, h * 0.72, 22, 2);
    const rp = rock.attributes.position;
    for (let vi = 0; vi < rp.count; vi++) {
      const ry = rp.getY(vi);
      const tH = clamp01((ry + h * 0.72) / (h * 1.44));
      const pinch = Math.pow(1.0 - tH * 0.74, 0.85);
      const ridgeCrest = 1.0 + 0.16 * Math.abs(Math.sin(Math.atan2(rp.getZ(vi), rp.getX(vi)) * 3.0 + i));
      rp.setXYZ(vi, rp.getX(vi) * pinch * ridgeCrest, ry, rp.getZ(vi) * pinch * ridgeCrest);
    }
    rock.computeVertexNormals();
    rock.translate(gx, ctx.getHeight(gx, gz) + h * 0.28, gz);
    cragParts.push(rock);
  }
  // Curved fortified earthen hillside crest parapet wall with embrasures replacing ahistorical solid box (HV10-1!)
  for (let seg = 0; seg < 10; seg++) {
    const sa = -0.85 + (seg / 9) * 1.7;
    const rx = dbx + Math.sin(sa) * 38.0;
    const rz = dbz - 26.0 + Math.cos(sa) * 16.0;
    const ry = ctx.getHeight(rx, rz);
    addBoxPart(stoneParts, 7.6, 2.4, 1.35, rx, ry + 1.15, rz, -sa * 0.65);
    addBoxPart(stoneParts, 2.2, 0.85, 1.45, rx, ry + 2.65, rz, -sa * 0.65);
  }
  // FIX DBP-03 & HV10-4: Authentic A1/D1 timber command bunkers with recessed firing embrasures + flanking earth/sandbag revetment berms hugging Hầm De Castries!
  const hillY = ctx.getHeight(dbx, dbz + 20);
  const bunkerSlitParts: THREE.BufferGeometry[] = [];
  for (const [bx, bz] of [[-24, 6], [24, 6], [-12, 24], [12, 24]]) {
    const by = ctx.getHeight(dbx + bx, dbz + bz);
    addBoxPart(timberParts, 6.2, 3.5, 4.2, dbx + bx, by + 0.25, dbz + bz);
    addBoxPart(timberParts, 6.8, 0.55, 4.8, dbx + bx, by + 2.25, dbz + bz);
    // Dark recessed firing embrasure slit & doorway on each timber bunker
    addBoxPart(bunkerSlitParts, 2.6, 0.42, 0.22, dbx + bx, by + 1.48, dbz + bz + 2.08);
    addBoxPart(bunkerSlitParts, 1.15, 1.65, 0.22, dbx + bx, by + 0.82, dbz + bz - 2.08);
  }
  dbGroup.add(new THREE.Mesh(mergeNormalized(bunkerSlitParts), ctx.materials.darkVoid));

  // FIX DBP-02 & HV10-4: Authentic 20m-Long Low-Slung Sunken Corrugated Rusted-Steel Hầm De Castries with Flanking Protective Earth/Sandbag Berms
  const bunkerX = dbx - 6;
  const bunkerZ = dbz - 2;
  const bunkerY = ctx.getHeight(bunkerX, bunkerZ);
  for (const side of [-1, 1]) {
    addBoxPart(craterParts, 2.6, 2.1, 19.6, bunkerX + side * 4.55, bunkerY + 0.85, bunkerZ);
  }
  const archVault = new THREE.CylinderGeometry(3.85, 3.85, 20.0, 20, 1, false, 0, Math.PI);
  archVault.rotateZ(Math.PI * 0.5);
  archVault.rotateY(Math.PI * 0.5);
  archVault.translate(bunkerX, bunkerY - 1.15, bunkerZ);
  metalParts.push(archVault);
  // 22 external corrugated steel arch ribs along the 20m bunker vault
  for (let rb = 0; rb < 22; rb++) {
    const rz = bunkerZ - 9.6 + (rb / 21) * 19.2;
    const rib = new THREE.TorusGeometry(3.92, 0.085, 6, 18, Math.PI);
    rib.translate(bunkerX, bunkerY - 1.15, rz);
    metalParts.push(rib);
  }
  // Coiled barbed-wire entanglement loops flanking the bunker trench approach
  for (let bw = 0; bw < 10; bw++) {
    const wireLoop = new THREE.TorusGeometry(0.45, 0.03, 5, 12);
    wireLoop.rotateY(0.35);
    wireLoop.translate(bunkerX - 4.5 + bw * 0.95, bunkerY + 0.45, bunkerZ + 11.4);
    metalParts.push(wireLoop);
  }
  // Timber trench revetment doorway at +Z and -Z ends of the 20m bunker
  for (const side of [-1, 1]) {
    addBoxPart(timberParts, 1.45, 2.5, 0.45, bunkerX + side * 2.15, bunkerY + 1.15, bunkerZ + 10.05);
    addBoxPart(timberParts, 1.45, 2.5, 0.45, bunkerX + side * 2.15, bunkerY + 1.15, bunkerZ - 10.05);
  }
  addBoxPart(timberParts, 0.4, 2.4, 3.2, bunkerX - 1.5, bunkerY + 1.1, bunkerZ + 11.6);
  addBoxPart(timberParts, 0.4, 2.4, 3.2, bunkerX + 1.5, bunkerY + 1.1, bunkerZ + 11.6);
  // EXPANSION (ref 117_dien_bien_phu_ham_de_castries_ben_trong.jpg):
  // Walk-in Hầm Chỉ Huy De Castries interior floor deck, 4 compartment bulkheads with central passage, Mường Thanh campaign operations table, field radio sets & entrance relief stele wall
  addBoxPart(stoneParts, 6.8, 0.24, 19.2, bunkerX, bunkerY + 0.12, bunkerZ);
  for (const pzOff of [-4.8, 0.0, 4.8]) {
    addBoxPart(timberParts, 2.2, 2.15, 0.22, bunkerX - 2.1, bunkerY + 1.18, bunkerZ + pzOff);
    addBoxPart(timberParts, 2.2, 2.15, 0.22, bunkerX + 2.1, bunkerY + 1.18, bunkerZ + pzOff);
  }
  // Central Mường Thanh strategic campaign map table + 6 steel folding chairs + field radio & filing cabinets
  addBoxPart(timberParts, 1.85, 0.82, 3.4, bunkerX - 1.65, bunkerY + 0.52, bunkerZ - 2.4);
  for (const czOff of [-3.5, -2.4, -1.3]) {
    addBoxPart(metalParts, 0.48, 0.55, 0.48, bunkerX - 0.45, bunkerY + 0.38, bunkerZ + czOff);
    addBoxPart(metalParts, 0.48, 0.55, 0.48, bunkerX - 2.85, bunkerY + 0.38, bunkerZ + czOff);
  }
  addBoxPart(metalParts, 0.95, 1.35, 1.65, bunkerX + 2.25, bunkerY + 0.8, bunkerZ + 2.4); // radio & cipher transmitter rack
  addBoxPart(metalParts, 0.85, 1.45, 1.25, bunkerX + 2.25, bunkerY + 0.85, bunkerZ - 2.4); // steel operations filing cabinet
  // Monumental terracotta-stone Victory Relief Wall & Historical Stele beside the trench entrance (`HV-NEW-MB-10` — ref 117)
  addBoxPart(stoneParts, 5.4, 2.85, 0.65, bunkerX + 5.2, bunkerY + 1.42, bunkerZ + 11.2);
  timberParts.push(...createBasReliefPanelParts(bunkerX + 5.2, bunkerY + 1.55, bunkerZ + 11.58, 4.6, 1.95, 0, 'lich_su'));
  tagMotifIds(dbGroup, [
    'HV-I04', 'HV-NEW-MB-09', 'HV-NEW-MB-10', 'HV-NEW-MN-12'
  ]);

  // FIX DBP-01: Sculpted Tượng Đài Chiến Thắng Điện Biên Phủ seated on solid 6.8m granite/earth D1 hilltop retaining pedestal (ZERO 6.2m air gap!)
  const monX = dbx - 24;
  const monZ = dbz - 14;
  const monY = ctx.getHeight(monX, monZ) + 6.2;
  const bronzeStatueParts: THREE.BufferGeometry[] = [];
  addBoxPart(stoneParts, 12.0, 6.8, 12.0, monX, monY - 3.4, monZ);
  addBoxPart(stoneParts, 7.2, 1.4, 7.2, monX, monY + 0.7, monZ);
  addBoxPart(stoneParts, 5.4, 1.4, 5.4, monX, monY + 2.1, monZ);
  addBoxPart(stoneParts, 3.8, 1.6, 3.8, monX, monY + 3.6, monZ);
  const soldierSpecs: Array<[number, number, number, number, boolean]> = [
    [0.0, 0.0, 4.4, 0.0, false],
    [-1.05, 0.42, 4.0, -0.35, false],
    [1.05, 0.42, 3.9, 0.35, true]
  ];
  for (const [sx, sz, sh, syaw, hasChild] of soldierSpecs) {
    const baseY0 = monY + 4.4;
    // Twin striding trouser legs
    for (const ls of [-0.22, 0.22]) {
      addCylPart(bronzeStatueParts, 0.14, 0.17, sh * 0.46, 6, monX + sx + ls, baseY0 + sh * 0.23, monZ + sz + ls * 0.35, ls * 0.22, 0);
    }
    // Belted quilted tunic torso & broad shoulders
    addCylPart(bronzeStatueParts, 0.38, 0.30, sh * 0.36, 7, monX + sx, baseY0 + sh * 0.62, monZ + sz);
    addBoxPart(bronzeStatueParts, 0.92, 0.28, 0.42, monX + sx, baseY0 + sh * 0.76, monZ + sz, syaw);
    // Head + iconic pith helmet (*mũ cối*)
    const head = new THREE.SphereGeometry(0.24, 7, 5);
    head.translate(monX + sx, baseY0 + sh * 0.89, monZ + sz);
    const pith = new THREE.SphereGeometry(0.30, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
    pith.scale(1.1, 0.75, 1.15);
    pith.translate(monX + sx, baseY0 + sh * 0.93, monZ + sz);
    bronzeStatueParts.push(head, pith);
    // Raised victorious arm holding rifle / waving
    addCylPart(bronzeStatueParts, 0.09, 0.11, sh * 0.34, 5, monX + sx + 0.42, baseY0 + sh * 0.92, monZ + sz + 0.15, 0.18, -0.35);
    if (hasChild) {
      // Thai child seated high on right soldier's shoulder holding flowers
      addCylPart(bronzeStatueParts, 0.16, 0.19, 1.15, 6, monX + sx + 0.32, baseY0 + sh * 1.02, monZ + sz - 0.08);
      const cHead = new THREE.SphereGeometry(0.18, 6, 5);
      cHead.translate(monX + sx + 0.32, baseY0 + sh * 1.02 + 0.72, monZ + sz - 0.08);
      bronzeStatueParts.push(cHead);
    }
  }
  // Tall flagpole + sculpted 3D wind-rippled bronze victory flag (replacing flat box!)
  addCylPart(bronzeStatueParts, 0.06, 0.08, 6.2, 6, monX + 0.25, monY + 8.8, monZ - 0.1, 0, -0.12);
  const bronzeFlagGeo = new THREE.PlaneGeometry(2.6, 1.48, 10, 4);
  const bfp = bronzeFlagGeo.attributes.position;
  for (let vi = 0; vi < bfp.count; vi++) {
    const fx = bfp.getX(vi) + 1.3;
    bfp.setZ(vi, Math.sin(fx * 2.4) * 0.26 * (fx / 2.6));
  }
  bronzeFlagGeo.computeVertexNormals();
  bronzeFlagGeo.translate(monX + 1.55, monY + 10.9, monZ - 0.1);
  bronzeStatueParts.push(bronzeFlagGeo);
  dbGroup.add(new THREE.Mesh(mergeNormalized(bronzeStatueParts), ctx.materials.bronze));

  // FIX DBP-05: Authentic shorter 3.4m Victory Flagpole atop De Castries bunker roof (NOT oversized 7.5m!) + Heritage Preservation Stele beside trench (ref 81!)
  addCylPart(metalParts, 0.06, 0.08, 3.4, 7, bunkerX, bunkerY + 4.2, bunkerZ);
  const victoryFlag = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 0.42, showStar: true })
    : createWavingSilkFlagMaterial({ waveScale: 0.42, showStar: true });
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(victoryFlag.material);
  }
  ctx.foliageWindUniforms.push(victoryFlag.uniforms);
  const flagPlane = new THREE.PlaneGeometry(2.6, 1.65, 16, 8);
  flagPlane.translate(1.3, 0, 0);
  const vFlagMesh = new THREE.Mesh(flagPlane, victoryFlag.material);
  vFlagMesh.position.set(bunkerX, bunkerY + 5.1, bunkerZ);
  dbGroup.add(vFlagMesh);
  // Historic preservation stele plaque beside De Castries trench entrance
  addBoxPart(stoneParts, 1.45, 1.85, 0.28, bunkerX + 5.2, bunkerY + 0.92, bunkerZ + 11.2);
  addBoxPart(stoneParts, 1.72, 0.32, 0.65, bunkerX + 5.2, bunkerY + 0.16, bunkerZ + 11.2);

  // M14.2 Expanded 32m-Diameter Hố Bộc Phá Nghìn Cân Đồi A1 (A1 Sapper Blast Crater) + Zigzag Trench & Cây Đa Cụt
  const craterX = dbx + 22;
  const craterZ = dbz + 16;
  const craterY = ctx.getHeight(craterX, craterZ);
  const craterGeo = new THREE.ConeGeometry(15.5, 5.2, 22, 1, true);
  craterGeo.rotateX(Math.PI);
  craterGeo.translate(craterX, craterY - 2.3, craterZ);
  craterParts.push(craterGeo);
  const rimTorus = new THREE.TorusGeometry(15.8, 1.35, 8, 24);
  rimTorus.rotateX(Math.PI * 0.5);
  rimTorus.translate(craterX, craterY + 0.52, craterZ);
  craterParts.push(rimTorus);
  for (let tb = 0; tb < 14; tb++) {
    const tang = (tb / 14) * Math.PI * 2;
    const trad = 14.5 + (tb % 3) * 1.8;
    addBoxPart(
      timberParts,
      0.24,
      0.28,
      2.8,
      craterX + Math.cos(tang) * trad,
      craterY + 0.35,
      craterZ + Math.sin(tang) * trad,
      0.2,
      tang,
      0.35
    );
  }
  // 6-segment sunken zigzag timber communication trench (*hào giao thông*) & shattered Cây Đa Cụt
  for (let tr = 0; tr < 6; tr++) {
    const tx = dbx - 36 + tr * 11.5;
    const tz = dbz + 18 + (tr % 2 === 0 ? -3.2 : 3.2);
    const ty = ctx.getHeight(tx, tz);
    addBoxPart(timberParts, 11.8, 1.15, 0.24, tx, ty + 0.35, tz - 1.1, tr % 2 === 0 ? 0.32 : -0.32);
    addBoxPart(timberParts, 11.8, 1.15, 0.24, tx, ty + 0.35, tz + 1.1, tr % 2 === 0 ? 0.32 : -0.32);
  }
  // Shattered *Cây Đa Cụt* historic stump
  addCylPart(timberParts, 0.45, 0.78, 5.6, 8, dbx + 6, hillY + 2.4, dbz + 4);
  addCylPart(timberParts, 0.16, 0.32, 2.8, 6, dbx + 5.2, hillY + 5.2, dbz + 4.4, 0, -0.65);

  // M14.3 Sculpted Xác Xe Tăng Bazeille Đồi A1 (French M24 Chaffee Tank with angular hull, bogie wheels & damaged barrel)
  const tankX = dbx - 18;
  const tankZ = dbz + 20;
  const tankY = ctx.getHeight(tankX, tankZ);
  const m24Tank = createAngularTankParts(tankX, tankY, tankZ, -0.4, 1.05, 0.12);
  tankParts.push(...m24Tank.armorParts);
  metalParts.push(...m24Tank.darkParts);

  // M14.4 Trận Địa Pháo Cao Xạ Phòng Không (Anti-Aircraft Artillery Emplacement)
  const flakX = dbx + 24;
  const flakZ = dbz - 8;
  const flakY = ctx.getHeight(flakX, flakZ);
  addBoxPart(stoneParts, 5.2, 0.8, 5.2, flakX, flakY + 0.4, flakZ);
  addCylPart(metalParts, 0.6, 0.8, 1.2, 8, flakX, flakY + 1.2, flakZ);
  for (const bs of [-0.22, 0.22]) {
    addCylPart(metalParts, 0.06, 0.08, 4.5, 6, flakX + bs, flakY + 2.6, flakZ - 0.8, -0.78, 0);
  }
  addBoxPart(metalParts, 1.8, 1.2, 0.12, flakX, flakY + 2.1, flakZ + 0.2, -0.35, 0, 0);

  // FIX DBP-02 & DBP-03: Authentic Northwest red-basalt highland earth (#6b533e) & rusted corrugated steel (#6c5b48)!
  const cragMat = new THREE.MeshStandardMaterial({
    color: '#6b533e',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.90
  });
  const bagMat = new THREE.MeshStandardMaterial({ color: '#9a8262', roughness: 0.94 });
  const flareMat = new THREE.MeshStandardMaterial({
    color: '#ff3b2f',
    emissive: new THREE.Color('#ff3b2f'),
    emissiveIntensity: 1.0
  });
  flareMat.userData.noDedupe = true;
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#6c5b48',
    metalness: 0.35,
    roughness: 0.86
  });
  const tankMat = new THREE.MeshStandardMaterial({
    color: '#394634',
    roughness: 0.76,
    metalness: 0.25
  });
  // FIX DBP-04: Warm charred Northwest red-earth blast crater (#5c3d28 instead of pitch-black #221e1a)
  const craterMat = new THREE.MeshStandardMaterial({
    color: '#5c3d28',
    roughness: 0.95,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(cragMat, bagMat, flareMat, metalMat, tankMat, craterMat);

  // FIX HV10-2 & HV10-5: Rounded pillow-shaped burlap sandbags + volumetric crimson battlefield smoke plumes & 4 cobalt storm searchlights (ref 14!)
  const bagGeo = new THREE.SphereGeometry(0.28, 5, 3);
  bagGeo.scale(1.15, 0.42, 0.72);
  const bagInst = new THREE.InstancedMesh(bagGeo, bagMat, 420);
  for (let i = 0; i < 420; i++) {
    const pit = Math.floor(i / 105);
    const slot = i % 105;
    const layer = Math.floor(slot / 35);
    const col = slot % 35;
    const pitCx = dbx - 36 + pit * 24;
    const pitCz = dbz + 34 + (pit % 2) * 14;
    const ang = -1.1 + (col / 34) * 2.2;
    const sx = pitCx + Math.sin(ang) * 9.5;
    const sz = pitCz + Math.cos(ang) * 9.5;
    setInstanceMatrix(bagInst, i, sx, ctx.getHeight(sx, sz) + 0.14 + layer * 0.19, sz, 0, -ang + (rand() - 0.5) * 0.1, 0, 1, 1, 1);
  }
  bagInst.instanceMatrix.needsUpdate = true;

  const dbSmokeAlpha = createSoftRadialAlphaTexture(ctx, 64);
  const dbRedSmokeMat = new THREE.MeshBasicMaterial({
    color: '#ff244c',
    alphaMap: dbSmokeAlpha,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const dbBlueBeamMat = new THREE.MeshBasicMaterial({
    color: '#88c4ff',
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(dbRedSmokeMat, dbBlueBeamMat);
  const dbSmokeInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(22, 16), dbRedSmokeMat, 14);
  for (let i = 0; i < 14; i++) {
    const wing = i < 7 ? -1 : 1;
    const k = i % 7;
    const sx = dbx + wing * (18 + k * 5.2);
    const sz = dbz - 6 + (k % 3) * 10;
    const sy = ctx.getHeight(sx, sz) + 7.5 + (k % 4) * 3.8;
    setInstanceMatrix(dbSmokeInst, i, sx, sy, sz, 0, (k * 0.45) - 0.6, 0, 1, 1, 1);
  }
  dbSmokeInst.instanceMatrix.needsUpdate = true;
  const dbBeamInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 6.2, 58, 12, 1, true), dbBlueBeamMat, 4);
  for (let i = 0; i < 4; i++) {
    const bx = dbx - 24 + i * 16;
    setInstanceMatrix(dbBeamInst, i, bx, hillY + 26, dbz - 4, 0.18, 0, i < 2 ? -0.32 : 0.32, 1, 1, 1);
  }
  dbBeamInst.instanceMatrix.needsUpdate = true;

  const xBar1 = new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5);
  xBar1.rotateZ(0.58);
  const xBar2 = new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5);
  xBar2.rotateZ(-0.58);
  const xInst = new THREE.InstancedMesh(mergeNormalized([xBar1, xBar2]), ctx.materials.darkWood, 110);
  for (let i = 0; i < 110; i++) {
    const t = i / 109;
    const bx = dbx + 12 + t * 82;
    const bz = dbz + 44 - t * 38;
    setInstanceMatrix(xInst, i, bx, ctx.getHeight(bx, bz) + 0.9, bz, 0, 0.4, 0, 1, 1, 1);
  }
  xInst.instanceMatrix.needsUpdate = true;

  const flareParts: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 8; f++) {
    const fx = dbx - 32 + f * 9.2;
    const fz = dbz + 8 + (f % 2) * 12;
    const s = new THREE.SphereGeometry(0.45, 8, 6);
    s.translate(fx, ctx.getHeight(fx, fz) + 1.4, fz);
    flareParts.push(s);
  }
  // --- 200-Item Macro Visual QC & Expansion (173–186): Điện Biên Phủ ---
  // 173 & 174: Cầu Mường Thanh Bailey steel truss bridge spanning Nam Rốm river channel (deeply grounded stone abutments!)
  const brMx = dbx + 56.0;
  const brMz = dbz + 24.0;
  const brMy = Math.max(ctx.getHeight(brMx - 11, brMz), ctx.getHeight(brMx, brMz), ctx.getHeight(brMx + 11, brMz));
  addBoxPart(metalParts, 22.0, 0.35, 4.2, brMx, brMy + 1.65, brMz);
  for (const s of [-2.05, 2.05]) {
    addBoxPart(metalParts, 22.0, 0.18, 0.18, brMx, brMy + 3.45, brMz + s);
    for (let t = -9; t <= 9; t += 3) {
      addBoxPart(metalParts, 0.16, 1.85, 0.16, brMx + t, brMy + 2.55, brMz + s);
    }
  }
  addBoxPart(stoneParts, 2.2, 4.5, 4.8, brMx - 11.0, brMy - 0.40, brMz);
  addBoxPart(stoneParts, 2.2, 4.5, 4.8, brMx + 11.0, brMy - 0.40, brMz);
  // 175: Second Trận Địa Sơn Pháo / Cối 120mm mortar & artillery pit
  const morX = dbx - 38.0;
  const morZ = dbz + 4.0;
  const morY = ctx.getHeight(morX, morZ);
  addCylPart(craterParts, 4.2, 4.8, 0.85, 12, morX, morY + 0.42, morZ);
  addCylPart(metalParts, 0.12, 0.14, 2.2, 6, morX, morY + 1.35, morZ, 0.55, 0);
  addBoxPart(timberParts, 1.2, 0.55, 0.75, morX + 1.6, morY + 0.48, morZ);
  // 176 & 180 & 181 & 182 & 184: Assault fascines, trench duckboards, observation posts, shattered stumps & A1 altar
  for (let tr = 0; tr < 6; tr++) {
    const tx = dbx - 36 + tr * 11.5;
    const tz = dbz + 18 + (tr % 2 === 0 ? -3.2 : 3.2);
    const ty = ctx.getHeight(tx, tz);
    addBoxPart(timberParts, 11.4, 0.10, 1.4, tx, ty + 0.05, tz, tr % 2 === 0 ? 0.32 : -0.32);
    addCylPart(timberParts, 0.24, 0.24, 1.8, 5, tx, ty + 0.95, tz - 1.25, 0, Math.PI * 0.5);
  }
  addBoxPart(stoneParts, 2.4, 1.15, 2.4, monX, ctx.getHeight(monX, monZ + 5.8) + 0.58, monZ + 5.8);
  // 177: 4 Draped Cargo Parachute Canopies (Dù Tiếp Tế) snagged on hillocks & trench edges
  const chuteParts: THREE.BufferGeometry[] = [];
  for (const [px, pz] of [[dbx + 34, dbz + 32], [dbx - 42, dbz + 28], [dbx + 8, dbz + 38], [dbx - 16, dbz - 28]] as Array<[number, number]>) {
    const py = ctx.getHeight(px, pz);
    const chute = new THREE.SphereGeometry(2.4, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
    chute.scale(1.2, 0.65, 1.0);
    chute.translate(px, py + 0.35, pz);
    chuteParts.push(chute);
  }
  dbGroup.add(new THREE.Mesh(mergeNormalized(chuteParts), ctx.materials.whitePlaster));
  // 178: Ghi-sê Sân Bay Mường Thanh PSP runway strip & fuel drums
  addBoxPart(metalParts, 16.0, 0.14, 6.2, dbx + 14.0, ctx.getHeight(dbx + 14.0, dbz + 44.0) + 0.08, dbz + 44.0);
  // 179: 40 Instanced Cỏ Gianh Tây Bắc highland elephant-grass clumps
  const dbGrassGeo = new THREE.ConeGeometry(0.32, 1.25, 4);
  dbGrassGeo.translate(0, 0.62, 0);
  const dbGrassInst = new THREE.InstancedMesh(dbGrassGeo, bagMat, 40);
  for (let i = 0; i < 40; i++) {
    const gx = dbx + (rand() - 0.5) * 120;
    const gz = dbz + (rand() - 0.5) * 90;
    setInstanceMatrix(dbGrassInst, i, gx, ctx.getHeight(gx, gz), gz, (rand() - 0.5) * 0.2, rand() * 6.28, (rand() - 0.5) * 0.2, 0.8 + rand() * 0.6, 0.8 + rand() * 0.6, 0.8 + rand() * 0.6);
  }
  dbGrassInst.instanceMatrix.needsUpdate = true;
  dbGrassInst.computeBoundingSphere();
  dbGroup.add(dbGrassInst);
  // 186: Warm amber field-lantern glow orbs inside Hầm De Castries operations room
  for (const lz of [-2.4, 2.4]) {
    flareParts.push(new THREE.SphereGeometry(0.18, 6, 5).translate(bunkerX, bunkerY + 1.85, bunkerZ + lz));
  }

  // --- Wave 2 Macro Visual QC & Expansion (373–386): Điện Biên Phủ Command Trenches, Bunkers & Victory Flag ---
  // 373: Giao Thông Hào Chỉ Huy Mường Thanh (timber-revetted command trenches linking Hầm De Castries to perimeter)
  for (let tr = 0; tr < 4; tr++) {
    const tx = bunkerX - 10.0 + tr * 6.5;
    const tz = bunkerZ + 9.5 + (tr % 2 === 0 ? -1.4 : 1.4);
    const ty = ctx.getHeight(tx, tz);
    addBoxPart(timberParts, 6.2, 0.95, 0.18, tx, ty + 0.48, tz - 0.85, tr % 2 === 0 ? 0.18 : -0.18);
    addBoxPart(timberParts, 6.2, 0.95, 0.18, tx, ty + 0.48, tz + 0.85, tr % 2 === 0 ? 0.18 : -0.18);
  }
  // 374 & 381 & 383: 2 Fortified 105mm Artillery Bunkers (Hầm Pháo 105mm), ammo crates & timber gun-trails
  for (const [ax, az] of [[dbx - 28, dbz - 22], [dbx + 26, dbz - 20]] as Array<[number, number]>) {
    const ay = ctx.getHeight(ax, az);
    addBoxPart(craterParts, 6.2, 2.2, 4.8, ax, ay + 1.1, az);
    addBoxPart(timberParts, 6.6, 0.42, 5.2, ax, ay + 2.35, az);
    addCylPart(metalParts, 0.14, 0.18, 3.4, 6, ax, ay + 1.35, az + 2.6, Math.PI * 0.45, 0);
    addBoxPart(timberParts, 1.4, 0.65, 0.9, ax + 3.8, ay + 0.32, az - 1.2);
  }
  // 375 & 386: Đài Cờ Chiến Thắng "Quyết Chiến Quyết Thắng" Victory Flag Monument & memorial wreath dais
  const vfX = bunkerX + 8.5;
  const vfZ = bunkerZ - 4.5;
  const vfY = ctx.getHeight(vfX, vfZ);
  addBoxPart(stoneParts, 4.6, 1.2, 4.6, vfX, vfY + 0.6, vfZ);
  addCylPart(metalParts, 0.10, 0.14, 11.5, 6, vfX, vfY + 6.9, vfZ);
  addBoxPart(flareParts, 3.2, 1.9, 0.08, vfX + 1.65, vfY + 11.4, vfZ);
  addBoxPart(stoneParts, 3.2, 0.45, 2.2, vfX, vfY + 0.22, vfZ + 4.2);
  // 376, 377, 378, 380: Field comms pit, A1 field surgery shelter, 2 machine-gun pillboxes & tactical sand-table
  addBoxPart(timberParts, 2.8, 0.85, 2.2, bunkerX - 8.5, bunkerY + 0.42, bunkerZ - 4.0);
  addCylPart(metalParts, 1.8, 1.8, 3.8, 6, monX - 9.5, ctx.getHeight(monX - 9.5, monZ + 3.2) + 0.9, monZ + 3.2, Math.PI * 0.5, 0);
  for (const [px, pz] of [[brMx - 14, brMz - 5.5], [brMx - 14, brMz + 5.5]] as Array<[number, number]>) {
    const py = ctx.getHeight(px, pz);
    addCylPart(craterParts, 1.9, 2.2, 1.4, 6, px, py + 0.7, pz);
    addBoxPart(timberParts, 4.2, 0.28, 4.2, px, py + 1.5, pz);
  }
  addBoxPart(timberParts, 2.6, 0.88, 1.8, bunkerX + 10.5, bunkerY + 0.44, bunkerZ + 6.2);
  // 379, 382, 384, 385: 8 Cheval-de-frise obstacles, 2 historical site plaques, 3 shell craters & 2 perimeter spotlight poles
  for (let i = 0; i < 8; i++) {
    const ox = dbx + 12 + i * 3.6;
    const oz = dbz + 10 + (i % 2) * 2.2;
    const oy = ctx.getHeight(ox, oz);
    addBoxPart(timberParts, 1.6, 0.10, 0.10, ox, oy + 0.55, oz, 0, 0, 0.75);
    addBoxPart(timberParts, 1.6, 0.10, 0.10, ox, oy + 0.55, oz, 0, 0, -0.75);
  }
  for (const [sx, sz] of [[monX + 6.2, monZ + 5.5], [bunkerX - 5.5, bunkerZ + 12.0]] as Array<[number, number]>) {
    addBoxPart(stoneParts, 1.35, 1.8, 0.28, sx, ctx.getHeight(sx, sz) + 0.9, sz);
  }
  for (const [cxOff, czOff] of [[-12, 14], [4, 20], [18, 12]] as Array<[number, number]>) {
    addCylPart(craterParts, 2.2, 2.6, 0.45, 6, dbx + cxOff, ctx.getHeight(dbx + cxOff, dbz + czOff) + 0.18, dbz + czOff);
  }
  for (const side of [-1, 1]) {
    addCylPart(metalParts, 0.08, 0.10, 5.2, 5, bunkerX + side * 7.5, bunkerY + 2.6, bunkerZ + 7.2);
    addConePart(flareParts, 0.26, 0.35, 5, bunkerX + side * 7.5, bunkerY + 5.35, bunkerZ + 7.2);
  }

  // --- Wave 3 Macro Visual QC & Expansion (744–772): Mường Thanh HQ, A1 Banyan/Crater Memorial & 105mm Artillery ---
  const w3DbStone: THREE.BufferGeometry[] = [];
  const w3DbTimber: THREE.BufferGeometry[] = [];
  const w3DbMetal: THREE.BufferGeometry[] = [];
  const w3DbCrater: THREE.BufferGeometry[] = [];
  const w3DbFlare: THREE.BufferGeometry[] = [];
  // 744–747: Mường Thanh Command HQ annex bunker, observation cupola, tactical wall-map board & twin radio-antenna array
  const hqX = bunkerX - 11.5;
  const hqZ = bunkerZ - 2.0;
  const hqY = Math.max(ctx.getHeight(hqX, hqZ), ctx.getHeight(hqX - 3.8, hqZ), ctx.getHeight(hqX + 3.8, hqZ));
  addW3Plinth(w3DbCrater, 7.6, 5.4, hqY + 2.25, hqY, hqX, hqZ);
  addCylPart(w3DbMetal, 2.3, 2.3, 6.4, 6, hqX, hqY + 2.25, hqZ, 0, Math.PI * 0.5);
  addBoxPart(w3DbTimber, 6.8, 1.35, 0.45, hqX, hqY + 0.68, hqZ + 3.4);
  addCylPart(w3DbMetal, 1.15, 1.35, 1.25, 6, hqX, hqY + 4.35, hqZ);
  addBoxPart(w3DbTimber, 2.6, 1.85, 0.24, hqX + 4.8, hqY + 1.25, hqZ + 2.2);
  for (const axOff of [-1.2, 1.2]) {
    addW3GroundedCol(w3DbMetal, 0.05, 0.08, hqY + 9.2, hqY, 5, hqX - 4.6 + axOff, hqZ - 2.4);
  }
  addBoxPart(w3DbMetal, 2.6, 0.14, 0.14, hqX - 4.6, hqY + 7.8, hqZ - 2.4);
  // 748–751: A1 Hill surviving banyan stump memorial, crater observation railing, underground blast-tunnel portal & inscription plinth
  const a1X = monX + 12.5;
  const a1Z = monZ - 4.5;
  const a1Y = Math.max(ctx.getHeight(a1X, a1Z), ctx.getHeight(a1X - 2.4, a1Z), ctx.getHeight(a1X + 2.4, a1Z));
  addW3Plinth(w3DbStone, 5.4, 5.4, a1Y + 0.22, a1Y, a1X, a1Z);
  addCylPart(w3DbStone, 2.6, 2.9, 0.52, 6, a1X, a1Y + 0.48, a1Z);
  addCylPart(w3DbTimber, 0.65, 1.15, 2.85, 6, a1X, a1Y + 2.05, a1Z);
  addCylPart(w3DbTimber, 0.28, 0.42, 1.8, 5, a1X + 0.65, a1Y + 3.15, a1Z, 0, -0.45);
  // 749: Curved crater observation railing hugging the 15.8m A1 blast crater rim at (craterX, craterZ)
  for (let r = 0; r < 6; r++) {
    const ra = 2.05 + r * 0.22;
    const rx = craterX + Math.cos(ra) * 16.4;
    const rz = craterZ + Math.sin(ra) * 16.4;
    const ry = ctx.getHeight(rx, rz);
    addW3GroundedPost(w3DbTimber, 0.12, 0.12, ry + 1.15, ry, rx, rz);
  }
  // 750 & 751: A1 Underground blast-tunnel portal & crater inscription plinth positioned cleanly outside the 15.5m crater rim!
  const tnX = craterX - 18.2;
  const tnZ = craterZ - 3.5;
  const tnY = Math.max(ctx.getHeight(tnX, tnZ), ctx.getHeight(tnX - 1.5, tnZ), ctx.getHeight(tnX + 1.5, tnZ));
  addW3Plinth(w3DbCrater, 3.6, 2.4, tnY + 0.18, tnY, tnX, tnZ);
  addW3GroundedPost(w3DbTimber, 0.28, 0.38, tnY + 2.35, tnY + 0.18, tnX - 1.15, tnZ);
  addW3GroundedPost(w3DbTimber, 0.28, 0.38, tnY + 2.35, tnY + 0.18, tnX + 1.15, tnZ);
  addBoxPart(w3DbTimber, 2.9, 0.38, 1.4, tnX, tnY + 2.45, tnZ);
  addBoxPart(w3DbCrater, 2.2, 2.1, 0.85, tnX, tnY + 1.05, tnZ - 0.55);
  addW3Plinth(w3DbStone, 1.8, 0.72, tnY + 1.1, tnY, tnX - 2.6, tnZ + 2.2);
  // 752–755: Northern & southern 105mm howitzer pits, camouflaged ammo alcoves & hauling capstan winch (with deep stone-earth retaining plinths!)
  for (const [ax, az] of [[dbx - 32, dbz - 6], [dbx - 32, dbz + 10]] as Array<[number, number]>) {
    const ay = Math.max(ctx.getHeight(ax, az), ctx.getHeight(ax - 3.8, az), ctx.getHeight(ax + 3.8, az));
    addW3Plinth(w3DbCrater, 8.2, 8.2, ay + 0.22, ay, ax, az);
    addCylPart(w3DbCrater, 3.8, 4.2, 0.95, 6, ax, ay + 0.65, az);
    addBoxPart(w3DbMetal, 1.5, 1.15, 0.16, ax + 0.6, ay + 1.42, az);
    addCylPart(w3DbMetal, 0.12, 0.16, 3.6, 6, ax + 1.8, ay + 1.62, az, 0, -Math.PI * 0.42);
    addBoxPart(w3DbMetal, 2.4, 0.18, 0.22, ax - 1.2, ay + 0.88, az - 0.65, 0.28);
    addBoxPart(w3DbMetal, 2.4, 0.18, 0.22, ax - 1.2, ay + 0.88, az + 0.65, -0.28);
    addBoxPart(w3DbTimber, 2.2, 1.35, 1.4, ax - 3.6, ay + 0.85, az - 2.6);
  }
  addW3GroundedCol(w3DbTimber, 0.34, 0.38, ctx.getHeight(dbx - 24, dbz + 2) + 1.35, ctx.getHeight(dbx - 24, dbz + 2), 6, dbx - 24, dbz + 2);
  addBoxPart(w3DbTimber, 2.2, 0.12, 0.12, dbx - 24, ctx.getHeight(dbx - 24, dbz + 2) + 1.15, dbz + 2);
  // 756–758, 770: Victory Plaza stepped granite podium, 6 flag-court bollards, crimson-gold victory star plinth & 4 pine planters
  addW3Plinth(w3DbStone, 10.6, 8.4, vfY + 0.62, vfY, vfX, vfZ + 1.5);
  for (let b = 0; b < 6; b++) {
    addW3GroundedPost(w3DbStone, 0.28, 0.28, vfY + 1.45, vfY + 0.5, vfX - 4.5 + b * 1.8, vfZ + 5.6);
  }
  addBoxPart(w3DbStone, 2.4, 1.25, 1.4, vfX, vfY + 1.25, vfZ + 3.2);
  addCylPart(w3DbFlare, 0.72, 0.72, 0.18, 5, vfX, vfY + 2.35, vfZ + 3.2, Math.PI * 0.5, 0);
  for (const [px, pz] of [[-6.5, -3.5], [6.5, -3.5], [-6.5, 6.5], [6.5, 6.5]] as Array<[number, number]>) {
    addBoxPart(w3DbStone, 1.8, 0.58, 1.8, vfX + px, vfY + 0.29, vfZ + pz);
  }
  // 759–769, 771–772: Mường Thanh bridge abutments, bridge guard-house, PSP cargo depot, windsock mast, 4 trench traverses, firing steps, Chaffee tank curb, kitchen cart, mortar aiming stakes, wire spools, stretcher rack, Nam Rốm ford steps & battlefield orientation table
  for (const side of [-1, 1]) {
    addW3Plinth(w3DbStone, 2.4, 6.2, ctx.getHeight(brMx + side * 11.5, brMz) + 1.4, ctx.getHeight(brMx + side * 11.5, brMz), brMx + side * 11.5, brMz);
  }
  const ghY = ctx.getHeight(brMx + 14.5, brMz - 3.8);
  addBoxPart(w3DbTimber, 2.0, 2.25, 2.0, brMx + 14.5, ghY + 1.12, brMz - 3.8);
  addBoxPart(w3DbMetal, 2.4, 0.16, 2.4, brMx + 14.5, ghY + 2.32, brMz - 3.8);
  const pspY = ctx.getHeight(dbx + 28, dbz + 24);
  addBoxPart(w3DbTimber, 3.2, 1.25, 2.2, dbx + 28, pspY + 0.62, dbz + 24);
  addW3GroundedCol(w3DbMetal, 0.05, 0.07, pspY + 6.4, pspY, 5, dbx + 33, dbz + 24);
  addConePart(w3DbFlare, 0.35, 1.35, 5, dbx + 33.7, pspY + 6.0, dbz + 24, 0, 0, -Math.PI * 0.42);
  for (let tr = 0; tr < 4; tr++) {
    const tx = bunkerX - 10.0 + tr * 6.5;
    const tz = bunkerZ + 9.5 + (tr % 2 === 0 ? -1.4 : 1.4);
    const ty = ctx.getHeight(tx, tz);
    addBoxPart(w3DbTimber, 2.2, 0.28, 2.1, tx, ty + 1.05, tz);
    addBoxPart(w3DbTimber, 2.4, 0.32, 0.55, tx, ty + 0.16, tz - 0.55);
  }
  addBoxPart(w3DbStone, 6.8, 0.35, 4.4, dbx + 12, ctx.getHeight(dbx + 12, dbz - 12) + 0.18, dbz - 12);
  addBoxPart(w3DbTimber, 2.2, 0.85, 1.3, bunkerX + 2.0, bunkerY + 0.65, bunkerZ - 9.5);
  for (let s = 0; s < 3; s++) {
    addW3GroundedCol(w3DbFlare, 0.04, 0.05, ctx.getHeight(dbx - 14 + s * 2.2, dbz - 14) + 1.45, ctx.getHeight(dbx - 14 + s * 2.2, dbz - 14), 4, dbx - 14 + s * 2.2, dbz - 14);
  }
  addCylPart(w3DbTimber, 0.45, 0.45, 0.72, 6, dbx + 10, ctx.getHeight(dbx + 10, dbz + 12) + 0.36, dbz + 12, Math.PI * 0.5, 0);
  addBoxPart(w3DbTimber, 2.2, 0.82, 0.95, monX - 12.5, ctx.getHeight(monX - 12.5, monZ + 3.2) + 0.41, monZ + 3.2);
  for (let st = 0; st < 3; st++) {
    addBoxPart(w3DbStone, 3.4, 0.22, 0.65, brMx + 6.5, ctx.getHeight(brMx + 6.5, brMz + 6.5) - 0.15 * st, brMz + 6.5 + st * 0.65);
  }
  addBoxPart(w3DbStone, 2.4, 0.95, 1.4, monX + 6.2, ctx.getHeight(monX + 6.2, monZ + 9.2) + 0.48, monZ + 9.2);
  addBoxPart(w3DbMetal, 2.2, 0.10, 1.25, monX + 6.2, ctx.getHeight(monX + 6.2, monZ + 9.2) + 1.0, monZ + 9.2, 0, 0.28, 0);

  addWave3Mesh(dbGroup, w3DbStone, ctx.materials.stone);
  addWave3Mesh(dbGroup, w3DbTimber, ctx.materials.darkWood);
  addWave3Mesh(dbGroup, w3DbMetal, metalMat);
  addWave3Mesh(dbGroup, w3DbCrater, craterMat);
  addWave3Mesh(dbGroup, w3DbFlare, flareMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1145–1172): Kéo Pháo Winch, Him Lam Bunker, Airstrip PSP & Campaign Obelisk ---
  const w4DbStone: THREE.BufferGeometry[] = [];
  const w4DbTimber: THREE.BufferGeometry[] = [];
  const w4DbMetal: THREE.BufferGeometry[] = [];
  const w4DbCrater: THREE.BufferGeometry[] = [];
  const w4DbFlare: THREE.BufferGeometry[] = [];
  // 1145–1148: Artillery-hauling winch & skid ramp (Kéo Pháo), Him Lam outer bunker (dbx + 62, dbz - 28), Mường Thanh PSP airstrip & parachute supply crates
  const kpX = dbx - 48;
  const kpZ = dbz + 24;
  const kpY = ctx.getHeight(kpX, kpZ);
  addBoxPart(w4DbTimber, 6.4, 0.24, 2.2, kpX, kpY + 0.35, kpZ, 0, 0.18, 0);
  addCylPart(w4DbTimber, 0.32, 0.34, 1.35, 6, kpX - 3.6, kpY + 0.68, kpZ);
  const hlDbX = dbx + 62;
  const hlDbZ = dbz - 28;
  const hlDbY = Math.max(ctx.getHeight(hlDbX, hlDbZ), ctx.getHeight(hlDbX + 3, hlDbZ));
  addW3Plinth(w4DbStone, 7.6, 5.8, hlDbY + 0.35, hlDbY, hlDbX, hlDbZ);
  addBoxPart(w4DbCrater, 6.6, 2.35, 4.8, hlDbX, hlDbY + 1.52, hlDbZ);
  addBoxPart(w4DbMetal, 7.0, 0.28, 5.2, hlDbX, hlDbY + 2.75, hlDbZ);
  addBoxPart(w4DbMetal, 18.0, 0.12, 4.2, dbx + 12, ctx.getHeight(dbx + 12, dbz - 42) + 0.08, dbz - 42);
  for (let c = 0; c < 3; c++) {
    const cxP = dbx + 28 + c * 2.2;
    const cyP = ctx.getHeight(cxP, dbz - 34);
    addBoxPart(w4DbTimber, 1.25, 0.95, 1.15, cxP, cyP + 0.48, dbz - 34);
    addConePart(w4DbStone, 0.95, 0.45, 5, cxP, cyP + 1.15, dbz - 34);
  }
  // 1149–1157: Switchboard dugout, 82mm mortar pit, strategy map shelter (dbx - 42, dbz + 46), victory trumpet plinth, trench revetment, brass casings, Bếp Hoàng Cầm, periscope post & 4 chevaux-de-frise
  addBoxPart(w4DbTimber, 3.2, 1.35, 2.2, dbx - 36, ctx.getHeight(dbx - 36, dbz + 12) + 0.68, dbz + 12);
  addCylPart(w4DbCrater, 2.2, 2.4, 0.72, 6, dbx + 42, ctx.getHeight(dbx + 42, dbz + 18) + 0.36, dbz + 18);
  addCylPart(w4DbMetal, 0.10, 0.12, 1.65, 5, dbx + 42, ctx.getHeight(dbx + 42, dbz + 18) + 0.95, dbz + 18, 0.45, 0);
  const msX = dbx - 42;
  const msZ = dbz + 46;
  const msY = Math.max(ctx.getHeight(msX, msZ), ctx.getHeight(msX - 2, msZ));
  addW3Plinth(w4DbStone, 5.2, 4.2, msY + 0.28, msY, msX, msZ);
  for (const [ox, oz] of [[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]]) addW3GroundedCol(w4DbTimber, 0.10, 0.12, msY + 2.65, msY + 0.28, 5, msX + ox, msZ + oz);
  addBoxPart(w4DbMetal, 5.6, 0.22, 4.6, msX, msY + 2.72, msZ);
  addBoxPart(w4DbTimber, 2.2, 0.85, 1.45, msX, msY + 0.72, msZ);
  addBoxPart(w4DbStone, 1.45, 1.65, 1.45, monX - 14, ctx.getHeight(monX - 14, monZ + 12) + 0.82, monZ + 12);
  addConePart(w4DbFlare, 0.38, 0.85, 5, monX - 14, ctx.getHeight(monX - 14, monZ + 12) + 2.05, monZ + 12);
  addBoxPart(w4DbTimber, 12.0, 1.15, 0.42, dbx + 50, ctx.getHeight(dbx + 50, dbz - 8) + 0.58, dbz - 8);
  addConePart(w4DbFlare, 0.65, 0.75, 4, dbx + 46, ctx.getHeight(dbx + 46, dbz + 22) + 0.38, dbz + 22);
  addBoxPart(w4DbCrater, 2.4, 0.85, 1.6, msX + 6.5, msY + 0.42, msZ);
  addBoxPart(w4DbTimber, 1.6, 1.45, 1.4, hlDbX - 6.8, hlDbY + 0.72, hlDbZ + 4.5);
  for (let b = 0; b < 4; b++) {
    const bx = dbx + 54 + (b % 2) * 5.2;
    const bz = dbz - 16 + Math.floor(b / 2) * 5.2;
    addBoxPart(w4DbTimber, 2.2, 0.14, 0.14, bx, ctx.getHeight(bx, bz) + 0.65, bz, 0.45, 0, 0.55);
    addBoxPart(w4DbTimber, 2.2, 0.14, 0.14, bx, ctx.getHeight(bx, bz) + 0.65, bz, 0.45, 0, -0.55);
  }
  // 1158–1172: Triage crate, loudspeaker stand, rice-sack stack, duckboard walkway, 3 campaign lecterns, soldier plinth, AA ammo rack, pillbox vent, field-forge, 4 granite benches, 2 victory pylons, tank-track plinth, 2 wreath stands, signpost & 56-day obelisk
  addBoxPart(w4DbStone, 1.25, 0.75, 0.85, msX - 5.2, msY + 0.38, msZ);
  addW3GroundedCol(w4DbTimber, 0.06, 0.08, msY + 2.8, msY, 4, msX + 4.8, msZ - 4.2);
  addBoxPart(w4DbStone, 2.4, 0.95, 1.45, kpX + 6.5, kpY + 0.48, kpZ + 3.2);
  addBoxPart(w4DbTimber, 10.0, 0.12, 1.15, dbx + 48, ctx.getHeight(dbx + 48, dbz - 4) + 0.08, dbz - 4);
  for (let l = 0; l < 3; l++) addBoxPart(w4DbStone, 0.95, 1.05, 0.55, monX - 6 + l * 6, ctx.getHeight(monX - 6 + l * 6, monZ + 18) + 0.52, monZ + 18);
  addBoxPart(w4DbStone, 1.15, 1.25, 1.15, monX + 14, ctx.getHeight(monX + 14, monZ + 12) + 0.62, monZ + 12);
  addBoxPart(w4DbTimber, 2.2, 0.85, 0.65, dbx + 36, ctx.getHeight(dbx + 36, dbz + 24) + 0.42, dbz + 24);
  addCylPart(w4DbMetal, 0.48, 0.55, 0.55, 6, hlDbX, hlDbY + 3.12, hlDbZ);
  addBoxPart(w4DbStone, 1.45, 0.85, 0.95, kpX - 6.2, kpY + 0.42, kpZ - 2.5);
  for (let b = 0; b < 4; b++) addBoxPart(w4DbStone, 2.4, 0.52, 0.68, monX + (b < 2 ? -12 : 12), ctx.getHeight(monX, monZ + 24) + 0.26, monZ + 22 + (b % 2) * 5.0);
  for (const s of [-1, 1]) {
    addBoxPart(w4DbStone, 1.45, 4.6, 1.45, monX + s * 7.5, ctx.getHeight(monX + s * 7.5, monZ + 28) + 2.3, monZ + 28);
    addConePart(w4DbFlare, 0.55, 0.85, 5, monX + s * 7.5, ctx.getHeight(monX + s * 7.5, monZ + 28) + 5.0, monZ + 28);
  }
  addBoxPart(w4DbStone, 2.8, 0.55, 1.25, monX + 18, ctx.getHeight(monX + 18, monZ + 20) + 0.28, monZ + 20);
  addBoxPart(w4DbMetal, 2.2, 0.22, 0.72, monX + 18, ctx.getHeight(monX + 18, monZ + 20) + 0.65, monZ + 20);
  for (const s of [-1, 1]) addBoxPart(w4DbMetal, 0.72, 1.15, 0.42, monX + s * 4.5, ctx.getHeight(monX, monZ + 14) + 0.58, monZ + 14);
  addW3GroundedPost(w4DbStone, 0.45, 0.45, ctx.getHeight(monX - 12, monZ + 28) + 1.85, ctx.getHeight(monX - 12, monZ + 28), monX - 12, monZ + 28);
  addBoxPart(w4DbStone, 1.85, 5.8, 1.85, monX, ctx.getHeight(monX, monZ + 36) + 2.9, monZ + 36);
  addConePart(w4DbFlare, 1.15, 1.45, 4, monX, ctx.getHeight(monX, monZ + 36) + 6.5, monZ + 36);

  addWave3Mesh(dbGroup, w4DbStone, ctx.materials.stone);
  addWave3Mesh(dbGroup, w4DbTimber, ctx.materials.darkWood);
  addWave3Mesh(dbGroup, w4DbMetal, metalMat);
  addWave3Mesh(dbGroup, w4DbCrater, craterMat);
  addWave3Mesh(dbGroup, w4DbFlare, flareMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1545–1572): Độc Lập Bunker, 105mm Pit, Field-Post Shelter & 1954 Triumphal Gate ---
  const w5DbStone: THREE.BufferGeometry[] = [];
  const w5DbTimber: THREE.BufferGeometry[] = [];
  const w5DbMetal: THREE.BufferGeometry[] = [];
  const w5DbCrater: THREE.BufferGeometry[] = [];
  const w5DbFlare: THREE.BufferGeometry[] = [];
  // 1545–1547: Độc Lập outer bunker (dbx + 56, dbz - 46), Mường Thanh signal mast & 105mm howitzer timber revetment bay
  const dlDbX = dbx + 56;
  const dlDbZ = dbz - 46;
  const dlDbY = Math.max(ctx.getHeight(dlDbX, dlDbZ), ctx.getHeight(dlDbX + 3, dlDbZ));
  addW3Plinth(w5DbStone, 6.8, 5.2, dlDbY + 0.35, dlDbY, dlDbX, dlDbZ);
  addBoxPart(w5DbCrater, 5.8, 2.25, 4.2, dlDbX, dlDbY + 1.48, dlDbZ);
  addBoxPart(w5DbMetal, 6.2, 0.26, 4.6, dlDbX, dlDbY + 2.65, dlDbZ);
  addW3GroundedCol(w5DbMetal, 0.06, 0.10, msY + 6.8, msY, 5, msX - 5.2, msZ - 4.8);
  const hwX = dbx - 56;
  const hwZ = dbz + 10;
  const hwY = ctx.getHeight(hwX, hwZ);
  addCylPart(w5DbCrater, 3.2, 3.5, 0.85, 6, hwX, hwY + 0.42, hwZ);
  addCylPart(w5DbMetal, 0.14, 0.18, 2.8, 6, hwX, hwY + 1.15, hwZ, 1.35, 0);
  // 1548–1555: Kéo Pháo chock blocks, airstrip windsock & markers, tunneling pit-props, Field-Post shelter (msX + 12, msZ + 6), artillery wheel plinth, MG nest, Dân Công pole rack & medical bunker portal
  for (const s of [-1, 1]) addBoxPart(w5DbTimber, 0.72, 0.48, 0.55, kpX + 3.2, kpY + 0.24, kpZ + s * 1.4);
  addW3GroundedCol(w5DbMetal, 0.05, 0.07, ctx.getHeight(dbx + 2, dbz - 42) + 4.2, ctx.getHeight(dbx + 2, dbz - 42), 4, dbx + 2, dbz - 42);
  for (let rm = 0; rm < 4; rm++) addW3GroundedPost(w5DbStone, 0.22, 0.22, ctx.getHeight(dbx + 4 + rm * 5.2, dbz - 39) + 0.75, ctx.getHeight(dbx + 4 + rm * 5.2, dbz - 39), dbx + 4 + rm * 5.2, dbz - 39);
  addBoxPart(w5DbTimber, 3.2, 0.85, 1.45, dbx + 58, ctx.getHeight(dbx + 58, dbz - 6) + 0.42, dbz - 6);
  const fpDbX = msX + 12;
  const fpDbZ = msZ + 6;
  const fpDbY = Math.max(ctx.getHeight(fpDbX, fpDbZ), ctx.getHeight(fpDbX + 2, fpDbZ));
  addW3Plinth(w5DbStone, 4.4, 3.6, fpDbY + 0.25, fpDbY, fpDbX, fpDbZ);
  for (const [ox, oz] of [[-1.7, -1.3], [1.7, -1.3], [-1.7, 1.3], [1.7, 1.3]]) addW3GroundedCol(w5DbTimber, 0.09, 0.11, fpDbY + 2.45, fpDbY + 0.25, 5, fpDbX + ox, fpDbZ + oz);
  addBoxPart(w5DbMetal, 4.8, 0.20, 4.0, fpDbX, fpDbY + 2.52, fpDbZ);
  addBoxPart(w5DbStone, 1.65, 0.55, 1.15, monX - 18, ctx.getHeight(monX - 18, monZ + 20) + 0.28, monZ + 20);
  addCylPart(w5DbMetal, 0.65, 0.65, 0.22, 6, monX - 18, ctx.getHeight(monX - 18, monZ + 20) + 1.05, monZ + 20, Math.PI * 0.5, 0);
  addBoxPart(w5DbCrater, 3.2, 1.25, 2.2, dlDbX - 6.8, dlDbY + 0.62, dlDbZ + 4.5);
  addBoxPart(w5DbTimber, 2.2, 1.35, 0.48, kpX + 10.5, kpY + 0.68, kpZ + 3.2);
  addBoxPart(w5DbTimber, 2.8, 1.65, 2.2, msX - 8.8, msY + 0.82, msZ + 2.5);
  // 1556–1564: 2 Victory Plaza relief walls, trench sump box, Him Lam lookout ladder, Bếp Hoàng Cầm flue, 6 star-lantern bollards, 3 hedgehog obstacles, field press crate, A1 mine marker & 2 stretcher benches
  for (const s of [-1, 1]) {
    const ry = ctx.getHeight(monX + s * 6.5, monZ + 36);
    addBoxPart(w5DbStone, 4.8, 1.85, 0.48, monX + s * 6.5, ry + 0.92, monZ + 36);
    addBoxPart(w5DbFlare, 3.8, 1.15, 0.52, monX + s * 6.5, ry + 1.02, monZ + 36);
  }
  addBoxPart(w5DbTimber, 1.25, 0.32, 1.25, dbx + 54, ctx.getHeight(dbx + 54, dbz - 4) + 0.16, dbz - 4);
  addBoxPart(w5DbTimber, 0.58, 2.85, 0.14, hlDbX + 4.2, hlDbY + 1.42, hlDbZ, 0, 0, -0.25);
  addBoxPart(w5DbCrater, 3.8, 0.45, 0.72, msX + 9.5, msY + 0.22, msZ);
  for (let sl = 0; sl < 6; sl++) {
    const sx = monX - 15 + sl * 6;
    const sy = ctx.getHeight(sx, monZ + 32);
    addW3GroundedPost(w5DbStone, 0.34, 0.34, sy + 1.25, sy, sx, monZ + 32);
    addConePart(w5DbFlare, 0.20, 0.32, 5, sx, sy + 1.42, monZ + 32);
  }
  for (let h = 0; h < 3; h++) {
    const hxP = dbx + 24 + h * 4.2;
    const hyP = ctx.getHeight(hxP, dbz - 44);
    addBoxPart(w5DbMetal, 1.85, 0.14, 0.14, hxP, hyP + 0.65, dbz - 44, 0.4, 0, 0.55);
    addBoxPart(w5DbMetal, 1.85, 0.14, 0.14, hxP, hyP + 0.65, dbz - 44, -0.4, 0, -0.55);
  }
  addBoxPart(w5DbTimber, 1.65, 0.88, 0.92, msX + 4.8, msY + 0.44, msZ + 4.2);
  addBoxPart(w5DbStone, 1.45, 1.35, 1.45, monX - 14, ctx.getHeight(monX - 14, monZ + 6) + 0.68, monZ + 6);
  addBoxPart(w5DbFlare, 0.95, 0.18, 0.95, monX - 14, ctx.getHeight(monX - 14, monZ + 6) + 1.42, monZ + 6);
  for (const s of [-1, 1]) addBoxPart(w5DbTimber, 2.2, 0.48, 0.58, msX - 5.2, msY + 0.24, msZ + 3.5 + s * 1.4);
  // 1565–1572: 4 boundary stones, Mường Thanh bridge relic plinth, camo-net frame, 4 flagpoles, water-canteen stand, valley map table, 2 stone planters & 1954 Triumphal Gate (monZ + 44)
  for (let bs = 0; bs < 4; bs++) addW3GroundedPost(w5DbStone, 0.42, 0.42, ctx.getHeight(monX - 18 + bs * 12, monZ + 40) + 1.15, ctx.getHeight(monX - 18 + bs * 12, monZ + 40), monX - 18 + bs * 12, monZ + 40);
  addBoxPart(w5DbStone, 2.6, 0.65, 1.25, monX + 22, ctx.getHeight(monX + 22, monZ + 26) + 0.32, monZ + 26);
  addBoxPart(w5DbMetal, 2.2, 0.65, 0.35, monX + 22, ctx.getHeight(monX + 22, monZ + 26) + 0.98, monZ + 26);
  for (const [ox, oz] of [[-2.0, -2.0], [2.0, -2.0], [-2.0, 2.0], [2.0, 2.0]]) addW3GroundedCol(w5DbTimber, 0.08, 0.10, hwY + 2.65, hwY, 4, hwX + ox, hwZ + oz);
  addBoxPart(w5DbMetal, 4.6, 0.12, 4.6, hwX, hwY + 2.68, hwZ);
  for (let fp = 0; fp < 4; fp++) addW3GroundedCol(w5DbMetal, 0.06, 0.08, ctx.getHeight(monX, monZ + 28) + 6.2, ctx.getHeight(monX, monZ + 28), 5, monX + (fp < 2 ? -11 - fp * 4 : 11 + (fp - 2) * 4), monZ + 28);
  addBoxPart(w5DbTimber, 2.0, 0.85, 0.85, kpX + 10.5, kpY + 0.42, kpZ - 2.2);
  addCylPart(w5DbStone, 1.25, 1.05, 0.85, 6, monX + 14, ctx.getHeight(monX + 14, monZ + 32) + 0.42, monZ + 32);
  for (const s of [-1, 1]) addBoxPart(w5DbStone, 1.45, 0.72, 1.45, monX + s * 3.8, ctx.getHeight(monX, monZ + 36) + 0.36, monZ + 36);
  const tgDbY = ctx.getHeight(monX, monZ + 44);
  for (const s of [-1, 1]) addW3GroundedPost(w5DbStone, 1.45, 1.45, tgDbY + 5.6, tgDbY, monX + s * 5.8, monZ + 44);
  addBoxPart(w5DbStone, 13.8, 1.15, 1.65, monX, tgDbY + 5.6, monZ + 44);
  addBoxPart(w5DbFlare, 9.2, 0.45, 1.72, monX, tgDbY + 5.6, monZ + 44);

  addWave3Mesh(dbGroup, w5DbStone, ctx.materials.stone);
  addWave3Mesh(dbGroup, w5DbTimber, ctx.materials.darkWood);
  addWave3Mesh(dbGroup, w5DbMetal, metalMat);
  addWave3Mesh(dbGroup, w5DbCrater, craterMat);
  addWave3Mesh(dbGroup, w5DbFlare, flareMat);

  dbGroup.add(
    new THREE.Mesh(mergeNormalized(cragParts), cragMat),
    new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(timberParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(metalParts), metalMat),
    new THREE.Mesh(mergeNormalized(tankParts), tankMat),
    new THREE.Mesh(mergeNormalized(craterParts), craterMat),
    bagInst,
    xInst,
    dbSmokeInst,
    dbBeamInst,
    new THREE.Mesh(mergeNormalized(flareParts), flareMat)
  );
  ctx.scene.add(dbGroup);
  return { group: dbGroup, flareMat };
}

function buildBachDangGrandArmadaMacro(
  ctx: VietnamBuilderContext,
  sharedFlareMat?: THREE.MeshStandardMaterial
): { group: THREE.Group; flareMat: THREE.MeshStandardMaterial } {
  // --- M15: BachDangGrandArmadaMacro (-240, -760) ---
  const bdx = -240;
  const bdz = -760;
  const bdGroup = new THREE.Group();
  bdGroup.name = 'BachDangGrandArmadaMacro';
  const rand = mulberry32(15015);
  const flareMat =
    sharedFlareMat ??
    (() => {
      const m = new THREE.MeshStandardMaterial({
        color: '#ff3b2f',
        emissive: new THREE.Color('#ff3b2f'),
        emissiveIntensity: 1.0
      });
      m.userData.noDedupe = true;
      ctx.extraMaterials.push(m);
      return m;
    })();

  const royalSailTex =
    ctx.cachedTextures?.redEmblemSail ??
    (() => {
      const t = createRedEmblemSailTexture(256, ctx.renderer);
      ctx.extraTextures.push(t);
      return t;
    })();
  const royalSailMat = new THREE.MeshStandardMaterial({
    map: royalSailTex,
    roughness: 0.78,
    side: THREE.DoubleSide
  });
  const mistAlphaTex = createSoftRadialAlphaTexture(ctx, 64);
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    alphaMap: mistAlphaTex,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(royalSailMat, mistMat);

  // 11-Ship Armada (1 Hero 32m Flagship + 2 Twin-Beacon Fire Junks + 8 Staggered Escorts) + Secondary Fore-Sails
  const fleetDefs: Array<[number, number, number, boolean]> = [
    [0, 5, 1.45, false],
    [-68, -22, 1.05, true], [68, -20, 1.05, true],
    [-118, -46, 0.90, false], [118, -42, 0.90, false],
    [-48, -68, 0.85, false], [52, -70, 0.85, false],
    [-148, -76, 0.78, false], [146, -74, 0.78, false],
    [-92, -96, 0.72, false], [94, -95, 0.72, false]
  ];
  const makeBillowingSailGeo = (w: number, h: number, sScale: number): THREE.BufferGeometry => {
    const sg = new THREE.PlaneGeometry(w, h, 6, 6);
    const sp = sg.attributes.position;
    for (let v = 0; v < sp.count; v++) {
      const u = sp.getX(v) / w + 0.5;
      const wv = sp.getY(v) / h + 0.5;
      sp.setZ(v, Math.sin(u * Math.PI) * Math.sin(wv * Math.PI) * 0.9 * sScale);
    }
    sg.computeVertexNormals();
    return sg;
  };
  for (let s = 0; s < fleetDefs.length; s++) {
    const [ox, oz, scale, twinFire] = fleetDefs[s];
    const ship = new THREE.Group();
    ship.add(new THREE.Mesh(createWarJunkHullGeometry(scale, 3), ctx.materials.darkWood));

    const sail = new THREE.Mesh(makeBillowingSailGeo(9.6 * scale, 12.8 * scale, scale), royalSailMat);
    sail.position.set(1.52 * scale, 9.0 * scale, 0);
    sail.rotation.y = Math.PI * 0.5;
    ship.add(sail);

    // Secondary Fore-Sail on fore mast (aligned cleanly to mast battens at z = 0)
    const foreSail = new THREE.Mesh(makeBillowingSailGeo(6.4 * scale, 8.6 * scale, scale), royalSailMat);
    foreSail.position.set(6.72 * scale, 6.8 * scale, 0);
    foreSail.rotation.y = Math.PI * 0.5;
    ship.add(foreSail);

    // Third Stern-Sail on stern mast (Fixes Bug R38: stern mast previously had 5 bare battens and no sail!)
    const sternSail = new THREE.Mesh(makeBillowingSailGeo(5.6 * scale, 7.6 * scale, scale), royalSailMat);
    sternSail.position.set(-4.52 * scale, 6.2 * scale, 0);
    sternSail.rotation.y = Math.PI * 0.5;
    ship.add(sternSail);

    // FIX BD-05: Flush painted Prow Ship Eyes (*Mắt Thuyền*, flat scaleZ=0.14), tall crimson mast battle pennants & deck warrior silhouettes!
    if (s === 0) {
      const eyeWhiteGeo = new THREE.SphereGeometry(0.40 * scale, 8, 5);
      eyeWhiteGeo.scale(1.35, 0.82, 0.14);
      const pupilGeo = new THREE.SphereGeometry(0.22 * scale, 7, 4);
      pupilGeo.scale(1.2, 0.78, 0.16);
      for (const side of [-1, 1]) {
        const ew = new THREE.Mesh(eyeWhiteGeo, ctx.materials.whitePlaster);
        ew.position.set(9.8 * scale, 2.15 * scale, side * 1.38 * scale);
        const ep = new THREE.Mesh(pupilGeo, ctx.materials.darkVoid);
        ep.position.set(9.92 * scale, 2.15 * scale, side * 1.43 * scale);
        ship.add(ew, ep);
      }
    }
    if (s < 5) {
      // Tall crimson battle pennant streaming atop main mast + 4 deck warrior silhouettes
      const pennantGeo = new THREE.ConeGeometry(0.42 * scale, 3.8 * scale, 3);
      pennantGeo.rotateZ(-Math.PI * 0.45);
      pennantGeo.translate(3.4 * scale, 16.4 * scale, 0);
      ship.add(new THREE.Mesh(pennantGeo, ctx.materials.crimsonLacquer));
      const warriorParts: THREE.BufferGeometry[] = [];
      for (let w = 0; w < 4; w++) {
        const wx = (-2.2 + w * 2.1) * scale;
        const wz = (w % 2 === 0 ? -0.95 : 0.95) * scale;
        warriorParts.push(
          new THREE.CylinderGeometry(0.14 * scale, 0.18 * scale, 1.35 * scale, 5).translate(wx, 2.05 * scale, wz),
          new THREE.ConeGeometry(0.28 * scale, 0.18 * scale, 5).translate(wx, 2.86 * scale, wz)
        );
      }
      ship.add(new THREE.Mesh(mergeNormalized(warriorParts), ctx.materials.darkWood));
    }

    // FIX BD-03: Replace static red fire spheres with forged iron fire-baskets + multi-tongue 3-color flame plumes!
    const buildFlameCluster = (rad: number): THREE.BufferGeometry => {
      const fParts: THREE.BufferGeometry[] = [];
      for (let t = 0; t < 3; t++) {
        const a = (t / 3) * Math.PI * 2;
        const c = new THREE.ConeGeometry(rad * (0.58 - t * 0.08), rad * (2.2 + t * 0.45), 5);
        c.rotateZ((t - 1) * 0.16);
        c.translate(Math.cos(a) * rad * 0.22, rad * (0.95 + t * 0.18), Math.sin(a) * rad * 0.22);
        fParts.push(paintGeometryVertexColor(c, t === 0 ? '#fff0a0' : t === 1 ? '#ff7b1a' : '#c92212'));
      }
      return mergeNormalized(fParts);
    };
    const macroFlameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    ctx.extraMaterials.push(macroFlameMat);
    if (twinFire) {
      for (const fx of [-6.5 * scale, 7.5 * scale]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 9.0 * scale, 6), ctx.materials.darkWood);
        pole.position.set(fx, 4.8 * scale, 0);
        const ironPan = new THREE.Mesh(new THREE.CylinderGeometry(0.68 * scale, 0.36 * scale, 0.45 * scale, 7), ctx.materials.bronze);
        ironPan.position.set(fx, 9.25 * scale, 0);
        const fire = new THREE.Mesh(buildFlameCluster(0.75 * scale), macroFlameMat);
        fire.position.set(fx, 9.45 * scale, 0);
        ship.add(pole, ironPan, fire);
      }
    } else {
      const bowFire = new THREE.Mesh(buildFlameCluster(0.48 * scale), macroFlameMat);
      bowFire.position.set(10.5 * scale, 2.1 * scale, 0);
      ship.add(bowFire);
    }

    ship.position.set(bdx + ox, VIETNAM_WATER_LEVEL, bdz + oz);
    ship.rotation.y = Math.PI * 0.5;
    bdGroup.add(ship);
    ctx.junkBoats.push({
      group: ship,
      centerX: bdx + ox,
      centerZ: bdz + oz,
      radiusX: 1.8,
      radiusZ: 1.4,
      speed: 0.21,
      phase: s * 0.95
    });
  }

  // 2 Impaled Listing & Blazing Enemy War Junks + 4 Bundled-Log Flaming Fire-Rafts (*Bè Lửa*) + Rising Dark Smoke Columns (BD-03!)
  const wreckSmokeMat = new THREE.MeshBasicMaterial({
    color: '#242220',
    alphaMap: mistAlphaTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const wreckFlameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  ctx.extraMaterials.push(wreckSmokeMat, wreckFlameMat);
  const wreckCoords: Array<[number, number, number]> = [
    [-42, 66, 0.85],
    [54, 72, 0.82]
  ];
  for (const [wx, wz, sc] of wreckCoords) {
    const wreck = new THREE.Group();
    wreck.add(new THREE.Mesh(createWarJunkHullGeometry(sc, 2), ctx.materials.darkWood));
    const tornSail = new THREE.Mesh(makeBillowingSailGeo(6.8 * sc, 9.0 * sc, sc), royalSailMat);
    tornSail.position.set(1.8 * sc, 7.2 * sc, 0.3);
    tornSail.rotation.y = Math.PI * 0.5;
    wreck.add(tornSail);
    const wFlames: THREE.BufferGeometry[] = [];
    for (const [fx, fy] of [
      [0, 3.0],
      [4.5, 2.6],
      [-2.5, 3.8]
    ]) {
      for (let t = 0; t < 3; t++) {
        const fc = new THREE.ConeGeometry(0.62 * sc, (2.2 + t * 0.55) * sc, 5);
        fc.rotateZ((t - 1) * 0.2);
        fc.translate(fx * sc + (t - 1) * 0.28, fy * sc + (0.9 + t * 0.2) * sc, (t % 2 === 0 ? 0.2 : -0.2));
        wFlames.push(paintGeometryVertexColor(fc, t === 0 ? '#fff0a0' : t === 1 ? '#ff7b1a' : '#c92212'));
      }
    }
    wreck.add(new THREE.Mesh(mergeNormalized(wFlames), wreckFlameMat));
    // Dark smoke plume rising 12m above each burning enemy warship
    for (let sm = 0; sm < 3; sm++) {
      const smokeCard = new THREE.Mesh(new THREE.PlaneGeometry(5.5 + sm * 2.2, 6.0 + sm * 1.8), wreckSmokeMat);
      smokeCard.position.set(0, 6.5 + sm * 3.6, 0);
      smokeCard.rotation.y = sm * 0.9;
      wreck.add(smokeCard);
    }
    wreck.position.set(bdx + wx, VIETNAM_WATER_LEVEL - 0.3, bdz + wz);
    wreck.rotation.set(-0.18, Math.PI * 0.45, 0.34);
    bdGroup.add(wreck);
  }
  const raftParts: THREE.BufferGeometry[] = [];
  const raftFireParts: THREE.BufferGeometry[] = [];
  for (const [rx, rz] of [
    [-92, 62],
    [-12, 70],
    [28, 64],
    [98, 76]
  ]) {
    // 8 Bundled timber logs lashed together forming an authentic *Bè Lửa* fire-raft (replacing single box!)
    for (let lg = -3; lg <= 4; lg++) {
      addCylPart(raftParts, 0.18, 0.20, 5.2, 5, bdx + rx, VIETNAM_WATER_LEVEL + 0.14, bdz + rz + lg * 0.38, 0, Math.PI * 0.5);
    }
    for (let ft = 0; ft < 3; ft++) {
      const rf = new THREE.ConeGeometry(0.68 - ft * 0.10, 2.4 + ft * 0.45, 5);
      rf.rotateZ((ft - 1) * 0.18);
      rf.translate(bdx + rx + (ft - 1) * 0.45, VIETNAM_WATER_LEVEL + 1.35 + ft * 0.18, bdz + rz);
      raftFireParts.push(paintGeometryVertexColor(rf, ft === 0 ? '#fff0a0' : ft === 1 ? '#ff7b1a' : '#c92212'));
    }
  }
  bdGroup.add(
    new THREE.Mesh(mergeNormalized(raftParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(raftFireParts), wreckFlameMat)
  );

  // FIX BD-01 (Macro): 180 Authentic Hand-Hewn Beveled Cọc Gỗ Lim Bạch Đằng Stakes (mud-stained bark, staggered zigzag heights & 18°–34° lean!)
  const logPart = new THREE.CylinderGeometry(0.16, 0.22, 4.0, 5, 1, true);
  const ironTip = new THREE.ConeGeometry(0.16, 1.05, 5);
  ironTip.translate(0, 2.52, 0);
  const stakeMat = new THREE.MeshStandardMaterial({
    color: '#3c2d23',
    map: ctx.pbr.bark.map,
    normalMap: ctx.pbr.bark.normalMap,
    roughness: 0.80,
    metalness: 0.03
  });
  // FIX BD-04: Soft feathered water ripples around stake bases & translucent river mist (replacing harsh opaque rings & visible plane edges!)
  const foamMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    alphaMap: mistAlphaTex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false
  });
  mistMat.opacity = 0.18;
  ctx.extraMaterials.push(stakeMat, foamMat);
  const stakeInst = new THREE.InstancedMesh(mergeNormalized([logPart, ironTip]), stakeMat, 180);
  const foamInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.45, 1.45).rotateX(-Math.PI / 2), foamMat, 180);
  for (let i = 0; i < 180; i++) {
    const row = i % 5;
    const t = i / 179;
    const sx = bdx - 165 + t * 330 + (rand() - 0.5) * 6;
    const sz = bdz + 58 + row * 11.0 + Math.sin(t * Math.PI * 6.0) * 7.5 + (rand() - 0.5) * 4;
    const tilt = 0.30 + rand() * 0.28;
    const yVar = -0.35 + rand() * 1.55;
    setInstanceMatrix(stakeInst, i, sx, VIETNAM_WATER_LEVEL + yVar, sz, tilt, (rand() - 0.5) * 0.3, 0, 1, 1, 1);
    setInstanceMatrix(foamInst, i, sx, VIETNAM_WATER_LEVEL + 0.06, sz, 0, 0, 0, 1, 1, 1);
  }
  stakeInst.instanceMatrix.needsUpdate = true;
  foamInst.instanceMatrix.needsUpdate = true;

  const mistInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(42, 9.5), mistMat, 24);
  for (let i = 0; i < 24; i++) {
    setInstanceMatrix(mistInst, i, bdx + (rand() - 0.5) * 320, 3.2 + rand() * 5.0, bdz - 20 + (rand() - 0.5) * 180, 0, (rand() - 0.5) * 0.4, 0, 1, 1, 1);
  }
  mistInst.instanceMatrix.needsUpdate = true;

  // --- 200-Item Macro Visual QC & Expansion (187–200): Bạch Đằng Grand Armada ---
  const bdExpRock: THREE.BufferGeometry[] = [];
  const bdExpWood: THREE.BufferGeometry[] = [];
  const bdExpCrimson: THREE.BufferGeometry[] = [];
  const bdExpBronze: THREE.BufferGeometry[] = [];
  const bdExpGreen: THREE.BufferGeometry[] = [];

  // 187, 199, 200: Rocky shoreline command promontory with Ngô Quyền/Trần Hưng Đạo watchtower, fire brazier & stele
  const cmdX = bdx - 155;
  const cmdZ = bdz + 22;
  const cmdRock = createSculptedRockGeometry(1590, 14.0, 5.5, 12.0, 2);
  cmdRock.translate(cmdX, VIETNAM_WATER_LEVEL + 1.8, cmdZ);
  bdExpRock.push(cmdRock);
  for (const [ox, oz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
    addCylPart(bdExpWood, 0.14, 0.16, 6.2, 6, cmdX + ox, VIETNAM_WATER_LEVEL + 6.0, cmdZ + oz);
  }
  const cmdRoof = createVietnameseCurvedRoofGeometry(6.4, 6.4, 3.6, 1.2, 1.8, 0.55);
  cmdRoof.translate(cmdX, VIETNAM_WATER_LEVEL + 9.1, cmdZ);
  bdExpCrimson.push(cmdRoof);
  addBoxPart(bdExpRock, 1.4, 2.4, 0.36, cmdX + 5.2, VIETNAM_WATER_LEVEL + 4.8, cmdZ + 2.0);
  addCylPart(bdExpBronze, 0.65, 0.45, 1.1, 8, cmdX - 4.5, VIETNAM_WATER_LEVEL + 4.4, cmdZ + 3.0);
  // 188: Bãi Sú Vẹt coastal mangrove & reed marsh banks along tidal shoals
  for (let m = 0; m < 18; m++) {
    const mx = bdx - 165 + (m < 9 ? m * 12 : 210 + (m - 9) * 12);
    const mz = bdz + 48 + (m % 3) * 10;
    addCylPart(bdExpWood, 0.08, 0.12, 2.4, 5, mx, VIETNAM_WATER_LEVEL + 0.8, mz);
    bdExpGreen.push(createSculptedRockGeometry(1610 + m, 2.2, 1.4, 2.0, 1).translate(mx, VIETNAM_WATER_LEVEL + 2.2, mz));
  }
  // 189: 4 Thuyền Nan & Thuyền Câu Móc grappling-hook boarding skiffs
  for (const [sx, sz] of [[-32, 28], [34, 30], [-78, 12], [78, 14]] as Array<[number, number]>) {
    const skiff = mergeNormalized(createTaperedSampanHullParts(5.4, 1.25, 0.42));
    skiff.rotateY(0.35);
    skiff.translate(bdx + sx, VIETNAM_WATER_LEVEL + 0.04, bdz + sz);
    bdExpWood.push(skiff);
  }
  // 190 & 191 & 194 & 195: War drums, wooden archer shields, command pennants & anchor on flagship/escorts
  for (let s = 0; s < 5; s++) {
    const [ox, oz, scale] = fleetDefs[s];
    const sx = bdx + ox;
    const sz = bdz + oz;
    addCylPart(bdExpBronze, 0.45 * scale, 0.45 * scale, 0.72 * scale, 8, sx, VIETNAM_WATER_LEVEL + 2.0 * scale, sz);
    for (let sh = -3; sh <= 3; sh++) {
      for (const side of [-1, 1]) {
        addBoxPart(bdExpCrimson, 0.12 * scale, 0.65 * scale, 0.55 * scale, sx + side * 1.45 * scale, VIETNAM_WATER_LEVEL + 1.65 * scale, sz + sh * 1.1 * scale);
      }
    }
  }
  // 192 & 193 & 196: 24 extra Cọc Gỗ Lim stakes on exposed sandbars, floating charred debris & rocky tidal reefs
  for (let k = 0; k < 24; k++) {
    const kx = bdx - 110 + (k / 23) * 220;
    const kz = bdz + 68 + (k % 3) * 6.5;
    addCylPart(bdExpWood, 0.14, 0.20, 3.6, 5, kx, VIETNAM_WATER_LEVEL + 0.85, kz, 0.38, 0);
  }
  for (let d = 0; d < 8; d++) {
    addBoxPart(bdExpWood, 2.8, 0.18, 0.42, bdx - 48 + d * 14, VIETNAM_WATER_LEVEL + 0.04, bdz + 70 + (d % 2) * 8, d * 0.7);
  }
  for (const [rx, rz] of [[-145, 58], [-128, 74], [138, 62]] as Array<[number, number]>) {
    bdExpRock.push(createSculptedRockGeometry(1650 + rx, 6.2, 2.2, 5.2, 1).translate(bdx + rx, VIETNAM_WATER_LEVEL + 0.4, bdz + rz));
  }

  // --- Wave 2 Macro Visual QC & Expansion (387–400): Bạch Đằng Ngô Quyền Pavilion, Signal Towers & Fortification ---
  // 387 & 391: Lầu Chỉ Huy Ngô Quyền (2-tier elevated command pavilion) & war-drum/gong signal dais
  const nqX = cmdX + 9.5;
  const nqZ = cmdZ - 4.5;
  addBoxPart(bdExpRock, 9.6, 2.2, 7.6, nqX, VIETNAM_WATER_LEVEL + 3.2, nqZ);
  addBoxPart(bdExpWood, 7.6, 2.8, 5.6, nqX, VIETNAM_WATER_LEVEL + 5.7, nqZ);
  addBoxPart(bdExpCrimson, 8.2, 0.32, 6.2, nqX, VIETNAM_WATER_LEVEL + 7.2, nqZ);
  addBoxPart(bdExpCrimson, 5.4, 2.2, 4.2, nqX, VIETNAM_WATER_LEVEL + 8.45, nqZ);
  addConePart(bdExpCrimson, 5.2, 2.1, 4, nqX, VIETNAM_WATER_LEVEL + 10.6, nqZ, Math.PI * 0.25);
  addBoxPart(bdExpWood, 3.6, 0.55, 3.2, nqX + 7.2, VIETNAM_WATER_LEVEL + 4.4, nqZ + 2.5);
  addCylPart(bdExpBronze, 0.65, 0.65, 0.85, 6, nqX + 7.2, VIETNAM_WATER_LEVEL + 5.2, nqZ + 2.5, 0, Math.PI * 0.5);
  // 388: 2 Tall Coastal Signal Fire Towers (Tháp Lửa Hiệu Bạch Đằng) on western & eastern headlands
  for (const [tx, tz] of [[cmdX - 14, cmdZ - 6], [bdx + 148, bdz + 26]] as Array<[number, number]>) {
    addBoxPart(bdExpRock, 5.6, 2.6, 5.6, tx, VIETNAM_WATER_LEVEL + 1.3, tz);
    for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      addCylPart(bdExpWood, 0.14, 0.18, 7.8, 5, tx + ox, VIETNAM_WATER_LEVEL + 6.4, tz + oz);
    }
    addBoxPart(bdExpWood, 4.4, 0.35, 4.4, tx, VIETNAM_WATER_LEVEL + 10.4, tz);
    addCylPart(bdExpBronze, 0.95, 0.65, 0.9, 6, tx, VIETNAM_WATER_LEVEL + 11.0, tz);
    addConePart(bdExpCrimson, 0.72, 1.45, 5, tx, VIETNAM_WATER_LEVEL + 12.1, tz);
  }
  // 389, 395, 397, 400: Coastal Fortification timber palisade wall, 6 crimson banners, 2 crossbow stands & camp gateway
  addBoxPart(bdExpRock, 36.0, 2.2, 2.8, cmdX + 4.0, VIETNAM_WATER_LEVEL + 2.2, cmdZ + 11.5);
  for (let p = 0; p < 12; p++) {
    addCylPart(bdExpWood, 0.14, 0.22, 3.6, 5, cmdX - 12.5 + p * 3.0, VIETNAM_WATER_LEVEL + 4.4, cmdZ + 11.5);
  }
  for (let f = 0; f < 6; f++) {
    const fx = cmdX - 10.0 + f * 5.6;
    addCylPart(bdExpWood, 0.06, 0.08, 4.8, 5, fx, VIETNAM_WATER_LEVEL + 5.8, cmdZ + 10.8);
    addBoxPart(bdExpCrimson, 1.25, 0.85, 0.08, fx + 0.65, VIETNAM_WATER_LEVEL + 7.6, cmdZ + 10.8);
  }
  for (const cxOff of [-6.0, 6.0]) {
    addBoxPart(bdExpWood, 1.8, 0.85, 1.4, cmdX + cxOff, VIETNAM_WATER_LEVEL + 3.8, cmdZ + 9.2);
    addBoxPart(bdExpBronze, 2.2, 0.14, 0.18, cmdX + cxOff, VIETNAM_WATER_LEVEL + 4.35, cmdZ + 9.2);
  }
  addCylPart(bdExpWood, 0.22, 0.26, 5.6, 6, cmdX - 3.2, VIETNAM_WATER_LEVEL + 5.2, cmdZ - 11.5);
  addCylPart(bdExpWood, 0.22, 0.26, 5.6, 6, cmdX + 3.2, VIETNAM_WATER_LEVEL + 5.2, cmdZ - 11.5);
  addBoxPart(bdExpCrimson, 7.8, 0.85, 1.1, cmdX, VIETNAM_WATER_LEVEL + 7.9, cmdZ - 11.5);
  // 390, 392, 393, 394, 396, 398, 399: Stake-prep dock, tidal watchtower, boarding pier, iron-tip forge, 2 reserve fire-rafts, 12 oblique channel stakes & 2 scout canoes
  addBoxPart(bdExpWood, 12.0, 0.28, 3.8, cmdX + 22.0, VIETNAM_WATER_LEVEL + 1.2, cmdZ + 12.5);
  addBoxPart(bdExpRock, 2.2, 1.4, 1.8, cmdX + 19.5, VIETNAM_WATER_LEVEL + 2.0, cmdZ + 11.5);
  addConePart(bdExpCrimson, 0.35, 0.65, 5, cmdX + 19.5, VIETNAM_WATER_LEVEL + 3.0, cmdZ + 11.5);
  addBoxPart(bdExpWood, 2.6, 0.24, 11.0, cmdX + 4.0, VIETNAM_WATER_LEVEL + 1.0, cmdZ + 18.5);
  // 392: Tidal watchtower in eastern mangrove marsh
  const twX = bdx + 122;
  const twZ = bdz + 44;
  for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    addCylPart(bdExpWood, 0.09, 0.12, 6.2, 5, twX + ox, VIETNAM_WATER_LEVEL + 3.1, twZ + oz);
  }
  addBoxPart(bdExpWood, 3.0, 0.24, 3.0, twX, VIETNAM_WATER_LEVEL + 5.4, twZ);
  addConePart(bdExpCrimson, 2.4, 1.2, 4, twX, VIETNAM_WATER_LEVEL + 6.75, twZ, Math.PI * 0.25);
  // 396 & 399: 2 Reserve fire-rafts & 2 scout canoes
  for (const rxOff of [26.0, 32.0]) {
    addBoxPart(bdExpWood, 4.4, 0.35, 2.4, cmdX + rxOff, VIETNAM_WATER_LEVEL + 0.18, cmdZ + 18.5);
  }
  for (const [sx, sz] of [[bdx - 132, bdz + 52], [bdx + 112, bdz + 56]] as Array<[number, number]>) {
    addBoxPart(bdExpWood, 4.8, 0.32, 0.95, sx, VIETNAM_WATER_LEVEL + 0.14, sz, 0.42);
  }
  // 398: 12 Shorter oblique tidal-edge iron-tipped stakes
  for (let k = 0; k < 12; k++) {
    const kx = bdx + 55 + k * 6.5;
    const kz = bdz + 46 + (k % 3) * 4.5;
    addCylPart(bdExpWood, 0.10, 0.16, 2.6, 5, kx, VIETNAM_WATER_LEVEL + 0.65, kz, 0.44, 0);
  }

  // --- Wave 3 Macro Visual QC & Expansion (773–800): War-Junk Fleet Details, Tidal Stake Rows & Coastal Bastions ---
  const w3BdRock: THREE.BufferGeometry[] = [];
  const w3BdWood: THREE.BufferGeometry[] = [];
  const w3BdCrimson: THREE.BufferGeometry[] = [];
  const w3BdBronze: THREE.BufferGeometry[] = [];
  const w3BdGreen: THREE.BufferGeometry[] = [];
  const bdBronzeMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;
  const bdGreenMat = ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone;
  // 773–776: War-junk stern castle extensions, steering-sweep/rudders, foredeck crossbow bulwarks & spare sail-yard rack
  for (const [jx, jz] of [[bdx - 42, bdz + 18], [bdx + 38, bdz + 16]] as Array<[number, number]>) {
    addBoxPart(w3BdWood, 11.2, 1.45, 3.4, jx, VIETNAM_WATER_LEVEL + 0.72, jz);
    addBoxPart(w3BdCrimson, 3.6, 1.85, 3.0, jx - 3.6, VIETNAM_WATER_LEVEL + 2.25, jz);
    addW3HipRoof(w3BdCrimson, w3BdBronze, 4.2, 3.5, VIETNAM_WATER_LEVEL + 3.18, 0.85, jx - 3.6, jz);
    // 774: Steering sweep & rudder
    addBoxPart(w3BdWood, 3.8, 0.18, 0.24, jx - 6.4, VIETNAM_WATER_LEVEL + 0.95, jz, 0, 0, 0.38);
    // 775: Foredeck crossbow bulwark
    addBoxPart(w3BdWood, 1.6, 1.15, 2.6, jx + 4.4, VIETNAM_WATER_LEVEL + 1.85, jz);
    addBoxPart(w3BdBronze, 1.8, 0.14, 0.18, jx + 4.8, VIETNAM_WATER_LEVEL + 2.48, jz);
  }
  addBoxPart(w3BdWood, 6.4, 1.25, 0.85, cmdX + 16.0, VIETNAM_WATER_LEVEL + 1.82, cmdZ + 12.5);
  for (const rxOff of [-2.8, 0, 2.8]) {
    addW3GroundedCol(w3BdWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 1.82, VIETNAM_WATER_LEVEL - 0.6, 5, cmdX + 16.0 + rxOff, cmdZ + 12.5);
  }
  // 777–779: Western ambush stake row (10), central bottleneck wedge (10) & submerged mud-bar stake-tips (8)
  for (let k = 0; k < 10; k++) {
    const wx = bdx - 92 + k * 6.2;
    const wz = bdz + 22 + (k % 2) * 4.5;
    addCylPart(w3BdWood, 0.11, 0.18, 3.8, 5, wx, VIETNAM_WATER_LEVEL + 0.95, wz, 0.36, 0);
    addConePart(w3BdBronze, 0.13, 0.55, 5, wx, VIETNAM_WATER_LEVEL + 2.85, wz + 0.65, 0, 0.36, 0);
    const cxSt = bdx - 18 + k * 4.2;
    const czSt = bdz + 38 + (k % 3) * 3.4;
    addCylPart(w3BdWood, 0.10, 0.16, 3.2, 5, cxSt, VIETNAM_WATER_LEVEL + 0.72, czSt, 0.42, 0);
    addConePart(w3BdBronze, 0.12, 0.45, 5, cxSt, VIETNAM_WATER_LEVEL + 2.28, czSt + 0.62, 0, 0.42, 0);
  }
  for (let k = 0; k < 8; k++) {
    addConePart(w3BdBronze, 0.14, 0.85, 5, bdx - 48 + k * 14.0, VIETNAM_WATER_LEVEL + 0.25, bdz + 54 + (k % 2) * 3.2, 0, 0.38, 0);
  }
  // 780–783: Western & eastern stone coastal beacon bastions, oil-jar & pitch depot & signal-flag gantry
  for (const [tx, tz] of [[cmdX - 14, cmdZ - 6], [bdx + 148, bdz + 26]] as Array<[number, number]>) {
    addW3Plinth(w3BdRock, 8.8, 8.8, VIETNAM_WATER_LEVEL + 2.8, VIETNAM_WATER_LEVEL - 0.5, tx, tz);
    addBoxPart(w3BdRock, 9.2, 0.85, 0.55, tx, VIETNAM_WATER_LEVEL + 3.2, tz + 4.1);
    addBoxPart(w3BdRock, 9.2, 0.85, 0.55, tx, VIETNAM_WATER_LEVEL + 3.2, tz - 4.1);
  }
  for (let j = 0; j < 4; j++) {
    addCylPart(w3BdCrimson, 0.28, 0.24, 0.62, 6, cmdX - 10.5 + (j % 2) * 0.85, VIETNAM_WATER_LEVEL + 3.1, cmdZ - 3.5 + Math.floor(j / 2) * 0.85);
  }
  addW3GroundedCol(w3BdWood, 0.12, 0.16, VIETNAM_WATER_LEVEL + 11.2, VIETNAM_WATER_LEVEL + 2.2, 5, cmdX - 6.5, cmdZ - 2.5);
  addBoxPart(w3BdWood, 4.4, 0.16, 0.16, cmdX - 6.5, VIETNAM_WATER_LEVEL + 9.8, cmdZ - 2.5);
  addBoxPart(w3BdCrimson, 1.4, 1.9, 0.08, cmdX - 8.2, VIETNAM_WATER_LEVEL + 8.8, cmdZ - 2.5);
  addBoxPart(w3BdBronze, 1.4, 1.9, 0.08, cmdX - 4.8, VIETNAM_WATER_LEVEL + 8.8, cmdZ - 2.5);
  // 784–788: War-council tent pavilion, tide strategy table, 3 weapon racks, shield wall rack & supply jetty (shifted to cmdX-8.5, cmdZ+3.0 clear of watchtower 187 & Lầu Chỉ Huy Ngô Quyền 387!)
  const wcX = cmdX - 8.5;
  const wcZ = cmdZ + 3.0;
  addW3Plinth(w3BdRock, 7.6, 5.8, VIETNAM_WATER_LEVEL + 3.4, VIETNAM_WATER_LEVEL + 0.8, wcX, wcZ);
  for (const [ox, oz] of [[-3.1, -2.2], [3.1, -2.2], [-3.1, 2.2], [3.1, 2.2]]) {
    addW3GroundedCol(w3BdCrimson, 0.12, 0.14, VIETNAM_WATER_LEVEL + 6.45, VIETNAM_WATER_LEVEL + 3.4, 5, wcX + ox, wcZ + oz);
  }
  addW3HipRoof(w3BdCrimson, w3BdBronze, 8.4, 6.6, VIETNAM_WATER_LEVEL + 6.45, 1.45, wcX, wcZ);
  addBoxPart(w3BdWood, 2.8, 0.88, 1.6, wcX, VIETNAM_WATER_LEVEL + 3.84, wcZ);
  addW3Plinth(w3BdRock, 9.6, 2.4, VIETNAM_WATER_LEVEL + 3.25, VIETNAM_WATER_LEVEL + 0.5, cmdX + 7.7, cmdZ + 6.5);
  for (let r = 0; r < 3; r++) {
    addBoxPart(w3BdWood, 2.2, 1.55, 0.42, cmdX + 4.5 + r * 3.2, VIETNAM_WATER_LEVEL + 4.0, cmdZ + 6.5);
    addBoxPart(w3BdBronze, 0.10, 2.2, 0.10, cmdX + 4.5 + r * 3.2, VIETNAM_WATER_LEVEL + 4.4, cmdZ + 6.5);
  }
  addBoxPart(w3BdCrimson, 3.2, 1.15, 0.35, cmdX - 5.5, VIETNAM_WATER_LEVEL + 3.8, cmdZ + 6.5);
  addBoxPart(w3BdWood, 8.4, 0.28, 3.2, cmdX - 18.0, VIETNAM_WATER_LEVEL + 1.25, cmdZ + 14.5);
  for (const [pxOff, pzOff] of [[-3.6, -1.2], [0, -1.2], [3.6, -1.2], [-3.6, 1.2], [0, 1.2], [3.6, 1.2]]) {
    addW3GroundedCol(w3BdWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 1.25, VIETNAM_WATER_LEVEL - 0.8, 5, cmdX - 18.0 + pxOff, cmdZ + 14.5 + pzOff);
  }
  for (let b = 0; b < 4; b++) addCylPart(w3BdWood, 0.36, 0.38, 0.82, 6, cmdX - 20.5 + b * 1.1, VIETNAM_WATER_LEVEL + 1.8, cmdZ + 14.5);
  // 789–800: Stake pile-driver frame, forge anvil/trough, tide-gauge pole, grappling-hook rack, 2 palisade corner turrets, entry bridge/barriers, promontory retaining stairs, bronze horn/drum stand, mangrove ambush skiff shelter, charred mast flotsam, victory stele canopy & ceremonial bronze incense tripod
  for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    addW3GroundedCol(w3BdWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 6.2, VIETNAM_WATER_LEVEL - 0.6, 5, cmdX + 25.0 + ox, cmdZ + 12.5 + oz);
  }
  addBoxPart(w3BdBronze, 1.4, 1.1, 1.4, cmdX + 25.0, VIETNAM_WATER_LEVEL + 4.6, cmdZ + 12.5);
  addW3Plinth(w3BdRock, 3.8, 2.4, VIETNAM_WATER_LEVEL + 1.65, VIETNAM_WATER_LEVEL - 0.5, cmdX + 16.8, cmdZ + 11.5);
  addBoxPart(w3BdBronze, 0.85, 0.65, 0.45, cmdX + 17.5, VIETNAM_WATER_LEVEL + 2.0, cmdZ + 11.5);
  addBoxPart(w3BdRock, 1.4, 0.55, 0.85, cmdX + 16.0, VIETNAM_WATER_LEVEL + 1.85, cmdZ + 11.5);
  addW3GroundedCol(w3BdWood, 0.08, 0.10, VIETNAM_WATER_LEVEL + 5.8, VIETNAM_WATER_LEVEL - 0.8, 5, twX + 2.6, twZ);
  addBoxPart(w3BdWood, 2.6, 1.35, 0.45, cmdX + 4.0, VIETNAM_WATER_LEVEL + 1.75, cmdZ + 15.5);
  for (const side of [-1, 1]) {
    addW3Plinth(w3BdRock, 4.0, 4.0, VIETNAM_WATER_LEVEL + 2.0, VIETNAM_WATER_LEVEL - 0.5, cmdX + 4.0 + side * 18.0, cmdZ + 11.5);
    addBoxPart(w3BdWood, 3.6, 4.4, 3.6, cmdX + 4.0 + side * 18.0, VIETNAM_WATER_LEVEL + 4.2, cmdZ + 11.5);
  }
  addBoxPart(w3BdWood, 4.4, 0.26, 4.8, cmdX, VIETNAM_WATER_LEVEL + 2.4, cmdZ - 14.2);
  for (const [ox, oz] of [[-1.9, -2.0], [1.9, -2.0], [-1.9, 2.0], [1.9, 2.0]]) {
    addW3GroundedCol(w3BdWood, 0.12, 0.14, VIETNAM_WATER_LEVEL + 2.4, VIETNAM_WATER_LEVEL - 0.6, 5, cmdX + ox, cmdZ - 14.2 + oz);
  }
  for (let st = 0; st < 4; st++) {
    addW3Plinth(w3BdRock, 4.2, 0.95, VIETNAM_WATER_LEVEL + 2.0 + st * 0.45, VIETNAM_WATER_LEVEL + 0.5, nqX, nqZ + 6.8 - st * 0.85);
  }
  addW3Plinth(w3BdRock, 2.6, 1.8, VIETNAM_WATER_LEVEL + 4.2, VIETNAM_WATER_LEVEL + 0.8, nqX + 10.5, nqZ + 2.5);
  addBoxPart(w3BdWood, 1.8, 0.95, 0.85, nqX + 10.5, VIETNAM_WATER_LEVEL + 4.65, nqZ + 2.5);
  addConePart(w3BdBronze, 0.28, 1.25, 5, nqX + 10.5, VIETNAM_WATER_LEVEL + 5.35, nqZ + 2.5, 0, 0, Math.PI * 0.42);
  const shX = bdx + 104;
  const shZ = bdz + 54;
  for (const [ox, oz] of [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]]) {
    addW3GroundedCol(w3BdWood, 0.08, 0.10, VIETNAM_WATER_LEVEL + 2.6, VIETNAM_WATER_LEVEL - 0.5, 5, shX + ox, shZ + oz);
  }
  addBoxPart(w3BdGreen, 5.2, 0.24, 3.2, shX, VIETNAM_WATER_LEVEL + 2.68, shZ);
  addCylPart(w3BdWood, 0.16, 0.22, 7.6, 5, bdx - 26, VIETNAM_WATER_LEVEL + 0.55, bdz + 10, 0.4, 1.15);
  addW3Plinth(w3BdRock, 3.8, 3.2, VIETNAM_WATER_LEVEL + 3.1, VIETNAM_WATER_LEVEL + 0.5, cmdX + 14.5, cmdZ + 4.5);
  for (const [ox, oz] of [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]]) {
    addW3GroundedCol(w3BdWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 6.4, VIETNAM_WATER_LEVEL + 3.0, 5, cmdX + 14.5 + ox, cmdZ + 4.5 + oz);
  }
  addW3HipRoof(w3BdCrimson, w3BdBronze, 3.6, 3.0, VIETNAM_WATER_LEVEL + 6.4, 0.95, cmdX + 14.5, cmdZ + 4.5);
  addW3Plinth(w3BdRock, 1.8, 1.8, VIETNAM_WATER_LEVEL + 4.25, VIETNAM_WATER_LEVEL + 0.8, nqX, nqZ + 4.6);
  addCylPart(w3BdBronze, 0.72, 0.54, 1.25, 6, nqX, VIETNAM_WATER_LEVEL + 4.85, nqZ + 4.6);

  addWave3Mesh(bdGroup, w3BdRock, ctx.materials.granite);
  addWave3Mesh(bdGroup, w3BdWood, ctx.materials.darkWood);
  addWave3Mesh(bdGroup, w3BdCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(bdGroup, w3BdBronze, bdBronzeMat);
  addWave3Mesh(bdGroup, w3BdGreen, bdGreenMat);

  // --- Wave 4 Macro Visual QC & Outer Expansion (1173–1200): Stake-Sharpening Yard, Forge Shed, Signal-Drum Tower & Victory Stele Pavilion ---
  const w4BdRock: THREE.BufferGeometry[] = [];
  const w4BdWood: THREE.BufferGeometry[] = [];
  const w4BdCrimson: THREE.BufferGeometry[] = [];
  const w4BdBronze: THREE.BufferGeometry[] = [];
  const w4BdGreen: THREE.BufferGeometry[] = [];
  // 1173–1177: Stake-sharpening yard (cmdX - 24, cmdZ + 14), forge shed, tidal-clock sundial, eastern signal-drum tower & crossbow arsenal tent
  const syX = cmdX - 24;
  const syZ = cmdZ + 14;
  addW3Plinth(w4BdRock, 8.6, 5.4, VIETNAM_WATER_LEVEL + 2.4, VIETNAM_WATER_LEVEL + 0.2, syX, syZ);
  for (let s = -1; s <= 1; s++) addCylPart(w4BdWood, 0.14, 0.18, 4.8, 5, syX, VIETNAM_WATER_LEVEL + 2.85, syZ + s * 1.1, 0, Math.PI * 0.5);
  const fgX = cmdX - 24;
  const fgZ = cmdZ - 4;
  addW3Plinth(w4BdRock, 5.4, 4.4, VIETNAM_WATER_LEVEL + 2.6, VIETNAM_WATER_LEVEL + 0.2, fgX, fgZ);
  for (const [ox, oz] of [[-2.1, -1.6], [2.1, -1.6], [-2.1, 1.6], [2.1, 1.6]]) addW3GroundedCol(w4BdWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 5.2, VIETNAM_WATER_LEVEL + 2.6, 5, fgX + ox, fgZ + oz);
  addW3HipRoof(w4BdCrimson, w4BdBronze, 6.2, 5.2, VIETNAM_WATER_LEVEL + 5.2, 1.15, fgX, fgZ);
  addBoxPart(w4BdRock, 1.4, 1.15, 1.2, fgX, VIETNAM_WATER_LEVEL + 3.18, fgZ);
  addW3GroundedPost(w4BdRock, 0.55, 0.55, VIETNAM_WATER_LEVEL + 4.4, VIETNAM_WATER_LEVEL + 2.0, cmdX - 16, cmdZ + 20);
  addConePart(w4BdBronze, 0.35, 0.65, 4, cmdX - 16, VIETNAM_WATER_LEVEL + 4.72, cmdZ + 20);
  const sdX = bdx + 136;
  const sdZ = bdz + 38;
  for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) addW3GroundedCol(w4BdWood, 0.12, 0.14, VIETNAM_WATER_LEVEL + 6.4, VIETNAM_WATER_LEVEL - 0.6, 5, sdX + ox, sdZ + oz);
  addBoxPart(w4BdWood, 3.8, 0.24, 3.8, sdX, VIETNAM_WATER_LEVEL + 4.2, sdZ);
  addCylPart(w4BdCrimson, 0.65, 0.65, 0.95, 6, sdX, VIETNAM_WATER_LEVEL + 5.05, sdZ, 0, Math.PI * 0.5);
  addW3HipRoof(w4BdCrimson, w4BdBronze, 4.6, 4.6, VIETNAM_WATER_LEVEL + 6.4, 1.15, sdX, sdZ);
  const arBdX = cmdX + 22;
  const arBdZ = cmdZ - 4;
  addW3Plinth(w4BdRock, 5.2, 4.0, VIETNAM_WATER_LEVEL + 2.8, VIETNAM_WATER_LEVEL + 0.2, arBdX, arBdZ);
  for (const [ox, oz] of [[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]]) addW3GroundedCol(w4BdCrimson, 0.10, 0.12, VIETNAM_WATER_LEVEL + 5.3, VIETNAM_WATER_LEVEL + 2.8, 5, arBdX + ox, arBdZ + oz);
  addW3HipRoof(w4BdCrimson, w4BdBronze, 6.0, 4.8, VIETNAM_WATER_LEVEL + 5.3, 1.15, arBdX, arBdZ);
  // 1178–1186: Careening cradle, scout-boat jetty, Victory Stele Pavilion (cmdX + 26, cmdZ + 18), pile-driver frame, firewood pyramid, 6 tidal poles, water-clock, ram-prow bench & 6 crimson war-banners
  addBoxPart(w4BdWood, 7.2, 0.45, 2.2, cmdX - 36, VIETNAM_WATER_LEVEL + 0.65, cmdZ + 20, 0.15, 0, 0.18);
  addBoxPart(w4BdWood, 2.4, 0.22, 10.5, bdx + 128, VIETNAM_WATER_LEVEL + 0.72, bdz + 56);
  const vsBdX = cmdX + 26;
  const vsBdZ = cmdZ + 18;
  addW3Plinth(w4BdRock, 5.4, 4.8, VIETNAM_WATER_LEVEL + 2.8, VIETNAM_WATER_LEVEL + 0.2, vsBdX, vsBdZ);
  for (const [ox, oz] of [[-2.0, -1.7], [2.0, -1.7], [-2.0, 1.7], [2.0, 1.7]]) addW3GroundedCol(w4BdCrimson, 0.11, 0.13, VIETNAM_WATER_LEVEL + 5.8, VIETNAM_WATER_LEVEL + 2.8, 5, vsBdX + ox, vsBdZ + oz);
  addBoxPart(w4BdRock, 1.35, 2.25, 0.36, vsBdX, VIETNAM_WATER_LEVEL + 3.92, vsBdZ);
  addW3HipRoof(w4BdCrimson, w4BdBronze, 6.2, 5.6, VIETNAM_WATER_LEVEL + 5.8, 1.25, vsBdX, vsBdZ);
  for (let p = 0; p < 3; p++) {
    const pa = (p / 3) * Math.PI * 2;
    addCylPart(w4BdWood, 0.10, 0.14, 5.8, 5, cmdX + 18 + Math.cos(pa) * 1.4, VIETNAM_WATER_LEVEL + 2.4, cmdZ + 28 + Math.sin(pa) * 1.4, 0.22, pa);
  }
  addConePart(w4BdWood, 1.35, 1.65, 5, cmdX - 10, VIETNAM_WATER_LEVEL + 3.6, cmdZ + 18);
  for (let t = 0; t < 6; t++) addW3GroundedCol(w4BdWood, 0.06, 0.08, VIETNAM_WATER_LEVEL + 2.2, VIETNAM_WATER_LEVEL - 0.8, 4, bdx - 75 + t * 28, bdz + 48);
  addBoxPart(w4BdWood, 1.25, 0.85, 0.85, wcX + 4.8, VIETNAM_WATER_LEVEL + 3.82, wcZ);
  addCylPart(w4BdBronze, 0.28, 0.22, 0.65, 5, wcX + 4.8, VIETNAM_WATER_LEVEL + 4.55, wcZ);
  addBoxPart(w4BdWood, 3.2, 0.85, 0.95, syX + 5.2, VIETNAM_WATER_LEVEL + 2.82, syZ);
  for (let b = 0; b < 6; b++) {
    const bx = cmdX - 28 + b * 11.5;
    addW3GroundedCol(w4BdWood, 0.06, 0.08, VIETNAM_WATER_LEVEL + 8.4, VIETNAM_WATER_LEVEL + 2.5, 5, bx, cmdZ - 14);
    addBoxPart(w4BdCrimson, 1.25, 2.1, 0.08, bx + 0.65, VIETNAM_WATER_LEVEL + 7.1, cmdZ - 14);
  }
  // 1187–1200: 4 mooring bollards, floating fire-boom, bamboo mantlets, 2 pitch cauldrons, oar rack, rock cairn beacon, supply barrels, retaining steps, signal gong, mangrove duckboard, anchor-stone, 4 pier lanterns, Trần Triều stele & Grand Estuary Overlook Terrace
  for (let m = 0; m < 4; m++) addW3GroundedPost(w4BdRock, 0.34, 0.34, VIETNAM_WATER_LEVEL + 2.2, VIETNAM_WATER_LEVEL + 0.2, cmdX + 12 + m * 3.8, cmdZ + 14);
  for (let b = 0; b < 4; b++) addCylPart(w4BdWood, 0.22, 0.22, 4.2, 5, bdx + 88 + b * 4.8, VIETNAM_WATER_LEVEL + 0.14, bdz + 34, 0, Math.PI * 0.5);
  for (let m = 0; m < 4; m++) addBoxPart(w4BdGreen, 2.2, 1.45, 0.24, cmdX - 18 + m * 2.8, VIETNAM_WATER_LEVEL + 3.2, cmdZ + 22, 0, -0.25, 0);
  for (const s of [-1, 1]) addCylPart(w4BdBronze, 0.48, 0.36, 0.72, 6, arBdX + s * 3.8, VIETNAM_WATER_LEVEL + 3.16, arBdZ + 3.2);
  addBoxPart(w4BdWood, 3.2, 1.25, 0.55, cmdX + 12, VIETNAM_WATER_LEVEL + 2.2, cmdZ + 20);
  addConePart(w4BdRock, 1.65, 2.4, 5, bdx + 144, VIETNAM_WATER_LEVEL + 1.2, bdz + 52);
  addCylPart(w4BdBronze, 0.52, 0.36, 0.55, 5, bdx + 144, VIETNAM_WATER_LEVEL + 2.55, bdz + 52);
  for (let c = 0; c < 3; c++) addCylPart(w4BdWood, 0.36, 0.38, 0.85, 6, cmdX + 3.5 + c * 0.95, VIETNAM_WATER_LEVEL + 1.55, cmdZ + 22);
  addBoxPart(w4BdRock, 4.2, 1.45, 2.8, cmdX + 14, VIETNAM_WATER_LEVEL + 1.85, cmdZ + 12);
  addW3GroundedPost(w4BdWood, 0.10, 0.10, VIETNAM_WATER_LEVEL + 3.8, VIETNAM_WATER_LEVEL + 1.0, cmdX + 4, cmdZ + 24);
  addCylPart(w4BdBronze, 0.48, 0.48, 0.12, 6, cmdX + 4, VIETNAM_WATER_LEVEL + 2.95, cmdZ + 24, Math.PI * 0.5, 0);
  addBoxPart(w4BdWood, 16.0, 0.18, 1.65, bdx + 114, VIETNAM_WATER_LEVEL + 0.95, bdz + 54);
  addBoxPart(w4BdRock, 1.65, 0.65, 0.95, syX - 5.2, VIETNAM_WATER_LEVEL + 2.72, syZ);
  for (let l = 0; l < 4; l++) addW3GroundedPost(w4BdRock, 0.32, 0.32, VIETNAM_WATER_LEVEL + 2.6, VIETNAM_WATER_LEVEL + 0.6, cmdX - 6 + l * 6, cmdZ + 24);
  addBoxPart(w4BdRock, 1.65, 2.85, 0.42, vsBdX + 6.5, VIETNAM_WATER_LEVEL + 4.2, vsBdZ);
  const otX = cmdX;
  const otZ = cmdZ - 18;
  addW3Plinth(w4BdRock, 12.0, 5.2, VIETNAM_WATER_LEVEL + 3.2, VIETNAM_WATER_LEVEL + 0.2, otX, otZ);
  addBoxPart(w4BdWood, 11.4, 0.22, 4.6, otX, VIETNAM_WATER_LEVEL + 3.32, otZ);

  addWave3Mesh(bdGroup, w4BdRock, ctx.materials.granite);
  addWave3Mesh(bdGroup, w4BdWood, ctx.materials.darkWood);
  addWave3Mesh(bdGroup, w4BdCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(bdGroup, w4BdBronze, bdBronzeMat);
  addWave3Mesh(bdGroup, w4BdGreen, bdGreenMat);

  // --- Wave 5 Macro Visual QC & Heritage Details (1573–1600): Đền Trần Gatehouse, Stake Oxcart, War-Council Map & Triumphal Archway ---
  const w5BdRock: THREE.BufferGeometry[] = [];
  const w5BdWood: THREE.BufferGeometry[] = [];
  const w5BdCrimson: THREE.BufferGeometry[] = [];
  const w5BdBronze: THREE.BufferGeometry[] = [];
  const w5BdGreen: THREE.BufferGeometry[] = [];
  // 1573–1576: Đền Trần Hưng Đạo Outer Gatehouse (cmdX - 18, cmdZ - 22), stake-transport oxcart, blacksmith bellows/trough & mast sheerlegs frame
  const dtX = cmdX - 18;
  const dtZ = cmdZ - 22;
  addW3Plinth(w5BdRock, 6.8, 3.8, VIETNAM_WATER_LEVEL + 3.2, VIETNAM_WATER_LEVEL + 0.2, dtX, dtZ);
  for (const ox of [-2.6, -0.9, 0.9, 2.6]) addW3GroundedCol(w5BdCrimson, 0.12, 0.14, VIETNAM_WATER_LEVEL + 6.4, VIETNAM_WATER_LEVEL + 3.2, 5, dtX + ox, dtZ);
  addW3HipRoof(w5BdCrimson, w5BdBronze, 7.6, 4.4, VIETNAM_WATER_LEVEL + 6.4, 1.25, dtX, dtZ);
  addBoxPart(w5BdWood, 3.4, 0.65, 1.65, syX, VIETNAM_WATER_LEVEL + 2.85, syZ - 5.2);
  for (let s = -1; s <= 1; s++) addCylPart(w5BdWood, 0.12, 0.14, 3.8, 5, syX, VIETNAM_WATER_LEVEL + 3.35, syZ - 5.2 + s * 0.45, 0, Math.PI * 0.5);
  addBoxPart(w5BdRock, 1.65, 0.68, 0.95, fgX - 4.8, VIETNAM_WATER_LEVEL + 2.94, fgZ);
  for (const s of [-1, 1]) addCylPart(w5BdWood, 0.12, 0.16, 6.4, 5, cmdX - 36 + s * 1.4, VIETNAM_WATER_LEVEL + 3.2, cmdZ + 14, 0, s * 0.22);
  // 1577–1585: 3 tidal-channel cairns, crow's-nest mast, fire-arrow quiver rack, war-council granite table, rope-walk capstans, eastern fish-weir, rice-cooking cauldron, iron-tip rack & stone slipway
  for (let c = 0; c < 3; c++) addConePart(w5BdRock, 1.15, 1.65, 5, bdx + 124 + c * 12, VIETNAM_WATER_LEVEL + 0.82, bdz + 64);
  addW3GroundedCol(w5BdWood, 0.12, 0.16, VIETNAM_WATER_LEVEL + 8.6, VIETNAM_WATER_LEVEL - 0.6, 5, sdX + 5.8, sdZ);
  addBoxPart(w5BdWood, 1.65, 0.22, 1.65, sdX + 5.8, VIETNAM_WATER_LEVEL + 7.2, sdZ);
  addBoxPart(w5BdCrimson, 2.2, 1.35, 0.52, arBdX + 4.8, VIETNAM_WATER_LEVEL + 3.48, arBdZ);
  addBoxPart(w5BdRock, 2.8, 0.92, 1.65, otX, VIETNAM_WATER_LEVEL + 3.78, otZ);
  for (const s of [-1, 1]) addW3GroundedCol(w5BdWood, 0.14, 0.18, VIETNAM_WATER_LEVEL + 3.8, VIETNAM_WATER_LEVEL + 2.0, 5, syX - 6.8, syZ + s * 3.8);
  for (let fw = 0; fw < 6; fw++) {
    const fa = (fw / 5) * 1.3 - 0.65;
    addW3GroundedCol(w5BdWood, 0.05, 0.06, VIETNAM_WATER_LEVEL + 1.15, VIETNAM_WATER_LEVEL - 0.8, 4, bdx + 138 + Math.cos(fa) * 4.2, bdz + 44 + Math.sin(fa) * 4.2);
  }
  addCylPart(w5BdBronze, 0.62, 0.48, 0.65, 6, arBdX - 4.8, VIETNAM_WATER_LEVEL + 3.12, arBdZ + 3.5);
  addBoxPart(w5BdWood, 2.6, 0.85, 0.95, syX + 5.8, VIETNAM_WATER_LEVEL + 2.82, syZ - 4.2);
  addBoxPart(w5BdRock, 8.2, 0.42, 3.2, cmdX - 42, VIETNAM_WATER_LEVEL + 0.65, cmdZ + 24, 0.12, 0, 0.16);
  // 1586–1593: 2 drum-banner posts, fire-raft timber stack, bat-wing sail drying rack, Bàn Thờ Thủy Thần altar, plank steam-box, granite balustrade extension, anchor/buoy rack & 3-dynasty bronze braziers
  for (const s of [-1, 1]) {
    addW3GroundedCol(w5BdCrimson, 0.09, 0.11, VIETNAM_WATER_LEVEL + 6.4, VIETNAM_WATER_LEVEL + 2.6, 5, vsBdX + s * 4.8, vsBdZ + 3.6);
    addBoxPart(w5BdBronze, 0.72, 1.35, 0.08, vsBdX + s * 4.8, VIETNAM_WATER_LEVEL + 5.4, vsBdZ + 3.6);
  }
  addBoxPart(w5BdWood, 3.8, 1.15, 1.85, cmdX - 30, VIETNAM_WATER_LEVEL + 1.95, cmdZ + 22);
  addBoxPart(w5BdWood, 0.22, 4.2, 3.4, cmdX - 32, VIETNAM_WATER_LEVEL + 4.4, cmdZ + 8);
  addBoxPart(w5BdRock, 1.85, 0.95, 0.95, cmdX + 8.5, VIETNAM_WATER_LEVEL + 2.15, cmdZ + 22);
  addCylPart(w5BdBronze, 0.34, 0.26, 0.48, 6, cmdX + 8.5, VIETNAM_WATER_LEVEL + 2.85, cmdZ + 22);
  addBoxPart(w5BdWood, 4.4, 0.78, 0.85, fgX + 5.2, VIETNAM_WATER_LEVEL + 2.98, fgZ);
  addBoxPart(w5BdRock, 12.0, 0.88, 0.42, otX + 12.5, VIETNAM_WATER_LEVEL + 3.65, otZ);
  addBoxPart(w5BdWood, 2.2, 1.15, 0.65, cmdX + 18, VIETNAM_WATER_LEVEL + 2.25, cmdZ + 20);
  for (let bz = -1; bz <= 1; bz++) {
    addW3GroundedPost(w5BdRock, 0.65, 0.65, VIETNAM_WATER_LEVEL + 4.2, VIETNAM_WATER_LEVEL + 2.6, otX + bz * 6.5, otZ + 4.5);
    addCylPart(w5BdBronze, 0.48, 0.34, 0.58, 6, otX + bz * 6.5, VIETNAM_WATER_LEVEL + 4.52, otZ + 4.5);
  }
  // 1594–1600: 4 soldier rest-benches, halberd/shield stand, mangrove observation deck, 5 fresh-water ceramic jars, 6 bronze-capped bollards, Hịch Tướng Sĩ stele & Grand Victory Triumphal Archway (cmdX, cmdZ - 26)
  for (let b = 0; b < 4; b++) addBoxPart(w5BdRock, 2.2, 0.50, 0.65, otX - 4.5 + b * 3.0, VIETNAM_WATER_LEVEL + 3.55, otZ - 2.6);
  addBoxPart(w5BdCrimson, 1.85, 1.65, 0.45, dtX + 5.2, VIETNAM_WATER_LEVEL + 3.85, dtZ);
  const mdX = bdx + 124;
  const mdZ = bdz + 54;
  for (const [ox, oz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) addW3GroundedCol(w5BdWood, 0.10, 0.12, VIETNAM_WATER_LEVEL + 1.35, VIETNAM_WATER_LEVEL - 0.8, 5, mdX + ox, mdZ + oz);
  addBoxPart(w5BdWood, 4.4, 0.22, 4.4, mdX, VIETNAM_WATER_LEVEL + 1.42, mdZ);
  for (let j = 0; j < 5; j++) addCylPart(w5BdRock, 0.28, 0.22, 0.68, 5, cmdX - 2 + j * 0.85, VIETNAM_WATER_LEVEL + 1.55, cmdZ + 20);
  for (let bb = 0; bb < 6; bb++) {
    const bx = cmdX - 20 + bb * 8.0;
    addW3GroundedPost(w5BdRock, 0.36, 0.36, VIETNAM_WATER_LEVEL + 4.1, VIETNAM_WATER_LEVEL + 2.6, bx, cmdZ - 23);
    addConePart(w5BdBronze, 0.22, 0.28, 4, bx, VIETNAM_WATER_LEVEL + 4.24, cmdZ - 23);
  }
  addBoxPart(w5BdRock, 2.2, 3.2, 0.48, otX + 9.2, VIETNAM_WATER_LEVEL + 4.8, otZ - 4.5);
  addBoxPart(w5BdBronze, 1.65, 2.2, 0.52, otX + 9.2, VIETNAM_WATER_LEVEL + 4.9, otZ - 4.5);
  const vaX = cmdX;
  const vaZ = cmdZ - 26;
  addW3Plinth(w5BdRock, 11.6, 3.6, VIETNAM_WATER_LEVEL + 3.2, VIETNAM_WATER_LEVEL + 0.2, vaX, vaZ);
  for (const ox of [-4.4, -1.8, 1.8, 4.4]) addW3GroundedCol(w5BdCrimson, 0.16, 0.20, VIETNAM_WATER_LEVEL + 7.2, VIETNAM_WATER_LEVEL + 3.2, 6, vaX + ox, vaZ);
  addBoxPart(w5BdCrimson, 10.4, 0.72, 0.85, vaX, VIETNAM_WATER_LEVEL + 7.1, vaZ);
  addW3HipRoof(w5BdCrimson, w5BdBronze, 12.2, 4.2, VIETNAM_WATER_LEVEL + 7.45, 1.45, vaX, vaZ);

  addWave3Mesh(bdGroup, w5BdRock, ctx.materials.granite);
  addWave3Mesh(bdGroup, w5BdWood, ctx.materials.darkWood);
  addWave3Mesh(bdGroup, w5BdCrimson, ctx.materials.crimsonLacquer);
  addWave3Mesh(bdGroup, w5BdBronze, bdBronzeMat);
  addWave3Mesh(bdGroup, w5BdGreen, bdGreenMat);

  bdGroup.add(
    new THREE.Mesh(mergeNormalized(bdExpRock), ctx.materials.granite),
    new THREE.Mesh(mergeNormalized(bdExpWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bdExpCrimson), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(bdExpBronze), ctx.materials.bronzePatina ?? ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(bdExpGreen), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone),
    stakeInst,
    foamInst,
    mistInst
  );
  tagMotifIds(bdGroup, ['HV-D06', 'HV-NEW-MB-09', 'HV-NEW-MB-10', 'HV-NEW-MB-11', 'HV-NEW-MB-12']);
  ctx.scene.add(bdGroup);
  return { group: bdGroup, flareMat };
}

// ---------------------------------------------------------------------------
// Unified Entrypoint
// ---------------------------------------------------------------------------

export function buildVietnamReferenceShowUpgrades(
  ctx: VietnamBuilderContext,
  options?: { deferMacrosToZones?: boolean }
): VietnamReferenceShowController {
  const baseAnims: Array<{ uTime: { value: number } }> = [];

  const trangAnLampMat = buildTrangAnGoldenRiceKarst(ctx, baseAnims);
  const hoiAnHandles = buildHoiAnLanternUpgrades(ctx, baseAnims);
  const courtHandles = buildImperialCourtAndLotus(ctx);
  const banyanGlowMat = buildNorthernBanyanVillage(ctx);
  const festHandles = buildFestivalArtAndBrocade(ctx, baseAnims);
  buildDongSonReplicaAndMekongGarden(ctx);
  const filmMat = buildHeroicReliefAndMemoryGallery(ctx);
  const atmoHandles = buildAtmosphereEffects(ctx, baseAnims);
  const flareMat = buildDienBienAndBachDang(ctx);

  const animSet = new Set<{ uTime: { value: number } }>(baseAnims);
  let lastAtmoState: VietnamReferenceShowAtmosphereState | null = null;
  type MacroAtmoListener = (
    state: VietnamReferenceShowAtmosphereState,
    glow: number,
    darkNight: number
  ) => void;
  const macroAtmoListeners = new Set<MacroAtmoListener>();

  // Outer Macro Cultural Sanctuary Ring (v2.0 4800m × 4800m expansion)
  const sharedDongSonTex =
    ctx.cachedTextures?.dongSon ??
    (() => {
      const t = createDongSonBronzeTextures(512, ctx.renderer);
      ctx.extraTextures.push(t.map, t.normalMap, t.roughnessMap);
      if (ctx.cachedTextures) ctx.cachedTextures.dongSon = t;
      return t;
    })();
  const sharedBrocTex =
    ctx.cachedTextures?.brocade ??
    (() => {
      const t = createBrocadeTexture(ctx.renderer);
      ctx.extraTextures.push(t);
      if (ctx.cachedTextures) ctx.cachedTextures.brocade = t;
      return t;
    })();
  const sharedFilmTex =
    ctx.cachedTextures?.filmstrip ??
    (() => {
      const t = createFilmstripArchivalTexture(ctx.renderer);
      ctx.extraTextures.push(t);
      if (ctx.cachedTextures) ctx.cachedTextures.filmstrip = t;
      return t;
    })();

  const makeMacroZoneDescriptor = (
    groupName: string,
    exclusions: ExclusionCircle[],
    priority: number,
    buildFn: (
      zoneBuilderCtx: VietnamBuilderContext,
      localAnims: Array<{ uTime: { value: number } }>
    ) => { group: THREE.Group; onAtmosphere?: MacroAtmoListener }
  ): ZoneDescriptor => {
    const spec = VIETNAM_LANDMARK_REGISTRY.byGroupName(groupName);
    if (!spec) {
      throw new Error(`Missing landmark spec for macro zone: ${groupName}`);
    }
    return {
      id: spec.id,
      groupName: spec.groupName,
      region: spec.region,
      center: { x: spec.center[0], z: spec.center[1] },
      radius: spec.radius,
      priority,
      exclusions,
      build: (zoneCtx: ZoneBuildContext): ZoneBuildOutput => {
        const localAnims: Array<{ uTime: { value: number } }> = [];
        const localExtraMaterials: THREE.Material[] = [];
        const localExtraTextures: THREE.Texture[] = [];
        const localFoliageWindUniforms: Array<{ uTime: { value: number }; uWindSpeed: { value: number } }> = [];
        const localAnimatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [];
        const localJunkBoats: JunkBoatMotion[] = [];
        const zoneBuilderCtx: VietnamBuilderContext = {
          ...ctx,
          scene: zoneCtx.scene,
          exclusionCircles: [],
          junkBoats: localJunkBoats,
          extraMaterials: localExtraMaterials,
          extraTextures: localExtraTextures,
          foliageWindUniforms: localFoliageWindUniforms,
          animatedUniforms: localAnimatedUniforms
        };
        const built = buildFn(zoneBuilderCtx, localAnims);
        for (const m of localExtraMaterials) zoneCtx.scope.trackMaterial(m);
        for (const t of localExtraTextures) zoneCtx.scope.trackTexture(t);
        for (const u of localFoliageWindUniforms) ctx.foliageWindUniforms.push(u);
        for (const u of localAnimatedUniforms) ctx.animatedUniforms?.push(u);
        for (const a of localAnims) animSet.add(a);

        let listener: MacroAtmoListener | undefined;
        if (built.onAtmosphere) {
          listener = built.onAtmosphere;
          macroAtmoListeners.add(listener);
          if (lastAtmoState) {
            const darkNight = clamp01((lastAtmoState.nightAmount - 0.60) / 0.40);
            const glow = 0.15 + lastAtmoState.duskAmount * 1.1 + darkNight * 2.7;
            listener(lastAtmoState, glow, darkNight);
          }
        }

        zoneCtx.scope.trackDisposable(() => {
          for (const a of localAnims) animSet.delete(a);
          if (listener) macroAtmoListeners.delete(listener);
          if (localFoliageWindUniforms.length > 0) {
            const rm = new Set(localFoliageWindUniforms);
            for (let i = ctx.foliageWindUniforms.length - 1; i >= 0; i--) {
              if (rm.has(ctx.foliageWindUniforms[i])) ctx.foliageWindUniforms.splice(i, 1);
            }
          }
          if (localAnimatedUniforms.length > 0 && ctx.animatedUniforms) {
            const rm = new Set(localAnimatedUniforms);
            for (let i = ctx.animatedUniforms.length - 1; i >= 0; i--) {
              if (rm.has(ctx.animatedUniforms[i])) ctx.animatedUniforms.splice(i, 1);
            }
          }
        });

        return {
          group: built.group,
          movers: localJunkBoats.length > 0 ? localJunkBoats : undefined,
          exclusions
        };
      }
    };
  };

  const macroZones: ZoneDescriptor[] = [
    makeMacroZoneDescriptor(
      'TamCocMacroKarstValley',
      [
        { x: 680, z: -320, r: 165 },
        { x: 788, z: -328, r: 34 }
      ],
      10,
      (zCtx, localAnims) => {
        const res = buildTamCocMacroValley(zCtx, localAnims);
        return {
          group: res.group,
          onAtmosphere: (_s, _glow, darkNight) => {
            res.lampMat.emissiveIntensity = 0.4 + _s.duskAmount * 1.4 + darkNight * 2.0;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'HoiAnGrandLanternQuarter',
      [{ x: 640, z: 130, r: 118 }],
      11,
      (zCtx, localAnims) => {
        const res = buildHoiAnGrandLanternQuarterMacro(zCtx, localAnims);
        return {
          group: res.group,
          onAtmosphere: (_s, glow) => {
            res.silkMat.emissiveIntensity = glow;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'HoaiRiverNightPromenade',
      [{ x: 760, z: 260, r: 135 }],
      12,
      (zCtx, localAnims) => {
        const res = buildHoaiRiverNightPromenadeMacro(zCtx, localAnims);
        return {
          group: res.group,
          onAtmosphere: (s, glow, darkNight) => {
            res.silkMat.emissiveIntensity = glow;
            res.skyMat.emissiveIntensity = 0.25 + s.duskAmount * 1.0 + darkNight * 2.2;
            res.flowerMat.emissiveIntensity = 0.25 + s.duskAmount * 1.1 + darkNight * 2.4;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'HueGrandImperialPalace',
      [{ x: -660, z: 80, r: 108 }],
      13,
      (zCtx) => {
        const res = buildHueGrandImperialPalaceMacro(zCtx);
        return {
          group: res.group,
          onAtmosphere: (s, _glow, darkNight) => {
            res.palMat.emissiveIntensity = 0.2 + s.duskAmount * 0.9 + darkNight * 2.5;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'DaiLienHoaLotusSanctuary',
      [{ x: 0, z: -560, r: 108 }],
      14,
      (zCtx) => {
        const res = buildDaiLienHoaLotusSanctuaryMacro(zCtx);
        return {
          group: res.group,
          onAtmosphere: (s, _glow, darkNight) => {
            res.daiSenMat.emissiveIntensity = 0.2 + s.duskAmount * 0.8 + darkNight * 2.1;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'DuongLamAncientVillageMacro',
      [{ x: -640, z: -180, r: 140 }],
      15,
      (zCtx, localAnims) => {
        const res = buildDuongLamVillageMacro(zCtx, localAnims);
        return {
          group: res.group,
          onAtmosphere: (s, _glow, darkNight) => {
            res.warmDoorMat.emissiveIntensity = 0.2 + s.duskAmount * 0.8 + darkNight * 1.9;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'LongVanLacquerValleyMacro',
      [{ x: 820, z: -80, r: 145 }],
      16,
      (zCtx, localAnims) => ({
        group: buildLongVanLacquerValleyMacro(zCtx, localAnims)
      })
    ),
    makeMacroZoneDescriptor(
      'DongSonSunSanctuaryMacro',
      [{ x: -680, z: 420, r: 150 }],
      17,
      (zCtx) => {
        const res = buildDongSonSunSanctuaryMacro(zCtx, sharedDongSonTex);
        return {
          group: res.group,
          onAtmosphere: (s, _glow, darkNight) => {
            res.drumFaceMat.emissiveIntensity = 0.35 + s.duskAmount * 0.8 + darkNight * 1.1;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'TayNguyenBrocadeSanctuaryMacro',
      [{ x: -1160, z: 480, r: 125 }],
      18,
      (zCtx) => ({
        group: buildTayNguyenBrocadeSanctuaryMacro(zCtx, sharedBrocTex)
      })
    ),
    makeMacroZoneDescriptor(
      'DatNuocHeroicCanyonMacro',
      [{ x: -560, z: -615, r: 128 }],
      19,
      (zCtx) => ({
        group: buildDatNuocHeroicCanyonMacro(zCtx, sharedDongSonTex)
      })
    ),
    makeMacroZoneDescriptor(
      'HistoricalMemoryColonnadeMacro',
      [{ x: 0, z: -315, r: 108 }],
      20,
      (zCtx) => {
        const res = buildHistoricalMemoryColonnadeMacro(zCtx, sharedFilmTex);
        return {
          group: res.group,
          onAtmosphere: (s, _glow, darkNight) => {
            // FIX HV07-1: Sync ALL 4 filmstrip variant materials so all 19 archival frames glow uniformly at night!
            const filmEmissive = 0.35 + s.duskAmount * 1.1 + darkNight * 1.5;
            for (const m of res.filmMats) {
              m.emissiveIntensity = filmEmissive;
            }
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'TruongSonMonsoonJungleGorge',
      [{ x: 740, z: -560, r: 165 }],
      21,
      (zCtx, localAnims) => ({
        group: buildTruongSonMonsoonGorgeMacro(zCtx, localAnims)
      })
    ),
    makeMacroZoneDescriptor(
      'DienBienHighlandCitadelMacro',
      [{ x: -820, z: -485, r: 148 }],
      22,
      (zCtx) => {
        const res = buildDienBienHighlandCitadelMacro(zCtx);
        return {
          group: res.group,
          onAtmosphere: (_s, _glow, darkNight) => {
            res.flareMat.emissiveIntensity = 0.6 + darkNight * 2.2;
          }
        };
      }
    ),
    makeMacroZoneDescriptor(
      'BachDangGrandArmadaMacro',
      [],
      23,
      (zCtx) => {
        const res = buildBachDangGrandArmadaMacro(zCtx);
        return {
          group: res.group,
          onAtmosphere: (_s, _glow, darkNight) => {
            res.flareMat.emissiveIntensity = 0.6 + darkNight * 2.2;
          }
        };
      }
    )
  ];

  if (!options?.deferMacrosToZones) {
    const inlineScope: ResourceScopeLike = {
      trackObject: <T extends THREE.Object3D>(obj: T) => obj,
      trackGeometry: <T extends THREE.BufferGeometry>(geo: T) => geo,
      trackMaterial: <T extends THREE.Material>(mat: T) => {
        ctx.extraMaterials.push(mat);
        return mat;
      },
      trackTexture: <T extends THREE.Texture>(tex: T) => {
        ctx.extraTextures.push(tex);
        return tex;
      },
      trackDisposable: () => { },
      dispose: () => { }
    };
    const inlineZoneCtx: ZoneBuildContext = {
      scene: ctx.scene,
      renderer: ctx.renderer,
      scope: inlineScope,
      parts: {
        create: () => {
          throw new Error('inlineZoneCtx parts factory unused');
        }
      },
      materials: ctx.materialLib ?? {
        shared: ctx.materials,
        getOrCreateStandard: (p) => new THREE.MeshStandardMaterial(p),
        dispose: () => { }
      },
      anim: {
        register: () => { },
        registerMany: () => { },
        update: () => { },
        setWindSpeed: () => { },
        clear: () => { }
      },
      terrain: { height: ctx.getHeight, normal: ctx.getNormal },
      rng: mulberry32
    };
    for (const desc of macroZones) {
      if (desc.exclusions) ctx.exclusionCircles.push(...desc.exclusions);
      const out = desc.build(inlineZoneCtx);
      if (out.movers) ctx.junkBoats.push(...out.movers);
    }
  }

  return {
    macroZones,
    update: (elapsedTime: number, cameraPos?: THREE.Vector3) => {
      for (const a of animSet) {
        a.uTime.value = elapsedTime;
      }
      if (cameraPos && atmoHandles.rainGroup.visible) {
        atmoHandles.rainMat.uniforms.uCamPos.value.copy(cameraPos);
      }
      if (festHandles.fireShowMesh.visible) {
        festHandles.fireShowMesh.scale.y = 0.85 + Math.sin(elapsedTime * 7.5) * 0.25;
      }
    },
    setAtmosphere: (state) => {
      lastAtmoState = state;
      const { timeOfDay, weather, nightAmount, duskAmount } = state;
      const isTrueNight = timeOfDay >= 19.0 || timeOfDay < 5.0 || nightAmount > 0.68;
      const isRain = weather === 'rain';
      const darkNight = clamp01((nightAmount - 0.60) / 0.40);
      const glow = 0.15 + duskAmount * 1.1 + darkNight * 2.7;

      for (const m of hoiAnHandles.silkGlowMats) m.emissiveIntensity = glow;
      hoiAnHandles.skyMat.emissiveIntensity = 0.25 + duskAmount * 1.0 + darkNight * 2.2;
      hoiAnHandles.flowerMat.emissiveIntensity = 0.25 + duskAmount * 1.1 + darkNight * 2.4;
      courtHandles.palaceLanternMat.emissiveIntensity = 0.2 + duskAmount * 0.9 + darkNight * 2.5;
      courtHandles.daiSenMat.emissiveIntensity = 0.2 + duskAmount * 0.8 + darkNight * 2.1;
      banyanGlowMat.emissiveIntensity = 0.2 + duskAmount * 0.8 + darkNight * 1.9;
      trangAnLampMat.emissiveIntensity = 0.4 + duskAmount * 1.4 + darkNight * 2.0;
      filmMat.emissiveIntensity = 0.35 + duskAmount * 1.1 + darkNight * 1.5;
      flareMat.emissiveIntensity = 0.6 + darkNight * 2.2;

      for (const listener of macroAtmoListeners) {
        listener(state, glow, darkNight);
      }

      for (const grp of festHandles.festivalGroupRefs) {
        grp.visible = isTrueNight && !isRain;
      }

      // FIX HV08-3: Smooth twilight-to-night ramp for festival light beams (no abrupt pop-on at 19:00!)
      const beamBoost = !isRain ? clamp01(duskAmount * 0.55 + darkNight * 1.25) * 1.35 : 0.0;
      atmoHandles.beamsMat.uniforms.uIntensity.value = beamBoost;
      atmoHandles.beamsGroup.visible = beamBoost > 0.02;

      atmoHandles.rainMat.uniforms.uRainAlpha.value = isRain ? 1.0 : 0.0;
      atmoHandles.rainGroup.visible = isRain;
    }
  };
}
