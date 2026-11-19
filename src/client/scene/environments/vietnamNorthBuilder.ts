import * as THREE from 'three';
import {
  VietnamBuilderContext,
  createArchedWallGeometry,
  createHaLongKarstGeometry,
  createSculptedRockGeometry,
  createVietnameseCurvedRoofGeometry,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createLanternCapGeometry,
  mergeNormalized,
  mulberry32
} from './vietnamGeometryHelpers';

export interface VietnamNorthBuildResult {
  flagUniforms: Array<{ uTime: { value: number } }>;
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
  const mesh = new THREE.Mesh(mergeNormalized(parts), material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
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
  const geo = new THREE.BoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d));
  if (rotY !== 0) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

function makeCylinder(
  rTop: number,
  rBot: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(
    Math.max(0.01, rTop),
    Math.max(0.01, rBot),
    Math.max(0.02, h),
    segs
  );
  geo.translate(x, y, z);
  return geo;
}

/**
 * Adds a carved stone dragon balustrade (*Rồng Đá*) descending along a staircase slope.
 */
function addDragonBalustrade(
  stoneParts: THREE.BufferGeometry[],
  start: THREE.Vector3,
  end: THREE.Vector3,
  seed: number,
  scale = 1.0,
  skirtDepth = 1.0
): void {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = Math.max(0.5, dir.length());
  const rotY = Math.atan2(dir.x, dir.z);

  const mid1 = new THREE.Vector3().lerpVectors(start, end, 0.33);
  mid1.y += 0.42 * scale;
  const mid2 = new THREE.Vector3().lerpVectors(start, end, 0.67);
  mid2.y += 0.18 * scale;

  // Undulating dragon spine along the stepped stone cheek
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(start.x, start.y + 0.46 * scale, start.z),
    mid1,
    mid2,
    new THREE.Vector3(end.x, end.y + 0.44 * scale, end.z)
  ]);
  const spineGeo = new THREE.TubeGeometry(curve, 18, 0.18 * scale, 8, false);
  stoneParts.push(spineGeo);

  // Stepped masonry cheek wall beneath dragon body, skirted deeply into ground
  const cheekSteps = Math.max(5, Math.round(len / 1.4));
  for (let i = 0; i < cheekSteps; i++) {
    const t = (i + 0.5) / cheekSteps;
    const p = new THREE.Vector3().lerpVectors(start, end, t);
    const stepTop = p.y + (0.42 - t * 0.14) * scale;
    const stepBot = p.y - skirtDepth;
    const h = Math.max(0.5, stepTop - stepBot);
    const cheek = makeBox(
      0.48 * scale,
      h,
      (len / cheekSteps) * 1.15,
      p.x,
      stepBot + h * 0.5,
      p.z,
      rotY
    );
    stoneParts.push(cheek);
  }

  // Sculpted dragon head at lower stair foot
  const head = createSculptedRockGeometry(seed, 0.28 * scale, 0.28 * scale, 0.40 * scale, 2);
  head.rotateY(rotY);
  head.translate(end.x, end.y + 0.56 * scale, end.z);
  stoneParts.push(head);

  // Dragon crest horns
  const perpX = Math.cos(rotY) * 0.11 * scale;
  const perpZ = -Math.sin(rotY) * 0.11 * scale;
  for (const side of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.07 * scale, 0.28 * scale, 6);
    horn.rotateX(-0.35);
    horn.rotateY(rotY);
    horn.translate(end.x + perpX * side, end.y + 0.80 * scale, end.z + perpZ * side);
    stoneParts.push(horn);
  }

  // Newel post pedestal under dragon head
  const newelH = 1.05 * scale + skirtDepth * 0.5;
  stoneParts.push(
    makeBox(
      0.64 * scale,
      newelH,
      0.64 * scale,
      end.x,
      end.y + 0.52 * scale - newelH * 0.5,
      end.z,
      rotY
    )
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

  // Stone jamb piers & impost capitals at arch springline
  for (const side of [-1, 1]) {
    const jx = cx + side * (haw + 0.19);
    stoneParts.push(makeBox(0.38, springY, gateDepth + 0.16, jx, wallY + springY * 0.5, cz));
    stoneParts.push(makeBox(0.52, 0.24, gateDepth + 0.26, jx, wallY + springY, cz));
  }

  // Stone threshold sill
  stoneParts.push(makeBox(archWidth + 0.7, 0.24, gateDepth + 0.3, cx, wallY + 0.08, cz));

  // Heavy recessed darkWood open double doors inside archway jambs (no z-fighting)
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
        wallY + doorH * 0.5 + 0.12,
        cz + gateDepth * 0.28 - leafW * 0.5 + 0.12
      )
    );
  }
}

/**
 * 1. Hoàng Thành Thăng Long — Đoan Môn Five-Arched Imperial Citadel Gate at (0, -68).
 * Real-world scale: 46m wide x 20m deep x ~14m tall.
 */
