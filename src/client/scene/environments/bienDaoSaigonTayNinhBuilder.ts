import * as THREE from 'three';
import {
  VietnamBuilderContext,
  JunkBoatMotion,
  applyWorldBoxUV,
  createHueImperialHipRoofGeometry,
  createSculptedRockGeometry,
  createVietnameseCurvedRoofGeometry,
  createWavingSilkFlagMaterial,
  mulberry32
} from './vietnamGeometryHelpers';
import {
  createRoofFinialSetParts,
  createSculptedDeityParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  PartsBuilder,
  createMergedMesh,
  registerAnimatedUniform,
  transformGeometryXYZ
} from '../vietnam/geometry/PartsBuilder';

const VIETNAM_WATER_LEVEL = 0.0;

export interface BienDaoSaigonTayNinhBuildResult {
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
  southernBoats: JunkBoatMotion[];
}

interface BuildingFootprint {
  x: number;
  z: number;
  r: number;
}

/**
 * Obtains a shared waving Cờ Tổ Quốc (or solid silk flag) ShaderMaterial with ZERO MeshStandardMaterial allocations.
 */
function getSharedWavingFlagMaterial(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  options?: { waveScale?: number; color?: THREE.ColorRepresentation; showStar?: boolean }
): THREE.ShaderMaterial {
  const normalizedOpts = {
    waveScale: (options?.waveScale ?? 1.0) >= 0.75 ? 1.0 : 0.5,
    color: options?.color ?? '#d91619',
    showStar: options?.showStar ?? true
  };
  if (ctx.sharedShaders) {
    const shared = ctx.sharedShaders.getWavingFlag(normalizedOpts);
    if (!flagUniforms.includes(shared.uniforms)) {
      flagUniforms.push(shared.uniforms);
    }
    return shared.material;
  }
  const created = createWavingSilkFlagMaterial(normalizedOpts);
  ctx.extraMaterials.push(created.material);
  registerAnimatedUniform(ctx.animatedUniforms, flagUniforms, created.uniforms, true);
  return created.material;
}

/**
 * Adds a waving silk flag mesh pinned cleanly at its hoist edge (x = 0 in local space) against a flagpole.
 */
function addWavingFlagMesh(
  parent: THREE.Object3D,
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  name: string,
  poleX: number,
  topY: number,
  poleZ: number,
  width: number,
  height: number,
  yaw = 0,
  waveScale = 1.0,
  showStar = true
): void {
  const geo = new THREE.PlaneGeometry(width, height, 8, 4);
  geo.translate(width * 0.5 + 0.04, -height * 0.5, 0);
  geo.computeBoundingSphere();
  const mat = getSharedWavingFlagMaterial(ctx, flagUniforms, {
    waveScale,
    color: '#d91619',
    showStar
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(poleX, topY, poleZ);
  mesh.rotation.y = yaw;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
}

/**
 * Finalizes a PartsBuilder into a named THREE.Mesh with optional world-box UV projection and finite-bounds verification.
 */
function commitPartsMesh(
  parent: THREE.Object3D,
  builder: PartsBuilder,
  name: string,
  material: THREE.Material,
  castShadow = false,
  receiveShadow = true,
  worldUvMeters = 0
): THREE.Mesh | null {
  if (builder.length === 0) return null;
  const geo = builder.buildGeometry();
  if (!geo) return null;
  if (worldUvMeters > 0) {
    applyWorldBoxUV(geo, worldUvMeters);
  }
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

/**
 * Creates a sculpted coral-sand island & submerged seabed slope rising from `seabedY` up to `crownY`.
 */
function createSculptedCoralIslandGeometry(
  rx: number,
  rz: number,
  seabedY: number,
  crownY: number,
  seed: number,
  radialSegs = 20
): THREE.BufferGeometry {
  const totalH = crownY - seabedY;
  const geo = new THREE.CylinderGeometry(1.0, 1.38, totalH, radialSegs, 3, false);
  geo.translate(0, seabedY + totalH * 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const rNorm = Math.hypot(px, pz);
    const tY = THREE.MathUtils.clamp((py - seabedY) / Math.max(0.1, totalH), 0, 1);
    if (rNorm > 0.001) {
      const ang = Math.atan2(pz, px);
      const organic =
        1.0 +
        0.11 * Math.sin(ang * 3.0 + seed) +
        0.07 * Math.cos(ang * 5.0 - seed * 1.7) +
        0.04 * Math.sin(ang * 7.0 + seed * 0.8);
      const profileScale = THREE.MathUtils.lerp(1.04, 0.88, Math.pow(tY, 1.4));
      pos.setX(i, px * rx * organic * profileScale);
      pos.setZ(i, pz * rz * organic * profileScale);
    } else {
      pos.setX(i, 0);
      pos.setZ(i, 0);
    }
    if (tY > 0.96) {
      pos.setY(i, crownY);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Adds a wind-sculpted coastal *Cây Phong Ba* or *Cây Bàng Vuông* tree only if clear of all building footprints.
 */
function addCoastalIslandTree(
  barkBuilder: PartsBuilder,
  leafBuilder: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale: number,
  seed: number,
  buildings: BuildingFootprint[],
  minClearance = 5.5
): boolean {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (Math.hypot(x - b.x, z - b.z) < b.r + minClearance) {
      return false;
    }
  }
  const rand = mulberry32(seed);
  const trunkH = (2.6 + rand() * 1.1) * scale;
  const leanX = (rand() - 0.5) * 0.55 * scale;
  const leanZ = (rand() - 0.5) * 0.55 * scale;

  const pBase = new THREE.Vector3(x, y - 0.35, z);
  const pMid = new THREE.Vector3(x + leanX * 0.5, y + trunkH * 0.55, z + leanZ * 0.5);
  const pTop = new THREE.Vector3(x + leanX, y + trunkH, z + leanZ);
  barkBuilder.strut(pBase, pMid, 0.16 * scale, 0.25 * scale, 5);
  barkBuilder.strut(pMid, pTop, 0.11 * scale, 0.16 * scale, 5);

  // Broad-leaf tiered coastal bàng vuông / phong ba canopy pads
  leafBuilder.sphere(1.25 * scale, 6, 4, pTop.x, pTop.y + 0.35 * scale, pTop.z, [1.28, 0.56, 1.22]);
  for (let b = 0; b < 3; b++) {
    const ba = (b / 3) * Math.PI * 2 + rand() * 0.8;
    const bx = pMid.x + Math.cos(ba) * 0.95 * scale;
    const bz = pMid.z + Math.sin(ba) * 0.95 * scale;
    const by = pMid.y + (0.45 + (b % 2) * 0.25) * scale;
    barkBuilder.strut(pMid, new THREE.Vector3(bx, by, bz), 0.06 * scale, 0.10 * scale, 4);
    leafBuilder.sphere(0.88 * scale, 6, 4, bx, by + 0.18 * scale, bz, [1.2, 0.52, 1.15]);
  }
  return true;
}

/**
 * Appends a tapered curved wooden Ghe Bầu (traditional Hoàng Sa / fishing boat) hull + cabin + mast.
 */
function appendGheBauBoatParts(
  woodParts: PartsBuilder,
  ochreParts: PartsBuilder,
  whiteParts: PartsBuilder,
  voidParts: PartsBuilder,
  cx: number,
  waterY: number,
  cz: number,
  yaw: number,
  length = 10.4,
  beam = 2.85,
  withSail = true
): { mastTopX: number; mastTopY: number; mastTopZ: number } {
  const hull = new THREE.BoxGeometry(beam, 1.25, length, 4, 2, 8);
  const hp = hull.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i);
    let y = hp.getY(i);
    const z = hp.getZ(i);
    const tz = z / (length * 0.5); // -1 stern .. +1 bow
    const ty = (y + 0.625) / 1.25; // 0 keel .. 1 gunwale
    const planTaper =
      tz > 0
        ? Math.pow(Math.max(0.08, 1.0 - Math.pow(tz, 1.65)), 0.58)
        : 0.72 + 0.28 * (1.0 + tz);
    const keelFlare = 0.46 + 0.54 * ty;
    const sheer = 0.48 * Math.pow(Math.abs(tz), 2.15) + (tz > 0 ? 0.28 * tz * tz : 0.10 * tz * tz);
    x *= planTaper * keelFlare;
    y += sheer;
    hp.setXYZ(i, x, y, z);
  }
  hull.computeVertexNormals();
  transformGeometryXYZ(hull, cx, waterY + 0.18, cz, yaw);
  woodParts.add(hull);

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const toWorld = (lx: number, ly: number, lz: number): [number, number, number] => [
    cx + lx * cosY + lz * sinY,
    waterY + ly,
    cz - lx * sinY + lz * cosY
  ];

  // Curved woven-bamboo / ochre deck shelter (*mui bầu*)
  const [cabX, cabY, cabZ] = toWorld(0, 0.95, -length * 0.08);
  ochreParts.cyl(beam * 0.36, beam * 0.38, length * 0.34, 6, cabX, cabY, cabZ, {
    rx: Math.PI * 0.5,
    ry: yaw
  });
  const [deckX, deckY, deckZ] = toWorld(0, 0.58, 0);
  woodParts.box(beam * 0.76, 0.12, length * 0.78, deckX, deckY, deckZ, { ry: yaw });

  // Painted traditional boat eyes (*mắt thuyền*) near upturned bow
  for (const sx of [-1, 1]) {
    const [ex, ey, ez] = toWorld(sx * beam * 0.24, 0.78, length * 0.36);
    whiteParts.box(0.10, 0.20, 0.38, ex, ey, ez, { ry: yaw + sx * 0.22 });
    const [px, py, pz] = toWorld(sx * (beam * 0.24 + 0.03), 0.78, length * 0.38);
    voidParts.box(0.08, 0.12, 0.16, px, py, pz, { ry: yaw + sx * 0.22 });
  }

  // Central wooden mast & battened lugsail yard
  const mastH = length * 0.68;
  const [mx, my, mz] = toWorld(0, 0.55 + mastH * 0.5, length * 0.10);
  woodParts.cyl(0.06, 0.10, mastH, 5, mx, my, mz);

  if (withSail) {
    const [sx, sy, sz] = toWorld(0.12, 0.55 + mastH * 0.56, length * 0.02);
    ochreParts.box(0.08, mastH * 0.58, length * 0.32, sx, sy, sz, { ry: yaw + 0.18 });
    for (let b = 0; b < 4; b++) {
      const [bx, by, bz] = toWorld(0.13, 0.55 + mastH * (0.32 + b * 0.16), length * 0.02);
      woodParts.box(0.11, 0.05, length * 0.34, bx, by, bz, { ry: yaw + 0.18 });
    }
  }

  const [topX, topY, topZ] = toWorld(0, 0.55 + mastH, length * 0.10);
  return { mastTopX: topX, mastTopY: topY, mastTopZ: topZ };
}

// ============================================================================
// 1. QUẦN ĐẢO HOÀNG SA (`HoangSaArchipelagoGroup`) centered at (1060, 160)
// ============================================================================
function buildHoangSaArchipelagoGroup(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  southernBoats: JunkBoatMotion[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HoangSaArchipelagoGroup';

  const cx = 1060.0;
  const cz = 160.0;
  const crownY = VIETNAM_WATER_LEVEL + 2.2;

  const reefMarble = new PartsBuilder();
  const sandParts = new PartsBuilder();
  const turfJade = new PartsBuilder();
  const graniteParts = new PartsBuilder();
  const stoneParts = new PartsBuilder();
  const whiteParts = new PartsBuilder();
  const lighthouseCoreShadow = new PartsBuilder();
  const ochreParts = new PartsBuilder();
  const crimsonParts = new PartsBuilder();
  const roofParts = new PartsBuilder();
  const goldParts = new PartsBuilder();
  const bronzeParts = new PartsBuilder();
  const woodParts = new PartsBuilder();
  const barkParts = new PartsBuilder();
  const glowParts = new PartsBuilder();
  const voidParts = new PartsBuilder();

  const buildings: BuildingFootprint[] = [];

  // 1A. Submerged coral reef shelf (-3.6m seabed to +0.16m white-foam reef rim) & coral-sand island (+2.2m)
  const reefGeo = createSculptedCoralIslandGeometry(50.0, 42.0, -3.6, 0.14, 19.3, 20);
  reefGeo.translate(cx, 0, cz);
  reefMarble.add(reefGeo);

  // Outer coral breaker ledges & reef rocks around perimeter
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.25;
    const rx = cx + Math.cos(a) * 43.0;
    const rz = cz + Math.sin(a) * 36.0;
    reefMarble.cyl(3.8, 5.2, 0.45, 6, rx, -0.04, rz);
    const coralCrag = createSculptedRockGeometry(310 + i * 7, 2.2, 0.85, 1.8, 1);
    coralCrag.translate(rx * 0.998 + (cx - rx) * 0.08, 0.15, rz * 0.998 + (cz - rz) * 0.08);
    stoneParts.add(coralCrag);
  }

  const islandGeo = createSculptedCoralIslandGeometry(34.0, 28.0, -3.5, crownY, 7.4, 20);
  islandGeo.translate(cx, 0, cz);
  sandParts.add(islandGeo);

  // Lush coastal green turf cap over central island plateau
  const turfGeo = createSculptedCoralIslandGeometry(25.5, 20.5, crownY - 0.35, crownY + 0.06, 7.4, 16);
  turfGeo.translate(cx, 0, cz);
  turfJade.add(turfGeo);

  // 1B. Cột Mốc Chủ Quyền Quần Đảo Hoàng Sa at (1057, 157)
  const cmX = 1057.0;
  const cmZ = 157.0;
  buildings.push({ x: cmX, z: cmZ, r: 6.5 });

  // Paved granite ceremonial courtyard & 3-tier stepped granite pedestal (embedded -0.8m into island)
  graniteParts.box(12.0, 1.0, 12.0, cmX, crownY - 0.36, cmZ);
  graniteParts.box(5.6, 0.55, 5.6, cmX, crownY + 0.28, cmZ);
  graniteParts.box(4.0, 0.48, 4.0, cmX, crownY + 0.78, cmZ);
  crimsonParts.box(4.15, 0.12, 4.15, cmX, crownY + 1.04, cmZ);
  graniteParts.box(2.7, 0.45, 2.7, cmX, crownY + 1.28, cmZ);
  // Ceremonial front approach steps & 4 corner granite bollards with crimson-gold perimeter rails
  for (let st = 0; st < 3; st++) {
    graniteParts.box(2.4, 0.22, 0.48, cmX, crownY + 0.12 + st * 0.22, cmZ + 3.05 - st * 0.36);
  }
  for (const sx of [-5.2, 5.2]) {
    for (const sz of [-5.2, 5.2]) {
      graniteParts.cyl(0.22, 0.28, 1.15, 6, cmX + sx, crownY + 0.65, cmZ + sz);
      goldParts.sphere(0.16, 5, 4, cmX + sx, crownY + 1.28, cmZ + sz);
    }
  }
  crimsonParts.box(10.2, 0.10, 0.10, cmX, crownY + 0.92, cmZ - 5.2);
  crimsonParts.box(0.10, 0.10, 10.2, cmX - 5.2, crownY + 0.92, cmZ);
  crimsonParts.box(0.10, 0.10, 10.2, cmX + 5.2, crownY + 0.92, cmZ);

  // Tapered granite sovereignty obelisk shaft + molded collar + pyramidal apex
  const obBaseY = crownY + 1.50;
  const obH = 6.2;
  graniteParts.cyl(0.68, 1.02, obH, 4, cmX, obBaseY + obH * 0.5, cmZ, { ry: Math.PI * 0.25 });
  goldParts.cyl(0.76, 0.78, 0.16, 4, cmX, obBaseY + obH - 0.08, cmZ, { ry: Math.PI * 0.25 });
  graniteParts.cone(0.72, 1.15, 4, cmX, obBaseY + obH + 0.57, cmZ, { ry: Math.PI * 0.25 });

  // Gold Star / Coat-of-Arms relief medallion & inscribed bronze sovereignty plaque on all 4 faces
  for (let f = 0; f < 4; f++) {
    const rot = (f * Math.PI) / 2;
    const fx = cmX + Math.sin(rot) * 0.62;
    const fz = cmZ + Math.cos(rot) * 0.62;
    crimsonParts.cyl(0.42, 0.42, 0.10, 8, fx, obBaseY + 4.35, fz, { rx: Math.PI * 0.5, ry: rot });
    goldParts.cyl(0.46, 0.46, 0.07, 8, fx, obBaseY + 4.35, fz, { rx: Math.PI * 0.5, ry: rot });
    // 5-pointed gold star boss
    for (let s = 0; s < 5; s++) {
      const sa = (s / 5) * Math.PI * 2;
      goldParts.cone(
        0.09,
        0.26,
        4,
        fx + Math.cos(rot) * Math.sin(sa) * 0.11 + Math.sin(rot) * 0.06,
        obBaseY + 4.35 + Math.cos(sa) * 0.11,
        fz - Math.sin(rot) * Math.sin(sa) * 0.11 + Math.cos(rot) * 0.06,
        { ry: rot, rz: -sa }
      );
    }
    const px = cmX + Math.sin(rot) * 0.68;
    const pz = cmZ + Math.cos(rot) * 0.68;
    bronzeParts.box(1.02, 1.38, 0.10, px, obBaseY + 2.25, pz, { ry: rot });
    goldParts.box(0.84, 0.10, 0.13, px, obBaseY + 2.68, pz, { ry: rot });
    goldParts.box(0.76, 0.08, 0.13, px, obBaseY + 2.38, pz, { ry: rot });
    goldParts.box(0.72, 0.08, 0.13, px, obBaseY + 2.08, pz, { ry: rot });
  }

  // Towering island flagpole + waving Cờ Tổ Quốc beside sovereignty monument
  const fpX = 1062.5;
  const fpZ = 156.5;
  graniteParts.cyl(0.72, 0.92, 0.85, 8, fpX, crownY + 0.25, fpZ);
  whiteParts.cyl(0.09, 0.20, 14.5, 6, fpX, crownY + 7.8, fpZ);
  goldParts.sphere(0.18, 6, 4, fpX, crownY + 15.15, fpZ);
  addWavingFlagMesh(group, ctx, flagUniforms, 'HoangSaNationalFlag', fpX, crownY + 14.95, fpZ, 3.6, 2.4, 0.25, 1.15, true);

  // 1C. Tall Hải Đăng Hoàng Sa (22.5m Lighthouse + Lantern Dome, castShadow = true on shaft) at (1071, 148)
  const lhX = 1071.0;
  const lhZ = 148.0;
  buildings.push({ x: lhX, z: lhZ, r: 5.8 });

  graniteParts.cyl(3.2, 3.8, 2.4, 8, lhX, crownY + 0.4, lhZ);
  lighthouseCoreShadow.cyl(1.55, 2.45, 17.6, 8, lhX, crownY + 10.2, lhZ);
  // Keeper's entry porch, steps & terracotta awning at lighthouse base (+Z)
  whiteParts.box(2.1, 2.6, 1.4, lhX, crownY + 2.4, lhZ + 2.55);
  voidParts.box(1.1, 1.9, 0.28, lhX, crownY + 2.15, lhZ + 3.22);
  roofParts.box(2.4, 0.26, 1.75, lhX, crownY + 3.78, lhZ + 2.65, { rx: 0.24 });
  graniteParts.box(1.6, 0.32, 0.85, lhX, crownY + 1.12, lhZ + 3.45);
  // Crisp horizontal ochre/crimson warning bands & framed recessed window slits on both faces
  crimsonParts.cyl(1.76, 1.84, 2.2, 8, lhX, crownY + 15.8, lhZ);
  ochreParts.cyl(2.18, 2.28, 1.8, 8, lhX, crownY + 6.2, lhZ);
  for (const wy of [5.0, 9.5, 14.0]) {
    const rAtY = THREE.MathUtils.lerp(2.38, 1.68, (wy - 2.0) / 17.0);
    for (const sz of [-1, 1]) {
      whiteParts.box(0.68, 1.32, 0.16, lhX, crownY + wy, lhZ + sz * (rAtY - 0.04));
      voidParts.box(0.45, 1.10, 0.24, lhX, crownY + wy, lhZ + sz * rAtY);
    }
  }
  // Observation gallery deck, 8 corbel brackets, railing, Fresnel optics & cupola dome
  const galY = crownY + 19.0;
  whiteParts.cyl(2.45, 1.75, 0.55, 8, lhX, galY, lhZ);
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    graniteParts.cyl(0.04, 0.04, 1.05, 4, lhX + Math.cos(a) * 2.25, galY + 0.78, lhZ + Math.sin(a) * 2.25);
    whiteParts.strut(
      new THREE.Vector3(lhX + Math.cos(a) * 1.52, galY - 0.85, lhZ + Math.sin(a) * 1.52),
      new THREE.Vector3(lhX + Math.cos(a) * 2.30, galY - 0.08, lhZ + Math.sin(a) * 2.30),
      0.08,
      0.08,
      4
    );
  }
  graniteParts.cyl(2.28, 2.28, 0.07, 8, lhX, galY + 1.28, lhZ);
  glowParts.cyl(1.18, 1.18, 2.35, 8, lhX, galY + 1.42, lhZ);
  // Brass Fresnel lens rings & lantern room vertical mullions
  goldParts.cyl(1.22, 1.22, 0.08, 8, lhX, galY + 1.05, lhZ);
  goldParts.cyl(1.22, 1.22, 0.08, 8, lhX, galY + 1.80, lhZ);
  for (let m = 0; m < 6; m++) {
    const ma = (m / 6) * Math.PI * 2;
    graniteParts.cyl(0.05, 0.05, 2.45, 4, lhX + Math.cos(ma) * 1.24, galY + 1.42, lhZ + Math.sin(ma) * 1.24);
  }
  crimsonParts.sphere(1.36, 8, 5, lhX, galY + 2.60, lhZ, [1.0, 0.78, 1.0]);
  goldParts.sphere(0.32, 6, 4, lhX, galY + 3.65, lhZ);
  goldParts.cyl(0.04, 0.07, 1.45, 4, lhX, galY + 4.45, lhZ);
  glowParts.sphere(0.16, 6, 4, lhX, galY + 5.20, lhZ);

  // 1D. Historic 1938 French-Era Yellow Trạm Khí Tượng Hoàng Sa at (1044, 152)
  const metX = 1044.0;
  const metZ = 152.0;
  buildings.push({ x: metX, z: metZ, r: 7.8 });

  stoneParts.box(11.6, 1.6, 8.4, metX, crownY - 0.15, metZ);
  ochreParts.box(10.6, 6.6, 7.4, metX, crownY + 3.9, metZ);
  // White colonial corner pilasters, belt cornice & arched veranda gallery
  whiteParts.box(11.0, 0.32, 7.8, metX, crownY + 3.85, metZ);
  whiteParts.box(11.2, 0.38, 8.0, metX, crownY + 7.25, metZ);
  for (const sx of [-5.25, 5.25]) {
    for (const sz of [-3.65, 3.65]) {
      whiteParts.box(0.45, 6.7, 0.45, metX + sx, crownY + 3.9, metZ + sz);
    }
  }
  for (let bay = -1; bay <= 1; bay++) {
    const bx = metX + bay * 3.1;
    // Lower & upper shuttered colonial windows
    for (const wy of [2.2, 5.5]) {
      whiteParts.box(1.45, 1.85, 0.22, bx, crownY + wy, metZ + 3.72);
      turfJade.box(1.18, 1.58, 0.26, bx, crownY + wy, metZ + 3.74);
      whiteParts.box(1.45, 1.85, 0.22, bx, crownY + wy, metZ - 3.72);
      turfJade.box(1.18, 1.58, 0.26, bx, crownY + wy, metZ - 3.74);
    }
    whiteParts.cyl(0.16, 0.18, 3.3, 6, bx, crownY + 2.2, metZ + 4.55);
  }
  ochreParts.box(10.6, 0.35, 1.4, metX, crownY + 3.85, metZ + 4.15);
  // Colonial veranda balustrade rails & stepped entrance
  whiteParts.box(10.2, 0.14, 0.14, metX, crownY + 1.42, metZ + 4.55);
  whiteParts.box(10.2, 0.14, 0.14, metX, crownY + 4.78, metZ + 4.55);
  stoneParts.box(2.6, 0.42, 0.95, metX, crownY + 0.42, metZ + 4.95);
  // Pitched colonial terracotta roof + rooftop ridge crest, meteorological anemometer cups & Stevenson screen
  const metRoof = createHueImperialHipRoofGeometry(11.8, 8.6, 5.2, 1.8, 2.2, 0.16, 4, 3, true);
  metRoof.translate(metX, crownY + 7.42, metZ);
  roofParts.add(metRoof);
  whiteParts.box(5.4, 0.20, 0.24, metX, crownY + 9.65, metZ);
  whiteParts.cyl(0.07, 0.10, 3.8, 5, metX + 2.2, crownY + 10.6, metZ);
  whiteParts.box(1.4, 0.08, 0.08, metX + 2.2, crownY + 12.2, metZ);
  whiteParts.box(0.08, 0.08, 1.4, metX + 2.2, crownY + 12.4, metZ);
  for (const [cxOff, czOff] of [[-0.7, 0], [0.7, 0], [0, -0.7], [0, 0.7]]) {
    goldParts.sphere(0.13, 5, 4, metX + 2.2 + cxOff, crownY + 12.3, metZ + czOff);
  }
  // White louvered Stevenson weather screen box in front yard
  whiteParts.box(1.1, 1.0, 0.9, metX - 6.8, crownY + 1.55, metZ + 1.8);
  roofParts.box(1.25, 0.16, 1.05, metX - 6.8, crownY + 2.12, metZ + 1.8);
  woodParts.box(0.95, 1.2, 0.8, metX - 6.8, crownY + 0.55, metZ + 1.8);

  // Wave 26: Hoàng Sa Automated Tipping-Bucket Rain Gauge (*Vũ Kế VRain*) & Marine Solar Battery Enclosure
  const w26RgX = metX - 6.8;
  const w26RgZ = metZ - 0.6;
  graniteParts.box(1.35, 0.24, 1.35, w26RgX, crownY + 0.08, w26RgZ);
  graniteParts.cyl(0.24, 0.30, 0.28, 6, w26RgX, crownY + 0.34, w26RgZ);
  whiteParts.cyl(0.18, 0.18, 0.72, 8, w26RgX, crownY + 0.84, w26RgZ);
  goldParts.cyl(0.21, 0.18, 0.12, 8, w26RgX, crownY + 1.24, w26RgZ);
  voidParts.cyl(0.16, 0.16, 0.04, 8, w26RgX, crownY + 1.29, w26RgZ);
  for (const w26Sx of [-0.58, 0.58]) {
    for (const w26Sz of [-0.58, 0.58]) {
      whiteParts.cyl(0.03, 0.035, 0.76, 4, w26RgX + w26Sx, crownY + 0.56, w26RgZ + w26Sz);
    }
  }
  for (const w26Off of [-0.58, 0.58]) {
    whiteParts.box(1.22, 0.05, 0.05, w26RgX, crownY + 0.88, w26RgZ + w26Off);
    whiteParts.box(0.05, 0.05, 1.22, w26RgX + w26Off, crownY + 0.88, w26RgZ);
  }

  const w26BatX = metX - 6.8;
  const w26BatZ = metZ + 3.9;
  graniteParts.box(1.55, 0.30, 1.20, w26BatX, crownY + 0.10, w26BatZ);
  for (const w26Bx of [-0.48, 0.48]) {
    graniteParts.box(0.14, 0.24, 0.86, w26BatX + w26Bx, crownY + 0.36, w26BatZ);
  }
  whiteParts.box(1.18, 1.08, 0.78, w26BatX, crownY + 1.00, w26BatZ);
  ochreParts.box(1.32, 0.10, 0.92, w26BatX, crownY + 1.59, w26BatZ, { rx: 0.08 });
  voidParts.box(0.54, 0.22, 0.06, w26BatX - 0.20, crownY + 0.78, w26BatZ + 0.39);
  voidParts.box(0.54, 0.22, 0.06, w26BatX - 0.20, crownY + 1.24, w26BatZ + 0.39);
  goldParts.box(0.07, 0.24, 0.08, w26BatX + 0.42, crownY + 1.02, w26BatZ + 0.40);
  glowParts.sphere(0.055, 5, 4, w26BatX + 0.38, crownY + 1.38, w26BatZ + 0.40);
  graniteParts.cyl(0.04, 0.05, 0.56, 4, w26BatX, crownY + 1.86, w26BatZ - 0.10);
  turfJade.box(1.16, 0.06, 0.74, w26BatX, crownY + 2.16, w26BatZ - 0.10, { rx: 0.36 });
  whiteParts.box(1.22, 0.04, 0.78, w26BatX, crownY + 2.13, w26BatZ - 0.10, { rx: 0.36 });
  graniteParts.cyl(0.02, 0.03, 0.95, 4, w26BatX + 0.50, crownY + 2.02, w26BatZ - 0.26);

  // 1E. Miếu Hoàng Sa & Bia Chủ Quyền Đội Hoàng Sa Kiêm Quản Bắc Hải at (1051, 170)
  const mieuX = 1051.0;
  const mieuZ = 170.0;
  const mieuRotY = 0.35;
  buildings.push({ x: mieuX, z: mieuZ, r: 7.2 });

  stoneParts.box(8.8, 1.4, 6.8, mieuX, crownY - 0.10, mieuZ, { ry: mieuRotY });
  ochreParts.box(6.6, 3.4, 4.8, mieuX, crownY + 2.30, mieuZ, { ry: mieuRotY });
  // Front wooden lattice doors (*cửa bức bàn*), stepped stair apron & crimson portico pillars
  for (const lx of [-1.45, 0, 1.45]) {
    const dx = mieuX + lx * Math.cos(mieuRotY) + 2.42 * Math.sin(mieuRotY);
    const dz = mieuZ - lx * Math.sin(mieuRotY) + 2.42 * Math.cos(mieuRotY);
    woodParts.box(1.15, 2.35, 0.18, dx, crownY + 1.82, dz, { ry: mieuRotY });
    goldParts.box(0.85, 0.65, 0.22, dx, crownY + 2.45, dz, { ry: mieuRotY });
  }
  stoneParts.box(3.2, 0.52, 1.15, mieuX + 3.55 * Math.sin(mieuRotY), crownY + 0.35, mieuZ + 3.55 * Math.cos(mieuRotY), { ry: mieuRotY });
  for (const lx of [-2.4, -0.85, 0.85, 2.4]) {
    const px = mieuX + lx * Math.cos(mieuRotY) + 2.55 * Math.sin(mieuRotY);
    const pz = mieuZ - lx * Math.sin(mieuRotY) + 2.55 * Math.cos(mieuRotY);
    crimsonParts.cyl(0.16, 0.19, 3.4, 6, px, crownY + 2.30, pz);
  }
  // Forecourt bronze incense tripod (*lư hương*) & twin stone lanterns
  const incX = mieuX + 5.1 * Math.sin(mieuRotY);
  const incZ = mieuZ + 5.1 * Math.cos(mieuRotY);
  graniteParts.cyl(0.65, 0.78, 0.45, 6, incX, crownY + 0.25, incZ);
  bronzeParts.cyl(0.45, 0.36, 0.78, 6, incX, crownY + 0.85, incZ);
  bronzeParts.sphere(0.42, 6, 4, incX, crownY + 1.25, incZ, [1.0, 0.65, 1.0]);
  for (const lx of [-2.2, 2.2]) {
    const lnx = mieuX + lx * Math.cos(mieuRotY) + 4.8 * Math.sin(mieuRotY);
    const lnz = mieuZ - lx * Math.sin(mieuRotY) + 4.8 * Math.cos(mieuRotY);
    graniteParts.cyl(0.18, 0.24, 1.35, 5, lnx, crownY + 0.68, lnz);
    glowParts.box(0.32, 0.36, 0.32, lnx, crownY + 1.52, lnz);
    graniteParts.cone(0.36, 0.28, 4, lnx, crownY + 1.84, lnz, { ry: Math.PI * 0.25 });
  }
  const mieuRoof = createHueImperialHipRoofGeometry(8.4, 6.6, 3.8, 0.8, 2.15, 0.34, 4, 3, true);
  transformGeometryXYZ(mieuRoof, mieuX, crownY + 3.95, mieuZ, mieuRotY);
  roofParts.add(mieuRoof);
  const mieuFinials = createRoofFinialSetParts(mieuX, crownY + 6.08, mieuZ, 3.8, mieuRotY, 0.68, false);
  crimsonParts.add(...mieuFinials.mainParts);
  goldParts.add(...mieuFinials.goldParts);

  // Forecourt bronze incense burner & Bia Chủ Quyền Đội Hoàng Sa Kiêm Quản Bắc Hải stele pavilion
  const steleX = 1058.5;
  const steleZ = 172.5;
  buildings.push({ x: steleX, z: steleZ, r: 4.5 });
  graniteParts.box(3.8, 1.1, 3.8, steleX, crownY - 0.05, steleZ);
  // Tortoise/lotus plinth + upright granite sovereignty stele
  graniteParts.box(1.5, 0.45, 1.1, steleX, crownY + 0.72, steleZ);
  graniteParts.box(1.18, 2.15, 0.28, steleX, crownY + 1.95, steleZ);
  graniteParts.cyl(0.59, 0.59, 0.30, 8, steleX, crownY + 3.02, steleZ, { rx: Math.PI * 0.5 });
  goldParts.box(0.86, 1.45, 0.32, steleX, crownY + 1.98, steleZ);
  for (const sx of [-1.45, 1.45]) {
    for (const sz of [-1.45, 1.45]) {
      crimsonParts.cyl(0.13, 0.15, 3.2, 6, steleX + sx, crownY + 2.05, steleZ + sz);
    }
  }
  const steleRoof = createVietnameseCurvedRoofGeometry(4.3, 4.3, 0.6, 0.6, 1.55, 0.28, 4, 4);
  steleRoof.translate(steleX, crownY + 3.60, steleZ);
  roofParts.add(steleRoof);

  // 1F. Solar Panel Array powering the island station at (1066, 166)
  const spX = 1066.5;
  const spZ = 166.0;
  buildings.push({ x: spX, z: spZ, r: 5.0 });
  for (let row = 0; row < 2; row++) {
    const rz = spZ + (row - 0.5) * 2.8;
    graniteParts.box(5.6, 0.18, 0.24, spX, crownY + 0.10, rz);
    for (const sx of [-2.1, 0, 2.1]) {
      graniteParts.cyl(0.06, 0.07, 1.35, 4, spX + sx, crownY + 0.65, rz);
    }
    turfJade.box(5.8, 0.10, 1.85, spX, crownY + 1.28, rz, { rx: 0.42 });
    whiteParts.box(5.9, 0.08, 1.92, spX, crownY + 1.25, rz, { rx: 0.42 });
  }

  // 1G. Concrete Jetty extending East-Southeast from (1076, 167) out to (1102, 177) + 2 Moored Ghe Bầu Boats
  const jx0 = 1074.0;
  const jz0 = 166.0;
  const jx1 = 1102.0;
  const jz1 = 178.0;
  const jLen = Math.hypot(jx1 - jx0, jz1 - jz0);
  const jYaw = Math.atan2(jx1 - jx0, jz1 - jz0);
  const jMidX = (jx0 + jx1) * 0.5;
  const jMidZ = (jz0 + jz1) * 0.5;
  const jettyY = VIETNAM_WATER_LEVEL + 1.55;
  buildings.push({ x: jx0 + 4.0, z: jz0 + 2.0, r: 5.5 });

  graniteParts.box(4.2, 0.48, jLen, jMidX, jettyY, jMidZ, { ry: jYaw });
  stoneParts.box(4.5, 0.22, jLen, jMidX, jettyY + 0.26, jMidZ, { ry: jYaw });
  // Deep seabed concrete piles anchored down to -4.5m & mooring bollards
  for (let s = 0; s <= 5; s++) {
    const t = s / 5;
    const px = THREE.MathUtils.lerp(jx0, jx1, t);
    const pz = THREE.MathUtils.lerp(jz0, jz1, t);
    for (const side of [-1.6, 1.6]) {
      const ox = px + Math.cos(jYaw) * side;
      const oz = pz - Math.sin(jYaw) * side;
      graniteParts.cyl(0.24, 0.28, 6.2, 5, ox, -1.55, oz);
      if (s >= 2) {
        bronzeParts.cyl(0.14, 0.18, 0.48, 5, ox, jettyY + 0.55, oz);
      }
    }
  }
  addWavingFlagMesh(group, ctx, flagUniforms, 'HoangSaJettyFlag', jx1, jettyY + 6.4, jz1, 2.1, 1.4, 0.4, 0.9, true);
  whiteParts.cyl(0.05, 0.08, 6.2, 5, jx1, jettyY + 3.4, jz1);

  // Wave 29: Hoàng Sa Jetty Root Mooring Control Shelter, Life-Ring Post & Supply Crate Stack
  const w29HsCos = Math.cos(jYaw);
  const w29HsSin = Math.sin(jYaw);
  const w29HsAt = (lx: number, ly: number, lz: number): [number, number, number] => [
    jx0 + lx * w29HsCos + lz * w29HsSin,
    jettyY + ly,
    jz0 - lx * w29HsSin + lz * w29HsCos
  ];
  const [w29ShX, w29ShY, w29ShZ] = w29HsAt(-1.45, 0.35, 3.2);
  graniteParts.box(1.15, 0.24, 1.85, w29ShX, w29ShY, w29ShZ, { ry: jYaw });
  whiteParts.box(0.88, 1.55, 1.45, w29ShX, w29ShY + 0.88, w29ShZ, { ry: jYaw });
  roofParts.box(1.18, 0.14, 1.78, w29ShX, w29ShY + 1.74, w29ShZ, { ry: jYaw });
  voidParts.box(0.92, 0.56, 0.85, w29ShX, w29ShY + 1.08, w29ShZ, { ry: jYaw });
  const [w29LrX, w29LrY, w29LrZ] = w29HsAt(1.55, 0.92, 5.2);
  whiteParts.cyl(0.05, 0.06, 1.35, 4, w29LrX, w29LrY, w29LrZ);
  crimsonParts.cyl(0.32, 0.32, 0.10, 6, w29LrX, w29LrY + 0.38, w29LrZ, { rz: Math.PI * 0.5, ry: jYaw });
  const [w29CrX, w29CrY, w29CrZ] = w29HsAt(1.35, 0.62, 2.4);
  woodParts.box(0.76, 0.58, 0.92, w29CrX, w29CrY, w29CrZ, { ry: jYaw });
  ochreParts.box(0.58, 0.44, 0.64, w29CrX, w29CrY + 0.51, w29CrZ, { ry: jYaw + 0.14 });

  // 2 Moored Traditional Wooden Ghe Bầu Đội Hùng Binh Hoàng Sa alongside the concrete jetty
  appendGheBauBoatParts(
    woodParts,
    ochreParts,
    whiteParts,
    voidParts,
    1091.0,
    VIETNAM_WATER_LEVEL,
    168.5,
    jYaw + 0.08,
    11.2,
    3.0,
    true
  );
  appendGheBauBoatParts(
    woodParts,
    ochreParts,
    whiteParts,
    voidParts,
    1095.5,
    VIETNAM_WATER_LEVEL,
    181.2,
    jYaw + Math.PI - 0.12,
    10.4,
    2.8,
    true
  );

  // 1 Animated Sailing Ghe Bầu Đội Hoàng Sa patrolling offshore
  const patrolGheGroup = new THREE.Group();
  patrolGheGroup.name = 'HoangSaPatrolGheBau';
  const pgWood = new PartsBuilder();
  const pgOchre = new PartsBuilder();
  const pgWhite = new PartsBuilder();
  const pgVoid = new PartsBuilder();
  const mastTop = appendGheBauBoatParts(pgWood, pgOchre, pgWhite, pgVoid, 0, 0, 0, 0, 11.6, 3.1, true);
  commitPartsMesh(patrolGheGroup, pgWood, 'HoangSaGheHull', ctx.materials.darkWood, false, true);
  commitPartsMesh(patrolGheGroup, pgOchre, 'HoangSaGheSail', ctx.materials.bambooWeave ?? ctx.materials.yellowOchrePlaster, false, true);
  commitPartsMesh(patrolGheGroup, pgWhite, 'HoangSaGheEyes', ctx.materials.whitePlaster, false, false);
  commitPartsMesh(patrolGheGroup, pgVoid, 'HoangSaGhePupils', ctx.materials.darkVoid, false, false);
  addWavingFlagMesh(
    patrolGheGroup,
    ctx,
    flagUniforms,
    'HoangSaGheFlag',
    mastTop.mastTopX,
    mastTop.mastTopY,
    mastTop.mastTopZ,
    1.6,
    1.05,
    0,
    0.8,
    true
  );
  patrolGheGroup.position.set(1116.0, VIETNAM_WATER_LEVEL, 152.0);
  group.add(patrolGheGroup);
  southernBoats.push({
    group: patrolGheGroup,
    centerX: 1118.0,
    centerZ: 158.0,
    radiusX: 14.0,
    radiusZ: 22.0,
    speed: 0.22,
    phase: 0.7
  });

  // 1H. Perimeter *Cây Phong Ba & Bàng Vuông* Coastal Trees (>= 5.5m clear of all buildings)
  const treeCandidates: Array<[number, number, number]> = [
    [1033.0, 162.5, 1.05],
    [1038.0, 170.0, 0.95],
    [1046.0, 139.0, 1.0],
    [1060.0, 141.5, 1.1],
    [1078.0, 156.5, 0.95],
    [1069.0, 176.5, 1.0],
    [1042.0, 176.0, 0.92],
    [1082.0, 147.0, 0.88]
  ];
  for (let i = 0; i < treeCandidates.length; i++) {
    const [tx, tz, tsc] = treeCandidates[i];
    addCoastalIslandTree(barkParts, turfJade, tx, crownY - 0.12, tz, tsc, 900 + i * 17, buildings, 5.5);
  }

  commitPartsMesh(group, reefMarble, 'HoangSaCoralReefShelf', ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true, 3.2);
  commitPartsMesh(group, sandParts, 'HoangSaCoralSandIsland', ctx.materials.ochreSand ?? ctx.materials.yellowOchrePlaster, false, true, 3.0);
  commitPartsMesh(group, turfJade, 'HoangSaTurfAndFoliage', ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true, 2.6);
  commitPartsMesh(group, graniteParts, 'HoangSaGraniteStructures', ctx.materials.granite, false, true, 2.4);
  commitPartsMesh(group, stoneParts, 'HoangSaStoneFoundations', ctx.materials.stone, false, true, 2.4);
  commitPartsMesh(group, lighthouseCoreShadow, 'HoangSaLighthouseCore', ctx.materials.whitePlaster, true, true, 2.4);
  commitPartsMesh(group, whiteParts, 'HoangSaWhiteTrim', ctx.materials.whitePlaster, false, true, 2.4);
  commitPartsMesh(group, ochreParts, 'HoangSaColonialYellowStation', ctx.materials.yellowOchrePlaster, false, true, 2.4);
  commitPartsMesh(group, crimsonParts, 'HoangSaCrimsonAccents', ctx.materials.crimsonLacquer, false, true);
  commitPartsMesh(group, roofParts, 'HoangSaTerracottaRoofs', ctx.materials.terracottaRoof, false, true);
  commitPartsMesh(group, goldParts, 'HoangSaGoldEmblems', ctx.materials.gold, false, false);
  commitPartsMesh(group, bronzeParts, 'HoangSaBronzePlaques', ctx.materials.bronze, false, true);
  commitPartsMesh(group, woodParts, 'HoangSaGheBauWood', ctx.materials.darkWood, false, true);
  commitPartsMesh(group, barkParts, 'HoangSaPhongBaTrunks', ctx.materials.bark, false, true);
  commitPartsMesh(group, glowParts, 'HoangSaLighthouseBeaconGlow', ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false);
  commitPartsMesh(group, voidParts, 'HoangSaDarkOpenings', ctx.materials.darkVoid, false, false);

  tagMotifIds(group, ['HS-SOVEREIGNTY-OBELISK', 'HS-LIGHTHOUSE', 'HS-MET-1938', 'HS-MIEU-BIA', 'HS-GHE-BAU']);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 62.0 });
  return group;
}

