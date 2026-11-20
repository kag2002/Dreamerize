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
  createMonumentalLotusParts
} from './vietnamMotifHelpers';
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

function createSoftRadialAlphaTexture(ctx: VietnamBuilderContext, size = 64): THREE.DataTexture {
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
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const diamond =
        Math.abs(((u * 6.0) % 1.0) - 0.5) + Math.abs(((v * 12.0) % 1.0) - 0.5) < 0.34;
      const zigzag = Math.abs(((v * 24.0 + Math.abs(((u * 6.0) % 1.0) - 0.5) * 1.4) % 1.0) - 0.5) < 0.14;
      const band = Math.floor(v * 6.0) % 3;
      const weave = 0.92 + 0.08 * Math.sin(u * 180.0) * Math.cos(v * 180.0);

      let r = 91;
      let g = 42;
      let b = 134; // #5B2A86 brocade_violet base
      if (band === 1) {
        r = 164;
        g = 34;
        b = 27; // #A4221B son_red
      } else if (band === 2) {
        r = 22;
        g = 32;
        b = 74; // #16204A indigo
      }
      if (diamond) {
        r = 212;
        g = 164;
        b = 58; // #D4A43A lacquer_gold
      } else if (zigzag) {
        r = 43;
        g = 179;
        b = 177; // #2BB3B1 cloud_teal
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
  // 4 distinct archival tone palettes (warm sepia, amber silver-gelatin, bronze heritage, vintage ochre)
  const tones: Array<[number, number, number]> = [
    [244, 196, 134],
    [232, 210, 170],
    [248, 178, 116],
    [224, 200, 154]
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
  const cx = 120;
  const cz = -110;
  const baseY = ctx.getHeight(cx, cz);
  const group = new THREE.Group();
  group.name = 'TrangAnGoldenRiceKarst';
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34 });

  // 1. 9 Domed Tràng An limestone towers in 3 depth layers (52–85m tall)
  const karstRockParts: THREE.BufferGeometry[] = [];
  const karstCapParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(10101);
  const towerSpecs = [
    [-38, -22, 16, 52],
    [0, -34, 19, 64],
    [42, -24, 15, 54],
    [-64, -52, 20, 74],
    [24, -64, 22, 82],
    [68, -48, 17, 60],
    [-22, -82, 24, 85],
    [54, -84, 21, 72],
    [-78, -82, 18, 62]
  ];
  for (let i = 0; i < towerSpecs.length; i++) {
    const [dx, dz, rad, h] = towerSpecs[i];
    const gx = cx + dx;
    const gz = cz + dz;
    const ty = ctx.getHeight(gx, gz) - 2.0;

    const dome = new THREE.IcosahedronGeometry(1.0, 2);
    const pos = dome.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      let vx = pos.getX(v);
      let vy = pos.getY(v);
      let vz = pos.getZ(v);
      const strata = 0.10 * Math.sin(vy * 9.0 + i) + 0.08 * noise2D(vx * 3.0, vz * 3.0, i + 7);
      // Flatten top crown slightly to create Tràng An fenglin rounded silhouette
      if (vy > 0.68) vy = 0.68 + (vy - 0.68) * 0.42;
      if (vy < -0.25) vy = -0.25 + (vy + 0.25) * 0.35;
      vx *= rad * (0.9 + strata);
      vz *= rad * (0.9 + strata);
      vy = (vy + 0.35) * h * 0.72;
      pos.setXYZ(v, vx, vy, vz);
    }
    dome.computeVertexNormals();
    dome.translate(gx, ty, gz);
    karstRockParts.push(dome);

    const cap = createSculptedRockGeometry(200 + i, rad * 0.88, h * 0.28, rad * 0.88, 2);
    cap.translate(gx, ty + h * 0.56, gz);
    karstCapParts.push(cap);
  }

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
    const rx = cx + (rand() - 0.5) * 86;
    const rz = cz + (rand() - 0.5) * 48 + 8;
    // Keep miniature Sào Khê canal & Thủy Đình water basin clear of rice stalks
    if (Math.abs(rx - (cx + 18)) < 21.5 && Math.abs(rz - (cz - 4)) < 7.8) continue;
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
  group.add(riceMesh);

  // 2.5 Thủy Đình Tràng An (2-tier curved-roof water pavilion) + Miniature Canal & Sampan
  const canalCx = cx + 18;
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
  const tdX = cx + 22;
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
  // 2-tier Vietnamese curved roofs + dragon ridge finial set
  const tdRoof1 = createVietnameseCurvedRoofGeometry(8.6, 8.6, 4.6, 4.6, 1.9, 0.72);
  tdRoof1.translate(tdX, canalY + 3.95, tdZ);
  const tdRoof2 = createVietnameseCurvedRoofGeometry(5.8, 5.8, 1.4, 1.4, 2.1, 0.85);
  tdRoof2.translate(tdX, canalY + 6.1, tdZ);
  tdRoofParts.push(tdRoof1, tdRoof2);
  const tdFinial = createRoofFinialSetParts(tdX, canalY + 8.18, tdZ, 1.6, 0, 0.62, true);
  tdRoofParts.push(...tdFinial.mainParts);
  tdGoldParts.push(...tdFinial.goldParts);

  const tdPlaque = createSignagePlaqueMesh(
    { text: 'THỦY ĐÌNH', subText: 'TRÀNG AN', width: 2.0, height: 0.56, depth: 0.12, style: 'royal' },
    ctx
  );
  tdPlaque.position.set(tdX, canalY + 3.65, tdZ + 2.55);
  group.add(tdPlaque);

  // Miniature Tràng An canal sampan with tapered bow/stern, bamboo awning & conical-hat rower
  const miniSampan = new THREE.Group();
  const msWood: THREE.BufferGeometry[] = createTaperedSampanHullParts(5.2, 1.15, 0.40);
  const msCanopy: THREE.BufferGeometry[] = [];
  const msArch = new THREE.CylinderGeometry(0.64, 0.64, 1.9, 10, 1, true, 0, Math.PI);
  msArch.rotateZ(Math.PI * 0.5);
  msArch.translate(-0.1, 0.68, 0);
  msCanopy.push(msArch);
  // Conical-hat rower at stern
  addCylPart(msWood, 0.16, 0.22, 0.62, 7, -1.65, 0.65, 0);
  const rowerHat = new THREE.ConeGeometry(0.32, 0.22, 10);
  rowerHat.translate(-1.65, 1.16, 0);
  msCanopy.push(rowerHat);
  addCylPart(msWood, 0.025, 0.035, 2.4, 5, -1.5, 0.42, 0.72, 0.35, 0.45);
  miniSampan.add(
    new THREE.Mesh(mergeNormalized(msWood), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(msCanopy), ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone)
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
    const sx = cx - 34 + (s % 4) * 18 + (rand() - 0.5) * 4;
    const sz = cz + 14 - Math.floor(s / 4) * 20;
    const sy = ctx.getHeight(sx, sz);
    const cone = new THREE.ConeGeometry(1.55, 3.3, 14);
    cone.translate(sx, sy + 1.55, sz);
    strawParts.push(cone);
    addCylPart(hutParts, 0.06, 0.08, 4.0, 6, sx, sy + 2.0, sz);
  }
  // Field watch hut on left side matching Ref 01
  const hx = cx - 28;
  const hz = cz + 16;
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
  addBoxPart(hutParts, 88, 0.25, 0.45, cx, baseY + 0.08, cz + 10);
  addBoxPart(hutParts, 88, 0.25, 0.45, cx, baseY + 0.08, cz - 8);
  addBoxPart(hutParts, 0.45, 0.25, 52, cx - 18, baseY + 0.08, cz + 4);
  addBoxPart(hutParts, 0.45, 0.25, 52, cx + 18, baseY + 0.08, cz + 4);

  const strawMat = new THREE.MeshStandardMaterial({
    color: '#b98a4a',
    map: ctx.pbr.timber.map,
    roughness: 0.90
  });
  ctx.extraMaterials.push(strawMat);
  const strawMesh = new THREE.Mesh(mergeNormalized(strawParts), strawMat);
  strawMesh.castShadow = true;
  group.add(strawMesh);

  const hutMat = new THREE.MeshStandardMaterial({
    color: '#73573b',
    map: ctx.pbr.timber.map,
    roughness: 0.88
  });
  ctx.extraMaterials.push(hutMat);
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

  // 1. Two-tier đao cong entrance pavilion gates & stacked lantern tower (`HoiAnPavilionGates`)
  const gatesGroup = new THREE.Group();
  gatesGroup.name = 'HoiAnPavilionGates';
  const colParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    const px = cx + side * 14.5;
    const pz = cz + 14;
    const py = ctx.getHeight(px, pz);
    for (const [ox, oz] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]]) {
      addCylPart(colParts, 0.22, 0.24, 7.6, 10, px + ox, py + 3.8, pz + oz);
    }
    const r1 = createVietnameseCurvedRoofGeometry(7.2, 5.2, 3.6, 2.2, 2.2, 0.72);
    r1.translate(px, py + 4.3, pz);
    roofParts.push(r1);
    const r2 = createVietnameseCurvedRoofGeometry(5.8, 4.0, 1.6, 0.8, 2.4, 0.85);
    r2.translate(px, py + 7.4, pz);
    roofParts.push(r2);
    addBoxPart(goldParts, 3.8, 0.35, 0.25, px, py + 4.1, pz + 1.8);
  }
  // Stacked red/gold central lantern tower (H 6.5m) at focal end
  const towerY = ctx.getHeight(cx, cz + 26);
  for (let tier = 0; tier < 6; tier++) {
    const rad = 0.82 - tier * 0.08;
    addCylPart(colParts, rad * 0.92, rad, 0.85, 12, cx, towerY + 0.9 + tier * 0.95, cz + 26);
    addCylPart(goldParts, rad * 1.05, rad * 1.05, 0.12, 12, cx, towerY + 1.35 + tier * 0.95, cz + 26);
  }

  // Upgrade inner Chùa Cầu (175, 45) with Lai Viễn Kiều plaques, interior Bắc Đế Trấn Võ shrine, truss & guardian statues
  const chuaCauWoodParts: THREE.BufferGeometry[] = [];
  const chuaCauStoneParts: THREE.BufferGeometry[] = [];
  const chuaCauLanternParts: THREE.BufferGeometry[] = [];
  addChuaCauInteriorAndGuardians(
    colParts,
    goldParts,
    chuaCauWoodParts,
    chuaCauStoneParts,
    chuaCauLanternParts,
    cx,
    groundY + 1.75,
    cz,
    18.0,
    'x',
    gatesGroup,
    ctx
  );
  const shrineLampMat = new THREE.MeshStandardMaterial({
    color: '#ffd280',
    emissive: new THREE.Color('#ff982a'),
    emissiveIntensity: 1.8
  });
  ctx.extraMaterials.push(shrineLampMat);

  gatesGroup.add(new THREE.Mesh(mergeNormalized(colParts), ctx.materials.crimsonLacquer));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(chuaCauWoodParts), ctx.materials.darkWood));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(chuaCauStoneParts), ctx.materials.stone));
  gatesGroup.add(new THREE.Mesh(mergeNormalized(chuaCauLanternParts), shrineLampMat));
  ctx.scene.add(gatesGroup);

  // 2. Overhead Street Lantern Canopy (`HoiAnLanternCanopy`) — 320 garlic-bulb & cylinder lanterns
  const canopyGroup = new THREE.Group();
  canopyGroup.name = 'HoiAnLanternCanopy';
  const uTimeObj = { uTime: { value: 0 } };
  animList.push(uTimeObj);

  const lanternShellGeo = createRibbedLanternShellGeometry(0.24, 0.42, 8, 5);
  const silkMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.4,
    roughness: 0.55
  });
  silkMat.userData.noDedupe = true;
  silkMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeObj.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 iPos = vec3(0.0);
       #ifdef USE_INSTANCING
       iPos = vec3(instanceMatrix[3].xyz);
       #endif
       float sway = sin(uTime * 1.35 + iPos.x * 0.5 + iPos.z * 0.35) * 0.055;
       transformed.x += sway * (0.5 - position.y);`
    );
  };
  ctx.extraMaterials.push(silkMat);

  const canopyCount = 320;
  const canopyMesh = new THREE.InstancedMesh(lanternShellGeo, silkMat, canopyCount);
  const palette = [
    new THREE.Color('#ffb347'),
    new THREE.Color('#c8102e'),
    new THREE.Color('#ffe08a'),
    new THREE.Color('#e8749a'),
    new THREE.Color('#2bb3b1')
  ];
  const rand = mulberry32(20202);
  let idx = 0;
  for (let row = 0; row < 16; row++) {
    const rz = cz - 14 + row * 2.75;
    for (let col = 0; col < 20; col++) {
      if (idx >= canopyCount) break;
      const t = col / 19;
      const rx = cx - 13.5 + t * 27.0;
      const sag = 0.55 * 4.0 * t * (1.0 - t);
      const ry = Math.max(groundY, VIETNAM_WATER_LEVEL) + 4.4 - sag + (row % 2) * 0.35;
      const sc = 0.85 + rand() * 0.4;
      setInstanceMatrix(canopyMesh, idx, rx, ry, rz, 0, rand() * Math.PI, 0, sc, sc, sc);
      canopyMesh.setColorAt(idx, palette[Math.floor(rand() * palette.length)]);
      idx++;
    }
  }
  canopyMesh.instanceMatrix.needsUpdate = true;
  if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
  canopyGroup.add(canopyMesh);

  // Subtle light-pool discs beneath pavilion gates
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
    const px = cx - 10 + (p % 4) * 6.5;
    const pz = cz - 6 + Math.floor(p / 4) * 20;
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
  const flowerMesh = new THREE.InstancedMesh(flowerLotusGeo, flowerMat, 220);
  for (let i = 0; i < 220; i++) {
    const fx = cx + (rand() - 0.5) * 26;
    const fz = cz + (rand() - 0.5) * 68;
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
  // 1. Điện Thái Hòa Throne Hall (`HueThaiHoaThroneHall`) + `HuePalaceLanterns`
  const hcx = -235;
  const hcz = 42;
  const hy = ctx.getHeight(hcx, hcz);
  ctx.exclusionCircles.push({ x: hcx, z: hcz, r: 28 });

  const hallGroup = new THREE.Group();
  hallGroup.name = 'HueThaiHoaThroneHall';

  const hallShellParts: THREE.BufferGeometry[] = [];
  const baseParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const vaseParts: THREE.BufferGeometry[] = [];

  // Raised imperial plinth & 3-tier dark-lacquered throne dais edged with gilded trim
  const daisWoodParts: THREE.BufferGeometry[] = [];
  addBoxPart(baseParts, 42, 1.0, 29, hcx, hy + 0.5, hcz);
  addBoxPart(daisWoodParts, 5.2, 0.22, 4.4, hcx - 9, hy + 1.11, hcz);
  addBoxPart(daisWoodParts, 3.8, 0.22, 3.2, hcx - 9, hy + 1.33, hcz);
  addBoxPart(daisWoodParts, 2.4, 0.22, 2.2, hcx - 9, hy + 1.55, hcz);
  addBoxPart(goldParts, 5.3, 0.08, 4.5, hcx - 9, hy + 1.22, hcz);
  addBoxPart(goldParts, 3.9, 0.08, 3.3, hcx - 9, hy + 1.44, hcz);
  addBoxPart(goldParts, 2.5, 0.08, 2.3, hcx - 9, hy + 1.66, hcz);
  // Ngai vàng Throne (Bửu Tán square gilded openwork canopy handled cleanly in addThaiHoaInteriorDetails)
  addBoxPart(goldParts, 1.3, 0.32, 1.1, hcx - 9.2, hy + 1.88, hcz);
  addBoxPart(goldParts, 0.30, 1.55, 1.25, hcx - 9.75, hy + 2.75, hcz);
  addBoxPart(goldParts, 0.65, 0.22, 0.72, hcx - 8.35, hy + 1.78, hcz); // footstool

  // Side walls & Twin Parallel Trùng Thiềm Điệp Ốc roofs separated +0.85m for Cổ Diềm Nhất Thi Nhất Họa frieze
  addBoxPart(hallShellParts, 40, 6.4, 0.6, hcx, hy + 4.2, hcz - 13.5);
  addBoxPart(hallShellParts, 40, 6.4, 0.6, hcx, hy + 4.2, hcz + 13.5);
  const mainRoof1 = createVietnameseCurvedRoofGeometry(43, 30, 32, 18, 3.4, 0.55);
  mainRoof1.translate(hcx, hy + 7.2, hcz);
  const mainRoof2 = createVietnameseCurvedRoofGeometry(34, 21, 16, 4, 4.4, 0.72);
  mainRoof2.translate(hcx, hy + 11.45, hcz);
  // Cổ Diềm Nhất Thi Nhất Họa enamel frieze panels running around inner hall clerestory
  addBoxPart(hallShellParts, 32.0, 0.88, 18.6, hcx, hy + 11.02, hcz);
  for (const side of [-1, 1]) {
    const fzPlaque = createSignagePlaqueMesh(
      { text: '一詩一畫', subText: 'THÁI HÒA', width: 22.0, height: 0.78, depth: 0.12, style: 'nhat_thi_nhat_hoa' },
      ctx
    );
    fzPlaque.position.set(hcx, hy + 11.02, hcz + side * 9.38);
    if (side < 0) fzPlaque.rotation.y = Math.PI;
    hallGroup.add(fzPlaque);
  }
  const eastFrieze = createSignagePlaqueMesh(
    { text: '一詩一畫', subText: 'ĐIỆN THÁI HÒA', width: 15.0, height: 0.78, depth: 0.12, style: 'nhat_thi_nhat_hoa' },
    ctx
  );
  eastFrieze.rotation.y = Math.PI * 0.5;
  eastFrieze.position.set(hcx + 16.08, hy + 11.02, hcz);
  hallGroup.add(eastFrieze);
  hallGroup.add(new THREE.Mesh(mergeNormalized(daisWoodParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood));

  const yellowGlazeMat = new THREE.MeshStandardMaterial({
    color: '#e1b12c',
    map: ctx.pbr.terracotta.map,
    normalMap: ctx.pbr.terracotta.normalMap,
    roughness: 0.26,
    metalness: 0.15
  });
  ctx.extraMaterials.push(yellowGlazeMat);
  hallGroup.add(new THREE.Mesh(mergeNormalized([mainRoof1, mainRoof2]), yellowGlazeMat));
  hallGroup.add(new THREE.Mesh(mergeNormalized(hallShellParts), ctx.materials.whitePlaster));

  // 24 visible red sơn son lacquered columns with white marble chân tảng lotus bases (InstancedMesh)
  const colGeo = new THREE.CylinderGeometry(0.28, 0.30, 6.8, 12);
  const colMesh = new THREE.InstancedMesh(colGeo, ctx.materials.crimsonLacquer, 24);
  const plinthGeo = new THREE.CylinderGeometry(0.42, 0.52, 0.35, 12);
  const plinthMesh = new THREE.InstancedMesh(plinthGeo, ctx.materials.stone, 24);
  let cIdx = 0;
  for (let ix = 0; ix < 6; ix++) {
    const cxCol = hcx - 14 + ix * 5.6;
    for (let iz = 0; iz < 4; iz++) {
      const czCol = hcz - 9 + iz * 6.0;
      setInstanceMatrix(colMesh, cIdx, cxCol, hy + 4.4, czCol, 0, 0, 0, 1, 1, 1);
      setInstanceMatrix(plinthMesh, cIdx, cxCol, hy + 1.18, czCol, 0, 0, 0, 1, 1, 1);
      cIdx++;
    }
  }
  colMesh.instanceMatrix.needsUpdate = true;
  plinthMesh.instanceMatrix.needsUpdate = true;
  hallGroup.add(colMesh, plinthMesh);

  // 6 Blue-and-white porcelain vases & ceremonial parasols flanking throne
  for (const vz of [-6.2, -3.8, 3.8, 6.2]) {
    addCylPart(vaseParts, 0.22, 0.32, 1.35, 12, hcx - 7.5, hy + 1.68, hcz + vz);
    addCylPart(goldParts, 0.04, 0.04, 2.8, 6, hcx - 8.2, hy + 2.4, hcz + vz);
    addCylPart(vaseParts, 0.78, 0.85, 0.28, 12, hcx - 8.2, hy + 3.8, hcz + vz);
  }
  const innerCrimsonParts: THREE.BufferGeometry[] = [];
  addThaiHoaInteriorDetails(
    innerCrimsonParts,
    goldParts,
    hcx - 9.0,
    hy + 1.02,
    hcz,
    hy + 6.4,
    hy + 7.1,
    24.0,
    hcx + 4.5
  );
  const vaseMat = new THREE.MeshStandardMaterial({
    color: '#d9e6f6',
    roughness: 0.22
  });
  ctx.extraMaterials.push(vaseMat);
  hallGroup.add(new THREE.Mesh(mergeNormalized(vaseParts), vaseMat));
  hallGroup.add(new THREE.Mesh(mergeNormalized(baseParts), ctx.materials.stone));
  hallGroup.add(new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold));
  hallGroup.add(new THREE.Mesh(mergeNormalized(innerCrimsonParts), ctx.materials.crimsonLacquer));
  ctx.scene.add(hallGroup);

  // Hexagonal Palace Lanterns (`HuePalaceLanterns`)
  const palGroup = new THREE.Group();
  palGroup.name = 'HuePalaceLanterns';
  const hexGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.95, 6);
  const palaceLanternMat = new THREE.MeshStandardMaterial({
    color: '#ffcf80',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.4,
    roughness: 0.45
  });
  palaceLanternMat.userData.noDedupe = true;
  ctx.extraMaterials.push(palaceLanternMat);
  const palInst = new THREE.InstancedMesh(hexGeo, palaceLanternMat, 23);
  for (let i = 0; i < 7; i++) {
    setInstanceMatrix(palInst, i, hcx - 6 + i * 2.8, hy + 6.3, hcz, 0, 0, 0, 1, 1, 1);
  }
  for (let i = 0; i < 16; i++) {
    const side = i < 8 ? -6.0 : 6.0;
    const step = i % 8;
    setInstanceMatrix(palInst, 7 + i, hcx - 12 + step * 3.6, hy + 5.7, hcz + side, 0, 0, 0, 0.65, 0.65, 0.65);
  }
  palInst.instanceMatrix.needsUpdate = true;
  palGroup.add(palInst);
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
  for (const px of [-28, 28]) {
    const pz = 34;
    const py = VIETNAM_WATER_LEVEL + 0.15;
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
    // Framed cleanly around the two PlazaSacredLotus pedestals (|x| <= 22.5, z in [29, 39]),
    // keeping Chùa Một Cột's entrance bridge at (-33, 22) and Tam Quan at (-41.5, 46) 100% clear!
    const ax = side * (17.5 + (k % 2) * 5.0);
    const az = 29.0 + Math.floor(k / 2) * 10.0;
    const ay = Math.max(ctx.getHeight(ax, az), VIETNAM_WATER_LEVEL + 0.1);
    setInstanceMatrix(arcadeCols, i, ax, ay + 2.2, az, 0, 0, 0, 1, 1, 1);
    setInstanceMatrix(arcadeBases, i, ax, ay + 0.22, az, 0, 0, 0, 1, 1, 1);
  }
  arcadeCols.instanceMatrix.needsUpdate = true;
  arcadeBases.instanceMatrix.needsUpdate = true;
  arcadeGroup.add(arcadeCols, arcadeBases);
  ctx.scene.add(arcadeGroup);

  return { palaceLanternMat, daiSenMat };
}

// ---------------------------------------------------------------------------
// Spec 04: Northern Banyan Village Night (-60, 132)
// ---------------------------------------------------------------------------

function buildNorthernBanyanVillage(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
  const cx = -60;
  const cz = 132;
  const by = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 24 });

  const villageGroup = new THREE.Group();
  villageGroup.name = 'LangCoBanyanVillage';

  // 1. Hero Banyan + 2 flanking trunks with aerial roots (`LangCoBanyanHero`)
  const heroGroup = new THREE.Group();
  heroGroup.name = 'LangCoBanyanHero';
  const trunkParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(40404);
  const treeAnchors: Array<[number, number, number]> = [
    [cx, cz - 14, 1.0],
    [cx - 18, cz + 14, 0.85],
    [cx + 18, cz + 14, 0.85]
  ];
  const canopyCenters: Array<[number, number, number, number]> = [];

  for (const [tx, tz, sc] of treeAnchors) {
    const ty = ctx.getHeight(tx, tz);
    // Braided multi-trunk core
    for (let t = 0; t < 6; t++) {
      const ang = (t / 6) * Math.PI * 2;
      addCylPart(
        trunkParts,
        0.26 * sc,
        0.48 * sc,
        7.5 * sc,
        7,
        tx + Math.cos(ang) * 0.65 * sc,
        ty + 3.6 * sc,
        tz + Math.sin(ang) * 0.65 * sc,
        Math.sin(ang) * 0.08,
        -Math.cos(ang) * 0.08
      );
    }
    // Spreading horizontal banyan limbs + vertical aerial roots
    for (let b = 0; b < 5; b++) {
      const ba = (b / 5) * Math.PI * 2 + rand() * 0.5;
      const len = (7.5 + rand() * 3.5) * sc;
      const limb = new THREE.CylinderGeometry(0.16 * sc, 0.34 * sc, len, 7);
      limb.rotateZ(Math.PI * 0.36);
      limb.rotateY(ba);
      const lx = tx + Math.cos(ba) * len * 0.42;
      const lz = tz + Math.sin(ba) * len * 0.42;
      limb.translate(lx, ty + 7.4 * sc, lz);
      trunkParts.push(limb);

      canopyCenters.push([lx + Math.cos(ba) * 3.2 * sc, ty + 9.2 * sc, lz + Math.sin(ba) * 3.2 * sc, 5.2 * sc]);
      for (let r = 0; r < 5; r++) {
        const rootLen = (5.0 + rand() * 3.2) * sc;
        addCylPart(
          trunkParts,
          0.03,
          0.05,
          rootLen,
          5,
          lx + (rand() - 0.5) * 4.0,
          ty + rootLen * 0.5,
          lz + (rand() - 0.5) * 4.0
        );
      }
    }
    canopyCenters.push([tx, ty + 10.5 * sc, tz, 6.2 * sc]);
  }
  const barkMesh = new THREE.Mesh(mergeNormalized(trunkParts), ctx.materials.bark);
  barkMesh.castShadow = true;
  heroGroup.add(barkMesh);

  const leafGeo = new THREE.PlaneGeometry(1.15, 1.15);
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2f5a2a',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.68
  });
  ctx.extraMaterials.push(leafMat);
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, 1200);
  for (let i = 0; i < 1200; i++) {
    const cc = canopyCenters[i % canopyCenters.length];
    const u = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const rad = cc[3] * (0.45 + 0.55 * Math.pow(rand(), 0.4));
    setInstanceMatrix(
      leafInst,
      i,
      cc[0] + rad * Math.sin(phi) * Math.cos(u),
      cc[1] + rad * Math.cos(phi) * 0.48,
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

  for (const [hx, hz, ry] of [[cx - 9.5, cz - 7, 0.35], [cx + 9.5, cz - 8, -0.35], [cx - 11.5, cz + 4, 1.2]] as Array<[number, number, number]>) {
    const hgy = ctx.getHeight(hx, hz);
    const body = new THREE.BoxGeometry(6.4, 2.8, 4.2);
    body.rotateY(ry);
    body.translate(hx, hgy + 1.4, hz);
    gateBodyParts.push(body);
    const hRoof = createGableRoofGeometry(7.2, 4.8, 1.85, 0.14, 'x');
    hRoof.rotateY(ry);
    hRoof.translate(hx, hgy + 2.8, hz);
    houseRoofParts.push(hRoof);
    const win = new THREE.BoxGeometry(1.1, 0.9, 0.14);
    win.translate(0, 1.45, 2.12);
    win.rotateY(ry);
    win.translate(hx, hgy, hz);
    warmWinParts.push(win);
  }

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

  // 1. Lacquer Karst Garden (`LacquerKarstGarden` at (335, 6))
  const lacGroup = new THREE.Group();
  lacGroup.name = 'LacquerKarstGarden';
  const peakParts: THREE.BufferGeometry[] = [];
  const jadeParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const px = 318 + i * 5.6;
    const pz = 4 + Math.sin(i * 1.4) * 6;
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

  // 3. Floating Nón Quai Thao (`FestivalNonQuaiThaoDrift`) — 36 instanced flat hats
  const nonGroup = new THREE.Group();
  nonGroup.name = 'FestivalNonQuaiThaoDrift';
  const hatTop = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16);
  const hatRim = new THREE.CylinderGeometry(0.45, 0.43, 0.12, 16, 1, true);
  hatRim.translate(0, -0.08, 0);
  const hatGeo = mergeNormalized([hatTop, hatRim]);
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#d8c9a0',
    emissive: new THREE.Color('#a4221b'),
    emissiveIntensity: 0.25,
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

  // Tilted Giant Conical Nón Lá centerpiece near Tây Nguyên plaza
  const giantNon = new THREE.Mesh(
    new THREE.ConeGeometry(4.2, 1.9, 24, 1, true),
    nonMat
  );
  giantNon.position.set(-405, ctx.getHeight(-405, 42) + 12.0, 42);
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
  const bannerInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.95, 6.2, 2, 10), brocMat, 14);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const bx = -405 + Math.cos(a) * 18;
    const bz = 42 + Math.sin(a) * 18;
    setInstanceMatrix(bannerInst, i, bx, ctx.getHeight(bx, bz) + 4.2, bz, 0, -a + Math.PI * 0.5, 0, 1, 1, 1);
  }
  bannerInst.instanceMatrix.needsUpdate = true;
  brocGroup.add(bannerInst);

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
  // 1. 1:1 Ngọc Lũ Drum Replica (`DongSonDrumReplica`) at (17, 16)
  const dx = 17.5;
  const dz = 16.0;
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

  // 2. Mekong Banana Garden (`MekongBananaGarden`) & Nipa Thatch Pavilion (`NipaThatchPavilion`) at (-95, 320)
  const mx = -95;
  const mz = 320;
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
  const bunchMat = new THREE.MeshStandardMaterial({ color: '#7fa43a', roughness: 0.55 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: '#7a1f3d', roughness: 0.5 });
  ctx.extraMaterials.push(bunchMat, flowerMat);
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
  const thatchMat = new THREE.MeshStandardMaterial({
    color: '#b98a4a',
    map: ctx.pbr.timber.map,
    roughness: 0.88,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(thatchMat);
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
    emissive: new THREE.Color('#ff8c3a'),
    emissiveMap: filmTex,
    emissiveIntensity: 0.45,
    roughness: 0.35
  });
  filmMat.userData.noDedupe = true;
  ctx.extraMaterials.push(filmMat);

  const steleFrame = new THREE.InstancedMesh(new THREE.BoxGeometry(1.48, 7.6, 0.16), ctx.materials.darkWood, 8);
  const stelePanel = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.36, 7.2), filmMat, 8);
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const sx = side * (24.0 + k * 4.2);
    const sz = -84.0 - k * 4.5;
    const sy = ctx.getHeight(sx, sz);
    const yaw = side * -0.25;
    setInstanceMatrix(steleFrame, i, sx, sy + 3.8, sz, 0, yaw, 0, 1, 1, 1);
    setInstanceMatrix(stelePanel, i, sx + Math.sin(yaw) * 0.09, sy + 3.8, sz + Math.cos(yaw) * 0.09, 0, yaw, 0, 1, 1, 1);
  }
  steleFrame.instanceMatrix.needsUpdate = true;
  stelePanel.instanceMatrix.needsUpdate = true;
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

  // 1. Crossed Cobalt & Crimson Volumetric Festival Beams (`VietnamFestivalLightBeams`, zero trusses)
  const beamsGroup = new THREE.Group();
  beamsGroup.name = 'VietnamFestivalLightBeams';
  const beamGeo = new THREE.CylinderGeometry(0.35, 4.8, 38.0, 16, 1, true);
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
    [165, 45, 0.35],
    [185, 45, -0.35],
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
  const blueCol = new THREE.Color('#1e5bff');
  const redCol = new THREE.Color('#e02424');
  for (let i = 0; i < beamSlots.length; i++) {
    const [bx, bz, tiltZ] = beamSlots[i];
    const by = Math.max(ctx.getHeight(bx, bz), VIETNAM_WATER_LEVEL + 0.15);
    setInstanceMatrix(beamInst, i, bx, by + 0.45, bz, 0, (i % 4) * 0.25, tiltZ, 1, 1.18, 1);
    setInstanceMatrix(pedInst, i, bx, by + 0.22, bz, 0, 0, 0, 1, 1, 1);
    beamInst.setColorAt(i, i % 2 === 0 ? blueCol : redCol);
  }
  beamInst.instanceMatrix.needsUpdate = true;
  pedInst.instanceMatrix.needsUpdate = true;
  if (beamInst.instanceColor) beamInst.instanceColor.needsUpdate = true;
  beamsGroup.add(beamInst, pedInst);
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
  const cragMat = new THREE.MeshStandardMaterial({
    color: '#253658',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.86
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

  // 180 Instanced burlap sandbags along crescent parapet
  const bagGeo = new THREE.BoxGeometry(0.55, 0.18, 0.35);
  const bagMat = new THREE.MeshStandardMaterial({ color: '#9a8262', roughness: 0.94 });
  ctx.extraMaterials.push(bagMat);
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
    const hullLen = 20 * scale;
    const beam = 4.8 * scale;
    addBoxPart(hullParts, hullLen, 1.8 * scale, beam, 0, 0.4 * scale, 0);
    addBoxPart(hullParts, 5.2 * scale, 2.2 * scale, beam * 0.88, -hullLen * 0.28, 1.9 * scale, 0);
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
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(sailW, sailH), redSailMat);
      sail.position.set(mx + 0.32 * scale, mh * 0.28 + sailH * 0.5, 0);
      sail.rotation.y = Math.PI * 0.5;
      ship.add(sail);
    }
    ship.add(new THREE.Mesh(mergeNormalized(hullParts), ctx.materials.darkWood));

    // Bow braziers on flagship & lead escorts
    const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 8, 6), flareMat);
    brazier.position.set(hullLen * 0.48, 1.6 * scale, 0);
    ship.add(brazier);

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

  // 85 tilted iron-tipped cọc gỗ lim Bạch Đằng stakes + tidal foam collars
  const logPart = new THREE.CylinderGeometry(0.16, 0.22, 3.8, 8);
  const ironTip = new THREE.ConeGeometry(0.16, 0.48, 4);
  ironTip.translate(0, 2.14, 0);
  const stakeGeo = mergeNormalized([logPart, ironTip]);
  const stakeMat = new THREE.MeshStandardMaterial({
    color: '#2b1c14',
    roughness: 0.65,
    metalness: 0.25
  });
  ctx.extraMaterials.push(stakeMat);
  const stakeInst = new THREE.InstancedMesh(stakeGeo, stakeMat, 85);

  const foamGeo = new THREE.RingGeometry(0.24, 0.56, 12);
  foamGeo.rotateX(-Math.PI / 2);
  const foamMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  ctx.extraMaterials.push(foamMat);
  const foamInst = new THREE.InstancedMesh(foamGeo, foamMat, 85);

  for (let i = 0; i < 85; i++) {
    const row = i % 3;
    const t = i / 85;
    const sx = bdx - 48 + t * 96 + (rand() - 0.5) * 4;
    const sz = bdz + 22 + row * 8.5 + (rand() - 0.5) * 3;
    const tilt = 0.24 + rand() * 0.24; // 14..28 degrees lean against incoming current
    setInstanceMatrix(stakeInst, i, sx, VIETNAM_WATER_LEVEL + 0.15, sz, tilt, (rand() - 0.5) * 0.2, 0, 1, 1, 1);
    setInstanceMatrix(foamInst, i, sx, VIETNAM_WATER_LEVEL + 0.05, sz, 0, 0, 0, 1, 1, 1);
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
  // Sculpted auspicious cloud puffs
  const puffs: Array<[number, number, number]> = [
    [-2.4, -0.1, 1.35],
    [-0.9, 0.35, 1.65],
    [0.7, 0.72, 1.9],
    [2.1, 0.15, 1.5],
    [3.3, -0.25, 1.05]
  ];
  for (const [ox, oy, rad] of puffs) {
    const puff = new THREE.SphereGeometry(rad, 7, 5);
    puff.scale(1.45, 0.50, 0.38);
    puff.translate(ox, oy, 0);
    parts.push(puff);
  }
  // Carved spiral Tường Vân scroll curls (*vân xoắn ốc*) & tapering cloud tail
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
    parts.push(spiralOuter, spiralInner);
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.6, -0.35, 0),
    new THREE.Vector3(-4.8, -0.15, 0),
    new THREE.Vector3(-5.8, -0.52, 0)
  ]);
  parts.push(new THREE.TubeGeometry(tailCurve, 5, 0.18, 4, false));
  return mergeNormalized(parts);
}

function createRedLacquerColumnShaderMat(
  ctx: VietnamBuilderContext,
  motif: 'longVan' | 'lotus'
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#a4221b',
    roughness: 0.28,
    metalness: 0.04,
    clearcoat: 0.62,
    clearcoatRoughness: 0.18
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vColLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvColLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vColLocal;')
      .replace(
        '#include <color_fragment>',
        motif === 'longVan'
          ? `#include <color_fragment>
             float ang = atan(vColLocal.z, vColLocal.x);
             float hNorm = clamp((vColLocal.y + 4.2) / 8.4, 0.0, 1.0);
             float bandTop = smoothstep(0.84, 0.88, hNorm) * (1.0 - smoothstep(0.95, 0.98, hNorm));
             float bandBot = smoothstep(0.06, 0.10, hNorm) * (1.0 - smoothstep(0.18, 0.22, hNorm));
             float scroll = abs(sin(ang * 6.0 + sin(hNorm * 24.0) * 1.4));
             float spiral = 1.0 - smoothstep(0.04, 0.12, abs(fract(ang / 6.28318 + hNorm * 1.45) - 0.5));
             float goldMask = clamp(max((bandTop + bandBot) * step(0.45, scroll), spiral * 0.85), 0.0, 1.0);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.64, 0.23), goldMask);`
          : `#include <color_fragment>
             float ang = atan(vColLocal.z, vColLocal.x);
             float hNorm = clamp((vColLocal.y + 4.2) / 8.4, 0.0, 1.0);
             float stem = 1.0 - smoothstep(0.015, 0.055, abs(sin(ang * 3.0 + hNorm * 5.2)));
             float petalRing = smoothstep(0.66, 0.72, hNorm) * (1.0 - smoothstep(0.86, 0.92, hNorm)) *
                               (1.0 - smoothstep(0.15, 0.35, abs(sin(ang * 6.0))));
             float goldMask = clamp(max(stem * 0.85, petalRing), 0.0, 1.0);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.68, 0.28), goldMask);`
      );
  };
  ctx.extraMaterials.push(mat);
  return mat;
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
  for (let i = 0; i < towerDefs.length; i++) {
    const [dx, dz, rad, h] = towerDefs[i];
    const gx = cx + dx;
    const gz = cz + dz;
    const ty = ctx.getHeight(gx, gz) - 3.0;
    const dome = new THREE.IcosahedronGeometry(1.0, 2);
    const pos = dome.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      let vx = pos.getX(v);
      let vy = pos.getY(v);
      let vz = pos.getZ(v);
      const strata = 0.11 * Math.sin(vy * 8.0 + i) + 0.08 * noise2D(vx * 3.0, vz * 3.0, i + 17);
      if (vy > 0.66) vy = 0.66 + (vy - 0.66) * 0.38;
      if (vy < -0.25) vy = -0.25 + (vy + 0.25) * 0.35;
      vx *= rad * (0.9 + strata);
      vz *= rad * (0.9 + strata);
      vy = (vy + 0.35) * h * 0.72;
      pos.setXYZ(v, vx, vy, vz);
    }
    dome.computeVertexNormals();
    dome.translate(gx, ty, gz);
    rockParts.push(dome);
    const cap = createSculptedRockGeometry(1200 + i, rad * 0.86, h * 0.24, rad * 0.86, 2);
    cap.translate(gx, ty + h * 0.56, gz);
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
    new THREE.Color('#4f9e38'), // young emerald green rice
    new THREE.Color('#8ec13c'), // chartreuse/lime maturing rice
    new THREE.Color('#d9a441'), // golden ripe rice
    new THREE.Color('#ecc24e')  // sunlit amber harvest rice
  ];
  let placed = 0;
  for (let i = 0; i < riceCount * 2 && placed < riceCount; i++) {
    const rx = cx + (rand() - 0.5) * 280;
    const rz = cz + 15 + (rand() - 0.5) * 165;
    const canalZ = -308.0 + 18.0 * Math.sin((rx - cx) * 0.016);
    if (Math.abs(rz - canalZ) < 13.5) continue;
    const ry = ctx.getHeight(rx, rz);
    if (ry < 0.4) continue;
    const sc = 0.85 + rand() * 0.5;
    setInstanceMatrix(riceInst, placed, rx, ry, rz, 0, rand() * 6.28, 0, sc, sc, sc);
    // Natural multi-tone Tam Cốc paddy plot mosaic (emerald -> lime -> golden ripe)
    const plotVal = clamp01(0.5 + 0.5 * noise2D(Math.floor(rx / 24) * 0.7, Math.floor(rz / 22) * 0.7, 1212) + (rand() - 0.5) * 0.18);
    const pCol = tamCocPaddyPalette[Math.min(tamCocPaddyPalette.length - 1, Math.floor(plotVal * tamCocPaddyPalette.length))];
    riceInst.setColorAt(placed, pCol);
    placed++;
  }
  riceInst.count = placed;
  riceInst.instanceMatrix.needsUpdate = true;
  if (riceInst.instanceColor) riceInst.instanceColor.needsUpdate = true;
  group.add(riceInst);

  // 3. 11 Straw Stacks (đống rơm), Earthen Bunds & 2 Stilt Watch Huts (chòi canh lúa)
  const strawParts: THREE.BufferGeometry[] = [];
  const timberParts: THREE.BufferGeometry[] = [];
  const strawCoords: Array<[number, number]> = [
    [cx - 98, cz + 65], [cx - 88, cz + 72], [cx - 72, cz + 62], [cx - 114, cz + 48],
    [cx - 64, cz + 42], [cx + 88, cz + 68], [cx + 102, cz + 56], [cx + 118, cz + 74],
    [cx + 76, cz + 42], [cx - 42, cz + 82], [cx + 46, cz + 84]
  ];
  for (const [sx, sz] of strawCoords) {
    const sy = Math.max(1.2, ctx.getHeight(sx, sz));
    const cone = new THREE.ConeGeometry(1.75, 3.8, 14);
    cone.translate(sx, sy + 1.85, sz);
    strawParts.push(cone);
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
    const roof = new THREE.ConeGeometry(2.65, 2.05, 4);
    roof.rotateY(Math.PI * 0.25);
    roof.translate(hx, hy + 3.85, hz);
    strawParts.push(roof);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMat);
    lamp.position.set(hx, hy + 2.35, hz);
    group.add(lamp);
  }
  // FIX Bug B18: Clip the 5 earthen bunds cleanly at the banks of the meandering Ngô Đồng canal
  const canalCenterZ = (x: number): number => -308.0 + 18.0 * Math.sin((x - cx) * 0.016);
  for (let b = -2; b <= 2; b++) {
    const bundZ = cz + b * 36;
    const xMin = cx - 130;
    const xMax = cx + 130;
    const stepX = 4.0;
    let segStart: number | null = null;
    for (let x = xMin; x <= xMax + 0.01; x += stepX) {
      const inCanal = Math.abs(bundZ - canalCenterZ(x)) < 15.0 || ctx.getHeight(x, bundZ) < 0.45;
      const atEnd = x >= xMax - 0.01;
      if (!inCanal && segStart === null) {
        segStart = x;
      } else if ((inCanal || atEnd) && segStart !== null) {
        const segEnd = inCanal ? x - stepX : xMax;
        const segLen = segEnd - segStart;
        if (segLen >= 3.0) {
          addBoxPart(timberParts, segLen, 0.28, 0.55, (segStart + segEnd) * 0.5, 1.32, bundZ);
        }
        segStart = null;
      }
    }
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
  const rowerCoatMat = new THREE.MeshStandardMaterial({ color: '#2b4768', roughness: 0.78 });
  const vestMat = new THREE.MeshStandardMaterial({ color: '#e85a1c', roughness: 0.72 });
  ctx.extraMaterials.push(rowerCoatMat, vestMat);

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
  const bdWaterMat = new THREE.MeshStandardMaterial({
    color: '#235e54',
    roughness: 0.16,
    metalness: 0.20,
    transparent: true,
    opacity: 0.90
  });
  const bdPadMat = new THREE.MeshStandardMaterial({ color: '#3f7236', roughness: 0.58, side: THREE.DoubleSide });
  const bdLotusMat = new THREE.MeshStandardMaterial({
    color: '#eb79a0',
    emissive: new THREE.Color('#ff6699'),
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(bdWaterMat, bdPadMat, bdLotusMat);
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

  const tqRoof1 = createVietnameseCurvedRoofGeometry(11.6, 4.2, 7.6, 1.4, 1.85, 0.65);
  tqRoof1.translate(tqX, bdY + 4.75, tqZ);
  const tqRoof2 = createVietnameseCurvedRoofGeometry(6.6, 3.4, 3.6, 0.9, 1.95, 0.78);
  tqRoof2.translate(tqX, bdY + 6.55, tqZ);
  bdRoofParts.push(tqRoof1, tqRoof2);
  const tqFinial = createRoofFinialSetParts(tqX, bdY + 8.5, tqZ, 3.6, 0, 0.72, true);
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
  // Massive rear cliff massif
  const ctCliffBack = createSculptedRockGeometry(6391, 16.5, 17.5, 10.5, 2);
  ctCliffBack.translate(ctX, ctY + 9.5, ctZ - 9.2);
  cavernOchreParts.push(ctCliffBack);
  // Sweeping overhanging limestone cave roof hood arching forward OVER Chùa Trung's upper roof (z = ctZ - 4 .. ctZ + 3.2)
  const ctOverhangArch = createSculptedRockGeometry(6392, 15.5, 5.2, 8.8, 2);
  ctOverhangArch.translate(ctX, ctY + 11.8, ctZ - 0.8);
  cavernOchreParts.push(ctOverhangArch);
  const ctOverhangLip = createSculptedRockGeometry(6393, 12.8, 2.8, 4.6, 2);
  ctOverhangLip.translate(ctX, ctY + 10.6, ctZ + 3.4);
  cavernOchreParts.push(ctOverhangLip);
  // Flanking left & right cavern limestone cheek walls embracing the sanctuary
  for (const side of [-1, 1]) {
    const cheek = createSculptedRockGeometry(6395 + side, 5.4, 11.5, 7.8, 2);
    cheek.translate(ctX + side * 10.2, ctY + 4.8, ctZ - 1.5);
    cavernOchreParts.push(cheek);
  }
  const cavernOchreMat = new THREE.MeshStandardMaterial({
    color: '#827358',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.88
  });
  ctx.extraMaterials.push(cavernOchreMat);
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

  // Upturned double curved mossy tile roofs with white-plaster *bờ giải* ridge trim & curved dragon corner finials
  const ctRoof1 = createVietnameseCurvedRoofGeometry(13.6, 7.6, 9.0, 2.2, 2.25, 0.85);
  ctRoof1.translate(ctX, ctY + 4.05, ctZ + 0.1);
  const ctRoof2 = createVietnameseCurvedRoofGeometry(9.4, 5.2, 4.8, 1.1, 2.05, 0.92);
  ctRoof2.translate(ctX, ctY + 6.15, ctZ + 0.1);
  bdRoofParts.push(ctRoof1, ctRoof2);
  // White-plaster *bờ giải* ridge strips & upturned corner finials (*đầu đao*)
  addBoxPart(bdWhitePlasterParts, 5.2, 0.28, 0.32, ctX, ctY + 8.22, ctZ + 0.1);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tip = new THREE.ConeGeometry(0.18, 0.95, 5);
      tip.rotateZ(-sx * 0.65);
      tip.rotateX(sz * 0.35);
      tip.translate(ctX + sx * 6.5, ctY + 4.55, ctZ + 0.1 + sz * 3.55);
      bdPolychromeParts.push(tip);
    }
  }
  const ctFinial = createRoofFinialSetParts(ctX, ctY + 8.25, ctZ + 0.1, 4.8, 0, 0.82, true);
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

  const mossyRoofMat = new THREE.MeshStandardMaterial({
    color: '#6e4934',
    map: ctx.pbr.terracotta.map,
    normalMap: ctx.pbr.terracotta.normalMap,
    roughness: 0.78
  });
  ctx.extraMaterials.push(mossyRoofMat);
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

  const caveMat = new THREE.MeshStandardMaterial({
    color: '#55544d',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.88
  });
  const stalMat = new THREE.MeshStandardMaterial({
    color: '#7a766c',
    roughness: 0.82
  });
  ctx.extraMaterials.push(caveMat, stalMat);
  group.add(
    new THREE.Mesh(mergeNormalized(caveParts), caveMat),
    new THREE.Mesh(mergeNormalized(stalactiteParts), stalMat)
  );

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

  // Twin monumental 2-tier Hội Quán pavilions (Left & Right)
  for (const side of [-1, 1]) {
    const px = qx + side * 26;
    const pz = qz + 18;
    const py = ctx.getHeight(px, pz);
    for (const [ox, oz] of [[-4.2, -3.2], [4.2, -3.2], [-4.2, 3.2], [4.2, 3.2]]) {
      addCylPart(colParts, 0.30, 0.34, 9.6, 12, px + ox, py + 4.8, pz + oz);
    }
    addBoxPart(woodParts, 10.6, 0.35, 8.2, px, py + 5.2, pz); // upper balcony deck
    addBoxPart(woodParts, 10.8, 0.95, 0.25, px, py + 5.85, pz + 4.0);
    addBoxPart(woodParts, 10.8, 0.95, 0.25, px, py + 5.85, pz - 4.0);
    const r1 = createVietnameseCurvedRoofGeometry(13.0, 10.2, 6.4, 4.4, 2.8, 0.85);
    r1.translate(px, py + 5.1, pz);
    roofParts.push(r1);
    const r2 = createVietnameseCurvedRoofGeometry(9.6, 7.2, 2.2, 1.0, 3.0, 1.05);
    r2.translate(px, py + 9.2, pz);
    roofParts.push(r2);
    addBoxPart(goldParts, 4.8, 0.45, 0.3, px, py + 4.7, pz + 3.2);
    // Side access staircase climbing cleanly to upper Hội Quán balcony
    const stairX = px + side * 6.2;
    for (let st = 0; st < 10; st++) {
      const f = st / 9;
      addBoxPart(woodParts, 1.9, 0.24, 0.65, stairX, py + 0.35 + f * 4.85, pz + 4.2 - f * 6.4);
    }
    colParts.push(...createPiercedBalustradeParts(stairX + side * 0.92, pz + 4.2, stairX + side * 0.92, pz - 2.2, py + 2.8, 0.85, 'con_tien'));
  }

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
    const bridgeLampMat = new THREE.MeshStandardMaterial({
      color: '#ffd280',
      emissive: new THREE.Color('#ff982a'),
      emissiveIntensity: 1.8
    });
    ctx.extraMaterials.push(bridgeLampMat);
    qGroup.add(new THREE.Mesh(mergeNormalized(macroBridgeLanterns), bridgeLampMat));
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

  qGroup.add(
    new THREE.Mesh(mergeNormalized(colParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(wallParts), ctx.materials.yellowOchrePlaster),
    new THREE.Mesh(mergeNormalized(winParts), silkMat),
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

  rGroup.add(flowerInst, skyInst);
  ctx.scene.add(rGroup);
  return { group: rGroup, silkMat, skyMat, flowerMat };
}

function buildHueGrandImperialPalaceMacro(ctx: VietnamBuilderContext): {
  group: THREE.Group;
  palMat: THREE.MeshStandardMaterial;
} {
  const cx = -660;
  const cz = 80;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 108 });
  const group = new THREE.Group();
  group.name = 'HueGrandImperialPalace';
  const y = ctx.getHeight(cx, cz);

  const stoneParts: THREE.BufferGeometry[] = [];
  const wallParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const vaseParts: THREE.BufferGeometry[] = [];

  // Stepped Sân Đại Triều Nghi esplanade & Điện Thái Hòa plinth
  addBoxPart(stoneParts, 78, 0.65, 62, cx + 10, y + 0.32, cz);
  addBoxPart(stoneParts, 54, 1.25, 36, cx - 20, y + 0.62, cz);
  addBoxPart(wallParts, 50, 7.6, 0.7, cx - 20, y + 5.05, cz - 17);
  addBoxPart(wallParts, 50, 7.6, 0.7, cx - 20, y + 5.05, cz + 17);
  addBoxPart(wallParts, 0.7, 7.6, 34, cx - 44, y + 5.05, cz);

  // 3 Sculpted Stone Dragon Staircases climbing the 1.25m palace plinth from Sân Đại Triều Nghi
  const stairConfigs: Array<[number, number]> = [
    [cz - 10.2, 3.6],
    [cz, 5.4],
    [cz + 10.2, 3.6]
  ];
  for (const [sz, sw] of stairConfigs) {
    for (let st = 0; st < 5; st++) {
      const frac = st / 4;
      const sx = cx + 10.6 - st * 0.85;
      const sh = 0.14 + frac * 0.56;
      addBoxPart(stoneParts, 0.92, sh, sw, sx, y + 0.65 + sh * 0.5, sz);
    }
    for (const side of [-1, 1]) {
      const railZ = sz + side * (sw * 0.5 + 0.28);
      stoneParts.push(
        ...createCarvedDragonBalustradeParts(cx + 10.8, y + 0.65, railZ, cx + 7.0, y + 1.25, railZ, 0.88)
      );
    }
  }

  // Pierced stone courtyard balustrades (*Chữ Vạn*) framing OUTER Sân Đại Triều Nghi perimeter ONLY (front view of 2-tier terrace kept completely open per ref 18!)
  stoneParts.push(
    ...createPiercedBalustradeParts(cx + 48.6, cz - 30.5, cx + 48.6, cz - 6.0, y + 0.65, 0.92, 'chu_van'),
    ...createPiercedBalustradeParts(cx + 48.6, cz + 6.0, cx + 48.6, cz + 30.5, y + 0.65, 0.92, 'chu_van'),
    ...createPiercedBalustradeParts(cx + 7.0, cz - 30.5, cx + 48.6, cz - 30.5, y + 0.65, 0.92, 'chu_van'),
    ...createPiercedBalustradeParts(cx + 7.0, cz + 30.5, cx + 48.6, cz + 30.5, y + 0.65, 0.92, 'chu_van')
  );
  // 2 Thanh-stone & blue-and-white ceramic bonsai planters flanking the central Dragon Staircase
  for (const side of [-1, 1]) {
    addBoxPart(stoneParts, 1.35, 0.52, 1.35, cx + 11.4, y + 0.91, cz + side * 4.2);
    addCylPart(vaseParts, 0.62, 0.45, 0.65, 10, cx + 11.4, y + 1.48, cz + side * 4.2);
  }

  // 2 Bronze Kỳ Lân guardians & 2 Imperial Bronze Vạc Đồng urns fronting Điện Thái Hòa
  for (const side of [-1, 1]) {
    bronzeParts.push(
      ...createGuardianBeastParts(cx + 12.6, y + 0.65, cz + side * 6.4, Math.PI * 0.5, 1.48, 'kylan')
    );
    const urn = createImperialUrnParts(cx + 14.0, y + 0.65, cz + side * 14.8, 1.38);
    stoneParts.push(...urn.stoneParts);
    bronzeParts.push(...urn.bronzeParts);
  }

  // FIX R33: Authentic Trùng Thiềm Điệp Ốc — Raise upper roofs by +0.85m above lower eave & insert Cổ Diềm Nhất Thi Nhất Họa enamel frieze around ALL 4 sides!
  // Front Hall (*Tiền Điện*, East side at cx - 8.5)
  const frontRoofLow = createVietnameseCurvedRoofGeometry(26.0, 38.5, 19.0, 30.0, 3.4, 0.72);
  frontRoofLow.translate(cx - 8.5, y + 8.85, cz);
  const frontRoofHigh = createVietnameseCurvedRoofGeometry(19.5, 31.0, 4.2, 22.0, 4.2, 0.82);
  frontRoofHigh.translate(cx - 8.5, y + 13.00, cz);
  // Main Throne Hall (*Chính Điện*, West side at cx - 31.5, slightly taller)
  const mainRoofLow = createVietnameseCurvedRoofGeometry(27.0, 38.5, 20.0, 30.0, 3.6, 0.72);
  mainRoofLow.translate(cx - 31.5, y + 9.25, cz);
  const mainRoofHigh = createVietnameseCurvedRoofGeometry(20.5, 31.5, 4.4, 22.5, 4.8, 0.88);
  mainRoofHigh.translate(cx - 31.5, y + 13.60, cz);
  // Central *Thừa Lưu* valley roof linking Tiền Điện & Chính Điện seamlessly
  addBoxPart(roofParts, 7.6, 0.55, 35.4, cx - 20.0, y + 9.45, cz);
  addBoxPart(goldParts, 7.8, 0.24, 35.6, cx - 20.0, y + 9.15, cz);
  roofParts.push(frontRoofLow, frontRoofHigh, mainRoofLow, mainRoofHigh);

  const macroCrimsonParts: THREE.BufferGeometry[] = [];
  const daisIronwoodParts: THREE.BufferGeometry[] = [];

  // Multicolor enamel *Cổ Diềm Nhất Thi Nhất Họa* frieze drum & panels wrapping ALL 4 sides of BOTH Tiền Điện & Chính Điện!
  const coDiemHalls: Array<{ hx: number; drumY: number; wX: number; wZ: number }> = [
    { hx: cx - 8.5, drumY: y + 12.56, wX: 18.6, wZ: 29.6 },
    { hx: cx - 31.5, drumY: y + 13.16, wX: 19.4, wZ: 30.0 }
  ];
  for (const h of coDiemHalls) {
    addBoxPart(macroCrimsonParts, h.wX, 0.90, h.wZ, h.hx, h.drumY, cz);
    // East & West enamel frieze panels (Nhất Thi Nhất Họa)
    for (const sx of [-1, 1]) {
      const ewPlaque = createSignagePlaqueMesh(
        { text: '一詩一畫', subText: 'THÁI HÒA', width: h.wZ * 0.88, height: 0.78, depth: 0.14, style: 'nhat_thi_nhat_hoa' },
        ctx
      );
      ewPlaque.rotation.y = sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      ewPlaque.position.set(h.hx + sx * (h.wX * 0.5 + 0.06), h.drumY, cz);
      group.add(ewPlaque);
    }
    // North & South enamel frieze panels
    for (const sz of [-1, 1]) {
      const nsPlaque = createSignagePlaqueMesh(
        { text: '一詩一畫', subText: 'ĐẠI NỘI HUẾ', width: h.wX * 0.86, height: 0.78, depth: 0.14, style: 'nhat_thi_nhat_hoa' },
        ctx
      );
      if (sz < 0) nsPlaque.rotation.y = Math.PI;
      nsPlaque.position.set(h.hx, h.drumY, cz + sz * (h.wZ * 0.5 + 0.06));
      group.add(nsPlaque);
    }
  }

  // Twin Lưỡng Long Chầu Nguyệt + Phoenix-corner ridge finial sets crowning BOTH raised parallel ridges
  const frontFinials = createRoofFinialSetParts(cx - 8.5, y + 17.20, cz, 21.5, Math.PI * 0.5, 1.25, true);
  const mainFinials = createRoofFinialSetParts(cx - 31.5, y + 18.40, cz, 22.0, Math.PI * 0.5, 1.35, true);
  roofParts.push(...frontFinials.mainParts, ...mainFinials.mainParts);
  goldParts.push(...frontFinials.goldParts, ...mainFinials.goldParts);

  // Readable "ĐIỆN THÁI HÒA" imperial plaque over the East entrance fascia
  const thaiHoaPlaque = createSignagePlaqueMesh(
    { text: 'ĐIỆN THÁI HÒA', subText: '太 和 殿', width: 5.2, height: 1.42, depth: 0.22, style: 'royal' },
    ctx
  );
  thaiHoaPlaque.rotation.y = Math.PI * 0.5;
  thaiHoaPlaque.position.set(cx + 5.15, y + 8.35, cz);
  group.add(thaiHoaPlaque);

  for (const side of [-1, 1]) {
    addBoxPart(wallParts, 34, 5.2, 10, cx + 12, y + 3.25, cz + side * 38);
    const wr = createVietnameseCurvedRoofGeometry(36, 12, 26, 3, 2.8, 0.45);
    wr.translate(cx + 12, y + 5.85, cz + side * 38);
    roofParts.push(wr);
  }

  // 2 White-Plaster Gable Side Walls (*Tường Hồi*) with Iconic Red Circular *Chữ Thọ* (壽) Medallion Windows (ref 18)
  for (const side of [-1, 1]) {
    const gableZ = cz + side * 17.0;
    addBoxPart(wallParts, 16.5, 3.6, 0.65, cx - 8.5, y + 10.6, gableZ);
    addBoxPart(wallParts, 17.0, 3.8, 0.65, cx - 31.5, y + 10.9, gableZ);
    for (const gx of [cx - 8.5, cx - 31.5]) {
      const thoRim = new THREE.TorusGeometry(1.32, 0.14, 7, 20);
      thoRim.translate(gx, y + 6.45, gableZ + side * 0.38);
      macroCrimsonParts.push(thoRim);
      const thoInner = new THREE.TorusGeometry(0.88, 0.08, 6, 16);
      thoInner.translate(gx, y + 6.45, gableZ + side * 0.40);
      goldParts.push(thoInner);
      // Stylized Chữ Thọ geometric lattice cross-bars inside circular window
      addBoxPart(macroCrimsonParts, 2.25, 0.12, 0.10, gx, y + 6.45, gableZ + side * 0.40);
      addBoxPart(macroCrimsonParts, 0.12, 2.25, 0.10, gx, y + 6.45, gableZ + side * 0.40);
      addBoxPart(macroCrimsonParts, 1.45, 0.10, 0.10, gx, y + 7.05, gableZ + side * 0.40);
      addBoxPart(macroCrimsonParts, 1.45, 0.10, 0.10, gx, y + 5.85, gableZ + side * 0.40);
    }
  }

  // 9-Bay Red *Cửa Bức Bàn* Folding Doors along East Facade (central royal bay ajar so Golden Throne shines through!)
  const eastDoorX = cx + 4.75;
  for (let bay = -4; bay <= 4; bay++) {
    const bz = cz + bay * 3.55;
    if (bay === 0) {
      // Central royal portal: twin folded door leaves swung open 65° inward
      for (const s of [-1, 1]) {
        addBoxPart(macroCrimsonParts, 1.35, 3.85, 0.14, eastDoorX - 0.55, y + 3.22, bz + s * 1.48, s * 0.48);
        addBoxPart(goldParts, 1.12, 0.14, 0.16, eastDoorX - 0.55, y + 3.22, bz + s * 1.48, s * 0.48);
      }
      continue;
    }
    // 4-leaf folding *cửa bức bàn* per flanking bay (lower vermilion lacquer panels + upper vertical lattice)
    for (let lf = 0; lf < 4; lf++) {
      const lz = bz - 1.20 + lf * 0.80;
      addBoxPart(macroCrimsonParts, 0.14, 1.65, 0.72, eastDoorX, y + 2.12, lz);
      addBoxPart(goldParts, 0.16, 0.10, 0.64, eastDoorX + 0.04, y + 2.95, lz);
      addBoxPart(macroCrimsonParts, 0.12, 0.10, 0.72, eastDoorX, y + 4.95, lz);
      for (const sp of [-0.22, 0, 0.22]) {
        addCylPart(macroCrimsonParts, 0.025, 0.025, 1.92, 5, eastDoorX, y + 3.96, lz + sp);
      }
    }
  }

  // FIX R33: 3-Tier Dark-Lacquered Ironwood Throne Dais edged with Gilded Dragon Relief Panels + Sculpted Ngai Vàng (ref 53, 106b)
  addBoxPart(daisIronwoodParts, 6.2, 0.30, 5.2, cx - 32, y + 1.40, cz);
  addBoxPart(daisIronwoodParts, 4.4, 0.30, 3.8, cx - 32, y + 1.70, cz);
  addBoxPart(daisIronwoodParts, 2.8, 0.30, 2.6, cx - 32, y + 2.00, cz);
  // Gilded dragon relief edge moldings framing all 3 dais tiers
  for (const [dw, dd, dy] of [
    [6.32, 5.32, y + 1.40],
    [4.52, 3.92, y + 1.70],
    [2.92, 2.72, y + 2.00]
  ]) {
    addBoxPart(goldParts, dw, 0.09, dd, cx - 32, dy + 0.13, cz);
    addBoxPart(goldParts, dw + 0.04, 0.12, 0.08, cx - 32, dy, cz + dd * 0.5);
    addBoxPart(goldParts, dw + 0.04, 0.12, 0.08, cx - 32, dy, cz - dd * 0.5);
    addBoxPart(goldParts, 0.08, 0.12, dd + 0.04, cx - 32 + dw * 0.5, dy, cz);
  }
  // Sculpted Golden Throne (*Ngai Vàng*) with cabriole legs, curved S-scroll dragon armrests, high dragon backrest & footstool
  const thrY = y + 2.15;
  addBoxPart(goldParts, 1.48, 0.28, 1.42, cx - 32.3, thrY + 0.42, cz); // throne seat
  addBoxPart(macroCrimsonParts, 1.24, 0.12, 1.18, cx - 32.25, thrY + 0.60, cz); // imperial silk seat cushion
  // 4 Cabriole dragon-claw throne legs (*chân quỳ*)
  for (const lx of [-0.62, 0.62]) {
    for (const lz of [-0.58, 0.58]) {
      addCylPart(goldParts, 0.11, 0.08, 0.42, 7, cx - 32.3 + lx, thrY + 0.21, cz + lz);
    }
  }
  // Ornate carved high dragon backrest & royal flame crest
  addBoxPart(goldParts, 0.26, 2.05, 1.52, cx - 32.98, thrY + 1.48, cz);
  addCylPart(goldParts, 0.55, 0.72, 0.28, 12, cx - 32.95, thrY + 2.52, cz, 0, Math.PI * 0.5);
  // Twin curved S-shaped dragon armrests (*tay vịn rồng uốn*)
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx - 32.95, thrY + 1.38, cz + side * 0.68),
      new THREE.Vector3(cx - 32.45, thrY + 1.12, cz + side * 0.76),
      new THREE.Vector3(cx - 31.85, thrY + 1.02, cz + side * 0.72),
      new THREE.Vector3(cx - 31.52, thrY + 1.24, cz + side * 0.64)
    ]);
    goldParts.push(new THREE.TubeGeometry(armCurve, 10, 0.11, 7, false));
    // Dragon-head finial at armrest front tip
    const dHead = new THREE.SphereGeometry(0.16, 8, 6);
    dHead.translate(cx - 31.48, thrY + 1.28, cz + side * 0.64);
    goldParts.push(dHead);
    // Front armrest stanchion
    addCylPart(goldParts, 0.08, 0.10, 0.58, 6, cx - 31.72, thrY + 0.78, cz + side * 0.66);
  }
  // Carved royal gilded footstool (*bệ gác chân*) in front of Ngai Vàng
  addBoxPart(goldParts, 0.68, 0.22, 0.92, cx - 31.05, thrY + 0.11, cz);
  addBoxPart(macroCrimsonParts, 0.58, 0.06, 0.82, cx - 31.05, thrY + 0.24, cz);
  // 5-panel imperial screen behind throne (NO clipped octagonal cylinder Bửu Tán — clean square Bửu Tán is built by addThaiHoaInteriorDetails!)
  addBoxPart(goldParts, 0.3, 4.6, 9.2, cx - 36, y + 4.3, cz);

  // FIX R33: Replace the 4 solid yellow wall blocks with arched openwork *Cửa Võng* valance brackets spanning cleanly between column bays!
  for (let b = 0; b < 4; b++) {
    const cvX = cx - 6 - b * 9.0;
    for (let bay = 0; bay < 5; bay++) {
      const bayCenterZ = cz - 11.2 + bay * 5.6;
      // Slim carved gilded top transom rail spanning the bay
      addBoxPart(goldParts, 0.18, 0.28, 5.1, cvX, y + 8.15, bayCenterZ);
      // Twin curved openwork corner scroll brackets (*cửa võng uốn vòm*) leaving central archway open!
      for (const s of [-1, 1]) {
        const bracketCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(cvX, y + 8.05, bayCenterZ + s * 2.45),
          new THREE.Vector3(cvX, y + 7.25, bayCenterZ + s * 2.15),
          new THREE.Vector3(cvX, y + 6.95, bayCenterZ + s * 1.45),
          new THREE.Vector3(cvX, y + 7.75, bayCenterZ + s * 0.65)
        ]);
        goldParts.push(new THREE.TubeGeometry(bracketCurve, 8, 0.12, 6, false));
        // Hanging openwork finial drops flanking each column
        addCylPart(goldParts, 0.10, 0.04, 0.72, 6, cvX, y + 6.85, bayCenterZ + s * 2.25);
      }
    }
  }

  // 6 Porcelain vases & 6 Red/White Nghi Trượng fans/parasols
  for (const vz of [-8.8, -6.2, -3.8, 3.8, 6.2, 8.8]) {
    addCylPart(vaseParts, 0.26, 0.36, 1.55, 12, cx - 29.5, y + 2.02, cz + vz);
    addCylPart(goldParts, 0.05, 0.05, 3.2, 6, cx - 30.8, y + 2.85, cz + vz);
    addCylPart(vaseParts, 0.88, 0.96, 0.30, 14, cx - 30.8, y + 4.45, cz + vz);
  }
  // Lacquered coffered palace ceiling plate & transverse wood beams sealing interior from night sky
  addBoxPart(macroCrimsonParts, 49.4, 0.35, 33.4, cx - 20, y + 9.05, cz);
  for (let ix = 0; ix < 8; ix++) {
    const bx = cx - 40 + ix * 6.0;
    addBoxPart(macroCrimsonParts, 0.42, 0.55, 33.0, bx, y + 8.62, cz);
  }
  for (const bz of [-11.2, -5.6, 0, 5.6, 11.2]) {
    addBoxPart(macroCrimsonParts, 48.0, 0.42, 0.36, cx - 20, y + 8.68, cz + bz);
  }
  // Vermilion palace wainscoting & gilded frieze panels along interior walls
  addBoxPart(macroCrimsonParts, 49.0, 3.2, 0.18, cx - 20, y + 2.85, cz - 16.55);
  addBoxPart(macroCrimsonParts, 49.0, 3.2, 0.18, cx - 20, y + 2.85, cz + 16.55);
  addBoxPart(macroCrimsonParts, 0.18, 5.8, 33.0, cx - 43.55, y + 4.15, cz);
  addBoxPart(goldParts, 48.6, 0.14, 0.22, cx - 20, y + 4.48, cz - 16.52);
  addBoxPart(goldParts, 48.6, 0.14, 0.22, cx - 20, y + 4.48, cz + 16.52);
  addBoxPart(goldParts, 0.22, 0.18, 32.0, cx - 43.48, y + 7.1, cz);
  // East entrance Cửa Võng colonnade fascia framing Điện Thái Hòa from Sân Đại Triều Nghi
  addBoxPart(macroCrimsonParts, 0.35, 1.15, 33.4, cx + 4.8, y + 8.32, cz);
  addBoxPart(goldParts, 0.28, 0.26, 33.6, cx + 4.95, y + 7.72, cz);
  addThaiHoaInteriorDetails(
    macroCrimsonParts,
    goldParts,
    cx - 32.2,
    y + 1.25,
    cz,
    y + 7.45,
    y + 8.5,
    30.0,
    cx - 16.0
  );
  // Exterior 18 carved stone mandarin rank markers (Phẩm Sơn) on Sân Đại Triều Nghi
  addHuePhamSonMandarinStones(stoneParts, goldParts, cx + 10.0, y + 0.65, cz);
  const imperialCrimsonMat = new THREE.MeshStandardMaterial({
    color: '#8a1219',
    roughness: 0.78,
    metalness: 0.04
  });
  ctx.extraMaterials.push(imperialCrimsonMat);
  group.add(
    new THREE.Mesh(mergeNormalized(macroCrimsonParts), imperialCrimsonMat),
    new THREE.Mesh(mergeNormalized(daisIronwoodParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood)
  );

  // 48 Sơn Son Thếp Vàng Lacquered Columns + 16-petal White Marble Chân Tảng Bases
  const lacMat = createRedLacquerColumnShaderMat(ctx, 'longVan');
  const colInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.35, 8.2, 16), lacMat, 48);
  const baseInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.48, 0.62, 0.45, 16), ctx.materials.whiteMarble ?? ctx.materials.stone, 48);
  let cIdx = 0;
  for (let ix = 0; ix < 8; ix++) {
    const colX = cx - 40 + ix * 6.0;
    for (let iz = 0; iz < 6; iz++) {
      const colZ = cz - 14 + iz * 5.6;
      setInstanceMatrix(colInst, cIdx, colX, y + 5.55, colZ, 0, 0, 0, 1, 1, 1);
      setInstanceMatrix(baseInst, cIdx, colX, y + 1.48, colZ, 0, 0, 0, 1, 1, 1);
      cIdx++;
    }
  }
  colInst.instanceMatrix.needsUpdate = true;
  baseInst.instanceMatrix.needsUpdate = true;

  // 7 Hero + 24 Aisle Hexagonal Palace Lanterns
  const palMat = new THREE.MeshStandardMaterial({
    color: '#ffcf80',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.45,
    roughness: 0.42
  });
  palMat.userData.noDedupe = true;
  ctx.extraMaterials.push(palMat);
  const palInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.52, 0.52, 1.15, 6), palMat, 31);
  for (let i = 0; i < 7; i++) {
    setInstanceMatrix(palInst, i, cx - 28 + i * 5.0, y + 7.2, cz, 0, 0, 0, 1, 1, 1);
  }
  for (let i = 0; i < 24; i++) {
    const side = i < 12 ? -7.2 : 7.2;
    setInstanceMatrix(palInst, 7 + i, cx - 36 + (i % 12) * 3.8, y + 6.4, cz + side, 0, 0, 0, 0.65, 0.65, 0.65);
  }
  palInst.instanceMatrix.needsUpdate = true;

  const yellowGlazeMat = new THREE.MeshStandardMaterial({
    color: '#e1b12c',
    map: ctx.pbr.terracotta.map,
    normalMap: ctx.pbr.terracotta.normalMap,
    roughness: 0.28,
    metalness: 0.16,
    side: THREE.DoubleSide
  });
  const porcelainMat = new THREE.MeshStandardMaterial({ color: '#d8e6f8', roughness: 0.22 });
  ctx.extraMaterials.push(yellowGlazeMat, porcelainMat);
  const throneWarmLight = new THREE.PointLight('#ffd27d', 2.4, 34, 1.5);
  throneWarmLight.position.set(cx - 29.5, y + 5.2, cz);

  group.add(
    new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(wallParts), ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(roofParts), yellowGlazeMat),
    new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(bronzeParts), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(vaseParts), porcelainMat),
    colInst,
    baseInst,
    palInst,
    throneWarmLight
  );
  ctx.scene.add(group);
  return { group, palMat };
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
    emissive: new THREE.Color('#ff5e92'),
    emissiveIntensity: 0.4,
    roughness: 0.42,
    side: THREE.DoubleSide
  });
  daiSenMat.userData.noDedupe = true;
  const cloudTealMat = new THREE.MeshStandardMaterial({
    color: '#2bb3b1',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.45,
    roughness: 0.42
  });
  const padMat = new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.55, side: THREE.DoubleSide });
  ctx.extraMaterials.push(daiSenMat, cloudTealMat, padMat);

  // Helper to apply smooth lotus-petal gradient vertex colors (pale creamy-white base -> vivid lotus rose tips + subtle longitudinal veins)
  const applyLotusGradientColors = (geo: THREE.BufferGeometry, minY: number, maxY: number, centerX: number, centerZ: number, maxR: number): THREE.BufferGeometry => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cBase = new THREE.Color('#fff5f7');
    const cMid = new THREE.Color('#f79ebb');
    const cTip = new THREE.Color('#e03b7a');
    const tmp = new THREE.Color();
    const spanY = Math.max(0.1, maxY - minY);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const tY = clamp01((py - minY) / spanY);
      const rDist = clamp01(Math.hypot(px - centerX, pz - centerZ) / Math.max(0.1, maxR));
      const grad = clamp01(tY * 0.68 + rDist * 0.42);
      const vein = 0.04 * Math.sin(Math.atan2(pz - centerZ, px - centerX) * 48.0);
      const gVal = clamp01(grad + vein);
      if (gVal < 0.48) {
        tmp.copy(cBase).lerp(cMid, gVal / 0.48);
      } else {
        tmp.copy(cMid).lerp(cTip, (gVal - 0.48) / 0.52);
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

  // Sweeping Carved Lotus-Scroll Tam Quan Archway & Curved Roof behind lake + Gilded Floral Frieze & Carved Lotus Column Bases
  const archParts: THREE.BufferGeometry[] = [];
  const archGoldParts: THREE.BufferGeometry[] = [...heroFlower.coreParts];
  addBoxPart(archParts, 46, 2.2, 1.4, cx, 10.6, cz - 42);
  // Gilded lotus-scroll floral frieze & scalloped medallions running along Tam Quan architrave
  addBoxPart(archGoldParts, 45.4, 0.24, 1.56, cx, 9.65, cz - 42);
  addBoxPart(archGoldParts, 45.4, 0.24, 1.56, cx, 11.55, cz - 42);
  for (let fm = -18; fm <= 18; fm += 4.5) {
    if (Math.abs(fm) < 3.5) continue;
    const med = new THREE.TorusGeometry(0.46, 0.08, 6, 12);
    med.translate(cx + fm, 10.6, cz - 41.25);
    archGoldParts.push(med);
  }
  for (const sx of [-21.5, -10.5, 10.5, 21.5]) {
    addCylPart(archParts, 0.42, 0.48, 9.6, 12, cx + sx, 5.1, cz - 42);
    // Carved multi-tier white-jade lotus column base (*chân tảng cánh sen*)
    addCylPart(pedParts, 0.84, 1.04, 0.48, 12, cx + sx, 0.28, cz - 42);
    addCylPart(pedParts, 0.68, 0.88, 0.45, 12, cx + sx, 0.72, cz - 42);
    addCylPart(archGoldParts, 0.54, 0.62, 0.22, 12, cx + sx, 1.02, cz - 42);
  }
  const archRoofGeo = createVietnameseCurvedRoofGeometry(48.5, 4.8, 36.0, 1.4, 2.4, 0.48);
  archRoofGeo.translate(cx, 11.65, cz - 42);
  const archRoofMat = new THREE.MeshStandardMaterial({
    color: '#9e2620',
    map: ctx.pbr.terracotta.map,
    normalMap: ctx.pbr.terracotta.normalMap,
    roughness: 0.42,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(archRoofMat);
  const archPlaque = createSignagePlaqueMesh(
    { text: 'LIÊN HOA BẠCH NGỌC ĐÀI', subText: 'ĐẠI SEN HỒNG', width: 5.4, height: 1.25, depth: 0.20, style: 'royal' },
    ctx
  );
  archPlaque.position.set(cx, 10.55, cz - 41.2);
  group.add(archPlaque);
  group.add(
    new THREE.Mesh(mergeNormalized(pedParts), ctx.materials.whiteMarble ?? ctx.materials.whitePlaster),
    new THREE.Mesh(heroPetalGeo, daiSenMat),
    new THREE.Mesh(mergeNormalized(archGoldParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(archParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(archRoofGeo, archRoofMat)
  );

  // 2. 16 Tall Lotus-Etched Red Lacquer Columns on Carved Lotus White-Jade Bases
  const lotusColMat = createRedLacquerColumnShaderMat(ctx, 'lotus');
  const colInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.36, 0.40, 8.8, 16), lotusColMat, 16);
  const carvedBaseParts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.68, 0.84, 0.42, 12),
    (() => { const c = new THREE.CylinderGeometry(0.52, 0.72, 0.36, 12); c.translate(0, 0.36, 0); return c; })()
  ];
  const baseInst = new THREE.InstancedMesh(
    mergeNormalized(carvedBaseParts),
    ctx.materials.whiteMarble ?? ctx.materials.whitePlaster,
    16
  );
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * Math.PI * 2;
    const rad = i % 2 === 0 ? 58 : 70;
    const ax = cx + Math.cos(a) * rad;
    const az = cz + Math.sin(a) * rad;
    const ay = Math.max(ctx.getHeight(ax, az), 1.4);
    setInstanceMatrix(colInst, i, ax, ay + 5.1, az, 0, -a, 0, 1, 1, 1);
    setInstanceMatrix(baseInst, i, ax, ay + 0.22, az, 0, -a, 0, 1, 1, 1);
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

  group.add(colInst, baseInst, tvInst, flowerInst, padInst);
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
    for (let t = 0; t < 8; t++) {
      const ang = (t / 8) * Math.PI * 2;
      addCylPart(trunkParts, 0.34 * sc, 0.62 * sc, 10.5 * sc, 7, tx + Math.cos(ang) * 0.9 * sc, ty + 5.0 * sc, tz + Math.sin(ang) * 0.9 * sc, Math.sin(ang) * 0.08, -Math.cos(ang) * 0.08);
    }
    for (let b = 0; b < 7; b++) {
      const ba = (b / 7) * Math.PI * 2 + rand() * 0.4;
      const len = (10.5 + rand() * 4.5) * sc;
      const limb = new THREE.CylinderGeometry(0.22 * sc, 0.46 * sc, len, 7);
      limb.rotateZ(Math.PI * 0.36);
      limb.rotateY(ba);
      const lx = tx + Math.cos(ba) * len * 0.42;
      const lz = tz + Math.sin(ba) * len * 0.42;
      limb.translate(lx, ty + 10.2 * sc, lz);
      trunkParts.push(limb);
      canopyCenters.push([lx + Math.cos(ba) * 4.2 * sc, ty + 12.8 * sc, lz + Math.sin(ba) * 4.2 * sc, 7.2 * sc]);
      for (let r = 0; r < 6; r++) {
        const rootLen = (7.2 + rand() * 4.2) * sc;
        addCylPart(trunkParts, 0.04, 0.06, rootLen, 5, lx + (rand() - 0.5) * 5.2, ty + rootLen * 0.5, lz + (rand() - 0.5) * 5.2);
      }
    }
    canopyCenters.push([tx, ty + 14.5 * sc, tz, 8.8 * sc]);
  }
  // Carved stone steps wrapping right foreground banyan base
  const rightY = ctx.getHeight(cx + 38, cz + 38);
  for (let s = 0; s < 7; s++) {
    addBoxPart(stepParts, 5.2 - s * 0.2, 0.36, 1.1, cx + 34, rightY + 0.18 + s * 0.36, cz + 38 - s * 0.75);
  }
  const uplitBarkMat = new THREE.MeshStandardMaterial({
    color: '#6b5240',
    map: ctx.pbr.bark.map,
    normalMap: ctx.pbr.bark.normalMap,
    roughness: 0.88
  });
  uplitBarkMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vBarkY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBarkY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBarkY;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float upGlow = smoothstep(14.0, 1.5, vBarkY);
         totalEmissiveRadiance += vec3(1.0, 0.35, 0.12) * upGlow * 0.45;`
      );
  };
  ctx.extraMaterials.push(uplitBarkMat);

  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2f5a2a',
    map: ctx.pbr.leafAtlas,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.68
  });
  ctx.extraMaterials.push(leafMat);
  const leafInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 1.5), leafMat, 4500);
  for (let i = 0; i < 4500; i++) {
    const cc = canopyCenters[i % canopyCenters.length];
    const u = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const rad = cc[3] * (0.4 + 0.6 * Math.pow(rand(), 0.4));
    setInstanceMatrix(
      leafInst,
      i,
      cc[0] + rad * Math.sin(phi) * Math.cos(u),
      cc[1] + rad * Math.cos(phi) * 0.46,
      cc[2] + rad * Math.sin(phi) * Math.sin(u),
      (rand() - 0.5) * 1.4,
      rand() * 6.28,
      (rand() - 0.5) * 1.4,
      1,
      1,
      1
    );
  }
  leafInst.instanceMatrix.needsUpdate = true;

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

  // 2.15 Crescent Village Pond (*Ao Làng*) in front of Cổng Làng Mông Phụ
  const pondZ = gateZ + 14.5;
  const pondY = ctx.getHeight(cx, pondZ) + 0.05;
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
  pondMesh.position.set(cx, pondY, pondZ + 6.5);
  group.add(pondMesh);
  // Laterite pond rim curb stones & floating notched lotus pads
  const aoPadParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    const rx = cx + Math.cos(a) * 14.8;
    const rz = pondZ + 6.5 - Math.sin(a) * 14.8;
    addBoxPart(latParts, 2.2, 0.42, 0.72, rx, pondY + 0.14, rz, a - Math.PI * 0.5);
  }
  for (let lp = 0; lp < 16; lp++) {
    const a = 0.2 + rand() * (Math.PI - 0.4);
    const rr = 5.5 + rand() * 7.2;
    const pad = createNotchedLotusPadGeometry(0.42 + rand() * 0.2, 12);
    pad.rotateY(rand() * Math.PI * 2);
    pad.translate(cx + Math.cos(a) * rr, pondY + 0.04, pondZ + 6.5 - Math.sin(a) * rr);
    aoPadParts.push(pad);
  }
  if (aoPadParts.length > 0) group.add(new THREE.Mesh(mergeNormalized(aoPadParts), pondPadMat));

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
  // Verandah balustrade on open front wings
  woodParts.push(
    ...createPiercedBalustradeParts(dinhX - 11.6, dinhZ + 6.7, dinhX - 2.9, dinhZ + 6.7, dinhFloorY + 0.16, 0.82, 'con_tien'),
    ...createPiercedBalustradeParts(dinhX + 2.9, dinhZ + 6.7, dinhX + 11.6, dinhZ + 6.7, dinhFloorY + 0.16, 0.82, 'con_tien')
  );
  // Sweeping 4-corner curved Vietnamese communal house roof (reaching ~10.5m total height!) + mossy plaster ridge finials
  const dinhRoof = createVietnameseCurvedRoofGeometry(27.8, 17.8, 14.8, 2.4, 4.65, 1.08);
  dinhRoof.translate(dinhX, dinhFloorY + 3.82, dinhZ);
  roofParts.push(dinhRoof);
  const dinhFinial = createRoofFinialSetParts(dinhX, dinhFloorY + 8.45, dinhZ, 14.4, 0, 1.05, true);
  plasterParts.push(...dinhFinial.mainParts, ...dinhFinial.goldParts);
  const dinhPlaque = createSignagePlaqueMesh(
    { text: 'ĐÌNH MÔNG PHỤ', subText: '1684 · XỨ ĐOÀI', width: 3.6, height: 0.92, depth: 0.18, style: 'royal' },
    ctx
  );
  dinhPlaque.position.set(dinhX, dinhFloorY + 3.35, dinhZ + 6.45);
  group.add(dinhPlaque);

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
  // 2 Lintel Side Portals (*cổng nách*) connecting inner & outer pillars + pierced laterite screen walls flanking outside
  for (const side of [-1, 1]) {
    const midX = dinhX + side * 5.15;
    addBoxPart(plasterParts, 3.6, 0.72, 0.76, midX, nghiMonBaseY + 3.15, nghiMonZ);
    const sideCap = createGableRoofGeometry(3.8, 1.45, 0.78, 0.12, 'x');
    sideCap.translate(midX, nghiMonBaseY + 3.52, nghiMonZ);
    roofParts.push(sideCap);
    // Pierced laterite screen wall (*tường hoa đá ong ô thoáng*) extending outside each outer pillar
    const wallStartX = dinhX + side * 7.8;
    const wallEndX = dinhX + side * 14.8;
    latParts.push(
      ...createPiercedBalustradeParts(wallStartX, nghiMonZ, wallEndX, nghiMonZ, nghiMonBaseY, 2.05, 'lotus_stone')
    );
  }

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

  addBoxPart(woodParts, 6.4, 0.14, 4.2, cx - 18, baseY + 1.2, cz + 4); // Bamboo resting frame

  // 8 Ancient Laterite Đường Lâm Houses with Folk 2-Slope Gable Roofs (*bít đốc*) & Wooden Verandah Eaves
  const houseCoords: Array<[number, number, number]> = [
    [cx - 26, cz - 14, 0.3], [cx - 28, cz + 8, 1.2], [cx + 26, cz - 14, -0.3], [cx + 28, cz + 8, -1.2],
    [cx - 32, cz - 38, 0.15], [cx + 32, cz - 38, -0.15], [cx - 18, cz - 52, 0.0], [cx + 18, cz - 52, 0.0]
  ];
  for (const [hx, hz, ry] of houseCoords) {
    const hy = ctx.getHeight(hx, hz);
    const body = new THREE.BoxGeometry(10.5, 3.4, 5.6);
    body.rotateY(ry);
    body.translate(hx, hy + 1.7, hz);
    latParts.push(body);
    const hr = createGableRoofGeometry(11.4, 6.6, 2.35, 0.16, 'x');
    hr.rotateY(ry);
    hr.translate(hx, hy + 3.38, hz);
    roofParts.push(hr);
    // Mossy plaster triangular gable ends closing each house roof
    for (const endS of [-1, 1]) {
      const gTri = new THREE.BoxGeometry(0.28, 1.25, 4.4);
      gTri.translate(endS * 5.25, 3.95, 0);
      gTri.rotateY(ry);
      gTri.translate(hx, hy, hz);
      plasterParts.push(gTri);
    }
    const win = new THREE.BoxGeometry(1.6, 1.8, 0.16);
    win.translate(0, 1.1, 2.85);
    win.rotateY(ry);
    win.translate(hx, hy, hz);
    winParts.push(win);
  }

  // Reuse shared PBR lateriteHoneycomb, batTrangFloor & agedPlaster materials (with applyWorldBoxUV!)
  const lateriteMat = ctx.materials.lateriteHoneycomb ?? ctx.materials.stone;
  const plasterMat = ctx.materials.agedPlaster ?? ctx.materials.mossyPlaster ?? ctx.materials.whitePlaster;
  const brickMat = ctx.materials.batTrangFloor ?? ctx.materials.terracottaRoof;
  const warmDoorMat = new THREE.MeshStandardMaterial({
    color: '#ff9a4a',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.6
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

  // 1. Monumental 35m Sculpted Coiling Vietnamese Dragon + 4 Clawed Legs + Dorsal Spine + Whiskers + Flaming Pearl + Mirror Pool
  const dragonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 20, baseY + 1.5, cz - 14),
    new THREE.Vector3(cx - 9, baseY + 7.2, cz - 22),
    new THREE.Vector3(cx + 10, baseY + 14.0, cz - 16),
    new THREE.Vector3(cx - 7, baseY + 21.5, cz - 26),
    new THREE.Vector3(cx + 4, baseY + 28.8, cz - 30),
    new THREE.Vector3(cx, baseY + 34.2, cz - 24)
  ]);
  const dragonParts: THREE.BufferGeometry[] = [new THREE.TubeGeometry(dragonCurve, 44, 1.58, 12, false)];
  const maneParts: THREE.BufferGeometry[] = [];
  const goldAccentParts: THREE.BufferGeometry[] = [];

  // Dorsal flame spine (26 sweeping gilded flame-crest fins along entire 35m dragon spine)
  for (let sp = 1; sp <= 26; sp++) {
    const t = sp / 27;
    const pt = dragonCurve.getPoint(t);
    const finH = 1.65 + Math.sin(t * Math.PI) * 1.15;
    const fin = new THREE.ConeGeometry(0.38, finH, 5);
    fin.rotateX(-0.35);
    fin.translate(pt.x, pt.y + 1.45 + finH * 0.35, pt.z);
    goldAccentParts.push(fin);
  }

  // 4 Sculpted Clawed Legs (upper thigh + forearm + 3 golden talons per leg)
  const legAnchors: Array<[number, number]> = [
    [0.24, -1],
    [0.42, 1],
    [0.64, -1],
    [0.78, 1]
  ];
  for (const [t, side] of legAnchors) {
    const pt = dragonCurve.getPoint(t);
    const hipX = pt.x + side * 1.35;
    const hipY = pt.y - 0.4;
    const hipZ = pt.z + 0.6;
    const kneeX = hipX + side * 2.4;
    const kneeY = hipY - 1.5;
    const kneeZ = hipZ + 1.6;
    const pawX = kneeX + side * 1.2;
    const pawY = kneeY - 1.9;
    const pawZ = kneeZ + 1.9;
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hipX, hipY, hipZ),
      new THREE.Vector3(kneeX, kneeY, kneeZ),
      new THREE.Vector3(pawX, pawY, pawZ)
    ]);
    dragonParts.push(new THREE.TubeGeometry(legCurve, 10, 0.56, 8, false));
    // 3 Curved golden talons on each dragon paw
    for (let c = -1; c <= 1; c++) {
      const talon = new THREE.ConeGeometry(0.14, 1.15, 5);
      talon.rotateX(0.95);
      talon.rotateY(c * 0.38 + side * 0.25);
      talon.translate(pawX + c * 0.34, pawY - 0.32, pawZ + 0.55);
      goldAccentParts.push(talon);
    }
  }

  // Softened Sculpted Horned Dragon Head, Curved Brow Ridges, Open Jaws, Fangs, Flowing Curved Mane & Glowing Eyes
  const headY = baseY + 34.8;
  const headZ = cz - 22.8;
  const cranium = new THREE.SphereGeometry(2.05, 14, 10);
  cranium.scale(0.92, 0.78, 1.38);
  cranium.rotateX(-0.14);
  cranium.translate(cx, headY + 0.12, headZ + 0.15);
  const muzzle = new THREE.SphereGeometry(1.38, 12, 8);
  muzzle.scale(0.95, 0.62, 1.35);
  muzzle.rotateX(-0.10);
  muzzle.translate(cx, headY - 0.25, headZ + 2.45);
  const lowerJaw = new THREE.SphereGeometry(1.25, 10, 8);
  lowerJaw.scale(0.95, 0.45, 1.55);
  lowerJaw.rotateX(0.28);
  lowerJaw.translate(cx, headY - 1.85, headZ + 1.15);
  dragonParts.push(cranium, muzzle, lowerJaw);
  for (const s of [-1, 1]) {
    // Sculpted curved brow ridge & flaring cheek crest
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + s * 0.45, headY + 0.85, headZ + 1.85),
      new THREE.Vector3(cx + s * 1.48, headY + 1.15, headZ + 1.15),
      new THREE.Vector3(cx + s * 1.85, headY + 0.65, headZ - 0.45)
    ]);
    dragonParts.push(new THREE.TubeGeometry(browCurve, 8, 0.34, 6, false));
    // Swept curved antlers & flowing multi-strand white silk mane (*bờm rồng uốn lượn*)
    const antlerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + s * 0.95, headY + 1.15, headZ - 0.55),
      new THREE.Vector3(cx + s * 1.65, headY + 2.85, headZ - 1.85),
      new THREE.Vector3(cx + s * 2.15, headY + 4.45, headZ - 2.95)
    ]);
    maneParts.push(new THREE.TubeGeometry(antlerCurve, 10, 0.22, 6, false));
    for (let m = 0; m < 3; m++) {
      const maneCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx + s * (1.25 + m * 0.25), headY + 0.85 - m * 0.65, headZ - 0.95),
        new THREE.Vector3(cx + s * (2.25 + m * 0.45), headY + 1.15 - m * 0.85, headZ - 2.55),
        new THREE.Vector3(cx + s * (1.85 + m * 0.35), headY + 0.25 - m * 1.05, headZ - 4.35)
      ]);
      maneParts.push(new THREE.TubeGeometry(maneCurve, 10, 0.20 - m * 0.03, 6, false));
    }
    // Upper & lower ivory fangs
    const upperFang = new THREE.ConeGeometry(0.16, 0.72, 5);
    upperFang.rotateX(Math.PI);
    upperFang.translate(cx + s * 0.82, headY - 0.95, headZ + 2.95);
    const lowerFang = new THREE.ConeGeometry(0.14, 0.62, 5);
    lowerFang.translate(cx + s * 0.72, headY - 1.42, headZ + 2.55);
    maneParts.push(upperFang, lowerFang);
    // Long flowing curved gilded whiskers (*râu rồng*)
    const whiskerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + s * 1.1, headY - 0.45, headZ + 2.85),
      new THREE.Vector3(cx + s * 3.4, headY - 0.15, headZ + 3.65),
      new THREE.Vector3(cx + s * 5.2, headY - 1.65, headZ + 2.35),
      new THREE.Vector3(cx + s * 6.4, headY - 0.75, headZ + 0.65)
    ]);
    goldAccentParts.push(new THREE.TubeGeometry(whiskerCurve, 14, 0.12, 6, false));
  }

  // Glowing Amber Dragon Eyes + Radiant Flaming Pearl (*Châu Lửa*) in front of jaws
  const pearlGlowMat = new THREE.MeshStandardMaterial({
    color: '#ffe07a',
    emissive: new THREE.Color('#ff8c1a'),
    emissiveIntensity: 2.2,
    roughness: 0.18
  });
  ctx.extraMaterials.push(pearlGlowMat);
  const eyeAndPearlParts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.42, 10, 8);
    eye.translate(cx + s * 1.48, headY + 0.42, headZ + 1.15);
    eyeAndPearlParts.push(eye);
  }
  const pearlX = cx;
  const pearlY = headY - 0.85;
  const pearlZ = headZ + 6.4;
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
         // Segmented cyan-gold ventral belly plates on underside
         float bellyMask = smoothstep(-0.18, -0.58, vDNorm.y);
         float bellyRib = smoothstep(0.78, 0.92, abs(sin(vDUv.x * 46.0 * 3.14159)));
         vec3 bellyCol = mix(vec3(0.16, 0.66, 0.68), vec3(0.90, 0.72, 0.28), bellyRib * 0.75);
         vec3 scaledCol = mix(diffuseColor.rgb * scaleShade, vec3(0.92, 0.72, 0.26), scaleRim * 0.85);
         diffuseColor.rgb = mix(scaledCol, bellyCol, bellyMask * 0.82);`
      );
  };
  ctx.extraMaterials.push(dragonMat);

  const haloParts: THREE.BufferGeometry[] = [...goldAccentParts];
  for (const r of [14.0, 11.2, 8.6]) {
    const ring = new THREE.TorusGeometry(r, 0.35, 8, 48);
    ring.translate(cx, baseY + 24.0, cz - 42);
    haloParts.push(ring);
  }
  group.add(
    new THREE.Mesh(mergeNormalized(dragonParts), dragonMat),
    new THREE.Mesh(mergeNormalized(bridgeDeckParts), ctx.materials.darkIronwood ?? ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bridgeTrimParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(mergeNormalized(maneParts), ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(haloParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(eyeAndPearlParts), pearlGlowMat)
  );

  // 2. 18 Gold-Contour Sơn Mài Lacquer Karst Peaks & 24 Jade Cloud Clusters
  const peakParts: THREE.BufferGeometry[] = [];
  const jadeParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI * 0.9 + (i / 17) * Math.PI * 0.8;
    const dist = 42 + (i % 3) * 32;
    const px = cx + Math.cos(a) * dist * 1.35;
    const pz = cz - 15 + Math.sin(a) * dist * 0.85;
    const h = 12 + (i % 4) * 7.5;
    const peak = createSculptedRockGeometry(7700 + i, 5.5 + (i % 3) * 2.2, h * 0.55, 5.2, 2);
    peak.translate(px, ctx.getHeight(px, pz) + h * 0.35, pz);
    peakParts.push(peak);
  }
  for (let i = 0; i < 24; i++) {
    const jx = cx - 95 + (i % 8) * 27;
    const jz = cz - 55 + Math.floor(i / 8) * 32;
    const jc = new THREE.SphereGeometry(4.2, 10, 8);
    jc.scale(1.85, 0.65, 1.15);
    jc.translate(jx, baseY + 4.0 + (i % 3) * 2.4, jz);
    jadeParts.push(jc);
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

  // 3. 48 Floating Kinh Bắc Nón Quai Thao Lantern Hats with Radial Bamboo Ribs + Flowing Red Silk Ribbon Tassels (ref 07)
  const hatParts: THREE.BufferGeometry[] = [];
  const hatTop = new THREE.CylinderGeometry(0.62, 0.72, 0.14, 12);
  const hatCrown = new THREE.ConeGeometry(0.28, 0.18, 12);
  hatCrown.translate(0, 0.14, 0);
  const hatRim = new THREE.CylinderGeometry(0.72, 0.68, 0.16, 12, 1, true);
  hatRim.translate(0, -0.09, 0);
  hatParts.push(
    paintGeometryVertexColor(hatTop, '#f2d99b'),
    paintGeometryVertexColor(hatCrown, '#e8c474'),
    paintGeometryVertexColor(hatRim, '#d9b568')
  );
  // 6 Radial bamboo ribs beneath brim
  for (let rb = 0; rb < 6; rb++) {
    const a = (rb / 6) * Math.PI * 2;
    const rib = new THREE.BoxGeometry(0.03, 0.025, 1.38);
    rib.rotateY(a);
    rib.translate(0, -0.06, 0);
    hatParts.push(paintGeometryVertexColor(rib, '#9e6b32'));
  }
  // Curved red silk chin-sling + flowing twin crimson ribbon tassels (*quai thao dải lụa đỏ*)
  const slingLoop = new THREE.TorusGeometry(0.46, 0.038, 4, 10, Math.PI);
  slingLoop.rotateZ(Math.PI);
  slingLoop.translate(0, -0.10, 0);
  hatParts.push(paintGeometryVertexColor(slingLoop, '#d91e36'));
  for (const side of [-1, 1]) {
    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.44, -0.12, 0),
      new THREE.Vector3(side * 0.56, -0.55, 0.14),
      new THREE.Vector3(side * 0.38, -1.05, -0.12),
      new THREE.Vector3(side * 0.48, -1.52, 0.08)
    ]);
    hatParts.push(paintGeometryVertexColor(new THREE.TubeGeometry(ribCurve, 5, 0.042, 4, false), '#c8102e'));
    const knot = new THREE.SphereGeometry(0.075, 5, 4);
    knot.translate(side * 0.45, -0.12, 0);
    hatParts.push(paintGeometryVertexColor(knot, '#f0b840'));
  }
  const hatGeo = mergeNormalized(hatParts);
  const nonTime = { uTime: { value: 0 } };
  animList.push(nonTime);
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: new THREE.Color('#ff9d3b'),
    emissiveIntensity: 0.45,
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

  group.add(
    new THREE.Mesh(mergeNormalized(peakParts), lacquerPeakMat),
    new THREE.Mesh(mergeNormalized(jadeParts), jadeMat),
    nonInst
  );
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
  // FIX R38: Material array [bronzeMat, drumFaceMat, drumFaceMat] so the 1.2m cylindrical rim is bronze (NOT stretched drum-face UV!)
  const giantDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(11.0, 11.0, 1.2, 64),
    [bronzeDrumMat, drumFaceMat, drumFaceMat]
  );
  giantDrum.rotation.x = Math.PI * 0.5;
  giantDrum.position.set(cx, baseY + 12.2, cz - 46);
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(12.2, 0.65, 10, 64), ctx.materials.crimsonLacquer);
  haloRing.position.set(cx, baseY + 12.2, cz - 46);

  // Full 3D Waisted Ngọc Lũ Bronze Drum (Ø8.4m × 6.55m with 4 rim frogs & strap handles) on stepped stone plinth
  const drum3dRadius = 4.2;
  const drum3dY = baseY + 1.45;
  const drum3dZ = cz - 24;
  const drum3dParts = createDongSonDrum3DParts(cx, drum3dY, drum3dZ, drum3dRadius);
  // FIX R38: Rotate uprightWaist by +PI/2 so the drum face & 4 sculpted frogs face FORWARD (+Z) while the waisted shell extends rearward (-Z)!
  const uprightWaist = createDongSonDrum3DParts(0, 0, 0, 10.6);
  const uprightDepth = 10.6 * 1.56 * 0.55;
  for (const g of uprightWaist) {
    g.rotateX(Math.PI * 0.5);
    g.scale(1.0, 1.0, 0.55);
    g.translate(cx, baseY + 12.2, cz - 46.2 - uprightDepth);
  }
  drum3dParts.push(...uprightWaist);
  const drumPlinthParts: THREE.BufferGeometry[] = [];
  addCylPart(drumPlinthParts, 5.6, 6.2, 0.75, 24, cx, baseY + 0.38, drum3dZ);
  addCylPart(drumPlinthParts, 4.8, 5.3, 0.70, 24, cx, baseY + 1.10, drum3dZ);
  const topTympanum = new THREE.Mesh(new THREE.CircleGeometry(drum3dRadius * 0.96, 36), drumFaceMat);
  topTympanum.rotation.x = -Math.PI * 0.5;
  topTympanum.position.set(cx, drum3dY + drum3dRadius * 1.56 + 0.04, drum3dZ);

  group.add(
    giantDrum,
    haloRing,
    new THREE.Mesh(mergeNormalized(drumPlinthParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(drum3dParts), bronzeDrumMat),
    topTympanum
  );

  // 2. Overarching 5-Tier Concentric Golden Canopy Rings (Ø 60m) + 8 Full-Height Posts & Radial Spoke Beams + Bamboo Nơm Pyramid + 4 8-Post Thatch Pavilions
  const canopyParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const thatchParts: THREE.BufferGeometry[] = [];
  const pavLanternParts: THREE.BufferGeometry[] = [];
  const canopyTilt = 0.12;
  for (let r = 0; r < 5; r++) {
    const rad = 12 + r * 4.5;
    const ring = new THREE.TorusGeometry(rad, 0.42, 8, 48);
    ring.rotateX(Math.PI * 0.5 + canopyTilt);
    ring.translate(cx, baseY + 17.5 + r * 1.4, cz - 6);
    canopyParts.push(ring);
  }
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
  group.add(bInst, bunchInst, flInst);

  ctx.scene.add(group);
  return { group, drumFaceMat };
}

function buildTayNguyenBrocadeSanctuaryMacro(
  ctx: VietnamBuilderContext,
  brocTex: THREE.DataTexture
): THREE.Group {
  const cx = -860;
  const cz = 120;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 125 });
  const group = new THREE.Group();
  group.name = 'TayNguyenBrocadeSanctuaryMacro';
  const baseY = ctx.getHeight(cx, cz);

  // 1. 16 Towering Thổ Cẩm Brocade Totem Pillars with Scroll Bases
  const brocMat = new THREE.MeshStandardMaterial({ map: brocTex, roughness: 0.68 });
  ctx.extraMaterials.push(brocMat);
  const pillarGeo = new THREE.BoxGeometry(1.8, 13.5, 0.55);
  const scrollGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.65, 12);
  scrollGeo.rotateX(Math.PI * 0.5);
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
    color: '#decfa4',
    map: ctx.pbr.bambooWeave?.map ?? ctx.pbr.timber.map,
    normalMap: ctx.pbr.bambooWeave?.normalMap ?? null,
    emissive: new THREE.Color('#a4221b'),
    emissiveIntensity: 0.26,
    roughness: 0.72,
    side: THREE.DoubleSide
  });
  const rosetteMat = new THREE.MeshStandardMaterial({
    color: '#9b30ff',
    map: brocTex,
    emissive: new THREE.Color('#5b2a86'),
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(nonMat, rosetteMat);
  const giantNon = new THREE.Mesh(new THREE.ConeGeometry(7.0, 3.2, 32, 1, true), nonMat);
  giantNon.position.set(cx, baseY + 13.8, cz - 14);
  giantNon.rotation.set(0.42, 0.2, 0.14);
  // FIX R38: Sync inner Nón Lá lattice truss geometry center, position AND rotation (0.42, 0.2, 0.14) cleanly inside the 14m Nón Lá!
  const trussGeo = createNonLaLatticeGeometry(6.85, 3.08, 16, 5);
  trussGeo.translate(0, -1.56, 0);
  const truss = new THREE.Mesh(trussGeo, ctx.materials.gold);
  truss.position.copy(giantNon.position);
  truss.rotation.copy(giantNon.rotation);

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

  // 4 Slender Gold-Timber Columns supporting the Ø14m Nón Lá dome cleanly down to stone plinths
  const supportTimberParts: THREE.BufferGeometry[] = [];
  const supportGoldParts: THREE.BufferGeometry[] = [];
  const supportStoneParts: THREE.BufferGeometry[] = [];
  for (const [ox, oz] of [[-4.8, -4.6], [4.8, -4.6], [-4.8, 4.6], [4.8, 4.6]]) {
    const sx = cx + ox;
    const sz = cz - 14 + oz;
    const sy = ctx.getHeight(sx, sz);
    const colTopY = baseY + 13.4 + oz * Math.sin(0.42) * 0.45;
    const colH = Math.max(8.0, colTopY - sy);
    addCylPart(supportStoneParts, 0.46, 0.58, 0.65, 10, sx, sy + 0.32, sz);
    addCylPart(supportGoldParts, 0.24, 0.28, 0.35, 10, sx, sy + 0.80, sz);
    addCylPart(supportTimberParts, 0.18, 0.22, colH, 10, sx, sy + colH * 0.5, sz);
    addCylPart(supportGoldParts, 0.28, 0.20, 0.42, 10, sx, sy + colH, sz);
  }

  // Authentic 21m-Tall Tây Nguyên Nhà Rông Centerpiece at (cx, baseY, cz - 46) with SMOOTH Continuous Axe-Blade Roof!
  const nrX = cx;
  const nrZ = cz - 46;
  const nrY = ctx.getHeight(nrX, nrZ);
  const nrThatchParts: THREE.BufferGeometry[] = [];
  const nrWovenParts: THREE.BufferGeometry[] = [];
  const deckH = 2.5;
  const nrDeckY = nrY + deckH;
  // 18 Elevated timber stilt posts & cross-braces
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      addCylPart(supportTimberParts, 0.18, 0.22, deckH + 0.4, 8, nrX + ix * 3.6, nrY + deckH * 0.5, nrZ + iz * 3.4);
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

  // 3. 48 Multi-Colored 3D Tường Vân Auspicious Clouds
  const tvMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.42,
    roughness: 0.44
  });
  ctx.extraMaterials.push(tvMat);
  const tvInst = new THREE.InstancedMesh(createTuongVanScrollGeometry(), tvMat, 48);
  const tvCols = [new THREE.Color('#2bb3b1'), new THREE.Color('#1e4fa8'), new THREE.Color('#ff6a2b'), new THREE.Color('#d4a43a')];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rad = 26 + (i % 5) * 16;
    setInstanceMatrix(tvInst, i, cx + Math.cos(a) * rad, baseY + 12 + (i % 6) * 3.8, cz + Math.sin(a) * rad, 0, -a, 0, 1.5, 1.2, 1.0);
    tvInst.setColorAt(i, tvCols[i % tvCols.length]);
  }
  tvInst.instanceMatrix.needsUpdate = true;
  if (tvInst.instanceColor) tvInst.instanceColor.needsUpdate = true;

  group.add(
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

  // Curved 110m Basalt-Granite Canyon Bas-Relief Wall
  const cliffGeo = new THREE.PlaneGeometry(114, 26, 72, 24);
  const cp = cliffGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const ux = x / 114 + 0.5;
    const uy = y / 26 + 0.5;
    const curveZ = Math.pow(ux - 0.5, 2.0) * 38.0; // semicircular horseshoe embrace
    const heroWaves = Math.max(0, Math.sin(ux * Math.PI * 11.0)) * (uy > 0.15 && uy < 0.80 ? 1.15 : 0.25);
    const strata = noise2D(ux * 14.0, uy * 8.0, 1010) * 1.1;
    cp.setXYZ(i, x, y + 13.0, curveZ + heroWaves * 1.15 + strata);
  }
  cliffGeo.computeVertexNormals();
  cliffGeo.translate(cx, floorY - 1.5, cz - 46);
  const reliefMat = new THREE.MeshStandardMaterial({
    color: '#6e523a',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    normalScale: new THREE.Vector2(2.4, 2.4),
    roughness: 0.72,
    metalness: 0.28
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
      emblemParts.push(feather);
      const goldTip = new THREE.ConeGeometry(0.32, 1.9, 5);
      goldTip.rotateZ(-side * (1.28 - f * 0.06));
      goldTip.translate(anchorX + side * (fLen + 0.6), anchorY + 0.45 - f * 0.14, anchorZ + 1.55);
      goldAccentParts.push(goldTip);
    }
  }

  // FIX R38: 7 Monumental 3D Heroic Bas-Relief Figure Clusters (9–12m tall) projecting directly from the curved basalt canyon wall (ref 10_heroic_rock_relief.jpg)!
  // Representing Hùng Kings (bird-feather headdresses), Bronze-Age spearmen, historic generals (cloaks/swords) & modern soldiers (pith helmets/flags)
  const reliefFigParts: THREE.BufferGeometry[] = [];
  const heroClusterSpecs: Array<{ dx: number; h: number; type: 'king' | 'general' | 'soldier' }> = [
    { dx: -44, h: 10.2, type: 'soldier' },
    { dx: -30, h: 11.4, type: 'general' },
    { dx: -16, h: 12.0, type: 'king' },
    { dx: 0, h: 12.6, type: 'king' },
    { dx: 16, h: 11.8, type: 'general' },
    { dx: 30, h: 11.2, type: 'soldier' },
    { dx: 44, h: 10.0, type: 'soldier' }
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

  // Warm Illuminated "ĐẤT NƯỚC" Monumental Relief Signage mounted prominently above central granite plaza
  const datNuocPlaque = createSignagePlaqueMesh(
    { text: 'ĐẤT NƯỚC', subText: 'HÀO KHÍ NGÀN NĂM VĂN HIẾN', width: 12.4, height: 2.55, depth: 0.34, style: 'royal' },
    ctx
  );
  datNuocPlaque.position.set(cx, floorY + 2.45, cz - 30.8);
  cGroup.add(datNuocPlaque);
  addBoxPart(plazaStoneParts, 13.4, 1.25, 1.1, cx, floorY + 0.85, cz - 31.0);

  // Softened Sculpted Heroic Leader Monument Statue on Stepped Granite Pedestal at (cx + 44, floorY, cz - 35)
  const statX = cx + 44;
  const statZ = cz - 35;
  addBoxPart(plazaStoneParts, 6.2, 1.2, 6.2, statX, floorY + 0.6, statZ);
  addBoxPart(plazaStoneParts, 4.8, 2.4, 4.8, statX, floorY + 2.4, statZ);
  const statBaseY = floorY + 3.6;
  // Sculpted robed bronze statue figure (tapered coat, rounded shoulders, draped sash, sculpted head & guiding arm)
  addCylPart(goldAccentParts, 0.92, 1.32, 4.4, 12, statX, statBaseY + 2.2, statZ);
  const sChest = new THREE.CylinderGeometry(1.18, 0.92, 2.5, 12);
  sChest.scale(1.12, 1.0, 0.68);
  sChest.translate(statX, statBaseY + 5.25, statZ);
  const sShoulders = new THREE.SphereGeometry(1.22, 12, 8);
  sShoulders.scale(1.18, 0.52, 0.68);
  sShoulders.translate(statX, statBaseY + 6.25, statZ);
  const sHead = new THREE.SphereGeometry(0.68, 12, 10);
  sHead.translate(statX, statBaseY + 7.22, statZ);
  goldAccentParts.push(sChest, sShoulders, sHead);
  addCylPart(goldAccentParts, 0.24, 0.32, 2.9, 8, statX - 1.35, statBaseY + 6.9, statZ + 0.4, 0.35, 0.68);
  addCylPart(goldAccentParts, 0.22, 0.28, 2.4, 8, statX + 1.25, statBaseY + 5.0, statZ + 0.1, 0, -0.24);

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
  cGroup.add(
    new THREE.Mesh(cliffGeo, reliefMat),
    new THREE.Mesh(mergeNormalized(reliefFigParts), reliefMat),
    new THREE.Mesh(mergeNormalized(plazaStoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(emblemParts), drumMat),
    new THREE.Mesh(mergeNormalized(goldAccentParts), ctx.materials.bronzePatina ?? ctx.materials.bronze),
    nonCrown,
    new THREE.Mesh(mergeNormalized(brazierParts), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(emberParts), emberMat)
  );
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
    emissive: new THREE.Color('#ff8c3a'),
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
      emissive: new THREE.Color('#ff8c3a'),
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

  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32), solarMat);
  sunDisc.position.set(0, 8.6, -338);
  const memCrown = new THREE.Mesh(createNonLaLatticeGeometry(3.2, 1.6, 16, 5), ctx.materials.gold);
  memCrown.position.set(0, 14.5, -315);

  // Architectural support columns beneath Sun Disc & suspended Nón Lá Crown + 3 Central Foreground Film Frames in front of the Sun (ref 11)
  const memSupportParts: THREE.BufferGeometry[] = [];
  const fgStoneParts: THREE.BufferGeometry[] = [];
  for (const sx of [-3.8, 3.8]) {
    addCylPart(memSupportParts, 0.22, 0.28, 7.2, 8, sx, 4.3, -338);
  }
  for (const [cxOff, czOff] of [
    [-2.8, -2.8],
    [2.8, -2.8],
    [-2.8, 2.8],
    [2.8, 2.8]
  ]) {
    addCylPart(memSupportParts, 0.12, 0.16, 14.5, 6, cxOff, 7.25, -315 + czOff);
  }
  // 3 Staggered Central Foreground Archival 35mm Film Frames framing the Glowing Sun Disc
  const fgFrames: Array<[number, number, number, number, number]> = [
    [-5.8, -327.0, 8.2, 0.14, 1],
    [0.0, -330.5, 9.4, 0.0, 0],
    [5.8, -327.0, 8.2, -0.14, 2]
  ];
  for (const [fx, fz, fh, fYaw, vIdx] of fgFrames) {
    const fy = Math.max(ctx.getHeight(fx, fz), 1.4);
    addBoxPart(fgStoneParts, 3.1, 0.72, 1.0, fx, fy + 0.36, fz, fYaw);
    addBoxPart(memSupportParts, 2.5, fh + 0.3, 0.24, fx, fy + 0.72 + fh * 0.5, fz, fYaw);
    const fgPanel = new THREE.Mesh(new THREE.PlaneGeometry(2.25, fh), variantMats[vIdx]);
    fgPanel.rotation.y = fYaw;
    fgPanel.position.set(fx + Math.sin(fYaw) * 0.15, fy + 0.72 + fh * 0.5, fz + Math.cos(fYaw) * 0.15);
    mGroup.add(fgPanel);
  }

  mGroup.add(
    plinthInst,
    steleFrame,
    ...stelePanels,
    new THREE.Mesh(mergeNormalized(fgStoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(memSupportParts), ctx.materials.bronze),
    sunDisc,
    memCrown
  );
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

  for (let w = 0; w < 4; w++) {
    const wx = cx - 18 + w * 12;
    const wfPlane = new THREE.PlaneGeometry(8.5, 22.0, 2, 10);
    wfPlane.rotateX(0.28);
    wfPlane.translate(wx, 13.0, cz - 78);
    waterParts.push(wfPlane);

    const wy = Math.max(poolBaseY, ctx.getHeight(wx, cz - 74));
    const splash = new THREE.CylinderGeometry(3.8, 5.2, 0.55, 14);
    splash.translate(wx, wy + 0.35, cz - 74);
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

  // 3. 96 Wet Jungle Palms & Ferns + 28 Soft-Alpha Mist Ribbons + 6 Storm Light Shafts
  const palmParts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.14, 0.24, 6.2, 6)];
  palmParts[0].translate(0, 3.1, 0);
  for (let f = 0; f < 6; f++) {
    const frond = new THREE.PlaneGeometry(0.65, 2.8, 1, 4);
    frond.rotateX(0.75);
    frond.rotateY((f / 6) * Math.PI * 2);
    frond.translate(0, 6.2, 0);
    palmParts.push(frond);
  }
  const palmMat = new THREE.MeshStandardMaterial({ color: '#274d28', roughness: 0.32, side: THREE.DoubleSide });
  const gorgeMistAlpha = createSoftRadialAlphaTexture(ctx, 64);
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    alphaMap: gorgeMistAlpha,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const shaftMat = new THREE.MeshBasicMaterial({
    color: '#a8c8ff',
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(palmMat, mistMat, shaftMat);

  const palmInst = new THREE.InstancedMesh(mergeNormalized(palmParts), palmMat, 96);
  const mistInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(46, 12), mistMat, 28);
  const shaftInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 7.5, 65, 12, 1, true), shaftMat, 6);
  const rand = mulberry32(13013);
  for (let i = 0; i < 96; i++) {
    const px = cx + (rand() - 0.5) * 190;
    const pz = cz + (rand() - 0.5) * 185;
    const py = ctx.getHeight(px, pz);
    const sc = 0.85 + rand() * 0.65;
    setInstanceMatrix(palmInst, i, px, py, pz, (rand() - 0.5) * 0.16, rand() * 6.28, 0.18, sc, sc, sc);
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

  group.add(
    new THREE.Mesh(mergeNormalized(rockParts), wetKarstMat),
    new THREE.Mesh(mergeNormalized(waterParts), cascadeMat),
    new THREE.Mesh(mergeNormalized(foamParts), foamMat),
    new THREE.Mesh(mergeNormalized(bridgeWoodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bridgeCableParts), cableMat),
    palmInst,
    mistInst,
    shaftInst
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
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + (i / 13) * Math.PI;
    const rad = 105 + (i % 3) * 28;
    const gx = dbx + Math.cos(a) * rad * 1.25;
    const gz = dbz - 20 + Math.sin(a) * rad * 0.82;
    const h = 38 + (i % 4) * 14;
    const rock = createSculptedRockGeometry(1400 + i, 24, h * 0.65, 22, 2);
    rock.translate(gx, ctx.getHeight(gx, gz) + h * 0.22, gz);
    cragParts.push(rock);
  }
  // Fortified Stone Citadel & Twin Timber Watchtowers (tháp canh) + 4 Command Bunkers
  const hillY = ctx.getHeight(dbx, dbz + 20);
  addBoxPart(stoneParts, 44, 6.2, 14, dbx, hillY + 3.1, dbz - 16);
  for (const [wx, wz, h] of [[-12, -16, 11.5], [14, -14, 9.8]]) {
    addCylPart(timberParts, 2.2, 2.6, h, 6, dbx + wx, hillY + h * 0.5, dbz + wz);
    const roof = new THREE.ConeGeometry(3.4, 2.4, 6);
    roof.translate(dbx + wx, hillY + h + 1.1, dbz + wz);
    timberParts.push(roof);
  }
  for (const [bx, bz] of [[-24, 6], [24, 6], [-12, 24], [12, 24]]) {
    const by = ctx.getHeight(dbx + bx, dbz + bz);
    addBoxPart(timberParts, 6.2, 2.0, 4.2, dbx + bx, by + 1.0, dbz + bz);
    addBoxPart(timberParts, 6.8, 0.55, 4.8, dbx + bx, by + 2.25, dbz + bz);
  }

  // M14.1 Hầm Chỉ Huy De Castries (Grounded Corrugated Steel Arch Vault with 14 Steel Ribs, Sandbag Revetment Walls & Coiled Barbed Wire, NO roof slab clipping through vault!)
  const bunkerX = dbx - 6;
  const bunkerZ = dbz - 2;
  const bunkerY = ctx.getHeight(bunkerX, bunkerZ);
  const archVault = new THREE.CylinderGeometry(3.6, 3.6, 9.2, 18, 1, false, 0, Math.PI);
  archVault.rotateZ(Math.PI * 0.5);
  archVault.rotateY(Math.PI * 0.5);
  archVault.translate(bunkerX, bunkerY + 0.1, bunkerZ);
  metalParts.push(archVault);
  // 14 external corrugated steel arch ribs along the semi-cylindrical bunker vault
  for (let rb = 0; rb < 14; rb++) {
    const rz = bunkerZ - 4.4 + (rb / 13) * 8.8;
    const rib = new THREE.TorusGeometry(3.68, 0.08, 6, 18, Math.PI);
    rib.translate(bunkerX, bunkerY + 0.1, rz);
    metalParts.push(rib);
  }
  // Coiled barbed-wire entanglement loops flanking the bunker trench approach
  for (let bw = 0; bw < 10; bw++) {
    const wireLoop = new THREE.TorusGeometry(0.45, 0.03, 5, 12);
    wireLoop.rotateY(0.35);
    wireLoop.translate(bunkerX - 4.5 + bw * 0.95, bunkerY + 0.45, bunkerZ + 6.4);
    metalParts.push(wireLoop);
  }
  // Timber trench revetment doorway at +Z and -Z ends (leaving walk-in arch corridor clear)
  for (const side of [-1, 1]) {
    addBoxPart(timberParts, 1.45, 2.5, 0.45, bunkerX + side * 2.05, bunkerY + 1.25, bunkerZ + 4.65);
    addBoxPart(timberParts, 1.45, 2.5, 0.45, bunkerX + side * 2.05, bunkerY + 1.25, bunkerZ - 4.65);
  }
  addBoxPart(timberParts, 0.4, 2.4, 3.2, bunkerX - 1.5, bunkerY + 1.2, bunkerZ + 6.2);
  addBoxPart(timberParts, 0.4, 2.4, 3.2, bunkerX + 1.5, bunkerY + 1.2, bunkerZ + 6.2);

  // Tượng Đài Chiến Thắng Điện Biên Phủ (3 Bronze Soldiers + Child & Victory Flag atop 3-Tier Pedestal on Đồi D1)
  const monX = dbx - 24;
  const monZ = dbz - 14;
  const monY = ctx.getHeight(monX, monZ) + 6.2;
  const bronzeStatueParts: THREE.BufferGeometry[] = [];
  addBoxPart(stoneParts, 7.2, 1.4, 7.2, monX, monY + 0.7, monZ);
  addBoxPart(stoneParts, 5.4, 1.4, 5.4, monX, monY + 2.1, monZ);
  addBoxPart(stoneParts, 3.8, 1.6, 3.8, monX, monY + 3.6, monZ);
  // 3 monumental bronze soldiers + Thai child held high
  for (const [sx, sz, sh, syaw] of [
    [0.0, 0.0, 4.2, 0.0],
    [-0.95, 0.45, 3.8, -0.35],
    [0.95, 0.45, 3.7, 0.35],
    [-0.45, -0.35, 2.2, 0.15]
  ]) {
    addCylPart(bronzeStatueParts, 0.34, 0.52, sh, 8, monX + sx, monY + 4.4 + sh * 0.5, monZ + sz, 0, syaw);
    const head = new THREE.SphereGeometry(0.32, 7, 6);
    head.translate(monX + sx, monY + 4.4 + sh + 0.30, monZ + sz);
    bronzeStatueParts.push(head);
  }
  addCylPart(bronzeStatueParts, 0.07, 0.09, 5.8, 6, monX + 0.35, monY + 8.6, monZ - 0.1, 0, -0.15);
  addBoxPart(bronzeStatueParts, 2.4, 1.4, 0.12, monX + 1.55, monY + 10.6, monZ - 0.1);
  dbGroup.add(new THREE.Mesh(mergeNormalized(bronzeStatueParts), ctx.materials.bronze));

  // "QUYẾT CHIẾN QUYẾT THẮNG" Victory Flag hoisted atop De Castries bunker roof!
  addCylPart(metalParts, 0.08, 0.11, 7.5, 8, bunkerX, bunkerY + 6.8, bunkerZ);
  const victoryFlag = ctx.sharedShaders
    ? ctx.sharedShaders.getWavingFlag({ waveScale: 0.42, showStar: true })
    : createWavingSilkFlagMaterial({ waveScale: 0.42, showStar: true });
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(victoryFlag.material);
  }
  ctx.foliageWindUniforms.push(victoryFlag.uniforms);
  const flagPlane = new THREE.PlaneGeometry(3.8, 2.4, 18, 10);
  flagPlane.translate(1.9, 0, 0);
  const vFlagMesh = new THREE.Mesh(flagPlane, victoryFlag.material);
  vFlagMesh.position.set(bunkerX, bunkerY + 9.4, bunkerZ);
  dbGroup.add(vFlagMesh);

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

  const cragMat = new THREE.MeshStandardMaterial({
    color: '#253658',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.85
  });
  const bagMat = new THREE.MeshStandardMaterial({ color: '#9a8262', roughness: 0.94 });
  const flareMat = new THREE.MeshStandardMaterial({
    color: '#ff3b2f',
    emissive: new THREE.Color('#ff3b2f'),
    emissiveIntensity: 1.0
  });
  flareMat.userData.noDedupe = true;
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#4a5568',
    metalness: 0.72,
    roughness: 0.42
  });
  const tankMat = new THREE.MeshStandardMaterial({
    color: '#394634',
    roughness: 0.76,
    metalness: 0.25
  });
  const craterMat = new THREE.MeshStandardMaterial({
    color: '#221e1a',
    roughness: 0.95,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(cragMat, bagMat, flareMat, metalMat, tankMat, craterMat);

  // 420 Burlap Sandbags + 110 Crossed Timber X-Barricades
  const bagInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.20, 0.36), bagMat, 420);
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
  dbGroup.add(
    new THREE.Mesh(mergeNormalized(cragParts), cragMat),
    new THREE.Mesh(mergeNormalized(stoneParts), ctx.materials.stone),
    new THREE.Mesh(mergeNormalized(timberParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(metalParts), metalMat),
    new THREE.Mesh(mergeNormalized(tankParts), tankMat),
    new THREE.Mesh(mergeNormalized(craterParts), craterMat),
    bagInst,
    xInst,
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

    // Painted Prow Ship Eyes (*Mắt Thuyền*) on the Hero Flagship (s === 0)
    if (s === 0) {
      const eyeWhiteGeo = new THREE.SphereGeometry(0.42 * scale, 8, 6);
      eyeWhiteGeo.scale(1.35, 0.85, 0.45);
      const pupilGeo = new THREE.SphereGeometry(0.24 * scale, 7, 5);
      pupilGeo.scale(1.2, 0.8, 0.5);
      for (const side of [-1, 1]) {
        const ew = new THREE.Mesh(eyeWhiteGeo, ctx.materials.whitePlaster);
        ew.position.set(9.8 * scale, 2.15 * scale, side * 1.48 * scale);
        const ep = new THREE.Mesh(pupilGeo, ctx.materials.darkVoid);
        ep.position.set(10.0 * scale, 2.15 * scale, side * 1.58 * scale);
        ship.add(ew, ep);
      }
    }

    if (twinFire) {
      for (const fx of [-6.5 * scale, 7.5 * scale]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 9.0 * scale, 6), ctx.materials.darkWood);
        pole.position.set(fx, 4.8 * scale, 0);
        const fire = new THREE.Mesh(new THREE.SphereGeometry(0.75 * scale, 8, 6), flareMat);
        fire.position.set(fx, 9.5 * scale, 0);
        ship.add(pole, fire);
      }
    } else {
      const bowFire = new THREE.Mesh(new THREE.SphereGeometry(0.48 * scale, 8, 6), flareMat);
      bowFire.position.set(10.5 * scale, 2.2 * scale, 0);
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

  // 2 Impaled Listing & Blazing Enemy War Junks + 4 Flaming Bamboo Fire-Rafts (*Bè Lửa*) on the Stake Line!
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
    for (const [fx, fy] of [
      [0, 3.2],
      [4.5, 2.8],
      [-2.5, 4.2]
    ]) {
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.95 * sc, 8, 6), flareMat);
      flame.position.set(fx * sc, fy * sc, 0);
      wreck.add(flame);
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
    addBoxPart(raftParts, 5.2, 0.45, 3.2, bdx + rx, VIETNAM_WATER_LEVEL + 0.16, bdz + rz, 0.35);
    const rf = new THREE.SphereGeometry(0.95, 8, 6);
    rf.translate(bdx + rx, VIETNAM_WATER_LEVEL + 1.05, bdz + rz);
    raftFireParts.push(rf);
  }
  bdGroup.add(
    new THREE.Mesh(mergeNormalized(raftParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(raftFireParts), flareMat)
  );

  // 180 Iron-Tipped Cọc Gỗ Lim Bạch Đằng Stakes + 180 Tidal Foam Collars + 24 Mist Ribbons
  const logPart = new THREE.CylinderGeometry(0.18, 0.24, 4.2, 8);
  const ironTip = new THREE.ConeGeometry(0.18, 0.52, 4);
  ironTip.translate(0, 2.36, 0);
  const stakeMat = new THREE.MeshStandardMaterial({ color: '#2b1c14', roughness: 0.62, metalness: 0.25 });
  const foamMat = new THREE.MeshBasicMaterial({ color: '#dce6ee', transparent: true, opacity: 0.45, depthWrite: false });
  ctx.extraMaterials.push(stakeMat, foamMat);
  const stakeInst = new THREE.InstancedMesh(mergeNormalized([logPart, ironTip]), stakeMat, 180);
  const foamInst = new THREE.InstancedMesh(new THREE.RingGeometry(0.28, 0.64, 12).rotateX(-Math.PI / 2), foamMat, 180);
  for (let i = 0; i < 180; i++) {
    const row = i % 5;
    const t = i / 179;
    const sx = bdx - 165 + t * 330 + (rand() - 0.5) * 5;
    const sz = bdz + 58 + row * 11.0 + (rand() - 0.5) * 4;
    const tilt = 0.24 + rand() * 0.25;
    setInstanceMatrix(stakeInst, i, sx, VIETNAM_WATER_LEVEL + 0.15, sz, tilt, (rand() - 0.5) * 0.2, 0, 1, 1, 1);
    setInstanceMatrix(foamInst, i, sx, VIETNAM_WATER_LEVEL + 0.06, sz, 0, 0, 0, 1, 1, 1);
  }
  stakeInst.instanceMatrix.needsUpdate = true;
  foamInst.instanceMatrix.needsUpdate = true;

  const mistInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(42, 9.5), mistMat, 24);
  for (let i = 0; i < 24; i++) {
    setInstanceMatrix(mistInst, i, bdx + (rand() - 0.5) * 320, 3.2 + rand() * 5.0, bdz - 20 + (rand() - 0.5) * 180, 0, (rand() - 0.5) * 0.4, 0, 1, 1, 1);
  }
  mistInst.instanceMatrix.needsUpdate = true;

  bdGroup.add(stakeInst, foamInst, mistInst);
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
      [{ x: -860, z: 120, r: 125 }],
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
            res.filmMat.emissiveIntensity = 0.35 + s.duskAmount * 1.1 + darkNight * 1.5;
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
      if (cameraPos) {
        atmoHandles.rainMat.uniforms.uCamPos.value.copy(cameraPos);
      }
      festHandles.fireShowMesh.scale.y = 0.85 + Math.sin(elapsedTime * 7.5) * 0.25;
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

      const beamBoost = !isRain && isTrueNight ? clamp01(darkNight * 1.25 + 0.15) * 1.35 : 0.0;
      atmoHandles.beamsMat.uniforms.uIntensity.value = beamBoost;
      atmoHandles.beamsGroup.visible = beamBoost > 0.02;

      atmoHandles.rainMat.uniforms.uRainAlpha.value = isRain ? 1.0 : 0.0;
      atmoHandles.rainGroup.visible = isRain;
    }
  };
}