function buildHoangThanhThangLong(ctx: VietnamBuilderContext): void {
  const cx = 0;
  const cz = -68;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 28.0 });

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
  ctx.exclusionCircles.push({ x: cx, z: -93.0, r: 19.0 });

  // 1. Massive U-shaped imperial terrace podium (46m wide x 20m deep, skirted -1.4m)
  const plinthH = 0.95;
  const gateDepth = 9.0; // Central 5-arch block z in [-72.5, -63.5]
  const skirtBot = yBase - 1.4;
  const podiumFullH = plinthH + 1.4;

  // Main central & rear terrace platform (46.6m x 14.5m, z in [-78.0, -63.5])
  stoneParts.push(makeBox(46.6, podiumFullH, 14.5, cx, skirtBot + podiumFullH * 0.5, -70.75));
  // Front South royal landing apron (24m wide x 3.5m deep, z in [-63.5, -60.0])
  stoneParts.push(makeBox(24.0, podiumFullH, 3.5, cx, skirtBot + podiumFullH * 0.5, -61.75));
  // Flanking U-shaped wing podiums extending south to z = -58.0 (total depth 20m: [-78..-58])
  for (const side of [-1, 1]) {
    stoneParts.push(
      makeBox(10.6, podiumFullH, 5.6, cx + side * 18.0, skirtBot + podiumFullH * 0.5, -60.7)
    );
  }

  // 2. Đoan Môn 6.2m-high U-Shaped Citadel Rampart & Five True-Scale Round-Arched Portals
  const wallY = yBase + plinthH;
  const wallH = 5.25; // plinthH (0.95) + wallH (5.25) = 6.20m rampart deck height

  // Central Emperor gate: 4.6m tall x 3.4m wide; 2 side pairs: 3.6m tall x 2.4m wide
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

  // Solid weathered sandstone base courses & reddish brick upper rampart wings (46m wide x 20m deep U-shape)
  const stoneCourseH = 1.65;
  const brickUpperH = wallH - stoneCourseH;
  for (const side of [-1, 1]) {
    const bx = cx + side * 18.0; // |x| in [13.0..23.0], total 46m wide
    // Main bastion block flanking the 5 arches (10.0m wide x 9.0m deep)
    stoneParts.push(makeBox(10.0, stoneCourseH, gateDepth, bx, wallY + stoneCourseH * 0.5, cz));
    brickParts.push(
      makeBox(10.0, brickUpperH, gateDepth, bx, wallY + stoneCourseH + brickUpperH * 0.5, cz)
    );

    // U-shaped wing bastions extending forward to z = -58.0 and rear buttresses to z = -78.0 (20m deep)
    stoneParts.push(makeBox(8.6, stoneCourseH, 5.5, bx + side * 0.7, wallY + stoneCourseH * 0.5, -60.75));
    brickParts.push(
      makeBox(8.6, brickUpperH, 5.5, bx + side * 0.7, wallY + stoneCourseH + brickUpperH * 0.5, -60.75)
    );
    stoneParts.push(makeBox(8.6, stoneCourseH, 5.5, bx + side * 0.7, wallY + stoneCourseH * 0.5, -75.25));
    brickParts.push(
      makeBox(8.6, brickUpperH, 5.5, bx + side * 0.7, wallY + stoneCourseH + brickUpperH * 0.5, -75.25)
    );
  }

  // Stone cornice stringcourse & upper rampart deck slabs
  const deckY = yBase + 6.20;
  stoneParts.push(makeBox(46.5, 0.42, gateDepth + 0.55, cx, deckY - 0.55, cz));
  stoneParts.push(makeBox(46.2, 0.36, gateDepth + 0.3, cx, deckY - 0.18, cz));
  for (const side of [-1, 1]) {
    const bx = cx + side * 18.7;
    stoneParts.push(makeBox(9.0, 0.42, 20.4, bx, deckY - 0.55, cz));
    stoneParts.push(makeBox(8.8, 0.36, 20.2, bx, deckY - 0.18, cz));
  }

  // Crenellated limestone rampart battlements (*tường hoa mai*) along U-rampart perimeter
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

  // Gold-framed "ĐOAN MÔN" (端門) carved imperial plaque & cloud-scroll medallions above central Emperor portal
  const plaqueZ = cz + gateDepth * 0.5 + 0.12;
  goldParts.push(makeBox(4.0, 1.18, 0.24, cx, wallY + 4.92, plaqueZ));
  crimsonParts.push(makeBox(3.52, 0.84, 0.28, cx, wallY + 4.92, plaqueZ + 0.02));
  // Left character "端" (Đoan): stepped calligraphic vertical & horizontal relief strokes
  const lxChar = cx - 0.78;
  goldParts.push(makeBox(0.32, 0.08, 0.06, lxChar - 0.22, wallY + 5.14, plaqueZ + 0.17));
  goldParts.push(makeBox(0.10, 0.46, 0.06, lxChar - 0.22, wallY + 4.92, plaqueZ + 0.17));
  goldParts.push(makeBox(0.38, 0.08, 0.06, lxChar - 0.22, wallY + 4.70, plaqueZ + 0.17));
  goldParts.push(makeBox(0.46, 0.08, 0.06, lxChar + 0.20, wallY + 5.16, plaqueZ + 0.17));
  goldParts.push(makeBox(0.48, 0.08, 0.06, lxChar + 0.20, wallY + 4.96, plaqueZ + 0.17));
  goldParts.push(makeBox(0.09, 0.42, 0.06, lxChar + 0.03, wallY + 4.86, plaqueZ + 0.17));
  goldParts.push(makeBox(0.09, 0.42, 0.06, lxChar + 0.37, wallY + 4.86, plaqueZ + 0.17));
  // Right character "門" (Môn): authentic open-bottom double-gate silhouette
  const rxChar = cx + 0.78;
  goldParts.push(makeBox(0.10, 0.56, 0.06, rxChar - 0.36, wallY + 4.92, plaqueZ + 0.17));
  goldParts.push(makeBox(0.10, 0.56, 0.06, rxChar + 0.36, wallY + 4.92, plaqueZ + 0.17));
  goldParts.push(makeBox(0.30, 0.09, 0.06, rxChar - 0.22, wallY + 5.15, plaqueZ + 0.17));
  goldParts.push(makeBox(0.30, 0.09, 0.06, rxChar + 0.22, wallY + 5.15, plaqueZ + 0.17));
  goldParts.push(makeBox(0.28, 0.08, 0.06, rxChar - 0.22, wallY + 4.98, plaqueZ + 0.17));
  goldParts.push(makeBox(0.28, 0.08, 0.06, rxChar + 0.22, wallY + 4.98, plaqueZ + 0.17));
  goldParts.push(makeBox(0.08, 0.24, 0.06, rxChar - 0.09, wallY + 5.06, plaqueZ + 0.17));
  goldParts.push(makeBox(0.08, 0.24, 0.06, rxChar + 0.09, wallY + 5.06, plaqueZ + 0.17));
  for (const side of [-1, 1]) {
    const medal = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12);
    medal.rotateX(Math.PI * 0.5);
    medal.translate(cx + side * 2.45, wallY + 4.92, plaqueZ + 0.05);
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

  // 3. Upper 2-Tier Imperial Crimson Wooden Gatehouse Pavilion (*Vọng Lâu Đoan Môn*, reaching ~14m)
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
  // Open-front watchtower hall: side & rear walls, folded-back *cửa bức bàn* timber doors & coffered ceiling
  woodParts.push(makeBox(0.32, lowerH * 0.88, 4.2, cx - 8.15, pavBaseY + lowerH * 0.44, cz));
  woodParts.push(makeBox(0.32, lowerH * 0.88, 4.2, cx + 8.15, pavBaseY + lowerH * 0.44, cz));
  woodParts.push(makeBox(16.6, lowerH * 0.88, 0.32, cx, pavBaseY + lowerH * 0.44, cz - 2.05));
  for (const side of [-1, 1]) {
    // Flanking South facade partition wings leaving central 3 bays open into interior watchtower
    woodParts.push(makeBox(3.4, lowerH * 0.84, 0.24, cx + side * 6.4, pavBaseY + lowerH * 0.44, cz + 2.0));
    // Open swinging timber *cửa bức bàn* leaves angled outward
    woodParts.push(makeBox(1.15, lowerH * 0.78, 0.14, cx + side * 4.45, pavBaseY + lowerH * 0.40, cz + 2.45, side * -0.55));
    // Lower balustrade flanking the open central portal
    crimsonParts.push(makeBox(4.8, 0.68, 0.20, cx + side * 6.5, pavBaseY + 0.42, cz + 2.55));
  }
  crimsonParts.push(makeBox(18.0, 0.68, 0.20, cx, pavBaseY + 0.42, cz - 2.55));
  crimsonParts.push(makeBox(17.4, 0.22, 4.6, cx, pavBaseY + lowerH - 0.14, cz)); // interior lacquered ceiling
  goldParts.push(makeBox(18.6, 0.34, 5.2, cx, pavBaseY + lowerH - 0.04, cz));

  // Vọng Lâu interior ceremonial royal *Trống Sấm* watchtower drum on dragon cradle + flanking *Bát Bửu* halberds
  woodParts.push(makeBox(2.0, 0.24, 1.15, cx, pavBaseY + 0.12, cz - 0.2));
  for (const side of [-1, 1]) {
    woodParts.push(makeBox(0.18, 1.35, 0.95, cx + side * 0.82, pavBaseY + 0.80, cz - 0.2));
    // Flanking imperial *Bát Bửu* ceremonial weapon racks
    woodParts.push(makeBox(1.5, 0.22, 0.45, cx + side * 3.1, pavBaseY + 0.12, cz - 1.3));
    for (let h = -1; h <= 1; h++) {
      crimsonParts.push(makeCylinder(0.035, 0.04, 2.25, 6, cx + side * 3.1 + h * 0.42, pavBaseY + 1.25, cz - 1.3));
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

  // Hanging imperial silk lanterns along Vọng Lâu South eaves & inside watchtower hall
  for (const lx of [-7.35, -4.35, -1.45, 1.45, 4.35, 7.35]) {
    const ly = pavBaseY + lowerH - 0.52;
    const lz = cz + 2.52;
    const shell = createRibbedLanternShellGeometry(0.24, 0.34, 10, 6);
    shell.translate(cx + lx, ly, lz);
    lanternParts.push(shell);
    const core = createLanternCoreGeometry(0.14, 0.22);
    core.translate(cx + lx, ly, lz);
    lanternCoreParts.push(core);
    goldParts.push(createLanternCapGeometry(0.11, 0.06).translate(cx + lx, ly + 0.19, lz));
  }
  for (const ilx of [-1.6, 1.6]) {
    const ily = pavBaseY + lowerH - 0.62;
    const shell = createRibbedLanternShellGeometry(0.20, 0.30, 8, 5);
    shell.translate(cx + ilx, ily, cz + 0.2);
    lanternParts.push(shell);
    const core = createLanternCoreGeometry(0.12, 0.20);
    core.translate(cx + ilx, ily, cz + 0.2);
    lanternCoreParts.push(core);
  }
  const vongLauLight = new THREE.PointLight('#ffca72', 1.8, 16, 1.5);
  vongLauLight.position.set(cx, pavBaseY + 2.15, cz + 0.4);
  group.add(vongLauLight);

  // Lower tier curved upturned terracotta roof
  const lowerRoof = createVietnameseCurvedRoofGeometry(21.6, 8.4, 14.0, 4.8, 1.95, 0.40);
  lowerRoof.translate(cx, pavBaseY + lowerH + 0.04, cz);
  roofParts.push(lowerRoof);

  // Upper 2nd-tier imperial belvedere pavilion seated flush on lower curved roof deck
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
  woodParts.push(makeBox(9.6, upperH * 0.84, 2.5, cx, upperY + upperH * 0.44, cz));
  goldParts.push(makeBox(11.2, 0.28, 3.6, cx, upperY + upperH - 0.06, cz));

  const upperRoof = createVietnameseCurvedRoofGeometry(14.6, 6.4, 5.4, 0.55, 2.25, 0.48);
  upperRoof.translate(cx, upperY + upperH + 0.04, cz);
  roofParts.push(upperRoof);

  // Golden imperial roof ridge crest, paired upturned dragon *Kìm Nóc* finials & flaming pearl (~14.3m tall)
  const ridgeY = upperY + upperH + 2.28;
  goldParts.push(makeBox(5.8, 0.26, 0.24, cx, ridgeY, cz));
  goldParts.push(makeCylinder(0.08, 0.24, 0.78, 8, cx, ridgeY + 0.42, cz));
  goldParts.push(new THREE.SphereGeometry(0.24, 10, 8).translate(cx, ridgeY + 0.92, cz));
  for (const side of [-1, 1]) {
    goldParts.push(makeBox(0.32, 0.72, 0.26, cx + side * 2.82, ridgeY + 0.36, cz));
    goldParts.push(makeBox(0.55, 0.24, 0.24, cx + side * 2.65, ridgeY + 0.72, cz));
  }

  // 4. Broad 14m-Wide Royal Limestone Staircase descending south to z = -50 + Flanking Stone Lantern Pedestals
  const stairSteps = 8;
  const zTop = -60.2;
  const zBot = -50.0;
  for (let s = 0; s < stairSteps; s++) {
    const t = s / (stairSteps - 1);
    const sz = THREE.MathUtils.lerp(zTop, zBot, t);
    const sy = THREE.MathUtils.lerp(yBase + plinthH - 0.05, ctx.getHeight(cx, sz) + 0.08, t);
    const stepBaseY = Math.min(sy - 0.7, ctx.getHeight(cx, sz) - 0.7);
    const sh = Math.max(0.45, sy - stepBaseY);
    stoneParts.push(makeBox(14.2, sh, 1.55, cx, stepBaseY + sh * 0.5, sz));
  }
  for (const side of [-1, 1]) {
    const lx = cx + side * 8.4;
    const lz = zBot + 0.4;
    const ly = ctx.getHeight(lx, lz);
    stoneParts.push(makeBox(1.1, 1.25, 1.1, lx, ly + 0.5, lz));
    crimsonParts.push(makeCylinder(0.11, 0.14, 1.85, 8, lx, ly + 2.02, lz));
    const sShell = createRibbedLanternShellGeometry(0.28, 0.40, 10, 6);
    sShell.translate(lx, ly + 3.15, lz);
    lanternParts.push(sShell);
    const sCore = createLanternCoreGeometry(0.16, 0.26);
    sCore.translate(lx, ly + 3.15, lz);
    lanternCoreParts.push(sCore);
  }

  // 4 Sculpted Stone Dragon Balustrades (*Rồng Đá Điện Kính Thiên*)
  const yTopBal = yBase + plinthH + 0.08;
  const yBotBal = ctx.getHeight(cx, zBot) + 0.08;
  for (const balX of [-7.1, -2.35, 2.35, 7.1]) {
    addDragonBalustrade(
      stoneParts,
      new THREE.Vector3(cx + balX, yTopBal, zTop - 0.1),
      new THREE.Vector3(cx + balX, yBotBal, zBot + 0.2),
      101 + Math.round(Math.abs(balX) * 10),
      1.25,
      1.0
    );
  }

  // 5. Sân Long Trì & Nền Điện Kính Thiên (Imperial Dragon Terrace behind Đoan Môn, z = -78..-104)
  const ktZ = -97.5;
  const ktGroundY = ctx.getHeight(cx, ktZ);
  const ktTopY = Math.max(yBase + 2.25, ktGroundY + 2.25);
  const ktSkirtBot = Math.min(yBase, ktGroundY) - 2.2;
  const ktFullH = ktTopY - ktSkirtBot;
  // Paved *Long Trì* royal brick-and-stone approach between Đoan Môn and Điện Kính Thiên
  const courtY = ctx.getHeight(cx, -81.5);
  stoneParts.push(makeBox(16.0, 1.2, 8.6, cx, courtY - 0.52, -81.8));
  // Monumental 24m x 11.5m stone foundation platform of Điện Kính Thiên
  stoneParts.push(makeBox(24.0, ktFullH, 11.5, cx, ktSkirtBot + ktFullH * 0.5, ktZ));
  // Perimeter carved limestone terrace balustrade
  for (const bx of [-11.6, 11.6]) {
    stoneParts.push(makeBox(0.45, 0.92, 11.2, cx + bx, ktTopY + 0.46, ktZ));
  }
  stoneParts.push(makeBox(23.6, 0.92, 0.45, cx, ktTopY + 0.46, ktZ - 5.55));
  for (const side of [-1, 1]) {
    stoneParts.push(makeBox(5.2, 0.92, 0.45, cx + side * 9.0, ktTopY + 0.46, ktZ + 5.55));
  }
  // 10-step Green-Stone Imperial Staircase (*Thềm Rồng Điện Kính Thiên*) with 4 sculpted 1467 Stone Dragons
  const ktSteps = 10;
  const ktZTop = ktZ + 5.75; // -91.75
  const ktZBot = -85.2;
  const ktStepBotGround = ctx.getHeight(cx, ktZBot);
  for (let s = 0; s < ktSteps; s++) {
    const t = s / (ktSteps - 1);
    const sz = THREE.MathUtils.lerp(ktZTop, ktZBot, t);
    const sy = THREE.MathUtils.lerp(ktTopY - 0.08, ktStepBotGround + 0.12, t);
    const sBot = Math.min(sy - 1.2, ctx.getHeight(cx, sz) - 1.2);
    const sh = Math.max(0.5, sy - sBot);
    stoneParts.push(makeBox(12.2, sh, 0.88, cx, sBot + sh * 0.5, sz));
  }
  for (const dX of [-5.8, -1.9, 1.9, 5.8]) {
    addDragonBalustrade(
      stoneParts,
      new THREE.Vector3(cx + dX, ktTopY + 0.12, ktZTop - 0.1),
      new THREE.Vector3(cx + dX, ktStepBotGround + 0.15, ktZBot + 0.15),
      210 + Math.round(Math.abs(dX) * 10),
      1.18,
      1.4
    );
  }
  // Ceremonial Imperial Incense Altar, Bronze *Đỉnh Đồng*, Bronze Cranes & 4 Court Lantern Poles atop Điện Kính Thiên
  crimsonParts.push(makeBox(4.4, 1.15, 1.35, cx, ktTopY + 0.58, ktZ - 1.8));
  goldParts.push(makeBox(4.6, 0.16, 1.50, cx, ktTopY + 1.18, ktZ - 1.8));
  goldParts.push(makeBox(1.5, 1.45, 0.24, cx, ktTopY + 1.95, ktZ - 2.15)); // royal ancestral heaven plaque
  // Monumental bronze tripod censer in front of altar
  stoneParts.push(makeCylinder(0.92, 1.12, 0.52, 8, cx, ktTopY + 0.26, ktZ + 1.2));
  bronzeParts.push(makeCylinder(0.58, 0.42, 0.86, 14, cx, ktTopY + 0.95, ktZ + 1.2));
  bronzeParts.push(makeCylinder(0.70, 0.62, 0.22, 14, cx, ktTopY + 1.48, ktZ + 1.2));
  for (const side of [-1, 1]) {
    bronzeParts.push(makeBox(0.18, 0.58, 0.14, cx + side * 0.72, ktTopY + 1.22, ktZ + 1.2));
    // Paired bronze cranes on tortoises (*Hạc chầu*)
    bronzeParts.push(makeCylinder(0.28, 0.34, 0.24, 10, cx + side * 2.1, ktTopY + 0.12, ktZ - 0.2));
    bronzeParts.push(makeCylinder(0.07, 0.10, 1.35, 8, cx + side * 2.1, ktTopY + 0.90, ktZ - 0.2));
    bronzeParts.push(makeBox(0.26, 0.34, 0.45, cx + side * 2.1, ktTopY + 1.65, ktZ - 0.15));
    // Tall imperial lantern poles flanking terrace
    for (const lzOff of [-3.6, 3.6]) {
      const px = cx + side * 8.6;
      const pz = ktZ + lzOff;
      stoneParts.push(makeBox(0.75, 0.55, 0.75, px, ktTopY + 0.275, pz));
      crimsonParts.push(makeCylinder(0.09, 0.11, 3.2, 8, px, ktTopY + 2.15, pz));
      const pShell = createRibbedLanternShellGeometry(0.26, 0.38, 10, 6);
      pShell.translate(px, ktTopY + 3.92, pz);
      lanternParts.push(pShell);
      const pCore = createLanternCoreGeometry(0.15, 0.24);
      pCore.translate(px, ktTopY + 3.92, pz);
      lanternCoreParts.push(pCore);
    }
  }

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'HoangThanhStoneBase');
  addMergedMesh(group, brickParts, ctx.materials.chamBrick, 'HoangThanhCitadelBrick');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'HoangThanhCrimsonColumns');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'HoangThanhCurvedRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'HoangThanhGoldTrim');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'HoangThanhTimberDoors');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'HoangThanhBronzeRelics');
  addMergedMesh(group, lanternParts, ctx.materials.lanternSilk, 'HoangThanhImperialLanterns', false, false);
  addMergedMesh(
    group,
    lanternCoreParts,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    'HoangThanhImperialLanternCores',
    false,
    false
  );

  ctx.scene.add(group);
}

