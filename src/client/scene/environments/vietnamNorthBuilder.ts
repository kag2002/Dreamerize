import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createHaLongKarstGeometry,
  createIncenseSmokeSystem,
  createLanternCapGeometry,
  createLanternCoreGeometry,
  createLotusFinialParts,
  createNotchedLotusPadGeometry,
  createRibbedLanternShellGeometry,
  createSculptedRockGeometry,
  createVietnameseCurvedRoofGeometry,
  createWavingSilkFlagMaterial,
  mergeNormalized,
  mulberry32
} from './vietnamGeometryHelpers';
import {
  createBronzeBellParts,
  createBronzeCraneOnTortoiseParts,
  createCarvedDragonBalustradeParts,
  createDongSonDrum3DParts,
  createGuardianBeastParts,
  createPiercedBalustradeParts,
  createRoofFinialSetParts,
  createSculptedDeityParts,
  createSignagePlaqueMesh
} from './vietnamMotifHelpers';
import {
  createMergedMesh,
  registerAnimatedUniform,
  transformGeometryXZY
} from '../vietnam/geometry/PartsBuilder';

export interface VietnamNorthBuildResult {
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
}

function registerUniform(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  u: { uTime: { value: number }; uWindSpeed?: { value: number } }
): void {
  registerAnimatedUniform(ctx.animatedUniforms, flagUniforms, u, false);
}

function addIncenseSmoke(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  group: THREE.Group,
  sources: Array<{ x: number; y: number; z: number; scale?: number }>,
  name: string
): void {
  if (sources.length === 0) return;
  const smoke = createIncenseSmokeSystem(sources, ctx.sharedShaders?.incenseSmoke);
  smoke.mesh.name = name;
  group.add(smoke.mesh);
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(smoke.mesh.material as THREE.Material);
    registerUniform(ctx, flagUniforms, smoke.uniforms);
  }
}

function addWavingFlagMat(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>,
  opts: { waveScale?: number; color?: THREE.ColorRepresentation; showStar?: boolean }
): THREE.ShaderMaterial {
  if (ctx.sharedShaders) {
    return ctx.sharedShaders.getWavingFlag(opts).material;
  }
  const { material, uniforms } = createWavingSilkFlagMaterial(opts);
  ctx.extraMaterials.push(material);
  registerUniform(ctx, flagUniforms, uniforms);
  return material;
}

function addMergedMesh(
  group: THREE.Group,
  parts: THREE.BufferGeometry[],
  material: THREE.Material,
  name: string,
  castShadow = true,
  receiveShadow = true
): void {
  if (parts.length === 0) return;
  group.add(createMergedMesh(name, parts, material, castShadow, receiveShadow));
}

function makeBox(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY = 0
): THREE.BufferGeometry {
  return transformGeometryXZY(
    new THREE.BoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d)),
    x,
    y,
    z,
    0,
    0,
    rotY
  );
}

function makeCylinder(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotZ = 0,
  rotY = 0
): THREE.BufferGeometry {
  return transformGeometryXZY(
    new THREE.CylinderGeometry(
      Math.max(0.01, rTop),
      Math.max(0.01, rBot),
      Math.max(0.02, h),
      segs
    ),
    x,
    y,
    z,
    rotX,
    rotZ,
    rotY
  );
}

/**
 * Adds radiating limestone arch voussoirs, impost caps, and recessed timber doors to a portal.
 */
function addPortalVoussoirsAndDoors(
  stoneParts: THREE.BufferGeometry[],
  woodParts: THREE.BufferGeometry[],
  cx: number,
  wallY: number,
  cz: number,
  gateDepth: number,
  archWidth: number,
  archHeight: number
): void {
  const haw = archWidth * 0.5;
  const springY = Math.max(0.15, archHeight - haw);
  const ringR = haw + 0.22;
  const voussoirCount = 11;

  for (let i = 0; i < voussoirCount; i++) {
    const t = i / (voussoirCount - 1);
    const ang = t * Math.PI;
    const isKeystone = i === Math.floor(voussoirCount / 2);
    const vx = cx + Math.cos(ang) * ringR;
    const vy = wallY + springY + Math.sin(ang) * ringR;
    const vBlock = makeBox(0.38, isKeystone ? 0.58 : 0.44, gateDepth + 0.22, 0, 0, 0);
    vBlock.rotateZ(ang - Math.PI * 0.5);
    vBlock.translate(vx, vy, cz);
    stoneParts.push(vBlock);
  }

  for (const side of [-1, 1]) {
    const jx = cx + side * (haw + 0.19);
    stoneParts.push(makeBox(0.38, springY, gateDepth + 0.16, jx, wallY + springY * 0.5, cz));
    stoneParts.push(makeBox(0.52, 0.24, gateDepth + 0.26, jx, wallY + springY, cz));
  }

  stoneParts.push(makeBox(archWidth + 0.7, 0.20, gateDepth + 0.3, cx, wallY + 0.06, cz));

  const doorH = springY * 0.94;
  const leafW = Math.min(haw * 0.85, 1.35);
  for (const side of [-1, 1]) {
    stoneParts.push(
      makeBox(0.18, 0.22, 0.22, cx + side * (haw - 0.14), wallY + 0.15, cz + gateDepth * 0.28)
    );
    woodParts.push(
      makeBox(
        0.16,
        doorH,
        leafW,
        cx + side * (haw - 0.18),
        wallY + doorH * 0.5 + 0.10,
        cz + gateDepth * 0.28 - leafW * 0.5 + 0.12
      )
    );
  }
}

/**
 * 1. Hoàng Thành Thăng Long — Đoan Môn, Expanded 46x28m Nền Điện Kính Thiên,
 *    Cột Cờ Hà Nội (33.4m) at (38, -76), and 18 Hoàng Diệu Archaeological Shelter at (-36, -80).
 */
