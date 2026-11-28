import * as THREE from 'three';
import { VIETNAM_WATER_LEVEL } from '../shaders/vietnamHeritageShader';
import {
  VietnamBuilderContext,
  applyWorldBoxUV,
  clamp01,
  createArchedWallGeometry,
  createBronzeIncenseTripodParts,
  createGableRoofGeometry,
  createHueImperialHipRoofGeometry,
  createIncenseSmokeSystem,
  createLanternCapGeometry,
  createLanternCoreGeometry,
  createNotchedLotusPadGeometry,
  createRibbedLanternShellGeometry,
  createSculptedRockGeometry,
  mulberry32
} from './vietnamGeometryHelpers';
import {
  createAncientStoneLanternParts,
  createBasReliefPanelParts,
  createBronzeBellParts,
  createBronzeCraneOnTortoiseParts,
  createCarvedDragonBalustradeParts,
  createCarvedTurtleSteleParts,
  createCuaVongParts,
  createDoorStudGridParts,
  createGuardianBeastParts,
  createLotusPetalRingParts,
  createMotifBandParts,
  createRoofFinialSetParts,
  createSculptedDeityParts,
  createShouCharacterParts,
  createSmoothTaperedTubeGeometry,
  tagMotifIds
} from './vietnamMotifHelpers';
import {
  PartsBuilder,
  transformGeometryXYZ
} from '../vietnam/geometry/PartsBuilder';

export interface ThienMuThanhNhaHoBuildResult {
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>;
}

/**
 * Samples the maximum terrain elevation across an axis-aligned rectangular world footprint
 * so stepped terraces, embankments, and plazas never suffer terrain poke-through.
 */
function sampleMaxTerrainHeight(
  ctx: VietnamBuilderContext,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  stepsX = 5,
  stepsZ = 5
): number {
  let maxH = -Infinity;
  const nx = Math.max(2, stepsX);
  const nz = Math.max(2, stepsZ);
  for (let ix = 0; ix < nx; ix++) {
    const x = minX + ((maxX - minX) * ix) / (nx - 1);
    for (let iz = 0; iz < nz; iz++) {
      const z = minZ + ((maxZ - minZ) * iz) / (nz - 1);
      const h = ctx.getHeight(x, z);
      if (h > maxH) maxH = h;
    }
  }
  return Number.isFinite(maxH) ? maxH : 0;
}

/**
 * Finalizes a merged mesh with finite bounding volumes and strict shadow policy.
 */
function finalizeMesh(
  name: string,
  pb: PartsBuilder,
  material: THREE.Material,
  castShadow = false,
  worldBoxTileSize = 0
): THREE.Mesh | null {
  const geo = pb.buildGeometry();
  if (!geo) return null;
  if (worldBoxTileSize > 0) {
    applyWorldBoxUV(geo, worldBoxTileSize);
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Generates an octagonal or hexagonal curved Vietnamese pavilion/pagoda eave roof
 * with concave pitch, upturned hip corners, and crisp fascia lip.
 */
function createPolygonalCurvedEaveRoof(
  sides: number,
  innerRadius: number,
  outerRadius: number,
  height: number,
  eaveFlare = 0.28,
  ringSegs = 3
): THREE.BufferGeometry {
  const rTop = Math.max(0.05, innerRadius);
  const rBot = Math.max(rTop + 0.15, outerRadius);
  const geo = new THREE.CylinderGeometry(rTop, rBot, Math.max(0.12, height), sides, ringSegs, true);
  geo.translate(0, height * 0.5, 0);
  const pos = geo.attributes.position;
  const spanR = Math.max(0.05, rBot - rTop);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    const dist = Math.hypot(px, pz);
    const t = clamp01((dist - rTop) / spanR);
    const concave = Math.pow(1.0 - t, 1.38) * height;
    const ang = Math.atan2(pz, px);
    const cornerFactor = Math.pow(Math.abs(Math.cos((ang * sides) * 0.5)), 2.5);
    const upturn = eaveFlare * Math.pow(t, 2.3) * (0.35 + 0.85 * cornerFactor);
    pos.setY(i, concave + upturn);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a sloped/battered rectangular masonry frustum centered at (x, y, z)
 * for cyclopean ramparts, gate bastions, and monument plinths.
 */
function createBatteredFrustum(
  topW: number,
  botW: number,
  topD: number,
  botD: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rotY = 0
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, Math.max(0.05, h), 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const isTop = pos.getY(i) > 0;
    pos.setX(i, pos.getX(i) * (isTop ? topW : botW));
    pos.setZ(i, pos.getZ(i) * (isTop ? topD : botD));
  }
  geo.computeVertexNormals();
  return transformGeometryXYZ(geo, x, y, z, rotY, 0, 0);
}

/**
 * Lean, crisp carved Thanh-stone lotus-bud finial (*Đài Sen Đá*) — ~68 triangles vs 420.
 */
function appendLeanLotusFinial(
  pb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  scale = 1.0
): void {
  const s = scale;
  pb.cyl(0.22 * s, 0.28 * s, 0.14 * s, 6, x, y + 0.05 * s, z);
  pb.cyl(0.25 * s, 0.15 * s, 0.14 * s, 6, x, y + 0.19 * s, z);
  pb.cone(0.18 * s, 0.36 * s, 6, x, y + 0.43 * s, z);
}

/**
 * Lean Huế recessed-panel stone balustrade (*Lan Can Ô Hộc Đá Thanh*) — ~36 tris per bay, zero TorusGeometries.
 */
function appendLeanStoneBalustrade(
  pb: PartsBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  height = 0.88,
  baySpacing = 2.4
): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.3) return;
  const yaw = Math.atan2(dx, dz);
  const mx = (x0 + x1) * 0.5;
  const mz = (z0 + z1) * 0.5;

  // Continuous bottom curb & molded top handrail
  pb.box(0.20, 0.14, len, mx, y + 0.05, mz, { ry: yaw });
  pb.box(0.22, 0.12, len, mx, y + height - 0.06, mz, { ry: yaw });

  const bays = Math.max(1, Math.round(len / baySpacing));
  for (let i = 0; i <= bays; i++) {
    const t = i / bays;
    const px = x0 + dx * t;
    const pz = z0 + dz * t;
    pb.box(0.28, height + 0.18, 0.28, px, y + (height + 0.06) * 0.5, pz, { ry: yaw });
    pb.cone(0.14, 0.20, 4, px, y + height + 0.22, pz, { ry: yaw + Math.PI * 0.25 });
    if (i < bays) {
      const bx = x0 + dx * (t + 0.5 / bays);
      const bz = z0 + dz * (t + 0.5 / bays);
      const panelLen = (len / bays) * 0.78;
      pb.box(0.10, height * 0.54, panelLen, bx, y + height * 0.48, bz, { ry: yaw });
    }
  }
}

/**
 * Lean sculpted seated/standing deity or guardian statue (~128 tris) with lotus throne,
 * draped cà-sa torso, mudra arms, ushnisha crown, and Bodhi-leaf aureole.
 */
function appendLeanSacredStatue(
  bodyPb: PartsBuilder,
  accentPb: PartsBuilder,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  scale = 1.0,
  standing = false
): void {
  const s = scale;
  // Grounded octagonal lotus pedestal (-0.08m embedded)
  bodyPb.cyl(0.76 * s, 0.90 * s, 0.28 * s, 6, x, y + 0.08 * s, z);
  accentPb.cyl(0.84 * s, 0.66 * s, 0.20 * s, 6, x, y + 0.30 * s, z);

  if (standing) {
    bodyPb.cyl(0.26 * s, 0.34 * s, 1.35 * s, 6, x, y + 1.05 * s, z);
    bodyPb.box(0.68 * s, 0.38 * s, 0.32 * s, x, y + 1.48 * s, z, { ry: yaw });
    bodyPb.sphere(0.20 * s, 6, 5, x, y + 1.90 * s, z);
    accentPb.cone(0.16 * s, 0.32 * s, 5, x, y + 2.18 * s, z);
    // Ceremonial Dharma staff / club
    accentPb.cyl(0.04 * s, 0.05 * s, 1.65 * s, 4, x + Math.cos(yaw) * 0.36 * s, y + 1.15 * s, z - Math.sin(yaw) * 0.36 * s);
  } else {
    const seatY = y + 0.40 * s;
    bodyPb.cyl(0.68 * s, 0.78 * s, 0.32 * s, 6, x, seatY + 0.16 * s, z);
    bodyPb.cyl(0.32 * s, 0.50 * s, 0.92 * s, 6, x, seatY + 0.76 * s, z);
    bodyPb.box(0.72 * s, 0.24 * s, 0.36 * s, x, seatY + 0.98 * s, z, { ry: yaw });
    bodyPb.sphere(0.24 * s, 6, 5, x, seatY + 1.42 * s, z);
    accentPb.cone(0.11 * s, 0.22 * s, 5, x, seatY + 1.70 * s, z);
    // Bodhi-leaf halo disc behind head
    accentPb.cyl(
      0.52 * s,
      0.52 * s,
      0.05 * s,
      8,
      x - Math.sin(yaw) * 0.20 * s,
      seatY + 1.38 * s,
      z - Math.cos(yaw) * 0.20 * s,
      { rx: Math.PI * 0.5, rz: yaw }
    );
  }
}

/**
 * Generates radial wedge-shaped stone voussoirs (*đá múi bưởi*) framing a semicircular stone arch.
 */
function addArchVoussoirRing(
  stonePb: PartsBuilder,
  granitePb: PartsBuilder,
  cx: number,
  springY: number,
  cz: number,
  archHalfW: number,
  voussoirRadialLen: number,
  voussoirDepth: number,
  wedgeCount = 11,
  rotY = 0
): void {
  const n = Math.max(5, wedgeCount | 1);
  const rMid = archHalfW + voussoirRadialLen * 0.48;
  const arcStep = Math.PI / n;
  for (let i = 0; i < n; i++) {
    const theta = Math.PI - (i + 0.5) * arcStep;
    const isKeystone = i === (n >> 1);
    const radLen = isKeystone ? voussoirRadialLen * 1.24 : voussoirRadialLen;
    const wedgeW = Math.max(0.18, rMid * arcStep * 0.90);
    const localX = Math.cos(theta) * (archHalfW + radLen * 0.46);
    const localY = springY + Math.sin(theta) * (archHalfW + radLen * 0.46);
    const g = new THREE.BoxGeometry(radLen, wedgeW, isKeystone ? voussoirDepth * 1.12 : voussoirDepth);
    g.rotateZ(theta);
    if (rotY !== 0) g.rotateY(rotY);
    const wx = cx + (rotY === 0 ? localX : Math.cos(rotY) * localX);
    const wz = cz + (rotY === 0 ? 0 : -Math.sin(rotY) * localX);
    g.translate(wx, localY, wz);
    (i % 2 === 0 ? granitePb : stonePb).add(g);
  }
}

/**
 * Appends an ornate Huế Perfume River Dragon Boat (*Thuyền Rồng Sông Hương*)
 * in either royal twin-hull ('double') or sleek single-hull ('single') configuration.
 */
function appendHueDragonBoat(
  woodPb: PartsBuilder,
  crimsonPb: PartsBuilder,
  goldPb: PartsBuilder,
  roofPb: PartsBuilder,
  silkPb: PartsBuilder,
  corePb: PartsBuilder,
  bx: number,
  waterY: number,
  bz: number,
  yaw: number,
  hullMode: 'double' | 'single'
): void {
  const hullOffsets = hullMode === 'double' ? [-1.35, 1.35] : [0];
  const hullLen = hullMode === 'double' ? 14.2 : 12.0;
  const hullW = hullMode === 'double' ? 1.32 : 1.85;
  const cabinW = hullMode === 'double' ? 3.85 : 1.78;
  const cabinLen = hullMode === 'double' ? 7.4 : 5.8;

  const place = (pb: PartsBuilder, geo: THREE.BufferGeometry, lx: number, ly: number, lz: number) => {
    geo.translate(lx, ly, lz);
    if (yaw !== 0) geo.rotateY(yaw);
    geo.translate(bx, waterY, bz);
    pb.add(geo);
  };

  for (const hx of hullOffsets) {
    place(woodPb, new THREE.BoxGeometry(hullW, 0.62, hullLen * 0.68), hx, 0.16, 0);
    const bowSweep = new THREE.BoxGeometry(hullW * 0.82, 0.52, hullLen * 0.24);
    bowSweep.rotateX(-0.24);
    place(woodPb, bowSweep, hx, 0.42, hullLen * 0.41);

    const sternSweep = new THREE.BoxGeometry(hullW * 0.78, 0.50, hullLen * 0.22);
    sternSweep.rotateX(0.20);
    place(woodPb, sternSweep, hx, 0.38, -hullLen * 0.40);

    place(crimsonPb, new THREE.BoxGeometry(hullW + 0.08, 0.14, hullLen * 0.70), hx, 0.48, 0);
    place(goldPb, new THREE.BoxGeometry(hullW + 0.11, 0.06, hullLen * 0.68), hx, 0.56, 0);
    // Painted Huế dragon-scale gunwale medallions along outer hull
    for (let sc = -2; sc <= 2; sc++) {
      place(goldPb, new THREE.BoxGeometry(hullW + 0.13, 0.10, 0.24), hx, 0.36, sc * (hullLen * 0.12));
    }

    // Sculpted gilded Huế Dragon Prow (*Đầu Rồng Thuyền Ngự*)
    const prowZ = hullLen * 0.50;
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, 0.48, prowZ - 0.55),
      new THREE.Vector3(hx, 1.25, prowZ + 0.35),
      new THREE.Vector3(hx, 1.92, prowZ + 0.85),
      new THREE.Vector3(hx, 2.08, prowZ + 1.42)
    ]);
    const neckGeo = createSmoothTaperedTubeGeometry(neckCurve, 5, 4, (t) => 0.30 * (1.0 - t * 0.38));
    if (yaw !== 0) neckGeo.rotateY(yaw);
    neckGeo.translate(bx, waterY, bz);
    goldPb.add(neckGeo);

    const snout = new THREE.BoxGeometry(0.42, 0.24, 0.68);
    snout.rotateX(-0.18);
    place(goldPb, snout, hx, 2.16, prowZ + 1.72);
    const jaw = new THREE.BoxGeometry(0.34, 0.14, 0.58);
    jaw.rotateX(0.28);
    place(goldPb, jaw, hx, 1.84, prowZ + 1.66);
    place(crimsonPb, new THREE.SphereGeometry(0.14, 5, 4), hx, 2.00, prowZ + 1.88);
    for (const sx of [-1, 1]) {
      const horn = new THREE.ConeGeometry(0.055, 0.58, 4);
      horn.rotateX(-0.85);
      horn.rotateZ(sx * 0.28);
      place(goldPb, horn, hx + sx * 0.18, 2.38, prowZ + 1.18);
      place(crimsonPb, new THREE.BoxGeometry(0.06, 0.36, 0.45), hx + sx * 0.20, 1.62, prowZ + 0.58);
    }

    // Dragon-tail sternpost & wooden rudder (*Bánh Lái Đuôi Rồng*)
    const tailPost = new THREE.ConeGeometry(0.20, 1.35, 5);
    tailPost.rotateX(-0.38);
    place(goldPb, tailPost, hx, 1.05, -hullLen * 0.50);
    const rudder = new THREE.BoxGeometry(0.09, 0.72, 0.95);
    rudder.rotateX(0.26);
    place(woodPb, rudder, hx, 0.12, -hullLen * 0.54);

    // Warm glowing silk bow lantern
    const lanShell = createRibbedLanternShellGeometry(0.18, 0.34, 5, 3, 'garlic');
    place(silkPb, lanShell, hx, 1.36, prowZ + 1.62);
    const lanCore = createLanternCoreGeometry(0.18, 0.34);
    place(corePb, lanCore, hx, 1.36, prowZ + 1.62);
  }

  const deckW = hullMode === 'double' ? 4.25 : 2.02;
  place(woodPb, new THREE.BoxGeometry(deckW, 0.16, cabinLen + 2.8), 0, 0.56, -0.2);

  const colCountZ = 4;
  for (const sx of [-1, 1]) {
    const cxCol = sx * (cabinW * 0.46);
    place(crimsonPb, new THREE.BoxGeometry(0.10, 0.52, cabinLen), cxCol, 0.86, -0.25);
    place(goldPb, new THREE.BoxGeometry(0.12, 0.08, cabinLen), cxCol, 1.14, -0.25);
    for (let i = 0; i < colCountZ; i++) {
      const czCol = -0.25 + ((i / (colCountZ - 1)) - 0.5) * (cabinLen - 0.4);
      place(crimsonPb, new THREE.CylinderGeometry(0.075, 0.085, 2.05, 5), cxCol, 1.48, czCol);
    }
  }
  place(crimsonPb, new THREE.BoxGeometry(cabinW * 0.90, 1.75, 0.12), 0, 1.48, -0.25 - cabinLen * 0.46);
  place(woodPb, new THREE.BoxGeometry(cabinW * 0.72, 0.32, cabinLen * 0.55), 0, 0.78, -0.25);
  // Interior Huế imperial tea table, flanking passenger benches & front gilded *cửa võng* valence
  place(crimsonPb, new THREE.BoxGeometry(cabinW * 0.34, 0.48, cabinLen * 0.36), 0, 0.88, -0.25);
  place(goldPb, new THREE.BoxGeometry(cabinW * 0.38, 0.06, cabinLen * 0.40), 0, 1.14, -0.25);
  place(goldPb, new THREE.BoxGeometry(cabinW * 0.86, 0.24, 0.08), 0, 2.26, -0.25 + cabinLen * 0.44);
  for (const sx of [-1, 1]) {
    place(goldPb, new THREE.BoxGeometry(0.14, 0.42, 0.08), sx * (cabinW * 0.36), 2.02, -0.25 + cabinLen * 0.44);
    // Hanging red-silk corner cabin lanterns at fore & aft eaves
    for (const sz of [-1, 1]) {
      const cabLanZ = -0.25 + sz * (cabinLen * 0.48);
      const cShell = createRibbedLanternShellGeometry(0.13, 0.24, 5, 2, 'pumpkin');
      place(silkPb, cShell, sx * (cabinW * 0.52), 2.18, cabLanZ);
      const cCore = createLanternCoreGeometry(0.13, 0.24);
      place(corePb, cCore, sx * (cabinW * 0.52), 2.18, cabLanZ);
    }
  }
  // Curved stern helmsman tiller & foredeck low boarding rail
  place(woodPb, new THREE.BoxGeometry(0.10, 0.10, 1.35), 0, 1.18, -0.25 - cabinLen * 0.58);
  place(crimsonPb, new THREE.BoxGeometry(deckW * 0.86, 0.08, 0.10), 0, 0.96, cabinLen * 0.5 + 0.95);

  const roof1 = createHueImperialHipRoofGeometry(
    cabinW + 0.95,
    cabinLen + 1.15,
    cabinW * 0.48,
    cabinLen * 0.58,
    0.72,
    0.26,
    3,
    2
  );
  place(roofPb, roof1, 0, 2.38, -0.25);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerTip = new THREE.ConeGeometry(0.07, 0.28, 4);
      cornerTip.rotateZ(-sx * 0.55);
      cornerTip.rotateX(sz * 0.42);
      place(goldPb, cornerTip, sx * (cabinW * 0.5 + 0.42), 2.58, -0.25 + sz * (cabinLen * 0.5 + 0.50));
    }
  }

  if (hullMode === 'double') {
    place(crimsonPb, new THREE.BoxGeometry(cabinW * 0.56, 0.58, cabinLen * 0.54), 0, 2.95, -0.25);
    const roof2 = createHueImperialHipRoofGeometry(
      cabinW * 0.76,
      cabinLen * 0.72,
      cabinW * 0.30,
      cabinLen * 0.38,
      0.62,
      0.24,
      3,
      2
    );
    place(roofPb, roof2, 0, 3.20, -0.25);
    place(goldPb, new THREE.BoxGeometry(0.16, 0.18, cabinLen * 0.38), 0, 3.84, -0.25);
    place(goldPb, new THREE.SphereGeometry(0.16, 5, 4), 0, 4.02, -0.25);
  } else {
    place(goldPb, new THREE.BoxGeometry(0.14, 0.16, cabinLen * 0.56), 0, 3.12, -0.25);
  }
}