/**
 * Creates the waving Vietnamese National Flag (*Cờ Đỏ Sao Vàng*) ShaderMaterial.
 */
function createVietnameseFlagMaterial(waveScale = 1.0): {
  material: THREE.ShaderMaterial;
  uniforms: { uTime: { value: number } };
} {
  const uniforms = {
    uTime: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWaveSlope;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float hoist = clamp(uv.x, 0.0, 1.0);
        float amp = pow(hoist, 0.85) * ${waveScale.toFixed(3)};
        float phase = hoist * 7.4 - uTime * 3.8 + uv.y * 1.5;
        float wave1 = sin(phase) * 0.34;
        float wave2 = sin(hoist * 14.0 - uTime * 6.5 - uv.y * 2.3) * 0.11;
        pos.z += (wave1 + wave2) * amp;
        pos.y -= 0.18 * hoist * hoist * ${waveScale.toFixed(3)} * (0.72 + 0.28 * sin(uTime * 1.8 + hoist * 2.8));
        pos.x -= 0.10 * hoist * hoist * ${waveScale.toFixed(3)};

        vWaveSlope = cos(phase) * 0.85 * pow(hoist, 0.85);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWaveSlope;

      float sdStar5(vec2 p, float r, float rf) {
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
        vec2 p = vec2((vUv.x - 0.5) * 1.5, vUv.y - 0.5);
        float dStar = sdStar5(p, 0.30, 0.381966);
        float starMask = 1.0 - smoothstep(-0.006, 0.006, dStar);

        vec3 crimson = vec3(0.855, 0.075, 0.082);
        vec3 goldStar = vec3(0.995, 0.845, 0.115);
        float shade = 0.86 + 0.22 * vWaveSlope + 0.03 * sin(vUv.y * 85.0);
        vec3 col = mix(crimson, goldStar, starMask) * shade;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  return { material, uniforms };
}

/**
 * 2. Cột cờ Lũng Cú — Hà Giang at (-380, -340).
 * Real-world scale: 34.0m total height (21m stone citadel & tower + 13m flagstaff, 54 m² flag).
 */
function buildLungCuFlagpole(
  ctx: VietnamBuilderContext,
  stainlessMat: THREE.MeshStandardMaterial,
  flagUniforms: Array<{ uTime: { value: number } }>
): void {
  const cx = -380;
  const cz = -340;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 20.0 });

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

  const stoneParts: THREE.BufferGeometry[] = [];
  const graniteParts: THREE.BufferGeometry[] = [];
  const greenStoneParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const steelParts: THREE.BufferGeometry[] = [];

  // 1. Broad 3-tier octagonal limestone citadel base (r = 12.0m, skirted -6.0m into peak)
  const skirtDepth = 6.0;
  const tier1H = 1.2;
  const tier2H = 1.0;
  const tier3H = 0.9;

  stoneParts.push(
    makeCylinder(11.4, 12.0, tier1H + skirtDepth, 8, cx, yBase + (tier1H - skirtDepth) * 0.5, cz)
  );
  graniteParts.push(makeCylinder(8.8, 9.4, tier2H, 8, cx, yBase + tier1H + tier2H * 0.5, cz));
  stoneParts.push(
    makeCylinder(6.2, 6.7, tier3H, 8, cx, yBase + tier1H + tier2H + tier3H * 0.5, cz)
  );

  // Perimeter stone parapet posts around Tier 1 terrace
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(ang) * 10.9;
    const pz = cz + Math.sin(ang) * 10.9;
    stoneParts.push(makeBox(0.42, 0.95, 0.42, px, yBase + tier1H + 0.47, pz, -ang));
  }

  // Stepped granite approach stairway descending SE slope (-6.0m skirt)
  const stairDirX = 0.7071;
  const stairDirZ = 0.7071;
  const stairRotY = Math.atan2(stairDirX, stairDirZ);
  const stairSteps = 18;
  for (let s = 0; s < stairSteps; s++) {
    const dist = 6.6 + s * 0.92;
    const sx = cx + stairDirX * dist;
    const sz = cz + stairDirZ * dist;
    const sy = THREE.MathUtils.lerp(yBase + 2.8, Math.max(yBase - 3.6, ctx.getHeight(sx, sz) + 0.35), s / (stairSteps - 1));
    const terrainY = ctx.getHeight(sx, sz);
    const bot = Math.min(sy - 1.2, terrainY - skirtDepth);
    const h = Math.max(0.6, sy - bot);
    graniteParts.push(makeBox(4.8, h, 1.05, sx, bot + h * 0.5, sz, stairRotY));
    for (const side of [-1, 1]) {
      const cxOff = Math.cos(stairRotY) * 2.55 * side;
      const czOff = -Math.sin(stairRotY) * 2.55 * side;
      stoneParts.push(makeBox(0.45, h + 0.65, 1.1, sx + cxOff, bot + (h + 0.65) * 0.5, sz + czOff, stairRotY));
    }
  }

  // 8 Green-Grey Đông Sơn stone relief plinths & bronze drum medallions around octagonal base
  const pedTopY = yBase + tier1H + tier2H + tier3H; // yBase + 3.1m
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(ang) * 4.45;
    const pz = cz + Math.sin(ang) * 4.45;
    const rot = -ang + Math.PI * 0.5;
    // Green-grey Đông Sơn stone relief slab
    greenStoneParts.push(makeBox(2.35, 2.75, 0.55, px, pedTopY + 1.38, pz, rot));
    // Stone pedestal cap & bronze Đông Sơn medallion
    stoneParts.push(makeBox(2.55, 0.28, 0.68, px, pedTopY + 2.82, pz, rot));
    const mx = cx + Math.cos(ang) * 4.78;
    const mz = cz + Math.sin(ang) * 4.78;
    const med = makeCylinder(0.78, 0.78, 0.14, 16, 0, 0, 0);
    med.rotateX(Math.PI * 0.5);
    med.rotateY(rot);
    med.translate(mx, pedTopY + 1.42, mz);
    bronzeParts.push(med);
  }

  // 2. Monumental 21m-tall octagonal stone tower structure (pedestal 3.1m + shaft 17.9m = 21.0m, r = 3.2m -> 2.4m)
  const shaftH = 17.9;
  const shaftBotY = pedTopY;
  const shaftTopY = shaftBotY + shaftH; // yBase + 21.0m
  graniteParts.push(makeCylinder(2.4, 3.2, shaftH, 8, cx, shaftBotY + shaftH * 0.5, cz));

  // Bronze Đông Sơn relief rings banding the octagonal shaft
  for (const frac of [0.16, 0.38, 0.62, 0.84, 0.98]) {
    const ry = shaftBotY + shaftH * frac;
    const rad = THREE.MathUtils.lerp(3.2, 2.4, frac) + 0.14;
    const ring = new THREE.TorusGeometry(rad, 0.13, 8, 8);
    ring.rotateX(Math.PI * 0.5);
    ring.rotateY(Math.PI / 8);
    ring.translate(cx, ry, cz);
    bronzeParts.push(ring);
  }

  // Observation gallery deck & bronze safety balustrade at 21.0m height
  stoneParts.push(makeCylinder(4.1, 3.55, 0.58, 8, cx, shaftTopY - 0.15, cz));
  const railY = shaftTopY + 0.14;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const rx = cx + Math.cos(ang) * 3.75;
    const rz = cz + Math.sin(ang) * 3.75;
    bronzeParts.push(makeCylinder(0.075, 0.085, 1.2, 8, rx, railY + 0.6, rz));
  }
  const railRing = new THREE.TorusGeometry(3.75, 0.07, 8, 8);
  railRing.rotateX(Math.PI * 0.5);
  railRing.rotateY(Math.PI / 8);
  railRing.translate(cx, railY + 1.18, cz);
  bronzeParts.push(railRing);

  // 3. 13.0m Stainless Flagstaff reaching 34.0m total height above yBase
  const poleH = 13.0;
  const poleBaseY = shaftTopY; // yBase + 21.0m -> poleTop = yBase + 34.0m
  bronzeParts.push(makeCylinder(0.42, 0.58, 0.9, 12, cx, poleBaseY + 0.45, cz));
  steelParts.push(makeCylinder(0.11, 0.24, poleH, 14, cx, poleBaseY + poleH * 0.5, cz));
  bronzeParts.push(
    new THREE.ConeGeometry(0.20, 0.65, 10).translate(cx, poleBaseY + poleH + 0.32, cz)
  );

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'LungCuCitadelStone');
  addMergedMesh(group, graniteParts, ctx.materials.granite, 'LungCuTowerGranite');
  addMergedMesh(group, greenStoneParts, greenStoneMat, 'LungCuDongSonStoneReliefs');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'LungCuDongSonBronze');
  addMergedMesh(group, steelParts, stainlessMat, 'LungCuFlagstaff');

  // 4. Monumental 54 m² (9.0m x 6.0m) Animated Waving Crimson Flag with Golden 5-Pointed Star
  const flagW = 9.0;
  const flagH = 6.0;
  const flagGeo = new THREE.PlaneGeometry(flagW, flagH, 36, 20);
  flagGeo.translate(flagW * 0.5 + 0.14, 0, 0);
  const { material: flagMat, uniforms: flagU } = createVietnameseFlagMaterial(1.45);
  ctx.extraMaterials.push(flagMat);
  flagUniforms.push(flagU);

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
 * Real-world 24m x 24m stone summit deck (-8m skirt), 5.5m 3.143m Pyramid, 11m Kim Sơn Bảo Thắng Pagoda, flagpole & r=26m cloud halo.
 */
