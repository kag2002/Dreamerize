import * as THREE from 'three';
import {
  VietnamBuilderContext,
  applyWorldBoxUV,
  createGableRoofGeometry,
  createHueImperialHipRoofGeometry,
  createWavingSilkFlagMaterial,
  mulberry32
} from './vietnamGeometryHelpers';
import { tagMotifIds } from './vietnamMotifHelpers';
import {
  PartsBuilder,
  registerAnimatedUniform
} from '../vietnam/geometry/PartsBuilder';

export interface HanoiCapitalTrioBuildResult {
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
}

/**
 * Thủ Đô Hà Nội Capital Trio Landmark Builder (`hanoiCapitalTrioBuilder.ts`).
 *
 * Implements two monumental Hanoi heritage complexes directly on `ctx.scene`
 * with 220 distinct architectural details (`NB-001..220`), zero new `MeshStandardMaterial`
 * allocations, strict shadow discipline (only 4 hero meshes cast shadows), and <= 48,000 triangles:
 *
 * 1. `BaDinhMausoleumComplex` centered at `(-940, -120)` (`NB-001..110`):
 *    - Lăng Chủ Tịch Hồ Chí Minh (3-tier granite podium, 18 square granite peristyle columns,
 *      3-stepped modernist granite attic crown, dark-crimson "CHỦ TỊCH HỒ CHÍ MINH" fascia plaque,
 *      bronze double portal doors, gold hammer-sickle & star emblems, 2 white-uniformed tiêu binh
 *      honor guards, North & South stepped Ba Đình viewing tribunes)
 *    - Quảng Trường Ba Đình (`x = -915..-855`, Đường Hùng Vương parade avenue, 192 merged
 *      vertex-colored grass grid squares `ô cỏ Ba Đình` with gravel walkways, octagonal 3-tier
 *      Cột Cờ Ba Đình + 26m tapered flagstaff & animated red silk Cờ Tổ Quốc, crystal cluster
 *      streetlamps, twin golden bamboo hedges `tre ngà`, floral parterres)
 *    - Phủ Chủ Tịch, Đường Xoài, Ao Cá & Nhà Sàn Bác Hồ (`x = -998..-960`, 3-story mustard-ochre
 *      French Renaissance palace with white rusticated arcade, Ionic pilasters, pediment, dark
 *      mansard roof & wrought-iron gate; brick Đường Xoài mango path; reflective Ao Cá pond with
 *      stone coping, wooden fish-feeding pier & cypress root knees `bụt mọc`; 2-story dark-timber
 *      Nhà Sàn on 8 grounded stilts, ground-floor meeting table & chairs, twin stairs, upper study
 *      & flush terracotta gable roof, pomelo trees >= 5m clear of all roofs)
 *
 * 2. `HanoiOperaLongBienComplex` centered at `(1040, -240)` (`NB-111..220`):
 *    - Nhà Hát Lớn Hà Nội at `(1005, -240)` (1911 Palais-Garnier Beaux-Arts facade, stepped granite
 *      parvis stairs, 5-arch rusticated ground loggia, 6 pairs of fluted white Ionic columns,
 *      sculpted triangular pediment & balustrade cornice, cream-yellow & white plaster walls, green
 *      louvered arched windows, 3 dark-slate French mansard domes with flush gilded bronze lantern
 *      finials, warm glowing foyer windows, Quảng Trường Cách Mạng Tháng Tám circular fountain
 *      island, Parisian cast-iron lamps, benches & vintage cyclos)
 *    - Cầu Long Biên Lịch Sử at `(1068, -240)` spanning `z = -315..-165` (`150m` long over Sông Hồng
 *      river channel & green Bãi Giữa alluvial sandbar, 8 deep-grounded masonry cutwater stone piers,
 *      9 cantilevered weathered-steel truss spans with undulating dragon-spine silhouette, full
 *      node-locked X-bracing & overhead tie-beams, central wooden-sleeper railway with vintage
 *      green-and-crimson Đầu Máy & Toa Tàu Hà Nội train crossing mid-bridge, flanking cantilever
 *      walkways with iron railings, "1899-1902 DAYDÉ & PILLÉ" portal girder plaque, iron stepped
 *      stair down to Bãi Giữa banana/corn garden, and 2 moored Red River wooden boats)
 */

type FlagUniformEntry = { uTime: { value: number }; uWindSpeed?: { value: number } };

const GLYPH_STROKES: Record<string, ReadonlyArray<readonly [number, number, number, number]>> = {
  A: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.34, 0.0, 0.16, 1.0],
    [0.0, 0.42, 0.68, 0.16],
    [0.0, -0.04, 0.56, 0.15]
  ],
  C: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.04, 0.42, 0.68, 0.16],
    [0.04, -0.42, 0.68, 0.16]
  ],
  D: [
    [-0.34, 0.0, 0.16, 1.0],
    [-0.02, 0.42, 0.58, 0.16],
    [-0.02, -0.42, 0.58, 0.16],
    [0.32, 0.0, 0.16, 0.74]
  ],
  E: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.04, 0.42, 0.68, 0.16],
    [-0.02, 0.0, 0.54, 0.15],
    [0.04, -0.42, 0.68, 0.16]
  ],
  H: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.34, 0.0, 0.16, 1.0],
    [0.0, 0.0, 0.68, 0.16]
  ],
  I: [
    [0.0, 0.0, 0.18, 1.0]
  ],
  L: [
    [-0.32, 0.0, 0.16, 1.0],
    [0.04, -0.42, 0.68, 0.16]
  ],
  M: [
    [-0.38, 0.0, 0.15, 1.0],
    [0.38, 0.0, 0.15, 1.0],
    [-0.14, 0.16, 0.15, 0.58],
    [0.14, 0.16, 0.15, 0.58]
  ],
  N: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.34, 0.0, 0.16, 1.0],
    [0.0, 0.04, 0.42, 0.22]
  ],
  O: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.34, 0.0, 0.16, 1.0],
    [0.0, 0.42, 0.68, 0.16],
    [0.0, -0.42, 0.68, 0.16]
  ],
  P: [
    [-0.34, 0.0, 0.16, 1.0],
    [0.0, 0.42, 0.64, 0.16],
    [0.0, 0.04, 0.64, 0.15],
    [0.32, 0.23, 0.16, 0.42]
  ],
  T: [
    [0.0, 0.0, 0.18, 1.0],
    [0.0, 0.42, 0.80, 0.16]
  ],
  U: [
    [-0.34, 0.04, 0.16, 0.92],
    [0.34, 0.04, 0.16, 0.92],
    [0.0, -0.42, 0.68, 0.16]
  ],
  Y: [
    [-0.24, 0.26, 0.16, 0.48],
    [0.24, 0.26, 0.16, 0.48],
    [0.0, -0.20, 0.18, 0.60]
  ],
  '&': [
    [-0.06, 0.24, 0.48, 0.36],
    [-0.04, -0.20, 0.58, 0.44],
    [0.30, -0.22, 0.22, 0.34]
  ],
  '-': [
    [0.0, 0.0, 0.56, 0.16]
  ],
  '0': [
    [-0.32, 0.0, 0.16, 1.0],
    [0.32, 0.0, 0.16, 1.0],
    [0.0, 0.42, 0.64, 0.16],
    [0.0, -0.42, 0.64, 0.16]
  ],
  '1': [
    [0.04, 0.0, 0.18, 1.0],
    [-0.12, 0.34, 0.24, 0.15],
    [0.0, -0.42, 0.48, 0.15]
  ],
  '2': [
    [0.0, 0.42, 0.66, 0.16],
    [0.28, 0.21, 0.16, 0.42],
    [0.0, 0.0, 0.64, 0.15],
    [-0.28, -0.21, 0.16, 0.42],
    [0.0, -0.42, 0.68, 0.16]
  ],
  '8': [
    [-0.30, 0.0, 0.15, 1.0],
    [0.30, 0.0, 0.15, 1.0],
    [0.0, 0.42, 0.62, 0.15],
    [0.0, 0.0, 0.56, 0.14],
    [0.0, -0.42, 0.62, 0.15]
  ],
  '9': [
    [-0.30, 0.21, 0.15, 0.46],
    [0.30, 0.0, 0.15, 1.0],
    [0.0, 0.42, 0.62, 0.15],
    [0.0, 0.02, 0.60, 0.15],
    [0.0, -0.42, 0.62, 0.15]
  ]
};

interface GlyphToken {
  base: string;
  diacritic?: 'hook' | 'dotBelow' | 'circumflexGrave' | 'acute';
}

function add3DReliefInscription(
  pb: PartsBuilder,
  tokens: ReadonlyArray<GlyphToken | null>,
  centerX: number,
  centerY: number,
  centerZ: number,
  charHeight: number,
  depth: number,
  facing: 'east' | 'west' | 'south' | 'north'
): void {
  const charW = charHeight * 0.66;
  const step = charHeight * 0.84;
  const totalSpan = (tokens.length - 1) * step;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    const strokes = GLYPH_STROKES[tok.base];
    if (!strokes) continue;
    const offsetAlong = -totalSpan * 0.5 + i * step;

    const emitStroke = (lx: number, ly: number, lw: number, lh: number) => {
      const wSpan = lw * charW;
      const hSpan = lh * charHeight;
      if (facing === 'east') {
        // Faces +X: left-to-right runs from South (+Z) to North (-Z), i.e., -Z direction
        pb.box(depth, hSpan, wSpan, centerX, centerY + ly * charHeight, centerZ - (offsetAlong + lx * charW));
      } else if (facing === 'west') {
        // Faces -X: left-to-right runs from North (-Z) to South (+Z), i.e., +Z direction
        pb.box(depth, hSpan, wSpan, centerX, centerY + ly * charHeight, centerZ + (offsetAlong + lx * charW));
      } else if (facing === 'south') {
        // Faces +Z: left-to-right runs along +X
        pb.box(wSpan, hSpan, depth, centerX + offsetAlong + lx * charW, centerY + ly * charHeight, centerZ);
      } else {
        // Faces -Z: left-to-right runs along -X
        pb.box(wSpan, hSpan, depth, centerX - (offsetAlong + lx * charW), centerY + ly * charHeight, centerZ);
      }
    };

    for (const [sx, sy, sw, sh] of strokes) {
      emitStroke(sx, sy, sw, sh);
    }

    if (tok.diacritic === 'hook') {
      emitStroke(0.08, 0.66, 0.24, 0.14);
      emitStroke(0.16, 0.56, 0.14, 0.16);
    } else if (tok.diacritic === 'dotBelow') {
      emitStroke(0.0, -0.64, 0.18, 0.16);
    } else if (tok.diacritic === 'circumflexGrave') {
      emitStroke(-0.10, 0.62, 0.24, 0.13);
      emitStroke(0.10, 0.62, 0.24, 0.13);
      emitStroke(-0.18, 0.76, 0.22, 0.12);
    } else if (tok.diacritic === 'acute') {
      emitStroke(0.10, 0.65, 0.26, 0.14);
    }
  }
}

function getSharedVertexColorMat(
  ctx: VietnamBuilderContext,
  roughness: number,
  metalness: number,
  fallback: THREE.Material
): THREE.Material {
  if (ctx.materialLib) {
    return ctx.materialLib.getOrCreateStandard({
      color: '#ffffff',
      vertexColors: true,
      roughness,
      metalness,
      side: THREE.DoubleSide
    });
  }
  return fallback;
}

function getWavingFlagShader(
  ctx: VietnamBuilderContext,
  flagUniforms: FlagUniformEntry[],
  waveScale: number
): THREE.ShaderMaterial {
  if (ctx.sharedShaders) {
    const entry = ctx.sharedShaders.getWavingFlag({
      waveScale,
      color: '#d91619',
      showStar: true
    });
    if (!flagUniforms.includes(entry.uniforms)) {
      flagUniforms.push(entry.uniforms);
    }
    return entry.material;
  }
  const { material, uniforms } = createWavingSilkFlagMaterial({
    waveScale,
    color: '#d91619',
    showStar: true
  });
  ctx.extraMaterials.push(material);
  registerAnimatedUniform(ctx.animatedUniforms, flagUniforms, uniforms, true);
  return material;
}

function finalizeAndAddMesh(
  group: THREE.Group,
  pb: PartsBuilder,
  name: string,
  material: THREE.Material,
  castShadow = false,
  receiveShadow = true,
  worldUvScale?: number
): THREE.Mesh | null {
  const mesh = pb.buildMesh(name, material, castShadow, receiveShadow);
  if (!mesh) return null;
  if (worldUvScale && worldUvScale > 0) {
    applyWorldBoxUV(mesh.geometry, worldUvScale);
  }
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

function sampleMaxTerrain(
  ctx: VietnamBuilderContext,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  stepsX = 5,
  stepsZ = 5
): number {
  let maxH = -Infinity;
  for (let ix = 0; ix <= stepsX; ix++) {
    const x = x0 + ((x1 - x0) * ix) / stepsX;
    for (let iz = 0; iz <= stepsZ; iz++) {
      const z = z0 + ((z1 - z0) * iz) / stepsZ;
      const h = ctx.getHeight(x, z);
      if (Number.isFinite(h) && h > maxH) {
        maxH = h;
      }
    }
  }
  return Number.isFinite(maxH) ? maxH : 0;
}

function addColoredBox(
  pb: PartsBuilder,
  color: string,
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
  const g = new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d));
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  pb.addColored(g, color);
}

function addColoredCone(
  pb: PartsBuilder,
  color: string,
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
  const g = new THREE.ConeGeometry(Math.max(0.01, r), Math.max(0.01, h), Math.max(3, segs));
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  pb.addColored(g, color);
}

function addColoredCyl(
  pb: PartsBuilder,
  color: string,
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  rz = 0
): void {
  const g = new THREE.CylinderGeometry(
    Math.max(0.01, rTop),
    Math.max(0.01, rBot),
    Math.max(0.01, h),
    Math.max(3, segs)
  );
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  g.translate(x, y, z);
  pb.addColored(g, color);
}