// ============================================================================
// 2. QUẦN ĐẢO TRƯỜNG SA & NHÀ GIÀN DK1 (`TruongSaAndDK1Complex`) at (980, 560)
// ============================================================================
function appendOffshoreDK1Platform(
  goldJacket: PartsBuilder,
  graniteSteel: PartsBuilder,
  whiteModule: PartsBuilder,
  ochreModule: PartsBuilder,
  darkDeck: PartsBuilder,
  jadeSolar: PartsBuilder,
  crimsonLifeboat: PartsBuilder,
  marbleRadome: PartsBuilder,
  glowBeacon: PartsBuilder,
  voidWindows: PartsBuilder,
  cx: number,
  cz: number,
  deckSpan: number,
  numLegs: 6 | 8,
  stories: 2 | 3,
  includeHelipad: boolean
): { flagX: number; flagTopY: number; flagZ: number } {
  const seabedY = -12.0;
  const deckY = 11.0;
  const halfTop = deckSpan * 0.44;
  const halfBot = halfTop + 2.8;

  // Submerged mud-mat seabed foundation frame at -12m
  graniteSteel.box(halfBot * 2.25, 0.65, halfBot * 2.25, cx, seabedY - 0.15, cz);

  const topNodes: THREE.Vector3[] = [];
  const botNodes: THREE.Vector3[] = [];

  if (numLegs === 8) {
    // 8 perimeter jacket legs: 4 corners + 4 mid-sides
    const coords: Array<[number, number]> = [
      [-1, -1], [0, -1], [1, -1], [1, 0],
      [1, 1], [0, 1], [-1, 1], [-1, 0]
    ];
    for (const [ux, uz] of coords) {
      topNodes.push(new THREE.Vector3(cx + ux * halfTop, deckY, cz + uz * halfTop));
      botNodes.push(new THREE.Vector3(cx + ux * halfBot, seabedY, cz + uz * halfBot));
    }
  } else {
    // 6 jacket legs: 3×2 offshore rectangular jacket grid
    const coords: Array<[number, number]> = [
      [-1, -1], [0, -1], [1, -1],
      [1, 1], [0, 1], [-1, 1]
    ];
    for (const [ux, uz] of coords) {
      topNodes.push(new THREE.Vector3(cx + ux * halfTop, deckY, cz + uz * halfTop * 0.88));
      botNodes.push(new THREE.Vector3(cx + ux * halfBot, seabedY, cz + uz * halfBot * 0.88));
    }
  }

  const legPointAt = (idx: number, frac: number): THREE.Vector3 =>
    new THREE.Vector3().lerpVectors(botNodes[idx], topNodes[idx], frac);

  // Main battered yellow-orange tubular steel jacket legs (-12m to +11m) + crimson wave-zone splash collars
  for (let i = 0; i < topNodes.length; i++) {
    goldJacket.strut(botNodes[i], topNodes[i], 0.34, 0.44, 6);
    const splashNode = legPointAt(i, 0.54);
    crimsonLifeboat.cyl(0.46, 0.48, 2.2, 6, splashNode.x, splashNode.y, splashNode.z);
  }

  // 3 tiers of horizontal girts & diagonal X-brace struts around perimeter jacket bays
  const levelFracs = [0.16, 0.48, 0.76, 0.98];
  for (let i = 0; i < topNodes.length; i++) {
    const next = (i + 1) % topNodes.length;
    for (let lv = 0; lv < levelFracs.length - 1; lv++) {
      const a0 = legPointAt(i, levelFracs[lv]);
      const b0 = legPointAt(next, levelFracs[lv]);
      const a1 = legPointAt(i, levelFracs[lv + 1]);
      const b1 = legPointAt(next, levelFracs[lv + 1]);
      goldJacket.strut(a0, b0, 0.14, 0.14, 5);
      goldJacket.strut(a0, b1, 0.12, 0.12, 4);
      goldJacket.strut(b0, a1, 0.12, 0.12, 4);
    }
    const aTop = legPointAt(i, 0.98);
    const bTop = legPointAt(next, 0.98);
    goldJacket.strut(aTop, bTop, 0.18, 0.18, 5);
  }

  // Boat landing stage & steel access ladder from sea level (+0.8m) up to +11.0m deck
  const ladX = cx - halfTop - 0.55;
  goldJacket.box(0.85, 11.2, 0.25, ladX, 5.4, cz);
  graniteSteel.box(1.8, 0.28, 3.2, ladX - 0.4, 1.1, cz);

  // Wave 29: DK1 Boat-Landing Fender Bumper Posts & Manual Hand-Crank Cargo Hoist Davit (*Ròng Rọc Kéo Hàng*)
  for (const w29Fz of [-1.25, 1.25]) {
    graniteSteel.cyl(0.11, 0.13, 3.6, 4, ladX - 1.18, 1.2, cz + w29Fz);
    darkDeck.box(0.24, 1.45, 0.34, ladX - 1.32, 1.15, cz + w29Fz);
  }
  const w29HoistBase = new THREE.Vector3(cx - halfTop + 0.15, deckY + 1.45, cz + 0.95);
  const w29HoistTip = new THREE.Vector3(ladX - 1.15, deckY + 3.45, cz + 0.95);
  goldJacket.strut(w29HoistBase, w29HoistTip, 0.08, 0.10, 4);
  goldJacket.strut(
    new THREE.Vector3(cx - halfTop + 0.15, deckY + 0.65, cz + 0.95),
    new THREE.Vector3(ladX - 0.45, deckY + 2.45, cz + 0.95),
    0.06,
    0.07,
    4
  );
  goldJacket.cyl(0.18, 0.18, 0.12, 6, w29HoistTip.x, w29HoistTip.y, w29HoistTip.z, { rx: Math.PI * 0.5 });
  graniteSteel.strut(w29HoistTip, new THREE.Vector3(w29HoistTip.x, deckY - 3.6, w29HoistTip.z), 0.03, 0.03, 4);
  ochreModule.box(0.82, 0.58, 0.72, w29HoistTip.x, deckY - 3.92, w29HoistTip.z);

  // Steel main deck girder grillage at +11.0m + perimeter safety handrail stanchions
  graniteSteel.box(deckSpan, 0.72, deckSpan, cx, deckY + 0.25, cz);
  goldJacket.box(deckSpan + 0.35, 0.26, deckSpan + 0.35, cx, deckY + 0.62, cz);
  const railH = deckSpan * 0.5;
  for (const s of [-1, 1]) {
    goldJacket.box(deckSpan, 0.08, 0.08, cx, deckY + 1.55, cz + s * railH);
    goldJacket.box(deckSpan, 0.06, 0.06, cx, deckY + 1.12, cz + s * railH);
    goldJacket.box(0.08, 0.08, deckSpan, cx + s * railH, deckY + 1.55, cz);
    goldJacket.box(0.06, 0.06, deckSpan, cx + s * railH, deckY + 1.12, cz);
    for (let p = -2; p <= 2; p++) {
      goldJacket.cyl(0.04, 0.04, 0.95, 4, cx + p * (deckSpan * 0.22), deckY + 1.12, cz + s * railH);
      goldJacket.cyl(0.04, 0.04, 0.95, 4, cx + s * railH, deckY + 1.12, cz + p * (deckSpan * 0.22));
    }
    // Bright orange-crimson offshore life-rings mounted on perimeter handrails
    crimsonLifeboat.cyl(0.32, 0.32, 0.10, 6, cx + s * (deckSpan * 0.26), deckY + 1.24, cz + s * (railH + 0.08), { rx: Math.PI * 0.5 });
    whiteModule.box(0.14, 0.66, 0.12, cx + s * (deckSpan * 0.26), deckY + 1.24, cz + s * (railH + 0.08));
    crimsonLifeboat.cyl(0.32, 0.32, 0.10, 6, cx + s * (railH + 0.08), deckY + 1.24, cz - s * (deckSpan * 0.24), { rz: Math.PI * 0.5 });
    whiteModule.box(0.12, 0.66, 0.14, cx + s * (railH + 0.08), deckY + 1.24, cz - s * (deckSpan * 0.24));
  }

  // Corner offshore pedestal supply crane (*cần cẩu hàng*: slewing turret, cab, A-frame gantry, hydraulic rams, boom & cargo sling)
  const crX = cx + deckSpan * 0.42;
  const crZ = cz + deckSpan * 0.42;
  goldJacket.cyl(0.42, 0.54, 2.2, 6, crX, deckY + 1.75, crZ);
  ochreModule.box(1.15, 1.08, 1.25, crX, deckY + 3.05, crZ);
  voidWindows.box(0.75, 0.52, 0.14, crX + 0.18, deckY + 3.16, crZ + 0.62);
  graniteSteel.box(0.95, 0.65, 0.52, crX - 0.58, deckY + 2.95, crZ - 0.58, { ry: Math.PI * 0.25 });
  // A-frame gantry & hydraulic luffing piston supporting the inclined boom
  const gantryTop = new THREE.Vector3(crX - 0.32, deckY + 4.55, crZ - 0.32);
  goldJacket.strut(new THREE.Vector3(crX - 0.45, deckY + 3.45, crZ + 0.12), gantryTop, 0.06, 0.07, 4);
  goldJacket.strut(new THREE.Vector3(crX + 0.12, deckY + 3.45, crZ - 0.45), gantryTop, 0.06, 0.07, 4);
  const boomTip = new THREE.Vector3(crX + 3.35, deckY + 7.25, crZ + 2.95);
  const boomMid = new THREE.Vector3(crX + 1.55, deckY + 5.10, crZ + 1.35);
  goldJacket.strut(new THREE.Vector3(crX, deckY + 3.2, crZ), boomTip, 0.12, 0.17, 4);
  graniteSteel.strut(new THREE.Vector3(crX + 0.32, deckY + 3.15, crZ + 0.32), boomMid, 0.065, 0.08, 4);
  graniteSteel.strut(gantryTop, boomTip, 0.035, 0.035, 4);
  goldJacket.cyl(0.20, 0.20, 0.14, 6, boomTip.x, boomTip.y, boomTip.z, { rz: Math.PI * 0.5 });
  graniteSteel.strut(boomTip, new THREE.Vector3(boomTip.x, deckY + 2.55, boomTip.z), 0.035, 0.035, 4);
  crimsonLifeboat.box(0.32, 0.36, 0.32, boomTip.x, deckY + 2.45, boomTip.z);
  ochreModule.box(0.95, 0.62, 0.85, boomTip.x, deckY + 1.85, boomTip.z);

  // Twin cylindrical stainless/white freshwater desalination water storage tanks on opposite deck corner
  const wtBaseX = cx - deckSpan * 0.40;
  const wtBaseZ = cz - deckSpan * 0.36;
  for (let tk = 0; tk < 2; tk++) {
    const tkx = wtBaseX + tk * 1.32;
    const tkz = wtBaseZ;
    graniteSteel.cyl(0.56, 0.62, 0.28, 6, tkx, deckY + 0.82, tkz);
    whiteModule.cyl(0.52, 0.52, 1.85, 8, tkx, deckY + 1.85, tkz);
    graniteSteel.cyl(0.55, 0.55, 0.08, 8, tkx, deckY + 1.42, tkz);
    graniteSteel.cyl(0.55, 0.55, 0.08, 8, tkx, deckY + 2.28, tkz);
    whiteModule.sphere(0.52, 6, 4, tkx, deckY + 2.78, tkz, [1.0, 0.36, 1.0]);
  }
  graniteSteel.strut(
    new THREE.Vector3(wtBaseX, deckY + 2.45, wtBaseZ),
    new THREE.Vector3(wtBaseX + 1.32, deckY + 2.45, wtBaseZ),
    0.055,
    0.055,
    4
  );
  graniteSteel.strut(
    new THREE.Vector3(wtBaseX + 1.32, deckY + 1.65, wtBaseZ),
    new THREE.Vector3(wtBaseX + 1.32, deckY + 1.65, wtBaseZ + 1.15),
    0.055,
    0.055,
    4
  );

  // Multi-story White-and-Yellow Steel Living Quarters Module
  const modW = deckSpan * 0.76;
  const modD = deckSpan * 0.72;
  const floorH = 2.85;
  const totalModH = stories * floorH;
  const modBaseY = deckY + 0.68;

  whiteModule.box(modW, totalModH, modD, cx, modBaseY + totalModH * 0.5, cz);
  for (let s = 0; s < stories; s++) {
    const fy = modBaseY + s * floorH;
    // Yellow steel structural frame bands & exterior catwalk balconies
    ochreModule.box(modW + 0.24, 0.32, modD + 0.24, cx, fy + 0.16, cz);
    ochreModule.box(modW + 0.28, 0.30, modD + 0.28, cx, fy + floorH - 0.14, cz);
    for (let w = -1; w <= 1; w++) {
      voidWindows.box(1.05, 0.95, modD + 0.16, cx + w * (modW * 0.28), fy + 1.55, cz);
      voidWindows.box(modW + 0.16, 0.95, 1.05, cx, fy + 1.55, cz + w * (modD * 0.28));
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      ochreModule.box(0.38, totalModH + 0.2, 0.38, cx + sx * (modW * 0.5), modBaseY + totalModH * 0.5, cz + sz * (modD * 0.5));
    }
  }

  // Twin orange-red enclosed free-fall lifeboats on steel davits
  for (const side of [-1, 1]) {
    const lbx = cx + side * (deckSpan * 0.48);
    const lbz = cz + 1.6;
    goldJacket.box(0.9, 1.8, 0.35, lbx, deckY + 1.5, lbz - 1.1);
    goldJacket.box(0.9, 1.8, 0.35, lbx, deckY + 1.5, lbz + 1.1);
    crimsonLifeboat.cyl(0.58, 0.42, 3.2, 6, lbx + side * 0.42, deckY + 1.85, lbz, { rx: Math.PI * 0.5 });
  }

  const roofTopY = modBaseY + totalModH;

  // Solar panel arrays mounted along south roof edge
  for (let sp = -1; sp <= 1; sp++) {
    jadeSolar.box(2.4, 0.10, 1.5, cx + sp * 2.8, roofTopY + 0.65, cz + modD * 0.42, { rx: 0.38 });
    graniteSteel.cyl(0.06, 0.07, 0.75, 4, cx + sp * 2.8, roofTopY + 0.32, cz + modD * 0.42);
  }

  let mastBaseY = roofTopY;
  if (includeHelipad) {
    // Cantilevered octagonal rooftop Helipad marked with crisp white 'H' ring
    const heliY = roofTopY + 0.95;
    const heliR = deckSpan * 0.52;
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + Math.PI * 0.25;
      goldJacket.strut(
        new THREE.Vector3(cx + Math.cos(a) * (modW * 0.35), roofTopY - 0.2, cz + Math.sin(a) * (modD * 0.35)),
        new THREE.Vector3(cx + Math.cos(a) * (heliR * 0.85), heliY, cz + Math.sin(a) * (heliR * 0.85)),
        0.14,
        0.14,
        4
      );
    }
    darkDeck.cyl(heliR, heliR * 0.96, 0.34, 8, cx, heliY, cz);
    goldJacket.cyl(heliR + 0.42, heliR + 0.42, 0.10, 8, cx, heliY + 0.08, cz);
    // Outrigger helipad safety-net frame ribs, underside knee-brace brackets, perimeter tension rails & ICAO windsock mast
    for (let net = 0; net < 8; net++) {
      const na = (net / 8) * Math.PI * 2 + Math.PI * 0.125;
      const w24NextNa = ((net + 1) / 8) * Math.PI * 2 + Math.PI * 0.125;
      const w24TipA = new THREE.Vector3(cx + Math.cos(na) * (heliR + 1.15), heliY + 0.35, cz + Math.sin(na) * (heliR + 1.15));
      const w24TipB = new THREE.Vector3(cx + Math.cos(w24NextNa) * (heliR + 1.15), heliY + 0.35, cz + Math.sin(w24NextNa) * (heliR + 1.15));
      goldJacket.strut(
        new THREE.Vector3(cx + Math.cos(na) * heliR, heliY, cz + Math.sin(na) * heliR),
        w24TipA,
        0.05,
        0.05,
        4
      );
      // Underside diagonal steel knee-brace bracket supporting each safety-net outrigger
      graniteSteel.strut(
        new THREE.Vector3(cx + Math.cos(na) * (heliR - 0.18), heliY - 0.36, cz + Math.sin(na) * (heliR - 0.18)),
        new THREE.Vector3(cx + Math.cos(na) * (heliR + 0.82), heliY + 0.24, cz + Math.sin(na) * (heliR + 0.82)),
        0.038,
        0.042,
        4
      );
      // Outer perimeter safety-net tension rail & mid-span mesh wire chord
      graniteSteel.strut(w24TipA, w24TipB, 0.035, 0.035, 4);
      goldJacket.strut(
        new THREE.Vector3(cx + Math.cos(na) * (heliR + 0.58), heliY + 0.17, cz + Math.sin(na) * (heliR + 0.58)),
        new THREE.Vector3(cx + Math.cos(w24NextNa) * (heliR + 0.58), heliY + 0.17, cz + Math.sin(w24NextNa) * (heliR + 0.58)),
        0.025,
        0.025,
        4
      );
    }
    const w24WsX = cx - heliR * 0.85;
    const w24WsZ = cz + heliR * 0.42;
    graniteSteel.cyl(0.16, 0.20, 0.16, 6, w24WsX, heliY + 0.16, w24WsZ);
    whiteModule.cyl(0.04, 0.06, 2.4, 4, w24WsX, heliY + 1.3, w24WsZ);
    for (const w24Guy of [[-0.45, 0.32], [0.35, -0.42]]) {
      graniteSteel.strut(
        new THREE.Vector3(w24WsX + w24Guy[0], heliY + 0.18, w24WsZ + w24Guy[1]),
        new THREE.Vector3(w24WsX, heliY + 1.65, w24WsZ),
        0.02,
        0.02,
        4
      );
    }
    goldJacket.cyl(0.20, 0.20, 0.06, 6, w24WsX + 0.12, heliY + 2.36, w24WsZ, { rz: Math.PI * 0.5 });
    crimsonLifeboat.cone(0.18, 0.95, 5, w24WsX + 0.48, heliY + 2.35, w24WsZ, { rz: -Math.PI * 0.45 });
    whiteModule.cyl(0.13, 0.15, 0.26, 5, w24WsX + 0.44, heliY + 2.35, w24WsZ, { rz: -Math.PI * 0.45 });
    glowBeacon.sphere(0.09, 5, 4, w24WsX, heliY + 2.58, w24WsZ);
    // White circular 'H' ring segments + central 'H' landing bars
    const ringR = heliR * 0.68;
    for (let seg = 0; seg < 8; seg++) {
      const a = (seg / 8) * Math.PI * 2;
      whiteModule.box(
        ringR * 0.74,
        0.06,
        0.26,
        cx + Math.sin(a) * ringR,
        heliY + 0.19,
        cz + Math.cos(a) * ringR,
        { ry: a }
      );
      glowBeacon.sphere(0.11, 5, 4, cx + Math.sin(a) * (heliR - 0.2), heliY + 0.24, cz + Math.cos(a) * (heliR - 0.2));
    }
    whiteModule.box(0.42, 0.07, 3.2, cx - 1.15, heliY + 0.20, cz);
    whiteModule.box(0.42, 0.07, 3.2, cx + 1.15, heliY + 0.20, cz);
    whiteModule.box(2.3, 0.07, 0.42, cx, heliY + 0.20, cz);
    mastBaseY = heliY + 0.18;
  }

  // White Radome Radar Dome, Satellite Dish, Wind Turbine, Navigation Beacon & Flagstaff
  const twX = cx + modW * 0.36;
  const twZ = cz - modD * 0.36;
  graniteSteel.cyl(0.28, 0.38, 3.6, 5, twX, mastBaseY + 1.7, twZ);
  marbleRadome.sphere(1.05, 8, 6, twX, mastBaseY + 4.15, twZ);
  // Parabolic satellite dish mounted beside radome
  graniteSteel.cyl(0.10, 0.14, 1.5, 4, twX - 1.55, mastBaseY + 0.75, twZ + 0.35);
  marbleRadome.cone(0.72, 0.28, 6, twX - 1.55, mastBaseY + 1.62, twZ + 0.35, { rx: 0.58 });

  // Offshore 3-blade Wind Turbine generator on opposite roof corner
  const wtX = cx + modW * 0.34;
  const wtZ = cz + modD * 0.30;
  whiteModule.cyl(0.08, 0.14, 4.8, 5, wtX, mastBaseY + 2.4, wtZ);
  whiteModule.box(0.28, 0.28, 0.55, wtX, mastBaseY + 4.85, wtZ);
  for (let b = 0; b < 3; b++) {
    const ba = (b / 3) * Math.PI * 2 + 0.25;
    whiteModule.box(0.12, 1.65, 0.06, wtX + Math.sin(ba) * 0.78, mastBaseY + 4.85 + Math.cos(ba) * 0.78, wtZ + 0.30, { rz: -ba });
  }

  const bcnX = cx - modW * 0.36;
  const bcnZ = cz - modD * 0.36;
  goldJacket.cyl(0.14, 0.22, 4.4, 5, bcnX, mastBaseY + 2.1, bcnZ);
  crimsonLifeboat.cyl(0.42, 0.35, 0.55, 6, bcnX, mastBaseY + 4.4, bcnZ);
  glowBeacon.cyl(0.32, 0.32, 0.65, 6, bcnX, mastBaseY + 4.95, bcnZ);

  const flagX = cx;
  const flagZ = cz - modD * 0.44;
  whiteModule.cyl(0.06, 0.10, 6.2, 5, flagX, mastBaseY + 3.0, flagZ);
  goldJacket.sphere(0.14, 5, 4, flagX, mastBaseY + 6.18, flagZ);

  return { flagX, flagTopY: mastBaseY + 6.05, flagZ };
}

