import * as THREE from 'three';

/**
 * Ultra-Lean SINGLE-MATERIAL Museum PBR & Artwork Master Atlas for
 * Southern Vietnam & Mekong Delta Heritage Precinct:
 *   - Chợ Bến Thành (TP. Hồ Chí Minh: Iconic 3-Faced Clock Tower, 1952 Biên Hòa Ceramic Reliefs,
 *     Quách Thị Trang Crosswalk Plaza & Bustling Vaulted Interior Concourse Stalls)
 *   - Chợ Nổi Cái Răng (Cần Thơ: Painted Ghe Bầu Fleet with Folk Bow Eyes, Bamboo Cây Bẹo Poles,
 *     Hủ Tiếu / Coffee Retail Sampans, Covered Timber River Wharf & Mekong Stilt Shophouses)
 *
 * Packs ALL 16 architectural/market PBR tiles + ALL 4 crisp 2K clock/relief/signage artworks into
 * ONE single 2048×3072 GPU material (`benThanhCaiRangMasterAtlasMat` + Sobel `normalMap` `flipY = true`)!
 */

export interface BenThanhCaiRangMaterialPack {
  benThanhCaiRangMasterAtlasMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const BTCR_RELIEF_UV = {
  // Row 0 (y: 0..512 -> v: 0.8333..1.0)
  benThanhCreamStucco: [0.0, 0.8333, 0.25, 1.0],
  benThanhGreenShutter: [0.25, 0.8333, 0.5, 1.0],
  benThanhRollShutter: [0.5, 0.8333, 0.75, 1.0],
  benThanhTerracottaRoof: [0.75, 0.8333, 1.0, 1.0],
  // Row 1 (y: 512..1024 -> v: 0.6667..0.8333)
  benThanhConcourseTile: [0.0, 0.6667, 0.25, 0.8333],
  benThanhSilkTextile: [0.25, 0.6667, 0.5, 0.8333],
  benThanhSpiceDryGoods: [0.5, 0.6667, 0.75, 0.8333],
  saigonCrosswalkAsphalt: [0.75, 0.6667, 1.0, 0.8333],
  // Row 2 (y: 1024..1536 -> v: 0.5..0.6667)
  gheBauPlankedHull: [0.0, 0.5, 0.25, 0.6667],
  gheBauPaintedProw: [0.25, 0.5, 0.5, 0.6667],
  corrugatedTinBlue: [0.5, 0.5, 0.75, 0.6667],
  corrugatedTinRust: [0.75, 0.5, 1.0, 0.6667],
  // Row 3 (y: 1536..2048 -> v: 0.3333..0.5)
  wharfWeatheredPlank: [0.0, 0.3333, 0.25, 0.5],
  wovenBambooBasket: [0.25, 0.3333, 0.5, 0.5],
  watermelonStripedSkin: [0.5, 0.3333, 0.75, 0.5],
  mekongShophouseWall: [0.75, 0.3333, 1.0, 0.5]
} as const;

export type BtcrReliefKey = keyof typeof BTCR_RELIEF_UV;

export const BTCR_ART_UV = {
  // Row P0 (y: 2048..2560 -> v: 0.1667..0.3333)
  benThanhClockAndTitle: [0.0, 0.1667, 0.5, 0.3333],
  bienHoaCeramicReliefs: [0.5, 0.1667, 1.0, 0.3333],
  // Row P1 (y: 2560..3072 -> v: 0.0..0.1667)
  benThanhStallSigns: [0.0, 0.0, 0.5, 0.1667],
  caiRangWharfArchSign: [0.5, 0.0, 1.0, 0.1667]
} as const;

export type BtcrArtKey = keyof typeof BTCR_ART_UV;

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

function drawSpeckles(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number,
  count: number,
  seed: number,
  colA: string,
  colB: string,
  minR = 1,
  maxR = 4
): void {
  for (let i = 0; i < count; i++) {
    const px = ox + hash2i(i, 1, seed) * s;
    const py = oy + hash2i(i, 2, seed) * s;
    const r = minR + hash2i(i, 3, seed) * (maxR - minR);
    ctx.fillStyle = hash2i(i, 4, seed) > 0.5 ? colA : colB;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    hCtx.fillStyle = hash2i(i, 5, seed) > 0.5 ? 'rgba(105,105,105,0.22)' : 'rgba(155,155,155,0.20)';
    hCtx.beginPath();
    hCtx.arc(px, py, r, 0, Math.PI * 2);
    hCtx.fill();
  }
}

function drawTile0BenThanhCreamStucco(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#efe1c2');
  g.addColorStop(0.75, '#e5d1a7');
  g.addColorStop(1, '#cbb589');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  // Subtle horizontal French colonial rustication reveal lines
  for (let r = 1; r < 8; r++) {
    const ry = oy + (r / 8) * s;
    ctx.fillStyle = 'rgba(130, 108, 72, 0.22)';
    ctx.fillRect(ox, ry, s, 3);
    hCtx.fillStyle = '#606060';
    hCtx.fillRect(ox, ry, s, 3);
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 420, 101, 'rgba(148,125,84,0.16)', 'rgba(255,248,230,0.18)', 1, 4);
}

function drawTile1BenThanhGreenShutter(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Heritage dark emerald-green louvered wooden arch shutters (#1e5434) with cream frame (BT-21)
  ctx.fillStyle = '#efe0be';
  ctx.fillRect(ox, oy, s, s);
  ctx.fillStyle = '#1d4f31';
  ctx.fillRect(ox + 28, oy + 28, s - 56, s - 56);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  // Horizontal wooden louver slats
  const slats = 22;
  const sh = (s - 72) / slats;
  for (let i = 0; i < slats; i++) {
    const sy = oy + 36 + i * sh;
    ctx.fillStyle = i % 2 === 0 ? '#276841' : '#143b23';
    ctx.fillRect(ox + 38, sy, s - 76, sh - 2);
    hCtx.fillStyle = i % 2 === 0 ? '#c4c4c4' : '#4a4a4a';
    hCtx.fillRect(ox + 38, sy, s - 76, sh - 2);
  }
  // Center vertical mullion
  ctx.fillStyle = '#184228';
  ctx.fillRect(ox + s * 0.5 - 8, oy + 28, 16, s - 56);
}

function drawTile2BenThanhRollShutter(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#8c9298';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  const ribs = 28;
  const rh = s / ribs;
  for (let i = 0; i < ribs; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#b0b6bc' : '#5e646a';
    ctx.fillRect(ox + 16, oy + i * rh, s - 32, rh - 1);
    hCtx.fillStyle = i % 2 === 0 ? '#d8d8d8' : '#484848';
    hCtx.fillRect(ox + 16, oy + i * rh, s - 32, rh - 1);
  }
}

function drawTile3BenThanhTerracottaRoof(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#9e3e26';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(ox, oy, s, s);
  const cols = 16;
  const rows = 10;
  const cw = s / cols;
  const rh = s / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = hash2i(c, r, 301);
      ctx.fillStyle = `rgb(${156 + Math.floor(k * 36)}, ${58 + Math.floor(k * 20)}, ${36 + Math.floor(k * 14)})`;
      ctx.fillRect(ox + c * cw + 2, oy + r * rh + 2, cw - 4, rh - 3);
      hCtx.fillStyle = '#cecece';
      hCtx.fillRect(ox + c * cw + 2, oy + r * rh + 2, cw - 4, rh - 3);
    }
  }
}

