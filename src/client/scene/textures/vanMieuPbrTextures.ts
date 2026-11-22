import * as THREE from 'three';

/**
 * Museum-Grade Procedural PBR & Calligraphic Texture Pack for
 * Văn Miếu — Quốc Tử Giám (Hà Nội):
 *   1. Khuê Văn Các 4 lime-plaster piers with recessed scalloped *lá đề* & *Tứ Quý* cloud-dragon relief (`KVC-02`, `KVC-05`)
 *   2. Weathered flaking Vietnamese cinnabar-vermilion lacquer timber (`KVC-15`)
 *   3. 6-bay carved under-balcony cloud-dragon frieze (`KVC-10`)
 *   4. Mottled aged *ngói ống / ngói mũi hài* terracotta roof tiles with moss valleys (`KVC-22`)
 *   5. Mottled centuries-old Hanoi exposed brick with lime mortar & damp moss (`KVC-28`, `GTQ-19`, `BTS-26`)
 *   6. Weathered Hanoi pale-grey lime stucco with vertical rain streaks (`KVC-05`, `GTQ-11`)
 *   7. Warm burnt-terracotta *ngói chiếu* underside ceiling tiles (`BTS-21`, `DDT-28`)
 *   8. Pale sun-bleached dusty terracotta-rose `33cm` Bát Tràng floor tiles (`BTS-24`, `DDT-29`)
 *   9. 1024×1536 Carved Thanh Hóa Limestone Doctors' Stele Atlas (`Lưỡng Long Chầu Nhật` + `ngạch bia` + `diềm bia` + Hán-Nôm roster + Sobel normal — `BTS-05..09`)
 *  10. 1024×1024 Carved Stone Tortoise Carapace (`Mai Rùa Lục Giác` nested triple-ring hexagons + Sobel normal — `BTS-12`)
 *  11. Deep lustrous Điện Đại Thành *sơn son* vermilion lacquer (`fog: false`, `DDT-29`)
 *  12. Burnished 24K carved dragon-cloud temple gold leaf (`fog: false`, `DDT-03`, `DDT-14`, `DDT-29`)
 *  13. 512×512 Đức Thánh Khổng Tử Hero Atlas (ivory-gilt painted serene face + vermilion imperial robe with 24K *bổ tử* dragon brocade — `DDT-08..11`)
 *  14. 1024×1024 Packed Classical Hanzi Calligraphy & Sanctuary Ornament Atlas (12 plaques/couplets/nameplates in 1 draw material! — `KVC-17`, `KVC-18`, `KVC-31`, `DDT-19`, `DDT-24`, `DDT-25`, `DDT-31`)
 *
 * Strictly budgeted at 14 shared materials total (replacing 8+ legacy untextured/signage materials)
 * so global `uniqueMaterials <= 250` passes with comfortable margin.
 */