function buildHoangThanhThangLong(
  ctx: VietnamBuilderContext,
  stainlessMat: THREE.MeshStandardMaterial,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const cx = 0;
  const cz = -68;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 28.0 },
    { x: cx, z: -98.0, r: 34.0 },
    { x: 38.0, z: -76.0, r: 16.0 },
    { x: -36.0, z: -80.0, r: 16.0 }
  );

  const group = new THREE.Group();
  group.name = 'HoangThanhThangLongComplex';

  const stoneParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];
  const glassParts: THREE.BufferGeometry[] = [];
  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  // 1. Flat Imperial Plaza Paving & U-shaped Đoan Môn Foundation (arches open directly at flat plaza level)
  const plinthH = 0.20;
  const gateDepth = 9.0; // Central 5-arch block z in [-72.5, -63.5]
  const skirtBot = yBase - 1.6;
  const podiumFullH = plinthH + 1.6;

  // Main central & rear terrace apron + flat South royal plaza (z in [-78.0, -50.0])
  stoneParts.push(makeBox(46.6, podiumFullH, 14.5, cx, skirtBot + podiumFullH * 0.5, -70.75));
  stoneParts.push(makeBox(26.0, podiumFullH, 13.5, cx, skirtBot + podiumFullH * 0.5, -56.75));
  for (const side of [-1, 1]) {
    stoneParts.push(
      makeBox(10.6, podiumFullH, 5.6, cx + side * 18.0, skirtBot + podiumFullH * 0.5, -60.7)
    );
  }

  // Low ornamental brick flowerbeds & trimmed imperial hedges flanking the flat South plaza axis
  // (replaces anachronistic South dragon staircase so Đoan Môn's 5 arches open cleanly at plaza level)
  const plazaY = yBase + plinthH;
  for (const side of [-1, 1]) {
    const bedX = cx + side * 9.8;
    const bedZ = -55.2;
    brickParts.push(makeBox(6.6, 0.52, 7.6, bedX, plazaY + 0.26, bedZ));
    stoneParts.push(makeBox(6.85, 0.14, 7.85, bedX, plazaY + 0.55, bedZ));
    // Sculpted boxwood hedge & corner flowering shrubs inside flowerbeds
    for (let hx = -2.2; hx <= 2.2; hx += 1.45) {
      for (let hz = -2.6; hz <= 2.6; hz += 1.7) {
        const bush = createSculptedRockGeometry(
          140 + Math.round((hx + 5) * 7 + (hz + 5) * 13),
          0.62,
          0.42,
          0.62,
          1
        );
        bush.translate(bedX + hx, plazaY + 0.72, bedZ + hz);
        foliageParts.push(bush);
      }
    }
    // Flanking imperial stone lantern pedestals at South plaza entrance
    const lx = cx + side * 8.4;
    const lz = -50.4;
    const ly = ctx.getHeight(lx, lz);
    stoneParts.push(makeBox(1.1, 1.15, 1.1, lx, ly + 0.48, lz));
    crimsonParts.push(makeCylinder(0.11, 0.14, 1.85, 8, lx, ly + 1.98, lz));
    lanternParts.push(createRibbedLanternShellGeometry(0.28, 0.40, 10, 6).translate(lx, ly + 3.10, lz));
    lanternCoreParts.push(createLanternCoreGeometry(0.16, 0.26).translate(lx, ly + 3.10, lz));
  }

  // 2. Đoan Môn 6.2m-high U-Shaped Citadel Rampart & Five True-Scale Round-Arched Portals
  const wallY = yBase + plinthH;
  const wallH = 6.0; // plinthH (0.20) + wallH (6.0) = 6.20m rampart deck height

  const archSpecs = [
    { ox: 0.0, w: 6.8, h: wallH, aw: 3.4, ah: 4.6 },
    { ox: -5.8, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 },
    { ox: 5.8, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 },
    { ox: -10.6, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 },
    { ox: 10.6, w: 4.8, h: wallH, aw: 2.4, ah: 3.6 }
  ];

  for (const a of archSpecs) {
    const archWall = createArchedWallGeometry(a.w, a.h, gateDepth, a.aw, a.ah);
    archWall.translate(cx + a.ox, wallY, cz);
    brickParts.push(archWall);
    addPortalVoussoirsAndDoors(stoneParts, woodParts, cx + a.ox, wallY, cz, gateDepth, a.aw, a.ah);
  }

  const stoneCourseH = 1.85;
  const brickUpperH = wallH - stoneCourseH;
  for (const side of [-1, 1]) {
    const bx = cx + side * 18.0;
    stoneParts.push(makeBox(10.0, stoneCourseH, gateDepth, bx, wallY + stoneCourseH * 0.5, cz));
    brickParts.push(
      makeBox(10.0, brickUpperH, gateDepth, bx, wallY + stoneCourseH + brickUpperH * 0.5, cz)
    );
    stoneParts.push(makeBox(8.6, stoneCourseH, 5.5, bx + side * 0.7, wallY + stoneCourseH * 0.5, -60.75));
    brickParts.push(
      makeBox(8.6, brickUpperH, 5.5, bx + side * 0.7, wallY + stoneCourseH + brickUpperH * 0.5, -60.75)
    );
    stoneParts.push(makeBox(8.6, stoneCourseH, 5.5, bx + side * 0.7, wallY + stoneCourseH * 0.5, -75.25));
    brickParts.push(
      makeBox(8.6, brickUpperH, 5.5, bx + side * 0.7, wallY + stoneCourseH + brickUpperH * 0.5, -75.25)
    );
  }

  const deckY = yBase + 6.20;
  stoneParts.push(makeBox(46.5, 0.42, gateDepth + 0.55, cx, deckY - 0.55, cz));
  stoneParts.push(makeBox(46.2, 0.36, gateDepth + 0.3, cx, deckY - 0.18, cz));
  for (const side of [-1, 1]) {
    const bx = cx + side * 18.7;
    stoneParts.push(makeBox(9.0, 0.42, 20.4, bx, deckY - 0.55, cz));
    stoneParts.push(makeBox(8.8, 0.36, 20.2, bx, deckY - 0.18, cz));
  }

  const addCrenelLineX = (x0: number, x1: number, zPos: number) => {
    const w = Math.abs(x1 - x0);
    const mx = (x0 + x1) * 0.5;
    stoneParts.push(makeBox(w, 0.34, 0.34, mx, deckY + 0.17, zPos));
    for (let bx = Math.min(x0, x1) + 0.6; bx <= Math.max(x0, x1) - 0.6; bx += 1.45) {
      stoneParts.push(makeBox(0.75, 0.56, 0.34, bx, deckY + 0.62, zPos));
    }
  };
  const addCrenelLineZ = (xPos: number, z0: number, z1: number) => {
    const d = Math.abs(z1 - z0);
    const mz = (z0 + z1) * 0.5;
    stoneParts.push(makeBox(0.34, 0.34, d, xPos, deckY + 0.17, mz));
    for (let bz = Math.min(z0, z1) + 0.6; bz <= Math.max(z0, z1) - 0.6; bz += 1.45) {
      stoneParts.push(makeBox(0.34, 0.56, 0.75, xPos, deckY + 0.62, bz));
    }
  };

  addCrenelLineX(-14.2, 14.2, cz + gateDepth * 0.5);
  addCrenelLineX(-14.2, 14.2, cz - gateDepth * 0.5);
  for (const side of [-1, 1]) {
    addCrenelLineX(side * 14.4, side * 23.0, -58.0);
    addCrenelLineX(side * 14.4, side * 23.0, -78.0);
    addCrenelLineZ(side * 23.0, -78.0, -58.0);
    addCrenelLineZ(side * 14.4, -63.5, -58.0);
    addCrenelLineZ(side * 14.4, -78.0, -72.5);
  }

  // Readable carved "ĐOAN MÔN — 端門" imperial plaque above central Emperor portal
  const plaqueZ = cz + gateDepth * 0.5 + 0.16;
  const doanMonPlaque = createSignagePlaqueMesh(
    {
      text: 'ĐOAN MÔN — 端門',
      subText: 'HOÀNG THÀNH THĂNG LONG',
      style: 'royal',
      width: 4.2,
      height: 1.18,
      depth: 0.22
    },
    ctx
  );
  doanMonPlaque.name = 'DoanMonImperialPlaque';
  doanMonPlaque.position.set(cx, wallY + 5.32, plaqueZ);
  group.add(doanMonPlaque);
  for (const side of [-1, 1]) {
    const medal = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12);
    medal.rotateX(Math.PI * 0.5);
    medal.translate(cx + side * 2.55, wallY + 5.32, plaqueZ);
    goldParts.push(medal);
  }

  // Twin flanking brick & stone rampart staircases ascending behind U-wings to the upper deck
  for (const side of [-1, 1]) {
    const stairX = cx + side * 13.05;
    for (let st = 0; st < 12; st++) {
      const t = st / 11;
      const sz = THREE.MathUtils.lerp(-77.2, -68.4, t);
      const sy = THREE.MathUtils.lerp(yBase + plinthH + 0.2, deckY - 0.15, t);
      const sh = Math.max(0.45, sy - (yBase - 0.5));
      brickParts.push(makeBox(2.2, sh, 0.92, stairX, yBase - 0.5 + sh * 0.5, sz));
      stoneParts.push(makeBox(2.3, 0.14, 0.96, stairX, sy, sz));
    }
  }

  // 3. Upper 2-Tier Imperial Crimson Wooden Gatehouse Pavilion (*Vọng Lâu Đoan Môn*)
  const pavBaseY = deckY;
  const lowerH = 3.25;
  const colXs = [-8.8, -5.8, -2.9, 0, 2.9, 5.8, 8.8];
  for (const colX of colXs) {
    for (const colZ of [-2.4, 2.4]) {
      crimsonParts.push(
        makeCylinder(0.20, 0.23, lowerH, 10, cx + colX, pavBaseY + lowerH * 0.5, cz + colZ)
      );
      stoneParts.push(
        makeCylinder(0.30, 0.35, 0.26, 10, cx + colX, pavBaseY + 0.13, cz + colZ)
      );
    }
  }
  woodParts.push(makeBox(0.32, lowerH * 0.88, 4.2, cx - 8.15, pavBaseY + lowerH * 0.44, cz));
  woodParts.push(makeBox(0.32, lowerH * 0.88, 4.2, cx + 8.15, pavBaseY + lowerH * 0.44, cz));
  woodParts.push(makeBox(16.6, lowerH * 0.88, 0.32, cx, pavBaseY + lowerH * 0.44, cz - 2.05));
  for (const side of [-1, 1]) {
    woodParts.push(makeBox(3.4, lowerH * 0.84, 0.24, cx + side * 6.4, pavBaseY + lowerH * 0.44, cz + 2.0));
    woodParts.push(
      makeBox(1.15, lowerH * 0.78, 0.14, cx + side * 4.45, pavBaseY + lowerH * 0.40, cz + 2.45, side * -0.55)
    );
    crimsonParts.push(
      ...createPiercedBalustradeParts(
        cx + side * 4.2,
        cz + 2.55,
        cx + side * 8.8,
        cz + 2.55,
        pavBaseY + 0.05,
        0.78,
        'con_tien'
      )
    );
  }
  crimsonParts.push(
    ...createPiercedBalustradeParts(cx - 8.8, cz - 2.55, cx + 8.8, cz - 2.55, pavBaseY + 0.05, 0.78, 'con_tien')
  );
  crimsonParts.push(makeBox(17.4, 0.22, 4.6, cx, pavBaseY + lowerH - 0.14, cz));
  goldParts.push(makeBox(18.6, 0.34, 5.2, cx, pavBaseY + lowerH - 0.04, cz));

  // Vọng Lâu interior ceremonial royal *Trống Sấm* watchtower drum + *Bát Bửu* halberds
  woodParts.push(makeBox(2.0, 0.24, 1.15, cx, pavBaseY + 0.12, cz - 0.2));
  for (const side of [-1, 1]) {
    woodParts.push(makeBox(0.18, 1.35, 0.95, cx + side * 0.82, pavBaseY + 0.80, cz - 0.2));
    woodParts.push(makeBox(1.5, 0.22, 0.45, cx + side * 3.1, pavBaseY + 0.12, cz - 1.3));
    for (let h = -1; h <= 1; h++) {
      crimsonParts.push(
        makeCylinder(0.035, 0.04, 2.25, 6, cx + side * 3.1 + h * 0.42, pavBaseY + 1.25, cz - 1.3)
      );
      goldParts.push(makeBox(0.20, 0.36, 0.06, cx + side * 3.1 + h * 0.42, pavBaseY + 2.45, cz - 1.3));
    }
  }
  const drumShell = new THREE.CylinderGeometry(0.68, 0.68, 1.28, 16);
  drumShell.rotateX(Math.PI * 0.5);
  drumShell.translate(cx, pavBaseY + 1.32, cz - 0.2);
  crimsonParts.push(drumShell);
  const drumRim = new THREE.CylinderGeometry(0.64, 0.64, 1.34, 16);
  drumRim.rotateX(Math.PI * 0.5);
  drumRim.translate(cx, pavBaseY + 1.32, cz - 0.2);
  goldParts.push(drumRim);

  for (const lx of [-7.35, -4.35, -1.45, 1.45, 4.35, 7.35]) {
    const ly = pavBaseY + lowerH - 0.52;
    const lz = cz + 2.52;
    lanternParts.push(createRibbedLanternShellGeometry(0.24, 0.34, 10, 6).translate(cx + lx, ly, lz));
    lanternCoreParts.push(createLanternCoreGeometry(0.14, 0.22).translate(cx + lx, ly, lz));
    goldParts.push(createLanternCapGeometry(0.11, 0.06).translate(cx + lx, ly + 0.19, lz));
  }
  for (const ilx of [-1.6, 1.6]) {
    const ily = pavBaseY + lowerH - 0.62;
    lanternParts.push(createRibbedLanternShellGeometry(0.20, 0.30, 8, 5).translate(cx + ilx, ily, cz + 0.2));
    lanternCoreParts.push(createLanternCoreGeometry(0.12, 0.20).translate(cx + ilx, ily, cz + 0.2));
  }
  const vongLauLight = new THREE.PointLight('#ffca72', 1.8, 16, 1.5);
  vongLauLight.position.set(cx, pavBaseY + 2.15, cz + 0.4);
  group.add(vongLauLight);

  const lowerRoof = createVietnameseCurvedRoofGeometry(21.6, 8.4, 14.0, 4.8, 1.95, 0.40);
  lowerRoof.translate(cx, pavBaseY + lowerH + 0.04, cz);
  roofParts.push(lowerRoof);

  // Upper Tier 2 Vọng Lâu with OPEN arched/round wood-lattice windows (replaces solid closed box)
  const upperY = pavBaseY + lowerH + 1.02;
  const upperH = 2.68;
  for (const colX of [-5.2, -2.6, 0, 2.6, 5.2]) {
    for (const colZ of [-1.6, 1.6]) {
      crimsonParts.push(
        makeCylinder(0.16, 0.18, upperH, 10, cx + colX, upperY + upperH * 0.5, cz + colZ)
      );
      stoneParts.push(makeCylinder(0.24, 0.28, 0.20, 10, cx + colX, upperY + 0.10, cz + colZ));
    }
  }
  // Open Tier 2 side/front/rear walls with circular moon-windows & arched lattice mullions
  crimsonParts.push(
    ...createPiercedBalustradeParts(cx - 5.2, cz + 1.6, cx + 5.2, cz + 1.6, upperY + 0.06, 0.72, 'con_tien'),
    ...createPiercedBalustradeParts(cx - 5.2, cz - 1.6, cx + 5.2, cz - 1.6, upperY + 0.06, 0.72, 'con_tien'),
    ...createPiercedBalustradeParts(cx - 5.2, cz - 1.6, cx - 5.2, cz + 1.6, upperY + 0.06, 0.72, 'con_tien'),
    ...createPiercedBalustradeParts(cx + 5.2, cz - 1.6, cx + 5.2, cz + 1.6, upperY + 0.06, 0.72, 'con_tien')
  );
  // Subtle recessed dark interior core for depth behind open lattice bays
  voidParts.push(makeBox(8.6, upperH * 0.62, 1.8, cx, upperY + upperH * 0.48, cz));
  // Round wood-lattice windows in outer bays + arched lattice transoms in central bays (North & South)
  for (const zSide of [-1, 1]) {
    const wz = cz + zSide * 1.48;
    for (const bx of [-3.9, 3.9]) {
      const ring = new THREE.TorusGeometry(0.68, 0.08, 7, 16);
      ring.translate(cx + bx, upperY + 1.56, wz);
      goldParts.push(ring);
      woodParts.push(makeBox(1.32, 0.07, 0.08, cx + bx, upperY + 1.56, wz));
      woodParts.push(makeBox(0.07, 1.32, 0.08, cx + bx, upperY + 1.56, wz));
      const d1 = makeBox(1.22, 0.055, 0.07, 0, 0, 0);
      d1.rotateZ(Math.PI * 0.25);
      d1.translate(cx + bx, upperY + 1.56, wz);
      const d2 = makeBox(1.22, 0.055, 0.07, 0, 0, 0);
      d2.rotateZ(-Math.PI * 0.25);
      d2.translate(cx + bx, upperY + 1.56, wz);
      woodParts.push(d1, d2);
    }
    for (const bx of [-1.3, 1.3]) {
      const archWin = createArchedWallGeometry(2.35, 1.75, 0.16, 1.55, 1.42);
      archWin.translate(cx + bx, upperY + 0.76, wz);
      woodParts.push(archWin);
      // Fine lattice muntins across arched window opening
      for (const mx of [-0.36, 0, 0.36]) {
        goldParts.push(makeBox(0.05, 1.25, 0.06, cx + bx + mx, upperY + 1.42, wz));
      }
      goldParts.push(makeBox(1.48, 0.05, 0.06, cx + bx, upperY + 1.45, wz));
    }
  }
  goldParts.push(makeBox(11.2, 0.28, 3.6, cx, upperY + upperH - 0.06, cz));

  const upperRoof = createVietnameseCurvedRoofGeometry(14.6, 6.4, 5.4, 0.55, 2.25, 0.48);
  upperRoof.translate(cx, upperY + upperH + 0.04, cz);
  roofParts.push(upperRoof);

  // Ornate *Lưỡng Long Chầu Nguyệt* + *Kìm Nóc* ridge finials atop Vọng Lâu
  const ridgeY = upperY + upperH + 2.26;
  goldParts.push(makeBox(5.6, 0.24, 0.24, cx, ridgeY, cz));
  const doanFinials = createRoofFinialSetParts(cx, ridgeY + 0.08, cz, 5.6, 0, 1.05, true);
  crimsonParts.push(...doanFinials.mainParts);
  goldParts.push(...doanFinials.goldParts);

  // 4. EXPANDED Nền Điện Kính Thiên (46.0m x 28.0m, z in [-112, -84]) with Front 9-Step & Rear 7-Step Thềm Rồng
  const ktZ = -98.0; // z in [-112, -84]
  const ktW = 46.0;
  const ktD = 28.0;
  const ktGroundY = ctx.getHeight(cx, ktZ);
  const ktTopY = Math.max(yBase + 2.45, ktGroundY + 2.45);
  const ktSkirtBot = Math.min(yBase, ktGroundY) - 2.6;
  const ktFullH = ktTopY - ktSkirtBot;

  // Paved *Long Trì* royal brick-and-stone approach between Đoan Môn (-72.5) and Điện Kính Thiên (-84.0)
  const courtY = ctx.getHeight(cx, -78.2);
  stoneParts.push(makeBox(22.0, 1.2, 12.2, cx, courtY - 0.50, -78.2));
  // Monumental 46m x 28m stone foundation platform of Điện Kính Thiên
  stoneParts.push(makeBox(ktW, ktFullH, ktD, cx, ktSkirtBot + ktFullH * 0.5, ktZ));
  // Lower stone molding collar around the 46x28m base
  stoneParts.push(makeBox(ktW + 1.2, 0.55, ktD + 1.2, cx, ktTopY - ktFullH * 0.42, ktZ));

  // Connected carved `lotus_stone` perimeter balustrade around the 46m x 28m terrace
  const halfKtW = ktW * 0.5 - 0.45;
  const halfKtD = ktD * 0.5 - 0.45;
  stoneParts.push(
    ...createPiercedBalustradeParts(cx - halfKtW, ktZ - halfKtD, cx - halfKtW, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + halfKtW, ktZ - halfKtD, cx + halfKtW, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    // South front balustrade leaving 14.4m gap for 9-step Thềm Rồng
    ...createPiercedBalustradeParts(cx - halfKtW, ktZ + halfKtD, cx - 7.3, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + 7.3, ktZ + halfKtD, cx + halfKtW, ktZ + halfKtD, ktTopY, 0.96, 'lotus_stone'),
    // North rear balustrade leaving 8.8m gap for 7-step rear Thềm Rồng
    ...createPiercedBalustradeParts(cx - halfKtW, ktZ - halfKtD, cx - 4.5, ktZ - halfKtD, ktTopY, 0.96, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + 4.5, ktZ - halfKtD, cx + halfKtW, ktZ - halfKtD, ktTopY, 0.96, 'lotus_stone')
  );
  for (const sx of [-halfKtW, halfKtW]) {
    for (const sz of [-halfKtD, halfKtD]) {
      stoneParts.push(...createLotusFinialParts(cx + sx, ktTopY + 1.0, ktZ + sz, 0.85));
    }
  }

  // Front 9-step South Thềm Rồng (z = -84.0 down to -77.2) with 4 sculpted Lê-dynasty stone dragons
  const frontSteps = 9;
  const fZTop = ktZ + ktD * 0.5; // -84.0
  const fZBot = -77.2;
  const fBotGround = ctx.getHeight(cx, fZBot);
  for (let s = 0; s < frontSteps; s++) {
    const t = s / (frontSteps - 1);
    const sz = THREE.MathUtils.lerp(fZTop, fZBot, t);
    const sy = THREE.MathUtils.lerp(ktTopY - 0.06, fBotGround + 0.14, t);
    const sBot = Math.min(sy - 1.3, ctx.getHeight(cx, sz) - 1.3);
    const sh = Math.max(0.5, sy - sBot);
    stoneParts.push(makeBox(14.2, sh, 0.95, cx, sBot + sh * 0.5, sz));
  }
  for (const dX of [-6.8, -2.25, 2.25, 6.8]) {
    stoneParts.push(
      ...createCarvedDragonBalustradeParts(
        cx + dX,
        fBotGround + 0.14,
        fZBot + 0.15,
        cx + dX,
        ktTopY + 0.06,
        fZTop - 0.1,
        1.18
      )
    );
  }

  // Rear 7-step North Thềm Rồng (z = -112.0 down to -117.2) with 2 sculpted Lê Trung Hưng stone dragons
  const rearSteps = 7;
  const rZTop = ktZ - ktD * 0.5; // -112.0
  const rZBot = -117.2;
  const rBotGround = ctx.getHeight(cx, rZBot);
  for (let s = 0; s < rearSteps; s++) {
    const t = s / (rearSteps - 1);
    const sz = THREE.MathUtils.lerp(rZTop, rZBot, t);
    const sy = THREE.MathUtils.lerp(ktTopY - 0.06, rBotGround + 0.14, t);
    const sBot = Math.min(sy - 1.3, ctx.getHeight(cx, sz) - 1.3);
    const sh = Math.max(0.5, sy - sBot);
    stoneParts.push(makeBox(8.6, sh, 0.95, cx, sBot + sh * 0.5, sz));
  }
  for (const dX of [-4.05, 4.05]) {
    stoneParts.push(
      ...createCarvedDragonBalustradeParts(
        cx + dX,
        rBotGround + 0.14,
        rZBot - 0.15,
        cx + dX,
        ktTopY + 0.06,
        rZTop + 0.1,
        1.12
      )
    );
  }

  // Ceremonial Imperial Incense Altar, Sculpted Bronze Tripod Censer, Cranes on Tortoises & Guardian Beasts atop Điện Kính Thiên
  crimsonParts.push(makeBox(5.2, 1.22, 1.55, cx, ktTopY + 0.61, ktZ - 1.2));
  goldParts.push(makeBox(5.45, 0.18, 1.72, cx, ktTopY + 1.24, ktZ - 1.2));
  const ktPlaque = createSignagePlaqueMesh(
    {
      text: 'ĐIỆN KÍNH THIÊN',
      subText: '敬 天 殿',
      style: 'royal',
      width: 3.2,
      height: 1.05,
      depth: 0.18
    },
    ctx
  );
  ktPlaque.name = 'DienKinhThienPlaque';
  ktPlaque.position.set(cx, ktTopY + 2.05, ktZ - 1.45);
  group.add(ktPlaque);

  // Sculpted Bronze Incense Tripod (*Đỉnh Đồng*) + GPU Incense Smoke
  const ktCenser = createBronzeIncenseTripodParts(cx, ktTopY, ktZ + 4.4, 1.45);
  stoneParts.push(...ktCenser.limestoneParts);
  bronzeParts.push(...ktCenser.bronzeParts);
  goldParts.push(...ktCenser.goldParts);
  smokeSources.push({ x: cx, y: ktCenser.smokeY, z: ktZ + 4.4, scale: 1.35 });

  // Paired sculpted bronze cranes on tortoises (*Hạc chầu quy*) & guardian *Nghê* beasts
  for (const side of [-1, 1]) {
    bronzeParts.push(
      ...createBronzeCraneOnTortoiseParts(cx + side * 2.8, ktTopY, ktZ + 1.4, side > 0 ? -0.35 : 0.35, 1.22)
    );
    stoneParts.push(
      ...createGuardianBeastParts(cx + side * 8.2, ktTopY, ktZ + 9.5, 0, 1.35, 'nghe')
    );
    // Tall imperial lantern poles flanking the 46x28m terrace
    for (const lzOff of [-8.8, 0, 8.8]) {
      const px = cx + side * 16.5;
      const pz = ktZ + lzOff;
      stoneParts.push(makeBox(0.78, 0.58, 0.78, px, ktTopY + 0.29, pz));
      crimsonParts.push(makeCylinder(0.09, 0.11, 3.4, 8, px, ktTopY + 2.28, pz));
      lanternParts.push(createRibbedLanternShellGeometry(0.28, 0.40, 10, 6).translate(px, ktTopY + 4.15, pz));
      lanternCoreParts.push(createLanternCoreGeometry(0.16, 0.25).translate(px, ktTopY + 4.15, pz));
    }
  }
  // Exposed historic Lý–Trần palace column plinth grid marking the grand Điện Kính Thiên footprint
  for (const px of [-16, -11, -6, 6, 11, 16]) {
    for (const pz of [-6.5, 2.5]) {
      stoneParts.push(makeBox(1.15, 0.32, 1.15, cx + px, ktTopY + 0.16, ktZ + pz));
      stoneParts.push(makeCylinder(0.42, 0.48, 0.18, 12, cx + px, ktTopY + 0.38, ktZ + pz));
    }
  }

  // 5. Cột Cờ Hà Nội (Hanoi Flag Tower, 33.4m tall) at (38, -76)
  const hftX = 38.0;
  const hftZ = -76.0;
  const hftY = ctx.getHeight(hftX, hftZ);
  const hftSkirt = 2.0;

  // 3 diminishing square red-brick bastion tiers (3.2m + 3.8m + 4.2m = 11.2m)
  const bastionTiers = [
    { w: 14.0, h: 3.2, y0: hftY, hasPortals: false },
    { w: 10.8, h: 3.8, y0: hftY + 3.2, hasPortals: true },
    { w: 7.8, h: 4.2, y0: hftY + 7.0, hasPortals: true }
  ];
  for (let ti = 0; ti < bastionTiers.length; ti++) {
    const bt = bastionTiers[ti];
    const extraBot = ti === 0 ? hftSkirt : 0;
    const totalH = bt.h + extraBot;
    brickParts.push(makeBox(bt.w, totalH, bt.w, hftX, bt.y0 - extraBot + totalH * 0.5, hftZ));
    // Stone cornice coping & stepped parapet wall around each bastion tier
    stoneParts.push(makeBox(bt.w + 0.45, 0.34, bt.w + 0.45, hftX, bt.y0 + bt.h + 0.12, hftZ));
    const hw = bt.w * 0.5 - 0.25;
    for (const side of [-1, 1]) {
      brickParts.push(makeBox(bt.w, 0.72, 0.38, hftX, bt.y0 + bt.h + 0.52, hftZ + side * hw));
      brickParts.push(makeBox(0.38, 0.72, bt.w, hftX + side * hw, bt.y0 + bt.h + 0.52, hftZ));
    }
    // Arched recessed portals on cardinal faces ("Nghênh Húc", "Hồi Quang", "Hướng Minh")
    if (bt.hasPortals) {
      const pAw = ti === 1 ? 2.2 : 1.7;
      const pAh = ti === 1 ? 2.65 : 2.35;
      for (const ang of [0, Math.PI * 0.5, -Math.PI * 0.5, Math.PI]) {
        const portalFrame = createArchedWallGeometry(pAw + 1.2, pAh + 0.75, 0.48, pAw, pAh);
        portalFrame.translate(0, 0, bt.w * 0.5 + 0.18);
        portalFrame.rotateY(ang);
        portalFrame.translate(hftX, bt.y0 + 0.15, hftZ);
        brickParts.push(portalFrame);

        const portalVoid = makeBox(pAw * 0.86, pAh * 0.85, 0.22, 0, pAh * 0.44, bt.w * 0.5 + 0.04);
        portalVoid.rotateY(ang);
        portalVoid.translate(hftX, bt.y0 + 0.15, hftZ);
        voidParts.push(portalVoid);
      }
    }
  }
  // Readable "CỘT CỜ HÀ NỘI" plaque above Tier 2 South portal
  const hftPlaque = createSignagePlaqueMesh(
    {
      text: 'CỘT CỜ HÀ NỘI',
      subText: 'KỲ ĐÀI — 1812',
      style: 'royal',
      width: 3.1,
      height: 0.88,
      depth: 0.16
    },
    ctx
  );
  hftPlaque.name = 'HanoiFlagTowerPlaque';
  hftPlaque.position.set(hftX, hftY + 6.45, hftZ + 5.75);
  group.add(hftPlaque);

  // 18.2m tapered octagonal brick shaft (y + 11.2m -> y + 29.4m) pierced with star-shaped vents
  const hftShaftBaseY = hftY + 11.2;
  const hftShaftH = 18.2;
  const hftShaftTopY = hftShaftBaseY + hftShaftH; // hftY + 29.4m
  brickParts.push(makeCylinder(1.98, 2.68, hftShaftH, 8, hftX, hftShaftBaseY + hftShaftH * 0.5, hftZ));
  // 36 star/flower-shaped ventilation apertures climbing the 8 shaft faces
  for (let level = 0; level < 5; level++) {
    const frac = 0.14 + level * 0.18;
    const vy = hftShaftBaseY + hftShaftH * frac;
    const rAtY = THREE.MathUtils.lerp(2.68, 1.98, frac) * Math.cos(Math.PI / 8);
    for (let f = 0; f < 8; f++) {
      if (level === 4 && f % 2 === 1) continue; // 36 apertures total
      const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
      const vx = hftX + Math.sin(ang) * (rAtY + 0.04);
      const vz = hftZ + Math.cos(ang) * (rAtY + 0.04);
      // Star-vent stone rosette trim + dark recessed aperture
      const trim = makeCylinder(0.28, 0.28, 0.12, 6, 0, 0, 0);
      trim.rotateX(Math.PI * 0.5);
      trim.rotateY(ang);
      trim.translate(vx, vy, vz);
      stoneParts.push(trim);

      const hole = makeCylinder(0.18, 0.18, 0.16, 5, 0, 0, 0);
      hole.rotateX(Math.PI * 0.5);
      hole.rotateY(ang);
      hole.translate(vx + Math.sin(ang) * 0.02, vy, vz + Math.cos(ang) * 0.02);
      voidParts.push(hole);
    }
  }

  // Top octagonal observation pavilion (hftY + 29.4m -> hftY + 33.4m = 33.4m masonry height!)
  stoneParts.push(makeCylinder(2.85, 2.35, 0.55, 8, hftX, hftShaftTopY + 0.25, hftZ));
  const pavY = hftShaftTopY + 0.52;
  const pavH = 2.75;
  for (let f = 0; f < 8; f++) {
    const ang = (f / 8) * Math.PI * 2;
    const px = hftX + Math.sin(ang) * 2.25;
    const pz = hftZ + Math.cos(ang) * 2.25;
    brickParts.push(makeBox(0.46, pavH, 0.46, px, pavY + pavH * 0.5, pz, ang));
  }
  // Pavilion recessed interior & octagonal roof cap reaching 33.4m
  voidParts.push(makeCylinder(1.65, 1.65, pavH * 0.86, 8, hftX, pavY + pavH * 0.46, hftZ));
  brickParts.push(makeCylinder(2.65, 2.75, 0.42, 8, hftX, pavY + pavH + 0.18, hftZ));
  stoneParts.push(makeCylinder(1.95, 2.68, 0.52, 8, hftX, pavY + pavH + 0.62, hftZ));

  // Flagstaff rising above the 33.4m pavilion + animated waving Vietnam silk flag
  const hftPoleBaseY = hftY + 33.4;
  const hftPoleH = 8.2;
  bronzeParts.push(makeCylinder(0.32, 0.46, 0.65, 8, hftX, hftPoleBaseY + 0.32, hftZ));
  steelParts.push(makeCylinder(0.08, 0.16, hftPoleH, 12, hftX, hftPoleBaseY + hftPoleH * 0.5, hftZ));
  goldParts.push(new THREE.ConeGeometry(0.16, 0.48, 8).translate(hftX, hftPoleBaseY + hftPoleH + 0.24, hftZ));

  const hftFlagMat = addWavingFlagMat(ctx, flagUniforms, {
    waveScale: 1.15,
    showStar: true
  });
  const hftFlagW = 5.4;
  const hftFlagH = 3.6;
  const hftFlagGeo = new THREE.PlaneGeometry(hftFlagW, hftFlagH, 28, 16);
  hftFlagGeo.translate(hftFlagW * 0.5 + 0.1, 0, 0);
  const hftFlagMesh = new THREE.Mesh(hftFlagGeo, hftFlagMat);
  hftFlagMesh.name = 'HanoiFlagTowerSilkFlag';
  hftFlagMesh.position.set(hftX, hftPoleBaseY + hftPoleH - hftFlagH * 0.5 - 0.18, hftZ);
  hftFlagMesh.rotation.y = -0.35;
  hftFlagMesh.castShadow = true;
  group.add(hftFlagMesh);

  // 6. 18 Hoàng Diệu Archaeological Site Shelter at (-36, -80)
  const archX = -36.0;
  const archZ = -80.0;
  const archY = ctx.getHeight(archX, archZ);
  // Stepped excavation perimeter retaining walls & exposed earthen pit floor
  stoneParts.push(makeBox(18.6, 1.5, 14.6, archX, archY - 0.72, archZ));
  brickParts.push(makeBox(17.2, 0.45, 13.2, archX, archY + 0.16, archZ));
  // Perimeter viewing walkway & safety railings (`gold_pipe`)
  steelParts.push(
    ...createPiercedBalustradeParts(archX - 8.6, archZ - 6.6, archX + 8.6, archZ - 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX - 8.6, archZ + 6.6, archX - 2.0, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX + 2.0, archZ + 6.6, archX + 8.6, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX - 8.6, archZ - 6.6, archX - 8.6, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe'),
    ...createPiercedBalustradeParts(archX + 8.6, archZ - 6.6, archX + 8.6, archZ + 6.6, archY + 0.25, 0.95, 'gold_pipe')
  );
  // Exposed Lý–Trần lotus-carved stone column plinths (*chân tảng hoa sen*) + ancient brick well
  for (const ox of [-5.4, -1.8, 1.8, 5.4]) {
    for (const oz of [-3.0, 2.4]) {
      stoneParts.push(makeBox(1.25, 0.36, 1.25, archX + ox, archY + 0.56, archZ + oz));
      stoneParts.push(makeCylinder(0.50, 0.56, 0.26, 12, archX + ox, archY + 0.84, archZ + oz));
      // Sculpted lotus petal ring carved around each plinth
      for (let p = 0; p < 8; p++) {
        const a = (p / 8) * Math.PI * 2;
        const pet = new THREE.SphereGeometry(0.11, 6, 5);
        pet.scale(1.1, 0.6, 0.7);
        pet.translate(archX + ox + Math.cos(a) * 0.48, archY + 0.84, archZ + oz + Math.sin(a) * 0.48);
        stoneParts.push(pet);
      }
    }
  }
  // Exposed ancient terracotta brick palace well & drainage trench
  const wellRing = new THREE.TorusGeometry(0.92, 0.22, 8, 16);
  wellRing.rotateX(Math.PI * 0.5);
  wellRing.translate(archX, archY + 0.58, archZ - 0.3);
  brickParts.push(wellRing);
  voidParts.push(makeCylinder(0.75, 0.75, 0.25, 12, archX, archY + 0.44, archZ - 0.3));

  // Modern timber-and-glass protective shelter canopy over the excavation pit
  const sheltH = 5.4;
  for (const sx of [-8.8, -3.0, 3.0, 8.8]) {
    for (const sz of [-6.8, 6.8]) {
      woodParts.push(makeBox(0.32, sheltH, 0.32, archX + sx, archY + sheltH * 0.5, archZ + sz));
    }
    // Timber roof truss rafters spanning North-South
    woodParts.push(makeBox(0.26, 0.32, 15.0, archX + sx, archY + sheltH + 0.12, archZ));
  }
  for (const sz of [-6.8, 0, 6.8]) {
    woodParts.push(makeBox(19.2, 0.28, 0.28, archX, archY + sheltH + (sz === 0 ? 1.15 : 0.16), archZ + sz));
  }
  // Sloped translucent glass roof panels on both pitched sides
  for (const side of [-1, 1]) {
    const panel = makeBox(19.6, 0.10, 8.0, 0, 0, 0);
    panel.rotateX(side * 0.145);
    panel.translate(archX, archY + sheltH + 0.68, archZ + side * 3.85);
    glassParts.push(panel);
  }
  const archPlaque = createSignagePlaqueMesh(
    {
      text: 'DI TÍCH 18 HOÀNG DIỆU',
      subText: 'KHẢO CỔ HỌC LÝ — TRẦN — LÊ',
      style: 'stone',
      width: 3.4,
      height: 0.92,
      depth: 0.16
    },
    ctx
  );
  archPlaque.name = 'HoangDieuArchaeologicalPlaque';
  archPlaque.position.set(archX, archY + 1.35, archZ + 7.4);
  group.add(archPlaque);

  const imperialFoliageMat = new THREE.MeshStandardMaterial({
    color: '#2e6b35',
    roughness: 0.78,
    metalness: 0.02
  });
  ctx.extraMaterials.push(imperialFoliageMat);

  const shelterGlassMat = new THREE.MeshStandardMaterial({
    color: '#cfe4ee',
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(shelterGlassMat);

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'HoangThanhStoneBase');
  addMergedMesh(group, brickParts, ctx.materials.chamBrick, 'HoangThanhCitadelBrick');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'HoangThanhCrimsonColumns');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'HoangThanhCurvedRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'HoangThanhGoldTrim');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'HoangThanhTimberDoors');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'HoangThanhBronzeRelics');
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'HoangThanhPortalVoids', false, false);
  addMergedMesh(group, steelParts, stainlessMat, 'HoangThanhFlagstaffAndRailings');
  addMergedMesh(group, foliageParts, imperialFoliageMat, 'HoangThanhPlazaFlowerbeds');
  addMergedMesh(group, glassParts, shelterGlassMat, 'HoangDieuGlassCanopy', false, false);
  addMergedMesh(group, lanternParts, ctx.materials.lanternSilk, 'HoangThanhImperialLanterns', false, false);
  addMergedMesh(
    group,
    lanternCoreParts,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    'HoangThanhImperialLanternCores',
    false,
    false
  );

  addIncenseSmoke(ctx, flagUniforms, group, smokeSources, 'HoangThanhIncenseSmoke');
  ctx.scene.add(group);
}

/**
 * 2. Cột cờ Lũng Cú — Hà Giang at (-380, -340).
 * Real-world scale: 34.0m total height + expanded r=14m citadel terrace with connected lotus_stone
 * balustrades (Bug B15), embossed Đông Sơn drum medallions, Twin Hồ Mắt Rồng ponds, 3 Lô Lô Chải
 * earthen cottages, and pink buckwheat (*tam giác mạch*) blossom clusters.
 */