/**
 * Builds a sleek white Tàu Kiểm Ngư / Cảnh Sát Biển Việt Nam patrol ship with red/blue hull stripes, radar & water cannon.
 */
function buildPatrolShipGroup(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  name: string
): THREE.Group {
  const ship = new THREE.Group();
  ship.name = name;

  const whiteHull = new PartsBuilder();
  const crimsonStripe = new PartsBuilder();
  const blueTealStripe = new PartsBuilder();
  const darkDeck = new PartsBuilder();
  const steelParts = new PartsBuilder();
  const goldParts = new PartsBuilder();
  const voidGlass = new PartsBuilder();
  const glowLights = new PartsBuilder();

  const len = 25.0;
  const beam = 5.2;
  const hullGeo = new THREE.BoxGeometry(beam, 2.5, len, 4, 2, 10);
  const hp = hullGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i);
    let y = hp.getY(i);
    const z = hp.getZ(i);
    const tz = z / (len * 0.5);
    const ty = (y + 1.25) / 2.5;
    const planW =
      tz > 0.15
        ? Math.pow(Math.max(0.05, 1.0 - Math.pow((tz - 0.15) / 0.85, 1.45)), 0.62)
        : 0.90 + 0.10 * ((tz + 1.0) / 1.15);
    const flare = 0.64 + 0.36 * ty;
    const sheer = tz > 0 ? 0.65 * Math.pow(tz, 1.9) : 0.12 * tz * tz;
    x *= planW * flare;
    if (tz > 0.6 && ty < 0.35) {
      // Raked clipper bow stem
      hp.setZ(i, z - (1.0 - ty) * 1.6);
    }
    y += sheer;
    hp.setXYZ(i, x, y, hp.getZ(i));
  }
  hullGeo.computeVertexNormals();
  hullGeo.translate(0, 0.85, 0);
  whiteHull.add(hullGeo);

  // Dark gray non-skid weather deck
  darkDeck.box(beam * 0.82, 0.16, len * 0.78, 0, 2.12, -1.2);

  // Iconic Cảnh Sát Biển / Kiểm Ngư diagonal Red & Blue racing stripes on both hull flanks
  for (const sx of [-1, 1]) {
    crimsonStripe.box(0.14, 0.62, 3.8, sx * (beam * 0.46), 1.48, 3.6, { rx: 0.48, ry: sx * 0.10 });
    blueTealStripe.box(0.14, 0.42, 3.6, sx * (beam * 0.46), 1.44, 2.4, { rx: 0.48, ry: sx * 0.08 });
    crimsonStripe.box(0.12, 0.32, len * 0.68, sx * (beam * 0.48), 0.32, -1.5);
  }

  // Raked 2-tier white bridge superstructure + bridge wings + dark tinted bridge windows
  whiteHull.box(4.1, 2.2, 8.6, 0, 3.15, -0.8);
  whiteHull.box(3.5, 1.85, 5.2, 0, 5.05, 0.2);
  // Port & Starboard bridge wing sponsons + navigation lights & lifebuoys
  whiteHull.box(5.3, 0.55, 1.45, 0, 4.95, 1.65);
  crimsonStripe.sphere(0.14, 5, 4, -2.65, 5.32, 1.65);
  blueTealStripe.sphere(0.14, 5, 4, 2.65, 5.32, 1.65);
  for (const sx of [-1, 1]) {
    crimsonStripe.cyl(0.26, 0.26, 0.08, 6, sx * 2.12, 3.45, 1.6, { rz: Math.PI * 0.5 });
    // Anchor hawsepipe & fluke near bow
    steelParts.box(0.14, 0.52, 0.42, sx * (beam * 0.34), 1.68, 9.2, { ry: sx * 0.32 });
  }
  voidGlass.box(3.62, 0.68, 2.4, 0, 5.35, 1.72);
  voidGlass.box(2.8, 0.68, 0.32, 0, 5.35, 2.84);

  // Bridge lattice radar mast, cross-yardarms, whip antennas, satcom dome & searchlights
  steelParts.cyl(0.16, 0.32, 4.2, 5, 0, 7.9, -0.2);
  steelParts.box(2.2, 0.10, 0.10, 0, 8.2, -0.2);
  whiteHull.box(1.9, 0.16, 0.28, 0, 8.9, -0.2);
  whiteHull.sphere(0.45, 6, 4, 0, 9.8, -0.2);
  glowLights.sphere(0.16, 5, 4, 0, 10.4, -0.2);
  for (const sx of [-0.95, 0.95]) {
    steelParts.cyl(0.03, 0.05, 2.8, 4, sx, 7.4, -0.8);
    glowLights.cyl(0.14, 0.14, 0.22, 5, sx * 1.1, 6.22, 2.25, { rx: Math.PI * 0.5 });
  }

  // Foredeck high-pressure Water Cannon (*vòi rồng*) + foredeck hatch & anchor capstan
  steelParts.box(1.6, 0.35, 1.4, 0, 2.38, 5.1);
  steelParts.cyl(0.28, 0.36, 1.15, 6, 0, 2.75, 7.4);
  crimsonStripe.cyl(0.12, 0.16, 1.65, 5, 0, 3.55, 8.05, { rx: Math.PI * 0.36 });
  goldParts.cyl(0.15, 0.10, 0.32, 5, 0, 3.92, 8.75, { rx: Math.PI * 0.36 });

  // Twin exhaust stacks, stern RHIB interceptor boat & aft winch/heli deck circle
  for (const sx of [-1.1, 1.1]) {
    steelParts.cyl(0.26, 0.32, 1.8, 6, sx, 4.8, -3.6, { rx: -0.22 });
    darkDeck.cyl(0.27, 0.27, 0.35, 6, sx, 5.65, -3.8, { rx: -0.22 });
  }
  crimsonStripe.box(1.6, 0.55, 3.6, 0, 2.55, -7.8);
  goldParts.cyl(1.45, 1.45, 0.05, 8, 0, 2.22, -10.0);

  // Stern flagpole + waving Cờ Tổ Quốc
  whiteHull.cyl(0.05, 0.08, 4.4, 5, 0, 4.2, -10.4);
  addWavingFlagMesh(ship, ctx, flagUniforms, `${name}Flag`, 0, 6.35, -10.4, 2.4, 1.6, Math.PI * 0.5, 1.0, true);

  commitPartsMesh(ship, whiteHull, `${name}Hull`, ctx.materials.whitePlaster, false, true);
  commitPartsMesh(ship, crimsonStripe, `${name}RedStripe`, ctx.materials.crimsonLacquer, false, false);
  commitPartsMesh(ship, blueTealStripe, `${name}BlueStripe`, ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, false);
  commitPartsMesh(ship, darkDeck, `${name}Deck`, ctx.materials.darkRoof, false, true);
  commitPartsMesh(ship, steelParts, `${name}Mast`, ctx.materials.granite, false, false);
  commitPartsMesh(ship, goldParts, `${name}Nozzle`, ctx.materials.gold, false, false);
  commitPartsMesh(ship, voidGlass, `${name}BridgeGlass`, ctx.materials.darkVoid, false, false);
  commitPartsMesh(ship, glowLights, `${name}NavLight`, ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false);

  return ship;
}