/**
 * Appends a lean Huế 3-needle Umbrella Pine (*Thông Thiên Mụ*), Weeping Willow (*Liễu Rủ*),
 * or Crimson Flame Tree (*Phượng Vĩ*) using ONLY shared materials.
 */
function appendHeritageTree(
  barkPb: PartsBuilder,
  canopyPb: PartsBuilder,
  blossomPb: PartsBuilder | null,
  x: number,
  groundY: number,
  z: number,
  height: number,
  style: 'pine' | 'willow' | 'flame',
  seed: number
): void {
  const rand = mulberry32(seed);
  const trunkH = height * (style === 'pine' ? 0.84 : 0.62);
  barkPb.cyl(
    0.15,
    0.34,
    trunkH + 0.35,
    5,
    x,
    groundY + (trunkH - 0.35) * 0.5,
    z,
    { rx: (rand() - 0.5) * 0.08, rz: (rand() - 0.5) * 0.08 }
  );

  const branchCount = 4;
  for (let i = 0; i < branchCount; i++) {
    const a = (i / branchCount) * Math.PI * 2 + rand() * 0.5;
    const reach = (style === 'willow' ? 2.2 : 1.9) + rand() * 1.1;
    const bh = groundY + trunkH * (0.68 + i * 0.07);
    const bx = x + Math.cos(a) * reach * 0.5;
    const bz = z + Math.sin(a) * reach * 0.5;
    barkPb.strut(
      new THREE.Vector3(x, bh - 0.45, z),
      new THREE.Vector3(x + Math.cos(a) * reach * 0.85, bh + 0.35, z + Math.sin(a) * reach * 0.85),
      0.06,
      0.11,
      4
    );

    const pad = new THREE.IcosahedronGeometry(1.0, 0);
    const rx = (style === 'pine' ? 2.15 : 2.35) + rand() * 0.55;
    const ry = style === 'pine' ? 0.62 : style === 'willow' ? 1.45 : 0.88;
    const rz = (style === 'pine' ? 2.05 : 2.25) + rand() * 0.55;
    pad.scale(rx, ry, rz);
    pad.rotateY(a);
    pad.translate(bx + Math.cos(a) * reach * 0.35, bh + 0.55, bz + Math.sin(a) * reach * 0.35);
    canopyPb.add(pad);

    if (style === 'flame' && blossomPb) {
      const bloom = new THREE.IcosahedronGeometry(1.0, 0);
      bloom.scale(rx * 0.78, ry * 0.52, rz * 0.78);
      bloom.rotateY(a + 0.4);
      bloom.translate(bx + Math.cos(a) * reach * 0.40, bh + 0.92, bz + Math.sin(a) * reach * 0.40);
      blossomPb.add(bloom);
    }
  }

  const crown = new THREE.IcosahedronGeometry(1.0, 0);
  crown.scale(2.75, style === 'pine' ? 0.78 : 1.18, 2.65);
  crown.translate(x, groundY + trunkH + 0.65, z);
  canopyPb.add(crown);
  if (style === 'flame' && blossomPb) {
    const topBloom = new THREE.IcosahedronGeometry(1.0, 0);
    topBloom.scale(2.15, 0.58, 2.05);
    topBloom.translate(x, groundY + trunkH + 1.18, z);
    blossomPb.add(topBloom);
  }
}