function buildFansipanSummit(
  ctx: VietnamBuilderContext,
  stainlessMat: THREE.MeshStandardMaterial,
  flagUniforms: Array<{ uTime: { value: number } }>
): void {
  const cx = 400;
  const cz = -330;
  const yBase = ctx.getHeight(cx, cz);
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 24.0 });

  const group = new THREE.Group();
  group.name = 'FansipanSummitComplex';

  const graniteParts: THREE.BufferGeometry[] = [];
  const stoneParts: THREE.BufferGeometry[] = [];
  const stainlessParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];

  // 1. Giant 24m x 24m stone deck skirted -8.0m into ridge
  const deckTopY = yBase + 0.85;
  const skirtBot = yBase - 8.0;
  const deckH = deckTopY - skirtBot;
  stoneParts.push(makeBox(24.0, deckH, 24.0, cx, skirtBot + deckH * 0.5, cz));
  // Lower sub-apron edge collar
  graniteParts.push(makeBox(25.2, 6.0, 25.2, cx, yBase - 5.2, cz));

  // Perimeter stone balustrades around 24m x 24m plaza (with 4.8m wide South entrance stairs)
  const halfPlaza = 11.65;
  const addBalustradeSpan = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(x1 - x0, z1 - z0);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    stoneParts.push(makeBox(0.22, 0.16, len, mx, deckTopY + 1.04, mz, rot));
    stoneParts.push(makeBox(0.16, 0.14, len, mx, deckTopY + 0.52, mz, rot));
    const posts = Math.max(2, Math.round(len / 2.2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      const px = THREE.MathUtils.lerp(x0, x1, t);
      const pz = THREE.MathUtils.lerp(z0, z1, t);
      stoneParts.push(makeBox(0.30, 1.16, 0.30, px, deckTopY + 0.58, pz, rot));
    }
  };
  addBalustradeSpan(cx - halfPlaza, cz - halfPlaza, cx + halfPlaza, cz - halfPlaza); // North
  addBalustradeSpan(cx - halfPlaza, cz - halfPlaza, cx - halfPlaza, cz + halfPlaza); // West
  addBalustradeSpan(cx + halfPlaza, cz - halfPlaza, cx + halfPlaza, cz + halfPlaza); // East
  addBalustradeSpan(cx - halfPlaza, cz + halfPlaza, cx - 2.6, cz + halfPlaza); // South-W
  addBalustradeSpan(cx + 2.6, cz + halfPlaza, cx + halfPlaza, cz + halfPlaza); // South-E

  // South approach granite steps descending -8m skirted
  for (let s = 0; s < 7; s++) {
    const sz = cz + 12.2 + s * 0.85;
    const sy = deckTopY - 0.18 - s * 0.28;
    const h = sy - (yBase - 8.0);
    graniteParts.push(makeBox(5.2, h, 0.92, cx, yBase - 8.0 + h * 0.5, sz));
  }

  // 2. Rugged granite cliff crags ring-anchored around summit perimeter
  const rand = mulberry32(314302);
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    const rad = 16.0 + rand() * 5.8;
    const rx = cx + Math.cos(ang) * rad;
    const rz = cz + Math.sin(ang) * rad;
    const ry = ctx.getHeight(rx, rz);
    const sx = 2.4 + rand() * 2.2;
    const sy = 2.2 + rand() * 2.6;
    const sz = 2.4 + rand() * 2.2;
    const rock = createSculptedRockGeometry(3143 + i * 23, sx, sy, sz, 3);
    rock.rotateY(rand() * Math.PI * 2);
    rock.translate(rx, ry - sy * 0.32, rz);
    graniteParts.push(rock);
  }

  // 3. Iconic Brushed Stainless/Bronze Fansipan 3.143m Pyramid Monument (5.5m tall)
  const pyrX = cx - 4.2;
  const pyrZ = cz + 2.6;
  stoneParts.push(makeCylinder(3.2, 3.5, 0.72, 6, pyrX, deckTopY + 0.36, pyrZ));
  graniteParts.push(makeCylinder(2.3, 2.55, 0.68, 3, pyrX, deckTopY + 1.06, pyrZ));
  const pyrBaseY = deckTopY + 1.40;
  const pyrH = 3.80;
  const pyramid = new THREE.ConeGeometry(1.55, pyrH, 3);
  pyramid.translate(pyrX, pyrBaseY + pyrH * 0.5, pyrZ);
  stainlessParts.push(pyramid);

  // Bronze apex crown & summit plaque trim (total height = 1.40 + 3.80 + 0.30 = 5.50m)
  bronzeParts.push(makeCylinder(0.06, 0.32, 0.62, 3, pyrX, pyrBaseY + pyrH - 0.01, pyrZ));
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const plate = makeBox(0.92, 1.35, 0.10, 0, 0, 0);
    plate.rotateX(-0.34);
    plate.rotateY(ang);
    plate.translate(pyrX + Math.sin(ang) * 0.72, pyrBaseY + 1.35, pyrZ + Math.cos(ang) * 0.72);
    bronzeParts.push(plate);
  }

  // 4. Multi-tier Lý-Trần Carved Stone & Crimson Wood Kim Sơn Bảo Thắng Summit Pagoda Pavilion (11m tall)
  const pagX = cx + 4.8;
  const pagZ = cz - 4.0;
  // Carved Lý-Trần stone terrace podium (1.5m tall)
  stoneParts.push(makeBox(8.2, 0.80, 8.2, pagX, deckTopY + 0.40, pagZ));
  stoneParts.push(makeBox(7.0, 0.70, 7.0, pagX, deckTopY + 1.15, pagZ));
  for (let s = 0; s < 4; s++) {
    stoneParts.push(makeBox(3.0, 0.34, 0.55, pagX, deckTopY + 0.17 + s * 0.32, pagZ + 4.35 - s * 0.42));
  }
  const pagFloorY = deckTopY + 1.50;

  // Lower crimson wood sanctuary hall (3.4m tall columns + carved timber walls)
  const t1H = 3.40;
  for (const ox of [-2.4, 0, 2.4]) {
    for (const oz of [-2.4, 0, 2.4]) {
      if (ox === 0 && oz === 0) continue;
      crimsonParts.push(makeCylinder(0.16, 0.19, t1H, 10, pagX + ox, pagFloorY + t1H * 0.5, pagZ + oz));
      stoneParts.push(makeCylinder(0.26, 0.30, 0.22, 10, pagX + ox, pagFloorY + 0.11, pagZ + oz));
    }
  }
  woodParts.push(makeBox(4.3, t1H * 0.85, 4.3, pagX, pagFloorY + t1H * 0.44, pagZ));
  goldParts.push(makeBox(5.4, 0.26, 5.4, pagX, pagFloorY + t1H - 0.06, pagZ));

  const pagRoof1 = createVietnameseCurvedRoofGeometry(8.2, 8.2, 4.6, 4.6, 1.95, 0.38);
  pagRoof1.translate(pagX, pagFloorY + t1H + 0.02, pagZ);
  roofParts.push(pagRoof1);

  // Upper Lý-Trần bell/sanctuary tier (2.3m tall + 2.2m upper roof + 1.0m golden lotus finial = ~11m total)
  const t2Y = pagFloorY + t1H + 1.45;
  const t2H = 2.35;
  for (const ox of [-1.45, 1.45]) {
    for (const oz of [-1.45, 1.45]) {
      crimsonParts.push(makeCylinder(0.13, 0.15, t2H, 10, pagX + ox, t2Y + t2H * 0.5, pagZ + oz));
    }
  }
  woodParts.push(makeBox(2.5, t2H * 0.84, 2.5, pagX, t2Y + t2H * 0.44, pagZ));
  goldParts.push(makeBox(3.4, 0.22, 3.4, pagX, t2Y + t2H - 0.05, pagZ));

  const pagRoof2 = createVietnameseCurvedRoofGeometry(5.6, 5.6, 1.1, 1.1, 2.25, 0.44);
  pagRoof2.translate(pagX, t2Y + t2H + 0.02, pagZ);
  roofParts.push(pagRoof2);

  const finialBaseY = t2Y + t2H + 2.25;
  goldParts.push(makeCylinder(0.24, 0.38, 0.36, 8, pagX, finialBaseY + 0.18, pagZ));
  goldParts.push(makeCylinder(0.06, 0.20, 0.85, 8, pagX, finialBaseY + 0.78, pagZ));

  // 5. Ceremonial Summit Flagpole on SE Plaza Quadrant
  const poleX = cx + 7.4;
  const poleZ = cz + 6.8;
  stoneParts.push(makeCylinder(1.05, 1.25, 1.10, 8, poleX, deckTopY + 0.55, poleZ));
  const fPoleBaseY = deckTopY + 1.10;
  const fPoleH = 11.5;
  bronzeParts.push(makeCylinder(0.24, 0.34, 0.6, 10, poleX, fPoleBaseY + 0.3, poleZ));
  stainlessParts.push(makeCylinder(0.07, 0.15, fPoleH, 12, poleX, fPoleBaseY + fPoleH * 0.5, poleZ));
  bronzeParts.push(
    new THREE.ConeGeometry(0.14, 0.45, 8).translate(poleX, fPoleBaseY + fPoleH + 0.22, poleZ)
  );

  addMergedMesh(group, graniteParts, ctx.materials.granite, 'FansipanGraniteCrags');
  addMergedMesh(group, stoneParts, ctx.materials.stone, 'FansipanSummitStonePlaza');
  addMergedMesh(group, stainlessParts, stainlessMat, 'Fansipan3143Milestone');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'FansipanBronzeTrim');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'FansipanSummitPagoda');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'FansipanPagodaTimber');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'FansipanPagodaRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'FansipanPagodaGold');

  const { material: sumFlagMat, uniforms: sumFlagU } = createVietnameseFlagMaterial(1.0);
  ctx.extraMaterials.push(sumFlagMat);
  flagUniforms.push(sumFlagU);
  const sFlagW = 4.5;
  const sFlagH = 3.0;
  const sFlagGeo = new THREE.PlaneGeometry(sFlagW, sFlagH, 28, 16);
  sFlagGeo.translate(sFlagW * 0.5 + 0.09, 0, 0);
  const sFlagMesh = new THREE.Mesh(sFlagGeo, sumFlagMat);
  sFlagMesh.name = 'FansipanCeremonialFlag';
  sFlagMesh.position.set(poleX, fPoleBaseY + fPoleH - sFlagH * 0.5 - 0.15, poleZ);
  sFlagMesh.rotation.y = -0.45;
  sFlagMesh.castShadow = true;
  group.add(sFlagMesh);

  // 6. Swirling Summit Sea-of-Clouds Mist Halo (r = 26m)
  const { material: mistMat, uniforms: mistU } = createSummitMistMaterial();
  ctx.extraMaterials.push(mistMat);
  flagUniforms.push(mistU);

  const mistOuter = new THREE.CylinderGeometry(26.0, 15.5, 4.2, 56, 4, true);
  mistOuter.translate(cx, yBase - 1.6, cz);
  const mistMid = new THREE.CylinderGeometry(21.5, 13.0, 3.0, 48, 3, true);
  mistMid.translate(cx, yBase - 0.3, cz);
  const mistInner = new THREE.CylinderGeometry(17.0, 11.8, 1.8, 40, 2, true);
  mistInner.translate(cx, yBase + 0.85, cz);
  const mistMesh = new THREE.Mesh(mergeNormalized([mistOuter, mistMid, mistInner]), mistMat);
  mistMesh.name = 'FansipanSummitCloudMist';
  group.add(mistMesh);

  ctx.scene.add(group);
}

