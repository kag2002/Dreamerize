import * as THREE from 'three';

/**
 * Ultra-Lean SINGLE-MATERIAL Museum PBR & Cultural Relief Master Atlas for
 * Thánh Địa Mỹ Sơn (Cham Pa) & Nhà Rông Tây Nguyên — Biển Hồ T'Nưng:
 *   - Thánh Địa Mỹ Sơn (Dry-laid rubbed terracotta brick, monolithic sandstone, carved pilasters,
 *     flame-arch false doors, Kala-Makara & Apsara tympanum relief, laterite sanctuary paths)
 *   - Nhà Rông Tây Nguyên & Biển Hồ T'Nưng (Layered cỏ tranh grass thatch, woven split-bamboo walls,
 *     Central Highlands hardwood, geometric Thổ Cẩm brocade, rượu cần stoneware, silver Nhà Mồ wood,
 *     volcanic basalt & sapphire crater lake)
 *
 * Packs ALL 16 architectural/natural PBR tiles + ALL 4 crisp 2K reliefs/signboards into
 * ONE single 2048×3072 GPU material (`mySonTayNguyenMasterAtlasMat` + Sobel `normalMap` `flipY = true`)!
 */

export interface MySonTayNguyenMaterialPack {
  mySonTayNguyenMasterAtlasMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const MSTN_RELIEF_UV = {
  // Row 0 (y: 0..512 -> v: 0.8333..1.0)
  chamRubbedBrick: [0.0, 0.8333, 0.25, 1.0],
  chamSandstoneMonolith: [0.25, 0.8333, 0.5, 1.0],
  chamCarvedPilaster: [0.5, 0.8333, 0.75, 1.0],
  chamFalseDoorArch: [0.75, 0.8333, 1.0, 1.0],
  // Row 1 (y: 512..1024 -> v: 0.6667..0.8333)
  quangNamLateritePath: [0.0, 0.6667, 0.25, 0.8333],
  chamDarkInterior: [0.25, 0.6667, 0.5, 0.8333],
  nhaRongGrassThatch: [0.5, 0.6667, 0.75, 0.8333],
  wovenBambooWall: [0.75, 0.6667, 1.0, 0.8333],
  // Row 2 (y: 1024..1536 -> v: 0.5..0.6667)
  tayNguyenDarkHardwood: [0.0, 0.5, 0.25, 0.6667],
  splitBambooDeck: [0.25, 0.5, 0.5, 0.6667],
  thoCamBrocade: [0.5, 0.5, 0.75, 0.6667],
  ruouCanStoneware: [0.75, 0.5, 1.0, 0.6667],
  // Row 3 (y: 1536..2048 -> v: 0.3333..0.5)
  nhaMoSilverWood: [0.0, 0.3333, 0.25, 0.5],
  volcanicBasaltRock: [0.25, 0.3333, 0.5, 0.5],
  highlandLateriteSoil: [0.5, 0.3333, 0.75, 0.5],
  sapphireCraterWater: [0.75, 0.3333, 1.0, 0.5]
} as const;

export type MstnReliefKey = keyof typeof MSTN_RELIEF_UV;

export const MSTN_ART_UV = {
  // Row P0 (y: 2048..2560 -> v: 0.1667..0.3333)
  kalaMakaraTympanum: [0.0, 0.1667, 0.5, 0.3333],
  thoCamBannerArt: [0.5, 0.1667, 1.0, 0.3333],
  // Row P1 (y: 2560..3072 -> v: 0.0..0.1667)
  mySonHeritageSign: [0.0, 0.0, 0.5, 0.1667],
  bienHoTNungSign: [0.5, 0.0, 1.0, 0.1667]
} as const;

export type MstnArtKey = keyof typeof MSTN_ART_UV;

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
    hCtx.fillStyle = hash2i(i, 5, seed) > 0.5 ? 'rgba(98,98,98,0.25)' : 'rgba(158,158,158,0.22)';
    hCtx.beginPath();
    hCtx.arc(px, py, r, 0, Math.PI * 2);
    hCtx.fill();
  }
}