function addHonorGuardFigure(
  whitePb: PartsBuilder,
  darkPb: PartsBuilder,
  goldPb: PartsBuilder,
  woodPb: PartsBuilder,
  x: number,
  feetY: number,
  z: number,
  facingYaw: number
): void {
  const cos = Math.cos(facingYaw);
  const sin = Math.sin(facingYaw);
  const lx = (ox: number, oz: number) => x + ox * cos + oz * sin;
  const lz = (ox: number, oz: number) => z - ox * sin + oz * cos;

  // Boots + white ceremonial trousers + crisp white tunic + peaked visor cap + ceremonial rifle
  for (const side of [-0.11, 0.11]) {
    darkPb.box(0.13, 0.22, 0.24, lx(side, 0.03), feetY + 0.11, lz(side, 0.03), { ry: facingYaw });
    whitePb.box(0.14, 0.68, 0.16, lx(side, 0), feetY + 0.54, lz(side, 0), { ry: facingYaw });
  }
  whitePb.box(0.42, 0.66, 0.24, x, feetY + 1.18, z, { ry: facingYaw });
  darkPb.box(0.44, 0.07, 0.26, x, feetY + 1.04, z, { ry: facingYaw });
  goldPb.box(0.10, 0.08, 0.04, lx(0, 0.13), feetY + 1.04, lz(0, 0.13), { ry: facingYaw });
  // Gold shoulder epaulets & aiguillette cord
  for (const side of [-0.18, 0.18]) {
    goldPb.box(0.12, 0.04, 0.20, lx(side, 0), feetY + 1.50, lz(side, 0), { ry: facingYaw });
    whitePb.box(0.12, 0.56, 0.13, lx(side * 1.38, 0.02), feetY + 1.20, lz(side * 1.38, 0.02), { ry: facingYaw });
  }
  // Head & white peaked cap
  whitePb.cyl(0.11, 0.10, 0.22, 5, x, feetY + 1.62, z);
  whitePb.cyl(0.17, 0.13, 0.10, 6, x, feetY + 1.76, z);
  darkPb.box(0.22, 0.03, 0.14, lx(0, 0.09), feetY + 1.72, lz(0, 0.09), { ry: facingYaw });
  goldPb.box(0.05, 0.05, 0.03, lx(0, 0.14), feetY + 1.77, lz(0, 0.14), { ry: facingYaw });
  // SKS ceremonial rifle with silver-gold bayonet held upright at right side
  woodPb.box(0.06, 0.96, 0.09, lx(0.28, 0.08), feetY + 0.58, lz(0.28, 0.08), { ry: facingYaw });
  goldPb.cyl(0.016, 0.022, 0.62, 4, lx(0.28, 0.08), feetY + 1.34, lz(0.28, 0.08));
}

function addTropicalTree(
  barkPb: PartsBuilder,
  foliagePb: PartsBuilder,
  x: number,
  groundY: number,
  z: number,
  trunkH: number,
  crownR: number,
  leafColors: readonly [string, string, string],
  fruitColor?: string
): void {
  // Grounded trunk (-0.30m embed) + 3 root flares + 2 primary limbs
  barkPb.cyl(trunkH * 0.055, trunkH * 0.092, trunkH + 0.30, 5, x, groundY + (trunkH - 0.30) * 0.5, z);
  for (let b = 0; b < 3; b++) {
    const ang = (b / 3) * Math.PI * 2 + (x * 0.17);
    const bx = x + Math.cos(ang) * crownR * 0.28;
    const bz = z + Math.sin(ang) * crownR * 0.28;
    barkPb.strut(
      new THREE.Vector3(x, groundY + trunkH * 0.72, z),
      new THREE.Vector3(bx, groundY + trunkH + crownR * 0.26, bz),
      trunkH * 0.032,
      trunkH * 0.048,
      4
    );
  }

  // Layered low-poly faceted foliage crown
  addColoredCone(foliagePb, leafColors[0], crownR * 1.02, crownR * 0.95, 6, x, groundY + trunkH + crownR * 0.28, z, x * 0.3);
  addColoredCone(foliagePb, leafColors[1], crownR * 0.84, crownR * 0.88, 6, x + crownR * 0.12, groundY + trunkH + crownR * 0.66, z - crownR * 0.08, 0.7);
  addColoredCone(foliagePb, leafColors[2], crownR * 0.62, crownR * 0.74, 5, x - crownR * 0.08, groundY + trunkH + crownR * 1.02, z + crownR * 0.10, 1.4);

  if (fruitColor) {
    for (let f = 0; f < 5; f++) {
      const ang = (f / 5) * Math.PI * 2 + 0.4;
      addColoredBox(
        foliagePb,
        fruitColor,
        0.22,
        0.24,
        0.22,
        x + Math.cos(ang) * crownR * 0.58,
        groundY + trunkH + crownR * 0.06 + (f % 2) * 0.22,
        z + Math.sin(ang) * crownR * 0.58
      );
    }
  }
}

