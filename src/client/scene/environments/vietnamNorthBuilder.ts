import * as THREE from 'three';
import {
  VietnamBuilderContext,
  applyWorldBoxUV,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createGableRoofGeometry,
  createHaLongKarstGeometry,
  createIncenseSmokeSystem,
  createLanternCapGeometry,
  createLanternCoreGeometry,
  createLotusFinialParts,
  createNotchedLotusPadGeometry,
  createRibbedLanternShellGeometry,
  createRoseWindowGeometry,
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
  receiveShadow = true,
  worldUvMeters?: number
): void {
  if (parts.length === 0) return;
  const mesh = createMergedMesh(name, parts, material, castShadow, receiveShadow);
  if (worldUvMeters && worldUvMeters > 0) {
    applyWorldBoxUV(mesh.geometry, worldUvMeters);
  }
  group.add(mesh);
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
  const ochrePlasterParts: THREE.BufferGeometry[] = [];
  const whitePlasterParts: THREE.BufferGeometry[] = [];
  const batTrangParts: THREE.BufferGeometry[] = [];
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

    // Stepped green-stone quoining at arch bases + recessed rectangular brick frames around each of the 5 portals
    const haw = a.aw * 0.5;
    const frameW = a.aw + 1.05;
    const frameH = a.ah + 0.62;
    for (const zFace of [-1, 1]) {
      const fz = cz + zFace * (gateDepth * 0.5 + 0.08);
      // Stepped stone quoining courses ascending both jamb bases
      for (const side of [-1, 1]) {
        for (let q = 0; q < 4; q++) {
          const qw = q % 2 === 0 ? 0.54 : 0.36;
          const qx = cx + a.ox + side * (haw + 0.22 + qw * 0.35);
          stoneParts.push(makeBox(qw, 0.34, 0.22, qx, wallY + 0.22 + q * 0.38, fz + zFace * 0.02));
        }
        // Vertical outer border of recessed rectangular portal frame
        brickParts.push(
          makeBox(0.24, frameH, 0.18, cx + a.ox + side * (frameW * 0.5), wallY + frameH * 0.5, fz)
        );
      }
      // Horizontal rectangular lintel hood framing the arch top
      brickParts.push(makeBox(frameW + 0.24, 0.24, 0.20, cx + a.ox, wallY + frameH + 0.08, fz));
      stoneParts.push(makeBox(frameW + 0.38, 0.12, 0.24, cx + a.ox, wallY + frameH + 0.24, fz));
    }
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

  // Authentic flat ochre-plaster parapet wall around Đoan Môn rampart deck (NO fake battlements!)
  const addFlatParapetX = (x0: number, x1: number, zPos: number) => {
    const w = Math.abs(x1 - x0);
    const mx = (x0 + x1) * 0.5;
    ochrePlasterParts.push(makeBox(w, 0.84, 0.34, mx, deckY + 0.42, zPos));
    stoneParts.push(makeBox(w + 0.08, 0.12, 0.42, mx, deckY + 0.88, zPos));
  };
  const addFlatParapetZ = (xPos: number, z0: number, z1: number) => {
    const d = Math.abs(z1 - z0);
    const mz = (z0 + z1) * 0.5;
    ochrePlasterParts.push(makeBox(0.34, 0.84, d, xPos, deckY + 0.42, mz));
    stoneParts.push(makeBox(0.42, 0.12, d + 0.08, xPos, deckY + 0.88, mz));
  };

  addFlatParapetX(-14.2, 14.2, cz + gateDepth * 0.5);
  addFlatParapetX(-14.2, 14.2, cz - gateDepth * 0.5);
  for (const side of [-1, 1]) {
    addFlatParapetX(side * 14.4, side * 23.0, -58.0);
    addFlatParapetX(side * 14.4, side * 23.0, -78.0);
    addFlatParapetZ(side * 23.0, -78.0, -58.0);
    addFlatParapetZ(side * 14.4, -63.5, -58.0);
    addFlatParapetZ(side * 14.4, -78.0, -72.5);
  }

  // Ornamental lotus ceramic pots & ceremonial festival flags lining the front flat ochre parapet
  for (const fx of [-18.5, -13.2, -9.0, -4.6, 4.6, 9.0, 13.2, 18.5]) {
    const fz = Math.abs(fx) > 14.3 ? -58.4 : cz + gateDepth * 0.5 - 0.55;
    stoneParts.push(makeCylinder(0.36, 0.26, 0.48, 8, cx + fx, deckY + 0.24, fz));
    foliageParts.push(
      createSculptedRockGeometry(240 + Math.round(fx * 5), 0.44, 0.34, 0.44, 1).translate(cx + fx, deckY + 0.62, fz)
    );
    crimsonParts.push(new THREE.SphereGeometry(0.14, 6, 5).translate(cx + fx, deckY + 0.88, fz));
    // Slender wooden festival flagpole + crimson square ceremonial banner
    woodParts.push(makeCylinder(0.032, 0.04, 2.35, 6, cx + fx, deckY + 1.18, fz + 0.32));
    crimsonParts.push(makeBox(0.62, 0.56, 0.04, cx + fx + 0.32, deckY + 2.02, fz + 0.32));
    goldParts.push(makeBox(0.66, 0.06, 0.05, cx + fx + 0.32, deckY + 2.32, fz + 0.32));
  }

  // Readable carved "ĐOAN MÔN — 端門" imperial plaque above central Emperor portal (no anachronistic gold discs)
  const plaqueZ = cz + gateDepth * 0.5 + 0.16;
  const doanMonPlaque = createSignagePlaqueMesh(
    {
      text: 'ĐOAN MÔN — 端門',
      subText: 'HOÀNG THÀNH THĂNG LONG',
      style: 'stone',
      width: 4.1,
      height: 1.08,
      depth: 0.20
    },
    ctx
  );
  doanMonPlaque.name = 'DoanMonImperialPlaque';
  doanMonPlaque.position.set(cx, wallY + 5.32, plaqueZ);
  group.add(doanMonPlaque);

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

  // 3. Authentic Vọng Lâu Đoan Môn (Tiers 2-3): Mossy Ochre-Plaster Masonry, White Rosette-Lattice Windows,
  //    Yellow Pierced Brick Parapet & Double-Tiered Dark-Brown Tiled Roof with Slatted Timber Cổ Diêm
  const pavBaseY = deckY;
  const lowerH = 3.25;

  // Tier 2 main mossy ochre-plaster masonry block (16.8m x 3.25m x 4.8m) + plinth & cornice bands
  stoneParts.push(makeBox(17.2, 0.28, 5.2, cx, pavBaseY + 0.14, cz));
  ochrePlasterParts.push(makeBox(16.8, lowerH, 4.8, cx, pavBaseY + lowerH * 0.5, cz));
  ochrePlasterParts.push(makeBox(17.3, 0.26, 5.3, cx, pavBaseY + lowerH - 0.12, cz));
  // Subtle masonry corner & bay pilasters on Tier 2
  for (const pilX of [-8.25, -2.55, 2.55, 8.25]) {
    for (const zSide of [-1, 1]) {
      ochrePlasterParts.push(makeBox(0.36, lowerH, 0.18, cx + pilX, pavBaseY + lowerH * 0.5, cz + zSide * 2.44));
    }
  }

  // 3 large rectangular white rosette-lattice windows on both South & North facades of Tier 2
  for (const zSide of [-1, 1]) {
    const wz = cz + zSide * 2.46;
    for (const bx of [-5.2, 0.0, 5.2]) {
      const winW = 2.65;
      const winH = 1.92;
      const winY = pavBaseY + 1.62;
      // Recessed dark window interior
      voidParts.push(makeBox(winW - 0.18, winH - 0.18, 0.12, cx + bx, winY, wz - zSide * 0.02));
      // Crisp white plaster outer frame (sill, lintel, jambs)
      whitePlasterParts.push(
        makeBox(winW + 0.18, 0.14, 0.18, cx + bx, winY + winH * 0.5, wz + zSide * 0.02),
        makeBox(winW + 0.18, 0.14, 0.18, cx + bx, winY - winH * 0.5, wz + zSide * 0.02),
        makeBox(0.14, winH, 0.18, cx + bx - winW * 0.5, winY, wz + zSide * 0.02),
        makeBox(0.14, winH, 0.18, cx + bx + winW * 0.5, winY, wz + zSide * 0.02)
      );
      // Central 8-spoke white rosette tracery + flanking geometric lattice muntins
      const rosette = createRoseWindowGeometry(0.56, 8, 0.10);
      rosette.translate(cx + bx, winY, wz + zSide * 0.04);
      whitePlasterParts.push(rosette);
      for (const mx of [-0.88, 0.88]) {
        whitePlasterParts.push(makeBox(0.07, winH - 0.14, 0.08, cx + bx + mx, winY, wz + zSide * 0.03));
      }
      whitePlasterParts.push(
        makeBox(winW - 0.16, 0.07, 0.08, cx + bx, winY, wz + zSide * 0.03),
        makeBox(0.07, winH - 0.14, 0.08, cx + bx, winY, wz + zSide * 0.03)
      );
    }
  }
  // Side East/West rectangular white lattice windows on Tier 2
  for (const xSide of [-1, 1]) {
    const wx = cx + xSide * 8.45;
    const winY = pavBaseY + 1.62;
    voidParts.push(makeBox(0.12, 1.65, 1.95, wx - xSide * 0.02, winY, cz));
    whitePlasterParts.push(
      makeBox(0.16, 0.14, 2.2, wx + xSide * 0.02, winY + 0.86, cz),
      makeBox(0.16, 0.14, 2.2, wx + xSide * 0.02, winY - 0.86, cz),
      makeBox(0.16, 1.72, 0.14, wx + xSide * 0.02, winY, cz - 1.04),
      makeBox(0.16, 1.72, 0.14, wx + xSide * 0.02, winY, cz + 1.04),
      makeBox(0.08, 1.68, 0.07, wx + xSide * 0.03, winY, cz),
      makeBox(0.08, 0.07, 2.02, wx + xSide * 0.03, winY, cz)
    );
  }

  // Yellow pierced brick parapet (`hoa_chanh_ceramic`) framing the Tier 2 roof terrace
  const tier2TopY = pavBaseY + lowerH;
  ochrePlasterParts.push(
    ...createPiercedBalustradeParts(cx - 8.4, cz + 2.45, cx + 8.4, cz + 2.45, tier2TopY + 0.02, 0.78, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(cx - 8.4, cz - 2.45, cx + 8.4, cz - 2.45, tier2TopY + 0.02, 0.78, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(cx - 8.4, cz - 2.45, cx - 8.4, cz + 2.45, tier2TopY + 0.02, 0.78, 'hoa_chanh_ceramic'),
    ...createPiercedBalustradeParts(cx + 8.4, cz - 2.45, cx + 8.4, cz + 2.45, tier2TopY + 0.02, 0.78, 'hoa_chanh_ceramic')
  );

  for (const lx of [-6.8, -2.55, 2.55, 6.8]) {
    const ly = pavBaseY + lowerH - 0.52;
    const lz = cz + 2.75;
    lanternParts.push(createRibbedLanternShellGeometry(0.22, 0.32, 10, 6).translate(cx + lx, ly, lz));
    lanternCoreParts.push(createLanternCoreGeometry(0.13, 0.20).translate(cx + lx, ly, lz));
  }
  const vongLauLight = new THREE.PointLight('#ffca72', 1.6, 15, 1.5);
  vongLauLight.position.set(cx, pavBaseY + 2.15, cz + 3.1);
  group.add(vongLauLight);

  // Tier 3 ochre-plaster masonry upper block with central arch + 2 Chữ Thọ side vents
  const upperY = tier2TopY + 0.06;
  const upperH = 2.65;
  // Front & rear arched ochre walls + solid ochre side walls
  for (const zSide of [-1, 1]) {
    const frontArch = createArchedWallGeometry(10.8, upperH, 0.48, 2.15, 2.05);
    frontArch.translate(cx, upperY, cz + zSide * 1.52);
    ochrePlasterParts.push(frontArch);
    // White arched surround & keystone trim around central Tier 3 arch
    const archTrim = new THREE.TorusGeometry(1.12, 0.075, 6, 16, Math.PI);
    archTrim.translate(cx, upperY + 0.98, cz + zSide * 1.78);
    whitePlasterParts.push(archTrim);
    // 2 circular *Chữ Thọ* longevity vents flanking the central arch
    for (const bx of [-3.35, 3.35]) {
      const cy = upperY + 1.42;
      const wz = cz + zSide * 1.78;
      const discVoid = makeCylinder(0.58, 0.58, 0.12, 12, 0, 0, 0);
      discVoid.rotateX(Math.PI * 0.5);
      discVoid.translate(cx + bx, cy, wz - zSide * 0.02);
      voidParts.push(discVoid);
      const ring = new THREE.TorusGeometry(0.60, 0.07, 6, 16);
      ring.translate(cx + bx, cy, wz + zSide * 0.02);
      whitePlasterParts.push(ring);
      // Stylized Chữ Thọ geometric cross & inner square fretwork
      whitePlasterParts.push(
        makeBox(1.10, 0.06, 0.07, cx + bx, cy, wz + zSide * 0.03),
        makeBox(0.06, 1.10, 0.07, cx + bx, cy, wz + zSide * 0.03),
        makeBox(0.54, 0.055, 0.07, cx + bx, cy + 0.26, wz + zSide * 0.03),
        makeBox(0.54, 0.055, 0.07, cx + bx, cy - 0.26, wz + zSide * 0.03),
        makeBox(0.055, 0.54, 0.07, cx + bx - 0.26, cy, wz + zSide * 0.03),
        makeBox(0.055, 0.54, 0.07, cx + bx + 0.26, cy, wz + zSide * 0.03)
      );
    }
  }
  ochrePlasterParts.push(
    makeBox(0.48, upperH, 3.52, cx - 5.16, upperY + upperH * 0.5, cz),
    makeBox(0.48, upperH, 3.52, cx + 5.16, upperY + upperH * 0.5, cz),
    makeBox(11.3, 0.24, 3.9, cx, upperY + upperH - 0.08, cz)
  );
  voidParts.push(makeBox(9.4, upperH * 0.85, 2.4, cx, upperY + upperH * 0.45, cz));

  // Double-tiered dark-brown tiled roof (*mái chồng diêm*) with slatted timber *cổ diêm* clerestory!
  const lowerRoof = createVietnameseCurvedRoofGeometry(14.2, 6.2, 9.8, 3.6, 1.35, 0.36);
  lowerRoof.translate(cx, upperY + upperH + 0.02, cz);
  roofParts.push(lowerRoof);

  // Slatted dark timber *cổ diêm* clerestory band between the two dark-brown roof tiers
  const coDiemY = upperY + upperH + 1.18;
  const coDiemH = 0.88;
  voidParts.push(makeBox(8.9, coDiemH * 0.88, 2.9, cx, coDiemY + coDiemH * 0.48, cz));
  woodParts.push(
    makeBox(9.6, 0.14, 3.5, cx, coDiemY + 0.07, cz),
    makeBox(9.6, 0.14, 3.5, cx, coDiemY + coDiemH - 0.05, cz)
  );
  for (let sx = -4.4; sx <= 4.41; sx += 0.44) {
    for (const zSide of [-1, 1]) {
      woodParts.push(makeBox(0.08, coDiemH, 0.10, cx + sx, coDiemY + coDiemH * 0.5, cz + zSide * 1.62));
    }
  }
  for (let sz = -1.4; sz <= 1.41; sz += 0.46) {
    for (const xSide of [-1, 1]) {
      woodParts.push(makeBox(0.10, coDiemH, 0.08, cx + xSide * 4.65, coDiemY + coDiemH * 0.5, cz + sz));
    }
  }

  const upperRoof = createVietnameseCurvedRoofGeometry(12.0, 5.2, 4.8, 0.52, 2.05, 0.44);
  upperRoof.translate(cx, coDiemY + coDiemH + 0.02, cz);
  roofParts.push(upperRoof);

  // Weathered plaster/stone ridge finials atop Vọng Lâu (authentic, non-gaudy)
  const ridgeY = coDiemY + coDiemH + 2.06;
  stoneParts.push(makeBox(5.0, 0.22, 0.24, cx, ridgeY, cz));
  const doanFinials = createRoofFinialSetParts(cx, ridgeY + 0.06, cz, 5.0, 0, 0.92, false);
  stoneParts.push(...doanFinials.mainParts, ...doanFinials.goldParts);

  // 4. EXPANDED Nền Điện Kính Thiên (46.0m x 28.0m, z in [-112, -84]) with Front 9-Step & Rear 7-Step Thềm Rồng
  const ktZ = -98.0; // z in [-112, -84]
  const ktW = 46.0;
  const ktD = 28.0;
  const ktGroundY = ctx.getHeight(cx, ktZ);
  const ktTopY = Math.max(yBase + 2.45, ktGroundY + 2.45);
  const ktSkirtBot = Math.min(yBase, ktGroundY) - 2.6;
  const ktFullH = ktTopY - ktSkirtBot;

  // Paved *Long Trì* royal Bát Tràng brick approach between Đoan Môn (-72.5) and Điện Kính Thiên (-84.0)
  const courtY = ctx.getHeight(cx, -78.2);
  stoneParts.push(makeBox(22.0, 1.2, 12.2, cx, courtY - 0.52, -78.2));
  batTrangParts.push(makeBox(21.4, 0.08, 11.8, cx, courtY + 0.12, -78.2));
  // Monumental 46m x 28m stone foundation platform of Điện Kính Thiên + Bát Tràng brick terrace paving
  stoneParts.push(makeBox(ktW, ktFullH, ktD, cx, ktSkirtBot + ktFullH * 0.5, ktZ));
  batTrangParts.push(makeBox(ktW - 1.2, 0.08, ktD - 1.2, cx, ktTopY + 0.04, ktZ));
  // Fixed lower stone molding collar seated cleanly at ground level (ktGroundY + 0.28)
  stoneParts.push(makeBox(ktW + 1.2, 0.55, ktD + 1.2, cx, ktGroundY + 0.28, ktZ));

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
  // Exposed historic Lý–Trần palace column plinth grid + Open Royal Throne Pavilion (*Ngai Vàng & Cửu Long Bình Phong Điện Kính Thiên*)
  for (const px of [-16, -11, -6, 6, 11, 16]) {
    for (const pz of [-6.5, 2.5]) {
      stoneParts.push(makeBox(1.15, 0.32, 1.15, cx + px, ktTopY + 0.16, ktZ + pz));
      stoneParts.push(makeCylinder(0.42, 0.48, 0.18, 12, cx + px, ktTopY + 0.38, ktZ + pz));
    }
  }

  // Open 3-Bay Imperial Sanctum Pavilion (*Chính Điện Kính Thiên — Ngai Vàng Hoàng Đế & Bình Phong Cửu Long*) at rear of terrace (z = ktZ - 5.8)
  const sanctZ = ktZ - 5.8;
  // 3-Tier Stepped Crimson-and-Gold Dragon Throne Dais (*Bệ Ngai Vàng 3 tầng*)
  crimsonParts.push(
    makeBox(6.8, 0.32, 4.2, cx, ktTopY + 0.16, sanctZ),
    makeBox(4.8, 0.30, 3.1, cx, ktTopY + 0.47, sanctZ - 0.15),
    makeBox(3.0, 0.28, 2.1, cx, ktTopY + 0.76, sanctZ - 0.25)
  );
  goldParts.push(
    makeBox(6.92, 0.07, 4.32, cx, ktTopY + 0.33, sanctZ),
    makeBox(4.92, 0.07, 3.22, cx, ktTopY + 0.63, sanctZ - 0.15),
    makeBox(3.12, 0.07, 2.22, cx, ktTopY + 0.91, sanctZ - 0.25)
  );
  // Sculpted Imperial Golden Dragon Throne (*Ngai Vàng Hoàng Đế*) with Dragon-Head Armrests & Flame Halo Backrest
  const thY = ktTopY + 0.94;
  goldParts.push(
    makeBox(1.45, 0.48, 1.12, cx, thY + 0.24, sanctZ - 0.25),
    makeBox(1.38, 1.42, 0.16, cx, thY + 1.15, sanctZ - 0.72),
    makeCylinder(0.46, 0.46, 0.16, 10, cx, thY + 1.92, sanctZ - 0.72, Math.PI * 0.5, 0, 0)
  );
  crimsonParts.push(makeBox(1.22, 0.10, 0.96, cx, thY + 0.51, sanctZ - 0.22));
  for (const sx of [-0.68, 0.68]) {
    goldParts.push(
      makeBox(0.16, 0.48, 1.05, cx + sx, thY + 0.68, sanctZ - 0.22),
      new THREE.SphereGeometry(0.14, 7, 6).translate(cx + sx, thY + 0.95, sanctZ + 0.32)
    );
  }
  // 5-Panel Gilded Nine-Dragon Folding Screen (*Bình Phong Cửu Long*) behind the Emperor's Throne
  for (let p = -2; p <= 2; p++) {
    const pYaw = -p * 0.16;
    const pxOff = p * 1.16;
    const pzOff = sanctZ - 1.55 + Math.abs(p) * 0.16;
    const pH = 2.85 - Math.abs(p) * 0.18;
    crimsonParts.push(makeBox(1.08, pH, 0.12, cx + pxOff, ktTopY + 0.32 + pH * 0.5, pzOff, pYaw));
    goldParts.push(
      makeBox(1.16, pH + 0.12, 0.08, cx + pxOff, ktTopY + 0.32 + pH * 0.5, pzOff - 0.02, pYaw),
      new THREE.TorusGeometry(0.32, 0.05, 5, 10).translate(cx + pxOff, ktTopY + 0.55 + pH * 0.5, pzOff + 0.07)
    );
  }
  // 8 Crimson Ironwood Palace Columns with Coiled Golden Dragons (*Tứ Trụ Rồng Cuốn Cột*) & 2-Tier Imperial Yellow-Gold Roof Canopy (*Bửu Tán & Mái Hoàng Lưu Ly*)
  const colPositions: Array<[number, number, boolean]> = [
    [-5.8, sanctZ + 2.4, false],
    [-2.4, sanctZ + 2.4, true],
    [2.4, sanctZ + 2.4, true],
    [5.8, sanctZ + 2.4, false],
    [-5.8, sanctZ - 2.4, false],
    [-2.4, sanctZ - 2.4, true],
    [2.4, sanctZ - 2.4, true],
    [5.8, sanctZ - 2.4, false]
  ];
  for (const [colX, colZ, hasDragon] of colPositions) {
    stoneParts.push(makeCylinder(0.36, 0.44, 0.34, 10, cx + colX, ktTopY + 0.17, colZ));
    crimsonParts.push(makeCylinder(0.24, 0.28, 4.8, 10, cx + colX, ktTopY + 2.72, colZ));
    if (hasDragon) {
      // Spiraling golden dragon wrapped around the inner imperial columns (*Rồng vàng cuốn cột*)
      const coilPts: THREE.Vector3[] = [];
      for (let c = 0; c <= 12; c++) {
        const ct = c / 12;
        const ca = ct * Math.PI * 3.5 + (colX > 0 ? Math.PI : 0);
        coilPts.push(
          new THREE.Vector3(
            cx + colX + Math.cos(ca) * 0.31,
            ktTopY + 0.85 + ct * 3.6,
            colZ + Math.sin(ca) * 0.31
          )
        );
      }
      goldParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 14, 0.075, 5, false));
    }
  }
  // Overhead Gilded Embroidered *Bửu Tán* Canopy + Open Double-Tier Curved Palace Roof with *Lưỡng Long Chầu Nguyệt*
  goldParts.push(makeCylinder(1.85, 2.25, 0.48, 8, cx, ktTopY + 4.45, sanctZ - 0.25));
  crimsonParts.push(
    makeBox(12.4, 0.28, 0.28, cx, ktTopY + 5.05, sanctZ + 2.4),
    makeBox(12.4, 0.28, 0.28, cx, ktTopY + 5.05, sanctZ - 2.4)
  );
  const ktLowerRoof = createVietnameseCurvedRoofGeometry(15.2, 7.8, 10.6, 3.8, 1.55, 0.42);
  ktLowerRoof.translate(cx, ktTopY + 5.15, sanctZ);
  const ktUpperRoof = createVietnameseCurvedRoofGeometry(12.2, 5.8, 6.2, 0.6, 1.85, 0.48);
  ktUpperRoof.translate(cx, ktTopY + 6.95, sanctZ);
  roofParts.push(ktLowerRoof, ktUpperRoof);
  const ktRoofFinials = createRoofFinialSetParts(cx, ktTopY + 8.85, sanctZ, 6.2, 0, 1.05, true);
  goldParts.push(...ktRoofFinials.mainParts, ...ktRoofFinials.goldParts);

  // 5. Cột Cờ Hà Nội (Hanoi Flag Tower, 33.4m tall) at (38, -76)
  const hftX = 38.0;
  const hftZ = -76.0;
  const hftY = ctx.getHeight(hftX, hftZ);
  const hftSkirt = 2.0;

  // 3 diminishing sloped Vauban frustum brick bastion tiers (3.2m + 3.8m + 4.2m = 11.2m)
  const bastionTiers = [
    { botW: 14.8, topW: 13.6, h: 3.2, y0: hftY, hasPortals: false },
    { botW: 11.4, topW: 10.4, h: 3.8, y0: hftY + 3.2, hasPortals: true },
    { botW: 8.4, topW: 7.5, h: 4.2, y0: hftY + 7.0, hasPortals: true }
  ];
  for (let ti = 0; ti < bastionTiers.length; ti++) {
    const bt = bastionTiers[ti];
    const extraBot = ti === 0 ? hftSkirt : 0;
    const totalH = bt.h + extraBot;
    const extraSpread = ti === 0 ? ((bt.botW - bt.topW) / bt.h) * extraBot : 0;
    const topR = bt.topW / Math.SQRT2;
    const botR = (bt.botW + extraSpread) / Math.SQRT2;
    // Sloped Vauban 4-sided frustum rotated PI/4 so faces align cleanly with N/S/E/W
    brickParts.push(
      makeCylinder(topR, botR, totalH, 4, hftX, bt.y0 - extraBot + totalH * 0.5, hftZ, 0, 0, Math.PI * 0.25)
    );
    // Bold projecting stone cornice coping + pierced brick parapet (`hoa_chanh_ceramic`) around each bastion tier
    stoneParts.push(makeBox(bt.topW + 0.56, 0.34, bt.topW + 0.56, hftX, bt.y0 + bt.h + 0.12, hftZ));
    const hw = bt.topW * 0.5 - 0.14;
    const parY = bt.y0 + bt.h + 0.28;
    brickParts.push(
      ...createPiercedBalustradeParts(hftX - hw, hftZ + hw, hftX + hw, hftZ + hw, parY, 0.86, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(hftX - hw, hftZ - hw, hftX + hw, hftZ - hw, parY, 0.86, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(hftX - hw, hftZ - hw, hftX - hw, hftZ + hw, parY, 0.86, 'hoa_chanh_ceramic'),
      ...createPiercedBalustradeParts(hftX + hw, hftZ - hw, hftX + hw, hftZ + hw, parY, 0.86, 'hoa_chanh_ceramic')
    );

    // Arched recessed portals ONLY on South ("Hướng Minh"), East ("Nghênh Húc"), West ("Hồi Quang") — North closed!
    if (bt.hasPortals) {
      const pAw = ti === 1 ? 2.15 : 1.65;
      const pAh = ti === 1 ? 2.6 : 2.3;
      const midHalfW = (bt.botW + bt.topW) * 0.25;
      for (const ang of [0, Math.PI * 0.5, -Math.PI * 0.5]) {
        const portalFrame = createArchedWallGeometry(pAw + 1.15, pAh + 0.72, 0.52, pAw, pAh);
        portalFrame.translate(0, 0, midHalfW + 0.12);
        portalFrame.rotateY(ang);
        portalFrame.translate(hftX, bt.y0 + 0.12, hftZ);
        brickParts.push(portalFrame);

        const portalVoid = makeBox(pAw * 0.86, pAh * 0.84, 0.26, 0, pAh * 0.44, midHalfW - 0.02);
        portalVoid.rotateY(ang);
        portalVoid.translate(hftX, bt.y0 + 0.12, hftZ);
        voidParts.push(portalVoid);
      }
    }
  }
  // Readable "CỘT CỜ HÀ NỘI" plaque above Tier 2 South portal
  const hftPlaque = createSignagePlaqueMesh(
    {
      text: 'CỘT CỜ HÀ NỘI',
      subText: 'KỲ ĐÀI — 1812',
      style: 'stone',
      width: 3.0,
      height: 0.84,
      depth: 0.16
    },
    ctx
  );
  hftPlaque.name = 'HanoiFlagTowerPlaque';
  hftPlaque.position.set(hftX, hftY + 6.45, hftZ + 5.42);
  group.add(hftPlaque);

  // 18.2m tapered octagonal brick shaft (y + 11.2m -> y + 29.4m) with fan windows at base & 36 8-spoke rosette vents
  const hftShaftBaseY = hftY + 11.2;
  const hftShaftH = 18.2;
  const hftShaftTopY = hftShaftBaseY + hftShaftH; // hftY + 29.4m
  brickParts.push(makeCylinder(1.98, 2.68, hftShaftH, 8, hftX, hftShaftBaseY + hftShaftH * 0.5, hftZ));

  // Fan-shaped windows (*cửa sổ hình quạt*) around lower base of octagonal shaft
  const fanY = hftShaftBaseY + 1.45;
  const fanRAtY = THREE.MathUtils.lerp(2.68, 1.98, 0.08) * Math.cos(Math.PI / 8);
  for (let f = 0; f < 8; f += 2) {
    const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
    const fx = hftX + Math.sin(ang) * (fanRAtY + 0.04);
    const fz = hftZ + Math.cos(ang) * (fanRAtY + 0.04);
    const fanRim = new THREE.TorusGeometry(0.42, 0.065, 6, 12, Math.PI);
    fanRim.rotateY(ang);
    fanRim.translate(fx, fanY, fz);
    stoneParts.push(fanRim);
    const fanSill = makeBox(0.92, 0.09, 0.14, 0, 0, 0);
    fanSill.rotateY(ang);
    fanSill.translate(fx, fanY - 0.04, fz);
    stoneParts.push(fanSill);
    const fanVoid = new THREE.CylinderGeometry(0.38, 0.38, 0.10, 10, 1, false, 0, Math.PI);
    fanVoid.rotateZ(-Math.PI * 0.5);
    fanVoid.rotateY(ang + Math.PI * 0.5);
    fanVoid.translate(fx - Math.sin(ang) * 0.02, fanY, fz - Math.cos(ang) * 0.02);
    voidParts.push(fanVoid);
  }

  // 36 8-spoke rosette vents climbing the 8 shaft faces (replaces plain pentagon holes)
  for (let level = 0; level < 5; level++) {
    const frac = 0.19 + level * 0.165;
    const vy = hftShaftBaseY + hftShaftH * frac;
    const rAtY = THREE.MathUtils.lerp(2.68, 1.98, frac) * Math.cos(Math.PI / 8);
    for (let f = 0; f < 8; f++) {
      if (level === 4 && f % 2 === 1) continue; // 36 rosette apertures total
      const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
      const vx = hftX + Math.sin(ang) * (rAtY + 0.04);
      const vz = hftZ + Math.cos(ang) * (rAtY + 0.04);

      const rosette = createRoseWindowGeometry(0.32, 8, 0.14);
      rosette.scale(0.82, 0.82, 1.0);
      rosette.rotateY(ang);
      rosette.translate(vx, vy, vz);
      stoneParts.push(rosette);

      const hole = makeCylinder(0.28, 0.28, 0.10, 10, 0, 0, 0);
      hole.rotateX(Math.PI * 0.5);
      hole.rotateY(ang);
      hole.translate(vx - Math.sin(ang) * 0.02, vy, vz - Math.cos(ang) * 0.02);
      voidParts.push(hole);
    }
  }

  // Top octagonal watchtower (hftY + 29.4m -> hftY + 33.4m): enclosed octagonal brick room
  // with 8 dark shuttered windows + flared white-plaster roof eaves (NOT 8 empty pillars!)
  stoneParts.push(makeCylinder(2.68, 2.22, 0.50, 8, hftX, hftShaftTopY + 0.25, hftZ));
  const pavY = hftShaftTopY + 0.50;
  const pavH = 2.60;
  brickParts.push(makeCylinder(2.38, 2.42, pavH, 8, hftX, pavY + pavH * 0.5, hftZ));
  const watchApothem = 2.40 * Math.cos(Math.PI / 8);
  for (let f = 0; f < 8; f++) {
    const ang = (f / 8) * Math.PI * 2 + Math.PI / 8;
    const wx = hftX + Math.sin(ang) * (watchApothem + 0.03);
    const wz = hftZ + Math.cos(ang) * (watchApothem + 0.03);
    const winY = pavY + pavH * 0.52;
    // Recessed dark shuttered window + wooden louver slats + crisp white plaster sill & lintel
    const winVoid = makeBox(0.82, 1.32, 0.10, 0, 0, 0);
    winVoid.rotateY(ang);
    winVoid.translate(wx, winY, wz);
    voidParts.push(winVoid);

    for (const sx of [-0.43, 0.43]) {
      const jamb = makeBox(0.08, 1.42, 0.14, sx, 0, 0.02);
      jamb.rotateY(ang);
      jamb.translate(wx, winY, wz);
      woodParts.push(jamb);
    }
    for (let sl = -2; sl <= 2; sl++) {
      const slat = makeBox(0.76, 0.06, 0.12, 0, sl * 0.22, 0.02);
      slat.rotateY(ang);
      slat.translate(wx, winY, wz);
      woodParts.push(slat);
    }
    for (const sy of [-0.72, 0.72]) {
      const trim = makeBox(1.02, 0.10, 0.18, 0, sy, 0.04);
      trim.rotateY(ang);
      trim.translate(wx, winY, wz);
      whitePlasterParts.push(trim);
    }
  }
  // Flared white-plaster octagonal roof eaves & stepped white cap reaching 33.4m
  whitePlasterParts.push(makeCylinder(2.58, 3.42, 0.46, 8, hftX, pavY + pavH + 0.22, hftZ));
  whitePlasterParts.push(makeCylinder(1.75, 2.62, 0.48, 8, hftX, pavY + pavH + 0.68, hftZ));

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

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'HoangThanhStoneBase', true, true, 2.6);
  addMergedMesh(
    group,
    brickParts,
    ctx.materials.weatheredImperialBrick ?? ctx.materials.stone,
    'HoangThanhCitadelBrick',
    true,
    true,
    2.4
  );
  addMergedMesh(
    group,
    ochrePlasterParts,
    ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster,
    'HoangThanhDoanMonOchrePlaster',
    true,
    true,
    2.6
  );
  addMergedMesh(group, whitePlasterParts, ctx.materials.whitePlaster, 'HoangThanhWhitePlasterTrim');
  addMergedMesh(
    group,
    batTrangParts,
    ctx.materials.batTrangFloor ?? ctx.materials.stone,
    'HoangThanhBatTrangCourtyard',
    false,
    true,
    1.6
  );
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'HoangThanhCrimsonColumns');
  addMergedMesh(group, roofParts, ctx.materials.darkRoof, 'HoangThanhCurvedRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'HoangThanhGoldTrim');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'HoangThanhTimberDoors');
  addMergedMesh(
    group,
    bronzeParts,
    ctx.materials.bronzePatina ?? ctx.materials.bronze,
    'HoangThanhBronzeRelics'
  );
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

  const lungCuRedBandMat = new THREE.MeshStandardMaterial({
    color: '#7a261f',
    map: ctx.pbr.plaster.map,
    normalMap: ctx.pbr.plaster.normalMap,
    roughness: 0.72,
    metalness: 0.06
  });
  ctx.extraMaterials.push(lungCuRedBandMat);

  const dongSonTex = ctx.cachedTextures?.dongSon;
  const dongSonMedallionMat = new THREE.MeshStandardMaterial({
    color: dongSonTex ? '#d4b36a' : '#a87d35',
    map: dongSonTex?.map ?? null,
    normalMap: dongSonTex?.normalMap ?? null,
    roughnessMap: dongSonTex?.roughnessMap ?? null,
    roughness: 0.34,
    metalness: 0.78
  });
  ctx.extraMaterials.push(dongSonMedallionMat);

  const whiteGlobeMat = new THREE.MeshStandardMaterial({
    color: '#f6f7fa',
    emissive: '#fff2d0',
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.05
  });
  ctx.extraMaterials.push(whiteGlobeMat);

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
  const redBandParts: THREE.BufferGeometry[] = [];
  const dongSonDiscParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];
  const globeLampParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];
  const pondWaterParts: THREE.BufferGeometry[] = [];
  const ochreParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const darkRoofParts: THREE.BufferGeometry[] = [];
  const buckwheatParts: THREE.BufferGeometry[] = [];
  const foliageParts: THREE.BufferGeometry[] = [];

  // 1. Expanded 3-tier octagonal limestone citadel base (rotated PI/8 so face i=0 aligns directly to 45 deg SE stair!)
  const octRotY = Math.PI / 8;
  const skirtDepth = 6.5;
  const tier1H = 1.25;
  const tier2H = 1.05;
  const tier3H = 0.90;

  stoneParts.push(
    makeCylinder(13.4, 14.0, tier1H + skirtDepth, 8, cx, yBase + (tier1H - skirtDepth) * 0.5, cz, 0, 0, octRotY)
  );
  graniteParts.push(
    makeCylinder(10.0, 10.6, tier2H, 8, cx, yBase + tier1H + tier2H * 0.5, cz, 0, 0, octRotY)
  );
  stoneParts.push(
    makeCylinder(6.8, 7.25, tier3H, 8, cx, yBase + tier1H + tier2H + tier3H * 0.5, cz, 0, 0, octRotY)
  );

  // Clean modern grey-stone parapet + white globe lamps around Tier 1 terrace (replaces anachronistic lotus_stone)
  const balR = 12.75;
  const balY = yBase + tier1H;
  const addModernParapetSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return;
    const rot = Math.atan2(dx, dz);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    stoneParts.push(makeBox(0.32, 0.86, len, mx, balY + 0.43, mz, rot));
    graniteParts.push(makeBox(0.40, 0.12, len + 0.06, mx, balY + 0.90, mz, rot));
  };
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const x0 = cx + Math.cos(a0) * balR;
    const z0 = cz + Math.sin(a0) * balR;
    const x1 = cx + Math.cos(a1) * balR;
    const z1 = cz + Math.sin(a1) * balR;
    // Modern grey-stone corner lamp pier + glowing white globe lamp
    graniteParts.push(makeBox(0.54, 1.24, 0.54, x0, balY + 0.62, z0, -a0));
    steelParts.push(makeCylinder(0.05, 0.06, 0.26, 8, x0, balY + 1.35, z0));
    globeLampParts.push(new THREE.SphereGeometry(0.24, 10, 8).translate(x0, balY + 1.62, z0));

    // Leave SE staircase entrance edge (i === 0, centered at +PI/4) cleanly open
    if (i === 0) {
      const mx0 = THREE.MathUtils.lerp(x0, x1, 0.24);
      const mz0 = THREE.MathUtils.lerp(z0, z1, 0.24);
      const mx1 = THREE.MathUtils.lerp(x0, x1, 0.76);
      const mz1 = THREE.MathUtils.lerp(z0, z1, 0.76);
      addModernParapetSeg(x0, z0, mx0, mz0);
      addModernParapetSeg(mx1, mz1, x1, z1);
    } else {
      addModernParapetSeg(x0, z0, x1, z1);
    }
  }

  // Stepped granite approach stairway descending SE slope (-6.5m skirt) with flanking white globe lamps
  const stairDirX = 0.7071;
  const stairDirZ = 0.7071;
  const stairRotY = Math.atan2(stairDirX, stairDirZ); // Math.PI / 4
  const stairSteps = 20;
  for (let s = 0; s < stairSteps; s++) {
    const dist = 6.8 + s * 0.94;
    const sx = cx + stairDirX * dist;
    const sz = cz + stairDirZ * dist;
    const sy = THREE.MathUtils.lerp(
      yBase + 3.05,
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
      if (s === 4 || s === 10 || s === 16) {
        const lx = sx + cxOff;
        const lz = sz + czOff;
        const ly = sy + 0.72;
        steelParts.push(makeCylinder(0.045, 0.055, 0.42, 8, lx, ly + 0.21, lz));
        globeLampParts.push(new THREE.SphereGeometry(0.21, 8, 6).translate(lx, ly + 0.54, lz));
      }
    }
  }

  // Grounded green-stone sovereignty stele with golden National Emblem right at the SE stair landing
  const steleDist = 11.4;
  const steleSide = -3.45; // perched on Tier-1 terrace left of SE stair landing
  const steleX = cx + stairDirX * steleDist + Math.cos(stairRotY) * steleSide;
  const steleZ = cz + stairDirZ * steleDist - Math.sin(stairRotY) * steleSide;
  const steleY = balY;
  const steleBaseBot = Math.min(steleY - 1.2, ctx.getHeight(steleX, steleZ) - 1.5);
  const steleBaseH = steleY - steleBaseBot + 0.45;
  greenStoneParts.push(
    makeBox(2.85, steleBaseH, 1.15, steleX, steleBaseBot + steleBaseH * 0.5, steleZ, stairRotY)
  );
  greenStoneParts.push(makeBox(2.45, 2.55, 0.48, steleX, steleY + 1.72, steleZ, stairRotY));
  graniteParts.push(makeBox(2.68, 0.22, 0.64, steleX, steleY + 3.08, steleZ, stairRotY));
  // Golden circular National Emblem (*Quốc huy*) mounted at crown of sovereignty stele
  const embPos = new THREE.Vector3(0, steleY + 2.58, 0.28)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), stairRotY)
    .add(new THREE.Vector3(steleX, 0, steleZ));
  const embDisc = makeCylinder(0.36, 0.36, 0.08, 16, 0, 0, 0);
  embDisc.rotateX(Math.PI * 0.5);
  embDisc.rotateY(stairRotY);
  embDisc.translate(embPos.x, embPos.y, embPos.z);
  goldParts.push(embDisc);
  const embRim = new THREE.TorusGeometry(0.38, 0.045, 6, 16);
  embRim.rotateY(stairRotY);
  embRim.translate(embPos.x, embPos.y, embPos.z);
  goldParts.push(embRim);
  const lcPlaque = createSignagePlaqueMesh(
    {
      text: 'CỘT CỜ LŨNG CÚ',
      subText: 'CỰC BẮC TỔ QUỐC — HÀ GIANG',
      style: 'stone_relief',
      width: 2.25,
      height: 1.15,
      depth: 0.08
    },
    ctx
  );
  lcPlaque.name = 'LungCuSovereigntyPlaque';
  const stelePlaquePos = new THREE.Vector3(0, steleY + 1.48, 0.26)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), stairRotY)
    .add(new THREE.Vector3(steleX, 0, steleZ));
  lcPlaque.position.copy(stelePlaquePos);
  lcPlaque.rotation.y = stairRotY;
  group.add(lcPlaque);

  // 2. Authentic 45-degree sloped octagonal frustum pedestal clad with 8 green-stone bas-relief panels
  //    -> topped by deep terracotta-red octagonal band (#7a261f) with 8 Đông Sơn bronze drum medallions!
  const pedTopY = yBase + tier1H + tier2H + tier3H; // yBase + 3.2m
  const frustumH = 2.80;
  const frustumBotR = 6.30;
  const frustumTopR = 3.55;
  const frustumTopY = pedTopY + frustumH;
  const frustumMidApothem = ((frustumBotR + frustumTopR) * 0.5) * Math.cos(Math.PI / 8);
  const frustumTilt = Math.atan2((frustumBotR - frustumTopR) * Math.cos(Math.PI / 8), frustumH);

  greenStoneParts.push(
    makeCylinder(frustumTopR, frustumBotR, frustumH, 8, cx, pedTopY + frustumH * 0.5, cz, 0, 0, octRotY)
  );
  // Crisp stone cornice cap separating the 45-degree frustum from the red Đông Sơn band
  stoneParts.push(
    makeCylinder(frustumTopR + 0.14, frustumTopR + 0.22, 0.28, 8, cx, frustumTopY + 0.10, cz, 0, 0, octRotY)
  );

  // Deep terracotta-red octagonal band (#7a261f) wrapping the lower shaft
  const redBandY0 = frustumTopY + 0.22;
  const redBandH = 2.40;
  const redBandTopY = redBandY0 + redBandH;
  const redBandBotR = 3.38;
  const redBandTopR = 3.26;
  redBandParts.push(
    makeCylinder(redBandTopR, redBandBotR, redBandH, 8, cx, redBandY0 + redBandH * 0.5, cz, 0, 0, octRotY)
  );
  stoneParts.push(
    makeCylinder(redBandTopR + 0.10, redBandTopR + 0.14, 0.20, 8, cx, redBandTopY + 0.08, cz, 0, 0, octRotY)
  );

  const redBandApothem = ((redBandBotR + redBandTopR) * 0.5) * Math.cos(Math.PI / 8);

  for (let i = 0; i < 8; i++) {
    // Face i = 0 aligns directly to 45 deg (Math.PI / 4) SE stair axis!
    const ang = Math.PI * 0.25 + (i / 8) * Math.PI * 2;
    const rot = Math.PI * 0.5 - ang;

    // 8 Đông Sơn bronze drum medallions mounted on every face of the terracotta-red octagonal band
    const mx = cx + Math.cos(ang) * (redBandApothem + 0.05);
    const mz = cz + Math.sin(ang) * (redBandApothem + 0.05);
    const my = redBandY0 + redBandH * 0.5;
    const drumDisc = new THREE.CylinderGeometry(0.84, 0.84, 0.12, 18);
    drumDisc.rotateX(Math.PI * 0.5);
    drumDisc.rotateY(rot);
    drumDisc.translate(mx, my, mz);
    dongSonDiscParts.push(drumDisc);

    const drumRim = new THREE.TorusGeometry(0.84, 0.055, 6, 18);
    drumRim.rotateY(rot);
    drumRim.translate(cx + Math.cos(ang) * (redBandApothem + 0.10), my, cz + Math.sin(ang) * (redBandApothem + 0.10));
    bronzeParts.push(drumRim);

    if (i === 0) {
      // Ground-floor arched entrance portal aligned straight to the 45 deg SE staircase!
      const doorDist = frustumMidApothem + 0.45;
      const doorX = cx + Math.cos(ang) * doorDist;
      const doorZ = cz + Math.sin(ang) * doorDist;
      const doorFrame = createArchedWallGeometry(2.35, 2.75, 0.85, 1.42, 2.15);
      doorFrame.rotateY(rot);
      doorFrame.translate(doorX, pedTopY, doorZ);
      stoneParts.push(doorFrame);
      const doorVoid = makeBox(1.36, 2.08, 0.36, 0, 1.04, 0);
      doorVoid.rotateY(rot);
      doorVoid.translate(cx + Math.cos(ang) * (doorDist - 0.14), pedTopY, cz + Math.sin(ang) * (doorDist - 0.14));
      voidParts.push(doorVoid);
      continue;
    }

    // Green-stone historical bas-relief panel tilted flush onto each sloped frustum face
    const reliefPanel = createSignagePlaqueMesh(
      {
        text: '',
        style: 'stone_relief',
        motifSeed: 700 + i * 17,
        width: 2.65,
        height: 2.25,
        depth: 0.10
      },
      ctx
    );
    reliefPanel.name = `LungCuStoneRelief_${i}`;
    reliefPanel.position.set(
      cx + Math.cos(ang) * (frustumMidApothem + 0.04),
      pedTopY + frustumH * 0.5,
      cz + Math.sin(ang) * (frustumMidApothem + 0.04)
    );
    reliefPanel.rotation.set(0, rot, 0);
    reliefPanel.rotateX(-frustumTilt);
    group.add(reliefPanel);
  }

  // 3. Monumental octagonal granite tower shaft (clean masonry without invented bronze rings)
  //    with recessed vertical rectangular ventilation slots & geometric grilles
  const shaftBotY = redBandTopY + 0.16;
  const shaftTopY = yBase + 21.0;
  const shaftH = shaftTopY - shaftBotY;
  const shaftBotR = 3.06;
  const shaftTopR = 2.34;
  graniteParts.push(
    makeCylinder(shaftTopR, shaftBotR, shaftH, 8, cx, shaftBotY + shaftH * 0.5, cz, 0, 0, octRotY)
  );

  // Recessed vertical rectangular ventilation slots with geometric grilles up all 8 shaft faces
  for (const frac of [0.20, 0.44, 0.68, 0.88]) {
    const vy = shaftBotY + shaftH * frac;
    const faceR = THREE.MathUtils.lerp(shaftBotR, shaftTopR, frac) * Math.cos(Math.PI / 8);
    for (let f = 0; f < 8; f++) {
      const ang = Math.PI * 0.25 + (f / 8) * Math.PI * 2;
      const rot = Math.PI * 0.5 - ang;
      const vx = cx + Math.cos(ang) * (faceR + 0.02);
      const vz = cz + Math.sin(ang) * (faceR + 0.02);

      // Recessed dark rectangular slot
      const slotVoid = makeBox(0.42, 1.18, 0.08, 0, 0, 0);
      slotVoid.rotateY(rot);
      slotVoid.translate(vx, vy, vz);
      voidParts.push(slotVoid);

      // Flush stone trim surround (left/right jambs + top/bottom headers) + geometric grille bars
      for (const sx of [-0.24, 0.24]) {
        const jamb = makeBox(0.07, 1.28, 0.12, sx, 0, 0.02);
        jamb.rotateY(rot);
        jamb.translate(vx, vy, vz);
        stoneParts.push(jamb);
      }
      for (const sy of [-0.61, 0.61]) {
        const cap = makeBox(0.55, 0.08, 0.12, 0, sy, 0.02);
        cap.rotateY(rot);
        cap.translate(vx, vy, vz);
        stoneParts.push(cap);
      }
      // Geometric grille: 1 central vertical mullion + 3 horizontal bars
      const vGrille = makeBox(0.04, 1.16, 0.06, 0, 0, 0.03);
      vGrille.rotateY(rot);
      vGrille.translate(vx, vy, vz);
      stoneParts.push(vGrille);
      for (const gy of [-0.30, 0, 0.30]) {
        const hGrille = makeBox(0.42, 0.04, 0.06, 0, gy, 0.03);
        hGrille.rotateY(rot);
        hGrille.translate(vx, vy, vz);
        stoneParts.push(hGrille);
      }
    }
  }

  // Authentic 24-sided CIRCULAR concrete observation deck & white/stainless circular pipe railing at +21.0m
  stoneParts.push(makeCylinder(4.35, 3.65, 0.62, 24, cx, shaftTopY - 0.15, cz));
  graniteParts.push(makeCylinder(4.42, 4.38, 0.14, 24, cx, shaftTopY + 0.14, cz));
  const railY = shaftTopY + 0.20;
  const railR = 4.10;
  for (const hOff of [0.34, 0.72, 1.12]) {
    const pipeRing = new THREE.TorusGeometry(railR, 0.038, 6, 24);
    pipeRing.rotateX(Math.PI * 0.5);
    pipeRing.translate(cx, railY + hOff, cz);
    steelParts.push(pipeRing);
  }
  for (let p = 0; p < 16; p++) {
    const a = (p / 16) * Math.PI * 2;
    steelParts.push(
      makeCylinder(0.034, 0.038, 1.14, 6, cx + Math.cos(a) * railR, railY + 0.57, cz + Math.sin(a) * railR)
    );
  }
  // Twin sightseeing binoculars on circular observation deck
  for (const bAng of [0.35, -1.2]) {
    const bx = cx + Math.cos(bAng) * 3.35;
    const bz = cz + Math.sin(bAng) * 3.35;
    steelParts.push(makeCylinder(0.06, 0.09, 1.25, 8, bx, railY + 0.62, bz));
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
    // Recessed doorway & windows: cVoid sits strictly BEHIND protruding 4-sided cWood frames (zero clip!)
    const fz = cot.d * 0.5;
    cVoid.push(makeBox(1.06, 1.86, 0.06, 0, 1.32, fz + 0.02));
    cWood.push(
      makeBox(0.14, 2.02, 0.16, -0.60, 1.38, fz + 0.06),
      makeBox(0.14, 2.02, 0.16, 0.60, 1.38, fz + 0.06),
      makeBox(1.38, 0.16, 0.18, 0, 2.34, fz + 0.07),
      makeBox(1.34, 0.10, 0.16, 0, 0.40, fz + 0.06)
    );
    for (const sx of [-1, 1]) {
      const wx = sx * (cot.w * 0.30);
      cVoid.push(makeBox(0.68, 0.68, 0.06, wx, 1.82, fz + 0.02));
      cWood.push(
        makeBox(0.11, 0.88, 0.14, wx - 0.39, 1.82, fz + 0.05),
        makeBox(0.11, 0.88, 0.14, wx + 0.39, 1.82, fz + 0.05),
        makeBox(0.92, 0.11, 0.16, wx, 2.24, fz + 0.06),
        makeBox(0.92, 0.11, 0.16, wx, 1.40, fz + 0.06),
        makeBox(0.05, 0.68, 0.08, wx, 1.82, fz + 0.06)
      );
    }
    // Exposed timber eave purlins & rafter tail brackets supporting the roof overhang
    for (const zSide of [-1, 1]) {
      cWood.push(makeBox(cot.w + 1.1, 0.14, 0.16, 0, 3.08, zSide * (fz + 0.32)));
      for (let rx = -cot.w * 0.45; rx <= cot.w * 0.46; rx += 0.95) {
        cWood.push(makeBox(0.10, 0.12, 0.72, rx, 3.12, zSide * (fz + 0.22)));
      }
    }
    // Dark yin-yang tiled pitched roof with gentle overhang
    const cotRoof = createGableRoofGeometry(cot.w + 1.45, cot.d + 1.55, 1.78, 0.18, 'x');
    cotRoof.translate(0, 3.16, 0);
    cRoof.push(cotRoof);
    // Uneven jagged cat-ear stacked-stone boundary wall (*tường đá tai mèo*) flanking yard
    const wallSpan = cot.w + 2.8;
    const rockCount = 11;
    for (let r = 0; r < rockCount; r++) {
      const t = r / (rockCount - 1);
      const rx = THREE.MathUtils.lerp(-wallSpan * 0.5, wallSpan * 0.5, t);
      const rh = 0.72 + ((r * 37) % 5) * 0.09;
      const rw = 0.46 + ((r * 19) % 3) * 0.08;
      const rd = 0.24 + ((r * 13) % 3) * 0.06;
      const rockBlock = createSculptedRockGeometry(
        900 + r * 17 + Math.round(cot.x * 3),
        rw,
        rh * 0.55,
        rd,
        1
      );
      rockBlock.translate(rx, 0.38 + rh * 0.38, fz + 1.65 + ((r % 3) - 1) * 0.05);
      cStone.push(rockBlock);
    }

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

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'LungCuCitadelStone', true, true, 2.6);
  addMergedMesh(group, graniteParts, ctx.materials.granite, 'LungCuTowerGranite', true, true, 2.4);
  addMergedMesh(group, greenStoneParts, greenStoneMat, 'LungCuDongSonStoneReliefs', true, true, 2.2);
  addMergedMesh(group, redBandParts, lungCuRedBandMat, 'LungCuTerracottaRedBand');
  addMergedMesh(group, dongSonDiscParts, dongSonMedallionMat, 'LungCuDongSonDrumMedallions');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'LungCuDongSonBronze');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'LungCuNationalEmblemGold');
  addMergedMesh(group, steelParts, stainlessMat, 'LungCuFlagstaff');
  addMergedMesh(group, globeLampParts, whiteGlobeMat, 'LungCuGlobeLamps', false, false);
  addMergedMesh(group, voidParts, ctx.materials.darkVoid, 'LungCuShaftVentsVoid', false, false);
  addMergedMesh(group, pondWaterParts, pondWaterMat, 'LungCuDragonEyePonds', false, true);
  addMergedMesh(
    group,
    ochreParts,
    ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster,
    'LoLoChaiEarthenWalls',
    true,
    true,
    2.4
  );
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
    color: '#3e3328',
    normalMap: ctx.pbr.bronzePatina?.normalMap ?? null,
    roughnessMap: ctx.pbr.bronzePatina?.roughnessMap ?? null,
    roughness: 0.38,
    metalness: 0.78
  });
  ctx.extraMaterials.push(darkBuddhaBronzeMat);

  const warmRedBuddhaBronzeMat = new THREE.MeshStandardMaterial({
    color: '#9e5c32',
    normalMap: ctx.pbr.bronzePatina?.normalMap ?? null,
    roughness: 0.30,
    metalness: 0.84
  });
  ctx.extraMaterials.push(warmRedBuddhaBronzeMat);

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
  const warmRedBuddhaParts: THREE.BufferGeometry[] = [];
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

  // 3. Brushed Stainless Fansipan 3.143m Pyramid Monument (5.5m tall) with flush face-mounted plaques
  const pyrX = cx - 6.8;
  const pyrZ = cz + 8.5;
  stoneParts.push(makeCylinder(3.3, 3.6, 0.72, 6, pyrX, deckTopY + 0.36, pyrZ));
  graniteParts.push(makeCylinder(2.35, 2.6, 0.68, 3, pyrX, deckTopY + 1.06, pyrZ));
  const pyrBaseY = deckTopY + 1.40;
  const pyrH = 3.80;
  const pyramid = new THREE.ConeGeometry(1.58, pyrH, 3);
  pyramid.translate(pyrX, pyrBaseY + pyrH * 0.5, pyrZ);
  stainlessParts.push(pyramid);

  // Readable "FANSIPAN 3.143m" plaques seated FLUSH on all 3 sloped stainless pyramid faces (r = 0.50m, tilt = 0.205 rad)
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const plaque = createSignagePlaqueMesh(
      {
        text: 'FANSIPAN 3.143m',
        subText: 'NÓC NHÀ ĐÔNG DƯƠNG',
        style: 'bronze',
        width: 1.08,
        height: 0.72,
        depth: 0.05
      },
      ctx
    );
    plaque.name = `Fansipan3143Plaque_${i + 1}`;
    plaque.position.set(pyrX + Math.sin(ang) * 0.50, pyrBaseY + 1.42, pyrZ + Math.cos(ang) * 0.50);
    plaque.rotation.set(0, ang, 0);
    plaque.rotateX(-0.205);
    group.add(plaque);
  }

  // 4. TRUE 1:1 21.5m-TALL Đại Tượng Phật A Di Đà at (cx - 8.5, cz - 8.5)
  //    Octagonal dark-bronze 2-tier Trần-dynasty pedestal with 8 warm red-bronze relief panels
  //    + 14.0m split-tone bronze Amitabha Buddha (NO gold halo!) + twin bronze cranes + 4 bronze guardians
  const bX = cx - 8.5;
  const bZ = cz - 8.5;
  const bBaseY = upperDeckY;
  const bOctRot = Math.PI / 8;

  // Stepped octagonal granite plaza foundation (2.0m) + front granite steps
  graniteParts.push(makeCylinder(6.6, 7.1, 1.15, 8, bX, bBaseY + 0.575, bZ, 0, 0, bOctRot));
  stoneParts.push(makeCylinder(5.9, 6.25, 0.85, 8, bX, bBaseY + 1.575, bZ, 0, 0, bOctRot));
  for (let s = 0; s < 5; s++) {
    graniteParts.push(
      makeBox(4.0, 0.40 + s * 0.40, 0.54, bX, bBaseY + (0.40 + s * 0.40) * 0.5, bZ + 7.2 - s * 0.46)
    );
  }

  // Octagonal dark-bronze 2-tier pedestal (Tier 1 chapel drum 3.2m + Tier 2 Trần relief plinth 2.3m = 7.5m total)
  const chapY = bBaseY + 2.0;
  const chapH = 3.2;
  buddhaBronzeParts.push(makeCylinder(5.40, 5.65, chapH, 8, bX, chapY + chapH * 0.5, bZ, 0, 0, bOctRot));
  // Arched South chapel sanctuary doorway recessed into the South octagonal face (+Z)
  const chapApothem = 5.52 * Math.cos(Math.PI / 8);
  const chapFront = createArchedWallGeometry(3.6, chapH, 0.85, 2.35, 2.65);
  chapFront.translate(bX, chapY, bZ + chapApothem);
  stoneParts.push(chapFront);
  voidParts.push(makeBox(2.25, 2.55, 0.42, bX, chapY + 1.28, bZ + chapApothem - 0.16));
  const chapelLight = new THREE.PointLight('#ffbf62', 1.6, 12, 1.5);
  chapelLight.position.set(bX, chapY + 1.75, bZ + chapApothem + 0.4);
  group.add(chapelLight);

  // Stepped dark-bronze Trần-style octagonal cornice + Tier 2 octagonal pedestal with 8 warm red-bronze relief panels
  const tier2PedY = chapY + chapH; // bBaseY + 5.2m
  buddhaBronzeParts.push(makeCylinder(5.72, 5.55, 0.34, 8, bX, tier2PedY + 0.17, bZ, 0, 0, bOctRot));
  const tier2H = 1.65;
  const tier2BotR = 5.22;
  const tier2TopR = 4.92;
  buddhaBronzeParts.push(
    makeCylinder(tier2TopR, tier2BotR, tier2H, 8, bX, tier2PedY + 0.34 + tier2H * 0.5, bZ, 0, 0, bOctRot)
  );
  const tier2Apothem = ((tier2BotR + tier2TopR) * 0.5) * Math.cos(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rx = bX + Math.sin(a) * (tier2Apothem + 0.06);
    const rz = bZ + Math.cos(a) * (tier2Apothem + 0.06);
    const ry = tier2PedY + 0.34 + tier2H * 0.5;
    // Warm red-bronze Trần-dynasty relief panel + sculpted central dragon/lotus boss on each of 8 faces
    const panel = makeBox(2.85, 1.24, 0.12, 0, 0, 0);
    panel.rotateY(a);
    panel.translate(rx, ry, rz);
    warmRedBuddhaParts.push(panel);
    const boss = new THREE.TorusGeometry(0.40, 0.075, 6, 12);
    boss.rotateY(a);
    boss.translate(bX + Math.sin(a) * (tier2Apothem + 0.14), ry, bZ + Math.cos(a) * (tier2Apothem + 0.14));
    warmRedBuddhaParts.push(boss);
  }
  // Plump rounded dark-bronze lower lotus petal collar directly supporting the 14.0m Amitabha Buddha
  const lotusCollarY = tier2PedY + 0.34 + tier2H; // bBaseY + 7.19m
  buddhaBronzeParts.push(makeCylinder(4.65, 5.05, 0.42, 16, bX, lotusCollarY + 0.21, bZ));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pet = new THREE.SphereGeometry(0.68, 7, 5);
    pet.scale(0.95, 1.25, 0.44);
    pet.rotateX(0.45);
    pet.rotateY(a);
    pet.translate(bX + Math.sin(a) * 4.78, lotusCollarY + 0.38, bZ + Math.cos(a) * 4.78);
    buddhaBronzeParts.push(pet);
  }

  // 14.0m-tall sculpted bronze Amitabha Buddha (skipHalo: true — NO giant gold halo!)
  // Split bronze tones: dark antique bronze for robe & outer petals vs warm reddish-gold bronze for inner petals/chest/hands/face
  const buddhaSeatY = bBaseY + 7.5;
  const bScale = 5.05;
  const bRotY = 0.18;
  const amitabha = createSculptedDeityParts(bX, buddhaSeatY, bZ, bRotY, bScale, 'amitabha', { skipHalo: true });
  buddhaBronzeParts.push(...amitabha.bodyParts);
  warmRedBuddhaParts.push(...amitabha.accentParts);

  // Warm reddish-gold bronze face glow, chest *chữ Vạn 卍*, and meditation mudra hands
  const warmAccents: THREE.BufferGeometry[] = [];
  const faceMask = new THREE.SphereGeometry(0.285 * bScale, 10, 8, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.68);
  faceMask.scale(0.95, 1.08, 0.98);
  faceMask.rotateY(Math.PI * 0.5);
  faceMask.translate(0, (0.58 + 1.84) * bScale, 0.06 * bScale);
  warmAccents.push(faceMask);
  // Warm red-bronze chest plate & embossed *chữ Vạn 卍* emblem
  const chestY = (0.58 + 1.08) * bScale;
  const chestZ = 0.46 * bScale;
  warmAccents.push(
    makeBox(0.32 * bScale, 0.045 * bScale, 0.05 * bScale, 0, chestY, chestZ),
    makeBox(0.045 * bScale, 0.32 * bScale, 0.05 * bScale, 0, chestY, chestZ),
    makeBox(0.16 * bScale, 0.042 * bScale, 0.05 * bScale, 0.08 * bScale, chestY + 0.14 * bScale, chestZ),
    makeBox(0.16 * bScale, 0.042 * bScale, 0.05 * bScale, -0.08 * bScale, chestY - 0.14 * bScale, chestZ),
    makeBox(0.042 * bScale, 0.16 * bScale, 0.05 * bScale, -0.14 * bScale, chestY + 0.08 * bScale, chestZ),
    makeBox(0.042 * bScale, 0.16 * bScale, 0.05 * bScale, 0.14 * bScale, chestY - 0.08 * bScale, chestZ)
  );
  // Warm red-bronze cupped meditation hands (*ấn thiền định*)
  const mudraHands = new THREE.SphereGeometry(0.22 * bScale, 8, 6);
  mudraHands.scale(1.35, 0.58, 0.95);
  mudraHands.translate(0, (0.58 + 0.58) * bScale, 0.42 * bScale);
  warmAccents.push(mudraHands);
  for (const g of warmAccents) {
    g.rotateY(bRotY);
    g.translate(bX, buddhaSeatY, bZ);
    warmRedBuddhaParts.push(g);
  }

  // Monumental bronze censer + Twin bronze cranes on tortoises (*Hạc chầu quy*) + 4 dark-bronze Guardian Statues
  const fanCenser = createBronzeIncenseTripodParts(bX, bBaseY, bZ + 8.3, 1.25);
  stoneParts.push(...fanCenser.limestoneParts);
  bronzeParts.push(...fanCenser.bronzeParts);
  goldParts.push(...fanCenser.goldParts);
  smokeSources.push({ x: bX, y: fanCenser.smokeY, z: bZ + 8.3, scale: 1.25 });

  for (const side of [-1, 1]) {
    bronzeParts.push(
      ...createBronzeCraneOnTortoiseParts(bX + side * 3.1, bBaseY, bZ + 7.6, side > 0 ? -0.32 : 0.32, 1.38)
    );
  }
  for (const gx of [-1, 1]) {
    for (const gz of [-1, 1]) {
      const px = bX + gx * 6.4;
      const pz = bZ + gz * 6.2;
      const gRot = Math.atan2(gx, gz);
      graniteParts.push(makeCylinder(0.85, 0.98, 0.92, 8, px, bBaseY + 0.46, pz));
      buddhaBronzeParts.push(...createGuardianBeastParts(px, bBaseY + 0.92, pz, gRot, 1.55, 'dvarapala'));
    }
  }

  // 5. AUTHENTIC Kim Sơn Bảo Thắng Summit Pagoda at (cx + 1.5, cz - 7.5):
  //    Raw dark ironwood (NO crimson lacquer / bright gold!) + cut grey-blue stone perimeter wall
  //    + stone circular-arch gate with stepped stone roof + orange-red terracotta roofs
  const pagX = cx + 1.5;
  const pagZ = cz - 7.5;
  const pagBaseY = upperDeckY;
  graniteParts.push(makeBox(8.4, 0.72, 8.4, pagX, pagBaseY + 0.36, pagZ));
  stoneParts.push(makeBox(7.2, 0.68, 7.2, pagX, pagBaseY + 1.06, pagZ));
  for (let s = 0; s < 4; s++) {
    graniteParts.push(makeBox(3.2, 0.34, 0.55, pagX, pagBaseY + 0.17 + s * 0.32, pagZ + 4.45 - s * 0.42));
  }

  // Cut grey-blue stone perimeter precinct wall + circular-arch stone gate with stepped stone roof on South
  const wallHalf = 4.95;
  const pWallH = 2.05;
  graniteParts.push(
    makeBox(wallHalf * 2 + 0.45, pWallH, 0.48, pagX, pagBaseY + pWallH * 0.5, pagZ - wallHalf),
    makeBox(0.48, pWallH, wallHalf * 2, pagX - wallHalf, pagBaseY + pWallH * 0.5, pagZ),
    makeBox(0.48, pWallH, wallHalf * 2, pagX + wallHalf, pagBaseY + pWallH * 0.5, pagZ),
    makeBox(2.9, pWallH, 0.48, pagX - 3.5, pagBaseY + pWallH * 0.5, pagZ + wallHalf),
    makeBox(2.9, pWallH, 0.48, pagX + 3.5, pagBaseY + pWallH * 0.5, pagZ + wallHalf)
  );
  // Stone circular-arch gate centered at South entry (pagZ + wallHalf) + 2-tier stepped stone roof
  const sGateWall = createArchedWallGeometry(4.2, 3.25, 0.78, 2.25, 2.55);
  sGateWall.translate(pagX, pagBaseY, pagZ + wallHalf);
  graniteParts.push(sGateWall);
  stoneParts.push(
    makeBox(4.85, 0.28, 1.35, pagX, pagBaseY + 3.35, pagZ + wallHalf),
    makeBox(4.15, 0.28, 1.12, pagX, pagBaseY + 3.63, pagZ + wallHalf),
    makeBox(3.35, 0.26, 0.90, pagX, pagBaseY + 3.90, pagZ + wallHalf),
    makeBox(2.45, 0.24, 0.68, pagX, pagBaseY + 4.15, pagZ + wallHalf)
  );

  const pagFloorY = pagBaseY + 1.40;
  const t1H = 3.45;
  for (const ox of [-2.45, 0, 2.45]) {
    for (const oz of [-2.45, 0, 2.45]) {
      if (ox === 0 && oz === 0) continue;
      if (ox === 0 && oz > 0) continue; // keep open front doorway clear
      woodParts.push(makeCylinder(0.17, 0.20, t1H, 10, pagX + ox, pagFloorY + t1H * 0.5, pagZ + oz));
      stoneParts.push(makeCylinder(0.26, 0.30, 0.22, 10, pagX + ox, pagFloorY + 0.11, pagZ + oz));
    }
  }
  // Raw dark ironwood carved walls, open swinging doors, rafters & interior altar
  woodParts.push(makeBox(0.28, t1H * 0.86, 4.4, pagX - 2.15, pagFloorY + t1H * 0.43, pagZ));
  woodParts.push(makeBox(0.28, t1H * 0.86, 4.4, pagX + 2.15, pagFloorY + t1H * 0.43, pagZ));
  woodParts.push(makeBox(4.5, t1H * 0.86, 0.28, pagX, pagFloorY + t1H * 0.43, pagZ - 2.15));
  for (const side of [-1, 1]) {
    woodParts.push(makeBox(0.95, t1H * 0.80, 0.20, pagX + side * 1.65, pagFloorY + t1H * 0.40, pagZ + 2.15));
    woodParts.push(
      makeBox(0.76, t1H * 0.74, 0.12, pagX + side * 0.92, pagFloorY + t1H * 0.37, pagZ + 2.46, side * -0.58)
    );
    lanternParts.push(
      createRibbedLanternShellGeometry(0.20, 0.30, 10, 6).translate(pagX + side * 2.45, pagFloorY + t1H - 0.48, pagZ + 2.75)
    );
    lanternCoreParts.push(
      createLanternCoreGeometry(0.12, 0.19).translate(pagX + side * 2.45, pagFloorY + t1H - 0.48, pagZ + 2.75)
    );
  }
  woodParts.push(makeBox(2.4, 0.92, 0.95, pagX, pagFloorY + 0.46, pagZ - 1.25));
  woodParts.push(makeBox(5.5, 0.26, 5.5, pagX, pagFloorY + t1H - 0.06, pagZ));

  const pagRoof1 = createVietnameseCurvedRoofGeometry(8.4, 8.4, 4.6, 4.6, 1.95, 0.40);
  pagRoof1.translate(pagX, pagFloorY + t1H + 0.02, pagZ);
  roofParts.push(pagRoof1);

  const t2Y = pagFloorY + t1H + 1.45;
  const t2H = 2.35;
  for (const ox of [-1.45, 1.45]) {
    for (const oz of [-1.45, 1.45]) {
      woodParts.push(makeCylinder(0.13, 0.15, t2H, 10, pagX + ox, t2Y + t2H * 0.5, pagZ + oz));
    }
  }
  woodParts.push(makeBox(2.4, t2H * 0.84, 2.4, pagX, t2Y + t2H * 0.44, pagZ));
  woodParts.push(makeBox(3.4, 0.22, 3.4, pagX, t2Y + t2H - 0.05, pagZ));

  const pagRoof2 = createVietnameseCurvedRoofGeometry(5.8, 5.8, 2.2, 0.65, 2.25, 0.46);
  pagRoof2.translate(pagX, t2Y + t2H + 0.02, pagZ);
  roofParts.push(pagRoof2);

  // Weathered grey-stone / terracotta Trần-dynasty ridge finials (no flashy red/gold trim)
  const pagFinials = createRoofFinialSetParts(pagX, t2Y + t2H + 2.24, pagZ, 2.4, 0, 0.72, false);
  stoneParts.push(...pagFinials.mainParts, ...pagFinials.goldParts);

  // 6. 11-Story OCTAGONAL Grey-Stone Bảo Tháp Stupa (18.0m tall) at (cx + 10.5, cz - 8.5)
  //    topped with a gleaming GOLDEN lotus-bud spire!
  const stuX = cx + 10.5;
  const stuZ = cz - 8.5;
  const stuBaseY = upperDeckY;
  // Stepped octagonal grey-stone plinth (1.8m)
  graniteParts.push(makeCylinder(2.65, 2.95, 0.95, 8, stuX, stuBaseY + 0.475, stuZ));
  stoneParts.push(makeCylinder(2.22, 2.48, 0.85, 8, stuX, stuBaseY + 1.375, stuZ));

  // 11 diminishing OCTAGONAL grey-stone stories with upturned flared octagonal eaves (14.1m shaft)
  let stuCurY = stuBaseY + 1.80;
  for (let tier = 0; tier < 11; tier++) {
    const frac = tier / 10;
    const tierR = THREE.MathUtils.lerp(1.88, 0.72, frac);
    const tierH = THREE.MathUtils.lerp(1.50, 1.02, frac);
    const bodyH = tierH * 0.66;
    const eaveH = tierH * 0.34;

    graniteParts.push(makeCylinder(tierR * 0.96, tierR, bodyH, 8, stuX, stuCurY + bodyH * 0.5, stuZ));
    // Recessed arched Buddha niches on the 4 cardinal faces of lower 6 tiers
    if (tier < 6) {
      const nw = tierR * 0.44;
      const nh = bodyH * 0.68;
      const apothem = tierR * Math.cos(Math.PI / 8);
      for (let f = 0; f < 4; f++) {
        const fa = (f / 4) * Math.PI * 2 + Math.PI / 8;
        const niche = makeBox(nw, nh, 0.08, 0, 0, 0);
        niche.rotateY(fa);
        niche.translate(stuX + Math.sin(fa) * (apothem + 0.01), stuCurY + nh * 0.54, stuZ + Math.cos(fa) * (apothem + 0.01));
        voidParts.push(niche);
      }
    }
    // Flared octagonal stone eave skirt + cornice lip on every story
    stoneParts.push(
      makeCylinder(tierR * 0.96, tierR * 1.42, eaveH * 0.85, 8, stuX, stuCurY + bodyH + eaveH * 0.38, stuZ),
      makeCylinder(tierR * 1.45, tierR * 1.40, eaveH * 0.22, 8, stuX, stuCurY + bodyH + 0.02, stuZ)
    );

    stuCurY += tierH;
  }
  // Gleaming GOLDEN lotus-bud spire crowning the 11-tier Bảo Tháp!
  goldParts.push(...createLotusFinialParts(stuX, stuCurY, stuZ, 1.65));
  goldParts.push(makeCylinder(0.08, 0.30, 1.55, 12, stuX, stuCurY + 1.55, stuZ));
  goldParts.push(new THREE.SphereGeometry(0.24, 10, 8).translate(stuX, stuCurY + 2.38, stuZ));
  goldParts.push(new THREE.ConeGeometry(0.18, 0.55, 10).translate(stuX, stuCurY + 2.75, stuZ));

  // 7. Vọng Lĩnh Cao Đài Bell Tower at (cx + 10.0, cz + 4.5) in raw dark ironwood & grey stone
  const bellX = cx + 10.0;
  const bellZ = cz + 4.5;
  const bellBaseY = deckTopY;
  graniteParts.push(makeBox(6.0, 0.85, 6.0, bellX, bellBaseY + 0.425, bellZ));
  const bfY = bellBaseY + 0.85;
  const bt1H = 3.2;
  for (const ox of [-2.1, 2.1]) {
    for (const oz of [-2.1, 2.1]) {
      woodParts.push(makeCylinder(0.17, 0.20, bt1H, 10, bellX + ox, bfY + bt1H * 0.5, bellZ + oz));
      stoneParts.push(makeCylinder(0.26, 0.30, 0.24, 10, bellX + ox, bfY + 0.12, bellZ + oz));
    }
  }
  woodParts.push(
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
      woodParts.push(makeCylinder(0.12, 0.14, bt2H, 8, bellX + ox, bt2Y + bt2H * 0.5, bellZ + oz));
    }
  }
  const btRoof2 = createVietnameseCurvedRoofGeometry(4.8, 4.8, 1.8, 0.5, 1.85, 0.42);
  btRoof2.translate(bellX, bt2Y + bt2H, bellZ);
  roofParts.push(btRoof2);

  const btFinials = createRoofFinialSetParts(bellX, bt2Y + bt2H + 1.85, bellZ, 1.8, 0, 0.65, false);
  stoneParts.push(...btFinials.mainParts, ...btFinials.goldParts);

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

  addMergedMesh(group, graniteParts, ctx.materials.granite, 'FansipanGraniteCrags', true, true, 2.4);
  addMergedMesh(group, stoneParts, ctx.materials.stone, 'FansipanSummitStonePlaza', true, true, 2.4);
  addMergedMesh(group, stainlessParts, stainlessMat, 'Fansipan3143Milestone');
  addMergedMesh(
    group,
    bronzeParts,
    ctx.materials.bronzePatina ?? ctx.materials.bronze,
    'FansipanBronzeTrim'
  );
  addMergedMesh(group, buddhaBronzeParts, darkBuddhaBronzeMat, 'FansipanAmitabhaBuddhaStatue');
  addMergedMesh(group, warmRedBuddhaParts, warmRedBuddhaBronzeMat, 'FansipanBuddhaWarmRedBronze');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'FansipanSummitPagoda');
  addMergedMesh(
    group,
    woodParts,
    ctx.materials.darkIronwood ?? ctx.materials.darkWood,
    'FansipanPagodaTimber'
  );
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
 * Builds an authentic hollow U-section Vietnamese rowboat (*thuyền nan / đò Suối Yến*)
 * with flat bottom planks, sloped port/starboard gunwales, and tapered pointed bow & stern
 * so benches and seated pilgrims sit cleanly inside without hull clipping.
 */