/**
 * 4. Chùa Hương & Suối Yến (195, -180 stream / 222, -195 hill).
 */
function buildChuaHuongAndSuoiYen(ctx: VietnamBuilderContext): void {
  ctx.exclusionCircles.push({ x: 215, z: -188, r: 26.0 });
  ctx.exclusionCircles.push({ x: 204, z: -170, r: 9.0 });
  ctx.exclusionCircles.push({ x: 182, z: -152, r: 9.0 });

  const group = new THREE.Group();
  group.name = 'ChuaHuongComplex';

  const stoneParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];
  const voidParts: THREE.BufferGeometry[] = [];

  // 1. Winding emerald Suối Yến boat dock at (184, -152), deck y = 0.45m grounded on west bank
  const pierX = 184.0;
  const pierZ = -152.0;
  // Dock deck (9.5m x 4.8m, y = 0.45m)
  woodParts.push(makeBox(9.5, 0.28, 4.8, pierX, 0.31, pierZ));
  stoneParts.push(makeBox(9.8, 0.34, 5.1, pierX, 0.08, pierZ));
  // Timber & stone pilings anchored deep into riverbed (y = -1.8m)
  for (const px of [180.0, 182.6, 185.4, 188.0]) {
    for (const pz of [pierZ - 2.1, pierZ + 2.1]) {
      woodParts.push(makeCylinder(0.16, 0.20, 2.75, 8, px, -0.45, pz));
      woodParts.push(makeCylinder(0.18, 0.18, 0.72, 8, px, 0.75, pz));
    }
  }
  // West bank stone approach steps grounded cleanly on bank terrain
  for (let s = 0; s < 6; s++) {
    const sx = 179.0 - s * 0.85;
    const gy = ctx.getHeight(sx, pierZ);
    const sy = Math.max(0.45, gy + 0.25);
    stoneParts.push(makeBox(1.0, sy + 1.8, 4.4, sx, (sy - 1.8) * 0.5, pierZ));
  }
  // Continuous East bank pilgrim stone stairway connecting Suối Yến shoreline (localZ ~ 22.5) straight up to Thiên Trù Tam Quan
  const gateX = 214.0;
  const gateZ = -184.0;
  const gateY = ctx.getHeight(gateX, gateZ);
  // Facing SW toward Suối Yến & NE toward Động Hương Tích (226, -202)
  const gateRotY = Math.atan2(214 - 226, -184 - -202); // atan2(-12, 18) ≈ -0.588 rad

  // 2. 6 realistic wooden/bamboo *thuyền nan* sampans (7.5m long) along x in [180..192], z in [-210..-140]
  const sampanZs = [-205.0, -192.0, -179.0, -166.0, -154.0, -142.0];
  for (let idx = 0; idx < sampanZs.length; idx++) {
    const sz = sampanZs[idx];
    // Exact river centerline formula from vietnamHeritageShader.ts
    const riverCx = 186.0 + 5.5 * Math.sin((sz + 180.0) * 0.045);
    const offset = idx % 2 === 0 ? -0.6 : 0.6;
    const sx = THREE.MathUtils.clamp(riverCx + offset, 180.4, 191.6);
    const dxdz = 5.5 * 0.045 * Math.cos((sz + 180.0) * 0.045);
    const yaw = Math.atan2(dxdz, 1.0) + (idx % 2 === 0 ? 0.08 : -0.07);

    const boatParts: THREE.BufferGeometry[] = [];
    // 7.5m long curved double-ended bamboo sampan hull (z from -3.75 to +3.75)
    const hullCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.48, -3.75),
      new THREE.Vector3(0, 0.08, -2.1),
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Vector3(0, 0.08, 2.1),
      new THREE.Vector3(0, 0.52, 3.75)
    ]);
    const hullTube = new THREE.TubeGeometry(hullCurve, 18, 0.72, 10, false);
    hullTube.scale(1.0, 0.48, 1.0);
    boatParts.push(hullTube);

    // Cross-thwart wooden seats & floorboards
    for (const tz of [-1.8, -0.5, 0.8, 2.0]) {
      boatParts.push(makeBox(1.16, 0.08, 0.34, 0, 0.28, tz));
    }
    // Arched woven bamboo sun canopy
    const canopy = new THREE.CylinderGeometry(0.72, 0.72, 2.75, 12, 1, true, -Math.PI * 0.5, Math.PI);
    canopy.rotateZ(Math.PI * 0.5);
    canopy.rotateY(Math.PI * 0.5);
    canopy.translate(0, 0.42, -0.25);
    boatParts.push(canopy);

    // Twin bamboo oars tucked neatly along the gunwales (|x| <= 0.58, y = 0.24)
    for (const side of [-1, 1]) {
      const oar = makeCylinder(0.032, 0.042, 3.4, 6, 0, 0, 0);
      oar.rotateX(Math.PI * 0.49);
      oar.rotateY(side * 0.05);
      oar.translate(side * 0.54, 0.24, 0.15);
      boatParts.push(oar);
    }

    for (const bp of boatParts) {
      bp.rotateY(yaw);
      bp.translate(sx, 0.03, sz);
      woodParts.push(bp);
    }

    // Warm ribbed bow lantern + golden candle core
    const bowX = sx + Math.sin(yaw) * 3.15;
    const bowZ = sz + Math.cos(yaw) * 3.15;
    const bShell = createRibbedLanternShellGeometry(0.16, 0.36, 10, 8);
    bShell.translate(bowX, 0.65, bowZ);
    lanternParts.push(bShell);
    const bCap = createLanternCapGeometry(0.16, 0.36);
    bCap.translate(bowX, 0.65, bowZ);
    woodParts.push(bCap);
    const bCore = createLanternCoreGeometry(0.16, 0.36);
    bCore.translate(bowX, 0.65, bowZ);
    lanternCoreParts.push(bCore);
  }

  // 3. True-Scale 14m-Tall Multi-Tier Thiên Trù *Tam Quan* Gate & Bell Tower at (214, -184)
  const gStone: THREE.BufferGeometry[] = [];
  const gCrimson: THREE.BufferGeometry[] = [];
  const gWood: THREE.BufferGeometry[] = [];
  const gRoof: THREE.BufferGeometry[] = [];
  const gGold: THREE.BufferGeometry[] = [];
  const gBronze: THREE.BufferGeometry[] = [];
  const gLantern: THREE.BufferGeometry[] = [];
  const gLanternCore: THREE.BufferGeometry[] = [];

  // Broad stone podium deeply skirted (-4.5m) into Thiên Trù hill plateau
  gStone.push(makeBox(17.4, 5.7, 6.8, 0, -1.65, 0)); // top at local y = +1.2m
  // Continuous SW pilgrim stone staircase descending from Tam Quan podium (localZ=3.85) all the way to Suối Yến East bank (localZ=22.6), skirted -2.5m into slope
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
    const localCenterY = (botWorldY + h * 0.5) - gateY;
    gStone.push(makeBox(8.4, h, 1.15, 0, localCenterY, lz));
  }
  // Rear NE steps toward Động Hương Tích terrace
  for (let s = 0; s < 4; s++) {
    gStone.push(makeBox(7.2, 2.5, 0.90, 0, -0.2 - s * 0.30, -3.75 - s * 0.78));
  }

  const pDeckY = 1.20;
  // 3-bay Tam Quan crimson columns (tall 6.0m central bay, 4.4m side bays)
  for (const px of [-6.8, -2.9, 2.9, 6.8]) {
    const colH = Math.abs(px) < 3.5 ? 6.0 : 4.4;
    for (const pz of [-2.0, 2.0]) {
      gCrimson.push(makeCylinder(0.22, 0.26, colH, 10, px, pDeckY + colH * 0.5, pz));
      gStone.push(makeCylinder(0.36, 0.42, 0.32, 10, px, pDeckY + 0.16, pz));
    }
  }
  // Cross-beams & carved wood side arches
  gCrimson.push(makeBox(14.4, 0.52, 4.6, 0, pDeckY + 4.35, 0));
  gWood.push(makeBox(5.6, 0.45, 3.8, 0, pDeckY + 5.85, 0));

  // Flanking lower bay curved dark roofs
  for (const sx of [-4.85, 4.85]) {
    const sideRoof = createVietnameseCurvedRoofGeometry(5.2, 6.4, 2.4, 2.2, 1.85, 0.38);
    sideRoof.translate(sx, pDeckY + 4.52, 0);
    gRoof.push(sideRoof);
  }

  // Central middle curved dark roof
  const midRoof = createVietnameseCurvedRoofGeometry(8.8, 7.2, 5.4, 4.2, 2.05, 0.42);
  midRoof.translate(0, pDeckY + 6.0, 0);
  gRoof.push(midRoof);

  // Upper 2nd-tier Bell Tower (*Lầu Chuông*) chamber + hanging bronze Đại Hồng Chung bell
  const bellY = pDeckY + 7.45;
  const bellH = 2.85;
  for (const bx of [-1.95, 1.95]) {
    for (const bz of [-1.55, 1.55]) {
      gCrimson.push(makeCylinder(0.17, 0.19, bellH, 10, bx, bellY + bellH * 0.5, bz));
    }
  }
  gCrimson.push(makeBox(4.3, 0.36, 3.5, 0, bellY + bellH - 0.1, 0));
  gGold.push(makeBox(2.6, 0.65, 0.22, 0, pDeckY + 5.3, 2.25));
  // Hanging bronze temple bell inside upper pavilion
  gBronze.push(makeCylinder(0.38, 0.62, 1.35, 12, 0, bellY + 1.45, 0));

  // Crowning 3rd-tier curved dark roof reaching ~14.0m total height
  const topRoof = createVietnameseCurvedRoofGeometry(6.8, 5.8, 2.2, 0.55, 2.45, 0.48);
  topRoof.translate(0, bellY + bellH, 0);
  gRoof.push(topRoof);
  gGold.push(makeBox(2.5, 0.24, 0.20, 0, bellY + bellH + 2.48, 0));
  gGold.push(makeCylinder(0.07, 0.20, 0.68, 8, 0, bellY + bellH + 2.82, 0));

  // Glowing Tam Quan ribbed silk lanterns + inner candle cores
  for (const [lx, ly, lz, lr, lh] of [
    [0, pDeckY + 4.85, 2.15, 0.25, 0.58],
    [-4.85, pDeckY + 3.65, 2.15, 0.19, 0.46],
    [4.85, pDeckY + 3.65, 2.15, 0.19, 0.46]
  ]) {
    const sh = createRibbedLanternShellGeometry(lr, lh, 12, 8);
    sh.translate(lx, ly, lz);
    gLantern.push(sh);
    const cp = createLanternCapGeometry(lr, lh);
    cp.translate(lx, ly, lz);
    gWood.push(cp);
    const cr = createLanternCoreGeometry(lr, lh);
    cr.translate(lx, ly, lz);
    gLanternCore.push(cr);
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

  // 4. Động Hương Tích (226, -202): 22m wide x 15m high carved karst grotto arch with warm shrine lanterns
  const caveX = 226.0;
  const caveZ = -202.0;
  const caveY = ctx.getHeight(caveX, caveZ);
  const caveRotY = gateRotY;

  const cStone: THREE.BufferGeometry[] = [];
  const cVoid: THREE.BufferGeometry[] = [];
  const cLantern: THREE.BufferGeometry[] = [];
  const cLanternCore: THREE.BufferGeometry[] = [];
  const cGold: THREE.BufferGeometry[] = [];
  const cBronze: THREE.BufferGeometry[] = [];

  // Towering 22m-wide x 15m-high limestone karst cave buttresses & crown arch
  const archLeft = createSculptedRockGeometry(511, 5.6, 8.8, 5.4, 3);
  archLeft.translate(-7.2, 6.4, 0);
  const archRight = createSculptedRockGeometry(512, 5.8, 9.0, 5.4, 3);
  archRight.translate(7.4, 6.5, 0);
  const archCrown = createSculptedRockGeometry(513, 11.4, 4.6, 5.8, 3);
  archCrown.translate(0, 12.8, -0.6);
  const caveBack = createSculptedRockGeometry(514, 12.2, 10.6, 5.8, 3);
  caveBack.translate(0, 7.6, -6.4);
  cStone.push(archLeft, archRight, archCrown, caveBack);

  // Hanging karst stalactites along grotto arch lip
  for (const [sx, sy, sr, sh] of [
    [-3.6, 10.2, 0.55, 2.4],
    [-1.4, 10.6, 0.48, 2.8],
    [1.6, 10.4, 0.52, 2.5],
    [3.8, 9.9, 0.60, 2.2]
  ]) {
    const stal = new THREE.ConeGeometry(sr, sh, 7);
    stal.rotateX(Math.PI);
    stal.translate(sx, sy - sh * 0.5, 1.4);
    cStone.push(stal);
  }

  // Carved stone grotto steps descending into cavern sanctuary
  for (let s = 0; s < 6; s++) {
    cStone.push(makeBox(8.4, 1.2, 1.15, 0, -0.2 + s * 0.22, 4.4 - s * 0.92));
  }

  // Deep shadowed cavern mouth void (13m wide x 10m tall)
  const caveRecess = makeCylinder(5.2, 6.2, 10.4, 14, 0, 5.1, -1.6);
  caveRecess.scale(1.15, 1.0, 0.85);
  cVoid.push(caveRecess);

  // Glowing grotto ribbed shrine lanterns, golden altar & bronze incense urn inside cave mouth
  cGold.push(makeBox(2.4, 1.2, 1.1, 0, 1.35, -0.2));
  cBronze.push(makeCylinder(0.45, 0.34, 0.85, 10, 0, 1.45, 1.35));
  for (const [lx, ly, lz, lr, lh] of [
    [0, 2.45, 0.1, 0.42, 0.90],
    [-3.2, 4.6, 1.4, 0.24, 0.56],
    [3.2, 4.6, 1.4, 0.24, 0.56],
    [-1.8, 7.2, 1.2, 0.22, 0.52],
    [1.8, 7.2, 1.2, 0.22, 0.52]
  ]) {
    const sh = createRibbedLanternShellGeometry(lr, lh, 12, 8);
    sh.translate(lx, ly, lz);
    cLantern.push(sh);
    const cr = createLanternCoreGeometry(lr, lh);
    cr.translate(lx, ly, lz);
    cLanternCore.push(cr);
  }

  const applyCaveTransform = (src: THREE.BufferGeometry[], dst: THREE.BufferGeometry[]) => {
    for (const g of src) {
      g.rotateY(caveRotY);
      g.translate(caveX, caveY, caveZ);
      dst.push(g);
    }
  };
  applyCaveTransform(cStone, stoneParts);
  applyCaveTransform(cVoid, voidParts);
  applyCaveTransform(cLantern, lanternParts);
  applyCaveTransform(cLanternCore, lanternCoreParts);
  applyCaveTransform(cGold, goldParts);
  applyCaveTransform(cBronze, bronzeParts);

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'ChuaHuongStoneAndKarst');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'SuoiYenSampanBoats');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'ThienTruTamQuanPillars');
  addMergedMesh(group, roofParts, ctx.materials.darkRoof, 'ThienTruDarkRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'ChuaHuongGoldShrine');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'ChuaHuongBronzeBellAndUrn');
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

  ctx.scene.add(group);
}

