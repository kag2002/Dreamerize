import * as THREE from 'three';

/**
 * Ultra-Lean SINGLE-MATERIAL Museum PBR & Calligraphic Master Atlas for
 * Core Hanoi Heritage Icons:
 *   - Chùa Một Cột (Liên Hoa Đài, Hồ Linh Chiểu & Chính Điện Tam Bảo Chùa Diên Hựu)
 *   - Hồ Hoàn Kiếm (Tháp Rùa, Cầu Thê Húc, Đắc Nguyệt Lâu, Trấn Ba Đình, Tháp Bút & Đài Nghiên)
 *
 * Packs ALL 16 architectural/relief textures + ALL 8 crisp 2K plaques/inscriptions into
 * ONE single 2048×3072 GPU material (`hanoiIconsMasterAtlasMat` + Sobel `normalMap` `flipY = true`)!
 */

export interface HanoiIconsMaterialPack {
  hanoiIconsMasterAtlasMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const HANOI_ICONS_RELIEF_UV = {
  // Row 0 (y: 0..512 -> v: 0.8333..1.0)
  monolithicStoneDrum: [0.0, 0.8333, 0.25, 1.0],
  agedIronwood: [0.25, 0.8333, 0.5, 1.0],
  ngoiMuiHaiMossy: [0.5, 0.8333, 0.75, 1.0],
  weatheredLimeStucco: [0.75, 0.8333, 1.0, 1.0],
  // Row 1 (y: 512..1024 -> v: 0.6667..0.8333)
  hoaChanhGreenTile: [0.0, 0.6667, 0.25, 0.8333],
  batTrangFloor: [0.25, 0.6667, 0.5, 0.8333],
  tamBaoGoldLacquer: [0.5, 0.6667, 0.75, 0.8333],
  cuaVongFiligree: [0.75, 0.6667, 1.0, 0.8333],
  // Row 2 (y: 1024..1536 -> v: 0.5..0.6667)
  thapRuaMossyStucco: [0.0, 0.5, 0.25, 0.6667],
  thapRuaOchrePebble: [0.25, 0.5, 0.5, 0.6667],
  vermilionBridgeWood: [0.5, 0.5, 0.75, 0.6667],
  dacNguyetTurquoise: [0.75, 0.5, 1.0, 0.6667],
  // Row 3 (y: 1536..2048 -> v: 0.3333..0.5)
  thapButSandstone: [0.0, 0.3333, 0.25, 0.5],
  emeraldLakeWater: [0.25, 0.3333, 0.5, 0.5],
  lushIsletGrass: [0.5, 0.3333, 0.75, 0.5],
  darkTimberSoffit: [0.75, 0.3333, 1.0, 0.5]
} as const;

export type HanoiIconsReliefKey = keyof typeof HANOI_ICONS_RELIEF_UV;

export const HANOI_ICONS_ART_UV = {
  // Row P0 (y: 2048..2560 -> v: 0.1667..0.3333)
  lienHoaDaiPlaque: [0.0, 0.1667, 0.333, 0.3333],
  dienHuuHoanhPhi: [0.333, 0.1667, 0.666, 0.3333],
  dacNguyetLauPlaque: [0.666, 0.1667, 1.0, 0.3333],
  // Row P1 (y: 2560..2816 -> v: 0.0833..0.1667)
  thapRuaPlaque: [0.0, 0.0833, 0.333, 0.1667],
  tranBaDinhPlaque: [0.333, 0.0833, 0.666, 0.1667],
  taThanhThienCartouche: [0.666, 0.0833, 1.0, 0.1667],
  // Row P2 (y: 2816..3072 -> v: 0.0..0.0833)
  cauDoiPair: [0.0, 0.0, 0.5, 0.0833],
  silkPhuonBanner: [0.5, 0.0, 1.0, 0.0833]
} as const;

export type HanoiIconsArtKey = keyof typeof HANOI_ICONS_ART_UV;

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

function hash2i(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
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
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.flipY = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = getAniso(renderer);
  tex.needsUpdate = true;
  return tex;
}

function wrapCanvasTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  renderer?: THREE.WebGLRenderer
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = getAniso(renderer);
  tex.needsUpdate = true;
  return tex;
}