// ============================================================================
// 1. CHÙA THIÊN MỤ — ĐỒI HÀ KHÊ & BẾN THUYỀN RỒNG SÔNG HƯƠNG (-960, 120)
//    Implements MT-001..MT-110 (110 distinct architectural details)
// ============================================================================
function buildThienMuPagodaHueComplex(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ThienMuPagodaHueComplex';

  const cx = -960.0;

  ctx.exclusionCircles.push(
    { x: cx, z: 180.0, r: 52.0 },
    { x: cx, z: 136.0, r: 46.0 },
    { x: cx, z: 92.0, r: 46.0 }
  );

  // Coordinate Sông Hương water elevation cleanly against ctx.getHeight
  const maxRiverTerrain = sampleMaxTerrainHeight(ctx, cx - 44, cx + 44, 160, 204, 6, 5);
  const centerRiverH = Math.max(ctx.getHeight(cx, 175), VIETNAM_WATER_LEVEL);
  const terrainAboveWater = maxRiverTerrain > VIETNAM_WATER_LEVEL + 0.05;
  const waterY = terrainAboveWater
    ? Math.max(centerRiverH, maxRiverTerrain) + 0.42
    : VIETNAM_WATER_LEVEL + 0.04;

  // Gently rising Hà Khê Hill terraces from south waterfront (z = 158) up to north pine garden (z = 65)
  const quayY = Math.max(
    waterY + 1.15,
    sampleMaxTerrainHeight(ctx, cx - 42, cx + 42, 148, 160, 5, 4) + 0.32
  );
  const yTowerTerrace = Math.max(
    quayY + 2.35,
    sampleMaxTerrainHeight(ctx, cx - 32, cx + 32, 120, 142, 5, 5) + 0.42
  );
  const yMainCourt = Math.max(
    yTowerTerrace + 1.75,
    sampleMaxTerrainHeight(ctx, cx - 32, cx + 32, 82, 118, 5, 5) + 0.48
  );
  const yRearGarden = Math.max(
    yMainCourt + 0.72,
    sampleMaxTerrainHeight(ctx, cx - 30, cx + 30, 64, 83, 5, 4) + 0.45
  );

  const stonePb = new PartsBuilder();
  const granitePb = new PartsBuilder();
  const plasterPb = new PartsBuilder();
  const ochrePb = new PartsBuilder();
  const marblePb = new PartsBuilder();
  const brickPb = new PartsBuilder();
  const towerBrickPb = new PartsBuilder(); // castShadow = true!
  const daiHungRoofPb = new PartsBuilder(); // castShadow = true!
  const batTrangPb = new PartsBuilder();
  const darkRoofPb = new PartsBuilder();
  const jadeEavePb = new PartsBuilder(); // castShadow = false — emerald glazed Ngói Lưu Ly Xanh eaves
  const terraRoofPb = new PartsBuilder();
  const crimsonPb = new PartsBuilder();
  const ironwoodPb = new PartsBuilder();
  const woodPb = new PartsBuilder();
  const goldPb = new PartsBuilder();
  const bronzePb = new PartsBuilder();
  const patinaPb = new PartsBuilder();
  const voidPb = new PartsBuilder();
  const silkPb = new PartsBuilder();
  const corePb = new PartsBuilder();
  const barkPb = new PartsBuilder();
  const foliagePb = new PartsBuilder();
  const willowFoliagePb = new PartsBuilder();

  const skirtDepth = 6.5;

  // --------------------------------------------------------------------------
  // A. BẾN THUYỀN RỒNG SÔNG HƯƠNG (z = 158..205) — MT-001..022
  // --------------------------------------------------------------------------
  const riverW = 88.0;
  const riverZ0 = 159.0;
  const riverZ1 = 204.0;
  const riverMidZ = (riverZ0 + riverZ1) * 0.5;
  const riverDepthZ = riverZ1 - riverZ0;

  granitePb.box(riverW + 3.2, 0.28, riverDepthZ + 2.4, cx, waterY - 0.30, riverMidZ);
  stonePb.box(riverW + 4.0, quayY - waterY + skirtDepth, 2.2, cx, quayY - (quayY - waterY + skirtDepth) * 0.5, 158.4);
  plasterPb.box(riverW + 4.4, 0.24, 2.5, cx, quayY + 0.10, 158.4);
  granitePb.box(riverW + 4.0, skirtDepth + 0.65, 1.8, cx, waterY + 0.32 - (skirtDepth + 0.65) * 0.5, riverZ1 + 0.8);
  for (const sx of [-1, 1]) {
    granitePb.box(
      1.8,
      skirtDepth + 0.85,
      riverDepthZ + 3.2,
      cx + sx * (riverW * 0.5 + 0.9),
      waterY + 0.42 - (skirtDepth + 0.85) * 0.5,
      riverMidZ
    );
  }

  if (waterY > VIETNAM_WATER_LEVEL + 0.08) {
    const riverWaterGeo = new THREE.PlaneGeometry(riverW - 0.4, riverDepthZ - 0.4);
    riverWaterGeo.rotateX(-Math.PI * 0.5);
    riverWaterGeo.translate(cx, waterY, riverMidZ);
    riverWaterGeo.computeBoundingBox();
    riverWaterGeo.computeBoundingSphere();
    const fallbackWaterMat =
      ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof;
    const rMesh = new THREE.Mesh(riverWaterGeo, fallbackWaterMat);
    rMesh.name = 'SongHuongWaterSurface';
    rMesh.castShadow = false;
    rMesh.receiveShadow = true;
    group.add(rMesh);
  }

  // Wide central stepped Thanh-stone boat landing (*Bến Thuyền Thiên Mụ*, width 13.6m)
  const dockW = 13.6;
  const dockSteps = 7;
  for (let s = 0; s < dockSteps; s++) {
    const t = s / (dockSteps - 1);
    const stepTop = THREE.MathUtils.lerp(quayY, waterY + 0.16, t);
    const stepZ = 159.4 + s * 0.92;
    stonePb.box(dockW, stepTop - waterY + 2.2, 1.05, cx, stepTop - (stepTop - waterY + 2.2) * 0.5, stepZ);
  }
  stonePb.box(dockW + 2.4, 1.8, 2.2, cx, waterY + 0.16 - 0.9, 166.2);
  for (const sx of [-1, 1]) {
    const cheekX = cx + sx * (dockW * 0.5 + 0.45);
    stonePb.box(0.75, quayY - waterY + 2.4, 8.2, cheekX, (quayY + waterY) * 0.5 - 0.6, 162.8);
    appendLeanLotusFinial(stonePb, cheekX, quayY + 0.22, 159.2, 0.88);
    appendLeanLotusFinial(stonePb, cheekX, waterY + 0.45, 166.8, 0.80);
    woodPb.cyl(0.14, 0.16, 1.55, 5, cx + sx * 5.2, waterY + 0.35, 167.25);
    bronzePb.cyl(0.12, 0.12, 0.06, 6, cx + sx * 3.2, waterY + 0.22, 167.1, { rx: Math.PI * 0.5 });
  }

  stonePb.box(76.0, skirtDepth, 10.2, cx, quayY - skirtDepth * 0.5, 153.4);
  batTrangPb.box(74.0, 0.08, 9.4, cx, quayY + 0.04, 153.4);
  appendLeanStoneBalustrade(stonePb, cx - 37.0, 158.2, cx - dockW * 0.5 - 0.8, 158.2, quayY + 0.12, 0.88, 2.6);
  appendLeanStoneBalustrade(stonePb, cx + dockW * 0.5 + 0.8, 158.2, cx + 37.0, 158.2, quayY + 0.12, 0.88, 2.6);

  // Bến Thuyền Rồng waterfront stone lantern bollards (*Cột Đèn Bến Thuyền*) & lower bronze mooring cleats
  for (const sx of [-1, 1]) {
    for (const bxOff of [8.6, 17.2, 25.8]) {
      const lx = cx + sx * bxOff;
      const lz = 157.35;
      stonePb.cyl(0.28, 0.34, 0.24, 6, lx, quayY + 0.10, lz);
      stonePb.cyl(0.13, 0.17, 1.52, 6, lx, quayY + 0.96, lz);
      plasterPb.cyl(0.24, 0.16, 0.14, 6, lx, quayY + 1.78, lz);
      const bLan = createRibbedLanternShellGeometry(0.16, 0.32, 5, 2, 'garlic');
      bLan.translate(lx, quayY + 2.04, lz);
      silkPb.add(bLan);
      const bCore = createLanternCoreGeometry(0.16, 0.32);
      bCore.translate(lx, quayY + 2.04, lz);
      corePb.add(bCore);
      darkRoofPb.cone(0.32, 0.22, 6, lx, quayY + 2.34, lz);
      goldPb.sphere(0.055, 4, 3, lx, quayY + 2.48, lz);
    }
    // Lower dock bronze mooring bollards & timber rub-strakes
    bronzePb.cyl(0.14, 0.17, 0.44, 6, cx + sx * 6.1, waterY + 0.34, 166.55);
    bronzePb.cyl(0.20, 0.18, 0.08, 6, cx + sx * 6.1, waterY + 0.56, 166.55);
    woodPb.box(0.14, 0.18, 1.9, cx + sx * 6.75, waterY + 0.22, 166.2);
  }

  // 3 Ornate Huế Perfume River Dragon Boats (*Thuyền Rồng Sông Hương*)
  appendHueDragonBoat(woodPb, crimsonPb, goldPb, terraRoofPb, silkPb, corePb, cx - 1.5, waterY, 173.8, 1.48, 'double');
  appendHueDragonBoat(woodPb, crimsonPb, goldPb, darkRoofPb, silkPb, corePb, cx - 24.5, waterY, 182.0, 1.42, 'single');
  appendHueDragonBoat(woodPb, crimsonPb, goldPb, terraRoofPb, silkPb, corePb, cx + 25.5, waterY, 186.5, -1.62, 'single');

  // Riverside weeping willows & crimson flame trees (>= 10m clear of Trụ Biểu & buildings!)
  appendHeritageTree(barkPb, willowFoliagePb, null, cx - 34.0, quayY, 154.5, 9.8, 'willow', 3101);
  appendHeritageTree(barkPb, willowFoliagePb, null, cx + 34.0, quayY, 154.5, 9.6, 'willow', 3102);
  appendHeritageTree(barkPb, foliagePb, crimsonPb, cx - 27.5, quayY, 152.0, 10.6, 'flame', 3103);
  appendHeritageTree(barkPb, foliagePb, crimsonPb, cx + 27.5, quayY, 152.0, 10.4, 'flame', 3104);

  // --------------------------------------------------------------------------
  // B. 4 TRỤ BIỂU, TAM CẤP HÀ KHÊ, ĐÌNH HƯƠNG NGUYỆT & THÁP PHƯỚC DUYÊN 7 TẦNG
  //    (z = 120..152) — MT-023..062
  // --------------------------------------------------------------------------
  const truBieuSpecs: Array<[number, number]> = [
    [-11.8, 9.4],
    [-4.8, 11.2],
    [4.8, 11.2],
    [11.8, 9.4]
  ];
  for (const [txOff, pillarH] of truBieuSpecs) {
    const px = cx + txOff;
    const pz = 149.6;
    stonePb.box(2.15, 4.4, 2.15, px, quayY + 0.35 - 2.2, pz);
    stonePb.box(1.82, 0.55, 1.82, px, quayY + 0.62, pz);
    brickPb.add(createBatteredFrustum(1.08, 1.38, 1.08, 1.38, pillarH - 2.4, px, quayY + 0.90 + (pillarH - 2.4) * 0.5, pz));
    plasterPb.box(1.46, 0.20, 1.46, px, quayY + 0.92, pz);
    plasterPb.box(1.24, 0.22, 1.24, px, quayY + pillarH - 1.55, pz);
    plasterPb.box(0.56, pillarH - 3.6, 1.28, px, quayY + 0.90 + (pillarH - 2.4) * 0.5, pz);
    // Recessed crimson calligraphy couplet plaques (*câu đối*) on front & back of each Trụ Biểu
    crimsonPb.box(0.38, pillarH - 4.1, 1.32, px, quayY + 0.90 + (pillarH - 2.4) * 0.5, pz);
    goldPb.box(0.46, 0.10, 1.34, px, quayY + pillarH - 1.85, pz);
    goldPb.box(0.46, 0.10, 1.34, px, quayY + 1.28, pz);
    // Molded lantern-chamber (*ô lồng đèn*) with 4 corner mullions & miniature upturned cap collar
    plasterPb.box(0.88, 0.95, 0.88, px, quayY + pillarH - 0.95, pz);
    voidPb.box(0.42, 0.52, 0.92, px, quayY + pillarH - 0.95, pz);
    voidPb.box(0.92, 0.52, 0.42, px, quayY + pillarH - 0.95, pz);
    plasterPb.box(1.16, 0.16, 1.16, px, quayY + pillarH - 0.44, pz);
    stonePb.cyl(0.62, 0.88, 0.24, 4, px, quayY + pillarH - 0.28, pz, { ry: Math.PI * 0.25 });
    appendLeanLotusFinial(stonePb, px, quayY + pillarH - 0.18, pz, 1.12);
  }
  for (const side of [-1, 1]) {
    const midX = cx + side * 8.3;
    brickPb.box(5.4, 2.25, 0.58, midX, quayY + 1.12, 149.6);
    plasterPb.box(5.52, 0.18, 0.68, midX, quayY + 0.12, 149.6);
    plasterPb.box(5.52, 0.16, 0.68, midX, quayY + 2.18, 149.6);
    darkRoofPb.box(5.7, 0.22, 0.82, midX, quayY + 2.32, 149.6);
    plasterPb.add(...createShouCharacterParts(midX, quayY + 1.20, 149.92, 0.38, 'tron', 0));
    // Flanking stepped *bình phong* wing walls outside the outer Trụ Biểu pillars
    const wingX = cx + side * 14.8;
    brickPb.box(4.2, 1.85, 0.52, wingX, quayY + 0.92, 149.6);
    darkRoofPb.box(4.45, 0.20, 0.74, wingX, quayY + 1.92, 149.6);
    plasterPb.box(0.54, 2.25, 0.66, cx + side * 17.0, quayY + 1.12, 149.6);
    appendLeanLotusFinial(stonePb, cx + side * 17.0, quayY + 2.24, 149.6, 0.68);
  }

  // Ascending 3-Lane Thanh-Stone Dragon Stairs (*Tam Cấp Hà Khê*, z = 139.2..148.6, grounded with -5m skirt)
  const stairW = 13.8;
  const stairZStart = 148.4;
  const stairZEnd = 139.4;
  const stairSteps = 12;
  for (let i = 0; i < stairSteps; i++) {
    const t = (i + 1) / stairSteps;
    const stepTop = THREE.MathUtils.lerp(quayY + 0.12, yTowerTerrace, t);
    const sz = THREE.MathUtils.lerp(stairZStart, stairZEnd, t);
    stonePb.box(stairW, stepTop - quayY + 4.4, 0.88, cx, stepTop - (stepTop - quayY + 4.4) * 0.5, sz);
  }
  const stairSlopeLen = Math.hypot(stairZStart - stairZEnd, yTowerTerrace - quayY);
  const stairPitch = Math.atan2(yTowerTerrace - quayY, stairZStart - stairZEnd);
  for (const curbX of [-6.9, -2.25, 2.25, 6.9]) {
    stonePb.box(
      0.48,
      0.86,
      stairSlopeLen + 0.6,
      cx + curbX,
      (quayY + yTowerTerrace) * 0.5 + 0.32,
      (stairZStart + stairZEnd) * 0.5,
      { rx: stairPitch }
    );
    stonePb.box(0.56, 4.4, stairZStart - stairZEnd + 0.5, cx + curbX, quayY - 1.8, (stairZStart + stairZEnd) * 0.5);
    appendLeanLotusFinial(stonePb, cx + curbX, quayY + 0.62, stairZStart + 0.35, 0.74);
  }

  // Phước Duyên Terrace Platform (-6.5m retaining wall skirt)
  const pdTerrW = 56.0;
  const pdTerrD = 20.0;
  const pdTerrZ = 129.4;
  stonePb.box(pdTerrW, skirtDepth, pdTerrD, cx, yTowerTerrace - skirtDepth * 0.5, pdTerrZ);
  batTrangPb.box(pdTerrW - 1.2, 0.08, pdTerrD - 1.2, cx, yTowerTerrace + 0.04, pdTerrZ);
  plasterPb.box(pdTerrW + 0.4, 0.24, 0.65, cx, yTowerTerrace + 0.08, 139.3);
  appendLeanStoneBalustrade(stonePb, cx - 27.4, 139.2, cx - 7.3, 139.2, yTowerTerrace + 0.14, 0.88, 2.5);
  appendLeanStoneBalustrade(stonePb, cx + 7.3, 139.2, cx + 27.4, 139.2, yTowerTerrace + 0.14, 0.88, 2.5);

  // Đình Hương Nguyệt (2-Tier Hexagonal Pavilion directly in front of Tháp Phước Duyên at z = 135.2)
  const dhnZ = 135.2;
  stonePb.cyl(2.95, 3.25, 0.52, 6, cx, yTowerTerrace + 0.26, dhnZ);
  batTrangPb.cyl(2.82, 2.82, 0.08, 6, cx, yTowerTerrace + 0.54, dhnZ);
  // South & North axial access steps onto Đình Hương Nguyệt plinth
  for (const sz of [-1, 1]) {
    for (let st = 0; st < 2; st++) {
      const stH = (st + 1) * 0.26;
      stonePb.box(1.65, stH + 0.12, 0.42, cx, yTowerTerrace + stH * 0.5 - 0.06, dhnZ + sz * (3.22 - st * 0.36));
    }
  }
  const dhnColBaseY = yTowerTerrace + 0.52;
  const dhnEaveY = dhnColBaseY + 3.05;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const colX = cx + Math.cos(a) * 2.35;
    const colZ = dhnZ + Math.sin(a) * 2.35;
    stonePb.cyl(0.20, 0.25, 0.18, 6, colX, dhnColBaseY + 0.08, colZ);
    crimsonPb.cyl(0.13, 0.15, 3.28, 6, colX, dhnColBaseY + 1.49, colZ);
    // Gilded *kẻ* eave bracket under ring beam
    goldPb.box(0.12, 0.22, 0.46, cx + Math.cos(a) * 2.52, dhnEaveY - 0.22, dhnZ + Math.sin(a) * 2.52, { ry: -a + Math.PI * 0.5 });
  }
  crimsonPb.cyl(2.50, 2.50, 0.22, 6, cx, dhnEaveY - 0.04, dhnZ);
  goldPb.cyl(2.56, 2.56, 0.08, 6, cx, dhnEaveY - 0.16, dhnZ);
  // Central stone ceremonial incense pedestal inside Đình Hương Nguyệt
  stonePb.cyl(0.42, 0.50, 0.72, 6, cx, dhnColBaseY + 0.36, dhnZ);
  bronzePb.cyl(0.26, 0.20, 0.32, 6, cx, dhnColBaseY + 0.88, dhnZ);
  // Authentic 2-tier Huế *cổ lầu* curved hexagonal roof
  const dhnRoof1 = createPolygonalCurvedEaveRoof(6, 1.48, 3.55, 1.05, 0.34, 3);
  dhnRoof1.translate(cx, dhnEaveY - 0.04, dhnZ);
  terraRoofPb.add(dhnRoof1);
  ochrePb.cyl(1.52, 1.52, 0.68, 6, cx, dhnEaveY + 1.24, dhnZ);
  crimsonPb.cyl(1.58, 1.58, 0.12, 6, cx, dhnEaveY + 1.54, dhnZ);
  const dhnRoof2 = createPolygonalCurvedEaveRoof(6, 0.16, 2.48, 1.15, 0.30, 3);
  dhnRoof2.translate(cx, dhnEaveY + 1.52, dhnZ);
  terraRoofPb.add(dhnRoof2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    plasterPb.strut(
      new THREE.Vector3(cx + Math.cos(a) * 1.52, dhnEaveY + 0.98, dhnZ + Math.sin(a) * 1.52),
      new THREE.Vector3(cx + Math.cos(a) * 3.50, dhnEaveY + 0.12, dhnZ + Math.sin(a) * 3.50),
      0.045,
      0.055,
      4
    );
  }
  goldPb.cyl(0.14, 0.24, 0.28, 6, cx, dhnEaveY + 2.66, dhnZ);
  goldPb.sphere(0.18, 6, 5, cx, dhnEaveY + 2.94, dhnZ, [1.0, 1.35, 1.0]);

  // THÁP PHƯỚC DUYÊN 7 TẦNG (21.0m Iconic Octagonal Pagoda at cx, z = 126.4)
  const tpdZ = 126.4;
  const plinthH1 = 0.62;
  const plinthH2 = 0.56;
  const towerStartY = yTowerTerrace + plinthH1 + plinthH2;
  const rotOct = Math.PI / 8;

  stonePb.cyl(5.65, 6.05, plinthH1 + 0.35, 8, cx, yTowerTerrace + (plinthH1 - 0.35) * 0.5, tpdZ, { ry: rotOct });
  stonePb.cyl(4.95, 5.20, plinthH2 + 0.10, 8, cx, yTowerTerrace + plinthH1 + plinthH2 * 0.5 - 0.05, tpdZ, { ry: rotOct });
  plasterPb.cyl(5.08, 5.08, 0.12, 8, cx, towerStartY - 0.02, tpdZ, { ry: rotOct });
  // Low octagonal lime-stone corner parapet piers & diagonal curb walls around the upper plinth
  for (let c = 0; c < 8; c++) {
    const ca = c * (Math.PI / 4) + rotOct;
    const px = cx + Math.cos(ca) * 4.78;
    const pz = tpdZ + Math.sin(ca) * 4.78;
    plasterPb.box(0.36, 0.72, 0.36, px, towerStartY + 0.34, pz, { ry: -ca });
    stonePb.cone(0.16, 0.24, 4, px, towerStartY + 0.80, pz, { ry: -ca + Math.PI * 0.25 });
  }
  for (const diagAng of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    const dx = cx + Math.cos(diagAng) * 4.42;
    const dz = tpdZ + Math.sin(diagAng) * 4.42;
    plasterPb.box(2.75, 0.56, 0.22, dx, towerStartY + 0.26, dz, { ry: -diagAng + Math.PI * 0.5 });
  }

  for (const [dx, dz] of [[0, 1], [0, -1], [-1, 0], [1, 0]] as const) {
    for (let st = 0; st < 4; st++) {
      const stFrac = (st + 1) / 4;
      const stR = 5.85 - st * 0.28;
      const stH = (plinthH1 + plinthH2) * stFrac;
      stonePb.box(
        dx === 0 ? 1.85 : 0.42,
        stH + 0.2,
        dz === 0 ? 1.85 : 0.42,
        cx + dx * stR,
        yTowerTerrace + stH * 0.5 - 0.1,
        tpdZ + dz * stR
      );
    }
    // Carved lotus-relief stepped stone cheek curbs flanking each octagonal base staircase
    const perpX = dz === 0 ? 0 : 1;
    const perpZ = dx === 0 ? 0 : 1;
    for (const cs of [-1, 1]) {
      const cbx = cx + dx * 5.42 + perpX * cs * 1.06;
      const cbz = tpdZ + dz * 5.42 + perpZ * cs * 1.06;
      stonePb.box(
        dx === 0 ? 0.26 : 1.18,
        0.74,
        dz === 0 ? 0.26 : 1.18,
        cbx,
        yTowerTerrace + 0.35,
        cbz
      );
      plasterPb.box(
        dx === 0 ? 0.30 : 1.22,
        0.09,
        dz === 0 ? 0.30 : 1.22,
        cbx,
        yTowerTerrace + 0.74,
        cbz
      );
      appendLeanLotusFinial(
        stonePb,
        cx + dx * 5.95 + perpX * cs * 1.06,
        yTowerTerrace + 0.76,
        tpdZ + dz * 5.95 + perpZ * cs * 1.06,
        0.46
      );
    }
  }
  // Carved lotus-petal relief collar around the Tháp Phước Duyên upper octagonal plinth waist
  plasterPb.add(...createLotusPetalRingParts(cx, yTowerTerrace + plinthH1 + 0.02, tpdZ, 5.24, 8, 1, false));

  // Flanking bronze incense cauldrons (*Đỉnh Đồng Tháp Phước Duyên*) on SE & SW diagonals
  for (const sx of [-1, 1]) {
    const cdX = cx + sx * 5.8;
    const cdZ = tpdZ + 5.2;
    stonePb.cyl(0.66, 0.76, 0.26, 6, cdX, yTowerTerrace + 0.13, cdZ);
    for (let leg = 0; leg < 3; leg++) {
      const la = (leg / 3) * Math.PI * 2 + Math.PI / 6;
      bronzePb.cyl(0.06, 0.08, 0.56, 5, cdX + Math.cos(la) * 0.32, yTowerTerrace + 0.52, cdZ + Math.sin(la) * 0.32);
    }
    bronzePb.cyl(0.46, 0.34, 0.54, 8, cdX, yTowerTerrace + 0.98, cdZ);
    goldPb.cyl(0.50, 0.48, 0.07, 8, cdX, yTowerTerrace + 1.26, cdZ);
    bronzePb.cone(0.36, 0.28, 8, cdX, yTowerTerrace + 1.44, cdZ);
    goldPb.sphere(0.09, 5, 4, cdX, yTowerTerrace + 1.62, cdZ);
    for (const earS of [-1, 1]) {
      bronzePb.box(0.10, 0.34, 0.14, cdX + earS * 0.52, yTowerTerrace + 1.12, cdZ);
      goldPb.box(0.12, 0.08, 0.16, cdX + earS * 0.52, yTowerTerrace + 1.30, cdZ);
    }
  }

  // 7 Progressively Tapering Octagonal Warm Rose-Brick Stories (reaches 21.1m above terrace!)
  const tierHeights = [3.15, 2.82, 2.58, 2.38, 2.18, 1.98, 1.82];
  const tierRadii = [3.92, 3.50, 3.10, 2.74, 2.40, 2.08, 1.78];
  let curTierY = towerStartY - 0.06;

  for (let tier = 0; tier < 7; tier++) {
    const th = tierHeights[tier];
    const rBot = tierRadii[tier];
    const rTop = rBot * 0.955;
    const midY = curTierY + th * 0.5;
    const apothem = rBot * Math.cos(Math.PI / 8);

    // Main octagonal rose-terracotta brick shaft (castShadow = true!)
    towerBrickPb.cyl(rTop, rBot, th + 0.08, 8, cx, midY, tpdZ, { ry: rotOct });

    // Crisp grey-white stone plinth waist band & upper cornice molding on EVERY single tier
    plasterPb.cyl(rBot * 1.025, rBot * 1.035, 0.14, 8, cx, curTierY + 0.10, tpdZ, { ry: rotOct });
    plasterPb.cyl(rTop * 1.06, rTop * 1.02, 0.18, 8, cx, curTierY + th - 0.10, tpdZ, { ry: rotOct });

    // Projecting octagonal emerald-glazed *ngói lưu ly xanh* roof eave crowning EVERY tier with 8 upturned hip ribs
    const eaveOuterR = rTop + 0.78 - tier * 0.04;
    const eaveH = 0.44 - tier * 0.02;
    const eaveGeo = createPolygonalCurvedEaveRoof(8, rTop * 0.94, eaveOuterR, eaveH, 0.18, 2);
    eaveGeo.rotateY(rotOct);
    eaveGeo.translate(cx, curTierY + th - 0.12, tpdZ);
    jadeEavePb.add(eaveGeo);
    for (let c = 0; c < 8; c++) {
      const ca = c * (Math.PI / 4) + rotOct;
      // Vertical lime-plaster corner quoin strip along all 8 octagonal edges
      plasterPb.box(
        0.13,
        th - 0.16,
        0.13,
        cx + Math.cos(ca) * (rBot * 0.99),
        midY,
        tpdZ + Math.sin(ca) * (rBot * 0.99),
        { ry: -ca }
      );
      const tipX = cx + Math.cos(ca) * (eaveOuterR * 0.98);
      const tipZ = tpdZ + Math.sin(ca) * (eaveOuterR * 0.98);
      plasterPb.strut(
        new THREE.Vector3(cx + Math.cos(ca) * (rTop * 0.96), curTierY + th + eaveH * 0.78, tpdZ + Math.sin(ca) * (rTop * 0.96)),
        new THREE.Vector3(tipX, curTierY + th + 0.04, tipZ),
        0.045,
        0.055,
        4
      );
      // Upturned *đao góc* scroll finial at each eave corner
      plasterPb.cone(0.065, 0.24, 4, tipX, curTierY + th + 0.14, tipZ, { ry: -ca });
    }

    // Arched South Buddha Niche (+Z facing Sông Hương) on ALL 7 floors with seated gilded Buddha!
    const nicheW = Math.max(0.68, 1.32 - tier * 0.09);
    const nicheH = Math.max(1.05, th * 0.62);
    const nicheZ = tpdZ + apothem;
    const springH = nicheH - nicheW * 0.5;
    // Lean 3D pilasters + semicircular arch hood + sill ledge + dark recess
    for (const sx of [-1, 1]) {
      plasterPb.box(0.16, springH + 0.08, 0.18, cx + sx * (nicheW * 0.5 + 0.08), curTierY + 0.14 + springH * 0.5, nicheZ + 0.04);
    }
    plasterPb.box(nicheW + 0.42, 0.12, 0.22, cx, curTierY + 0.16, nicheZ + 0.06);
    const hoodArch = new THREE.CylinderGeometry(nicheW * 0.5 + 0.16, nicheW * 0.5 + 0.16, 0.20, 8, 1, false, 0, Math.PI);
    hoodArch.rotateZ(Math.PI * 0.5);
    hoodArch.rotateY(Math.PI * 0.5);
    hoodArch.translate(cx, curTierY + 0.14 + springH, nicheZ + 0.04);
    plasterPb.add(hoodArch);
    voidPb.box(nicheW * 0.92, nicheH * 0.88, 0.16, cx, curTierY + 0.14 + nicheH * 0.44, nicheZ + 0.01);

    // Gilded seated Buddha statue inside each south niche
    const bScale = Math.max(0.24, 0.44 - tier * 0.028);
    const bBaseY = curTierY + 0.20;
    goldPb.cyl(0.55 * bScale, 0.65 * bScale, 0.22 * bScale, 6, cx, bBaseY + 0.11 * bScale, nicheZ + 0.03);
    goldPb.cone(0.48 * bScale, 0.85 * bScale, 6, cx, bBaseY + 0.62 * bScale, nicheZ + 0.03);
    goldPb.sphere(0.22 * bScale, 5, 4, cx, bBaseY + 1.15 * bScale, nicheZ + 0.04);

    // Arched molded lime-plaster windows on East, West, North + blind arched panels on all 4 diagonal faces
    const otherFaces: Array<{ ang: number; isCardinal: boolean }> = [
      { ang: 0, isCardinal: true },
      { ang: Math.PI * 0.5, isCardinal: true },
      { ang: Math.PI, isCardinal: true },
      { ang: Math.PI * 0.25, isCardinal: false },
      { ang: Math.PI * 0.75, isCardinal: false },
      { ang: Math.PI * 1.25, isCardinal: false },
      { ang: Math.PI * 1.75, isCardinal: false }
    ];
    for (const face of otherFaces) {
      const fx = cx + Math.cos(face.ang) * (apothem + 0.02);
      const fz = tpdZ - Math.sin(face.ang) * (apothem + 0.02);
      const fYaw = face.ang + Math.PI * 0.5;
      const fw = nicheW * (face.isCardinal ? 0.78 : 0.62);
      const fh = nicheH * (face.isCardinal ? 0.76 : 0.66);
      plasterPb.box(fw + 0.16, fh * 0.76, 0.10, fx, midY - fh * 0.08, fz, { ry: fYaw });
      plasterPb.cyl(fw * 0.5 + 0.06, fw * 0.5 + 0.06, 0.12, 6, fx, midY + fh * 0.28, fz, { rx: Math.PI * 0.5, rz: -fYaw });
      plasterPb.box(fw + 0.24, 0.09, 0.15, fx, midY - fh * 0.44, fz, { ry: fYaw });
      if (face.isCardinal) {
        voidPb.box(fw * 0.72, fh * 0.72, 0.13, fx, midY - 0.04, fz, { ry: fYaw });
      } else {
        brickPb.box(fw * 0.68, fh * 0.64, 0.13, fx, midY - 0.04, fz, { ry: fYaw });
      }
    }

    curTierY += th - 0.04;
  }

  // Tier-7 Octagonal Pyramidal Cap Roof (*ngói lưu ly xanh*) + Flush Gilded Bronze *Pháp Luân* Spire
  const topCapGeo = createPolygonalCurvedEaveRoof(8, 0.22, tierRadii[6] + 0.48, 1.35, 0.22, 3);
  topCapGeo.rotateY(rotOct);
  topCapGeo.translate(cx, curTierY - 0.08, tpdZ);
  jadeEavePb.add(topCapGeo);

  const spireBaseY = curTierY + 1.20;
  stonePb.cyl(0.46, 0.62, 0.36, 8, cx, spireBaseY + 0.12, tpdZ, { ry: rotOct });
  goldPb.add(...createLotusPetalRingParts(cx, spireBaseY + 0.32, tpdZ, 0.42, 8, 1, true));
  goldPb.sphere(0.32, 7, 5, cx, spireBaseY + 0.58, tpdZ, [1.0, 1.18, 1.0]);
  goldPb.cyl(0.06, 0.11, 1.65, 6, cx, spireBaseY + 1.45, tpdZ);
  for (let r = 0; r < 5; r++) {
    goldPb.cyl(0.24 - r * 0.025, 0.24 - r * 0.025, 0.045, 6, cx, spireBaseY + 0.92 + r * 0.16, tpdZ);
  }
  const wheelY = spireBaseY + 1.88;
  const wheelRing = new THREE.TorusGeometry(0.34, 0.045, 5, 10);
  wheelRing.translate(cx, wheelY, tpdZ);
  goldPb.add(wheelRing);
  for (let sp = 0; sp < 4; sp++) {
    const spAng = (sp * Math.PI) / 4;
    goldPb.box(0.66, 0.045, 0.045, cx, wheelY, tpdZ, { rz: spAng });
    // Small Dharma-wheel outer rim pearls
    goldPb.sphere(0.055, 4, 3, cx + Math.cos(spAng) * 0.40, wheelY + Math.sin(spAng) * 0.40, tpdZ);
    goldPb.sphere(0.055, 4, 3, cx - Math.cos(spAng) * 0.40, wheelY - Math.sin(spAng) * 0.40, tpdZ);
  }
  goldPb.cone(0.11, 0.42, 6, cx, wheelY + 0.52, tpdZ);

  // LẦU CHUÔNG (West Pavilion at cx - 15.2, z = 127.6 — housing 1710 Bronze *Đại Hồng Chung*)
  const lcX = cx - 15.2;
  const lcZ = 127.6;
  stonePb.box(6.8, 0.68, 6.8, lcX, yTowerTerrace + 0.26, lcZ);
  batTrangPb.box(6.4, 0.08, 6.4, lcX, yTowerTerrace + 0.62, lcZ);
  // South entry steps into Lầu Chuông
  for (let st = 0; st < 2; st++) {
    const stH = (st + 1) * 0.30;
    stonePb.box(2.2, stH + 0.12, 0.44, lcX, yTowerTerrace + stH * 0.5 - 0.06, lcZ + 3.68 - st * 0.38);
  }
  const lcFloorY = yTowerTerrace + 0.64;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      brickPb.box(0.68, 3.45, 0.68, lcX + sx * 2.55, lcFloorY + 1.62, lcZ + sz * 2.55);
      plasterPb.box(0.76, 0.16, 0.76, lcX + sx * 2.55, lcFloorY + 3.32, lcZ + sz * 2.55);
      ironwoodPb.cyl(0.14, 0.16, 3.60, 6, lcX + sx * 1.25, lcFloorY + 1.65, lcZ + sz * 1.25);
      // Corner hip ridge struts on lower & upper roof
      plasterPb.strut(
        new THREE.Vector3(lcX + sx * 1.9, lcFloorY + 4.55, lcZ + sz * 1.9),
        new THREE.Vector3(lcX + sx * 3.85, lcFloorY + 3.42, lcZ + sz * 3.85),
        0.045,
        0.055,
        4
      );
    }
  }
  const lcRoof1 = createHueImperialHipRoofGeometry(7.9, 7.9, 3.8, 3.8, 1.35, 0.34, 4, 3);
  lcRoof1.translate(lcX, lcFloorY + 3.28, lcZ);
  terraRoofPb.add(lcRoof1);
  ochrePb.box(3.9, 1.05, 3.9, lcX, lcFloorY + 4.55, lcZ);
  // Recessed *cổ lầu* clerestory louver windows on all 4 sides of upper tier
  for (const s of [-1, 1]) {
    voidPb.box(1.55, 0.52, 0.14, lcX, lcFloorY + 4.58, lcZ + s * 1.94);
    voidPb.box(0.14, 0.52, 1.55, lcX + s * 1.94, lcFloorY + 4.58, lcZ);
    plasterPb.box(1.75, 0.10, 0.18, lcX, lcFloorY + 4.88, lcZ + s * 1.94);
    plasterPb.box(0.18, 0.10, 1.75, lcX + s * 1.94, lcFloorY + 4.88, lcZ);
  }
  const lcRoof2 = createHueImperialHipRoofGeometry(5.4, 5.4, 0.55, 0.55, 1.45, 0.32, 4, 3);
  lcRoof2.translate(lcX, lcFloorY + 5.02, lcZ);
  terraRoofPb.add(lcRoof2);
  appendLeanLotusFinial(goldPb, lcX, lcFloorY + 6.42, lcZ, 0.90);

  // Heavy ironwood crossbeam, *Bồ Lao* dragon suspension loop, 1710 Bronze Bell & chain-suspended striking log
  ironwoodPb.box(4.8, 0.24, 0.26, lcX, lcFloorY + 2.92, lcZ);
  bronzePb.cyl(0.18, 0.22, 0.42, 6, lcX, lcFloorY + 2.68, lcZ);
  goldPb.box(0.56, 0.16, 0.24, lcX, lcFloorY + 2.74, lcZ);
  stonePb.cyl(0.85, 0.98, 0.18, 8, lcX, lcFloorY + 0.09, lcZ);
  bronzePb.add(...createBronzeBellParts(lcX, lcFloorY + 0.55, lcZ, 1.62));
  // Grounded/suspended wooden striking log (*chày kình*) hung by twin bronze chains from crossbeam!
  woodPb.cyl(0.11, 0.11, 1.85, 6, lcX + 1.45, lcFloorY + 1.35, lcZ, { rz: Math.PI * 0.5 });
  bronzePb.cyl(0.025, 0.025, 1.56, 4, lcX + 1.05, lcFloorY + 2.13, lcZ);
  bronzePb.cyl(0.025, 0.025, 1.56, 4, lcX + 1.85, lcFloorY + 2.13, lcZ);

  // NHÀ BIA (East Pavilion at cx + 15.2, z = 127.6 — housing 1715 Marble Tortoise Stele)
  const nbX = cx + 15.2;
  const nbZ = 127.6;
  stonePb.cyl(3.95, 4.25, 0.68, 6, nbX, yTowerTerrace + 0.26, nbZ);
  batTrangPb.cyl(3.75, 3.75, 0.08, 6, nbX, yTowerTerrace + 0.62, nbZ);
  // South entry steps into Nhà Bia
  for (let st = 0; st < 2; st++) {
    const stH = (st + 1) * 0.30;
    stonePb.box(2.1, stH + 0.12, 0.44, nbX, yTowerTerrace + stH * 0.5 - 0.06, nbZ + 3.92 - st * 0.38);
  }
  const nbFloorY = yTowerTerrace + 0.64;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = nbX + Math.cos(a) * 2.95;
    const pz = nbZ + Math.sin(a) * 2.95;
    brickPb.box(0.58, 3.45, 0.58, px, nbFloorY + 1.62, pz, { ry: -a });
    plasterPb.box(0.66, 0.16, 0.66, px, nbFloorY + 3.32, pz, { ry: -a });
    // Hexagonal hip ridge struts & upturned corner tips
    const ha = (i / 6) * Math.PI * 2;
    plasterPb.strut(
      new THREE.Vector3(nbX + Math.cos(ha) * 1.88, nbFloorY + 4.46, nbZ + Math.sin(ha) * 1.88),
      new THREE.Vector3(nbX + Math.cos(ha) * 4.48, nbFloorY + 3.44, nbZ + Math.sin(ha) * 4.48),
      0.045,
      0.055,
      4
    );
  }
  const nbRoof1 = createPolygonalCurvedEaveRoof(6, 1.85, 4.55, 1.25, 0.32, 3);
  nbRoof1.translate(nbX, nbFloorY + 3.28, nbZ);
  terraRoofPb.add(nbRoof1);
  ochrePb.cyl(1.92, 1.92, 0.95, 6, nbX, nbFloorY + 4.48, nbZ);
  // Clerestory recessed dark louvers on the hexagonal upper drum
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    voidPb.box(0.95, 0.46, 0.12, nbX + Math.cos(a) * 1.70, nbFloorY + 4.50, nbZ + Math.sin(a) * 1.70, { ry: -a + Math.PI * 0.5 });
  }
  const nbRoof2 = createPolygonalCurvedEaveRoof(6, 0.18, 3.15, 1.35, 0.30, 3);
  nbRoof2.translate(nbX, nbFloorY + 4.90, nbZ);
  terraRoofPb.add(nbRoof2);
  appendLeanLotusFinial(goldPb, nbX, nbFloorY + 6.20, nbZ, 0.90);

  marblePb.add(...createCarvedTurtleSteleParts(nbX, nbFloorY + 0.02, nbZ, 0, 1.52));
  // Carved stone offering incense altar in front of the 1715 marble turtle stele
  stonePb.box(1.15, 0.62, 0.65, nbX, nbFloorY + 0.31, nbZ + 1.95);
  bronzePb.cyl(0.20, 0.16, 0.24, 6, nbX, nbFloorY + 0.74, nbZ + 1.95);

  // Lầu Chuông & Nhà Bia Octagonal Courtyard Stone Benches (*Ghế Đá Thanh*) & Huế Porcelain-Mosaic *Bình Phong* Screen Walls
  const courtyardBenches: Array<{ bx: number; bz: number; ry: number }> = [
    { bx: cx - 15.2, bz: 136.2, ry: 0 },
    { bx: cx + 15.2, bz: 136.2, ry: 0 },
    { bx: cx - 10.2, bz: 135.2, ry: Math.PI * 0.25 },
    { bx: cx + 10.2, bz: 135.2, ry: -Math.PI * 0.25 }
  ];
  for (const bench of courtyardBenches) {
    const cosR = Math.cos(bench.ry);
    const sinR = Math.sin(bench.ry);
    for (const ls of [-0.72, 0.72]) {
      stonePb.box(0.24, 0.42, 0.56, bench.bx + cosR * ls, yTowerTerrace + 0.21, bench.bz - sinR * ls, { ry: bench.ry });
    }
    granitePb.box(1.92, 0.12, 0.62, bench.bx, yTowerTerrace + 0.46, bench.bz, { ry: bench.ry });
    stonePb.box(1.86, 0.42, 0.10, bench.bx + sinR * 0.24, yTowerTerrace + 0.72, bench.bz + cosR * 0.24, { ry: bench.ry });
    plasterPb.box(1.70, 0.08, 0.13, bench.bx + sinR * 0.24, yTowerTerrace + 0.94, bench.bz + cosR * 0.24, { ry: bench.ry });
  }
  // Pair of Huế Porcelain-Mosaic *Bình Phong* Screen Walls framing the outer Lầu Chuông & Nhà Bia courtyard
  for (const sx of [-1, 1]) {
    const bpX = cx + sx * 23.8;
    const bpZ = 127.6;
    const bpYaw = sx > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    stonePb.box(0.92, 0.42, 4.8, bpX, yTowerTerrace + 0.21, bpZ);
    plasterPb.box(0.42, 2.32, 4.1, bpX, yTowerTerrace + 1.56, bpZ);
    // Porcelain-mosaic central relief medallion (*Khảm Sành Sứ*) on inner & outer faces
    jadeEavePb.box(0.48, 1.48, 2.55, bpX, yTowerTerrace + 1.58, bpZ);
    crimsonPb.box(0.51, 1.12, 2.15, bpX, yTowerTerrace + 1.58, bpZ);
    goldPb.add(...createShouCharacterParts(bpX - sx * 0.28, yTowerTerrace + 1.58, bpZ, 0.42, 'tron', bpYaw));
    for (const wz of [-1, 1]) {
      ochrePb.box(0.54, 2.38, 0.42, bpX, yTowerTerrace + 1.58, bpZ + wz * 2.18);
      plasterPb.box(0.64, 1.45, 0.58, bpX, yTowerTerrace + 1.12, bpZ + wz * 2.62);
      stonePb.cone(0.18, 0.26, 4, bpX, yTowerTerrace + 1.98, bpZ + wz * 2.62, { ry: Math.PI * 0.25 });
    }
    terraRoofPb.box(0.78, 0.24, 4.75, bpX, yTowerTerrace + 2.84, bpZ);
    plasterPb.box(0.24, 0.22, 4.35, bpX, yTowerTerrace + 3.04, bpZ);
    goldPb.sphere(0.14, 5, 4, bpX, yTowerTerrace + 3.24, bpZ);
  }

  // --------------------------------------------------------------------------
  // C. CỔNG TAM QUAN, ĐIỆN ĐẠI HÙNG, ĐIỆN ĐỊA TẠNG & VƯỜN THÔNG (z = 65..119) — MT-063..110
  // --------------------------------------------------------------------------
  for (let s = 0; s < 7; s++) {
    const t = (s + 1) / 7;
    const stY = THREE.MathUtils.lerp(yTowerTerrace + 0.08, yMainCourt, t);
    const stZ = THREE.MathUtils.lerp(119.4, 115.2, t);
    stonePb.box(12.4, stY - yTowerTerrace + 3.2, 0.72, cx, stY - (stY - yTowerTerrace + 3.2) * 0.5, stZ);
  }
  for (const sx of [-1, 1]) {
    stonePb.add(...createGuardianBeastParts(cx + sx * 6.4, yTowerTerrace + 0.12, 119.6, 0, 0.95, 'nghe'));
  }

  stonePb.box(58.0, skirtDepth, 32.8, cx, yMainCourt - skirtDepth * 0.5, 98.8);
  batTrangPb.box(56.4, 0.08, 31.4, cx, yMainCourt + 0.04, 98.8);

  // CỔNG TAM QUAN (3-Arch, 2-Tier Huế Monastery Gatehouse at z = 113.0, width 17.6m)
  const tqZ = 113.0;
  const tqH = 4.65;
  const tqD = 3.4;
  const tqCenterArch = createArchedWallGeometry(6.8, tqH, tqD, 3.1, 3.55);
  tqCenterArch.translate(cx, yMainCourt - 0.06, tqZ);
  ochrePb.add(tqCenterArch);
  for (const sx of [-1, 1]) {
    const sideArch = createArchedWallGeometry(5.4, tqH * 0.92, tqD * 0.94, 2.2, 2.95);
    sideArch.translate(cx + sx * 6.1, yMainCourt - 0.06, tqZ);
    ochrePb.add(sideArch);
    for (const leafSide of [-1, 1]) {
      crimsonPb.box(0.95, 2.75, 0.12, cx + sx * 6.1 + leafSide * 0.98, yMainCourt + 1.38, tqZ - 0.4, { ry: leafSide * 1.15 });
    }
    // Standing Hộ Pháp / Kim Cang guardian statues flanking the Tam Quan bays
    appendLeanSacredStatue(plasterPb, goldPb, cx + sx * 3.35, yMainCourt + 0.06, tqZ + 1.82, 0, 0.95, true);
  }
  for (const leafSide of [-1, 1]) {
    crimsonPb.box(1.35, 3.25, 0.14, cx + leafSide * 1.42, yMainCourt + 1.62, tqZ - 0.55, { ry: leafSide * 1.18 });
  }
  // Molded lime-white archivolts, pilasters & vertical *câu đối* couplet panels framing all 3 Tam Quan arches
  addArchVoussoirRing(plasterPb, stonePb, cx, yMainCourt + (3.55 - 1.55) - 0.06, tqZ + tqD * 0.5 + 0.06, 1.58, 0.28, 0.16, 9, 0);
  for (const sx of [-1, 1]) {
    addArchVoussoirRing(plasterPb, stonePb, cx + sx * 6.1, yMainCourt + (2.95 - 1.10) - 0.06, tqZ + tqD * 0.47 + 0.06, 1.12, 0.24, 0.14, 7, 0);
    for (const pOff of [2.45, 4.35, 8.25]) {
      plasterPb.box(0.46, tqH - 0.35, 0.18, cx + sx * pOff, yMainCourt + (tqH - 0.35) * 0.5, tqZ + tqD * 0.5 + 0.04);
    }
    crimsonPb.box(0.32, 2.35, 0.12, cx + sx * 2.45, yMainCourt + 2.05, tqZ + tqD * 0.5 + 0.12);
    goldPb.box(0.36, 0.10, 0.14, cx + sx * 2.45, yMainCourt + 3.24, tqZ + tqD * 0.5 + 0.12);
  }
  plasterPb.box(18.0, 0.24, tqD + 0.35, cx, yMainCourt + tqH - 0.10, tqZ);

  const tqRoof1 = createHueImperialHipRoofGeometry(19.4, 5.8, 10.6, 3.2, 1.35, 0.36, 4, 3);
  tqRoof1.translate(cx, yMainCourt + tqH - 0.12, tqZ);
  terraRoofPb.add(tqRoof1);

  const tqUpY = yMainCourt + tqH + 1.15;
  crimsonPb.box(9.6, 2.45, 3.1, cx, tqUpY + 1.22, tqZ);
  plasterPb.box(2.2, 1.35, 3.22, cx, tqUpY + 1.25, tqZ);
  // Upper *Lầu Tam Quan* triple arched balcony doors & carved crimson balustrade
  for (const bxOff of [-2.8, 0, 2.8]) {
    voidPb.box(1.35, 1.55, 0.16, cx + bxOff, tqUpY + 1.05, tqZ + 1.54);
    goldPb.box(1.48, 0.14, 0.18, cx + bxOff, tqUpY + 1.88, tqZ + 1.55);
  }
  plasterPb.box(9.8, 0.52, 0.18, cx, tqUpY + 0.26, tqZ + 1.66);
  const tqRoof2 = createHueImperialHipRoofGeometry(11.6, 5.2, 5.4, 1.2, 1.55, 0.40, 4, 3);
  tqRoof2.translate(cx, tqUpY + 2.38, tqZ);
  terraRoofPb.add(tqRoof2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      plasterPb.strut(
        new THREE.Vector3(cx + sx * 2.7, tqUpY + 3.88, tqZ + sz * 0.60),
        new THREE.Vector3(cx + sx * 5.75, tqUpY + 2.52, tqZ + sz * 2.55),
        0.05,
        0.06,
        4
      );
    }
  }
  const tqFinials = createRoofFinialSetParts(cx, tqUpY + 3.90, tqZ, 5.4, 0, 0.76, false);
  terraRoofPb.add(...tqFinials.mainParts);
  goldPb.add(...tqFinials.goldParts);

  if (ctx.signageAtlas) {
    const tqPlaque = ctx.signageAtlas.createPlaqueMesh({
      text: 'THIÊN MỤ TỰ',
      subText: 'LINH MỤ CỔ TỰ • 1601',
      width: 3.1,
      height: 0.88,
      style: 'royal',
      motifSeed: 1601
    });
    tqPlaque.castShadow = false;
    tqPlaque.position.set(cx, yMainCourt + tqH - 0.58, tqZ + tqD * 0.5 + 0.08);
    group.add(tqPlaque);
  } else {
    crimsonPb.box(3.1, 0.88, 0.14, cx, yMainCourt + tqH - 0.58, tqZ + tqD * 0.5 + 0.08);
    goldPb.box(3.22, 0.98, 0.10, cx, yMainCourt + tqH - 0.58, tqZ + tqD * 0.5 + 0.05);
  }

  for (const sx of [-1, 1]) {
    ochrePb.box(9.6, 2.65, 0.52, cx + sx * 13.8, yMainCourt + 1.30, tqZ);
    darkRoofPb.box(9.9, 0.22, 0.78, cx + sx * 13.8, yMainCourt + 2.68, tqZ);
    plasterPb.add(...createShouCharacterParts(cx + sx * 13.8, yMainCourt + 1.38, tqZ + 0.29, 0.42, 'tron', 0));
    ochrePb.box(0.52, 2.65, 47.0, cx + sx * 27.6, yMainCourt + 1.30, 89.5);
    darkRoofPb.box(0.78, 0.22, 47.4, cx + sx * 27.6, yMainCourt + 2.68, 89.5);
  }

  // Courtyard Bronze Incense Tripod + 8 Potted Huế Bonsai
  const tripod = createBronzeIncenseTripodParts(cx, yMainCourt + 0.06, 102.8, 1.25);
  stonePb.add(...tripod.limestoneParts);
  bronzePb.add(...tripod.bronzeParts);
  goldPb.add(...tripod.goldParts);

  for (const sx of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const bz = 100.2 + b * 2.6;
      const bx = cx + sx * (5.6 + (b % 2) * 3.4);
      stonePb.box(0.86, 0.58, 0.86, bx, yMainCourt + 0.29, bz);
      marblePb.cyl(0.56, 0.44, 0.34, 6, bx, yMainCourt + 0.74, bz);
      barkPb.cyl(0.06, 0.11, 0.78, 5, bx, yMainCourt + 1.18, bz, { rz: sx * 0.28 });
      const bPad1 = new THREE.IcosahedronGeometry(0.46, 0);
      bPad1.scale(1.25, 0.48, 1.15);
      bPad1.translate(bx - sx * 0.18, yMainCourt + 1.54, bz);
      const bPad2 = new THREE.IcosahedronGeometry(0.36, 0);
      bPad2.scale(1.18, 0.45, 1.10);
      bPad2.translate(bx + sx * 0.24, yMainCourt + 1.34, bz + 0.12);
      foliagePb.add(bPad1, bPad2);
    }
  }

  // ĐIỆN ĐẠI HÙNG (5-Bay *Trùng Thiềm Điệp Ốc* Main Sanctuary centered at cx, z = 90.8)
  const dhZ = 90.8;
  const dhPlinthH = 0.86;
  const dhFloorY = yMainCourt + dhPlinthH;
  stonePb.box(23.6, dhPlinthH + 0.35, 15.8, cx, yMainCourt + (dhPlinthH - 0.35) * 0.5, dhZ);
  batTrangPb.box(22.8, 0.08, 15.0, cx, dhFloorY + 0.04, dhZ);
  for (const stX of [-6.2, 0, 6.2]) {
    for (let st = 0; st < 4; st++) {
      const f = (st + 1) / 4;
      stonePb.box(stX === 0 ? 3.8 : 2.4, dhPlinthH * f + 0.2, 0.44, cx + stX, yMainCourt + (dhPlinthH * f) * 0.5 - 0.1, dhZ + 8.65 - st * 0.42);
    }
    // Carved stone cheek curbs flanking each Điện Đại Hùng front staircase
    const cheekHalfW = stX === 0 ? 2.12 : 1.38;
    for (const cs of [-1, 1]) {
      stonePb.box(0.28, dhPlinthH * 0.85, 1.85, cx + stX + cs * cheekHalfW, yMainCourt + dhPlinthH * 0.42, dhZ + 8.02);
      if (stX === 0) {
        appendLeanLotusFinial(stonePb, cx + cs * cheekHalfW, yMainCourt + dhPlinthH * 0.84, dhZ + 8.82, 0.56);
      }
    }
  }
  stonePb.add(
    ...createMotifBandParts('hoi_van', cx - 11.4, dhZ + 7.92, cx + 11.4, dhZ + 7.92, yMainCourt + 0.45, 0.16, 0.05)
  );

  // Điện Đại Hùng Front Verandah Bronze *Hạc Chầu Quy* Cranes & Glazed Porcelain Bonsai Pots
  for (const sx of [-1, 1]) {
    const crX = cx + sx * 2.85;
    const crZ = 97.65;
    stonePb.box(0.84, 0.14, 0.84, crX, dhFloorY + 0.07, crZ);
    bronzePb.add(...createBronzeCraneOnTortoiseParts(crX, dhFloorY + 0.14, crZ, sx * -0.22, 0.90));
    goldPb.sphere(0.07, 4, 3, crX - sx * 0.06, dhFloorY + 1.92, crZ + 0.24);

    // Pair of glazed Huế porcelain bonsai pots flanking the front staircases
    for (const potOff of [3.9, 9.6]) {
      const px = cx + sx * potOff;
      const pz = 99.45;
      stonePb.box(0.76, 0.54, 0.76, px, yMainCourt + 0.27, pz);
      marblePb.cyl(0.52, 0.36, 0.38, 8, px, yMainCourt + 0.72, pz);
      jadeEavePb.cyl(0.55, 0.53, 0.07, 8, px, yMainCourt + 0.92, pz);
      goldPb.cyl(0.47, 0.45, 0.045, 8, px, yMainCourt + 0.74, pz);
      barkPb.cyl(0.055, 0.095, 0.72, 5, px, yMainCourt + 1.24, pz, { rz: sx * 0.26 });
      const pPad1 = new THREE.IcosahedronGeometry(0.40, 0);
      pPad1.scale(1.22, 0.46, 1.12);
      pPad1.translate(px - sx * 0.16, yMainCourt + 1.58, pz);
      const pPad2 = new THREE.IcosahedronGeometry(0.32, 0);
      pPad2.scale(1.15, 0.44, 1.08);
      pPad2.translate(px + sx * 0.22, yMainCourt + 1.38, pz + 0.10);
      foliagePb.add(pPad1, pPad2);
    }
  }

  const bayXs = [-9.6, -5.8, -2.1, 2.1, 5.8, 9.6];
  const colZRows = [96.6, 92.2, 89.2, 85.0];
  for (const bxOff of bayXs) {
    for (const czRow of colZRows) {
      const colH = czRow > 91.0 ? 4.35 : 4.95;
      // Molded octagonal Thanh-stone lotus column base + -0.15m embedded ironwood column
      stonePb.cyl(0.32, 0.36, 0.14, 8, cx + bxOff, dhFloorY + 0.07, czRow);
      stonePb.cyl(0.23, 0.30, 0.12, 8, cx + bxOff, dhFloorY + 0.18, czRow);
      ironwoodPb.cyl(0.18, 0.21, colH + 0.23, 6, cx + bxOff, dhFloorY + colH * 0.5 - 0.04, czRow);
    }
  }

  for (const sx of [-1, 1]) {
    ochrePb.box(0.38, 4.65, 11.8, cx + sx * 10.1, dhFloorY + 2.30, dhZ - 0.2);
    ironwoodPb.box(3.5, 3.85, 0.18, cx + sx * 7.7, dhFloorY + 1.92, 96.4);
    goldPb.add(...createShouCharacterParts(cx + sx * 7.7, dhFloorY + 2.05, 96.52, 0.38, 'tron', 0));
  }
  ochrePb.box(20.4, 4.95, 0.42, cx, dhFloorY + 2.45, 84.8);

  goldPb.add(...createCuaVongParts(cx, dhFloorY + 3.55, 96.55, 4.0, 0.85, 0, 'long_phung'));
  // Front eave *xà* tie-beam, *đấu củng* eave brackets, gilded *hoành phi* signboard & vertical *câu đối* couplets
  ironwoodPb.box(19.6, 0.24, 0.28, cx, dhFloorY + 4.12, 96.6);
  for (const bxOff of bayXs) {
    goldPb.box(0.28, 0.26, 0.62, cx + bxOff, dhFloorY + 3.98, 96.88);
  }
  crimsonPb.box(2.85, 0.72, 0.10, cx, dhFloorY + 3.92, 96.48);
  goldPb.box(2.96, 0.80, 0.06, cx, dhFloorY + 3.92, 96.45);
  for (const sx of [-1, 1]) {
    goldPb.box(3.55, 0.28, 0.10, cx + sx * 3.95, dhFloorY + 3.82, 96.55);
    crimsonPb.box(3.45, 0.22, 0.08, cx + sx * 3.95, dhFloorY + 3.55, 96.55);
    // Vertical gilded *câu đối* couplet boards mounted on central front columns
    crimsonPb.box(0.28, 2.35, 0.08, cx + sx * 2.1, dhFloorY + 2.25, 96.84);
    goldPb.box(0.32, 0.10, 0.10, cx + sx * 2.1, dhFloorY + 3.44, 96.84);
  }
  for (const cvX of [-3.95, 0, 3.95]) {
    const hLan = createRibbedLanternShellGeometry(0.24, 0.46, 5, 3, 'pumpkin');
    hLan.translate(cx + cvX, dhFloorY + 3.32, 97.25);
    silkPb.add(hLan);
    const hCap = createLanternCapGeometry(0.24, 0.46, true);
    hCap.translate(cx + cvX, dhFloorY + 3.32, 97.25);
    ironwoodPb.add(hCap);
  }

  // *Trùng Thiềm Điệp Ốc* Twin Interlocking Curved Imperial Roofs (castShadow = true ONLY on daiHungRoofPb!)
  const tdRoof = createHueImperialHipRoofGeometry(24.4, 8.2, 16.2, 2.2, 2.25, 0.42, 5, 3);
  tdRoof.translate(cx, dhFloorY + 4.25, 94.4);
  daiHungRoofPb.add(tdRoof);

  const cdRoof = createHueImperialHipRoofGeometry(25.2, 9.6, 17.0, 2.6, 2.85, 0.46, 5, 3);
  cdRoof.translate(cx, dhFloorY + 4.85, 88.2);
  daiHungRoofPb.add(cdRoof);
  patinaPb.box(21.2, 0.24, 0.65, cx, dhFloorY + 4.48, 91.5);

  // Flush *Lưỡng Long Chầu Nguyệt* & *Kìm Nóc* ridge finials seated directly into roof ridges!
  daiHungRoofPb.box(16.0, 0.26, 0.28, cx, dhFloorY + 6.48, 94.4);
  goldPb.sphere(0.24, 6, 5, cx, dhFloorY + 6.82, 94.4);
  for (const sx of [-1, 1]) {
    goldPb.cone(0.16, 0.65, 5, cx + sx * 7.8, dhFloorY + 6.78, 94.4, { rz: -sx * 0.45 });
  }

  const cdFinials = createRoofFinialSetParts(cx, dhFloorY + 7.66, 88.2, 16.8, 0, 1.08, true);
  daiHungRoofPb.add(...cdFinials.mainParts);
  goldPb.add(...cdFinials.goldParts);

  // Gleaming Bronze *Tam Thế Phật* Triad inside Điện Đại Hùng
  crimsonPb.box(9.6, 1.18, 2.8, cx, dhFloorY + 0.59, 87.6);
  goldPb.box(9.8, 0.16, 2.95, cx, dhFloorY + 1.18, 87.6);
  // Front lacquer offering table with bronze altar censer, twin candlesticks & lotus vases
  crimsonPb.box(4.4, 0.96, 1.15, cx, dhFloorY + 0.48, 90.4);
  goldPb.box(4.52, 0.10, 1.24, cx, dhFloorY + 0.98, 90.4);
  bronzePb.cyl(0.24, 0.18, 0.36, 6, cx, dhFloorY + 1.20, 90.4);
  for (const sx of [-1, 1]) {
    bronzePb.cyl(0.06, 0.11, 0.52, 5, cx + sx * 1.15, dhFloorY + 1.28, 90.4);
    goldPb.cyl(0.11, 0.08, 0.34, 6, cx + sx * 1.75, dhFloorY + 1.19, 90.4);
  }
  const centerBuddha = createSculptedDeityParts(cx, dhFloorY + 1.20, 87.6, 0, 0.98, 'amitabha');
  bronzePb.add(...centerBuddha.bodyParts);
  goldPb.add(...centerBuddha.accentParts);
  for (const sx of [-1, 1]) {
    appendLeanSacredStatue(bronzePb, goldPb, cx + sx * 2.95, dhFloorY + 1.20, 87.6, 0, 1.02, false);
    bronzePb.add(...createBronzeCraneOnTortoiseParts(cx + sx * 4.6, dhFloorY + 0.04, 90.4, sx * -0.35, 1.08));
  }
  ironwoodPb.box(1.65, 2.15, 0.18, cx + 6.2, dhFloorY + 1.08, 92.8);
  bronzePb.box(1.12, 0.68, 0.08, cx + 6.2, dhFloorY + 1.38, 92.8);

  // Flanking Monastic Galleries (*Nhà Tăng Đông / Tây* at cx ± 19.6, z = 92.0)
  for (const sx of [-1, 1]) {
    const gx = cx + sx * 19.6;
    stonePb.box(5.6, 0.56, 16.4, gx, yMainCourt + 0.24, 92.0);
    ochrePb.box(4.8, 3.35, 15.6, gx, yMainCourt + 2.15, 92.0);
    for (let k = -2; k <= 2; k++) {
      ironwoodPb.cyl(0.11, 0.13, 3.45, 5, gx - sx * 2.45, yMainCourt + 2.12, 92.0 + k * 3.2);
    }
    const gRoof = createGableRoofGeometry(5.8, 16.8, 1.45, 0.16, 'z');
    gRoof.translate(gx, yMainCourt + 3.80, 92.0);
    darkRoofPb.add(gRoof);
  }

  // REAR GARDEN TERRACE: ĐIỆN ĐỊA TẠNG, HỒ SEN TỊNH TÂM, THÁP MỘ THÍCH ĐÔN HẬU & VƯỜN THÔNG (z = 65..82.5)
  stonePb.box(56.0, skirtDepth, 18.0, cx, yRearGarden - skirtDepth * 0.5, 73.5);
  batTrangPb.box(22.0, 0.08, 16.5, cx, yRearGarden + 0.04, 73.8);

  const dtZ = 75.2;
  const dtFloorY = yRearGarden + 0.52;
  stonePb.box(13.6, 0.64, 8.6, cx, yRearGarden + 0.22, dtZ);
  ochrePb.box(12.2, 3.65, 7.2, cx, dtFloorY + 1.80, dtZ);
  for (const bxOff of [-4.8, -1.6, 1.6, 4.8]) {
    ironwoodPb.cyl(0.14, 0.16, 3.80, 6, cx + bxOff, dtFloorY + 1.78, dtZ + 3.72);
  }
  voidPb.box(2.4, 2.75, 0.24, cx, dtFloorY + 1.38, dtZ + 3.55);
  appendLeanSacredStatue(goldPb, goldPb, cx, dtFloorY + 0.50, dtZ + 1.2, 0, 0.88, false);
  const dtRoof = createHueImperialHipRoofGeometry(14.8, 9.8, 8.2, 2.2, 1.95, 0.36, 4, 3);
  dtRoof.translate(cx, dtFloorY + 3.58, dtZ);
  terraRoofPb.add(dtRoof);
  goldPb.box(8.2, 0.18, 0.22, cx, dtFloorY + 5.56, dtZ);

  // Hồ Sen Tịnh Tâm (Sacred Lotus Pond at cx - 17.5, z = 74.2 — 11.2m × 8.8m)
  const pondX = cx - 17.5;
  const pondZ = 74.2;
  const pondWaterY = yRearGarden + 0.18;
  granitePb.box(11.4, 0.14, 9.0, pondX, yRearGarden + 0.05, pondZ);
  for (const sx of [-1, 1]) {
    stonePb.box(0.55, 0.58, 9.4, pondX + sx * 5.6, yRearGarden + 0.26, pondZ);
    stonePb.box(11.6, 0.58, 0.55, pondX, yRearGarden + 0.26, pondZ + sx * 4.4);
  }
  const pondWaterGeo = new THREE.PlaneGeometry(10.6, 8.2);
  pondWaterGeo.rotateX(-Math.PI * 0.5);
  pondWaterGeo.translate(pondX, pondWaterY, pondZ);
  pondWaterGeo.computeBoundingBox();
  pondWaterGeo.computeBoundingSphere();
  const pondWaterMesh = new THREE.Mesh(
    pondWaterGeo,
    ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof
  );
  pondWaterMesh.name = 'ThienMuLotusPondWater';
  pondWaterMesh.castShadow = false;
  pondWaterMesh.receiveShadow = true;
  group.add(pondWaterMesh);

  stonePb.box(2.2, 0.22, 8.8, pondX, pondWaterY + 0.34, pondZ);
  const lotusRand = mulberry32(190108);
  for (let i = 0; i < 16; i++) {
    const lx = pondX + (lotusRand() - 0.5) * 9.2;
    if (Math.abs(lx - pondX) < 1.35) continue;
    const lz = pondZ + (lotusRand() - 0.5) * 6.8;
    const pad = createNotchedLotusPadGeometry(0.24 + lotusRand() * 0.14, 6);
    pad.rotateY(lotusRand() * Math.PI * 2);
    pad.translate(lx, pondWaterY + 0.03, lz);
    foliagePb.add(pad);
    if (i % 3 === 0) {
      crimsonPb.cone(0.11, 0.22, 5, lx, pondWaterY + 0.15, lz);
      goldPb.cyl(0.05, 0.03, 0.06, 5, lx, pondWaterY + 0.24, lz);
    }
  }

  // Tháp Mộ Hòa Thượng Thích Đôn Hậu (7-Tier Octagonal Stone Stupa in East Rear Pine Garden at cx + 17.5, z = 73.6)
  const stupaX = cx + 17.5;
  const stupaZ = 73.6;
  stonePb.cyl(2.65, 2.95, 0.58, 8, stupaX, yRearGarden + 0.25, stupaZ, { ry: rotOct });
  appendLeanStoneBalustrade(stonePb, stupaX - 3.2, stupaZ + 3.2, stupaX + 3.2, stupaZ + 3.2, yRearGarden + 0.06, 0.72, 2.1);
  let stY = yRearGarden + 0.52;
  for (let t = 0; t < 7; t++) {
    const r = 1.45 - t * 0.13;
    const h = 0.78 - t * 0.045;
    plasterPb.cyl(r * 0.94, r, h + 0.05, 8, stupaX, stY + h * 0.5, stupaZ, { ry: rotOct });
    stonePb.cyl(r + 0.34, r + 0.24, 0.16, 8, stupaX, stY + h, stupaZ, { ry: rotOct });
    stY += h + 0.10;
  }
  appendLeanLotusFinial(goldPb, stupaX, stY - 0.04, stupaZ, 0.80);

  // Rear Enclosure Wall, Stone Garden Lanterns & Vườn Thông Thiên Mụ Pines (>= 8.5m clear of all buildings!)
  ochrePb.box(55.6, 2.65, 0.52, cx, yRearGarden + 1.30, 65.4);
  darkRoofPb.box(56.0, 0.22, 0.78, cx, yRearGarden + 2.68, 65.4);
  for (const sx of [-1, 1]) {
    stonePb.add(...createAncientStoneLanternParts(cx + sx * 8.2, yRearGarden + 0.04, 69.2, 1.05));
    const rock = createSculptedRockGeometry(900 + sx, 1.4, 0.95, 1.2, 1);
    rock.translate(cx + sx * 10.6, yRearGarden + 0.35, 68.0);
    granitePb.add(rock);
  }

  const pineSpots: Array<[number, number, number, number]> = [
    [cx - 25.5, yRearGarden, 67.2, 13.8],
    [cx - 11.2, yRearGarden, 66.8, 14.5],
    [cx + 11.2, yRearGarden, 66.8, 14.2],
    [cx + 25.5, yRearGarden, 67.2, 13.6],
    [cx - 33.5, ctx.getHeight(cx - 33.5, 88.0), 88.0, 15.0],
    [cx + 33.5, ctx.getHeight(cx + 33.5, 88.0), 88.0, 14.8],
    [cx - 33.5, ctx.getHeight(cx - 33.5, 118.0), 118.0, 14.2],
    [cx + 33.5, ctx.getHeight(cx + 33.5, 118.0), 118.0, 14.4]
  ];
  for (let pIdx = 0; pIdx < pineSpots.length; pIdx++) {
    const [px, py, pz, ph] = pineSpots[pIdx];
    appendHeritageTree(barkPb, foliagePb, null, px, py, pz, ph, 'pine', 3200 + pIdx);
  }

  // Five-stripe rippled Buddhist flag beside Cổng Tam Quan + GPU Incense Smoke
  ironwoodPb.cyl(0.06, 0.09, 8.8, 5, cx - 10.2, yMainCourt + 4.25, 108.5);
  goldPb.sphere(0.14, 5, 4, cx - 10.2, yMainCourt + 8.72, 108.5);
  const flagGeo = new THREE.PlaneGeometry(2.1, 1.35, 5, 2);
  const fPos = flagGeo.attributes.position;
  for (let vi = 0; vi < fPos.count; vi++) {
    const u = (fPos.getX(vi) + 1.05) / 2.1;
    fPos.setZ(vi, Math.sin(u * Math.PI * 2.2) * 0.14 * u);
  }
  flagGeo.computeVertexNormals();
  flagGeo.translate(cx - 10.2 + 1.05, yMainCourt + 7.85, 108.5);
  goldPb.add(flagGeo);
  crimsonPb.box(2.12, 0.28, 0.06, cx - 10.2 + 1.05, yMainCourt + 8.36, 108.5);

  const smokeSys = createIncenseSmokeSystem(
    [{ x: cx, y: tripod.smokeY, z: 102.8, scale: 1.15 }],
    ctx.sharedShaders?.incenseSmoke
  );
  smokeSys.mesh.castShadow = false;
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(smokeSys.mesh.material as THREE.Material);
    animatedUniforms.push(smokeSys.uniforms);
  }
  group.add(smokeSys.mesh);

  tagMotifIds(group, [
    'HV-A03', 'HV-A04', 'HV-B01', 'HV-C01', 'HV-C02', 'HV-C03',
    'HV-D01', 'HV-D02', 'HV-D04', 'HV-D12', 'HV-I01', 'HV-NEW-MB-12'
  ]);

  // STRICT SHADOW POLICY: castShadow = true ONLY on Tháp Phước Duyên & Điện Đại Hùng!
  const meshes: Array<THREE.Mesh | null> = [
    finalizeMesh('ThapPhuocDuyenTowerMesh', towerBrickPb, ctx.materials.chamBrick, true, 1.8),
    finalizeMesh(
      'DienDaiHungMainMesh',
      daiHungRoofPb,
      ctx.huePack?.thanhLuuLyMat ?? ctx.materials.darkRoof,
      true
    ),
    finalizeMesh('ThienMuStoneMasonry', stonePb, ctx.materials.stone, false, 2.4),
    finalizeMesh('ThienMuGraniteChannel', granitePb, ctx.materials.granite, false, 2.8),
    finalizeMesh('ThienMuWhitePlaster', plasterPb, ctx.materials.whitePlaster, false, 2.2),
    finalizeMesh(
      'ThienMuOchreWalls',
      ochrePb,
      ctx.materials.agedYellowPlaster ?? ctx.materials.yellowOchrePlaster,
      false,
      2.4
    ),
    finalizeMesh(
      'ThienMuWhiteMarbleStele',
      marblePb,
      ctx.materials.whiteMarble ?? ctx.materials.whitePlaster,
      false
    ),
    finalizeMesh(
      'ThienMuBrickStructures',
      brickPb,
      ctx.materials.weatheredImperialBrick ?? ctx.materials.chamBrick,
      false,
      2.0
    ),
    finalizeMesh(
      'ThienMuBatTrangCourtyard',
      batTrangPb,
      ctx.materials.batTrangFloor ?? ctx.materials.terracottaRoof,
      false,
      1.8
    ),
    finalizeMesh('ThienMuDarkRoofs', darkRoofPb, ctx.materials.darkRoof, false),
    finalizeMesh(
      'ThienMuJadeGlazedEaves',
      jadeEavePb,
      ctx.huePack?.thanhLuuLyMat ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof,
      false
    ),
    finalizeMesh('ThienMuTerracottaRoofs', terraRoofPb, ctx.materials.terracottaRoof, false),
    finalizeMesh('ThienMuCrimsonLacquer', crimsonPb, ctx.materials.crimsonLacquer, false),
    finalizeMesh(
      'ThienMuIronwoodColumns',
      ironwoodPb,
      ctx.materials.darkIronwood ?? ctx.materials.darkWood,
      false
    ),
    finalizeMesh('ThienMuTimberBoats', woodPb, ctx.materials.darkWood, false),
    finalizeMesh('ThienMuGildedAccents', goldPb, ctx.materials.gold, false),
    finalizeMesh('ThienMuSacredBronzes', bronzePb, ctx.materials.bronze, false),
    finalizeMesh(
      'ThienMuPatinaAccents',
      patinaPb,
      ctx.materials.bronzePatina ?? ctx.materials.bronze,
      false
    ),
    finalizeMesh('ThienMuDarkRecesses', voidPb, ctx.materials.darkVoid, false),
    finalizeMesh('ThienMuLanternSilk', silkPb, ctx.materials.lanternSilk, false),
    finalizeMesh(
      'ThienMuLanternCores',
      corePb,
      ctx.materials.lanternCore ?? ctx.materials.stainedGlass ?? ctx.materials.gold,
      false
    ),
    finalizeMesh('ThienMuTreeBark', barkPb, ctx.materials.bark, false),
    finalizeMesh(
      'ThienMuPineFoliage',
      foliagePb,
      ctx.materials.jadeRoof ?? ctx.materials.darkRoof,
      false
    ),
    finalizeMesh(
      'ThienMuWillowFoliage',
      willowFoliagePb,
      ctx.materials.bronzePatina ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof,
      false
    )
  ];

  for (const m of meshes) {
    if (m) group.add(m);
  }

  ctx.scene.add(group);
  return group;
}