function drawTile0ChamRubbedBrick(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Tight dry-laid Champa terracotta-rust rubbed bricks (~4:1 elongated courses, hairline joints, moss/soot patina! MS-01..05, MR-01..02)
  ctx.fillStyle = '#4e2114';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#545454';
  hCtx.fillRect(ox, oy, s, s);

  const rows = 20;
  const cols = 5;
  const rh = s / rows;
  const cw = s / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const k = hash2i(c + 10, r + 10, 101);
      const damp = hash2i(c + 30, r + 30, 102);
      const red = Math.floor(132 + k * 42 - (damp > 0.72 ? 32 : 0));
      const grn = Math.floor(54 + k * 22 - (damp > 0.72 ? 12 : 0));
      const blu = Math.floor(34 + k * 14 - (damp > 0.72 ? 8 : 0));
      ctx.fillStyle = `rgb(${red},${grn},${blu})`;
      ctx.fillRect(ox + c * cw + off + 1, oy + r * rh + 1, cw - 2, rh - 2);
      const hv = 132 + Math.floor(k * 36);
      hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hCtx.fillRect(ox + c * cw + off + 1, oy + r * rh + 1, cw - 2, rh - 2);
    }
  }
  // Vertical tropical rainwater soot & olive moss streaking
  for (let i = 0; i < 36; i++) {
    const sx = ox + hash2i(i, 1, 103) * s;
    const sw = 6 + hash2i(i, 2, 103) * 18;
    const sh = s * (0.25 + hash2i(i, 3, 103) * 0.65);
    const sy = oy + hash2i(i, 4, 103) * (s - sh);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(42, 54, 30, 0.28)' : 'rgba(28, 22, 18, 0.28)';
    ctx.fillRect(sx, sy, sw, sh);
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 400, 104, 'rgba(36,44,28,0.25)', 'rgba(182,118,84,0.18)', 1, 3.5);
}