function heightCanvasToNormalTex(
  hCanvas: HTMLCanvasElement,
  strength: number,
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const w = hCanvas.width;
  const h = hCanvas.height;
  const ctx = hCanvas.getContext('2d');
  if (!ctx) {
    return finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer);
  }
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    return src[(cy * w + cx) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const idx = (y * w + x) * 4;
      out[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }
  return finalizeDataTex(out, w, h, false, renderer);
}

function drawWeatherSpeckles(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  count: number,
  seed: number,
  colorA: string,
  colorB: string,
  minR = 1,
  maxR = 4
): void {
  for (let i = 0; i < count; i++) {
    const px = ox + hash2i(i, 1, seed) * w;
    const py = oy + hash2i(i, 2, seed) * h;
    const r = minR + hash2i(i, 3, seed) * (maxR - minR);
    ctx.fillStyle = hash2i(i, 4, seed) > 0.5 ? colorA : colorB;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    hCtx.fillStyle = hash2i(i, 5, seed) > 0.5 ? 'rgba(110,110,110,0.28)' : 'rgba(155,155,155,0.22)';
    hCtx.beginPath();
    hCtx.arc(px, py, r * 0.9, 0, Math.PI * 2);
    hCtx.fill();
  }
}

function drawTile0MonolithicStoneDrum(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#8d8c83');
  g.addColorStop(0.55, '#7a7b70');
  g.addColorStop(0.85, '#596050');
  g.addColorStop(1, '#3d4838');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  // Subtle horizontal joint between two monolithic stone drums
  ctx.fillStyle = 'rgba(35, 36, 30, 0.55)';
  ctx.fillRect(ox, oy + s * 0.49, s, 6);
  hCtx.fillStyle = '#404040';
  hCtx.fillRect(ox, oy + s * 0.49, s, 6);

  // Vertical rainwater streaks & moss patches
  for (let i = 0; i < 42; i++) {
    const sx = ox + hash2i(i, 11, 101) * s;
    const sw = 4 + hash2i(i, 12, 101) * 14;
    const sh = s * (0.35 + hash2i(i, 13, 101) * 0.65);
    const sy = oy + hash2i(i, 14, 101) * (s - sh);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(42, 56, 36, 0.24)' : 'rgba(48, 48, 44, 0.20)';
    ctx.fillRect(sx, sy, sw, sh);
  }
  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 450, 102, 'rgba(54,64,46,0.28)', 'rgba(168,165,152,0.22)', 1, 5);
}

function drawTile1AgedIronwood(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#3c2519';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  for (let i = 0; i < 95; i++) {
    const x = ox + (i / 95) * s;
    const shade = Math.floor(hash2i(i, 3, 201) * 28);
    ctx.fillStyle = `rgb(${50 + shade}, ${30 + Math.floor(shade * 0.65)}, ${20 + Math.floor(shade * 0.45)})`;
    ctx.fillRect(x, oy, s / 95 + 1, s);
    const hVal = 115 + Math.floor(hash2i(i, 4, 201) * 32);
    hCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
    hCtx.fillRect(x, oy, s / 95 + 1, s);
  }
  // Fine dark wood-grain knots & cracks
  ctx.strokeStyle = 'rgba(22, 12, 8, 0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 36; i++) {
    const x = ox + hash2i(i, 7, 202) * s;
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.bezierCurveTo(x + 4, oy + s * 0.33, x - 4, oy + s * 0.66, x + 2, oy + s);
    ctx.stroke();
  }
}

