import * as THREE from 'three';

/**
 * Ultra-Lean SINGLE-MATERIAL Museum PBR & Imperial Stele Master Atlas for
 * Hoàng Thành Thăng Long — Đoan Môn, Nền & Bậc Rồng Đá Điện Kính Thiên,
 * Nhà Con Rồng D67, Cột Cờ Hà Nội (1812), Chính Bắc Môn & Hậu Lâu (Tĩnh Bắc Lâu).
 *
 * Packs ALL 16 architectural/relief textures + ALL 11 imperial stone steles/plaques/flags
 * into ONE single 2048×3072 GPU material (`thangLongMasterAtlasMat` + Sobel `normalMap` `flipY = true`)!
 *   - Top 2/3 (y: 0..2048 -> v: 0.3333..1.0): 16 Architectural, Masonry & Dragon-Relief tiles (512×512 each)
 *   - Bottom 1/3 (y: 2048..3072 -> v: 0.0..0.3333): 11 Crisp 2K Imperial Stone Steles, Plaques, Cờ Ngũ Sắc, Vietnam Flag & D67 Map
 */

export interface ThangLongMaterialPack {
  thangLongMasterAtlasMat: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

// Top 2/3 of 2048×3072 canvas (v = 1 - y/3072):
// y: 0..512 -> v: 5/6..1 (0.8333..1.0)
// y: 512..1024 -> v: 4/6..5/6 (0.6667..0.8333)
// y: 1024..1536 -> v: 3/6..4/6 (0.5..0.6667)
// y: 1536..2048 -> v: 2/6..3/6 (0.3333..0.5)
export const THANG_LONG_RELIEF_UV = {
  thangLongBrick: [0.0, 0.8333, 0.25, 1.0],
  thanhHoaStone: [0.25, 0.8333, 0.5, 1.0],
  dragonReliefStone: [0.5, 0.8333, 0.75, 1.0],
  vongLauOchre: [0.75, 0.8333, 1.0, 1.0],

  ngoiMuiHaiRoof: [0.0, 0.6667, 0.25, 0.8333],
  terracottaHipRoof: [0.25, 0.6667, 0.5, 0.8333],
  batTrangPaving: [0.5, 0.6667, 0.75, 0.8333],
  imperialFlagstone: [0.75, 0.6667, 1.0, 0.8333],

  ironwoodGate: [0.0, 0.5, 0.25, 0.6667],
  colonialShutter: [0.25, 0.5, 0.5, 0.6667],
  piercedLattice: [0.5, 0.5, 0.75, 0.6667],
  redBronzeRelief: [0.75, 0.5, 1.0, 0.6667],

  cannonballScar: [0.0, 0.3333, 0.25, 0.5],
  courtyardLawn: [0.25, 0.3333, 0.5, 0.5],
  peelingSpandrel: [0.5, 0.3333, 0.75, 0.5],
  hoaChanhParapet: [0.75, 0.3333, 1.0, 0.5]
} as const;

export type ThangLongReliefKey = keyof typeof THANG_LONG_RELIEF_UV;

// Bottom 1/3 of 2048×3072 canvas (y: 2048..3072 -> v: 0.0..0.3333):
// Row P0 (y: 2048..2304 -> v: 0.25..0.3333)
// Row P1 (y: 2304..2560 -> v: 0.1667..0.25)
// Row P2 (y: 2560..2816 -> v: 0.0833..0.1667)
// Row P3 (y: 2816..3072 -> v: 0.0..0.0833)
export const THANG_LONG_PLAQUE_UV = {
  doanMonPlaque: [0.0, 0.25, 0.5, 0.3333],
  chinhBacMonPlaque: [0.5, 0.25, 1.0, 0.3333],

  huongMinhPlaque: [0.0, 0.1667, 0.3333, 0.25],
  nghenhHucPlaque: [0.3333, 0.1667, 0.6667, 0.25],
  hoiQuangPlaque: [0.6667, 0.1667, 1.0, 0.25],

  dienKinhThienPlaque: [0.0, 0.0833, 0.5, 0.1667],
  bacMon1882Plaque: [0.5, 0.0833, 0.75, 0.1667],
  heritageBoard: [0.75, 0.0833, 1.0, 0.1667],

  vietnamFlag: [0.0, 0.0, 0.375, 0.0833],
  coNguSac: [0.375, 0.0, 0.6875, 0.0833],
  d67BattleMap: [0.6875, 0.0, 1.0, 0.0833]
} as const;

export type ThangLongPlaqueKey = keyof typeof THANG_LONG_PLAQUE_UV;

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

function drawCloudScroll(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  fill: string,
  stroke: string,
  lw: number,
  flip = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * flip, scale);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw / Math.max(0.25, scale);
  ctx.beginPath();
  ctx.moveTo(-22, 6);
  ctx.bezierCurveTo(-24, -14, -4, -18, 2, -6);
  ctx.bezierCurveTo(10, -18, 28, -10, 22, 8);
  ctx.bezierCurveTo(16, 18, -14, 18, -22, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function createThangLongMasterAtlas(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
} {
  if (isHeadlessRenderer(renderer)) {
    return {
      map: finalizeDataTex(new Uint8Array([152, 108, 86, 255]), 1, 1, true, renderer),
      normalMap: finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer)
    };
  }
  const w = 2048;
  const h = 3072;
  const cObj = makeCanvas(w, h);
  const hObj = makeCanvas(w, h);
  if (!cObj || !hObj) {
    return {
      map: finalizeDataTex(new Uint8Array([152, 108, 86, 255]), 1, 1, true, renderer),
      normalMap: finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer)
    };
  }
  const c = cObj.ctx;
  const ht = hObj.ctx;
  c.fillStyle = '#785a4a';
  c.fillRect(0, 0, w, h);
  ht.fillStyle = '#808080';
  ht.fillRect(0, 0, w, h);