// ============================================================================
// 2. THÀNH NHÀ HỒ (TÂY ĐÔ, THANH HÓA — UNESCO 1397) (-1120, -360)
//    Implements MT-111..MT-220 (110 distinct architectural details)
// ============================================================================
function buildThanhNhaHoCitadelComplex(
  ctx: VietnamBuilderContext,
  animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }>
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ThanhNhaHoCitadelComplex';

  const cx = -1120.0;
  const cz = -360.0;

  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 64.0 },
    { x: cx, z: -292.0, r: 46.0 },
    { x: cx, z: -264.0, r: 36.0 }
  );

  const maxCitadelTerrain = sampleMaxTerrainHeight(ctx, cx - 58, cx + 58, -412, -248, 7, 7);
  const yBase = maxCitadelTerrain + 0.68;
  const skirtDepth = 6.2;

  const namMonGranitePb = new PartsBuilder(); // castShadow = true!
  const stonePb = new PartsBuilder();
  const granitePb = new PartsBuilder();
  const mossyPb = new PartsBuilder();
  const plasterPb = new PartsBuilder();
  const marblePb = new PartsBuilder();
  const batTrangPb = new PartsBuilder();
  const ironwoodPb = new PartsBuilder();
  const woodPb = new PartsBuilder();
  const terraRoofPb = new PartsBuilder();
  const darkRoofPb = new PartsBuilder();
  const bronzePb = new PartsBuilder();
  const goldPb = new PartsBuilder();
  const crimsonPb = new PartsBuilder();
  const voidPb = new PartsBuilder();
  const barkPb = new PartsBuilder();
  const foliagePb = new PartsBuilder();

  stonePb.box(90.0, skirtDepth, 90.0, cx, yBase - skirtDepth * 0.5, cz);
  stonePb.box(96.0, skirtDepth, 24.0, cx, yBase - skirtDepth * 0.5, -284.0);

  // --------------------------------------------------------------------------
  // A. MONUMENTAL NAM MÔN (SOUTH GATE at z = -318, 38.0m wide × 9.5m tall!) — MT-111..145
  // --------------------------------------------------------------------------
  const namZ = -318.0;
  const namW = 38.0;
  const namH = 9.5;
  const namD = 9.6;

  granitePb.box(namW + 1.2, skirtDepth, namD + 1.2, cx, yBase - skirtDepth * 0.5, namZ);

  const namArches: Array<{ xOff: number; bayW: number; archW: number; archH: number }> = [
    { xOff: 0.0, bayW: 13.6, archW: 5.8, archH: 6.8 },
    { xOff: -12.2, bayW: 12.2, archW: 4.5, archH: 5.6 },
    { xOff: 12.2, bayW: 12.2, archW: 4.5, archH: 5.6 }
  ];

  for (const va of namArches) {
    const vx = cx + va.xOff;
    const springY = va.archH - va.archW * 0.5;
    // Continuous full-depth (9.6m) monolithic stone barrel vault!
    const archGeo = createArchedWallGeometry(va.bayW + 0.08, namH, namD, va.archW, va.archH);
    archGeo.translate(vx, yBase - 0.08, namZ);
    namMonGranitePb.add(archGeo);

    // Wedge-shaped radial stone voussoirs (*đá múi bưởi*) on both South & North facades
    addArchVoussoirRing(
      stonePb,
      granitePb,
      vx,
      yBase + springY - 0.08,
      namZ + namD * 0.5 + 0.08,
      va.archW * 0.5 + 0.04,
      0.86,
      0.32,
      13,
      0
    );
    addArchVoussoirRing(
      stonePb,
      granitePb,
      vx,
      yBase + springY - 0.08,
      namZ - namD * 0.5 - 0.08,
      va.archW * 0.5 + 0.04,
      0.86,
      0.32,
      11,
      0
    );

    // Interior barrel-vault *đá múi bưởi* stone arch ribs continuing through the 9.6m tunnel
    for (const ribZ of [-2.4, 0, 2.4]) {
      addArchVoussoirRing(
        stonePb,
        granitePb,
        vx,
        yBase + springY - 0.08,
        namZ + ribZ,
        va.archW * 0.5 - 0.06,
        0.34,
        0.52,
        9,
        0
      );
    }

    // Paved blue-limestone vault roadway, beveled threshold slabs & open studded ironwood gate leaves
    granitePb.box(va.archW + 0.4, 0.14, namD + 1.2, vx, yBase + 0.06, namZ);
    stonePb.box(va.archW + 0.2, 0.18, 0.65, vx, yBase + 0.10, namZ + namD * 0.44);
    stonePb.box(va.archW + 0.2, 0.18, 0.65, vx, yBase + 0.10, namZ - namD * 0.44);
    for (const leafSide of [-1, 1]) {
      const hingeX = vx + leafSide * (va.archW * 0.46);
      stonePb.cyl(0.28, 0.32, 0.24, 6, hingeX, yBase + 0.12, namZ + namD * 0.26);
      const leafW = va.archW * 0.46;
      const leafH = va.archH * 0.78;
      const leafYaw = leafSide * 1.22;
      const leafZ = namZ + namD * 0.26 - Math.cos(1.22) * leafW * 0.45;
      const leafCenterX = hingeX - leafSide * (1.0 - Math.sin(1.22)) * leafW * 0.45;
      ironwoodPb.box(leafW, leafH, 0.22, leafCenterX, yBase + leafH * 0.5 + 0.08, leafZ, { ry: leafYaw });
      bronzePb.add(
        ...createDoorStudGridParts(leafCenterX, yBase + leafH * 0.52, leafZ + 0.12, leafW * 0.82, leafH * 0.80, 3, 3, leafYaw)
      );
    }
  }

  // Visible Massive Cyclopean Blue-Grey Limestone Block Courses (`granite` + `stone` alternating courses & beveled joints)
  const pierSpecs: Array<[number, number]> = [
    [-16.7, 4.4],
    [-6.35, 2.9],
    [6.35, 2.9],
    [16.7, 4.4]
  ];
  for (const [pxOff, pw] of pierSpecs) {
    // Stepped battered blue-limestone plinth footing (*chân thành*) at the base of each Nam Môn pier
    granitePb.box(pw + 0.42, 0.44, namD + 0.56, cx + pxOff, yBase + 0.18, namZ);
    for (let row = 0; row < 6; row++) {
      const bh = 1.08;
      const by = yBase + 0.56 + row * 1.14;
      const stagger = (row % 2) * 0.32 - 0.16;
      const targetPb = row % 2 === 0 ? granitePb : stonePb;
      for (const zFace of [-1, 1]) {
        targetPb.box(
          pw * 0.94,
          bh,
          0.26,
          cx + pxOff + stagger * 0.4,
          by,
          namZ + zFace * (namD * 0.5 + 0.06)
        );
      }
    }
  }
  for (let uRow = 0; uRow < 2; uRow++) {
    const uy = yBase + 7.55 + uRow * 1.08;
    const cols = 9;
    const blockW = (namW - 0.4) / cols;
    for (let c = 0; c < cols; c++) {
      const bx = cx - namW * 0.5 + 0.2 + (c + 0.5) * blockW;
      const targetPb = (c + uRow) % 2 === 0 ? granitePb : stonePb;
      for (const zFace of [-1, 1]) {
        targetPb.box(blockW - 0.10, 0.98, 0.28, bx, uy, namZ + zFace * (namD * 0.5 + 0.07));
      }
    }
  }
  for (const sx of [-1, 1]) {
    for (let r = 0; r < 7; r++) {
      const targetPb = r % 2 === 0 ? stonePb : granitePb;
      targetPb.box(0.28, 1.12, namD - 0.5, cx + sx * (namW * 0.5 + 0.06), yBase + 0.65 + r * 1.22, namZ);
    }
  }

  // Parapet cornice, 13 stone merlons & 4 carved Dragon-Head Drainage Spouts
  stonePb.box(namW + 0.65, 0.32, namD + 0.65, cx, yBase + namH - 0.06, namZ);
  const merlonCount = 13;
  for (let m = 0; m < merlonCount; m++) {
    const mx = cx - (namW * 0.46) + (m / (merlonCount - 1)) * (namW * 0.92);
    for (const zSide of [-1, 1]) {
      granitePb.box(1.55, 0.92, 0.56, mx, yBase + namH + 0.52, namZ + zSide * (namD * 0.5 - 0.28));
      stonePb.box(1.68, 0.14, 0.66, mx, yBase + namH + 1.02, namZ + zSide * (namD * 0.5 - 0.28));
    }
  }
  for (const spX of [-13.5, -5.8, 5.8, 13.5]) {
    const sx = cx + spX;
    const sy = yBase + namH - 0.35;
    const sz = namZ + namD * 0.5 + 0.55;
    stonePb.box(0.46, 0.38, 1.15, sx, sy, sz);
    stonePb.sphere(0.24, 5, 4, sx, sy + 0.06, sz + 0.52, [0.95, 0.88, 1.25]);
    voidPb.cyl(0.09, 0.09, 0.35, 5, sx, sy - 0.04, sz + 0.62, { rx: Math.PI * 0.5 });
  }
  for (const sx of [-1, 1]) {
    for (let st = 0; st < 10; st++) {
      const f = (st + 1) / 10;
      stonePb.box(2.2, namH * f, 0.95, cx + sx * (16.2 - st * 0.45), yBase + (namH * f) * 0.5, namZ - namD * 0.5 - 1.1);
    }
  }

  // Nam Môn Top-of-Wall Stone Patrol Walkway (*Đường Tuần Đạo Đá Thanh*) & 4 Watch-Brazier Tripods (*Chậu Lửa Hiệu*)
  const namTopY = yBase + namH + 0.10;
  granitePb.box(35.6, 0.14, 3.2, cx, namTopY + 0.07, namZ);
  for (const zSide of [-1, 1]) {
    stonePb.box(35.6, 0.18, 0.34, cx, namTopY + 0.09, namZ + zSide * 1.78);
    stonePb.box(36.8, 0.22, 0.42, cx, namTopY + 0.11, namZ + zSide * (namD * 0.5 - 0.28));
  }
  for (let ps = 0; ps < 10; ps++) {
    const px = cx - 15.3 + ps * 3.4;
    stonePb.box(1.15, 0.05, 2.95, px, namTopY + 0.15, namZ);
  }
  for (const bxOff of [-14.2, -5.6, 5.6, 14.2]) {
    const bx = cx + bxOff;
    const bz = namZ + 2.85;
    stonePb.cyl(0.46, 0.54, 0.18, 6, bx, namTopY + 0.09, bz);
    for (let leg = 0; leg < 3; leg++) {
      const la = (leg / 3) * Math.PI * 2;
      bronzePb.cyl(0.05, 0.06, 0.68, 4, bx + Math.cos(la) * 0.24, namTopY + 0.50, bz + Math.sin(la) * 0.24);
    }
    bronzePb.cyl(0.44, 0.24, 0.34, 8, bx, namTopY + 0.94, bz);
    goldPb.cyl(0.47, 0.45, 0.06, 8, bx, namTopY + 1.12, bz);
    crimsonPb.cone(0.32, 0.20, 6, bx, namTopY + 1.16, bz);
    goldPb.sphere(0.13, 5, 4, bx, namTopY + 1.24, bz);
  }

  // --------------------------------------------------------------------------
  // B. 88m × 88m EARTHEN-BACKED CYCLOPEAN STONE RAMPARTS & ĐÔNG / TÂY / BẮC MÔN — MT-146..168
  // --------------------------------------------------------------------------
  const wallH = 6.2;
  const halfCit = 42.0;
  const subGateW = 16.4;
  const subGateH = 7.6;
  const subGateD = 6.8;

  const addRampartRun = (x0: number, z0: number, x1: number, z1: number, inwardNormalX: number, inwardNormalZ: number) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) return;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const isAlongX = Math.abs(dx) >= Math.abs(dz);
    const w = isAlongX ? len : 2.8;
    const d = isAlongX ? 2.8 : len;

    granitePb.box(w, skirtDepth, d, mx, yBase - skirtDepth * 0.5, mz);
    granitePb.add(createBatteredFrustum(isAlongX ? w : 2.2, w, isAlongX ? 2.2 : d, d, wallH, mx, yBase + wallH * 0.5, mz));
    stonePb.box(isAlongX ? w : 2.45, 0.24, isAlongX ? 2.45 : d, mx, yBase + wallH + 0.08, mz);

    const outX = mx - inwardNormalX * 1.44;
    const outZ = mz - inwardNormalZ * 1.44;
    // Stepped cyclopean base footing (*chân thành*) + staggered individual blue-limestone monolith courses
    granitePb.box(isAlongX ? w : 0.48, 0.42, isAlongX ? 0.48 : d, mx - inwardNormalX * 1.56, yBase + 0.16, mz - inwardNormalZ * 1.56);
    const blockCount = Math.max(4, Math.min(12, Math.round(len / 3.4)));
    const blockStep = (len - 0.8) / blockCount;
    for (let r = 0; r < 4; r++) {
      const by = yBase + 0.96 + r * 1.32;
      const stagger = (r % 2) * (blockStep * 0.42);
      for (let b = 0; b < blockCount; b++) {
        const offset = -len * 0.5 + 0.4 + (b + 0.5) * blockStep + (b === blockCount - 1 ? 0 : stagger * 0.35);
        const bx = isAlongX ? mx + offset : outX;
        const bz = isAlongX ? outZ : mz + offset;
        const targetPb = (r + b) % 2 === 0 ? stonePb : granitePb;
        targetPb.box(
          isAlongX ? blockStep * 0.90 : 0.24,
          1.08,
          isAlongX ? 0.24 : blockStep * 0.90,
          bx,
          by,
          bz
        );
      }
    }
    // Weathered stone parapet merlons along the rampart crest
    const rampMerlons = Math.max(3, Math.round(len / 5.2));
    for (let m = 0; m < rampMerlons; m++) {
      const t = (m + 0.5) / rampMerlons - 0.5;
      const mX = isAlongX ? mx + t * (len - 2.4) : mx - inwardNormalX * 0.85;
      const mZ = isAlongX ? mz - inwardNormalZ * 0.85 : mz + t * (len - 2.4);
      granitePb.box(isAlongX ? 1.55 : 0.48, 0.76, isAlongX ? 0.48 : 1.55, mX, yBase + wallH + 0.46, mZ);
    }

    const earthX = mx + inwardNormalX * 2.45;
    const earthZ = mz + inwardNormalZ * 2.45;
    mossyPb.add(
      createBatteredFrustum(
        isAlongX ? w : 1.8,
        isAlongX ? w : 4.2,
        isAlongX ? 1.8 : d,
        isAlongX ? 4.2 : d,
        wallH - 0.55,
        earthX,
        yBase + (wallH - 0.55) * 0.5,
        earthZ
      )
    );
  };

  addRampartRun(cx - 43.4, namZ, cx - 19.0, namZ, 0, -1);
  addRampartRun(cx + 19.0, namZ, cx + 43.4, namZ, 0, -1);
  addRampartRun(cx - 43.4, cz - halfCit, cx - subGateW * 0.5, cz - halfCit, 0, 1);
  addRampartRun(cx + subGateW * 0.5, cz - halfCit, cx + 43.4, cz - halfCit, 0, 1);
  addRampartRun(cx - halfCit, cz - halfCit, cx - halfCit, cz - subGateW * 0.5, 1, 0);
  addRampartRun(cx - halfCit, cz + subGateW * 0.5, cx - halfCit, namZ, 1, 0);
  addRampartRun(cx + halfCit, cz - halfCit, cx + halfCit, cz - subGateW * 0.5, -1, 0);
  addRampartRun(cx + halfCit, cz + subGateW * 0.5, cx + halfCit, namZ, -1, 0);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bx = cx + sx * 42.6;
      const bz = cz + sz * 42.0;
      granitePb.box(5.8, skirtDepth, 5.8, bx, yBase - skirtDepth * 0.5, bz);
      granitePb.add(createBatteredFrustum(4.8, 5.6, 4.8, 5.6, wallH + 0.55, bx, yBase + (wallH + 0.55) * 0.5, bz));
      stonePb.box(5.1, 0.26, 5.1, bx, yBase + wallH + 0.62, bz);
    }
  }

  // Scaled Single-Arch Monolithic Gates: Bắc Môn, Đông Môn, Tây Môn
  const secondaryGates: Array<{ gx: number; gz: number; yaw: number }> = [
    { gx: cx, gz: cz - halfCit, yaw: 0 },
    { gx: cx + halfCit, gz: cz, yaw: Math.PI * 0.5 },
    { gx: cx - halfCit, gz: cz, yaw: -Math.PI * 0.5 }
  ];
  for (const sg of secondaryGates) {
    const isEW = Math.abs(sg.yaw) > 0.5;
    granitePb.box(isEW ? subGateD : subGateW, skirtDepth, isEW ? subGateW : subGateD, sg.gx, yBase - skirtDepth * 0.5, sg.gz);
    const gArch = createArchedWallGeometry(subGateW, subGateH, subGateD, 4.6, 5.4);
    if (sg.yaw !== 0) gArch.rotateY(sg.yaw);
    gArch.translate(sg.gx, yBase - 0.06, sg.gz);
    granitePb.add(gArch);

    const outOff = subGateD * 0.5 + 0.08;
    for (const faceDir of [1, -1]) {
      addArchVoussoirRing(
        stonePb,
        granitePb,
        sg.gx + (sg.yaw > 0 ? faceDir * outOff : sg.yaw < 0 ? -faceDir * outOff : 0),
        yBase + (5.4 - 2.3) - 0.06,
        sg.gz + (sg.yaw === 0 ? -faceDir * outOff : 0),
        2.34,
        0.72,
        0.28,
        9,
        sg.yaw
      );
    }
    // Staggered cyclopean pier ashlar blocks flanking each secondary gate arch
    for (const ps of [-1, 1]) {
      for (let r = 0; r < 4; r++) {
        const targetPb = r % 2 === 0 ? stonePb : granitePb;
        const pOff = ps * 5.25;
        targetPb.box(
          isEW ? 0.24 : 4.2,
          1.15,
          isEW ? 4.2 : 0.24,
          sg.gx + (isEW ? (sg.yaw > 0 ? outOff : -outOff) : pOff),
          yBase + 0.72 + r * 1.38,
          sg.gz + (isEW ? pOff : -outOff)
        );
      }
    }
    stonePb.box(isEW ? subGateD + 0.4 : subGateW + 0.4, 0.28, isEW ? subGateW + 0.4 : subGateD + 0.4, sg.gx, yBase + subGateH - 0.04, sg.gz);
    for (let m = -2; m <= 2; m++) {
      const off = m * 3.2;
      granitePb.box(
        isEW ? 0.52 : 1.45,
        0.78,
        isEW ? 1.45 : 0.52,
        sg.gx + (isEW ? (sg.yaw > 0 ? 2.9 : -2.9) : off),
        yBase + subGateH + 0.45,
        sg.gz + (isEW ? off : -2.9)
      );
    }
    for (const ls of [-1, 1]) {
      ironwoodPb.box(
        2.05,
        4.2,
        0.18,
        sg.gx + (isEW ? 0 : ls * 2.05),
        yBase + 2.1,
        sg.gz + (isEW ? ls * 2.05 : 0),
        { ry: sg.yaw + ls * 1.15 }
      );
    }
  }

  // --------------------------------------------------------------------------
  // C. HỘ THÀNH HÀ MOAT, CẦU ĐÁ, UNESCO STELE & BI ĐÁ CÔNG THÀNH PAVILION — MT-169..188
  // --------------------------------------------------------------------------
  const moatW = 94.0;
  const moatZ0 = -310.2;
  const moatZ1 = -297.8;
  const moatMidZ = (moatZ0 + moatZ1) * 0.5;
  const moatSpanZ = moatZ1 - moatZ0;
  const moatWaterY = yBase - 0.24;

  granitePb.box(moatW + 2.0, 0.24, moatSpanZ + 1.2, cx, moatWaterY - 0.24, moatMidZ);
  for (const zRim of [moatZ0 - 0.55, moatZ1 + 0.55]) {
    stonePb.box(moatW + 2.4, skirtDepth, 1.25, cx, yBase + 0.28 - skirtDepth * 0.5, zRim);
  }
  for (const sx of [-1, 1]) {
    stonePb.box(1.25, skirtDepth, moatSpanZ + 2.4, cx + sx * (moatW * 0.5 + 0.6), yBase + 0.28 - skirtDepth * 0.5, moatMidZ);
  }

  const moatWaterGeo = new THREE.PlaneGeometry(moatW - 0.4, moatSpanZ - 0.2);
  moatWaterGeo.rotateX(-Math.PI * 0.5);
  moatWaterGeo.translate(cx, moatWaterY, moatMidZ);
  moatWaterGeo.computeBoundingBox();
  moatWaterGeo.computeBoundingSphere();
  const moatWaterMesh = new THREE.Mesh(
    moatWaterGeo,
    ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof
  );
  moatWaterMesh.name = 'HoThanhHaMoatWater';
  moatWaterMesh.castShadow = false;
  moatWaterMesh.receiveShadow = true;
  group.add(moatWaterMesh);

  // Cầu Đá Nam Môn (Arched Blue-Limestone Bridge spanning Hộ Thành Hà)
  const bridgeW = 9.2;
  const bridgeArch = createArchedWallGeometry(moatSpanZ + 1.6, 1.45, bridgeW, 5.4, 1.05);
  bridgeArch.rotateY(Math.PI * 0.5);
  bridgeArch.translate(cx, moatWaterY - 0.35, moatMidZ);
  granitePb.add(bridgeArch);
  stonePb.box(bridgeW + 0.35, 0.24, moatSpanZ + 2.2, cx, yBase + 0.22, moatMidZ);
  for (const sx of [-1, 1]) {
    // Radial blue-limestone voussoir ring framing both sides of the bridge arch
    addArchVoussoirRing(
      stonePb,
      granitePb,
      cx + sx * (bridgeW * 0.5 + 0.08),
      moatWaterY - 0.35 + (1.05 - 2.7),
      moatMidZ,
      2.72,
      0.34,
      0.20,
      7,
      Math.PI * 0.5
    );
    // Stepped stone cutwater piers flanking the bridge abutments in the moat
    for (const sz of [-1, 1]) {
      granitePb.box(0.85, 1.25, 1.65, cx + sx * (bridgeW * 0.5 + 0.42), moatWaterY + 0.10, moatMidZ + sz * 3.6);
      stonePb.cone(0.42, 0.55, 4, cx + sx * (bridgeW * 0.5 + 0.42), moatWaterY + 0.92, moatMidZ + sz * 3.6, { ry: Math.PI * 0.25 });
    }
    appendLeanStoneBalustrade(
      stonePb,
      cx + sx * (bridgeW * 0.5 - 0.2),
      moatZ0 - 0.8,
      cx + sx * (bridgeW * 0.5 - 0.2),
      moatZ1 + 0.8,
      yBase + 0.32,
      0.88,
      2.6
    );
    appendLeanLotusFinial(stonePb, cx + sx * (bridgeW * 0.5 - 0.2), yBase + 1.18, moatZ1 + 0.9, 0.80);
    appendLeanLotusFinial(stonePb, cx + sx * (bridgeW * 0.5 - 0.2), yBase + 1.18, moatZ0 - 0.9, 0.80);
  }
  // Floating lotus pads along the calm east/west expanses of Hộ Thành Hà moat
  const moatRand = mulberry32(139704);
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const lx = cx + side * (8.5 + moatRand() * 34.0);
    const lz = moatZ0 + 1.5 + moatRand() * (moatSpanZ - 3.0);
    const pad = createNotchedLotusPadGeometry(0.28 + moatRand() * 0.16, 6);
    pad.rotateY(moatRand() * Math.PI * 2);
    pad.translate(lx, moatWaterY + 0.03, lz);
    foliagePb.add(pad);
    if (i % 3 === 0) {
      crimsonPb.cone(0.11, 0.20, 5, lx, moatWaterY + 0.14, lz);
    }
  }

  // UNESCO World Heritage Monolithic Blue-Stone Stele (2011) at (cx + 16.5, z = -288.5)
  const unescoX = cx + 16.5;
  const unescoZ = -288.5;
  stonePb.box(5.4, 0.45, 3.6, unescoX, yBase + 0.22, unescoZ);
  stonePb.box(3.4, 0.22, 0.68, unescoX, yBase + 0.11, unescoZ + 2.08);
  granitePb.box(4.2, 2.55, 0.68, unescoX, yBase + 1.72, unescoZ);
  stonePb.box(4.5, 0.28, 0.88, unescoX, yBase + 3.08, unescoZ);
  for (const sx of [-1, 1]) {
    stonePb.box(0.42, 1.35, 0.82, unescoX + sx * 2.28, yBase + 1.12, unescoZ);
    stonePb.cyl(0.18, 0.22, 0.72, 6, unescoX + sx * 2.45, yBase + 0.80, unescoZ + 1.55);
    appendLeanLotusFinial(stonePb, unescoX + sx * 2.45, yBase + 1.14, unescoZ + 1.55, 0.46);
  }
  if (ctx.signageAtlas) {
    const unescoPlaque = ctx.signageAtlas.createPlaqueMesh({
      text: 'THÀNH NHÀ HỒ',
      subText: 'DI SẢN VĂN HÓA THẾ GIỚI UNESCO • 1397',
      width: 3.5,
      height: 1.35,
      style: 'stone',
      motifSeed: 1397
    });
    unescoPlaque.castShadow = false;
    unescoPlaque.position.set(unescoX, yBase + 1.78, unescoZ + 0.36);
    group.add(unescoPlaque);
  } else {
    marblePb.box(3.5, 1.35, 0.08, unescoX, yBase + 1.78, unescoZ + 0.36);
    goldPb.box(3.62, 1.45, 0.05, unescoX, yBase + 1.78, unescoZ + 0.34);
  }

  // Visitor Exhibition Pavilion displaying Stacked *Bi Đá Công Thành* at (cx - 17.5, z = -288.5)
  const exhX = cx - 17.5;
  const exhZ = -288.5;
  stonePb.box(8.8, 0.48, 6.4, exhX, yBase + 0.24, exhZ);
  batTrangPb.box(8.4, 0.08, 6.0, exhX, yBase + 0.50, exhZ);
  stonePb.box(2.6, 0.24, 0.65, exhX, yBase + 0.12, exhZ + 3.45);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      stonePb.cyl(0.24, 0.28, 0.22, 6, exhX + sx * 3.6, yBase + 0.58, exhZ + sz * 2.4);
      ironwoodPb.cyl(0.14, 0.16, 3.35, 6, exhX + sx * 3.6, yBase + 2.02, exhZ + sz * 2.4);
    }
    // Low timber exhibition guard rail along east & west pavilion edges
    woodPb.box(0.12, 0.10, 4.7, exhX + sx * 3.6, yBase + 1.24, exhZ);
  }
  woodPb.box(7.1, 0.10, 0.12, exhX, yBase + 1.24, exhZ - 2.4);
  const exhRoof = createHueImperialHipRoofGeometry(9.8, 7.4, 4.8, 1.8, 1.55, 0.30, 4, 3);
  exhRoof.translate(exhX, yBase + 3.62, exhZ);
  terraRoofPb.add(exhRoof);
  stonePb.box(4.8, 0.18, 0.22, exhX, yBase + 5.18, exhZ);
  for (const sx of [-1, 1]) {
    goldPb.cone(0.12, 0.42, 4, exhX + sx * 2.35, yBase + 5.42, exhZ, { rz: -sx * 0.45 });
  }

  stonePb.box(3.6, 0.42, 2.2, exhX - 1.4, yBase + 0.72, exhZ);
  const biBaseY = yBase + 0.94;
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      granitePb.sphere(0.24, 5, 4, exhX - 1.4 + c * 0.52, biBaseY + 0.22, exhZ + r * 0.52);
    }
  }
  for (const cxO of [-0.26, 0.26]) {
    for (const czO of [-0.26, 0.26]) {
      stonePb.sphere(0.22, 5, 4, exhX - 1.4 + cxO, biBaseY + 0.60, exhZ + czO);
    }
  }
  granitePb.sphere(0.22, 5, 4, exhX - 1.4, biBaseY + 0.96, exhZ);
  stonePb.box(2.2, 0.36, 2.0, exhX + 2.1, yBase + 0.68, exhZ);
  for (const oz of [-0.48, 0.48]) {
    granitePb.sphere(0.34, 6, 4, exhX + 2.1, yBase + 1.18, exhZ + oz);
  }

  // --------------------------------------------------------------------------
  // D. ĐƯỜNG HOÀNG GIA, ĐIỆN HOÀNG NGUYÊN, 18 CHÂN TẢNG & ĐÔI RỒNG ĐÁ — MT-189..208
  // --------------------------------------------------------------------------
  const roadW = 7.6;
  const roadZStart = -323.0;
  const roadZEnd = -398.5;
  const roadLen = Math.abs(roadZEnd - roadZStart);
  granitePb.box(roadW, 0.14, roadLen, cx, yBase + 0.07, (roadZStart + roadZEnd) * 0.5);
  for (const sx of [-1, 1]) {
    stonePb.box(0.42, 0.22, roadLen, cx + sx * (roadW * 0.5 + 0.21), yBase + 0.11, (roadZStart + roadZEnd) * 0.5);
  }
  for (let p = 0; p < 12; p++) {
    const pz = -324.2 - p * 1.95;
    stonePb.box(roadW - 0.3, 0.05, 0.92, cx, yBase + 0.15, pz);
  }
  // 4 pairs of ancient Thanh-stone ceremonial lanterns flanking the Royal Way (*Đường Hoàng Gia*)
  for (const lz of [-328.0, -336.0, -344.0, -384.0]) {
    for (const sx of [-1, 1]) {
      stonePb.add(...createAncientStoneLanternParts(cx + sx * 4.85, yBase + 0.08, lz, 0.92));
    }
  }
  granitePb.box(78.0, 0.12, 4.8, cx, yBase + 0.06, -346.0);

  // Royal Way (*Đường Hoàng Gia*) Cut-Stone Drainage Channels (*Rãnh Thoát Nước Đá Thanh*) with Culvert Stepping Slabs
  const drainRuns: Array<{ z0: number; z1: number }> = [
    { z0: -323.5, z1: -343.0 },
    { z0: -373.0, z1: -397.5 }
  ];
  for (const run of drainRuns) {
    const segLen = Math.abs(run.z1 - run.z0);
    const midZ = (run.z0 + run.z1) * 0.5;
    for (const sx of [-1, 1]) {
      const chX = cx + sx * 5.55;
      voidPb.box(0.44, 0.04, segLen, chX, yBase + 0.05, midZ);
      granitePb.box(0.18, 0.22, segLen, chX - 0.30, yBase + 0.11, midZ);
      granitePb.box(0.18, 0.22, segLen, chX + 0.30, yBase + 0.11, midZ);
      const slabCount = Math.max(3, Math.floor(segLen / 4.8));
      for (let s = 0; s < slabCount; s++) {
        const sz = THREE.MathUtils.lerp(run.z0 - 1.6, run.z1 + 1.6, s / Math.max(1, slabCount - 1));
        stonePb.box(0.84, 0.08, 0.62, chX, yBase + 0.23, sz);
      }
    }
  }

  // Archaeological Excavation Pit (*Hố Khai Quật Khảo Cổ*), Elevated Wooden Viewing Deck & Interpretive Plaques (SW Forecourt)
  const pitX = cx - 19.2;
  const pitZ = -334.0;
  // Perimeter excavation curb & exposed dark archaeological trench bed
  voidPb.box(10.8, 0.08, 7.4, pitX, yBase + 0.05, pitZ);
  for (const s of [-1, 1]) {
    granitePb.box(11.4, 0.26, 0.34, pitX, yBase + 0.13, pitZ + s * 3.85);
    granitePb.box(0.34, 0.26, 8.0, pitX + s * 5.55, yBase + 0.13, pitZ);
  }
  // Exposed 1397 column-base footings, terracotta wall remnants & archaeological grid stakes inside the pit
  for (const fx of [-3.4, 0, 3.4]) {
    for (const fz of [-1.75, 1.75]) {
      stonePb.box(0.86, 0.24, 0.86, pitX + fx, yBase + 0.16, pitZ + fz);
      granitePb.cyl(0.32, 0.36, 0.16, 6, pitX + fx, yBase + 0.34, pitZ + fz);
    }
    woodPb.cyl(0.04, 0.04, 0.42, 4, pitX + fx, yBase + 0.24, pitZ - 3.35);
    woodPb.cyl(0.04, 0.04, 0.42, 4, pitX + fx, yBase + 0.24, pitZ + 3.35);
  }
  batTrangPb.box(7.8, 0.16, 0.56, pitX, yBase + 0.14, pitZ);
  terraRoofPb.box(2.4, 0.18, 0.48, pitX - 2.2, yBase + 0.16, pitZ - 2.65);
  terraRoofPb.box(2.8, 0.18, 0.48, pitX + 2.0, yBase + 0.16, pitZ + 2.65);

  // Elevated Timber Viewing Deck along East & South pit rims with stairs & safety guardrails
  const deckY = yBase + 0.56;
  woodPb.box(2.1, 0.14, 9.6, pitX + 6.75, deckY, pitZ + 0.9);
  woodPb.box(13.6, 0.14, 2.1, pitX + 1.0, deckY, pitZ + 5.05);
  // Grounded ironwood support posts under East & South viewing decks
  for (const pzOff of [-3.6, -1.2, 1.2, 3.6, 5.8]) {
    ironwoodPb.box(0.20, 0.58, 0.20, pitX + 5.85, yBase + 0.29, pitZ + pzOff);
    ironwoodPb.box(0.20, 0.58, 0.20, pitX + 7.65, yBase + 0.29, pitZ + pzOff);
  }
  for (const pxOff of [-5.5, -2.8, 0.0, 2.8]) {
    ironwoodPb.box(0.20, 0.58, 0.20, pitX + pxOff, yBase + 0.29, pitZ + 4.15);
    ironwoodPb.box(0.20, 0.58, 0.20, pitX + pxOff, yBase + 0.29, pitZ + 5.95);
  }
  // 3-step timber entry stairs on the East side facing the Royal Way
  for (let st = 0; st < 3; st++) {
    const f = (st + 1) / 3;
    woodPb.box(0.42, 0.54 * f, 2.2, pitX + 8.75 - st * 0.36, yBase + 0.27 * f, pitZ);
  }
  // Pit-facing safety guardrails (East & South inner edges)
  woodPb.box(0.10, 0.09, 8.2, pitX + 5.82, deckY + 0.96, pitZ);
  woodPb.box(0.10, 0.07, 8.2, pitX + 5.82, deckY + 0.52, pitZ);
  for (let b = -3.8; b <= 3.9; b += 1.9) {
    ironwoodPb.box(0.10, 0.98, 0.10, pitX + 5.82, deckY + 0.50, pitZ + b);
  }
  woodPb.box(11.6, 0.09, 0.10, pitX + 0.05, deckY + 0.96, pitZ + 4.12);
  woodPb.box(11.6, 0.07, 0.10, pitX + 0.05, deckY + 0.52, pitZ + 4.12);
  for (let b = -5.4; b <= 5.5; b += 2.2) {
    ironwoodPb.box(0.10, 0.98, 0.10, pitX + b, deckY + 0.50, pitZ + 4.12);
  }
  // 3 Angled Interpretive Archaeological Plaques mounted along the viewing deck
  const plaqueSpecs: Array<{ px: number; pz: number; isSouth: boolean }> = [
    { px: pitX + 6.08, pz: pitZ - 2.1, isSouth: false },
    { px: pitX + 6.08, pz: pitZ + 2.1, isSouth: false },
    { px: pitX, pz: pitZ + 4.38, isSouth: true }
  ];
  for (const pl of plaqueSpecs) {
    ironwoodPb.cyl(0.05, 0.06, 1.02, 5, pl.px, deckY + 0.51, pl.pz);
    if (pl.isSouth) {
      bronzePb.box(1.18, 0.68, 0.07, pl.px, deckY + 1.06, pl.pz, { rx: -0.52 });
      marblePb.box(1.06, 0.56, 0.08, pl.px, deckY + 1.07, pl.pz - 0.01, { rx: -0.52 });
      goldPb.box(1.08, 0.09, 0.09, pl.px, deckY + 1.24, pl.pz - 0.12, { rx: -0.52 });
    } else {
      bronzePb.box(0.07, 0.68, 1.18, pl.px, deckY + 1.06, pl.pz, { rz: 0.52 });
      marblePb.box(0.08, 0.56, 1.06, pl.px - 0.01, deckY + 1.07, pl.pz, { rz: 0.52 });
      goldPb.box(0.09, 0.09, 1.08, pl.px - 0.12, deckY + 1.24, pl.pz, { rz: 0.52 });
    }
  }

  // ĐIỆN HOÀNG NGUYÊN (Excavated Main Imperial Audience Hall Foundation Terrace at cx, z = -362.0)
  const dhnTerrW = 32.0;
  const dhnTerrD = 20.0;
  const dhnTerrZ = -362.0;
  const dhnTerrH = 1.45;
  const dhnTopY = yBase + dhnTerrH;

  granitePb.box(dhnTerrW, dhnTerrH + 1.5, dhnTerrD, cx, yBase + (dhnTerrH - 1.5) * 0.5, dhnTerrZ);
  stonePb.box(dhnTerrW + 0.45, 0.24, dhnTerrD + 0.45, cx, dhnTopY - 0.08, dhnTerrZ);
  batTrangPb.box(dhnTerrW - 1.2, 0.08, dhnTerrD - 1.2, cx, dhnTopY + 0.04, dhnTerrZ);
  // Excavated Ho-Dynasty stone perimeter drainage curbs framing Điện Hoàng Nguyên terrace
  for (const sx of [-1, 1]) {
    granitePb.box(0.45, 0.26, dhnTerrD + 2.2, cx + sx * (dhnTerrW * 0.5 + 1.15), yBase + 0.13, dhnTerrZ);
    // Low excavated stone balustrade along the north & side edges of the audience terrace
    appendLeanStoneBalustrade(
      stonePb,
      cx + sx * (dhnTerrW * 0.5 - 0.35),
      dhnTerrZ - dhnTerrD * 0.5 + 0.35,
      cx + sx * (dhnTerrW * 0.5 - 0.35),
      dhnTerrZ + dhnTerrD * 0.5 - 0.35,
      dhnTopY + 0.04,
      0.72,
      3.8
    );
  }
  stonePb.add(
    ...createMotifBandParts('cuc_day', cx - 15.6, dhnTerrZ + dhnTerrD * 0.5 + 0.22, cx + 15.6, dhnTerrZ + dhnTerrD * 0.5 + 0.22, yBase + 0.78, 0.20, 0.05)
  );

  // Central Imperial Staircase + THE FAMOUS 1397 *ĐÔI RỒNG ĐÁ THÀNH NHÀ HỒ* (`createCarvedDragonBalustradeParts`)!
  const dragonStairZ0 = dhnTerrZ + dhnTerrD * 0.5 + 4.2;
  const dragonStairZ1 = dhnTerrZ + dhnTerrD * 0.5 + 0.1;
  for (let st = 0; st < 9; st++) {
    const f = (st + 1) / 9;
    const stY = yBase + dhnTerrH * f;
    const stZ = THREE.MathUtils.lerp(dragonStairZ0, dragonStairZ1, f);
    stonePb.box(6.4, stY - yBase + 0.4, 0.52, cx, stY - (stY - yBase + 0.4) * 0.5, stZ);
  }
  for (const sx of [-1, 1]) {
    const dxBal = cx + sx * 3.45;
    // Stepped blue-limestone plinth cheek & carved cloud-scroll base beneath each 1397 Stone Dragon
    granitePb.box(0.78, 0.42, 4.5, dxBal, yBase + 0.21, (dragonStairZ0 + dragonStairZ1) * 0.5);
    stonePb.box(0.56, 0.62, 0.56, dxBal, yBase + 0.31, dragonStairZ0 + 0.35);
    granitePb.add(
      ...createCarvedDragonBalustradeParts(
        dxBal,
        yBase + 0.08,
        dragonStairZ0,
        dxBal,
        dhnTopY - 0.06,
        dragonStairZ1,
        1.15
      )
    );
    // Protective low stone heritage stanchions flanking the excavated 1397 Twin Stone Dragons
    for (const szOff of [0.6, 2.4, 4.2]) {
      stonePb.cyl(0.09, 0.11, 0.68, 5, cx + sx * 4.35, yBase + 0.34, dragonStairZ1 + szOff);
    }
  }

  // 18 Carved Blue-Limestone Lotus Column Bases (*18 Chân Tảng Đá Hoa Sen* — 6 × 3 grid!)
  const colGridXs = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
  const colGridZs = [-355.5, -362.0, -368.5];
  for (const gx of colGridXs) {
    for (const gz of colGridZs) {
      stonePb.box(1.12, 0.22, 1.12, cx + gx, dhnTopY + 0.11, gz);
      granitePb.cyl(0.44, 0.52, 0.24, 8, cx + gx, dhnTopY + 0.30, gz);
      stonePb.add(...createLotusPetalRingParts(cx + gx, dhnTopY + 0.38, gz, 0.46, 6, 1, false));
    }
  }
  stonePb.box(4.6, 0.38, 3.2, cx, dhnTopY + 0.22, dhnTerrZ - 1.5);
  stonePb.add(...createBasReliefPanelParts(cx, dhnTopY + 0.22, dhnTerrZ + 0.12, 3.8, 0.34, 0, 'lich_su'));
  const royalTripod = createBronzeIncenseTripodParts(cx, dhnTopY + 0.06, dhnTerrZ + 4.8, 1.05);
  stonePb.add(...royalTripod.limestoneParts);
  bronzePb.add(...royalTripod.bronzeParts);
  goldPb.add(...royalTripod.goldParts);

  // Flanking Excavated *Đông Thái Miếu* & *Tây Thái Miếu* Ancestral Shrine Foundations
  for (const sx of [-1, 1]) {
    const mx = cx + sx * 24.5;
    const mz = -364.0;
    stonePb.box(11.6, 0.72, 9.6, mx, yBase + 0.32, mz);
    batTrangPb.box(10.8, 0.08, 8.8, mx, yBase + 0.70, mz);
    for (const ox of [-3.6, 0, 3.6]) {
      for (const oz of [-2.8, 2.8]) {
        granitePb.cyl(0.32, 0.38, 0.22, 6, mx + ox, yBase + 0.82, mz + oz);
      }
    }
    marblePb.add(...createCarvedTurtleSteleParts(mx, yBase + 0.72, mz, 0, 0.92));
  }

  // --------------------------------------------------------------------------
  // E. ĐÀN NAM GIAO TÂY ĐÔ (3-TIER ALTAR) & GIẾNG VUA SQUARE STONE WELL — MT-209..220
  // --------------------------------------------------------------------------
  const ngZ = -264.0;
  stonePb.box(32.0, skirtDepth, 32.0, cx, yBase - skirtDepth * 0.5, ngZ);
  stonePb.box(24.0, 0.78, 24.0, cx, yBase + 0.39, ngZ);
  granitePb.box(23.4, 0.08, 23.4, cx, yBase + 0.80, ngZ);

  stonePb.box(16.4, 0.78, 16.4, cx, yBase + 1.18, ngZ);
  granitePb.box(15.8, 0.08, 15.8, cx, yBase + 1.59, ngZ);

  granitePb.cyl(4.8, 5.0, 0.84, 12, cx, yBase + 2.00, ngZ);
  stonePb.cyl(4.95, 4.95, 0.14, 12, cx, yBase + 2.44, ngZ);

  for (const [dx, dz] of [[0, 1], [0, -1], [-1, 0], [1, 0]] as const) {
    for (let st = 0; st < 6; st++) {
      const f = (st + 1) / 6;
      const rDist = 13.2 - st * 1.35;
      stonePb.box(
        dx === 0 ? 3.2 : 0.95,
        2.42 * f,
        dz === 0 ? 3.2 : 0.95,
        cx + dx * rDist,
        yBase + (2.42 * f) * 0.5,
        ngZ + dz * rDist
      );
    }
    // Cardinal ceremonial stone gate pillars (*cổng đá tứ phương*) framing all 4 approaches to Đàn Nam Giao
    const perpX = dz === 0 ? 0 : 1;
    const perpZ = dx === 0 ? 0 : 1;
    for (const s of [-1, 1]) {
      const px = cx + dx * 14.4 + perpX * s * 2.15;
      const pz = ngZ + dz * 14.4 + perpZ * s * 2.15;
      granitePb.box(0.68, 2.85, 0.68, px, yBase + 1.42, pz);
      stonePb.box(0.80, 0.18, 0.80, px, yBase + 2.88, pz);
      appendLeanLotusFinial(stonePb, px, yBase + 2.98, pz, 0.68);
    }
  }
  // Corner stone ceremonial lanterns on Tier-2 of Đàn Nam Giao & *Thần Khố* sacrificial hearth on the East side
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      stonePb.add(...createAncientStoneLanternParts(cx + sx * 6.8, yBase + 1.62, ngZ + sz * 6.8, 0.82));
    }
  }
  granitePb.box(2.4, 0.85, 1.8, cx + 10.6, yBase + 1.22, ngZ + 6.4);
  bronzePb.cyl(0.42, 0.32, 0.52, 6, cx + 10.6, yBase + 1.90, ngZ + 6.4);

  // Lean sculpted bronze ceremonial altar cauldron atop Viên Đàn
  stonePb.cyl(0.68, 0.78, 0.24, 8, cx, yBase + 2.60, ngZ);
  bronzePb.cyl(0.54, 0.38, 0.62, 8, cx, yBase + 3.08, ngZ);
  goldPb.cone(0.24, 0.32, 6, cx, yBase + 3.55, ngZ);

  // Đàn Nam Giao Ceremonial Stone Offering Altar (*Bàn Thờ Đá Tế Giao*) atop Viên Đàn & Grand Bronze Tripod on Tier-2
  const altarZ = ngZ + 2.35;
  const altarBaseY = yBase + 2.51;
  granitePb.box(2.85, 0.22, 1.15, cx, altarBaseY + 0.11, altarZ);
  stonePb.box(2.55, 0.74, 0.90, cx, altarBaseY + 0.58, altarZ);
  marblePb.box(1.48, 0.42, 0.08, cx, altarBaseY + 0.58, altarZ + 0.46);
  for (const sx of [-1, 1]) {
    plasterPb.box(0.22, 0.74, 0.96, cx + sx * 1.24, altarBaseY + 0.58, altarZ);
  }
  granitePb.box(2.98, 0.14, 1.24, cx, altarBaseY + 1.02, altarZ);
  // Ceremonial bronze altar censer, twin candlesticks & sacrificial libation chalices
  bronzePb.cyl(0.20, 0.15, 0.30, 6, cx, altarBaseY + 1.24, altarZ);
  for (const sx of [-1, 1]) {
    bronzePb.cyl(0.05, 0.09, 0.42, 5, cx + sx * 0.76, altarBaseY + 1.30, altarZ);
    goldPb.cone(0.06, 0.12, 4, cx + sx * 0.76, altarBaseY + 1.56, altarZ);
    goldPb.cyl(0.09, 0.06, 0.22, 6, cx + sx * 1.16, altarBaseY + 1.20, altarZ);
  }
  const ngTripod = createBronzeIncenseTripodParts(cx - 4.2, yBase + 1.63, ngZ + 5.8, 0.96);
  stonePb.add(...ngTripod.limestoneParts);
  bronzePb.add(...ngTripod.bronzeParts);
  goldPb.add(...ngTripod.goldParts);

  // GIẾNG VUA (Ancient Stepped Square Blue-Limestone Royal Well at cx - 21.5, z = -264.0)
  const wellX = cx - 21.5;
  const wellZ = -264.0;
  stonePb.box(7.8, skirtDepth, 7.8, wellX, yBase - skirtDepth * 0.5, wellZ);
  for (const sx of [-1, 1]) {
    granitePb.box(0.62, 0.82, 7.2, wellX + sx * 3.3, yBase + 0.41, wellZ);
    granitePb.box(7.2, 0.82, 0.62, wellX, yBase + 0.41, wellZ + sx * 3.3);
    stonePb.box(0.45, 0.48, 5.4, wellX + sx * 2.45, yBase + 0.24, wellZ);
    stonePb.box(5.4, 0.48, 0.45, wellX, yBase + 0.24, wellZ + sx * 2.45);
    // Corner carved stone lotus posts around Giếng Vua well parapet
    for (const sz of [-1, 1]) {
      stonePb.box(0.76, 1.05, 0.76, wellX + sx * 3.3, yBase + 0.52, wellZ + sz * 3.3);
      appendLeanLotusFinial(stonePb, wellX + sx * 3.3, yBase + 1.04, wellZ + sz * 3.3, 0.52);
    }
  }
  // 4-sided descending interior limestone steps leading down to the sacred circular well rim
  for (const [dx, dz] of [[0, 1], [0, -1], [-1, 0], [1, 0]] as const) {
    stonePb.box(dx === 0 ? 1.85 : 0.48, 0.26, dz === 0 ? 1.85 : 0.48, wellX + dx * 2.05, yBase + 0.14, wellZ + dz * 2.05);
  }
  granitePb.cyl(1.85, 1.85, 0.42, 10, wellX, yBase + 0.14, wellZ);
  voidPb.cyl(1.52, 1.52, 0.12, 10, wellX, yBase + 0.28, wellZ);
  const wellWaterGeo = new THREE.CircleGeometry(1.50, 10);
  wellWaterGeo.rotateX(-Math.PI * 0.5);
  wellWaterGeo.translate(wellX, yBase + 0.36, wellZ);
  wellWaterGeo.computeBoundingBox();
  wellWaterGeo.computeBoundingSphere();
  const wellWaterMesh = new THREE.Mesh(
    wellWaterGeo,
    ctx.huePack?.moatReflectiveWaterMat ?? ctx.materials.jadeRoof ?? ctx.materials.darkRoof
  );
  wellWaterMesh.name = 'GiengVuaWater';
  wellWaterMesh.castShadow = false;
  group.add(wellWaterMesh);

  // Outer Heritage Trees framing Tây Đô (>= 12m clear of all ramparts, gates, Đàn Nam Giao & Giếng Vua!)
  const hoTreeSpots: Array<[number, number, 'pine' | 'flame']> = [
    [cx - 56.0, cz + 26.0, 'flame'],
    [cx + 56.0, cz + 26.0, 'flame'],
    [cx - 56.0, cz - 26.0, 'pine'],
    [cx + 56.0, cz - 26.0, 'pine'],
    [cx - 38.0, -264.0, 'pine'],
    [cx + 36.0, -264.0, 'pine']
  ];
  for (let tIdx = 0; tIdx < hoTreeSpots.length; tIdx++) {
    const [tx, tz, tStyle] = hoTreeSpots[tIdx];
    appendHeritageTree(
      barkPb,
      foliagePb,
      tStyle === 'flame' ? crimsonPb : null,
      tx,
      ctx.getHeight(tx, tz),
      tz,
      12.8,
      tStyle,
      4300 + tIdx
    );
  }

  const hoSmoke = createIncenseSmokeSystem(
    [
      { x: cx, y: royalTripod.smokeY, z: dhnTerrZ + 4.8, scale: 1.0 },
      { x: cx, y: yBase + 3.75, z: ngZ, scale: 0.95 }
    ],
    ctx.sharedShaders?.incenseSmoke
  );
  hoSmoke.mesh.castShadow = false;
  if (!ctx.sharedShaders) {
    ctx.extraMaterials.push(hoSmoke.mesh.material as THREE.Material);
    animatedUniforms.push(hoSmoke.uniforms);
  }
  group.add(hoSmoke.mesh);

  tagMotifIds(group, [
    'HV-A03', 'HV-C01', 'HV-C02', 'HV-C07', 'HV-D01', 'HV-D14', 'HV-NEW-MB-10'
  ]);

  // STRICT SHADOW POLICY: castShadow = true ONLY on Nam Môn main stone arch (`NamMonMainArchMesh`)!
  const hoMeshes: Array<THREE.Mesh | null> = [
    finalizeMesh('NamMonMainArchMesh', namMonGranitePb, ctx.materials.granite, true, 2.8),
    finalizeMesh('ThanhNhaHoCyclopeanGranite', granitePb, ctx.materials.granite, false, 2.8),
    finalizeMesh('ThanhNhaHoLimestoneAshlar', stonePb, ctx.materials.stone, false, 2.6),
    finalizeMesh(
      'ThanhNhaHoEarthenRamparts',
      mossyPb,
      ctx.materials.mossyPlaster ?? ctx.materials.agedPlaster ?? ctx.materials.stone,
      false,
      3.2
    ),
    finalizeMesh('ThanhNhaHoPlasterAccents', plasterPb, ctx.materials.whitePlaster, false),
    finalizeMesh(
      'ThanhNhaHoMarbleSteles',
      marblePb,
      ctx.materials.whiteMarble ?? ctx.materials.whitePlaster,
      false
    ),
    finalizeMesh(
      'ThanhNhaHoTerraceFloor',
      batTrangPb,
      ctx.materials.batTrangFloor ?? ctx.materials.terracottaRoof,
      false,
      2.0
    ),
    finalizeMesh(
      'ThanhNhaHoIronwoodGates',
      ironwoodPb,
      ctx.materials.darkIronwood ?? ctx.materials.darkWood,
      false
    ),
    finalizeMesh('ThanhNhaHoTimberFrames', woodPb, ctx.materials.darkWood, false),
    finalizeMesh('ThanhNhaHoPavilionRoof', terraRoofPb, ctx.materials.terracottaRoof, false),
    finalizeMesh('ThanhNhaHoDarkRoof', darkRoofPb, ctx.materials.darkRoof, false),
    finalizeMesh('ThanhNhaHoBronzeStudsAndCensers', bronzePb, ctx.materials.bronze, false),
    finalizeMesh('ThanhNhaHoGoldAccents', goldPb, ctx.materials.gold, false),
    finalizeMesh('ThanhNhaHoFlameBlossoms', crimsonPb, ctx.materials.crimsonLacquer, false),
    finalizeMesh('ThanhNhaHoDarkVoids', voidPb, ctx.materials.darkVoid, false),
    finalizeMesh('ThanhNhaHoTreeBark', barkPb, ctx.materials.bark, false),
    finalizeMesh(
      'ThanhNhaHoTreeFoliage',
      foliagePb,
      ctx.materials.jadeRoof ?? ctx.materials.darkRoof,
      false
    )
  ];

  for (const m of hoMeshes) {
    if (m) group.add(m);
  }

  ctx.scene.add(group);
  return group;
}

/**
 * Builds & registers Chùa Thiên Mụ (Huế, at (-960, 120)) and Thành Nhà Hồ (Thanh Hóa, at (-1120, -360))
 * onto `ctx.scene` and returns any locally created animated shader uniform blocks.
 */
export function buildThienMuThanhNhaHoLandmarks(
  ctx: VietnamBuilderContext
): ThienMuThanhNhaHoBuildResult {
  const animatedUniforms: Array<{ uTime: { value: number }; uWindSpeed?: { value: number } }> = [];

  buildThienMuPagodaHueComplex(ctx, animatedUniforms);
  buildThanhNhaHoCitadelComplex(ctx, animatedUniforms);

  return { animatedUniforms };
}