function drawTile4BenThanhConcourseTile(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // 35x35cm warm stone-beige glazed ceramic floor tiles with dark grout grid (BI-12..14)
  ctx.fillStyle = '#4e433c';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#444444';
  hCtx.fillRect(ox, oy, s, s);
  const n = 8;
  const ts = s / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = hash2i(c, r, 401);
      const base = 178 + Math.floor(k * 20);
      ctx.fillStyle = `rgb(${base}, ${base - 14}, ${base - 28})`;
      ctx.fillRect(ox + c * ts + 2, oy + r * ts + 2, ts - 4, ts - 4);
      hCtx.fillStyle = '#c8c8c8';
      hCtx.fillRect(ox + c * ts + 2, oy + r * ts + 2, ts - 4, ts - 4);
    }
  }
}

function drawTile5BenThanhSilkTextile(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Draped multi-color silk bolts & embroidered áo dài fabrics (BI-24)
  const colors = ['#c9243f', '#e8a825', '#1d7874', '#8e3596', '#d95326', '#2660a4', '#e5c453', '#b82968'];
  const cols = 8;
  const cw = s / cols;
  for (let c = 0; c < cols; c++) {
    ctx.fillStyle = colors[c % colors.length];
    ctx.fillRect(ox + c * cw, oy, cw, s);
    // Golden floral brocade motif dots
    ctx.fillStyle = 'rgba(255, 232, 148, 0.55)';
    for (let r = 0; r < 10; r++) {
      ctx.beginPath();
      ctx.arc(ox + (c + 0.5) * cw, oy + (r + 0.5) * (s / 10), 9, 0, Math.PI * 2);
      ctx.fill();
    }
    hCtx.fillStyle = c % 2 === 0 ? '#b8b8b8' : '#787878';
    hCtx.fillRect(ox + c * cw, oy, cw, s);
  }
}

