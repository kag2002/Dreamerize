import * as THREE from 'three';

/**
 * Ultra-Lean SINGLE-MATERIAL Museum PBR & Artwork Master Atlas for
 * Cầu Vàng — Bà Nà Hills & Vịnh Hạ Long:
 *   - Cầu Vàng (Giant Mossy Stone Hands, Brushed Champagne-Gold Shell, Merbau Timber Deck,
 *     Purple Lobelia Chrysanthemum Troughs, Marseille Cable Car Station & Le Jardin d'Amour)
 *   - Vịnh Hạ Long (Hòn Trống Mái, Hòn Đỉnh Hương, Stratified Karsts, Bat-Wing Junk Boats,
 *     Làng Chài Cửa Vạn Floating Village & Đảo Ti Tốp)
 *
 * Packs ALL 16 architectural/natural PBR tiles + ALL 4 crisp 2K sail/signage artworks into
 * ONE single 2048×3072 GPU material (`cauVangHaLongMasterAtlasMat` + Sobel `normalMap` `flipY = true`)!
 */

export interface CauVangHaLongMaterialPack {
  cauVangHaLongMasterAtlasMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const CVHL_RELIEF_UV = {
  // Row 0 (y: 0..512 -> v: 0.8333..1.0)
  giantHandMossyStone: [0.0, 0.8333, 0.25, 1.0],
  champagneGoldCladding: [0.25, 0.8333, 0.5, 1.0],
  merbauTimberDeck: [0.5, 0.8333, 0.75, 1.0],
  lobeliaVioletBloom: [0.75, 0.8333, 1.0, 1.0],
  // Row 1 (y: 512..1024 -> v: 0.6667..0.8333)
  chateauAshlarStone: [0.0, 0.6667, 0.25, 0.8333],
  slateMansardRoof: [0.25, 0.6667, 0.5, 0.8333],
  haLongDiagonalKarst: [0.5, 0.6667, 0.75, 0.8333],
  mahoganyJunkHull: [0.75, 0.6667, 1.0, 0.8333],
  // Row 2 (y: 1024..1536 -> v: 0.5..0.6667)
  junkCabinShutter: [0.0, 0.5, 0.25, 0.6667],
  cuaVanTurquoisePlank: [0.25, 0.5, 0.5, 0.6667],
  cuaVanOchrePlank: [0.5, 0.5, 0.75, 0.6667],
  corrugatedTinRoof: [0.75, 0.5, 1.0, 0.6667],
  // Row 3 (y: 1536..2048 -> v: 0.3333..0.5)
  goldenBeachSand: [0.0, 0.3333, 0.25, 0.5],
  weatheredPierPlank: [0.25, 0.3333, 0.5, 0.5],
  greenSteelPier: [0.5, 0.3333, 0.75, 0.5],
  baNaMosaicPaver: [0.75, 0.3333, 1.0, 0.5]
} as const;

export type CvhlReliefKey = keyof typeof CVHL_RELIEF_UV;

export const CVHL_ART_UV = {
  // Row P0 (y: 2048..2560 -> v: 0.1667..0.3333)
  batWingSailCanvas: [0.0, 0.1667, 0.5, 0.3333],
  marseilleStationSign: [0.5, 0.1667, 1.0, 0.3333],
  // Row P1 (y: 2560..3072 -> v: 0.0..0.1667)
  cuaVanVillageSign: [0.0, 0.0, 0.5, 0.1667],
  tiTopIslandSign: [0.5, 0.0, 1.0, 0.1667]
} as const;

export type CvhlArtKey = keyof typeof CVHL_ART_UV;

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
  maxR = 6
): void {
  for (let i = 0; i < count; i++) {
    const px = ox + hash2i(i, 1, seed) * s;
    const py = oy + hash2i(i, 2, seed) * s;
    const r = minR + hash2i(i, 3, seed) * (maxR - minR);
    ctx.fillStyle = hash2i(i, 4, seed) > 0.5 ? colA : colB;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    hCtx.fillStyle = hash2i(i, 5, seed) > 0.5 ? 'rgba(95,95,95,0.28)' : 'rgba(165,165,165,0.24)';
    hCtx.beginPath();
    hCtx.arc(px, py, r, 0, Math.PI * 2);
    hCtx.fill();
  }
}

