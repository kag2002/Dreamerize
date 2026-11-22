import * as THREE from 'three';

/**
 * Ultra-Lean 3-Material Museum PBR & Calligraphy Texture Pack for
 * Phố Cổ Hội An — Chùa Cầu (Lai Viễn Kiều), Miếu Bắc Đế Trấn Võ,
 * Nhà Cổ Tấn Ký (101 Nguyễn Thái Học), Tam Quan Hội Quán Phúc Kiến & Sông Hoài.
 *
 * Implements the visual material & ornament fidelity for all 128 QC audit items
 * (`CC-01..32`, `BD-01..32`, `TK-01..32`, `HA-01..32`) using ONLY 3 GPU materials:
 *   1. `hoiAnReliefAtlasMat` — 2048×2048 15-in-1 Architectural, Relief, Nacre & Porcelain Atlas + Sobel Normal
 *   2. `hoiAnCalligraphyMat` — 1024×1536 Packed Signage, Couplets, Heritage Boards & Illuminated Lantern Panel Atlas
 *   3. `hoiAnSilkLanternMat` — Upgraded Bamboo-Ribbed Translucent Silk Lantern Shader with Sway & Brocade Shading
 */

export interface HoiAnMaterialPack {
  hoiAnReliefAtlasMat: THREE.MeshStandardMaterial;
  hoiAnCalligraphyMat: THREE.MeshStandardMaterial;
  hoiAnSilkLanternMat: THREE.MeshStandardMaterial;
  lanternTimeUniform: { uTime: { value: number } };
  allMaterials: THREE.Material[];
  allTextures: THREE.Texture[];
}

export const HOI_AN_RELIEF_UV = {
  chuaCauRoof: [0.0, 0.75, 0.5, 1.0],
  mustardOchreWall: [0.5, 0.75, 0.75, 1.0],
  weatheredTimber: [0.75, 0.75, 1.0, 1.0],
  bacDeMural: [0.0, 0.5, 0.25, 0.75],
  bacDeKhamCarving: [0.25, 0.5, 0.5, 0.75],
  tanKyNacre: [0.5, 0.5, 0.75, 0.75],
  tanKySilkScreen: [0.75, 0.5, 1.0, 0.75],
  porcelainCobalt: [0.0, 0.25, 0.25, 0.5],
  phucKienBrick: [0.25, 0.25, 0.5, 0.5],
  ceramicMosaic: [0.5, 0.25, 0.75, 0.5],
  incenseBasin: [0.75, 0.25, 1.0, 0.5],
  ngoiChieu: [0.0, 0.0, 0.25, 0.25],
  gachTauFloor: [0.25, 0.0, 0.5, 0.25],
  matCuaSpiral: [0.5, 0.0, 0.75, 0.25],
  mossyYinYangRoof: [0.75, 0.0, 1.0, 0.25]
} as const;

export type HoiAnReliefKey = keyof typeof HOI_AN_RELIEF_UV;

export const HOI_AN_SIGN_UV = {
  laiVienKieu: [0.0, 0.8333, 0.5, 1.0],
  phucKienMain: [0.5, 0.8333, 1.0, 1.0],
  tanKySign: [0.0, 0.6667, 0.5, 0.8333],
  kimSonTu: [0.5, 0.6667, 0.75, 0.8333],
  house101: [0.75, 0.6667, 1.0, 0.8333],
  tanKyHeritageBoard: [0.0, 0.3333, 0.375, 0.6667],
  tanKyCerts: [0.375, 0.44, 0.6875, 0.6667],
  weakChairs: [0.375, 0.3333, 0.6875, 0.44],
  octagonalWindow: [0.6875, 0.48, 1.0, 0.6667],
  palaceLanternFace: [0.6875, 0.3333, 1.0, 0.48],
  bacDeInnerL: [0.0, 0.0, 0.125, 0.3333],
  bacDeInnerR: [0.125, 0.0, 0.25, 0.3333],
  bacDeOuterL: [0.25, 0.0, 0.375, 0.3333],
  bacDeOuterR: [0.375, 0.0, 0.5, 0.3333],
  tanKyCoupletNacre: [0.5, 0.0, 0.625, 0.3333],
  tanKyCoupletRed: [0.625, 0.0, 0.75, 0.3333],
  shopSign1: [0.75, 0.25, 1.0, 0.3333],
  shopSign2: [0.75, 0.1667, 1.0, 0.25],
  shopSign3: [0.75, 0.0833, 1.0, 0.1667],
  shopSign4: [0.75, 0.0, 1.0, 0.0833]
} as const;

export type HoiAnSignKey = keyof typeof HOI_AN_SIGN_UV;

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

function canvasToSobelNormal(
  canvas: HTMLCanvasElement,
  strength: number,
  renderer?: THREE.WebGLRenderer
): THREE.DataTexture {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer);
  }
  const src = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    lum[i] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
  }
  const normalData = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number): number => {
    const wx = Math.max(0, Math.min(w - 1, x));
    const wy = Math.max(0, Math.min(h - 1, y));
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
  return finalizeDataTex(normalData, w, h, false, renderer);
}