function drawTile6BenThanhSpiceDryGoods(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#4a2e1b';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#686868';
  hCtx.fillRect(ox, oy, s, s);
  const spiceColors = ['#d9381e', '#e8a317', '#6b8e23', '#c85a32', '#f2c641', '#8b261d'];
  const rows = 4;
  const cols = 4;
  const rw = s / cols;
  const rh = s / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = spiceColors[(r * 3 + c) % spiceColors.length];
      ctx.beginPath();
      ctx.arc(ox + (c + 0.5) * rw, oy + (r + 0.5) * rh, rw * 0.38, 0, Math.PI * 2);
      ctx.fill();
      hCtx.fillStyle = '#dadada';
      hCtx.beginPath();
      ctx.arc(ox + (c + 0.5) * rw, oy + (r + 0.5) * rh, rw * 0.36, 0, Math.PI * 2);
      hCtx.fill();
    }
  }
}

function drawTile7SaigonCrosswalkAsphalt(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#383b40';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  drawSpeckles(ctx, hCtx, ox, oy, s, 600, 701, 'rgba(28,30,34,0.32)', 'rgba(82,86,92,0.28)', 1, 3.5);
  // White zebra pedestrian crosswalk stripes across center
  ctx.fillStyle = 'rgba(238, 240, 236, 0.88)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(ox + 36, oy + 42 + i * 76, s - 72, 38);
  }
}

function drawTile8GheBauPlankedHull(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#4e2f1d';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#787878';
  hCtx.fillRect(ox, oy, s, s);
  const planks = 12;
  const ph = s / planks;
  for (let i = 0; i < planks; i++) {
    const k = hash2i(i, 1, 801);
    ctx.fillStyle = `rgb(${84 + Math.floor(k * 32)}, ${52 + Math.floor(k * 20)}, ${32 + Math.floor(k * 14)})`;
    ctx.fillRect(ox, oy + i * ph + 2, s, ph - 4);
    hCtx.fillStyle = '#c2c2c2';
    hCtx.fillRect(ox, oy + i * ph + 2, s, ph - 4);
  }
  // White waterline trim stripe & dark tarred bottom
  ctx.fillStyle = '#e8ece6';
  ctx.fillRect(ox, oy + s * 0.74, s, 14);
  ctx.fillStyle = '#241810';
  ctx.fillRect(ox, oy + s * 0.78, s, s * 0.22);
}