// ============================================================================
// 1. BA ĐÌNH MAUSOLEUM, QUẢNG TRƯỜNG BA ĐÌNH & PHỦ CHỦ TỊCH COMPLEX (-940, -120)
// ============================================================================
function buildBaDinhMausoleumComplex(
  ctx: VietnamBuilderContext,
  flagUniforms: FlagUniformEntry[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BaDinhMausoleumComplex';

  const detailIds: string[] = [];
  for (let i = 1; i <= 110; i++) {
    detailIds.push(`NB-${String(i).padStart(3, '0')}`);
  }
  group.userData = {
    landmarkId: 'hanoi.ba-dinh-complex',
    center: [-940, -120],
    detailIds
  };

  // Register exclusion halos so procedural meadow grass/trees never pierce plazas, ponds, or roofs
  ctx.exclusionCircles.push(
    { x: -940, z: -120, r: 52 },
    { x: -884, z: -120, r: 48 },
    { x: -980, z: -120, r: 44 }
  );

  // Sample terrain across the precinct so zero slope gap or hill poke-through ever occurs
  const sampledMax = sampleMaxTerrain(ctx, -1000, -854, -162, -78, 6, 6);
  const baseY = Math.max(ctx.getHeight(-940, -120), sampledMax + 0.12, 2.2);
  const plazaY = baseY - 0.08;
  const skirtDepth = 4.6;

  // Material accumulators — strictly reusing ctx.materials.* & canonical vertex-color library
  const heroGranitePb = new PartsBuilder(); // HERO 1 (castShadow = true)
  const heroPalaceOchrePb = new PartsBuilder(); // HERO 2 (castShadow = true)

  const graniteTrimPb = new PartsBuilder();
  const stonePb = new PartsBuilder();
  const whitePb = new PartsBuilder();
  const crimsonPb = new PartsBuilder();
  const darkRoofPb = new PartsBuilder();
  const terracottaPb = new PartsBuilder();
  const brickPathPb = new PartsBuilder();
  const darkWoodPb = new PartsBuilder();
  const goldPb = new PartsBuilder();
  const bronzePb = new PartsBuilder();
  const barkPb = new PartsBuilder();
  const voidPb = new PartsBuilder();
  const glowPb = new PartsBuilder();
  const silkPb = new PartsBuilder();

  const grassAndFoliageVcPb = new PartsBuilder();
  const waterVcPb = new PartsBuilder();

  // --------------------------------------------------------------------------
  // A. HO CHI MINH MAUSOLEUM (LĂNG CHỦ TỊCH HỒ CHÍ MINH) AT (-940, -120)
  //    NB-001..036: Facing East (+X) onto Đường Hùng Vương & Quảng Trường Ba Đình
  // --------------------------------------------------------------------------
  const mX = -940.0;
  const mZ = -120.0;

  // NB-001..003: Deep -4.6m granite retaining foundation skirt + ceremonial terrace deck
  graniteTrimPb.box(29.0, skirtDepth, 36.0, mX, baseY - skirtDepth * 0.5, mZ);
  graniteTrimPb.box(12.5, skirtDepth, 76.0, -920.5, plazaY - skirtDepth * 0.5, mZ);
  stonePb.box(28.4, 0.24, 35.4, mX, baseY - 0.12, mZ);

  // NB-004..006: Stepped 3-tier grey-purple & dark-red granite modernist podium
  const pod1H = 0.86;
  const pod2H = 0.84;
  const pod3H = 0.80;
  const podTopY = baseY + pod1H + pod2H + pod3H; // baseY + 2.50m
  heroGranitePb.box(25.2, pod1H, 31.2, mX, baseY + pod1H * 0.5, mZ);
  heroGranitePb.box(22.8, pod2H, 28.6, mX, baseY + pod1H + pod2H * 0.5, mZ);
  heroGranitePb.box(20.6, pod3H, 26.2, mX, baseY + pod1H + pod2H + pod3H * 0.5, mZ);

  // Dark-red porphyry horizontal podium bands & plinth coping
  crimsonPb.box(25.36, 0.16, 31.36, mX, baseY + pod1H - 0.06, mZ);
  crimsonPb.box(22.96, 0.16, 28.76, mX, baseY + pod1H + pod2H - 0.06, mZ);
  crimsonPb.box(20.76, 0.16, 26.36, mX, podTopY - 0.06, mZ);

  // NB-007..009: Grand East (+X) 9-step granite entrance stairs & flanking granite cheek blocks
  const stairSteps = 9;
  const stairW = 10.6;
  for (let s = 0; s < stairSteps; s++) {
    const stepH = (podTopY - baseY) / stairSteps;
    const sx = mX + 13.4 - s * 0.42;
    graniteTrimPb.box(0.56, stepH * (s + 1), stairW, sx, baseY + stepH * (s + 1) * 0.5, mZ);
  }
  for (const sz of [-1, 1]) {
    graniteTrimPb.box(4.6, 1.55, 1.25, mX + 12.0, baseY + 0.775, mZ + sz * (stairW * 0.5 + 0.62));
    crimsonPb.box(4.7, 0.18, 1.35, mX + 12.0, baseY + 1.62, mZ + sz * (stairW * 0.5 + 0.62));
    // Ceremonial stone braziers atop stair cheeks (NB-009)
    bronzePb.cyl(0.42, 0.28, 0.36, 6, mX + 13.5, baseY + 1.88, mZ + sz * (stairW * 0.5 + 0.62));
  }

  // NB-010..013: Inner sanctum chamber hall (crimson-granite core + recessed gallery shadow bays)
  const colClearH = 4.50;
  const entY = podTopY + colClearH; // baseY + 7.00m
  heroGranitePb.box(14.6, colClearH + 0.16, 19.8, mX, podTopY + colClearH * 0.5, mZ);
  crimsonPb.box(14.76, colClearH - 0.30, 19.96, mX, podTopY + colClearH * 0.5, mZ);
  // Pilaster strips along inner sanctum walls
  for (let pz = -7.5; pz <= 7.51; pz += 3.75) {
    graniteTrimPb.box(14.92, colClearH, 0.44, mX, podTopY + colClearH * 0.5, mZ + pz);
  }

  // NB-014..016: 18 Square Granite Peristyle Columns around upper gallery
  //   6 on East (+X), 6 on West (-X), 3 intermediate on North (-Z), 3 intermediate on South (+Z) = 18 columns!
  //   Embedded -0.15m into podiumTopY and +0.10m flush into upper entablature!
  const colPositions: Array<[number, number]> = [];
  const colHalfX = 9.15;
  const colHalfZ = 11.60;
  for (let i = 0; i < 6; i++) {
    const cz = mZ - colHalfZ + (i * (colHalfZ * 2)) / 5;
    colPositions.push([mX + colHalfX, cz]);
    colPositions.push([mX - colHalfX, cz]);
  }
  for (let j = 1; j <= 3; j++) {
    const cx = mX - colHalfX + (j * (colHalfX * 2)) / 4;
    colPositions.push([cx, mZ - colHalfZ]);
    colPositions.push([cx, mZ + colHalfZ]);
  }
  const colTotalH = colClearH + 0.25; // -0.15m podium embed .. +0.10m entablature embed
  const colCenterY = podTopY - 0.15 + colTotalH * 0.5;
  for (const [cx, cz] of colPositions) {
    heroGranitePb.box(0.84, colTotalH, 0.84, cx, colCenterY, cz);
    graniteTrimPb.box(1.06, 0.26, 1.06, cx, podTopY + 0.13, cz);
    graniteTrimPb.box(1.02, 0.22, 1.02, cx, entY - 0.11, cz);
  }

  // NB-017..020: Upper Entablature + 3-Stepped Flat Modernist Granite Attic Crown
  const entH = 1.28;
  heroGranitePb.box(20.4, entH, 26.0, mX, entY + entH * 0.5, mZ);
  crimsonPb.box(20.55, 0.20, 26.15, mX, entY + entH - 0.08, mZ);

  const atticBaseY = entY + entH;
  heroGranitePb.box(18.6, 0.82, 24.0, mX, atticBaseY + 0.41, mZ);
  heroGranitePb.box(16.4, 0.76, 21.6, mX, atticBaseY + 0.82 + 0.38, mZ);
  heroGranitePb.box(14.2, 0.72, 19.2, mX, atticBaseY + 1.58 + 0.36, mZ);
  graniteTrimPb.box(11.4, 0.32, 15.8, mX, atticBaseY + 2.30 + 0.16, mZ);

  // NB-021..022: Dark-crimson "CHỦ TỊCH HỒ CHÍ MINH" lintel fascia plaque + 3D gold relief inscription
  const plaqueX = mX + 10.28;
  const plaqueY = entY + entH * 0.52;
  crimsonPb.box(0.22, 0.94, 14.4, plaqueX, plaqueY, mZ);
  goldPb.box(0.25, 0.07, 14.6, plaqueX + 0.02, plaqueY + 0.46, mZ);
  goldPb.box(0.25, 0.07, 14.6, plaqueX + 0.02, plaqueY - 0.46, mZ);
  add3DReliefInscription(
    goldPb,
    [
      { base: 'C' },
      { base: 'H' },
      { base: 'U', diacritic: 'hook' },
      null,
      { base: 'T' },
      { base: 'I', diacritic: 'dotBelow' },
      { base: 'C' },
      { base: 'H' },
      null,
      { base: 'H' },
      { base: 'O', diacritic: 'circumflexGrave' },
      null,
      { base: 'C' },
      { base: 'H' },
      { base: 'I', diacritic: 'acute' },
      null,
      { base: 'M' },
      { base: 'I' },
      { base: 'N' },
      { base: 'H' }
    ],
    plaqueX + 0.12,
    plaqueY - 0.03,
    mZ,
    0.42,
    0.07,
    'east'
  );

  // NB-023..026: Portal vestibule, bronze double portal doors, gold Hammer-Sickle & 5-Pointed Star,
  //              warm vestibule sconce glow & 2 white-uniformed Tiêu Binh Honor Guards
  const portalFaceX = mX + 7.35;
  voidPb.box(0.45, 3.65, 3.85, portalFaceX - 0.10, podTopY + 1.825, mZ);
  graniteTrimPb.box(0.42, 3.92, 0.48, portalFaceX + 0.08, podTopY + 1.96, mZ - 2.05);
  graniteTrimPb.box(0.42, 3.92, 0.48, portalFaceX + 0.08, podTopY + 1.96, mZ + 2.05);
  graniteTrimPb.box(0.46, 0.46, 4.58, portalFaceX + 0.08, podTopY + 3.98, mZ);

  // Bronze double portal doors with raised coffered panels & ring handles
  for (const side of [-0.88, 0.88]) {
    bronzePb.box(0.16, 3.38, 1.66, portalFaceX + 0.06, podTopY + 1.69, mZ + side);
    for (const py of [0.78, 1.75, 2.72]) {
      goldPb.box(0.06, 0.62, 1.16, portalFaceX + 0.15, podTopY + py, mZ + side);
    }
    goldPb.cyl(0.11, 0.11, 0.05, 6, portalFaceX + 0.18, podTopY + 1.52, mZ + side * 0.32, { rz: Math.PI * 0.5 });
  }

  // Gold Star & Hammer-Sickle ceremonial emblems flanking upper vestibule screen
  goldPb.cyl(0.34, 0.34, 0.08, 5, portalFaceX + 0.16, podTopY + 3.98, mZ - 1.15, { rz: Math.PI * 0.5 });
  goldPb.box(0.08, 0.54, 0.10, portalFaceX + 0.16, podTopY + 3.98, mZ + 1.15, { rx: 0.72 });
  goldPb.box(0.08, 0.18, 0.28, portalFaceX + 0.16, podTopY + 4.14, mZ + 1.02, { rx: 0.72 });
  goldPb.cyl(0.24, 0.24, 0.07, 6, portalFaceX + 0.16, podTopY + 3.98, mZ + 1.22, { rz: Math.PI * 0.5 });

  // Warm interior sanctuary sconces
  for (const sz of [-3.2, 3.2]) {
    glowPb.box(0.18, 0.42, 0.24, portalFaceX + 0.16, podTopY + 2.85, mZ + sz);
  }

  // 2 White-Uniformed Honor Guards (Tiêu Binh Lăng Bác) standing on crisp red-carpet podium mats
  for (const gz of [-2.85, 2.85]) {
    crimsonPb.box(1.15, 0.08, 1.15, mX + 10.15, podTopY + 0.04, mZ + gz);
    addHonorGuardFigure(whitePb, darkRoofPb, goldPb, darkWoodPb, mX + 10.15, podTopY + 0.08, mZ + gz, Math.PI * 0.5);
  }

  // Ceremonial queue brass stanchions with red velvet ropes along East forecourt
  for (let q = -2; q <= 2; q++) {
    if (q === 0) continue;
    const qz = mZ + q * 3.4;
    goldPb.cyl(0.04, 0.06, 0.96, 5, mX + 16.2, plazaY + 0.48, qz);
    crimsonPb.box(0.06, 0.06, 2.9, mX + 16.2, plazaY + 0.84, qz - Math.sign(q) * 1.45);
  }

  // NB-027..036: North & South Stepped Viewing Tribunes (Khán Đài Ba Đình A & B)
  for (const side of [-1, 1]) {
    const tribZ = mZ + side * 26.8;
    const tribX = -937.5;
    graniteTrimPb.box(16.4, skirtDepth, 15.6, tribX, baseY - skirtDepth * 0.5, tribZ);
    // 5 stepped granite spectator seating tiers facing East (+X) onto Đường Hùng Vương
    for (let st = 0; st < 5; st++) {
      const tierW = 15.2;
      const tierD = 2.2;
      const tierH = 0.56 * (st + 1);
      const tx = tribX + 5.2 - st * 2.2;
      stonePb.box(tierD, tierH, tierW, tx, baseY + tierH * 0.5, tribZ);
      graniteTrimPb.box(0.22, 0.12, tierW, tx + 1.0, baseY + tierH + 0.06, tribZ);
    }
    // Rear modernist colonnade wall + cantilevered sun canopy roof + VIP balustrade
    const rearTop = baseY + 5.85;
    whitePb.box(1.35, 5.85, 15.4, tribX - 5.2, baseY + 2.925, tribZ);
    for (let c = -2; c <= 2; c++) {
      // Embedded -0.15m into top tier, flush into canopy soffit
      graniteTrimPb.box(0.48, 3.30, 0.48, tribX - 2.6, baseY + 2.65 + 1.50, tribZ + c * 3.2);
    }
    graniteTrimPb.box(9.6, 0.42, 16.0, tribX - 1.4, rearTop + 0.21, tribZ);
    crimsonPb.box(0.16, 0.62, 6.4, tribX + 6.32, baseY + 0.88, tribZ);
    goldPb.cyl(0.18, 0.18, 0.06, 5, tribX + 6.42, baseY + 0.88, tribZ, { rz: Math.PI * 0.5 });
  }

  // --------------------------------------------------------------------------
  // B. QUẢNG TRƯỜNG BA ĐÌNH (`x = -915..-855, z = -158..-82`)
  //    NB-037..070: Đường Hùng Vương, 192 Grass Squares, Cột Cờ Ba Đình,
  //                 Crystal Cluster Lamps, Bamboo Hedges & Floral Parterres
  // --------------------------------------------------------------------------
  // NB-037..040: Retaining skirt under entire Ba Đình Square + Đường Hùng Vương parade avenue
  graniteTrimPb.box(64.0, skirtDepth, 78.0, -885.5, plazaY - skirtDepth * 0.5, mZ);
  // Đường Hùng Vương ceremonial granite/asphalt avenue (x = -916..-902)
  graniteTrimPb.box(14.4, 0.22, 76.8, -909.0, plazaY - 0.05, mZ);
  // Crisp white stone ceremonial parade lane markers & review line
  for (let lz = -152; lz <= -88; lz += 8) {
    whitePb.box(0.24, 0.04, 3.6, -909.0, plazaY + 0.07, lz);
  }
  stonePb.box(0.45, 0.10, 76.8, -916.1, plazaY + 0.04, mZ);
  stonePb.box(0.45, 0.10, 76.8, -901.9, plazaY + 0.04, mZ);

  // NB-041..048: Gravel grid bed + 192 Lush Green Grass Grid Squares (Ô Cỏ Ba Đình: 16 rows × 12 cols)
  addColoredBox(grassAndFoliageVcPb, '#cfc7b6', 47.6, 0.14, 71.2, -878.0, plazaY - 0.03, mZ);
  const rows = 16; // along Z (-153.6 .. -86.4)
  const cols = 12; // along X (-899.6 .. -856.4)
  const cellSpanZ = 67.2 / rows; // 4.20m
  const cellSpanX = 43.2 / cols; // 3.60m
  const padZ = cellSpanZ - 0.56; // 3.64m grass square + 0.56m gravel path
  const padX = cellSpanX - 0.54; // 3.06m grass square + 0.54m gravel path
  const lawnShades = ['#3d8533', '#46913b', '#367b2d', '#4e9842'] as const;
  const randLawn = mulberry32(19450902);

  for (let r = 0; r < rows; r++) {
    const cz = -153.6 + (r + 0.5) * cellSpanZ;
    for (let c = 0; c < cols; c++) {
      const cx = -899.6 + (c + 0.5) * cellSpanX;
      // Leave clean ceremonial paved sanctuary around Cột Cờ Ba Đình at (-895.5, -120)
      if (Math.abs(cx - (-895.5)) < 4.3 && Math.abs(cz - mZ) < 4.6) {
        addColoredBox(grassAndFoliageVcPb, '#dcd5c6', padX, 0.08, padZ, cx, plazaY + 0.05, cz);
        continue;
      }
      const shadeIdx = (r + c + (randLawn() > 0.65 ? 1 : 0)) % lawnShades.length;
      addColoredBox(grassAndFoliageVcPb, lawnShades[shadeIdx], padX, 0.10, padZ, cx, plazaY + 0.07, cz);
    }
  }

  // NB-049..056: Cột Cờ Ba Đình (Octagonal 3-Tier Stone Pedestal + 26m Tapered Flagstaff + Animated Silk Cờ Tổ Quốc)
  const fpX = -895.5;
  const fpZ = mZ;
  stonePb.cyl(3.85, 4.15, 0.62, 8, fpX, plazaY + 0.31, fpZ);
  graniteTrimPb.cyl(2.90, 3.15, 0.58, 8, fpX, plazaY + 0.91, fpZ);
  stonePb.cyl(1.95, 2.18, 0.56, 8, fpX, plazaY + 1.48, fpZ);
  // 8 carved corner stone bollards with bronze chains around Cột Cờ base
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const bx = fpX + Math.cos(ang) * 3.55;
    const bz = fpZ + Math.sin(ang) * 3.55;
    stonePb.box(0.26, 0.64, 0.26, bx, plazaY + 0.94, bz);
    goldPb.sphere(0.11, 5, 3, bx, plazaY + 1.30, bz);
  }
  // Bronze National Emblem relief plaque on East/West pedestal faces
  bronzePb.cyl(0.36, 0.36, 0.10, 6, fpX - 2.02, plazaY + 1.48, fpZ, { rz: Math.PI * 0.5 });
  bronzePb.cyl(0.36, 0.36, 0.10, 6, fpX + 2.02, plazaY + 1.48, fpZ, { rz: Math.PI * 0.5 });

  // 26m tapered steel/white-granite flagstaff (embedded -0.40m into pedestal) + gold finial orb
  const poleBaseY = plazaY + 1.76;
  const poleH = 26.0;
  whitePb.cyl(0.11, 0.34, poleH + 0.40, 6, fpX, poleBaseY + (poleH - 0.40) * 0.5, fpZ);
  bronzePb.cyl(0.44, 0.54, 0.68, 6, fpX, poleBaseY + 0.34, fpZ);
  goldPb.sphere(0.28, 6, 4, fpX, poleBaseY + poleH + 0.22, fpZ);

  // Animated waving red silk Cờ Tổ Quốc (5.4m × 3.6m)
  const baDinhFlagGeo = new THREE.PlaneGeometry(5.4, 3.6, 10, 6);
  baDinhFlagGeo.translate(fpX + 2.74, poleBaseY + poleH - 2.05, fpZ);
  baDinhFlagGeo.computeBoundingBox();
  baDinhFlagGeo.computeBoundingSphere();
  const baDinhFlagMat = getWavingFlagShader(ctx, flagUniforms, 1.0);
  const baDinhFlagMesh = new THREE.Mesh(baDinhFlagGeo, baDinhFlagMat);
  baDinhFlagMesh.name = 'BaDinhNationalFlag';
  baDinhFlagMesh.castShadow = false;
  baDinhFlagMesh.receiveShadow = false;
  group.add(baDinhFlagMesh);

  // NB-057..062: 8 Crystal Cluster High-Mast Plaza Streetlamps (Đèn Chùm Pha Lê Ba Đình)
  for (const side of [-1, 1]) {
    const lampZ = mZ + side * 36.6;
    for (let li = 0; li < 4; li++) {
      const lampX = -906.0 + li * 15.5;
      stonePb.cyl(0.46, 0.58, 0.72, 6, lampX, plazaY + 0.36, lampZ);
      bronzePb.cyl(0.09, 0.20, 9.6, 5, lampX, plazaY + 5.4, lampZ);
      bronzePb.cyl(0.95, 0.24, 0.32, 6, lampX, plazaY + 10.1, lampZ);
      // 5 glowing lotus-crystal cluster globes per mast
      glowPb.sphere(0.28, 5, 3, lampX, plazaY + 10.65, lampZ);
      for (let g = 0; g < 4; g++) {
        const ga = (g / 4) * Math.PI * 2 + Math.PI * 0.25;
        glowPb.sphere(0.21, 5, 3, lampX + Math.cos(ga) * 0.74, plazaY + 10.35, lampZ + Math.sin(ga) * 0.74);
      }
    }
  }

  // NB-063..070: Twin Flanks of Golden-Stem Bamboo Hedges (Tre Ngà Ba Đình) & Floral Parterres
  //   Kept at z = -160.5 and z = -79.5 (>= 7m clear of Mausoleum & Viewing Tribunes!)
  for (const side of [-1, 1]) {
    const hedgeZ = mZ + side * 40.5;
    stonePb.box(56.0, 0.42, 2.2, -886.0, plazaY + 0.21, hedgeZ);
    for (let cl = 0; cl < 14; cl++) {
      const bx = -912.0 + cl * 4.0;
      // 3 golden bamboo culms per clump + emerald foliage tuft
      for (let stem = -1; stem <= 1; stem++) {
        const hCulm = 4.2 + ((cl + stem + 3) % 3) * 0.55;
        goldPb.cyl(0.055, 0.075, hCulm, 4, bx + stem * 0.38, plazaY + 0.35 + hCulm * 0.5, hedgeZ + (stem % 2) * 0.22);
      }
      addColoredCone(grassAndFoliageVcPb, '#4a9838', 1.45, 2.35, 5, bx, plazaY + 4.35, hedgeZ, cl * 0.5);
      addColoredCone(grassAndFoliageVcPb, '#5cad44', 1.10, 1.85, 5, bx, plazaY + 5.45, hedgeZ, cl * 0.9);
    }

    // Seasonal crimson & marigold floral parterre beds along East avenue (x = -855)
    const bedZ = mZ + side * 18.0;
    stonePb.box(3.4, 0.36, 16.0, -854.5, plazaY + 0.18, bedZ);
    addColoredBox(grassAndFoliageVcPb, '#2e6e28', 2.9, 0.22, 15.4, -854.5, plazaY + 0.38, bedZ);
    addColoredBox(grassAndFoliageVcPb, '#cc2929', 1.2, 0.18, 14.2, -854.5, plazaY + 0.52, bedZ);
    addColoredBox(grassAndFoliageVcPb, '#ebba2d', 0.45, 0.22, 13.4, -854.5, plazaY + 0.60, bedZ);
  }

  // Ceremonial white sentry pavilions & granite perimeter bollards along Độc Lập edge
  for (const sz of [-29.5, 29.5]) {
    whitePb.box(1.75, 2.55, 1.75, -915.2, plazaY + 1.275, mZ + sz);
    terracottaPb.add(
      createHueImperialHipRoofGeometry(2.35, 2.35, 0.65, 0.65, 0.68, 0.14, 3, 2).translate(-915.2, plazaY + 2.52, mZ + sz)
    );
  }
  for (let bz = -150; bz <= -90; bz += 10) {
    graniteTrimPb.cyl(0.18, 0.22, 0.78, 5, -853.2, plazaY + 0.39, bz);
  }

  // --------------------------------------------------------------------------
  // C. PHỦ CHỦ TỊCH, ĐƯỜNG XOÀI, AO CÁ & NHÀ SÀN BÁC HỒ (`x = -1000..-960`)
  //    NB-071..110: West / NW Garden Precinct behind Mausoleum
  // --------------------------------------------------------------------------
  const gardenY = baseY - 0.04;
  graniteTrimPb.box(44.0, skirtDepth, 80.0, -980.0, gardenY - skirtDepth * 0.5, -120.0);
  addColoredBox(grassAndFoliageVcPb, '#397830', 43.2, 0.10, 79.2, -980.0, gardenY - 0.03, -120.0);

  // NB-071..084: PHỦ CHỦ TỊCH (3-Story Mustard-Ochre French Renaissance Palace at (-979, -94))
  //   Facing South (+Z) toward Ao Cá & Đường Xoài
  const ppX = -979.0;
  const ppZ = -94.0;
  const ppW = 22.4;
  const ppD = 11.4;
  const ppPlinthH = 1.15;
  const ppFloor1Y = gardenY + ppPlinthH;

  stonePb.box(ppW + 1.2, ppPlinthH + 0.40, ppD + 1.2, ppX, gardenY + (ppPlinthH - 0.40) * 0.5, ppZ);
  // 3-story mustard-ochre Renaissance main block + twin projecting corner pavilions (HERO 2)
  const ppBodyH = 10.4;
  heroPalaceOchrePb.box(ppW - 5.2, ppBodyH, ppD - 0.8, ppX, ppFloor1Y + ppBodyH * 0.5, ppZ);
  for (const sx of [-1, 1]) {
    heroPalaceOchrePb.box(4.6, ppBodyH + 0.45, ppD + 0.6, ppX + sx * 8.9, ppFloor1Y + (ppBodyH + 0.45) * 0.5, ppZ);
  }

  // White rusticated ground-floor 5-arch central arcade + perron double staircase
  whitePb.box(ppW - 5.0, 0.34, ppD - 0.5, ppX, ppFloor1Y + 3.35, ppZ);
  whitePb.box(ppW + 0.4, 0.38, ppD + 0.9, ppX, ppFloor1Y + 6.95, ppZ);
  whitePb.box(ppW + 0.7, 0.48, ppD + 1.1, ppX, ppFloor1Y + ppBodyH + 0.18, ppZ);

  // Perron front steps (+Z face)
  for (let st = 0; st < 5; st++) {
    stonePb.box(7.8 - st * 0.35, ppPlinthH * ((st + 1) / 5), 0.55, ppX, gardenY + (ppPlinthH * (st + 1)) / 10, ppZ + ppD * 0.5 + 2.4 - st * 0.48);
  }
  stonePb.box(8.4, ppPlinthH, 1.4, ppX, gardenY + ppPlinthH * 0.5, ppZ + ppD * 0.5 + 0.5);

  // 5 ground arcade openings + 6 white Ionic pilasters (embedded -0.15m) + green louvered French windows
  const frontZ = ppZ + (ppD - 0.8) * 0.5;
  for (let b = -2; b <= 2; b++) {
    const bx = ppX + b * 2.45;
    // Ground arcade recessed shadow arch + keystone
    voidPb.box(1.42, 2.55, 0.24, bx, ppFloor1Y + 1.28, frontZ + 0.04);
    whitePb.box(1.72, 0.34, 0.28, bx, ppFloor1Y + 2.68, frontZ + 0.08);
    whitePb.box(0.32, 0.46, 0.34, bx, ppFloor1Y + 2.78, frontZ + 0.12);

    // 2nd & 3rd floor green louvered shuttered windows + white pediments + warm evening glow
    for (const wy of [4.95, 8.45]) {
      glowPb.box(1.06, 1.88, 0.16, bx, ppFloor1Y + wy, frontZ + 0.04);
      addColoredBox(grassAndFoliageVcPb, '#245c3c', 0.42, 1.86, 0.14, bx - 0.68, ppFloor1Y + wy, frontZ + 0.10);
      addColoredBox(grassAndFoliageVcPb, '#245c3c', 0.42, 1.86, 0.14, bx + 0.68, ppFloor1Y + wy, frontZ + 0.10);
      whitePb.box(1.56, 0.22, 0.28, bx, ppFloor1Y + wy + 1.06, frontZ + 0.10);
    }
  }
  // 6 white Ionic pilasters across 2nd-3rd story facade (embedded -0.15m into belt course & +0.10m into cornice)
  for (let p = 0; p < 6; p++) {
    const px = ppX - 6.125 + p * 2.45;
    whitePb.box(0.42, 7.10, 0.32, px, ppFloor1Y + 3.35 + 3.45, frontZ + 0.14);
    whitePb.box(0.58, 0.26, 0.40, px, ppFloor1Y + ppBodyH - 0.08, frontZ + 0.16);
  }
  // Corner pavilion windows & quoins
  for (const sx of [-1, 1]) {
    const cpx = ppX + sx * 8.9;
    const cpz = ppZ + (ppD + 0.6) * 0.5;
    for (const wy of [1.65, 5.05, 8.55]) {
      glowPb.box(1.24, 1.95, 0.16, cpx, ppFloor1Y + wy, cpz + 0.04);
      addColoredBox(grassAndFoliageVcPb, '#245c3c', 0.46, 1.92, 0.14, cpx - 0.78, ppFloor1Y + wy, cpz + 0.10);
      addColoredBox(grassAndFoliageVcPb, '#245c3c', 0.46, 1.92, 0.14, cpx + 0.78, ppFloor1Y + wy, cpz + 0.10);
      whitePb.box(1.80, 0.24, 0.28, cpx, ppFloor1Y + wy + 1.08, cpz + 0.10);
    }
    for (let q = 0; q < 9; q++) {
      whitePb.box(0.48, 0.56, 0.48, cpx + sx * 2.18, ppFloor1Y + 0.55 + q * 1.12, cpz - 0.08);
    }
  }

  // Sculpted central triangular Renaissance pediment + rooftop stone balustrade + steep dark-slate mansard roofs
  const ppRoofY = ppFloor1Y + ppBodyH + 0.36;
  whitePb.add(createGableRoofGeometry(8.4, 1.4, 2.15, 0.24, 'z').translate(ppX, ppRoofY - 0.06, frontZ + 0.18));
  heroPalaceOchrePb.box(6.8, 1.25, 0.85, ppX, ppRoofY + 0.56, frontZ + 0.04);
  goldPb.cyl(0.44, 0.44, 0.14, 6, ppX, ppRoofY + 0.82, frontZ + 0.54, { rx: Math.PI * 0.5 });

  // Flush dark-slate French mansard roofs (central + twin corner pavilions) + bronze cresting
  darkRoofPb.add(
    createHueImperialHipRoofGeometry(ppW - 4.4, ppD - 0.2, ppW - 8.2, ppD - 3.8, 2.85, 0.08, 4, 3).translate(ppX, ppRoofY - 0.05, ppZ)
  );
  for (const sx of [-1, 1]) {
    darkRoofPb.add(
      createHueImperialHipRoofGeometry(5.2, ppD + 1.1, 2.4, ppD - 2.2, 3.45, 0.08, 4, 3).translate(ppX + sx * 8.9, ppRoofY + 0.04, ppZ)
    );
    bronzePb.box(2.3, 0.36, 0.12, ppX + sx * 8.9, ppRoofY + 3.62, ppZ);
    goldPb.cone(0.16, 0.95, 5, ppX + sx * 8.9, ppRoofY + 4.15, ppZ);
  }
  // Palace rooftop Cờ Tổ Quốc flagpole
  whitePb.cyl(0.05, 0.08, 4.6, 5, ppX, ppRoofY + 4.9, ppZ);
  const palaceFlagGeo = new THREE.PlaneGeometry(2.1, 1.4, 8, 5);
  palaceFlagGeo.translate(ppX + 1.08, ppRoofY + 6.45, ppZ);
  palaceFlagGeo.computeBoundingBox();
  palaceFlagGeo.computeBoundingSphere();
  const palaceFlagMesh = new THREE.Mesh(palaceFlagGeo, getWavingFlagShader(ctx, flagUniforms, 0.65));
  palaceFlagMesh.name = 'PresidentialPalaceFlag';
  palaceFlagMesh.castShadow = false;
  palaceFlagMesh.receiveShadow = false;
  group.add(palaceFlagMesh);

  // NB-085..087: Ornate Wrought-Iron Ceremonial Gate (Cổng Sắt Phủ Chủ Tịch at (-961.5, -94))
  const gateX = -961.5;
  const gateZ = -94.0;
  for (const sz of [-4.2, -1.8, 1.8, 4.2]) {
    heroPalaceOchrePb.box(0.92, 3.55, 0.92, gateX, gardenY + 1.775, gateZ + sz);
    whitePb.box(1.12, 0.28, 1.12, gateX, gardenY + 3.65, gateZ + sz);
    glowPb.sphere(0.22, 5, 3, gateX, gardenY + 4.02, gateZ + sz);
  }
  // Wrought-iron gate leaves, vertical spears & gilded crest arch
  darkRoofPb.box(0.14, 2.95, 3.3, gateX, gardenY + 1.52, gateZ);
  darkRoofPb.box(0.12, 2.45, 2.1, gateX, gardenY + 1.28, gateZ - 3.0);
  darkRoofPb.box(0.12, 2.45, 2.1, gateX, gardenY + 1.28, gateZ + 3.0);
  goldPb.box(0.18, 0.62, 2.6, gateX, gardenY + 3.25, gateZ);
  goldPb.cyl(0.28, 0.28, 0.16, 6, gateX, gardenY + 3.58, gateZ, { rz: Math.PI * 0.5 });

  // NB-088..091: ĐƯỜNG XOÀI (Warm Red-Brick Mango Path + Whitewashed Curbs + Mango Trees >= 6.5m clear of roofs)
  brickPathPb.box(14.0, 0.14, 3.6, -969.5, gardenY + 0.08, -104.2);
  brickPathPb.box(3.6, 0.14, 39.5, -964.2, gardenY + 0.08, -123.5);
  brickPathPb.box(14.5, 0.14, 3.4, -971.0, gardenY + 0.08, -141.2);
  whitePb.box(0.22, 0.18, 39.5, -962.3, gardenY + 0.10, -123.5);
  whitePb.box(0.22, 0.18, 39.5, -966.1, gardenY + 0.10, -123.5);

  // 4 Ancient Mango Trees (Cây Xoài Đường Bác) along x = -959.2, z = -109..-133 (>= 6.8m clear of all buildings!)
  for (const mz of [-109.5, -117.5, -125.5, -133.5]) {
    addTropicalTree(
      barkPb,
      grassAndFoliageVcPb,
      -959.2,
      gardenY,
      mz,
      3.8,
      2.35,
      ['#2d6e27', '#398232', '#47943c'],
      '#e5b535'
    );
  }

  // NB-092..098: AO CÁ BÁC HỒ (Reflective Blue-Green Pond + Stone Coping + Fish-Feeding Pier + Cypress Knees)
  const pondX = -980.5;
  const pondZ = -122.5;
  const pondW = 21.6;
  const pondD = 18.8;
  // Stone coping curb wall around pond (with -4.0m skirt) + reflective blue-green water plane slightly above ground
  stonePb.box(pondW + 1.3, 1.2, pondD + 1.3, pondX, gardenY - 0.34, pondZ);
  stonePb.box(pondW + 1.4, 0.42, 0.68, pondX, gardenY + 0.24, pondZ - pondD * 0.5 - 0.30);
  stonePb.box(pondW + 1.4, 0.42, 0.68, pondX, gardenY + 0.24, pondZ + pondD * 0.5 + 0.30);
  stonePb.box(0.68, 0.42, pondD + 0.2, pondX - pondW * 0.5 - 0.30, gardenY + 0.24, pondZ);
  stonePb.box(0.68, 0.42, pondD + 0.2, pondX + pondW * 0.5 + 0.30, gardenY + 0.24, pondZ);

  const pondWaterY = gardenY + 0.16;
  addColoredBox(waterVcPb, '#1c6d6a', pondW, 0.12, pondD, pondX, pondWaterY - 0.04, pondZ);

  // Wooden fish-feeding pier (Cầu Gỗ Cho Cá Ăn) jutting West into Ao Cá from Đường Xoài shore
  const pierX = pondX + pondW * 0.5 - 2.1;
  const pierZ = pondZ + 3.2;
  darkWoodPb.box(5.0, 0.18, 2.35, pierX, pondWaterY + 0.34, pierZ);
  for (const px of [-2.1, 0.0, 2.1]) {
    for (const pz of [-0.98, 0.98]) {
      darkWoodPb.cyl(0.09, 0.10, 1.95, 5, pierX + px, pondWaterY - 0.15, pierZ + pz);
    }
  }
  darkWoodPb.box(4.8, 0.08, 0.09, pierX, pondWaterY + 1.06, pierZ - 1.06);
  darkWoodPb.box(4.8, 0.08, 0.09, pierX, pondWaterY + 1.06, pierZ + 1.06);
  darkWoodPb.box(0.09, 0.08, 2.20, pierX - 2.36, pondWaterY + 1.06, pierZ);
  for (const pz of [-1.06, 1.06]) {
    darkWoodPb.box(0.09, 0.72, 0.09, pierX - 2.36, pondWaterY + 0.72, pierZ + pz);
    darkWoodPb.box(0.09, 0.72, 0.09, pierX, pondWaterY + 0.72, pierZ + pz);
  }
  // Golden-red carp / Cá Chép Bác Hồ swimming right at the feeding pier!
  for (let k = 0; k < 7; k++) {
    const kx = pierX - 2.9 - (k % 3) * 0.65;
    const kz = pierZ - 0.9 + k * 0.32;
    goldPb.box(0.38, 0.06, 0.13, kx, pondWaterY + 0.02, kz, { ry: (k - 3) * 0.28 });
  }

  // Pond-side Bald Cypress Root Knees (Bụt Mọc) along West & NW pond bank (x = -992.6, >= 6.5m clear of roofs!)
  for (let rk = 0; rk < 14; rk++) {
    const rkx = -992.6 - (rk % 2) * 0.65;
    const rkz = -130.5 + rk * 1.35;
    const kh = 0.42 + (rk % 3) * 0.18;
    barkPb.cone(0.14, kh + 0.20, 5, rkx, gardenY + kh * 0.5 - 0.06, rkz);
  }
  addTropicalTree(barkPb, grassAndFoliageVcPb, -995.5, gardenY, -122.5, 4.6, 2.4, ['#2b6633', '#36783d', '#458c4b']);

  // NB-099..110: NHÀ SÀN BÁC HỒ (Authentic 2-Story Dark-Timber Stilt House at (-980.5, -146.5))
  const nsX = -980.5;
  const nsZ = -146.5;
  const nsPatioY = gardenY + 0.14;
  const stiltTopY = nsPatioY + 2.55;

  // Grounded Bát Tràng red-brick patio plinth
  brickPathPb.box(13.8, 0.28, 8.2, nsX, nsPatioY - 0.06, nsZ);
  stonePb.box(14.2, 0.16, 8.6, nsX, gardenY + 0.04, nsZ);

  // 8 Grounded Wooden Stilts (embedded -0.25m into brick plinth, flush into upper floor beams)
  for (let ix = 0; ix < 4; ix++) {
    const sx = nsX - 5.1 + ix * 3.4;
    for (const sz of [-2.45, 2.45]) {
      stonePb.cyl(0.26, 0.30, 0.24, 6, sx, nsPatioY + 0.10, nsZ + sz);
      darkWoodPb.cyl(0.18, 0.20, 2.85, 6, sx, nsPatioY - 0.20 + 1.425, nsZ + sz);
    }
  }
  // Transverse & longitudinal timber floor girders
  for (let ix = 0; ix < 4; ix++) {
    darkWoodPb.box(0.24, 0.28, 5.8, nsX - 5.1 + ix * 3.4, stiltTopY - 0.12, nsZ);
  }
  darkWoodPb.box(12.2, 0.22, 6.2, nsX, stiltTopY + 0.05, nsZ);

  // Open ground-floor Politburo meeting table, 10 chairs & aquarium stone planter
  darkWoodPb.box(3.8, 0.10, 1.15, nsX, nsPatioY + 0.78, nsZ);
  darkWoodPb.box(0.14, 0.76, 0.90, nsX - 1.45, nsPatioY + 0.38, nsZ);
  darkWoodPb.box(0.14, 0.76, 0.90, nsX + 1.45, nsPatioY + 0.38, nsZ);
  for (let ch = 0; ch < 4; ch++) {
    const cx = nsX - 1.35 + ch * 0.90;
    for (const cz of [-0.92, 0.92]) {
      darkWoodPb.box(0.42, 0.44, 0.42, cx, nsPatioY + 0.22, nsZ + cz);
      darkWoodPb.box(0.42, 0.46, 0.08, cx, nsPatioY + 0.65, nsZ + cz + Math.sign(cz) * 0.18);
    }
  }
  for (const ex of [-2.35, 2.35]) {
    darkWoodPb.box(0.44, 0.44, 0.44, nsX + ex, nsPatioY + 0.22, nsZ);
    darkWoodPb.box(0.08, 0.48, 0.44, nsX + ex + Math.sign(ex) * 0.18, nsPatioY + 0.66, nsZ);
  }
  // Stone fish-aquarium planter box on ground patio
  stonePb.box(1.35, 0.68, 0.62, nsX + 4.2, nsPatioY + 0.34, nsZ + 1.6);

  // Twin wooden stairs with handrails ascending on East & West ends
  for (const sideX of [-1, 1]) {
    const stairBaseX = nsX + sideX * 6.55;
    const stairTopX = nsX + sideX * 5.65;
    for (let st = 0; st < 8; st++) {
      const t = (st + 0.5) / 8;
      darkWoodPb.box(
        0.34,
        0.10,
        1.25,
        stairBaseX + (stairTopX - stairBaseX) * t,
        nsPatioY + 0.20 + t * 2.35,
        nsZ + 1.35
      );
    }
    for (const rzOff of [0.72, 1.98]) {
      darkWoodPb.strut(
        new THREE.Vector3(stairBaseX, nsPatioY + 0.85, nsZ + rzOff),
        new THREE.Vector3(stairTopX, stiltTopY + 0.92, nsZ + rzOff),
        0.05,
        0.05,
        4
      );
    }
  }

  // Upper timber study & bedroom cabin + wrap-around veranda railing + warm desk lamp glow
  const cabinH = 2.48;
  darkWoodPb.box(9.6, cabinH, 4.3, nsX, stiltTopY + cabinH * 0.5, nsZ);
  // Veranda wooden balustrade
  darkWoodPb.box(12.1, 0.10, 0.10, nsX, stiltTopY + 0.92, nsZ + 3.02);
  darkWoodPb.box(12.1, 0.10, 0.10, nsX, stiltTopY + 0.92, nsZ - 3.02);
  for (let rp = -5; rp <= 5; rp++) {
    darkWoodPb.box(0.09, 0.92, 0.09, nsX + rp * 1.15, stiltTopY + 0.46, nsZ + 3.02);
    darkWoodPb.box(0.09, 0.92, 0.09, nsX + rp * 1.15, stiltTopY + 0.46, nsZ - 3.02);
  }
  // Upper study windows + warm reading lamp glow
  for (const wx of [-2.6, 0.0, 2.6]) {
    glowPb.box(1.10, 1.05, 0.12, nsX + wx, stiltTopY + 1.35, nsZ + 2.18);
    glowPb.box(1.10, 1.05, 0.12, nsX + wx, stiltTopY + 1.35, nsZ - 2.18);
  }
  // Upper veranda corner posts supporting roof eaves flush
  for (const sx of [-5.8, -2.0, 2.0, 5.8]) {
    for (const sz of [-2.95, 2.95]) {
      darkWoodPb.box(0.16, cabinH + 0.12, 0.16, nsX + sx, stiltTopY + cabinH * 0.5, nsZ + sz);
    }
  }

  // Flush terracotta 2-slope pitched gable roof (`createGableRoofGeometry` seated flush on cabin eaves!)
  terracottaPb.add(
    createGableRoofGeometry(13.4, 7.4, 2.05, 0.18, 'x').translate(nsX, stiltTopY + cabinH - 0.05, nsZ)
  );
  // Timber gable triangles closing East & West ends flush under pitched roof
  darkWoodPb.cone(3.55, 1.95, 3, nsX - 4.78, stiltTopY + cabinH + 0.92, nsZ, { ry: Math.PI * 0.5 });
  darkWoodPb.cone(3.55, 1.95, 3, nsX + 4.78, stiltTopY + cabinH + 0.92, nsZ, { ry: -Math.PI * 0.5 });

  // Red Hibiscus hedge (Hàng Râm Bụt) + 2 Pomelo Trees (Cây Bưởi Bác Hồ, >= 8.5m clear of Nhà Sàn roof!)
  addColoredBox(grassAndFoliageVcPb, '#2c722a', 14.0, 0.95, 0.85, nsX, gardenY + 0.48, -155.2);
  for (let hb = -6; hb <= 6; hb += 2) {
    silkPb.sphere(0.16, 4, 3, nsX + hb * 1.05, gardenY + 0.98, -155.2);
  }
  addTropicalTree(
    barkPb,
    grassAndFoliageVcPb,
    -996.2, // |-996.2 - (-987.2)| = 9.0m >= 5.0m clear of Nhà Sàn roof!
    gardenY,
    -146.5,
    3.4,
    2.05,
    ['#367d2c', '#459138', '#56a346'],
    '#dce35b'
  );
  addTropicalTree(
    barkPb,
    grassAndFoliageVcPb,
    -964.0, // |-964.0 - (-973.8)| = 9.8m >= 5.0m clear of Nhà Sàn roof!
    gardenY,
    -147.0,
    3.5,
    2.10,
    ['#367d2c', '#459138', '#56a346'],
    '#dce35b'
  );

  // Finalize BaDinhMausoleumComplex merged meshes (ONLY 2 hero meshes have castShadow = true!)
  const matVcGrass = getSharedVertexColorMat(
    ctx,
    0.75,
    0.0,
    ctx.materials.jadeRoof ?? ctx.materials.stone
  );
  const matVcWater = getSharedVertexColorMat(
    ctx,
    0.30,
    0.15,
    ctx.materials.bronzePatina ?? ctx.materials.granite
  );

  finalizeAndAddMesh(group, heroGranitePb, 'BaDinhMausoleumHeroGranite', ctx.materials.granite, true, true, 2.8);
  finalizeAndAddMesh(
    group,
    heroPalaceOchrePb,
    'PresidentialPalaceHeroOchre',
    ctx.materials.yellowOchrePlaster,
    true,
    true,
    2.6
  );

  finalizeAndAddMesh(group, graniteTrimPb, 'BaDinhGranitePlazasAndTrim', ctx.materials.granite, false, true, 3.2);
  finalizeAndAddMesh(group, stonePb, 'BaDinhStoneTerracesAndCoping', ctx.materials.stone, false, true, 2.6);
  finalizeAndAddMesh(group, whitePb, 'BaDinhWhiteArchitecturalTrim', ctx.materials.whitePlaster, false, true, 2.4);
  finalizeAndAddMesh(group, crimsonPb, 'BaDinhCrimsonGraniteBands', ctx.materials.crimsonLacquer, false, true, 2.2);
  finalizeAndAddMesh(group, darkRoofPb, 'BaDinhMansardSlateAndIron', ctx.materials.darkRoof, false, true, 2.2);
  finalizeAndAddMesh(group, terracottaPb, 'BaDinhNhaSanTerracottaRoofs', ctx.materials.terracottaRoof, false, true);
  finalizeAndAddMesh(
    group,
    brickPathPb,
    'BaDinhDuongXoaiBrickWalk',
    ctx.materials.marseilleBrick ?? ctx.materials.terracottaRoof,
    false,
    true,
    1.8
  );
  finalizeAndAddMesh(
    group,
    darkWoodPb,
    'BaDinhNhaSanTimberStructure',
    ctx.materials.darkIronwood ?? ctx.materials.darkWood,
    false,
    true,
    1.8
  );
  finalizeAndAddMesh(group, goldPb, 'BaDinhGildedEmblemsAndBamboo', ctx.materials.gold, false, false);
  finalizeAndAddMesh(group, bronzePb, 'BaDinhBronzeDoorsAndMasts', ctx.materials.bronze, false, true);
  finalizeAndAddMesh(group, barkPb, 'BaDinhTrunksAndCypressKnees', ctx.materials.bark, false, true, 1.5);
  finalizeAndAddMesh(group, voidPb, 'BaDinhPortalShadowRecesses', ctx.materials.darkVoid, false, false);
  finalizeAndAddMesh(
    group,
    glowPb,
    'BaDinhCrystalLampsAndWindows',
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    false,
    false
  );
  finalizeAndAddMesh(group, silkPb, 'BaDinhHibiscusBlossoms', ctx.materials.lanternSilk, false, false);
  finalizeAndAddMesh(group, grassAndFoliageVcPb, 'BaDinhGrassGridMesh', matVcGrass, false, true);
  finalizeAndAddMesh(group, waterVcPb, 'BaDinhAoCaWaterMesh', matVcWater, false, true);

  tagMotifIds(group, ['HV-A04', 'HV-D01', 'HV-I01', 'NB-001', 'NB-050', 'NB-100', 'NB-110']);
  ctx.scene.add(group);
  return group;
}

