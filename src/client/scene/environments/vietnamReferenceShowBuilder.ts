import * as THREE from 'three';
import {
  createDongSonBronzeTextures,
  createRedEmblemSailTexture,
  VIETNAM_WATER_LEVEL
} from '../shaders/vietnamHeritageShader';
import {
  VietnamBuilderContext,
  clamp01,
  mulberry32,
  noise2D,
  mergeNormalized,
  createSculptedRockGeometry,
  createVietnameseCurvedRoofGeometry,
  createRibbedLanternShellGeometry,
  createLanternCoreGeometry,
  createWarmLightPoolMaterial,
  createForegroundLotusFlowerParts
} from './vietnamGeometryHelpers';

export interface VietnamReferenceShowController {
  update: (elapsedTime: number, cameraPos?: THREE.Vector3) => void;
  setAtmosphere: (state: {
    timeOfDay: number;
    weather: string;
    nightAmount: number;
    duskAmount: number;
  }) => void;
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
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  parts.push(g);
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
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  parts.push(g);
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

  // 2. Upgraded Bửu Tán Cửu Long canopy: 9-dragon frieze, central Thọ medallion & 4 corner dragon-head draperies (tua rủ)
  addCylPart(goldParts, 0.45, 0.45, 0.14, 16, throneX + 0.6, canopyY - 0.12, centerZ); // central Thọ emblem disc
  addBoxPart(crimsonParts, 3.4, 0.26, 3.4, throneX, canopyY + 0.35, centerZ);
  for (const sx of [-1.55, 1.55]) {
    for (const sz of [-1.55, 1.55]) {
      // Corner descending dragon finial head & flowing carved wooden tua rủ fringe drapery
      addBoxPart(goldParts, 0.28, 0.38, 0.28, throneX + sx, canopyY + 0.15, centerZ + sz);
      addCylPart(goldParts, 0.14, 0.06, 1.15, 8, throneX + sx * 0.94, canopyY - 0.52, centerZ + sz * 0.94);
      addCylPart(crimsonParts, 0.09, 0.16, 0.92, 8, throneX + sx * 0.88, canopyY - 0.44, centerZ + sz * 0.88);
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
  axis: 'x' | 'z'
): void {
  // 1. Gilded "Lai Viễn Kiều" (來遠橋) entrance plaques & Sacred Dog / Monkey guardian statues
  const half = spanX * 0.5;
  for (const endSign of [-1, 1]) {
    if (axis === 'x') {
      addBoxPart(goldParts, 0.16, 0.56, 1.95, cx + endSign * (half - 0.2), deckY + 2.65, cz);
      // Guardian pedestals & sculpted Sacred Dog (-X) / Sacred Monkey (+X)
      for (const sz of [-1.95, 1.95]) {
        const gx = cx + endSign * (half + 1.0);
        const gz = cz + sz;
        addBoxPart(stoneParts, 0.82, 0.72, 0.82, gx, deckY - 0.1, gz);
        // Sculpted seated guardian body + head + ears
        addCylPart(stoneParts, 0.22, 0.30, 0.65, 8, gx, deckY + 0.58, gz);
        addBoxPart(stoneParts, 0.32, 0.30, 0.34, gx - endSign * 0.05, deckY + 1.02, gz);
      }
    } else {
      addBoxPart(goldParts, 1.95, 0.56, 0.16, cx, deckY + 2.65, cz + endSign * (half - 0.2));
      for (const sx of [-1.95, 1.95]) {
        const gx = cx + sx;
        const gz = cz + endSign * (half + 1.0);
        addBoxPart(stoneParts, 0.82, 0.72, 0.82, gx, deckY - 0.1, gz);
        addCylPart(stoneParts, 0.22, 0.30, 0.65, 8, gx, deckY + 0.58, gz);
        addBoxPart(stoneParts, 0.34, 0.30, 0.32, gx, deckY + 1.02, gz - endSign * 0.05);
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

function createFilmstripArchivalTexture(renderer?: THREE.WebGLRenderer): THREE.DataTexture {
  const w = 128;
  const h = 512;
  const data = new Uint8Array(w * h * 4);
  for (let py = 0; py < h; py++) {
    const v = py / h;
    const frameFloat = v * 5.0;
    const frameIdx = Math.floor(frameFloat);
    const fv = frameFloat - frameIdx;
    const isFrameBar = fv < 0.06 || fv > 0.94;
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const inMargin = u < 0.14 || u > 0.86;
      const sprocket = inMargin && ((fv * 4.0) % 1.0) > 0.25 && ((fv * 4.0) % 1.0) < 0.72;
      const idx = (py * w + px) * 4;

      if (sprocket || isFrameBar || (inMargin && (u < 0.04 || u > 0.96))) {
        data[idx] = 26;
        data[idx + 1] = 20;
        data[idx + 2] = 16;
        data[idx + 3] = 255;
      } else if (inMargin) {
        data[idx] = 52;
        data[idx + 1] = 39;
        data[idx + 2] = 28;
        data[idx + 3] = 255;
      } else {
        // Procedural sepia archival documentary halftone silhouettes
        const fu = (u - 0.14) / 0.72;
        const horizon = 0.34 + 0.08 * Math.sin(fu * 7.0 + frameIdx * 1.9);
        const ridge = horizon + 0.18 * Math.exp(-Math.pow((fu - 0.5) * 3.0, 2.0));
        const figure =
          Math.abs(fu - 0.42 - (frameIdx % 2) * 0.14) < 0.09 && fv < 0.68 && fv > 0.16;
        const n = 0.04 * Math.sin(px * 3.1 + py * 1.7);
        const lum = figure ? 0.24 : fv < horizon ? 0.34 : fv < ridge ? 0.48 : 0.86 + n;
        data[idx] = clampByte(240 * lum);
        data[idx + 1] = clampByte(192 * lum);
        data[idx + 2] = clampByte(132 * lum);
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

  // 1. 9 Domed Tràng An limestone towers in 3 depth layers
  const karstRockParts: THREE.BufferGeometry[] = [];
  const karstCapParts: THREE.BufferGeometry[] = [];
  const rand = mulberry32(10101);
  const towerSpecs = [
    [-38, -22, 16, 42],
    [0, -34, 19, 54],
    [42, -24, 15, 44],
    [-64, -52, 20, 62],
    [24, -64, 22, 68],
    [68, -48, 17, 50],
    [-22, -82, 24, 72],
    [54, -84, 21, 60],
    [-78, -82, 18, 52]
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

  // 2. Backlit Ripening Golden Rice Clumps (2,400 instances) with swaying panicle shader
  const stalkParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.PlaneGeometry(0.11, 0.92, 1, 3);
    const bp = blade.attributes.position;
    for (let v = 0; v < bp.count; v++) {
      const yv = bp.getY(v) + 0.46;
      const t = clamp01(yv / 0.92);
      bp.setX(v, bp.getX(v) * (1.0 - t * 0.75));
      bp.setY(v, yv * (1.0 - t * t * 0.14));
      bp.setZ(v, t * t * 0.28); // drooping golden grain panicle
    }
    blade.computeVertexNormals();
    blade.rotateY((b / 4) * Math.PI * 2 + 0.25);
    stalkParts.push(blade);
  }
  const riceClumpGeo = mergeNormalized(stalkParts);
  const riceUni = { uTime: { value: 0.0 } };
  windAnimList.push(riceUni);

  const riceMat = new THREE.MeshStandardMaterial({
    color: '#d9a441',
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
  for (let i = 0; i < riceCount; i++) {
    const rx = cx + (rand() - 0.5) * 86;
    const rz = cz + (rand() - 0.5) * 48 + 8;
    const ry = ctx.getHeight(rx, rz);
    const sc = 0.85 + rand() * 0.45;
    setInstanceMatrix(riceMesh, i, rx, ry, rz, 0, rand() * Math.PI * 2, 0, sc, sc, sc);
  }
  riceMesh.instanceMatrix.needsUpdate = true;
  group.add(riceMesh);

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
    'x'
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

  const lanternShellGeo = createRibbedLanternShellGeometry(0.24, 0.42, 12, 8);
  const silkMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.4,
    roughness: 0.55
  });
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
  const poolHelper = createWarmLightPoolMaterial();
  animList.push(poolHelper.uniforms);
  ctx.extraMaterials.push(poolHelper.material);
  const poolGeo = new THREE.PlaneGeometry(5.5, 5.5);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolHelper.material, 8);
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

  // 4. Floating Hoài River Flower Lanterns (`HoaiRiverFlowerLanterns`) — 220 hoa đăng
  const riverGroup = new THREE.Group();
  riverGroup.name = 'HoaiRiverFlowerLanterns';
  const flowerLotusGeo = new THREE.ConeGeometry(0.18, 0.14, 6, 1, true);
  flowerLotusGeo.rotateX(Math.PI);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: '#ff965a',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide
  });
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

  // Raised imperial plinth & 3-tier central throne dais
  addBoxPart(baseParts, 42, 1.0, 29, hcx, hy + 0.5, hcz);
  addBoxPart(goldParts, 5.2, 0.22, 4.4, hcx - 9, hy + 1.11, hcz);
  addBoxPart(goldParts, 3.8, 0.22, 3.2, hcx - 9, hy + 1.33, hcz);
  addBoxPart(goldParts, 2.4, 0.22, 2.2, hcx - 9, hy + 1.55, hcz);
  // Ngai vàng Throne + Bửu Tán canopy above dais
  addBoxPart(goldParts, 1.3, 1.4, 1.1, hcx - 9.2, hy + 2.35, hcz);
  addCylPart(goldParts, 1.6, 2.0, 0.7, 8, hcx - 9.0, hy + 6.4, hcz);

  // Side walls & Double-tier Hoàng Lưu Ly glazed yellow roof
  addBoxPart(hallShellParts, 40, 6.4, 0.6, hcx, hy + 4.2, hcz - 13.5);
  addBoxPart(hallShellParts, 40, 6.4, 0.6, hcx, hy + 4.2, hcz + 13.5);
  const mainRoof1 = createVietnameseCurvedRoofGeometry(43, 30, 32, 18, 3.8, 0.55);
  mainRoof1.translate(hcx, hy + 7.2, hcz);
  const mainRoof2 = createVietnameseCurvedRoofGeometry(34, 21, 16, 4, 4.4, 0.72);
  mainRoof2.translate(hcx, hy + 10.6, hcz);

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
    const ax = side * (16 + k * 8.5);
    const az = 22.0 + (k % 2) * 24.0;
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

  // 2. Laterite (đá ong #8B5A3C) Walls & Village Well (`LangCoLateriteWalls`)
  const wallGroup = new THREE.Group();
  wallGroup.name = 'LangCoLateriteWalls';
  const latParts: THREE.BufferGeometry[] = [];
  for (const sx of [-12.5, 12.5]) {
    addBoxPart(latParts, 0.45, 1.85, 18.0, cx + sx, ctx.getHeight(cx + sx, cz) + 0.9, cz);
  }
  // Giếng làng round stone well
  const wx = cx + 6.5;
  const wz = cz - 2.0;
  const wy = ctx.getHeight(wx, wz);
  addCylPart(latParts, 1.15, 1.25, 0.72, 16, wx, wy + 0.36, wz);
  const lateriteMat = new THREE.MeshStandardMaterial({
    color: '#8b5a3c',
    map: ctx.pbr.stone.map,
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.92
  });
  ctx.extraMaterials.push(lateriteMat);
  wallGroup.add(new THREE.Mesh(mergeNormalized(latParts), lateriteMat));
  ctx.scene.add(wallGroup);

  // 3. Village Gate & 3 Traditional Brick Houses (`LangCoVillageGate`)
  const gateGroup = new THREE.Group();
  gateGroup.name = 'LangCoVillageGate';
  const gateBodyParts: THREE.BufferGeometry[] = [];
  const houseRoofParts: THREE.BufferGeometry[] = [];
  const warmWinParts: THREE.BufferGeometry[] = [];

  for (const side of [-1.6, 1.6]) {
    addBoxPart(gateBodyParts, 0.85, 3.4, 0.85, cx + side, by + 1.7, cz + 8);
  }
  const gRoof = createVietnameseCurvedRoofGeometry(5.6, 2.4, 2.8, 0.8, 1.4, 0.42);
  gRoof.translate(cx, by + 3.4, cz + 8);
  houseRoofParts.push(gRoof);

  for (const [hx, hz, ry] of [[cx - 9.5, cz - 7, 0.35], [cx + 9.5, cz - 8, -0.35], [cx - 11.5, cz + 4, 1.2]] as Array<[number, number, number]>) {
    const hgy = ctx.getHeight(hx, hz);
    const body = new THREE.BoxGeometry(6.4, 2.8, 4.2);
    body.rotateY(ry);
    body.translate(hx, hgy + 1.4, hz);
    gateBodyParts.push(body);
    const hRoof = createVietnameseCurvedRoofGeometry(7.6, 5.2, 4.4, 0.8, 2.1, 0.3);
    hRoof.rotateY(ry);
    hRoof.translate(hx, hgy + 2.8, hz);
    houseRoofParts.push(hRoof);
    const win = new THREE.BoxGeometry(1.1, 0.9, 0.14);
    win.rotateY(ry);
    win.translate(hx, hgy + 1.45, hz + 2.12);
    warmWinParts.push(win);
  }

  gateGroup.add(new THREE.Mesh(mergeNormalized(gateBodyParts), lateriteMat));
  gateGroup.add(new THREE.Mesh(mergeNormalized(houseRoofParts), ctx.materials.darkRoof));
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: '#ff9a4a',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.45
  });
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
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float band = fract(vViewPosition.y * 0.35 + vViewPosition.x * 0.12);
       float goldLine = 1.0 - smoothstep(0.0, 0.08, abs(band - 0.5) - 0.42);
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
  const brocTex = createBrocadeTexture(ctx.renderer);
  ctx.extraTextures.push(brocTex);
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

  const drumTex = createDongSonBronzeTextures(512, ctx.renderer);
  ctx.extraTextures.push(drumTex.map, drumTex.normalMap, drumTex.roughnessMap);
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
  const filmTex = createFilmstripArchivalTexture(ctx.renderer);
  ctx.extraTextures.push(filmTex);
  const filmMat = new THREE.MeshStandardMaterial({
    map: filmTex,
    emissive: new THREE.Color('#ff8c3a'),
    emissiveMap: filmTex,
    emissiveIntensity: 0.45,
    roughness: 0.35
  });
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

  const redSailTex = createRedEmblemSailTexture(256, ctx.renderer);
  ctx.extraTextures.push(redSailTex);
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
    addCylPart(hullParts, 0.16 * scale, 0.22 * scale, 14 * scale, 8, 1.2 * scale, 7.2 * scale, 0);
    ship.add(new THREE.Mesh(mergeNormalized(hullParts), ctx.materials.darkWood));

    const sail = new THREE.Mesh(new THREE.PlaneGeometry(8.2 * scale, 11.5 * scale), redSailMat);
    sail.position.set(1.2 * scale, 8.2 * scale, 0.3);
    sail.rotation.y = Math.PI * 0.5;
    ship.add(sail);

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
  const puffs: Array<[number, number, number]> = [
    [-2.4, -0.1, 1.4],
    [-0.9, 0.35, 1.7],
    [0.7, 0.75, 2.0],
    [2.1, 0.15, 1.55],
    [3.4, -0.25, 1.1]
  ];
  for (const [ox, oy, rad] of puffs) {
    const puff = new THREE.SphereGeometry(rad, 12, 8);
    puff.scale(1.5, 0.54, 0.42);
    puff.translate(ox, oy, 0);
    parts.push(puff);
  }
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

function createWarJunkHullGeometry(scale: number): THREE.BufferGeometry {
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
  addBoxPart(hullParts, 5.8 * scale, 2.2 * scale, beam * 0.86, -len * 0.26, 2.2 * scale, 0);
  addCylPart(hullParts, 0.18 * scale, 0.26 * scale, 15.5 * scale, 8, 1.2 * scale, 8.0 * scale, 0);
  addBoxPart(hullParts, 0.22 * scale, 0.22 * scale, 10.5 * scale, 1.2 * scale, 14.2 * scale, 0);
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
    }
  }
  return mergeNormalized(hullParts);
}

function buildTamCocMacroValley(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): THREE.MeshStandardMaterial {
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

  // 2. 5,800 Backlit Golden Rice Clumps across wide Tam Cốc plain
  const bladeParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.PlaneGeometry(0.12, 0.96, 1, 3);
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
  const riceGeo = mergeNormalized(bladeParts);
  const riceUniform = { uTime: { value: 0 } };
  animList.push(riceUniform);
  const riceMat = new THREE.MeshStandardMaterial({
    color: '#d9a441',
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
    placed++;
  }
  riceInst.count = placed;
  riceInst.instanceMatrix.needsUpdate = true;
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
  for (let b = -2; b <= 2; b++) {
    addBoxPart(timberParts, 260, 0.28, 0.55, cx, 1.32, cz + b * 36);
  }
  const strawMat = new THREE.MeshStandardMaterial({
    color: '#b98a4a',
    map: ctx.pbr.timber.map,
    roughness: 0.90
  });
  ctx.extraMaterials.push(strawMat);
  group.add(
    new THREE.Mesh(mergeNormalized(strawParts), strawMat),
    new THREE.Mesh(mergeNormalized(timberParts), ctx.materials.darkWood)
  );

  // 4. Hang Cả Xuyên Thủy Tam Cốc (Karst Water Cave Arch & Stalactites) + Bến Đò + Thuyền Nan Mái Chèo Chân
  const caveParts: THREE.BufferGeometry[] = [];
  const stalactiteParts: THREE.BufferGeometry[] = [];
  const bambooParts: THREE.BufferGeometry[] = [];

  // 4.1 Hang Cả Karst Cave Arch over Ngô Đồng canal at (cx + 14, -308)
  const caveX = cx + 14;
  const caveZ = -308.0;
  // North and South limestone cavern abutments flanking the canal (canal width ~16m along Z)
  addBoxPart(caveParts, 28.0, 16.0, 16.0, caveX, 8.0, caveZ - 18.0);
  addBoxPart(caveParts, 28.0, 16.0, 16.0, caveX, 8.0, caveZ + 18.0);
  // Arched limestone tunnel ceiling bridging over the river channel (underside y = 11.0m)
  addBoxPart(caveParts, 28.0, 4.5, 42.0, caveX, 13.5, caveZ);
  // Inward arch corbels framing the cavern portal
  addBoxPart(caveParts, 28.0, 3.5, 6.0, caveX, 10.2, caveZ - 9.5);
  addBoxPart(caveParts, 28.0, 3.5, 6.0, caveX, 10.2, caveZ + 9.5);
  // 18 Hanging Limestone Stalactites (nhũ đá rủ từ trần hang)
  const randStal = mulberry32(88001);
  for (let s = 0; s < 18; s++) {
    const sx = caveX - 9.0 + randStal() * 18.0;
    const sz = caveZ - 5.5 + randStal() * 11.0;
    const sLen = 1.8 + randStal() * 2.5;
    addCylPart(stalactiteParts, 0.04, 0.26 + randStal() * 0.14, sLen, 6, sx, 11.2 - sLen * 0.5, sz);
  }

  // 4.2 Bến Đò Tam Cốc (Rustic River Landing Pier & Mooring Stakes)
  const pierX = cx - 115;
  const pierZ = -316.0;
  addBoxPart(timberParts, 8.5, 0.28, 4.2, pierX, 0.35, pierZ);
  for (const [px, pz] of [[-3.8, -1.8], [3.8, -1.8], [-3.8, 1.8], [3.8, 1.8]]) {
    addCylPart(timberParts, 0.12, 0.12, 2.2, 6, pierX + px, 0.45, pierZ + pz);
  }
  for (let st = 0; st < 3; st++) {
    addBoxPart(strawParts, 7.2 - st * 0.4, 0.18, 0.9, pierX, 0.18 - st * 0.16, pierZ + 2.4 + st * 0.7);
  }

  // 4.3 4 Photo-Authentic Tam Cốc Sampans with Signature Foot-Oars & Woven Bamboo Awnings
  const bambooCanopyMat = new THREE.MeshStandardMaterial({
    color: '#c49a56',
    map: ctx.pbr.timber.map,
    roughness: 0.85,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(bambooCanopyMat);

  for (let s = 0; s < 4; s++) {
    const sx = cx - 90 + s * 62;
    const sz = -308.0 + 18.0 * Math.sin((sx - cx) * 0.016);
    const boat = new THREE.Group();
    const bParts: THREE.BufferGeometry[] = [];
    const bBamboo: THREE.BufferGeometry[] = [];

    // Curved wooden sampan hull (slender bottom with upturned bow & stern)
    addBoxPart(bParts, 6.8, 0.45, 1.45, 0, 0.18, 0);
    // Upturned bow and stern prow blocks
    addBoxPart(bParts, 0.85, 0.75, 1.25, 3.45, 0.45, 0, 0, 0, -0.35);
    addBoxPart(bParts, 0.85, 0.75, 1.25, -3.45, 0.45, 0, 0, 0, 0.35);
    // Passenger and rower benches
    addBoxPart(bParts, 0.28, 0.32, 1.35, -1.8, 0.42, 0);
    addBoxPart(bParts, 0.28, 0.32, 1.35, 1.6, 0.42, 0);

    // Arched woven bamboo roof awning (mui thuyền đan tre)
    const muiRoof = new THREE.CylinderGeometry(0.82, 0.82, 2.6, 12, 1, true, 0, Math.PI);
    muiRoof.rotateZ(Math.PI * 0.5);
    muiRoof.translate(-0.2, 0.88, 0);
    bBamboo.push(muiRoof);

    // Signature Pair of Tam Cốc Foot-Oars (cặp mái chèo chân Ninh Bình)
    // Mounted in pivoting stern rowlocks, angled backward where rower maneuvers with feet
    for (const os of [-0.85, 0.85]) {
      // Rowlock pin
      addCylPart(bParts, 0.03, 0.03, 0.35, 4, -2.4, 0.65, os);
      // Long wooden oar shaft angled backward and outward
      addCylPart(bParts, 0.035, 0.055, 3.2, 5, -3.6, 0.32, os * 1.35, os * 0.25, 0.55);
      // Flat oar blade dipping into water
      addBoxPart(bParts, 0.75, 0.04, 0.22, -4.9, 0.04, os * 1.7, 0, os * 0.2, 0.45);
    }

    boat.add(
      new THREE.Mesh(mergeNormalized(bParts), ctx.materials.darkWood),
      new THREE.Mesh(mergeNormalized(bBamboo), bambooCanopyMat)
    );
    boat.position.set(sx, VIETNAM_WATER_LEVEL + 0.05, sz);
    group.add(boat);
    ctx.junkBoats.push({
      group: boat,
      centerX: sx,
      centerZ: sz,
      radiusX: 1.4,
      radiusZ: 0.8,
      speed: 0.24,
      phase: s * 1.4
    });
  }

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
  return lampMat;
}

function buildHoiAnMacroDistricts(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): { silkMat: THREE.MeshStandardMaterial; skyMat: THREE.MeshStandardMaterial; flowerMat: THREE.MeshStandardMaterial } {
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
  }

  // Central 9.5m 7-tier Lantern Tower + Red Arched Bridge
  const towerZ = qz - 42;
  const towerY = ctx.getHeight(qx, towerZ);
  for (let t = 0; t < 7; t++) {
    const r = 1.15 - t * 0.11;
    addCylPart(colParts, r * 0.9, r, 1.05, 12, qx, towerY + 1.2 + t * 1.18, towerZ);
    addCylPart(goldParts, r * 1.08, r * 1.08, 0.16, 12, qx, towerY + 1.75 + t * 1.18, towerZ);
  }
  addBoxPart(colParts, 14.0, 0.55, 5.4, qx, towerY + 0.85, qz - 26); // red arched bridge
  for (const s of [-1, 1]) {
    addBoxPart(colParts, 14.0, 1.05, 0.25, qx, towerY + 1.55, qz - 26 + s * 2.55);
  }
  // Covered Chùa Cầu roof, Lai Viễn Kiều plaque, Bắc Đế Trấn Võ shrine & Dog/Monkey guardians on macro bridge
  const macroBridgeRoof = createVietnameseCurvedRoofGeometry(15.2, 6.2, 10.6, 1.6, 2.1, 0.42);
  macroBridgeRoof.translate(qx, towerY + 4.35, qz - 26);
  roofParts.push(macroBridgeRoof);
  const macroBridgeStone: THREE.BufferGeometry[] = [];
  const macroBridgeLanterns: THREE.BufferGeometry[] = [];
  addChuaCauInteriorAndGuardians(
    colParts,
    goldParts,
    woodParts,
    macroBridgeStone,
    macroBridgeLanterns,
    qx,
    towerY + 1.15,
    qz - 26,
    14.0,
    'x'
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

  // 12 Colonnaded Ochre Shophouses along both flanks
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const sx = qx + side * 28;
      const sz = qz - 48 + i * 18;
      const sy = ctx.getHeight(sx, sz);
      addBoxPart(wallParts, 9.0, 5.2, 14.0, sx, sy + 2.6, sz);
      addBoxPart(woodParts, 0.35, 3.4, 10.0, sx - side * 4.55, sy + 1.7, sz);
      addBoxPart(winParts, 0.18, 1.4, 2.2, sx - side * 4.62, sy + 3.6, sz - 2.6);
      addBoxPart(winParts, 0.18, 1.4, 2.2, sx - side * 4.62, sy + 3.6, sz + 2.6);
      const sRoof = createVietnameseCurvedRoofGeometry(11.4, 15.6, 2.4, 10.8, 2.5, 0.32);
      sRoof.translate(sx, sy + 5.2, sz);
      roofParts.push(sRoof);
    }
  }

  const silkMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.45,
    roughness: 0.52
  });
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
  ctx.extraMaterials.push(silkMat);

  const lanternGeo = createRibbedLanternShellGeometry(0.28, 0.48, 12, 8);
  const canopyInst = new THREE.InstancedMesh(lanternGeo, silkMat, 640);
  const rand = mulberry32(22022);
  const cols = [
    new THREE.Color('#ffb347'),
    new THREE.Color('#ffe08a'),
    new THREE.Color('#c8102e'),
    new THREE.Color('#ff7a3c'),
    new THREE.Color('#e8749a')
  ];
  let idx = 0;
  for (let row = 0; row < 20; row++) {
    const rz = qz - 40 + row * 4.6;
    for (let col = 0; col < 32 && idx < 640; col++) {
      const t = col / 31;
      const rx = qx - 21.5 + t * 43.0;
      const sag = 0.72 * 4.0 * t * (1.0 - t);
      const ry = qY + 5.2 - sag + (row % 2) * 0.4;
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

  const poolHelper = createWarmLightPoolMaterial();
  animList.push(poolHelper.uniforms);
  ctx.extraMaterials.push(poolHelper.material);
  const poolGeo = new THREE.PlaneGeometry(7.2, 7.2);
  poolGeo.rotateX(-Math.PI / 2);
  const poolInst = new THREE.InstancedMesh(poolGeo, poolHelper.material, 16);
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

  // --- M3: HoaiRiverNightPromenade (760, 260) ---
  const rx = 760;
  const rz = 260;
  ctx.exclusionCircles.push({ x: rx, z: rz, r: 135 });
  const rGroup = new THREE.Group();
  rGroup.name = 'HoaiRiverNightPromenade';
  const brWoodParts: THREE.BufferGeometry[] = [];
  const bankShopParts: THREE.BufferGeometry[] = [];
  const bankRoofParts: THREE.BufferGeometry[] = [];

  // 68m Wooden Balustrade Bridge over Hoài River (z = 236..328)
  addBoxPart(brWoodParts, 4.8, 0.36, 92, rx, VIETNAM_WATER_LEVEL + 2.6, rz + 22);
  for (let p = 0; p <= 24; p++) {
    const pz = rz - 24 + p * 3.8;
    for (const s of [-1, 1]) {
      addCylPart(brWoodParts, 0.14, 0.18, 4.4, 8, rx + s * 2.1, VIETNAM_WATER_LEVEL + 0.8, pz);
      addBoxPart(brWoodParts, 0.14, 1.05, 0.14, rx + s * 2.1, VIETNAM_WATER_LEVEL + 3.25, pz);
      addBoxPart(brWoodParts, 0.08, 2.4, 0.08, rx + s * 2.1, VIETNAM_WATER_LEVEL + 4.3, pz);
    }
    addBoxPart(brWoodParts, 4.6, 0.12, 0.12, rx, VIETNAM_WATER_LEVEL + 5.45, pz);
  }
  for (const s of [-1, 1]) {
    addBoxPart(brWoodParts, 0.16, 0.14, 92, rx + s * 2.1, VIETNAM_WATER_LEVEL + 3.72, rz + 22);
  }
  // 10 riverside ochre shophouses along northern bank (z = 220)
  for (let i = 0; i < 10; i++) {
    const sx = rx - 110 + i * 24;
    const sz = 218;
    const sy = ctx.getHeight(sx, sz);
    addBoxPart(bankShopParts, 16, 4.8, 10, sx, sy + 2.4, sz);
    const rf = createVietnameseCurvedRoofGeometry(17.5, 11.4, 12.0, 2.2, 2.4, 0.3);
    rf.translate(sx, sy + 4.8, sz);
    bankRoofParts.push(rf);
  }
  rGroup.add(
    new THREE.Mesh(mergeNormalized(brWoodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(bankShopParts), ctx.materials.yellowOchrePlaster),
    new THREE.Mesh(mergeNormalized(bankRoofParts), ctx.materials.terracottaRoof)
  );

  // 140 Bridge Rail & Overhead Lanterns
  const brLanterns = new THREE.InstancedMesh(cylGeo, silkMat, 140);
  for (let i = 0; i < 140; i++) {
    const lz = rz - 24 + (i % 70) * 1.32;
    const lx = rx + (i < 70 ? -2.05 : 2.05);
    setInstanceMatrix(brLanterns, i, lx, VIETNAM_WATER_LEVEL + 5.15, lz, 0, 0, 0, 0.85, 0.85, 0.85);
    brLanterns.setColorAt(i, cols[i % 2]);
  }
  brLanterns.instanceMatrix.needsUpdate = true;
  if (brLanterns.instanceColor) brLanterns.instanceColor.needsUpdate = true;
  rGroup.add(brLanterns);

  // 450 Floating Hoa Đăng + 260 Sky Lanterns
  const flowerGeo = new THREE.ConeGeometry(0.22, 0.16, 8, 1, true);
  flowerGeo.rotateX(Math.PI);
  const flowerMat = new THREE.MeshStandardMaterial({
    color: '#ff965a',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide
  });
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

  // 6 Wooden River Sampans carrying lanterns
  for (let b = 0; b < 6; b++) {
    const bx = rx - 95 + b * 38;
    const bz = 268 + (b % 2) * 26;
    const sampan = new THREE.Group();
    const sParts: THREE.BufferGeometry[] = [];
    addBoxPart(sParts, 6.5, 0.55, 1.55, 0, 0.2, 0);
    addCylPart(sParts, 0.05, 0.06, 2.2, 6, 2.7, 1.2, 0);
    sampan.add(new THREE.Mesh(mergeNormalized(sParts), ctx.materials.darkWood));
    const bowLantern = new THREE.Mesh(cylGeo, silkMat);
    bowLantern.position.set(2.7, 2.2, 0);
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
  return { silkMat, skyMat, flowerMat };
}

function buildHueGrandImperialPalaceMacro(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
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
  const vaseParts: THREE.BufferGeometry[] = [];

  // Stepped Sân Đại Triều Nghi esplanade & Điện Thái Hòa double-roof hall
  addBoxPart(stoneParts, 78, 0.65, 62, cx + 10, y + 0.32, cz);
  addBoxPart(stoneParts, 54, 1.25, 36, cx - 20, y + 0.62, cz);
  addBoxPart(wallParts, 50, 7.6, 0.7, cx - 20, y + 5.05, cz - 17);
  addBoxPart(wallParts, 50, 7.6, 0.7, cx - 20, y + 5.05, cz + 17);
  addBoxPart(wallParts, 0.7, 7.6, 34, cx - 44, y + 5.05, cz);

  // Paired Trùng Thiềm Điệp Ốc Hoàng Lưu Ly Roofs + Dragon Finials + Flanking Tả/Hữu Vu wings
  const r1 = createVietnameseCurvedRoofGeometry(54, 38, 40, 22, 4.4, 0.65);
  r1.translate(cx - 20, y + 8.9, cz);
  const r2 = createVietnameseCurvedRoofGeometry(42, 26, 20, 6, 5.2, 0.85);
  r2.translate(cx - 20, y + 13.0, cz);
  roofParts.push(r1, r2);
  addBoxPart(goldParts, 18.0, 0.45, 0.45, cx - 20, y + 18.3, cz); // dragon ridge crest
  for (const side of [-1, 1]) {
    addBoxPart(wallParts, 34, 5.2, 10, cx + 12, y + 3.25, cz + side * 38);
    const wr = createVietnameseCurvedRoofGeometry(36, 12, 26, 3, 2.8, 0.45);
    wr.translate(cx + 12, y + 5.85, cz + side * 38);
    roofParts.push(wr);
  }

  // Carved Ngai Vàng dragon throne on 3-tier golden dais, Bửu Tán canopy, 5-panel screen & Cửa Võng friezes
  addBoxPart(goldParts, 6.2, 0.28, 5.2, cx - 32, y + 1.39, cz);
  addBoxPart(goldParts, 4.4, 0.28, 3.8, cx - 32, y + 1.67, cz);
  addBoxPart(goldParts, 2.8, 0.28, 2.6, cx - 32, y + 1.95, cz);
  addBoxPart(goldParts, 1.45, 0.35, 1.35, cx - 32.3, y + 2.26, cz); // throne seat
  addBoxPart(goldParts, 0.36, 1.85, 1.45, cx - 32.95, y + 3.22, cz); // high carved dragon backrest
  addBoxPart(goldParts, 0.72, 0.55, 0.24, cx - 32.3, y + 3.98, cz); // royal crest crown
  for (const side of [-1, 1]) {
    addBoxPart(goldParts, 1.15, 0.65, 0.22, cx - 32.3, y + 2.75, cz + side * 0.62); // dragon armrests
  }
  addBoxPart(goldParts, 0.3, 4.6, 9.2, cx - 36, y + 4.3, cz);
  addCylPart(goldParts, 1.8, 2.3, 0.85, 8, cx - 32.2, y + 7.6, cz);
  for (let b = 0; b < 4; b++) {
    addBoxPart(goldParts, 0.22, 1.45, 22.0, cx - 6 - b * 9.0, y + 7.6, cz);
  }

  // 6 Porcelain vases & 6 Red/White Nghi Trượng fans/parasols
  for (const vz of [-8.8, -6.2, -3.8, 3.8, 6.2, 8.8]) {
    addCylPart(vaseParts, 0.26, 0.36, 1.55, 12, cx - 29.5, y + 2.02, cz + vz);
    addCylPart(goldParts, 0.05, 0.05, 3.2, 6, cx - 30.8, y + 2.85, cz + vz);
    addCylPart(vaseParts, 0.88, 0.96, 0.30, 14, cx - 30.8, y + 4.45, cz + vz);
  }
  const macroCrimsonParts: THREE.BufferGeometry[] = [];
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
    y + 7.6,
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
  group.add(new THREE.Mesh(mergeNormalized(macroCrimsonParts), imperialCrimsonMat));

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
    new THREE.Mesh(mergeNormalized(vaseParts), porcelainMat),
    colInst,
    baseInst,
    palInst,
    throneWarmLight
  );
  ctx.scene.add(group);
  return palMat;
}

function buildDaiLienHoaLotusSanctuaryMacro(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
  const cx = 0;
  const cz = -560;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 108 });
  const group = new THREE.Group();
  group.name = 'DaiLienHoaLotusSanctuary';

  const daiSenMat = new THREE.MeshStandardMaterial({
    color: '#e8749a',
    emissive: new THREE.Color('#ff6699'),
    emissiveIntensity: 0.4,
    roughness: 0.45,
    side: THREE.DoubleSide
  });
  const cloudTealMat = new THREE.MeshStandardMaterial({
    color: '#2bb3b1',
    emissive: new THREE.Color('#2bb3b1'),
    emissiveIntensity: 0.45,
    roughness: 0.42
  });
  const padMat = new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.55, side: THREE.DoubleSide });
  ctx.extraMaterials.push(daiSenMat, cloudTealMat, padMat);