function drawTile0GiantHandMossyStone(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Natural weathered pale-grey granite with subtle organic moss washes, fine pitting & hairline cracks (CV-11..16)
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#cfd2ce');
  g.addColorStop(0.5, '#bfc4be');
  g.addColorStop(1, '#9ca298');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  // Soft low-opacity organic moss & weathered rainwater patina washes (NO polka dots!)
  for (let i = 0; i < 42; i++) {
    const px = ox + hash2i(i, 1, 101) * s;
    const py = oy + hash2i(i, 2, 101) * s;
    const r = 24 + hash2i(i, 3, 101) * 58;
    const mode = i % 3;
    const rg = ctx.createRadialGradient(px, py, 2, px, py, r);
    if (mode === 0) {
      rg.addColorStop(0, 'rgba(62, 82, 42, 0.24)');
      rg.addColorStop(1, 'rgba(62, 82, 42, 0)');
    } else if (mode === 1) {
      rg.addColorStop(0, 'rgba(58, 60, 58, 0.20)');
      rg.addColorStop(1, 'rgba(58, 60, 58, 0)');
    } else {
      rg.addColorStop(0, 'rgba(232, 234, 230, 0.22)');
      rg.addColorStop(1, 'rgba(232, 234, 230, 0)');
    }
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle vertical weathered stone striations & delicate natural hairline fractures
  ctx.strokeStyle = 'rgba(48, 52, 46, 0.32)';
  hCtx.strokeStyle = '#505050';
  for (let c = 0; c < 14; c++) {
    let cx = ox + hash2i(c, 10, 102) * s;
    let cy = oy + hash2i(c, 11, 102) * s;
    ctx.lineWidth = 1.2 + hash2i(c, 12, 102) * 1.4;
    hCtx.lineWidth = 2.0;
    ctx.beginPath();
    hCtx.beginPath();
    ctx.moveTo(cx, cy);
    hCtx.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) {
      cx += (hash2i(c * 7 + k, 13, 102) - 0.5) * 46;
      cy += 22 + hash2i(c * 7 + k, 14, 102) * 38;
      ctx.lineTo(Math.max(ox, Math.min(ox + s, cx)), Math.max(oy, Math.min(oy + s, cy)));
      hCtx.lineTo(Math.max(ox, Math.min(ox + s, cx)), Math.max(oy, Math.min(oy + s, cy)));
    }
    ctx.stroke();
    hCtx.stroke();
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 900, 103, 'rgba(66,74,56,0.22)', 'rgba(235,238,234,0.22)', 1, 3.5);
}

function drawTile1ChampagneGold(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Brushed champagne-gold satin cladding with crisp vertical panel seams (CV-18..19, CW-07..11)
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#ebd286');
  g.addColorStop(0.5, '#d4b35c');
  g.addColorStop(1, '#a98738');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  for (let i = 0; i < 80; i++) {
    const y = oy + (i / 80) * s;
    const d = Math.floor((hash2i(i, 1, 201) - 0.5) * 24);
    ctx.fillStyle = `rgba(${225 + d}, ${194 + d}, ${106 + d}, 0.28)`;
    ctx.fillRect(ox, y, s, s / 80 + 1);
  }
  // Crisp vertical cladding panel seams
  for (let p = 1; p < 6; p++) {
    const px = ox + (p / 6) * s;
    ctx.fillStyle = 'rgba(72, 54, 18, 0.55)';
    ctx.fillRect(px, oy, 3, s);
    hCtx.fillStyle = '#404040';
    hCtx.fillRect(px, oy, 3, s);
  }
}