function buildTruongSaAndDK1Complex(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  southernBoats: JunkBoatMotion[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TruongSaAndDK1Complex';

  const tsX = 955.0;
  const tsZ = 555.0;
  const islandY = VIETNAM_WATER_LEVEL + 2.4;

  const reefMarble = new PartsBuilder();
  const sandParts = new PartsBuilder();
  const turfJade = new PartsBuilder();
  const graniteParts = new PartsBuilder();
  const stoneParts = new PartsBuilder();
  const whiteParts = new PartsBuilder();
  const lighthouseRedShadow = new PartsBuilder();
  const lighthouseWhiteShadow = new PartsBuilder();
  const ochreParts = new PartsBuilder();
  const crimsonParts = new PartsBuilder();
  const roofParts = new PartsBuilder();
  const darkAsphalt = new PartsBuilder();
  const goldParts = new PartsBuilder();
  const bronzeParts = new PartsBuilder();
  const woodParts = new PartsBuilder();
  const barkParts = new PartsBuilder();
  const glowParts = new PartsBuilder();
  const voidParts = new PartsBuilder();

  const buildings: BuildingFootprint[] = [];

  // 2A. Đảo Trường Sa Lớn & Song Tử Tây Coral Island (+2.4m above water, -3.5m seabed skirt)
  const tsReef = createSculptedCoralIslandGeometry(58.0, 46.0, -3.6, 0.15, 42.1, 22);
  tsReef.translate(tsX, 0, tsZ);
  reefMarble.add(tsReef);

  const tsIsland = createSculptedCoralIslandGeometry(46.0, 35.0, -3.5, islandY, 15.8, 22);
  tsIsland.translate(tsX, 0, tsZ);
  sandParts.add(tsIsland);

  const tsTurf = createSculptedCoralIslandGeometry(37.0, 27.5, islandY - 0.35, islandY + 0.06, 15.8, 18);
  tsTurf.translate(tsX, 0, tsZ);
  turfJade.add(tsTurf);

  // 2B. Cột Mốc Chủ Quyền Trường Sa & Parade Ground + Giant Waving Cờ Tổ Quốc at (952, 553)
  const pmX = 952.0;
  const pmZ = 553.0;
  buildings.push({ x: pmX, z: pmZ, r: 8.5 });

  graniteParts.box(16.5, 0.9, 13.5, pmX, islandY - 0.30, pmZ);
  crimsonParts.box(14.5, 0.08, 2.4, pmX, islandY + 0.16, pmZ + 4.2);
  // Ceremonial reviewing podium (*lễ đài*) & 4 parade-ground granite flag-salute bollards
  graniteParts.box(4.2, 0.55, 1.6, pmX + 4.8, islandY + 0.38, pmZ - 3.6);
  crimsonParts.box(3.8, 0.42, 1.2, pmX + 4.8, islandY + 0.85, pmZ - 3.6);
  goldParts.cyl(0.26, 0.26, 0.08, 6, pmX + 4.8, islandY + 0.88, pmZ - 2.98, { rx: Math.PI * 0.5 });
  for (const bx of [-7.4, 7.4]) {
    for (const bz of [-5.8, 5.8]) {
      graniteParts.cyl(0.22, 0.28, 1.1, 6, pmX + bx, islandY + 0.65, pmZ + bz);
      goldParts.sphere(0.15, 5, 4, pmX + bx, islandY + 1.25, pmZ + bz);
    }
  }
  // Iconic ornate Trường Sa Sovereignty Milestone (stepped pedestal + approach stairs + curved traditional roof collar + tapered obelisk)
  graniteParts.box(5.4, 0.65, 5.4, pmX, islandY + 0.35, pmZ - 1.5);
  for (let st = 0; st < 3; st++) {
    graniteParts.box(2.6, 0.22, 0.46, pmX, islandY + 0.14 + st * 0.22, pmZ + 1.48 - st * 0.34);
  }
  whiteParts.box(3.6, 0.55, 3.6, pmX, islandY + 0.95, pmZ - 1.5);
  const obCollar = createVietnameseCurvedRoofGeometry(3.8, 3.8, 2.1, 2.1, 0.65, 0.22, 4, 4);
  obCollar.translate(pmX, islandY + 1.22, pmZ - 1.5);
  roofParts.add(obCollar);
  whiteParts.cyl(0.75, 1.08, 6.8, 4, pmX, islandY + 5.15, pmZ - 1.5, { ry: Math.PI * 0.25 });
  const obCap = createVietnameseCurvedRoofGeometry(2.1, 2.1, 0.35, 0.35, 0.95, 0.20, 4, 4);
  obCap.translate(pmX, islandY + 8.52, pmZ - 1.5);
  roofParts.add(obCap);
  goldParts.cone(0.32, 0.85, 5, pmX, islandY + 9.85, pmZ - 1.5);

  for (let f = 0; f < 4; f++) {
    const rot = (f * Math.PI) / 2;
    const fx = pmX + Math.sin(rot) * 0.68;
    const fz = pmZ - 1.5 + Math.cos(rot) * 0.68;
    crimsonParts.cyl(0.42, 0.42, 0.10, 8, fx, islandY + 6.6, fz, { rx: Math.PI * 0.5, ry: rot });
    goldParts.cyl(0.28, 0.28, 0.14, 5, fx, islandY + 6.6, fz, { rx: Math.PI * 0.5, ry: rot });
    bronzeParts.box(0.95, 1.55, 0.10, fx, islandY + 4.3, fz, { ry: rot });
    goldParts.box(0.76, 0.09, 0.13, fx, islandY + 4.72, fz, { ry: rot });
    goldParts.box(0.68, 0.08, 0.13, fx, islandY + 4.36, fz, { ry: rot });
    goldParts.box(0.64, 0.08, 0.13, fx, islandY + 4.00, fz, { ry: rot });
  }

  // Wave 26: Trường Sa Sovereignty Monument Commemorative Floral Wreath Stands & Parade Ground Benches
  for (const w26WrSide of [-1, 1]) {
    const w26WrX = pmX + w26WrSide * 2.45;
    const w26WrZ = pmZ + 1.85;
    const w26Apex = new THREE.Vector3(w26WrX, islandY + 1.68, w26WrZ - 0.04);
    woodParts.strut(new THREE.Vector3(w26WrX - 0.36, islandY + 0.14, w26WrZ + 0.22), w26Apex, 0.032, 0.038, 4);
    woodParts.strut(new THREE.Vector3(w26WrX + 0.36, islandY + 0.14, w26WrZ + 0.22), w26Apex, 0.032, 0.038, 4);
    woodParts.strut(new THREE.Vector3(w26WrX, islandY + 0.14, w26WrZ - 0.42), w26Apex, 0.032, 0.038, 4);
    woodParts.box(0.62, 0.06, 0.07, w26WrX, islandY + 0.72, w26WrZ + 0.12);
    turfJade.cyl(0.46, 0.46, 0.10, 8, w26WrX, islandY + 1.18, w26WrZ + 0.08, { rx: Math.PI * 0.5 - 0.14 });
    woodParts.cyl(0.20, 0.20, 0.12, 6, w26WrX, islandY + 1.18, w26WrZ + 0.08, { rx: Math.PI * 0.5 - 0.14 });
    for (let w26Fl = 0; w26Fl < 6; w26Fl++) {
      const w26Fa = (w26Fl / 6) * Math.PI * 2;
      const w26Fx = w26WrX + Math.cos(w26Fa) * 0.34;
      const w26Fy = islandY + 1.18 + Math.sin(w26Fa) * 0.34;
      const w26Fz = w26WrZ + 0.14 - Math.sin(w26Fa) * 0.04;
      if (w26Fl % 2 === 0) {
        crimsonParts.sphere(0.11, 5, 3, w26Fx, w26Fy, w26Fz);
      } else {
        goldParts.sphere(0.10, 5, 3, w26Fx, w26Fy, w26Fz);
      }
    }
    crimsonParts.box(0.68, 0.13, 0.05, w26WrX, islandY + 0.98, w26WrZ + 0.16, { rz: -0.22 });
    goldParts.box(0.52, 0.04, 0.06, w26WrX, islandY + 0.98, w26WrZ + 0.18, { rz: -0.22 });
  }
  for (const w26PbOff of [-3.2, 3.2]) {
    const w26PbX = pmX + w26PbOff;
    const w26PbZ = pmZ + 5.85;
    for (const w26LegX of [-0.95, 0.95]) {
      graniteParts.box(0.22, 0.44, 0.64, w26PbX + w26LegX, islandY + 0.35, w26PbZ);
      graniteParts.box(0.10, 0.52, 0.10, w26PbX + w26LegX, islandY + 0.82, w26PbZ + 0.28, { rx: 0.16 });
    }
    woodParts.box(2.35, 0.08, 0.24, w26PbX, islandY + 0.59, w26PbZ - 0.14);
    woodParts.box(2.35, 0.08, 0.24, w26PbX, islandY + 0.59, w26PbZ + 0.14);
    woodParts.box(2.35, 0.28, 0.07, w26PbX, islandY + 0.96, w26PbZ + 0.31, { rx: 0.16 });
    goldParts.box(2.38, 0.04, 0.08, w26PbX, islandY + 1.10, w26PbZ + 0.33, { rx: 0.16 });
  }

  // Giant Flagpole & Waving Cờ Tổ Quốc on parade ground
  const gfpX = pmX - 5.2;
  const gfpZ = pmZ - 1.5;
  graniteParts.cyl(0.95, 1.25, 1.1, 8, gfpX, islandY + 0.45, gfpZ);
  whiteParts.cyl(0.11, 0.24, 17.5, 6, gfpX, islandY + 9.6, gfpZ);
  goldParts.sphere(0.22, 6, 4, gfpX, islandY + 18.45, gfpZ);
  addWavingFlagMesh(group, ctx, flagUniforms, 'TruongSaGiantNationalFlag', gfpX, islandY + 18.2, gfpZ, 4.8, 3.2, 0.15, 1.35, true);

  // 2C. Towering Red-and-White Striped Hải Đăng Song Tử Tây (28m tall! castShadow = true) at (934, 543)
  const stX = 934.0;
  const stZ = 543.0;
  buildings.push({ x: stX, z: stZ, r: 6.8 });

  graniteParts.cyl(3.8, 4.4, 2.8, 8, stX, islandY + 0.4, stZ);
  // 6 alternating crisp red & white cylindrical bands rising to 25.0m + 3.4m lantern gallery = 28.4m tall!
  const numBands = 6;
  const bandH = 3.85;
  for (let b = 0; b < numBands; b++) {
    const by0 = islandY + 1.8 + b * bandH;
    const rBot = THREE.MathUtils.lerp(2.75, 1.72, b / numBands);
    const rTop = THREE.MathUtils.lerp(2.75, 1.72, (b + 1) / numBands);
    const target = b % 2 === 0 ? lighthouseRedShadow : lighthouseWhiteShadow;
    target.cyl(rTop, rBot, bandH + 0.04, 8, stX, by0 + bandH * 0.5, stZ);
  }
  const stGalY = islandY + 1.8 + numBands * bandH; // islandY + 24.9m
  // Attached lighthouse keeper's base house (+Z side) & solar power array (Song Tử Tây runs on solar)
  whiteParts.box(4.8, 3.2, 3.6, stX + 0.4, islandY + 2.6, stZ + 4.2);
  roofParts.box(5.3, 0.32, 4.1, stX + 0.4, islandY + 4.35, stZ + 4.2, { rx: 0.16 });
  voidParts.box(1.15, 1.75, 0.22, stX + 0.4, islandY + 2.2, stZ + 6.02);
  turfJade.box(3.4, 0.08, 1.5, stX + 4.6, islandY + 1.35, stZ + 2.8, { rx: 0.42 });
  graniteParts.cyl(0.06, 0.07, 1.2, 4, stX + 4.6, islandY + 0.65, stZ + 2.8);
  // Wave 29: Song Tử Tây Lighthouse 2nd Solar Panel Array Row & Weatherproof Inverter Box
  turfJade.box(3.4, 0.08, 1.5, stX + 4.6, islandY + 1.35, stZ + 4.85, { rx: 0.42 });
  whiteParts.box(3.48, 0.05, 1.56, stX + 4.6, islandY + 1.32, stZ + 4.85, { rx: 0.42 });
  graniteParts.cyl(0.06, 0.07, 1.2, 4, stX + 4.6, islandY + 0.65, stZ + 4.85);
  whiteParts.box(0.95, 1.05, 0.68, stX + 3.2, islandY + 0.68, stZ + 5.75);
  ochreParts.box(1.04, 0.08, 0.76, stX + 3.2, islandY + 1.24, stZ + 5.75);
  // Ascending spiral recessed window slits up the red/white striped shaft
  for (let w = 0; w < 5; w++) {
    const wa = w * 1.15;
    const wy = islandY + 5.2 + w * 4.0;
    const rAtW = THREE.MathUtils.lerp(2.62, 1.82, w / 5);
    whiteParts.box(0.62, 1.18, 0.16, stX + Math.sin(wa) * (rAtW - 0.04), wy, stZ + Math.cos(wa) * (rAtW - 0.04), { ry: wa });
    voidParts.box(0.42, 0.96, 0.24, stX + Math.sin(wa) * rAtW, wy, stZ + Math.cos(wa) * rAtW, { ry: wa });
  }
  whiteParts.cyl(2.65, 1.82, 0.55, 8, stX, stGalY, stZ);
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    whiteParts.cyl(0.05, 0.05, 1.1, 4, stX + Math.cos(a) * 2.45, stGalY + 0.80, stZ + Math.sin(a) * 2.45);
    whiteParts.strut(
      new THREE.Vector3(stX + Math.cos(a) * 1.72, stGalY - 0.92, stZ + Math.sin(a) * 1.72),
      new THREE.Vector3(stX + Math.cos(a) * 2.52, stGalY - 0.10, stZ + Math.sin(a) * 2.52),
      0.08,
      0.08,
      4
    );
  }
  whiteParts.cyl(2.48, 2.48, 0.08, 8, stX, stGalY + 1.32, stZ);
  glowParts.cyl(1.32, 1.32, 2.55, 8, stX, stGalY + 1.55, stZ);
  // Lantern room vertical steel mullions & brass Fresnel optics rings
  goldParts.cyl(1.36, 1.36, 0.08, 8, stX, stGalY + 1.15, stZ);
  goldParts.cyl(1.36, 1.36, 0.08, 8, stX, stGalY + 1.95, stZ);
  for (let m = 0; m < 8; m++) {
    const ma = (m / 8) * Math.PI * 2;
    whiteParts.cyl(0.05, 0.05, 2.6, 4, stX + Math.cos(ma) * 1.38, stGalY + 1.55, stZ + Math.sin(ma) * 1.38);
  }
  crimsonParts.sphere(1.52, 8, 5, stX, stGalY + 2.85, stZ, [1.0, 0.82, 1.0]);
  goldParts.sphere(0.34, 6, 4, stX, stGalY + 4.10, stZ);
  goldParts.cyl(0.05, 0.08, 1.6, 4, stX, stGalY + 5.0, stZ);
  glowParts.sphere(0.16, 5, 4, stX, stGalY + 5.85, stZ);

  // 2D. Chùa Trường Sa at (967, 543) facing West (-X, rotY = -Math.PI * 0.5) toward the Vietnamese Mainland!
  const chuaX = 967.0;
  const chuaZ = 543.0;
  const chuaYaw = -Math.PI * 0.5;
  buildings.push({ x: chuaX, z: chuaZ, r: 9.2 });

  graniteParts.box(11.6, 1.5, 13.8, chuaX, islandY - 0.05, chuaZ, { ry: chuaYaw });
  ochreParts.box(8.8, 4.2, 9.6, chuaX, islandY + 2.75, chuaZ, { ry: chuaYaw });
  // Carved triple *cửa bức bàn* wooden doors, granite approach stairs & dragon cheek walls facing West (-X)
  for (const dz of [-2.1, 0, 2.1]) {
    woodParts.box(0.22, 2.85, 1.45, chuaX - 4.82, islandY + 2.15, chuaZ + dz);
    goldParts.box(0.26, 0.72, 1.15, chuaX - 4.84, islandY + 3.05, chuaZ + dz);
  }
  graniteParts.box(1.35, 0.65, 4.2, chuaX - 6.1, islandY + 0.35, chuaZ);
  // Forecourt bronze incense cauldron (*đỉnh đồng*) & lotus pedestal beneath Quan Âm statue
  graniteParts.cyl(0.85, 1.05, 0.45, 6, chuaX - 8.4, islandY + 0.25, chuaZ + 3.4);
  bronzeParts.cyl(0.52, 0.42, 0.92, 6, chuaX - 8.4, islandY + 0.92, chuaZ + 3.4);
  graniteParts.cyl(1.65, 1.95, 0.68, 8, chuaX - 6.8, islandY + 0.34, chuaZ);
  goldParts.cyl(1.15, 1.38, 0.24, 8, chuaX - 6.8, islandY + 0.72, chuaZ);
  // Traditional Tam Quan (Three-Arch Entrance Gate) facing West in front of Chùa Trường Sa
  const tqX = chuaX - 10.6;
  const tqZ = chuaZ;
  for (const lz of [-3.4, -1.25, 1.25, 3.4]) {
    const isInner = Math.abs(lz) < 2.0;
    const ph = isInner ? 4.4 : 3.2;
    crimsonParts.cyl(0.18, 0.22, ph, 6, tqX, islandY + ph * 0.5, tqZ + lz);
    graniteParts.box(0.58, 0.42, 0.58, tqX, islandY + 0.20, tqZ + lz);
  }
  // Tam Quan cross-lintel tie-beams, gilded *hoành phi* name plaque & low granite wing walls
  crimsonParts.box(0.28, 0.34, 2.55, tqX, islandY + 3.95, tqZ);
  goldParts.box(0.34, 0.62, 1.68, tqX, islandY + 3.82, tqZ);
  crimsonParts.box(0.38, 0.44, 1.48, tqX, islandY + 3.82, tqZ);
  for (const sz of [-2.35, 2.35]) {
    crimsonParts.box(0.24, 0.28, 2.15, tqX, islandY + 2.85, tqZ + sz);
    graniteParts.box(0.34, 0.85, 1.72, tqX, islandY + 0.42, tqZ + sz);
    goldParts.sphere(0.15, 5, 4, tqX, islandY + 4.18, tqZ + sz);
  }
  const tqRoofMain = createVietnameseCurvedRoofGeometry(2.6, 3.6, 0.55, 1.4, 1.25, 0.24, 4, 4);
  tqRoofMain.translate(tqX, islandY + 4.35, tqZ);
  roofParts.add(tqRoofMain);
  for (const sz of [-2.35, 2.35]) {
    const tqRoofSide = createVietnameseCurvedRoofGeometry(2.1, 2.5, 0.45, 0.9, 0.95, 0.22, 4, 4);
    tqRoofSide.translate(tqX, islandY + 3.15, tqZ + sz);
    roofParts.add(tqRoofSide);
  }
  goldParts.box(0.24, 0.24, 1.5, tqX, islandY + 5.65, tqZ);

  // Forecourt Bronze Bell Stand (*Gác Chuông Đồng*) symmetrically opposite the bronze incense cauldron
  const bsBellX = chuaX - 8.4;
  const bsBellZ = chuaZ - 3.6;
  graniteParts.box(2.35, 0.42, 2.35, bsBellX, islandY + 0.20, bsBellZ);
  for (const sx of [-0.82, 0.82]) {
    for (const sz of [-0.82, 0.82]) {
      crimsonParts.cyl(0.10, 0.12, 2.75, 5, bsBellX + sx, islandY + 1.75, bsBellZ + sz);
    }
  }
  woodParts.box(1.85, 0.16, 0.18, bsBellX, islandY + 2.95, bsBellZ);
  bronzeParts.cyl(0.34, 0.52, 1.05, 8, bsBellX, islandY + 2.05, bsBellZ);
  goldParts.cyl(0.14, 0.14, 0.24, 5, bsBellX, islandY + 2.68, bsBellZ);
  goldParts.cyl(0.54, 0.54, 0.08, 8, bsBellX, islandY + 1.56, bsBellZ);
  const bellRoof = createVietnameseCurvedRoofGeometry(2.65, 2.65, 0.45, 0.45, 1.05, 0.22, 4, 4);
  bellRoof.translate(bsBellX, islandY + 3.12, bsBellZ);
  roofParts.add(bellRoof);
  goldParts.sphere(0.16, 5, 4, bsBellX, islandY + 4.24, bsBellZ);
  // Crimson ironwood pillars along mainland-facing West portico
  for (let p = -2; p <= 2; p++) {
    woodParts.cyl(0.19, 0.22, 4.2, 6, chuaX - 5.1, islandY + 2.75, chuaZ + p * 2.25);
  }
  const chuaRoof1 = createHueImperialHipRoofGeometry(12.2, 14.2, 6.6, 8.2, 2.1, 0.38, 4, 3, true);
  transformGeometryXYZ(chuaRoof1, chuaX, islandY + 4.75, chuaZ, chuaYaw);
  const chuaRoof2 = createHueImperialHipRoofGeometry(7.8, 9.8, 3.8, 1.2, 2.0, 0.35, 4, 3, true);
  transformGeometryXYZ(chuaRoof2, chuaX, islandY + 6.75, chuaZ, chuaYaw);
  roofParts.add(chuaRoof1, chuaRoof2);

  const chuaFinials = createRoofFinialSetParts(chuaX, islandY + 8.72, chuaZ, 4.4, chuaYaw, 0.85, true);
  crimsonParts.add(...chuaFinials.mainParts);
  goldParts.add(...chuaFinials.goldParts);

  // Jade Buddha / Quan Âm statue in Chùa Trường Sa forecourt facing West toward the mainland
  const tsDeity = createSculptedDeityParts(chuaX - 6.8, islandY + 0.72, chuaZ, chuaYaw, 0.95, 'quanam', {
    simpleQuanAm: true
  });
  reefMarble.add(...tsDeity.bodyParts);
  goldParts.add(...tsDeity.accentParts);

  // 2E. Nhà Văn Hóa Thủ Đô at (941, 563)
  const nvhX = 941.0;
  const nvhZ = 563.0;
  buildings.push({ x: nvhX, z: nvhZ, r: 8.5 });

  graniteParts.box(13.6, 1.3, 9.2, nvhX, islandY - 0.1, nvhZ);
  whiteParts.box(12.4, 6.8, 8.0, nvhX, islandY + 3.9, nvhZ);
  ochreParts.box(12.6, 0.35, 8.2, nvhX, islandY + 3.9, nvhZ);
  for (let c = -2; c <= 2; c++) {
    whiteParts.cyl(0.18, 0.20, 6.8, 6, nvhX + c * 2.6, islandY + 3.9, nvhZ - 4.15);
    voidParts.box(1.2, 1.8, 0.22, nvhX + c * 2.6, islandY + 2.2, nvhZ - 3.95);
    voidParts.box(1.2, 1.8, 0.22, nvhX + c * 2.6, islandY + 5.5, nvhZ - 3.95);
  }
  const nvhRoof = createHueImperialHipRoofGeometry(13.8, 9.6, 6.8, 1.4, 2.35, 0.32, 4, 3, true);
  nvhRoof.translate(nvhX, islandY + 7.25, nvhZ);
  roofParts.add(nvhRoof);

  // 2F. Island Airstrip Strip along South-Southeast edge (955, 574)
  const rwX = 955.0;
  const rwZ = 574.5;
  const rwYaw = 0.14;
  buildings.push({ x: rwX - 14.0, z: rwZ - 2.0, r: 7.0 });
  buildings.push({ x: rwX, z: rwZ, r: 7.0 });
  buildings.push({ x: rwX + 14.0, z: rwZ + 2.0, r: 7.0 });

  graniteParts.box(50.0, 1.2, 8.6, rwX, islandY - 0.42, rwZ, { ry: rwYaw });
  darkAsphalt.box(48.0, 0.18, 7.4, rwX, islandY + 0.18, rwZ, { ry: rwYaw });
  for (let d = -4; d <= 4; d++) {
    const dx = rwX + Math.cos(rwYaw) * (d * 4.6);
    const dz = rwZ - Math.sin(rwYaw) * (d * 4.6);
    whiteParts.box(2.4, 0.06, 0.24, dx, islandY + 0.28, dz, { ry: rwYaw });
  }
  // Windsock beside runway threshold
  whiteParts.cyl(0.05, 0.07, 3.8, 4, rwX + 22.0, islandY + 2.0, rwZ - 4.5);
  crimsonParts.cone(0.24, 1.2, 5, rwX + 22.6, islandY + 3.7, rwZ - 4.5, { rz: -Math.PI * 0.45 });

  // 2F-bis. Wind-Shielded Island Vegetable Greenhouse (*Vườn Rau Trường Sa*) & Island Solar Streetlamps
  const w24GhX = 973.5;
  const w24GhZ = 555.5;
  buildings.push({ x: w24GhX + 1.0, z: w24GhZ, r: 4.5 });
  // Low concrete salt-spray windbreak foundation & perimeter curb walls
  graniteParts.box(6.4, 0.32, 4.2, w24GhX, islandY + 0.04, w24GhZ);
  for (const w24Sz of [-2.02, 2.02]) {
    graniteParts.box(6.4, 0.68, 0.18, w24GhX, islandY + 0.52, w24GhZ + w24Sz);
  }
  for (const w24Sx of [-3.12, 3.12]) {
    graniteParts.box(0.18, 0.68, 4.0, w24GhX + w24Sx, islandY + 0.52, w24GhZ);
  }
  // 6 galvanized tubular steel greenhouse posts + top tie-beams & pitched shade-net roof slopes
  for (const w24Px of [-2.95, 0, 2.95]) {
    for (const w24Pz of [-1.92, 1.92]) {
      whiteParts.cyl(0.055, 0.065, 2.05, 4, w24GhX + w24Px, islandY + 1.22, w24GhZ + w24Pz);
    }
  }
  whiteParts.box(6.15, 0.09, 0.09, w24GhX, islandY + 2.24, w24GhZ - 1.92);
  whiteParts.box(6.15, 0.09, 0.09, w24GhX, islandY + 2.24, w24GhZ + 1.92);
  whiteParts.box(6.25, 0.10, 0.10, w24GhX, islandY + 2.74, w24GhZ);
  darkAsphalt.box(6.35, 0.06, 2.28, w24GhX, islandY + 2.50, w24GhZ - 1.02, { rx: -0.24 });
  darkAsphalt.box(6.35, 0.06, 2.28, w24GhX, islandY + 2.50, w24GhZ + 1.02, { rx: 0.24 });
  // 2 raised island soil planter beds lush with green *rau muống / cải xanh* rows
  for (const w24Bz of [-0.95, 0.95]) {
    woodParts.box(5.2, 0.42, 1.25, w24GhX, islandY + 0.42, w24GhZ + w24Bz);
    for (const w24Vx of [-1.65, 0, 1.65]) {
      turfJade.box(1.38, 0.28, 0.96, w24GhX + w24Vx, islandY + 0.72, w24GhZ + w24Bz);
    }
  }
  // Freshwater rainwater cistern tank beside greenhouse for drip irrigation
  const w24TkX = w24GhX + 4.15;
  const w24TkZ = w24GhZ - 1.15;
  graniteParts.cyl(0.62, 0.68, 0.28, 6, w24TkX, islandY + 0.14, w24TkZ);
  whiteParts.cyl(0.56, 0.56, 1.48, 6, w24TkX, islandY + 1.02, w24TkZ);
  graniteParts.cyl(0.58, 0.56, 0.12, 6, w24TkX, islandY + 1.80, w24TkZ);

  // 4 Trường Sa Island Solar Streetlamps (*đèn năng lượng mặt trời*) lining main walkways
  const w24SolarLamps: Array<[number, number, number]> = [
    [943.5, 545.5, 0.4],
    [961.0, 546.5, -0.3],
    [961.0, 559.5, -1.2],
    [949.5, 562.5, 0.0]
  ];
  for (let w24i = 0; w24i < w24SolarLamps.length; w24i++) {
    const [w24Lx, w24Lz, w24Lyaw] = w24SolarLamps[w24i];
    const w24Cos = Math.cos(w24Lyaw);
    const w24Sin = Math.sin(w24Lyaw);
    graniteParts.cyl(0.18, 0.24, 0.36, 5, w24Lx, islandY + 0.18, w24Lz);
    whiteParts.cyl(0.055, 0.08, 3.65, 4, w24Lx, islandY + 2.15, w24Lz);
    whiteParts.box(0.85, 0.07, 0.07, w24Lx + w24Cos * 0.38, islandY + 3.86, w24Lz - w24Sin * 0.38, { ry: w24Lyaw });
    glowParts.box(0.42, 0.10, 0.22, w24Lx + w24Cos * 0.72, islandY + 3.78, w24Lz - w24Sin * 0.72, { ry: w24Lyaw });
    turfJade.box(0.76, 0.06, 0.52, w24Lx, islandY + 4.08, w24Lz, { rx: 0.34, ry: w24Lyaw });
    whiteParts.box(0.82, 0.04, 0.56, w24Lx, islandY + 4.05, w24Lz, { rx: 0.34, ry: w24Lyaw });
  }

  // 2G. Sheltered Harbor Basin Breakwater at (988, 548) + Song Tử Tây Coastal Breakwater Tetrapods + Patrol Ship
  // L-shaped granite harbor mole rising from -4.0m seabed to +1.8m
  graniteParts.box(26.0, 5.8, 3.8, 991.0, -1.1, 536.0);
  graniteParts.box(3.8, 5.8, 18.0, 1003.0, -1.1, 544.0);
  glowParts.sphere(0.28, 5, 4, 1003.0, 2.4, 552.5);
  crimsonParts.cyl(0.18, 0.24, 0.85, 5, 1003.0, 2.0, 552.5);

  // Interlocking 4-legged concrete coastal breakwater tetrapods armoring the harbor mole & Song Tử Tây seaward shore
  const tetrapodCoords: Array<[number, number, number]> = [
    [981.5, 533.6, 0.2], [986.2, 533.5, 1.1], [991.0, 533.6, 2.0], [995.8, 533.5, 0.6],
    [1000.6, 533.6, 1.7], [1005.2, 535.4, 0.9], [1005.4, 540.2, 2.3], [1005.3, 545.2, 0.4],
    [1005.4, 550.0, 1.5], [917.5, 536.5, 0.5], [920.8, 533.2, 1.8], [915.2, 540.5, 2.6]
  ];
  const tetDirs: Array<[number, number, number]> = [
    [0.0, 1.0, 0.0],
    [0.94, -0.33, 0.0],
    [-0.47, -0.33, 0.81],
    [-0.47, -0.33, -0.81]
  ];
  for (let tp = 0; tp < tetrapodCoords.length; tp++) {
    const [tpx, tpz, tYaw] = tetrapodCoords[tp];
    const center = new THREE.Vector3(tpx, VIETNAM_WATER_LEVEL + 0.55, tpz);
    const cosT = Math.cos(tYaw);
    const sinT = Math.sin(tYaw);
    for (let leg = 0; leg < 4; leg++) {
      const [dx, dy, dz] = tetDirs[leg];
      const wx = dx * cosT - dz * sinT;
      const wz = dx * sinT + dz * cosT;
      const tip = new THREE.Vector3(center.x + wx * 1.18, center.y + dy * 1.18, center.z + wz * 1.18);
      stoneParts.strut(center, tip, 0.22, 0.34, 4);
    }
  }

  // White Tàu Kiểm Ngư / Cảnh Sát Biển Việt Nam patrol ship stationed & patrolling off Trường Sa harbor
  const csbShip = buildPatrolShipGroup(ctx, flagUniforms, 'TruongSaPatrolShip');
  csbShip.position.set(1008.0, VIETNAM_WATER_LEVEL, 532.0);
  csbShip.rotation.y = 0.65;
  group.add(csbShip);
  southernBoats.push({
    group: csbShip,
    centerX: 1012.0,
    centerZ: 528.0,
    radiusX: 18.0,
    radiusZ: 14.0,
    speed: 0.18,
    phase: 1.9
  });

  // 2 Vietnamese Fishing Trawlers with waving red Cờ Tổ Quốc moored in sheltered harbor basin
  for (let t = 0; t < 2; t++) {
    const tx = 989.0 + t * 6.8;
    const tz = 546.0 + t * 5.2;
    const tyaw = 0.25 - t * 0.38;
    const mTop = appendGheBauBoatParts(woodParts, ochreParts, whiteParts, voidParts, tx, VIETNAM_WATER_LEVEL, tz, tyaw, 11.4, 3.1, false);
    // Blue-green cabin trim on offshore fishing trawler
    turfJade.box(1.9, 1.35, 2.8, tx, VIETNAM_WATER_LEVEL + 1.45, tz - 0.6, { ry: tyaw });
    addWavingFlagMesh(group, ctx, flagUniforms, `TruongSaTrawlerFlag${t}`, mTop.mastTopX, mTop.mastTopY, mTop.mastTopZ, 1.8, 1.2, tyaw, 0.85, true);
  }

  // Lush *Bàng Vuông / Phong Ba* trees along island perimeter (>= 5.5m clear of buildings)
  const tsTrees: Array<[number, number, number]> = [
    [926.0, 556.0, 1.05],
    [938.0, 532.0, 0.95],
    [953.0, 535.0, 1.12],
    [978.0, 536.0, 0.98],
    [983.5, 560.5, 1.04],
    [966.0, 560.0, 0.92],
    [928.0, 568.0, 0.96]
  ];
  // Wave 29: 2 Land-Based Trường Sa Island Wind-Solar Hybrid Power Turbines (*Trụ Điện Gió Đảo Trường Sa*)
  const w29Turbines: Array<[number, number, number]> = [
    [926.5, 548.5, 0.35],
    [978.5, 566.5, -0.45]
  ];
  for (let w29Ti = 0; w29Ti < w29Turbines.length; w29Ti++) {
    const [w29Tx, w29Tz, w29Tyaw] = w29Turbines[w29Ti];
    buildings.push({ x: w29Tx, z: w29Tz, r: 2.2 });
    const w29Tcos = Math.cos(w29Tyaw);
    const w29Tsin = Math.sin(w29Tyaw);
    graniteParts.cyl(1.15, 1.38, 0.52, 6, w29Tx, islandY + 0.22, w29Tz);
    whiteParts.cyl(0.14, 0.28, 10.6, 6, w29Tx, islandY + 5.75, w29Tz);
    whiteParts.box(0.46, 0.48, 1.12, w29Tx, islandY + 11.15, w29Tz, { ry: w29Tyaw });
    crimsonParts.cone(0.24, 0.52, 5, w29Tx + w29Tsin * 0.68, islandY + 11.15, w29Tz + w29Tcos * 0.68, {
      rx: Math.PI * 0.5,
      ry: w29Tyaw
    });
    glowParts.sphere(0.12, 4, 3, w29Tx, islandY + 11.52, w29Tz);
    for (let w29Bl = 0; w29Bl < 3; w29Bl++) {
      const w29Ba = (w29Bl / 3) * Math.PI * 2 + 0.4 + w29Ti * 0.6;
      const w29BlocalX = Math.sin(w29Ba) * 1.48;
      const w29BlocalY = Math.cos(w29Ba) * 1.48;
      whiteParts.box(
        0.16,
        3.05,
        0.07,
        w29Tx + w29BlocalX * w29Tcos + w29Tsin * 0.62,
        islandY + 11.15 + w29BlocalY,
        w29Tz - w29BlocalX * w29Tsin + w29Tcos * 0.62,
        { ry: w29Tyaw, rz: -w29Ba }
      );
    }
    ochreParts.box(0.86, 0.96, 0.64, w29Tx + 1.35, islandY + 0.56, w29Tz);
  }
  for (let i = 0; i < tsTrees.length; i++) {
    const [tx, tz, sc] = tsTrees[i];
    addCoastalIslandTree(barkParts, turfJade, tx, islandY - 0.12, tz, sc, 1400 + i * 23, buildings, 5.5);
  }

  // 2H. TWO NHÀ GIÀN DK1 GIỮA BIỂN ĐÔNG at (1035, 575) & (1055, 590) + Connecting Steel Catwalk Bridge!
  const dk1Gold = new PartsBuilder();
  const dk1Marble = new PartsBuilder();

  const dk1MainFlag = appendOffshoreDK1Platform(
    dk1Gold,
    graniteParts,
    whiteParts,
    ochreParts,
    darkAsphalt,
    turfJade,
    crimsonParts,
    dk1Marble,
    glowParts,
    voidParts,
    1035.0,
    575.0,
    14.0,
    8,
    3,
    true
  );
  addWavingFlagMesh(
    group,
    ctx,
    flagUniforms,
    'DK1MainFlag',
    dk1MainFlag.flagX,
    dk1MainFlag.flagTopY,
    dk1MainFlag.flagZ,
    3.0,
    2.0,
    0.3,
    1.2,
    true
  );

  const dk1SubFlag = appendOffshoreDK1Platform(
    dk1Gold,
    graniteParts,
    whiteParts,
    ochreParts,
    darkAsphalt,
    turfJade,
    crimsonParts,
    dk1Marble,
    glowParts,
    voidParts,
    1055.0,
    590.0,
    11.2,
    6,
    2,
    false
  );
  addWavingFlagMesh(
    group,
    ctx,
    flagUniforms,
    'DK1SubFlag',
    dk1SubFlag.flagX,
    dk1SubFlag.flagTopY,
    dk1SubFlag.flagZ,
    2.6,
    1.75,
    0.3,
    1.15,
    true
  );

  // Connecting Steel Catwalk Warren-Truss Bridge between (1035, 575) and (1055, 590) at y = +11.35m
  const pA = new THREE.Vector3(1039.8, 11.35, 578.6);
  const pB = new THREE.Vector3(1050.8, 11.35, 586.85);
  const bridgeVec = new THREE.Vector3().subVectors(pB, pA);
  const bridgeLen = bridgeVec.length() + 1.2;
  const bridgeMid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
  const bridgeYaw = Math.atan2(bridgeVec.x, bridgeVec.z);

  graniteParts.box(1.9, 0.24, bridgeLen, bridgeMid.x, bridgeMid.y, bridgeMid.z, { ry: bridgeYaw });
  const perpX = Math.cos(bridgeYaw) * 0.92;
  const perpZ = -Math.sin(bridgeYaw) * 0.92;
  for (const side of [-1, 1]) {
    const topStart = new THREE.Vector3(pA.x + side * perpX, pA.y + 1.18, pA.z + side * perpZ);
    const topEnd = new THREE.Vector3(pB.x + side * perpX, pB.y + 1.18, pB.z + side * perpZ);
    const midStart = new THREE.Vector3(pA.x + side * perpX, pA.y + 0.62, pA.z + side * perpZ);
    const midEnd = new THREE.Vector3(pB.x + side * perpX, pB.y + 0.62, pB.z + side * perpZ);
    const botStart = new THREE.Vector3(pA.x + side * perpX, pA.y + 0.05, pA.z + side * perpZ);
    const botEnd = new THREE.Vector3(pB.x + side * perpX, pB.y + 0.05, pB.z + side * perpZ);
    dk1Gold.strut(topStart, topEnd, 0.06, 0.06, 4);
    dk1Gold.strut(midStart, midEnd, 0.04, 0.04, 4);
    dk1Gold.strut(botStart, botEnd, 0.06, 0.06, 4);
    // Mid-span orange life-ring mounted on catwalk handrail
    const lrPos = new THREE.Vector3().lerpVectors(midStart, midEnd, 0.5);
    crimsonParts.cyl(0.30, 0.30, 0.09, 6, lrPos.x + side * perpX * 0.14, lrPos.y + 0.15, lrPos.z + side * perpZ * 0.14, { rz: Math.PI * 0.5, ry: bridgeYaw });
    const segs = 7;
    for (let k = 0; k < segs; k++) {
      const b0 = new THREE.Vector3().lerpVectors(botStart, botEnd, k / segs);
      const tMid = new THREE.Vector3().lerpVectors(topStart, topEnd, (k + 0.5) / segs);
      const b1 = new THREE.Vector3().lerpVectors(botStart, botEnd, (k + 1) / segs);
      dk1Gold.strut(b0, tMid, 0.045, 0.045, 4);
      dk1Gold.strut(tMid, b1, 0.045, 0.045, 4);
    }
  }

  commitPartsMesh(group, reefMarble, 'TruongSaCoralReefAndStatues', ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true, 3.2);
  commitPartsMesh(group, sandParts, 'TruongSaCoralSandIsland', ctx.materials.ochreSand ?? ctx.materials.yellowOchrePlaster, false, true, 3.0);
  commitPartsMesh(group, turfJade, 'TruongSaGreenIslandAndSolar', ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true, 2.6);
  commitPartsMesh(group, graniteParts, 'TruongSaGraniteAndSteel', ctx.materials.granite, false, true, 2.4);
  commitPartsMesh(group, stoneParts, 'TruongSaStoneWork', ctx.materials.stone, false, true, 2.4);
  commitPartsMesh(group, lighthouseRedShadow, 'SongTuTayLighthouseRedBands', ctx.materials.crimsonLacquer, true, true);
  commitPartsMesh(group, lighthouseWhiteShadow, 'SongTuTayLighthouseWhiteBands', ctx.materials.whitePlaster, true, true);
  commitPartsMesh(group, whiteParts, 'TruongSaAndDK1WhiteModules', ctx.materials.whitePlaster, false, true, 2.4);
  commitPartsMesh(group, ochreParts, 'TruongSaAndDK1YellowModules', ctx.materials.yellowOchrePlaster, false, true, 2.4);
  commitPartsMesh(group, crimsonParts, 'TruongSaAndDK1CrimsonTrim', ctx.materials.crimsonLacquer, false, true);
  commitPartsMesh(group, roofParts, 'TruongSaCurvedTerracottaRoofs', ctx.materials.terracottaRoof, false, true);
  commitPartsMesh(group, darkAsphalt, 'TruongSaRunwayAndHelipad', ctx.materials.darkRoof, false, true);
  commitPartsMesh(group, goldParts, 'TruongSaGoldFinials', ctx.materials.gold, false, false);
  commitPartsMesh(group, dk1Gold, 'DK1YellowOrangeSteelJackets', ctx.materials.gold, false, true);
  commitPartsMesh(group, dk1Marble, 'DK1RadomeDomes', ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  commitPartsMesh(group, bronzeParts, 'TruongSaBronzePlaques', ctx.materials.bronze, false, true);
  commitPartsMesh(group, woodParts, 'TruongSaTimberAndTrawlers', ctx.materials.darkWood, false, true);
  commitPartsMesh(group, barkParts, 'TruongSaBangVuongTrunks', ctx.materials.bark, false, true);
  commitPartsMesh(group, glowParts, 'TruongSaAndDK1Beacons', ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false);
  commitPartsMesh(group, voidParts, 'TruongSaAndDK1Windows', ctx.materials.darkVoid, false, false);

  tagMotifIds(group, ['TS-SOVEREIGNTY-OBELISK', 'TS-SONG-TU-TAY-LIGHTHOUSE', 'TS-CHUA-TRUONG-SA', 'TS-PATROL-SHIP', 'DK1-OFFSHORE-PLATFORMS']);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: tsX, z: tsZ, r: 66.0 });
  ctx.exclusionCircles.push({ x: 1045.0, z: 582.0, r: 34.0 });
  return group;
}

// ============================================================================
// 3. SÀI GÒN HIỆN ĐẠI (`SaigonModernSkylineComplex`) centered at (560, 320)
//    Landmark 81 (545, 295) + Vinhomes Central Park + Cầu Ba Son & Bến Bạch Đằng (580, 345)
// ============================================================================
function appendSleekYacht(
  marbleHull: PartsBuilder,
  darkGlass: PartsBuilder,
  woodDeck: PartsBuilder,
  goldTrim: PartsBuilder,
  cx: number,
  waterY: number,
  cz: number,
  yaw: number,
  len = 11.5
): void {
  const beam = len * 0.28;
  const hull = new THREE.BoxGeometry(beam, 1.2, len, 4, 2, 8);
  const hp = hull.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i);
    let y = hp.getY(i);
    const z = hp.getZ(i);
    const tz = z / (len * 0.5);
    const ty = (y + 0.6) / 1.2;
    const planW = tz > 0 ? Math.pow(Math.max(0.05, 1.0 - Math.pow(tz, 1.5)), 0.58) : 0.88 + 0.12 * (1.0 + tz);
    x *= planW * (0.58 + 0.42 * ty);
    y += tz > 0 ? 0.35 * tz * tz : 0.05;
    hp.setXYZ(i, x, y, z);
  }
  hull.computeVertexNormals();
  transformGeometryXYZ(hull, cx, waterY + 0.42, cz, yaw);
  marbleHull.add(hull);

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const at = (lx: number, ly: number, lz: number): [number, number, number] => [
    cx + lx * cosY + lz * sinY,
    waterY + ly,
    cz - lx * sinY + lz * cosY
  ];

  const [dx, dy, dz] = at(0, 0.98, -len * 0.12);
  woodDeck.box(beam * 0.78, 0.08, len * 0.68, dx, dy, dz, { ry: yaw });
  const [sx, sy, sz] = at(0, 1.45, -len * 0.04);
  marbleHull.box(beam * 0.68, 0.85, len * 0.44, sx, sy, sz, { ry: yaw });
  const [gx, gy, gz] = at(0, 1.52, len * 0.02);
  darkGlass.box(beam * 0.72, 0.44, len * 0.36, gx, gy, gz, { ry: yaw });
  const [fx, fy, fz] = at(0, 2.08, -len * 0.12);
  marbleHull.box(beam * 0.55, 0.14, len * 0.28, fx, fy, fz, { ry: yaw });
  goldTrim.cyl(0.04, 0.05, 0.9, 4, fx, fy + 0.48, fz);
}