  const cell = 512;

  // ---- (0,0) THĂNG LONG AGED *GẠCH VỒ* BRICK WITH MOSS & RAIN STREAKS ----
  {
    const x0 = 0;
    const y0 = 0;
    c.fillStyle = '#6b6258';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#3c3c3c';
    ht.fillRect(x0, y0, cell, cell);
    const rows = 18;
    const cols = 8;
    const rh = cell / rows;
    const cw = cell / cols;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const bx = x0 + col * cw + shift;
        const by = y0 + r * rh;
        const h1 = hash2i(col + 17, r, 1010);
        const h2 = hash2i(col + 31, r, 1020);
        const isDark = h2 < 0.22;
        const cr = clampByte((isDark ? 98 : 148) + (h1 - 0.5) * 44);
        const cg = clampByte((isDark ? 72 : 90) + (h1 - 0.5) * 30);
        const cb = clampByte((isDark ? 58 : 70) + (h1 - 0.5) * 24);
        const rx = Math.max(x0, bx + 2.5);
        const rw = Math.min(cw - 5, x0 + cell - rx);
        if (rw > 1) {
          c.fillStyle = `rgb(${cr},${cg},${cb})`;
          c.fillRect(rx, by + 2.5, rw, rh - 5);
          const hv = clampByte(170 + (h1 - 0.5) * 54);
          ht.fillStyle = `rgb(${hv},${hv},${hv})`;
          ht.fillRect(rx, by + 2.5, rw, rh - 5);
        }
      }
    }
    for (let s = 0; s < 16; s++) {
      const sx = x0 + hash2i(s, 1, 1030) * cell;
      const sw = 14 + hash2i(s, 2, 1030) * 32;
      const sh = 160 + hash2i(s, 3, 1030) * 320;
      const g = c.createLinearGradient(sx, y0, sx, y0 + sh);
      g.addColorStop(0, 'rgba(34, 38, 28, 0.36)');
      g.addColorStop(0.55, 'rgba(42, 46, 32, 0.16)');
      g.addColorStop(1, 'rgba(42, 46, 32, 0.0)');
      c.fillStyle = g;
      c.fillRect(sx - sw * 0.5, y0, sw, sh);
    }
    const baseMoss = c.createLinearGradient(0, y0 + cell * 0.72, 0, y0 + cell);
    baseMoss.addColorStop(0, 'rgba(38, 48, 30, 0)');
    baseMoss.addColorStop(1, 'rgba(34, 44, 26, 0.32)');
    c.fillStyle = baseMoss;
    c.fillRect(x0, y0 + cell * 0.72, cell, cell * 0.28);
  }

  // ---- (1,0) THANH HÓA WEATHERED BLUE-GREY ASHLAR LIMESTONE ----
  {
    const x0 = 512;
    const y0 = 0;
    c.fillStyle = '#4e524a';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#363636';
    ht.fillRect(x0, y0, cell, cell);
    const rows = 8;
    const cols = 4;
    const rh = cell / rows;
    const cw = cell / cols;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.45);
      for (let col = -1; col <= cols; col++) {
        const bx = x0 + col * cw + shift;
        const by = y0 + r * rh;
        const h1 = hash2i(col + 9, r, 1101);
        const cr = clampByte(132 + (h1 - 0.5) * 28);
        const cg = clampByte(136 + (h1 - 0.5) * 28);
        const cb = clampByte(126 + (h1 - 0.5) * 24);
        const rx = Math.max(x0, bx + 3);
        const rw = Math.min(cw - 6, x0 + cell - rx);
        if (rw > 1) {
          c.fillStyle = `rgb(${cr},${cg},${cb})`;
          c.fillRect(rx, by + 3, rw, rh - 6);
          const hv = clampByte(184 + (h1 - 0.5) * 34);
          ht.fillStyle = `rgb(${hv},${hv},${hv})`;
          ht.fillRect(rx, by + 3, rw, rh - 6);
        }
      }
    }
    for (let i = 0; i < 45; i++) {
      const px = x0 + hash2i(i, 1, 1108) * cell;
      const py = y0 + hash2i(i, 2, 1108) * cell;
      const pr = 8 + hash2i(i, 3, 1108) * 24;
      c.fillStyle = i % 3 === 0 ? 'rgba(66, 78, 54, 0.22)' : 'rgba(178, 182, 168, 0.16)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (2,0) LÊ-DYNASTY CARVED STONE DRAGON *MÂY ĐAO MÁC* CLOUD-FLAME RELIEF ----
  {
    const x0 = 1024;
    const y0 = 0;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#565656' : '#727a6c';
      ctx.fillRect(x0, y0, cell, cell);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const cx = x0 + 54 + col * 102 + (row % 2) * 36;
          const cy = y0 + 54 + row * 102;
          if (cx < x0 + cell - 24) {
            drawCloudScroll(
              ctx,
              cx,
              cy,
              1.65,
              isH ? '#d8d8d8' : (row + col) % 2 === 0 ? '#929b8a' : '#808a78',
              isH ? '#282828' : '#4a5244',
              3.2,
              col % 2 === 0 ? 1 : -1
            );
          }
        }
      }
      ctx.strokeStyle = isH ? '#eaeaea' : '#a4ac9a';
      ctx.lineWidth = 10;
      ctx.strokeRect(x0 + 14, y0 + 14, cell - 28, cell - 28);
    }
    for (let i = 0; i < 36; i++) {
      const px = x0 + hash2i(i, 4, 1205) * cell;
      const py = y0 + hash2i(i, 5, 1205) * cell;
      const pr = 12 + hash2i(i, 6, 1205) * 28;
      c.fillStyle = i % 2 === 0 ? 'rgba(46, 56, 38, 0.24)' : 'rgba(182, 188, 170, 0.18)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (3,0) AGED HANOI IMPERIAL GOLDEN-OCHRE LIME PLASTER ----
  {
    const x0 = 1536;
    const y0 = 0;
    c.fillStyle = '#d4b86a';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#808080';
    ht.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 70; i++) {
      const px = x0 + hash2i(i, 1, 1301) * cell;
      const py = y0 + hash2i(i, 2, 1301) * cell;
      const pr = 18 + hash2i(i, 3, 1301) * 48;
      c.fillStyle = i % 2 === 0 ? 'rgba(196, 164, 84, 0.18)' : 'rgba(232, 212, 146, 0.16)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
      ht.fillStyle = i % 2 === 0 ? 'rgba(148,148,148,0.16)' : 'rgba(108,108,108,0.16)';
      ht.beginPath();
      ht.arc(px, py, pr * 0.65, 0, Math.PI * 2);
      ht.fill();
    }
    for (let s = 0; s < 14; s++) {
      const sx = x0 + hash2i(s, 7, 1309) * cell;
      const sw = 10 + hash2i(s, 8, 1309) * 24;
      const sh = 110 + hash2i(s, 9, 1309) * 240;
      const g = c.createLinearGradient(sx, y0, sx, y0 + sh);
      g.addColorStop(0, 'rgba(72, 64, 42, 0.30)');
      g.addColorStop(1, 'rgba(72, 64, 42, 0)');
      c.fillStyle = g;
      c.fillRect(sx - sw * 0.5, y0, sw, sh);
    }
  }

  // ---- (0,1) DARK AGED BROWN-GREY *NGÓI MŨI HÀI* ROOF TILES ----
  {
    const x0 = 0;
    const y0 = 512;
    c.fillStyle = '#382a24';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#3a3a3a';
    ht.fillRect(x0, y0, cell, cell);
    const cols = 16;
    const rows = 14;
    const cw = cell / cols;
    const rh = cell / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const tx = x0 + col * cw + shift;
        const ty = y0 + r * rh;
        const h1 = hash2i(col + 12, r, 1401);
        c.fillStyle = `rgb(${clampByte(96 + (h1 - 0.5) * 32)},${clampByte(66 + (h1 - 0.5) * 24)},${clampByte(56 + (h1 - 0.5) * 20)})`;
        c.beginPath();
        c.moveTo(tx + 2, ty);
        c.lineTo(tx + cw - 2, ty);
        c.lineTo(tx + cw - 2, ty + rh * 0.72);
        c.quadraticCurveTo(tx + cw * 0.5, ty + rh * 1.08, tx + 2, ty + rh * 0.72);
        c.closePath();
        c.fill();
        ht.fillStyle = '#c8c8c8';
        ht.beginPath();
        ht.moveTo(tx + 3, ty + 2);
        ht.lineTo(tx + cw - 3, ty + 2);
        ht.lineTo(tx + cw - 3, ty + rh * 0.7);
        ht.quadraticCurveTo(tx + cw * 0.5, ty + rh * 1.02, tx + 3, ty + rh * 0.7);
        ht.closePath();
        ht.fill();
      }
    }
  }

  // ---- (1,1) COLONIAL TERRACOTTA-RED HIPPED ROOF TILES ----
  {
    const x0 = 512;
    const y0 = 512;
    c.fillStyle = '#5a241a';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#404040';
    ht.fillRect(x0, y0, cell, cell);
    const cols = 18;
    const rows = 14;
    const cw = cell / cols;
    const rh = cell / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const tx = x0 + col * cw;
        const ty = y0 + r * rh;
        const h1 = hash2i(col, r, 1502);
        c.fillStyle = `rgb(${clampByte(174 + (h1 - 0.5) * 34)},${clampByte(72 + (h1 - 0.5) * 20)},${clampByte(50 + (h1 - 0.5) * 16)})`;
        c.fillRect(tx + 2, ty + 2, cw - 4, rh - 4);
        ht.fillStyle = '#d4d4d4';
        ht.fillRect(tx + 3, ty + 2, cw - 6, rh - 5);
      }
    }
  }

  // ---- (2,1) 30×30cm BÁT TRÀNG TERRACOTTA PAVING TILES ----
  {
    const x0 = 1024;
    const y0 = 512;
    c.fillStyle = '#483b32';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#424242';
    ht.fillRect(x0, y0, cell, cell);
    const n = 8;
    const step = cell / n;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        const h1 = hash2i(col, r, 1603);
        const h2 = hash2i(col + 20, r, 1607);
        c.fillStyle = `rgb(${clampByte(154 + (h1 - 0.5) * 34)},${clampByte(82 + (h1 - 0.5) * 24)},${clampByte(62 + (h1 - 0.5) * 18)})`;
        c.fillRect(x0 + col * step + 3, y0 + r * step + 3, step - 6, step - 6);
        const hv = clampByte(176 + (h2 - 0.5) * 28);
        ht.fillStyle = `rgb(${hv},${hv},${hv})`;
        ht.fillRect(x0 + col * step + 3, y0 + r * step + 3, step - 6, step - 6);
      }
    }
  }

  // ---- (3,1) IMPERIAL BLUE-STONE FLAGSTONES & CHARIOT WHEEL-RUTS ----
  {
    const x0 = 1536;
    const y0 = 512;
    c.fillStyle = '#3f443c';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#3e3e3e';
    ht.fillRect(x0, y0, cell, cell);
    const rows = 8;
    const cols = 4;
    const rh = cell / rows;
    const cw = cell / cols;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const bx = x0 + col * cw + shift;
        const by = y0 + r * rh;
        const h1 = hash2i(col + 5, r, 1701);
        const rx = Math.max(x0, bx + 4);
        const rw = Math.min(cw - 8, x0 + cell - rx);
        if (rw > 1) {
          c.fillStyle = `rgb(${clampByte(116 + (h1 - 0.5) * 26)},${clampByte(120 + (h1 - 0.5) * 26)},${clampByte(114 + (h1 - 0.5) * 22)})`;
          c.fillRect(rx, by + 4, rw, rh - 8);
          ht.fillStyle = '#b8b8b8';
          ht.fillRect(rx, by + 4, rw, rh - 8);
        }
      }
    }
    for (const wx of [0.28, 0.72]) {
      c.fillStyle = 'rgba(54, 58, 52, 0.24)';
      c.fillRect(x0 + cell * wx - 22, y0, 44, cell);
      ht.fillStyle = 'rgba(62, 62, 62, 0.35)';
      ht.fillRect(x0 + cell * wx - 18, y0, 36, cell);
    }
  }

  // ---- (0,2) IRONWOOD (*GỖ LIM*) GATE LEAVES WITH BATTENS & IRON STUDS ----
  {
    const x0 = 0;
    const y0 = 1024;
    c.fillStyle = '#2d1c14';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#505050';
    ht.fillRect(x0, y0, cell, cell);
    const planks = 7;
    const pw = cell / planks;
    for (let p = 0; p < planks; p++) {
      const h1 = hash2i(p, 1, 1801);
      c.fillStyle = `rgb(${clampByte(66 + (h1 - 0.5) * 20)},${clampByte(42 + (h1 - 0.5) * 14)},${clampByte(30 + (h1 - 0.5) * 12)})`;
      c.fillRect(x0 + p * pw + 3, y0, pw - 6, cell);
      ht.fillStyle = '#9c9c9c';
      ht.fillRect(x0 + p * pw + 3, y0, pw - 6, cell);
    }
    for (const byFrac of [0.18, 0.5, 0.82]) {
      const by = y0 + cell * byFrac;
      c.fillStyle = '#241610';
      c.fillRect(x0, by - 22, cell, 44);
      ht.fillStyle = '#c8c8c8';
      ht.fillRect(x0, by - 20, cell, 40);
      for (let st = 0; st < 5; st++) {
        const sx = x0 + 52 + st * 102;
        c.fillStyle = '#1e1d1c';
        c.beginPath();
        c.arc(sx, by, 14, 0, Math.PI * 2);
        c.fill();
        ht.fillStyle = '#f4f4f4';
        ht.beginPath();
        ht.arc(sx, by, 14, 0, Math.PI * 2);
        ht.fill();
      }
    }
  }

  // ---- (1,2) HANOI COLONIAL FOREST-GREEN LOUVERED FRENCH SHUTTERS ----
  {
    const x0 = 512;
    const y0 = 1024;
    c.fillStyle = '#1d3c2e';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#606060';
    ht.fillRect(x0, y0, cell, cell);
    c.strokeStyle = '#12281e';
    c.lineWidth = 14;
    c.strokeRect(x0 + 16, y0 + 16, cell * 0.5 - 22, cell - 32);
    c.strokeRect(x0 + cell * 0.5 + 6, y0 + 16, cell * 0.5 - 22, cell - 32);
    for (let sl = 0; sl < 22; sl++) {
      const sy = y0 + 42 + sl * 20;
      c.fillStyle = sl % 2 === 0 ? '#2b5440' : '#163024';
      c.fillRect(x0 + 34, sy, cell * 0.5 - 58, 11);
      c.fillRect(x0 + cell * 0.5 + 24, sy, cell * 0.5 - 58, 11);
      ht.fillStyle = '#d0d0d0';
      ht.fillRect(x0 + 34, sy, cell * 0.5 - 58, 8);
      ht.fillRect(x0 + cell * 0.5 + 24, sy, cell * 0.5 - 58, 8);
    }
  }

  // ---- (2,2) WHITEWASHED PIERCED GEOMETRIC *HOA GIÓ* LATTICE SCREEN ----
  {
    const x0 = 1024;
    const y0 = 1024;
    c.fillStyle = '#201a16';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#202020';
    ht.fillRect(x0, y0, cell, cell);
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.strokeStyle = isH ? '#ececec' : '#ebe6d6';
      ctx.lineWidth = 18;
      ctx.strokeRect(x0 + 14, y0 + 14, cell - 28, cell - 28);
      const step = cell / 4;
      ctx.lineWidth = 14;
      for (let r = 0; r < 4; r++) {
        for (let col = 0; col < 4; col++) {
          const cx = x0 + (col + 0.5) * step;
          const cy = y0 + (r + 0.5) * step;
          ctx.beginPath();
          ctx.moveTo(cx, cy - step * 0.46);
          ctx.lineTo(cx + step * 0.46, cy);
          ctx.lineTo(cx, cy + step * 0.46);
          ctx.lineTo(cx - step * 0.46, cy);
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, step * 0.16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  // ---- (3,2) ANTIQUE RED-BROWN CAST-BRONZE DRAGON & KEY-FRET RELIEF ----
  {
    const x0 = 1536;
    const y0 = 1024;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#5a5a5a' : '#4a261c';
      ctx.fillRect(x0, y0, cell, cell);
      ctx.strokeStyle = isH ? '#e2e2e2' : '#8e5436';
      ctx.lineWidth = 8;
      for (let k = 0; k < 8; k++) {
        ctx.strokeRect(x0 + 16 + k * 60, y0 + 24, 46, 54);
        ctx.strokeRect(x0 + 28 + k * 60, y0 + 36, 22, 30);
      }
      drawCloudScroll(ctx, x0 + 135, y0 + 270, 2.5, isH ? '#dadada' : '#7c462c', isH ? '#282828' : '#2e1610', 3.5, 1);
      drawCloudScroll(ctx, x0 + 377, y0 + 270, 2.5, isH ? '#dadada' : '#7c462c', isH ? '#282828' : '#2e1610', 3.5, -1);
      ctx.fillStyle = isH ? '#f0f0f0' : '#a86a42';
      ctx.beginPath();
      ctx.arc(x0 + 256, y0 + 250, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- (0,3) 1882 FRENCH CANNONBALL IMPACT SCAR CRATER ----
  {
    const x0 = 0;
    const y0 = 1536;
    c.fillStyle = '#7e5242';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#b4b4b4';
    ht.fillRect(x0, y0, cell, cell);
    const cx = x0 + cell * 0.5;
    const cy = y0 + cell * 0.5;
    const g = c.createRadialGradient(cx, cy, 18, cx, cy, 195);
    g.addColorStop(0, '#2a221c');
    g.addColorStop(0.45, '#5a4e42');
    g.addColorStop(0.76, '#845846');
    g.addColorStop(1, 'rgba(126, 82, 66, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 200, 0, Math.PI * 2);
    c.fill();
    const hg = ht.createRadialGradient(cx, cy, 18, cx, cy, 195);
    hg.addColorStop(0, '#101010');
    hg.addColorStop(0.55, '#484848');
    hg.addColorStop(1, '#b4b4b4');
    ht.fillStyle = hg;
    ht.beginPath();
    ht.arc(cx, cy, 200, 0, Math.PI * 2);
    ht.fill();
  }

  // ---- (1,3) MANICURED IMPERIAL COURTYARD LAWN ----
  {
    const x0 = 512;
    const y0 = 1536;
    c.fillStyle = '#4e7634';
    c.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 160; i++) {
      const px = x0 + hash2i(i, 1, 1901) * cell;
      const py = y0 + hash2i(i, 2, 1901) * cell;
      const pr = 8 + hash2i(i, 3, 1901) * 26;
      c.fillStyle = i % 2 === 0 ? 'rgba(62, 96, 38, 0.25)' : 'rgba(104, 134, 58, 0.22)';
      c.beginPath();
      c.arc(px, py, pr, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (2,3) PEELING LIME-PLASTER PORTAL SPANDREL ----
  {
    const x0 = 1024;
    const y0 = 1536;
    c.fillStyle = '#cfc5b2';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#b4b4b4';
    ht.fillRect(x0, y0, cell, cell);
    for (let i = 0; i < 18; i++) {
      const px = x0 + hash2i(i, 1, 1955) * cell;
      const py = y0 + hash2i(i, 2, 1955) * cell;
      const rw = 36 + hash2i(i, 3, 1955) * 90;
      const rh = 22 + hash2i(i, 4, 1955) * 58;
      c.fillStyle = i % 3 === 0 ? 'rgba(84, 54, 42, 0.55)' : 'rgba(116, 108, 92, 0.35)';
      c.fillRect(px - rw * 0.5, py - rh * 0.5, rw, rh);
      ht.fillStyle = '#5c5c5c';
      ht.fillRect(px - rw * 0.5, py - rh * 0.5, rw, rh);
    }
  }

  // ---- (3,3) PIERCED *HOA CHANH* DIAMOND-LATTICE BRICK PARAPET ----
  {
    const x0 = 1536;
    const y0 = 1536;
    c.fillStyle = '#2a221c';
    c.fillRect(x0, y0, cell, cell);
    ht.fillStyle = '#242424';
    ht.fillRect(x0, y0, cell, cell);
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#dcdcdc' : '#b27858';
      ctx.fillRect(x0, y0, cell, 68);
      ctx.fillRect(x0, y0 + cell - 68, cell, 68);
      ctx.strokeStyle = isH ? '#dcdcdc' : '#b27858';
      ctx.lineWidth = 22;
      const cols = 6;
      const step = cell / cols;
      for (let col = 0; col <= cols; col++) {
        const cx = x0 + col * step;
        ctx.beginPath();
        ctx.moveTo(cx, y0 + 60);
        ctx.lineTo(cx + step * 0.5, y0 + cell * 0.5);
        ctx.lineTo(cx, y0 + cell - 60);
        ctx.lineTo(cx - step * 0.5, y0 + cell * 0.5);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // =================================================================================================
  // BOTTOM 1/3 (y: 2048..3072): 11 CRISP 2K IMPERIAL STONE STELES, PLAQUES, FLAGS & D67 MAP
  // (Flat neutral normal '#808080' for clean legibility!)
  // =================================================================================================
  const py0 = 2048;
  const drawPlaque = (
    x: number,
    y: number,
    pw: number,
    ph: number,
    bg: string,
    border: string,
    fg: string,
    text: string,
    fontPx: number,
    subText?: string,
    subPx?: number
  ) => {
    c.fillStyle = bg;
    c.fillRect(x, y, pw, ph);
    c.strokeStyle = border;
    c.lineWidth = 12;
    c.strokeRect(x + 14, y + 14, pw - 28, ph - 28);
    c.lineWidth = 4;
    c.strokeRect(x + 28, y + 28, pw - 56, ph - 56);
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${fontPx}px "KaiTi", "SimSun", "Times New Roman", serif`;
    if (subText) {
      c.fillText(text, x + pw * 0.5, y + ph * 0.36);
      c.font = `bold ${subPx ?? Math.round(fontPx * 0.45)}px "Times New Roman", "Segoe UI", serif`;
      c.fillText(subText, x + pw * 0.5, y + ph * 0.72);
    } else {
      c.fillText(text, x + pw * 0.5, y + ph * 0.52);
    }
  };

  // Row P0 (y: 2048..2304): Đoan Môn "門 端" & Chính Bắc Môn "門 北 正"
  drawPlaque(0, py0, 1024, 256, '#b8b4a6', '#6e6a5e', '#343028', '門   端', 150);
  drawPlaque(1024, py0, 1024, 256, '#b4b0a2', '#6a665a', '#302c26', '門   北   正', 136);

  // Row P1 (y: 2304..2560): Cột Cờ Hà Nội 3 portal stone plaques ("明 向", "旭 迎", "光 回")
  drawPlaque(0, py0 + 256, 682, 256, '#c6bfb0', '#7c7464', '#383028', '明   向', 124);
  drawPlaque(682, py0 + 256, 684, 256, '#c6bfb0', '#7c7464', '#383028', '旭   迎', 124);
  drawPlaque(1366, py0 + 256, 682, 256, '#c6bfb0', '#7c7464', '#383028', '光   回', 124);

  // Row P2 (y: 2560..2816): Điện Kính Thiên royal plaque, 25 Avril 1882, Heritage board
  drawPlaque(0, py0 + 512, 1024, 256, '#7a1612', '#e8be42', '#fae078', '敬   天   殿', 110, 'ĐIỆN KÍNH THIÊN', 44);
  drawPlaque(1024, py0 + 512, 512, 256, '#bcb6a6', '#746e60', '#3a342c', '25 AVRIL', 56, '1882', 64);
  drawPlaque(1536, py0 + 512, 512, 256, '#3c2a1e', '#c8a042', '#f2d684', 'HOÀNG THÀNH', 40, 'THĂNG LONG', 40);

  // Row P3 (y: 2816..3072): Vietnam Flag (0..768), Cờ Ngũ Sắc (768..1408), D67 Campaign Map (1408..2048)
  {
    const fx = 0;
    const fy = py0 + 768;
    const fw = 768;
    const fh = 256;
    c.fillStyle = '#da251d';
    c.fillRect(fx, fy, fw, fh);
    const sx = fx + fw * 0.5;
    const sy = fy + fh * 0.52;
    const rOut = 88;
    const rIn = 34;
    c.fillStyle = '#ffff00';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? rOut : rIn;
      const px = sx + Math.cos(a) * r;
      const py = sy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }
  {
    const fx = 768;
    const fy = py0 + 768;
    const fw = 640;
    const fh = 256;
    const rings = ['#e6b422', '#2662b8', '#2a8c3c', '#f2efe4', '#c82018'];
    for (let i = 0; i < rings.length; i++) {
      const insetX = i * 44;
      const insetY = i * 20;
      c.fillStyle = rings[i];
      c.fillRect(fx + insetX, fy + insetY, fw - insetX * 2, fh - insetY * 2);
    }
    c.fillStyle = '#f8da58';
    c.font = 'bold 74px "KaiTi", "SimSun", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('龍', fx + fw * 0.5, fy + fh * 0.52);
  }
  {
    const mx = 1408;
    const my = py0 + 768;
    const mw = 640;
    const mh = 256;
    c.fillStyle = '#dfd2b0';
    c.fillRect(mx, my, mw, mh);
    c.strokeStyle = '#6c5a3e';
    c.lineWidth = 10;
    c.strokeRect(mx + 8, my + 8, mw - 16, mh - 16);
    c.strokeStyle = '#4a7a9a';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(mx + 260, my + 24);
    c.bezierCurveTo(mx + 440, my + 78, mx + 460, my + 168, mx + 290, my + 232);
    c.stroke();
    c.strokeStyle = '#c81c18';
    c.lineWidth = 7;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(mx + 140, my + 58 + k * 58);
      c.lineTo(mx + 370, my + 82 + k * 52);
      c.stroke();
    }
  }

  return {
    map: wrapCanvasTex(cObj.canvas, true, renderer),
    normalMap: heightCanvasToNormalTex(hObj.canvas, 2.1, renderer)
  };
}

/**
 * Creates the ultra-lean SINGLE-MATERIAL Hoàng Thành Thăng Long Museum Master Atlas Pack.
 */
export function createThangLongMaterialPack(renderer?: THREE.WebGLRenderer): ThangLongMaterialPack {
  const master = createThangLongMasterAtlas(renderer);
  const thangLongMasterAtlasMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: master.map,
    normalMap: master.normalMap,
    normalScale: new THREE.Vector2(1.85, 1.85),
    roughness: 0.80,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  return {
    thangLongMasterAtlasMat,
    allMaterials: [thangLongMasterAtlasMat],
    allTextures: [master.map, master.normalMap]
  };
}