function buildLungCuFlagpole(
  ctx: VietnamBuilderContext,
  stainlessMat: THREE.MeshStandardMaterial,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const cx = -380;
  const cz = -340;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 24.0 },
    { x: -348, z: -325, r: 12.0 },
    { x: -410, z: -315, r: 11.0 },
    { x: -332, z: -316, r: 14.0 }
  );

  const group = new THREE.Group();
  group.name = 'LungCuFlagpoleComplex';

  const greenStoneMat = new THREE.MeshStandardMaterial({
    color: '#5a6d65',
    map: ctx.pbr.stone.map,
    normalMap: ctx.pbr.stone.normalMap,
    roughnessMap: ctx.pbr.stone.roughnessMap,
    roughness: 0.78,
    metalness: 0.06
  });
  ctx.extraMaterials.push(greenStoneMat);

  const pondWaterMat = new THREE.MeshStandardMaterial({
    color: '#1b6d5a',
    roughness: 0.16,
    metalness: 0.22
  });
  ctx.extraMaterials.push(pondWaterMat);

  const buckwheatMat = new THREE.MeshStandardMaterial({
    color: '#e57aa6',
    roughness: 0.68,
    metalness: 0.02
  });
  ctx.extraMaterials.push(buckwheatMat);

  const highlandFoliageMat = new THREE.MeshStandardMaterial({
    color: '#3c6e3b',
    roughness: 0.80,
    metalness: 0.02
  });
  ctx.extraMaterials.push(highlandFoliageMat);

  const stoneParts: THREE.BufferGeometry[] = [];
  const graniteParts: THREE.BufferGeometry[] = [];
  const greenStoneParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const pondWaterParts: THREE.BufferGeometry[] = [];
  const ochreParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const darkRoofParts: THREE.BufferGeometry[] = [];
  const buckwheatParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  // 1. Expanded 3-tier octagonal limestone citadel base (Tier 1 r = 14.0m, skirted -6.5m into peak)
  const skirtDepth = 6.5;
  const tier1H = 1.25;
  const tier2H = 1.05;
  const tier3H = 0.90;

  stoneParts.push(
    makeCylinder(13.4, 14.0, tier1H + skirtDepth, 8, cx, yBase + (tier1H - skirtDepth) * 0.5, cz)
  );
  graniteParts.push(makeCylinder(10.0, 10.6, tier2H, 8, cx, yBase + tier1H + tier2H * 0.5, cz));
  stoneParts.push(
    makeCylinder(6.6, 7.1, tier3H, 8, cx, yBase + tier1H + tier2H + tier3H * 0.5, cz)
  );

  // Connected `lotus_stone` perimeter balustrade around all 8 sides of Tier 1 terrace (fixes Bug B15!)
  const balR = 12.8;
  const balY = yBase + tier1H;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const x0 = cx + Math.cos(a0) * balR;
    const z0 = cz + Math.sin(a0) * balR;
    const x1 = cx + Math.cos(a1) * balR;
    const z1 = cz + Math.sin(a1) * balR;
    stoneParts.push(...createLotusFinialParts(x0, balY + 1.02, z0, 0.72));
    // Leave SE staircase entrance edge (i === 0, angle centered at +PI/4) open in the middle
    if (i === 0) {
      const mx0 = THREE.MathUtils.lerp(x0, x1, 0.25);
      const mz0 = THREE.MathUtils.lerp(z0, z1, 0.25);
      const mx1 = THREE.MathUtils.lerp(x0, x1, 0.75);
      const mz1 = THREE.MathUtils.lerp(z0, z1, 0.75);
      stoneParts.push(
        ...createPiercedBalustradeParts(x0, z0, mx0, mz0, balY, 0.98, 'lotus_stone'),
        ...createPiercedBalustradeParts(mx1, mz1, x1, z1, balY, 0.98, 'lotus_stone')
      );
    } else {
      stoneParts.push(...createPiercedBalustradeParts(x0, z0, x1, z1, balY, 0.98, 'lotus_stone'));
    }
  }

  // Stepped granite approach stairway descending SE slope (-6.5m skirt)
  const stairDirX = 0.7071;
  const stairDirZ = 0.7071;
  const stairRotY = Math.atan2(stairDirX, stairDirZ);
  const stairSteps = 20;
  for (let s = 0; s < stairSteps; s++) {
    const dist = 7.0 + s * 0.94;
    const sx = cx + stairDirX * dist;
    const sz = cz + stairDirZ * dist;
    const sy = THREE.MathUtils.lerp(
      yBase + 3.0,
      Math.max(yBase - 4.2, ctx.getHeight(sx, sz) + 0.35),
      s / (stairSteps - 1)
    );
    const terrainY = ctx.getHeight(sx, sz);
    const bot = Math.min(sy - 1.2, terrainY - skirtDepth);
    const h = Math.max(0.6, sy - bot);
    graniteParts.push(makeBox(5.0, h, 1.08, sx, bot + h * 0.5, sz, stairRotY));
    for (const side of [-1, 1]) {
      const cxOff = Math.cos(stairRotY) * 2.68 * side;
      const czOff = -Math.sin(stairRotY) * 2.68 * side;
      stoneParts.push(
        makeBox(0.46, h + 0.72, 1.12, sx + cxOff, bot + (h + 0.72) * 0.5, sz + czOff, stairRotY)
      );
    }
  }

  // 8 Green-Grey Đông Sơn stone relief plinths + embossed 3D bronze drum medallions
  const pedTopY = yBase + tier1H + tier2H + tier3H; // yBase + 3.2m
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(ang) * 4.55;
    const pz = cz + Math.sin(ang) * 4.55;
    const rot = -ang + Math.PI * 0.5;
    greenStoneParts.push(makeBox(2.45, 2.85, 0.58, px, pedTopY + 1.42, pz, rot));
    stoneParts.push(makeBox(2.68, 0.30, 0.72, px, pedTopY + 2.92, pz, rot));

    // Skip blocking the SE ground-floor doorway on face i === 0; mount plaque above doorway instead
    if (i === 0) {
      // Ground-floor arched entrance doorway into the octagonal tower
      const doorX = cx + Math.cos(ang) * 4.82;
      const doorZ = cz + Math.sin(ang) * 4.82;
      const doorFrame = createArchedWallGeometry(2.2, 2.65, 0.56, 1.38, 2.15);
      doorFrame.rotateY(rot);
      doorFrame.translate(doorX, pedTopY, doorZ);
      stoneParts.push(doorFrame);
      const doorVoid = makeBox(1.30, 2.05, 0.32, 0, 1.02, 0);
      doorVoid.rotateY(rot);
      doorVoid.translate(cx + Math.cos(ang) * 4.72, pedTopY, cz + Math.sin(ang) * 4.72);
      voidParts.push(doorVoid);
      continue;
    }

    // Embossed 3D Đông Sơn bronze drum half-relief medallion + sun-star rings
    const mx = cx + Math.cos(ang) * 4.86;
    const mz = cz + Math.sin(ang) * 4.86;
    const drumRelief = createDongSonDrum3DParts(0, 0, 0, 0.76);
    for (const part of drumRelief) {
      part.scale(1.0, 0.14, 1.0);
      part.rotateX(Math.PI * 0.5);
      part.rotateY(rot);
      part.translate(mx, pedTopY + 1.46, mz);
      bronzeParts.push(part);
    }
    // Embossed concentric sun-star ring & 8 radial sun rays on drum medallion face
    const sunRing = new THREE.TorusGeometry(0.46, 0.045, 6, 16);
    sunRing.rotateY(rot);
    sunRing.translate(cx + Math.cos(ang) * 5.04, pedTopY + 1.46, cz + Math.sin(ang) * 5.04);
    bronzeParts.push(sunRing);
    for (let r = 0; r < 8; r++) {
      const ra = (r / 8) * Math.PI * 2;
      const ray = new THREE.ConeGeometry(0.055, 0.32, 4);
      ray.rotateZ(ra - Math.PI * 0.5);
      ray.translate(Math.cos(ra) * 0.24, Math.sin(ra) * 0.24, 0.18);
      ray.rotateY(rot);
      ray.translate(mx, pedTopY + 1.46, mz);
      bronzeParts.push(ray);
    }
  }

  // Readable "CỘT CỜ LŨNG CÚ — CỰC BẮC TỔ QUỐC" bronze plaque facing SE staircase
  const plaqueAng = Math.PI * 0.25;
  const lcPlaque = createSignagePlaqueMesh(
    {
      text: 'CỘT CỜ LŨNG CÚ',
      subText: 'CỰC BẮC TỔ QUỐC — HÀ GIANG',
      style: 'bronze',
      width: 3.6,
      height: 1.05,
      depth: 0.18
    },
    ctx
  );
  lcPlaque.name = 'LungCuSovereigntyPlaque';
  lcPlaque.position.set(cx + Math.cos(plaqueAng) * 5.35, pedTopY + 3.65, cz + Math.sin(plaqueAng) * 5.35);
  lcPlaque.rotation.y = -plaqueAng + Math.PI * 0.5;
  group.add(lcPlaque);

  // 2. Monumental 21m-tall octagonal stone tower shaft with vertical recessed arched ventilation slits
  const shaftH = 17.8;
  const shaftBotY = pedTopY;
  const shaftTopY = shaftBotY + shaftH; // yBase + 21.0m
  graniteParts.push(makeCylinder(2.4, 3.2, shaftH, 8, cx, shaftBotY + shaftH * 0.5, cz));

  // Bronze Đông Sơn relief rings banding the octagonal shaft
  for (const frac of [0.18, 0.39, 0.61, 0.82, 0.98]) {
    const ry = shaftBotY + shaftH * frac;
    const rad = THREE.MathUtils.lerp(3.2, 2.4, frac) + 0.14;
    const ring = new THREE.TorusGeometry(rad, 0.13, 8, 8);
    ring.rotateX(Math.PI * 0.5);
    ring.rotateY(Math.PI / 8);
    ring.translate(cx, ry, cz);
    bronzeParts.push(ring);
  }

  // Vertical rows of recessed arched ventilation slits up all 8 shaft faces
  for (const frac of [0.28, 0.50, 0.72, 0.90]) {
    const vy = shaftBotY + shaftH * frac;
    const faceR = THREE.MathUtils.lerp(3.2, 2.4, frac) * Math.cos(Math.PI / 8);
    for (let f = 0; f < 8; f++) {
      const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
      const rot = -ang + Math.PI * 0.5;
      const vx = cx + Math.cos(ang) * (faceR + 0.03);
      const vz = cz + Math.sin(ang) * (faceR + 0.03);
      const slitFrame = createArchedWallGeometry(0.76, 1.38, 0.16, 0.42, 1.08);
      slitFrame.rotateY(rot);
      slitFrame.translate(vx, vy - 0.65, vz);
      stoneParts.push(slitFrame);

      const slitVoid = makeBox(0.38, 1.02, 0.14, 0, 0, 0);
      slitVoid.rotateY(rot);
      slitVoid.translate(cx + Math.cos(ang) * (faceR + 0.02), vy - 0.14, cz + Math.sin(ang) * (faceR + 0.02));
      voidParts.push(slitVoid);
    }
  }

  // Observation gallery deck & connected bronze safety balustrade at +21.0m
  stoneParts.push(makeCylinder(4.2, 3.55, 0.58, 8, cx, shaftTopY - 0.15, cz));
  const railY = shaftTopY + 0.14;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    bronzeParts.push(
      ...createPiercedBalustradeParts(
        cx + Math.cos(a0) * 3.85,
        cz + Math.sin(a0) * 3.85,
        cx + Math.cos(a1) * 3.85,
        cz + Math.sin(a1) * 3.85,
        railY,
        1.15,
        'gold_pipe'
      )
    );
  }
  // Twin sightseeing binoculars on observation gallery
  for (const bAng of [0.35, -1.2]) {
    const bx = cx + Math.cos(bAng) * 3.35;
    const bz = cz + Math.sin(bAng) * 3.35;
    bronzeParts.push(makeCylinder(0.06, 0.09, 1.25, 8, bx, railY + 0.62, bz));
    bronzeParts.push(makeCylinder(0.09, 0.09, 0.45, 8, bx, railY + 1.32, bz, Math.PI * 0.5, 0, -bAng));
  }

  // 3. 13.0m Stainless Flagstaff reaching 34.0m total height
  const poleH = 13.0;
  const poleBaseY = shaftTopY;
  bronzeParts.push(makeCylinder(0.42, 0.58, 0.9, 12, cx, poleBaseY + 0.45, cz));
  steelParts.push(makeCylinder(0.11, 0.24, poleH, 14, cx, poleBaseY + poleH * 0.5, cz));
  bronzeParts.push(
    new THREE.ConeGeometry(0.20, 0.65, 10).translate(cx, poleBaseY + poleH + 0.32, cz)
  );

  // 4. Twin Hồ Mắt Rồng (Dragon Eye Ponds) on lower flanks (-348, -325) & (-410, -315)
  const dragonPonds = [
    { x: -348, z: -325, r: 9.2 },
    { x: -410, z: -315, r: 8.4 }
  ];
  for (let pi = 0; pi < dragonPonds.length; pi++) {
    const pond = dragonPonds[pi];
    const py = ctx.getHeight(pond.x, pond.z);
    // Skirted terraced stone basin so pond sits level on hillside
    stoneParts.push(makeCylinder(pond.r + 1.35, pond.r + 2.4, 5.2, 20, pond.x, py - 2.35, pond.z));
    // Raised stone embankment rim
    const rim = new THREE.TorusGeometry(pond.r + 0.45, 0.52, 8, 24);
    rim.rotateX(Math.PI * 0.5);
    rim.translate(pond.x, py + 0.36, pond.z);
    stoneParts.push(rim);
    // Round emerald Dragon Eye water surface
    pondWaterParts.push(makeCylinder(pond.r, pond.r, 0.16, 24, pond.x, py + 0.24, pond.z));
    // Natural limestone boulders & alpine shrubs along pond shore
    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2 + pi * 0.5;
      const bx = pond.x + Math.cos(ba) * (pond.r + 0.95);
      const bz = pond.z + Math.sin(ba) * (pond.r + 0.95);
      const rock = createSculptedRockGeometry(620 + pi * 20 + b, 0.75, 0.55, 0.72, 1);
      rock.translate(bx, py + 0.35, bz);
      graniteParts.push(rock);
    }
  }

  // 5. 3 Lô Lô Chải Earthen-Wall Cottages (*Nhà trình tường đất vàng mái ngói âm dương*)
  const cottages = [
    { x: -334, z: -319, rotY: -0.65, w: 6.4, d: 4.6 },
    { x: -324, z: -327, rotY: -0.95, w: 5.8, d: 4.4 },
    { x: -336, z: -305, rotY: -0.35, w: 6.0, d: 4.5 }
  ];
  for (const cot of cottages) {
    const gy = ctx.getHeight(cot.x, cot.z);
    const cStone: THREE.BufferGeometry[] = [];
    const cOchre: THREE.BufferGeometry[] = [];
    const cWood: THREE.BufferGeometry[] = [];
    const cRoof: THREE.BufferGeometry[] = [];
    const cVoid: THREE.BufferGeometry[] = [];

    // Skirted dry-stone foundation pad
    cStone.push(makeBox(cot.w + 0.8, 4.2, cot.d + 0.8, 0, -1.75, 0));
    // Thick ochre rammed-earth walls (2.8m tall)
    cOchre.push(makeBox(cot.w, 2.8, cot.d, 0, 1.75, 0));
    // Recessed timber doorway & shuttered windows on front face (+Z)
    cWood.push(makeBox(1.35, 2.05, 0.16, 0, 1.38, cot.d * 0.5 + 0.04));
    cVoid.push(makeBox(1.05, 1.85, 0.18, 0, 1.32, cot.d * 0.5 + 0.06));
    for (const sx of [-1, 1]) {
      cWood.push(makeBox(0.92, 0.92, 0.14, sx * (cot.w * 0.30), 1.82, cot.d * 0.5 + 0.04));
      cVoid.push(makeBox(0.68, 0.68, 0.16, sx * (cot.w * 0.30), 1.82, cot.d * 0.5 + 0.06));
    }
    // Dark yin-yang tiled pitched roof with gentle overhang
    const cotRoof = createVietnameseCurvedRoofGeometry(cot.w + 1.4, cot.d + 1.4, cot.w * 0.72, 0.32, 1.85, 0.14);
    cotRoof.translate(0, 3.12, 0);
    cRoof.push(cotRoof);
    // Low cat-ear stacked-stone fence (*tường đá tai mèo*) flanking yard
    cStone.push(makeBox(cot.w + 2.8, 0.92, 0.38, 0, 0.80, cot.d * 0.5 + 1.65));

    const applyCot = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
      for (const g of src) {
        g.rotateY(cot.rotY);
        g.translate(cot.x, gy, cot.z);
        dst.push(g);
      }
    };
    applyCot(cStone, stoneParts);
    applyCot(cOchre, ochreParts);
    applyCot(cWood, woodParts);
    applyCot(cRoof, darkRoofParts);
    applyCot(cVoid, voidParts);
  }

  // 6. Clusters of Pink Buckwheat (*Hoa Tam Giác Mạch*) Blossoms flanking stairs & cottages
  const randBw = mulberry32(380340);
  const bwCenters = [
    { x: cx + 10.5, z: cz + 14.5 },
    { x: cx + 15.0, z: cz + 10.5 },
    { x: cx + 17.5, z: cz + 19.5 },
    { x: cx + 11.5, z: cz + 21.5 },
    { x: -342, z: -316 },
    { x: -355, z: -318 },
    { x: -330, z: -312 },
    { x: -398, z: -318 }
  ];
  for (let ci = 0; ci < bwCenters.length; ci++) {
    const bc = bwCenters[ci];
    for (let k = 0; k < 10; k++) {
      const fx = bc.x + (randBw() - 0.5) * 6.5;
      const fz = bc.z + (randBw() - 0.5) * 6.5;
      const fy = ctx.getHeight(fx, fz);
      const rBush = 0.45 + randBw() * 0.38;
      const leaf = createSculptedRockGeometry(710 + ci * 13 + k, rBush, 0.32, rBush, 1);
      leaf.translate(fx, fy + 0.16, fz);
      foliageParts.push(leaf);
      const bloom = createSculptedRockGeometry(810 + ci * 13 + k, rBush * 0.82, 0.24, rBush * 0.82, 1);
      bloom.translate(fx, fy + 0.42, fz);
      buckwheatParts.push(bloom);
    }
  }

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'LungCuCitadelStone');
  addMergedMesh(group, graniteParts, ctx.materials.granite, 'LungCuTowerGranite');
  addMergedMesh(group, greenStoneParts, greenStoneMat, 'LungCuDongSonStoneReliefs');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'LungCuDongSonBronze');
  addMergedMesh(group, steelParts, stainlessMat, 'LungCuFlagstaff');
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'LungCuShaftVentsVoid', false, false);
  addMergedMesh(group, pondWaterParts, pondWaterMat, 'LungCuDragonEyePonds', false, true);
  addMergedMesh(group, ochreParts, ctx.materials.yellowOchrePlaster, 'LoLoChaiEarthenWalls');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'LoLoChaiTimberTrim');
  addMergedMesh(group, darkRoofParts, ctx.materials.darkRoof, 'LoLoChaiYinYangRoofs');
  addMergedMesh(group, foliageParts, highlandFoliageMat, 'LungCuBuckwheatFoliage');
  addMergedMesh(group, buckwheatParts, buckwheatMat, 'LungCuBuckwheatBlossoms');

  // Monumental 54 m² (9.0m x 6.0m) Animated Waving Crimson Flag with Golden 5-Pointed Star
  const flagW = 9.0;
  const flagH = 6.0;
  const flagGeo = new THREE.PlaneGeometry(flagW, flagH, 36, 20);
  flagGeo.translate(flagW * 0.5 + 0.14, 0, 0);
  const flagMat = addWavingFlagMat(ctx, flagUniforms, {
    waveScale: 1.45,
    showStar: true
  });

  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.name = 'LungCuNationalFlag';
  flagMesh.position.set(cx, poleBaseY + poleH - flagH * 0.5 - 0.25, cz);
  flagMesh.rotation.y = -0.35;
  flagMesh.castShadow = true;
  group.add(flagMesh);

  ctx.scene.add(group);
}

/**
 * Creates swirling ethereal summit cloud mist ShaderMaterial for Fansipan.
 */
function createSummitMistMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: { uTime: { value: number } };
} {
  const uniforms = {
    uTime: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float ang = uv.x * 6.2831853;
        pos.y += sin(ang * 3.0 + uTime * 0.45) * 0.42 + cos(ang * 5.0 - uTime * 0.3) * 0.24;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float ang = vUv.x * 6.2831853;
        float drift1 = sin(ang * 3.0 - uTime * 0.35 + vUv.y * 2.5);
        float drift2 = cos(ang * 5.0 + uTime * 0.24 - vUv.y * 3.2);
        float drift3 = sin(ang * 9.0 - uTime * 0.48 + 1.4);
        float wisp = 0.52 + 0.26 * drift1 + 0.16 * drift2 + 0.08 * drift3;

        float edgeFade = smoothstep(0.0, 0.38, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
        float alpha = clamp(wisp * edgeFade * 0.38, 0.0, 0.44);
        vec3 mistCol = mix(vec3(0.86, 0.91, 0.96), vec3(1.0, 0.98, 0.94), 0.35 + 0.25 * drift1);

        gl_FragColor = vec4(mistCol, alpha);
      }
    `
  });

  return { material, uniforms };
}

/**
 * 3. Đỉnh Fansipan — Nóc Nhà Đông Dương at (400, -330).
 * Expanded 34x32m multi-level sanctuary, 21.5m Đại Tượng Phật A Di Đà (7.5m chapel pedestal + 14.0m bronze Buddha),
 * 25.0m Summit Flagpole (6.5x4.3m flag), Kim Sơn Bảo Thắng Pagoda, 18.0m 11-story Bảo Tháp Stupa,
 * Vọng Lĩnh Cao Đài Bell Tower, "FANSIPAN 3.143m" plaques, and alpine red rhododendron shrubs.
 */
function buildFansipanSummit(
  ctx: VietnamBuilderContext,
  stainlessMat: THREE.MeshStandardMaterial,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const cx = 400;
  const cz = -330;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34.0 });

  const group = new THREE.Group();
  group.name = 'FansipanSummitComplex';

  const darkBuddhaBronzeMat = new THREE.MeshStandardMaterial({
    color: '#4a3d2d',
    roughness: 0.36,
    metalness: 0.78
  });
  ctx.extraMaterials.push(darkBuddhaBronzeMat);

  const rhodoLeafMat = new THREE.MeshStandardMaterial({
    color: '#28522e',
    roughness: 0.78,
    metalness: 0.02
  });
  ctx.extraMaterials.push(rhodoLeafMat);

  const rhodoFlowerMat = new THREE.MeshStandardMaterial({
    color: '#d42638',
    roughness: 0.56,
    metalness: 0.02
  });
  ctx.extraMaterials.push(rhodoFlowerMat);

  const graniteParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const stainlessParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const buddhaBronzeParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const rhodoLeafParts: THREE.BufferGeometry[] = [];
  const rhodoFlowerParts: THREE.BufferGeometry[] = [];
  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  // 1. Grand Multi-Level Granite Sanctuary Deck (34m x 32m, skirted -9.0m into summit crown)
  const deckW = 34.0;
  const deckD = 32.0;
  const halfW = deckW * 0.5; // 17.0
  const halfD = deckD * 0.5; // 16.0
  const deckTopY = yBase + 0.85;
  const skirtBot = yBase - 9.0;
  const deckH = deckTopY - skirtBot;

  stoneParts.push(makeBox(deckW, deckH, deckD, cx, skirtBot + deckH * 0.5, cz));
  graniteParts.push(makeBox(deckW + 1.6, 6.8, deckD + 1.6, cx, yBase - 5.6, cz));

  // Upper Rear Sacred Terrace (+1.0m step-up for Buddha, Pagoda & 11-Story Stupa, z in [cz-16, cz+0.5])
  const upperDeckY = deckTopY + 1.0;
  stoneParts.push(makeBox(deckW - 0.6, 1.0, 16.5, cx, deckTopY + 0.5, cz - 7.75));
  // Broad central transition steps between front plaza and upper sanctuary terrace
  for (let s = 0; s < 4; s++) {
    graniteParts.push(makeBox(7.2, 0.25 + s * 0.25, 0.55, cx, deckTopY + (0.25 + s * 0.25) * 0.5, cz + 2.1 - s * 0.45));
  }

  // Connected `lotus_stone` perimeter balustrades around 34m x 32m sanctuary
  const balW = halfW - 0.4;
  const balD = halfD - 0.4;
  stoneParts.push(
    ...createPiercedBalustradeParts(cx - balW, cz - balD, cx + balW, cz - balD, upperDeckY, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx - balW, cz - balD, cx - balW, cz + 0.4, upperDeckY, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + balW, cz - balD, cx + balW, cz + 0.4, upperDeckY, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx - balW, cz + 0.4, cx - balW, cz + balD, deckTopY, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + balW, cz + 0.4, cx + balW, cz + balD, deckTopY, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx - balW, cz + balD, cx - 3.0, cz + balD, deckTopY, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(cx + 3.0, cz + balD, cx + balW, cz + balD, deckTopY, 1.05, 'lotus_stone')
  );

  // South approach granite stairs descending -9m skirted
  for (let s = 0; s < 8; s++) {
    const sz = cz + halfD + 0.4 + s * 0.85;
    const sy = deckTopY - 0.16 - s * 0.28;
    const h = sy - skirtBot;
    graniteParts.push(makeBox(5.8, h, 0.94, cx, skirtBot + h * 0.5, sz));
  }

  // 2. Rugged granite cliff crags & vibrant red rhododendron (*hoa đỗ quyên*) alpine shrubs around summit perimeter
  const rand = mulberry32(314302);
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + (rand() - 0.5) * 0.16;
    const rad = 21.5 + rand() * 7.2;
    const rx = cx + Math.cos(ang) * rad;
    const rz = cz + Math.sin(ang) * rad;
    const ry = ctx.getHeight(rx, rz);
    const sx = 2.6 + rand() * 2.4;
    const sy = 2.4 + rand() * 2.8;
    const sz = 2.6 + rand() * 2.4;
    const rock = createSculptedRockGeometry(3143 + i * 23, sx, sy, sz, 2);
    rock.rotateY(rand() * Math.PI * 2);
    rock.translate(rx, ry - sy * 0.28, rz);
    graniteParts.push(rock);

    // Alpine red rhododendron (*hoa đỗ quyên*) shrubs clinging to granite crags
    if (i % 2 === 0) {
      const shX = rx - Math.cos(ang) * 1.4;
      const shZ = rz - Math.sin(ang) * 1.4;
      const shY = Math.max(ry, yBase - 3.5);
      const foliage = createSculptedRockGeometry(4100 + i, 1.25 + rand() * 0.55, 0.85, 1.25 + rand() * 0.55, 1);
      foliage.translate(shX, shY + 0.55, shZ);
      rhodoLeafParts.push(foliage);
      for (let b = 0; b < 4; b++) {
        const ba = (b / 4) * Math.PI * 2 + rand();
        const blossom = new THREE.SphereGeometry(0.34 + rand() * 0.14, 6, 5);
        blossom.translate(shX + Math.cos(ba) * 0.72, shY + 0.98 + rand() * 0.25, shZ + Math.sin(ba) * 0.72);
        rhodoFlowerParts.push(blossom);
      }
    }
  }

  // 3. Brushed Stainless/Bronze Fansipan 3.143m Pyramid Monument (5.5m tall) with readable bronze plaques
  const pyrX = cx - 6.8;
  const pyrZ = cz + 8.5;
  stoneParts.push(makeCylinder(3.3, 3.6, 0.72, 6, pyrX, deckTopY + 0.36, pyrZ));
  graniteParts.push(makeCylinder(2.35, 2.6, 0.68, 3, pyrX, deckTopY + 1.06, pyrZ));
  const pyrBaseY = deckTopY + 1.40;
  const pyrH = 3.80;
  const pyramid = new THREE.ConeGeometry(1.58, pyrH, 3);
  pyramid.translate(pyrX, pyrBaseY + pyrH * 0.5, pyrZ);
  stainlessParts.push(pyramid);
  bronzeParts.push(makeCylinder(0.06, 0.34, 0.62, 3, pyrX, pyrBaseY + pyrH - 0.01, pyrZ));

  // Readable "FANSIPAN 3.143m" bronze plaques mounted on all 3 faces of the pyramid marker
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const plaque = createSignagePlaqueMesh(
      {
        text: 'FANSIPAN 3.143m',
        subText: 'NÓC NHÀ ĐÔNG DƯƠNG',
        style: 'bronze',
        width: 1.15,
        height: 0.78,
        depth: 0.08
      },
      ctx
    );
    plaque.name = `Fansipan3143Plaque_${i + 1}`;
    plaque.position.set(pyrX + Math.sin(ang) * 0.78, pyrBaseY + 1.42, pyrZ + Math.cos(ang) * 0.78);
    plaque.rotation.set(0, ang, 0);
    plaque.rotateX(-0.34);
    group.add(plaque);
  }

  // 4. TRUE 1:1 21.5m-TALL Đại Tượng Phật A Di Đà at (cx - 8.5, cz - 8.5)
  //    7.5m stepped granite & bronze chapel pedestal (with arched entrance & carved Trần cornice)
  //    + 14.0m sculpted bronze Amitabha Buddha (scale 5.15) seated on 3-layer lotus throne
  const bX = cx - 8.5;
  const bZ = cz - 8.5;
  const bBaseY = upperDeckY;
  // 7.5m stepped pedestal: Tier A (granite base 2.2m), Tier B (chapel sanctum 3.6m with arched portal), Tier C (Trần cornice & bronze lotus drum 1.7m)
  graniteParts.push(makeBox(11.6, 1.2, 11.6, bX, bBaseY + 0.6, bZ));
  stoneParts.push(makeBox(10.2, 1.0, 10.2, bX, bBaseY + 1.7, bZ));
  // Front stone chapel steps ascending to arched chapel doorway
  for (let s = 0; s < 5; s++) {
    stoneParts.push(makeBox(4.0, 0.44 + s * 0.44, 0.56, bX, bBaseY + (0.44 + s * 0.44) * 0.5, bZ + 6.9 - s * 0.46));
  }
  const chapY = bBaseY + 2.2;
  const chapH = 3.6;
  // Arched South chapel entrance wall + side/rear chapel walls
  const chapFront = createArchedWallGeometry(8.8, chapH, 1.1, 2.8, 2.9);
  chapFront.translate(bX, chapY, bZ + 3.85);
  stoneParts.push(chapFront);
  stoneParts.push(makeBox(8.8, chapH, 7.6, bX, chapY + chapH * 0.5, bZ - 0.5));
  voidParts.push(makeBox(2.55, 2.75, 0.45, bX, chapY + 1.38, bZ + 3.4));
  // Crimson doorway frame & golden lintel inside arched chapel entrance
  crimsonParts.push(makeBox(0.24, 2.35, 0.24, bX - 1.25, chapY + 1.18, bZ + 4.35));
  crimsonParts.push(makeBox(0.24, 2.35, 0.24, bX + 1.25, chapY + 1.18, bZ + 4.35));
  const chapelLight = new THREE.PointLight('#ffbf62', 1.6, 12, 1.5);
  chapelLight.position.set(bX, chapY + 1.8, bZ + 3.8);
  group.add(chapelLight);

  // Carved Trần-style stepped granite cornice + bronze lotus-throne drum reaching +7.5m
  const corniceY = chapY + chapH; // bBaseY + 5.8m
  stoneParts.push(makeBox(9.8, 0.46, 9.8, bX, corniceY + 0.23, bZ));
  stoneParts.push(makeBox(9.0, 0.42, 9.0, bX, corniceY + 0.67, bZ));
  // 3rd lower bronze lotus-petal molding ring right beneath the 14.0m Buddha
  buddhaBronzeParts.push(makeCylinder(4.65, 5.15, 0.82, 16, bX, corniceY + 1.29, bZ));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pet = new THREE.ConeGeometry(0.68, 1.35, 5);
    pet.scale(1.0, 1.0, 0.45);
    pet.rotateX(0.55);
    pet.rotateY(a);
    pet.translate(bX + Math.sin(a) * 4.85, corniceY + 1.45, bZ + Math.cos(a) * 4.85);
    buddhaBronzeParts.push(pet);
  }

  // 14.0m-tall sculpted bronze Amitabha Buddha seated on 3-layer lotus throne (pedestal 7.5m + statue 14.0m = 21.5m!)
  const buddhaSeatY = bBaseY + 7.5;
  const amitabha = createSculptedDeityParts(bX, buddhaSeatY, bZ, 0.18, 5.05, 'amitabha');
  buddhaBronzeParts.push(...amitabha.bodyParts);
  goldParts.push(...amitabha.accentParts);

  // Monumental bronze censer in front of Buddha chapel + GPU incense smoke
  const fanCenser = createBronzeIncenseTripodParts(bX, bBaseY, bZ + 8.1, 1.25);
  stoneParts.push(...fanCenser.limestoneParts);
  bronzeParts.push(...fanCenser.bronzeParts);
  goldParts.push(...fanCenser.goldParts);
  smokeSources.push({ x: bX, y: fanCenser.smokeY, z: bZ + 8.1, scale: 1.25 });

  // 5. UPGRADED Kim Sơn Bảo Thắng Summit Pagoda at (cx + 1.5, cz - 7.5)
  const pagX = cx + 1.5;
  const pagZ = cz - 7.5;
  const pagBaseY = upperDeckY;
  stoneParts.push(makeBox(8.4, 0.72, 8.4, pagX, pagBaseY + 0.36, pagZ));
  stoneParts.push(makeBox(7.2, 0.68, 7.2, pagX, pagBaseY + 1.06, pagZ));
  for (let s = 0; s < 4; s++) {
    stoneParts.push(makeBox(3.2, 0.34, 0.55, pagX, pagBaseY + 0.17 + s * 0.32, pagZ + 4.45 - s * 0.42));
  }
  const pagFloorY = pagBaseY + 1.40;
  const t1H = 3.45;
  for (const ox of [-2.45, 0, 2.45]) {
    for (const oz of [-2.45, 0, 2.45]) {
      if (ox === 0 && oz === 0) continue;
      if (ox === 0 && oz > 0) continue; // keep open front doorway clear
      crimsonParts.push(makeCylinder(0.16, 0.19, t1H, 10, pagX + ox, pagFloorY + t1H * 0.5, pagZ + oz));
      stoneParts.push(makeCylinder(0.26, 0.30, 0.22, 10, pagX + ox, pagFloorY + 0.11, pagZ + oz));
    }
  }
  // Open carved doorway sanctuary (left, right, rear walls + open swinging doors + altar)
  woodParts.push(makeBox(0.28, t1H * 0.86, 4.4, pagX - 2.15, pagFloorY + t1H * 0.43, pagZ));
  woodParts.push(makeBox(0.28, t1H * 0.86, 4.4, pagX + 2.15, pagFloorY + t1H * 0.43, pagZ));
  woodParts.push(makeBox(4.5, t1H * 0.86, 0.28, pagX, pagFloorY + t1H * 0.43, pagZ - 2.15));
  for (const side of [-1, 1]) {
    woodParts.push(makeBox(0.95, t1H * 0.80, 0.20, pagX + side * 1.65, pagFloorY + t1H * 0.40, pagZ + 2.15));
    woodParts.push(
      makeBox(0.76, t1H * 0.74, 0.12, pagX + side * 0.92, pagFloorY + t1H * 0.37, pagZ + 2.46, side * -0.58)
    );
    // Hanging eave lanterns
    lanternParts.push(
      createRibbedLanternShellGeometry(0.22, 0.32, 10, 6).translate(pagX + side * 2.45, pagFloorY + t1H - 0.48, pagZ + 2.75)
    );
    lanternCoreParts.push(
      createLanternCoreGeometry(0.13, 0.20).translate(pagX + side * 2.45, pagFloorY + t1H - 0.48, pagZ + 2.75)
    );
  }
  crimsonParts.push(makeBox(2.4, 0.92, 0.95, pagX, pagFloorY + 0.46, pagZ - 1.25));
  goldParts.push(makeBox(2.55, 0.14, 1.05, pagX, pagFloorY + 0.96, pagZ - 1.25));
  goldParts.push(makeBox(5.5, 0.26, 5.5, pagX, pagFloorY + t1H - 0.06, pagZ));

  const pagRoof1 = createVietnameseCurvedRoofGeometry(8.4, 8.4, 4.6, 4.6, 1.95, 0.40);
  pagRoof1.translate(pagX, pagFloorY + t1H + 0.02, pagZ);
  roofParts.push(pagRoof1);

  const t2Y = pagFloorY + t1H + 1.45;
  const t2H = 2.35;
  for (const ox of [-1.45, 1.45]) {
    for (const oz of [-1.45, 1.45]) {
      crimsonParts.push(makeCylinder(0.13, 0.15, t2H, 10, pagX + ox, t2Y + t2H * 0.5, pagZ + oz));
    }
  }
  woodParts.push(makeBox(2.4, t2H * 0.84, 2.4, pagX, t2Y + t2H * 0.44, pagZ));
  goldParts.push(makeBox(3.4, 0.22, 3.4, pagX, t2Y + t2H - 0.05, pagZ));

  const pagRoof2 = createVietnameseCurvedRoofGeometry(5.8, 5.8, 2.2, 0.65, 2.25, 0.46);
  pagRoof2.translate(pagX, t2Y + t2H + 0.02, pagZ);
  roofParts.push(pagRoof2);

  const pagFinials = createRoofFinialSetParts(pagX, t2Y + t2H + 2.24, pagZ, 2.4, 0, 0.78, true);
  crimsonParts.push(...pagFinials.mainParts);
  goldParts.push(...pagFinials.goldParts);

  // 6. 11-Story Carved Stone Bảo Tháp Stupa (18.0m tall) at (cx + 10.5, cz - 8.5)
  const stuX = cx + 10.5;
  const stuZ = cz - 8.5;
  const stuBaseY = upperDeckY;
  // Stepped carved square granite plinth (1.8m)
  graniteParts.push(makeBox(4.8, 0.95, 4.8, stuX, stuBaseY + 0.475, stuZ));
  stoneParts.push(makeBox(4.0, 0.85, 4.0, stuX, stuBaseY + 1.375, stuZ));

  // 11 diminishing square stone stories with upturned curved stone eaves (14.2m shaft)
  let stuCurY = stuBaseY + 1.80;
  for (let tier = 0; tier < 11; tier++) {
    const frac = tier / 10;
    const tierW = THREE.MathUtils.lerp(3.15, 1.12, frac);
    const tierH = THREE.MathUtils.lerp(1.52, 1.04, frac);
    const bodyH = tierH * 0.68;
    const eaveH = tierH * 0.32;

    stoneParts.push(makeBox(tierW, bodyH, tierW, stuX, stuCurY + bodyH * 0.5, stuZ));
    // Recessed arched Buddha niches on all 4 sides of lower 6 tiers
    if (tier < 6) {
      const nw = tierW * 0.34;
      const nh = bodyH * 0.68;
      for (const side of [-1, 1]) {
        voidParts.push(makeBox(nw, nh, 0.08, stuX, stuCurY + nh * 0.52, stuZ + side * (tierW * 0.5 + 0.02)));
        voidParts.push(makeBox(0.08, nh, nw, stuX + side * (tierW * 0.5 + 0.02), stuCurY + nh * 0.52, stuZ));
      }
    }
    // Upturned curved carved stone eave cap on every story
    const eave = createVietnameseCurvedRoofGeometry(
      tierW * 1.38,
      tierW * 1.38,
      tierW * 0.94,
      tierW * 0.94,
      eaveH * 1.25,
      0.16
    );
    eave.translate(stuX, stuCurY + bodyH - 0.04, stuZ);
    stoneParts.push(eave);

    stuCurY += tierH;
  }
  // 2.0m sculpted lotus crown & bronze finial spire (total = 1.8 + 14.08 + 2.12 ≈ 18.0m!)
  stoneParts.push(...createLotusFinialParts(stuX, stuCurY, stuZ, 1.45));
  bronzeParts.push(makeCylinder(0.06, 0.24, 1.35, 10, stuX, stuCurY + 1.45, stuZ));
  goldParts.push(new THREE.SphereGeometry(0.18, 8, 6).translate(stuX, stuCurY + 2.12, stuZ));

  // 7. Vọng Lĩnh Cao Đài Bell Tower at (cx + 10.0, cz + 4.5) housing createBronzeBellParts
  const bellX = cx + 10.0;
  const bellZ = cz + 4.5;
  const bellBaseY = deckTopY;
  stoneParts.push(makeBox(6.0, 0.85, 6.0, bellX, bellBaseY + 0.425, bellZ));
  const bfY = bellBaseY + 0.85;
  // Open 4-pillar lower & upper crimson bell pavilion
  const bt1H = 3.2;
  for (const ox of [-2.1, 2.1]) {
    for (const oz of [-2.1, 2.1]) {
      crimsonParts.push(makeCylinder(0.16, 0.19, bt1H, 10, bellX + ox, bfY + bt1H * 0.5, bellZ + oz));
      stoneParts.push(makeCylinder(0.26, 0.30, 0.24, 10, bellX + ox, bfY + 0.12, bellZ + oz));
    }
  }
  crimsonParts.push(
    ...createPiercedBalustradeParts(bellX - 2.1, bellZ - 2.1, bellX + 2.1, bellZ - 2.1, bfY + 0.08, 0.76, 'con_tien'),
    ...createPiercedBalustradeParts(bellX - 2.1, bellZ - 2.1, bellX - 2.1, bellZ + 2.1, bfY + 0.08, 0.76, 'con_tien'),
    ...createPiercedBalustradeParts(bellX + 2.1, bellZ - 2.1, bellX + 2.1, bellZ + 2.1, bfY + 0.08, 0.76, 'con_tien')
  );
  // Hanging Đại Hồng Chung bronze bell suspended inside the open chamber
  woodParts.push(makeBox(4.4, 0.26, 0.28, bellX, bfY + bt1H - 0.25, bellZ));
  bronzeParts.push(...createBronzeBellParts(bellX, bfY + 0.95, bellZ, 1.38));

  const btRoof1 = createVietnameseCurvedRoofGeometry(6.8, 6.8, 3.6, 3.6, 1.55, 0.36);
  btRoof1.translate(bellX, bfY + bt1H, bellZ);
  roofParts.push(btRoof1);

  const bt2Y = bfY + bt1H + 1.12;
  const bt2H = 2.05;
  for (const ox of [-1.25, 1.25]) {
    for (const oz of [-1.25, 1.25]) {
      crimsonParts.push(makeCylinder(0.12, 0.14, bt2H, 8, bellX + ox, bt2Y + bt2H * 0.5, bellZ + oz));
    }
  }
  const btRoof2 = createVietnameseCurvedRoofGeometry(4.8, 4.8, 1.8, 0.5, 1.85, 0.42);
  btRoof2.translate(bellX, bt2Y + bt2H, bellZ);
  roofParts.push(btRoof2);

  const btFinials = createRoofFinialSetParts(bellX, bt2Y + bt2H + 1.85, bellZ, 1.8, 0, 0.65, false);
  crimsonParts.push(...btFinials.mainParts);
  goldParts.push(...btFinials.goldParts);

  // 8. UPGRADED 25.0m Ceremonial Summit Flagpole on SE Quadrant with 6.5m x 4.3m Waving Flag
  const poleX = cx + 11.2;
  const poleZ = cz + 11.8;
  stoneParts.push(makeCylinder(1.85, 2.25, 1.45, 8, poleX, deckTopY + 0.725, poleZ));
  graniteParts.push(makeCylinder(1.25, 1.55, 1.25, 8, poleX, deckTopY + 2.075, poleZ));
  const fPoleBaseY = deckTopY + 2.70;
  const fPoleH = 22.3; // 2.70 + 22.3 = 25.0m total flagpole height!
  bronzeParts.push(makeCylinder(0.32, 0.46, 0.85, 10, poleX, fPoleBaseY + 0.42, poleZ));
  stainlessParts.push(makeCylinder(0.09, 0.22, fPoleH, 14, poleX, fPoleBaseY + fPoleH * 0.5, poleZ));
  goldParts.push(
    new THREE.ConeGeometry(0.18, 0.58, 8).translate(poleX, fPoleBaseY + fPoleH + 0.29, poleZ)
  );

  addMergedMesh(group, graniteParts, ctx.materials.granite, 'FansipanGraniteCrags');
  addMergedMesh(group, stoneParts, ctx.materials.stone, 'FansipanSummitStonePlaza');
  addMergedMesh(group, stainlessParts, stainlessMat, 'Fansipan3143Milestone');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'FansipanBronzeTrim');
  addMergedMesh(group, buddhaBronzeParts, darkBuddhaBronzeMat, 'FansipanAmitabhaBuddhaStatue');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'FansipanSummitPagoda');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'FansipanPagodaTimber');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'FansipanPagodaRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'FansipanPagodaGold');
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'FansipanChapelVoids', false, false);
  addMergedMesh(group, lanternParts, ctx.materials.lanternSilk, 'FansipanPagodaLanterns', false, false);
  addMergedMesh(
    group,
    lanternCoreParts,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    'FansipanPagodaLanternCores',
    false,
    false
  );
  addMergedMesh(group, rhodoLeafParts, rhodoLeafMat, 'FansipanRhododendronShrubs');
  addMergedMesh(group, rhodoFlowerParts, rhodoFlowerMat, 'FansipanRhododendronBlossoms');

  const sumFlagMat = addWavingFlagMat(ctx, flagUniforms, {
    waveScale: 1.35,
    showStar: true
  });
  const sFlagW = 6.5;
  const sFlagH = 4.3;
  const sFlagGeo = new THREE.PlaneGeometry(sFlagW, sFlagH, 32, 18);
  sFlagGeo.translate(sFlagW * 0.5 + 0.12, 0, 0);
  const sFlagMesh = new THREE.Mesh(sFlagGeo, sumFlagMat);
  sFlagMesh.name = 'FansipanCeremonialFlag';
  sFlagMesh.position.set(poleX, fPoleBaseY + fPoleH - sFlagH * 0.5 - 0.22, poleZ);
  sFlagMesh.rotation.y = -0.45;
  sFlagMesh.castShadow = true;
  group.add(sFlagMesh);

  // Swirling Summit Sea-of-Clouds Mist Halo expanded to wrap the 34x32m sanctuary cleanly
  const { material: mistMat, uniforms: mistU } = createSummitMistMaterial();
  ctx.extraMaterials.push(mistMat);
  registerUniform(ctx, flagUniforms, mistU);

  const mistOuter = new THREE.CylinderGeometry(35.0, 24.5, 4.6, 56, 4, true);
  mistOuter.translate(cx, yBase - 1.8, cz);
  const mistMid = new THREE.CylinderGeometry(29.5, 21.5, 3.2, 48, 3, true);
  mistMid.translate(cx, yBase - 0.5, cz);
  const mistInner = new THREE.CylinderGeometry(25.0, 19.5, 2.0, 40, 2, true);
  mistInner.translate(cx, yBase + 0.65, cz);
  const mistMesh = new THREE.Mesh(mergeNormalized([mistOuter, mistMid, mistInner]), mistMat);
  mistMesh.name = 'FansipanSummitCloudMist';
  group.add(mistMesh);

  addIncenseSmoke(ctx, flagUniforms, group, smokeSources, 'FansipanIncenseSmoke');
  ctx.scene.add(group);
}

/**
 * 4. Chùa Hương — Suối Yến, Cầu Hội, Chùa Thiên Trù (Tam Quan + Điện Tam Bảo + Bảo Tháp Viên Công)
 *    & Expanded 24m Động Hương Tích Grotto.
 */
function buildChuaHuongAndSuoiYen(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  ctx.exclusionCircles.push(
    { x: 215, z: -188, r: 28.0 },
    { x: 234, z: -176, r: 17.0 },
    { x: 224, z: -166, r: 7.5 },
    { x: 226, z: -206, r: 20.0 },
    { x: 204, z: -170, r: 9.0 },
    { x: 182, z: -152, r: 9.0 },
    { x: 186, z: -135, r: 11.0 }
  );

  const group = new THREE.Group();
  group.name = 'ChuaHuongComplex';

  const stoneParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const mossyRockParts: THREE.BufferGeometry[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const apricotBlossomParts: THREE.BufferGeometry[] = [];
  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  const lilyPadMat = new THREE.MeshStandardMaterial({
    color: '#2e6e36',
    roughness: 0.58,
    metalness: 0.04,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(lilyPadMat);

  const lilyFlowerMat = new THREE.MeshStandardMaterial({
    color: '#d93c8f',
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(lilyFlowerMat);

  const mossyKarstMat = new THREE.MeshStandardMaterial({
    color: '#4c6548',
    map: ctx.pbr.stone.map,
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.82,
    metalness: 0.04
  });
  ctx.extraMaterials.push(mossyKarstMat);

  const apricotMat = new THREE.MeshStandardMaterial({
    color: '#f8f4f0',
    roughness: 0.62,
    metalness: 0.02
  });
  ctx.extraMaterials.push(apricotMat);

  // 1. Winding emerald Suối Yến boat dock at (184, -152)
  const pierX = 184.0;
  const pierZ = -152.0;
  woodParts.push(makeBox(9.5, 0.28, 4.8, pierX, 0.31, pierZ));
  stoneParts.push(makeBox(9.8, 0.34, 5.1, pierX, 0.08, pierZ));
  for (const px of [180.0, 182.6, 185.4, 188.0]) {
    for (const pz of [pierZ - 2.1, pierZ + 2.1]) {
      woodParts.push(makeCylinder(0.16, 0.20, 2.75, 8, px, -0.45, pz));
      woodParts.push(makeCylinder(0.18, 0.18, 0.72, 8, px, 0.75, pz));
    }
  }
  for (let s = 0; s < 6; s++) {
    const sx = 179.0 - s * 0.85;
    const gy = ctx.getHeight(sx, pierZ);
    const sy = Math.max(0.45, gy + 0.25);
    stoneParts.push(makeBox(1.0, sy + 1.8, 4.4, sx, (sy - 1.8) * 0.5, pierZ));
  }

  // 1b. Cầu Hội — Vermilion & Stone Arched Footbridge crossing Suối Yến at (186, -135)
  const bridgeX = 186.0;
  const bridgeZ = -135.0;
  const bridgeSpan = 20.0;
  const bridgeSegs = 14;
  for (let i = 0; i < bridgeSegs; i++) {
    const t0 = i / bridgeSegs;
    const t1 = (i + 1) / bridgeSegs;
    const tm = (t0 + t1) * 0.5;
    const bx = bridgeX + (tm - 0.5) * bridgeSpan;
    const archY = 0.75 + Math.sin(tm * Math.PI) * 2.55;
    const slope = Math.atan2(Math.cos(tm * Math.PI) * 2.55 * Math.PI, bridgeSpan);
    const segLen = bridgeSpan / bridgeSegs + 0.22;

    const deck = makeBox(segLen, 0.36, 3.6, 0, 0, 0);
    deck.rotateZ(slope);
    deck.translate(bx, archY, bridgeZ);
    stoneParts.push(deck);

    // Vermilion arched timber side parapet rails & balusters
    for (const side of [-1, 1]) {
      const rail = makeBox(segLen + 0.08, 0.14, 0.16, 0, 0, 0);
      rail.rotateZ(slope);
      rail.translate(bx, archY + 1.02, bridgeZ + side * 1.65);
      crimsonParts.push(rail);

      const midRail = makeBox(segLen + 0.08, 0.10, 0.12, 0, 0, 0);
      midRail.rotateZ(slope);
      midRail.translate(bx, archY + 0.54, bridgeZ + side * 1.65);
      crimsonParts.push(midRail);

      crimsonParts.push(makeBox(0.14, 1.05, 0.14, bx, archY + 0.52, bridgeZ + side * 1.65));
    }
  }
  // Arched stone abutment piers anchored deep into East & West banks + glowing bridge lanterns
  for (const side of [-1, 1]) {
    const ax = bridgeX + side * (bridgeSpan * 0.5 + 0.6);
    const agy = ctx.getHeight(ax, bridgeZ);
    const ah = Math.max(2.6, 0.85 - (agy - 2.4));
    stoneParts.push(makeBox(2.4, ah, 4.4, ax, agy - 2.4 + ah * 0.5, bridgeZ));
    // Bank approach stone steps
    for (let st = 0; st < 4; st++) {
      const sx = ax + side * (1.4 + st * 0.75);
      const sy = Math.max(ctx.getHeight(sx, bridgeZ) + 0.12, 0.75 - st * 0.18);
      stoneParts.push(makeBox(0.85, sy + 2.0, 3.8, sx, (sy - 2.0) * 0.5, bridgeZ));
    }
    for (const zSide of [-1, 1]) {
      const px = bridgeX + side * (bridgeSpan * 0.44);
      const pz = bridgeZ + zSide * 1.68;
      crimsonParts.push(makeCylinder(0.12, 0.14, 2.35, 8, px, 2.35, pz));
      lanternParts.push(createRibbedLanternShellGeometry(0.20, 0.30, 8, 6).translate(px, 3.55, pz));
      lanternCoreParts.push(createLanternCoreGeometry(0.12, 0.19).translate(px, 3.55, pz));
    }
  }

  // 2. 10 Animated *Thuyền nan* Sampans bobbing along Suối Yến via ctx.junkBoats
  //    with colorful parasols & conical-hat (*nón lá*) passenger silhouettes
  const parasolPalette = ['#d62c2c', '#e6a825', '#2a8c6c', '#d85595'];
  const parasolMats = parasolPalette.map((hex) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, side: THREE.DoubleSide });
    ctx.extraMaterials.push(m);
    return m;
  });
  const nonLaMat = new THREE.MeshStandardMaterial({ color: '#e6d39c', roughness: 0.75, side: THREE.DoubleSide });
  ctx.extraMaterials.push(nonLaMat);
  const pilgrimRobeMat = new THREE.MeshStandardMaterial({ color: '#3b4a62', roughness: 0.8 });
  ctx.extraMaterials.push(pilgrimRobeMat);

  const sampanZs = [-209.0, -201.0, -193.0, -185.0, -177.0, -169.0, -161.0, -153.5, -146.0, -140.5];
  for (let idx = 0; idx < sampanZs.length; idx++) {
    const sz = sampanZs[idx];
    const riverCx = 186.0 + 5.5 * Math.sin((sz + 180.0) * 0.045);
    const offset = idx % 2 === 0 ? -1.05 : 1.05;
    const sx = THREE.MathUtils.clamp(riverCx + offset, 180.4, 191.6);
    const dxdz = 5.5 * 0.045 * Math.cos((sz + 180.0) * 0.045);
    const yaw = Math.atan2(dxdz, 1.0) + (idx % 2 === 0 ? 0.07 : -0.07);

    const boatGroup = new THREE.Group();
    boatGroup.name = `SuoiYenSampan_${idx + 1}`;
    boatGroup.position.set(sx, 0.04, sz);
    boatGroup.rotation.y = yaw;

    const bWood: THREE.BufferGeometry[] = [];
    const bLantern: THREE.BufferGeometry[] = [];
    const bCore: THREE.BufferGeometry[] = [];
    const bRobe: THREE.BufferGeometry[] = [];
    const bHat: THREE.BufferGeometry[] = [];

    const hullCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.48, -3.75),
      new THREE.Vector3(0, 0.08, -2.1),
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0, 0.08, 2.1),
      new THREE.Vector3(0, 0.52, 3.75)
    ]);
    const hullTube = new THREE.TubeGeometry(hullCurve, 16, 0.72, 9, false);
    hullTube.scale(1.0, 0.48, 1.0);
    bWood.push(hullTube);

    for (const tz of [-1.8, -0.5, 0.8, 2.0]) {
      bWood.push(makeBox(1.16, 0.08, 0.34, 0, 0.28, tz));
    }
    if (idx % 2 === 0) {
      const canopy = new THREE.CylinderGeometry(0.72, 0.72, 2.45, 10, 1, true, -Math.PI * 0.5, Math.PI);
      canopy.rotateZ(Math.PI * 0.5);
      canopy.rotateY(Math.PI * 0.5);
      canopy.translate(0, 0.42, -0.45);
      bWood.push(canopy);
    }
    for (const side of [-1, 1]) {
      const oar = makeCylinder(0.032, 0.042, 3.4, 6, 0, 0, 0);
      oar.rotateX(Math.PI * 0.49);
      oar.rotateY(side * 0.06);
      oar.translate(side * 0.54, 0.24, 0.15);
      bWood.push(oar);
    }

    // Conical-hat (*nón lá*) boat rower & 2 pilgrims seated inside sampan
    for (const [px, pz, pyOff] of [
      [0, -2.05, 0.34],
      [-0.22, 0.65, 0.28],
      [0.24, 1.45, 0.28]
    ]) {
      bRobe.push(makeCylinder(0.14, 0.20, 0.62, 7, px, pyOff + 0.31, pz));
      bRobe.push(new THREE.SphereGeometry(0.12, 7, 5).translate(px, pyOff + 0.72, pz));
      bHat.push(new THREE.ConeGeometry(0.32, 0.22, 10).translate(px, pyOff + 0.86, pz));
    }

    // Bow silk lantern
    bLantern.push(createRibbedLanternShellGeometry(0.15, 0.34, 8, 6).translate(0, 0.64, 3.15));
    bWood.push(createLanternCapGeometry(0.15, 0.34).translate(0, 0.64, 3.15));
    bCore.push(createLanternCoreGeometry(0.15, 0.34).translate(0, 0.64, 3.15));

    // Colorful open pilgrim parasol on deck
    const paraZ = idx % 2 === 0 ? 1.35 : -0.15;
    bWood.push(makeCylinder(0.024, 0.028, 1.45, 6, 0.12, 0.98, paraZ));
    const paraCone = new THREE.ConeGeometry(0.78, 0.32, 10, 1, true);
    paraCone.translate(0.12, 1.65, paraZ);
    const paraMesh = new THREE.Mesh(paraCone, parasolMats[idx % parasolMats.length]);
    paraMesh.castShadow = true;
    boatGroup.add(paraMesh);

    addMergedMesh(boatGroup, bWood, ctx.materials.darkWood, `SuoiYenSampanHull_${idx + 1}`);
    addMergedMesh(boatGroup, bRobe, pilgrimRobeMat, `SuoiYenSampanPilgrims_${idx + 1}`);
    addMergedMesh(boatGroup, bHat, nonLaMat, `SuoiYenSampanNonLa_${idx + 1}`);
    addMergedMesh(boatGroup, bLantern, ctx.materials.lanternSilk, `SuoiYenSampanLantern_${idx + 1}`, false, false);
    addMergedMesh(
      boatGroup,
      bCore,
      ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
      `SuoiYenSampanCore_${idx + 1}`,
      false,
      false
    );

    group.add(boatGroup);
    ctx.junkBoats.push({
      group: boatGroup,
      centerX: sx,
      centerZ: sz,
      radiusX: 0.42,
      radiusZ: 1.55,
      speed: 0.24 + (idx % 3) * 0.06,
      phase: idx * 0.95
    });
  }

  // 3. True-Scale 14m-Tall Multi-Tier Thiên Trù *Tam Quan* Gate & Bell Tower at (214, -184)
  const gateX = 214.0;
  const gateZ = -184.0;
  const gateY = ctx.getHeight(gateX, gateZ);
  const gateRotY = Math.atan2(214 - 226, -184 - -202); // ≈ -0.588 rad

  const gStone: THREE.BufferGeometry[] = [];
  const gCrimson: THREE.BufferGeometry[] = [];
  const gWood: THREE.BufferGeometry[] = [];
  const gRoof: THREE.BufferGeometry[] = [];
  const gGold: THREE.BufferGeometry[] = [];
  const gBronze: THREE.BufferGeometry[] = [];
  const gLantern: THREE.BufferGeometry[] = [];
  const gLanternCore: THREE.BufferGeometry[] = [];

  gStone.push(makeBox(17.4, 5.7, 6.8, 0, -1.65, 0));
  const chuaSteps = 22;
  const sinG = Math.sin(gateRotY);
  const cosG = Math.cos(gateRotY);
  for (let s = 0; s < chuaSteps; s++) {
    const t = s / (chuaSteps - 1);
    const lz = THREE.MathUtils.lerp(3.85, 22.6, t);
    const wx = gateX + lz * sinG;
    const wz = gateZ + lz * cosG;
    const perpX = cosG * 3.8;
    const perpZ = -sinG * 3.8;
    const groundMax = Math.max(
      ctx.getHeight(wx, wz),
      ctx.getHeight(wx + perpX, wz + perpZ),
      ctx.getHeight(wx - perpX, wz - perpZ)
    );
    const groundMin = Math.min(
      ctx.getHeight(wx, wz),
      ctx.getHeight(wx + perpX, wz + perpZ),
      ctx.getHeight(wx - perpX, wz - perpZ)
    );
    const topWorldY = Math.max(groundMax + 0.55, THREE.MathUtils.lerp(gateY + 1.0, 0.45, t));
    const botWorldY = groundMin - 2.5;
    const h = Math.max(1.2, topWorldY - botWorldY);
    const localCenterY = botWorldY + h * 0.5 - gateY;
    gStone.push(makeBox(8.4, h, 1.15, 0, localCenterY, lz));
  }
  for (let s = 0; s < 4; s++) {
    gStone.push(makeBox(7.2, 2.5, 0.90, 0, -0.2 - s * 0.30, -3.75 - s * 0.78));
  }

  const pDeckY = 1.20;
  for (const px of [-6.8, -2.9, 2.9, 6.8]) {
    const colH = Math.abs(px) < 3.5 ? 6.0 : 4.4;
    for (const pz of [-2.0, 2.0]) {
      gCrimson.push(makeCylinder(0.22, 0.26, colH, 10, px, pDeckY + colH * 0.5, pz));
      gStone.push(makeCylinder(0.36, 0.42, 0.32, 10, px, pDeckY + 0.16, pz));
    }
  }
  gCrimson.push(makeBox(14.4, 0.52, 4.6, 0, pDeckY + 4.35, 0));
  gWood.push(makeBox(5.6, 0.45, 3.8, 0, pDeckY + 5.85, 0));

  for (const sx of [-4.85, 4.85]) {
    const sideRoof = createVietnameseCurvedRoofGeometry(5.2, 6.4, 2.4, 2.2, 1.85, 0.38);
    sideRoof.translate(sx, pDeckY + 4.52, 0);
    gRoof.push(sideRoof);
  }
  const midRoof = createVietnameseCurvedRoofGeometry(8.8, 7.2, 5.4, 4.2, 2.05, 0.42);
  midRoof.translate(0, pDeckY + 6.0, 0);
  gRoof.push(midRoof);

  const bellY = pDeckY + 7.45;
  const bellH = 2.85;
  for (const bx of [-1.95, 1.95]) {
    for (const bz of [-1.55, 1.55]) {
      gCrimson.push(makeCylinder(0.17, 0.19, bellH, 10, bx, bellY + bellH * 0.5, bz));
    }
  }
  gCrimson.push(makeBox(4.3, 0.36, 3.5, 0, bellY + bellH - 0.1, 0));
  // Detailed Đại Hồng Chung bell inside upper pavilion
  gBronze.push(...createBronzeBellParts(0, bellY + 0.85, 0, 1.15));

  const topRoof = createVietnameseCurvedRoofGeometry(6.8, 5.8, 2.2, 0.55, 2.45, 0.48);
  topRoof.translate(0, bellY + bellH, 0);
  gRoof.push(topRoof);
  const tqFinials = createRoofFinialSetParts(0, bellY + bellH + 2.45, 0, 2.4, 0, 0.72, false);
  gCrimson.push(...tqFinials.mainParts);
  gGold.push(...tqFinials.goldParts);

  for (const [lx, ly, lz, lr, lh] of [
    [0, pDeckY + 4.85, 2.15, 0.25, 0.58],
    [-4.85, pDeckY + 3.65, 2.15, 0.19, 0.46],
    [4.85, pDeckY + 3.65, 2.15, 0.19, 0.46]
  ]) {
    gLantern.push(createRibbedLanternShellGeometry(lr, lh, 12, 8).translate(lx, ly, lz));
    gWood.push(createLanternCapGeometry(lr, lh).translate(lx, ly, lz));
    gLanternCore.push(createLanternCoreGeometry(lr, lh).translate(lx, ly, lz));
  }

  const applyGateTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(gateRotY);
      g.translate(gateX, gateY, gateZ);
      dst.push(g);
    }
  };
  applyGateTransform(gStone, stoneParts);
  applyGateTransform(gCrimson, crimsonParts);
  applyGateTransform(gWood, woodParts);
  applyGateTransform(gRoof, roofParts);
  applyGateTransform(gGold, goldParts);
  applyGateTransform(gBronze, bronzeParts);
  applyGateTransform(gLantern, lanternParts);
  applyGateTransform(gLanternCore, lanternCoreParts);

  // Readable "CHÙA THIÊN TRÙ" plaque on Tam Quan Gate
  const tqPlaquePos = new THREE.Vector3(0, pDeckY + 5.32, 2.32)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), gateRotY)
    .add(new THREE.Vector3(gateX, gateY, gateZ));
  const tqPlaque = createSignagePlaqueMesh(
    { text: 'CHÙA THIÊN TRÙ', subText: '天 廚 寺', style: 'royal', width: 2.9, height: 0.78, depth: 0.16 },
    ctx
  );
  tqPlaque.name = 'ThienTruTamQuanPlaque';
  tqPlaque.position.copy(tqPlaquePos);
  tqPlaque.rotation.y = gateRotY;
  group.add(tqPlaque);

  // 3b. Điện Tam Bảo (Chùa Thiên Trù Main Hall 20m x 13m x 12.5m) + Bảo Tháp Viên Công brick stupa
  const tbX = 234.0;
  const tbZ = -176.0;
  const tbY = ctx.getHeight(tbX, tbZ);
  const tbRotY = -Math.PI * 0.45; // facing SW-W toward Tam Quan & Suối Yến

  const tbStone: THREE.BufferGeometry[] = [];
  const tbCrimson: THREE.BufferGeometry[] = [];
  const tbWood: THREE.BufferGeometry[] = [];
  const tbRoof: THREE.BufferGeometry[] = [];
  const tbGold: THREE.BufferGeometry[] = [];
  const tbBronze: THREE.BufferGeometry[] = [];
  const tbLantern: THREE.BufferGeometry[] = [];
  const tbCore: THREE.BufferGeometry[] = [];

  // Broad skirted stone temple dais (21.6m x 14.6m, top local y = 1.45m)
  const tbFloorY = 1.45;
  tbStone.push(makeBox(21.6, tbFloorY + 5.5, 14.6, 0, -5.5 + (tbFloorY + 5.5) * 0.5, 0));
  // Front 5-step ceremonial stairs
  for (let s = 0; s < 5; s++) {
    tbStone.push(makeBox(5.8, 1.8, 0.72, 0, -0.15 + s * 0.28, 7.65 - s * 0.52));
  }
  tbStone.push(
    ...createPiercedBalustradeParts(-10.4, 7.0, -3.1, 7.0, tbFloorY, 0.88, 'lotus_stone'),
    ...createPiercedBalustradeParts(3.1, 7.0, 10.4, 7.0, tbFloorY, 0.88, 'lotus_stone'),
    ...createPiercedBalustradeParts(-10.4, -7.0, -10.4, 7.0, tbFloorY, 0.88, 'lotus_stone'),
    ...createPiercedBalustradeParts(10.4, -7.0, 10.4, 7.0, tbFloorY, 0.88, 'lotus_stone')
  );

  // 5-bay 20m x 13m crimson columned hall (lowerH = 4.4m) with open front *cửa bức bàn* doors
  const tbH = 4.4;
  for (const colX of [-8.8, -5.2, -1.8, 1.8, 5.2, 8.8]) {
    for (const colZ of [-5.2, 5.2]) {
      tbCrimson.push(makeCylinder(0.22, 0.26, tbH, 10, colX, tbFloorY + tbH * 0.5, colZ));
      tbStone.push(makeCylinder(0.36, 0.42, 0.30, 10, colX, tbFloorY + 0.15, colZ));
    }
  }
  tbWood.push(makeBox(0.32, tbH * 0.88, 10.0, -8.5, tbFloorY + tbH * 0.44, 0));
  tbWood.push(makeBox(0.32, tbH * 0.88, 10.0, 8.5, tbFloorY + tbH * 0.44, 0));
  tbWood.push(makeBox(17.4, tbH * 0.88, 0.34, 0, tbFloorY + tbH * 0.44, -4.9));
  for (const side of [-1, 1]) {
    tbWood.push(makeBox(5.2, tbH * 0.86, 0.24, side * 5.8, tbFloorY + tbH * 0.43, 4.75));
    // Swinging open *cửa bức bàn* sanctuary doors
    tbWood.push(makeBox(1.45, tbH * 0.78, 0.14, side * 2.55, tbFloorY + tbH * 0.39, 5.25, side * -0.58));
    // Eave lanterns
    tbLantern.push(createRibbedLanternShellGeometry(0.24, 0.36, 10, 6).translate(side * 4.2, tbFloorY + tbH - 0.52, 5.45));
    tbCore.push(createLanternCoreGeometry(0.14, 0.22).translate(side * 4.2, tbFloorY + tbH - 0.52, 5.45));
  }
  // Interior Three-Jewels golden Buddhist altar
  tbCrimson.push(makeBox(6.8, 1.25, 1.65, 0, tbFloorY + 0.625, -2.8));
  tbGold.push(makeBox(7.0, 0.18, 1.82, 0, tbFloorY + 1.28, -2.8));
  tbGold.push(makeBox(18.6, 0.32, 10.8, 0, tbFloorY + tbH - 0.08, 0));

  // Double-tier curved dark roof reaching ~12.5m total height
  const tbRoof1 = createVietnameseCurvedRoofGeometry(21.4, 14.2, 14.8, 7.6, 2.65, 0.46);
  tbRoof1.translate(0, tbFloorY + tbH + 0.02, 0);
  tbRoof.push(tbRoof1);

  const tbUpY = tbFloorY + tbH + 1.85;
  const tbUpH = 1.95;
  tbCrimson.push(makeBox(13.6, tbUpH, 6.2, 0, tbUpY + tbUpH * 0.5, 0));
  tbGold.push(makeBox(14.2, 0.24, 6.8, 0, tbUpY + tbUpH - 0.05, 0));

  const tbRoof2 = createVietnameseCurvedRoofGeometry(16.6, 9.8, 8.2, 0.65, 2.85, 0.52);
  tbRoof2.translate(0, tbUpY + tbUpH + 0.02, 0);
  tbRoof.push(tbRoof2);

  const tbFinials = createRoofFinialSetParts(0, tbUpY + tbUpH + 2.84, 0, 8.2, 0, 1.05, true);
  tbCrimson.push(...tbFinials.mainParts);
  tbGold.push(...tbFinials.goldParts);

  // Courtyard bronze censer in front of Điện Tam Bảo + GPU incense smoke
  const tbCenserLocal = new THREE.Vector3(0, tbFloorY, 9.2);
  const tbCenser = createBronzeIncenseTripodParts(tbCenserLocal.x, tbCenserLocal.y, tbCenserLocal.z, 1.25);
  tbStone.push(...tbCenser.limestoneParts);
  tbBronze.push(...tbCenser.bronzeParts);
  tbGold.push(...tbCenser.goldParts);
  const tbSmokePos = new THREE.Vector3(tbCenserLocal.x, tbCenser.smokeY, tbCenserLocal.z)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), tbRotY)
    .add(new THREE.Vector3(tbX, tbY, tbZ));
  smokeSources.push({ x: tbSmokePos.x, y: tbSmokePos.y, z: tbSmokePos.z, scale: 1.15 });

  const applyTb = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(tbRotY);
      g.translate(tbX, tbY, tbZ);
      dst.push(g);
    }
  };
  applyTb(tbStone, stoneParts);
  applyTb(tbCrimson, crimsonParts);
  applyTb(tbWood, woodParts);
  applyTb(tbRoof, roofParts);
  applyTb(tbGold, goldParts);
  applyTb(tbBronze, bronzeParts);
  applyTb(tbLantern, lanternParts);
  applyTb(tbCore, lanternCoreParts);

  const tbPlaquePos = new THREE.Vector3(0, tbFloorY + 3.85, 5.45)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), tbRotY)
    .add(new THREE.Vector3(tbX, tbY, tbZ));
  const tbPlaque = createSignagePlaqueMesh(
    { text: 'ĐIỆN TAM BẢO', subText: 'THIÊN TRÙ — HƯƠNG SƠN', style: 'royal', width: 3.4, height: 0.92, depth: 0.16 },
    ctx
  );
  tbPlaque.name = 'ThienTruTamBaoPlaque';
  tbPlaque.position.copy(tbPlaquePos);
  tbPlaque.rotation.y = tbRotY;
  group.add(tbPlaque);

  // Bảo Tháp Viên Công (17th-century carved terracotta brick stupa beside Điện Tam Bảo)
  const vcX = 224.0;
  const vcZ = -166.0;
  const vcY = ctx.getHeight(vcX, vcZ);
  stoneParts.push(makeBox(4.4, 3.8, 4.4, vcX, vcY - 1.2, vcZ));
  let vcCurY = vcY + 0.7;
  for (let tier = 0; tier < 5; tier++) {
    const tw = THREE.MathUtils.lerp(2.85, 1.35, tier / 4);
    const th = THREE.MathUtils.lerp(1.75, 1.15, tier / 4);
    brickParts.push(makeBox(tw, th * 0.72, tw, vcX, vcCurY + th * 0.36, vcZ));
    const eave = createVietnameseCurvedRoofGeometry(tw * 1.36, tw * 1.36, tw * 0.92, tw * 0.92, th * 0.42, 0.18);
    eave.translate(vcX, vcCurY + th * 0.70, vcZ);
    brickParts.push(eave);
    vcCurY += th;
  }
  goldParts.push(...createLotusFinialParts(vcX, vcCurY, vcZ, 1.25));

  // 4. EXPANDED Động Hương Tích (24m deep cavernous limestone grotto at (226, -202))
  const caveX = 226.0;
  const caveZ = -202.0;
  const caveY = ctx.getHeight(caveX, caveZ);
  const caveRotY = gateRotY;

  const cStone: THREE.BufferGeometry[] = [];
  const cMossy: THREE.BufferGeometry[] = [];
  const cVoid: THREE.BufferGeometry[] = [];
  const cLantern: THREE.BufferGeometry[] = [];
  const cLanternCore: THREE.BufferGeometry[] = [];
  const cGold: THREE.BufferGeometry[] = [];
  const cBronze: THREE.BufferGeometry[] = [];
  const cCrimson: THREE.BufferGeometry[] = [];

  // Towering 26m-wide x 18m-high mouth + 24m deep cavernous limestone rock chamber (local z from +2 to -24)
  cStone.push(
    createSculptedRockGeometry(511, 6.6, 10.2, 6.8, 3).translate(-8.6, 7.2, 0.0),
    createSculptedRockGeometry(512, 6.8, 10.4, 6.8, 3).translate(8.8, 7.4, 0.0),
    createSculptedRockGeometry(513, 13.5, 5.2, 7.2, 3).translate(0, 15.2, -0.8)
  );
  // Deep vaulted side & ceiling cavern rock ribs stretching 24m back into the mountain
  for (let seg = 1; seg <= 3; seg++) {
    const zOff = -seg * 6.8;
    const wShrink = 1.0 - seg * 0.08;
    cStone.push(
      createSculptedRockGeometry(520 + seg * 3, 5.2, 9.5, 5.8, 2).translate(-9.2 * wShrink, 6.4, zOff),
      createSculptedRockGeometry(521 + seg * 3, 5.2, 9.5, 5.8, 2).translate(9.2 * wShrink, 6.4, zOff),
      createSculptedRockGeometry(522 + seg * 3, 12.2 * wShrink, 4.4, 6.2, 2).translate(0, 13.8 - seg * 0.7, zOff)
    );
  }
  cStone.push(createSculptedRockGeometry(540, 13.0, 11.2, 6.5, 3).translate(0, 6.8, -23.5));
  // Cavern floor extending deeply to z = -22m
  cStone.push(makeBox(16.5, 2.4, 24.0, 0, -0.95, -10.5));
  cVoid.push(makeBox(12.8, 10.2, 0.45, 0, 5.4, -21.8));

  // Sculpted organic stalactites hanging from the cavern arch & vaulted ceiling
  const stalSpecs = [
    [-4.2, 12.4, 1.4, 0.72, 3.2],
    [-1.8, 13.0, 1.6, 0.62, 3.6],
    [1.9, 12.8, 1.5, 0.68, 3.3],
    [4.4, 12.1, 1.3, 0.75, 2.9],
    [-5.2, 11.8, -5.8, 0.82, 3.8],
    [5.4, 11.6, -6.2, 0.78, 3.5],
    [-3.6, 10.8, -12.4, 0.85, 3.9],
    [3.8, 10.6, -13.0, 0.80, 3.6],
    [0.2, 11.2, -16.5, 0.92, 4.1]
  ];
  for (let i = 0; i < stalSpecs.length; i++) {
    const [sx, sy, sz, sr, sh] = stalSpecs[i];
    const stal = createSculptedRockGeometry(550 + i * 7, sr, sh * 0.55, sr, 2);
    stal.translate(sx, sy - sh * 0.45, sz);
    (i % 2 === 0 ? cMossy : cStone).push(stal);
  }

  // Prominent Mossy *Đụn Gạo* (Sacred Rice Mound) stalagmite at heart of grotto + *Cây Vàng / Cây Bạc*
  cMossy.push(createSculptedRockGeometry(571, 2.4, 3.8, 2.3, 3).translate(0, 2.4, -5.8));
  cMossy.push(createSculptedRockGeometry(572, 1.4, 3.2, 1.3, 2).translate(-5.4, 1.9, -9.2));
  cStone.push(createSculptedRockGeometry(573, 1.3, 2.9, 1.3, 2).translate(5.4, 1.8, -9.6));

  // Pilgrim stone stairs descending into the cavern sanctuary
  for (let s = 0; s < 10; s++) {
    cStone.push(makeBox(8.8, 1.4, 1.15, 0, -0.25 + (s < 5 ? s * 0.14 : (9 - s) * 0.12), 5.6 - s * 0.95));
  }

  // Sculpted Green-Stone Quan Âm Bodhisattva via createSculptedDeityParts inside cavern
  const quanAm = createSculptedDeityParts(0, 0.85, -13.2, 0, 1.65, 'quanam');
  cMossy.push(...quanAm.bodyParts);
  cGold.push(...quanAm.accentParts);

  // Sacred Altar with offerings (fruit/oản pyramids, red votive candles, flower vases) & Bronze Tripod Censer
  cCrimson.push(makeBox(4.2, 1.18, 1.35, 0, 0.85, -10.2));
  cGold.push(makeBox(4.45, 0.16, 1.48, 0, 1.46, -10.2));
  // Offerings atop altar: golden *oản* ritual cakes, red candles & vases
  for (const side of [-1, 1]) {
    cGold.push(makeCylinder(0.18, 0.26, 0.42, 8, side * 1.35, 1.74, -10.2));
    cCrimson.push(makeCylinder(0.06, 0.07, 0.52, 6, side * 0.85, 1.78, -9.95));
    cLanternCore.push(new THREE.SphereGeometry(0.08, 6, 5).translate(side * 0.85, 2.08, -9.95));
  }
  const caveCenser = createBronzeIncenseTripodParts(0, 0.25, -8.2, 1.15);
  cStone.push(...caveCenser.limestoneParts);
  cBronze.push(...caveCenser.bronzeParts);
  cGold.push(...caveCenser.goldParts);
  const caveSmokeWorld = new THREE.Vector3(0, caveCenser.smokeY, -8.2)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  smokeSources.push({ x: caveSmokeWorld.x, y: caveSmokeWorld.y, z: caveSmokeWorld.z, scale: 1.15 });

  // Warm interior shrine PointLight illuminating the 24m cavern & Quan Âm statue
  const caveLightPos = new THREE.Vector3(0, 4.6, -10.2)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  const caveLight = new THREE.PointLight('#ffbd62', 2.6, 28, 1.4);
  caveLight.position.copy(caveLightPos);
  group.add(caveLight);

  // Readable Golden "NAM THIÊN ĐỆ NHẤT ĐỘNG" Plaque over the limestone cave brow
  const browPlaquePos = new THREE.Vector3(0, 12.8, 2.85)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  const browPlaque = createSignagePlaqueMesh(
    {
      text: 'NAM THIÊN ĐỆ NHẤT ĐỘNG',
      subText: '南 天 第 一 洞',
      style: 'bronze',
      textColor: '#ffe074',
      borderColor: '#f5c84c',
      width: 6.4,
      height: 1.35,
      depth: 0.22
    },
    ctx
  );
  browPlaque.name = 'NamThienDeNhatDongPlaque';
  browPlaque.position.copy(browPlaquePos);
  browPlaque.rotation.y = caveRotY;
  group.add(browPlaque);

  for (const [lx, ly, lz, lr, lh] of [
    [0, 3.2, -9.2, 0.36, 0.78],
    [-3.6, 5.2, 1.6, 0.26, 0.58],
    [3.6, 5.2, 1.6, 0.26, 0.58],
    [-2.4, 7.6, -4.5, 0.24, 0.52],
    [2.4, 7.6, -4.5, 0.24, 0.52],
    [-2.8, 5.6, -12.2, 0.24, 0.52],
    [2.8, 5.6, -12.2, 0.24, 0.52]
  ]) {
    cLantern.push(createRibbedLanternShellGeometry(lr, lh, 10, 6).translate(lx, ly, lz));
    cLanternCore.push(createLanternCoreGeometry(lr, lh).translate(lx, ly, lz));
  }

  const applyCaveTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(caveRotY);
      g.translate(caveX, caveY, caveZ);
      dst.push(g);
    }
  };
  applyCaveTransform(cStone, stoneParts);
  applyCaveTransform(cMossy, mossyRockParts);
  applyCaveTransform(cVoid, voidParts);
  applyCaveTransform(cLantern, lanternParts);
  applyCaveTransform(cLanternCore, lanternCoreParts);
  applyCaveTransform(cGold, goldParts);
  applyCaveTransform(cBronze, bronzeParts);
  applyCaveTransform(cCrimson, crimsonParts);

  // 5. White *Hoa Mơ* Apricot Blossom Trees flanking the pilgrim stairs between Tam Quan & Động Hương Tích
  const apricotPositions = [
    [206.5, -173.0],
    [216.0, -175.0],
    [209.5, -193.0],
    [223.5, -187.0],
    [217.5, -197.5],
    [231.0, -191.5]
  ];
  for (let i = 0; i < apricotPositions.length; i++) {
    const [ax, az] = apricotPositions[i];
    const ay = ctx.getHeight(ax, az);
    const trunkH = 3.2 + (i % 3) * 0.55;
    barkParts.push(makeCylinder(0.14, 0.24, trunkH, 7, ax, ay + trunkH * 0.5, az));
    for (let b = 0; b < 4; b++) {
      const ba = (b / 4) * Math.PI * 2 + i * 0.6;
      const bx = ax + Math.cos(ba) * 1.25;
      const bz = az + Math.sin(ba) * 1.25;
      const by = ay + trunkH + 0.55 + (b % 2) * 0.45;
      const limb = makeCylinder(0.06, 0.10, 1.5, 5, 0, 0, 0);
      limb.rotateZ(-0.85);
      limb.rotateY(ba);
      limb.translate(ax + Math.cos(ba) * 0.65, ay + trunkH - 0.15, az + Math.sin(ba) * 0.65);
      barkParts.push(limb);
      const puff = createSculptedRockGeometry(920 + i * 11 + b, 1.15, 0.78, 1.15, 1);
      puff.translate(bx, by, bz);
      apricotBlossomParts.push(puff);
    }
    const crown = createSculptedRockGeometry(990 + i, 1.45, 0.92, 1.45, 1);
    crown.translate(ax, ay + trunkH + 1.2, az);
    apricotBlossomParts.push(crown);
  }

  // 6. FIX Bug B5: 48 Green Notched Water Lily Pads + Multi-Petal Magenta/Pink Water Lilies along Suối Yến
  const lilyPadParts: THREE.BufferGeometry[] = [];
  const lilyFlowerParts: THREE.BufferGeometry[] = [];
  const randLily = mulberry32(195180);
  for (let i = 0; i < 48; i++) {
    const lz = -212.0 + randLily() * 75.0;
    const riverCx = 186.0 + 5.5 * Math.sin((lz + 180.0) * 0.045);
    const side = randLily() > 0.5 ? 1 : -1;
    const lx = riverCx + side * (3.6 + randLily() * 3.6);
    const padRot = randLily() * Math.PI * 2;
    const padScale = 0.85 + randLily() * 0.35;

    // Dedicated green notched lotus/lily pad (no longer pushed to woodParts!)
    const pad = createNotchedLotusPadGeometry(0.42 * padScale, 10);
    pad.rotateY(padRot);
    pad.translate(lx, 0.025, lz);
    lilyPadParts.push(pad);

    // Multi-petal blooming water lily (outer 6 splayed petals + inner 5 upright petals + golden center)
    const fScale = 0.85 + randLily() * 0.32;
    for (let p = 0; p < 6; p++) {
      const pa = padRot + (p / 6) * Math.PI * 2;
      const pet = new THREE.ConeGeometry(0.065 * fScale, 0.22 * fScale, 4);
      pet.scale(1.0, 1.0, 0.42);
      pet.rotateX(0.95);
      pet.rotateY(pa);
      pet.translate(lx + Math.sin(pa) * 0.10 * fScale, 0.10, lz + Math.cos(pa) * 0.10 * fScale);
      lilyFlowerParts.push(pet);
    }
    for (let p = 0; p < 5; p++) {
      const pa = padRot + 0.35 + (p / 5) * Math.PI * 2;
      const pet = new THREE.ConeGeometry(0.052 * fScale, 0.19 * fScale, 4);
      pet.scale(1.0, 1.0, 0.42);
      pet.rotateX(0.45);
      pet.rotateY(pa);
      pet.translate(lx + Math.sin(pa) * 0.05 * fScale, 0.14, lz + Math.cos(pa) * 0.05 * fScale);
      lilyFlowerParts.push(pet);
    }
    goldParts.push(new THREE.SphereGeometry(0.05 * fScale, 6, 5).translate(lx, 0.14, lz));
  }

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'ChuaHuongStoneAndKarst');
  addMergedMesh(group, mossyRockParts, mossyKarstMat, 'HuongTichMossyGrottoAndQuanAm');
  addMergedMesh(group, brickParts, ctx.materials.chamBrick, 'ThienTruVienCongBrickStupa');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'SuoiYenSampanBoats');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'ThienTruTamQuanPillars');
  addMergedMesh(group, roofParts, ctx.materials.darkRoof, 'ThienTruDarkRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'ChuaHuongGoldShrine');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'ChuaHuongBronzeBellAndUrn');
  addMergedMesh(group, barkParts, ctx.materials.bark, 'ChuaHuongApricotTrunks');
  addMergedMesh(group, apricotBlossomParts, apricotMat, 'ChuaHuongApricotBlossoms');
  addMergedMesh(group, lanternParts, ctx.materials.lanternSilk, 'HuongTichShrineLanterns', false, false);
  addMergedMesh(
    group,
    lanternCoreParts,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    'HuongTichShrineLanternCores',
    false,
    false
  );
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'HuongTichCaveMouthVoid', false, true);
  addMergedMesh(group, lilyPadParts, lilyPadMat, 'SuoiYenWaterLilyPads', false, true);
  addMergedMesh(group, lilyFlowerParts, lilyFlowerMat, 'SuoiYenWaterLilies', false, false);

  addIncenseSmoke(ctx, flagUniforms, group, smokeSources, 'ChuaHuongIncenseSmoke');
  ctx.scene.add(group);
}

/**
 * 5. Đền Hùng — Núi Nghĩa Lĩnh at (-195, -210).
 * Pilgrimage axis from Đền Giếng (-160, -175) -> Đền Trung on Landing 1 -> Nghi Môn Gate
 * -> Expanded 22x17m Đền Thượng courtyard & open-clerestory hall + Hùng Vương Lăng.
 */
function buildDenHung(
  ctx: VietnamBuilderContext,
  flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): void {
  const cx = -195;
  const cz = -210;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 22.0 },
    { x: -182, z: -197, r: 12.0 },
    { x: -174, z: -189, r: 14.0 },
    { x: -167, z: -182, r: 10.5 },
    { x: -160, z: -175, r: 13.0 }
  );

  const group = new THREE.Group();
  group.name = 'DenHungComplex';

  const jadeWaterMat = new THREE.MeshStandardMaterial({
    color: '#17826c',
    roughness: 0.14,
    metalness: 0.25
  });
  ctx.extraMaterials.push(jadeWaterMat);

  const stoneParts: THREE.BufferGeometry[] = [];
  const lateriteParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const jadeWaterParts: THREE.BufferGeometry[] = [];
  const smokeSources: Array<{ x: number; y: number; z: number; scale?: number }> = [];

  const facingRotY = Math.PI * 0.25;
  const dirSE = new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2);

  const getStairGroundSpan = (sx: number, sz: number, halfW: number) => {
    const perpX = Math.cos(facingRotY) * halfW;
    const perpZ = -Math.sin(facingRotY) * halfW;
    const hC = ctx.getHeight(sx, sz);
    const hL = ctx.getHeight(sx - perpX, sz - perpZ);
    const hR = ctx.getHeight(sx + perpX, sz + perpZ);
    return { maxH: Math.max(hC, hL, hR), minH: Math.min(hC, hL, hR) };
  };

  const getLandingSpan = (dCenter: number, length: number, width: number) => {
    let maxH = -Infinity;
    let minH = Infinity;
    for (let i = 0; i < 5; i++) {
      const d = THREE.MathUtils.lerp(dCenter - length * 0.5, dCenter + length * 0.5, i / 4);
      const sx = cx + dirSE.x * d;
      const sz = cz + dirSE.y * d;
      const span = getStairGroundSpan(sx, sz, width * 0.5);
      if (span.maxH > maxH) maxH = span.maxH;
      if (span.minH < minH) minH = span.minH;
    }
    return { maxH, minH };
  };

  const buildLanding = (dCenter: number, length: number, width: number, extraClearance = 1.45) => {
    const lx = cx + dirSE.x * dCenter;
    const lz = cz + dirSE.y * dCenter;
    const span = getLandingSpan(dCenter, length, width);
    const topY = span.maxH + extraClearance;
    const bot = span.minH - 4.5;
    const h = topY - bot;
    stoneParts.push(makeBox(width, h, length, lx, bot + h * 0.5, lz, facingRotY));
    return { x: lx, z: lz, topY };
  };

  const buildStairFlight = (
    dStart: number,
    dEnd: number,
    steps: number,
    yStartOverride?: number,
    yEndOverride?: number
  ) => {
    const halfW = 2.8;
    const pStart = new THREE.Vector2(cx + dirSE.x * dStart, cz + dirSE.y * dStart);
    const pEnd = new THREE.Vector2(cx + dirSE.x * dEnd, cz + dirSE.y * dEnd);

    const yTopStart = yStartOverride ?? getStairGroundSpan(pStart.x, pStart.y, halfW).maxH + 1.45;
    const yTopEnd = yEndOverride ?? getStairGroundSpan(pEnd.x, pEnd.y, halfW).maxH + 1.45;
    const flightLen = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const stepLen = flightLen / Math.max(1, steps - 1) + 0.55;

    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const sx = THREE.MathUtils.lerp(pStart.x, pEnd.x, t);
      const sz = THREE.MathUtils.lerp(pStart.y, pEnd.y, t);
      const span = getStairGroundSpan(sx, sz, halfW + 0.4);
      const sy = Math.max(span.maxH + 1.45, THREE.MathUtils.lerp(yTopStart, yTopEnd, t));
      const bot = span.minH - 4.5;
      const h = Math.max(1.5, sy - bot);

      stoneParts.push(makeBox(halfW * 2.0, h, stepLen, sx, bot + h * 0.5, sz, facingRotY));

      for (const side of [-1, 1]) {
        const ox = Math.cos(facingRotY) * (halfW + 0.25) * side;
        const oz = -Math.sin(facingRotY) * (halfW + 0.25) * side;
        lateriteParts.push(
          makeBox(0.50, h + 0.35, stepLen + 0.12, sx + ox, bot + (h + 0.35) * 0.5, sz + oz, facingRotY)
        );
      }
    }

    // Sculpted Lê-dynasty dragon balustrades flanking each flight (head at bottom pStart -> tail at top pEnd)
    for (const side of [-1, 1]) {
      const ox = Math.cos(facingRotY) * (halfW + 0.25) * side;
      const oz = -Math.sin(facingRotY) * (halfW + 0.25) * side;
      stoneParts.push(
        ...createCarvedDragonBalustradeParts(
          pStart.x + ox,
          yTopStart + 0.25,
          pStart.y + oz,
          pEnd.x + ox,
          yTopEnd + 0.25,
          pEnd.y + oz,
          1.05
        )
      );
    }
  };

  // 1. 3-Flight Pilgrimage Staircase + Mid-slope Landing 1 & Nghi Môn Landing 2
  const courtTop = 1.85;
  const landing1 = buildLanding(31.2, 6.2, 8.6, 1.45);
  const nghiLanding = buildLanding(19.2, 5.2, 8.6, 0.90);

  buildStairFlight(43.0, 34.2, 13, undefined, landing1.topY);
  buildStairFlight(28.2, 21.5, 10, landing1.topY, nghiLanding.topY);
  buildStairFlight(16.8, 9.8, 11, nghiLanding.topY, yBase + courtTop);

  // 1b. ADD Đền Trung Mid-Slope Pavilion on SW terrace off Landing 1
  const perpSW = new THREE.Vector3(-Math.SQRT1_2, 0, Math.SQRT1_2); // left/SW perpendicular to SE climb
  const dtX = landing1.x + perpSW.x * 8.2;
  const dtZ = landing1.z + perpSW.z * 8.2;
  const dtY = landing1.topY;
  ctx.exclusionCircles.push({ x: dtX, z: dtZ, r: 9.5 });

  const mStone: THREE.BufferGeometry[] = [];
  const mCrimson: THREE.BufferGeometry[] = [];
  const mWood: THREE.BufferGeometry[] = [];
  const mRoof: THREE.BufferGeometry[] = [];
  const mGold: THREE.BufferGeometry[] = [];
  const mBronze: THREE.BufferGeometry[] = [];
  const mLantern: THREE.BufferGeometry[] = [];
  const mCore: THREE.BufferGeometry[] = [];

  // Connecting terrace slab deeply skirted -5.5m into hillside
  mStone.push(makeBox(11.6, 6.5, 9.0, 0, -3.25, 0));
  mStone.push(makeBox(4.8, 4.5, 4.0, 5.8, -2.25, 0)); // walkway bridge to Landing 1
  const mFloorY = 0.55;
  mStone.push(makeBox(8.6, 0.55, 6.2, -0.5, 0.275, -0.4));
  const mH = 3.2;
  for (const px of [-3.6, -1.2, 1.2, 3.6]) {
    for (const pz of [-2.8, 2.0]) {
      mCrimson.push(makeCylinder(0.17, 0.20, mH, 10, px - 0.5, mFloorY + mH * 0.5, pz));
      mStone.push(makeCylinder(0.26, 0.30, 0.22, 8, px - 0.5, mFloorY + 0.11, pz));
    }
  }
  mWood.push(makeBox(7.2, mH * 0.86, 0.26, -0.5, mFloorY + mH * 0.43, -2.65));
  mWood.push(makeBox(0.26, mH * 0.86, 4.6, -4.0, mFloorY + mH * 0.43, -0.4));
  mWood.push(makeBox(0.26, mH * 0.86, 4.6, 3.0, mFloorY + mH * 0.43, -0.4));
  mCrimson.push(makeBox(2.8, 0.95, 1.0, -0.5, mFloorY + 0.475, -1.75));
  mGold.push(makeBox(3.0, 0.14, 1.12, -0.5, mFloorY + 0.98, -1.75));
  mLantern.push(
    createRibbedLanternShellGeometry(0.20, 0.30, 8, 6).translate(-2.3, mFloorY + mH - 0.46, 2.25),
    createRibbedLanternShellGeometry(0.20, 0.30, 8, 6).translate(1.3, mFloorY + mH - 0.46, 2.25)
  );
  mCore.push(
    createLanternCoreGeometry(0.12, 0.19).translate(-2.3, mFloorY + mH - 0.46, 2.25),
    createLanternCoreGeometry(0.12, 0.19).translate(1.3, mFloorY + mH - 0.46, 2.25)
  );
  const dtRoof1 = createVietnameseCurvedRoofGeometry(10.6, 7.6, 6.4, 3.2, 1.65, 0.38);
  dtRoof1.translate(-0.5, mFloorY + mH, -0.4);
  mRoof.push(dtRoof1);
  const dtRoof2 = createVietnameseCurvedRoofGeometry(7.6, 5.2, 3.4, 0.45, 1.85, 0.42);
  dtRoof2.translate(-0.5, mFloorY + mH + 1.45, -0.4);
  mRoof.push(dtRoof2);
  const dtFin = createRoofFinialSetParts(-0.5, mFloorY + mH + 3.30, -0.4, 3.4, 0, 0.72, false);
  mCrimson.push(...dtFin.mainParts);
  mGold.push(...dtFin.goldParts);

  const dtCenser = createBronzeIncenseTripodParts(-0.5, 0, 3.35, 0.85);
  mStone.push(...dtCenser.limestoneParts);
  mBronze.push(...dtCenser.bronzeParts);
  mGold.push(...dtCenser.goldParts);

  const applyMid = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(facingRotY);
      g.translate(dtX, dtY, dtZ);
      dst.push(g);
    }
  };
  applyMid(mStone, stoneParts);
  applyMid(mCrimson, crimsonParts);
  applyMid(mWood, woodParts);
  applyMid(mRoof, roofParts);
  applyMid(mGold, goldParts);
  applyMid(mBronze, bronzeParts);
  applyMid(mLantern, lanternParts);
  applyMid(mCore, lanternCoreParts);

  const dtPlaquePos = new THREE.Vector3(-0.5, mFloorY + 2.85, 2.22)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(dtX, dtY, dtZ));
  const dtPlaque = createSignagePlaqueMesh(
    { text: 'ĐỀN TRUNG', subText: 'HÙNG VƯƠNG TỔ MIẾU', style: 'royal', width: 2.6, height: 0.72, depth: 0.14 },
    ctx
  );
  dtPlaque.name = 'DenTrungPlaque';
  dtPlaque.position.copy(dtPlaquePos);
  dtPlaque.rotation.y = facingRotY;
  group.add(dtPlaque);

  // 1c. ADD Đền Giếng Curved-Roof Shrine & Round Emerald Jade Well (*Giếng Ngọc*) at (-160, -175)
  const dgX = -160.0;
  const dgZ = -175.0;
  const dgY = ctx.getHeight(dgX, dgZ);
  const dgRotY = facingRotY;
  const dgStone: THREE.BufferGeometry[] = [];
  const dgCrimson: THREE.BufferGeometry[] = [];
  const dgWood: THREE.BufferGeometry[] = [];
  const dgRoof: THREE.BufferGeometry[] = [];
  const dgGold: THREE.BufferGeometry[] = [];
  const dgBronze: THREE.BufferGeometry[] = [];
  const dgLantern: THREE.BufferGeometry[] = [];
  const dgCore: THREE.BufferGeometry[] = [];
  const dgWater: THREE.BufferGeometry[] = [];

  // Skirted foothill terrace (15.0m x 12.0m)
  dgStone.push(makeBox(15.0, 5.2, 12.0, 0, -2.0, 0));
  const dgFloorY = 0.60;
  dgStone.push(
    ...createPiercedBalustradeParts(-7.1, -5.6, 7.1, -5.6, dgFloorY, 0.85, 'lotus_stone'),
    ...createPiercedBalustradeParts(-7.1, -5.6, -7.1, 5.6, dgFloorY, 0.85, 'lotus_stone'),
    ...createPiercedBalustradeParts(7.1, -5.6, 7.1, 5.6, dgFloorY, 0.85, 'lotus_stone')
  );

  // Round Emerald Jade Well (*Giếng Ngọc*, r = 2.2m) on front-right side of courtyard
  const wellX = 3.2;
  const wellZ = 1.6;
  const wellCurb = new THREE.TorusGeometry(2.25, 0.34, 8, 22);
  wellCurb.rotateX(Math.PI * 0.5);
  wellCurb.translate(wellX, dgFloorY + 0.34, wellZ);
  dgStone.push(wellCurb);
  dgWater.push(makeCylinder(2.12, 2.12, 0.16, 22, wellX, dgFloorY + 0.26, wellZ));

  // Đền Giếng Curved-Roof Shrine beside the jade well
  const shX = -2.4;
  const shZ = -0.8;
  dgStone.push(makeBox(7.8, 0.52, 5.8, shX, dgFloorY + 0.26, shZ));
  const shBaseY = dgFloorY + 0.52;
  const shH = 3.1;
  for (const px of [-3.2, -1.1, 1.1, 3.2]) {
    for (const pz of [-2.2, 2.2]) {
      dgCrimson.push(makeCylinder(0.16, 0.19, shH, 10, shX + px, shBaseY + shH * 0.5, shZ + pz));
    }
  }
  dgWood.push(makeBox(6.4, shH * 0.85, 0.24, shX, shBaseY + shH * 0.42, shZ - 2.1));
  dgWood.push(makeBox(0.24, shH * 0.85, 4.2, shX - 3.1, shBaseY + shH * 0.42, shZ));
  dgWood.push(makeBox(0.24, shH * 0.85, 4.2, shX + 3.1, shBaseY + shH * 0.42, shZ));
  dgCrimson.push(makeBox(2.4, 0.88, 0.92, shX, shBaseY + 0.44, shZ - 1.25));
  dgGold.push(makeBox(2.55, 0.14, 1.04, shX, shBaseY + 0.92, shZ - 1.25));
  dgLantern.push(
    createRibbedLanternShellGeometry(0.20, 0.28, 8, 6).translate(shX - 1.8, shBaseY + shH - 0.44, shZ + 2.4),
    createRibbedLanternShellGeometry(0.20, 0.28, 8, 6).translate(shX + 1.8, shBaseY + shH - 0.44, shZ + 2.4)
  );
  dgCore.push(
    createLanternCoreGeometry(0.12, 0.18).translate(shX - 1.8, shBaseY + shH - 0.44, shZ + 2.4),
    createLanternCoreGeometry(0.12, 0.18).translate(shX + 1.8, shBaseY + shH - 0.44, shZ + 2.4)
  );
  const dgRoof1 = createVietnameseCurvedRoofGeometry(9.6, 7.2, 5.6, 3.0, 1.55, 0.38);
  dgRoof1.translate(shX, shBaseY + shH, shZ);
  dgRoof.push(dgRoof1);
  const dgRoof2 = createVietnameseCurvedRoofGeometry(6.8, 4.8, 3.0, 0.45, 1.75, 0.44);
  dgRoof2.translate(shX, shBaseY + shH + 1.38, shZ);
  dgRoof.push(dgRoof2);
  const dgFin = createRoofFinialSetParts(shX, shBaseY + shH + 3.12, shZ, 3.0, 0, 0.68, false);
  dgCrimson.push(...dgFin.mainParts);
  dgGold.push(...dgFin.goldParts);

  const dgCenser = createBronzeIncenseTripodParts(shX, dgFloorY, shZ + 3.65, 0.95);
  dgStone.push(...dgCenser.limestoneParts);
  dgBronze.push(...dgCenser.bronzeParts);
  dgGold.push(...dgCenser.goldParts);
  const dgSmokeWorld = new THREE.Vector3(shX, dgCenser.smokeY, shZ + 3.65)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), dgRotY)
    .add(new THREE.Vector3(dgX, dgY, dgZ));
  smokeSources.push({ x: dgSmokeWorld.x, y: dgSmokeWorld.y, z: dgSmokeWorld.z, scale: 0.95 });

  const applyDg = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(dgRotY);
      g.translate(dgX, dgY, dgZ);
      dst.push(g);
    }
  };
  applyDg(dgStone, stoneParts);
  applyDg(dgCrimson, crimsonParts);
  applyDg(dgWood, woodParts);
  applyDg(dgRoof, roofParts);
  applyDg(dgGold, goldParts);
  applyDg(dgBronze, bronzeParts);
  applyDg(dgLantern, lanternParts);
  applyDg(dgCore, lanternCoreParts);
  applyDg(dgWater, jadeWaterParts);

  const dgPlaquePos = new THREE.Vector3(shX, shBaseY + 2.72, shZ + 2.38)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), dgRotY)
    .add(new THREE.Vector3(dgX, dgY, dgZ));
  const dgPlaque = createSignagePlaqueMesh(
    { text: 'ĐỀN GIẾNG', subText: 'GIẾNG NGỌC', style: 'royal', width: 2.5, height: 0.68, depth: 0.14 },
    ctx
  );
  dgPlaque.name = 'DenGiengPlaque';
  dgPlaque.position.copy(dgPlaquePos);
  dgPlaque.rotation.y = dgRotY;
  group.add(dgPlaque);

  // 2. Crimson-and-Gold Nghi Môn Gate (11m tall) astride Landing 2 with sculpted *Nghê* & "CAO SƠN CẢNH HÀNH" plaque
  const nghiX = nghiLanding.x;
  const nghiZ = nghiLanding.z;
  const nghiY = nghiLanding.topY;
  const nStone: THREE.BufferGeometry[] = [];
  const nCrimson: THREE.BufferGeometry[] = [];
  const nGold: THREE.BufferGeometry[] = [];
  const nRoof: THREE.BufferGeometry[] = [];
  const nLantern: THREE.BufferGeometry[] = [];
  const nLanternCore: THREE.BufferGeometry[] = [];

  for (const [px, colH] of [
    [-3.6, 7.0],
    [-1.85, 8.5],
    [1.85, 8.5],
    [3.6, 7.0]
  ]) {
    nStone.push(makeBox(1.05, 1.45, 1.05, px, 0.72, 0));
    nCrimson.push(makeBox(0.68, colH, 0.68, px, 1.45 + colH * 0.5, 0));
    if (Math.abs(px) > 2.5) {
      // Sculpted guardian *Nghê* via createGuardianBeastParts (replaces rough rock-blob!)
      nStone.push(makeBox(0.88, 0.24, 0.88, px, 1.45 + colH + 0.12, 0));
      nStone.push(...createGuardianBeastParts(px, 1.45 + colH + 0.24, 0, 0, 0.98, 'nghe'));
    } else {
      nGold.push(...createLotusFinialParts(px, 1.45 + colH, 0, 1.05));
    }
  }
  nCrimson.push(makeBox(7.8, 0.58, 0.85, 0, 6.8, 0));
  for (const side of [-1, 1]) {
    nLantern.push(createRibbedLanternShellGeometry(0.24, 0.34, 10, 6).translate(side * 2.65, 6.18, 0.52));
    nLanternCore.push(createLanternCoreGeometry(0.14, 0.22).translate(side * 2.65, 6.18, 0.52));
    nLantern.push(createRibbedLanternShellGeometry(0.20, 0.28, 8, 5).translate(side * 0.95, 6.22, 0.52));
    nLanternCore.push(createLanternCoreGeometry(0.12, 0.18).translate(side * 0.95, 6.22, 0.52));
  }
  const nghiLowRoof = createVietnameseCurvedRoofGeometry(8.6, 2.8, 5.2, 1.4, 1.35, 0.34);
  nghiLowRoof.translate(0, 7.12, 0);
  nRoof.push(nghiLowRoof);
  const nghiTopRoof = createVietnameseCurvedRoofGeometry(5.8, 2.2, 2.6, 0.4, 1.65, 0.40);
  nghiTopRoof.translate(0, 8.85, 0);
  nRoof.push(nghiTopRoof);
  const nghiFin = createRoofFinialSetParts(0, 10.50, 0, 2.8, 0, 0.72, false);
  nCrimson.push(...nghiFin.mainParts);
  nGold.push(...nghiFin.goldParts);

  const applyNghiTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(facingRotY);
      g.translate(nghiX, nghiY, nghiZ);
      dst.push(g);
    }
  };
  applyNghiTransform(nStone, stoneParts);
  applyNghiTransform(nCrimson, crimsonParts);
  applyNghiTransform(nGold, goldParts);
  applyNghiTransform(nRoof, roofParts);
  applyNghiTransform(nLantern, lanternParts);
  applyNghiTransform(nLanternCore, lanternCoreParts);

  // Readable "CAO SƠN CẢNH HÀNH" Plaque on Nghi Môn Gate
  const nghiPlaquePos = new THREE.Vector3(0, 6.82, 0.52)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(nghiX, nghiY, nghiZ));
  const nghiPlaque = createSignagePlaqueMesh(
    {
      text: 'CAO SƠN CẢNH HÀNH',
      subText: '高 山 景 行',
      style: 'royal',
      width: 3.1,
      height: 0.82,
      depth: 0.16
    },
    ctx
  );
  nghiPlaque.name = 'DenHungNghiMonPlaque';
  nghiPlaque.position.copy(nghiPlaquePos);
  nghiPlaque.rotation.y = facingRotY;
  group.add(nghiPlaque);

  // 3. EXPANDED Đền Thượng (22m x 17m Courtyard + Open-Clerestory Lattice Windows + Tapered Obelisk Cột Đá Thề)
  const dStone: THREE.BufferGeometry[] = [];
  const dLaterite: THREE.BufferGeometry[] = [];
  const dCrimson: THREE.BufferGeometry[] = [];
  const dWood: THREE.BufferGeometry[] = [];
  const dRoof: THREE.BufferGeometry[] = [];
  const dGold: THREE.BufferGeometry[] = [];
  const dBronze: THREE.BufferGeometry[] = [];
  const dLantern: THREE.BufferGeometry[] = [];
  const dLanternCore: THREE.BufferGeometry[] = [];
  const dVoid: THREE.BufferGeometry[] = [];

  // Expanded 22m x 17m courtyard platform (top at yBase + 1.85m, skirted -4.5m down)
  const courtH = courtTop + 4.5;
  dStone.push(makeBox(22.0, courtH, 17.0, 0, -4.5 + courtH * 0.5, 1.5));
  dLaterite.push(makeBox(22.4, 0.45, 17.4, 0, courtTop - 0.25, 1.5));

  // Connected `lotus_stone` perimeter balustrade around 22m x 17m courtyard
  dStone.push(
    ...createPiercedBalustradeParts(-10.6, -6.6, 10.6, -6.6, courtTop, 0.92, 'lotus_stone'),
    ...createPiercedBalustradeParts(-10.6, -6.6, -10.6, 9.6, courtTop, 0.92, 'lotus_stone'),
    ...createPiercedBalustradeParts(10.6, -6.6, 10.6, 9.6, courtTop, 0.92, 'lotus_stone'),
    ...createPiercedBalustradeParts(-10.6, 9.6, -3.2, 9.6, courtTop, 0.92, 'lotus_stone'),
    ...createPiercedBalustradeParts(3.2, 9.6, 10.6, 9.6, courtTop, 0.92, 'lotus_stone')
  );

  // Temple raised stone dais + sculpted dragon balustrades
  dStone.push(makeBox(13.8, 1.15, 8.8, 0, courtTop + 0.575, -1.2));
  for (let s = 0; s < 5; s++) {
    dStone.push(makeBox(4.8, 0.28, 0.65, 0, courtTop + 0.14 + s * 0.22, 3.65 - s * 0.42));
  }
  dStone.push(
    ...createCarvedDragonBalustradeParts(-2.65, courtTop + 0.05, 4.15, -2.65, courtTop + 1.15, 2.1, 0.98),
    ...createCarvedDragonBalustradeParts(2.65, courtTop + 0.05, 4.15, 2.65, courtTop + 1.15, 2.1, 0.98)
  );

  const floorY = courtTop + 1.15;
  const hallH = 4.15;
  for (const px of [-5.2, -2.6, 0, 2.6, 5.2]) {
    for (const pz of [-4.0, 1.6]) {
      if (px === 0 && pz > 0) continue;
      dCrimson.push(makeCylinder(0.22, 0.25, hallH, 10, px, floorY + hallH * 0.5, pz));
      dStone.push(makeCylinder(0.32, 0.38, 0.26, 10, px, floorY + 0.13, pz));
    }
  }
  dWood.push(makeBox(0.32, hallH * 0.88, 4.8, -4.85, floorY + hallH * 0.44, -1.2));
  dWood.push(makeBox(0.32, hallH * 0.88, 4.8, 4.85, floorY + hallH * 0.44, -1.2));
  dWood.push(makeBox(9.8, hallH * 0.88, 0.32, 0, floorY + hallH * 0.44, -3.55));
  for (const side of [-1, 1]) {
    dWood.push(makeBox(2.55, hallH * 0.86, 0.24, side * 3.65, floorY + hallH * 0.43, 1.15));
    dWood.push(makeBox(1.12, hallH * 0.78, 0.12, side * 2.08, floorY + hallH * 0.39, 1.55, side * -0.58));
    dGold.push(makeBox(0.32, 2.65, 0.08, side * 2.55, floorY + 2.05, 1.78));
    dCrimson.push(makeBox(0.22, 2.45, 0.10, side * 2.55, floorY + 2.05, 1.80));
  }
  dCrimson.push(makeBox(10.0, 0.22, 5.2, 0, floorY + hallH - 0.14, -1.2));
  dGold.push(makeBox(11.4, 0.32, 6.2, 0, floorY + hallH - 0.06, -1.2));

  // Readable "KÍNH THIÊN LĨNH ĐIỆN" plaque over Đền Thượng front portal
  const ktldPlaquePos = new THREE.Vector3(0, floorY + 3.45, 1.78)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(cx, yBase, cz));
  const ktldPlaque = createSignagePlaqueMesh(
    { text: 'KÍNH THIÊN LĨNH ĐIỆN', subText: 'ĐỀN THƯỢNG — HÙNG VƯƠNG', style: 'royal', width: 3.5, height: 0.86, depth: 0.16 },
    ctx
  );
  ktldPlaque.name = 'DenThuongHoanhPhiPlaque';
  ktldPlaque.position.copy(ktldPlaquePos);
  ktldPlaque.rotation.y = facingRotY;
  group.add(ktldPlaque);

  // Sacred Đền Thượng *Hậu Cung* Interior Altar + 3D Đông Sơn Drum + Sculpted Bronze Cranes on Tortoises
  dCrimson.push(makeBox(4.4, 1.12, 1.25, 0, floorY + 0.56, -2.35));
  dGold.push(makeBox(4.56, 0.14, 1.38, 0, floorY + 1.14, -2.35));
  dGold.push(makeBox(3.6, 0.68, 0.10, 0, floorY + 0.62, -1.70));
  dCrimson.push(makeBox(1.95, 2.15, 0.85, 0, floorY + 2.18, -2.68));
  dGold.push(makeBox(1.65, 1.82, 0.16, 0, floorY + 2.15, -2.42));
  dGold.push(makeBox(0.68, 1.15, 0.14, 0, floorY + 1.86, -2.22));
  // 3D Đông Sơn Drum on timber stand
  dWood.push(makeBox(0.95, 0.44, 0.72, 0, floorY + 0.22, -0.85));
  dBronze.push(...createDongSonDrum3DParts(0, floorY + 0.44, -0.85, 0.42));
  dBronze.push(makeCylinder(0.24, 0.18, 0.36, 12, 0, floorY + 1.38, -1.92));

  for (const side of [-1, 1]) {
    // Sculpted bronze cranes standing on tortoises (*Hạc chầu quy*)
    dBronze.push(...createBronzeCraneOnTortoiseParts(side * 1.55, floorY, -1.55, side > 0 ? -0.25 : 0.25, 1.0));
    // Paired golden ceremonial parasols (*Tàn Lọng Vàng*)
    dGold.push(makeCylinder(0.04, 0.05, 2.65, 6, side * 2.65, floorY + 1.32, -2.2));
    dGold.push(makeCylinder(0.58, 0.68, 0.34, 12, side * 2.65, floorY + 2.68, -2.2));
    dBronze.push(makeCylinder(0.09, 0.14, 0.26, 8, side * 1.05, floorY + 1.34, -1.92));
    dLanternCore.push(new THREE.SphereGeometry(0.14, 8, 8).translate(side * 1.05, floorY + 1.58, -1.92));
    dLantern.push(createRibbedLanternShellGeometry(0.24, 0.34, 10, 6).translate(side * 3.85, floorY + hallH - 0.56, 1.92));
    dLanternCore.push(createLanternCoreGeometry(0.14, 0.22).translate(side * 3.85, floorY + hallH - 0.56, 1.92));
    dLantern.push(createRibbedLanternShellGeometry(0.22, 0.32, 10, 6).translate(side * 2.18, floorY + hallH - 0.62, 1.96));
    dLanternCore.push(createLanternCoreGeometry(0.13, 0.20).translate(side * 2.18, floorY + hallH - 0.62, 1.96));
  }
  const sanctumLightPos = new THREE.Vector3(0, floorY + 2.4, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY);
  const denThuongLight = new THREE.PointLight('#ffcc6e', 2.2, 16, 1.5);
  denThuongLight.position.set(cx + sanctumLightPos.x, yBase + sanctumLightPos.y, cz + sanctumLightPos.z);
  group.add(denThuongLight);

  // Lower curved terracotta roof
  const lowRoof = createVietnameseCurvedRoofGeometry(14.8, 9.6, 9.8, 4.8, 2.35, 0.42);
  lowRoof.translate(0, floorY + hallH + 0.04, -1.2);
  dRoof.push(lowRoof);

  // Upper Clerestory Tier with OPEN LATTICE WINDOWS (replaces solid crimson box!)
  const upperHallY = floorY + hallH + 1.45;
  const upperHallH = 1.90;
  // Corner & bay crimson posts
  for (const ux of [-4.2, -2.1, 0, 2.1, 4.2]) {
    for (const uz of [-3.2, 0.8]) {
      dCrimson.push(makeBox(0.22, upperHallH, 0.22, ux, upperHallY + upperHallH * 0.5, uz));
    }
  }
  // Recessed dark interior void behind clerestory lattice windows
  dVoid.push(makeBox(7.8, upperHallH * 0.82, 3.3, 0, upperHallY + upperHallH * 0.5, -1.2));
  // Open pierced golden lattice window frames (*chữ Thọ / hoa chanh*) on Front, Rear & Side clerestory bays
  for (const zSide of [-3.2, 0.8]) {
    dCrimson.push(makeBox(8.6, 0.22, 0.20, 0, upperHallY + 0.11, zSide));
    dCrimson.push(makeBox(8.6, 0.22, 0.20, 0, upperHallY + upperHallH - 0.11, zSide));
    for (const bx of [-3.15, -1.05, 1.05, 3.15]) {
      // Pierced lattice bars inside each clerestory window bay
      dGold.push(makeBox(1.85, 0.06, 0.08, bx, upperHallY + upperHallH * 0.5, zSide));
      dGold.push(makeBox(0.06, upperHallH * 0.78, 0.08, bx, upperHallY + upperHallH * 0.5, zSide));
      const ring = new THREE.TorusGeometry(0.42, 0.045, 6, 12);
      ring.translate(bx, upperHallY + upperHallH * 0.5, zSide);
      dGold.push(ring);
    }
  }
  for (const xSide of [-4.2, 4.2]) {
    dCrimson.push(makeBox(0.20, 0.22, 4.2, xSide, upperHallY + 0.11, -1.2));
    dCrimson.push(makeBox(0.20, 0.22, 4.2, xSide, upperHallY + upperHallH - 0.11, -1.2));
    for (const bz of [-2.2, -0.2]) {
      dGold.push(makeBox(0.08, 0.06, 1.75, xSide, upperHallY + upperHallH * 0.5, bz));
      dGold.push(makeBox(0.08, upperHallH * 0.78, 0.06, xSide, upperHallY + upperHallH * 0.5, bz));
    }
  }
  dGold.push(makeBox(9.2, 0.22, 4.8, 0, upperHallY + upperHallH - 0.04, -1.2));

  const highRoof = createVietnameseCurvedRoofGeometry(11.6, 7.0, 4.6, 0.55, 2.65, 0.48);
  highRoof.translate(0, upperHallY + upperHallH + 0.02, -1.2);
  dRoof.push(highRoof);

  const crestY = upperHallY + upperHallH + 2.66;
  dGold.push(makeBox(4.8, 0.22, 0.22, 0, crestY, -1.2));
  const dtUpperFin = createRoofFinialSetParts(0, crestY + 0.06, -1.2, 4.8, 0, 0.98, true);
  dCrimson.push(...dtUpperFin.mainParts);
  dGold.push(...dtUpperFin.goldParts);

  // Monumental Sculpted Bronze *Đỉnh Đồng* Tripod Censer in front courtyard + GPU Incense Smoke
  const censerZ = 6.6;
  const dhCenser = createBronzeIncenseTripodParts(0, courtTop, censerZ, 1.38);
  dStone.push(...dhCenser.limestoneParts);
  dBronze.push(...dhCenser.bronzeParts);
  dGold.push(...dhCenser.goldParts);
  const dhSmokeWorld = new THREE.Vector3(0, dhCenser.smokeY, censerZ)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(cx, yBase, cz));
  smokeSources.push({ x: dhSmokeWorld.x, y: dhSmokeWorld.y, z: dhSmokeWorld.z, scale: 1.25 });

  // 4. Reshaped *Cột Đá Thề* (Tapered 4-Sided Stone Obelisk with Low Stone Fence) on West Terrace
  const oathX = -7.4;
  const oathZ = 5.4;
  dStone.push(makeBox(1.85, 0.36, 1.85, oathX, courtTop + 0.18, oathZ));
  dStone.push(makeBox(1.22, 0.30, 1.22, oathX, courtTop + 0.51, oathZ));
  // Tapered square-section obelisk stone shaft + pyramidal apex cap
  const obeliskShaft = makeCylinder(0.24, 0.44, 1.85, 4, oathX, courtTop + 1.58, oathZ, 0, 0, Math.PI * 0.25);
  dStone.push(obeliskShaft);
  const obeliskCap = new THREE.ConeGeometry(0.24, 0.38, 4);
  obeliskCap.rotateY(Math.PI * 0.25);
  obeliskCap.translate(oathX, courtTop + 2.68, oathZ);
  dStone.push(obeliskCap);
  dGold.push(makeBox(0.32, 0.85, 0.05, oathX, courtTop + 1.55, oathZ + 0.26));
  // Low square carved stone fence surrounding Cột Đá Thề
  const fOff = 1.65;
  dStone.push(
    ...createPiercedBalustradeParts(oathX - fOff, oathZ - fOff, oathX + fOff, oathZ - fOff, courtTop, 0.62, 'lotus_stone'),
    ...createPiercedBalustradeParts(oathX - fOff, oathZ - fOff, oathX - fOff, oathZ + fOff, courtTop, 0.62, 'lotus_stone'),
    ...createPiercedBalustradeParts(oathX + fOff, oathZ - fOff, oathX + fOff, oathZ + fOff, courtTop, 0.62, 'lotus_stone'),
    ...createPiercedBalustradeParts(oathX - fOff, oathZ + fOff, oathX - 0.65, oathZ + fOff, courtTop, 0.62, 'lotus_stone'),
    ...createPiercedBalustradeParts(oathX + 0.65, oathZ + fOff, oathX + fOff, oathZ + fOff, courtTop, 0.62, 'lotus_stone')
  );

  const applyTempleTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(facingRotY);
      g.translate(cx, yBase, cz);
      dst.push(g);
    }
  };
  applyTempleTransform(dStone, stoneParts);
  applyTempleTransform(dLaterite, lateriteParts);
  applyTempleTransform(dCrimson, crimsonParts);
  applyTempleTransform(dWood, woodParts);
  applyTempleTransform(dRoof, roofParts);
  applyTempleTransform(dGold, goldParts);
  applyTempleTransform(dBronze, bronzeParts);
  applyTempleTransform(dLantern, lanternParts);
  applyTempleTransform(dLanternCore, lanternCoreParts);
  applyTempleTransform(dVoid, voidParts);

  // 5. *Hùng Vương Lăng* (Tomb of the 6th Hung King) with Sculpted *Kỳ Lân*, Readable Plaque & Tripod Censer
  const tombLocal = new THREE.Vector3(16.6, 0, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY);
  const tombX = cx + tombLocal.x;
  const tombZ = cz + tombLocal.z;
  const tombY = ctx.getHeight(tombX, tombZ);
  ctx.exclusionCircles.push({ x: tombX, z: tombZ, r: 10.0 });

  const tStone: THREE.BufferGeometry[] = [];
  const tLaterite: THREE.BufferGeometry[] = [];
  const tCrimson: THREE.BufferGeometry[] = [];
  const tRoof: THREE.BufferGeometry[] = [];
  const tGold: THREE.BufferGeometry[] = [];
  const tBronze: THREE.BufferGeometry[] = [];
  const tLantern: THREE.BufferGeometry[] = [];
  const tLanternCore: THREE.BufferGeometry[] = [];

  const tPlatTop = 1.4;
  const tPlatH = tPlatTop + 5.5;
  tStone.push(makeBox(10.4, tPlatH, 10.4, 0, -5.5 + tPlatH * 0.5, 0));
  tLaterite.push(makeBox(10.8, 0.36, 10.8, 0, tPlatTop - 0.18, 0));

  tStone.push(
    ...createPiercedBalustradeParts(-4.9, -4.9, 4.9, -4.9, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(-4.9, -4.9, -4.9, 4.9, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(4.9, -4.9, 4.9, 4.9, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(-4.9, 4.9, -1.9, 4.9, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(1.9, 4.9, 4.9, 4.9, tPlatTop, 1.05, 'lotus_stone')
  );
  for (const side of [-1, 1]) {
    // Sculpted *Kỳ Lân* guardian beasts via createGuardianBeastParts (replaces rough rock-blobs!)
    tStone.push(makeBox(0.84, 0.65, 0.84, side * 1.55, tPlatTop + 0.325, 4.95));
    tStone.push(...createGuardianBeastParts(side * 1.55, tPlatTop + 0.65, 4.95, 0, 0.92, 'kylan'));
    tLantern.push(createRibbedLanternShellGeometry(0.20, 0.28, 8, 5).translate(side * 1.85, tPlatTop + 3.45, 2.35));
    tLanternCore.push(createLanternCoreGeometry(0.12, 0.18).translate(side * 1.85, tPlatTop + 3.45, 2.35));
  }

  const tBaseY = tPlatTop + 0.35;
  tStone.push(makeBox(5.6, 0.35, 5.6, 0, tPlatTop + 0.175, -0.4));
  for (const px of [-2.15, 2.15]) {
    for (const pz of [-2.55, 1.75]) {
      tStone.push(makeBox(0.62, 0.42, 0.62, px, tBaseY + 0.21, pz));
      tCrimson.push(makeCylinder(0.18, 0.21, 3.15, 10, px, tBaseY + 0.42 + 1.575, pz));
    }
  }
  tStone.push(makeBox(4.3, 2.6, 0.36, 0, tBaseY + 1.3, -2.55));
  for (const side of [-1, 1]) {
    tStone.push(makeBox(0.36, 2.6, 3.8, side * 2.15, tBaseY + 1.3, -0.6));
  }
  tStone.push(makeBox(2.2, 1.15, 2.6, 0, tBaseY + 0.58, -0.75));
  tGold.push(makeBox(0.62, 1.05, 0.12, 0, tBaseY + 1.55, -1.75));

  // Bronze tripod censer in front of Hùng Vương Lăng + GPU Incense Smoke
  const tombCenser = createBronzeIncenseTripodParts(0, tPlatTop, 2.95, 0.95);
  tStone.push(...tombCenser.limestoneParts);
  tBronze.push(...tombCenser.bronzeParts);
  tGold.push(...tombCenser.goldParts);
  const tombSmokeWorld = new THREE.Vector3(0, tombCenser.smokeY, 2.95)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(tombX, tombY, tombZ));
  smokeSources.push({ x: tombSmokeWorld.x, y: tombSmokeWorld.y, z: tombSmokeWorld.z, scale: 0.95 });

  const tRoof1 = createVietnameseCurvedRoofGeometry(6.8, 6.8, 4.0, 4.0, 1.55, 0.38);
  tRoof1.translate(0, tBaseY + 3.55, -0.4);
  tRoof.push(tRoof1);
  tCrimson.push(makeBox(3.4, 0.92, 3.4, 0, tBaseY + 4.92, -0.4));
  const tRoof2 = createVietnameseCurvedRoofGeometry(5.0, 5.0, 1.2, 0.55, 1.85, 0.44);
  tRoof2.translate(0, tBaseY + 5.32, -0.4);
  tRoof.push(tRoof2);
  const tombFin = createRoofFinialSetParts(0, tBaseY + 7.16, -0.4, 1.4, 0, 0.68, false);
  tCrimson.push(...tombFin.mainParts);
  tGold.push(...tombFin.goldParts);

  const applyTombTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(facingRotY);
      g.translate(tombX, tombY, tombZ);
      dst.push(g);
    }
  };
  applyTombTransform(tStone, stoneParts);
  applyTombTransform(tLaterite, lateriteParts);
  applyTombTransform(tCrimson, crimsonParts);
  applyTombTransform(tRoof, roofParts);
  applyTombTransform(tGold, goldParts);
  applyTombTransform(tBronze, bronzeParts);
  applyTombTransform(tLantern, lanternParts);
  applyTombTransform(tLanternCore, lanternCoreParts);

  // Readable "HÙNG VƯƠNG LĂNG" plaque over mausoleum entrance
  const tombPlaquePos = new THREE.Vector3(0, tBaseY + 3.22, 1.92)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(tombX, tombY, tombZ));
  const tombPlaque = createSignagePlaqueMesh(
    { text: 'HÙNG VƯƠNG LĂNG', subText: '雄 王 陵', style: 'royal', width: 2.8, height: 0.74, depth: 0.16 },
    ctx
  );
  tombPlaque.name = 'HungVuongLangPlaque';
  tombPlaque.position.copy(tombPlaquePos);
  tombPlaque.rotation.y = facingRotY;
  group.add(tombPlaque);

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'DenHungStoneStepsAndPlinth');
  addMergedMesh(group, lateriteParts, ctx.materials.chamBrick, 'DenHungLateriteCurbs');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'DenHungCrimsonHall');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'DenHungTimberSanctuary');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'DenHungCurvedRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'DenHungGoldFrieze');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'DenHungBronzeCenser');
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'DenHungClerestoryVoids', false, false);
  addMergedMesh(group, jadeWaterParts, jadeWaterMat, 'DenGiengJadeWellWater', false, true);
  addMergedMesh(group, lanternParts, ctx.materials.lanternSilk, 'DenHungTempleLanterns', false, false);
  addMergedMesh(
    group,
    lanternCoreParts,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    'DenHungTempleLanternCores',
    false,
    false
  );

  addIncenseSmoke(ctx, flagUniforms, group, smokeSources, 'DenHungIncenseSmoke');
  ctx.scene.add(group);
}

/**
 * 6. Northern Landscape Accents:
 * - 4 distant towering Hạ Long Bay karst islands with weathered mossy tint & tropical jungle foliage crowns
 * - 4-house Mù Cang Chải highland timber stilt hamlet with slatted walls, shuttered windows, bamboo_x veranda
 *   railings, palm-thatch pitched roofs crowned with crossed Khau Cút gable finials, wooden looms & golden corn racks.
 */
function buildNorthernLandscapeAccents(ctx: VietnamBuilderContext): void {
  const group = new THREE.Group();
  group.name = 'NorthernLandscapeAccents';

  const mossyKarstMat = new THREE.MeshStandardMaterial({
    color: '#637161',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughnessMap: ctx.pbr.granite.roughnessMap,
    roughness: 0.88,
    metalness: 0.04
  });
  ctx.extraMaterials.push(mossyKarstMat);

  const karstJungleMat = new THREE.MeshStandardMaterial({
    color: '#29572d',
    roughness: 0.84,
    metalness: 0.02
  });
  ctx.extraMaterials.push(karstJungleMat);

  const palmThatchMat = new THREE.MeshStandardMaterial({
    color: '#7c623d',
    map: ctx.pbr.darkRoof.map,
    normalMap: ctx.pbr.darkRoof.normalMap,
    roughness: 0.92,
    metalness: 0.02
  });
  ctx.extraMaterials.push(palmThatchMat);

  const goldenCornMat = new THREE.MeshStandardMaterial({
    color: '#e6b228',
    roughness: 0.58,
    metalness: 0.04
  });
  ctx.extraMaterials.push(goldenCornMat);

  const brocadeClothMat = new THREE.MeshStandardMaterial({
    color: '#b52834',
    roughness: 0.72,
    metalness: 0.04
  });
  ctx.extraMaterials.push(brocadeClothMat);

  const karstParts: THREE.BufferGeometry[] = [];
  const karstFoliageParts: THREE.BufferGeometry[] = [];
  const timberParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const cornParts: THREE.BufferGeometry[] = [];
  const brocadeParts: THREE.BufferGeometry[] = [];

  // 1. 4 distant towering Hạ Long Bay karst islands with weathered mossy stone & lush tropical jungle crowns
  const isletSpecs = [
    { seed: 811, r: 25.0, h: 74.0, x: -245, z: -480, lx: 3.2, lz: -1.4 },
    { seed: 812, r: 29.0, h: 88.0, x: 185, z: -515, lx: -3.5, lz: 1.6 },
    { seed: 813, r: 27.0, h: 82.0, x: -75, z: -590, lx: 2.2, lz: 2.4 },
    { seed: 814, r: 23.0, h: 68.0, x: 345, z: -625, lx: -2.4, lz: -1.8 }
  ];
  for (const k of isletSpecs) {
    const geo = createHaLongKarstGeometry(k.seed, k.r, k.h, k.lx, k.lz);
    geo.translate(k.x, -2.4, k.z);
    karstParts.push(geo);

    // Tropical jungle foliage crown & cliffside shrub clusters clinging to upper ledges
    const topX = k.x + k.lx;
    const topZ = k.z + k.lz;
    const topY = k.h - 4.2;
    const crown = createSculptedRockGeometry(k.seed + 50, k.r * 0.62, k.h * 0.14, k.r * 0.62, 2);
    crown.translate(topX, topY, topZ);
    karstFoliageParts.push(crown);

    for (let c = 0; c < 6; c++) {
      const ca = (c / 6) * Math.PI * 2 + k.seed * 0.4;
      const fracH = 0.56 + (c % 3) * 0.14;
      const rad = k.r * (0.72 - fracH * 0.25);
      const puff = createSculptedRockGeometry(
        k.seed + 70 + c * 11,
        k.r * 0.28,
        k.h * 0.08,
        k.r * 0.28,
        1
      );
      puff.translate(
        k.x + k.lx * fracH + Math.cos(ca) * rad,
        k.h * fracH - 2.4,
        k.z + k.lz * fracH + Math.sin(ca) * rad
      );
      karstFoliageParts.push(puff);
    }
  }

  // 2. 4-House Mù Cang Chải Highland Timber Stilt Hamlet (*Bản Nhà Sàn Thái / H'Mông*)
  const stiltSpecs = [
    { x: -155, z: -25, rotY: 0.35 },
    { x: -225, z: -62, rotY: -0.25 },
    { x: -178, z: -42, rotY: 0.18 },
    { x: -202, z: -30, rotY: -0.42 }
  ];
  for (let hi = 0; hi < stiltSpecs.length; hi++) {
    const sh = stiltSpecs[hi];
    ctx.exclusionCircles.push({ x: sh.x, z: sh.z, r: 11.5 });

    const postXs = [-4.0, -1.35, 1.35, 4.0];
    const postZs = [-2.9, 0, 2.9];
    let maxGroundY = -Infinity;
    let avgGroundY = 0;
    const cornerGrounds: Array<{ ox: number; oz: number; gy: number }> = [];

    for (const ox of postXs) {
      for (const oz of postZs) {
        const wx = sh.x + ox * Math.cos(sh.rotY) + oz * Math.sin(sh.rotY);
        const wz = sh.z - ox * Math.sin(sh.rotY) + oz * Math.cos(sh.rotY);
        const gy = ctx.getHeight(wx, wz);
        if (gy > maxGroundY) maxGroundY = gy;
        avgGroundY += gy;
        cornerGrounds.push({ ox, oz, gy });
      }
    }
    avgGroundY /= cornerGrounds.length;

    const deckY = maxGroundY + 2.25;
    const localWood: THREE.BufferGeometry[] = [];
    const localRoof: THREE.BufferGeometry[] = [];
    const localVoid: THREE.BufferGeometry[] = [];
    const localCorn: THREE.BufferGeometry[] = [];
    const localBrocade: THREE.BufferGeometry[] = [];

    for (const p of cornerGrounds) {
      const postBot = p.gy - 2.0;
      const postTop = deckY + 2.85;
      const postH = Math.max(1.5, postTop - postBot);
      localWood.push(makeCylinder(0.15, 0.18, postH, 8, p.ox, postBot + postH * 0.5, p.oz));
    }

    // Under-deck horizontal tie beams
    for (const oz of postZs) {
      localWood.push(makeBox(8.4, 0.22, 0.22, 0, deckY - 0.35, oz));
    }
    for (const ox of postXs) {
      localWood.push(makeBox(0.22, 0.22, 6.2, ox, deckY - 0.55, 0));
    }

    // Raised timber plank floor deck
    localWood.push(makeBox(9.4, 0.26, 7.2, 0, deckY, 0));

    // Slatted wooden walls (vertical plank relief) with open doorway & shuttered windows
    const wallH = 2.65;
    const houseZ = -0.55;
    const houseW = 8.2;
    const houseD = 4.8;
    // Inner structural shell recessed slightly + vertical wooden plank slats on all 4 sides
    localWood.push(makeBox(houseW - 0.16, wallH, houseD - 0.16, 0, deckY + 0.13 + wallH * 0.5, houseZ));
    for (let sx = -3.85; sx <= 3.85; sx += 0.55) {
      // Skip doorway & window slots on front wall (+Z = houseZ + 2.4 = 1.85)
      const inDoor = Math.abs(sx - 1.35) < 0.72;
      const inWinL = Math.abs(sx + 1.85) < 0.65;
      if (!inDoor && !inWinL) {
        localWood.push(makeBox(0.18, wallH, 0.10, sx, deckY + 0.13 + wallH * 0.5, houseZ + houseD * 0.5 + 0.02));
      }
      localWood.push(makeBox(0.18, wallH, 0.10, sx, deckY + 0.13 + wallH * 0.5, houseZ - houseD * 0.5 - 0.02));
    }
    for (let sz = houseZ - 2.1; sz <= houseZ + 2.1; sz += 0.55) {
      localWood.push(makeBox(0.10, wallH, 0.18, -houseW * 0.5 - 0.02, deckY + 0.13 + wallH * 0.5, sz));
      localWood.push(makeBox(0.10, wallH, 0.18, houseW * 0.5 + 0.02, deckY + 0.13 + wallH * 0.5, sz));
    }

    // Front recessed doorway with open timber door leaf
    const doorX = 1.35;
    const frontZ = houseZ + houseD * 0.5;
    localVoid.push(makeBox(1.18, 1.92, 0.18, doorX, deckY + 1.12, frontZ + 0.02));
    localWood.push(makeBox(0.14, 2.02, 0.22, doorX - 0.64, deckY + 1.15, frontZ + 0.05));
    localWood.push(makeBox(0.14, 2.02, 0.22, doorX + 0.64, deckY + 1.15, frontZ + 0.05));
    localWood.push(makeBox(1.42, 0.16, 0.22, doorX, deckY + 2.18, frontZ + 0.05));
    localWood.push(makeBox(0.95, 1.88, 0.10, doorX - 0.92, deckY + 1.12, frontZ + 0.42, 0.68));

    // Shuttered windows on front & side walls (with open hinged shutters & wooden sill bars)
    const winX = -1.85;
    localVoid.push(makeBox(1.15, 0.95, 0.18, winX, deckY + 1.62, frontZ + 0.02));
    localWood.push(makeBox(1.32, 0.12, 0.22, winX, deckY + 1.12, frontZ + 0.06));
    localWood.push(makeBox(1.32, 0.12, 0.22, winX, deckY + 2.12, frontZ + 0.06));
    for (const sSide of [-1, 1]) {
      localWood.push(
        makeBox(0.54, 0.92, 0.08, winX + sSide * 0.78, deckY + 1.62, frontZ + 0.22, sSide * -0.55)
      );
    }
    // Side shuttered window
    localVoid.push(makeBox(0.18, 0.92, 1.08, houseW * 0.5 + 0.02, deckY + 1.62, houseZ));
    localWood.push(makeBox(0.22, 0.12, 1.24, houseW * 0.5 + 0.05, deckY + 1.14, houseZ));
    localWood.push(makeBox(0.22, 0.12, 1.24, houseW * 0.5 + 0.05, deckY + 2.10, houseZ));

    // Authentic `bamboo_x` veranda railings around open front & side deck (leaving stair opening at x in [1.4..3.0])
    localWood.push(
      ...createPiercedBalustradeParts(-4.5, 3.45, 1.35, 3.45, deckY + 0.13, 0.92, 'bamboo_x'),
      ...createPiercedBalustradeParts(3.05, 3.45, 4.5, 3.45, deckY + 0.13, 0.92, 'bamboo_x'),
      ...createPiercedBalustradeParts(-4.5, 1.85, -4.5, 3.45, deckY + 0.13, 0.92, 'bamboo_x'),
      ...createPiercedBalustradeParts(4.5, 1.85, 4.5, 3.45, deckY + 0.13, 0.92, 'bamboo_x')
    );

    // Downhill access stair with timber handrail anchored continuously to terrain
    const stairTopZ = 3.55;
    const stairBotZ = 7.40;
    const stairMidX = 2.2;
    const getLocalGround = (ox: number, oz: number) => {
      const wx = sh.x + ox * Math.cos(sh.rotY) + oz * Math.sin(sh.rotY);
      const wz = sh.z - ox * Math.sin(sh.rotY) + oz * Math.cos(sh.rotY);
      return ctx.getHeight(wx, wz);
    };
    const botGroundY =
      Math.min(
        getLocalGround(stairMidX - 0.7, stairBotZ),
        getLocalGround(stairMidX, stairBotZ),
        getLocalGround(stairMidX + 0.7, stairBotZ)
      ) - 0.8;
    const dropY = Math.max(1.0, deckY - botGroundY);
    const runZ = stairBotZ - stairTopZ;
    const numSteps = Math.max(8, Math.ceil(dropY / 0.32));
    for (let s = 0; s < numSteps; s++) {
      const t = s / (numSteps - 1);
      const sy = THREE.MathUtils.lerp(deckY - 0.12, botGroundY + 0.15, t);
      const sz = THREE.MathUtils.lerp(stairTopZ + 0.2, stairBotZ - 0.2, t);
      localWood.push(makeBox(1.45, 0.16, 0.44, stairMidX, sy, sz));
    }
    localWood.push(makeBox(1.8, 1.4, 1.2, stairMidX, botGroundY + 0.1, stairBotZ));

    const stringerLen = Math.hypot(runZ, dropY) + 0.4;
    const stringerAngle = -Math.atan2(runZ, dropY);
    const midY = (deckY + botGroundY) * 0.5;
    const midZ = (stairTopZ + stairBotZ) * 0.5;
    for (const sx of [1.45, 2.95]) {
      const stringer = makeBox(0.15, stringerLen, 0.22, 0, 0, 0);
      stringer.rotateX(stringerAngle);
      stringer.translate(sx, midY, midZ);
      localWood.push(stringer);
      // Inclined stair handrail
      const handrail = makeBox(0.08, stringerLen, 0.08, 0, 0, 0);
      handrail.rotateX(stringerAngle);
      handrail.translate(sx, midY + 0.85, midZ);
      localWood.push(handrail);
    }

    // Thick palm-thatch pitched highland roof
    const roofBaseY = deckY + 2.75;
    const roofH = 3.25;
    const roof = createVietnameseCurvedRoofGeometry(11.4, 9.0, 6.4, 0.42, roofH, 0.20);
    roof.translate(0, roofBaseY, -0.2);
    localRoof.push(roof);

    // Authentic crossed **Khau Cút** wooden gable finials at BOTH gable peaks of the pitched roof!
    const ridgeTopY = roofBaseY + roofH;
    for (const side of [-1, 1]) {
      const gx = side * 3.15;
      const gz = -0.2;
      // Crossed X-shaped curved *Khau Cút* timber horns + central carved lotus crest
      const hornA = makeBox(0.12, 1.45, 0.12, 0, 0, 0);
      hornA.rotateX(0.58);
      hornA.translate(gx, ridgeTopY + 0.42, gz);
      const hornB = makeBox(0.12, 1.45, 0.12, 0, 0, 0);
      hornB.rotateX(-0.58);
      hornB.translate(gx, ridgeTopY + 0.42, gz);
      const crest = makeCylinder(0.05, 0.11, 0.72, 6, gx, ridgeTopY + 0.58, gz);
      localWood.push(hornA, hornB, crest);
    }

    // Under-stilt cultural life: Traditional Wooden Weaving Loom (*Khung Cửi*) + Golden Drying Corn Racks
    const underY = Math.max(avgGroundY, maxGroundY - 0.55);
    // Wooden weaving loom frame under left stilt bay
    const loomX = -2.4;
    const loomZ = 0.6;
    for (const lx of [-0.65, 0.65]) {
      for (const lz of [-0.95, 0.95]) {
        localWood.push(makeBox(0.10, 1.25, 0.10, loomX + lx, underY + 0.62, loomZ + lz));
      }
      localWood.push(makeBox(0.10, 0.10, 2.05, loomX + lx, underY + 1.12, loomZ));
    }
    localWood.push(makeBox(1.42, 0.10, 0.10, loomX, underY + 0.85, loomZ - 0.85));
    localWood.push(makeBox(1.42, 0.10, 0.10, loomX, underY + 0.85, loomZ + 0.85));
    // Woven crimson highland brocade cloth stretched across loom
    localBrocade.push(makeBox(1.05, 0.06, 1.55, loomX, underY + 0.88, loomZ));

    // Golden drying corn cob racks hanging under front veranda beam & stilts
    for (let r = 0; r < 2; r++) {
      const rackX = r === 0 ? -2.2 : 0.4;
      const rackZ = 2.95;
      const rackY = deckY - 0.62;
      localWood.push(makeCylinder(0.04, 0.04, 1.9, 6, rackX, rackY, rackZ, 0, Math.PI * 0.5));
      for (let c = 0; c < 7; c++) {
        const cxOff = rackX - 0.78 + c * 0.26;
        localCorn.push(makeCylinder(0.055, 0.04, 0.34, 6, cxOff, rackY - 0.22, rackZ));
      }
    }

    const applyHouse = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
      for (const g of src) {
        g.rotateY(sh.rotY);
        g.translate(sh.x, 0, sh.z);
        dst.push(g);
      }
    };
    applyHouse(localWood, timberParts);
    applyHouse(localRoof, roofParts);
    applyHouse(localVoid, voidParts);
    applyHouse(localCorn, cornParts);
    applyHouse(localBrocade, brocadeParts);
  }

  addMergedMesh(group, karstParts, mossyKarstMat, 'NorthernDistantKarstIslets');
  addMergedMesh(group, karstFoliageParts, karstJungleMat, 'NorthernDistantKarstFoliage');
  addMergedMesh(group, timberParts, ctx.materials.darkWood, 'MuCangChaiStiltHousesTimber');
  addMergedMesh(group, roofParts, palmThatchMat, 'MuCangChaiStiltHousesRoofs');
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'MuCangChaiStiltHouseOpenings', false, false);
  addMergedMesh(group, cornParts, goldenCornMat, 'MuCangChaiDryingCornRacks');
  addMergedMesh(group, brocadeParts, brocadeClothMat, 'MuCangChaiWeavingLoomBrocade');

  ctx.scene.add(group);
}

/**
 * Builds the 5 Northern Vietnam Heritage Landmarks + Mù Cang Chải / Hạ Long Bay accents at true 1:1 scale.
 */
export function buildVietnamNorthLandmarks(ctx: VietnamBuilderContext): VietnamNorthBuildResult {
  const flagUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [];

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: '#d9dfe6',
    metalness: 0.86,
    roughness: 0.24
  });
  ctx.extraMaterials.push(stainlessMat);

  buildHoangThanhThangLong(ctx, stainlessMat, flagUniforms);
  buildLungCuFlagpole(ctx, stainlessMat, flagUniforms);
  buildFansipanSummit(ctx, stainlessMat, flagUniforms);
  buildChuaHuongAndSuoiYen(ctx, flagUniforms);
  buildDenHung(ctx, flagUniforms);
  buildNorthernLandscapeAccents(ctx);

  return { flagUniforms };
}