function drawCloudScroll(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sc: number,
  fill: string,
  stroke: string,
  lw: number,
  flipX = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(flipX * sc, sc);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw / Math.max(0.25, sc);
  ctx.beginPath();
  ctx.moveTo(-26, 4);
  ctx.bezierCurveTo(-28, -14, -6, -18, 2, -6);
  ctx.bezierCurveTo(8, -16, 26, -12, 24, 4);
  ctx.bezierCurveTo(22, 14, 6, 14, 0, 8);
  ctx.bezierCurveTo(-6, 15, -24, 14, -26, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * 1. Builds the 2048×2048 15-in-1 Hội An Architectural, Relief, Nacre & Porcelain Atlas + Sobel Normal Map.
 */
function createHoiAnReliefAtlas(renderer?: THREE.WebGLRenderer): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
} {
  const headless = isHeadlessRenderer(renderer);
  const sz = headless ? 256 : 2048;
  const cObj = makeCanvas(sz, sz);
  const hObj = makeCanvas(sz, sz);
  if (!cObj || !hObj) {
    return {
      map: finalizeDataTex(new Uint8Array([198, 154, 72, 255]), 1, 1, true, renderer),
      normalMap: finalizeDataTex(new Uint8Array([128, 128, 255, 255]), 1, 1, false, renderer)
    };
  }
  const S = sz / 2048;
  const c = cObj.ctx;
  const ht = hObj.ctx;
  c.fillStyle = '#c8a056';
  c.fillRect(0, 0, sz, sz);
  ht.fillStyle = '#808080';
  ht.fillRect(0, 0, sz, sz);

  // ---- (1) CHÙA CẦU ROOF: Warm Terracotta *Ngói Âm Dương* + Crisp White Lime-Mortar Vertical Stripes (x:0..1024, y:0..512) ----
  {
    const x0 = 0;
    const y0 = 0;
    const w = 1024 * S;
    const h = 512 * S;
    c.fillStyle = '#b44f2c';
    c.fillRect(x0, y0, w, h);
    ht.fillStyle = '#606060';
    ht.fillRect(x0, y0, w, h);
    const cols = 20;
    const rows = 14;
    const cw = w / cols;
    const rh = h / rows;
    for (let col = 0; col < cols; col++) {
      const cx = x0 + col * cw;
      for (let row = 0; row < rows; row++) {
        const ry = y0 + row * rh;
        const tv = hash2i(col, row, 1901);
        const r = clampByte(178 + (tv - 0.5) * 34);
        const g = clampByte(78 + (tv - 0.5) * 20);
        const b = clampByte(46 + (tv - 0.5) * 14);
        c.fillStyle = `rgb(${r},${g},${b})`;
        c.fillRect(cx + 3 * S, ry + 2 * S, cw - 6 * S, rh - 3 * S);
        // Dark horizontal overlap lip shadow
        c.fillStyle = 'rgba(54, 22, 12, 0.42)';
        c.fillRect(cx + 3 * S, ry + rh - 5 * S, cw - 6 * S, 4 * S);
        ht.fillStyle = '#909090';
        ht.fillRect(cx + 4 * S, ry + 2 * S, cw - 8 * S, rh - 4 * S);
      }
      // Iconic bright off-white lime-mortar vertical rib stripes (Ref 19 signature!)
      const isStrongRib = col % 2 === 0;
      const ribW = (isStrongRib ? 14 : 7) * S;
      c.fillStyle = isStrongRib ? '#ebe6dc' : '#d6cfc2';
      c.fillRect(cx - ribW * 0.5, y0, ribW, h);
      c.fillStyle = 'rgba(60, 28, 16, 0.28)';
      c.fillRect(cx + ribW * 0.5, y0, 3 * S, h);
      ht.fillStyle = isStrongRib ? '#f0f0f0' : '#cccccc';
      ht.fillRect(cx - ribW * 0.5, y0, ribW, h);
    }
    // White circular eave tile end-caps along bottom edge
    for (let col = 0; col < cols; col++) {
      const ex = x0 + (col + 0.5) * cw;
      c.fillStyle = '#ece8df';
      c.beginPath();
      c.arc(ex, y0 + h - 14 * S, 11 * S, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#7e3c24';
      c.lineWidth = 2.5 * S;
      c.stroke();
    }
  }

  // ---- (2) MUSTARD-OCHRE HỘI AN LIMEWASH WALL + RAIN STREAKS + DAMP MOSSY BASE (x:1024..1536, y:0..512) ----
  {
    const x0 = 1024 * S;
    const y0 = 0;
    const s = 512 * S;
    const grad = c.createLinearGradient(x0, y0, x0, y0 + s);
    grad.addColorStop(0.0, '#d8a21e');
    grad.addColorStop(0.65, '#e2b22c');
    grad.addColorStop(0.86, '#bfa038');
    grad.addColorStop(1.0, '#444b2c');
    c.fillStyle = grad;
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#888888';
    ht.fillRect(x0, y0, s, s);
    // Subtle aged lime plaster mottling & vertical tropical rain streaks
    for (let i = 0; i < 90; i++) {
      const rx = x0 + hash2i(i, 1, 8401) * s;
      const ry = y0 + hash2i(i, 2, 8401) * s;
      const rw = (10 + hash2i(i, 3, 8401) * 44) * S;
      const rh = (16 + hash2i(i, 4, 8401) * 64) * S;
      c.fillStyle = i % 3 === 0 ? 'rgba(130, 96, 22, 0.14)' : 'rgba(246, 218, 108, 0.14)';
      c.fillRect(rx, ry, rw, rh);
    }
    for (let i = 0; i < 42; i++) {
      const rx = x0 + hash2i(i, 5, 8402) * s;
      const rw = (2 + hash2i(i, 6, 8402) * 8) * S;
      const rh = (80 + hash2i(i, 7, 8402) * 260) * S;
      const rg = c.createLinearGradient(rx, y0, rx, y0 + rh);
      rg.addColorStop(0, 'rgba(72, 66, 36, 0.28)');
      rg.addColorStop(1, 'rgba(72, 66, 36, 0.0)');
      c.fillStyle = rg;
      c.fillRect(rx, y0, rw, rh);
    }
    // Lower damp moss/soot staining (Ref 84 & Ref 55!)
    for (let i = 0; i < 36; i++) {
      const mx = x0 + hash2i(i, 8, 8403) * s;
      const my = y0 + s * (0.80 + hash2i(i, 9, 8403) * 0.20);
      c.fillStyle = 'rgba(42, 50, 28, 0.42)';
      c.beginPath();
      c.ellipse(mx, my, (18 + hash2i(i, 10, 8403) * 40) * S, (12 + hash2i(i, 11, 8403) * 26) * S, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ---- (3) MATTE WEATHERED ANTIQUE TIMBER PLANKS (ZERO ZEBRA STRIPES! x:1536..2048, y:0..512) ----
  {
    const x0 = 1536 * S;
    const y0 = 0;
    const s = 512 * S;
    c.fillStyle = '#473327';
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#888888';
    ht.fillRect(x0, y0, s, s);
    const planks = 8;
    const pw = s / planks;
    for (let p = 0; p < planks; p++) {
      const px = x0 + p * pw;
      const tv = hash2i(p, 1, 5601);
      const r = clampByte(66 + (tv - 0.5) * 22);
      const g = clampByte(48 + (tv - 0.5) * 16);
      const b = clampByte(38 + (tv - 0.5) * 12);
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(px + 2 * S, y0, pw - 4 * S, s);
      // Soft fine longitudinal grain streaks (low contrast, authentic dusty raw wood!)
      for (let gIdx = 0; gIdx < 16; gIdx++) {
        const gx = px + (4 + hash2i(p, gIdx + 10, 5602) * (pw / S - 8)) * S;
        c.fillStyle = gIdx % 2 === 0 ? 'rgba(32, 22, 16, 0.16)' : 'rgba(116, 94, 78, 0.12)';
        c.fillRect(gx, y0, (1.5 + hash2i(p, gIdx + 30, 5602) * 2.5) * S, s);
      }
      // Dark plank gap seam
      c.fillStyle = '#221712';
      c.fillRect(px, y0, 3 * S, s);
      ht.fillStyle = '#363636';
      ht.fillRect(px, y0, 3 * S, s);
    }
  }

  // ---- (4) BẮC ĐẾ RED-OCHRE MOUNTAIN LANDSCAPE BACKBOARD MURAL (x:0..512, y:512..1024) ----
  {
    const x0 = 0;
    const y0 = 512 * S;
    const s = 512 * S;
    const bg = c.createLinearGradient(x0, y0, x0, y0 + s);
    bg.addColorStop(0.0, '#78462c');
    bg.addColorStop(0.45, '#8f4c30');
    bg.addColorStop(1.0, '#5a2d1d');
    c.fillStyle = bg;
    c.fillRect(x0, y0, s, s);
    // Faint vertical timber seams
    for (let p = 1; p < 6; p++) {
      c.fillStyle = 'rgba(36, 18, 12, 0.40)';
      c.fillRect(x0 + (p * s) / 6, y0, 3 * S, s);
    }
    // Faded antique ink mountain peaks & swirling mist behind Bắc Đế Trấn Võ (Ref 56!)
    c.fillStyle = 'rgba(42, 26, 20, 0.45)';
    c.beginPath();
    c.moveTo(x0, y0 + s * 0.85);
    c.quadraticCurveTo(x0 + s * 0.22, y0 + s * 0.36, x0 + s * 0.42, y0 + s * 0.64);
    c.quadraticCurveTo(x0 + s * 0.68, y0 + s * 0.28, x0 + s, y0 + s * 0.72);
    c.lineTo(x0 + s, y0 + s);
    c.lineTo(x0, y0 + s);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(210, 152, 92, 0.18)';
    c.fillRect(x0, y0 + s * 0.56, s, s * 0.12);
    ht.fillStyle = '#808080';
    ht.fillRect(x0, y0, s, s);
  }

  // ---- (5) BẮC ĐẾ CARVED ANTIQUE WOOD *KHÁM THỜ* TRANSOM & SEAL-SCRIPT PLAQUE (x:512..1024, y:512..1024) ----
  {
    const x0 = 512 * S;
    const y0 = 512 * S;
    const s = 512 * S;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#363636' : '#2a1d17';
      ctx.fillRect(x0, y0, s, s);
      // Outer carved frame border
      ctx.strokeStyle = isH ? '#d8d8d8' : '#644939';
      ctx.lineWidth = 14 * S;
      ctx.strokeRect(x0 + 12 * S, y0 + 12 * S, s - 24 * S, s - 24 * S);
      // Upper half (y0..y0+256): Pierced dragon-cloud filigree transom grillwork
      for (let i = 0; i < 4; i++) {
        drawCloudScroll(ctx, x0 + (76 + i * 120) * S, y0 + 110 * S, 1.8 * S, isH ? '#dcdcdc' : '#6e5240', isH ? '#222222' : '#1c120d', 3 * S, i % 2 === 0 ? 1 : -1);
        drawCloudScroll(ctx, x0 + (116 + i * 94) * S, y0 + 195 * S, 1.45 * S, isH ? '#c6c6c6' : '#5e4536', isH ? '#222222' : '#1c120d', 2.5 * S, i % 2 === 0 ? -1 : 1);
      }
      // Lower half (y0+256..y0+512): Recessed antique dark-wood Seal-Script Plaque (`北帝鎮武` archaic Triện thư)
      ctx.fillStyle = isH ? '#5a5a5a' : '#4a3529';
      ctx.fillRect(x0 + 34 * S, y0 + 286 * S, s - 68 * S, 192 * S);
      ctx.strokeStyle = isH ? '#e8e8e8' : '#7b5d49';
      ctx.lineWidth = 8 * S;
      ctx.strokeRect(x0 + 34 * S, y0 + 286 * S, s - 68 * S, 192 * S);
      ctx.fillStyle = isH ? '#f2f2f2' : '#967c64';
      ctx.font = `bold ${Math.round(86 * S)}px "KaiTi", "SimSun", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('北 帝 鎮 武', x0 + s * 0.5, y0 + 384 * S);
    }
  }

  // ---- (6) NHÀ CỔ TẤN KÝ *KHẢM XÀ CỪ* MOTHER-OF-PEARL INLAID DARK WOOD (x:1024..1536, y:512..1024) ----
  {
    const x0 = 1024 * S;
    const y0 = 512 * S;
    const s = 512 * S;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#565656' : '#18110e';
      ctx.fillRect(x0, y0, s, s);
      // Delicate museum-grade mother-of-pearl inlay framing (fine shimmering pearl lines, NOT thick white stripes!)
      ctx.strokeStyle = isH ? '#c6c6c6' : '#bfb89c';
      ctx.lineWidth = 3.5 * S;
      ctx.strokeRect(x0 + 26 * S, y0 + 26 * S, s - 52 * S, s - 52 * S);
      ctx.strokeStyle = isH ? '#a4a4a4' : '#8eb4ae';
      ctx.lineWidth = 2 * S;
      ctx.strokeRect(x0 + 40 * S, y0 + 40 * S, s - 80 * S, s - 80 * S);
      // Fine iridescent nacre river-pavilion, weeping willow & floral filigree (Ref 114!)
      const nacreCols = ['#d4ceb2', '#9ec2bc', '#c8b8ce', '#d8c48c'];
      for (let k = 0; k < 20; k++) {
        const nx = x0 + (78 + hash2i(k, 1, 1141) * 356) * S;
        const ny = y0 + (80 + hash2i(k, 2, 1141) * 348) * S;
        drawCloudScroll(ctx, nx, ny, (0.55 + hash2i(k, 3, 1141) * 0.48) * S, isH ? '#d8d8d8' : nacreCols[k % nacreCols.length], isH ? '#3a3a3a' : '#2a1e16', 1.6 * S, k % 2 === 0 ? 1 : -1);
      }
      ctx.strokeStyle = isH ? '#e0e0e0' : '#cfc8ac';
      ctx.lineWidth = 2.8 * S;
      ctx.beginPath();
      ctx.ellipse(x0 + s * 0.5, y0 + s * 0.5, 148 * S, 96 * S, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---- (7) NHÀ CỔ TẤN KÝ CELADON TWO-PANEL MOUNTAIN-LANDSCAPE SILK SCREEN (x:1536..2048, y:512..1024) ----
  {
    const x0 = 1536 * S;
    const y0 = 512 * S;
    const s = 512 * S;
    c.fillStyle = '#2a221c';
    c.fillRect(x0, y0, s, s);
    for (let panel = 0; panel < 2; panel++) {
      const px = x0 + (18 + panel * 246) * S;
      const py = y0 + 18 * S;
      const pw = 230 * S;
      const ph = 476 * S;
      // Celadon-sage silk mounting border + warm parchment painting field
      c.fillStyle = '#92a88e';
      c.fillRect(px, py, pw, ph);
      c.fillStyle = '#d4d8c4';
      c.fillRect(px + 14 * S, py + 18 * S, pw - 28 * S, ph - 36 * S);
      // Ink-wash misty mountains & pine trees (Ref 114 left!)
      c.fillStyle = '#6c7e6a';
      c.beginPath();
      c.moveTo(px + 14 * S, py + ph - 50 * S);
      c.quadraticCurveTo(px + pw * (panel === 0 ? 0.38 : 0.65), py + 85 * S, px + pw - 14 * S, py + ph - 95 * S);
      c.lineTo(px + pw - 14 * S, py + ph - 18 * S);
      c.lineTo(px + 14 * S, py + ph - 18 * S);
      c.closePath();
      c.fill();
      c.fillStyle = '#475746';
      c.beginPath();
      c.moveTo(px + 14 * S, py + ph - 18 * S);
      c.quadraticCurveTo(px + pw * 0.5, py + 230 * S, px + pw - 14 * S, py + ph - 18 * S);
      c.fill();
    }
    ht.fillStyle = '#808080';
    ht.fillRect(x0, y0, s, s);
  }

  // ---- (8) COBALT BLUE-AND-WHITE DRAGON PORCELAIN (x:0..512, y:1024..1536) ----
  {
    const x0 = 0;
    const y0 = 1024 * S;
    const s = 512 * S;
    c.fillStyle = '#f0f3f8';
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#888888';
    ht.fillRect(x0, y0, s, s);
    // Double cobalt shoulder & foot bands
    c.fillStyle = '#1b4298';
    c.fillRect(x0, y0 + 24 * S, s, 14 * S);
    c.fillRect(x0, y0 + 50 * S, s, 6 * S);
    c.fillRect(x0, y0 + s - 46 * S, s, 14 * S);
    // Painted cobalt dragons & swirling clouds
    for (let i = 0; i < 6; i++) {
      const dx = x0 + (54 + i * 80) * S;
      const dy = y0 + (195 + (i % 2) * 120) * S;
      drawCloudScroll(c, dx, dy, 1.55 * S, '#2452b4', '#143074', 3 * S, i % 2 === 0 ? 1 : -1);
    }
    c.strokeStyle = '#1d46a2';
    c.lineWidth = 18 * S;
    c.beginPath();
    c.moveTo(x0 + 20 * S, y0 + 260 * S);
    c.bezierCurveTo(x0 + 160 * S, y0 + 110 * S, x0 + 340 * S, y0 + 400 * S, x0 + 492 * S, y0 + 240 * S);
    c.stroke();
  }

  // ---- (9) HỘI QUÁN PHÚC KIẾN ROSE-PINK MASONRY BRICK WITH WHITE MORTAR (x:512..1024, y:1024..1536) ----
  {
    const x0 = 512 * S;
    const y0 = 1024 * S;
    const s = 512 * S;
    c.fillStyle = '#ebe4e0';
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#484848';
    ht.fillRect(x0, y0, s, s);
    const rows = 16;
    const cols = 8;
    const rh = s / rows;
    const cw = s / cols;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (cw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const bx = x0 + col * cw + shift;
        const by = y0 + r * rh;
        const tv = hash2i(col + 10, r, 1151);
        const cr = clampByte(198 + (tv - 0.5) * 26);
        const cg = clampByte(116 + (tv - 0.5) * 22);
        const cb = clampByte(126 + (tv - 0.5) * 22);
        c.fillStyle = `rgb(${cr},${cg},${cb})`;
        c.fillRect(Math.max(x0, bx + 3 * S), by + 3 * S, Math.min(cw - 6 * S, x0 + s - bx - 3 * S), rh - 6 * S);
        ht.fillStyle = '#c8c8c8';
        ht.fillRect(Math.max(x0, bx + 3 * S), by + 3 * S, Math.min(cw - 6 * S, x0 + s - bx - 3 * S), rh - 6 * S);
      }
    }
  }

  // ---- (10) CHÙA CẦU COBALT-BLUE & WHITE *KHẢM SÀNH SỨ* CERAMIC MOSAIC (x:1024..1536, y:1024..1536) ----
  {
    const x0 = 1024 * S;
    const y0 = 1024 * S;
    const s = 512 * S;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#808080' : '#eaedf4';
      ctx.fillRect(x0, y0, s, s);
      ctx.strokeStyle = isH ? '#dcdcdc' : '#2d4fa8';
      ctx.lineWidth = 10 * S;
      ctx.strokeRect(x0 + 18 * S, y0 + 18 * S, s - 36 * S, s - 36 * S);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          drawCloudScroll(
            ctx,
            x0 + (78 + col * 116) * S,
            y0 + (78 + row * 116) * S,
            1.45 * S,
            isH ? '#e2e2e2' : (row + col) % 2 === 0 ? '#3a62c4' : '#6c8ee0',
            isH ? '#363636' : '#18327a',
            2.6 * S,
            col % 2 === 0 ? 1 : -1
          );
        }
      }
    }
  }

  // ---- (11) FOREGROUND STONE/TERRACOTTA INCENSE BASIN (`來 遠 橋` + KEY-FRET RIM, x:1536..2048, y:1024..1536) ----
  {
    const x0 = 1536 * S;
    const y0 = 1024 * S;
    const s = 512 * S;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#787878' : '#a86c66';
      ctx.fillRect(x0, y0, s, s);
      // Top pale-grey carved key-fret (*hồi văn*) collar band (Ref 56 bottom!)
      ctx.fillStyle = isH ? '#b6b6b6' : '#b8b4ae';
      ctx.fillRect(x0, y0, s, 118 * S);
      ctx.strokeStyle = isH ? '#363636' : '#645c56';
      ctx.lineWidth = 6 * S;
      for (let k = 0; k < 7; k++) {
        ctx.strokeRect(x0 + (18 + k * 68) * S, y0 + 24 * S, 52 * S, 68 * S);
        ctx.strokeRect(x0 + (32 + k * 68) * S, y0 + 38 * S, 24 * S, 40 * S);
      }
      // Recessed pinkish panel with `來 遠 橋` inscription
      ctx.strokeStyle = isH ? '#d8d8d8' : '#c69a94';
      ctx.lineWidth = 10 * S;
      ctx.strokeRect(x0 + 34 * S, y0 + 150 * S, s - 68 * S, s - 190 * S);
      ctx.fillStyle = isH ? '#2e2e2e' : '#4a2e2c';
      ctx.font = `bold ${Math.round(86 * S)}px "KaiTi", "SimSun", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('橋 遠 來', x0 + s * 0.5, y0 + 318 * S);
    }
  }

  // ---- (12) WARM TERRACOTTA *NGÓI CHIẾU* CEILING TILES (x:0..512, y:1536..2048) ----
  {
    const x0 = 0;
    const y0 = 1536 * S;
    const s = 512 * S;
    const n = 14;
    const step = s / n;
    c.fillStyle = '#4a2012';
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#383838';
    ht.fillRect(x0, y0, s, s);
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        const tv = hash2i(col, r, 5611);
        c.fillStyle = `rgb(${clampByte(168 + (tv - 0.5) * 28)},${clampByte(84 + (tv - 0.5) * 18)},${clampByte(48 + (tv - 0.5) * 14)})`;
        c.fillRect(x0 + col * step + 2 * S, y0 + r * step + 2 * S, step - 4 * S, step - 4 * S);
        ht.fillStyle = '#c4c4c4';
        ht.fillRect(x0 + col * step + 2 * S, y0 + r * step + 2 * S, step - 4 * S, step - 4 * S);
      }
    }
  }

  // ---- (13) WEATHERED REDDISH-BROWN *GẠCH TÀU* SQUARE FLOOR TILES (x:512..1024, y:1536..2048) ----
  {
    const x0 = 512 * S;
    const y0 = 1536 * S;
    const s = 512 * S;
    const n = 8;
    const step = s / n;
    c.fillStyle = '#5a4438';
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#404040';
    ht.fillRect(x0, y0, s, s);
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        const tv = hash2i(col, r, 1147);
        c.fillStyle = `rgb(${clampByte(132 + (tv - 0.5) * 26)},${clampByte(76 + (tv - 0.5) * 18)},${clampByte(56 + (tv - 0.5) * 14)})`;
        c.fillRect(x0 + col * step + 3 * S, y0 + r * step + 3 * S, step - 6 * S, step - 6 * S);
        ht.fillStyle = '#c0c0c0';
        ht.fillRect(x0 + col * step + 3 * S, y0 + r * step + 3 * S, step - 6 * S, step - 6 * S);
      }
    }
  }

  // ---- (14) CARVED SPIRAL *MẮT CỬA HỘI AN* & DRAGON RAMP RELIEF (x:1024..1536, y:1536..2048) ----
  {
    const x0 = 1024 * S;
    const y0 = 1536 * S;
    const s = 512 * S;
    const cx = x0 + s * 0.5;
    const cy = y0 + s * 0.5;
    for (const [ctx, isH] of [[c, false], [ht, true]] as const) {
      ctx.fillStyle = isH ? '#525252' : '#4a3222';
      ctx.fillRect(x0, y0, s, s);
      // Octagonal petal wheel (`Mắt Cửa` spiral medallion — Ref 55!)
      ctx.fillStyle = isH ? '#c8c8c8' : '#7e5a3c';
      ctx.strokeStyle = isH ? '#ffffff' : '#c8a056';
      ctx.lineWidth = 10 * S;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = cx + Math.cos(a) * 212 * S;
        const py = cy + Math.sin(a) * 212 * S;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let r = 0; r < 8; r++) {
        const a = (r / 8) * Math.PI * 2;
        ctx.strokeStyle = isH ? '#e8e8e8' : '#d8b468';
        ctx.lineWidth = 8 * S;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.35) * 110 * S, cy + Math.sin(a + 0.35) * 110 * S, cx + Math.cos(a) * 186 * S, cy + Math.sin(a) * 186 * S);
        ctx.stroke();
      }
      ctx.fillStyle = isH ? '#ffffff' : '#deb862';
      ctx.beginPath();
      ctx.arc(cx, cy, 46 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- (15) MOSS-DRAPED AGED *NGÓI ÂM DƯƠNG* ROOF TILES (x:1536..2048, y:1536..2048) ----
  {
    const x0 = 1536 * S;
    const y0 = 1536 * S;
    const s = 512 * S;
    c.fillStyle = '#4e3e34';
    c.fillRect(x0, y0, s, s);
    ht.fillStyle = '#505050';
    ht.fillRect(x0, y0, s, s);
    const cols = 14;
    const rows = 12;
    const cw = s / cols;
    const rh = s / rows;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const tv = hash2i(col, row, 8455);
        const moss = hash2i(col + 3, row + 7, 8456) > 0.45 ? 1 : 0;
        const r = clampByte(moss ? 56 + tv * 24 : 96 + tv * 36);
        const g = clampByte(moss ? 78 + tv * 28 : 66 + tv * 24);
        const b = clampByte(moss ? 34 + tv * 14 : 52 + tv * 18);
        c.fillStyle = `rgb(${r},${g},${b})`;
        c.fillRect(x0 + col * cw + 2 * S, y0 + row * rh + 2 * S, cw - 4 * S, rh - 3 * S);
        ht.fillStyle = col % 2 === 0 ? '#d8d8d8' : '#7a7a7a';
        ht.fillRect(x0 + col * cw + 2 * S, y0 + row * rh + 2 * S, cw - 4 * S, rh - 3 * S);
      }
    }
  }

  return {
    map: wrapCanvasTex(cObj.canvas, true, renderer),
    normalMap: canvasToSobelNormal(hObj.canvas, 1.9, renderer)
  };
}