function drawTile2MerbauTimberDeck(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Warm reddish-brown Merbau hardwood planks laid transversely with dark expansion gaps (CW-01..05)
  ctx.fillStyle = '#24120a';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#303030';
  hCtx.fillRect(ox, oy, s, s);

  const planks = 14;
  const ph = s / planks;
  for (let i = 0; i < planks; i++) {
    const v = hash2i(i, 1, 301);
    const r = Math.floor(114 + v * 36);
    const g = Math.floor(58 + v * 22);
    const b = Math.floor(34 + v * 14);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(ox, oy + i * ph + 3, s, ph - 5);
    hCtx.fillStyle = `rgb(${135 + Math.floor(v * 25)},${135 + Math.floor(v * 25)},${135 + Math.floor(v * 25)})`;
    hCtx.fillRect(ox, oy + i * ph + 3, s, ph - 5);

    // Fine wood grain lines & staggered butt joint
    ctx.strokeStyle = 'rgba(42, 20, 10, 0.30)';
    ctx.lineWidth = 1.2;
    const jointX = ox + (0.2 + hash2i(i, 2, 301) * 0.6) * s;
    ctx.beginPath();
    ctx.moveTo(jointX, oy + i * ph + 3);
    ctx.lineTo(jointX, oy + (i + 1) * ph - 2);
    ctx.stroke();
  }
}

function drawTile3LobeliaVioletBloom(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Rich violet-purple & magenta-lavender Lobelia Chrysanthemum blooms over deep emerald foliage (CW-13..18)
  ctx.fillStyle = '#24471e';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#686868';
  hCtx.fillRect(ox, oy, s, s);

  // Deep emerald foliage base tufts
  drawSpeckles(ctx, hCtx, ox, oy, s, 400, 401, '#2f5d26', '#1c3a17', 4, 14);

  // Dense billowing violet-purple & lavender blooms (~68% coverage)
  const palette = ['#6a2c91', '#8842b5', '#a364cc', '#7835a3', '#b87ee0', '#58227a'];
  for (let i = 0; i < 620; i++) {
    const bx = ox + hash2i(i, 1, 402) * s;
    const by = oy + hash2i(i, 2, 402) * s;
    const r = 4 + hash2i(i, 3, 402) * 10;
    ctx.fillStyle = palette[i % palette.length];
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    // Bright flower center dot
    ctx.fillStyle = '#e8c4ff';
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    hCtx.fillStyle = '#d8d8d8';
    hCtx.beginPath();
    hCtx.arc(bx, by, r * 0.85, 0, Math.PI * 2);
    hCtx.fill();
  }
}

function drawTile4ChateauAshlarStone(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#9c9384';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#505050';
  hCtx.fillRect(ox, oy, s, s);

  const rows = 8;
  const cols = 4;
  const rh = s / rows;
  const cw = s / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const k = hash2i(c + 3, r + 3, 501);
      const base = Math.floor(204 + k * 24);
      ctx.fillStyle = `rgb(${base}, ${base - 8}, ${base - 20})`;
      ctx.fillRect(ox + c * cw + off + 3, oy + r * rh + 3, cw - 6, rh - 6);
      hCtx.fillStyle = '#d2d2d2';
      hCtx.fillRect(ox + c * cw + off + 3, oy + r * rh + 3, cw - 6, rh - 6);
    }
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 260, 502, 'rgba(105,96,82,0.16)', 'rgba(245,240,228,0.16)', 1, 5);
}

function drawTile5SlateMansardRoof(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#1e2c3d';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#555555';
  hCtx.fillRect(ox, oy, s, s);

  const rows = 12;
  const cols = 10;
  const rh = s / rows;
  const cw = s / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const k = hash2i(c + 5, r + 5, 601);
      ctx.fillStyle = `rgb(${38 + Math.floor(k * 20)}, ${54 + Math.floor(k * 24)}, ${74 + Math.floor(k * 28)})`;
      ctx.fillRect(ox + c * cw + off + 2, oy + r * rh + 2, cw - 4, rh - 4);
      hCtx.fillStyle = '#c4c4c4';
      hCtx.fillRect(ox + c * cw + off + 2, oy + r * rh + 2, cw - 4, rh - 4);
    }
  }
}

