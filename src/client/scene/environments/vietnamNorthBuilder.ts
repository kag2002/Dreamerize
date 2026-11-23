import * as THREE from 'three';
import {
  VietnamBuilderContext,
  applyWorldBoxUV,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createGableRoofGeometry,
  createHaLongKarstGeometry,
  createHueImperialHipRoofGeometry,
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
  createCarvedTurtleSteleParts,
  createDongSonDrum3DParts,
  createGuardianBeastParts,
  createPiercedBalustradeParts,
  createRealisticAncientBanyanParts,
  createRoofFinialSetParts,
  createSculptedDeityParts,
  createSignagePlaqueMesh,
  createSmoothTaperedTubeGeometry,
  createMotifBandParts,
  createShouCharacterParts,
  createLotusPetalRingParts,
  createPhoenixFinialParts,
  createCuaVongParts,
  createDoorStudGridParts,
  createBasReliefPanelParts,
  createLouverShutterParts,
  createKhauCutGableParts,
  createAncientStoneLanternParts,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  createMergedMesh,
  registerAnimatedUniform,
  transformGeometryXZY
} from '../vietnam/geometry/PartsBuilder';
import { buildThangLongCitadelComplex } from './thangLongCitadelBuilder';

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

  // FIX HT-02: Authentic flush stone jambs & threshold ONLY (removed ahistorical protruding Roman arch voussoirs!)
  for (const side of [-1, 1]) {
    const jx = cx + side * (haw + 0.14);
    stoneParts.push(makeBox(0.28, springY, gateDepth + 0.08, jx, wallY + springY * 0.5, cz));
  }

  stoneParts.push(makeBox(archWidth + 0.56, 0.20, gateDepth + 0.24, cx, wallY + 0.06, cz));

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
  buildThangLongCitadelComplex(ctx, stainlessMat, flagUniforms);
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
  const cx = -410;
  const cz = -360;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 24.0 },
    { x: -378, z: -345, r: 12.0 },
    { x: -440, z: -335, r: 11.0 },
    { x: -362, z: -336, r: 14.0 }
  );

  const group = new THREE.Group();
  group.name = 'LungCuFlagpoleComplex';

  const greenStoneMat = ctx.materials.stone;
  const lungCuRedBandMat = ctx.materials.crimsonLacquer;

  const dongSonMedallionMat = ctx.materials.bronzePatina ?? ctx.materials.bronze;

  const whiteGlobeMat = ctx.materials.lanternCore ?? ctx.materials.whitePlaster;
  const pondWaterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.granite;

  const buckwheatMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#d93c8f', roughness: 0.48, metalness: 0.02, side: THREE.DoubleSide }) ??
    ctx.materials.crimsonLacquer;

  const highlandFoliageMat = ctx.materialLib?.getOrCreateStandard({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide }) ?? ctx.materials.darkWood;

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

  // 3. FIX LC-01: Authentic Tall Slender Octagonal Granite Tower Shaft (slender 18m shaft, rBot 2.08m -> rTop 1.62m per ref 07 & 62!)
  const shaftBotY = redBandTopY + 0.16;
  const shaftTopY = yBase + 25.2;
  const shaftH = shaftTopY - shaftBotY;
  const shaftBotR = 2.08;
  const shaftTopR = 1.62;
  graniteParts.push(
    makeCylinder(shaftTopR, shaftBotR, shaftH, 8, cx, shaftBotY + shaftH * 0.5, cz, 0, 0, octRotY)
  );

  // FIX LC-02: Continuous tall vertical ventilation slit channel along all 8 octagonal shaft faces with 14 horizontal louver bars (ref 07, 62!)
  const slitH = shaftH * 0.78;
  const slitMidY = shaftBotY + shaftH * 0.50;
  const slitMidR = ((shaftBotR + shaftTopR) * 0.5) * Math.cos(Math.PI / 8);
  const shaftBatterTilt = Math.atan2((shaftBotR - shaftTopR) * Math.cos(Math.PI / 8), shaftH);
  for (let f = 0; f < 8; f++) {
    const ang = Math.PI * 0.25 + (f / 8) * Math.PI * 2;
    const rot = Math.PI * 0.5 - ang;
    const vx = cx + Math.cos(ang) * (slitMidR + 0.03);
    const vz = cz + Math.sin(ang) * (slitMidR + 0.03);

    const slotVoid = makeBox(0.36, slitH, 0.08, 0, 0, 0);
    slotVoid.rotateX(-shaftBatterTilt);
    slotVoid.rotateY(rot);
    slotVoid.translate(vx, slitMidY, vz);
    voidParts.push(slotVoid);

    // Flush stone trim surround framing the continuous vertical slit
    for (const sx of [-0.22, 0.22]) {
      const jamb = makeBox(0.08, slitH + 0.12, 0.12, sx, 0, 0.02);
      jamb.rotateX(-shaftBatterTilt);
      jamb.rotateY(rot);
      jamb.translate(vx, slitMidY, vz);
      stoneParts.push(jamb);
    }
    // 14 Horizontal stone louver bars dividing the continuous vertical ventilation channel
    for (let lb = 0; lb < 14; lb++) {
      const ly = THREE.MathUtils.lerp(-slitH * 0.48, slitH * 0.48, lb / 13);
      const hBar = makeBox(0.40, 0.07, 0.10, 0, ly, 0.03);
      hBar.rotateX(-shaftBatterTilt);
      hBar.rotateY(rot);
      hBar.translate(vx, slitMidY, vz);
      stoneParts.push(hBar);
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
  // FIX LC-04: Dense 32 stainless vertical pickets around the circular Lũng Cú observation deck (ref 62!)
  for (let p = 0; p < 32; p++) {
    const a = (p / 32) * Math.PI * 2;
    steelParts.push(
      makeCylinder(0.028, 0.032, 1.14, 5, cx + Math.cos(a) * railR, railY + 0.57, cz + Math.sin(a) * railR)
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

  // 4. Twin Hồ Mắt Rồng (Dragon Eye Ponds) on lower flanks (-378, -345) & (-440, -335)
  const dragonPonds = [
    { x: -378, z: -345, r: 9.2 },
    { x: -440, z: -335, r: 8.4 }
  ];
  for (let pi = 0; pi < dragonPonds.length; pi++) {
    const pond = dragonPonds[pi];
    const py = Math.max(
      ctx.getHeight(pond.x, pond.z),
      ctx.getHeight(pond.x - pond.r, pond.z - pond.r),
      ctx.getHeight(pond.x + pond.r, pond.z - pond.r),
      ctx.getHeight(pond.x, pond.z - pond.r)
    );
    // Skirted terraced stone basin so pond sits level on hillside without being buried by upslope terrain
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
    { x: -364, z: -339, rotY: -0.65, w: 6.4, d: 4.6 },
    { x: -354, z: -347, rotY: -0.95, w: 5.8, d: 4.4 },
    { x: -366, z: -325, rotY: -0.35, w: 6.0, d: 4.5 }
  ];
  for (const cot of cottages) {
    const cCos = Math.cos(cot.rotY);
    const cSin = Math.sin(cot.rotY);
    const gy = Math.max(
      ctx.getHeight(cot.x, cot.z),
      ctx.getHeight(cot.x + cot.w * 0.5 * cCos + cot.d * 0.5 * cSin, cot.z - cot.w * 0.5 * cSin + cot.d * 0.5 * cCos),
      ctx.getHeight(cot.x - cot.w * 0.5 * cCos + cot.d * 0.5 * cSin, cot.z + cot.w * 0.5 * cSin + cot.d * 0.5 * cCos),
      ctx.getHeight(cot.x + cot.w * 0.5 * cCos - cot.d * 0.5 * cSin, cot.z - cot.w * 0.5 * cSin - cot.d * 0.5 * cCos),
      ctx.getHeight(cot.x - cot.w * 0.5 * cCos - cot.d * 0.5 * cSin, cot.z + cot.w * 0.5 * cSin - cot.d * 0.5 * cCos)
    );
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
    { x: -372, z: -336 },
    { x: -385, z: -338 },
    { x: -360, z: -332 },
    { x: -428, z: -338 }
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

  // FIX LC-05: Dragon Mountain blue-tiled stop-over pavilion (*Nhà dừng chân mái ngói xanh lam*) & extended approach stair steps below Lũng Cú (ref 07!)
  const stopX = cx + 8.5;
  const stopZ = cz + 28.0;
  const stopY = Math.max(
    ctx.getHeight(stopX, stopZ),
    ctx.getHeight(stopX - 3.6, stopZ - 2.7),
    ctx.getHeight(stopX + 3.6, stopZ - 2.7),
    ctx.getHeight(stopX - 3.6, stopZ + 2.7),
    ctx.getHeight(stopX + 3.6, stopZ + 2.7)
  );
  stoneParts.push(makeBox(7.2, 4.2, 5.4, stopX, stopY - 1.2, stopZ));
  for (const ox of [-2.8, 2.8]) {
    for (const oz of [-2.0, 2.0]) {
      woodParts.push(makeCylinder(0.14, 0.16, 3.25, 6, stopX + ox, stopY + 2.42, stopZ + oz));
    }
  }
  const stopRoof = createVietnameseCurvedRoofGeometry(8.4, 6.6, 4.2, 1.2, 1.85, 0.24);
  stopRoof.translate(stopX, stopY + 4.0, stopZ);
  const btCol = new THREE.Color('#2b5e8c');
  const btArr = new Float32Array(stopRoof.attributes.position.count * 3);
  for (let vi = 0; vi < stopRoof.attributes.position.count; vi++) {
    btArr[vi * 3] = btCol.r;
    btArr[vi * 3 + 1] = btCol.g;
    btArr[vi * 3 + 2] = btCol.b;
  }
  stopRoof.setAttribute('color', new THREE.BufferAttribute(btArr, 3));
  const blueTileMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.75 }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  ctx.extraMaterials.push(blueTileMat);
  group.add(new THREE.Mesh(stopRoof, blueTileMat));
  // Extended winding stone stairway descending Dragon Mountain slope
  for (let st = 0; st < 16; st++) {
    const sx = cx + 2.5 + st * 0.42;
    const sz = cz + 14.5 + st * 1.15;
    const sy = ctx.getHeight(sx, sz);
    stoneParts.push(makeBox(3.4, 1.45, 1.05, sx, sy - 0.30, sz));
  }

  // Stone Lanterns seated cleanly on Tier-1 terrace flanking SE approach (`HV-NEW-MB-12`)
  graniteParts.push(
    ...createAncientStoneLanternParts(cx + 5.8, balY, cz + 9.5, 0.95),
    ...createAncientStoneLanternParts(cx + 9.5, balY, cz + 5.8, 0.95)
  );
  // 7. LŨNG CÚ & LÔ LÔ CHẢI QC EXPANSIONS (Items 146..157)
  // 146-149. Stepped stone pilgrimage stairway, Đài Vọng Cảnh overlook terrace (with deep hillside skirt!), Trống Đồng display & Sovereignty Stele
  for (let st = 0; st < 8; st++) {
    const sx = cx + 10.5 + st * 1.65;
    const sz = cz + 10.5 + st * 1.65;
    const sy = ctx.getHeight(sx, sz);
    stoneParts.push(makeBox(2.8, 1.45, 2.2, sx, sy - 0.38, sz, -Math.PI * 0.25));
  }
  const ovX = cx + 14.5;
  const ovZ = cz - 6.0;
  const ovY = Math.max(
    ctx.getHeight(ovX, ovZ),
    ctx.getHeight(ovX - 2.6, ovZ - 2.6),
    ctx.getHeight(ovX + 2.6, ovZ - 2.6),
    ctx.getHeight(ovX - 2.6, ovZ + 2.6),
    ctx.getHeight(ovX + 2.6, ovZ + 2.6)
  );
  stoneParts.push(
    makeBox(5.2, 4.2, 5.2, ovX, ovY - 1.45, ovZ),
    ...createPiercedBalustradeParts(ovX - 2.4, ovZ - 2.4, ovX + 2.4, ovZ - 2.4, ovY + 0.65, 0.82, 'chu_van'),
    ...createPiercedBalustradeParts(ovX + 2.4, ovZ - 2.4, ovX + 2.4, ovZ + 2.4, ovY + 0.65, 0.82, 'chu_van')
  );
  bronzeParts.push(...createDongSonDrum3DParts(cx + 9.2, balY, cz + 8.8, 0.72));
  stoneParts.push(makeBox(1.15, 1.55, 0.28, cx + 6.5, balY + 0.78, cz + 11.0));

  // 150-157. Lô Lô Chải dry-stacked stone fences, corn mill, granary shed, Cultural Pavilion (with hillside skirt!), plum/peach blossoms, village gate & Hồ Mắt Rồng pier
  const llcX = cx - 22.0;
  const llcZ = cz + 26.0;
  const llcY = Math.max(
    ctx.getHeight(llcX, llcZ),
    ctx.getHeight(llcX + 5.5, llcZ - 2.5),
    ctx.getHeight(llcX - 4.2, llcZ + 2.5),
    ctx.getHeight(llcX + 8.0, llcZ - 4.5)
  );
  stoneParts.push(
    makeBox(14.0, 1.65, 0.42, llcX, llcY + 0.02, llcZ - 5.5),
    makeBox(0.42, 1.65, 11.0, llcX - 7.0, llcY + 0.02, llcZ),
    makeCylinder(0.48, 0.52, 0.55, 10, llcX + 2.5, llcY + 0.28, llcZ + 1.5),
    makeBox(5.6, 3.6, 4.2, llcX + 5.5, llcY - 1.52, llcZ - 2.5),
    makeBox(3.0, 3.2, 2.6, llcX - 4.2, llcY - 1.45, llcZ + 2.5)
  );
  // 152-153. Timber granary shed & Nhà Văn Hóa Lô Lô Chải community pavilion
  woodParts.push(
    makeBox(2.6, 2.1, 2.2, llcX - 4.2, llcY + 1.15, llcZ + 2.5),
    makeBox(5.2, 0.28, 3.8, llcX + 5.5, llcY + 0.28, llcZ - 2.5)
  );
  darkRoofParts.push(
    makeBox(3.1, 0.35, 2.7, llcX - 4.2, llcY + 2.38, llcZ + 2.5),
    createGableRoofGeometry(5.8, 4.4, 1.35).translate(llcX + 5.5, llcY + 2.75, llcZ - 2.5)
  );
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-1.5, 1.5]) {
      woodParts.push(makeCylinder(0.11, 0.12, 2.55, 6, llcX + 5.5 + dx, llcY + 1.52, llcZ - 2.5 + dz));
    }
  }
  // 154-155. Peach/plum blossom trees (cleanly clear of market stalls!) & village entrance arch
  for (const bxOff of [-5.8, 5.8]) {
    const by = ctx.getHeight(llcX + bxOff, llcZ + 5.2);
    woodParts.push(makeCylinder(0.12, 0.18, 2.2, 6, llcX + bxOff, by + 1.1, llcZ + 5.2));
    buckwheatParts.push(new THREE.DodecahedronGeometry(1.05, 0).translate(llcX + bxOff, by + 2.45, llcZ + 5.2));
  }
  const archBaseY = ctx.getHeight(llcX, llcZ + 6.5);
  woodParts.push(
    makeBox(0.24, 3.4, 0.24, llcX - 1.6, archBaseY + 1.5, llcZ + 6.5),
    makeBox(0.24, 3.4, 0.24, llcX + 1.6, archBaseY + 1.5, llcZ + 6.5),
    makeBox(3.8, 0.32, 0.32, llcX, archBaseY + 3.25, llcZ + 6.5)
  );
  // 156-157. Hồ Mắt Rồng viewing pier & terraced retaining wall (aligned to pond rim top!)
  const mrY = Math.max(
    ctx.getHeight(-378, -345),
    ctx.getHeight(-378 - 9.2, -345 - 9.2),
    ctx.getHeight(-378 + 9.2, -345 - 9.2),
    ctx.getHeight(-378, -345 - 9.2)
  );
  woodParts.push(
    makeBox(2.2, 0.24, 3.6, -378, mrY + 0.45, -335.0),
    makeCylinder(0.10, 0.12, 1.85, 5, -378.9, mrY - 0.35, -336.5),
    makeCylinder(0.10, 0.12, 1.85, 5, -377.1, mrY - 0.35, -336.5)
  );
  stoneParts.push(makeBox(12.0, 2.25, 0.65, cx - 16.0, ctx.getHeight(cx - 16.0, cz + 14.0) - 0.20, cz + 14.0));

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

  // 7B. LŨNG CÚ & LÔ LÔ CHẢI WAVE 2 REAL-WORLD DETAILS (Items 351..360, castShadow = false, 0 new materials)
  const lcW2Stone: THREE.BufferGeometry[] = [];
  const lcW2Wood: THREE.BufferGeometry[] = [];
  const lcW2Crimson: THREE.BufferGeometry[] = [];
  const lcW2Gold: THREE.BufferGeometry[] = [];
  const lcW2Steel: THREE.BufferGeometry[] = [];
  // 351. Chợ Phiên Cao Nguyên (3 highland market stalls with brocade canopies near Lô Lô Chải)
  for (let ms = 0; ms < 3; ms++) {
    const mx = llcX + 9.5 + ms * 3.4;
    const mz = llcZ + 4.5;
    const my = ctx.getHeight(mx, mz);
    lcW2Wood.push(
      makeBox(0.10, 2.2, 0.10, mx - 1.1, my + 1.1, mz - 0.9),
      makeBox(0.10, 2.2, 0.10, mx + 1.1, my + 1.1, mz - 0.9),
      makeBox(0.10, 2.2, 0.10, mx - 1.1, my + 1.1, mz + 0.9),
      makeBox(0.10, 2.2, 0.10, mx + 1.1, my + 1.1, mz + 0.9),
      makeBox(2.0, 0.68, 0.72, mx, my + 0.34, mz)
    );
    lcW2Crimson.push(makeBox(2.55, 0.18, 2.2, mx, my + 2.28, mz));
  }
  // 352-354. Corn-cob drying rack, highland rainwater stone cistern & outdoor hearth with firewood pile
  lcW2Wood.push(
    makeBox(0.10, 1.85, 0.10, llcX - 1.2, llcY + 0.92, llcZ - 2.2),
    makeBox(0.10, 1.85, 0.10, llcX + 1.2, llcY + 0.92, llcZ - 2.2),
    makeBox(2.6, 0.10, 0.10, llcX, llcY + 1.75, llcZ - 2.2),
    makeBox(1.45, 0.62, 0.65, llcX + 4.8, llcY + 0.31, llcZ + 3.2)
  );
  lcW2Gold.push(makeBox(2.2, 0.42, 0.24, llcX, llcY + 1.48, llcZ - 2.2));
  lcW2Stone.push(
    makeBox(1.55, 1.05, 1.15, llcX - 5.2, llcY + 0.52, llcZ - 2.5),
    makeCylinder(0.45, 0.52, 0.32, 6, llcX + 3.2, llcY + 0.16, llcZ + 3.2)
  );
  // 355-360. Northern-frontier milestone bollard, stainless trail lamps, Đài Vọng Cảnh benches, Sơn Thần pedestal, Hồ Mắt Rồng skiff & 54-ethnic-groups plaque
  lcW2Stone.push(
    makeBox(0.48, 1.35, 0.36, ovX + 1.8, ovY + 1.32, ovZ - 1.8),
    makeBox(1.65, 0.44, 0.48, ovX - 0.8, ovY + 0.88, ovZ + 1.5),
    makeBox(0.68, 0.95, 0.58, cx + 12.8, ctx.getHeight(cx + 12.8, cz + 14.5) + 0.48, cz + 14.5),
    makeBox(1.25, 1.45, 0.26, cx - 7.5, yBase + tier1H + 0.72, cz + 8.5)
  );
  lcW2Gold.push(makeBox(0.32, 0.32, 0.40, ovX + 1.8, ovY + 1.72, ovZ - 1.8));
  for (let tl = 0; tl < 4; tl++) {
    const tx = cx + 11.5 + tl * 2.8;
    const tz = cz + 11.5 + tl * 2.8;
    lcW2Steel.push(makeCylinder(0.04, 0.06, 2.2, 5, tx + 1.8, ctx.getHeight(tx + 1.8, tz) + 1.1, tz));
  }
  lcW2Wood.push(makeBox(2.8, 0.34, 0.85, -376.5, mrY + 0.22, -339.2, 0.42));

  addMergedMesh(group, lcW2Stone, ctx.materials.stone, 'LungCuWave2Stone', false, true);
  addMergedMesh(group, lcW2Wood, ctx.materials.darkWood, 'LungCuWave2Wood', false, true);
  addMergedMesh(group, lcW2Crimson, ctx.materials.crimsonLacquer, 'LungCuWave2Crimson', false, true);
  addMergedMesh(group, lcW2Gold, ctx.materials.gold, 'LungCuWave2Gold', false, false);
  addMergedMesh(group, lcW2Steel, stainlessMat, 'LungCuWave2Steel', false, false);

  // 7C. LŨNG CÚ & LÔ LÔ CHẢI WAVE 3 REAL-WORLD DETAILS (Items 701..720, castShadow = false, 0 new materials)
  const lcW3Stone: THREE.BufferGeometry[] = [];
  const lcW3Wood: THREE.BufferGeometry[] = [];
  const lcW3Roof: THREE.BufferGeometry[] = [];
  const lcW3Crimson: THREE.BufferGeometry[] = [];
  const lcW3Bronze: THREE.BufferGeometry[] = [];
  const lcW3Gold: THREE.BufferGeometry[] = [];
  const lcW3Steel: THREE.BufferGeometry[] = [];
  // 701-702. H'Mong/Lô Lô weaving shed (deep hillside skirt!) & wooden weaving loom with brocade
  const wvX = llcX - 8.5;
  const wvZ = llcZ - 1.5;
  const wvY = Math.max(ctx.getHeight(wvX, wvZ), ctx.getHeight(wvX - 2.2, wvZ - 1.8), ctx.getHeight(wvX + 2.2, wvZ + 1.8));
  lcW3Stone.push(makeBox(4.6, 3.6, 3.8, wvX, wvY - 1.55, wvZ));
  for (const dx of [-1.8, 1.8]) {
    for (const dz of [-1.4, 1.4]) {
      lcW3Wood.push(makeCylinder(0.10, 0.12, 2.55, 6, wvX + dx, wvY + 1.38, wvZ + dz));
    }
  }
  lcW3Roof.push(createGableRoofGeometry(5.2, 4.4, 1.25).translate(wvX, wvY + 2.65, wvZ));
  lcW3Wood.push(makeBox(1.55, 1.05, 1.15, wvX, wvY + 0.78, wvZ));
  lcW3Crimson.push(makeBox(1.25, 0.08, 0.95, wvX, wvY + 1.08, wvZ));
  // 703-704. H'Mong blacksmith forge (deep hillside skirt!), anvil & tool rack
  const fgX = llcX + 9.2;
  const fgZ = llcZ - 5.5;
  const fgY = Math.max(ctx.getHeight(fgX, fgZ), ctx.getHeight(fgX - 1.8, fgZ - 1.6), ctx.getHeight(fgX + 1.8, fgZ + 1.6));
  lcW3Stone.push(
    makeBox(3.8, 3.4, 3.4, fgX, fgY - 1.45, fgZ),
    makeBox(0.95, 0.85, 0.75, fgX - 0.6, fgY + 0.68, fgZ),
    makeBox(0.55, 0.52, 0.42, fgX + 0.6, fgY + 0.52, fgZ)
  );
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-1.3, 1.3]) {
      lcW3Wood.push(makeBox(0.11, 2.45, 0.11, fgX + dx, fgY + 1.35, fgZ + dz));
    }
  }
  lcW3Roof.push(makeBox(4.4, 0.28, 3.9, fgX, fgY + 2.62, fgZ));
  lcW3Wood.push(makeBox(1.35, 1.25, 0.14, fgX + 2.1, fgY + 0.88, fgZ));
  // 705-714. 3 dry-stacked limestone terraces (deep hillside skirts!), pony stable (with roof!), corn-wine jars, Lô Lô bronze drums, 2nd corn millstone, brocade drying rack, West Dragon Eye pier, benches, village lanterns & buckwheat beds
  for (let tr = 0; tr < 3; tr++) {
    const tz = llcZ - 9.5 - tr * 2.4;
    const ty = Math.max(ctx.getHeight(llcX, tz), ctx.getHeight(llcX - 6.0, tz), ctx.getHeight(llcX + 6.0, tz));
    lcW3Stone.push(makeBox(16.0, 2.85, 0.65, llcX, ty - 0.55, tz));
  }
  const stblY = Math.max(ctx.getHeight(llcX - 10.5, llcZ + 4.5), ctx.getHeight(llcX - 12.2, llcZ + 3.0));
  lcW3Stone.push(makeBox(3.8, 3.2, 3.0, llcX - 10.5, stblY - 1.45, llcZ + 4.5));
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.25, 1.25]) {
      lcW3Wood.push(makeBox(0.11, 2.35, 0.11, llcX - 10.5 + dx, stblY + 1.15, llcZ + 4.5 + dz));
    }
  }
  lcW3Wood.push(
    makeBox(3.4, 1.15, 0.14, llcX - 10.5, stblY + 0.72, llcZ + 5.8),
    makeBox(0.14, 1.15, 2.6, llcX - 12.1, stblY + 0.72, llcZ + 4.5),
    makeBox(0.14, 1.15, 2.6, llcX - 8.9, stblY + 0.72, llcZ + 4.5)
  );
  lcW3Roof.push(makeBox(4.2, 0.28, 3.4, llcX - 10.5, stblY + 2.38, llcZ + 4.5));
  for (let j = 0; j < 4; j++) {
    lcW3Bronze.push(makeCylinder(0.18, 0.24, 0.52, 6, llcX + 2.8 + j * 0.65, llcY + 0.26, llcZ - 0.5));
  }
  lcW3Bronze.push(
    makeCylinder(0.32, 0.36, 0.42, 6, llcX + 4.6, llcY + 0.62, llcZ - 2.5),
    makeCylinder(0.32, 0.36, 0.42, 6, llcX + 6.4, llcY + 0.62, llcZ - 2.5)
  );
  lcW3Stone.push(makeCylinder(0.45, 0.48, 0.48, 6, -360.5, ctx.getHeight(-360.5, -335.5) + 0.24, -335.5));
  lcW3Wood.push(
    makeBox(0.08, 1.85, 0.08, llcX + 1.5, llcY + 0.88, llcZ + 4.8),
    makeBox(0.08, 1.85, 0.08, llcX + 3.5, llcY + 0.88, llcZ + 4.8),
    makeBox(2.2, 0.08, 0.08, llcX + 2.5, llcY + 1.75, llcZ + 4.8)
  );
  lcW3Crimson.push(makeBox(1.85, 0.92, 0.06, llcX + 2.5, llcY + 1.25, llcZ + 4.8));
  const wmrY = Math.max(
    ctx.getHeight(-440.0, -335.0),
    ctx.getHeight(-440.0 - 8.4, -335.0 - 8.4),
    ctx.getHeight(-440.0 + 8.4, -335.0 - 8.4),
    ctx.getHeight(-440.0, -335.0 - 8.4)
  );
  lcW3Stone.push(
    makeBox(2.4, 2.85, 3.2, -440.0, wmrY - 0.85, -326.2),
    makeBox(1.65, 0.42, 0.52, -371.5, ctx.getHeight(-371.5, -340.5) + 0.21, -340.5)
  );
  for (let lp = 0; lp < 4; lp++) {
    const lx = llcX - 4.0 + lp * 4.0;
    const ly = ctx.getHeight(lx, llcZ + 6.0);
    lcW3Wood.push(makeCylinder(0.05, 0.06, 2.35, 5, lx, ly + 1.12, llcZ + 6.0));
    lcW3Crimson.push(makeCylinder(0.14, 0.14, 0.30, 6, lx, ly + 2.15, llcZ + 6.0));
  }
  for (const side of [-1, 1]) {
    lcW3Stone.push(makeBox(2.2, 0.42, 1.25, llcX + side * 3.2, archBaseY + 0.21, llcZ + 7.2));
  }
  // 715-720. Mid-climb 2nd rest shelter (deep hillside skirt!), tea counter in stop-over pavilion, Tier 1 history stele, extra binoculars, 6 stair flags & 23°23' compass plinth
  const r2X = cx + 15.8;
  const r2Z = cz + 18.5;
  const r2Y = Math.max(ctx.getHeight(r2X, r2Z), ctx.getHeight(r2X - 1.8, r2Z - 1.6), ctx.getHeight(r2X + 1.8, r2Z + 1.6));
  lcW3Stone.push(makeBox(3.8, 3.8, 3.4, r2X, r2Y - 1.65, r2Z));
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.25, 1.25]) {
      lcW3Wood.push(makeBox(0.11, 2.45, 0.11, r2X + dx, r2Y + 1.35, r2Z + dz));
    }
  }
  lcW3Roof.push(makeBox(4.4, 0.32, 3.9, r2X, r2Y + 2.65, r2Z));
  lcW3Wood.push(makeBox(1.85, 0.78, 0.65, stopX, stopY + 1.25, stopZ));
  lcW3Stone.push(
    makeBox(1.15, 1.55, 0.24, cx - 9.5, balY + 0.78, cz - 3.5),
    makeCylinder(1.15, 1.25, 0.26, 8, cx + 3.5, balY + 0.13, cz - 10.5)
  );
  lcW3Gold.push(makeCylinder(0.65, 0.65, 0.06, 6, cx + 3.5, balY + 0.28, cz - 10.5));
  for (const side of [-1, 1]) {
    lcW3Steel.push(makeCylinder(0.05, 0.07, 1.15, 5, ovX + side * 1.4, ovY + 1.22, ovZ - 2.0));
    lcW3Bronze.push(makeCylinder(0.07, 0.07, 0.38, 6, ovX + side * 1.4, ovY + 1.82, ovZ - 2.0, Math.PI * 0.5));
  }
  for (let sf = 0; sf < 6; sf++) {
    const sDist = 9.0 + sf * 2.6;
    const side = sf % 2 === 0 ? -1 : 1;
    const fx = cx + 0.7071 * sDist + 0.7071 * 3.2 * side;
    const fz = cz + 0.7071 * sDist - 0.7071 * 3.2 * side;
    const fy = ctx.getHeight(fx, fz);
    lcW3Steel.push(makeCylinder(0.03, 0.04, 2.65, 5, fx, fy + 1.28, fz));
    lcW3Crimson.push(makeBox(0.75, 0.52, 0.04, fx + 0.38, fy + 2.35, fz));
  }

  addMergedMesh(group, lcW3Stone, ctx.materials.stone, 'LungCuWave3Stone', false, true);
  addMergedMesh(group, lcW3Wood, ctx.materials.darkWood, 'LungCuWave3Wood', false, true);
  addMergedMesh(group, lcW3Roof, ctx.materials.darkRoof, 'LungCuWave3Roof', false, true);
  addMergedMesh(group, lcW3Crimson, ctx.materials.crimsonLacquer, 'LungCuWave3Crimson', false, true);
  addMergedMesh(group, lcW3Bronze, ctx.materials.bronze, 'LungCuWave3Bronze', false, true);
  addMergedMesh(group, lcW3Gold, ctx.materials.gold, 'LungCuWave3Gold', false, false);

  // 7D. LŨNG CÚ & LÔ LÔ CHẢI WAVE 4 HIGHLAND EXPANSION (Items 1101..1125, castShadow = false, 0 new materials)
  const lcW4Stone: THREE.BufferGeometry[] = [];
  const lcW4Wood: THREE.BufferGeometry[] = [];
  const lcW4Roof: THREE.BufferGeometry[] = [];
  const lcW4Crimson: THREE.BufferGeometry[] = [];
  const lcW4Bronze: THREE.BufferGeometry[] = [];
  const lcW4Gold: THREE.BufferGeometry[] = [];
  const lcW4Steel: THREE.BufferGeometry[] = [];
  // 1101-1103, 1109, 1113-1114, 1120, 1124. 4th Lô Lô Chải homestead (llcX - 15.5, llcZ - 3.5), goat pen, corn racks, mill, jars, cistern & firewood
  const hm4X = llcX - 15.5;
  const hm4Z = llcZ - 3.5;
  const hm4Y = Math.max(ctx.getHeight(hm4X, hm4Z), ctx.getHeight(hm4X - 2.6, hm4Z - 2.0), ctx.getHeight(hm4X + 2.6, hm4Z + 2.0));
  lcW4Stone.push(
    makeBox(5.8, 4.0, 4.4, hm4X, hm4Y - 1.75, hm4Z),
    makeBox(6.8, 0.85, 0.36, hm4X, hm4Y + 0.65, hm4Z + 3.0),
    makeCylinder(0.42, 0.46, 0.46, 6, llcX - 13.0, ctx.getHeight(llcX - 13.0, llcZ - 2.0) + 0.23, llcZ - 2.0),
    makeBox(1.55, 1.05, 1.25, llcX - 10.5, ctx.getHeight(llcX - 10.5, llcZ - 5.5) + 0.52, llcZ - 5.5)
  );
  lcW4Gold.push(makeBox(5.0, 2.45, 3.6, hm4X, hm4Y + 1.48, hm4Z));
  lcW4Roof.push(createGableRoofGeometry(5.9, 4.5, 1.45).translate(hm4X, hm4Y + 2.72, hm4Z));
  lcW4Wood.push(makeBox(1.35, 0.55, 0.55, hm4X + 2.7, hm4Y + 0.52, hm4Z - 0.8));
  for (let j = 0; j < 4; j++) {
    lcW4Bronze.push(makeCylinder(0.16, 0.22, 0.48, 6, hm4X - 1.5 + j * 0.65, hm4Y + 0.48, hm4Z + 2.0));
  }
  const gpY = Math.max(ctx.getHeight(llcX - 16.5, llcZ + 2.5), ctx.getHeight(llcX - 18.0, llcZ + 1.2));
  lcW4Stone.push(
    makeBox(3.4, 3.4, 2.8, llcX - 16.5, gpY - 1.45, llcZ + 2.5),
    makeBox(3.2, 1.05, 0.28, llcX - 16.5, gpY + 0.72, llcZ + 3.8)
  );
  for (const dx of [-1.4, 1.4]) {
    for (const dz of [-1.1, 1.1]) {
      lcW4Wood.push(makeBox(0.10, 2.25, 0.10, llcX - 16.5 + dx, gpY + 1.18, llcZ + 2.5 + dz));
    }
  }
  lcW4Roof.push(makeBox(3.8, 0.26, 3.2, llcX - 16.5, gpY + 2.38, llcZ + 2.5));
  for (const crz of [llcZ - 7.5, llcZ - 9.2]) {
    const cry = ctx.getHeight(llcX - 14.5, crz);
    lcW4Wood.push(
      makeBox(0.08, 1.85, 0.08, llcX - 15.5, cry + 0.88, crz),
      makeBox(0.08, 1.85, 0.08, llcX - 13.5, cry + 0.88, crz),
      makeBox(2.2, 0.08, 0.08, llcX - 14.5, cry + 1.75, crz)
    );
    lcW4Gold.push(makeBox(1.85, 0.44, 0.24, llcX - 14.5, cry + 1.42, crz));
  }
  // 1104-1105, 1115, 1117-1119, 1121-1123, 1125. Buckwheat stall, water trough, khèn table, buckwheat fence, steps, lanterns, benches, Geopark stele, slab & signpost
  const bwStY = Math.max(ctx.getHeight(llcX + 6.5, llcZ + 8.5), ctx.getHeight(llcX + 5.3, llcZ + 7.5));
  lcW4Stone.push(
    makeBox(2.8, 2.6, 2.2, llcX + 6.5, bwStY - 1.25, llcZ + 8.5),
    makeBox(1.45, 0.55, 0.72, llcX - 6.5, ctx.getHeight(llcX - 6.5, llcZ + 7.5) + 0.28, llcZ + 7.5),
    makeBox(0.88, 1.38, 0.22, ovX - 1.8, ovY + 1.32, ovZ - 1.8),
    makeBox(1.85, 0.18, 1.15, llcX - 2.5, ctx.getHeight(llcX - 2.5, llcZ + 8.5) + 0.10, llcZ + 8.5)
  );
  for (const dx of [-1.1, 1.1]) {
    for (const dz of [-0.85, 0.85]) {
      lcW4Wood.push(makeBox(0.10, 2.25, 0.10, llcX + 6.5 + dx, bwStY + 1.05, llcZ + 8.5 + dz));
    }
  }
  lcW4Crimson.push(
    makeBox(2.6, 0.20, 2.1, llcX + 6.5, bwStY + 2.24, llcZ + 8.5),
    makeCylinder(0.14, 0.14, 0.30, 6, llcX - 1.1, archBaseY + 2.95, llcZ + 6.5),
    makeCylinder(0.14, 0.14, 0.30, 6, llcX + 1.1, archBaseY + 2.95, llcZ + 6.5)
  );
  lcW4Wood.push(
    makeBox(1.95, 0.65, 0.65, llcX + 6.5, bwStY + 0.32, llcZ + 8.5),
    makeBox(1.45, 0.68, 0.62, llcX + 12.8, ctx.getHeight(llcX + 12.8, llcZ + 7.5) + 0.34, llcZ + 7.5),
    makeBox(5.2, 0.72, 0.12, cx + 12.5, ctx.getHeight(cx + 12.5, cz + 15.5) + 0.36, cz + 15.5),
    makeBox(1.85, 0.44, 0.48, stopX - 1.6, stopY + 1.12, stopZ + 1.2),
    makeBox(1.85, 0.44, 0.48, stopX + 1.6, stopY + 1.12, stopZ + 1.2)
  );
  lcW4Bronze.push(makeCylinder(0.06, 0.08, 2.15, 6, stopX - 4.2, ctx.getHeight(stopX - 4.2, stopZ) + 1.08, stopZ));
  for (let st = 0; st < 4; st++) {
    const sy = ctx.getHeight(llcX, llcZ + 7.8 + st * 0.7);
    lcW4Stone.push(makeBox(3.4, 0.52, 0.68, llcX, sy - 0.08, llcZ + 7.8 + st * 0.7));
  }
  // 1106-1108, 1110-1112, 1116. North-Ridge Border Overlook (cx - 16.5, cz - 14.5), Milestone 428, stair lanterns, cairns & flagpole
  const nrX = cx - 16.5;
  const nrZ = cz - 14.5;
  const nrY = Math.max(ctx.getHeight(nrX, nrZ), ctx.getHeight(nrX - 2.2, nrZ - 2.2), ctx.getHeight(nrX + 2.2, nrZ + 2.2));
  lcW4Stone.push(
    makeBox(4.8, 4.2, 4.8, nrX, nrY - 1.85, nrZ),
    makeBox(4.6, 0.72, 0.22, nrX, nrY + 0.62, nrZ - 2.2),
    makeBox(0.55, 1.48, 0.38, nrX, nrY + 0.95, nrZ + 2.3),
    makeCylinder(0.52, 0.34, 0.62, 6, nrX, nrY + 0.56, nrZ)
  );
  lcW4Gold.push(makeBox(0.32, 0.32, 0.42, nrX, nrY + 1.38, nrZ + 2.3));
  for (const dx of [-1.85, 1.85]) {
    for (const dz of [-1.85, 1.85]) {
      lcW4Wood.push(makeCylinder(0.11, 0.13, 2.65, 6, nrX + dx, nrY + 1.50, nrZ + dz));
    }
  }
  lcW4Roof.push(makeBox(5.4, 0.36, 5.4, nrX, nrY + 2.92, nrZ));
  lcW4Steel.push(makeCylinder(0.04, 0.05, 3.6, 5, nrX + 2.8, nrY + 1.72, nrZ));
  lcW4Crimson.push(makeBox(0.85, 0.55, 0.04, nrX + 3.25, nrY + 3.15, nrZ));
  for (let i = 0; i < 4; i++) {
    const lx = cx + 4.5 + i * 1.8;
    const lz = cz + 18.0 + i * 2.4;
    const ly = ctx.getHeight(lx, lz);
    lcW4Stone.push(
      makeBox(0.40, 0.98, 0.40, lx, ly + 0.49, lz),
      makeBox(0.54, 0.16, 0.54, lx, ly + 1.06, lz),
      makeCylinder(0.32, 0.48, 0.65, 5, cx - 12.0 - i * 1.8, ctx.getHeight(cx - 12.0 - i * 1.8, cz - 6.0 - i * 2.0) + 0.32, cz - 6.0 - i * 2.0)
    );
  }
  addMergedMesh(group, lcW4Stone, ctx.materials.stone, 'LungCuWave4Stone', false, true);
  addMergedMesh(group, lcW4Wood, ctx.materials.darkWood, 'LungCuWave4Wood', false, true);
  addMergedMesh(group, lcW4Roof, ctx.materials.darkRoof, 'LungCuWave4Roof', false, true);
  addMergedMesh(group, lcW4Crimson, ctx.materials.crimsonLacquer, 'LungCuWave4Crimson', false, true);
  addMergedMesh(group, lcW4Bronze, ctx.materials.bronze, 'LungCuWave4Bronze', false, true);
  addMergedMesh(group, lcW4Gold, ctx.materials.gold, 'LungCuWave4Gold', false, false);
  addMergedMesh(group, lcW4Steel, stainlessMat, 'LungCuWave4Steel', false, false);
  addMergedMesh(group, lcW3Steel, stainlessMat, 'LungCuWave3Steel', false, false);

  // 7E. LŨNG CÚ & LÔ LÔ CHẢI WAVE 5 STONE ALLEYS & TERRACED GARDENS (Items 1501..1520, castShadow = false, 0 new materials)
  const lcW5Stone: THREE.BufferGeometry[] = [];
  const lcW5Wood: THREE.BufferGeometry[] = [];
  const lcW5Roof: THREE.BufferGeometry[] = [];
  const lcW5Crimson: THREE.BufferGeometry[] = [];
  const lcW5Bronze: THREE.BufferGeometry[] = [];
  const lcW5Gold: THREE.BufferGeometry[] = [];
  const lcW5Steel: THREE.BufferGeometry[] = [];

  // 1501-1515. 5th Lô Lô Chải Rammed-Earth House (llcX + 16.5, llcZ - 2.5), stone alley, terraced buckwheat garden, corn-watch shelter & village props
  const hm5X = llcX + 16.5;
  const hm5Z = llcZ - 2.5;
  const hm5Y = Math.max(ctx.getHeight(hm5X, hm5Z), ctx.getHeight(hm5X - 2.6, hm5Z - 2.0), ctx.getHeight(hm5X + 2.6, hm5Z + 2.0));
  lcW5Stone.push(
    makeBox(5.8, 4.0, 4.4, hm5X, hm5Y - 1.75, hm5Z),
    makeBox(0.38, 0.92, 8.2, llcX + 12.5, ctx.getHeight(llcX + 12.5, llcZ - 1.0) + 0.46, llcZ - 1.0),
    makeCylinder(0.42, 0.46, 0.46, 6, llcX + 14.0, ctx.getHeight(llcX + 14.0, llcZ - 0.5) + 0.23, llcZ - 0.5),
    makeBox(1.55, 1.05, 1.25, llcX + 19.5, ctx.getHeight(llcX + 19.5, llcZ - 2.5) + 0.52, llcZ - 2.5),
    makeBox(1.65, 1.05, 1.45, llcX + 21.0, ctx.getHeight(llcX + 21.0, llcZ - 5.5) + 0.52, llcZ - 5.5),
    makeBox(0.88, 1.42, 0.22, llcX + 10.5, ctx.getHeight(llcX + 10.5, llcZ + 7.5) + 0.71, llcZ + 7.5)
  );
  lcW5Gold.push(makeBox(5.0, 2.45, 3.6, hm5X, hm5Y + 1.48, hm5Z));
  lcW5Roof.push(
    createGableRoofGeometry(5.9, 4.5, 1.45).translate(hm5X, hm5Y + 2.72, hm5Z),
    makeBox(2.0, 0.24, 1.8, llcX + 21.0, ctx.getHeight(llcX + 21.0, llcZ - 5.5) + 1.15, llcZ - 5.5)
  );
  lcW5Wood.push(
    makeBox(1.35, 0.55, 0.55, hm5X, hm5Y + 0.52, hm5Z - 2.5),
    // 1507. Brocade drying rack
    makeBox(0.08, 1.85, 0.08, llcX + 17.6, ctx.getHeight(llcX + 18.5, llcZ - 6.0) + 0.88, llcZ - 6.0),
    makeBox(0.08, 1.85, 0.08, llcX + 19.4, ctx.getHeight(llcX + 18.5, llcZ - 6.0) + 0.88, llcZ - 6.0),
    makeBox(2.0, 0.08, 0.08, llcX + 18.5, ctx.getHeight(llcX + 18.5, llcZ - 6.0) + 1.75, llcZ - 6.0)
  );
  lcW5Crimson.push(makeBox(1.65, 0.82, 0.06, llcX + 18.5, ctx.getHeight(llcX + 18.5, llcZ - 6.0) + 1.22, llcZ - 6.0));
  for (let st = 0; st < 5; st++) {
    const sy = ctx.getHeight(llcX + 13.5, llcZ - 5.0 + st * 1.4);
    lcW5Stone.push(makeBox(1.65, 0.52, 0.82, llcX + 13.5, sy - 0.08, llcZ - 5.0 + st * 1.4));
  }
  for (let t = 0; t < 3; t++) {
    const tz = llcZ + 3.5 + t * 1.8;
    const ty = ctx.getHeight(llcX + 16.5, tz);
    lcW5Stone.push(makeBox(4.2, 0.55, 1.35, llcX + 16.5, ty + 0.15, tz));
    lcW5Bronze.push(makeCylinder(0.16, 0.22, 0.46, 6, llcX + 14.6 + t * 0.6, hm5Y + 0.46, llcZ + 0.2));
  }
  // 1505. Elevated Corn-Watch Shelter (llcX + 20.5, llcZ + 2.5)
  const cwX = llcX + 20.5;
  const cwZ = llcZ + 2.5;
  const cwY = Math.max(ctx.getHeight(cwX, cwZ), ctx.getHeight(cwX - 1.4, cwZ - 1.4), ctx.getHeight(cwX + 1.4, cwZ + 1.4));
  lcW5Stone.push(makeBox(3.0, 3.4, 3.0, cwX, cwY - 1.45, cwZ));
  for (const dx of [-1.15, 1.15]) {
    for (const dz of [-1.15, 1.15]) {
      lcW5Wood.push(makeBox(0.10, 2.45, 0.10, cwX + dx, cwY + 1.32, cwZ + dz));
    }
  }
  lcW5Roof.push(makeBox(3.6, 0.28, 3.6, cwX, cwY + 2.62, cwZ));
  for (const lz of [llcZ - 4.0, llcZ, llcZ + 4.0]) {
    const ly = ctx.getHeight(llcX + 12.5, lz);
    lcW5Stone.push(
      makeBox(0.38, 0.92, 0.38, llcX + 12.5, ly + 0.46, lz),
      makeBox(0.52, 0.16, 0.52, llcX + 12.5, ly + 1.00, lz)
    );
  }
  for (const bz of [llcZ + 5.5, llcZ + 7.5]) {
    lcW5Stone.push(makeBox(1.55, 0.42, 0.48, llcX + 14.5, ctx.getHeight(llcX + 14.5, bz) + 0.21, bz));
  }
  for (const rz of [llcZ + 5.2, llcZ + 6.8]) {
    const ry = ctx.getHeight(llcX + 18.5, rz);
    lcW5Wood.push(
      makeBox(0.08, 1.80, 0.08, llcX + 17.6, ry + 0.85, rz),
      makeBox(0.08, 1.80, 0.08, llcX + 19.4, ry + 0.85, rz)
    );
    lcW5Gold.push(makeBox(1.80, 0.42, 0.22, llcX + 18.5, ry + 1.38, rz));
  }
  // 1516-1520. East-Ridge Lookout Terrace (cx + 15.5, cz - 12.5), flagpole, cairns, stone tea table & signpost
  const erX = cx + 15.5;
  const erZ = cz - 12.5;
  const erY = Math.max(ctx.getHeight(erX, erZ), ctx.getHeight(erX - 2.0, erZ - 2.0), ctx.getHeight(erX + 2.0, erZ + 2.0));
  lcW5Stone.push(
    makeBox(4.4, 4.0, 4.4, erX, erY - 1.75, erZ),
    makeCylinder(0.52, 0.34, 0.62, 6, erX, erY + 0.56, erZ)
  );
  lcW5Wood.push(makeBox(4.2, 0.78, 0.16, erX, erY + 0.62, erZ - 2.0));
  lcW5Steel.push(makeCylinder(0.04, 0.05, 3.6, 5, erX + 2.0, erY + 1.85, erZ));
  lcW5Crimson.push(makeBox(0.85, 0.55, 0.04, erX + 2.45, erY + 3.25, erZ));
  lcW5Bronze.push(makeCylinder(0.06, 0.08, 2.15, 6, cx + 13.5, ctx.getHeight(cx + 13.5, cz - 11.5) + 1.08, cz - 11.5));
  for (let i = 0; i < 3; i++) {
    const cx2 = cx + 12.0 + i * 2.0;
    const cz2 = cz - 6.0 - i * 2.0;
    lcW5Stone.push(makeCylinder(0.30, 0.46, 0.62, 5, cx2, ctx.getHeight(cx2, cz2) + 0.31, cz2));
  }
  addMergedMesh(group, lcW5Stone, ctx.materials.stone, 'LungCuWave5Stone', false, true);
  addMergedMesh(group, lcW5Wood, ctx.materials.darkWood, 'LungCuWave5Wood', false, true);
  addMergedMesh(group, lcW5Roof, ctx.materials.darkRoof, 'LungCuWave5Roof', false, true);
  addMergedMesh(group, lcW5Crimson, ctx.materials.crimsonLacquer, 'LungCuWave5Crimson', false, true);
  addMergedMesh(group, lcW5Bronze, ctx.materials.bronze, 'LungCuWave5Bronze', false, true);
  addMergedMesh(group, lcW5Gold, ctx.materials.gold, 'LungCuWave5Gold', false, false);
  addMergedMesh(group, lcW5Steel, stainlessMat, 'LungCuWave5Steel', false, false);

  // =================================================================================================
  // LŨNG CÚ & LÔ LÔ CHẢI WAVE 6 (Items 1901..1920 — castShadow = false, 0 new materials)
  // =================================================================================================
  const lcW6Stone: THREE.BufferGeometry[] = [];
  const lcW6Wood: THREE.BufferGeometry[] = [];
  const lcW6Roof: THREE.BufferGeometry[] = [];
  const lcW6Crimson: THREE.BufferGeometry[] = [];
  const lcW6Bronze: THREE.BufferGeometry[] = [];
  const lcW6Gold: THREE.BufferGeometry[] = [];
  const lcW6Steel: THREE.BufferGeometry[] = [];

  // 1901-1915, 1920. H'Mong West Courtyard Gate (llcX - 13.5, llcZ - 1.5), Stone Walls, Terraces, Mill, Shed & Racks
  const wgX = llcX - 13.5;
  const wgZ = llcZ - 1.5;
  const wgY = Math.max(ctx.getHeight(wgX, wgZ), ctx.getHeight(wgX - 1.2, wgZ - 1.2), ctx.getHeight(wgX + 1.2, wgZ + 1.2));
  lcW6Stone.push(
    makeBox(1.85, 2.8, 3.6, wgX, wgY - 1.25, wgZ),
    makeBox(0.55, 1.35, 5.2, wgX, ctx.getHeight(wgX, llcZ - 5.0) + 0.45, llcZ - 5.0),
    makeBox(0.55, 1.35, 5.2, wgX, ctx.getHeight(wgX, llcZ + 2.5) + 0.45, llcZ + 2.5),
    // 1907. Stone corn hand-mill (llcX - 11.8, llcZ - 0.5)
    makeCylinder(0.42, 0.46, 0.62, 5, llcX - 11.8, ctx.getHeight(llcX - 11.8, llcZ - 0.5) + 0.31, llcZ - 0.5),
    // 1913, 1915, 1920. Benches, rainwater cistern & signpost base
    makeBox(1.50, 0.42, 0.48, llcX - 14.8, ctx.getHeight(llcX - 14.8, llcZ + 5.5) + 0.21, llcZ + 5.5),
    makeBox(1.50, 0.42, 0.48, llcX - 11.8, ctx.getHeight(llcX - 11.8, llcZ + 6.5) + 0.21, llcZ + 6.5),
    makeBox(1.55, 0.92, 1.55, llcX - 15.2, ctx.getHeight(llcX - 15.2, llcZ - 7.5) + 0.46, llcZ - 7.5),
    makeBox(0.86, 1.42, 0.22, llcX - 11.5, ctx.getHeight(llcX - 11.5, llcZ + 1.8) + 0.71, llcZ + 1.8)
  );
  lcW6Wood.push(
    makeBox(0.18, 2.80, 0.18, wgX, wgY + 1.40, wgZ - 1.15),
    makeBox(0.18, 2.80, 0.18, wgX, wgY + 1.40, wgZ + 1.15),
    // 1909. Brocade drying rack (llcX - 12.2, llcZ + 4.5)
    makeBox(0.10, 1.75, 0.10, llcX - 13.0, ctx.getHeight(llcX - 12.2, llcZ + 4.5) + 0.80, llcZ + 4.5),
    makeBox(0.10, 1.75, 0.10, llcX - 11.4, ctx.getHeight(llcX - 12.2, llcZ + 4.5) + 0.80, llcZ + 4.5),
    // 1914. Corn-drying rack (llcX - 17.2, llcZ + 6.0)
    makeBox(0.10, 1.85, 0.10, llcX - 18.0, ctx.getHeight(llcX - 17.2, llcZ + 6.0) + 0.85, llcZ + 6.0),
    makeBox(0.10, 1.85, 0.10, llcX - 16.4, ctx.getHeight(llcX - 17.2, llcZ + 6.0) + 0.85, llcZ + 6.0)
  );
  lcW6Roof.push(makeBox(1.85, 0.28, 3.5, wgX, wgY + 2.86, wgZ));
  lcW6Crimson.push(makeBox(1.50, 0.92, 0.08, llcX - 12.2, ctx.getHeight(llcX - 12.2, llcZ + 4.5) + 1.25, llcZ + 4.5));
  lcW6Gold.push(
    makeBox(1.55, 0.42, 0.22, llcX - 17.2, ctx.getHeight(llcX - 17.2, llcZ + 6.0) + 1.42, llcZ + 6.0),
    makeBox(0.62, 0.30, 0.08, llcX - 11.5, ctx.getHeight(llcX - 11.5, llcZ + 1.8) + 1.12, llcZ + 1.94)
  );
  lcW6Bronze.push(
    makeCylinder(0.20, 0.24, 0.46, 4, llcX - 12.0, ctx.getHeight(llcX - 12.0, llcZ - 3.2) + 0.23, llcZ - 3.2),
    makeCylinder(0.20, 0.24, 0.46, 4, llcX - 11.3, ctx.getHeight(llcX - 11.3, llcZ - 3.2) + 0.23, llcZ - 3.2)
  );
  // 1904-1906. 3 Stepped Highland Terraces (llcX - 16.5, llcZ - 4.5..3.5)
  for (const tz of [llcZ - 4.5, llcZ - 0.5, llcZ + 3.5]) {
    const ty = ctx.getHeight(llcX - 16.5, tz);
    lcW6Stone.push(makeBox(2.6, 0.72, 2.8, llcX - 16.5, ty + 0.12, tz));
  }
  // 1908. Timber Firewood Shelter (llcX - 16.8, llcZ - 7.5)
  const fsX = llcX - 16.8;
  const fsZ = llcZ - 7.5;
  const fsY = Math.max(ctx.getHeight(fsX, fsZ), ctx.getHeight(fsX - 1.2, fsZ - 1.0), ctx.getHeight(fsX + 1.2, fsZ + 1.0));
  lcW6Stone.push(makeBox(2.8, 2.8, 2.4, fsX, fsY - 1.25, fsZ));
  for (const dx of [-1.05, 1.05]) {
    for (const dz of [-0.85, 0.85]) {
      lcW6Wood.push(makeCylinder(0.08, 0.09, 2.35, 4, fsX + dx, fsY + 1.18, fsZ + dz));
    }
  }
  lcW6Wood.push(makeBox(1.85, 0.82, 1.15, fsX, fsY + 0.56, fsZ));
  lcW6Roof.push(makeBox(3.2, 0.24, 2.8, fsX, fsY + 2.40, fsZ));
  for (const lz of [llcZ - 2.8, llcZ + 0.2]) {
    const ly = ctx.getHeight(llcX - 12.0, lz);
    lcW6Stone.push(
      makeBox(0.38, 0.92, 0.38, llcX - 12.0, ly + 0.46, lz),
      makeBox(0.50, 0.16, 0.50, llcX - 12.0, ly + 1.00, lz)
    );
  }
  // 1916-1919. NE Ridge Overlook Terrace (cx + 20.5, cz + 1.5), flagpole, cairns & bench
  const neX = cx + 20.5;
  const neZ = cz + 1.5;
  const neY = Math.max(ctx.getHeight(neX, neZ), ctx.getHeight(neX - 1.8, neZ - 1.8), ctx.getHeight(neX + 1.8, neZ + 1.8));
  lcW6Stone.push(
    makeBox(4.0, 3.6, 4.0, neX, neY - 1.60, neZ),
    makeBox(1.50, 0.42, 0.48, cx + 19.5, neY + 0.41, cz + 3.0)
  );
  lcW6Wood.push(makeBox(3.8, 0.78, 0.16, neX, neY + 0.58, neZ + 1.8));
  lcW6Steel.push(makeCylinder(0.04, 0.05, 3.5, 4, cx + 22.0, neY + 1.85, neZ));
  lcW6Crimson.push(makeBox(0.82, 0.52, 0.04, cx + 22.42, neY + 3.22, neZ));
  for (let i = 0; i < 3; i++) {
    const rx = cx + 18.5 + i * 1.5;
    const rz = cz - 2.0 + i * 3.0;
    lcW6Stone.push(makeCylinder(0.28, 0.44, 0.60, 4, rx, ctx.getHeight(rx, rz) + 0.30, rz));
  }
  addMergedMesh(group, lcW6Stone, ctx.materials.stone, 'LungCuWave6Stone', false, true);
  addMergedMesh(group, lcW6Wood, ctx.materials.darkWood, 'LungCuWave6Wood', false, true);
  addMergedMesh(group, lcW6Roof, ctx.materials.darkRoof, 'LungCuWave6Roof', false, true);
  addMergedMesh(group, lcW6Crimson, ctx.materials.crimsonLacquer, 'LungCuWave6Crimson', false, true);
  addMergedMesh(group, lcW6Bronze, ctx.materials.bronze, 'LungCuWave6Bronze', false, true);
  addMergedMesh(group, lcW6Gold, ctx.materials.gold, 'LungCuWave6Gold', false, false);
  addMergedMesh(group, lcW6Steel, stainlessMat, 'LungCuWave6Steel', false, false);

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
  tagMotifIds(group, [
    'HV-E01', 'HV-E02', 'HV-E03', 'HV-E04', 'HV-I04',
    'HV-NEW-MB-07', 'HV-NEW-MB-08', 'HV-NEW-MB-10', 'HV-NEW-MB-12'
  ]);

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
  const cx = 412;
  const cz = -360;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 34.0 });

  const group = new THREE.Group();
  group.name = 'FansipanSummitComplex';

  const darkBuddhaBronzeMat = ctx.huePack?.antiqueBronzeCauldronMat ?? ctx.materials.bronzePatina ?? ctx.materials.bronze;
  const warmRedBuddhaBronzeMat = ctx.materials.bronze;
  const rhodoLeafMat = ctx.materialLib?.getOrCreateStandard({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide }) ?? ctx.materials.darkWood;
  const rhodoFlowerMat = ctx.materials.crimsonLacquer;

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

  // 3. FIX FSP-01: Authentic Brushed Stainless Fansipan 3.143m Pyramid Monument (r=0.82m, h=1.75m)
  //    anchored naturally on a sculpted dark granite summit boulder outcrop (replacing oversized 5.5m hex plinth!)
  const pyrX = cx - 6.8;
  const pyrZ = cz + 8.5;
  const summitBoulder = createSculptedRockGeometry(3143, 2.2, 1.15, 1.95, 2);
  summitBoulder.translate(pyrX, deckTopY + 0.45, pyrZ);
  graniteParts.push(summitBoulder);
  const pyrBaseY = deckTopY + 1.15;
  const pyrH = 1.75;
  const pyramid = new THREE.ConeGeometry(0.82, pyrH, 3);
  pyramid.translate(pyrX, pyrBaseY + pyrH * 0.5, pyrZ);
  stainlessParts.push(pyramid);

  // Compact brushed plaques seated cleanly on the 3 sloped stainless pyramid faces
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const plaque = createSignagePlaqueMesh(
      {
        text: 'FANSIPAN 3.143m',
        subText: 'NÓC NHÀ ĐÔNG DƯƠNG',
        style: 'stone',
        width: 0.56,
        height: 0.42,
        depth: 0.03
      },
      ctx
    );
    plaque.name = `Fansipan3143Plaque_${i + 1}`;
    plaque.position.set(pyrX + Math.sin(ang) * 0.28, pyrBaseY + 0.64, pyrZ + Math.cos(ang) * 0.28);
    plaque.rotation.set(0, ang, 0);
    plaque.rotateX(-0.26);
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
  // FIX FSP-02: Authentic refined flush chest *chữ Vạn 卍* emblem (0.62m instead of protruding 1.62m box!)
  const chestY = (0.58 + 1.08) * bScale;
  const chestZ = 0.45 * bScale;
  const swS = bScale * 0.40;
  warmAccents.push(
    makeBox(0.32 * swS, 0.042 * swS, 0.03 * swS, 0, chestY, chestZ),
    makeBox(0.042 * swS, 0.32 * swS, 0.03 * swS, 0, chestY, chestZ),
    makeBox(0.16 * swS, 0.04 * swS, 0.03 * swS, 0.08 * swS, chestY + 0.14 * swS, chestZ),
    makeBox(0.16 * swS, 0.04 * swS, 0.03 * swS, -0.08 * swS, chestY - 0.14 * swS, chestZ),
    makeBox(0.04 * swS, 0.16 * swS, 0.03 * swS, -0.14 * swS, chestY + 0.08 * swS, chestZ),
    makeBox(0.04 * swS, 0.16 * swS, 0.03 * swS, 0.14 * swS, chestY - 0.08 * swS, chestZ)
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
  // Thượng Điện Tam Bảo Interior inside Chùa Kim Sơn Bảo Thắng (ref 121_chua_viet_nam_chinh_dien_tam_bao.jpg):
  // 3 Seated Golden Tam Thế Phật statues, sculpted Nine-Dragon Birth Shrine (*Tòa Cửu Long*), gilded *Cửa Võng* valance & bronze bell/wooden fish!
  for (const bxOff of [-0.72, 0.0, 0.72]) {
    goldParts.push(
      makeCylinder(0.22, 0.28, 0.16, 8, pagX + bxOff, pagFloorY + 1.00, pagZ - 1.25),
      new THREE.ConeGeometry(0.18, 0.52, 7).translate(pagX + bxOff, pagFloorY + 1.34, pagZ - 1.25),
      new THREE.SphereGeometry(0.10, 6, 5).translate(pagX + bxOff, pagFloorY + 1.66, pagZ - 1.25)
    );
  }
  const cuuLongRing = new THREE.TorusGeometry(0.32, 0.055, 6, 12, Math.PI * 1.35);
  cuuLongRing.translate(pagX, pagFloorY + 1.22, pagZ - 0.55);
  goldParts.push(cuuLongRing, makeBox(2.2, 0.36, 0.08, pagX, pagFloorY + t1H - 0.42, pagZ + 1.95));
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

  const pagRoof2 = createHueImperialHipRoofGeometry(5.8, 5.8, 2.2, 0.36, 2.25, 0.36, 8, 5, false);
  pagRoof2.translate(pagX, t2Y + t2H + 0.02, pagZ);
  roofParts.push(pagRoof2);

  // Weathered grey-stone / terracotta Trần-dynasty ridge beam & finials seated flush on flat hip ridge
  stoneParts.push(makeBox(2.35, 0.20, 0.24, pagX, t2Y + t2H + 2.30, pagZ));
  const pagFinials = createRoofFinialSetParts(pagX, t2Y + t2H + 2.35, pagZ, 2.15, 0, 0.58, false);
  stoneParts.push(...pagFinials.mainParts, ...pagFinials.goldParts);

  // FIX FSP-03: Flanking Tả Vu & Hữu Vu side cloister wings expanding Chùa Kim Sơn Bảo Thắng into authentic chữ Công monastery complex (ref 08b!)
  for (const wSide of [-1, 1]) {
    const wx = pagX + wSide * 5.65;
    const wz = pagZ + 1.2;
    stoneParts.push(makeBox(3.4, 0.72, 7.6, wx, pagFloorY - 0.36, wz));
    woodParts.push(makeBox(2.8, 2.65, 6.8, wx, pagFloorY + 1.32, wz));
    for (const wzp of [-2.8, 0.0, 2.8]) {
      woodParts.push(makeCylinder(0.12, 0.14, 2.75, 6, wx - wSide * 1.45, pagFloorY + 1.38, wz + wzp));
    }
    const wingRoof = createVietnameseCurvedRoofGeometry(4.4, 8.6, 1.4, 5.2, 1.65, 0.36);
    wingRoof.translate(wx, pagFloorY + 2.68, wz);
    roofParts.push(wingRoof);
  }

  // 6. 11-Story OCTAGONAL Grey-Stone Bảo Tháp Stupa (18.0m tall) at (cx + 10.5, cz - 8.5)
  //    topped with a gleaming GOLDEN lotus-bud spire!
  const stuX = cx + 10.5;
  const stuZ = cz - 8.5;
  // FIX FSP-04: Authentic 11-Tier SQUARE Grey-Blue Stone Bảo Tháp (4-sided rotated PI/4 with thin crisp stone eaves per ref 74!)
  const stuBaseY = upperDeckY;
  graniteParts.push(makeBox(4.8, 0.95, 4.8, stuX, stuBaseY + 0.475, stuZ));
  stoneParts.push(makeBox(4.0, 0.85, 4.0, stuX, stuBaseY + 1.375, stuZ));

  let stuCurY = stuBaseY + 1.80;
  for (let tier = 0; tier < 11; tier++) {
    const frac = tier / 10;
    const tierW = THREE.MathUtils.lerp(3.55, 1.42, frac);
    const tierH = THREE.MathUtils.lerp(1.48, 0.98, frac);
    const bodyH = tierH * 0.72;
    const eaveH = tierH * 0.28;

    graniteParts.push(makeBox(tierW, bodyH, tierW, stuX, stuCurY + bodyH * 0.5, stuZ));
    if (tier < 6) {
      const nw = tierW * 0.28;
      const nh = bodyH * 0.64;
      for (let f = 0; f < 4; f++) {
        const fa = (f / 4) * Math.PI * 2;
        const niche = makeBox(nw, nh, 0.08, 0, 0, 0);
        niche.rotateY(fa);
        niche.translate(stuX + Math.sin(fa) * (tierW * 0.5 + 0.01), stuCurY + nh * 0.54, stuZ + Math.cos(fa) * (tierW * 0.5 + 0.01));
        voidParts.push(niche);
      }
    }
    // Crisp thin 4-slope square stone eave skirt & upturned cornice lip
    const eaveR = (tierW * 1.34) / Math.SQRT2;
    const topR = (tierW * 0.96) / Math.SQRT2;
    stoneParts.push(
      makeCylinder(topR, eaveR, eaveH, 4, stuX, stuCurY + bodyH + eaveH * 0.5, stuZ, 0, 0, Math.PI * 0.25)
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
  const btRoof2 = createHueImperialHipRoofGeometry(4.8, 4.8, 1.8, 0.32, 1.85, 0.34, 8, 5, false);
  btRoof2.translate(bellX, bt2Y + bt2H, bellZ);
  roofParts.push(btRoof2);

  stoneParts.push(makeBox(1.95, 0.18, 0.22, bellX, bt2Y + bt2H + 1.89, bellZ));
  const btFinials = createRoofFinialSetParts(bellX, bt2Y + bt2H + 1.93, bellZ, 1.75, 0, 0.52, false);
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

  // FIX FSP-05: 5-Color Buddhist Festival Flags, Red Temple Banners & Alpine Reed Tufts flanking Chùa Kim Sơn Bảo Thắng (ref 08b & 74!)
  const fspFlagColors = ['#1e5fa8', '#f2c738', '#cf2b24', '#f4f2ec', '#e66c22'];
  const fspFlagParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? -1 : 1;
    const k = i % 5;
    const fx = pagX + side * (4.6 + k * 0.9);
    const fz = pagZ + 5.8 + k * 1.4;
    woodParts.push(makeCylinder(0.03, 0.04, 3.2, 5, fx, pagBaseY + 1.6, fz));
    const flagPane = makeBox(0.72, 0.56, 0.03, fx + side * 0.36, pagBaseY + 2.85, fz);
    const fc = new THREE.Color(fspFlagColors[k % fspFlagColors.length]);
    const pCnt = flagPane.attributes.position.count;
    const pCol = new Float32Array(pCnt * 3);
    for (let vi = 0; vi < pCnt; vi++) {
      pCol[vi * 3] = fc.r;
      pCol[vi * 3 + 1] = fc.g;
      pCol[vi * 3 + 2] = fc.b;
    }
    flagPane.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    fspFlagParts.push(flagPane);
  }
  const fspFlagMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.75 }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  ctx.extraMaterials.push(fspFlagMat);
  group.add(new THREE.Mesh(mergeNormalized(fspFlagParts), fspFlagMat));

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
  // P1 Fansipan Motif Upgrades (`MB-037`..`MB-042`): Seated cleanly on deckTopY / upperDeckY!
  const fspMotifStone = new THREE.Mesh(
    mergeNormalized([
      ...createAncientStoneLanternParts(cx - 5.2, deckTopY, cz + 6.5, 0.92),
      ...createAncientStoneLanternParts(cx + 5.2, deckTopY, cz + 6.5, 0.92)
    ]),
    ctx.materials.stone
  );
  fspMotifStone.castShadow = false;
  const fspMotifGold = new THREE.Mesh(
    mergeNormalized(createLotusPetalRingParts(cx, upperDeckY + 0.05, cz - 14.5, 2.2, 12, 1, true)),
    ctx.materials.gold
  );
  fspMotifGold.castShadow = false;
  group.add(fspMotifStone, fspMotifGold);
  // 9. ĐỈNH FANSIPAN QC & AREA EXPANSIONS (Items 158..169 — seated on deckTopY / upperDeckY!)
  const fspExStone: THREE.BufferGeometry[] = [];
  const fspExWood: THREE.BufferGeometry[] = [];
  const fspExRoof: THREE.BufferGeometry[] = [];
  const fspExBronze: THREE.BufferGeometry[] = [];
  const fspExCrimson: THREE.BufferGeometry[] = [];
  const fspExGold: THREE.BufferGeometry[] = [];
  // 158-159. Cổng Trời Thanh Vân Đắc Lộ blue-stone gate & Đường La Hán Arhat Path parapet
  fspExStone.push(
    makeBox(1.1, 4.2, 1.1, cx - 2.2, deckTopY + 2.1, cz + 15.2),
    makeBox(1.1, 4.2, 1.1, cx + 2.2, deckTopY + 2.1, cz + 15.2),
    makeBox(6.2, 0.75, 1.35, cx, deckTopY + 4.4, cz + 15.2),
    ...createPiercedBalustradeParts(cx - 16.5, cz - 14.0, cx - 16.5, cz + 0.2, upperDeckY + 0.04, 0.85, 'chu_van')
  );
  // 160-161. Tàu Hỏa Leo Núi Mường Hoa funicular railcar & Ga Tàu station canopy (SE terrace, seated on deckTopY!)
  fspExStone.push(makeBox(5.6, 0.36, 7.2, cx + 15.5, deckTopY + 0.18, cz + 12.0));
  for (const px of [-2.2, 2.2]) {
    for (const pz of [-2.8, 2.8]) {
      fspExWood.push(makeCylinder(0.11, 0.12, 2.95, 6, cx + 15.5 + px, deckTopY + 1.80, cz + 12.0 + pz));
    }
  }
  fspExRoof.push(createGableRoofGeometry(6.4, 7.8, 1.35).translate(cx + 15.5, deckTopY + 3.25, cz + 12.0));
  fspExCrimson.push(makeBox(2.2, 1.65, 4.2, cx + 15.5, deckTopY + 1.25, cz + 12.0));
  fspExGold.push(makeBox(2.28, 0.18, 4.28, cx + 15.5, deckTopY + 1.15, cz + 12.0));
  // 162-164. Sàn Ngắm Mây Cloud-Viewing Deck, brass telescope & Miếu Sơn Thần stone shrine
  fspExWood.push(makeBox(6.4, 0.26, 4.8, cx - 15.5, deckTopY + 0.18, cz + 12.5));
  fspExBronze.push(
    makeCylinder(0.06, 0.08, 1.25, 6, cx - 16.8, deckTopY + 0.92, cz + 13.8),
    makeCylinder(0.08, 0.05, 0.65, 6, cx - 16.8, deckTopY + 1.56, cz + 13.9, Math.PI * 0.42, 0, 0)
  );
  fspExStone.push(makeBox(1.85, 2.2, 1.65, cx + 15.2, upperDeckY + 1.1, cz - 14.2));
  fspExRoof.push(createVietnameseCurvedRoofGeometry(2.4, 2.2, 0.4, 0.4, 0.85, 0.25).translate(cx + 15.2, upperDeckY + 2.2, cz - 14.2));
  // 166-169. Connecting stair balustrade, prayer wheels on grounded timber rack, rhododendrons & summit Bình Phong
  fspExStone.push(
    makeBox(3.6, 1.85, 0.36, cx, deckTopY + 0.92, cz + 12.2)
  );
  fspExWood.push(
    makeBox(3.6, 0.12, 0.24, cx + 5.2, upperDeckY + 1.15, cz - 0.1),
    makeBox(3.6, 0.12, 0.24, cx + 5.2, upperDeckY + 0.55, cz - 0.1),
    makeBox(0.14, 1.25, 0.24, cx + 3.4, upperDeckY + 0.62, cz - 0.1),
    makeBox(0.14, 1.25, 0.24, cx + 7.0, upperDeckY + 0.62, cz - 0.1)
  );
  for (let pw = -2; pw <= 2; pw++) {
    fspExGold.push(makeCylinder(0.16, 0.16, 0.48, 8, cx + 5.2 + pw * 0.68, upperDeckY + 0.85, cz - 0.1));
  }
  fspExCrimson.push(
    new THREE.DodecahedronGeometry(0.65, 0).translate(cx - 16.2, upperDeckY + 0.55, cz - 15.2),
    new THREE.DodecahedronGeometry(0.72, 0).translate(cx + 16.4, upperDeckY + 0.58, cz - 15.0)
  );
  addMergedMesh(group, fspExStone, ctx.materials.stone, 'FansipanExpansionStone', false, true);
  addMergedMesh(group, fspExWood, ctx.materials.darkWood, 'FansipanExpansionWood', false, true);
  addMergedMesh(group, fspExRoof, ctx.materials.terracottaRoof, 'FansipanExpansionRoof', false, true);
  addMergedMesh(group, fspExBronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'FansipanExpansionBronze', false, true);
  addMergedMesh(group, fspExCrimson, ctx.materials.crimsonLacquer, 'FansipanExpansionCrimson', false, true);
  addMergedMesh(group, fspExGold, ctx.materials.gold, 'FansipanExpansionGold', false, false);

  // 9B. ĐỈNH FANSIPAN WAVE 2 REAL-WORLD DETAILS (Items 361..370, castShadow = false, 0 new materials)
  const fspW2Stone: THREE.BufferGeometry[] = [];
  const fspW2Wood: THREE.BufferGeometry[] = [];
  const fspW2Bronze: THREE.BufferGeometry[] = [];
  const fspW2Crimson: THREE.BufferGeometry[] = [];
  const fspW2Gold: THREE.BufferGeometry[] = [];
  const fspW2Steel: THREE.BufferGeometry[] = [];
  // 361-363. Fansipan 3S cable-car arrival terrace (deep hillside skirt!), monumental 3S pylon & red-and-gold suspended cabin (SE ridge)
  const ccX = cx + 21.5;
  const ccZ = cz + 16.5;
  const ccY = Math.max(
    ctx.getHeight(ccX, ccZ),
    ctx.getHeight(ccX - 3.4, ccZ - 2.8),
    ctx.getHeight(ccX + 3.4, ccZ - 2.8),
    ctx.getHeight(ccX - 3.4, ccZ + 2.8),
    ctx.getHeight(ccX + 3.4, ccZ + 2.8)
  );
  fspW2Stone.push(makeBox(6.8, 5.2, 5.6, ccX, ccY - 1.32, ccZ));
  fspW2Wood.push(makeBox(6.4, 1.35, 0.18, ccX, ccY + 1.95, ccZ - 2.6));
  fspW2Steel.push(
    makeCylinder(0.20, 0.34, 10.5, 6, ccX + 3.8, ccY + 5.2, ccZ + 2.2),
    makeBox(4.8, 0.36, 0.42, ccX + 3.8, ccY + 10.2, ccZ + 2.2, 0.45),
    makeCylinder(0.05, 0.05, 2.2, 5, ccX + 2.2, ccY + 8.8, ccZ + 1.2)
  );
  fspW2Crimson.push(makeBox(2.4, 1.75, 1.65, ccX + 2.2, ccY + 6.9, ccZ + 1.2, 0.45));
  fspW2Gold.push(makeBox(2.48, 0.22, 1.72, ccX + 2.2, ccY + 7.75, ccZ + 1.2, 0.45));
  // 364. 6 bronze Arhat statues on stone plinths along Đường La Hán West ridge (seated cleanly on upperDeckY / deckTopY!)
  for (let ar = 0; ar < 6; ar++) {
    const az = cz - 12.0 + ar * 4.2;
    const arY = az <= cz + 0.5 ? upperDeckY : deckTopY;
    fspW2Stone.push(makeBox(0.75, 0.65, 0.75, cx - 15.6, arY + 0.32, az));
    fspW2Bronze.push(
      makeCylinder(0.18, 0.24, 1.15, 6, cx - 15.6, arY + 1.22, az),
      new THREE.ConeGeometry(0.16, 0.32, 5).translate(cx - 15.6, arY + 1.95, az)
    );
  }
  // 365-370. 4 alpine bronze lanterns, Quán Cà Phê Mây kiosk, Mường Hoa lookout balcony, Buddhist prayer banners on poles, Buddha altar table & 3143m geodesic marker
  for (const sx of [-6.8, 6.8]) {
    for (const sz of [-6.8, 6.8]) {
      const ly = sz <= 0.5 ? upperDeckY : deckTopY;
      fspW2Bronze.push(
        makeCylinder(0.08, 0.14, 1.95, 5, cx + sx, ly + 0.98, cz + sz),
        makeBox(0.36, 0.42, 0.36, cx + sx, ly + 2.15, cz + sz)
      );
    }
  }
  fspW2Stone.push(
    makeBox(3.4, 2.35, 2.6, cx + 15.2, deckTopY + 1.18, cz + 5.2),
    makeBox(4.8, 0.36, 3.2, cx - 12.5, deckTopY + 0.18, cz + 16.2),
    makeBox(2.2, 0.85, 0.95, cx, upperDeckY + 0.42, cz - 10.8)
  );
  fspW2Wood.push(
    makeBox(3.8, 0.28, 3.0, cx + 15.2, deckTopY + 2.48, cz + 5.2),
    makeBox(0.95, 0.65, 0.95, cx + 12.6, deckTopY + 0.32, cz + 5.2)
  );
  fspW2Steel.push(makeBox(4.6, 0.92, 0.10, cx - 12.5, deckTopY + 0.82, cz + 17.7));
  for (const side of [-1, 1]) {
    fspW2Wood.push(makeCylinder(0.04, 0.05, 3.4, 5, cx + side * 4.2, deckTopY + 1.7, cz + 3.2));
    fspW2Crimson.push(makeBox(0.06, 1.85, 0.52, cx + side * 4.2, deckTopY + 2.55, cz + 3.5));
    fspW2Bronze.push(makeCylinder(0.05, 0.10, 0.55, 5, cx + side * 0.82, upperDeckY + 1.12, cz - 10.8));
  }
  fspW2Gold.push(makeCylinder(0.32, 0.38, 0.42, 6, cx + 2.4, deckTopY + 0.21, cz + 2.4));

  addMergedMesh(group, fspW2Stone, ctx.materials.stone, 'FansipanWave2Stone', false, true);
  addMergedMesh(group, fspW2Wood, ctx.materials.darkWood, 'FansipanWave2Wood', false, true);
  addMergedMesh(group, fspW2Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'FansipanWave2Bronze', false, true);
  addMergedMesh(group, fspW2Crimson, ctx.materials.crimsonLacquer, 'FansipanWave2Crimson', false, true);
  addMergedMesh(group, fspW2Gold, ctx.materials.gold, 'FansipanWave2Gold', false, false);
  addMergedMesh(group, fspW2Steel, stainlessMat, 'FansipanWave2Steel', false, false);

  // 9C. ĐỈNH FANSIPAN WAVE 3 REAL-WORLD DETAILS (Items 721..740, castShadow = false, 0 new materials)
  const fspW3Stone: THREE.BufferGeometry[] = [];
  const fspW3Wood: THREE.BufferGeometry[] = [];
  const fspW3Roof: THREE.BufferGeometry[] = [];
  const fspW3Bronze: THREE.BufferGeometry[] = [];
  const fspW3Crimson: THREE.BufferGeometry[] = [];
  const fspW3Gold: THREE.BufferGeometry[] = [];
  const fspW3Steel: THREE.BufferGeometry[] = [];

  // 721-724. Bích Vân Thiền Tự Trần-dynasty alpine temple (cx - 10.5, deckTopY, cz + 2.8 — clear of 21.5m Amitabha Buddha!), Tam Bảo altar, brackets & stone parapet
  const bvX = cx - 10.5;
  const bvZ = cz + 2.8;
  fspW3Stone.push(
    makeBox(6.8, 0.65, 5.2, bvX, deckTopY + 0.32, bvZ),
    makeBox(7.2, 0.55, 0.24, bvX, deckTopY + 0.28, bvZ + 3.2)
  );
  for (const dx of [-2.7, -0.9, 0.9, 2.7]) {
    for (const dz of [-1.9, 1.9]) {
      fspW3Wood.push(makeCylinder(0.13, 0.15, 3.15, 6, bvX + dx, deckTopY + 2.08, bvZ + dz));
    }
  }
  fspW3Wood.push(
    makeBox(5.6, 2.75, 0.24, bvX, deckTopY + 2.02, bvZ - 1.85),
    makeBox(0.24, 2.75, 3.8, bvX - 2.65, deckTopY + 2.02, bvZ),
    makeBox(0.24, 2.75, 3.8, bvX + 2.65, deckTopY + 2.02, bvZ),
    makeBox(6.0, 0.26, 0.38, bvX, deckTopY + 3.48, bvZ + 1.95)
  );
  fspW3Roof.push(
    createHueImperialHipRoofGeometry(7.8, 6.2, 3.8, 0.32, 1.85, 0.28, 6, 4, false).translate(bvX, deckTopY + 3.60, bvZ)
  );
  fspW3Stone.push(makeBox(3.9, 0.16, 0.22, bvX, deckTopY + 5.48, bvZ));
  fspW3Crimson.push(makeBox(2.2, 0.88, 0.82, bvX, deckTopY + 1.09, bvZ - 1.1));
  fspW3Bronze.push(makeCylinder(0.16, 0.12, 0.30, 6, bvX, deckTopY + 1.68, bvZ - 1.1));
  for (const gx of [-0.65, 0, 0.65]) {
    fspW3Gold.push(new THREE.ConeGeometry(0.16, 0.48, 5).translate(bvX + gx, deckTopY + 1.85, bvZ - 1.25));
  }

  // 725-726. Vọng Lĩnh Cao Đài Great Bell timber striker beam (chày kình with suspension rods!) & front stone incense altar
  fspW3Wood.push(
    makeCylinder(0.08, 0.08, 2.2, 5, bellX, deckTopY + 2.25, bellZ + 1.45, Math.PI * 0.5),
    makeCylinder(0.03, 0.03, 1.85, 4, bellX, deckTopY + 3.15, bellZ + 0.85),
    makeCylinder(0.03, 0.03, 1.85, 4, bellX, deckTopY + 3.15, bellZ + 2.05)
  );
  fspW3Stone.push(makeBox(1.85, 0.78, 0.82, bellX, deckTopY + 0.39, bellZ + 3.8));
  fspW3Bronze.push(
    makeCylinder(0.05, 0.09, 0.44, 5, bellX - 0.62, deckTopY + 1.00, bellZ + 3.8),
    makeCylinder(0.05, 0.09, 0.44, 5, bellX + 0.62, deckTopY + 1.00, bellZ + 3.8)
  );

  // 727-728. 6 additional bronze Arhat statues along North-West Đường La Hán + 2 Arhat stone shrine canopies
  for (let ar = 0; ar < 6; ar++) {
    const ax = cx - 13.5 + ar * 1.8;
    fspW3Stone.push(makeBox(0.72, 0.62, 0.72, ax, upperDeckY + 0.31, cz - 14.5));
    fspW3Bronze.push(
      makeCylinder(0.16, 0.22, 1.10, 6, ax, upperDeckY + 1.18, cz - 14.5),
      new THREE.ConeGeometry(0.15, 0.30, 5).translate(ax, upperDeckY + 1.88, cz - 14.5)
    );
  }
  for (const az of [cz - 10.0, cz - 1.6]) {
    fspW3Stone.push(
      makeBox(0.14, 2.15, 0.14, cx - 16.3, upperDeckY + 1.00, az - 0.75),
      makeBox(0.14, 2.15, 0.14, cx - 16.3, upperDeckY + 1.00, az + 0.75),
      makeBox(0.14, 2.15, 0.14, cx - 14.9, upperDeckY + 1.00, az - 0.75),
      makeBox(0.14, 2.15, 0.14, cx - 14.9, upperDeckY + 1.00, az + 0.75)
    );
    fspW3Roof.push(makeBox(1.95, 0.28, 1.95, cx - 15.6, upperDeckY + 2.15, az));
  }

  // 729-740. Kim Sơn Bảo Thắng pillars & butter-lamp rack, Cổng Trời guardians, 3143m viewing ring, summit flagpoles, café tables, funicular tracks, 3S steel cables, cloud-deck bench, Bảo Tháp lanterns, Buddha dedication stele & trail signpost
  for (const side of [-1, 1]) {
    fspW3Stone.push(
      makeBox(0.55, 2.45, 0.55, pagX + side * 3.2, pagBaseY + 1.18, pagZ + 6.8),
      makeBox(0.68, 0.52, 0.68, cx + side * 3.6, deckTopY + 0.26, cz + 15.2),
      makeCylinder(0.22, 0.28, 1.15, 6, cx + side * 3.6, deckTopY + 1.08, cz + 15.2)
    );
    fspW3Steel.push(makeCylinder(0.04, 0.06, 4.2, 5, cx + side * 8.5, upperDeckY + 2.02, cz - 1.5));
    fspW3Crimson.push(makeBox(0.05, 1.35, 0.62, cx + side * 8.5, upperDeckY + 3.45, cz - 1.15));
    // 735. Twin funicular rails entering station
    fspW3Steel.push(makeBox(0.12, 0.12, 5.2, cx + 15.5 + side * 0.65, deckTopY + 0.26, cz + 16.5));
  }
  fspW3Stone.push(
    makeBox(1.55, 0.72, 0.45, pagX + 3.6, pagBaseY + 0.36, pagZ + 4.8),
    makeCylinder(2.6, 2.75, 0.24, 8, cx, deckTopY + 0.12, cz + 5.5),
    makeBox(1.95, 0.44, 0.55, cx - 15.5, deckTopY + 0.40, cz + 10.5),
    makeBox(1.05, 1.55, 0.24, cx - 4.2, upperDeckY + 0.78, cz - 10.8)
  );
  fspW3Roof.push(makeBox(1.35, 0.22, 0.65, cx - 4.2, upperDeckY + 1.65, cz - 10.8));
  for (let bl = -2; bl <= 2; bl++) {
    fspW3Gold.push(makeCylinder(0.07, 0.05, 0.12, 5, pagX + 3.6 + bl * 0.28, pagBaseY + 0.78, pagZ + 4.8));
  }
  for (const czC of [cz + 2.8, cz + 7.5]) {
    fspW3Wood.push(
      makeBox(0.95, 0.68, 0.95, cx + 12.2, deckTopY + 0.34, czC),
      makeBox(0.32, 0.36, 0.32, cx + 11.4, deckTopY + 0.18, czC),
      makeBox(0.32, 0.36, 0.32, cx + 13.0, deckTopY + 0.18, czC)
    );
  }
  // 736. 3 tensioned steel 3S cable-car ropes descending from pylon
  for (const co of [-1.2, 0, 1.2]) {
    fspW3Steel.push(makeCylinder(0.04, 0.04, 14.0, 4, ccX + 7.8 + co * 0.4, ccY + 8.2, ccZ + 6.5, 0.35, 0, 0.45));
  }
  // 738. 4 stone alpine lanterns guarding Bảo Tháp corners
  for (const sx of [-3.2, 3.2]) {
    for (const sz of [-3.2, 3.2]) {
      fspW3Stone.push(
        makeBox(0.42, 1.05, 0.42, stuX + sx, stuBaseY + 0.52, stuZ + sz),
        makeBox(0.56, 0.18, 0.56, stuX + sx, stuBaseY + 1.14, stuZ + sz)
      );
    }
  }
  // 740. Bronze alpine directional signpost
  fspW3Bronze.push(
    makeCylinder(0.06, 0.08, 2.25, 6, cx + 4.5, deckTopY + 1.12, cz + 8.5),
    makeBox(0.85, 0.22, 0.08, cx + 4.9, deckTopY + 1.98, cz + 8.5)
  );

  addMergedMesh(group, fspW3Stone, ctx.materials.stone, 'FansipanWave3Stone', false, true);
  addMergedMesh(group, fspW3Wood, ctx.materials.darkWood, 'FansipanWave3Wood', false, true);
  addMergedMesh(group, fspW3Roof, ctx.materials.terracottaRoof, 'FansipanWave3Roof', false, true);
  addMergedMesh(group, fspW3Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'FansipanWave3Bronze', false, true);
  addMergedMesh(group, fspW3Crimson, ctx.materials.crimsonLacquer, 'FansipanWave3Crimson', false, true);
  addMergedMesh(group, fspW3Gold, ctx.materials.gold, 'FansipanWave3Gold', false, false);
  addMergedMesh(group, fspW3Steel, stainlessMat, 'FansipanWave3Steel', false, false);

  // 9D. ĐỈNH FANSIPAN WAVE 4 ALPINE SANCTUARY EXPANSION (Items 1126..1150, castShadow = false, 0 new materials)
  const fspW4Stone: THREE.BufferGeometry[] = [];
  const fspW4Wood: THREE.BufferGeometry[] = [];
  const fspW4Roof: THREE.BufferGeometry[] = [];
  const fspW4Bronze: THREE.BufferGeometry[] = [];
  const fspW4Crimson: THREE.BufferGeometry[] = [];
  const fspW4Gold: THREE.BufferGeometry[] = [];
  const fspW4Steel: THREE.BufferGeometry[] = [];

  // 1126, 1130, 1136, 1141. Bảo An Thiền Tự lower-ridge gate (cx - 18.5, cz + 15.5), cloud parapet, guardian lions & photo dais
  const baX = cx - 18.5;
  const baZ = cz + 15.5;
  const baY = Math.max(ctx.getHeight(baX, baZ), ctx.getHeight(baX - 2.2, baZ - 1.2), ctx.getHeight(baX + 2.2, baZ + 1.2));
  fspW4Stone.push(
    makeBox(5.2, 3.8, 2.4, baX, baY - 1.65, baZ),
    makeBox(0.68, 3.35, 0.68, baX - 1.85, baY + 1.75, baZ),
    makeBox(0.68, 3.35, 0.68, baX + 1.85, baY + 1.75, baZ),
    makeBox(4.8, 0.48, 0.82, baX, baY + 3.55, baZ),
    makeBox(0.24, 0.78, 7.2, cx - 18.5, deckTopY + 0.39, cz + 9.5),
    makeBox(2.4, 0.36, 2.4, cx - 16.5, deckTopY + 0.36, cz + 12.5)
  );
  fspW4Roof.push(makeBox(5.4, 0.42, 1.65, baX, baY + 3.98, baZ));
  for (const side of [-1, 1]) {
    fspW4Stone.push(
      makeBox(0.55, 0.46, 0.65, baX + side * 2.0, baY + 0.42, baZ + 1.3),
      makeBox(0.38, 0.52, 0.45, baX + side * 2.0, baY + 0.88, baZ + 1.3)
    );
  }
  // 1127-1129, 1137, 1143-1144. Quan Âm Shrine Pavilion (cx + 18.5, cz - 8.5), bronze statue, altar, steps & planters
  const qaX = cx + 18.5;
  const qaZ = cz - 8.5;
  const qaY = Math.max(ctx.getHeight(qaX, qaZ), ctx.getHeight(qaX - 2.2, qaZ - 2.2), ctx.getHeight(qaX + 2.2, qaZ + 2.2));
  fspW4Stone.push(
    makeBox(4.8, 4.2, 4.8, qaX, qaY - 1.85, qaZ),
    makeBox(1.45, 0.42, 2.4, cx + 15.8, qaY + 0.16, qaZ)
  );
  for (const dx of [-1.75, 1.75]) {
    for (const dz of [-1.75, 1.75]) {
      fspW4Crimson.push(makeCylinder(0.11, 0.13, 2.95, 6, qaX + dx, qaY + 1.65, qaZ + dz));
    }
  }
  fspW4Roof.push(
    makeBox(5.6, 0.38, 5.6, qaX, qaY + 3.22, qaZ),
    makeBox(3.4, 0.44, 3.4, qaX, qaY + 3.64, qaZ)
  );
  fspW4Crimson.push(
    makeBox(1.45, 0.85, 0.72, qaX, qaY + 0.68, qaZ + 0.85),
    makeCylinder(0.14, 0.14, 0.28, 6, qaX - 1.75, qaY + 2.85, qaZ + 1.75),
    makeCylinder(0.14, 0.14, 0.28, 6, qaX + 1.75, qaY + 2.85, qaZ + 1.75)
  );
  fspW4Bronze.push(
    makeCylinder(0.32, 0.42, 1.65, 6, qaX, qaY + 1.08, qaZ - 0.45),
    makeCylinder(0.16, 0.12, 0.28, 6, qaX, qaY + 1.24, qaZ + 0.85)
  );
  // 1131-1135, 1138-1140, 1142, 1145-1150. Prayer wheels, weather mast, benches, oil lamps, history stele, flags, café tables, Arhat lanterns, telescope, votive burner, Bích Vân bell, stanchions, info board, Bảo Tháp censer & compass marker
  for (let i = 0; i < 4; i++) {
    const pz = cz - 4.0 - i * 2.6;
    for (const side of [-1, 1]) {
      fspW4Stone.push(makeBox(0.36, 0.82, 0.36, cx + side * 9.5, upperDeckY + 0.41, pz));
      fspW4Gold.push(makeCylinder(0.14, 0.14, 0.38, 6, cx + side * 9.5, upperDeckY + 1.02, pz));
    }
    const alz = cz - 12.0 + i * 3.8;
    const aly = alz <= cz + 0.5 ? upperDeckY : deckTopY;
    fspW4Stone.push(
      makeBox(0.40, 0.98, 0.40, cx - 14.2, aly + 0.49, alz),
      makeBox(0.52, 0.16, 0.52, cx - 14.2, aly + 1.06, alz)
    );
  }
  fspW4Steel.push(
    makeCylinder(0.05, 0.08, 4.6, 5, cx + 16.5, upperDeckY + 2.25, cz - 14.5),
    makeBox(1.35, 0.08, 0.08, cx + 16.5, upperDeckY + 4.25, cz - 14.5),
    makeBox(0.12, 0.92, 4.4, ccX - 3.2, ccY + 1.72, ccZ),
    makeBox(1.25, 1.45, 0.14, cx + 12.5, deckTopY + 0.72, cz + 15.5)
  );
  fspW4Stone.push(
    makeBox(0.95, 1.48, 0.24, cx + 6.5, deckTopY + 0.74, cz + 14.5),
    makeBox(1.15, 1.45, 1.15, bvX - 4.2, deckTopY + 0.72, bvZ - 1.5)
  );
  fspW4Roof.push(makeBox(1.38, 0.24, 1.38, bvX - 4.2, deckTopY + 1.56, bvZ - 1.5));
  fspW4Wood.push(
    makeBox(0.12, 1.95, 0.12, bvX + 3.6, deckTopY + 0.92, bvZ + 1.5),
    makeBox(0.12, 1.95, 0.12, bvX + 4.8, deckTopY + 0.92, bvZ + 1.5),
    makeBox(1.45, 0.14, 0.14, bvX + 4.2, deckTopY + 1.92, bvZ + 1.5),
    makeBox(0.92, 0.65, 0.92, cx + 15.2, deckTopY + 0.32, cz + 8.5),
    makeBox(0.92, 0.65, 0.92, cx + 15.2, deckTopY + 0.32, cz + 10.2)
  );
  fspW4Bronze.push(
    makeCylinder(0.20, 0.28, 0.62, 6, bvX + 4.2, deckTopY + 1.42, bvZ + 1.5),
    makeCylinder(0.06, 0.08, 1.25, 6, cx + 16.5, deckTopY + 0.62, cz + 1.5),
    makeCylinder(0.08, 0.05, 0.62, 6, cx + 16.5, deckTopY + 1.28, cz + 1.5, Math.PI * 0.42),
    makeCylinder(0.24, 0.18, 0.46, 6, stuX, stuBaseY + 0.23, stuZ + 3.8),
    makeCylinder(0.32, 0.38, 0.85, 6, cx, upperDeckY + 0.42, cz - 17.5)
  );
  for (const side of [-1, 1]) {
    fspW4Stone.push(
      makeBox(1.65, 0.42, 0.52, cx + side * 14.5, deckTopY + 0.21, cz + 8.5),
      makeBox(1.65, 0.42, 0.52, cx + side * 14.5, upperDeckY + 0.21, cz - 11.5),
      makeBox(0.62, 0.45, 0.62, bvX + side * 3.4, deckTopY + 0.22, bvZ + 2.8),
      makeBox(0.62, 0.45, 0.62, qaX - 2.4, qaY + 0.42, qaZ + side * 1.6)
    );
    fspW4Bronze.push(makeCylinder(0.06, 0.10, 1.15, 5, bvX + side * 2.2, deckTopY + 0.58, bvZ + 2.8));
    fspW4Steel.push(makeCylinder(0.04, 0.05, 3.6, 5, cx + side * 6.5, deckTopY + 1.75, cz + 14.5));
    fspW4Crimson.push(makeBox(0.05, 1.25, 0.55, cx + side * 6.5, deckTopY + 2.95, cz + 14.85));
  }
  addMergedMesh(group, fspW4Stone, ctx.materials.stone, 'FansipanWave4Stone', false, true);
  addMergedMesh(group, fspW4Wood, ctx.materials.darkWood, 'FansipanWave4Wood', false, true);
  addMergedMesh(group, fspW4Roof, ctx.materials.terracottaRoof, 'FansipanWave4Roof', false, true);
  addMergedMesh(group, fspW4Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'FansipanWave4Bronze', false, true);
  addMergedMesh(group, fspW4Crimson, ctx.materials.crimsonLacquer, 'FansipanWave4Crimson', false, true);
  addMergedMesh(group, fspW4Gold, ctx.materials.gold, 'FansipanWave4Gold', false, false);
  addMergedMesh(group, fspW4Steel, stainlessMat, 'FansipanWave4Steel', false, false);

  // 9E. ĐỈNH FANSIPAN WAVE 5 KIM SƠN BẢO THẮNG BELL & DRUM PAVILIONS (Items 1521..1540, castShadow = false, 0 new materials)
  const fspW5Stone: THREE.BufferGeometry[] = [];
  const fspW5Wood: THREE.BufferGeometry[] = [];
  const fspW5Roof: THREE.BufferGeometry[] = [];
  const fspW5Bronze: THREE.BufferGeometry[] = [];
  const fspW5Crimson: THREE.BufferGeometry[] = [];
  const fspW5Gold: THREE.BufferGeometry[] = [];
  const fspW5Steel: THREE.BufferGeometry[] = [];

  // 1521-1527, 1531, 1534, 1536-1537. Lầu Chuông (cx - 18.5, cz - 14.5) & Lầu Trống (cx + 18.5, cz + 6.5)
  for (const [px, pz, isBell] of [[cx - 18.5, cz - 14.5, true], [cx + 18.5, cz + 6.5, false]] as const) {
    const py = Math.max(ctx.getHeight(px, pz), ctx.getHeight(px - 2.2, pz - 2.2), ctx.getHeight(px + 2.2, pz + 2.2));
    fspW5Stone.push(
      makeBox(4.8, 4.2, 4.8, px, py - 1.85, pz),
      makeBox(1.35, 0.42, 2.2, isBell ? px + 2.8 : px - 2.8, py + 0.16, pz),
      makeBox(1.55, 0.42, 0.50, px, py + 0.46, pz + 3.0),
      makeBox(0.58, 0.44, 0.58, isBell ? px + 2.4 : px - 2.4, py + 0.46, pz - 1.6),
      makeBox(0.58, 0.44, 0.58, isBell ? px + 2.4 : px - 2.4, py + 0.46, pz + 1.6)
    );
    for (const dx of [-1.75, 1.75]) {
      for (const dz of [-1.75, 1.75]) {
        fspW5Crimson.push(makeCylinder(0.11, 0.13, 2.95, 6, px + dx, py + 1.65, pz + dz));
      }
    }
    fspW5Roof.push(
      makeBox(5.6, 0.38, 5.6, px, py + 3.22, pz),
      makeBox(3.4, 0.42, 3.4, px, py + 3.62, pz)
    );
    fspW5Crimson.push(makeCylinder(0.14, 0.14, 0.28, 6, px, py + 2.85, pz));
    if (isBell) {
      fspW5Bronze.push(makeCylinder(0.32, 0.44, 1.15, 6, px, py + 1.65, pz));
    } else {
      fspW5Wood.push(makeBox(0.95, 0.68, 0.68, px, py + 0.58, pz));
      fspW5Crimson.push(makeCylinder(0.46, 0.46, 0.78, 6, px, py + 1.28, pz, 0, 0, Math.PI * 0.5));
    }
  }
  fspW5Stone.push(
    makeBox(1.45, 0.82, 0.72, cx - 15.5, upperDeckY + 0.41, cz - 14.5),
    makeBox(0.95, 1.48, 0.24, cx - 15.5, upperDeckY + 0.74, cz - 11.5),
    makeBox(0.24, 0.78, 6.4, cx + 18.5, deckTopY + 0.39, cz + 12.0),
    // 1532-1533, 1538-1539. SE Cloud Viewing Deck (cx + 18.5, cz + 15.5), telescope, tea tables & elevation board
    makeBox(4.2, 3.8, 3.6, cx + 18.5, deckTopY - 1.65, cz + 15.5)
  );
  fspW5Bronze.push(
    makeCylinder(0.22, 0.16, 0.42, 6, cx - 15.5, upperDeckY + 1.02, cz - 14.5),
    makeCylinder(0.06, 0.08, 1.25, 6, cx + 18.5, deckTopY + 0.85, cz + 16.2),
    makeCylinder(0.08, 0.05, 0.62, 6, cx + 18.5, deckTopY + 1.50, cz + 16.2, Math.PI * 0.42)
  );
  fspW5Steel.push(
    makeBox(4.2, 0.88, 0.10, cx + 18.5, deckTopY + 0.68, cz + 17.2),
    makeBox(1.25, 1.42, 0.14, cx + 16.5, deckTopY + 0.71, cz + 15.5)
  );
  fspW5Wood.push(
    makeBox(0.92, 0.65, 0.92, cx + 14.5, deckTopY + 0.32, cz + 12.6),
    makeBox(0.92, 0.65, 0.92, cx + 14.5, deckTopY + 0.32, cz + 14.4)
  );
  // 1528-1529, 1535, 1540. Wind-resistant lanterns, prayer wheels, Buddhist flags & bollards
  for (let i = 0; i < 4; i++) {
    const lx = cx - 12.0 + i * 8.0;
    fspW5Stone.push(
      makeBox(0.42, 0.98, 0.42, lx, upperDeckY + 0.49, cz - 16.5),
      makeBox(0.56, 0.16, 0.56, lx, upperDeckY + 1.06, cz - 16.5),
      makeBox(0.36, 0.82, 0.36, cx + 15.5, deckTopY + 0.41, cz + 3.0 + i * 2.0)
    );
    fspW5Gold.push(makeCylinder(0.14, 0.14, 0.38, 6, cx + 15.5, deckTopY + 1.02, cz + 3.0 + i * 2.0));
  }
  for (const side of [-1, 1]) {
    fspW5Steel.push(
      makeCylinder(0.04, 0.05, 3.6, 5, cx + side * 12.5, upperDeckY + 1.75, cz - 16.5),
      makeCylinder(0.04, 0.05, 3.6, 5, cx + side * 12.5, deckTopY + 1.75, cz + 12.5)
    );
    fspW5Gold.push(
      makeBox(0.05, 1.15, 0.52, cx + side * 12.5, upperDeckY + 2.95, cz - 16.15),
      makeBox(0.05, 1.15, 0.52, cx + side * 12.5, deckTopY + 2.95, cz + 12.85)
    );
    fspW5Stone.push(
      makeCylinder(0.14, 0.18, 0.68, 5, cx + side * 8.5, upperDeckY + 0.34, cz - 16.5),
      makeCylinder(0.14, 0.18, 0.68, 5, cx + side * 8.5, upperDeckY + 0.34, cz - 13.5)
    );
  }
  addMergedMesh(group, fspW5Stone, ctx.materials.stone, 'FansipanWave5Stone', false, true);
  addMergedMesh(group, fspW5Wood, ctx.materials.darkWood, 'FansipanWave5Wood', false, true);
  addMergedMesh(group, fspW5Roof, ctx.materials.terracottaRoof, 'FansipanWave5Roof', false, true);
  addMergedMesh(group, fspW5Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'FansipanWave5Bronze', false, true);
  addMergedMesh(group, fspW5Crimson, ctx.materials.crimsonLacquer, 'FansipanWave5Crimson', false, true);
  addMergedMesh(group, fspW5Gold, ctx.materials.gold, 'FansipanWave5Gold', false, false);
  addMergedMesh(group, fspW5Steel, stainlessMat, 'FansipanWave5Steel', false, false);

  // =================================================================================================
  // FANSIPAN SUMMIT WAVE 6 (Items 1921..1940 — castShadow = false, 0 new materials)
  // =================================================================================================
  const fspW6Stone: THREE.BufferGeometry[] = [];
  const fspW6Wood: THREE.BufferGeometry[] = [];
  const fspW6Roof: THREE.BufferGeometry[] = [];
  const fspW6Bronze: THREE.BufferGeometry[] = [];
  const fspW6Crimson: THREE.BufferGeometry[] = [];
  const fspW6Gold: THREE.BufferGeometry[] = [];
  const fspW6Steel: THREE.BufferGeometry[] = [];

  // 1921-1923, 1926-1937, 1940. SW Alpine Meditation Pavilion (cx - 18.5, cz + 12.0) on deep -2.8m granite skirt
  const mpX = cx - 18.5;
  const mpZ = cz + 12.0;
  const mpY = Math.max(ctx.getHeight(mpX, mpZ), ctx.getHeight(mpX - 2.0, mpZ - 2.0), ctx.getHeight(mpX + 2.0, mpZ + 2.0), deckTopY);
  fspW6Stone.push(
    makeBox(4.4, 3.2, 4.4, mpX, mpY - 1.40, mpZ),
    makeBox(1.35, 0.56, 0.85, mpX, mpY + 0.48, mpZ),
    makeBox(1.25, 0.78, 0.65, cx - 15.5, deckTopY + 0.39, cz + 12.0),
    makeBox(0.32, 0.88, 7.2, cx - 21.5, mpY + 0.64, mpZ),
    makeBox(1.55, 0.42, 0.48, cx - 15.0, deckTopY + 0.21, cz + 16.2),
    makeBox(1.55, 0.42, 0.48, cx - 21.0, mpY + 0.41, cz + 16.2),
    makeBox(0.92, 1.55, 0.24, cx - 14.5, deckTopY + 0.78, cz + 8.5),
    makeBox(0.58, 0.42, 0.58, cx - 16.8, mpY + 0.41, cz + 10.2),
    makeBox(0.58, 0.42, 0.58, cx - 16.8, mpY + 0.41, cz + 13.8)
  );
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.65, 1.65]) {
      fspW6Crimson.push(makeCylinder(0.10, 0.12, 2.80, 4, mpX + dx, mpY + 1.50, mpZ + dz));
      fspW6Bronze.push(makeCylinder(0.03, 0.03, 0.42, 4, mpX + dx * 1.15, mpY + 2.68, mpZ + dz * 1.15));
    }
  }
  fspW6Roof.push(makeBox(5.0, 0.32, 5.0, mpX, mpY + 2.96, mpZ));
  fspW6Crimson.push(
    makeBox(0.20, 0.26, 0.20, mpX - 0.9, mpY + 2.62, mpZ + 1.5),
    makeBox(0.20, 0.26, 0.20, mpX + 0.9, mpY + 2.62, mpZ + 1.5)
  );
  fspW6Bronze.push(makeCylinder(0.26, 0.20, 0.48, 4, cx - 15.5, deckTopY + 1.02, cz + 12.0));
  fspW6Wood.push(
    makeBox(1.25, 0.72, 0.68, cx - 13.5, deckTopY + 0.36, cz + 14.5),
    makeBox(0.36, 0.40, 0.36, cx - 13.5, deckTopY + 0.20, cz + 13.8),
    makeBox(0.36, 0.40, 0.36, cx - 13.5, deckTopY + 0.20, cz + 15.2)
  );
  for (let i = 0; i < 3; i++) {
    const wz = cz + 9.0 + i * 3.0;
    fspW6Stone.push(
      makeBox(0.36, 0.80, 0.36, cx - 15.5, deckTopY + 0.40, wz),
      makeBox(0.85, 0.45, 1.85, cx - 15.5 - i * 0.45, deckTopY + 0.14 + i * 0.10, cz + 12.0)
    );
    fspW6Gold.push(makeCylinder(0.14, 0.14, 0.36, 4, cx - 15.5, deckTopY + 0.98, wz));
  }
  for (const lz of [cz + 8.5, cz + 15.5]) {
    fspW6Stone.push(
      makeBox(0.42, 1.02, 0.42, mpX, mpY + 0.71, lz),
      makeBox(0.56, 0.16, 0.56, mpX, mpY + 1.30, lz)
    );
  }
  // 1924-1925, 1938-1939. North Summit Prayer-Flag Corridor (cx - 10..10, cz - 20.5)
  for (let i = 0; i < 6; i++) {
    const px = cx - 10.0 + i * 4.0;
    const py = Math.max(ctx.getHeight(px, cz - 20.5), upperDeckY);
    fspW6Steel.push(makeCylinder(0.04, 0.05, 3.4, 4, px, py + 1.60, cz - 20.5));
    if (i < 5) {
      fspW6Crimson.push(makeBox(1.85, 0.32, 0.04, px + 1.0, py + 2.85, cz - 20.5));
      fspW6Gold.push(makeBox(1.85, 0.32, 0.04, px + 3.0, py + 2.85, cz - 20.5));
    }
  }
  for (let i = 0; i < 4; i++) {
    const bx = cx - 9.0 + i * 6.0;
    fspW6Stone.push(makeCylinder(0.13, 0.16, 0.66, 4, bx, Math.max(ctx.getHeight(bx, cz - 19.2), upperDeckY) + 0.33, cz - 19.2));
  }
  fspW6Steel.push(makeCylinder(0.05, 0.07, 2.25, 4, cx - 12.0, upperDeckY + 1.12, cz - 20.5));
  fspW6Gold.push(makeBox(0.88, 0.36, 0.08, cx - 12.0, upperDeckY + 1.95, cz - 20.5));

  addMergedMesh(group, fspW6Stone, ctx.materials.stone, 'FansipanWave6Stone', false, true);
  addMergedMesh(group, fspW6Wood, ctx.materials.darkWood, 'FansipanWave6Wood', false, true);
  addMergedMesh(group, fspW6Roof, ctx.materials.terracottaRoof, 'FansipanWave6Roof', false, true);
  addMergedMesh(group, fspW6Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'FansipanWave6Bronze', false, true);
  addMergedMesh(group, fspW6Crimson, ctx.materials.crimsonLacquer, 'FansipanWave6Crimson', false, true);
  addMergedMesh(group, fspW6Gold, ctx.materials.gold, 'FansipanWave6Gold', false, false);
  addMergedMesh(group, fspW6Steel, stainlessMat, 'FansipanWave6Steel', false, false);

  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-C01', 'HV-C02', 'HV-C09', 'HV-D01', 'HV-D12',
    'HV-I04', 'HV-J04', 'HV-NEW-MB-12'
  ]);

  // FIX FSP-06: Horizontal layered undulating Sea-of-Clouds blanket rings (replacing 3 vertical "shower-curtain" cylinders — ref 08b!)
  const { material: mistMat, uniforms: mistU } = createSummitMistMaterial();
  ctx.extraMaterials.push(mistMat);
  registerUniform(ctx, flagUniforms, mistU);

  const cloudRingLayers: THREE.BufferGeometry[] = [];
  for (const [rIn, rOut, yOff, tiltX] of [
    [16.5, 30.0, -2.4, 0.05],
    [19.5, 35.0, -4.2, -0.04],
    [22.5, 40.0, -6.4, 0.03]
  ]) {
    const ring = new THREE.RingGeometry(rIn, rOut, 32, 3);
    ring.rotateX(-Math.PI * 0.5 + tiltX);
    const rp = ring.attributes.position;
    for (let vi = 0; vi < rp.count; vi++) {
      const rx = rp.getX(vi);
      const rz = rp.getZ(vi);
      rp.setY(vi, rp.getY(vi) + Math.sin(rx * 0.14) * Math.cos(rz * 0.14) * 1.15);
    }
    ring.computeVertexNormals();
    ring.translate(cx, yBase + yOff, cz);
    cloudRingLayers.push(ring);
  }
  const mistMesh = new THREE.Mesh(mergeNormalized(cloudRingLayers), mistMat);
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

  const lilyPadMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide }) ??
    ctx.materials.darkWood;
  const lilyFlowerMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#d93c8f', roughness: 0.48, metalness: 0.02, side: THREE.DoubleSide }) ??
    ctx.materials.crimsonLacquer;
  const mossyKarstMat = ctx.materials.granite;
  const apricotMat = ctx.materials.whitePlaster;

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
      // Carved golden lotus-bud finial cap crowning every bridge balustrade post
      goldParts.push(
        new THREE.ConeGeometry(0.10, 0.22, 6).translate(bx, archY + 1.15, bridgeZ + side * 1.65)
      );
      // Central arch projecting carved stone dragon-head gargoyle water-spouts & spandrel rosette relief medallions
      if (i === Math.floor(bridgeSegs / 2)) {
        const garg = new THREE.BoxGeometry(0.42, 0.34, 0.68);
        garg.translate(bx, archY - 0.12, bridgeZ + side * 1.92);
        const gargSnout = new THREE.ConeGeometry(0.18, 0.42, 5);
        gargSnout.rotateX(side * Math.PI * 0.48);
        gargSnout.translate(bx, archY - 0.10, bridgeZ + side * 2.34);
        stoneParts.push(garg, gargSnout);
      } else if (i % 3 === 1) {
        const rosette = new THREE.TorusGeometry(0.18, 0.045, 5, 8);
        rosette.translate(bx, archY - 0.15, bridgeZ + side * 1.78);
        stoneParts.push(rosette);
      }
    }
  }
  // Arched stone abutment piers anchored deep into East & West banks + stepped cutwaters & glowing bridge lanterns with crimson silk tassels
  for (const side of [-1, 1]) {
    const ax = bridgeX + side * (bridgeSpan * 0.5 + 0.6);
    const agy = ctx.getHeight(ax, bridgeZ);
    const ah = Math.max(2.6, 0.85 - (agy - 2.4));
    stoneParts.push(
      makeBox(2.4, ah, 4.4, ax, agy - 2.4 + ah * 0.5, bridgeZ),
      new THREE.ConeGeometry(0.65, 1.35, 4).rotateY(Math.PI * 0.25).translate(ax - side * 1.15, 0.35, bridgeZ - 2.15),
      new THREE.ConeGeometry(0.65, 1.35, 4).rotateY(Math.PI * 0.25).translate(ax - side * 1.15, 0.35, bridgeZ + 2.15)
    );
    // Bank approach stone steps
    for (let st = 0; st < 4; st++) {
      const sx = ax + side * (1.4 + st * 0.75);
      const sy = Math.max(ctx.getHeight(sx, bridgeZ) + 0.12, 0.75 - st * 0.18);
      stoneParts.push(makeBox(0.85, sy + 2.0, 3.8, sx, (sy - 2.0) * 0.5, bridgeZ));
    }
    for (const zSide of [-1, 1]) {
      const px = bridgeX + side * (bridgeSpan * 0.44);
      const pz = bridgeZ + zSide * 1.68;
      crimsonParts.push(
        makeCylinder(0.12, 0.14, 2.35, 8, px, 2.35, pz),
        new THREE.ConeGeometry(0.045, 0.24, 5).translate(px, 3.16, pz)
      );
      lanternParts.push(createRibbedLanternShellGeometry(0.20, 0.30, 8, 6).translate(px, 3.55, pz));
      lanternCoreParts.push(createLanternCoreGeometry(0.12, 0.19).translate(px, 3.55, pz));
    }
  }
  // Waterside Timber Mooring Jetty (*Bến Đò Suối Yến*) with bamboo mooring stakes & Turtle-Borne Stone Stele Pavilion (*Nhà Bia Bến Đục*) near Cầu Hội
  const jettyX = 194.2;
  const jettyZ = -138.0;
  woodParts.push(makeBox(3.4, 0.18, 6.2, jettyX, 0.42, jettyZ));
  for (const jz of [-2.4, 0, 2.4]) {
    woodParts.push(makeCylinder(0.09, 0.11, 2.1, 5, jettyX - 1.4, 0.15, jettyZ + jz));
    crimsonParts.push(makeBox(0.18, 0.06, 0.18, jettyX - 1.4, 1.15, jettyZ + jz));
  }
  const steleX = 198.8;
  const steleZ = -141.5;
  const steleY = ctx.getHeight(steleX, steleZ);
  stoneParts.push(
    makeBox(3.2, 0.45, 3.2, steleX, steleY + 0.22, steleZ),
    ...createCarvedTurtleSteleParts(steleX, steleY + 0.45, steleZ, -0.45, 0.92)
  );
  for (const sx of [-1.2, 1.2]) {
    for (const sz of [-1.2, 1.2]) {
      crimsonParts.push(makeCylinder(0.11, 0.13, 2.6, 6, steleX + sx, steleY + 1.75, steleZ + sz));
    }
  }
  const steleRoof = createVietnameseCurvedRoofGeometry(3.8, 3.8, 1.2, 1.2, 1.25, 0.28);
  steleRoof.translate(steleX, steleY + 3.05, steleZ);
  roofParts.push(steleRoof);

  // 2. FIX CH-05: 14 Authentic ~5.2m Open Dark-Hulled *Thuyền nan* Rowboats bobbing along Suối Yến
  //    carrying 5 multi-colored pilgrims in nón lá with splayed ±45° paddling oars dipping into the water (ref 107!)
  const nonLaMat = ctx.materials.bambooWeave ?? ctx.materials.yellowOchrePlaster;
  const pilgrimRobeMat =
    ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.75 }) ?? ctx.materials.stone;
  const outfitColors = ['#d6548a', '#eceae4', '#d97834', '#28966b', '#3b4a62', '#e0b838'];
  const paintPart = (g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry => {
    const c = new THREE.Color(hex);
    const cnt = g.attributes.position.count;
    const arr = new Float32Array(cnt * 3);
    for (let vi = 0; vi < cnt; vi++) {
      arr[vi * 3] = c.r;
      arr[vi * 3 + 1] = c.g;
      arr[vi * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };

  const sampanZs = [
    -210.0, -204.0, -198.0, -192.5, -187.0, -181.5, -176.0,
    -170.5, -165.0, -159.5, -154.0, -148.5, -143.5, -139.0
  ];
  for (let idx = 0; idx < sampanZs.length; idx++) {
    const sz = sampanZs[idx];
    const riverCx = 186.0 + 5.5 * Math.sin((sz + 180.0) * 0.045);
    const offset = idx % 2 === 0 ? -1.15 : 1.15;
    const sx = THREE.MathUtils.clamp(riverCx + offset, 180.2, 191.8);
    const dxdz = 5.5 * 0.045 * Math.cos((sz + 180.0) * 0.045);
    const yaw = Math.atan2(dxdz, 1.0) + (idx % 2 === 0 ? 0.07 : -0.07);

    const boatGroup = new THREE.Group();
    boatGroup.name = `SuoiYenSampan_${idx + 1}`;
    boatGroup.position.set(sx, 0.04, sz);
    boatGroup.rotation.y = yaw;

    const bWood: THREE.BufferGeometry[] = [];
    const bRobe: THREE.BufferGeometry[] = [];
    const bHat: THREE.BufferGeometry[] = [];

    // Authentic 5.2m × 1.36m hollow U-section dark-wood sampan hull (ref 107_thuyen_nan_suoi_yen.jpg)
    bWood.push(...createHollowSampanHullParts(5.2, 1.36, 0.40));

    // Recessed wooden thwart benches sized to fit cleanly inside the 5.2m tapered U-hull
    for (const [tz, bw] of [
      [-1.42, 0.86],
      [-0.45, 1.06],
      [0.52, 1.04],
      [1.42, 0.84]
    ]) {
      bWood.push(makeBox(bw, 0.06, 0.26, 0, 0.23, tz));
    }
    // Pair of rowing oars splayed outward ±48° with wide oar blades dipping actively into the water + curved interior hull ribs & bow offering basket!
    for (const side of [-1, 1]) {
      const oar = makeCylinder(0.024, 0.034, 2.6, 5, 0, 0, 0);
      oar.rotateZ(side * 1.18);
      oar.rotateY(side * 0.34);
      oar.translate(side * 1.18, 0.24, -0.35);
      const blade = makeBox(0.45, 0.03, 0.14, 0, 0, 0);
      blade.rotateZ(side * 1.18);
      blade.rotateY(side * 0.34);
      blade.translate(side * 2.15, -0.22, 0.02);
      bWood.push(oar, blade);
    }
    for (const ribZ of [-0.95, 0.0, 0.95]) {
      bWood.push(makeBox(1.08, 0.05, 0.06, 0, 0.09, ribZ));
    }
    bRobe.push(
      paintPart(makeCylinder(0.18, 0.14, 0.16, 6, 0, 0.24, 1.85), '#b8863e'),
      paintPart(new THREE.SphereGeometry(0.12, 5, 4).translate(0, 0.34, 1.85), '#e84c3d')
    );

    // 1 Boat rower + 4 colorful pilgrims seated inside wearing nón lá (ref 107!)
    const seats: Array<[number, number, number]> = [
      [0, -1.42, 0.27],
      [-0.24, -0.45, 0.26],
      [0.24, -0.45, 0.26],
      [-0.22, 0.55, 0.26],
      [0.22, 1.32, 0.26]
    ];
    for (let pIdx = 0; pIdx < seats.length; pIdx++) {
      const [px, pz, pyOff] = seats[pIdx];
      const hex = outfitColors[(idx * 3 + pIdx) % outfitColors.length];
      bRobe.push(paintPart(makeCylinder(0.13, 0.17, 0.54, 6, px, pyOff + 0.27, pz), hex));
      bRobe.push(paintPart(new THREE.SphereGeometry(0.105, 6, 4).translate(px, pyOff + 0.64, pz), '#d8b094'));
      bHat.push(new THREE.ConeGeometry(0.29, 0.19, 8).translate(px, pyOff + 0.78, pz));
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
  // Detailed Đại Hồng Chung bell inside upper pavilion + suspended wooden bell-striking beam (*chày kình gỗ treo dây đồng*)
  gBronze.push(...createBronzeBellParts(0, bellY + 0.85, 0, 1.15));
  gWood.push(makeCylinder(0.09, 0.09, 1.45, 6, 0.95, bellY + 1.35, 0, 0, 0, Math.PI * 0.5));
  for (const chainX of [0.55, 1.35]) {
    gBronze.push(makeCylinder(0.016, 0.016, 1.35, 4, chainX, bellY + 2.05, 0));
  }

  const topRoof = createHueImperialHipRoofGeometry(6.8, 5.8, 2.2, 0.34, 2.45, 0.38, 8, 5, false);
  topRoof.translate(0, bellY + bellH, 0);
  gRoof.push(topRoof);
  gStone.push(makeBox(2.35, 0.20, 0.24, 0, bellY + bellH + 2.50, 0));
  const tqFinials = createRoofFinialSetParts(0, bellY + bellH + 2.55, 0, 2.15, 0, 0.58, false);
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
  const tbY = Math.max(
    ctx.getHeight(tbX, tbZ),
    ctx.getHeight(tbX - 9.0, tbZ - 6.0),
    ctx.getHeight(tbX + 9.0, tbZ - 6.0),
    ctx.getHeight(tbX - 9.0, tbZ + 6.0),
    ctx.getHeight(tbX + 9.0, tbZ + 6.0)
  );
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
  // FIX CH-02: Wide 18.2m (9-step) open ceremonial entrance stairs spanning nearly the full facade (ref 09, 78!)
  for (let s = 0; s < 9; s++) {
    tbStone.push(makeBox(18.2, 1.8, 0.52, 0, -0.35 + s * 0.18, 8.25 - s * 0.36));
  }
  // Keep side balustrades only; leave entire front facade wide open
  tbStone.push(
    ...createPiercedBalustradeParts(-10.4, -7.0, -10.4, 7.0, tbFloorY, 0.88, 'lotus_stone'),
    ...createPiercedBalustradeParts(10.4, -7.0, 10.4, 7.0, tbFloorY, 0.88, 'lotus_stone')
  );

  // FIX CH-01: Pair of golden reclining lions facing INWARD toward center axis (±90°) on red-white pedestals flanking the wide stairs!
  for (const side of [-1, 1]) {
    const lx = side * 7.85;
    const lz = 9.15;
    tbCrimson.push(makeBox(1.55, 0.86, 1.85, lx, 0.56, lz));
    tbWhite.push(
      makeBox(1.68, 0.14, 1.98, lx, 0.18, lz),
      makeBox(1.68, 0.14, 1.98, lx, 1.00, lz)
    );
    tbStone.push(makeBox(1.48, 0.12, 1.76, lx, 1.12, lz));
    tbGold.push(...createGuardianBeastParts(lx, 1.18, lz, -side * Math.PI * 0.5, 1.24, 'kylan'));
  }

  // FIX CH-01: Authentic 3-Tier Dark Cast-Bronze Pagoda Incense Tower (*Tháp hương đồng đen 3 tầng*) atop Terracotta Lotus Basin (ref 09!)
  const towerZ = 11.4;
  tbBatTrang.push(
    makeCylinder(1.18, 1.32, 0.42, 16, 0, 0.28, towerZ),
    makeCylinder(1.04, 1.18, 0.36, 16, 0, 0.66, towerZ)
  );
  // Pair of small white stone guardian elephants flanking the lotus basin foot
  for (const es of [-1, 1]) {
    tbWhite.push(makeBox(0.42, 0.55, 0.68, es * 1.48, 0.36, towerZ + 0.15));
    tbWhite.push(makeCylinder(0.16, 0.18, 0.38, 8, es * 1.48, 0.68, towerZ + 0.45, 0.35));
  }
  // 3-Tier dark bronze incense tower shaft + 3 stacked curved bronze pagoda eaves + gourd finial (NO glowing orb!)
  tbBronze.push(makeCylinder(0.46, 0.58, 2.85, 8, 0, 2.25, towerZ));
  for (let tier = 0; tier < 3; tier++) {
    const eaveW = 1.65 - tier * 0.26;
    const eaveY = 1.85 + tier * 0.78;
    const tCap = createVietnameseCurvedRoofGeometry(eaveW, eaveW, eaveW * 0.48, eaveW * 0.48, 0.46, 0.18);
    tCap.translate(0, eaveY, towerZ);
    tbBronze.push(tCap);
  }
  tbBronze.push(...createLotusFinialParts(0, 3.88, towerZ, 0.85));
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
    // Swinging open *cửa bức bàn* sanctuary doors with carved frame rails, vertical lattice mullions & embossed golden Thọ medallion
    tbWood.push(makeBox(1.45, tbH * 0.78, 0.14, side * 2.55, tbFloorY + tbH * 0.39, 5.25, side * -0.58));
    for (const railY of [tbFloorY + 0.65, tbFloorY + 1.75, tbFloorY + 2.85]) {
      tbWood.push(makeBox(1.48, 0.10, 0.20, side * 2.55, railY, 5.25, side * -0.58));
    }
    for (let m = -2; m <= 2; m++) {
      tbWood.push(makeBox(0.05, 1.02, 0.18, side * 2.55 + m * 0.24, tbFloorY + 2.30, 5.25, side * -0.58));
    }
    tbGold.push(makeCylinder(0.18, 0.18, 0.06, 8, side * 2.55, tbFloorY + 2.05, 5.33, Math.PI * 0.5, 0, side * -0.58));
    // Eave lanterns
    tbLantern.push(createRibbedLanternShellGeometry(0.24, 0.36, 10, 6).translate(side * 4.2, tbFloorY + tbH - 0.52, 5.45));
    tbCore.push(createLanternCoreGeometry(0.14, 0.22).translate(side * 4.2, tbFloorY + tbH - 0.52, 5.45));
  }
  // Interior Three-Jewels golden Buddhist altar + 3 Seated Golden Tam Thế Phật Statues on Lotus Thrones + Hanging Pierced Cửa Võng (`HV-D12`) & Ancient Stone Lanterns (`HV-NEW-MB-12`)
  tbGold.push(...createCuaVongParts(0, tbFloorY + tbH - 0.68, 2.2, 3.6, 0.88, 0, 'long_phung'));
  tbStone.push(
    ...createAncientStoneLanternParts(-6.2, 0.15, 9.8, 0.92),
    ...createAncientStoneLanternParts(6.2, 0.15, 9.8, 0.92)
  );
  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-B03', 'HV-C01', 'HV-C02', 'HV-C03', 'HV-C06',
    'HV-D01', 'HV-D02', 'HV-D12', 'HV-D13', 'HV-D15', 'HV-E07', 'HV-I01',
    'HV-I02', 'HV-J04', 'HV-NEW-MB-08', 'HV-NEW-MB-11', 'HV-NEW-MB-12'
  ]);
  // + Sculpted Nine-Dragon Tòa Cửu Long Shrine, Fore-Altar Hương Án, Bronze Gia Trì Bell & Kneeling Mats (ref 121_chua_viet_nam_chinh_dien_tam_bao.jpg!)
  tbCrimson.push(makeBox(6.8, 1.25, 1.65, 0, tbFloorY + 0.625, -2.8));
  tbGold.push(makeBox(7.0, 0.18, 1.82, 0, tbFloorY + 1.28, -2.8));
  for (const bx of [-2.1, 0, 2.1]) {
    tbGold.push(
      makeCylinder(0.46, 0.54, 0.24, 8, bx, tbFloorY + 1.48, -2.8),
      new THREE.ConeGeometry(0.38, 0.92, 7).translate(bx, tbFloorY + 2.05, -2.8),
      new THREE.SphereGeometry(0.18, 7, 5).translate(bx, tbFloorY + 2.62, -2.8)
    );
  }
  // Fore-altar *Hương Án* table + sculpted circular Nine-Dragon *Tòa Cửu Long* canopy + kneeling meditation cushions (*bồ đoàn*)
  tbCrimson.push(makeBox(3.4, 0.96, 1.15, 0, tbFloorY + 0.48, -0.85));
  tbGold.push(
    makeBox(3.55, 0.12, 1.26, 0, tbFloorY + 0.98, -0.85),
    new THREE.TorusGeometry(0.54, 0.085, 6, 14, Math.PI * 1.4).translate(0, tbFloorY + 1.56, -0.85),
    makeCylinder(0.08, 0.10, 0.46, 6, 0, tbFloorY + 1.32, -0.85)
  );
  for (const mx of [-1.6, 0.0, 1.6]) {
    tbCrimson.push(makeCylinder(0.42, 0.44, 0.12, 10, mx, tbFloorY + 0.06, 1.25));
  }
  // Pierced golden Cửa Võng valance draped across central front columns + vertical gilded Câu Đối couplet boards + 2 Stone Cây Hương Pillars & Eave Brackets
  tbGold.push(makeBox(3.4, 0.58, 0.12, 0, tbFloorY + tbH - 0.55, 5.22));
  for (const cdX of [-1.8, 1.8]) {
    tbCrimson.push(makeBox(0.34, 2.75, 0.08, cdX, tbFloorY + 2.25, 5.48));
    tbGold.push(makeBox(0.22, 2.45, 0.10, cdX, tbFloorY + 2.25, 5.50));
  }
  for (const chSide of [-4.8, 4.8]) {
    tbStone.push(
      makeBox(0.65, 0.28, 0.65, chSide, 0.22, 11.4),
      makeCylinder(0.14, 0.18, 1.85, 6, chSide, 1.28, 11.4),
      makeBox(0.58, 0.42, 0.58, chSide, 2.38, 11.4)
    );
  }
  for (const colX of [-8.8, -5.2, -1.8, 1.8, 5.2, 8.8]) {
    tbWood.push(makeBox(0.16, 0.38, 0.95, colX, tbFloorY + tbH - 0.28, 5.65, 0.35));
  }
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

  const tbRoof2 = createHueImperialHipRoofGeometry(16.6, 9.8, 8.2, 0.38, 2.85, 0.40, 10, 6, false);
  tbRoof2.translate(0, tbUpY + tbUpH + 0.02, 0);
  tbRoof.push(tbRoof2);

  // FIX CH-02: Plain mossy grey plaster roof ridge with twin curved *kìm nóc* scrolls ONLY (NO golden dragons atop Thiên Trù — ref 09, 78!)
  const tbRidgeY = tbUpY + tbUpH + 2.90;
  tbStone.push(makeBox(8.2, 0.28, 0.28, 0, tbRidgeY, 0));
  for (const ks of [-1, 1]) {
    const kim = new THREE.TorusGeometry(0.32, 0.10, 6, 12, Math.PI * 1.4);
    kim.rotateZ(ks > 0 ? 0.3 : Math.PI - 0.3);
    kim.translate(ks * 4.02, tbRidgeY + 0.26, 0);
    tbStone.push(kim);
  }

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

  // FIX CH-02: Traditional right-to-left Han calligraphy "刹 寶 天 香" on aged gold plaque (ref 09!)
  const tbPlaquePos = new THREE.Vector3(0, tbUpY + tbUpH * 0.52, 3.16)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), tbRotY)
    .add(new THREE.Vector3(tbX, tbY, tbZ));
  const tbPlaque = createSignagePlaqueMesh(
    { text: '刹 寶 天 香', subText: 'HƯƠNG THIÊN BẢO SÁT', style: 'stone', bgColor: '#d4a62a', textColor: '#1a1510', borderColor: '#6e4e18', width: 3.9, height: 1.15, depth: 0.16 },
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
    // Stepped terracotta lotus-petal base moulding + 4 cardinal recessed Buddha niches on tiers 0..2
    brickParts.push(makeBox(tw * 1.10, 0.14, tw * 1.10, vcX, vcCurY + 0.08, vcZ));
    if (tier < 3) {
      const halfSpan = tw * 0.5;
      for (const [nx, nz] of [
        [0, halfSpan + 0.02],
        [0, -halfSpan - 0.02],
        [halfSpan + 0.02, 0],
        [-halfSpan - 0.02, 0]
      ]) {
        const isZ = Math.abs(nz) > Math.abs(nx);
        voidParts.push(
          makeBox(isZ ? tw * 0.32 : 0.10, th * 0.42, isZ ? 0.10 : tw * 0.32, vcX + nx, vcCurY + th * 0.36, vcZ + nz)
        );
        goldParts.push(
          new THREE.ConeGeometry(0.14, 0.28, 6).translate(vcX + nx, vcCurY + th * 0.32, vcZ + nz),
          new THREE.SphereGeometry(0.08, 6, 4).translate(vcX + nx, vcCurY + th * 0.48, vcZ + nz)
        );
      }
    }
    const eave = createVietnameseCurvedRoofGeometry(tw * 1.36, tw * 1.36, tw * 0.92, tw * 0.92, th * 0.42, 0.18);
    eave.translate(vcX, vcCurY + th * 0.70, vcZ);
    brickParts.push(eave);
    // 4 Miniature bronze wind-bells (*phong linh đồng*) hanging from the upturned corners of each stupa eave tier
    const cornerOff = tw * 0.64;
    for (const cxB of [-cornerOff, cornerOff]) {
      for (const czB of [-cornerOff, cornerOff]) {
        bronzeParts.push(new THREE.ConeGeometry(0.055, 0.14, 5).translate(vcX + cxB, vcCurY + th * 0.66, vcZ + czB));
      }
    }
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

  // FIX CH-03: Towering 6.8m Mossy *Đụn Gạo* (Sacred Rice Mound) conical stalagmite with dense hanging stalactite skirts & lush green vine foliage (ref 52!)
  const dunGaoZ = -6.6;
  cMossy.push(createSculptedRockGeometry(571, 2.75, 3.85, 2.65, 3).translate(0, 3.55, dunGaoZ));
  cMossy.push(createSculptedRockGeometry(574, 1.55, 2.35, 1.48, 2).translate(0, 5.85, dunGaoZ));
  // 16 Hanging limestone stalactite curtains around the lower skirt of Đụn Gạo + lush cascading green vine strands
  for (let v = 0; v < 16; v++) {
    const va = (v / 16) * Math.PI * 2;
    const vineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(va) * 0.65, 6.45, dunGaoZ + Math.sin(va) * 0.65),
      new THREE.Vector3(Math.cos(va) * 1.75, 4.4, dunGaoZ + Math.sin(va) * 1.75),
      new THREE.Vector3(Math.cos(va) * 2.45, 2.3, dunGaoZ + Math.sin(va) * 2.45),
      new THREE.Vector3(Math.cos(va) * 2.60, 0.55, dunGaoZ + Math.sin(va) * 2.60)
    ]);
    cMossy.push(new THREE.TubeGeometry(vineCurve, 8, 0.11, 5, false));
    // Hanging stalactite tip along base rim
    cStone.push(new THREE.ConeGeometry(0.20, 0.95, 5).rotateX(Math.PI).translate(Math.cos(va) * 2.55, 1.45, dunGaoZ + Math.sin(va) * 2.55));
  }
  cMossy.push(createSculptedRockGeometry(572, 1.4, 3.2, 1.3, 2).translate(-5.4, 1.9, -9.2));
  cStone.push(createSculptedRockGeometry(573, 1.3, 2.9, 1.3, 2).translate(5.4, 1.8, -9.6));

  // Pilgrim stone stairs descending into the cavern sanctuary flanked by smooth carved dragon balustrades
  for (let s = 0; s < 10; s++) {
    cStone.push(makeBox(8.8, 1.4, 1.15, 0, -0.25 + (s < 5 ? s * 0.14 : (9 - s) * 0.12), 5.6 - s * 0.95));
  }
  cStone.push(
    ...createCarvedDragonBalustradeParts(-4.2, 0.25, 5.4, -4.2, 0.72, 1.2, 0.82),
    ...createCarvedDragonBalustradeParts(4.2, 0.25, 5.4, 4.2, 0.72, 1.2, 0.82)
  );
  // Hanging mossy karst curtain vines framing the gaping dragon-mouth cave entrance
  for (let cv = 0; cv < 10; cv++) {
    const vx = -5.8 + cv * 1.28;
    const dropLen = 2.6 + (cv % 3) * 1.25;
    const vCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(vx, 12.6 - Math.abs(vx) * 0.18, 2.1),
      new THREE.Vector3(vx + (cv % 2 === 0 ? 0.22 : -0.22), 12.6 - dropLen * 0.5, 2.35),
      new THREE.Vector3(vx, 12.6 - dropLen, 2.18)
    ]);
    cMossy.push(createSmoothTaperedTubeGeometry(vCurve, 7, 4, (t) => 0.11 * (1.0 - t * 0.65)));
  }
  // Iconic named Động Hương Tích calcite formations: Cây Vàng (Golden Pillar), Cây Bạc (Silver-White Pillar) & Bầu Sữa Mẹ + Stone Oil-Lamp Stands & Gold Offerings
  cGold.push(
    createSculptedRockGeometry(581, 0.88, 3.1, 0.85, 2).translate(-4.2, 2.3, -11.8),
    new THREE.CylinderGeometry(0.45, 0.55, 0.16, 8).translate(-4.2, 0.42, -11.2),
    new THREE.CylinderGeometry(0.45, 0.55, 0.16, 8).translate(4.3, 0.42, -11.4)
  );
  for (const lampX of [-4.6, 4.6]) {
    cStone.push(
      makeCylinder(0.16, 0.24, 1.35, 6, lampX, 0.95, 1.4),
      makeCylinder(0.32, 0.18, 0.22, 6, lampX, 1.72, 1.4)
    );
    cLanternCore.push(new THREE.SphereGeometry(0.11, 5, 4).translate(lampX, 1.92, 1.4));
  }
  cStone.push(
    createSculptedRockGeometry(582, 0.82, 2.9, 0.82, 2).translate(4.3, 2.2, -12.0),
    createSculptedRockGeometry(583, 1.25, 1.65, 1.20, 2).translate(-1.4, 10.6, -8.8),
    // Overhanging Lưỡi Rồng (Dragon-Tongue Central Stalactite) & Twin Flanking Dragon-Fang Stalactites at cave mouth
    createSculptedRockGeometry(584, 1.15, 2.85, 1.05, 2).translate(0.0, 12.1, 0.6),
    new THREE.ConeGeometry(0.45, 2.15, 6).rotateX(Math.PI).translate(-2.4, 12.3, 1.1),
    new THREE.ConeGeometry(0.45, 2.15, 6).rotateX(Math.PI).translate(2.4, 12.3, 1.1)
  );
  // Crimson sanctuary pillars with golden bands & vertical *câu đối / cửa võng* filigree panels framing the inner Quan Âm shrine
  for (const ps of [-3.6, 3.6]) {
    cCrimson.push(
      makeCylinder(0.18, 0.20, 5.4, 8, ps, 2.8, -11.6),
      makeBox(0.38, 3.2, 0.10, ps, 3.1, -11.32)
    );
    cGold.push(
      makeCylinder(0.22, 0.22, 0.16, 8, ps, 4.6, -11.6),
      makeCylinder(0.22, 0.22, 0.16, 8, ps, 1.4, -11.6),
      makeBox(0.22, 2.85, 0.12, ps, 3.1, -11.29)
    );
  }

  // Sculpted Green-Stone Quan Âm Bodhisattva (simpleQuanAm + skipHalo — authentic serene stone silhouette!)
  const quanAm = createSculptedDeityParts(0, 0.85, -13.2, 0, 1.65, 'quanam', {
    skipHalo: true,
    simpleQuanAm: true
  });
  cMossy.push(...quanAm.bodyParts);
  cGold.push(...quanAm.accentParts);

  // Dragon-carved wood altar with pierced golden dragon-lotus scrollwork, cabriole legs, 5-cup stand & offerings!
  const dgAltarZ = -3.65;
  cWood.push(makeBox(4.1, 1.15, 1.28, 0, 0.85, dgAltarZ));
  for (const lx of [-1.85, 1.85]) {
    for (const lz of [-0.52, 0.52]) {
      cGold.push(makeCylinder(0.11, 0.14, 1.05, 6, lx, 0.65, dgAltarZ + lz));
    }
  }
  cGold.push(
    makeBox(4.32, 0.14, 1.42, 0, 1.45, dgAltarZ),
    new THREE.TorusGeometry(0.28, 0.045, 5, 12).translate(0, 1.02, dgAltarZ + 0.66),
    new THREE.SphereGeometry(0.12, 6, 4).translate(0, 1.02, dgAltarZ + 0.67),
    new THREE.TorusGeometry(0.22, 0.04, 5, 10, Math.PI * 1.4).translate(-0.78, 1.02, dgAltarZ + 0.66),
    new THREE.TorusGeometry(0.22, 0.04, 5, 10, Math.PI * 1.4).translate(0.78, 1.02, dgAltarZ + 0.66)
  );
  // 5-cup golden ceremonial water stand (*ngai 5 chén nước thờ*) centered on altar top
  cGold.push(makeBox(1.12, 0.08, 0.24, 0, 1.56, dgAltarZ + 0.36));
  for (let cup = -2; cup <= 2; cup++) {
    cGold.push(makeCylinder(0.065, 0.045, 0.11, 6, cup * 0.22, 1.65, dgAltarZ + 0.36));
  }
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

  // FIX CH-04: Flush understated limestone rock inscription "洞 一 第 天 南" incised naturally on the left cave wall
  // (removed bulky protruding 3.75×1.82m cliffRockPad box — ref 52_dong_huong_tich_chua_huong.jpg!)
  const cliffLocalPos = new THREE.Vector3(-4.95, 3.95, 1.85);
  const cliffRotLocal = 0.88;
  const browPlaquePos = cliffLocalPos
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  const browPlaque = createSignagePlaqueMesh(
    {
      text: '洞 一 第 天 南',
      subText: '佛 陀 彌 阿',
      style: 'stone',
      width: 1.85,
      height: 0.94,
      depth: 0.04
    },
    ctx
  );
  browPlaque.name = 'NamThienDeNhatDongPlaque';
  browPlaque.position.copy(browPlaquePos);
  browPlaque.rotation.y = caveRotY + cliffRotLocal;
  group.add(browPlaque);

  // FIX CH-03: Removed all 7 ahistorical red Hội An lanterns inside Động Hương Tích -> natural warm rear sanctuary rock wash light!
  const rearSanctLightPos = new THREE.Vector3(2.4, 3.8, -14.5)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), caveRotY)
    .add(new THREE.Vector3(caveX, caveY, caveZ));
  const rearSanctLight = new THREE.PointLight('#ffaa4a', 2.4, 24, 1.5);
  rearSanctLight.position.copy(rearSanctLightPos);
  group.add(rearSanctLight);

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

  // 7. Major Chùa Hương Scenic Landscape Overhaul:
  //    (a) Hương Sơn Limestone Karst Amphitheater (*99 Ngọn Núi Hương Sơn*) framing Suối Yến & Động Hương Tích
  //    (b) Blooming Crimson *Hoa Gạo* (Kapok) Trees overhanging Suối Yến & Cầu Hội
  //    (c) Ancient Mossy Village Banyan (*Cây Đa Bến Đục / Thiên Trù*)
  //    (d) Hương Sơn Scenic Cable Car (*Cáp Treo Chùa Hương*) linking Thiên Trù valley up to Động Hương Tích ridge
  //    (e) Suối Yến Emerald Riverbank Reed Clumps
  const scenicColoredParts: THREE.BufferGeometry[] = [];
  const cableSteelParts: THREE.BufferGeometry[] = [];
  const karstAmphitheater: Array<[number, number, number, number, number]> = [
    [164, -172, 12.5, 34, 2.2],
    [166, -214, 14.0, 42, -1.8],
    [202, -230, 15.5, 48, 1.4],
    [232, -222, 12.0, 42, -1.5],
    [258, -174, 11.5, 36, -1.2]
  ];
  for (let k = 0; k < karstAmphitheater.length; k++) {
    const [kx, kz, kr, kh, lean] = karstAmphitheater[k];
    const ky = ctx.getHeight(kx, kz) - 2.2;
    const peak = createSculptedRockGeometry(740 + k * 23, kr, kh * 0.58, kr * 0.92, 2);
    peak.translate(kx + lean * 0.4, ky + kh * 0.46, kz);
    mossyRockParts.push(peak);
    // Lush dark-emerald forested ridge domes crowning each Hương Sơn karst spire
    for (let f = 0; f < 2; f++) {
      const fa = f * Math.PI + k;
      const dome = createSculptedRockGeometry(780 + k * 7 + f, kr * 0.62, kh * 0.16, kr * 0.56, 1);
      dome.translate(
        kx + Math.cos(fa) * kr * 0.25 + lean * 0.55,
        ky + kh * (0.78 + f * 0.08),
        kz + Math.sin(fa) * kr * 0.25
      );
      scenicColoredParts.push(paintPart(dome, f === 1 ? '#3e7330' : '#244f22'));
    }
  }

  // Iconic Crimson-Blossoming *Hoa Gạo* (Kapok) Trees flanking Suối Yến & Cầu Hội Bridge
  const kapokCoords: Array<[number, number, number]> = [
    [175.5, -138.0, 1.12],
    [196.5, -133.5, 1.05],
    [176.2, -158.0, 1.0],
    [197.0, -166.5, 1.15],
    [177.5, -188.0, 1.08],
    [198.5, -196.0, 1.02]
  ];
  for (let i = 0; i < kapokCoords.length; i++) {
    const [kx, kz, ks] = kapokCoords[i];
    const ky = ctx.getHeight(kx, kz) - 0.2;
    const h = 8.4 * ks;
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(kx, ky, kz),
      new THREE.Vector3(kx + (i % 2 === 0 ? 0.45 : -0.45), ky + h * 0.45, kz + 0.25),
      new THREE.Vector3(kx + (i % 2 === 0 ? 0.95 : -0.95), ky + h, kz - 0.15)
    ]);
    barkParts.push(createSmoothTaperedTubeGeometry(tCurve, 10, 7, (t) => (0.42 * (1.0 - t * 0.62)) * ks));
    // Characteristic tiered horizontal kapok limbs loaded with blazing red *hoa gạo* flower clusters
    for (let tier = 0; tier < 2; tier++) {
      const origin = tCurve.getPoint(0.62 + tier * 0.30);
      const count = 4;
      for (let b = 0; b < count; b++) {
        const ba = (b / count) * Math.PI * 2 + tier * 0.78 + i * 0.5;
        const bLen = (3.4 - tier * 0.75) * ks;
        const bCurve = new THREE.CatmullRomCurve3([
          origin.clone(),
          new THREE.Vector3(origin.x + Math.cos(ba) * bLen * 0.55, origin.y + 0.35 * ks, origin.z + Math.sin(ba) * bLen * 0.55),
          new THREE.Vector3(origin.x + Math.cos(ba) * bLen, origin.y + 0.75 * ks, origin.z + Math.sin(ba) * bLen)
        ]);
        barkParts.push(createSmoothTaperedTubeGeometry(bCurve, 6, 5, (t) => (0.14 * (1.0 - t * 0.7)) * ks));
        const tip = bCurve.getPoint(0.88);
        const bloom = createSculptedRockGeometry(850 + i * 17 + tier * 5 + b, 1.35 * ks, 0.75 * ks, 1.35 * ks, 1);
        bloom.translate(tip.x, tip.y + 0.28 * ks, tip.z);
        scenicColoredParts.push(paintPart(bloom, (b + tier) % 2 === 0 ? '#d82820' : '#f04632'));
      }
    }
  }

  // Monumental Ancient Banyan shading the Thiên Trù pilgrim approach at (207.8, -168.5 — >= 6.5m clear of Đền Trình!)
  const chuaBanyan = createRealisticAncientBanyanParts(207.8, ctx.getHeight(207.8, -168.5), -168.5, 0.88, 6102, {
    boughCount: 6,
    propRootCount: 6,
    danglingRootCount: 16,
    canopyDensity: 1.0,
    getHeight: ctx.getHeight
  });
  barkParts.push(...chuaBanyan.barkParts);
  scenicColoredParts.push(...chuaBanyan.canopyParts);

  // Riverbank Emerald Reeds & Grass Tufts lining Suối Yến edges
  const randReed = mulberry32(195999);
  for (let r = 0; r < 42; r++) {
    const rz = -212 + (r / 41) * 76;
    const riverCx = 186.0 + 5.5 * Math.sin((rz + 180.0) * 0.045);
    const side = r % 2 === 0 ? -1 : 1;
    const rx = riverCx + side * (7.2 + randReed() * 1.8);
    const ry = Math.max(0.05, ctx.getHeight(rx, rz));
    const tuft = createSculptedRockGeometry(900 + r, 0.85, 1.15, 0.85, 0);
    tuft.translate(rx, ry + 0.45, rz);
    scenicColoredParts.push(paintPart(tuft, r % 3 === 0 ? '#3c7a30' : '#2a5f26'));
  }

  // Hương Sơn Scenic Cable Car (*Cáp Treo Chùa Hương*) — 2 steel pylons + taut twin cables + 3 gliding cabins
  const ccPylons: Array<[number, number, number]> = [
    [206.0, -160.0, 14.5],
    [238.0, -212.0, 15.5]
  ];
  const cableTopPts: THREE.Vector3[] = [];
  for (const [px, pz, ph] of ccPylons) {
    const py = ctx.getHeight(px, pz) - 0.5;
    for (const sx of [-1.1, 1.1]) {
      cableSteelParts.push(makeCylinder(0.16, 0.28, ph, 6, px + sx * 0.55, py + ph * 0.5, pz));
    }
    cableSteelParts.push(makeBox(4.8, 0.36, 0.42, px, py + ph - 0.25, pz, -0.58));
    // Twin rotary sheave-wheel pulley banks at pylon crossbeam ends
    for (const pwOff of [-1.9, 1.9]) {
      const wheel = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 8);
      wheel.rotateZ(Math.PI * 0.5);
      wheel.rotateY(-0.58);
      wheel.translate(px + pwOff * Math.cos(-0.58), py + ph - 0.15, pz - pwOff * Math.sin(-0.58));
      cableSteelParts.push(wheel);
    }
    cableTopPts.push(new THREE.Vector3(px, py + ph - 0.1, pz));
  }
  const ccDir = new THREE.Vector3().subVectors(cableTopPts[1], cableTopPts[0]).normalize();
  const ccSide = new THREE.Vector3(-ccDir.z, 0, ccDir.x).normalize();
  for (const sOff of [-1.9, 1.9]) {
    const pA = cableTopPts[0].clone().addScaledVector(ccSide, sOff);
    const pB = cableTopPts[1].clone().addScaledVector(ccSide, sOff);
    const pMid = pA.clone().lerp(pB, 0.5).add(new THREE.Vector3(0, -1.8, 0));
    const cCurve = new THREE.CatmullRomCurve3([pA, pMid, pB]);
    cableSteelParts.push(createSmoothTaperedTubeGeometry(cCurve, 18, 4, () => 0.055));
    // Suspended panoramic cable-car cabins with cable grip clamp & curved hanger arm
    const cabTs = sOff < 0 ? [0.28, 0.72] : [0.50];
    for (const ct of cabTs) {
      const cp = cCurve.getPoint(ct);
      cableSteelParts.push(
        makeBox(0.36, 0.22, 0.26, cp.x, cp.y, cp.z, -0.58),
        makeCylinder(0.05, 0.05, 1.65, 5, cp.x, cp.y - 0.82, cp.z),
        makeBox(0.85, 0.10, 0.14, cp.x, cp.y - 1.56, cp.z, -0.58)
      );
      scenicColoredParts.push(
        paintPart(makeBox(1.85, 1.55, 1.45, cp.x, cp.y - 2.35, cp.z, -0.58), sOff < 0 ? '#c82824' : '#1c6ea4'),
        paintPart(makeBox(1.92, 0.52, 1.52, cp.x, cp.y - 2.15, cp.z, -0.58), '#9cd4e8')
      );
    }
  }
  addMergedMesh(group, scenicColoredParts, pilgrimRobeMat, 'ChuaHuongKapokBanyanAndKarstFoliage', true, true);
  addMergedMesh(group, cableSteelParts, ctx.materials.bronzePatina ?? ctx.materials.darkVoid, 'ChuaHuongCableCarSystem', true, true);

  // 8. CHÙA HƯƠNG & SUỐI YẾN QC EXPANSIONS (Items 170..182 — grounded with retaining skirts on sloped karst!)
  // 170-173. Bến Đục expanded boat-pier pavilion (184, -155.5), mooring bollards & Đền Trình riverside shrine
  const bdY = Math.max(0.45, ctx.getHeight(184, -155.5));
  stoneParts.push(makeBox(5.6, 2.4, 3.8, 184, bdY - 0.88, -155.5));
  for (const dx of [-2.2, 2.2]) {
    for (const dz of [-1.4, 1.4]) {
      woodParts.push(makeCylinder(0.10, 0.12, 2.65, 6, 184 + dx, bdY + 1.6, -155.5 + dz));
    }
    woodParts.push(makeCylinder(0.11, 0.11, 0.72, 6, 184 + dx * 1.4, bdY + 0.36, -151.8));
  }
  roofParts.push(createVietnameseCurvedRoofGeometry(6.4, 4.6, 2.2, 1.0, 1.25, 0.28).translate(184, bdY + 2.9, -155.5));
  // Đền Trình Ngũ Nhạc riverside shrine along Suối Yến bend (198, -166)
  const dtShrineY = Math.max(
    ctx.getHeight(198, -166),
    ctx.getHeight(196, -168),
    ctx.getHeight(200, -168),
    ctx.getHeight(196, -164),
    ctx.getHeight(200, -164)
  );
  stoneParts.push(makeBox(4.4, 3.2, 4.0, 198, dtShrineY - 1.24, -166));
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.4, 1.4]) {
      crimsonParts.push(makeCylinder(0.11, 0.12, 2.75, 6, 198 + dx, dtShrineY + 1.7, -166 + dz));
    }
  }
  roofParts.push(createVietnameseCurvedRoofGeometry(5.2, 4.8, 1.4, 1.0, 1.25, 0.28).translate(198, dtShrineY + 3.05, -166));

  // 174-182. Thiên Trù Nhà Tổ West wing, Pilgrim Tea Stall (4 columns!), Động Hương Tích stalagmites, Bia Công Đức & pilgrim benches
  const ttY = Math.max(
    ctx.getHeight(203.5, -186),
    ctx.getHeight(201, -190),
    ctx.getHeight(206, -190),
    ctx.getHeight(201, -182),
    ctx.getHeight(206, -182)
  );
  stoneParts.push(makeBox(5.2, 3.6, 8.2, 203.5, ttY - 1.44, -186));
  for (const dx of [-2.0, 2.0]) {
    for (const dz of [-3.4, 0, 3.4]) {
      crimsonParts.push(makeCylinder(0.11, 0.12, 2.85, 6, 203.5 + dx, ttY + 1.75, -186 + dz));
    }
  }
  roofParts.push(createVietnameseCurvedRoofGeometry(6.0, 9.2, 1.8, 4.2, 1.35, 0.28).translate(203.5, ttY + 3.15, -186));
  // Pilgrim rest tea stall along ascent trail (218, -193 — 4 grounded posts + retaining stone pad!)
  const teaStallY = Math.max(
    ctx.getHeight(218, -193),
    ctx.getHeight(216.5, -194),
    ctx.getHeight(219.5, -194),
    ctx.getHeight(216.5, -192),
    ctx.getHeight(219.5, -192)
  );
  stoneParts.push(makeBox(3.8, 2.6, 3.0, 218, teaStallY - 1.25, -193));
  woodParts.push(
    makeBox(3.6, 0.18, 2.8, 218, teaStallY + 0.10, -193),
    makeCylinder(0.09, 0.10, 2.35, 6, 216.5, teaStallY + 1.25, -192),
    makeCylinder(0.09, 0.10, 2.35, 6, 219.5, teaStallY + 1.25, -192),
    makeCylinder(0.09, 0.10, 2.35, 6, 216.5, teaStallY + 1.25, -194),
    makeCylinder(0.09, 0.10, 2.35, 6, 219.5, teaStallY + 1.25, -194)
  );
  roofParts.push(createGableRoofGeometry(4.2, 3.4, 1.05).translate(218, teaStallY + 2.4, -193));
  // Động Hương Tích stalagmites & Bia Công Đức stele kiosk
  const htY = ctx.getHeight(226, -202);
  mossyRockParts.push(
    makeCylinder(0.18, 0.42, 2.4, 7, 224.2, htY + 1.2, -201.0),
    makeCylinder(0.14, 0.36, 1.9, 7, 227.8, htY + 0.95, -201.5)
  );
  stoneParts.push(
    makeBox(0.95, 1.45, 0.24, 210.5, ttY + 0.72, -181.5),
    makeBox(1.85, 0.42, 0.55, 217.5, ttY + 0.21, -181.5)
  );

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

  // 8B. CHÙA HƯƠNG & SUỐI YẾN WAVE 2 REAL-WORLD DETAILS (Items 371..380, castShadow = false, 0 new materials)
  const chW2Stone: THREE.BufferGeometry[] = [];
  const chW2Wood: THREE.BufferGeometry[] = [];
  const chW2Crimson: THREE.BufferGeometry[] = [];
  const chW2Roof: THREE.BufferGeometry[] = [];
  const chW2Bronze: THREE.BufferGeometry[] = [];
  const chW2Gold: THREE.BufferGeometry[] = [];
  // 371. 2 bamboo-and-thatch pilgrim specialty stalls along Thiên Trù trail (with deep stone retaining skirts!)
  for (const [sx, sz] of [[211.0, -177.0], [214.5, -174.0]] as const) {
    const sy = Math.max(ctx.getHeight(sx, sz), ctx.getHeight(sx - 1.1, sz - 0.8), ctx.getHeight(sx + 1.1, sz + 0.8));
    chW2Stone.push(makeBox(2.6, 2.4, 2.0, sx, sy - 1.15, sz));
    chW2Wood.push(
      makeBox(0.09, 2.25, 0.09, sx - 1.1, sy + 1.05, sz - 0.8),
      makeBox(0.09, 2.25, 0.09, sx + 1.1, sy + 1.05, sz - 0.8),
      makeBox(0.09, 2.25, 0.09, sx - 1.1, sy + 1.05, sz + 0.8),
      makeBox(0.09, 2.25, 0.09, sx + 1.1, sy + 1.05, sz + 0.8),
      makeBox(1.9, 0.68, 0.65, sx, sy + 0.34, sz)
    );
    chW2Roof.push(makeBox(2.6, 0.22, 2.1, sx, sy + 2.2, sz));
  }
  // 372-373. Đền Trình inner altar, bronze censer, 2-pillar Tam Quan gate & river landing steps
  chW2Crimson.push(makeBox(1.85, 0.92, 0.85, 198, dtShrineY + 0.82, -166.8));
  chW2Bronze.push(makeCylinder(0.18, 0.14, 0.36, 6, 198, dtShrineY + 1.46, -166.8));
  chW2Stone.push(
    makeBox(0.45, 2.65, 0.45, 196.2, dtShrineY + 1.32, -162.8),
    makeBox(0.45, 2.65, 0.45, 199.8, dtShrineY + 1.32, -162.8),
    makeBox(4.2, 0.36, 0.55, 198.0, dtShrineY + 2.72, -162.8),
    makeBox(2.6, 0.24, 1.45, 198.0, dtShrineY - 0.15, -160.8)
  );
  // 374-376. Suối Yến bamboo mooring stakes & fish-traps, Thiên Trù gong & drum stands, incense vendor table
  for (let ms = 0; ms < 5; ms++) {
    const mz = -168.0 - ms * 3.8;
    chW2Wood.push(makeCylinder(0.06, 0.07, 1.45, 5, 192.2, 0.55, mz));
  }
  chW2Wood.push(
    makeBox(0.12, 1.95, 0.12, 200.2, ttY + 0.98, -184.5),
    makeBox(0.12, 1.95, 0.12, 200.2, ttY + 0.98, -187.5),
    makeBox(0.14, 0.14, 3.2, 200.2, ttY + 1.98, -186.0),
    makeBox(1.85, 0.72, 0.78, 210.0, ttY + 0.36, -188.2),
    makeBox(0.75, 0.58, 0.58, 203.5, ttY + 0.65, -191.2)
  );
  chW2Bronze.push(makeBox(0.08, 0.58, 0.95, 200.2, ttY + 1.38, -186.0));
  chW2Crimson.push(makeCylinder(0.42, 0.42, 0.78, 6, 203.5, ttY + 1.25, -191.2, 0, Math.PI * 0.5));
  // 377-380. 4 Thiên Trù lotus bowls, 17th-century Viên Công stele, 4 mossy ascent trail lanterns & halfway pilgrim rest shelter (with 4 corner posts & hillside skirt!)
  for (const [lx, lz] of [[224.0, -172.0], [228.0, -170.0], [224.0, -180.0], [228.0, -182.0]] as const) {
    chW2Stone.push(makeCylinder(0.36, 0.24, 0.38, 6, lx, ctx.getHeight(lx, lz) + 0.19, lz));
  }
  chW2Stone.push(makeBox(0.88, 1.38, 0.22, vcX + 2.8, vcY + 0.69, vcZ + 1.5));
  for (let tl = 0; tl < 4; tl++) {
    const tx = 216.0 + tl * 2.5;
    const tz = -188.0 - tl * 3.2;
    const ty = ctx.getHeight(tx, tz);
    chW2Stone.push(
      makeBox(0.36, 0.85, 0.36, tx, ty + 0.42, tz),
      makeBox(0.48, 0.16, 0.48, tx, ty + 0.95, tz)
    );
    chW2Gold.push(makeBox(0.18, 0.18, 0.18, tx, ty + 0.76, tz));
  }
  const restY = Math.max(ctx.getHeight(221.0, -195.5), ctx.getHeight(219.8, -196.2), ctx.getHeight(222.2, -194.8));
  chW2Stone.push(
    makeBox(2.8, 2.4, 1.8, 221.0, restY - 1.15, -195.5),
    makeBox(2.2, 0.42, 0.58, 221.0, restY + 0.21, -195.5)
  );
  for (const rx of [219.8, 222.2]) {
    for (const rz of [-196.1, -194.9]) {
      chW2Wood.push(makeBox(0.10, 2.35, 0.10, rx, restY + 1.05, rz));
    }
  }
  chW2Roof.push(makeBox(2.8, 0.22, 1.65, 221.0, restY + 2.28, -195.5));

  addMergedMesh(group, chW2Stone, ctx.materials.stone, 'ChuaHuongWave2Stone', false, true);
  addMergedMesh(group, chW2Wood, ctx.materials.darkWood, 'ChuaHuongWave2Wood', false, true);
  addMergedMesh(group, chW2Crimson, ctx.materials.crimsonLacquer, 'ChuaHuongWave2Crimson', false, true);
  addMergedMesh(group, chW2Roof, ctx.materials.terracottaRoof, 'ChuaHuongWave2Roof', false, true);
  addMergedMesh(group, chW2Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'ChuaHuongWave2Bronze', false, true);
  addMergedMesh(group, chW2Gold, ctx.materials.gold, 'ChuaHuongWave2Gold', false, false);

  // 8C. CHÙA HƯƠNG & SUỐI YẾN WAVE 3 REAL-WORLD DETAILS (Items 741..760, castShadow = false, 0 new materials)
  const chW3Stone: THREE.BufferGeometry[] = [];
  const chW3Wood: THREE.BufferGeometry[] = [];
  const chW3Crimson: THREE.BufferGeometry[] = [];
  const chW3Roof: THREE.BufferGeometry[] = [];
  const chW3Bronze: THREE.BufferGeometry[] = [];
  const chW3Gold: THREE.BufferGeometry[] = [];

  // 741-742. Arched stone-and-timber Suối Yến pilgrim bridge (189.2, -178.0 — spanning true riverCx = 186.5 without blocking sampan lanes!) & 4 lanterns
  chW3Stone.push(
    makeBox(2.2, 2.6, 2.8, 180.5, 0.15, -178.0),
    makeBox(2.2, 2.6, 2.8, 196.5, 0.15, -178.0),
    makeBox(16.6, 0.32, 2.4, 188.5, 1.52, -178.0)
  );
  for (const sz of [-1.1, 1.1]) {
    chW3Stone.push(makeBox(16.6, 0.65, 0.16, 188.5, 1.96, -178.0 + sz));
    for (const bx of [183.2, 193.8]) {
      chW3Wood.push(makeCylinder(0.05, 0.06, 1.65, 5, bx, 2.25, -178.0 + sz));
      chW3Crimson.push(makeCylinder(0.14, 0.14, 0.30, 6, bx, 2.95, -178.0 + sz));
    }
  }
  // 743-744, 748-749, 759. 3 Suối Yến pilgrim boats with canopies (moored at East bank x = 191.8, clear of animated sampans!), expanded Bến Thiên Trù jetty, welcome arch, riverside tea-hut & tributary bamboo bridge
  for (const bz of [-167.5, -173.2, -184.2]) {
    chW3Wood.push(
      makeBox(1.15, 0.34, 4.2, 191.8, 0.18, bz, 0.14),
      makeBox(0.95, 0.08, 1.45, 191.8, 1.02, bz, 0.14),
      makeBox(0.08, 0.78, 0.08, 191.4, 0.56, bz - 0.6),
      makeBox(0.08, 0.78, 0.08, 192.2, 0.56, bz - 0.6),
      makeBox(0.08, 0.78, 0.08, 191.4, 0.56, bz + 0.6),
      makeBox(0.08, 0.78, 0.08, 192.2, 0.56, bz + 0.6)
    );
  }
  chW3Wood.push(
    makeBox(3.4, 0.22, 4.6, 194.2, 0.45, -172.0),
    makeCylinder(0.10, 0.11, 3.0, 5, 193.0, 1.05, -173.8),
    makeCylinder(0.10, 0.11, 3.0, 5, 193.0, 1.05, -170.2),
    makeCylinder(0.10, 0.11, 3.0, 5, 195.4, 1.05, -173.8),
    makeCylinder(0.10, 0.11, 3.0, 5, 195.4, 1.05, -170.2),
    // 759. Bamboo tributary footbridge beside Đền Trình (with 4 bank posts!)
    makeBox(3.8, 0.16, 1.15, 196.0, 0.52, -160.5),
    makeCylinder(0.07, 0.08, 1.25, 5, 194.3, 0.15, -161.0),
    makeCylinder(0.07, 0.08, 1.25, 5, 194.3, 0.15, -160.0),
    makeCylinder(0.07, 0.08, 1.25, 5, 197.7, 0.15, -161.0),
    makeCylinder(0.07, 0.08, 1.25, 5, 197.7, 0.15, -160.0)
  );
  chW3Roof.push(makeBox(3.8, 0.24, 5.0, 194.2, 2.52, -172.0));
  const waY = Math.max(ctx.getHeight(198.5, -174.0), ctx.getHeight(198.5, -175.8), ctx.getHeight(198.5, -172.2));
  chW3Stone.push(
    makeBox(0.85, 2.2, 4.6, 198.5, waY - 1.05, -174.0),
    makeBox(0.55, 2.95, 0.55, 198.5, waY + 1.38, -175.8),
    makeBox(0.55, 2.95, 0.55, 198.5, waY + 1.38, -172.2),
    makeBox(0.68, 0.42, 4.4, 198.5, waY + 2.92, -174.0)
  );
  chW3Roof.push(makeBox(1.45, 0.34, 4.9, 198.5, waY + 3.28, -174.0));
  const thY = Math.max(ctx.getHeight(202.5, -175.5), ctx.getHeight(201.3, -176.5), ctx.getHeight(203.7, -174.5));
  chW3Stone.push(makeBox(3.0, 2.6, 2.6, 202.5, thY - 1.25, -175.5));
  for (const dx of [-1.2, 1.2]) {
    for (const dz of [-1.0, 1.0]) {
      chW3Wood.push(makeBox(0.10, 2.40, 0.10, 202.5 + dx, thY + 1.05, -175.5 + dz));
    }
  }
  chW3Wood.push(makeBox(1.45, 0.62, 0.68, 202.5, thY + 0.31, -175.5));
  chW3Roof.push(makeBox(2.9, 0.24, 2.5, 202.5, thY + 2.24, -175.5));

  // 745-747, 755. 2 Cliffside hermitage shrines (Miếu Sơn Thần & Am Thờ Mẫu — positioned clear of Động Hương Tích cave mouth!) + mid-climb rest hut (all with deep hillside skirts!)
  for (const [csX, csZ] of [[226.5, -191.5], [234.8, -199.5]] as const) {
    const csY = Math.max(ctx.getHeight(csX, csZ), ctx.getHeight(csX - 1.5, csZ - 1.5), ctx.getHeight(csX + 1.5, csZ + 1.5));
    chW3Stone.push(
      makeBox(3.4, 3.8, 3.0, csX, csY - 1.65, csZ),
      makeBox(2.6, 1.95, 2.2, csX, csY + 1.20, csZ)
    );
    chW3Roof.push(makeBox(3.4, 0.38, 3.0, csX, csY + 2.32, csZ));
    chW3Crimson.push(makeBox(1.25, 0.72, 0.55, csX, csY + 0.62, csZ + 0.95));
    chW3Bronze.push(makeCylinder(0.14, 0.11, 0.28, 6, csX, csY + 1.12, csZ + 0.95));
  }
  const r3Y = Math.max(ctx.getHeight(224.5, -198.5), ctx.getHeight(223.0, -197.0), ctx.getHeight(226.0, -200.0));
  chW3Stone.push(makeBox(3.4, 3.6, 2.8, 224.5, r3Y - 1.55, -198.5));
  for (const dx of [-1.3, 1.3]) {
    for (const dz of [-1.0, 1.0]) {
      chW3Wood.push(makeBox(0.10, 2.35, 0.10, 224.5 + dx, r3Y + 1.32, -198.5 + dz));
    }
  }
  chW3Roof.push(makeBox(3.9, 0.28, 3.3, 224.5, r3Y + 2.58, -198.5));

  // 750-754, 756-758, 760. Thiên Trù brackets/couplets, stair cheeks, votive burner, merit desk, 6 ascent flags, 8 mossy steps, Hương Tích cave censer/guardians & 1770 stele
  chW3Crimson.push(
    makeBox(0.32, 0.26, 4.2, 203.5, ttY + 3.15, -188.0),
    makeBox(0.45, 0.42, 0.36, 213.5, ttY + 0.96, -185.0)
  );
  chW3Wood.push(makeBox(1.35, 0.75, 0.65, 213.5, ttY + 0.38, -185.0));
  const vbY = ctx.getHeight(206.0, -182.0);
  chW3Stone.push(
    makeBox(1.15, 1.55, 1.15, 206.0, vbY + 0.78, -182.0),
    makeBox(0.42, 0.55, 1.85, 224.2, ctx.getHeight(224.2, -176.0) + 0.28, -176.0),
    makeBox(0.42, 0.55, 1.85, 227.8, ctx.getHeight(227.8, -176.0) + 0.28, -176.0)
  );
  chW3Roof.push(makeBox(1.42, 0.28, 1.42, 206.0, vbY + 1.68, -182.0));
  for (let st = 0; st < 8; st++) {
    const sx = 216.5 + st * 1.45;
    const sz = -189.0 - st * 1.85;
    const sy = ctx.getHeight(sx, sz);
    chW3Stone.push(makeBox(2.4, 0.65, 1.15, sx, sy + 0.08, sz, 0.65));
    if (st < 6) {
      chW3Wood.push(makeCylinder(0.04, 0.05, 2.65, 5, sx - 1.4, sy + 1.25, sz));
      chW3Crimson.push(makeBox(0.05, 0.95, 0.45, sx - 1.4, sy + 2.15, sz + 0.25));
    }
  }
  const cvY = ctx.getHeight(231.5, -196.5);
  chW3Stone.push(
    makeBox(2.4, 2.6, 1.4, 231.5, cvY - 1.15, -196.5),
    makeBox(1.85, 0.78, 0.85, 231.5, cvY + 0.39, -196.5),
    makeBox(0.95, 1.45, 0.24, 232.8, ctx.getHeight(232.8, -194.5) + 0.72, -194.5)
  );
  chW3Roof.push(makeBox(1.25, 0.22, 0.65, 232.8, ctx.getHeight(232.8, -194.5) + 1.54, -194.5));
  chW3Bronze.push(makeCylinder(0.26, 0.18, 0.52, 6, 231.5, cvY + 1.04, -196.5));
  for (const side of [-1, 1]) {
    const gy = ctx.getHeight(231.5 + side * 2.2, -195.8);
    chW3Stone.push(
      makeBox(0.65, 0.48, 0.65, 231.5 + side * 2.2, gy + 0.24, -195.8),
      makeCylinder(0.20, 0.26, 1.15, 6, 231.5 + side * 2.2, gy + 1.05, -195.8)
    );
  }

  addMergedMesh(group, chW3Stone, ctx.materials.stone, 'ChuaHuongWave3Stone', false, true);
  addMergedMesh(group, chW3Wood, ctx.materials.darkWood, 'ChuaHuongWave3Wood', false, true);
  addMergedMesh(group, chW3Crimson, ctx.materials.crimsonLacquer, 'ChuaHuongWave3Crimson', false, true);
  addMergedMesh(group, chW3Roof, ctx.materials.terracottaRoof, 'ChuaHuongWave3Roof', false, true);
  addMergedMesh(group, chW3Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'ChuaHuongWave3Bronze', false, true);
  addMergedMesh(group, chW3Gold, ctx.materials.gold, 'ChuaHuongWave3Gold', false, false);

  // 8D. CHÙA HƯƠNG & SUỐI YẾN WAVE 4 PILGRIMAGE VALLEY EXPANSION (Items 1151..1175, castShadow = false, 0 new materials)
  const chW4Stone: THREE.BufferGeometry[] = [];
  const chW4Wood: THREE.BufferGeometry[] = [];
  const chW4Crimson: THREE.BufferGeometry[] = [];
  const chW4Roof: THREE.BufferGeometry[] = [];
  const chW4Bronze: THREE.BufferGeometry[] = [];
  const chW4Gold: THREE.BufferGeometry[] = [];

  // 1151-1152, 1162-1164, 1168. West Bank Lotus Pier (177.5, -168.0), bamboo flower raft, lanterns, Bến Đục dispatcher & mooring stakes
  chW4Wood.push(
    makeBox(3.6, 0.20, 4.2, 177.5, 0.42, -168.0),
    makeCylinder(0.09, 0.11, 1.45, 5, 179.0, 0.05, -169.8),
    makeCylinder(0.09, 0.11, 1.45, 5, 179.0, 0.05, -166.2),
    makeBox(1.45, 0.14, 3.6, 179.8, 0.12, -168.0, 0.12),
    makeBox(0.10, 2.25, 0.10, 179.6, bdY + 1.05, -159.3),
    makeBox(0.10, 2.25, 0.10, 181.4, bdY + 1.05, -159.3),
    makeBox(0.10, 2.25, 0.10, 179.6, bdY + 1.05, -157.7),
    makeBox(0.10, 2.25, 0.10, 181.4, bdY + 1.05, -157.7),
    makeBox(1.25, 1.45, 0.16, 186.5, bdY + 0.72, -155.5)
  );
  chW4Roof.push(makeBox(2.4, 0.24, 2.2, 180.5, bdY + 2.24, -158.5));
  for (let m = 0; m < 5; m++) {
    chW4Wood.push(makeCylinder(0.06, 0.07, 1.35, 5, 180.5, 0.48, -162.0 - m * 3.0));
  }
  for (const lz of [-166.5, -169.5]) {
    const ly = ctx.getHeight(176.2, lz);
    chW4Stone.push(
      makeBox(0.40, 0.98, 0.40, 176.2, ly + 0.49, lz),
      makeBox(0.54, 0.16, 0.54, 176.2, ly + 1.06, lz)
    );
  }
  // 1153-1155, 1173. Giải Oan stone footbridge (212.5, -192.5), Spring Pavilion (215.5, -195.5) & walking-stick rack
  const goY = Math.max(ctx.getHeight(215.5, -195.5), ctx.getHeight(213.8, -197.0), ctx.getHeight(217.2, -194.0));
  chW4Stone.push(
    makeBox(3.8, 0.34, 1.85, 212.5, ctx.getHeight(212.5, -192.5) + 0.25, -192.5, 0.42),
    makeBox(4.0, 3.8, 4.0, 215.5, goY - 1.65, -195.5),
    makeCylinder(0.88, 0.98, 0.62, 6, 215.5, goY + 0.52, -195.5)
  );
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-1.5, 1.5]) {
      chW4Crimson.push(makeCylinder(0.10, 0.12, 2.65, 6, 215.5 + dx, goY + 1.50, -195.5 + dz));
    }
  }
  chW4Roof.push(makeBox(4.6, 0.36, 4.6, 215.5, goY + 2.92, -195.5));
  chW4Wood.push(makeBox(1.15, 1.15, 0.32, 213.2, goY + 0.58, -195.5));
  // 1156-1158. Thiên Trù Pilgrim Tea-House (207.5, -179.5) & 2 mountain herb stalls (208.5, -172.5 & 211.5, -170.0)
  const pthY = Math.max(ctx.getHeight(207.5, -179.5), ctx.getHeight(205.5, -181.0), ctx.getHeight(209.5, -178.0));
  chW4Stone.push(makeBox(4.4, 3.4, 3.6, 207.5, pthY - 1.45, -179.5));
  for (const dx of [-1.75, 1.75]) {
    for (const dz of [-1.35, 1.35]) {
      chW4Wood.push(makeBox(0.11, 2.55, 0.11, 207.5 + dx, pthY + 1.40, -179.5 + dz));
    }
  }
  chW4Wood.push(
    makeBox(1.15, 0.58, 0.68, 206.6, pthY + 0.54, -179.5),
    makeBox(1.15, 0.58, 0.68, 208.4, pthY + 0.54, -179.5)
  );
  chW4Roof.push(makeBox(5.0, 0.32, 4.2, 207.5, pthY + 2.78, -179.5));
  for (const [hx, hz] of [[208.5, -172.5], [211.5, -170.0]] as const) {
    const hy = Math.max(ctx.getHeight(hx, hz), ctx.getHeight(hx - 1.1, hz - 0.9), ctx.getHeight(hx + 1.1, hz + 0.9));
    chW4Stone.push(makeBox(2.6, 2.6, 2.0, hx, hy - 1.25, hz));
    for (const dx of [-1.05, 1.05]) {
      for (const dz of [-0.78, 0.78]) {
        chW4Wood.push(makeBox(0.09, 2.20, 0.09, hx + dx, hy + 1.05, hz + dz));
      }
    }
    chW4Wood.push(makeBox(1.85, 0.62, 0.62, hx, hy + 0.31, hz));
    chW4Roof.push(makeBox(2.6, 0.22, 2.0, hx, hy + 2.20, hz));
  }
  // 1159-1161, 1165-1167, 1169-1172, 1174-1175. Trail milestones, incense bowls, benches, Suối Yến stele, Đền Trình cranes/urns, welcome lanterns, cave table, Viên Công lanterns, flags, water jar & signpost
  for (let i = 0; i < 4; i++) {
    const mx = 214.0 + i * 3.6;
    const mz = -184.0 - i * 3.6;
    const my = ctx.getHeight(mx, mz);
    chW4Stone.push(
      makeBox(0.38, 0.92, 0.24, mx, my + 0.46, mz),
      makeBox(1.55, 0.42, 0.48, mx - 1.2, my + 0.21, mz + 1.6)
    );
    chW4Wood.push(makeCylinder(0.04, 0.05, 2.85, 5, mx + 1.5, my + 1.38, mz));
    chW4Crimson.push(makeBox(0.05, 1.05, 0.48, mx + 1.5, my + 2.35, mz + 0.28));
    if (i < 3) {
      chW4Stone.push(makeCylinder(0.28, 0.22, 0.56, 6, mx + 0.6, my + 0.28, mz - 1.2));
    }
  }
  chW4Stone.push(
    makeBox(0.92, 1.42, 0.22, 198.5, waY + 0.71, -170.8),
    makeBox(1.65, 0.76, 0.78, 229.2, ctx.getHeight(229.2, -198.2) + 0.38, -198.2)
  );
  chW4Wood.push(makeCylinder(0.06, 0.08, 2.15, 6, 209.5, ctx.getHeight(209.5, -183.5) + 1.08, -183.5));
  chW4Bronze.push(makeCylinder(0.22, 0.26, 0.52, 6, 221.0, restY + 0.26, -194.2));
  for (const side of [-1, 1]) {
    chW4Bronze.push(makeCylinder(0.04, 0.08, 0.78, 5, 198.0 + side * 0.9, dtShrineY + 0.82, -166.8));
    chW4Crimson.push(makeCylinder(0.14, 0.14, 0.28, 6, 198.5, waY + 2.65, -174.0 + side * 1.1));
    chW4Stone.push(
      makeBox(0.42, 0.98, 0.42, vcX + side * 2.8, vcY + 0.49, vcZ - 1.8),
      makeBox(0.56, 0.16, 0.56, vcX + side * 2.8, vcY + 1.06, vcZ - 1.8),
      makeCylinder(0.32, 0.24, 0.38, 6, 198.0 + side * 2.2, dtShrineY + 0.19, -161.5)
    );
  }
  addMergedMesh(group, chW4Stone, ctx.materials.stone, 'ChuaHuongWave4Stone', false, true);
  addMergedMesh(group, chW4Wood, ctx.materials.darkWood, 'ChuaHuongWave4Wood', false, true);
  addMergedMesh(group, chW4Crimson, ctx.materials.crimsonLacquer, 'ChuaHuongWave4Crimson', false, true);
  addMergedMesh(group, chW4Roof, ctx.materials.terracottaRoof, 'ChuaHuongWave4Roof', false, true);
  addMergedMesh(group, chW4Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'ChuaHuongWave4Bronze', false, true);
  addMergedMesh(group, chW4Gold, ctx.materials.gold, 'ChuaHuongWave4Gold', false, false);

  // 8E. CHÙA HƯƠNG & SUỐI YẾN WAVE 5 LOTUS DOCKS & TRAIL SHRINES (Items 1541..1560, castShadow = false, 0 new materials)
  const chW5Stone: THREE.BufferGeometry[] = [];
  const chW5Wood: THREE.BufferGeometry[] = [];
  const chW5Crimson: THREE.BufferGeometry[] = [];
  const chW5Roof: THREE.BufferGeometry[] = [];
  const chW5Bronze: THREE.BufferGeometry[] = [];
  const chW5Gold: THREE.BufferGeometry[] = [];

  // 1541-1546, 1553, 1557. 2nd Suối Yến Lotus Dock (177.5, -178.0), 2 wooden rowboats, warden shelter, lanterns, stele & offering stand
  const wdY = ctx.getHeight(175.0, -178.0);
  chW5Wood.push(
    makeBox(3.6, 0.20, 4.8, 177.5, 0.42, -178.0),
    makeCylinder(0.09, 0.11, 1.45, 5, 179.0, 0.05, -175.8),
    makeCylinder(0.09, 0.11, 1.45, 5, 179.0, 0.05, -180.2),
    makeBox(1.15, 0.34, 3.4, 181.2, 0.12, -176.5, 0.16),
    makeBox(1.15, 0.34, 3.4, 181.5, 0.12, -180.5, -0.14),
    makeBox(1.25, 0.68, 0.62, 175.5, ctx.getHeight(175.5, -174.5) + 0.34, -174.5)
  );
  for (const dx of [-0.95, 0.95]) {
    for (const dz of [-0.85, 0.85]) {
      chW5Wood.push(makeBox(0.10, 2.25, 0.10, 175.0 + dx, wdY + 1.05, -178.0 + dz));
    }
  }
  chW5Roof.push(makeBox(2.4, 0.24, 2.2, 175.0, wdY + 2.24, -178.0));
  for (let m = 0; m < 4; m++) {
    chW5Wood.push(makeCylinder(0.06, 0.07, 1.35, 5, 179.5, 0.48, -175.0 - m * 2.0));
  }
  for (const lz of [-176.0, -180.0]) {
    const ly = ctx.getHeight(176.0, lz);
    chW5Stone.push(
      makeBox(0.40, 0.98, 0.40, 176.0, ly + 0.49, lz),
      makeBox(0.54, 0.16, 0.54, 176.0, ly + 1.06, lz)
    );
  }
  chW5Stone.push(makeBox(0.92, 1.42, 0.22, 176.0, ctx.getHeight(176.0, -173.0) + 0.71, -173.0));

  // 1547-1552, 1554-1556, 1558-1560. Am Thờ Sơn Thần Trail Shrine (222.5, -184.5), bridge, apricot stall & mountain trail props
  const amX = 222.5;
  const amZ = -184.5;
  const amY = Math.max(ctx.getHeight(amX, amZ), ctx.getHeight(amX - 1.8, amZ - 1.8), ctx.getHeight(amX + 1.8, amZ + 1.8));
  chW5Stone.push(
    makeBox(3.8, 3.8, 3.8, amX, amY - 1.65, amZ),
    makeBox(1.25, 0.78, 0.68, amX, amY + 0.62, amZ - 0.55),
    makeBox(1.35, 0.36, 2.0, 220.0, amY + 0.12, amZ),
    makeBox(3.2, 0.32, 1.65, 217.5, ctx.getHeight(217.5, -181.5) + 0.22, -181.5, 0.38)
  );
  for (const dx of [-1.4, 1.4]) {
    for (const dz of [-1.4, 1.4]) {
      chW5Crimson.push(makeCylinder(0.10, 0.12, 2.65, 6, amX + dx, amY + 1.50, amZ + dz));
    }
  }
  chW5Roof.push(makeBox(4.4, 0.34, 4.4, amX, amY + 2.92, amZ));
  chW5Bronze.push(
    makeCylinder(0.18, 0.14, 0.34, 6, amX, amY + 1.18, amZ - 0.55),
    makeCylinder(0.24, 0.28, 0.52, 6, 214.5, ctx.getHeight(214.5, -178.0) + 0.26, -177.5),
    makeCylinder(0.24, 0.28, 0.52, 6, 214.5, ctx.getHeight(214.5, -178.0) + 0.26, -178.5)
  );
  chW5Crimson.push(
    makeCylinder(0.12, 0.12, 0.26, 6, amX - 1.4, amY + 2.55, amZ + 1.4),
    makeCylinder(0.12, 0.12, 0.26, 6, amX + 1.4, amY + 2.55, amZ + 1.4)
  );
  // 1551, 1558, 1560. Apricot-drink stall (214.5, -175.5), walking-stick rack & signpost
  const apY = Math.max(ctx.getHeight(214.5, -175.5), ctx.getHeight(213.2, -176.5), ctx.getHeight(215.8, -174.5));
  chW5Stone.push(makeBox(2.8, 2.8, 2.2, 214.5, apY - 1.35, -175.5));
  for (const dx of [-1.1, 1.1]) {
    for (const dz of [-0.8, 0.8]) {
      chW5Wood.push(makeBox(0.09, 2.20, 0.09, 214.5 + dx, apY + 1.05, -175.5 + dz));
    }
  }
  chW5Wood.push(
    makeBox(1.85, 0.62, 0.62, 214.5, apY + 0.31, -175.5),
    makeBox(1.15, 1.15, 0.32, 213.2, apY + 0.58, -175.5),
    makeCylinder(0.06, 0.08, 2.15, 6, 219.5, ctx.getHeight(219.5, -182.5) + 1.08, -182.5)
  );
  chW5Gold.push(makeBox(0.88, 0.24, 0.10, 219.9, ctx.getHeight(219.5, -182.5) + 1.85, -182.5));
  chW5Roof.push(makeBox(2.8, 0.22, 2.2, 214.5, apY + 2.20, -175.5));
  for (let i = 0; i < 4; i++) {
    const tx = 216.0 + i * 3.0;
    const tz = -178.0 - i * 3.0;
    const ty = ctx.getHeight(tx, tz);
    chW5Stone.push(
      makeBox(0.40, 0.96, 0.40, tx, ty + 0.48, tz),
      makeBox(0.54, 0.16, 0.54, tx, ty + 1.04, tz)
    );
    chW5Wood.push(makeCylinder(0.04, 0.05, 2.85, 5, tx + 1.4, ty + 1.38, tz - 1.4));
    chW5Crimson.push(makeBox(0.05, 1.05, 0.48, tx + 1.4, ty + 2.35, tz - 1.12));
    if (i < 3) {
      chW5Stone.push(makeBox(1.55, 0.42, 0.48, tx - 1.2, ty + 0.21, tz + 1.2));
    }
  }
  addMergedMesh(group, chW5Stone, ctx.materials.stone, 'ChuaHuongWave5Stone', false, true);
  addMergedMesh(group, chW5Wood, ctx.materials.darkWood, 'ChuaHuongWave5Wood', false, true);
  addMergedMesh(group, chW5Crimson, ctx.materials.crimsonLacquer, 'ChuaHuongWave5Crimson', false, true);
  addMergedMesh(group, chW5Roof, ctx.materials.terracottaRoof, 'ChuaHuongWave5Roof', false, true);
  addMergedMesh(group, chW5Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'ChuaHuongWave5Bronze', false, true);
  addMergedMesh(group, chW5Gold, ctx.materials.gold, 'ChuaHuongWave5Gold', false, false);

  // =================================================================================================
  // CHÙA HƯƠNG & SUỐI YẾN WAVE 6 (Items 1941..1960 — castShadow = false, 0 new materials)
  // =================================================================================================
  const chW6Stone: THREE.BufferGeometry[] = [];
  const chW6Wood: THREE.BufferGeometry[] = [];
  const chW6Crimson: THREE.BufferGeometry[] = [];
  const chW6Roof: THREE.BufferGeometry[] = [];
  const chW6Bronze: THREE.BufferGeometry[] = [];
  const chW6Gold: THREE.BufferGeometry[] = [];

  // 1941-1946, 1956, 1958. 3rd Suối Yến Lotus Boat-Dock (177.5, -190.0), 2 wooden rowboats, ticket pavilion & offering stall
  const d3Y = ctx.getHeight(174.5, -190.0);
  chW6Wood.push(
    makeBox(3.6, 0.20, 4.8, 177.5, 0.42, -190.0),
    makeCylinder(0.09, 0.11, 1.45, 4, 179.0, 0.05, -187.8),
    makeCylinder(0.09, 0.11, 1.45, 4, 179.0, 0.05, -192.2),
    makeBox(1.12, 0.32, 3.3, 181.2, 0.12, -188.5, 0.15),
    makeBox(1.12, 0.32, 3.3, 181.5, 0.12, -192.5, -0.14),
    makeBox(1.25, 0.68, 0.62, 174.5, ctx.getHeight(174.5, -186.5) + 0.34, -186.5)
  );
  for (const dx of [-1.05, 1.05]) {
    for (const dz of [-0.95, 0.95]) {
      chW6Wood.push(makeBox(0.10, 2.30, 0.10, 174.5 + dx, d3Y + 1.05, -190.0 + dz));
    }
  }
  chW6Roof.push(makeBox(2.6, 0.24, 2.4, 174.5, d3Y + 2.26, -190.0));
  for (let m = 0; m < 4; m++) {
    chW6Wood.push(makeCylinder(0.06, 0.07, 1.35, 4, 179.5, 0.48, -187.0 - m * 2.0));
  }
  for (const lz of [-188.0, -192.0]) {
    const ly = ctx.getHeight(175.8, lz);
    chW6Stone.push(
      makeBox(0.38, 0.96, 0.38, 175.8, ly + 0.48, lz),
      makeBox(0.52, 0.16, 0.52, 175.8, ly + 1.04, lz)
    );
  }
  chW6Stone.push(makeBox(0.90, 1.42, 0.22, 175.5, ctx.getHeight(175.5, -193.5) + 0.71, -193.5));

  // 1947-1955, 1957, 1959-1960. Stone Pilgrimage Archway (228.5, -191.5) & Hillside Rest Pavilion (225.5, -195.5)
  const paX = 228.5;
  const paZ = -191.5;
  const paY = Math.max(ctx.getHeight(paX, paZ), ctx.getHeight(paX, paZ - 1.8), ctx.getHeight(paX, paZ + 1.8));
  chW6Stone.push(
    makeBox(1.85, 2.8, 4.4, paX, paY - 1.25, paZ),
    makeBox(0.68, 3.10, 0.68, paX, paY + 1.55, paZ - 1.55),
    makeBox(0.68, 3.10, 0.68, paX, paY + 1.55, paZ + 1.55),
    makeCylinder(0.30, 0.22, 0.60, 4, 226.5, ctx.getHeight(226.5, -190.0) + 0.30, -190.0)
  );
  chW6Roof.push(makeBox(2.0, 0.34, 4.6, paX, paY + 3.22, paZ));
  chW6Gold.push(
    makeBox(0.14, 0.44, 1.85, paX - 0.36, paY + 2.80, paZ),
    makeBox(0.84, 0.24, 0.08, 230.9, ctx.getHeight(230.5, -192.5) + 1.85, -192.5)
  );
  chW6Crimson.push(
    makeBox(0.18, 0.24, 0.18, paX - 0.4, paY + 2.86, paZ - 0.9),
    makeBox(0.18, 0.24, 0.18, paX - 0.4, paY + 2.86, paZ + 0.9)
  );
  for (let s = 0; s < 3; s++) {
    const sx = 227.0 + s * 1.4;
    chW6Stone.push(makeBox(1.15, 0.45, 2.2, sx, ctx.getHeight(sx, paZ) + 0.10, paZ));
  }
  const rp2X = 225.5;
  const rp2Z = -195.5;
  const rp2Y = Math.max(ctx.getHeight(rp2X, rp2Z), ctx.getHeight(rp2X - 1.5, rp2Z - 1.5), ctx.getHeight(rp2X + 1.5, rp2Z + 1.5));
  chW6Stone.push(
    makeBox(3.6, 2.8, 3.6, rp2X, rp2Y - 1.25, rp2Z),
    makeBox(1.50, 0.42, 0.48, rp2X, rp2Y + 0.41, rp2Z),
    makeBox(1.50, 0.42, 0.48, rp2X + 2.2, ctx.getHeight(rp2X + 2.2, rp2Z) + 0.21, rp2Z)
  );
  for (const dx of [-1.35, 1.35]) {
    for (const dz of [-1.35, 1.35]) {
      chW6Wood.push(makeCylinder(0.09, 0.11, 2.50, 4, rp2X + dx, rp2Y + 1.35, rp2Z + dz));
    }
  }
  chW6Roof.push(makeBox(4.2, 0.28, 4.2, rp2X, rp2Y + 2.68, rp2Z));
  chW6Bronze.push(
    makeCylinder(0.22, 0.26, 0.50, 4, 224.2, ctx.getHeight(224.2, -194.2) + 0.25, -193.8),
    makeCylinder(0.22, 0.26, 0.50, 4, 224.2, ctx.getHeight(224.2, -194.2) + 0.25, -194.6)
  );
  chW6Wood.push(
    makeBox(1.10, 1.10, 0.30, 226.8, ctx.getHeight(226.8, -193.8) + 0.55, -193.8),
    makeCylinder(0.05, 0.07, 2.15, 4, 230.5, ctx.getHeight(230.5, -192.5) + 1.08, -192.5)
  );
  for (const fz of [-188.5, -194.5]) {
    const fy = ctx.getHeight(paX, fz);
    chW6Wood.push(makeCylinder(0.04, 0.05, 3.2, 4, paX, fy + 1.52, fz));
    chW6Crimson.push(makeBox(0.05, 1.05, 0.46, paX, fy + 2.65, fz + 0.28));
  }
  for (const [lx, lz] of [[226.5, -193.5], [230.5, -190.5], [231.5, -193.0]] as const) {
    const ly = ctx.getHeight(lx, lz);
    chW6Stone.push(
      makeBox(0.38, 0.94, 0.38, lx, ly + 0.47, lz),
      makeBox(0.52, 0.16, 0.52, lx, ly + 1.02, lz)
    );
  }
  addMergedMesh(group, chW6Stone, ctx.materials.stone, 'ChuaHuongWave6Stone', false, true);
  addMergedMesh(group, chW6Wood, ctx.materials.darkWood, 'ChuaHuongWave6Wood', false, true);
  addMergedMesh(group, chW6Crimson, ctx.materials.crimsonLacquer, 'ChuaHuongWave6Crimson', false, true);
  addMergedMesh(group, chW6Roof, ctx.materials.terracottaRoof, 'ChuaHuongWave6Roof', false, true);
  addMergedMesh(group, chW6Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'ChuaHuongWave6Bronze', false, true);
  addMergedMesh(group, chW6Gold, ctx.materials.gold, 'ChuaHuongWave6Gold', false, false);
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

  const jadeWaterMat = ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.granite;

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

  // 1. 3-Flight Pilgrimage Staircase + Mid-slope Landing 1 & Nghi Môn Landing 2 + FIX DH-01: Lower 2-Tier Raw-Ironwood Tam Quan Gate (ref 65_cong_nghi_mon_den_hung.jpg!)
  const courtTop = 1.85;
  const lowerGateLanding = buildLanding(39.0, 7.6, 12.6, 0.85);
  const landing1 = buildLanding(31.2, 6.2, 8.6, 1.45);
  const nghiLanding = buildLanding(19.2, 5.2, 8.6, 0.90);

  buildStairFlight(45.0, 42.2, 5, undefined, lowerGateLanding.topY);
  buildStairFlight(35.8, 33.4, 5, lowerGateLanding.topY, landing1.topY);
  buildStairFlight(28.2, 21.5, 10, landing1.topY, nghiLanding.topY);
  buildStairFlight(16.8, 9.8, 11, nghiLanding.topY, yBase + courtTop);

  // Authentic 3-Bay Raw Ironwood Tam Quan Gate (*Cổng Tam Quan Đền Hạ*) with upper bell-tower gallery & grey plaster ridge dragons (ref 65)
  {
    const lgStone: THREE.BufferGeometry[] = [];
    const lgWood: THREE.BufferGeometry[] = [];
    const lgRoof: THREE.BufferGeometry[] = [];
    const lgPlaster: THREE.BufferGeometry[] = [];
    const lgCore: THREE.BufferGeometry[] = [];
    // 8 Round raw ironwood columns (4 bays × front/back) on stone plinths
    for (const gx of [-4.8, -1.75, 1.75, 4.8]) {
      for (const gz of [-1.85, 1.85]) {
        lgStone.push(makeCylinder(0.28, 0.34, 0.28, 8, gx, 0.14, gz));
        lgWood.push(makeCylinder(0.18, 0.21, 3.4, 8, gx, 1.92, gz));
      }
    }
    lgWood.push(
      makeBox(10.6, 0.26, 0.26, 0, 3.52, 1.85),
      makeBox(10.6, 0.26, 0.26, 0, 3.52, -1.85)
    );
    // Flanking grey-plaster temple enclosure walls tying into gate sides
    for (const side of [-1, 1]) {
      lgPlaster.push(makeBox(4.2, 2.4, 0.36, side * 7.2, 1.2, 0));
      addCourtyardStoneLantern(lgStone, lgCore, side * 4.4, 0, 3.6);
    }
    // Lower sweeping 2-tier mossy terracotta roof (12.2m × 6.2m)
    const lgRoof1 = createVietnameseCurvedRoofGeometry(12.2, 6.2, 5.2, 3.4, 1.65, 0.42);
    lgRoof1.translate(0, 3.62, 0);
    lgRoof.push(lgRoof1);
    // Upper central bell-tower gallery (*gác chuông*) with wooden columns & open balustrades
    for (const ux of [-1.8, 1.8]) {
      for (const uz of [-1.25, 1.25]) {
        lgWood.push(makeCylinder(0.13, 0.15, 2.05, 7, ux, 5.95, uz));
      }
    }
    lgWood.push(
      ...createPiercedBalustradeParts(-1.8, 1.25, 1.8, 1.25, 5.05, 0.72, 'con_tien'),
      ...createPiercedBalustradeParts(-1.8, -1.25, 1.8, -1.25, 5.05, 0.72, 'con_tien')
    );
    const lgRoof2 = createHueImperialHipRoofGeometry(5.6, 4.2, 2.4, 0.30, 1.55, 0.34, 8, 5, false);
    lgRoof2.translate(0, 6.95, 0);
    lgRoof.push(lgRoof2);
    lgPlaster.push(makeBox(2.55, 0.18, 0.22, 0, 8.54, 0));
    const lgFin = createRoofFinialSetParts(0, 8.58, 0, 2.3, 0, 0.58, false);
    lgPlaster.push(...lgFin.mainParts, ...lgFin.goldParts);
    const applyLg = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
      for (const g of src) {
        g.rotateY(facingRotY);
        g.translate(lowerGateLanding.x, lowerGateLanding.topY, lowerGateLanding.z);
        dst.push(g);
      }
    };
    applyLg(lgStone, stoneParts);
    applyLg(lgWood, woodParts);
    applyLg(lgRoof, roofParts);
    applyLg(lgPlaster, plasterParts);
    applyLg(lgCore, lanternCoreParts);
  }

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
  const dtRoof2 = createHueImperialHipRoofGeometry(7.6, 5.2, 3.4, 0.30, 1.85, 0.34, 8, 5, false);
  dtRoof2.translate(-0.5, mFloorY + mH + 1.45, -0.4);
  mRoof.push(dtRoof2);
  mStone.push(makeBox(3.55, 0.18, 0.22, -0.5, mFloorY + mH + 3.34, -0.4));
  const dtFin = createRoofFinialSetParts(-0.5, mFloorY + mH + 3.38, -0.4, 3.25, 0, 0.62, false);
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
  const dgRoof2 = createHueImperialHipRoofGeometry(6.8, 4.8, 3.0, 0.30, 1.75, 0.34, 8, 5, false);
  dgRoof2.translate(shX, shBaseY + shH + 1.38, shZ);
  dgRoof.push(dgRoof2);
  dgStone.push(makeBox(3.15, 0.18, 0.22, shX, shBaseY + shH + 3.17, shZ));
  const dgFin = createRoofFinialSetParts(shX, shBaseY + shH + 3.21, shZ, 2.85, 0, 0.58, false);
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

  // FIX DH-02: Tall inner couplet pillars rising ABOVE gate pediment (7.35m) + clean flat crown with grand grey-plaster Lưỡng Long Chầu Nguyệt (ref 79!)
  for (const [px, colH] of [
    [-3.85, 5.65],
    [-1.65, 7.35],
    [1.65, 7.35],
    [3.85, 5.65]
  ]) {
    nStone.push(makeBox(0.92, 0.85, 0.96, px, 0.425, 0));
    nPlaster.push(makeBox(0.68, colH, 0.72, px, 0.85 + colH * 0.5, 0));
    // Vertical recessed couplet border molding on front face of each pillar
    nStone.push(makeBox(0.38, colH * 0.62, 0.08, px, 0.85 + colH * 0.45, 0.37));
    if (Math.abs(px) > 2.5) {
      nStone.push(makeBox(0.84, 0.24, 0.84, px, 0.85 + colH + 0.12, 0));
      nStone.push(...createGuardianBeastParts(px, 0.85 + colH + 0.24, 0, 0, 0.92, 'nghe'));
    } else {
      nPlaster.push(...createLotusFinialParts(px, 0.85 + colH, 0, 0.98));
    }
  }

  // Clean flat pediment cornice crowning central arch + bold grey-plaster Lưỡng Long Chầu Nguyệt (NO thick stepped pyramid!)
  nPlaster.push(makeBox(3.95, 0.34, 1.18, 0, 5.42, 0));
  const nghiFin = createRoofFinialSetParts(0, 5.64, 0, 3.9, 0, 1.18, false);
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
  // FIX DH-02 & DH-05: 2 Sculpted 3D Polychrome Guardian Warriors (*Võ Tướng / Hộ Pháp*) flanking central arch +
  // vertical black-on-white Han couplet strips (*Câu đối*) on all 4 pillars of Cổng Đền Thượng (ref 79!)
  const nghiPolyParts: THREE.BufferGeometry[] = [];
  const paintNghi = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let vi = 0; vi < n; vi++) {
      arr[vi * 3] = c.r;
      arr[vi * 3 + 1] = c.g;
      arr[vi * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.rotateY(facingRotY);
    g.translate(nghiX, nghiY, nghiZ);
    nghiPolyParts.push(g);
  };
  for (const side of [-1, 1]) {
    const wx = side * 1.38;
    const wz = 0.56;
    // Warrior crimson armored chest & skirt + indigo sash + gilded helmet + upright halberd spear
    paintNghi(makeBox(0.38, 0.76, 0.14, wx, 1.85, wz), '#b3342c');
    paintNghi(makeBox(0.42, 0.18, 0.16, wx, 1.56, wz + 0.02), '#3c6e8f');
    paintNghi(new THREE.SphereGeometry(0.14, 6, 5).translate(wx, 2.38, wz + 0.02), '#cfa13a');
    paintNghi(makeCylinder(0.025, 0.028, 1.65, 5, wx + side * 0.24, 1.98, wz + 0.06), '#cfa13a');
  }
  for (const [px, colH] of [[-3.85, 5.65], [-1.65, 7.35], [1.65, 7.35], [3.85, 5.65]]) {
    // Crisp white couplet tablet with vertical ink-black Han calligraphy bars on front face of each pillar
    paintNghi(makeBox(0.28, colH * 0.56, 0.03, px, 0.85 + colH * 0.45, 0.42), '#ece8dc');
    for (let ch = 0; ch < 6; ch++) {
      const cy = 0.85 + colH * (0.24 + ch * 0.085);
      paintNghi(makeBox(0.14, 0.14, 0.035, px, cy, 0.44), '#231f1b');
    }
  }
  const nghiPolyMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.75 }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  ctx.extraMaterials.push(nghiPolyMat);
  group.add(new THREE.Mesh(mergeNormalized(nghiPolyParts), nghiPolyMat));

  // FIX DH-02: Traditional right-to-left "祖 肇 越 南" (*NAM VIỆT TRIỆU TỔ*) inscription plaque above central arch (ref 79!)
  const nghiPlaquePos = new THREE.Vector3(0, 4.46, 0.52)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
    .add(new THREE.Vector3(nghiX, nghiY, nghiZ));
  const nghiPlaque = createSignagePlaqueMesh(
    {
      text: '祖 肇 越 南',
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
    // FIX DH-04: Retained only solemn altar bronze oil lamps (removed 4 ahistorical Hội An silk lanterns from Đền Thượng eaves!)
    dBronze.push(makeCylinder(0.09, 0.14, 0.26, 8, side * 1.05, floorY + 1.34, -1.92));
    dLanternCore.push(new THREE.SphereGeometry(0.14, 8, 8).translate(side * 1.05, floorY + 1.58, -1.92));
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

  const highRoof = createHueImperialHipRoofGeometry(11.6, 7.0, 4.6, 0.34, 2.65, 0.38, 10, 6, false);
  highRoof.translate(0, upperHallY + upperHallH + 0.02, -1.2);
  dRoof.push(highRoof);

  const crestY = upperHallY + upperHallH + 2.70;
  dStone.push(makeBox(4.8, 0.22, 0.24, 0, crestY, -1.2));
  const dtUpperFin = createRoofFinialSetParts(0, crestY + 0.06, -1.2, 4.4, 0, 0.78, false);
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

  // 4 Square Corner Hán-Character Couplet Pilasters (FIX DH-05: recessed ink-on-plaster vertical Han couplets on all 4 corners!)
  const tombCoupletParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * tombHalf;
      const pz = tombCenterZ + sz * tombHalf;
      tStone.push(makeBox(0.68, 0.36, 0.68, px, tBaseY + 0.18, pz));
      tPlaster.push(makeBox(0.56, tombWallH + 0.12, 0.56, px, tBaseY + (tombWallH + 0.12) * 0.5, pz));
      // Inset couplet panel border + vertical ink-black Han glyphs on front/side pilaster faces
      tStone.push(
        makeBox(0.28, 2.15, 0.06, px, tBaseY + 1.65, pz + sz * 0.29),
        makeBox(0.06, 2.15, 0.28, px + sx * 0.29, tBaseY + 1.65, pz)
      );
      for (const faceZ of [true, false]) {
        for (let gIdx = 0; gIdx < 5; gIdx++) {
          const gy = tBaseY + 0.85 + gIdx * 0.40;
          const glyph = makeBox(faceZ ? 0.12 : 0.035, 0.15, faceZ ? 0.035 : 0.12, faceZ ? px : px + sx * 0.33, gy, faceZ ? pz + sz * 0.33 : pz);
          const colB = new THREE.Color('#231f1b');
          const arrB = new Float32Array(glyph.attributes.position.count * 3);
          for (let vi = 0; vi < glyph.attributes.position.count; vi++) {
            arrB[vi * 3] = colB.r; arrB[vi * 3 + 1] = colB.g; arrB[vi * 3 + 2] = colB.b;
          }
          glyph.setAttribute('color', new THREE.BufferAttribute(arrB, 3));
          glyph.rotateY(facingRotY);
          glyph.translate(tombX, tombY, tombZ);
          tombCoupletParts.push(glyph);
        }
      }
    }
  }
  const tombCoupletMat = ctx.materialLib?.getOrCreateStandard({ vertexColors: true, roughness: 0.75 }) ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  ctx.extraMaterials.push(tombCoupletMat);
  group.add(new THREE.Mesh(mergeNormalized(tombCoupletParts), tombCoupletMat));
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
  // FIX DH-03: Carved Square Stone Offering Table (*Bàn lễ đá vuông*) right in front of the square censer (ref 10!)
  tStone.push(
    makeBox(1.12, 0.74, 0.94, 0, tPlatTop + 0.37, sqCenserZ + 1.48),
    makeBox(1.22, 0.12, 1.04, 0, tPlatTop + 0.78, sqCenserZ + 1.48)
  );
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

  // FIX DH-03: Mount traditional right-to-left "陵 王 雄" plaque cleanly on ALL 4 faces of the upper clerestory neck (tNeckY + 0.48) so the Tier-1 Hổ Phù mask stays 100% unobstructed!
  for (let f = 0; f < 4; f++) {
    const faceRot = f * Math.PI * 0.5;
    const localOff = new THREE.Vector3(0, tNeckY + 0.48, 1.78).applyAxisAngle(new THREE.Vector3(0, 1, 0), faceRot);
    const tombPlaquePos = new THREE.Vector3(localOff.x, localOff.y, tombCenterZ + localOff.z)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY)
      .add(new THREE.Vector3(tombX, tombY, tombZ));
    const tombPlaque = createSignagePlaqueMesh(
      {
        text: '陵 王 雄',
        style: 'stone',
        bgColor: '#474a4d',
        textColor: '#e8e9e4',
        borderColor: '#989a96',
        width: 2.15,
        height: 0.62,
        depth: 0.10
      },
      ctx
    );
    if (f === 0) tombPlaque.name = 'HungVuongLangPlaque';
    tombPlaque.position.copy(tombPlaquePos);
    tombPlaque.rotation.y = facingRotY + faceRot;
    group.add(tombPlaque);
  }

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
  tagMotifIds(group, [
    'HV-A04', 'HV-A06', 'HV-B02', 'HV-B03', 'HV-B04', 'HV-B06', 'HV-D01',
    'HV-D02', 'HV-D12', 'HV-D13', 'HV-E01', 'HV-E07', 'HV-I01', 'HV-J04',
    'HV-NEW-MB-03', 'HV-NEW-MB-10', 'HV-NEW-MB-12'
  ]);
  // 6. ĐỀN HÙNG & NÚI NGHĨA LĨNH QC EXPANSIONS (Items 183..193 — with deep hillside retaining skirts & full 4-corner columns!)
  // 183-186. Đền Hạ Lower Temple (cx, cz + 28), Nhà Bia Uncle Ho stele kiosk & flanking guardian markers
  const dHaZ = cz + 28.0;
  const dHaY = Math.max(
    ctx.getHeight(cx, dHaZ),
    ctx.getHeight(cx - 4.1, dHaZ - 3.2),
    ctx.getHeight(cx + 4.1, dHaZ - 3.2),
    ctx.getHeight(cx - 4.1, dHaZ + 3.2),
    ctx.getHeight(cx + 4.1, dHaZ + 3.2)
  );
  lateriteParts.push(makeBox(8.2, 4.2, 6.4, cx, dHaY - 1.65, dHaZ));
  for (const dx of [-3.2, 0, 3.2]) {
    for (const dz of [-2.4, 2.4]) {
      crimsonParts.push(makeCylinder(0.12, 0.14, 2.95, 6, cx + dx, dHaY + 1.85, dHaZ + dz));
    }
  }
  roofParts.push(createVietnameseCurvedRoofGeometry(9.2, 7.4, 3.8, 2.2, 1.45, 0.28).translate(cx, dHaY + 3.3, dHaZ));
  // Nhà Bia Stele House flanking Đền Hạ (4 grounded columns supporting its roof + deep hillside skirt!)
  const nbHaY = Math.max(
    ctx.getHeight(cx - 7.5, dHaZ),
    ctx.getHeight(cx - 8.7, dHaZ - 1.2),
    ctx.getHeight(cx - 6.3, dHaZ + 1.2)
  );
  lateriteParts.push(makeBox(2.6, 3.6, 2.6, cx - 7.5, nbHaY - 1.48, dHaZ));
  for (const dx of [-0.95, 0.95]) {
    for (const dz of [-0.95, 0.95]) {
      crimsonParts.push(makeCylinder(0.09, 0.10, 2.15, 6, cx - 7.5 + dx, nbHaY + 1.38, dHaZ + dz));
    }
  }
  bronzeParts.push(makeBox(0.95, 1.45, 0.22, cx - 7.5, nbHaY + 1.05, dHaZ));
  roofParts.push(createVietnameseCurvedRoofGeometry(3.1, 3.1, 0.5, 0.5, 0.95, 0.24).translate(cx - 7.5, nbHaY + 2.4, dHaZ));
  for (const side of [-1, 1]) {
    const gY = ctx.getHeight(cx + side * 4.5, dHaZ + 5.2);
    lateriteParts.push(makeBox(1.15, 1.45, 1.65, cx + side * 4.5, gY + 0.22, dHaZ + 5.2));
  }
  // 187-193. Đền Thượng Tả Vu / Hữu Vu (full 4-corner columns + deep hillside skirt!), Trống Đồng, well curb & festival banners
  const dThuongY = ctx.getHeight(cx, cz - 2.0);
  for (const side of [-1, 1]) {
    const tvX = cx + side * 11.5;
    const tvZ = cz - 2.0;
    const tvY = Math.max(
      ctx.getHeight(tvX, tvZ),
      ctx.getHeight(tvX - 2.2, tvZ - 3.4),
      ctx.getHeight(tvX + 2.2, tvZ - 3.4),
      ctx.getHeight(tvX - 2.2, tvZ + 3.4),
      ctx.getHeight(tvX + 2.2, tvZ + 3.4)
    );
    lateriteParts.push(makeBox(4.4, 4.2, 6.8, tvX, tvY - 1.76, tvZ));
    for (const dx of [-1.7, 1.7]) {
      for (const dz of [-2.6, 2.6]) {
        crimsonParts.push(makeCylinder(0.11, 0.12, 2.75, 6, tvX + dx, tvY + 1.68, tvZ + dz));
      }
    }
    roofParts.push(createVietnameseCurvedRoofGeometry(5.2, 7.6, 1.4, 3.8, 1.25, 0.25).translate(tvX, tvY + 3.04, tvZ));
    // Festival banners flanking summit approach
    const banY = ctx.getHeight(cx + side * 6.2, cz + 8.5);
    woodParts.push(makeCylinder(0.04, 0.05, 4.2, 6, cx + side * 6.2, banY + 2.1, cz + 8.5));
    crimsonParts.push(makeBox(0.95, 1.85, 0.04, cx + side * 6.2, banY + 3.2, cz + 8.5));
  }
  bronzeParts.push(...createDongSonDrum3DParts(cx + 1.8, yBase + courtTop, cz + 1.5, 0.68));
  const wCurbY = ctx.getHeight(cx - 10.5, dHaZ + 3.5);
  lateriteParts.push(makeCylinder(1.05, 1.15, 0.85, 10, cx - 10.5, wCurbY + 0.15, dHaZ + 3.5));
  const rearAltY = ctx.getHeight(cx, cz - 14.5);
  lateriteParts.push(makeBox(1.65, 1.25, 0.85, cx, rearAltY + 0.05, cz - 14.5));

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

  // 6B. ĐỀN HÙNG & NÚI NGHĨA LĨNH WAVE 2 REAL-WORLD DETAILS (Items 381..390, castShadow = false, 0 new materials)
  const dhW2Stone: THREE.BufferGeometry[] = [];
  const dhW2Crimson: THREE.BufferGeometry[] = [];
  const dhW2Wood: THREE.BufferGeometry[] = [];
  const dhW2Roof: THREE.BufferGeometry[] = [];
  const dhW2Bronze: THREE.BufferGeometry[] = [];
  const dhW2Gold: THREE.BufferGeometry[] = [];
  // 381-382. Mid-slope rest pavilion (cx, cz + 14.5, with deep hillside retaining skirt!) & ancestral altar
  const dTrZ = cz + 14.5;
  const dTrY = Math.max(
    ctx.getHeight(cx, dTrZ),
    ctx.getHeight(cx - 3.4, dTrZ - 2.6),
    ctx.getHeight(cx + 3.4, dTrZ - 2.6),
    ctx.getHeight(cx - 3.4, dTrZ + 2.6),
    ctx.getHeight(cx + 3.4, dTrZ + 2.6)
  );
  dhW2Stone.push(makeBox(6.8, 4.2, 5.2, cx, dTrY - 1.65, dTrZ));
  for (const dx of [-2.6, 0, 2.6]) {
    for (const dz of [-1.9, 1.9]) {
      dhW2Crimson.push(makeCylinder(0.11, 0.13, 2.8, 6, cx + dx, dTrY + 1.82, dTrZ + dz));
    }
  }
  dhW2Roof.push(
    makeBox(7.6, 0.45, 6.0, cx, dTrY + 3.42, dTrZ),
    makeBox(5.2, 0.48, 3.6, cx, dTrY + 3.88, dTrZ)
  );
  dhW2Crimson.push(makeBox(2.2, 0.92, 0.85, cx, dTrY + 0.90, dTrZ - 1.1));
  dhW2Bronze.push(makeCylinder(0.18, 0.14, 0.36, 6, cx, dTrY + 1.54, dTrZ - 1.1));
  // 383-385. Đền Hạ inner altar & candlesticks, pair of laterite lanterns flanking Đền Hạ steps, Chùa Thiên Quang compact hall (with hillside skirt!)
  dhW2Crimson.push(makeBox(2.4, 0.92, 0.92, cx, dHaY + 0.90, dHaZ - 1.4));
  for (const side of [-1, 1]) {
    dhW2Bronze.push(makeCylinder(0.05, 0.10, 0.48, 5, cx + side * 0.85, dHaY + 1.60, dHaZ - 1.4));
    const dlY = ctx.getHeight(cx + side * 3.2, dHaZ + 3.8);
    dhW2Stone.push(
      makeBox(0.42, 0.95, 0.42, cx + side * 3.2, dlY + 0.48, dHaZ + 3.8),
      makeBox(0.55, 0.16, 0.55, cx + side * 3.2, dlY + 1.05, dHaZ + 3.8)
    );
  }
  const ctqY = Math.max(
    ctx.getHeight(cx - 12.2, dHaZ - 1.5),
    ctx.getHeight(cx - 14.3, dHaZ - 3.3),
    ctx.getHeight(cx - 10.1, dHaZ + 0.3)
  );
  dhW2Stone.push(makeBox(4.2, 3.8, 3.6, cx - 12.2, ctqY - 1.54, dHaZ - 1.5));
  dhW2Wood.push(makeBox(3.6, 2.2, 3.0, cx - 12.2, ctqY + 1.45, dHaZ - 1.5));
  dhW2Roof.push(makeBox(4.8, 0.48, 4.2, cx - 12.2, ctqY + 2.78, dHaZ - 1.5));
  // 386-390. Well 4-post tiled roof canopy, Tả Vu/Hữu Vu offering tables & drums, Nghi Môn stone Nghê, Nghĩa Lĩnh history stele & Cổng Làng Cổ Tích arch
  for (const dx of [-1.2, 1.2]) {
    for (const dz of [-1.2, 1.2]) {
      dhW2Wood.push(makeCylinder(0.09, 0.10, 2.55, 5, cx - 10.5 + dx, wCurbY + 1.2, dHaZ + 3.5 + dz));
    }
  }
  dhW2Roof.push(makeBox(3.2, 0.36, 3.2, cx - 10.5, wCurbY + 2.58, dHaZ + 3.5));
  for (const side of [-1, 1]) {
    const tvX = cx + side * 11.5;
    const tvZ = cz - 2.0;
    const tvY = Math.max(
      ctx.getHeight(tvX, tvZ),
      ctx.getHeight(tvX - 2.2, tvZ - 3.4),
      ctx.getHeight(tvX + 2.2, tvZ - 3.4),
      ctx.getHeight(tvX - 2.2, tvZ + 3.4),
      ctx.getHeight(tvX + 2.2, tvZ + 3.4)
    );
    dhW2Crimson.push(makeBox(1.45, 0.85, 2.2, tvX, tvY + 0.76, tvZ));
    dhW2Bronze.push(makeCylinder(0.28, 0.32, 0.42, 6, tvX, tvY + 1.38, tvZ));
    const ngY = ctx.getHeight(cx + side * 3.4, cz + 9.2);
    dhW2Stone.push(
      makeBox(0.55, 0.48, 0.68, cx + side * 3.4, ngY + 0.24, cz + 9.2),
      makeBox(0.38, 0.56, 0.48, cx + side * 3.4, ngY + 0.76, cz + 9.2)
    );
  }
  const hsY = ctx.getHeight(cx - 9.8, cz + 5.4);
  dhW2Stone.push(makeBox(0.95, 1.45, 0.24, cx - 9.8, hsY + 0.72, cz + 5.4));
  const clZ = cz + 35.5;
  const clY = ctx.getHeight(cx, clZ);
  dhW2Stone.push(
    makeBox(0.75, 3.2, 0.75, cx - 2.8, clY + 1.6, clZ),
    makeBox(0.75, 3.2, 0.75, cx + 2.8, clY + 1.6, clZ),
    makeBox(6.8, 0.55, 0.85, cx, clY + 3.35, clZ)
  );
  dhW2Roof.push(makeBox(7.4, 0.45, 1.65, cx, clY + 3.85, clZ));
  dhW2Gold.push(makeBox(2.2, 0.45, 0.12, cx, clY + 3.35, clZ + 0.46));

  addMergedMesh(group, dhW2Stone, ctx.materials.lateriteHoneycomb ?? ctx.materials.stone, 'DenHungWave2Stone', false, true);
  addMergedMesh(group, dhW2Crimson, ctx.materials.crimsonLacquer, 'DenHungWave2Crimson', false, true);
  addMergedMesh(group, dhW2Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'DenHungWave2Wood', false, true);
  addMergedMesh(group, dhW2Roof, ctx.materials.terracottaRoof, 'DenHungWave2Roof', false, true);
  addMergedMesh(group, dhW2Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'DenHungWave2Bronze', false, true);
  addMergedMesh(group, dhW2Gold, ctx.materials.gold, 'DenHungWave2Gold', false, false);

  // 6C. ĐỀN HÙNG & NÚI NGHĨA LĨNH WAVE 3 REAL-WORLD DETAILS (Items 761..780, castShadow = false, 0 new materials)
  const dhW3Stone: THREE.BufferGeometry[] = [];
  const dhW3Crimson: THREE.BufferGeometry[] = [];
  const dhW3Wood: THREE.BufferGeometry[] = [];
  const dhW3Roof: THREE.BufferGeometry[] = [];
  const dhW3Bronze: THREE.BufferGeometry[] = [];
  const dhW3Gold: THREE.BufferGeometry[] = [];

  // 761. Ceremonial incense pavilion (Lầu Hóa Vàng) beside Đền Thượng (deep hillside skirt!)
  const lhvX = cx + 12.5;
  const lhvZ = cz - 8.5;
  const lhvY = Math.max(ctx.getHeight(lhvX, lhvZ), ctx.getHeight(lhvX - 1.5, lhvZ - 1.5), ctx.getHeight(lhvX + 1.5, lhvZ + 1.5));
  dhW3Stone.push(
    makeBox(3.2, 3.8, 3.2, lhvX, lhvY - 1.65, lhvZ),
    makeBox(1.85, 1.85, 1.85, lhvX, lhvY + 1.15, lhvZ)
  );
  dhW3Roof.push(
    makeBox(2.45, 0.34, 2.45, lhvX, lhvY + 2.22, lhvZ),
    makeBox(1.45, 0.32, 1.45, lhvX, lhvY + 2.52, lhvZ)
  );

  // 762-764, 773. 8 Nghĩa Lĩnh festival banners (Cờ Hội), Giỗ Tổ festival arch, 6 laterite rest-landing steps & 6 laterite trail lanterns
  for (let fb = 0; fb < 8; fb++) {
    const fSide = fb % 2 === 0 ? -1 : 1;
    const fx = cx + 6.5 + fb * 2.1 + fSide * 2.2;
    const fz = cz + 10.5 + fb * 2.2 - fSide * 2.2;
    const fy = ctx.getHeight(fx, fz);
    dhW3Wood.push(makeCylinder(0.04, 0.05, 3.8, 5, fx, fy + 1.82, fz));
    dhW3Crimson.push(makeBox(0.05, 1.65, 0.58, fx, fy + 2.95, fz + 0.32));
  }
  const faZ = cz + 40.5;
  const faY = ctx.getHeight(cx, faZ);
  dhW3Crimson.push(
    makeBox(0.36, 3.85, 0.36, cx - 3.4, faY + 1.78, faZ),
    makeBox(0.36, 3.85, 0.36, cx + 3.4, faY + 1.78, faZ),
    makeBox(7.6, 0.56, 0.42, cx, faY + 3.78, faZ)
  );
  dhW3Gold.push(makeBox(3.4, 0.42, 0.48, cx, faY + 3.78, faZ));
  for (let ls = 0; ls < 6; ls++) {
    const sz = cz + 18.5 + ls * 1.1;
    const sy = ctx.getHeight(cx, sz);
    dhW3Stone.push(makeBox(3.8, 0.65, 1.05, cx, sy + 0.10, sz));
  }
  for (const lz of [cz + 12.0, cz + 18.0, cz + 28.0]) {
    for (const side of [-1, 1]) {
      const ly = ctx.getHeight(cx + side * 3.6, lz);
      dhW3Stone.push(
        makeBox(0.42, 1.05, 0.42, cx + side * 3.6, ly + 0.52, lz),
        makeBox(0.56, 0.18, 0.56, cx + side * 3.6, ly + 1.14, lz)
      );
    }
  }

  // 765-772, 774-780. Đền Trung incense pavilion & cranes, Đền Hạ Đông Sơn drum & gong rack, Bánh Chưng/Bánh Giầy offering table, Kiệu Rước palanquin, Lỗ Bộ halberds, đấu củng, Đền Giếng benches & 1954 stele, Văn Lang shelter, Nghi Môn censers, Thiên Quang parapet & bell frame, signpost
  const cdX = cx + 5.8;
  const cdZ = dTrZ + 1.5;
  const cdY = Math.max(ctx.getHeight(cdX, cdZ), ctx.getHeight(cdX - 1.5, cdZ - 1.5), ctx.getHeight(cdX + 1.5, cdZ + 1.5));
  dhW3Stone.push(makeBox(3.2, 3.6, 3.2, cdX, cdY - 1.55, cdZ));
  for (const dx of [-1.2, 1.2]) {
    for (const dz of [-1.2, 1.2]) {
      dhW3Wood.push(makeBox(0.11, 2.45, 0.11, cdX + dx, cdY + 1.35, cdZ + dz));
    }
  }
  dhW3Roof.push(makeBox(3.8, 0.34, 3.8, cdX, cdY + 2.66, cdZ));
  dhW3Bronze.push(
    makeCylinder(0.24, 0.18, 0.45, 6, cdX, cdY + 0.48, cdZ),
    makeCylinder(0.05, 0.10, 0.85, 5, cx - 1.6, dTrY + 0.85, dTrZ - 0.8),
    makeCylinder(0.05, 0.10, 0.85, 5, cx + 1.6, dTrY + 0.85, dTrZ - 0.8),
    // 767-768. Đền Hạ monumental Đông Sơn bronze drum & West gong rack
    makeCylinder(0.58, 0.64, 0.72, 8, cx + 4.8, dHaY + 0.92, dHaZ + 2.8),
    makeCylinder(0.34, 0.34, 0.08, 6, cx - 4.8, dHaY + 1.35, dHaZ + 2.8, Math.PI * 0.5)
  );
  dhW3Wood.push(
    makeBox(1.35, 0.56, 1.35, cx + 4.8, dHaY + 0.28, dHaZ + 2.8),
    makeBox(1.55, 1.85, 0.14, cx - 4.8, dHaY + 0.92, dHaZ + 2.8),
    // 772. Đấu củng fascia beams under Đền Trung & Đền Hạ eaves
    makeBox(5.6, 0.26, 0.34, cx, dTrY + 3.12, dTrZ + 1.95),
    makeBox(5.6, 0.26, 0.34, cx, dHaY + 3.12, dHaZ + 1.95)
  );
  // 769-771. Bánh Chưng / Bánh Giầy offering table (with deep hillside stone plinth!), Kiệu Rước palanquin (on grounded table!) & Lỗ Bộ halberds
  const bcY = Math.max(ctx.getHeight(cx, cz + 6.2), ctx.getHeight(cx - 1.0, cz + 6.2), ctx.getHeight(cx + 1.0, cz + 6.2));
  const krY = Math.max(ctx.getHeight(cx + 11.5, cz + 2.8), ctx.getHeight(cx + 10.5, cz + 2.8), ctx.getHeight(cx + 12.5, cz + 2.8));
  dhW3Stone.push(
    makeBox(2.4, 2.8, 1.3, cx, bcY - 1.35, cz + 6.2),
    makeBox(2.0, 2.6, 2.2, cx + 11.5, krY - 1.25, cz + 2.8)
  );
  dhW3Wood.push(makeBox(1.45, 0.44, 1.65, cx + 11.5, krY + 0.22, cz + 2.8));
  dhW3Crimson.push(
    makeBox(1.95, 0.82, 0.85, cx, bcY + 0.41, cz + 6.2),
    makeBox(1.15, 1.15, 1.45, cx + 11.5, krY + 1.02, cz + 2.8)
  );
  dhW3Gold.push(
    makeBox(0.32, 0.16, 0.32, cx - 0.35, bcY + 0.90, cz + 6.2),
    makeCylinder(0.18, 0.18, 0.14, 6, cx + 0.35, bcY + 0.89, cz + 6.2),
    makeBox(1.35, 0.26, 1.65, cx + 11.5, krY + 1.68, cz + 2.8)
  );
  for (const side of [-1, 1]) {
    const lbY = ctx.getHeight(cx + side * 4.2, cz + 3.2);
    const cnY = ctx.getHeight(cx + side * 4.8, cz + 10.5);
    dhW3Stone.push(
      makeBox(0.75, 1.85, 0.75, cx + side * 4.2, lbY - 0.88, cz + 3.2),
      makeBox(0.85, 1.85, 0.85, cx + side * 4.8, cnY - 0.88, cz + 10.5)
    );
    dhW3Bronze.push(
      makeCylinder(0.03, 0.04, 2.2, 5, cx + side * 4.2, lbY + 1.1, cz + 3.2),
      makeCylinder(0.03, 0.04, 2.2, 5, cx + side * 4.6, lbY + 1.1, cz + 3.2),
      makeCylinder(0.24, 0.18, 0.48, 6, cx + side * 4.8, cnY + 0.24, cz + 10.5)
    );
  }
  // 774-776, 778-780. Đền Giếng benches & 1954 stele, Văn Lang exhibition shelter, Chùa Thiên Quang parapet & bell frame, directional signpost
  const dgBY = ctx.getHeight(-155.5, -172.0);
  dhW3Stone.push(
    makeBox(1.65, 0.42, 0.52, -155.5, dgBY + 0.21, -172.0),
    makeBox(1.05, 1.55, 0.24, -164.5, ctx.getHeight(-164.5, -172.0) + 0.78, -172.0),
    makeBox(4.4, 0.65, 0.28, cx - 12.2, ctqY + 0.65, dHaZ + 1.2),
    makeBox(0.32, 1.85, 0.32, cx + 6.5, ctx.getHeight(cx + 6.5, cz + 29.5) + 0.92, cz + 29.5)
  );
  dhW3Gold.push(makeBox(0.95, 0.28, 0.10, cx + 6.9, ctx.getHeight(cx + 6.5, cz + 29.5) + 1.65, cz + 29.5));
  const vlX = cx + 7.5;
  const vlZ = cz + 34.0;
  const vlY = Math.max(ctx.getHeight(vlX, vlZ), ctx.getHeight(vlX - 2.0, vlZ - 1.5), ctx.getHeight(vlX + 2.0, vlZ + 1.5));
  dhW3Stone.push(makeBox(4.2, 3.6, 3.4, vlX, vlY - 1.55, vlZ));
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.25, 1.25]) {
      dhW3Wood.push(makeBox(0.11, 2.55, 0.11, vlX + dx, vlY + 1.40, vlZ + dz));
    }
  }
  dhW3Roof.push(makeBox(4.8, 0.34, 4.0, vlX, vlY + 2.78, vlZ));
  const tqbX = cx - 15.2;
  const tqbZ = dHaZ - 1.5;
  const tqbY = Math.max(ctx.getHeight(tqbX, tqbZ), ctx.getHeight(tqbX - 1.0, tqbZ - 1.0));
  dhW3Stone.push(makeBox(2.4, 3.2, 2.2, tqbX, tqbY - 1.45, tqbZ));
  dhW3Wood.push(
    makeBox(0.12, 2.25, 0.12, tqbX - 0.75, tqbY + 1.20, tqbZ),
    makeBox(0.12, 2.25, 0.12, tqbX + 0.75, tqbY + 1.20, tqbZ),
    makeBox(1.85, 0.14, 0.16, tqbX, tqbY + 2.32, tqbZ)
  );
  dhW3Bronze.push(makeCylinder(0.22, 0.32, 0.72, 6, tqbX, tqbY + 1.58, tqbZ));

  addMergedMesh(group, dhW3Stone, ctx.materials.lateriteHoneycomb ?? ctx.materials.stone, 'DenHungWave3Stone', false, true);
  addMergedMesh(group, dhW3Crimson, ctx.materials.crimsonLacquer, 'DenHungWave3Crimson', false, true);
  addMergedMesh(group, dhW3Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'DenHungWave3Wood', false, true);
  addMergedMesh(group, dhW3Roof, ctx.materials.terracottaRoof, 'DenHungWave3Roof', false, true);
  addMergedMesh(group, dhW3Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'DenHungWave3Bronze', false, true);
  addMergedMesh(group, dhW3Gold, ctx.materials.gold, 'DenHungWave3Gold', false, false);

  // 6D. ĐỀN HÙNG WAVE 4 MEMORIAL STELE PAVILION & BRONZE DRUM PLAZA (Items 1176..1185, castShadow = false, 0 new materials)
  const dhW4Stone: THREE.BufferGeometry[] = [];
  const dhW4Crimson: THREE.BufferGeometry[] = [];
  const dhW4Wood: THREE.BufferGeometry[] = [];
  const dhW4Roof: THREE.BufferGeometry[] = [];
  const dhW4Bronze: THREE.BufferGeometry[] = [];
  const dhW4Gold: THREE.BufferGeometry[] = [];
  // 1176-1177, 1184. Memorial Stele Pavilion east of Đền Hạ (cx + 14.5, cz + 28.0) & connecting steps
  const msX = cx + 14.5;
  const msZ = cz + 28.0;
  const msY = Math.max(ctx.getHeight(msX, msZ), ctx.getHeight(msX - 2.0, msZ - 2.0), ctx.getHeight(msX + 2.0, msZ + 2.0));
  dhW4Stone.push(
    makeBox(4.4, 3.8, 4.4, msX, msY - 1.65, msZ),
    makeBox(1.05, 1.65, 0.26, msX, msY + 1.05, msZ)
  );
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.6, 1.6]) {
      dhW4Crimson.push(makeCylinder(0.11, 0.13, 2.85, 6, msX + dx, msY + 1.60, msZ + dz));
    }
  }
  dhW4Roof.push(makeBox(5.2, 0.36, 5.2, msX, msY + 3.12, msZ));
  for (let st = 0; st < 4; st++) {
    const sx = cx + 8.5 + st * 1.15;
    dhW4Stone.push(makeBox(1.10, 0.65, 2.2, sx, ctx.getHeight(sx, msZ) + 0.08, msZ));
  }
  // 1178-1180. Hùng Vương Museum Bronze Drum Plaza (cx - 14.5, cz + 36.5)
  const dpX = cx - 14.5;
  const dpZ = cz + 36.5;
  const dpY = Math.max(ctx.getHeight(dpX, dpZ), ctx.getHeight(dpX - 2.8, dpZ - 2.8), ctx.getHeight(dpX + 2.8, dpZ + 2.8));
  dhW4Stone.push(makeBox(6.2, 3.8, 6.2, dpX, dpY - 1.65, dpZ));
  dhW4Bronze.push(...createDongSonDrum3DParts(dpX, dpY + 0.25, dpZ, 1.15));
  for (const dx of [-2.4, 2.4]) {
    for (const dz of [-2.4, 2.4]) {
      dhW4Stone.push(
        makeBox(0.42, 1.05, 0.42, dpX + dx, dpY + 0.78, dpZ + dz),
        makeBox(0.56, 0.16, 0.56, dpX + dx, dpY + 1.38, dpZ + dz)
      );
    }
  }
  // 1181-1183, 1185. Festival banners, Đền Hạ benches, Chùa Thiên Quang censer & slope signpost
  for (const side of [-1, 1]) {
    const fY = ctx.getHeight(cx + side * 5.2, cz + 39.5);
    dhW4Wood.push(makeCylinder(0.04, 0.05, 4.0, 5, cx + side * 5.2, fY + 1.95, cz + 39.5));
    dhW4Crimson.push(makeBox(0.05, 1.35, 0.55, cx + side * 5.2, fY + 3.25, cz + 39.85));
    dhW4Stone.push(
      makeBox(1.65, 0.42, 0.52, cx + side * 8.5, ctx.getHeight(cx + side * 8.5, cz + 31.5) + 0.21, cz + 31.5),
      makeBox(1.65, 0.42, 0.52, cx + side * 8.5, ctx.getHeight(cx + side * 8.5, cz + 33.8) + 0.21, cz + 33.8)
    );
  }
  dhW4Bronze.push(
    makeCylinder(0.26, 0.20, 0.52, 6, cx - 12.2, ctqY + 0.58, dHaZ + 2.5),
    makeCylinder(0.06, 0.08, 2.15, 6, cx - 6.5, ctx.getHeight(cx - 6.5, cz + 16.5) + 1.08, cz + 16.5)
  );
  dhW4Gold.push(makeBox(0.88, 0.24, 0.10, cx - 6.1, ctx.getHeight(cx - 6.5, cz + 16.5) + 1.85, cz + 16.5));
  addMergedMesh(group, dhW4Stone, ctx.materials.lateriteHoneycomb ?? ctx.materials.stone, 'DenHungWave4Stone', false, true);
  addMergedMesh(group, dhW4Crimson, ctx.materials.crimsonLacquer, 'DenHungWave4Crimson', false, true);
  addMergedMesh(group, dhW4Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'DenHungWave4Wood', false, true);
  addMergedMesh(group, dhW4Roof, ctx.materials.terracottaRoof, 'DenHungWave4Roof', false, true);
  addMergedMesh(group, dhW4Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'DenHungWave4Bronze', false, true);
  addMergedMesh(group, dhW4Gold, ctx.materials.gold, 'DenHungWave4Gold', false, false);

  // 6E. ĐỀN HÙNG WAVE 5 VĂN LANG PAVILIONS & CEREMONIAL COURTYARDS (Items 1561..1580, castShadow = false, 0 new materials)
  const dhW5Stone: THREE.BufferGeometry[] = [];
  const dhW5Crimson: THREE.BufferGeometry[] = [];
  const dhW5Wood: THREE.BufferGeometry[] = [];
  const dhW5Roof: THREE.BufferGeometry[] = [];
  const dhW5Bronze: THREE.BufferGeometry[] = [];
  const dhW5Gold: THREE.BufferGeometry[] = [];

  // 1561-1564, 1568-1572, 1575-1576. Đình Văn Lang Đông (cx + 20.5, cz + 20.0) & Nhà Trống Đồng Tây (cx - 20.5, cz + 24.0)
  for (const [px, pz, isEast] of [[cx + 20.5, cz + 20.0, true], [cx - 20.5, cz + 24.0, false]] as const) {
    const py = Math.max(ctx.getHeight(px, pz), ctx.getHeight(px - 2.2, pz - 2.2), ctx.getHeight(px + 2.2, pz + 2.2));
    dhW5Stone.push(
      makeBox(4.8, 4.0, 4.8, px, py - 1.75, pz),
      makeBox(1.65, 0.42, 0.50, px, py + 0.46, pz + 3.0),
      makeBox(2.2, 0.36, 1.15, isEast ? px - 3.2 : px + 3.2, py + 0.18, pz + 2.2)
    );
    for (const dx of [-1.75, 1.75]) {
      for (const dz of [-1.75, 1.75]) {
        dhW5Crimson.push(makeCylinder(0.11, 0.13, 2.85, 6, px + dx, py + 1.60, pz + dz));
      }
    }
    dhW5Roof.push(makeBox(5.6, 0.36, 5.6, px, py + 3.12, pz));
    dhW5Crimson.push(
      makeCylinder(0.12, 0.12, 0.26, 6, px - 1.5, py + 2.75, pz + 1.5),
      makeCylinder(0.12, 0.12, 0.26, 6, px + 1.5, py + 2.75, pz + 1.5)
    );
    for (let st = 0; st < 4; st++) {
      const sx = isEast ? cx + 15.5 + st * 0.95 : cx - 15.5 - st * 0.95;
      dhW5Stone.push(makeBox(0.95, 0.65, 2.0, sx, ctx.getHeight(sx, pz) + 0.08, pz));
    }
    for (const dz of [-2.4, 2.4]) {
      const ly = ctx.getHeight(isEast ? px - 2.8 : px + 2.8, pz + dz);
      dhW5Stone.push(
        makeBox(0.40, 0.98, 0.40, isEast ? px - 2.8 : px + 2.8, ly + 0.49, pz + dz),
        makeBox(0.54, 0.16, 0.54, isEast ? px - 2.8 : px + 2.8, ly + 1.06, pz + dz)
      );
    }
    if (isEast) {
      dhW5Crimson.push(makeBox(1.55, 0.85, 0.72, px, py + 0.68, pz - 0.55));
      dhW5Bronze.push(makeCylinder(0.20, 0.15, 0.38, 6, px, py + 1.28, pz - 0.55));
    } else {
      dhW5Stone.push(makeBox(1.45, 0.52, 1.45, px, py + 0.50, pz));
      dhW5Bronze.push(...createDongSonDrum3DParts(px, py + 0.76, pz, 0.75));
    }
  }
  // 1565-1567, 1573-1574, 1577-1580. Chim Lạc totem pillars, censer, festival flags, legend stelae, gong rack, desk, bollards & signpost
  for (const side of [-1, 1]) {
    for (const tz of [cz + 22.0, cz + 26.0]) {
      const ty = ctx.getHeight(cx + side * 12.5, tz);
      dhW5Crimson.push(makeCylinder(0.14, 0.18, 3.25, 6, cx + side * 12.5, ty + 1.55, tz));
      dhW5Gold.push(makeBox(0.52, 0.42, 0.18, cx + side * 12.5, ty + 3.35, tz));
    }
    for (const fz of [cz + 18.0, cz + 28.0]) {
      const fy = ctx.getHeight(cx + side * 16.5, fz);
      dhW5Wood.push(makeCylinder(0.04, 0.05, 3.8, 5, cx + side * 16.5, fy + 1.85, fz));
      dhW5Crimson.push(makeBox(0.05, 1.25, 0.52, cx + side * 16.5, fy + 3.10, fz + 0.30));
      dhW5Stone.push(makeCylinder(0.14, 0.18, 0.68, 5, cx + side * 14.5, ctx.getHeight(cx + side * 14.5, fz) + 0.34, fz));
    }
  }
  dhW5Stone.push(
    makeBox(0.95, 1.55, 0.24, cx + 16.5, ctx.getHeight(cx + 16.5, cz + 24.0) + 0.78, cz + 24.0),
    makeBox(0.95, 1.55, 0.24, cx - 16.5, ctx.getHeight(cx - 16.5, cz + 20.0) + 0.78, cz + 20.0)
  );
  const gY = ctx.getHeight(cx + 18.5, cz + 23.5);
  dhW5Wood.push(
    makeBox(0.12, 1.90, 0.12, cx + 17.8, gY + 0.90, cz + 23.5),
    makeBox(0.12, 1.90, 0.12, cx + 19.2, gY + 0.90, cz + 23.5),
    makeBox(1.65, 0.14, 0.14, cx + 18.5, gY + 1.88, cz + 23.5),
    makeBox(1.15, 0.78, 0.58, cx - 18.5, ctx.getHeight(cx - 18.5, cz + 27.5) + 0.39, cz + 27.5)
  );
  dhW5Bronze.push(
    makeCylinder(0.28, 0.22, 0.56, 6, cx + 17.5, ctx.getHeight(cx + 17.5, cz + 20.0) + 0.28, cz + 20.0),
    makeCylinder(0.36, 0.36, 0.08, 6, cx + 18.5, gY + 1.28, cz + 23.5, Math.PI * 0.5),
    makeCylinder(0.06, 0.08, 2.15, 6, cx + 14.5, ctx.getHeight(cx + 14.5, cz + 22.0) + 1.08, cz + 22.0)
  );
  dhW5Gold.push(makeBox(0.88, 0.24, 0.10, cx + 14.9, ctx.getHeight(cx + 14.5, cz + 22.0) + 1.85, cz + 22.0));
  addMergedMesh(group, dhW5Stone, ctx.materials.lateriteHoneycomb ?? ctx.materials.stone, 'DenHungWave5Stone', false, true);
  addMergedMesh(group, dhW5Crimson, ctx.materials.crimsonLacquer, 'DenHungWave5Crimson', false, true);
  addMergedMesh(group, dhW5Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'DenHungWave5Wood', false, true);
  addMergedMesh(group, dhW5Roof, ctx.materials.terracottaRoof, 'DenHungWave5Roof', false, true);
  addMergedMesh(group, dhW5Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'DenHungWave5Bronze', false, true);
  addMergedMesh(group, dhW5Gold, ctx.materials.gold, 'DenHungWave5Gold', false, false);

  // =================================================================================================
  // ĐỀN HÙNG WAVE 6 (Items 1961..1980 — castShadow = false, 0 new materials)
  // =================================================================================================
  const dhW6Stone: THREE.BufferGeometry[] = [];
  const dhW6Crimson: THREE.BufferGeometry[] = [];
  const dhW6Wood: THREE.BufferGeometry[] = [];
  const dhW6Roof: THREE.BufferGeometry[] = [];
  const dhW6Bronze: THREE.BufferGeometry[] = [];
  const dhW6Gold: THREE.BufferGeometry[] = [];

  // 1961-1968, 1972, 1974, 1977, 1979-1980. Ceremonial Drum Hall (+25.5, +14.5) & Gong Hall (-25.5, +14.5)
  for (const side of [-1, 1]) {
    const hx = cx + side * 25.5;
    const hz = cz + 14.5;
    const hy = Math.max(ctx.getHeight(hx, hz), ctx.getHeight(hx - 2.0, hz - 2.0), ctx.getHeight(hx + 2.0, hz + 2.0));
    dhW6Stone.push(
      makeBox(4.4, 3.0, 4.4, hx, hy - 1.30, hz),
      makeBox(1.10, 0.55, 2.0, cx + side * 22.8, ctx.getHeight(cx + side * 22.8, hz) + 0.12, hz),
      makeBox(1.85, 0.34, 1.15, cx + side * 23.0, ctx.getHeight(cx + side * 23.0, cz + 11.5) + 0.17, cz + 11.5)
    );
    for (const dx of [-1.65, 1.65]) {
      for (const dz of [-1.65, 1.65]) {
        dhW6Crimson.push(makeCylinder(0.10, 0.12, 2.75, 4, hx + dx, hy + 1.48, hz + dz));
      }
    }
    dhW6Roof.push(makeBox(5.0, 0.32, 5.0, hx, hy + 2.94, hz));
    dhW6Crimson.push(makeBox(0.20, 0.26, 0.20, hx, hy + 2.62, hz));
    dhW6Bronze.push(makeCylinder(0.28, 0.22, 0.56, 4, cx + side * 22.2, ctx.getHeight(cx + side * 22.2, hz) + 0.28, hz));
    if (side === 1) {
      dhW6Wood.push(makeBox(1.45, 0.85, 0.82, hx, hy + 0.62, hz));
      dhW6Crimson.push(makeCylinder(0.42, 0.42, 0.78, 5, hx, hy + 1.35, hz));
    } else {
      dhW6Wood.push(
        makeBox(0.12, 1.85, 0.12, hx - 0.65, hy + 1.12, hz),
        makeBox(0.12, 1.85, 0.12, hx + 0.65, hy + 1.12, hz),
        makeBox(1.55, 0.14, 0.14, hx, hy + 2.08, hz)
      );
      dhW6Bronze.push(makeCylinder(0.40, 0.40, 0.08, 5, hx, hy + 1.48, hz, Math.PI * 0.5));
    }
    for (const lz of [cz + 11.2, cz + 17.8]) {
      const ly = ctx.getHeight(hx, lz);
      dhW6Stone.push(
        makeBox(0.38, 0.96, 0.38, hx, ly + 0.48, lz),
        makeBox(0.52, 0.16, 0.52, hx, ly + 1.04, lz),
        makeCylinder(0.13, 0.16, 0.66, 4, cx + side * 28.5, ctx.getHeight(cx + side * 28.5, lz) + 0.33, lz)
      );
    }
    for (const fz of [cz + 12.5, cz + 16.5]) {
      const fy = ctx.getHeight(cx + side * 28.0, fz);
      dhW6Wood.push(makeCylinder(0.04, 0.05, 3.6, 4, cx + side * 28.0, fy + 1.72, fz));
      dhW6Crimson.push(makeBox(0.05, 1.15, 0.48, cx + side * 28.0, fy + 2.95, fz + 0.28));
    }

    // 1969-1971, 1973, 1975-1976, 1978. Stone Trail Rest Pavilions (±16.5, +34.0)
    const rx = cx + side * 16.5;
    const rz = cz + 34.0;
    const ry = Math.max(ctx.getHeight(rx, rz), ctx.getHeight(rx - 1.8, rz - 1.8), ctx.getHeight(rx + 1.8, rz + 1.8));
    dhW6Stone.push(
      makeBox(3.8, 2.8, 3.8, rx, ry - 1.20, rz),
      makeBox(1.55, 0.42, 0.50, rx, ry + 0.41, rz),
      makeBox(0.92, 1.50, 0.24, cx + side * 19.5, ctx.getHeight(cx + side * 19.5, rz) + 0.75, rz),
      makeCylinder(0.48, 0.30, 0.60, 4, cx + side * 13.5, ctx.getHeight(cx + side * 13.5, rz) + 0.30, rz)
    );
    for (const dx of [-1.45, 1.45]) {
      for (const dz of [-1.45, 1.45]) {
        dhW6Crimson.push(makeCylinder(0.09, 0.11, 2.55, 4, rx + dx, ry + 1.38, rz + dz));
      }
    }
    dhW6Roof.push(makeBox(4.4, 0.28, 4.4, rx, ry + 2.74, rz));
    for (const lz of [cz + 31.2, cz + 36.8]) {
      const ly = ctx.getHeight(rx, lz);
      dhW6Stone.push(
        makeBox(0.38, 0.96, 0.38, rx, ly + 0.48, lz),
        makeBox(0.52, 0.16, 0.52, rx, ly + 1.04, lz)
      );
    }
  }
  dhW6Bronze.push(makeCylinder(0.05, 0.07, 2.15, 4, cx + 21.5, ctx.getHeight(cx + 21.5, cz + 17.5) + 1.08, cz + 17.5));
  dhW6Gold.push(makeBox(0.84, 0.24, 0.08, cx + 21.9, ctx.getHeight(cx + 21.5, cz + 17.5) + 1.85, cz + 17.5));

  addMergedMesh(group, dhW6Stone, ctx.materials.lateriteHoneycomb ?? ctx.materials.stone, 'DenHungWave6Stone', false, true);
  addMergedMesh(group, dhW6Crimson, ctx.materials.crimsonLacquer, 'DenHungWave6Crimson', false, true);
  addMergedMesh(group, dhW6Wood, ctx.materials.darkIronwood ?? ctx.materials.darkWood, 'DenHungWave6Wood', false, true);
  addMergedMesh(group, dhW6Roof, ctx.materials.terracottaRoof, 'DenHungWave6Roof', false, true);
  addMergedMesh(group, dhW6Bronze, ctx.materials.bronzePatina ?? ctx.materials.bronze, 'DenHungWave6Bronze', false, true);
  addMergedMesh(group, dhW6Gold, ctx.materials.gold, 'DenHungWave6Gold', false, false);
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

  const mossyKarstMat = ctx.materials.granite;

  const karstJungleMat =
    ctx.materialLib?.getOrCreateStandard({ color: '#2b5e28', roughness: 0.80, side: THREE.DoubleSide }) ??
    ctx.materials.darkWood;

  const goldenCornMat = ctx.materials.yellowOchrePlaster;
  const brocadeClothMat = ctx.materials.crimsonLacquer;

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

    // FIX MCC-03: Louvered shuttered windows with lower vertical wooden balusters (*chấn song*) & wide-open 75° shutters (ref 77!)
    const winX = -1.85;
    localVoid.push(makeBox(1.15, 1.05, 0.18, winX, deckY + 1.58, frontZ + 0.02));
    localWood.push(makeBox(1.32, 0.12, 0.22, winX, deckY + 1.04, frontZ + 0.06));
    localWood.push(makeBox(1.32, 0.12, 0.22, winX, deckY + 2.12, frontZ + 0.06));
    // Lower half vertical wooden window balusters (*chấn song gỗ*)
    for (let wb = -2; wb <= 2; wb++) {
      localWood.push(makeBox(0.055, 0.56, 0.06, winX + wb * 0.22, deckY + 1.34, frontZ + 0.05));
    }
    localWood.push(makeBox(1.22, 0.06, 0.08, winX, deckY + 1.62, frontZ + 0.06));
    for (const sSide of [-1, 1]) {
      localWood.push(
        makeBox(0.54, 1.02, 0.08, winX + sSide * 0.78, deckY + 1.58, frontZ + 0.26, sSide * -1.15)
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
    // FIX MCC-04: Levelled earthen/stone under-stilt courtyard pad, 2-step concrete landing, low bamboo yard fence & crimson celosia blooms (ref 77!)
    const yardPadY = maxGroundY - 0.18;
    localStone.push(makeBox(10.6, 0.85, 8.2, 0, yardPadY - 0.32, 0.4));
    // 2-step concrete landing pad at bottom of timber staircase
    localStone.push(
      makeBox(2.15, 0.34, 1.35, stairMidX, botGroundY + 0.42, stairBotZ + 0.55),
      makeBox(2.35, 0.24, 0.75, stairMidX, botGroundY + 0.20, stairBotZ + 1.38)
    );
    // Low woven bamboo fence bordering front-left yard + crimson celosia (*hoa mào gà*) flower clusters
    localWood.push(
      ...createPiercedBalustradeParts(-5.2, 4.8, 0.8, 4.8, yardPadY + 0.08, 0.78, 'bamboo_x')
    );
    for (const fx of [-4.4, -3.1, -1.6, -0.2]) {
      localBrocade.push(new THREE.SphereGeometry(0.24, 5, 4).translate(fx, yardPadY + 0.36, 4.35));
    }

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

    // FIX MCC-03: Authentic Thai 4-slope Turtle-Shell Hipped-Gambrel Thatch Roof (*mái mai rùa*) with true flat 6.2m ridge!
    const roofBaseY = deckY + 2.65;
    const roofH = 3.35;
    const roofCenterZ = -0.20;
    const roof = createHueImperialHipRoofGeometry(11.6, 9.6, 6.2, 0.36, roofH, 0.06, 8, 5, false);
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

    // Authentic crossed **Khau Cút** wooden gable finials seated FLUSH on both ends of the 6.2m ridge (`x = ±3.05, y = ridgeTopY - 0.05`)!
    const ridgeTopY = roofBaseY + roofH;
    localWood.push(
      ...createKhauCutGableParts(-3.05, ridgeTopY - 0.05, roofCenterZ, 0.92, Math.PI * 0.5),
      ...createKhauCutGableParts(3.05, ridgeTopY - 0.05, roofCenterZ, 0.92, Math.PI * 0.5)
    );

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
  // 3. MÙ CANG CHẢI & HẠ LONG QC EXPANSIONS (Items 194..200)
  // 194. Two iconic Hmong Chòi Canh Lúa thatched bamboo lookout huts on terraced ridges (deep downhill stilts reaching roof eaves!)
  for (const [hx, hz] of [[-128, -262], [-152, -284]] as const) {
    const hy = Math.max(
      ctx.getHeight(hx, hz),
      ctx.getHeight(hx - 1.1, hz - 1.1),
      ctx.getHeight(hx + 1.1, hz - 1.1),
      ctx.getHeight(hx - 1.1, hz + 1.1),
      ctx.getHeight(hx + 1.1, hz + 1.1)
    );
    for (const dx of [-1.1, 1.1]) {
      for (const dz of [-1.1, 1.1]) {
        timberParts.push(makeCylinder(0.07, 0.08, 5.2, 6, hx + dx, hy + 0.25, hz + dz));
      }
    }
    timberParts.push(makeBox(2.8, 0.14, 2.8, hx, hy + 1.45, hz));
    roofParts.push(createGableRoofGeometry(3.4, 3.4, 1.25).translate(hx, hy + 2.75, hz));
  }
  // 195-198. Guồng Nước Tre bamboo waterwheel, Cổng Chào Bản Thái (own ground height!), Cầu Tre bamboo bridge (with bank support posts!), Đống Rơm Vàng haystacks
  const gwX = -142.0;
  const gwZ = -246.0;
  const gwY = ctx.getHeight(gwX, gwZ);
  const gateThaiY = ctx.getHeight(-133, -238);
  const brTreY = ctx.getHeight(-138, -252);
  timberParts.push(
    makeCylinder(1.45, 1.45, 0.28, 12, gwX, gwY + 1.55, gwZ, 0, 0, Math.PI * 0.5),
    makeBox(0.22, 2.8, 0.22, gwX - 0.35, gwY + 0.8, gwZ),
    makeBox(0.22, 2.8, 0.22, gwX + 0.35, gwY + 0.8, gwZ),
    // Cổng Chào Bản Thái
    makeBox(0.22, 3.8, 0.22, -135, gateThaiY + 1.55, -238),
    makeBox(0.22, 3.8, 0.22, -131, gateThaiY + 1.55, -238),
    makeBox(4.6, 0.32, 0.32, -133, gateThaiY + 3.45, -238),
    // Cầu Tre bamboo footbridge with 4 bank support posts
    makeBox(4.8, 0.14, 1.15, -138, brTreY + 0.35, -252),
    makeCylinder(0.08, 0.09, 2.2, 5, -140.1, brTreY - 0.65, -252.5),
    makeCylinder(0.08, 0.09, 2.2, 5, -140.1, brTreY - 0.65, -251.5),
    makeCylinder(0.08, 0.09, 2.2, 5, -135.9, brTreY - 0.65, -252.5),
    makeCylinder(0.08, 0.09, 2.2, 5, -135.9, brTreY - 0.65, -251.5)
  );
  // Đống Rơm Vàng haystacks & woven thúng mủng baskets
  for (const [rx, rz] of [[-126, -242], [-122, -245]] as const) {
    const ry = ctx.getHeight(rx, rz);
    cornParts.push(makeCylinder(0.25, 1.15, 1.65, 8, rx, ry + 0.72, rz));
  }
  // 199-200. Thuyền Buồm Cánh Dơi Hạ Long bat-wing junk boats (with wooden masts!) & floating Làng Chài fishing raft hut (with 4 corner posts supporting roof!)
  for (const [jx, jz] of [[245, -365], [275, -385]] as const) {
    timberParts.push(
      makeBox(1.8, 0.65, 5.2, jx, 0.35, jz, 0.35),
      makeCylinder(0.07, 0.10, 4.1, 6, jx, 2.25, jz)
    );
    roofParts.push(makeBox(0.08, 3.6, 2.8, jx, 2.4, jz, 0.35));
  }
  timberParts.push(makeBox(4.4, 0.24, 3.6, 258, 0.22, -352));
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.35, 1.35]) {
      timberParts.push(makeBox(0.14, 1.85, 0.14, 258 + dx, 1.12, -352 + dz));
    }
  }
  roofParts.push(createGableRoofGeometry(3.8, 3.2, 1.05).translate(258, 1.95, -352));

  tagMotifIds(group, ['HV-NEW-MB-06', 'HV-NEW-MB-07', 'HV-NEW-MB-08']);

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

  // 3B. MÙ CANG CHẢI & HẠ LONG WAVE 2 REAL-WORLD DETAILS (Items 391..400, castShadow = false, 0 new materials)
  const nlW2Stone: THREE.BufferGeometry[] = [];
  const nlW2Wood: THREE.BufferGeometry[] = [];
  const nlW2Roof: THREE.BufferGeometry[] = [];
  const nlW2Corn: THREE.BufferGeometry[] = [];
  const nlW2Brocade: THREE.BufferGeometry[] = [];
  // 391-392. Split-bamboo terraced irrigation channels (máng tre) & water-powered rice-pounding tilt-hammer (cối giã gạo nước)
  for (let ch = 0; ch < 3; ch++) {
    const cxCh = gwX - 2.5 - ch * 2.8;
    const czCh = gwZ - 1.5 - ch * 2.2;
    const cyCh = ctx.getHeight(cxCh, czCh);
    nlW2Wood.push(
      makeCylinder(0.08, 0.08, 3.2, 5, cxCh, cyCh + 0.65, czCh, 0, Math.PI * 0.45, 0.42),
      makeBox(0.08, 0.85, 0.08, cxCh, cyCh + 0.35, czCh)
    );
  }
  nlW2Wood.push(
    makeBox(2.4, 0.14, 0.14, gwX + 2.2, gwY + 0.85, gwZ, 0.15),
    makeBox(0.16, 0.95, 0.16, gwX + 2.2, gwY + 0.48, gwZ)
  );
  nlW2Stone.push(makeCylinder(0.32, 0.36, 0.42, 6, gwX + 3.2, gwY + 0.21, gwZ));
  // 393-396. Bản Thái brocade stall (with stone skirt!), tripod harvest-drying racks, buffalo pen & stone trough (with skirt!), stepped fieldstone footpath
  const stY = Math.max(ctx.getHeight(-129.0, -238.0), ctx.getHeight(-130.0, -238.8), ctx.getHeight(-128.0, -237.2));
  nlW2Stone.push(makeBox(2.4, 2.4, 2.0, -129.0, stY - 1.15, -238.0));
  nlW2Wood.push(
    makeBox(0.09, 2.25, 0.09, -130.0, stY + 1.05, -238.8),
    makeBox(0.09, 2.25, 0.09, -128.0, stY + 1.05, -238.8),
    makeBox(0.09, 2.25, 0.09, -130.0, stY + 1.05, -237.2),
    makeBox(0.09, 2.25, 0.09, -128.0, stY + 1.05, -237.2),
    makeBox(1.85, 0.65, 0.65, -129.0, stY + 0.32, -238.0)
  );
  nlW2Brocade.push(makeBox(2.2, 0.16, 1.9, -129.0, stY + 2.15, -238.0));
  for (const [rx, rz] of [[-132, -256], [-145, -264]] as const) {
    const ry = ctx.getHeight(rx, rz);
    nlW2Wood.push(
      makeBox(2.2, 0.10, 0.10, rx, ry + 1.35, rz),
      makeBox(0.10, 1.85, 0.10, rx - 1.05, ry + 0.50, rz),
      makeBox(0.10, 1.85, 0.10, rx + 1.05, ry + 0.50, rz)
    );
    nlW2Corn.push(makeBox(1.9, 0.52, 0.38, rx, ry + 1.12, rz));
  }
  const bpY = Math.max(ctx.getHeight(-148.0, -236.0), ctx.getHeight(-150.1, -234.5), ctx.getHeight(-145.9, -237.5));
  nlW2Stone.push(makeBox(4.6, 2.8, 3.4, -148.0, bpY - 1.35, -236.0));
  nlW2Wood.push(
    makeBox(4.2, 0.95, 0.14, -148.0, bpY + 0.48, -234.5),
    makeBox(4.2, 0.95, 0.14, -148.0, bpY + 0.48, -237.5),
    makeBox(0.14, 0.95, 3.0, -150.1, bpY + 0.48, -236.0)
  );
  nlW2Stone.push(makeBox(1.35, 0.45, 0.62, -147.2, bpY + 0.22, -236.0));
  for (let st = 0; st < 5; st++) {
    const fx = -139.0 - st * 1.6;
    const fz = -249.0 + st * 1.8;
    nlW2Stone.push(makeBox(1.45, 0.65, 0.85, fx, ctx.getHeight(fx, fz) - 0.15, fz, 0.45));
  }
  // 397-400. Hạ Long floating pearl-farming cages, Làng Chài timber gangplank, 2 moored fishing sampans & mini karst navigation beacon
  for (const [cxF, czF] of [[264.0, -352.0], [264.0, -357.0]] as const) {
    nlW2Wood.push(makeBox(3.4, 0.16, 2.8, cxF, 0.16, czF));
    nlW2Corn.push(makeCylinder(0.18, 0.18, 0.32, 5, cxF - 1.5, 0.24, czF - 1.2));
  }
  nlW2Wood.push(
    makeBox(3.6, 0.14, 0.95, 260.8, 0.24, -352.0),
    makeBox(1.15, 0.36, 3.2, 253.5, 0.22, -352.5, 0.22),
    makeBox(1.15, 0.36, 3.2, 254.2, 0.22, -356.2, -0.18)
  );
  nlW2Stone.push(makeCylinder(0.65, 0.85, 2.6, 6, -245.0 + 18.0, 2.3, -480.0 + 16.0));
  nlW2Roof.push(new THREE.ConeGeometry(0.75, 0.95, 6).translate(-245.0 + 18.0, 4.00, -480.0 + 16.0));

  addMergedMesh(group, nlW2Stone, ctx.materials.stone, 'NorthLandscapeWave2Stone', false, true);
  addMergedMesh(group, nlW2Wood, ctx.materials.darkWood, 'NorthLandscapeWave2Wood', false, true);
  addMergedMesh(group, nlW2Roof, ctx.materials.thatchFiber ?? ctx.materials.darkRoof, 'NorthLandscapeWave2Roof', false, true);
  addMergedMesh(group, nlW2Corn, goldenCornMat, 'NorthLandscapeWave2Corn', false, true);
  addMergedMesh(group, nlW2Brocade, brocadeClothMat, 'NorthLandscapeWave2Brocade', false, true);

  // 3C. MÙ CANG CHẢI HMONG VILLAGE CLUSTER, WATERMILLS & HẠ LONG WAVE 3 DETAILS (Items 781..800, castShadow = false, 0 new materials)
  const nlW3Stone: THREE.BufferGeometry[] = [];
  const nlW3Wood: THREE.BufferGeometry[] = [];
  const nlW3Roof: THREE.BufferGeometry[] = [];
  const nlW3Corn: THREE.BufferGeometry[] = [];
  const nlW3Brocade: THREE.BufferGeometry[] = [];

  // 781-782. 2 H'Mong highland rammed-earth cottages (-158, -252 & -164, -244, deep hillside skirts!) & dry-stone yard fences
  for (const [hx, hz, rot] of [[-158.0, -252.0, 0.28], [-164.0, -244.0, -0.35]] as const) {
    const hy = Math.max(
      ctx.getHeight(hx, hz),
      ctx.getHeight(hx - 2.8, hz - 2.2),
      ctx.getHeight(hx + 2.8, hz - 2.2),
      ctx.getHeight(hx - 2.8, hz + 2.2),
      ctx.getHeight(hx + 2.8, hz + 2.2)
    );
    nlW3Stone.push(
      makeBox(6.2, 4.0, 4.8, hx, hy - 1.75, hz, rot),
      makeBox(7.2, 0.85, 0.36, hx, hy + 0.65, hz + 3.2, rot)
    );
    nlW3Corn.push(makeBox(5.4, 2.55, 4.0, hx, hy + 1.52, hz, rot));
    nlW3Roof.push(createGableRoofGeometry(6.4, 5.0, 1.65).rotateY(rot).translate(hx, hy + 2.82, hz));
  }

  // 783-785. Twin bamboo waterwheel, watermill shelter hut (deep hillside skirt!) & elevated bamboo aqueduct
  const gw2X = gwX + 4.8;
  const gw2Z = gwZ - 3.5;
  const gw2Y = ctx.getHeight(gw2X, gw2Z);
  nlW3Wood.push(
    makeCylinder(1.25, 1.25, 0.24, 8, gw2X, gw2Y + 1.35, gw2Z, 0, 0, Math.PI * 0.5),
    makeBox(0.18, 2.6, 0.18, gw2X - 0.32, gw2Y + 0.75, gw2Z),
    makeBox(0.18, 2.6, 0.18, gw2X + 0.32, gw2Y + 0.75, gw2Z)
  );
  const wmY = Math.max(ctx.getHeight(gwX + 2.6, gwZ), ctx.getHeight(gwX + 1.2, gwZ - 1.2), ctx.getHeight(gwX + 4.0, gwZ + 1.2));
  nlW3Stone.push(makeBox(3.4, 3.2, 2.8, gwX + 2.6, wmY - 1.45, gwZ));
  for (const dx of [-1.25, 1.25]) {
    for (const dz of [-1.05, 1.05]) {
      nlW3Wood.push(makeBox(0.10, 2.35, 0.10, gwX + 2.6 + dx, wmY + 1.25, gwZ + dz));
    }
  }
  nlW3Roof.push(makeBox(3.9, 0.28, 3.3, gwX + 2.6, wmY + 2.42, gwZ));
  const aqMidY = ctx.getHeight(gwX - 6.5, gwZ - 5.0);
  nlW3Wood.push(
    makeCylinder(0.08, 0.08, 5.2, 5, gwX - 6.5, aqMidY + 1.25, gwZ - 5.0, 0, Math.PI * 0.48, 0.32),
    makeBox(0.10, 2.4, 0.10, gwX - 8.2, aqMidY + 0.20, gwZ - 5.5),
    makeBox(0.10, 2.4, 0.10, gwX - 4.8, aqMidY + 0.20, gwZ - 4.5)
  );

  // 786-789. 8 stepped fieldstone terraced walkways + bamboo handrail + Golden Harvest lookout deck (deep stilts reaching roof!) & bamboo bench
  for (let tw = 0; tw < 8; tw++) {
    const tx = -148.0 + tw * 2.1;
    const tz = -256.0 - tw * 1.1;
    const ty = ctx.getHeight(tx, tz);
    nlW3Stone.push(makeBox(1.65, 0.72, 1.05, tx, ty - 0.10, tz, -0.45));
    if (tw % 2 === 0) {
      nlW3Wood.push(makeCylinder(0.04, 0.05, 1.45, 5, tx, ty + 0.42, tz + 0.68));
    }
  }
  const lkX = -140.0;
  const lkZ = -274.0;
  const lkY = Math.max(ctx.getHeight(lkX, lkZ), ctx.getHeight(lkX - 1.8, lkZ - 1.8), ctx.getHeight(lkX + 1.8, lkZ + 1.8));
  for (const dx of [-1.6, 1.6]) {
    for (const dz of [-1.4, 1.4]) {
      nlW3Wood.push(makeCylinder(0.09, 0.11, 5.8, 6, lkX + dx, lkY + 0.45, lkZ + dz));
    }
  }
  nlW3Wood.push(
    makeBox(3.8, 0.18, 3.4, lkX, lkY + 1.35, lkZ),
    makeBox(1.45, 0.44, 0.52, lkX, lkY + 1.66, lkZ)
  );
  nlW3Roof.push(createGableRoofGeometry(4.4, 4.0, 1.35).translate(lkX, lkY + 3.25, lkZ));

  // 790-796. Elevated rice granary (deep stilts reaching roof!), brocade drying rack, outdoor village hearth, entrance shade tree, 2nd bamboo footbridge (with bank posts!), winnowing trays & scenic monument marker
  const grX = -153.0;
  const grZ = -246.0;
  const grY = Math.max(ctx.getHeight(grX, grZ), ctx.getHeight(grX - 1.2, grZ - 1.2), ctx.getHeight(grX + 1.2, grZ + 1.2));
  for (const dx of [-1.1, 1.1]) {
    for (const dz of [-0.95, 0.95]) {
      nlW3Wood.push(makeBox(0.11, 4.6, 0.11, grX + dx, grY + 0.15, grZ + dz));
    }
  }
  nlW3Wood.push(makeBox(2.6, 1.65, 2.2, grX, grY + 1.55, grZ));
  nlW3Roof.push(createGableRoofGeometry(3.2, 2.8, 0.95).translate(grX, grY + 2.38, grZ));
  const brkY = ctx.getHeight(-160.0, -248.0);
  const br2Y = ctx.getHeight(-146.0, -247.0);
  nlW3Wood.push(
    makeBox(0.08, 1.95, 0.08, -161.1, brkY + 0.72, -248.0),
    makeBox(0.08, 1.95, 0.08, -158.9, brkY + 0.72, -248.0),
    makeBox(2.4, 0.08, 0.08, -160.0, brkY + 1.68, -248.0),
    // 793-794. Entrance shade tree trunk & 2nd bamboo footbridge with bank support posts
    makeCylinder(0.14, 0.22, 3.1, 6, -127.0, ctx.getHeight(-127.0, -236.0) + 1.25, -236.0),
    makeBox(4.4, 0.16, 1.15, -146.0, br2Y + 0.32, -247.0, 0.25),
    makeCylinder(0.08, 0.09, 2.2, 5, -147.8, br2Y - 0.65, -247.5),
    makeCylinder(0.08, 0.09, 2.2, 5, -144.2, br2Y - 0.65, -246.5)
  );
  nlW3Brocade.push(
    makeBox(1.95, 0.88, 0.06, -160.0, brkY + 1.18, -248.0),
    new THREE.DodecahedronGeometry(1.15, 0).translate(-127.0, ctx.getHeight(-127.0, -236.0) + 2.95, -236.0)
  );
  nlW3Stone.push(
    makeCylinder(0.48, 0.56, 0.36, 6, -134.0, ctx.getHeight(-134.0, -242.0) + 0.18, -242.0),
    makeBox(1.05, 1.85, 0.28, -136.0, ctx.getHeight(-136.0, -240.0) + 0.52, -240.0)
  );
  for (let tr = 0; tr < 4; tr++) {
    const tx = -156.5 + (tr % 2) * 1.1;
    const tz = -249.5 + Math.floor(tr / 2) * 1.1;
    const trY = ctx.getHeight(tx, tz);
    nlW3Wood.push(makeCylinder(0.16, 0.22, 0.55, 5, tx, trY + 0.08, tz));
    nlW3Corn.push(makeCylinder(0.44, 0.40, 0.10, 6, tx, trY + 0.38, tz));
  }

  // 797-800. Hạ Long 2nd floating fishing raft house, pontoon catwalk, net-drying frame & twin channel marker buoys
  nlW3Wood.push(
    makeBox(4.2, 0.24, 3.4, 264.5, 0.22, -346.5),
    makeBox(3.8, 0.16, 0.95, 261.2, 0.24, -349.2, -0.68),
    makeBox(0.09, 1.65, 0.09, 256.8, 1.02, -350.8),
    makeBox(0.09, 1.65, 0.09, 259.2, 1.02, -350.8),
    makeBox(2.6, 0.09, 0.09, 258.0, 1.82, -350.8)
  );
  for (const dx of [-1.55, 1.55]) {
    for (const dz of [-1.25, 1.25]) {
      nlW3Wood.push(makeBox(0.13, 1.85, 0.13, 264.5 + dx, 1.12, -346.5 + dz));
    }
  }
  nlW3Roof.push(createGableRoofGeometry(3.6, 3.0, 1.00).translate(264.5, 1.96, -346.5));
  nlW3Brocade.push(makeBox(2.2, 1.05, 0.06, 258.0, 1.28, -350.8));
  for (const [bx, bz] of [[248.0, -358.0], [268.0, -362.0]] as const) {
    nlW3Stone.push(makeCylinder(0.42, 0.52, 0.65, 6, bx, 0.25, bz));
    nlW3Brocade.push(new THREE.ConeGeometry(0.32, 0.85, 5).translate(bx, 0.92, bz));
  }

  addMergedMesh(group, nlW3Stone, ctx.materials.stone, 'NorthLandscapeWave3Stone', false, true);
  addMergedMesh(group, nlW3Wood, ctx.materials.darkWood, 'NorthLandscapeWave3Wood', false, true);
  addMergedMesh(group, nlW3Roof, ctx.materials.thatchFiber ?? ctx.materials.darkRoof, 'NorthLandscapeWave3Roof', false, true);
  addMergedMesh(group, nlW3Corn, goldenCornMat, 'NorthLandscapeWave3Corn', false, true);
  addMergedMesh(group, nlW3Brocade, brocadeClothMat, 'NorthLandscapeWave3Brocade', false, true);

  // 3D. MÙ CANG CHẢI & HẠ LONG BAY WAVE 4 EXPANSION (Items 1186..1200, castShadow = false, 0 new materials)
  const nlW4Stone: THREE.BufferGeometry[] = [];
  const nlW4Wood: THREE.BufferGeometry[] = [];
  const nlW4Roof: THREE.BufferGeometry[] = [];
  const nlW4Corn: THREE.BufferGeometry[] = [];
  const nlW4Brocade: THREE.BufferGeometry[] = [];

  // 1186-1187, 1191-1192. 3rd Hmong rammed-earth cottage (-170.5, -252.0), grain-winnowing terrace, haystacks & stone curb
  const h3X = -170.5;
  const h3Z = -252.0;
  const h3Y = Math.max(ctx.getHeight(h3X, h3Z), ctx.getHeight(h3X - 2.8, h3Z - 2.2), ctx.getHeight(h3X + 2.8, h3Z + 2.2));
  nlW4Stone.push(
    makeBox(6.2, 4.0, 4.8, h3X, h3Y - 1.75, h3Z, 0.22),
    makeBox(5.2, 3.2, 4.2, h3X, h3Y - 1.45, -246.5),
    makeBox(5.4, 0.52, 0.28, h3X, h3Y + 0.36, -244.4)
  );
  nlW4Corn.push(
    makeBox(5.4, 2.55, 4.0, h3X, h3Y + 1.52, h3Z, 0.22),
    makeCylinder(0.24, 1.05, 1.55, 7, -167.5, ctx.getHeight(-167.5, -255.5) + 0.68, -255.5),
    makeCylinder(0.24, 1.05, 1.55, 7, -173.5, ctx.getHeight(-173.5, -255.5) + 0.68, -255.5)
  );
  nlW4Roof.push(createGableRoofGeometry(6.4, 5.0, 1.65).rotateY(0.22).translate(h3X, h3Y + 2.82, h3Z));
  // 1188-1190, 1193. 3-tier bamboo water cascade, mountain trail rest arbor (-134.0, -268.0) & wooden rice mortar
  for (let b = 0; b < 3; b++) {
    const bx = -148.5 - b * 2.2;
    const bz = -251.5 - b * 1.4;
    const by = ctx.getHeight(bx, bz);
    nlW4Wood.push(
      makeCylinder(0.08, 0.08, 2.8, 5, bx, by + 0.95 - b * 0.15, bz, 0, Math.PI * 0.46, 0.38),
      makeBox(0.09, 1.65, 0.09, bx, by + 0.25, bz)
    );
  }
  const arX = -134.0;
  const arZ = -268.0;
  const arY = Math.max(ctx.getHeight(arX, arZ), ctx.getHeight(arX - 1.4, arZ - 1.4), ctx.getHeight(arX + 1.4, arZ + 1.4));
  for (const dx of [-1.35, 1.35]) {
    for (const dz of [-1.25, 1.25]) {
      nlW4Wood.push(makeCylinder(0.08, 0.10, 5.2, 6, arX + dx, arY + 0.35, arZ + dz));
    }
  }
  nlW4Wood.push(
    makeBox(3.2, 0.16, 2.9, arX, arY + 1.25, arZ),
    makeBox(1.35, 0.44, 0.48, arX, arY + 1.56, arZ),
    makeCylinder(0.26, 0.22, 0.62, 6, -130.5, ctx.getHeight(-130.5, -242.5) + 0.31, -242.5)
  );
  nlW4Roof.push(createGableRoofGeometry(3.8, 3.4, 1.15).translate(arX, arY + 2.88, arZ));
  // 1194-1200. Hạ Long Bay Oyster-Farm Raft Pier (271.5, -350.5), Pearl-Shop Raft House (271.5, -356.5), pontoon catwalk, 2 sampans, net rack, channel buoys & float drums
  nlW4Wood.push(
    makeBox(4.6, 0.22, 3.8, 271.5, 0.22, -350.5),
    makeBox(4.4, 0.24, 3.6, 271.5, 0.22, -356.5),
    makeBox(3.8, 0.16, 0.95, 268.0, 0.24, -351.5),
    makeBox(1.15, 0.34, 3.2, 275.2, 0.20, -352.0, 0.18),
    makeBox(1.15, 0.34, 3.2, 275.2, 0.20, -356.5, -0.22),
    makeBox(0.09, 1.65, 0.09, 270.2, 1.02, -347.8),
    makeBox(0.09, 1.65, 0.09, 272.8, 1.02, -347.8),
    makeBox(2.8, 0.09, 0.09, 271.5, 1.82, -347.8)
  );
  for (const dx of [-1.65, 1.65]) {
    for (const dz of [-1.35, 1.35]) {
      nlW4Wood.push(makeBox(0.13, 1.85, 0.13, 271.5 + dx, 1.12, -356.5 + dz));
      nlW4Corn.push(makeCylinder(0.20, 0.20, 0.36, 5, 271.5 + dx * 1.15, 0.18, -350.5 + dz * 1.15));
    }
  }
  nlW4Roof.push(createGableRoofGeometry(3.8, 3.2, 1.02).translate(271.5, 1.96, -356.5));
  nlW4Brocade.push(makeBox(2.4, 1.05, 0.06, 271.5, 1.28, -347.8));
  for (const [bx, bz] of [[252.0, -344.0], [274.0, -344.0]] as const) {
    nlW4Stone.push(makeCylinder(0.40, 0.50, 0.62, 6, bx, 0.24, bz));
    nlW4Brocade.push(new THREE.ConeGeometry(0.30, 0.82, 5).translate(bx, 0.88, bz));
  }
  addMergedMesh(group, nlW4Stone, ctx.materials.stone, 'NorthLandscapeWave4Stone', false, true);
  addMergedMesh(group, nlW4Wood, ctx.materials.darkWood, 'NorthLandscapeWave4Wood', false, true);
  addMergedMesh(group, nlW4Roof, ctx.materials.thatchFiber ?? ctx.materials.darkRoof, 'NorthLandscapeWave4Roof', false, true);
  addMergedMesh(group, nlW4Corn, goldenCornMat, 'NorthLandscapeWave4Corn', false, true);
  addMergedMesh(group, nlW4Brocade, brocadeClothMat, 'NorthLandscapeWave4Brocade', false, true);

  // 3E. MÙ CANG CHẢI IRRIGATION HUTS & HẠ LONG FLOATING VILLAGE WAVE 5 (Items 1581..1600, castShadow = false, 0 new materials)
  const nlW5Stone: THREE.BufferGeometry[] = [];
  const nlW5Wood: THREE.BufferGeometry[] = [];
  const nlW5Roof: THREE.BufferGeometry[] = [];
  const nlW5Corn: THREE.BufferGeometry[] = [];
  const nlW5Brocade: THREE.BufferGeometry[] = [];

  // 1581-1590. Mù Cang Chải Stilt Irrigation Watch-Hut (-154.0, -264.0), 3rd Bamboo Bridge, Chutes, Mini Waterwheel, Haystacks & Loom
  const ihX = -154.0;
  const ihZ = -264.0;
  const ihY = Math.max(ctx.getHeight(ihX, ihZ), ctx.getHeight(ihX - 1.5, ihZ - 1.5), ctx.getHeight(ihX + 1.5, ihZ + 1.5));
  for (const dx of [-1.35, 1.35]) {
    for (const dz of [-1.25, 1.25]) {
      nlW5Wood.push(makeCylinder(0.08, 0.10, 5.4, 6, ihX + dx, ihY + 0.40, ihZ + dz));
    }
  }
  nlW5Wood.push(
    makeBox(3.2, 0.18, 2.9, ihX, ihY + 1.30, ihZ),
    // 1582. 3rd Bamboo Footbridge (-142.0, -260.0)
    makeBox(4.2, 0.16, 1.15, -142.0, ctx.getHeight(-142.0, -260.0) + 0.32, -260.0, 0.22),
    makeCylinder(0.08, 0.09, 2.2, 5, -143.8, ctx.getHeight(-142.0, -260.0) - 0.65, -260.5),
    makeCylinder(0.08, 0.09, 2.2, 5, -140.2, ctx.getHeight(-142.0, -260.0) - 0.65, -259.5),
    // 1584. Mini Bamboo Waterwheel (-144.5, -258.5)
    makeCylinder(1.05, 1.05, 0.20, 6, -144.5, ctx.getHeight(-144.5, -258.5) + 1.15, -258.5, 0, 0, Math.PI * 0.5),
    makeBox(0.14, 2.2, 0.14, -144.8, ctx.getHeight(-144.5, -258.5) + 0.65, -258.5),
    makeBox(0.14, 2.2, 0.14, -144.2, ctx.getHeight(-144.5, -258.5) + 0.65, -258.5),
    // 1586, 1588, 1590. Grain drying rack, bamboo bench & H'Mong weaving loom
    makeBox(0.08, 1.80, 0.08, -157.5, ctx.getHeight(-156.5, -261.5) + 0.85, -261.5),
    makeBox(0.08, 1.80, 0.08, -155.5, ctx.getHeight(-156.5, -261.5) + 0.85, -261.5),
    makeBox(1.55, 0.42, 0.48, -140.5, ctx.getHeight(-140.5, -262.5) + 0.21, -262.5),
    makeBox(1.45, 1.25, 0.85, -167.5, ctx.getHeight(-167.5, -249.0) + 0.62, -249.0)
  );
  nlW5Roof.push(createGableRoofGeometry(3.8, 3.4, 1.20).translate(ihX, ihY + 3.05, ihZ));
  nlW5Corn.push(
    makeCylinder(0.24, 1.02, 1.50, 6, -157.5, ctx.getHeight(-157.5, -265.5) + 0.68, -265.5),
    makeCylinder(0.24, 1.02, 1.50, 6, -151.0, ctx.getHeight(-151.0, -267.0) + 0.68, -267.0),
    makeBox(1.90, 0.42, 0.24, -156.5, ctx.getHeight(-156.5, -261.5) + 1.42, -261.5)
  );
  nlW5Brocade.push(makeBox(1.15, 0.68, 0.08, -167.5, ctx.getHeight(-167.5, -249.0) + 0.95, -249.0));
  nlW5Stone.push(makeBox(0.95, 1.55, 0.24, -138.5, ctx.getHeight(-138.5, -261.0) + 0.78, -261.0));
  for (let b = 0; b < 3; b++) {
    const bx = -150.0 - b * 2.2;
    const bz = -260.0 - b * 1.2;
    const by = ctx.getHeight(bx, bz);
    nlW5Wood.push(
      makeCylinder(0.08, 0.08, 2.6, 5, bx, by + 0.90, bz, 0, Math.PI * 0.46, 0.35),
      makeBox(0.08, 1.55, 0.08, bx, by + 0.25, bz)
    );
  }
  for (let c = 0; c < 4; c++) {
    const cx2 = -148.0 - c * 2.0;
    const cz2 = -266.0 - c * 1.0;
    nlW5Stone.push(makeBox(2.2, 0.55, 0.36, cx2, ctx.getHeight(cx2, cz2) + 0.12, cz2, -0.32));
  }

  // 1591-1600. Hạ Long Cửa Vạn Cultural Raft House (264.5, -339.5), Catwalk, Fish Pens, Stone Beacon Pier (244.0, -352.0), Sampans & Buoys
  nlW5Wood.push(
    makeBox(4.8, 0.24, 3.8, 264.5, 0.22, -339.5),
    makeBox(1.05, 0.16, 4.2, 264.5, 0.24, -343.2),
    makeBox(3.4, 0.16, 2.8, 258.5, 0.16, -339.5),
    makeBox(3.4, 0.16, 2.8, 258.5, 0.16, -344.0),
    makeBox(1.15, 0.34, 3.2, 269.2, 0.20, -338.5, 0.16),
    makeBox(1.15, 0.34, 3.2, 269.5, 0.20, -342.0, -0.18),
    makeBox(0.09, 1.65, 0.09, 260.4, 1.02, -338.0),
    makeBox(0.09, 1.65, 0.09, 262.6, 1.02, -338.0),
    makeBox(2.4, 0.09, 0.09, 261.5, 1.82, -338.0)
  );
  for (const dx of [-1.85, 1.85]) {
    for (const dz of [-1.45, 1.45]) {
      nlW5Wood.push(
        makeBox(0.13, 1.90, 0.13, 264.5 + dx, 1.15, -339.5 + dz),
        makeCylinder(0.08, 0.09, 0.95, 5, 264.5 + dx * 1.25, 0.55, -339.5 + dz * 1.25)
      );
      nlW5Corn.push(makeCylinder(0.20, 0.20, 0.36, 5, 264.5 + dx * 1.15, 0.18, -339.5 + dz * 1.15));
    }
  }
  nlW5Corn.push(
    makeCylinder(0.20, 0.20, 0.36, 5, 264.5, 0.18, -337.6),
    makeCylinder(0.20, 0.20, 0.36, 5, 264.5, 0.18, -341.4)
  );
  nlW5Roof.push(
    createGableRoofGeometry(4.2, 3.4, 1.10).translate(264.5, 2.02, -339.5),
    new THREE.ConeGeometry(0.72, 0.95, 6).translate(244.0, 3.25, -352.0)
  );
  nlW5Brocade.push(makeBox(2.0, 1.00, 0.06, 261.5, 1.28, -338.0));
  // 1594. Stone Marine Beacon Pier (244.0, -352.0)
  nlW5Stone.push(
    makeCylinder(1.65, 1.85, 1.25, 6, 244.0, 0.45, -352.0),
    makeCylinder(0.55, 0.72, 2.25, 6, 244.0, 1.85, -352.0)
  );
  for (const [bx, bz] of [[246.0, -342.0], [270.0, -334.0]] as const) {
    nlW5Stone.push(makeCylinder(0.40, 0.50, 0.62, 6, bx, 0.24, bz));
    nlW5Brocade.push(new THREE.ConeGeometry(0.30, 0.82, 5).translate(bx, 0.88, bz));
  }
  addMergedMesh(group, nlW5Stone, ctx.materials.stone, 'NorthLandscapeWave5Stone', false, true);
  addMergedMesh(group, nlW5Wood, ctx.materials.darkWood, 'NorthLandscapeWave5Wood', false, true);
  addMergedMesh(group, nlW5Roof, ctx.materials.thatchFiber ?? ctx.materials.darkRoof, 'NorthLandscapeWave5Roof', false, true);
  addMergedMesh(group, nlW5Corn, goldenCornMat, 'NorthLandscapeWave5Corn', false, true);
  addMergedMesh(group, nlW5Brocade, brocadeClothMat, 'NorthLandscapeWave5Brocade', false, true);

  // 3F. MÙ CANG CHẢI RICE-DRYING DECKS & HẠ LONG FISHING PLATFORMS WAVE 6 (Items 1981..2000, castShadow = false, 0 new materials)
  const nlW6Stone: THREE.BufferGeometry[] = [];
  const nlW6Wood: THREE.BufferGeometry[] = [];
  const nlW6Roof: THREE.BufferGeometry[] = [];
  const nlW6Corn: THREE.BufferGeometry[] = [];
  const nlW6Brocade: THREE.BufferGeometry[] = [];

  // 1981-1990. Mù Cang Chải Rice-Drying Deck (-161.5, -262.0), 2nd Waterwheel (-160.0, -257.0), Chutes, Haystacks & Shed
  const rdX = -161.5;
  const rdZ = -262.0;
  const rdY = Math.max(ctx.getHeight(rdX, rdZ), ctx.getHeight(rdX - 1.5, rdZ - 1.5), ctx.getHeight(rdX + 1.5, rdZ + 1.5));
  for (const dx of [-1.45, 1.45]) {
    for (const dz of [-1.25, 1.25]) {
      nlW6Wood.push(makeCylinder(0.08, 0.09, 3.6, 4, rdX + dx, rdY - 0.55, rdZ + dz));
    }
  }
  nlW6Wood.push(
    makeBox(3.4, 0.16, 2.9, rdX, rdY + 1.25, rdZ),
    // 1982. 2nd Bamboo Waterwheel (-160.0, -257.0)
    makeCylinder(1.05, 1.05, 0.20, 5, -160.0, ctx.getHeight(-160.0, -257.0) + 1.15, -257.0, 0, 0, Math.PI * 0.5),
    makeBox(0.14, 2.2, 0.14, -160.3, ctx.getHeight(-160.0, -257.0) + 0.65, -257.0),
    makeBox(0.14, 2.2, 0.14, -159.7, ctx.getHeight(-160.0, -257.0) + 0.65, -257.0),
    // 1986-1988. Bench, brocade rack & wooden rice mortar
    makeBox(1.50, 0.42, 0.46, -158.5, ctx.getHeight(-158.5, -261.0) + 0.21, -261.0),
    makeBox(0.08, 1.75, 0.08, -164.8, ctx.getHeight(-164.0, -260.0) + 0.80, -260.0),
    makeBox(0.08, 1.75, 0.08, -163.2, ctx.getHeight(-164.0, -260.0) + 0.80, -260.0),
    makeCylinder(0.28, 0.22, 0.68, 4, -160.5, ctx.getHeight(-160.5, -264.5) + 0.34, -264.5)
  );
  nlW6Corn.push(
    makeBox(2.8, 0.12, 2.3, rdX, rdY + 1.38, rdZ),
    makeCylinder(0.22, 0.98, 1.45, 5, -164.0, ctx.getHeight(-164.0, -264.0) + 0.66, -264.0),
    makeCylinder(0.22, 0.98, 1.45, 5, -159.0, ctx.getHeight(-159.0, -265.0) + 0.66, -265.0)
  );
  nlW6Brocade.push(makeBox(1.45, 0.85, 0.06, -164.0, ctx.getHeight(-164.0, -260.0) + 1.22, -260.0));
  nlW6Stone.push(makeBox(0.90, 1.48, 0.22, -157.5, ctx.getHeight(-157.5, -258.5) + 0.74, -258.5));
  for (let b = 0; b < 2; b++) {
    const bx = -160.0 - b * 2.5;
    const bz = -258.5 - b * 1.5;
    const by = ctx.getHeight(bx, bz);
    nlW6Wood.push(
      makeCylinder(0.07, 0.07, 2.5, 4, bx, by + 0.88, bz, 0, Math.PI * 0.46, 0.32),
      makeBox(0.08, 1.50, 0.08, bx, by + 0.24, bz)
    );
  }
  for (let c = 0; c < 3; c++) {
    const cx2 = -158.5 - c * 2.5;
    nlW6Stone.push(makeBox(2.2, 0.52, 0.34, cx2, ctx.getHeight(cx2, -266.5) + 0.12, -266.5));
  }
  // 1989. Mini Stilt Grain Shed (-164.5, -257.5)
  const gsX = -164.5;
  const gsZ = -257.5;
  const gsY = Math.max(ctx.getHeight(gsX, gsZ), ctx.getHeight(gsX - 1.2, gsZ - 1.2), ctx.getHeight(gsX + 1.2, gsZ + 1.2));
  for (const dx of [-1.05, 1.05]) {
    for (const dz of [-0.95, 0.95]) {
      nlW6Wood.push(makeCylinder(0.07, 0.09, 4.4, 4, gsX + dx, gsY + 0.20, gsZ + dz));
    }
  }
  nlW6Wood.push(makeBox(2.4, 1.25, 2.2, gsX, gsY + 1.65, gsZ));
  nlW6Roof.push(createGableRoofGeometry(3.0, 2.7, 0.95).translate(gsX, gsY + 2.30, gsZ));

  // 1991-2000. Hạ Long Floating Fishing Platform (276.5, -341.0), Net Rack, Aquaculture Pens, Sampans & 2nd Karst Beacon (248.0, -358.0)
  nlW6Wood.push(
    makeBox(4.6, 0.22, 3.6, 276.5, 0.22, -341.0),
    makeBox(3.4, 0.16, 2.8, 276.5, 0.16, -345.5),
    makeBox(3.4, 0.16, 2.8, 281.0, 0.16, -341.0),
    makeBox(1.12, 0.32, 3.1, 272.5, 0.20, -337.5, 0.15),
    makeBox(1.12, 0.32, 3.1, 281.5, 0.20, -337.5, -0.15),
    makeBox(0.09, 1.65, 0.09, 275.4, 1.02, -340.5),
    makeBox(0.09, 1.65, 0.09, 277.6, 1.02, -340.5),
    makeBox(2.4, 0.09, 0.09, 276.5, 1.82, -340.5)
  );
  for (const dx of [-1.80, 1.80]) {
    for (const dz of [-1.40, 1.40]) {
      nlW6Wood.push(makeCylinder(0.08, 0.09, 0.95, 4, 276.5 + dx * 1.20, 0.55, -341.0 + dz * 1.20));
      nlW6Corn.push(makeCylinder(0.19, 0.19, 0.34, 4, 276.5 + dx * 1.15, 0.18, -341.0 + dz * 1.15));
    }
  }
  nlW6Corn.push(
    makeCylinder(0.19, 0.19, 0.34, 4, 276.5, 0.18, -339.2),
    makeCylinder(0.19, 0.19, 0.34, 4, 276.5, 0.18, -342.8)
  );
  nlW6Brocade.push(makeBox(2.0, 1.05, 0.06, 276.5, 1.28, -340.5));
  // 1999. 2nd Stone Karst Beacon Tower (248.0, -358.0)
  nlW6Stone.push(
    makeCylinder(1.60, 1.80, 1.20, 5, 248.0, 0.45, -358.0),
    makeCylinder(0.52, 0.68, 2.20, 5, 248.0, 1.82, -358.0)
  );
  nlW6Roof.push(new THREE.ConeGeometry(0.70, 0.92, 5).translate(248.0, 3.20, -358.0));
  for (const [bx, bz] of [[252.0, -350.0], [278.0, -334.0]] as const) {
    nlW6Stone.push(makeCylinder(0.38, 0.48, 0.60, 5, bx, 0.24, bz));
    nlW6Brocade.push(new THREE.ConeGeometry(0.28, 0.80, 4).translate(bx, 0.86, bz));
  }
  addMergedMesh(group, nlW6Stone, ctx.materials.stone, 'NorthLandscapeWave6Stone', false, true);
  addMergedMesh(group, nlW6Wood, ctx.materials.darkWood, 'NorthLandscapeWave6Wood', false, true);
  addMergedMesh(group, nlW6Roof, ctx.materials.thatchFiber ?? ctx.materials.darkRoof, 'NorthLandscapeWave6Roof', false, true);
  addMergedMesh(group, nlW6Corn, goldenCornMat, 'NorthLandscapeWave6Corn', false, true);
  addMergedMesh(group, nlW6Brocade, brocadeClothMat, 'NorthLandscapeWave6Brocade', false, true);

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