function buildSaigonModernSkylineComplex(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  southernBoats: JunkBoatMotion[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SaigonModernSkylineComplex';

  const lmX = 545.0;
  const lmZ = 295.0;
  const lmBaseY = Math.max(
    1.35,
    ctx.getHeight(lmX, lmZ),
    ctx.getHeight(lmX - 16, lmZ - 16),
    ctx.getHeight(lmX + 16, lmZ - 16),
    ctx.getHeight(lmX - 16, lmZ + 16),
    ctx.getHeight(lmX + 16, lmZ + 16)
  );

  const bdX = 562.0;
  const bdZ = 350.0;
  const bdBaseY = Math.max(
    1.35,
    ctx.getHeight(bdX, bdZ),
    ctx.getHeight(bdX - 12, bdZ - 12),
    ctx.getHeight(bdX + 8, bdZ + 12)
  );

  // Check river channel terrain elevation along Sông Sài Gòn (x ~ 586..602)
  const riverSampleY = Math.min(
    ctx.getHeight(588.0, 315.0),
    ctx.getHeight(590.0, 345.0),
    ctx.getHeight(592.0, 362.0)
  );
  const riverWaterY = riverSampleY <= 0.05 ? VIETNAM_WATER_LEVEL : riverSampleY + 0.14;

  const lmCoreGlassShadow = new PartsBuilder(); // castShadow = true ONLY here for Landmark 81
  const baSonPylonShadow = new PartsBuilder(); // castShadow = true ONLY here for Ba Son pylon
  const silverBlueGlass = new PartsBuilder();
  const jadeParkAndGlass = new PartsBuilder();
  const marbleMullions = new PartsBuilder();
  const granitePlazas = new PartsBuilder();
  const whiteStructures = new PartsBuilder();
  const ochreStructures = new PartsBuilder();
  const crimsonStructures = new PartsBuilder();
  const darkRoadRoof = new PartsBuilder();
  const terracottaParts = new PartsBuilder();
  const goldAccents = new PartsBuilder();
  const warmGlow = new PartsBuilder();
  const spireBeaconGlow = new PartsBuilder();
  const woodParts = new PartsBuilder();
  const barkParts = new PartsBuilder();
  const voidParts = new PartsBuilder();

  // If terrain at Sông Sài Gòn channel is above water level, lay a crisp scenic river water channel prism
  if (riverSampleY > 0.05) {
    jadeParkAndGlass.box(26.0, 0.22, 108.0, 592.0, riverWaterY - 0.10, 330.0);
    granitePlazas.box(1.4, 2.8, 108.0, 578.8, riverWaterY - 0.2, 330.0);
    granitePlazas.box(1.4, 2.8, 108.0, 605.2, riverWaterY - 0.2, 330.0);
  }

  // ==========================================================================
  // 3A. THÁP LANDMARK 81 ((545, 295), ~94m tall Bundled-Bamboo 5×5 Matrix!)
  // ==========================================================================
  // Deep -4.5m granite retaining podium terrace skirt
  granitePlazas.box(38.0, 4.8, 38.0, lmX, lmBaseY - 2.1, lmZ);
  granitePlazas.box(35.0, 0.55, 35.0, lmX, lmBaseY + 0.28, lmZ);

  // Sculpted 3-level Vincom Center Shopping Podium at base (y = +0.55m .. +10.2m)
  silverBlueGlass.box(29.5, 3.4, 29.5, lmX, lmBaseY + 2.25, lmZ);
  marbleMullions.box(30.4, 0.36, 30.4, lmX, lmBaseY + 4.02, lmZ);
  silverBlueGlass.box(26.0, 3.1, 26.0, lmX, lmBaseY + 5.75, lmZ);
  marbleMullions.box(26.8, 0.34, 26.8, lmX, lmBaseY + 7.42, lmZ);
  silverBlueGlass.box(22.6, 2.6, 22.6, lmX, lmBaseY + 8.85, lmZ);
  jadeParkAndGlass.box(22.0, 0.22, 22.0, lmX, lmBaseY + 10.22, lmZ); // Podium rooftop sky garden

  // Warm illuminated Vincom shopping podium atrium portals on all 4 sides
  for (let side = 0; side < 4; side++) {
    const rot = (side * Math.PI) / 2;
    const px = lmX + Math.sin(rot) * 14.85;
    const pz = lmZ + Math.cos(rot) * 14.85;
    warmGlow.box(11.0, 2.4, 0.18, px, lmBaseY + 1.85, pz, { ry: rot });
    marbleMullions.box(12.6, 0.26, 2.2, px + Math.sin(rot) * 0.9, lmBaseY + 3.25, pz + Math.cos(rot) * 0.9, { ry: rot });
  }

  // Wave 29: Landmark 81 South Grand Vincom Porte-Cochère Arrival Canopy & Flanking Planter Islands
  const w29PcZ = lmZ + 17.1;
  marbleMullions.box(13.8, 0.34, 4.2, lmX, lmBaseY + 3.92, w29PcZ);
  silverBlueGlass.box(13.2, 0.14, 3.7, lmX, lmBaseY + 4.14, w29PcZ);
  warmGlow.box(12.2, 0.08, 0.26, lmX, lmBaseY + 3.72, w29PcZ + 1.65);
  for (const w29PcX of [-5.8, -2.6, 2.6, 5.8]) {
    marbleMullions.cyl(0.20, 0.24, 3.35, 6, lmX + w29PcX, lmBaseY + 2.18, w29PcZ + 1.55);
  }
  for (const w29PlSide of [-1, 1]) {
    const w29PlX = lmX + w29PlSide * 8.6;
    granitePlazas.box(3.2, 0.56, 2.2, w29PlX, lmBaseY + 0.78, w29PcZ);
    jadeParkAndGlass.box(2.7, 0.38, 1.7, w29PlX, lmBaseY + 1.18, w29PcZ);
    warmGlow.box(2.9, 0.08, 0.08, w29PlX, lmBaseY + 0.62, w29PcZ + 1.12);
  }

  // Authentic 5×5 Bundled-Bamboo Matrix of 25 Square Glass-and-Steel Tubes!
  // Staggered heights (in meters above lmBaseY) faithfully reproducing Landmark 81's iconic silhouette:
  const tubeHeights: readonly (readonly number[])[] = [
    [29.0, 39.5, 47.0, 37.5, 31.5],
    [41.5, 58.0, 68.5, 55.5, 44.0],
    [49.5, 71.0, 83.5, 66.0, 48.0],
    [38.5, 54.0, 64.5, 59.5, 42.5],
    [27.5, 36.5, 45.5, 40.5, 33.0]
  ];
  const gridSpacing = 3.44;
  const tubeW = 3.32;
  const tubeStartY = lmBaseY + 9.8;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const topH = tubeHeights[row][col];
      const tx = lmX + (col - 2) * gridSpacing;
      const tz = lmZ + (row - 2) * gridSpacing;
      const shaftH = topH - 9.8;
      const shaftMidY = tubeStartY + shaftH * 0.5;

      // Main reflective blue-silver glass tube shaft (castShadow = true!)
      lmCoreGlassShadow.box(tubeW, shaftH, tubeW, tx, shaftMidY, tz);

      // Alternating teal-blue spandrel glass bands every 12m up exposed outer tubes
      const isPerimeter = row === 0 || row === 4 || col === 0 || col === 4 || topH > 62.0;
      if (isPerimeter) {
        for (let hBand = 18.0; hBand < topH - 3.0; hBand += 11.5) {
          jadeParkAndGlass.box(tubeW + 0.08, 1.35, tubeW + 0.08, tx, lmBaseY + hBand, tz);
        }
      }

      // Crisp vertical white/silver mullion & LED corner ribs running cleanly up every tube
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          marbleMullions.box(
            0.13,
            shaftH + 0.35,
            0.13,
            tx + sx * (tubeW * 0.49),
            shaftMidY,
            tz + sz * (tubeW * 0.49)
          );
        }
      }

      // Sky-terrace setback crown garden, glass parapet & glowing LED parapet at top of each bamboo tube!
      const capY = lmBaseY + topH;
      granitePlazas.box(tubeW + 0.14, 0.32, tubeW + 0.14, tx, capY + 0.16, tz);
      jadeParkAndGlass.box(tubeW * 0.78, 0.18, tubeW * 0.78, tx, capY + 0.38, tz);
      spireBeaconGlow.box(tubeW + 0.18, 0.16, tubeW + 0.18, tx, capY - 0.15, tz);
      // Bamboo-node horizontal aluminum floor-slab fins, perimeter glass sky-deck parapets & rooftop planter shrubs
      if (isPerimeter) {
        for (let fY = 22.0; fY < topH - 4.0; fY += 11.5) {
          marbleMullions.box(tubeW + 0.22, 0.14, tubeW + 0.22, tx, lmBaseY + fY, tz);
        }
        if (topH < 72.0) {
          jadeParkAndGlass.sphere(0.68, 5, 4, tx, capY + 0.78, tz, [1.2, 0.55, 1.2]);
          if (topH >= 41.0) {
            const parH = 0.88;
            const parR = tubeW * 0.48;
            for (const s of [-1, 1]) {
              silverBlueGlass.box(tubeW * 0.96, parH, 0.08, tx, capY + 0.32 + parH * 0.5, tz + s * parR);
              silverBlueGlass.box(0.08, parH, tubeW * 0.96, tx + s * parR, capY + 0.32 + parH * 0.5, tz);
            }
          }
        }
      }
      // Vertical glowing LED spine fins along the 4 outermost cardinal bamboo-bundle edges
      if ((row === 2 && (col === 0 || col === 4)) || (col === 2 && (row === 0 || row === 4))) {
        const edgeX = col === 0 ? -tubeW * 0.52 : col === 4 ? tubeW * 0.52 : 0;
        const edgeZ = row === 0 ? -tubeW * 0.52 : row === 4 ? tubeW * 0.52 : 0;
        spireBeaconGlow.box(0.14, shaftH * 0.92, 0.14, tx + edgeX, shaftMidY, tz + edgeZ);
      }
    }
  }

  // SkyView Observation Deck (floors 79-81) diagonal crown collar, glass safety parapets + Central Tapering Pinnacle & Glowing 88m-95m Spire
  marbleMullions.box(4.4, 0.26, 4.4, lmX, lmBaseY + 81.2, lmZ);
  spireBeaconGlow.box(4.5, 0.14, 4.5, lmX, lmBaseY + 81.5, lmZ);
  for (const s of [-1, 1]) {
    silverBlueGlass.box(4.32, 1.15, 0.10, lmX, lmBaseY + 82.12, lmZ + s * 2.15);
    silverBlueGlass.box(0.10, 1.15, 4.32, lmX + s * 2.15, lmBaseY + 82.12, lmZ);
    marbleMullions.box(4.42, 0.10, 0.14, lmX, lmBaseY + 82.72, lmZ + s * 2.15);
    marbleMullions.box(0.14, 0.10, 4.42, lmX + s * 2.15, lmBaseY + 82.72, lmZ);
  }
  for (let d = 0; d < 4; d++) {
    const da = (d / 4) * Math.PI * 2 + Math.PI * 0.25;
    marbleMullions.strut(
      new THREE.Vector3(lmX + Math.cos(da) * 2.25, lmBaseY + 78.5, lmZ + Math.sin(da) * 2.25),
      new THREE.Vector3(lmX + Math.cos(da) * 1.45, lmBaseY + 85.4, lmZ + Math.sin(da) * 1.45),
      0.09,
      0.09,
      4
    );
  }
  lmCoreGlassShadow.box(2.45, 4.6, 2.45, lmX, lmBaseY + 85.8, lmZ);
  marbleMullions.box(1.65, 2.4, 1.65, lmX, lmBaseY + 89.2, lmZ);
  spireBeaconGlow.cyl(0.08, 0.36, 6.8, 6, lmX, lmBaseY + 91.6, lmZ);
  spireBeaconGlow.sphere(0.28, 6, 4, lmX, lmBaseY + 95.1, lmZ);

  // ==========================================================================
  // 3B. VINHOMES CENTRAL PARK, SKYBRIDGE & MARINA YACHT PIER
  // ==========================================================================
  const parkX = 564.0;
  const parkZ = 302.0;
  const parkY = Math.max(1.25, ctx.getHeight(parkX, parkZ), riverWaterY + 1.25);

  // Terraced emerald park lawns & white promenade walkways + granite riverfront seawall (-4.2m skirt)
  granitePlazas.box(26.0, 4.6, 36.0, parkX + 4.0, parkY - 2.15, parkZ);
  jadeParkAndGlass.cyl(13.5, 14.8, 0.45, 14, parkX, parkY + 0.18, parkZ);
  whiteStructures.cyl(10.2, 10.6, 0.12, 14, parkX, parkY + 0.42, parkZ);
  jadeParkAndGlass.cyl(8.4, 8.8, 0.32, 12, parkX, parkY + 0.56, parkZ);

  // Ornamental park palms (strictly >= 6m clear of Landmark 81 & terminals)
  for (const [px, pz] of [
    [567.0, 289.0],
    [571.0, 314.0],
    [556.0, 322.0]
  ]) {
    barkParts.cyl(0.12, 0.20, 4.8, 5, px, parkY + 2.3, pz);
    jadeParkAndGlass.sphere(1.35, 6, 4, px, parkY + 4.9, pz, [1.3, 0.52, 1.3]);
  }

  // Vinhomes Central Park Japanese Koi Pond, Red Arched Koi Bridge (*Cầu Đỏ Nhật Bản*) & Garden Pavilion
  const koiX = 569.5;
  const koiZ = 301.5;
  const koiY = parkY + 0.56;
  granitePlazas.cyl(3.45, 3.65, 0.34, 12, koiX, koiY, koiZ);
  silverBlueGlass.cyl(3.15, 3.15, 0.38, 12, koiX, koiY + 0.04, koiZ);
  // 5 arched deck segments + crimson arched handrails & gold *giboshi* bridge finials spanning East-West across koi pond
  const kbSegs = 5;
  for (let s = 0; s < kbSegs; s++) {
    const t = (s + 0.5) / kbSegs - 0.5; // -0.4 .. +0.4
    const bx = koiX + t * 6.2;
    const archH = Math.cos(t * Math.PI) * 1.15;
    const tiltZ = -Math.sin(t * Math.PI) * 0.42;
    woodParts.box(1.38, 0.16, 1.55, bx, koiY + 0.28 + archH, koiZ, { rz: tiltZ });
    for (const sz of [-0.74, 0.74]) {
      crimsonStructures.box(1.38, 0.10, 0.10, bx, koiY + 1.06 + archH, koiZ + sz, { rz: tiltZ });
      crimsonStructures.cyl(0.045, 0.055, 0.76, 4, bx, koiY + 0.68 + archH, koiZ + sz);
      if (s === 0 || s === kbSegs - 1 || s === 2) {
        goldAccents.sphere(0.085, 5, 4, bx, koiY + 1.18 + archH, koiZ + sz);
      }
    }
  }
  // Japanese Timber Garden Pavilion (*Chòi Nhật*) beside the koi pond at (571.5, 294.2)
  const jpX = 571.5;
  const jpZ = 294.2;
  granitePlazas.box(3.4, 0.48, 3.4, jpX, parkY + 0.42, jpZ);
  for (const sx of [-1.25, 1.25]) {
    for (const sz of [-1.25, 1.25]) {
      woodParts.cyl(0.10, 0.12, 2.55, 5, jpX + sx, parkY + 1.90, jpZ + sz);
    }
  }
  woodParts.box(2.75, 0.16, 2.75, jpX, parkY + 3.08, jpZ);
  const jpRoof = createVietnameseCurvedRoofGeometry(3.85, 3.85, 0.55, 0.55, 1.18, 0.24, 4, 4);
  jpRoof.translate(jpX, parkY + 3.16, jpZ);
  darkRoadRoof.add(jpRoof);
  goldAccents.sphere(0.16, 5, 4, jpX, parkY + 4.42, jpZ);
  warmGlow.box(0.32, 0.42, 0.32, jpX, parkY + 2.68, jpZ);

  // Red-and-White Cable-Stayed Pedestrian Skybridge linking Landmark 81 podium to Vinhomes Park
  const sbX = 556.5;
  const sbZ = 311.5;
  const sbYaw = 0.62;
  whiteStructures.box(2.8, 0.36, 18.5, sbX, lmBaseY + 4.6, sbZ, { ry: sbYaw });
  // Twin inclined crimson wishbone pylon legs + white stay cables
  const sbPylonTop = new THREE.Vector3(sbX + 1.2, lmBaseY + 12.2, sbZ - 0.8);
  crimsonStructures.strut(new THREE.Vector3(sbX - 1.4, lmBaseY - 0.4, sbZ - 1.6), sbPylonTop, 0.20, 0.28, 5);
  crimsonStructures.strut(new THREE.Vector3(sbX + 2.2, lmBaseY - 0.4, sbZ + 1.0), sbPylonTop, 0.20, 0.28, 5);
  for (const dOff of [-7.2, -3.6, 3.6, 7.2]) {
    const ax = sbX + Math.sin(sbYaw) * dOff;
    const az = sbZ + Math.cos(sbYaw) * dOff;
    whiteStructures.strut(sbPylonTop, new THREE.Vector3(ax, lmBaseY + 4.78, az), 0.045, 0.045, 4);
  }

  // Marina Yacht Pier jutting into Sông Sài Gòn at (581, 300) + 2 Sleek White Yachts, Cleats & Boarding Ramps
  granitePlazas.box(14.5, 0.42, 3.2, 581.5, riverWaterY + 1.05, 300.0);
  for (const px of [576.0, 581.5, 587.0]) {
    granitePlazas.cyl(0.18, 0.22, 4.2, 5, px, riverWaterY - 0.9, 300.0);
  }
  // 4 stainless/gold horn mooring cleats, rubber dock fenders & twin shore-power pedestals along marina pier
  for (const w24Cx of [579.2, 586.8]) {
    for (const w24Cz of [298.65, 301.35]) {
      granitePlazas.box(0.32, 0.06, 0.18, w24Cx, riverWaterY + 1.29, w24Cz);
      goldAccents.cyl(0.045, 0.055, 0.16, 4, w24Cx, riverWaterY + 1.38, w24Cz);
      goldAccents.box(0.42, 0.065, 0.09, w24Cx, riverWaterY + 1.46, w24Cz);
      darkRoadRoof.cyl(0.14, 0.14, 0.58, 5, w24Cx, riverWaterY + 0.92, w24Cz + (w24Cz < 300 ? -0.32 : 0.32));
    }
  }
  for (const w24Pdx of [578.0, 585.2]) {
    whiteStructures.box(0.34, 0.95, 0.30, w24Pdx, riverWaterY + 1.72, 300.0);
    warmGlow.sphere(0.09, 5, 4, w24Pdx, riverWaterY + 2.24, 300.0);
  }
  // 2 teak-and-stainless yacht boarding ramps bridging pier deck to both moored yachts
  for (const w24Side of [-1, 1]) {
    const w24Rz0 = 300.0 + w24Side * 1.55;
    const w24Rz1 = 300.0 + w24Side * 4.55;
    const w24RmidZ = (w24Rz0 + w24Rz1) * 0.5;
    const w24Rx = 584.2;
    woodParts.box(1.18, 0.10, 3.15, w24Rx, riverWaterY + 1.16, w24RmidZ, { rx: w24Side * 0.08 });
    for (const w24RailX of [-0.54, 0.54]) {
      whiteStructures.strut(
        new THREE.Vector3(w24Rx + w24RailX, riverWaterY + 1.28, w24Rz0),
        new THREE.Vector3(w24Rx + w24RailX, riverWaterY + 2.12, w24Rz0),
        0.03,
        0.035,
        4
      );
      whiteStructures.strut(
        new THREE.Vector3(w24Rx + w24RailX, riverWaterY + 1.04, w24Rz1),
        new THREE.Vector3(w24Rx + w24RailX, riverWaterY + 1.88, w24Rz1),
        0.03,
        0.035,
        4
      );
      whiteStructures.strut(
        new THREE.Vector3(w24Rx + w24RailX, riverWaterY + 2.12, w24Rz0),
        new THREE.Vector3(w24Rx + w24RailX, riverWaterY + 1.88, w24Rz1),
        0.03,
        0.03,
        4
      );
    }
  }
  // Wave 26: Landmark 81 / Vinhomes Central Park Riverfront Promenade Benches & Bollard Lights
  const w26WbX = 577.6;
  const w26WbZs = [288.5, 294.5, 306.5, 313.0];
  for (let w26Bi = 0; w26Bi < w26WbZs.length; w26Bi++) {
    const w26Bz = w26WbZs[w26Bi];
    for (const w26Lz of [-1.05, 1.05]) {
      marbleMullions.box(0.68, 0.44, 0.24, w26WbX, parkY + 0.36, w26Bz + w26Lz);
      granitePlazas.box(0.08, 0.48, 0.08, w26WbX - 0.28, parkY + 0.80, w26Bz + w26Lz * 0.90, { rz: 0.16 });
    }
    woodParts.box(0.24, 0.08, 2.55, w26WbX - 0.14, parkY + 0.60, w26Bz);
    woodParts.box(0.24, 0.08, 2.55, w26WbX + 0.14, parkY + 0.60, w26Bz);
    woodParts.box(0.07, 0.26, 2.55, w26WbX - 0.32, parkY + 0.94, w26Bz, { rz: 0.16 });
    if (w26Bi === 0 || w26Bi === w26WbZs.length - 1) {
      const w26BolZ = w26Bz + (w26Bi === 0 ? -1.65 : 1.65);
      granitePlazas.cyl(0.09, 0.11, 0.85, 5, w26WbX + 0.85, parkY + 0.56, w26BolZ);
      warmGlow.cyl(0.085, 0.085, 0.18, 5, w26WbX + 0.85, parkY + 0.96, w26BolZ);
    }
  }
  appendSleekYacht(marbleMullions, voidParts, woodParts, goldAccents, 585.5, riverWaterY, 294.2, 0.08, 11.2);
  appendSleekYacht(marbleMullions, voidParts, woodParts, goldAccents, 586.0, riverWaterY, 305.8, -0.10, 10.4);

  // ==========================================================================
  // 3C. CẦU BA SON (THỦ THIÊM 2) & CÔNG VIÊN BẾN BẠCH ĐẰNG ((580, 345))
  // ==========================================================================
  const bsX = 588.0;
  const bsZ = 345.0;
  const deckY = Math.max(bdBaseY, riverWaterY) + 7.2;
  const spanLen = 64.0; // Spans East-West across Sông Sài Gòn channel (x = 556 .. 620)

  // Deep concrete abutment retaining walls & main river pylon foundation pier (anchored to -6.5m)
  granitePlazas.box(10.0, 9.0, 12.6, bsX - spanLen * 0.5, deckY - 5.2, bsZ);
  granitePlazas.box(10.0, 9.0, 12.6, bsX + spanLen * 0.5, deckY - 5.2, bsZ);
  const pylonPierX = bsX + 4.5;
  granitePlazas.cyl(3.8, 4.5, deckY + 6.5, 8, pylonPierX, (deckY - 6.5) * 0.5, bsZ, { ry: Math.PI * 0.125 });
  // Pier concrete fender collar (*vòng chống va trụ cầu*) + rubber bumper ring & marine navigation warning lights
  granitePlazas.cyl(5.25, 5.55, 1.45, 8, pylonPierX, riverWaterY + 0.38, bsZ, { ry: Math.PI * 0.125 });
  darkRoadRoof.cyl(5.52, 5.52, 0.48, 8, pylonPierX, riverWaterY + 0.52, bsZ, { ry: Math.PI * 0.125 });
  for (let fb = 0; fb < 4; fb++) {
    const fba = (fb / 4) * Math.PI * 2;
    const fbx = pylonPierX + Math.cos(fba) * 4.95;
    const fbz = bsZ + Math.sin(fba) * 4.95;
    goldAccents.cyl(0.10, 0.12, 0.85, 5, fbx, riverWaterY + 1.48, fbz);
    warmGlow.sphere(0.16, 5, 4, fbx, riverWaterY + 1.98, fbz);
  }

  // Approach ramps connecting West & East banks smoothly up to the 6-lane bridge deck
  granitePlazas.box(16.0, 0.65, 11.4, bsX - spanLen * 0.5 - 6.8, deckY - 2.6, bsZ, { rz: 0.34 });
  darkRoadRoof.box(15.8, 0.16, 10.2, bsX - spanLen * 0.5 - 6.8, deckY - 2.24, bsZ, { rz: 0.34 });
  granitePlazas.box(16.0, 0.65, 11.4, bsX + spanLen * 0.5 + 6.8, deckY - 2.6, bsZ, { rz: -0.34 });
  darkRoadRoof.box(15.8, 0.16, 10.2, bsX + spanLen * 0.5 + 6.8, deckY - 2.24, bsZ, { rz: -0.34 });

  // 6-lane white aerodynamic box-girder deck + asphalt carriageway + lane dividers + guardrails & LED light poles
  whiteStructures.box(spanLen, 0.95, 11.8, bsX, deckY - 0.35, bsZ);
  darkRoadRoof.box(spanLen, 0.16, 10.4, bsX, deckY + 0.18, bsZ);
  ochreStructures.box(spanLen, 0.22, 0.35, bsX, deckY + 0.30, bsZ);
  // Twin-arm architectural median LED streetlights along Cầu Ba Son central divider
  for (const xOff of [-24.0, -14.0, -4.0, 15.0, 25.0]) {
    const mx = bsX + xOff;
    whiteStructures.cyl(0.06, 0.09, 5.2, 5, mx, deckY + 2.95, bsZ);
    for (const sz of [-1, 1]) {
      whiteStructures.strut(
        new THREE.Vector3(mx, deckY + 5.15, bsZ),
        new THREE.Vector3(mx, deckY + 5.65, bsZ + sz * 1.45),
        0.04,
        0.05,
        4
      );
      warmGlow.box(0.28, 0.12, 0.52, mx, deckY + 5.62, bsZ + sz * 1.52);
    }
  }
  for (const sz of [-5.72, 5.72]) {
    whiteStructures.box(spanLen, 0.12, 0.12, bsX, deckY + 1.02, bsZ + sz);
    for (let m = -4; m <= 4; m++) {
      whiteStructures.cyl(0.05, 0.07, 1.0, 4, bsX + m * 6.8, deckY + 0.58, bsZ + sz);
      if (m % 2 === 0) {
        whiteStructures.cyl(0.06, 0.08, 4.4, 4, bsX + m * 6.8, deckY + 2.3, bsZ + sz * 0.96);
        warmGlow.sphere(0.16, 5, 4, bsX + m * 6.8, deckY + 4.55, bsZ + sz * 0.90);
      }
    }
  }
  for (let m = -4; m <= 4; m++) {
    whiteStructures.box(3.2, 0.06, 0.18, bsX + m * 6.4, deckY + 0.28, bsZ - 2.6);
    whiteStructures.box(3.2, 0.06, 0.18, bsX + m * 6.4, deckY + 0.28, bsZ + 2.6);
  }

  // Wave 26: Cầu Ba Son Cantilevered Pedestrian Overlook Balconies (*Ban Công Ngắm Cảnh Đi Bộ*) on North & South Flanks
  const w26OvX = bsX - 8.4;
  for (const w26OvSide of [-1, 1]) {
    const w26OvMidZ = bsZ + w26OvSide * 6.95;
    const w26OvOuterZ = bsZ + w26OvSide * 8.05;
    whiteStructures.box(3.4, 0.42, 2.35, w26OvX, deckY - 0.08, w26OvMidZ);
    marbleMullions.box(3.15, 0.08, 2.15, w26OvX, deckY + 0.16, w26OvMidZ);
    for (const w26BrX of [-1.25, 1.25]) {
      granitePlazas.strut(
        new THREE.Vector3(w26OvX + w26BrX, deckY - 0.78, bsZ + w26OvSide * 5.65),
        new THREE.Vector3(w26OvX + w26BrX, deckY - 0.22, bsZ + w26OvSide * 7.95),
        0.10,
        0.14,
        4
      );
    }
    silverBlueGlass.box(3.24, 0.88, 0.07, w26OvX, deckY + 0.64, w26OvOuterZ);
    whiteStructures.box(3.36, 0.09, 0.11, w26OvX, deckY + 1.10, w26OvOuterZ);
    warmGlow.box(2.8, 0.06, 0.06, w26OvX, deckY + 1.02, bsZ + w26OvSide * 7.98);
    for (const w26SideX of [-1.62, 1.62]) {
      silverBlueGlass.box(0.07, 0.88, 2.25, w26OvX + w26SideX, deckY + 0.64, w26OvMidZ);
      whiteStructures.box(0.11, 0.09, 2.35, w26OvX + w26SideX, deckY + 1.10, w26OvMidZ);
    }
    for (const w26PostX of [-1.62, -0.55, 0.55, 1.62]) {
      whiteStructures.cyl(0.04, 0.045, 0.98, 4, w26OvX + w26PostX, deckY + 0.62, w26OvOuterZ);
    }
  }

  // Iconic Asymmetric Inclined Dragon-Head Arch Pylon rising ~42m above the 6-lane bridge deck! (castShadow = true!)
  // Inclines dramatically Westward (-X, toward District 1) from pylonPierX up to +42.5m above deckY
  const pylonSegs = 8;
  const pylonHeight = 42.5;
  const leanWest = -12.5;
  for (let s = 0; s < pylonSegs; s++) {
    const t0 = s / pylonSegs;
    const t1 = (s + 1) / pylonSegs;
    const y0 = deckY - 1.2 + t0 * pylonHeight;
    const y1 = deckY - 1.2 + t1 * pylonHeight;
    const x0 = pylonPierX + Math.pow(t0, 1.15) * leanWest;
    const x1 = pylonPierX + Math.pow(t1, 1.15) * leanWest;
    // Twin arched legs converge smoothly from ±6.0m outside the deck to a sculpted dragon-head crown apex
    const zHalf0 = 6.1 * Math.pow(1.0 - t0 * 0.88, 0.72);
    const zHalf1 = 6.1 * Math.pow(1.0 - t1 * 0.88, 0.72);
    const rad0 = THREE.MathUtils.lerp(0.95, 0.56, t0);
    const rad1 = THREE.MathUtils.lerp(0.95, 0.56, t1);

    for (const sz of [-1, 1]) {
      baSonPylonShadow.strut(
        new THREE.Vector3(x0, y0, bsZ + sz * zHalf0),
        new THREE.Vector3(x1, y1, bsZ + sz * zHalf1),
        rad1,
        rad0,
        6
      );
    }
    if (s >= 3 && s <= 6) {
      // Cross-tie portal struts inside upper dragon-head loop
      baSonPylonShadow.strut(
        new THREE.Vector3(x1, y1, bsZ - zHalf1),
        new THREE.Vector3(x1, y1, bsZ + zHalf1),
        0.36,
        0.36,
        5
      );
    }
  }
  // Sculpted Dragon-Head Arch Crown Apex at +42.5m above deck + warm architectural LED spine strip
  const apexX = pylonPierX + leanWest;
  const apexY = deckY - 1.2 + pylonHeight;
  baSonPylonShadow.box(2.6, 2.8, 2.4, apexX - 0.3, apexY + 0.6, bsZ, { rz: 0.28 });
  spireBeaconGlow.sphere(0.32, 6, 4, apexX - 0.8, apexY + 2.2, bsZ);
  warmGlow.box(0.28, 2.2, 2.5, apexX - 1.4, apexY + 0.6, bsZ, { rz: 0.28 });

  // Wave 29: Cầu Ba Son Pylon Base Architectural Uplight Projector Pods & Abutment Expansion Portal Markers
  for (const w29Uz of [-5.85, 5.85]) {
    granitePlazas.box(0.95, 0.38, 0.72, pylonPierX - 1.35, deckY + 0.36, bsZ + w29Uz);
    warmGlow.box(0.68, 0.14, 0.44, pylonPierX - 1.35, deckY + 0.60, bsZ + w29Uz, { rz: -0.35 });
  }
  for (const w29Ax of [bsX - spanLen * 0.5 + 0.8, bsX + spanLen * 0.5 - 0.8]) {
    for (const w29Az of [-5.85, 5.85]) {
      whiteStructures.box(0.68, 2.85, 0.54, w29Ax, deckY + 1.55, bsZ + w29Az);
      goldAccents.box(0.74, 0.24, 0.60, w29Ax, deckY + 2.85, bsZ + w29Az);
      warmGlow.box(0.16, 1.85, 0.12, w29Ax, deckY + 1.65, bsZ + w29Az + (w29Az < 0 ? 0.28 : -0.28));
    }
  }

  // Symmetric Fan of 32 Taut White Stay Cables (`PartsBuilder.strut`, castShadow = false) on BOTH sides of deck + deck anchor sleeves!
  for (let c = 0; c < 8; c++) {
    const frac = 0.48 + (c / 7) * 0.47;
    const pyY = deckY - 1.2 + frac * pylonHeight;
    const pyX = pylonPierX + Math.pow(frac, 1.15) * leanWest;
    const pyZHalf = 6.1 * Math.pow(1.0 - frac * 0.88, 0.72);
    const westDeckX = pylonPierX - 7.5 - c * 3.6;
    const eastDeckX = pylonPierX + 5.5 + c * 2.5;

    for (const sideZ of [-1, 1]) {
      // Westward main-span stay cable + deck anchor collar
      whiteStructures.strut(
        new THREE.Vector3(pyX, pyY, bsZ + sideZ * pyZHalf),
        new THREE.Vector3(westDeckX, deckY + 0.25, bsZ + sideZ * 5.55),
        0.055,
        0.055,
        4
      );
      marbleMullions.cyl(0.12, 0.14, 0.75, 5, westDeckX, deckY + 0.48, bsZ + sideZ * 5.55);

      // Eastward Thủ Thiêm back-stay cable + deck anchor collar
      whiteStructures.strut(
        new THREE.Vector3(pyX, pyY, bsZ + sideZ * pyZHalf),
        new THREE.Vector3(eastDeckX, deckY + 0.25, bsZ + sideZ * 5.55),
        0.055,
        0.055,
        4
      );
      marbleMullions.cyl(0.12, 0.14, 0.75, 5, eastDeckX, deckY + 0.48, bsZ + sideZ * 5.55);
    }
  }

  // ==========================================================================
  // 3D. CÔNG VIÊN BẾN BẠCH ĐẰNG, CỘT CỜ THỦ NGỮ (1865) & SAIGON WATERBUS
  // ==========================================================================
  // Deep -4.5m granite riverfront retaining seawall & concentric Lotus-Petal Granite Plaza
  granitePlazas.box(26.0, 4.8, 38.0, bdX + 2.0, bdBaseY - 2.2, bdZ);
  granitePlazas.cyl(12.5, 13.0, 0.36, 16, bdX, bdBaseY + 0.18, bdZ);
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    const px = bdX + Math.cos(a) * 6.8;
    const pz = bdZ + Math.sin(a) * 6.8;
    marbleMullions.box(2.8, 0.14, 5.4, px, bdBaseY + 0.38, pz, { ry: -a + Math.PI * 0.5 });
    const gx = bdX + Math.cos(a + Math.PI / 8) * 7.4;
    const gz = bdZ + Math.sin(a + Math.PI / 8) * 7.4;
    jadeParkAndGlass.box(2.2, 0.16, 4.2, gx, bdBaseY + 0.36, gz, { ry: -(a + Math.PI / 8) + Math.PI * 0.5 });
  }
  marbleMullions.cyl(3.2, 3.5, 0.22, 12, bdX, bdBaseY + 0.42, bdZ);
  // Central stepped lotus feature, perimeter waterfront benches & riverfront globe lampposts
  goldAccents.cyl(1.15, 1.45, 0.55, 8, bdX, bdBaseY + 0.72, bdZ);
  warmGlow.sphere(0.45, 6, 4, bdX, bdBaseY + 1.18, bdZ);
  for (let lp = 0; lp < 6; lp++) {
    const lz = bdZ - 14.0 + lp * 5.6;
    granitePlazas.cyl(0.08, 0.11, 3.2, 5, bdX + 13.8, bdBaseY + 1.75, lz);
    warmGlow.sphere(0.24, 5, 4, bdX + 13.8, bdBaseY + 3.45, lz);
  }
  for (let b = 0; b < 4; b++) {
    const ba = (b / 4) * Math.PI * 2 + Math.PI * 0.25;
    marbleMullions.box(2.4, 0.48, 0.65, bdX + Math.cos(ba) * 10.6, bdBaseY + 0.55, bdZ + Math.sin(ba) * 10.6, { ry: -ba + Math.PI * 0.5 });
  }
  // Bến Bạch Đằng 3-tier cascading riverside granite seating steps & waterfront safety rail facing Sông Sài Gòn
  const stepZCenter = 360.0;
  const stepSpanZ = 14.5;
  for (let tier = 0; tier < 3; tier++) {
    const sx = bdX + 15.2 + tier * 0.72;
    const sy = bdBaseY - 0.18 - tier * 0.34;
    granitePlazas.box(0.76, 1.35, stepSpanZ, sx, sy - 0.52, stepZCenter);
    marbleMullions.box(0.80, 0.12, stepSpanZ, sx, sy + 0.16, stepZCenter);
  }
  for (let bl = 0; bl < 5; bl++) {
    const blz = stepZCenter - 6.4 + bl * 3.2;
    whiteStructures.cyl(0.055, 0.065, 0.95, 5, bdX + 17.02, bdBaseY - 0.35, blz);
  }
  whiteStructures.box(0.08, 0.08, stepSpanZ - 1.2, bdX + 17.02, bdBaseY + 0.08, stepZCenter);

  // 3 Bến Bạch Đằng Riverside Panoramic Viewing Binoculars (*ống nhòm ngắm cảnh*) facing Sông Sài Gòn & Thủ Thiêm
  for (const w24Bz of [344.4, 350.0, 355.6]) {
    const w24Bx = bdX + 14.35;
    granitePlazas.cyl(0.32, 0.38, 0.14, 5, w24Bx, bdBaseY + 0.25, w24Bz);
    granitePlazas.cyl(0.24, 0.28, 0.12, 5, w24Bx - 0.42, bdBaseY + 0.24, w24Bz);
    whiteStructures.cyl(0.065, 0.095, 1.28, 5, w24Bx, bdBaseY + 0.94, w24Bz);
    goldAccents.box(0.18, 0.24, 0.22, w24Bx, bdBaseY + 1.56, w24Bz);
    for (const w24EyeZ of [-0.11, 0.11]) {
      marbleMullions.cyl(0.075, 0.055, 0.56, 5, w24Bx + 0.08, bdBaseY + 1.72, w24Bz + w24EyeZ, { rz: -Math.PI * 0.44 });
      voidParts.cyl(0.068, 0.068, 0.08, 5, w24Bx + 0.35, bdBaseY + 1.77, w24Bz + w24EyeZ, { rz: -Math.PI * 0.44 });
    }
  }

  // Historic 1865 Octagonal 2-Tier Cột Cờ Thủ Ngữ at (555, 361) flying Cờ Tổ Quốc!
  const tnX = 555.0;
  const tnZ = 361.0;
  granitePlazas.cyl(4.6, 5.0, 1.2, 8, tnX, bdBaseY + 0.25, tnZ);
  whiteStructures.cyl(3.5, 3.65, 3.4, 8, tnX, bdBaseY + 2.5, tnZ);
  terracottaParts.cone(4.4, 1.25, 8, tnX, bdBaseY + 4.65, tnZ);
  whiteStructures.cyl(2.35, 2.45, 2.8, 8, tnX, bdBaseY + 6.2, tnZ);
  darkRoadRoof.cone(3.1, 1.35, 8, tnX, bdBaseY + 8.15, tnZ);
  // Lower & upper arched windows, octagonal upper gallery railing & entrance steps
  granitePlazas.box(2.2, 0.45, 1.15, tnX, bdBaseY + 0.35, tnZ + 4.95);
  for (let f = 0; f < 8; f++) {
    const a = (f / 8) * Math.PI * 2;
    if (f % 2 === 0) {
      voidParts.box(0.85, 1.65, 0.25, tnX + Math.sin(a) * 3.45, bdBaseY + 2.4, tnZ + Math.cos(a) * 3.45, { ry: a });
      voidParts.box(0.62, 1.15, 0.22, tnX + Math.sin(a) * 2.35, bdBaseY + 6.3, tnZ + Math.cos(a) * 2.35, { ry: a });
    }
    whiteStructures.cyl(0.05, 0.05, 0.85, 4, tnX + Math.sin(a) * 3.15, bdBaseY + 5.25, tnZ + Math.cos(a) * 3.15);
  }
  whiteStructures.cyl(3.18, 3.18, 0.08, 8, tnX, bdBaseY + 5.65, tnZ);
  // Tall white signal mast, cross-yardarm & twin diagonal wire shrouds flying Cờ Tổ Quốc
  whiteStructures.cyl(0.08, 0.16, 13.5, 6, tnX, bdBaseY + 14.8, tnZ);
  whiteStructures.box(3.8, 0.10, 0.10, tnX, bdBaseY + 18.6, tnZ);
  for (const sx of [-1, 1]) {
    whiteStructures.strut(
      new THREE.Vector3(tnX + sx * 1.8, bdBaseY + 8.6, tnZ),
      new THREE.Vector3(tnX + sx * 0.14, bdBaseY + 18.4, tnZ),
      0.035,
      0.035,
      4
    );
  }
  goldAccents.sphere(0.18, 6, 4, tnX, bdBaseY + 21.65, tnZ);
  addWavingFlagMesh(group, ctx, flagUniforms, 'CotCoThuNguFlag', tnX, bdBaseY + 21.45, tnZ, 3.4, 2.25, 0.2, 1.1, true);

  // Yellow Saigon Waterbus Terminal at (571, 333) & Floating Pier + Yellow Waterbus Boat!
  const wbX = 571.0;
  const wbZ = 333.0;
  granitePlazas.box(9.6, 4.6, 11.2, wbX, bdBaseY - 2.0, wbZ);
  whiteStructures.box(8.2, 3.6, 9.6, wbX, bdBaseY + 2.1, wbZ);
  ochreStructures.box(9.2, 0.85, 10.6, wbX, bdBaseY + 4.25, wbZ);
  ochreStructures.cyl(4.4, 4.4, 10.6, 6, wbX, bdBaseY + 4.65, wbZ, { rx: Math.PI * 0.5 });
  voidParts.box(0.25, 2.5, 7.6, wbX + 4.05, bdBaseY + 1.9, wbZ);

  // Gangway, handrails & floating yellow-and-gray Waterbus pontoon with 4 pairs of grounded canopy columns
  granitePlazas.box(5.5, 0.25, 2.2, 577.2, riverWaterY + 0.95, wbZ, { rz: -0.18 });
  darkRoadRoof.box(3.6, 0.55, 11.5, 581.2, riverWaterY + 0.28, wbZ);
  ochreStructures.box(3.2, 0.22, 11.2, 581.2, riverWaterY + 2.85, wbZ);
  for (const lz of [-4.6, -1.5, 1.5, 4.6]) {
    for (const lx of [-1.25, 1.25]) {
      whiteStructures.cyl(0.07, 0.08, 2.35, 5, 581.2 + lx, riverWaterY + 1.68, wbZ + lz);
    }
  }

  // Wave 29: Saigon Waterbus Gangway Boarding Arch, Digital Departure Totem & Bến Bạch Đằng Waterfront Shade Pergola
  const w29GaX = 574.9;
  for (const w29Gaz of [-1.25, 1.25]) {
    ochreStructures.cyl(0.10, 0.12, 2.95, 5, w29GaX, bdBaseY + 1.62, wbZ + w29Gaz);
  }
  ochreStructures.box(0.36, 0.42, 2.85, w29GaX, bdBaseY + 3.12, wbZ);
  warmGlow.box(0.42, 0.22, 2.25, w29GaX, bdBaseY + 3.12, wbZ);
  // Digital departure totem right beside gangway entrance
  granitePlazas.box(0.62, 0.24, 0.78, w29GaX - 0.35, bdBaseY + 0.24, wbZ + 2.35);
  whiteStructures.box(0.28, 2.05, 0.68, w29GaX - 0.35, bdBaseY + 1.38, wbZ + 2.35);
  voidParts.box(0.32, 0.92, 0.52, w29GaX - 0.35, bdBaseY + 1.68, wbZ + 2.35);
  ochreStructures.box(0.34, 0.22, 0.72, w29GaX - 0.35, bdBaseY + 2.46, wbZ + 2.35);

  // Bến Bạch Đằng SE Waterfront Modern Slatted Shade Pergola at (568.5, 363.5)
  const w29PgX = 568.5;
  const w29PgZ = 363.5;
  for (const w29Px of [-2.1, 2.1]) {
    for (const w29Pz of [-1.45, 1.45]) {
      whiteStructures.cyl(0.08, 0.10, 2.95, 5, w29PgX + w29Px, bdBaseY + 1.62, w29PgZ + w29Pz);
    }
  }
  whiteStructures.box(4.65, 0.14, 3.35, w29PgX, bdBaseY + 3.12, w29PgZ);
  goldAccents.box(4.72, 0.08, 0.14, w29PgX, bdBaseY + 3.18, w29PgZ - 1.65);
  goldAccents.box(4.72, 0.08, 0.14, w29PgX, bdBaseY + 3.18, w29PgZ + 1.65);
  for (const w29Sl of [-1.0, 0.0, 1.0]) {
    woodParts.box(4.45, 0.08, 0.24, w29PgX, bdBaseY + 3.24, w29PgZ + w29Sl);
  }
  for (const w29BnZ of [-0.72, 0.72]) {
    marbleMullions.box(2.4, 0.42, 0.52, w29PgX, bdBaseY + 0.40, w29PgZ + w29BnZ);
    woodParts.box(2.44, 0.07, 0.54, w29PgX, bdBaseY + 0.64, w29PgZ + w29BnZ);
  }

  // Yellow Saigon Waterbus Boat moored at pontoon (tapered bow, panoramic windows, rooftop AC & radar mast)
  ochreStructures.box(3.4, 1.15, 11.6, 585.8, riverWaterY + 0.62, wbZ - 0.5);
  ochreStructures.cone(1.85, 2.8, 4, 585.8, riverWaterY + 0.72, wbZ + 6.65, { rx: Math.PI * 0.5, ry: Math.PI * 0.25 });
  whiteStructures.box(3.1, 1.25, 9.8, 585.8, riverWaterY + 1.65, wbZ - 0.4);
  voidParts.box(3.22, 0.72, 8.6, 585.8, riverWaterY + 1.72, wbZ - 0.4);
  ochreStructures.box(3.3, 0.26, 10.4, 585.8, riverWaterY + 2.38, wbZ - 0.4);
  whiteStructures.box(1.6, 0.34, 2.4, 585.8, riverWaterY + 2.66, wbZ - 1.2);
  whiteStructures.cyl(0.05, 0.07, 1.55, 4, 585.8, riverWaterY + 3.25, wbZ + 2.6);
  warmGlow.sphere(0.14, 5, 4, 585.8, riverWaterY + 4.08, wbZ + 2.6);

  // Illuminated 3-Deck Saigon Dinner-Cruise Ship cruising Sông Sài Gòn!
  const cruiseGroup = new THREE.Group();
  cruiseGroup.name = 'SaigonDinnerCruiseShip';
  const crWhite = new PartsBuilder();
  const crGlow = new PartsBuilder();
  const crGold = new PartsBuilder();
  const crDark = new PartsBuilder();

  crWhite.box(5.4, 1.6, 21.0, 0, 0.75, 0);
  crWhite.cone(2.7, 3.8, 4, 0, 0.95, 12.2, { rx: Math.PI * 0.5, ry: Math.PI * 0.25 });
  crDark.box(5.0, 0.16, 20.2, 0, 1.62, 0);
  // 2 warm-lit panoramic banquet decks + open-air rooftop sky lounge
  crWhite.box(4.6, 1.65, 15.8, 0, 2.45, -0.8);
  crGlow.box(4.72, 0.98, 14.2, 0, 2.52, -0.8);
  crWhite.box(4.2, 1.55, 12.6, 0, 4.05, -1.2);
  crGlow.box(4.32, 0.92, 11.0, 0, 4.12, -1.2);
  crGold.box(4.4, 0.22, 13.4, 0, 4.92, -1.2);
  for (let l = -2; l <= 2; l++) {
    crGlow.sphere(0.18, 5, 4, -2.05, 5.25, -1.2 + l * 2.6);
    crGlow.sphere(0.18, 5, 4, 2.05, 5.25, -1.2 + l * 2.6);
  }
  addWavingFlagMesh(cruiseGroup, ctx, flagUniforms, 'SaigonCruiseFlag', 0, 7.1, -8.8, 1.9, 1.25, Math.PI * 0.5, 0.85, true);
  crWhite.cyl(0.05, 0.07, 2.4, 4, 0, 6.0, -8.8);

  commitPartsMesh(cruiseGroup, crWhite, 'SaigonCruiseHull', ctx.materials.whitePlaster, false, true);
  commitPartsMesh(cruiseGroup, crGlow, 'SaigonCruiseBanquetGlow', ctx.materials.stainedGlass ?? ctx.materials.lanternCore ?? ctx.materials.gold, false, false);
  commitPartsMesh(cruiseGroup, crGold, 'SaigonCruiseGoldTrim', ctx.materials.gold, false, false);
  commitPartsMesh(cruiseGroup, crDark, 'SaigonCruiseDeck', ctx.materials.darkRoof, false, true);

  cruiseGroup.position.set(594.0, riverWaterY, 360.0);
  group.add(cruiseGroup);
  southernBoats.push({
    group: cruiseGroup,
    centerX: 594.5,
    centerZ: 325.0,
    radiusX: 2.2,
    radiusZ: 14.0,
    speed: 0.16,
    phase: 0.4
  });

  commitPartsMesh(group, lmCoreGlassShadow, 'Landmark81BundledCore', ctx.materials.bronzePatina ?? ctx.materials.granite, true, true, 3.0);
  commitPartsMesh(group, silverBlueGlass, 'Landmark81PodiumGlass', ctx.materials.bronzePatina ?? ctx.materials.granite, false, true, 3.0);
  commitPartsMesh(group, baSonPylonShadow, 'BaSonDragonPylon', ctx.materials.whitePlaster, true, true, 2.4);
  commitPartsMesh(group, jadeParkAndGlass, 'SaigonModernParkAndGlass', ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true, 2.8);
  commitPartsMesh(group, marbleMullions, 'Landmark81MullionsAndYachts', ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true);
  commitPartsMesh(group, granitePlazas, 'SaigonModernGranitePlazas', ctx.materials.granite, false, true, 2.6);
  commitPartsMesh(group, whiteStructures, 'SaigonModernWhiteStructures', ctx.materials.whitePlaster, false, true, 2.4);
  commitPartsMesh(group, ochreStructures, 'SaigonWaterbusYellow', ctx.materials.yellowOchrePlaster, false, true, 2.4);
  commitPartsMesh(group, crimsonStructures, 'SaigonSkybridgeCrimson', ctx.materials.crimsonLacquer, false, true);
  commitPartsMesh(group, darkRoadRoof, 'SaigonBridgeRoadwayAndSlate', ctx.materials.darkRoof, false, true, 2.4);
  commitPartsMesh(group, terracottaParts, 'CotCoThuNguLowerRoof', ctx.materials.terracottaRoof, false, true);
  commitPartsMesh(group, goldAccents, 'SaigonModernGoldAccents', ctx.materials.gold, false, false);
  commitPartsMesh(group, warmGlow, 'Landmark81PodiumWarmGlow', ctx.materials.stainedGlass ?? ctx.materials.gold, false, false);
  commitPartsMesh(group, spireBeaconGlow, 'Landmark81SpireGlow', ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false);
  commitPartsMesh(group, woodParts, 'SaigonYachtDecks', ctx.materials.darkWood, false, true);
  commitPartsMesh(group, barkParts, 'SaigonParkPalmTrunks', ctx.materials.bark, false, true);
  commitPartsMesh(group, voidParts, 'SaigonModernDarkWindows', ctx.materials.darkVoid, false, false);

  tagMotifIds(group, ['SG-LANDMARK-81', 'SG-VINHOMES-PARK', 'SG-CAU-BA-SON', 'SG-BEN-BACH-DANG', 'SG-THU-NGU-1865', 'SG-WATERBUS']);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: lmX, z: lmZ, r: 46.0 });
  ctx.exclusionCircles.push({ x: 576.0, z: 346.0, r: 46.0 });
  return group;
}