/**
 * 2. Builds the 1024×1536 Packed Hội An Calligraphy, Heritage Plaques & Illuminated Signage Atlas.
 */
function createHoiAnCalligraphyAtlas(renderer?: THREE.WebGLRenderer): THREE.Texture {
  const headless = isHeadlessRenderer(renderer);
  const w = headless ? 128 : 1024;
  const h = headless ? 192 : 1536;
  const cObj = makeCanvas(w, h);
  if (!cObj) {
    return finalizeDataTex(new Uint8Array([120, 28, 22, 255]), 1, 1, true, renderer);
  }
  const c = cObj.ctx;
  const S = w / 1024;
  c.fillStyle = '#3a1a14';
  c.fillRect(0, 0, w, h);

  const drawPlaque = (
    x: number,
    y: number,
    pw: number,
    ph: number,
    bg: string,
    border: string,
    fg: string,
    line1: string,
    size1: number,
    line2?: string,
    size2?: number
  ) => {
    c.fillStyle = bg;
    c.fillRect(x, y, pw, ph);
    c.strokeStyle = border;
    c.lineWidth = 9 * S;
    c.strokeRect(x + 9 * S, y + 9 * S, pw - 18 * S, ph - 18 * S);
    c.lineWidth = 3 * S;
    c.strokeRect(x + 22 * S, y + 22 * S, pw - 44 * S, ph - 44 * S);
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (line2) {
      c.font = `bold ${Math.round(size1 * S)}px "KaiTi", "SimSun", Georgia, serif`;
      c.fillText(line1, x + pw * 0.5, y + ph * 0.37);
      c.font = `bold ${Math.round((size2 ?? size1 * 0.65) * S)}px Georgia, serif`;
      c.fillText(line2, x + pw * 0.5, y + ph * 0.72);
    } else {
      c.font = `bold ${Math.round(size1 * S)}px "KaiTi", "SimSun", Georgia, serif`;
      c.fillText(line1, x + pw * 0.5, y + ph * 0.53);
    }
  };

  // Row 1 (y: 0..256): Lai Viễn Kiều (`來 遠 橋`) & Hội Quán Phúc Kiến (`館 會 建 福`)
  drawPlaque(0, 0, 512 * S, 256 * S, '#7c120e', '#e8ba42', '#fae278', '橋  遠  來', 94, 'LAI VIỄN KIỀU', 34);
  drawPlaque(512 * S, 0, 512 * S, 256 * S, '#f0c438', '#c62418', '#98140e', '館 會 建 福', 96);

  // Row 2 (y: 256..512): Illuminated `"記 進 / TẤN KÝ"`, `"寺 山 金"` & `"101"`
  {
    const x = 0;
    const y = 256 * S;
    const pw = 512 * S;
    const ph = 256 * S;
    c.fillStyle = '#fff8e2';
    c.fillRect(x, y, pw, ph);
    c.strokeStyle = '#c8b896';
    c.lineWidth = 9 * S;
    c.strokeRect(x + 9 * S, y + 9 * S, pw - 18 * S, ph - 18 * S);
    c.fillStyle = '#c8281c';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${Math.round(74 * S)}px "KaiTi", "SimSun", serif`;
    c.fillText('記    進', x + pw * 0.5, y + ph * 0.36);
    c.font = `bold ${Math.round(58 * S)}px "Times New Roman", "Segoe UI", serif`;
    c.fillText('TẤN KÝ', x + pw * 0.5, y + ph * 0.72);
  }
  drawPlaque(512 * S, 256 * S, 256 * S, 256 * S, '#f4efe6', '#8a322c', '#2a2220', '寺 山 金', 68);
  drawPlaque(768 * S, 256 * S, 256 * S, 256 * S, '#184e32', '#e8c448', '#f8dc68', '101', 112);

  // Row 3 (y: 512..1024):
  // Left (0..384): Mahogany `"Nhà cổ TẤN KÝ / Di tích cấp quốc gia / NATIONAL HERITAGE HOUSE"` (Ref 55!)
  {
    const x = 0;
    const y = 512 * S;
    const pw = 384 * S;
    const ph = 512 * S;
    c.fillStyle = '#5c2c18';
    c.fillRect(x, y, pw, ph);
    c.strokeStyle = '#361a0e';
    c.lineWidth = 14 * S;
    c.strokeRect(x + 12 * S, y + 12 * S, pw - 24 * S, ph - 24 * S);
    c.fillStyle = '#f2c444';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${Math.round(30 * S)}px "Times New Roman", "Segoe UI", serif`;
    c.fillText('Nhà cổ', x + pw * 0.5, y + 128 * S);
    c.font = `bold ${Math.round(52 * S)}px "Times New Roman", "Segoe UI", serif`;
    c.fillText('TẤN KÝ', x + pw * 0.5, y + 198 * S);
    c.font = `${Math.round(24 * S)}px "Times New Roman", "Segoe UI", serif`;
    c.fillText('Di tích cấp quốc gia', x + pw * 0.5, y + 278 * S);
    c.font = `bold ${Math.round(21 * S)}px "Times New Roman", "Segoe UI", serif`;
    c.fillText('NATIONAL HERITAGE HOUSE', x + pw * 0.5, y + 344 * S);
    drawCloudScroll(c, x + pw * 0.5, y + 432 * S, 1.3 * S, '#e8ba42', '#7a420c', 2.5 * S, 1);
  }
  // Center-top (384..704, y 512..860): Framed bilingual heritage certificate (`TK-27`)
  {
    const x = 384 * S;
    const y = 512 * S;
    const pw = 320 * S;
    const ph = 348 * S;
    c.fillStyle = '#2c1e16';
    c.fillRect(x, y, pw, ph);
    c.fillStyle = '#f2e8cc';
    c.fillRect(x + 16 * S, y + 16 * S, pw - 32 * S, ph - 32 * S);
    c.strokeStyle = '#c49a38';
    c.lineWidth = 4 * S;
    c.strokeRect(x + 26 * S, y + 26 * S, pw - 52 * S, ph - 52 * S);
    c.fillStyle = '#4a3624';
    for (let col = 0; col < 2; col++) {
      for (let line = 0; line < 14; line++) {
        c.fillRect(x + (40 + col * 128) * S, y + (54 + line * 18) * S, 108 * S, 5 * S);
      }
    }
  }
  // Center-bot (384..704, y 860..1024): Warm gold `"Weak chairs / Ghế yếu. Xin đừng ngồi."` card (`TK-30`)
  drawPlaque(384 * S, 860 * S, 320 * S, 164 * S, '#e2be48', '#8a1e16', '#24120c', 'Weak chairs. Please don\'t sit', 21, 'Ghế yếu. Xin đừng ngồi.', 22);

  // Right-top (704..1024, y 512..798): Glowing pierced octagonal turquoise-white ceramic window (`BD-16`)
  {
    const x = 704 * S;
    const y = 512 * S;
    const pw = 320 * S;
    const ph = 286 * S;
    c.fillStyle = '#d46c4c';
    c.fillRect(x, y, pw, ph);
    const cx = x + pw * 0.5;
    const cy = y + ph * 0.5;
    c.fillStyle = '#e8fcf6';
    c.strokeStyle = '#2d7a72';
    c.lineWidth = 14 * S;
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const px = cx + Math.cos(a) * 116 * S;
      const py = cy + Math.sin(a) * 116 * S;
      if (k === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // Pierced floral lattice crossbars
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI;
      c.beginPath();
      c.moveTo(cx - Math.cos(a) * 108 * S, cy - Math.sin(a) * 108 * S);
      c.lineTo(cx + Math.cos(a) * 108 * S, cy + Math.sin(a) * 108 * S);
      c.stroke();
    }
    c.beginPath();
    c.arc(cx, cy, 46 * S, 0, Math.PI * 2);
    c.stroke();
  }
  // Right-bot (704..1024, y 798..1024): Glowing golden calligraphic palace lantern face (`TK-10`)
  {
    const x = 704 * S;
    const y = 798 * S;
    const pw = 320 * S;
    const ph = 226 * S;
    const lg = c.createRadialGradient(x + pw * 0.5, y + ph * 0.5, 16 * S, x + pw * 0.5, y + ph * 0.5, 165 * S);
    lg.addColorStop(0, '#fff4a8');
    lg.addColorStop(0.65, '#f6b828');
    lg.addColorStop(1, '#c86614');
    c.fillStyle = lg;
    c.fillRect(x, y, pw, ph);
    c.strokeStyle = '#381e12';
    c.lineWidth = 12 * S;
    c.strokeRect(x + 8 * S, y + 8 * S, pw - 16 * S, ph - 16 * S);
    c.fillStyle = '#4e240c';
    c.font = `bold ${Math.round(78 * S)}px "KaiTi", "SimSun", serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('福 壽', x + pw * 0.5, y + ph * 0.52);
  }

  // Row 4 (y: 1024..1536): 6 Vertical Couplets (x: 0..768) + 4 Traditional Shop Signs (x: 768..1024)
  const drawVert = (x: number, bg: string, border: string, fg: string, chars: string) => {
    const y0 = 1024 * S;
    const vw = 128 * S;
    const vh = 512 * S;
    c.fillStyle = bg;
    c.fillRect(x, y0, vw, vh);
    c.strokeStyle = border;
    c.lineWidth = 4 * S;
    c.strokeRect(x + 8 * S, y0 + 8 * S, vw - 16 * S, vh - 16 * S);
    c.fillStyle = fg;
    c.font = `bold ${Math.round(52 * S)}px "KaiTi", "SimSun", serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const step = (vh - 44 * S) / chars.length;
    for (let i = 0; i < chars.length; i++) {
      c.fillText(chars[i], x + vw * 0.5, y0 + 26 * S + (i + 0.5) * step);
    }
  };
  drawVert(0, '#463226', '#6c503e', '#221610', '明明帝德耀千秋');
  drawVert(128 * S, '#463226', '#6c503e', '#221610', '赫赫神威昭萬古');
  drawVert(256 * S, '#3a2920', '#5a4234', '#1c120c', '浮梁通文萬里程');
  drawVert(384 * S, '#3a2920', '#5a4234', '#1c120c', '刺蛟得道千年蹟');
  drawVert(512 * S, '#221a16', '#98a69e', '#dce2d4', '竹報平安春長在');
  drawVert(640 * S, '#7e1a18', '#e6b842', '#fae078', '與貴是人之所欲');

  const shops = [
    ['TIỆM ĐÈN LỒNG', 'HỘI AN XƯA', '#261814'],
    ['TRÀ MÓT HỘI AN', 'THẢO MỘC', '#6a1814'],
    ['GỐM THANH HÀ', 'MỸ NGHỆ', '#281c16'],
    ['NHÀ MAY LỤA XƯA', 'LỤA TƠ TẰM', '#5e1a16']
  ];
  for (let i = 0; i < 4; i++) {
    drawPlaque(768 * S, (1024 + i * 128) * S, 256 * S, 128 * S, shops[i][2], '#deb446', '#fae084', shops[i][0], 24, shops[i][1], 18);
  }

  return wrapCanvasTex(cObj.canvas, true, renderer);
}