function drawTile9GheBauPaintedProw(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Bright red & green Mekong Ghe Bầu painted prow with large expressive black-and-white folk bow eye (mắt thuyền! CR-04..05)
  ctx.fillStyle = '#c8281c';
  ctx.fillRect(ox, oy, s, s);
  ctx.fillStyle = '#1b6e44';
  ctx.fillRect(ox, oy, s, s * 0.22);
  ctx.fillStyle = '#f2d03b';
  ctx.fillRect(ox, oy + s * 0.22, s, 14);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  // Expressive almond-shaped white sclera & black pupil bow eye
  const cx = ox + s * 0.5;
  const cy = oy + s * 0.58;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 135, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#161616';
  ctx.stroke();

  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(cx + 12, cy, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 26, cy - 14, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawTileCorrugated(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number, colA: string, colB: string): void {
  const ribs = 26;
  const rw = s / ribs;
  for (let i = 0; i < ribs; i++) {
    ctx.fillStyle = i % 2 === 0 ? colA : colB;
    ctx.fillRect(ox + i * rw, oy, rw, s);
    hCtx.fillStyle = i % 2 === 0 ? '#d8d8d8' : '#4a4a4a';
    hCtx.fillRect(ox + i * rw, oy, rw, s);
  }
}

function drawTile12WharfWeatheredPlank(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Distinct 16cm weathered timber deck planks with dark seams (ZERO wavy zebra stripes! CW-01)
  ctx.fillStyle = '#281e16';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#383838';
  hCtx.fillRect(ox, oy, s, s);
  const planks = 12;
  const ph = s / planks;
  for (let i = 0; i < planks; i++) {
    const k = hash2i(i, 2, 1201);
    ctx.fillStyle = `rgb(${112 + Math.floor(k * 28)}, ${88 + Math.floor(k * 22)}, ${66 + Math.floor(k * 18)})`;
    ctx.fillRect(ox, oy + i * ph + 3, s, ph - 5);
    hCtx.fillStyle = '#c8c8c8';
    hCtx.fillRect(ox, oy + i * ph + 3, s, ph - 5);
  }
}

function drawTile13WovenBambooBasket(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#9e7a46';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(ox, oy, s, s);
  const step = 16;
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const alt = ((x / step + y / step) & 1) === 0;
      ctx.fillStyle = alt ? '#c8a266' : '#8c6836';
      ctx.fillRect(ox + x + 1, oy + y + 1, step - 2, step - 2);
      hCtx.fillStyle = alt ? '#d2d2d2' : '#585858';
      hCtx.fillRect(ox + x + 1, oy + y + 1, step - 2, step - 2);
    }
  }
}

function drawTile14WatermelonStriped(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#286e2c';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  const stripes = 12;
  const sw = s / stripes;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = '#143d18';
      ctx.fillRect(ox + i * sw + 4, oy, sw * 0.55, s);
    }
  }
}

function drawTile15MekongShophouseWall(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#e5d4a8';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  // Blue-and-yellow striped lower awning band & shuttered window
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2468a2' : '#f2d45c';
    ctx.fillRect(ox + i * (s / 16), oy + s * 0.65, s / 16, s * 0.14);
  }
  ctx.fillStyle = '#244e38';
  ctx.fillRect(ox + s * 0.25, oy + s * 0.18, s * 0.5, s * 0.36);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(ox + s * 0.25, oy + s * 0.18, s * 0.5, s * 0.36);
}