/**
 * 5. Đền Hùng — Núi Nghĩa Lĩnh at (-195, -210).
 * 42m long 3-flight stone & laterite staircase from (-165, -180) through 11m Nghi Môn Gate up to 18x14m courtyard & 12m Đền Thượng Temple.
 */
function buildDenHung(ctx: VietnamBuilderContext): void {
  const cx = -195;
  const cz = -210;
  const yBase = ctx.getHeight(cx, cz); // 26.0m
  ctx.exclusionCircles.push(
    { x: cx, z: cz, r: 19.0 },
    { x: -182, z: -197, r: 11.0 },
    { x: -174, z: -189, r: 9.5 },
    { x: -167, z: -182, r: 9.5 }
  );

  const group = new THREE.Group();
  group.name = 'DenHungComplex';

  const stoneParts: THREE.BufferGeometry[] = [];
  const lateriteParts: THREE.BufferGeometry[] = [];
  const crimsonParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const bronzeParts: THREE.BufferGeometry[] = [];
  const lanternParts: THREE.BufferGeometry[] = [];
  const lanternCoreParts: THREE.BufferGeometry[] = [];

  // Facing SE toward (-165, -180)
  const facingRotY = Math.PI * 0.25;
  const dirSE = new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2); // unit vector toward SE

  // Helper to get max terrain height across stair width and build deeply skirted (-4.5m) stone & laterite step
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
    seedBase: number,
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

      // Reddish laterite curb blocks along both edges of staircase
      for (const side of [-1, 1]) {
        const ox = Math.cos(facingRotY) * (halfW + 0.25) * side;
        const oz = -Math.sin(facingRotY) * (halfW + 0.25) * side;
        lateriteParts.push(
          makeBox(0.50, h + 0.35, stepLen + 0.12, sx + ox, bot + (h + 0.35) * 0.5, sz + oz, facingRotY)
        );
      }
    }

    // Dragon stone balustrades flanking each flight
    for (const side of [-1, 1]) {
      const ox = Math.cos(facingRotY) * (halfW + 0.25) * side;
      const oz = -Math.sin(facingRotY) * (halfW + 0.25) * side;
      addDragonBalustrade(
        stoneParts,
        new THREE.Vector3(pEnd.x + ox, yTopEnd + 0.15, pEnd.y + oz),
        new THREE.Vector3(pStart.x + ox, yTopStart + 0.15, pStart.y + oz),
        seedBase + (side > 0 ? 1 : 2),
        1.05,
        3.5
      );
    }
  };

  // 1. 42m Long 3-Flight Pilgrimage Staircase from SE Foothills (-165, -180) up to Courtyard (-188, -203)
  const courtTop = 1.85; // courtyard at yBase + 1.85m = 27.85m
  const landing1 = buildLanding(31.2, 4.4, 6.8, 1.45);
  const nghiLanding = buildLanding(19.2, 5.2, 8.6, 0.90);

  // Flight 1 (SE foothills d=43m -> Landing 1 d=33.2m)
  buildStairFlight(43.0, 33.2, 14, 710, undefined, landing1.topY);
  // Flight 2 (Landing 1 d=29.2m -> Landing 2 d=21.5m)
  buildStairFlight(29.2, 21.5, 11, 720, landing1.topY, nghiLanding.topY);
  // Flight 3 (Landing 2 d=16.8m -> Đền Thượng courtyard d=8.3m)
  buildStairFlight(16.8, 8.3, 12, 730, nghiLanding.topY, yBase + courtTop);

  // 2. Crimson-and-Gold Nghi Môn Gate (11m tall) astride Landing 2 (-181.4, -196.4)
  const nghiX = nghiLanding.x;
  const nghiZ = nghiLanding.z;
  const nghiY = nghiLanding.topY;
  const nStone: THREE.BufferGeometry[] = [];
  const nCrimson: THREE.BufferGeometry[] = [];
  const nGold: THREE.BufferGeometry[] = [];
  const nRoof: THREE.BufferGeometry[] = [];
  const nLantern: THREE.BufferGeometry[] = [];
  const nLanternCore: THREE.BufferGeometry[] = [];

  // Four monumental ceremonial pillars (inner pair 8.5m, outer pair 7.0m) crowned with sculpted stone *Nghê* & lotus finials
  for (const [px, colH] of [
    [-3.6, 7.0],
    [-1.85, 8.5],
    [1.85, 8.5],
    [3.6, 7.0]
  ]) {
    nStone.push(makeBox(1.05, 1.45, 1.05, px, 0.72, 0));
    nCrimson.push(makeBox(0.68, colH, 0.68, px, 1.45 + colH * 0.5, 0));
    if (Math.abs(px) > 2.5) {
      // Sculpted guardian *Nghê* seating plinth & curled guardian silhouette atop outer pillars
      nStone.push(makeBox(0.84, 0.24, 0.84, px, 1.45 + colH + 0.12, 0));
      nStone.push(createSculptedRockGeometry(750 + Math.round(px * 10), 0.34, 0.52, 0.38, 2).translate(px, 1.45 + colH + 0.62, 0));
      nGold.push(new THREE.SphereGeometry(0.14, 8, 6).translate(px, 1.45 + colH + 1.06, 0.12));
    } else {
      nGold.push(
        new THREE.ConeGeometry(0.40, 1.05, 4)
          .rotateY(Math.PI * 0.25)
          .translate(px, 1.45 + colH + 0.52, 0)
      );
    }
  }
  // Upper crossbeams, carved "Cao Sơn Cảnh Hành" golden plaque, double-tier curved terracotta roof & hanging temple lanterns
  nCrimson.push(makeBox(7.8, 0.58, 0.85, 0, 6.8, 0));
  nGold.push(makeBox(2.9, 0.76, 0.26, 0, 6.8, 0.38));
  nCrimson.push(makeBox(2.55, 0.52, 0.28, 0, 6.8, 0.40));
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
  nGold.push(makeBox(2.8, 0.22, 0.18, 0, 10.55, 0));
  nGold.push(makeCylinder(0.06, 0.18, 0.55, 8, 0, 10.85, 0));

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

  // 3. Đền Thượng (*Kính Thiên Lĩnh Điện*) Sacred Ancestor Temple atop Núi Nghĩa Lĩnh (-195, -210)
  // Open sanctum interior + Cột Đá Thề + Hùng Vương Lăng mausoleum on East terrace
  const dStone: THREE.BufferGeometry[] = [];
  const dLaterite: THREE.BufferGeometry[] = [];
  const dCrimson: THREE.BufferGeometry[] = [];
  const dWood: THREE.BufferGeometry[] = [];
  const dRoof: THREE.BufferGeometry[] = [];
  const dGold: THREE.BufferGeometry[] = [];
  const dBronze: THREE.BufferGeometry[] = [];
  const dLantern: THREE.BufferGeometry[] = [];
  const dLanternCore: THREE.BufferGeometry[] = [];

  // Main 18m x 14m courtyard platform (top at yBase + 1.85m, skirted -4.5m down)
  const courtH = courtTop + 4.5;
  dStone.push(makeBox(18.0, courtH, 14.0, 0, -4.5 + courtH * 0.5, 1.5));
  dLaterite.push(makeBox(18.4, 0.45, 14.4, 0, courtTop - 0.25, 1.5));

  // Temple raised stone dais (13.6m x 8.6m, 1.15m tall above courtyard)
  dStone.push(makeBox(13.6, 1.15, 8.6, 0, courtTop + 0.575, -1.2));
  for (let s = 0; s < 5; s++) {
    dStone.push(makeBox(4.8, 0.28, 0.65, 0, courtTop + 0.14 + s * 0.22, 3.65 - s * 0.42));
  }
  addDragonBalustrade(
    dStone,
    new THREE.Vector3(-2.65, courtTop + 1.15, 2.1),
    new THREE.Vector3(-2.65, courtTop + 0.05, 4.15),
    701,
    1.0,
    0.8
  );
  addDragonBalustrade(
    dStone,
    new THREE.Vector3(2.65, courtTop + 1.15, 2.1),
    new THREE.Vector3(2.65, courtTop + 0.05, 4.15),
    702,
    1.0,
    0.8
  );

  // 12m-Tall Dual Curved Roof Ancestor Temple Hall with OPEN front sanctuary & sacred Hung Kings Hậu Cung altar
  const floorY = courtTop + 1.15; // local y = 3.00m
  const hallH = 4.15;
  for (const px of [-5.2, -2.6, 0, 2.6, 5.2]) {
    for (const pz of [-4.0, 1.6]) {
      // Omit front center pillar at (0, 1.6) to keep unobstructed ceremonial doorway axis into Hậu Cung
      if (px === 0 && pz > 0) continue;
      dCrimson.push(makeCylinder(0.22, 0.25, hallH, 10, px, floorY + hallH * 0.5, pz));
      dStone.push(makeCylinder(0.32, 0.38, 0.26, 10, px, floorY + 0.13, pz));
    }
  }
  // Open-front enclosure walls (left, right, rear Hậu Cung, flanking front wings + folded-back wooden doors)
  dWood.push(makeBox(0.32, hallH * 0.88, 4.8, -4.85, floorY + hallH * 0.44, -1.2));
  dWood.push(makeBox(0.32, hallH * 0.88, 4.8, 4.85, floorY + hallH * 0.44, -1.2));
  dWood.push(makeBox(9.8, hallH * 0.88, 0.32, 0, floorY + hallH * 0.44, -3.55));
  for (const side of [-1, 1]) {
    dWood.push(makeBox(2.55, hallH * 0.86, 0.24, side * 3.65, floorY + hallH * 0.43, 1.15));
    // Swinging *cửa bức bàn* timber sanctuary doors opened outward
    dWood.push(makeBox(1.12, hallH * 0.78, 0.12, side * 2.08, floorY + hallH * 0.39, 1.55, side * -0.58));
    // Gilded *Câu Đối* vertical parallel inscription panels flanking main doorway
    dGold.push(makeBox(0.32, 2.65, 0.08, side * 2.55, floorY + 2.05, 1.78));
    dCrimson.push(makeBox(0.22, 2.45, 0.10, side * 2.55, floorY + 2.05, 1.80));
  }
  // Interior crimson-lacquered ceiling & gilded front *Hoành Phi* ("Kính Thiên Lĩnh Điện")
  dCrimson.push(makeBox(10.0, 0.22, 5.2, 0, floorY + hallH - 0.14, -1.2));
  dGold.push(makeBox(11.4, 0.32, 6.2, 0, floorY + hallH - 0.06, -1.2));
  dGold.push(makeBox(3.4, 0.86, 0.24, 0, floorY + 3.45, 1.68));
  dCrimson.push(makeBox(3.0, 0.62, 0.28, 0, floorY + 3.45, 1.70));
  for (const gx of [-1.05, -0.35, 0.35, 1.05]) {
    dGold.push(makeBox(0.38, 0.07, 0.05, gx, floorY + 3.59, 1.85));
    dGold.push(makeBox(0.30, 0.07, 0.05, gx, floorY + 3.45, 1.85));
    dGold.push(makeBox(0.38, 0.07, 0.05, gx, floorY + 3.31, 1.85));
    dGold.push(makeBox(0.08, 0.36, 0.05, gx, floorY + 3.45, 1.85));
  }

  // Sacred Đền Thượng *Hậu Cung* Interior Altar (Án Gian, Ngai Thờ Vua Hùng, Trống Đồng, Hạc Chầu, Tàn Lọng & Altar Lamps)
  dCrimson.push(makeBox(4.4, 1.12, 1.25, 0, floorY + 0.56, -2.35));
  dGold.push(makeBox(4.56, 0.14, 1.38, 0, floorY + 1.14, -2.35));
  dGold.push(makeBox(3.6, 0.68, 0.10, 0, floorY + 0.62, -1.70)); // embroidered imperial altar front drapery
  // Recessed gilded *Khám Thờ* & Ancestral Throne (*Ngai Thờ Vua Hùng*)
  dCrimson.push(makeBox(1.95, 2.15, 0.85, 0, floorY + 2.18, -2.68));
  dGold.push(makeBox(1.65, 1.82, 0.16, 0, floorY + 2.15, -2.42));
  dGold.push(makeBox(0.68, 1.15, 0.14, 0, floorY + 1.86, -2.22)); // ancestral Hung King tablet (*Bài Vị*)
  // Miniature sacred *Trống Đồng Đông Sơn* on timber rack + bronze altar censer
  dWood.push(makeBox(0.95, 0.48, 0.72, 0, floorY + 0.24, -0.85));
  dBronze.push(makeCylinder(0.42, 0.36, 0.44, 16, 0, floorY + 0.68, -0.85));
  dBronze.push(makeCylinder(0.24, 0.18, 0.36, 12, 0, floorY + 1.38, -1.92));
  for (const side of [-1, 1]) {
    // Paired tall bronze cranes standing on tortoises (*Hạc đồng chầu*)
    dBronze.push(makeCylinder(0.22, 0.28, 0.22, 10, side * 1.48, floorY + 0.11, -1.55));
    dBronze.push(makeCylinder(0.06, 0.08, 1.28, 8, side * 1.48, floorY + 0.86, -1.55));
    dBronze.push(makeBox(0.22, 0.30, 0.38, side * 1.48, floorY + 1.56, -1.50));
    // Paired golden imperial ceremonial parasols (*Tàn Lọng Vàng*)
    dGold.push(makeCylinder(0.04, 0.05, 2.65, 6, side * 2.65, floorY + 1.32, -2.2));
    dGold.push(makeCylinder(0.58, 0.68, 0.34, 12, side * 2.65, floorY + 2.68, -2.2));
    // Glowing brass oil lamps on main altar
    dBronze.push(makeCylinder(0.09, 0.14, 0.26, 8, side * 1.05, floorY + 1.34, -1.92));
    dLanternCore.push(new THREE.SphereGeometry(0.14, 8, 8).translate(side * 1.05, floorY + 1.58, -1.92));
    // Hanging warm ribbed lanterns under Đền Thượng front eaves (clear of central Hoành Phi plaque)
    dLantern.push(createRibbedLanternShellGeometry(0.24, 0.34, 10, 6).translate(side * 3.85, floorY + hallH - 0.56, 1.92));
    dLanternCore.push(createLanternCoreGeometry(0.14, 0.22).translate(side * 3.85, floorY + hallH - 0.56, 1.92));
    dLantern.push(createRibbedLanternShellGeometry(0.22, 0.32, 10, 6).translate(side * 2.18, floorY + hallH - 0.62, 1.96));
    dLanternCore.push(createLanternCoreGeometry(0.13, 0.20).translate(side * 2.18, floorY + hallH - 0.62, 1.96));
  }
  const sanctumLightPos = new THREE.Vector3(0, floorY + 2.4, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY);
  const denThuongLight = new THREE.PointLight('#ffcc6e', 2.2, 15, 1.5);
  denThuongLight.position.set(cx + sanctumLightPos.x, yBase + sanctumLightPos.y, cz + sanctumLightPos.z);
  group.add(denThuongLight);

  // Lower curved terracotta roof
  const lowRoof = createVietnameseCurvedRoofGeometry(14.8, 9.6, 9.8, 4.8, 2.35, 0.42);
  lowRoof.translate(0, floorY + hallH + 0.04, -1.2);
  dRoof.push(lowRoof);

  // Upper clerestory tier + upper curved terracotta roof (total ~12.0m above courtyard)
  const upperHallY = floorY + hallH + 1.45;
  const upperHallH = 1.85;
  dCrimson.push(makeBox(8.6, upperHallH, 4.2, 0, upperHallY + upperHallH * 0.5, -1.2));
  dGold.push(makeBox(9.2, 0.22, 4.8, 0, upperHallY + upperHallH - 0.06, -1.2));

  const highRoof = createVietnameseCurvedRoofGeometry(11.6, 7.0, 4.6, 0.55, 2.65, 0.48);
  highRoof.translate(0, upperHallY + upperHallH + 0.02, -1.2);
  dRoof.push(highRoof);

  const crestY = upperHallY + upperHallH + 2.68;
  dGold.push(makeBox(4.8, 0.24, 0.22, 0, crestY, -1.2));
  dGold.push(makeCylinder(0.08, 0.22, 0.78, 8, 0, crestY + 0.42, -1.2));

  // Monumental Bronze *Đỉnh Đồng* Incense Urn in front courtyard
  const censerZ = 6.2;
  dStone.push(makeCylinder(0.95, 1.15, 0.65, 8, 0, courtTop + 0.325, censerZ));
  dBronze.push(makeCylinder(0.60, 0.42, 0.92, 14, 0, courtTop + 1.10, censerZ));
  dBronze.push(makeCylinder(0.72, 0.64, 0.24, 14, 0, courtTop + 1.68, censerZ));
  for (const side of [-1, 1]) {
    dBronze.push(makeBox(0.22, 0.65, 0.16, side * 0.74, courtTop + 1.38, censerZ));
  }

  // 4. Authentic *Cột Đá Thề* (An Dương Vương's Oath Stone Pillar) on West terrace outside Đền Thượng
  const oathX = -6.2;
  const oathZ = 4.4;
  dStone.push(makeBox(1.55, 0.34, 1.55, oathX, courtTop + 0.17, oathZ));
  dStone.push(makeBox(1.05, 0.28, 1.05, oathX, courtTop + 0.48, oathZ));
  dStone.push(makeBox(0.56, 1.48, 0.56, oathX, courtTop + 1.36, oathZ));
  dGold.push(makeBox(0.42, 0.72, 0.06, oathX, courtTop + 1.42, oathZ + 0.29));
  dBronze.push(makeCylinder(0.18, 0.14, 0.24, 10, oathX, courtTop + 0.72, oathZ + 0.62));

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

  // 5. *Hùng Vương Lăng* (Tomb of the 6th Hung King) on Eastern hillside terrace adjacent to Đền Thượng
  const tombLocal = new THREE.Vector3(14.8, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingRotY);
  const tombX = cx + tombLocal.x;
  const tombZ = cz + tombLocal.z;
  const tombY = ctx.getHeight(tombX, tombZ);
  ctx.exclusionCircles.push({ x: tombX, z: tombZ, r: 9.5 });

  const tStone: THREE.BufferGeometry[] = [];
  const tLaterite: THREE.BufferGeometry[] = [];
  const tCrimson: THREE.BufferGeometry[] = [];
  const tRoof: THREE.BufferGeometry[] = [];
  const tGold: THREE.BufferGeometry[] = [];
  const tBronze: THREE.BufferGeometry[] = [];
  const tLantern: THREE.BufferGeometry[] = [];
  const tLanternCore: THREE.BufferGeometry[] = [];

  // Deeply skirted 9.8m x 9.8m square terrace & enclosing courtyard walls with front arched gateway
  const tPlatTop = 1.4;
  const tPlatH = tPlatTop + 5.5;
  tStone.push(makeBox(9.8, tPlatH, 9.8, 0, -5.5 + tPlatH * 0.5, 0));
  tLaterite.push(makeBox(10.2, 0.36, 10.2, 0, tPlatTop - 0.18, 0));
  // Perimeter courtyard balustrade & twin stone *Kỳ Lân* guardians flanking front entry
  for (const side of [-1, 1]) {
    tStone.push(makeBox(0.42, 1.15, 9.4, side * 4.65, tPlatTop + 0.58, 0));
    tStone.push(makeBox(3.2, 1.15, 0.42, side * 3.1, tPlatTop + 0.58, 4.65));
    // Twin stone *Kỳ Lân* guardian pedestals & sculpted beasts
    tStone.push(makeBox(0.76, 0.65, 0.76, side * 1.45, tPlatTop + 0.325, 4.75));
    tStone.push(createSculptedRockGeometry(780 + side, 0.32, 0.46, 0.42, 2).translate(side * 1.45, tPlatTop + 0.92, 4.75));
    tLantern.push(createRibbedLanternShellGeometry(0.20, 0.28, 8, 5).translate(side * 1.85, tPlatTop + 3.45, 2.35));
    tLanternCore.push(createLanternCoreGeometry(0.12, 0.18).translate(side * 1.85, tPlatTop + 3.45, 2.35));
  }
  tStone.push(makeBox(9.6, 1.15, 0.42, 0, tPlatTop + 0.58, -4.65));

  // Square columned mausoleum pavilion (*chồng diêm tám mái* 2-tier 8-corner roof + Cửu Long Tranh Châu pearl)
  const tBaseY = tPlatTop + 0.35;
  tStone.push(makeBox(5.6, 0.35, 5.6, 0, tPlatTop + 0.175, -0.4));
  for (const px of [-2.15, 2.15]) {
    for (const pz of [-2.55, 1.75]) {
      tStone.push(makeBox(0.62, 0.42, 0.62, px, tBaseY + 0.21, pz));
      tCrimson.push(makeCylinder(0.18, 0.21, 3.15, 10, px, tBaseY + 0.42 + 1.575, pz));
    }
  }
  // Open-front mausoleum enclosure walls + rectangular masonry tomb chest + gilded "Hùng Vương Lăng" plaque
  tStone.push(makeBox(4.3, 2.6, 0.36, 0, tBaseY + 1.3, -2.55));
  for (const side of [-1, 1]) {
    tStone.push(makeBox(0.36, 2.6, 3.8, side * 2.15, tBaseY + 1.3, -0.6));
  }
  // Inner rectangular tomb chest & *Biểu Chính* vertical stele
  tStone.push(makeBox(2.2, 1.15, 2.6, 0, tBaseY + 0.58, -0.75));
  tGold.push(makeBox(0.62, 1.05, 0.12, 0, tBaseY + 1.55, -1.75));
  // Front gilded "Hùng Vương Lăng" header plaque & bronze incense urn
  tGold.push(makeBox(2.4, 0.62, 0.18, 0, tBaseY + 3.22, 1.85));
  tCrimson.push(makeBox(2.05, 0.42, 0.22, 0, tBaseY + 3.22, 1.87));
  tBronze.push(makeCylinder(0.36, 0.26, 0.54, 12, 0, tBaseY + 0.27, 2.55));

  const tRoof1 = createVietnameseCurvedRoofGeometry(6.8, 6.8, 4.0, 4.0, 1.55, 0.38);
  tRoof1.translate(0, tBaseY + 3.55, -0.4);
  tRoof.push(tRoof1);
  tCrimson.push(makeBox(3.4, 0.92, 3.4, 0, tBaseY + 4.92, -0.4));
  const tRoof2 = createVietnameseCurvedRoofGeometry(5.0, 5.0, 0.9, 0.9, 1.85, 0.44);
  tRoof2.translate(0, tBaseY + 5.32, -0.4);
  tRoof.push(tRoof2);
  // Central gilded *Quả Ngọc* (Precious Pearl of *Cửu Long Tranh Châu*) atop upper mausoleum roof
  tGold.push(makeCylinder(0.08, 0.22, 0.55, 8, 0, tBaseY + 7.36, -0.4));
  tGold.push(new THREE.SphereGeometry(0.28, 10, 8).translate(0, tBaseY + 7.79, -0.4));

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

  addMergedMesh(group, stoneParts, ctx.materials.stone, 'DenHungStoneStepsAndPlinth');
  addMergedMesh(group, lateriteParts, ctx.materials.chamBrick, 'DenHungLateriteCurbs');
  addMergedMesh(group, crimsonParts, ctx.materials.crimsonLacquer, 'DenHungCrimsonHall');
  addMergedMesh(group, woodParts, ctx.materials.darkWood, 'DenHungTimberSanctuary');
  addMergedMesh(group, roofParts, ctx.materials.terracottaRoof, 'DenHungCurvedRoofs');
  addMergedMesh(group, goldParts, ctx.materials.gold, 'DenHungGoldFrieze');
  addMergedMesh(group, bronzeParts, ctx.materials.bronze, 'DenHungBronzeCenser');
  addMergedMesh(group, lanternParts, ctx.materials.lanternSilk, 'DenHungTempleLanterns', false, false);
  addMergedMesh(
    group,
    lanternCoreParts,
    ctx.materials.lanternCore ?? ctx.materials.lanternSilk,
    'DenHungTempleLanternCores',
    false,
    false
  );

  ctx.scene.add(group);
}