/**
 * Creates the ultra-lean 3-material Hội An Ancient Town Museum Pack.
 */
export function createHoiAnMaterialPack(renderer?: THREE.WebGLRenderer): HoiAnMaterialPack {
  const relief = createHoiAnReliefAtlas(renderer);
  const signTex = createHoiAnCalligraphyAtlas(renderer);
  const lanternTimeUniform = { uTime: { value: 0.0 } };

  const hoiAnReliefAtlasMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: relief.map,
    normalMap: relief.normalMap,
    normalScale: new THREE.Vector2(1.75, 1.75),
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  const hoiAnCalligraphyMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: signTex,
    emissiveMap: signTex,
    emissive: new THREE.Color('#ffd078'),
    emissiveIntensity: 0.14,
    roughness: 0.44,
    metalness: 0.12,
    fog: false
  });

  // Upgraded Hội An Silk Lantern Shader (replaces old silkLanternMat -> 0 net extra materials!)
  // Adds vertical bamboo ribs, woven silk sheen, brocade/calligraphy shadow bands & gentle wind sway (`HA-24..26`).
  const hoiAnSilkLanternMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: '#ff9638',
    emissiveIntensity: 1.95,
    roughness: 0.36
  });
  hoiAnSilkLanternMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = lanternTimeUniform.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec2 vLanternUv;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLanternUv = uv;
         if (position.y > 1.8) {
           float sway = sin(uTime * 1.45 + position.x * 0.37 + position.z * 0.29) * 0.048;
           transformed.x += sway;
           transformed.z += cos(uTime * 1.15 + position.z * 0.41) * 0.030;
         } else {
           transformed.y += sin(uTime * 1.8 + position.x * 0.7 + position.z * 0.5) * 0.022;
         }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vLanternUv;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // Crisp 16-rib vertical bamboo frame + warm internal core falloff + subtle woven silk motif
         float ribWave = abs(sin(vLanternUv.x * 3.14159265 * 16.0));
         float vertRib = 0.62 + 0.40 * smoothstep(0.06, 0.26, ribWave);
         float coreGlow = 0.72 + 0.42 * sin(vLanternUv.y * 3.14159265);
         float brocade = 0.90 + 0.10 * sin(vLanternUv.x * 48.0) * sin(vLanternUv.y * 28.0);
         totalEmissiveRadiance *= vColor * vertRib * coreGlow * brocade;`
      );
  };

  return {
    hoiAnReliefAtlasMat,
    hoiAnCalligraphyMat,
    hoiAnSilkLanternMat,
    lanternTimeUniform,
    allMaterials: [hoiAnReliefAtlasMat, hoiAnCalligraphyMat, hoiAnSilkLanternMat],
    allTextures: [relief.map, relief.normalMap, signTex]
  };
}