function drawTile6HaLongDiagonalKarst(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Natural weathered dark charcoal-slate & olive-grey Hạ Long limestone with subtle organic bedding & tidal base (ZERO zebra stripes!)
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#727670');
  g.addColorStop(0.55, '#626660');
  g.addColorStop(0.84, '#464a44');
  g.addColorStop(1, '#282c26');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  // Soft mottled weathered rock & tropical moss washes
  for (let i = 0; i < 48; i++) {
    const px = ox + hash2i(i, 1, 700) * s;
    const py = oy + hash2i(i, 2, 700) * s;
    const r = 20 + hash2i(i, 3, 700) * 65;
    const rg = ctx.createRadialGradient(px, py, 2, px, py, r);
    const mode = i % 3;
    rg.addColorStop(0, mode === 0 ? 'rgba(50, 68, 38, 0.28)' : mode === 1 ? 'rgba(42, 44, 42, 0.24)' : 'rgba(154, 158, 152, 0.20)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle organic tilted bedding creases & fine mineral streaks
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, s, s);
  ctx.clip();
  hCtx.save();
  hCtx.beginPath();
  hCtx.rect(ox, oy, s, s);
  hCtx.clip();

  for (let i = -8; i < 18; i++) {
    const y0 = oy + i * 38;
    const bright = hash2i(i + 20, 1, 701);
    ctx.strokeStyle = bright > 0.55 ? 'rgba(162, 166, 160, 0.14)' : 'rgba(34, 38, 34, 0.22)';
    ctx.lineWidth = 3 + hash2i(i + 20, 2, 701) * 5;
    ctx.beginPath();
    ctx.moveTo(ox - 40, y0 + 180);
    ctx.lineTo(ox + s + 40, y0 - 180);
    ctx.stroke();

    hCtx.strokeStyle = bright > 0.5 ? '#9e9e9e' : '#585858';
    hCtx.lineWidth = ctx.lineWidth;
    hCtx.beginPath();
    hCtx.moveTo(ox - 40, y0 + 180);
    hCtx.lineTo(ox + s + 40, y0 - 180);
    hCtx.stroke();
  }
  for (let v = 0; v < 18; v++) {
    const vx = ox + hash2i(v, 3, 702) * s;
    ctx.fillStyle = v % 3 === 0 ? 'rgba(182, 186, 180, 0.12)' : 'rgba(28, 32, 28, 0.18)';
    ctx.fillRect(vx, oy, 2 + hash2i(v, 4, 702) * 5, s);
  }
  ctx.restore();
  hCtx.restore();
  drawSpeckles(ctx, hCtx, ox, oy, s, 720, 703, 'rgba(46,62,34,0.24)', 'rgba(168,172,166,0.18)', 1, 4);
}

function drawTile7MahoganyJunkHull(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Deep lacquered mahogany hull with horizontal plank strakes & twin burnt-orange sheer bands (HJ-01..02)
  ctx.fillStyle = '#3f1c13';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  const strakes = 16;
  const sh = s / strakes;
  for (let i = 0; i < strakes; i++) {
    const d = Math.floor(hash2i(i, 1, 801) * 18);
    ctx.fillStyle = `rgb(${58 + d}, ${26 + Math.floor(d * 0.5)}, ${18 + Math.floor(d * 0.4)})`;
    ctx.fillRect(ox, oy + i * sh + 2, s, sh - 3);
    hCtx.fillStyle = '#b4b4b4';
    hCtx.fillRect(ox, oy + i * sh + 2, s, sh - 3);
  }
  // Twin burnt-orange sheer-strake trim bands near top of hull
  ctx.fillStyle = '#d96b27';
  ctx.fillRect(ox, oy + s * 0.14, s, 16);
  ctx.fillRect(ox, oy + s * 0.24, s, 12);
}

function drawTile8JunkCabinShutter(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Dark mahogany multi-deck junk cabin with warm-amber lit mullioned windows & louvered shutters (HJ-04..05)
  ctx.fillStyle = '#472116';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#7c7c7c';
  hCtx.fillRect(ox, oy, s, s);

  // Horizontal wainscot molding
  ctx.fillStyle = '#2d130c';
  ctx.fillRect(ox, oy + s * 0.62, s, 14);

  // 3 recessed warm-amber interior-lit cabin windows with mahogany mullions
  for (let w = 0; w < 3; w++) {
    const wx = ox + 36 + w * 160;
    const wy = oy + 86;
    const ww = 118;
    const wh = 195;
    // Frame
    ctx.fillStyle = '#260f09';
    ctx.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
    // Warm amber interior glow
    const wg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    wg.addColorStop(0, '#ffd480');
    wg.addColorStop(0.55, '#e89c3a');
    wg.addColorStop(1, '#7a4418');
    ctx.fillStyle = wg;
    ctx.fillRect(wx, wy, ww, wh);
    // Mullions & louver slats
    ctx.fillStyle = '#3a1a10';
    ctx.fillRect(wx + ww * 0.5 - 4, wy, 8, wh);
    ctx.fillRect(wx, wy + wh * 0.5 - 4, ww, 8);
    hCtx.fillStyle = '#424242';
    hCtx.fillRect(wx, wy, ww, wh);
  }
}

function drawTileCoastalPlank(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number,
  baseHex: string,
  shutterHex: string,
  seed: number
): void {
  ctx.fillStyle = baseHex;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  // Vertical coastal timber plank seams
  const cols = 14;
  const cw = s / cols;
  for (let c = 0; c < cols; c++) {
    ctx.fillStyle = 'rgba(30, 42, 48, 0.24)';
    ctx.fillRect(ox + c * cw, oy, 3, s);
    hCtx.fillStyle = '#525252';
    hCtx.fillRect(ox + c * cw, oy, 3, s);
  }
  // Salt-weathered damp base
  const bg = ctx.createLinearGradient(ox, oy + s * 0.72, ox, oy + s);
  bg.addColorStop(0, 'rgba(60, 74, 70, 0)');
  bg.addColorStop(1, 'rgba(54, 68, 62, 0.45)');
  ctx.fillStyle = bg;
  ctx.fillRect(ox, oy + s * 0.72, s, s * 0.28);

  // Recessed shuttered coastal window
  const wx = ox + s * 0.28;
  const wy = oy + s * 0.24;
  const ww = s * 0.44;
  const wh = s * 0.36;
  ctx.fillStyle = '#24323b';
  ctx.fillRect(wx, wy, ww, wh);
  ctx.strokeStyle = shutterHex;
  ctx.lineWidth = 14;
  ctx.strokeRect(wx, wy, ww, wh);
  // Warm interior lamp glow hint
  ctx.fillStyle = 'rgba(255, 198, 108, 0.45)';
  ctx.fillRect(wx + 12, wy + 12, ww - 24, wh - 24);
  drawSpeckles(ctx, hCtx, ox, oy, s, 180, seed, 'rgba(255,255,255,0.12)', 'rgba(40,52,58,0.14)', 1, 4);
}

function drawTile11CorrugatedTinRoof(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#a84536';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  const ribs = 28;
  const rw = s / ribs;
  for (let i = 0; i < ribs; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#bc5140' : '#853326';
    ctx.fillRect(ox + i * rw, oy, rw, s);
    hCtx.fillStyle = i % 2 === 0 ? '#d8d8d8' : '#4a4a4a';
    hCtx.fillRect(ox + i * rw, oy, rw, s);
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 240, 1101, 'rgba(92,42,24,0.22)', 'rgba(180,175,168,0.16)', 1, 5);
}

function drawTile12GoldenBeachSand(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#eadbb2';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  drawSpeckles(ctx, hCtx, ox, oy, s, 600, 1201, 'rgba(204,184,138,0.34)', 'rgba(255,248,228,0.30)', 1, 4);
}

function drawTile13WeatheredPierPlank(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#404040';
  hCtx.fillRect(ox, oy, s, s);
  const n = 10;
  const ph = s / n;
  for (let i = 0; i < n; i++) {
    const k = hash2i(i, 1, 1301);
    ctx.fillStyle = `rgb(${102 + Math.floor(k * 28)}, ${84 + Math.floor(k * 22)}, ${66 + Math.floor(k * 18)})`;
    ctx.fillRect(ox, oy + i * ph + 3, s, ph - 6);
    hCtx.fillStyle = '#c4c4c4';
    hCtx.fillRect(ox, oy + i * ph + 3, s, ph - 6);
  }
}

function drawTile14GreenSteelPier(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  const g = ctx.createLinearGradient(ox, oy, ox + s, oy);
  g.addColorStop(0, '#183f26');
  g.addColorStop(0.5, '#255c38');
  g.addColorStop(1, '#153821');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#828282';
  hCtx.fillRect(ox, oy, s, s);
  for (let r = 1; r < 6; r++) {
    ctx.fillStyle = 'rgba(12, 34, 20, 0.45)';
    ctx.fillRect(ox, oy + (r / 6) * s, s, 6);
    hCtx.fillStyle = '#d4d4d4';
    hCtx.fillRect(ox, oy + (r / 6) * s, s, 6);
  }
}

function drawTile15BaNaMosaicPaver(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#9e9c96';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#606060';
  hCtx.fillRect(ox, oy, s, s);
  const rows = 8;
  const cols = 8;
  const rh = s / rows;
  const cw = s / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dark = (r + c) % 3 === 0;
      ctx.fillStyle = dark ? '#7e807c' : '#d2d0c8';
      ctx.fillRect(ox + c * cw + 3, oy + r * rh + 3, cw - 6, rh - 6);
      hCtx.fillStyle = '#cecece';
      hCtx.fillRect(ox + c * cw + 3, oy + r * rh + 3, cw - 6, rh - 6);
    }
  }
}