function drawBenThanhClockAndTitleArt(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number): void {
  // Left half (512x512): Circular clock dial with turquoise 12-segment ring, numerals 1..12 & royal-blue hands (BT-09..10)
  ctx.fillStyle = '#efe0be';
  ctx.fillRect(ox, oy, w, h);

  const cx = ox + 256;
  const cy = oy + 256;
  // Stepped cream outer bezel
  ctx.fillStyle = '#d8c49c';
  ctx.beginPath();
  ctx.arc(cx, cy, 232, 0, Math.PI * 2);
  ctx.fill();
  // Iconic sky-blue / turquoise 12-segment numeral ring
  ctx.fillStyle = '#5bb8c4';
  ctx.beginPath();
  ctx.arc(cx, cy, 206, 0, Math.PI * 2);
  ctx.fill();
  // Off-white inner clock face
  ctx.fillStyle = '#f8f5ec';
  ctx.beginPath();
  ctx.arc(cx, cy, 148, 0, Math.PI * 2);
  ctx.fill();

  // Radial white dividers & bold Arabic numerals 1..12
  ctx.strokeStyle = '#f8f5ec';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#12263a';
  ctx.font = 'bold 34px "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2 - Math.PI * 0.5;
    const da = a + Math.PI / 12;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(da) * 148, cy + Math.sin(da) * 148);
    ctx.lineTo(cx + Math.cos(da) * 206, cy + Math.sin(da) * 206);
    ctx.stroke();
    ctx.fillText(String(n), cx + Math.cos(a) * 176, cy + Math.sin(a) * 176);
  }
  // Royal-blue hour & minute hands (extra bold for long-distance panoramic visibility!)
  ctx.strokeStyle = '#0d264c';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 76, cy - 68);
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 72, cy - 114);
  ctx.stroke();
  ctx.fillStyle = '#0d264c';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();

  // Right half (ox+512..ox+1024): 3 green louvered arch windows + bold black "CHỢ BẾN THÀNH" relief plaque! (BT-11)
  const rx = ox + 512;
  for (let i = 0; i < 3; i++) {
    const wx = rx + 58 + i * 142;
    const wy = oy + 42;
    ctx.fillStyle = '#1b4f30';
    ctx.beginPath();
    ctx.arc(wx + 52, wy + 52, 52, Math.PI, Math.PI * 2);
    ctx.lineTo(wx + 104, wy + 225);
    ctx.lineTo(wx, wy + 225);
    ctx.closePath();
    ctx.fill();
  }
  // Bold black "CHỢ BẾN THÀNH" relief lettering banner across lower half
  ctx.fillStyle = '#efe0be';
  ctx.fillRect(rx + 12, oy + 310, 488, 175);
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 62px "Arial", sans-serif';
  ctx.fillText('CHỢ BẾN THÀNH', rx + 256, oy + 398, 472);
}