  // 1. Colossal 9.6m Đài Sen Hero Centerpiece on 3-tier White-Jade Pedestal
  const pedParts: THREE.BufferGeometry[] = [];
  addCylPart(pedParts, 5.2, 6.2, 0.85, 24, cx, 0.42, cz);
  addCylPart(pedParts, 4.0, 4.8, 0.75, 24, cx, 1.2, cz);
  const heroFlower = createForegroundLotusFlowerParts(cx, 1.6, cz, 0.1, 30.0, 1.0, 0.0);
  for (const s of heroFlower.stemParts) s.dispose();

  // Sweeping Carved Lotus-Scroll Tam Quan Archway & Curved Roof behind lake
  const archParts: THREE.BufferGeometry[] = [];
  addBoxPart(archParts, 46, 2.2, 1.4, cx, 10.6, cz - 42);
  for (const sx of [-21.5, -10.5, 10.5, 21.5]) {
    addCylPart(archParts, 0.42, 0.48, 9.6, 12, cx + sx, 5.1, cz - 42);
    addCylPart(pedParts, 0.72, 0.92, 0.85, 12, cx + sx, 0.55, cz - 42);
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
  group.add(
    new THREE.Mesh(mergeNormalized(pedParts), ctx.materials.whiteMarble ?? ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(heroFlower.petalParts), daiSenMat),
    new THREE.Mesh(mergeNormalized(heroFlower.coreParts), ctx.materials.gold),
    new THREE.Mesh(mergeNormalized(archParts), ctx.materials.crimsonLacquer),
    new THREE.Mesh(archRoofGeo, archRoofMat)
  );

  // 2. 16 Tall Lotus-Etched Red Lacquer Columns on White-Jade Bases
  const lotusColMat = createRedLacquerColumnShaderMat(ctx, 'lotus');
  const colInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.36, 0.40, 8.8, 16), lotusColMat, 16);
  const baseInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.55, 0.75, 0.75, 16),
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
    setInstanceMatrix(baseInst, i, ax, ay + 0.38, az, 0, -a, 0, 1, 1, 1);
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

  // 4. 600 Living Sacred Lotus Flowers + 720 Floating & Raised Lotus Pads
  const rand = mulberry32(55055);
  const sampleFlower = createForegroundLotusFlowerParts(0, 0, 0, 0.4, 2.2, 0.85, 0.0);
  for (const s of sampleFlower.stemParts) s.dispose();
  for (const c of sampleFlower.coreParts) c.dispose();
  const petalGeo = mergeNormalized(sampleFlower.petalParts);
  const flowerInst = new THREE.InstancedMesh(petalGeo, daiSenMat, 600);
  const padGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.04, 14);
  const padInst = new THREE.InstancedMesh(padGeo, padMat, 720);
  for (let i = 0; i < 600; i++) {
    const a = rand() * Math.PI * 2;
    const r = 10 + Math.sqrt(rand()) * 38;
    const sc = 0.75 + rand() * 0.55;
    setInstanceMatrix(flowerInst, i, cx + Math.cos(a) * r, VIETNAM_WATER_LEVEL + 0.35 + rand() * 0.5, cz + Math.sin(a) * r, 0, rand() * 6.28, 0, sc, sc, sc);
  }
  for (let i = 0; i < 720; i++) {
    const a = rand() * Math.PI * 2;
    const r = 8 + Math.sqrt(rand()) * 42;
    const sc = 0.7 + rand() * 0.75;
    setInstanceMatrix(padInst, i, cx + Math.cos(a) * r, VIETNAM_WATER_LEVEL + 0.04 + (rand() > 0.65 ? rand() * 0.45 : 0), cz + Math.sin(a) * r, 0, rand() * 6.28, 0, sc, 1, sc);
  }
  flowerInst.instanceMatrix.needsUpdate = true;
  padInst.instanceMatrix.needsUpdate = true;

  group.add(colInst, baseInst, tvInst, flowerInst, padInst);
  ctx.scene.add(group);
  return daiSenMat;
}