function drawTile1ChamSandstoneMonolith(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Fine-grained weathered grey-buff monolithic sandstone (ZERO brick grid! MS-06, MR-04)
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#b5ac9a');
  g.addColorStop(0.6, '#9c9382');
  g.addColorStop(1, '#7a7464');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#848484';
  hCtx.fillRect(ox, oy, s, s);

  for (let i = 0; i < 30; i++) {
    const px = ox + hash2i(i, 1, 201) * s;
    const py = oy + hash2i(i, 2, 201) * s;
    const r = 18 + hash2i(i, 3, 201) * 48;
    const rg = ctx.createRadialGradient(px, py, 2, px, py, r);
    rg.addColorStop(0, i % 2 === 0 ? 'rgba(64, 72, 48, 0.22)' : 'rgba(54, 50, 44, 0.20)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 700, 202, 'rgba(72,68,58,0.20)', 'rgba(218,210,192,0.18)', 1, 3.5);
}

function drawTile2ChamCarvedPilaster(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  drawTile0ChamRubbedBrick(ctx, hCtx, ox, oy, s);
  // Deep vertical carved pilaster channels & floral scroll dado bands (MS-13, MR-09..10)
  for (let p = 0; p < 4; p++) {
    const px = ox + (p + 0.5) * (s / 4);
    ctx.fillStyle = 'rgba(32, 16, 10, 0.58)';
    ctx.fillRect(px - 10, oy, 20, s);
    hCtx.fillStyle = '#303030';
    hCtx.fillRect(px - 10, oy, 20, s);
    ctx.strokeStyle = 'rgba(196, 108, 68, 0.48)';
    ctx.lineWidth = 4;
    ctx.strokeRect(px + 14, oy + 12, s / 4 - 28, s - 24);
  }
  // Carved horizontal leaf-bud cornice band
  ctx.fillStyle = 'rgba(42, 20, 12, 0.55)';
  ctx.fillRect(ox, oy + s * 0.14, s, 14);
  ctx.fillRect(ox, oy + s * 0.84, s, 14);
}

function drawTile3ChamFalseDoorArch(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  drawTile0ChamRubbedBrick(ctx, hCtx, ox, oy, s);
  // Recessed multi-tiered flame-arch false door (cửa giả lá đề! MS-09, MR-06..07)
  const cx = ox + s * 0.5;
  for (let tier = 0; tier < 3; tier++) {
    const pad = 34 + tier * 36;
    ctx.strokeStyle = tier === 1 ? '#c26b42' : '#4a1c10';
    ctx.lineWidth = 14 - tier * 2;
    ctx.beginPath();
    ctx.moveTo(ox + pad, oy + s - 20);
    ctx.lineTo(ox + pad, oy + s * 0.42 + tier * 18);
    ctx.quadraticCurveTo(cx, oy + 18 + tier * 42, ox + s - pad, oy + s * 0.42 + tier * 18);
    ctx.lineTo(ox + s - pad, oy + s - 20);
    ctx.stroke();

    hCtx.strokeStyle = tier === 1 ? '#e2e2e2' : '#404040';
    hCtx.lineWidth = 14 - tier * 2;
    hCtx.stroke();
  }
  // Deep shadowed false-door blind panel center
  ctx.fillStyle = '#32140c';
  ctx.fillRect(cx - 72, oy + s * 0.46, 144, s * 0.48);
  hCtx.fillStyle = '#282828';
  hCtx.fillRect(cx - 72, oy + s * 0.46, 144, s * 0.48);
}

function drawTile4QuangNamLateritePath(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#8e573b';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#7e7e7e';
  hCtx.fillRect(ox, oy, s, s);
  // Scattered sunken ancient mossy bricks & creeping grass tufts
  for (let i = 0; i < 48; i++) {
    const bx = ox + hash2i(i, 1, 401) * (s - 48);
    const by = oy + hash2i(i, 2, 401) * (s - 24);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(66, 92, 42, 0.42)' : 'rgba(136, 62, 38, 0.55)';
    ctx.fillRect(bx, by, 42, 20);
    hCtx.fillStyle = '#b4b4b4';
    hCtx.fillRect(bx, by, 42, 20);
  }
  drawSpeckles(ctx, hCtx, ox, oy, s, 600, 402, 'rgba(72,44,26,0.28)', 'rgba(176,126,88,0.24)', 1, 5);
}

function drawTile5ChamDarkInterior(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#24110b';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#505050';
  hCtx.fillRect(ox, oy, s, s);
  drawSpeckles(ctx, hCtx, ox, oy, s, 260, 501, 'rgba(68,32,20,0.25)', 'rgba(12,6,4,0.35)', 2, 6);
}

function drawTile6NhaRongGrassThatch(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Multi-layered shaggy cỏ tranh grass-thatch with weathered straw-grey, golden-ochre & dark damp streaks (NR-06..07, TN-15)
  ctx.fillStyle = '#8b734e';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#787878';
  hCtx.fillRect(ox, oy, s, s);

  const layers = 8;
  const lh = s / layers;
  for (let l = 0; l < layers; l++) {
    const ly = oy + l * lh;
    // Horizontal thatch course overlap shadow
    ctx.fillStyle = 'rgba(42, 32, 20, 0.52)';
    ctx.fillRect(ox, ly + lh - 6, s, 6);
    hCtx.fillStyle = '#383838';
    hCtx.fillRect(ox, ly + lh - 6, s, 6);

    // Dense vertical straw grass fibers
    for (let f = 0; f < 160; f++) {
      const fx = ox + (f / 160) * s;
      const v = hash2i(f, l, 601);
      const r = Math.floor(118 + v * 58);
      const g = Math.floor(96 + v * 46);
      const b = Math.floor(62 + v * 32);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(fx, ly);
      ctx.lineTo(fx + (v - 0.5) * 6, ly + lh - 2);
      ctx.stroke();

      const hv = 110 + Math.floor(v * 70);
      hCtx.strokeStyle = `rgb(${hv},${hv},${hv})`;
      hCtx.lineWidth = 2.2;
      hCtx.beginPath();
      hCtx.moveTo(fx, ly);
      hCtx.lineTo(fx + (v - 0.5) * 5, ly + lh - 2);
      hCtx.stroke();
    }
  }
}

function drawTile7WovenBambooWall(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Authentic herringbone/twill woven split-bamboo matting (phên tre đan) + vertical bamboo clamping battens (NR-13, TN-08)
  ctx.fillStyle = '#5c462c';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#686868';
  hCtx.fillRect(ox, oy, s, s);

  const step = 16;
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const alt = ((x / step + y / step) & 1) === 0;
      const k = hash2i(x, y, 701);
      ctx.fillStyle = alt
        ? `rgb(${132 + Math.floor(k * 24)}, ${102 + Math.floor(k * 18)}, ${62 + Math.floor(k * 14)})`
        : `rgb(${96 + Math.floor(k * 20)}, ${72 + Math.floor(k * 16)}, ${44 + Math.floor(k * 12)})`;
      ctx.fillRect(ox + x + 1, oy + y + 1, step - 2, step - 2);
      hCtx.fillStyle = alt ? '#c8c8c8' : '#787878';
      hCtx.fillRect(ox + x + 1, oy + y + 1, step - 2, step - 2);
    }
  }
  // Vertical bamboo clamping battens
  for (let b = 0; b < 4; b++) {
    const bx = ox + (b + 0.5) * (s / 4) - 6;
    ctx.fillStyle = '#47331e';
    ctx.fillRect(bx, oy, 12, s);
    hCtx.fillStyle = '#e4e4e4';
    hCtx.fillRect(bx, oy, 12, s);
  }
}