function drawBienHoaCeramicReliefsArt(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number): void {
  // 1952 Biên Hòa polychrome glazed ceramic reliefs: Cow, Stingray & Banana Cluster on olive-slate ground (BT-13..16)
  ctx.fillStyle = '#485a4c';
  ctx.fillRect(ox, oy, w, h);
  const cellW = w / 3;
  for (let i = 0; i < 3; i++) {
    const cx = ox + (i + 0.5) * cellW;
    const cy = oy + h * 0.5;
    ctx.strokeStyle = '#e5d4a8';
    ctx.lineWidth = 16;
    ctx.strokeRect(ox + i * cellW + 14, oy + 14, cellW - 28, h - 28);

    // Stylized turquoise ceramic wave/cloud scrolls
    ctx.strokeStyle = '#7ac2b8';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy + 120, 95, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e5a838';
    if (i === 0) {
      // Cow relief (forward-facing horned cow head & shoulders)
      ctx.beginPath();
      ctx.ellipse(cx, cy - 10, 78, 95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f5dc8c';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy - 75, 92, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (i === 1) {
      // Diamond Stingray (Cá Đuối) relief
      ctx.beginPath();
      ctx.moveTo(cx, cy - 125);
      ctx.lineTo(cx + 115, cy - 10);
      ctx.lineTo(cx, cy + 85);
      ctx.lineTo(cx - 115, cy - 10);
      ctx.closePath();
      ctx.fill();
    } else {
      // Banana cluster & produce relief
      for (let b = -2; b <= 2; b++) {
        ctx.beginPath();
        ctx.ellipse(cx + b * 26, cy - 15 + Math.abs(b) * 12, 18, 78, b * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawSignStrip(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  bg: string,
  border: string,
  textCol: string,
  line1: string,
  line2: string
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(ox, oy, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 14;
  ctx.strokeRect(ox + 18, oy + 18, w - 36, h - 36);
  ctx.fillStyle = textCol;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(h * 0.23)}px "Arial", sans-serif`;
  ctx.fillText(line1, ox + w * 0.5, oy + h * 0.40, w - 80);
  ctx.font = `bold ${Math.round(h * 0.14)}px "Arial", sans-serif`;
  ctx.fillText(line2, ox + w * 0.5, oy + h * 0.72, w - 80);
}

export function createBenThanhCaiRangMaterialPack(renderer?: THREE.WebGLRenderer): BenThanhCaiRangMaterialPack {
  const allMaterials: THREE.Material[] = [];
  const allTextures: THREE.Texture[] = [];

  if (isHeadlessRenderer(renderer)) {
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xd8c49e,
      roughness: 0.74,
      metalness: 0.06
    });
    fallbackMat.name = 'benThanhCaiRangMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      benThanhCaiRangMasterAtlasMat: fallbackMat,
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
      color: 0xd8c49e,
      roughness: 0.74,
      metalness: 0.06
    });
    fallbackMat.name = 'benThanhCaiRangMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      benThanhCaiRangMasterAtlasMat: fallbackMat,
      allMaterials,
      allTextures
    };
  }

  const { canvas: cCanvas, ctx } = colorTarget;
  const { canvas: hCanvas, ctx: hCtx } = heightTarget;

  ctx.fillStyle = '#c8b898';
  ctx.fillRect(0, 0, W, H);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, W, H);

  // Row 0
  drawTile0BenThanhCreamStucco(ctx, hCtx, 0, 0, S);
  drawTile1BenThanhGreenShutter(ctx, hCtx, S, 0, S);
  drawTile2BenThanhRollShutter(ctx, hCtx, S * 2, 0, S);
  drawTile3BenThanhTerracottaRoof(ctx, hCtx, S * 3, 0, S);

  // Row 1
  drawTile4BenThanhConcourseTile(ctx, hCtx, 0, S, S);
  drawTile5BenThanhSilkTextile(ctx, hCtx, S, S, S);
  drawTile6BenThanhSpiceDryGoods(ctx, hCtx, S * 2, S, S);
  drawTile7SaigonCrosswalkAsphalt(ctx, hCtx, S * 3, S, S);

  // Row 2
  drawTile8GheBauPlankedHull(ctx, hCtx, 0, S * 2, S);
  drawTile9GheBauPaintedProw(ctx, hCtx, S, S * 2, S);
  drawTileCorrugated(ctx, hCtx, S * 2, S * 2, S, '#2b6f94', '#1d4f6b');
  drawTileCorrugated(ctx, hCtx, S * 3, S * 2, S, '#a84632', '#7a2e1f');

  // Row 3
  drawTile12WharfWeatheredPlank(ctx, hCtx, 0, S * 3, S);
  drawTile13WovenBambooBasket(ctx, hCtx, S, S * 3, S);
  drawTile14WatermelonStriped(ctx, hCtx, S * 2, S * 3, S);
  drawTile15MekongShophouseWall(ctx, hCtx, S * 3, S * 3, S);

  // Bottom 1/3 Artworks
  drawBenThanhClockAndTitleArt(ctx, 0, 2048, 1024, 512);
  drawBienHoaCeramicReliefsArt(ctx, 1024, 2048, 1024, 512);
  drawSignStrip(ctx, 0, 2560, 1024, 512, '#8b1a14', '#f2c84b', '#fff6d6', 'SẠP 745 — LỤA TƠ TẰM & BÁNH MỨT', 'CHỢ BẾN THÀNH — SÀI GÒN');
  drawSignStrip(ctx, 1024, 2560, 1024, 512, '#9e1b16', '#f5ce52', '#ffffff', 'CHỢ NỔI CÁI RĂNG', 'CẦN THƠ — ĐỒNG BẰNG SÔNG CỬU LONG');

  const mapTex = wrapCanvasTex(cCanvas, true, renderer);
  const normalTex = heightCanvasToNormalTex(hCanvas, 2.2, renderer);
  allTextures.push(mapTex, normalTex);

  const benThanhCaiRangMasterAtlasMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.86, 0.86),
    roughness: 0.72,
    metalness: 0.08
  });
  benThanhCaiRangMasterAtlasMat.name = 'benThanhCaiRangMasterAtlasMat';
  allMaterials.push(benThanhCaiRangMasterAtlasMat);

  return {
    benThanhCaiRangMasterAtlasMat,
    allMaterials,
    allTextures
  };
}