function buildDuongLamVillageMacro(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
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

  // 2. Laterite (Đá Ong) Compound Walls, Cổng Làng Mông Phụ, Sân Đình Gạch Nghiêng, Giếng Cổ & Chum Tương
  const latParts: THREE.BufferGeometry[] = [];
  const roofParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const winParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const urnParts: THREE.BufferGeometry[] = [];
  const goldParts: THREE.BufferGeometry[] = [];
  const baseY = ctx.getHeight(cx, cz);

  for (const sx of [-42, 42]) {
    addBoxPart(latParts, 0.6, 2.2, 68, cx + sx, baseY + 1.1, cz);
    // Side Cổng Làng Gateway with wooden grill bars
    addBoxPart(latParts, 1.2, 4.4, 1.2, cx + sx, baseY + 2.2, cz + 26);
    addBoxPart(latParts, 1.2, 4.4, 1.2, cx + sx, baseY + 2.2, cz + 31);
    for (let bar = 0; bar < 5; bar++) {
      addCylPart(woodParts, 0.06, 0.06, 3.2, 6, cx + sx, baseY + 1.7, cz + 27 + bar * 0.75);
    }
    const gr = createVietnameseCurvedRoofGeometry(3.2, 7.2, 0.8, 4.6, 1.8, 0.42);
    gr.translate(cx + sx, baseY + 4.4, cz + 28.5);
    roofParts.push(gr);
  }

  // 2.1 Cổng Làng Mông Phụ (Iconic Mông Phụ Village Gate facing entrance axis)
  const gateZ = cz + 34;
  const gateY = ctx.getHeight(cx, gateZ);
  // Heavy laterite side pillars and abutments
  addBoxPart(latParts, 1.8, 5.2, 1.8, cx - 3.4, gateY + 2.6, gateZ);
  addBoxPart(latParts, 1.8, 5.2, 1.8, cx + 3.4, gateY + 2.6, gateZ);
  addBoxPart(latParts, 8.6, 1.4, 1.6, cx, gateY + 4.5, gateZ); // arched laterite lintel
  // Two heavy wooden entrance doors with iron nails and horizontal locking bar (then cài)
  addBoxPart(woodParts, 0.22, 3.8, 1.45, cx - 1.25, gateY + 1.9, gateZ);
  addBoxPart(woodParts, 0.22, 3.8, 1.45, cx + 1.25, gateY + 1.9, gateZ);
  addBoxPart(woodParts, 0.16, 0.22, 3.4, cx, gateY + 2.05, gateZ + 0.18);
  // Two-tiered curved terracotta tile roof (chồng diêm 2 tầng mái ngói mũi hài rêu phong)
  const gateRoofLower = createVietnameseCurvedRoofGeometry(4.8, 9.6, 1.2, 6.4, 1.9, 0.45);
  gateRoofLower.translate(cx, gateY + 5.2, gateZ);
  roofParts.push(gateRoofLower);
  const gateRoofUpper = createVietnameseCurvedRoofGeometry(3.6, 6.8, 0.9, 4.2, 2.2, 0.48);
  gateRoofUpper.translate(cx, gateY + 7.1, gateZ);
  roofParts.push(gateRoofUpper);
  // Gold-inscribed wooden plaque "MÔNG PHỤ MÔN" / "TIẾP PHÚC" above arch
  addBoxPart(woodParts, 0.14, 0.65, 2.4, cx, gateY + 4.5, gateZ + 0.88);
  addBoxPart(goldParts, 0.16, 0.52, 2.18, cx, gateY + 4.5, gateZ + 0.91);

  // 2.2 Sân Đình Mông Phụ Lát Gạch Nghiêng Bát Tràng (Traditional Herringbone Red Brick Courtyard)
  addBoxPart(brickParts, 46.0, 0.18, 44.0, cx, baseY + 0.09, cz - 10);

  // 2.3 Giếng Cổ Đá Ong Đường Lâm (Ancient Laterite Well with Stone Apron & Pulley Frame)
  const wellX = cx + 14;
  const wellZ = cz - 4;
  const wellY = ctx.getHeight(wellX, wellZ);
  addCylPart(latParts, 1.55, 1.70, 0.95, 18, wellX, wellY + 0.48, wellZ);
  addCylPart(brickParts, 2.65, 2.75, 0.18, 8, wellX, wellY + 0.09, wellZ);
  addCylPart(woodParts, 0.08, 0.08, 2.6, 6, wellX - 1.1, wellY + 1.3, wellZ);
  addCylPart(woodParts, 0.08, 0.08, 2.6, 6, wellX + 1.1, wellY + 1.3, wellZ);
  addBoxPart(woodParts, 2.4, 0.14, 0.14, wellX, wellY + 2.55, wellZ);
  addCylPart(woodParts, 0.16, 0.16, 0.12, 10, wellX, wellY + 2.35, wellZ);

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
    const hr = createVietnameseCurvedRoofGeometry(12.2, 7.0, 8.2, 1.0, 2.5, 0.32);
    hr.rotateY(ry);
    hr.translate(hx, hy + 3.4, hz);
    roofParts.push(hr);
    const win = new THREE.BoxGeometry(1.6, 1.8, 0.16);
    win.rotateY(ry);
    win.translate(hx + Math.sin(ry) * 2.85, hy + 1.1, hz + Math.cos(ry) * 2.85);
    winParts.push(win);
  }

  const lateriteMat = new THREE.MeshStandardMaterial({
    color: '#8b5a3c',
    map: ctx.pbr.stone.map,
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.92
  });
  const warmDoorMat = new THREE.MeshStandardMaterial({
    color: '#ff9a4a',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 0.6
  });
  const brickMat = new THREE.MeshStandardMaterial({
    color: '#9e4a34',
    map: ctx.pbr.stone.map,
    normalMap: ctx.pbr.stone.normalMap,
    roughness: 0.88
  });
  const urnMat = new THREE.MeshStandardMaterial({
    color: '#4a2713',
    roughness: 0.34,
    metalness: 0.08
  });
  ctx.extraMaterials.push(lateriteMat, warmDoorMat, brickMat, urnMat);

  // 450 Nocturnal Fireflies
  const ffMat = new THREE.MeshBasicMaterial({ color: '#d8ff7a' });
  ctx.extraMaterials.push(ffMat);
  const ffInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 5, 4), ffMat, 450);
  for (let i = 0; i < 450; i++) {
    setInstanceMatrix(ffInst, i, cx + (rand() - 0.5) * 95, baseY + 0.8 + rand() * 11.0, cz + (rand() - 0.5) * 95, 0, 0, 0, 1, 1, 1);
  }
  ffInst.instanceMatrix.needsUpdate = true;

  group.add(
    new THREE.Mesh(mergeNormalized(trunkParts), uplitBarkMat),
    new THREE.Mesh(mergeNormalized(stepParts), ctx.materials.stone),
    leafInst,
    new THREE.Mesh(mergeNormalized(latParts), lateriteMat),
    new THREE.Mesh(mergeNormalized(roofParts), ctx.materials.terracottaRoof),
    new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(winParts), warmDoorMat),
    new THREE.Mesh(mergeNormalized(brickParts), brickMat),
    new THREE.Mesh(mergeNormalized(urnParts), urnMat),
    new THREE.Mesh(mergeNormalized(goldParts), ctx.materials.gold),
    ffInst
  );
  ctx.scene.add(group);
  return warmDoorMat;
}