function drawTile8TayNguyenHardwood(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Scale-matched dark Central Highlands hardwood (ZERO wavy zebra stripes! NR-25, TN-10)
  ctx.fillStyle = '#3f2e22';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  for (let i = 0; i < 120; i++) {
    const x = ox + (i / 120) * s;
    const d = Math.floor(hash2i(i, 1, 801) * 24);
    ctx.fillStyle = `rgb(${54 + d}, ${38 + Math.floor(d * 0.72)}, ${28 + Math.floor(d * 0.55)})`;
    ctx.fillRect(x, oy, s / 120 + 1, s);
    const hv = 118 + Math.floor(hash2i(i, 2, 801) * 28);
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(x, oy, s / 120 + 1, s);
  }
}

function drawTile9SplitBambooDeck(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#2a1f14';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#383838';
  hCtx.fillRect(ox, oy, s, s);

  const slats = 18;
  const sh = s / slats;
  for (let i = 0; i < slats; i++) {
    const k = hash2i(i, 1, 901);
    ctx.fillStyle = `rgb(${124 + Math.floor(k * 32)}, ${98 + Math.floor(k * 24)}, ${62 + Math.floor(k * 16)})`;
    ctx.fillRect(ox, oy + i * sh + 3, s, sh - 5);
    hCtx.fillStyle = '#c8c8c8';
    hCtx.fillRect(ox, oy + i * sh + 3, s, sh - 5);
  }
}