function createHollowSampanHullParts(
  length = 7.2,
  maxBeam = 1.48,
  depth = 0.44
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const segs = 10;
  const wallT = 0.065;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const tm = (t0 + t1) * 0.5;
    const z0 = (t0 - 0.5) * length;
    const z1 = (t1 - 0.5) * length;
    const zm = (z0 + z1) * 0.5;
    const segLen = Math.abs(z1 - z0) + 0.04;

    const beamFactor = Math.pow(Math.max(0.06, Math.sin(Math.PI * tm)), 0.62);
    const halfTopW = maxBeam * 0.5 * beamFactor;
    const halfBotW = halfTopW * 0.60;
    const u = tm * 2 - 1;
    const rockerY = 0.02 + 0.34 * Math.pow(Math.abs(u), 2.4);
    const sideH = depth * (0.68 + 0.32 * Math.sin(Math.PI * tm));
    const slopeTilt = Math.atan2(halfTopW - halfBotW, sideH);
    const slantH = Math.hypot(halfTopW - halfBotW, sideH);

    // Flat bottom keel plank
    parts.push(makeBox(Math.max(0.12, halfBotW * 2.0 + 0.05), 0.06, segLen, 0, rockerY, zm));

    // Sloped port (-1) & starboard (+1) gunwale walls leaving a hollow interior trough
    const bf0 = Math.pow(Math.max(0.06, Math.sin(Math.PI * t0)), 0.62);
    const bf1 = Math.pow(Math.max(0.06, Math.sin(Math.PI * t1)), 0.62);
    const yawFlare = Math.atan2(maxBeam * 0.5 * (bf1 - bf0), z1 - z0);
    for (const side of [-1, 1]) {
      const midX = side * (halfBotW + halfTopW) * 0.5;
      const wall = new THREE.BoxGeometry(wallT, slantH, segLen + 0.04);
      wall.rotateZ(-side * slopeTilt);
      wall.rotateY(side * yawFlare);
      wall.translate(midX, rockerY + sideH * 0.5, zm);
      parts.push(wall);
    }

    // Small pointed bow & stern deck caps at very tips
    if (i === 0 || i === segs - 1) {
      parts.push(makeBox(Math.max(0.14, halfTopW * 1.8), 0.06, segLen * 0.9, 0, rockerY + sideH - 0.02, zm));
    }
  }
  return parts;
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
  const batTrangParts: THREE.BufferGeometry[] = [];
  const whitePlasterParts: THREE.BufferGeometry[] = [];
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

    // Structural stone arch ribs curving beneath Cầu Hội deck + spandrel stone struts
    const ribY = 0.22 + Math.sin(tm * Math.PI) * 2.48;
    const ribSlope = Math.atan2(Math.cos(tm * Math.PI) * 2.48 * Math.PI, bridgeSpan);
    for (const side of [-1, 1]) {
      const archRib = makeBox(segLen + 0.08, 0.42, 0.44, 0, 0, 0);
      archRib.rotateZ(ribSlope);
      archRib.translate(bx, ribY, bridgeZ + side * 1.46);
      stoneParts.push(archRib);
      const strutH = Math.max(0.24, archY - ribY);
      stoneParts.push(makeBox(0.28, strutH, 0.34, bx, ribY + strutH * 0.5, bridgeZ + side * 1.46));

      // Vermilion arched timber side parapet rails & balusters
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

  // 2. 10 Authentic Open Dark-Hulled *Thuyền nan* Rowboats bobbing along Suối Yến via ctx.junkBoats
  //    Hollow U-section hulls (zero bench/passenger clipping), NO canopies/umbrellas/bow lanterns (ref 107)
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
    const bRobe: THREE.BufferGeometry[] = [];
    const bHat: THREE.BufferGeometry[] = [];

    // Hollow U-section dark-wood sampan hull (bottom plank + sloped gunwales + pointed bow/stern)
    bWood.push(...createHollowSampanHullParts(7.2, 1.48, 0.44));

    // Recessed wooden thwart benches sized to fit cleanly inside the tapered U-hull
    for (const [tz, bw] of [
      [-1.85, 0.94],
      [-0.55, 1.16],
      [0.75, 1.14],
      [1.90, 0.92]
    ]) {
      bWood.push(makeBox(bw, 0.07, 0.30, 0, 0.25, tz));
    }
    // Pair of traditional hand-rowing oars resting across gunwales
    for (const side of [-1, 1]) {
      const oar = makeCylinder(0.028, 0.038, 3.2, 6, 0, 0, 0);
      oar.rotateX(Math.PI * 0.49);
      oar.rotateY(side * 0.08);
      oar.translate(side * 0.62, 0.44, 0.05);
      bWood.push(oar);
    }

    // Conical-hat (*nón lá*) boat rower & 2 pilgrims seated cleanly INSIDE the hollow sampan hull
    for (const [px, pz, pyOff] of [
      [0, -1.85, 0.29],
      [-0.22, 0.72, 0.28],
      [0.22, 1.65, 0.28]
    ]) {
      bRobe.push(makeCylinder(0.14, 0.19, 0.58, 7, px, pyOff + 0.29, pz));
      bRobe.push(new THREE.SphereGeometry(0.115, 7, 5).translate(px, pyOff + 0.68, pz));
      bHat.push(new THREE.ConeGeometry(0.30, 0.20, 10).translate(px, pyOff + 0.82, pz));
    }

    addMergedMesh(boatGroup, bWood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, `SuoiYenSampanHull_${idx + 1}`);
    addMergedMesh(boatGroup, bRobe, pilgrimRobeMat, `SuoiYenSampanPilgrims_${idx + 1}`);
    addMergedMesh(boatGroup, bHat, nonLaMat, `SuoiYenSampanNonLa_${idx + 1}`);

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
  const tbBatTrang: THREE.BufferGeometry[] = [];
  const tbWhite: THREE.BufferGeometry[] = [];
  const tbCrimson: THREE.BufferGeometry[] = [];
  const tbWood: THREE.BufferGeometry[] = [];
  const tbRoof: THREE.BufferGeometry[] = [];
  const tbGold: THREE.BufferGeometry[] = [];
  const tbBronze: THREE.BufferGeometry[] = [];
  const tbLantern: THREE.BufferGeometry[] = [];
  const tbCore: THREE.BufferGeometry[] = [];
  const tbVoid: THREE.BufferGeometry[] = [];

  // Broad skirted stone temple dais + open red Bát Tràng brick courtyard apron (top local y = 1.45m)
  const tbFloorY = 1.45;
  tbStone.push(makeBox(21.6, tbFloorY + 5.5, 14.6, 0, -5.5 + (tbFloorY + 5.5) * 0.5, 0));
  tbBatTrang.push(makeBox(21.0, 0.08, 14.0, 0, tbFloorY + 0.04, 0));
  // Open red Bát Tràng brick forecourt apron extending cleanly in front of stairs (z = 7.2..13.0)
  tbStone.push(makeBox(20.0, 5.2, 6.2, 0, -2.55, 10.2));
  tbBatTrang.push(makeBox(19.6, 0.10, 5.8, 0, 0.08, 10.2));
  // Wide open ceremonial entrance stairs (NO front balustrade blocking entry!)
  for (let s = 0; s < 5; s++) {
    tbStone.push(makeBox(10.8, 1.8, 0.72, 0, -0.15 + s * 0.28, 7.65 - s * 0.52));
  }
  // Keep side balustrades only; leave entire front facade wide open
  tbStone.push(
    ...createPiercedBalustradeParts(-10.4, -7.0, -10.4, 7.0, tbFloorY, 0.88, 'lotus_stone'),
    ...createPiercedBalustradeParts(10.4, -7.0, 10.4, 7.0, tbFloorY, 0.88, 'lotus_stone')
  );

  // Pair of golden reclining lions on red-white pedestals flanking the wide Thiên Trù entry stairs
  for (const side of [-1, 1]) {
    const lx = side * 6.55;
    const lz = 8.45;
    tbCrimson.push(makeBox(1.55, 0.86, 1.85, lx, 0.56, lz));
    tbWhite.push(
      makeBox(1.68, 0.14, 1.98, lx, 0.18, lz),
      makeBox(1.68, 0.14, 1.98, lx, 1.00, lz)
    );
    tbStone.push(makeBox(1.48, 0.12, 1.76, lx, 1.12, lz));
    tbGold.push(...createGuardianBeastParts(lx, 1.18, lz, 0, 1.18, 'kylan'));
  }

  // Multi-tier carved stone lotus incense tower (*Tháp hương đài sen*) centered in front courtyard
  const towerZ = 10.8;
  tbStone.push(
    makeCylinder(1.25, 1.48, 0.42, 8, 0, 0.34, towerZ),
    makeCylinder(0.92, 1.12, 0.36, 8, 0, 0.72, towerZ),
    makeCylinder(0.62, 0.78, 0.95, 8, 0, 1.38, towerZ),
    makeCylinder(0.95, 0.68, 0.26, 8, 0, 1.98, towerZ),
    makeCylinder(0.76, 0.88, 0.24, 8, 0, 2.22, towerZ)
  );
  // Pierced upper lotus incense chamber with warm amber glow + lotus-bud finial cap
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2;
    tbStone.push(makeCylinder(0.08, 0.09, 0.82, 6, Math.cos(a) * 0.56, 2.74, towerZ + Math.sin(a) * 0.56));
  }
  tbCore.push(new THREE.SphereGeometry(0.28, 8, 6).translate(0, 2.72, towerZ));
  const towerCap = createVietnameseCurvedRoofGeometry(1.75, 1.75, 0.65, 0.65, 0.68, 0.22);
  towerCap.translate(0, 3.12, towerZ);
  tbStone.push(towerCap);
  tbStone.push(...createLotusFinialParts(0, 3.80, towerZ, 0.95));
  const towerSmokePos = new THREE.Vector3(0, 4.45, towerZ)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), tbRotY)
    .add(new THREE.Vector3(tbX, tbY, tbZ));
  smokeSources.push({ x: towerSmokePos.x, y: towerSmokePos.y, z: towerSmokePos.z, scale: 1.15 });

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
  tbWood.push(makeBox(18.6, 0.32, 10.8, 0, tbFloorY + tbH - 0.08, 0));

  // Double-tier curved mossy terracotta roof (*ngói mũi hài*) reaching ~12.5m total height
  const tbRoof1 = createVietnameseCurvedRoofGeometry(21.4, 14.2, 14.8, 7.6, 2.65, 0.46);
  tbRoof1.translate(0, tbFloorY + tbH + 0.02, 0);
  tbRoof.push(tbRoof1);

  // Open dark-wood vertical slatted louver *cổ diêm* (replaces solid red box!) + centered Hương Thiên Bảo Sát plaque
  const tbUpY = tbFloorY + tbH + 1.85;
  const tbUpH = 1.95;
  tbVoid.push(makeBox(12.9, tbUpH * 0.88, 5.5, 0, tbUpY + tbUpH * 0.5, 0));
  tbWood.push(
    makeBox(13.8, 0.20, 6.4, 0, tbUpY + 0.10, 0),
    makeBox(14.0, 0.24, 6.6, 0, tbUpY + tbUpH - 0.08, 0)
  );
  // Corner & bay dark-wood posts + dense vertical slatted timber louvers on all 4 sides
  for (const cxOff of [-6.7, -3.35, 3.35, 6.7]) {
    for (const czOff of [-3.05, 3.05]) {
      tbWood.push(makeBox(0.24, tbUpH, 0.24, cxOff, tbUpY + tbUpH * 0.5, czOff));
    }
  }
  for (let lx = -6.3; lx <= 6.31; lx += 0.42) {
    // Keep front center open for the "香天寶刹 — HƯƠNG THIÊN BẢO SÁT" plaque
    if (Math.abs(lx) > 2.05) {
      tbWood.push(makeBox(0.09, tbUpH * 0.86, 0.12, lx, tbUpY + tbUpH * 0.5, 3.06));
    }
    tbWood.push(makeBox(0.09, tbUpH * 0.86, 0.12, lx, tbUpY + tbUpH * 0.5, -3.06));
  }
  for (let lz = -2.7; lz <= 2.71; lz += 0.45) {
    for (const xSide of [-1, 1]) {
      tbWood.push(makeBox(0.12, tbUpH * 0.86, 0.09, xSide * 6.72, tbUpY + tbUpH * 0.5, lz));
    }
  }

  const tbRoof2 = createVietnameseCurvedRoofGeometry(16.6, 9.8, 8.2, 0.65, 2.85, 0.52);
  tbRoof2.translate(0, tbUpY + tbUpH + 0.02, 0);
  tbRoof.push(tbRoof2);

  const tbFinials = createRoofFinialSetParts(0, tbUpY + tbUpH + 2.84, 0, 8.2, 0, 1.05, true);
  tbStone.push(...tbFinials.mainParts);
  tbGold.push(...tbFinials.goldParts);

  // Courtyard bronze censer on upper dais + GPU incense smoke
  const tbCenserLocal = new THREE.Vector3(0, tbFloorY, 6.1);
  const tbCenser = createBronzeIncenseTripodParts(tbCenserLocal.x, tbCenserLocal.y, tbCenserLocal.z, 1.15);
  tbStone.push(...tbCenser.limestoneParts);
  tbBronze.push(...tbCenser.bronzeParts);
  tbGold.push(...tbCenser.goldParts);
  const tbSmokePos = new THREE.Vector3(tbCenserLocal.x, tbCenser.smokeY, tbCenserLocal.z)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), tbRotY)
    .add(new THREE.Vector3(tbX, tbY, tbZ));
  smokeSources.push({ x: tbSmokePos.x, y: tbSmokePos.y, z: tbSmokePos.z, scale: 1.05 });

  const applyTb = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(tbRotY);
      g.translate(tbX, tbY, tbZ);
      dst.push(g);
    }
  };
  applyTb(tbStone, stoneParts);
  applyTb(tbBatTrang, batTrangParts);
  applyTb(tbWhite, whitePlasterParts);
  applyTb(tbCrimson, crimsonParts);
  applyTb(tbWood, woodParts);
  applyTb(tbRoof, roofParts);
  applyTb(tbGold, goldParts);
  applyTb(tbBronze, bronzeParts);
  applyTb(tbLantern, lanternParts);
  applyTb(tbCore, lanternCoreParts);
  applyTb(tbVoid, voidParts);

  // Centered "香天寶刹 — HƯƠNG THIÊN BẢO SÁT" plaque mounted right in the open slatted *cổ diêm*!
  const tbPlaquePos = new THREE.Vector3(0, tbUpY + tbUpH * 0.52, 3.16)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), tbRotY)
    .add(new THREE.Vector3(tbX, tbY, tbZ));
  const tbPlaque = createSignagePlaqueMesh(
    { text: '香 天 寶 刹', subText: 'HƯƠNG THIÊN BẢO SÁT', style: 'royal', width: 3.9, height: 1.15, depth: 0.16 },
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
  const cWood: THREE.BufferGeometry[] = [];
  const cVoid: THREE.BufferGeometry[] = [];
  const cLantern: THREE.BufferGeometry[] = [];
  const cLanternCore: THREE.BufferGeometry[] = [];
  const cGold: THREE.BufferGeometry[] = [];
  const cBronze: THREE.BufferGeometry[] = [];
  const cCrimson: THREE.BufferGeometry[] = [];

  // Towering 26m-wide x 18m-high mouth + 24m deep cavernous limestone rock chamber (tight rz = 7.6m overlap, ZERO sky leaks!)
  cStone.push(
    createSculptedRockGeometry(511, 6.8, 10.6, 7.6, 3).translate(-8.4, 7.2, 0.0),
    createSculptedRockGeometry(512, 6.9, 10.8, 7.6, 3).translate(8.6, 7.4, 0.0),
    createSculptedRockGeometry(513, 14.5, 5.5, 8.2, 3).translate(0, 15.0, -0.8)
  );
  // Deep vaulted side & ceiling cavern rock ribs with generous rz = 7.6m overlap to seal all sky gaps
  for (let seg = 1; seg <= 3; seg++) {
    const zOff = -seg * 6.4;
    const wShrink = 1.0 - seg * 0.07;
    cStone.push(
      createSculptedRockGeometry(520 + seg * 3, 5.8, 10.2, 7.6, 2).translate(-9.0 * wShrink, 6.4, zOff),
      createSculptedRockGeometry(521 + seg * 3, 5.8, 10.2, 7.6, 2).translate(9.0 * wShrink, 6.4, zOff),
      createSculptedRockGeometry(522 + seg * 3, 14.0 * wShrink, 5.0, 7.6, 2).translate(0, 13.5 - seg * 0.65, zOff)
    );
  }
  cStone.push(createSculptedRockGeometry(540, 13.6, 11.8, 7.8, 3).translate(0, 6.8, -23.2));
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

  // Towering ~6.0m Mossy *Đụn Gạo* (Sacred Rice Mound) stalagmite draped with green vines at heart of grotto
  const dunGaoZ = -6.6;
  cMossy.push(createSculptedRockGeometry(571, 2.55, 3.25, 2.45, 3).translate(0, 3.05, dunGaoZ));
  // Cascading green vine strands draped from Đụn Gạo summit down its mossy limestone flanks
  for (let v = 0; v < 7; v++) {
    const va = (v / 7) * Math.PI * 2;
    const vineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(va) * 0.55, 5.85, dunGaoZ + Math.sin(va) * 0.55),
      new THREE.Vector3(Math.cos(va) * 1.65, 4.2, dunGaoZ + Math.sin(va) * 1.65),
      new THREE.Vector3(Math.cos(va) * 2.30, 2.2, dunGaoZ + Math.sin(va) * 2.30),
      new THREE.Vector3(Math.cos(va) * 2.42, 0.45, dunGaoZ + Math.sin(va) * 2.42)
    ]);
    cMossy.push(new THREE.TubeGeometry(vineCurve, 8, 0.08, 5, false));
  }
  cMossy.push(createSculptedRockGeometry(572, 1.4, 3.2, 1.3, 2).translate(-5.4, 1.9, -9.2));
  cStone.push(createSculptedRockGeometry(573, 1.3, 2.9, 1.3, 2).translate(5.4, 1.8, -9.6));

  // Pilgrim stone stairs descending into the cavern sanctuary
  for (let s = 0; s < 10; s++) {
    cStone.push(makeBox(8.8, 1.4, 1.15, 0, -0.25 + (s < 5 ? s * 0.14 : (9 - s) * 0.12), 5.6 - s * 0.95));
  }

  // Sculpted Green-Stone Quan Âm Bodhisattva (simpleQuanAm + skipHalo — authentic serene stone silhouette!)
  const quanAm = createSculptedDeityParts(0, 0.85, -13.2, 0, 1.65, 'quanam', {
    skipHalo: true,
    simpleQuanAm: true
  });
  cMossy.push(...quanAm.bodyParts);
  cGold.push(...quanAm.accentParts);

  // Dragon-carved wood altar + fruit/flower offerings placed RIGHT AT THE FOOT of Đụn Gạo stalagmite!
  const dgAltarZ = -3.65;
  cWood.push(makeBox(4.1, 1.15, 1.28, 0, 0.85, dgAltarZ));
  cGold.push(
    makeBox(4.32, 0.14, 1.42, 0, 1.45, dgAltarZ),
    // Carved golden dragon front relief apron on wood altar
    makeBox(3.55, 0.62, 0.10, 0, 0.92, dgAltarZ + 0.65)
  );
  // Fruit trays (golden pomelo / oản mounds), red votive candles & ritual flower vases atop Đụn Gạo altar
  for (const side of [-1, 1]) {
    cGold.push(makeCylinder(0.22, 0.30, 0.12, 8, side * 1.25, 1.58, dgAltarZ));
    cGold.push(new THREE.SphereGeometry(0.16, 7, 5).translate(side * 1.25, 1.78, dgAltarZ));
    cCrimson.push(makeCylinder(0.06, 0.07, 0.50, 6, side * 0.72, 1.76, dgAltarZ + 0.24));
    cLanternCore.push(new THREE.SphereGeometry(0.075, 6, 5).translate(side * 0.72, 2.06, dgAltarZ + 0.24));
    cBronze.push(makeCylinder(0.11, 0.14, 0.42, 8, side * 1.72, 1.72, dgAltarZ - 0.18));
  }
  const caveCenser = createBronzeIncenseTripodParts(0, 0.25, -1.85, 1.12);
  cStone.push(...caveCenser.limestoneParts);
  cBronze.push(...caveCenser.bronzeParts);
  cGold.push(...caveCenser.goldParts);
  const caveSmokeWorld = new THREE.Vector3(0, caveCenser.smokeY, -1.85)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  smokeSources.push({ x: caveSmokeWorld.x, y: caveSmokeWorld.y, z: caveSmokeWorld.z, scale: 1.15 });

  // Warm interior shrine PointLight illuminating Đụn Gạo, altar & Quan Âm statue
  const caveLightPos = new THREE.Vector3(0, 4.8, -7.2)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  const caveLight = new THREE.PointLight('#ffbd62', 2.6, 28, 1.4);
  caveLight.position.copy(caveLightPos);
  group.add(caveLight);

  // Authentic carved grey limestone cliff inscription "南天第一洞 — NAM THIÊN ĐỆ NHẤT ĐỘNG"
  // incised directly onto the LEFT interior limestone cliff wall (replaces floating 12.8m bronze billboard!)
  const cliffLocalPos = new THREE.Vector3(-4.85, 4.15, 1.85);
  const cliffRotLocal = 0.88; // angled cleanly inward toward descending pilgrims
  const cliffRockPad = makeBox(3.75, 1.82, 0.68, 0, 0, 0);
  cliffRockPad.rotateY(cliffRotLocal);
  cliffRockPad.translate(cliffLocalPos.x - 0.25, cliffLocalPos.y, cliffLocalPos.z - 0.20);
  cStone.push(cliffRockPad);

  const browPlaquePos = cliffLocalPos
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  const browPlaque = createSignagePlaqueMesh(
    {
      text: '南 天 第 一 洞',
      subText: 'NAM THIÊN ĐỆ NHẤT ĐỘNG',
      style: 'stone',
      width: 3.45,
      height: 1.50,
      depth: 0.14
    },
    ctx
  );
  browPlaque.name = 'NamThienDeNhatDongPlaque';
  browPlaque.position.copy(browPlaquePos);
  browPlaque.rotation.y = caveRotY + cliffRotLocal;
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
  applyCaveTransform(cWood, woodParts);
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

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'ChuaHuongStoneAndKarst', true, true, 2.6);
  addMergedMesh(
    group,
    batTrangParts,
    ctx.materials.batTrangFloor ?? ctx.materials.stone,
    'ThienTruBatTrangCourtyard',
    false,
    true,
    1.6
  );
  addMergedMesh(group, whitePlasterParts, ctx.materials.whitePlaster, 'ThienTruWhitePedestalTrim');
  addMergedMesh(group, mossyRockParts, mossyKarstMat, 'HuongTichMossyGrottoAndQuanAm');
  addMergedMesh(
    group,
    brickParts,
    ctx.materials.weatheredImperialBrick ?? ctx.materials.chamBrick,
    'ThienTruVienCongBrickStupa',
    true,
    true,
    2.2
  );
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'SuoiYenSampanBoats');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'ThienTruTamQuanPillars');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'ThienTruTerracottaRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'ChuaHuongGoldShrine');
  addMergedMesh(
    group,
    bronzeParts,
    ctx.materials.bronzePatina ?? ctx.materials.bronze,
    'ChuaHuongBronzeBellAndUrn'
  );
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
  const plasterParts: THREE.BufferGeometry[] = [];
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

  // Helper for carved green-stone courtyard lanterns (*Đèn đá sân đền*)
  const addCourtyardStoneLantern = (
    targetStone: THREE.BufferGeometry[],
    targetCore: THREE.BufferGeometry[],
    x: number,
    y: number,
    z: number
  ) => {
    targetStone.push(
      makeBox(0.76, 0.24, 0.76, x, y + 0.12, z),
      makeCylinder(0.18, 0.24, 1.15, 6, x, y + 0.82, z),
      makeCylinder(0.38, 0.24, 0.18, 6, x, y + 1.48, z)
    );
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      targetStone.push(makeBox(0.07, 0.42, 0.07, x + Math.cos(a) * 0.24, y + 1.78, z + Math.sin(a) * 0.24));
    }
    targetCore.push(new THREE.SphereGeometry(0.13, 6, 5).translate(x, y + 1.78, z));
    const cap = createVietnameseCurvedRoofGeometry(0.95, 0.95, 0.22, 0.22, 0.38, 0.12);
    cap.translate(x, y + 1.98, z);
    targetStone.push(cap);
    targetStone.push(new THREE.SphereGeometry(0.09, 6, 5).translate(x, y + 2.40, z));
  };

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
        // Stop laterite cheek retaining wall cleanly at stair-tread level (sy - 0.04) beneath dragon curb -> ZERO Z-fighting!
        const latH = Math.max(0.8, h - 0.04);
        lateriteParts.push(
          makeBox(0.50, latH, stepLen + 0.10, sx + ox, bot + latH * 0.5, sz + oz, facingRotY)
        );
      }
    }

    // Sculpted Lê-dynasty dragon balustrades resting cleanly ON TOP of laterite stair cheeks
    for (const side of [-1, 1]) {
      const ox = Math.cos(facingRotY) * (halfW + 0.25) * side;
      const oz = -Math.sin(facingRotY) * (halfW + 0.25) * side;
      stoneParts.push(
        ...createCarvedDragonBalustradeParts(
          pStart.x + ox,
          yTopStart + 0.22,
          pStart.y + oz,
          pEnd.x + ox,
          yTopEnd + 0.22,
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
      mWood.push(makeCylinder(0.17, 0.20, mH, 10, px - 0.5, mFloorY + mH * 0.5, pz));
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
  mStone.push(...dtFin.mainParts, ...dtFin.goldParts);

  // Paired green-stone courtyard lanterns flanking Đền Trung terrace
  addCourtyardStoneLantern(mStone, mCore, -3.8, 0, 3.35);
  addCourtyardStoneLantern(mStone, mCore, 2.8, 0, 3.35);

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
      dgWood.push(makeCylinder(0.16, 0.19, shH, 10, shX + px, shBaseY + shH * 0.5, shZ + pz));
      dgStone.push(makeCylinder(0.25, 0.29, 0.20, 8, shX + px, shBaseY + 0.10, shZ + pz));
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
  dgStone.push(...dgFin.mainParts, ...dgFin.goldParts);
  addCourtyardStoneLantern(dgStone, dgCore, -5.6, dgFloorY, 4.2);
  addCourtyardStoneLantern(dgStone, dgCore, 5.6, dgFloorY, 4.2);

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

  // 2. AUTHENTIC Cổng Nghi Môn Đền Thượng (ref 79_den_thuong_den_hung.jpg):
  //    3-arch grey-plaster masonry gate + 4 square couplet pillars + 2 polychrome Guardian Warrior relief panels
  //    flanking the main arch + "南越肇祖" inscription with golden dragon + grey-plaster Lưỡng Long Chầu Nguyệt on top!
  const nghiX = nghiLanding.x;
  const nghiZ = nghiLanding.z;
  const nghiY = nghiLanding.topY;
  const nStone: THREE.BufferGeometry[] = [];
  const nPlaster: THREE.BufferGeometry[] = [];
  const nGold: THREE.BufferGeometry[] = [];
  const nLantern: THREE.BufferGeometry[] = [];
  const nLanternCore: THREE.BufferGeometry[] = [];

  // 3-arch grey-plaster masonry gate body (tall central arch + 2 flanking side arches)
  const midArch = createArchedWallGeometry(3.30, 5.25, 0.96, 2.18, 3.65);
  nPlaster.push(midArch);
  for (const side of [-1, 1]) {
    const sideArch = createArchedWallGeometry(2.15, 4.05, 0.86, 1.32, 2.68);
    sideArch.translate(side * 2.72, 0, 0);
    nPlaster.push(sideArch);
    // Stepped grey-plaster cornice caps over side arches
    nPlaster.push(
      makeBox(2.35, 0.22, 1.04, side * 2.72, 4.16, 0),
      makeBox(2.10, 0.24, 0.94, side * 2.72, 4.38, 0)
    );
  }

  // 4 square couplet pillars framing the 3 arches (outer pillars crowned by stone Nghê, inner by lotus/flame finials)
  for (const [px, colH] of [
    [-3.85, 5.45],
    [-1.65, 6.45],
    [1.65, 6.45],
    [3.85, 5.45]
  ]) {
    nStone.push(makeBox(0.92, 0.85, 0.96, px, 0.425, 0));
    nPlaster.push(makeBox(0.68, colH, 0.72, px, 0.85 + colH * 0.5, 0));
    // Vertical recessed couplet border molding on front face of each pillar
    nStone.push(makeBox(0.38, colH * 0.62, 0.08, px, 0.85 + colH * 0.45, 0.37));
    if (Math.abs(px) > 2.5) {
      nStone.push(makeBox(0.84, 0.24, 0.84, px, 0.85 + colH + 0.12, 0));
      nStone.push(...createGuardianBeastParts(px, 0.85 + colH + 0.24, 0, 0, 0.92, 'nghe'));
    } else {
      nPlaster.push(...createLotusFinialParts(px, 0.85 + colH, 0, 0.95));
    }
  }

  // Stepped grey-plaster pediment cornice crowning the central arch + grey-plaster Lưỡng Long Chầu Nguyệt!
  nPlaster.push(
    makeBox(3.85, 0.26, 1.18, 0, 5.38, 0),
    makeBox(3.45, 0.48, 1.02, 0, 5.75, 0),
    makeBox(3.05, 0.26, 0.92, 0, 6.12, 0)
  );
  const nghiFin = createRoofFinialSetParts(0, 6.26, 0, 3.0, 0, 0.86, false);
  nPlaster.push(...nghiFin.mainParts, ...nghiFin.goldParts);

  // Sculpted golden dragon arching right above the "南越肇祖" inscription tablet
  const archDragonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.25, 4.95, 0.56),
    new THREE.Vector3(-0.62, 5.18, 0.60),
    new THREE.Vector3(0, 5.06, 0.62),
    new THREE.Vector3(0.62, 5.18, 0.60),
    new THREE.Vector3(1.25, 4.95, 0.56)
  ]);
  nGold.push(new THREE.TubeGeometry(archDragonCurve, 14, 0.065, 6, false));
  nGold.push(new THREE.SphereGeometry(0.11, 7, 5).translate(0, 5.12, 0.64));

  for (const side of [-1, 1]) {
    nLantern.push(createRibbedLanternShellGeometry(0.20, 0.28, 8, 5).translate(side * 2.72, 3.65, 0.54));
    nLanternCore.push(createLanternCoreGeometry(0.12, 0.18).translate(side * 2.72, 3.65, 0.54));
  }

  const applyNghiTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(facingRotY);
      g.translate(nghiX, nghiY, nghiZ);
      dst.push(g);
    }
  };
  applyNghiTransform(nStone, stoneParts);
  applyNghiTransform(nPlaster, plasterParts);
  applyNghiTransform(nGold, goldParts);
  applyNghiTransform(nLantern, lanternParts);
  applyNghiTransform(nLanternCore, lanternCoreParts);

  // 2 Polychrome Guardian Warrior (*Võ Sĩ / Hộ Pháp*) relief panels flanking the main arch!
  for (const side of [-1, 1]) {
    const warPos = new THREE.Vector3(side * 1.65, 2.28, 0.42)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
      .add(new THREE.Vector3(nghiX, nghiY, nghiZ));
    const warriorPanel = createSignagePlaqueMesh(
      {
        text: 'HỘ PHÁP',
        subText: 'VÕ SĨ',
        style: 'lacquer_mural',
        motifSeed: side < 0 ? 791 : 792,
        width: 0.66,
        height: 1.65,
        depth: 0.08
      },
      ctx
    );
    warriorPanel.name = `DenHungNghiMonWarrior_${side < 0 ? 'Left' : 'Right'}`;
    warriorPanel.position.copy(warPos);
    warriorPanel.rotation.y = facingRotY;
    group.add(warriorPanel);
  }

  // Authentic "南越肇祖" (*NAM VIỆT TRIỆU TỔ*) inscription plaque above the central arch
  const nghiPlaquePos = new THREE.Vector3(0, 4.46, 0.52)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(nghiX, nghiY, nghiZ));
  const nghiPlaque = createSignagePlaqueMesh(
    {
      text: '南 越 肇 祖',
      subText: 'NAM VIỆT TRIỆU TỔ',
      style: 'stone',
      bgColor: '#c9c4b8',
      textColor: '#3a2b1c',
      borderColor: '#9c7e3a',
      width: 2.85,
      height: 0.78,
      depth: 0.14
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
      dWood.push(makeCylinder(0.22, 0.25, hallH, 10, px, floorY + hallH * 0.5, pz));
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
    // Carved green-stone courtyard lanterns flanking Đền Thượng sanctuary
    addCourtyardStoneLantern(dStone, dLanternCore, side * 5.8, courtTop, 6.2);
  }
  dWood.push(makeBox(10.8, 0.28, 5.8, 0, floorY + hallH - 0.10, -1.2));

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

  // Upper Clerestory Tier in dark ironwood with OPEN LATTICE WINDOWS
  const upperHallY = floorY + hallH + 1.45;
  const upperHallH = 1.90;
  for (const ux of [-4.2, -2.1, 0, 2.1, 4.2]) {
    for (const uz of [-3.2, 0.8]) {
      dWood.push(makeBox(0.22, upperHallH, 0.22, ux, upperHallY + upperHallH * 0.5, uz));
    }
  }
  dVoid.push(makeBox(7.8, upperHallH * 0.82, 3.3, 0, upperHallY + upperHallH * 0.5, -1.2));
  for (const zSide of [-3.2, 0.8]) {
    dWood.push(makeBox(8.6, 0.22, 0.20, 0, upperHallY + 0.11, zSide));
    dWood.push(makeBox(8.6, 0.22, 0.20, 0, upperHallY + upperHallH - 0.11, zSide));
    for (const bx of [-3.15, -1.05, 1.05, 3.15]) {
      dWood.push(makeBox(1.85, 0.06, 0.08, bx, upperHallY + upperHallH * 0.5, zSide));
      dWood.push(makeBox(0.06, upperHallH * 0.78, 0.08, bx, upperHallY + upperHallH * 0.5, zSide));
      const ring = new THREE.TorusGeometry(0.42, 0.045, 6, 12);
      ring.translate(bx, upperHallY + upperHallH * 0.5, zSide);
      dWood.push(ring);
    }
  }
  for (const xSide of [-4.2, 4.2]) {
    dWood.push(makeBox(0.20, 0.22, 4.2, xSide, upperHallY + 0.11, -1.2));
    dWood.push(makeBox(0.20, 0.22, 4.2, xSide, upperHallY + upperHallH - 0.11, -1.2));
    for (const bz of [-2.2, -0.2]) {
      dWood.push(makeBox(0.08, 0.06, 1.75, xSide, upperHallY + upperHallH * 0.5, bz));
      dWood.push(makeBox(0.08, upperHallH * 0.78, 0.06, xSide, upperHallY + upperHallH * 0.5, bz));
    }
  }
  dWood.push(makeBox(9.2, 0.22, 4.8, 0, upperHallY + upperHallH - 0.04, -1.2));

  const highRoof = createVietnameseCurvedRoofGeometry(11.6, 7.0, 4.6, 0.55, 2.65, 0.48);
  highRoof.translate(0, upperHallY + upperHallH + 0.02, -1.2);
  dRoof.push(highRoof);

  const crestY = upperHallY + upperHallH + 2.66;
  dStone.push(makeBox(4.8, 0.22, 0.22, 0, crestY, -1.2));
  const dtUpperFin = createRoofFinialSetParts(0, crestY + 0.06, -1.2, 4.8, 0, 0.94, true);
  dStone.push(...dtUpperFin.mainParts, ...dtUpperFin.goldParts);

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

  // 4. Ancient Weathered *Cột Đá Thề* (Natural Sculpted Stone Oath Pillar on Stepped Plinth) on West Terrace
  const oathX = -7.4;
  const oathZ = 5.4;
  dStone.push(makeBox(1.85, 0.36, 1.85, oathX, courtTop + 0.18, oathZ));
  dStone.push(makeBox(1.22, 0.30, 1.22, oathX, courtTop + 0.51, oathZ));
  const oathPillar = createSculptedRockGeometry(918, 0.44, 1.15, 0.42, 2);
  oathPillar.translate(oathX, courtTop + 1.65, oathZ);
  dStone.push(oathPillar);
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

  // 5. AUTHENTIC *Hùng Vương Lăng* (Tomb of the 6th Hung King — ref 10_den_hung_nghia_linh.jpg):
  //    Square mossy white-grey plastered mausoleum, 4 arched portals with Hổ Phù relief keystones,
  //    4 corner Hán couplet pilasters, "雄王陵" upper plaque, 2-tier roof with 4 white-grey plaster
  //    dragons crawling down all 4 hip ridges, pierced octagonal-flower stone balustrade & square stone censer!
  const tombLocal = new THREE.Vector3(16.6, 0, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY);
  const tombX = cx + tombLocal.x;
  const tombZ = cz + tombLocal.z;
  const tombY = ctx.getHeight(tombX, tombZ);
  ctx.exclusionCircles.push({ x: tombX, z: tombZ, r: 10.0 });

  const tStone: THREE.BufferGeometry[] = [];
  const tPlaster: THREE.BufferGeometry[] = [];
  const tLaterite: THREE.BufferGeometry[] = [];
  const tRoof: THREE.BufferGeometry[] = [];
  const tGold: THREE.BufferGeometry[] = [];
  const tLantern: THREE.BufferGeometry[] = [];
  const tLanternCore: THREE.BufferGeometry[] = [];

  const tPlatTop = 1.4;
  const tPlatH = tPlatTop + 5.5;
  tStone.push(makeBox(10.6, tPlatH, 10.6, 0, -5.5 + tPlatH * 0.5, 0));
  tLaterite.push(makeBox(11.0, 0.36, 11.0, 0, tPlatTop - 0.18, 0));

  // Pierced octagonal-flower stone balustrade (`lotus_stone`) surrounding Hùng Vương Lăng
  tStone.push(
    ...createPiercedBalustradeParts(-5.0, -5.0, 5.0, -5.0, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(-5.0, -5.0, -5.0, 5.0, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(5.0, -5.0, 5.0, 5.0, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(-5.0, 5.0, -1.9, 5.0, tPlatTop, 1.05, 'lotus_stone'),
    ...createPiercedBalustradeParts(1.9, 5.0, 5.0, 5.0, tPlatTop, 1.05, 'lotus_stone')
  );
  for (const side of [-1, 1]) {
    tStone.push(makeBox(0.84, 0.65, 0.84, side * 1.55, tPlatTop + 0.325, 5.05));
    tStone.push(...createGuardianBeastParts(side * 1.55, tPlatTop + 0.65, 5.05, 0, 0.90, 'kylan'));
    addCourtyardStoneLantern(tStone, tLanternCore, side * 3.6, tPlatTop, 3.6);
  }

  // Square mossy white-grey plastered mausoleum centered at (0, tBaseY, -0.4)
  const tombCenterZ = -0.4;
  const tBaseY = tPlatTop + 0.36;
  const tombHalf = 2.30;
  const tombWallH = 3.45;
  tStone.push(makeBox(5.8, 0.36, 5.8, 0, tPlatTop + 0.18, tombCenterZ));

  // 4 Arched Portals on all 4 cardinal sides + sculpted Hổ Phù (tiger-mask) relief keystones!
  for (let sideIdx = 0; sideIdx < 4; sideIdx++) {
    const rot = sideIdx * Math.PI * 0.5;
    const archWall = createArchedWallGeometry(tombHalf * 2.0, tombWallH, 0.52, 2.05, 2.48);
    archWall.translate(0, 0, tombHalf - 0.16);
    archWall.rotateY(rot);
    archWall.translate(0, tBaseY, tombCenterZ);
    tPlaster.push(archWall);

    // Sculpted Hổ Phù tiger-mask relief keystone directly above each arch crown
    const hoPhuGroup: THREE.BufferGeometry[] = [];
    const maskFace = new THREE.SphereGeometry(0.28, 8, 6);
    maskFace.scale(1.25, 0.92, 0.52);
    maskFace.translate(0, 2.68, tombHalf + 0.16);
    hoPhuGroup.push(maskFace);
    for (const sx of [-1, 1]) {
      const volute = new THREE.TorusGeometry(0.16, 0.05, 5, 10);
      volute.translate(sx * 0.36, 2.62, tombHalf + 0.15);
      hoPhuGroup.push(volute);
    }
    const archLip = new THREE.TorusGeometry(1.08, 0.065, 6, 16, Math.PI);
    archLip.translate(0, 1.46, tombHalf + 0.12);
    hoPhuGroup.push(archLip);
    for (const g of hoPhuGroup) {
      g.rotateY(rot);
      g.translate(0, tBaseY, tombCenterZ);
      tPlaster.push(g);
    }
  }

  // 4 Square Corner Hán-Character Couplet Pilasters
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * tombHalf;
      const pz = tombCenterZ + sz * tombHalf;
      tStone.push(makeBox(0.68, 0.36, 0.68, px, tBaseY + 0.18, pz));
      tPlaster.push(makeBox(0.56, tombWallH + 0.12, 0.56, px, tBaseY + (tombWallH + 0.12) * 0.5, pz));
      // Inset couplet panel border on front/side pilaster faces
      tStone.push(
        makeBox(0.28, 2.15, 0.06, px, tBaseY + 1.65, pz + sz * 0.29),
        makeBox(0.06, 2.15, 0.28, px + sx * 0.29, tBaseY + 1.65, pz)
      );
    }
  }
  // Upper plaster frieze band around mausoleum top
  tPlaster.push(makeBox(5.25, 0.34, 5.25, 0, tBaseY + tombWallH + 0.08, tombCenterZ));

  // Inner ancestral stone burial sarcophagus & royal tablet visible through all 4 arches
  tStone.push(makeBox(2.15, 1.12, 2.35, 0, tBaseY + 0.56, tombCenterZ));
  tGold.push(makeBox(0.56, 0.98, 0.12, 0, tBaseY + 1.52, tombCenterZ - 0.65));

  // Square Carved Stone Censer (*Lư hương đá vuông*) centered in front of Hùng Vương Lăng + GPU Smoke
  const sqCenserZ = 3.15;
  tStone.push(
    makeBox(1.55, 0.28, 1.55, 0, tPlatTop + 0.14, sqCenserZ),
    makeBox(1.18, 0.34, 1.18, 0, tPlatTop + 0.45, sqCenserZ),
    makeBox(1.38, 0.72, 1.08, 0, tPlatTop + 0.98, sqCenserZ),
    makeBox(1.52, 0.14, 1.22, 0, tPlatTop + 1.38, sqCenserZ)
  );
  for (const side of [-1, 1]) {
    const ear = new THREE.TorusGeometry(0.18, 0.045, 5, 10, Math.PI);
    ear.translate(side * 0.66, tPlatTop + 1.44, sqCenserZ);
    tStone.push(ear);
  }
  const tombSmokeWorld = new THREE.Vector3(0, tPlatTop + 1.52, sqCenserZ)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(tombX, tombY, tombZ));
  smokeSources.push({ x: tombSmokeWorld.x, y: tombSmokeWorld.y, z: tombSmokeWorld.z, scale: 0.95 });

  // 2-Tier Mossy Mausoleum Roof with 4 White-Grey Plaster Dragons crawling down ALL 4 Hip Ridges!
  const tRoof1Y = tBaseY + tombWallH + 0.24;
  const tRoof1 = createVietnameseCurvedRoofGeometry(7.0, 7.0, 3.8, 3.8, 1.62, 0.40);
  tRoof1.translate(0, tRoof1Y, tombCenterZ);
  tRoof.push(tRoof1);

  // Mossy white-grey plaster clerestory neck between Tier 1 & Tier 2 roofs
  const tNeckY = tRoof1Y + 1.32;
  tPlaster.push(makeBox(3.45, 0.96, 3.45, 0, tNeckY + 0.48, tombCenterZ));
  const tRoof2Y = tNeckY + 0.94;
  const tRoof2 = createVietnameseCurvedRoofGeometry(5.1, 5.1, 0.95, 0.95, 1.92, 0.44);
  tRoof2.translate(0, tRoof2Y, tombCenterZ);
  tRoof.push(tRoof2);
  // Mossy white-grey plaster lotus-gourd finial crowning the mausoleum apex
  tPlaster.push(...createLotusFinialParts(0, tRoof2Y + 1.90, tombCenterZ, 1.15));

  // 4 Sculpted White-Grey Plaster Dragons crawling down all 4 diagonal hip ridges (on BOTH tiers!)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // Lower tier hip-ridge plaster dragon
      const d1Curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 1.85, tRoof1Y + 1.56, tombCenterZ + sz * 1.85),
        new THREE.Vector3(sx * 2.45, tRoof1Y + 0.88, tombCenterZ + sz * 2.45),
        new THREE.Vector3(sx * 3.05, tRoof1Y + 0.46, tombCenterZ + sz * 3.05),
        new THREE.Vector3(sx * 3.45, tRoof1Y + 0.62, tombCenterZ + sz * 3.45)
      ]);
      tPlaster.push(new THREE.TubeGeometry(d1Curve, 12, 0.12, 6, false));
      const d1Head = new THREE.SphereGeometry(0.18, 7, 6);
      d1Head.translate(sx * 3.48, tRoof1Y + 0.68, tombCenterZ + sz * 3.48);
      tPlaster.push(d1Head);

      // Upper tier hip-ridge plaster dragon
      const d2Curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.55, tRoof2Y + 1.86, tombCenterZ + sz * 0.55),
        new THREE.Vector3(sx * 1.35, tRoof2Y + 1.05, tombCenterZ + sz * 1.35),
        new THREE.Vector3(sx * 2.05, tRoof2Y + 0.48, tombCenterZ + sz * 2.05),
        new THREE.Vector3(sx * 2.52, tRoof2Y + 0.64, tombCenterZ + sz * 2.52)
      ]);
      tPlaster.push(new THREE.TubeGeometry(d2Curve, 12, 0.11, 6, false));
      const d2Head = new THREE.SphereGeometry(0.16, 7, 6);
      d2Head.translate(sx * 2.55, tRoof2Y + 0.70, tombCenterZ + sz * 2.55);
      tPlaster.push(d2Head);
    }
  }

  const applyTombTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(facingRotY);
      g.translate(tombX, tombY, tombZ);
      dst.push(g);
    }
  };
  applyTombTransform(tStone, stoneParts);
  applyTombTransform(tPlaster, plasterParts);
  applyTombTransform(tLaterite, lateriteParts);
  applyTombTransform(tRoof, roofParts);
  applyTombTransform(tGold, goldParts);
  applyTombTransform(tLantern, lanternParts);
  applyTombTransform(tLanternCore, lanternCoreParts);

  // Readable "雄王陵" (*HÙNG VƯƠNG LĂNG*) upper plaster/stone plaque above the front South arch
  const tombPlaquePos = new THREE.Vector3(0, tBaseY + 3.16, tombCenterZ + tombHalf + 0.16)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(tombX, tombY, tombZ));
  const tombPlaque = createSignagePlaqueMesh(
    {
      text: '雄 王 陵',
      subText: 'HÙNG VƯƠNG LĂNG',
      style: 'stone',
      bgColor: '#cfc9bc',
      textColor: '#2d241b',
      borderColor: '#7a7265',
      width: 2.35,
      height: 0.68,
      depth: 0.12
    },
    ctx
  );
  tombPlaque.name = 'HungVuongLangPlaque';
  tombPlaque.position.copy(tombPlaquePos);
  tombPlaque.rotation.y = facingRotY;
  group.add(tombPlaque);

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'DenHungStoneStepsAndPlinth', true, true, 2.4);
  addMergedMesh(
    group,
    plasterParts,
    ctx.materials.mossyPlaster ?? ctx.materials.agedPlaster ?? ctx.materials.whitePlaster,
    'DenHungWeatheredPlasterMasonry',
    true,
    true,
    2.2
  );
  addMergedMesh(
    group,
    lateriteParts,
    ctx.materials.lateriteHoneycomb ?? ctx.materials.stone,
    'DenHungLateriteCurbs',
    true,
    true,
    2.0
  );
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'DenHungCrimsonHall');
  addMergedMesh(
    group,
    woodParts,
    ctx.materials.darkIronwood ?? ctx.materials.darkWood,
    'DenHungTimberSanctuary'
  );
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'DenHungCurvedRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'DenHungGoldFrieze');
  addMergedMesh(
    group,
    bronzeParts,
    ctx.materials.bronzePatina ?? ctx.materials.bronze,
    'DenHungBronzeCenser'
  );
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
  const stoneParts: THREE.BufferGeometry[] = [];
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

    // Fix floating shrubs on Ha Long archType === 0 spire by keeping radial placement tightly inside spire taper (rad * 0.40)
    const isSpire = Math.abs(Math.floor(k.seed)) % 3 === 0;
    const topX = k.x + k.lx;
    const topZ = k.z + k.lz;
    const topY = k.h - (isSpire ? 6.2 : 4.2);
    const crownR = isSpire ? k.r * 0.36 : k.r * 0.60;
    const crown = createSculptedRockGeometry(k.seed + 50, crownR, k.h * 0.13, crownR, 2);
    crown.translate(topX, topY, topZ);
    karstFoliageParts.push(crown);

    for (let c = 0; c < 6; c++) {
      const ca = (c / 6) * Math.PI * 2 + k.seed * 0.4;
      const fracH = 0.56 + (c % 3) * 0.14;
      const baseRad = k.r * (0.72 - fracH * 0.25);
      const rad = isSpire ? baseRad * 0.40 : baseRad * 0.92;
      const puffR = isSpire ? k.r * 0.20 : k.r * 0.27;
      const puff = createSculptedRockGeometry(
        k.seed + 70 + c * 11,
        puffR,
        k.h * 0.075,
        puffR,
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
    const cornerGrounds: Array<{ ox: number; oz: number; gy: number }> = [];

    for (const ox of postXs) {
      for (const oz of postZs) {
        const wx = sh.x + ox * Math.cos(sh.rotY) + oz * Math.sin(sh.rotY);
        const wz = sh.z - ox * Math.sin(sh.rotY) + oz * Math.cos(sh.rotY);
        const gy = ctx.getHeight(wx, wz);
        if (gy > maxGroundY) maxGroundY = gy;
        cornerGrounds.push({ ox, oz, gy });
      }
    }

    const deckY = maxGroundY + 2.25;
    const localStone: THREE.BufferGeometry[] = [];
    const localWood: THREE.BufferGeometry[] = [];
    const localRoof: THREE.BufferGeometry[] = [];
    const localVoid: THREE.BufferGeometry[] = [];
    const localCorn: THREE.BufferGeometry[] = [];
    const localBrocade: THREE.BufferGeometry[] = [];

    // 12 timber stilts seated firmly on carved SQUARE STONE FOOTING PADS (*đá kê chân cột*)
    for (const p of cornerGrounds) {
      localStone.push(makeBox(0.56, 1.45, 0.56, p.ox, p.gy - 0.50, p.oz));
      localStone.push(makeBox(0.46, 0.16, 0.46, p.ox, p.gy + 0.28, p.oz));
      const postBot = p.gy + 0.24;
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

    // Thick 2-slope palm-thatch pitched gable roof (`createGableRoofGeometry` + `thatchFiber`!)
    // + horizontal wooden plank gable end triangles closing both -X & +X peaks
    const roofBaseY = deckY + 2.75;
    const roofH = 3.25;
    const roofCenterZ = -0.25;
    const roof = createGableRoofGeometry(11.4, 9.2, roofH, 0.36, 'x');
    roof.translate(0, roofBaseY, roofCenterZ);
    localRoof.push(roof);

    // Horizontal wood gable plank triangles closing both -X & +X triangular gable ends
    const gableCourses = 8;
    const courseH = roofH / gableCourses;
    for (const side of [-1, 1]) {
      const gxWall = side * (houseW * 0.5 - 0.06);
      for (let c = 0; c < gableCourses; c++) {
        const frac = (c + 0.5) / gableCourses;
        const plankD = Math.max(0.32, (1.0 - frac) * 8.4);
        localWood.push(makeBox(0.16, courseH * 0.96, plankD, gxWall, roofBaseY + (c + 0.5) * courseH, roofCenterZ));
      }
    }

    // Authentic crossed **Khau Cút** wooden gable finials at BOTH gable peaks of the 2-slope pitched roof!
    const ridgeTopY = roofBaseY + roofH;
    for (const side of [-1, 1]) {
      const gx = side * 5.45;
      const gz = roofCenterZ;
      const hornA = makeBox(0.12, 1.55, 0.12, 0, 0, 0);
      hornA.rotateX(0.58);
      hornA.translate(gx, ridgeTopY + 0.44, gz);
      const hornB = makeBox(0.12, 1.55, 0.12, 0, 0, 0);
      hornB.rotateX(-0.58);
      hornB.translate(gx, ridgeTopY + 0.44, gz);
      const crest = makeCylinder(0.05, 0.11, 0.72, 6, gx, ridgeTopY + 0.62, gz);
      localWood.push(hornA, hornB, crest);
    }

    // Under-stilt cultural life: Traditional Wooden Weaving Loom (*Khung Cửi*) grounded accurately via getLocalGround!
    const loomX = -2.4;
    const loomZ = 0.6;
    const loomGroundY = getLocalGround(loomX, loomZ);
    const loomTopY = loomGroundY + 1.18;
    for (const lx of [-0.65, 0.65]) {
      for (const lz of [-0.95, 0.95]) {
        const legGround = getLocalGround(loomX + lx, loomZ + lz) - 0.15;
        const legH = Math.max(0.65, loomTopY - legGround);
        localWood.push(makeBox(0.10, legH, 0.10, loomX + lx, legGround + legH * 0.5, loomZ + lz));
      }
      localWood.push(makeBox(0.10, 0.10, 2.05, loomX + lx, loomTopY - 0.06, loomZ));
    }
    localWood.push(makeBox(1.42, 0.10, 0.10, loomX, loomGroundY + 0.85, loomZ - 0.85));
    localWood.push(makeBox(1.42, 0.10, 0.10, loomX, loomGroundY + 0.85, loomZ + 0.85));
    // Woven crimson highland brocade cloth stretched across loom
    localBrocade.push(makeBox(1.05, 0.06, 1.55, loomX, loomGroundY + 0.88, loomZ));

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
    applyHouse(localStone, stoneParts);
    applyHouse(localWood, timberParts);
    applyHouse(localRoof, roofParts);
    applyHouse(localVoid, voidParts);
    applyHouse(localCorn, cornParts);
    applyHouse(localBrocade, brocadeParts);
  }

  addMergedMesh(group, karstParts, mossyKarstMat, 'NorthernDistantKarstIslets');
  addMergedMesh(group, karstFoliageParts, karstJungleMat, 'NorthernDistantKarstFoliage');
  addMergedMesh(group, stoneParts, ctx.materials.stone, 'MuCangChaiStiltFootingStones');
  addMergedMesh(group, timberParts, ctx.materials.darkWood, 'MuCangChaiStiltHousesTimber');
  addMergedMesh(
    group,
    roofParts,
    ctx.materials.thatchFiber ?? ctx.materials.darkRoof,
    'MuCangChaiStiltHousesRoofs'
  );
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