function drawTile2NgoiMuiHaiMossy(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#4a2b20';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#555555';
  hCtx.fillRect(ox, oy, s, s);

  const cols = 10;
  const rows = 12;
  const cw = s / cols;
  const rh = s / rows;
  for (let r = 0; r < rows + 1; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = ox + (c + (r % 2) * 0.5) * cw;
      const cy = oy + r * rh;
      const n = hash2i(c + 5, r + 5, 301);
      const moss = hash2i(c + 15, r + 25, 302);
      const red = Math.floor(92 + n * 34 - (moss > 0.62 ? 28 : 0));
      const grn = Math.floor(48 + n * 18 + (moss > 0.62 ? 16 : 0));
      const blu = Math.floor(34 + n * 14 - (moss > 0.62 ? 8 : 0));
      ctx.fillStyle = `rgb(${red},${grn},${blu})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rh * 0.25);
      ctx.lineTo(cx + cw * 0.48, cy + rh * 0.45);
      ctx.quadraticCurveTo(cx, cy + rh * 1.15, cx - cw * 0.48, cy + rh * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(26, 18, 14, 0.72)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      hCtx.fillStyle = `rgb(${155 + Math.floor(n * 35)},${155 + Math.floor(n * 35)},${155 + Math.floor(n * 35)})`;
      hCtx.beginPath();
      hCtx.moveTo(cx, cy - rh * 0.2);
      hCtx.lineTo(cx + cw * 0.44, cy + rh * 0.42);
      hCtx.quadraticCurveTo(cx, cy + rh * 1.05, cx - cw * 0.44, cy + rh * 0.42);
      hCtx.closePath();
      hCtx.fill();
    }
  }
  // Subtle olive-moss patches along valleys
  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 260, 309, 'rgba(66,78,42,0.34)', 'rgba(38,34,26,0.28)', 2, 7);
}

function drawTile3WeatheredLimeStucco(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#dfc794');
  g.addColorStop(0.7, '#d3b67c');
  g.addColorStop(1, '#a99567');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#868686';
  hCtx.fillRect(ox, oy, s, s);

  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 420, 401, 'rgba(116,96,60,0.18)', 'rgba(240,224,185,0.18)', 2, 10);
  // Damp mossy waterline gradient near bottom
  for (let i = 0; i < 24; i++) {
    const sx = ox + hash2i(i, 1, 402) * s;
    const sw = 12 + hash2i(i, 2, 402) * 30;
    const sh = 35 + hash2i(i, 3, 402) * 85;
    ctx.fillStyle = 'rgba(72, 82, 54, 0.24)';
    ctx.fillRect(sx, oy + s - sh, sw, sh);
  }
}

function drawTile4HoaChanhGreenTile(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#1b3528';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#303030';
  hCtx.fillRect(ox, oy, s, s);

  const cells = 4;
  const cs = s / cells;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const x = ox + c * cs;
      const y = oy + r * cs;
      // Glazed emerald green ceramic frame
      ctx.strokeStyle = '#2d7a4f';
      ctx.lineWidth = 10;
      ctx.strokeRect(x + 6, y + 6, cs - 12, cs - 12);
      hCtx.strokeStyle = '#dcdcdc';
      hCtx.lineWidth = 10;
      hCtx.strokeRect(x + 6, y + 6, cs - 12, cs - 12);

      // Diamond hoa chanh motif inside
      const cx = x + cs * 0.5;
      const cy = y + cs * 0.5;
      ctx.strokeStyle = '#3c9963';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx, y + 14);
      ctx.lineTo(x + cs - 14, cy);
      ctx.lineTo(cx, y + cs - 14);
      ctx.lineTo(x + 14, cy);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#4bb376';
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.14, 0, Math.PI * 2);
      ctx.fill();

      hCtx.strokeStyle = '#e8e8e8';
      hCtx.lineWidth = 8;
      hCtx.beginPath();
      hCtx.moveTo(cx, y + 14);
      hCtx.lineTo(x + cs - 14, cy);
      hCtx.lineTo(cx, y + cs - 14);
      hCtx.lineTo(x + 14, cy);
      hCtx.closePath();
      hCtx.stroke();
    }
  }
}

function drawTile5BatTrangFloor(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#5c4636';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#484848';
  hCtx.fillRect(ox, oy, s, s);

  const n = 4;
  const ts = s / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = hash2i(c, r, 501);
      const red = Math.floor(136 + k * 26);
      const grn = Math.floor(62 + k * 18);
      const blu = Math.floor(42 + k * 14);
      ctx.fillStyle = `rgb(${red},${grn},${blu})`;
      ctx.fillRect(ox + c * ts + 4, oy + r * ts + 4, ts - 8, ts - 8);
      hCtx.fillStyle = '#c8c8c8';
      hCtx.fillRect(ox + c * ts + 4, oy + r * ts + 4, ts - 8, ts - 8);
    }
  }
  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 220, 502, 'rgba(65,35,24,0.20)', 'rgba(180,120,88,0.16)', 1, 5);
}

function drawTile6TamBaoGoldLacquer(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#7e1410';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#787878';
  hCtx.fillRect(ox, oy, s, s);

  // Double gilded imperial lacquer border
  ctx.strokeStyle = '#e5b842';
  ctx.lineWidth = 14;
  ctx.strokeRect(ox + 16, oy + 16, s - 32, s - 32);
  ctx.strokeStyle = '#f5d268';
  ctx.lineWidth = 5;
  ctx.strokeRect(ox + 36, oy + 36, s - 72, s - 72);

  hCtx.strokeStyle = '#e4e4e4';
  hCtx.lineWidth = 14;
  hCtx.strokeRect(ox + 16, oy + 16, s - 32, s - 32);

  // Central gilded lotus & dragon cloud medallion
  const cx = ox + s * 0.5;
  const cy = oy + s * 0.5;
  ctx.strokeStyle = '#e8bd4a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.27, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillStyle = '#efc655';
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * s * 0.14, cy + Math.sin(a) * s * 0.14, 24, 11, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f8da7c';
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();

  hCtx.fillStyle = '#efefef';
  hCtx.beginPath();
  hCtx.arc(cx, cy, s * 0.24, 0, Math.PI * 2);
  hCtx.fill();
}

function drawTile7CuaVongFiligree(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#470b08';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#444444';
  hCtx.fillRect(ox, oy, s, s);

  // Dense gilded filigree lattice & cloud-dragon arch curls
  ctx.strokeStyle = '#eab93d';
  ctx.lineWidth = 7;
  hCtx.strokeStyle = '#e6e6e6';
  hCtx.lineWidth = 7;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const cx = ox + (c + 0.5) * (s / 6);
      const cy = oy + (r + 0.5) * (s / 6);
      ctx.beginPath();
      ctx.arc(cx, cy, s / 15, 0, Math.PI * 2);
      ctx.stroke();
      hCtx.beginPath();
      hCtx.arc(cx, cy, s / 15, 0, Math.PI * 2);
      hCtx.stroke();
    }
  }
  // Ornate gilded scalloped apron curve
  ctx.strokeStyle = '#f7d56e';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(ox + 12, oy + s * 0.2);
  ctx.quadraticCurveTo(ox + s * 0.5, oy + s * 0.95, ox + s - 12, oy + s * 0.2);
  ctx.stroke();
}

function drawTile8ThapRuaMossyStucco(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  // Iconic ancient heavily weathered Tháp Rùa dark grey-ochre lime stucco
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#787162');
  g.addColorStop(0.45, '#8f856e');
  g.addColorStop(0.8, '#6e6858');
  g.addColorStop(1, '#504e42');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  // Tropical vertical rainwater streaks & black-green moss stains
  for (let i = 0; i < 55; i++) {
    const sx = ox + hash2i(i, 1, 801) * s;
    const sw = 5 + hash2i(i, 2, 801) * 18;
    const sh = s * (0.25 + hash2i(i, 3, 801) * 0.72);
    const sy = oy + hash2i(i, 4, 801) * (s - sh);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(42, 46, 34, 0.34)' : 'rgba(56, 52, 42, 0.26)';
    ctx.fillRect(sx, sy, sw, sh);
  }
  // Peeling ochre plaster patches
  for (let i = 0; i < 28; i++) {
    const px = ox + hash2i(i, 6, 802) * s;
    const py = oy + hash2i(i, 7, 802) * s;
    const rx = 10 + hash2i(i, 8, 802) * 28;
    const ry = 8 + hash2i(i, 9, 802) * 22;
    ctx.fillStyle = 'rgba(154, 136, 102, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    hCtx.fillStyle = 'rgba(165, 165, 165, 0.35)';
    hCtx.beginPath();
    hCtx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    hCtx.fill();
  }
  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 480, 803, 'rgba(38,44,30,0.34)', 'rgba(175,162,135,0.22)', 1, 5);
}

function drawTile9ThapRuaOchrePebble(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#9a845c';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#888888';
  hCtx.fillRect(ox, oy, s, s);

  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 600, 901, 'rgba(72,62,42,0.30)', 'rgba(195,172,126,0.28)', 1, 4);
  // Horizontal weathered cornice shadow bands
  ctx.fillStyle = 'rgba(54, 48, 36, 0.32)';
  ctx.fillRect(ox, oy + s * 0.16, s, 10);
  ctx.fillRect(ox, oy + s * 0.82, s, 12);
  hCtx.fillStyle = '#c8c8c8';
  hCtx.fillRect(ox, oy + s * 0.14, s, 10);
  hCtx.fillRect(ox, oy + s * 0.80, s, 12);
}

function drawTile10VermilionBridgeWood(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  // Vibrant Cầu Thê Húc vermilion-scarlet lacquer (#d92b1c)
  ctx.fillStyle = '#d92b1c';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#828282';
  hCtx.fillRect(ox, oy, s, s);

  for (let i = 0; i < 64; i++) {
    const x = ox + (i / 64) * s;
    const d = Math.floor((hash2i(i, 1, 1001) - 0.5) * 26);
    ctx.fillStyle = `rgb(${clampByte(217 + d)}, ${clampByte(43 + d * 0.4)}, ${clampByte(28 + d * 0.3)})`;
    ctx.fillRect(x, oy, s / 64 + 1, s);
    const hv = 122 + Math.floor(hash2i(i, 2, 1001) * 20);
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(x, oy, s / 64 + 1, s);
  }
  // Subtle plank seam lines
  ctx.strokeStyle = 'rgba(110, 16, 10, 0.40)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const x = ox + (i / 8) * s;
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + s);
    ctx.stroke();
  }
}

function drawTile11DacNguyetTurquoise(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  // Pale turquoise-celadon lime relief panel with carved cloud/dragon scrolls
  ctx.fillStyle = '#7ba89e';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  ctx.strokeStyle = '#d6e7df';
  ctx.lineWidth = 10;
  ctx.strokeRect(ox + 18, oy + 18, s - 36, s - 36);
  hCtx.strokeStyle = '#dedede';
  hCtx.lineWidth = 10;
  hCtx.strokeRect(ox + 18, oy + 18, s - 36, s - 36);

  // Ornamental relief cloud curls in corners
  const corners = [
    [ox + 72, oy + 72],
    [ox + s - 72, oy + 72],
    [ox + 72, oy + s - 72],
    [ox + s - 72, oy + s - 72]
  ];
  for (const [cx, cy] of corners) {
    ctx.strokeStyle = '#b9d4ca';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 1.65);
    ctx.stroke();
    hCtx.strokeStyle = '#d6d6d6';
    hCtx.lineWidth = 6;
    hCtx.beginPath();
    hCtx.arc(cx, cy, 32, 0, Math.PI * 1.65);
    hCtx.stroke();
  }
  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 260, 1101, 'rgba(65,94,86,0.20)', 'rgba(218,236,228,0.18)', 1, 5);
}

function drawTile12ThapButSandstone(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#4c4c47';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#4a4a4a';
  hCtx.fillRect(ox, oy, s, s);

  const rows = 8;
  const rh = s / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 4;
    const cw = s / cols;
    const off = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const n = hash2i(c + 4, r + 4, 1201);
      const moss = hash2i(c + 12, r + 18, 1202);
      const base = Math.floor(92 + n * 38);
      ctx.fillStyle =
        moss > 0.68
          ? `rgb(${base - 14}, ${base + 4}, ${base - 18})`
          : `rgb(${base + 4}, ${base + 2}, ${base - 4})`;
      ctx.fillRect(ox + c * cw + off + 3, oy + r * rh + 3, cw - 6, rh - 6);
      hCtx.fillStyle = `rgb(${150 + Math.floor(n * 45)},${150 + Math.floor(n * 45)},${150 + Math.floor(n * 45)})`;
      hCtx.fillRect(ox + c * cw + off + 3, oy + r * rh + 3, cw - 6, rh - 6);
    }
  }
  drawWeatherSpeckles(ctx, hCtx, ox, oy, s, s, 320, 1203, 'rgba(42,56,34,0.30)', 'rgba(162,158,144,0.20)', 1, 5);
}

function drawTile13EmeraldLakeWater(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  const g = ctx.createLinearGradient(ox, oy, ox + s, oy + s);
  g.addColorStop(0, '#164b42');
  g.addColorStop(0.5, '#1d6153');
  g.addColorStop(1, '#14433a');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  // Subtle emerald-jade water ripples
  for (let i = 0; i < 65; i++) {
    const rx = ox + hash2i(i, 1, 1301) * s;
    const ry = oy + hash2i(i, 2, 1301) * s;
    const rw = 24 + hash2i(i, 3, 1301) * 65;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(92, 168, 148, 0.22)' : 'rgba(14, 48, 42, 0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo(rx + rw * 0.5, ry - 4, rx + rw, ry);
    ctx.stroke();

    hCtx.strokeStyle = i % 2 === 0 ? 'rgba(155,155,155,0.25)' : 'rgba(105,105,105,0.25)';
    hCtx.lineWidth = 2;
    hCtx.beginPath();
    hCtx.moveTo(rx, ry);
    hCtx.quadraticCurveTo(rx + rw * 0.5, ry - 4, rx + rw, ry);
    hCtx.stroke();
  }
}

function drawTile14LushIsletGrass(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#386d2e';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  for (let i = 0; i < 700; i++) {
    const gx = ox + hash2i(i, 1, 1401) * s;
    const gy = oy + hash2i(i, 2, 1401) * s;
    const gh = 6 + hash2i(i, 3, 1401) * 14;
    const lean = (hash2i(i, 4, 1401) - 0.5) * 6;
    const v = hash2i(i, 5, 1401);
    ctx.strokeStyle = v > 0.6 ? '#538e3d' : v > 0.25 ? '#3e7731' : '#295322';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + lean, gy - gh);
    ctx.stroke();
  }
}

function drawTile15DarkTimberSoffit(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number
): void {
  ctx.fillStyle = '#261710';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#606060';
  hCtx.fillRect(ox, oy, s, s);

  // Dark exposed rafters (rui mè gỗ lim)
  const rafters = 12;
  const rw = s / rafters;
  for (let i = 0; i < rafters; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#3a2419' : '#331f15';
    ctx.fillRect(ox + i * rw + 4, oy, rw - 8, s);
    hCtx.fillStyle = '#b8b8b8';
    hCtx.fillRect(ox + i * rw + 4, oy, rw - 8, s);
  }
  // Horizontal purlin cross-beams
  for (let j = 0; j < 4; j++) {
    const py = oy + (j + 0.5) * (s / 4) - 8;
    ctx.fillStyle = '#472c1e';
    ctx.fillRect(ox, py, s, 16);
    hCtx.fillStyle = '#d8d8d8';
    hCtx.fillRect(ox, py, s, 16);
  }
}

function drawImperialPlaque(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  bgColor: string,
  borderColor: string,
  textColor: string,
  mainText: string,
  subText?: string
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(ox, oy, w, h);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = Math.max(8, Math.round(h * 0.04));
  ctx.strokeRect(ox + 16, oy + 16, w - 32, h - 32);
  ctx.lineWidth = 4;
  ctx.strokeRect(ox + 34, oy + 34, w - 68, h - 68);

  // Decorative corner filigree dots
  ctx.fillStyle = borderColor;
  for (const [cx, cy] of [
    [ox + 52, oy + 52],
    [ox + w - 52, oy + 52],
    [ox + 52, oy + h - 52],
    [ox + w - 52, oy + h - 52]
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mainFontPx = Math.round(h * (subText ? 0.27 : 0.36));
  ctx.font = `bold ${mainFontPx}px "Noto Serif", "Times New Roman", serif`;
  ctx.fillText(mainText, ox + w * 0.5, oy + h * (subText ? 0.42 : 0.52), w - 96);

  if (subText) {
    ctx.font = `bold ${Math.round(h * 0.13)}px "Noto Serif", "Times New Roman", serif`;
    ctx.fillText(subText, ox + w * 0.5, oy + h * 0.76, w - 96);
  }
}

function drawVerticalBoard(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  bgColor: string,
  borderColor: string,
  textColor: string,
  chars: string[]
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(ox, oy, w, h);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(ox + 12, oy + 12, w - 24, h - 24);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Drawn horizontally across the wide strip, or vertically depending on aspect
  if (w > h * 1.5) {
    const step = (w - 80) / Math.max(1, chars.length);
    ctx.font = `bold ${Math.round(h * 0.48)}px "Noto Serif", "Times New Roman", serif`;
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, ox + 40 + step * (idx + 0.5), oy + h * 0.52);
    });
  } else {
    const step = (h - 60) / Math.max(1, chars.length);
    ctx.font = `bold ${Math.round(step * 0.72)}px "Noto Serif", "Times New Roman", serif`;
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, ox + w * 0.5, oy + 30 + step * (idx + 0.5));
    });
  }
}

export function createHanoiIconsMaterialPack(renderer?: THREE.WebGLRenderer): HanoiIconsMaterialPack {
  const allMaterials: THREE.Material[] = [];
  const allTextures: THREE.Texture[] = [];

  if (isHeadlessRenderer(renderer)) {
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xbba88c,
      roughness: 0.78,
      metalness: 0.06
    });
    fallbackMat.name = 'hanoiIconsMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      hanoiIconsMasterAtlasMat: fallbackMat,
      allMaterials,
      allTextures
    };
  }

  const W = 2048;
  const H = 3072;
  const S = 512;
  const colorTarget = makeCanvas(W, H);
  const heightTarget = makeCanvas(W, H);

  if (!colorTarget || !heightTarget) {
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xbba88c,
      roughness: 0.78,
      metalness: 0.06
    });
    fallbackMat.name = 'hanoiIconsMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      hanoiIconsMasterAtlasMat: fallbackMat,
      allMaterials,
      allTextures
    };
  }

  const { canvas: cCanvas, ctx } = colorTarget;
  const { canvas: hCanvas, ctx: hCtx } = heightTarget;

  // Fill neutral base for entire atlas (ensures bottom artwork region has flat neutral normal)
  ctx.fillStyle = '#7e7668';
  ctx.fillRect(0, 0, W, H);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, W, H);

  // Row 0 (y: 0..512)
  drawTile0MonolithicStoneDrum(ctx, hCtx, 0, 0, S);
  drawTile1AgedIronwood(ctx, hCtx, S, 0, S);
  drawTile2NgoiMuiHaiMossy(ctx, hCtx, S * 2, 0, S);
  drawTile3WeatheredLimeStucco(ctx, hCtx, S * 3, 0, S);

  // Row 1 (y: 512..1024)
  drawTile4HoaChanhGreenTile(ctx, hCtx, 0, S, S);
  drawTile5BatTrangFloor(ctx, hCtx, S, S, S);
  drawTile6TamBaoGoldLacquer(ctx, hCtx, S * 2, S, S);
  drawTile7CuaVongFiligree(ctx, hCtx, S * 3, S, S);

  // Row 2 (y: 1024..1536)
  drawTile8ThapRuaMossyStucco(ctx, hCtx, 0, S * 2, S);
  drawTile9ThapRuaOchrePebble(ctx, hCtx, S, S * 2, S);
  drawTile10VermilionBridgeWood(ctx, hCtx, S * 2, S * 2, S);
  drawTile11DacNguyetTurquoise(ctx, hCtx, S * 3, S * 2, S);

  // Row 3 (y: 1536..2048)
  drawTile12ThapButSandstone(ctx, hCtx, 0, S * 3, S);
  drawTile13EmeraldLakeWater(ctx, hCtx, S, S * 3, S);
  drawTile14LushIsletGrass(ctx, hCtx, S * 2, S * 3, S);
  drawTile15DarkTimberSoffit(ctx, hCtx, S * 3, S * 3, S);

  // Bottom 1/3 Calligraphic Plaques & Artworks (y: 2048..3072)
  // Row P0 (y: 2048..2560)
  const p0w = Math.floor(W / 3);
  drawImperialPlaque(ctx, 0, 2048, p0w, 512, '#2d0c09', '#eab93d', '#f7d874', '蓮  花  臺', 'LIÊN HOA ĐÀI');
  drawImperialPlaque(ctx, p0w, 2048, p0w, 512, '#6b100c', '#ecc048', '#fae088', '大 雄 寶 殿', 'CHÙA DIÊN HỰU');
  drawImperialPlaque(ctx, p0w * 2, 2048, W - p0w * 2, 512, '#75120e', '#efc24a', '#fbe18c', '得  月  樓', 'ĐẮC NGUYỆT LÂU');

  // Row P1 (y: 2560..2816)
  drawImperialPlaque(ctx, 0, 2560, p0w, 256, '#756f60', '#48443a', '#1e1d18', '龜  塔');
  drawImperialPlaque(ctx, p0w, 2560, p0w, 256, '#78130e', '#efc24a', '#fbe088', '鎮  波  亭');
  // Tả Thanh Thiên drawn horizontally across wide strip; UV rotated 90deg on vertical cartouche!
  drawVerticalBoard(ctx, p0w * 2, 2560, W - p0w * 2, 256, '#626159', '#3d3d37', '#1a1a16', ['寫', '青', '天']);

  // Row P2 (y: 2816..3072)
  drawVerticalBoard(ctx, 0, 2816, 1024, 256, '#68100c', '#e6b83f', '#f8db7a', ['延', '祐', '蓮', '臺', '福', '壽', '長']);
  // Buddhist silk phướn banner (crimson & saffron with lotus medallion)
  const bx = 1024;
  const by = 2816;
  ctx.fillStyle = '#a81c16';
  ctx.fillRect(bx, by, 1024, 256);
  ctx.fillStyle = '#e5a82e';
  ctx.fillRect(bx + 24, by + 24, 976, 208);
  ctx.fillStyle = '#8b1410';
  ctx.fillRect(bx + 42, by + 42, 940, 172);
  ctx.fillStyle = '#f8d86c';
  for (let i = 0; i < 4; i++) {
    const cx = bx + 160 + i * 235;
    ctx.beginPath();
    ctx.arc(cx, by + 128, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b1410';
    ctx.beginPath();
    ctx.arc(cx, by + 128, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8d86c';
  }

  const mapTex = wrapCanvasTex(cCanvas, true, renderer);
  const normalTex = heightCanvasToNormalTex(hCanvas, 2.2, renderer);
  allTextures.push(mapTex, normalTex);

  const hanoiIconsMasterAtlasMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.72,
    metalness: 0.08
  });
  hanoiIconsMasterAtlasMat.name = 'hanoiIconsMasterAtlasMat';
  allMaterials.push(hanoiIconsMasterAtlasMat);

  return {
    hanoiIconsMasterAtlasMat,
    allMaterials,
    allTextures
  };
}