function drawTile10ThoCamBrocade(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  // Authentic Bahnar/Ede Thổ Cẩm brocade: charcoal-black (#1a1718), crimson (#9e1f22) & golden-ochre (#d89b2b) serrated diamonds & chevrons (NR-09, TN-06..07)
  ctx.fillStyle = '#1a1718';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);

  // Crimson & golden-ochre horizontal stripes
  const bands = [
    [0.06, 0.08, '#9e1f22'],
    [0.16, 0.04, '#e6b842'],
    [0.80, 0.04, '#e6b842'],
    [0.86, 0.08, '#9e1f22']
  ] as const;
  for (const [yFrac, hFrac, col] of bands) {
    ctx.fillStyle = col;
    ctx.fillRect(ox, oy + s * yFrac, s, s * hFrac);
  }
  // Repeating serrated Bahnar diamond motifs across center
  const n = 4;
  const dw = s / n;
  for (let i = 0; i < n; i++) {
    const cx = ox + (i + 0.5) * dw;
    const cy = oy + s * 0.5;
    ctx.fillStyle = '#9e1f22';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 95);
    ctx.lineTo(cx + 56, cy);
    ctx.lineTo(cx, cy + 95);
    ctx.lineTo(cx - 56, cy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e8b942';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = '#f2e8d2';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 36);
    ctx.lineTo(cx + 22, cy);
    ctx.lineTo(cx, cy + 36);
    ctx.lineTo(cx - 22, cy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTile11RuouCanStoneware(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  const g = ctx.createLinearGradient(ox, oy, ox, oy + s);
  g.addColorStop(0, '#783b22');
  g.addColorStop(0.5, '#5a2a16');
  g.addColorStop(1, '#3b1b0e');
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  // Embossed shoulder cord bands
  ctx.fillStyle = '#a4643c';
  ctx.fillRect(ox, oy + s * 0.25, s, 12);
  ctx.fillRect(ox, oy + s * 0.34, s, 8);
  hCtx.fillStyle = '#dedede';
  hCtx.fillRect(ox, oy + s * 0.25, s, 12);
}

function drawTile12NhaMoSilverWood(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#686157';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  for (let i = 0; i < 90; i++) {
    const x = ox + (i / 90) * s;
    const d = Math.floor((hash2i(i, 1, 1201) - 0.5) * 28);
    ctx.fillStyle = `rgb(${102 + d}, ${95 + d}, ${85 + d})`;
    ctx.fillRect(x, oy, s / 90 + 1, s);
  }
}

function drawTile13VolcanicBasalt(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#383a3e';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#7e7e7e';
  hCtx.fillRect(ox, oy, s, s);
  drawSpeckles(ctx, hCtx, ox, oy, s, 600, 1301, 'rgba(30,32,36,0.36)', 'rgba(92,96,102,0.28)', 2, 7);
}

function drawTile14HighlandLateriteSoil(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#8c583a';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  drawSpeckles(ctx, hCtx, ox, oy, s, 650, 1401, 'rgba(66,88,38,0.28)', 'rgba(162,102,64,0.28)', 2, 8);
}

function drawTile15SapphireCraterWater(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  ctx.fillStyle = '#144c78';
  ctx.fillRect(ox, oy, s, s);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(ox, oy, s, s);
  for (let i = 0; i < 65; i++) {
    const rx = ox + hash2i(i, 1, 1501) * s;
    const ry = oy + hash2i(i, 2, 1501) * s;
    const rw = 24 + hash2i(i, 3, 1501) * 58;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(92, 168, 214, 0.22)' : 'rgba(12, 42, 74, 0.24)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo(rx + rw * 0.5, ry - 4, rx + rw, ry);
    ctx.stroke();
  }
}

function drawKalaMakaraTympanumArt(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number): void {
  // Intricate high-contrast carved sandstone Kala-Makara & Dancing Apsara horseshoe relief (MR-12..15, MS-15)
  ctx.fillStyle = '#8b806c';
  ctx.fillRect(ox, oy, w, h);

  const cx = ox + w * 0.5;
  const cy = oy + h * 0.60;
  // Deep carved flame-arch shadow niche
  ctx.fillStyle = '#4a4235';
  ctx.beginPath();
  ctx.arc(cx, cy + 70, 295, Math.PI, Math.PI * 2);
  ctx.fill();
  // Concentric multi-tiered carved flame arch relief rings
  for (let r = 0; r < 3; r++) {
    ctx.strokeStyle = r === 1 ? '#e2d8c2' : '#352e24';
    ctx.lineWidth = 26 - r * 5;
    ctx.beginPath();
    ctx.arc(cx, cy + 75, 328 - r * 42, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // Central sculpted dancing Shiva / Apsara figure in tribhanga S-curve pose
  ctx.fillStyle = '#e5dcc8';
  ctx.beginPath();
  ctx.arc(cx, cy - 92, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 178);
  ctx.lineTo(cx + 28, cy - 115);
  ctx.lineTo(cx - 28, cy - 115);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e5dcc8';
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 52);
  ctx.quadraticCurveTo(cx + 24, cy + 20, cx - 14, cy + 105);
  ctx.stroke();
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(cx - 128, cy - 62);
  ctx.quadraticCurveTo(cx - 58, cy - 8, cx, cy - 42);
  ctx.quadraticCurveTo(cx + 58, cy - 8, cx + 128, cy - 62);
  ctx.stroke();
  // Carved Makara sea-monster terminals with curled snouts & foliate scrolls
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#d8ceb8';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(cx + side * 248, cy + 72, 52, 0, Math.PI * 1.6);
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
  ctx.font = `bold ${Math.round(h * 0.22)}px "Noto Serif", "Times New Roman", serif`;
  ctx.fillText(title, ox + w * 0.5, oy + h * 0.42, w - 96);
  ctx.font = `bold ${Math.round(h * 0.13)}px "Noto Serif", "Times New Roman", serif`;
  ctx.fillText(sub, ox + w * 0.5, oy + h * 0.72, w - 96);
}

export function createMySonTayNguyenMaterialPack(renderer?: THREE.WebGLRenderer): MySonTayNguyenMaterialPack {
  const allMaterials: THREE.Material[] = [];
  const allTextures: THREE.Texture[] = [];

  if (isHeadlessRenderer(renderer)) {
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0xa46c4e,
      roughness: 0.80,
      metalness: 0.06
    });
    fallbackMat.name = 'mySonTayNguyenMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      mySonTayNguyenMasterAtlasMat: fallbackMat,
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
      color: 0xa46c4e,
      roughness: 0.80,
      metalness: 0.06
    });
    fallbackMat.name = 'mySonTayNguyenMasterAtlasMat';
    allMaterials.push(fallbackMat);
    return {
      mySonTayNguyenMasterAtlasMat: fallbackMat,
      allMaterials,
      allTextures
    };
  }

  const { canvas: cCanvas, ctx } = colorTarget;
  const { canvas: hCanvas, ctx: hCtx } = heightTarget;

  ctx.fillStyle = '#7e5a44';
  ctx.fillRect(0, 0, W, H);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, W, H);

  // Row 0
  drawTile0ChamRubbedBrick(ctx, hCtx, 0, 0, S);
  drawTile1ChamSandstoneMonolith(ctx, hCtx, S, 0, S);
  drawTile2ChamCarvedPilaster(ctx, hCtx, S * 2, 0, S);
  drawTile3ChamFalseDoorArch(ctx, hCtx, S * 3, 0, S);

  // Row 1
  drawTile4QuangNamLateritePath(ctx, hCtx, 0, S, S);
  drawTile5ChamDarkInterior(ctx, hCtx, S, S, S);
  drawTile6NhaRongGrassThatch(ctx, hCtx, S * 2, S, S);
  drawTile7WovenBambooWall(ctx, hCtx, S * 3, S, S);

  // Row 2
  drawTile8TayNguyenHardwood(ctx, hCtx, 0, S * 2, S);
  drawTile9SplitBambooDeck(ctx, hCtx, S, S * 2, S);
  drawTile10ThoCamBrocade(ctx, hCtx, S * 2, S * 2, S);
  drawTile11RuouCanStoneware(ctx, hCtx, S * 3, S * 2, S);

  // Row 3
  drawTile12NhaMoSilverWood(ctx, hCtx, 0, S * 3, S);
  drawTile13VolcanicBasalt(ctx, hCtx, S, S * 3, S);
  drawTile14HighlandLateriteSoil(ctx, hCtx, S * 2, S * 3, S);
  drawTile15SapphireCraterWater(ctx, hCtx, S * 3, S * 3, S);

  // Bottom 1/3 Artworks & Carved Reliefs
  drawKalaMakaraTympanumArt(ctx, 0, 2048, 1024, 512);
  drawTile10ThoCamBrocade(ctx, hCtx, 1024, 2048, 512);
  drawTile10ThoCamBrocade(ctx, hCtx, 1536, 2048, 512);
  drawSignBoard(ctx, 0, 2560, 1024, 512, '#5a2416', '#d8b468', '#f5e2b2', 'THÁNH ĐỊA MỸ SƠN', 'DI SẢN VĂN HÓA THẾ GIỚI UNESCO');
  drawSignBoard(ctx, 1024, 2560, 1024, 512, '#3d2517', '#e5b842', '#fae298', "BIỂN HỒ T'NƯNG", 'NHÀ RÔNG — CỒNG CHIÊNG TÂY NGUYÊN');

  const mapTex = wrapCanvasTex(cCanvas, true, renderer);
  const normalTex = heightCanvasToNormalTex(hCanvas, 2.3, renderer);
  allTextures.push(mapTex, normalTex);

  const mySonTayNguyenMasterAtlasMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.88, 0.88),
    roughness: 0.78,
    metalness: 0.06
  });
  mySonTayNguyenMasterAtlasMat.name = 'mySonTayNguyenMasterAtlasMat';
  allMaterials.push(mySonTayNguyenMasterAtlasMat);

  return {
    mySonTayNguyenMasterAtlasMat,
    allMaterials,
    allTextures
  };
}