export interface VanMieuMaterialPack {
  kvcWeatheredCrimsonMat: THREE.MeshStandardMaterial;
  kvcAgedTerracottaMat: THREE.MeshStandardMaterial;
  vanMieuReliefAtlasMat: THREE.MeshStandardMaterial;
  vanMieuCalligraphyMat: THREE.MeshStandardMaterial;
  sanctuaryCrimsonLacquerMat: THREE.MeshStandardMaterial;
  sanctuaryCarvedGoldMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const VAN_MIEU_RELIEF_UV = {
  doctorsStele: [0.0, 0.25, 0.5, 1.0],
  tortoiseCarapace: [0.5, 0.5, 1.0, 1.0],
  kvcPierRelief: [0.5, 0.0, 0.75, 0.5],
  ngoiChieu: [0.75, 0.25, 1.0, 0.5],
  kvcCarvedFrieze: [0.0, 0.125, 0.5, 0.25]
} as const;

export type VanMieuReliefKey = keyof typeof VAN_MIEU_RELIEF_UV;

function isHeadlessRenderer(renderer?: THREE.WebGLRenderer): boolean {
  if (typeof document === 'undefined') return true;
  if (!renderer) return false;
  const dom = (renderer as unknown as { domElement?: HTMLCanvasElement }).domElement;
  return !dom || dom.width === 0;
}

function getAniso(renderer?: THREE.WebGLRenderer): number {
  const maxA = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  return Math.max(1, Math.min(8, maxA));
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function hash2i(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function tileNoise(u: number, v: number, px: number, py: number, seed: number): number {
  const fx = ((u % 1) + 1) % 1 * px;
  const fy = ((v % 1) + 1) % 1 * py;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const x0 = ((ix % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const y0 = ((iy % py) + py) % py;
  const y1 = (y0 + 1) % py;
  const a = hash2i(x0, y0, seed);
  const b = hash2i(x1, y0, seed);
  const c = hash2i(x0, y1, seed);
  const d = hash2i(x1, y1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function tileFbm(u: number, v: number, px: number, py: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += tileNoise(u, v, px << o, py << o, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / Math.max(1e-5, norm);
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

function finalizeDataTex(
  data: Uint8Array,
  w: number,
  h: number,
  isColor: boolean,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer,
  wrapMode: THREE.Wrapping = THREE.RepeatWrapping
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = wrapMode;
  tex.wrapT = wrapMode;
  if (rx !== 1 || ry !== 1) tex.repeat.set(rx, ry);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = getAniso(renderer);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function wrapCanvasTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer,
  wrapMode: THREE.Wrapping = THREE.RepeatWrapping
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = wrapMode;
  tex.wrapT = wrapMode;
  if (rx !== 1 || ry !== 1) tex.repeat.set(rx, ry);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = getAniso(renderer);
  tex.needsUpdate = true;
  return tex;
}

function canvasToSobelNormal(
  canvas: HTMLCanvasElement,
  strength: number,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer,
  tileWrap = true
): THREE.DataTexture {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, rx, ry, renderer);
  }
  const src = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    lum[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
  }
  const normalData = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number): number => {
    const wx = tileWrap ? ((x % w) + w) % w : Math.max(0, Math.min(w - 1, x));
    const wy = tileWrap ? ((y % h) + h) % h : Math.max(0, Math.min(h - 1, y));
    return lum[wy * w + wx];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);
      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      normalData[o] = clampByte((nx * 0.5 + 0.5) * 255);
      normalData[o + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normalData[o + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normalData[o + 3] = 255;
    }
  }
  return finalizeDataTex(
    normalData,
    w,
    h,
    false,
    rx,
    ry,
    renderer,
    tileWrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  );
}

function buildSobelPbrFromArrays(
  albedo: Uint8Array,
  height: Float32Array,
  rough: Float32Array,
  w: number,
  h: number,
  strength: number,
  rx: number,
  ry: number,
  renderer?: THREE.WebGLRenderer,
  tileWrap = true
): { map: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture } {
  const normalData = new Uint8Array(w * h * 4);
  const roughData = new Uint8Array(w * h * 4);
  const sampleH = (x: number, y: number): number => {
    const wx = tileWrap ? ((x % w) + w) % w : Math.max(0, Math.min(w - 1, x));
    const wy = tileWrap ? ((y % h) + h) % h : Math.max(0, Math.min(h - 1, y));
    return height[wy * w + wx];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);
      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      normalData[o] = clampByte((nx * 0.5 + 0.5) * 255);
      normalData[o + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normalData[o + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normalData[o + 3] = 255;
      const rb = clampByte(rough[i] * 255);
      roughData[o] = rb;
      roughData[o + 1] = rb;
      roughData[o + 2] = rb;
      roughData[o + 3] = 255;
    }
  }
  const wrap = tileWrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return {
    map: finalizeDataTex(albedo, w, h, true, rx, ry, renderer, wrap),
    normalMap: finalizeDataTex(normalData, w, h, false, rx, ry, renderer, wrap),
    roughnessMap: finalizeDataTex(roughData, w, h, false, rx, ry, renderer, wrap)
  };
}

/**
 * Helper: Draws sinuous sculpted Vietnamese cloud-dragon scroll motif (`rồng mây / hoa dây`)
 * onto both color & relief height canvases!
 */
function drawReliefCloudScroll(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  fill: string,
  stroke: string,
  lineW: number,
  flip = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flip, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-26, 8);
  ctx.bezierCurveTo(-42, 10, -48, -8, -30, -14);
  ctx.bezierCurveTo(-18, -18, -14, -4, -6, -6);
  ctx.bezierCurveTo(-2, -22, 18, -24, 24, -10);
  ctx.bezierCurveTo(38, -10, 42, 6, 26, 12);
  ctx.bezierCurveTo(14, 16, 4, 8, -4, 10);
  ctx.bezierCurveTo(-14, 14, -20, 12, -26, 8);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(4, -4, 6, 0.3, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-18, -2, 5, Math.PI * 0.4, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

/**
 * 1. Khuê Văn Các Pier Stucco Relief (`512×1024`) — KVC-02 & KVC-05
 *    Cool weathered Hanoi lime plaster (#cfd2cd), scalloped *lá đề* recessed panel frame,
 *    layered *sóng nước* bottom waves, high-relief sinuous cloud-dragon / *Tứ Quý* scrollwork & bottom damp moss!
 */
function createKvcPierReliefCanvases(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 64 : 512;
  const h = headless ? 128 : 1024;
  const cObj = makeCanvas(w, h);
  const hObj = makeCanvas(w, h);
  if (!cObj || !hObj) return null;
  const S = w / 512;
  const c = cObj.ctx;
  const ht = hObj.ctx;

  // Base cool weathered Hanoi lime plaster (#cfd2cd) with subtle rain streaks
  c.fillStyle = '#cfd2cd';
  c.fillRect(0, 0, w, h);
  ht.fillStyle = '#888888';
  ht.fillRect(0, 0, w, h);

  // Recessed vertical panel interior with scalloped *lá đề* notched corners
  const padX = 56 * S;
  const padY = 64 * S;
  const pw = w - padX * 2;
  const ph = h - padY * 2;
  const notch = 34 * S;
  const traceNotchedPanel = (ctx: CanvasRenderingContext2D, inset: number) => {
    const x0 = padX + inset;
    const y0 = padY + inset;
    const x1 = w - padX - inset;
    const y1 = h - padY - inset;
    const n = Math.max(8 * S, notch - inset * 0.4);
    ctx.beginPath();
    ctx.moveTo(x0 + n, y0);
    ctx.lineTo(x1 - n, y0);
    ctx.quadraticCurveTo(x1 - n, y0 + n, x1, y0 + n);
    ctx.lineTo(x1, y1 - n);
    ctx.quadraticCurveTo(x1 - n, y1 - n, x1 - n, y1);
    ctx.lineTo(x0 + n, y1);
    ctx.quadraticCurveTo(x0 + n, y1 - n, x0, y1 - n);
    ctx.lineTo(x0, y0 + n);
    ctx.quadraticCurveTo(x0 + n, y0 + n, x0 + n, y0);
    ctx.closePath();
  };

  for (const [ctx, isH] of [
    [c, false],
    [ht, true]
  ] as const) {
    traceNotchedPanel(ctx, 0);
    ctx.fillStyle = isH ? '#525252' : '#b2b6af';
    ctx.fill();
    ctx.strokeStyle = isH ? '#e6e6e6' : '#dfe2dc';
    ctx.lineWidth = 10 * S;
    ctx.stroke();

    traceNotchedPanel(ctx, 14 * S);
    ctx.strokeStyle = isH ? '#363636' : '#8b9087';
    ctx.lineWidth = 4 * S;
    ctx.stroke();

    // Bottom 15% layered *sóng nước* water waves
    for (let row = 0; row < 4; row++) {
      const wy = h - padY - (28 + row * 28) * S;
      for (let col = 0; col < 5; col++) {
        const wx = padX + (44 + col * 78 + (row % 2) * 32) * S;
        ctx.fillStyle = isH ? '#c6c6c6' : '#cfd3cc';
        ctx.strokeStyle = isH ? '#444444' : '#7b8078';
        ctx.lineWidth = 3.5 * S;
        ctx.beginPath();
        ctx.arc(wx, wy, 36 * S, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(wx, wy, 22 * S, Math.PI, 0);
        ctx.stroke();
      }
    }

    // Sinuous ascending *Rồng Mây / Tứ Quý* carved stucco S-curve spine + billowing cloud scrolls
    ctx.strokeStyle = isH ? '#d8d8d8' : '#d7dad4';
    ctx.lineWidth = 34 * S;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const sx = w * 0.5 + Math.sin(t * Math.PI * 3.2) * 92 * S;
      const sy = lerp(h - padY - 145 * S, padY + 95 * S, t);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.strokeStyle = isH ? '#3c3c3c' : '#868a82';
    ctx.lineWidth = 4.5 * S;
    ctx.stroke();

    // Sculpted flanking cloud-scroll & chrysanthemum medallions filling the vertical relief
    for (let k = 0; k < 7; k++) {
      const cy = lerp(h - padY - 170 * S, padY + 110 * S, k / 6);
      const side = k % 2 === 0 ? -1 : 1;
      drawReliefCloudScroll(
        ctx,
        w * 0.5 + side * 66 * S,
        cy,
        1.75 * S,
        isH ? '#dcdcdc' : '#d6d9d2',
        isH ? '#3a3a3a' : '#7f847b',
        3.2 * S,
        side
      );
      drawReliefCloudScroll(
        ctx,
        w * 0.5 - side * 58 * S,
        cy - 24 * S,
        1.25 * S,
        isH ? '#cccccc' : '#cdd1ca',
        isH ? '#424242' : '#868b82',
        2.6 * S,
        -side
      );
    }
  }

  // Authentic Hanoi weathering: rainwater drip streaks from top + damp olive-moss staining at bottom 16%
  for (let i = 0; i < 42; i++) {
    const rx = hash2i(i, 1, 9101) * w;
    const rw = (3 + hash2i(i, 2, 9101) * 14) * S;
    const rh = (140 + hash2i(i, 3, 9101) * 420) * S;
    const g = c.createLinearGradient(rx, 0, rx, rh);
    g.addColorStop(0, 'rgba(84, 90, 78, 0.24)');
    g.addColorStop(1, 'rgba(84, 90, 78, 0.0)');
    c.fillStyle = g;
    c.fillRect(rx, 0, rw, rh);
  }
  const dampGrad = c.createLinearGradient(0, h * 0.80, 0, h);
  dampGrad.addColorStop(0, 'rgba(72, 82, 62, 0.0)');
  dampGrad.addColorStop(0.65, 'rgba(66, 76, 56, 0.34)');
  dampGrad.addColorStop(1, 'rgba(54, 62, 46, 0.62)');
  c.fillStyle = dampGrad;
  c.fillRect(0, h * 0.80, w, h * 0.20);

  return { canvas: cObj.canvas, heightCanvas: hObj.canvas };
}

/**
 * 2. Weathered Flaking Vietnamese Cinnabar-Vermilion Lacquer Timber (`512×512`) — KVC-15
 */
function createKvcWeatheredCrimsonTextures(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 512;
  const albedo = new Uint8Array(sz * sz * 4);
  const height = new Float32Array(sz * sz);
  const rough = new Float32Array(sz * sz);
  const seed = 4419;
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    for (let x = 0; x < sz; x++) {
      const u = x / sz;
      const grain = tileFbm(u, v, 36, 4, 3, seed);
      const peelMask = smoothstep(0.58, 0.78, tileFbm(u, v, 14, 3, 3, seed + 51));
      const plankJoint = smoothstep(0.0, 0.03, Math.min((u * 6) % 1, 1 - ((u * 6) % 1)));
      // Vibrant aged cinnabar lacquer (#a42c24) flaking to sun-bleached bare ironwood (#a5907f)
      const lacR = lerp(134, 178, grain);
      const lacG = lerp(30, 50, grain);
      const lacB = lerp(24, 40, grain);
      const bareR = lerp(142, 176, grain);
      const bareG = lerp(124, 154, grain);
      const bareB = lerp(108, 134, grain);
      const r = lerp(lacR, bareR, peelMask * 0.72) * lerp(0.55, 1.0, plankJoint);
      const g = lerp(lacG, bareG, peelMask * 0.72) * lerp(0.55, 1.0, plankJoint);
      const b = lerp(lacB, bareB, peelMask * 0.72) * lerp(0.55, 1.0, plankJoint);
      const i = y * sz + x;
      const o = i * 4;
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(0.55 + (grain - 0.5) * 0.25 - peelMask * 0.22 - (1 - plankJoint) * 0.35);
      rough[i] = clamp01(lerp(0.58, 0.86, peelMask) + (grain - 0.5) * 0.08);
    }
  }
  return buildSobelPbrFromArrays(albedo, height, rough, sz, sz, 1.8, 1, 1, renderer, true);
}

/**
 * 3. 6-Bay Carved Under-Balcony Frieze (`1024×128`, `Yếm chạm rồng mây`) — KVC-10
 */
function createKvcCarvedFriezeCanvases(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 1024;
  const h = headless ? 32 : 256;
  const cObj = makeCanvas(w, h);
  const hObj = makeCanvas(w, h);
  if (!cObj || !hObj) return null;
  const S = h / 128;
  const bays = 6;
  const bw = w / bays;
  for (const [ctx, isH] of [
    [cObj.ctx, false],
    [hObj.ctx, true]
  ] as const) {
    ctx.fillStyle = isH ? '#3a3a3a' : '#74221c';
    ctx.fillRect(0, 0, w, h);
    // Molded top & bottom weathered ledges
    ctx.fillStyle = isH ? '#d6d6d6' : '#a8968a';
    ctx.fillRect(0, 0, w, 12 * S);
    ctx.fillRect(0, h - 12 * S, w, 12 * S);

    for (let b = 0; b < bays; b++) {
      const bx = b * bw;
      ctx.strokeStyle = isH ? '#e0e0e0' : '#b2a296';
      ctx.lineWidth = 6 * S;
      ctx.strokeRect(bx + 8 * S, 18 * S, bw - 16 * S, h - 36 * S);
      // Swirling carved cloud-dragon relief inside each bay
      drawReliefCloudScroll(
        ctx,
        bx + bw * 0.30,
        h * 0.5,
        1.15 * S,
        isH ? '#dcdcdc' : '#b6a498',
        isH ? '#282828' : '#5c1813',
        2.5 * S,
        1
      );
      drawReliefCloudScroll(
        ctx,
        bx + bw * 0.70,
        h * 0.5,
        1.15 * S,
        isH ? '#dcdcdc' : '#b6a498',
        isH ? '#282828' : '#5c1813',
        2.5 * S,
        -1
      );
    }
  }
  return { canvas: cObj.canvas, heightCanvas: hObj.canvas };
}

/**
 * 4. Aged Mottled *Ngói Ống / Ngói Mũi Hài* Terracotta Tiles with Dark Olive Moss Valleys (`512×512`) — KVC-22
 */
function createKvcAgedTerracottaTextures(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 512;
  const albedo = new Uint8Array(sz * sz * 4);
  const height = new Float32Array(sz * sz);
  const rough = new Float32Array(sz * sz);
  const cols = 14;
  const rows = 9;
  const seed = 5507;
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    const rf = v * rows;
    const rIdx = Math.floor(rf);
    const fv = rf - rIdx;
    const lip = smoothstep(0.0, 0.16, fv);
    const lipShadow = lerp(0.36, 1.0, lip);
    for (let x = 0; x < sz; x++) {
      const u = x / sz;
      const cf = u * cols;
      const cIdx = Math.floor(cf);
      const fu = cf - cIdx;
      const arch = Math.pow(Math.sin(fu * Math.PI), 0.75);
      const valley = 1.0 - smoothstep(0.04, 0.24, Math.min(fu, 1.0 - fu));
      const tv = hash2i(cIdx % cols, rIdx % rows, seed);
      const soot = smoothstep(0.74, 0.94, tv);
      const mottle = tileFbm(u, v, 8, 8, 3, seed + 33);
      const moss = clamp01(valley * 0.78 + smoothstep(0.56, 0.86, tileFbm(u, v, 5, 5, 3, seed + 77)) * 0.55);

      let r = lerp(118, 192, arch) * (0.86 + (tv - 0.5) * 0.22 + (mottle - 0.5) * 0.12) * lipShadow;
      let g = lerp(54, 108, arch) * (0.86 + (tv - 0.5) * 0.18 + (mottle - 0.5) * 0.10) * lipShadow;
      let b = lerp(34, 68, arch) * (0.86 + (tv - 0.5) * 0.16) * lipShadow;
      // Occasional kiln-charred dark soot tiles
      r = lerp(r, 64 * lipShadow, soot * 0.65);
      g = lerp(g, 58 * lipShadow, soot * 0.65);
      b = lerp(b, 50 * lipShadow, soot * 0.65);
      // Dark olive-green moss settled inside flute valleys
      r = lerp(r, 64, moss * 0.58);
      g = lerp(g, 82, moss * 0.58);
      b = lerp(b, 38, moss * 0.58);

      const i = y * sz + x;
      const o = i * 4;
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(0.12 + arch * 0.78 * lip);
      rough[i] = clamp01(lerp(0.80, 0.94, moss + (1 - arch) * 0.2));
    }
  }
  return buildSobelPbrFromArrays(albedo, height, rough, sz, sz, 4.2, 2, 2, renderer, true);
}

/**
 * 5. Ancient Mottled Hanoi Exposed Brick (`512×512`, `Tường gạch vồ cổ rêu phong`) — KVC-28, GTQ-19, BTS-26
 */
function createKvcAncientBrickTextures(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 512;
  const albedo = new Uint8Array(sz * sz * 4);
  const height = new Float32Array(sz * sz);
  const rough = new Float32Array(sz * sz);
  const rows = 14;
  const cols = 6;
  const seed = 6611;
  const palette: Array<[number, number, number]> = [
    [198, 98, 52],   // vivid burnt orange
    [208, 126, 82],  // warm salmon terracotta
    [172, 128, 92],  // muted ochre-tan
    [144, 72, 46],   // aged red clay
    [66, 60, 54],    // kiln-charred charcoal brick
    [164, 152, 134]  // weathered lime-efflorescence brick
  ];
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    const rf = v * rows;
    const rIdx = Math.floor(rf);
    const fv = rf - rIdx;
    const rowOff = (rIdx % 2) * 0.5;
    for (let x = 0; x < sz; x++) {
      const u = x / sz;
      const cf = u * cols + rowOff;
      const cIdx = Math.floor(cf);
      const fu = cf - cIdx;
      const warp = (tileFbm(u, v, 18, 18, 2, seed + 7) - 0.5) * 0.05;
      const mortarX = smoothstep(0.02, 0.08, Math.min(fu + warp, 1 - fu - warp));
      const mortarY = smoothstep(0.05, 0.14, Math.min(fv + warp, 1 - fv - warp));
      const brickMask = mortarX * mortarY;

      const bid = hash2i(cIdx % cols, rIdx % rows, seed);
      const col = palette[Math.floor(bid * palette.length) % palette.length];
      const grain = tileFbm(u, v, 20, 20, 3, seed + 29);
      const moss = smoothstep(0.54, 0.84, tileFbm(u, v, 5, 5, 3, seed + 83));
      const shade = 0.86 + (grain - 0.5) * 0.24;

      let r = lerp(116, col[0] * shade, brickMask);
      let g = lerp(118, col[1] * shade, brickMask);
      let b = lerp(104, col[2] * shade, brickMask);
      r = lerp(r, 64, moss * 0.42);
      g = lerp(g, 82, moss * 0.42);
      b = lerp(b, 42, moss * 0.42);

      const i = y * sz + x;
      const o = i * 4;
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(lerp(0.18, 0.78 + (grain - 0.5) * 0.16, brickMask));
      rough[i] = clamp01(lerp(0.95, 0.86, brickMask));
    }
  }
  return buildSobelPbrFromArrays(albedo, height, rough, sz, sz, 2.6, 1, 1, renderer, true);
}

/**
 * 6. Weathered Hanoi Pale-Grey Lime Stucco (`512×512`) — GTQ-11, KVC-24..26
 */
function createWellPlasterTextures(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 512;
  const albedo = new Uint8Array(sz * sz * 4);
  const height = new Float32Array(sz * sz);
  const rough = new Float32Array(sz * sz);
  const seed = 7103;
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    for (let x = 0; x < sz; x++) {
      const u = x / sz;
      const n = tileFbm(u, v, 10, 10, 3, seed);
      const streak = tileFbm(u, v, 24, 3, 2, seed + 41);
      const moss = smoothstep(0.62, 0.88, tileFbm(u, v, 6, 6, 3, seed + 99));
      const dark = 1.0 - smoothstep(0.55, 0.85, streak) * 0.26;
      let r = lerp(146, 186, n) * dark;
      let g = lerp(149, 188, n) * dark;
      let b = lerp(142, 180, n) * dark;
      r = lerp(r, 82, moss * 0.45);
      g = lerp(g, 92, moss * 0.45);
      b = lerp(b, 68, moss * 0.45);
      const i = y * sz + x;
      const o = i * 4;
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(0.5 + (n - 0.5) * 0.35);
      rough[i] = clamp01(0.84 + (1 - n) * 0.12);
    }
  }
  return buildSobelPbrFromArrays(albedo, height, rough, sz, sz, 1.5, 1, 1, renderer, true);
}

/**
 * 7. Warm Burnt-Terracotta *Ngói Chiếu* Underside Ceiling Tiles (`256×256`) — BTS-21, DDT-28
 */
function createNgoiChieuCeilingTextures(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 256;
  const albedo = new Uint8Array(sz * sz * 4);
  const height = new Float32Array(sz * sz);
  const rough = new Float32Array(sz * sz);
  const tiles = 6;
  const seed = 7409;
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    const ty = Math.floor(v * tiles);
    const fv = (v * tiles) - ty;
    for (let x = 0; x < sz; x++) {
      const u = x / sz;
      const tx = Math.floor(u * tiles);
      const fu = (u * tiles) - tx;
      const mask = smoothstep(0.02, 0.07, Math.min(fu, 1 - fu)) * smoothstep(0.02, 0.07, Math.min(fv, 1 - fv));
      const tv = hash2i(tx % tiles, ty % tiles, seed);
      const gN = tileFbm(u, v, 14, 14, 2, seed + 17);
      const r = lerp(74, (176 + (tv - 0.5) * 32) * (0.92 + gN * 0.16), mask);
      const g = lerp(34, (82 + (tv - 0.5) * 20) * (0.92 + gN * 0.16), mask);
      const b = lerp(18, (44 + (tv - 0.5) * 14) * (0.92 + gN * 0.16), mask);
      const i = y * sz + x;
      const o = i * 4;
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(lerp(0.25, 0.78, mask));
      rough[i] = 0.82;
    }
  }
  return buildSobelPbrFromArrays(albedo, height, rough, sz, sz, 1.4, 2, 2, renderer, true);
}

/**
 * 8. Sun-Bleached Dusty Terracotta-Rose `33cm` Bát Tràng Floor Tiles (`512×512`) — BTS-24
 */
function createVanMieuBatTrangTextures(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 512;
  const albedo = new Uint8Array(sz * sz * 4);
  const height = new Float32Array(sz * sz);
  const rough = new Float32Array(sz * sz);
  const tiles = 4; // 4×4 tiles across ~1.35m world UV -> authentic ~33cm square Bát Tràng tiles!
  const seed = 7523;
  const tones: Array<[number, number, number]> = [
    [202, 167, 152],
    [211, 181, 167],
    [190, 154, 140],
    [198, 171, 160],
    [215, 190, 177]
  ];
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    const ty = Math.floor(v * tiles);
    const fv = (v * tiles) - ty;
    for (let x = 0; x < sz; x++) {
      const u = x / sz;
      const tx = Math.floor(u * tiles);
      const fu = (u * tiles) - tx;
      const mask = smoothstep(0.018, 0.055, Math.min(fu, 1 - fu)) * smoothstep(0.018, 0.055, Math.min(fv, 1 - fv));
      const tv = hash2i(tx % tiles, ty % tiles, seed);
      const base = tones[Math.floor(tv * tones.length) % tones.length];
      const wear = tileFbm(u, v, 10, 10, 3, seed + 31);
      const dust = smoothstep(0.55, 0.90, tileFbm(u, v, 4, 4, 2, seed + 67)) * 0.22;
      let r = lerp(206, base[0] * (0.93 + (wear - 0.5) * 0.14), mask);
      let g = lerp(201, base[1] * (0.93 + (wear - 0.5) * 0.14), mask);
      let b = lerp(191, base[2] * (0.93 + (wear - 0.5) * 0.14), mask);
      r = lerp(r, 210, dust);
      g = lerp(g, 206, dust);
      b = lerp(b, 198, dust);
      const i = y * sz + x;
      const o = i * 4;
      albedo[o] = clampByte(r);
      albedo[o + 1] = clampByte(g);
      albedo[o + 2] = clampByte(b);
      albedo[o + 3] = 255;
      height[i] = clamp01(lerp(0.32, 0.72 + (wear - 0.5) * 0.06, mask));
      rough[i] = clamp01(lerp(0.90, 0.76 + (wear - 0.5) * 0.10, mask));
    }
  }
  return buildSobelPbrFromArrays(albedo, height, rough, sz, sz, 0.95, 1, 1, renderer, true);
}

/**
 * 9. 1024×1536 Museum-Grade Carved Thanh Hóa Limestone Doctors' Stele Atlas (`Bia Tiến Sĩ`) — BTS-05..09
 *    - Arched `Trán Bia` lunette with carved `Lưỡng Long Chầu Nhật` (twin dragons flanking flaming sun pearl)
 *    - Recessed `Ngạch Bia` horizontal title cartouche (`景興三十六年乙未科進士題名碑`)
 *    - Ornate perimeter `Diềm Bia` diamond-rosette & chrysanthemum-vine border
 *    - Dense vertical Hán-Nôm preface prose + tiered Laureate roster columns (`吳世治`, `杜輝碧`, `潘輝益`, `阮國彥`...)
 *    - Synchronized Sobel tangent-space normal map + weathered limestone patina!
 */
function createDoctorsSteleCanvases(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 1024;
  const h = headless ? 192 : 1536;
  const cObj = makeCanvas(w, h);
  const hObj = makeCanvas(w, h);
  if (!cObj || !hObj) return null;
  const S = w / 1024;
  const c = cObj.ctx;
  const ht = hObj.ctx;

  // Base monolithic weathered silver-grey Thanh Hóa limestone (ZERO bricks!)
  c.fillStyle = '#c5c8c2';
  c.fillRect(0, 0, w, h);
  ht.fillStyle = '#929292';
  ht.fillRect(0, 0, w, h);

  // Subtle sedimentary limestone veins & mineral mottling
  for (let i = 0; i < 160; i++) {
    const x = hash2i(i, 1, 8801) * w;
    const y = hash2i(i, 2, 8801) * h;
    const rx = (22 + hash2i(i, 3, 8801) * 95) * S;
    const ry = (18 + hash2i(i, 4, 8801) * 140) * S;
    c.fillStyle = i % 2 === 0 ? 'rgba(130,136,132,0.09)' : 'rgba(226,228,224,0.11)';
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  const archCy = 440 * S;
  const archR = 456 * S;
  const borderW = 86 * S;

  for (const [ctx, isH] of [
    [c, false],
    [ht, true]
  ] as const) {
    // 1. Recessed arched `Trán Bia` lunette background
    ctx.save();
    ctx.beginPath();
    ctx.arc(w * 0.5, archCy, archR - borderW, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = isH ? '#525252' : '#969b96';
    ctx.fill();
    ctx.strokeStyle = isH ? '#e0e0e0' : '#d2d5cf';
    ctx.lineWidth = 8 * S;
    ctx.stroke();

    // Central flaming sun/pearl medallion (`Hỏa Châu / Mặt Trời`)
    const sunX = w * 0.5;
    const sunY = archCy - 175 * S;
    for (let r = 0; r < 14; r++) {
      const a = (r / 14) * Math.PI * 2;
      ctx.strokeStyle = isH ? '#d8d8d8' : '#d0d3cd';
      ctx.lineWidth = 6 * S;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(a) * 58 * S, sunY + Math.sin(a) * 58 * S);
      ctx.quadraticCurveTo(
        sunX + Math.cos(a + 0.16) * 92 * S,
        sunY + Math.sin(a + 0.16) * 92 * S,
        sunX + Math.cos(a) * 112 * S,
        sunY + Math.sin(a) * 112 * S
      );
      ctx.stroke();
    }
    ctx.fillStyle = isH ? '#ececec' : '#d8dbd5';
    ctx.strokeStyle = isH ? '#3a3a3a' : '#737772';
    ctx.lineWidth = 5 * S;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 54 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sunX, sunY, 36 * S, 0, Math.PI * 2);
    ctx.stroke();

    // Symmetrical high-relief Lê-dynasty Twin Dragons (`Lưỡng Long Chầu Nhật`) + swirling clouds
    for (const s of [-1, 1]) {
      ctx.strokeStyle = isH ? '#dcdcdc' : '#cfd2cc';
      ctx.lineWidth = 34 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sunX + s * 105 * S, sunY + 12 * S);
      ctx.bezierCurveTo(
        sunX + s * 155 * S,
        sunY - 72 * S,
        sunX + s * 235 * S,
        sunY + 86 * S,
        sunX + s * 315 * S,
        sunY + 56 * S
      );
      ctx.stroke();
      ctx.strokeStyle = isH ? '#363636' : '#6c706c';
      ctx.lineWidth = 4 * S;
      ctx.stroke();
      // Dragon head facing sun orb
      ctx.fillStyle = isH ? '#ececec' : '#d6d9d3';
      ctx.beginPath();
      ctx.ellipse(sunX + s * 108 * S, sunY + 8 * S, 34 * S, 22 * S, -s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Swirling clouds around dragon
      drawReliefCloudScroll(ctx, sunX + s * 205 * S, sunY - 46 * S, 1.45 * S, isH ? '#d6d6d6' : '#cdd0ca', isH ? '#3c3c3c' : '#757974', 3 * S, s);
      drawReliefCloudScroll(ctx, sunX + s * 260 * S, sunY + 95 * S, 1.35 * S, isH ? '#d0d0d0' : '#c8cbc5', isH ? '#3c3c3c' : '#757974', 3 * S, -s);
    }
    ctx.restore();

    // 2. Ornate Perimeter `Diềm Bia` Carved Diamond-Rosette & Floral Vine Border
    ctx.strokeStyle = isH ? '#dcdcdc' : '#cfd2cc';
    ctx.lineWidth = 6 * S;
    // Outer & inner vertical borders + bottom border
    ctx.strokeRect(18 * S, archCy, w - 36 * S, h - archCy - 20 * S);
    ctx.strokeRect(borderW, archCy, w - borderW * 2, h - archCy - borderW);
    // Arch border rosettes
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI + (k / 16) * Math.PI;
      const rx = w * 0.5 + Math.cos(a) * (archR - borderW * 0.5);
      const ry = archCy + Math.sin(a) * (archR - borderW * 0.5);
      ctx.fillStyle = isH ? '#dcdcdc' : '#cfd2cc';
      ctx.strokeStyle = isH ? '#3c3c3c' : '#7a7e79';
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      ctx.moveTo(rx, ry - 20 * S);
      ctx.lineTo(rx + 22 * S, ry);
      ctx.lineTo(rx, ry + 20 * S);
      ctx.lineTo(rx - 22 * S, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Left & right chrysanthemum-vine side borders
    for (let row = 0; row < 14; row++) {
      const sy = archCy + (44 + row * 72) * S;
      for (const sx of [borderW * 0.52, w - borderW * 0.52]) {
        ctx.fillStyle = isH ? '#d8d8d8' : '#ccd0ca';
        ctx.strokeStyle = isH ? '#3e3e3e' : '#7b7f7a';
        ctx.lineWidth = 3 * S;
        ctx.beginPath();
        ctx.arc(sx, sy, 22 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 9 * S, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Bottom diamond rosette border
    for (let col = 0; col < 12; col++) {
      const sx = borderW + (36 + col * 72) * S;
      const sy = h - borderW * 0.52;
      ctx.fillStyle = isH ? '#d8d8d8' : '#ccd0ca';
      ctx.strokeStyle = isH ? '#3e3e3e' : '#7b7f7a';
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 18 * S);
      ctx.lineTo(sx + 22 * S, sy);
      ctx.lineTo(sx, sy + 18 * S);
      ctx.lineTo(sx - 22 * S, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Recessed Horizontal Title Cartouche (`Ngạch Bia`: 景興三十六年乙未科進士題名碑)
    const ngachY = archCy + 14 * S;
    const ngachH = 82 * S;
    ctx.fillStyle = isH ? '#646464' : '#a8ada8';
    ctx.fillRect(borderW + 10 * S, ngachY, w - borderW * 2 - 20 * S, ngachH);
    ctx.strokeStyle = isH ? '#e0e0e0' : '#d6d9d3';
    ctx.lineWidth = 5 * S;
    ctx.strokeRect(borderW + 10 * S, ngachY, w - borderW * 2 - 20 * S, ngachH);

    const titleChars = '碑名題士進科未乙年六十三興景';
    ctx.font = `bold ${Math.round(44 * S)}px "KaiTi", "STKaiti", "SimSun", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isH ? '#2a2a2a' : '#585d5a';
    const stepX = (w - borderW * 2 - 54 * S) / titleChars.length;
    for (let i = 0; i < titleChars.length; i++) {
      ctx.fillText(titleChars[i], borderW + 30 * S + (i + 0.5) * stepX, ngachY + ngachH * 0.52);
    }

    // 4. Recessed Mirror Field (`Lòng Bia`) with Dense Vertical Hán-Nôm Inscriptions & Laureate Roster!
    const fieldTop = ngachY + ngachH + 16 * S;
    const fieldH = h - borderW - fieldTop - 14 * S;
    ctx.fillStyle = isH ? '#828282' : '#c6c9c3';
    ctx.fillRect(borderW + 12 * S, fieldTop, w - borderW * 2 - 24 * S, fieldH);
    ctx.strokeStyle = isH ? '#555555' : '#8c908b';
    ctx.lineWidth = 4 * S;
    ctx.strokeRect(borderW + 12 * S, fieldTop, w - borderW * 2 - 24 * S, fieldH);

    // Right 40%: Dense preface essay columns (`Bài Ký`)
    const essayGlyphs = '國朝崇重儒學設科取士以育賢才立石題名垂諸不朽聖道昌明人文蔚起禮樂彬彬萬世師表';
    ctx.font = `${Math.round(21 * S)}px "KaiTi", "SimSun", serif`;
    for (let col = 0; col < 10; col++) {
      const gx = w - borderW - (42 + col * 32) * S;
      for (let row = 0; row < 28; row++) {
        const ch = essayGlyphs[(col * 7 + row * 3) % essayGlyphs.length];
        const wearAlpha = 0.42 + hash2i(col, row, 4701) * 0.38;
        ctx.fillStyle = isH ? '#424242' : `rgba(88, 93, 89, ${wearAlpha.toFixed(2)})`;
        ctx.fillText(ch, gx, fieldTop + (32 + row * 28) * S);
      }
    }

    // Left 55%: Iconic Doctoral Laureate Roster (`Tiến Sĩ Đề Danh`, exact Ref 47 prominence!)
    const laureates = [
      '吳世治', '杜輝碧', '潘輝益', '阮國彥', '吳維微', '黃平政',
      '黎有喬', '阮世歷', '阮衡', '陳韶視', '阮世坪', '武輝瑨'
    ];
    ctx.font = `bold ${Math.round(32 * S)}px "KaiTi", "STKaiti", "SimSun", serif`;
    for (let tier = 0; tier < 2; tier++) {
      const startY = fieldTop + (74 + tier * 240) * S;
      for (let col = 0; col < 6; col++) {
        const name = laureates[(tier * 6 + col) % laureates.length];
        const gx = borderW + (66 + col * 68) * S;
        for (let k = 0; k < name.length; k++) {
          ctx.fillStyle = isH ? '#282828' : 'rgba(72, 77, 74, 0.84)';
          ctx.fillText(name[k], gx, startY + k * 42 * S);
        }
      }
    }
  }

  return { canvas: cObj.canvas, heightCanvas: hObj.canvas };
}

/**
 * 10. 1024×1024 Carved Stone Tortoise Carapace (`Mai Rùa Lục Giác`) — BTS-12
 *     Triple concentric nested hexagonal vertebral & costal scutes + marginal border plates + Sobel normal!
 */
function createTortoiseCarapaceCanvases(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 128 : 1024;
  const cObj = makeCanvas(sz, sz);
  const hObj = makeCanvas(sz, sz);
  if (!cObj || !hObj) return null;
  const S = sz / 1024;
  const drawHex = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  for (const [ctx, isH] of [
    [cObj.ctx, false],
    [hObj.ctx, true]
  ] as const) {
    ctx.fillStyle = isH ? '#868686' : '#b2b7b4';
    ctx.fillRect(0, 0, sz, sz);

    // Outer marginal rim band (`vảy viền mai`)
    ctx.strokeStyle = isH ? '#d6d6d6' : '#cfd3ce';
    ctx.lineWidth = 42 * S;
    ctx.beginPath();
    ctx.ellipse(sz * 0.5, sz * 0.5, 456 * S, 456 * S, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Tiled hexagonal tortoise shell scutes with triple concentric nested rings (matching Ref 47!)
    const hexR = 112 * S;
    const dx = hexR * Math.sqrt(3);
    const dy = hexR * 1.5;
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        const cx = sz * 0.5 + col * dx + (Math.abs(row) % 2) * (dx * 0.5);
        const cy = sz * 0.5 + row * dy;
        if (Math.hypot(cx - sz * 0.5, cy - sz * 0.5) > 435 * S) continue;

        // Outer deep V-groove
        drawHex(ctx, cx, cy, hexR * 0.96);
        ctx.fillStyle = isH ? '#b6b6b6' : '#9ea4a3';
        ctx.fill();
        ctx.strokeStyle = isH ? '#282828' : '#6c7274';
        ctx.lineWidth = 10 * S;
        ctx.stroke();

        // Raised bevel rim
        drawHex(ctx, cx, cy, hexR * 0.82);
        ctx.strokeStyle = isH ? '#ececec' : '#d2d5d0';
        ctx.lineWidth = 7 * S;
        ctx.stroke();

        // Inner nested double hexagon rings
        drawHex(ctx, cx, cy, hexR * 0.62);
        ctx.strokeStyle = isH ? '#404040' : '#7b8182';
        ctx.lineWidth = 5 * S;
        ctx.stroke();

        drawHex(ctx, cx, cy, hexR * 0.42);
        ctx.strokeStyle = isH ? '#d8d8d8' : '#c4c8c3';
        ctx.lineWidth = 4 * S;
        ctx.stroke();
      }
    }
  }

  return { canvas: cObj.canvas, heightCanvas: hObj.canvas };
}

/**
 * 13. 512×512 Đức Thánh Khổng Tử Hero Texture Atlas (DDT-08..11)
 *     Top half (v ∈ [0.5..1.0]): Warm painted ivory-gilt serene face (brows, calm downcast eyes, mustache hint, vermilion lips)
 *     Bottom half (v ∈ [0.0..0.5]): Lustrous vermilion imperial robe with embossed 24K golden `Bổ Tử` dragon-cloud square medallion & gold shoulder scrolls!
 */
function createConfuciusHeroCanvases(renderer?: THREE.WebGLRenderer) {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 64 : 512;
  const cObj = makeCanvas(sz, sz);
  const hObj = makeCanvas(sz, sz);
  if (!cObj || !hObj) return null;
  const S = sz / 512;
  const c = cObj.ctx;
  const ht = hObj.ctx;

  // Top half (canvas y ∈ [0..256], Three.js v ∈ [0.5..1.0]): Warm gilded ivory face
  const faceGrad = c.createRadialGradient(256 * S, 128 * S, 18 * S, 256 * S, 128 * S, 190 * S);
  faceGrad.addColorStop(0, '#f6dcad');
  faceGrad.addColorStop(0.65, '#e8be84');
  faceGrad.addColorStop(1, '#c89254');
  c.fillStyle = faceGrad;
  c.fillRect(0, 0, sz, sz * 0.5);
  ht.fillStyle = '#888888';
  ht.fillRect(0, 0, sz, sz * 0.5);

  // Subtle rosy-ochre scholar cheek warmth
  for (const sx of [-1, 1]) {
    const cg = c.createRadialGradient((256 + sx * 64) * S, 146 * S, 6 * S, (256 + sx * 64) * S, 146 * S, 42 * S);
    cg.addColorStop(0, 'rgba(196, 86, 56, 0.28)');
    cg.addColorStop(1, 'rgba(196, 86, 56, 0.0)');
    c.fillStyle = cg;
    c.fillRect(0, 0, sz, sz * 0.5);
  }
  // Serene arched dark brows & dignified almond eyes (centered at u = 0.5 -> x = 256)
  c.strokeStyle = '#2b1e16';
  c.lineWidth = 6 * S;
  c.lineCap = 'round';
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.moveTo((256 + sx * 22) * S, 94 * S);
    c.quadraticCurveTo((256 + sx * 52) * S, 80 * S, (256 + sx * 84) * S, 96 * S);
    c.stroke();
    // Almond eye
    c.fillStyle = '#fff9f0';
    c.beginPath();
    c.ellipse((256 + sx * 52) * S, 118 * S, 20 * S, 9 * S, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#261812';
    c.beginPath();
    c.arc((256 + sx * 52) * S, 118 * S, 7.5 * S, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#382218';
    c.lineWidth = 3.5 * S;
    c.beginPath();
    c.moveTo((256 + sx * 30) * S, 117 * S);
    c.quadraticCurveTo((256 + sx * 52) * S, 106 * S, (256 + sx * 74) * S, 118 * S);
    c.stroke();
  }
  // Dignified calm vermilion mouth
  c.fillStyle = '#a83426';
  c.beginPath();
  c.ellipse(256 * S, 194 * S, 24 * S, 7 * S, 0, 0, Math.PI * 2);
  c.fill();

  // Bottom half (canvas y ∈ [256..512], Three.js v ∈ [0.0..0.5]): Vermilion imperial robe + 24K golden `Bổ Tử` dragon brocade!
  for (const [ctx, isH] of [
    [c, false],
    [ht, true]
  ] as const) {
    ctx.fillStyle = isH ? '#565656' : '#ba1510';
    ctx.fillRect(0, sz * 0.5, sz, sz * 0.5);
    // Golden Y-collar lapel bands & broad cuff trims
    ctx.strokeStyle = isH ? '#e8e8e8' : '#f2c444';
    ctx.lineWidth = 14 * S;
    ctx.beginPath();
    ctx.moveTo(168 * S, 260 * S);
    ctx.lineTo(256 * S, 332 * S);
    ctx.lineTo(344 * S, 260 * S);
    ctx.stroke();

    // Central square-framed 24K gold `Bổ Tử` imperial dragon-cloud chest medallion
    const bx = 186 * S;
    const by = 324 * S;
    const bs = 140 * S;
    ctx.fillStyle = isH ? '#c0c0c0' : '#d69820';
    ctx.fillRect(bx, by, bs, bs);
    ctx.strokeStyle = isH ? '#ffffff' : '#ffe278';
    ctx.lineWidth = 6 * S;
    ctx.strokeRect(bx, by, bs, bs);
    drawReliefCloudScroll(ctx, 256 * S, 376 * S, 1.45 * S, isH ? '#ffffff' : '#ffe484', isH ? '#3a3a3a' : '#7a3e06', 2.5 * S, 1);
    drawReliefCloudScroll(ctx, 256 * S, 424 * S, 1.30 * S, isH ? '#eeeeee' : '#f6ca4c', isH ? '#3a3a3a' : '#7a3e06', 2.5 * S, -1);

    // Symmetrical shoulder & sleeve golden dragon-cloud brocade
    for (const sx of [-1, 1]) {
      drawReliefCloudScroll(ctx, (256 + sx * 158) * S, 336 * S, 1.45 * S, isH ? '#e8e8e8' : '#f6cb4e', isH ? '#3a3a3a' : '#6e2806', 2.6 * S, sx);
      drawReliefCloudScroll(ctx, (256 + sx * 150) * S, 434 * S, 1.35 * S, isH ? '#e0e0e0' : '#eab634', isH ? '#3a3a3a' : '#6e2806', 2.6 * S, -sx);
    }
  }

  return { canvas: cObj.canvas, heightCanvas: hObj.canvas };
}

/**
 * 14. 1024×1536 Packed Classical Hanzi Calligraphy, Confucius Hero & Sanctum Halo Atlas
 *     Top 1024×1024 (v ∈ [0.333..1.000]): 12 plaques, couplets, censer nameplate & Bát Tràng porcelain
 *     Bottom-left 512×512 (v ∈ [0.000..0.333], u ∈ [0.0..0.5]): Đức Thánh Khổng Tử painted face + vermilion dragon robe
 *     Bottom-right 512×512 (v ∈ [0.000..0.333], u ∈ [0.5..1.0]): Backlit luminous ivory-gold sanctum halo panel
 */
export const VAN_MIEU_ATLAS_UV = {
  khueVan: [0.0, 0.8333, 0.5, 1.0],
  vanThe: [0.5, 0.8333, 1.0, 1.0],
  cauDoiKvc1: [0.0, 0.3333, 0.125, 0.8333],
  cauDoiKvc2: [0.125, 0.3333, 0.25, 0.8333],
  cauDoiDdt1: [0.25, 0.3333, 0.375, 0.8333],
  cauDoiDdt2: [0.375, 0.3333, 0.5, 0.8333],
  hoiTy: [0.5, 0.6667, 0.75, 0.8333],
  tucTinh: [0.75, 0.6667, 1.0, 0.8333],
  censerTag: [0.5, 0.5467, 1.0, 0.6667],
  biVan: [0.5, 0.44, 0.75, 0.5467],
  sucVan: [0.75, 0.44, 1.0, 0.5467],
  porcelain: [0.5, 0.3333, 1.0, 0.44],
  confuciusFace: [0.0, 0.1667, 0.5, 0.3333],
  confuciusRobe: [0.0, 0.0, 0.5, 0.1667],
  sanctumHalo: [0.5, 0.0, 1.0, 0.3333]
} as const;

export type VanMieuAtlasKey = keyof typeof VAN_MIEU_ATLAS_UV;

function createVanMieuCalligraphyAtlas(
  confuciusCanvas: HTMLCanvasElement | null,
  renderer?: THREE.WebGLRenderer
): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 1024;
  const h = headless ? 192 : 1536;
  const cObj = makeCanvas(w, h);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([118, 22, 18, 255]), 1, 1, true, 1, 1, renderer, THREE.ClampToEdgeWrapping);
  }
  const c = cObj.ctx;
  const S = w / 1024;
  c.fillStyle = '#5c1410';
  c.fillRect(0, 0, w, h);

  const drawHorizontalPlaque = (
    x: number,
    y: number,
    w: number,
    h: number,
    bg: string,
    border: string,
    fg: string,
    text: string,
    fontSize: number
  ) => {
    c.fillStyle = bg;
    c.fillRect(x, y, w, h);
    c.strokeStyle = border;
    c.lineWidth = 10 * S;
    c.strokeRect(x + 10 * S, y + 10 * S, w - 20 * S, h - 20 * S);
    c.lineWidth = 3 * S;
    c.strokeRect(x + 24 * S, y + 24 * S, w - 48 * S, h - 48 * S);
    c.fillStyle = fg;
    c.font = `bold ${Math.round(fontSize * S)}px "KaiTi", "STKaiti", "SimSun", serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, x + w * 0.5, y + h * 0.54);
  };

  // Top-left (y 0..256): "閣 文 奎" (traditional right-to-left Khuê Văn Các!)
  drawHorizontalPlaque(0, 0, 512 * S, 256 * S, '#561511', '#a68238', '#caa248', '閣  文  奎', 108);
  // Top-right (y 0..256): "表 師 世 萬" (Vạn Thế Sư Biểu Hoành Phi)
  drawHorizontalPlaque(512 * S, 0, 512 * S, 256 * S, '#680c0a', '#e8ba42', '#fae074', '表 師 世 萬', 96);

  // 4 Vertical Câu Đối columns (y 256..1024, x 0..512)
  const drawVerticalCouplet = (
    x: number,
    w: number,
    bg: string,
    border: string,
    fg: string,
    chars: string,
    distressed: boolean
  ) => {
    const y0 = 256 * S;
    const hh = 768 * S;
    c.fillStyle = bg;
    c.fillRect(x, y0, w, hh);
    if (distressed) {
      c.fillStyle = 'rgba(176, 152, 134, 0.24)';
      c.fillRect(x + 4 * S, y0, 16 * S, hh);
      c.fillRect(x + w - 20 * S, y0, 16 * S, hh);
    }
    c.strokeStyle = border;
    c.lineWidth = 5 * S;
    c.strokeRect(x + 8 * S, y0 + 12 * S, w - 16 * S, hh - 24 * S);
    c.fillStyle = fg;
    c.font = `bold ${Math.round(66 * S)}px "KaiTi", "STKaiti", "SimSun", serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const step = (hh - 72 * S) / chars.length;
    for (let i = 0; i < chars.length; i++) {
      c.fillText(chars[i], x + w * 0.5, y0 + 44 * S + (i + 0.5) * step);
    }
  };
  drawVerticalCouplet(0, 128 * S, '#8c241d', '#b08e48', '#d2ae5a', '奎星天朗人文盛', true);
  drawVerticalCouplet(128 * S, 128 * S, '#8c241d', '#b08e48', '#d2ae5a', '聖域春融道脈長', true);
  drawVerticalCouplet(256 * S, 128 * S, '#7e0f0c', '#ecc048', '#ffe47c', '中天日月德與齊', false);
  drawVerticalCouplet(384 * S, 128 * S, '#7e0f0c', '#ecc048', '#ffe47c', '後帝王師業高尊', false);

  // Hồi Tỵ ("避") & Túc Tĩnh ("肅") ceremonial placards (y 256..512, x 512..1024)
  drawHorizontalPlaque(512 * S, 256 * S, 256 * S, 256 * S, '#6c0d0a', '#ecc048', '#ffe47a', '避', 136);
  drawHorizontalPlaque(768 * S, 256 * S, 256 * S, 256 * S, '#6c0d0a', '#ecc048', '#ffe47a', '肅', 136);

  // Censer Nameplate (y 512..696, x 512..1024): "VĂN TUYÊN VƯƠNG / KHỔNG TỬ / (551 - 479 TCN)"
  c.fillStyle = '#680f0c';
  c.fillRect(512 * S, 512 * S, 512 * S, 184 * S);
  c.strokeStyle = '#e8bc44';
  c.lineWidth = 6 * S;
  c.strokeRect(522 * S, 522 * S, 492 * S, 164 * S);
  c.fillStyle = '#ffe588';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `bold ${Math.round(36 * S)}px Georgia, serif`;
  c.fillText('VĂN TUYÊN VƯƠNG', 768 * S, 566 * S);
  c.font = `bold ${Math.round(42 * S)}px Georgia, serif`;
  c.fillText('KHỔNG TỬ', 768 * S, 616 * S);
  c.font = `${Math.round(24 * S)}px Georgia, serif`;
  c.fillText('(551 – 479 TCN)', 768 * S, 658 * S);

  // Side Gate Plaques: "秘 文" (Bí Văn) & "畜 文" (Súc Văn) (y 696..860, x 512..1024)
  drawHorizontalPlaque(512 * S, 696 * S, 256 * S, 164 * S, '#8c9088', '#5c605a', '#424640', '秘  文', 72);
  drawHorizontalPlaque(768 * S, 696 * S, 256 * S, 164 * S, '#8c9088', '#5c605a', '#424640', '畜  文', 72);

  // Bát Tràng Cobalt Blue-and-White Porcelain Vase Band (y 860..1024, x 512..1024)
  c.fillStyle = '#f2f5fa';
  c.fillRect(512 * S, 860 * S, 512 * S, 164 * S);
  c.strokeStyle = '#1b3f94';
  c.lineWidth = 6 * S;
  c.beginPath();
  c.moveTo(512 * S, 882 * S);
  c.lineTo(1024 * S, 882 * S);
  c.moveTo(512 * S, 1002 * S);
  c.lineTo(1024 * S, 1002 * S);
  c.stroke();
  for (let i = 0; i < 6; i++) {
    const px = (554 + i * 84) * S;
    drawReliefCloudScroll(c, px, 942 * S, 1.05 * S, '#244ea8', '#142f74', 2.4 * S, i % 2 === 0 ? 1 : -1);
  }

  // Bottom-left (y 1024..1536, x 0..512): Đức Thánh Khổng Tử painted serene face + vermilion dragon robe (`DDT-08..11`)
  if (confuciusCanvas) {
    c.drawImage(confuciusCanvas, 0, 1024 * S, 512 * S, 512 * S);
  }
  // Bottom-right (y 1024..1536, x 512..1024): Warm luminous backlit ivory-gold sanctum halo panel (`DDT-02`)
  const haloGrad = c.createRadialGradient(768 * S, 1280 * S, 24 * S, 768 * S, 1280 * S, 275 * S);
  haloGrad.addColorStop(0.0, '#fffdf2');
  haloGrad.addColorStop(0.55, '#ffefc8');
  haloGrad.addColorStop(0.85, '#f2c87a');
  haloGrad.addColorStop(1.0, '#c68238');
  c.fillStyle = haloGrad;
  c.fillRect(512 * S, 1024 * S, 512 * S, 512 * S);

  return wrapCanvasTex(cObj.canvas, true, 1, 1, renderer, THREE.ClampToEdgeWrapping);
}

/**
 * Composites all 5 non-repeating high-relief sculptures (Doctors' Stele 1024×1536,
 * Tortoise Carapace 1024×1024, Khuê Văn Các Pier Relief 512×1024, Under-Balcony Frieze 1024×256,
 * and Warm Burnt-Terracotta *Ngói Chiếu* Ceiling 512×512) into ONE 2048×2048 PBR Relief Atlas + Sobel Normal!
 */
function createVanMieuReliefAtlas(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 256 : 2048;
  const cObj = makeCanvas(sz, sz);
  const hObj = makeCanvas(sz, sz);
  if (!cObj || !hObj) {
    return {
      map: finalizeDataTex(new Uint8Array([196, 198, 194, 255]), 1, 1, true, 1, 1, renderer, THREE.ClampToEdgeWrapping),
      normalMap: finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, 1, 1, renderer, THREE.ClampToEdgeWrapping)
    };
  }
  const S = sz / 2048;
  const c = cObj.ctx;
  const ht = hObj.ctx;
  c.fillStyle = '#c2c5c0';
  c.fillRect(0, 0, sz, sz);
  ht.fillStyle = '#808080';
  ht.fillRect(0, 0, sz, sz);

  const stele = createDoctorsSteleCanvases(renderer);
  const carapace = createTortoiseCarapaceCanvases(renderer);
  const pier = createKvcPierReliefCanvases(renderer);
  const frieze = createKvcCarvedFriezeCanvases(renderer);

  if (stele) {
    c.drawImage(stele.canvas, 0, 0, 1024 * S, 1536 * S);
    ht.drawImage(stele.heightCanvas, 0, 0, 1024 * S, 1536 * S);
  }
  if (carapace) {
    c.drawImage(carapace.canvas, 1024 * S, 0, 1024 * S, 1024 * S);
    ht.drawImage(carapace.heightCanvas, 1024 * S, 0, 1024 * S, 1024 * S);
  }
  if (pier) {
    c.drawImage(pier.canvas, 1024 * S, 1024 * S, 512 * S, 1024 * S);
    ht.drawImage(pier.heightCanvas, 1024 * S, 1024 * S, 512 * S, 1024 * S);
  }
  if (frieze) {
    c.drawImage(frieze.canvas, 0, 1536 * S, 1024 * S, 256 * S);
    ht.drawImage(frieze.heightCanvas, 0, 1536 * S, 1024 * S, 256 * S);
  }

  // Warm burnt-terracotta flat *ngói chiếu* underside ceiling tile grid (`1536..2048, 1024..1536`)
  const nx0 = 1536 * S;
  const ny0 = 1024 * S;
  const nSz = 512 * S;
  const nTiles = 16;
  const tStep = nSz / nTiles;
  c.fillStyle = '#522214';
  c.fillRect(nx0, ny0, nSz, nSz);
  ht.fillStyle = '#404040';
  ht.fillRect(nx0, ny0, nSz, nSz);
  for (let ry = 0; ry < nTiles; ry++) {
    for (let rx = 0; rx < nTiles; rx++) {
      const tv = hash2i(rx, ry, 6311);
      const r = clampByte(174 + (tv - 0.5) * 30);
      const g = clampByte(82 + (tv - 0.5) * 20);
      const b = clampByte(44 + (tv - 0.5) * 14);
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(nx0 + rx * tStep + 1.5 * S, ny0 + ry * tStep + 1.5 * S, tStep - 3 * S, tStep - 3 * S);
      ht.fillStyle = '#c8c8c8';
      ht.fillRect(nx0 + rx * tStep + 1.5 * S, ny0 + ry * tStep + 1.5 * S, tStep - 3 * S, tStep - 3 * S);
    }
  }

  return {
    map: wrapCanvasTex(cObj.canvas, true, 1, 1, renderer, THREE.ClampToEdgeWrapping),
    normalMap: canvasToSobelNormal(hObj.canvas, 1.9, 1, 1, renderer, false)
  };
}

/**
 * Creates the ultra-lean 6-material Văn Miếu — Quốc Tử Giám Museum PBR & Calligraphy Pack
 * (keeping global `uniqueMaterials <= 250` while delivering full 2048px relief & 1536px calligraphy fidelity!).
 */
export function createVanMieuMaterialPack(renderer?: THREE.WebGLRenderer): VanMieuMaterialPack {
  const crimsonTex = createKvcWeatheredCrimsonTextures(renderer);
  const roofTex = createKvcAgedTerracottaTextures(renderer);
  const reliefAtlas = createVanMieuReliefAtlas(renderer);
  const confuciusCanvases = createConfuciusHeroCanvases(renderer);
  const calligraphyTex = createVanMieuCalligraphyAtlas(confuciusCanvases?.canvas ?? null, renderer);

  const kvcWeatheredCrimsonMat = new THREE.MeshStandardMaterial({
    color: '#d8b4ac',
    map: crimsonTex.map,
    normalMap: crimsonTex.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: crimsonTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.03
  });

  const kvcAgedTerracottaMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: roofTex.map,
    normalMap: roofTex.normalMap,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughnessMap: roofTex.roughnessMap,
    roughness: 1.0,
    metalness: 0.03,
    side: THREE.FrontSide
  });

  const vanMieuReliefAtlasMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: reliefAtlas.map,
    normalMap: reliefAtlas.normalMap,
    normalScale: new THREE.Vector2(1.85, 1.85),
    roughness: 0.80,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  const vanMieuCalligraphyMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: calligraphyTex,
    emissiveMap: calligraphyTex,
    emissive: new THREE.Color('#ffd078'),
    emissiveIntensity: 0.075,
    roughness: 0.48,
    metalness: 0.14,
    envMapIntensity: 0.10,
    fog: false
  });

  // Interior Điện Đại Thành materials: fog: false & envMapIntensity: 0.0 so deep son-son lacquer & 24K gold glow richly without glare!
  const sanctuaryCrimsonLacquerMat = new THREE.MeshStandardMaterial({
    color: '#7a0d09',
    map: crimsonTex.map,
    normalMap: crimsonTex.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.44,
    metalness: 0.04,
    envMapIntensity: 0.0,
    fog: false
  });

  const sanctuaryCarvedGoldMat = new THREE.MeshStandardMaterial({
    color: '#e6b438',
    normalMap: crimsonTex.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    emissive: new THREE.Color('#5a2e04'),
    emissiveIntensity: 0.18,
    roughness: 0.34,
    metalness: 0.78,
    envMapIntensity: 0.25,
    fog: false
  });

  const allMaterials: THREE.Material[] = [
    kvcWeatheredCrimsonMat,
    kvcAgedTerracottaMat,
    vanMieuReliefAtlasMat,
    vanMieuCalligraphyMat,
    sanctuaryCrimsonLacquerMat,
    sanctuaryCarvedGoldMat
  ];

  const allTextures: THREE.Texture[] = [
    crimsonTex.map,
    crimsonTex.normalMap,
    crimsonTex.roughnessMap,
    roofTex.map,
    roofTex.normalMap,
    roofTex.roughnessMap,
    reliefAtlas.map,
    reliefAtlas.normalMap,
    calligraphyTex
  ];

  return {
    kvcWeatheredCrimsonMat,
    kvcAgedTerracottaMat,
    vanMieuReliefAtlasMat,
    vanMieuCalligraphyMat,
    sanctuaryCrimsonLacquerMat,
    sanctuaryCarvedGoldMat,
    allMaterials,
    allTextures
  };
}