/**
 * 6. Northern Landscape Accents:
 * - 2 authentic Mu Cang Chai highland timber stilt houses at (-155, -25) & (-225, -62)
 * - 4 distant towering Hạ Long karst islands (z = -460..-640, 55-80m tall)
 */
function buildNorthernLandscapeAccents(ctx: VietnamBuilderContext): void {
  const group = new THREE.Group();
  group.name = 'NorthernLandscapeAccents';

  const karstParts: THREE.BufferGeometry[] = [];
  const timberParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];

  // 1. 4 distant towering Hạ Long Bay karst islands (z = -460..-640, 55-80m tall)
  const isletSpecs = [
    { seed: 811, r: 24.0, h: 64.0, x: -245, z: -480, lx: 3.2, lz: -1.4 },
    { seed: 812, r: 28.0, h: 76.0, x: 185, z: -515, lx: -3.5, lz: 1.6 },
    { seed: 813, r: 26.0, h: 72.0, x: -75, z: -590, lx: 2.2, lz: 2.4 },
    { seed: 814, r: 22.0, h: 58.0, x: 345, z: -625, lx: -2.4, lz: -1.8 }
  ];
  for (const k of isletSpecs) {
    const geo = createHaLongKarstGeometry(k.seed, k.r, k.h, k.lx, k.lz);
    geo.translate(k.x, -2.4, k.z);
    karstParts.push(geo);
  }

  // 2. 2 authentic Mu Cang Chai highland timber stilt houses (*Nhà sàn Tây Bắc*)
  const stiltSpecs = [
    { x: -155, z: -25, rotY: 0.35 },
    { x: -225, z: -62, rotY: -0.25 }
  ];
  for (const sh of stiltSpecs) {
    ctx.exclusionCircles.push({ x: sh.x, z: sh.z, r: 11.5 });

    // Query exact hillside heights across all 12 stilt post footprints
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

    // Set stilt floor cleanly 2.2m above the highest uphill corner so downhill stilts extend deeply
    const deckY = maxGroundY + 2.2;
    const localWood: THREE.BufferGeometry[] = [];
    const localRoof: THREE.BufferGeometry[] = [];

    for (const p of cornerGrounds) {
      const postBot = p.gy - 2.0;
      const postTop = deckY + 2.85;
      const postH = Math.max(1.5, postTop - postBot);
      localWood.push(
        makeCylinder(0.15, 0.18, postH, 8, p.ox, postBot + postH * 0.5, p.oz)
      );
    }

    // Under-deck horizontal tie beams
    for (const oz of postZs) {
      localWood.push(makeBox(8.4, 0.22, 0.22, 0, deckY - 0.35, oz));
    }
    for (const ox of postXs) {
      localWood.push(makeBox(0.22, 0.22, 6.2, ox, deckY - 0.55, 0));
    }

    // Raised timber plank deck, open front veranda railing & grounded downhill stair
    localWood.push(makeBox(9.4, 0.26, 7.2, 0, deckY, 0));
    localWood.push(makeBox(8.2, 2.65, 4.8, 0, deckY + 1.45, -0.55));
    localWood.push(makeBox(9.0, 0.85, 0.18, 0, deckY + 0.55, 3.45));

    // Downhill access stair anchored continuously to exact terrain at bottom landing (oz = 7.4)
    const stairTopZ = 3.55;
    const stairBotZ = 7.40;
    const stairMidX = 2.2;
    const getLocalGround = (ox: number, oz: number) => {
      const wx = sh.x + ox * Math.cos(sh.rotY) + oz * Math.sin(sh.rotY);
      const wz = sh.z - ox * Math.sin(sh.rotY) + oz * Math.cos(sh.rotY);
      return ctx.getHeight(wx, wz);
    };
    const botGroundY = Math.min(
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
    // Bottom landing block grounded deep into slope
    localWood.push(makeBox(1.8, 1.4, 1.2, stairMidX, botGroundY + 0.1, stairBotZ));

    // Continuous inclined stringer beams from deckY down to botGroundY - 0.8
    const stringerLen = Math.hypot(runZ, dropY) + 0.4;
    const stringerAngle = -Math.atan2(runZ, dropY);
    const midY = (deckY + botGroundY) * 0.5;
    const midZ = (stairTopZ + stairBotZ) * 0.5;
    for (const sx of [1.45, 2.95]) {
      const stringer = makeBox(0.15, stringerLen, 0.22, 0, 0, 0);
      stringer.rotateX(stringerAngle);
      stringer.translate(sx, midY, midZ);
      localWood.push(stringer);
    }

    // Traditional curved highland roof
    const roof = createVietnameseCurvedRoofGeometry(11.2, 8.8, 6.2, 0.45, 3.1, 0.22);
    roof.translate(0, deckY + 2.75, -0.2);
    localRoof.push(roof);

    for (const g of localWood) {
      g.rotateY(sh.rotY);
      g.translate(sh.x, 0, sh.z);
      timberParts.push(g);
    }
    for (const g of localRoof) {
      g.rotateY(sh.rotY);
      g.translate(sh.x, 0, sh.z);
      roofParts.push(g);
    }
  }

  addMergedMesh(group, karstParts, ctx.materials.granite, 'NorthernDistantKarstIslets');
  addMergedMesh(group, timberParts, ctx.materials.darkWood, 'MuCangChaiStiltHousesTimber');
  addMergedMesh(group, roofParts, ctx.materials.darkRoof, 'MuCangChaiStiltHousesRoofs');

  ctx.scene.add(group);
}

/**
 * Builds the 5 Northern Vietnam Heritage Landmarks + Mù Cang Chải / Hạ Long Bay accents at true 1:1 scale.
 */
export function buildVietnamNorthLandmarks(ctx: VietnamBuilderContext): VietnamNorthBuildResult {
  const flagUniforms: Array<{ uTime: { value: number } }> = [];

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: '#d9dfe6',
    metalness: 0.86,
    roughness: 0.24
  });
  ctx.extraMaterials.push(stainlessMat);

  buildHoangThanhThangLong(ctx);
  buildLungCuFlagpole(ctx, stainlessMat, flagUniforms);
  buildFansipanSummit(ctx, stainlessMat, flagUniforms);
  buildChuaHuongAndSuoiYen(ctx);
  buildDenHung(ctx);
  buildNorthernLandscapeAccents(ctx);

  return { flagUniforms };
}