// ============================================================================
// 2. HANOI OPERA HOUSE & LONG BIÊN BRIDGE COMPLEX (1040, -240)
// ============================================================================
function buildHanoiOperaLongBienComplex(
  ctx: VietnamBuilderContext,
  flagUniforms: FlagUniformEntry[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HanoiOperaLongBienComplex';

  const detailIds: string[] = [];
  for (let i = 111; i <= 220; i++) {
    detailIds.push(`NB-${String(i).padStart(3, '0')}`);
  }
  group.userData = {
    landmarkId: 'hanoi.opera-long-bien-complex',
    center: [1040, -240],
    detailIds
  };

  // Register exclusion circles covering Cách Mạng Tháng Tám Square, Opera House, and full 150m Long Biên Bridge
  ctx.exclusionCircles.push(
    { x: 992, z: -240, r: 46 },
    { x: 1068, z: -240, r: 48 },
    { x: 1068, z: -292, r: 42 },
    { x: 1068, z: -188, r: 42 }
  );

  // Material accumulators — ONLY 2 hero meshes (`heroOperaPb`, `heroBridgeTrussPb`) cast shadows!
  const heroOperaPb = new PartsBuilder(); // HERO 3 (castShadow = true)
  const heroBridgeTrussPb = new PartsBuilder(); // HERO 4 (castShadow = true)

  const whitePb = new PartsBuilder();
  const ochrePb = new PartsBuilder();
  const stonePb = new PartsBuilder();
  const granitePb = new PartsBuilder();
  const darkRoofPb = new PartsBuilder();
  const crimsonPb = new PartsBuilder();
  const darkWoodPb = new PartsBuilder();
  const sandPb = new PartsBuilder();
  const goldPb = new PartsBuilder();
  const bronzePb = new PartsBuilder();
  const barkPb = new PartsBuilder();
  const voidPb = new PartsBuilder();
  const glowPb = new PartsBuilder();
  const silkPb = new PartsBuilder();

  const vcFoliageAndTrainPb = new PartsBuilder();
  const vcRiverWaterPb = new PartsBuilder();

  // --------------------------------------------------------------------------
  // A. NHÀ HÁT LỚN HÀ NỘI (1005, -240) & QUẢNG TRƯỜNG CÁCH MẠNG THÁNG TÁM (972, -240)
  //    NB-111..165: Facing West (-X) toward Circular Fountain Square
  // --------------------------------------------------------------------------
  const opX = 1005.0;
  const opZ = -240.0;
  const operaMaxH = sampleMaxTerrain(ctx, 956, 1024, -270, -210, 5, 5);
  const opBaseY = Math.max(ctx.getHeight(opX, opZ), operaMaxH + 0.14, 2.4);
  const opSkirt = 4.6;

  // NB-111..114: Deep -4.6m stone retaining skirt under Opera House & Cách Mạng Tháng Tám Square
  granitePb.box(70.0, opSkirt, 60.0, 990.0, opBaseY - opSkirt * 0.5, opZ);
  stonePb.box(69.2, 0.22, 59.2, 990.0, opBaseY - 0.08, opZ);

  // NB-115..118: Wide stepped granite parvis stairs on West (-X) front + carriage cheek ramps
  const opPodH = 1.80;
  const opPodY = opBaseY + opPodH;
  stonePb.box(24.8, opPodH, 40.8, opX + 1.0, opBaseY + opPodH * 0.5, opZ);
  for (let s = 0; s < 9; s++) {
    const sh = (opPodH * (s + 1)) / 9;
    granitePb.box(0.58, sh, 24.4, opX - 15.2 + s * 0.48, opBaseY + sh * 0.5, opZ);
  }
  for (const sz of [-1, 1]) {
    const cz = opZ + sz * 13.0;
    stonePb.box(4.8, opPodH + 0.45, 1.6, opX - 13.2, opBaseY + (opPodH + 0.45) * 0.5, cz);
    // Classical bronze 3-globe parvis candelabra
    bronzePb.cyl(0.10, 0.22, 3.1, 5, opX - 14.8, opBaseY + opPodH + 1.65, cz);
    glowPb.sphere(0.24, 5, 3, opX - 14.8, opBaseY + opPodH + 3.35, cz);
    glowPb.sphere(0.18, 5, 3, opX - 14.8, opBaseY + opPodH + 3.05, cz - 0.42);
    glowPb.sphere(0.18, 5, 3, opX - 14.8, opBaseY + opPodH + 3.05, cz + 0.42);
  }

  // NB-119..126: Beaux-Arts Main Building Massing (HERO 3: pale cream-ochre walls)
  //   Central 5-bay loggia & auditorium + North/South corner pavilions + East fly-tower stage house
  const gFloorH = 4.25;
  const pNobileH = 5.40;
  const entOperaY = opPodY + gFloorH + pNobileH; // opPodY + 9.65m
  heroOperaPb.box(16.6, gFloorH + pNobileH, 25.6, opX - 2.2, opPodY + (gFloorH + pNobileH) * 0.5, opZ);
  for (const sz of [-1, 1]) {
    heroOperaPb.box(14.8, gFloorH + pNobileH + 0.35, 8.2, opX - 3.6, opPodY + (gFloorH + pNobileH + 0.35) * 0.5, opZ + sz * 16.2);
  }
  // Rear stage fly-tower drum
  heroOperaPb.box(13.2, gFloorH + pNobileH + 2.6, 19.6, opX + 6.4, opPodY + (gFloorH + pNobileH + 2.6) * 0.5, opZ);

  // Crisp white rusticated ground-floor horizontal bands & classical cornices
  const westFacadeX = opX - 10.55;
  for (let r = 0; r < 5; r++) {
    whitePb.box(0.32, 0.34, 26.0, westFacadeX, opPodY + 0.48 + r * 0.82, opZ);
  }
  whitePb.box(17.4, 0.42, 41.2, opX - 2.4, opPodY + gFloorH, opZ);
  whitePb.box(17.8, 0.56, 41.6, opX - 2.4, entOperaY + 0.24, opZ);

  // NB-127..132: 5-Arch Rusticated Ground Loggia + Warm Glowing Foyer Windows + Iron Balconies
  for (let b = -2; b <= 2; b++) {
    const bz = opZ + b * 4.65;
    // Ground-floor arched portal opening + white keystone + warm foyer crystal chandelier glow inside
    voidPb.box(0.52, 3.15, 2.48, westFacadeX - 0.02, opPodY + 1.58, bz);
    glowPb.box(0.18, 2.55, 1.82, westFacadeX + 0.22, opPodY + 1.52, bz);
    whitePb.box(0.42, 0.42, 2.96, westFacadeX - 0.08, opPodY + 3.25, bz);
    whitePb.box(0.50, 0.58, 0.42, westFacadeX - 0.14, opPodY + 3.42, bz);

    // 2nd-story Piano Nobile arched French doors + green louvered shutters + wrought-iron balcony
    const winY = opPodY + gFloorH + 2.55;
    glowPb.box(0.22, 3.35, 1.86, westFacadeX + 0.04, winY, bz);
    addColoredBox(vcFoliageAndTrainPb, '#266141', 0.18, 3.25, 0.52, westFacadeX - 0.08, winY, bz - 1.16);
    addColoredBox(vcFoliageAndTrainPb, '#266141', 0.18, 3.25, 0.52, westFacadeX - 0.08, winY, bz + 1.16);
    whitePb.box(0.44, 0.36, 2.56, westFacadeX - 0.14, winY + 1.86, bz);
    // Projecting stone balcony deck & iron balustrade
    whitePb.box(0.92, 0.24, 3.10, westFacadeX - 0.42, opPodY + gFloorH + 0.12, bz);
    darkRoofPb.box(0.10, 0.78, 2.95, westFacadeX - 0.82, opPodY + gFloorH + 0.62, bz);
  }

  // NB-133..138: 6 Pairs of Fluted White Ionic Columns (12 Columns!) across 2nd-Story Facade
  //   Embedded -0.15m into 2nd-story stylobate and +0.10m flush into upper classical entablature!
  const ionicColH = pNobileH + 0.25;
  const ionicColCenterY = opPodY + gFloorH - 0.15 + ionicColH * 0.5;
  for (let pair = 0; pair < 6; pair++) {
    const pairZ = opZ - 11.625 + pair * 4.65;
    for (const offZ of [-0.46, 0.46]) {
      const cz = pairZ + offZ;
      const cx = westFacadeX - 0.56;
      whitePb.box(0.62, 0.34, 0.62, cx, opPodY + gFloorH + 0.17, cz);
      whitePb.cyl(0.25, 0.29, ionicColH, 6, cx, ionicColCenterY, cz);
      // Twin Ionic volute scroll capital
      whitePb.box(0.56, 0.24, 0.74, cx, entOperaY - 0.12, cz);
      goldPb.cyl(0.12, 0.12, 0.58, 5, cx - 0.08, entOperaY - 0.16, cz - 0.30, { rz: Math.PI * 0.5 });
      goldPb.cyl(0.12, 0.12, 0.58, 5, cx - 0.08, entOperaY - 0.16, cz + 0.30, { rz: Math.PI * 0.5 });
    }
  }

  // Corner pavilion arched windows, green shutters & side facade bays
  for (const sz of [-1, 1]) {
    const pavZ = opZ + sz * 16.2;
    const pavWestX = opX - 11.0;
    for (const wy of [opPodY + 2.05, opPodY + gFloorH + 2.55]) {
      glowPb.box(0.22, 2.85, 1.92, pavWestX - 0.02, wy, pavZ);
      addColoredBox(vcFoliageAndTrainPb, '#266141', 0.18, 2.80, 0.54, pavWestX - 0.10, wy, pavZ - 1.20);
      addColoredBox(vcFoliageAndTrainPb, '#266141', 0.18, 2.80, 0.54, pavWestX - 0.10, wy, pavZ + 1.20);
      whitePb.box(0.46, 0.34, 2.65, pavWestX - 0.14, wy + 1.58, pavZ);
    }
    // Side wing green-louvered windows along North/South faces
    for (let sxOff = -8.0; sxOff <= 8.0; sxOff += 4.0) {
      const sideFaceZ = opZ + sz * 20.32;
      glowPb.box(1.55, 2.65, 0.18, opX + sxOff, opPodY + gFloorH + 2.45, sideFaceZ);
      addColoredBox(vcFoliageAndTrainPb, '#266141', 0.48, 2.60, 0.16, opX + sxOff - 1.0, opPodY + gFloorH + 2.45, sideFaceZ);
      addColoredBox(vcFoliageAndTrainPb, '#266141', 0.48, 2.60, 0.16, opX + sxOff + 1.0, opPodY + gFloorH + 2.45, sideFaceZ);
    }
  }

  // NB-139..143: Sculpted Triangular Beaux-Arts Pediment, "1911" Frieze & Pierced Balustrade Cornice
  const atticTopY = entOperaY + 0.52;
  whitePb.add(
    createGableRoofGeometry(2.2, 14.8, 2.85, 0.28, 'x').translate(westFacadeX - 0.15, atticTopY - 0.04, opZ)
  );
  ochrePb.box(1.4, 1.45, 11.4, westFacadeX + 0.05, atticTopY + 0.72, opZ);
  // Gilded lyre, theatrical masks & "1911" relief inside pediment tympanum
  goldPb.cyl(0.58, 0.58, 0.18, 6, westFacadeX - 0.68, atticTopY + 1.08, opZ, { rz: Math.PI * 0.5 });
  add3DReliefInscription(
    goldPb,
    [{ base: '1' }, { base: '9' }, { base: '1' }, { base: '1' }],
    westFacadeX - 0.64,
    entOperaY + 0.24,
    opZ,
    0.34,
    0.08,
    'west'
  );
  // Rooftop stone balustrade cornice + carved urn finials
  for (let bz = -19.5; bz <= 19.51; bz += 3.0) {
    if (Math.abs(bz) < 7.2) continue;
    whitePb.box(0.44, 0.96, 0.44, westFacadeX - 0.25, atticTopY + 0.48, opZ + bz);
    whitePb.sphere(0.22, 5, 3, westFacadeX - 0.25, atticTopY + 1.12, opZ + bz);
  }
  whitePb.box(0.28, 0.20, 12.6, westFacadeX - 0.25, atticTopY + 0.86, opZ - 13.6);
  whitePb.box(0.28, 0.20, 12.6, westFacadeX - 0.25, atticTopY + 0.86, opZ + 13.6);

  // NB-144..148: 3 Iconic Dark-Slate French Mansard Domes (ctx.materials.darkRoof) + Flush Gilded Bronze Finials
  //   1) Central Grand Auditorium Mansard Dome
  const mainDomeBaseY = opPodY + gFloorH + pNobileH + 2.52;
  heroOperaPb.add(
    createHueImperialHipRoofGeometry(14.2, 20.6, 6.8, 11.2, 4.85, 0.08, 4, 3).translate(opX + 5.6, mainDomeBaseY, opZ)
  );
  darkRoofPb.add(
    createHueImperialHipRoofGeometry(14.4, 20.8, 6.9, 11.3, 4.90, 0.08, 4, 3).translate(opX + 5.6, mainDomeBaseY + 0.02, opZ)
  );
  bronzePb.box(7.0, 0.42, 11.4, opX + 5.6, mainDomeBaseY + 5.02, opZ);
  goldPb.cyl(0.32, 0.56, 1.35, 6, opX + 5.6, mainDomeBaseY + 5.75, opZ);
  goldPb.cone(0.26, 2.35, 5, opX + 5.6, mainDomeBaseY + 7.45, opZ);

  //   2) & 3) North and South Corner Pavilion French Mansard Domes + Gilded Finials
  for (const sz of [-1, 1]) {
    const dZ = opZ + sz * 16.2;
    const dX = opX - 3.6;
    const pDomeY = atticTopY + 0.28;
    darkRoofPb.add(
      createHueImperialHipRoofGeometry(15.2, 8.8, 6.8, 3.8, 3.65, 0.08, 4, 3).translate(dX, pDomeY, dZ)
    );
    // Bull's-eye oculus dormer on West face
    whitePb.cyl(0.62, 0.62, 0.36, 6, dX - 5.9, pDomeY + 1.55, dZ, { rz: Math.PI * 0.5 });
    glowPb.cyl(0.42, 0.42, 0.40, 6, dX - 5.95, pDomeY + 1.55, dZ, { rz: Math.PI * 0.5 });
    // Flush gilded bronze lantern finial (embedded -0.20m into dome crown!)
    bronzePb.box(6.9, 0.32, 3.9, dX, pDomeY + 3.74, dZ);
    goldPb.cyl(0.24, 0.42, 1.05, 6, dX, pDomeY + 4.25, dZ);
    goldPb.cone(0.20, 1.85, 5, dX, pDomeY + 5.55, dZ);
  }
  // Opera rooftop flag
  whitePb.cyl(0.05, 0.07, 4.4, 5, westFacadeX - 0.15, atticTopY + 4.8, opZ);
  const operaFlagGeo = new THREE.PlaneGeometry(2.0, 1.35, 8, 5);
  operaFlagGeo.translate(westFacadeX + 0.88, atticTopY + 6.28, opZ);
  operaFlagGeo.computeBoundingBox();
  operaFlagGeo.computeBoundingSphere();
  const operaFlagMesh = new THREE.Mesh(operaFlagGeo, getWavingFlagShader(ctx, flagUniforms, 0.65));
  operaFlagMesh.name = 'HanoiOperaFlag';
  operaFlagMesh.castShadow = false;
  operaFlagMesh.receiveShadow = false;
  group.add(operaFlagMesh);

  // NB-149..165: QUẢNG TRƯỜNG CÁCH MẠNG THÁNG TÁM (Circular Traffic Fountain Island, Parisian Lamps, Benches & Cyclos)
  const sqX = 971.5;
  const sqZ = opZ;
  granitePb.cyl(8.8, 9.2, 0.24, 12, sqX, opBaseY + 0.12, sqZ);
  stonePb.cyl(6.2, 6.5, 0.62, 10, sqX, opBaseY + 0.42, sqZ);
  addColoredCyl(vcRiverWaterPb, '#257d84', 5.65, 5.65, 0.14, 10, sqX, opBaseY + 0.72, sqZ);
  // Central tiered Beaux-Arts stone & bronze fountain pedestal + water plume
  stonePb.cyl(1.45, 1.85, 1.15, 6, sqX, opBaseY + 1.25, sqZ);
  bronzePb.cyl(2.25, 0.85, 0.46, 8, sqX, opBaseY + 1.95, sqZ);
  bronzePb.cyl(0.55, 0.85, 1.10, 6, sqX, opBaseY + 2.65, sqZ);
  whitePb.cone(0.68, 1.25, 6, sqX, opBaseY + 3.65, sqZ);
  // Ring of crimson/gold flowers around fountain island curb
  for (let fl = 0; fl < 10; fl++) {
    const ang = (fl / 10) * Math.PI * 2;
    addColoredBox(
      vcFoliageAndTrainPb,
      fl % 2 === 0 ? '#c92a2a' : '#eab62c',
      1.15,
      0.26,
      1.15,
      sqX + Math.cos(ang) * 7.45,
      opBaseY + 0.34,
      sqZ + Math.sin(ang) * 7.45,
      -ang
    );
  }

  // 8 Parisian Cast-Iron Streetlamps + 4 Park Benches around Cách Mạng Tháng Tám Square
  for (let lp = 0; lp < 8; lp++) {
    const ang = (lp / 8) * Math.PI * 2 + Math.PI / 8;
    const lx = sqX + Math.cos(ang) * 13.6;
    const lz = sqZ + Math.sin(ang) * 13.6;
    darkRoofPb.cyl(0.18, 0.30, 0.68, 5, lx, opBaseY + 0.34, lz);
    darkRoofPb.cyl(0.07, 0.13, 4.4, 5, lx, opBaseY + 2.8, lz);
    bronzePb.box(0.86, 0.10, 0.10, lx, opBaseY + 4.95, lz, { ry: ang });
    glowPb.sphere(0.22, 5, 3, lx + Math.cos(ang) * 0.38, opBaseY + 4.82, lz + Math.sin(ang) * 0.38);
    glowPb.sphere(0.22, 5, 3, lx - Math.cos(ang) * 0.38, opBaseY + 4.82, lz - Math.sin(ang) * 0.38);
    if (lp % 2 === 0) {
      const bx = sqX + Math.cos(ang) * 12.1;
      const bz = sqZ + Math.sin(ang) * 12.1;
      darkWoodPb.box(0.55, 0.10, 1.85, bx, opBaseY + 0.48, bz, { ry: -ang });
      darkWoodPb.box(0.10, 0.48, 1.85, bx + Math.cos(ang) * 0.24, opBaseY + 0.76, bz + Math.sin(ang) * 0.24, { ry: -ang });
      darkRoofPb.box(0.52, 0.46, 0.12, bx - Math.sin(ang) * 0.74, opBaseY + 0.23, bz + Math.cos(ang) * 0.74, { ry: -ang });
      darkRoofPb.box(0.52, 0.46, 0.12, bx + Math.sin(ang) * 0.74, opBaseY + 0.23, bz - Math.cos(ang) * 0.74, { ry: -ang });
    }
  }

  // 3 Vintage Hanoi Cyclos (Xích Lô Hà Nội) parked near Opera Square edge
  for (let cy = 0; cy < 3; cy++) {
    const cx = 983.5;
    const cz = opZ - 16.5 + cy * 4.2;
    // Crimson passenger seat tub + cream sun hood + twin front wheels + rear driver frame/wheel
    crimsonPb.box(0.88, 0.44, 0.86, cx, opBaseY + 0.52, cz);
    whitePb.box(0.76, 0.56, 0.88, cx + 0.22, opBaseY + 0.98, cz, { rz: -0.25 });
    darkRoofPb.cyl(0.34, 0.34, 0.07, 6, cx - 0.12, opBaseY + 0.34, cz - 0.48, { rx: Math.PI * 0.5 });
    darkRoofPb.cyl(0.34, 0.34, 0.07, 6, cx - 0.12, opBaseY + 0.34, cz + 0.48, { rx: Math.PI * 0.5 });
    darkRoofPb.cyl(0.34, 0.34, 0.07, 6, cx + 1.05, opBaseY + 0.34, cz, { rx: Math.PI * 0.5 });
    darkRoofPb.box(1.15, 0.08, 0.12, cx + 0.52, opBaseY + 0.46, cz);
    darkWoodPb.box(0.24, 0.08, 0.22, cx + 0.92, opBaseY + 0.82, cz);
  }

  // Boulevard shade trees along North & South plaza margins (z = -268.2 and z = -211.8, >= 7.5m clear of Opera roofs!)
  for (const tz of [-268.2, -211.8]) {
    for (const tx of [968.0, 986.0, 1004.0]) {
      addTropicalTree(barkPb, vcFoliageAndTrainPb, tx, opBaseY, tz, 4.2, 2.35, ['#2b6d2e', '#38823b', '#48964a']);
    }
  }

  // --------------------------------------------------------------------------
  // B. CẦU LONG BIÊN LỊCH SỬ, SÔNG HỒNG & BÃI GIỮA ((1068, -240), z = -315..-165, 150m!)
  //    NB-166..220: 8 Cutwater Stone Piers, 9 Undulating Dragon-Spine Steel Spans,
  //                 Central Railway + Vintage Hanoi Train, Iron Stair to Bãi Giữa & 2 Boats
  // --------------------------------------------------------------------------
  const brX = 1068.0;
  const zNorth = -315.0;
  const zSouth = -165.0;
  const bridgeLen = zSouth - zNorth; // 150.0m!
  const numSpans = 9;
  const spanLen = bridgeLen / numSpans; // 16.6667m

  const riverMaxTerrain = sampleMaxTerrain(ctx, 1038, 1098, -322, -158, 5, 9);
  const riverWaterY = Math.max(riverMaxTerrain + 0.36, 2.05);
  const sandbarY = riverWaterY + 0.58;
  const deckY = riverWaterY + 7.20;

  // NB-166..170: Scenic Sông Hồng River Channel + Retaining Embankment Dikes (-5.5m skirt) + Bãi Giữa Sandbar
  const bankSkirt = 5.8;
  // Riverbed & West/East stone flood dikes so water is 100% framed with zero terrain leaks
  granitePb.box(62.0, bankSkirt, 166.0, brX, riverWaterY - 0.35 - bankSkirt * 0.5, -240.0);
  stonePb.box(3.8, 1.45, 166.0, 1038.5, riverWaterY + 0.25, -240.0);
  stonePb.box(3.8, 1.45, 166.0, 1097.5, riverWaterY + 0.25, -240.0);
  stonePb.box(62.0, 1.65, 6.0, brX, riverWaterY + 0.35, zNorth - 2.0);
  stonePb.box(62.0, 1.65, 6.0, brX, riverWaterY + 0.35, zSouth + 2.0);

  // Silty terracotta-rose Sông Hồng water surface (phù sa Sông Hồng)
  addColoredBox(vcRiverWaterPb, '#9c5d43', 55.6, 0.14, 152.0, brX, riverWaterY - 0.05, -240.0);
  // Subtle shimmering mid-channel current ribbons
  addColoredBox(vcRiverWaterPb, '#ad6d52', 12.0, 0.04, 148.0, 1051.5, riverWaterY + 0.02, -240.0);
  addColoredBox(vcRiverWaterPb, '#ad6d52', 12.0, 0.04, 148.0, 1084.5, riverWaterY + 0.02, -240.0);

  // Bãi Giữa Alluvial Sandbar Island (z = -256..-216, x = 1047..1089)
  sandPb.box(39.0, 0.68, 39.0, brX, riverWaterY + 0.24, -236.0);
  addColoredBox(vcFoliageAndTrainPb, '#448434', 34.0, 0.18, 34.0, brX, sandbarY + 0.04, -236.0);

  // NB-171..175: 2 Masonry Portal Abutments (i=0, 9) + 8 Massive Cutwater Stone Piers (i=1..8)
  //   Grounded -6.5m below riverWaterY (total pier height ~13.7m!)
  const pierDeepBottomY = riverWaterY - 6.5;
  const pierTotalH = deckY - pierDeepBottomY;
  const pierCenterY = pierDeepBottomY + pierTotalH * 0.5;

  for (let i = 0; i <= numSpans; i++) {
    const pz = zNorth + i * spanLen;
    if (i === 0 || i === numSpans) {
      const dir = i === 0 ? -1 : 1;
      // Portal abutment + sloped approach ramp down to embankment road
      stonePb.box(10.8, pierTotalH + 0.4, 5.2, brX, pierCenterY, pz + dir * 2.2);
      granitePb.box(11.4, 0.55, 5.6, brX, deckY - 0.18, pz + dir * 2.2);
      // Approach ramp (14m long) + deep skirt
      granitePb.box(9.4, pierTotalH, 14.0, brX, pierCenterY - 2.6, pz + dir * 11.4);
      for (let rs = 0; rs < 6; rs++) {
        const frac = (rs + 0.5) / 6;
        const ry = deckY * (1 - frac * 0.72) + riverWaterY * (frac * 0.72);
        stonePb.box(9.2, 0.48, 2.55, brX, ry, pz + dir * (4.8 + rs * 2.25));
      }
    } else {
      // Dressed ashlar masonry pier shaft + upstream (-X) & downstream (+X) pointed cutwaters!
      heroBridgeTrussPb.box(6.2, pierTotalH, 3.1, brX, pierCenterY, pz);
      // Upstream (-X) and downstream (+X) triangular/faceted cutwater prows
      stonePb.cyl(1.45, 1.75, pierTotalH - 0.5, 4, brX - 3.35, pierCenterY - 0.25, pz);
      stonePb.cyl(1.45, 1.75, pierTotalH - 0.5, 4, brX + 3.35, pierCenterY - 0.25, pz);
      // Stepped granite pier cap & steel rocker bearing pedestals
      granitePb.box(9.4, 0.58, 3.6, brX, deckY - 0.34, pz);
      darkRoofPb.box(0.75, 0.36, 0.95, brX - 2.35, deckY - 0.02, pz);
      darkRoofPb.box(0.75, 0.36, 0.95, brX + 2.35, deckY - 0.02, pz);
    }
  }

  // NB-176..195: 9 Iconic Cantilevered Steel Truss Spans (Undulating Dragon-Spine Silhouette!)
  //   54 panels (6 per span, panel length = 2.7778m). Every chord, vertical post, X-diagonal,
  //   and overhead tie-beam connects exact shared 3D nodes -> ZERO floating struts!
  const panelsPerSpan = 6;
  const totalPanels = numSpans * panelsPerSpan; // 54
  const panelDz = bridgeLen / totalPanels;
  const trussHalfW = 2.35;
  const xTrussW = brX - trussHalfW;
  const xTrussE = brX + trussHalfW;

  // Compute authentic Long Biên undulating dragon-spine top-chord height at panel node k = 0..54:
  //   High cantilevered peaks (6.35m) over odd piers i = 1, 3, 5, 7,
  //   secondary portal/anchor peaks (3.85m) at piers i = 0, 2, 4, 6, 8, 9,
  //   graceful catenary saddles (2.45m) across mid-spans!
  const topChordY: number[] = [];
  for (let k = 0; k <= totalPanels; k++) {
    const spanFloat = k / panelsPerSpan;
    const nearPier = Math.round(spanFloat);
    const distFromPier = Math.abs(spanFloat - nearPier); // 0 at pier .. 0.5 at mid-span
    const isHighCantileverPier = nearPier % 2 === 1; // piers 1, 3, 5, 7
    const pierPeakH = isHighCantileverPier ? 6.35 : 3.85;
    const saddleH = 2.45;
    // Smooth cosine/parabolic cantilever curve from pier peak down to mid-span saddle
    const curve = Math.pow(1.0 - distFromPier * 2.0, 1.45);
    const h = saddleH + (pierPeakH - saddleH) * curve;
    topChordY.push(deckY + h);
  }

  const botY = deckY + 0.14;
  for (let k = 0; k <= totalPanels; k++) {
    const zk = zNorth + k * panelDz;
    const ty = topChordY[k];

    const pBotW = new THREE.Vector3(xTrussW, botY, zk);
    const pTopW = new THREE.Vector3(xTrussW, ty, zk);
    const pBotE = new THREE.Vector3(xTrussE, botY, zk);
    const pTopE = new THREE.Vector3(xTrussE, ty, zk);

    // Vertical riveted truss posts (node-locked!)
    const isPierPost = k % panelsPerSpan === 0;
    const postR = isPierPost ? 0.16 : 0.10;
    heroBridgeTrussPb.strut(pBotW, pTopW, postR, postR, 4);
    heroBridgeTrussPb.strut(pBotE, pTopE, postR, postR, 4);

    // Under-deck transverse steel floor girder supporting central track + cantilevered walkways
    heroBridgeTrussPb.box(9.2, 0.24, 0.26, brX, deckY - 0.08, zk);

    // Overhead transverse top-chord tie-beams & corner gusset knee-braces (where clearance >= 4.2m above rail!)
    if (ty - deckY >= 4.35 && k % 2 === 0) {
      heroBridgeTrussPb.strut(pTopW, pTopE, 0.11, 0.11, 4);
      heroBridgeTrussPb.strut(
        new THREE.Vector3(xTrussW, ty - 0.68, zk),
        new THREE.Vector3(xTrussW + 0.78, ty, zk),
        0.065,
        0.065,
        4
      );
      heroBridgeTrussPb.strut(
        new THREE.Vector3(xTrussE, ty - 0.68, zk),
        new THREE.Vector3(xTrussE - 0.78, ty, zk),
        0.065,
        0.065,
        4
      );
    }

    if (k < totalPanels) {
      const zk1 = zNorth + (k + 1) * panelDz;
      const ty1 = topChordY[k + 1];

      const nBotW = new THREE.Vector3(xTrussW, botY, zk1);
      const nTopW = new THREE.Vector3(xTrussW, ty1, zk1);
      const nBotE = new THREE.Vector3(xTrussE, botY, zk1);
      const nTopE = new THREE.Vector3(xTrussE, ty1, zk1);

      // Top & bottom chords
      heroBridgeTrussPb.strut(pTopW, nTopW, 0.14, 0.14, 4);
      heroBridgeTrussPb.strut(pTopE, nTopE, 0.14, 0.14, 4);
      heroBridgeTrussPb.strut(pBotW, nBotW, 0.15, 0.15, 4);
      heroBridgeTrussPb.strut(pBotE, nBotE, 0.15, 0.15, 4);

      // Full double X-bracing diagonals in every panel (100% node-to-node!)
      heroBridgeTrussPb.strut(pBotW, nTopW, 0.072, 0.072, 4);
      heroBridgeTrussPb.strut(pTopW, nBotW, 0.072, 0.072, 4);
      heroBridgeTrussPb.strut(pBotE, nTopE, 0.072, 0.072, 4);
      heroBridgeTrussPb.strut(pTopE, nBotE, 0.072, 0.072, 4);
    }
  }

  // Entrance Portal Overhead Girder & "1899-1902 DAYDÉ & PILLÉ" Heritage Plaque (South & North Portals)
  for (const [pz, facing] of [
    [zSouth, 'south'] as const,
    [zNorth, 'north'] as const
  ]) {
    const pTop = deckY + 4.35;
    darkRoofPb.box(5.3, 0.92, 0.44, brX, pTop, pz);
    bronzePb.box(4.85, 0.68, 0.48, brX, pTop, pz);
    const zSign = facing === 'south' ? pz + 0.26 : pz - 0.26;
    add3DReliefInscription(
      goldPb,
      [
        { base: '1' },
        { base: '8' },
        { base: '9' },
        { base: '9' },
        { base: '-' },
        { base: '1' },
        { base: '9' },
        { base: '0' },
        { base: '2' },
        null,
        { base: 'D' },
        { base: 'A' },
        { base: 'Y' },
        { base: 'D' },
        { base: 'E', diacritic: 'acute' },
        null,
        { base: '&' },
        null,
        { base: 'P' },
        { base: 'I' },
        { base: 'L' },
        { base: 'L' },
        { base: 'E', diacritic: 'acute' }
      ],
      brX,
      pTop - 0.02,
      zSign,
      0.22,
      0.06,
      facing
    );
  }

  // NB-196..206: Central Wooden-Sleeper Railway Track + Vintage "Đầu Máy & Toa Tàu Hà Nội" Train
  const railTopY = deckY + 0.24;
  // Longitudinal steel stringers & twin steel rails
  darkRoofPb.box(0.18, 0.20, bridgeLen + 18.0, brX - 0.56, deckY + 0.04, -240.0);
  darkRoofPb.box(0.18, 0.20, bridgeLen + 18.0, brX + 0.56, deckY + 0.04, -240.0);
  granitePb.box(0.09, 0.12, bridgeLen + 18.0, brX - 0.56, railTopY - 0.04, -240.0);
  granitePb.box(0.09, 0.12, bridgeLen + 18.0, brX + 0.56, railTopY - 0.04, -240.0);
  // 96 dark-timber railway sleepers spaced cleanly along the 150m deck
  for (let sl = 0; sl < 96; sl++) {
    const sz = zNorth - 4.0 + (sl * (bridgeLen + 8.0)) / 95;
    darkWoodPb.box(2.25, 0.12, 0.26, brX, deckY + 0.13, sz);
  }

  // Vintage Green-and-Crimson "Đầu Máy & Toa Tàu Hà Nội" Train crossing mid-bridge (z = -255..-223)
  //   1) Diesel-Heritage Locomotive heading South (+Z) at z = -227.5
  const locoZ = -227.5;
  crimsonPb.box(2.55, 0.52, 8.8, brX, railTopY + 0.52, locoZ);
  crimsonPb.box(2.40, 0.36, 0.65, brX, railTopY + 0.28, locoZ + 4.55, { rx: 0.35 }); // cowcatcher
  addColoredBox(vcFoliageAndTrainPb, '#21583b', 2.42, 1.85, 5.6, brX, railTopY + 1.68, locoZ + 0.8);
  addColoredBox(vcFoliageAndTrainPb, '#21583b', 2.52, 2.15, 2.7, brX, railTopY + 1.84, locoZ - 2.85);
  whitePb.box(2.56, 0.22, 8.4, brX, railTopY + 1.24, locoZ);
  darkRoofPb.box(2.58, 0.24, 8.5, brX, railTopY + 2.88, locoZ - 0.2);
  darkRoofPb.cyl(0.22, 0.26, 0.55, 6, brX, railTopY + 3.18, locoZ + 1.8); // exhaust stack
  glowPb.cyl(0.24, 0.24, 0.18, 6, brX, railTopY + 2.05, locoZ + 3.65, { rx: Math.PI * 0.5 }); // headlamp
  glowPb.box(1.95, 0.62, 0.14, brX, railTopY + 2.18, locoZ - 1.48);
  goldPb.cyl(0.22, 0.22, 0.08, 5, brX, railTopY + 1.38, locoZ + 3.65, { rx: Math.PI * 0.5 }); // star badge

  //   2) Two Classic Hanoi-Saigon Passenger Coaches at z = -238.2 and z = -249.4
  for (const coachZ of [-238.2, -249.4]) {
    crimsonPb.box(2.56, 0.42, 9.8, brX, railTopY + 0.48, coachZ);
    addColoredBox(vcFoliageAndTrainPb, '#255e3e', 2.52, 2.05, 9.6, brX, railTopY + 1.70, coachZ);
    whitePb.box(2.56, 0.68, 9.4, brX, railTopY + 1.92, coachZ);
    crimsonPb.box(2.58, 0.14, 9.5, brX, railTopY + 1.48, coachZ);
    darkRoofPb.box(2.60, 0.28, 9.8, brX, railTopY + 2.84, coachZ);
    darkRoofPb.box(1.35, 0.20, 8.2, brX, railTopY + 3.04, coachZ); // clerestory roof vent
    darkRoofPb.box(1.65, 1.85, 0.95, brX, railTopY + 1.65, coachZ + 5.15); // inter-car bellows gangway
    for (let w = -3; w <= 3; w++) {
      glowPb.box(2.60, 0.54, 0.88, brX, railTopY + 1.94, coachZ + w * 1.24);
    }
  }
  // Steel bogie wheelsets under locomotive & both coaches resting flush on railTopY
  for (const wz of [-224.8, -230.2, -235.0, -241.4, -246.2, -252.6]) {
    for (const ax of [-0.65, 0.65]) {
      for (const side of [-0.56, 0.56]) {
        darkRoofPb.cyl(0.38, 0.38, 0.12, 6, brX + side, railTopY + 0.38, wz + ax, { rz: Math.PI * 0.5 });
      }
    }
  }

  // NB-207..212: Flanking Cantilever Motorbike/Pedestrian Walkways + Iron Railings + Bridge Lamps
  for (const side of [-1, 1]) {
    const walkX = brX + side * 3.55;
    const railOuterX = brX + side * 4.42;
    stonePb.box(1.68, 0.16, bridgeLen + 16.0, walkX, deckY + 0.08, -240.0);
    // Continuous outer iron handrails
    darkRoofPb.box(0.08, 0.08, bridgeLen + 16.0, railOuterX, deckY + 1.12, -240.0);
    darkRoofPb.box(0.06, 0.06, bridgeLen + 16.0, railOuterX, deckY + 0.62, -240.0);
    for (let rp = 0; rp <= 30; rp++) {
      const rz = zNorth - 4.0 + (rp * (bridgeLen + 8.0)) / 30;
      // Leave clean opening on West walkway at z = -236 for stair down to Bãi Giữa
      if (side === -1 && Math.abs(rz - (-236.0)) < 2.2) continue;
      darkRoofPb.box(0.08, 1.12, 0.08, railOuterX, deckY + 0.56, rz);
      if (rp % 5 === 0) {
        darkRoofPb.cyl(0.05, 0.07, 2.65, 4, railOuterX, deckY + 1.95, rz);
        glowPb.sphere(0.17, 5, 3, railOuterX - side * 0.25, deckY + 3.28, rz);
      }
    }
  }
  // Vintage motorbikes crossing East/West cantilever lanes
  for (const [mx, mz, col] of [
    [brX - 3.55, -206.0, '#b52828'],
    [brX - 3.55, -268.0, '#275778'],
    [brX + 3.55, -220.0, '#2c6b45'],
    [brX + 3.55, -282.0, '#c28b29']
  ] as const) {
    addColoredBox(vcFoliageAndTrainPb, col, 0.44, 0.48, 1.35, mx, deckY + 0.54, mz);
    darkRoofPb.cyl(0.26, 0.26, 0.09, 5, mx, deckY + 0.42, mz - 0.48, { rz: Math.PI * 0.5 });
    darkRoofPb.cyl(0.26, 0.26, 0.09, 5, mx, deckY + 0.42, mz + 0.48, { rz: Math.PI * 0.5 });
  }

  // NB-213..216: Historic Iron Stepped Stairway descending from West Walkway to Bãi Giữa Sandbar
  const stairX = brX - 5.15;
  const stairZ0 = -236.0;
  const stairDrop = deckY - sandbarY; // ~6.62m
  const midLandingY = sandbarY + stairDrop * 0.5;
  // Grounded stone footing pad + steel support columns (-1.8m embed into sandbar!)
  stonePb.box(2.6, 1.9, 3.2, stairX, sandbarY - 0.80, stairZ0 + 6.8);
  darkRoofPb.box(1.5, 0.16, 1.8, stairX + 0.45, deckY + 0.08, stairZ0);
  darkRoofPb.box(1.8, 0.16, 2.2, stairX, midLandingY, stairZ0 + 3.8);
  darkRoofPb.cyl(0.11, 0.13, (midLandingY - sandbarY) + 1.8, 4, stairX - 0.72, sandbarY - 0.9 + (midLandingY - sandbarY + 1.8) * 0.5, stairZ0 + 3.8);
  darkRoofPb.cyl(0.11, 0.13, (midLandingY - sandbarY) + 1.8, 4, stairX + 0.72, sandbarY - 0.9 + (midLandingY - sandbarY + 1.8) * 0.5, stairZ0 + 3.8);
  // Flight 1 (deckY -> midLandingY) & Flight 2 (midLandingY -> sandbarY) + iron handrails
  for (let s = 0; s < 10; s++) {
    const t = (s + 0.5) / 10;
    darkRoofPb.box(1.25, 0.09, 0.34, stairX, deckY - t * (stairDrop * 0.5), stairZ0 + 0.5 + t * 3.0);
    darkRoofPb.box(1.25, 0.09, 0.34, stairX, midLandingY - t * (stairDrop * 0.5), stairZ0 + 4.3 + t * 2.8);
  }
  for (const rxOff of [-0.62, 0.62]) {
    darkRoofPb.strut(
      new THREE.Vector3(stairX + rxOff, deckY + 0.95, stairZ0 + 0.4),
      new THREE.Vector3(stairX + rxOff, midLandingY + 0.95, stairZ0 + 3.6),
      0.045,
      0.045,
      4
    );
    darkRoofPb.strut(
      new THREE.Vector3(stairX + rxOff, midLandingY + 0.95, stairZ0 + 4.2),
      new THREE.Vector3(stairX + rxOff, sandbarY + 0.95, stairZ0 + 7.2),
      0.045,
      0.045,
      4
    );
  }

  // NB-217..218: Bãi Giữa Alluvial Banana & Corn Garden (kept outside bridge corridor & <= 3.1m tall!)
  //   West banana grove (x = 1051..1059) & East sweet-corn garden + bamboo watch-hut (x = 1076..1085)
  for (let bp = 0; bp < 8; bp++) {
    const bx = 1051.5 + (bp % 2) * 4.6;
    const bz = -249.0 + Math.floor(bp / 2) * 8.2;
    barkPb.cyl(0.11, 0.16, 2.25, 5, bx, sandbarY + 1.0, bz);
    for (let lf = 0; lf < 4; lf++) {
      const ang = (lf / 4) * Math.PI * 2 + bp * 0.4;
      addColoredBox(
        vcFoliageAndTrainPb,
        lf % 2 === 0 ? '#4ca136' : '#5cb342',
        1.55,
        0.06,
        0.46,
        bx + Math.cos(ang) * 0.78,
        sandbarY + 2.15,
        bz + Math.sin(ang) * 0.78,
        -ang,
        0,
        -0.32
      );
    }
  }
  // Sweet-corn rows & thatched farmer's watch-hut on East half of Bãi Giữa
  for (let row = 0; row < 4; row++) {
    const rx = 1076.5 + row * 2.2;
    addColoredBox(vcFoliageAndTrainPb, '#529c38', 0.55, 1.35, 18.0, rx, sandbarY + 0.68, -238.0);
    addColoredBox(vcFoliageAndTrainPb, '#dec252', 0.24, 0.22, 17.4, rx, sandbarY + 1.42, -238.0);
  }
  darkWoodPb.box(2.6, 2.0, 2.6, 1081.5, sandbarY + 1.0, -223.0);
  sandPb.add(createGableRoofGeometry(3.3, 3.3, 1.05, 0.16, 'x').translate(1081.5, sandbarY + 1.96, -223.0));

  // NB-219..220: 2 Moored Red River Wooden Boats (Thuyền Gỗ Sông Hồng)
  for (const [bx, bz, yaw] of [
    [1052.5, -274.0, 0.18] as const,
    [1082.5, -196.0, -0.22] as const
  ]) {
    const hullY = riverWaterY + 0.18;
    darkWoodPb.box(2.15, 0.56, 8.6, bx, hullY, bz, { ry: yaw });
    darkWoodPb.cone(1.08, 2.2, 4, bx + Math.sin(yaw) * 5.1, hullY + 0.12, bz + Math.cos(yaw) * 5.1, {
      rx: Math.PI * 0.5,
      ry: yaw
    });
    darkWoodPb.cone(0.98, 1.9, 4, bx - Math.sin(yaw) * 4.9, hullY + 0.12, bz - Math.cos(yaw) * 4.9, {
      rx: -Math.PI * 0.5,
      ry: yaw
    });
    // Woven bamboo sampan arched cabin canopy + wooden sweep oar + glowing stern lantern + mooring post
    sandPb.cyl(1.02, 1.02, 3.4, 6, bx, hullY + 0.62, bz, { rx: Math.PI * 0.5, ry: yaw });
    darkWoodPb.box(0.12, 0.08, 4.2, bx + 0.95, hullY + 0.44, bz - 2.4, { ry: yaw + 0.24 });
    silkPb.sphere(0.18, 5, 3, bx, hullY + 1.15, bz + 2.8);
    darkWoodPb.cyl(0.08, 0.10, 2.2, 4, bx + 2.4, riverWaterY + 0.4, bz + 2.6);
  }

  // Finalize HanoiOperaLongBienComplex merged meshes (ONLY 2 hero meshes have castShadow = true!)
  const matVcSolid = getSharedVertexColorMat(
    ctx,
    0.75,
    0.0,
    ctx.materials.jadeRoof ?? ctx.materials.stone
  );
  const matVcRiver = getSharedVertexColorMat(
    ctx,
    0.30,
    0.15,
    ctx.materials.bronzePatina ?? ctx.materials.granite
  );

  finalizeAndAddMesh(
    group,
    heroOperaPb,
    'HanoiOperaHeroFacade',
    ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster,
    true,
    true,
    2.6
  );
  finalizeAndAddMesh(
    group,
    heroBridgeTrussPb,
    'LongBienBridgeHeroTruss',
    ctx.materials.granite,
    true,
    true,
    2.4
  );

  finalizeAndAddMesh(group, whitePb, 'OperaAndBridgeWhiteStonework', ctx.materials.whitePlaster, false, true, 2.4);
  finalizeAndAddMesh(
    group,
    ochrePb,
    'OperaPedimentOchreTrim',
    ctx.materials.yellowOchrePlaster,
    false,
    true,
    2.4
  );
  finalizeAndAddMesh(group, stonePb, 'OperaParvisAndLongBienMasonry', ctx.materials.stone, false, true, 2.8);
  finalizeAndAddMesh(group, granitePb, 'OperaPlazaAndRailFoundations', ctx.materials.granite, false, true, 3.2);
  finalizeAndAddMesh(group, darkRoofPb, 'OperaMansardDomesAndIronwork', ctx.materials.darkRoof, false, true, 2.2);
  finalizeAndAddMesh(group, crimsonPb, 'LongBienTrainAndCycloCrimson', ctx.materials.crimsonLacquer, false, true, 2.0);
  finalizeAndAddMesh(
    group,
    darkWoodPb,
    'LongBienSleepersAndRiverBoats',
    ctx.materials.darkWood,
    false,
    true,
    1.8
  );
  finalizeAndAddMesh(
    group,
    sandPb,
    'BaiGiuaSandbarAndSampanMats',
    ctx.materials.bambooWeave ?? ctx.materials.ochreSand ?? ctx.materials.stone,
    false,
    true,
    2.6
  );
  finalizeAndAddMesh(group, goldPb, 'OperaGildedFinialsAndPlaques', ctx.materials.gold, false, false);
  finalizeAndAddMesh(group, bronzePb, 'OperaCandelabraAndPortalPlaques', ctx.materials.bronze, false, true);
  finalizeAndAddMesh(group, barkPb, 'OperaAndBaiGiuaTreeTrunks', ctx.materials.bark, false, true, 1.5);
  finalizeAndAddMesh(group, voidPb, 'OperaLoggiaShadowRecesses', ctx.materials.darkVoid, false, false);
  finalizeAndAddMesh(
    group,
    glowPb,
    'OperaFoyerAndTrainWarmGlow',
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    false,
    false
  );
  finalizeAndAddMesh(group, silkPb, 'RedRiverBoatLanterns', ctx.materials.lanternSilk, false, false);
  finalizeAndAddMesh(group, vcFoliageAndTrainPb, 'OperaShuttersTrainAndBaiGiuaFoliage', matVcSolid, false, true);
  finalizeAndAddMesh(group, vcRiverWaterPb, 'SongHongRiverAndFountainWater', matVcRiver, false, true);

  tagMotifIds(group, ['HV-A06', 'HV-D10', 'HV-I01', 'NB-111', 'NB-165', 'NB-195', 'NB-220']);
  ctx.scene.add(group);
  return group;
}

/**
 * Builds and mounts both Thủ Đô Hà Nội landmark complexes (`BaDinhMausoleumComplex` and
 * `HanoiOperaLongBienComplex`) directly onto `ctx.scene`.
 */
export function buildHanoiCapitalTrioLandmarks(
  ctx: VietnamBuilderContext
): HanoiCapitalTrioBuildResult {
  const flagUniforms: FlagUniformEntry[] = [];

  buildBaDinhMausoleumComplex(ctx, flagUniforms);
  buildHanoiOperaLongBienComplex(ctx, flagUniforms);

  return { flagUniforms };
}