// ============================================================================
// 4. TÂY NINH LINH THIÊNG (`TayNinhSacredComplex`) centered at (-540, 680)
//    Núi Bà Đen & Phật Bà Tây Bổ Đà Sơn (-575, 650) + Tòa Thánh Cao Đài (-505, 705)
// ============================================================================
function buildTayNinhSacredComplex(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'TayNinhSacredComplex';
  void flagUniforms;

  const nbdX = -575.0;
  const nbdZ = 650.0;
  const cdX = -505.0;
  const cdZ = 705.0;

  // Grounding safety: ensure plain sits cleanly above water even if z > 445 sea basin applies
  const sampledPlainY = Math.max(
    ctx.getHeight(-540.0, 680.0),
    ctx.getHeight(cdX, cdZ),
    ctx.getHeight(cdX - 24.0, cdZ - 24.0),
    ctx.getHeight(cdX + 24.0, cdZ + 24.0),
    ctx.getHeight(nbdX + 25.0, nbdZ + 25.0)
  );
  const plainY = Math.max(1.85, sampledPlainY);

  const massifRockShadow = new PartsBuilder(); // castShadow = true ONLY on Núi Bà Đen massif
  const mountainMoss = new PartsBuilder();
  const graniteParts = new PartsBuilder();
  const marbleParts = new PartsBuilder();
  const jadeParts = new PartsBuilder();
  const bronzeStatue = new PartsBuilder();
  const goldParts = new PartsBuilder();
  const crimsonParts = new PartsBuilder();
  const roofParts = new PartsBuilder();
  const ochreParts = new PartsBuilder();
  const pinkBrickParts = new PartsBuilder();
  const domeGlass = new PartsBuilder();
  const glowParts = new PartsBuilder();
  const woodParts = new PartsBuilder();
  const barkParts = new PartsBuilder();
  const voidParts = new PartsBuilder();

  // Skirted Tây Ninh sacred plain platform (-4.8m deep retaining skirt so complex never floats or floods)
  graniteParts.cyl(94.0, 102.0, plainY + 4.8, 24, -540.0, (plainY - 4.8) * 0.5, 680.0);
  jadeParts.cyl(91.5, 92.5, 0.24, 24, -540.0, plainY + 0.08, 680.0);

  // ==========================================================================
  // 4A. NÚI BÀ ĐEN MASSIF (~42m high), CHÙA BÀ, GA VÂN SƠN & ĐẠI TƯỢNG PHẬT BÀ
  // ==========================================================================
  const mtnHeight = 42.0;
  const summitY = plainY + mtnHeight;

  // Core volcanic granite-basalt mountain massif (createSculptedRockGeometry clusters, castShadow = true)
  const coreCrag = createSculptedRockGeometry(801, 40.0, 24.5, 38.0, 2);
  coreCrag.translate(nbdX, plainY + 15.5, nbdZ);
  massifRockShadow.add(coreCrag);

  const upperPeak = createSculptedRockGeometry(809, 25.5, 18.5, 24.5, 2);
  upperPeak.translate(nbdX - 2.0, plainY + 28.5, nbdZ - 1.5);
  massifRockShadow.add(upperPeak);

  // Flanking radial mountain buttress ridges & forested mossy shoulders
  for (let r = 0; r < 10; r++) {
    const ang = (r / 10) * Math.PI * 2 + 0.2;
    const dist = 22.0 + (r % 3) * 4.5;
    const rx = nbdX + Math.cos(ang) * dist;
    const rz = nbdZ + Math.sin(ang) * dist;
    const rh = 13.5 + (r % 3) * 4.2;
    const buttress = createSculptedRockGeometry(820 + r * 11, 15.5, rh, 14.0, 1);
    buttress.rotateY(ang);
    buttress.translate(rx, plainY + rh * 0.58 - 2.5, rz);
    massifRockShadow.add(buttress);

    const moss = createSculptedRockGeometry(910 + r * 13, 11.5, rh * 0.55, 10.5, 1);
    moss.translate(rx * 0.99 + (nbdX - rx) * 0.24, plainY + rh * 0.85, rz * 0.99 + (nbdZ - rz) * 0.24);
    mountainMoss.add(moss);
  }

  // Mid-Mountain Chùa Bà (Linh Sơn Tiên Thạch Tự) at (-554, 666), y = plainY + 17.5m on deep retained cliff terrace
  const cbX = -554.0;
  const cbZ = 666.0;
  const cbY = plainY + 17.5;
  const cbYaw = 0.65;

  graniteParts.box(13.8, 12.5, 11.4, cbX, cbY - 6.1, cbZ, { ry: cbYaw }); // Deep cliff retaining wall
  marbleParts.box(14.2, 0.95, 0.35, cbX + Math.sin(cbYaw) * 5.5, cbY + 0.55, cbZ + Math.cos(cbYaw) * 5.5, { ry: cbYaw });
  ochreParts.box(9.6, 3.8, 7.2, cbX, cbY + 1.9, cbZ, { ry: cbYaw });
  for (let p = -2; p <= 2; p++) {
    const lx = p * 2.1;
    crimsonParts.cyl(
      0.18,
      0.21,
      3.8,
      6,
      cbX + lx * Math.cos(cbYaw) + 3.8 * Math.sin(cbYaw),
      cbY + 1.9,
      cbZ - lx * Math.sin(cbYaw) + 3.8 * Math.cos(cbYaw)
    );
  }
  const cbRoof1 = createHueImperialHipRoofGeometry(11.6, 9.2, 6.4, 4.4, 1.85, 0.36, 4, 3, true);
  transformGeometryXYZ(cbRoof1, cbX, cbY + 3.75, cbZ, cbYaw);
  const cbRoof2 = createHueImperialHipRoofGeometry(7.6, 5.6, 3.6, 0.8, 1.75, 0.32, 4, 3, true);
  transformGeometryXYZ(cbRoof2, cbX, cbY + 5.55, cbZ, cbYaw);
  roofParts.add(cbRoof1, cbRoof2);
  const cbFinials = createRoofFinialSetParts(cbX, cbY + 7.28, cbZ, 3.6, cbYaw, 0.72, false);
  crimsonParts.add(...cbFinials.mainParts);
  goldParts.add(...cbFinials.goldParts);

  // Sacred granite Hang Bà grotto shrine tucked beside Chùa Bà
  const grottoRock = createSculptedRockGeometry(888, 3.4, 2.8, 2.8, 1);
  grottoRock.translate(cbX - 6.2, cbY + 1.4, cbZ - 1.8);
  massifRockShadow.add(grottoRock);
  voidParts.box(1.4, 1.8, 1.2, cbX - 5.4, cbY + 0.9, cbZ - 0.9, { ry: cbYaw });

  // Modern Curved-Dome Ga Cáp Treo Vân Sơn on SE summit shoulder (-558, 643) + Cable-Car Pylon & Gondolas
  const vsX = -558.0;
  const vsZ = 643.0;
  const vsY = plainY + 33.0;
  graniteParts.cyl(9.2, 10.6, 11.0, 12, vsX, vsY - 5.2, vsZ);
  // 3-lobed organic curved white & stained-glass dome shells representing Núi Bà - Bà Đen - Chùa Hang peaks
  marbleParts.sphere(6.8, 10, 6, vsX, vsY + 0.4, vsZ, [1.18, 0.58, 1.05]);
  domeGlass.sphere(5.8, 8, 5, vsX + 0.6, vsY + 1.15, vsZ + 0.5, [1.05, 0.62, 0.98]);
  marbleParts.sphere(4.5, 8, 5, vsX - 4.2, vsY + 0.2, vsZ + 2.8, [1.1, 0.52, 1.0]);
  marbleParts.sphere(4.2, 8, 5, vsX + 3.8, vsY + 0.2, vsZ - 3.2, [1.0, 0.50, 1.1]);
  // Vaulted structural steel-and-gold dome ribs + grand arched entrance portal at Ga Vân Sơn
  for (let rib = 0; rib < 6; rib++) {
    const ra = (rib / 6) * Math.PI * 2;
    goldParts.strut(
      new THREE.Vector3(vsX + Math.cos(ra) * 7.6, vsY + 0.2, vsZ + Math.sin(ra) * 6.8),
      new THREE.Vector3(vsX + Math.cos(ra) * 1.4, vsY + 4.35, vsZ + Math.sin(ra) * 1.4),
      0.11,
      0.14,
      4
    );
  }
  graniteParts.box(5.6, 0.55, 2.8, vsX + 4.8, vsY - 0.1, vsZ + 4.2, { ry: 0.65 });
  voidParts.box(3.8, 2.6, 0.45, vsX + 4.1, vsY + 1.45, vsZ + 3.5, { ry: 0.65 });
  goldParts.cyl(0.18, 0.42, 2.4, 6, vsX, vsY + 4.8, vsZ);

  // Wave 26: Núi Bà Đen Ga Vân Sơn Arrival Plaza Benches & Cloud-View Planter Bollards
  const w26VsYaw = 0.65;
  const w26VsCos = Math.cos(w26VsYaw);
  const w26VsSin = Math.sin(w26VsYaw);
  const w26VsAt = (lx: number, ly: number, lz: number): [number, number, number] => [
    vsX + 4.8 + lx * w26VsCos + lz * w26VsSin,
    vsY + ly,
    vsZ + 4.2 - lx * w26VsSin + lz * w26VsCos
  ];
  for (const w26VsSide of [-1, 1]) {
    const w26Lx = w26VsSide * 2.25;
    for (const w26Lz of [-0.30, 0.92]) {
      const [w26Px, w26Py, w26Pz] = w26VsAt(w26Lx, 0.38, w26Lz);
      marbleParts.box(0.56, 0.42, 0.22, w26Px, w26Py, w26Pz, { ry: w26VsYaw });
    }
    const [w26Sx, w26Sy, w26Sz] = w26VsAt(w26Lx, 0.62, 0.31);
    woodParts.box(0.52, 0.08, 1.72, w26Sx, w26Sy, w26Sz, { ry: w26VsYaw });
    const [w26Bkx, w26Bky, w26Bkz] = w26VsAt(w26Lx + w26VsSide * 0.24, 0.90, 0.31);
    woodParts.box(0.07, 0.28, 1.72, w26Bkx, w26Bky, w26Bkz, { ry: w26VsYaw });
    goldParts.box(0.08, 0.04, 1.76, w26Bkx, w26Bky + 0.15, w26Bkz, { ry: w26VsYaw });
    const [w26Plx, w26Ply, w26Plz] = w26VsAt(w26Lx, 0.43, -1.02);
    marbleParts.cyl(0.24, 0.28, 0.52, 6, w26Plx, w26Ply, w26Plz);
    jadeParts.sphere(0.24, 5, 4, w26Plx, w26Ply + 0.33, w26Plz);
  }

  // Foothill Cable-Car Portal (-536, 658) & Mid-Slope Steel Lattice Pylon (-547, 650.5) + Haul Cables & 2 Gondolas
  const fhX = -536.0;
  const fhZ = 658.0;
  graniteParts.box(7.4, 3.6, 6.4, fhX, plainY + 1.5, fhZ, { ry: 0.6 });
  marbleParts.sphere(4.2, 8, 5, fhX, plainY + 3.2, fhZ, [1.1, 0.5, 1.0]);

  const pylX = -547.0;
  const pylZ = 650.5;
  const pylBaseY = plainY + 15.0;
  const pylTopY = plainY + 25.5;
  graniteParts.cyl(0.45, 0.85, 14.5, 5, pylX, pylBaseY + 3.2, pylZ);
  graniteParts.box(3.6, 0.35, 0.45, pylX, pylTopY, pylZ, { ry: 0.6 });
  // Sheave-wheel roller batteries & cross-arm braces atop the cable-car pylon
  for (const off of [-1.2, 1.2]) {
    const sx = pylX + off * 0.55;
    const sz = pylZ - off * 0.82;
    goldParts.cyl(0.32, 0.32, 0.24, 6, sx, pylTopY + 0.15, sz, { rx: Math.PI * 0.5, ry: 0.6 });
    graniteParts.strut(new THREE.Vector3(pylX, pylTopY - 1.8, pylZ), new THREE.Vector3(sx, pylTopY, sz), 0.08, 0.08, 4);
  }

  const cTop = new THREE.Vector3(vsX + 2.5, vsY + 2.2, vsZ + 2.0);
  const cMid = new THREE.Vector3(pylX, pylTopY + 0.2, pylZ);
  const cBot = new THREE.Vector3(fhX - 1.5, plainY + 3.6, fhZ - 1.2);
  for (const off of [-1.2, 1.2]) {
    const shift = new THREE.Vector3(off * 0.55, 0, -off * 0.82);
    graniteParts.strut(cTop.clone().add(shift), cMid.clone().add(shift), 0.045, 0.045, 4);
    graniteParts.strut(cMid.clone().add(shift), cBot.clone().add(shift), 0.045, 0.045, 4);
  }
  // 2 Suspended Cable-Car Gondola Cabins
  for (const [segStart, segEnd, tFrac] of [
    [cTop, cMid, 0.52],
    [cMid, cBot, 0.45]
  ] as const) {
    const gp = new THREE.Vector3().lerpVectors(segStart, segEnd, tFrac);
    graniteParts.cyl(0.04, 0.04, 1.1, 4, gp.x, gp.y - 0.55, gp.z);
    crimsonParts.box(1.25, 1.15, 1.45, gp.x, gp.y - 1.45, gp.z);
    voidParts.box(1.30, 0.55, 1.15, gp.x, gp.y - 1.40, gp.z);
  }

  // Summit Plaza: 5 Concentric Stepped Circular Waterfall-Dish Terraces at (-577, 648)
  const tbX = -577.0;
  const tbZ = 648.0;
  const dishBaseY = summitY - 2.2;
  // Deep summit core anchor into mountain peak
  graniteParts.cyl(16.5, 19.0, 9.0, 16, tbX, dishBaseY - 4.2, tbZ);

  const dishRadii = [15.6, 13.0, 10.5, 8.2, 6.0];
  const dishStepH = 1.05;
  for (let d = 0; d < 5; d++) {
    const r = dishRadii[d];
    const dy = dishBaseY + d * dishStepH;
    // Flared circular granite lotus-dish rim + shimmering waterfall lip
    graniteParts.cyl(r, r * 0.88, 0.72, 16, tbX, dy + 0.36, tbZ);
    bronzeStatue.cyl(r + 0.18, r - 0.05, 0.22, 16, tbX, dy + 0.78, tbZ);
    marbleParts.cyl(r * 0.93, r * 0.96, 0.58, 16, tbX, dy + 0.42, tbZ);
    // 8 radial shimmering waterfall spillways cascading down each concentric lotus dish
    if (d > 0) {
      for (let wf = 0; wf < 8; wf++) {
        const wa = (wf / 8) * Math.PI * 2 + d * 0.39;
        marbleParts.box(
          0.92,
          dishStepH * 1.05,
          0.14,
          tbX + Math.cos(wa) * (r + 0.10),
          dy + 0.18,
          tbZ + Math.sin(wa) * (r + 0.10),
          { ry: -wa + Math.PI * 0.5 }
        );
      }
    }
  }
  // 8 gilded summit plaza lanterns & panoramic cloud-view terrace railings around the lowest waterfall-dish perimeter
  const viewRailR = 15.38;
  const viewSegs = 16;
  for (let sr = 0; sr < viewSegs; sr++) {
    const a0 = (sr / viewSegs) * Math.PI * 2;
    const a1 = ((sr + 1) / viewSegs) * Math.PI * 2;
    const p0x = tbX + Math.cos(a0) * viewRailR;
    const p0z = tbZ + Math.sin(a0) * viewRailR;
    const p1x = tbX + Math.cos(a1) * viewRailR;
    const p1z = tbZ + Math.sin(a1) * viewRailR;
    bronzeStatue.cyl(0.055, 0.065, 1.05, 4, p0x, dishBaseY + 1.24, p0z);
    goldParts.strut(
      new THREE.Vector3(p0x, dishBaseY + 1.72, p0z),
      new THREE.Vector3(p1x, dishBaseY + 1.72, p1z),
      0.045,
      0.045,
      4
    );
    bronzeStatue.strut(
      new THREE.Vector3(p0x, dishBaseY + 1.24, p0z),
      new THREE.Vector3(p1x, dishBaseY + 1.24, p1z),
      0.032,
      0.032,
      4
    );
  }
  for (let sl = 0; sl < 8; sl++) {
    const sla = (sl / 8) * Math.PI * 2 + 0.2;
    const lx = tbX + Math.cos(sla) * 14.9;
    const lz = tbZ + Math.sin(sla) * 14.9;
    bronzeStatue.cyl(0.14, 0.18, 1.35, 5, lx, dishBaseY + 1.45, lz);
    glowParts.sphere(0.24, 5, 4, lx, dishBaseY + 2.25, lz);
  }

  // Monumental Standing Bronze Đại Tượng Phật Bà Tây Bổ Đà Sơn (Tallest Bronze Quan Âm in Asia!)
  const throneY = dishBaseY + 5 * dishStepH - 0.15; // summitY + 2.9m
  const statueYaw = 0.62; // Facing SE across Tòa Thánh Cao Đài & Tây Ninh plain!

  // Summit Bronze Incense Cauldron (*Đỉnh Đồng Đỉnh Núi Bà Đen*) on retained SE cloud-view forecourt
  const incDist = 16.4;
  const sumIncX = tbX + Math.sin(statueYaw) * incDist;
  const sumIncZ = tbZ + Math.cos(statueYaw) * incDist;
  graniteParts.cyl(2.65, 3.15, 4.2, 8, sumIncX, dishBaseY - 1.32, sumIncZ);
  marbleParts.cyl(2.45, 2.55, 0.26, 8, sumIncX, dishBaseY + 0.85, sumIncZ);
  bronzeStatue.cyl(0.95, 1.15, 0.42, 8, sumIncX, dishBaseY + 1.18, sumIncZ);
  for (let leg = 0; leg < 3; leg++) {
    const la = (leg / 3) * Math.PI * 2 + statueYaw;
    bronzeStatue.cyl(0.14, 0.18, 0.68, 5, sumIncX + Math.cos(la) * 0.58, dishBaseY + 1.62, sumIncZ + Math.sin(la) * 0.58);
  }
  bronzeStatue.sphere(0.96, 8, 5, sumIncX, dishBaseY + 2.28, sumIncZ, [1.0, 0.72, 1.0]);
  goldParts.cyl(1.02, 0.98, 0.14, 8, sumIncX, dishBaseY + 2.75, sumIncZ);
  for (const side of [-1, 1]) {
    const hx = sumIncX + side * Math.cos(statueYaw) * 1.04;
    const hz = sumIncZ - side * Math.sin(statueYaw) * 1.04;
    goldParts.box(0.16, 0.62, 0.26, hx, dishBaseY + 2.72, hz, { ry: statueYaw });
  }
  glowParts.sphere(0.42, 6, 4, sumIncX, dishBaseY + 2.76, sumIncZ, [1.0, 0.32, 1.0]);

  // Núi Bà Đen Summit Cluster of 5 Buddhist Stone Bát Nhã Prayer Pillars (*Cụm 5 Trụ Kinh Bát Nhã Đá Granite Dát Vàng*)
  const w24PlAng = statueYaw - 0.72;
  const w24PlX = tbX + Math.sin(w24PlAng) * 16.8;
  const w24PlZ = tbZ + Math.cos(w24PlAng) * 16.8;
  graniteParts.cyl(3.8, 4.4, 5.6, 8, w24PlX, dishBaseY - 2.02, w24PlZ);
  marbleParts.cyl(3.6, 3.7, 0.16, 8, w24PlX, dishBaseY + 0.86, w24PlZ);
  const w24Pillars: Array<[number, number, number, number]> = [
    [0.0, 0.0, 4.6, 0.36],
    [2.15, 0.0, 3.1, 0.25],
    [-2.15, 0.0, 3.1, 0.25],
    [0.0, 2.15, 3.1, 0.25],
    [0.0, -2.15, 3.1, 0.25]
  ];
  for (let w24p = 0; w24p < w24Pillars.length; w24p++) {
    const [w24Dx, w24Dz, w24Ph, w24Pr] = w24Pillars[w24p];
    const w24Px = w24PlX + w24Dx;
    const w24Pz = w24PlZ + w24Dz;
    const w24BaseY = dishBaseY + 0.94;
    marbleParts.cyl(w24Pr * 1.45, w24Pr * 1.65, 0.38, 6, w24Px, w24BaseY + 0.19, w24Pz);
    graniteParts.cyl(w24Pr * 0.92, w24Pr, w24Ph, 6, w24Px, w24BaseY + 0.38 + w24Ph * 0.5, w24Pz);
    // Engraved golden Tibetan Heart Sutra (*Tâm Kinh Bát Nhã*) relief bands + gilded lotus-bud capstone
    goldParts.cyl(w24Pr * 1.03, w24Pr * 1.03, 0.18, 6, w24Px, w24BaseY + 0.38 + w24Ph * 0.36, w24Pz);
    goldParts.cyl(w24Pr * 1.01, w24Pr * 1.01, 0.18, 6, w24Px, w24BaseY + 0.38 + w24Ph * 0.72, w24Pz);
    goldParts.cone(w24Pr * 0.96, 0.58, 6, w24Px, w24BaseY + 0.38 + w24Ph + 0.29, w24Pz);
  }

  // Wave 29: Núi Bà Đen Iconic 986m Summit Landmark Obelisk ("Nóc Nhà Nam Bộ — 986m") on SW Cloud-View Terrace
  const w29MkAng = statueYaw - 1.45;
  const w29MkX = tbX + Math.sin(w29MkAng) * 16.8;
  const w29MkZ = tbZ + Math.cos(w29MkAng) * 16.8;
  graniteParts.cyl(3.2, 3.8, 5.6, 8, w29MkX, dishBaseY - 2.02, w29MkZ);
  marbleParts.cyl(2.95, 3.05, 0.18, 8, w29MkX, dishBaseY + 0.86, w29MkZ);
  graniteParts.box(2.15, 0.44, 2.15, w29MkX, dishBaseY + 1.16, w29MkZ, { ry: w29MkAng });
  bronzeStatue.cyl(0.56, 0.86, 2.85, 4, w29MkX, dishBaseY + 2.80, w29MkZ, { ry: w29MkAng + Math.PI * 0.25 });
  goldParts.cone(0.58, 0.92, 4, w29MkX, dishBaseY + 4.68, w29MkZ, { ry: w29MkAng + Math.PI * 0.25 });
  goldParts.box(0.86, 0.58, 0.12, w29MkX + Math.sin(w29MkAng) * 0.64, dishBaseY + 2.68, w29MkZ + Math.cos(w29MkAng) * 0.64, {
    ry: w29MkAng
  });
  for (let w29B = 0; w29B < 4; w29B++) {
    const w29Ba = w29MkAng + (w29B / 4) * Math.PI * 2 + Math.PI * 0.25;
    graniteParts.cyl(0.14, 0.18, 0.82, 5, w29MkX + Math.cos(w29Ba) * 2.45, dishBaseY + 1.32, w29MkZ + Math.sin(w29Ba) * 2.45);
    goldParts.sphere(0.11, 4, 3, w29MkX + Math.cos(w29Ba) * 2.45, dishBaseY + 1.78, w29MkZ + Math.sin(w29Ba) * 2.45);
  }

  // Giant Bronze Multi-Whorl Lotus Petal Throne (3 concentric rings of sculpted bronze lotus petals)
  bronzeStatue.cyl(4.4, 4.9, 1.35, 12, tbX, throneY + 0.55, tbZ);
  bronzeStatue.cyl(3.8, 3.3, 1.15, 12, tbX, throneY + 1.65, tbZ);
  // Wave 29: Sculpted Lê-Dynasty Bronze Cloud-Scroll Reliefs & Three Sacred Rain Droplets (*Ba Giọt Nước*) on Lotus Base
  for (let w29Cl = 0; w29Cl < 6; w29Cl++) {
    const w29Ca = (w29Cl / 6) * Math.PI * 2 + statueYaw;
    goldParts.sphere(
      0.52,
      5,
      4,
      tbX + Math.sin(w29Ca) * 4.72,
      throneY + 0.42,
      tbZ + Math.cos(w29Ca) * 4.72,
      [1.35, 0.55, 0.48]
    );
  }
  for (const w29DrOff of [-0.95, 0, 0.95]) {
    const w29DrX = tbX + Math.sin(statueYaw) * 4.88 + Math.cos(statueYaw) * w29DrOff;
    const w29DrZ = tbZ + Math.cos(statueYaw) * 4.88 - Math.sin(statueYaw) * w29DrOff;
    goldParts.cone(0.18, 0.48, 5, w29DrX, throneY + 0.48, w29DrZ);
  }
  const petalRings = [
    { n: 12, rad: 4.35, py: throneY + 0.85, tilt: -0.45, sc: 1.05 },
    { n: 12, rad: 3.95, py: throneY + 1.65, tilt: 0.38, sc: 1.0 },
    { n: 10, rad: 3.35, py: throneY + 2.15, tilt: 0.22, sc: 0.85 }
  ];
  for (let pr = 0; pr < petalRings.length; pr++) {
    const ring = petalRings[pr];
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + pr * 0.26;
      bronzeStatue.sphere(
        0.72 * ring.sc,
        5,
        4,
        tbX + Math.sin(a) * ring.rad,
        ring.py,
        tbZ + Math.cos(a) * ring.rad,
        [0.95, 1.48, 0.42]
      );
    }
  }

  // Flowing Standing Bronze Robes (*Áo cà sa*) sculpted via smooth LatheGeometry (~14.5m figure height above lotus seat!)
  const figureBaseY = throneY + 2.20;
  const robeProfile = [
    new THREE.Vector2(2.65, 0.0),
    new THREE.Vector2(2.25, 2.2),
    new THREE.Vector2(1.85, 5.2),
    new THREE.Vector2(1.58, 8.2),
    new THREE.Vector2(1.82, 10.4),
    new THREE.Vector2(1.22, 11.6),
    new THREE.Vector2(0.65, 12.2)
  ];
  const robeGeo = new THREE.LatheGeometry(robeProfile, 12);
  robeGeo.scale(1.06, 1.0, 0.82);
  transformGeometryXYZ(robeGeo, tbX, figureBaseY, tbZ, statueYaw);
  bronzeStatue.add(robeGeo);

  // Flowing side celestial bronze ribbons (*dải lụa*) & draped collar folds
  const cosSY = Math.cos(statueYaw);
  const sinSY = Math.sin(statueYaw);
  const stWorld = (lx: number, ly: number, lz: number): THREE.Vector3 =>
    new THREE.Vector3(tbX + lx * cosSY + lz * sinSY, figureBaseY + ly, tbZ - lx * sinSY + lz * cosSY);

  for (const sx of [-1, 1]) {
    bronzeStatue.strut(stWorld(sx * 1.65, 10.2, 0.1), stWorld(sx * 2.45, 5.8, 0.35), 0.34, 0.24, 5);
    bronzeStatue.strut(stWorld(sx * 2.45, 5.8, 0.35), stWorld(sx * 2.85, 1.4, -0.2), 0.26, 0.16, 5);
  }
  // Lê Dynasty pleated vertical robe drapery ribs, gilded waist sash & ornate chest necklace (*anh lạc*)
  for (const fx of [-0.95, -0.35, 0.35, 0.95]) {
    bronzeStatue.strut(stWorld(fx, 7.6, 1.32), stWorld(fx * 1.38, 0.4, 2.05), 0.16, 0.22, 4);
  }
  const sashPos = stWorld(0, 7.8, 0.10);
  goldParts.cyl(1.66, 1.68, 0.32, 10, sashPos.x, sashPos.y, sashPos.z);
  for (let nk = -2; nk <= 2; nk++) {
    const nkp = stWorld(nk * 0.42, 10.55 - Math.abs(nk) * 0.24, 1.32 - Math.abs(nk) * 0.12);
    goldParts.sphere(0.18, 5, 4, nkp.x, nkp.y, nkp.z);
  }

  // Right arm raised in compassionate Karana/Vitarka mudra + Left hand pouring downward-tilted Nectar Vase (*Bình Cam Lồ*)!
  bronzeStatue.strut(stWorld(1.55, 10.2, 0.15), stWorld(1.95, 8.6, 0.95), 0.36, 0.44, 6);
  bronzeStatue.strut(stWorld(1.95, 8.6, 0.95), stWorld(1.45, 10.1, 1.55), 0.28, 0.34, 6);

  bronzeStatue.strut(stWorld(-1.55, 10.2, 0.15), stWorld(-1.95, 7.8, 0.85), 0.36, 0.44, 6);
  const vasePos = stWorld(-2.05, 7.15, 1.35);
  goldParts.cyl(0.18, 0.42, 1.35, 6, vasePos.x, vasePos.y, vasePos.z, { rx: 0.72, ry: statueYaw });
  marbleParts.cone(0.28, 2.4, 5, vasePos.x, vasePos.y - 1.35, vasePos.z); // Nectar stream mist

  // Serene Bronze Head, Tall Ornate Amitabha Crown (*Mão Hóa Phật*) & Circular Bronze Aureole Halo
  const headPos = stWorld(0, 13.05, 0.12);
  bronzeStatue.sphere(1.08, 8, 6, headPos.x, headPos.y, headPos.z, [0.92, 1.14, 0.96]);
  // Wave 29: Radiant Forehead Wisdom Urna (*Tuệ Nhãn*) Jewel
  const w29UrnaPos = stWorld(0, 13.38, 1.14);
  glowParts.sphere(0.14, 5, 4, w29UrnaPos.x, w29UrnaPos.y, w29UrnaPos.z);
  const crownPos = stWorld(0, 14.55, 0.08);
  bronzeStatue.cyl(0.68, 0.92, 1.55, 8, crownPos.x, crownPos.y, crownPos.z);
  goldParts.cone(0.58, 1.15, 8, crownPos.x, crownPos.y + 1.25, crownPos.z);
  goldParts.box(0.42, 0.65, 0.18, crownPos.x + sinSY * 0.82, crownPos.y + 0.1, crownPos.z + cosSY * 0.82, { ry: statueYaw });

  // Circular bronze & gold radiating lotus-flame halo mounted cleanly behind shoulders/head
  const haloCenter = stWorld(0, 13.2, -0.85);
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const hx = Math.cos(a) * 2.25;
    const hy = Math.sin(a) * 2.25;
    const hp = stWorld(hx, 13.2 + hy, -0.85);
    goldParts.box(0.62, 0.18, 0.14, hp.x, hp.y, hp.z, { ry: statueYaw, rz: a + Math.PI * 0.5 });
    goldParts.strut(haloCenter, hp, 0.055, 0.075, 4);
  }
  bronzeStatue.strut(stWorld(0, 10.8, -0.4), haloCenter, 0.22, 0.22, 4);

  // ==========================================================================
  // 4B. GRAND CEREMONIAL AVENUE, CỔNG CHÁNH MÔN & TÒA THÁNH CAO ĐÀI (-505, 705)
  // ==========================================================================
  // Align Tòa Thánh front axis (-Z in local basilica space) directly toward Cổng Chánh Môn & Núi Bà Đen!
  const cdYaw = Math.atan2(nbdX - cdX, -(nbdZ - cdZ)); // local -Z points toward (nbdX, nbdZ)!
  const cosCD = Math.cos(cdYaw);
  const sinCD = Math.sin(cdYaw);
  const cdWorld = (lx: number, ly: number, lz: number): [number, number, number] => [
    cdX + lx * cosCD + lz * sinCD,
    plainY + ly,
    cdZ - lx * sinCD + lz * cosCD
  ];

  // Ceremonial Granite Avenue & Lotus Lantern Colonnade linking Cổng Chánh Môn (lz = -38m) to Basilica (lz = -24m)
  const [avX, avY, avZ] = cdWorld(0, 0.12, -33.0);
  graniteParts.box(14.0, 0.28, 26.0, avX, avY, avZ, { ry: cdYaw });
  // Ornate Octagonal Cao Đài Courtyard Lotus Fountain (*Đài Sen Sân Trước Tòa Thánh*) on central axis at lz = -37.5m
  const [w24Fx, w24Fy, w24Fz] = cdWorld(0, 0.26, -37.5);
  graniteParts.cyl(2.65, 2.85, 0.52, 8, w24Fx, w24Fy + 0.24, w24Fz);
  pinkBrickParts.cyl(2.75, 2.75, 0.14, 8, w24Fx, w24Fy + 0.52, w24Fz);
  jadeParts.cyl(2.38, 2.38, 0.44, 8, w24Fx, w24Fy + 0.26, w24Fz);
  marbleParts.cyl(0.85, 1.15, 0.55, 8, w24Fx, w24Fy + 0.54, w24Fz);
  marbleParts.cyl(0.45, 0.65, 0.65, 8, w24Fx, w24Fy + 1.08, w24Fz);
  for (let w24lp = 0; w24lp < 6; w24lp++) {
    const w24la = (w24lp / 6) * Math.PI * 2 + cdYaw;
    pinkBrickParts.sphere(
      0.42,
      5,
      4,
      w24Fx + Math.cos(w24la) * 0.72,
      w24Fy + 1.38,
      w24Fz + Math.sin(w24la) * 0.72,
      [1.15, 0.55, 0.72]
    );
  }
  goldParts.cone(0.32, 0.68, 6, w24Fx, w24Fy + 1.72, w24Fz);
  marbleParts.cyl(0.08, 0.18, 0.95, 5, w24Fx, w24Fy + 2.36, w24Fz);
  glowParts.sphere(0.18, 5, 4, w24Fx, w24Fy + 2.88, w24Fz);
  for (const lz of [-42.0, -35.0, -29.0]) {
    for (const lx of [-7.6, 7.6]) {
      const [px, py, pz] = cdWorld(lx, 1.8, lz);
      pinkBrickParts.box(0.55, 3.6, 0.55, px, py, pz, { ry: cdYaw });
      glowParts.sphere(0.28, 6, 4, px, py + 2.0, pz);
    }
  }

  // Iconic Cổng Chánh Môn (Triple Ceremonial Gateway) at lz = -44.0m (~ (-533, 683))
  for (const gx of [-8.2, -3.4, 3.4, 8.2]) {
    const isInner = Math.abs(gx) < 5.0;
    const gh = isInner ? 8.8 : 6.4;
    const [px, py, pz] = cdWorld(gx, gh * 0.5 - 0.2, -44.0);
    pinkBrickParts.box(1.15, gh + 0.5, 1.15, px, py, pz, { ry: cdYaw });
    ochreParts.box(1.35, 0.42, 1.35, px, plainY + gh, pz, { ry: cdYaw });
    goldParts.cone(0.55, 1.1, 6, px, plainY + gh + 0.72, pz);
  }
  const [cmLintelX, cmLintelY, cmLintelZ] = cdWorld(0, 7.4, -44.0);
  pinkBrickParts.box(8.2, 1.35, 1.05, cmLintelX, cmLintelY, cmLintelZ, { ry: cdYaw });
  ochreParts.box(17.8, 0.85, 0.92, cmLintelX, plainY + 5.6, cmLintelZ, { ry: cdYaw });
  // Arched portal spandrels & glowing Thiên Nhãn medallion on Cổng Chánh Môn lintel
  const [gmEyeX, gmEyeY, gmEyeZ] = cdWorld(0, 7.4, -44.62);
  jadeParts.cyl(0.68, 0.68, 0.18, 8, gmEyeX, gmEyeY, gmEyeZ, { rx: Math.PI * 0.5, ry: cdYaw });
  glowParts.sphere(0.38, 6, 4, gmEyeX, gmEyeY, gmEyeZ, [1.4, 0.72, 0.35]);
  for (const sx of [-1, 1]) {
    const [spX, spY, spZ] = cdWorld(sx * 2.55, 6.25, -44.0);
    pinkBrickParts.box(1.15, 0.85, 0.96, spX, spY, spZ, { ry: cdYaw, rz: sx * 0.45 });
  }
  // Twin dragons & sacred lotus crest atop Cổng Chánh Môn
  const gateCrest = createRoofFinialSetParts(cmLintelX, plainY + 8.15, cmLintelZ, 6.2, cdYaw, 0.85, false);
  jadeParts.add(...gateCrest.mainParts);
  goldParts.add(...gateCrest.goldParts);

  // Wave 29: Twin Sculpted Kỳ Lân Guardian Plinths Flanking Cổng Chánh Môn & Twin Octagonal Bát Quái Courtyard Lantern Pavilions
  for (const w29KlSide of [-1, 1]) {
    const [w29KlX, w29KlY, w29KlZ] = cdWorld(w29KlSide * 5.6, 0.42, -45.8);
    graniteParts.box(1.55, 0.82, 1.85, w29KlX, w29KlY, w29KlZ, { ry: cdYaw });
    pinkBrickParts.box(1.22, 0.48, 1.48, w29KlX, w29KlY + 0.62, w29KlZ, { ry: cdYaw });
    goldParts.box(0.66, 0.72, 1.12, w29KlX, w29KlY + 1.22, w29KlZ, { ry: cdYaw });
    goldParts.sphere(0.36, 5, 4, w29KlX - sinCD * 0.48, w29KlY + 1.66, w29KlZ - cosCD * 0.48);
    crimsonParts.cone(0.12, 0.36, 4, w29KlX - sinCD * 0.48, w29KlY + 2.08, w29KlZ - cosCD * 0.48);
  }
  for (const w29LpSide of [-1, 1]) {
    const [w29LpX, w29LpY, w29LpZ] = cdWorld(w29LpSide * 9.6, 0.36, -26.5);
    graniteParts.cyl(1.15, 1.32, 0.56, 8, w29LpX, w29LpY, w29LpZ);
    pinkBrickParts.cyl(0.42, 0.52, 1.85, 8, w29LpX, w29LpY + 1.18, w29LpZ);
    ochreParts.cyl(0.88, 0.68, 0.24, 8, w29LpX, w29LpY + 2.18, w29LpZ);
    glowParts.cyl(0.54, 0.54, 0.78, 8, w29LpX, w29LpY + 2.68, w29LpZ);
    roofParts.cone(1.08, 0.72, 8, w29LpX, w29LpY + 3.42, w29LpZ);
    goldParts.sphere(0.18, 5, 4, w29LpX, w29LpY + 3.86, w29LpZ);
  }

  // ==========================================================================
  // TÒA THÁNH CAO ĐÀI TÂY NINH (48m-long Cửu Trùng Đài Basilica, castShadow = true on main body!)
  // ==========================================================================
  const toaThanhMainBodyShadow = new PartsBuilder(); // castShadow = true ONLY here for Tòa Thánh!

  // Deep granite courtyard esplanade around Tòa Thánh
  const [espX, espY, espZ] = cdWorld(0, 0.14, 0);
  graniteParts.box(26.0, 0.45, 54.0, espX, espY - 0.08, espZ, { ry: cdYaw });

  // 1) Twin 6-Story Lầu Chuông & Lầu Trống (Hiệp Thiên Đài) Front Towers at lx = ±6.2m, lz = -20.5m (~27.5m tall!)
  const towerH = 21.6;
  for (const sx of [-1, 1]) {
    const lx = sx * 6.2;
    const lz = -20.5;
    const [tx, ty, tz] = cdWorld(lx, towerH * 0.5, lz);
    // Main yellow-ochre tower shaft (castShadow = true!)
    toaThanhMainBodyShadow.box(4.8, towerH, 4.8, tx, ty, tz, { ry: cdYaw });

    // 6 distinct story cornices, salmon-pink recessed panels & arched windows
    for (let st = 0; st < 6; st++) {
      const sy = st * 3.55;
      const [cx0, cy0, cz0] = cdWorld(lx, sy + 3.45, lz);
      pinkBrickParts.box(5.15, 0.30, 5.15, cx0, cy0, cz0, { ry: cdYaw });
      const [px0, py0, pz0] = cdWorld(lx, sy + 1.8, lz);
      pinkBrickParts.box(3.4, 2.5, 4.92, px0, py0, pz0, { ry: cdYaw });
      pinkBrickParts.box(4.92, 2.5, 3.4, px0, py0, pz0, { ry: cdYaw });
      if (st >= 1) {
        voidParts.box(1.35, 1.75, 5.02, px0, py0 + 0.1, pz0, { ry: cdYaw });
        voidParts.box(5.02, 1.75, 1.35, px0, py0 + 0.1, pz0, { ry: cdYaw });
      }
    }

    // Curved upturned pagoda-eave cornice beneath octagonal turret drum + Great Bell (left) / Great Drum (right)
    const [eaveX, eaveY, eaveZ] = cdWorld(lx, towerH - 0.15, lz);
    const towerEave = createVietnameseCurvedRoofGeometry(6.2, 6.2, 3.8, 3.8, 1.15, 0.24, 4, 4);
    transformGeometryXYZ(towerEave, eaveX, eaveY, eaveZ, cdYaw);
    roofParts.add(towerEave);
    const [bellX, bellY, bellZ] = cdWorld(lx, towerH - 1.9, lz);
    if (sx < 0) {
      bronzeStatue.cyl(0.55, 0.85, 1.35, 6, bellX, bellY, bellZ); // Đại Hồng Chung (Great Bell)
    } else {
      crimsonParts.cyl(0.75, 0.75, 1.25, 6, bellX, bellY, bellZ, { rx: Math.PI * 0.5, ry: cdYaw }); // Trống Lôi Âm (Great Drum)
      goldParts.cyl(0.78, 0.78, 0.14, 6, bellX, bellY, bellZ, { rx: Math.PI * 0.5, ry: cdYaw });
    }
    // Pointed octagonal turret drum + terracotta spire roof + lightning finial (~28.2m total!)
    const [drX, drY, drZ] = cdWorld(lx, towerH + 1.65, lz);
    ochreParts.cyl(2.05, 2.25, 3.3, 8, drX, drY, drZ);
    const [spX, spY, spZ] = cdWorld(lx, towerH + 4.85, lz);
    roofParts.cone(2.45, 3.2, 8, spX, spY, spZ);
    goldParts.cyl(0.06, 0.14, 1.8, 5, spX, spY + 2.3, spZ);
  }

  // 2) Central Bao Đài Facade, Semicircular Ceremonial Staircase & Glowing Thiên Nhãn on the Blue Càn Khôn Star-Globe!
  const [bdFacX, bdFacY, bdFacZ] = cdWorld(0, 7.2, -20.8);
  toaThanhMainBodyShadow.box(7.8, 14.4, 4.4, bdFacX, bdFacY, bdFacZ, { ry: cdYaw });
  // Curved front portico, semicircular stepped grand staircase, dragon-entwined balustrades & pink-cyan balconies
  const [porX, porY, porZ] = cdWorld(0, 2.8, -23.4);
  pinkBrickParts.cyl(3.4, 3.6, 5.6, 8, porX, porY, porZ);
  for (let st = 0; st < 4; st++) {
    const [stX, stY, stZ] = cdWorld(0, 0.35 + st * 0.28, -25.2 - (3 - st) * 0.55);
    marbleParts.cyl(3.8 + (3 - st) * 0.45, 4.0 + (3 - st) * 0.45, 0.30, 8, stX, stY, stZ);
  }
  const [balX, balY, balZ] = cdWorld(0, 6.2, -23.4);
  jadeParts.cyl(3.65, 3.65, 0.45, 8, balX, balY, balZ);
  // Front portico upper balcony balustrade ring & gilded dragon-entwined portico pillars
  for (let b = 0; b < 8; b++) {
    const ba = (b / 8) * Math.PI * 2 + cdYaw;
    const bx = balX + Math.sin(ba) * 3.42;
    const bz = balZ + Math.cos(ba) * 3.42;
    marbleParts.cyl(0.08, 0.09, 0.92, 5, bx, balY + 0.68, bz);
  }
  pinkBrickParts.cyl(3.52, 3.52, 0.14, 8, balX, balY + 1.16, balZ);
  // Flanking dragon-cheek stair balustrades & dragon-head newel posts at foot of grand staircase
  for (const side of [-1, 1]) {
    const [topNX, topNY, topNZ] = cdWorld(side * 3.65, 1.95, -24.4);
    const [botNX, botNY, botNZ] = cdWorld(side * 4.55, 0.95, -27.4);
    pinkBrickParts.strut(new THREE.Vector3(topNX, topNY, topNZ), new THREE.Vector3(botNX, botNY, botNZ), 0.24, 0.28, 5);
    goldParts.strut(new THREE.Vector3(topNX, topNY + 0.26, topNZ), new THREE.Vector3(botNX, botNY + 0.26, botNZ), 0.11, 0.13, 4);
    marbleParts.box(0.68, 1.15, 0.68, botNX, plainY + 0.62, botNZ, { ry: cdYaw });
    goldParts.sphere(0.32, 5, 4, botNX, plainY + 1.38, botNZ, [0.95, 1.1, 1.35]);
    crimsonParts.cone(0.14, 0.45, 4, botNX, plainY + 1.72, botNZ);
  }
  // Monumental central courtyard bronze-and-gold incense cauldron (*Lư Hương Lớn*) + twin flanking incense urns
  const [cuX, cuY, cuZ] = cdWorld(0, 0.18, -30.6);
  graniteParts.cyl(1.45, 1.72, 0.48, 8, cuX, cuY + 0.14, cuZ);
  bronzeStatue.cyl(0.76, 0.62, 1.05, 8, cuX, cuY + 0.92, cuZ);
  bronzeStatue.sphere(0.84, 8, 5, cuX, cuY + 1.48, cuZ, [1.0, 0.68, 1.0]);
  goldParts.cyl(0.88, 0.85, 0.14, 8, cuX, cuY + 1.88, cuZ);
  glowParts.sphere(0.34, 5, 4, cuX, cuY + 1.92, cuZ, [1.0, 0.35, 1.0]);
  for (const side of [-1, 1]) {
    const [fuX, fuY, fuZ] = cdWorld(side * 5.4, 0.18, -28.8);
    graniteParts.cyl(0.75, 0.88, 0.38, 6, fuX, fuY + 0.12, fuZ);
    bronzeStatue.cyl(0.42, 0.34, 0.78, 6, fuX, fuY + 0.72, fuZ);
    goldParts.cyl(0.48, 0.46, 0.12, 6, fuX, fuY + 1.14, fuZ);
  }

  // Wave 26: Tòa Thánh Cao Đài Courtyard Ceremonial Bronze Gong Stand (Left, Bell-Tower Side) & Lacquered Drum Stand (Right, Drum-Tower Side)
  const w26CdLz = -33.2;
  // Left: Ceremonial Bronze Gong Stand (*Giá Chiêng Đồng*) at lx = -5.4
  const [w26Gx, w26Gy, w26Gz] = cdWorld(-5.4, 0.32, w26CdLz);
  graniteParts.box(2.3, 0.34, 1.35, w26Gx, w26Gy, w26Gz, { ry: cdYaw });
  for (const w26GOff of [-0.78, 0.78]) {
    const [w26PstX, w26PstY, w26PstZ] = cdWorld(-5.4 + w26GOff, 1.66, w26CdLz);
    crimsonParts.cyl(0.09, 0.11, 2.35, 6, w26PstX, w26PstY, w26PstZ);
    const [w26ShX, w26ShY, w26ShZ] = cdWorld(-5.4 + w26GOff, 0.60, w26CdLz);
    crimsonParts.box(0.14, 0.24, 0.92, w26ShX, w26ShY, w26ShZ, { ry: cdYaw });
    const [w26FnX, w26FnY, w26FnZ] = cdWorld(-5.4 + w26GOff * 1.48, 3.06, w26CdLz);
    goldParts.cone(0.11, 0.34, 4, w26FnX, w26FnY, w26FnZ, { ry: cdYaw, rz: w26GOff < 0 ? 0.45 : -0.45 });
  }
  const [w26BmX, w26BmY, w26BmZ] = cdWorld(-5.4, 2.84, w26CdLz);
  crimsonParts.box(2.15, 0.16, 0.16, w26BmX, w26BmY, w26BmZ, { ry: cdYaw });
  goldParts.box(2.38, 0.08, 0.18, w26BmX, w26BmY + 0.11, w26BmZ, { ry: cdYaw });
  for (const w26CdOff of [-0.28, 0.28]) {
    const [w26TopX, w26TopY, w26TopZ] = cdWorld(-5.4 + w26CdOff, 2.76, w26CdLz);
    const [w26BotX, w26BotY, w26BotZ] = cdWorld(-5.4 + w26CdOff, 2.22, w26CdLz);
    goldParts.strut(new THREE.Vector3(w26TopX, w26TopY, w26TopZ), new THREE.Vector3(w26BotX, w26BotY, w26BotZ), 0.024, 0.024, 4);
  }
  const [w26GdX, w26GdY, w26GdZ] = cdWorld(-5.4, 1.66, w26CdLz);
  bronzeStatue.cyl(0.62, 0.62, 0.12, 10, w26GdX, w26GdY, w26GdZ, { rx: Math.PI * 0.5, ry: cdYaw });
  goldParts.sphere(0.16, 6, 4, w26GdX, w26GdY, w26GdZ);

  // Right: Ceremonial Lacquered Barrel Drum Stand (*Giá Trống Đại Lễ*) at lx = +5.4
  const [w26Dx, w26Dy, w26Dz] = cdWorld(5.4, 0.32, w26CdLz);
  graniteParts.box(2.3, 0.34, 1.55, w26Dx, w26Dy, w26Dz, { ry: cdYaw });
  for (const w26DzOff of [-0.42, 0.42]) {
    const [w26ALX, w26ALY, w26ALZ] = cdWorld(5.4 - 0.56, 0.48, w26CdLz + w26DzOff);
    const [w26ARX, w26ARY, w26ARZ] = cdWorld(5.4 + 0.56, 1.38, w26CdLz + w26DzOff);
    const [w26BLX, w26BLY, w26BLZ] = cdWorld(5.4 + 0.56, 0.48, w26CdLz + w26DzOff);
    const [w26BRX, w26BRY, w26BRZ] = cdWorld(5.4 - 0.56, 1.38, w26CdLz + w26DzOff);
    crimsonParts.strut(new THREE.Vector3(w26ALX, w26ALY, w26ALZ), new THREE.Vector3(w26ARX, w26ARY, w26ARZ), 0.06, 0.07, 4);
    crimsonParts.strut(new THREE.Vector3(w26BLX, w26BLY, w26BLZ), new THREE.Vector3(w26BRX, w26BRY, w26BRZ), 0.06, 0.07, 4);
  }
  const [w26TbX, w26TbY, w26TbZ] = cdWorld(5.4, 0.94, w26CdLz);
  crimsonParts.box(0.14, 0.14, 1.08, w26TbX, w26TbY, w26TbZ, { ry: cdYaw });
  const [w26DmX, w26DmY, w26DmZ] = cdWorld(5.4, 1.62, w26CdLz);
  crimsonParts.cyl(0.62, 0.62, 1.18, 10, w26DmX, w26DmY, w26DmZ, { rx: Math.PI * 0.5, ry: cdYaw });
  marbleParts.cyl(0.56, 0.56, 1.24, 10, w26DmX, w26DmY, w26DmZ, { rx: Math.PI * 0.5, ry: cdYaw });
  goldParts.cyl(0.64, 0.64, 0.10, 10, w26DmX, w26DmY, w26DmZ, { rx: Math.PI * 0.5, ry: cdYaw });
  for (const w26HoopZ of [-0.54, 0.54]) {
    const [w26HpX, w26HpY, w26HpZ] = cdWorld(5.4, 1.62, w26CdLz + w26HoopZ);
    goldParts.cyl(0.61, 0.61, 0.08, 10, w26HpX, w26HpY, w26HpZ, { rx: Math.PI * 0.5, ry: cdYaw });
  }
  const [pedX, pedY, pedZ] = cdWorld(0, 15.6, -21.0);
  pinkBrickParts.cone(4.6, 3.2, 4, pedX, pedY, pedZ, { ry: cdYaw + Math.PI * 0.25 });

  // Blue Càn Khôn Star-Globe (jade/blue-cyan sphere studded with white stars) + Glowing Thiên Nhãn Eye + Gold Sun-Rays!
  const [eyeX, eyeY, eyeZ] = cdWorld(0, 11.4, -22.95);
  jadeParts.sphere(2.05, 10, 8, eyeX, eyeY, eyeZ, [1.0, 1.0, 0.55]);
  // Star dots across Càn Khôn globe
  for (let st = 0; st < 10; st++) {
    const sa = (st / 10) * Math.PI * 2;
    const sr = st % 2 === 0 ? 1.45 : 0.95;
    const [sx0, sy0, sz0] = cdWorld(Math.cos(sa) * sr, 11.4 + Math.sin(sa) * sr, -23.95);
    marbleParts.sphere(0.09, 4, 3, sx0, sy0, sz0);
  }
  // Golden radiating sun-rays around Thiên Nhãn
  for (let ray = 0; ray < 12; ray++) {
    const ra = (ray / 12) * Math.PI * 2;
    const [rx0, ry0, rz0] = cdWorld(Math.cos(ra) * 2.35, 11.4 + Math.sin(ra) * 2.35, -23.15);
    goldParts.cone(0.14, 0.85, 4, rx0, ry0, rz0, { ry: cdYaw, rz: ra - Math.PI * 0.5 });
  }
  // Glowing Divine Eye almond sclera & dark pupil looking forward (-Z)
  const [pupX, pupY, pupZ] = cdWorld(0, 11.4, -24.06);
  glowParts.sphere(0.72, 8, 5, pupX, pupY, pupZ, [1.55, 0.72, 0.35]);
  const [irisX, irisY, irisZ] = cdWorld(0, 11.4, -24.26);
  voidParts.sphere(0.30, 6, 4, irisX, irisY, irisZ, [1.0, 1.0, 0.45]);

  // 3) 9 Stepped Floor & Roof Levels (Cửu Trùng Đài, 9 bays × 3.8m = 34.2m nave from lz = -18.5m to +15.7m)
  const bayLen = 3.8;
  for (let lvl = 0; lvl < 9; lvl++) {
    const lz = -16.6 + lvl * bayLen;
    const stepFloorH = 0.75 + lvl * 0.24; // 9 ascending floor steps!
    const wallH = 8.4 + lvl * 0.28;
    const [bx, by, bz] = cdWorld(0, stepFloorH * 0.5, lz);
    graniteParts.box(17.8, stepFloorH + 0.3, bayLen + 0.08, bx, by, bz, { ry: cdYaw });

    const [wx, wy, wz] = cdWorld(0, stepFloorH + wallH * 0.5, lz);
    toaThanhMainBodyShadow.box(15.2, wallH, bayLen + 0.06, wx, wy, wz, { ry: cdYaw });

    // Pink & cyan-jade upper clerestory frieze + arched side windows
    const [fx, fy, fz] = cdWorld(0, stepFloorH + wallH - 0.85, lz);
    pinkBrickParts.box(15.5, 1.15, bayLen * 0.88, fx, fy, fz, { ry: cdYaw });
    voidParts.box(15.35, 2.6, 1.45, wx, stepFloorH + 3.8, wz, { ry: cdYaw });

    // Dragon-entwined exterior colonnade columns along both flanks of all 9 levels!
    for (const side of [-1, 1]) {
      const [colX, colY, colZ] = cdWorld(side * 8.15, stepFloorH + (wallH - 1.2) * 0.5, lz);
      jadeParts.cyl(0.26, 0.30, wallH - 1.2, 6, colX, colY, colZ);
      // Spiral golden/crimson dragon coils + sculpted projecting dragon head capital at top of each column
      for (let coil = 0; coil < 3; coil++) {
        const cy = colY - (wallH - 1.2) * 0.32 + coil * 2.1;
        goldParts.cyl(0.36, 0.36, 0.28, 6, colX, cy, colZ, { rx: 0.32 * side });
        crimsonParts.cyl(0.34, 0.34, 0.18, 6, colX, cy + 0.55, colZ, { rx: -0.32 * side });
      }
      const [dhX, dhY, dhZ] = cdWorld(side * 8.55, stepFloorH + wallH - 1.45, lz);
      goldParts.box(0.55, 0.42, 0.48, dhX, dhY, dhZ, { ry: cdYaw });
    }

    // Stepped curved terracotta nave & aisle roof for each of the 9 levels!
    const stepRoof = createHueImperialHipRoofGeometry(17.6, bayLen + 0.65, 8.8, bayLen + 0.25, 2.35, 0.26, 4, 3, true);
    const [rx, ry, rz] = cdWorld(0, stepFloorH + wallH, lz);
    transformGeometryXYZ(stepRoof, rx, ry, rz, cdYaw);
    roofParts.add(stepRoof);
    const [rdgX, rdgY, rdgZ] = cdWorld(0, stepFloorH + wallH + 2.42, lz);
    goldParts.box(0.45, 0.28, bayLen + 0.35, rdgX, rdgY, rdgZ, { ry: cdYaw });
  }

  // 4) Central Rooftop Circular Nghinh Phong Đài Drum-Dome Topped by *Long Mã* (at bay 4, lz = -1.4m)
  const npBaseH = 0.75 + 4 * 0.24 + (8.4 + 4 * 0.28) + 2.2;
  const [npX, npY, npZ] = cdWorld(0, npBaseH + 1.6, -1.4);
  jadeParts.cyl(3.2, 3.4, 3.2, 10, npX, npY, npZ);
  ochreParts.cyl(3.45, 3.45, 0.28, 10, npX, npY + 1.65, npZ);
  jadeParts.sphere(3.15, 10, 6, npX, npY + 1.75, npZ, [1.0, 0.78, 1.0]);
  // Sculpted Golden *Long Mã* (Dragon-Horse carrying *Hà Đồ* Cosmic Scroll) galloping atop Nghinh Phong Đài!
  const lmBaseLocalY = npY - plainY + 4.15;
  const [lmPedX, lmPedY, lmPedZ] = cdWorld(0, lmBaseLocalY, -1.4);
  marbleParts.cyl(1.12, 1.32, 0.36, 8, lmPedX, lmPedY, lmPedZ);
  goldParts.cyl(0.95, 1.05, 0.22, 8, lmPedX, lmPedY + 0.26, lmPedZ);
  const [lmBodyX, lmBodyY, lmBodyZ] = cdWorld(0, lmBaseLocalY + 1.02, -1.4);
  goldParts.box(0.68, 0.72, 1.85, lmBodyX, lmBodyY, lmBodyZ, { ry: cdYaw });
  crimsonParts.box(0.76, 0.34, 0.78, lmBodyX, lmBodyY + 0.28, lmBodyZ, { ry: cdYaw }); // Saddle blanket
  // 4 prancing dragon-horse legs (front forelegs raised dynamically in gallop!)
  for (const sx of [-0.28, 0.28]) {
    const [fhTopX, fhTopY, fhTopZ] = cdWorld(sx, lmBaseLocalY + 0.85, -2.05);
    const [fhBotX, fhBotY, fhBotZ] = cdWorld(sx, lmBaseLocalY + 0.42, -2.55);
    goldParts.strut(new THREE.Vector3(fhTopX, fhTopY, fhTopZ), new THREE.Vector3(fhBotX, fhBotY, fhBotZ), 0.09, 0.11, 4);
    const [rhTopX, rhTopY, rhTopZ] = cdWorld(sx, lmBaseLocalY + 0.88, -0.72);
    const [rhBotX, rhBotY, rhBotZ] = cdWorld(sx, lmBaseLocalY + 0.28, -0.52);
    goldParts.strut(new THREE.Vector3(rhTopX, rhTopY, rhTopZ), new THREE.Vector3(rhBotX, rhBotY, rhBotZ), 0.09, 0.12, 4);
  }
  // Arched dragon neck, horned head, crimson mane & sweeping dragon tail
  const [nkBaseX, nkBaseY, nkBaseZ] = cdWorld(0, lmBaseLocalY + 1.18, -2.18);
  const [hdX, hdY, hdZ] = cdWorld(0, lmBaseLocalY + 1.98, -2.58);
  goldParts.strut(new THREE.Vector3(nkBaseX, nkBaseY, nkBaseZ), new THREE.Vector3(hdX, hdY, hdZ), 0.18, 0.24, 5);
  goldParts.box(0.44, 0.42, 0.68, hdX, hdY + 0.06, hdZ, { ry: cdYaw });
  crimsonParts.box(0.16, 0.75, 0.26, nkBaseX, nkBaseY + 0.42, nkBaseZ, { rx: 0.42, ry: cdYaw });
  for (const sx of [-0.16, 0.16]) {
    const [hnX, hnY, hnZ] = cdWorld(sx, lmBaseLocalY + 2.38, -2.48);
    goldParts.cone(0.06, 0.36, 4, hnX, hnY, hnZ, { rx: -0.35, ry: cdYaw });
  }
  const [tlBaseX, tlBaseY, tlBaseZ] = cdWorld(0, lmBaseLocalY + 1.12, -0.48);
  const [tlTipX, tlTipY, tlTipZ] = cdWorld(0, lmBaseLocalY + 1.65, 0.18);
  goldParts.strut(new THREE.Vector3(tlBaseX, tlBaseY, tlBaseZ), new THREE.Vector3(tlTipX, tlTipY, tlTipZ), 0.08, 0.12, 4);
  crimsonParts.cone(0.16, 0.44, 4, tlTipX, tlTipY + 0.14, tlTipZ, { rx: -0.4, ry: cdYaw });
  // Jade *Hà Đồ* cosmic diagram scroll & radiant golden pearl carried on Long Mã's back
  jadeParts.cyl(0.24, 0.24, 0.92, 6, lmBodyX, lmBodyY + 0.62, lmBodyZ, { rz: Math.PI * 0.5, ry: cdYaw });
  goldParts.sphere(0.24, 6, 4, lmBodyX, lmBodyY + 1.04, lmBodyZ);

  // 5) Octagonal Bát Quái Đài Sanctuary at the Rear (lz = +20.2m)
  const bqFloorH = 0.75 + 9 * 0.24;
  const bqWallH = 12.2;
  const [bqX, bqY, bqZ] = cdWorld(0, bqFloorH * 0.5, 20.2);
  graniteParts.cyl(7.8, 8.2, bqFloorH + 0.4, 8, bqX, bqY, bqZ);
  const [bqwX, bqwY, bqwZ] = cdWorld(0, bqFloorH + bqWallH * 0.5, 20.2);
  toaThanhMainBodyShadow.cyl(6.8, 7.1, bqWallH, 8, bqwX, bqwY, bqwZ);
  pinkBrickParts.cyl(7.25, 7.25, 0.45, 8, bqwX, plainY + bqFloorH + bqWallH * 0.55, bqwZ);
  // 8 octagonal sanctuary arched windows + 8 gilded upturned corner hip dragon finials
  for (let oct = 0; oct < 8; oct++) {
    const oa = (oct / 8) * Math.PI * 2 + cdYaw;
    const wx = bqwX + Math.sin(oa) * 6.85;
    const wz = bqwZ + Math.cos(oa) * 6.85;
    pinkBrickParts.box(1.55, 2.55, 0.24, wx, plainY + bqFloorH + 4.4, wz, { ry: oa });
    voidParts.box(1.15, 2.05, 0.30, wx, plainY + bqFloorH + 4.4, wz, { ry: oa });
    goldParts.cone(0.24, 0.95, 4, bqwX + Math.sin(oa + Math.PI / 8) * 7.85, plainY + bqFloorH + bqWallH + 0.35, bqwZ + Math.cos(oa + Math.PI / 8) * 7.85, { rz: 0.35, ry: oa });
  }
  // 2-tier octagonal curved roof & golden stupa finial crowning Bát Quái Đài
  const [bqr1X, bqr1Y, bqr1Z] = cdWorld(0, bqFloorH + bqWallH + 1.2, 20.2);
  roofParts.cone(8.2, 2.6, 8, bqr1X, bqr1Y, bqr1Z);
  const [bqr2X, bqr2Y, bqr2Z] = cdWorld(0, bqFloorH + bqWallH + 3.4, 20.2);
  ochreParts.cyl(4.2, 4.5, 2.2, 8, bqr2X, bqr2Y - 0.6, bqr2Z);
  roofParts.cone(5.4, 2.5, 8, bqr2X, bqr2Y + 1.1, bqr2Z);
  goldParts.sphere(0.65, 6, 5, bqr2X, bqr2Y + 2.8, bqr2Z);
  goldParts.cone(0.35, 1.5, 6, bqr2X, bqr2Y + 3.9, bqr2Z);

  // Ornamental sala / bodhi trees along outer sacred grounds (>= 6.5m clear of all buildings)
  const sacredTrees: Array<[number, number]> = [
    [-482.0, 692.0],
    [-486.0, 722.0],
    [-524.0, 728.0],
    [-550.0, 706.0]
  ];
  for (let i = 0; i < sacredTrees.length; i++) {
    const [tx, tz] = sacredTrees[i];
    barkParts.cyl(0.18, 0.28, 4.2, 5, tx, plainY + 2.0, tz);
    jadeParts.sphere(1.85, 6, 4, tx, plainY + 4.5, tz, [1.25, 0.72, 1.25]);
  }

  commitPartsMesh(group, massifRockShadow, 'NuiBaDenMassifRock', ctx.materials.stone, true, true, 4.2);
  commitPartsMesh(group, mountainMoss, 'NuiBaDenForestedSlopes', ctx.materials.mossyPlaster ?? ctx.materials.stone, false, true, 3.8);
  commitPartsMesh(group, toaThanhMainBodyShadow, 'ToaThanhCaoDaiMainBody', ctx.materials.yellowOchrePlaster, true, true, 2.6);
  commitPartsMesh(group, ochreParts, 'TayNinhYellowPlasterTrim', ctx.materials.yellowOchrePlaster, false, true, 2.4);
  commitPartsMesh(group, pinkBrickParts, 'ToaThanhPinkAccents', ctx.materials.chamBrick, false, true, 2.4);
  commitPartsMesh(group, jadeParts, 'TayNinhJadeCyanAndLawn', ctx.materials.jadeRoof ?? ctx.materials.darkRoof, false, true, 2.8);
  commitPartsMesh(group, graniteParts, 'TayNinhGraniteTerraces', ctx.materials.granite, false, true, 2.8);
  commitPartsMesh(group, marbleParts, 'TayNinhMarbleDomesAndWater', ctx.materials.whiteMarble ?? ctx.materials.whitePlaster, false, true, 2.6);
  commitPartsMesh(group, domeGlass, 'GaVanSonCurvedDomeGlass', ctx.materials.stainedGlass ?? ctx.materials.gold, false, false);
  commitPartsMesh(group, bronzeStatue, 'DaiTuongPhatBaTayBoDaSon', ctx.materials.bronze, false, true);
  commitPartsMesh(group, goldParts, 'TayNinhSacredGoldOrnament', ctx.materials.gold, false, false);
  commitPartsMesh(group, crimsonParts, 'TayNinhSacredCrimson', ctx.materials.crimsonLacquer, false, true);
  commitPartsMesh(group, roofParts, 'TayNinhSacredTerracottaRoofs', ctx.materials.terracottaRoof, false, true);
  commitPartsMesh(group, glowParts, 'ThienNhanAndLanternGlow', ctx.materials.lanternCore ?? ctx.materials.lanternSilk, false, false);
  commitPartsMesh(group, woodParts, 'TayNinhTimberDetails', ctx.materials.darkWood, false, true);
  commitPartsMesh(group, barkParts, 'TayNinhBodhiTrunks', ctx.materials.bark, false, true);
  commitPartsMesh(group, voidParts, 'TayNinhDarkPortals', ctx.materials.darkVoid, false, false);

  // Ensure createMergedMesh is explicitly referenced/available for parity with Vietnam builders
  void createMergedMesh;

  tagMotifIds(group, [
    'TN-NUI-BA-DEN',
    'TN-PHAT-BA-TAY-BO-DA-SON',
    'TN-CHUA-BA',
    'TN-GA-VAN-SON',
    'TN-TOA-THANH-CAO-DAI',
    'TN-THIEN-NHAN',
    'TN-BAT-QUAI-DAI'
  ]);
  ctx.scene.add(group);
  ctx.exclusionCircles.push({ x: nbdX, z: nbdZ, r: 58.0 });
  ctx.exclusionCircles.push({ x: cdX, z: cdZ, r: 56.0 });
  ctx.exclusionCircles.push({ x: -535.0, z: 682.0, r: 28.0 });
  return group;
}

// ============================================================================
// Master Export: Build All 4 Biển Đảo – Sài Gòn Hiện Đại – Tây Ninh Complexes
// ============================================================================
export function buildBienDaoSaigonTayNinhLandmarks(
  ctx: VietnamBuilderContext
): BienDaoSaigonTayNinhBuildResult {
  const flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [];
  const southernBoats: JunkBoatMotion[] = [];

  buildHoangSaArchipelagoGroup(ctx, flagUniforms, southernBoats);
  buildTruongSaAndDK1Complex(ctx, flagUniforms, southernBoats);
  buildSaigonModernSkylineComplex(ctx, flagUniforms, southernBoats);
  buildTayNinhSacredComplex(ctx, flagUniforms);

  return { flagUniforms, southernBoats };
}