function drawBatWingSailArt(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number): void {
  // Burnt-sienna / terracotta ochre bat-wing canvas with 11 curved bamboo battens & stitched cloth panels (HJ-08..09)
  const g = ctx.createLinearGradient(ox, oy, ox + w, oy + h);
  g.addColorStop(0, '#c96f32');
  g.addColorStop(0.5, '#d6823e');
  g.addColorStop(1, '#a64d1f');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, w, h);

  // Vertical stitched canvas cloth seams
  ctx.strokeStyle = 'rgba(92, 38, 12, 0.36)';
  ctx.lineWidth = 4;
  for (let c = 1; c < 10; c++) {
    const cx = ox + (c / 10) * w;
    ctx.beginPath();
    ctx.moveTo(cx, oy);
    ctx.lineTo(cx, oy + h);
    ctx.stroke();
  }

  // 11 radiating horizontal/curved dark bamboo battens
  for (let b = 0; b < 11; b++) {
    const by = oy + ((b + 0.5) / 11) * h;
    ctx.strokeStyle = '#4a2410';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(ox, by + 12);
    ctx.quadraticCurveTo(ox + w * 0.5, by - 14, ox + w, by + 6);
    ctx.stroke();
    ctx.strokeStyle = '#7d4420';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawSignBoard(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  bg: string,
  border: string,
  textCol: string,
  title: string,
  sub: string
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(ox, oy, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 14;
  ctx.strokeRect(ox + 20, oy + 20, w - 40, h - 40);
  ctx.fillStyle = textCol;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(h * 0.24)}px "Noto Serif", "Times New Roman", serif`;
  ctx.fillText(title, ox + w * 0.5, oy + h * 0.42, w - 96);
  ctx.font = `bold ${Math.round(h * 0.14)}px "Noto Serif", "Times New Roman", serif`;
  ctx.fillText(sub, ox + w * 0.5, oy + h * 0.72, w - 96);
}

export function createCauVangHaLongMaterialPack(renderer?: THREE.WebGLRenderer): CauVangHaLongMaterialPack {
  const allMaterials: THREE.Material[] = [];
  const allTextures: THREE.Texture[] = [];

  if (isHeadlessRenderer(renderer)) {
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xc2bcb0,
      roughness: 0.74,
      metalness: 0.10
    });
    fallbackMat.name = 'cauVangHaLongMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      cauVangHaLongMasterAtlasMat: fallbackMat,
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
      color: 0xc2bcb0,
      roughness: 0.74,
      metalness: 0.10
    });
    fallbackMat.name = 'cauVangHaLongMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      cauVangHaLongMasterAtlasMat: fallbackMat,
      allMaterials,
      allTextures
    };
  }

  const { canvas: cCanvas, ctx } = colorTarget;
  const { canvas: hCanvas, ctx: hCtx } = heightTarget;

  ctx.fillStyle = '#8a867e';
  ctx.fillRect(0, 0, W, H);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, W, H);

  // Row 0
  drawTile0GiantHandMossyStone(ctx, hCtx, 0, 0, S);
  drawTile1ChampagneGold(ctx, hCtx, S, 0, S);
  drawTile2MerbauTimberDeck(ctx, hCtx, S * 2, 0, S);
  drawTile3LobeliaVioletBloom(ctx, hCtx, S * 3, 0, S);

  // Row 1
  drawTile4ChateauAshlarStone(ctx, hCtx, 0, S, S);
  drawTile5SlateMansardRoof(ctx, hCtx, S, S, S);
  drawTile6HaLongDiagonalKarst(ctx, hCtx, S * 2, S, S);
  drawTile7MahoganyJunkHull(ctx, hCtx, S * 3, S, S);

  // Row 2
  drawTile8JunkCabinShutter(ctx, hCtx, 0, S * 2, S);
  drawTileCoastalPlank(ctx, hCtx, S, S * 2, S, '#7fc2c8', '#2a5a68', 901);
  drawTileCoastalPlank(ctx, hCtx, S * 2, S * 2, S, '#e2cc98', '#2d588a', 902);
  drawTile11CorrugatedTinRoof(ctx, hCtx, S * 3, S * 2, S);

  // Row 3
  drawTile12GoldenBeachSand(ctx, hCtx, 0, S * 3, S);
  drawTile13WeatheredPierPlank(ctx, hCtx, S, S * 3, S);
  drawTile14GreenSteelPier(ctx, hCtx, S * 2, S * 3, S);
  drawTile15BaNaMosaicPaver(ctx, hCtx, S * 3, S * 3, S);

  // Bottom 1/3 Artworks & Sails
  drawBatWingSailArt(ctx, 0, 2048, 1024, 512);
  drawSignBoard(ctx, 1024, 2048, 1024, 512, '#1f2c3d', '#e5c158', '#f8e090', 'GARE DE MARSEILLE', "BÀ NÀ HILLS — LE JARDIN D'AMOUR");
  drawSignBoard(ctx, 0, 2560, 1024, 512, '#18546e', '#e8f4f8', '#ffffff', 'LÀNG CHÀI CỬA VẠN', 'VỊNH HẠ LONG — DI SẢN THẾ GIỚI');
  drawSignBoard(ctx, 1024, 2560, 1024, 512, '#4d2b18', '#e5b842', '#fae08c', 'ĐẢO TI TỐP', 'LẦU VỌNG CẢNH — HẠ LONG');

  const mapTex = wrapCanvasTex(cCanvas, true, renderer);
  const normalTex = heightCanvasToNormalTex(hCanvas, 2.3, renderer);
  allTextures.push(mapTex, normalTex);

  const cauVangHaLongMasterAtlasMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.88, 0.88),
    roughness: 0.68,
    metalness: 0.14
  });
  cauVangHaLongMasterAtlasMat.name = 'cauVangHaLongMasterAtlasMat';
  allMaterials.push(cauVangHaLongMasterAtlasMat);

  return {
    cauVangHaLongMasterAtlasMat,
    allMaterials,
    allTextures
  };
}