function buildLongVanLacquerValleyMacro(
  ctx: VietnamBuilderContext,
  animList: Array<{ uTime: { value: number } }>
): void {
  const cx = 820;
  const cz = -80;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 145 });
  const group = new THREE.Group();
  group.name = 'LongVanLacquerValleyMacro';
  const baseY = ctx.getHeight(cx, cz);

  // 1. Monumental 32m Sculpted Coiling Vietnamese Dragon + 28m Concentric Gold Halo Disc
  const dragonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx - 18, baseY + 1.5, cz - 14),
    new THREE.Vector3(cx - 8, baseY + 6.5, cz - 22),
    new THREE.Vector3(cx + 9, baseY + 12.0, cz - 16),
    new THREE.Vector3(cx - 6, baseY + 18.5, cz - 26),
    new THREE.Vector3(cx + 3, baseY + 25.0, cz - 30),
    new THREE.Vector3(cx, baseY + 29.5, cz - 24)
  ]);
  const dragonParts: THREE.BufferGeometry[] = [new THREE.TubeGeometry(dragonCurve, 36, 1.55, 12, false)];
  const maneParts: THREE.BufferGeometry[] = [];
  // Sculpted horned Dragon Head & open jaws
  addBoxPart(dragonParts, 3.2, 2.4, 4.4, cx, baseY + 30.2, cz - 22.8, 0, -0.15, 0);
  addBoxPart(dragonParts, 2.4, 0.9, 3.6, cx, baseY + 28.4, cz - 22.0, 0, 0.25, 0);
  for (const s of [-1, 1]) {
    addCylPart(maneParts, 0.14, 0.26, 4.2, 6, cx + s * 1.1, baseY + 32.6, cz - 24.2, -0.45, s * 0.3);
    addCylPart(maneParts, 0.12, 0.22, 3.2, 6, cx + s * 1.5, baseY + 30.6, cz - 24.8, -0.8, s * 0.45);
  }
  const dragonMat = new THREE.MeshPhysicalMaterial({
    color: '#c8102e',
    roughness: 0.24,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15
  });
  dragonMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float scalePat = abs(sin(vDPos.x * 3.8 + vDPos.y * 2.2) * cos(vDPos.z * 3.8 - vDPos.y * 2.2));
         float goldRim = smoothstep(0.62, 0.86, scalePat);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.64, 0.23), goldRim * 0.72);`
      );
  };
  ctx.extraMaterials.push(dragonMat);

  const haloParts: THREE.BufferGeometry[] = [];
  for (const r of [14.0, 11.2, 8.6]) {
    const ring = new THREE.TorusGeometry(r, 0.35, 8, 48);
    ring.translate(cx, baseY + 22.0, cz - 42);
    haloParts.push(ring);
  }
  group.add(
    new THREE.Mesh(mergeNormalized(dragonParts), dragonMat),
    new THREE.Mesh(mergeNormalized(maneParts), ctx.materials.whitePlaster),
    new THREE.Mesh(mergeNormalized(haloParts), ctx.materials.gold)
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
  lacquerPeakMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float band = fract(vViewPosition.y * 0.28 + vViewPosition.x * 0.10);
       float goldLine = 1.0 - smoothstep(0.0, 0.07, abs(band - 0.5) - 0.43);
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

  // 3. 48 Floating Kinh Bắc Nón Quai Thao Lantern Hats with Curved Silk Chin-Slings
  const hatTop = new THREE.CylinderGeometry(0.62, 0.72, 0.14, 16);
  const hatCrown = new THREE.ConeGeometry(0.28, 0.18, 16);
  hatCrown.translate(0, 0.14, 0);
  const hatRim = new THREE.CylinderGeometry(0.72, 0.68, 0.16, 16, 1, true);
  hatRim.translate(0, -0.09, 0);
  const slingLoop = new THREE.TorusGeometry(0.46, 0.035, 6, 16, Math.PI);
  slingLoop.rotateZ(Math.PI);
  slingLoop.translate(0, -0.10, 0);
  const hatGeo = mergeNormalized([hatTop, hatCrown, hatRim, slingLoop]);
  const nonTime = { uTime: { value: 0 } };
  animList.push(nonTime);
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#f2d99b',
    emissive: new THREE.Color('#ff9d3b'),
    emissiveIntensity: 0.55,
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
}

function buildDongSonSunSanctuaryMacro(
  ctx: VietnamBuilderContext,
  dongSonTex: { map: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture }
): THREE.MeshStandardMaterial {
  const cx = -680;
  const cz = 420;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 150 });
  const group = new THREE.Group();
  group.name = 'DongSonSunSanctuaryMacro';
  const baseY = ctx.getHeight(cx, cz);

  // 1. Colossal Upright 22m Radiant Đông Sơn Bronze Drum Sun Monument
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
  ctx.extraMaterials.push(drumFaceMat);
  const giantDrum = new THREE.Mesh(new THREE.CylinderGeometry(11.0, 11.0, 1.2, 64), drumFaceMat);
  giantDrum.rotation.x = Math.PI * 0.5;
  giantDrum.position.set(cx, baseY + 12.2, cz - 46);
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(12.2, 0.65, 10, 64), ctx.materials.crimsonLacquer);
  haloRing.position.set(cx, baseY + 12.2, cz - 46);
  group.add(giantDrum, haloRing);

  // 2. Overarching 5-Tier Concentric Golden Canopy Rings (Ø 48m) + Central Bamboo Nơm Pyramid + 4 Thatch Pavilions
  const canopyParts: THREE.BufferGeometry[] = [];
  const woodParts: THREE.BufferGeometry[] = [];
  const thatchParts: THREE.BufferGeometry[] = [];
  for (let r = 0; r < 5; r++) {
    const rad = 12 + r * 4.5;
    const ring = new THREE.TorusGeometry(rad, 0.42, 8, 48);
    ring.rotateX(Math.PI * 0.5 + 0.12);
    ring.translate(cx, baseY + 17.5 + r * 1.4, cz - 6);
    canopyParts.push(ring);
  }
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    addCylPart(woodParts, 0.24, 0.30, 19.0, 8, cx + Math.cos(a) * 29, baseY + 9.5, cz - 6 + Math.sin(a) * 29);
  }
  // Central Woven Bamboo Pyramidal Nơm Frame
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.CylinderGeometry(0.06, 0.08, 6.4, 6);
    rib.translate(0, 3.2, 0);
    rib.rotateZ(0.62);
    rib.rotateY(a);
    rib.translate(cx, baseY + 0.4, cz - 4);
    canopyParts.push(rib);
  }
  for (let k = 1; k <= 3; k++) {
    const ring = new THREE.TorusGeometry(4.2 - k * 1.0, 0.07, 6, 16);
    ring.rotateX(Math.PI * 0.5);
    ring.translate(cx, baseY + k * 1.45, cz - 4);
    canopyParts.push(ring);
  }
  for (const [tx, tz] of [[-28, -28], [28, -28], [-34, 18], [34, 18]]) {
    const py = ctx.getHeight(cx + tx, cz + tz);
    addCylPart(woodParts, 0.14, 0.18, 3.8, 6, cx + tx, py + 1.9, cz + tz);
    const cone = new THREE.ConeGeometry(5.4, 2.8, 8);
    cone.translate(cx + tx, py + 4.8, cz + tz);
    thatchParts.push(cone);
  }
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#d99a3a',
    emissive: new THREE.Color('#ff8a2a'),
    emissiveIntensity: 0.35,
    roughness: 0.7
  });
  const thatchMat = new THREE.MeshStandardMaterial({ color: '#b98a4a', roughness: 0.88, side: THREE.DoubleSide });
  ctx.extraMaterials.push(ringMat, thatchMat);
  group.add(
    new THREE.Mesh(mergeNormalized(canopyParts), ringMat),
    new THREE.Mesh(mergeNormalized(woodParts), ctx.materials.darkWood),
    new THREE.Mesh(mergeNormalized(thatchParts), thatchMat)
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
  return drumFaceMat;
}

function buildTayNguyenBrocadeSanctuaryMacro(
  ctx: VietnamBuilderContext,
  brocTex: THREE.DataTexture
): void {
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

  // 2. Central Tilted Giant 14m Conical Nón Lá Dome + Open Bamboo Truss + 3 Floral Brocade Discs + Cột Nêu
  const nonMat = new THREE.MeshStandardMaterial({
    color: '#d8c9a0',
    emissive: new THREE.Color('#a4221b'),
    emissiveIntensity: 0.32,
    side: THREE.DoubleSide
  });
  const rosetteMat = new THREE.MeshStandardMaterial({
    color: '#9b30ff',
    emissive: new THREE.Color('#5b2a86'),
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(nonMat, rosetteMat);
  const giantNon = new THREE.Mesh(new THREE.ConeGeometry(7.0, 3.2, 32, 1, true), nonMat);
  giantNon.position.set(cx, baseY + 13.8, cz - 14);
  giantNon.rotation.set(0.42, 0.2, 0.14);
  const truss = new THREE.Mesh(createNonLaLatticeGeometry(4.8, 2.8, 16, 4), ctx.materials.gold);
  truss.position.set(cx, baseY + 17.5, cz - 14);

  const rosetteParts: THREE.BufferGeometry[] = [];
  for (const [ox, oz, rad] of [[-12, -26, 3.6], [0, -28, 4.4], [12, -26, 3.6]]) {
    const disc = new THREE.CircleGeometry(rad, 24);
    disc.translate(cx + ox, baseY + 6.5, cz + oz);
    rosetteParts.push(disc);
  }
  const archBackdrop = new THREE.Mesh(new THREE.TorusGeometry(13.0, 0.9, 8, 32, Math.PI), ctx.materials.crimsonLacquer);
  archBackdrop.position.set(cx, baseY + 1.0, cz - 24);
  const cotNeu = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 15.0, 10), ctx.materials.darkWood);
  cotNeu.position.set(cx + 22, baseY + 7.5, cz + 4);

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
    new THREE.Mesh(mergeNormalized(rosetteParts), rosetteMat),
    archBackdrop,
    cotNeu,
    tvInst
  );
  ctx.scene.add(group);
}

function buildDatNuocAndMemoryMacro(
  ctx: VietnamBuilderContext,
  dongSonTex: { map: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture },
  filmTex: THREE.DataTexture
): THREE.MeshStandardMaterial {
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

  // Embedded Central Đông Sơn Drum Medallion + Sculpted Dragon & Lạc Bird Wings + Leader Statue Pedestal
  const emblemParts: THREE.BufferGeometry[] = [];
  const drum = new THREE.CylinderGeometry(2.7, 2.9, 0.6, 32);
  drum.rotateX(Math.PI * 0.5);
  drum.translate(cx, floorY + 9.5, cz - 44.5);
  emblemParts.push(drum);
  addBoxPart(emblemParts, 4.4, 11.5, 2.6, cx + 44, floorY + 5.75, cz - 35); // right pedestal statue block
  const drumMat = new THREE.MeshStandardMaterial({
    map: dongSonTex.map,
    normalMap: dongSonTex.normalMap,
    emissive: new THREE.Color('#ff8a3a'),
    emissiveIntensity: 0.4,
    roughness: 0.4,
    metalness: 0.75
  });
  ctx.extraMaterials.push(drumMat);

  // Suspended 9.6m Bronze Nón Lá Lattice Crown + 6 Incense Braziers
  const nonCrown = new THREE.Mesh(createNonLaLatticeGeometry(4.8, 2.4, 16, 6), ctx.materials.gold);
  nonCrown.position.set(cx, floorY + 23.0, cz - 40);
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
    new THREE.Mesh(mergeNormalized(emblemParts), drumMat),
    nonCrown,
    new THREE.Mesh(mergeNormalized(brazierParts), ctx.materials.bronze),
    new THREE.Mesh(mergeNormalized(emberParts), emberMat)
  );
  ctx.scene.add(cGroup);

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
    roughness: 0.35
  });
  const solarMat = new THREE.MeshStandardMaterial({
    color: '#e85a24',
    emissive: new THREE.Color('#ff6a2b'),
    emissiveIntensity: 1.5
  });
  ctx.extraMaterials.push(filmMat, solarMat);

  const steleFrame = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 11.5, 0.28), ctx.materials.darkWood, 16);
  const stelePanel = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.1, 11.0), filmMat, 16);
  for (let i = 0; i < 16; i++) {
    const side = i < 8 ? -1 : 1;
    const rank = i % 8;
    const sx = side * (24 + (rank % 3) * 14);
    const sz = -282 - rank * 7.2;
    const sy = Math.max(ctx.getHeight(sx, sz), 1.4);
    const yaw = side * -0.22;
    const hScale = 0.85 + (rank % 3) * 0.16;
    setInstanceMatrix(steleFrame, i, sx, sy + 5.75 * hScale, sz, 0, yaw, 0, 1, hScale, 1);
    setInstanceMatrix(stelePanel, i, sx + Math.sin(yaw) * 0.16, sy + 5.75 * hScale, sz + Math.cos(yaw) * 0.16, 0, yaw, 0, 1, hScale, 1);
  }
  steleFrame.instanceMatrix.needsUpdate = true;
  stelePanel.instanceMatrix.needsUpdate = true;

  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32), solarMat);
  sunDisc.position.set(0, 8.6, -338);
  const memCrown = new THREE.Mesh(createNonLaLatticeGeometry(3.2, 1.6, 16, 5), ctx.materials.gold);
  memCrown.position.set(0, 14.5, -315);

  mGroup.add(steleFrame, stelePanel, sunDisc, memCrown);
  ctx.scene.add(mGroup);
  return filmMat;
}

function buildTruongSonMonsoonGorgeMacro(ctx: VietnamBuilderContext): void {
  const cx = 740;
  const cz = -560;
  ctx.exclusionCircles.push({ x: cx, z: cz, r: 165 });
  const group = new THREE.Group();
  group.name = 'TruongSonMonsoonJungleGorge';

  // 1. 14 Towering Wet Limestone Gorge Cliffs & Stepped Waterfall Ledges
  const rockParts: THREE.BufferGeometry[] = [];
  const waterParts: THREE.BufferGeometry[] = [];
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
  for (let w = 0; w < 4; w++) {
    addBoxPart(waterParts, 8.5, 22.0, 0.35, cx - 18 + w * 12, 13.0, cz - 78, 0, 0.28, 0);
  }
  const wetKarstMat = new THREE.MeshStandardMaterial({
    color: '#2c3a3f',
    map: ctx.pbr.granite.map,
    normalMap: ctx.pbr.granite.normalMap,
    roughness: 0.28
  });
  const cascadeMat = new THREE.MeshStandardMaterial({
    color: '#dce6ee',
    emissive: new THREE.Color('#6a98b8'),
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.78,
    roughness: 0.14
  });
  ctx.extraMaterials.push(wetKarstMat, cascadeMat);

  // 2. 96 Wet Jungle Palms & Ferns + 28 Mist Ribbons + 6 Storm Light Shafts
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
  const mistMat = new THREE.MeshBasicMaterial({ color: '#dce6ee', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#a8c8ff', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
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
    palmInst,
    mistInst,
    shaftInst
  );
  ctx.scene.add(group);
}

function buildDienBienAndBachDangMacros(ctx: VietnamBuilderContext): THREE.MeshStandardMaterial {
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

  // M14.1 Hầm Chỉ Huy De Castries (Corrugated Steel Vault & Sandbag Reinforcements)
  const bunkerX = dbx - 6;
  const bunkerZ = dbz - 2;
  const bunkerY = ctx.getHeight(bunkerX, bunkerZ);
  const archVault = new THREE.CylinderGeometry(3.6, 3.6, 9.2, 18, 1, false, 0, Math.PI);
  archVault.rotateZ(Math.PI * 0.5);
  archVault.translate(bunkerX, bunkerY + 1.6, bunkerZ);
  metalParts.push(archVault);
  addBoxPart(timberParts, 2.6, 2.8, 0.45, bunkerX, bunkerY + 1.4, bunkerZ + 4.8);
  addBoxPart(timberParts, 0.4, 2.8, 3.2, bunkerX - 1.5, bunkerY + 1.4, bunkerZ + 6.2);
  addBoxPart(stoneParts, 8.4, 1.2, 10.4, bunkerX, bunkerY + 3.4, bunkerZ);

  // M14.2 Hố Bộc Phá Nghìn Cân Đồi A1 (A1 Sapper Blast Crater)
  const craterX = dbx + 22;
  const craterZ = dbz + 16;
  const craterY = ctx.getHeight(craterX, craterZ);
  const craterGeo = new THREE.ConeGeometry(9.2, 4.2, 18, 1, true);
  craterGeo.rotateX(Math.PI);
  craterGeo.translate(craterX, craterY - 1.8, craterZ);
  craterParts.push(craterGeo);
  const rimTorus = new THREE.TorusGeometry(9.4, 1.2, 8, 20);
  rimTorus.rotateX(Math.PI * 0.5);
  rimTorus.translate(craterX, craterY + 0.45, craterZ);
  craterParts.push(rimTorus);
  for (let tb = 0; tb < 12; tb++) {
    const tang = (tb / 12) * Math.PI * 2;
    const trad = 8.5 + (tb % 3) * 1.8;
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

  // M14.3 Xác Xe Tăng Bazeille Đồi A1 (French M24 Chaffee Tank Hull & Turret)
  const tankX = dbx - 18;
  const tankZ = dbz + 20;
  const tankY = ctx.getHeight(tankX, tankZ);
  addBoxPart(tankParts, 3.4, 1.45, 6.2, tankX, tankY + 1.15, tankZ, 0, -0.4, 0);
  for (const ts of [-1.85, 1.85]) {
    addBoxPart(
      metalParts,
      0.65,
      1.1,
      6.4,
      tankX + ts * Math.cos(-0.4),
      tankY + 0.65,
      tankZ - ts * Math.sin(-0.4),
      0,
      -0.4,
      0
    );
  }
  addCylPart(tankParts, 1.4, 1.6, 1.15, 10, tankX, tankY + 2.35, tankZ);
  const gunBarrel = new THREE.CylinderGeometry(0.10, 0.12, 4.2, 8);
  gunBarrel.rotateZ(Math.PI * 0.5);
  gunBarrel.rotateY(-0.4);
  gunBarrel.translate(tankX - 1.8, tankY + 2.5, tankZ + 1.2);
  metalParts.push(gunBarrel);
  addCylPart(tankParts, 0.45, 0.5, 0.45, 8, tankX + 0.35, tankY + 3.1, tankZ - 0.25);

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

  // --- M15: BachDangGrandArmadaMacro (-240, -760) ---
  const bdx = -240;
  const bdz = -760;
  const bdGroup = new THREE.Group();
  bdGroup.name = 'BachDangGrandArmadaMacro';

  const royalSailTex = createRedEmblemSailTexture(256, ctx.renderer);
  ctx.extraTextures.push(royalSailTex);
  const royalSailMat = new THREE.MeshStandardMaterial({
    map: royalSailTex,
    roughness: 0.78,
    side: THREE.DoubleSide
  });
  const mistAlphaSize = 64;
  const mistAlphaData = new Uint8Array(mistAlphaSize * mistAlphaSize * 4);
  for (let py = 0; py < mistAlphaSize; py++) {
    const ny = (py / (mistAlphaSize - 1)) * 2 - 1;
    for (let px = 0; px < mistAlphaSize; px++) {
      const nx = (px / (mistAlphaSize - 1)) * 2 - 1;
      const fx = Math.max(0, 1 - nx * nx);
      const fy = Math.max(0, 1 - ny * ny);
      const val = Math.round(fx * fx * fy * fy * 255);
      const idx = (py * mistAlphaSize + px) * 4;
      mistAlphaData[idx] = val;
      mistAlphaData[idx + 1] = val;
      mistAlphaData[idx + 2] = val;
      mistAlphaData[idx + 3] = 255;
    }
  }
  const mistAlphaTex = new THREE.DataTexture(mistAlphaData, mistAlphaSize, mistAlphaSize, THREE.RGBAFormat);
  mistAlphaTex.needsUpdate = true;
  ctx.extraTextures.push(mistAlphaTex);
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#dce6ee',
    alphaMap: mistAlphaTex,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ctx.extraMaterials.push(royalSailMat, mistMat);

  // 11-Ship Armada (1 Hero 32m Flagship + 2 Twin-Beacon Fire Junks + 8 Staggered Escorts)
  const fleetDefs: Array<[number, number, number, boolean]> = [
    [0, 5, 1.45, false],
    [-68, -22, 1.05, true], [68, -20, 1.05, true],
    [-118, -46, 0.90, false], [118, -42, 0.90, false],
    [-48, -68, 0.85, false], [52, -70, 0.85, false],
    [-148, -76, 0.78, false], [146, -74, 0.78, false],
    [-92, -96, 0.72, false], [94, -95, 0.72, false]
  ];
  for (let s = 0; s < fleetDefs.length; s++) {
    const [ox, oz, scale, twinFire] = fleetDefs[s];
    const ship = new THREE.Group();
    ship.add(new THREE.Mesh(createWarJunkHullGeometry(scale), ctx.materials.darkWood));

    const sailGeo = new THREE.PlaneGeometry(9.6 * scale, 12.8 * scale, 6, 6);
    const sp = sailGeo.attributes.position;
    for (let v = 0; v < sp.count; v++) {
      const u = sp.getX(v) / (9.6 * scale) + 0.5;
      const w = sp.getY(v) / (12.8 * scale) + 0.5;
      sp.setZ(v, Math.sin(u * Math.PI) * Math.sin(w * Math.PI) * 0.9 * scale);
    }
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, royalSailMat);
    sail.position.set(1.2 * scale, 9.0 * scale, 0.35);
    sail.rotation.y = Math.PI * 0.5;
    ship.add(sail);

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
  return flareMat;
}

// ---------------------------------------------------------------------------
// Unified Entrypoint
// ---------------------------------------------------------------------------

export function buildVietnamReferenceShowUpgrades(
  ctx: VietnamBuilderContext
): VietnamReferenceShowController {
  const animList: Array<{ uTime: { value: number } }> = [];

  const trangAnLampMat = buildTrangAnGoldenRiceKarst(ctx, animList);
  const hoiAnHandles = buildHoiAnLanternUpgrades(ctx, animList);
  const courtHandles = buildImperialCourtAndLotus(ctx);
  const banyanGlowMat = buildNorthernBanyanVillage(ctx);
  const festHandles = buildFestivalArtAndBrocade(ctx, animList);
  buildDongSonReplicaAndMekongGarden(ctx);
  const filmMat = buildHeroicReliefAndMemoryGallery(ctx);
  const atmoHandles = buildAtmosphereEffects(ctx, animList);
  const flareMat = buildDienBienAndBachDang(ctx);

  // Outer Macro Cultural Sanctuary Ring (v2.0 4800m × 4800m expansion)
  const sharedDongSonTex = createDongSonBronzeTextures(512, ctx.renderer);
  const sharedBrocTex = createBrocadeTexture(ctx.renderer);
  const sharedFilmTex = createFilmstripArchivalTexture(ctx.renderer);
  ctx.extraTextures.push(sharedDongSonTex.map, sharedDongSonTex.normalMap, sharedDongSonTex.roughnessMap, sharedBrocTex, sharedFilmTex);

  const macroTamCocLampMat = buildTamCocMacroValley(ctx, animList);
  const macroHoiAnHandles = buildHoiAnMacroDistricts(ctx, animList);
  const macroHuePalaceMat = buildHueGrandImperialPalaceMacro(ctx);
  const macroDaiSenMat = buildDaiLienHoaLotusSanctuaryMacro(ctx);
  const macroVillageDoorMat = buildDuongLamVillageMacro(ctx);
  buildLongVanLacquerValleyMacro(ctx, animList);
  const macroDongSonMat = buildDongSonSunSanctuaryMacro(ctx, sharedDongSonTex);
  buildTayNguyenBrocadeSanctuaryMacro(ctx, sharedBrocTex);
  const macroFilmMat = buildDatNuocAndMemoryMacro(ctx, sharedDongSonTex, sharedFilmTex);
  buildTruongSonMonsoonGorgeMacro(ctx);
  const macroFlareMat = buildDienBienAndBachDangMacros(ctx);

  return {
    update: (elapsedTime: number, cameraPos?: THREE.Vector3) => {
      for (const a of animList) {
        a.uTime.value = elapsedTime;
      }
      if (cameraPos) {
        atmoHandles.rainMat.uniforms.uCamPos.value.copy(cameraPos);
      }
      festHandles.fireShowMesh.scale.y = 0.85 + Math.sin(elapsedTime * 7.5) * 0.25;
    },
    setAtmosphere: ({ timeOfDay, weather, nightAmount, duskAmount }) => {
      const isTrueNight = timeOfDay >= 19.0 || timeOfDay < 5.0 || nightAmount > 0.68;
      const isRain = weather === 'rain';
      const darkNight = clamp01((nightAmount - 0.60) / 0.40);
      const glow = 0.15 + duskAmount * 1.1 + darkNight * 2.7;

      for (const m of hoiAnHandles.silkGlowMats) m.emissiveIntensity = glow;
      macroHoiAnHandles.silkMat.emissiveIntensity = glow;
      hoiAnHandles.skyMat.emissiveIntensity = 0.25 + duskAmount * 1.0 + darkNight * 2.2;
      macroHoiAnHandles.skyMat.emissiveIntensity = hoiAnHandles.skyMat.emissiveIntensity;
      hoiAnHandles.flowerMat.emissiveIntensity = 0.25 + duskAmount * 1.1 + darkNight * 2.4;
      macroHoiAnHandles.flowerMat.emissiveIntensity = hoiAnHandles.flowerMat.emissiveIntensity;
      courtHandles.palaceLanternMat.emissiveIntensity = 0.2 + duskAmount * 0.9 + darkNight * 2.5;
      macroHuePalaceMat.emissiveIntensity = courtHandles.palaceLanternMat.emissiveIntensity;
      courtHandles.daiSenMat.emissiveIntensity = 0.2 + duskAmount * 0.8 + darkNight * 2.1;
      macroDaiSenMat.emissiveIntensity = courtHandles.daiSenMat.emissiveIntensity;
      banyanGlowMat.emissiveIntensity = 0.2 + duskAmount * 0.8 + darkNight * 1.9;
      macroVillageDoorMat.emissiveIntensity = banyanGlowMat.emissiveIntensity;
      trangAnLampMat.emissiveIntensity = 0.4 + duskAmount * 1.4 + darkNight * 2.0;
      macroTamCocLampMat.emissiveIntensity = trangAnLampMat.emissiveIntensity;
      macroDongSonMat.emissiveIntensity = 0.35 + duskAmount * 0.8 + darkNight * 1.1;
      filmMat.emissiveIntensity = 0.35 + duskAmount * 1.1 + darkNight * 1.5;
      macroFilmMat.emissiveIntensity = filmMat.emissiveIntensity;
      flareMat.emissiveIntensity = 0.6 + darkNight * 2.2;
      macroFlareMat.emissiveIntensity = flareMat.emissiveIntensity;

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
